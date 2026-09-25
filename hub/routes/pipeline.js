/**
 * @module routes/pipeline
 * Pipeline Session — Memória dos Códigos
 * 
 * Acompanha todos os códigos sendo trabalhados do nascimento no HOOK PRIME
 * até a conclusão na Magis5. Funciona como ponte entre o Hub e os scripts Tampermonkey.
 * 
 * FLUXO:
 * Step 6 exporta CSV → cria Session com códigos + títulos
 * Script Shopify → envia IDs extraídos (lista simples, sem associação)
 * Script Magis5 → busca IDs pendentes, importa, reporta progresso com SKU base
 * Script Estoque → busca títulos masculinos de Produção, reporta progresso
 * Dashboard SPA → mostra progresso em tempo real
 * 
 * @version 3.0.0
 */
'use strict';
const router = require('express').Router();

module.exports = function ({ fs, path }) {

  const SESSIONS_FILE = path.join(__dirname, '..', 'config', 'pipeline-sessions.json');

  // ── Helpers (cache em memória + write lock) ────────────────────────────────

  let _cache = null;
  let _writing = false;

  function loadSessions() {
    if (_cache) return _cache;
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        _cache = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        return _cache;
      }
    } catch (e) {
      console.warn('⚠️ Erro ao ler pipeline-sessions.json:', e.message);
    }
    _cache = [];
    return _cache;
  }

  function saveSessions(sessions) {
    _cache = sessions;
    if (_writing) return; // Debounce: já tem um save pendente
    _writing = true;
    setImmediate(() => {
      try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(_cache, null, 2), 'utf8');
      } catch (e) {
        console.warn('⚠️ Erro ao salvar pipeline-sessions.json:', e.message);
      }
      _writing = false;
    });
  }

  /**
   * Busca session ativa (in_progress). Retorna null se não houver.
   * NÃO faz fallback para sessions completadas — evita que scripts
   * recebam dados de uma session já finalizada.
   */
  function findActiveSession(sessions) {
    return sessions.find(s => s.status === 'in_progress') || null;
  }

  function generateSessionId() {
    return 'session_' + Date.now();
  }

  // Mapeia store → canal Shopify na Magis5 (externalizado em config/channels.json)
  let STORE_CHANNEL_MAP = {};
  try {
    STORE_CHANNEL_MAP = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'config', 'channels.json'), 'utf8'
    ));
  } catch (_) {
    STORE_CHANNEL_MAP = {
      fishing: 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
      agro: 'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
      motors: 'shopify-7495282216c04726834a39582e5369dd',
    };
    console.warn('⚠️ channels.json não encontrado — usando fallback hardcoded');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  CRUD DE SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/pipeline/sessions
   * Lista todas as sessions (mais recente primeiro)
   */
  router.get('/api/pipeline/sessions', (req, res) => {
    const sessions = loadSessions();
    res.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        status: s.status,
        brand: s.brand,
        store: s.store,
        totalCodes: s.codes.length,
        summary: s.summary,
      })),
    });
  });

  /**
   * GET /api/pipeline/sessions/:id
   * Retorna uma session específica com todos os detalhes
   */
  router.get('/api/pipeline/sessions/:id', (req, res) => {
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session não encontrada' });
    res.json({ success: true, session });
  });

  /**
   * POST /api/pipeline/sessions
   * Cria nova session (chamado pelo Step 6 ao exportar CSV)
   */
  router.post('/api/pipeline/sessions', (req, res) => {
    try {
      const { brand, store, codes } = req.body;
      if (!codes || !Array.isArray(codes) || codes.length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum código fornecido' });
      }

      const sessions = loadSessions();
      
      // Marca sessions anteriores como completed
      sessions.forEach(s => {
        if (s.status === 'in_progress') {
          s.status = 'completed';
          s.updatedAt = new Date().toISOString();
        }
      });

      const now = new Date().toISOString();
      const sessionId = generateSessionId();

      const session = {
        id: sessionId,
        createdAt: now,
        updatedAt: now,
        status: 'in_progress',
        brand: brand || '',
        store: store || 'fishing',
        codes: codes.map(c => ({
          base: c.base,
          productType: c.productType || '',
          estampa: c.estampa || '',
          titleMasc: c.titleMasc || '',
          genders: c.genders || ['masc'],
          codesGenerated: c.codesGenerated || {},
          variations: c.variations || [],
          tipo: c.tipo || 'producao',
          pipeline: {
            hookPrime: { status: 'done', timestamp: now },
            ean: { status: 'pending' },
            sankhya: { status: 'pending' },
            bling: { status: 'pending' },
            shopify: { status: 'pending' },
            magis5Import: { status: 'pending' },
            magis5Estoque: { status: 'pending' },
          },
        })),
        // Lista simples de IDs Shopify — sem associação cega a códigos
        shopifyIds: [],
        summary: {
          totalCodes: codes.length,
          totalVariations: codes.reduce((acc, c) => acc + (c.variations ? c.variations.length : 0), 0),
          shopifyExtracted: 0,
          imported: 0,
          estoqueOk: 0,
        },
      };

      sessions.unshift(session);

      // Manter apenas últimas 50 sessions
      if (sessions.length > 50) sessions.length = 50;

      saveSessions(sessions);

      console.log(`📋 Pipeline: Nova session ${sessionId} com ${codes.length} códigos (${brand})`);
      res.json({ success: true, sessionId, totalCodes: codes.length });
    } catch (err) {
      console.error('❌ Pipeline create error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * PATCH /api/pipeline/sessions/:id
   * Atualiza status geral da session
   */
  router.patch('/api/pipeline/sessions/:id', (req, res) => {
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session não encontrada' });

    const { status } = req.body;
    if (status) session.status = status;
    session.updatedAt = new Date().toISOString();
    saveSessions(sessions);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  SESSION ATIVA
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/pipeline/active
   * Retorna a session ativa (in_progress)
   */
  router.get('/api/pipeline/active', (req, res) => {
    const sessions = loadSessions();
    const active = findActiveSession(sessions);
    if (!active) return res.json({ success: true, session: null });
    res.json({ success: true, session: active });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  SHOPIFY IDS — Script Shopify envia IDs extraídos
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/pipeline/shopify-ids
   * Script Shopify envia IDs extraídos dos anúncios.
   * IDs são armazenados como lista simples — a associação código↔ID
   * acontece depois, quando o Script Magis5 importa e lê o SKU real.
   */
  router.post('/api/pipeline/shopify-ids', (req, res) => {
    try {
      const { sessionId, store, ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum ID fornecido' });
      }

      const sessions = loadSessions();
      let session;

      if (sessionId) {
        session = sessions.find(s => s.id === sessionId);
      } else {
        session = findActiveSession(sessions);
      }

      if (!session) {
        return res.json({ success: true, stored: 0, message: 'Nenhuma session ativa.' });
      }

      const now = new Date().toISOString();

      // Armazena IDs como lista simples (sem associação cega)
      let newCount = 0;
      ids.forEach(id => {
        const strId = String(id).trim();
        if (strId && !session.shopifyIds.includes(strId)) {
          session.shopifyIds.push(strId);
          newCount++;
        }
      });

      // Marca etapa shopify como done APENAS quando temos IDs suficientes
      // (evita marcar cegamente todos como done com extração parcial)
      if (session.shopifyIds.length >= session.codes.length) {
        session.codes.forEach(c => {
          if (c.pipeline.shopify.status === 'pending') {
            c.pipeline.shopify.status = 'done';
            c.pipeline.shopify.timestamp = now;
          }
        });
      }

      // Atualizar resumo
      session.summary.shopifyExtracted = session.shopifyIds.length;
      session.updatedAt = now;

      saveSessions(sessions);

      console.log(`📡 Pipeline Shopify: ${newCount} novos IDs (total: ${session.shopifyIds.length}) — session ${session.id}`);
      res.json({ success: true, stored: newCount, total: session.shopifyIds.length, sessionId: session.id });
    } catch (err) {
      console.error('❌ Pipeline shopify-ids error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  PENDING IDS — Script Magis5 busca IDs para importar
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/pipeline/pending-ids
   * Script Magis5 busca IDs Shopify pendentes para importação.
   * Retorna todos os IDs que foram extraídos do Shopify.
   */
  router.get('/api/pipeline/pending-ids', (req, res) => {
    const sessions = loadSessions();
    const session = findActiveSession(sessions);

    if (!session) {
      return res.json({ success: true, ids: [], store: '', total: 0 });
    }

    const channel = STORE_CHANNEL_MAP[session.store] || '';

    // Filtrar IDs que já foram importados com sucesso (evita reimportação)
    const importedShopifyIds = new Set(
      session.codes
        .filter(c => c.pipeline.magis5Import.status === 'done')
        .map(c => c.pipeline.magis5Import.shopifyId)
        .filter(Boolean)
    );
    const pendingIds = session.shopifyIds.filter(id => !importedShopifyIds.has(id));

    res.json({
      success: true,
      sessionId: session.id,
      store: session.store,
      channel,
      ids: pendingIds,
      total: pendingIds.length,
      totalAll: session.shopifyIds.length,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  PENDING TITLES — Script Estoque busca títulos de Produção
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/pipeline/pending-titles
   * Script Estoque Infinito busca títulos masculinos de produtos de Produção
   * que ainda não receberam estoque.
   */
  router.get('/api/pipeline/pending-titles', (req, res) => {
    const sessions = loadSessions();
    const session = findActiveSession(sessions);

    if (!session) {
      return res.json({ success: true, titles: [], totalCodes: 0, production: 0, resale: 0 });
    }

    let production = 0;
    let resale = 0;
    const pendingTitles = [];

    session.codes.forEach(c => {
      if (c.tipo === 'producao') {
        production++;
        // Retorna títulos de Produção com estoque ainda pendente
        if (c.pipeline.magis5Estoque.status !== 'done' && c.titleMasc) {
          pendingTitles.push(c.titleMasc);
        }
      } else {
        resale++;
      }
    });

    // Deduplicar títulos
    const uniqueTitles = [...new Set(pendingTitles)];

    res.json({
      success: true,
      sessionId: session.id,
      titles: uniqueTitles,
      totalCodes: session.codes.length,
      production,
      resale,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  IMPORT PROGRESS — Script Magis5 reporta progresso
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/pipeline/import-progress
   * Script Magis5 reporta resultado de importação de um anúncio.
   * 
   * O script envia o `skuBase` (primeiro SKU da tela sem sufixo de tamanho),
   * o `shopifyId` do anúncio, e o `tipo` detectado (producao/revenda).
   * 
   * Busca o código na session por:
   * 1. skuBase → match direto com c.base
   * 2. skuBase → match em c.variations (código + tamanho)
   * 3. Se não encontrar, incrementa o contador global de importados
   */
  router.post('/api/pipeline/import-progress', (req, res) => {
    try {
      const { sessionId, shopifyId, status, tipo, skuBase } = req.body;
      const sessions = loadSessions();
      let session;

      if (sessionId) {
        session = sessions.find(s => s.id === sessionId);
      } else {
        session = findActiveSession(sessions);
      }

      if (!session) {
        return res.json({ success: true, message: 'Nenhuma session ativa' });
      }

      const now = new Date().toISOString();
      let matchedCode = null;

      // Tentar encontrar o código pelo SKU base
      if (skuBase) {
        const skuUpper = skuBase.toUpperCase();

        // Match direto pelo base
        matchedCode = session.codes.find(c => c.base.toUpperCase() === skuUpper);

        // Match por variação (SKU pode ser um código com sufixo de tamanho)
        if (!matchedCode) {
          matchedCode = session.codes.find(c =>
            c.variations && c.variations.some(v => v.toUpperCase() === skuUpper)
          );
        }

        // Match parcial — o SKU base pode ser prefixo de um código gerado
        if (!matchedCode) {
          matchedCode = session.codes.find(c => {
            const codes = Object.values(c.codesGenerated || {});
            return codes.some(code => code && code.toUpperCase() === skuUpper);
          });
        }
      }

      if (matchedCode) {
        matchedCode.pipeline.magis5Import.status = status === 'success' ? 'done' : 'error';
        matchedCode.pipeline.magis5Import.timestamp = now;
        matchedCode.pipeline.magis5Import.shopifyId = shopifyId || '';
        // Atualiza tipo detectado pelo Script Magis5 (corrige o default 'producao')
        if (tipo && tipo !== 'pular') matchedCode.tipo = tipo;
      }

      // Atualizar resumo (conta globalmente)
      session.summary.imported = session.codes.filter(c => c.pipeline.magis5Import.status === 'done').length;
      session.updatedAt = now;

      // Verificar se tudo está completo (cobre caso onde todos são revenda)
      const allDone = session.codes.every(c => {
        if (c.tipo === 'producao') {
          return c.pipeline.magis5Import.status === 'done' && c.pipeline.magis5Estoque.status === 'done';
        }
        return c.pipeline.magis5Import.status === 'done';
      });
      if (allDone && session.codes.length > 0) session.status = 'completed';

      saveSessions(sessions);

      res.json({ success: true, matched: matchedCode ? matchedCode.base : null });
    } catch (err) {
      console.error('❌ Pipeline import-progress error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  ESTOQUE PROGRESS — Script Estoque reporta progresso
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/pipeline/estoque-progress
   * Script Estoque Infinito reporta que um produto recebeu estoque.
   * Busca o código pelo título masculino (match exato normalizado).
   */
  router.post('/api/pipeline/estoque-progress', (req, res) => {
    try {
      const { sessionId, title, status } = req.body;
      const sessions = loadSessions();
      let session;

      if (sessionId) {
        session = sessions.find(s => s.id === sessionId);
      } else {
        session = findActiveSession(sessions);
      }

      if (!session) {
        return res.json({ success: true, message: 'Nenhuma session ativa' });
      }

      const now = new Date().toISOString();

      // Encontrar código pelo título masculino (matching resiliente)
      if (title) {
        // Normalização: remove pontuação, colapsa espaços, lowercase
        const normalize = (t) => (t || '').replace(/[^\w\sÀ-ÿ]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
        const normalizedTitle = normalize(title);
        const code = session.codes.find(c =>
          c.titleMasc && normalize(c.titleMasc) === normalizedTitle
        );
        if (code) {
          code.pipeline.magis5Estoque.status = status === 'success' ? 'done' : 'error';
          code.pipeline.magis5Estoque.timestamp = now;
        }
      }

      // Atualizar resumo
      session.summary.estoqueOk = session.codes.filter(c => c.pipeline.magis5Estoque.status === 'done').length;
      session.updatedAt = now;

      // Verificar se tudo está completo (guard: codes.length > 0)
      const allDone = session.codes.every(c => {
        if (c.tipo === 'producao') {
          return c.pipeline.magis5Import.status === 'done' && c.pipeline.magis5Estoque.status === 'done';
        }
        return c.pipeline.magis5Import.status === 'done';  // Revenda não precisa estoque
      });
      if (allDone && session.codes.length > 0) session.status = 'completed';

      saveSessions(sessions);
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Pipeline estoque-progress error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  BULK UPDATE — Marcar etapas manuais como concluídas
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/pipeline/mark-step
   * Marca uma etapa manual (ean, sankhya, bling) como concluída para todos os códigos.
   */
  router.post('/api/pipeline/mark-step', (req, res) => {
    try {
      const { sessionId, step } = req.body;
      const validSteps = ['ean', 'sankhya', 'bling'];
      if (!step || !validSteps.includes(step)) {
        return res.status(400).json({ success: false, error: `Step inválido. Use: ${validSteps.join(', ')}` });
      }

      const sessions = loadSessions();
      let session;
      if (sessionId) {
        session = sessions.find(s => s.id === sessionId);
      } else {
        session = findActiveSession(sessions);
      }

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session não encontrada' });
      }

      const now = new Date().toISOString();
      session.codes.forEach(c => {
        c.pipeline[step] = { status: 'done', timestamp: now };
      });
      session.updatedAt = now;
      saveSessions(sessions);

      console.log(`📋 Pipeline: Step "${step}" marcado como concluído para ${session.codes.length} códigos`);
      res.json({ success: true, step, codesUpdated: session.codes.length });
    } catch (err) {
      console.error('❌ Pipeline mark-step error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
