/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Visualizador de EANs (SOMENTE LEITURA)
   Lê a planilha Google Sheets via CSV e exibe dados na interface.
   NUNCA modifica, escreve ou deleta dados na planilha original.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ───────── URLs da planilha ─────────
  // Proxy local para evitar CORS (busca via server.js)
  const SHEET_CSV_URL = '/api/ean-proxy';
  const SHEET_EDIT_URL =
    'https://docs.google.com/spreadsheets/d/1YQx_542qirlutjeNT5SoRlxNgPpVk5Hq/edit?gid=1549727073';

  // ───────── Estado interno ─────────
  let state = {
    rows: [],           // Todas as linhas parseadas
    loading: false,
    error: null,
    search: '',
    onlyEmpty: false,
    selected: new Set(), // Índices selecionados
    visibleCount: 50,    // Paginação "carregar mais"
    quickQty: 5,         // Quantidade para cópia rápida
  };

  // ───────── Parser CSV simples ─────────
  /** Faz parse de CSV respeitando aspas — retorna array de arrays */
  function parseCSV(text) {
    const rows = [];
    let current = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++; // pula o próximo
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          current.push(cell.trim());
          cell = '';
        } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
          current.push(cell.trim());
          if (current.some(c => c !== '')) rows.push(current);
          current = [];
          cell = '';
          if (ch === '\r') i++; // pula \n
        } else {
          cell += ch;
        }
      }
    }
    // Última linha sem \n
    current.push(cell.trim());
    if (current.some(c => c !== '')) rows.push(current);

    return rows;
  }

  // ───────── Fetch dados da planilha ─────────
  async function fetchData() {
    state.loading = true;
    state.error = null;
    state.selected.clear();
    render();

    try {
      const resp = await fetch(SHEET_CSV_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
      const csv = await resp.text();
      const raw = parseCSV(csv);

      if (raw.length < 2) throw new Error('Planilha vazia ou formato inesperado.');

      // Primeira linha = header; restante = dados
      const header = raw[0];
      state.rows = raw.slice(1).map((cols, i) => ({
        index: i + 1,
        seq: cols[0] || '',
        ean: cols[1] || '',
        code: cols[2] || '',
        _raw: cols,
      }));

      state.visibleCount = 50;
      window.HUB.showToast(`${state.rows.length} EANs carregados com sucesso`, 'success');
    } catch (err) {
      state.error = err.message;
      window.HUB.showToast(`Erro ao carregar EANs: ${err.message}`, 'error');
    } finally {
      state.loading = false;
      render();
    }
  }

  // ───────── Helpers de filtragem ─────────
  function getFilteredRows() {
    let rows = state.rows;

    if (state.onlyEmpty) {
      rows = rows.filter(r => !r.code);
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter(
        r => r.ean.toLowerCase().includes(q) ||
             r.seq.toLowerCase().includes(q) ||
             r.code.toLowerCase().includes(q)
      );
    }

    return rows;
  }

  function countAvailable() {
    return state.rows.filter(r => !r.code).length;
  }

  // ───────── Copiar para clipboard ─────────
  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      window.HUB.showToast(`${label} copiado(s) para a área de transferência`, 'success');
    } catch {
      window.HUB.showToast('Erro ao copiar. Tente novamente.', 'error');
    }
  }

  // ═══════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════

  function render() {
    const container = document.getElementById('app-content');
    const filtered = getFilteredRows();
    const visible = filtered.slice(0, state.visibleCount);
    const available = countAvailable();
    const hasMore = filtered.length > state.visibleCount;
    const selectedCount = state.selected.size;

    container.innerHTML = `
      <!-- Cabeçalho -->
      <div class="page-header fade-in">
        <h2 class="page-header__title">Visualizador de <span class="gradient-text">EANs</span></h2>
        <p class="page-header__desc">Leitura da planilha do Google Docs — <strong>SOMENTE LEITURA</strong></p>
      </div>

      <!-- Banner de aviso SOMENTE LEITURA -->
      <div class="ean-warning-banner fade-in" style="
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.25);
        border-left: 4px solid var(--error);
        border-radius: var(--radius-md);
        padding: 14px 20px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        color: #fca5a5;
        line-height: 1.5;
      ">
        <span style="font-size: 22px; flex-shrink:0;">⚠️</span>
        <span><strong>ATENÇÃO:</strong> Este módulo é <strong>SOMENTE LEITURA</strong>. Nenhuma alteração é feita na planilha. Os EANs devem ser reservados manualmente na planilha original.</span>
      </div>

      <!-- Ações do topo -->
      <div class="flex items-center gap-3 mb-3 fade-in" style="flex-wrap:wrap;">
        <button class="btn btn--primary" id="btn-refresh" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '⏳ Carregando...' : '🔄 Atualizar Dados'}
        </button>
        <a href="${SHEET_EDIT_URL}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary">
          📊 Abrir Planilha Original
        </a>
        ${selectedCount > 0 ? `
          <button class="btn btn--success" id="btn-copy-selected">
            📋 Copiar ${selectedCount} EAN${selectedCount > 1 ? 's' : ''} Selecionado${selectedCount > 1 ? 's' : ''}
          </button>
        ` : ''}
      </div>

      ${state.error ? renderError() : ''}
      ${!state.error && state.rows.length > 0 ? renderContent(filtered, visible, available, hasMore) : ''}
      ${!state.error && state.rows.length === 0 && !state.loading ? renderEmpty() : ''}
    `;

    bind(filtered);
  }

  // ───────── Renderiza conteúdo quando há dados ─────────
  function renderContent(filtered, visible, available, hasMore) {
    return `
      <!-- Barra de busca / filtro -->
      <div class="card card--static fade-in mb-3" style="padding:16px 20px;">
        <div class="flex items-center gap-3" style="flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <input class="form-input" type="text" id="ean-search"
              placeholder="🔍 Buscar por EAN, sequencial ou código..."
              value="${state.search}" style="margin:0;">
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-secondary);white-space:nowrap;user-select:none;">
            <input type="checkbox" id="ean-only-empty" ${state.onlyEmpty ? 'checked' : ''}
              style="accent-color:var(--accent-primary);width:16px;height:16px;cursor:pointer;">
            Mostrar apenas vazios
          </label>
          <div class="flex gap-2" style="flex-wrap:wrap;">
            <span class="badge badge--success">✅ ${available} EANs disponíveis</span>
            <span class="badge badge--info">📋 ${state.rows.length} EANs total</span>
            <span class="badge badge--accent">${filtered.length} exibidos</span>
          </div>
        </div>
      </div>

      <!-- Cópia rápida -->
      <div class="card card--static fade-in mb-3" style="padding:16px 20px;">
        <div class="flex items-center gap-3" style="flex-wrap:wrap;">
          <span style="font-size:13px;color:var(--text-secondary);white-space:nowrap;font-weight:600;">⚡ Cópia Rápida:</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12px;color:var(--text-muted);white-space:nowrap;">Quantidade:</label>
            <input class="form-input" type="number" id="ean-quick-qty" min="1" max="500"
              value="${state.quickQty}" style="width:80px;padding:7px 10px;margin:0;">
          </div>
          <button class="btn btn--primary btn--sm" id="btn-quick-copy">
            📋 Copiar próximos ${state.quickQty} EANs disponíveis
          </button>
        </div>
      </div>

      <!-- Tabela de EANs -->
      <div class="card card--static fade-in" style="padding:0; overflow:hidden;">
        <div class="table-wrapper" style="max-height:560px; overflow-y:auto;">
          <table class="table" id="ean-table">
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">
                  <input type="checkbox" id="ean-select-all" title="Selecionar todos visíveis"
                    style="accent-color:var(--accent-primary);cursor:pointer;width:14px;height:14px;">
                </th>
                <th style="width:50px;">#</th>
                <th>Nº Sequencial</th>
                <th>EAN (13 dígitos)</th>
                <th>Código</th>
                <th style="width:50px; text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${visible.map(row => renderRow(row)).join('')}
            </tbody>
          </table>
        </div>

        ${hasMore ? `
          <div style="padding:16px; text-align:center; border-top:1px solid var(--border-color);">
            <button class="btn btn--secondary" id="btn-load-more">
              Carregar mais (${Math.min(50, filtered.length - state.visibleCount)} de ${filtered.length - state.visibleCount} restantes)
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ───────── Renderiza uma linha da tabela ─────────
  function renderRow(row) {
    const isEmpty = !row.code;
    const isSelected = state.selected.has(row.index);
    const bgStyle = isEmpty
      ? 'background: rgba(170, 255, 0, 0.04);'
      : '';
    const borderLeft = isEmpty
      ? 'border-left: 3px solid rgba(170, 255, 0, 0.3);'
      : 'border-left: 3px solid transparent;';

    return `
      <tr data-idx="${row.index}" class="ean-row ${isEmpty ? 'ean-row--available' : ''}"
          style="${bgStyle}${borderLeft}cursor:${isEmpty ? 'pointer' : 'default'};"
          title="${isEmpty ? 'Clique para copiar este EAN' : 'EAN já atribuído'}">
        <td style="text-align:center;">
          ${isEmpty ? `
            <input type="checkbox" class="ean-cb" data-idx="${row.index}"
              ${isSelected ? 'checked' : ''}
              style="accent-color:var(--accent-primary);cursor:pointer;width:14px;height:14px;">
          ` : '<span style="color:var(--text-muted);">—</span>'}
        </td>
        <td style="color:var(--text-muted);font-size:11px;">${row.index}</td>
        <td style="font-family:'Consolas','Monaco',monospace;font-size:12px;">${row.seq}</td>
        <td style="font-family:'Consolas','Monaco',monospace;font-size:12px;font-weight:600;letter-spacing:0.5px;
            color:${isEmpty ? 'var(--success)' : 'var(--text-primary)'};">
          ${row.ean}
        </td>
        <td style="font-size:12px; color:${isEmpty ? 'var(--text-muted)' : 'var(--accent-secondary)'};">
          ${row.code || '<span style="opacity:0.4">—</span>'}
        </td>
        <td style="text-align:center;">
          ${isEmpty
            ? '<span class="badge badge--success" style="font-size:10px;padding:2px 8px;">Livre</span>'
            : '<span class="badge badge--warning" style="font-size:10px;padding:2px 8px;">Usado</span>'}
        </td>
      </tr>
    `;
  }

  // ───────── Tela de erro ─────────
  function renderError() {
    return `
      <div class="card card--static fade-in" style="text-align:center; padding:48px 24px;">
        <div style="font-size:48px; margin-bottom:16px;">❌</div>
        <h3 class="card__title mb-2">Erro ao carregar dados</h3>
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:20px;">${state.error}</p>
        <button class="btn btn--primary" id="btn-retry">🔄 Tentar Novamente</button>
      </div>
    `;
  }

  // ───────── Tela vazia (sem dados ainda) ─────────
  function renderEmpty() {
    return `
      <div class="card card--static fade-in" style="text-align:center; padding:48px 24px;">
        <div style="font-size:48px; margin-bottom:16px;">📋</div>
        <h3 class="card__title mb-2">Nenhum dado carregado</h3>
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:20px;">
          Clique em "Atualizar Dados" para buscar os EANs da planilha.
        </p>
        <button class="btn btn--primary" id="btn-first-load">🔄 Carregar EANs</button>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  //  BINDINGS
  // ═══════════════════════════════════════════

  function bind(filtered) {
    // Botão atualizar
    document.getElementById('btn-refresh')?.addEventListener('click', fetchData);
    document.getElementById('btn-retry')?.addEventListener('click', fetchData);
    document.getElementById('btn-first-load')?.addEventListener('click', fetchData);

    // Busca
    document.getElementById('ean-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      state.visibleCount = 50;
      render();
    });

    // Toggle vazio
    document.getElementById('ean-only-empty')?.addEventListener('change', (e) => {
      state.onlyEmpty = e.target.checked;
      state.visibleCount = 50;
      render();
    });

    // Carregar mais
    document.getElementById('btn-load-more')?.addEventListener('click', () => {
      state.visibleCount += 50;
      render();
    });

    // Quantidade rápida
    const qtyInput = document.getElementById('ean-quick-qty');
    qtyInput?.addEventListener('input', (e) => {
      state.quickQty = Math.max(1, parseInt(e.target.value) || 1);
    });

    // Cópia rápida
    document.getElementById('btn-quick-copy')?.addEventListener('click', () => {
      const available = state.rows.filter(r => !r.code);
      const qty = Math.min(state.quickQty, available.length);
      if (qty === 0) {
        window.HUB.showToast('Nenhum EAN disponível encontrado.', 'warning');
        return;
      }
      const eans = available.slice(0, qty).map(r => r.ean).join('\n');
      copyToClipboard(eans, `${qty} EAN${qty > 1 ? 's' : ''}`);
    });

    // Copiar selecionados
    document.getElementById('btn-copy-selected')?.addEventListener('click', () => {
      if (state.selected.size === 0) return;
      const eans = state.rows
        .filter(r => state.selected.has(r.index))
        .map(r => r.ean)
        .join('\n');
      copyToClipboard(eans, `${state.selected.size} EAN${state.selected.size > 1 ? 's' : ''}`);
    });

    // Selecionar todos
    document.getElementById('ean-select-all')?.addEventListener('change', (e) => {
      const visible = filtered.slice(0, state.visibleCount);
      const availableVisible = visible.filter(r => !r.code);
      if (e.target.checked) {
        availableVisible.forEach(r => state.selected.add(r.index));
      } else {
        availableVisible.forEach(r => state.selected.delete(r.index));
      }
      render();
    });

    // Checkboxes individuais
    document.querySelectorAll('.ean-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.idx);
        if (e.target.checked) {
          state.selected.add(idx);
        } else {
          state.selected.delete(idx);
        }
        // Atualiza botão de cópia sem re-render completo
        render();
      });
    });

    // Clique na linha para copiar EAN individual
    document.querySelectorAll('.ean-row--available').forEach(tr => {
      tr.addEventListener('click', (e) => {
        // Não copia se clicou no checkbox
        if (e.target.tagName === 'INPUT') return;
        const idx = parseInt(tr.dataset.idx);
        const row = state.rows.find(r => r.index === idx);
        if (row) {
          copyToClipboard(row.ean, 'EAN');
        }
      });
    });
  }

  // ───────── API pública ─────────
  window.HUB.renderEanViewer = function () {
    render();
    // Carrega automaticamente na primeira vez
    if (state.rows.length === 0 && !state.loading && !state.error) {
      fetchData();
    }
  };
})();
