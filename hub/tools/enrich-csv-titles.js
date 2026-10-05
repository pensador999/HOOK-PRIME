#!/usr/bin/env node
/**
 * enrich-csv-titles.js — Acrescenta UMA palavra (relacionada ao design/estampa) ao título
 * dos produtos-pai da planilha Bling, logo após "Explorerx".
 *
 *   Antes:  Camisa FusionX Motors Explorerx Mapa Cinza com Proteção UV50+
 *   Depois: Camisa FusionX Motors Explorerx Cartográfica Mapa Cinza com Proteção UV50+
 *
 * Só altera a coluna "Descrição" das linhas "Produto" (variações "Tamanho:PP" intactas).
 * Idempotente: não duplica se a palavra já estiver aplicada.
 * Uso: node tools/enrich-csv-titles.js --csv "<in>" --out "<out>" [--apply]
 */
const fs = require('fs');

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const CSV_IN = arg('csv'), CSV_OUT = arg('out'), APPLY = process.argv.includes('--apply');
if (!CSV_IN || !CSV_OUT) { console.error('Uso: --csv <in> --out <out> [--apply]'); process.exit(1); }

// Regras em ordem (primeira que casar vence) → palavra da estampa
const RULES = [
  [/caveira|skull/i, 'Radical'],
  [/topograf/i, 'Relevo'],
  [/mou?n?tains/i, 'Náutica'],
  [/mapa|map\b/i, 'Cartográfica'],
  [/rosa dos ventos|wind rose/i, 'Náutica'],
  [/montanhas/i, 'Trilha'],
  [/global adventure/i, 'Aventureira'],
  [/caminhos/i, 'Trilha'],
  [/discover/i, 'Exploradora'],
];
const FALLBACK = 'Lisa'; // sem estampa (cores sólidas)
const WORDS = new Set([...RULES.map(r => r[1]), FALLBACK]);

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

function enrich(title) {
  const m = title.match(/^(.*?\bExplorerx)\s+(.*)$/i);
  if (!m) return null;
  const [, head, rest] = m;
  if (WORDS.has(rest.split(/\s+/)[0])) return null; // já aplicado
  const hit = RULES.find(([re]) => re.test(head + ' ' + rest)); // estampa pode vir antes OU depois de "Explorerx"
  const word = hit ? hit[1] : FALLBACK;
  return `${head} ${word} ${rest}`.replace(/\s{2,}/g, ' ');
}

let raw = fs.readFileSync(CSV_IN, 'utf8');
const bom = raw.charCodeAt(0) === 0xFEFF; if (bom) raw = raw.slice(1);
const rows = parseCsv(raw);
if (serialize(rows) !== raw) { console.error('❌ Round-trip não idêntico — abortando.'); process.exit(1); }
const H = rows[0], D = H.indexOf('Descrição'), T = H.indexOf('Produto Variação'), C = H.indexOf('Código');
let changed = 0, skipped = 0, maxLen = 0;
for (const r of rows.slice(1)) {
  if (r[T] !== 'Produto') continue;
  const n = enrich(r[D]);
  if (!n) { skipped++; console.log(`⚠️  sem alteração: ${r[C]} | ${r[D]}`); continue; }
  if (changed < 400) console.log(`${r[C].padEnd(14)} ${n}`);
  r[D] = n; changed++; maxLen = Math.max(maxLen, n.length);
}
console.log(`\nTítulos alterados: ${changed} · sem alteração: ${skipped} · maior título: ${maxLen} caracteres`);
if (APPLY) { fs.writeFileSync(CSV_OUT, (bom ? '\uFEFF' : '') + serialize(rows), 'utf8'); console.log(`✔ Gravado em ${CSV_OUT}`); }
else console.log('(dry-run — use --apply para gravar)');
