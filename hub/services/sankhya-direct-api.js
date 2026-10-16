'use strict';

/**
 * sankhya-direct-api.js — Motor de Engenharia Reversa, Ponte Direta Sankhya (service.sbr)
 * e Catalogador Universal de Blueprints (Sankhya + Shopify + Magis5).
 *
 * 100% Aditivo: Não altera nem remove nenhum fluxo existente.
 * Utiliza o gateway JSON-RPC do Sankhya (`POST /mge/service.sbr`) autenticado por
 * `sktk` (header) + `mgeSession` (query param) sincronizados automaticamente pelo navegador.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const SESSION_FILE = path.join(CONFIG_DIR, 'sankhya-session.json');
const BLUEPRINTS_FILE = path.join(CONFIG_DIR, 'reverse-api-blueprints.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. SEMENTES INICIAIS DO CATÁLOGO DE ENGENHARIA REVERSA (3 PLATAFORMAS)
// ═══════════════════════════════════════════════════════════════════════════════

const INITIAL_BLUEPRINTS = [
  {
    id: 'bp_sankhya_pesquisa_suggestion',
    platform: 'sankhya',
    category: 'Coleta / Busca de Produtos (40ms)',
    name: 'PesquisaSP.getSuggestion (Produto)',
    method: 'POST',
    urlPattern: 'https://brk.sankhyacloud.com.br/mge/service.sbr?serviceName=PesquisaSP.getSuggestion&application=ProdutoServico&outputType=json&mgeSession={mgeSession}',
    serviceName: 'PesquisaSP.getSuggestion',
    authType: 'Header sktk + Query mgeSession',
    status: 'VERIFIED',
    description: 'Consulta ultrarrápida (30-90ms) na tabela Produto (TGFPRO) retornando CODPROD, REFERENCIA e DESCRPROD estruturados via fieldsMetadata.',
    sampleHeaders: {
      'Content-Type': 'application/json',
      'sktk': '{sktk}',
    },
    samplePayload: {
      serviceName: 'PesquisaSP.getSuggestion',
      requestBody: {
        criteria: {
          entityName: 'Produto',
          compacted: false,
          ignoreEntityCriteria: false,
          limit: '10',
          query: { '$': 'CLML0625-P' },
          orderByDesc: false,
          options: { showInactives: true },
          externalCriteria: {
            query: { '$': "((this.USOPROD <> 'S' AND this.USOPROD <> '3' ))" },
            params: { param: [] },
          },
        },
        clientEventList: {
          clientEvent: [
            { '$': 'br.com.sankhya.mge.info.metro.cubico' },
            { '$': 'br.com.sankhya.actionbutton.clientconfirm' },
          ],
        },
      },
    },
    sampleResponseNote: 'responseBody.json["$"] contém string JSON com { fieldsMetadata: [{fieldName:"CODPROD"}, {fieldName:"REFERENCIA"}, ...], data: [[codprod, ref, ...]] }',
    capturedAt: new Date().toISOString(),
    hitCount: 1,
  },
  {
    id: 'bp_sankhya_crud_load_records',
    platform: 'sankhya',
    category: 'Leitura Completa de Entidade (TGFPRO / TGFEST)',
    name: 'CRUDServiceProvider.loadRecords (Produto)',
    method: 'POST',
    urlPattern: 'https://brk.sankhyacloud.com.br/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json&mgeSession={mgeSession}',
    serviceName: 'CRUDServiceProvider.loadRecords',
    authType: 'Header sktk + Query mgeSession',
    status: 'MAPPED',
    description: 'Carrega qualquer coluna da tabela TGFPRO (CODPROD, REFERENCIA, DESCRPROD, CODGRUPOPROD, NCM, PESOBRUTO, ALTURA, LARGURA, COMPRIMENTO, ATIVO) usando filtro SQL direto.',
    sampleHeaders: {
      'Content-Type': 'application/json',
      'sktk': '{sktk}',
    },
    samplePayload: {
      serviceName: 'CRUDServiceProvider.loadRecords',
      requestBody: {
        dataSet: {
          rootEntity: 'Produto',
          includePresentationFields: 'N',
          offsetPage: '0',
          criteria: {
            expression: { '$': 'this.REFERENCIA = ?' },
            parameter: [{ '$': 'CLML0625-P', 'type': 'S' }],
          },
          entity: {
            fieldset: {
              list: 'CODPROD,REFERENCIA,DESCRPROD,CODGRUPOPROD,NCM,PESOBRUTO,ALTURA,LARGURA,COMPRIMENTO,ATIVO',
            },
          },
        },
      },
    },
    capturedAt: new Date().toISOString(),
    hitCount: 1,
  },
  {
    id: 'bp_sankhya_crud_save_record',
    platform: 'sankhya',
    category: 'Criação / Atualização Direta (Sem Planilha)',
    name: 'CRUDServiceProvider.saveRecord (Produto)',
    method: 'POST',
    urlPattern: 'https://brk.sankhyacloud.com.br/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json&mgeSession={mgeSession}',
    serviceName: 'CRUDServiceProvider.saveRecord',
    authType: 'Header sktk + Query mgeSession',
    status: 'MAPPED',
    description: 'Cria ou atualiza um registro na entidade Produto (TGFPRO) diretamente via JSON-RPC, incluindo vínculo de IMAGEM ($file_session_key) sem cliques na grade.',
    sampleHeaders: {
      'Content-Type': 'application/json',
      'sktk': '{sktk}',
    },
    samplePayload: {
      serviceName: 'CRUDServiceProvider.saveRecord',
      requestBody: {
        dataSet: {
          rootEntity: 'Produto',
          includePresentationFields: 'N',
          dataRow: {
            localFields: {
              REFERENCIA: { '$': 'CLML0625-P' },
              DESCRPROD: { '$': 'CAMISA PESCA MASCULINA BRK CLML0625 P' },
              CODGRUPOPROD: { '$': '10101' },
              CODVOL: { '$': 'UN' },
              NCM: { '$': '61052000' },
              USOPROD: { '$': 'V' },
            },
            key: {
              CODPROD: { '$': '74185' },
            },
          },
          entity: {
            fieldset: {
              list: 'CODPROD,REFERENCIA,DESCRPROD',
            },
          },
        },
      },
    },
    capturedAt: new Date().toISOString(),
    hitCount: 1,
  },
  {
    id: 'bp_shopify_storefront_products_json',
    platform: 'shopify',
    category: 'Descoberta Pública Zero-Auth (3 Lojas BRK)',
    name: 'GET /products.json (Fishing, Agro, Motors)',
    method: 'GET',
    urlPattern: 'https://www.brkfishing.com.br/products.json?limit=250&page=1',
    serviceName: 'products.json',
    authType: 'Público (Sem Token)',
    status: 'VERIFIED',
    description: 'Retorna todos os anúncios publicados na loja Shopify com o ID numérico de 13 dígitos (product.id), variantes (variant.id, variant.sku, variant.price) e URLs das fotos CDN.',
    sampleHeaders: {
      'Accept': 'application/json',
    },
    samplePayload: null,
    capturedAt: new Date().toISOString(),
    hitCount: 1,
  },
  {
    id: 'bp_shopify_flow_webhook',
    platform: 'shopify',
    category: 'Automação Push (Shopify Flow -> HUB)',
    name: 'POST /api/magis5/webhook/shopify',
    method: 'POST',
    urlPattern: 'http://localhost:3000/api/magis5/webhook/shopify',
    serviceName: 'ShopifyFlow.SendHttpRequest',
    authType: 'Opcional X-HookPrime-Secret',
    status: 'VERIFIED',
    description: 'Gatilho imediato disparado pelo Shopify Flow assim que um produto é criado ou atualizado nas 3 lojas, enviando legacyResourceId e lista de SKUs.',
    sampleHeaders: {
      'Content-Type': 'application/json',
    },
    samplePayload: {
      shopifyProductId: '{{product.legacyResourceId}}',
      store: 'fishing',
      title: '{{product.title}}',
      variants: [{ id: '{{v.legacyResourceId}}', sku: '{{v.sku}}' }],
    },
    capturedAt: new Date().toISOString(),
    hitCount: 1,
  },
  {
    id: 'bp_magis5_import_announcement',
    platform: 'magis5',
    category: 'Importação e Vínculo de Anúncio + Estoque Infinito',
    name: 'POST /v1/channels/announcements/import + PUT /v1/stocks',
    method: 'POST',
    urlPattern: 'https://app.magis5.com.br/v1/channels/announcements/import',
    serviceName: 'channels/announcements/import',
    authType: 'Header X-MAGIS5-APIKEY',
    status: 'VERIFIED',
    description: 'Importa o anúncio pelo ID da Shopify no canal correspondente, aplica regra Produção (Vendido de forma diversa + Estoque Fixo 1000) ou Revenda (_FULL -> Depósito 1010000).',
    sampleHeaders: {
      'Content-Type': 'application/json',
      'X-MAGIS5-APIKEY': '{X-MAGIS5-APIKEY}',
    },
    samplePayload: {
      channel: 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
      externalId: '9123456789012',
      soldInDifferentWays: true,
      stockFixed: 1000,
    },
    capturedAt: new Date().toISOString(),
    hitCount: 1,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  2. GERENCIAMENTO DE SESSÃO SANKHYA (sktk + mgeSession)
// ═══════════════════════════════════════════════════════════════════════════════

function loadSankhyaSession() {
  ensureConfigDir();
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch (_e) {}
  return {
    host: 'https://brk.sankhyacloud.com.br',
    sktk: '',
    mgeSession: '',
    cookieHeader: '',
    userAgent: '',
    updatedAt: null,
    captureSource: null,
  };
}

function saveSankhyaSession(patch = {}) {
  ensureConfigDir();
  const current = loadSankhyaSession();
  const next = {
    ...current,
    host: (patch.host || current.host || 'https://brk.sankhyacloud.com.br').replace(/\/+$/, ''),
    sktk: patch.sktk !== undefined ? String(patch.sktk).trim() : current.sktk,
    mgeSession: patch.mgeSession !== undefined ? String(patch.mgeSession).trim() : current.mgeSession,
    cookieHeader: patch.cookieHeader !== undefined ? String(patch.cookieHeader).trim() : current.cookieHeader,
    userAgent: patch.userAgent || current.userAgent || 'Mozilla/5.0 HookPrime-SankhyaBridge/1.0',
    updatedAt: new Date().toISOString(),
    captureSource: patch.captureSource || current.captureSource || 'browser-interceptor',
  };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  3. GERENCIAMENTO DO CATÁLOGO DE BLUEPRINTS (ENGENHARIA REVERSA)
// ═══════════════════════════════════════════════════════════════════════════════

function loadBlueprints() {
  ensureConfigDir();
  try {
    if (fs.existsSync(BLUEPRINTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BLUEPRINTS_FILE, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_e) {}
  fs.writeFileSync(BLUEPRINTS_FILE, JSON.stringify(INITIAL_BLUEPRINTS, null, 2), 'utf8');
  return [...INITIAL_BLUEPRINTS];
}

function saveBlueprints(list) {
  ensureConfigDir();
  fs.writeFileSync(BLUEPRINTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  return list;
}

function generateFetchCodeSnippet(bp) {
  const headersObj = bp.sampleHeaders || { 'Content-Type': 'application/json' };
  const bodyPart = bp.samplePayload
    ? `,\n  body: JSON.stringify(${JSON.stringify(bp.samplePayload, null, 2)})`
    : '';
  return `const response = await fetch("${bp.urlPattern}", {\n  method: "${bp.method || 'POST'}",\n  headers: ${JSON.stringify(headersObj, null, 2)}${bodyPart}\n});\nconst data = await response.json();`;
}

/**
 * Registra uma chamada HTTP interceptada pelo Sniffer Tampermonkey (Sankhya, Magis5 ou Shopify).
 */
