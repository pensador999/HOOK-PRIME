/**
 * @module gemini-vision
 * Endpoint para reconhecimento de estampas via Gemini AI.
 * Analisa imagens de produtos e extrai o nome da estampa automaticamente.
 * 
 * Requer: GEMINI_API_KEY no .env
 * Dependência: npm install @google/generative-ai
 */
module.exports = (deps) => {
  const { fs, path } = deps;
  const router = require('express').Router();

  // ═══════════════════════════════════════
  // Configuração Gemini
  // ═══════════════════════════════════════
  let genAI = null;
  let model = null;

  function initGemini() {
    if (model) return true;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY não configurada. Reconhecimento de estampas desabilitado.');
      return false;
    }
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ Gemini Vision inicializado (gemini-2.0-flash)');
      return true;
    } catch (err) {
      console.warn('⚠️ Erro ao inicializar Gemini:', err.message);
      console.warn('   Execute: npm install @google/generative-ai');
      return false;
    }
  }

  function fileToGenerativePart(filePath, mimeType) {
    const data = fs.readFileSync(filePath);
    return {
      inlineData: {
        data: Buffer.from(data).toString('base64'),
        mimeType,
      },
    };
  }

  function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
    };
    return mimeMap[ext] || 'image/jpeg';
  }

  // ═══════════════════════════════════════
  // Prompts por tipo de produto
  // ═══════════════════════════════════════
  const PROMPTS = {
    default: `Analise esta imagem de um produto da marca Brk Fishing.
Extraia o nome da estampa/design em português do Brasil.
O nome deve ser curto (2-4 palavras), descritivo e comercial.
Exemplos válidos: "Degradê Vinho", "Tucunaré Azul", "Floresta Tropical", "São Bento Preto", "ArmorX Verde Oliva", "Camuflado Digital", "Sertanejo Country", "Pesca Dourado".
Se identificar um peixe, animal ou tema específico, inclua no nome.
Responda APENAS com o nome da estampa (sem aspas, sem explicações, sem pontuação extra).`,

    'Lenço': `Analise esta imagem de um Lenço/Bandana da marca Brk.
Extraia o nome da estampa/design do tecido em português do Brasil.
O nome deve ser curto (2-4 palavras), descritivo e comercial.
Exemplos: "Degradê Vinho", "Floral Rosa", "Vitórias Régias", "Camuflado Digital".
Observe o padrão, cores dominantes e elementos da estampa.
Responda APENAS com o nome da estampa.`,

    'Tubeneck': `Analise esta imagem de uma Bandana Tubeneck da marca Brk.
Extraia o nome da estampa/design do tecido em português do Brasil.
O nome deve ser curto (2-4 palavras), descritivo e comercial.
Exemplos: "ArmorX Verde Oliva", "Tucunaré Azul", "Camuflado Digital", "Preto Liso".
Responda APENAS com o nome da estampa.`,
  };

  // GET /api/gemini/status
  router.get('/api/gemini/status', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const isReady = initGemini();
    res.json({
      available: hasKey,
      ready: isReady,
      model: isReady ? 'gemini-2.0-flash' : null,
      message: hasKey
        ? (isReady ? '✅ Gemini Vision pronto' : '⚠️ Gemini SDK não instalado (npm install @google/generative-ai)')
        : '❌ GEMINI_API_KEY não configurada no .env',
    });
  });

  // POST /api/gemini/describe-estampa
  router.post('/api/gemini/describe-estampa', async (req, res) => {
    try {
      if (!initGemini()) {
        return res.status(503).json({
          error: 'Gemini não disponível. Configure GEMINI_API_KEY no .env e instale @google/generative-ai.',
        });
      }

      const { imagePath, productType } = req.body;
      if (!imagePath) {
        return res.status(400).json({ error: 'imagePath é obrigatório.' });
      }

      const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: `Imagem não encontrada: ${resolvedPath}` });
      }

      const mimeType = getMimeType(resolvedPath);
      const imagePart = fileToGenerativePart(resolvedPath, mimeType);
      const prompt = PROMPTS[productType] || PROMPTS.default;

      console.log(`🤖 Gemini: Analisando ${path.basename(resolvedPath)} (${productType || 'default'})...`);

      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text().trim();

      let estampa = text
        .replace(/^["']+|["']+$/g, '')
        .replace(/\.+$/, '')
        .replace(/^(Nome da estampa:|Estampa:|Nome:)\s*/i, '')
        .trim();

      estampa = estampa.split(' ').map(w => {
        if (['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'em', 'no', 'na'].includes(w.toLowerCase())) return w.toLowerCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }).join(' ');

      console.log(`🤖 Gemini: "${estampa}" ← ${path.basename(resolvedPath)}`);

      res.json({ success: true, estampa, raw: text, imagePath: resolvedPath, productType: productType || 'default' });
    } catch (err) {
      console.error('❌ Gemini Vision error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/gemini/batch-describe
  router.post('/api/gemini/batch-describe', async (req, res) => {
    try {
      if (!initGemini()) {
        return res.status(503).json({ error: 'Gemini não disponível.' });
      }

      const { images } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Array "images" é obrigatório.' });
      }

      console.log(`🤖 Gemini Batch: ${images.length} imagens para analisar...`);

      const results = [];
      for (const item of images) {
        const { code, imagePath, productType } = item;
        try {
          const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
          if (!fs.existsSync(resolvedPath)) {
            results.push({ code, estampa: null, error: 'Imagem não encontrada' });
            continue;
          }

          const mimeType = getMimeType(resolvedPath);
          const imagePart = fileToGenerativePart(resolvedPath, mimeType);
          const prompt = PROMPTS[productType] || PROMPTS.default;

          const result = await model.generateContent([prompt, imagePart]);
          const text = result.response.text().trim();

          let estampa = text
            .replace(/^["']+|["']+$/g, '').replace(/\.+$/, '')
            .replace(/^(Nome da estampa:|Estampa:|Nome:)\s*/i, '').trim();

          estampa = estampa.split(' ').map(w => {
            if (['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'em', 'no', 'na'].includes(w.toLowerCase())) return w.toLowerCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          }).join(' ');

          results.push({ code, estampa });
          console.log(`   🤖 ${code}: "${estampa}"`);
          await new Promise(r => setTimeout(r, 500)); // Rate limit
        } catch (err) {
          results.push({ code, estampa: null, error: err.message });
          console.error(`   ❌ ${code}: ${err.message}`);
        }
      }

      res.json({ success: true, results, total: results.length });
    } catch (err) {
      console.error('❌ Gemini Batch error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
