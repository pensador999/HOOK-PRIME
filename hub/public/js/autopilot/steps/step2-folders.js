(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const H = window.AutopilotModules.Helpers;

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
    const hasPath = State.state.diskFolderPath && State.state.diskFolderPath.trim();

    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- 📡 Network Image Scraper -->
      <div class="card" style="padding:28px;border:1px solid rgba(170, 255, 0,0.15)">
        <h3 style="margin:0 0 6px;color:${State.TIFFANY}">📡 Buscar Imagens da Rede</h3>
        <p style="margin:0 0 16px;color:#9ca3af;font-size:14px">
          Cole o caminho da pasta da rede onde estão as imagens. O sistema detecta automaticamente a estrutura 
          (<code style="color:#60a5fa">3d/</code>, <code style="color:#f472b6">MASC/FEM/INF</code>, ou soltas).
        </p>

        <div style="background:rgba(170, 255, 0,0.06);border:1px solid rgba(170, 255, 0,0.15);border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#88CC00">
          <strong>🔒 Modo seguro:</strong> Apenas leitura e cópia. Nenhum arquivo da rede será editado ou apagado.
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <input type="text" id="ap-network-path" placeholder="Ex: \\\\\\\\SERVIDOR\\\\Projetos\\\\COLECAO_FUSION ou Z:\\\\Projetos\\\\..." value="${H.esc(State.state.networkPath || '')}" style="flex:1;padding:12px 16px;border-radius:10px;border:1px solid rgba(170, 255, 0,0.15);background:rgba(0,0,0,.3);color:#e5e7eb;font-size:14px;font-family:'Cascadia Code','Fira Code',monospace">
          <button class="btn btn--primary" id="ap-network-scan" style="font-size:13px;padding:10px 18px;white-space:nowrap;background:linear-gradient(135deg,${State.TIFFANY_D},${State.TIFFANY})">🔍 Escanear Rede</button>
        </div>
        <div id="ap-network-status" style="font-size:13px;margin-top:8px;color:#6b7280;min-height:20px"></div>
      `;

      // Network scan results
      if (State.state.networkScanResult) {
        const scan = State.state.networkScanResult;
        html += `
        <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,.06);padding-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h4 style="margin:0;color:${State.TIFFANY_S}">📊 Estrutura Detectada</h4>
            <span style="font-size:12px;padding:4px 12px;border-radius:20px;background:rgba(170, 255, 0,0.15);color:${State.TIFFANY}">
              Padrão: ${scan.detectedPattern === 'gender_folders' ? 'Subpastas por Gênero' : scan.detectedPattern === '3d_folder' ? 'Pasta 3D' : scan.detectedPattern === 'loose_images' ? 'Imagens Soltas' : scan.detectedPattern}
            </span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
            ${H.renderStatCard('Pastas', scan.summary.totalFolders, '📁')}
            ${H.renderStatCard('Imagens', scan.summary.totalImages, '🖼️')}
            ${H.renderStatCard('Padrão', Object.keys(scan.summary.patterns).length, '🔍', '#3b82f6')}
          </div>

          <!-- Folder selection list -->
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <label style="font-size:13px;color:#9ca3af">Selecione as pastas para copiar:</label>
              <label style="font-size:12px;cursor:pointer;color:${State.TIFFANY}">
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
                <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.03);cursor:pointer;transition:background .2s" onmouseover="this.style.background='rgba(170, 255, 0,.08)'" onmouseout="this.style.background='rgba(255,255,255,.03)'">
                  <input type="checkbox" class="network-folder-check" value="${H.esc(f.name)}" checked style="accent-color:${State.TIFFANY}">
                  <span style="color:#e5e7eb;font-size:13px;font-family:monospace;flex:1">📁 ${H.esc(f.name)}</span>
                  <span style="display:flex;gap:6px">${badges}</span>
                  <span style="font-size:11px;color:#6b7280">${f.totalImages} imgs</span>
                </label>`;
              }).join('')}
            </div>
          </div>

          <!-- Local destination path -->
          <div style="margin-bottom:16px">
            <label class="form-label" style="font-size:13px;color:#9ca3af">📁 Pasta Local de Destino</label>
            <input type="text" id="ap-local-dest-path" placeholder="Ex: C:\\\\Users\\\\lucas\\\\Desktop\\\\TRABALHO" value="${H.esc(State.state.localWorkingPath || '')}" style="width:100%;padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);color:#e5e7eb;font-size:14px;font-family:'Cascadia Code','Fira Code',monospace;box-sizing:border-box">
          </div>

          <!-- Copy button -->
          <button class="btn btn--primary" id="ap-network-copy" style="width:100%;padding:14px;font-size:15px;font-weight:600;background:linear-gradient(135deg,${State.TIFFANY_D},${State.TIFFANY})">
            📋 Copiar Imagens para Pasta Local
          </button>

          <!-- Progress area -->
          <div id="ap-network-progress" style="margin-top:16px;display:none">
            <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
              <span id="ap-network-progress-label" style="font-size:13px;color:#e5e7eb">Copiando...</span>
              <span id="ap-network-progress-pct" style="font-size:13px;color:${State.TIFFANY};font-weight:600">0%</span>
            </div>
            <div style="height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">
              <div id="ap-network-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,${State.TIFFANY_D},${State.TIFFANY});border-radius:4px;transition:width .3s ease"></div>
            </div>
            <div id="ap-network-progress-log" style="margin-top:12px;max-height:200px;overflow-y:auto;font-size:12px;font-family:monospace;color:#9ca3af;background:rgba(0,0,0,.2);padding:12px;border-radius:8px;line-height:1.8"></div>
          </div>
        </div>`;
      }

      // Network copy complete message
      if (State.state.networkCopyResult) {
        const result = State.state.networkCopyResult;
        html += `
        <div style="margin-top:16px;padding:14px 18px;border-radius:10px;background:rgba(170, 255, 0,0.1);border:1px solid rgba(170, 255, 0,0.2)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:18px">✅</span>
            <strong style="color:${State.TIFFANY}">Cópia concluída!</strong>
          </div>
          <div style="font-size:13px;color:#9ca3af">
            ${result.totalCopied} imagens copiadas para <code style="color:${State.TIFFANY_S}">${H.esc(result.localPath)}</code>
          </div>
        </div>`;
      }

      html += `</div>`; // Close network card
      html += `

      <!-- Caminho da Pasta -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 6px;color:${State.TIFFANY}">📁 Caminho das Imagens</h3>
        <p style="margin:0 0 16px;color:#9ca3af;font-size:14px">
          Informe o <strong>caminho da pasta raiz</strong> que contém as pastas de cada código.
          Cada código deve ter subpastas <code style="color:#60a5fa">MASC</code>, <code style="color:#f472b6">FEM</code> e/ou <code style="color:#fbbf24">INF</code> com as imagens dentro.
        </p>

        <div style="background:rgba(170, 255, 0,0.06);border:1px solid rgba(170, 255, 0,0.15);border-radius:10px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#88CC00">
          <strong>📂 Estrutura esperada:</strong> PastaRaiz → C02576 → MASC / FEM / INF → imagens.jpg
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
          <input type="text" id="ap-disk-folder-path" placeholder="Ex: C:\\Users\\lucas\\Desktop\\COLECTION CAMUFLADO\\FUSION" value="${State.state.diskFolderPath || ''}" style="flex:1;padding:12px 16px;border-radius:10px;border:1px solid ${hasPath ? State.TIFFANY + '40' : 'rgba(255,255,255,.1)'};background:rgba(0,0,0,.3);color:#e5e7eb;font-size:14px;font-family:'Cascadia Code','Fira Code',monospace">
          <button class="btn btn--primary" id="ap-test-disk-path" style="font-size:13px;padding:10px 18px;white-space:nowrap;background:linear-gradient(135deg,${State.TIFFANY_D},${State.TIFFANY})">🔍 Verificar Pasta</button>
        </div>
        <div id="ap-disk-path-status" style="font-size:13px;margin-top:8px;color:#6b7280;min-height:20px">${hasPath ? '✅ Caminho salvo — clique em Verificar para validar' : ''}</div>
      </div>`;

    // Scan results (if available)
    if (State.state.diskScanResult) {
      const scan = State.state.diskScanResult;
      html += `
      <div class="card" style="padding:28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h3 style="margin:0;color:${State.TIFFANY}">📊 Pastas Encontradas</h3>
          <button class="btn btn--secondary" id="ap-clear-scan" style="font-size:12px">Limpar</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          ${H.renderStatCard('Códigos', scan.codes || 0, '📁')}
          ${H.renderStatCard('Imagens', scan.images || 0, '🖼️')}
          ${H.renderStatCard('Pastas', scan.folderNames ? scan.folderNames.length : 0, '📂', '#3b82f6')}
        </div>
        ${scan.folderNames && scan.folderNames.length > 0 ? `
        <div style="max-height:200px;overflow-y:auto;font-size:12px;color:#9ca3af;font-family:monospace;background:rgba(0,0,0,.2);padding:12px;border-radius:8px;line-height:1.8">
          ${scan.folderNames.map(name => `📁 <span style="color:#e5e7eb">${H.esc(name)}</span>`).join('<br>')}
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
              Renomeia automaticamente as imagens para o padrão <code style="color:#88CC00">01MASC.jpg</code>, <code style="color:#f472b6">02FEM.jpg</code>, etc.
            </div>
          </div>
          <label style="position:relative;display:inline-flex;align-items:center;cursor:pointer">
            <input type="checkbox" id="ap-auto-rename" ${State.state.autoRename !== false ? 'checked' : ''} style="width:40px;height:22px;appearance:none;background:${State.state.autoRename !== false ? State.TIFFANY : '#374151'};border-radius:11px;cursor:pointer;transition:background .2s" />
            <span style="position:absolute;left:${State.state.autoRename !== false ? '20px' : '2px'};top:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:left .2s;pointer-events:none"></span>
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

  // renderStatCard — provided by H (helpers.js), no local override needed

  function bindStep2(deps) {
    const { render, goToStep, validateAndAdvance } = deps;
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
        State.state.networkPath = pathVal;
        State.saveSession();
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
          State.state.networkScanResult = data;
          State.saveSession();
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
        State.state.localWorkingPath = localDest;

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
              networkPath: State.state.networkPath,
              localBasePath: localDest,
              collectionName: State.state.networkScanResult?.rootFolderName || '',
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
                    State.state.networkCopyResult = data;
                    // Auto-fill disk folder path
                    State.state.diskFolderPath = data.localPath;
                    State.saveSession();
                    
                    if (progressBar) progressBar.style.width = '100%';
                    if (progressPct) progressPct.textContent = '100%';
                    if (progressLabel) progressLabel.textContent = `✅ Concluído! ${data.totalCopied} imagens copiadas.`;
                    if (progressLog) progressLog.innerHTML += `<br><strong style="color:${State.TIFFANY}">🎉 Cópia concluída! Pasta: ${data.localPath}</strong><br>`;
                    
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
                        State.state.diskScanResult = {
                          codes: scanData.folders.length,
                          images: scanData.totalImages || 0,
                          folderNames: scanData.folders.map(f => typeof f === 'string' ? f : f.name),
                        };
                        if (State.state.diskScanResult && State.state.diskScanResult.folderNames) {
                          State.state.diskScanResult.folderNames.forEach(name => {
                            // Extrair código base e nome da estampa (ex: 'C02576 - TUCUNARE' → key='C02576', val='Tucunare')
                            const match = name.match(/^([A-Za-z]+\d+)\s*[-_]?\s*(.*)$/);
                            if (match && match[2].trim()) {
                              const baseCode = match[1].toUpperCase();
                              const suggestion = match[2].replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                              if (!State.state.estampaSuggestions[baseCode]) State.state.estampaSuggestions[baseCode] = suggestion;
                            } else {
                              // Pasta é só o código (ex: 'C02576') — sem sugestão
                              const codeOnly = name.match(/^([A-Za-z]+\d+)$/);
                              if (!codeOnly) {
                                const clean = name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                                if (!State.state.estampaSuggestions[name]) State.state.estampaSuggestions[name] = clean;
                              }
                            }
                          });
                        }
                        State.saveSession();
                        if (progressLog) progressLog.innerHTML += `📊 Auto-scan: <strong style="color:${State.TIFFANY}">${scanData.folders.length}</strong> códigos, <strong style="color:${State.TIFFANY}">${scanData.totalImages}</strong> imagens detectadas<br>`;
                        // Re-render to show updated stats cards
                        render();

                        // ✅ Auto-avançar para Etapa 3 (Links) após cópia + scan
                        State.state.completedSteps.add(2);
                        State.saveSession();
                        if (progressLog) progressLog.innerHTML += `<br><strong style="color:${State.TIFFANY}">🚀 Avançando para Etapa 3 — Links de Imagens...</strong><br>`;
                        setTimeout(() => {
                          validateAndAdvance(2);
                        }, 1500);
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
        State.state.diskFolderPath = diskInput.value.trim();
        State.saveSession();
      });
      diskInput.addEventListener('blur', () => {
        State.state.diskFolderPath = diskInput.value.trim();
        State.saveSession();
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
      State.state.diskFolderPath = pathVal;
      State.saveSession();

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
          State.state.diskScanResult = null;
          render();
          return;
        }

        const codes = (data.folders || []).length;
        const images = data.totalImages || 0;

        State.state.diskScanResult = {
          codes,
          images,
          folderNames: (data.folders || []).map(f => typeof f === 'string' ? f : f.name),
        };
        if (State.state.diskScanResult && State.state.diskScanResult.folderNames) {
          State.state.diskScanResult.folderNames.forEach(name => {
            const match = name.match(/^([A-Za-z]+\d+)\s*[-_]?\s*(.*)$/);
            if (match && match[2].trim()) {
              const baseCode = match[1].toUpperCase();
              const suggestion = match[2].replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
              if (!State.state.estampaSuggestions[baseCode]) State.state.estampaSuggestions[baseCode] = suggestion;
            } else {
              const codeOnly = name.match(/^([A-Za-z]+\d+)$/);
              if (!codeOnly) {
                const clean = name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                if (!State.state.estampaSuggestions[name]) State.state.estampaSuggestions[name] = clean;
              }
            }
          });
        }

        if (statusEl) {
          statusEl.innerHTML = `✅ <strong>${codes}</strong> código(s) encontrado(s) com <strong>${images}</strong> imagem(ns)`;
          statusEl.style.color = State.TIFFANY;
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
        State.state.diskScanResult = null;
        State.state.diskFolderPath = '';
        State.saveSession();
        render();
      });
    }

    // Auto-rename toggle
    const renameToggle = document.getElementById('ap-auto-rename');
    if (renameToggle) {
      renameToggle.addEventListener('change', () => {
        State.state.autoRename = renameToggle.checked;
        renameToggle.style.background = renameToggle.checked ? State.TIFFANY : '#374151';
        const thumb = renameToggle.parentElement.querySelector('span');
        if (thumb) thumb.style.left = renameToggle.checked ? '20px' : '2px';
        State.saveSession();
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

  window.AutopilotModules.Step2 = { render: renderStep2, bind: bindStep2 };
})();