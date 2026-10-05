/**
 * @module autopilot/core/cdn-urls
 * Montagem e normalização das URLs do CDN por CÓDIGO + GÊNERO.
 *
 * Por que existe (bug corrigido):
 *   O fluxo RTX gravava uma chave agregada "CODIGO_GERAL" que MISTURAVA as URLs
 *   de MASC e FEM. Na normalização para o wizard essa chave (sem gênero) era
 *   atribuída ao código base (masculino) — como a pasta FEM vem antes da MASC,
 *   a linha do masculino recebia "FEM | MASC" e a planilha saía com fotos
 *   femininas nos códigos masculinos.
 *
 * Regras:
 *   1. A chave agregada "CODIGO_COR" só é gravada para blocos SEM gênero (GERAL).
 *   2. Na normalização, chaves sem gênero são IGNORADAS quando o mesmo código
 *      possui chaves com gênero (defesa para sessões/payloads antigos).
 *   3. Cada gênero vai SEMPRE para o seu próprio código: MASC→BASE, FEM→BASE+BL,
 *      INF→BASE+I (APC mantém CODE_GENDER_Cor).
 *
 * UMD: funciona no navegador (window.AutopilotModules.CdnUrls) e no Node (tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AutopilotModules = root.AutopilotModules || {};
    root.AutopilotModules.CdnUrls = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GENDER_TOKENS = ['MASC', 'FEM', 'INF'];
  const APC_COLOR_MAP = {
    PRETA: 'Preto', PRETO: 'Preto',
    BRANCA: 'Branco', BRANCO: 'Branco',
    BEGE: 'Bege',
  };

  /** Detecta o gênero (MASC|FEM|INF) presente numa chave do mapa CDN, ou null. */
  function genderOfKey(key) {
    const parts = String(key).toUpperCase().split('_').slice(1);
    return GENDER_TOKENS.find(g => parts.includes(g)) || null;
  }

  /**
   * Registra as URLs de um bloco (código + gênero + variante) no mapa CDN.
   * @param {Object} cdnUrlMap - mapa mutável
   * @param {{code:string, gender:string, variant:string}} block
   * @param {string} joined - URLs separadas por " | "
   */
  function registerBlockUrls(cdnUrlMap, block, joined) {
    const gender = (block.gender || 'GERAL').toUpperCase();
    const variant = (block.variant || 'GERAL').toUpperCase();
    cdnUrlMap[`${block.code}_${gender}_${variant}`] = joined;

    // Agregado por cor: SOMENTE para blocos sem gênero (produto único / sem MASC-FEM).
    // Para blocos com gênero ele misturava masculino e feminino — NUNCA gravar.
    if (gender === 'GERAL') {
      const colorKey = `${block.code}_${variant}`;
      cdnUrlMap[colorKey] = cdnUrlMap[colorKey] ? `${cdnUrlMap[colorKey]} | ${joined}` : joined;
    }
  }

  function appendUnique(target, key, urls) {
    if (target[key] && target[key].trim()) {
      if (!target[key].includes(urls)) target[key] += ' | ' + urls;
    } else {
      target[key] = urls;
    }
  }

  /**
   * Converte o mapa CDN do RTX para as chaves lidas pelo wizard (step3/step5):
   *   Normal: BASE (masc), BASEBL (fem), BASEI (inf)
   *   APC:    BASE_GENDER_Cor  (ex.: APC0541_FEM_Preto)
   *
   * @param {Object} cdnUrls - mapa do RTX (ex.: { "FUSION199_FEM_GERAL": "...", ... })
   * @param {Object} [target] - state.imageUrls existente (mutado e retornado)
   * @returns {Object} target
   */
  function normalizeForWizard(cdnUrls, target) {
    const out = target || {};
    const entries = Object.entries(cdnUrls || {});

    // Códigos que possuem URLs separadas por gênero
    const basesWithGender = new Set(
      entries.filter(([k]) => genderOfKey(k)).map(([k]) => k.split('_')[0])
    );

    for (const [key, urls] of entries) {
      if (!urls || !String(urls).trim()) continue;
      const parts = key.split('_');
      const baseCode = parts[0];
      const keyUpper = key.toUpperCase();
      const gender = genderOfKey(key);

      // Chave agregada sem gênero, mas o código TEM chaves por gênero → ignorar
      if (!gender && basesWithGender.has(baseCode)) continue;

      const hasColor = keyUpper.includes('_PRETA') || keyUpper.includes('_BRANCA') || keyUpper.includes('_BEGE');

      if (gender && hasColor) {
        // APC: preservar gênero + cor (PRETA→Preto, BRANCA→Branco, BEGE→Bege)
        const colorPart = parts.find(p => APC_COLOR_MAP[p.toUpperCase()]);
        const color = colorPart ? APC_COLOR_MAP[colorPart.toUpperCase()] : parts[parts.length - 1];
        appendUnique(out, `${baseCode}_${gender}_${color}`, urls);
      } else {
        // Normal: cada gênero no SEU código
        const suffix = gender === 'FEM' ? 'BL' : gender === 'INF' ? 'I' : '';
        appendUnique(out, baseCode + suffix, urls);
      }
    }
    return out;
  }

  return { genderOfKey, registerBlockUrls, normalizeForWizard };
});
