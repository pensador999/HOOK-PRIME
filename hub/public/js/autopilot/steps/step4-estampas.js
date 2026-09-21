(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const Registry = window.AutopilotModules.Registry;
  const Estampas = window.AutopilotModules.Estampas;
  const H = window.AutopilotModules.Helpers;

  function renderStep4_Estampas() {
    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${State.TIFFANY}">🎨 Revisão de Estampas</h3>
        <p style="color:#9ca3af;font-size:14px;margin-bottom:24px">Defina o nome de cada estampa. O nome será usado no título SEO do produto.</p>
        <div style="display:flex;flex-direction:column;gap:8px">`;

    const bases = [...new Set(State.state.generatedCodes.map(c => c.base))];
    let filled = 0;

    bases.forEach(base => {
      const val = State.state.estampas[base] || State.state.estampaSuggestions[base] || '';
      if (val.trim()) filled++;

      const codeObj = State.state.generatedCodes.find(c => c.base === base);
      const group = codeObj._groupId ? State.getGroupById(codeObj._groupId) : State.getFirstGroup();
      
      const type = codeObj.productType || group.productType;
      const brand = State.state.brand || 'BRK FISHING';
      const preview = Registry.buildProductTitle(type, brand, val, 'masc');

      html += `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,0,0,.15);border-radius:8px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.08)">
          <span style="font-family:monospace;font-weight:700;color:#e5e7eb;min-width:90px">📁 ${H.esc(base)}</span>
          <input type="text" class="form-input ap-estampa-input" data-base="${H.esc(base)}" 
            value="${H.esc(val)}" placeholder="Nome da estampa..." 
            style="flex:1;font-size:13px;padding:8px 12px" />
          <button class="btn btn--secondary ap-estampa-suggest" data-base="${H.esc(base)}" 
            style="font-size:11px;padding:4px 10px;background:rgba(0,0,0,.2)" title="Sugerir nome">🎲</button>
          <span class="ap-estampa-preview" data-base="${H.esc(base)}" data-type="${H.esc(type)}"
            style="font-size:11px;color:#6b7280;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${H.esc(preview)}">
            → ${H.esc(preview)}
          </span>
        </div>`;
    });

    html += `
        </div>
        <div style="margin-top:16px;font-size:14px;color:${filled === bases.length ? State.TIFFANY : '#f59e0b'}">
          ${filled === bases.length ? '✅' : '⚠️'} ${filled} de ${bases.length} estampas definidas
        </div>
      </div>
      <!-- Navigation -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px">
        <button class="btn btn--secondary" id="ap-prev-4-est">← Voltar</button>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn--secondary" id="ap-gemini-estampas" style="color:#88CC00;border-color:#88CC0040" title="Usar IA Gemini para reconhecer estampas automaticamente">
            🤖 IA Gemini
          </button>
          <button class="btn btn--secondary" id="ap-skip-estampas" style="color:#f59e0b;border-color:#f59e0b40" title="Pular esta etapa e ir direto para a planilha">
            ⏩ Pular Estampas
          </button>
          <button class="btn btn--primary" id="ap-next-4-est" style="min-width:180px">Próximo Passo →</button>
        </div>
      </div>
    </div>`;

    return html;
  }

  function bindStep4_Estampas(deps) {
    const { goToStep, validateAndAdvance } = deps;
    const $$ = H.$$;
    $$('.ap-estampa-input').forEach(input => {
      input.addEventListener('input', () => {
        const base = input.dataset.base;
        State.state.estampas[base] = input.value;
        State.saveSession();
        
        const previewEl = document.querySelector(`.ap-estampa-preview[data-base="${base}"]`);
        if (previewEl) {
          const type = previewEl.dataset.type;
          const preview = Registry.buildProductTitle(type, State.state.brand || 'BRK FISHING', input.value, 'masc');
          previewEl.textContent = '→ ' + preview;
          previewEl.title = preview;
        }
      });
    });

    $$('.ap-estampa-suggest').forEach(btn => {
      btn.addEventListener('click', () => {
        const base = btn.dataset.base;
        const brandKey = (State.state.brand || '').toLowerCase().includes('agro') ? 'agro' 
          : (State.state.brand || '').toLowerCase().includes('motor') ? 'motors' : 'fishing';
        
        const newName = Estampas.generateEstampaName(brandKey, Object.values(State.state.estampas));
        const input = document.querySelector(`.ap-estampa-input[data-base="${base}"]`);
        if (input) {
          input.value = newName;
          State.state.estampas[base] = newName;
          State.saveSession();
          
          const previewEl = document.querySelector(`.ap-estampa-preview[data-base="${base}"]`);
          if (previewEl) {
            const type = previewEl.dataset.type;
            const preview = Registry.buildProductTitle(type, State.state.brand || 'BRK FISHING', newName, 'masc');
            previewEl.textContent = '→ ' + preview;
            previewEl.title = preview;
          }
        }
      });
    });

    // ── 🤖 Gemini IA — Reconhecimento automático de estampas ──
    const geminiBtn = document.getElementById('ap-gemini-estampas');

    async function runGeminiAnalysis() {
      if (!geminiBtn) return;
      geminiBtn.disabled = true;
      geminiBtn.textContent = '🤖 Verificando IA...';

      try {
        // Checar status da Gemini API
        const statusRes = await fetch('/api/gemini/status');
        const status = await statusRes.json();

        if (!status.ready) {
          window.HUB?.showToast(status.message, 'error');
          geminiBtn.disabled = false;
          geminiBtn.textContent = '🤖 IA Gemini';
          return;
        }

        // Categoria base pela brand (fallback)
        const brandLower = (State.state.brand || '').toLowerCase();
        const brandCategory = brandLower.includes('agro') ? 'agro'
          : brandLower.includes('motor') ? 'motors' : 'fishing';

        // Auto-detecção de categoria pelo prefixo do código
        const PREFIX_CATEGORY = {
          APC0:'agro', CPT:'agro', LC:'agro', MTL:'agro',
          ADV:'motors', CADV:'motors',
        };
        function inferCategoryFromCode(code) {
          const upper = (code || '').toUpperCase();
          for (const [p, cat] of Object.entries(PREFIX_CATEGORY)) {
            if (upper.startsWith(p)) return cat;
          }
          return null;
        }

        // Montar lista de imagens para análise
        const bases = [...new Set(State.state.generatedCodes.map(c => c.base))];
        const batchImages = [];
        const taskId = State.state.taskId;

        for (const base of bases) {
          // Só analisar estampas vazias
          if (State.state.estampas[base] && State.state.estampas[base].trim()) continue;

          const codeObj = State.state.generatedCodes.find(c => c.base === base);
          const group = codeObj?._groupId ? State.getGroupById(codeObj._groupId) : State.getFirstGroup();
          const productType = codeObj?.productType || group?.productType || '';

          // Categoria per-item: prefixo > brand > fishing
          const itemCategory = inferCategoryFromCode(base) || brandCategory;

          // Buscar imagem via API (lista de imagens copiadas)
          let imagePath = null;
          if (taskId) {
            try {
              const imgRes = await fetch(`/api/autopilot/images/${taskId}/${base}`);
              if (imgRes.ok) {
                const imgData = await imgRes.json();
                // FIX 1.1: API retorna array direto OU objeto com .images
                const imgList = Array.isArray(imgData) ? imgData : (imgData.images || []);
                if (imgList.length > 0) {
                  // Preferir 3D > MASC > GERAL > primeira disponível
                  const getName = (item) => typeof item === 'string' ? item : (item.name || item.url || '');
                  const pref = imgList.find(i => getName(i).toLowerCase().includes('3d'))
                    || imgList.find(i => getName(i).toLowerCase().includes('masc'))
                    || imgList.find(i => getName(i).toLowerCase().includes('geral'))
                    || imgList[0];
                  const prefName = getName(pref);
                  imagePath = `uploads/autopilot/${taskId}/${base}/${prefName}`;
                }
              }
            } catch (e) { /* silenciar */ }
          }

          // FIX 1.3: Fallback com múltiplos candidatos (backend valida qual existe)
          if (!imagePath && State.state.diskFolderPath) {
            const dp = State.state.diskFolderPath;
            const candidates = [
              `${dp}/${base}/1.jpg`,
              `${dp}/${base}/GERAL/1.jpg`,
              `${dp}/${base}/3D/1_FRENTE.png`,
              `${dp}/${base}/MASC/01MASC.jpg`,
              `${dp}/${base}/3d/${base.toLowerCase()}.png`,
            ];
            // Enviar o primeiro como imagePath + candidatos extras para o backend
            imagePath = candidates[0];
          }

          if (imagePath) {
            batchImages.push({ code: base, imagePath, productType, category: itemCategory });
          }
        }

        if (batchImages.length === 0) {
          window.HUB?.showToast('✅ Todas as estampas já estão definidas', 'info');
          geminiBtn.disabled = false;
          geminiBtn.textContent = '🤖 IA Gemini';
          return;
        }

        geminiBtn.textContent = `🤖 Analisando ${batchImages.length} imgs...`;

        const res = await fetch('/api/gemini/batch-describe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: batchImages, category }),
        });

        const data = await res.json();

        if (data.success && data.results) {
          let filled = 0;
          for (const r of data.results) {
            if (r.estampa && r.code) {
              const input = document.querySelector(`.ap-estampa-input[data-base="${r.code}"]`);
              if (input && (!input.value || !input.value.trim())) {
                input.value = r.estampa;
                State.state.estampas[r.code] = r.estampa;
                filled++;

                const previewEl = document.querySelector(`.ap-estampa-preview[data-base="${r.code}"]`);
                if (previewEl) {
                  const type = previewEl.dataset.type;
                  const preview = Registry.buildProductTitle(type, State.state.brand || 'BRK FISHING', r.estampa, 'masc');
                  previewEl.textContent = '→ ' + preview;
                  previewEl.title = preview;
                }
              }
            }
          }
          State.saveSession();
          window.HUB?.showToast(`🤖 Gemini: ${filled} estampas reconhecidas!`, 'success');
        } else {
          window.HUB?.showToast(`❌ Erro: ${data.error || 'Falha na análise'}`, 'error');
        }
      } catch (err) {
        window.HUB?.showToast(`❌ Erro Gemini: ${err.message}`, 'error');
      }

      geminiBtn.disabled = false;
      geminiBtn.textContent = '🤖 IA Gemini';
    }

    if (geminiBtn) {
      geminiBtn.addEventListener('click', runGeminiAnalysis);

      // 🚀 Auto-trigger: se há estampas vazias, rodar automaticamente ao entrar na step
      const bases = [...new Set(State.state.generatedCodes.map(c => c.base))];
      const emptyCount = bases.filter(b => !State.state.estampas[b] || !State.state.estampas[b].trim()).length;
      if (emptyCount > 0 && emptyCount === bases.length) {
        // Todas vazias — auto-trigger após um breve delay para a UI renderizar
        setTimeout(() => runGeminiAnalysis(), 500);
      }
    }

    const prevBtn = document.getElementById('ap-prev-4-est');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(3));

    const nextBtn = document.getElementById('ap-next-4-est');
    if (nextBtn) nextBtn.addEventListener('click', () => validateAndAdvance(4));

    const skipBtn = document.getElementById('ap-skip-estampas');
    if (skipBtn) skipBtn.addEventListener('click', () => {
      // Skip estampas — fill with group estampaName or folder-based suggestion or placeholder
      const bases = [...new Set(State.state.generatedCodes.map(c => c.base))];
      bases.forEach(base => {
        if (!State.state.estampas[base] || !State.state.estampas[base].trim()) {
          const code = State.state.generatedCodes.find(c => c.base === base);
          const codeGroup = code ? State.getGroupById(code._groupId) : null;
          const fallback = (codeGroup && codeGroup.estampaName && codeGroup.estampaName.trim())
            || State.state.estampaSuggestions[base]
            || base;  // Usa o próprio código como nome se não houver nenhuma sugestão
          State.state.estampas[base] = fallback;
        }
      });
      State.state.completedSteps.add(4);
      State.saveSession();
      goToStep(5);
    });
  }

  window.AutopilotModules.Step4Est = { render: renderStep4_Estampas, bind: bindStep4_Estampas };
})();