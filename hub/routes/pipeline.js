/**
 * @module routes/pipeline
 * Pipeline Session — Memória dos Códigos
 * 
 * Acompanha todos os códigos sendo trabalhados do nascimento no HOOK PRIME
 * até a conclusão na Magis5. Funciona como ponte entre o Hub e os scripts Tampermonkey.
 * 
 * @version 1.0.0
 */
'use strict';
const router = require('express').Router();

module.exports = function ({ fs, path }) {

  const SESSIONS_FILE = path.join(__dirname, '..', 'config', 'pipeline-sessions.json');

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('⚠️ Erro ao ler pipeline-sessions.json:', e.message);
    }
    return [];
  }

  function saveSessions(sessions) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
    } catch (e) {
      console.warn('⚠️ Erro ao salvar pipeline-sessions.json:', e.message);
    }
  }

  function findActiveSession(sessions) {
    return sessions.find(s => s.status === 'in_progress') || sessions[0] || null;
  }

  function generateSessionId() {
    return 'session_' + Date.now();
  }

  // Mapeia store → canal Shopify na Magis5
  const STORE_CHANNEL_MAP = {
    fishing: 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
    agro: 'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
    motors: 'shopify-7495282216c04726834a39582e5369dd',
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  //  CRUD DE SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/pipeline/sessions
   * Lista todas as sessions (mais recente primeiro)
   */
  router.get('/api/pipeline/sessions', (req, res) => {
    const sessions = loadSessions();
    // Retorna resumo sem os detalhes pesados
    const summaries = sessions.map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      status: s.status,
      brand: s.brand,
      store: s.store,
      totalCodes: s.codes ? s.codes.length : 0,
      summary: s.summary || {},
    }));
    res.json({ success: true, sessions: summaries });
  });

  /**
   * GET /api/pipeline/sessions/:id
   * Detalhes completos de uma session
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
            shopify: { status: 'pending', shopifyIds: [] },
            magis5Import: { status: 'pending' },
            magis5Estoque: { status: 'pending' },
          },
        })),
        shopifyIds: {},
        summary: {
          totalCodes: codes.length,
          totalVariations: codes.reduce((acc, c) => acc + (c.variations ? c.variations.length : 0), 0),
          shopifyExtracted: 0,
          imported: 0,
          estoqueOk: 0,
          pending: codes.length,
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
   * Retorna a session ativa (mais recente in_progress)
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
   * Tenta associar automaticamente a códigos da session via shopifyIds map.
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
        return res.json({ success: true, matched: 0, unmatched: ids.length, message: 'Nenhuma session ativa. IDs registrados mas não associados.' });
      }

      const now = new Date().toISOString();
      let matched = 0;

      // Registra todos os IDs no mapa da session
      ids.forEach(id => {
        const strId = String(id).trim();
        if (!strId) return;

        if (!session.shopifyIds[strId]) {
          session.shopifyIds[strId] = '';  // Ainda não associado a um código
        }

        // Tentar associar: percorrer códigos que ainda não têm shopifyId
        const pendingCodes = session.codes.filter(c => 
          c.pipeline.shopify.status === 'pending' && 
          c.pipeline.shopify.shopifyIds.length === 0
        );

        if (pendingCodes.length > 0) {
          // Associa sequencialmente (na ordem dos códigos)
          const code = pendingCodes[0];
          code.pipeline.shopify.shopifyIds.push(strId);
          code.pipeline.shopify.status = 'done';
          code.pipeline.shopify.timestamp = now;
          session.shopifyIds[strId] = code.base;
          matched++;
        }
      });

      // Atualizar resumo
      session.summary.shopifyExtracted = Object.keys(session.shopifyIds).length;
      session.summary.pending = session.codes.filter(c => c.pipeline.shopify.status === 'pending').length;
      session.updatedAt = now;

      saveSessions(sessions);

      console.log(`📡 Pipeline Shopify: ${ids.length} IDs recebidos, ${matched} associados (session ${session.id})`);
      res.json({ success: true, matched, unmatched: ids.length - matched, sessionId: session.id });
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
   */
  router.get('/api/pipeline/pending-ids', (req, res) => {
    const sessions = loadSessions();
    const session = findActiveSession(sessions);

    if (!session) {
      return res.json({ success: true, ids: [], store: '', total: 0, remaining: 0 });
    }

    // Coletar IDs que foram registrados mas cujos códigos ainda não foram importados na Magis5
    const pendingIds = [];
    session.codes.forEach(c => {
      if (c.pipeline.magis5Import.status !== 'done' && c.pipeline.shopify.shopifyIds.length > 0) {
        pendingIds.push(...c.pipeline.shopify.shopifyIds);
      }
    });

    // Também incluir IDs do mapa que não foram associados
    Object.entries(session.shopifyIds).forEach(([id, code]) => {
      if (!code && !pendingIds.includes(id)) {
        pendingIds.push(id);
      }
    });

    const channel = STORE_CHANNEL_MAP[session.store] || '';

    res.json({
      success: true,
      sessionId: session.id,
      store: session.store,
      channel,
      ids: pendingIds,
      total: session.codes.length,
      remaining: pendingIds.length,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  //  PENDING TITLES — Script Estoque busca títulos de Produção
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/pipeline/pending-titles
   * Script Estoque Infinito busca títulos masculinos de produtos de Produção
   * que já foram importados na Magis5 mas ainda não receberam estoque.
   */
  router.get('/api/pipeline/pending-titles', (req, res) => {
    const sessions = loadSessions();
    const session = findActiveSession(sessions);

    if (!session) {
      return res.json({ success: true, titles: [], totalCodes: 0, production: 0, resale: 0 });
    }

    // Filtrar: Produção + já importado na Magis5 + estoque ainda pendente
    const pendingTitles = [];
    let production = 0;
    let resale = 0;

    session.codes.forEach(c => {
      if (c.tipo === 'producao') {
        production++;
        // Retorna títulos de Produção que foram importados mas estoque ainda pendente
        if (c.pipeline.magis5Import.status === 'done' && c.pipeline.magis5Estoque.status !== 'done') {
          if (c.titleMasc) pendingTitles.push(c.titleMasc);
        }
        // Se magis5Import ainda pendente mas queremos pre-carregar os títulos mesmo assim
        // para o caso do usuário querer rodar estoque em tudo que foi importado
        if (c.pipeline.magis5Import.status !== 'done' && c.titleMasc && !pendingTitles.includes(c.titleMasc)) {
          // Não adiciona — só adiciona os já importados
        }
      } else {
        resale++;
      }
    });

    // Se nenhum foi importado ainda, retornar TODOS de produção (pré-carregamento)
    if (pendingTitles.length === 0) {
      session.codes.forEach(c => {
        if (c.tipo === 'producao' && c.titleMasc && c.pipeline.magis5Estoque.status !== 'done') {
          pendingTitles.push(c.titleMasc);
        }
      });
    }

    // Deduplicar títulos (ex: mesmo código base pode ter grupo com mesmo título)
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
   */
  router.post('/api/pipeline/import-progress', (req, res) => {
    try {
      const { sessionId, shopifyId, status, tipo, codeBase } = req.body;
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
      const strId = String(shopifyId).trim();

      // Encontrar o código associado a este shopifyId
      let code = null;
      if (codeBase) {
        code = session.codes.find(c => c.base === codeBase);
      }
      if (!code && strId) {
        code = session.codes.find(c => c.pipeline.shopify.shopifyIds.includes(strId));
      }
      if (!code && session.shopifyIds[strId]) {
        code = session.codes.find(c => c.base === session.shopifyIds[strId]);
      }

      if (code) {
        code.pipeline.magis5Import.status = status === 'success' ? 'done' : 'error';
        code.pipeline.magis5Import.timestamp = now;
        if (tipo) code.tipo = tipo;  // Atualiza tipo detectado pelo script
      }

      // Atualizar resumo
      session.summary.imported = session.codes.filter(c => c.pipeline.magis5Import.status === 'done').length;
      session.updatedAt = now;
      saveSessions(sessions);

      res.json({ success: true, code: code ? code.base : null });
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

      // Encontrar código pelo título masculino
      if (title) {
        const normalizedTitle = title.trim().toLowerCase();
        const code = session.codes.find(c => 
          c.titleMasc && c.titleMasc.trim().toLowerCase() === normalizedTitle
        );
        if (code) {
          code.pipeline.magis5Estoque.status = status === 'success' ? 'done' : 'error';
          code.pipeline.magis5Estoque.timestamp = now;
        }
      }

      // Atualizar resumo
      session.summary.estoqueOk = session.codes.filter(c => c.pipeline.magis5Estoque.status === 'done').length;
      session.updatedAt = now;

      // Verificar se tudo está completo
      const allDone = session.codes.every(c => {
        if (c.tipo === 'producao') {
          return c.pipeline.magis5Import.status === 'done' && c.pipeline.magis5Estoque.status === 'done';
        }
        return c.pipeline.magis5Import.status === 'done';  // Revenda não precisa estoque
      });
      if (allDone) session.status = 'completed';

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
