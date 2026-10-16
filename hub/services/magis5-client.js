'use strict';

/**
 * magis5-client.js — Cliente Oficial & Orquestrador Magis5 + Shopify Flow (Zero-Click)
 *
 * Estruturado para operar em 2 modos sem quebrar nada do ecossistema atual:
 *   1. MODO PREPARADO / FILA (Quando MAGIS5_API_KEY ainda não foi inserida):
 *      - Recebe os IDs dos anúncios da Shopify (via Shopify Flow, Webhook ou Descoberta Automática dos 3 sites),
 *      - Classifica automaticamente cada anúncio (PRODUÇÃO vs REVENDA _FULL vs PULAR ALL/KIT),
 *      - Monta o payload exato da Magis5 (Canal, Depósito 1010000 ou Estoque Infinito 1000, Vínculo Sankhya)
 *      - Salva na fila persistente (`config/magis5-queue.json`) pronta para disparo.
 *   2. MODO LIVE API (Assim que `X-MAGIS5-APIKEY` for configurada):
 *      - Dispara as chamadas HTTP diretamente para a API da Magis5 (`https://app.magis5.com.br/v1`),
 *      - Importa/vincula o anúncio pelo ID da Shopify e aplica Estoque Infinito (`stockFixed = 1000`) nas variantes.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'magis5-config.json');
const QUEUE_FILE = path.join(CONFIG_DIR, 'magis5-queue.json');

const DEFAULT_CHANNELS = {
  fishing: {
    storeKey: 'fishing',
    label: '🟢 Shopify — BRK FISHING',
    channelId: 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
    domain: 'https://www.brkfishing.com.br',
  },
  agro: {
    storeKey: 'agro',
    label: '🟢 Shopify — BRK AGRO',
    channelId: 'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
    domain: 'https://www.brkagro.com.br',
  },
  motors: {
    storeKey: 'motors',
    label: '🟢 Shopify — BRK MOTORS',
    channelId: 'shopify-7495282216c04726834a39582e5369dd',
    domain: 'https://www.brkmotors.com.br',
  },
  ml_comercio: {
    storeKey: 'ml_comercio',
    label: '🟡 ML — BRK COMERCIO',
    channelId: 'ml-594c421a091a4546b9dda6762771322e',
  },
  ml_filial: {
    storeKey: 'ml_filial',
    label: '🟡 ML — BRK FILIAL (Oficial)',
    channelId: 'ml-738289f2b87f4f0892558d591454f31d',
  },
  ml_matriz: {
    storeKey: 'ml_matriz',
    label: '🟡 ML — BRK MATRIZ',
    channelId: 'ml-47da6d90fc2f489c9f7d0acc61ca458c',
  },
  shopee_agro: {
    storeKey: 'shopee_agro',
    label: '🟠 Shopee — BRK AGRO',
    channelId: 'shopee-d19e97cdeba849399f2a3bf04cf7cf2b',
  },
  shopee_filial: {
    storeKey: 'shopee_filial',
    label: '🟠 Shopee — BRK FILIAL',
    channelId: 'shopee-1b953452d1e74475bd27492dba97f98a',
  },
  amazon_usebrk: {
    storeKey: 'amazon_usebrk',
    label: '🛒 Amazon — USEBRK',
    channelId: 'amazon-550c5247c30e4eb9a5710d5853f2bb43',
  },
  tiktok_filial: {
    storeKey: 'tiktok_filial',
    label: '🎵 TikTok — BRK FILIAL',
    channelId: 'tiktok-5b3145553c2b4984ac9a98e2d4ccc3a1',
  },
};

const DEFAULT_CONFIG = {
  baseUrl: process.env.MAGIS5_BASE_URL || 'https://app.magis5.com.br/v1',
  apiKey: process.env.MAGIS5_API_KEY || '',
  webhookSecret: process.env.SHOPIFY_FLOW_SECRET || '',
  defaultStockFixed: 1000,
  revendaWarehouseId: '1010000',
  revendaWarehouseLabel: 'sankhya - ESTOQUE REVENDA',
  autoProcessWebhook: true,
  channels: DEFAULT_CHANNELS,
  endpoints: {
    ping: '/products?limit=1&page=1',
    products: '/products',
    productBySku: '/products/{sku}',
    stocks: '/stocks',
    channelImport: '/channels/announcements/import',
  },
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        apiKey: saved.apiKey || process.env.MAGIS5_API_KEY || '',
        channels: { ...DEFAULT_CHANNELS, ...(saved.channels || {}) },
        endpoints: { ...DEFAULT_CONFIG.endpoints, ...(saved.endpoints || {}) },
      };
    }
  } catch (e) {
    console.warn('[MAGIS5] ⚠️ Erro ao ler magis5-config.json:', e.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(partial) {
  const current = loadConfig();
  const merged = {
    ...current,
    ...partial,
    channels: { ...current.channels, ...(partial.channels || {}) },
    endpoints: { ...current.endpoints, ...(partial.endpoints || {}) },
    updatedAt: new Date().toISOString(),
  };
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.warn('[MAGIS5] ⚠️ Erro ao ler magis5-queue.json:', e.message);
  }
  return [];
}

function saveQueue(items) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (e) {
    console.warn('[MAGIS5] ⚠️ Erro ao salvar magis5-queue.json:', e.message);
  }
}

/**
 * Normaliza o ID do anúncio da Shopify:
 * Aceita tanto numérico ("8849201921234") quanto GraphQL GID ("gid://shopify/Product/8849201921234")
 * ou URL completa ("https://admin.shopify.com/store/brk-fishing/products/8849201921234").
 */
