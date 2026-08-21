(function () {
  'use strict';

  window.AutopilotModules = window.AutopilotModules || {};

  // Dependencies
  const State = window.AutopilotModules.State;
  const Registry = window.AutopilotModules.Registry;
  const { APC_COLORS, SIZE_MAP, isUniqueProduct } = Registry;
  const { TIFFANY } = State;

  // ───────── APC Helpers ─────────

  function isAPC() { return State.getFirstGroup().productType === 'APC'; }
  function activeApcColors(group) { const g = group || State.getFirstGroup(); return APC_COLORS.filter(c => g.apcColors && g.apcColors[c]); }

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
    const g = group || State.getFirstGroup();
    return Object.entries(g.genders).filter(([, v]) => v).map(([k]) => k);
  }

  function genderLabel(g) {
    return { masc: 'MASC', fem: 'FEM', inf: 'INF' }[g] || g;
  }

  function genderColor(g) {
    return { masc: '#3b82f6', fem: '#ec4899', inf: '#f59e0b' }[g] || '#6b7280';
  }

  function sizesFor(gender, productType) {
    const pt = productType || State.getFirstGroup().productType;
    if (isUniqueProduct(pt)) return [''];
    const map = SIZE_MAP[pt];
    return map ? (map[gender] || []) : [];
  }

  function totalSkuCount() {
    let count = 0;
    State.state.generatedCodes.forEach(code => {
      if (code._isAPC) {
        const group = State.state.productGroups.find(g => g.id === code._groupId);
        const colors = group ? activeApcColors(group).length : 1;
        const genders = group ? activeGenders(group).length : 1;
        const sizes = sizesFor('masc', code.productType).length;
        count += colors * sizes * genders;
      } else {
        const group = State.state.productGroups.find(g => g.id === code._groupId);
        const genders = group ? activeGenders(group) : ['masc'];
        genders.forEach(g => {
          if (code[g]) count += sizesFor(g, code.productType).length;
        });
      }
    });
    return count;
  }

  function renderStatCard(label, count, icon, color) {
    const c = color || TIFFANY;
    return `<div style="text-align:center;padding:14px;border-radius:10px;background:rgba(0,0,0,.2);border:1px solid ${c}20">
      <div style="font-size:20px">${icon}</div>
      <div style="font-size:22px;font-weight:700;color:${c}">${count}</div>
      <div style="font-size:11px;color:#9ca3af">${label}</div>
    </div>`;
  }

  // ───────── Exports ─────────

  window.AutopilotModules.Helpers = {
    $, $$, esc, loadSizeConfig, getWeightForSize,
    activeGenders, genderLabel, genderColor, sizesFor,
    totalSkuCount, isAPC, activeApcColors, renderStatCard,
  };
})();
