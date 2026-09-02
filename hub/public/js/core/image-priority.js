/* ═══════════════════════════════════════════════════════════════
 *  HOOK PRIME — Image Priority (Frontend Shared Module)
 *  
 *  FONTE ÚNICA de getImagePriority para todo o frontend.
 *  Backend usa hub/config/image-utils.js (mesma lógica).
 *  
 *  Uso: window.HUB.getImagePriority(fileName) → number
 *  ═══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  /**
   * Retorna a prioridade de ordenação de uma imagem com base no nome do arquivo.
   * Menor número = mais prioritário.
   * 
   * @param {string} fileName - Nome do arquivo (com ou sem extensão)
   * @returns {number} Prioridade
   */
  function getImagePriority(fileName) {
    const name = fileName.toUpperCase().replace(/\.[^.]+$/, '');

    // Numéricos puros (1.jpg, 02.jpg) → extras no final
    if (/^\d+$/.test(name.trim())) return 900 + parseInt(name.trim());

    // Detectar categorias pelo nome do arquivo
    const isFrente  = /FRENTE/.test(name);
    const isCostas  = /COSTA/.test(name);
    const isCorpo   = /CORPO/.test(name);
    const isCinto   = /CINTO/.test(name);
    const isChapeu  = /CHAP/.test(name);
    const isSolta   = /SOLTA/.test(name);
    const isDetalhe = /DETALHE|DETAIL/.test(name);
    const isGola    = /GOLA/.test(name);
    const isLogo    = /LOGO/.test(name);
    const isManga   = /MANGA|PULSO/.test(name);
    const isPerspec = /PERSPEC|PERSPECTIVA/.test(name);
    const isZoom    = /ZOOM/.test(name);
    const isPesp    = /PESP/.test(name);
    const hasAcessorio = isCinto || isChapeu;

    // Extrair sufixo numérico para sub-ordenação
    const numMatch = name.match(/(\d+)/);
    const numSub   = numMatch ? parseInt(numMatch[1]) * 0.01 : 0;

    // ── DETALHES (checar primeiro)
    if (isDetalhe && isGola)    return 700 + numSub;
    if (isDetalhe && isCostas)  return 710 + numSub;
    if (isDetalhe && isLogo)    return 720 + numSub;
    if (isDetalhe && isManga)   return 730 + numSub;
    if (isDetalhe)             return 750 + numSub;

    // ── FRENTE (posição 1–2)
    if (isFrente && hasAcessorio && !isPerspec) return 100 + numSub;
    if (isFrente && isSolta)                    return 200 + numSub;
    if (isFrente && isPerspec)                  return 250 + numSub;
    if (isFrente)                               return 150 + numSub;

    // ── COSTAS (posição 3–4)
    if (isCostas && hasAcessorio && !isPerspec) return 300 + numSub;
    if (isCostas && isSolta)                    return 400 + numSub;
    if (isCostas && isPerspec)                  return 450 + numSub;
    if (isCostas)                               return 350 + numSub;

    // ── CORPO (posição 5)
    if (isCorpo && hasAcessorio) return 500 + numSub;
    if (isCorpo)                return 510 + numSub;

    // ── ZOOM
    if (isZoom) return 600 + numSub;

    // ── CHAPÉU/CINTO combos
    if (isChapeu || isCinto) return 620 + numSub;

    // ── PESP
    if (isPesp) return 700 + numSub;

    // ── FALLBACK
    return 800 + numSub;
  }

  // Expor globalmente
  window.HUB = window.HUB || {};
  window.HUB.getImagePriority = getImagePriority;
})();
