/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Gerador de Planilhas (CSV Bling / Sankhya)
   Módulo completo com stepper, formulário e geração client-side
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ───────── Constantes ─────────

  // Tamanhos padrão por tipo de produto
  const DEFAULT_SIZES = {
    'Raglan':         ['P', 'M', 'G', 'GG', 'G1', 'G2'],
    'Camisa de Botão':['P', 'M', 'G', 'GG', 'G1', 'G2'],
    'Corta-Vento':    ['P', 'M', 'G', 'GG', 'G1', 'G2'],
    'Bandana':        ['ÚNICO'],
    'Tubeneck':       ['ÚNICO'],
    'Outro':          ['P', 'M', 'G', 'GG', 'G1', 'G2'],
  };

  const ALL_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'ÚNICO'];

  // Grupo de produto Sankhya por tipo
  const GRUPO_PRODUTO = {
    'Raglan':          2010100,
    'Camisa de Botão': 2010100,
    'Corta-Vento':     2010100,
    'Bandana':         2010200,
    'Tubeneck':        2010200,
    'Outro':           2010100,
  };

  // NCM por gênero
  const NCM_MAP = {
    'Masculino': '6101.30.00',
    'Feminino':  '6102.30.00',
    'Infantil':  '6101.30.00',
  };

  // ───────── Estado interno ─────────
  let formState = {
    erp: 'Bling',
    tipoProduto: 'Raglan',
    codigoBase: '',
    nomeProduto: '',
    marca: 'BRK FISHING',
    preco: '',
    generos: ['Masculino', 'Feminino'],
    tamanhos: ['P', 'M', 'G', 'GG', 'G1', 'G2'],
    eans: '',
    urlsMasculino: '',
    urlsFeminino: '',
    urlsInfantil: '',
    step: 1,
  };

  // ───────── Helpers ─────────

  /** Retorna quantidade de SKUs (gêneros × tamanhos) */
  function skuCount() {
    return formState.generos.length * formState.tamanhos.length;
  }

  /** Converte string de EANs em array, limpando vazios */
  function parseEans(text) {
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  /** Converte string de URLs separadas por | */
  function parseUrls(text) {
    return text.split('|').map(s => s.trim()).filter(Boolean);
  }

  /** Sufixo do tamanho para código Sankhya */
  function sizeSuffix(size) {
    const map = { 'PP': 'PP', 'P': 'P', 'M': 'M', 'G': 'G', 'GG': 'GG', 'G1': 'G1', 'G2': 'G2', 'G3': 'G3', 'ÚNICO': 'U' };
    return map[size] || size;
  }

  /** Gênero abreviado */
  function genderCode(g) {
    return g === 'Masculino' ? 'M' : g === 'Feminino' ? 'F' : 'I';
  }

  /** Letra do tamanho para AD_TAMTECIDO Sankhya */
  function tamTecido(size) {
    const map = { 'PP': 'PP', 'P': 'P', 'M': 'M', 'G': 'G', 'GG': 'GG', 'G1': 'XG', 'G2': 'XGG', 'G3': 'XGGG', 'ÚNICO': 'UN' };
    return map[size] || size;
  }

  // ═══════════════════════════════════════════
  //  RENDERIZAÇÃO DO STEPPER
  // ═══════════════════════════════════════════

  function renderStepper() {
    const steps = [
      { n: 1, label: 'Configuração' },
      { n: 2, label: 'Variações' },
      { n: 3, label: 'EANs' },
      { n: 4, label: 'Imagens' },
      { n: 5, label: 'Preview & Export' },
    ];

    return steps.map((s, i) => {
      const cls = s.n === formState.step ? 'active' : s.n < formState.step ? 'completed' : '';
      const lineCls = i < steps.length - 1
        ? `<div class="stepper__line ${s.n < formState.step ? 'completed' : ''}"></div>`
        : '';
      return `
        <div class="stepper__step ${cls}" data-step="${s.n}">
          <div class="stepper__number">${s.n < formState.step ? '✓' : s.n}</div>
          <span class="stepper__label">${s.label}</span>
        </div>
        ${lineCls}
      `;
    }).join('');
  }

  // ═══════════════════════════════════════════
  //  RENDERIZAÇÃO DOS PASSOS
  // ═══════════════════════════════════════════

  function renderStep1() {
    return `
      <div class="step-panel active" id="step-1">
        <div class="card card--static" style="max-width:720px">
          <h3 class="card__title mb-2">Configuração do Produto</h3>

          <!-- ERP Toggle -->
          <div class="form-group">
            <label class="form-label">ERP Destino</label>
            <div class="pill-toggle" id="erp-toggle">
              <span class="pill-toggle__option ${formState.erp === 'Bling' ? 'active' : ''}" data-erp="Bling">Bling</span>
              <span class="pill-toggle__option ${formState.erp === 'Sankhya' ? 'active' : ''}" data-erp="Sankhya">Sankhya</span>
            </div>
          </div>

          <!-- Tipo de Produto -->
          <div class="form-group">
            <label class="form-label" for="tipo-produto">Tipo de Produto</label>
            <select class="form-select" id="tipo-produto">
              ${['Raglan', 'Camisa de Botão', 'Corta-Vento', 'Bandana', 'Tubeneck', 'Outro']
                .map(t => `<option value="${t}" ${formState.tipoProduto === t ? 'selected' : ''}>${t}</option>`)
                .join('')}
            </select>
          </div>

          <!-- Código Base -->
          <div class="form-group">
            <label class="form-label" for="codigo-base">Código Base</label>
            <input class="form-input" id="codigo-base" type="text" placeholder="Ex: RAGLAN289, CV089, BM0139" value="${formState.codigoBase}">
          </div>

          <!-- Nome do Produto -->
          <div class="form-group">
            <label class="form-label" for="nome-produto">Nome do Produto</label>
            <input class="form-input" id="nome-produto" type="text" placeholder="Ex: CAMISA UV50 BRK F1 McLaren" value="${formState.nomeProduto}">
          </div>

          <!-- Marca -->
          <div class="form-group">
            <label class="form-label" for="marca">Marca</label>
            <select class="form-select" id="marca">
              ${['BRK FISHING', 'BRK AGRO', 'Brk Motors']
                .map(m => `<option value="${m}" ${formState.marca === m ? 'selected' : ''}>${m}</option>`)
                .join('')}
            </select>
          </div>

          <!-- Preço -->
          <div class="form-group">
            <label class="form-label" for="preco">Preço</label>
            <input class="form-input" id="preco" type="text" placeholder="Ex: 159,90" value="${formState.preco}">
          </div>

          <div class="step-nav">
            <span></span>
            <button class="btn btn--primary" id="btn-next-1">Próximo →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2() {
    return `
      <div class="step-panel active" id="step-2">
        <div class="card card--static" style="max-width:720px">
          <h3 class="card__title mb-2">Variações do Produto</h3>

          <!-- Gênero -->
          <div class="form-group">
            <label class="form-label">Gênero</label>
            <div class="checkbox-group" id="genero-group">
              ${['Masculino', 'Feminino', 'Infantil'].map(g => {
                const checked = formState.generos.includes(g);
                return `
                  <label class="checkbox-pill ${checked ? 'checked' : ''}" data-value="${g}">
                    <input type="checkbox" ${checked ? 'checked' : ''}>
                    <span class="checkbox-pill__indicator"></span>
                    <span>${g}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Tamanhos -->
          <div class="form-group">
            <label class="form-label">Tamanhos</label>
            <div class="checkbox-group" id="tamanho-group">
              ${ALL_SIZES.map(sz => {
                const checked = formState.tamanhos.includes(sz);
                return `
                  <label class="checkbox-pill ${checked ? 'checked' : ''}" data-value="${sz}">
                    <input type="checkbox" ${checked ? 'checked' : ''}>
                    <span class="checkbox-pill__indicator"></span>
                    <span>${sz}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Contador de SKUs -->
          <div class="sku-counter">
            <span class="sku-counter__value" id="sku-count">${skuCount()}</span>
            <span class="sku-counter__label">SKUs serão gerados</span>
          </div>

          <div class="step-nav">
            <button class="btn btn--secondary" id="btn-prev-2">← Voltar</button>
            <button class="btn btn--primary" id="btn-next-2">Próximo →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const needed = skuCount();
    const eans = parseEans(formState.eans);
    const diff = eans.length - needed;

    return `
      <div class="step-panel active" id="step-3">
        <div class="card card--static" style="max-width:720px">
          <h3 class="card__title mb-2">Códigos EAN</h3>
          <p class="text-secondary text-sm mb-2">Cole os EANs (um por linha). Cada EAN será atribuído automaticamente ao SKU correspondente na ordem.</p>

          <div class="form-group">
            <label class="form-label">
              EANs · <span class="text-muted">Quantidade necessária: <strong style="color:var(--accent-secondary)">${needed}</strong></span>
            </label>
            <textarea class="form-textarea" id="ean-textarea" rows="10" placeholder="7898558381234&#10;7898558381235&#10;7898558381236&#10;...">${formState.eans}</textarea>
          </div>

          <div id="ean-status">
            ${eans.length > 0 ? renderEanStatus(eans.length, needed) : ''}
          </div>

          <div class="step-nav">
            <button class="btn btn--secondary" id="btn-prev-3">← Voltar</button>
            <button class="btn btn--primary" id="btn-next-3">Próximo →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEanStatus(count, needed) {
    if (count === needed) {
      return `<div class="ean-status ean-status--ok">✅ ${count}/${needed} EANs — Perfeito!</div>`;
    }
    if (count < needed) {
      return `<div class="ean-status ean-status--error">⚠️ ${count}/${needed} EANs — Faltam ${needed - count}</div>`;
    }
    return `<div class="ean-status ean-status--error">⚠️ ${count}/${needed} EANs — ${count - needed} a mais</div>`;
  }

  function renderStep4() {
    return `
      <div class="step-panel active" id="step-4">
        <div class="card card--static" style="max-width:720px">
          <h3 class="card__title mb-2">URLs de Imagens</h3>
          <p class="text-secondary text-sm mb-2">Cole os links de imagem separados por <strong>|</strong> (pipe). Use o Gerador de Links para obtê-los.</p>

          ${formState.generos.includes('Masculino') ? `
          <div class="form-group">
            <label class="form-label">URLs Masculino</label>
            <textarea class="form-textarea img-url-input" id="urls-masculino" rows="3" placeholder="https://…/img1.jpg | https://…/img2.jpg">${formState.urlsMasculino}</textarea>
            <div class="img-preview-row" id="preview-masculino"></div>
          </div>` : ''}

          ${formState.generos.includes('Feminino') ? `
          <div class="form-group">
            <label class="form-label">URLs Feminino</label>
            <textarea class="form-textarea img-url-input" id="urls-feminino" rows="3" placeholder="https://…/img1.jpg | https://…/img2.jpg">${formState.urlsFeminino}</textarea>
            <div class="img-preview-row" id="preview-feminino"></div>
          </div>` : ''}

          ${formState.generos.includes('Infantil') ? `
          <div class="form-group">
            <label class="form-label">URLs Infantil</label>
            <textarea class="form-textarea img-url-input" id="urls-infantil" rows="3" placeholder="https://…/img1.jpg | https://…/img2.jpg">${formState.urlsInfantil}</textarea>
            <div class="img-preview-row" id="preview-infantil"></div>
          </div>` : ''}

          <div class="step-nav">
            <button class="btn btn--secondary" id="btn-prev-4">← Voltar</button>
            <button class="btn btn--primary" id="btn-next-4">Próximo →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep5() {
    const rows = generateData();
    const headers = formState.erp === 'Bling' ? getBlingHeaders() : getSankhyaHeaders();

    return `
      <div class="step-panel active" id="step-5">
        <div class="card card--static">
          <div class="flex items-center justify-between mb-2">
            <h3 class="card__title">Preview & Exportação</h3>
            <div class="row-count">
              <span class="row-count__num">${rows.length}</span> linhas · ERP: <span class="badge badge--accent">${formState.erp}</span>
            </div>
          </div>

          <div class="table-wrapper" style="max-height:420px; overflow:auto;">
            <table class="table">
              <thead>
                <tr>${headers.map(h => `<th>${window.HUB.esc(h)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${rows.map(row => `
                  <tr>${row.map(cell => `<td>${window.HUB.esc(cell ?? '')}</td>`).join('')}</tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="flex gap-3 mt-3">
            <button class="btn btn--primary btn--lg" id="btn-download-csv">⬇️ Baixar CSV</button>
            <button class="btn btn--secondary btn--lg" id="btn-copy-csv">📋 Copiar para Área de Transferência</button>
          </div>

          <div class="step-nav">
            <button class="btn btn--secondary" id="btn-prev-5">← Voltar</button>
            <span></span>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  //  GERAÇÃO DE DADOS CSV
  // ═══════════════════════════════════════════

  function getBlingHeaders() {
    return [
      'Tipo', 'Situação', 'Código (SKU)', 'Descrição', 'Unidade', 'NCM',
      'Origem', 'Preço', 'Preço de custo', 'Peso líquido (Kg)',
      'Peso bruto (Kg)', 'GTIN/EAN', 'GTIN/EAN da Embalagem',
      'Largura do Produto', 'Altura do Produto', 'Profundidade do Produto',
      'Largura da Embalagem', 'Altura da Embalagem', 'Profundidade da Embalagem',
      'Estoque mínimo', 'Estoque máximo', 'Estoque inicial',
      'Sob encomenda', 'Dias para preparação', 'Marca',
      'Descrição Curta', 'Descrição Complementar',
      'Observações', 'Categoria', 'Informações Adicionais',
      'URL Imagens Externas', 'Link externo', 'Meses garantia',
      'Produto condicional', 'Frete grátis', 'Unidade de medida',
      'Qtd. volumes', 'Classe IPI', 'Valor IPI fixo',
      'Código lista de serviços', 'Tipo de produto',
      'Grupo de produto', 'Código pai (original)',
      'Código pai (clonado)', 'Produto Variação', 'Nome da variação',
      'Estoque da variação', 'Tipo da Produção',
      'Cest', 'Volume', 'isTribute',
      'Integração (tipo)', 'Integração (url)', 'ID agrupador',
      'Condição do Produto', 'Código do benefício fiscal',
      'Cross-docking', 'Tags'
    ];
  }

  function getSankhyaHeaders() {
    return [
      'DESCRPROD', 'REFERENCIA', 'CODGRUPOPROD', 'CODVOL',
      'PESOBRUTO', 'PESOLIQ', 'AD_PRECOTECER', 'AD_PRECOVENDA',
      'AD_IDEXTERNO2', 'ORIGPROD', 'AD_TAMTECIDO',
      'AD_EAN', 'MARCA', 'NCM', 'CEST',
      'CODTRIBPISCOFINS', 'CODTRIBICMSSN', 'CODTRIBIPI',
      'AD_TIPOPROD', 'AD_GENERO', 'AD_RENDIMENTO',
      'AD_LARGURA', 'AD_GRAMATURA', 'AD_COMPOSICAO',
      'ATIVO', 'USOPROD', 'AD_COR'
    ];
  }

  function generateData() {
    return formState.erp === 'Bling' ? generateBling() : generateSankhya();
  }

  function generateBling() {
    const rows = [];
    const eans = parseEans(formState.eans);
    let eanIdx = 0;
    const preco = formState.preco.replace(',', '.');

    // URLs por gênero
    const urlsMap = {
      'Masculino': formState.urlsMasculino,
      'Feminino': formState.urlsFeminino,
      'Infantil': formState.urlsInfantil,
    };

    // Linha pai (Produto)
    const parentCode = formState.codigoBase;
    const parentRow = new Array(58).fill('');
    parentRow[0] = 'P';           // Tipo = Produto
    parentRow[1] = 'Ativo';       // Situação
    parentRow[2] = parentCode;    // Código (SKU)
    parentRow[3] = formState.nomeProduto; // Descrição
    parentRow[4] = 'UN';          // Unidade
    parentRow[5] = NCM_MAP[formState.generos[0]] || '6101.30.00';
    parentRow[6] = '0';           // Origem (Nacional)
    parentRow[7] = preco;         // Preço
    parentRow[24] = formState.marca; // Marca
    rows.push(parentRow);

    // Linhas filhas (Variações)
    for (const genero of formState.generos) {
      const gCode = genderCode(genero);
      const urls = urlsMap[genero] || '';

      for (const tam of formState.tamanhos) {
        const childCode = `${parentCode}-${gCode}${sizeSuffix(tam)}`;
        const ean = eans[eanIdx] || '';
        eanIdx++;

        const row = new Array(58).fill('');
        row[0]  = 'V';            // Tipo = Variação
        row[1]  = 'Ativo';
        row[2]  = childCode;
        row[3]  = `${formState.nomeProduto} - ${genero} - ${tam}`;
        row[4]  = 'UN';
        row[5]  = NCM_MAP[genero] || '6101.30.00';
        row[6]  = '0';
        row[7]  = preco;
        row[11] = ean;             // GTIN/EAN
        row[12] = ean;             // GTIN/EAN da Embalagem
        row[24] = formState.marca;
        row[30] = urls;            // URL Imagens Externas
        row[42] = parentCode;      // Código pai (original)
        row[44] = `${genero}:${tam}`;  // Produto Variação
        row[45] = 'Tamanho;Gênero';    // Nome da variação
        rows.push(row);
      }
    }

    return rows;
  }

  function generateSankhya() {
    const rows = [];
    const eans = parseEans(formState.eans);
    let eanIdx = 0;
    const preco = formState.preco.replace(',', '.');
    const grupo = GRUPO_PRODUTO[formState.tipoProduto] || 2010100;

    for (const genero of formState.generos) {
      for (const tam of formState.tamanhos) {
        const ean = eans[eanIdx] || '';
        eanIdx++;

        const code = `${formState.codigoBase}${sizeSuffix(tam)}`;
        const descr = `${code} - ${formState.nomeProduto} - TAMANHO:${tam}`;

        const row = [
          descr,                            // DESCRPROD
          ean,                              // REFERENCIA
          grupo,                            // CODGRUPOPROD
          'UN',                             // CODVOL
          '0.300',                          // PESOBRUTO
          '0.250',                          // PESOLIQ
          preco,                            // AD_PRECOTECER
          preco,                            // AD_PRECOVENDA
          code,                             // AD_IDEXTERNO2
          '0',                              // ORIGPROD
          tamTecido(tam),                   // AD_TAMTECIDO
          ean,                              // AD_EAN
          formState.marca,                  // MARCA
          NCM_MAP[genero] || '6101.30.00',  // NCM
          '',                               // CEST
          '1',                              // CODTRIBPISCOFINS
          '1',                              // CODTRIBICMSSN
          '1',                              // CODTRIBIPI
          formState.tipoProduto,            // AD_TIPOPROD
          genero.charAt(0),                 // AD_GENERO (M/F/I)
          '',                               // AD_RENDIMENTO
          '',                               // AD_LARGURA
          '',                               // AD_GRAMATURA
          'POLIÉSTER',                      // AD_COMPOSICAO
          'S',                              // ATIVO
          'R',                              // USOPROD
          '',                               // AD_COR
        ];
        rows.push(row);
      }
    }

    return rows;
  }

  function buildCsvString() {
    const headers = formState.erp === 'Bling' ? getBlingHeaders() : getSankhyaHeaders();
    const rows = generateData();
    const sep = formState.erp === 'Bling' ? ';' : ';';

    const escape = (val) => {
      const s = String(val ?? '');
      if (s.includes(sep) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.map(escape).join(sep)];
    for (const row of rows) {
      lines.push(row.map(escape).join(sep));
    }
    return lines.join('\r\n');
  }

  // ═══════════════════════════════════════════
  //  BINDINGS (Event Listeners)
  // ═══════════════════════════════════════════

  function bindStep1() {
    // ERP toggle
    document.querySelectorAll('#erp-toggle .pill-toggle__option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('#erp-toggle .pill-toggle__option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        formState.erp = opt.dataset.erp;
      });
    });

    // Tipo de produto — auto-preenche tamanhos
    const tipoSel = document.getElementById('tipo-produto');
    if (tipoSel) {
      tipoSel.addEventListener('change', () => {
        formState.tipoProduto = tipoSel.value;
        formState.tamanhos = [...(DEFAULT_SIZES[tipoSel.value] || DEFAULT_SIZES['Outro'])];
      });
    }

    // Inputs simples
    bindInput('codigo-base', 'codigoBase');
    bindInput('nome-produto', 'nomeProduto');
    bindInput('preco', 'preco');

    const marcaSel = document.getElementById('marca');
    if (marcaSel) marcaSel.addEventListener('change', () => { formState.marca = marcaSel.value; });

    // Navegação
    document.getElementById('btn-next-1')?.addEventListener('click', () => goToStep(2));
  }

  function bindStep2() {
    bindCheckboxGroup('genero-group', 'generos');
    bindCheckboxGroup('tamanho-group', 'tamanhos');

    document.getElementById('btn-prev-2')?.addEventListener('click', () => goToStep(1));
    document.getElementById('btn-next-2')?.addEventListener('click', () => goToStep(3));
  }

  function bindStep3() {
    const ta = document.getElementById('ean-textarea');
    if (ta) {
      ta.addEventListener('input', () => {
        formState.eans = ta.value;
        const eans = parseEans(ta.value);
        const needed = skuCount();
        document.getElementById('ean-status').innerHTML = renderEanStatus(eans.length, needed);
      });
    }

    document.getElementById('btn-prev-3')?.addEventListener('click', () => goToStep(2));
    document.getElementById('btn-next-3')?.addEventListener('click', () => goToStep(4));
  }

  function bindStep4() {
    bindUrlField('urls-masculino', 'urlsMasculino', 'preview-masculino');
    bindUrlField('urls-feminino', 'urlsFeminino', 'preview-feminino');
    bindUrlField('urls-infantil', 'urlsInfantil', 'preview-infantil');

    document.getElementById('btn-prev-4')?.addEventListener('click', () => goToStep(3));
    document.getElementById('btn-next-4')?.addEventListener('click', () => goToStep(5));
  }

  function bindStep5() {
    document.getElementById('btn-download-csv')?.addEventListener('click', () => {
      const csv = buildCsvString();
      const bom = '\uFEFF'; // BOM para Excel
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${formState.codigoBase || 'planilha'}_${formState.erp.toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Incrementa contador
      window.HUB.state.counters.planilhas++;
      window.HUB.showToast('CSV baixado com sucesso!', 'success');
    });

    document.getElementById('btn-copy-csv')?.addEventListener('click', () => {
      const csv = buildCsvString();
      navigator.clipboard.writeText(csv).then(() => {
        window.HUB.showToast('Dados copiados para a área de transferência!', 'success');
      }).catch(() => {
        window.HUB.showToast('Erro ao copiar. Tente usar o botão de download.', 'error');
      });
    });

    document.getElementById('btn-prev-5')?.addEventListener('click', () => goToStep(4));
  }

  // Helpers de binding
  function bindInput(elId, stateKey) {
    const el = document.getElementById(elId);
    if (el) el.addEventListener('input', () => { formState[stateKey] = el.value; });
  }

  function bindCheckboxGroup(groupId, stateKey) {
    document.querySelectorAll(`#${groupId} .checkbox-pill`).forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.dataset.value;
        const idx = formState[stateKey].indexOf(val);
        if (idx === -1) {
          formState[stateKey].push(val);
          pill.classList.add('checked');
          pill.querySelector('input').checked = true;
        } else {
          formState[stateKey].splice(idx, 1);
          pill.classList.remove('checked');
          pill.querySelector('input').checked = false;
        }
        // Atualiza contador de SKUs
        const counterEl = document.getElementById('sku-count');
        if (counterEl) counterEl.textContent = skuCount();
      });
    });
  }

  function bindUrlField(textareaId, stateKey, previewId) {
    const ta = document.getElementById(textareaId);
    const preview = document.getElementById(previewId);
    if (!ta) return;

    ta.addEventListener('input', () => {
      formState[stateKey] = ta.value;
      if (preview) {
        const urls = parseUrls(ta.value);
        preview.innerHTML = urls.map(u =>
          `<img src="${u}" alt="preview" class="img-preview-thumb" onerror="this.style.display='none'">`
        ).join('');
      }
    });

    // Renderiza preview inicial se já há dados
    if (ta.value && preview) {
      const urls = parseUrls(ta.value);
      preview.innerHTML = urls.map(u =>
        `<img src="${u}" alt="preview" class="img-preview-thumb" onerror="this.style.display='none'">`
      ).join('');
    }
  }

  // ═══════════════════════════════════════════
  //  NAVEGAÇÃO ENTRE PASSOS
  // ═══════════════════════════════════════════

  function goToStep(step) {
    formState.step = step;
    renderPage();
  }

  // ═══════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════

  function renderPage() {
    const container = document.getElementById('app-content');

    const stepRenderers = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4, 5: renderStep5 };
    const stepBinders   = { 1: bindStep1,   2: bindStep2,   3: bindStep3,   4: bindStep4,   5: bindStep5 };

    container.innerHTML = `
      <div class="page-header fade-in">
        <h2 class="page-header__title">Gerador de Planilhas</h2>
        <p class="page-header__desc">Crie CSVs prontos para importação no ${formState.erp} com variações, EANs e imagens.</p>
      </div>

      <!-- Stepper -->
      <div class="stepper">
        ${renderStepper()}
      </div>

      <!-- Conteúdo do passo ativo -->
      ${stepRenderers[formState.step]()}
    `;

    // Binding do passo atual
    stepBinders[formState.step]();

    // Permite clicar nos steps do stepper para navegar (apenas para passos já visitados)
    document.querySelectorAll('.stepper__step').forEach(el => {
      el.addEventListener('click', () => {
        const target = parseInt(el.dataset.step);
        if (target <= formState.step) goToStep(target);
      });
    });
  }

  window.HUB.renderSpreadsheet = function () {
    formState.step = 1; // Reseta para o primeiro passo
    renderPage();
  };
})();
