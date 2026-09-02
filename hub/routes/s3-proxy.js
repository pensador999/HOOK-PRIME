/**
 * @module s3-proxy
 * @audit Extracted from server.js
 */

module.exports = (deps) => {
  const { upload, uploadsDir, fs, path, sharp, imageUtils } = deps;
  const express = require('express');
  const router = express.Router();

  const { getImagePriority, GENDER_FOLDERS, detectGenderFromFilename } = imageUtils || {};

  const BRK_LINK_URL = process.env.BRK_LINK_URL || 'https://brk-link-vz77.vercel.app';

  /**
   * Faz upload de múltiplos arquivos para o BRK Link (Cloudflare R2).
   * O BRK Link renomeia como 1.jpg, 2.jpg, 3.jpg... na ordem enviada.
   * Cada upload usa um collectionId ÚNICO para não sobrescrever imagens de outros códigos.
   * @param {Array<{filePath: string, originalName: string}>} files
   * @param {string} collectionId - ID único da coleção (ex: 'C02858_MASC')
   * @returns {Promise<{urls: string[], count: number}>}
   */
  async function uploadToBrkLink(files, collectionId) {
    const formData = new FormData();
  
    // Coleção ÚNICA para cada código+gênero
    if (collectionId) {
      formData.append('collectionId', collectionId);
      console.log(`📁 Coleção CDN: ${collectionId}`);
    }
  
    for (let i = 0; i < files.length; i++) {
      const { filePath, originalName } = files[i];
      let fileBuffer = fs.readFileSync(filePath);
      let sendName = originalName;
  
      // Comprimir se > 3MB (limite Vercel ~4.5MB)
      if (fileBuffer.length > 3 * 1024 * 1024) {
        try {
          fileBuffer = await sharp(fileBuffer)
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
          sendName = sendName.replace(/\.[^.]+$/, '.jpg');
          console.log(`   🗜️ Comprimido: ${(files[i].filePath ? path.basename(files[i].filePath) : originalName)} ${(fs.readFileSync(filePath).length / 1024).toFixed(0)}KB → ${(fileBuffer.length / 1024).toFixed(0)}KB`);
        } catch (compErr) {
          console.log(`   ⚠️ Compressão falhou, enviando original: ${compErr.message}`);
        }
      }
  
      const blob = new Blob([fileBuffer]);
      formData.append('files', blob, sendName);
      formData.append('originalNames', sendName);
    }
  
    console.log(`📤 BRK Link: enviando ${files.length} imagem(ns)...`);
  
    const MAX_RETRIES = 3;
    let lastErr;
  
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);
  
        const response = await fetch(`${BRK_LINK_URL}/api/save`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);
  
        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`BRK Link falhou (HTTP ${response.status}): ${text.substring(0, 300)}`);
        }
  
        const data = await response.json();
  
        if (!data.entries || data.entries.length === 0) {
          throw new Error('BRK Link retornou sem URLs');
        }
  
        const urls = data.entries.map(e => e.url);
        console.log(`✅ BRK Link OK: ${urls.length} imagem(ns) enviada(s)`);
        urls.forEach((url, i) => console.log(`   [${i + 1}] ${url}`));
  
        return { urls, count: data.count || urls.length };
  
      } catch (err) {
        lastErr = err;
        if (err.name === 'AbortError') {
          console.log(`⏱️ Timeout no upload BRK Link (tentativa ${attempt}/${MAX_RETRIES})`);
        } else {
          console.log(`⚠️ Erro BRK Link (tentativa ${attempt}/${MAX_RETRIES}): ${err.message}`);
        }
  
        if (attempt < MAX_RETRIES) {
          const waitMs = 3000 * attempt;
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }
  
    throw lastErr || new Error(`Falha após ${MAX_RETRIES} tentativas`);
  }

  router.BRK_LINK_URL = BRK_LINK_URL;
  router.uploadToBrkLink = uploadToBrkLink;

  /**
   * POST /api/s3-proxy/upload-from-folder-direct
   * Upload direto de uma pasta já resolvida (sem resolução de subpastas).
   * Ideal para APC onde a pasta final já é code/gender/color.
   * Body JSON: { folderPath: "C:\\...\\APC0573\\MASC\\PRETA", collectionId: "APC0573_MASC_PRETA" }
   * Response: { success: true, urls: [...], joined: "url1|url2|..." }
   */
  router.post('/api/s3-proxy/upload-from-folder-direct', express.json(), async (req, res) => {
    try {
      const { folderPath, collectionId } = req.body;
      if (!folderPath || !collectionId) {
        return res.status(400).json({ error: 'folderPath e collectionId são obrigatórios.' });
      }
  
      if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: `Pasta não encontrada: ${folderPath}` });
      }
  
      const imageExts = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
      const imageFiles = [];
  
      // Scan direto (sem resolução de subpastas de gênero)
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() && imageExts.test(entry.name)) {
          imageFiles.push(path.join(folderPath, entry.name));
        }
      }
  
      if (imageFiles.length === 0) {
        return res.status(400).json({ error: `Nenhuma imagem em: ${folderPath}` });
      }
  
      // Smart Sort
      // getImagePriority → unified in config/image-utils.js
  
      imageFiles.sort((a, b) => {
        const prioA = getImagePriority(path.basename(a));
        const prioB = getImagePriority(path.basename(b));
        if (prioA !== prioB) return prioA - prioB;
        return path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true });
      });
  
      console.log(`📂 Upload direto: ${collectionId} → ${imageFiles.length} imagem(ns)`);
  
      // Renomear para padrão CDN: collectionId_1.jpg, collectionId_2.jpg
      const files = imageFiles.map((fp, idx) => ({
        filePath: fp,
        originalName: `${collectionId}_${idx + 1}${path.extname(fp)}`,
      }));
  
      files.forEach((f, i) => console.log(`   [${i + 1}] ${path.basename(imageFiles[i])} → ${f.originalName}`));
  
      // Comprimir com Sharp (JPEG 85%)
      const compressedFiles = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let fileBuffer = fs.readFileSync(file.filePath);
        let sendName = file.originalName;
        const originalSize = fileBuffer.length;
  
        if (originalSize > 500 * 1024) {
          try {
            fileBuffer = await sharp(fileBuffer)
              .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer();
            sendName = sendName.replace(/\.[^.]+$/, '.jpg');
            console.log(`   🗜️ [${i + 1}] ${(originalSize / 1024).toFixed(0)}KB → ${(fileBuffer.length / 1024).toFixed(0)}KB`);
          } catch (compErr) {
            console.log(`   ⚠️ [${i + 1}] Compressão falhou: ${compErr.message}`);
          }
        }
  
        compressedFiles.push({ buffer: fileBuffer, originalName: sendName });
      }
  
      // Calcular tamanho total
      const totalBatchSize = compressedFiles.reduce((sum, f) => sum + f.buffer.length, 0);
      console.log(`   📦 Batch: ${(totalBatchSize / 1024).toFixed(0)}KB (${compressedFiles.length} imgs)`);
  
      // Enviar em batches
      const MAX_BATCH_SIZE = 3.5 * 1024 * 1024;
      const allUrls = [];
  
      if (totalBatchSize <= MAX_BATCH_SIZE) {
        const tempFiles = compressedFiles.map((cf, idx) => {
          const tmpPath = path.join(uploadsDir, `tmp_${collectionId}_${idx}_${Date.now()}.jpg`);
          fs.writeFileSync(tmpPath, cf.buffer);
          return { filePath: tmpPath, originalName: cf.originalName };
        });
        try {
          const result = await uploadToBrkLink(tempFiles, collectionId);
          allUrls.push(...result.urls);
        } finally {
          tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
        }
      } else {
        let currentBatch = [];
        let currentSize = 0;
        let batchNum = 0;
  
        for (const cf of compressedFiles) {
          if (currentSize + cf.buffer.length > MAX_BATCH_SIZE && currentBatch.length > 0) {
            batchNum++;
            const tempFiles = currentBatch.map((item, idx) => {
              const tmpPath = path.join(uploadsDir, `tmp_${collectionId}_b${batchNum}_${idx}_${Date.now()}.jpg`);
              fs.writeFileSync(tmpPath, item.buffer);
              return { filePath: tmpPath, originalName: item.originalName };
            });
            try {
              const result = await uploadToBrkLink(tempFiles, `${collectionId}_b${batchNum}`);
              allUrls.push(...result.urls);
            } finally {
              tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
            }
            currentBatch = [];
            currentSize = 0;
          }
          currentBatch.push(cf);
          currentSize += cf.buffer.length;
        }
  
        if (currentBatch.length > 0) {
          batchNum++;
          const tempFiles = currentBatch.map((item, idx) => {
            const tmpPath = path.join(uploadsDir, `tmp_${collectionId}_b${batchNum}_${idx}_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, item.buffer);
            return { filePath: tmpPath, originalName: item.originalName };
          });
          try {
            const result = await uploadToBrkLink(tempFiles, `${collectionId}_b${batchNum}`);
            allUrls.push(...result.urls);
          } finally {
            tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
          }
        }
      }
  
      res.json({
        success: allUrls.length > 0,
        total: allUrls.length,
        urls: allUrls,
        joined: allUrls.join(' | '),
      });
  
    } catch (err) {
      console.error('❌ Erro no upload-from-folder-direct:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/s3-proxy/upload-from-disk
   * Lê imagens diretamente do disco e faz upload para o BRK Link (R2).
   * Body JSON: { folderPath: "C:\\...", codeBase: "C02858", gender: "masc" }
   * O server monta: folderPath/codeBase/MASC/ (ou FEM/ ou INF/)
   * Response: { success: true, urls: [...], joined: "url1|url2|..." }
   */
  router.post('/api/s3-proxy/upload-from-disk', express.json(), async (req, res) => {
    try {
      const { folderPath, codeBase, gender, autoRename = true } = req.body;
      if (!folderPath || !codeBase) {
        return res.status(400).json({ error: 'folderPath e codeBase são obrigatórios.' });
      }
  
      // Mapeia gender para subpasta (MASC/FEM/INF)
      // GENDER_FOLDERS → unified in config/image-utils.js
  
      // Tenta encontrar a pasta de imagens na ordem:
      //   1. folderPath/codeBase/GENDER/  (estrutura C02858/MASC/)
      //   2. folderPath/codeBase/         (estrutura flat sem subpastas de gênero — SEM recursão para evitar mistura)
      let codePath;
      let isGenderSpecific = false;
      if (gender && GENDER_FOLDERS && GENDER_FOLDERS[gender]) {
        const genderPath = path.join(folderPath, codeBase, GENDER_FOLDERS[gender]);
        if (fs.existsSync(genderPath)) {
          codePath = genderPath;
          isGenderSpecific = true;
        }
      }
  
      // Fallback: pasta direta do código (para APC que tem subcores, ou estrutura flat)
      if (!codePath) {
        codePath = path.join(folderPath, codeBase);
      }
  
      // Smart folder resolution: se a pasta exata não existir, procurar pastas que
      // COMEÇAM com codeBase (ex: "C02576 - TUCUNARE", "C02576_TUCUNARE")
      if (!fs.existsSync(codePath) && fs.existsSync(folderPath)) {
        try {
          const parentEntries = fs.readdirSync(folderPath, { withFileTypes: true });
          const codeUpper = codeBase.toUpperCase();
          const match = parentEntries.find(e => {
            if (!e.isDirectory()) return false;
            const nameUpper = e.name.toUpperCase();
            return nameUpper === codeUpper
              || nameUpper.startsWith(codeUpper + ' ')
              || nameUpper.startsWith(codeUpper + '_')
              || nameUpper.startsWith(codeUpper + '-');
          });
          if (match) {
            codePath = path.join(folderPath, match.name);
            console.log(`   🔍 Smart resolve: ${codeBase} → ${match.name}`);
            // Re-check gender subfolder inside the resolved path
            if (gender && GENDER_FOLDERS && GENDER_FOLDERS[gender] && !isGenderSpecific) {
              const genderPath = path.join(codePath, GENDER_FOLDERS[gender]);
              if (fs.existsSync(genderPath)) {
                codePath = genderPath;
                isGenderSpecific = true;
              }
            }
          }
        } catch (e) {
          console.warn(`   ⚠️ Smart resolve failed for ${codeBase}:`, e.message);
        }
      }
  
      if (!fs.existsSync(codePath)) {
        return res.status(404).json({ error: `Pasta não encontrada: ${codePath}` });
      }
  
      // Preferir subpasta JPEG_imagens/ (criada pelo Light Resizer 7 — JPGs mais leves)
      const jpegSubfolder = path.join(codePath, 'JPEG_imagens');
      if (fs.existsSync(jpegSubfolder)) {
        codePath = jpegSubfolder;
        console.log(`   📂 Usando JPEG_imagens/ (Light Resizer)`);
      }
  
      const imageExts = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
      const imageFiles = [];
  
      // Se é fallback (sem pasta de gênero), NÃO entrar recursivamente
      // para evitar misturar imagens de MASC/FEM/INF
      function scanDir(dir, recurse = true) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && recurse) {
            // Não entrar em pastas de gênero de outros gêneros no fallback
            const upperName = entry.name.toUpperCase();
            if (!isGenderSpecific && ['MASC', 'FEM', 'INF', 'MASCULINO', 'FEMININO', 'INFANTIL'].includes(upperName)) {
              continue; // Pula subpastas de gênero diferente
            }
            scanDir(fullPath, true);
          } else if (!entry.isDirectory() && imageExts.test(entry.name)) {
            imageFiles.push(fullPath);
          }
        }
      }
      scanDir(codePath);
  
      if (imageFiles.length === 0) {
        return res.status(400).json({ error: `Nenhuma imagem encontrada em: ${codePath}` });
      }
  
      // ─── Smart Sort: FRENTE → COSTAS → FRENTE PERSPEC → COSTAS PERSPEC → extras ───
      // Baseado na análise dos 9 padrões de referência (PADRÃO1~7 + Capturas)
      // getImagePriority → unified in config/image-utils.js
  
      imageFiles.sort((a, b) => {
        const nameA = path.basename(a);
        const nameB = path.basename(b);
        const prioA = getImagePriority(nameA);
        const prioB = getImagePriority(nameB);
        if (prioA !== prioB) return prioA - prioB;
        return nameA.localeCompare(nameB, undefined, { numeric: true });
      });
  
      const genderLabel = (gender && GENDER_FOLDERS) ? (GENDER_FOLDERS[gender] || gender) : (gender || 'ALL');
      console.log(`📂 Upload de disco: ${codeBase}/${genderLabel} → ${imageFiles.length} imagem(ns)`);
  
      // Nomes ÚNICOS por código+gênero para NÃO sobrescrever no CDN
      const prefix = `${codeBase}_${(gender || 'ALL').toUpperCase()}`;
      const files = imageFiles.map((fp, idx) => ({
        filePath: fp,
        originalName: autoRename ? `${prefix}_${idx + 1}${path.extname(fp)}` : path.basename(fp),
      }));
  
      files.forEach((f, i) => console.log(`   [${i + 1}] ${path.basename(imageFiles[i])} → ${f.originalName}`));
  
      // Comprimir TODAS as imagens antes do envio (sharp JPEG 85%)
      // Isso garante que o batch total fique abaixo do limite da Vercel (~4.5MB)
      const compressedFiles = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let fileBuffer = fs.readFileSync(file.filePath);
        let sendName = file.originalName;
        const originalSize = fileBuffer.length;
  
        // Comprimir se > 500KB (para garantir que o batch total caiba)
        if (originalSize > 500 * 1024) {
          try {
            fileBuffer = await sharp(fileBuffer)
              .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer();
            sendName = sendName.replace(/\.[^.]+$/, '.jpg');
            console.log(`   🗜️ [${i + 1}] ${(originalSize / 1024).toFixed(0)}KB → ${(fileBuffer.length / 1024).toFixed(0)}KB`);
          } catch (compErr) {
            console.log(`   ⚠️ [${i + 1}] Compressão falhou: ${compErr.message}`);
          }
        }
  
        compressedFiles.push({ buffer: fileBuffer, originalName: sendName });
      }
  
      // Calcular tamanho total do batch
      const totalBatchSize = compressedFiles.reduce((sum, f) => sum + f.buffer.length, 0);
      console.log(`   📦 Batch total: ${(totalBatchSize / 1024).toFixed(0)}KB (${compressedFiles.length} imgs)`);
  
      // Enviar em batch (até 4MB) ou dividir em sub-batches se necessário
      const MAX_BATCH_SIZE = 3.5 * 1024 * 1024; // 3.5MB seguro para Vercel
      const allUrls = [];
  
      if (totalBatchSize <= MAX_BATCH_SIZE) {
        // Batch único — todas as imagens de uma vez
        const tempFiles = compressedFiles.map((cf, idx) => {
          const tmpPath = path.join(uploadsDir, `tmp_${prefix}_${idx}_${Date.now()}.jpg`);
          fs.writeFileSync(tmpPath, cf.buffer);
          return { filePath: tmpPath, originalName: cf.originalName };
        });
  
        try {
          const result = await uploadToBrkLink(tempFiles, prefix);
          allUrls.push(...result.urls);
        } finally {
          tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
        }
      } else {
        // Dividir em sub-batches
        let currentBatch = [];
        let currentSize = 0;
        let batchNum = 0;
  
        for (const cf of compressedFiles) {
          if (currentSize + cf.buffer.length > MAX_BATCH_SIZE && currentBatch.length > 0) {
            batchNum++;
            console.log(`   📤 Sub-batch ${batchNum}: ${currentBatch.length} imgs (${(currentSize / 1024).toFixed(0)}KB)`);
            const tempFiles = currentBatch.map((item, idx) => {
              const tmpPath = path.join(uploadsDir, `tmp_${prefix}_b${batchNum}_${idx}_${Date.now()}.jpg`);
              fs.writeFileSync(tmpPath, item.buffer);
              return { filePath: tmpPath, originalName: item.originalName };
            });
            try {
              const result = await uploadToBrkLink(tempFiles, `${prefix}_b${batchNum}`);
              allUrls.push(...result.urls);
            } finally {
              tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
            }
            currentBatch = [];
            currentSize = 0;
          }
          currentBatch.push(cf);
          currentSize += cf.buffer.length;
        }
  
        // Último batch
        if (currentBatch.length > 0) {
          batchNum++;
          console.log(`   📤 Sub-batch ${batchNum}: ${currentBatch.length} imgs (${(currentSize / 1024).toFixed(0)}KB)`);
          const tempFiles = currentBatch.map((item, idx) => {
            const tmpPath = path.join(uploadsDir, `tmp_${prefix}_b${batchNum}_${idx}_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, item.buffer);
            return { filePath: tmpPath, originalName: item.originalName };
          });
          try {
            const result = await uploadToBrkLink(tempFiles, `${prefix}_b${batchNum}`);
            allUrls.push(...result.urls);
          } finally {
            tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
          }
        }
      }
  
      res.json({
        success: allUrls.length > 0,
        total: allUrls.length,
        urls: allUrls,
        joined: allUrls.join('|'),
      });
  
    } catch (err) {
      console.error('❌ Erro no upload de disco:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/s3-proxy/upload-batch
   * Faz proxy de upload de MÚLTIPLAS imagens para o BRK Link.
   * Body: multipart/form-data com campo "files" (múltiplos)
   */
  router.post('/api/s3-proxy/upload-batch', upload.array('files', 50), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
      }
  
      const files = req.files.map(f => ({
        filePath: f.path,
        originalName: f.originalname,
      }));
  
      const collectionId = req.body.collectionId || `batch_${Date.now()}`;
      const result = await uploadToBrkLink(files, collectionId);
  
      // Classificar por gênero baseado no nome do arquivo
      const byGender = { masc: [], fem: [], inf: [] };
      result.urls.forEach((url, i) => {
        const g = detectGenderFromFilename ? detectGenderFromFilename(req.files[i].originalname) : null;
        if (g && byGender[g]) byGender[g].push(url);
      });
  
      // Limpar temporários
      req.files.forEach(f => fs.unlink(f.path, () => {}));
  
      res.json({
        success: true,
        total: result.urls.length,
        urls: result.urls,
        byGender: {
          masc: { urls: byGender.masc, joined: byGender.masc.join('|') },
          fem:  { urls: byGender.fem,  joined: byGender.fem.join('|') },
          inf:  { urls: byGender.inf,  joined: byGender.inf.join('|') },
        },
        allJoined: result.urls.join('|'),
      });
    } catch (err) {
      console.error('❌ Erro no batch upload BRK Link:', err.message);
      if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
