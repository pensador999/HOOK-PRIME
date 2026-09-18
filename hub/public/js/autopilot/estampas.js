(function(modules) {
  // ───────── Banco de Estampas SEO ─────────
  // ═══════════════════════════════════════
  // ESTAMPA BANK — Nomes reais do catálogo BRK + criativos
  // Regra: bom nome, 1-4 palavras, descritivo e comercial
  // ═══════════════════════════════════════
  const ESTAMPA_BANK = {
    fishing: {
      names: [
        // Espécies (padrão BRK real)
        'Tucunaré', 'Tucunaré Açu', 'Tucunaré Azul', 'Tucunaré Clean',
        'Dourado', 'Dourado Laranja', 'Dourado Escama',
        'Robalo', 'Robalo Flecha', 'Robalo Combat Fish',
        'Pintado', 'Pintado Brasil', 'Pintado Rio',
        'Traíra', 'Trairão River Monster', 'Traíra Galo',
        'Tambaqui', 'Tambaqui Hulk', 'Pirarara', 'Pirarara Waves',
        'Cachara', 'Matrinxã', 'Corvina', 'Pirarucu', 'Pirarucu Amazon',
        'Surubim', 'Pacu', 'Piracanjuba', 'Tilápia',
        'Anchova', 'Marlin', 'Atum', 'Black Bass',
        'Barracuda', 'Xaréu', 'Garoupa', 'Tainha', 'Tarpon',
        // Temas
        'Fundo do Mar', 'Mar Azul', 'Rio Solimões', 'Rio Negro',
        'Floresta Tropical', 'Oceano', 'Coral Reef', 'Mangue',
        'Amazon Arara Azul', 'Amazon Onça Pintada',
        // Estilos
        'Camuflado Digital', 'Camuflado Pantanal', 'Degradê Vinho',
        'Degradê Azul', 'Black Edition', 'Maori', 'Tribal',
        'Offshore Gear', 'Deep Sea', 'Brasil Patriota'
      ]
    },
    agro: {
      names: [
        // Raças (padrão BRK Agro real)
        'Nelore', 'Nelore Black', 'Nelore Country',
        'Angus', 'Angus Preto', 'Brahman', 'Charolês',
        'Tabapuã', 'Mangalarga', 'Guzerá', 'Senepol',
        // Temas rurais
        'Comitiva', 'Pantanal', 'Rodeio', 'Rodeio Country',
        'Vaquejada', 'Boiadeiro', 'Sertanejo', 'Tropeiro',
        'Lida Bruta', 'Pampa', 'Campeiro', 'Peão',
        'Safra', 'Estância', 'Colheita', 'Fazenda', 'Curral',
        'Team Roping', 'Laço e Tradição', 'Mini Boiadeiro',
        // Estilos
        'Country Classic', 'Western', 'Ranch Life', 'Terra Firme',
        'Raízes', 'Sertão', 'Brasil é Agro',
        'São Bento', 'Nossa Senhora Aparecida'
      ]
    },
    motors: {
      names: [
        // Modalidades (padrão BRK Motors real)
        'Motocross', 'Enduro', 'Enduro Verde', 'Big Trail',
        'Big Trail Adventure', 'Rally', 'Rally Laranja',
        'Superbike', 'Café Racer', 'Scrambler', 'Dakar',
        // Temas
        'Skull Rider', 'Dark Ride', 'Chrome', 'Nitro',
        'Carbon Tech', 'Carbon Black', 'Torque', 'Burnout',
        'Racing', 'Racing Black', 'Full Speed', 'Asphalt',
        // Estilos
        'Off Road', 'Iron Ride', 'Dark Road', 'Flat Track',
        'Vortex', 'Ignition', 'Thunder Road', 'Dust Trail'
      ]
    }
  };

  const USED_ESTAMPAS_KEY = 'hook-prime-used-estampas';

  // ═══════════════════════════════════════
  // Palavras proibidas nos nomes de estampa
  // ═══════════════════════════════════════
  const AVOID_WORDS = [
    'camisa', 'camiseta', 'pesca', 'brk', 'fishing', 'proteção', 'protecao',
    'uv50', 'uv', 'masculina', 'feminina', 'infantil', 'agro', 'motors',
    'bandana', 'tubeneck', 'lenço', 'boné', 'manga', 'longa', 'curta'
  ];

  function getUsedEstampas() {
    try { return JSON.parse(localStorage.getItem(USED_ESTAMPAS_KEY) || '[]'); } catch { return []; }
  }
  function addUsedEstampa(name) {
    const used = getUsedEstampas();
    if (!used.includes(name)) { used.push(name); localStorage.setItem(USED_ESTAMPAS_KEY, JSON.stringify(used)); }
  }

  function generateEstampaName(brandKey, usedNames) {
    const bank = ESTAMPA_BANK[brandKey] || ESTAMPA_BANK.fishing;
    const allUsed = [...getUsedEstampas(), ...(usedNames || [])];
    const available = bank.names.filter(n => !allUsed.includes(n));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    return `Estampa ${Date.now().toString(36).toUpperCase()}`;
  }

  function generateEstampaNames(brandKey, count) {
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(generateEstampaName(brandKey, names));
    }
    return names;
  }

  /**
   * Valida um nome de estampa contra as regras BRK
   * @param {string} name - Nome da estampa
   * @returns {{ valid: boolean, issues: string[], cleaned: string }}
   */
  function validateEstampa(name) {
    const issues = [];
    let cleaned = (name || '').trim();

    if (!cleaned) return { valid: false, issues: ['Nome vazio'], cleaned: '' };

    // Remover palavras proibidas
    const words = cleaned.split(' ');
    const filtered = words.filter(w => !AVOID_WORDS.includes(w.toLowerCase()));
    if (filtered.length < words.length) {
      issues.push(`Removidas palavras proibidas: ${words.filter(w => AVOID_WORDS.includes(w.toLowerCase())).join(', ')}`);
      cleaned = filtered.join(' ') || cleaned; // Manter original se tudo foi filtrado
    }

    // Verificar tamanho
    const wordCount = cleaned.split(' ').length;
    if (wordCount > 4) {
      issues.push(`Muito longo (${wordCount} palavras, máx 4)`);
      cleaned = cleaned.split(' ').slice(0, 4).join(' ');
    }

    // Title Case
    cleaned = cleaned.split(' ').map(w => {
      if (['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'em', 'no', 'na'].includes(w.toLowerCase())) return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');

    return { valid: issues.length === 0, issues, cleaned };
  }

  /**
   * Remove duplicatas de um array de estampas
   * @param {Object} estampas - Mapa { code: estampaName }
   * @returns {{ duplicates: string[], unique: Object }}
   */
  function deduplicateEstampas(estampas) {
    const seen = {};
    const duplicates = [];
    const unique = {};

    for (const [code, name] of Object.entries(estampas)) {
      const normalized = (name || '').trim().toLowerCase();
      if (!normalized) { unique[code] = name; continue; }

      if (seen[normalized]) {
        duplicates.push(`${code} = "${name}" (duplica ${seen[normalized]})`);
        // Gerar nome alternativo
        unique[code] = name + ' ' + code.slice(-2);
      } else {
        seen[normalized] = code;
        unique[code] = name;
      }
    }

    return { duplicates, unique };
  }

  modules.Estampas = {
    ESTAMPA_BANK,
    AVOID_WORDS,
    getUsedEstampas,
    addUsedEstampa,
    generateEstampaName,
    generateEstampaNames,
    validateEstampa,
    deduplicateEstampas,
  };
})(window.AutopilotModules = window.AutopilotModules || {});

