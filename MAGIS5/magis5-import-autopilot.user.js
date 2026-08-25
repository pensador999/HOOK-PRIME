// ==UserScript==
// @name         Magis5 Import Autopilot — BRK
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Automação VISUAL de importação Shopify → Magis5 com integração automática Sankhya
// @match        https://app.magis5.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    if (!window.location.href.includes('magis5')) return;

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  CONFIGURAÇÕES DE VELOCIDADE (AJUSTÁVEIS EM TEMPO REAL)            ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    // Perfis de velocidade
    const SPEED_PROFILES = {
        slow: {
            name: '🐢 Lento / Inspeção (Para acompanhar com calma)',
            delayAfterModal: 2000,
            delayAfterSearch: 6000,
            delayBetweenItems: 4000,
            delayAfterImport: 4500,
            delayStep: 1500,
            pollInterval: 600,
            pollTimeout: 25000,
        },
        normal: {
            name: '⚡ Normal (Equilibrado)',
            delayAfterModal: 1200,
            delayAfterSearch: 4500,
            delayBetweenItems: 2500,
            delayAfterImport: 3500,
            delayStep: 800,
            pollInterval: 500,
            pollTimeout: 20000,
        },
        fast: {
            name: '🚀 Rápido / Produção',
            delayAfterModal: 600,
            delayAfterSearch: 3500,
            delayBetweenItems: 1500,
            delayAfterImport: 2500,
            delayStep: 400,
            pollInterval: 400,
            pollTimeout: 15000,
        }
    };

    let activeSpeed = 'slow'; // Começa em modo lento para você inspecionar com conforto!

    function getCFG() {
        return SPEED_PROFILES[activeSpeed] || SPEED_PROFILES.normal;
    }

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
    // ║  FEEDBACK VISUAL APRIMORADO                                         ║
    // ╚══════════════════════════════════════════════════════════════════════╝

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
            box-shadow: 0 4px 20px rgba(127,0,255,0.4);
            transition: opacity 0.3s;
        `;
        bar.innerHTML = `
            <span style="font-weight:800;color:#a78bfa;letter-spacing:0.5px">🚀 HOOK PRIME MAGIS5</span>
            <span id="brk-vb-step" style="color:#10b981;font-weight:700;background:rgba(16,185,129,0.15);padding:2px 10px;border-radius:6px;border:1px solid rgba(16,185,129,0.3)">Iniciando...</span>
            <span style="flex:1"></span>
            <span id="brk-vb-speed" style="color:#f59e0b;font-size:12px;font-weight:600"></span>
            <span id="brk-vb-progress" style="color:#e2e8f0;font-weight:700">0/0</span>
            <span id="brk-vb-id" style="color:#94a3b8;font-family:monospace;font-size:12px;background:#020617;padding:2px 8px;border-radius:4px"></span>
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
        const speedEl = bar.querySelector('#brk-vb-speed');
        if (stepEl) stepEl.textContent = step;
        if (progEl) progEl.textContent = progress;
        if (idEl) idEl.textContent = id ? `ID: ${id}` : '';
        if (speedEl) speedEl.textContent = activeSpeed === 'slow' ? '🐢 MODO INSPEÇÃO' : activeSpeed === 'fast' ? '🚀 TURBO' : '⚡ NORMAL';
    }

    function removeVisualBar() {
        document.getElementById('brk-visual-bar')?.remove();
    }

    function highlight(el, color = '#7F00FF') {
        if (!el) return;
        el.style.outline = `3px solid ${color}`;
        el.style.outlineOffset = '3px';
        el.style.boxShadow = `0 0 20px ${color}`;
        el.style.transition = 'all 0.3s ease';
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(_) {}
    }

    function unhighlight(el) {
        if (!el) return;
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.style.boxShadow = '';
    }

    function showAction(text, emoji = '⚡') {
        let toast = document.getElementById('brk-action-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'brk-action-toast';
            toast.style.cssText = `
                position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%);
                z-index: 1000001; background: #0f172a; color: #e2e8f0;
                padding: 12px 28px; border-radius: 12px; font: 15px/1.4 system-ui, sans-serif;
                border: 2px solid #7F00FF; box-shadow: 0 10px 40px rgba(127,0,255,0.45);
                transition: opacity 0.3s, transform 0.3s; font-weight: 600; text-align: center;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span style="margin-right:8px">${emoji}</span> ${text}`;
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
    // ║  AÇÕES NO DOM MAGIS5                                                ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function visualOpenModal() {
        const cfg = getCFG();
        showAction('Abrindo modal "Baixar anúncio específico"...', '📂');

        // ⚠️ A Magis5 tem 2 botões com o MESMO id="generatePurchase":
        //   1º → "Baixar anúncios para importação" (ERRADO — sincronização em lote)
        //   2º → "Baixar anúncio específico" (CERTO — busca por ID)
        // getElementById() retorna o 1º, então buscamos pelo TEXTO do botão.
        const allBtns = document.querySelectorAll('#generatePurchase, .btn-light-primary');
        let btn = null;
        for (const b of allBtns) {
            const texto = b.textContent.trim().toLowerCase();
            if (texto.includes('anúncio específico') || texto.includes('anuncio especifico')) {
                btn = b;
                break;
            }
        }

        if (!btn) throw new Error('Botão "Baixar anúncio específico" não encontrado na página');
        highlight(btn, '#10b981');
        await sleep(cfg.delayStep);
        btn.click();
        unhighlight(btn);
        await sleep(cfg.delayAfterModal);
    }

    async function visualSelectChannel(channelValue, channelName) {
        const cfg = getCFG();
        showAction(`Selecionando loja: ${channelName}`, '🏪');
        const select = document.getElementById('channel');
        if (!select) throw new Error('Select de canal não encontrado no modal da Magis5');

        highlight(select, '#3b82f6');
        await sleep(cfg.delayStep);

        // Busca a melhor opção: por value exato OU por texto contido (ex: "FISHING", "AGRO", "MOTORS")
        let targetOption = [...select.options].find(o => o.value === channelValue);
        if (!targetOption) {
            const cleanName = channelName.toUpperCase().replace('BRK', '').trim();
            targetOption = [...select.options].find(o => o.textContent.toUpperCase().includes(cleanName));
        }

        if (targetOption) {
            select.value = targetOption.value;
            targetOption.selected = true;
            
            // Disparar eventos nativos
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));

            // Suporte a jQuery e Select2 da Magis5
            try {
                const win = window;
                if (win.jQuery || win.$) {
                    const jq = win.jQuery || win.$;
                    jq(select).val(targetOption.value).trigger('change');
                }
            } catch(_) {}

            // Atualiza visual do Select2 se existir
            const select2Container = document.querySelector('#select2-channel-container, [aria-labelledby*="select2-channel"], .select2-selection__rendered');
            if (select2Container) {
                select2Container.textContent = targetOption.textContent;
                select2Container.title = targetOption.textContent;
                highlight(select2Container, '#3b82f6');
            }

            log(`Canal selecionado no modal: "${targetOption.textContent.trim()}" (ID: ${targetOption.value})`, 'success');
        } else {
            log(`⚠️ Opção para "${channelName}" não encontrada no select da Magis5. Usando primeira opção disponível.`, 'warn');
        }

        await sleep(cfg.delayStep);
        unhighlight(select);
    }

    async function visualFillId(shopifyId) {
        const cfg = getCFG();
        showAction(`Preenchendo ID do Anúncio: ${shopifyId}`, '🔗');
        const input = document.getElementById('channelId');
        if (!input) throw new Error('Input channelId não encontrado');
        highlight(input, '#f59e0b');
        await sleep(cfg.delayStep);

        input.value = '';
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(input, shopifyId);
        else input.value = shopifyId;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        unhighlight(input);
        await sleep(400);
    }

    async function visualClickSim() {
        const cfg = getCFG();
        showAction('Confirmando busca no Marketplace (Sim)...', '🔍');
        await sleep(cfg.delayStep);

        if (typeof window.createFindProductOnChannel === 'function') {
            window.createFindProductOnChannel();
            return;
        }
        const btns = document.querySelectorAll('.modal button, .modal.show button');
        for (const btn of btns) {
            if (btn.textContent.trim() === 'Sim') {
                highlight(btn, '#10b981');
                await sleep(cfg.delayStep);
                btn.click();
                unhighlight(btn);
                return;
            }
        }
        throw new Error('Botão "Sim" não encontrado');
    }

    async function waitForVariants() {
        const cfg = getCFG();
        showAction('Aguardando a Magis5 carregar as variantes...', '⏳');
        const start = Date.now();
        while (Date.now() - start < cfg.pollTimeout) {
            const inputs = getSkuInputs();
            if (inputs.length > 0) {
                showAction(`✅ Sucesso! ${inputs.length} variantes prontas na tela.`, '📦');
                if (inputs[0]) highlight(inputs[0], '#10b981');
                if (inputs.length > 1) highlight(inputs[inputs.length - 1], '#10b981');
                await sleep(cfg.delayStep);
                inputs.forEach(unhighlight);
                return inputs;
            }
            await sleep(cfg.pollInterval);
        }
        throw new Error(`Tempo esgotado (${cfg.pollTimeout / 1000}s) aguardando variantes`);
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

    /**
     * Define "Vendido de forma diversa" = Sim ou Não
     * @param {Element} registroEl - container da variante
     * @param {string} valor - 'sim' ou 'não'
     */
    function setVendidoDiversa(registroEl, valor = 'sim') {
        if (!registroEl) return false;
        let select = registroEl.querySelector('select[name="isProductOnChannelLocked"]');
        if (!select) {
            const selects = registroEl.querySelectorAll('select');
            if (selects.length > 0) select = selects[selects.length - 1];
        }
        if (!select) return false;
        const target = valor.toLowerCase().replace('ã', 'a');
        const opt = [...select.options].find(o => {
            const txt = norm(o.textContent).toLowerCase().replace('ã', 'a');
            return txt === target;
        });
        if (!opt) return false;
        select.value = opt.value;
        opt.selected = true;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        highlight(select, target === 'sim' ? '#10b981' : '#f59e0b');
        return true;
    }

    /**
     * Define o estoque como "sankhya - ESTOQUE REVENDA" (value 1010000)
     * O select de cada variante tem id "wareHouseSelect{N}"
     */
    function setEstoqueRevenda(skuInput) {
        const idMatch = skuInput.id.match(/(\d+)/);
        if (!idMatch) return false;
        const numId = idMatch[1];

        let whSelect = document.getElementById('wareHouseSelect' + numId);
        if (!whSelect) {
            const container = getRegistroContainer(skuInput);
            if (container) whSelect = container.querySelector('select[id^="wareHouseSelect"]');
        }
        if (!whSelect) return false;

        // Busca por value exato ou por texto
        let opt = [...whSelect.options].find(o => o.value === '1010000');
        if (!opt) opt = [...whSelect.options].find(o => o.textContent.toUpperCase().includes('ESTOQUE REVENDA'));
        if (!opt) return false;

        whSelect.value = opt.value;
        opt.selected = true;
        whSelect.dispatchEvent(new Event('input', { bubbles: true }));
        whSelect.dispatchEvent(new Event('change', { bubbles: true }));

        if (typeof window.updateExtraFields === 'function') {
            try { window.updateExtraFields(parseInt(numId)); } catch (_) {}
        }

        highlight(whSelect, '#f59e0b');
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
        const cfg = getCFG();
        showAction('Marcando "Selecionar Todos"...', '☑️');
        const selectAllCb = document.getElementById('selectAll');
        if (selectAllCb) {
            highlight(selectAllCb, '#7F00FF');
            await sleep(cfg.delayStep);
            selectAllCb.checked = true;
            selectAllCb.dispatchEvent(new Event('change', { bubbles: true }));
            selectAllCb.click();
            unhighlight(selectAllCb);
        } else {
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            });
        }
        await sleep(400);
    }

    async function visualClickImport() {
        const cfg = getCFG();

        // ── PASSO 1: Abrir o dropdown dos 3 pontos ──
        showAction('Abrindo menu de ações (3 pontos)...', '⋯');
        let dropdownOpened = false;

        // Busca o botão dos 3 pontos (Metronic/Magis5 usa dropdown-toggle perto da área de importação)
        const dropdownToggles = document.querySelectorAll(
            '[data-toggle="dropdown"], .dropdown-toggle, ' +
            'a.btn-clean.btn-icon, button.btn-clean.btn-icon, ' +
            '.btn-icon-md[data-toggle="dropdown"]'
        );
        for (const toggle of dropdownToggles) {
            // Procura o toggle que está próximo ao selectAll ou na área de ações do produto
            const parent = toggle.closest('.card-toolbar, .dropdown, .btn-group, div');
            if (parent) {
                highlight(toggle, '#f59e0b');
                await sleep(cfg.delayStep);
                toggle.click();
                unhighlight(toggle);
                dropdownOpened = true;
                await sleep(600);
                break;
            }
        }

        // Fallback: tenta abrir qualquer dropdown visível na página
        if (!dropdownOpened) {
            const allToggles = document.querySelectorAll('[data-toggle="dropdown"]');
            for (const toggle of allToggles) {
                const rect = toggle.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    toggle.click();
                    dropdownOpened = true;
                    await sleep(600);
                    break;
                }
            }
        }

        // ── PASSO 2: Clicar em "Importar" dentro do dropdown ──
        showAction('Clicando em "Importar"...', '📥');
        let importClicked = false;

        // Busca por <span class="navi-text">Importar</span> ou link com texto "Importar"
        const naviTexts = document.querySelectorAll(
            '.navi-text, .navi-link, .dropdown-item, .dropdown-menu a, .dropdown-menu span'
        );
        for (const el of naviTexts) {
            if (el.textContent.trim() === 'Importar') {
                const clickTarget = el.closest('a, button, .navi-item, .navi-link') || el;
                highlight(clickTarget, '#ef4444');
                await sleep(cfg.delayStep);
                clickTarget.click();
                unhighlight(clickTarget);
                importClicked = true;
                break;
            }
        }

        // Fallback direto por ID
        if (!importClicked) {
            const importBtn = document.getElementById('import');
            if (importBtn) {
                highlight(importBtn, '#ef4444');
                await sleep(cfg.delayStep);
                importBtn.click();
                unhighlight(importBtn);
                importClicked = true;
            }
        }

        if (!importClicked) {
            log('⚠️ Botão "Importar" não encontrado no dropdown.', 'warn');
        }

        // ── PASSO 3: Confirmar importação (doImport ou botão "Sim" no modal) ──
        await sleep(1200);
        showAction('Confirmando importação...', '✅');

        // Tenta chamar doImport() diretamente (mais confiável)
        if (typeof window.doImport === 'function') {
            highlight(document.body, '#10b981');
            await sleep(cfg.delayStep);
            window.doImport();
            unhighlight(document.body);
            log('Importação confirmada via doImport().', 'success');
            return;
        }

        // Fallback: busca botão "Sim" no modal de confirmação
        const modal = document.getElementById('alertModal');
        if (modal) {
            const confirmBtns = modal.querySelectorAll('button');
            for (const btn of confirmBtns) {
                const text = btn.textContent.trim().toLowerCase();
                if (text === 'sim' || text === 'confirmar' || text === 'ok') {
                    highlight(btn, '#10b981');
                    await sleep(cfg.delayStep);
                    btn.click();
                    unhighlight(btn);
                    log('Importação confirmada via botão "Sim".', 'success');
                    return;
                }
            }
        }

        // Último fallback: busca qualquer botão com onclick="doImport()"
        const doImportBtn = document.querySelector('button[onclick*="doImport"]');
        if (doImportBtn) {
            highlight(doImportBtn, '#10b981');
            await sleep(cfg.delayStep);
            doImportBtn.click();
            unhighlight(doImportBtn);
            log('Importação confirmada via botão onclick doImport.', 'success');
        }
    }

    function closeModals() {
        document.querySelectorAll('.modal.show .close, .modal.in .close, button[data-dismiss="modal"]').forEach(btn => {
            try { btn.click(); } catch (_) { }
        });
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INTEGRAÇÃO SANKHYA — GM_setValue / GM_addValueChangeListener      ║
    // ║                                                                      ║
    // ║  Comunicação cross-domain via Tampermonkey:                         ║
    // ║  1. Magis5 envia SKUs → GM_setValue('brk_skus_pendentes', [...])    ║
    // ║  2. Sankhya detecta → processa → GM_setValue('brk_skus_resultado') ║
    // ║  3. Magis5 detecta resultado → aplica códigos nos campos           ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Lê os SKUs das variantes na tela da Magis5 e detecta quais precisam de EAN.
     * Retorna array de { sku, precisaEan }
     */
    function readSkusFromScreen() {
        const skuInputs = getSkuInputs();
        const entries = [];
        for (const inp of skuInputs) {
            const sku = norm(inp.value);
            if (!sku) continue;
            const container = getRegistroContainer(inp);
            // Detecta se o campo EAN está vazio
            const eanInputs = container ? container.querySelectorAll('input') : [];
            let temEan = false;
            for (const ei of eanInputs) {
                const id = (ei.id || '').toLowerCase();
                if ((id.includes('ean') || id.includes('gtin')) && norm(ei.value)) {
                    temEan = true;
                    break;
                }
            }
            entries.push({ sku, precisaEan: !temEan });
        }
        return entries;
    }

    /**
     * Envia lista de SKUs para o Sankhya via GM_setValue
     */
    function sendSkusToSankhya(skuEntries) {
        const payload = {
            timestamp: Date.now(),
            skus: skuEntries, // [{ sku: 'C02570PP', precisaEan: true }, ...]
            status: 'pendente'
        };
        GM_setValue('brk_skus_pendentes', JSON.stringify(payload));
        log(`📡 ${skuEntries.length} SKUs enviados ao Sankhya via GM_setValue`, 'info');
    }

    /**
     * Aguarda o Sankhya processar e retornar os resultados.
     * Retorna array de { sku, codigo, ean } ou null se timeout.
     */
    function waitForSankhyaResults(timeoutMs = 120000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            // Listener para mudanças no GM value
            const listenerId = GM_addValueChangeListener('brk_skus_resultado', (name, oldVal, newVal, remote) => {
                if (!remote) return; // Ignora mudanças locais
                try {
                    const result = JSON.parse(newVal);
                    if (result && result.status === 'completo' && result.pares) {
                        GM_removeValueChangeListener(listenerId);
                        clearInterval(timeoutCheck);
                        log(`📡 Resultado recebido do Sankhya: ${result.pares.length} pares`, 'success');
                        resolve(result.pares); // [{ sku, codigo, ean }, ...]
                    }
                } catch (e) {
                    log(`⚠️ Erro ao parsear resultado do Sankhya: ${e.message}`, 'warn');
                }
            });

            // Timeout check
            const timeoutCheck = setInterval(() => {
                if (Date.now() - startTime > timeoutMs) {
                    GM_removeValueChangeListener(listenerId);
                    clearInterval(timeoutCheck);
                    log(`⏰ Timeout aguardando Sankhya (${timeoutMs / 1000}s). Continuando sem códigos.`, 'warn');
                    resolve(null);
                }
            }, 5000);

            // Verifica se já tem resultado disponível
            try {
                const existing = GM_getValue('brk_skus_resultado', '');
                if (existing) {
                    const result = JSON.parse(existing);
                    if (result && result.status === 'completo' && result.timestamp > startTime - 5000) {
                        GM_removeValueChangeListener(listenerId);
                        clearInterval(timeoutCheck);
                        resolve(result.pares);
                    }
                }
            } catch (_) {}
        });
    }

    /**
     * Aplica os resultados do Sankhya nos campos da Magis5.
     * pares = [{ sku: 'C02570PP', codigo: '75679', ean: '7804812157814' }, ...]
     */
    function applySankhyaResults(pares) {
        if (!pares || pares.length === 0) return 0;

        const skuInputs = getSkuInputs();
        const inputMap = new Map();
        skuInputs.forEach(inp => inputMap.set(norm(inp.value).toUpperCase(), inp));

        let applied = 0;
        for (const par of pares) {
            const input = inputMap.get(par.sku.toUpperCase());
            if (!input) continue;

            // Aplica código Sankhya no campo SKU
            setInputValue(input, par.codigo);
            applied++;

            // Aplica EAN se disponível e campo estiver vazio
            if (par.ean) {
                const container = getRegistroContainer(input);
                if (container) {
                    const eanInputs = container.querySelectorAll('input');
                    for (const ei of eanInputs) {
                        const id = (ei.id || '').toLowerCase();
                        if ((id.includes('ean') || id.includes('gtin')) && !norm(ei.value)) {
                            setInputValue(ei, par.ean);
                            log(`  EAN aplicado: ${par.ean}`, 'info');
                            break;
                        }
                    }
                }
            }
        }
        return applied;
    }

    // Limpa o canal de comunicação ao iniciar
    try { GM_setValue('brk_skus_pendentes', ''); GM_setValue('brk_skus_resultado', ''); } catch(_) {}

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
    // ║  EXECUÇÃO CONTROLADA                                                ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function processImportQueue(onlySingle = false) {
        if (_running) { log('Já está em execução!', 'warn'); return; }
        _running = true;
        _shouldStop = false;
        _paused = false;

        const inputText = document.getElementById('brk-import-list')?.value || '';
        let items = parseInput(inputText);
        if (items.length === 0) {
            log('Nenhum ID encontrado na lista. Cole os IDs do Shopify Extractor!', 'warn');
            _running = false;
            return;
        }

        if (onlySingle) {
            items = [items[0]]; // Executa somente o primeiro anúncio para teste
            log(`🧪 Modo Teste: Executando apenas o 1º anúncio (ID: ${items[0].shopifyId})`, 'warn');
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
        const cfg = getCFG();

        createVisualBar();
        log(`━━━ IMPORTAÇÃO INICIADA (${onlySingle ? 'TESTE 1 ITEM' : items.length + ' ITENS'}) ━━━`);
        log(`Velocidade: ${cfg.name}`);
        log(`Canal: ${channelName}`);

        let sucesso = 0;
        let falhas = 0;
        updateBtnState(true);

        for (let i = 0; i < items.length; i++) {
            if (_shouldStop) {
                log('⏹ Interrompido pelo usuário.');
                break;
            }
            while (_paused) {
                updateVisualBar('⏸ PAUSADO — Clique em Continuar', `${i}/${items.length}`, items[i].shopifyId);
                await sleep(500);
                if (_shouldStop) break;
            }

            const item = items[i];
            const label = `[${i + 1}/${items.length}]`;
            updateProgress(i, items.length);
            updateVisualBar(`Processando ${label}`, `${i + 1}/${items.length}`, item.shopifyId);
            status(`${label} ID: ${item.shopifyId}`);

            try {
                // 1. Limpar modais
                closeModals();
                await sleep(600);

                // 2. Abrir Modal
                updateVisualBar(`${label} 1. Abrindo Modal`, `${i + 1}/${items.length}`, item.shopifyId);
                log(`${label} Abrindo modal de importação...`);
                await visualOpenModal();

                // 3. Selecionar Canal
                updateVisualBar(`${label} 2. Selecionando Canal`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualSelectChannel(channelValue, channelName);

                // 4. Preencher ID
                updateVisualBar(`${label} 3. Preenchendo ID`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualFillId(item.shopifyId);

                // 5. Clicar Sim
                updateVisualBar(`${label} 4. Buscando Anúncio`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualClickSim();

                // 6. Aguardar Variantes
                updateVisualBar(`${label} 5. Carregando Variantes`, `${i + 1}/${items.length}`, item.shopifyId);
                log(`${label} Aguardando variantes carregarem...`);
                await sleep(cfg.delayAfterSearch);
                const skuInputs = await waitForVariants();
                log(`${label} ${skuInputs.length} variantes carregadas na tela.`);

                // 7. Consulta Sankhya (automático) ou Aplicar SKUs (manual)
                if (item.skuPairs.length > 0) {
                    // MODO MANUAL: pares já vieram colados no input
                    updateVisualBar(`${label} 6. Aplicando SKUs (manual)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('Aplicando SKUs manuais...', '🔄');
                    const inputMap = new Map();
                    skuInputs.forEach(inp => inputMap.set(norm(inp.value).toUpperCase(), inp));
                    let applied = 0;
                    for (const pair of item.skuPairs) {
                        const input = inputMap.get(pair.skuAtual.toUpperCase());
                        if (input) { setInputValue(input, pair.novoSku); applied++; await sleep(250); }
                    }
                    log(`${label} ${applied}/${item.skuPairs.length} SKUs aplicados (manual).`);
                } else {
                    // MODO AUTOMÁTICO: envia SKUs ao Sankhya e aguarda resposta
                    updateVisualBar(`${label} 6a. Lendo SKUs da tela`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('Lendo SKUs das variantes para enviar ao Sankhya...', '📖');
                    const skuEntries = readSkusFromScreen();
                    log(`${label} ${skuEntries.length} SKUs lidos da tela.`);

                    if (skuEntries.length > 0) {
                        updateVisualBar(`${label} 6b. 📡 Aguardando Sankhya...`, `${i + 1}/${items.length}`, item.shopifyId);
                        showAction(`Enviando ${skuEntries.length} SKUs ao Sankhya — aguardando resposta...`, '📡');

                        // Limpa resultado anterior e envia novos SKUs
                        GM_setValue('brk_skus_resultado', '');
                        await sleep(300);
                        sendSkusToSankhya(skuEntries);

                        // Aguarda o Sankhya processar (timeout 2 min)
                        const pares = await waitForSankhyaResults(120000);

                        if (pares && pares.length > 0) {
                            updateVisualBar(`${label} 6c. Aplicando códigos Sankhya`, `${i + 1}/${items.length}`, item.shopifyId);
                            showAction(`Aplicando ${pares.length} códigos do Sankhya...`, '✅');
                            const applied = applySankhyaResults(pares);
                            await sleep(cfg.delayStep);
                            log(`${label} ✅ ${applied}/${pares.length} códigos Sankhya aplicados.`, 'success');
                        } else {
                            log(`${label} ⚠️ Sankhya não retornou resultados. SKUs mantidos como estão.`, 'warn');
                        }
                    }
                }

                // 8. Produção vs Revenda
                if (isProducao) {
                    // PRODUÇÃO: Vendido de forma diversa = Sim
                    updateVisualBar(`${label} 7. Diversa=Sim (Produção)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('PRODUÇÃO: "Vendido de forma diversa" = Sim', '🏭');
                    let count = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp), 'sim')) count++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} ✅ Produção — Diversa=Sim em ${count} variantes.`);
                } else {
                    // REVENDA: Vendido de forma diversa = Não + Estoque Revenda
                    updateVisualBar(`${label} 7a. Diversa=Não (Revenda)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('REVENDA: "Vendido de forma diversa" = Não', '🔄');
                    let countDiversa = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp), 'nao')) countDiversa++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} Diversa=Não em ${countDiversa} variantes.`);

                    updateVisualBar(`${label} 7b. Estoque Revenda`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('REVENDA: Selecionando "ESTOQUE REVENDA"', '📦');
                    let countEstoque = 0;
                    for (const inp of skuInputs) {
                        if (setEstoqueRevenda(inp)) countEstoque++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} ✅ Revenda — Estoque Revenda em ${countEstoque} variantes.`);
                }

                // 9. Selecionar Todos
                updateVisualBar(`${label} 8. Selecionando Todos`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualSelectAll();

                // 10. Importar
                updateVisualBar(`${label} 9. Importando!`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualClickImport();

                sucesso++;
                showAction(`✅ Anúncio ${item.shopifyId} importado com sucesso!`, '🎉');
                log(`${label} ✅ Importado com sucesso!`, 'success');

                if (i < items.length - 1) {
                    updateVisualBar(`Aguardando próximo item...`, `${i + 1}/${items.length}`, '');
                    await sleep(cfg.delayAfterImport);
                }

            } catch (err) {
                falhas++;
                showAction(`Erro: ${err.message}`, '❌');
                log(`${label} Falha: ${err.message}`, 'error');
                closeModals();
                await sleep(2000);
            }
        }

        updateProgress(items.length, items.length);
        hideAction();
        removeVisualBar();
        status('Finalizado!');
        log(`━━━ FIM DO PROCESSO ━━━`);
        log(`✅ Sucesso: ${sucesso} | ❌ Falhas: ${falhas} | Total: ${items.length}`);

        _running = false;
        updateBtnState(false);
    }

    function updateBtnState(isRunning) {
        const startBtn = document.getElementById('brk-import-start');
        const singleBtn = document.getElementById('brk-import-single');
        const pauseBtn = document.getElementById('brk-import-pause');
        const stopBtn = document.getElementById('brk-import-stop');
        if (startBtn) { startBtn.disabled = isRunning; startBtn.style.opacity = isRunning ? '0.5' : '1'; }
        if (singleBtn) { singleBtn.disabled = isRunning; singleBtn.style.opacity = isRunning ? '0.5' : '1'; }
        if (pauseBtn) { pauseBtn.disabled = !isRunning; pauseBtn.style.opacity = !isRunning ? '0.5' : '1'; }
        if (stopBtn) { stopBtn.disabled = !isRunning; stopBtn.style.opacity = !isRunning ? '0.5' : '1'; }
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  UI — PAINEL DE CONTROLE                                            ║
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
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
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
            width: 500px; max-height: 90vh; overflow: auto;
            border-radius: 16px; border: 1px solid #7F00FF50;
            box-shadow: 0 10px 40px rgba(127,0,255,0.3);
            font: 13px/1.5 'Inter', system-ui, sans-serif;
        `;

        const channelOptions = Object.entries(CHANNELS).map(([name, val]) =>
            `<option value="${val}">${name}</option>`
        ).join('');

        box.innerHTML = `
            <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#0f172a,#1e1b4b);border-radius:16px 16px 0 0">
                <div>
                    <div style="font-weight:800;font-size:15px;color:#a78bfa">🚀 Magis5 Import Autopilot v3</div>
                    <div style="font-size:11px;color:#64748b">Importação com Modo de Inspeção Visual</div>
                </div>
                <button id="brk-import-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px">✕</button>
            </div>
            <div style="padding:14px 16px;display:grid;gap:12px">
                <div id="brk-import-status" style="color:#10b981;font-weight:600;font-size:13px">Pronto para iniciar</div>

                <!-- PROGRESSO -->
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden">
                        <div id="brk-import-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#7F00FF,#a855f7);transition:width .3s"></div>
                    </div>
                    <span id="brk-import-progress-text" style="font-size:12px;color:#94a3b8;min-width:40px">0/0</span>
                </div>

                <!-- CONTROLE DE VELOCIDADE -->
                <div style="background:#1e1b4b;border-radius:10px;padding:10px 12px;border:1px solid #7F00FF40">
                    <label style="display:block;font-size:11px;color:#a78bfa;margin-bottom:6px;font-weight:700;text-transform:uppercase">⏱️ Velocidade de Execução</label>
                    <select id="brk-speed-select" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:12px;font-weight:600">
                        <option value="slow" selected>🐢 Modo Lento / Inspeção (Para acompanhar com calma)</option>
                        <option value="normal">⚡ Modo Normal (Equilibrado)</option>
                        <option value="fast">🚀 Modo Turbo / Rápido (Produção)</option>
                    </select>
                </div>

                <!-- CANAL -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase">Canal de Venda</label>
                    <select id="brk-import-channel" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:13px">
                        ${channelOptions}
                    </select>
                </div>

                <div style="background:#1e1b4b;border-radius:10px;padding:10px 12px;border:1px solid #7F00FF30">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#cbd5e1">
                        <input type="checkbox" id="brk-import-producao" checked style="accent-color:#7F00FF;width:16px;height:16px">
                        <span>Produto de <strong style="color:#a78bfa">produção</strong></span>
                    </label>
                    <div id="brk-import-modo-info" style="font-size:11px;margin-top:6px;padding:6px 8px;border-radius:6px;background:#0f172a;color:#10b981;border:1px solid #10b98130">
                        🏭 <strong>PRODUÇÃO</strong>: Diversa = Sim
                    </div>
                </div>

                <!-- LISTA DE IDS -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase">IDs dos Anúncios (Cole do Shopify Extractor)</label>
                    <textarea id="brk-import-list" rows="5" placeholder="Cole aqui os IDs da Shopify (um por linha)..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:monospace;font-size:12px;resize:vertical"></textarea>
                </div>

                <!-- BOTÕES DE CONTROLE -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <button id="brk-import-single" style="background:#059669;color:#fff;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
                        🧪 Testar Apenas 1º Anúncio
                    </button>
                    <button id="brk-import-start" style="background:linear-gradient(135deg,#7F00FF,#5B21B6);color:#fff;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
                        ▶ Importar Todos em Lote
                    </button>
                </div>

                <div style="display:flex;gap:8px">
                    <button id="brk-import-pause" disabled style="background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:12px;flex:1">⏸ Pausar</button>
                    <button id="brk-import-stop" disabled style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:12px;flex:1">⏹ Parar</button>
                </div>

                <!-- LOG -->
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase">Terminal em Tempo Real</label>
                        <button id="brk-import-clear-log" style="background:transparent;border:1px solid #334155;color:#64748b;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px">Limpar</button>
                    </div>
                    <div id="brk-import-log" style="background:#020617;border-radius:10px;padding:10px;max-height:18vh;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;color:#94a3b8;border:1px solid #1e293b"></div>
                </div>

                <div style="font-size:10px;color:#475569;text-align:center;padding-top:4px;border-top:1px solid #1e293b">
                    Hook Prime v4.1 · Magis5 Import v4.1 · Sankhya Auto ✅
                </div>
            </div>
        `;

        document.body.appendChild(box);

        box.querySelector('#brk-import-close').onclick = () => box.remove();
        box.querySelector('#brk-import-start').onclick = () => processImportQueue(false);
        box.querySelector('#brk-import-single').onclick = () => processImportQueue(true);

        box.querySelector('#brk-speed-select').onchange = (e) => {
            activeSpeed = e.target.value;
            log(`Velocidade alterada para: ${SPEED_PROFILES[activeSpeed].name}`, 'info');
        };

        box.querySelector('#brk-import-producao').onchange = (e) => {
            const info = document.getElementById('brk-import-modo-info');
            if (e.target.checked) {
                info.innerHTML = '🏭 <strong>PRODUÇÃO</strong>: Diversa = Sim';
                info.style.color = '#10b981';
                info.style.borderColor = '#10b98130';
                log('Modo: PRODUÇÃO (Diversa=Sim)', 'info');
            } else {
                info.innerHTML = '📦 <strong>REVENDA</strong>: Diversa = Não · Estoque = REVENDA';
                info.style.color = '#f59e0b';
                info.style.borderColor = '#f59e0b30';
                log('Modo: REVENDA (Diversa=Não + Estoque Revenda)', 'info');
            }
        };

        box.querySelector('#brk-import-pause').onclick = () => {
            _paused = !_paused;
            const btn = box.querySelector('#brk-import-pause');
            btn.textContent = _paused ? '▶ Continuar' : '⏸ Pausar';
            btn.style.background = _paused ? '#059669' : '#334155';
            log(_paused ? '⏸ Pausado pelo usuário' : '▶ Retomando...', 'warn');
        };

        box.querySelector('#brk-import-stop').onclick = () => {
            _shouldStop = true;
            log('⏹ Parando após o item atual...', 'warn');
        };

        box.querySelector('#brk-import-clear-log').onclick = () => {
            document.getElementById('brk-import-log').textContent = '';
        };

        log('Painel pronto. Comece clicando em "🧪 Testar Apenas 1º Anúncio" para conferir tudo!', 'info');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INICIALIZAÇÃO                                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    setTimeout(buildLauncher, 2000);

})();
