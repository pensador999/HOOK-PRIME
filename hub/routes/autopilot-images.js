/**
 * @module autopilot-images
 * @audit Extracted from server.js
 */
module.exports = (deps) => {
  const { uploadsDir, fs, path, networkSafety, imageUtils } = deps;
  const router = require('express').Router();

  const getSmartSortPriority = imageUtils.getImagePriority;



/**
 * POST /api/autopilot/scan-folder
 * Recebe um caminho local e retorna a estrutura de subpastas + arquivos
 */
router.post('/api/autopilot/scan-folder', (req, res) => {
  const { folderPath } = req.body;

  if (!folderPath) {
    return res.status(400).json({ error: 'Caminho da pasta é obrigatório.' });
  }

  try {
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: `Pasta não encontrada: ${folderPath}` });
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'O caminho informado não é uma pasta.' });
    }

    const imgExt = /\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/i;
    function countImagesRecursive(dir) {
      let count = 0;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) count += countImagesRecursive(path.join(dir, e.name));
          else if (imgExt.test(e.name)) count++;
        }
      } catch {}
      return count;
    }

    const subfolders = fs.readdirSync(folderPath)
      .filter(name => {
        const fullPath = path.join(folderPath, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .map(name => {
        const subPath = path.join(folderPath, name);
        const totalCount = countImagesRecursive(subPath);

        return {
          name,
          path: subPath,
          images: [],
          imageCount: totalCount,
        };
      });

    res.json({
      basePath: folderPath,
      totalFolders: subfolders.length,
      totalImages: subfolders.reduce((sum, f) => sum + f.imageCount, 0),
      folders: subfolders,
    });
  } catch (err) {
    res.status(500).json({ error: `Erro ao ler pasta: ${err.message}` });
  }
});

/**
 * GET /api/preview-image
 * Serves a local image file as a thumbnail for the live preview panel.
 * Query: ?path=C:/path/to/image.jpg
 * Returns the image with correct content-type.
 */
