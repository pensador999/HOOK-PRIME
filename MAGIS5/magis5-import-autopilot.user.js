// ==UserScript==
// @name         Magis5 Import Autopilot — BRK
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Automação VISUAL de importação de anúncios Shopify → Magis5 em lote
// @match        https://app.magis5.com.br/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    if (!window.location.href.includes('magis5')) return;

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  CONFIGURAÇÃO                                                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    const CFG = {
        delayAfterModal: 1200,      // Tempo para o modal abrir
        delayAfterSearch: 5000,     // Tempo para carregar variantes após "Sim"
        delayBetweenItems: 2500,    // Pausa entre itens
        delayAfterImport: 3500,     // Pausa após importar
        delayStep: 800,             // Pausa entre cada micro-ação (visual)
        pollInterval: 500,          // Polling para variantes
        pollTimeout: 20000,         // Timeout máximo para variantes
    };

    const CHANNELS = {
        'BRK FISHING': 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
        'BRK AGRO':    'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
        'BRK MOTORS':  'shopify-7495282216c04726834a39582e5369dd',
    };

    const norm = s => (s || '').replace(/\r/g, '').trim();
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let _running = false;
    let _paused = false;
    let _shouldStop = false;

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  FEEDBACK VISUAL                                                    ║
    // ║  Highlight de elementos + toast flutuante + step indicator          ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /** Cria a barra de status flutuante no topo da tela */
    function createVisualBar() {
        let bar = document.getElementById('brk-visual-bar');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'brk-visual-bar';
        bar.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 1000000;
            background: linear-gradient(90deg, #0f172a, #1e1b4b);
            border-bottom: 2px solid #7F00FF;
            padding: 8px 20px; display: flex; align-items: center; gap: 16px;
            font: 13px/1.4 system-ui, sans-serif; color: #e2e8f0;
            box-shadow: 0 4px 20px rgba(127,0,255,0.3);
            transition: opacity 0.3s;
        `;
        bar.innerHTML = `
            <span style="font-weight:700;color:#a78bfa">🚀 AUTOPILOT</span>
            <span id="brk-vb-step" style="color:#10b981;font-weight:600">Preparando...</span>
            <span style="flex:1"></span>
            <span id="brk-vb-progress" style="color:#94a3b8">0/0</span>
            <span id="brk-vb-id" style="color:#64748b;font-family:monospace;font-size:12px"></span>
        `;
        document.body.appendChild(bar);
        return bar;
    }

    function updateVisualBar(step, progress, id) {
        const bar = document.getElementById('brk-visual-bar');
        if (!bar) return;
        const stepEl = bar.querySelector('#brk-vb-step');
        const progEl = bar.querySelector('#brk-vb-progress');
        const idEl = bar.querySelector('#brk-vb-id');
        if (stepEl) stepEl.textContent = step;
        if (progEl) progEl.textContent = progress;
        if (idEl) idEl.textContent = id ? `ID: ${id}` : '';
    }

    function removeVisualBar() {
        document.getElementById('brk-visual-bar')?.remove();
    }

    /** Destaca um elemento na tela com borda brilhante */
    function highlight(el, color = '#7F00FF') {
        if (!el) return;
        el.style.outline = `3px solid ${color}`;
        el.style.outlineOffset = '2px';
        el.style.boxShadow = `0 0 15px ${color}80`;
        el.style.transition = 'outline 0.3s, box-shadow 0.3s';
        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /** Remove highlight de um elemento */
    function unhighlight(el) {
        if (!el) return;
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.boxShadow = '';
    }

    /** Mostra um toast flutuante para a ação atual */
    function showAction(text, emoji = '⚡') {
        let toast = document.getElementById('brk-action-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'brk-action-toast';
            toast.style.cssText = `
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                z-index: 1000001; background: #1e1b4b; color: #e2e8f0;
                padding: 10px 24px; border-radius: 10px; font: 14px/1.4 system-ui, sans-serif;
                border: 1px solid #7F00FF60; box-shadow: 0 8px 30px rgba(127,0,255,0.35);
                transition: opacity 0.3s, transform 0.3s;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = `${emoji} ${text}`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }

    function hideAction() {
        const toast = document.getElementById('brk-action-toast');
        if (toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
        }
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  LOGGING                                                            ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function log(msg, type = 'info') {
        const el = document.getElementById('brk-import-log');
        if (!el) return;
        const ts = new Date().toLocaleTimeString('pt-BR');
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : '📋';
        el.textContent += (el.textContent ? '\n' : '') + `[${ts}] ${prefix} ${msg}`;
        el.scrollTop = el.scrollHeight;
    }

    function status(text) {
        const el = document.getElementById('brk-import-status');
        if (el) el.textContent = text;
    }

    function updateProgress(current, total) {
        const bar = document.getElementById('brk-import-progress-bar');
        const text = document.getElementById('brk-import-progress-text');
        if (bar) bar.style.width = total > 0 ? `${Math.round((current / total) * 100)}%` : '0%';
        if (text) text.textContent = `${current}/${total}`;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INTERAÇÃO COM A PÁGINA MAGIS5 (com feedback visual)               ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function visualOpenModal() {
        showAction('Abrindo modal "Baixar anúncio"...', '📂');
        const btn = document.getElementById('generatePurchase');
        if (!btn) throw new Error('Botão "Baixar anúncio específico" não encontrado');
        highlight(btn, '#10b981');
        await sleep(CFG.delayStep);
        btn.click();
        unhighlight(btn);
        await sleep(CFG.delayAfterModal);
    }

    async function visualSelectChannel(channelValue, channelName) {
        showAction(`Selecionando canal: ${channelName}`, '🏪');
        const select = document.getElementById('channel');
        if (!select) throw new Error('Select de canal não encontrado');
        highlight(select, '#3b82f6');
        await sleep(CFG.delayStep);
        select.value = channelValue;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        unhighlight(select);
        await sleep(300);
    }

    async function visualFillId(shopifyId) {
        showAction(`Colando ID: ${shopifyId}`, '🔗');
        const input = document.getElementById('channelId');
        if (!input) throw new Error('Input channelId não encontrado');
        highlight(input, '#f59e0b');
        await sleep(CFG.delayStep);

        input.value = '';
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, shopifyId);
        else input.value = shopifyId;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        unhighlight(input);
        await sleep(300);
    }

    async function visualClickSim() {
        showAction('Confirmando pesquisa...', '✅');

        // Tenta a função direta
        if (typeof window.createFindProductOnChannel === 'function') {
            window.createFindProductOnChannel();
            return;
        }
        // Fallback: procura botão "Sim"
        const btns = document.querySelectorAll('.modal button, .modal.show button');
        for (const btn of btns) {
            if (btn.textContent.trim() === 'Sim') {
                highlight(btn, '#10b981');
                await sleep(400);
                btn.click();
                unhighlight(btn);
                return;
            }
        }
        throw new Error('Botão "Sim" não encontrado');
    }

    async function waitForVariants() {
        showAction('Aguardando variantes carregarem...', '⏳');
        const start = Date.now();
        while (Date.now() - start < CFG.pollTimeout) {
            const inputs = getSkuInputs();
            if (inputs.length > 0) {
                showAction(`${inputs.length} variantes carregadas!`, '📦');
                // Highlight the first and last variant
                if (inputs[0]) highlight(inputs[0], '#10b981');
                if (inputs.length > 1) highlight(inputs[inputs.length - 1], '#10b981');
                await sleep(CFG.delayStep);
                inputs.forEach(unhighlight);
                return inputs;
            }
            await sleep(CFG.pollInterval);
        }
        throw new Error(`Timeout (${CFG.pollTimeout / 1000}s) aguardando variantes`);
    }

    function getSkuInputs() {
        return [...document.querySelectorAll('input')].filter(el => {
            const prop = (el.id || el.name || '').toLowerCase();
            return prop.startsWith('sku') && norm(el.value) !== '';
        });
    }

    function getRegistroContainer(input) {
        let el = input;
        while (el && el !== document.body) {
            if (el.innerText && el.innerText.includes('Vendido de forma diversa')) return el;
            el = el.parentElement;
        }
        return input.closest('tr, .row, .card, .panel, div') || input.parentElement;
    }

    function setVendidoDiversa(registroEl) {
        if (!registroEl) return false;
        let select = registroEl.querySelector('select[name="isProductOnChannelLocked"]');
        if (!select) {
            const selects = registroEl.querySelectorAll('select');
            if (selects.length > 0) select = selects[selects.length - 1];
        }
        if (!select) return false;
        const opt = [...select.options].find(o => norm(o.textContent).toLowerCase() === 'sim');
        if (!opt) return false;
        select.value = opt.value;
        opt.selected = true;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        highlight(select, '#10b981');
        return true;
    }

    function setInputValue(input, valor) {
        input.focus();
        input.select?.();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, valor); else input.value = valor;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('focusout', { bubbles: true }));
        input.blur();
        const idMatch = input.id.match(/sku(\d+)/);
        if (idMatch && typeof window.updateExtraFields === 'function') {
            try { window.updateExtraFields(parseInt(idMatch[1])); } catch (_) { }
        }
        highlight(input, '#10b981');
    }

    async function visualSelectAll() {
        showAction('Selecionando todos...', '☑️');
        const selectAllCb = document.getElementById('selectAll');
        if (selectAllCb) {
            highlight(selectAllCb, '#7F00FF');
            await sleep(400);
            selectAllCb.checked = true;
            selectAllCb.dispatchEvent(new Event('change', { bubbles: true }));
            selectAllCb.click();
            unhighlight(selectAllCb);
        } else {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            });
        }
        await sleep(300);
    }

    async function visualClickImport() {
        showAction('Importando anúncio...', '📥');
        const importBtn = document.getElementById('import');
        if (importBtn) {
            highlight(importBtn, '#ef4444');
            await sleep(400);
            importBtn.click();
            unhighlight(importBtn);
        } else {
            const links = document.querySelectorAll('.navi-link, a[data-toggle="modal"]');
            for (const link of links) {
                if (link.textContent.trim() === 'Importar') {
                    highlight(link, '#ef4444');
                    await sleep(400);
                    link.click();
                    unhighlight(link);
                    break;
                }
            }
        }

        await sleep(800);
        // Confirmar no modal de alerta
        const modal = document.getElementById('alertModal');
        if (modal) {
            const confirmBtns = modal.querySelectorAll('button');
            for (const btn of confirmBtns) {
                const text = btn.textContent.trim().toLowerCase();
                if (text === 'sim' || text === 'confirmar' || text === 'ok') {
                    highlight(btn, '#10b981');
                    await sleep(400);
                    btn.click();
                    unhighlight(btn);
                    break;
                }
            }
        }
    }

    function closeModals() {
        document.querySelectorAll('.modal.show .close, .modal.in .close, button[data-dismiss="modal"]').forEach(btn => {
            try { btn.click(); } catch (_) { }
        });
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  PARSER                                                             ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function parseInput(text) {
        const lines = text.split('\n').map(norm).filter(Boolean);
        const items = [];
        for (const line of lines) {
            const parts = line.split(/\t+/);
            const shopifyId = norm(parts[0]);
            if (!shopifyId) continue;
            const skuPairs = [];
            for (let i = 1; i < parts.length; i += 2) {
                const skuAtual = norm(parts[i]);
                const novoSku = norm(parts[i + 1] || '');
                if (skuAtual && novoSku) skuPairs.push({ skuAtual, novoSku });
            }
            items.push({ shopifyId, skuPairs });
        }
        return items;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  LOOP PRINCIPAL                                                     ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function processImportQueue() {
        if (_running) { log('Já está em execução!', 'warn'); return; }
        _running = true;
        _shouldStop = false;
        _paused = false;

        const inputText = document.getElementById('brk-import-list')?.value || '';
        const items = parseInput(inputText);
        if (items.length === 0) {
            log('Nenhum ID encontrado. Cole os IDs na lista.', 'warn');
            _running = false;
            return;
        }

        const channelSelect = document.getElementById('brk-import-channel');
        const channelValue = channelSelect?.value;
        const channelName = channelSelect?.options[channelSelect?.selectedIndex]?.text || '';
        if (!channelValue) {
            log('Selecione um canal de venda!', 'warn');
            _running = false;
            return;
        }

        const isProducao = document.getElementById('brk-import-producao')?.checked ?? true;

        // Criar barra visual no topo
        createVisualBar();

        log(`━━━ IMPORTAÇÃO VISUAL INICIADA ━━━`);
        log(`Canal: ${channelName}`);
        log(`IDs: ${items.length} anúncio(s)`);
        log(`Produção: ${isProducao ? 'SIM' : 'NÃO'}`);

        let sucesso = 0;
        let falhas = 0;
        updateBtnState(true);

        for (let i = 0; i < items.length; i++) {
            if (_shouldStop) {
                log('⏹ Interrompido pelo usuário');
                break;
            }
            while (_paused) {
                updateVisualBar('⏸ PAUSADO', `${i}/${items.length}`, items[i].shopifyId);
                await sleep(500);
                if (_shouldStop) break;
            }

            const item = items[i];
            const label = `[${i + 1}/${items.length}]`;
            updateProgress(i, items.length);
            updateVisualBar(`Processando ${label}`, `${i + 1}/${items.length}`, item.shopifyId);
            status(`${label} ID: ${item.shopifyId}`);

            try {
                // ── Passo 1: Fechar modais anteriores
                closeModals();
                await sleep(500);

                // ── Passo 2: Abrir modal
                updateVisualBar(`${label} Abrindo modal...`, `${i + 1}/${items.length}`, item.shopifyId);
                log(`${label} Abrindo modal para ID: ${item.shopifyId}`);
                await visualOpenModal();

                // ── Passo 3: Selecionar canal
                updateVisualBar(`${label} Selecionando canal...`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualSelectChannel(channelValue, channelName);

                // ── Passo 4: Colar ID
                updateVisualBar(`${label} Colando ID...`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualFillId(item.shopifyId);

                // ── Passo 5: Clicar Sim
                updateVisualBar(`${label} Pesquisando...`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualClickSim();

                // ── Passo 6: Aguardar variantes
                updateVisualBar(`${label} Aguardando variantes...`, `${i + 1}/${items.length}`, item.shopifyId);
                log(`${label} Aguardando variantes carregarem...`);
                await sleep(CFG.delayAfterSearch);
                const skuInputs = await waitForVariants();
                log(`${label} ${skuInputs.length} variantes carregadas`);

                // ── Passo 7: Aplicar SKUs (se fornecidos)
                if (item.skuPairs.length > 0) {
                    updateVisualBar(`${label} Aplicando SKUs...`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('Aplicando SKUs Sankhya...', '🔄');
                    const inputMap = new Map();
                    skuInputs.forEach(inp => inputMap.set(norm(inp.value).toUpperCase(), inp));
                    let applied = 0;
                    for (const pair of item.skuPairs) {
                        const input = inputMap.get(pair.skuAtual.toUpperCase());
                        if (input) { setInputValue(input, pair.novoSku); applied++; await sleep(200); }
                        else log(`  SKU "${pair.skuAtual}" não encontrado na tela`, 'warn');
                    }
                    log(`${label} ${applied}/${item.skuPairs.length} SKUs aplicados`);
                }

                // ── Passo 8: Vendido de forma diversa
                if (isProducao) {
                    updateVisualBar(`${label} Forma diversa → Sim...`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('Vendido de forma diversa → Sim', '🔀');
                    let count = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp))) count++;
                    }
                    await sleep(CFG.delayStep);
                    log(`${label} Diversa=Sim: ${count} variantes`);
                }

                // ── Passo 9: Selecionar todos
                updateVisualBar(`${label} Selecionando todos...`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualSelectAll();

                // ── Passo 10: Importar
                updateVisualBar(`${label} Importando!`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualClickImport();

                sucesso++;
                showAction(`✅ ID ${item.shopifyId} importado com sucesso!`, '🎉');
                log(`${label} ✅ Importado com sucesso!`, 'success');

                if (i < items.length - 1) {
                    updateVisualBar(`Pausa antes do próximo...`, `${i + 1}/${items.length}`, '');
                    await sleep(CFG.delayAfterImport);
                }

            } catch (err) {
                falhas++;
                showAction(`Erro: ${err.message}`, '❌');
                log(`${label} Erro: ${err.message}`, 'error');
                closeModals();
                await sleep(1500);
            }
        }

        updateProgress(items.length, items.length);
        hideAction();
        removeVisualBar();
        status('Finalizado!');
        log(`━━━ IMPORTAÇÃO FINALIZADA ━━━`);
        log(`✅ Sucesso: ${sucesso} | ❌ Falhas: ${falhas} | Total: ${items.length}`);

        _running = false;
        updateBtnState(false);
    }

    function updateBtnState(isRunning) {
        const startBtn = document.getElementById('brk-import-start');
        const pauseBtn = document.getElementById('brk-import-pause');
        const stopBtn = document.getElementById('brk-import-stop');
        if (startBtn) { startBtn.disabled = isRunning; startBtn.style.opacity = isRunning ? '0.5' : '1'; }
        if (pauseBtn) { pauseBtn.disabled = !isRunning; pauseBtn.style.opacity = !isRunning ? '0.5' : '1'; }
        if (stopBtn) { stopBtn.disabled = !isRunning; stopBtn.style.opacity = !isRunning ? '0.5' : '1'; }
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  UI — PAINEL                                                        ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function buildLauncher() {
        if (document.getElementById('brk-import-launcher')) return;
        const btn = document.createElement('button');
        btn.id = 'brk-import-launcher';
        btn.innerText = '🚀 Magis5 Import';
        btn.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 999998;
            background: linear-gradient(135deg, #7F00FF, #5B21B6);
            color: #fff; border: none; padding: 12px 18px; border-radius: 10px;
            font-weight: bold; cursor: pointer; font-size: 14px;
            box-shadow: 0 4px 15px rgba(127,0,255,0.4);
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = '0 6px 20px rgba(127,0,255,0.6)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 15px rgba(127,0,255,0.4)'; };
        btn.onclick = () => {
            const existing = document.getElementById('brk-import-panel');
            if (existing) { existing.remove(); return; }
            buildPanel();
        };
        document.body.appendChild(btn);
    }

    function buildPanel() {
        const box = document.createElement('div');
        box.id = 'brk-import-panel';
        box.style.cssText = `
            position: fixed; top: 16px; right: 16px; z-index: 999999;
            background: #0f172a; color: #e2e8f0;
            width: 480px; max-height: 88vh; overflow: auto;
            border-radius: 16px; border: 1px solid #7F00FF40;
            box-shadow: 0 10px 40px rgba(127,0,255,0.25), 0 0 0 1px rgba(127,0,255,0.1);
            font: 13px/1.5 'Inter', system-ui, sans-serif;
        `;

        const channelOptions = Object.entries(CHANNELS).map(([name, val]) =>
            `<option value="${val}">${name}</option>`
        ).join('');

        box.innerHTML = `
            <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#0f172a,#1e1b4b);border-radius:16px 16px 0 0">
                <div>
                    <div style="font-weight:700;font-size:15px;color:#a78bfa">🚀 Magis5 Import Autopilot v2</div>
                    <div style="font-size:11px;color:#64748b">Importação visual em lote — Shopify → Magis5</div>
                </div>
                <button id="brk-import-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px">✕</button>
            </div>
            <div style="padding:14px 16px;display:grid;gap:12px">
                <div id="brk-import-status" style="color:#10b981;font-weight:600;font-size:13px">Pronto para iniciar!</div>
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden">
                        <div id="brk-import-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#7F00FF,#a855f7);transition:width .3s"></div>
                    </div>
                    <span id="brk-import-progress-text" style="font-size:12px;color:#94a3b8;min-width:40px">0/0</span>
                </div>

                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Canal de Venda</label>
                    <select id="brk-import-channel" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:13px">
                        ${channelOptions}
                    </select>
                </div>

                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#cbd5e1">
                    <input type="checkbox" id="brk-import-producao" checked style="accent-color:#7F00FF;width:16px;height:16px">
                    <span>Produto de <strong style="color:#a78bfa">produção</strong> (Diversa = Sim)</span>
                </label>

                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">IDs dos Anúncios (cole do Shopify Extractor)</label>
                    <textarea id="brk-import-list" rows="5" placeholder="Cole aqui os IDs extraídos da Shopify (um por linha)&#10;&#10;6358879166530&#10;7520209109058&#10;8364053397570" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:monospace;font-size:12px;resize:vertical"></textarea>
                </div>

                <div style="display:flex;gap:8px">
                    <button id="brk-import-start" style="background:linear-gradient(135deg,#7F00FF,#5B21B6);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:13px;flex:1;transition:opacity .2s">▶ Iniciar Importação</button>
                    <button id="brk-import-pause" disabled style="background:#334155;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;font-size:13px;opacity:0.5;transition:opacity .2s">⏸</button>
                    <button id="brk-import-stop" disabled style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:10px 12px;font-weight:700;cursor:pointer;font-size:13px;opacity:0.5;transition:opacity .2s">⏹</button>
                </div>

                <div style="background:#0b122080;border-radius:8px;padding:10px;border:1px solid #1e293b">
                    <div style="font-size:11px;color:#64748b;margin-bottom:6px">💡 O que vai acontecer quando iniciar:</div>
                    <div style="font-size:11px;color:#94a3b8;line-height:1.7">
                        1. Barra violeta aparece no topo da tela<br>
                        2. Cada elemento clicado fica <span style="color:#10b981;font-weight:600">destacado em verde</span><br>
                        3. Toast no centro mostra a ação atual<br>
                        4. Você assiste o modal abrindo, canal sendo selecionado, ID colado<br>
                        5. Variantes carregam e são destacadas<br>
                        6. "Selecionar todos" + "Importar" executam automaticamente
                    </div>
                </div>

                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Terminal</label>
                        <button id="brk-import-clear-log" style="background:transparent;border:1px solid #334155;color:#64748b;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px">Limpar</button>
                    </div>
                    <div id="brk-import-log" style="background:#020617;border-radius:10px;padding:10px;max-height:20vh;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;color:#94a3b8;border:1px solid #1e293b"></div>
                </div>

                <div style="font-size:10px;color:#475569;text-align:center;padding-top:4px;border-top:1px solid #1e293b">
                    HUB Hook Prime v4.0 · Magis5 Import Autopilot v2 · Visual Mode
                </div>
            </div>
        `;

        document.body.appendChild(box);

        box.querySelector('#brk-import-close').onclick = () => box.remove();
        box.querySelector('#brk-import-start').onclick = processImportQueue;
        box.querySelector('#brk-import-pause').onclick = () => {
            _paused = !_paused;
            const btn = box.querySelector('#brk-import-pause');
            btn.textContent = _paused ? '▶' : '⏸';
            btn.style.background = _paused ? '#059669' : '#334155';
            log(_paused ? '⏸ Pausado — clique ▶ para continuar' : '▶ Retomando...', 'warn');
        };
        box.querySelector('#brk-import-stop').onclick = () => {
            _shouldStop = true;
            log('⏹ Parando após item atual...', 'warn');
        };
        box.querySelector('#brk-import-clear-log').onclick = () => {
            document.getElementById('brk-import-log').textContent = '';
        };

        log('Painel aberto. Cole os IDs do Shopify Extractor e clique Iniciar.', 'info');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INICIALIZAÇÃO                                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    setTimeout(buildLauncher, 2000);

})();
