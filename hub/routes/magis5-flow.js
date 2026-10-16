'use strict';

/**
 * routes/magis5-flow.js — Orquestrador Zero-Click: Shopify Flow -> HUB -> Magis5 API
 *
 * Criado de forma 100% ADITIVA: mantém todos os scripts Tampermonkey atuais intactos
 * por segurança, enquanto deixa toda a estrutura de Webhook (Shopify Flow), Descoberta
 * Automática dos 3 sites (Fishing/Agro/Motors), Fila Persistente e Cliente Magis5 API
 * (`X-MAGIS5-APIKEY`) pronta para uso imediato.
 *
 * Rotas expostas:
 *   GET    /magis5-flow                   -> Painel Visual de Controle & Guia Shopify Flow
 *   GET    /api/magis5/status             -> Status da integração, canais e resumo da fila
 *   POST   /api/magis5/config             -> Salvar X-MAGIS5-APIKEY e parâmetros operacionais
 *   POST   /api/magis5/test               -> Testar conectividade com a API da Magis5
 *   POST   /api/magis5/webhook/shopify    -> Receber disparo automático do Shopify Flow / Webhook
 *   GET    /api/magis5/shopify/discover   -> Descobrir IDs de anúncios direto das 3 lojas BRK
 *   POST   /api/magis5/shopify/discover   -> Descobrir e opcionalmente já enfileirar anúncios
 *   GET    /api/magis5/queue              -> Listar fila de importação + estoque infinito
 *   POST   /api/magis5/queue/enqueue      -> Enfileirar 1 ou mais anúncios manualmente
 *   POST   /api/magis5/queue/process      -> Disparar fila na API Magis5 (quando API Key ativa)
 *   DELETE /api/magis5/queue/:id          -> Remover item da fila (ou `clear-completed`)
 */

const express = require('express');
const magis5 = require('../services/magis5-client.js');

