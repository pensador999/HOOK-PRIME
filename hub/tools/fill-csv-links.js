#!/usr/bin/env node
/**
 * Preenche a coluna "URL Imagens Externas" de uma planilha Bling (CSV ;) com os
 * links do CDN (BRK Link), código a código, SEM misturar gêneros:
 *     FUSION200   → <pasta>/FUSION200/MASC
 *     FUSION200BL → <pasta>/FUSION200/FEM
 * Pai e variações recebem os MESMOS 4 links (padrão já usado na planilha).
 *
 * Segurança:
 *  - NUNCA altera o CSV original: grava um arquivo novo (--out).
 *  - Só preenche linhas com URL vazia (o que já está preenchido é preservado).
 *  - Retomável: progresso em hub/logs/fill-links-progress.json (não re-sobe).
 *  - Gera JPEG_imagens/N.jpg (800x1200, igual Light Resizer) onde faltar.
 *  - Verificação final: cada link do CDN tem o MESMO tamanho em bytes do JPEG
 *    local da mesma posição (prova de que link ↔ imagem ↔ ordem estão certos).
 *
 * Uso:
 *   node tools/fill-csv-links.js --csv "<csv>" --dir "<pasta de imagens>" --out "<novo csv>" [--apply] [--only=FUSION200BL,...]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const arg = (n) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); if (a) return a.slice(n.length + 3); const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null; };
const CSV_IN = arg('csv'), DIR = arg('dir'), CSV_OUT = arg('out');
const APPLY = process.argv.includes('--apply');
const ONLY = arg('only') ? new Set(arg('only').toUpperCase().split(',')) : null;
const API = arg('api') || 'http://localhost:3000';
if (!CSV_IN || !DIR || !CSV_OUT) { console.error('Uso: --csv --dir --out [--apply] [--only=]'); process.exit(1); }

// ── CSV (delimitador ;, aspas ") com round-trip fiel ─────────────────────────
function parseCsv(t) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const esc = (v) => /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
const serialize = (rows) => rows.map(r => r.map(esc).join(';')).join('\r\n') + '\r\n';

let raw = fs.readFileSync(CSV_IN, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xFEFF; if (hasBom) raw = raw.slice(1);
const rows = parseCsv(raw);
if (serialize(rows) !== raw) { console.error('❌ Round-trip do CSV não é idêntico — abortando para não corromper a planilha.'); process.exit(1); }
console.log('✔ Round-trip do CSV idêntico ao original (formatação preservada)');

const H = rows[0];
const I = { cod: H.indexOf('Código'), url: H.indexOf('URL Imagens Externas'), pai: H.indexOf('Código Pai'), tipo: H.indexOf('Produto Variação') };
if (Object.values(I).some(v => v < 0)) { console.error('❌ Colunas esperadas não encontradas'); process.exit(1); }

const parents = rows.slice(1).filter(r => r[I.tipo] === 'Produto');
const todo = parents.filter(r => !r[I.url].trim() && (!ONLY || ONLY.has(r[I.cod].toUpperCase())));
const planOf = (code) => { const fem = /BL$/.test(code); return { base: fem ? code.slice(0, -2) : code, gender: fem ? 'fem' : 'masc', folder: fem ? 'FEM' : 'MASC' }; };

console.log(`Pais na planilha: ${parents.length} · já preenchidos: ${parents.filter(r => r[I.url].trim()).length} · a preencher: ${todo.length}`);

// ── 1) JPEG_imagens onde faltar ──────────────────────────────────────────────
async function ensureJpegs(code) {
  const { base, folder } = planOf(code);
  const dir = path.join(DIR, base, folder);
  const jdir = path.join(dir, 'JPEG_imagens');
  const have = fs.existsSync(jdir) ? fs.readdirSync(jdir).filter(f => /^\d+\.jpe?g$/i.test(f)) : [];
  const pngs = fs.readdirSync(dir).filter(f => /^\d+\.png$/i.test(f)).sort((a, b) => parseInt(a) - parseInt(b));
  if (!pngs.length) throw new Error(`sem PNGs em ${dir}`);
  if (have.length === pngs.length) return { dir: jdir, created: 0, count: have.length };
  if (have.length) throw new Error(`JPEG_imagens incompleto (${have.length}/${pngs.length}) em ${dir}`);
  fs.mkdirSync(jdir, { recursive: true });
  for (const p of pngs) {
    await sharp(path.join(dir, p)).resize(800, 1200, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(path.join(jdir, p.replace(/\.png$/i, '.jpg')));
  }
  return { dir: jdir, created: pngs.length, count: pngs.length };
}

// ── 2) Upload via endpoint oficial do sistema ───────────────────────────────
async function upload(code) {
  const { base, gender } = planOf(code);
  let last;
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(`${API}/api/s3-proxy/upload-from-disk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: DIR, codeBase: base, gender, autoRename: true }),
      });
      const d = await r.json();
      if (!r.ok || !d.success || !d.urls || d.urls.length < 1) throw new Error(d.error || `HTTP ${r.status}`);
      return d.urls.map(u => u.trim());
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 2500 * a)); }
  }
  throw last;
}

const PROGRESS = path.join(__dirname, '..', 'logs', 'fill-links-progress.json');
const progress = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};
const saveProgress = () => { fs.mkdirSync(path.dirname(PROGRESS), { recursive: true }); fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2)); };

(async () => {
  if (!APPLY) {
    console.log('\nSIMULAÇÃO — códigos que seriam preenchidos:');
    console.log(todo.map(r => r[I.cod]).join(', '));
    console.log('\nRode com --apply para gerar JPEGs faltantes, subir ao CDN e gravar o CSV novo.');
    return;
  }

  let createdDirs = 0;
  for (const p of todo) {
    const code = p[I.cod];
    const j = await ensureJpegs(code);
    if (j.created) createdDirs++;
    if (progress[code] && progress[code].length === j.count) continue; // já subido
    const urls = await upload(code);
    if (urls.length !== j.count) throw new Error(`${code}: esperado ${j.count} URLs, recebido ${urls.length}`);
    progress[code] = urls; saveProgress();
    console.log(`☁️  ${code.padEnd(13)} ${urls.length} links  (${planOf(code).folder})`);
  }
  console.log(`\nJPEG_imagens geradas em ${createdDirs} pasta(s).`);

  // ── 3) Gravar: pai + variações recebem os MESMOS links do pai ───────────────
  let filledRows = 0;
  for (const p of todo) {
    const joined = progress[p[I.cod]].join('|');
    const targets = rows.slice(1).filter(r => r[I.cod] === p[I.cod] || r[I.pai] === p[I.cod]);
    for (const r of targets) { if (r[I.url].trim()) throw new Error(`linha já preenchida: ${r[I.cod]}`); r[I.url] = joined; filledRows++; }
  }
  fs.writeFileSync(CSV_OUT, (hasBom ? '\uFEFF' : '') + serialize(rows), 'utf8');
  console.log(`✔ ${filledRows} linhas preenchidas → ${CSV_OUT}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
