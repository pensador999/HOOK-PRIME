'use strict';

/**
 * routes/reverse-engineering.js — Laboratório de Engenharia Reversa & Ponte Sankhya (40ms)
 *
 * 100% Aditivo: Não apaga nem altera nenhum fluxo existente.
 *
 * Rotas expostas:
 *   GET    /reverse-lab                           -> Painel Visual (Sankhya 40ms + Catálogo de Blueprints)
 *   GET    /api/reverse-map/status                -> Status da sessão Sankhya (sktk) e resumo de rotas
 *   POST   /api/reverse-map/sankhya-session       -> Recebe sktk + mgeSession do Sniffer Tampermonkey
 *   GET    /api/reverse-map/sankhya/lookup        -> Busca 1 SKU em ~40ms via PesquisaSP.getSuggestion
 *   POST   /api/reverse-map/sankhya/lookup-batch  -> Busca lote de SKUs (5 paralelos) em milissegundos
 *   POST   /api/reverse-map/sankhya/call          -> Executa qualquer serviceName do Sankhya (service.sbr)
 *   GET    /api/reverse-map/blueprints            -> Lista todos os endpoints mapeados (Sankhya/Shopify/Magis5)
 *   POST   /api/reverse-map/capture               -> Registra nova chamada interceptada pelo Sniffer
 */

const express = require('express');
const sankhyaDirect = require('../services/sankhya-direct-api.js');

module.exports = function createReverseEngineeringRoutes() {
  const router = express.Router();

  // CORS liberado especificamente para que o Sniffer rodando em brk.sankhyacloud.com.br,
  // app.magis5.com.br ou admin.shopify.com possa enviar capturas sem bloqueio
  router.use('/api/reverse-map', (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. STATUS E PONTE DE SESSÃO SANKHYA (sktk + mgeSession)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/api/reverse-map/status', (req, res) => {
    const sess = sankhyaDirect.loadSankhyaSession();
    const blueprints = sankhyaDirect.loadBlueprints();

    const hasSession = Boolean(sess.sktk && sess.mgeSession);
    const mask = (str) =>
      str && str.length > 8
        ? `${str.slice(0, 4)}...${str.slice(-4)}`
        : (str ? 'ATIVO' : '');

    res.json({
      success: true,
      sankhyaSession: {
        connected: hasSession,
        host: sess.host,
        maskedSktk: mask(sess.sktk),
        maskedMgeSession: mask(sess.mgeSession),
        updatedAt: sess.updatedAt,
        captureSource: sess.captureSource,
      },
      blueprintsStats: {
        total: blueprints.length,
        sankhya: blueprints.filter(b => b.platform === 'sankhya').length,
        shopify: blueprints.filter(b => b.platform === 'shopify').length,
        magis5: blueprints.filter(b => b.platform === 'magis5').length,
        capturedLive: blueprints.filter(b => b.status === 'CAPTURED_LIVE').length,
      },
    });
  });

  router.post('/api/reverse-map/sankhya-session', (req, res) => {
    try {
      const body = req.body || {};
      const saved = sankhyaDirect.saveSankhyaSession({
        host: body.host,
        sktk: body.sktk,
        mgeSession: body.mgeSession,
        cookieHeader: body.cookieHeader,
        userAgent: body.userAgent,
        captureSource: body.captureSource || 'manual-or-sniffer',
      });

      res.json({
        success: true,
        connected: Boolean(saved.sktk && saved.mgeSession),
        updatedAt: saved.updatedAt,
        message: 'Sessão Sankhya (sktk + mgeSession) sincronizada com sucesso no HUB!',
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. BUSCA DIRETA DE SKUs NO SANKHYA (~40ms via PesquisaSP.getSuggestion)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/api/reverse-map/sankhya/lookup', async (req, res) => {
    try {
      const sku = String(req.query.sku || '').trim();
      if (!sku) return res.status(400).json({ success: false, error: 'Informe ?sku=CODIGO' });

      const result = await sankhyaDirect.lookupSkuDirect(sku);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/reverse-map/sankhya/lookup-batch', async (req, res) => {
    try {
      const body = req.body || {};
      const rawSkus = Array.isArray(body.skus)
        ? body.skus
        : String(body.skus || '')
            .split(/[\n,;]+/)
            .map(s => s.trim())
            .filter(Boolean);

      if (!rawSkus.length) {
        return res.status(400).json({ success: false, error: 'Informe ao menos 1 SKU no array skus.' });
      }

      const concurrency = Math.min(6, Math.max(1, parseInt(body.concurrency, 10) || 5));
      const summary = await sankhyaDirect.lookupSkusBatch(rawSkus, { concurrency });
      res.json({ success: true, ...summary });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/reverse-map/sankhya/call', async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.serviceName) {
        return res.status(400).json({ success: false, error: 'Informe serviceName (ex: CRUDServiceProvider.loadRecords).' });
      }
      const result = await sankhyaDirect.callSankhyaService({
        serviceName: body.serviceName,
        application: body.application || 'ProdutoServico',
        requestBody: body.requestBody || {},
      });
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. CATÁLOGO DE BLUEPRINTS E CAPTURA AO VIVO (SNIFFER)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/api/reverse-map/blueprints', (req, res) => {
    const platformFilter = req.query.platform ? String(req.query.platform).toLowerCase() : '';
    let list = sankhyaDirect.loadBlueprints();
    if (platformFilter) {
      list = list.filter(b => b.platform === platformFilter);
    }
    const enriched = list.map(bp => ({
      ...bp,
      codeSnippet: sankhyaDirect.generateFetchCodeSnippet(bp),
    }));
    res.json({
      success: true,
      total: enriched.length,
      blueprints: enriched,
    });
  });

  router.post('/api/reverse-map/capture', (req, res) => {
    try {
      const recorded = sankhyaDirect.recordCapturedBlueprint(req.body || {});
      res.json({
        success: true,
        blueprint: recorded,
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });


  router.get('/reverse-lab', (req, res) => res.redirect('/#magis5'));

  return router;
};