module.exports = function createMagis5FlowRoutes({ fs, path }) {
  const router = express.Router();
  const SESSIONS_FILE = path.join(__dirname, '..', 'config', 'pipeline-sessions.json');

  // Helper opcional para também alimentar a sessão ativa do pipeline legado (100% compatível)
  function syncToLegacyPipelineSession({ shopifyProductId, store, title, skus = [] }) {
    try {
      if (!fs.existsSync(SESSIONS_FILE)) return false;
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      if (!Array.isArray(sessions) || sessions.length === 0) return false;

      const active = sessions.find(s => s.status !== 'completed') || sessions[0];
      if (!active) return false;

      if (!Array.isArray(active.shopifyIds)) active.shopifyIds = [];
      const cleanId = magis5.normalizeShopifyProductId(shopifyProductId);
      if (!cleanId) return false;

      const exists = active.shopifyIds.some(
        item => (typeof item === 'object' ? item.id : String(item)) === cleanId
      );

      if (!exists) {
        active.shopifyIds.push({
          id: cleanId,
          store: store || 'fishing',
          title: title || '',
          skus: Array.isArray(skus) ? skus : [],
          capturedAt: new Date().toISOString(),
          source: 'shopify-flow-webhook',
        });
        active.updatedAt = new Date().toISOString();
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
        return true;
      }
    } catch (_err) {
      // Silencioso para jamais impactar o fluxo principal
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. STATUS & CONFIGURAÇÃO DA API MAGIS5
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/api/magis5/status', (req, res) => {
    const cfg = magis5.loadConfig();
    const queue = magis5.loadQueue();

    const hasKey = Boolean(cfg.apiKey && cfg.apiKey.trim());
    const maskedKey = hasKey
      ? `${cfg.apiKey.trim().slice(0, 4)}${'*'.repeat(Math.max(4, cfg.apiKey.trim().length - 8))}${cfg.apiKey.trim().slice(-4)}`
      : '';

    const stats = {
      total: queue.length,
      ready_for_api: queue.filter(i => i.status === 'ready_for_api' || i.status === 'ready_waiting_api_key').length,
      processing: queue.filter(i => i.status === 'processing').length,
      completed: queue.filter(i => i.status === 'completed').length,
      skipped: queue.filter(i => i.status === 'skipped_all_kit').length,
      error: queue.filter(i => i.status === 'api_error').length,
    };

    res.json({
      success: true,
      mode: hasKey ? 'LIVE_API' : 'PREPARED_QUEUE',
      configured: hasKey,
      maskedApiKey: maskedKey,
      baseUrl: cfg.baseUrl,
      defaultStockFixed: cfg.defaultStockFixed,
      revendaWarehouseId: cfg.revendaWarehouseId,
      revendaWarehouseLabel: cfg.revendaWarehouseLabel,
      autoProcessWebhook: cfg.autoProcessWebhook,
      endpoints: cfg.endpoints,
      channels: cfg.channels,
      queueStats: stats,
    });
  });

  router.post('/api/magis5/config', (req, res) => {
    try {
      const body = req.body || {};
      const current = magis5.loadConfig();

      const patch = {};
      if (typeof body.apiKey === 'string') patch.apiKey = body.apiKey.trim();
      if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) patch.baseUrl = body.baseUrl.trim();
      if (typeof body.webhookSecret === 'string') patch.webhookSecret = body.webhookSecret.trim();
      if (body.defaultStockFixed !== undefined) {
        patch.defaultStockFixed = Math.max(0, parseInt(body.defaultStockFixed, 10) || 1000);
      }
      if (typeof body.revendaWarehouseId === 'string' && body.revendaWarehouseId.trim()) {
        patch.revendaWarehouseId = body.revendaWarehouseId.trim();
      }
      if (typeof body.autoProcessWebhook === 'boolean') {
        patch.autoProcessWebhook = body.autoProcessWebhook;
      }
      if (body.endpoints && typeof body.endpoints === 'object') {
        patch.endpoints = { ...current.endpoints, ...body.endpoints };
      }

      const saved = magis5.saveConfig(patch);
      const hasKey = Boolean(saved.apiKey && saved.apiKey.trim());

      res.json({
        success: true,
        mode: hasKey ? 'LIVE_API' : 'PREPARED_QUEUE',
        configured: hasKey,
        message: hasKey
          ? 'Chave X-MAGIS5-APIKEY salva! O sistema agora está em MODO LIVE API.'
          : 'Configuração salva em MODO PREPARADO (aguardando X-MAGIS5-APIKEY).',
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/magis5/test', async (req, res) => {
    try {
      const result = await magis5.testMagis5Connection();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. WEBHOOK OFICIAL SHOPIFY FLOW / SHOPIFY NATIVE WEBHOOK
  // ═══════════════════════════════════════════════════════════════════════════

  router.post('/api/magis5/webhook/shopify', async (req, res) => {
    try {
      const cfg = magis5.loadConfig();

      if (cfg.webhookSecret) {
        const headerSecret = req.headers['x-hookprime-secret'] || req.headers['x-shopify-flow-secret'] || req.query.secret || '';
        if (headerSecret !== cfg.webhookSecret) {
          return res.status(401).json({ success: false, error: 'Webhook secret inválido' });
        }
      }

      const body = req.body || {};

      const rawId =
        body.shopifyProductId ||
        body.legacyResourceId ||
        body.product_id ||
        body.id ||
        body.admin_graphql_api_id ||
        '';

      const shopDomain =
        body.shopDomain ||
        body.shop_domain ||
        req.headers['x-shopify-shop-domain'] ||
        '';

      const storeHint = body.store || body.vendor || shopDomain || 'fishing';
      const title = body.title || body.product_title || '';
      const handle = body.handle || '';

      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      const variants = rawVariants.map(v => {
        if (typeof v === 'string') return { sku: v.trim().toUpperCase() };
        return {
          id: String(v.id || v.legacyResourceId || ''),
          sku: String(v.sku || '').trim().toUpperCase(),
          title: String(v.title || ''),
          price: v.price || null,
          barcode: v.barcode || null,
        };
      }).filter(v => v.sku);

      const skus = Array.isArray(body.skus)
        ? body.skus.map(s => String(s || '').trim().toUpperCase()).filter(Boolean)
        : variants.map(v => v.sku);

      const hasKey = Boolean(cfg.apiKey && cfg.apiKey.trim());
      const item = await magis5.enqueueShopifyAd(
        {
          shopifyProductId: rawId,
          store: storeHint,
          shopDomain,
          title,
          handle,
          skus,
          variants,
          stockFixed: body.stockFixed || cfg.defaultStockFixed,
          source: 'shopify-flow',
        },
        { executeNow: hasKey && cfg.autoProcessWebhook }
      );

      const syncedToLegacy = syncToLegacyPipelineSession({
        shopifyProductId: item.shopifyProductId,
        store: item.store,
        title: item.title,
        skus: (item.variants || []).map(v => v.sku),
      });

      res.json({
        success: true,
        syncedToLegacyPipeline: syncedToLegacy,
        mode: hasKey ? 'LIVE_API' : 'PREPARED_QUEUE',
        item,
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. DESCOBERTA AUTOMÁTICA DIRETO DOS 3 SITES (SEM SCRIPT DE NAVEGADOR)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/api/magis5/shopify/discover', async (req, res) => {
    try {
      const storesParam = req.query.stores
        ? String(req.query.stores).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : ['fishing', 'agro', 'motors'];
      const maxPages = Math.min(5, Math.max(1, parseInt(req.query.pages, 10) || 1));
      const limit = Math.min(250, Math.max(10, parseInt(req.query.limit, 10) || 30));

      const result = await magis5.discoverShopifyAdsFromStores({
        stores: storesParam,
        maxPagesPerStore: maxPages,
        limitPerPage: limit,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/magis5/shopify/discover', async (req, res) => {
    try {
      const body = req.body || {};
      const stores = Array.isArray(body.stores) && body.stores.length
        ? body.stores
        : ['fishing', 'agro', 'motors'];
      const maxPages = Math.min(5, Math.max(1, parseInt(body.pages, 10) || 1));
      const limit = Math.min(250, Math.max(10, parseInt(body.limit, 10) || 30));
      const autoEnqueue = Boolean(body.autoEnqueue);
      const filterSkus = Array.isArray(body.filterSkus)
        ? new Set(body.filterSkus.map(s => String(s).trim().toUpperCase()).filter(Boolean))
        : null;

      const result = await magis5.discoverShopifyAdsFromStores({
        stores,
        maxPagesPerStore: maxPages,
        limitPerPage: limit,
      });

      let ads = result.ads || [];
      if (filterSkus && filterSkus.size > 0) {
        ads = ads.filter(ad =>
          filterSkus.has(ad.skuBase) || ad.skus.some(s => filterSkus.has(s))
        );
      }

      const enqueued = [];
      if (autoEnqueue) {
        for (const ad of ads) {
          const item = await magis5.enqueueShopifyAd({
            shopifyProductId: ad.shopifyProductId,
            store: ad.store,
            title: ad.title,
            handle: ad.handle,
            skus: ad.skus,
            variants: ad.variants,
            source: 'store-discovery',
          });
          enqueued.push(item);
        }
      }

      res.json({
        success: true,
        totalDiscovered: ads.length,
        enqueuedCount: enqueued.length,
        errors: result.errors,
        ads,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  4. FILA DE EXECUÇÃO MAGIS5 (IMPORTAÇÃO + ESTOQUE INFINITO 1000)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/api/magis5/queue', (req, res) => {
    const queue = magis5.loadQueue();
    res.json({
      success: true,
      total: queue.length,
      items: queue,
    });
  });

  router.post('/api/magis5/queue/enqueue', async (req, res) => {
    try {
      const body = req.body || {};
      const itemsInput = Array.isArray(body.items) ? body.items : [body];
      const results = [];

      for (const entry of itemsInput) {
        const item = await magis5.enqueueShopifyAd({
          shopifyProductId: entry.shopifyProductId || entry.id,
          store: entry.store || 'fishing',
          title: entry.title || '',
          handle: entry.handle || '',
          skus: entry.skus || [],
          variants: entry.variants || [],
          stockFixed: entry.stockFixed,
          source: entry.source || 'manual-hub',
        });
        syncToLegacyPipelineSession({
          shopifyProductId: item.shopifyProductId,
          store: item.store,
          title: item.title,
          skus: (item.variants || []).map(v => v.sku),
        });
        results.push(item);
      }

      res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/api/magis5/queue/process', async (req, res) => {
    try {
      const body = req.body || {};
      const queue = magis5.loadQueue();

      const targetIds = body.id
        ? [body.id]
        : queue
            .filter(i => i.status === 'ready_for_api' || i.status === 'ready_waiting_api_key' || i.status === 'api_error')
            .map(i => i.queueId);

      const processed = [];
      for (const id of targetIds) {
        const updated = await magis5.executeQueueItem(id);
        processed.push(updated);
      }

      res.json({
        success: true,
        processedCount: processed.length,
        items: processed,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/api/magis5/queue/:id', (req, res) => {
    const id = req.params.id;
    let queue = magis5.loadQueue();

    if (id === 'clear-completed') {
      const before = queue.length;
      queue = queue.filter(i => i.status !== 'completed' && i.status !== 'skipped_all_kit');
      magis5.saveQueue(queue);
      return res.json({ success: true, removed: before - queue.length, remaining: queue.length });
    }

    const before = queue.length;
    queue = queue.filter(i => i.queueId !== id && i.shopifyProductId !== id);
    magis5.saveQueue(queue);
    res.json({ success: true, removed: before - queue.length, remaining: queue.length });
  });


  router.get('/magis5-flow', (req, res) => res.redirect('/#magis5'));

  return router;
};
