/**
 * Testes — ordenação do padrão oficial de imagens.
 * Padrão: 1=FRENTE, 2=COSTAS, 3=FRENTE PERSP, 4=COSTAS PERSP.
 * Execução: node --test hub/tests
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const U = require('../config/image-utils.js');

const sortNames = (names) =>
  [...names].sort((a, b) => {
    const pa = U.getImagePriority(a), pb = U.getImagePriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, undefined, { numeric: true });
  });

test('NOMES REAIS da rede (FUSION199 FEM, com typos) → padrão oficial', () => {
  // Estes 4 nomes produziam FRENTE PERSP, FRENTE, COSTA PESRSP, COSTAS (padrão errado)
  const fem = ['FEM COSTA PESRSP.png', 'FEM COSTAS.png', 'FEM FRENTE PERSP.png', 'FEM FRENTE.png'];
  assert.deepEqual(sortNames(fem), [
    'FEM FRENTE.png', 'FEM COSTAS.png', 'FEM FRENTE PERSP.png', 'FEM COSTA PESRSP.png',
  ]);
});

test('MASC (PERSP bem escrito) → padrão oficial', () => {
  const masc = ['MASC COSTAS PERSP.png', 'MASC FRENTE PERSP.png', 'MASC COSTAS.png', 'MASC FRENTE.png'];
  assert.deepEqual(sortNames(masc), [
    'MASC FRENTE.png', 'MASC COSTAS.png', 'MASC FRENTE PERSP.png', 'MASC COSTAS PERSP.png',
  ]);
});

test('Todas as grafias de perspectiva são reconhecidas', () => {
  for (const w of ['PERSP', 'PERSPEC', 'PERSPECTIVA', 'PESP', 'PESRSP', 'PERPS', 'PRESP', 'PERSPEC2']) {
    assert.equal(U.classifyImageAngle(`FEM FRENTE ${w}.png`).perspective, true, w);
  }
});

test('Palavras que NÃO são perspectiva não geram falso positivo', () => {
  for (const w of ['PRETA', 'PRETO', 'PUNHO', 'PESCOCO', 'PAPEL']) {
    assert.equal(U.classifyImageAngle(`MASC FRENTE ${w}.png`).perspective, false, w);
  }
});

test('Ângulo: COSTA (sem S), COSTAS, FRONT/BACK; COSTURA não é costas', () => {
  assert.equal(U.classifyImageAngle('FEM COSTA PESRSP.png').view, 'COSTAS');
  assert.equal(U.classifyImageAngle('COSTAS.png').view, 'COSTAS');
  assert.equal(U.classifyImageAngle('FRONT.png').view, 'FRENTE');
  assert.equal(U.classifyImageAngle('BACK.png').view, 'COSTAS');
  assert.equal(U.classifyImageAngle('DETALHE COSTURA.png').view, null);
});

test('Nomes numéricos mantêm ordem natural (2 antes de 10)', () => {
  assert.deepEqual(sortNames(['10.png', '2.png', '1.png']), ['1.png', '2.png', '10.png']);
});

test('Regressão: produtos únicos (Lenço/Tubeneck) mantêm prioridades', () => {
  assert.equal(U.getImagePriority('MESA.png'), 10);
  assert.equal(U.getImagePriority('LADO TUB.png'), 20);
  assert.equal(U.getImagePriority('CABEÇA.png'), 20);
  assert.equal(U.getImagePriority('CINTURA.png'), 25);
});

test('Regressão: tabela de prioridades das camisas (10/20/30/40/50/60/65)', () => {
  assert.equal(U.getImagePriority('FRENTE.png'), 10);
  assert.equal(U.getImagePriority('COSTAS.png'), 20);
  assert.equal(U.getImagePriority('FRENTE PERSPECTIVA.png'), 30);
  assert.equal(U.getImagePriority('COSTAS PERSPECTIVA.png'), 40);
  assert.equal(U.getImagePriority('COSTAS PERSPECTIVA 2.png'), 50);
  assert.equal(U.getImagePriority('ZOOM.png'), 60);
  assert.equal(U.getImagePriority('DETALHE.png'), 65);
});

test('smartSortImageObjects (smart-scan): perspectivas depois dos planos, FRENTE antes de COSTAS', () => {
  const imgs = ['FEM COSTA PESRSP.png', 'FEM COSTAS.png', 'FEM FRENTE PERSP.png', 'FEM FRENTE.png']
    .map(name => ({ name }));
  const order = U.smartSortImageObjects(imgs).map(i => i.name);
  assert.deepEqual(order, ['FEM FRENTE.png', 'FEM COSTAS.png', 'FEM FRENTE PERSP.png', 'FEM COSTA PESRSP.png']);
});

test('smartSortImages (caminhos completos) respeita o padrão', () => {
  const p = (n) => path.join('C:', 'x', n);
  const sorted = U.smartSortImages([
    p('FEM COSTA PESRSP.png'), p('FEM COSTAS.png'), p('FEM FRENTE PERSP.png'), p('FEM FRENTE.png'),
  ]).map(f => path.basename(f));
  assert.deepEqual(sorted, ['FEM FRENTE.png', 'FEM COSTAS.png', 'FEM FRENTE PERSP.png', 'FEM COSTA PESRSP.png']);
});
