(function () {
  'use strict';

  window.AutopilotModules = window.AutopilotModules || {};

  // Dependencies
  const State = window.AutopilotModules.State;
  const Registry = window.AutopilotModules.Registry;
  const { isUniqueProduct } = Registry;

  // ───────── Code Generation ─────────

  function generateCodesForGroup(group) {
    const codes = [];
    const isGroupAPC = group.productType === 'APC';

    if (group.codeMode === 'range') {
      const s = (group.codeStart || '').trim();
      const e = (group.codeEnd || '').trim();
      if (!s || !e) return codes;

      const matchS = s.match(/^([A-Za-z]+)(\d+)$/);
      const matchE = e.match(/(\d+)$/);
      if (!matchS || !matchE) return codes;

      const prefix   = matchS[1];
      const startNum = parseInt(matchS[2], 10);
      const endNum   = parseInt(matchE[1], 10);
      const padLen   = matchS[2].length;

      if (endNum < startNum) return codes;
      if (endNum - startNum > 999) return codes;

      for (let i = startNum; i <= endNum; i++) {
        const base = prefix + String(i).padStart(padLen, '0');
        if (isGroupAPC) {
          codes.push({ base, masc: base, fem: null, inf: null, _isAPC: true, productType: group.productType, _groupId: group.id });
        } else if (isUniqueProduct(group.productType)) {
          codes.push({ base, masc: base, fem: null, inf: null, productType: group.productType, _groupId: group.id });
        } else {
          codes.push({
            base,
            masc: group.genders.masc ? base : null,
            fem:  group.genders.fem  ? base + group.femSuffix : null,
            inf:  group.genders.inf  ? base + group.infSuffix : null,
            productType: group.productType,
            _groupId: group.id,
          });
        }
      }
    } else {
      const lines = (group.manualCodes || '').split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach(base => {
        if (isGroupAPC) {
          codes.push({ base, masc: base, fem: null, inf: null, _isAPC: true, productType: group.productType, _groupId: group.id });
        } else if (isUniqueProduct(group.productType)) {
          codes.push({ base, masc: base, fem: null, inf: null, productType: group.productType, _groupId: group.id });
        } else {
          codes.push({
            base,
            masc: group.genders.masc ? base : null,
            fem:  group.genders.fem  ? base + group.femSuffix : null,
            inf:  group.genders.inf  ? base + group.infSuffix : null,
            productType: group.productType,
            _groupId: group.id,
          });
        }
      });
    }
    return codes;
  }

  function generateAllCodes() {
    const allCodes = [];
    State.state.productGroups.forEach(group => {
      allCodes.push(...generateCodesForGroup(group));
    });
    return allCodes;
  }

  function generateCodes() {
    return generateAllCodes();
  }

  window.AutopilotModules.CodeGen = {
    generateCodesForGroup,
    generateAllCodes,
    generateCodes,
  };
})();
