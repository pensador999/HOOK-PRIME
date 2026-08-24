// ==UserScript==
// @name         Magis5 Import Autopilot — BRK
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automação de importação de anúncios Shopify → Magis5 em lote
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
        delayAfterSearch: 4000,     // Tempo para a Magis5 carregar os tamanhos após "Sim"
        delayBetweenItems: 2000,    // Pausa entre itens
        delayAfterImport: 3000,     // Pausa após clicar "Importar"
        pollInterval: 500,          // Intervalo de polling para MutationObserver fallback
        pollTimeout: 15000,         // Timeout máximo para aguardar carregamento
        maxRetries: 2,              // Tentativas por item
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
    // ║  INTERAÇÃO COM A PÁGINA MAGIS5                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /** Abre o modal "Baixar anúncio específico" */
    function openImportModal() {
        const btn = document.getElementById('generatePurchase');
        if (!btn) throw new Error('Botão "Baixar anúncio específico" não encontrado');
        btn.click();
        return true;
    }

    /** Seleciona o canal de venda no modal */
    function selectChannel(channelValue) {
        const select = document.getElementById('channel');
        if (!select) throw new Error('Select de canal não encontrado');
        select.value = channelValue;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /** Preenche o ID do canal de venda no modal */
    function fillChannelId(shopifyId) {
        const input = document.getElementById('channelId');
        if (!input) throw new Error('Input channelId não encontrado');
        input.value = '';
        input.focus();

        // Use property descriptor to trigger framework reactivity
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, shopifyId);
        else input.value = shopifyId;

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    /** Clica em "Sim" no modal (chama createFindProductOnChannel()) */
    function clickConfirm() {
        // Tenta chamar a função diretamente (mais confiável)
        if (typeof window.createFindProductOnChannel === 'function') {
            window.createFindProductOnChannel();
            return true;
        }
        // Fallback: clica no botão
        const btns = document.querySelectorAll('.modal.show button, .modal.in button, .modal button');
        for (const btn of btns) {
            if (btn.textContent.trim() === 'Sim') {
                btn.click();
                return true;
            }
        }
        throw new Error('Botão "Sim" não encontrado');
    }

    /** Aguarda os tamanhos carregarem na página (SKU inputs aparecerem) */
    async function waitForProducts() {
        const start = Date.now();
        while (Date.now() - start < CFG.pollTimeout) {
            const skuInputs = getSkuInputs();
            if (skuInputs.length > 0) {
                log(`${skuInputs.length} variantes carregadas`);
                return skuInputs;
            }
            await sleep(CFG.pollInterval);
        }
        throw new Error(`Timeout (${CFG.pollTimeout / 1000}s) aguardando variantes`);
    }

    /** Obtém todos os inputs de SKU na página */
    function getSkuInputs() {
        return [...document.querySelectorAll('input')].filter(el => {
            const prop = (el.id || el.name || '').toLowerCase();
            return prop.startsWith('sku') && norm(el.value) !== '';
        });
    }

    /** Obtém o container do registro (variante) a partir de um input */
    function getRegistroContainer(input) {
        let el = input;
        while (el && el !== document.body) {
            if (el.innerText && el.innerText.includes('Vendido de forma diversa')) return el;
            el = el.parentElement;
        }
        return input.closest('tr, .row, .card, .panel, div') || input.parentElement;
    }

    /** Altera o select "Vendido de forma diversa" para "Sim" */
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
        select.style.outline = '2px solid #10b981';
        select.style.background = 'rgba(16,185,129,0.1)';
        return true;
    }

    /** Define o valor de um input com trigger de eventos */
    function setInputValue(input, valor) {
        input.focus();
        input.select?.();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, valor); else input.value = valor;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('focusout', { bubbles: true }));
        input.blur();

        // Trigger Magis5's updateExtraFields if available
        const idMatch = input.id.match(/sku(\d+)/);
        if (idMatch && typeof window.updateExtraFields === 'function') {
            try { window.updateExtraFields(parseInt(idMatch[1])); } catch (_) { }
        }

        input.style.outline = '2px solid #10b981';
        input.style.background = 'rgba(16,185,129,0.1)';
        input.style.color = '#fff';
    }

    /** Seleciona todos os checkboxes */
    function selectAll() {
        const selectAllCb = document.getElementById('selectAll');
        if (selectAllCb) {
            selectAllCb.checked = true;
            selectAllCb.dispatchEvent(new Event('change', { bubbles: true }));
            selectAllCb.click();
            return true;
        }
        // Fallback: seleciona cada checkbox individualmente
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (!cb.checked) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        return true;
    }

    /** Clica em "Importar" no menu de 3 pontos */
    function clickImport() {
        const importBtn = document.getElementById('import');
        if (importBtn) {
            importBtn.click();
            return true;
        }
        // Fallback: procura por texto "Importar"
        const links = document.querySelectorAll('.navi-link, a[data-toggle="modal"]');
        for (const link of links) {
            if (link.textContent.trim() === 'Importar') {
                link.click();
                return true;
            }
        }
        throw new Error('Botão "Importar" não encontrado');
    }

    /** Confirma a importação no modal de alerta */
    async function confirmImport() {
        await sleep(500); // Aguarda o modal aparecer
        const modal = document.getElementById('alertModal');
        if (modal) {
            const confirmBtns = modal.querySelectorAll('button');
            for (const btn of confirmBtns) {
                const text = btn.textContent.trim().toLowerCase();
                if (text === 'sim' || text === 'confirmar' || text === 'ok') {
                    btn.click();
                    return true;
                }
            }
        }
        return false;
    }

    /** Fecha modais abertos */
    function closeModals() {
        document.querySelectorAll('.modal.show .close, .modal.in .close, button[data-dismiss="modal"]').forEach(btn => {
            try { btn.click(); } catch (_) { }
        });
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  PARSER DE ENTRADA                                                  ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Parseia a lista de entrada.
     *
     * Formato esperado (um por linha):
     *   SHOPIFY_ID [TAB] SKU_SANKHYA_1=TAMANHO_1 [TAB] SKU_SANKHYA_2=TAMANHO_2 ...
     *
     * Formato simplificado (só ID):
     *   SHOPIFY_ID
     *
     * Formato com SKUs separados por tab:
     *   SHOPIFY_ID \t SKU_ATUAL_1 \t NOVO_SKU_1 \t SKU_ATUAL_2 \t NOVO_SKU_2 ...
     */
    function parseInput(text) {
        const lines = text.split('\n').map(norm).filter(Boolean);
        const items = [];
        for (const line of lines) {
            const parts = line.split(/\t+/);
            const shopifyId = norm(parts[0]);
            if (!shopifyId) continue;

            // Pares de SKU: old→new
            const skuPairs = [];
            for (let i = 1; i < parts.length; i += 2) {
                const skuAtual = norm(parts[i]);
                const novoSku = norm(parts[i + 1] || '');
                if (skuAtual && novoSku) {
                    skuPairs.push({ skuAtual, novoSku });
                }
            }

            items.push({ shopifyId, skuPairs, producao: true });
        }
        return items;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  LOOP PRINCIPAL DE IMPORTAÇÃO                                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function processImportQueue() {
        if (_running) { log('Já está em execução!', 'warn'); return; }
        _running = true;
        _shouldStop = false;
        _paused = false;

        const inputText = document.getElementById('brk-import-list')?.value || '';
        const items = parseInput(inputText);
        if (items.length === 0) {
            log('Nenhum ID de anúncio encontrado. Cole os IDs na lista.', 'warn');
            _running = false;
            return;
        }

        const channelSelect = document.getElementById('brk-import-channel');
        const channelValue = channelSelect?.value;
        if (!channelValue) {
            log('Selecione um canal de venda!', 'warn');
            _running = false;
            return;
        }

        const producaoCheck = document.getElementById('brk-import-producao');
        const isProducao = producaoCheck?.checked ?? true;

        log(`━━━ IMPORTAÇÃO INICIADA ━━━`);
        log(`Canal: ${channelSelect.options[channelSelect.selectedIndex]?.text || channelValue}`);
        log(`IDs: ${items.length} anúncio(s)`);
        log(`Produção (diversa=Sim): ${isProducao ? 'SIM' : 'NÃO'}`);

        let sucesso = 0;
        let falhas = 0;

        updateBtnState(true);

        for (let i = 0; i < items.length; i++) {
            if (_shouldStop) {
                log('⏹ Processo interrompido pelo usuário');
                break;
            }

            while (_paused) {
                await sleep(500);
                if (_shouldStop) break;
            }

            const item = items[i];
            updateProgress(i, items.length);
            status(`[${i + 1}/${items.length}] ID: ${item.shopifyId}`);

            try {
                // 1. Fechar modais anteriores
                closeModals();
                await sleep(300);

                // 2. Abrir modal de importação
                log(`[${i + 1}] Abrindo modal para ID: ${item.shopifyId}...`);
                openImportModal();
                await sleep(800);

                // 3. Selecionar canal
                selectChannel(channelValue);
                await sleep(200);

                // 4. Colar ID do anúncio
                fillChannelId(item.shopifyId);
                await sleep(200);

                // 5. Clicar "Sim"
                clickConfirm();
                log(`[${i + 1}] Pesquisando anúncio...`);

                // 6. Aguardar variantes carregarem
                await sleep(CFG.delayAfterSearch);
                const skuInputs = await waitForProducts();

                // 7. Aplicar SKUs Sankhya (se fornecidos)
                if (item.skuPairs.length > 0) {
                    let applied = 0;
                    const inputMap = new Map();
                    for (const inp of skuInputs) {
                        inputMap.set(norm(inp.value).toUpperCase(), inp);
                    }

                    for (const pair of item.skuPairs) {
                        const input = inputMap.get(pair.skuAtual.toUpperCase());
                        if (input) {
                            setInputValue(input, pair.novoSku);
                            applied++;
                        } else {
                            log(`  SKU "${pair.skuAtual}" não encontrado na tela`, 'warn');
                        }
                    }
                    log(`[${i + 1}] ${applied}/${item.skuPairs.length} SKUs aplicados`);
                }

                // 8. Vendido de forma diversa → Sim
                if (isProducao) {
                    let diversaCount = 0;
                    for (const inp of skuInputs) {
                        const container = getRegistroContainer(inp);
                        if (setVendidoDiversa(container)) diversaCount++;
                    }
                    log(`[${i + 1}] "Vendido de forma diversa" → Sim (${diversaCount} variantes)`);
                }

                // 9. Selecionar Todos
                selectAll();
                await sleep(300);

                // 10. Clicar Importar
                clickImport();
                await sleep(500);

                // 11. Confirmar importação
                await confirmImport();

                sucesso++;
                log(`[${i + 1}] ✅ ID ${item.shopifyId} importado com sucesso!`, 'success');

                // Pausa entre itens
                if (i < items.length - 1) {
                    await sleep(CFG.delayAfterImport);
                }

            } catch (err) {
                falhas++;
                log(`[${i + 1}] Erro: ${err.message}`, 'error');
                closeModals();
                await sleep(1000);
            }
        }

        updateProgress(items.length, items.length);
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
        if (startBtn) startBtn.disabled = isRunning;
        if (pauseBtn) pauseBtn.disabled = !isRunning;
        if (stopBtn) stopBtn.disabled = !isRunning;
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
            width: 520px; max-height: 88vh; overflow: auto;
            border-radius: 16px; border: 1px solid #7F00FF40;
            box-shadow: 0 10px 40px rgba(127,0,255,0.25), 0 0 0 1px rgba(127,0,255,0.1);
            font: 13px/1.5 'Inter', system-ui, sans-serif;
        `;

        const channelOptions = Object.entries(CHANNELS).map(([name, val]) =>
            `<option value="${val}">${name}</option>`
        ).join('');

        box.innerHTML = `
            <!-- Header -->
            <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#0f172a,#1e1b4b);border-radius:16px 16px 0 0">
                <div>
                    <div style="font-weight:700;font-size:15px;color:#a78bfa">🚀 Magis5 Import Autopilot</div>
                    <div style="font-size:11px;color:#64748b">BRK — Importação em lote de anúncios Shopify</div>
                </div>
                <button id="brk-import-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px">✕</button>
            </div>

            <div style="padding:14px 16px;display:grid;gap:12px">

                <!-- Status -->
                <div id="brk-import-status" style="color:#10b981;font-weight:600;font-size:13px">Pronto para iniciar!</div>

                <!-- Progress -->
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden">
                        <div id="brk-import-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#7F00FF,#a855f7);transition:width .3s"></div>
                    </div>
                    <span id="brk-import-progress-text" style="font-size:12px;color:#94a3b8;min-width:40px">0/0</span>
                </div>

                <!-- Canal de Venda -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Canal de Venda</label>
                    <select id="brk-import-channel" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:13px">
                        ${channelOptions}
                    </select>
                </div>

                <!-- Produção toggle -->
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#cbd5e1">
                    <input type="checkbox" id="brk-import-producao" checked style="accent-color:#7F00FF;width:16px;height:16px">
                    <span>Produto de <strong style="color:#a78bfa">produção</strong> (Vendido de forma diversa = Sim)</span>
                </label>

                <!-- Lista de IDs -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">IDs dos Anúncios Shopify (um por linha)</label>
                    <textarea id="brk-import-list" rows="6" placeholder="Cole aqui os IDs da Shopify (um por linha)&#10;&#10;Formato simples:&#10;6358879166530&#10;7520209109058&#10;&#10;Formato com SKUs (ID TAB SKU_ATUAL TAB NOVO_SKU):&#10;6358879166530&#9;RAGLAN321BLPP&#9;75739&#9;RAGLAN321BLP&#9;75740" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical"></textarea>
                </div>

                <!-- Botões -->
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button id="brk-import-start" style="background:linear-gradient(135deg,#7F00FF,#5B21B6);color:#fff;border:0;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:13px;flex:1">▶ Iniciar Importação</button>
                    <button id="brk-import-pause" disabled style="background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:13px">⏸ Pausar</button>
                    <button id="brk-import-stop" disabled style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:13px">⏹ Parar</button>
                </div>

                <!-- Log -->
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Terminal</label>
                        <button id="brk-import-clear-log" style="background:transparent;border:1px solid #334155;color:#64748b;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px">Limpar</button>
                    </div>
                    <div id="brk-import-log" style="background:#020617;border-radius:10px;padding:10px;max-height:25vh;overflow:auto;white-space:pre-wrap;font-family:'JetBrains Mono',monospace;font-size:11px;color:#94a3b8;border:1px solid #1e293b"></div>
                </div>

                <!-- Info -->
                <div style="font-size:11px;color:#475569;text-align:center;padding-top:4px;border-top:1px solid #1e293b">
                    HUB Hook Prime v4.0 · Magis5 Import Autopilot · Tampermonkey
                </div>
            </div>
        `;

        document.body.appendChild(box);

        // Event Bindings
        box.querySelector('#brk-import-close').onclick = () => box.remove();
        box.querySelector('#brk-import-start').onclick = processImportQueue;
        box.querySelector('#brk-import-pause').onclick = () => {
            _paused = !_paused;
            const btn = box.querySelector('#brk-import-pause');
            btn.textContent = _paused ? '▶ Continuar' : '⏸ Pausar';
            btn.style.background = _paused ? '#059669' : '#334155';
            log(_paused ? '⏸ Pausado' : '▶ Retomando...', 'warn');
        };
        box.querySelector('#brk-import-stop').onclick = () => {
            _shouldStop = true;
            log('⏹ Parando após o item atual...', 'warn');
        };
        box.querySelector('#brk-import-clear-log').onclick = () => {
            document.getElementById('brk-import-log').textContent = '';
        };

        log('Painel aberto. Cole os IDs da Shopify e clique em "Iniciar".', 'info');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INICIALIZAÇÃO                                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    setTimeout(buildLauncher, 2000);

})();
