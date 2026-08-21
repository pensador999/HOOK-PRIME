(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;

  async function uploadGenderImages(baseCode, gender) {
    console.log(`[UPLOAD] ${baseCode}/${gender} — iniciando...`);

    const folderPath = State.state.diskFolderPath;
    console.log(`[UPLOAD] folderPath="${folderPath}", codeBase="${baseCode}", gender="${gender}"`);

    if (!folderPath || !folderPath.trim()) {
      throw new Error(`Caminho da pasta não configurado. Volte à Etapa 2 e informe o caminho.`);
    }

    return await uploadFromDisk(baseCode, gender, folderPath.trim());
  }

  /**
   * Upload de imagens APC por COR.
   * Estrutura de pastas: folderPath/baseCode/MASC/PRETA/, folderPath/baseCode/FEM/PRETA/
   * Usa o endpoint upload-from-folder-direct para cada subpasta (MASC+FEM)
   * e combina as URLs.
   */
  async function uploadApcColorImages(baseCode, color, genderKey) {
    const folderPath = State.state.diskFolderPath;
    if (!folderPath || !folderPath.trim()) {
      throw new Error(`Caminho da pasta não configurado.`);
    }

    const VARIANT_MAP = { Preto: 'PRETA', Branco: 'BRANCA', Bege: 'BEGE' };
    const variant = VARIANT_MAP[color] || color.toUpperCase();
    const basePath = folderPath.trim();
    const gender = genderKey || 'MASC';

    // Caminho esperado: basePath/baseCode/GENDER/VARIANT (ex: .../APC0570/MASC/PRETA)
    const colorFolder = `${basePath}/${baseCode}/${gender}/${variant}`.replace(/\\//g, '\\\\');
    const collectionId = `${baseCode}_${gender}_${variant}`;

    console.log(`[APC UPLOAD] Tentando: ${colorFolder} → ${collectionId}`);

    const tryUpload = async (folder, colId) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);
        const response = await fetch('/api/s3-proxy/upload-from-folder-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: folder, collectionId: colId }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return { error: errData.error || `HTTP ${response.status}` };
        }
        const data = await response.json();
        if (data.success && data.urls && data.urls.length > 0) {
          console.log(`[APC UPLOAD] ✅ ${colId}: ${data.urls.length} URLs`);
          return { urls: data.urls };
        }
        return { error: 'Pasta vazia — sem imagens' };
      } catch (err) {
        if (err.name === 'AbortError') return { error: 'Timeout' };
        return { error: err.message };
      }
    };

    // Tentativa 1: GENDER/VARIANT
    let result = await tryUpload(colorFolder, collectionId);

    // Tentativa 2: sem GENDER (basePath/baseCode/VARIANT)
    if (result.error) {
      const directFolder = `${basePath}/${baseCode}/${variant}`.replace(/\\//g, '\\\\');
      const directId = `${baseCode}_${variant}`;
      console.log(`[APC UPLOAD] Fallback sem gênero: ${directFolder}`);
      const result2 = await tryUpload(directFolder, directId);
      if (result2.urls) result = result2;
    }

    if (result.error) {
      throw new Error(`${gender}/${variant}: ${result.error}. Verifique: ${colorFolder}`);
    }

    return result.urls.map(u => u.trim()).join(' | ');
  }


  /**
   * Upload via disco (server lê arquivos locais)
   */
  async function uploadFromDisk(baseCode, gender, folderPath) {
    const UM = window.AutopilotModules.UploadManager;
    UM.uploadState.progress.currentImg = 0;
    UM.uploadState.progress.totalImgs = 1;
    UM.updateUploadUI();

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);

        const response = await fetch('/api/s3-proxy/upload-from-disk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderPath: folderPath,
            codeBase: baseCode,
            gender: gender,
            autoRename: State.state.autoRename !== false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.joined) {
          throw new Error(data.error || 'Nenhuma imagem processada');
        }

        UM.uploadState.progress.currentImg = data.total;
        UM.uploadState.progress.totalImgs = data.total;
        UM.updateUploadUI();

        return data.joined;
      } catch (err) {
        const msg = err.name === 'AbortError' ? 'Timeout (5min)' : err.message;

        if (attempt < MAX_RETRIES) {
          const delay = 3000 * attempt;
          window.HUB.showToast(`⚠️ Tentativa ${attempt}/${MAX_RETRIES} para ${baseCode}: ${msg}`, 'warning');
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw new Error(`${baseCode} (${gender}): ${msg}`);
        }
      }
    }
  }

  window.AutopilotModules.S3Uploader = {
    uploadGenderImages,
    uploadApcColorImages,
    uploadFromDisk
  };
})();
