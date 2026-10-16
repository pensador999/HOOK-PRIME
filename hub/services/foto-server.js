/**
 * @module services/foto-server
 * Servidor de Fotos do Sankhya dentro do HUB (substitui `servidor_fotos_local.py` v18.0).
 *
 * Mesmo contrato HTTP do Python (porta 8000) para o userscript "Injetor Automático de Fotos
 * de Variantes" (v18.x) funcionar SEM alteração e SEM Python/TI:
 *   GET  /ping|/status · /stats|/api/stats|/metrics · /dashboard|/painel · /api/missing (?format=csv)
 *        /api/audit|/audit/logs (?format=csv) · /modelos|/lista|/codigos · /variantes/<modelo> (?modelo=)
 *        /info/<x>|/sku/<x> · /<qualquer coisa> = foto (resolvedor multi-tier 1→6)
 *   POST /api/audit|/audit · HEAD (foto) · OPTIONS (CORS)
 *
 * Diferenças intencionais (segurança): escuta só em 127.0.0.1 (sem prompt de firewall/admin);
 * bloqueia path traversal ("..", caminhos absolutos); não registra /favicon como SKU faltante.
 * Pasta de dados: env FOTOS_SANKHYA_DIR ou `<projetos>/INJETOR DE FOTOS SANKHYA/modulo_imagens`.
 */
'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');

const VERSAO = '18.0';
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const TIERS = ['tier1_disco_direto', 'tier2_mapa_sku_modelo', 'tier3_normalizado', 'tier4_descascamento_sufixo', 'tier5_fuzzy_prefix', 'tier6_cdn_onthefly'];
const pad = (n, w = 2) => String(n).padStart(w, '0');
const dtLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const isoLocal = (d = new Date()) => dtLocal(d).replace(' ', 'T') + '.' + pad(d.getMilliseconds(), 3) + '000';
const stemOf = (p) => path.win32.parse(p).name.trim();
const extOf = (p) => path.win32.parse(p).ext.toLowerCase();

/** CSV ';' com aspas (RFC4180) → array de objetos pelo cabeçalho. */
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const h = rows.shift() || [];
  return rows.filter(r => r.length > 1 || r[0]).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

