// ==UserScript==
// @name         BRK Autopilot Unificado - Magis5 + Sankhya
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Script unificado: Import Autopilot (Magis5) + Extrator SKU (Sankhya) com GM_setValue compartilhado
// @match        https://app.magis5.com.br/*
// @match        https://brk.sankhyacloud.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const norm = s => (s || '').replace(/\r/g, '').trim();
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const _brkHost = location.hostname.toLowerCase();

    // ==================================================================
    // MODULO MAGIS5 -- Import Autopilot v5.0
    // ==================================================================

    if (_brkHost.includes('magis5')) {

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  CONFIGURAÃ‡Ã•ES DE VELOCIDADE (AJUSTÃVEIS EM TEMPO REAL)            â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // Perfis de velocidade
    const SPEED_PROFILES = {
        slow: {
            name: 'ðŸ¢ Lento / InspeÃ§Ã£o (Para acompanhar com calma)',
            delayAfterModal: 2000,
            delayAfterSearch: 6000,
            delayBetweenItems: 4000,
            delayAfterImport: 4500,
            delayStep: 1500,
            pollInterval: 600,
            pollTimeout: 25000,
        },
        normal: {
            name: 'âš¡ Normal (Equilibrado)',
            delayAfterModal: 1200,
            delayAfterSearch: 4500,
            delayBetweenItems: 2500,
            delayAfterImport: 3500,
            delayStep: 800,
            pollInterval: 500,
            pollTimeout: 20000,
        },
        fast: {
            name: 'ðŸš€ RÃ¡pido / ProduÃ§Ã£o',
            delayAfterModal: 600,
            delayAfterSearch: 3500,
            delayBetweenItems: 1500,
            delayAfterImport: 2500,
            delayStep: 400,
            pollInterval: 400,
            pollTimeout: 15000,
        }
    };

    let activeSpeed = 'slow'; // ComeÃ§a em modo lento para vocÃª inspecionar com conforto!

    function getCFG() {
        return SPEED_PROFILES[activeSpeed] || SPEED_PROFILES.normal;
    }

    const CHANNELS = {
        'BRK FISHING': 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
        'BRK AGRO':    'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
        'BRK MOTORS':  'shopify-7495282216c04726834a39582e5369dd',
    };


    let _running = false;
    let _paused = false;
    let _shouldStop = false;

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  FEEDBACK VISUAL APRIMORADO                                         â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
            <span style="font-weight:800;color:#a78bfa;letter-spacing:0.5px">ðŸš€ HOOK PRIME MAGIS5</span>
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
        if (speedEl) speedEl.textContent = activeSpeed === 'slow' ? 'ðŸ¢ MODO INSPEÃ‡ÃƒO' : activeSpeed === 'fast' ? 'ðŸš€ TURBO' : 'âš¡ NORMAL';
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

    function showAction(text, emoji = 'âš¡') {
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

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  LOGGING                                                            â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function log(msg, type = 'info') {
        const el = document.getElementById('brk-import-log');
        if (!el) return;
        const ts = new Date().toLocaleTimeString('pt-BR');
        const prefix = type === 'error' ? 'âŒ' : type === 'success' ? 'âœ…' : type === 'warn' ? 'âš ï¸' : 'ðŸ“‹';
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

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  AÃ‡Ã•ES NO DOM MAGIS5                                                â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    async function visualOpenModal() {
        const cfg = getCFG();
        showAction('Abrindo modal "Baixar anÃºncio especÃ­fico"...', 'ðŸ“‚');

        // âš ï¸ A Magis5 tem 2 botÃµes com o MESMO id="generatePurchase":
        //   1Âº â†’ "Baixar anÃºncios para importaÃ§Ã£o" (ERRADO â€” sincronizaÃ§Ã£o em lote)
        //   2Âº â†’ "Baixar anÃºncio especÃ­fico" (CERTO â€” busca por ID)
        // getElementById() retorna o 1Âº, entÃ£o buscamos pelo TEXTO do botÃ£o.
        const allBtns = document.querySelectorAll('#generatePurchase, .btn-light-primary');
        let btn = null;
        for (const b of allBtns) {
            const texto = b.textContent.trim().toLowerCase();
            if (texto.includes('anÃºncio especÃ­fico') || texto.includes('anuncio especifico')) {
                btn = b;
                break;
            }
        }

        if (!btn) throw new Error('BotÃ£o "Baixar anÃºncio especÃ­fico" nÃ£o encontrado na pÃ¡gina');
        highlight(btn, '#10b981');
        await sleep(cfg.delayStep);
        btn.click();
        unhighlight(btn);
        await sleep(cfg.delayAfterModal);
    }

    /**
     * Encontra o modal "Baixar anÃºncio do marketplace" aberto.
     * âš ï¸ A Magis5 duplica IDs: #channel e #channelId existem TANTO no Filtro
     * (atrÃ¡s) quanto dentro do modal. Precisamos buscar DENTRO do modal.
     */
    function getModal() {
        return document.querySelector('#m_modal_2.show, #m_modal_2.in, #m_modal_2[style*="display: block"]')
            || document.querySelector('.modal.show, .modal.in, .modal[style*="display: block"]');
    }

    async function visualSelectChannel(channelValue, channelName) {
        const cfg = getCFG();
        showAction(`Selecionando loja: ${channelName}`, 'ðŸª');

        // âš ï¸ Busca o select DENTRO do modal (nÃ£o no filtro atrÃ¡s)
        const modal = getModal();
        const select = modal
            ? modal.querySelector('#channel, select[name="channel"]')
            : document.getElementById('channel');
        if (!select) throw new Error('Select de canal nÃ£o encontrado dentro do modal');

        highlight(select, '#3b82f6');
        await sleep(cfg.delayStep);

        // Busca a melhor opÃ§Ã£o: por value exato OU por texto contido (ex: "FISHING", "AGRO", "MOTORS")
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

            // Atualiza visual do Select2 se existir (dentro do modal)
            const searchCtx = modal || document;
            const select2Container = searchCtx.querySelector('#select2-channel-container, [aria-labelledby*="select2-channel"], .select2-selection__rendered');
            if (select2Container) {
                select2Container.textContent = targetOption.textContent;
                select2Container.title = targetOption.textContent;
                highlight(select2Container, '#3b82f6');
            }

            log(`Canal selecionado no modal: "${targetOption.textContent.trim()}" (ID: ${targetOption.value})`, 'success');
        } else {
            log(`âš ï¸ OpÃ§Ã£o para "${channelName}" nÃ£o encontrada no select do modal.`, 'warn');
        }

        await sleep(cfg.delayStep);
        unhighlight(select);
    }

    async function visualFillId(shopifyId) {
        const cfg = getCFG();
        showAction(`Preenchendo ID do AnÃºncio: ${shopifyId}`, 'ðŸ”—');

        // âš ï¸ Busca o input DENTRO do modal (nÃ£o no filtro atrÃ¡s)
        const modal = getModal();
        const input = modal
            ? modal.querySelector('#channelId, input[name="channelId"]')
            : document.getElementById('channelId');
        if (!input) throw new Error('Input channelId nÃ£o encontrado dentro do modal');
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
        showAction('Confirmando busca no Marketplace (Sim)...', 'ðŸ”');
        await sleep(cfg.delayStep);

        if (typeof window.createFindProductOnChannel === 'function') {
            window.createFindProductOnChannel();
            return;
        }

        // âš ï¸ Busca o botÃ£o "Sim" DENTRO do modal primeiro
        const modal = getModal();
        const searchCtx = modal || document;
        const btns = searchCtx.querySelectorAll('button, .btn');
        for (const btn of btns) {
            if (btn.textContent.trim() === 'Sim') {
                highlight(btn, '#10b981');
                await sleep(cfg.delayStep);
                btn.click();
                unhighlight(btn);
                return;
            }
        }
        throw new Error('BotÃ£o "Sim" nÃ£o encontrado dentro do modal');
    }

    async function waitForVariants() {
        const cfg = getCFG();
        showAction('Aguardando a Magis5 carregar as variantes...', 'â³');
        const start = Date.now();
        while (Date.now() - start < cfg.pollTimeout) {
            const inputs = getSkuInputs();
            if (inputs.length > 0) {
                showAction(`âœ… Sucesso! ${inputs.length} variantes prontas na tela.`, 'ðŸ“¦');
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
     * Define "Vendido de forma diversa" = Sim ou NÃ£o
     * @param {Element} registroEl - container da variante
     * @param {string} valor - 'sim' ou 'nÃ£o'
     */
    function setVendidoDiversa(registroEl, valor = 'sim') {
        if (!registroEl) return false;
        let select = registroEl.querySelector('select[name="isProductOnChannelLocked"]');
        if (!select) {
            const selects = registroEl.querySelectorAll('select');
            if (selects.length > 0) select = selects[selects.length - 1];
        }
        if (!select) return false;
        const target = valor.toLowerCase().replace('Ã£', 'a');
        const opt = [...select.options].find(o => {
            const txt = norm(o.textContent).toLowerCase().replace('Ã£', 'a');
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
        showAction('Marcando "Selecionar Todos"...', 'â˜‘ï¸');
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

        // â”€â”€ PASSO 1: Abrir o dropdown dos 3 pontos â”€â”€
        showAction('Abrindo menu de aÃ§Ãµes (3 pontos)...', 'â‹¯');
        let dropdownOpened = false;

        // Busca o botÃ£o dos 3 pontos (Metronic/Magis5 usa dropdown-toggle perto da Ã¡rea de importaÃ§Ã£o)
        const dropdownToggles = document.querySelectorAll(
            '[data-toggle="dropdown"], .dropdown-toggle, ' +
            'a.btn-clean.btn-icon, button.btn-clean.btn-icon, ' +
            '.btn-icon-md[data-toggle="dropdown"]'
        );
        for (const toggle of dropdownToggles) {
            // Procura o toggle que estÃ¡ prÃ³ximo ao selectAll ou na Ã¡rea de aÃ§Ãµes do produto
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

        // Fallback: tenta abrir qualquer dropdown visÃ­vel na pÃ¡gina
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

        // â”€â”€ PASSO 2: Clicar em "Importar" dentro do dropdown â”€â”€
        showAction('Clicando em "Importar"...', 'ðŸ“¥');
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
            log('âš ï¸ BotÃ£o "Importar" nÃ£o encontrado no dropdown.', 'warn');
        }

        // â”€â”€ PASSO 3: Confirmar importaÃ§Ã£o (doImport ou botÃ£o "Sim" no modal) â”€â”€
        await sleep(1200);
        showAction('Confirmando importaÃ§Ã£o...', 'âœ…');

        // Tenta chamar doImport() diretamente (mais confiÃ¡vel)
        if (typeof window.doImport === 'function') {
            highlight(document.body, '#10b981');
            await sleep(cfg.delayStep);
            window.doImport();
            unhighlight(document.body);
            log('ImportaÃ§Ã£o confirmada via doImport().', 'success');
            return;
        }

        // Fallback: busca botÃ£o "Sim" no modal de confirmaÃ§Ã£o
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
                    log('ImportaÃ§Ã£o confirmada via botÃ£o "Sim".', 'success');
                    return;
                }
            }
        }

        // Ãšltimo fallback: busca qualquer botÃ£o com onclick="doImport()"
        const doImportBtn = document.querySelector('button[onclick*="doImport"]');
        if (doImportBtn) {
            highlight(doImportBtn, '#10b981');
            await sleep(cfg.delayStep);
            doImportBtn.click();
            unhighlight(doImportBtn);
            log('ImportaÃ§Ã£o confirmada via botÃ£o onclick doImport.', 'success');
        }
    }

    function closeModals() {
        document.querySelectorAll('.modal.show .close, .modal.in .close, button[data-dismiss="modal"]').forEach(btn => {
            try { btn.click(); } catch (_) { }
        });
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  INTEGRAÃ‡ÃƒO SANKHYA â€” GM_setValue / GM_addValueChangeListener      â•‘
    // â•‘                                                                      â•‘
    // â•‘  ComunicaÃ§Ã£o cross-domain via Tampermonkey:                         â•‘
    // â•‘  1. Magis5 envia SKUs â†’ GM_setValue('brk_skus_pendentes', [...])    â•‘
    // â•‘  2. Sankhya detecta â†’ processa â†’ GM_setValue('brk_skus_resultado') â•‘
    // â•‘  3. Magis5 detecta resultado â†’ aplica cÃ³digos nos campos           â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * LÃª os SKUs das variantes na tela da Magis5 e detecta quais precisam de EAN.
     * Retorna array de { sku, precisaEan }
     */
    function readSkusFromScreen() {
        const skuInputs = getSkuInputs();
        const entries = [];
        for (const inp of skuInputs) {
            const sku = norm(inp.value);
            if (!sku) continue;
            const container = getRegistroContainer(inp);
            // Detecta se o campo EAN estÃ¡ vazio
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
        log(`ðŸ“¡ ${skuEntries.length} SKUs enviados ao Sankhya via GM_setValue`, 'info');
    }

    /**
     * Aguarda o Sankhya processar e retornar os resultados.
     * Retorna array de { sku, codigo, ean } ou null se timeout.
     */
    function waitForSankhyaResults(timeoutMs = 120000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            // Listener para mudanÃ§as no GM value
            const listenerId = GM_addValueChangeListener('brk_skus_resultado', (name, oldVal, newVal, remote) => {
                if (!remote) return; // Ignora mudanÃ§as locais
                try {
                    const result = JSON.parse(newVal);
                    if (result && result.status === 'completo' && result.pares) {
                        GM_removeValueChangeListener(listenerId);
                        clearInterval(timeoutCheck);
                        log(`ðŸ“¡ Resultado recebido do Sankhya: ${result.pares.length} pares`, 'success');
                        resolve(result.pares); // [{ sku, codigo, ean }, ...]
                    }
                } catch (e) {
                    log(`âš ï¸ Erro ao parsear resultado do Sankhya: ${e.message}`, 'warn');
                }
            });

            // Timeout check
            const timeoutCheck = setInterval(() => {
                if (Date.now() - startTime > timeoutMs) {
                    GM_removeValueChangeListener(listenerId);
                    clearInterval(timeoutCheck);
                    log(`â° Timeout aguardando Sankhya (${timeoutMs / 1000}s). Continuando sem cÃ³digos.`, 'warn');
                    resolve(null);
                }
            }, 5000);

            // Verifica se jÃ¡ tem resultado disponÃ­vel
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

            // Aplica cÃ³digo Sankhya no campo SKU
            setInputValue(input, par.codigo);
            applied++;

            // Aplica EAN se disponÃ­vel e campo estiver vazio
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

    // Limpa o canal de comunicaÃ§Ã£o ao iniciar
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

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  EXECUÃ‡ÃƒO CONTROLADA                                                â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    async function processImportQueue(onlySingle = false) {
        if (_running) { log('JÃ¡ estÃ¡ em execuÃ§Ã£o!', 'warn'); return; }
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
            items = [items[0]]; // Executa somente o primeiro anÃºncio para teste
            log(`ðŸ§ª Modo Teste: Executando apenas o 1Âº anÃºncio (ID: ${items[0].shopifyId})`, 'warn');
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
        log(`â”â”â” IMPORTAÃ‡ÃƒO INICIADA (${onlySingle ? 'TESTE 1 ITEM' : items.length + ' ITENS'}) â”â”â”`);
        log(`Velocidade: ${cfg.name}`);
        log(`Canal: ${channelName}`);

        let sucesso = 0;
        let falhas = 0;
        updateBtnState(true);

        for (let i = 0; i < items.length; i++) {
            if (_shouldStop) {
                log('â¹ Interrompido pelo usuÃ¡rio.');
                break;
            }
            while (_paused) {
                updateVisualBar('â¸ PAUSADO â€” Clique em Continuar', `${i}/${items.length}`, items[i].shopifyId);
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
                log(`${label} Abrindo modal de importaÃ§Ã£o...`);
                await visualOpenModal();

                // 3. Selecionar Canal
                updateVisualBar(`${label} 2. Selecionando Canal`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualSelectChannel(channelValue, channelName);

                // 4. Preencher ID
                updateVisualBar(`${label} 3. Preenchendo ID`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualFillId(item.shopifyId);

                // 5. Clicar Sim
                updateVisualBar(`${label} 4. Buscando AnÃºncio`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualClickSim();

                // 6. Aguardar Variantes
                updateVisualBar(`${label} 5. Carregando Variantes`, `${i + 1}/${items.length}`, item.shopifyId);
                log(`${label} Aguardando variantes carregarem...`);
                await sleep(cfg.delayAfterSearch);
                const skuInputs = await waitForVariants();
                log(`${label} ${skuInputs.length} variantes carregadas na tela.`);

                // 7. Consulta Sankhya (automÃ¡tico) ou Aplicar SKUs (manual)
                if (item.skuPairs.length > 0) {
                    // MODO MANUAL: pares jÃ¡ vieram colados no input
                    updateVisualBar(`${label} 6. Aplicando SKUs (manual)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('Aplicando SKUs manuais...', 'ðŸ”„');
                    const inputMap = new Map();
                    skuInputs.forEach(inp => inputMap.set(norm(inp.value).toUpperCase(), inp));
                    let applied = 0;
                    for (const pair of item.skuPairs) {
                        const input = inputMap.get(pair.skuAtual.toUpperCase());
                        if (input) { setInputValue(input, pair.novoSku); applied++; await sleep(250); }
                    }
                    log(`${label} ${applied}/${item.skuPairs.length} SKUs aplicados (manual).`);
                } else {
                    // MODO AUTOMÃTICO: envia SKUs ao Sankhya e aguarda resposta
                    updateVisualBar(`${label} 6a. Lendo SKUs da tela`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('Lendo SKUs das variantes para enviar ao Sankhya...', 'ðŸ“–');
                    const skuEntries = readSkusFromScreen();
                    log(`${label} ${skuEntries.length} SKUs lidos da tela.`);

                    if (skuEntries.length > 0) {
                        updateVisualBar(`${label} 6b. ðŸ“¡ Aguardando Sankhya...`, `${i + 1}/${items.length}`, item.shopifyId);
                        showAction(`Enviando ${skuEntries.length} SKUs ao Sankhya â€” aguardando resposta...`, 'ðŸ“¡');

                        // Limpa resultado anterior e envia novos SKUs
                        GM_setValue('brk_skus_resultado', '');
                        await sleep(300);
                        sendSkusToSankhya(skuEntries);

                        // Aguarda o Sankhya processar (timeout 2 min)
                        const pares = await waitForSankhyaResults(120000);

                        if (pares && pares.length > 0) {
                            updateVisualBar(`${label} 6c. Aplicando cÃ³digos Sankhya`, `${i + 1}/${items.length}`, item.shopifyId);
                            showAction(`Aplicando ${pares.length} cÃ³digos do Sankhya...`, 'âœ…');
                            const applied = applySankhyaResults(pares);
                            await sleep(cfg.delayStep);
                            log(`${label} âœ… ${applied}/${pares.length} cÃ³digos Sankhya aplicados.`, 'success');
                        } else {
                            log(`${label} âš ï¸ Sankhya nÃ£o retornou resultados. SKUs mantidos como estÃ£o.`, 'warn');
                        }
                    }
                }

                // 8. ProduÃ§Ã£o vs Revenda
                if (isProducao) {
                    // PRODUÃ‡ÃƒO: Vendido de forma diversa = Sim
                    updateVisualBar(`${label} 7. Diversa=Sim (ProduÃ§Ã£o)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('PRODUÃ‡ÃƒO: "Vendido de forma diversa" = Sim', 'ðŸ­');
                    let count = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp), 'sim')) count++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} âœ… ProduÃ§Ã£o â€” Diversa=Sim em ${count} variantes.`);
                } else {
                    // REVENDA: Vendido de forma diversa = NÃ£o + Estoque Revenda
                    updateVisualBar(`${label} 7a. Diversa=NÃ£o (Revenda)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('REVENDA: "Vendido de forma diversa" = NÃ£o', 'ðŸ”„');
                    let countDiversa = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp), 'nao')) countDiversa++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} Diversa=NÃ£o em ${countDiversa} variantes.`);

                    updateVisualBar(`${label} 7b. Estoque Revenda`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('REVENDA: Selecionando "ESTOQUE REVENDA"', 'ðŸ“¦');
                    let countEstoque = 0;
                    for (const inp of skuInputs) {
                        if (setEstoqueRevenda(inp)) countEstoque++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} âœ… Revenda â€” Estoque Revenda em ${countEstoque} variantes.`);
                }

                // 9. Selecionar Todos
                updateVisualBar(`${label} 8. Selecionando Todos`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualSelectAll();

                // 10. Importar
                updateVisualBar(`${label} 9. Importando!`, `${i + 1}/${items.length}`, item.shopifyId);
                await visualClickImport();

                sucesso++;
                showAction(`âœ… AnÃºncio ${item.shopifyId} importado com sucesso!`, 'ðŸŽ‰');
                log(`${label} âœ… Importado com sucesso!`, 'success');

                if (i < items.length - 1) {
                    updateVisualBar(`Aguardando prÃ³ximo item...`, `${i + 1}/${items.length}`, '');
                    await sleep(cfg.delayAfterImport);
                }

            } catch (err) {
                falhas++;
                showAction(`Erro: ${err.message}`, 'âŒ');
                log(`${label} Falha: ${err.message}`, 'error');
                closeModals();
                await sleep(2000);
            }
        }

        updateProgress(items.length, items.length);
        hideAction();
        removeVisualBar();
        status('Finalizado!');
        log(`â”â”â” FIM DO PROCESSO â”â”â”`);
        log(`âœ… Sucesso: ${sucesso} | âŒ Falhas: ${falhas} | Total: ${items.length}`);

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

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  UI â€” PAINEL DE CONTROLE                                            â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function buildLauncher() {
        if (document.getElementById('brk-import-launcher')) return;
        const btn = document.createElement('button');
        btn.id = 'brk-import-launcher';
        btn.innerText = 'ðŸš€ Magis5 Import';
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
                    <div style="font-weight:800;font-size:15px;color:#a78bfa">ðŸš€ Magis5 Import Autopilot v3</div>
                    <div style="font-size:11px;color:#64748b">ImportaÃ§Ã£o com Modo de InspeÃ§Ã£o Visual</div>
                </div>
                <button id="brk-import-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px">âœ•</button>
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
                    <label style="display:block;font-size:11px;color:#a78bfa;margin-bottom:6px;font-weight:700;text-transform:uppercase">â±ï¸ Velocidade de ExecuÃ§Ã£o</label>
                    <select id="brk-speed-select" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:12px;font-weight:600">
                        <option value="slow" selected>ðŸ¢ Modo Lento / InspeÃ§Ã£o (Para acompanhar com calma)</option>
                        <option value="normal">âš¡ Modo Normal (Equilibrado)</option>
                        <option value="fast">ðŸš€ Modo Turbo / RÃ¡pido (ProduÃ§Ã£o)</option>
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
                        <span>Produto de <strong style="color:#a78bfa">produÃ§Ã£o</strong></span>
                    </label>
                    <div id="brk-import-modo-info" style="font-size:11px;margin-top:6px;padding:6px 8px;border-radius:6px;background:#0f172a;color:#10b981;border:1px solid #10b98130">
                        ðŸ­ <strong>PRODUÃ‡ÃƒO</strong>: Diversa = Sim
                    </div>
                </div>

                <!-- LISTA DE IDS -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase">IDs dos AnÃºncios (Cole do Shopify Extractor)</label>
                    <textarea id="brk-import-list" rows="5" placeholder="Cole aqui os IDs da Shopify (um por linha)..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:monospace;font-size:12px;resize:vertical"></textarea>
                </div>

                <!-- BOTÃ•ES DE CONTROLE -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <button id="brk-import-single" style="background:#059669;color:#fff;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
                        ðŸ§ª Testar Apenas 1Âº AnÃºncio
                    </button>
                    <button id="brk-import-start" style="background:linear-gradient(135deg,#7F00FF,#5B21B6);color:#fff;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
                        â–¶ Importar Todos em Lote
                    </button>
                </div>

                <div style="display:flex;gap:8px">
                    <button id="brk-import-pause" disabled style="background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:12px;flex:1">â¸ Pausar</button>
                    <button id="brk-import-stop" disabled style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;font-size:12px;flex:1">â¹ Parar</button>
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
                    Hook Prime v4.2 Â· Magis5 Import v4.2 Â· Modal Fix âœ…
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
                info.innerHTML = 'ðŸ­ <strong>PRODUÃ‡ÃƒO</strong>: Diversa = Sim';
                info.style.color = '#10b981';
                info.style.borderColor = '#10b98130';
                log('Modo: PRODUÃ‡ÃƒO (Diversa=Sim)', 'info');
            } else {
                info.innerHTML = 'ðŸ“¦ <strong>REVENDA</strong>: Diversa = NÃ£o Â· Estoque = REVENDA';
                info.style.color = '#f59e0b';
                info.style.borderColor = '#f59e0b30';
                log('Modo: REVENDA (Diversa=NÃ£o + Estoque Revenda)', 'info');
            }
        };

        box.querySelector('#brk-import-pause').onclick = () => {
            _paused = !_paused;
            const btn = box.querySelector('#brk-import-pause');
            btn.textContent = _paused ? 'â–¶ Continuar' : 'â¸ Pausar';
            btn.style.background = _paused ? '#059669' : '#334155';
            log(_paused ? 'â¸ Pausado pelo usuÃ¡rio' : 'â–¶ Retomando...', 'warn');
        };

        box.querySelector('#brk-import-stop').onclick = () => {
            _shouldStop = true;
            log('â¹ Parando apÃ³s o item atual...', 'warn');
        };

        box.querySelector('#brk-import-clear-log').onclick = () => {
            document.getElementById('brk-import-log').textContent = '';
        };

        log('Painel pronto. Comece clicando em "ðŸ§ª Testar Apenas 1Âº AnÃºncio" para conferir tudo!', 'info');
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  INICIALIZAÃ‡ÃƒO                                                      â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    setTimeout(buildLauncher, 2000);

    } // fim Magis5

    // ==================================================================
    // MODULO SANKHYA -- Extrator de SKUs v8.0
    // ==================================================================

    if (_brkHost.includes('sankhya')) {

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  CONFIGURAÃ‡ÃƒO                                                       â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const CFG = {
        delaySugestoes: 1500,   // tempo para loadSuggestions() renderizar resultados
        tentativas: 3,          // tentativas de leitura por SKU
        delayEntreSKUs: 800,    // pausa entre um SKU e outro
        timeoutInput: 25000,    // timeout para achar o input na 1Âª vez
    };


    function dbg(...args) {
        console.log('%c[SKU-v7]', 'color:#a6e3a1;font-weight:bold', ...args);
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  ACESSO A IFRAMES                                                   â•‘
    // â•‘                                                                      â•‘
    // â•‘  O Sankhya usa um shell GWT no documento principal.                 â•‘
    // â•‘  Cada tela (ex: Produtos) Ã© carregada em um iframe interno.        â•‘
    // â•‘  document.querySelector() NÃƒO enxerga dentro de iframes.           â•‘
    // â•‘  Precisamos acessar iframe.contentDocument para cada iframe.       â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Retorna um array de todos os Documents acessÃ­veis:
     * o document principal + contentDocument de cada iframe same-origin.
     * Busca recursivamente (iframes dentro de iframes).
     */
    function getAllDocuments() {
        const docs = [];
        function collect(doc) {
            if (!doc) return;
            docs.push(doc);
            try {
                const iframes = doc.querySelectorAll('iframe, frame');
                for (const iframe of iframes) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            collect(iframeDoc); // recursivo para iframes aninhados
                        }
                    } catch(e) {
                        // Cross-origin â€” nÃ£o conseguimos acessar
                        dbg(`  âš  iframe cross-origin: ${iframe.src || '(sem src)'}`);
                    }
                }
            } catch(_) {}
        }
        collect(document);
        return docs;
    }

    /**
     * querySelector que busca em TODOS os documents (principal + iframes).
     * Retorna { element, doc } ou null.
     */
    function querySelectorAcrossFrames(selector) {
        for (const doc of getAllDocuments()) {
            try {
                const el = doc.querySelector(selector);
                if (el) return { element: el, doc: doc };
            } catch(_) {}
        }
        return null;
    }

    /**
     * querySelectorAll que busca em TODOS os documents (principal + iframes).
     * Retorna array de { element, doc }.
     */
    function querySelectorAllAcrossFrames(selector) {
        const results = [];
        for (const doc of getAllDocuments()) {
            try {
                const els = doc.querySelectorAll(selector);
                for (const el of els) {
                    results.push({ element: el, doc: doc });
                }
            } catch(_) {}
        }
        return results;
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  BLACKLIST                                                          â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function isInputProibido(el) {
        if (!el) return true;
        if (el.id === 'search-input-element') return true;
        const cls = (el.className || '').toLowerCase();
        if (cls.includes('gwt-textbox')) return true;
        if (cls.includes('searchapptext')) return true;
        try {
            if (el.closest('.SearchAppText')) return true;
            if (el.closest('[orig-title*="Procurar uma tela"]')) return true;
        } catch(_) {}
        return false;
    }

    function isInputVisivel(el) {
        try {
            const rect = el.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 5) return false;
            const style = (el.ownerDocument.defaultView || window).getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        } catch(_) { return false; }
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  getBuscaInput() â€” BUSCA EM TODOS OS IFRAMES                       â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function tentarLocalizarInput() {
        const seletores = [
            // NÃ­vel 1: Com pai (o mais seguro)
            'sk-pesquisa-content input.query-input',
            'sk-pesquisa-content input[ng-model="query"]',
            'sk-pesquisa-content input[scope-id="searchInput"]',
            'sk-pesquisa-content input[placeholder="Digite o que vocÃª procura"]',
            'sk-pesquisa-content input',

            // NÃ­vel 2: Atributos especÃ­ficos
            'input.query-input[ng-model="query"]',
            'input[scope-id="searchInput"]',
            'input[placeholder="Digite o que vocÃª procura"]',
            'input.query-input[ng-change="loadSuggestions()"]',
            'input.query-input',

            // NÃ­vel 3: Fallbacks
            'input[ng-change*="loadSuggestions"]',
            'input[placeholder*="que vocÃª procura"]',
        ];

        // Busca em TODOS os documents (principal + iframes)
        for (const sel of seletores) {
            const matches = querySelectorAllAcrossFrames(sel);
            for (const { element: el, doc } of matches) {
                if (isInputVisivel(el) && !isInputProibido(el)) {
                    const isIframe = doc !== document;
                    dbg(`âœ… Encontrado via: ${sel}${isIframe ? ' (DENTRO DE IFRAME)' : ''}`);
                    return el;
                }
            }
        }

        // Fallback: placeholder parcial em todos os frames
        const todosInputs = querySelectorAllAcrossFrames('input');
        for (const { element: inp } of todosInputs) {
            if (isInputProibido(inp)) continue;
            const ph = (inp.getAttribute('placeholder') || '').toLowerCase();
            if (ph.includes('procura') || ph.includes('digite')) {
                if (isInputVisivel(inp)) {
                    dbg('âœ… Encontrado via placeholder parcial (iframe scan):', ph);
                    return inp;
                }
            }
        }

        // Fallback geomÃ©trico: maior input visÃ­vel em qualquer frame
        const visiveis = todosInputs
            .filter(({ element: el }) => {
                if (isInputProibido(el)) return false;
                const type = (el.getAttribute('type') || '').toLowerCase();
                return ['', 'text', 'search'].includes(type) && isInputVisivel(el);
            })
            .sort((a, b) => {
                return b.element.getBoundingClientRect().width - a.element.getBoundingClientRect().width;
            });

        if (visiveis.length > 0) {
            dbg(`âœ… Fallback geomÃ©trico: ${visiveis.length} input(s) em iframes`);
            return visiveis[0].element;
        }

        return null;
    }

    function getBuscaInput() {
        return new Promise((resolve, reject) => {
            const inicio = Date.now();
            let tentativa = 0;
            let intervalId = null;
            let resolvido = false;

            function tentar() {
                if (resolvido) return;
                tentativa++;
                dbg(`â”€â”€ Tentativa #${tentativa} (${Date.now() - inicio}ms) â”€â”€`);

                const input = tentarLocalizarInput();
                if (input) {
                    resolvido = true;
                    if (intervalId) clearInterval(intervalId);
                    try { input.style.outline = '3px solid #10b981'; } catch(_) {}
                    resolve(input);
                    return;
                }

                if (Date.now() - inicio > CFG.timeoutInput) {
                    resolvido = true;
                    if (intervalId) clearInterval(intervalId);
                    reject(new Error('Input nÃ£o encontrado apÃ³s ' + (CFG.timeoutInput / 1000) + 's'));
                }
            }

            tentar();
            if (!resolvido) {
                intervalId = setInterval(tentar, 2000);
            }
        });
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  INJEÃ‡ÃƒO DE TEXTO                                                   â•‘
    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  â›” DIRETRIZ DE SEGURANÃ‡A â€” SOMENTE LEITURA                        â•‘
    // â•‘                                                                      â•‘
    // â•‘  Este script NÃƒO PODE em hipÃ³tese alguma:                           â•‘
    // â•‘  â€¢ Disparar eventos de teclado (Enter, keydown, keypress, keyup)    â•‘
    // â•‘  â€¢ Disparar eventos de mouse (click, mousedown, mouseup)            â•‘
    // â•‘  â€¢ Disparar eventos DOM (input, change, submit, focus)              â•‘
    // â•‘  â€¢ Chamar dispatchEvent() em qualquer elemento                      â•‘
    // â•‘  â€¢ Chamar triggerHandler() do AngularJS                             â•‘
    // â•‘  â€¢ Chamar onKeydown(), onSelectData() ou qualquer handler           â•‘
    // â•‘  â€¢ Abrir, editar, ou navegar para qualquer produto                  â•‘
    // â•‘                                                                      â•‘
    // â•‘  A ÃšNICA operaÃ§Ã£o permitida Ã©:                                      â•‘
    // â•‘  1. scope.query = "SKU"  (define o texto da busca)                  â•‘
    // â•‘  2. scope.loadSuggestions()  (carrega sugestÃµes)                    â•‘
    // â•‘  3. scope.$digest()  (atualiza a view)                              â•‘
    // â•‘  4. LER o texto dos resultados (innerText)                          â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Injeta o texto da pesquisa de forma SEGURA usando apenas
     * o scope AngularJS. NÃ£o dispara NENHUM evento DOM.
     *
     * EstratÃ©gias (em ordem de prioridade):
     *   1. scope.query + scope.loadSuggestions() â€” via AngularJS direto
     *   2. input.value = texto (fallback se scope nÃ£o existir)
     */
    function injetarTextoSeguro(input, texto) {
        dbg(`ðŸ“ Injetando (modo seguro): "${texto}"`);

        let sucesso = false;

        // â”€â”€ EstratÃ©gia 1: Via AngularJS scope (preferida) â”€â”€
        try {
            const win = input.ownerDocument.defaultView || window;
            if (win.angular) {
                const ngEl = win.angular.element(input);
                const scope = ngEl.scope();
                if (scope) {
                    // Define o modelo diretamente â€” sem eventos DOM
                    scope.query = texto;

                    // Chama loadSuggestions para exibir resultados
                    if (typeof scope.loadSuggestions === 'function') {
                        scope.loadSuggestions();
                        dbg('  â†’ scope.query + loadSuggestions(): OK');
                    }

                    // Atualiza a view (renderiza o texto no input)
                    try { scope.$digest(); } catch(_) {
                        try { scope.$apply(); } catch(_2) {}
                    }

                    sucesso = true;
                }
            }
        } catch(e) {
            dbg('  â†’ scope falhou:', e.message);
        }

        // â”€â”€ EstratÃ©gia 2: Fallback puro (sÃ³ altera o valor visual) â”€â”€
        if (!sucesso) {
            try {
                const win = input.ownerDocument.defaultView || window;
                const descriptor = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(input, texto);
                } else {
                    input.value = texto;
                }
                dbg('  â†’ Fallback input.value: OK (sem eventos)');
            } catch(e) {
                input.value = texto;
                dbg('  â†’ Fallback direto: OK');
            }
        }

        dbg('  âœ… Texto injetado (nenhum evento DOM disparado)');
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  EXTRAÃ‡ÃƒO DO CÃ“DIGO SANKHYA                                         â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Extrai o cÃ³digo Sankhya para um SKU especÃ­fico.
     * Tenta MULTIPLOS padrÃµes porque o innerText pode variar:
     *   - "75679 - HYB082PP - CAMISA..."  (tudo numa linha)
     *   - "75679\nHYB082PP - CAMISA..."   (cÃ³digo em linha separada)
     *   - "75679 HYB082PP"                (sem hÃ­fen)
     *   - texto com vÃ¡rios resultados
     */
    function extrairCodigoParaSku(sku, texto) {
        const skuEsc = escapeRegex(sku.toUpperCase().trim());
        const textoNorm = texto.toUpperCase();

        // (?![A-Za-z0-9]) = negative lookahead impede match parcial:
        //   HYB076G != HYB076GG != HYB076G1 != HYB076G2
        const borda = '(?![A-Za-z0-9])';

        // PadrÃ£o 1: cÃ³digo - SKU  (ex: "75679 - HYB082PP")
        let m = new RegExp('(\\d{2,})\\s*[-â€“â€”]\\s*' + skuEsc + borda, 'gm').exec(textoNorm);
        if (m) return m[1];

        // PadrÃ£o 2: cÃ³digo + espaÃ§o/quebra + SKU (ex: "75679\nHYB082PP")
        m = new RegExp('(\\d{2,})[\\s\\n]+' + skuEsc + borda, 'gm').exec(textoNorm);
        if (m) return m[1];

        // PadrÃµes frouxos REMOVIDOS: causavam contaminaÃ§Ã£o entre SKUs similares

        return null;
    }

    /**
     * EXTRAÃ‡ÃƒO DE EAN VIA DOM â€” busca diretamente os elementos HTML.
     * Procura <p class="entity-field"> com "ReferÃªncia:" e o <span> com o valor.
     * Garante que pertence ao mesmo "card" do produto com o SKU correto.
     */
    function extrairEanDOM(sku, container) {
        const skuUpper = sku.toUpperCase().trim();
        const skuEsc = escapeRegex(skuUpper);
        const skuRegex = new RegExp('(?<![A-Za-z0-9])' + skuEsc + '(?![A-Za-z0-9])');

        // EstratÃ©gia 1: buscar por <p class="entity-field"> com "ReferÃªncia"
        const candidatos = container.querySelectorAll(
            'p.entity-field, .entity-field, [class*="entity-field"]'
        );
        for (const field of candidatos) {
            const fieldText = field.textContent || '';
            if (!/refer[eÃª]ncia/i.test(fieldText)) continue;

            // Extrair o EAN do span filho
            const span = field.querySelector('span');
            let ean = '';
            if (span) {
                const val = span.textContent.trim();
                if (/^\d{8,14}$/.test(val)) ean = val;
            }
            if (!ean) {
                const m = fieldText.match(/(\d{8,14})/);
                if (m) ean = m[1];
            }
            if (!ean) continue;

            // Subir na Ã¡rvore DOM atÃ© achar ancestral que contenha o SKU
            let parent = field.parentElement;
            for (let d = 0; d < 12 && parent && parent !== container; d++) {
                const pText = (parent.innerText || '').toUpperCase();
                if (skuRegex.test(pText)) {
                    dbg(`  ðŸ” EAN DOM: ${ean} (entity-field, depth=${d})`);
                    return ean;
                }
                parent = parent.parentElement;
            }
        }

        // EstratÃ©gia 2: buscar spans com ng-bind-html contendo sÃ³ dÃ­gitos
        const spans = container.querySelectorAll(
            'span[ng-bind-html], span[ng-bind-html="field.value"]'
        );
        for (const span of spans) {
            const val = span.textContent.trim();
            if (!/^\d{8,14}$/.test(val)) continue;

            const parentP = span.closest('p, div, td');
            if (!parentP || !/refer[eÃª]ncia/i.test(parentP.textContent)) continue;

            let ancestor = parentP.parentElement;
            for (let d = 0; d < 12 && ancestor && ancestor !== container; d++) {
                const aText = (ancestor.innerText || '').toUpperCase();
                if (skuRegex.test(aText)) {
                    dbg(`  ðŸ” EAN DOM: ${val} (ng-bind-html, depth=${d})`);
                    return val;
                }
                ancestor = ancestor.parentElement;
            }
        }

        return '';
    }

    /**
     * EXTRAÃ‡ÃƒO DE EAN VIA TEXTO â€” fallback quando DOM nÃ£o funciona.
     * Testa TODAS as ocorrÃªncias do SKU no texto (pula a barra de busca).
     */
    function extrairEanTexto(sku, texto) {
        const skuEsc = escapeRegex(sku.toUpperCase().trim());
        const textoNorm = texto.toUpperCase();

        const skuRegex = new RegExp('(?<![A-Za-z0-9])' + skuEsc + '(?![A-Za-z0-9])', 'gi');
        const matches = [...textoNorm.matchAll(skuRegex)];

        for (const match of matches) {
            const posSkuFim = match.index + match[0].length;
            const blocoApos = textoNorm.substring(posSkuFim, posSkuFim + 500);
            const refMatch = blocoApos.match(/REFER[\u00caE]NCIA:?\s*(\d{8,14})/);
            if (refMatch) {
                dbg(`  ðŸ” EAN texto: ${refMatch[1]} (pos=${posSkuFim})`);
                return refMatch[1];
            }
        }

        return '';
    }

    /**
     * Busca o cÃ³digo + EAN em TODOS os documents (principal + iframes).
     * Usa extraÃ§Ã£o DOM (primÃ¡ria) + texto (fallback) para o EAN.
     * Retorna { codigo, ean } ou null.
     */
    function extrairDadosDeep(sku) {
        for (const doc of getAllDocuments()) {
            try {
                const containers = doc.querySelectorAll(
                    'sk-pesquisa-content, .sk-pesquisa-result-container, .sk-pesquisa-search-container'
                );
                for (const c of containers) {
                    const texto = c.innerText || '';
                    const codigo = extrairCodigoParaSku(sku, texto);
                    if (codigo) {
                        const ean = extrairEanDOM(sku, c) || extrairEanTexto(sku, texto);
                        dbg(`  CÃ³digo ${codigo} + EAN ${ean || '(vazio)'} em <${c.tagName.toLowerCase()}>`);
                        return { codigo, ean };
                    }
                }

                const texto = doc.body?.innerText || '';
                const codigo = extrairCodigoParaSku(sku, texto);
                if (codigo) {
                    const ean = extrairEanDOM(sku, doc.body) || extrairEanTexto(sku, texto);
                    dbg(`  CÃ³digo ${codigo} + EAN ${ean || '(vazio)'} no body`);
                    return { codigo, ean };
                }
            } catch(_) {}
        }
        return null;
    }

    /**
     * Debug: mostra o texto bruto ao redor do SKU para entender o formato.
     */
    function debugExtracaoSku(sku) {
        const res = [];
        const skuUpper = sku.toUpperCase().trim();
        res.push(`\nðŸ” Debug extraÃ§Ã£o para: "${sku}"`);

        for (const doc of getAllDocuments()) {
            const label = doc === document ? 'Principal' : 'Iframe';
            try {
                // Busca no container de resultados
                const containers = doc.querySelectorAll(
                    'sk-pesquisa-content, .sk-pesquisa-result-container'
                );
                for (const c of containers) {
                    const texto = (c.innerText || '').toUpperCase();
                    const idx = texto.indexOf(skuUpper);
                    if (idx >= 0) {
                        // Mostra 80 chars ao redor do SKU
                        const start = Math.max(0, idx - 40);
                        const end = Math.min(texto.length, idx + skuUpper.length + 40);
                        const trecho = texto.substring(start, end).replace(/\n/g, 'â†µ');
                        res.push(`  âœ… ${label} <${c.tagName.toLowerCase()}>:`);
                        res.push(`     "...${trecho}..."`);
                    }
                }

                // Busca no body
                const body = (doc.body?.innerText || '').toUpperCase();
                const idx = body.indexOf(skuUpper);
                if (idx >= 0) {
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(body.length, idx + skuUpper.length + 40);
                    const trecho = body.substring(start, end).replace(/\n/g, 'â†µ');
                    res.push(`  âœ… ${label} <body>:`);
                    res.push(`     "...${trecho}..."`);

                    // Tenta extrair
                    const codigo = extrairCodigoParaSku(sku, body);
                    res.push(`  â†’ Regex result: ${codigo || 'âŒ nenhum match'}`);
                } else {
                    res.push(`  âŒ ${label}: SKU "${sku}" nÃ£o encontrado no innerText`);
                }
            } catch(e) {
                res.push(`  â›” ${label}: ${e.message}`);
            }
        }

        return res.join('\n');
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  PESQUISA RÃPIDA â€” digita, lÃª sugestÃ£o, prÃ³ximo                     â•‘
    // â•‘                                                                      â•‘
    // â•‘  Fluxo: digitar SKU â†’ aguardar sugestÃµes â†’ ler cÃ³digo â†’ limpar     â•‘
    // â•‘  NÃƒO pressiona Enter (Enter abre o produto).                       â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    let inputCacheado = null;

    /**
     * Pesquisa um SKU e retorna o cÃ³digo Sankhya + EAN.
     * @returns {{codigo: string, ean: string}|null}
     */
    async function pesquisarSku(sku) {
        if (inputCacheado) {
            try {
                const rect = inputCacheado.getBoundingClientRect();
                const ownerDoc = inputCacheado.ownerDocument;
                if (rect.width === 0 || !ownerDoc.contains(inputCacheado)) {
                    dbg('âš  Input cacheado invÃ¡lido');
                    inputCacheado = null;
                }
            } catch(_) {
                inputCacheado = null;
            }
        }

        if (!inputCacheado) {
            inputCacheado = await getBuscaInput();
        }

        const input = inputCacheado;
        injetarTextoSeguro(input, sku);

        for (let t = 1; t <= CFG.tentativas; t++) {
            await sleep(CFG.delaySugestoes);
            const dados = extrairDadosDeep(sku);
            if (dados) {
                dbg(`  âœ… ${sku} â†’ ${dados.codigo} | EAN: ${dados.ean || '(vazio)'}`);
                return dados;
            }
            dbg(`   Tentativa ${t}/${CFG.tentativas} â€” sugestÃµes nÃ£o apareceram...`);
        }

        return null;
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  DIAGNÃ“STICO                                                        â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function diagnosticarParaPainel() {
        const res = [];

        // Listar iframes
        const docs = getAllDocuments();
        res.push(`ðŸ“„ Documents acessÃ­veis: ${docs.length} (1 principal + ${docs.length - 1} iframe(s))`);

        // Listar iframes encontrados
        try {
            const iframes = document.querySelectorAll('iframe, frame');
            res.push(`ðŸ–¼ Iframes no doc principal: ${iframes.length}`);
            iframes.forEach((iframe, i) => {
                let acessivel = false;
                let url = '';
                try {
                    const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    acessivel = !!iDoc;
                    url = iframe.src || iframe.contentWindow?.location?.href || '(sem src)';
                } catch(e) {
                    url = iframe.src || '(cross-origin)';
                }
                const r = iframe.getBoundingClientRect();
                res.push(
                    `  [${i}] ${acessivel ? 'âœ…' : 'âŒ'} size=${Math.round(r.width)}x${Math.round(r.height)} ` +
                    `src="${url.substring(0, 60)}"`
                );
            });
        } catch(_) {}

        // Inputs em CADA document
        res.push('');
        res.push('â”€â”€ Inputs por documento â”€â”€');
        docs.forEach((doc, di) => {
            const label = di === 0 ? 'Principal' : `Iframe #${di}`;
            try {
                const inputs = doc.querySelectorAll('input');
                res.push(`  ðŸ“„ ${label}: ${inputs.length} input(s)`);
                inputs.forEach((inp, i) => {
                    const r = inp.getBoundingClientRect();
                    const vis = r.width > 0 && r.height > 0;
                    const isGWT = inp.id === 'search-input-element' || (inp.className || '').includes('gwt');
                    res.push(
                        `    [${i}] ${vis ? 'âœ…' : 'âŒ'} ${isGWT ? 'ðŸš« GWT' : ''} ` +
                        `class="${(inp.className || '').substring(0, 30)}" ` +
                        `ph="${(inp.placeholder || '').substring(0, 25)}" ` +
                        `ng-model="${inp.getAttribute('ng-model') || ''}" ` +
                        `size=${Math.round(r.width)}x${Math.round(r.height)}`
                    );
                });
            } catch(e) {
                res.push(`  ðŸ“„ ${label}: â›” ${e.message}`);
            }
        });

        // Teste de seletores (em todos os frames)
        res.push('');
        res.push('â”€â”€ Teste de seletores (cross-frame) â”€â”€');
        const seletoresTest = [
            'sk-pesquisa-content input.query-input',
            'sk-pesquisa-content input',
            'input.query-input[ng-model="query"]',
            'input[scope-id="searchInput"]',
            'input[placeholder="Digite o que vocÃª procura"]',
        ];
        for (const sel of seletoresTest) {
            const match = querySelectorAcrossFrames(sel);
            if (match) {
                const isIframe = match.doc !== document;
                res.push(`  âœ… ${sel} â†’ ENCONTRADO${isIframe ? ' (em IFRAME!)' : ''}`);
            } else {
                res.push(`  âŒ ${sel} â†’ nÃ£o encontrado`);
            }
        }

        // sk-pesquisa-content em algum frame?
        res.push('');
        const skMatch = querySelectorAcrossFrames('sk-pesquisa-content');
        res.push(`â”€â”€ sk-pesquisa-content: ${skMatch ? 'âœ… ENCONTRADO' + (skMatch.doc !== document ? ' (IFRAME)' : '') : 'âŒ NÃƒO ENCONTRADO'} â”€â”€`);
        if (skMatch) {
            const innerInputs = skMatch.element.querySelectorAll('input');
            res.push(`  Inputs dentro: ${innerInputs.length}`);
            innerInputs.forEach((inp, i) => {
                res.push(`    [${i}] class="${inp.className}" ph="${inp.placeholder || ''}"`);
            });
        }

        // AngularJS (no iframe, nÃ£o no principal)
        res.push('');
        res.push('â”€â”€ AngularJS â”€â”€');
        docs.forEach((doc, di) => {
            const label = di === 0 ? 'Principal' : `Iframe #${di}`;
            try {
                const win = doc.defaultView || window;
                res.push(`  ${label}: angular ${win.angular ? 'âœ…' : 'âŒ'}`);
            } catch(_) {
                res.push(`  ${label}: â›” acesso negado`);
            }
        });

        const inp = tentarLocalizarInput();
        if (inp) {
            res.push(`  Input selecionado: class="${(inp.className || '').substring(0, 40)}"`);
            try {
                const win = inp.ownerDocument.defaultView || window;
                if (win.angular) {
                    const scope = win.angular.element(inp).scope();
                    res.push(`  scope: ${scope ? 'âœ…' : 'âŒ'}`);
                    if (scope) {
                        res.push(`  scope.query: "${scope.query || '(vazio)'}"`);
                        res.push(`  scope.onKeydown: ${typeof scope.onKeydown === 'function' ? 'âœ…' : 'âŒ'}`);
                        res.push(`  scope.loadSuggestions: ${typeof scope.loadSuggestions === 'function' ? 'âœ…' : 'âŒ'}`);
                    }
                }
            } catch(e) {
                res.push(`  scope: â›” ${e.message}`);
            }
        } else {
            res.push('  â›” Nenhum input vÃ¡lido encontrado');
        }

        return res.join('\n');
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  UI â€” PAINEL                                                        â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function buildLauncher() {
        if (document.getElementById('brk-sankhya-launcher')) return;
        const btn = document.createElement('button');
        btn.id = 'brk-sankhya-launcher';
        btn.innerText = 'ðŸŽ£ Abrir Painel Sankhya';
        btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:999998;background:#2563eb;color:#fff;border:none;padding:10px 15px;border-radius:8px;font-weight:bold;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,0.3);';
        btn.onclick = () => {
            if (!document.getElementById('brk-sankhya-lote-panel')) buildPanel();
        };
        document.body.appendChild(btn);
    }

    function buildPanel() {
        const box = document.createElement('div');
        box.id = 'brk-sankhya-lote-panel';
        box.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#111827;color:#fff;width:560px;max-height:86vh;overflow:auto;border-radius:14px;border:1px solid #374151;box-shadow:0 10px 30px rgba(0,0,0,.35);font:13px/1.45 Arial,sans-serif';
        box.innerHTML = `
          <div style="padding:12px 14px;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center;background:#111827;position:sticky;top:0;">
            <div>
              <div style="font-weight:700">Sankhya Extrator v7.1 (somente leitura)</div>
              <div style="font-size:12px;color:#9ca3af">Pesquisa â†’ LÃª cÃ³digo â†’ PrÃ³ximo (sem abrir produto)</div>
            </div>
            <button id="brk-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:bold;">X</button>
          </div>
          <div style="padding:12px 14px;display:grid;gap:10px;">
            <div id="brk-status" style="color:#10b981;font-weight:bold;">Pronto para iniciar!</div>
            <div>
              <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:4px">Lista de SKUs (um por linha)</label>
              <textarea id="brk-skus" rows="6" placeholder="Cole aqui os SKUs do Magis5" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#fff"></textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button id="brk-processar" style="background:#059669;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">â–¶ Processar lista</button>
              <button id="brk-diagnostico" style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">ðŸ©º Diagnosticar</button>
              <button id="brk-debug-extracao" style="background:#d97706;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">ðŸ” Debug ExtraÃ§Ã£o</button>
              <button id="brk-copy-pares" style="background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">Copiar pares</button>
              <button id="brk-copy-nao" style="background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">Copiar nÃ£o encontrados</button>
            </div>
            <div>
              <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:4px">Resultado (SKU â†’ CÃ³digo â†’ EAN)</label>
              <textarea id="brk-pares" rows="5" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#fff"></textarea>
            </div>
            <div id="brk-log" style="background:#0b1220;border-radius:10px;padding:10px;max-height:30vh;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;"></div>
          </div>`;
        document.body.appendChild(box);

        box.querySelector('#brk-close').onclick = () => box.remove();
        box.querySelector('#brk-processar').onclick = processarLista;
        box.querySelector('#brk-diagnostico').onclick = () => {
            log('ðŸ©º Executando diagnÃ³stico (incluindo iframes)...');
            const resultado = diagnosticarParaPainel();
            log(resultado);
            status('DiagnÃ³stico concluÃ­do.');
        };
        box.querySelector('#brk-debug-extracao').onclick = () => {
            const skusTxt = document.getElementById('brk-skus').value;
            const primeiroSku = (skusTxt.split('\n').map(norm).filter(Boolean))[0];
            if (!primeiroSku) {
                log('âš  Cole pelo menos 1 SKU na lista para debugar.');
                return;
            }
            log(`ðŸ” Debugando extraÃ§Ã£o do SKU: "${primeiroSku}"...`);
            log('(O SKU deve estar visÃ­vel nos resultados da tela)');
            const debug = debugExtracaoSku(primeiroSku);
            log(debug);
            status('Debug de extraÃ§Ã£o concluÃ­do.');
        };
        box.querySelector('#brk-copy-pares').onclick = async () => {
            await navigator.clipboard.writeText(document.getElementById('brk-pares').value);
            status('Pares copiados!'); log('ðŸ“‹ Pares copiados.');
        };
        box.querySelector('#brk-copy-nao').onclick = async () => {
            await navigator.clipboard.writeText(naoEncontrados.join('\n'));
            status('NÃ£o encontrados copiados!'); log('ðŸ“‹ NÃ£o encontrados copiados.');
        };
    }

    let naoEncontrados = [];

    function status(t) {
        const el = document.getElementById('brk-status');
        if (el) el.textContent = t;
    }
    function log(t) {
        const el = document.getElementById('brk-log');
        if (!el) return;
        el.textContent += (el.textContent ? '\n' : '') + t;
        el.scrollTop = el.scrollHeight;
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  LOOP PRINCIPAL                                                     â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    async function processarLista() {
        naoEncontrados = [];
        inputCacheado = null;
        const skusEl = document.getElementById('brk-skus');
        const paresEl = document.getElementById('brk-pares');

        const skusRaw = skusEl.value.split('\n').map(norm).filter(Boolean);
        if (skusRaw.length === 0) {
            status('âš  Cole pelo menos um SKU na lista.');
            return;
        }

        // Parsear linhas: detectar marcador [SEM_EAN] do Magis5
        // Formato: "SKU" (tem EAN) ou "SKU\t[SEM_EAN]" (precisa de EAN)
        const skuEntradas = skusRaw.map(linha => {
            const parts = linha.split(/\t+/);
            const sku = norm(parts[0]);
            const precisaEan = (parts[1] || '').toUpperCase().includes('SEM_EAN');
            return { sku, precisaEan };
        }).filter(e => e.sku);

        const totalPrecisaEan = skuEntradas.filter(e => e.precisaEan).length;

        const pares = [];
        status(`Processando ${skuEntradas.length} SKU(s)...`);
        log(`\nâ”â”â” INICIANDO v7.2 (iframe + EAN) â”â”â”`);
        log(`ðŸ“„ Documents disponÃ­veis: ${getAllDocuments().length}`);
        log(`ðŸ“¦ ${skuEntradas.length - totalPrecisaEan} SKUs com EAN (sÃ³ cÃ³digo)`);
        log(`ðŸ”´ ${totalPrecisaEan} SKUs sem EAN (cÃ³digo + referÃªncia)`);

        try {
            log('ðŸ” Localizando barra de pesquisa (cross-frame)...');
            inputCacheado = await getBuscaInput();
            const inp = inputCacheado;
            const isIframe = inp.ownerDocument !== document;
            log(`âœ… Barra encontrada! ${isIframe ? 'ðŸ“Œ DENTRO DE IFRAME' : 'ðŸ“Œ documento principal'}`);
            log(`   class="${(inp.className || '').substring(0, 50)}"`);
            log(`   placeholder="${inp.placeholder || ''}"`);
        } catch(e) {
            log(`â›” ${e.message}`);
            log('ðŸ’¡ Clique em "ðŸ©º Diagnosticar" para ver iframes e inputs.');
            status('Erro: Input nÃ£o encontrado.');
            return;
        }

        let eansExtraidos = 0;

        for (let i = 0; i < skuEntradas.length; i++) {
            const { sku, precisaEan } = skuEntradas[i];
            status(`[${i+1}/${skuEntradas.length}] ${sku}${precisaEan ? ' ðŸ”´' : ''}`);

            try {
                const dados = await pesquisarSku(sku);
                if (dados) {
                    // SÃ³ inclui EAN no resultado se o Magis5 marcou [SEM_EAN]
                    if (precisaEan && dados.ean) {
                        pares.push(`${sku}\t${dados.codigo}\t${dados.ean}`);
                        log(`âœ… ${sku} â†’ ${dados.codigo} | ðŸ”´ EAN: ${dados.ean}`);
                        eansExtraidos++;
                    } else {
                        pares.push(`${sku}\t${dados.codigo}`);
                        const motivo = precisaEan ? ' | âš  EAN nÃ£o encontrado no Sankhya' : '';
                        log(`âœ… ${sku} â†’ ${dados.codigo}${motivo}`);
                    }
                    paresEl.value = pares.join('\n');
                } else {
                    naoEncontrados.push(sku);
                    log(`âš ï¸ ${sku} â†’ nÃ£o encontrado`);
                }
            } catch(e) {
                naoEncontrados.push(sku);
                log(`â›” ERRO em "${sku}": ${e.message}`);
                inputCacheado = null;
                try {
                    log('ðŸ”„ Re-buscando input...');
                    inputCacheado = await getBuscaInput();
                    log('âœ… Input re-encontrado.');
                } catch(e2) {
                    log(`â›” Falha crÃ­tica: ${e2.message}`);
                    break;
                }
            }

            if (i < skuEntradas.length - 1) await sleep(CFG.delayEntreSKUs);
        }

        paresEl.value = pares.join('\n');
        status(`Finalizado! âœ… ${pares.length} | âš  ${naoEncontrados.length} | ðŸ”´ ${eansExtraidos} EANs`);
        log(`\nâ”â”â” FIM â”â”â”`);
        log(`âœ… CÃ³digos encontrados: ${pares.length}`);
        log(`ðŸ”´ EANs extraÃ­dos: ${eansExtraidos} de ${totalPrecisaEan} necessÃ¡rios`);
        log(`âš  SKUs sem resultado: ${naoEncontrados.length}`);
        if (pares.length > 0) {
            log(`ðŸ“‹ Clique "Copiar pares" para colar no Magis5`);
        }
    }

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  INTEGRAÃ‡ÃƒO AUTOMÃTICA COM MAGIS5 (GM_setValue)                     â•‘
    // â•‘                                                                      â•‘
    // â•‘  Escuta 'brk_skus_pendentes' enviado pelo Import Autopilot.         â•‘
    // â•‘  Processa automaticamente usando pesquisarSku() (mesma lÃ³gica).     â•‘
    // â•‘  Retorna resultados via 'brk_skus_resultado'.                       â•‘
    // â•‘                                                                      â•‘
    // â•‘  O painel manual continua funcionando normalmente.                  â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    async function processarListaAutomatica(skuEntries) {
        log('\nâ”â”â” MODO AUTOMÃTICO (via Magis5 Import) â”â”â”');
        log(`ðŸ“¡ Recebidos ${skuEntries.length} SKUs para processar.`);
        status(`ðŸ¤– Auto: Processando ${skuEntries.length} SKUs...`);

        inputCacheado = null;

        try {
            inputCacheado = await getBuscaInput();
            log('âœ… Barra de pesquisa encontrada.');
        } catch(e) {
            log(`â›” ${e.message}`);
            GM_setValue('brk_skus_resultado', JSON.stringify({
                timestamp: Date.now(), status: 'erro',
                mensagem: 'Input de pesquisa nÃ£o encontrado no Sankhya'
            }));
            return;
        }

        const pares = [];

        for (let i = 0; i < skuEntries.length; i++) {
            const entry = skuEntries[i];
            const sku = entry.sku;
            status(`ðŸ¤– [${i+1}/${skuEntries.length}] ${sku}`);

            try {
                const dados = await pesquisarSku(sku);
                if (dados) {
                    pares.push({
                        sku: sku,
                        codigo: dados.codigo,
                        ean: (entry.precisaEan && dados.ean) ? dados.ean : ''
                    });
                    log(`âœ… ${sku} â†’ ${dados.codigo}${dados.ean ? ' | EAN: ' + dados.ean : ''}`);
                } else {
                    log(`âš ï¸ ${sku} â†’ nÃ£o encontrado`);
                }
            } catch(e) {
                log(`â›” ERRO em "${sku}": ${e.message}`);
                inputCacheado = null;
                try {
                    inputCacheado = await getBuscaInput();
                } catch(_) { break; }
            }

            if (i < skuEntries.length - 1) await sleep(CFG.delayEntreSKUs);
        }

        // Envia resultado de volta para o Magis5
        const resultado = {
            timestamp: Date.now(),
            status: 'completo',
            pares: pares,
            total: skuEntries.length,
            encontrados: pares.length
        };
        GM_setValue('brk_skus_resultado', JSON.stringify(resultado));

        log(`\nâ”â”â” AUTOMÃTICO FINALIZADO â”â”â”`);
        log(`âœ… Encontrados: ${pares.length} | âš  NÃ£o encontrados: ${skuEntries.length - pares.length}`);
        log(`ðŸ“¡ Resultado enviado ao Magis5.`);
        status(`ðŸ¤– Auto: âœ… ${pares.length}/${skuEntries.length} enviados ao Magis5`);
    }

    // â”€â”€ Listener para receber SKUs do Magis5 â”€â”€
    GM_addValueChangeListener('brk_skus_pendentes', (name, oldVal, newVal, remote) => {
        if (!remote) return; // Ignora mudanÃ§as locais
        if (!newVal) return;

        try {
            const payload = JSON.parse(newVal);
            if (payload && payload.status === 'pendente' && payload.skus && payload.skus.length > 0) {
                log(`\nðŸ“¡ SKUs recebidos do Magis5 Import (${payload.skus.length} itens)`);
                processarListaAutomatica(payload.skus);
            }
        } catch(e) {
            log(`âš ï¸ Erro ao processar payload do Magis5: ${e.message}`);
        }
    });

    log('ðŸ”— Listener Magis5 ativado â€” aguardando SKUs automÃ¡ticos.');

    // â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
    // â•‘  INICIALIZAÃ‡ÃƒO                                                      â•‘
    // â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    setTimeout(buildLauncher, 2000);

    } // fim Sankhya

})();

