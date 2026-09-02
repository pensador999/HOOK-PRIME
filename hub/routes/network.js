/**
 * @module network
 * @audit Extracted from server.js
 */
module.exports = (deps) => {
  const { fs, path, networkSafety, imageUtils, resolvePrefixConfig, networkPrefixes } = deps;
  const router = require('express').Router();
  
  const { IMAGE_EXTENSIONS, GENDER_FOLDERS_MAP, GENDER_NAMES, smartSortImageObjects, detectGenderFromFilename, classifyGender, shouldExcludeImage } = imageUtils;

function detectFolderPattern(folderPath) {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const subdirsUpper = subdirs.map(s => s.toUpperCase());
    const images = entries.filter(e => !e.isDirectory() && IMAGE_EXTENSIONS.test(e.name));
    
    if (subdirsUpper.includes('3D')) {
      const actual3d = subdirs.find(s => s.toUpperCase() === '3D');
      return { pattern: '3d_folder', sourceDir: actual3d || '3d' };
    }
    
    const genderDirs = subdirs.filter(s => Object.keys(GENDER_FOLDERS_MAP).includes(s.toUpperCase()));
    if (genderDirs.length > 0) return { pattern: 'gender_folders', genderDirs };
    
    if (subdirsUpper.includes('JPEG_IMAGENS')) {
      const jpegPath = path.join(folderPath, subdirs.find(s => s.toUpperCase() === 'JPEG_IMAGENS'));
      const jpegImages = fs.readdirSync(jpegPath).filter(f => IMAGE_EXTENSIONS.test(f));
      if (jpegImages.length > 0) return { pattern: 'jpeg_optimized', sourceDir: subdirs.find(s => s.toUpperCase() === 'JPEG_IMAGENS') };
    }
    
    if (images.length > 0) return { pattern: 'loose_images', imageCount: images.length };
    
    return { pattern: 'empty' };
  } catch (err) {
    return { pattern: 'error', error: err.message };
  }
}

function countImagesInDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath).filter(f => IMAGE_EXTENSIONS.test(f)).length;
  } catch { return 0; }
}

/**
 * GET /api/network/config
 * Retorna o caminho padrão da rede salvo em config/network.json
 */
router.get('/api/network/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config', 'network.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return res.json({
        defaultNetworkPath: config.defaultNetworkPath || '',
        recentPaths: config.recentPaths || [],
      });
    }
    return res.json({ defaultNetworkPath: '', recentPaths: [] });
  } catch (err) {
    console.error('Erro ao ler config de rede:', err.message);
    return res.json({ defaultNetworkPath: '', recentPaths: [] });
  }
});

/**
 * POST /api/network/scan
 * Escaneia uma pasta da rede e retorna a estrutura detectada.
 * Suporta caminhos UNC (\\servidor\pasta) e drives mapeados (Z:\pasta)
 * NUNCA modifica arquivos — apenas leitura.
 * 🔒 Usa network-safety.js para caminhos de rede.
 */