function normalizeShopifyProductId(rawId) {
  const str = String(rawId || '').trim();
  if (!str) return '';
  const mGid = str.match(/Product\/(\d+)/i);
  if (mGid) return mGid[1];
  const mUrl = str.match(/\/products\/(\d+)/i);
  if (mUrl) return mUrl[1];
  const mNum = str.match(/^(\d{6,20})$/);
  if (mNum) return mNum[1];
  return str;
}

/**
 * Resolve loja ('fishing' | 'agro' | 'motors') e canal da Magis5 a partir de qualquer pista
 * (nome da loja, domínio, channelId direto).
 */
function resolveStoreAndChannel(storeOrChannel) {
  const cfg = loadConfig();
  const raw = String(storeOrChannel || '').toLowerCase().trim();

  if (raw.includes('agro')) return cfg.channels.agro;
  if (raw.includes('motor')) return cfg.channels.motors;
  if (raw.includes('fishing') || raw.includes('pesca')) return cfg.channels.fishing;

  for (const ch of Object.values(cfg.channels)) {
    if (ch.channelId && ch.channelId.toLowerCase() === raw) return ch;
    if (ch.storeKey && ch.storeKey.toLowerCase() === raw) return ch;
  }

  return cfg.channels.fishing;
}

/**
 * Extrai o código base do modelo a partir do SKU da variante (ex: "BTSTELLA_34" -> "BTSTELLA", "C007PP" -> "C007").
 */
function extractBaseModel(sku) {
  const s = String(sku || '').toUpperCase().trim().replace(/_FULL$/i, '');
  if (!s) return '';
  return s
    .replace(/[-_](PP|P|M|G|GG|XG|XGG|EG|EGG|EXG|G1|G2|G3|G4|2GG|3GG|4GG|5GG|U|UN|UNICO|\d{1,2}|10A|12A|14A|16A)$/i, '')
    .replace(/^([A-Z]{1,5}\d+[A-Z]*?)(PP|P|M|G|GG|XG|XGG|EG|EGG|EXG|G1|G2|G3|G4)$/i, '$1');
}