function createFotoServer(opts = {}) {
  const BASE = opts.baseDir;
  const PASTA_FOTOS = path.join(BASE, 'downloads_modelos_global', 'fotos');
  const PASTAS_BUSCA = [PASTA_FOTOS, path.join(BASE, 'downloads', 'camisas-work', 'por_modelo'), path.join(BASE, 'downloads', 'camisas-work', 'por_sku')];
  const PASTA_LOGS = path.join(BASE, 'logs');
  const fetchImpl = opts.fetch || fetch;
  let sharp = null; try { sharp = require('sharp'); } catch (e) { /* conversão WebP→PNG desativada */ }
  const startedAt = Date.now();

  // ── Métricas / telemetria (em memória) ──
  const M = { total: 0, codes: { 200: 0, 404: 0, 500: 0, outros: 0 }, tiers: Object.fromEntries(TIERS.map(t => [t, 0])), webp: 0, recent: [], audit: [], missing: {} };
  function registrarReq(req, status, tier, t0) {
    M.total++;
    if (M.codes[status] !== undefined) M.codes[status]++; else M.codes.outros++;
    if (tier && M.tiers[tier] !== undefined) M.tiers[tier]++;
    const d = new Date();
    M.recent.unshift({ timestamp: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, metodo: req.method, rota: req.originalUrl, status, tier: tier || '—', duracao_ms: Math.round((performance.now() - t0) * 100) / 100 });
    if (M.recent.length > 60) M.recent.length = 60;
  }
  function appendCsv(file, header, line) {
    try {
      fs.mkdirSync(PASTA_LOGS, { recursive: true });
      const f = path.join(PASTA_LOGS, file);
      if (!fs.existsSync(f)) fs.writeFileSync(f, '\uFEFF' + header + '\r\n', 'utf8');
      fs.appendFileSync(f, line + '\r\n', 'utf8');
    } catch (e) { console.warn('[FOTOS] log falhou:', e.message); }
  }
  const csvCell = (v) => { const s = v == null ? '' : String(v); return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function registrar404(stem) {
    const k = String(stem || '').trim().toUpperCase();
    if (k.length < 3 || ['FAVICON', 'FAVICON.ICO', 'PING', 'STATS'].includes(k)) return;
    const novo = !M.missing[k];
    if (novo) M.missing[k] = { primeira_vez: dtLocal(), tentativas: 0 };
    M.missing[k].tentativas++;
    if (novo) appendCsv('skus_sem_foto_reportados.csv', 'SKU;DATA_PRIMEIRA_REQUISICAO;STATUS_ERP', `${k};${M.missing[k].primeira_vez};SEM_FOTO_LOCAL`);
  }
  function registrarAuditoria(ev) {
    const item = { timestamp: dtLocal(), sku: ev.sku ?? '—', modelo: ev.modelo ?? '—', cod_prod: ev.cod_prod ?? '—', status: ev.status ?? '—', motivo: ev.motivo ?? '—', duracao_ms: ev.duracao_ms ?? 0, tamanho: ev.tamanho ?? '—', layout: ev.layout ?? '—' };
    M.audit.unshift(item); if (M.audit.length > 200) M.audit.length = 200;
    const cols = ['timestamp', 'sku', 'modelo', 'cod_prod', 'status', 'motivo', 'tamanho', 'layout', 'duracao_ms'];
    appendCsv('auditoria_lotes_sankhya.csv', cols.join(';'), cols.map(c => csvCell(item[c])).join(';'));
  }

  // ── Índices de catálogo (de_para CSV: SKU last-wins / modelo first-wins; JSON: tudo first-wins) ──
  const maps = { variantes: new Map(), sku_foto: new Map(), sku_url: new Map(), mod_foto: new Map(), mod_url: new Map(), descricoes: new Map() };
  const disk = PASTAS_BUSCA.map(dir => ({ dir, byName: new Map(), files: [] }));
  const syncState = { running: false, lastSync: null, lastResult: null, lastError: null };
  function indexar(r, csvMode) {
    const s = v => (v == null ? '' : String(v)).trim();
    const sku = s(r.SKU_FILHO).toUpperCase(), mod = s(r.CODIGO_MODELO).replace(/-+$/, '').toUpperCase();
    const foto = s(r.ARQUIVO_FOTO_MODELO), url = s(r.URL_FOTO_ORIGINAL);
    if (sku) {
      if (foto && (csvMode || !maps.sku_foto.has(sku))) maps.sku_foto.set(sku, foto);
      if (url && (csvMode || !maps.sku_url.has(sku))) maps.sku_url.set(sku, url);
    }
    if (mod) {
      if (foto && !maps.mod_foto.has(mod)) maps.mod_foto.set(mod, foto);
      if (url && !maps.mod_url.has(mod)) maps.mod_url.set(mod, url);
      if (sku) { const l = maps.variantes.get(mod) || []; if (!l.includes(sku)) l.push(sku); maps.variantes.set(mod, l); }
    }
  }
  function indexDir(d) {
    d.byName.clear(); d.files = [];
    if (!fs.existsSync(d.dir)) return;
    for (const n of fs.readdirSync(d.dir)) {
      const full = path.join(d.dir, n);
      let st; try { st = fs.statSync(full); } catch { continue; }
      if (!st.isFile()) continue;
      d.byName.set(n.toLowerCase(), full);
      d.files.push({ name: n, stemUp: stemOf(n).toUpperCase(), ext: extOf(n), full });
    }
  }
  function recarregarCatalogo() {
    const t0i = Date.now();
    Object.values(maps).forEach(m => m.clear());
    try { parseCsv(fs.readFileSync(path.join(BASE, 'downloads_modelos_global', 'de_para_skus_modelos.csv'), 'utf8')).forEach(r => indexar(r, true)); }
    catch (e) { console.warn('[FOTOS] de_para_skus_modelos.csv:', e.message); }
    try { const j = JSON.parse(fs.readFileSync(path.join(BASE, 'downloads_modelos_global', 'catalogo_modelos.json'), 'utf8')); if (j.ultima_sincronizacao) syncState.lastSync = j.ultima_sincronizacao; (j.de_para || []).forEach(r => indexar(r, false)); }
    catch (e) { console.warn('[FOTOS] catalogo_modelos.json:', e.message); }
    try {
      const descPath = path.join(BASE, 'downloads_modelos_global', 'catalogo_descricoes.json');
      if (fs.existsSync(descPath)) {
        const jd = JSON.parse(fs.readFileSync(descPath, 'utf8'));
        if (jd && jd.descricoes) {
          for (const [k, v] of Object.entries(jd.descricoes)) {
            maps.descricoes.set(k.toUpperCase(), v);
          }
        }
      }
    } catch (e) { console.warn('[FOTOS] catalogo_descricoes.json:', e.message); }
    disk.forEach(indexDir);
    console.log(`[FOTOS] ⚡ Catálogo: ${maps.sku_foto.size} SKUs, ${maps.mod_foto.size} modelos, ${maps.descricoes.size} descrições, ${disk[0].files.length} fotos em disco (${Date.now() - t0i}ms)`);
  }
  recarregarCatalogo();

  function encontrarNoDisco(nome) {
    if (!nome || nome.includes('..') || path.isAbsolute(nome) || nome.includes('\0')) return null;
    const s = stemOf(nome), ext = extOf(nome);
    const exts = [...(ext ? [ext] : []), '.jpg', '.png', '.jpeg', '.webp'];
    for (const d of disk) {
      const base = path.win32.basename(nome).toLowerCase();
      if (!/[\\/]/.test(nome) && d.byName.has(base)) return d.byName.get(base);
      for (const e of exts) { const k = (s + e).toLowerCase(); if (d.byName.has(k)) return d.byName.get(k); }
      const up = s.toUpperCase(); const f = d.files.find(x => x.stemUp === up);
      if (f) return f.full;
    }
    return null;
  }

  async function resolver(urlPath) {
    let limpo; try { limpo = decodeURIComponent(urlPath); } catch { limpo = urlPath; }
    limpo = limpo.replace(/^\/+|\/+$/g, '');
    if (/^fotos\//i.test(limpo)) limpo = limpo.slice(6).replace(/^\/+|\/+$/g, '');
    if (!limpo || limpo.split(/[\\/]/).includes('..') || /^[a-z]:/i.test(limpo) || limpo.includes('\0')) return [null, null];
    const stemUp = stemOf(limpo).toUpperCase(), rawUp = limpo.toUpperCase();
    let r;
    // 1. disco direto
    if ((r = encontrarNoDisco(limpo))) return [r, TIERS[0]];
    // 2. mapa SKU/modelo
    const foto = maps.sku_foto.get(stemUp) || maps.mod_foto.get(stemUp) || maps.sku_foto.get(rawUp) || maps.mod_foto.get(rawUp);
    if (foto && (r = encontrarNoDisco(foto))) return [r, TIERS[1]];
    // 3. normalizado (só 1º match, só SKUs)
    const clean = stemUp.replace(/[-_]/g, '');
    for (const [k, v] of maps.sku_foto) { if (k.replace(/[-_]/g, '') === clean) { if ((r = encontrarNoDisco(v))) return [r, TIERS[2]]; break; } }
    // 4. descascamento de sufixo de tamanho
    const cb = stemUp.replace(/-(PP|GG|G[1-5]|XG|[2-5]XL|[PMG]|\d{1,2})$/i, '');
    if (cb !== stemUp) {
      if ((r = encontrarNoDisco(cb))) return [r, TIERS[3]];
      const f2 = maps.mod_foto.get(cb) || maps.sku_foto.get(cb); if (f2 && (r = encontrarNoDisco(f2))) return [r, TIERS[3]];
    }
    const cst = stemUp.replace(/(?<=\d)(PP|GG|G[1-5]|XG|[PMG])$/i, '').replace(/(?<=[A-Z0-9])(PP|GG|G[1-5]|XG)$/i, '');
    if (cst !== stemUp) {
      if ((r = encontrarNoDisco(cst))) return [r, TIERS[3]];
      const f3 = maps.mod_foto.get(cst) || maps.sku_foto.get(cst); if (f3 && (r = encontrarNoDisco(f3))) return [r, TIERS[3]];
    }
    // 5. (Desativado por segurança v18.8: proibido match fuzzy por prefixo para evitar contaminação entre códigos parecidos!)
    // 6. download sob demanda da CDN (somente se o código exato existir no mapa oficial)
    const url = maps.sku_url.get(stemUp) || maps.mod_url.get(stemUp) || maps.sku_url.get(cb) || maps.mod_url.get(cb) || maps.mod_url.get(cst);
    if (url) {
      try {
        const resp = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }, signal: AbortSignal.timeout(10000) });
        if (resp.status === 200) {
          const buf = Buffer.from(await resp.arrayBuffer());
          if (buf.length > 500) {
            fs.mkdirSync(PASTA_FOTOS, { recursive: true });
            const dest = path.join(PASTA_FOTOS, stemUp + '.jpg');
            fs.writeFileSync(dest, buf);
            indexDir(disk[0]);
            return [dest, TIERS[5]];
          }
        }
      } catch (e) { console.warn('[FOTOS] CDN falhou', stemUp, e.message); }
    }
    return [null, null];
  }

  function statsDict() {
    const up = Math.floor((Date.now() - startedAt) / 1000);
    return {
      versao: VERSAO, status: 'online', uptime_segundos: up,
      uptime_formatado: `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${up % 60}s`,
      total_requests: M.total, status_codes: { 200: M.codes[200], 404: M.codes[404], 500: M.codes[500], outros: M.codes.outros },
      taxa_sucesso_pct: Math.round(M.codes[200] / Math.max(1, M.total) * 1000) / 10,
      tiers_count: Object.fromEntries(TIERS.map(t => [t, M.tiers[t]])),
      webp_conversoes: M.webp, total_faltantes_registrados: Object.keys(M.missing).length,
      total_skus_indexados: maps.sku_foto.size, total_modelos_indexados: maps.mod_foto.size,
      total_descricoes_indexadas: maps.descricoes ? maps.descricoes.size : 0,
      ciclo_horario: 'ATIVO (a cada 60 min)',
      fotos_em_disco: disk[0].files.filter(f => MIME[f.ext]).length,
      recent_activity: M.recent, audit_events: M.audit.slice(0, 50),
    };
  }

  // ── App ──
  const app = express();
  app.disable('x-powered-by'); app.set('etag', false);
  app.use((req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' });
    req._t0 = performance.now();
    next();
  });
  const sendJson = (res, status, obj) => { const b = Buffer.from(JSON.stringify(obj), 'utf8'); res.status(status).set({ 'Content-Type': 'application/json; charset=utf-8', Connection: 'close' }).end(b); };

  app.options('*', (req, res) => res.status(200).end());

  async function dispararSync3Sites() {
    if (syncState.running) return { status: 'running', sync: syncState };
    syncState.running = true; syncState.lastError = null;
    try {
      const syncScriptPath = path.join(BASE, 'sincronizar_3_sites_brk.js');
      try { delete require.cache[require.resolve(syncScriptPath)]; } catch (_) {}
      const modSync = require(syncScriptPath);
      const res = await modSync.sincronizarBanco3Sites({ silent: true });
      recarregarCatalogo();
      syncState.lastSync = res.ultima_sincronizacao;
      syncState.lastResult = res;
      syncState.running = false;
      return { status: 'ok', sync: syncState, resultado: res };
    } catch (e) {
      syncState.lastError = e.message;
      syncState.running = false;
      throw e;
    }
  }

  // ── Ciclo Horário Automático de Atualização Contínua (a cada 60 minutos) ──
  const INTERVALO_HORARIO_MS = 60 * 60 * 1000;
  const timerSyncHorario = setInterval(() => {
    console.log('[FOTOS] ⏰ [CICLO HORÁRIO] Disparando atualização contínua do Banco Oficial (3 sites)...');
    dispararSync3Sites().then(r => {
      console.log(`[FOTOS] ⏰ [CICLO HORÁRIO] Sucesso: ${r.resultado?.total_modelos} modelos, ${r.resultado?.total_descricoes} descrições, ${r.resultado?.fotos_novas_baixadas} fotos novas (${r.resultado?.duracao_segundos}s)`);
    }).catch(err => {
      console.error('[FOTOS] ⚠️ [CICLO HORÁRIO] Falha:', err.message);
    });
  }, INTERVALO_HORARIO_MS);
  if (timerSyncHorario.unref) timerSyncHorario.unref();

  app.post('*', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
    const rota = req.path.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (rota === 'api/sync' || rota === 'sync') {
      try { const r = await dispararSync3Sites(); registrarReq(req, 200, null, req._t0); return sendJson(res, 200, r); }
      catch (e) { registrarReq(req, 500, null, req._t0); return sendJson(res, 500, { status: 'erro', detalhes: e.message }); }
    }
    if (rota === 'api/reload' || rota === 'reload') {
      recarregarCatalogo(); registrarReq(req, 200, null, req._t0);
      return sendJson(res, 200, { status: 'ok', total_skus: maps.sku_foto.size, total_modelos: maps.mod_foto.size, fotos_em_disco: disk[0].files.length });
    }
    if (rota === 'api/audit' || rota === 'audit') {
      try {
        const d = JSON.parse(typeof req.body === 'string' ? req.body : '');
        if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('corpo deve ser um objeto JSON');
        registrarAuditoria(d);
        registrarReq(req, 200, null, req._t0);
        return sendJson(res, 200, { status: 'ok', mensagem: 'Evento de auditoria registrado com sucesso.' });
      } catch (e) { registrarReq(req, 400, null, req._t0); return sendJson(res, 400, { status: 'erro', detalhes: e.message }); }
    }
    return sendJson(res, 404, { erro: `Rota POST nao encontrada: ${req.originalUrl}` });
  });

  app.head('*', async (req, res) => {
    const [arq, tier] = await resolver(req.path);
    if (!arq) { registrar404(stemOf(decodeURIComponentSafe(req.path))); registrarReq(req, 404, null, req._t0); return res.status(404).end(); }
    registrarReq(req, 200, tier, req._t0);
    res.status(200).set({ 'Content-Type': MIME[extOf(arq)] || 'application/octet-stream', 'Content-Length': String(fs.statSync(arq).size), 'X-Resolved-Tier': tier }).end();
  });

  app.get('*', async (req, res) => {
    const rota = req.path.replace(/^\/+|\/+$/g, ''); const low = rota.toLowerCase();
    const query = req.originalUrl.includes('?') ? req.originalUrl.split('?').slice(1).join('?') : '';
    const done = (status, tier) => registrarReq(req, status, tier, req._t0);
    try {
      if (low === 'ping' || low === 'status') { done(200); return sendJson(res, 200, { status: 'online', porta: opts.port || 8000, versao: VERSAO, uptime_segundos: Math.floor((Date.now() - startedAt) / 1000), timestamp: isoLocal(), sync: syncState }); }
      if (low === 'api/sync/status' || low === 'sync/status') { done(200); return sendJson(res, 200, { status: 'ok', sync: syncState, total_skus: maps.sku_foto.size, total_modelos: maps.mod_foto.size, fotos_em_disco: disk[0].files.length }); }
      if (low === 'api/reload' || low === 'reload') { recarregarCatalogo(); done(200); return sendJson(res, 200, { status: 'ok', total_skus: maps.sku_foto.size, total_modelos: maps.mod_foto.size, fotos_em_disco: disk[0].files.length }); }
      if (['stats', 'api/stats', 'metrics'].includes(low)) { done(200); return sendJson(res, 200, { ...statsDict(), sync: syncState }); }
      if (['dashboard', 'painel', 'metrics/ui'].includes(low)) { done(200); return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' }).end(dashboardHtml(opts.port || 8000)); }
      if (low === 'sankhya_auto_fotos_variantes.user.js' || low === 'userscript.user.js') {
        const scriptPath = path.join(ROOT, 'tampermonkey', 'sankhya_auto_fotos_variantes.user.js');
        if (fs.existsSync(scriptPath)) { done(200); return res.status(200).set({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'close' }).end(fs.readFileSync(scriptPath)); }
      }
      if (['api/missing', 'missing', 'faltantes'].includes(low)) {
        done(200);
        if (query.includes('csv')) {
          const linhas = Object.keys(M.missing).sort().map(k => `${k};${M.missing[k].tentativas};${M.missing[k].primeira_vez}`);
          return res.status(200).set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="skus_faltantes_sankhya.csv"', Connection: 'close' }).end('\uFEFF' + ['SKU;TENTATIVAS;PRIMEIRA_CONSULTA', ...linhas].join('\r\n') + '\r\n');
        }
        return sendJson(res, 200, M.missing);
      }
      if (low === 'api/audit' || low === 'audit/logs') {
        const f = path.join(PASTA_LOGS, 'auditoria_lotes_sankhya.csv');
        if (query.includes('format=csv') && fs.existsSync(f)) return res.status(200).set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="auditoria_sankhya_completa.csv"', Connection: 'close' }).end(fs.readFileSync(f));
        done(200); return sendJson(res, 200, { total: M.audit.length, eventos: M.audit });
      }
      if (['modelos', 'lista', 'codigos'].includes(low)) {
        const stems = [...new Set(disk[0].files.filter(f => MIME[f.ext]).map(f => stemOf(f.name)))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        done(200); return sendJson(res, 200, { total: stems.length, modelos: stems });
      }
      if (low.startsWith('variantes')) {
        const partes = rota.split('/'); let modeloReq = '';
        if (partes[1]) modeloReq = decodeURIComponentSafe(partes[1]).trim();
        else if (query.includes('modelo=')) modeloReq = String(req.query.modelo || '').trim();
        const chave = modeloReq.toUpperCase().replace(/-+$/, '');
        let lista = maps.variantes.get(chave);
        if (!lista || !lista.length) { const nk = chave.replace(/[-_]/g, ''); for (const [k, v] of maps.variantes) { if (k.replace(/[-_]/g, '') === nk) { lista = v; break; } } }
        done(200); return sendJson(res, 200, { modelo: modeloReq, total: (lista || []).length, variantes: lista || [] });
      }
      if (low.startsWith('info/') || low.startsWith('sku/')) {
        const alvo = decodeURIComponentSafe(rota.split('/').slice(1).join('/')).trim(); const up = alvo.toUpperCase();
        const [arq, tier] = await resolver(alvo);
        done(200, tier);
        return sendJson(res, 200, { consulta: alvo, foto_sku: maps.sku_foto.get(up) || null, foto_modelo: maps.mod_foto.get(up) || null, url: maps.sku_url.get(up) || maps.mod_url.get(up) || null, resolvido: arq || null, tier_resolucao: tier || null, existe_no_disco: !!arq });
      }
      if (low.startsWith('descricao/') || low.startsWith('descricoes/') || low.startsWith('api/descricao/')) {
        const partes = rota.split('/');
        const codigoReq = decodeURIComponentSafe(partes[partes.length - 1]).trim().toUpperCase();
        const modKey = codigoReq.replace(/-+$/, '');
        let d = maps.descricoes.get(modKey) || maps.descricoes.get(codigoReq);
        if (!d) {
          const modResolved = maps.sku_foto.get(modKey) || maps.mod_foto.get(modKey);
          if (modResolved) {
            const stem = stemOf(modResolved).toUpperCase();
            d = maps.descricoes.get(stem);
          }
        }
        done(d ? 200 : 404);
        if (d) return sendJson(res, 200, { status: 'ok', ...d });
        return sendJson(res, 404, { status: 'erro', mensagem: `Descricao nao encontrada para o codigo: ${codigoReq}` });
      }
      if (low === 'api/descricoes' || low === 'descricoes') {
        done(200);
        return sendJson(res, 200, {
          status: 'ok',
          total_descricoes_indexadas: maps.descricoes.size,
          amostra_modelos: [...maps.descricoes.keys()].slice(0, 50),
        });
      }
      // Catch-all → foto
      const [arq, tier] = await resolver(req.path);
      if (!arq) { registrar404(stemOf(decodeURIComponentSafe(req.path))); done(404); return sendJson(res, 404, { erro: `Foto nao encontrada para o caminho: ${req.originalUrl}` }); }
      let buf = fs.readFileSync(arq), mime = MIME[extOf(arq)] || 'application/octet-stream'; const extra = {};
      if (extOf(arq) === '.webp' && sharp) {
        try { buf = await sharp(buf).png().toBuffer(); mime = 'image/png'; extra['X-Original-Format'] = 'webp'; M.webp++; } catch (e) { /* serve webp cru */ }
      }
      done(200, tier);
      return res.status(200).set({ 'Content-Type': mime, Connection: 'close', 'Cache-Control': 'public, max-age=86400', 'X-Resolved-Tier': tier || 'desconhecido', ...extra }).end(buf);
    } catch (e) { done(500); return res.status(500).end(`Erro interno: ${e.message}`); }
  });

  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }
  app.locals.resolver = resolver; app.locals.maps = maps; app.locals.recarregarCatalogo = recarregarCatalogo;
  return app;
}

