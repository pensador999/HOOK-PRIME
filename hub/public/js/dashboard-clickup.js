/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Dashboard (Página Inicial com Radar ClickUp)
   Premium Glassmorphism Design com Glow Effect
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  window.HUB.renderDashboard = function () {
    const container = document.getElementById('app-content');
    if (!container) return;
    const s = window.HUB.state.counters || { planilhas: 0, pastas: 0, fluxos: 1, tempo: '—' };

    container.innerHTML = `
      <style>
      .spinner-sm { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; } @keyframes spin { to { transform:rotate(360deg); } }

      /* ═══ DASH HERO — Glassmorphic Video Card ═══ */
      .dash-hero {
        position: relative;
        border-radius: 24px;
        overflow: hidden;
        min-height: 420px;
        background: rgba(15, 14, 23, 0.6);
        border: 1px solid rgba(170, 255, 0, 0.2);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        display: flex;
        align-items: flex-end;
        margin-bottom: 2rem;
      }
      .dash-hero__video {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        opacity: 0.45;
        z-index: 0;
      }
      .dash-hero__gradient {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(15,14,23,0.2) 0%, rgba(15,14,23,0.85) 100%);
        z-index: 1;
      }
      .dash-hero__content {
        position: relative; z-index: 2;
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding: 2.5rem;
        gap: 2rem;
      }
      .dash-hero__left { flex: 1; }
      .dash-hero__badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(170, 255, 0, 0.15);
        border: 1px solid rgba(170, 255, 0, 0.3);
        border-radius: 20px;
        padding: 4px 14px;
        font-size: 0.7rem;
        color: #88CC00;
        text-transform: uppercase;
        letter-spacing: 2px;
        font-weight: 600;
        margin-bottom: 1rem;
      }
      .dash-hero__badge svg { width: 12px; height: 12px; }
      .dash-hero__title {
        font-size: clamp(2.5rem, 5vw, 3.5rem);
        font-weight: 800;
        letter-spacing: -1px;
        line-height: 1.1;
        background: linear-gradient(135deg, #fff 0%, #88CC00 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.5rem;
      }
      .dash-hero__subtitle {
        font-size: 1rem;
        color: rgba(255,255,255,0.6);
        max-width: 400px;
      }
      .dash-hero__cta {
        margin-top: 1.5rem;
        padding: 12px 28px;
        background: linear-gradient(135deg, #668800, #AAFF00);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 0 20px rgba(170, 255, 0, 0.3);
      }
      .dash-hero__cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 35px rgba(170, 255, 0, 0.5);
      }
      .dash-hero__stats {
        display: flex; flex-direction: column; gap: 1.2rem;
        text-align: right;
      }
      .dash-hero__stat { }
      .dash-hero__stat-value {
        font-size: 2rem;
        font-weight: 800;
        color: #fff;
        line-height: 1.1;
      }
      .dash-hero__stat-label {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.45);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      /* ═══ TOOL CARDS — Cross Formation + ═══ */
      .tools-section { margin-bottom: 2rem; }
      .tools-section__title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 3px;
        color: rgba(255,255,255,0.4);
        margin-bottom: 1.5rem;
      }
      .tools-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        grid-template-rows: auto auto auto;
        grid-template-areas:
          ".     .     top     .      .    "
          "left1 left2 center  right1 right2"
          ".     .     bottom  .      .    ";
        gap: 1rem;
        max-width: 900px;
        margin: 0 auto;
      }
      .tool-card {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        aspect-ratio: 16/10;
        cursor: pointer;
        border: 1px solid rgba(170, 255, 0, 0.15);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .tool-card:hover {
        border-color: rgba(170, 255, 0, 0.6);
        box-shadow: 0 0 30px rgba(170, 255, 0, 0.25), inset 0 0 30px rgba(170, 255, 0, 0.05);
        transform: translateY(-4px) scale(1.02);
      }
      .tool-card__bg {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover;
        opacity: 0.35;
        transition: opacity 0.4s ease;
      }
      .tool-card:hover .tool-card__bg { opacity: 0.55; }
      .tool-card__overlay {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, rgba(15,14,23,0.3) 0%, rgba(15,14,23,0.85) 100%);
        z-index: 1;
      }
      .tool-card__content {
        position: relative; z-index: 2;
        height: 100%;
        display: flex; flex-direction: column;
        justify-content: flex-end;
        padding: 1rem 1.2rem;
      }
      .tool-card__icon {
        font-size: 1.5rem;
        margin-bottom: 0.4rem;
      }
      .tool-card__name {
        font-size: 0.85rem;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.5px;
      }
      .tool-card__desc {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.5);
        margin-top: 2px;
      }
      .tool-card--top    { grid-area: top; }
      .tool-card--left1  { grid-area: left1; }
      .tool-card--left2  { grid-area: left2; }
      .tool-card--center { grid-area: center; }
      .tool-card--right1 { grid-area: right1; }
      .tool-card--right2 { grid-area: right2; }
      .tool-card--bottom { grid-area: bottom; }

      @media (max-width: 768px) {
        .tools-grid {
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: auto;
          grid-template-areas: none;
        }
        .tool-card { grid-area: auto !important; }
        .dash-hero { min-height: 320px; }
        .dash-hero__content { flex-direction: column; align-items: flex-start; }
        .dash-hero__stats { flex-direction: row; gap: 1.5rem; text-align: left; }
      }
      </style>

      <!-- ═══ HERO — Lucas RTX com Vídeo ═══ -->
      <div class="dash-hero fade-in">
        <video class="dash-hero__video" autoplay muted loop playsinline>
          <source src="assets/hero-bg.mp4" type="video/mp4">
        </video>
        <div class="dash-hero__gradient"></div>
        <div class="dash-hero__content">
          <div class="dash-hero__left">
            <div class="dash-hero__badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              ENTERPRISE AUTOMATION SYSTEM
            </div>
            <h1 class="dash-hero__title">LUCAS RTX</h1>
            <p class="dash-hero__subtitle">Automação completa — do código ao CSV final. Configure, arraste, gere links e exporte em um fluxo sem erros.</p>
            <button class="dash-hero__cta" onclick="window.HUB.navigate('autopilot')">▶ Iniciar Autopilot</button>
          </div>
          <div class="dash-hero__stats">
            <div class="dash-hero__stat">
              <div class="dash-hero__stat-value">42</div>
              <div class="dash-hero__stat-label">Prefixos Mapeados</div>
            </div>
            <div class="dash-hero__stat">
              <div class="dash-hero__stat-value">29</div>
              <div class="dash-hero__stat-label">Endpoints Ativos</div>
            </div>
            <div class="dash-hero__stat">
              <div class="dash-hero__stat-value">7</div>
              <div class="dash-hero__stat-label">Módulos</div>
            </div>
            <div class="dash-hero__stat">
              <div class="dash-hero__stat-value" id="stat-tasks-hero">—</div>
              <div class="dash-hero__stat-label">Tarefas Ativas</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 📋 ClickUp Radar — Widget Live -->
      <div class="card card--glow clickup-radar-card fade-in mb-4">
        <div class="clickup-radar__header">
          <div class="clickup-radar__title-group">
            <div class="card__icon clickup-radar__icon">📋</div>
            <div>
              <div class="clickup-radar__title-wrapper">
                <h3 class="card__title clickup-radar__title">Radar de Cadastro — ClickUp</h3>
                <span class="clickup-radar__badge-live">
                  <span class="clickup-radar__pulse"></span>
                  AO VIVO
                </span>
              </div>
              <p class="card__subtitle clickup-radar__subtitle">Acompanhe o que precisa ser cadastrado</p>
            </div>
          </div>
          <a href="https://app.clickup.com/12901270/v/b/f/901317259670" target="_blank" rel="noopener noreferrer" class="btn btn--primary clickup-radar__btn">
            <span>📋 Abrir ClickUp</span>
            <svg class="clickup-radar__arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>

        <div class="clickup-radar__columns" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; align-items: start;">
          <div class="clickup-radar-col" id="col-pending">
            <div class="clickup-pill clickup-pill--todo clickup-pill--priority" style="margin-bottom: 1rem; border-color: #AAFF00; background: rgba(170, 255, 0,0.05);">
              <div class="clickup-pill__content">
                <span class="clickup-pill__dot" style="background: #AAFF00; box-shadow: 0 0 8px #AAFF00;"></span>
                <span class="clickup-pill__name" style="color: #AAFF00;">1. A Fazer</span>
              </div>
              <span class="clickup-pill__tag" style="background: rgba(170, 255, 0,0.1); color: #AAFF00;">Principal</span>
            </div>
            <div class="task-list"></div>
          </div>

          <div class="clickup-radar-col" id="col-in-progress">
            <div class="clickup-pill clickup-pill--in-progress clickup-pill--priority" style="margin-bottom: 1rem; border-color: #88CC00; background: rgba(170, 255, 0,0.05);">
              <div class="clickup-pill__content">
                <span class="clickup-pill__dot" style="background: #88CC00;"></span>
                <span class="clickup-pill__name" style="color: #88CC00;">2. Em Execução</span>
              </div>
            </div>
            <div class="task-list"></div>
          </div>

          <div class="clickup-radar-col" id="col-done">
            <div class="clickup-pill clickup-pill--done" style="margin-bottom: 1rem; border-color: #668800; background: rgba(91,33,182,0.05);">
              <div class="clickup-pill__content">
                <span class="clickup-pill__dot" style="background: #668800;"></span>
                <span class="clickup-pill__name" style="color: #668800;">3. Completo</span>
              </div>
            </div>
            <div class="task-list"></div>
          </div>
        </div>
      </div>

      <!-- Cards de Estatísticas -->
      <div class="grid grid-4 stagger mb-4">
        <div class="card card--glow stat-card">
          <div class="stat-card__icon">📋</div>
          <div class="stat-card__value" id="stat-planilhas">${s.planilhas}</div>
          <div class="stat-card__label">Planilhas Geradas</div>
        </div>
        <div class="card card--glow stat-card">
          <div class="stat-card__icon">📁</div>
          <div class="stat-card__value" id="stat-pastas">${s.pastas}</div>
          <div class="stat-card__label">Pastas Criadas</div>
        </div>
        <div class="card card--glow stat-card">
          <div class="stat-card__icon">🔄</div>
          <div class="stat-card__value" id="stat-fluxos">${s.fluxos}</div>
          <div class="stat-card__label">Fluxos Ativos</div>
        </div>
        <div class="card card--glow stat-card">
          <div class="stat-card__icon">⏱️</div>
          <div class="stat-card__value" id="stat-tempo">${s.tempo}</div>
          <div class="stat-card__label">Tempo Economizado</div>
        </div>
      </div>

      <!-- ═══ TOOL CARDS — Formação + ═══ -->
      <div class="tools-section">
        <div class="tools-section__title">Módulos & Ferramentas</div>
        <div class="tools-grid stagger">

          <div class="tool-card tool-card--top" onclick="window.HUB.navigate('autopilot')">
            <img class="tool-card__bg" src="assets/cards/autopilot.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">🚀</div>
              <div class="tool-card__name">Autopilot</div>
              <div class="tool-card__desc">Automação completa</div>
            </div>
          </div>

          <div class="tool-card tool-card--left1" onclick="window.HUB.navigate('image-crosser')">
            <img class="tool-card__bg" src="assets/cards/crosser.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">🔀</div>
              <div class="tool-card__name">Cruzador</div>
              <div class="tool-card__desc">Match imagem ↔ produto</div>
            </div>
          </div>

          <div class="tool-card tool-card--left2" onclick="window.HUB.navigate('spreadsheet')">
            <img class="tool-card__bg" src="assets/cards/spreadsheet.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">📋</div>
              <div class="tool-card__name">Planilhas</div>
              <div class="tool-card__desc">CSV para Bling & Sankhya</div>
            </div>
          </div>

          <div class="tool-card tool-card--center" onclick="window.HUB.navigate('images')">
            <img class="tool-card__bg" src="assets/cards/upload-cdn.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">☁️</div>
              <div class="tool-card__name">Upload CDN</div>
              <div class="tool-card__desc">Gerenciador de Imagens</div>
            </div>
          </div>

          <div class="tool-card tool-card--right1" onclick="window.HUB.navigate('folders')">
            <img class="tool-card__bg" src="assets/cards/folders.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">📁</div>
              <div class="tool-card__name">Pastas</div>
              <div class="tool-card__desc">Criação em lote</div>
            </div>
          </div>

          <div class="tool-card tool-card--right2" onclick="window.HUB.navigate('flow')">
            <img class="tool-card__bg" src="assets/cards/scanner.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">🔄</div>
              <div class="tool-card__name">Fluxo</div>
              <div class="tool-card__desc">Canvas visual</div>
            </div>
          </div>

          <div class="tool-card tool-card--bottom" onclick="window.HUB.navigate('history')">
            <img class="tool-card__bg" src="assets/cards/history.jpg" alt="" loading="lazy">
            <div class="tool-card__overlay"></div>
            <div class="tool-card__content">
              <div class="tool-card__icon">📜</div>
              <div class="tool-card__name">Histórico</div>
              <div class="tool-card__desc">Log de operações</div>
            </div>
          </div>

        </div>
      </div>

      <!-- Links Externos -->
      <div class="card card--glow fade-in" style="padding: 1.5rem;">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
          <a href="https://app.clickup.com/12901270/v/b/f/901317259670" target="_blank" rel="noopener noreferrer" class="btn btn--primary" style="font-size: 0.8rem;">📋 ClickUp</a>
          <a href="https://brk-bunker.allexadriel.workers.dev/images" target="_blank" rel="noopener noreferrer" class="btn btn--primary" style="font-size: 0.8rem;">🖼️ BRK Bunker CDN</a>
          <a href="https://lucaslima.streamlit.app/" target="_blank" rel="noopener noreferrer" class="btn btn--primary" style="font-size: 0.8rem;">📊 Sankhya Suite</a>
          <a href="https://docs.google.com/spreadsheets/d/1YQx_542qirlutjeNT5SoRlxNgPpVk5Hq/edit?gid=1549727073" target="_blank" rel="noopener noreferrer" class="btn btn--primary" style="font-size: 0.8rem;">📋 Planilha EANs</a>
        </div>
      </div>

      <!-- Autopilot Agent Card -->
      <div id="agent-container"></div>
    `;

    // Autopilot Agent initialization
    const agentContainer = document.getElementById('agent-container');
    if (agentContainer && window.HUB && window.HUB.AutopilotAgent) {
      if (typeof window.HUB.AutopilotAgent.renderAgentCard === 'function') {
        agentContainer.innerHTML = window.HUB.AutopilotAgent.renderAgentCard();
      }
      if (typeof window.HUB.AutopilotAgent.bindAgent === 'function') {
        window.HUB.AutopilotAgent.bindAgent();
      }
    }

    // Cursor glow tracking
    document.querySelectorAll('.card--glow').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
      });
    });

    // 🔴 EVENT SOURCE / SSE for ClickUp Tasks
    function connectSSE() {
      if (window.HUB.radarEventSource) {
        window.HUB.radarEventSource.close();
      }
      window.HUB.radarEventSource = new EventSource('/api/autopilot/stream');
      
      window.HUB.radarEventSource.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data);
          renderRadarTasks(data.tasks || []);
        } catch (err) { console.error('Erro no parse do init SSE', err); }
      });

      window.HUB.radarEventSource.addEventListener('new_task', (e) => {
        try {
          const task = JSON.parse(e.data);
          if (window.HUB.showToast) {
            window.HUB.showToast('🚨 CHEFE TEMOS UMA TAREFA VAMOS TRABALHAR', 'warning');
          }
          addRadarTask(task);
        } catch (err) { console.error('Erro no parse do new_task SSE', err); }
      });

      window.HUB.radarEventSource.onerror = () => {
        console.warn('⚠️ SSE desconectado. Reconectando em 5s...');
        window.HUB.radarEventSource.close();
        window.HUB.radarEventSource = null;
        setTimeout(connectSSE, 5000);
      };
    }

    if (!window.HUB.radarEventSource) {
      connectSSE();
    }

    function renderRadarTasks(tasks) {
      document.querySelectorAll('.clickup-radar-col .task-list').forEach(el => el.innerHTML = '');
      tasks.forEach(task => addRadarTask(task, false));
      initDropZones();
    }

    function addRadarTask(task, prepend = true) {
      let colId = 'col-pending';
      if (task.status === 'in_progress') colId = 'col-in-progress';
      if (task.status === 'done') colId = 'col-done';

      const col = document.querySelector(`#${colId} .task-list`);
      if (!col) return;

      // Remove card existente com mesmo ID (para update)
      const existing = document.querySelector(`[data-task-id="${task.id}"]`);
      if (existing) existing.remove();

      const card = document.createElement('div');
      card.className = 'card card--glow mb-2 fade-in radar-task-card';
      card.setAttribute('data-task-id', task.id);
      card.setAttribute('draggable', 'true');
      card.style.cssText = `
        padding: 12px; display: flex; flex-direction: column; gap: 8px;
        border: 1px solid rgba(170, 255, 0,0.2); background: rgba(11, 15, 25, 0.7);
        cursor: grab; position: relative; transition: all 0.2s ease;
      `;
      
      const codes = task.groups ? Object.values(task.groups).flat() : [];
      const codesHtml = codes.length > 0 
        ? `<div style="font-size: 11px; color: #88CC00; font-family: monospace; font-weight: bold; background: rgba(170, 255, 0,0.1); padding: 4px; border-radius: 4px;">Códigos: ${codes.join(', ')}</div>` 
        : '';
      
      const dateStr = task.timestamp ? new Date(task.timestamp).toLocaleString() : new Date().toLocaleString();
      const priority = task.priority || '';
      const priorityBadge = priority === 'urgent' 
        ? '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,.15);color:#ef4444;font-weight:700">URGENTE</span>'
        : priority === 'high'
        ? '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(251,146,60,.15);color:#fb923c;font-weight:700">ALTA</span>'
        : '';

      card.innerHTML = `
        <button class="radar-task-delete" title="Excluir task" style="
          position: absolute; top: 6px; right: 6px; width: 22px; height: 22px;
          border: none; background: rgba(239,68,68,0.1); color: #ef4444;
          border-radius: 4px; cursor: pointer; font-size: 13px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; opacity: 0.5; z-index: 5;
        ">✕</button>
        <div style="display:flex;align-items:center;gap:6px;padding-right:20px">
          <div style="font-size: 14px; font-weight: 600; color: #fff; line-height: 1.3; flex:1">${window.HUB.esc(task.title)}</div>
          ${priorityBadge}
        </div>
        <div style="font-size: 10px; color: #888;">${dateStr}</div>
        ${codesHtml}
        ${task.url && task.url !== '#' ? `<a href="${task.url}" target="_blank" rel="noopener" style="font-size:10px;color:#AAFF00;text-decoration:none;display:flex;align-items:center;gap:3px">🔗 ClickUp</a>` : ''}
        <button class="radar-task-autopilot btn btn--primary" style="margin-top: 4px; padding: 6px 10px; font-size: 12px; background: linear-gradient(135deg, #668800, #AAFF00); border: none; width: 100%; display: flex; justify-content: center; gap: 6px;">
                <span>🚀</span> Iniciar no Lucas RTX
        </button>
      `;

      // ── Hover effect for delete button ──
      const delBtn = card.querySelector('.radar-task-delete');
      card.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; });
      card.addEventListener('mouseleave', () => { delBtn.style.opacity = '0.5'; });
      
      delBtn.addEventListener('mouseenter', () => {
        delBtn.style.background = 'rgba(239,68,68,0.3)';
        delBtn.style.transform = 'scale(1.1)';
      });
      delBtn.addEventListener('mouseleave', () => {
        delBtn.style.background = 'rgba(239,68,68,0.1)';
        delBtn.style.transform = 'scale(1)';
      });

      // ── Delete handler ──
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (!confirm(`Excluir task "${task.title}"?`)) return;
        delBtn.textContent = '⏳';
        fetch(`/api/autopilot/tasks/${task.id}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              card.style.transform = 'scale(0.9)';
              card.style.opacity = '0';
              setTimeout(() => card.remove(), 300);
              if (window.HUB.showToast) window.HUB.showToast('🗑️ Task excluída', 'info');
            } else {
              delBtn.textContent = '✕';
              if (window.HUB.showToast) window.HUB.showToast('❌ ' + (data.error || 'Erro'), 'error');
            }
          })
          .catch(() => {
            delBtn.textContent = '✕';
            if (window.HUB.showToast) window.HUB.showToast('❌ Servidor offline', 'error');
          });
      };

      // ── Autopilot button handler ──
      const autopilotBtn = card.querySelector('.radar-task-autopilot');
      autopilotBtn.onclick = async () => {
        if (!window.HUB.AutopilotAgent) {
          console.warn('AutopilotAgent não carregado.');
          if (window.HUB.navigate) window.HUB.navigate('autopilot');
          return;
        }

        const taskTitle = task.title || '';
        const taskDesc = task.description || '';
        const taskContent = taskTitle + '\n' + taskDesc;
        let parsed = window.HUB.AutopilotAgent.parseTask(taskContent);
        
        // ── Fallback: usar groups do servidor se o parser não encontrou códigos ──
        if ((!parsed || !parsed.groups.length || parsed.groups.every(g => !g.manualCodes && !g.codeStart)) && task.groups && typeof task.groups === 'object') {
          const serverCodes = [];
          for (const [prefix, codes] of Object.entries(task.groups)) {
            if (Array.isArray(codes)) serverCodes.push(...codes);
          }
          if (serverCodes.length > 0) {
            const syntheticDesc = taskTitle + '\n' + serverCodes.join('\n');
            parsed = window.HUB.AutopilotAgent.parseTask(syntheticDesc);
          }
        }

        if (!parsed || !parsed.groups.length) {
          window.HUB?.showToast('❌ Nenhum código detectado nesta tarefa', 'error');
          return;
        }

        const plan = window.HUB.AutopilotAgent.generatePlan(parsed);

        if (!plan || plan.totalCodes === 0) {
          window.HUB?.showToast('❌ Nenhum código extraído do plano', 'error');
          return;
        }

        // ── Usar o Live Panel para executar com tracking ──
        if (window.HUB.AutopilotLive) {
          window.HUB.AutopilotLive.execute(task, parsed, plan);
        } else {
          // Fallback antigo caso o live panel não esteja carregado
          window.HUB?.showToast('⚠️ Live Panel não carregado, navegando para autopilot...', 'warn');
          window.HUB.AutopilotAgent.launchAutopilot(parsed, plan);
          if (window.HUB.navigate) window.HUB.navigate('autopilot');
        }
      };

      // ── Drag events ──
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        card.style.opacity = '0.5';
        card.style.cursor = 'grabbing';
        // Highlight drop zones
        document.querySelectorAll('.task-list').forEach(tl => {
          tl.style.minHeight = '80px';
          tl.style.border = '2px dashed rgba(170, 255, 0,0.3)';
          tl.style.borderRadius = '8px';
          tl.style.transition = 'all 0.2s';
        });
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
        card.style.cursor = 'grab';
        document.querySelectorAll('.task-list').forEach(tl => {
          tl.style.border = 'none';
          tl.style.minHeight = '';
          tl.style.background = '';
        });
      });

      if (prepend) {
        col.prepend(card);
      } else {
        col.appendChild(card);
      }
    }

    // ── Drop zones for drag-and-drop ──
    function initDropZones() {
      const statusMap = {
        'col-pending': 'pending',
        'col-in-progress': 'in_progress',
        'col-done': 'done'
      };

      document.querySelectorAll('.clickup-radar-col').forEach(colEl => {
        const taskList = colEl.querySelector('.task-list');
        if (!taskList) return;

        // 🔒 Prevent listener accumulation: clone element to remove all old listeners
        if (taskList.dataset.dropBound) {
          const clone = taskList.cloneNode(true);
          taskList.parentNode.replaceChild(clone, taskList);
          // Re-select after replace
          const freshList = colEl.querySelector('.task-list');
          if (!freshList) return;
          bindDropListeners(freshList, colEl, statusMap);
        } else {
          taskList.dataset.dropBound = 'true';
          bindDropListeners(taskList, colEl, statusMap);
        }
      });
    }

    function bindDropListeners(taskList, colEl, statusMap) {
      taskList.dataset.dropBound = 'true';

        taskList.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          taskList.style.background = 'rgba(170, 255, 0,0.08)';
          taskList.style.border = '2px dashed rgba(170, 255, 0,0.6)';
        });

        taskList.addEventListener('dragleave', () => {
          taskList.style.background = '';
          taskList.style.border = '2px dashed rgba(170, 255, 0,0.3)';
        });

        taskList.addEventListener('drop', (e) => {
          e.preventDefault();
          taskList.style.background = '';
          taskList.style.border = 'none';
          
          const taskId = e.dataTransfer.getData('text/plain');
          if (!taskId) return;

          const newStatus = statusMap[colEl.id];
          if (!newStatus) return;

          // Move card visually
          const draggedCard = document.querySelector(`[data-task-id="${taskId}"]`);
          if (draggedCard) {
            draggedCard.style.opacity = '0.5';
            taskList.appendChild(draggedCard);
          }

          // Update on server
          fetch(`/api/autopilot/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              if (draggedCard) draggedCard.style.opacity = '1';
              const statusNames = { pending: 'A Fazer', in_progress: 'Em Execução', done: 'Completo' };
              if (window.HUB.showToast) window.HUB.showToast(`✅ Task movida para "${statusNames[newStatus]}"`, 'success');
            } else {
              if (window.HUB.showToast) window.HUB.showToast('❌ ' + (data.error || 'Erro'), 'error');
            }
          })
          .catch(() => {
            if (window.HUB.showToast) window.HUB.showToast('❌ Servidor offline', 'error');
          });
        });
    }

    // ── SSE listeners for live updates ──
    // 🔒 FIX: Remover listeners antigos para evitar memory leak (TD-007)
    if (window.HUB.radarEventSource) {
      const es = window.HUB.radarEventSource;

      // Remover listeners anteriores se existirem
      if (window.HUB._sseUpdatedHandler) {
        es.removeEventListener('task_updated', window.HUB._sseUpdatedHandler);
      }
      if (window.HUB._sseDeletedHandler) {
        es.removeEventListener('task_deleted', window.HUB._sseDeletedHandler);
      }

      // Criar e registrar novos handlers
      window.HUB._sseUpdatedHandler = (e) => {
        try {
          const task = JSON.parse(e.data);
          addRadarTask(task, true);
        } catch (err) { console.error('Erro SSE task_updated:', err); }
      };

      window.HUB._sseDeletedHandler = (e) => {
        try {
          const { id } = JSON.parse(e.data);
          const card = document.querySelector(`[data-task-id="${id}"]`);
          if (card) {
            card.style.transform = 'scale(0.9)';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
          }
        } catch (err) { console.error('Erro SSE task_deleted:', err); }
      };

      es.addEventListener('task_updated', window.HUB._sseUpdatedHandler);
      es.addEventListener('task_deleted', window.HUB._sseDeletedHandler);
    }
  };
})();

