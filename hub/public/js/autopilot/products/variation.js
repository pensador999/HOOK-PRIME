(function(modules) {
  // NCM por gênero
  const NCM_GENDER = {
    masc: '6101.30.00',
    fem:  '6102.30.00',
    inf:  '6101.30.00',
  };

  function buildVariationCsvRows(code, state, helpers) {
    const { getGroupById, getFirstGroup, activeGenders, sizesFor, buildProductTitle, getWeightForSize } = helpers;
    const rows = [];

    const codeGroup = code._groupId ? getGroupById(code._groupId) : getFirstGroup();
    const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
    genders.forEach(g => {
      const codeKey = code[g]; // C02759, C02759BL, C02759I
      if (!codeKey) return;

      const sizes  = sizesFor(g, code.productType || getFirstGroup().productType);
      const urls   = (state.imageUrls[codeKey] || '').trim();
      const ncm    = NCM_GENDER[g] || '6101.30.00';
      const marca  = state.brand || '';

      // #2 Preço por gênero — INF sempre usa priceInf (129,90)
      let preco = state.price || '0';
      if (g === 'inf' && state.priceInf) {
        preco = state.priceInf; // Infantil sempre 129,90
      } else if (state.pricePerGender) {
        if (g === 'fem' && state.priceFem) preco = state.priceFem;
      }

      // Get estampa from the code's group
      const estampa = (state.estampas[code.base] && state.estampas[code.base].trim()) || (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim()) || '*ESTAMPA A SER DEFINIDA';
      const codeProductType = code.productType || getFirstGroup().productType;

      // Use buildProductTitle for correct type-based titles
      const titulo = buildProductTitle(codeProductType, marca, estampa, g);

      // ─── Produto (linha PAI) ───
      rows.push({
        _isParent: true,
        _gender: g,
        codigo: codeKey,
        descricao: titulo,
        ncm,
        preco,
        marca,
        estoque: '0',    // PAI estoque = 0
        pesoLiq: getWeightForSize(codeProductType, g, 'default'),
        pesoBruto: getWeightForSize(codeProductType, g, 'default'),
        ean: '',
        eanEmb: '',
        codigoPai: '',   // PAI não tem código pai
        produtoVariacao: 'Produto',
        imagens: urls,
        tamanho: '',
      });

      // ─── Variações (linha FILHA por tamanho) ───
      sizes.forEach(size => {
        rows.push({
          _isParent: false,
          _gender: g,
          codigo: `${codeKey}${size}`,  // SEM traço: C02820PP
          descricao: `Tamanho:${size || 'Único'}`,
          ncm,
          preco,
          marca,
          estoque: '1000',
          pesoLiq: getWeightForSize(codeProductType, g, size),
          pesoBruto: getWeightForSize(codeProductType, g, size),
          ean: '',        // Vazio — usuário preenche manualmente
          eanEmb: '',     // Vazio — usuário preenche manualmente
          codigoPai: codeKey,
          produtoVariacao: 'Variação',
          imagens: urls,  // IMAGENS EM TODAS AS LINHAS
          tamanho: size,
        });
      });
    });

    return rows;
  }

  function renderVariationLinkCards(code, group, helpers) {
    const { 
      state, filter, codeIdx, hasFolderData, knownFolders, 
      activeGenders, sizesFor, esc, genderColor, genderLabel, 
      TIFFANY, TIFFANY_D 
    } = helpers;

    let html = '';
    const gendersList = group ? activeGenders(group) : ['masc'];
    const isCodeDone = gendersList.every(g => {
      if (!code[g]) return true;
      const url = state.imageUrls[code[g]];
      return url && url.trim();
    });

    if (filter === 'pending' && isCodeDone) return '';
    if (filter === 'done' && !isCodeDone) return '';

    const hasImages = hasFolderData && knownFolders.has(code.base.toUpperCase());

    html += `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${esc(code.base)}" ${isCodeDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${isCodeDone ? TIFFANY_D : '#4b5563'};transition:border-color .3s">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${esc(code.base)}</span>
          <span style="font-size:12px;color:#6b7280">#${codeIdx + 1} de ${state.generatedCodes.length}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${hasImages && !isCodeDone ? `
          <button class="btn btn--secondary ap-upload-single-btn" data-base="${esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:${TIFFANY};border-color:${TIFFANY}40">
            🚀 Gerar
          </button>` : ''}
          ${isCodeDone ? `
          <button class="btn btn--secondary ap-clear-code-links" data-base="${esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste código">
            🗑️
          </button>` : ''}
          <span style="font-size:12px;font-weight:600;color:${isCodeDone ? TIFFANY : '#f59e0b'}">
            ${isCodeDone ? '✅ Completo' : '⏳ Pendente'}
          </span>
        </div>
      </div>`;

    gendersList.forEach(g => {
      if (!code[g]) return;

      const codeKey = code[g];
      const url = state.imageUrls[codeKey] || '';
      const isDone = url.trim().length > 0;
      const imgCount = hasImages ? '✓' : 0;

      const sizes = sizesFor(g, code.productType);
      const appliesToCodes = [codeKey, ...sizes.map(s => codeKey + s)];
      const appliesTo = appliesToCodes.join(', ');

      html += `<div class="ap-gender-row" data-gender-code="${esc(codeKey)}" style="padding:12px;margin-bottom:${g !== gendersList[gendersList.length - 1] ? '10px' : '0'};background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge" style="background:${genderColor(g)}25;color:${genderColor(g)};font-size:11px;padding:3px 10px;border-radius:6px">${genderLabel(g)}</span>
            <span class="ap-gender-status" style="font-size:12px;color:${isDone ? TIFFANY : '#6b7280'}">
              ${isDone ? '✅' : '⏳'}
            </span>
            ${imgCount ? `<span style="font-size:11px;color:${TIFFANY}">📂 Imagens detectadas</span>` : ''}
          </div>
        </div>

        <input type="text" class="form-input ap-link-input"
          data-code="${esc(codeKey)}" data-base="${esc(code.base)}" data-gender="${g}" data-idx="${codeIdx}"
          value="${esc(url)}"
          placeholder="${hasImages ? 'Imagens prontas para upload automático' : 'Cole aqui o link de Imagens ' + genderLabel(g) + '...'}"
          style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

        <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
          → Aplica em: <span style="color:#6b7280">${esc(appliesTo)}</span>
        </div>
      </div>`;
    });

    html += '</div>';

    return html;
  }

  async function uploadVariationImages(baseCode, gender, helpers) {
    const { state, uploadFromDisk } = helpers || {};
    const folderPath = state ? state.diskFolderPath : window.AutopilotState.diskFolderPath;
    const uploader = uploadFromDisk || window.uploadFromDisk;
    
    console.log(`[UPLOAD] ${baseCode}/${gender} — iniciando...`);
    console.log(`[UPLOAD] folderPath="${folderPath}", codeBase="${baseCode}", gender="${gender}"`);

    if (!folderPath || !folderPath.trim()) {
      throw new Error(`Caminho da pasta não configurado. Volte à Etapa 2 e informe o caminho.`);
    }

    return await uploader(baseCode, gender, folderPath.trim());
  }

  modules.Variation = {
    buildCsvRows: buildVariationCsvRows,
    renderLinkCards: renderVariationLinkCards,
    uploadImages: uploadVariationImages,
  };
})(window.AutopilotModules = window.AutopilotModules || {});