/**
 * Regras oficiais do Magis5 Autopilot + Estoque Infinito:
 *   - SKU começa com ALL ou KIT -> 'pular' (descarta)
 *   - SKU contém _FULL ou FULL -> 'revenda' (Vendido de forma diversa = Não, Depósito = 1010000 ESTOQUE REVENDA, sem estoque infinito)
 *   - Qualquer outro -> 'producao' (Vendido de forma diversa = Sim, Estoque Infinito = 1000 em todas as variantes)
 */
function classifyProductBySkus(skus = [], tipoOverride = 'auto') {
  const cfg = loadConfig();
  const cleanSkus = (Array.isArray(skus) ? skus : [skus])
    .map(s => String(typeof s === 'object' ? (s.sku || '') : s).toUpperCase().trim())
    .filter(Boolean);

  let detected = 'producao';
  for (const sku of cleanSkus) {
    if (sku.startsWith('ALL') || sku.startsWith('KIT')) {
      detected = 'pular';
      break;
    }
    if (sku.includes('_FULL') || sku.includes('FULL')) {
      detected = 'revenda';
    }
  }

  const finalType = (tipoOverride && tipoOverride !== 'auto') ? tipoOverride : detected;

  if (finalType === 'pular') {
    return {
      tipo: 'pular',
      tipoDetectado: detected,
      acao: 'DESCARTAR_ALL_KIT',
      vendidoDeFormaDiversa: null,
      warehouseId: null,
      aplicarEstoqueInfinito: false,
      stockFixed: null,
      resumoRegra: 'Produto ALL/KIT — ignorado automaticamente pela regra BRK.',
    };
  }

  if (finalType === 'revenda') {
    return {
      tipo: 'revenda',
      tipoDetectado: detected,
      acao: 'IMPORTAR_REVENDA',
      vendidoDeFormaDiversa: false, // "Não"
      warehouseId: cfg.revendaWarehouseId || '1010000',
      warehouseLabel: cfg.revendaWarehouseLabel || 'sankhya - ESTOQUE REVENDA',
      aplicarEstoqueInfinito: false,
      stockFixed: null,
      resumoRegra: 'REVENDA (_FULL): Vendido de forma diversa = Não + Depósito 1010000 (sankhya - ESTOQUE REVENDA).',
    };
  }

  return {
    tipo: 'producao',
    tipoDetectado: detected,
    acao: 'IMPORTAR_PRODUCAO_E_ESTOQUE_INFINITO',
    vendidoDeFormaDiversa: true, // "Sim"
    warehouseId: null,
    warehouseLabel: 'Padrão Produção',
    aplicarEstoqueInfinito: true,
    stockFixed: cfg.defaultStockFixed || 1000,
    resumoRegra: `PRODUÇÃO: Vendido de forma diversa = Sim + Estoque Infinito (${cfg.defaultStockFixed || 1000}) em todas as variantes.`,
  };
}

/**
 * Monta o plano de execução e os payloads da API Magis5 para um anúncio da Shopify.
 */
