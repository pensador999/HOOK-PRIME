/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Histórico de Tarefas & Activity Log
   Registra todas as operações realizadas no HUB com persistência
   em localStorage e timeline visual.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ───────── Constantes ─────────
  const STORAGE_KEY = 'hub_task_history';
  const MAX_ENTRIES = 500;

  // Tipos de tarefa com suas cores e ícones
  const TASK_TYPES = {
    'planilha_bling':   { label: 'Planilha Bling',   color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)',  icon: '📋' },
    'planilha_sankhya': { label: 'Planilha Sankhya', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)',  icon: '📊' },
    'pastas':           { label: 'Pastas',           color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)',   icon: '📁' },
    'sql':              { label: 'SQL',              color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',  icon: '🔍' },
    'imagens':          { label: 'Imagens',          color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)',   icon: '🖼️' },
    'fluxo':            { label: 'Fluxo',            color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)',  icon: '🔄' },
    'outro':            { label: 'Outro',            color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', icon: '⚡' },
  };

  // ───────── Persistência ─────────

  /** Carrega histórico do localStorage */
  function loadHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /** Salva histórico no localStorage */
  function saveHistory(entries) {
    try {
      // Auto-prune: mantém apenas as últimas MAX_ENTRIES
      const trimmed = entries.slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      console.warn('[HUB History] Falha ao salvar no localStorage.');
    }
  }

  // ───────── Formatação de tempo relativo ─────────

  /** Retorna timestamp formatado como tempo relativo */
  function relativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'agora mesmo';
    if (diffMin < 2) return 'há 1 minuto';
    if (diffMin < 60) return `há ${diffMin} minutos`;
    if (diffHour < 2) return 'há 1 hora';
    if (diffHour < 24) return `há ${diffHour} horas`;

    // Ontem
    if (diffDay === 1) {
      return `ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Mais de 1 dia
    if (diffDay < 7) {
      return `há ${diffDay} dias`;
    }

    // Mais de 1 semana — mostra data completa
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /** Retorna timestamp absoluto para tooltip */
  function absoluteTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  // ───────── Helpers ─────────

  /** Gera UUID simples */
  function uuid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  /** Retorna info do tipo de tarefa */
  function getTypeInfo(type) {
    // Mapeia aliases comuns
    const aliases = {
      'bling': 'planilha_bling',
      'sankhya': 'planilha_sankhya',
      'pasta': 'pastas',
      'folder': 'pastas',
      'image': 'imagens',
      'flow': 'fluxo',
    };
    const key = aliases[type] || type;
    return TASK_TYPES[key] || TASK_TYPES['outro'];
  }

  /** Normaliza tipo para chave interna */
  function normalizeType(type) {
    const aliases = {
      'bling': 'planilha_bling',
      'sankhya': 'planilha_sankhya',
      'pasta': 'pastas',
      'folder': 'pastas',
      'image': 'imagens',
      'flow': 'fluxo',
    };
    return aliases[type] || type;
  }

  // ═══════════════════════════════════════════
  //  API GLOBAL: logTask
  // ═══════════════════════════════════════════

  /**
   * Registra uma operação no histórico.
   * Pode ser chamado de qualquer módulo via window.HUB.logTask(...)
   *
   * @param {string} type - Tipo da operação (planilha_bling, planilha_sankhya, pastas, sql, imagens, fluxo, outro)
   * @param {string} description - Descrição curta da operação
   * @param {object} details - Detalhes adicionais (objeto livre)
   */
  window.HUB.logTask = function (type, description, details = {}) {
    const entries = loadHistory();

    const entry = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      type: normalizeType(type),
      description: description,
      details: details,
    };

    entries.push(entry);
    saveHistory(entries);

    // Atualiza contadores no estado global
    if (window.HUB.state) {
      const counters = window.HUB.state.counters || {};
      if (entry.type === 'planilha_bling' || entry.type === 'planilha_sankhya') {
        counters.planilhas = (counters.planilhas || 0) + 1;
      }
      if (entry.type === 'pastas') {
        counters.pastas = (counters.pastas || 0) + 1;
      }
    }
  };

  // ═══════════════════════════════════════════
  //  ESTADO DO FILTRO
  // ═══════════════════════════════════════════

  let filterState = {
    type: 'todos',
    dateFrom: '',
    dateTo: '',
    search: '',
    expandedId: null,  // ID da entrada expandida
  };

  // ═══════════════════════════════════════════
  //  RENDERIZAÇÃO
  // ═══════════════════════════════════════════

  function render() {
    const container = document.getElementById('app-content');
    const allEntries = loadHistory();
    const filtered = applyFilters(allEntries);

    // Estatísticas
    const stats = computeStats(allEntries);

    container.innerHTML = `
      <div class="page-header fade-in">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h2 class="page-header__title">Histórico de Tarefas</h2>
            <p class="page-header__desc">Registro de todas as operações realizadas no HUB</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn--secondary" id="btn-export-log">
              📥 Exportar Log
            </button>
            <button class="btn btn--danger" id="btn-clear-history">
              🗑️ Limpar Histórico
            </button>
          </div>
        </div>
      </div>

      <!-- Cards de Estatísticas -->
      <div class="grid grid-4 stagger mb-4">
        <div class="card stat-card">
          <div class="stat-card__icon">📊</div>
          <div class="stat-card__value">${stats.total}</div>
          <div class="stat-card__label">Total de Operações</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card__icon">📋</div>
          <div class="stat-card__value">${stats.planilhas}</div>
          <div class="stat-card__label">Planilhas Geradas</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card__icon">📁</div>
          <div class="stat-card__value">${stats.pastas}</div>
          <div class="stat-card__label">Pastas Criadas</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card__icon">⏱️</div>
          <div class="stat-card__value hist-last-activity">${stats.lastActivity}</div>
          <div class="stat-card__label">Última Atividade</div>
        </div>
      </div>

      <!-- Barra de Filtros -->
      <div class="card card--static fade-in mb-3">
        <div class="hist-filter-bar">
          <div class="form-group" style="margin-bottom:0; min-width: 160px;">
            <label class="form-label" style="font-size:11px;">Tipo</label>
            <select class="form-select" id="hist-filter-type" style="padding: 8px 12px;">
              <option value="todos" ${filterState.type === 'todos' ? 'selected' : ''}>Todos</option>
              <option value="planilha_bling" ${filterState.type === 'planilha_bling' ? 'selected' : ''}>Planilha Bling</option>
              <option value="planilha_sankhya" ${filterState.type === 'planilha_sankhya' ? 'selected' : ''}>Planilha Sankhya</option>
              <option value="pastas" ${filterState.type === 'pastas' ? 'selected' : ''}>Pastas</option>
              <option value="sql" ${filterState.type === 'sql' ? 'selected' : ''}>SQL</option>
              <option value="imagens" ${filterState.type === 'imagens' ? 'selected' : ''}>Imagens</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0; min-width: 140px;">
            <label class="form-label" style="font-size:11px;">De</label>
            <input class="form-input" id="hist-filter-from" type="date" value="${filterState.dateFrom}"
              style="padding: 8px 12px;">
          </div>

          <div class="form-group" style="margin-bottom:0; min-width: 140px;">
            <label class="form-label" style="font-size:11px;">Até</label>
            <input class="form-input" id="hist-filter-to" type="date" value="${filterState.dateTo}"
              style="padding: 8px 12px;">
          </div>

          <div class="form-group" style="margin-bottom:0; flex: 1; min-width: 200px;">
            <label class="form-label" style="font-size:11px;">Buscar no histórico</label>
            <input class="form-input" id="hist-filter-search" type="text"
              placeholder="Pesquisar por descrição..."
              value="${filterState.search}" style="padding: 8px 12px;">
          </div>
        </div>
      </div>

      <!-- Timeline de Atividades -->
      <div class="card card--static fade-in">
        <div class="flex items-center justify-between mb-2">
          <h3 class="card__title">Atividades</h3>
          <span class="badge badge--info">${filtered.length} registro${filtered.length !== 1 ? 's' : ''}</span>
        </div>

        ${filtered.length === 0 ? `
          <div class="hist-empty">
            <div class="hist-empty__icon">📭</div>
            <p class="hist-empty__text">
              ${allEntries.length === 0
                ? 'Nenhuma atividade registrada ainda. As operações realizadas no HUB aparecerão aqui.'
                : 'Nenhum resultado encontrado para os filtros selecionados.'
              }
            </p>
          </div>
        ` : `
          <div class="hist-timeline" id="hist-timeline">
            ${filtered.reverse().map((entry, idx) => renderTimelineEntry(entry, idx)).join('')}
          </div>
        `}
      </div>

      <!-- Modal de Confirmação (inicialmente oculto) -->
      <div class="hist-modal-overlay hidden" id="hist-modal-overlay">
        <div class="hist-modal">
          <div class="hist-modal__icon">⚠️</div>
          <h3 class="hist-modal__title">Limpar Histórico</h3>
          <p class="hist-modal__text">Tem certeza? Esta ação removerá <strong>todos os registros</strong> do histórico e não pode ser desfeita.</p>
          <div class="hist-modal__actions">
            <button class="btn btn--secondary" id="modal-cancel">Cancelar</button>
            <button class="btn btn--danger" id="modal-confirm">Sim, Limpar Tudo</button>
          </div>
        </div>
      </div>
    `;

    bind();
  }

  /** Renderiza uma entrada da timeline */
  function renderTimelineEntry(entry, idx) {
    const info = getTypeInfo(entry.type);
    const isExpanded = filterState.expandedId === entry.id;
    const detailsJSON = JSON.stringify(entry.details || {}, null, 2);
    const hasDetails = entry.details && Object.keys(entry.details).length > 0;

    return `
      <div class="hist-entry fade-in" style="animation-delay: ${Math.min(idx * 0.03, 0.5)}s;" data-id="${entry.id}">
        <!-- Dot da timeline -->
        <div class="hist-entry__dot" style="background: ${info.color}; box-shadow: 0 0 8px ${info.color}40;"></div>

        <!-- Conteúdo -->
        <div class="hist-entry__content">
          <div class="hist-entry__header">
            <div class="hist-entry__meta">
              <span class="hist-entry__time" title="${absoluteTime(entry.timestamp)}">
                ${relativeTime(entry.timestamp)}
              </span>
              <span class="hist-type-badge" style="background: ${info.bg}; color: ${info.color};">
                ${info.icon} ${info.label}
              </span>
            </div>
            <div class="hist-entry__actions">
              ${hasDetails ? `
                <button class="hist-action-btn hist-toggle-details" data-id="${entry.id}" title="Ver detalhes">
                  ${isExpanded ? '▲' : '▼'}
                </button>
              ` : ''}
              <button class="hist-action-btn hist-copy-details" data-details='${detailsJSON.replace(/'/g, '&#39;')}' title="Copiar detalhes">
                📋
              </button>
              <button class="hist-action-btn hist-delete-entry" data-id="${entry.id}" title="Excluir entrada">
                ✕
              </button>
            </div>
          </div>

          <p class="hist-entry__desc">${window.HUB.esc(entry.description)}</p>

          ${hasDetails && isExpanded ? `
            <div class="hist-entry__details fade-in">
              <pre><code>${detailsJSON}</code></pre>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  //  FILTROS
  // ═══════════════════════════════════════════

  /** Aplica filtros ao array de entradas */
  function applyFilters(entries) {
    return entries.filter(entry => {
      // Filtro por tipo
      if (filterState.type !== 'todos' && entry.type !== filterState.type) {
        return false;
      }

      // Filtro por data (De)
      if (filterState.dateFrom) {
        const from = new Date(filterState.dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(entry.timestamp) < from) return false;
      }

      // Filtro por data (Até)
      if (filterState.dateTo) {
        const to = new Date(filterState.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(entry.timestamp) > to) return false;
      }

      // Filtro por busca textual
      if (filterState.search) {
        const q = filterState.search.toLowerCase();
        const desc = (entry.description || '').toLowerCase();
        const details = JSON.stringify(entry.details || {}).toLowerCase();
        if (!desc.includes(q) && !details.includes(q)) return false;
      }

      return true;
    });
  }

  // ═══════════════════════════════════════════
  //  ESTATÍSTICAS
  // ═══════════════════════════════════════════

  /** Computa estatísticas do histórico */
  function computeStats(entries) {
    const total = entries.length;
    const planilhas = entries.filter(e =>
      e.type === 'planilha_bling' || e.type === 'planilha_sankhya'
    ).length;
    const pastas = entries.filter(e => e.type === 'pastas').length;

    let lastActivity = '—';
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      lastActivity = relativeTime(last.timestamp);
    }

    return { total, planilhas, pastas, lastActivity };
  }

  // ═══════════════════════════════════════════
  //  BINDINGS
  // ═══════════════════════════════════════════

  function bind() {
    // Filtro tipo
    document.getElementById('hist-filter-type')?.addEventListener('change', (e) => {
      filterState.type = e.target.value;
      render();
    });

    // Filtro data de
    document.getElementById('hist-filter-from')?.addEventListener('change', (e) => {
      filterState.dateFrom = e.target.value;
      render();
    });

    // Filtro data até
    document.getElementById('hist-filter-to')?.addEventListener('change', (e) => {
      filterState.dateTo = e.target.value;
      render();
    });

    // Busca textual (debounced)
    const searchInput = document.getElementById('hist-filter-search');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          filterState.search = searchInput.value;
          render();
          // Restaura foco e posição do cursor
          const el = document.getElementById('hist-filter-search');
          if (el) {
            el.focus();
            el.selectionStart = el.selectionEnd = el.value.length;
          }
        }, 300);
      });
    }

    // Toggle detalhes
    document.querySelectorAll('.hist-toggle-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        filterState.expandedId = filterState.expandedId === id ? null : id;
        render();
      });
    });

    // Copiar detalhes
    document.querySelectorAll('.hist-copy-details').forEach(btn => {
      btn.addEventListener('click', async () => {
        const details = btn.dataset.details;
        try {
          await navigator.clipboard.writeText(details);
          window.HUB.showToast?.('Detalhes copiados!', 'success');
        } catch {
          window.HUB.showToast?.('Erro ao copiar.', 'error');
        }
      });
    });

    // Excluir entrada individual
    document.querySelectorAll('.hist-delete-entry').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        let entries = loadHistory();
        entries = entries.filter(e => e.id !== id);
        saveHistory(entries);
        window.HUB.showToast?.('Entrada removida.', 'info');
        render();
      });
    });

    // Exportar log como JSON
    document.getElementById('btn-export-log')?.addEventListener('click', () => {
      const entries = loadHistory();
      if (entries.length === 0) {
        window.HUB.showToast?.('Histórico vazio, nada para exportar.', 'warning');
        return;
      }

      const data = {
        exportedAt: new Date().toISOString(),
        totalEntries: entries.length,
        entries: entries,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hub_historico_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      window.HUB.showToast?.('Log exportado com sucesso!', 'success');
    });

    // Limpar histórico (abre modal de confirmação)
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      const overlay = document.getElementById('hist-modal-overlay');
      if (overlay) overlay.classList.remove('hidden');
    });

    // Modal — Cancelar
    document.getElementById('modal-cancel')?.addEventListener('click', () => {
      const overlay = document.getElementById('hist-modal-overlay');
      if (overlay) overlay.classList.add('hidden');
    });

    // Modal — Confirmar limpeza
    document.getElementById('modal-confirm')?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      const overlay = document.getElementById('hist-modal-overlay');
      if (overlay) overlay.classList.add('hidden');
      window.HUB.showToast?.('Histórico limpo com sucesso!', 'success');
      render();
    });

    // Clique fora do modal para fechar
    document.getElementById('hist-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'hist-modal-overlay') {
        e.target.classList.add('hidden');
      }
    });
  }

  // ═══════════════════════════════════════════
  //  ESTILOS EMBUTIDOS
  // ═══════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById('task-history-styles')) return;

    const style = document.createElement('style');
    style.id = 'task-history-styles';
    style.textContent = `
      /* ── Botão Danger ── */
      .btn--danger {
        background: var(--error);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 500;
        transition: var(--transition-fast);
      }
      .btn--danger:hover { background: #dc2626; transform: translateY(-1px); }

      /* ── Barra de filtros ── */
      .hist-filter-bar {
        display: flex;
        gap: 12px;
        align-items: flex-end;
        flex-wrap: wrap;
      }

      /* ── Estado vazio ── */
      .hist-empty {
        text-align: center;
        padding: 48px 24px;
      }
      .hist-empty__icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
      .hist-empty__text { color: var(--text-muted); font-size: 13px; max-width: 400px; margin: 0 auto; }

      /* ── Timeline ── */
      .hist-timeline {
        position: relative;
        padding-left: 28px;
      }
      .hist-timeline::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: linear-gradient(to bottom, var(--accent-primary) 0%, var(--border-color) 100%);
        border-radius: 1px;
      }

      /* ── Entrada da timeline ── */
      .hist-entry {
        position: relative;
        display: flex;
        gap: 16px;
        padding: 12px 0;
        margin-left: -28px;
      }
      .hist-entry + .hist-entry {
        border-top: 1px solid var(--border-subtle);
      }

      .hist-entry__dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 4px;
        position: relative;
        z-index: 1;
      }

      .hist-entry__content {
        flex: 1;
        min-width: 0;
      }

      .hist-entry__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
        flex-wrap: wrap;
      }

      .hist-entry__meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .hist-entry__time {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
      }

      /* ── Badge de tipo ── */
      .hist-type-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
      }

      .hist-entry__desc {
        font-size: 13px;
        color: var(--text-primary);
        line-height: 1.5;
      }

      /* ── Detalhes expandidos ── */
      .hist-entry__details {
        margin-top: 8px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 12px;
        overflow-x: auto;
      }
      .hist-entry__details pre {
        margin: 0;
        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 11px;
        line-height: 1.6;
        color: var(--text-secondary);
      }

      /* ── Botões de ação ── */
      .hist-entry__actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }

      .hist-action-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 11px;
        transition: var(--transition-fast);
      }
      .hist-action-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--accent-primary);
      }

      /* ── Modal de confirmação ── */
      .hist-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
      }
      .hist-modal-overlay.hidden { display: none; }

      .hist-modal {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 32px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: var(--shadow-lg);
        animation: slideUp 0.25s ease;
      }
      .hist-modal__icon { font-size: 40px; margin-bottom: 12px; }
      .hist-modal__title {
        font-size: 18px;
        font-weight: 700;
        font-family: var(--font-display);
        color: var(--text-primary);
        margin-bottom: 8px;
      }
      .hist-modal__text {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 24px;
        line-height: 1.6;
      }
      .hist-modal__actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }

      /* ── Animações ── */
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* ── Valor de última atividade ── */
      .hist-last-activity {
        font-size: 13px !important;
        -webkit-text-fill-color: var(--text-primary) !important;
      }

      /* ── Utilitário hidden ── */
      .hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  // ───────── API pública ─────────
  window.HUB.renderHistory = function () {
    injectStyles();
    render();
  };
})();
