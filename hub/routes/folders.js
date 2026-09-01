/**
 * @module routes/folders
 * @audit Extracted from server.js
 */
'use strict';
const router = require('express').Router();

module.exports = function({ upload, uploadsDir, fs, path, networkSafety, imageUtils }) {

router.post('/api/folders/create', (req, res) => {
  try {
    const { codes, basePath } = req.body;

    // Validação dos parâmetros obrigatórios
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'O campo "codes" é obrigatório e deve ser um array com pelo menos um código.'
      });
    }

    if (!basePath || typeof basePath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'O campo "basePath" é obrigatório e deve ser um caminho válido.'
      });
    }

    // 🔒 Segurança: bloquear criação em caminhos de rede
    if (networkSafety.isNetworkPath(basePath)) {
      return res.status(403).json({
        success: false,
        error: '🔒 Operação bloqueada: não é permitido criar pastas na rede.'
      });
    }

    // Verifica se o diretório base existe
    if (!fs.existsSync(basePath)) {
      return res.status(400).json({
        success: false,
        error: `O caminho base não existe: ${basePath}`
      });
    }

    const created = [];
    const errors = [];
    const dangerousPattern = /[\\\/\.\:]/;
    const resolvedBase = path.resolve(basePath);

    // Cria uma pasta para cada código
    for (const code of codes) {
      const trimmed = code.trim();
      // Sanitize: block path traversal characters
      if (!trimmed || dangerousPattern.test(trimmed) || trimmed.includes('..')) {
        errors.push({ code: trimmed, reason: 'Código contém caracteres inválidos' });
        continue;
      }
      const folderPath = path.resolve(basePath, trimmed);
      // Verify path stays within basePath
      if (!folderPath.startsWith(resolvedBase + path.sep) && folderPath !== resolvedBase) {
        errors.push({ code: trimmed, reason: 'Caminho fora do diretório base' });
        continue;
      }
      try {
        if (fs.existsSync(folderPath)) {
          errors.push({ code: trimmed, reason: 'Pasta já existe' });
        } else {
          fs.mkdirSync(folderPath, { recursive: true });
          created.push(trimmed);
        }
      } catch (err) {
        errors.push({ code: trimmed, reason: err.message });
      }
    }

    res.json({ success: true, created, errors });
  } catch (err) {
    console.error('[ERRO] /api/folders/create:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/images/rename ────────────────────────────────────────────────
// Recebe imagens via upload e renomeia seguindo o padrão (MASC, FEM, INF)
router.post('/api/images/rename', upload.array('images', 100), (req, res) => {
  try {
    const { pattern } = req.body;

    // Validação do padrão de nome
    const validPatterns = ['MASC', 'FEM', 'INF'];
    if (!pattern || !validPatterns.includes(pattern.toUpperCase())) {
      // Remove arquivos enviados caso o padrão seja inválido
      if (req.files) {
        req.files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (e) { /* ignora */ }
        });
      }
      return res.status(400).json({
        success: false,
        error: `O campo "pattern" deve ser um dos valores: ${validPatterns.join(', ')}`
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada.'
      });
    }

    const upperPattern = pattern.toUpperCase();
    const renamed = [];

    // Cria subdiretório para as imagens renomeadas
    const renamedDir = path.join(uploadsDir, `renamed_${Date.now()}`);
    fs.mkdirSync(renamedDir, { recursive: true });

    // Renomeia cada arquivo seguindo o padrão sequencial
    req.files.forEach((file, index) => {
      const sequenceNumber = String(index + 1).padStart(2, '0');
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const newName = `${sequenceNumber}${upperPattern}${ext}`;
      const newPath = path.join(renamedDir, newName);

      // Move o arquivo para o novo caminho com o novo nome
      fs.renameSync(file.path, newPath);

      renamed.push({
        original: file.originalname,
        new: newName
      });
    });

    res.json({ success: true, renamed, outputDir: renamedDir });
  } catch (err) {
    console.error('[ERRO] /api/images/rename:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api/scan-upload-folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'folderPath é obrigatório' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    const blocks = [];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'];
    const codes = new Set();
    let totalImages = 0;

    const codeDirs = fs.readdirSync(folderPath, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const codeDir of codeDirs) {
      const code = codeDir.name;
      const codePath = path.join(folderPath, code);
      
      const genderDirs = fs.readdirSync(codePath, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const genderDir of genderDirs) {
        const gender = genderDir.name;
        const genderPath = path.join(codePath, gender);
        
        const colorDirs = fs.readdirSync(genderPath, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const colorDir of colorDirs) {
          const color = colorDir.name;
          const colorPath = path.join(genderPath, color);
          
          const files = fs.readdirSync(colorPath, { withFileTypes: true })
            .filter(f => f.isFile() && validExts.includes(path.extname(f.name).toLowerCase()));
            
          if (files.length > 0) {
            blocks.push({
              code,
              gender,
              color,
              images: files.length,
              path: `${code}/${gender}/${color}`
            });
            codes.add(code);
            totalImages += files.length;
          }
        }
      }
    }

    res.json({
      success: true,
      basePath: folderPath,
      blocks,
      summary: {
        totalBlocks: blocks.length,
        totalImages,
        codes: Array.from(codes)
      }
    });

  } catch (err) {
    console.error('❌ Erro no scan-upload-folder:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Escapa valores para CSV - trata ponto-e-vírgula, aspas e quebras de linha
 * @param {string} value - Valor a ser escapado
 * @returns {string} Valor seguro para CSV
 */
function escaparCSV(value) {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

  return router;
};
