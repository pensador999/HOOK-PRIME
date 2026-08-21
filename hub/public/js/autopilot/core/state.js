(function () {
  'use strict';

  window.AutopilotModules = window.AutopilotModules || {};

  // ───────── Constantes ─────────

  const TIFFANY   = '#7F00FF';
  const TIFFANY_S = '#A855F7';
  const TIFFANY_D = '#5B21B6';

  const STEP_LABELS = [
    'Configuração',
    'Pastas & Imagens',
    'Links de Imagens',
    'Revisão Estampas',
    'Planilha Final',
    'Exportar',
  ];

  const BRANDS = ['BRK FISHING', 'BRK AGRO', 'Brk Motors'];

  const PRODUCT_TYPE_COLORS = {
    'Raglan': '#3b82f6', 'Camisa UV': '#06b6d4', 'FusionX': '#8b5cf6', 'ArmorX': '#d946ef',
    'Hybrid': '#a855f7', 'Capuz': '#6366f1', 'APC': '#f59e0b',
    'Casual': '#14b8a6', 'Corta-Vento': '#ef4444', 'BlackMask': '#6b7280',
    'Bandana': '#ec4899', 'Tubeneck': '#7C3AED', 'Motociclismo': '#f97316',
  };

  let state = {};
  let groupIdCounter = 1;

  function createDefaultGroup(id) {
    return {
      id: id || ++groupIdCounter,
      productType: 'Raglan',
      codeMode: 'range',
      codeStart: '',
      codeEnd: '',
      manualCodes: '',
      genders: { masc: true, fem: false, inf: false },
      femSuffix: 'BL',
      infSuffix: 'I',
      estampaName: '',
      expanded: true,
      // APC-specific
      apcColors: { Preto: true, Branco: true, Bege: true },
      apcPrefix: '',
    };
  }

  function resetState() {
    groupIdCounter = 1;
    // Clear and rebuild to preserve object reference
    for (const k in state) delete state[k];
    Object.assign(state, {
      currentStep: 1,
      completedSteps: new Set(),
      // Product Groups — each group has its own config
      productGroups: [
        createDefaultGroup(1),
      ],
      // Global settings (shared across all groups)
      brand: 'BRK FISHING',
      erp: 'bling',
      price: '',
      costPrice: '55',
      pricePerGender: false,
      priceMasc: '',
      priceFem: '',
      priceInf: '129.90',
      description: '',
      generatedCodes: [],
      // Step 2
      networkPath: '',
      networkScanResult: null,
      networkCopyResult: null,
      localWorkingPath: '',
      autoRename: true,
      folderData: {},
      diskFolderPath: '',
      diskScanResult: null,
      folderSummary: { codesFound: 0, totalImages: 0, masc: 0, fem: 0, inf: 0 },
      // Step 3
      imageUrls: {},
      linkFilter: 'all',
      // Step 4 — Estampa Review
      estampas: {},
      estampaSuggestions: {},
      // Step 5
      csvRows: [],
      // Step 6
      exported: false,
    });
  }
  resetState();

  // Backward-compat helpers
  function getFirstGroup() { return state.productGroups[0] || createDefaultGroup(); }
  function getGroupById(id) { return state.productGroups.find(g => g.id === id); }

  // ───────── #12 Theme Toggle ─────────
  let currentTheme = localStorage.getItem('hub-theme') || 'dark';
  function applyTheme(t) {
    currentTheme = t;
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('hub-theme', t);
  }
  applyTheme(currentTheme);

  // ───────── #3 Auto-save / Restore ─────────
  const SAVE_KEY = 'autopilot-session';

  function saveSession() {
    try {
      const toSave = { ...state };
      // Can't serialize File objects and Sets
      delete toSave.folderData;
      delete toSave.folderSummary;
      delete toSave.csvRows;
      toSave.completedSteps = [...state.completedSteps];
      localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
    } catch (e) { /* ignore */ }
  }

  function restoreSession() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || (!saved.productGroups && !saved.codeStart && !saved.manualCodes)) return false;
      Object.assign(state, saved);
      state.completedSteps = new Set(saved.completedSteps || []);
      // Reset non-serializable
      state.folderData = {};
      state.folderSummary = { codesFound: 0, totalImages: 0, masc: 0, fem: 0, inf: 0 };
      state.csvRows = [];
      // Ensure productGroups exist (migration from old sessions)
      if (!state.productGroups || !state.productGroups.length) {
        state.productGroups = [createDefaultGroup(1)];
        const g = state.productGroups[0];
        if (saved.codeStart) g.codeStart = saved.codeStart;
        if (saved.codeEnd) g.codeEnd = saved.codeEnd;
        if (saved.codeMode) g.codeMode = saved.codeMode;
        if (saved.manualCodes) g.manualCodes = saved.manualCodes;
        if (saved.productType) g.productType = saved.productType;
        if (saved.genders) g.genders = saved.genders;
        if (saved.femSuffix) g.femSuffix = saved.femSuffix;
        if (saved.infSuffix) g.infSuffix = saved.infSuffix;
        if (saved.estampaName) g.estampaName = saved.estampaName;
        if (saved.apcColors) g.apcColors = saved.apcColors;
        if (saved.apcPrefix) g.apcPrefix = saved.apcPrefix;
      }
      groupIdCounter = Math.max(...state.productGroups.map(g => g.id), 0) + 1;
      // Regenerate codes
      state.generatedCodes = []; // CodeGen will regenerate after restore
      return true;
    } catch (e) { return false; }
  }

  function clearSession() {
    localStorage.removeItem(SAVE_KEY);
  }

  // ───────── #9 Export History ─────────
  const HISTORY_KEY = 'autopilot-export-history';
  function getExportHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }
  function addExportHistory(entry) {
    const h = getExportHistory();
    h.unshift(entry);
    if (h.length > 50) h.length = 50;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }

  window.AutopilotModules.State = {
    STEP_LABELS, BRANDS, PRODUCT_TYPE_COLORS,
    TIFFANY, TIFFANY_S, TIFFANY_D,
    state,  // the shared state object reference
    createDefaultGroup, resetState, getFirstGroup, getGroupById,
    currentTheme, applyTheme,
    saveSession, restoreSession, clearSession,
    getExportHistory, addExportHistory,
    SAVE_KEY, HISTORY_KEY,
    get groupIdCounter() { return groupIdCounter; },
    set groupIdCounter(v) { groupIdCounter = v; },
  };
})();