router.get('/api/preview-image', (req, res) => {
  const imgPath = req.query.path;
  if (!imgPath) return res.status(400).json({ error: 'path is required' });

  // 🔒 Security: only allow images from uploads/ directory
  const normalizedPath = path.resolve(imgPath);
  const safeUploadsDir = path.resolve(uploadsDir);
  
  // Bloquear caminhos de rede
  if (networkSafety.isNetworkPath(normalizedPath)) {
    return res.status(403).json({ error: '🔒 Access denied - network paths are not allowed' });
  }

  if (!normalizedPath.startsWith(safeUploadsDir)) {
    return res.status(403).json({ error: 'Access denied - path must be inside uploads/' });
  }

  if (!fs.existsSync(normalizedPath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const ext = path.extname(normalizedPath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.bmp': 'image/bmp',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(normalizedPath)
    .on('error', (err) => {
      console.error('[preview-image] Stream error:', err.message);
      if (!res.headersSent) res.status(500).end();
    })
    .pipe(res);
});

router.post('/api/autopilot/generate-apc-spreadsheet', (req, res) => {
  const { codes, taskTitle, taskId, cdnUrls, colors, genders } = req.body;
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'Array de codes é obrigatório.' });
  }

  try {
    // Header Bling (59 campos)
    const HEADER = [
      'ID','Código','Descrição','Unidade','NCM','Origem','Preço','Valor IPI fixo',
      'Observações','Situação','Estoque','Preço de custo','Cód. no fornecedor',
      'Fornecedor','Localização','Estoque máximo','Estoque mínimo',
      'Peso líquido (Kg)','Peso bruto (Kg)','GTIN/EAN','GTIN/EAN da Embalagem',
      'Largura do produto','Altura do Produto','Profundidade do produto',
      'Data Validade','Descrição do Produto no Fornecedor','Descrição Complementar',
      'Itens p/ caixa','Produto Variação','Tipo Produção',
      'Classe de enquadramento do IPI','Código na Lista de Serviços',
      'Tipo do item','Grupo de Tags/Tags','Tributos','Código Pai',
      'Código Integração','Grupo de produtos','Marca','CEST','Volumes',
      'Descrição Curta','Cross-Docking','URL Imagens Externas','Link Externo',
      'Meses Garantia no Fornecedor','Clonar dados do pai','Condição do Produto',
      'Frete Grátis','Número FCI','Vídeo','Departamento','Unidade de Medida',
      'Preço de Compra','Valor base ICMS ST para retenção',
      'Valor ICMS ST para retenção','Valor ICMS próprio do substituto',
      'Categoria do produto','Informações Adicionais'
    ];

    const SIZES = ['P', 'M', 'G', 'GG', 'G1', 'G2'];
    
    const requestedColors = (colors && colors.length > 0) ? colors : ['Preto', 'Branco', 'Bege'];
    const COLORS_MAP = {
      'Preto': { codeColor: 'PRETO',  folderColor: 'PRETA' },
      'Branco': { codeColor: 'BRANCO', folderColor: 'BRANCA' },
      'Bege': { codeColor: 'BEGE',   folderColor: 'BEGE' },
    };
    
    const activeColors = requestedColors.map(c => ({
      name: c,
      codeColor: COLORS_MAP[c] ? COLORS_MAP[c].codeColor : c.toUpperCase(),
      folderColor: COLORS_MAP[c] ? COLORS_MAP[c].folderColor : c.toUpperCase()
    }));

    const requestedGenders = (genders && genders.length > 0) ? genders.map(g => g.toLowerCase()) : ['masc', 'fem'];
    const includeMasc = requestedGenders.includes('masc');
    const includeFem = requestedGenders.includes('fem');

    // Valores fixos do padrão APC
    const FIXED = {
      unidade: 'UN',
      ncm: '6205.20.00',
      origem: '0',
      preco: '99,9',
      ipi: '0',
      situacao: 'Ativo',
      estoque: '0',
      precoCusto: '22,83',
      pesoLiq: '0,25',
      pesoBruto: '0,25',
      largura: '22',
      altura: '4',
      profundidade: '30',
      itensCaixa: '1',
      variacao: 'Variação',
      producao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      tributos: '0',
      marca: 'Brk Agro',
      cest: '28.038.00',
      volumes: '1',
      descCurta: 'A',
      crossDocking: '0',
      garantia: '0',
      clonar: 'NÃO',
      condicao: 'NOVO',
      freteGratis: 'NÃO',
      unidadeMedida: 'Centímetro',
      precoCompra: '0',
      icmsST: '0',
      icmsRetencao: '0',
      icmsProprio: '0',
    };

    function buildDescription(estampa) {
      if (!estampa) return 'Camiseta Básica de Algodão Brk';
      const name = estampa.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      return `Camiseta Básica de Algodão Brk ${name}`;
    }

    function csvLine(fields) {
      return fields.map(f => {
        const val = f == null ? '' : String(f);
        if (val.includes(';') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(';');
    }

    const lines = [csvLine(HEADER)];
    const emptyLine = new Array(59).fill('').join(';');

    for (const rawItem of codes) {
      const item = typeof rawItem === 'string' ? { code: rawItem, estampa: '' } : rawItem;
      if (!item.code) continue;
      const baseCode = item.code.toUpperCase();
      const estampa = item.estampa || '';
      const description = buildDescription(estampa);

      let itemColors = activeColors;
      if (item.detectedColors && item.detectedColors.length > 0) {
        itemColors = activeColors.filter(c => item.detectedColors.includes(c.name));
      }
      if (itemColors.length === 0) continue;

      const urlMap = cdnUrls || {};
      const firstColor = itemColors[0];

      // BLOCK 1: MASCULINO
      if (includeMasc) {
        const parentCode = baseCode;
        const parentImageUrls = 
          urlMap[`${baseCode}_MASC_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.name}`] || 
          '';

        const parentFields = new Array(59).fill('');
        parentFields[1]  = parentCode;
        parentFields[2]  = description;
        parentFields[3]  = FIXED.unidade;
        parentFields[4]  = FIXED.ncm;
        parentFields[5]  = FIXED.origem;
        parentFields[6]  = FIXED.preco;
        parentFields[7]  = FIXED.ipi;
        parentFields[9]  = FIXED.situacao;
        parentFields[10] = FIXED.estoque;
        parentFields[11] = FIXED.precoCusto;
        parentFields[15] = '0';
        parentFields[16] = '0';
        parentFields[17] = FIXED.pesoLiq;
        parentFields[18] = FIXED.pesoBruto;
        parentFields[21] = FIXED.largura;
        parentFields[22] = FIXED.altura;
        parentFields[23] = FIXED.profundidade;
        parentFields[27] = FIXED.itensCaixa;
        parentFields[28] = FIXED.variacao;
        parentFields[29] = FIXED.producao;
        parentFields[32] = FIXED.tipoItem;
        parentFields[34] = FIXED.tributos;
        parentFields[35] = '';
        parentFields[36] = '0';
        parentFields[38] = FIXED.marca;
        parentFields[39] = FIXED.cest;
        parentFields[40] = FIXED.volumes;
        parentFields[41] = FIXED.descCurta;
        parentFields[42] = FIXED.crossDocking;
        parentFields[43] = parentImageUrls;
        parentFields[45] = FIXED.garantia;
        parentFields[46] = FIXED.clonar;
        parentFields[47] = FIXED.condicao;
        parentFields[48] = FIXED.freteGratis;
        parentFields[52] = FIXED.unidadeMedida;
        parentFields[53] = FIXED.precoCompra;
        parentFields[54] = FIXED.icmsST;
        parentFields[55] = FIXED.icmsRetencao;
        parentFields[56] = FIXED.icmsProprio;
        lines.push(csvLine(parentFields));

        for (const color of itemColors) {
          const imageUrls = 
            urlMap[`${baseCode}_MASC_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.name}`] ||
            '';

          for (const size of SIZES) {
            const varCode = `${parentCode}-PREMIUM-${color.codeColor}-${size}`;
            const varDesc = `Cor:${color.name};Tamanho:${size}`;
            
            const varFields = [...parentFields];
            varFields[1]  = varCode;
            varFields[2]  = varDesc;
            varFields[10] = FIXED.estoque;
            varFields[28] = FIXED.variacao;
            varFields[35] = parentCode;
            varFields[43] = imageUrls;
            lines.push(csvLine(varFields));
          }
        }
        lines.push(emptyLine);
      }

      // BLOCK 2: FEMININO
      if (includeFem) {
        const parentCode = `${baseCode}BL`;
        const parentImageUrls = 
          urlMap[`${baseCode}_FEM_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.name}`] || 
          '';

        const parentFields = new Array(59).fill('');
        parentFields[1]  = parentCode;
        parentFields[2]  = description;
        parentFields[3]  = FIXED.unidade;
        parentFields[4]  = FIXED.ncm;
        parentFields[5]  = FIXED.origem;
        parentFields[6]  = FIXED.preco;
        parentFields[7]  = FIXED.ipi;
        parentFields[9]  = FIXED.situacao;
        parentFields[10] = FIXED.estoque;
        parentFields[11] = FIXED.precoCusto;
        parentFields[15] = '0';
        parentFields[16] = '0';
        parentFields[17] = FIXED.pesoLiq;
        parentFields[18] = FIXED.pesoBruto;
        parentFields[21] = FIXED.largura;
        parentFields[22] = FIXED.altura;
        parentFields[23] = FIXED.profundidade;
        parentFields[27] = FIXED.itensCaixa;
        parentFields[28] = FIXED.variacao;
        parentFields[29] = FIXED.producao;
        parentFields[32] = FIXED.tipoItem;
        parentFields[34] = FIXED.tributos;
        parentFields[35] = '';
        parentFields[36] = '0';
        parentFields[38] = FIXED.marca;
        parentFields[39] = FIXED.cest;
        parentFields[40] = FIXED.volumes;
        parentFields[41] = FIXED.descCurta;
        parentFields[42] = FIXED.crossDocking;
        parentFields[43] = parentImageUrls;
        parentFields[45] = FIXED.garantia;
        parentFields[46] = FIXED.clonar;
        parentFields[47] = FIXED.condicao;
        parentFields[48] = FIXED.freteGratis;
        parentFields[52] = FIXED.unidadeMedida;
        parentFields[53] = FIXED.precoCompra;
        parentFields[54] = FIXED.icmsST;
        parentFields[55] = FIXED.icmsRetencao;
        parentFields[56] = FIXED.icmsProprio;
        lines.push(csvLine(parentFields));

        for (const color of itemColors) {
          const imageUrls = 
            urlMap[`${baseCode}_FEM_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.name}`] ||
            '';

          for (const size of SIZES) {
            const varCode = `${parentCode}-PREMIUM-${color.codeColor}-${size}`;
            const varDesc = `Cor:${color.name};Tamanho:${size}`;
            
            const varFields = [...parentFields];
            varFields[1]  = varCode;
            varFields[2]  = varDesc;
            varFields[10] = FIXED.estoque;
            varFields[28] = FIXED.variacao;
            varFields[35] = parentCode;
            varFields[43] = imageUrls;
            lines.push(csvLine(varFields));
          }
        }
        lines.push(emptyLine);
      }
    }

    const fileName = taskTitle
      ? taskTitle.replace(/[<>:"\/\\|?*]/g, '').replace(/\s+/g, ' ').trim() + '.csv'
      : 'APC_PLANILHA.csv';
    
    const savePath = taskId
      ? path.join(uploadsDir, 'autopilot', taskId, fileName)
      : path.join(uploadsDir, 'autopilot', fileName);
    
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, '\ufeff' + lines.join('\r\n'), 'utf-8');

    let totalProducts = 0;
    let totalVariations = 0;
    const allUsedColors = new Set();

    for (const rawItem of codes) {
      const item = typeof rawItem === 'string' ? { code: rawItem, estampa: '' } : rawItem;
      if (!item.code) continue;
      let itemColors = activeColors;
      if (item.detectedColors && item.detectedColors.length > 0) {
        itemColors = activeColors.filter(c => item.detectedColors.includes(c.name));
      }
      
      const multiplier = (includeMasc ? 1 : 0) + (includeFem ? 1 : 0);
      totalProducts += multiplier;
      totalVariations += itemColors.length * SIZES.length * multiplier;
      itemColors.forEach(c => allUsedColors.add(c.name));
    }

    const totalLines = lines.length;

    console.log(`📊 Planilha APC: ${codes.length} códigos, ${totalProducts} produtos (PAIs), ${totalVariations} variações`);

    res.json({
      success: true,
      fileName,
      filePath: savePath,
      downloadUrl: `/api/autopilot/download-spreadsheet?path=${encodeURIComponent(savePath)}`,
      summary: {
        totalCodes: codes.length,
        totalColors: allUsedColors.size,
        totalProducts,
        totalVariations,
        totalLines,
        colors: [...allUsedColors],
        sizes: SIZES,
      }
    });

  } catch (err) {
    console.error('❌ Erro ao gerar planilha APC:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/autopilot/download-spreadsheet
 * Download do arquivo CSV gerado
 */
router.get('/api/autopilot/download-spreadsheet', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Parâmetro path é obrigatório' });
    }
    const resolved = path.resolve(filePath);
    // Security: only allow files within uploads dir (using resolved path)
    if (!resolved.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    res.download(resolved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/autopilot/copy-network-images', (req, res) => {
  const { results, taskId } = req.body;
  if (!taskId || !results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'taskId e array de results são obrigatórios.' });
  }

  const responseResults = [];
  let summaryTotalCodes = 0;
  let summaryTotalImages = 0;
  let summaryTotalSizeKB = 0;
  let summaryFiltered = 0;

  try {
    for (const item of results) {
      const { code, estampa, images } = item;
      if (!images || !Array.isArray(images)) continue;

      summaryTotalCodes++;

      // Filtrar imagens humanizadas (com modelo)
      const filteredImages = images.filter(img => {
        if (img.isHumanized) {
          summaryFiltered++;
          return false;
        }
        return true;
      });

      // Agrupar por gênero + variante (cor)
      // Estrutura: {MASC: {PRETA: [imgs], BRANCA: [imgs]}, FEM: {...}}
      const genderGroups = {};
      for (const img of filteredImages) {
        if (!img.fullPath || !img.name) continue;
        const gender = (img.gender || 'GERAL').toUpperCase();
        const variant = (img.variant || 'GERAL').toUpperCase();
        if (!genderGroups[gender]) genderGroups[gender] = {};
        if (!genderGroups[gender][variant]) genderGroups[gender][variant] = [];
        genderGroups[gender][variant].push(img);
      }

      const deduplicatedImages = [];

      for (const [gender, variants] of Object.entries(genderGroups)) {
        for (const [variant, imgs] of Object.entries(variants)) {
          // Criar subpasta: evitar GERAL/GERAL — colapsar quando não há gênero/variante
          let subDir;
          if (gender === 'GERAL' && variant === 'GERAL') {
            subDir = path.join(uploadsDir, 'autopilot', taskId, code, 'GERAL');
          } else if (variant === 'GERAL') {
            subDir = path.join(uploadsDir, 'autopilot', taskId, code, gender);
          } else {
            subDir = path.join(uploadsDir, 'autopilot', taskId, code, gender, variant);
          }
          fs.mkdirSync(subDir, { recursive: true });

          // Deduplicar por nome base dentro de cada grupo gênero+cor
          const groups = {};
          for (const img of imgs) {
            const baseName = img.name.replace(/\.[^.]+$/, '').toUpperCase();
            if (!groups[baseName]) groups[baseName] = [];
            groups[baseName].push(img);
          }

          for (const baseName in groups) {
            const group = groups[baseName];
            let largestImg = group[0];
            if (group.length > 1) {
              let maxSize = -1;
              for (const img of group) {
                try {
                  const stat = networkSafety.safeStat(img.fullPath);
                  if (stat && stat.size > maxSize) {
                    maxSize = stat.size;
                    largestImg = img;
                  }
                } catch (err) {
                  console.warn(`⚠️ Erro ao obter tamanho de ${img.fullPath}:`, err.message);
                }
              }
            }

            const ext = path.extname(largestImg.name);
            const finalName = `${baseName}${ext}`;
            const localDestPath = path.join(subDir, finalName);

            try {
              networkSafety.safeCopyFromNetwork(largestImg.fullPath, localDestPath);
              const stat = fs.statSync(localDestPath);
              const sizeKB = Math.round(stat.size / 1024);

              summaryTotalImages++;
              summaryTotalSizeKB += sizeKB;

              deduplicatedImages.push({
                name: finalName,
                localPath: localDestPath,
                url: `/api/autopilot/images/${taskId}/${code}/${gender}/${variant}/${finalName}`,
                sizeKB,
                gender,
                variant
              });
            } catch (err) {
              console.error(`❌ Erro ao copiar imagem ${largestImg.fullPath}:`, err.message);
            }
          }

          // Sort images by priority
          const sortedInGroup = [...deduplicatedImages.filter(img => img.gender === gender && img.variant === variant)];
          sortedInGroup.sort((a, b) => {
            const prioA = getSmartSortPriority(a.name);
            const prioB = getSmartSortPriority(b.name);
            if (prioA !== prioB) return prioA - prioB;
            return a.name.localeCompare(b.name, undefined, { numeric: true });
          });

          // Rename to 1.jpg, 2.jpg, 3.jpg... (using extension from the original file to be safe if not jpg)
          sortedInGroup.forEach((img, idx) => {
            const newName = `${idx + 1}${path.extname(img.name)}`;
            const newPath = path.join(path.dirname(img.localPath), newName);
            // Only rename if different
            if (path.basename(img.localPath) !== newName) {
              fs.renameSync(img.localPath, newPath);
              img.localPath = newPath;
              img.name = newName;
              img.url = `/api/autopilot/images/${taskId}/${code}/${gender}/${variant}/${newName}`;
            }
          });
        }
      }

      console.log(`📋 Copy: [${code}] ${deduplicatedImages.length} copiadas, ${summaryFiltered} humanizadas filtradas`);

      responseResults.push({
        code,
        estampa,
        totalCopied: deduplicatedImages.length,
        totalFiltered: images.length - filteredImages.length,
        images: deduplicatedImages
      });
    }

    res.json({
      taskId,
      summary: {
        totalCodes: summaryTotalCodes,
        totalImages: summaryTotalImages,
        totalFiltered: summaryFiltered,
        totalSizeKB: summaryTotalSizeKB
      },
      results: responseResults
    });
  } catch (err) {
    console.error('❌ Erro no copy-network-images:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/autopilot/images/:taskId/:code', (req, res) => {
  const { taskId, code } = req.params;
  const dirPath = path.join(uploadsDir, 'autopilot', taskId, code);
  try {
    if (!fs.existsSync(dirPath)) {
      return res.json([]);
    }
    // Buscar recursivamente em todas as subpastas (MASC/PRETA/, FEM/BRANCA/, etc.)
    const imagesList = [];
    function walkDir(dir, relativePath) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name), rel);
        } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
          imagesList.push({
            name: entry.name,
            url: `/api/autopilot/images/${taskId}/${code}/${rel}`,
            gender: relativePath ? relativePath.split('/')[0] : null,
            variant: relativePath ? relativePath.split('/')[1] || null : null,
          });
        }
      }
    }
    walkDir(dirPath, '');
    res.json(imagesList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir imagens de qualquer subpasta: /images/:taskId/:code/MASC/PRETA/file.png
router.get('/api/autopilot/images/:taskId/:code/*', (req, res) => {
  try {
    const { taskId, code } = req.params;
    const subPath = req.params[0]; // tudo depois de :code/
    const filePath = path.resolve(path.join(uploadsDir, 'autopilot', taskId, code, subPath));
    // Security: ensure resolved path is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Imagem não encontrada' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
};