router.post('/api/network/scan', (req, res) => {
  const { networkPath } = req.body;
  if (!networkPath) return res.status(400).json({ error: 'Caminho da rede é obrigatório.' });

  try {
    // Normalize path for Windows
    const normalizedPath = path.resolve(networkPath);
    
    if (!networkSafety.safeExists(normalizedPath)) {
      return res.status(404).json({ error: `Pasta não encontrada. Verifique se o caminho está correto e se você tem acesso.` });
    }

    const isNet = networkSafety.isNetworkPath(normalizedPath);
    const stat = isNet ? networkSafety.safeStat(normalizedPath) : fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'O caminho informado não é uma pasta.' });
    }

    const rootName = path.basename(normalizedPath);
    // 🔒 Usar safeReadDir para paths de rede
    let topDirs, topImages;
    if (isNet) {
      const entries = networkSafety.safeReadDir(normalizedPath);
      topDirs = entries.filter(e => e.isDirectory).map(e => e.name);
      topImages = entries.filter(e => e.isFile && e.isImage);
    } else {
      const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
      topDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      topImages = entries.filter(e => !e.isDirectory() && IMAGE_EXTENSIONS.test(e.name));
    }

    // Check if root itself has a pattern (Pattern D - everything in root)
    const rootPattern = detectFolderPattern(normalizedPath);
    
    // If root has images directly or just a 3d folder, treat as Pattern D
    if (topDirs.length === 0 && topImages.length > 0) {
      return res.json({
        success: true,
        networkPath: normalizedPath,
        rootFolderName: rootName,
        detectedPattern: 'root_images',
        folders: [{
          name: rootName,
          fullPath: normalizedPath,
          pattern: 'loose_images',
          subfolders: [],
          has3d: false,
          imageCount: { masc: 0, fem: 0, inf: 0, loose: topImages.length },
          totalImages: topImages.length
        }],
        summary: { totalFolders: 1, totalImages: topImages.length, patterns: { loose_images: 1 } }
      });
    }

    // Scan each subfolder
    const folders = [];
    const patternCounts = {};
    let totalImages = 0;

    for (const dirName of topDirs) {
      // Skip hidden/system folders
      if (dirName.startsWith('.') || dirName.startsWith('_')) continue;
      
      const dirPath = path.join(normalizedPath, dirName);
      const detection = detectFolderPattern(dirPath);
      const folderInfo = {
        name: dirName,
        fullPath: dirPath,
        pattern: detection.pattern,
        subfolders: [],
        has3d: false,
        imageCount: { masc: 0, fem: 0, inf: 0, loose: 0 },
        totalImages: 0
      };

      if (detection.pattern === '3d_folder') {
        folderInfo.has3d = true;
        folderInfo.subfolders = ['3d'];
        const threeDPath = path.join(dirPath, detection.sourceDir || '3d');
        // Check if 3d has gender subfolders inside
        const threeDEntries = fs.readdirSync(threeDPath, { withFileTypes: true });
        const threeDSubdirs = threeDEntries.filter(e => e.isDirectory()).map(e => e.name);
        const gendersIn3d = threeDSubdirs.filter(s => Object.keys(GENDER_FOLDERS_MAP).includes(s.toUpperCase()));
        
        if (gendersIn3d.length > 0) {
          for (const gd of gendersIn3d) {
            const gKey = GENDER_FOLDERS_MAP[gd.toUpperCase()];
            folderInfo.imageCount[gKey] = countImagesInDir(path.join(threeDPath, gd));
            folderInfo.subfolders.push(gd);
          }
        } else {
          folderInfo.imageCount.loose = countImagesInDir(threeDPath);
        }
      } else if (detection.pattern === 'gender_folders') {
        folderInfo.subfolders = detection.genderDirs;
        for (const gd of detection.genderDirs) {
          const gKey = GENDER_FOLDERS_MAP[gd.toUpperCase()];
          if (gKey) folderInfo.imageCount[gKey] = countImagesInDir(path.join(dirPath, gd));
        }
      } else if (detection.pattern === 'loose_images') {
        const imgs = fs.readdirSync(dirPath).filter(f => IMAGE_EXTENSIONS.test(f));
        // Try to classify by filename
        for (const img of imgs) {
          const g = detectGenderFromFilename(img);
          folderInfo.imageCount[g || 'loose']++;
        }
      } else if (detection.pattern === 'jpeg_optimized') {
        folderInfo.subfolders = [detection.sourceDir];
        folderInfo.imageCount.loose = countImagesInDir(path.join(dirPath, detection.sourceDir));
      }

      folderInfo.totalImages = Object.values(folderInfo.imageCount).reduce((a, b) => a + b, 0);
      totalImages += folderInfo.totalImages;
      patternCounts[detection.pattern] = (patternCounts[detection.pattern] || 0) + 1;
      
      if (folderInfo.totalImages > 0 || detection.pattern !== 'empty') {
        folders.push(folderInfo);
      }
    }

    // Sort folders naturally
    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Determine dominant pattern
    const dominantPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    res.json({
      success: true,
      networkPath: normalizedPath,
      rootFolderName: rootName,
      detectedPattern: dominantPattern,
      folders,
      summary: {
        totalFolders: folders.length,
        totalImages,
        patterns: patternCounts
      }
    });

    console.log(`📡 Network scan: ${normalizedPath} → ${folders.length} pastas, ${totalImages} imagens (${dominantPattern})`);

  } catch (err) {
    console.error('❌ Erro no scan de rede:', err.message);
    res.status(500).json({ error: 'Erro ao escanear a rede. Verifique a conexão.' });
  }
});

/**
 * POST /api/network/smart-scan
 * Busca inteligente: recebe códigos, auto-detecta pasta na rede,
 * busca imagens com algoritmo cascata, extrai estampas dos nomes.
 * 🔒 Usa network-safety.js — SOMENTE LEITURA.
 *
 * AUDITORIA v2 — Bugs corrigidos:
 *  #1  Case sensitivity no prefixo
 *  #2  Limite de batch (max 100)
 *  #3  Rejeição de prefixos misturados
 *  #4  JPEG_imagens na cascata
 *  #5  KIDS no gender detection
 *  #6  Smart Sort COSTAS? (sem S)
 *  #7  Smart Sort abreviações PERSPEC/PESP/ZOOM
 *  #8  Estampa regex com hífens
 *  #9  Title case preserva siglas (UV50, BRK)
 *  #10 Sanitização de values em codes
 *  #11 Proteção path traversal
 */
