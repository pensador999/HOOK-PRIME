(function(modules) {
  
  /**
   * Build CSV rows for a Unique product.
   * Unique products have only 'masc' gender internally and no sizes (tamanho: '').
   */
  function buildUniqueCsvRows(code, state, helpers) {
    const rows = [];
    const g = 'masc'; // unique products typically have only masc gender
    const codeKey = code.base; // no gender suffixes
    
    const getGroupById = helpers.getGroupById || (() => null);
    const getFirstGroup = helpers.getFirstGroup || (() => null);
    const getWeightForSize = helpers.getWeightForSize || (() => '0,25');
    const buildProductTitle = helpers.buildProductTitle || ((...args) => args.join(' '));

    const codeGroup = code._groupId ? getGroupById(code._groupId) : getFirstGroup();
    const codeProductType = code.productType || (codeGroup ? codeGroup.productType : 'Unique');
    
    const urls = (state.imageUrls[codeKey] || '').trim();
    const ncm = '6101.30.00'; // Default NCM
    const marca = state.brand || '';
    const preco = state.price || '0';

    const estampa = (state.estampas[code.base] && state.estampas[code.base].trim()) || 
                    (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim()) || 
                    '*ESTAMPA A SER DEFINIDA';

    const titulo = buildProductTitle(codeProductType, marca, estampa, g);

    // Parent row
    rows.push({
      _isParent: true,
      _gender: g,
      codigo: codeKey,
      descricao: titulo,
      ncm,
      preco,
      marca,
      estoque: '0',
      pesoLiq: getWeightForSize(codeProductType, g, 'default'),
      pesoBruto: getWeightForSize(codeProductType, g, 'default'),
      ean: '',
      eanEmb: '',
      codigoPai: '',
      produtoVariacao: 'Produto',
      imagens: urls,
      tamanho: '',
    });

    // Single child row for Unique product
    rows.push({
      _isParent: false,
      _gender: g,
      codigo: codeKey,
      descricao: `Tamanho:Único`,
      ncm,
      preco,
      marca,
      estoque: '1000',
      pesoLiq: getWeightForSize(codeProductType, g, ''),
      pesoBruto: getWeightForSize(codeProductType, g, ''),
      ean: '',
      eanEmb: '',
      codigoPai: codeKey,
      produtoVariacao: 'Variação',
      imagens: urls,
      tamanho: '',
    });

    return rows;
  }
  
  /**
   * Render link cards for a Unique product.
   * Simplified version without gender tabs, since it's just a single product line.
   */
  function renderUniqueLinkCards(code, group, helpers) {
    const state = helpers.state || {};
    const esc = helpers.esc || (str => str);
    const TIFFANY = helpers.TIFFANY || '#7F00FF';
    const TIFFANY_D = helpers.TIFFANY_D || '#09a09c';
    const codeIdx = typeof helpers.codeIdx !== 'undefined' ? helpers.codeIdx : (code._index || 0);

    const codeKey = code.base;
    const url = (state.imageUrls && state.imageUrls[codeKey]) ? state.imageUrls[codeKey] : '';
    const isDone = url.trim().length > 0;

    const hasFolderData = !!(state.diskFolderPath && state.diskFolderPath.trim());
    const knownFolders = new Set(
      (state.diskScanResult && state.diskScanResult.folderNames) 
        ? state.diskScanResult.folderNames.map(n => n.toUpperCase()) 
        : []
    );
    const hasImages = hasFolderData && knownFolders.has(code.base.toUpperCase());
    const imgCount = hasImages ? '✓' : 0;

    let html = `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${esc(code.base)}" ${isDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${isDone ? TIFFANY_D : '#4b5563'};transition:border-color .3s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${esc(code.base)}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(168,85,247,0.15);color:#a855f7;font-weight:600">Produto Único</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${hasImages && !isDone ? `
          <button class="btn btn--secondary ap-upload-single-btn" data-base="${esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:${TIFFANY};border-color:${TIFFANY}40">
            🚀 Gerar
          </button>` : ''}
          ${isDone ? `
          <button class="btn btn--secondary ap-clear-code-links" data-base="${esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste código">
            🗑️
          </button>` : ''}
          <span style="font-size:12px;font-weight:600;color:${isDone ? TIFFANY : '#f59e0b'}">
            ${isDone ? '✅ Completo' : '⏳ Pendente'}
          </span>
        </div>
      </div>

      <div class="ap-gender-row" data-gender-code="${esc(codeKey)}" style="padding:12px;background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge" style="background:rgba(168,85,247,0.25);color:#a855f7;font-size:11px;padding:3px 10px;border-radius:6px">Único</span>
            <span class="ap-gender-status" style="font-size:12px;color:${isDone ? TIFFANY : '#6b7280'}">
              ${isDone ? '✅' : '⏳'}
            </span>
            ${imgCount ? `<span style="font-size:11px;color:${TIFFANY}">📂 Imagens detectadas</span>` : ''}
          </div>
        </div>

        <input type="text" class="form-input ap-link-input"
          data-code="${esc(codeKey)}" data-base="${esc(code.base)}" data-gender="masc" data-idx="${codeIdx}"
          value="${esc(url)}"
          placeholder="${hasImages ? 'Imagens prontas para upload automático' : 'Cole aqui o link de Imagens...'}"
          style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

        <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
          → Aplica em: <span style="color:#6b7280">${esc(codeKey)}</span>
        </div>
      </div>
    </div>`;

    return html;
  }
  
  modules.Unique = {
    buildCsvRows: buildUniqueCsvRows,
    renderLinkCards: renderUniqueLinkCards,
  };
})(window.AutopilotModules = window.AutopilotModules || {});
