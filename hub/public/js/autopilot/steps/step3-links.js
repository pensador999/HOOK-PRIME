(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const H = window.AutopilotModules.Helpers;
  const Registry = window.AutopilotModules.Registry;

  function renderStep3() {
    const codes = State.state.generatedCodes;
    const hasDiskPath = State.state.diskFolderPath && State.state.diskFolderPath.trim();

    // Count: a code is "done" when ALL its active slots have links
    const doneCount = codes.filter(code => {
      if (code._isAPC) {
        // APC: check by gender × color
        const group = State.getGroupById(code._groupId);
        const colors = group ? H.activeApcColors(group) : Registry.APC_COLORS;
        const genders = group ? H.activeGenders(group) : ['masc'];
        return genders.every(g => {
          const gk = g === 'masc' ? 'MASC' : 'FEM';
          return colors.every(cor => {
            const url = State.state.imageUrls[`${code.base}_${gk}_${cor}`];
            return url && url.trim();
          });
        });
      }
      // Normal: check by gender
      const group = State.getGroupById(code._groupId);
      const gendersList = group ? H.activeGenders(group) : ['masc'];
      return gendersList.every(g => {
        if (!code[g]) return true;
        const url = State.state.imageUrls[code[g]];
        return url && url.trim();
      });
    }).length;
    const totalCount = codes.length;
    const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
    const currentFilter = State.state.linkFilter || 'all';

    let html = `
    <div style="display:flex;flex-direction:column;gap:20px">

      <!-- Header -->
      <div class="card" style="padding:24px">
        <h3 style="margin:0 0 12px;color:${State.TIFFANY}">🔗 Links de Imagens</h3>

        ${hasDiskPath ? `
        <!-- Caminho configurado — pronto para upload -->
        <div style="background:linear-gradient(135deg,rgba(127, 0, 255,0.12),rgba(127, 0, 255,0.03));border:1px solid rgba(127, 0, 255,0.3);border-radius:12px;padding:16px 20px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:20px">✅</span>
            <span style="font-size:14px;font-weight:700;color:${State.TIFFANY}">Pasta Configurada — Pronto para Upload!</span>
          </div>
          <div style="font-size:13px;color:#A855F7;line-height:1.6">
            <strong>📁 ${H.esc(State.state.diskFolderPath)}</strong><br>
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
              <div id="ap-upload-spinner" style="width:18px;height:18px;border:2px solid ${State.TIFFANY}40;border-top:2px solid ${State.TIFFANY};border-radius:50%;animation:spin 1s linear infinite"></div>
              <span id="ap-upload-status" style="font-size:13px;color:${State.TIFFANY};font-weight:600">Enviando...</span>
            </div>
            <button class="btn btn--secondary" id="ap-upload-cancel" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef4444">
              ✕ Cancelar
            </button>
          </div>
          <div id="ap-upload-detail" style="font-size:12px;color:#9ca3af;margin-bottom:8px">Preparando...</div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">
            <div id="ap-upload-bar" style="width:0%;height:100%;background:linear-gradient(90deg,${State.TIFFANY_D || '#9333ea'},${State.TIFFANY});border-radius:3px;transition:width .3s ease"></div>
          </div>
        </div>

        <!-- Progress -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:13px;color:#9ca3af">${doneCount} de ${totalCount} códigos completos</span>
          <span style="font-size:14px;font-weight:700;color:${State.TIFFANY}">${pct}%</span>
        </div>
        <div style="height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,${State.TIFFANY_D || '#9333ea'},${State.TIFFANY});border-radius:4px;transition:width .4s ease"></div>
        </div>
      </div>

      <!-- Actions bar -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn--primary" id="ap-auto-upload-all" style="font-size:13px;padding:10px 18px;background:linear-gradient(135deg,${State.TIFFANY_D || '#9333ea'},${State.TIFFANY});position:relative;overflow:hidden">
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
          <button class="badge ap-filter-pill ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" style="cursor:pointer;padding:6px 14px;font-size:12px;border:1px solid ${currentFilter === 'all' ? State.TIFFANY : 'rgba(255,255,255,.1)'};background:${currentFilter === 'all' ? State.TIFFANY + '20' : 'transparent'};color:${currentFilter === 'all' ? State.TIFFANY : '#6b7280'};border-radius:6px">
            Todos (${totalCount})
          </button>
          <button class="badge ap-filter-pill ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending" style="cursor:pointer;padding:6px 14px;font-size:12px;border:1px solid ${currentFilter === 'pending' ? '#f59e0b' : 'rgba(255,255,255,.1)'};background:${currentFilter === 'pending' ? '#f59e0b20' : 'transparent'};color:${currentFilter === 'pending' ? '#f59e0b' : '#6b7280'};border-radius:6px">
            ⏳ Pendentes (${totalCount - doneCount})
          </button>
          <button class="badge ap-filter-pill ${currentFilter === 'done' ? 'active' : ''}" data-filter="done" style="cursor:pointer;padding:6px 14px;font-size:12px;border:1px solid ${currentFilter === 'done' ? State.TIFFANY : 'rgba(255,255,255,.1)'};background:${currentFilter === 'done' ? State.TIFFANY + '20' : 'transparent'};color:${currentFilter === 'done' ? State.TIFFANY : '#6b7280'};border-radius:6px">
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
    const hasFolderData = !!(State.state.diskFolderPath && State.state.diskFolderPath.trim());
    let html = '';
    // Build lookup set from diskScanResult folderNames for O(1) checking
    const knownFolders = new Set(
      (State.state.diskScanResult && State.state.diskScanResult.folderNames) 
        ? State.state.diskScanResult.folderNames.map(n => {
            // Extract base code from folder names like "C02576 - TUCUNARE" or "C02576_TUCUNARE"
            const match = n.match(/^([A-Za-z]+\d+)/);
            return match ? match[1].toUpperCase() : n.toUpperCase();
          })
        : []
    );

    State.state.generatedCodes.forEach((code, codeIdx) => {
      const codeGroup = State.getGroupById(code._groupId);

      // ═══ APC: Cards separados MASC + FEM ═══
      if (code._isAPC) {
        const colors = codeGroup ? H.activeApcColors(codeGroup) : Registry.APC_COLORS;
        const genders = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
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
            const u = State.state.imageUrls[`${code.base}_${g === 'masc' ? 'MASC' : 'FEM'}_${cor}`];
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
            const u = State.state.imageUrls[`${code.base}_${genderKey}_${cor}`];
            return u && u.trim();
          });
          const genderDoneCount = colors.filter(cor => {
            const u = State.state.imageUrls[`${code.base}_${genderKey}_${cor}`];
            return u && u.trim();
          }).length;

          html += `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${H.esc(code.base)}" data-is-apc="true" data-apc-gender="${genderKey}" ${genderDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${genderDone ? (State.TIFFANY_D || '#9333ea') : info.color + '80'};transition:border-color .3s;${gIdx > 0 ? 'margin-top:8px' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${H.esc(codeWithSuffix)}</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(212,165,116,0.15);color:#d4a574;font-weight:600">APC</span>
                <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${info.color}20;color:${info.color};font-weight:600">${info.icon} ${info.label}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                ${hasImages && !genderDone ? `
                <button class="btn btn--secondary ap-upload-single-btn" data-base="${H.esc(code.base)}" data-idx="${codeIdx}" data-apc-gender="${genderKey}" style="font-size:11px;padding:4px 12px;color:${State.TIFFANY};border-color:${State.TIFFANY}40">
                  🚀 Gerar
                </button>` : ''}
                ${genderDone ? `
                <button class="btn btn--secondary ap-clear-code-links" data-base="${H.esc(code.base)}" data-idx="${codeIdx}" data-apc-gender="${genderKey}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste bloco">
                  🗑️
                </button>` : ''}
                <span style="font-size:12px;font-weight:600;color:${genderDone ? State.TIFFANY : '#f59e0b'}">
                  ${genderDone ? '✅ Completo' : `⏳ ${genderDoneCount}/${colors.length}`}
                </span>
              </div>
            </div>`;

          // Uma row por COR dentro deste gênero
          colors.forEach((cor, corIdx) => {
            const urlKey = `${code.base}_${genderKey}_${cor}`;
            const url = State.state.imageUrls[urlKey] || '';
            const isDone = url.trim().length > 0;
            const colorCss = Registry.APC_COLOR_CSS[cor] || '#6b7280';
            const colorIcon = { Preto: '⬛', Branco: '⬜', Bege: '🟫' }[cor] || '🔲';
            const corDesc = { Preto: 'PRETO', Branco: 'BRANCO', Bege: 'BEGE' }[cor] || cor.toUpperCase();

            const prefix = codeGroup && codeGroup.apcPrefix && codeGroup.apcPrefix.trim()
              ? codeGroup.apcPrefix.trim().toUpperCase() : 'PREMIUM';
            const sizes = H.sizesFor(g, code.productType);
            const sampleCodes = sizes.slice(0, 3).map(s => `${codeWithSuffix}-${prefix}-${corDesc}-${s}`);
            const appliesTo = sampleCodes.join(', ') + (sizes.length > 3 ? `, +${sizes.length - 3}` : '');

            html += `<div class="ap-gender-row ap-color-row" data-gender-code="${H.esc(urlKey)}" data-apc-color="${H.esc(cor)}" data-apc-gender="${genderKey}" style="padding:12px;margin-bottom:${corIdx < colors.length - 1 ? '10px' : '0'};background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? State.TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="badge" style="background:${colorCss}25;color:${colorCss};font-size:12px;padding:4px 12px;border-radius:6px;font-weight:700;letter-spacing:.5px">${colorIcon} ${cor.toUpperCase()}</span>
                  <span class="ap-gender-status" style="font-size:12px;color:${isDone ? State.TIFFANY : '#6b7280'}">
                    ${isDone ? '✅' : '⏳'}
                  </span>
                </div>
              </div>

              <input type="text" class="form-input ap-link-input"
                data-code="${H.esc(urlKey)}" data-base="${H.esc(code.base)}" data-gender="${g}" data-apc-color="${H.esc(cor)}" data-apc-gender="${genderKey}" data-idx="${codeIdx}"
                value="${H.esc(url)}"
                placeholder="${hasImages ? `Imagens ${info.label} ${cor} prontas para upload` : `Cole link ${info.label} ${cor}...`}"
                style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? State.TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

              <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
                → Aplica em: <span style="color:#6b7280">${H.esc(appliesTo)}</span>
              </div>
            </div>`;
          });

          html += '</div>';
        });

        return; // skip normal rendering below
      }

      // ═══ NORMAL (não-APC): Inputs por GÊNERO (inalterado) ═══
      const gendersList = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
      const isCodeDone = gendersList.every(g => {
        if (!code[g]) return true;
        const url = State.state.imageUrls[code[g]];
        return url && url.trim();
      });

      if (filter === 'pending' && isCodeDone) return;
      if (filter === 'done' && !isCodeDone) return;

      const hasImages = hasFolderData && knownFolders.has(code.base.toUpperCase());

      html += `<div class="card ap-link-code-card" data-code-idx="${codeIdx}" data-base="${H.esc(code.base)}" ${isCodeDone ? 'data-done="true"' : ''} style="padding:18px 22px;border-left:3px solid ${isCodeDone ? (State.TIFFANY_D || '#9333ea') : '#4b5563'};transition:border-color .3s">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-weight:700;font-family:'Cascadia Code','Fira Code',monospace;font-size:16px;color:#e5e7eb">📁 ${H.esc(code.base)}</span>
            <span style="font-size:12px;color:#6b7280">#${codeIdx + 1} de ${State.state.generatedCodes.length}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${hasImages && !isCodeDone ? `
            <button class="btn btn--secondary ap-upload-single-btn" data-base="${H.esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:${State.TIFFANY};border-color:${State.TIFFANY}40">
              🚀 Gerar
            </button>` : ''}
            ${isCodeDone ? `
            <button class="btn btn--secondary ap-clear-code-links" data-base="${H.esc(code.base)}" data-idx="${codeIdx}" style="font-size:11px;padding:4px 12px;color:#ef4444;border-color:#ef444440" title="Apagar links deste código">
              🗑️
            </button>` : ''}
            <span style="font-size:12px;font-weight:600;color:${isCodeDone ? State.TIFFANY : '#f59e0b'}">
              ${isCodeDone ? '✅ Completo' : '⏳ Pendente'}
            </span>
          </div>
        </div>`;

      gendersList.forEach(g => {
        if (!code[g]) return;

        const codeKey = code[g];
        const url = State.state.imageUrls[codeKey] || '';
        const isDone = url.trim().length > 0;
        const imgCount = hasImages ? '✓' : 0;

        const sizes = H.sizesFor(g, code.productType);
        const appliesToCodes = [codeKey, ...sizes.map(s => codeKey + s)];
        const appliesTo = appliesToCodes.join(', ');

        html += `<div class="ap-gender-row" data-gender-code="${H.esc(codeKey)}" style="padding:12px;margin-bottom:${g !== gendersList[gendersList.length - 1] ? '10px' : '0'};background:rgba(${isDone ? '65,255,10' : '255,255,255'},0.03);border:1px solid ${isDone ? State.TIFFANY + '30' : 'rgba(255,255,255,.06)'};border-radius:8px;transition:all .3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge" style="background:${H.genderColor(g)}25;color:${H.genderColor(g)};font-size:11px;padding:3px 10px;border-radius:6px">${H.genderLabel(g)}</span>
              <span class="ap-gender-status" style="font-size:12px;color:${isDone ? State.TIFFANY : '#6b7280'}">
                ${isDone ? '✅' : '⏳'}
              </span>
              ${imgCount ? `<span style="font-size:11px;color:${State.TIFFANY}">📂 Imagens detectadas</span>` : ''}
            </div>
          </div>

          <input type="text" class="form-input ap-link-input"
            data-code="${H.esc(codeKey)}" data-base="${H.esc(code.base)}" data-gender="${g}" data-idx="${codeIdx}"
            value="${H.esc(url)}"
            placeholder="${hasImages ? `Imagens prontas para upload automático` : `Cole aqui o link de Imagens ${H.genderLabel(g)}...`}"
            style="font-size:12px;font-family:monospace;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid ${isDone ? State.TIFFANY + '40' : 'rgba(255,255,255,.08)'};transition:border-color .3s" />

          <div style="margin-top:6px;font-size:11px;color:#4b5563;line-height:1.5">
            → Aplica em: <span style="color:#6b7280">${H.esc(appliesTo)}</span>
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

  function bindStep3(deps) {
    const { render, goToStep, validateAndAdvance } = deps;
    const UM = window.AutopilotModules.UploadManager;

    // Open BRK Bunker (manual organizer)
    const openBtn = document.getElementById('ap-open-link-gen');
    if (openBtn) openBtn.addEventListener('click', () => {
      window.open('https://brk-bunker.allexadriel.workers.dev/images', '_blank');
    });

    // 🚀 AUTO UPLOAD ALL
    const autoBtn = document.getElementById('ap-auto-upload-all');
    if (autoBtn) autoBtn.addEventListener('click', () => UM.uploadAllCodes());

    // BRK Link health check
    const s3Badge = document.getElementById('ap-s3-status');
    if (s3Badge) {
      fetch('/api/s3-proxy/health').then(r => r.json()).then(data => {
        if (data.online) {
          s3Badge.textContent = '🟢 BRK Link Online';
          s3Badge.style.color = State.TIFFANY;
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
    document.querySelectorAll('.ap-upload-single-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        UM.uploadSingleCode(btn.dataset.base, btn.dataset.apcGender || null);
      });
    });

    // 🗑️ CLEAR ALL LINKS
    const clearAllBtn = document.getElementById('ap-clear-all-links');
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
      if (!confirm('Tem certeza que deseja apagar TODOS os links gerados?')) return;
      State.state.imageUrls = {};
      State.saveSession();
      render();
      window.HUB.showToast('🗑️ Todos os links foram apagados', 'warning');
    });

    // 🗑️ CLEAR per-code links
    document.querySelectorAll('.ap-clear-code-links').forEach(btn => {
      btn.addEventListener('click', () => {
        const base = btn.dataset.base;
        const code = State.state.generatedCodes.find(c => c.base === base);
        if (!code) return;

        if (code._isAPC) {
          // APC: delete gender+color keys
          const codeGroup = State.getGroupById(code._groupId);
          const colors = codeGroup ? H.activeApcColors(codeGroup) : Registry.APC_COLORS;
          const apcGender = btn.dataset.apcGender; // MASC or FEM or undefined
          const genderKeys = apcGender ? [apcGender] : ['MASC', 'FEM'];
          genderKeys.forEach(gk => {
            colors.forEach(cor => {
              const urlKey = `${base}_${gk}_${cor}`;
              if (State.state.imageUrls[urlKey]) delete State.state.imageUrls[urlKey];
            });
          });
          // Also clean legacy keys
          colors.forEach(cor => {
            const legacyKey = `${base}_${cor}`;
            if (State.state.imageUrls[legacyKey]) delete State.state.imageUrls[legacyKey];
          });
        } else {
          // Normal: delete gender-based keys
          const codeGroup = State.getGroupById(code._groupId);
          const genders = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
          genders.forEach(g => {
            if (code[g] && State.state.imageUrls[code[g]]) {
              delete State.state.imageUrls[code[g]];
            }
          });
        }
        State.saveSession();
        render();
        window.HUB.showToast(`🗑️ Links de ${base} apagados`, 'warning');
      });
    });

    // Cancel upload
    const cancelBtn = document.getElementById('ap-upload-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      UM.uploadState.aborted = true;
      window.HUB.showToast('Cancelando upload...', 'warning');
    });

    // Scroll to next pending
    const scrollBtn = document.getElementById('ap-scroll-next-pending');
    if (scrollBtn) scrollBtn.addEventListener('click', () => {
      const pendingCard = document.querySelector('.ap-link-code-card:not([data-done="true"])');
      if (pendingCard) {
        pendingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pendingCard.style.boxShadow = `0 0 0 2px ${State.TIFFANY}60`;
        setTimeout(() => { pendingCard.style.boxShadow = ''; }, 2000);
      } else {
        window.HUB.showToast('Todos os códigos já foram preenchidos! 🎉', 'success');
      }
    });

    // Filter pills
    document.querySelectorAll('.ap-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        State.state.linkFilter = pill.dataset.filter;
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
    document.querySelectorAll('.ap-link-input').forEach(input => {
      input.addEventListener('input', () => {
        State.state.imageUrls[input.dataset.code] = input.value;
        State.saveSession();
      });

      input.addEventListener('paste', () => {
        setTimeout(() => {
          const codeKey = input.dataset.code;
          const gender = input.dataset.gender;
          const base = input.dataset.base;
          const apcColor = input.dataset.apcColor; // set for APC inputs
          State.state.imageUrls[codeKey] = input.value;

          input.style.borderColor = State.TIFFANY + '40';
          const card = input.closest('.ap-link-code-card');

          const code = State.state.generatedCodes.find(c => c.base === base);
          if (code) {
            let allDone = false;

            if (code._isAPC) {
              // APC: check this gender block
              const apcGender = input.dataset.apcGender || 'MASC';
              const codeGroup = State.getGroupById(code._groupId);
              const colors = codeGroup ? H.activeApcColors(codeGroup) : Registry.APC_COLORS;
              allDone = colors.every(cor => {
                const url = State.state.imageUrls[`${base}_${apcGender}_${cor}`];
                return url && url.trim();
              });
            } else {
              // Normal: check by gender
              const codeGroup = code ? State.getGroupById(code._groupId) : null;
              const gendersList = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
              allDone = gendersList.every(g => {
                if (!code[g]) return true;
                const url = State.state.imageUrls[code[g]];
                return url && url.trim();
              });
            }

            if (allDone && card) {
              card.style.borderLeftColor = (State.TIFFANY_D || '#9333ea');
              card.setAttribute('data-done', 'true');
              window.HUB.showToast(`✅ ${base} completo!`, 'success');

              setTimeout(() => {
                const nextPending = document.querySelector('.ap-link-code-card:not([data-done="true"])');
                if (nextPending) {
                  nextPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  nextPending.style.boxShadow = `0 0 0 2px ${State.TIFFANY}40`;
                  setTimeout(() => { nextPending.style.boxShadow = ''; }, 1500);
                }
              }, 300);
            } else {
              const label = apcColor ? `${apcColor}` : H.genderLabel(gender);
              window.HUB.showToast(`🔗 Link ${label} salvo para ${base}`, 'info');
            }
          }
        }, 50); // small delay to capture pasted value
      });

      // On blur: just save
      input.addEventListener('blur', () => {
        State.state.imageUrls[input.dataset.code] = input.value;
        State.saveSession();
      });
    });
  }

  window.AutopilotModules.Step3 = {
    render: renderStep3,
    renderCodeLinkCards,
    bind: bindStep3,
    bindLinkInputs
  };
})();
