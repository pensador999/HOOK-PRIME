/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Lucas RTX (Wizard 6 Etapas)
   Automação completa: Códigos → Pastas → Links → Planilha → Export
   ═══════════════════════════════════════════════════════════════
   Modular Architecture — This is the orchestrator.
   Modules loaded via <script> before this file:
     core/state.js, core/helpers.js, core/code-generator.js
     uploader/s3-uploader.js, uploader/upload-manager.js
     steps/step1-config.js .. step6-export.js
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ═══ Module References ═══
  const Modules  = window.AutopilotModules || {};
  const State    = Modules.State;
  const H        = Modules.Helpers;
  const CodeGen  = Modules.CodeGen;
  const Step1    = Modules.Step1;
  const Step2    = Modules.Step2;
  const Step3    = Modules.Step3;
  const Step4Est = Modules.Step4Est;
  const Step5    = Modules.Step5;
  const Step6    = Modules.Step6;

  // ═══ Safety Check ═══
  if (!State || !H) {
    console.error('❌ FATAL: Autopilot modules failed to load. State:', !!State, 'Helpers:', !!H);
    window.HUB.renderAutopilot = function () {
      const container = document.getElementById('app-content');
      if (container) container.innerHTML = `
        <div style="padding:40px;text-align:center;color:#ef4444">
          <h2>❌ Erro de Carregamento</h2>
          <p>Módulos do Autopilot não carregaram corretamente.</p>
          <p style="color:#9ca3af;font-size:13px">Verifique o console do navegador (F12) para detalhes.</p>
          <p style="color:#6b7280;font-size:12px;margin-top:16px">Módulos: State=${!!State}, Helpers=${!!H}, Step1=${!!Step1}, Step2=${!!Step2}</p>
          <button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;background:#AAFF00;color:#fff;border:none;border-radius:8px;cursor:pointer">🔄 Recarregar Página</button>
        </div>`;
    };
    return; // Abort IIFE — don't register broken handlers
  }

  const state = State.state;

  // Shared deps object passed to bind functions
  const deps = { render, goToStep, validateAndAdvance };

  // ───────── Stepper ─────────

  function renderStepper() {
    let html = '<div class="stepper" style="position:sticky;top:0;z-index:50;background:var(--surface-card,#1e1e2e);padding:20px 0 16px;border-bottom:1px solid rgba(170, 255, 0,.15)">';

    State.STEP_LABELS.forEach((label, idx) => {
      const num = idx + 1;
      const isActive    = num === state.currentStep;
      const isCompleted = state.completedSteps.has(num);

      let stepClass = 'stepper__step';
      if (isActive)    stepClass += ' active';
      if (isCompleted) stepClass += ' completed';

      const clickable = isCompleted || isActive;

      html += `<div class="${stepClass}" ${clickable ? `data-step="${num}" style="cursor:pointer"` : ''}>`;
      html += `<div class="stepper__circle" style="${isActive ? `box-shadow:0 0 16px ${State.TIFFANY}80` : ''}">`;
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

  // ───────── Validation & Navigation ─────────

  function validateAndAdvance(step) {
    switch (step) {
      case 1: {
        for (const group of state.productGroups) {
          if (group.codeMode === 'range') {
            if (!group.codeStart.trim()) { window.HUB.showToast(`Grupo ${group.productType}: Preencha o Código Início`, 'error'); return; }
            if (!group.codeEnd.trim()) { window.HUB.showToast(`Grupo ${group.productType}: Preencha o Código Fim`, 'error'); return; }
            if (!/^[A-Za-z]*\d+$/.test(group.codeStart.trim())) { window.HUB.showToast(`Grupo ${group.productType}: Código Início inválido (ex: C02576 ou 02576)`, 'error'); return; }
            if (!/\d+$/.test(group.codeEnd.trim())) { window.HUB.showToast(`Grupo ${group.productType}: Código Fim inválido`, 'error'); return; }
          } else {
            if (!group.manualCodes.trim()) { window.HUB.showToast(`Grupo ${group.productType}: Insira ao menos um código`, 'error'); return; }
            const codes = group.manualCodes.split(/[,\s;]+/).map(c => c.trim()).filter(Boolean);
            if (codes.length === 0) { window.HUB.showToast(`Grupo ${group.productType}: Insira códigos válidos`, 'error'); return; }
          }
        }
        const codes = CodeGen.generateAllCodes();
        if (!codes.length) { window.HUB.showToast('Nenhum código gerado. Verifique os ranges.', 'error'); return; }
        if (codes.length > 1000) { window.HUB.showToast('Máximo de 1000 códigos por vez', 'error'); return; }
        if (!state.price.trim()) { window.HUB.showToast('Preencha o preço do produto', 'error'); return; }
        state.generatedCodes = codes;
        state.completedSteps.add(1);
        goToStep(2);
        break;
      }
      case 2: {
        if (!state.diskFolderPath || !state.diskFolderPath.trim()) {
          window.HUB.showToast('Nenhum caminho de pasta configurado. Você pode preencher os links manualmente na Etapa 3.', 'warning');
        }
        state.completedSteps.add(2);
        goToStep(3);
        break;
      }
      case 3: {
        const total = state.generatedCodes.reduce((acc, c) => {
          const group = c._groupId ? State.getGroupById(c._groupId) : null;
          if (c._isAPC) {
            const colors = group ? H.activeApcColors(group).length : 3;
            const genders = group ? H.activeGenders(group).length : 1;
            return acc + (colors * genders);
          }
          const gList = group ? H.activeGenders(group) : ['masc'];
          return acc + gList.filter(g => c[g]).length;
        }, 0);
        // Contar apenas URLs de códigos atualmente gerados (ignora URLs órfãs de códigos removidos)
        const expectedKeys = new Set();
        state.generatedCodes.forEach(c => {
          const group = c._groupId ? State.getGroupById(c._groupId) : null;
          if (c._isAPC) {
            const colors = group ? H.activeApcColors(group) : ['Preto'];
            const genders = group ? H.activeGenders(group) : ['masc'];
            genders.forEach(g => {
              const gKey = g === 'masc' ? 'MASC' : 'FEM';
              colors.forEach(cor => expectedKeys.add(`${c.base}_${gKey}_${cor}`));
            });
          } else {
            const gList = group ? H.activeGenders(group) : ['masc'];
            gList.forEach(g => { if (c[g]) expectedKeys.add(c[g]); });
          }
        });
        const done = [...expectedKeys].filter(k => state.imageUrls[k] && state.imageUrls[k].trim()).length;
        if (done < total) { window.HUB.showToast(`${total - done} código(s) sem links de imagem. Continuando...`, 'warning'); }
        state.completedSteps.add(3);
        goToStep(4);
        break;
      }
      case 4: {
        const bases = [...new Set(state.generatedCodes.map(c => c.base))];
        bases.forEach(b => {
          if ((!state.estampas[b] || !state.estampas[b].trim()) && state.estampaSuggestions[b]) {
            state.estampas[b] = state.estampaSuggestions[b];
          }
        });
        const missing = bases.filter(b => !state.estampas[b] || !state.estampas[b].trim());
        if (missing.length > 0) { window.HUB.showToast(`Preencha o nome da estampa para ${missing.length} código(s)`, 'error'); return; }
        const names = bases.map(b => state.estampas[b].trim().toLowerCase());
        const duplicates = names.filter((item, index) => names.indexOf(item) !== index);
        if (duplicates.length > 0) { window.HUB.showToast('Aviso: Há nomes de estampas duplicados.', 'warning'); }
        state.completedSteps.add(4);
        goToStep(5);
        break;
      }
      case 5: {
        if (!state.csvRows.length) state.csvRows = Step5.buildCsvRows();
        state.completedSteps.add(5);
        goToStep(6);
        break;
      }
    }
  }

  function goToStep(n) {
    if (n < 1 || n > 6) return;
    if (n > state.currentStep && !state.completedSteps.has(n - 1) && n !== state.currentStep + 1) {
      window.HUB.showToast('Complete as etapas anteriores primeiro', 'warning');
      return;
    }
    state.currentStep = n;
    State.saveSession();
    render();
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
      case 1: html += Step1.render(); break;
      case 2: html += Step2.render(); break;
      case 3: html += Step3.render(); break;
      case 4: html += Step4Est.render(); break;
      case 5: html += Step5.render(); break;
      case 6: html += Step6.render(); break;
    }
    html += '</div>';
    container.innerHTML = html;

    // Bind events
    switch (state.currentStep) {
      case 1: Step1.bind(deps); break;
      case 2: Step2.bind(deps); break;
      case 3: Step3.bind(deps); break;
      case 4: Step4Est.bind(deps); break;
      case 5: Step5.bind(deps); break;
      case 6: Step6.bind(deps); break;
    }

    // Stepper click navigation
    H.$$('.stepper__step[data-step]').forEach(el => {
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
      const hasSession = State.restoreSession();
      if (hasSession) {
        // Regenerate codes after restore
        state.generatedCodes = CodeGen.generateAllCodes();
        if (state.currentStep > 1) {
          window.HUB.showToast(`♻️ Sessão anterior restaurada (Etapa ${state.currentStep})`, 'info');
        }
      }
    }

    // Check for Agent payload (from Autopilot Agent)
    const agentPayloadStr = sessionStorage.getItem('autopilot-agent-payload');
    if (agentPayloadStr) {
      try {
        const payload = JSON.parse(agentPayloadStr);
        sessionStorage.removeItem('autopilot-agent-payload');
        if (payload.productGroups && payload.productGroups.length) {
          state.productGroups = payload.productGroups;
          State.groupIdCounter = Math.max(...payload.productGroups.map(g => g.id), 0);
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
        State.saveSession();
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

        // Injetar estampas dos resultados do scan
        if (networkPayload.scanResults) {
          for (const r of networkPayload.scanResults) {
            if (r.estampa && r.code) {
              state.estampas[r.code] = r.estampa;
              state.estampaSuggestions[r.code] = r.estampa;
            }
          }
        }

        // Injetar dados de cópia (imagens por código)
        if (networkPayload.copyResults && networkPayload.copyResults.results) {
          state.folderData = {};
          for (const cr of networkPayload.copyResults.results) {
            state.folderData[cr.code] = cr.images.map(img => ({
              name: img.name, url: img.url, sizeKB: img.sizeKB,
              priority: img.priority || 5, gender: img.gender || null,
            }));
          }
        }

        // Preencher diskFolderPath com o caminho local das imagens copiadas
        if (networkPayload.taskId) {
          state.diskFolderPath = `uploads/autopilot/${networkPayload.taskId}`;
        }
        if (networkPayload.copyResults && networkPayload.copyResults.localPath) {
          state.diskFolderPath = networkPayload.copyResults.localPath;
        }

        // Injetar URLs do CDN no state.imageUrls
        // ⚠️ autopilot-live salva com chaves: "BP101_MASC_GERAL", "APC0541_MASC_PRETA"
        //    step5-sheet lê com chaves: 
        //      - Normal: "BP101" (masc), "BP101BL" (fem), "BP101I" (inf)
        //      - APC:    "APC0541_MASC_Preto", "APC0541_MASC_Branco", etc.
        //    Normalizar para o formato do wizard, preservando cores APC
        if (networkPayload.cdnUrls && typeof networkPayload.cdnUrls === 'object') {
          if (!state.imageUrls) state.imageUrls = {};

          for (const [key, urls] of Object.entries(networkPayload.cdnUrls)) {
            const parts = key.split('_');
            const baseCode = parts[0]; // BP101 ou APC0541
            const keyUpper = key.toUpperCase();

            // Detectar se é APC (tem 3+ partes: CODE_GENDER_COLOR)
            const hasGender = keyUpper.includes('_MASC') || keyUpper.includes('_FEM') || keyUpper.includes('_INF');
            const hasColor = keyUpper.includes('_PRETA') || keyUpper.includes('_BRANCA') || keyUpper.includes('_BEGE');
            const isApcKey = hasGender && hasColor;

            if (isApcKey) {
              // ═══ APC: preservar chave completa com gênero + cor ═══
              // Converter PRETA→Preto, BRANCA→Branco, BEGE→Bege para bater com step5
              const genderKey = keyUpper.includes('_MASC') ? 'MASC' : keyUpper.includes('_FEM') ? 'FEM' : 'INF';
              const colorMap = { 'PRETA': 'Preto', 'PRETO': 'Preto', 'BRANCA': 'Branco', 'BRANCO': 'Branco', 'BEGE': 'Bege' };
              const colorPart = parts.find(p => colorMap[p.toUpperCase()]);
              const normalizedColor = colorPart ? (colorMap[colorPart.toUpperCase()] || colorPart) : parts[parts.length - 1];
              
              const apcWizardKey = `${baseCode}_${genderKey}_${normalizedColor}`;
              // Concatenar com | ao invés de sobrescrever (mesmo padrão dos produtos normais)
              if (state.imageUrls[apcWizardKey] && state.imageUrls[apcWizardKey].trim()) {
                if (!state.imageUrls[apcWizardKey].includes(urls)) {
                  state.imageUrls[apcWizardKey] += ' | ' + urls;
                }
              } else {
                state.imageUrls[apcWizardKey] = urls;
              }
              console.log(`  🔗 APC: ${key} → ${apcWizardKey}`);
            } else {
              // ═══ Normal: mapear para code[g] format ═══
              let genderSuffix = ''; // masc = sem sufixo
              if (keyUpper.includes('_FEM')) genderSuffix = 'BL';
              else if (keyUpper.includes('_INF')) genderSuffix = 'I';

              const wizardKey = baseCode + genderSuffix;

              if (state.imageUrls[wizardKey] && state.imageUrls[wizardKey].trim()) {
                if (!state.imageUrls[wizardKey].includes(urls)) {
                  state.imageUrls[wizardKey] += ' | ' + urls;
                }
              } else {
                state.imageUrls[wizardKey] = urls;
              }
            }
          }
          console.log('✅ CDN URLs normalizadas:', Object.keys(state.imageUrls).length, 'códigos');
        }

        // Determinar até onde avançar com base nos dados disponíveis
        state.completedSteps.add(1); // Config veio do agent payload
        state.completedSteps.add(2); // Pastas já foram copiadas pelo live

        // ⚡ BUGFIX: Gerar códigos ANTES de verificar estampas (era race condition)
        // Anteriormente, state.generatedCodes era [] aqui, causando bases=[] e allEstampasFilled=false
        if (state.productGroups && state.productGroups.length) {
          state.generatedCodes = CodeGen.generateAllCodes();
        }

        if (networkPayload.cdnUrls && Object.keys(networkPayload.cdnUrls).length > 0) {
          // CDN já foi feito — verificar se estampas estão todas preenchidas
          state.completedSteps.add(3);
          
          // Auto-skip estampas se TODAS vieram da rede
          const bases = [...new Set(state.generatedCodes.map(c => c.base))];
          const allEstampasFilled = bases.length > 0 && bases.every(b => state.estampas[b] && state.estampas[b].trim());
          
          if (allEstampasFilled) {
            // Todas as estampas vieram das pastas — pular direto para planilha!
            state.completedSteps.add(4);
            state.currentStep = 5;
            window.HUB?.showToast(`✅ ${bases.length} estampas extraídas da rede! Avançando para Planilha...`, 'success');
          } else {
            state.currentStep = 4;
            const missing = bases.filter(b => !state.estampas[b] || !state.estampas[b].trim()).length;
            window.HUB?.showToast(`✅ CDN pronto! ${missing} estampa(s) precisam de revisão.`, 'success');
          }
        } else {
          // Só cópia foi feita — avançar para Etapa 3 (Links/Upload CDN)
          state.currentStep = 3;
          window.HUB?.showToast(`✅ ${networkPayload.scanResults?.filter(r=>r.found).length || 0} códigos copiados! Avançando para Upload CDN...`, 'success');
        }
      } catch (e) {
        console.error('Error parsing network payload:', e);
      }
    }

    // Preserve state across re-renders from sidebar clicks
    if (state.generatedCodes.length && state.completedSteps.has(1)) {
      // State is warm, keep it
    } else {
      if (state.productGroups && state.productGroups.length) {
        state.generatedCodes = CodeGen.generateAllCodes();
      }
    }
    render();
  };

})();
