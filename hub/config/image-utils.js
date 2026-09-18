'use strict';

/**
 * image-utils.js — Utilitários Unificados para Imagens
 * 
 * Este módulo unifica lógica duplicada que existia em 4+ lugares no server.js:
 * - Smart Sort: priorização de imagens por tipo (FRENTE, COSTAS, PERSPECTIVA, etc.)
 * - Gender Classification: detecção de gênero a partir de nome de arquivo/pasta
 * 
 * @module image-utils
 * @version 1.0.0
 * @audit TD-004, TD-005
 */

const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

/** Extensões de imagem aceitas pelo sistema */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;

/** Mapeamento de nomes de pasta para chave interna de gênero */
const GENDER_FOLDERS_MAP = {
  'MASC': 'masc', 'MASCULINO': 'masc',
  'FEM': 'fem', 'FEMININO': 'fem',
  'INF': 'inf', 'INFANTIL': 'inf', 'KIDS': 'inf'
};

/** Mapeamento reverso: chave interna → nome de pasta padrão */
const GENDER_FOLDERS = { masc: 'MASC', fem: 'FEM', inf: 'INF' };

/** Nomes reconhecidos como gênero (para smart-scan) */
const GENDER_NAMES = ['MASC', 'FEM', 'INF', 'MASCULINO', 'FEMININO', 'INFANTIL', 'KIDS'];

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUTO ÚNICO — Detecção por prefixo de código
// ═══════════════════════════════════════════════════════════════════════════════

/** Prefixos que identificam produtos únicos (sem grade de tamanho) */
const UNIQUE_PREFIXES = {
  'T': 'Tubeneck', 'LEN': 'Lenço', 'BPTB': 'Tubeneck', 'BM': 'BlackMask',
  'BA': 'Boné', 'BN': 'Boné', 'LC': 'Lenço Cetim', 'CT': 'Copo Térmico',
  'CA': 'Capa Almofada', 'CN': 'Caneca',
};

/**
 * Detecta se um código pertence a um produto único pelo prefixo.
 * @param {string} code - Código do produto (ex: 'T659', 'LEN089')
 * @returns {boolean}
 */