function buildMagis5ExecutionPlan({
  store = 'fishing',
  channelId = '',
  shopifyProductId = '',
  title = '',
  handle = '',
  variants = [],
  sankhyaMap = {},
  tipoOverride = 'auto',
}) {
  const normId = normalizeShopifyProductId(shopifyProductId);
  const channelInfo = resolveStoreAndChannel(channelId || store);
  const skus = variants.map(v => (typeof v === 'string' ? v : v.sku)).filter(Boolean);
  const regra = classifyProductBySkus(skus, tipoOverride);
  const baseModel = skus.length > 0 ? extractBaseModel(skus[0]) : '';

  const normalizedVariants = variants.map((v, idx) => {
    const rawObj = typeof v === 'string' ? { sku: v } : (v || {});
    const skuOriginal = String(rawObj.sku || '').trim().toUpperCase();
    const sankhyaEntry = sankhyaMap[skuOriginal] || {};
    const skuFinal = String(rawObj.novoSku || sankhyaEntry.codigo || skuOriginal).trim();
    const eanFinal = String(rawObj.ean || rawObj.barcode || sankhyaEntry.ean || '').trim();

    return {
      index: idx + 1,
      variantIdShopify: rawObj.id ? String(rawObj.id) : '',
      skuOriginal,
      skuMagis5: skuFinal,
      codProdSankhya: sankhyaEntry.codigo || null,
      ean: eanFinal || null,
      title: rawObj.title || '',
      price: rawObj.price || null,
      isProductOnChannelLocked: regra.vendidoDeFormaDiversa ? 'sim' : 'nao',
      warehouseId: regra.warehouseId,
      stockFixed: regra.aplicarEstoqueInfinito ? regra.stockFixed : null,
    };
  });

  return {
    shopifyProductId: normId,
    store: channelInfo.storeKey,
    storeLabel: channelInfo.label,
    channelMagis5: channelInfo.channelId,
    title: title || baseModel || `Anúncio ${normId}`,
    handle: handle || '',
    skuBase: baseModel,
    totalVariants: normalizedVariants.length,
    classificacao: regra,
    variants: normalizedVariants,
    apiPayloads: {
      // 1. Payload de importação/vínculo do anúncio por ID do canal
      channelImport: {
        channel: channelInfo.channelId,
        channelId: normId,
        isProductOnChannelLocked: regra.vendidoDeFormaDiversa,
        warehouseId: regra.warehouseId,
        items: normalizedVariants.map(v => ({
          sku: v.skuMagis5,
          channelSku: v.skuOriginal,
          ean: v.ean,
          isProductOnChannelLocked: regra.vendidoDeFormaDiversa,
          warehouseId: regra.warehouseId,
        })),
      },
      // 2. Payloads de Estoque Infinito (1000) para todas as variantes quando for Produção
      infiniteStockUpdates: regra.aplicarEstoqueInfinito
        ? normalizedVariants.map(v => ({
            sku: v.skuMagis5,
            channelSku: v.skuOriginal,
            stockFixed: regra.stockFixed,
            quantity: regra.stockFixed,
          }))
        : [],
    },
  };
}

/**
 * Chamada HTTP genérica para a API da Magis5 com `X-MAGIS5-APIKEY`.
 */
function requestMagis5Api(method, endpointPath, body = null, customConfig = null) {
  const cfg = customConfig || loadConfig();
  if (!cfg.apiKey) {
    return Promise.resolve({
      simulated: true,
      ok: false,
      status: 0,
      reason: 'AGUARDANDO_API_KEY',
      message: 'Chave X-MAGIS5-APIKEY ainda não configurada. Item estruturado e salvo na fila.',
    });
  }

  return new Promise((resolve) => {
    try {
      const base = cfg.baseUrl.replace(/\/+$/, '');
      const rel = endpointPath.startsWith('/') ? endpointPath : '/' + endpointPath;
      const urlObj = new URL(base + rel);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const payloadStr = body ? JSON.stringify(body) : null;
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-MAGIS5-APIKEY': cfg.apiKey,
        'User-Agent': 'HookPrime-Enterprise-Hub/3.3',
      };
      if (payloadStr) headers['Content-Length'] = Buffer.byteLength(payloadStr);

      const req = lib.request(
        urlObj,
        { method, headers, timeout: 15000 },
        (res) => {
          const chunks = [];
          res.on('data', d => chunks.push(d));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsed = raw;
            try { parsed = JSON.parse(raw); } catch (_) {}
            resolve({
              simulated: false,
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: parsed,
            });
          });
        }
      );

      req.on('error', (err) => {
        resolve({ simulated: false, ok: false, status: 0, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ simulated: false, ok: false, status: 0, error: 'Timeout (15s) na API Magis5' });
      });

      if (payloadStr) req.write(payloadStr);
      req.end();
    } catch (err) {
      resolve({ simulated: false, ok: false, status: 0, error: err.message });
    }
  });
}

