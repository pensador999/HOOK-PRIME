(function(modules) {
  // ───────── Catálogo de Produtos ─────────
  const PRODUCT_CATALOG = {
   variation: [
      { value: 'FusionX',         label: 'FusionX (FUSION)',              icon: '👕' },
      { value: 'ArmorX',          label: 'ArmorX (CAX)',                  icon: '👕' },
      { value: 'Camisa UV',       label: 'Camisa UV (Manga Longa)',       icon: '👕' },
      { value: 'Hybrid',          label: 'Hybrid',                        icon: '🧥' },
      { value: 'Capuz',           label: 'Capuz',                         icon: '🧥' },
      { value: 'Corta-Vento',     label: 'Corta-Vento',                   icon: '🌬️' },
      { value: 'APC',             label: 'APC (Algodão)',                 icon: '👔' },
      { value: 'Casual',          label: 'Casual (CADV)',                 icon: '👕' },
      { value: 'Motociclismo',    label: 'Motociclismo (ADV)',            icon: '🏍️' },
      { value: 'Raglan',          label: 'Raglan',                        icon: '👕' },
    ],
    unique: [
      { value: 'BlackMask',      label: 'BlackMask',         icon: '🎭' },
      { value: 'Tubeneck',       label: 'Tubeneck',          icon: '🧣' },
      { value: 'Bandana',        label: 'Bandana',           icon: '🧣' },
      { value: 'Boné',           label: 'Boné (BA0)',        icon: '🧢' },
      { value: 'Lenço Cetim',    label: 'Lenço de Cetim (LC)', icon: '🎀' },
      { value: 'Lenço',          label: 'Lenço Normal (LEN)', icon: '🧶' },
      { value: 'Copo Térmico',   label: 'Copo Térmico (CPT)', icon: '🥤' },
      { value: 'Capa Almofada',  label: 'Capa de Almofada (CPA)', icon: '🛋️' },
      { value: 'Caneca',         label: 'Caneca (CANECA)',   icon: '☕' },
    ]
  };

  function isUniqueProduct(type) {
    return PRODUCT_CATALOG.unique.some(p => p.value === type);
  }

  // Size grids per product type + gender
  // Camisas: PP,P,M,G,GG,G1,G2 para TODOS os gêneros
  // Acessórios: Unico
  const SHIRT_SIZES = ['PP','P','M','G','GG','G1','G2'];
  const APC_SIZES = ['P','M','G','GG','G1','G2']; // APC não usa PP
  const SIZE_MAP = {
    'Raglan':          { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'Camisa UV':       { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'FusionX':         { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'ArmorX':          { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'Hybrid':          { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'Capuz':           { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'APC':             { masc: APC_SIZES,   fem: APC_SIZES,   inf: APC_SIZES },
    'Casual':          { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'Corta-Vento':     { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'Motociclismo':    { masc: SHIRT_SIZES, fem: SHIRT_SIZES, inf: SHIRT_SIZES },
    'BlackMask':       { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Bandana':         { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Tubeneck':        { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Boné':            { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Lenço Cetim':     { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Lenço':           { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Copo Térmico':    { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Capa Almofada':   { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
    'Caneca':          { masc: ['Unico'],   fem: ['Unico'],   inf: ['Unico'] },
  };

  const NCM_MAP = {
    masc: '6101.30.00',
    fem:  '6102.30.00',
    inf:  '6101.30.00',
  };

  // APC-specific colors
  const APC_COLORS = ['Preto', 'Branco', 'Bege'];
  const APC_COLOR_SUFFIX = { Preto: '', Branco: 'BL', Bege: 'BG' };
  const APC_COLOR_DISPLAY = { Preto: '⬛ Preto', Branco: '⬜ Branco', Bege: '🟫 Bege' };
  const APC_COLOR_CSS = { Preto: '#374151', Branco: '#e5e7eb', Bege: '#d4a574' };

  // Product type title templates per brand family
  const PRODUCT_TITLE_MAP = {
    'Raglan':          { fishing: 'Camisa de Pesca Brk', agro: 'Camisa BRK Agro', motors: 'Camisa BRK Motors' },
    'Camisa UV':       { fishing: 'Camisa de Pesca Brk', agro: 'Camisa BRK Agro', motors: 'Camisa BRK Motors' },
    'FusionX':         { fishing: 'Camisa FusionX', agro: 'Camisa FusionX', motors: 'Camisa FusionX' },
    'ArmorX':          { fishing: 'Camisa ArmorX', agro: 'Camisa ArmorX', motors: 'Camisa ArmorX' },
    'Hybrid':          { fishing: 'Camisa Hybrid de Pesca Brk', agro: 'Camisa Hybrid BRK Agro', motors: 'Camisa Hybrid BRK Motors' },
    'Capuz':           { fishing: 'Camisa com Capuz de Pesca Brk', agro: 'Camisa com Capuz BRK Agro', motors: 'Camisa com Capuz BRK Motors' },
    'Corta-Vento':     { fishing: 'Corta Vento de Pesca Brk', agro: 'Corta Vento BRK Agro', motors: 'Corta Vento BRK Motors' },
    'BlackMask':       { fishing: 'Black Mask de Pesca Brk', agro: 'Black Mask BRK Agro', motors: 'Black Mask BRK Motors' },
    'Bandana':         { fishing: 'Bandana de Pesca Brk', agro: 'Bandana BRK Agro', motors: 'Bandana BRK Motors' },
    'Tubeneck':        { fishing: 'Tubeneck de Pesca Brk', agro: 'Tubeneck BRK Agro', motors: 'Tubeneck BRK Motors' },
    'APC':             { fishing: 'Camiseta Básica de Algodão Brk', agro: 'Camiseta Básica de Algodão BRK Agro', motors: 'Camiseta Básica de Algodão BRK Motors' },
    'Casual':          { fishing: 'Camiseta Casual Brk', agro: 'Camiseta Casual BRK Agro', motors: 'Camiseta Casual BRK Motors' },
    'Motociclismo':    { fishing: 'Camisa de Motociclismo Brk', agro: 'Camisa de Motociclismo BRK Agro', motors: 'Camisa de Motociclismo BRK Motors' },
    'Boné':            { fishing: 'Boné BRK Fishing', agro: 'Boné BRK Agro', motors: 'Boné BRK Motors' },
    'Lenço Cetim':     { fishing: 'Lenço de Cetim BRK Fishing', agro: 'Lenço de Cetim BRK Agro', motors: 'Lenço de Cetim BRK Motors' },
    'Lenço':           { fishing: 'Lenço BRK Fishing', agro: 'Lenço BRK Agro', motors: 'Lenço BRK Motors' },
    'Copo Térmico':    { fishing: 'Copo Térmico BRK Fishing', agro: 'Copo Térmico BRK Agro', motors: 'Copo Térmico BRK Motors' },
    'Capa Almofada':   { fishing: 'Capa de Almofada BRK Fishing', agro: 'Capa de Almofada BRK Agro', motors: 'Capa de Almofada BRK Motors' },
    'Caneca':          { fishing: 'Caneca BRK Fishing', agro: 'Caneca BRK Agro', motors: 'Caneca BRK Motors' },
  };

  function sizesFor(gender, productType) {
    const pt = productType || 'FusionX';
    if (isUniqueProduct(pt)) return [''];
    const map = SIZE_MAP[pt];
    return map ? (map[gender] || []) : [];
  }

  function isProductAPC(type) {
    return type === 'APC';
  }

  function buildProductTitle(productType, brand, estampa, gender) {
    const est = estampa || '*ESTAMPA A SER DEFINIDA';
    const brandKey = brand.toLowerCase().includes('agro') ? 'agro'
      : brand.toLowerCase().includes('motor') ? 'motors' : 'fishing';
    const genderStr = gender === 'fem' ? ' Feminina' : gender === 'inf' ? ' Infantil' : '';

    const NO_UV_TYPES = ['Boné', 'Lenço Cetim', 'Lenço', 'Copo Térmico', 'Capa Almofada', 'Caneca', 'APC'];
    const uvSuffix = NO_UV_TYPES.includes(productType) ? '' : ' com Proteção UV50+';

    // ArmorX: "Camisa ArmorX{Feminina} ESTAMPA com Luva e Proteção UV50+"
    if (productType === 'ArmorX') {
      const armorSuffix = NO_UV_TYPES.includes(productType) ? '' : ' com Luva e Proteção UV50+';
      return `Camisa ArmorX${genderStr} ${est}${armorSuffix}`;
    }
    // FusionX: "Camisa FusionX{Feminina} ESTAMPA com Proteção UV50+" (sem Brk)
    if (productType === 'FusionX') {
      return `Camisa FusionX${genderStr} ${est}${uvSuffix}`;
    }
    // Motors: "Camisa BRK Motors{Masculina} ESTAMPA com Proteção UV50+"
    if (brandKey === 'motors') {
      const titleMap = PRODUCT_TITLE_MAP[productType] || PRODUCT_TITLE_MAP['Raglan'];
      const base = titleMap.motors || titleMap.fishing;
      return `${base}${genderStr} ${est}${uvSuffix}`;
    }
    // Agro: "Camisa BRK Agro{Masculina} ESTAMPA com Proteção UV50+"
    if (brandKey === 'agro') {
      const titleMap = PRODUCT_TITLE_MAP[productType] || PRODUCT_TITLE_MAP['Raglan'];
      const base = titleMap.agro || titleMap.fishing;
      return `${base}${genderStr} ${est}${uvSuffix}`;
    }
    // Fishing (default): "Camisa de Pesca Brk{Feminina} ESTAMPA com Proteção UV50+"
    const titleMap = PRODUCT_TITLE_MAP[productType] || PRODUCT_TITLE_MAP['Raglan'];
    const base = titleMap.fishing;
    const parts = base.split('Brk');
    if (parts.length === 2) {
      return `${parts[0].trim()} Brk${genderStr}${parts[1]} ${est}${uvSuffix}`;
    }
    return `${base}${genderStr} ${est}${uvSuffix}`;
  }

  modules.Registry = {
    PRODUCT_CATALOG,
    SIZE_MAP,
    NCM_MAP,
    APC_COLORS,
    APC_COLOR_SUFFIX,
    APC_COLOR_DISPLAY,
    APC_COLOR_CSS,
    APC_SIZES,
    SHIRT_SIZES,
    PRODUCT_TITLE_MAP,
    isUniqueProduct,
    sizesFor,
    isProductAPC,
    buildProductTitle,
  };
})(window.AutopilotModules = window.AutopilotModules || {});
