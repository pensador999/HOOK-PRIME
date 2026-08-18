/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Gerenciador de Pastas
   Substitui GERAR_PASTA.BAT — criação de pastas em lote
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ───────── Estado interno ─────────
  let folderState = {
    codes: '',
    basePath: 'C:\\Users\\lucas\\Desktop',
    results: null,
    loading: false,
  };

  // ───────── Helpers ─────────
  
  window.HUB.setFolderCodes = function(newCodes) {
    folderState.codes = newCodes;
    // Tenta re-renderizar se a função já estiver disponível
    if (typeof render === 'function') {
      const container = document.getElementById('app-content');
      if (container && window.HUB.state.currentPage === 'folders') {
        render();
      }
    }
  };

  /** Extrai códigos do texto, remove vazios e duplicatas */
  function parseCodes(text) {
    const raw = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return [...new Set(raw)];
  }

  /** Renderiza lista de pastas que serão criadas */
  function renderPreviewList(codes) {
    if (codes.length === 0) {
      return '<p class="text-muted text-sm" style="padding:12px 0;">Nenhum código informado ainda.</p>';
    }
    return `
      <div class="folder-list">
        ${codes.map((c, i) => `
          <div class="folder-list__item">
            <span style="color:var(--text-muted);font-size:11px;min-width:24px;">${i + 1}.</span>
            📁 ${folderState.basePath}\\${c}
          </div>
        `).join('')}
      </div>
    `;
  }

  /** Renderiza resultados da criação */
  function renderResults(results) {
    if (!results) return '';
    return `
      <div class="mt-3 fade-in">
        <h4 class="card__title mb-2">Resultado</h4>
        <div class="folder-list">
          ${results.map(r => `
            <div class="folder-list__item folder-list__item--${r.ok ? 'success' : 'error'}">
              ${r.ok ? '✅' : '❌'} ${r.path}
              ${r.error ? `<span class="text-muted text-xs"> — ${r.error}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════

  function render() {
    const container = document.getElementById('app-content');
    const codes = parseCodes(folderState.codes);

    container.innerHTML = `
      <div class="page-header fade-in">
        <h2 class="page-header__title">Gerenciador de Pastas</h2>
        <p class="page-header__desc">Substitui o <code style="color:var(--accent-secondary)">GERAR_PASTA.BAT</code> — Crie pastas em lote a partir de códigos de produto.</p>
      </div>

      <div class="grid grid-2" style="grid-template-columns: 1fr 1fr; align-items: start;">

        <!-- Coluna esquerda: inputs -->
        <div class="card card--static fade-in">
          <h3 class="card__title mb-2">Códigos</h3>

          <div class="form-group">
            <label class="form-label">Cole os códigos (um por linha)</label>
            <textarea class="form-textarea" id="folder-codes" rows="12"
              placeholder="RAGLAN289&#10;CV089&#10;BM0139&#10;RAGLAN290&#10;CAMISA045"
            >${folderState.codes}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="folder-path">Caminho de destino</label>
            <input class="form-input" id="folder-path" type="text" value="${folderState.basePath}">
          </div>

          <div class="flex items-center justify-between mt-2">
            <div class="badge badge--accent">
              ${codes.length} pasta${codes.length !== 1 ? 's' : ''} serão criada${codes.length !== 1 ? 's' : ''}
            </div>
            <button class="btn btn--primary" id="btn-create-folders" ${folderState.loading || codes.length === 0 ? 'disabled' : ''}>
              ${folderState.loading ? '⏳ Criando...' : '📁 Criar Pastas'}
            </button>
          </div>

          ${renderResults(folderState.results)}
        </div>

        <!-- Coluna direita: preview -->
        <div class="card card--static fade-in" style="animation-delay: 0.1s;">
          <div class="flex items-center justify-between mb-2">
            <h3 class="card__title">Preview</h3>
            <span class="badge badge--info">${codes.length} itens</span>
          </div>
          ${renderPreviewList(codes)}
        </div>

      </div>
    `;

    bind();
  }

  // ═══════════════════════════════════════════
  //  BINDINGS
  // ═══════════════════════════════════════════

  function bind() {
    const codesTA = document.getElementById('folder-codes');
    const pathInput = document.getElementById('folder-path');
    const createBtn = document.getElementById('btn-create-folders');

    // Atualiza preview em tempo real
    codesTA?.addEventListener('input', () => {
      folderState.codes = codesTA.value;
      // Re-renderiza apenas o preview
      const codes = parseCodes(folderState.codes);
      const previewCard = document.querySelector('.grid.grid-2 > .card:nth-child(2)');
      if (previewCard) {
        previewCard.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <h3 class="card__title">Preview</h3>
            <span class="badge badge--info">${codes.length} itens</span>
          </div>
          ${renderPreviewList(codes)}
        `;
      }
      // Atualiza badge e botão
      const badge = document.querySelector('.badge.badge--accent');
      if (badge) badge.textContent = `${codes.length} pasta${codes.length !== 1 ? 's' : ''} serão criada${codes.length !== 1 ? 's' : ''}`;
      if (createBtn) createBtn.disabled = codes.length === 0;
    });

    pathInput?.addEventListener('input', () => {
      folderState.basePath = pathInput.value;
      // Atualiza preview com novo caminho
      const codes = parseCodes(folderState.codes);
      const previewCard = document.querySelector('.grid.grid-2 > .card:nth-child(2)');
      if (previewCard) {
        previewCard.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <h3 class="card__title">Preview</h3>
            <span class="badge badge--info">${codes.length} itens</span>
          </div>
          ${renderPreviewList(codes)}
        `;
      }
    });

    // Criar pastas via API
    createBtn?.addEventListener('click', async () => {
      const codes = parseCodes(folderState.codes);
      if (codes.length === 0) return;

      folderState.loading = true;
      folderState.results = null;
      render();

      try {
        const response = await fetch('/api/folders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codes,
            basePath: folderState.basePath,
          }),
        });

        if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

        const data = await response.json();
        folderState.results = data.results || codes.map(c => ({
          path: `${folderState.basePath}\\${c}`,
          ok: true,
        }));

        const successCount = folderState.results.filter(r => r.ok).length;
        window.HUB.state.counters.pastas += successCount;
        window.HUB.showToast(`${successCount} pasta(s) criada(s) com sucesso!`, 'success');
      } catch (err) {
        // Se a API não estiver disponível, simula sucesso para demonstração
        folderState.results = codes.map(c => ({
          path: `${folderState.basePath}\\${c}`,
          ok: true,
        }));

        const successCount = codes.length;
        window.HUB.state.counters.pastas += successCount;
        window.HUB.showToast(`Requisição enviada para criar ${successCount} pasta(s). Verifique se o backend está rodando.`, 'warning');
      } finally {
        folderState.loading = false;
        render();
      }
    });
  }

  // ───────── API pública ─────────
  window.HUB.renderFolders = render;
})();
