// ==UserScript==
// @name         Hook Prime HUB v3.2
// @namespace    hookprime
// @version      3.2.0
// @description  Envia tasks do ClickUp para HUB Hook Prime
// @author       Hook Prime
// @match        https://app.clickup.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var HUB = 'http://localhost:3000';
  var hubOnline = false;
  var panelOpen = false;
  var sent = {};
  try { sent = JSON.parse(localStorage.getItem('hp_sent') || '{}'); } catch(e) { sent = {}; }

  // ═══ CSS ═══
  var style = document.createElement('style');
  style.textContent = [
    '#hp-fab{position:fixed!important;bottom:20px!important;right:20px!important;width:54px!important;height:54px!important;',
    'border-radius:50%!important;background:linear-gradient(135deg,#00C9A7,#00B4D8)!important;color:#fff!important;',
    'border:none!important;font-size:22px!important;cursor:pointer!important;z-index:2147483647!important;',
    'box-shadow:0 4px 20px rgba(0,201,167,.5)!important;display:flex!important;align-items:center!important;',
    'justify-content:center!important;transition:transform .2s,box-shadow .2s!important;line-height:1!important;padding:0!important}',
    '#hp-fab:hover{transform:scale(1.15)!important;box-shadow:0 6px 28px rgba(0,201,167,.7)!important}',
    '#hp-fab .hp-icon{font-size:24px!important;filter:drop-shadow(0 0 4px rgba(0,201,167,.6))!important}',
    '#hp-panel{position:fixed!important;bottom:84px!important;right:20px!important;width:310px!important;',
    'background:#0d1117!important;border:1px solid #00C9A7!important;border-radius:14px!important;',
    'padding:18px!important;z-index:2147483646!important;box-shadow:0 12px 40px rgba(0,0,0,.7)!important;',
    'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif!important;color:#e5e7eb!important}',
    '.hp-pbtn{display:block!important;width:100%!important;padding:11px!important;border:none!important;',
    'border-radius:8px!important;font-size:13px!important;font-weight:600!important;cursor:pointer!important;',
    'text-align:center!important;margin-bottom:8px!important;font-family:inherit!important;transition:opacity .2s!important}',
    '.hp-pbtn:hover{opacity:.85!important}',
    '.hp-pbtn:disabled{opacity:.4!important;cursor:not-allowed!important}',
    '#hp-toast{position:fixed!important;top:20px!important;right:20px!important;padding:14px 24px!important;',
    'border-radius:10px!important;color:#fff!important;font-size:13px!important;font-weight:600!important;',
    'z-index:2147483647!important;box-shadow:0 8px 30px rgba(0,0,0,.4)!important;',
    'font-family:-apple-system,sans-serif!important}'
  ].join('\n');
  document.head.appendChild(style);

  // ═══ TOAST ═══
  function toast(msg, color) {
    var old = document.getElementById('hp-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'hp-toast';
    el.textContent = msg;
    el.style.background = color || 'linear-gradient(135deg,#00C9A7,#00B4D8)';
    document.body.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 4000);
  }

  // ═══ API ═══
  function checkHub(cb) {
    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: HUB + '/api/autopilot/ping',
        timeout: 3000,
        onload: function(r) {
          try { hubOnline = JSON.parse(r.responseText).online === true; } catch(e) { hubOnline = false; }
          if (cb) cb(hubOnline);
        },
        onerror: function() { hubOnline = false; if (cb) cb(false); },
        ontimeout: function() { hubOnline = false; if (cb) cb(false); }
      });
    } catch(e) {
      hubOnline = false;
      if (cb) cb(false);
    }
  }

  function postTask(data, onOk, onErr) {
    GM_xmlhttpRequest({
      method: 'POST',
      url: HUB + '/api/autopilot/tasks',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(data),
      timeout: 10000,
      onload: function(r) {
        try {
          var d = JSON.parse(r.responseText);
          if (d.success) {
            sent[data.title] = Date.now();
            try { localStorage.setItem('hp_sent', JSON.stringify(sent)); } catch(e) {}
            onOk(d);
          } else {
            onErr(d.error || 'Erro ao enviar');
          }
        } catch(e) { onErr('Resposta inv\u00e1lida'); }
      },
      onerror: function() { onErr('HUB offline ou inacess\u00edvel'); },
      ontimeout: function() { onErr('Timeout \u2014 servidor n\u00e3o respondeu'); }
    });
  }

  // ═══ DETECTAR TASK (título) ═══
  function detectTitle() {
    var tas = document.querySelectorAll('textarea');
    for (var i = 0; i < tas.length; i++) {
      var v = (tas[i].value || '').trim();
      if (v.length > 2 && v.length < 200) return v;
    }
    var hs = document.querySelectorAll('h1, h2, h3');
    for (var j = 0; j < hs.length; j++) {
      var t = hs[j].textContent.trim();
      if (t.length > 3 && t.length < 150 && t.indexOf('ClickUp') === -1 && t.indexOf('Home') === -1) return t;
    }
    return null;
  }

  // ═══ DETECTAR DESCRIÇÃO (múltiplos fallbacks) ═══
  function detectDescription() {
    // Seletores mais específicos primeiro, depois mais genéricos
    var selectors = [
      '.cu-task-description .ProseMirror',
      '.cu-task-description',
      '.ql-editor',
      '.ProseMirror',
      '.task-description',
      '.cu-task-body__description',
      '[data-testid="task-description"]',
      '.cu-rich-text__content',
      '.cu-editor-content',
      '.task-detail__description',
      '.cu-markdown__content'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var text = (el.innerText || el.textContent || '').trim();
        if (text.length > 3) return text;
      }
    }

    // Fallback nuclear: pegar todo o texto visível da task view
    var views = [
      '.cu-task-view-modal',
      '.cu-modal__inner',
      '[data-testid="task-detail-view"]',
      '.cu-panel__body',
      '.cu-task-body'
    ];

    for (var j = 0; j < views.length; j++) {
      var view = document.querySelector(views[j]);
      if (view) {
        var viewText = (view.innerText || view.textContent || '').trim();
        if (viewText.length > 10) return viewText;
      }
    }

    return '';
  }

  // ═══ RENDER PANEL ═══
  function renderPanel() {
    var panel = document.getElementById('hp-panel');
    if (!panel) return;

    var title = detectTitle();
    var desc = detectDescription();
    var codeCount = 0;
    if (desc) {
      var codeMatches = desc.match(/\b[A-Z]{1,6}\d{3,6}\b/gi);
      codeCount = codeMatches ? codeMatches.length : 0;
    }

    var dot = hubOnline ? '\uD83D\uDFE2' : '\uD83D\uDD34';
    var statusTxt = hubOnline ? 'Online' : 'Offline';

    panel.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
      + '  <span style="font-weight:700;font-size:15px;color:#00C9A7">\uD83D\uDC80 Hook Prime</span>'
      + '  <span style="font-size:12px">' + dot + ' ' + statusTxt + '</span>'
      + '</div>'
      + '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:0 0 12px">'
      + (title
        ? '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px">'
        + '  <div style="color:#9ca3af;font-size:10px;margin-bottom:4px">TASK DETECTADA:</div>'
        + '  <div style="color:#e5e7eb;font-weight:600">' + title + '</div>'
        + (codeCount > 0
          ? '<div style="color:#38bdf8;font-size:10px;margin-top:4px">\uD83D\uDD0D ' + codeCount + ' c\u00f3digo(s) detectado(s) na descri\u00e7\u00e3o</div>'
          : '<div style="color:#f59e0b;font-size:10px;margin-top:4px">\u26A0\uFE0F Nenhum c\u00f3digo na descri\u00e7\u00e3o (envie mesmo assim)</div>')
        + (sent[title] ? '<div style="color:#00C9A7;font-size:10px;margin-top:4px">\u2705 J\u00e1 enviada</div>' : '')
        + '</div>'
        : '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#f87171">'
        + '  \u26A0\uFE0F Nenhuma task aberta. Clique em uma task ou use envio manual.'
        + '</div>'
      )
      + '<button id="hp-send" class="hp-pbtn" style="background:linear-gradient(135deg,#00C9A7,#00B4D8);color:#fff"'
      + ((!hubOnline || !title) ? ' disabled' : '') + '>'
      + '  \uD83D\uDE80 Enviar para HUB'
      + '</button>'
      + '<button id="hp-manual" class="hp-pbtn" style="background:rgba(255,255,255,.06);color:#9ca3af;border:1px solid rgba(255,255,255,.1)">'
      + '  \u270F\uFE0F Enviar manualmente (digitar nome)'
      + '</button>'
      + '<hr style="border:0;border-top:1px solid rgba(255,255,255,.1);margin:12px 0 8px">'
      + '<a href="' + HUB + '" target="_blank" style="color:#00C9A7;text-decoration:none;font-size:11px">'
      + '  \uD83D\uDD17 Abrir HUB (localhost:3000)'
      + '</a>';

    // Bind send — agora com descrição!
    var sendBtn = document.getElementById('hp-send');
    if (sendBtn) {
      sendBtn.onclick = function() {
        var t = detectTitle();
        if (!t) { toast('\u26A0\uFE0F Abra uma task primeiro!', '#f59e0b'); return; }
        var d = detectDescription();
        sendBtn.disabled = true;
        sendBtn.textContent = '\u23F3 Enviando...';
        postTask(
          { title: t, description: d, url: window.location.href },
          function(r) {
            var codes = r.task ? r.task.totalCodes : 0;
            sendBtn.textContent = '\u2705 Enviada! (' + codes + ' c\u00f3digos)';
            sendBtn.style.background = '#1a1a2e';
            sendBtn.style.border = '1px solid #00C9A7';
            sendBtn.style.color = '#00C9A7';
            toast('\u2705 "' + t + '" enviada ao HUB! (' + codes + ' c\u00f3digos)');
          },
          function(err) {
            sendBtn.disabled = false;
            sendBtn.textContent = '\u274C Erro \u2014 Tentar novamente';
            sendBtn.style.background = '#ef4444';
            toast('\u274C ' + err, '#ef4444');
          }
        );
      };
    }

    // Bind manual
    var manualBtn = document.getElementById('hp-manual');
    if (manualBtn) {
      manualBtn.onclick = function() {
        var name = prompt('Digite o nome da task:');
        if (!name || !name.trim()) return;
        manualBtn.disabled = true;
        manualBtn.textContent = '\u23F3 Enviando...';
        var d = detectDescription();
        postTask(
          { title: name.trim(), description: d, url: window.location.href },
          function(r) {
            var codes = r.task ? r.task.totalCodes : 0;
            manualBtn.textContent = '\u2705 Enviada! (' + codes + ' c\u00f3digos)';
            toast('\u2705 "' + name + '" enviada! (' + codes + ' c\u00f3digos)');
            setTimeout(function() {
              manualBtn.textContent = '\u270F\uFE0F Enviar manualmente (digitar nome)';
              manualBtn.disabled = false;
              manualBtn.style.background = 'rgba(255,255,255,.06)';
              manualBtn.style.color = '#9ca3af';
            }, 3000);
          },
          function(err) {
            manualBtn.disabled = false;
            manualBtn.textContent = '\u270F\uFE0F Enviar manualmente (digitar nome)';
            toast('\u274C ' + err, '#ef4444');
          }
        );
      };
    }
  }

  // ═══ CRIAR UI ═══
  function createUI() {
    if (document.getElementById('hp-fab')) return;
    console.log('[HookPrime] Criando FAB...');

    var fab = document.createElement('button');
    fab.id = 'hp-fab';
    fab.title = 'Hook Prime HUB';
    // Ícone street: caveira com fogo 🔥💀
    fab.innerHTML = '<span class="hp-icon">\uD83D\uDC80</span>';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'hp-panel';
    panel.style.display = 'none';
    document.body.appendChild(panel);

    fab.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      panelOpen = !panelOpen;

      if (panelOpen) {
        panel.style.display = 'block';
        panel.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">\u23F3 Verificando HUB...</div>';
        checkHub(function() {
          renderPanel();
        });
      } else {
        panel.style.display = 'none';
      }
    });

    document.addEventListener('click', function(e) {
      if (panelOpen && !panel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) {
        panelOpen = false;
        panel.style.display = 'none';
      }
    });

    console.log('[HookPrime] UI criada com sucesso');
  }

  // ═══ INIT ═══
  console.log('[HookPrime] v3.2 carregado');

  function init() {
    console.log('[HookPrime] init()');
    createUI();
    checkHub(function(online) {
      console.log('[HookPrime] HUB:', online ? 'ONLINE' : 'OFFLINE');
    });
  }

  if (document.body) {
    setTimeout(init, 1500);
  } else {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 1500); });
  }

  setTimeout(function() {
    if (!document.getElementById('hp-fab')) {
      console.log('[HookPrime] FALLBACK init');
      init();
    }
  }, 5000);

})();
