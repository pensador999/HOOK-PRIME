(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const H = window.AutopilotModules.Helpers;
  const Registry = window.AutopilotModules.Registry;

  // ───────── Step 5: Planilha Final ─────────

  function renderStep4() {
    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- EAN Section -->
      <div style="padding:16px;background:rgba(170, 255, 0,.06);border:1px solid rgba(170, 255, 0,.12);border-radius:8px;margin-bottom:20px"><small style="color:#9ca3af">ℹ️ EANs não são necessários. As colunas EAN/EAN Emb. serão exportadas vazias no CSV.</small></div>

      <!-- CSV Preview -->
      <div class="card" style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;color:${State.TIFFANY}">📄 Preview da Planilha</h3>
          <button class="btn btn--secondary" id="ap-generate-preview" style="font-size:13px">🔄 Gerar Preview</button>
        </div>
        <div id="ap-csv-preview" style="overflow-x:auto;max-height:420px;overflow-y:auto">
          ${State.state.csvRows.length ? renderCsvTable() : '<p style="color:#6b7280;text-align:center;padding:32px">Clique em "Gerar Preview" para visualizar a planilha</p>'}
        </div>
      </div>

      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px">
        <button class="btn btn--secondary" id="ap-prev-4">← Voltar</button>
        <button class="btn btn--primary" id="ap-next-4" style="min-width:180px">Próximo Passo →</button>
      </div>
    </div>`;

    return html;
  }

  function buildCsvRows() {
    const rows = [];

    const hasAPC = State.state.generatedCodes.some(c => c._isAPC);
    const hasNormal = State.state.generatedCodes.some(c => !c._isAPC);

    if (hasAPC) {
      // ═══════════════════════════════════════
      // APC — Padrão APC0541 / APC0541BL
      // MASC = código base (APC0541) + variações
      // FEM  = código base + BL (APC0541BL) + variações
      // Cada bloco: PAI + variações (cor × tamanho)
      // ═══════════════════════════════════════
      const defaultColors = H.activeApcColors();
      const ncm = '6205.20.00';
      const marca = State.state.brand || 'BRK FISHING';
      const preco = State.state.price || '0';

      const GENDER_SUFFIX = { masc: '', fem: 'BL' };

      let apcIndex = 0;
      State.state.generatedCodes.forEach((code) => {
        if (!code._isAPC) return;
        const codeGroup = code._groupId ? State.getGroupById(code._groupId) : State.getFirstGroup();
        const codeColors = codeGroup ? H.activeApcColors(codeGroup) : defaultColors;
        const genders = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
        const prefix = codeGroup && codeGroup.apcPrefix && codeGroup.apcPrefix.trim()
          ? codeGroup.apcPrefix.trim().toUpperCase() : 'PREMIUM';
        const estampa = (State.state.estampas[code.base] && State.state.estampas[code.base].trim())
          || (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim())
          || '*ESTAMPA A SER DEFINIDA';
        const baseCode = code.base;

        // Gerar um bloco para cada gênero
        genders.forEach((g, gIdx) => {
          const genderKey = g === 'masc' ? 'MASC' : 'FEM';
          const suffix = GENDER_SUFFIX[g] || '';
          const parentCode = baseCode + suffix; // APC0541 ou APC0541BL
          const sizes = H.sizesFor(g, 'APC');

          // Separador entre blocos
          if (apcIndex > 0) {
            rows.push({ _isEmpty: true });
          }

          const titulo = Registry.buildProductTitle('APC', marca, estampa, g);

          // URLs do PAI: imagens da primeira cor deste gênero
          const firstColor = codeColors[0] || 'Preto';
          const paiUrls = (
            State.state.imageUrls[`${baseCode}_${genderKey}_${firstColor}`] ||
            State.state.imageUrls[`${baseCode}_${firstColor}`] || // fallback legado
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
            produtoVariacao: 'Produto',
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
              State.state.imageUrls[`${baseCode}_${genderKey}_${cor}`] ||
              State.state.imageUrls[`${baseCode}_${cor}`] || // fallback legado
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

          apcIndex++;
        });
      });

    }

    if (hasNormal) {
      // ═══════════════════════════════════════
      // Produtos normais + Únicos
      // ═══════════════════════════════════════

      // NCM por gênero (para camisas/variação)
      const NCM_GENDER = {
        masc: '6101.30.00',
        fem:  '6102.30.00',
        inf:  '6101.30.00',
      };

      const Unique = window.AutopilotModules.Unique;

      State.state.generatedCodes.forEach(code => {
        if (code._isAPC) return; // Skip APC codes — handled above
        const codeGroup = code._groupId ? State.getGroupById(code._groupId) : State.getFirstGroup();
        const codeProductType = code.productType || State.getFirstGroup().productType;

        // ═══════════════════════════════════════
        // PRODUTOS ÚNICOS (Lenço, Tubeneck, Bandana, BlackMask, etc.)
        // → Uma única linha por código, sem PAI+FILHO
        // ═══════════════════════════════════════
        if (Registry.isUniqueProduct(codeProductType) && Unique) {
          const uniqueRows = Unique.buildCsvRows(code, State.state, {
            getGroupById: State.getGroupById,
            getFirstGroup: State.getFirstGroup,
            buildProductTitle: Registry.buildProductTitle,
          });
          rows.push(...uniqueRows);
          return;
        }

        // ═══════════════════════════════════════
        // PRODUTOS COM VARIAÇÃO (Raglan, Camisa UV, etc.)
        // → PAI + FILHOS por tamanho
        // ═══════════════════════════════════════
        const genders = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
        genders.forEach(g => {
          const codeKey = code[g]; // C02759, C02759BL, C02759I
          if (!codeKey) return;

          const sizes  = H.sizesFor(g, codeProductType);
          const urls   = (State.state.imageUrls[codeKey] || '').trim();
          const ncm    = NCM_GENDER[g] || '6101.30.00';
          const marca  = State.state.brand || '';

          // #2 Preço por gênero — INF sempre usa priceInf (129,90)
          let preco = State.state.price || '0';
          if (g === 'inf' && State.state.priceInf) {
            preco = State.state.priceInf; // Infantil sempre 129,90
          } else if (State.state.pricePerGender) {
            if (g === 'fem' && State.state.priceFem) preco = State.state.priceFem;
          }

          // Get estampa from the code's group (codeGroup already defined above)
          const estampa = (State.state.estampas[code.base] && State.state.estampas[code.base].trim()) || (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim()) || '*ESTAMPA A SER DEFINIDA';

          // Use buildProductTitle for correct type-based titles
          const titulo = Registry.buildProductTitle(codeProductType, marca, estampa, g);

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
            pesoLiq: H.getWeightForSize(codeProductType, g, 'default'),
            pesoBruto: H.getWeightForSize(codeProductType, g, 'default'),
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
              pesoLiq: H.getWeightForSize(codeProductType, g, size),
              pesoBruto: H.getWeightForSize(codeProductType, g, size),
              ean: '',        // Vazio — usuário preenche manualmente
              eanEmb: '',     // Vazio — usuário preenche manualmente
              codigoPai: codeKey,
              produtoVariacao: 'Variação',
              imagens: urls,  // IMAGENS EM TODAS AS LINHAS
              tamanho: size,
            });
          });
        });
      });
    }

    return rows;
  }

  let showFullPreview = false;

  function renderCsvTable() {
    if (!State.state.csvRows.length) return '';

    // #7 Compact vs Full preview
    const compactCols = ['produtoVariacao', 'codigo', 'descricao', 'codigoPai', 'estoque', 'pesoBruto', 'preco', 'marca', 'imagens'];
    const fullCols = ['produtoVariacao', 'codigo', 'descricao', 'ncm', 'codigoPai', 'estoque', 'pesoLiq', 'pesoBruto', 'preco', 'marca', 'ean', 'eanEmb', 'imagens', 'tamanho'];

    const cols = showFullPreview ? fullCols : compactCols;
    const colLabels = {
      produtoVariacao: 'Tipo', codigo: 'Código', descricao: 'Descrição', ncm: 'NCM',
      codigoPai: 'Cód. Pai', estoque: 'Estoque', pesoLiq: 'Peso Líq.', pesoBruto: 'Peso Bruto',
      preco: 'Preço', marca: 'Marca', ean: 'EAN', eanEmb: 'EAN Emb.', imagens: 'Imagens', tamanho: 'Tamanho',
    };

    let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn--secondary" id="ap-toggle-preview" style="font-size:11px;padding:4px 12px">
        ${showFullPreview ? '📋 Compacto' : `📊 Ver Completo (${fullCols.length} colunas)`}
      </button>
    </div>`;

    html += '<div style="overflow-x:auto;max-width:100%">';
    html += '<table class="table" style="font-size:12px;width:100%"><thead><tr>';
    cols.forEach(c => { html += `<th style="white-space:nowrap;padding:8px 10px">${colLabels[c] || c}</th>`; });
    html += '</tr></thead><tbody>';

    State.state.csvRows.forEach((row, idx) => {
      if (row._isEmpty) {
        html += `<tr style="height:6px;background:transparent"><td colspan="${cols.length}"></td></tr>`;
        return;
      }
      const bg = row._isParent ? `background:${State.TIFFANY}08` : '';
      html += `<tr style="${bg}">`;
      cols.forEach(c => {
        let val = row[c] || '';
        if (c === 'imagens' && val.length > 20) val = '✅ ' + val.split('|').length + ' link(s)';
        else if (c === 'imagens' && !val) val = '—';
        const style = c === 'descricao' ? 'max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' : 'white-space:nowrap';
        html += `<td style="padding:6px 10px;${style}" title="${H.esc(row[c] || '')}">${H.esc(val)}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function bindStep4(deps) {
    const { goToStep, validateAndAdvance } = deps;
    const genBtn = document.getElementById('ap-generate-preview');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        State.state.csvRows = buildCsvRows();
        const preview = document.getElementById('ap-csv-preview');
        if (preview) {
          preview.innerHTML = renderCsvTable();
          bindPreviewToggle(preview);
        }
        if (State.state.csvRows.length) {
          window.HUB.showToast(`Preview gerado: ${State.state.csvRows.length} linhas`, 'success');
        }
      });
    }

    // #7 toggle on initial render
    bindPreviewToggle(document.getElementById('ap-csv-preview'));

    const prevBtn = document.getElementById('ap-prev-4');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(4));

    const nextBtn = document.getElementById('ap-next-4');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(5));
  }

  function bindPreviewToggle(previewEl) {
    const toggleBtn = document.getElementById('ap-toggle-preview');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        showFullPreview = !showFullPreview;
        if (previewEl) {
          previewEl.innerHTML = renderCsvTable();
          bindPreviewToggle(previewEl);
        }
      });
    }
  }

  window.AutopilotModules.Step5 = { render: renderStep4, buildCsvRows, renderCsvTable, bind: bindStep4, bindPreviewToggle };
})();