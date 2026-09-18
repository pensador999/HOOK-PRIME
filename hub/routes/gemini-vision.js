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
      model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      console.log('✅ Gemini Vision inicializado (gemini-2.5-flash)');
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
  // Carregar banco de conhecimento BRK
  // ═══════════════════════════════════════
  let estampaPatterns = null;
  try {
    const patternsPath = path.join(__dirname, '..', 'config', 'estampa-patterns.json');
    if (fs.existsSync(patternsPath)) {
      estampaPatterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
      console.log('📖 Estampa Patterns carregado:', Object.keys(estampaPatterns.taxonomy).length, 'categorias');
    }
  } catch (e) { console.warn('⚠️ estampa-patterns.json não encontrado:', e.message); }

  // ═══════════════════════════════════════
  // Prompts especializados por categoria
  // ═══════════════════════════════════════
  function buildPrompt(category, productType) {
    const tax = estampaPatterns?.taxonomy || {};
    const rules = estampaPatterns?.rules || {};
    const avoidStr = (rules.avoidWords || []).join(', ');

    const BASE_RULES = `
REGRAS OBRIGATÓRIAS:
- O nome deve ter ${rules.minWords || 1}-${rules.maxWords || 4} palavras, descritivo e comercial
- NÃO inclua estas palavras: ${avoidStr}
- NÃO invente nomes abstratos quando há um elemento visual claro na imagem
- Pode combinar elemento + cor: "Tucunaré Azul", "Nelore Preto"
- Pode usar inglês quando é termo consagrado: "Black Edition", "Off Road"
- Responda APENAS com o nome da estampa (sem aspas, sem explicações)`;

    if (category === 'fishing' || category === 'default') {
      const species = tax.fishing?.species?.join(', ') || 'Tucunaré, Dourado, Robalo, Pintado';
      const themes = tax.fishing?.themes?.join(', ') || 'Fundo do Mar, Mar Azul';
      return `Você é um especialista em nomenclatura de produtos da marca BRK Fishing.
Analise esta imagem de produto e extraia o NOME DA ESTAMPA.

PEIXES COMUNS nas estampas BRK: ${species}
TEMAS AQUÁTICOS: ${themes}

COMO IDENTIFICAR:
- Se tem um PEIXE reconhecível → use o nome da espécie ("Tucunaré", "Dourado")
- Se tem peixe + cor dominante → combine ("Tucunaré Azul", "Robalo Verde")  
- Se tem paisagem aquática → descreva ("Fundo do Mar", "Rio Solimões", "Mar Azul")
- Se tem padrão visual sem animal → identifique ("Camuflado Digital", "Degradê Vinho")
- Se é design geométrico/abstrato → use estilo ("Black Edition", "Tribal", "Digital")
- Se tem elementos de natureza → nomeie ("Floresta Tropical", "Mangue")

EXEMPLOS REAIS:
Peixe tucunaré em fundo azul → "Tucunaré Azul"
Gradiente vinho/roxo → "Degradê Vinho"
Camuflado pixelado → "Camuflado Digital"
Dourado com vegetação → "Dourado Floresta"
Paisagem submarina com corais → "Fundo do Mar"
Estampa escura toda preta → "Black Edition"
Peixe pintado em rio → "Pintado Rio"
${BASE_RULES}`;
    }

    if (category === 'agro') {
      const breeds = tax.agro?.breeds?.join(', ') || 'Nelore, Angus, Brahman';
      const themes = tax.agro?.themes?.join(', ') || 'Comitiva, Rodeio, Vaquejada';
      return `Você é um especialista em estampas de camisas AGRO/COUNTRY da marca BRK.
Analise esta imagem e identifique a estampa.

RAÇAS BOVINAS comuns: ${breeds}
TEMAS RURAIS: ${themes}

COMO IDENTIFICAR:
- Se tem GADO reconhecível → use a raça ("Nelore", "Angus", "Brahman")
- Se tem gado + tema → combine ("Nelore Country", "Angus Preto")
- Se tem cavalo → identifique ("Mangalarga", "Cavalo Crioulo")
- Se é paisagem rural → descreva ("Pantanal", "Sertão", "Fazenda")
- Se tem elementos de rodeio → nomeie ("Rodeio", "Vaquejada", "Boiadeiro")
- Se é padrão country/western → use ("Country Classic", "Western")

EXEMPLOS REAIS:
Touro nelore em pasto → "Nelore"
Cena de comitiva com gado → "Comitiva"
Paisagem pantaneira → "Pantanal"
Cowboy em rodeio → "Rodeio Country"
Estampa escura com touro → "Nelore Black"
${BASE_RULES}`;
    }

    if (category === 'motors') {
      const types = tax.motors?.types?.join(', ') || 'Motocross, Enduro, Big Trail';
      const themes = tax.motors?.themes?.join(', ') || 'Velocidade, Asfalto, Chrome';
      return `Você é um especialista em estampas de camisas de MOTOCICLISMO da marca BRK.
Analise esta imagem e identifique a estampa.

MODALIDADES: ${types}
TEMAS: ${themes}

COMO IDENTIFICAR:
- Se tem MOTO reconhecível → identifique a modalidade ("Motocross", "Big Trail")
- Se tem moto + cor → combine ("Enduro Verde", "Rally Laranja")
- Se tem elementos de velocidade → nomeie ("Racing", "Full Speed", "Nitro")
- Se é design técnico/carbono → use ("Carbon Tech", "Carbon Black")
- Se é paisagem de trilha → descreva ("Off Road", "Dust Trail")

EXEMPLOS REAIS:
Moto de trilha em lama → "Enduro"
Estampa de corrida com bandeira → "Racing"
Design carbono/técnico → "Carbon Tech"
Moto big trail em estrada → "Big Trail"
Caveira com moto → "Dark Ride"
${BASE_RULES}`;
    }

    // Prompts para acessórios
    if (productType === 'Tubeneck' || productType === 'Bandana') {
      return `Analise esta imagem de uma Bandana/Tubeneck da marca Brk.
Extraia o nome da estampa/design do tecido.
Observe: padrões, cores dominantes, elementos visuais (peixes, animais, camuflado, etc).
EXEMPLOS: "Tucunaré Azul", "Camuflado Digital", "Degradê Vinho", "Floral Rosa", "Preto Liso"
${BASE_RULES}`;
    }

    if (productType === 'Lenço' || productType === 'Lenço Cetim') {
      return `Analise esta imagem de um Lenço da marca Brk.
Extraia o nome da estampa/design do tecido.
EXEMPLOS: "Floral Rosa", "Degradê Vinho", "Vitórias Régias", "Tropical"
${BASE_RULES}`;
    }

    // Fallback genérico
    return `Você é um especialista em nomenclatura de produtos da marca BRK.
Analise esta imagem e extraia o NOME DA ESTAMPA.
O nome deve ser curto (1-4 palavras), descritivo e comercial.
Se identificar um animal, peixe ou tema específico, inclua no nome.
EXEMPLOS: "Tucunaré Azul", "Degradê Vinho", "Camuflado Digital", "Nelore Country"
${BASE_RULES}`;
  }

  // Prompts legados (compatibilidade)
  const PROMPTS = {
    default: null, // Será gerado dinamicamente por buildPrompt()
    'Lenço': null,
    'Tubeneck': null,
  };

  // GET /api/gemini/status
  router.get('/api/gemini/status', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const isReady = initGemini();
    res.json({
      available: hasKey,
      ready: isReady,
      model: isReady ? 'gemini-2.5-flash' : null,
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

      const { imagePath, productType, category } = req.body;
      if (!imagePath) {
        return res.status(400).json({ error: 'imagePath é obrigatório.' });
      }

      const resolvedPath = path.isAbsolute(imagePath) ? path.resolve(imagePath) : path.resolve(path.join(process.cwd(), imagePath));
      
      // 🔒 Segurança: restringir leitura apenas a uploads/ ou dentro do diretório de trabalho
      const safeCwd = path.resolve(process.cwd());
      if (!resolvedPath.startsWith(safeCwd + path.sep) && resolvedPath !== safeCwd) {
        return res.status(403).json({ error: '🔒 Acesso negado — caminho fora do diretório permitido.' });
      }

      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: `Imagem não encontrada: ${resolvedPath}` });
      }

      const mimeType = getMimeType(resolvedPath);
      const imagePart = fileToGenerativePart(resolvedPath, mimeType);
      
      // 🧠 Prompt dinâmico baseado em categoria + tipo de produto
      const cat = category || (productType || 'default').toLowerCase();
      const prompt = buildPrompt(cat, productType);

      console.log(`🤖 Gemini: Analisando ${path.basename(resolvedPath)} (cat=${cat}, type=${productType || 'auto'})...`);

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

      // 🔒 Validação: remover palavras proibidas
      const avoidWords = estampaPatterns?.rules?.avoidWords || [];
      if (avoidWords.length > 0) {
        const words = estampa.split(' ').filter(w => !avoidWords.includes(w.toLowerCase()));
        if (words.length > 0) estampa = words.join(' ');
      }
      // Limitar a 4 palavras max
      const maxWords = estampaPatterns?.rules?.maxWords || 4;
      const estampaWords = estampa.split(' ');
      if (estampaWords.length > maxWords) estampa = estampaWords.slice(0, maxWords).join(' ');

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

      const { images, category: batchCategory } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Array "images" é obrigatório.' });
      }

      console.log(`🤖 Gemini Batch: ${images.length} imagens para analisar (cat=${batchCategory || 'auto'})...`);

      const results = [];
      for (const item of images) {
        const { code, imagePath, productType, category } = item;
        try {
          const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
          if (!fs.existsSync(resolvedPath)) {
            results.push({ code, estampa: null, error: 'Imagem não encontrada' });
            continue;
          }

          const mimeType = getMimeType(resolvedPath);
          const imagePart = fileToGenerativePart(resolvedPath, mimeType);
          
          // 🧠 Prompt dinâmico: categoria do item > categoria do batch > auto
          const cat = category || batchCategory || (productType || 'default').toLowerCase();
          const prompt = buildPrompt(cat, productType);

          const result = await model.generateContent([prompt, imagePart]);
          const text = result.response.text().trim();

          let estampa = text
            .replace(/^["']+|["']+$/g, '').replace(/\.+$/, '')
            .replace(/^(Nome da estampa:|Estampa:|Nome:)\s*/i, '').trim();

          estampa = estampa.split(' ').map(w => {
            if (['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'em', 'no', 'na'].includes(w.toLowerCase())) return w.toLowerCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          }).join(' ');

          // 🔒 Validação: remover palavras proibidas que o Gemini pode incluir
          const avoidWords = estampaPatterns?.rules?.avoidWords || [];
          if (avoidWords.length > 0) {
            const words = estampa.split(' ').filter(w => !avoidWords.includes(w.toLowerCase()));
            if (words.length > 0) estampa = words.join(' ');
          }
          // Limitar a 4 palavras max
          const maxWords = estampaPatterns?.rules?.maxWords || 4;
          const estampaWords = estampa.split(' ');
          if (estampaWords.length > maxWords) estampa = estampaWords.slice(0, maxWords).join(' ');

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
