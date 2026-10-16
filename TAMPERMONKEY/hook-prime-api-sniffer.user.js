// ==UserScript==
// @name         HOOK PRIME — Sniffer de Engenharia Reversa & Ponte Sankhya (sktk) v1.0
// @namespace    https://brk.sankhyacloud.com.br/
// @version      1.0.0
// @description  Sincroniza automaticamente sktk + mgeSession do Sankhya com o HUB (consultas em 40ms) e grava endpoints de Sankhya, Magis5 e Shopify Admin em tempo real.
// @author       Hook Prime Enterprise
// @match        *://brk.sankhyacloud.com.br/*
// @match        *://*/*mge*
// @match        *://app.magis5.com.br/*
// @match        *://admin.shopify.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const HUB_URLS = ['http://localhost:3000', 'http://localhost:3001'];
  const host = (location.hostname || '').toLowerCase();

  const PLATFORM = host.includes('sankhya') || location.pathname.includes('/mge')
    ? 'sankhya'
    : host.includes('magis5')
    ? 'magis5'
    : host.includes('shopify')
    ? 'shopify'
    : 'other';

  let lastSentSktk = GM_getValue('hp_last_sktk', '');
  let lastSentSession = GM_getValue('hp_last_mge_session', '');

  function postToHub(endpoint, payload) {
    const bodyStr = JSON.stringify(payload);
    for (const base of HUB_URLS) {
      try {
        GM_xmlhttpRequest({
          method: 'POST',
          url: base + endpoint,
          headers: { 'Content-Type': 'application/json' },
          data: bodyStr,
          timeout: 4000,
          onload: function () {},
          onerror: function () {},
        });
      } catch (_) {}
    }
  }

  function syncSankhyaSessionIfChanged(newSktk, newSession) {
    const sktk = newSktk || GM_getValue('sankhya_token', '');
    const mgeSession = newSession || GM_getValue('sankhya_session', '');
    if (!sktk || !mgeSession) return;
    if (sktk === lastSentSktk && mgeSession === lastSentSession) return;

    lastSentSktk = sktk;
    lastSentSession = mgeSession;
    GM_setValue('hp_last_sktk', sktk);
    GM_setValue('hp_last_mge_session', mgeSession);

    postToHub('/api/reverse-map/sankhya-session', {
      host: location.origin,
      sktk,
      mgeSession,
      userAgent: navigator.userAgent,
      captureSource: 'hook-prime-api-sniffer',
    });
  }

  function isInterestingApiUrl(url) {
    if (!url) return false;
    const u = String(url);
    if (u.includes('localhost:3000') || u.includes('localhost:3001') || u.includes('127.0.0.1')) return false;
    if (PLATFORM === 'sankhya') {
      return u.includes('service.sbr') || u.includes('sessionUpload') || u.includes('imagerender');
    }
    if (PLATFORM === 'magis5') {
      return u.includes('/v1/') || u.includes('/api/') || u.includes('announcement') || u.includes('product') || u.includes('stock');
    }
    if (PLATFORM === 'shopify') {
      return u.includes('graphql') || u.includes('/products') || u.includes('/variants');
    }
    return false;
  }

  function sendBlueprintCapture({ method, url, headers, body, responseText }) {
    if (!GM_getValue('hp_sniffer_recording', false)) return;
    if (!isInterestingApiUrl(url)) return;

    let parsedPayload = body;
    if (typeof body === 'string') {
      try { parsedPayload = JSON.parse(body); } catch (_) { parsedPayload = body.slice(0, 1500); }
    }

    let responsePreview = null;
    if (typeof responseText === 'string' && responseText.length > 0) {
      responsePreview = responseText.slice(0, 1500);
    }

    postToHub('/api/reverse-map/capture', {
      platform: PLATFORM,
      method: method || 'POST',
      url: String(url),
      headers: headers || {},
      payload: parsedPayload,
      responsePreview,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. INTERCEPTAÇÃO DE XMLHttpRequest (TODOS OS IFRAMES, DOCUMENT-START)
  // ═══════════════════════════════════════════════════════════════════════════

  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._hpMethod = method;
    this._hpUrl = String(url || '');
    this._hpHeaders = {};

    if (this._hpUrl.includes('mgeSession=')) {
      const m = this._hpUrl.match(/mgeSession=([^&]+)/);
      if (m && m[1]) {
        GM_setValue('sankhya_session', m[1]);
        syncSankhyaSessionIfChanged(null, m[1]);
      }
    }
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    if (header) {
      this._hpHeaders = this._hpHeaders || {};
      this._hpHeaders[header] = value;
      if (header.toLowerCase() === 'sktk' && value) {
        GM_setValue('sankhya_token', value);
        syncSankhyaSessionIfChanged(value, null);
      }
    }
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    if (GM_getValue('hp_sniffer_recording', false) && isInterestingApiUrl(xhr._hpUrl)) {
      xhr.addEventListener('load', function () {
        let respText = '';
        try { respText = typeof xhr.responseText === 'string' ? xhr.responseText : ''; } catch (_) {}
        sendBlueprintCapture({
          method: xhr._hpMethod,
          url: xhr._hpUrl,
          headers: xhr._hpHeaders,
          body,
          responseText: respText,
        });
      });
    }
    return origSend.apply(this, arguments);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. INTERCEPTAÇÃO DE window.fetch (MAGIS5 / SHOPIFY / SANKHYA MODERNO)
  // ═══════════════════════════════════════════════════════════════════════════

  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch;
    window.fetch = async function (input, init = {}) {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      const method = (init && init.method) || (input && input.method) || 'GET';

      if (url && url.includes('mgeSession=')) {
        const m = url.match(/mgeSession=([^&]+)/);
        if (m && m[1]) {
          GM_setValue('sankhya_session', m[1]);
          syncSankhyaSessionIfChanged(null, m[1]);
        }
      }

      const resp = await origFetch.apply(this, arguments);

      if (GM_getValue('hp_sniffer_recording', false) && isInterestingApiUrl(url)) {
        try {
          const clone = resp.clone();
          clone.text().then((txt) => {
            sendBlueprintCapture({
              method,
              url,
              headers: init.headers || {},
              body: init.body || null,
              responseText: txt,
            });
          }).catch(() => {});
        } catch (_) {}
      }

      return resp;
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. PAINEL FLUTUANTE COMPACTO (APENAS NA JANELA PRINCIPAL)
  // ═══════════════════════════════════════════════════════════════════════════

  if (window !== window.top) return;

  function mountSnifferPill() {
    if (document.getElementById('hp-sniffer-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'hp-sniffer-pill';
    pill.style.cssText = [
      'position:fixed',
      'bottom:14px',
      'left:14px',
      'z-index:2147483646',
      'background:#0f172a',
      'color:#e2e8f0',
      'border:1px solid #334155',
      'border-radius:999px',
      'padding:6px 12px',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:12px',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'box-shadow:0 8px 20px rgba(0,0,0,0.45)',
      'user-select:none',
    ].join(';');

    const statusDot = document.createElement('span');
    statusDot.style.cssText = 'width:8px;height:8px;border-radius:50%;display:inline-block;background:#10b981;';

    const label = document.createElement('span');
    label.textContent = `🕵️ HP Lab (${PLATFORM.toUpperCase()})`;
    label.style.fontWeight = '600';

    const btnRecord = document.createElement('button');
    btnRecord.style.cssText = [
      'border:none',
      'border-radius:999px',
      'padding:4px 10px',
      'font-size:11px',
      'font-weight:700',
      'cursor:pointer',
      'color:#fff',
      'transition:all 0.15s',
    ].join(';');

    function updateButtonVisual() {
      const rec = GM_getValue('hp_sniffer_recording', false);
      if (rec) {
        btnRecord.textContent = '⏹️ Gravando API... (Clique p/ Parar)';
        btnRecord.style.background = '#ef4444';
        statusDot.style.background = '#ef4444';
      } else {
        btnRecord.textContent = '🔴 Gravar Ação';
        btnRecord.style.background = '#3b82f6';
        const hasSktk = Boolean(GM_getValue('sankhya_token', ''));
        statusDot.style.background = hasSktk ? '#10b981' : '#f59e0b';
      }
    }

    btnRecord.addEventListener('click', () => {
      const current = GM_getValue('hp_sniffer_recording', false);
      GM_setValue('hp_sniffer_recording', !current);
      updateButtonVisual();
    });

    const linkLab = document.createElement('a');
    linkLab.href = 'http://localhost:3000/reverse-lab';
    linkLab.target = '_blank';
    linkLab.textContent = '↗ Lab';
    linkLab.style.cssText = 'color:#38bdf8;text-decoration:none;font-weight:600;font-size:11px;';

    pill.appendChild(statusDot);
    pill.appendChild(label);
    pill.appendChild(btnRecord);
    pill.appendChild(linkLab);
    document.body.appendChild(pill);

    updateButtonVisual();

    // Reenvia a sessão ativa do Sankhya ao carregar a página para garantir que o HUB esteja sincronizado
    if (PLATFORM === 'sankhya') {
      const savedSktk = GM_getValue('sankhya_token', '');
      const savedSess = GM_getValue('sankhya_session', '');
      if (savedSktk && savedSess) {
        postToHub('/api/reverse-map/sankhya-session', {
          host: location.origin,
          sktk: savedSktk,
          mgeSession: savedSess,
          userAgent: navigator.userAgent,
          captureSource: 'hook-prime-api-sniffer-startup',
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', mountSnifferPill);
  } else {
    mountSnifferPill();
  }
})();