function recordCapturedBlueprint(input = {}) {
  const blueprints = loadBlueprints();
  const platform = String(input.platform || 'unknown').toLowerCase();
  const method = String(input.method || 'POST').toUpperCase();
  const rawUrl = String(input.url || '').trim();
  if (!rawUrl) throw new Error('URL da captura ausente.');

  // Extrai serviceName se for Sankhya service.sbr
  let serviceName = input.serviceName || '';
  if (!serviceName) {
    const m = rawUrl.match(/serviceName=([^&]+)/i);
    if (m) serviceName = decodeURIComponent(m[1]);
  }
  if (!serviceName && input.payload && typeof input.payload === 'object' && input.payload.serviceName) {
    serviceName = String(input.payload.serviceName);
  }
  if (!serviceName) {
    try {
      const u = new URL(rawUrl);
      serviceName = u.pathname;
    } catch (_) {
      serviceName = rawUrl.slice(0, 80);
    }
  }

  // Sanitiza mgeSession da URL padrão para deduplicar corretamente
  const urlPattern = rawUrl.replace(/mgeSession=[^&]+/i, 'mgeSession={mgeSession}');

  const now = new Date().toISOString();
  let existing = blueprints.find(
    b => b.platform === platform && b.method === method && (b.serviceName === serviceName || b.urlPattern === urlPattern)
  );

  if (existing) {
    existing.hitCount = (existing.hitCount || 1) + 1;
    existing.lastCapturedAt = now;
    if (input.payload) existing.samplePayload = input.payload;
    if (input.responsePreview) existing.sampleResponsePreview = input.responsePreview;
    if (input.headers) existing.sampleHeaders = input.headers;
    existing.status = 'CAPTURED_LIVE';
  } else {
    existing = {
      id: `bp_${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      platform,
      category: input.category || 'Capturado ao Vivo (Sniffer)',
      name: `${method} ${serviceName}`,
      method,
      urlPattern,
      serviceName,
      authType: platform === 'sankhya' ? 'Header sktk + Query mgeSession' : (input.authType || 'Session / Token'),
      status: 'CAPTURED_LIVE',
      description: input.description || `Endpoint interceptado automaticamente em ${platform.toUpperCase()} (${serviceName}).`,
      sampleHeaders: input.headers || { 'Content-Type': 'application/json' },
      samplePayload: input.payload || null,
      sampleResponsePreview: input.responsePreview || null,
      capturedAt: now,
      lastCapturedAt: now,
      hitCount: 1,
    };
    blueprints.unshift(existing);
  }

  if (blueprints.length > 300) blueprints.length = 300;
  saveBlueprints(blueprints);
  return {
    ...existing,
    codeSnippet: generateFetchCodeSnippet(existing),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  4. CLIENTE DIRETO SANKHYA JSON-RPC (service.sbr) — 40ms POR SKU!
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Executa qualquer serviço `service.sbr` no Sankhya usando `sktk` + `mgeSession`.
 */
function callSankhyaService({ serviceName, application = 'ProdutoServico', requestBody = {}, customSession = null }) {
  const sess = customSession || loadSankhyaSession();
  const startedAt = Date.now();

  if (!sess.sktk || !sess.mgeSession) {
    return Promise.resolve({
      ok: false,
      needsSession: true,
      latencyMs: 0,
      error: 'Sessão Sankhya (sktk + mgeSession) ainda não capturada. Abra uma aba do Sankhya com o script Sniffer ativo ou cole o token manualmente.',
    });
  }

  return new Promise((resolve) => {
    try {
      const host = (sess.host || 'https://brk.sankhyacloud.com.br').replace(/\/+$/, '');
      const urlStr = `${host}/mge/service.sbr?serviceName=${encodeURIComponent(serviceName)}&application=${encodeURIComponent(application)}&outputType=json&mgeSession=${encodeURIComponent(sess.mgeSession)}`;
      const urlObj = new URL(urlStr);
      const lib = urlObj.protocol === 'https:' ? https : http;

      const bodyStr = JSON.stringify({
        serviceName,
        requestBody,
      });

      const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json; charset=UTF-8',
        'sktk': sess.sktk,
        'User-Agent': sess.userAgent || 'Mozilla/5.0 HookPrime-SankhyaBridge/1.0',
        'Content-Length': Buffer.byteLength(bodyStr),
      };
      if (sess.cookieHeader) {
        headers['Cookie'] = sess.cookieHeader;
      }

      const req = lib.request(
        urlObj,
        { method: 'POST', headers, timeout: 12000 },
        (res) => {
          const chunks = [];
          res.on('data', d => chunks.push(d));
          res.on('end', () => {
            const latencyMs = Date.now() - startedAt;
            const rawText = Buffer.concat(chunks).toString('utf8');
            let jsonObj = null;
            try {
              jsonObj = JSON.parse(rawText);
            } catch (_) {
              return resolve({
                ok: false,
                httpStatus: res.statusCode,
                latencyMs,
                error: 'Resposta não é JSON válido (sessão pode ter expirado).',
                rawPreview: rawText.slice(0, 300),
              });
            }

            // Sankhya status "1" = sucesso, "0" = erro de negócio/sessão
            const skStatus = String(jsonObj?.status ?? '');
            const isOk = res.statusCode >= 200 && res.statusCode < 300 && skStatus !== '0';
            resolve({
              ok: isOk,
              httpStatus: res.statusCode,
              sankhyaStatus: skStatus,
              latencyMs,
              statusMessage: jsonObj?.statusMessage || null,
              data: jsonObj,
            });
          });
        }
      );

      req.on('error', (err) => {
        resolve({ ok: false, latencyMs: Date.now() - startedAt, error: err.message });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, latencyMs: Date.now() - startedAt, error: 'Timeout (12s) ao consultar Sankhya service.sbr' });
      });

      req.write(bodyStr);
      req.end();
    } catch (err) {
      resolve({ ok: false, latencyMs: Date.now() - startedAt, error: err.message });
    }
  });
}

/**
 * Faz o parse estruturado do `responseBody.json["$"]` retornado pelo `PesquisaSP.getSuggestion`
 * aplicando trava estrita 1:1 no SKU (`REFERENCIA`)!
 */
function parsePesquisaSuggestionResponse(jsonObj, targetSku) {
  try {
    const rawInner = jsonObj?.responseBody?.json?.['$'];
    if (!rawInner) return { found: false, rows: [] };

    const inner = typeof rawInner === 'string' ? JSON.parse(rawInner) : rawInner;
    if (!Array.isArray(inner.fieldsMetadata)) return { found: false, rows: [] };

    const fieldNames = inner.fieldsMetadata.map(f => String(f.fieldName || '').toUpperCase());
    const codIdx = fieldNames.indexOf('CODPROD');
    const refIdx = fieldNames.indexOf('REFERENCIA');
    const descrIdx = fieldNames.indexOf('DESCRPROD');

    const rawRows = inner.data || inner.rows || inner.values || [];
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return { found: false, fields: fieldNames, rows: [] };
    }

    const cleanTarget = String(targetSku || '').trim().toUpperCase();

    const mappedRows = rawRows.map(r => {
      const obj = {};
      fieldNames.forEach((fName, idx) => {
        obj[fName] = r[idx] !== undefined && r[idx] !== null ? String(r[idx]).trim() : '';
      });
      return {
        codProd: codIdx !== -1 ? String(r[codIdx] ?? '').trim() : '',
        referencia: refIdx !== -1 ? String(r[refIdx] ?? '').trim() : '',
        descrProd: descrIdx !== -1 ? String(r[descrIdx] ?? '').trim() : '',
        raw: obj,
      };
    });

    // Trava Estrita 1:1: prioriza apenas a linha cuja REFERENCIA ou DESCRPROD bate 100% exato com cleanTarget
    const exactMatch = mappedRows.find(
      row => row.referencia.toUpperCase() === cleanTarget
    ) || mappedRows.find(
      row => {
        // Fallback seguro caso REFERENCIA venha dentro de DESCRPROD com bordas de palavra estritas
        const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?:^|[^A-Z0-9-])${escaped}(?=$|[^A-Z0-9-])`, 'i');
        return re.test(row.referencia) || re.test(row.descrProd);
      }
    );

    return {
      found: Boolean(exactMatch),
      exactMatch: exactMatch || null,
      firstCandidate: mappedRows[0] || null,
      fields: fieldNames,
      rows: mappedRows,
    };
  } catch (err) {
    return { found: false, parseError: err.message, rows: [] };
  }
}

