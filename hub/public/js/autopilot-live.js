/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Lucas RTX Live Stream Panel
   Experiência visual ao vivo tipo "live stream" com preview de
   imagens, activity feed, terminal e stats em tempo real
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ═══ ESTADO DO PROCESSO ═══
  const state = {
    running: false,
    stopped: false,
    phase: 0,
    currentCode: '',
    totalCodes: 0,
    processedCodes: 0,
    foundImages: 0,
    copiedImages: 0,
    cdnUploaded: 0,
    totalBytes: 0,
    logs: [],
    startTime: null,
    // Activity cards
    codeCards: [],        // { code, status, estampa, genders, imageCount, source, images: [] }
    previewImages: [],    // { src, code, gender, angle, status }
    activePreviewCode: null,
    // Para resume
    pendingCodes: [],
    scanResults: [],
    taskRef: null,
    planRef: null,
    parsedRef: null,
    terminalExpanded: true,
  };

  const PHASES = [
    { id: 0, label: 'Aguardando',       icon: '⏳', color: '#6b7280' },
    { id: 1, label: 'Analisando',       icon: '🔍', color: '#8b5cf6' },
    { id: 2, label: 'Scan Rede',        icon: '📡', color: '#0ea5e9' },
    { id: 3, label: 'Copiando',         icon: '📂', color: '#06b6d4' },
    { id: 4, label: 'Upload CDN',       icon: '☁️', color: '#7F00FF' },
    { id: 5, label: 'Concluído',        icon: '✅', color: '#7C3AED' },
    { id: -1, label: 'Pausado',         icon: '⏸️', color: '#f59e0b' },
    { id: -2, label: 'Erro',            icon: '❌', color: '#ef4444' },
  ];

  // ═══ LOG ═══
  function log(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString('pt-BR');
    state.logs.push({ ts, msg, type });
    if (state.logs.length > 500) state.logs.shift();
    updateTerminalUI();
    // Pulse LIVE badge
    const badge = document.querySelector('.rtx-live-badge');
    if (badge) {
      badge.classList.remove('rtx-live-badge--pulse');
      void badge.offsetWidth;
      badge.classList.add('rtx-live-badge--pulse');
    }
  }

  // ═══ RENDER PANEL ═══
  function getPhaseData(id) {
    return PHASES.find(p => p.id === id) || PHASES[0];
  }

  function show() {
    if (document.getElementById('rtx-live-panel')) return;

    const overlay = document.createElement('div');
    overlay.id = 'rtx-live-panel';
    overlay.innerHTML = `
      <div class="rtx-backdrop"></div>
      <div class="rtx-container">
        
        <!-- ══ HEADER ══ -->
        <div class="rtx-header">
          <div class="rtx-header__left">
            <div class="rtx-live-badge">🔴 LIVE</div>
            <div class="rtx-header__info">
              <div class="rtx-header__title">Lucas RTX</div>
              <div class="rtx-header__subtitle" id="rtx-task-name">Iniciando processo...</div>
            </div>
          </div>
          <div class="rtx-header__right">
            <div class="rtx-header__timer" id="rtx-timer">00:00</div>
            <button class="rtx-btn rtx-btn--pause" id="rtx-pause-btn" title="Pausar">
              <span>⏸️</span> Pausar
            </button>
            <button class="rtx-btn rtx-btn--close" id="rtx-close-btn" title="Minimizar">✕</button>
          </div>
        </div>

        <!-- ══ PHASE TIMELINE ══ -->
        <div class="rtx-timeline" id="rtx-timeline">
          ${renderTimeline()}
        </div>

        <!-- ══ PROGRESS BAR ══ -->
        <div class="rtx-progress">
          <div class="rtx-progress__bar" id="rtx-progress-bar"></div>
          <div class="rtx-progress__text" id="rtx-progress-text">0%</div>
        </div>

        <!-- ══ MAIN BODY — SPLIT PANEL ══ -->
        <div class="rtx-body">

          <!-- LEFT: Preview de Imagens -->
          <div class="rtx-preview">
            <div class="rtx-preview__header">
              <span class="rtx-preview__title">🖼️ Preview ao Vivo</span>
              <span class="rtx-preview__nav" id="rtx-preview-nav"></span>
            </div>
            <div class="rtx-preview__grid" id="rtx-preview-grid">
              <div class="rtx-preview__empty">
                <div class="rtx-preview__empty-icon">📡</div>
                <div>Aguardando imagens da rede...</div>
              </div>
            </div>
          </div>

          <!-- RIGHT: Activity Feed -->
          <div class="rtx-activity">
            <div class="rtx-activity__header">
              <span>📡 Atividade em Tempo Real</span>
              <span class="rtx-activity__count" id="rtx-activity-count">0 códigos</span>
            </div>
            <div class="rtx-activity__feed" id="rtx-activity-feed">
              <div class="rtx-activity__empty">Aguardando scan...</div>
            </div>
          </div>

        </div>

        <!-- ══ STATS BAR ══ -->
        <div class="rtx-stats" id="rtx-stats">
          <div class="rtx-stat">
            <div class="rtx-stat__value" id="rtx-s-codes">0/0</div>
            <div class="rtx-stat__label">Códigos</div>
          </div>
          <div class="rtx-stat">
            <div class="rtx-stat__value" id="rtx-s-found">0</div>
            <div class="rtx-stat__label">Encontradas</div>
          </div>
          <div class="rtx-stat">
            <div class="rtx-stat__value" id="rtx-s-copied">0</div>
            <div class="rtx-stat__label">Copiadas</div>
          </div>
          <div class="rtx-stat">
            <div class="rtx-stat__value" id="rtx-s-cdn">0</div>
            <div class="rtx-stat__label">CDN</div>
          </div>
          <div class="rtx-stat">
            <div class="rtx-stat__value" id="rtx-s-size">0 B</div>
            <div class="rtx-stat__label">Transferido</div>
          </div>
          <div class="rtx-stat">
            <div class="rtx-stat__value" id="rtx-s-speed">—</div>
            <div class="rtx-stat__label">Velocidade</div>
          </div>
        </div>

        <!-- ══ TERMINAL ══ -->
        <div class="rtx-terminal ${state.terminalExpanded ? '' : 'rtx-terminal--collapsed'}">
          <div class="rtx-terminal__header" id="rtx-terminal-toggle">
            <span>💻 Terminal</span>
            <span class="rtx-terminal__toggle-icon">${state.terminalExpanded ? '▼' : '▲'}</span>
          </div>
          <div class="rtx-terminal__body" id="rtx-terminal-body">
            <div class="rtx-terminal__empty">$ aguardando processo...</div>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // Binds
    document.getElementById('rtx-pause-btn').onclick = toggleStop;
    document.getElementById('rtx-close-btn').onclick = minimize;
    document.getElementById('rtx-terminal-toggle').onclick = toggleTerminal;

    // Timer
    state.startTime = Date.now();
    state._timer = setInterval(updateTimer, 1000);
  }

  // ═══ TIMELINE ═══
  function renderTimeline() {
    const visible = PHASES.filter(p => p.id >= 1 && p.id <= 5);
    return visible.map((p, i) => {
      const isDone = state.phase > p.id;
      const isActive = state.phase === p.id;
      let cls = 'rtx-tl-step';
      if (isDone) cls += ' rtx-tl-step--done';
      if (isActive) cls += ' rtx-tl-step--active';
      return `
        <div class="${cls}">
          <div class="rtx-tl-step__dot" style="--step-color: ${p.color}">
            ${isDone ? '✓' : p.icon}
          </div>
          <div class="rtx-tl-step__label">${p.label}</div>
        </div>
        ${i < visible.length - 1 ? '<div class="rtx-tl-line' + (isDone ? ' rtx-tl-line--done' : isActive ? ' rtx-tl-line--active' : '') + '"></div>' : ''}
      `;
    }).join('');
  }

  function updateTimeline() {
    const el = document.getElementById('rtx-timeline');
    if (el) el.innerHTML = renderTimeline();
  }

  // ═══ TERMINAL ═══
  function toggleTerminal() {
    state.terminalExpanded = !state.terminalExpanded;
    const term = document.querySelector('.rtx-terminal');
    if (term) term.classList.toggle('rtx-terminal--collapsed', !state.terminalExpanded);
    const icon = document.querySelector('.rtx-terminal__toggle-icon');
    if (icon) icon.textContent = state.terminalExpanded ? '▼' : '▲';
  }

  function updateTerminalUI() {
    const body = document.getElementById('rtx-terminal-body');
    if (!body) return;

    const html = state.logs.slice(-80).map(l => {
      const cls = l.type === 'error' ? 'rtx-t-error'
               : l.type === 'success' ? 'rtx-t-success'
               : l.type === 'warn' ? 'rtx-t-warn'
               : 'rtx-t-info';
      return `<div class="rtx-t-line ${cls}"><span class="rtx-t-ts">${l.ts}</span> ${window.HUB.esc(l.msg)}</div>`;
    }).join('');

    body.innerHTML = html || '<div class="rtx-terminal__empty">$ aguardando processo...</div>';

    // Auto-scroll
    if (!body._userScrolled) {
      body.scrollTop = body.scrollHeight;
    }
  }

  // ═══ ACTIVITY FEED ═══
  function addCodeCard(code, status, extra = {}) {
    const existing = state.codeCards.find(c => c.code === code);
    if (existing) {
      Object.assign(existing, { status, ...extra });
    } else {
      state.codeCards.push({ code, status, estampa: '', genders: [], imageCount: 0, source: '', images: [], ...extra });
    }
    updateActivityFeed();
  }

  function updateCodeCard(code, updates) {
    const card = state.codeCards.find(c => c.code === code);
    if (card) Object.assign(card, updates);
    updateActivityFeed();
  }

  function updateActivityFeed() {
    const feed = document.getElementById('rtx-activity-feed');
    const count = document.getElementById('rtx-activity-count');
    if (!feed) return;

    if (count) count.textContent = `${state.codeCards.length} código${state.codeCards.length !== 1 ? 's' : ''}`;

    if (state.codeCards.length === 0) {
      feed.innerHTML = '<div class="rtx-activity__empty">Aguardando scan...</div>';
      return;
    }

    const statusIcons = {
      scanning: '<span class="rtx-ac-status rtx-ac-status--scanning">📡</span>',
      found: '<span class="rtx-ac-status rtx-ac-status--found">✅</span>',
      notfound: '<span class="rtx-ac-status rtx-ac-status--notfound">⚠️</span>',
      copying: '<span class="rtx-ac-status rtx-ac-status--copying">📂</span>',
      copied: '<span class="rtx-ac-status rtx-ac-status--copied">📂</span>',
      uploading: '<span class="rtx-ac-status rtx-ac-status--uploading">☁️</span>',
      uploaded: '<span class="rtx-ac-status rtx-ac-status--uploaded">🔗</span>',
      done: '<span class="rtx-ac-status rtx-ac-status--done">✅</span>',
      error: '<span class="rtx-ac-status rtx-ac-status--error">❌</span>',
    };

    const statusLabels = {
      scanning: 'Buscando na rede...',
      found: 'Encontrado',
      notfound: 'Não encontrado',
      copying: 'Copiando imagens...',
      copied: 'Imagens copiadas',
      uploading: 'Enviando para CDN...',
      uploaded: 'URLs no CDN',
      done: 'Concluído',
      error: 'Erro',
    };

    // Mostrar os mais recentes primeiro
    const sorted = [...state.codeCards].reverse();

    feed.innerHTML = sorted.map(c => {
      const genderBadges = (c.genders || []).map(g =>
        `<span class="rtx-ac-badge rtx-ac-badge--${g.toLowerCase()}">${g}</span>`
      ).join('');

      const thumbs = (c.images || []).slice(0, 4).map(img =>
        `<img class="rtx-ac-thumb" src="/api/preview-image?path=${encodeURIComponent(img.localPath || '')}" alt="${img.angle || ''}" title="${img.angle || img.name || ''}" onerror="this.style.display='none'">`
      ).join('');

      return `
        <div class="rtx-ac-card rtx-ac-card--${c.status}" data-code="${c.code}" onclick="window.HUB._rtxPreviewCode('${c.code}')">
          <div class="rtx-ac-card__header">
            ${statusIcons[c.status] || ''}
            <span class="rtx-ac-card__code">${c.code}</span>
            ${c.estampa ? `<span class="rtx-ac-card__estampa">"${c.estampa}"</span>` : ''}
          </div>
          <div class="rtx-ac-card__body">
            <span class="rtx-ac-card__status-text">${statusLabels[c.status] || c.status}</span>
            ${c.imageCount > 0 ? `<span class="rtx-ac-card__count">${c.imageCount} img</span>` : ''}
            ${genderBadges}
            ${c.source ? `<span class="rtx-ac-card__source" title="${c.source}">📁 ${c.source.split('/').pop() || c.source.split('\\\\').pop()}</span>` : ''}
          </div>
          ${thumbs ? `<div class="rtx-ac-card__thumbs">${thumbs}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // ═══ IMAGE PREVIEW ═══
  function addPreviewImages(code, images) {
    for (const img of images) {
      state.previewImages.push({
        src: `/api/preview-image?path=${encodeURIComponent(img.localPath || '')}`,
        code: code,
        gender: img.gender || 'GERAL',
        angle: img.angle || img.name || '',
        status: 'copied',
        localPath: img.localPath,
      });
    }
    if (!state.activePreviewCode) state.activePreviewCode = code;
    updatePreviewGrid();
  }

  function updatePreviewGrid() {
    const grid = document.getElementById('rtx-preview-grid');
    const nav = document.getElementById('rtx-preview-nav');
    if (!grid) return;

    // Filtrar pelo código ativo
    const codes = [...new Set(state.previewImages.map(i => i.code))];
    const activeCode = state.activePreviewCode || codes[0];
    const imgs = state.previewImages.filter(i => i.code === activeCode);

    if (nav) {
      const idx = codes.indexOf(activeCode);
      nav.innerHTML = codes.length > 0 ? `
        <button class="rtx-preview__nav-btn" onclick="window.HUB._rtxNavPreview(-1)" ${idx <= 0 ? 'disabled' : ''}>◀</button>
        <span class="rtx-preview__nav-label">${activeCode} (${idx + 1}/${codes.length})</span>
        <button class="rtx-preview__nav-btn" onclick="window.HUB._rtxNavPreview(1)" ${idx >= codes.length - 1 ? 'disabled' : ''}>▶</button>
      ` : '';
    }

    if (imgs.length === 0) {
      grid.innerHTML = `<div class="rtx-preview__empty"><div class="rtx-preview__empty-icon">📡</div><div>Aguardando imagens da rede...</div></div>`;
      return;
    }

    grid.innerHTML = imgs.map(img => `
      <div class="rtx-preview__item rtx-preview__item--${img.status}">
        <img src="${img.src}" alt="${img.angle}" loading="lazy" onerror="this.parentElement.classList.add('rtx-preview__item--broken')">
        <div class="rtx-preview__item-info">
          <span class="rtx-preview__item-badge rtx-preview__item-badge--${img.gender.toLowerCase()}">${img.gender}</span>
          <span class="rtx-preview__item-angle">${img.angle}</span>
        </div>
        ${img.status === 'uploaded' ? '<div class="rtx-preview__item-cdn">☁️ CDN</div>' : ''}
      </div>
    `).join('');
  }

  // Navigation helpers
  window.HUB._rtxNavPreview = function(dir) {
    const codes = [...new Set(state.previewImages.map(i => i.code))];
    const idx = codes.indexOf(state.activePreviewCode);
    const next = idx + dir;
    if (next >= 0 && next < codes.length) {
      state.activePreviewCode = codes[next];
      updatePreviewGrid();
    }
  };

  window.HUB._rtxPreviewCode = function(code) {
    if (state.previewImages.some(i => i.code === code)) {
      state.activePreviewCode = code;
      updatePreviewGrid();
    }
  };

  // ═══ STATS ═══
  function updateStats() {
    const el = (id, val) => {
      const e = document.getElementById(id);
      if (e && e.textContent !== String(val)) {
        e.textContent = val;
        e.classList.remove('rtx-stat--bump');
        void e.offsetWidth;
        e.classList.add('rtx-stat--bump');
      }
    };
    el('rtx-s-codes', `${state.processedCodes}/${state.totalCodes}`);
    el('rtx-s-found', state.foundImages);
    el('rtx-s-copied', state.copiedImages);
    el('rtx-s-cdn', state.cdnUploaded);
    el('rtx-s-size', formatBytes(state.totalBytes));

    // Speed
    if (state.startTime && state.copiedImages > 0) {
      const elapsed = (Date.now() - state.startTime) / 60000; // minutes
      const speed = Math.round(state.copiedImages / Math.max(elapsed, 0.1));
      el('rtx-s-speed', `${speed}/min`);
    }

    // Progress bar
    const pct = state.totalCodes > 0 ? Math.round((state.processedCodes / state.totalCodes) * 100) : 0;
    const bar = document.getElementById('rtx-progress-bar');
    const txt = document.getElementById('rtx-progress-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) {
      const remaining = state.totalCodes - state.processedCodes;
      txt.textContent = `${pct}% · ${state.processedCodes}/${state.totalCodes} códigos${remaining > 0 ? ` · ~${remaining} restantes` : ''}`;
    }
  }

  function updateCurrentAction(text) {
    const el = document.getElementById('rtx-task-name');
    if (el) el.textContent = text;
  }

  function setTaskName(name) {
    const el = document.getElementById('rtx-task-name');
    if (el) el.textContent = name;
  }

  function updateTimer() {
    if (!state.startTime) return;
    const diff = Math.floor((Date.now() - state.startTime) / 1000);
    const min = String(Math.floor(diff / 60)).padStart(2, '0');
    const sec = String(diff % 60).padStart(2, '0');
    const el = document.getElementById('rtx-timer');
    if (el) el.textContent = `${min}:${sec}`;
  }

  // ═══ STOP / RESUME ═══
  function toggleStop() {
    const btn = document.getElementById('rtx-pause-btn');
    if (state.stopped) {
      state.stopped = false;
      if (btn) btn.innerHTML = '<span>⏸️</span> Pausar';
      if (btn) btn.classList.remove('rtx-btn--resume');
      log('▶️ Processo retomado pelo operador', 'success');
      if (state._phaseBeforePause) setPhase(state._phaseBeforePause);
      if (state._resumeCallback) state._resumeCallback();
    } else {
      state._phaseBeforePause = state.phase;
      state.stopped = true;
      if (btn) btn.innerHTML = '<span>▶️</span> Retomar';
      if (btn) btn.classList.add('rtx-btn--resume');
      setPhase(-1);
      log('⏸️ Processo pausado pelo operador', 'warn');
      updateCurrentAction('Pausado — clique em Retomar para continuar');
    }
  }

  function minimize() {
    const panel = document.getElementById('rtx-live-panel');
    if (!panel) return;

    if (!document.getElementById('rtx-mini-badge')) {
      const badge = document.createElement('div');
      badge.id = 'rtx-mini-badge';
      badge.className = 'rtx-mini-badge';
      const phaseData = getPhaseData(state.phase);
      badge.innerHTML = `
        <div class="rtx-mini-badge__dot" style="background:${phaseData.color}"></div>
        <span>🔴 ${phaseData.icon} ${state.processedCodes}/${state.totalCodes}</span>
      `;
      badge.onclick = () => {
        badge.remove();
        panel.style.display = '';
      };
      document.body.appendChild(badge);
    }

    panel.style.display = 'none';
  }

  function setPhase(id) {
    state.phase = id;
    updateTimeline();
    const phaseData = getPhaseData(id);

    const badge = document.getElementById('rtx-mini-badge');
    if (badge) {
      const dot = badge.querySelector('.rtx-mini-badge__dot');
      if (dot) dot.style.background = phaseData.color;
      badge.querySelector('span').textContent = `🔴 ${phaseData.icon} ${state.processedCodes}/${state.totalCodes}`;
    }
  }

  function close() {
    const panel = document.getElementById('rtx-live-panel');
    if (panel) panel.remove();
    const badge = document.getElementById('rtx-mini-badge');
    if (badge) badge.remove();
    if (state._timer) clearInterval(state._timer);
    // Reset completo
    Object.assign(state, {
      logs: [], phase: 0, processedCodes: 0, totalCodes: 0,
      foundImages: 0, copiedImages: 0, cdnUploaded: 0, totalBytes: 0,
      stopped: false, running: false, startTime: null,
      pendingCodes: [], codeCards: [], previewImages: [],
      activePreviewCode: null, _phaseBeforePause: null,
    });
    if (state._timer) { clearInterval(state._timer); state._timer = null; }
    if (state._autoNavTimer) { clearTimeout(state._autoNavTimer); state._autoNavTimer = null; }
    if (state._resumeCallback) { state._resumeCallback(); state._resumeCallback = null; }
  }

  // ═══ EXECUTAR PROCESSO COM LIVE TRACKING ═══
  async function execute(task, parsed, plan) {
    if (state.running) {
      window.HUB?.showToast('⚠️ Processo já em andamento!', 'warn');
      return;
    }
    state.running = true;
    state.stopped = false;
    state.taskRef = task;
    state.planRef = plan;
    state.parsedRef = parsed;

    show();
    setTaskName(task.title || 'Tarefa');

    // ── FASE 1: ANÁLISE ──
    setPhase(1);
    log('🔍 Iniciando análise da tarefa...', 'info');
    updateCurrentAction('Analisando tarefa e extraindo códigos...');

    const allCodes = [];
    for (const g of plan.groups) {
      if (g.codes) allCodes.push(...g.codes);
    }

    state.totalCodes = allCodes.length;
    updateStats();
    log(`📋 Tarefa: "${task.title}"`, 'info');
    log(`🔢 ${allCodes.length} código(s) detectado(s)`, 'success');

    if (allCodes.length === 0) {
      log('❌ Nenhum código extraído — verifique a tarefa', 'error');
      setPhase(-2);
      updateCurrentAction('Erro: nenhum código encontrado');
      state.running = false;
      if (state._timer) clearInterval(state._timer);
      return;
    }

    const prefixes = {};
    for (const code of allCodes) {
      const m = code.match(/^[A-Z]+/i);
      const p = m ? m[0].toUpperCase() : '?';
      if (!prefixes[p]) prefixes[p] = [];
      prefixes[p].push(code);
    }

    for (const [prefix, codes] of Object.entries(prefixes)) {
      log(`   📦 ${prefix}: ${codes[0]} → ${codes[codes.length - 1]} (${codes.length} códigos)`, 'info');
      // Add cards in "waiting" state
      for (const code of codes) {
        addCodeCard(code, 'scanning');
      }
    }

    await sleep(300);

    // ── FASE 2: SMART-SCAN ──
    setPhase(2);
    log('📡 Iniciando Smart-Scan na rede...', 'info');
    updateCurrentAction('Conectando à rede \\\\192.168.100.100...');

    const allScanResults = [];

    for (const [prefix, codes] of Object.entries(prefixes)) {
      if (state.stopped) {
        log('⏸️ Aguardando retomada...', 'warn');
        await waitForResume();
      }

      log(`📡 Buscando ${prefix} na rede (${codes.length} códigos)...`, 'info');
      updateCurrentAction(`Buscando ${prefix} — ${codes.length} códigos na rede...`);

      try {
        const scanRes = await fetch('/api/network/smart-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codes })
        });

        if (!scanRes.ok) {
          const errText = await scanRes.text();
          log(`   ❌ Erro no scan ${prefix}: HTTP ${scanRes.status} — ${errText.substring(0, 80)}`, 'error');
          for (const code of codes) updateCodeCard(code, { status: 'error' });
          continue;
        }

        const scanData = await scanRes.json();

        if (scanData.results) {
          for (const r of scanData.results) {
            state.processedCodes++;
            if (r.found) {
              state.foundImages += r.images ? r.images.length : 0;
              const genders = [...new Set((r.images || []).map(i => (i.gender || 'GERAL').toUpperCase()))];
              updateCodeCard(r.code, {
                status: 'found',
                estampa: r.estampa || '',
                imageCount: r.images?.length || 0,
                genders,
                source: r.source || '',
              });
              log(`   ✅ ${r.code} — ${r.images?.length || 0} imagem(ns) ${r.estampa ? '• "' + r.estampa + '"' : ''} [${r.source || '?'}]`, 'success');
            } else {
              updateCodeCard(r.code, { status: 'notfound' });
              log(`   ⚠️ ${r.code} — não encontrado na rede`, 'warn');
            }
            updateStats();
            updateCurrentAction(`Scan ${prefix} — ${r.code} processado`);
          }
          allScanResults.push(...scanData.results);
        }
      } catch (e) {
        log(`   ❌ Erro ao buscar ${prefix}: ${e.message}`, 'error');
      }
    }

    state.scanResults = allScanResults;
    const foundCount = allScanResults.filter(r => r.found).length;
    log(`📊 Scan completo: ${foundCount}/${allScanResults.length} encontrados, ${state.foundImages} imagens`, 'success');

    // ── FASE 3: COPIAR IMAGENS ──
    setPhase(3);
    const foundResults = allScanResults.filter(r => r.found && r.images && r.images.length > 0);
    const safeFolderName = (task.title || 'tarefa')
      .replace(/[<>:"\\/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80) || 'tarefa-' + Date.now();
    const taskId = safeFolderName;
    let allCopyResults = [];

    if (foundResults.length === 0) {
      log('⚠️ Nenhuma imagem para copiar', 'warn');
    } else {
      if (state.stopped) {
        log('⏸️ Aguardando retomada para copiar...', 'warn');
        await waitForResume();
      }

      const totalImgs = foundResults.reduce((acc, r) => acc + r.images.length, 0);
      log(`📂 Iniciando cópia: ${totalImgs} imagens de ${foundResults.length} códigos...`, 'info');

      for (let i = 0; i < foundResults.length; i++) {
        const item = foundResults[i];
        const codeLabel = item.code || '???';
        const imgCount = item.images?.length || 0;

        if (state.stopped) {
          log(`⏸️ Pausado antes de copiar ${codeLabel}...`, 'warn');
          await waitForResume();
        }

        updateCodeCard(codeLabel, { status: 'copying' });
        updateCurrentAction(`Copiando ${codeLabel} (${i + 1}/${foundResults.length}) — ${imgCount} imagem(ns)...`);

        try {
          const copyRes = await fetch('/api/autopilot/copy-network-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: [item], taskId })
          });

          if (!copyRes.ok) {
            const errText = await copyRes.text();
            log(`   ❌ ${codeLabel} — erro HTTP ${copyRes.status}: ${errText.substring(0, 80)}`, 'error');
            updateCodeCard(codeLabel, { status: 'error' });
            continue;
          }

          const copyData = await copyRes.json();

          if (copyData.results && copyData.results.length > 0) {
            const cr = copyData.results[0];
            const count = cr.totalCopied || cr.images?.length || 0;
            const filtered = cr.totalFiltered || 0;
            state.copiedImages += count;
            const bytes = Array.isArray(cr.images) ? cr.images.reduce((acc, im) => acc + (im.sizeKB || 0) * 1024, 0) : 0;
            state.totalBytes += bytes;
            const sizeStr = formatBytes(bytes);
            const filterMsg = filtered > 0 ? ` (${filtered} humanizadas ignoradas)` : '';

            updateCodeCard(codeLabel, {
              status: 'copied',
              imageCount: count,
              images: cr.images || [],
            });

            // Add to preview grid!
            if (cr.images && cr.images.length > 0) {
              addPreviewImages(codeLabel, cr.images);
            }

            log(`   ✅ ${codeLabel} — ${count} copiada(s) ${cr.estampa ? '• "' + cr.estampa + '"' : ''} (${sizeStr})${filterMsg}`, 'success');
            allCopyResults.push(...copyData.results);
          } else {
            log(`   ⚠️ ${codeLabel} — 0 imagens copiadas`, 'warn');
          }
          updateStats();
        } catch (e) {
          log(`   ❌ ${codeLabel} — erro: ${e.message}`, 'error');
          updateCodeCard(codeLabel, { status: 'error' });
        }
      }

      log(`✅ Cópia concluída: ${state.copiedImages} imagens copiadas de ${foundResults.length} códigos`, 'success');
    }

    // ── FASE 4: UPLOAD CDN AUTOMÁTICO ──
    setPhase(4);
    const cdnUrlMap = {};

    if (allCopyResults.length > 0) {
      log('☁️ Enviando imagens para o CDN (BRK Link)...', 'info');
      updateCurrentAction('Upload automático para CDN...');

      const uploadBlocks = [];
      for (const cr of allCopyResults) {
        if (!cr.images || !Array.isArray(cr.images)) continue;
        const groups = {};
        for (const img of cr.images) {
          const gender = (img.gender || 'GERAL').toUpperCase();
          const variant = (img.variant || 'GERAL').toUpperCase();
          const key = `${gender}__${variant}`;
          if (!groups[key]) groups[key] = { code: cr.code, gender, variant, images: [] };
          groups[key].images.push(img);
        }
        uploadBlocks.push(...Object.values(groups));
      }

      let uploadDone = 0;
      const uploadTotal = uploadBlocks.length;

      for (const block of uploadBlocks) {
        if (state.stopped) {
          log(`⏸️ Pausado antes de enviar ${block.code}/${block.gender}/${block.variant}...`, 'warn');
          await waitForResume();
        }

        uploadDone++;
        const blockLabel = `${block.code}/${block.gender}/${block.variant}`;
        updateCodeCard(block.code, { status: 'uploading' });
        updateCurrentAction(`☁️ CDN ${uploadDone}/${uploadTotal}: ${blockLabel} (${block.images.length} imgs)...`);

        try {
          const first = block.images[0];
          if (!first || !first.localPath) {
            log(`   ⚠️ ${blockLabel} — sem localPath, pulando`, 'warn');
            continue;
          }

          const imgFolder = first.localPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '');
          const collectionId = `${block.code}_${block.gender}_${block.variant}`;

          const resp = await fetch('/api/s3-proxy/upload-from-folder-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: imgFolder, collectionId })
          });

          const data = await resp.json();

          if (data.success && data.urls && data.urls.length > 0) {
            cdnUrlMap[collectionId] = data.joined;
            const colorKey = `${block.code}_${block.variant}`;
            if (cdnUrlMap[colorKey]) {
              cdnUrlMap[colorKey] += ' | ' + data.joined;
            } else {
              cdnUrlMap[colorKey] = data.joined;
            }

            state.cdnUploaded += data.urls.length;

            // Mark preview images as uploaded
            state.previewImages.forEach(img => {
              if (img.code === block.code) img.status = 'uploaded';
            });
            updatePreviewGrid();

            updateCodeCard(block.code, { status: 'uploaded' });
            log(`   ✅ ${blockLabel} → ${data.urls.length} URLs no CDN`, 'success');
          } else {
            log(`   ⚠️ ${blockLabel} — CDN retornou 0 URLs: ${data.error || ''}`, 'warn');
          }
          updateStats();
        } catch (e) {
          log(`   ❌ ${blockLabel} — erro CDN: ${e.message}`, 'error');
        }
      }

      const colorCount = Object.keys(cdnUrlMap).filter(k => !k.includes('MASC') && !k.includes('FEM')).length;
      log(`☁️ Upload CDN concluído: ${uploadTotal} blocos → ${colorCount} cores com URLs`, 'success');
    }

    // Salvar URLs no payload para o wizard
    const networkPayload = {
      scanResults: allScanResults,
      copyResults: { results: allCopyResults },
      cdnUrls: cdnUrlMap,
      taskId,
      taskTitle: task.title,
    };
    sessionStorage.setItem('autopilot-network-payload', JSON.stringify(networkPayload));

    // ── FASE 5: GERAR PLANILHA ──
    setPhase(5);
    log('📊 Gerando planilha...', 'info');
    updateCurrentAction('Gerando planilha...');
    await sleep(300);

    const apcCodes = allScanResults
      .filter(r => r.found && r.code.startsWith('APC'))
      .map(r => ({
        code: r.code,
        estampa: r.estampa || '',
        detectedColors: r.detectedColors || []
      }));

    if (apcCodes.length > 0) {
      const totalColors = apcCodes.reduce((sum, c) => sum + (c.detectedColors.length || 3), 0);
      log(`📊 Gerando planilha APC Bling (${apcCodes.length} códigos, ${totalColors} blocos de cor)...`, 'info');
      updateCurrentAction(`Gerando planilha APC — ${apcCodes.length} códigos...`);

      try {
        const sheetRes = await fetch('/api/autopilot/generate-apc-spreadsheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codes: apcCodes,
            taskTitle: task.title || 'APC_PLANILHA',
            taskId,
            cdnUrls: cdnUrlMap
          })
        });
        const sheetData = await sheetRes.json();

        if (sheetData.success) {
          const s = sheetData.summary;
          log(`   ✅ Planilha gerada: ${s.totalProducts} produtos, ${s.totalVariations} variações`, 'success');
          log(`   📁 Arquivo: ${sheetData.fileName}`, 'info');
          log(`   🎨 Cores: ${s.colors.join(', ')} | Tamanhos: ${s.sizes.join(', ')}`, 'info');
          if (Object.keys(cdnUrlMap).length > 0) {
            log(`   🔗 URLs do CDN injetadas na planilha automaticamente!`, 'success');
          }
          sessionStorage.setItem('autopilot-spreadsheet-url', sheetData.downloadUrl);
          sessionStorage.setItem('autopilot-spreadsheet-name', sheetData.fileName);
        } else {
          log(`   ⚠️ Erro ao gerar planilha: ${sheetData.error}`, 'error');
        }
      } catch (e) {
        log(`   ❌ Erro ao gerar planilha APC: ${e.message}`, 'error');
      }
    }

    // Launch autopilot wizard
    if (window.HUB.AutopilotAgent) {
      window.HUB.AutopilotAgent.launchAutopilot(parsed, plan, { navigate: false });
    }

    // Update task status
    try {
      await fetch(`/api/autopilot/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
    } catch (e) {}

    // Mark all cards as done
    state.codeCards.forEach(c => {
      if (c.status !== 'error' && c.status !== 'notfound') c.status = 'done';
    });
    updateActivityFeed();

    // ── CONCLUÍDO ──
    setPhase(5);
    log('🎉 Processo concluído com sucesso!', 'success');
    log(`📊 Resumo: ${state.processedCodes} códigos, ${state.foundImages} encontradas, ${state.copiedImages} copiadas, ${state.cdnUploaded} CDN`, 'info');
    log(`📂 Pasta: uploads/autopilot/${taskId}/`, 'info');
    updateCurrentAction('✅ Concluído! Clique para ir ao Lucas RTX');

    // Update button
    const btn = document.getElementById('rtx-pause-btn');
    if (btn) {
      btn.innerHTML = '<span>🚀</span> Ir para Lucas RTX';
      btn.className = 'rtx-btn rtx-btn--go';
      btn.onclick = () => {
        if (state._autoNavTimer) { clearTimeout(state._autoNavTimer); state._autoNavTimer = null; }
        close();
        window.HUB?.navigate?.('autopilot');
      };
    }

    // Auto-navegar após 5 segundos
    state._autoNavTimer = setTimeout(() => {
      if (state.phase === 5) {
        close();
        window.HUB?.navigate?.('autopilot');
      }
    }, 5000);

    state.running = false;
  }

  // ═══ HELPERS ═══
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitForResume() {
    return new Promise(resolve => {
      state._resumeCallback = resolve;
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ═══ EXPORT ═══
  window.HUB.AutopilotLive = {
    execute,
    show,
    close,
    log,
    state,
  };

})();
