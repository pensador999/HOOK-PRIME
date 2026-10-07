#!/usr/bin/env node
/**
 * build-bling-infantil.js — Gera planilha Bling (molde rtx.csv) de camisetas infantis
 * com grade numérica 04..14. Altera apenas código, título e tamanho; o resto é copiado
 * do molde (texto cru, em Windows-1252, para preservar formatação/aspas/TAB).
 * Uso: node tools/build-bling-infantil.js
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'ANALISAR CADASTRO');
const TEMPLATE = path.join(DIR, 'rtx.csv');
const OUT = path.join(DIR, 'Cadastro Infantil Bling.csv');
const SIZES = ['04', '06', '08', '10', '12', '14']; // menor → maior

// Produtos lidos da nota (foto) — nota: código da nota, só para rastreio
const PRODUCTS = [
  { nota: '802833', code: 'CAMISETA-SILK-01',    title: 'Camiseta Infantil Masculina Silk' },
  { nota: '802835', code: 'CAMISETA-SILK-02',    title: 'Camiseta Infantil Masculina Bill Way' },
  { nota: '802836', code: 'CAMISETA-BORDADA-01', title: 'Camiseta Infantil Masculina Bill Way Bordada' },
  { nota: '802837', code: 'CAMISETA-SILK-03',    title: 'Camiseta Infantil Masculina Bill Way Silk' },
  { nota: '802838', code: 'CAMISETA-SILK-04',    title: 'Camiseta Infantil Masculina Bill Way Silk' },
  { nota: '802925', code: 'CAMISETA-SILK-05',    title: 'Camiseta Infantil Feminina Bill Way Silk' },
  { nota: '802926', code: 'CAMISETA-SILK-06',    title: 'Camiseta Infantil Feminina Bill Way Silk' },
  { nota: '802927', code: 'CAMISETA-SILK-07',    title: 'Camiseta Infantil Feminina Bill Way Silk' },
];

const raw = fs.readFileSync(TEMPLATE, 'latin1');
const lines = raw.split('\r\n').filter(l => l.length);
const [header, parentTpl, childTpl] = lines; // childTpl = BP011BLPP (Tamanho:PP)

const must = (s, what) => { if (!s.includes(what)) throw new Error(`Molde inesperado: falta ${what}`); };
must(parentTpl, '"BP011\t"'); must(parentTpl, ';Camiseta Brasil Patriota Feminina Brasil Acima de Tudo Branca;');
must(childTpl, '"BP011BLPP\t"'); must(childTpl, ';Tamanho:PP;'); must(childTpl, ';BP011;');

const out = [header];
for (const p of PRODUCTS) {
  out.push(parentTpl
    .replace('"BP011\t"', `"${p.code}\t"`)
    .replace(';Camiseta Brasil Patriota Feminina Brasil Acima de Tudo Branca;', `;${p.title};`));
  for (const s of SIZES) {
    out.push(childTpl
      .replace('"BP011BLPP\t"', `"${p.code}-${s}\t"`)
      .replace(';Tamanho:PP;', `;Tamanho:${s};`)
      .replace(';BP011;', `;${p.code};`));
  }
}
fs.writeFileSync(OUT, out.join('\r\n') + '\r\n', 'latin1');
console.log(`✔ ${PRODUCTS.length} pais, ${PRODUCTS.length * SIZES.length} filhos → ${OUT}`);
