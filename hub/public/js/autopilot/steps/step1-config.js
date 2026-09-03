(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const H = window.AutopilotModules.Helpers;
  const CodeGen = window.AutopilotModules.CodeGen;
  const Registry = window.AutopilotModules.Registry;
  const Estampas = window.AutopilotModules.Estampas;

  function renderStep1() {
    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- Configurações Globais -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${State.TIFFANY}">⚙️ Configurações Globais</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <div>
            <label class="form-label">Marca</label>
            <select class="form-input" id="ap-brand">
              <option value="" ${!State.state.brand ? 'selected' : ''}>— Selecione a Marca —</option>
              ${State.BRANDS.map(b => `<option value="${b}" ${State.state.brand === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Preço ${State.state.pricePerGender ? '(MASC)' : ''}</label>
            <input class="form-input" id="ap-price" type="text" placeholder="189.90" value="${H.esc(State.state.price)}" />
          </div>
          <div>
            <label class="form-label">Preço de Custo</label>
            <input class="form-input" id="ap-cost-price" type="text" placeholder="55" value="${H.esc(State.state.costPrice)}" />
          </div>
        </div>

        <!-- Preço por gênero -->
        <div style="margin-top:16px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#9ca3af">
            <input type="checkbox" id="ap-price-per-gender" ${State.state.pricePerGender ? 'checked' : ''} style="accent-color:${State.TIFFANY}" />
            Preço diferente por gênero
          </label>
          <div id="ap-per-gender-prices" style="display:${State.state.pricePerGender ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
            <div>
              <label class="form-label" style="color:#ec4899">Preço FEM</label>
              <input class="form-input" id="ap-price-fem" type="text" placeholder="169.90" value="${H.esc(State.state.priceFem)}" />
            </div>
            <div>
              <label class="form-label" style="color:#f59e0b">Preço INF</label>
              <input class="form-input" id="ap-price-inf" type="text" placeholder="129.90" value="${H.esc(State.state.priceInf)}" />
            </div>
          </div>
        </div>

        <!-- Descrição -->
        <div style="margin-top:16px">
          <label class="form-label">Descrição do Produto</label>
          <input class="form-input" id="ap-description" placeholder="Camisa de Pesca Profissional..." value="${H.esc(State.state.description)}" />
        </div>
      </div>

      <!-- Grupos de Produto -->
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;color:${State.TIFFANY}">📦 Grupos de Produto</h3>
        <span class="badge" style="background:${State.TIFFANY}20;color:${State.TIFFANY}">${State.state.productGroups.length} grupo${State.state.productGroups.length > 1 ? 's' : ''}</span>
      </div>

      ${State.state.productGroups.map((group, gIdx) => renderGroupCard(group, gIdx)).join('')}

      <button class="btn btn--secondary" id="ap-add-group" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border:2px dashed rgba(170, 255, 0,.3);background:transparent">
        ➕ Adicionar Grupo de Produto
      </button>

      <!-- Preview Combinado -->
      <div class="card" style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;color:${State.TIFFANY}">👁️ Preview dos Códigos</h3>
          <span class="badge" id="ap-code-count" style="background:${State.TIFFANY}20;color:${State.TIFFANY}">0 códigos</span>
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
    const typeColor = State.PRODUCT_TYPE_COLORS[group.productType] || '#6b7280';
    const codePreview = group.codeStart ? `${group.codeStart} → ${group.codeEnd || '...'}` : 'Sem códigos';
    const expanded = group.expanded !== false;

    return `
    <div class="card" style="padding:0;border-left:3px solid ${typeColor};overflow:hidden" data-group-id="${group.id}">
      <!-- Header -->
      <div data-toggle-group="${group.id}" style="padding:16px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;transition:background .2s">
        <span style="font-size:18px;transition:transform .3s;transform:rotate(${expanded ? '90' : '0'}deg)">▶</span>
        <span style="background:${typeColor}25;color:${typeColor};padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:.5px">${H.esc(group.productType)}</span>
        <span style="color:#9ca3af;font-size:13px;font-family:monospace">${H.esc(codePreview)}</span>
        <span style="color:#6b7280;font-size:12px;margin-left:auto">${H.activeGenders(group).map(g => H.genderLabel(g)).join(' · ')}</span>
        ${State.state.productGroups.length > 1 ? `<button class="btn btn--ghost" data-remove-group="${group.id}" style="color:#ef4444;font-size:13px;padding:4px 10px;margin-left:8px" title="Remover grupo">🗑️</button>` : ''}
      </div>

      <!-- Body -->
      <div style="display:${expanded ? 'block' : 'none'};padding:0 20px 20px;border-top:1px solid rgba(255,255,255,.06)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          <div>
            <label class="form-label">Tipo de Produto</label>
            <select class="form-input ap-group-type" data-group-field="productType" data-group-id="${group.id}" style="font-size:13px">
              <option value="">Selecione...</option>
              <optgroup label="🔀 Com Variação (Grade + Gêneros)">
                ${Registry.PRODUCT_CATALOG.variation.map(p => 
                  `<option value="${p.value}" ${group.productType === p.value ? 'selected' : ''}>${p.icon} ${p.label}</option>`
                ).join('')}
              </optgroup>
              <optgroup label="🎯 Únicos (1 Código = 1 SKU)">
                ${Registry.PRODUCT_CATALOG.unique.map(p => 
                  `<option value="${p.value}" ${group.productType === p.value ? 'selected' : ''}>${p.icon} ${p.label}</option>`
                ).join('')}
              </optgroup>
            </select>
          </div>
          <div>
            <label class="form-label">🎨 Nome da Estampa</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="form-input" style="flex:1" data-group-field="estampaName" data-group-id="${group.id}" placeholder="Ex: Tucunaré Clean Azul" value="${H.esc(group.estampaName)}" />
              <button type="button" class="btn btn--primary" data-generate-estampa="${group.id}" style="padding:8px 14px;font-size:13px;white-space:nowrap;background:linear-gradient(135deg,${State.TIFFANY_D},${State.TIFFANY});border:none;border-radius:8px;color:#fff;cursor:pointer" title="Gerar nome de estampa automaticamente">🎲 Gerar</button>
            </div>
            <div data-estampa-preview="${group.id}" style="margin-top:6px;font-size:11px;color:${State.TIFFANY};opacity:0.8;font-style:italic">
              ${group.estampaName ? `Preview: ${Registry.buildProductTitle(group.productType, State.state.brand || 'BRK FISHING', group.estampaName, 'masc')}` : 'Clique em 🎲 Gerar ou digite o nome da estampa'}
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
            <div style="flex:1"><input class="form-input" data-group-field="codeStart" data-group-id="${group.id}" placeholder="C02576" value="${H.esc(group.codeStart)}" /></div>
            <div style="flex:1"><input class="form-input" data-group-field="codeEnd" data-group-id="${group.id}" placeholder="C02651" value="${H.esc(group.codeEnd)}" /></div>
          </div>
          <div style="display:${!isRange ? 'block' : 'none'}">
            <textarea class="form-input" data-group-field="manualCodes" data-group-id="${group.id}" rows="4" placeholder="Um código por linha...">${H.esc(group.manualCodes)}</textarea>
          </div>
        </div>

        <!-- Genders -->
        <div class="ap-gender-section" style="margin-top:16px;display:${isGroupAPC || Registry.isUniqueProduct(group.productType) ? 'none' : 'block'}">
          <label class="form-label">Gêneros</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
            <button class="gender-pill gender-pill--masc ${group.genders.masc ? 'active' : ''}" data-group-gender="masc" data-group-id="${group.id}">👔 Masculino</button>
            <button class="gender-pill gender-pill--fem ${group.genders.fem ? 'active' : ''}" data-group-gender="fem" data-group-id="${group.id}">👗 Feminino</button>
            <button class="gender-pill gender-pill--inf ${group.genders.inf ? 'active' : ''}" data-group-gender="inf" data-group-id="${group.id}">🧒 Infantil</button>
          </div>
          <div style="display:flex;gap:16px;margin-top:12px">
            <div style="display:${group.genders.fem ? 'block' : 'none'};flex:1">
              <label class="form-label">Sufixo FEM</label>
              <input class="form-input" data-group-field="femSuffix" data-group-id="${group.id}" value="${H.esc(group.femSuffix)}" placeholder="BL" />
            </div>
            <div style="display:${group.genders.inf ? 'block' : 'none'};flex:1">
              <label class="form-label">Sufixo INF</label>
              <input class="form-input" data-group-field="infSuffix" data-group-id="${group.id}" value="${H.esc(group.infSuffix)}" placeholder="I" />
            </div>
          </div>
        </div>

        <!-- APC Colors -->
        <div style="margin-top:16px;${isGroupAPC ? '' : 'display:none'}">
          <label class="form-label">🎨 Cores do APC</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
            ${Registry.APC_COLORS.map(c => `
              <button class="gender-pill ${group.apcColors[c] ? 'active' : ''}" data-group-apc-color="${c}" data-group-id="${group.id}"
                style="border-color:${Registry.APC_COLOR_CSS[c]}60;${group.apcColors[c] ? `background:${Registry.APC_COLOR_CSS[c]}30;color:${c === 'Preto' ? '#d1d5db' : Registry.APC_COLOR_CSS[c]}` : ''}">
                ${Registry.APC_COLOR_DISPLAY[c]}
              </button>
            `).join('')}
          </div>
          <div style="margin-top:12px">
            <label class="form-label">🏷️ Prefixo APC (opcional)</label>
            <input class="form-input" data-group-field="apcPrefix" data-group-id="${group.id}" placeholder="Ex: PREMIUM" value="${H.esc(group.apcPrefix)}" />
          </div>
        </div>
      </div>
    </div>`;
  }

  function bindStep1(deps) {
    const { render, validateAndAdvance } = deps;
    // Global fields
    const globalFields = [['ap-price','price'],['ap-cost-price','costPrice'],['ap-price-fem','priceFem'],['ap-price-inf','priceInf'],['ap-description','description']];
    globalFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { State.state[key] = el.value; State.saveSession(); });
    });

    const brandSel = document.getElementById('ap-brand');
    if (brandSel) brandSel.addEventListener('change', () => { State.state.brand = brandSel.value; State.saveSession(); });

    const ppgToggle = document.getElementById('ap-price-per-gender');
    if (ppgToggle) ppgToggle.addEventListener('change', () => { State.state.pricePerGender = ppgToggle.checked; render(); });

    // Group-level fields
    document.querySelectorAll('[data-group-field]').forEach(el => {
      const field = el.dataset.groupField;
      const groupId = parseInt(el.dataset.groupId, 10);
      const handler = field === 'productType' ? 'change' : 'input';
      el.addEventListener(handler, () => {
        const group = State.getGroupById(groupId);
        if (!group) return;
        group[field] = el.value;
        if (field === 'productType' && Registry.isUniqueProduct(group.productType)) {
          group.genders = { masc: true, fem: false, inf: false };
        }
        // APC sempre precisa de MASC + FEM
        if (field === 'productType' && group.productType === 'APC') {
          group.genders.masc = true;
          group.genders.fem = true;
        }
        updateCodePreview();
        State.saveSession();
        if (field === 'productType') render();
      });
    });

    // Group code mode tabs
    document.querySelectorAll('[data-group-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = State.getGroupById(parseInt(btn.dataset.groupId, 10));
        if (!group) return;
        group.codeMode = btn.dataset.groupMode;
        render();
      });
    });

    // Group gender pills
    document.querySelectorAll('[data-group-gender]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = State.getGroupById(parseInt(btn.dataset.groupId, 10));
        if (!group) return;
        const g = btn.dataset.groupGender;
        group.genders[g] = !group.genders[g];
        if (!H.activeGenders(group).length) { group.genders[g] = true; window.HUB.showToast('Selecione ao menos um gênero', 'warning'); return; }
        render();
      });
    });

    // Group APC color pills
    document.querySelectorAll('[data-group-apc-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = State.getGroupById(parseInt(btn.dataset.groupId, 10));
        if (!group) return;
        const c = btn.dataset.groupApcColor;
        group.apcColors[c] = !group.apcColors[c];
        if (!H.activeApcColors(group).length) { group.apcColors[c] = true; window.HUB.showToast('Selecione ao menos uma cor', 'warning'); return; }
        render();
      });
    });

    // Toggle group expand/collapse
    document.querySelectorAll('[data-toggle-group]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove-group]')) return;
        const group = State.getGroupById(parseInt(el.dataset.toggleGroup, 10));
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
        if (State.state.productGroups.length <= 1) { window.HUB.showToast('Precisa de ao menos um grupo', 'warning'); return; }
        if (!confirm('Remover este grupo de produto?')) return;
        State.state.productGroups = State.state.productGroups.filter(g => g.id !== groupId);
        render();
      });
    });

    // Add group
    const addBtn = document.getElementById('ap-add-group');
    if (addBtn) addBtn.addEventListener('click', () => {
      const newGroup = State.createDefaultGroup(++State.groupIdCounter);
      State.state.productGroups.push(newGroup);
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
        const group = State.getGroupById(gid);
        if (!group) return;
        const brandKey = (State.state.brand || 'BRK FISHING').toLowerCase().includes('agro') ? 'agro'
          : (State.state.brand || '').toLowerCase().includes('motor') ? 'motors' : 'fishing';
        const name = Estampas.generateEstampaName(brandKey);
        group.estampaName = name;
        Estampas.addUsedEstampa(name);
        // Update input
        const input = document.querySelector(`[data-group-field="estampaName"][data-group-id="${gid}"]`);
        if (input) input.value = name;
        // Update preview
        const preview = document.querySelector(`[data-estampa-preview="${gid}"]`);
        if (preview) {
          preview.textContent = `Preview: ${Registry.buildProductTitle(group.productType, State.state.brand || 'BRK FISHING', name, 'masc')}`;
        }
        // Animate button
        btn.textContent = '✅ Gerado!';
        setTimeout(() => { btn.textContent = '🎲 Gerar'; }, 1500);
        State.saveSession();
      };
    });

    // Update preview on estampa name input change
    document.querySelectorAll('[data-group-field="estampaName"]').forEach(input => {
      input.addEventListener('input', () => {
        const gid = parseInt(input.dataset.groupId);
        const group = State.getGroupById(gid);
        if (!group) return;
        const preview = document.querySelector(`[data-estampa-preview="${gid}"]`);
        if (preview && input.value.trim()) {
          preview.textContent = `Preview: ${Registry.buildProductTitle(group.productType, State.state.brand || 'BRK FISHING', input.value.trim(), 'masc')}`;
        } else if (preview) {
          preview.textContent = 'Clique em 🎲 Gerar ou digite o nome da estampa';
        }
      });
    });

    updateCodePreview();
  }

  function updateCodePreview() {
    const codes = CodeGen.generateAllCodes();
    State.state.generatedCodes = codes;

    const countEl = document.getElementById('ap-code-count');
    const previewEl = document.getElementById('ap-code-preview');
    if (!countEl || !previewEl) return;

    const totalSKUs = H.totalSkuCount();
    countEl.textContent = `${codes.length} código${codes.length !== 1 ? 's' : ''} · ${totalSKUs} SKU${totalSKUs !== 1 ? 's' : ''}`;

    if (!codes.length) {
      previewEl.innerHTML = '<span style="color:#6b7280">Preencha os campos acima para gerar preview...</span>';
      return;
    }

    let html = '';
    let lastGroupId = null;
    codes.forEach(c => {
      const typeColor = State.PRODUCT_TYPE_COLORS[c.productType] || '#6b7280';
      if (c._groupId !== lastGroupId) {
        if (lastGroupId !== null) html += '<div style="border-top:1px solid rgba(255,255,255,.08);margin:8px 0"></div>';
        html += `<div style="font-size:11px;color:${typeColor};font-weight:700;letter-spacing:.5px;margin-bottom:4px;text-transform:uppercase">${H.esc(c.productType)}</div>`;
        lastGroupId = c._groupId;
      }

      if (c._isAPC) {
        const group = State.getGroupById(c._groupId);
        const colors = group ? H.activeApcColors(group) : Registry.APC_COLORS;
        const prefix = group && group.apcPrefix && group.apcPrefix.trim() ? group.apcPrefix.trim().toUpperCase() : '';
        const colorParts = colors.map(cor => {
          const corCode = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();
          const sampleCode = prefix ? `${c.base}-${prefix}-${corCode}-P` : `${c.base}-PREMIUM-${corCode}-P`;
          return `<span style="color:${Registry.APC_COLOR_CSS[cor]}">${H.esc(sampleCode)}</span>`;
        });
        html += `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:${State.TIFFANY};font-weight:600">${H.esc(c.base)}</span>
          <span style="color:#4b5563;margin:0 6px">→</span>
          ${colorParts.join(' <span style="color:#4b5563;margin:0 4px">|</span> ')}
        </div>`;
      } else {
        const parts = [];
        if (c.masc) parts.push(`<span style="color:#3b82f6">${H.esc(c.masc)}</span> <span style="color:#6b7280;font-size:11px">(MASC)</span>`);
        if (c.fem)  parts.push(`<span style="color:#ec4899">${H.esc(c.fem)}</span> <span style="color:#6b7280;font-size:11px">(FEM)</span>`);
        if (c.inf)  parts.push(`<span style="color:#f59e0b">${H.esc(c.inf)}</span> <span style="color:#6b7280;font-size:11px">(INF)</span>`);
        html += `<div style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)">${parts.join(' <span style="color:#4b5563;margin:0 6px">|</span> ')}</div>`;
      }
    });

    previewEl.innerHTML = html;
  }

  window.AutopilotModules.Step1 = { render: renderStep1, renderGroupCard, bind: bindStep1, updateCodePreview };
})();