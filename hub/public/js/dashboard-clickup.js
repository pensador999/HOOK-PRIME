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
      </style>
      <!-- Boas-vindas -->
      <div class="welcome fade-in mb-4">
        <h2 class="welcome__title">Bem-vindo ao <span class="gradient-text">HUB</span></h2>
        <p class="welcome__subtitle">Central de Automação Hook Prime — tudo em um só lugar.</p>
      </div>

      <!-- 📋 ClickUp Radar — Widget Hero no Topo -->
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
            <div class="clickup-pill clickup-pill--todo clickup-pill--priority" style="margin-bottom: 1rem; border-color: #41FF0A; background: rgba(65, 255, 10,0.05);">
              <div class="clickup-pill__content">
                <span class="clickup-pill__dot" style="background: #41FF0A; box-shadow: 0 0 8px #41FF0A;"></span>
                <span class="clickup-pill__name" style="color: #41FF0A;">1. A Fazer</span>
              </div>
              <span class="clickup-pill__tag" style="background: rgba(65, 255, 10,0.1); color: #41FF0A;">Principal</span>
            </div>
            <div class="task-list"></div>
          </div>

          <div class="clickup-radar-col" id="col-in-progress">
            <div class="clickup-pill clickup-pill--in-progress clickup-pill--priority" style="margin-bottom: 1rem; border-color: #6CFF42; background: rgba(65,255,10,0.05);">
              <div class="clickup-pill__content">
                <span class="clickup-pill__dot" style="background: #6CFF42;"></span>
                <span class="clickup-pill__name" style="color: #6CFF42;">2. Em Execução</span>
              </div>
            </div>
            <div class="task-list"></div>
          </div>

          <div class="clickup-radar-col" id="col-done">
            <div class="clickup-pill clickup-pill--done" style="margin-bottom: 1rem; border-color: #32CC08; background: rgba(8,158,154,0.05);">
              <div class="clickup-pill__content">
                <span class="clickup-pill__dot" style="background: #32CC08;"></span>
                <span class="clickup-pill__name" style="color: #32CC08;">3. Completo</span>
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

      <!-- 🚀 Autopilot — Card Destaque -->
      <div class="card card--glow module-card module-card--hero fade-in mb-4">
        <div>
          <div class="card__header">
            <div class="card__icon card__icon--green">🚀</div>
            <div>
              <div class="card__title">Lucas RTX</div>
              <div class="card__subtitle">Automação completa — do código ao CSV final</div>
            </div>
          </div>
          <p class="module-card__desc">
            Configure range de códigos, arraste pastas com imagens, gere links e exporte planilhas — tudo em um fluxo automatizado sem erros.
          </p>
        </div>
        <button class="btn btn--primary" onclick="window.HUB.navigate('autopilot')">
          ▶ Iniciar Lucas RTX
        </button>
      </div>

      <!-- Cards de Módulos -->
      <h3 class="font-semibold text-secondary mb-2 uppercase tracking-wide text-sm">Módulos</h3>
      <div class="grid grid-3 stagger mb-4">

        <!-- 🔀 Cruzador de Imagens -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(168,85,247,0.12);">🔀</div>
              <div>
                <div class="card__title">Cruzador de Imagens</div>
                <div class="card__subtitle">Match automático imagem ↔ produto</div>
              </div>
            </div>
            <p class="module-card__desc">
              Cruze pastas de imagens com códigos da planilha Bling usando algoritmo de similaridade. Upload e exportação integrados.
            </p>
          </div>
          <button class="btn btn--primary" onclick="window.HUB.navigate('image-crosser')">🔀 Abrir Cruzador</button>
        </div>

        <!-- 📋 Gerador de Planilhas -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(34,197,94,0.12);">📋</div>
              <div>
                <div class="card__title">Gerador de Planilhas</div>
                <div class="card__subtitle">CSV para Bling & Sankhya</div>
              </div>
            </div>
            <p class="module-card__desc">
              Crie planilhas CSV para cadastro de produtos com preenchimento inteligente de variações, EANs e imagens.
            </p>
          </div>
          <button class="btn btn--primary" onclick="window.HUB.navigate('spreadsheet')">📋 Abrir Gerador</button>
        </div>

        <!-- 📁 Gerenciador de Pastas -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(59,130,246,0.12);">📁</div>
              <div>
                <div class="card__title">Gerenciador de Pastas</div>
                <div class="card__subtitle">Criação em lote</div>
              </div>
            </div>
            <p class="module-card__desc">
              Crie pastas em lote a partir de códigos de produto. Interface visual para organizar estruturas de arquivos.
            </p>
          </div>
          <button class="btn btn--primary" onclick="window.HUB.navigate('folders')">📁 Abrir Gerenciador</button>
        </div>

        <!-- 🖼️ Gerenciador de Imagens -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(6,182,212,0.12);">🖼️</div>
              <div>
                <div class="card__title">Gerenciador de Imagens</div>
                <div class="card__subtitle">Renomear MASC/FEM/INF</div>
              </div>
            </div>
            <p class="module-card__desc">
              Renomeie e organize fotos de produtos automaticamente. Integra com o Gerador de Links.
            </p>
          </div>
          <button class="btn btn--primary" onclick="window.HUB.navigate('images')">🖼️ Abrir Gerenciador</button>
        </div>

        <!-- 🔄 Fluxo de Trabalho -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(139,92,246,0.12);">🔄</div>
              <div>
                <div class="card__title">Fluxo de Trabalho</div>
                <div class="card__subtitle">Canvas Visual</div>
              </div>
            </div>
            <p class="module-card__desc">
              Visualize e gerencie processos de cadastro no canvas visual interativo com nós arrastáveis.
            </p>
          </div>
          <button class="btn btn--primary" onclick="window.HUB.navigate('flow')">🔄 Abrir Canvas</button>
        </div>

        <!-- 📜 Histórico de Tarefas -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(244,63,94,0.12);">📜</div>
              <div>
                <div class="card__title">Histórico de Tarefas</div>
                <div class="card__subtitle">Log de operações</div>
              </div>
            </div>
            <p class="module-card__desc">
              Acompanhe todas as operações realizadas no HUB com timeline visual e filtros avançados.
            </p>
          </div>
          <button class="btn btn--primary" onclick="window.HUB.navigate('history')">📜 Abrir Histórico</button>
        </div>

        <!-- 🔗 Ferramentas Externas -->
        <div class="card card--glow module-card">
          <div>
            <div class="card__header">
              <div class="card__icon" style="background:rgba(6,182,212,0.12);">🔗</div>
              <div>
                <div class="card__title">Ferramentas Externas</div>
                <div class="card__subtitle">Links rápidos</div>
              </div>
            </div>
            <ul class="module-card__links">
              <li><a href="https://app.clickup.com/12901270/v/b/f/901317259670" target="_blank" rel="noopener noreferrer">📋 Radar ClickUp</a></li>
              <li><a href="https://brk-bunker.allexadriel.workers.dev/images" target="_blank" rel="noopener noreferrer">🖼️ BRK Bunker (CDN)</a></li>
              <li><a href="https://lucaslima.streamlit.app/" target="_blank" rel="noopener noreferrer">📊 Sankhya Suite</a></li>
              <li><a href="https://docs.google.com/spreadsheets/d/1YQx_542qirlutjeNT5SoRlxNgPpVk5Hq/edit?gid=1549727073" target="_blank" rel="noopener noreferrer">📋 Planilha de EANs</a></li>
            </ul>
          </div>
          <button class="btn btn--primary" onclick="window.open('https://app.clickup.com/12901270/v/b/f/901317259670', '_blank')">🔗 Abrir Links ↗</button>
        </div>

      </div>
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
          } else {
            alert('🚨 CHEFE TEMOS UMA TAREFA VAMOS TRABALHAR');
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
        border: 1px solid rgba(65, 255, 10,0.2); background: rgba(11, 15, 25, 0.7);
        cursor: grab; position: relative; transition: all 0.2s ease;
      `;
      
      const codes = task.groups ? Object.values(task.groups).flat() : [];
      const codesHtml = codes.length > 0 
        ? `<div style="font-size: 11px; color: #6CFF42; font-family: monospace; font-weight: bold; background: rgba(65,255,10,0.1); padding: 4px; border-radius: 4px;">Códigos: ${codes.join(', ')}</div>` 
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
          <div style="font-size: 14px; font-weight: 600; color: #fff; line-height: 1.3; flex:1">${task.title}</div>
          ${priorityBadge}
        </div>
        <div style="font-size: 10px; color: #888;">${dateStr}</div>
        ${codesHtml}
        ${task.url && task.url !== '#' ? `<a href="${task.url}" target="_blank" rel="noopener" style="font-size:10px;color:#41FF0A;text-decoration:none;display:flex;align-items:center;gap:3px">🔗 ClickUp</a>` : ''}
        <button class="radar-task-autopilot btn btn--primary" style="margin-top: 4px; padding: 6px 10px; font-size: 12px; background: linear-gradient(135deg, #32CC08, #41FF0A); border: none; width: 100%; display: flex; justify-content: center; gap: 6px;">
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
          tl.style.border = '2px dashed rgba(65,255,10,0.3)';
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

        taskList.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          taskList.style.background = 'rgba(65,255,10,0.08)';
          taskList.style.border = '2px dashed rgba(65,255,10,0.6)';
        });

        taskList.addEventListener('dragleave', () => {
          taskList.style.background = '';
          taskList.style.border = '2px dashed rgba(65,255,10,0.3)';
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
      });
    }

    // ── SSE listeners for live updates ──
    if (window.HUB.radarEventSource) {
      window.HUB.radarEventSource.addEventListener('task_updated', (e) => {
        try {
          const task = JSON.parse(e.data);
          addRadarTask(task, true);
        } catch (err) { console.error('Erro SSE task_updated:', err); }
      });

      window.HUB.radarEventSource.addEventListener('task_deleted', (e) => {
        try {
          const { id } = JSON.parse(e.data);
          const card = document.querySelector(`[data-task-id="${id}"]`);
          if (card) {
            card.style.transform = 'scale(0.9)';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
          }
        } catch (err) { console.error('Erro SSE task_deleted:', err); }
      });
    }
  };
})();