/**
 * Testa conectividade com a API da Magis5.
 */
async function testMagis5Connection() {
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    return {
      configured: false,
      online: false,
      mode: 'QUEUE_READY_WAITING_KEY',
      message: 'Estrutura 100% pronta! Insira a chave X-MAGIS5-APIKEY quando tiver em mãos para ativar o disparo direto.',
    };
  }
  const resp = await requestMagis5Api('GET', cfg.endpoints.ping || '/products?limit=1&page=1', null, cfg);
  return {
    configured: true,
    online: resp.ok,
    status: resp.status,
    mode: resp.ok ? 'LIVE_API' : 'API_ERROR',
    response: resp.data || resp.error || null,
  };
}

/**
 * Adiciona um ou mais anúncios da Shopify na fila estruturada da Magis5 e,
 * se a chave `X-MAGIS5-APIKEY` já estiver configurada, pode executar imediatamente.
 */
async function enqueueShopifyAd(input, { executeNow = false } = {}) {
  const queue = loadQueue();
  const plan = buildMagis5ExecutionPlan(input);

  if (!plan.shopifyProductId) {
    throw new Error('shopifyProductId inválido ou ausente.');
  }

  const now = new Date().toISOString();
  let existing = queue.find(
    q => q.shopifyProductId === plan.shopifyProductId && q.channelMagis5 === plan.channelMagis5
  );

  if (existing) {
    existing.updatedAt = now;
    existing.title = plan.title || existing.title;
    existing.skuBase = plan.skuBase || existing.skuBase;
    existing.classificacao = plan.classificacao;
    if (plan.variants.length > 0) {
      existing.variants = plan.variants;
      existing.totalVariants = plan.totalVariants;
      existing.apiPayloads = plan.apiPayloads;
    }
  } else {
    existing = {
      queueId: `m5_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      source: input.source || 'manual',
      status: plan.classificacao.tipo === 'pular' ? 'skipped_all_kit' : 'ready_for_api',
      ...plan,
      executionLog: [],
    };
    queue.unshift(existing);
  }

  if (queue.length > 500) queue.length = 500;
  saveQueue(queue);

  if (executeNow && existing.status !== 'skipped_all_kit') {
    return await executeQueueItem(existing.queueId);
  }

  return existing;
}

/**
 * Executa um item da fila na API da Magis5 (ou simula e valida toda a estrutura se ainda sem API Key).
 */
async function executeQueueItem(queueId) {
  const cfg = loadConfig();
  const queue = loadQueue();
  const item = queue.find(q => q.queueId === queueId || q.shopifyProductId === String(queueId));
  if (!item) throw new Error(`Item ${queueId} não encontrado na fila.`);

  const now = new Date().toISOString();

  if (item.classificacao?.tipo === 'pular') {
    item.status = 'skipped_all_kit';
    item.updatedAt = now;
    item.executionLog.push({ timestamp: now, step: 'CLASSIFICACAO', status: 'SKIPPED', detail: item.classificacao.resumoRegra });
    saveQueue(queue);
    return item;
  }

  // Se ainda não há API Key configurada, registra a simulação completa (Dry-Run validado)
  if (!cfg.apiKey) {
    item.status = 'ready_waiting_api_key';
    item.updatedAt = now;
    item.executionLog.push({
      timestamp: now,
      step: 'DRY_RUN_VALIDADO',
      status: 'READY',
      detail: `Plano validado para canal ${item.channelMagis5} (${item.classificacao.resumoRegra}). Aguardando X-MAGIS5-APIKEY para envio real.`,
    });
    saveQueue(queue);
    return item;
  }

  // MODO LIVE API (Quando X-MAGIS5-APIKEY estiver preenchida)
  item.status = 'processing';
  item.updatedAt = now;
  saveQueue(queue);

  const importRes = await requestMagis5Api('POST', cfg.endpoints.channelImport, item.apiPayloads.channelImport, cfg);
  item.executionLog.push({
    timestamp: new Date().toISOString(),
    step: 'IMPORT_ANUNCIO',
    status: importRes.ok ? 'OK' : 'ERROR',
    httpStatus: importRes.status,
    detail: importRes.data || importRes.error,
  });

  let stockOkCount = 0;
  if (item.classificacao.aplicarEstoqueInfinito && item.apiPayloads.infiniteStockUpdates.length > 0) {
    for (const st of item.apiPayloads.infiniteStockUpdates) {
      const stRes = await requestMagis5Api('PUT', cfg.endpoints.stocks, st, cfg);
      if (stRes.ok) stockOkCount++;
      item.executionLog.push({
        timestamp: new Date().toISOString(),
        step: `ESTOQUE_INFINITO_${st.sku}`,
        status: stRes.ok ? 'OK' : 'ERROR',
        httpStatus: stRes.status,
      });
    }
  }

  item.status = importRes.ok ? 'completed' : 'api_error';
  item.updatedAt = new Date().toISOString();
  item.stockAppliedCount = stockOkCount;
  saveQueue(queue);
  return item;
}

/**
 * Busca automaticamente os anúncios e seus IDs diretamente das 3 lojas Shopify BRK
 * (Agro, Fishing e Motors) via `/products.json`, eliminando a necessidade do script extrator!
 */
function fetchJsonUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'HookPrime-Shopify-Discovery/3.3', 'Accept': 'application/json' }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchJsonUrl(new URL(res.headers.location, url).href, timeoutMs).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function discoverShopifyAdsFromStores({ stores = ['fishing', 'agro', 'motors'], maxPagesPerStore = 1, limitPerPage = 50 } = {}) {
  const cfg = loadConfig();
  const discovered = [];
  const errors = [];

  for (const storeKey of stores) {
    const ch = cfg.channels[storeKey];
    if (!ch || !ch.domain) continue;

    for (let page = 1; page <= maxPagesPerStore; page++) {
      const url = `${ch.domain.replace(/\/+$/, '')}/products.json?limit=${limitPerPage}&page=${page}`;
      try {
        const data = await fetchJsonUrl(url);
        const products = data?.products || [];
        if (!products.length) break;

        for (const p of products) {
          const variants = (p.variants || []).map(v => ({
            id: String(v.id || ''),
            sku: String(v.sku || '').trim().toUpperCase(),
            title: String(v.title || ''),
            price: v.price || null,
            barcode: v.barcode || null,
          })).filter(v => v.sku);

          const skus = variants.map(v => v.sku);
          const classificacao = classifyProductBySkus(skus);
          const skuBase = skus.length > 0 ? extractBaseModel(skus[0]) : '';

          discovered.push({
            shopifyProductId: String(p.id),
            store: ch.storeKey,
            storeLabel: ch.label,
            channelMagis5: ch.channelId,
            title: p.title || '',
            handle: p.handle || '',
            createdAtShopify: p.created_at || null,
            publishedAtShopify: p.published_at || null,
            skuBase,
            totalVariants: variants.length,
            skus,
            variants,
            imageUrl: p.images?.[0]?.src || null,
            classificacao,
          });
        }
      } catch (err) {
        errors.push({ store: storeKey, url, error: err.message });
        break;
      }
    }
  }

  return {
    total: discovered.length,
    storesScanned: stores,
    errors,
    ads: discovered,
  };
}

module.exports = {
  DEFAULT_CHANNELS,
  loadConfig,
  saveConfig,
  loadQueue,
  saveQueue,
  normalizeShopifyProductId,
  resolveStoreAndChannel,
  extractBaseModel,
  classifyProductBySkus,
  buildMagis5ExecutionPlan,
  testMagis5Connection,
  enqueueShopifyAd,
  executeQueueItem,
  discoverShopifyAdsFromStores,
};
