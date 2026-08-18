/**
 * autopilot-agent.js — Smart Task Interpreter
 * ─────────────────────────────────────────────
 * Interpreta tasks do ClickUp (texto livre) e gera planos
 * de execução pré-configurados para o Autopilot.
 * Sem API — usa padrões de produto internos.
 */
(function () {
  'use strict';

  const TIFFANY = '#0ae448';

  // ═══════════════════════════════════════
  // PARSER PATTERNS
  // ═══════════════════════════════════════

  const TYPE_PATTERNS = [
    // ── COM VARIAÇÃO (grade de tamanhos + gêneros) ──
    { regex: /\bFUSION\d*/i,         type: 'FusionX', label: 'FusionX', variation: true },
    { regex: /\bCAX\d*/i,            type: 'ArmorX', label: 'ArmorX', variation: true },
    { regex: /\bHYBRID\d*/i,         type: 'Hybrid',         label: 'Hybrid', variation: true },
    { regex: /\bCAPUZ/i,             type: 'Capuz',          label: 'Capuz', variation: true },
    { regex: /\bBM\b|BLACK\s*MASK/i, type: 'BlackMask',      label: 'BlackMask', variation: false },
    { regex: /\bCV\b|CORTA[\s-]*VENTO/i, type: 'Corta-Vento', label: 'Corta-Vento', variation: true },
    { regex: /\bAPC\d*/i,            type: 'APC',            label: 'APC (Algodão)', variation: true },
    { regex: /\bTUBENECK/i,         type: 'Tubeneck',       label: 'Tubeneck', variation: false },
    { regex: /\bCASUAL/i,           type: 'Casual',         label: 'Casual', variation: true },
    { regex: /\bCADV\d*/i,          type: 'Casual',         label: 'CADV (Casual)', variation: true },
    { regex: /\bADV\d*|\bMOTOCICLISMO/i, type: 'Motociclismo',   label: 'ADV (Motociclismo)', variation: true },
    { regex: /\bRAGLAN/i,           type: 'Raglan',         label: 'Raglan', variation: true },
    { regex: /\bM\/C\b|\bMC\b|MANGA\s*CURTA/i, type: 'Raglan', label: 'Manga Curta (Raglan)', variation: true },
    { regex: /\bM\/L\b|\bML\b|MANGA\s*LONGA/i, type: 'Camisa UV', label: 'Manga Longa (UV)', variation: true },
    // ── ÚNICOS (1 código = 1 SKU) ──
    { regex: /\bBA0\d*/i,           type: 'Boné',           label: 'Boné', variation: false },
    { regex: /\bBANDANA\b/i, type: 'Bandana', label: 'Bandana', variation: false },
    { regex: /\bLC\d*/i,            type: 'Lenço Cetim',    label: 'Lenço de Cetim', variation: false },
    { regex: /\bLEN\d*/i,           type: 'Lenço',          label: 'Lenço Normal', variation: false },
    { regex: /\bCPT\d*/i,           type: 'Copo Térmico',   label: 'Copo Térmico', variation: false },
    { regex: /\bCPA\d*/i,           type: 'Capa Almofada',  label: 'Capa de Almofada', variation: false },
    { regex: /\bCANECA\d*/i,        type: 'Caneca',         label: 'Caneca', variation: false },
  ];

  const BRAND_PATTERNS = [
    { regex: /\bAGRO\b/i,           brand: 'BRK AGRO' },
    { regex: /\bMOTOR[S]?\b/i,      brand: 'Brk Motors' },
    { regex: /\bFISHING\b|\bPESCA\b/i, brand: 'BRK FISHING' },
  ];

  const GENDER_PATTERNS = [
    { regex: /\bFEM\b|\bFEMININ[AO]\b/i, gender: 'fem' },
    { regex: /\bINF\b|\bINFANTIL\b/i,    gender: 'inf' },
    { regex: /\bMASC\b|\bMASCULIN[AO]\b/i, gender: 'masc' },
  ];

  // Code range patterns: "C02800 a C02850", "C02800-C02850", "C02800 até C02850"
  // Usa [ \t]* em vez de \s* para NÃO cruzar linhas (evita falso match em listas)
  const CODE_RANGE_REGEX = /([A-Za-z]+\d+)[ \t]*(?:a|até|→|-)[ \t]*([A-Za-z]*)(\d+)/gi;

  // Individual codes: "C02800, C02801" or "C02800 C02801"
  const CODE_INDIVIDUAL_REGEX = /\b([A-Z]{1,5}\d{3,6})\b/gi;

  // ═══════════════════════════════════════
  // PARSER ENGINE
  // ═══════════════════════════════════════

  function parseTask(text) {
    if (!text || !text.trim()) return null;

    const result = {
      raw: text,
      groups: [],
      brand: 'BRK FISHING', // default
      genders: { masc: true, fem: false, inf: false },
      globalNotes: [],
    };

    // 1. Detect brand
    for (const bp of BRAND_PATTERNS) {
      if (bp.regex.test(text)) {
        result.brand = bp.brand;
        break;
      }
    }

    // 2. Detect genders
    const detectedGenders = [];
    for (const gp of GENDER_PATTERNS) {
      if (gp.regex.test(text)) {
        detectedGenders.push(gp.gender);
      }
    }
    if (detectedGenders.length) {
      result.genders = { masc: false, fem: false, inf: false };
      detectedGenders.forEach(g => result.genders[g] = true);
      // If FEM or INF specified without MASC, assume MASC is also included
      if ((result.genders.fem || result.genders.inf) && !detectedGenders.includes('masc')) {
        result.genders.masc = true;
      }
    }

    // 3. Detect product types
    const detectedTypes = [];
    const usedPatterns = new Set();
    for (const tp of TYPE_PATTERNS) {
      if (tp.regex.test(text) && !usedPatterns.has(tp.type)) {
        detectedTypes.push({ type: tp.type, label: tp.label });
        usedPatterns.add(tp.type);
      }
    }

    // Default to Raglan if no type detected
    if (!detectedTypes.length) {
      detectedTypes.push({ type: 'Raglan', label: 'Raglan (padrão)' });
    }

    // 4. Extract code ranges
    const ranges = [];
    let rangeMatch;
    const rangeRegex = new RegExp(CODE_RANGE_REGEX.source, 'gi');
    while ((rangeMatch = rangeRegex.exec(text)) !== null) {
      const startCode = rangeMatch[1].toUpperCase();
      const endPrefix = rangeMatch[2] ? rangeMatch[2].toUpperCase() : '';
      const endNum = rangeMatch[3];
      // Se o end não tem prefixo, herdar do start (ex: "C02800 a 02850" → end = "C02850")
      const inheritedPrefix = endPrefix || startCode.replace(/\d+$/, '');
      ranges.push({ start: startCode, end: inheritedPrefix + endNum });
    }

    // 5. If no range found, try individual codes
    let individualCodes = [];
    if (!ranges.length) {
      const codeMatches = text.match(CODE_INDIVIDUAL_REGEX);
      if (codeMatches) {
        individualCodes = [...new Set(codeMatches.map(c => c.toUpperCase()))];
      }
    }

    // 6. Build groups — one per product type, distribute codes
    if (detectedTypes.length === 1) {
      // Single type: all codes go to one group
      const group = {
        productType: detectedTypes[0].type,
        label: detectedTypes[0].label,
        codeMode: ranges.length ? 'range' : (individualCodes.length ? 'manual' : 'range'),
        codeStart: ranges.length ? ranges[0].start : '',
        codeEnd: ranges.length ? ranges[0].end : '',
        manualCodes: individualCodes.join('\n'),
        genders: { ...result.genders },
      };
      result.groups.push(group);
    } else {
      // Multiple types: create a group per type
      // If we have ranges, assign first range to first type, etc.
      detectedTypes.forEach((dt, idx) => {
        const group = {
          productType: dt.type,
          label: dt.label,
          codeMode: ranges.length > idx ? 'range' : (individualCodes.length ? 'manual' : 'range'),
          codeStart: ranges.length > idx ? ranges[idx].start : '',
          codeEnd: ranges.length > idx ? ranges[idx].end : '',
          manualCodes: '',
          genders: dt.type === 'BlackMask' || dt.type === 'Bandana' || dt.type === 'Tubeneck'
            ? { masc: true, fem: false, inf: false }
            : { ...result.genders },
        };
        result.groups.push(group);
      });

      // If only one range for multiple types, note it
      if (ranges.length === 1 && detectedTypes.length > 1) {
        result.globalNotes.push('⚠️ Um range detectado para múltiplos tipos — defina os ranges de cada grupo manualmente.');
      }
    }

    return result;
  }

  // ═══════════════════════════════════════
  // PLAN GENERATOR
  // ═══════════════════════════════════════

  const SIZE_MAP = {
    // Com Variação
    'Raglan':         { masc: 6, fem: 7, inf: 6 },
    'Camisa UV':      { masc: 6, fem: 7, inf: 6 },
    'FusionX':        { masc: 6, fem: 6, inf: 6 },
    'ArmorX':         { masc: 6, fem: 6, inf: 6 },
    'Hybrid':         { masc: 6, fem: 6, inf: 6 },
    'Capuz':          { masc: 6, fem: 6, inf: 6 },
    'APC':            { masc: 6, fem: 6, inf: 6 },
    'Casual':         { masc: 6, fem: 6, inf: 6 },
    'Corta-Vento':    { masc: 5, fem: 5, inf: 5 },
    'Motociclismo':   { masc: 6, fem: 6, inf: 6 },
    // Únicos (1 SKU)
    'BlackMask':      { masc: 1, fem: 1, inf: 1 },
    'Tubeneck':       { masc: 1, fem: 1, inf: 1 },
    'Boné':           { masc: 1, fem: 1, inf: 1 },
    'Lenço Cetim':    { masc: 1, fem: 1, inf: 1 },
    'Lenço':          { masc: 1, fem: 1, inf: 1 },
    'Copo Térmico':   { masc: 1, fem: 1, inf: 1 },
    'Capa Almofada':  { masc: 1, fem: 1, inf: 1 },
    'Caneca':         { masc: 1, fem: 1, inf: 1 },
  };

  function countCodesInRange(start, end) {
    if (!start || !end) return 0;
    const prefixMatch = start.match(/^([A-Za-z]+)/);
    const startNum = parseInt(start.replace(/^[A-Za-z]+/, ''), 10);
    const endNum = parseInt(end.replace(/^[A-Za-z]+/, ''), 10);
    if (isNaN(startNum) || isNaN(endNum)) return 0;
    return Math.abs(endNum - startNum) + 1;
  }

  function generatePlan(parsed) {
    if (!parsed || !parsed.groups.length) return null;

    const plan = {
      brand: parsed.brand,
      groups: [],
      totalCodes: 0,
      totalSKUs: 0,
      estimatedMinutes: 0,
      checklist: [
        { id: 'codes', label: 'Códigos definidos', done: false },
        { id: 'photos', label: 'Fotos tiradas/organizadas', done: false },
        { id: 'folders', label: 'Pastas criadas no padrão BRK', done: false },
        { id: 'upload', label: 'Upload de imagens', done: false },
        { id: 'csv', label: 'Planilha CSV exportada', done: false },
        { id: 'bling', label: 'Importado no Bling', done: false },
        { id: 'review', label: 'Revisão final no e-commerce', done: false },
      ],
      notes: parsed.globalNotes || [],
    };

    parsed.groups.forEach(group => {
      const codeCount = group.codeMode === 'range'
        ? countCodesInRange(group.codeStart, group.codeEnd)
        : (group.manualCodes ? group.manualCodes.split('\n').filter(l => l.trim()).length : 0);

      const activeGenders = Object.keys(group.genders).filter(g => group.genders[g]);
      const sizesPerGender = SIZE_MAP[group.productType] || { masc: 6, fem: 6, inf: 6 };
      const skusPerCode = activeGenders.reduce((acc, g) => acc + (sizesPerGender[g] || 6), 0);
      const totalSKUs = codeCount * skusPerCode;

      // ── Gerar lista real de códigos ──
      let codes = [];
      if (group.codeMode === 'range' && group.codeStart && group.codeEnd) {
        const prefixMatch = group.codeStart.match(/^([A-Za-z]+)/);
        const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : '';
        const startNum = parseInt(group.codeStart.replace(/^[A-Za-z]+/, ''), 10);
        const endNum = parseInt(group.codeEnd.replace(/^[A-Za-z]+/, ''), 10);
        const padLen = group.codeStart.replace(/^[A-Za-z]+/, '').length;
        if (!isNaN(startNum) && !isNaN(endNum)) {
          const lo = Math.min(startNum, endNum);
          const hi = Math.max(startNum, endNum);
          for (let i = lo; i <= hi; i++) {
            codes.push(prefix + String(i).padStart(padLen, '0'));
          }
        }
      } else if (group.manualCodes) {
        codes = group.manualCodes.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 0);
      }

      plan.groups.push({
        ...group,
        codes,
        codeCount,
        activeGenders,
        skusPerCode,
        totalSKUs,
      });

      plan.totalCodes += codeCount;
      plan.totalSKUs += totalSKUs;
    });

    plan.estimatedMinutes = Math.max(5, Math.ceil(plan.totalSKUs / 10));

    return plan;
  }

  // ═══════════════════════════════════════
  // UI RENDERER
  // ═══════════════════════════════════════

  const TYPE_COLORS = {
    'Raglan': '#3b82f6', 'Camisa UV': '#06b6d4', 'FusionX': '#8b5cf6', 'ArmorX': '#d946ef',
    'Hybrid': '#a855f7', 'Capuz': '#6366f1', 'APC': '#f59e0b',
    'Casual': '#14b8a6', 'Corta-Vento': '#ef4444', 'BlackMask': '#6b7280',
    'Bandana': '#ec4899', 'Tubeneck': '#10b981',
  };

  function esc(str) { return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function renderAgentCard() {
    return `
    <div class="card card--glow" style="padding:0;border:1px solid rgba(10, 228, 72,.15);overflow:hidden;margin-bottom:24px" id="agent-card">
      <!-- Header -->
      <div style="padding:20px 24px;background:linear-gradient(135deg,rgba(10, 228, 72,.08),rgba(10, 228, 72,.02));border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,${TIFFANY}30,${TIFFANY}10);display:flex;align-items:center;justify-content:center;font-size:22px">🤖</div>
          <div>
            <h3 style="margin:0;font-size:16px;color:#f1f5f9">Autopilot Agent</h3>
            <p style="margin:2px 0 0;font-size:12px;color:#6b7280">Cole o texto da task do ClickUp e eu monto o plano</p>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div style="padding:20px 24px">
        <textarea class="form-input" id="agent-task-input" rows="3" 
          placeholder='Ex: "Cadastrar C02800 a C02850 Fishing M/C + FEM" ou "FUSION181 + CV + BM C03000-C03020 Agro"'
          style="font-size:13px;resize:vertical"></textarea>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn btn--primary" id="agent-interpret-btn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px">
            🤖 Interpretar Task
          </button>
          <button class="btn btn--secondary" id="agent-clear-btn" style="padding:10px 16px">🗑️</button>
        </div>
      </div>

      <!-- Plan Output -->
      <div id="agent-plan-output" style="display:none"></div>
    </div>`;
  }

  function renderPlan(plan) {
    if (!plan) return '<p style="color:#ef4444;padding:20px">Não foi possível interpretar a task.</p>';

    const genderEmoji = { masc: '👔', fem: '👗', inf: '🧒' };
    const genderLabel = { masc: 'Masculino', fem: 'Feminino', inf: 'Infantil' };

    let html = `
    <div style="border-top:1px solid rgba(255,255,255,.06);padding:20px 24px">
      <!-- Summary Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h4 style="margin:0;color:${TIFFANY};font-size:14px">📋 Plano de Execução</h4>
        <div style="display:flex;gap:8px">
          <span class="badge" style="background:${TIFFANY}20;color:${TIFFANY}">${plan.totalCodes} códigos</span>
          <span class="badge" style="background:#3b82f620;color:#3b82f6">${plan.totalSKUs} SKUs</span>
          <span class="badge" style="background:#f59e0b20;color:#f59e0b">~${plan.estimatedMinutes} min</span>
        </div>
      </div>

      <!-- Brand -->
      <div style="margin-bottom:16px;padding:10px 14px;background:rgba(255,255,255,.03);border-radius:8px;display:flex;align-items:center;gap:10px">
        <span style="color:#6b7280;font-size:12px">Marca:</span>
        <span style="color:#f1f5f9;font-weight:600">${esc(plan.brand)}</span>
      </div>

      <!-- Groups -->
      ${plan.groups.map((g, i) => {
        const color = TYPE_COLORS[g.productType] || '#6b7280';
        const genders = g.activeGenders.map(ge => `${genderEmoji[ge]} ${genderLabel[ge]}`).join(', ');
        const codeRange = g.codeMode === 'range' && g.codeStart
          ? `${g.codeStart} → ${g.codeEnd}`
          : (g.manualCodes ? `${g.manualCodes.split('\\n').filter(l=>l.trim()).length} códigos manuais` : 'Sem códigos');

        return `
        <div style="margin-bottom:12px;padding:14px 16px;background:rgba(255,255,255,.03);border-left:3px solid ${color};border-radius:0 8px 8px 0">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="background:${color}25;color:${color};padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.5px">${esc(g.productType)}</span>
            <span style="color:#9ca3af;font-size:12px;font-family:monospace">${esc(codeRange)}</span>
            <span style="color:#6b7280;font-size:11px;margin-left:auto">${g.totalSKUs} SKUs</span>
          </div>
          <div style="display:flex;gap:16px;font-size:12px;color:#9ca3af">
            <span>📦 ${g.codeCount} código${g.codeCount !== 1 ? 's' : ''}</span>
            <span>👥 ${genders}</span>
          </div>
        </div>`;
      }).join('')}

      <!-- Notes -->
      ${plan.notes.length ? plan.notes.map(n => `<div style="padding:8px 12px;background:#f59e0b10;border:1px solid #f59e0b20;border-radius:6px;margin-bottom:8px;font-size:12px;color:#f59e0b">${esc(n)}</div>`).join('') : ''}

      <!-- Checklist -->
      <div style="margin-top:16px;padding:14px 16px;background:rgba(255,255,255,.02);border-radius:8px;border:1px solid rgba(255,255,255,.06)">
        <h5 style="margin:0 0 10px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Checklist</h5>
        ${plan.checklist.map(item => `
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#9ca3af">
            <span style="font-size:14px">${item.done ? '✅' : '⬜'}</span>
            <span>${esc(item.label)}</span>
          </div>
        `).join('')}
      </div>

      <!-- Action Button -->
      <div style="margin-top:20px;display:flex;gap:10px">
        <button class="btn btn--primary" id="agent-start-autopilot" style="flex:1;padding:14px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px">
          🚀 Iniciar Autopilot com este Plano
        </button>
      </div>
    </div>`;

    return html;
  }

  // ═══════════════════════════════════════
  // EVENT BINDING
  // ═══════════════════════════════════════

  let currentPlan = null;
  let currentParsed = null;

  function bindAgent() {
    const input = document.getElementById('agent-task-input');
    const interpretBtn = document.getElementById('agent-interpret-btn');
    const clearBtn = document.getElementById('agent-clear-btn');
    const output = document.getElementById('agent-plan-output');

    if (!interpretBtn || !input || !output) return;

    interpretBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) {
        window.HUB?.showToast('Cole o texto da task do ClickUp', 'warning');
        return;
      }

      currentParsed = parseTask(text);
      currentPlan = generatePlan(currentParsed);

      output.style.display = 'block';
      output.innerHTML = renderPlan(currentPlan);

      // Bind start button
      const startBtn = document.getElementById('agent-start-autopilot');
      if (startBtn && currentPlan && currentParsed) {
        startBtn.addEventListener('click', () => {
          launchAutopilot(currentParsed, currentPlan);
        });
      }

      window.HUB?.showToast(`✅ ${currentPlan.groups.length} grupo(s) detectado(s) — ${currentPlan.totalSKUs} SKUs`, 'success');
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      output.style.display = 'none';
      output.innerHTML = '';
      currentPlan = null;
      currentParsed = null;
    });
  }

  // ═══════════════════════════════════════
  // AUTOPILOT LAUNCHER
  // ═══════════════════════════════════════

  function launchAutopilot(parsed, plan, options = {}) {
    // Build the productGroups array for the Autopilot state
    const groups = plan.groups.map((g, idx) => ({
      id: idx + 1,
      productType: g.productType,
      codeMode: g.codeMode,
      codeStart: g.codeStart || '',
      codeEnd: g.codeEnd || '',
      manualCodes: g.manualCodes || '',
      genders: { ...g.genders },
      femSuffix: 'BL',
      infSuffix: 'I',
      estampaName: '',
      apcColors: { Preto: true, Branco: true, Bege: false },
      apcPrefix: '',
      expanded: true,
    }));

    // Store the plan in sessionStorage for the Autopilot to pick up
    const agentPayload = {
      productGroups: groups,
      brand: parsed.brand,
      price: '0',
      costPrice: '0',
      pricePerGender: false,
      priceFem: '',
      priceInf: '',
      description: '',
      _fromAgent: true,
      _agentTimestamp: Date.now(),
    };

    sessionStorage.setItem('autopilot-agent-payload', JSON.stringify(agentPayload));

    // Navigate to Autopilot (skip when called from Live Panel)
    if (options.navigate !== false) {
      window.HUB?.showToast('🚀 Abrindo Autopilot com o plano...', 'success');
      setTimeout(() => {
        const autopilotLink = document.querySelector('[data-section="autopilot"]');
        if (autopilotLink) {
          autopilotLink.click();
        } else if (window.HUB?.navigate) {
          window.HUB.navigate('autopilot');
        }
      }, 300);
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  window.HUB = window.HUB || {};
  window.HUB.AutopilotAgent = {
    renderAgentCard,
    bindAgent,
    parseTask,
    generatePlan,
    launchAutopilot,
  };

})();