/**
 * Consulta 1 SKU diretamente no Sankhya via `PesquisaSP.getSuggestion` (~40ms).
 */
async function lookupSkuDirect(sku, { limit = 10 } = {}) {
  const cleanSku = String(sku || '').trim().toUpperCase();
  if (!cleanSku) throw new Error('SKU vazio.');

  const payload = {
    criteria: {
      entityName: 'Produto',
      compacted: false,
      ignoreEntityCriteria: false,
      limit: String(limit),
      query: { '$': cleanSku },
      orderByDesc: false,
      options: { showInactives: true },
      externalCriteria: {
        query: { '$': "((this.USOPROD <> 'S' AND this.USOPROD <> '3' ))" },
        params: { param: [] },
      },
    },
    clientEventList: {
      clientEvent: [
        { '$': 'br.com.sankhya.mge.info.metro.cubico' },
        { '$': 'br.com.sankhya.actionbutton.clientconfirm' },
      ],
    },
  };

  const callRes = await callSankhyaService({
    serviceName: 'PesquisaSP.getSuggestion',
    application: 'ProdutoServico',
    requestBody: payload,
  });

  if (!callRes.ok) {
    return {
      sku: cleanSku,
      ok: false,
      needsSession: Boolean(callRes.needsSession),
      latencyMs: callRes.latencyMs,
      error: callRes.statusMessage || callRes.error || 'Falha na chamada Sankhya',
    };
  }

  const parsed = parsePesquisaSuggestionResponse(callRes.data, cleanSku);
  return {
    sku: cleanSku,
    ok: true,
    latencyMs: callRes.latencyMs,
    foundExact: parsed.found,
    codProd: parsed.exactMatch?.codProd || null,
    referencia: parsed.exactMatch?.referencia || null,
    descrProd: parsed.exactMatch?.descrProd || null,
    candidatesCount: parsed.rows.length,
    candidates: parsed.rows,
  };
}

/**
 * Consulta um lote de SKUs em paralelo (padrão: 5 requisições simultâneas conforme PDF).
 */
async function lookupSkusBatch(skus = [], { concurrency = 5 } = {}) {
  const cleanList = Array.from(
    new Set(
      (Array.isArray(skus) ? skus : [])
        .map(s => String(s || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const startedAt = Date.now();
  const results = new Array(cleanList.length);
  let cursor = 0;

  async function worker() {
    while (cursor < cleanList.length) {
      const idx = cursor++;
      results[idx] = await lookupSkuDirect(cleanList[idx]);
    }
  }

  const workersCount = Math.min(Math.max(1, concurrency), cleanList.length || 1);
  await Promise.all(Array.from({ length: workersCount }, () => worker()));

  return {
    totalSkus: cleanList.length,
    foundExactCount: results.filter(r => r && r.foundExact).length,
    totalDurationMs: Date.now() - startedAt,
    results,
  };
}

module.exports = {
  loadSankhyaSession,
  saveSankhyaSession,
  loadBlueprints,
  saveBlueprints,
  generateFetchCodeSnippet,
  recordCapturedBlueprint,
  callSankhyaService,
  lookupSkuDirect,
  lookupSkusBatch,
};
