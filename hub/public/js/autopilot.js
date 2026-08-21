/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Lucas RTX (Wizard 5 Etapas)
   Automação completa: Códigos → Pastas → Links → Planilha → Export
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ═══ Módulos (carregados via <script> antes deste arquivo) ═══
  const Modules  = window.AutopilotModules || {};
  const Registry = Modules.Registry || {};
  const Estampas = Modules.Estampas || {};
  const APCModule = Modules.APC || {};
  const VariationModule = Modules.Variation || {};
  const UniqueModule = Modules.Unique || {};

  // ───────── Constantes ─────────

  const TIFFANY   = '#7F00FF';
  const TIFFANY_S = '#A855F7';
  const TIFFANY_D = '#5B21B6';

  // ───────── Catálogo de Produtos (fonte única: registry.js) ─────────
  const R = window.AutopilotModules.Registry;
  const { PRODUCT_CATALOG, SIZE_MAP, NCM_MAP, APC_COLORS, APC_COLOR_SUFFIX,
          APC_COLOR_DISPLAY, APC_COLOR_CSS, PRODUCT_TITLE_MAP, SHIRT_SIZES,
          APC_SIZES, isUniqueProduct, buildProductTitle } = R;

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

  function isAPC() { return getFirstGroup().productType === 'APC'; }
  function activeApcColors(group) { const g = group || getFirstGroup(); return APC_COLORS.filter(c => g.apcColors && g.apcColors[c]); }

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
    state = {
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
    };
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
      state.generatedCodes = generateAllCodes();
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

  // ───────── Helpers ─────────

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // #5 Load size-patterns from API
  let sizeConfig = null;
  async function loadSizeConfig() {
    if (sizeConfig) return sizeConfig;
    try {
      const res = await fetch('/api/config/sizes');
      sizeConfig = await res.json();
    } catch { sizeConfig = {}; }
    return sizeConfig;
  }
  loadSizeConfig(); // fire-and-forget preload

  function getWeightForSize(productType, gender, size) {
    if (!sizeConfig || !sizeConfig.peso_por_tamanho) return '0,250';
    const ptKey = productType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-\s]+/g, '_').replace('camisa_uv_luva', 'camisa_uv_luva').replace('camisa_uv', 'raglan');
    const pesos = sizeConfig.peso_por_tamanho;

    // 1. Try gender-specific key first (e.g. raglan_masc, hybrid_fem)
    const genderKey = `${ptKey}_${gender}`;
    if (pesos[genderKey]) {
      const w = pesos[genderKey][size];
      if (w) return w.bruto;
    }

    // 2. Try type key (e.g. raglan, capuz, casual)
    if (pesos[ptKey]) {
      const entry = pesos[ptKey];
      const w = entry[size] || entry['default'];
      if (w) return w.bruto;
    }

    // 3. Legacy fallback for camisa_fem
    if (gender === 'fem' && pesos.camisa_fem) {
      const w = pesos.camisa_fem[size];
      if (w) return w.bruto;
    }

    return '0,250';
  }

  function activeGenders(group) {
    const g = group || getFirstGroup();
    return Object.entries(g.genders).filter(([, v]) => v).map(([k]) => k);
  }

  function genderLabel(g) {
    return { masc: 'MASC', fem: 'FEM', inf: 'INF' }[g] || g;
  }

  function genderColor(g) {
    return { masc: '#3b82f6', fem: '#ec4899', inf: '#f59e0b' }[g] || '#6b7280';
  }

  function sizesFor(gender, productType) {
    const pt = productType || getFirstGroup().productType;
    if (isUniqueProduct(pt)) return [''];
    const map = SIZE_MAP[pt];
    return map ? (map[gender] || []) : [];
  }

  function totalSkuCount() {
    let count = 0;
    state.generatedCodes.forEach(code => {
      if (code._isAPC) {
        const group = state.productGroups.find(g => g.id === code._groupId);
        const colors = group ? activeApcColors(group).length : 1;
        const genders = group ? activeGenders(group).length : 1;
        const sizes = sizesFor('masc', code.productType).length;
        count += colors * sizes * genders;
      } else {
        const group = state.productGroups.find(g => g.id === code._groupId);
        const genders = group ? activeGenders(group) : ['masc'];
        genders.forEach(g => {
          if (code[g]) count += sizesFor(g, code.productType).length;
        });
      }
    });
    return count;
  }

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
    state.productGroups.forEach(group => {
      allCodes.push(...generateCodesForGroup(group));
    });
    return allCodes;
  }

  function generateCodes() {
    return generateAllCodes();
  }

  // ───────── Stepper ─────────

  function renderStepper() {
    let html = '<div class="stepper" style="position:sticky;top:0;z-index:50;background:var(--surface-card,#1e1e2e);padding:20px 0 16px;border-bottom:1px solid rgba(127, 0, 255,.15)">';

    STEP_LABELS.forEach((label, idx) => {
      const num = idx + 1;
      const isActive    = num === state.currentStep;
      const isCompleted = state.completedSteps.has(num);
      const isFuture    = !isActive && !isCompleted;

      let stepClass = 'stepper__step';
      if (isActive)    stepClass += ' active';
      if (isCompleted) stepClass += ' completed';

      const clickable = isCompleted || isActive;

      html += `<div class="${stepClass}" ${clickable ? `data-step="${num}" style="cursor:pointer"` : ''}>`;
      html += `<div class="stepper__circle" style="${isActive ? `box-shadow:0 0 16px ${TIFFANY}80` : ''}">`;
      if (isCompleted) {
        html += '✓';
      } else {
        html += num;
      }
      html += '</div>';
      html += `<span class="stepper__label">${label}</span>`;
      html += '</div>';

      if (num < 6) {
        let lineClass = 'stepper__line';
        if (isCompleted) lineClass += ' completed';
        html += `<div class="${lineClass}"></div>`;
      }
    });

    html += '</div>';
    return html;
  }

  function renderStep1() {
    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- Configurações Globais -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${TIFFANY}">⚙️ Configurações Globais</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <div>
            <label class="form-label">Marca</label>
            <select class="form-input" id="ap-brand">
              ${BRANDS.map(b => `<option value="${b}" ${state.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Preço ${state.pricePerGender ? '(MASC)' : ''}</label>
            <input class="form-input" id="ap-price" type="text" placeholder="189.90" value="${esc(state.price)}" />
          </div>
          <div>
            <label class="form-label">Preço de Custo</label>
            <input class="form-input" id="ap-cost-price" type="text" placeholder="55" value="${esc(state.costPrice)}" />
          </div>
        </div>

        <!-- Preço por gênero -->
        <div style="margin-top:16px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#9ca3af">
            <input type="checkbox" id="ap-price-per-gender" ${state.pricePerGender ? 'checked' : ''} style="accent-color:${TIFFANY}" />
            Preço diferente por gênero
          </label>
          <div id="ap-per-gender-prices" style="display:${state.pricePerGender ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
            <div>
              <label class="form-label" style="color:#ec4899">Preço FEM</label>
              <input class="form-input" id="ap-price-fem" type="text" placeholder="169.90" value="${esc(state.priceFem)}" />
            </div>
            <div>
              <label class="form-label" style="color:#f59e0b">Preço INF</label>
              <input class="form-input" id="ap-price-inf" type="text" placeholder="129.90" value="${esc(state.priceInf)}" />
            </div>
          </div>
        </div>

        <!-- Descrição -->
        <div style="margin-top:16px">
          <label class="form-label">Descrição do Produto</label>
          <input class="form-input" id="ap-description" placeholder="Camisa de Pesca Profissional..." value="${esc(state.description)}" />
        </div>
      </div>

      <!-- Grupos de Produto -->
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;color:${TIFFANY}">📦 Grupos de Produto</h3>
        <span class="badge" style="background:${TIFFANY}20;color:${TIFFANY}">${state.productGroups.length} grupo${state.productGroups.length > 1 ? 's' : ''}</span>
      </div>

      ${state.productGroups.map((group, gIdx) => renderGroupCard(group, gIdx)).join('')}

      <button class="btn btn--secondary" id="ap-add-group" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border:2px dashed rgba(127, 0, 255,.3);background:transparent">
        ➕ Adicionar Grupo de Produto
      </button>

      <!-- Preview Combinado -->
      <div class="card" style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;color:${TIFFANY}">👁️ Preview dos Códigos</h3>
          <span class="badge" id="ap-code-count" style="background:${TIFFANY}20;color:${TIFFANY}">0 códigos</span>
        </div>
        <div class="code-preview" id="ap-code-preview" style="max-height:260px;overflow-y:auto;font-family:monospace;font-size:13px;line-height:2;padding:16px;border-radius:8px;background:rgba(0,0,0,.25)">
          <span style="color:#6b7280">Preencha os campos acima para gerar preview...</span>
        </div>
      </div>

      <!-- Navigation -->
      <div style="display:flex;justify-content:flex-end;gap:12px;padding-bottom:24px">
        <button class="btn btn--primary" id="ap-next-1" style="min-width:180px">Próximo Passo →</button>
      </div>
    </div>`;

    return html;
  }

  function renderGroupCard(group, gIdx) {
    const isGroupAPC = group.productType === 'APC';
    const isRange = group.codeMode === 'range';
    const typeColor = PRODUCT_TYPE_COLORS[group.productType] || '#6b7280';
    const codePreview = group.codeStart ? `${group.codeStart} → ${group.codeEnd || '...'}` : 'Sem códigos';
    const expanded = group.expanded !== false;

    return `
    <div class="card" style="padding:0;border-left:3px solid ${typeColor};overflow:hidden" data-group-id="${group.id}">
      <!-- Header -->
      <div data-toggle-group="${group.id}" style="padding:16px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;transition:background .2s">
        <span style="font-size:18px;transition:transform .3s;transform:rotate(${expanded ? '90' : '0'}deg)">▶</span>
        <span style="background:${typeColor}25;color:${typeColor};padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:.5px">${esc(group.productType)}</span>
        <span style="color:#9ca3af;font-size:13px;font-family:monospace">${esc(codePreview)}</span>
        <span style="color:#6b7280;font-size:12px;margin-left:auto">${activeGenders(group).map(g => genderLabel(g)).join(' · ')}</span>
        ${state.productGroups.length > 1 ? `<button class="btn btn--ghost" data-remove-group="${group.id}" style="color:#ef4444;font-size:13px;padding:4px 10px;margin-left:8px" title="Remover grupo">🗑️</button>` : ''}
      </div>

      <!-- Body -->
      <div style="display:${expanded ? 'block' : 'none'};padding:0 20px 20px;border-top:1px solid rgba(255,255,255,.06)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          <div>
            <label class="form-label">Tipo de Produto</label>
            <select class="form-input ap-group-type" data-group-field="productType" data-group-id="${group.id}" style="font-size:13px">
              <option value="">Selecione...</option>
              <optgroup label="🔀 Com Variação (Grade + Gêneros)">
                ${PRODUCT_CATALOG.variation.map(p => 
                  `<option value="${p.value}" ${group.productType === p.value ? 'selected' : ''}>${p.icon} ${p.label}</option>`
                ).join('')}
              </optgroup>
              <optgroup label="🎯 Únicos (1 Código = 1 SKU)">
                ${PRODUCT_CATALOG.unique.map(p => 
                  `<option value="${p.value}" ${group.productType === p.value ? 'selected' : ''}>${p.icon} ${p.label}</option>`
                ).join('')}
              </optgroup>
            </select>
          </div>
          <div>
            <label class="form-label">🎨 Nome da Estampa</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="form-input" style="flex:1" data-group-field="estampaName" data-group-id="${group.id}" placeholder="Ex: Tucunaré Clean Azul" value="${esc(group.estampaName)}" />
              <button type="button" class="btn btn--primary" data-generate-estampa="${group.id}" style="padding:8px 14px;font-size:13px;white-space:nowrap;background:linear-gradient(135deg,${TIFFANY_D},${TIFFANY});border:none;border-radius:8px;color:#fff;cursor:pointer" title="Gerar nome de estampa automaticamente">🎲 Gerar</button>
            </div>
            <div data-estampa-preview="${group.id}" style="margin-top:6px;font-size:11px;color:${TIFFANY};opacity:0.8;font-style:italic">
              ${group.estampaName ? `Preview: ${buildProductTitle(group.productType, state.brand || 'BRK FISHING', group.estampaName, 'masc')}` : 'Clique em 🎲 Gerar ou digite o nome da estampa'}
            </div>
          </div>
        </div>

        <!-- Code Range -->
        <div style="margin-top:16px">
          <label class="form-label">Range de Códigos</label>
          <div class="tabs" style="max-width:260px;margin-bottom:12px">
            <button class="tabs__btn ${isRange ? 'active' : ''}" data-group-mode="range" data-group-id="${group.id}">Range</button>
            <button class="tabs__btn ${!isRange ? 'active' : ''}" data-group-mode="manual" data-group-id="${group.id}">Manual</button>
          </div>
          <div style="display:${isRange ? 'flex' : 'none'};gap:16px">
            <div style="flex:1"><input class="form-input" data-group-field="codeStart" data-group-id="${group.id}" placeholder="C02576" value="${esc(group.codeStart)}" /></div>
            <div style="flex:1"><input class="form-input" data-group-field="codeEnd" data-group-id="${group.id}" placeholder="C02651" value="${esc(group.codeEnd)}" /></div>
          </div>
          <div style="display:${!isRange ? 'block' : 'none'}">
            <textarea class="form-input" data-group-field="manualCodes" data-group-id="${group.id}" rows="4" placeholder="Um código por linha...">${esc(group.manualCodes)}</textarea>
          </div>
        </div>

        <!-- Genders -->
        <div class="ap-gender-section" style="margin-top:16px;display:${isGroupAPC || isUniqueProduct(group.productType) ? 'none' : 'block'}">
          <label class="form-label">Gêneros</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
            <button class="gender-pill gender-pill--masc ${group.genders.masc ? 'active' : ''}" data-group-gender="masc" data-group-id="${group.id}">👔 Masculino</button>
            <button class="gender-pill gender-pill--fem ${group.genders.fem ? 'active' : ''}" data-group-gender="fem" data-group-id="${group.id}">👗 Feminino</button>
            <button class="gender-pill gender-pill--inf ${group.genders.inf ? 'active' : ''}" data-group-gender="inf" data-group-id="${group.id}">🧒 Infantil</button>
          </div>
          <div style="display:flex;gap:16px;margin-top:12px">
            <div style="display:${group.genders.fem ? 'block' : 'none'};flex:1">
              <label class="form-label">Sufixo FEM</label>
              <input class="form-input" data-group-field="femSuffix" data-group-id="${group.id}" value="${esc(group.femSuffix)}" placeholder="BL" />
            </div>
            <div style="display:${group.genders.inf ? 'block' : 'none'};flex:1">
              <label class="form-label">Sufixo INF</label>
              <input class="form-input" data-group-field="infSuffix" data-group-id="${group.id}" value="${esc(group.infSuffix)}" placeholder="I" />
            </div>
          </div>
        </div>

        <!-- APC Colors -->
        <div style="margin-top:16px;${isGroupAPC ? '' : 'display:none'}">
          <label class="form-label">🎨 Cores do APC</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
            ${APC_COLORS.map(c => `
              <button class="gender-pill ${group.apcColors[c] ? 'active' : ''}" data-group-apc-color="${c}" data-group-id="${group.id}"
                style="border-color:${APC_COLOR_CSS[c]}60;${group.apcColors[c] ? `background:${APC_COLOR_CSS[c]}30;color:${c === 'Preto' ? '#d1d5db' : APC_COLOR_CSS[c]}` : ''}">
                ${APC_COLOR_DISPLAY[c]}
              </button>
            `).join('')}
          </div>
          <div style="margin-top:12px">
            <label class="form-label">🏷️ Prefixo APC (opcional)</label>
            <input class="form-input" data-group-field="apcPrefix" data-group-id="${group.id}" placeholder="Ex: PREMIUM" value="${esc(group.apcPrefix)}" />
          </div>
        </div>
      </div>
    </div>`;
  }

  function bindStep1() {
    // Global fields
    const globalFields = [['ap-price','price'],['ap-cost-price','costPrice'],['ap-price-fem','priceFem'],['ap-price-inf','priceInf'],['ap-description','description']];
    globalFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { state[key] = el.value; saveSession(); });
    });

    const brandSel = document.getElementById('ap-brand');
    if (brandSel) brandSel.addEventListener('change', () => { state.brand = brandSel.value; saveSession(); });

    const ppgToggle = document.getElementById('ap-price-per-gender');
    if (ppgToggle) ppgToggle.addEventListener('change', () => { state.pricePerGender = ppgToggle.checked; render(); });

    // Group-level fields
    document.querySelectorAll('[data-group-field]').forEach(el => {
      const field = el.dataset.groupField;
      const groupId = parseInt(el.dataset.groupId, 10);
      const handler = field === 'productType' ? 'change' : 'input';
      el.addEventListener(handler, () => {
        const group = getGroupById(groupId);
        if (!group) return;
        group[field] = el.value;
        if (field === 'productType' && isUniqueProduct(group.productType)) {
          group.genders = { masc: true, fem: false, inf: false };
        }
        // APC sempre precisa de MASC + FEM
        if (field === 'productType' && group.productType === 'APC') {
          group.genders.masc = true;
          group.genders.fem = true;
        }
        updateCodePreview();
        saveSession();
        if (field === 'productType') render();
      });
    });

    // Group code mode tabs
    document.querySelectorAll('[data-group-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = getGroupById(parseInt(btn.dataset.groupId, 10));
        if (!group) return;
        group.codeMode = btn.dataset.groupMode;
        render();
      });
    });

    // Group gender pills
    document.querySelectorAll('[data-group-gender]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = getGroupById(parseInt(btn.dataset.groupId, 10));
        if (!group) return;
        const g = btn.dataset.groupGender;
        group.genders[g] = !group.genders[g];
        if (!activeGenders(group).length) { group.genders[g] = true; window.HUB.showToast('Selecione ao menos um gênero', 'warning'); return; }
        render();
      });
    });

    // Group APC color pills
    document.querySelectorAll('[data-group-apc-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = getGroupById(parseInt(btn.dataset.groupId, 10));
        if (!group) return;
        const c = btn.dataset.groupApcColor;
        group.apcColors[c] = !group.apcColors[c];
        if (!activeApcColors(group).length) { group.apcColors[c] = true; window.HUB.showToast('Selecione ao menos uma cor', 'warning'); return; }
        render();
      });
    });

    // Toggle group expand/collapse
    document.querySelectorAll('[data-toggle-group]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove-group]')) return;
        const group = getGroupById(parseInt(el.dataset.toggleGroup, 10));
        if (!group) return;
        group.expanded = !group.expanded;
        render();
      });
    });

    // Remove group
    document.querySelectorAll('[data-remove-group]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const groupId = parseInt(btn.dataset.removeGroup, 10);
        if (state.productGroups.length <= 1) { window.HUB.showToast('Precisa de ao menos um grupo', 'warning'); return; }
        if (!confirm('Remover este grupo de produto?')) return;
        state.productGroups = state.productGroups.filter(g => g.id !== groupId);
        render();
      });
    });

    // Add group
    const addBtn = document.getElementById('ap-add-group');
    if (addBtn) addBtn.addEventListener('click', () => {
      const newGroup = createDefaultGroup(++groupIdCounter);
      state.productGroups.push(newGroup);
      render();
      window.HUB.showToast('Novo grupo adicionado!', 'success');
    });

    // Next button
    const nextBtn = document.getElementById('ap-next-1');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(1));

    // 🎲 Generate Estampa Name buttons
    document.querySelectorAll('[data-generate-estampa]').forEach(btn => {
      btn.onclick = () => {
        const gid = parseInt(btn.dataset.generateEstampa);
        const group = getGroupById(gid);
        if (!group) return;
        const brandKey = (state.brand || 'BRK FISHING').toLowerCase().includes('agro') ? 'agro'
          : (state.brand || '').toLowerCase().includes('motor') ? 'motors' : 'fishing';
        const name = Estampas.generateEstampaName(brandKey);
        group.estampaName = name;
        Estampas.addUsedEstampa(name);
        // Update input
        const input = document.querySelector(`[data-group-field="estampaName"][data-group-id="${gid}"]`);
        if (input) input.value = name;
        // Update preview
        const preview = document.querySelector(`[data-estampa-preview="${gid}"]`);
        if (preview) {
          preview.textContent = `Preview: ${buildProductTitle(group.productType, state.brand || 'BRK FISHING', name, 'masc')}`;
        }
        // Animate button
        btn.textContent = '✅ Gerado!';
        setTimeout(() => { btn.textContent = '🎲 Gerar'; }, 1500);
        saveSession();
      };
    });

    // Update preview on estampa name input change
    document.querySelectorAll('[data-group-field="estampaName"]').forEach(input => {
      input.addEventListener('input', () => {
        const gid = parseInt(input.dataset.groupId);
        const group = getGroupById(gid);
        if (!group) return;
        const preview = document.querySelector(`[data-estampa-preview="${gid}"]`);
        if (preview && input.value.trim()) {
          preview.textContent = `Preview: ${buildProductTitle(group.productType, state.brand || 'BRK FISHING', input.value.trim(), 'masc')}`;
        } else if (preview) {
          preview.textContent = 'Clique em 🎲 Gerar ou digite o nome da estampa';
        }
      });
    });

    updateCodePreview();
  }

  function updateCodePreview() {
    const codes = generateAllCodes();
    state.generatedCodes = codes;

    const countEl = document.getElementById('ap-code-count');
    const previewEl = document.getElementById('ap-code-preview');
    if (!countEl || !previewEl) return;

    const totalSKUs = totalSkuCount();
    countEl.textContent = `${codes.length} código${codes.length !== 1 ? 's' : ''} · ${totalSKUs} SKU${totalSKUs !== 1 ? 's' : ''}`;

    if (!codes.length) {
      previewEl.innerHTML = '<span style="color:#6b7280">Preencha os campos acima para gerar preview...</span>';
      return;
    }

    let html = '';
    let lastGroupId = null;
    codes.forEach(c => {
      const typeColor = PRODUCT_TYPE_COLORS[c.productType] || '#6b7280';
      if (c._groupId !== lastGroupId) {
        if (lastGroupId !== null) html += '<div style="border-top:1px solid rgba(255,255,255,.08);margin:8px 0"></div>';
        html += `<div style="font-size:11px;color:${typeColor};font-weight:700;letter-spacing:.5px;margin-bottom:4px;text-transform:uppercase">${esc(c.productType)}</div>`;
        lastGroupId = c._groupId;
      }

      if (c._isAPC) {
        const group = getGroupById(c._groupId);
        const colors = group ? activeApcColors(group) : APC_COLORS;
        const prefix = group && group.apcPrefix && group.apcPrefix.trim() ? group.apcPrefix.trim().toUpperCase() : '';
        const colorParts = colors.map(cor => {
          const corCode = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();
          const sampleCode = prefix ? `${c.base}-${prefix}-${corCode}-P` : `${c.base}-PREMIUM-${corCode}-P`;
          return `<span style="color:${APC_COLOR_CSS[cor]}">${esc(sampleCode)}</span>`;
        });
        html += `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:${TIFFANY};font-weight:600">${esc(c.base)}</span>
          <span style="color:#4b5563;margin:0 6px">→</span>
          ${colorParts.join(' <span style="color:#4b5563;margin:0 4px">|</span> ')}
        </div>`;
      } else {
        const parts = [];
        if (c.masc) parts.push(`<span style="color:#3b82f6">${esc(c.masc)}</span> <span style="color:#6b7280;font-size:11px">(MASC)</span>`);
        if (c.fem)  parts.push(`<span style="color:#ec4899">${esc(c.fem)}</span> <span style="color:#6b7280;font-size:11px">(FEM)</span>`);
        if (c.inf)  parts.push(`<span style="color:#f59e0b">${esc(c.inf)}</span> <span style="color:#6b7280;font-size:11px">(INF)</span>`);
        html += `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">${parts.join(' <span style="color:#4b5563;margin:0 6px">|</span> ')}</div>`;
      }
    });

    previewEl.innerHTML = html;
  }

  // ───────── Step 2: Pastas & Imagens ─────────
  //
  // Estrutura REAL de pastas do usuário:
  //   📁 PastaRaiz/
  //   ├── C02576/
  //   │   ├── MASC/   → 01MASC.jpg, 02MASC.jpg, 03MASC.jpg
  //   │   ├── FEM/    → 01FEM.jpg, 02FEM.jpg, 03FEM.jpg, 04FEM.jpg
  //   │   └── INF/    → 01INF.jpg, 02INF.jpg ... 05INF.jpg
  //   ├── C02577/
  //   │   ├── MASC/
  //   │   └── FEM/
  //
  // folderData structure:
  //   { 'C02576': { masc: [File,...], fem: [File,...], inf: [File,...] } }
  //
  // Auto-rename: images get renamed to pattern XX{GENDER}.ext (01MASC.jpg, 02FEM.jpg, etc.)

  function renderStep2() {
    const hasPath = state.diskFolderPath && state.diskFolderPath.trim();

    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- 📡 Network Image Scraper -->
      <div class="card" style="padding:28px;border:1px solid rgba(127, 0, 255,0.15)">
        <h3 style="margin:0 0 6px;color:${TIFFANY}">📡 Buscar Imagens da Rede</h3>
        <p style="margin:0 0 16px;color:#9ca3af;font-size:14px">
          Cole o caminho da pasta da rede onde estão as imagens. O sistema detecta automaticamente a estrutura 
          (<code style="color:#60a5fa">3d/</code>, <code style="color:#f472b6">MASC/FEM/INF</code>, ou soltas).
        </p>

        <div style="background:rgba(127, 0, 255,0.06);border:1px solid rgba(127, 0, 255,0.15);border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#A855F7">
          <strong>🔒 Modo seguro:</strong> Apenas leitura e cópia. Nenhum arquivo da rede será editado ou apagado.
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <input type="text" id="ap-network-path" placeholder="Ex: \\\\\\\\SERVIDOR\\\\Projetos\\\\COLECAO_FUSION ou Z:\\\\Projetos\\\\..." value="${esc(state.networkPath || '')}" style="flex:1;padding:12px 16px;border-radius:10px;border:1px solid rgba(127, 0, 255,0.15);background:rgba(0,0,0,.3);color:#e5e7eb;font-size:14px;font-family:'Cascadia Code','Fira Code',monospace">
          <button class="btn btn--primary" id="ap-network-scan" style="font-size:13px;padding:10px 18px;white-space:nowrap;background:linear-gradient(135deg,${TIFFANY_D},${TIFFANY})">🔍 Escanear Rede</button>
        </div>
        <div id="ap-network-status" style="font-size:13px;margin-top:8px;color:#6b7280;min-height:20px"></div>
      `;

      // Network scan results
      if (state.networkScanResult) {
        const scan = state.networkScanResult;
        html += `
        <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,.06);padding-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h4 style="margin:0;color:${TIFFANY_S}">📊 Estrutura Detectada</h4>
            <span style="font-size:12px;padding:4px 12px;border-radius:20px;background:rgba(127, 0, 255,0.15);color:${TIFFANY}">
              Padrão: ${scan.detectedPattern === 'gender_folders' ? 'Subpastas por Gênero' : scan.detectedPattern === '3d_folder' ? 'Pasta 3D' : scan.detectedPattern === 'loose_images' ? 'Imagens Soltas' : scan.detectedPattern}
            </span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
            ${renderStatCard('Pastas', scan.summary.totalFolders, '📁')}
            ${renderStatCard('Imagens', scan.summary.totalImages, '🖼️')}
            ${renderStatCard('Padrão', Object.keys(scan.summary.patterns).length, '🔍', '#3b82f6')}
          </div>

          <!-- Folder selection list -->
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label style="font-size:13px;color:#9ca3af">Selecione as pastas para copiar:</label>
              <label style="font-size:12px;cursor:pointer;color:${TIFFANY}">
                <input type="checkbox" id="ap-network-select-all" checked style="margin-right:4px"> Selecionar todas
              </label>
            </div>
            <div style="max-height:250px;overflow-y:auto;background:rgba(0,0,0,.2);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px">
              ${scan.folders.map(f => {
                const mascCount = f.imageCount.masc || 0;
                const femCount = f.imageCount.fem || 0;
                const infCount = f.imageCount.inf || 0;
                const looseCount = f.imageCount.loose || 0;
                const badges = [
                  mascCount > 0 ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(59,130,246,.15);color:#60a5fa">♂ ${mascCount}</span>` : '',
                  femCount > 0 ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(244,114,182,.15);color:#f472b6">♀ ${femCount}</span>` : '',
                  infCount > 0 ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(251,191,36,.15);color:#fbbf24">👶 ${infCount}</span>` : '',
                  looseCount > 0 ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(156,163,175,.15);color:#9ca3af">📎 ${looseCount}</span>` : '',
                ].filter(Boolean).join(' ');
                return `
                <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.03);cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(127, 0, 255,.08)'" onmouseout="this.style.background='rgba(255,255,255,.03)'">
                  <input type="checkbox" class="network-folder-check" value="${esc(f.name)}" checked style="accent-color:${TIFFANY}">
                  <span style="color:#e5e7eb;font-size:13px;font-family:monospace;flex:1">📁 ${esc(f.name)}</span>
                  <span style="display:flex;gap:6px">${badges}</span>
                  <span style="font-size:11px;color:#6b7280">${f.totalImages} imgs</span>
                </label>`;
              }).join('')}
            </div>
          </div>

          <!-- Local destination path -->
          <div style="margin-bottom:16px">
            <label class="form-label" style="font-size:13px;color:#9ca3af">📁 Pasta Local de Destino</label>
            <input type="text" id="ap-local-dest-path" placeholder="Ex: C:\\\\Users\\\\lucas\\\\Desktop\\\\TRABALHO" value="${esc(state.localWorkingPath || '')}" style="width:100%;padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#e5e7eb;font-size:14px;font-family:'Cascadia Code','Fira Code',monospace;box-sizing:border-box">
          </div>

          <!-- Copy button -->
          <button class="btn btn--primary" id="ap-network-copy" style="width:100%;padding:14px;font-size:15px;font-weight:600;background:linear-gradient(135deg,${TIFFANY_D},${TIFFANY})">
            📋 Copiar Imagens para Pasta Local
          </button>

          <!-- Progress area -->
          <div id="ap-network-progress" style="margin-top:16px;display:none">
            <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
              <span id="ap-network-progress-label" style="font-size:13px;color:#e5e7eb">Copiando...</span>
              <span id="ap-network-progress-pct" style="font-size:13px;color:${TIFFANY};font-weight:600">0%</span>
            </div>
            <div style="height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">
              <div id="ap-network-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,${TIFFANY_D},${TIFFANY});border-radius:4px;transition:width .3s ease"></div>
            </div>
            <div id="ap-network-progress-log" style="margin-top:12px;max-height:200px;overflow-y:auto;font-size:12px;font-family:monospace;color:#9ca3af;background:rgba(0,0,0,.2);padding:12px;border-radius:8px;line-height:1.8"></div>
          </div>
        </div>`;
      }

      // Network copy complete message
      if (state.networkCopyResult) {
        const result = state.networkCopyResult;
        html += `
        <div style="margin-top:16px;padding:14px 18px;border-radius:10px;background:rgba(127, 0, 255,0.1);border:1px solid rgba(127, 0, 255,0.2)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:18px">✅</span>
            <strong style="color:${TIFFANY}">Cópia concluída!</strong>
          </div>
          <div style="font-size:13px;color:#9ca3af">
            ${result.totalCopied} imagens copiadas para <code style="color:${TIFFANY_S}">${esc(result.localPath)}</code>
          </div>
        </div>`;
      }

      html += `</div>`; // Close network card
      html += `

      <!-- Caminho da Pasta -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 6px;color:${TIFFANY}">📁 Caminho das Imagens</h3>
        <p style="margin:0 0 16px;color:#9ca3af;font-size:14px">
          Informe o <strong>caminho da pasta raiz</strong> que contém as pastas de cada código.
          Cada código deve ter subpastas <code style="color:#60a5fa">MASC</code>, <code style="color:#f472b6">FEM</code> e/ou <code style="color:#fbbf24">INF</code> com as imagens dentro.
        </p>

        <div style="background:rgba(127, 0, 255,0.06);border:1px solid rgba(127, 0, 255,0.15);border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#A855F7">
          <strong>📂 Estrutura esperada:</strong> PastaRaiz → C02576 → MASC / FEM / INF → imagens.jpg
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <input type="text" id="ap-disk-folder-path" placeholder="Ex: C:\\Users\\lucas\\Desktop\\COLECTION CAMUFLADO\\FUSION" value="${state.diskFolderPath || ''}" style="flex:1;padding:12px 16px;border-radius:10px;border:1px solid ${hasPath ? TIFFANY + '40' : 'rgba(255,255,255,.1)'};background:rgba(0,0,0,.3);color:#e5e7eb;font-size:14px;font-family:'Cascadia Code','Fira Code',monospace">
          <button class="btn btn--primary" id="ap-test-disk-path" style="font-size:13px;padding:10px 18px;white-space:nowrap;background:linear-gradient(135deg,${TIFFANY_D},${TIFFANY})">🔍 Verificar Pasta</button>
        </div>
        <div id="ap-disk-path-status" style="font-size:13px;margin-top:8px;color:#6b7280;min-height:20px">${hasPath ? '✅ Caminho salvo — clique em Verificar para validar' : ''}</div>
      </div>`;

    // Scan results (if available)
    if (state.diskScanResult) {
      const scan = state.diskScanResult;
      html += `
      <div class="card" style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h3 style="margin:0;color:${TIFFANY}">📊 Pastas Encontradas</h3>
          <button class="btn btn--secondary" id="ap-clear-scan" style="font-size:12px">Limpar</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${renderStatCard('Códigos', scan.codes || 0, '📁')}
          ${renderStatCard('Imagens', scan.images || 0, '🖼️')}
          ${renderStatCard('Pastas', scan.folderNames ? scan.folderNames.length : 0, '📂', '#3b82f6')}
        </div>
        ${scan.folderNames && scan.folderNames.length > 0 ? `
        <div style="max-height:200px;overflow-y:auto;font-size:12px;color:#9ca3af;font-family:monospace;background:rgba(0,0,0,.2);padding:12px;border-radius:8px;line-height:1.8">
          ${scan.folderNames.map(name => `📁 <span style="color:#e5e7eb">${esc(name)}</span>`).join('<br>')}
        </div>` : ''}
      </div>`;
    }

    // Auto-rename toggle
    html += `
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-weight:600;font-size:14px;color:#e5e7eb">🔄 Renomeação Automática</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px">
              Renomeia automaticamente as imagens para o padrão <code style="color:#A855F7">01MASC.jpg</code>, <code style="color:#f472b6">02FEM.jpg</code>, etc.
            </div>
          </div>
          <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer">
            <input type="checkbox" id="ap-auto-rename" ${state.autoRename !== false ? 'checked' : ''} style="width:40px;height:22px;appearance:none;background:${state.autoRename !== false ? TIFFANY : '#374151'};border-radius:11px;cursor:pointer;transition:background .2s" />
            <span style="position:absolute;left:${state.autoRename !== false ? '20px' : '2px'};top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
          </label>
        </div>
      </div>`;

    html += `
      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px">
        <button class="btn btn--secondary" id="ap-prev-2">← Voltar</button>
        <button class="btn btn--primary" id="ap-next-2" style="min-width:180px">Próximo Passo →</button>
      </div>
    </div>`;

    return html;
  }

  function renderStatCard(label, count, icon, color) {
    const c = color || TIFFANY;
    return `<div style="text-align:center;padding:14px;border-radius:10px;background:rgba(0,0,0,.2);border:1px solid ${c}20">
      <div style="font-size:20px">${icon}</div>
      <div style="font-size:22px;font-weight:700;color:${c}">${count}</div>
      <div style="font-size:11px;color:#9ca3af">${label}</div>
    </div>`;
  }

  function bindStep2() {
    // ═══════ Network Scan Button ═══════
    const networkScanBtn = document.getElementById('ap-network-scan');
    if (networkScanBtn) {
      networkScanBtn.addEventListener('click', async () => {
        const input = document.getElementById('ap-network-path');
        const statusEl = document.getElementById('ap-network-status');
        const pathVal = input?.value?.trim();
        if (!pathVal) {
          if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444">⚠️ Informe o caminho da rede.</span>';
          return;
        }
        state.networkPath = pathVal;
        saveSession();
        if (statusEl) statusEl.innerHTML = '<span style="color:#fbbf24">⏳ Escaneando pasta da rede...</span>';
        networkScanBtn.disabled = true;
        networkScanBtn.textContent = '⏳ Escaneando...';
        try {
          const r = await fetch('/api/network/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ networkPath: pathVal })
          });
          const data = await r.json();
          if (!r.ok || !data.success) {
            if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444">❌ ${data.error || 'Erro desconhecido'}</span>`;
            return;
          }
          state.networkScanResult = data;
          saveSession();
          if (statusEl) statusEl.innerHTML = `<span style="color:#7C3AED">✅ ${data.summary.totalFolders} pastas encontradas com ${data.summary.totalImages} imagens</span>`;
          render();
        } catch (err) {
          if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444">❌ Erro de conexão: ${err.message}</span>`;
        } finally {
          networkScanBtn.disabled = false;
          networkScanBtn.textContent = '🔍 Escanear Rede';
        }
      });
    }

    // Select all checkbox
    const selectAllCheck = document.getElementById('ap-network-select-all');
    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', () => {
        document.querySelectorAll('.network-folder-check').forEach(cb => { cb.checked = selectAllCheck.checked; });
      });
    }

    // Copy button
    const copyBtn = document.getElementById('ap-network-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const localDest = document.getElementById('ap-local-dest-path')?.value?.trim();
        if (!localDest) {
          alert('Informe a pasta local de destino.');
          return;
        }
        state.localWorkingPath = localDest;

        const selectedFolders = [...document.querySelectorAll('.network-folder-check:checked')].map(cb => cb.value);
        if (selectedFolders.length === 0) {
          alert('Selecione ao menos uma pasta para copiar.');
          return;
        }

        const progressArea = document.getElementById('ap-network-progress');
        const progressBar = document.getElementById('ap-network-progress-bar');
        const progressLabel = document.getElementById('ap-network-progress-label');
        const progressPct = document.getElementById('ap-network-progress-pct');
        const progressLog = document.getElementById('ap-network-progress-log');

        if (progressArea) progressArea.style.display = 'block';
        copyBtn.disabled = true;
        copyBtn.textContent = '⏳ Copiando...';

        try {
          const response = await fetch('/api/network/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              networkPath: state.networkPath,
              localBasePath: localDest,
              collectionName: state.networkScanResult?.rootFolderName || '',
              folders: selectedFolders,
              preferJpeg: true
            })
          });

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.percentComplete !== undefined) {
                    if (progressBar) progressBar.style.width = data.percentComplete + '%';
                    if (progressPct) progressPct.textContent = data.percentComplete + '%';
                  }

                  if (data.status === 'scanning') {
                    if (progressLabel) progressLabel.textContent = `Escaneando: ${data.folder}...`;
                  } else if (data.status === 'done') {
                    if (progressLabel) progressLabel.textContent = `Copiado: ${data.folder} (${data.copied} imgs)`;
                    if (progressLog) progressLog.innerHTML += `✅ <span style="color:#e5e7eb">${data.folder}</span> — ${data.copied} imagens copiadas<br>`;
                  } else if (data.status === 'skipped') {
                    if (progressLog) progressLog.innerHTML += `⚠️ <span style="color:#fbbf24">${data.folder}</span> — ${data.reason}<br>`;
                  }

                  // Complete event
                  if (data.success !== undefined && data.localPath) {
                    state.networkCopyResult = data;
                    // Auto-fill disk folder path
                    state.diskFolderPath = data.localPath;
                    saveSession();
                    
                    if (progressBar) progressBar.style.width = '100%';
                    if (progressPct) progressPct.textContent = '100%';
                    if (progressLabel) progressLabel.textContent = `✅ Concluído! ${data.totalCopied} imagens copiadas.`;
                    if (progressLog) progressLog.innerHTML += `<br><strong style="color:${TIFFANY}">🎉 Cópia concluída! Pasta: ${data.localPath}</strong><br>`;
                    
                    // Update the disk path input
                    const diskInput = document.getElementById('ap-disk-folder-path');
                    if (diskInput) diskInput.value = data.localPath;

                    // 🔄 Auto-scan da pasta copiada para preencher diskScanResult
                    try {
                      const scanR = await fetch('/api/autopilot/scan-folder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folderPath: data.localPath })
                      });
                      const scanData = await scanR.json();
                      if (scanR.ok && scanData.folders) {
                        state.diskScanResult = {
                          codes: scanData.folders.length,
                          images: scanData.totalImages || 0,
                          folderNames: scanData.folders.map(f => typeof f === 'string' ? f : f.name),
                        };
                        if (state.diskScanResult && state.diskScanResult.folderNames) {
                          state.diskScanResult.folderNames.forEach(name => {
                            // Extrair código base e nome da estampa (ex: 'C02576 - TUCUNARE' → key='C02576', val='Tucunare')
                            const match = name.match(/^([A-Za-z]+\d+)\s*[-_]?\s*(.*)$/);
                            if (match && match[2].trim()) {
                              const baseCode = match[1].toUpperCase();
                              const suggestion = match[2].replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                              if (!state.estampaSuggestions[baseCode]) state.estampaSuggestions[baseCode] = suggestion;
                            } else {
                              // Pasta é só o código (ex: 'C02576') — sem sugestão
                              const codeOnly = name.match(/^([A-Za-z]+\d+)$/);
                              if (!codeOnly) {
                                const clean = name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                                if (!state.estampaSuggestions[name]) state.estampaSuggestions[name] = clean;
                              }
                            }
                          });
                        }
                        saveSession();
                        if (progressLog) progressLog.innerHTML += `📊 Auto-scan: <strong style="color:${TIFFANY}">${scanData.folders.length}</strong> códigos, <strong style="color:${TIFFANY}">${scanData.totalImages}</strong> imagens detectadas<br>`;
                        // Re-render to show updated stats cards
                        render();
                      }
                    } catch (scanErr) {
                      console.log('Auto-scan falhou:', scanErr.message);
                    }
                  }

                  if (data.message && data.message.includes('error')) {
                    if (progressLog) progressLog.innerHTML += `❌ <span style="color:#ef4444">${data.message}</span><br>`;
                  }
                } catch {} // Ignore non-JSON lines
              }
            }
          }
        } catch (err) {
          if (progressLog) progressLog.innerHTML += `❌ <span style="color:#ef4444">Erro: ${err.message}</span><br>`;
        } finally {
          copyBtn.disabled = false;
          copyBtn.textContent = '📋 Copiar Imagens para Pasta Local';
        }
      });
    }

    // Disk folder path input
    const diskInput = document.getElementById('ap-disk-folder-path');
    if (diskInput) {
      diskInput.addEventListener('change', () => {
        state.diskFolderPath = diskInput.value.trim();
        saveSession();
      });
      diskInput.addEventListener('blur', () => {
        state.diskFolderPath = diskInput.value.trim();
        saveSession();
      });
    }

    // Verify disk path button
    const testPathBtn = document.getElementById('ap-test-disk-path');
    if (testPathBtn) testPathBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('ap-disk-path-status');
      const pathVal = diskInput?.value?.trim();
      if (!pathVal) {
        if (statusEl) { statusEl.textContent = '❌ Informe o caminho da pasta'; statusEl.style.color = '#ef4444'; }
        return;
      }
      state.diskFolderPath = pathVal;
      saveSession();

      if (statusEl) { statusEl.textContent = '⏳ Verificando...'; statusEl.style.color = '#9ca3af'; }

      try {
        const r = await fetch('/api/autopilot/scan-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: pathVal }),
        });
        const data = await r.json();

        if (!r.ok) {
          if (statusEl) { statusEl.textContent = `❌ ${data.error || 'Pasta não encontrada'}`; statusEl.style.color = '#ef4444'; }
          state.diskScanResult = null;
          render();
          return;
        }

        const codes = (data.folders || []).length;
        const images = data.totalImages || 0;

        state.diskScanResult = {
          codes,
          images,
          folderNames: (data.folders || []).map(f => typeof f === 'string' ? f : f.name),
        };
        if (state.diskScanResult && state.diskScanResult.folderNames) {
          state.diskScanResult.folderNames.forEach(name => {
            const match = name.match(/^([A-Za-z]+\d+)\s*[-_]?\s*(.*)$/);
            if (match && match[2].trim()) {
              const baseCode = match[1].toUpperCase();
              const suggestion = match[2].replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
              if (!state.estampaSuggestions[baseCode]) state.estampaSuggestions[baseCode] = suggestion;
            } else {
              const codeOnly = name.match(/^([A-Za-z]+\d+)$/);
              if (!codeOnly) {
                const clean = name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                if (!state.estampaSuggestions[name]) state.estampaSuggestions[name] = clean;
              }
            }
          });
        }

        if (statusEl) {
          statusEl.innerHTML = `✅ <strong>${codes}</strong> código(s) encontrado(s) com <strong>${images}</strong> imagem(ns)`;
          statusEl.style.color = TIFFANY;
        }

        render();
      } catch (err) {
        if (statusEl) { statusEl.textContent = `❌ Erro: ${err.message}`; statusEl.style.color = '#ef4444'; }
      }
    });

    // Clear scan results
    const clearScanBtn = document.getElementById('ap-clear-scan');
    if (clearScanBtn) {
      clearScanBtn.addEventListener('click', () => {
        state.diskScanResult = null;
        state.diskFolderPath = '';
        saveSession();
        render();
      });
    }

    // Auto-rename toggle
    const renameToggle = document.getElementById('ap-auto-rename');
    if (renameToggle) {
      renameToggle.addEventListener('change', () => {
        state.autoRename = renameToggle.checked;
        renameToggle.style.background = renameToggle.checked ? TIFFANY : '#374151';
        const thumb = renameToggle.parentElement.querySelector('span');
        if (thumb) thumb.style.left = renameToggle.checked ? '20px' : '2px';
        saveSession();
      });
    }

    const prevBtn = document.getElementById('ap-prev-2');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(1));

    const nextBtn = document.getElementById('ap-next-2');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(2));
  }

  // ───────── Step 3: Links de Imagens (Upload Automático S3) ─────────
  //
  // Automação completa:
  //   - As imagens da Etapa 2 (folderData[code.base][gender]) são enviadas
  //     automaticamente para o BRK Link via proxy /api/s3-proxy/upload-gender
  //   - O backend faz upload para BRK Link (Cloudflare R2) e retorna URLs CDN
  //   - URLs retornadas são pipe-joined e auto-preenchidas
  //
  // Dois modos:
  //   🚀 "Gerar TODOS os Links" — processa todos os códigos pendentes
  //   🔗 "Gerar" individual — processa um código por vez
  //   ✏️ Manual — colar link diretamente (fallback)

  // Upload state tracking
  let uploadState = {
    isUploading: false,
    aborted: false,
    currentCode: '',
    currentGender: '',
    progress: { done: 0, total: 0, currentImg: 0, totalImgs: 0 },
  };

  function renderStep3() {
    const codes = state.generatedCodes;
    const hasDiskPath = state.diskFolderPath && state.diskFolderPath.trim();

    // Count: a code is "done" when ALL its active slots have links
    const doneCount = codes.filter(code => {
      if (code._isAPC) {
        // APC: check by gender × color
        const group = getGroupById(code._groupId);
        const colors = group ? activeApcColors(group) : APC_COLORS;
        const genders = group ? activeGenders(group) : ['masc'];
        return genders.every(g => {
          const gk = g === 'masc' ? 'MASC' : 'FEM';
          return colors.every(cor => {
            const url = state.imageUrls[`${code.base}_${gk}_${cor}`];
            return url && url.trim();
          });
        });
      }
      // Normal: check by gender
      const group = getGroupById(code._groupId);
      const gendersList = group ? activeGenders(group) : ['masc'];
      return gendersList.every(g => {
        if (!code[g]) return true;
        const url = state.imageUrls[code[g]];
        return url && url.trim();
      });
    }).length;
    const totalCount = codes.length;
    const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
    const currentFilter = state.linkFilter || 'all';

    let html = `
    <div style="display:flex;flex-direction:column;gap:20px">

      <!-- Header -->
      <div class="card" style="padding:24px">
        <h3 style="margin:0 0 12px;color:${TIFFANY}">🔗 Links de Imagens</h3>

        ${hasDiskPath ? `
        <!-- Caminho configurado — pronto para upload -->
        <div style="background:linear-gradient(135deg,rgba(127, 0, 255,0.12),rgba(127, 0, 255,0.03));border:1px solid rgba(127, 0, 255,0.3);border-radius:12px;padding:16px 20px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:20px">✅</span>
            <span style="font-size:14px;font-weight:700;color:${TIFFANY}">Pasta Configurada — Pronto para Upload!</span>
          </div>
          <div style="font-size:13px;color:#A855F7;line-height:1.6">
            <strong>📁 ${esc(state.diskFolderPath)}</strong><br>
            O servidor lê as subpastas de cada código automaticamente (MASC / FEM / INF).
            Clique em <strong>"🚀 Gerar TODOS os Links"</strong> para enviar ao CDN.
          </div>
        </div>` : `
        <!-- Sem caminho configurado -->
        <div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.03));border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px 20px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:20px">⚠️</span>
            <span style="font-size:14px;font-weight:700;color:#f59e0b">Caminho não configurado</span>
          </div>
          <div style="font-size:13px;color:#fbbf24;line-height:1.6">
            Volte à <strong>Etapa 2</strong> e informe o caminho da pasta com as imagens,
            ou preencha os links manualmente abaixo.
          </div>
        </div>`}

        <!-- Upload progress (hidden by default, shown during upload) -->
        <div id="ap-upload-progress" style="display:none;background:rgba(0,0,0,.3);border-radius:12px;padding:16px 20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <div id="ap-upload-spinner" style="width:18px;height:18px;border:2px solid ${TIFFANY}40;border-top:2px solid ${TIFFANY};border-radius:50%;animation:spin 1s linear infinite"></div>
              <span id="ap-upload-status" style="font-size:13px;color:${TIFFANY};font-weight:600">Enviando...</span>
            </div>
            <button class="btn btn--secondary" id="ap-upload-cancel" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef4444">
              ✕ Cancelar
            </button>
          </div>
          <div id="ap-upload-detail" style="font-size:12px;color:#9ca3af;margin-bottom:8px">Preparando...</div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">
            <div id="ap-upload-bar" style="width:0%;height:100%;background:linear-gradient(90deg,${TIFFANY_D},${TIFFANY});border-radius:3px;transition:width .3s ease"></div>
          </div>
        </div>

        <!-- Progress -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:13px;color:#9ca3af">${doneCount} de ${totalCount} códigos completos</span>
          <span style="font-size:14px;font-weight:700;color:${TIFFANY}">${pct}%</span>
        </div>
        <div style="height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${TIFFANY_D},${TIFFANY});border-radius:4px;transition:width .4s ease"></div>
        </div>
      </div>

      <!-- Actions bar -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn--primary" id="ap-auto-upload-all" style="font-size:13px;padding:10px 18px;background:linear-gradient(135deg,${TIFFANY_D},${TIFFANY});position:relative;overflow:hidden">
          🚀 Gerar TODOS os Links
        </button>
        <button class="btn btn--secondary" id="ap-clear-all-links" style="font-size:13px;padding:10px 18px;color:#ef4444;border-color:#ef444440">
          🗑️ Apagar TODOS os Links
        </button>
        <span id="ap-s3-status" style="font-size:11px;color:#6b7280;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,.04)">⏳ Verificando BRK Link...</span>
        <button class="btn btn--secondary" id="ap-open-link-gen" style="font-size:13px;padding:10px 18px">
          🌐 Abrir Organizador BRK
        </button>
        <button class="btn btn--secondary" id="ap-scroll-next-pending" style="font-size:13px">
          ⏭️ Próximo Pendente
        </button>
        <div style="flex:1"></div>

        <!-- Filter pills -->
        <div style="display:flex;gap:6px" id="ap-link-filter-pills">
          <button class="badge ap-filter-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" style="cursor:pointer;padding:6px 14px;font-size:12px;border:1px solid ${currentFilter === 'all' ? TIFFANY : 'rgba(255,255,255,.1)'};background:${currentFilter === 'all' ? TIFFANY + '20' : 'transparent'};color:${currentFilter === 'all' ? TIFFANY : '#6b7280'};border-radius:6px">
            Todos (${totalCount})
          </button>
          <button class="badge ap-filter-pill ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending" style="cursor:pointer;padding:6px 14px;font-size:12px;border:1px solid ${currentFilter === 'pending' ? '#f59e0b' : 'rgba(255,255,255,.1)'};background:${currentFilter === 'pending' ? '#f59e0b20' : 'transparent'};color:${currentFilter === 'pending' ? '#f59e0b' : '#6b7280'};border-radius:6px">
            ⏳ Pendentes (${totalCount - doneCount})
          </button>
          <button class="badge ap-filter-pill ${currentFilter === 'done' ? 'active' : ''}" data-filter="done" style="cursor:pointer;padding:6px 14px;font-size:12px;border:1px solid ${currentFilter === 'done' ? TIFFANY : 'rgba(255,255,255,.1)'};background:${currentFilter === 'done' ? TIFFANY + '20' : 'transparent'};color:${currentFilter === 'done' ? TIFFANY : '#6b7280'};border-radius:6px">
            ✅ Concluídos (${doneCount})
          </button>
        </div>
      </div>

      <!-- Code cards -->
      <div id="ap-link-cards" style="display:flex;flex-direction:column;gap:14px">
        ${renderCodeLinkCards(currentFilter)}
      </div>

      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px">
        <button class="btn btn--secondary" id="ap-prev-3">← Voltar</button>
        <button class="btn btn--primary" id="ap-next-3" style="min-width:180px">Próximo Passo →</button>
      </div>
    </div>

    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .ap-uploading-card { animation: uploadPulse 1.5s ease-in-out infinite; }
      @keyframes uploadPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(127, 0, 255,0); } 50% { box-shadow: 0 0 0 3px rgba(127, 0, 255,0.15); } }
    </style>`;

    return html;
  }

  function renderCodeLinkCards(filter) {
    const hasFolderData = !!(state.diskFolderPath && state.diskFolderPath.trim());
    let html = '';
    // Build lookup set from diskScanResult folderNames for O(1) checking
    const knownFolders = new Set(
      (state.diskScanResult && state.diskScanResult.folderNames) 
        ? state.diskScanResult.folderNames.map(n => n.toUpperCase()) 
        : []
    );

    state.generatedCodes.forEach((code, codeIdx) => {
      const codeGroup = getGroupById(code._groupId);

      // ═══ APC: Cards separados MASC + FEM ═══
      if (code._isAPC) {
        const colors = codeGroup ? activeApcColors(codeGroup) : APC_COLORS;
        const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
        // Map gender to code suffix and display label
        const GENDER_INFO = {
          masc: { suffix: '',   label: 'MASCULINO', icon: '👔', color: '#3b82f6' },
          fem:  { suffix: 'BL', label: 'FEMININO',  icon: '👗', color: '#ec4899' },
        };

        // Calculate total slots (genders × colors)
        const totalSlots = genders.length * colors.length;
        let doneSlots = 0;
        genders.forEach(g => {
          colors.forEach(cor => {
            const u = state.imageUrls[`${code.base}_${g === 'masc' ? 'MASC' : 'FEM'}_${cor}`];
            if (u && u.trim()) doneSlots++;
          });
        });
        const isCodeDone = doneSlots === totalSlots;

        if (filter === 'pending' && isCodeDone) return;
        if (filter === 'done' && !isCodeDone) return;

        const hasImages = hasFolderData && knownFolders.has(code.base.toUpperCase());

        // Generate a card for each gender (MASC, FEM)
        genders.forEach((g, gIdx) => {
          const info = GENDER_INFO[g] || GENDER_INFO.masc;
          const genderKey = g === 'masc' ? 'MASC' : 'FEM';
          const codeWithSuffix = code.base + info.suffix; // APC0541 or APC0541BL

          // Check if this gender block is done
          const genderDone = colors.every(cor => {
            const u = state.imageUrls[`${code.base}_${genderKey}_${cor}`];
            return u && u.trim();
          });
          const genderDoneCount = colors.filter(cor => {
            const u = state.imageUrls[`${code.base}_${genderKey}_${cor}`];
            return u && u.trim();
          }).length;

          html += `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${esc(code.base)}" data-is-apc="true" data-apc-gender="${genderKey}" ${genderDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${genderDone ? TIFFANY_D : info.color + '80'};transition:border-color .3s;${gIdx > 0 ? 'margin-top:8px' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${esc(codeWithSuffix)}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(212,165,116,0.15);color:#d4a574;font-weight:600">APC</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${info.color}20;color:${info.color};font-weight:600">${info.icon} ${info.label}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                ${hasImages && !genderDone ? `
                <button class="btn btn--secondary ap-upload-single-btn" data-base="${esc(code.base)}" data-idx="${codeIdx}" data-apc-gender="${genderKey}" style="font-size:11px;padding:4px 12px;color:${TIFFANY};border-color:${TIFFANY}40">
                  🚀 Gerar
                </button>` : ''}
                ${genderDone ? `
                <button class="btn btn--secondary ap-clear-code-links" data-base="${esc(code.base)}" data-idx="${codeIdx}" data-apc-gender="${genderKey}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste bloco">
                  🗑️
                </button>` : ''}
                <span style="font-size:12px;font-weight:600;color:${genderDone ? TIFFANY : '#f59e0b'}">
                  ${genderDone ? '✅ Completo' : `⏳ ${genderDoneCount}/${colors.length}`}
                </span>
              </div>
            </div>`;

          // Uma row por COR dentro deste gênero
          colors.forEach((cor, corIdx) => {
            const urlKey = `${code.base}_${genderKey}_${cor}`;
            const url = state.imageUrls[urlKey] || '';
            const isDone = url.trim().length > 0;
            const colorCss = APC_COLOR_CSS[cor] || '#6b7280';
            const colorIcon = { Preto: '⬛', Branco: '⬜', Bege: '🟫' }[cor] || '🔲';
            const corDesc = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();

            const prefix = codeGroup && codeGroup.apcPrefix && codeGroup.apcPrefix.trim()
              ? codeGroup.apcPrefix.trim().toUpperCase() : 'PREMIUM';
            const sizes = sizesFor(g, code.productType);
            const sampleCodes = sizes.slice(0, 3).map(s => `${codeWithSuffix}-${prefix}-${corDesc}-${s}`);
            const appliesTo = sampleCodes.join(', ') + (sizes.length > 3 ? `, +${sizes.length - 3}` : '');

            html += `<div class="ap-gender-row ap-color-row" data-gender-code="${esc(urlKey)}" data-apc-color="${esc(cor)}" data-apc-gender="${genderKey}" style="padding:12px;margin-bottom:${corIdx < colors.length - 1 ? '10px' : '0'};background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="badge" style="background:${colorCss}25;color:${colorCss};font-size:12px;padding:4px 12px;border-radius:6px;font-weight:700;letter-spacing:.5px">${colorIcon} ${cor.toUpperCase()}</span>
                  <span class="ap-gender-status" style="font-size:12px;color:${isDone ? TIFFANY : '#6b7280'}">
                    ${isDone ? '✅' : '⏳'}
                  </span>
                </div>
              </div>

              <input type="text" class="form-input ap-link-input"
                data-code="${esc(urlKey)}" data-base="${esc(code.base)}" data-gender="${g}" data-apc-color="${esc(cor)}" data-apc-gender="${genderKey}" data-idx="${codeIdx}"
                value="${esc(url)}"
                placeholder="${hasImages ? `Imagens ${info.label} ${cor} prontas para upload` : `Cole link ${info.label} ${cor}...`}"
                style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

              <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
                → Aplica em: <span style="color:#6b7280">${esc(appliesTo)}</span>
              </div>
            </div>`;
          });

          html += '</div>';
        });

        return; // skip normal rendering below
      }

      // ═══ NORMAL (não-APC): Inputs por GÊNERO (inalterado) ═══
      const gendersList = codeGroup ? activeGenders(codeGroup) : ['masc'];
      const isCodeDone = gendersList.every(g => {
        if (!code[g]) return true;
        const url = state.imageUrls[code[g]];
        return url && url.trim();
      });

      if (filter === 'pending' && isCodeDone) return;
      if (filter === 'done' && !isCodeDone) return;

      const hasImages = hasFolderData && knownFolders.has(code.base.toUpperCase());

      html += `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${esc(code.base)}" ${isCodeDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${isCodeDone ? TIFFANY_D : '#4b5563'};transition:border-color .3s">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${esc(code.base)}</span>
            <span style="font-size:12px;color:#6b7280">#${codeIdx + 1} de ${state.generatedCodes.length}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${hasImages && !isCodeDone ? `
            <button class="btn btn--secondary ap-upload-single-btn" data-base="${esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:${TIFFANY};border-color:${TIFFANY}40">
              🚀 Gerar
            </button>` : ''}
            ${isCodeDone ? `
            <button class="btn btn--secondary ap-clear-code-links" data-base="${esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste código">
              🗑️
            </button>` : ''}
            <span style="font-size:12px;font-weight:600;color:${isCodeDone ? TIFFANY : '#f59e0b'}">
              ${isCodeDone ? '✅ Completo' : '⏳ Pendente'}
            </span>
          </div>
        </div>`;

      gendersList.forEach(g => {
        if (!code[g]) return;

        const codeKey = code[g];
        const url = state.imageUrls[codeKey] || '';
        const isDone = url.trim().length > 0;
        const imgCount = hasImages ? '✓' : 0;

        const sizes = sizesFor(g, code.productType);
        const appliesToCodes = [codeKey, ...sizes.map(s => codeKey + s)];
        const appliesTo = appliesToCodes.join(', ');

        html += `<div class="ap-gender-row" data-gender-code="${esc(codeKey)}" style="padding:12px;margin-bottom:${g !== gendersList[gendersList.length - 1] ? '10px' : '0'};background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge" style="background:${genderColor(g)}25;color:${genderColor(g)};font-size:11px;padding:3px 10px;border-radius:6px">${genderLabel(g)}</span>
              <span class="ap-gender-status" style="font-size:12px;color:${isDone ? TIFFANY : '#6b7280'}">
                ${isDone ? '✅' : '⏳'}
              </span>
              ${imgCount ? `<span style="font-size:11px;color:${TIFFANY}">📂 Imagens detectadas</span>` : ''}
            </div>
          </div>

          <input type="text" class="form-input ap-link-input"
            data-code="${esc(codeKey)}" data-base="${esc(code.base)}" data-gender="${g}" data-idx="${codeIdx}"
            value="${esc(url)}"
            placeholder="${hasImages ? `Imagens prontas para upload automático` : `Cole aqui o link de Imagens ${genderLabel(g)}...`}"
            style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

          <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
            → Aplica em: <span style="color:#6b7280">${esc(appliesTo)}</span>
          </div>
        </div>`;
      });

      html += '</div>';
    });

    if (!html) {
      html = `<div style="text-align:center;padding:48px;color:#6b7280">
        <div style="font-size:32px;margin-bottom:8px">${filter === 'done' ? '🎉' : '✅'}</div>
        <div>${filter === 'done' ? 'Nenhum código concluído ainda' : 'Todos os códigos já foram preenchidos!'}</div>
      </div>`;
    }

    return html;
  }



  /**
   * Faz upload de imagens de um código+gênero.
   * 
   * MODO 1 (automático): Se tem File objects no state.folderData (carregados na Etapa 2),
   *   envia via FormData multipart → /api/s3-proxy/upload-batch
   *   NÃO precisa de caminho de pasta.
   * 
   * MODO 2 (disco): Se não tem File objects, usa diskFolderPath
   *   → /api/s3-proxy/upload-from-disk
   *   O server lê as imagens do disco.
   * 
   * @param {string} baseCode - ex: 'C02858'
   * @param {string} gender - 'masc', 'fem', 'inf'
   * @returns {Promise<string>} URLs pipe-joined
   */
  async function uploadGenderImages(baseCode, gender) {
    console.log(`[UPLOAD] ${baseCode}/${gender} — iniciando...`);

    const folderPath = state.diskFolderPath;
    console.log(`[UPLOAD] folderPath="${folderPath}", codeBase="${baseCode}", gender="${gender}"`);

    if (!folderPath || !folderPath.trim()) {
      throw new Error(`Caminho da pasta não configurado. Volte à Etapa 2 e informe o caminho.`);
    }

    return await uploadFromDisk(baseCode, gender, folderPath.trim());
  }

  /**
   * Upload de imagens APC por COR.
   * Estrutura de pastas: folderPath/baseCode/MASC/PRETA/, folderPath/baseCode/FEM/PRETA/
   * Usa o endpoint upload-from-folder-direct para cada subpasta (MASC+FEM)
   * e combina as URLs.
   */
  async function uploadApcColorImages(baseCode, color, genderKey) {
    const folderPath = state.diskFolderPath;
    if (!folderPath || !folderPath.trim()) {
      throw new Error(`Caminho da pasta não configurado.`);
    }

    const VARIANT_MAP = { Preto: 'PRETA', Branco: 'BRANCA', Bege: 'BEGE' };
    const variant = VARIANT_MAP[color] || color.toUpperCase();
    const basePath = folderPath.trim();
    const gender = genderKey || 'MASC';

    // Caminho esperado: basePath/baseCode/GENDER/VARIANT (ex: .../APC0570/MASC/PRETA)
    const colorFolder = `${basePath}/${baseCode}/${gender}/${variant}`.replace(/\//g, '\\');
    const collectionId = `${baseCode}_${gender}_${variant}`;

    console.log(`[APC UPLOAD] Tentando: ${colorFolder} → ${collectionId}`);

    const tryUpload = async (folder, colId) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);
        const response = await fetch('/api/s3-proxy/upload-from-folder-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: folder, collectionId: colId }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return { error: errData.error || `HTTP ${response.status}` };
        }
        const data = await response.json();
        if (data.success && data.urls && data.urls.length > 0) {
          console.log(`[APC UPLOAD] ✅ ${colId}: ${data.urls.length} URLs`);
          return { urls: data.urls };
        }
        return { error: 'Pasta vazia — sem imagens' };
      } catch (err) {
        if (err.name === 'AbortError') return { error: 'Timeout' };
        return { error: err.message };
      }
    };

    // Tentativa 1: GENDER/VARIANT
    let result = await tryUpload(colorFolder, collectionId);

    // Tentativa 2: sem GENDER (basePath/baseCode/VARIANT)
    if (result.error) {
      const directFolder = `${basePath}/${baseCode}/${variant}`.replace(/\//g, '\\');
      const directId = `${baseCode}_${variant}`;
      console.log(`[APC UPLOAD] Fallback sem gênero: ${directFolder}`);
      const result2 = await tryUpload(directFolder, directId);
      if (result2.urls) result = result2;
    }

    if (result.error) {
      throw new Error(`${gender}/${variant}: ${result.error}. Verifique: ${colorFolder}`);
    }

    return result.urls.map(u => u.trim()).join(' | ');
  }


  /**
   * Upload via disco (server lê arquivos locais)
   */
  async function uploadFromDisk(baseCode, gender, folderPath) {
    uploadState.progress.currentImg = 0;
    uploadState.progress.totalImgs = 1;
    updateUploadUI();

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);

        const response = await fetch('/api/s3-proxy/upload-from-disk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderPath: folderPath,
            codeBase: baseCode,
            gender: gender,
            autoRename: state.autoRename !== false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.joined) {
          throw new Error(data.error || 'Nenhuma imagem processada');
        }

        uploadState.progress.currentImg = data.total;
        uploadState.progress.totalImgs = data.total;
        updateUploadUI();

        return data.joined;
      } catch (err) {
        const msg = err.name === 'AbortError' ? 'Timeout (5min)' : err.message;

        if (attempt < MAX_RETRIES) {
          const delay = 3000 * attempt;
          window.HUB.showToast(`⚠️ Tentativa ${attempt}/${MAX_RETRIES} para ${baseCode}: ${msg}`, 'warning');
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw new Error(`${baseCode} (${gender}): ${msg}`);
        }
      }
    }
  }

  /**
   * Faz upload automático de TODOS os códigos pendentes.
   * Processa cada GÊNERO separadamente (MASC → FEM → INF),
   * gerando um link pipe-joined único por gênero.
   */
  async function uploadAllCodes() {
    if (uploadState.isUploading) return;

    const hasDiskPath = state.diskFolderPath && state.diskFolderPath.trim();

    if (!hasDiskPath) {
      window.HUB.showToast('❌ Configure o caminho da pasta na Etapa 2!', 'error');
      return;
    }

    // Conta total de jobs pendentes (1 job = 1 código + 1 gênero OU 1 código + 1 cor para APC)
    let totalJobs = 0;
    const pendingJobs = []; // { code, gender, genderCode, apcColor? }

    for (const code of state.generatedCodes) {
      const codeGroup = getGroupById(code._groupId);

      if (code._isAPC) {
        // APC: 1 job por GÊNERO × COR
        const colors = codeGroup ? activeApcColors(codeGroup) : APC_COLORS;
        const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
        for (const g of genders) {
          const genderKey = g === 'masc' ? 'MASC' : 'FEM';
          for (const cor of colors) {
            const urlKey = `${code.base}_${genderKey}_${cor}`;
            const url = state.imageUrls[urlKey];
            if (!url || !url.trim()) {
              pendingJobs.push({ code, gender: g, genderCode: urlKey, apcColor: cor, apcGenderKey: genderKey });
              totalJobs++;
            }
          }
        }
      } else {
        // Normal: 1 job por GÊNERO
        const gendersList = codeGroup ? activeGenders(codeGroup) : ['masc'];
        for (const g of gendersList) {
          if (!code[g]) continue;
          const url = state.imageUrls[code[g]];
          if (!url || !url.trim()) {
            pendingJobs.push({ code, gender: g, genderCode: code[g] });
            totalJobs++;
          }
        }
      }
    }

    if (totalJobs === 0) {
      window.HUB.showToast('Todos os códigos já possuem links! 🎉', 'success');
      return;
    }

    uploadState = {
      isUploading: true,
      aborted: false,
      currentCode: '',
      currentGender: '',
      startTime: Date.now(),
      progress: { done: 0, total: totalJobs, currentImg: 0, totalImgs: 0 },
    };

    showUploadProgress(true);
    updateUploadUI();

    let doneJobs = 0;

    try {
    for (const job of pendingJobs) {
      if (uploadState.aborted) break;

      const { code, gender: g, genderCode, apcColor } = job;

      uploadState.currentCode = code.base;
      uploadState.currentGender = apcColor || g;
      updateUploadUI();

      // Highlight the current card
      const card = document.querySelector(`.ap-link-code-card[data-base="${code.base}"]`);
      if (card) {
        card.classList.add('ap-uploading-card');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      try {
        let joined;

        if (apcColor) {
          // ═══ APC: Upload por COR ═══
          joined = await uploadApcColorImages(code.base, apcColor, job.apcGenderKey || 'MASC');
        } else {
          // ═══ NORMAL: Upload por GÊNERO ═══
          joined = await uploadGenderImages(code.base, g);
        }

        // Salva o link
        state.imageUrls[genderCode] = joined;

        // Update the input field
        const input = document.querySelector(`.ap-link-input[data-code="${genderCode}"]`);
        if (input) {
          input.value = joined;
          input.style.borderColor = TIFFANY + '40';
        }

        // Update row status
        const row = document.querySelector(`.ap-gender-row[data-gender-code="${genderCode}"]`);
        if (row) {
          const statusEl = row.querySelector('.ap-gender-status');
          if (statusEl) {
            statusEl.textContent = '✅';
            statusEl.style.color = TIFFANY;
          }
          row.style.borderColor = TIFFANY + '30';
          row.style.background = 'rgba(127, 0, 255,0.03)';
        }

        doneJobs++;
        uploadState.progress.done = doneJobs;
        updateUploadUI();
        saveSession();

      } catch (err) {
        console.error(`Upload error ${code.base}/${apcColor || g}:`, err);
        // Marcar a row como erro visualmente
        const row = document.querySelector(`.ap-gender-row[data-gender-code="${genderCode}"]`);
        if (row) {
          const statusEl = row.querySelector('.ap-gender-status');
          if (statusEl) { statusEl.textContent = '❌'; statusEl.style.color = '#ef4444'; }
          row.style.borderColor = '#ef444430';
        }
        window.HUB.showToast(`❌ ${code.base} ${apcColor || g}: ${err.message}`, 'error');
      }

      // Check if ALL slots of this code are done → mark card
      const currentGroup = getGroupById(code._groupId);

      if (code._isAPC) {
        // APC: check this specific gender block
        const gk = job.apcGenderKey || 'MASC';
        const codeColors = currentGroup ? activeApcColors(currentGroup) : APC_COLORS;
        const blockDone = codeColors.every(c => {
          const u = state.imageUrls[`${code.base}_${gk}_${c}`];
          return u && u.trim();
        });
        const genderCard = document.querySelector(`.ap-link-code-card[data-base="${code.base}"][data-apc-gender="${gk}"]`);
        if (genderCard) genderCard.classList.remove('ap-uploading-card');
        if (blockDone && genderCard) {
          genderCard.style.borderLeftColor = TIFFANY_D;
          genderCard.setAttribute('data-done', 'true');
        }
      } else {
        // Normal: check all genders
        const codeGenders = currentGroup ? activeGenders(currentGroup) : ['masc'];
        const allSlotsDone = codeGenders.every(gg => {
          if (!code[gg]) return true;
          const u = state.imageUrls[code[gg]];
          return u && u.trim();
        });
        if (card) card.classList.remove('ap-uploading-card');
        if (allSlotsDone && card) {
          card.style.borderLeftColor = TIFFANY_D;
          card.setAttribute('data-done', 'true');
        }
      }

      // Delay entre uploads
      if (!uploadState.aborted) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    } catch (loopErr) {
      console.error('Upload loop error:', loopErr);
      window.HUB.showToast(`❌ Erro inesperado no upload: ${loopErr.message}`, 'error');
    } finally {
      // SEMPRE resetar isUploading, mesmo com crash
      uploadState.isUploading = false;
      showUploadProgress(false);
    }

    if (uploadState.aborted) {
      window.HUB.showToast(`⚠️ Upload cancelado. ${doneJobs} de ${totalJobs} concluídos.`, 'warning');
    } else {
      window.HUB.showToast(`🎉 Upload completo! ${doneJobs} link(s) gerados com sucesso!`, 'success');
    }

    render(); // Refresh to update all counters
  }

  /**
   * Faz upload de um único código
   */
  async function uploadSingleCode(baseCode, genderArg) {
    if (uploadState.isUploading) {
      window.HUB.showToast('Upload em andamento, aguarde...', 'warning');
      return;
    }

    const code = state.generatedCodes.find(c => c.base === baseCode);
    if (!code) return;
    const codeGroup = getGroupById(code._groupId);

    const hasDiskPath = state.diskFolderPath && state.diskFolderPath.trim();
    if (!hasDiskPath) {
      window.HUB.showToast(`Configure o caminho da pasta na Etapa 2.`, 'error');
      return;
    }

    let done = 0; // Function-scoped — accessed in both APC/non-APC paths and final toast

    if (code._isAPC) {
      // ═══ APC: Upload por GÊNERO × COR ═══
      const colors = codeGroup ? activeApcColors(codeGroup) : APC_COLORS;
      const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];

      // Determine which gender block to upload (from button data-apc-gender)
      const clickedGender = genderArg; // passed from click handler
      const targetGenders = clickedGender ? [clickedGender === 'MASC' ? 'masc' : 'fem'] : genders;

      // Build list of pending slots: { gender, genderKey, color }
      const pendingSlots = [];
      targetGenders.forEach(g => {
        const genderKey = g === 'masc' ? 'MASC' : 'FEM';
        colors.forEach(cor => {
          const urlKey = `${baseCode}_${genderKey}_${cor}`;
          const url = state.imageUrls[urlKey];
          if (!url || !url.trim()) {
            pendingSlots.push({ gender: g, genderKey, color: cor, urlKey });
          }
        });
      });

      if (pendingSlots.length === 0) {
        window.HUB.showToast(`${baseCode} já está completo`, 'info');
        return;
      }

      uploadState = {
        isUploading: true,
        aborted: false,
        currentCode: baseCode,
        currentGender: '',
        startTime: Date.now(),
        progress: { done: 0, total: pendingSlots.length, currentImg: 0, totalImgs: 0 },
      };

      showUploadProgress(true);

      let errors = 0;
      for (const slot of pendingSlots) {
        if (uploadState.aborted) break;

        uploadState.currentGender = `${slot.genderKey} ${slot.color}`;
        uploadState.progress.currentImg = 0;
        uploadState.progress.totalImgs = 1;
        updateUploadUI();

        // Highlight the correct gender card
        const card = document.querySelector(`.ap-link-code-card[data-base="${baseCode}"][data-apc-gender="${slot.genderKey}"]`);
        if (card) card.classList.add('ap-uploading-card');

        try {
          const joined = await uploadApcColorImages(baseCode, slot.color, slot.genderKey);
          state.imageUrls[slot.urlKey] = joined;

          const input = document.querySelector(`.ap-link-input[data-code="${slot.urlKey}"]`);
          if (input) {
            input.value = joined;
            input.style.borderColor = TIFFANY + '40';
          }

          const colorRow = document.querySelector(`.ap-gender-row[data-gender-code="${slot.urlKey}"]`);
          if (colorRow) {
            const statusEl = colorRow.querySelector('.ap-gender-status');
            if (statusEl) { statusEl.textContent = '✅'; statusEl.style.color = TIFFANY; }
            colorRow.style.borderColor = TIFFANY + '30';
          }

          done++;
          uploadState.progress.done = done;
          updateUploadUI();
          saveSession();
        } catch (err) {
          errors++;
          // Marcar a row como erro
          const colorRow = document.querySelector(`.ap-gender-row[data-gender-code="${slot.urlKey}"]`);
          if (colorRow) {
            const statusEl = colorRow.querySelector('.ap-gender-status');
            if (statusEl) { statusEl.textContent = '❌'; statusEl.style.color = '#ef4444'; }
            colorRow.style.borderColor = '#ef444430';
          }
          window.HUB.showToast(`❌ ${baseCode} ${slot.genderKey}/${slot.color}: ${err.message}`, 'error');
        }
      }

      if (errors > 0) {
        window.HUB.showToast(`⚠️ ${errors} cor(es) sem imagens. Verifique as pastas BRANCA/BEGE dentro de ${baseCode}/MASC e ${baseCode}/FEM`, 'warning');
      }

      // Check allDone for each gender card
      genders.forEach(g => {
        const gk = g === 'masc' ? 'MASC' : 'FEM';
        const card = document.querySelector(`.ap-link-code-card[data-base="${baseCode}"][data-apc-gender="${gk}"]`);
        if (!card) return;
        card.classList.remove('ap-uploading-card');
        const allDone = colors.every(cor => {
          const u = state.imageUrls[`${baseCode}_${gk}_${cor}`];
          return u && u.trim();
        });
        if (allDone) {
          card.style.borderLeftColor = TIFFANY_D;
          card.setAttribute('data-done', 'true');
        }
      });

    } else {
      // ═══ NORMAL: Upload por GÊNERO (inalterado) ═══
      const gendersList = codeGroup ? activeGenders(codeGroup) : ['masc'];

      const pendingGenders = gendersList.filter(g => {
        if (!code[g]) return false;
        const url = state.imageUrls[code[g]];
        if (url && url.trim()) return false;
        return hasDiskPath;
      });

      if (pendingGenders.length === 0) {
        window.HUB.showToast(`${baseCode} já está completo ou sem imagens`, 'info');
        return;
      }

      uploadState = {
        isUploading: true,
        aborted: false,
        currentCode: baseCode,
        currentGender: '',
        startTime: Date.now(),
        progress: { done: 0, total: pendingGenders.length, currentImg: 0, totalImgs: 0 },
      };

      showUploadProgress(true);
      const card = document.querySelector(`.ap-link-code-card[data-base="${baseCode}"]`);
      if (card) card.classList.add('ap-uploading-card');

      for (const g of pendingGenders) {
        if (uploadState.aborted) break;

        uploadState.currentGender = g;
        uploadState.progress.currentImg = 0;
        uploadState.progress.totalImgs = 1;
        updateUploadUI();

        try {
          const joined = await uploadGenderImages(baseCode, g);
          state.imageUrls[code[g]] = joined;

          const input = document.querySelector(`.ap-link-input[data-code="${code[g]}"]`);
          if (input) {
            input.value = joined;
            input.style.borderColor = TIFFANY + '40';
          }

          const genderRow = document.querySelector(`.ap-gender-row[data-gender-code="${code[g]}"]`);
          if (genderRow) {
            const statusEl = genderRow.querySelector('.ap-gender-status');
            if (statusEl) { statusEl.textContent = '✅'; statusEl.style.color = TIFFANY; }
            genderRow.style.borderColor = TIFFANY + '30';
          }

          done++;
          uploadState.progress.done = done;
          updateUploadUI();
        } catch (err) {
          window.HUB.showToast(`❌ Erro ${baseCode} ${genderLabel(g)}: ${err.message}`, 'error');
        }
      }

      if (card) card.classList.remove('ap-uploading-card');
      const allDone = gendersList.every(g => {
        if (!code[g]) return true;
        const u = state.imageUrls[code[g]];
        return u && u.trim();
      });
      if (allDone && card) {
        card.style.borderLeftColor = TIFFANY_D;
        card.setAttribute('data-done', 'true');
      }
    }

    uploadState.isUploading = false;
    showUploadProgress(false);

    if (!uploadState.aborted) {
      window.HUB.showToast(`✅ ${baseCode} — ${done} link(s) gerados!`, 'success');
    }

    render();
  }

  function showUploadProgress(show) {
    const el = document.getElementById('ap-upload-progress');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  function updateUploadUI() {
    const statusEl = document.getElementById('ap-upload-status');
    const detailEl = document.getElementById('ap-upload-detail');
    const barEl = document.getElementById('ap-upload-bar');

    if (!statusEl) return;

    const p = uploadState.progress;
    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;

    // #11 ETA calculation
    let etaText = '';
    if (p.done > 0 && uploadState.startTime) {
      const elapsed = (Date.now() - uploadState.startTime) / 1000; // seconds
      const avgPerJob = elapsed / p.done;
      const remaining = Math.ceil(avgPerJob * (p.total - p.done));
      if (remaining > 60) {
        etaText = ` · ~${Math.ceil(remaining / 60)}min restante(s)`;
      } else if (remaining > 0) {
        etaText = ` · ~${remaining}s restante(s)`;
      }
    }

    statusEl.textContent = `Enviando... ${p.done}/${p.total} gêneros (${pct}%)${etaText}`;
    detailEl.textContent = `📁 ${uploadState.currentCode} → ${genderLabel(uploadState.currentGender)} (${p.totalImgs} imagens)`;
    barEl.style.width = pct + '%';
  }

  function bindStep3() {

    // Open BRK Bunker (manual organizer)
    const openBtn = document.getElementById('ap-open-link-gen');
    if (openBtn) openBtn.addEventListener('click', () => {
      window.open('https://brk-bunker.allexadriel.workers.dev/images', '_blank');
    });

    // 🚀 AUTO UPLOAD ALL
    const autoBtn = document.getElementById('ap-auto-upload-all');
    if (autoBtn) autoBtn.addEventListener('click', () => uploadAllCodes());

    // BRK Link health check
    const s3Badge = document.getElementById('ap-s3-status');
    if (s3Badge) {
      fetch('/api/s3-proxy/health').then(r => r.json()).then(data => {
        if (data.online) {
          s3Badge.textContent = '🟢 BRK Link Online';
          s3Badge.style.color = TIFFANY;
          s3Badge.style.background = 'rgba(127, 0, 255,0.08)';
        } else {
          s3Badge.textContent = '🔴 BRK Link Offline';
          s3Badge.style.color = '#ef4444';
          s3Badge.style.background = 'rgba(239,68,68,0.08)';
        }
      }).catch(() => {
        s3Badge.textContent = '⚠️ Sem resposta';
        s3Badge.style.color = '#f59e0b';
      });
    }

    // 🚀 Single code upload buttons
    $$('.ap-upload-single-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        uploadSingleCode(btn.dataset.base, btn.dataset.apcGender || null);
      });
    });

    // 🗑️ CLEAR ALL LINKS
    const clearAllBtn = document.getElementById('ap-clear-all-links');
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
      if (!confirm('Tem certeza que deseja apagar TODOS os links gerados?')) return;
      state.imageUrls = {};
      saveSession();
      render();
      window.HUB.showToast('🗑️ Todos os links foram apagados', 'warning');
    });

    // 🗑️ CLEAR per-code links
    $$('.ap-clear-code-links').forEach(btn => {
      btn.addEventListener('click', () => {
        const base = btn.dataset.base;
        const code = state.generatedCodes.find(c => c.base === base);
        if (!code) return;

        if (code._isAPC) {
          // APC: delete gender+color keys
          const codeGroup = getGroupById(code._groupId);
          const colors = codeGroup ? activeApcColors(codeGroup) : APC_COLORS;
          const apcGender = btn.dataset.apcGender; // MASC or FEM or undefined
          const genderKeys = apcGender ? [apcGender] : ['MASC', 'FEM'];
          genderKeys.forEach(gk => {
            colors.forEach(cor => {
              const urlKey = `${base}_${gk}_${cor}`;
              if (state.imageUrls[urlKey]) delete state.imageUrls[urlKey];
            });
          });
          // Also clean legacy keys
          colors.forEach(cor => {
            const legacyKey = `${base}_${cor}`;
            if (state.imageUrls[legacyKey]) delete state.imageUrls[legacyKey];
          });
        } else {
          // Normal: delete gender-based keys
          const codeGroup = getGroupById(code._groupId);
          const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
          genders.forEach(g => {
            if (code[g] && state.imageUrls[code[g]]) {
              delete state.imageUrls[code[g]];
            }
          });
        }
        saveSession();
        render();
        window.HUB.showToast(`🗑️ Links de ${base} apagados`, 'warning');
      });
    });

    // Cancel upload
    const cancelBtn = document.getElementById('ap-upload-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      uploadState.aborted = true;
      window.HUB.showToast('Cancelando upload...', 'warning');
    });

    // Scroll to next pending
    const scrollBtn = document.getElementById('ap-scroll-next-pending');
    if (scrollBtn) scrollBtn.addEventListener('click', () => {
      const pendingCard = document.querySelector('.ap-link-code-card:not([data-done="true"])');
      if (pendingCard) {
        pendingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pendingCard.style.boxShadow = `0 0 0 2px ${TIFFANY}60`;
        setTimeout(() => { pendingCard.style.boxShadow = ''; }, 2000);
      } else {
        window.HUB.showToast('Todos os códigos já foram preenchidos! 🎉', 'success');
      }
    });

    // Filter pills
    $$('.ap-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        state.linkFilter = pill.dataset.filter;
        render();
      });
    });

    // Bind manual link inputs
    bindLinkInputs();

    const prevBtn = document.getElementById('ap-prev-3');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(2));

    const nextBtn = document.getElementById('ap-next-3');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(3));
  }

  function bindLinkInputs() {
    $$('.ap-link-input').forEach(input => {
      input.addEventListener('input', () => {
        state.imageUrls[input.dataset.code] = input.value;
        saveSession();
      });

      input.addEventListener('paste', () => {
        setTimeout(() => {
          const codeKey = input.dataset.code;
          const gender = input.dataset.gender;
          const base = input.dataset.base;
          const apcColor = input.dataset.apcColor; // set for APC inputs
          state.imageUrls[codeKey] = input.value;

          input.style.borderColor = TIFFANY + '40';
          const card = input.closest('.ap-link-code-card');

          const code = state.generatedCodes.find(c => c.base === base);
          if (code) {
            let allDone = false;

            if (code._isAPC) {
              // APC: check this gender block
              const apcGender = input.dataset.apcGender || 'MASC';
              const codeGroup = getGroupById(code._groupId);
              const colors = codeGroup ? activeApcColors(codeGroup) : APC_COLORS;
              allDone = colors.every(cor => {
                const url = state.imageUrls[`${base}_${apcGender}_${cor}`];
                return url && url.trim();
              });
            } else {
              // Normal: check by gender
              const codeGroup = code ? getGroupById(code._groupId) : null;
              const gendersList = codeGroup ? activeGenders(codeGroup) : ['masc'];
              allDone = gendersList.every(g => {
                if (!code[g]) return true;
                const url = state.imageUrls[code[g]];
                return url && url.trim();
              });
            }

            if (allDone && card) {
              card.style.borderLeftColor = TIFFANY_D;
              card.setAttribute('data-done', 'true');
              window.HUB.showToast(`✅ ${base} completo!`, 'success');

              setTimeout(() => {
                const nextPending = document.querySelector('.ap-link-code-card:not([data-done="true"])');
                if (nextPending) {
                  nextPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  nextPending.style.boxShadow = `0 0 0 2px ${TIFFANY}40`;
                  setTimeout(() => { nextPending.style.boxShadow = ''; }, 1500);
                }
              }, 300);
            } else {
              const label = apcColor ? `${apcColor}` : genderLabel(gender);
              window.HUB.showToast(`🔗 Link ${label} salvo para ${base}`, 'info');
            }
          }
        }, 50); // small delay to capture pasted value
      });

      // On blur: just save
      input.addEventListener('blur', () => {
        state.imageUrls[input.dataset.code] = input.value;
        saveSession();
      });
    });
  }

  // ───────── Step 4: Revisão de Estampas ─────────

  function renderStep4_Estampas() {
    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${TIFFANY}">🎨 Revisão de Estampas</h3>
        <p style="color:#9ca3af;font-size:14px;margin-bottom:24px">Defina o nome de cada estampa. O nome será usado no título SEO do produto.</p>
        <div style="display:flex;flex-direction:column;gap:8px">`;

    const bases = [...new Set(state.generatedCodes.map(c => c.base))];
    let filled = 0;

    bases.forEach(base => {
      const val = state.estampas[base] || state.estampaSuggestions[base] || '';
      if (val.trim()) filled++;

      const codeObj = state.generatedCodes.find(c => c.base === base);
      const group = codeObj._groupId ? getGroupById(codeObj._groupId) : getFirstGroup();
      
      const type = codeObj.productType || group.productType;
      const brand = state.brand || 'BRK FISHING';
      const preview = buildProductTitle(type, brand, val, 'masc');

      html += `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,0,0,.15);border-radius:8px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08)">
          <span style="font-family:monospace;font-weight:700;color:#e5e7eb;min-width:90px">📁 ${esc(base)}</span>
          <input type="text" class="form-input ap-estampa-input" data-base="${esc(base)}" 
            value="${esc(val)}" placeholder="Nome da estampa..." 
            style="flex:1;font-size:13px;padding:8px 12px" />
          <button class="btn btn--secondary ap-estampa-suggest" data-base="${esc(base)}" 
            style="font-size:11px;padding:4px 10px;background:rgba(0,0,0,.2)" title="Sugerir nome">🎲</button>
          <span class="ap-estampa-preview" data-base="${esc(base)}" data-type="${esc(type)}"
            style="font-size:11px;color:#6b7280;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(preview)}">
            → ${esc(preview)}
          </span>
        </div>`;
    });

    html += `
        </div>
        <div style="margin-top:16px;font-size:14px;color:${filled === bases.length ? TIFFANY : '#f59e0b'}">
          ${filled === bases.length ? '✅' : '⚠️'} ${filled} de ${bases.length} estampas definidas
        </div>
      </div>
      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px">
        <button class="btn btn--secondary" id="ap-prev-4-est">← Voltar</button>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn--secondary" id="ap-skip-estampas" style="color:#f59e0b;border-color:#f59e0b40" title="Pular esta etapa e ir direto para a planilha">
            ⏩ Pular Estampas
          </button>
          <button class="btn btn--primary" id="ap-next-4-est" style="min-width:180px">Próximo Passo →</button>
        </div>
      </div>
    </div>`;

    return html;
  }

  function bindStep4_Estampas() {
    $$('.ap-estampa-input').forEach(input => {
      input.addEventListener('input', () => {
        const base = input.dataset.base;
        state.estampas[base] = input.value;
        saveSession();
        
        const previewEl = document.querySelector(`.ap-estampa-preview[data-base="${base}"]`);
        if (previewEl) {
          const type = previewEl.dataset.type;
          const preview = buildProductTitle(type, state.brand || 'BRK FISHING', input.value, 'masc');
          previewEl.textContent = '→ ' + preview;
          previewEl.title = preview;
        }
      });
    });

    $$('.ap-estampa-suggest').forEach(btn => {
      btn.addEventListener('click', () => {
        const base = btn.dataset.base;
        const brandKey = (state.brand || '').toLowerCase().includes('agro') ? 'agro' 
          : (state.brand || '').toLowerCase().includes('motor') ? 'motors' : 'fishing';
        
        const newName = Estampas.generateEstampaName(brandKey, Object.values(state.estampas));
        const input = document.querySelector(`.ap-estampa-input[data-base="${base}"]`);
        if (input) {
          input.value = newName;
          state.estampas[base] = newName;
          saveSession();
          
          const previewEl = document.querySelector(`.ap-estampa-preview[data-base="${base}"]`);
          if (previewEl) {
            const type = previewEl.dataset.type;
            const preview = buildProductTitle(type, state.brand || 'BRK FISHING', newName, 'masc');
            previewEl.textContent = '→ ' + preview;
            previewEl.title = preview;
          }
        }
      });
    });

    const prevBtn = document.getElementById('ap-prev-4-est');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(3));

    const nextBtn = document.getElementById('ap-next-4-est');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(4));

    const skipBtn = document.getElementById('ap-skip-estampas');
    if (skipBtn) skipBtn.addEventListener('click', () => {
      // Skip estampas — fill with group estampaName or placeholder
      const bases = [...new Set(state.generatedCodes.map(c => c.base))];
      bases.forEach(base => {
        if (!state.estampas[base] || !state.estampas[base].trim()) {
          const code = state.generatedCodes.find(c => c.base === base);
          const codeGroup = code ? getGroupById(code._groupId) : null;
          state.estampas[base] = (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim())
            || state.estampaSuggestions[base] || '';
        }
      });
      state.completedSteps.add(4); // Mark Step 4 as completed for stepper
      saveSession();
      goToStep(5); // Skip directly to planilha
    });
  }

  // ───────── Step 5: Planilha Final ─────────

  function renderStep4() {
    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- EAN Section -->
      <div style="padding:16px;background:rgba(127, 0, 255,.06);border:1px solid rgba(127, 0, 255,.12);border-radius:8px;margin-bottom:20px"><small style="color:#9ca3af">ℹ️ EANs não são necessários. As colunas EAN/EAN Emb. serão exportadas vazias no CSV.</small></div>

      <!-- CSV Preview -->
      <div class="card" style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;color:${TIFFANY}">📄 Preview da Planilha</h3>
          <button class="btn btn--secondary" id="ap-generate-preview" style="font-size:13px">🔄 Gerar Preview</button>
        </div>
        <div id="ap-csv-preview" style="overflow-x:auto;max-height:420px;overflow-y:auto">
          ${state.csvRows.length ? renderCsvTable() : '<p style="color:#6b7280;text-align:center;padding:32px">Clique em "Gerar Preview" para visualizar a planilha</p>'}
        </div>
      </div>

      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px">
        <button class="btn btn--secondary" id="ap-prev-4">← Voltar</button>
        <button class="btn btn--primary" id="ap-next-4" style="min-width:180px">Próximo Passo →</button>
      </div>
    </div>`;

    return html;
  }

  function buildCsvRows() {
    const rows = [];

    const hasAPC = state.generatedCodes.some(c => c._isAPC);
    const hasNormal = state.generatedCodes.some(c => !c._isAPC);

    if (hasAPC) {
      // ═══════════════════════════════════════
      // APC — Padrão APC0541 / APC0541BL
      // MASC = código base (APC0541) + variações
      // FEM  = código base + BL (APC0541BL) + variações
      // Cada bloco: PAI + variações (cor × tamanho)
      // ═══════════════════════════════════════
      const defaultColors = activeApcColors();
      const ncm = '6205.20.00';
      const marca = state.brand || 'BRK FISHING';
      const preco = state.price || '0';

      const GENDER_SUFFIX = { masc: '', fem: 'BL' };

      let apcIndex = 0;
      state.generatedCodes.forEach((code) => {
        if (!code._isAPC) return;
        const codeGroup = code._groupId ? getGroupById(code._groupId) : getFirstGroup();
        const codeColors = codeGroup ? activeApcColors(codeGroup) : defaultColors;
        const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
        const prefix = codeGroup && codeGroup.apcPrefix && codeGroup.apcPrefix.trim()
          ? codeGroup.apcPrefix.trim().toUpperCase() : 'PREMIUM';
        const estampa = (state.estampas[code.base] && state.estampas[code.base].trim())
          || (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim())
          || '*ESTAMPA A SER DEFINIDA';
        const baseCode = code.base;

        // Gerar um bloco para cada gênero
        genders.forEach((g, gIdx) => {
          const genderKey = g === 'masc' ? 'MASC' : 'FEM';
          const suffix = GENDER_SUFFIX[g] || '';
          const parentCode = baseCode + suffix; // APC0541 ou APC0541BL
          const sizes = sizesFor(g, 'APC');

          // Separador entre blocos
          if (apcIndex > 0) {
            rows.push({ _isEmpty: true });
          }

          const titulo = buildProductTitle('APC', marca, estampa, g);

          // URLs do PAI: imagens da primeira cor deste gênero
          const firstColor = codeColors[0] || 'Preto';
          const paiUrls = (
            state.imageUrls[`${baseCode}_${genderKey}_${firstColor}`] ||
            state.imageUrls[`${baseCode}_${firstColor}`] || // fallback legado
            ''
          ).trim();

          // ─── Linha PAI ───
          rows.push({
            _isParent: true,
            _gender: g,
            _isAPC: true,
            _apcColor: firstColor,
            codigo: parentCode,
            descricao: titulo,
            ncm,
            preco,
            marca,
            estoque: '0',
            pesoLiq: '0,25',
            pesoBruto: '0,25',
            ean: '',
            eanEmb: '',
            codigoPai: '',
            produtoVariacao: 'Variação',
            imagens: paiUrls,
            tamanho: '',
            grupoProdutos: '',
            largura: '22',
            altura: '4',
            profundidade: '30',
          });

          // ─── Variações (cor × tamanho) ───
          codeColors.forEach(cor => {
            const corDesc = { Preto: 'Preto', Branco: 'Branco', Bege: 'Bege' }[cor] || cor;
            const corCode = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();
            const colorUrls = (
              state.imageUrls[`${baseCode}_${genderKey}_${cor}`] ||
              state.imageUrls[`${baseCode}_${cor}`] || // fallback legado
              ''
            ).trim();

            sizes.forEach(size => {
              const varCode = `${parentCode}-${prefix}-${corCode}-${size}`;

              rows.push({
                _isParent: false,
                _gender: g,
                _isAPC: true,
                _apcColor: cor,
                codigo: varCode,
                descricao: `Cor:${corDesc};Tamanho:${size}`,
                ncm,
                preco,
                marca,
                estoque: '0',
                pesoLiq: '0,25',
                pesoBruto: '0,25',
                ean: '',
                eanEmb: '',
                codigoPai: parentCode,
                produtoVariacao: 'Variação',
                imagens: colorUrls,
                tamanho: size,
                grupoProdutos: '',
                largura: '22',
                altura: '4',
                profundidade: '30',
              });
            });
          });

          apcIndex++;
        });
      });

    }

    if (hasNormal) {
      // ═══════════════════════════════════════
      // Produtos normais (Raglan, Camisa UV, etc.)
      // ═══════════════════════════════════════

      // NCM por gênero
      const NCM_GENDER = {
        masc: '6101.30.00',
        fem:  '6102.30.00',
        inf:  '6101.30.00',
      };

      state.generatedCodes.forEach(code => {
        if (code._isAPC) return; // Skip APC codes — handled above
        const codeGroup = code._groupId ? getGroupById(code._groupId) : getFirstGroup();
        const genders = codeGroup ? activeGenders(codeGroup) : ['masc'];
        genders.forEach(g => {
          const codeKey = code[g]; // C02759, C02759BL, C02759I
          if (!codeKey) return;

          const sizes  = sizesFor(g, code.productType || getFirstGroup().productType);
          const urls   = (state.imageUrls[codeKey] || '').trim();
          const ncm    = NCM_GENDER[g] || '6101.30.00';
          const marca  = state.brand || '';

          // #2 Preço por gênero — INF sempre usa priceInf (129,90)
          let preco = state.price || '0';
          if (g === 'inf' && state.priceInf) {
            preco = state.priceInf; // Infantil sempre 129,90
          } else if (state.pricePerGender) {
            if (g === 'fem' && state.priceFem) preco = state.priceFem;
          }

          // Get estampa from the code's group (codeGroup already defined above)
          const estampa = (state.estampas[code.base] && state.estampas[code.base].trim()) || (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim()) || '*ESTAMPA A SER DEFINIDA';
          const codeProductType = code.productType || getFirstGroup().productType;

          // Use buildProductTitle for correct type-based titles
          const titulo = buildProductTitle(codeProductType, marca, estampa, g);

          // ─── Produto (linha PAI) ───
          rows.push({
            _isParent: true,
            _gender: g,
            codigo: codeKey,
            descricao: titulo,
            ncm,
            preco,
            marca,
            estoque: '0',    // PAI estoque = 0
            pesoLiq: getWeightForSize(codeProductType, g, 'default'),
            pesoBruto: getWeightForSize(codeProductType, g, 'default'),
            ean: '',
            eanEmb: '',
            codigoPai: '',   // PAI não tem código pai
            produtoVariacao: 'Produto',
            imagens: urls,
            tamanho: '',
          });

          // ─── Variações (linha FILHA por tamanho) ───
          sizes.forEach(size => {
            rows.push({
              _isParent: false,
              _gender: g,
              codigo: `${codeKey}${size}`,  // SEM traço: C02820PP
              descricao: `Tamanho:${size || 'Único'}`,
              ncm,
              preco,
              marca,
              estoque: '1000',
              pesoLiq: getWeightForSize(codeProductType, g, size),
              pesoBruto: getWeightForSize(codeProductType, g, size),
              ean: '',        // Vazio — usuário preenche manualmente
              eanEmb: '',     // Vazio — usuário preenche manualmente
              codigoPai: codeKey,
              produtoVariacao: 'Variação',
              imagens: urls,  // IMAGENS EM TODAS AS LINHAS
              tamanho: size,
            });
          });
        });
      });
    }

    return rows;
  }

  let showFullPreview = false;

  function renderCsvTable() {
    if (!state.csvRows.length) return '';

    // #7 Compact vs Full preview
    const compactCols = ['produtoVariacao', 'codigo', 'descricao', 'codigoPai', 'estoque', 'pesoBruto', 'preco', 'marca', 'imagens'];
    const fullCols = ['produtoVariacao', 'codigo', 'descricao', 'ncm', 'codigoPai', 'estoque', 'pesoLiq', 'pesoBruto', 'preco', 'marca', 'ean', 'eanEmb', 'imagens', 'tamanho'];

    const cols = showFullPreview ? fullCols : compactCols;
    const colLabels = {
      produtoVariacao: 'Tipo', codigo: 'Código', descricao: 'Descrição', ncm: 'NCM',
      codigoPai: 'Cód. Pai', estoque: 'Estoque', pesoLiq: 'Peso Líq.', pesoBruto: 'Peso Bruto',
      preco: 'Preço', marca: 'Marca', ean: 'EAN', eanEmb: 'EAN Emb.', imagens: 'Imagens', tamanho: 'Tamanho',
    };

    let html = `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn--secondary" id="ap-toggle-preview" style="font-size:11px;padding:4px 12px">
        ${showFullPreview ? '📋 Compacto' : `📊 Ver Completo (${fullCols.length} colunas)`}
      </button>
    </div>`;

    html += '<div style="overflow-x:auto;max-width:100%">';
    html += '<table class="table" style="font-size:12px;width:100%"><thead><tr>';
    cols.forEach(c => { html += `<th style="white-space:nowrap;padding:8px 10px">${colLabels[c] || c}</th>`; });
    html += '</tr></thead><tbody>';

    state.csvRows.forEach((row, idx) => {
      if (row._isEmpty) {
        html += `<tr style="height:6px;background:transparent"><td colspan="${cols.length}"></td></tr>`;
        return;
      }
      const bg = row._isParent ? `background:${TIFFANY}08` : '';
      html += `<tr style="${bg}">`;
      cols.forEach(c => {
        let val = row[c] || '';
        if (c === 'imagens' && val.length > 20) val = '✅ ' + val.split('|').length + ' link(s)';
        else if (c === 'imagens' && !val) val = '—';
        const style = c === 'descricao' ? 'max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' : 'white-space:nowrap';
        html += `<td style="padding:6px 10px;${style}" title="${esc(row[c] || '')}">${esc(val)}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function bindStep4() {
    const genBtn = document.getElementById('ap-generate-preview');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        state.csvRows = buildCsvRows();
        const preview = document.getElementById('ap-csv-preview');
        if (preview) {
          preview.innerHTML = renderCsvTable();
          bindPreviewToggle(preview);
        }
        if (state.csvRows.length) {
          window.HUB.showToast(`Preview gerado: ${state.csvRows.length} linhas`, 'success');
        }
      });
    }

    // #7 toggle on initial render
    bindPreviewToggle(document.getElementById('ap-csv-preview'));

    const prevBtn = document.getElementById('ap-prev-4');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(4));

    const nextBtn = document.getElementById('ap-next-4');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(5));
  }

  function bindPreviewToggle(previewEl) {
    const toggleBtn = document.getElementById('ap-toggle-preview');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        showFullPreview = !showFullPreview;
        if (previewEl) {
          previewEl.innerHTML = renderCsvTable();
          bindPreviewToggle(previewEl);
        }
      });
    }
  }

  // ───────── Step 5: Exportar ─────────

  function renderStep5() {
    const totalCodes  = state.generatedCodes.length;
    const totalSkus   = totalSkuCount();
    const totalGenderCodes = state.generatedCodes.reduce((acc, c) => {
      const gList = c._groupId ? activeGenders(getGroupById(c._groupId)) : ['masc'];
      return acc + gList.filter(g => c[g]).length;
    }, 0);
    const totalImages = Object.values(state.imageUrls).filter(v => v && v.trim()).length;

    // #8 Validation checks
    const checks = [
      { label: 'Todos os códigos têm imagens', ok: totalImages >= totalGenderCodes, detail: `${totalImages}/${totalGenderCodes}` },
      { label: 'Peso definido (0,250)', ok: true, detail: '✓' },
      { label: 'Marca definida', ok: state.brand && state.brand.trim(), detail: state.brand || '—' },
      { label: 'Preço definido', ok: state.price && state.price.trim(), detail: state.price || '—' },
    ];

    // #9 Export History
    const history = getExportHistory();

    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- Summary -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 20px;color:${TIFFANY}">🎉 Resumo Final</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          ${renderStatCard('Códigos', totalCodes, '📋', TIFFANY)}
          ${renderStatCard('SKUs', totalSkus, '📦', '#3b82f6')}
          ${renderStatCard('Imagens', totalImages, '🖼️', '#8b5cf6')}
          ${renderStatCard('Marca', state.brand, '🏷️', '#f59e0b')}
        </div>
      </div>

      <!-- #8 Validation Checklist -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${TIFFANY}">✅ Validação</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${checks.map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;background:rgba(${c.ok ? '65,255,10' : '239,68,68'},0.06);border:1px solid ${c.ok ? TIFFANY + '20' : '#ef444420'}">
              <span style="font-size:16px">${c.ok ? '✅' : '⚠️'}</span>
              <span style="flex:1;font-size:13px;color:#e5e7eb">${c.label}</span>
              <span style="font-size:12px;color:${c.ok ? TIFFANY : '#f59e0b'};font-family:monospace">${c.detail}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Export Actions -->
      <div class="card" style="padding:28px;text-align:center">
        <h3 style="margin:0 0 8px;color:${TIFFANY}">📥 Exportação</h3>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 24px">
          Formato: Bling V2 (59 colunas, separador ;) — Padrão Coleção São Bento
        </p>

        <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap">
          <button class="btn btn--primary" id="ap-download-csv" style="min-width:220px;padding:14px 32px;font-size:16px">
            📥 Baixar CSV Bling
          </button>

          <button class="btn btn--secondary" id="ap-copy-csv" style="min-width:200px">
            📋 Copiar para Área de Transferência
          </button>
        </div>
      </div>

      <!-- #9 Export History -->
      ${history.length > 0 ? `
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${TIFFANY}">📜 Histórico de Exports</h3>
        <div style="max-height:200px;overflow-y:auto">
          ${history.slice(0, 10).map(h => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px">
              <span style="color:#9ca3af">${h.date || '—'}</span>
              <span style="color:#e5e7eb;font-family:monospace">${h.codes || '—'}</span>
              <span style="color:#6b7280">${h.skus || 0} SKUs</span>
              <span style="color:${TIFFANY}">${h.brand || '—'}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- #12 Theme Toggle + Restart -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px;align-items:center">
        <button class="btn btn--secondary" id="ap-prev-5">← Voltar</button>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn--secondary" id="ap-toggle-theme" style="font-size:13px;padding:8px 16px">
            ${currentTheme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
          </button>
          <button class="btn btn--secondary" id="ap-new-process" style="color:#f59e0b;border-color:#f59e0b">🔄 Novo Processo</button>
        </div>
      </div>
    </div>`;

    return html;
  }

  function generateCsvContent() {
    // Sempre reconstruir para garantir dados atualizados
    state.csvRows = buildCsvRows();

    const sep = ';';

    // ═══════════════════════════════════════════════════════════════
    // Bling V2 — 59 colunas exatas (formato COLEÇÃO SÃO BENTO)
    // ═══════════════════════════════════════════════════════════════
    const blingHeaders = [
      /*  0 */ '"ID"',
      /*  1 */ 'Código',
      /*  2 */ 'Descrição',
      /*  3 */ 'Unidade',
      /*  4 */ 'NCM',
      /*  5 */ 'Origem',
      /*  6 */ 'Preço',
      /*  7 */ 'Valor IPI fixo',
      /*  8 */ 'Observações',
      /*  9 */ 'Situação',
      /* 10 */ 'Estoque',
      /* 11 */ 'Preço de custo',
      /* 12 */ 'Cód. no fornecedor',
      /* 13 */ 'Fornecedor',
      /* 14 */ 'Localização',
      /* 15 */ 'Estoque máximo',
      /* 16 */ 'Estoque mínimo',
      /* 17 */ 'Peso líquido (Kg)',
      /* 18 */ 'Peso bruto (Kg)',
      /* 19 */ 'GTIN/EAN',
      /* 20 */ 'GTIN/EAN da Embalagem',
      /* 21 */ 'Largura do produto',
      /* 22 */ 'Altura do Produto',
      /* 23 */ 'Profundidade do produto',
      /* 24 */ 'Data Validade',
      /* 25 */ 'Descrição do Produto no Fornecedor',
      /* 26 */ 'Descrição Complementar',
      /* 27 */ 'Itens p/ caixa',
      /* 28 */ 'Produto Variação',
      /* 29 */ 'Tipo Produção',
      /* 30 */ 'Classe de enquadramento do IPI',
      /* 31 */ 'Código na Lista de Serviços',
      /* 32 */ 'Tipo do item',
      /* 33 */ 'Grupo de Tags/Tags',
      /* 34 */ 'Tributos',
      /* 35 */ 'Código Pai',
      /* 36 */ 'Código Integração',
      /* 37 */ 'Grupo de produtos',
      /* 38 */ 'Marca',
      /* 39 */ 'CEST',
      /* 40 */ 'Volumes',
      /* 41 */ 'Descrição Curta',
      /* 42 */ 'Cross-Docking',
      /* 43 */ 'URL Imagens Externas',
      /* 44 */ 'Link Externo',
      /* 45 */ 'Meses Garantia no Fornecedor',
      /* 46 */ 'Clonar dados do pai',
      /* 47 */ 'Condição do Produto',
      /* 48 */ 'Frete Grátis',
      /* 49 */ 'Número FCI',
      /* 50 */ 'Vídeo',
      /* 51 */ 'Departamento',
      /* 52 */ 'Unidade de Medida',
      /* 53 */ 'Preço de Compra',
      /* 54 */ 'Valor base ICMS ST para retenção',
      /* 55 */ 'Valor ICMS ST para retenção',
      /* 56 */ 'Valor ICMS próprio do substituto',
      /* 57 */ 'Categoria do produto',
      /* 58 */ 'Informações Adicionais',
    ];

    let csv = blingHeaders.join(sep) + '\n';

    state.csvRows.forEach(row => {
      // Separator row (empty between APC code blocks)
      if (row._isEmpty) {
        csv += new Array(59).fill('').join(sep) + '\n';
        return;
      }
      const cols = new Array(59).fill('');

      // ─── Campos comuns (PAI e VARIAÇÃO) ───
      cols[1]  = row.codigo;                   // Código
      cols[3]  = 'UN';                         // Unidade
      cols[4]  = row.ncm;                      // NCM
      cols[5]  = '0';                          // Origem
      cols[6]  = row.preco;                    // Preço
      cols[7]  = '0';                          // Valor IPI fixo
      cols[9]  = 'Ativo';                      // Situação
      cols[10] = row.estoque;                  // Estoque (0 pai, 1000 variação)
      cols[11] = state.costPrice || '22,83';         // Preço de custo
      cols[15] = '0';                          // Estoque máximo
      cols[16] = '0';                          // Estoque mínimo
      cols[17] = row.pesoLiq;                  // Peso líquido (Kg)
      cols[18] = row.pesoBruto;                // Peso bruto (Kg)
      cols[19] = row.ean;                      // GTIN/EAN (vazio)
      cols[20] = row.eanEmb;                   // GTIN/EAN da Embalagem (vazio)
      cols[21] = row.largura || '22';            // Largura do produto
      cols[22] = row.altura || '4';              // Altura do Produto
      cols[23] = row.profundidade || '30';       // Profundidade do produto
      cols[27] = '1';                          // Itens p/ caixa
      cols[28] = row.produtoVariacao;          // Produto Variação
      cols[29] = 'Terceiros';                  // Tipo Produção
      cols[32] = 'Mercadoria para Revenda';    // Tipo do item
      cols[34] = '0';                          // Tributos
      cols[35] = row.codigoPai;                // Código Pai
      cols[36] = '0';                          // Código Integração
      cols[37] = '';                           // Grupo de produtos (vazio conforme planilha padrão)
      cols[38] = row.marca;                    // Marca
      cols[39] = '28.038.00';                  // CEST
      cols[40] = '1';                          // Volumes
      cols[41] = 'A';                          // Descrição Curta
      cols[42] = '0';                          // Cross-Docking
      cols[43] = row.imagens;                  // URL Imagens Externas
      cols[45] = '0';                          // Meses Garantia no Fornecedor
      cols[46] = 'NÃO';                        // Clonar dados do pai
      cols[47] = 'NOVO';                       // Condição do Produto
      cols[48] = 'NÃO';                        // Frete Grátis
      cols[52] = 'Centímetro';                 // Unidade de Medida
      cols[53] = '0';                          // Preço de Compra
      cols[54] = '0';                          // Valor base ICMS ST
      cols[55] = '0';                          // Valor ICMS ST
      cols[56] = '0';                          // Valor ICMS próprio

      // ─── Campo específico ───
      // Descrição: envolver com aspas quando contém ; (delimitador CSV)
      cols[2]  = row.descricao.includes(';') ? `"${row.descricao}"` : row.descricao;

      csv += cols.join(sep) + '\n';
    });

    return csv;
  }



  function downloadCsv(content, filename) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function fireConfetti() {
    const container = document.getElementById('app-content');
    if (!container) return;

    const colors = [TIFFANY, TIFFANY_S, TIFFANY_D, '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4'];

    for (let i = 0; i < 30; i++) {
      const piece = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left  = Math.random() * 100;
      const delay = Math.random() * 800;
      const dur   = 1500 + Math.random() * 1500;
      const size  = 6 + Math.random() * 8;
      const rot   = Math.random() * 360;

      Object.assign(piece.style, {
        position: 'fixed',
        top: '-20px',
        left: left + '%',
        width: size + 'px',
        height: size + 'px',
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        zIndex: '9999',
        pointerEvents: 'none',
        opacity: '1',
        transform: `rotate(${rot}deg)`,
        animation: `apConfettiFall ${dur}ms ${delay}ms ease-in forwards`,
      });

      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), dur + delay + 200);
    }

    // Inject confetti keyframes if not present
    if (!document.getElementById('ap-confetti-style')) {
      const style = document.createElement('style');
      style.id = 'ap-confetti-style';
      style.textContent = `
        @keyframes apConfettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function bindStep5() {
    const dlBtn = document.getElementById('ap-download-csv');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        if (!state.csvRows.length) state.csvRows = buildCsvRows();
        const csv = generateCsvContent();
        const prefix = getFirstGroup().codeStart || 'autopilot';
        const suffix = getFirstGroup().codeEnd || '';
        const filename = `autopilot_${prefix}${suffix ? '_' + suffix : ''}_bling.csv`;
        downloadCsv(csv, filename);

        // Registrar estampas usadas SOMENTE na exportação final (não no preview)
        Object.values(state.estampas).forEach(est => {
          if (est && est.trim() && est.trim() !== '*ESTAMPA A SER DEFINIDA') Estampas.addUsedEstampa(est.trim());
        });

        // #9 Save to export history
        addExportHistory({
          date: new Date().toLocaleString('pt-BR'),
          codes: `${prefix}${suffix ? ' → ' + suffix : ''}`,
          skus: totalSkuCount(),
          brand: state.brand,
          filename,
        });

        window.HUB.logTask?.('export', `CSV Lucas RTX exportado (Bling)`, {
          codes: state.generatedCodes.length,
          skus: totalSkuCount(),
        });

        window.HUB.showToast('CSV Bling baixado com sucesso!', 'success');
        fireConfetti();
        state.exported = true;
        saveSession();
      });
    }

    const copyBtn = document.getElementById('ap-copy-csv');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!state.csvRows.length) state.csvRows = buildCsvRows();
        const csv = generateCsvContent();
        navigator.clipboard.writeText(csv).then(() => {
          window.HUB.showToast('CSV copiado para a área de transferência!', 'success');
        }).catch(() => {
          window.HUB.showToast('Erro ao copiar. Tente baixar o arquivo.', 'error');
        });
      });
    }


    // #12 Theme toggle
    const themeBtn = document.getElementById('ap-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        render();
      });
    }

    const newBtn = document.getElementById('ap-new-process');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        clearSession(); // #3
        resetState();
        render();
        window.HUB.showToast('Novo processo iniciado', 'info');
      });
    }

    const prevBtn = document.getElementById('ap-prev-5');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(5));
  }

  // ───────── Validation & Navigation ─────────

  function validateAndAdvance(step) {
    switch (step) {
      case 1: {
        // Validate all groups
        for (const group of state.productGroups) {
          if (group.codeMode === 'range') {
            if (!group.codeStart.trim()) {
              window.HUB.showToast(`Grupo ${group.productType}: Preencha o Código Início`, 'error');
              return;
            }
            if (!group.codeEnd.trim()) {
              window.HUB.showToast(`Grupo ${group.productType}: Preencha o Código Fim`, 'error');
              return;
            }
            if (!/^[A-Za-z]*\d+$/.test(group.codeStart.trim())) {
              window.HUB.showToast(`Grupo ${group.productType}: Código Início inválido (ex: C02576 ou 02576)`, 'error');
              return;
            }
            if (!/\d+$/.test(group.codeEnd.trim())) {
              window.HUB.showToast(`Grupo ${group.productType}: Código Fim inválido`, 'error');
              return;
            }
          } else {
            if (!group.manualCodes.trim()) {
              window.HUB.showToast(`Grupo ${group.productType}: Insira ao menos um código`, 'error');
              return;
            }
            const codes = group.manualCodes.split(/[,\s;]+/).map(c => c.trim()).filter(Boolean);
            if (codes.length === 0) {
              window.HUB.showToast(`Grupo ${group.productType}: Insira códigos válidos`, 'error');
              return;
            }
          }
        }

        const codes = generateAllCodes();
        if (!codes.length) {
          window.HUB.showToast('Nenhum código gerado. Verifique os ranges.', 'error');
          return;
        }
        if (codes.length > 1000) {
          window.HUB.showToast('Máximo de 1000 códigos por vez', 'error');
          return;
        }

        if (!state.price.trim()) {
          window.HUB.showToast('Preencha o preço do produto', 'error');
          return;
        }

        state.generatedCodes = codes;
        state.completedSteps.add(1);
        goToStep(2);
        break;
      }
      case 2: {
        // Disk path is optional but warn if missing
        if (!state.diskFolderPath || !state.diskFolderPath.trim()) {
          window.HUB.showToast('Nenhum caminho de pasta configurado. Você pode preencher os links manualmente na Etapa 3.', 'warning');
        }
        state.completedSteps.add(2);
        goToStep(3);
        break;
      }
      case 3: {
        // Links are optional but warn
        const total = state.generatedCodes.reduce((acc, c) => {
          const group = c._groupId ? getGroupById(c._groupId) : null;
          if (c._isAPC) {
            const colors = group ? activeApcColors(group).length : 3;
            const genders = group ? activeGenders(group).length : 1;
            return acc + (colors * genders);
          }
          const gList = group ? activeGenders(group) : ['masc'];
          return acc + gList.filter(g => c[g]).length;
        }, 0);
        const done  = Object.values(state.imageUrls).filter(v => v && v.trim()).length;
        if (done < total) {
          window.HUB.showToast(`${total - done} código(s) sem links de imagem. Continuando...`, 'warning');
        }
        state.completedSteps.add(3);
        goToStep(4);
        break;
      }
      case 4: {
        const bases = [...new Set(state.generatedCodes.map(c => c.base))];
        // Auto-fill from suggestions if user didn't manually type
        bases.forEach(b => {
          if ((!state.estampas[b] || !state.estampas[b].trim()) && state.estampaSuggestions[b]) {
            state.estampas[b] = state.estampaSuggestions[b];
          }
        });
        const missing = bases.filter(b => !state.estampas[b] || !state.estampas[b].trim());
        if (missing.length > 0) {
          window.HUB.showToast(`Preencha o nome da estampa para ${missing.length} código(s)`, 'error');
          return;
        }
        
        const names = bases.map(b => state.estampas[b].trim().toLowerCase());
        const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
        if (duplicates.length > 0) {
          window.HUB.showToast('Aviso: Há nomes de estampas duplicados.', 'warning');
        }
        
        state.completedSteps.add(4);
        goToStep(5);
        break;
      }
      case 5: {
        // Build CSV if not done
        if (!state.csvRows.length) state.csvRows = buildCsvRows();

        state.completedSteps.add(5);
        goToStep(6);
        break;
      }
    }
  }

  function goToStep(n) {
    if (n < 1 || n > 6) return;
    // Can only go forward to completed+1 or backward to any completed
    if (n > state.currentStep && !state.completedSteps.has(n - 1) && n !== state.currentStep + 1) {
      window.HUB.showToast('Complete as etapas anteriores primeiro', 'warning');
      return;
    }
    state.currentStep = n;
    saveSession(); // #3 auto-save
    render();
    // Scroll to top
    const content = document.getElementById('app-content');
    if (content) content.scrollTop = 0;
  }

  // ───────── Main Render ─────────

  function render() {
    const container = document.getElementById('app-content');
    if (!container) return;

    let html = renderStepper();

    html += '<div style="padding:24px 0">';
    switch (state.currentStep) {
      case 1: html += renderStep1(); break;
      case 2: html += renderStep2(); break;
      case 3: html += renderStep3(); break;
      case 4: html += renderStep4_Estampas(); break;
      case 5: html += renderStep4(); break;
      case 6: html += renderStep5(); break;
    }
    html += '</div>';

    container.innerHTML = html;

    // Bind events
    switch (state.currentStep) {
      case 1: bindStep1(); break;
      case 2: bindStep2(); break;
      case 3: bindStep3(); break;
      case 4: bindStep4_Estampas(); break;
      case 5: bindStep4(); break;
      case 6: bindStep5(); break;
    }

    // Stepper click navigation
    $$('.stepper__step[data-step]').forEach(el => {
      el.addEventListener('click', () => {
        const target = parseInt(el.dataset.step, 10);
        if (state.completedSteps.has(target) || target === state.currentStep) {
          goToStep(target);
        }
      });
    });
  }

  // ───────── Public API ─────────

  let sessionRestored = false;

  window.HUB.renderAutopilot = function () {
    // #3 Auto-restore session on first load
    if (!sessionRestored) {
      sessionRestored = true;
      const hasSession = restoreSession();
      if (hasSession && state.currentStep > 1) {
        window.HUB.showToast(`♻️ Sessão anterior restaurada (Etapa ${state.currentStep})`, 'info');
      }
    }

    // Check for Agent payload (from Autopilot Agent)
    const agentPayloadStr = sessionStorage.getItem('autopilot-agent-payload');
    if (agentPayloadStr) {
      try {
        const payload = JSON.parse(agentPayloadStr);
        sessionStorage.removeItem('autopilot-agent-payload');

        // Apply agent payload to state
        if (payload.productGroups && payload.productGroups.length) {
          state.productGroups = payload.productGroups;
          groupIdCounter = Math.max(...payload.productGroups.map(g => g.id), 0);
        }
        if (payload.brand) state.brand = payload.brand;
        if (payload.price !== undefined) state.price = payload.price;
        if (payload.costPrice !== undefined) state.costPrice = payload.costPrice;
        if (payload.pricePerGender !== undefined) state.pricePerGender = payload.pricePerGender;
        if (payload.priceFem) state.priceFem = payload.priceFem;
        if (payload.priceInf) state.priceInf = payload.priceInf;
        if (payload.description) state.description = payload.description;

        state.currentStep = 1;
        state.completedSteps = new Set();

        window.HUB.showToast(`🤖 Plano do Agent carregado! ${state.productGroups.length} grupo(s)`, 'success');
        saveSession();
      } catch (e) {
        console.warn('Agent payload parse error:', e);
        sessionStorage.removeItem('autopilot-agent-payload');
      }
    }

    // Read network scan results (from dashboard autopilot flow)
    const networkPayloadStr = sessionStorage.getItem('autopilot-network-payload');
    if (networkPayloadStr) {
      try {
        const networkPayload = JSON.parse(networkPayloadStr);
        sessionStorage.removeItem('autopilot-network-payload');
        state.networkScanResult = networkPayload.scanResults;
        state.networkCopyResult = networkPayload.copyResults;
        state.networkTaskId = networkPayload.taskId;
        // Set estampas from scan results
        if (networkPayload.scanResults) {
          for (const r of networkPayload.scanResults) {
            if (r.estampa && r.code) {
              state.estampas[r.code] = r.estampa;
              state.estampaSuggestions[r.code] = r.estampa;
            }
          }
        }
        // If we have copy results, populate image URLs for step 2 preview
        if (networkPayload.copyResults && networkPayload.copyResults.results) {
          state.folderData = {};
          for (const cr of networkPayload.copyResults.results) {
            state.folderData[cr.code] = cr.images.map(img => ({
              name: img.name,
              url: img.url,
              sizeKB: img.sizeKB,
              priority: img.priority || 5,
              gender: img.gender || null,
            }));
          }
        }
        // Auto-advance to step 2 since we already have the data
        state.currentStep = 2;
        window.HUB?.showToast(`✅ ${networkPayload.scanResults?.filter(r=>r.found).length || 0} códigos encontrados na rede!`, 'success');
      } catch (e) {
        console.error('Error parsing network payload:', e);
      }
    }

    // Preserve state across re-renders from sidebar clicks
    if (state.generatedCodes.length && state.completedSteps.has(1)) {
      // State is warm, keep it
    } else {
      if (state.productGroups && state.productGroups.length) {
        state.generatedCodes = generateAllCodes();
      }
    }
    render();
  };

})();