function isUniqueProductCode(code) {
  if (!code) return false;
  const upper = code.toUpperCase();
  return Object.keys(UNIQUE_PREFIXES).some(p => {
    const after = upper.slice(p.length);
    return upper.startsWith(p) && /^\d/.test(after);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXCLUSÃO DE IMAGENS — Layout, Design, Gabarito
// ═══════════════════════════════════════════════════════════════════════════════

/** Nomes exatos de arquivos a excluir (sem extensão, case-insensitive) */
const EXCLUDED_IMAGE_NAMES = [
  'SUBSTITUIR', 'SUBSTITUIR AQUI', 'SUBSTITUIR_AQUI',  // Placeholders
];

/** Prefixos de nomes de arquivo a excluir */
const EXCLUDED_IMAGE_PREFIXES = [
  'LAYOUT', 'MKP', 'GABARITO', 'ARTE_', 'TEMPLATE', 'DESIGN',
];

/**
 * Verifica se um arquivo de imagem deve ser excluído da cópia.
 * Exclui: placeholders, layouts, mockups PSD, gabaritos, artes.
 * @param {string} fileName - Nome do arquivo
 * @returns {boolean} true se deve ser excluído
 */
function shouldExcludeImage(fileName) {
  const base = fileName.toUpperCase().replace(/\.[^.]+$/, '').trim();
  if (EXCLUDED_IMAGE_NAMES.includes(base)) return true;
  if (EXCLUDED_IMAGE_PREFIXES.some(p => base.startsWith(p))) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SMART SORT — Priorização de Imagens
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retorna a prioridade de ordenação de uma imagem com base no nome do arquivo.
 * Ordem: FRENTE(10) → COSTAS(20) → FRENTE PERSPECTIVA(30) → 
 *        COSTAS PERSPECTIVA(40) → COSTAS PERSPECTIVA 2(50) → 
 *        ZOOM(60) → DETALHE(65) → PESP(70) → OUTROS(100)
 * 
 * Se o nome for numérico puro (ex: "1.jpg", "02.jpg"), retorna o número.
 * 
 * @param {string} fileName - Nome do arquivo (com ou sem extensão)
 * @returns {number} Prioridade (menor = mais prioritário)
 */
function getImagePriority(fileName) {
  const name = fileName.toUpperCase().replace(/\.[^.]+$/, '');

  // Numérico puro mantém ordem natural
  if (/^\d+$/.test(name.trim())) return parseInt(name.trim());

  const isFrente    = /FRENTE/.test(name);
  const isCostas    = /COSTA/.test(name);
  const isPerspec   = /PERSPEC|PERSPECTIVA/.test(name);
  const isPerspec2  = /PERSPECTIVA\s*2|PERSPEC\s*2/.test(name);
  const isZoom      = /ZOOM/.test(name);
  const isDetalhe   = /DETALHE|DETAIL/.test(name);
  const isPesp      = /PESP/.test(name);

  // Nomes de imagens de camisas (ordem padrão)
  if (isFrente && !isPerspec)               return 10; // 1º FRENTE plano
  if (isCostas && !isPerspec && !isPerspec2) return 20; // 2º COSTAS plano
  if (isFrente && isPerspec)                 return 30; // 3º FRENTE perspectiva
  if (isCostas && isPerspec && !isPerspec2)  return 40; // 4º COSTAS perspectiva
  if (isCostas && isPerspec2)                return 50; // 5º COSTAS perspectiva 2
  if (isZoom)                                return 60; // 6º ZOOM
  if (isDetalhe)                             return 65; // 7º DETALHE
  if (isPesp)                                return 70; // 8º PESP genérica

  // Nomes de imagens de produtos únicos (Lenço, Tubeneck, Bandana)
  if (/\bMESA\b/.test(name))                 return 10; // Lenço: flat na mesa = PRINCIPAL
  if (/\bLADO\b/.test(name))                 return 20; // Tubeneck: LADO TUB = 2ª
  if (/\bCABE[ÇC]A\b/.test(name))           return 20; // Lenço: modelo cabeça = 2ª
  if (/\bCINTURA\b/.test(name))              return 25; // Lenço: modelo cintura = 3ª

  return 100; // Fallback
}

/**
 * Ordena um array de caminhos de imagem usando Smart Sort.
 * @param {string[]} imagePaths - Array de caminhos completos ou nomes de arquivo
 * @returns {string[]} Array ordenado (modifica in-place e retorna)
 */
function smartSortImages(imagePaths) {
  return imagePaths.sort((a, b) => {
    const nameA = path.basename(a);
    const nameB = path.basename(b);
    const prioA = getImagePriority(nameA);
    const prioB = getImagePriority(nameB);
    if (prioA !== prioB) return prioA - prioB;
    return nameA.localeCompare(nameB, undefined, { numeric: true });
  });
}

/**
 * Smart Sort v3 para objetos com propriedade `name`.
 * Usado pelo smart-scan onde imagens são objetos {name, fullPath, ...}.
 * Faz limpeza extra: remove prefixo numérico, HUMANIZADO, gênero inline.
 * 
 * @param {Array<{name: string}>} images - Array de objetos com propriedade `name`
 * @returns {Array} Array ordenado (modifica in-place e retorna com propriedade `priority`)
 */
function smartSortImageObjects(images) {
  images.forEach(img => {
    let nameClean = img.name.toUpperCase().replace(/\.[^.]+$/, '');
    nameClean = nameClean.replace(/^\d+[_\s]/, '');              // remove prefixo numérico
    nameClean = nameClean.replace(/HUMANIZAD[OA][_\s]?/g, '');  // remove HUMANIZADO
    nameClean = nameClean.replace(/MASC[_\s]|FEM[_\s]|INF[_\s]/g, ''); // remove gênero inline

    if (/FRENTE.*COSTAS?|COSTAS?.*FRENTE/.test(nameClean))               img.priority = 1;
    else if (/FRENTE|FRONT|CABE[CÇ]A/.test(nameClean))                   img.priority = 1;
    else if (/COSTAS?|BACK|VERSO|CINTURA|TRASEIRA/.test(nameClean))       img.priority = 2;
    else if (/PERSPEC|PERSPECTIVA|PESP|MESA|LADO|LATERAL|ZOOM/.test(nameClean)) img.priority = 3;
    else if (/AMPLIADO|DETALHE|INTERNO|COSTURA|BRASIL|PUNHO/.test(nameClean)) img.priority = 4;
    else img.priority = 5;
  });
  return images.sort((a, b) => (a.priority || 5) - (b.priority || 5));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GENDER CLASSIFICATION — Detecção de Gênero
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detecta gênero a partir do nome de um arquivo.
 * @param {string} filename - Nome do arquivo
 * @returns {'masc'|'fem'|'inf'|null} Gênero detectado ou null
 */
function detectGenderFromFilename(filename) {
  const name = filename.toUpperCase().replace(/\.[^.]+$/, '');
  if (/MASC|MASCULIN/.test(name)) return 'masc';
  if (/FEM|FEMININ/.test(name)) return 'fem';
  if (/INF(?:ANT)?|KIDS?/.test(name)) return 'inf';
  return null;
}

/**
 * Classifica gênero a partir do nome de uma pasta.
 * Retorna a chave de pasta (MASC, FEM, INF).
 * Default: MASC (produto padrão é masculino).
 * 
 * @param {string} folderName - Nome da pasta
 * @returns {'MASC'|'FEM'|'INF'} Gênero classificado
 */
function classifyGender(folderName) {
  const n = folderName.toUpperCase();
  if (n.startsWith('FEM') || n === 'FEMININO') return 'FEM';
  if (n.startsWith('INF') || n === 'INFANTIL' || n === 'KIDS') return 'INF';
  return 'MASC';
}

/**
 * Classifica gênero de um arquivo para agrupamento em URLs.
 * Usado pelo upload-batch para separar URLs por gênero.
 * 
 * @param {string} filename - Nome original do arquivo
 * @returns {'masc'|'fem'|'inf'|null} Gênero ou null se não detectado
 */
function classifyGenderFromUrl(filename) {
  return detectGenderFromFilename(filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Constantes
  IMAGE_EXTENSIONS,
  GENDER_FOLDERS_MAP,
  GENDER_FOLDERS,
  GENDER_NAMES,
  UNIQUE_PREFIXES,

  // Smart Sort
  getImagePriority,
  smartSortImages,
  smartSortImageObjects,

  // Exclusão / Filtragem
  shouldExcludeImage,
  isUniqueProductCode,

  // Gender Classification
  detectGenderFromFilename,
  classifyGender,
  classifyGenderFromUrl,
};
