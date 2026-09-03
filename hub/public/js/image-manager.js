/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Gerenciador de Imagens
   Renomeia e organiza fotos de produtos com preview em grid,
   drag & drop para reordenação e integração com URLs de imagens.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ───────── Constantes ─────────
  const GENDER_CODES = {
    Masculino: 'MASC',
    Feminino: 'FEM',
    Infantil: 'INF',
  };

  const LINK_GENERATOR_URL = 'https://brk-link-vz77.vercel.app/';

  // ───────── Estado interno ─────────
  let state = {
    files: [],         // { id, file, dataUrl, originalName }
    gender: 'Masculino',
    prefix: '',        // Prefixo personalizado (vazio = usa gênero)
    startNum: 1,
    uploading: false,
    renameMode: 'numeric', // 'numeric' = 1.jpg, 2.jpg (BRK Link) | 'gender' = 01MASC.jpg
    // Seção de URLs
    urlsMasc: '',
    urlsFem: '',
    urlsInf: '',
    // Drag & drop para reordenação
    dragIdx: null,
    // Tabs e Batch
    activeTab: 'rename', // 'rename' | 'batch' | 'urls'
    batchPath: '',
    batchBlocks: [], // [{code, gender, color, images, path, status, urls}]
    batchScanning: false,
    batchUploading: false,
  };

  let idCounter = 0;

  // ───────── Helpers ─────────

  /** Retorna o prefixo efetivo (personalizado ou código do gênero) */
  function getPrefix() {
    return state.prefix.trim() || GENDER_CODES[state.gender];
  }

  /** Gera o novo nome do arquivo com base na posição */
  function getNewName(index) {
    if (state.renameMode === 'numeric') {
      return `${state.startNum + index}.jpg`;
    }
    const num = (state.startNum + index).toString().padStart(2, '0');
    return `${num}${getPrefix()}.jpg`;
  }

  /** Gera preview do padrão de nomes */
  function getPatternPreview() {
    if (state.renameMode === 'numeric') {
      const start = state.startNum;
      return [0, 1, 2].map(i => `${start + i}.jpg`).join(', ') + '...';
    }
    const prefix = getPrefix();
    const start = state.startNum;
    return [0, 1, 2].map(i => {
      const num = (start + i).toString().padStart(2, '0');
      return `${num}${prefix}.jpg`;
    }).join(', ') + '...';
  }

  /**
   * Auto-ordena imagens seguindo o padrão BRK:
   * FRENTE → COSTAS → FRENTE PERSPEC → COSTAS PERSPEC → extras (ZOOM, DETALHE, etc.)
   * Se os arquivos já são numéricos (1.jpg, 2.jpg), mantém a ordem numérica.
   * Baseado na análise dos 9 padrões de referência (PADRÃO1~7 + Capturas).
   */
  function smartSortImages(files) {
    // Se todos os arquivos já são numéricos (1.jpg, 2.jpg...), manter ordem numérica
    const allNumeric = files.every(f => {
      const name = (f.originalName || f.name || '').replace(/\.[^.]+$/, '');
      return /^\d+$/.test(name.trim());
    });
    if (allNumeric) {
      return files.sort((a, b) => {
        const numA = parseInt((a.originalName || a.name).replace(/\.[^.]+$/, ''));
        const numB = parseInt((b.originalName || b.name).replace(/\.[^.]+$/, ''));
        return numA - numB;
      });
    }

    // Usa módulo compartilhado (core/image-priority.js)
    const getPriority = window.HUB.getImagePriority;

    return files.sort((a, b) => {
      const nameA = a.originalName || a.name || '';
      const nameB = b.originalName || b.name || '';
      const prioA = getPriority(nameA);
      const prioB = getPriority(nameB);

      // Se mesma prioridade, desempata por nome alfabético
      if (prioA !== prioB) return prioA - prioB;
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
  }

  /** Lê arquivo como Data URL para preview */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Processa arquivos selecionados */
  async function processFiles(fileList) {
    const newFiles = [];
    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await readFileAsDataURL(file);
        newFiles.push({
          id: ++idCounter,
          file,
          dataUrl,
          originalName: file.name,
        });
      } catch {
        // Ignora arquivos com erro de leitura
      }
    }

    // Auto-ordena: FRENTE → COSTAS → PERSPEC → extras
    smartSortImages(newFiles);

    state.files.push(...newFiles);
    render();
    if (newFiles.length > 0) {
      const wasReordered = newFiles.some((f, i) => {
        const origIdx = Array.from(fileList).findIndex(fl => fl.name === f.originalName);
        return origIdx !== i;
      });
      const msg = wasReordered
        ? `${newFiles.length} imagem(ns) adicionada(s) e auto-ordenada(s) 🔄`
        : `${newFiles.length} imagem(ns) adicionada(s)`;
      window.HUB.showToast(msg, 'success');
    }
  }

  /** Baixa um arquivo renomeado */
  function downloadRenamed(fileObj, newName) {
    const a = document.createElement('a');
    a.href = fileObj.dataUrl;
    a.download = newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ═══════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════

  function render() {
    const container = document.getElementById('app-content');

    container.innerHTML = `
      <!-- Cabeçalho -->
      <div class="page-header fade-in">
        <h2 class="page-header__title">Gerenciador de <span class="gradient-text">Imagens</span></h2>
        <p class="page-header__desc">Renomeie e organize fotos de produtos automaticamente</p>
      </div>

      <!-- Ações do topo -->
      <div class="flex items-center gap-3 mb-3 fade-in" style="flex-wrap:wrap;">
        <a href="${LINK_GENERATOR_URL}" target="_blank" rel="noopener noreferrer" class="btn btn--primary" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;">
          🔗 Abrir BRK Link
        </a>
        <button class="btn btn--secondary" id="btn-scroll-cdn" style="display:inline-flex;align-items:center;gap:6px;">
          ☁️ Ir para Upload CDN
        </button>
        ${state.files.length > 0 ? `
          <button class="btn btn--ghost" id="btn-clear-all" style="color:var(--error);">
            🗑️ Limpar tudo
          </button>
        ` : ''}
      </div>

      <!-- Tab bar -->
      <div class="fade-in" style="display:flex;gap:0;border-bottom:2px solid var(--border-color);margin-bottom:24px;">
        <button class="img-tab ${state.activeTab === 'rename' ? 'img-tab--active' : ''}" data-tab="rename"
          style="padding:12px 24px;font-size:14px;font-weight:600;color:${state.activeTab === 'rename' ? 'var(--accent)' : 'var(--text-muted)'};background:none;border:none;border-bottom:${state.activeTab === 'rename' ? '2px solid var(--accent)' : '2px solid transparent'};margin-bottom:-2px;cursor:pointer;transition:var(--transition);">
          📷 Renomear
        </button>
        <button class="img-tab ${state.activeTab === 'batch' ? 'img-tab--active' : ''}" data-tab="batch"
          style="padding:12px 24px;font-size:14px;font-weight:600;color:${state.activeTab === 'batch' ? 'var(--accent)' : 'var(--text-muted)'};background:none;border:none;border-bottom:${state.activeTab === 'batch' ? '2px solid var(--accent)' : '2px solid transparent'};margin-bottom:-2px;cursor:pointer;transition:var(--transition);">
          🚀 Upload em Massa
        </button>
        <button class="img-tab ${state.activeTab === 'urls' ? 'img-tab--active' : ''}" data-tab="urls"
          style="padding:12px 24px;font-size:14px;font-weight:600;color:${state.activeTab === 'urls' ? 'var(--accent)' : 'var(--text-muted)'};background:none;border:none;border-bottom:${state.activeTab === 'urls' ? '2px solid var(--accent)' : '2px solid transparent'};margin-bottom:-2px;cursor:pointer;transition:var(--transition);">
          🔗 URLs
        </button>
      </div>

      ${state.activeTab === 'rename' ? `
      <div class="grid grid-2 fade-in" style="grid-template-columns: 1fr 1fr; align-items: start;">

        <!-- Coluna esquerda: Upload + Configuração -->
        <div style="display:flex;flex-direction:column;gap:20px;">

          <!-- Zona de upload -->
          <div class="card card--static">
            <h3 class="card__title mb-2">📤 Upload de Imagens</h3>
            <div id="img-dropzone" class="dropzone">
              <div class="dropzone__icon">🖼️</div>
              <p class="dropzone__text">
                Arraste as imagens aqui ou clique para selecionar
              </p>
              <p class="dropzone__hint">
                Formatos aceitos: JPG, PNG, WEBP
              </p>
              ${state.files.length > 0 ? `
                <div class="badge badge--accent" style="margin-top:12px;">
                  ${state.files.length} arquivo${state.files.length > 1 ? 's' : ''} selecionado${state.files.length > 1 ? 's' : ''}
                </div>
              ` : ''}
            </div>
            <input type="file" id="img-file-input" accept="image/*" multiple
              style="display:none;">
          </div>

          <!-- Configuração de renomeação -->
          <div class="card card--static">
            <h3 class="card__title mb-2">⚙️ Configuração de Renomeação</h3>

            <!-- Modo de Renomeação -->
            <div class="form-group">
              <label class="form-label">Modo de Renomeação</label>
              <div class="flex gap-2" style="flex-wrap:wrap;">
                <label class="checkbox-pill ${state.renameMode === 'numeric' ? 'checked' : ''}" data-rename-mode="numeric" style="cursor:pointer;">
                  <input type="radio" name="rename-mode" value="numeric" ${state.renameMode === 'numeric' ? 'checked' : ''} style="display:none;">
                  <span class="checkbox-pill__indicator"></span>
                  🔢 Modo Genérico (1.jpg, 2.jpg)
                </label>
                <label class="checkbox-pill ${state.renameMode === 'gender' ? 'checked' : ''}" data-rename-mode="gender" style="cursor:pointer;">
                  <input type="radio" name="rename-mode" value="gender" ${state.renameMode === 'gender' ? 'checked' : ''} style="display:none;">
                  <span class="checkbox-pill__indicator"></span>
                  🏷️ Modo com Gêneros (01MASC.jpg)
                </label>
              </div>
            </div>

            ${state.renameMode === 'gender' ? `
            <div class="form-group">
              <label class="form-label">Gênero</label>
              <div class="flex gap-2" style="flex-wrap:wrap;">
                ${Object.entries(GENDER_CODES).map(([label, code]) => `
                  <label class="checkbox-pill ${state.gender === label ? 'checked' : ''}"
                    data-gender="${label}" style="cursor:pointer;">
                    <input type="radio" name="img-gender" value="${label}"
                      ${state.gender === label ? 'checked' : ''} style="display:none;">
                    <span class="checkbox-pill__indicator"></span>
                    ${label} (${code})
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="img-prefix">Prefixo personalizado (opcional)</label>
              <input class="form-input" type="text" id="img-prefix"
                placeholder="Ex: RAGLAN, CAMISETA... (vazio = usa código do gênero)"
                value="${state.prefix}">
            </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label" for="img-start-num">Iniciar numeração em</label>
              <input class="form-input" type="number" id="img-start-num" min="1" max="999"
                value="${state.startNum}" style="width:120px;">
            </div>

            <!-- Preview do padrão -->
            <div style="
              background: var(--bg-input);
              border: 1px solid var(--border-color);
              border-radius: var(--radius-sm);
              padding: 12px 16px;
              font-family: 'Consolas','Monaco',monospace;
              font-size: 12px;
              color: var(--accent-secondary);
              letter-spacing: 0.3px;
            ">
              <span style="color:var(--text-muted); font-family:var(--font-sans);font-size:11px;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:6px;font-weight:600;">
                Preview do padrão:
              </span>
              ${getPatternPreview()}
            </div>

            ${state.renameMode === 'numeric' ? `
            <div style="margin-top:12px;padding:10px 14px;background:rgba(132,204,22,0.06);border:1px solid rgba(132,204,22,0.15);border-radius:var(--radius-sm);font-size:12px;color:var(--accent);">
              💡 <strong>Dica:</strong> Use este modo com o <a href="${LINK_GENERATOR_URL}" target="_blank" style="color:var(--accent);text-decoration:underline;">BRK Link</a>. Organize as imagens na ordem desejada, depois renomeie e envie.
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Coluna direita: Preview Grid + Ações -->
        <div style="display:flex;flex-direction:column;gap:20px;">

          ${state.files.length > 0 ? renderPreviewGrid() : renderEmptyPreview()}

          <!-- Ações de renomeação -->
          ${state.files.length > 0 ? `
            <div class="card card--static">
              <h3 class="card__title mb-2">🚀 Ações</h3>
              <div class="flex gap-2" style="flex-wrap:wrap;">
                <button class="btn btn--primary" id="btn-rename-download">
                  ✏️ Renomear e Baixar
                </button>
                <button class="btn btn--secondary" id="btn-upload-server">
                  📁 Enviar para Servidor
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${state.activeTab === 'batch' ? `
      <div class="card card--static fade-in">
        <h3 class="card__title mb-2">🚀 Upload em Massa para CDN</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
          Aponte para a pasta de uploads do Autopilot e envie todas as imagens organizadas de uma vez.
        </p>
        
        <!-- Path input -->
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
          <input class="form-input" type="text" id="batch-folder-path" 
            placeholder="Ex: C:\\Users\\lucas\\...\\uploads\\autopilot\\TASK_ID" 
            value="${state.batchPath}"
            style="flex:1;font-family:monospace;font-size:12px;">
          <button class="btn btn--primary" id="batch-scan-btn" ${state.batchScanning ? 'disabled' : ''}>
            ${state.batchScanning ? '⏳ Escaneando...' : '🔍 Escanear'}
          </button>
        </div>
        
        <!-- Results table (if blocks found) -->
        ${state.batchBlocks.length > 0 ? renderBatchTable() : ''}
      </div>
      ` : ''}

      ${state.activeTab === 'urls' ? `
      <!-- Seção de integração com URLs (embaixo) -->
      <div class="card card--static fade-in">
        <h3 class="card__title mb-2">🔗 Integração de URLs</h3>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
          Após enviar as imagens para o site, cole as URLs geradas abaixo. As URLs serão formatadas com <code style="color:var(--accent-secondary);">|</code> (pipe) para colar diretamente na planilha Bling.
        </p>

        <div class="grid grid-3" style="grid-template-columns:repeat(3,1fr);">
          <div class="form-group" style="margin:0;">
            <label class="form-label">URLs Masculino</label>
            <textarea class="form-textarea" id="urls-masc" rows="5"
              placeholder="Cole as URLs masculinas aqui, uma por linha...">${state.urlsMasc}</textarea>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">URLs Feminino</label>
            <textarea class="form-textarea" id="urls-fem" rows="5"
              placeholder="Cole as URLs femininas aqui, uma por linha...">${state.urlsFem}</textarea>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">URLs Infantil</label>
            <textarea class="form-textarea" id="urls-inf" rows="5"
              placeholder="Cole as URLs infantis aqui, uma por linha...">${state.urlsInf}</textarea>
          </div>
        </div>

        <!-- Preview de URLs formatados -->
        ${renderUrlPreview()}

        <div class="flex gap-2 mt-2" style="flex-wrap:wrap;">
          <button class="btn btn--primary btn--sm" id="btn-copy-urls">
            📋 Copiar URLs formatados
          </button>
          <button class="btn btn--secondary btn--sm" id="btn-send-to-spreadsheet">
            ➡️ Enviar para Gerador de Planilhas
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════ -->
      <!--  SEÇÃO: Upload CDN (BRK Link) -->
      <!-- ══════════════════════════════════════ -->
      <div class="card card--static fade-in mt-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="card__title">☁️ Upload CDN — BRK Link</h3>
          <span id="cdn-health-badge" class="badge" style="font-size:11px;padding:4px 10px;">⏳ Verificando...</span>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5;">
          Envie imagens diretamente para o BRK Link (Cloudflare R2 CDN). Ideal para tarefas isoladas — sem depender do Autopilot.
        </p>

        <!-- Modo Pasta: colar caminho -->
        <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:10px;">📂 Upload por Pasta (do disco)</div>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
            <input class="form-input" type="text" id="cdn-folder-path" placeholder="Ex: C:\\Users\\lucas\\...\\APC FULL\\APC0548" style="flex:1;font-family:monospace;font-size:12px;">
            <button class="btn btn--primary btn--sm" id="cdn-upload-folder" style="white-space:nowrap;">
              🚀 Enviar Pasta
            </button>
          </div>
          <div id="cdn-folder-status" style="font-size:12px;color:var(--text-muted);"></div>
        </div>

        <!-- Modo Drag & Drop: arrastar arquivos individuais -->
        <div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:10px;">🖼️ Upload por Arquivo (drag & drop)</div>
          <div id="cdn-dropzone" style="
            border: 2px dashed var(--border-color);
            border-radius: var(--radius-md);
            padding: 30px 20px;
            text-align: center;
            cursor: pointer;
            transition: var(--transition);
          ">
            <div style="font-size:32px;margin-bottom:8px;opacity:0.5;">📤</div>
            <p style="font-size:13px;color:var(--text-secondary);">Arraste imagens aqui ou clique para selecionar</p>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">JPG, PNG, WEBP — Cada imagem será enviada ao BRK Link CDN</p>
          </div>
          <input type="file" id="cdn-file-input" accept="image/*" multiple style="display:none;">
        </div>

        <!-- Progresso de upload -->
        <div id="cdn-upload-progress" style="display:none;background:rgba(132,204,22,0.05);border:1px solid rgba(132,204,22,0.15);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span id="cdn-progress-text" style="font-size:13px;font-weight:600;color:var(--accent);">Enviando...</span>
            <span id="cdn-progress-pct" style="font-size:13px;font-weight:700;color:var(--accent);">0%</span>
          </div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;">
            <div id="cdn-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,var(--lime-dark,#65a30d),var(--accent));border-radius:3px;transition:width .3s ease;"></div>
          </div>
        </div>

        <!-- Resultados: URLs geradas -->
        <div id="cdn-results" style="display:none;">
          <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:10px;">✅ Imagens Enviadas</div>
          <div id="cdn-results-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:12px;max-height:400px;overflow-y:auto;"></div>
          <div class="flex gap-2" style="flex-wrap:wrap;">
            <button class="btn btn--primary btn--sm" id="cdn-copy-all">📋 Copiar Todas as URLs</button>
            <button class="btn btn--secondary btn--sm" id="cdn-copy-pipe">📋 Copiar URLs (pipe-joined)</button>
            <button class="btn btn--ghost btn--sm" id="cdn-clear" style="color:var(--error);">🗑️ Limpar Resultados</button>
          </div>
        </div>
      </div>
      ` : ''}
    `;

    bind();
  }

  function renderBatchTable() {
    const totalImgs = state.batchBlocks.reduce((s, b) => s + b.images, 0);
    const doneCount = state.batchBlocks.filter(b => b.status === 'done').length;
    const progress = state.batchBlocks.length > 0 ? Math.round((doneCount / state.batchBlocks.length) * 100) : 0;
    
    return `
      <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:13px;color:var(--text-secondary);">
          📊 <strong>${state.batchBlocks.length}</strong> blocos · <strong>${totalImgs}</strong> imagens
        </div>
        <button class="btn btn--primary" id="batch-upload-all" ${state.batchUploading ? 'disabled' : ''}>
          ${state.batchUploading ? '⏳ Enviando...' : '🚀 Enviar Tudo para CDN'}
        </button>
      </div>
      
      ${state.batchUploading || doneCount > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span style="color:var(--text-muted);">${doneCount}/${state.batchBlocks.length} blocos</span>
            <span style="color:var(--accent);font-weight:700;">${progress}%</span>
          </div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;">
            <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,var(--lime-dark,#65a30d),var(--accent));border-radius:3px;transition:width .3s ease;"></div>
          </div>
        </div>
      ` : ''}
      
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color);">
              <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Código</th>
              <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Gênero</th>
              <th style="padding:10px 12px;text-align:left;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Cor</th>
              <th style="padding:10px 12px;text-align:center;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Imgs</th>
              <th style="padding:10px 12px;text-align:center;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.batchBlocks.map((b, i) => {
              const statusMap = {
                pending: '<span style="color:var(--text-muted);">⏳ Aguardando</span>',
                uploading: '<span style="color:var(--accent);">🔄 Enviando...</span>',
                done: '<span style="color:#88CC00;">✅ Pronto</span>',
                error: '<span style="color:var(--error);">❌ Erro</span>',
              };
              const rowBg = b.status === 'done' ? 'rgba(34,197,94,0.04)' : b.status === 'uploading' ? 'rgba(132,204,22,0.06)' : 'transparent';
              return `
                <tr style="border-bottom:1px solid var(--border-color);background:${rowBg};transition:background .3s;">
                  <td style="padding:10px 12px;font-weight:600;color:var(--text-primary);">${b.code}</td>
                  <td style="padding:10px 12px;color:var(--text-secondary);">${b.gender}</td>
                  <td style="padding:10px 12px;color:var(--text-secondary);">${b.color}</td>
                  <td style="padding:10px 12px;text-align:center;color:var(--text-secondary);">${b.images}</td>
                  <td style="padding:10px 12px;text-align:center;">${statusMap[b.status] || statusMap.pending}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      ${doneCount === state.batchBlocks.length && doneCount > 0 ? `
        <div style="margin-top:16px;padding:14px 16px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:var(--radius-md);">
          <div style="font-size:14px;font-weight:700;color:#88CC00;margin-bottom:8px;">✅ Upload Completo!</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">
            ${totalImgs} imagens enviadas para o CDN com sucesso.
          </div>
          <button class="btn btn--primary btn--sm" id="batch-copy-urls">📋 Copiar Todas as URLs</button>
        </div>
      ` : ''}
    `;
  }

  // ───────── Position badges (padrão BRK e-commerce) ─────────
  const BRK_POSITIONS = [
    { label: '⭐ HERO', class: 'badge--hero' },
    { label: 'FRENTE', class: 'badge--accent' },
    { label: 'COSTAS', class: 'badge--info' },
    { label: 'FRENTE PERSP', class: 'badge--accent' },
    { label: 'COSTAS PERSP', class: 'badge--info' },
    { label: 'CORPO', class: 'badge--warning' },
    { label: 'ACESSÓRIOS', class: 'badge--warning' },
    { label: 'DETALHE', class: 'badge--secondary' },
  ];

  function getPositionBadge(index) {
    if (index < BRK_POSITIONS.length) {
      const p = BRK_POSITIONS[index];
      return `<span class="image-card__badge ${p.class}">${p.label}</span>`;
    }
    return `<span class="image-card__badge badge--secondary">EXTRA ${index + 1}</span>`;
  }

  // ───────── Preview Grid ─────────
  function renderPreviewGrid() {
    return `
      <div class="card card--static" style="max-height:520px; overflow-y:auto;">
        <div class="flex items-center justify-between mb-2">
          <h3 class="card__title">🖼️ Preview — Padrão BRK</h3>
          <span class="badge badge--info">${state.files.length} imagens</span>
        </div>
        <p class="text-muted" style="font-size:12px;margin-bottom:12px;">
          Arraste para reordenar · 1ª imagem = Hero · Ordem: Frente → Costas → Perspectiva → Detalhes
        </p>
        <div class="image-grid" id="img-grid">
          ${state.files.map((f, i) => `
            <div class="image-card ${i === 0 ? 'image-card--hero' : ''}" draggable="true" data-img-idx="${i}">
              <img src="${f.dataUrl}" alt="${f.originalName}" class="image-card__img">
              
              ${getPositionBadge(i)}
              
              <div class="image-card__overlay">
                <button class="img-remove-btn" data-img-id="${f.id}" title="Remover imagem">×</button>
                <div class="image-card__drag-handle">⠿</div>
              </div>

              <div class="image-card__info">
                <div class="image-card__old-name" title="${f.originalName}">${f.originalName}</div>
                <div class="image-card__new-name">${getNewName(i)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ───────── Preview vazio ─────────
  function renderEmptyPreview() {
    return `
      <div class="card card--static" style="text-align:center; padding:48px 24px;">
        <div style="font-size:42px; margin-bottom:12px; opacity:0.4;">🖼️</div>
        <p style="font-size:13px; color:var(--text-muted);">
          Nenhuma imagem adicionada ainda.<br>
          Arraste ou selecione imagens ao lado.
        </p>
      </div>
    `;
  }

  // ───────── Preview de URLs formatados ─────────
  function renderUrlPreview() {
    const urls = {
      Masculino: state.urlsMasc.trim(),
      Feminino: state.urlsFem.trim(),
      Infantil: state.urlsInf.trim(),
    };

    const hasUrls = Object.values(urls).some(v => v);
    if (!hasUrls) return '';

    const formatted = Object.entries(urls)
      .filter(([, v]) => v)
      .map(([label, v]) => {
        const joined = v.split(/\r?\n/).filter(Boolean).join(' | ');
        return `<div style="margin-bottom:8px;">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">${label}:</span>
          <div style="
            background:var(--bg-input);
            border:1px solid var(--border-color);
            border-radius:var(--radius-sm);
            padding:8px 12px;
            margin-top:4px;
            font-size:11px;
            font-family:'Consolas','Monaco',monospace;
            color:var(--accent-secondary);
            word-break:break-all;
            line-height:1.6;
          ">${joined || '—'}</div>
        </div>`;
      }).join('');

    return `<div class="mt-2 mb-2">${formatted}</div>`;
  }

  // ═══════════════════════════════════════════
  //  BINDINGS
  // ═══════════════════════════════════════════

  function bind() {
    // Tab switching
    document.querySelectorAll('.img-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeTab = tab.dataset.tab;
        render();
      });
    });

    // Batch scan
    document.getElementById('batch-scan-btn')?.addEventListener('click', async () => {
      const pathInput = document.getElementById('batch-folder-path');
      const folderPath = pathInput?.value?.trim();
      if (!folderPath) { window.HUB.showToast('Informe o caminho da pasta', 'warning'); return; }
      
      state.batchPath = folderPath;
      state.batchScanning = true;
      render();
      
      try {
        const resp = await fetch('/api/scan-upload-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Falha no scan');
        
        state.batchBlocks = data.blocks.map(b => ({ ...b, status: 'pending', urls: [] }));
        window.HUB.showToast(`${data.blocks.length} blocos encontrados!`, 'success');
      } catch (err) {
        window.HUB.showToast(`Erro: ${err.message}`, 'error');
      }
      
      state.batchScanning = false;
      render();
    });

    // Batch upload all
    document.getElementById('batch-upload-all')?.addEventListener('click', async () => {
      if (state.batchUploading) return;
      state.batchUploading = true;
      render();
      
      for (let i = 0; i < state.batchBlocks.length; i++) {
        const block = state.batchBlocks[i];
        if (block.status === 'done') continue;
        
        block.status = 'uploading';
        render();
        
        try {
          const resp = await fetch('/api/s3-proxy/upload-from-disk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folderPath: state.batchPath,
              codeBase: block.path, // e.g. "APC0570/MASC/PRETA"
              gender: block.gender.toLowerCase(),
            }),
          });
          const data = await resp.json();
          if (data.success) {
            block.status = 'done';
            block.urls = data.urls || [];
            // Store in HUB state for spreadsheet
            const urlKey = `${block.code}_${block.gender}_${block.color}`;
            if (!window.HUB.state) window.HUB.state = {};
            if (!window.HUB.state.imageUrls) window.HUB.state.imageUrls = {};
            window.HUB.state.imageUrls[urlKey] = data.joined || '';
          } else {
            throw new Error(data.error || 'Upload failed');
          }
        } catch (err) {
          block.status = 'error';
          console.error(`Upload error for ${block.code}/${block.gender}/${block.color}:`, err);
        }
        
        render();
      }
      
      state.batchUploading = false;
      window.HUB.showToast('Upload em massa concluído!', 'success');
      render();
    });

    // Copy all batch URLs  
    document.getElementById('batch-copy-urls')?.addEventListener('click', () => {
      const allUrls = state.batchBlocks
        .filter(b => b.urls && b.urls.length > 0)
        .map(b => `${b.code}/${b.gender}/${b.color}:\n${b.urls.join(' | ')}`)
        .join('\n\n');
      navigator.clipboard.writeText(allUrls)
        .then(() => window.HUB.showToast('URLs copiadas!', 'success'))
        .catch(() => window.HUB.showToast('Erro ao copiar', 'error'));
    });

    const dropzone = document.getElementById('img-dropzone');
    const fileInput = document.getElementById('img-file-input');

    // ─── Scroll to CDN section ───
    document.getElementById('btn-scroll-cdn')?.addEventListener('click', () => {
      const cdnSection = document.getElementById('cdn-health-badge')?.closest('.card');
      if (cdnSection) cdnSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ─── Clique na dropzone abre file picker ───
    dropzone?.addEventListener('click', () => fileInput?.click());

    // ─── File input change ───
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) processFiles(e.target.files);
    });

    // ─── Drag & drop na dropzone ───
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--accent-primary)';
      dropzone.style.background = 'rgba(99, 102, 241, 0.05)';
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-color)';
      dropzone.style.background = 'var(--bg-input)';
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-color)';
      dropzone.style.background = 'var(--bg-input)';
      if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    });

    // ─── Modo de renomeação (pills) ───
    document.querySelectorAll('[data-rename-mode]').forEach(pill => {
      pill.addEventListener('click', () => {
        state.renameMode = pill.dataset.renameMode;
        render();
      });
    });

    // ─── Gênero (pills) ───
    document.querySelectorAll('[data-gender]').forEach(pill => {
      pill.addEventListener('click', () => {
        state.gender = pill.dataset.gender;
        render();
      });
    });

    // ─── Prefixo personalizado ───
    document.getElementById('img-prefix')?.addEventListener('input', (e) => {
      state.prefix = e.target.value;
      render();
    });

    // ─── Número inicial ───
    document.getElementById('img-start-num')?.addEventListener('input', (e) => {
      state.startNum = Math.max(1, parseInt(e.target.value) || 1);
      render();
    });

    // ─── Limpar tudo ───
    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
      state.files = [];
      render();
      window.HUB.showToast('Todas as imagens removidas', 'info');
    });

    // ─── Remover imagem individual ───
    document.querySelectorAll('.img-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.imgId);
        state.files = state.files.filter(f => f.id !== id);
        render();
      });
    });

    // ─── Drag & drop para reordenação no grid ───
    const imgCards = document.querySelectorAll('.image-card[draggable]');
    imgCards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        state.dragIdx = parseInt(card.dataset.imgIdx);
        card.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
        state.dragIdx = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.style.borderColor = 'var(--accent-primary)';
      });

      card.addEventListener('dragleave', () => {
        card.style.borderColor = 'var(--border-color)';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        card.style.borderColor = 'var(--border-color)';
        const toIdx = parseInt(card.dataset.imgIdx);
        if (state.dragIdx !== null && state.dragIdx !== toIdx) {
          // Reordena o array
          const item = state.files.splice(state.dragIdx, 1)[0];
          state.files.splice(toIdx, 0, item);
          render();
        }
      });
    });

    // ─── Renomear e baixar ───
    document.getElementById('btn-rename-download')?.addEventListener('click', () => {
      if (state.files.length === 0) {
        window.HUB.showToast('Nenhuma imagem para renomear.', 'warning');
        return;
      }
      state.files.forEach((f, i) => {
        const newName = getNewName(i);
        // Pequeno delay para não travar o navegador
        setTimeout(() => downloadRenamed(f, newName), i * 150);
      });
      window.HUB.showToast(`${state.files.length} imagem(ns) renomeada(s) e baixada(s)`, 'success');
    });

    // ─── Upload para servidor ───
    document.getElementById('btn-upload-server')?.addEventListener('click', async () => {
      if (state.files.length === 0) {
        window.HUB.showToast('Nenhuma imagem para enviar.', 'warning');
        return;
      }

      state.uploading = true;
      window.HUB.showToast('Enviando imagens para o servidor...', 'info');

      try {
        const formData = new FormData();
        state.files.forEach((f, i) => {
          const newName = getNewName(i);
          formData.append('images', f.file, newName);
        });
        formData.append('gender', GENDER_CODES[state.gender]);
        formData.append('prefix', getPrefix());

        const resp = await fetch('/api/images/rename', {
          method: 'POST',
          body: formData,
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        window.HUB.showToast(`${state.files.length} imagem(ns) enviada(s) com sucesso!`, 'success');
      } catch (err) {
        window.HUB.showToast(`Erro ao enviar: ${err.message}. Verifique se o backend está rodando.`, 'warning');
      } finally {
        state.uploading = false;
      }
    });

    // ─── URLs textareas ───
    document.getElementById('urls-masc')?.addEventListener('input', (e) => {
      state.urlsMasc = e.target.value;
      renderUrlSection();
    });
    document.getElementById('urls-fem')?.addEventListener('input', (e) => {
      state.urlsFem = e.target.value;
      renderUrlSection();
    });
    document.getElementById('urls-inf')?.addEventListener('input', (e) => {
      state.urlsInf = e.target.value;
      renderUrlSection();
    });

    // ─── Copiar URLs formatados ───
    document.getElementById('btn-copy-urls')?.addEventListener('click', () => {
      const lines = [];
      [state.urlsMasc, state.urlsFem, state.urlsInf].forEach(text => {
        const trimmed = text.trim();
        if (trimmed) {
          const joined = trimmed.split(/\r?\n/).filter(Boolean).join(' | ');
          lines.push(joined);
        }
      });

      if (lines.length === 0) {
        window.HUB.showToast('Nenhuma URL para copiar.', 'warning');
        return;
      }

      const result = lines.join('\n');
      navigator.clipboard.writeText(result)
        .then(() => window.HUB.showToast('URLs formatados copiados!', 'success'))
        .catch(() => window.HUB.showToast('Erro ao copiar.', 'error'));
    });

    // ─── Enviar para gerador de planilhas ───
    document.getElementById('btn-send-to-spreadsheet')?.addEventListener('click', () => {
      // Salva URLs no estado global para o módulo de planilhas consumir
      window.HUB.state.imageUrls = {
        masculino: state.urlsMasc.trim().split(/\r?\n/).filter(Boolean).join(' | '),
        feminino: state.urlsFem.trim().split(/\r?\n/).filter(Boolean).join(' | '),
        infantil: state.urlsInf.trim().split(/\r?\n/).filter(Boolean).join(' | '),
      };
      window.HUB.showToast('URLs salvos! Navegando para o Gerador de Planilhas...', 'success');
      setTimeout(() => window.HUB.navigate('spreadsheet'), 500);
    });

    // ═══════════════════════════════════════
    //  CDN Upload Bindings
    // ═══════════════════════════════════════
    bindCdnUpload();
  }

  // ───────── CDN Upload State ─────────
  let cdnResults = []; // [{ url, fileName }]
  let cdnUploading = false;

  function bindCdnUpload() {
    // Health check badge
    const badge = document.getElementById('cdn-health-badge');
    if (badge) {
      fetch('/api/s3-proxy/health').then(r => r.json()).then(data => {
        if (data.online) {
          badge.textContent = '🟢 Online';
          badge.style.color = 'var(--accent)';
          badge.style.background = 'rgba(132,204,22,0.1)';
          badge.style.borderColor = 'rgba(132,204,22,0.2)';
        } else {
          badge.textContent = '🔴 Offline';
          badge.style.color = 'var(--error)';
        }
      }).catch(() => {
        badge.textContent = '⚠️ Sem resposta';
        badge.style.color = 'var(--warning, #f59e0b)';
      });
    }

    // ─── Upload por Pasta ───
    const folderBtn = document.getElementById('cdn-upload-folder');
    if (folderBtn) folderBtn.addEventListener('click', () => cdnUploadFromFolder());

    // ─── Drag & Drop para CDN ───
    const dropzone = document.getElementById('cdn-dropzone');
    const fileInput = document.getElementById('cdn-file-input');

    if (dropzone) {
      dropzone.addEventListener('click', () => fileInput?.click());

      dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent)';
        dropzone.style.background = 'rgba(132,204,22,0.05)';
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '';
      });

      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '';
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) cdnUploadFiles(files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) cdnUploadFiles(files);
        fileInput.value = '';
      });
    }

    // ─── Copiar URLs ───
    document.getElementById('cdn-copy-all')?.addEventListener('click', () => {
      if (cdnResults.length === 0) return;
      const text = cdnResults.map(r => r.url).join('\n');
      navigator.clipboard.writeText(text)
        .then(() => window.HUB.showToast(`${cdnResults.length} URL(s) copiadas!`, 'success'))
        .catch(() => window.HUB.showToast('Erro ao copiar.', 'error'));
    });

    document.getElementById('cdn-copy-pipe')?.addEventListener('click', () => {
      if (cdnResults.length === 0) return;
      const text = cdnResults.map(r => r.url).join('|');
      navigator.clipboard.writeText(text)
        .then(() => window.HUB.showToast('URLs copiadas (pipe-joined)!', 'success'))
        .catch(() => window.HUB.showToast('Erro ao copiar.', 'error'));
    });

    document.getElementById('cdn-clear')?.addEventListener('click', () => {
      cdnResults = [];
      renderCdnResults();
    });

    // Render existing results if any
    if (cdnResults.length > 0) renderCdnResults();
  }

  /** Upload de pasta (servidor lê do disco) */
  async function cdnUploadFromFolder() {
    const pathInput = document.getElementById('cdn-folder-path');
    const statusEl = document.getElementById('cdn-folder-status');
    const folderPath = pathInput?.value?.trim();

    if (!folderPath) {
      if (statusEl) { statusEl.textContent = '❌ Informe o caminho da pasta'; statusEl.style.color = 'var(--error)'; }
      return;
    }

    if (cdnUploading) return;
    cdnUploading = true;

    // Mostrar progresso
    const progressEl = document.getElementById('cdn-upload-progress');
    if (progressEl) progressEl.style.display = 'block';
    updateCdnProgress('Enviando pasta...', 0);
    if (statusEl) { statusEl.textContent = '⏳ Enviando...'; statusEl.style.color = 'var(--accent)'; }

    // Extrair codeBase se o path aponta para uma subpasta específica
    // Se não, enviar tudo junto
    const pathParts = folderPath.replace(/\\/g, '/').replace(/\/$/,'').split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const parentPath = pathParts.slice(0, -1).join('/');

    // Verificar se é uma pasta com subpastas (pasta raiz) ou pasta de código
    try {
      const scanResp = await fetch('/api/autopilot/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath }),
      });
      const scanData = await scanResp.json();

      if (!scanResp.ok) {
        if (statusEl) { statusEl.textContent = `❌ ${scanData.error || 'Pasta não encontrada'}`; statusEl.style.color = 'var(--error)'; }
        cdnUploading = false;
        if (progressEl) progressEl.style.display = 'none';
        return;
      }

      if (scanData.folders && scanData.folders.length > 0) {
        // É uma pasta raiz com subpastas — enviar cada subpasta
        const totalFolders = scanData.folders.length;
        let done = 0;

        for (const folder of scanData.folders) {
          updateCdnProgress(`📂 ${folder.name} (${done + 1}/${totalFolders})`, Math.round((done / totalFolders) * 100));

          try {
            const resp = await fetch('/api/s3-proxy/upload-from-disk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderPath, codeBase: folder.name }),
            });
            const data = await resp.json();

            if (data.success && data.urls) {
              data.urls.forEach((url, i) => {
                const imgName = folder.images?.[i] || url.split('/').pop();
                cdnResults.push({ url, fileName: `${folder.name}/${imgName}` });
              });
            }
          } catch (err) {
            console.error(`CDN folder error ${folder.name}:`, err);
          }

          done++;
        }

        updateCdnProgress(`✅ ${done} pasta(s) processada(s)`, 100);
      } else {
        // É uma pasta de código direta (sem subpastas) — enviar como código
        updateCdnProgress(`📂 ${lastPart}...`, 50);

        const resp = await fetch('/api/s3-proxy/upload-from-disk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: parentPath, codeBase: lastPart }),
        });
        const data = await resp.json();

        if (data.success && data.urls) {
          data.urls.forEach(url => {
            cdnResults.push({ url, fileName: url.split('/').pop() });
          });
          updateCdnProgress(`✅ ${data.total} imagem(ns) enviada(s)`, 100);
        } else {
          throw new Error(data.error || 'Falha no upload');
        }
      }

      if (statusEl) {
        statusEl.innerHTML = `✅ <strong>${cdnResults.length}</strong> imagem(ns) no CDN`;
        statusEl.style.color = 'var(--accent)';
      }
      window.HUB.showToast(`✅ ${cdnResults.length} imagem(ns) enviada(s) ao CDN!`, 'success');
    } catch (err) {
      if (statusEl) { statusEl.textContent = `❌ Erro: ${err.message}`; statusEl.style.color = 'var(--error)'; }
      window.HUB.showToast(`❌ Erro: ${err.message}`, 'error');
    }

    cdnUploading = false;
    setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 3000);
    renderCdnResults();
  }

  /** Upload de arquivos individuais (drag & drop) */
  async function cdnUploadFiles(files) {
    if (cdnUploading) return;
    cdnUploading = true;

    const progressEl = document.getElementById('cdn-upload-progress');
    if (progressEl) progressEl.style.display = 'block';

    let done = 0;
    const total = files.length;

    for (const file of files) {
      updateCdnProgress(`📤 ${file.name} (${done + 1}/${total})`, Math.round((done / total) * 100));

      try {
        const formData = new FormData();
        formData.append('files', file, file.name);

        const resp = await fetch('/api/s3-proxy/upload-batch', {
          method: 'POST',
          body: formData,
        });
        const data = await resp.json();

        if (data.success && data.results && data.results.length > 0) {
          cdnResults.push({ url: data.results[0].url, fileName: file.name });
        } else {
          console.error(`CDN upload failed for ${file.name}:`, data.error);
          window.HUB.showToast(`⚠️ Falha: ${file.name}`, 'warning');
        }
      } catch (err) {
        console.error(`CDN upload error ${file.name}:`, err);
        window.HUB.showToast(`❌ Erro: ${file.name}: ${err.message}`, 'error');
      }

      done++;
      // Delay entre uploads
      if (done < total) await new Promise(r => setTimeout(r, 1500));
    }

    updateCdnProgress(`✅ ${done} imagem(ns) processada(s)`, 100);
    window.HUB.showToast(`✅ ${cdnResults.length} imagem(ns) no CDN!`, 'success');

    cdnUploading = false;
    setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 3000);
    renderCdnResults();
  }

  function updateCdnProgress(text, pct) {
    const textEl = document.getElementById('cdn-progress-text');
    const pctEl = document.getElementById('cdn-progress-pct');
    const barEl = document.getElementById('cdn-progress-bar');

    if (textEl) textEl.textContent = text;
    if (pctEl) pctEl.textContent = pct + '%';
    if (barEl) barEl.style.width = pct + '%';
  }

  function renderCdnResults() {
    const container = document.getElementById('cdn-results');
    const grid = document.getElementById('cdn-results-grid');
    if (!container || !grid) return;

    if (cdnResults.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    grid.innerHTML = cdnResults.map((r, i) => `
      <div style="
        background:var(--bg-input);
        border:1px solid var(--border-color);
        border-radius:var(--radius-md);
        overflow:hidden;
        transition:var(--transition);
      ">
        <div style="width:100%;height:100px;overflow:hidden;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">
          <img src="${r.url}" alt="${r.fileName}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"
            onerror="this.parentElement.innerHTML='<div style=\\'font-size:24px;opacity:0.3;\\'>🖼️</div>'">
        </div>
        <div style="padding:8px 10px;">
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;" title="${r.fileName}">
            ${r.fileName}
          </div>
          <div style="display:flex;gap:4px;">
            <button class="cdn-copy-single btn btn--ghost" data-cdn-idx="${i}" style="font-size:10px;padding:2px 8px;flex:1;">
              📋 Copiar URL
            </button>
            <a href="${r.url}" target="_blank" class="btn btn--ghost" style="font-size:10px;padding:2px 8px;text-decoration:none;">
              🔗
            </a>
          </div>
        </div>
      </div>
    `).join('');

    // Bind copy single buttons
    grid.querySelectorAll('.cdn-copy-single').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.cdnIdx);
        if (cdnResults[idx]) {
          navigator.clipboard.writeText(cdnResults[idx].url)
            .then(() => {
              btn.textContent = '✅ Copiado!';
              setTimeout(() => { btn.textContent = '📋 Copiar URL'; }, 1500);
            })
            .catch(() => window.HUB.showToast('Erro ao copiar', 'error'));
        }
      });
    });
  }

  /** Atualiza apenas a seção de preview de URLs sem re-render completo */
  function renderUrlSection() {
    // Re-render completo para simplificar (URLs mudam pouco)
    // Em produção, poderíamos otimizar atualizando só o preview
  }

  // ───────── API pública ─────────
  window.HUB.renderImageManager = render;
})();
