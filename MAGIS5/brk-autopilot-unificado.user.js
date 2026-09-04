// ==UserScript==
// @name         BRK Autopilot Unificado - Magis5 + Sankhya
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  Script unificado: Import Autopilot Multi-Canal + Auto-Detecção Tipo + Extrator SKU (Sankhya) com GM_setValue compartilhado
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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  MÓDULO MAGIS5 - Import Autopilot v6.0 (Multi-Canal + Auto-Detect)   ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    if (_brkHost.includes('magis5')) {



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
        // Amazon
        '🛒 Amazon — USEBRK':              'amazon-550c5247c30e4eb9a5710d5853f2bb43',
        // Mercado Livre
        '🟡 ML — BRK COMERCIO':            'ml-594c421a091a4546b9dda6762771322e',
        '🟡 ML — BRK FILIAL (Oficial)':     'ml-738289f2b87f4f0892558d591454f31d',
        '🟡 ML — BRK MATRIZ':              'ml-47da6d90fc2f489c9f7d0acc61ca458c',
        // Shopee
        '🟠 Shopee — BRK AGRO':            'shopee-d19e97cdeba849399f2a3bf04cf7cf2b',
        '🟠 Shopee — BRK FILIAL':          'shopee-1b953452d1e74475bd27492dba97f98a',
        // Shopify
        '🟢 Shopify — BRK AGRO':           'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
        '🟢 Shopify — BRK FISHING':        'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
        '🟢 Shopify — BRK MOTORS':         'shopify-7495282216c04726834a39582e5369dd',
        // TikTok
        '🎵 TikTok — BRK FILIAL':          'tiktok-5b3145553c2b4984ac9a98e2d4ccc3a1',
    };


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

    /**
     * Encontra o modal "Baixar anúncio do marketplace" aberto.
     * ⚠️ A Magis5 duplica IDs: #channel e #channelId existem TANTO no Filtro
     * (atrás) quanto dentro do modal. Precisamos buscar DENTRO do modal.
     */
    function getModal() {
        return document.querySelector('#m_modal_2.show, #m_modal_2.in, #m_modal_2[style*="display: block"]')
            || document.querySelector('.modal.show, .modal.in, .modal[style*="display: block"]');
    }

    async function visualSelectChannel(channelValue, channelName) {
        const cfg = getCFG();
        showAction(`Selecionando loja: ${channelName}`, '🏪');

        // ⚠️ Busca o select DENTRO do modal (não no filtro atrás)
        const modal = getModal();
        const select = modal
            ? modal.querySelector('#channel, select[name="channel"]')
            : document.getElementById('channel');
        if (!select) throw new Error('Select de canal não encontrado dentro do modal');

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
            log(`⚠️ Opção para "${channelName}" não encontrada no select do modal.`, 'warn');
        }

        await sleep(cfg.delayStep);
        unhighlight(select);
    }

    async function visualFillId(shopifyId) {
        const cfg = getCFG();
        showAction(`Preenchendo ID do Anúncio: ${shopifyId}`, '🔗');

        // ⚠️ Busca o input DENTRO do modal (não no filtro atrás)
        const modal = getModal();
        const input = modal
            ? modal.querySelector('#channelId, input[name="channelId"]')
            : document.getElementById('channelId');
        if (!input) throw new Error('Input channelId não encontrado dentro do modal');
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

        // ⚠️ Busca o botão "Sim" DENTRO do modal primeiro
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
        throw new Error('Botão "Sim" não encontrado dentro do modal');
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
     * Define o depósito da variante.
     * @param {Element} skuInput - o input de SKU da variante
     * @param {string} tipo - 'fabricacao' (value 1040000) ou 'revenda' (value 1010000)
     */
    function setDeposito(skuInput, tipo = 'fabricacao') {
        const idMatch = skuInput.id.match(/(\d+)/);
        if (!idMatch) return false;
        const numId = idMatch[1];

        let whSelect = document.getElementById('wareHouseSelect' + numId);
        if (!whSelect) {
            const container = getRegistroContainer(skuInput);
            if (container) whSelect = container.querySelector('select[id^="wareHouseSelect"]');
        }
        if (!whSelect) return false;

        // Mapeia tipo para value e texto de busca
        const config = {
            fabricacao: { value: '1040000', texto: 'FABRICACAO' },
            revenda:   { value: '1010000', texto: 'ESTOQUE REVENDA' },
        };
        const cfg = config[tipo] || config.fabricacao;

        // Busca por value exato ou por texto
        let opt = [...whSelect.options].find(o => o.value === cfg.value);
        if (!opt) opt = [...whSelect.options].find(o => o.textContent.toUpperCase().includes(cfg.texto));
        if (!opt) return false;

        whSelect.value = opt.value;
        opt.selected = true;
        whSelect.dispatchEvent(new Event('input', { bubbles: true }));
        whSelect.dispatchEvent(new Event('change', { bubbles: true }));

        if (typeof window.updateExtraFields === 'function') {
            try { window.updateExtraFields(parseInt(numId)); } catch (_) {}
        }

        highlight(whSelect, tipo === 'fabricacao' ? '#10b981' : '#f59e0b');
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

        // Estratégia 1: Buscar checkbox #selectAll direto
        let selectAllCb = document.getElementById('selectAll');

        // Estratégia 2: Buscar pelo texto "Selecionar Todos" e pegar o checkbox perto
        if (!selectAllCb) {
            const allLabels = [...document.querySelectorAll('label, span, div')];
            for (const el of allLabels) {
                if (el.textContent.trim().startsWith('Selecionar Todos')) {
                    selectAllCb = el.querySelector('input[type="checkbox"]')
                        || el.closest('label')?.querySelector('input[type="checkbox"]')
                        || el.previousElementSibling;
                    if (selectAllCb && selectAllCb.tagName === 'INPUT') break;
                    selectAllCb = null;
                }
            }
        }

        if (selectAllCb) {
            highlight(selectAllCb, '#7F00FF');
            await sleep(cfg.delayStep);

            // Clicar no label ou span (Metronic usa checkbox customizado)
            const parentLabel = selectAllCb.closest('label');
            if (parentLabel) {
                parentLabel.click();
                log('✅ Label "Selecionar Todos" clicado.', 'success');
            } else {
                const siblingSpan = selectAllCb.nextElementSibling;
                if (siblingSpan && siblingSpan.tagName === 'SPAN') {
                    siblingSpan.click();
                    log('✅ Span do checkbox "Selecionar Todos" clicado.', 'success');
                } else {
                    selectAllCb.click();
                    log('✅ Checkbox "Selecionar Todos" clicado direto.', 'success');
                }
            }

            // Garantir que está marcado
            if (!selectAllCb.checked) {
                selectAllCb.checked = true;
                selectAllCb.dispatchEvent(new Event('change', { bubbles: true }));
            }

            unhighlight(selectAllCb);
        } else {
            log('⚠️ Checkbox "Selecionar Todos" não encontrado. Marcando individualmente...', 'warn');
            // Fallback: marcar checkboxes individuais de registros (NÃO de notificações)
            // Escopo: apenas checkboxes dentro da área de produtos (perto de inputs SKU)
            const skuInputs = getSkuInputs();
            for (const sku of skuInputs) {
                const container = getRegistroContainer(sku);
                if (!container) continue;
                const cb = container.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) {
                    const lbl = cb.closest('label');
                    if (lbl) lbl.click();
                    else {
                        const span = cb.nextElementSibling;
                        if (span && span.tagName === 'SPAN') span.click();
                        else cb.click();
                    }
                }
            }
        }
        await sleep(600);
    }

    async function visualClickImport() {
        const cfg = getCFG();

        // ── PASSO 1: Abrir o dropdown dos 3 pontos ──
        // ⚠️ O botão ⋮ está na MESMA barra que "Selecionar Todos" / "Baixar anúncio específico"
        // NÃO é o dropdown de notificações do header
        showAction('Abrindo menu de ações (3 pontos)...', '⋯');
        let dropdownOpened = false;

        // Estratégia 1: Encontrar a barra de ações (contém "Selecionar Todos" ou "Baixar anúncio")
        const actionBar = [...document.querySelectorAll('div, nav, header')].find(el => {
            const text = el.textContent || '';
            return (text.includes('Selecionar Todos') || text.includes('Baixar anúncio'))
                && el.querySelector('[data-toggle="dropdown"], .dropdown-toggle');
        });

        if (actionBar) {
            // Buscar o botão 3 pontos DENTRO da barra de ações
            const toggle = actionBar.querySelector(
                '[data-toggle="dropdown"], .dropdown-toggle, .btn-icon.dropdown-toggle'
            );
            if (toggle) {
                highlight(toggle, '#f59e0b');
                await sleep(cfg.delayStep);
                toggle.click();
                unhighlight(toggle);
                dropdownOpened = true;
                log('✅ Dropdown dos 3 pontos aberto (via barra de ações).', 'success');
                await sleep(600);
            }
        }

        // Estratégia 2: Buscar o botão 3 pontos que está próximo ao #selectAll
        if (!dropdownOpened) {
            const selectAllEl = document.getElementById('selectAll');
            if (selectAllEl) {
                // Subir até o container pai e procurar o dropdown lá
                let parent = selectAllEl.parentElement;
                for (let i = 0; i < 8 && parent; i++) {
                    const toggle = parent.querySelector('[data-toggle="dropdown"], .dropdown-toggle');
                    if (toggle && toggle !== selectAllEl) {
                        highlight(toggle, '#f59e0b');
                        await sleep(cfg.delayStep);
                        toggle.click();
                        unhighlight(toggle);
                        dropdownOpened = true;
                        log('✅ Dropdown dos 3 pontos aberto (via proximity selectAll).', 'success');
                        await sleep(600);
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
        }

        // Estratégia 3: Fallback — buscar o ÚLTIMO dropdown toggle visível (geralmente é o da ação, não do header)
        if (!dropdownOpened) {
            const allToggles = [...document.querySelectorAll('[data-toggle="dropdown"]')].filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            // Pegar o ÚLTIMO (o do header geralmente é o primeiro)
            const toggle = allToggles[allToggles.length - 1];
            if (toggle) {
                highlight(toggle, '#f59e0b');
                await sleep(cfg.delayStep);
                toggle.click();
                unhighlight(toggle);
                dropdownOpened = true;
                log('⚠️ Dropdown aberto via fallback (último toggle visível).', 'warn');
                await sleep(600);
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
    // ║  AUTO-DETECÇÃO TIPO DE PRODUTO                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Detecta tipo do produto baseado nos SKUs das variantes:
     *   - Começa com ALL ou KIT → 'pular' (descarta)
     *   - Contém _FULL → 'revenda'
     *   - Qualquer outro → 'producao'
     */
    function detectarTipoProduto(skuInputs) {
        for (const inp of skuInputs) {
            const sku = norm(inp.value).toUpperCase();
            if (!sku) continue;
            if (sku.startsWith('ALL') || sku.startsWith('KIT')) return 'pular';
            if (sku.includes('_FULL') || sku.includes('FULL')) return 'revenda';
        }
        return 'producao';
    }

    /**
     * Verifica se os SKUs já contêm códigos Sankhya (numéricos puros).
     * Se todos forem numéricos, pula a consulta ao Sankhya.
     */
    function skusJaTemCodigoSankhya(skuInputs) {
        let count = 0;
        for (const inp of skuInputs) {
            const sku = norm(inp.value);
            if (!sku) continue;
            if (/^\d+$/.test(sku)) count++;
            else return false;
        }
        return count > 0;
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
            log('Nenhum ID encontrado na lista. Cole os IDs do canal!', 'warn');
            _running = false;
            return;
        }

        if (onlySingle) {
            items = [items[0]];
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

        // Lê o override do tipo de produto (auto / forçar produção / forçar revenda)
        const tipoOverride = document.getElementById('brk-import-tipo')?.value || 'auto';
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

                // 7. Consulta Sankhya (automático) ou Aplicar SKUs (manual) ou Pré-validado
                if (skusJaTemCodigoSankhya(skuInputs)) {
                    // SKUs JÁ SÃO CÓDIGOS SANKHYA (numéricos) — pula consulta
                    log(`${label} ✅ SKUs já são códigos Sankhya (numéricos) — pulando consulta, validando tipo...`, 'success');
                    showAction('SKUs já contêm códigos Sankhya — validando...', '✅');
                } else if (item.skuPairs.length > 0) {
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

                // 8. Auto-Detecção Tipo de Produto (ou override manual)
                const tipoDetectado = detectarTipoProduto(skuInputs);
                const tipoFinal = tipoOverride === 'auto' ? tipoDetectado : tipoOverride;

                log(`${label} 🔍 Tipo detectado: ${tipoDetectado.toUpperCase()}${tipoOverride !== 'auto' ? ' → Override: ' + tipoFinal.toUpperCase() : ''}`);

                // Se é ALL/KIT → PULAR
                if (tipoFinal === 'pular') {
                    log(`${label} ⏭ PULANDO — Código ALL/KIT detectado nos SKUs`, 'warn');
                    showAction('⏭ PULANDO — Produto ALL/KIT (descartado)', '🚫');
                    closeModals();
                    await sleep(1000);
                    continue;
                }

                const isProducaoFinal = (tipoFinal === 'producao');

                if (isProducaoFinal) {
                    // PRODUÇÃO: Vendido de forma diversa = Sim + Depósito = FABRICAÇÃO
                    updateVisualBar(`${label} 7a. Diversa=Sim (Produção)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('🏭 PRODUÇÃO: "Vendido de forma diversa" = Sim', '🏭');
                    let count = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp), 'sim')) count++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} Diversa=Sim em ${count} variantes.`);

                    updateVisualBar(`${label} 7b. Depósito FABRICAÇÃO`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('🏭 PRODUÇÃO: Selecionando "FABRICAÇÃO"', '🏭');
                    let countDeposito = 0;
                    for (const inp of skuInputs) {
                        if (setDeposito(inp, 'fabricacao')) countDeposito++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} ✅ Produção — Diversa=Sim + Depósito FABRICAÇÃO em ${countDeposito} variantes.`);
                } else {
                    // REVENDA: Vendido de forma diversa = Não + Depósito = ESTOQUE REVENDA
                    updateVisualBar(`${label} 7a. Diversa=Não (Revenda)`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('📦 REVENDA (_FULL): "Vendido de forma diversa" = Não', '📦');
                    let countDiversa = 0;
                    for (const inp of skuInputs) {
                        if (setVendidoDiversa(getRegistroContainer(inp), 'nao')) countDiversa++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} Diversa=Não em ${countDiversa} variantes.`);

                    updateVisualBar(`${label} 7b. Depósito REVENDA`, `${i + 1}/${items.length}`, item.shopifyId);
                    showAction('📦 REVENDA: Selecionando "ESTOQUE REVENDA"', '📦');
                    let countEstoque = 0;
                    for (const inp of skuInputs) {
                        if (setDeposito(inp, 'revenda')) countEstoque++;
                    }
                    await sleep(cfg.delayStep);
                    log(`${label} ✅ Revenda — Diversa=Não + Depósito REVENDA em ${countEstoque} variantes.`);
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

        const channelOptions = `
            <optgroup label="🛒 Amazon">
                <option value="amazon-550c5247c30e4eb9a5710d5853f2bb43">Amazon USEBRK</option>
            </optgroup>
            <optgroup label="🟡 Mercado Livre">
                <option value="ml-594c421a091a4546b9dda6762771322e">ML — BRK COMERCIO</option>
                <option value="ml-738289f2b87f4f0892558d591454f31d">ML — BRK FILIAL (Oficial)</option>
                <option value="ml-47da6d90fc2f489c9f7d0acc61ca458c">ML — BRK MATRIZ</option>
            </optgroup>
            <optgroup label="🟠 Shopee">
                <option value="shopee-d19e97cdeba849399f2a3bf04cf7cf2b">Shopee — BRK AGRO</option>
                <option value="shopee-1b953452d1e74475bd27492dba97f98a">Shopee — BRK FILIAL</option>
            </optgroup>
            <optgroup label="🟢 Shopify">
                <option value="shopify-21b47dd8ee4b4a44b8b8d891bb3e2265">Shopify — BRK AGRO</option>
                <option value="shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f" selected>Shopify — BRK FISHING</option>
                <option value="shopify-7495282216c04726834a39582e5369dd">Shopify — BRK MOTORS</option>
            </optgroup>
            <optgroup label="🎵 TikTok">
                <option value="tiktok-5b3145553c2b4984ac9a98e2d4ccc3a1">TikTok — BRK FILIAL</option>
            </optgroup>
        `;

        box.innerHTML = `
            <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#0f172a,#1e1b4b);border-radius:16px 16px 0 0">
                <div>
                    <div style="font-weight:800;font-size:15px;color:#a78bfa">🚀 BRK Autopilot Unificado v6.0</div>
                    <div style="font-size:11px;color:#64748b">Multi-Canal + Auto-Detecção + Sankhya</div>
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

                <!-- CANAL DE VENDA (TODAS AS LOJAS) -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase">🏪 Canal de Venda (10 lojas)</label>
                    <select id="brk-import-channel" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:13px">
                        ${channelOptions}
                    </select>
                </div>

                <!-- TIPO DE PRODUTO (AUTO-DETECÇÃO) -->
                <div style="background:#1e1b4b;border-radius:10px;padding:10px 12px;border:1px solid #7F00FF30">
                    <label style="display:block;font-size:11px;color:#a78bfa;margin-bottom:6px;font-weight:700;text-transform:uppercase">🔍 Tipo de Produto</label>
                    <select id="brk-import-tipo" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:12px;font-weight:600">
                        <option value="auto" selected>🤖 Auto-Detectar (lê o código SKU)</option>
                        <option value="producao">🏭 Forçar PRODUÇÃO (Diversa=Sim · FABRICAÇÃO)</option>
                        <option value="revenda">📦 Forçar REVENDA (Diversa=Não · ESTOQUE REVENDA)</option>
                    </select>
                    <div id="brk-import-modo-info" style="font-size:11px;margin-top:6px;padding:6px 8px;border-radius:6px;background:#0f172a;color:#10b981;border:1px solid #10b98130">
                        🤖 <strong>AUTO</strong>: _FULL → Revenda · ALL/KIT → Pular · Outros → Produção
                    </div>
                </div>

                <!-- LISTA DE IDS -->
                <div>
                    <label style="display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600;text-transform:uppercase">IDs dos Anúncios (um por linha)</label>
                    <textarea id="brk-import-list" rows="5" placeholder="Cole aqui os IDs do canal selecionado (um por linha)..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:monospace;font-size:12px;resize:vertical"></textarea>
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
                    Hook Prime v4.2 · BRK Autopilot v6.0 · Multi-Canal + Auto-Detect ✅
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

        box.querySelector('#brk-import-tipo').onchange = (e) => {
            const info = document.getElementById('brk-import-modo-info');
            const val = e.target.value;
            if (val === 'auto') {
                info.innerHTML = '🤖 <strong>AUTO</strong>: _FULL → Revenda · ALL/KIT → Pular · Outros → Produção';
                info.style.color = '#10b981';
                info.style.borderColor = '#10b98130';
                log('Tipo: AUTO-DETECTAR (lê o código SKU)', 'info');
            } else if (val === 'producao') {
                info.innerHTML = '🏭 <strong>PRODUÇÃO</strong>: Diversa = Sim · Depósito = FABRICAÇÃO';
                info.style.color = '#a78bfa';
                info.style.borderColor = '#a78bfa30';
                log('Tipo: FORÇAR PRODUÇÃO', 'info');
            } else {
                info.innerHTML = '📦 <strong>REVENDA</strong>: Diversa = Não · Depósito = ESTOQUE REVENDA';
                info.style.color = '#f59e0b';
                info.style.borderColor = '#f59e0b30';
                log('Tipo: FORÇAR REVENDA', 'info');
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


    } // fim Magis5

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  MÓDULO SANKHYA — Extrator de SKUs v8.0                             ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    if (_brkHost.includes('sankhya')) {



    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  CONFIGURAÇÃO                                                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝
    const CFG = {
        delaySugestoes: 1500,   // tempo para loadSuggestions() renderizar resultados
        tentativas: 3,          // tentativas de leitura por SKU
        delayEntreSKUs: 800,    // pausa entre um SKU e outro
        timeoutInput: 25000,    // timeout para achar o input na 1ª vez
    };


    function dbg(...args) {
        console.log('%c[SKU-v7]', 'color:#a6e3a1;font-weight:bold', ...args);
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  ACESSO A IFRAMES                                                   ║
    // ║                                                                      ║
    // ║  O Sankhya usa um shell GWT no documento principal.                 ║
    // ║  Cada tela (ex: Produtos) é carregada em um iframe interno.        ║
    // ║  document.querySelector() NÃO enxerga dentro de iframes.           ║
    // ║  Precisamos acessar iframe.contentDocument para cada iframe.       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Retorna um array de todos os Documents acessíveis:
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
                        // Cross-origin — não conseguimos acessar
                        dbg(`  ⚠ iframe cross-origin: ${iframe.src || '(sem src)'}`);
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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  BLACKLIST                                                          ║
    // ╚══════════════════════════════════════════════════════════════════════╝

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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  getBuscaInput() — BUSCA EM TODOS OS IFRAMES                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function tentarLocalizarInput() {
        const seletores = [
            // Nível 1: Com pai (o mais seguro)
            'sk-pesquisa-content input.query-input',
            'sk-pesquisa-content input[ng-model="query"]',
            'sk-pesquisa-content input[scope-id="searchInput"]',
            'sk-pesquisa-content input[placeholder="Digite o que você procura"]',
            'sk-pesquisa-content input',

            // Nível 2: Atributos específicos
            'input.query-input[ng-model="query"]',
            'input[scope-id="searchInput"]',
            'input[placeholder="Digite o que você procura"]',
            'input.query-input[ng-change="loadSuggestions()"]',
            'input.query-input',

            // Nível 3: Fallbacks
            'input[ng-change*="loadSuggestions"]',
            'input[placeholder*="que você procura"]',
        ];

        // Busca em TODOS os documents (principal + iframes)
        for (const sel of seletores) {
            const matches = querySelectorAllAcrossFrames(sel);
            for (const { element: el, doc } of matches) {
                if (isInputVisivel(el) && !isInputProibido(el)) {
                    const isIframe = doc !== document;
                    dbg(`✅ Encontrado via: ${sel}${isIframe ? ' (DENTRO DE IFRAME)' : ''}`);
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
                    dbg('✅ Encontrado via placeholder parcial (iframe scan):', ph);
                    return inp;
                }
            }
        }

        // Fallback geométrico: maior input visível em qualquer frame
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
            dbg(`✅ Fallback geométrico: ${visiveis.length} input(s) em iframes`);
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
                dbg(`── Tentativa #${tentativa} (${Date.now() - inicio}ms) ──`);

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
                    reject(new Error('Input não encontrado após ' + (CFG.timeoutInput / 1000) + 's'));
                }
            }

            tentar();
            if (!resolvido) {
                intervalId = setInterval(tentar, 2000);
            }
        });
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INJEÇÃO DE TEXTO                                                   ║
    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  ⛔ DIRETRIZ DE SEGURANÇA — SOMENTE LEITURA                        ║
    // ║                                                                      ║
    // ║  Este script NÃO PODE em hipótese alguma:                           ║
    // ║  • Disparar eventos de teclado (Enter, keydown, keypress, keyup)    ║
    // ║  • Disparar eventos de mouse (click, mousedown, mouseup)            ║
    // ║  • Disparar eventos DOM (input, change, submit, focus)              ║
    // ║  • Chamar dispatchEvent() em qualquer elemento                      ║
    // ║  • Chamar triggerHandler() do AngularJS                             ║
    // ║  • Chamar onKeydown(), onSelectData() ou qualquer handler           ║
    // ║  • Abrir, editar, ou navegar para qualquer produto                  ║
    // ║                                                                      ║
    // ║  A ÚNICA operação permitida é:                                      ║
    // ║  1. scope.query = "SKU"  (define o texto da busca)                  ║
    // ║  2. scope.loadSuggestions()  (carrega sugestões)                    ║
    // ║  3. scope.$digest()  (atualiza a view)                              ║
    // ║  4. LER o texto dos resultados (innerText)                          ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Injeta o texto da pesquisa de forma SEGURA usando apenas
     * o scope AngularJS. Não dispara NENHUM evento DOM.
     *
     * Estratégias (em ordem de prioridade):
     *   1. scope.query + scope.loadSuggestions() — via AngularJS direto
     *   2. input.value = texto (fallback se scope não existir)
     */
    function injetarTextoSeguro(input, texto) {
        dbg(`📝 Injetando (modo seguro): "${texto}"`);

        let sucesso = false;

        // ── Estratégia 1: Via AngularJS scope (preferida) ──
        try {
            const win = input.ownerDocument.defaultView || window;
            if (win.angular) {
                const ngEl = win.angular.element(input);
                const scope = ngEl.scope();
                if (scope) {
                    // Define o modelo diretamente — sem eventos DOM
                    scope.query = texto;

                    // Chama loadSuggestions para exibir resultados
                    if (typeof scope.loadSuggestions === 'function') {
                        scope.loadSuggestions();
                        dbg('  → scope.query + loadSuggestions(): OK');
                    }

                    // Atualiza a view (renderiza o texto no input)
                    try { scope.$digest(); } catch(_) {
                        try { scope.$apply(); } catch(_2) {}
                    }

                    sucesso = true;
                }
            }
        } catch(e) {
            dbg('  → scope falhou:', e.message);
        }

        // ── Estratégia 2: Fallback puro (só altera o valor visual) ──
        if (!sucesso) {
            try {
                const win = input.ownerDocument.defaultView || window;
                const descriptor = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(input, texto);
                } else {
                    input.value = texto;
                }
                dbg('  → Fallback input.value: OK (sem eventos)');
            } catch(e) {
                input.value = texto;
                dbg('  → Fallback direto: OK');
            }
        }

        dbg('  ✅ Texto injetado (nenhum evento DOM disparado)');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  EXTRAÇÃO DO CÓDIGO SANKHYA                                         ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Extrai o código Sankhya para um SKU específico.
     * Tenta MULTIPLOS padrões porque o innerText pode variar:
     *   - "75679 - HYB082PP - CAMISA..."  (tudo numa linha)
     *   - "75679\nHYB082PP - CAMISA..."   (código em linha separada)
     *   - "75679 HYB082PP"                (sem hífen)
     *   - texto com vários resultados
     */
    function extrairCodigoParaSku(sku, texto) {
        const skuEsc = escapeRegex(sku.toUpperCase().trim());
        const textoNorm = texto.toUpperCase();

        // (?![A-Za-z0-9]) = negative lookahead impede match parcial:
        //   HYB076G != HYB076GG != HYB076G1 != HYB076G2
        const borda = '(?![A-Za-z0-9])';

        // Padrão 1: código - SKU  (ex: "75679 - HYB082PP")
        let m = new RegExp('(\\d{2,})\\s*[-–—]\\s*' + skuEsc + borda, 'gm').exec(textoNorm);
        if (m) return m[1];

        // Padrão 2: código + espaço/quebra + SKU (ex: "75679\nHYB082PP")
        m = new RegExp('(\\d{2,})[\\s\\n]+' + skuEsc + borda, 'gm').exec(textoNorm);
        if (m) return m[1];

        // Padrões frouxos REMOVIDOS: causavam contaminação entre SKUs similares

        return null;
    }

    /**
     * EXTRAÇÃO DE EAN VIA DOM — busca diretamente os elementos HTML.
     * Procura <p class="entity-field"> com "Referência:" e o <span> com o valor.
     * Garante que pertence ao mesmo "card" do produto com o SKU correto.
     */
    function extrairEanDOM(sku, container) {
        const skuUpper = sku.toUpperCase().trim();
        const skuEsc = escapeRegex(skuUpper);
        const skuRegex = new RegExp('(?<![A-Za-z0-9])' + skuEsc + '(?![A-Za-z0-9])');

        // Estratégia 1: buscar por <p class="entity-field"> com "Referência"
        const candidatos = container.querySelectorAll(
            'p.entity-field, .entity-field, [class*="entity-field"]'
        );
        for (const field of candidatos) {
            const fieldText = field.textContent || '';
            if (!/refer[eê]ncia/i.test(fieldText)) continue;

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

            // Subir na árvore DOM até achar ancestral que contenha o SKU
            let parent = field.parentElement;
            for (let d = 0; d < 12 && parent && parent !== container; d++) {
                const pText = (parent.innerText || '').toUpperCase();
                if (skuRegex.test(pText)) {
                    dbg(`  🔍 EAN DOM: ${ean} (entity-field, depth=${d})`);
                    return ean;
                }
                parent = parent.parentElement;
            }
        }

        // Estratégia 2: buscar spans com ng-bind-html contendo só dígitos
        const spans = container.querySelectorAll(
            'span[ng-bind-html], span[ng-bind-html="field.value"]'
        );
        for (const span of spans) {
            const val = span.textContent.trim();
            if (!/^\d{8,14}$/.test(val)) continue;

            const parentP = span.closest('p, div, td');
            if (!parentP || !/refer[eê]ncia/i.test(parentP.textContent)) continue;

            let ancestor = parentP.parentElement;
            for (let d = 0; d < 12 && ancestor && ancestor !== container; d++) {
                const aText = (ancestor.innerText || '').toUpperCase();
                if (skuRegex.test(aText)) {
                    dbg(`  🔍 EAN DOM: ${val} (ng-bind-html, depth=${d})`);
                    return val;
                }
                ancestor = ancestor.parentElement;
            }
        }

        return '';
    }

    /**
     * EXTRAÇÃO DE EAN VIA TEXTO — fallback quando DOM não funciona.
     * Testa TODAS as ocorrências do SKU no texto (pula a barra de busca).
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
                dbg(`  🔍 EAN texto: ${refMatch[1]} (pos=${posSkuFim})`);
                return refMatch[1];
            }
        }

        return '';
    }

    /**
     * Busca o código + EAN em TODOS os documents (principal + iframes).
     * Usa extração DOM (primária) + texto (fallback) para o EAN.
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
                        dbg(`  Código ${codigo} + EAN ${ean || '(vazio)'} em <${c.tagName.toLowerCase()}>`);
                        return { codigo, ean };
                    }
                }

                const texto = doc.body?.innerText || '';
                const codigo = extrairCodigoParaSku(sku, texto);
                if (codigo) {
                    const ean = extrairEanDOM(sku, doc.body) || extrairEanTexto(sku, texto);
                    dbg(`  Código ${codigo} + EAN ${ean || '(vazio)'} no body`);
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
        res.push(`\n🔍 Debug extração para: "${sku}"`);

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
                        const trecho = texto.substring(start, end).replace(/\n/g, '↵');
                        res.push(`  ✅ ${label} <${c.tagName.toLowerCase()}>:`);
                        res.push(`     "...${trecho}..."`);
                    }
                }

                // Busca no body
                const body = (doc.body?.innerText || '').toUpperCase();
                const idx = body.indexOf(skuUpper);
                if (idx >= 0) {
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(body.length, idx + skuUpper.length + 40);
                    const trecho = body.substring(start, end).replace(/\n/g, '↵');
                    res.push(`  ✅ ${label} <body>:`);
                    res.push(`     "...${trecho}..."`);

                    // Tenta extrair
                    const codigo = extrairCodigoParaSku(sku, body);
                    res.push(`  → Regex result: ${codigo || '❌ nenhum match'}`);
                } else {
                    res.push(`  ❌ ${label}: SKU "${sku}" não encontrado no innerText`);
                }
            } catch(e) {
                res.push(`  ⛔ ${label}: ${e.message}`);
            }
        }

        return res.join('\n');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  PESQUISA RÁPIDA — digita, lê sugestão, próximo                     ║
    // ║                                                                      ║
    // ║  Fluxo: digitar SKU → aguardar sugestões → ler código → limpar     ║
    // ║  NÃO pressiona Enter (Enter abre o produto).                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    let inputCacheado = null;

    /**
     * Pesquisa um SKU e retorna o código Sankhya + EAN.
     * @returns {{codigo: string, ean: string}|null}
     */
    async function pesquisarSku(sku) {
        if (inputCacheado) {
            try {
                const rect = inputCacheado.getBoundingClientRect();
                const ownerDoc = inputCacheado.ownerDocument;
                if (rect.width === 0 || !ownerDoc.contains(inputCacheado)) {
                    dbg('⚠ Input cacheado inválido');
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
                dbg(`  ✅ ${sku} → ${dados.codigo} | EAN: ${dados.ean || '(vazio)'}`);
                return dados;
            }
            dbg(`   Tentativa ${t}/${CFG.tentativas} — sugestões não apareceram...`);
        }

        return null;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  DIAGNÓSTICO                                                        ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function diagnosticarParaPainel() {
        const res = [];

        // Listar iframes
        const docs = getAllDocuments();
        res.push(`📄 Documents acessíveis: ${docs.length} (1 principal + ${docs.length - 1} iframe(s))`);

        // Listar iframes encontrados
        try {
            const iframes = document.querySelectorAll('iframe, frame');
            res.push(`🖼 Iframes no doc principal: ${iframes.length}`);
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
                    `  [${i}] ${acessivel ? '✅' : '❌'} size=${Math.round(r.width)}x${Math.round(r.height)} ` +
                    `src="${url.substring(0, 60)}"`
                );
            });
        } catch(_) {}

        // Inputs em CADA document
        res.push('');
        res.push('── Inputs por documento ──');
        docs.forEach((doc, di) => {
            const label = di === 0 ? 'Principal' : `Iframe #${di}`;
            try {
                const inputs = doc.querySelectorAll('input');
                res.push(`  📄 ${label}: ${inputs.length} input(s)`);
                inputs.forEach((inp, i) => {
                    const r = inp.getBoundingClientRect();
                    const vis = r.width > 0 && r.height > 0;
                    const isGWT = inp.id === 'search-input-element' || (inp.className || '').includes('gwt');
                    res.push(
                        `    [${i}] ${vis ? '✅' : '❌'} ${isGWT ? '🚫 GWT' : ''} ` +
                        `class="${(inp.className || '').substring(0, 30)}" ` +
                        `ph="${(inp.placeholder || '').substring(0, 25)}" ` +
                        `ng-model="${inp.getAttribute('ng-model') || ''}" ` +
                        `size=${Math.round(r.width)}x${Math.round(r.height)}`
                    );
                });
            } catch(e) {
                res.push(`  📄 ${label}: ⛔ ${e.message}`);
            }
        });

        // Teste de seletores (em todos os frames)
        res.push('');
        res.push('── Teste de seletores (cross-frame) ──');
        const seletoresTest = [
            'sk-pesquisa-content input.query-input',
            'sk-pesquisa-content input',
            'input.query-input[ng-model="query"]',
            'input[scope-id="searchInput"]',
            'input[placeholder="Digite o que você procura"]',
        ];
        for (const sel of seletoresTest) {
            const match = querySelectorAcrossFrames(sel);
            if (match) {
                const isIframe = match.doc !== document;
                res.push(`  ✅ ${sel} → ENCONTRADO${isIframe ? ' (em IFRAME!)' : ''}`);
            } else {
                res.push(`  ❌ ${sel} → não encontrado`);
            }
        }

        // sk-pesquisa-content em algum frame?
        res.push('');
        const skMatch = querySelectorAcrossFrames('sk-pesquisa-content');
        res.push(`── sk-pesquisa-content: ${skMatch ? '✅ ENCONTRADO' + (skMatch.doc !== document ? ' (IFRAME)' : '') : '❌ NÃO ENCONTRADO'} ──`);
        if (skMatch) {
            const innerInputs = skMatch.element.querySelectorAll('input');
            res.push(`  Inputs dentro: ${innerInputs.length}`);
            innerInputs.forEach((inp, i) => {
                res.push(`    [${i}] class="${inp.className}" ph="${inp.placeholder || ''}"`);
            });
        }

        // AngularJS (no iframe, não no principal)
        res.push('');
        res.push('── AngularJS ──');
        docs.forEach((doc, di) => {
            const label = di === 0 ? 'Principal' : `Iframe #${di}`;
            try {
                const win = doc.defaultView || window;
                res.push(`  ${label}: angular ${win.angular ? '✅' : '❌'}`);
            } catch(_) {
                res.push(`  ${label}: ⛔ acesso negado`);
            }
        });

        const inp = tentarLocalizarInput();
        if (inp) {
            res.push(`  Input selecionado: class="${(inp.className || '').substring(0, 40)}"`);
            try {
                const win = inp.ownerDocument.defaultView || window;
                if (win.angular) {
                    const scope = win.angular.element(inp).scope();
                    res.push(`  scope: ${scope ? '✅' : '❌'}`);
                    if (scope) {
                        res.push(`  scope.query: "${scope.query || '(vazio)'}"`);
                        res.push(`  scope.onKeydown: ${typeof scope.onKeydown === 'function' ? '✅' : '❌'}`);
                        res.push(`  scope.loadSuggestions: ${typeof scope.loadSuggestions === 'function' ? '✅' : '❌'}`);
                    }
                }
            } catch(e) {
                res.push(`  scope: ⛔ ${e.message}`);
            }
        } else {
            res.push('  ⛔ Nenhum input válido encontrado');
        }

        return res.join('\n');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  UI — PAINEL                                                        ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function buildLauncher() {
        if (document.getElementById('brk-sankhya-launcher')) return;
        const btn = document.createElement('button');
        btn.id = 'brk-sankhya-launcher';
        btn.innerText = '🎣 Abrir Painel Sankhya';
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
              <div style="font-size:12px;color:#9ca3af">Pesquisa → Lê código → Próximo (sem abrir produto)</div>
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
              <button id="brk-processar" style="background:#059669;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">▶ Processar lista</button>
              <button id="brk-diagnostico" style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">🩺 Diagnosticar</button>
              <button id="brk-debug-extracao" style="background:#d97706;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">🔍 Debug Extração</button>
              <button id="brk-copy-pares" style="background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">Copiar pares</button>
              <button id="brk-copy-nao" style="background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">Copiar não encontrados</button>
            </div>
            <div>
              <label style="display:block;font-size:12px;color:#9ca3af;margin-bottom:4px">Resultado (SKU → Código → EAN)</label>
              <textarea id="brk-pares" rows="5" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#fff"></textarea>
            </div>
            <div id="brk-log" style="background:#0b1220;border-radius:10px;padding:10px;max-height:30vh;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;"></div>
          </div>`;
        document.body.appendChild(box);

        box.querySelector('#brk-close').onclick = () => box.remove();
        box.querySelector('#brk-processar').onclick = processarLista;
        box.querySelector('#brk-diagnostico').onclick = () => {
            log('🩺 Executando diagnóstico (incluindo iframes)...');
            const resultado = diagnosticarParaPainel();
            log(resultado);
            status('Diagnóstico concluído.');
        };
        box.querySelector('#brk-debug-extracao').onclick = () => {
            const skusTxt = document.getElementById('brk-skus').value;
            const primeiroSku = (skusTxt.split('\n').map(norm).filter(Boolean))[0];
            if (!primeiroSku) {
                log('⚠ Cole pelo menos 1 SKU na lista para debugar.');
                return;
            }
            log(`🔍 Debugando extração do SKU: "${primeiroSku}"...`);
            log('(O SKU deve estar visível nos resultados da tela)');
            const debug = debugExtracaoSku(primeiroSku);
            log(debug);
            status('Debug de extração concluído.');
        };
        box.querySelector('#brk-copy-pares').onclick = async () => {
            await navigator.clipboard.writeText(document.getElementById('brk-pares').value);
            status('Pares copiados!'); log('📋 Pares copiados.');
        };
        box.querySelector('#brk-copy-nao').onclick = async () => {
            await navigator.clipboard.writeText(naoEncontrados.join('\n'));
            status('Não encontrados copiados!'); log('📋 Não encontrados copiados.');
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

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  LOOP PRINCIPAL                                                     ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function processarLista() {
        naoEncontrados = [];
        inputCacheado = null;
        const skusEl = document.getElementById('brk-skus');
        const paresEl = document.getElementById('brk-pares');

        const skusRaw = skusEl.value.split('\n').map(norm).filter(Boolean);
        if (skusRaw.length === 0) {
            status('⚠ Cole pelo menos um SKU na lista.');
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
        log(`\n━━━ INICIANDO v7.2 (iframe + EAN) ━━━`);
        log(`📄 Documents disponíveis: ${getAllDocuments().length}`);
        log(`📦 ${skuEntradas.length - totalPrecisaEan} SKUs com EAN (só código)`);
        log(`🔴 ${totalPrecisaEan} SKUs sem EAN (código + referência)`);

        try {
            log('🔍 Localizando barra de pesquisa (cross-frame)...');
            inputCacheado = await getBuscaInput();
            const inp = inputCacheado;
            const isIframe = inp.ownerDocument !== document;
            log(`✅ Barra encontrada! ${isIframe ? '📌 DENTRO DE IFRAME' : '📌 documento principal'}`);
            log(`   class="${(inp.className || '').substring(0, 50)}"`);
            log(`   placeholder="${inp.placeholder || ''}"`);
        } catch(e) {
            log(`⛔ ${e.message}`);
            log('💡 Clique em "🩺 Diagnosticar" para ver iframes e inputs.');
            status('Erro: Input não encontrado.');
            return;
        }

        let eansExtraidos = 0;

        for (let i = 0; i < skuEntradas.length; i++) {
            const { sku, precisaEan } = skuEntradas[i];
            status(`[${i+1}/${skuEntradas.length}] ${sku}${precisaEan ? ' 🔴' : ''}`);

            try {
                const dados = await pesquisarSku(sku);
                if (dados) {
                    // Só inclui EAN no resultado se o Magis5 marcou [SEM_EAN]
                    if (precisaEan && dados.ean) {
                        pares.push(`${sku}\t${dados.codigo}\t${dados.ean}`);
                        log(`✅ ${sku} → ${dados.codigo} | 🔴 EAN: ${dados.ean}`);
                        eansExtraidos++;
                    } else {
                        pares.push(`${sku}\t${dados.codigo}`);
                        const motivo = precisaEan ? ' | ⚠ EAN não encontrado no Sankhya' : '';
                        log(`✅ ${sku} → ${dados.codigo}${motivo}`);
                    }
                    paresEl.value = pares.join('\n');
                } else {
                    naoEncontrados.push(sku);
                    log(`⚠️ ${sku} → não encontrado`);
                }
            } catch(e) {
                naoEncontrados.push(sku);
                log(`⛔ ERRO em "${sku}": ${e.message}`);
                inputCacheado = null;
                try {
                    log('🔄 Re-buscando input...');
                    inputCacheado = await getBuscaInput();
                    log('✅ Input re-encontrado.');
                } catch(e2) {
                    log(`⛔ Falha crítica: ${e2.message}`);
                    break;
                }
            }

            if (i < skuEntradas.length - 1) await sleep(CFG.delayEntreSKUs);
        }

        paresEl.value = pares.join('\n');
        status(`Finalizado! ✅ ${pares.length} | ⚠ ${naoEncontrados.length} | 🔴 ${eansExtraidos} EANs`);
        log(`\n━━━ FIM ━━━`);
        log(`✅ Códigos encontrados: ${pares.length}`);
        log(`🔴 EANs extraídos: ${eansExtraidos} de ${totalPrecisaEan} necessários`);
        log(`⚠ SKUs sem resultado: ${naoEncontrados.length}`);
        if (pares.length > 0) {
            log(`📋 Clique "Copiar pares" para colar no Magis5`);
        }
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INTEGRAÇÃO AUTOMÁTICA COM MAGIS5 (GM_setValue)                     ║
    // ║                                                                      ║
    // ║  Escuta 'brk_skus_pendentes' enviado pelo Import Autopilot.         ║
    // ║  Processa automaticamente usando pesquisarSku() (mesma lógica).     ║
    // ║  Retorna resultados via 'brk_skus_resultado'.                       ║
    // ║                                                                      ║
    // ║  O painel manual continua funcionando normalmente.                  ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    async function processarListaAutomatica(skuEntries) {
        log('\n━━━ MODO AUTOMÁTICO (via Magis5 Import) ━━━');
        log(`📡 Recebidos ${skuEntries.length} SKUs para processar.`);
        status(`🤖 Auto: Processando ${skuEntries.length} SKUs...`);

        inputCacheado = null;

        try {
            inputCacheado = await getBuscaInput();
            log('✅ Barra de pesquisa encontrada.');
        } catch(e) {
            log(`⛔ ${e.message}`);
            GM_setValue('brk_skus_resultado', JSON.stringify({
                timestamp: Date.now(), status: 'erro',
                mensagem: 'Input de pesquisa não encontrado no Sankhya'
            }));
            return;
        }

        const pares = [];

        for (let i = 0; i < skuEntries.length; i++) {
            const entry = skuEntries[i];
            const sku = entry.sku;
            status(`🤖 [${i+1}/${skuEntries.length}] ${sku}`);

            try {
                const dados = await pesquisarSku(sku);
                if (dados) {
                    pares.push({
                        sku: sku,
                        codigo: dados.codigo,
                        ean: (entry.precisaEan && dados.ean) ? dados.ean : ''
                    });
                    log(`✅ ${sku} → ${dados.codigo}${dados.ean ? ' | EAN: ' + dados.ean : ''}`);
                } else {
                    log(`⚠️ ${sku} → não encontrado`);
                }
            } catch(e) {
                log(`⛔ ERRO em "${sku}": ${e.message}`);
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

        log(`\n━━━ AUTOMÁTICO FINALIZADO ━━━`);
        log(`✅ Encontrados: ${pares.length} | ⚠ Não encontrados: ${skuEntries.length - pares.length}`);
        log(`📡 Resultado enviado ao Magis5.`);
        status(`🤖 Auto: ✅ ${pares.length}/${skuEntries.length} enviados ao Magis5`);
    }

    // ── Listener para receber SKUs do Magis5 ──
    GM_addValueChangeListener('brk_skus_pendentes', (name, oldVal, newVal, remote) => {
        if (!remote) return; // Ignora mudanças locais
        if (!newVal) return;

        try {
            const payload = JSON.parse(newVal);
            if (payload && payload.status === 'pendente' && payload.skus && payload.skus.length > 0) {
                log(`\n📡 SKUs recebidos do Magis5 Import (${payload.skus.length} itens)`);
                processarListaAutomatica(payload.skus);
            }
        } catch(e) {
            log(`⚠️ Erro ao processar payload do Magis5: ${e.message}`);
        }
    });

    log('🔗 Listener Magis5 ativado — aguardando SKUs automáticos.');

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INICIALIZAÇÃO                                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    setTimeout(buildLauncher, 2000);


    } // fim Sankhya

})();
