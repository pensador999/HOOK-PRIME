/**
 * Testes — URLs do CDN por gênero (planilha).
 * Reproduz o bug: FEM vem antes de MASC e a chave agregada misturava os dois,
 * colocando fotos femininas na linha do código masculino.
 * Execução: node --test hub/tests
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../public/js/autopilot/core/cdn-urls.js');

const FEM_URLS = 'https://cdn/FUSION199_FEM_GERAL_1.jpg | https://cdn/FUSION199_FEM_GERAL_2.jpg';
const MASC_URLS = 'https://cdn/FUSION199_MASC_GERAL_1.jpg | https://cdn/FUSION199_MASC_GERAL_2.jpg';

function buildMap(order) {
  const map = {};
  for (const g of order) {
    C.registerBlockUrls(map, { code: 'FUSION199', gender: g, variant: 'GERAL' }, g === 'FEM' ? FEM_URLS : MASC_URLS);
  }
  return map;
}

for (const order of [['FEM', 'MASC'], ['MASC', 'FEM']]) {
  test(`cada gênero no SEU código (ordem de upload: ${order.join('→')})`, () => {
    const wizard = C.normalizeForWizard(buildMap(order));
    assert.equal(wizard.FUSION199, MASC_URLS, 'código masculino só com URLs MASC');
    assert.equal(wizard.FUSION199BL, FEM_URLS, 'código feminino só com URLs FEM');
    assert.ok(!wizard.FUSION199.includes('FEM'), 'nenhuma foto FEM no masculino');
    assert.ok(!wizard.FUSION199BL.includes('MASC'), 'nenhuma foto MASC no feminino');
  });
}

test('registerBlockUrls NÃO grava agregado misturado para blocos com gênero', () => {
  const map = buildMap(['FEM', 'MASC']);
  assert.deepEqual(Object.keys(map).sort(), ['FUSION199_FEM_GERAL', 'FUSION199_MASC_GERAL']);
});

test('INF vai para BASE+I', () => {
  const map = {};
  C.registerBlockUrls(map, { code: 'FUSION1', gender: 'MASC', variant: 'GERAL' }, 'm');
  C.registerBlockUrls(map, { code: 'FUSION1', gender: 'FEM', variant: 'GERAL' }, 'f');
  C.registerBlockUrls(map, { code: 'FUSION1', gender: 'INF', variant: 'GERAL' }, 'i');
  const w = C.normalizeForWizard(map);
  assert.deepEqual([w.FUSION1, w.FUSION1BL, w.FUSION1I], ['m', 'f', 'i']);
});

test('DEFESA: payload ANTIGO com chave agregada misturada é neutralizado', () => {
  // Formato do bug: FEM antes de MASC + agregado "CODIGO_GERAL" = "FEM | MASC"
  const legacy = {
    FUSION199_FEM_GERAL: FEM_URLS,
    FUSION199_GERAL: `${FEM_URLS} | ${MASC_URLS}`,
    FUSION199_MASC_GERAL: MASC_URLS,
  };
  const w = C.normalizeForWizard(legacy);
  assert.equal(w.FUSION199, MASC_URLS);
  assert.equal(w.FUSION199BL, FEM_URLS);
});

test('Produto sem gênero (Lenço/Tubeneck) continua indo para o código base', () => {
  const map = {};
  C.registerBlockUrls(map, { code: 'LEN001', gender: 'GERAL', variant: 'GERAL' }, 'a | b');
  const w = C.normalizeForWizard(map);
  assert.equal(w.LEN001, 'a | b'); // sem duplicar mesmo existindo 2 chaves GERAL
});

test('APC mantém CODE_GENDER_Cor (PRETA→Preto)', () => {
  const map = {};
  C.registerBlockUrls(map, { code: 'APC0541', gender: 'MASC', variant: 'PRETA' }, 'mp');
  C.registerBlockUrls(map, { code: 'APC0541', gender: 'FEM', variant: 'PRETA' }, 'fp');
  C.registerBlockUrls(map, { code: 'APC0541', gender: 'MASC', variant: 'BRANCA' }, 'mb');
  const w = C.normalizeForWizard(map);
  assert.equal(w.APC0541_MASC_Preto, 'mp');
  assert.equal(w.APC0541_FEM_Preto, 'fp');
  assert.equal(w.APC0541_MASC_Branco, 'mb');
});

test('Múltiplos códigos não se contaminam', () => {
  const map = {};
  for (const code of ['FUSION199', 'FUSION200']) {
    C.registerBlockUrls(map, { code, gender: 'FEM', variant: 'GERAL' }, `${code}-fem`);
    C.registerBlockUrls(map, { code, gender: 'MASC', variant: 'GERAL' }, `${code}-masc`);
  }
  const w = C.normalizeForWizard(map);
  assert.equal(w.FUSION199, 'FUSION199-masc');
  assert.equal(w.FUSION200BL, 'FUSION200-fem');
});
