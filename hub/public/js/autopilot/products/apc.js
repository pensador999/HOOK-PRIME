(function(modules) {
  // Helper to get shared dependencies
  function getCore() { return modules.Core || {}; }
  function getRegistry() { return modules.Registry || {}; }

  /**
   * APC CSV rows builder
   */
  function buildApcCsvRows(code, state, helpers) {
    const {
      activeApcColors,
      activeGenders,
      getGroupById,
      getFirstGroup,
      sizesFor,
      buildProductTitle
    } = helpers;

    const defaultColors = activeApcColors();
    const ncm = '6205.20.00';
    const marca = state.brand || 'BRK FISHING';
    const preco = state.price || '0';

    const GENDER_SUFFIX = { masc: '', fem: 'BL' };

    const codeGroup = code._groupId ? getGroupById(code._groupId) : getFirstGroup();
    const codeColors = codeGroup ? activeApcColors(codeGroup) : defaultColors;
    const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
    const prefix = codeGroup && codeGroup.apcPrefix && codeGroup.apcPrefix.trim()
      ? codeGroup.apcPrefix.trim().toUpperCase() : 'PREMIUM';
    const estampa = (state.estampas && state.estampas[code.base] && state.estampas[code.base].trim())
      || (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim())
      || '*ESTAMPA A SER DEFINIDA';
    const baseCode = code.base;

    const rows = [];

    // Gerar um bloco para cada gênero
    genders.forEach((g, gIdx) => {
      const genderKey = g === 'masc' ? 'MASC' : 'FEM';
      const suffix = GENDER_SUFFIX[g] || '';
      const parentCode = baseCode + suffix; // APC0541 ou APC0541BL
      const sizes = sizesFor(g, 'APC');

      const titulo = buildProductTitle('APC', marca, estampa, g);

      // URLs do PAI: imagens da primeira cor deste gênero
      const firstColor = codeColors[0] || 'Preto';
      const paiUrls = (
        state.imageUrls[`${baseCode}_${genderKey}_${firstColor}`] ||
        state.imageUrls[`${baseCode}_${firstColor}`] || // fallback legado
        ''
      ).trim();

      // ─── Linha PAI ───
      rows.push({
        _isParent: true,
        _gender: g,
        _isAPC: true,
        _apcColor: firstColor,
        codigo: parentCode,
        descricao: titulo,
        ncm,
        preco,
        marca,
        estoque: '0',
        pesoLiq: '0,25',
        pesoBruto: '0,25',
        ean: '',
        eanEmb: '',
        codigoPai: '',
        produtoVariacao: 'Variação',
        imagens: paiUrls,
        tamanho: '',
        grupoProdutos: '',
        largura: '22',
        altura: '4',
        profundidade: '30',
      });

      // ─── Variações (cor × tamanho) ───
      codeColors.forEach(cor => {
        const corDesc = { Preto: 'Preto', Branco: 'Branco', Bege: 'Bege' }[cor] || cor;
        const corCode = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();
        const colorUrls = (
          state.imageUrls[`${baseCode}_${genderKey}_${cor}`] ||
          state.imageUrls[`${baseCode}_${cor}`] || // fallback legado
          ''
        ).trim();

        sizes.forEach(size => {
          const varCode = `${parentCode}-${prefix}-${corCode}-${size}`;

          rows.push({
            _isParent: false,
            _gender: g,
            _isAPC: true,
            _apcColor: cor,
            codigo: varCode,
            descricao: `Cor:${corDesc};Tamanho:${size}`,
            ncm,
            preco,
            marca,
            estoque: '0',
            pesoLiq: '0,25',
            pesoBruto: '0,25',
            ean: '',
            eanEmb: '',
            codigoPai: parentCode,
            produtoVariacao: 'Variação',
            imagens: colorUrls,
            tamanho: size,
            grupoProdutos: '',
            largura: '22',
            altura: '4',
            profundidade: '30',
          });
        });
      });
    });

    return rows;
  }

  /**
   * APC link cards renderer
   */
  function renderApcLinkCards(code, group, helpers) {
    const {
      activeApcColors,
      activeGenders,
      sizesFor,
      esc,
      state,
      filter,
      knownFolders,
      hasFolderData,
      codeIdx
    } = helpers;

    const Registry = getRegistry();
    const APC_COLORS = Registry.APC_COLORS || ['Preto', 'Branco'];
    const APC_COLOR_CSS = Registry.APC_COLOR_CSS || {};
    const TIFFANY = Registry.TIFFANY || '#7F00FF';
    const TIFFANY_D = Registry.TIFFANY_D || '#089994';

    let html = '';
    const codeGroup = group;

    const colors = codeGroup ? activeApcColors(codeGroup) : APC_COLORS;
    const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
    // Map gender to code suffix and display label
    const GENDER_INFO = {
      masc: { suffix: '',   label: 'MASCULINO', icon: '👔', color: '#3b82f6' },
      fem:  { suffix: 'BL', label: 'FEMININO',  icon: '👗', color: '#ec4899' },
    };

    // Calculate total slots (genders × colors)
    const totalSlots = genders.length * colors.length;
    let doneSlots = 0;
    genders.forEach(g => {
      colors.forEach(cor => {
        const u = state.imageUrls[`${code.base}_${g === 'masc' ? 'MASC' : 'FEM'}_${cor}`];
        if (u && u.trim()) doneSlots++;
      });
    });
    const isCodeDone = doneSlots === totalSlots;

    if (filter === 'pending' && isCodeDone) return '';
    if (filter === 'done' && !isCodeDone) return '';

    const hasImages = hasFolderData && knownFolders && knownFolders.has(code.base.toUpperCase());

    // Generate a card for each gender (MASC, FEM)
    genders.forEach((g, gIdx) => {
      const info = GENDER_INFO[g] || GENDER_INFO.masc;
      const genderKey = g === 'masc' ? 'MASC' : 'FEM';
      const codeWithSuffix = code.base + info.suffix; // APC0541 or APC0541BL

      // Check if this gender block is done
      const genderDone = colors.every(cor => {
        const u = state.imageUrls[`${code.base}_${genderKey}_${cor}`];
        return u && u.trim();
      });
      const genderDoneCount = colors.filter(cor => {
        const u = state.imageUrls[`${code.base}_${genderKey}_${cor}`];
        return u && u.trim();
      }).length;

      html += `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${esc(code.base)}" data-is-apc="true" data-apc-gender="${genderKey}" ${genderDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${genderDone ? TIFFANY_D : info.color + '80'};transition:border-color .3s;${gIdx > 0 ? 'margin-top:8px' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${esc(codeWithSuffix)}</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(212,165,116,0.15);color:#d4a574;font-weight:600">APC</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${info.color}20;color:${info.color};font-weight:600">${info.icon} ${info.label}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${hasImages && !genderDone ? `
            <button class="btn btn--secondary ap-upload-single-btn" data-base="${esc(code.base)}" data-idx="${codeIdx}" data-apc-gender="${genderKey}" style="font-size:11px;padding:4px 12px;color:${TIFFANY};border-color:${TIFFANY}40">
              🚀 Gerar
            </button>` : ''}
            ${genderDone ? `
            <button class="btn btn--secondary ap-clear-code-links" data-base="${esc(code.base)}" data-idx="${codeIdx}" data-apc-gender="${genderKey}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste bloco">
              🗑️
            </button>` : ''}
            <span style="font-size:12px;font-weight:600;color:${genderDone ? TIFFANY : '#f59e0b'}">
              ${genderDone ? '✅ Completo' : `⏳ ${genderDoneCount}/${colors.length}`}
            </span>
          </div>
        </div>`;

      // Uma row por COR dentro deste gênero
      colors.forEach((cor, corIdx) => {
        const urlKey = `${code.base}_${genderKey}_${cor}`;
        const url = state.imageUrls[urlKey] || '';
        const isDone = url.trim().length > 0;
        const colorCss = APC_COLOR_CSS[cor] || '#6b7280';
        const colorIcon = { Preto: '⬛', Branco: '⬜', Bege: '🟫' }[cor] || '🔲';
        const corDesc = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();

        const prefix = codeGroup && codeGroup.apcPrefix && codeGroup.apcPrefix.trim()
          ? codeGroup.apcPrefix.trim().toUpperCase() : 'PREMIUM';
        const sizes = sizesFor(g, code.productType);
        const sampleCodes = sizes.slice(0, 3).map(s => `${codeWithSuffix}-${prefix}-${corDesc}-${s}`);
        const appliesTo = sampleCodes.join(', ') + (sizes.length > 3 ? `, +${sizes.length - 3}` : '');

        html += `<div class="ap-gender-row ap-color-row" data-gender-code="${esc(urlKey)}" data-apc-color="${esc(cor)}" data-apc-gender="${genderKey}" style="padding:12px;margin-bottom:${corIdx < colors.length - 1 ? '10px' : '0'};background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge" style="background:${colorCss}25;color:${colorCss};font-size:12px;padding:4px 12px;border-radius:6px;font-weight:700;letter-spacing:.5px">${colorIcon} ${cor.toUpperCase()}</span>
              <span class="ap-gender-status" style="font-size:12px;color:${isDone ? TIFFANY : '#6b7280'}">
                ${isDone ? '✅' : '⏳'}
              </span>
            </div>
          </div>

          <input type="text" class="form-input ap-link-input"
            data-code="${esc(urlKey)}" data-base="${esc(code.base)}" data-gender="${g}" data-apc-color="${esc(cor)}" data-apc-gender="${genderKey}" data-idx="${codeIdx}"
            value="${esc(url)}"
            placeholder="${hasImages ? `Imagens ${info.label} ${cor} prontas para upload` : `Cole link ${info.label} ${cor}...`}"
            style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

          <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
            → Aplica em: <span style="color:#6b7280">${esc(appliesTo)}</span>
          </div>
        </div>`;
      });

      html += '</div>';
    });

    return html;
  }

  /**
   * Upload de imagens APC por COR.
   */
  async function uploadApcColorImages(baseCode, color, genderKey, helpers) {
    const state = helpers.state;
    const folderPath = state.diskFolderPath;
    if (!folderPath || !folderPath.trim()) {
      throw new Error(`Caminho da pasta não configurado.`);
    }

    const VARIANT_MAP = { Preto: 'PRETA', Branco: 'BRANCA', Bege: 'BEGE' };
    const variant = VARIANT_MAP[color] || color.toUpperCase();
    const basePath = folderPath.trim();
    const allUrls = [];

    // Determine which gender folder to look in
    const gender = genderKey || 'MASC';
    const colorFolder = `${basePath}/${baseCode}/${gender}/${variant}`.replace(/\//g, '\\');
    const collectionId = `${baseCode}_${gender}_${variant}`;

    console.log(`[APC UPLOAD] Tentando: ${colorFolder} → ${collectionId}`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      const response = await fetch('/api/s3-proxy/upload-from-folder-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: colorFolder, collectionId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.urls && data.urls.length > 0) {
        allUrls.push(...data.urls);
        console.log(`[APC UPLOAD] ✅ ${collectionId}: ${data.urls.length} URLs`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[APC UPLOAD] Timeout: ${collectionId}`);
      } else {
        // Fallback: try direct folder baseCode/VARIANT (sem MASC/FEM)
        console.log(`[APC UPLOAD] ${collectionId} falhou, tentando fallback...`);
        try {
          const directFolder = `${basePath}/${baseCode}/${variant}`.replace(/\//g, '\\');
          const fbId = `${baseCode}_${variant}`;
          const response = await fetch('/api/s3-proxy/upload-from-folder-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: directFolder, collectionId: fbId }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.urls && data.urls.length > 0) {
              allUrls.push(...data.urls);
              console.log(`[APC UPLOAD] ✅ Fallback ${fbId}: ${data.urls.length} URLs`);
            }
          }
        } catch (fbErr) {
          console.log(`[APC UPLOAD] Fallback erro: ${fbErr.message}`);
        }
      }
    }

    if (allUrls.length === 0) {
      throw new Error(`Nenhuma imagem encontrada para ${baseCode} ${gender}/${variant}`);
    }

    return allUrls.map(u => u.trim()).join(' | ');
  }

  /**
   * APC done check (allSlotsDone / blockDone logic)
   */
  function checkApcBlockDone(code, job, state, helpers, document) {
    const { getGroupById, activeApcColors } = helpers;
    const Registry = getRegistry();
    const APC_COLORS = Registry.APC_COLORS || ['Preto', 'Branco'];
    const TIFFANY_D = Registry.TIFFANY_D || '#089994';

    const currentGroup = getGroupById(code._groupId);
    const gk = job.apcGenderKey || 'MASC';
    const codeColors = currentGroup ? activeApcColors(currentGroup) : APC_COLORS;

    const blockDone = codeColors.every(c => {
      const u = state.imageUrls[`${code.base}_${gk}_${c}`];
      return u && u.trim();
    });

    if (document) {
      const genderCard = document.querySelector(`.ap-link-code-card[data-base="${code.base}"][data-apc-gender="${gk}"]`);
      if (blockDone && genderCard) {
        genderCard.classList.remove('ap-uploading-card');
        genderCard.style.borderLeftColor = TIFFANY_D;
        genderCard.setAttribute('data-done', 'true');
      }
    }
    
    return blockDone;
  }

  modules.APC = {
    buildCsvRows: buildApcCsvRows,
    renderLinkCards: renderApcLinkCards,
    uploadImages: uploadApcColorImages,
    checkBlockDone: checkApcBlockDone
  };
})(window.AutopilotModules = window.AutopilotModules || {});
