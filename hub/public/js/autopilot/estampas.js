(function(modules) {
  // ───────── Banco de Estampas SEO ─────────
  // ═══════════════════════════════════════
  // ESTAMPA BANK — Nomes de 1-2 palavras (máximo), sem cores
  // Regra: bom nome, composto, inglês ou português, NUNCA repete título (a menos que mude cor da camisa)
  // ═══════════════════════════════════════
  const ESTAMPA_BANK = {
    fishing: {
      // Peixes / fauna marinha (PT para coleções Brasil, EN para genéricas)
      names: [
        'Tucunaré', 'Dourado', 'Peacock Bass', 'Robalo', 'Traíra', 'Pintado',
        'Tambaqui', 'Pirarara', 'Cachara', 'Matrinxã', 'Corvina', 'Tainha',
        'Pirarucu', 'Surubim', 'Pacu', 'Piracanjuba', 'Tilápia', 'Anchova',
        'Marlin', 'Atum', 'Barracuda', 'Xaréu', 'Salmão', 'Garoupa',
        'Deep Sea', 'Ocean Storm', 'Reef Hunter', 'Tide Runner', 'Wild Cast',
        'Night Catch', 'River King', 'Hook Master', 'Open Water', 'Cast Away',
        'Shadow Fish', 'Big Game', 'River Drift', 'Salt Water', 'Iron Cast',
        'Dark Reef', 'Silent Bite', 'Gold Strike', 'Thunder Bait', 'Splash',
        'Steel Hook', 'Moon Tide', 'Sun Cast', 'Storm Bay', 'Bone Fish',
        'Sea Wolf', 'Coral Reef', 'Sharp Fin', 'Fast Line', 'Deep Strike'
      ]
    },
    agro: {
      // Agro / pecuária / campo
      names: [
        'Nelore', 'Mangalarga', 'Comitiva', 'Charolês', 'Pantanal', 'Rodeio',
        'Boiadeiro', 'Angus', 'Zebu', 'Brahman', 'Tabapuã', 'Cerrado',
        'Tropeiro', 'Vaquejada', 'Cavalos', 'Curraleira', 'Sertão',
        'Ranch Life', 'Trail Ride', 'Iron Horse', 'Wild Country', 'Dust Road',
        'Longhorn', 'Bull Rider', 'Night Ride', 'Open Range', 'Frontier',
        'Dark Ranch', 'Gold Spur', 'Steel Rope', 'Camp Fire', 'Red Dust',
        'Lida Bruta', 'Pampa', 'Campeiro', 'Peão', 'Safra', 'Estância',
        'Terra Firme', 'Raízes', 'Sol Quente', 'Amanhecer', 'Colheita',
        'Serra Forte', 'Boiada', 'Canavial', 'Fazenda', 'Curral'
      ]
    },
    motors: {
      // Motociclismo / velocidade / aventura
      names: [
        'Off Road', 'Big Trail', 'Enduro', 'Motocross', 'Speedway',
        'Rally', 'Superbike', 'Scrambler', 'Café Racer', 'Dakar',
        'Sprint', 'Grand Prix', 'Tracker', 'Bobber', 'Cruiser',
        'Iron Ride', 'Dark Road', 'Nitro Rush', 'Chrome Skull', 'Steel Grip',
        'Thunder Road', 'Apex Turn', 'Torque', 'Burnout', 'Asphalt',
        'Carbon', 'Titanium', 'Vortex', 'Night Ride', 'Ignition',
        'Full Speed', 'Road King', 'Pit Stop', 'Pole Position', 'Free Ride',
        'Rev Up', 'Dust Trail', 'Gas Tank', 'Wild Ride', 'Fast Lane',
        'Gear Shift', 'Black Moto', 'Red Line', 'Dead Heat', 'Flat Track'
      ]
    }
  };

  const USED_ESTAMPAS_KEY = 'hook-prime-used-estampas';

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
    // Sorteia um nome do banco que ainda não foi usado
    const available = bank.names.filter(n => !allUsed.includes(n));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // Fallback: timestamp-based
    return `Estampa ${Date.now().toString(36).toUpperCase()}`;
  }

  function generateEstampaNames(brandKey, count) {
    const names = [];
    for (let i = 0; i < count; i++) {
      names.push(generateEstampaName(brandKey, names));
    }
    return names;
  }

  modules.Estampas = {
    ESTAMPA_BANK,
    getUsedEstampas,
    addUsedEstampa,
    generateEstampaName,
    generateEstampaNames,
  };
})(window.AutopilotModules = window.AutopilotModules || {});
