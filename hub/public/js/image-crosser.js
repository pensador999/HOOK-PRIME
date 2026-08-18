/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Cruzador de Imagens
   Cruza automaticamente imagens com títulos de produtos da planilha
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const LIME = '#84cc16';

  // Estado do módulo
  const crosserState = {
    step: 1,
    products: [],       // { code, title, gender, sleeve, model, color, parentCode, hasUrls, rowIndex }
    imageFolders: [],   // { path, name, tokens, subfolders: ['MC','ML'], imageCount }
    matches: [],        // { product, folder, score, sleeve, confirmed }
    uploadResults: {},  // { code: 'url1|url2|...' }
    xlsFile: null,      // File object da planilha
    xlsData: null,      // raw parsed data
    rootFolderFiles: null, // File objects
  };

  function esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  // ═══════════════════════════════════════════════════════════
  // PARSING: Extrair dados da planilha
  // ═══════════════════════════════════════════════════════════

  // Sinônimos de modelo → estilo da estampa
  // CLASSIC = Lisa | RANCH = Xadrez Grande | WESTERN = Xadrez Pequeno
  const MODEL_SYNONYMS = {
    CLASSIC: ['CLASSIC', 'LISA', 'LISO', 'LISAS'],
    RANCH:   ['RANCH', 'XADREZ GRANDE', 'XADREZ_GRANDE'],
    WESTERN: ['WESTERN', 'XADREZ PEQUENO', 'XADREZ_PEQUENO'],
  };

  // ═══════════════════════════════════════════════════════════
  // TEORIA DAS CORES: Famílias de cores para matching inteligente
  // Cores na mesma família recebem score 0.75 mesmo sem match Levenshtein
  // ═══════════════════════════════════════════════════════════
  const COLOR_FAMILIES = {
    // 🟡 Amarelos / Dourados / Tons quentes claros
    AMARELO: 'YELLOW', AMARELA: 'YELLOW', MANTEIGA: 'YELLOW', TRIGO: 'YELLOW',
    DOURADO: 'YELLOW', DOURADA: 'YELLOW', OURO: 'YELLOW', MOSTARDA: 'YELLOW',
    MEL: 'YELLOW', CANARIO: 'YELLOW', PALHA: 'YELLOW', GIRASSOL: 'YELLOW',
    CURRY: 'YELLOW', CAMURCA: 'YELLOW',

    // 🔵 Azuis
    AZUL: 'BLUE', MARINHO: 'BLUE', PETROLEO: 'BLUE', CELESTE: 'BLUE',
    ROYAL: 'BLUE', TURQUESA: 'BLUE', INDIGO: 'BLUE', NAVY: 'BLUE',
    COBALTO: 'BLUE', SAFIRA: 'BLUE', JEANS: 'BLUE',

    // 🟢 Verdes
    VERDE: 'GREEN', MILITAR: 'GREEN', MUSGO: 'GREEN', OLIVA: 'GREEN',
    AVENTURA: 'GREEN', FLORESTA: 'GREEN', BANDEIRA: 'GREEN', ESMERALDA: 'GREEN',
    MENTA: 'GREEN', LIMA: 'GREEN', SELVA: 'GREEN', PISTACHE: 'GREEN',

    // 🔴 Vermelhos
    VERMELHO: 'RED', VERMELHA: 'RED', VINHO: 'RED', BORDO: 'RED',
    CARMESIM: 'RED', RUBI: 'RED', CEREJA: 'RED', SANGUE: 'RED',
    TOMATE: 'RED', GRENA: 'RED', FERRARI: 'RED',

    // ⚫ Escuros / Pretos / Carvão
    PRETO: 'DARK', PRETA: 'DARK', CHUMBO: 'DARK', CARVAO: 'DARK',
    NOITE: 'DARK', ONIX: 'DARK', EBANO: 'DARK', NEGRO: 'DARK',
    GRAFITE: 'DARK',

    // ⚪ Claros / Brancos / Neutros claros
    BRANCO: 'LIGHT', BRANCA: 'LIGHT', CREME: 'LIGHT', BEGE: 'LIGHT',
    AREIA: 'LIGHT', MARFIM: 'LIGHT', PEROLA: 'LIGHT', GELO: 'LIGHT',
    NEVE: 'LIGHT', OFF: 'LIGHT', NATURAL: 'LIGHT', CAQUI: 'LIGHT',

    // 🟤 Marrons
    MARROM: 'BROWN', CHOCOLATE: 'BROWN', CAFE: 'BROWN', TABACO: 'BROWN',
    CARAMELO: 'BROWN', TERRA: 'BROWN', MOGNO: 'BROWN', CASTANHO: 'BROWN',
    HAVANA: 'BROWN', CONHAQUE: 'BROWN', WHISKY: 'BROWN', FERRUGEM: 'BROWN',
    OCRE: 'BROWN', CANELA: 'BROWN',

    // 🩷 Rosas
    ROSA: 'PINK', SALMAO: 'PINK', FLAMINGO: 'PINK', MAGENTA: 'PINK',
    FUCHSIA: 'PINK', BLUSH: 'PINK', CHICLETE: 'PINK', CORAL: 'PINK',

    // 🟣 Roxos / Lilás
    LILAS: 'PURPLE', LAVANDA: 'PURPLE', ROXO: 'PURPLE', VIOLETA: 'PURPLE',
    UVAS: 'PURPLE', AMETISTA: 'PURPLE', BERINJELA: 'PURPLE',

    // 🟠 Laranjas
    LARANJA: 'ORANGE', TERRACOTA: 'ORANGE', TIJOLO: 'ORANGE',
    COBRE: 'ORANGE', PESSEGO: 'ORANGE', TANGERINA: 'ORANGE',
    ABOBORA: 'ORANGE', PAPAYA: 'ORANGE',

    // 🩶 Cinzas
    CINZA: 'GRAY', PRATA: 'GRAY', FUMACA: 'GRAY',
    CONCRETO: 'GRAY', TITANIO: 'GRAY', ESTANHO: 'GRAY',
  };

  function parseProductTitle(title) {
    const upper = (title || '').toUpperCase().trim();
    // Pattern: CAMISA [MASC|FEM|INF] BRK M/[C|L] [MODEL] [COLOR]
    const match = upper.match(/CAMISA\s+(MASC|FEM|INF)\s+BRK\s+M\/(C|L)\s+(\w+)\s+(.*)/);
    if (match) {
      return {
        gender: match[1],
        sleeve: match[2] === 'C' ? 'MC' : 'ML',
        model: match[3],
        color: match[4].trim(),
      };
    }
    // Fallback genérico
    const gender = /\bMASC\b/.test(upper) ? 'MASC' : /\bFEM\b/.test(upper) ? 'FEM' : /\bINF\b/.test(upper) ? 'INF' : '';
    const sleeve = /M\/C|\bMC\b|MANGA\s*CURTA/.test(upper) ? 'MC' : /M\/L|\bML\b|MANGA\s*LONGA/.test(upper) ? 'ML' : '';
    return { gender, sleeve, model: '', color: upper };
  }

  function parseXlsData(rawData) {
    const products = [];
    const headers = rawData[0];
    const colCode = headers.indexOf('Código');
    const colDesc = headers.indexOf('Descrição');
    const colUrls = headers.indexOf('URL Imagens Externas');
    const colParent = headers.indexOf('Código Pai');

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row[colDesc]) continue;
      const desc = String(row[colDesc]).trim();
      if (desc.startsWith('Tamanho:')) continue;

      const parsed = parseProductTitle(desc);
      const code = String(row[colCode] || '').trim();
      products.push({
        code,
        title: desc,
        gender: parsed.gender,
        sleeve: parsed.sleeve,
        model: parsed.model,
        color: parsed.color,
        parentCode: row[colParent] || '',
        hasUrls: !!(row[colUrls] && String(row[colUrls]).trim()),
        existingUrls: String(row[colUrls] || '').trim(),
        rowIndex: i,
      });
    }
    return products;
  }

  // ═══════════════════════════════════════════════════════════
  // MATCHING: Algoritmo V2 — Foco em COR, lógica invertida
  // Para cada PASTA de imagem → encontrar o PRODUTO mais parecido
  // ═══════════════════════════════════════════════════════════

  function normalizeToken(s) {
    return (s || '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\-\/\\\.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(s) {
    const normalized = normalizeToken(s);
    const stopWords = ['CAMISA', 'BRK', 'COUNTRY', 'DE', 'DO', 'DA', 'EDITADAS', 'FINAL', 'EDITADAS_FINAL'];
    return normalized.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w));
  }

  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function tokenSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const maxLen = Math.max(a.length, b.length);
    const dist = levenshtein(a, b);
    return Math.max(0, 1 - dist / maxLen);
  }

  // ─── Detectar gênero e modelo dos tokens da pasta ────────

  function detectFolderGender(tokens) {
    if (tokens.includes('MASC') || tokens.includes('MASCULINO') || tokens.includes('MASCULINA')) return 'MASC';
    if (tokens.includes('FEM') || tokens.includes('FEMININO') || tokens.includes('FEMININA')) return 'FEM';
    if (tokens.includes('INF') || tokens.includes('INFANTIL')) return 'INF';
    return '';
  }

  function detectFolderModel(tokens) {
    for (const t of tokens) {
      if (MODEL_SYNONYMS.CLASSIC && MODEL_SYNONYMS.CLASSIC.some(s => s === t || tokenSimilarity(s, t) > 0.8)) return 'CLASSIC';
      if (MODEL_SYNONYMS.RANCH && MODEL_SYNONYMS.RANCH.some(s => s === t || tokenSimilarity(s, t) > 0.8)) return 'RANCH';
      if (MODEL_SYNONYMS.WESTERN && MODEL_SYNONYMS.WESTERN.some(s => s === t || tokenSimilarity(s, t) > 0.8)) return 'WESTERN';
    }
    return '';
  }

  // ─── Extrair tokens de COR da pasta (remove gênero/modelo) ────────

  function extractColorTokens(tokens) {
    const nonColorWords = ['MASC', 'MASCULINO', 'MASCULINA', 'FEM', 'FEMININO', 'FEMININA',
      'INF', 'INFANTIL', 'MC', 'ML', 'CLASSIC', 'RANCH', 'WESTERN',
      'LISA', 'LISO', 'LISAS', 'XADREZ', 'GRANDE', 'PEQUENO'];
    return tokens.filter(t => !nonColorWords.includes(t));
  }

  // ─── Score principal: compara COR da pasta com COR do produto ────────
  // Usa 3 níveis: 1) Levenshtein exato  2) Família de cor  3) Sem match

  function colorTokenSimilarity(a, b) {
    // Nível 1: Match exato via Levenshtein
    if (a === b) return 1;
    const levSim = tokenSimilarity(a, b);
    if (levSim >= 0.6) return levSim;

    // Nível 2: Mesma família de cor (teoria das cores)
    const familyA = COLOR_FAMILIES[a];
    const familyB = COLOR_FAMILIES[b];
    if (familyA && familyB && familyA === familyB) return 0.75;

    // Nível 3: Sem relação
    return levSim;
  }

  function colorMatchScore(folderColorTokens, productColorTokens) {
    if (folderColorTokens.length === 0 || productColorTokens.length === 0) return 0;

    // Para cada token da pasta, encontrar melhor match no produto
    let folderMatched = 0, folderTotal = 0;
    for (const ft of folderColorTokens) {
      let best = 0;
      for (const pt of productColorTokens) {
        const sim = colorTokenSimilarity(ft, pt);
        if (sim > best) best = sim;
      }
      folderTotal += 1;
      if (best >= 0.6) folderMatched += best;
    }

    // Para cada token do produto, encontrar melhor match na pasta
    let prodMatched = 0, prodTotal = 0;
    for (const pt of productColorTokens) {
      let best = 0;
      for (const ft of folderColorTokens) {
        const sim = colorTokenSimilarity(pt, ft);
        if (sim > best) best = sim;
      }
      prodTotal += 1;
      if (best >= 0.6) prodMatched += best;
    }

    // Média bidirecional — quanto os dois lados se reconhecem
    const scorePasta = folderTotal > 0 ? (folderMatched / folderTotal) : 0;
    const scoreProduto = prodTotal > 0 ? (prodMatched / prodTotal) : 0;
    return (scorePasta + scoreProduto) / 2;
  }

  // ─── performMatching V2: Para cada PASTA, encontrar melhor PRODUTO ────────

  function performMatching() {
    const matches = [];

    for (const folder of crosserState.imageFolders) {
      const folderTokens = folder.tokens;
      const folderGender = detectFolderGender(folderTokens);
      const folderModel = detectFolderModel(folderTokens);
      const folderColors = extractColorTokens(folderTokens);

      // Para cada produto sem URL, calcular score
      const candidates = [];

      for (const product of crosserState.products) {
        // Tokens de cor do produto (apenas cor, sem modelo/gênero)
        const productColorTokens = tokenize(product.color);

        // Score de cor (0–1) — fator principal
        const cScore = colorMatchScore(folderColors, productColorTokens);

        // Bônus por modelo (0 ou 0.2)
        const modelBonus = (folderModel && folderModel === product.model) ? 0.2 : 0;

        // Bônus por gênero (0 ou 0.1)
        const genderBonus = (!folderGender || folderGender === product.gender) ? 0.1 : 0;

        // Score final: cor (peso 70%) + modelo (peso 20%) + gênero (peso 10%)
        const finalScore = (cScore * 70) + (modelBonus * 100) + (genderBonus * 100);

        candidates.push({
          product,
          score: Math.round(finalScore),
          colorScore: Math.round(cScore * 100),
          modelMatch: folderModel === product.model,
          genderMatch: !folderGender || folderGender === product.gender,
        });
      }

      // Ordenar por score e agrupar por manga (MC/ML)
      candidates.sort((a, b) => b.score - a.score);

      // Para cada manga que a pasta tem, pegar o melhor candidato
      const sleeves = folder.subfolders.length > 0 ? folder.subfolders : [''];

      for (const sleeve of sleeves) {
        // Filtrar candidatos pela manga
        const sleeveMatch = sleeve
          ? candidates.filter(c => c.product.sleeve === sleeve || !c.product.sleeve)
          : candidates;

        const best = sleeveMatch[0];

        if (best) {
          matches.push({
            product: best.product,
            folder,
            score: best.score,
            colorScore: best.colorScore,
            sleeve: sleeve || best.product.sleeve,
            modelMatch: best.modelMatch,
            genderMatch: best.genderMatch,
            confirmed: best.score >= 50,
            uploaded: false,
            urls: '',
          });
        }
      }
    }

    // Também adicionar produtos sem match (sem pasta correspondente)
    const matchedCodes = new Set(matches.map(m => m.product.code));
    for (const product of crosserState.products) {
      if (!matchedCodes.has(product.code)) {
        matches.push({
          product,
          folder: null,
          score: 0,
          colorScore: 0,
          sleeve: product.sleeve,
          modelMatch: false,
          genderMatch: false,
          confirmed: false,
          uploaded: false,
          urls: '',
        });
      }
    }

    // Ordenar: matches com score primeiro, sem match ao final
    matches.sort((a, b) => {
      if (a.folder && !b.folder) return -1;
      if (!a.folder && b.folder) return 1;
      return b.score - a.score;
    });

    crosserState.matches = matches;
  }

  // ═══════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════

  function render() {
    const container = document.getElementById('app-content');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width:1200px;margin:0 auto">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
          <div style="font-size:40px">🔀</div>
          <div>
            <h2 style="margin:0;color:${LIME};font-size:24px">Cruzador de Imagens</h2>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:14px">
              Cruze automaticamente imagens com produtos da planilha Bling
            </p>
          </div>
        </div>

        <!-- Steps indicator -->
        <div style="display:flex;gap:8px;margin-bottom:24px">
          ${[
            { n: 1, emoji: '📋', label: 'Planilha' },
            { n: 2, emoji: '📂', label: 'Imagens' },
            { n: 3, emoji: '🔀', label: 'Cruzamento' },
            { n: 4, emoji: '📤', label: 'Upload' },
          ].map(s => `
            <div style="flex:1;padding:10px 14px;border-radius:10px;text-align:center;
              background:${crosserState.step === s.n ? 'rgba(132,204,22,0.15)' : 'rgba(255,255,255,0.03)'};
              border:1px solid ${crosserState.step === s.n ? 'rgba(132,204,22,0.4)' : 'rgba(255,255,255,0.06)'};
              color:${crosserState.step >= s.n ? LIME : '#6b7280'};
              cursor:${crosserState.step > s.n ? 'pointer' : 'default'};
              transition:all .2s"
              ${crosserState.step > s.n ? `onclick="window._crosserGoStep(${s.n})"` : ''}>
              <div style="font-size:20px">${s.emoji}</div>
              <div style="font-size:11px;font-weight:600;margin-top:2px">Etapa ${s.n}</div>
              <div style="font-size:10px;color:#9ca3af">${s.label}</div>
            </div>
          `).join('')}
        </div>

        <!-- Step Content -->
        ${crosserState.step === 1 ? renderStep1() : ''}
        ${crosserState.step === 2 ? renderStep2() : ''}
        ${crosserState.step === 3 ? renderStep3() : ''}
        ${crosserState.step === 4 ? renderStep4() : ''}
      </div>
    `;
    bindEvents();
  }

  // ─── STEP 1 ────────────────────────────────────────────

  function renderStep1() {
    const hasData = crosserState.products.length > 0;
    const withUrls = crosserState.products.filter(p => p.hasUrls).length;
    const withoutUrls = crosserState.products.length - withUrls;

    return `
      <div class="card" style="padding:24px">
        <h3 style="margin:0 0 16px;color:${LIME}">📋 Etapa 1: Carregar Planilha Bling</h3>
        <div id="crosser-xls-dropzone" style="
          border:2px dashed rgba(132,204,22,0.3);border-radius:12px;padding:40px 20px;
          text-align:center;cursor:pointer;transition:all .3s;
          background:${hasData ? 'rgba(132,204,22,0.05)' : 'rgba(0,0,0,.2)'}">
          <div style="font-size:48px;margin-bottom:12px">${hasData ? '✅' : '📄'}</div>
          <div style="font-size:15px;font-weight:600;color:${hasData ? LIME : '#e5e7eb'}">
            ${hasData ? 'Planilha carregada: ' + crosserState.products.length + ' produtos' : 'Arraste o arquivo XLS/CSV aqui ou clique para selecionar'}
          </div>
          ${hasData ? '<div style="margin-top:12px;display:flex;gap:16px;justify-content:center"><span style="color:#22c55e;font-size:13px">✅ ' + withUrls + ' com imagens</span><span style="color:#f59e0b;font-size:13px">⚠️ ' + withoutUrls + ' sem imagens</span></div>' : '<div style="font-size:12px;color:#6b7280;margin-top:8px">Suporta .xls, .xlsx, .csv no padrão Bling</div>'}
          <input type="file" id="crosser-xls-input" accept=".xls,.xlsx,.csv" style="display:none">
        </div>

        ${hasData ? `
          <div style="margin-top:16px">
            <div style="font-size:13px;font-weight:600;color:#e5e7eb;margin-bottom:8px">
              Produtos sem imagem (${withoutUrls}):
            </div>
            <div style="max-height:300px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead>
                  <tr style="background:rgba(0,0,0,.3);position:sticky;top:0">
                    <th style="padding:8px 12px;text-align:left;color:#9ca3af">Código</th>
                    <th style="padding:8px 12px;text-align:left;color:#9ca3af">Título</th>
                    <th style="padding:8px 12px;text-align:center;color:#9ca3af">Manga</th>
                    <th style="padding:8px 12px;text-align:center;color:#9ca3af">Gênero</th>
                  </tr>
                </thead>
                <tbody>
                  ${crosserState.products.filter(p => !p.hasUrls).slice(0, 50).map(p => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                      <td style="padding:6px 12px;color:${LIME};font-family:monospace">${esc(p.code)}</td>
                      <td style="padding:6px 12px;color:#e5e7eb">${esc(p.title)}</td>
                      <td style="padding:6px 12px;text-align:center;color:#fbbf24">${p.sleeve || '-'}</td>
                      <td style="padding:6px 12px;text-align:center;color:#93c5fd">${p.gender || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:16px;justify-content:flex-end">
            <button class="btn btn--primary" id="crosser-next-1" style="padding:10px 24px">
              Próximo → Carregar Imagens
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ─── STEP 2 ────────────────────────────────────────────

  function renderStep2() {
    const hasFolders = crosserState.imageFolders.length > 0;
    return `
      <div class="card" style="padding:24px">
        <h3 style="margin:0 0 16px;color:${LIME}">📂 Etapa 2: Carregar Pasta de Imagens</h3>
        <div id="crosser-folder-dropzone" style="
          border:2px dashed rgba(132,204,22,0.3);border-radius:12px;padding:40px 20px;
          text-align:center;cursor:pointer;transition:all .3s;
          background:${hasFolders ? 'rgba(132,204,22,0.05)' : 'rgba(0,0,0,.2)'}">
          <div style="font-size:48px;margin-bottom:12px">${hasFolders ? '✅' : '📂'}</div>
          <div style="font-size:15px;font-weight:600;color:${hasFolders ? LIME : '#e5e7eb'}">
            ${hasFolders ? crosserState.imageFolders.length + ' pasta(s) de imagens encontradas' : 'Selecione a pasta raiz com as subpastas de imagens'}
          </div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px">
            Estrutura: PASTA_COR_GENERO / MC|ML / EDITADAS_FINAL / imagens
          </div>
          <input type="file" id="crosser-folder-input" webkitdirectory directory multiple style="display:none">
        </div>

        ${hasFolders ? `
          <div style="margin-top:16px;max-height:300px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead>
                <tr style="background:rgba(0,0,0,.3);position:sticky;top:0">
                  <th style="padding:8px 12px;text-align:left;color:#9ca3af">Pasta</th>
                  <th style="padding:8px 12px;text-align:center;color:#9ca3af">Subpastas</th>
                  <th style="padding:8px 12px;text-align:center;color:#9ca3af">Imagens</th>
                </tr>
              </thead>
              <tbody>
                ${crosserState.imageFolders.map(f => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                    <td style="padding:6px 12px;color:#e5e7eb;font-family:monospace;font-size:11px">${esc(f.name)}</td>
                    <td style="padding:6px 12px;text-align:center;color:#fbbf24">${f.subfolders.join(', ') || '-'}</td>
                    <td style="padding:6px 12px;text-align:center;color:${LIME}">${f.imageCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="display:flex;gap:12px;margin-top:16px;justify-content:space-between">
            <button class="btn btn--secondary" id="crosser-prev-2">← Voltar</button>
            <button class="btn btn--primary" id="crosser-next-2" style="padding:10px 24px">
              🔀 Cruzar Automaticamente
            </button>
          </div>
        ` : `
          <div style="display:flex;gap:12px;margin-top:16px">
            <button class="btn btn--secondary" id="crosser-prev-2">← Voltar</button>
          </div>
        `}
      </div>
    `;
  }

  // ─── STEP 3 ────────────────────────────────────────────

  function renderStep3() {
    const matched = crosserState.matches.filter(m => m.folder && m.confirmed).length;
    const unmatched = crosserState.matches.filter(m => !m.folder).length;
    const lowConf = crosserState.matches.filter(m => m.folder && !m.confirmed).length;
    const withFolder = crosserState.matches.filter(m => m.folder).length;

    return `
      <div class="card" style="padding:24px">
        <h3 style="margin:0 0 16px;color:${LIME}">🔀 Etapa 3: Resultado do Cruzamento</h3>
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <div style="flex:1;padding:12px;border-radius:8px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);text-align:center">
            <div style="font-size:24px;font-weight:700;color:#22c55e">${matched}</div>
            <div style="font-size:11px;color:#6b7280">✅ Confirmados</div>
          </div>
          <div style="flex:1;padding:12px;border-radius:8px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);text-align:center">
            <div style="font-size:24px;font-weight:700;color:#f59e0b">${lowConf}</div>
            <div style="font-size:11px;color:#6b7280">⚠️ Revisar</div>
          </div>
          <div style="flex:1;padding:12px;border-radius:8px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);text-align:center">
            <div style="font-size:24px;font-weight:700;color:#3b82f6">${withFolder}</div>
            <div style="font-size:11px;color:#6b7280">📂 Com Pasta</div>
          </div>
          <div style="flex:1;padding:12px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);text-align:center">
            <div style="font-size:24px;font-weight:700;color:#ef4444">${unmatched}</div>
            <div style="font-size:11px;color:#6b7280">❌ Sem match</div>
          </div>
        </div>

        <div style="max-height:600px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:rgba(0,0,0,.3);position:sticky;top:0;z-index:1">
                <th style="padding:8px 6px;text-align:center;color:#9ca3af;width:50px">🖼️</th>
                <th style="padding:8px 10px;text-align:left;color:#9ca3af;width:90px">Código</th>
                <th style="padding:8px 10px;text-align:left;color:#9ca3af">Produto</th>
                <th style="padding:8px 10px;text-align:left;color:#9ca3af">Pasta Match</th>
                <th style="padding:8px 10px;text-align:center;color:#9ca3af;width:55px">Cor</th>
                <th style="padding:8px 10px;text-align:center;color:#9ca3af;width:40px">📊</th>
                <th style="padding:8px 10px;text-align:center;color:#9ca3af;width:50px">Manga</th>
                <th style="padding:8px 10px;text-align:center;color:#9ca3af;width:40px">✓</th>
              </tr>
            </thead>
            <tbody>
              ${crosserState.matches.map((m, idx) => {
                const scoreColor = m.score >= 50 ? '#22c55e' : m.score >= 30 ? '#f59e0b' : '#ef4444';
                // Gerar preview da primeira imagem da pasta
                let previewHtml = '';
                if (m.folder && m.folder.images.length > 0) {
                  const img = m.folder.images[0];
                  const previewUrl = URL.createObjectURL(img);
                  previewHtml = '<img src="' + previewUrl + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.1)">';
                } else {
                  previewHtml = '<div style="width:40px;height:40px;background:rgba(255,255,255,0.05);border-radius:4px;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:10px">N/A</div>';
                }

                // Badges
                const modelBadge = m.modelMatch ? '<span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:1px 4px;border-radius:3px;font-size:9px">MOD</span>' : '';
                const genderBadge = m.genderMatch ? '<span style="background:rgba(59,130,246,0.15);color:#3b82f6;padding:1px 4px;border-radius:3px;font-size:9px">GEN</span>' : '';

                return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:' + (m.confirmed ? 'rgba(34,197,94,0.03)' : '') + '">' +
                  '<td style="padding:4px 6px;text-align:center">' + previewHtml + '</td>' +
                  '<td style="padding:6px 10px;color:' + LIME + ';font-family:monospace;font-size:11px">' + esc(m.product.code) + '</td>' +
                  '<td style="padding:6px 10px;color:#d1d5db;font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(m.product.title) + '">' + esc(m.product.title) + '</td>' +
                  '<td style="padding:6px 10px;font-size:10px;font-family:monospace;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(m.folder?.name || '') + '">' +
                    (m.folder ? '<span style="color:#93c5fd">' + esc(m.folder.name) + '</span> ' + modelBadge + ' ' + genderBadge : '<span style="color:#ef4444">— sem match —</span>') +
                  '</td>' +
                  '<td style="padding:6px 10px;text-align:center;font-weight:600;color:' + (m.colorScore >= 50 ? '#22c55e' : m.colorScore >= 20 ? '#f59e0b' : '#ef4444') + ';font-size:11px">' + (m.folder ? (m.colorScore || 0) + '%' : '-') + '</td>' +
                  '<td style="padding:6px 10px;text-align:center;font-weight:700;color:' + scoreColor + '">' + (m.folder ? m.score + '%' : '-') + '</td>' +
                  '<td style="padding:6px 10px;text-align:center;color:#fbbf24">' + (m.sleeve || '-') + '</td>' +
                  '<td style="padding:6px 10px;text-align:center">' +
                    (m.folder ? '<input type="checkbox" ' + (m.confirmed ? 'checked' : '') + ' data-match-idx="' + idx + '" class="crosser-confirm-check" style="accent-color:' + LIME + ';cursor:pointer">' : '-') +
                  '</td>' +
                '</tr>';
              }).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex;gap:12px;margin-top:16px;justify-content:space-between">
          <button class="btn btn--secondary" id="crosser-prev-3">← Voltar</button>
          <div style="display:flex;gap:12px">
            <button class="btn btn--secondary" id="crosser-confirm-all">✅ Confirmar Todos com Pasta</button>
            <button class="btn btn--primary" id="crosser-next-3" style="padding:10px 24px">
              📤 Upload dos Confirmados (${matched})
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── STEP 4 ────────────────────────────────────────────

  function renderStep4() {
    const confirmed = crosserState.matches.filter(m => m.confirmed && m.folder);
    const uploaded = confirmed.filter(m => m.uploaded).length;
    const total = confirmed.length;

    return `
      <div class="card" style="padding:24px">
        <h3 style="margin:0 0 16px;color:${LIME}">📤 Etapa 4: Upload & Exportar</h3>
        <div id="crosser-upload-progress" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#e5e7eb;font-size:13px">Progresso do Upload</span>
            <span style="color:${LIME};font-size:13px;font-weight:700">${uploaded}/${total}</span>
          </div>
          <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${total > 0 ? (uploaded/total*100) : 0}%;background:${LIME};border-radius:4px;transition:width .3s"></div>
          </div>
          <div id="crosser-upload-status" style="font-size:12px;color:#9ca3af;margin-top:8px"></div>
        </div>

        <div style="max-height:400px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.06);margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:rgba(0,0,0,.3);position:sticky;top:0">
                <th style="padding:8px 10px;text-align:left;color:#9ca3af">Código</th>
                <th style="padding:8px 10px;text-align:left;color:#9ca3af">Status</th>
                <th style="padding:8px 10px;text-align:left;color:#9ca3af">URLs</th>
              </tr>
            </thead>
            <tbody>
              ${confirmed.map(m => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                  <td style="padding:6px 10px;color:${LIME};font-family:monospace">${esc(m.product.code)}</td>
                  <td style="padding:6px 10px;color:${m.uploaded ? '#22c55e' : '#9ca3af'}">${m.uploaded ? '✅ Enviado' : '⏳ Pendente'}</td>
                  <td style="padding:6px 10px;color:#93c5fd;font-size:10px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.urls) || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex;gap:12px;justify-content:space-between">
          <button class="btn btn--secondary" id="crosser-prev-4">← Voltar</button>
          <div style="display:flex;gap:12px">
            ${uploaded < total ? '<button class="btn btn--primary" id="crosser-start-upload" style="padding:10px 24px;background:var(--accent-gradient);color:#000">🚀 Iniciar Upload (' + (total - uploaded) + ' pendentes)</button>' : ''}
            ${uploaded > 0 ? '<button class="btn btn--primary" id="crosser-export" style="padding:10px 24px">📥 Exportar Planilha</button>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════

  function bindEvents() {
    const xlsDropzone = document.getElementById('crosser-xls-dropzone');
    const xlsInput = document.getElementById('crosser-xls-input');
    if (xlsDropzone && xlsInput) {
      xlsDropzone.addEventListener('click', () => xlsInput.click());
      xlsInput.addEventListener('change', handleXlsUpload);
    }

    const folderDropzone = document.getElementById('crosser-folder-dropzone');
    const folderInput = document.getElementById('crosser-folder-input');
    if (folderDropzone && folderInput) {
      folderDropzone.addEventListener('click', () => folderInput.click());
      folderInput.addEventListener('change', handleFolderUpload);
    }

    document.getElementById('crosser-next-1')?.addEventListener('click', () => goStep(2));
    document.getElementById('crosser-prev-2')?.addEventListener('click', () => goStep(1));
    document.getElementById('crosser-next-2')?.addEventListener('click', () => { performMatching(); goStep(3); });
    document.getElementById('crosser-prev-3')?.addEventListener('click', () => goStep(2));
    document.getElementById('crosser-confirm-all')?.addEventListener('click', () => {
      crosserState.matches.forEach(m => { if (m.folder) m.confirmed = true; });
      render();
    });
    document.getElementById('crosser-next-3')?.addEventListener('click', () => goStep(4));
    document.getElementById('crosser-prev-4')?.addEventListener('click', () => goStep(3));

    document.querySelectorAll('.crosser-confirm-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.matchIdx);
        crosserState.matches[idx].confirmed = e.target.checked;
      });
    });

    document.getElementById('crosser-start-upload')?.addEventListener('click', startUpload);
    document.getElementById('crosser-export')?.addEventListener('click', exportUpdatedXls);
  }

  function goStep(n) { crosserState.step = n; render(); }
  window._crosserGoStep = goStep;

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════

  async function handleXlsUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    crosserState.xlsFile = file;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const r = await fetch('/api/crosser/parse-xls', { method: 'POST', body: formData });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro ao processar planilha');

      crosserState.xlsData = data.rows;
      crosserState.products = parseXlsData(data.rows);
      window.HUB.showToast('✅ ' + crosserState.products.length + ' produtos encontrados', 'success');
      render();
    } catch (err) {
      window.HUB.showToast('❌ ' + err.message, 'error');
    }
  }

  function handleFolderUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    crosserState.rootFolderFiles = files;

    const folders = {};
    const imageExts = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
    const systemFiles = /thumbs\.db$|desktop\.ini$|\.ds_store$/i;

    files.forEach(file => {
      if (!imageExts.test(file.name)) return;
      if (systemFiles.test(file.name)) return;

      const parts = file.webkitRelativePath.split('/');
      if (parts.length < 2) return;

      // REGRA: Só aceitar imagens dentro de EDITADAS_FINAL
      const relPathUpper = file.webkitRelativePath.toUpperCase();
      if (!relPathUpper.includes('EDITADAS_FINAL')) return;

      // ═══ Detecção inteligente do nome da pasta ═══
      // Encontrar o nome significativo: não pode ser MC, ML, EDITADAS_FINAL, ou a raiz genérica
      const ignoreFolders = ['MC', 'ML', 'EDITADAS_FINAL', 'EDITADAS', 'FINAL'];
      let folderName = '';
      let subfolder = '';

      for (let p = 0; p < parts.length - 1; p++) {
        const upper = parts[p].toUpperCase();

        // Detectar subpasta MC/ML
        if (upper === 'MC' || upper === 'ML') {
          subfolder = upper;
          continue;
        }

        // Ignorar pastas do sistema
        if (ignoreFolders.includes(upper)) continue;

        // O nome mais profundo que NÃO é MC/ML/EDITADAS_FINAL é o nome da pasta de produto
        // Mas preferimos o nome que tem mais tokens descritivos (mais underscores)
        if (parts[p].includes('_') || parts[p].length > 10) {
          folderName = parts[p]; // Este é provavelmente o nome descritivo do produto
        } else if (!folderName) {
          folderName = parts[p]; // Fallback: primeiro nome disponível
        }
      }

      if (!folderName) return;

      if (!folders[folderName]) {
        folders[folderName] = {
          name: folderName,
          tokens: tokenize(folderName),
          subfolders: new Set(),
          images: [],
          imageCount: 0,
        };
      }
      if (subfolder) folders[folderName].subfolders.add(subfolder);
      folders[folderName].images.push(file);
      folders[folderName].imageCount++;
    });

    crosserState.imageFolders = Object.values(folders).map(f => ({
      ...f,
      subfolders: [...f.subfolders].sort(),
    }));

    window.HUB.showToast('✅ ' + crosserState.imageFolders.length + ' pasta(s) encontrada(s) com ' +
      Object.values(folders).reduce((a, f) => a + f.imageCount, 0) + ' imagens', 'success');
    render();
  }

  // ═══════════════════════════════════════════════════════════
  // UPLOAD
  // ═══════════════════════════════════════════════════════════

  async function startUpload() {
    const confirmed = crosserState.matches.filter(m => m.confirmed && m.folder && !m.uploaded);
    if (confirmed.length === 0) {
      window.HUB.showToast('Nenhum match pendente', 'info');
      return;
    }

    const statusEl = document.getElementById('crosser-upload-status');

    for (let i = 0; i < confirmed.length; i++) {
      const match = confirmed[i];
      const { product, folder, sleeve } = match;
      if (statusEl) statusEl.textContent = '📤 Enviando ' + product.code + ' (' + (i + 1) + '/' + confirmed.length + ')...';

      try {
        // Imagens já são apenas de EDITADAS_FINAL (filtrado no handleFolderUpload)
        let images = folder.images.filter(f => {
          const relPath = f.webkitRelativePath.toUpperCase();
          // Filtrar por manga se definida
          if (sleeve) return relPath.includes('/' + sleeve + '/');
          return true;
        });

        if (images.length === 0) {
          match.urls = 'SEM IMAGENS';
          match.uploaded = true;
          continue;
        }

        // ═══════════════════════════════════════════════════════════
        // Smart Sort: Padrão BRK Agro E-commerce
        // ═══════════════════════════════════════════════════════════
        // Ordem oficial BRK (analisada de brkagro.com.br):
        //   1. FRENTE com acessório (cinto/chapéu) — Hero Shot
        //   2. FRENTE solta/limpa
        //   3. COSTAS com acessório (cinto/chapéu)
        //   4. COSTAS solta/limpa
        //   5. CORPO inteiro (com acessórios)
        //   6. CHAPÉU/CINTO combos
        //   7. DETALHES: gola → costas → logo → manga/pulso
        //   8. Numéricos → final (thumbs/extras)
        // ═══════════════════════════════════════════════════════════
        function getImagePriority(fileName) {
          const name = fileName.toUpperCase().replace(/\.[^.]+$/, '');

          // Numéricos puros (13.jpg, 15.jpg) → extras no final
          if (/^\d+$/.test(name.trim())) return 900 + parseInt(name.trim());

          // Detectar categorias pelo nome do arquivo
          const isFrente  = /FRENTE/.test(name);
          const isCostas  = /COSTA/.test(name);
          const isCorpo   = /CORPO/.test(name);
          const isCinto   = /CINTO/.test(name);
          const isChapeu  = /CHAP/.test(name);
          const isSolta   = /SOLTA/.test(name);
          const isDetalhe = /DETALHE|DETAIL/.test(name);
          const isGola    = /GOLA/.test(name);
          const isLogo    = /LOGO/.test(name);
          const isManga   = /MANGA|PULSO/.test(name);
          const isPerspec = /PERSPEC|PERSPECTIVA/.test(name);
          const hasAcessorio = isCinto || isChapeu;

          // Extrair sufixo numérico para sub-ordenação (frente01, frente04...)
          const numMatch = name.match(/(\d+)/);
          const numSub   = numMatch ? parseInt(numMatch[1]) * 0.01 : 0;

          // ── DETALHES (checar primeiro para não confundir "detalhe_costas" com "costas")
          if (isDetalhe && isGola)    return 700 + numSub;     // Detalhe gola
          if (isDetalhe && isCostas)  return 710 + numSub;     // Detalhe costas
          if (isDetalhe && isLogo)    return 720 + numSub;     // Detalhe logo
          if (isDetalhe && isManga)   return 730 + numSub;     // Detalhe manga/pulso
          if (isDetalhe)             return 750 + numSub;     // Detalhe genérico

          // ── FRENTE (posição 1–2)
          if (isFrente && hasAcessorio && !isPerspec) return 100 + numSub;  // Frente com cinto/chapéu (HERO)
          if (isFrente && isSolta)                    return 200 + numSub;  // Frente solta/limpa
          if (isFrente && isPerspec)                  return 250 + numSub;  // Frente perspectiva
          if (isFrente)                               return 150 + numSub;  // Frente genérica

          // ── COSTAS (posição 3–4)
          if (isCostas && hasAcessorio && !isPerspec) return 300 + numSub;  // Costas com cinto/chapéu
          if (isCostas && isSolta)                    return 400 + numSub;  // Costas solta/limpa
          if (isCostas && isPerspec)                  return 450 + numSub;  // Costas perspectiva
          if (isCostas)                               return 350 + numSub;  // Costas genérica

          // ── CORPO (posição 5)
          if (isCorpo && hasAcessorio) return 500 + numSub;  // Corpo com acessório
          if (isCorpo)                return 510 + numSub;  // Corpo limpo

          // ── CHAPÉU/CINTO combos (posição 6)
          if (isChapeu || isCinto)    return 600 + numSub;

          // ── FALLBACK
          return 800 + numSub;
        }

        images.sort((a, b) => {
          const prioA = getImagePriority(a.name);
          const prioB = getImagePriority(b.name);
          if (prioA !== prioB) return prioA - prioB;
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        });

        const collectionId = product.code + '_' + (sleeve || 'ALL');
        const formData = new FormData();
        formData.append('collectionId', collectionId);

        for (let j = 0; j < images.length; j++) {
          const file = images[j];
          const buffer = await file.arrayBuffer();
          const blob = new Blob([buffer], { type: file.type || 'image/jpeg' });
          formData.append('files', blob, (j + 1) + '.jpg');
        }

        const response = await fetch('/api/s3-proxy/upload-batch', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.success && data.allJoined) {
          match.urls = data.allJoined;
          match.uploaded = true;
        } else {
          throw new Error(data.error || 'Upload falhou');
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = '❌ Erro ' + product.code + ': ' + err.message;
        window.HUB.showToast('❌ ' + product.code + ': ' + err.message, 'error');
      }

      render();
      await new Promise(r => setTimeout(r, 500));
    }

    if (statusEl) statusEl.textContent = '✅ Upload concluído!';
    window.HUB.showToast('✅ Upload concluído!', 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════

  function exportUpdatedXls() {
    if (!crosserState.xlsData) {
      window.HUB.showToast('Nenhuma planilha carregada', 'error');
      return;
    }

    const rows = crosserState.xlsData.map(r => [...(r || [])]);
    const headers = rows[0];
    const urlCol = headers.indexOf('URL Imagens Externas');

    if (urlCol < 0) {
      window.HUB.showToast('Coluna "URL Imagens Externas" não encontrada', 'error');
      return;
    }

    const uploaded = crosserState.matches.filter(m => m.uploaded && m.urls && m.urls !== 'SEM IMAGENS');
    let filled = 0;

    for (const match of uploaded) {
      const code = match.product.code.trim();
      for (let i = 1; i < rows.length; i++) {
        const rowCode = String(rows[i][headers.indexOf('Código')] || '').trim();
        const parentCode = String(rows[i][headers.indexOf('Código Pai')] || '').trim();

        if (rowCode === code || parentCode === code) {
          while (rows[i].length <= urlCol) rows[i].push('');
          rows[i][urlCol] = match.urls;
          filled++;
        }
      }
    }

    const csv = rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        if (s.includes(';') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(';')
    ).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CBT_ATUALIZADO_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    window.HUB.showToast('✅ Planilha exportada com ' + filled + ' linhas atualizadas', 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC
  // ═══════════════════════════════════════════════════════════

  window.HUB = window.HUB || {};
  window.HUB.renderImageCrosser = render;

})();