function dashboardHtml(port) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Servidor de Fotos Sankhya v${VERSAO} (HUB)</title>
<style>body{font-family:Segoe UI,sans-serif;background:#0b0f14;color:#e5e7eb;margin:24px}h1{color:#38bdf8;font-size:20px}.k{display:flex;gap:12px;flex-wrap:wrap}.c{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:12px 16px;min-width:150px}.c b{display:block;font-size:22px;color:#a3e635}table{border-collapse:collapse;width:100%;margin-top:12px;font-size:12px}td,th{border-bottom:1px solid #1f2937;padding:6px;text-align:left}a{color:#38bdf8}input,button{background:#111827;color:#e5e7eb;border:1px solid #374151;padding:6px 10px;border-radius:6px;cursor:pointer}.ok{color:#22c55e}</style></head><body>
<h1>🖼️ Servidor de Fotos Sankhya v${VERSAO} — 3 Sites BRK (Agro + Fishing + Motors)</h1>
<div class="k" id="k"></div>
<p><a href="/api/missing?format=csv">CSV Faltantes</a> · <a href="/api/audit?format=csv">CSV Auditoria</a> · <button onclick="sync3()" id="bs" style="background:#059669;border-color:#10b981;font-weight:bold">🔄 Sincronizar 3 Sites BRK (Agro + Fishing + Motors)</button> <span id="sr"></span></p>
<p>Testar SKU: <input id="s" placeholder="ex.: BTSTELLA_34"> <button onclick="t()">Testar</button> <span id="r"></span></p>
<h3>Últimas requisições</h3><table id="rq"></table><h3>Auditoria</h3><table id="au"></table>
<script>
async function sync3(){const b=document.getElementById('bs'),sr=document.getElementById('sr');b.disabled=true;sr.textContent='⏳ Sincronizando brkagro + brkfishing + brkmotors...';try{const j=await (await fetch('/api/sync',{method:'POST'})).json();sr.textContent='✅ Concluído: '+(j.resultado?.total_modelos||0)+' modelos / '+(j.resultado?.total_skus||0)+' SKUs ('+(j.resultado?.fotos_novas_baixadas||0)+' fotos novas)';up();}catch(e){sr.textContent='❌ '+e.message;}b.disabled=false;}
async function t(){const v=document.getElementById('s').value;const j=await (await fetch('/info/'+encodeURIComponent(v))).json();document.getElementById('r').textContent=JSON.stringify({tier:j.tier_resolucao,existe:j.existe_no_disco,arquivo:j.resolvido});}
async function up(){try{const s=await (await fetch('/stats')).json();
document.getElementById('k').innerHTML=[['Fotos no disco',s.fotos_em_disco],['SKUs mapeados',s.total_skus_indexados],['Modelos',s.total_modelos_indexados],['Requisições',s.total_requests+' ('+s.taxa_sucesso_pct+'%)'],['SKUs sem foto',s.total_faltantes_registrados],['Uptime',s.uptime_formatado]].map(x=>'<div class="c">'+x[0]+'<b>'+x[1]+'</b></div>').join('')+Object.entries(s.tiers_count).map(x=>'<div class="c">'+x[0]+'<b>'+x[1]+'</b></div>').join('');
document.getElementById('rq').innerHTML='<tr><th>Hora</th><th>Rota</th><th>Status</th><th>Tier</th><th>ms</th></tr>'+s.recent_activity.slice(0,15).map(r=>'<tr><td>'+r.timestamp+'</td><td>'+r.rota+'</td><td class="'+(r.status==200?'ok':'')+'">'+r.status+'</td><td>'+r.tier+'</td><td>'+r.duracao_ms+'</td></tr>').join('');
document.getElementById('au').innerHTML='<tr><th>Hora</th><th>SKU</th><th>Modelo</th><th>Status</th><th>Motivo</th></tr>'+s.audit_events.map(a=>'<tr><td>'+String(a.timestamp).split(' ')[1]+'</td><td>'+a.sku+'</td><td>'+a.modelo+'</td><td class="'+(/ok|SUCESSO/i.test(a.status)?'ok':'')+'">'+a.status+'</td><td>'+a.motivo+'</td></tr>').join('');}catch(e){}}
up();setInterval(up,2500);
</script></body></html>`;
}

/** Inicia o servidor em 127.0.0.1:<port>. Não derruba o HUB se a porta estiver ocupada ou a pasta não existir. */
function startFotoServer({ baseDir, port = 8000 } = {}) {
  if (!baseDir || !fs.existsSync(path.join(baseDir, 'downloads_modelos_global', 'fotos'))) {
    console.warn(`[FOTOS] ⚠️ Pasta de fotos não encontrada (${baseDir || 'não configurada'}) — servidor de fotos Sankhya NÃO iniciado.`);
    return null;
  }
  const app = createFotoServer({ baseDir, port });
  const srv = app.listen(port, '127.0.0.1', () => console.log(`[FOTOS] 🖼️ Servidor de fotos Sankhya v${VERSAO} em http://127.0.0.1:${port} (dashboard: /dashboard)`));
  srv.on('error', (e) => console.warn(`[FOTOS] ⚠️ Porta ${port} indisponível (${e.code}) — outro servidor de fotos já está rodando? Seguindo sem ele.`));
  return srv;
}

if (require.main === module) {
  const baseDir = process.env.FOTOS_SANKHYA_DIR || path.join(__dirname, '..', '..', '..', 'INJETOR DE FOTOS SANKHYA', 'modulo_imagens');
  startFotoServer({ baseDir, port: parseInt(process.env.FOTOS_PORT, 10) || 8000 });
}

module.exports = { createFotoServer, startFotoServer, parseCsv, VERSAO };