router.post('/api/network/smart-scan', (req, res) => {
  try {
    const { codes: rawCodes } = req.body;
    if (!rawCodes || !Array.isArray(rawCodes) || rawCodes.length === 0) {
      return res.status(400).json({ error: 'Array de códigos é obrigatório.' });
    }

    // ── FIX #2: Limite de batch ──
    if (rawCodes.length > 100) {
      return res.status(400).json({ error: 'Máximo 100 códigos por scan.', received: rawCodes.length });
    }

    // ── FIX #10: Sanitizar values — filtrar não-strings, trim, remover vazios ──
    const codes = rawCodes
      .filter(c => typeof c === 'string')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (codes.length === 0) {
      return res.status(400).json({ error: 'Nenhum código válido fornecido.' });
    }

    // ── FIX #11: Proteção path traversal ──
    const dangerousPattern = /[.]{2}|[\/\\]{2,}|[<>"|?*]/;
    const unsafeCodes = codes.filter(c => dangerousPattern.test(c));
    if (unsafeCodes.length > 0) {
      return res.status(400).json({ error: 'Códigos contêm caracteres inválidos.', invalid: unsafeCodes });
    }

    // ── SMART PREFIX MATCHING ──
    // Tenta o match mais longo primeiro contra os prefixos conhecidos
    // Suporta prefixos com números como C0, T0, CM0, etc.
    // Ignora chaves internas como _VERSAO, _NOTA, _REDE_NOVA, _REDE_ANTIGA
    function findBestPrefix(code) {
      const upper = code.toUpperCase();
      const knownKeys = Object.keys(networkPrefixes).filter(k => !k.startsWith('_'));
      // Ordenar por comprimento DESC — prefixos mais longos primeiro (CCPBR antes de C)
      const sorted = knownKeys.sort((a, b) => b.length - a.length);
      for (const key of sorted) {
        if (upper.startsWith(key)) return key;
      }
      return null;
    }

    const firstCode = codes[0].toUpperCase();
    const prefix = findBestPrefix(firstCode);
    if (!prefix) {
      return res.status(404).json({
        error: `Não foi possível encontrar prefixo para "${codes[0]}". Nenhum prefixo conhecido começa com essas letras.`,
        knownPrefixes: Object.keys(networkPrefixes).filter(k => !k.startsWith('_'))
      });
    }
    const prefixConfig = resolvePrefixConfig(prefix);
    if (!prefixConfig) {
      return res.status(404).json({ error: `Configuração inválida para prefixo "${prefix}".` });
    }
    const networkFolder = prefixConfig.folder;
    const networkRoot = prefixConfig.root;

    // ── FIX #3: Rejeitar prefixos misturados ──
    const allPrefixes = new Set(
      codes.map(c => findBestPrefix(c)).filter(Boolean)
    );
    if (allPrefixes.size > 1) {
      return res.status(400).json({
        error: 'Todos os códigos devem ter o mesmo prefixo. Envie lotes separados por linha de produto.',
        detected: [...allPrefixes]
      });
    }

    const basePath = path.join(networkRoot, networkFolder);

    if (!networkSafety.safeExists(basePath)) {
      return res.status(404).json({ error: `Pasta não encontrada na rede: ${basePath}` });
    }

    // Listar pastas no diretório da rede (1 chamada só)
    // Filtrar pastas de trabalho pendente (para_formatar, PARA FORMATAR)
    const IGNORE_FOLDERS = ['PARA_FORMATAR', 'PARA FORMATAR', 'ARQ ESTAMPAS PROFISSAO', 'MODELOS ML'];
    const allFolders = networkSafety.safeReadDir(basePath)
      .filter(item => item.isDirectory && !IGNORE_FOLDERS.includes(item.name.toUpperCase()))
      .map(item => item.name);

    // ── FIX #5: Gender detection com KIDS ──
    // GENDER_NAMES + classifyGender → unified in config/image-utils.js

    // ── Helper: buscar imagens numa pasta, incluindo JPEG_imagens (#4) ──
    // Filtrar placeholders, layouts, designs, gabaritos
    function scanImagesInDir(dirPath) {
      try {
        let imgs = networkSafety.safeReadImages(dirPath)
          .filter(img => !shouldExcludeImage(img.name));
        // FIX #4: Se não encontrou imagens diretas, tentar JPEG_imagens
        if (imgs.length === 0) {
          const sub = networkSafety.safeReadDir(dirPath).filter(c => c.isDirectory);
          const jpegDir = sub.find(s => s.name.toUpperCase() === 'JPEG_IMAGENS');
          if (jpegDir) {
            imgs = networkSafety.safeReadImages(path.join(dirPath, jpegDir.name))
              .filter(img => !shouldExcludeImage(img.name));
          }
        }
        return imgs;
      } catch (e) {
        return [];
      }
    }

    // ── FIX #9: Title case inteligente (preserva siglas ≤4 chars) ──
    function smartTitleCase(text) {
      return text
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(w => {
          // Casos especiais de marca
          if (/^ArmorX$/i.test(w)) return 'ArmorX';
          if (/^FusionX$/i.test(w)) return 'FusionX';
          if (/^BRK$/i.test(w)) return 'BRK';
          if (/^UV\d*\+?$/i.test(w)) return w.toUpperCase();
          // Preservar siglas: palavras 100% maiúsculas com ≤ 4 chars ou com números
          if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
          if (/\d/.test(w)) return w.toUpperCase();
          // Preposições em minúsculo
          if (['com', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na'].includes(w.toLowerCase())) {
            return w.toLowerCase();
          }
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
    }

    const results = [];
    let totalImages = 0;
    let missingCount = 0;
    let errorCount = 0;

    for (const code of codes) {
      const codeUpper = code.toUpperCase();

      // ── Per-code try/catch para resultados parciais ──
      try {
        // Encontrar pasta que começa com o código (case insensitive)
        const matchingFolder = allFolders.find(f => {
          const fUpper = f.toUpperCase();
          return fUpper === codeUpper
            || fUpper.startsWith(codeUpper + '_')
            || fUpper.startsWith(codeUpper + ' ')
            || fUpper.startsWith(codeUpper + '-');
        });

        if (!matchingFolder) {
          results.push({ code: codeUpper, folder: null, estampa: null, images: [], source: null, totalImages: 0, found: false });
          missingCount++;
          continue;
        }

        const folderPath = path.join(basePath, matchingFolder);

        // ── Estampa: regex com hífens, separadores, BONES (BA010 - NOME) ──
        let estampa = null;
        let fullTitle = null;
        // Padrão 1: CODIGO_NOME ou CODIGO NOME ou CODIGO-NOME
        let estampaMatch = matchingFolder.match(/^[A-Z]+\d*[-_ ]+(.+)$/i);
        // Padrão 2: BONES: BA010 - SAO BENTO PRETO (com " - ")
        if (!estampaMatch) estampaMatch = matchingFolder.match(/^[A-Z]+\d+\s*-\s*(.+)$/i);
        if (estampaMatch) {
          const raw = estampaMatch[1].trim();
          const rawLower = raw.toLowerCase();
          
          // Detectar se é um título completo (contém tipo de produto)
          const TITLE_KEYWORDS = [
            'bandana tubeneck', 'tubeneck brk', 'lenço com proteção', 'lenço com protecao',
            'camisa de pesca', 'camiseta', 'camisa brk', 'camisa armorx', 'camisa fusionx',
            'black mask', 'corta vento', 'boné', 'caneca', 'copo térmico', 'capa almofada',
          ];
          const isFullTitle = TITLE_KEYWORDS.some(kw => rawLower.includes(kw));
          
          if (isFullTitle) {
            fullTitle = raw; // Guardar título original
            
            // Extrair SOMENTE a estampa do título completo
            // Padrão Tubeneck: "Bandana Tubeneck Brk {ESTAMPA} com Proteção UV50+"
            let m = raw.match(/Bandana\s+Tubeneck\s+Brk\s+(.+?)\s+com\s+Prote[çc][ãa]o/i);
            if (!m) m = raw.match(/Tubeneck\s+Brk\s+(.+?)\s+com\s+Prote[çc][ãa]o/i);
            // Padrão Lenço: "Lenço com Proteção UV50 Brk {ESTAMPA}"
            if (!m) m = raw.match(/Len[çc]o\s+com\s+Prote[çc][ãa]o\s+UV\d*\s+Brk\s+(.+)$/i);
            // Padrão Camisa: "Camisa de Pesca Brk {ESTAMPA} com Proteção UV50+"
            if (!m) m = raw.match(/Camisa\s+(?:de\s+Pesca\s+)?Brk\s+(.+?)\s+com\s+Prote[çc][ãa]o/i);
            // Padrão ArmorX: "Camisa ArmorX {ESTAMPA} com Luva"
            if (!m) m = raw.match(/Camisa\s+ArmorX\s+(.+?)\s+com\s+/i);
            // Padrão FusionX: "Camisa FusionX {ESTAMPA} com Proteção"
            if (!m) m = raw.match(/Camisa\s+FusionX\s+(.+?)\s+com\s+/i);
            
            if (m) {
              estampa = smartTitleCase(m[1].trim());
            } else {
              // Fallback: usar título inteiro como estampa (buildProductTitle já sabe lidar)
              estampa = smartTitleCase(raw);
            }
          } else {
            // Nome simples da pasta (ex: "ARMORX_PRETO") → estampa pura
            estampa = smartTitleCase(raw);
          }
        }

        // Buscar imagens com algoritmo cascata
        let images = [];
        let source = null;

        let contents;
        try { contents = networkSafety.safeReadDir(folderPath); } catch (e) { contents = []; }
        const subDirs = contents.filter(c => c.isDirectory).map(c => c.name);
        const subDirsUpper = subDirs.map(s => s.toUpperCase());

        // ── Cascata 1: pasta 3D/ ──
        if (subDirsUpper.includes('3D')) {
          const threeDName = subDirs[subDirsUpper.indexOf('3D')];
          const threeDPath = path.join(folderPath, threeDName);
          images = scanImagesInDir(threeDPath);
          source = '3D';

          // Se 3D tem subpastas de gênero, buscar dentro delas
          if (images.length === 0) {
            try {
              const threeDContents = networkSafety.safeReadDir(threeDPath);
              const genderDirs = threeDContents.filter(c => c.isDirectory && GENDER_NAMES.includes(c.name.toUpperCase()));
              for (const gd of genderDirs) {
                try {
                  const gImages = scanImagesInDir(path.join(threeDPath, gd.name));
                  const genderLabel = classifyGender(gd.name);
                  gImages.forEach(img => { img.gender = genderLabel; });
                  images = images.concat(gImages);
                } catch (e) { /* subpasta inacessível, continua */ }
              }
              if (images.length > 0) source = '3D/GENDER';
            } catch (e) { /* 3D inacessível */ }
          }
        }

        // ── Cascata 2: pastas MASC/FEM/INF/KIDS na raiz ──
        if (images.length === 0) {
          const genderDirs = subDirs.filter(s => GENDER_NAMES.includes(s.toUpperCase()));
          for (const gd of genderDirs) {
            try {
              const genderPath = path.join(folderPath, gd);
              let gImages = scanImagesInDir(genderPath);
              const genderLabel = classifyGender(gd);

              // Se não encontrou imagens diretas, buscar em subpastas de COR
              // Estrutura: MASC/PRETO/imagens, MASC/BRANCO/imagens, MASC/BEGE/imagens
              if (gImages.length === 0) {
                try {
                  const colorDirs = networkSafety.safeReadDir(genderPath).filter(c => c.isDirectory);
                  for (const colorDir of colorDirs) {
                    try {
                      const colorImages = scanImagesInDir(path.join(genderPath, colorDir.name));
                      colorImages.forEach(img => {
                        img.gender = genderLabel;
                        img.variant = colorDir.name; // PRETO, BRANCO, BEGE
                      });
                      gImages = gImages.concat(colorImages);
                    } catch (e) { /* cor inacessível */ }
                  }
                } catch (e) { /* gender inacessível */ }
              } else {
                gImages.forEach(img => { img.gender = genderLabel; });
              }

              images = images.concat(gImages);
            } catch (e) { /* subpasta inacessível, continua */ }
          }
          if (images.length > 0) source = 'GENDER';
        }

        // ── Cascata 3: pasta SITE/ (HYB, ADV usam essa) ──
        if (images.length === 0) {
          const siteIdx = subDirsUpper.indexOf('SITE');
          if (siteIdx >= 0) {
            images = scanImagesInDir(path.join(folderPath, subDirs[siteIdx]));
            source = 'SITE';
          }
        }

        // ── Cascata 4: pasta MOCKUP HUMANIZADO / HUMANIZADO ATUALIZADO / MOCKUP ATUALIZADO ──
        if (images.length === 0) {
          const humanIdx = subDirsUpper.findIndex(s => s.includes('HUMANIZADO') || s === 'MOCKUP ATUALIZADO');
          if (humanIdx >= 0) {
            const humPath = path.join(folderPath, subDirs[humanIdx]);
            images = scanImagesInDir(humPath);
            // Se tem subpastas de cor (BRANCA/PRETA) ou gênero, buscar dentro
            if (images.length === 0) {
              try {
                const humContents = networkSafety.safeReadDir(humPath).filter(c => c.isDirectory);
                for (const sub of humContents) {
                  try {
                    const subImages = scanImagesInDir(path.join(humPath, sub.name));
                    subImages.forEach(img => {
                      const sn = sub.name.toUpperCase();
                      if (GENDER_NAMES.includes(sn)) img.gender = classifyGender(sub.name);
                      else img.variant = sub.name; // BRANCA, PRETA, etc.
                    });
                    images = images.concat(subImages);
                  } catch (e) {}
                }
              } catch (e) {}
            }
            if (images.length > 0) source = subDirs[humanIdx].toUpperCase();
          }
        }

        // ── Cascata 5: pasta MOCKUP/ ou MOCKUP AGRO/ (genérica) ──
        if (images.length === 0) {
          const mockupIdx = subDirsUpper.findIndex(s => s === 'MOCKUP' || s.startsWith('MOCKUP ') || s.startsWith('MOCKUP_'));
          if (mockupIdx >= 0) {
            const mockPath = path.join(folderPath, subDirs[mockupIdx]);
            images = scanImagesInDir(mockPath);
            // Verificar subpastas dentro do MOCKUP:
            // Pode ter gênero (MASC/FEM) ou cor (BRANCA/PRETA) ou ambos
            if (images.length === 0) {
              try {
                const mockContents = networkSafety.safeReadDir(mockPath).filter(c => c.isDirectory);
                for (const sub of mockContents) {
                  try {
                    const subPath = path.join(mockPath, sub.name);
                    const subUpper = sub.name.toUpperCase();
                    
                    if (GENDER_NAMES.includes(subUpper)) {
                      // É gênero → buscar imagens diretas ou em subpastas de cor
                      let gImages = scanImagesInDir(subPath);
                      const genderLabel = classifyGender(sub.name);
                      if (gImages.length === 0) {
                        const colorDirs = networkSafety.safeReadDir(subPath).filter(c => c.isDirectory);
                        for (const cd of colorDirs) {
                          try {
                            const cImages = scanImagesInDir(path.join(subPath, cd.name));
                            cImages.forEach(img => { img.gender = genderLabel; img.variant = cd.name; });
                            gImages = gImages.concat(cImages);
                          } catch (e) {}
                        }
                      } else {
                        gImages.forEach(img => { img.gender = genderLabel; });
                      }
                      images = images.concat(gImages);
                    } else {
                      // Subpasta genérica (cor, etc)
                      const subImages = scanImagesInDir(subPath);
                      subImages.forEach(img => { img.variant = sub.name; });
                      images = images.concat(subImages);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
            if (images.length > 0) source = subDirs[mockupIdx].toUpperCase();
          }
        }

        // ── Cascata 6: pasta imagens_para_site/ (CANECAS) ──
        if (images.length === 0) {
          const siteImgIdx = subDirsUpper.findIndex(s => s === 'IMAGENS_PARA_SITE');
          if (siteImgIdx >= 0) {
            images = scanImagesInDir(path.join(folderPath, subDirs[siteImgIdx]));
            source = 'IMAGENS_PARA_SITE';
          }
        }

        // ── Cascata 7: pasta JPEG_IMAGENS na raiz ──
        if (images.length === 0) {
          const jpegIdx = subDirsUpper.findIndex(s => s === 'JPEG_IMAGENS');
          if (jpegIdx >= 0) {
            images = scanImagesInDir(path.join(folderPath, subDirs[jpegIdx]));
            source = 'JPEG_IMAGENS';
          }
        }

        // ── Cascata 8: imagens soltas na raiz (filtrar placeholders) ──
        if (images.length === 0) {
          images = contents.filter(c => c.isFile && c.isImage && !shouldExcludeImage(c.name));
          if (images.length > 0) source = 'RAIZ';
        }

        smartSortImageObjects(images);

        // Mapear campos finais (tamanho obtido depois da cópia local, não aqui)
        // Detectar imagens humanizadas (com modelo vestindo)
        const HUMANIZED_PATH_KEYWORDS = ['HUMANIZADO', 'HUMANIZADA', 'HUMANIZADOS', 'MODELO', 'MODELOS'];
        const HUMANIZED_FILE_KEYWORDS = /HUMANIZAD[OA]|MODELO|MODEL/i;

        images = images.map(img => {
          // Detectar se é humanizada pelo path ou nome
          const pathUpper = (img.fullPath || '').toUpperCase();
          const nameUpper = (img.name || '').toUpperCase().replace(/\.[^.]+$/, '');
          const isHumanized = HUMANIZED_PATH_KEYWORDS.some(k => pathUpper.includes('\\' + k + '\\'))
            || HUMANIZED_FILE_KEYWORDS.test(nameUpper);

          return {
            name: img.name,
            fullPath: img.fullPath,
            size: 0,
            sizeKB: 0,
            priority: img.priority || 5,
            gender: img.gender || null,
            variant: img.variant || null,
            extension: img.extension,
            isHumanized: isHumanized
          };
        });

        totalImages += images.length;

        // Detectar cores disponíveis para este código (APC: PRETA→Preto, BRANCA→Branco, BEGE→Bege)
        const COLOR_VARIANT_MAP = {
          'PRETA': 'Preto', 'PRETO': 'Preto', 'PRETAS': 'Preto',
          'BRANCA': 'Branco', 'BRANCO': 'Branco', 'BRANCAS': 'Branco',
          'BEGE': 'Bege', 'BEGES': 'Bege'
        };
        const detectedColorSet = new Set();
        images.forEach(img => {
          if (img.variant) {
            const normalized = img.variant.toUpperCase().trim();
            img.variant = normalized; // Normalizar o variant para uppercase
            const mapped = COLOR_VARIANT_MAP[normalized];
            if (mapped) detectedColorSet.add(mapped);
          }
        });
        const detectedColors = [...detectedColorSet];

        results.push({
          code: codeUpper,
          folder: matchingFolder,
          estampa,
          fullTitle,  // Título completo da pasta (se detectado)
          images,
          source,
          totalImages: images.length,
          detectedColors, // ['Preto', 'Branco', 'Bege'] ou ['Preto'] etc.
          found: true
        });

      } catch (codeErr) {
        // Erro neste código específico — não aborta o scan inteiro
        errorCount++;
        results.push({
          code: codeUpper,
          folder: null,
          estampa: null,
          images: [],
          source: null,
          totalImages: 0,
          found: false,
          error: codeErr.message
        });
        console.warn(`⚠️ Smart-scan erro em ${codeUpper}: ${codeErr.message}`);
      }
    }

    const response = {
      success: true,
      prefix,
      networkPath: basePath,
      networkFolder,
      results,
      summary: {
        totalCodes: codes.length,
        found: codes.length - missingCount - errorCount,
        missing: missingCount,
        errors: errorCount,
        totalImages
      }
    };

    console.log(`🔍 Smart-scan: ${prefix} → ${codes.length} códigos, ${codes.length - missingCount} encontrados, ${totalImages} imagens${errorCount > 0 ? `, ${errorCount} erros` : ''}`);
    res.json(response);

  } catch (err) {
    console.error('❌ Erro no smart-scan:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/network/copy
 * Copia imagens da rede para pasta local.
 * Usa SSE para reportar progresso em tempo real.
 * NUNCA modifica arquivos na rede — apenas leitura + cópia.
 */
router.post('/api/network/copy', (req, res) => {
  const { networkPath, localBasePath, collectionName, folders: selectedFolders, preferJpeg } = req.body;

  if (!networkPath || !localBasePath) {
    return res.status(400).json({ error: 'networkPath e localBasePath são obrigatórios.' });
  }

  // 🔒 Segurança: destino NUNCA pode ser na rede
  if (networkSafety.isNetworkPath(localBasePath)) {
    return res.status(403).json({ error: '🔒 Operação bloqueada: destino de cópia não pode ser na rede.' });
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // 🔒 Abort flag: stop copy if client disconnects
  let aborted = false;
  req.on('close', () => { aborted = true; });

  function sendEvent(event, data) {
    if (aborted) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) { aborted = true; }
  }

  try {
    const normalizedNetwork = path.resolve(networkPath);
    const collName = collectionName || path.basename(normalizedNetwork);
    const localRoot = path.join(path.resolve(localBasePath), collName);

    // Create local root
    fs.mkdirSync(localRoot, { recursive: true });
    sendEvent('status', { message: `Pasta criada: ${localRoot}`, localRoot });

    // Get folders to process
    let foldersToProcess = selectedFolders;
    if (!foldersToProcess || foldersToProcess.length === 0) {
      // If no selection, process all
      foldersToProcess = fs.readdirSync(normalizedNetwork, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
        .map(e => e.name);
    }

    let totalCopied = 0;
    let totalErrors = 0;
    const folderResults = [];

    for (let fi = 0; fi < foldersToProcess.length; fi++) {
      if (aborted) { sendEvent('done', { message: 'Cópia cancelada — cliente desconectou.' }); res.end(); return; }
      const folderName = foldersToProcess[fi];
      // Pattern D: se folder === rootFolderName, usar normalizedNetwork diretamente
      const sourcePath = (folderName === path.basename(normalizedNetwork))
        ? normalizedNetwork
        : path.join(normalizedNetwork, folderName);
      
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
        sendEvent('progress', { folder: folderName, status: 'skipped', reason: 'Pasta não encontrada' });
        continue;
      }

      const detection = detectFolderPattern(sourcePath);
      const localCodePath = path.join(localRoot, folderName);
      fs.mkdirSync(localCodePath, { recursive: true });

      let copied = 0;
      let errors = 0;

      sendEvent('progress', { folder: folderName, status: 'scanning', folderIndex: fi + 1, totalFolders: foldersToProcess.length, pattern: detection.pattern });

      function copyFile(srcFile, destDir, newName) {
        try {
          fs.mkdirSync(destDir, { recursive: true });
          const destFile = path.join(destDir, newName || path.basename(srcFile));
          // 🔒 Usar safeCopyFromNetwork em vez de fs.copyFileSync
          networkSafety.safeCopyFromNetwork(srcFile, destFile);
          copied++;
          return true;
        } catch (err) {
          errors++;
          console.error(`   ⚠️ Erro copiando ${srcFile}: ${err.message}`);
          return false;
        }
      }

      function copyImagesFromDir(sourceDir, destDir, recurseIntoVariants = true) {
        if (!fs.existsSync(sourceDir)) return;
        const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
        // Copy images at this level
        const imageFiles = entries.filter(e => !e.isDirectory() && IMAGE_EXTENSIONS.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
        for (const file of imageFiles) {
          copyFile(path.join(sourceDir, file.name), destDir);
        }
        // Recurse into variant/color subfolders (PRETA, BRANCA, BEGE, SITE, 3D etc.)
        // Skip gender folders to avoid mixing (those are handled at the caller level)
        if (recurseIntoVariants) {
          const genderNames = Object.keys(GENDER_FOLDERS_MAP);
          const subdirs = entries.filter(e => e.isDirectory() && !genderNames.includes(e.name.toUpperCase()) && e.name.toUpperCase() !== 'JPEG_IMAGENS');
          for (const sub of subdirs) {
            const subDestDir = path.join(destDir, sub.name);
            fs.mkdirSync(subDestDir, { recursive: true });
            copyImagesFromDir(path.join(sourceDir, sub.name), subDestDir, true);
          }
        }
      }

      // Process based on detected pattern
      if (detection.pattern === '3d_folder') {
        const threeDPath = path.join(sourcePath, detection.sourceDir || '3d');
        // Check if 3d has gender subfolders
        const subEntries = fs.readdirSync(threeDPath, { withFileTypes: true });
        const genderSubdirs = subEntries.filter(e => e.isDirectory() && Object.keys(GENDER_FOLDERS_MAP).includes(e.name.toUpperCase()));
        
        if (genderSubdirs.length > 0) {
          for (const gd of genderSubdirs) {
            const gKey = GENDER_FOLDERS_MAP[gd.name.toUpperCase()];
            const destGender = gKey === 'masc' ? 'MASC' : gKey === 'fem' ? 'FEM' : 'INF';
            // Check for JPEG_imagens inside gender dir
            const jpegInGender = path.join(threeDPath, gd.name, 'JPEG_imagens');
            if (preferJpeg && fs.existsSync(jpegInGender)) {
              copyImagesFromDir(jpegInGender, path.join(localCodePath, destGender));
            } else {
              copyImagesFromDir(path.join(threeDPath, gd.name), path.join(localCodePath, destGender));
            }
          }
        } else {
          // All images in 3d/ without gender separation
          // Check for JPEG_imagens inside 3d
          const jpegIn3d = path.join(threeDPath, 'JPEG_imagens');
          if (preferJpeg && fs.existsSync(jpegIn3d)) {
            copyImagesFromDir(jpegIn3d, localCodePath);
          } else {
            copyImagesFromDir(threeDPath, localCodePath);
          }
        }
      } else if (detection.pattern === 'gender_folders') {
        for (const gd of detection.genderDirs) {
          const gKey = GENDER_FOLDERS_MAP[gd.toUpperCase()];
          const destGender = gKey === 'masc' ? 'MASC' : gKey === 'fem' ? 'FEM' : 'INF';
          const srcGenderPath = path.join(sourcePath, gd);
          // Check for JPEG_imagens
          const jpegInGender = path.join(srcGenderPath, 'JPEG_imagens');
          if (preferJpeg && fs.existsSync(jpegInGender)) {
            copyImagesFromDir(jpegInGender, path.join(localCodePath, destGender));
          } else {
            copyImagesFromDir(srcGenderPath, path.join(localCodePath, destGender));
          }
        }
      } else if (detection.pattern === 'loose_images') {
        // Check for JPEG_imagens in loose folder
        const jpegInLoose = path.join(sourcePath, 'JPEG_imagens');
        if (preferJpeg && fs.existsSync(jpegInLoose)) {
          // Copiar de JPEG_imagens, classificando por nome
          const jpegImages = fs.readdirSync(jpegInLoose).filter(f => IMAGE_EXTENSIONS.test(f)).sort();
          for (const img of jpegImages) {
            const gender = detectGenderFromFilename(img);
            if (gender) {
              const destGender = gender === 'masc' ? 'MASC' : gender === 'fem' ? 'FEM' : 'INF';
              copyFile(path.join(jpegInLoose, img), path.join(localCodePath, destGender));
            } else {
              copyFile(path.join(jpegInLoose, img), localCodePath);
            }
          }
        } else {
          // Classify by filename
          const allImages = fs.readdirSync(sourcePath).filter(f => IMAGE_EXTENSIONS.test(f)).sort();
          for (const img of allImages) {
            const gender = detectGenderFromFilename(img);
            if (gender) {
              const destGender = gender === 'masc' ? 'MASC' : gender === 'fem' ? 'FEM' : 'INF';
              copyFile(path.join(sourcePath, img), path.join(localCodePath, destGender));
            } else {
              copyFile(path.join(sourcePath, img), localCodePath);
            }
          }
        }
      } else if (detection.pattern === 'jpeg_optimized') {
        copyImagesFromDir(path.join(sourcePath, detection.sourceDir), localCodePath);
      }

      totalCopied += copied;
      totalErrors += errors;
      folderResults.push({ name: folderName, copied, errors, pattern: detection.pattern });

      sendEvent('progress', {
        folder: folderName,
        status: 'done',
        copied,
        errors,
        pattern: detection.pattern,
        folderIndex: fi + 1,
        totalFolders: foldersToProcess.length,
        percentComplete: Math.round(((fi + 1) / foldersToProcess.length) * 100)
      });

      console.log(`📋 Copiado: ${folderName} → ${copied} imagens (${detection.pattern})`);
    }

    sendEvent('complete', {
      success: true,
      localPath: localRoot,
      totalCopied,
      totalErrors,
      totalFolders: folderResults.length,
      folders: folderResults
    });

    console.log(`✅ Network copy completo: ${totalCopied} imagens copiadas para ${localRoot}`);
    res.end();

  } catch (err) {
    console.error('❌ Erro na cópia de rede:', err.message);
    sendEvent('error', { message: 'Erro na cópia de rede. Verifique a conexão.' });
    res.end();
  }
});

  return router;
};
