(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const H = window.AutopilotModules.Helpers;
  const Registry = window.AutopilotModules.Registry;

  let uploadState = {
    isUploading: false,
    aborted: false,
    currentCode: '',
    currentGender: '',
    progress: { done: 0, total: 0, currentImg: 0, totalImgs: 0 },
  };

  async function uploadAllCodes() {
    if (uploadState.isUploading) return;

    const hasDiskPath = State.state.diskFolderPath && State.state.diskFolderPath.trim();

    if (!hasDiskPath) {
      window.HUB.showToast('❌ Configure o caminho da pasta na Etapa 2!', 'error');
      return;
    }

    // Conta total de jobs pendentes (1 job = 1 código + 1 gênero OU 1 código + 1 cor para APC)
    let totalJobs = 0;
    const pendingJobs = []; // { code, gender, genderCode, apcColor? }

    for (const code of State.state.generatedCodes) {
      const codeGroup = State.getGroupById(code._groupId);

      if (code._isAPC) {
        // APC: 1 job por GÊNERO × COR
        const colors = codeGroup ? H.activeApcColors(codeGroup) : Registry.APC_COLORS;
        const genders = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
        for (const g of genders) {
          const genderKey = g === 'masc' ? 'MASC' : 'FEM';
          for (const cor of colors) {
            const urlKey = `${code.base}_${genderKey}_${cor}`;
            const url = State.state.imageUrls[urlKey];
            if (!url || !url.trim()) {
              pendingJobs.push({ code, gender: g, genderCode: urlKey, apcColor: cor, apcGenderKey: genderKey });
              totalJobs++;
            }
          }
        }
      } else {
        // Normal: 1 job por GÊNERO
        const gendersList = codeGroup ? H.activeGenders(codeGroup) : ['masc'];
        for (const g of gendersList) {
          if (!code[g]) continue;
          const url = State.state.imageUrls[code[g]];
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
    const S3 = window.AutopilotModules.S3Uploader;

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
          joined = await S3.uploadApcColorImages(code.base, apcColor, job.apcGenderKey || 'MASC');
        } else {
          // ═══ NORMAL: Upload por GÊNERO ═══
          joined = await S3.uploadGenderImages(code.base, g);
        }

        // Salva o link
        State.state.imageUrls[genderCode] = joined;

        // Update the input field
        const input = document.querySelector(`.ap-link-input[data-code="${genderCode}"]`);
        if (input) {
          input.value = joined;
          input.style.borderColor = State.TIFFANY + '40';
        }

        // Update row status
        const row = document.querySelector(`.ap-gender-row[data-gender-code="${genderCode}"]`);
        if (row) {
          const statusEl = row.querySelector('.ap-gender-status');
          if (statusEl) {
            statusEl.textContent = '✅';
            statusEl.style.color = State.TIFFANY;
          }
          row.style.borderColor = State.TIFFANY + '30';
          row.style.background = 'rgba(127, 0, 255,0.03)';
        }

        doneJobs++;
        uploadState.progress.done = doneJobs;
        updateUploadUI();
        State.saveSession();

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
      const currentGroup = State.getGroupById(code._groupId);

      if (code._isAPC) {
        // APC: check this specific gender block
        const gk = job.apcGenderKey || 'MASC';
        const codeColors = currentGroup ? H.activeApcColors(currentGroup) : Registry.APC_COLORS;
        const blockDone = codeColors.every(c => {
          const u = State.state.imageUrls[`${code.base}_${gk}_${c}`];
          return u && u.trim();
        });
        const genderCard = document.querySelector(`.ap-link-code-card[data-base="${code.base}"][data-apc-gender="${gk}"]`);
        if (genderCard) genderCard.classList.remove('ap-uploading-card');
        if (blockDone && genderCard) {
          genderCard.style.borderLeftColor = (State.TIFFANY_D || '#9333ea');
          genderCard.setAttribute('data-done', 'true');
        }
      } else {
        // Normal: check all genders
        const codeGenders = currentGroup ? H.activeGenders(currentGroup) : ['masc'];
        const allSlotsDone = codeGenders.every(gg => {
          if (!code[gg]) return true;
          const u = State.state.imageUrls[code[gg]];
          return u && u.trim();
        });
        if (card) card.classList.remove('ap-uploading-card');
        if (allSlotsDone && card) {
          card.style.borderLeftColor = (State.TIFFANY_D || '#9333ea');
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

    if (window.render) window.render(); // Refresh to update all counters (fallback if deps.render not bound directly here)
  }

  /**
   * Faz upload de um único código
   */
  async function uploadSingleCode(baseCode, genderArg) {
    if (uploadState.isUploading) {
      window.HUB.showToast('Upload em andamento, aguarde...', 'warning');
      return;
    }

    const code = State.state.generatedCodes.find(c => c.base === baseCode);
    if (!code) return;
    const codeGroup = State.getGroupById(code._groupId);

    const hasDiskPath = State.state.diskFolderPath && State.state.diskFolderPath.trim();
    if (!hasDiskPath) {
      window.HUB.showToast(`Configure o caminho da pasta na Etapa 2.`, 'error');
      return;
    }

    let done = 0; // Function-scoped — accessed in both APC/non-APC paths and final toast
    const S3 = window.AutopilotModules.S3Uploader;

    if (code._isAPC) {
      // ═══ APC: Upload por GÊNERO × COR ═══
      const colors = codeGroup ? H.activeApcColors(codeGroup) : Registry.APC_COLORS;
      const genders = codeGroup ? H.activeGenders(codeGroup) : ['masc'];

      // Determine which gender block to upload (from button data-apc-gender)
      const clickedGender = genderArg; // passed from click handler
      const targetGenders = clickedGender ? [clickedGender === 'MASC' ? 'masc' : 'fem'] : genders;

      // Build list of pending slots: { gender, genderKey, color }
      const pendingSlots = [];
      targetGenders.forEach(g => {
        const genderKey = g === 'masc' ? 'MASC' : 'FEM';
        colors.forEach(cor => {
          const urlKey = `${baseCode}_${genderKey}_${cor}`;
          const url = State.state.imageUrls[urlKey];
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
          const joined = await S3.uploadApcColorImages(baseCode, slot.color, slot.genderKey);
          State.state.imageUrls[slot.urlKey] = joined;

          const input = document.querySelector(`.ap-link-input[data-code="${slot.urlKey}"]`);
          if (input) {
            input.value = joined;
            input.style.borderColor = State.TIFFANY + '40';
          }

          const colorRow = document.querySelector(`.ap-gender-row[data-gender-code="${slot.urlKey}"]`);
          if (colorRow) {
            const statusEl = colorRow.querySelector('.ap-gender-status');
            if (statusEl) { statusEl.textContent = '✅'; statusEl.style.color = State.TIFFANY; }
            colorRow.style.borderColor = State.TIFFANY + '30';
          }

          done++;
          uploadState.progress.done = done;
          updateUploadUI();
          State.saveSession();
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
          const u = State.state.imageUrls[`${baseCode}_${gk}_${cor}`];
          return u && u.trim();
        });
        if (allDone) {
          card.style.borderLeftColor = (State.TIFFANY_D || '#9333ea');
          card.setAttribute('data-done', 'true');
        }
      });

    } else {
      // ═══ NORMAL: Upload por GÊNERO (inalterado) ═══
      const gendersList = codeGroup ? H.activeGenders(codeGroup) : ['masc'];

      const pendingGenders = gendersList.filter(g => {
        if (!code[g]) return false;
        const url = State.state.imageUrls[code[g]];
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
          const joined = await S3.uploadGenderImages(baseCode, g);
          State.state.imageUrls[code[g]] = joined;

          const input = document.querySelector(`.ap-link-input[data-code="${code[g]}"]`);
          if (input) {
            input.value = joined;
            input.style.borderColor = State.TIFFANY + '40';
          }

          const genderRow = document.querySelector(`.ap-gender-row[data-gender-code="${code[g]}"]`);
          if (genderRow) {
            const statusEl = genderRow.querySelector('.ap-gender-status');
            if (statusEl) { statusEl.textContent = '✅'; statusEl.style.color = State.TIFFANY; }
            genderRow.style.borderColor = State.TIFFANY + '30';
          }

          done++;
          uploadState.progress.done = done;
          updateUploadUI();
        } catch (err) {
          window.HUB.showToast(`❌ Erro ${baseCode} ${H.genderLabel(g)}: ${err.message}`, 'error');
        }
      }

      if (card) card.classList.remove('ap-uploading-card');
      const allDone = gendersList.every(g => {
        if (!code[g]) return true;
        const u = State.state.imageUrls[code[g]];
        return u && u.trim();
      });
      if (allDone && card) {
        card.style.borderLeftColor = (State.TIFFANY_D || '#9333ea');
        card.setAttribute('data-done', 'true');
      }
    }

    uploadState.isUploading = false;
    showUploadProgress(false);

    if (!uploadState.aborted) {
      window.HUB.showToast(`✅ ${baseCode} — ${done} link(s) gerados!`, 'success');
    }

    if (window.render) window.render();
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
    detailEl.textContent = `📁 ${uploadState.currentCode} → ${H.genderLabel(uploadState.currentGender)} (${p.totalImgs} imagens)`;
    barEl.style.width = pct + '%';
  }

  window.AutopilotModules.UploadManager = {
    uploadState,
    uploadAllCodes,
    uploadSingleCode,
    showUploadProgress,
    updateUploadUI
  };
})();
