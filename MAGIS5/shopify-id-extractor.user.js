// ==UserScript==
// @name         Shopify ID Extractor — BRK
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Extrai IDs dos produtos selecionados ou em rascunho da Shopify para importar na Magis5
// @match        https://admin.shopify.com/store/*/products*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    if (!window.location.href.includes('admin.shopify.com')) return;

    const ACCENT = '#7F00FF';
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  EXTRAÇÃO DE IDs (SELECIONADOS OU TODOS)                           ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Extrai detalhes APENAS dos produtos que estão com CHECKBOX MARCADO
     */
    function extractSelectedProductDetails() {
        const products = [];
        const seen = new Set();

        // Estratégia 1: Checkboxes marcados no DOM
        const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
        checkedBoxes.forEach(cb => {
            // Ignorar checkbox "selecionar todos" do cabeçalho
            if (cb.closest('thead') || cb.id?.includes('SelectAll') || cb.name?.includes('SelectAll')) return;

            const row = cb.closest('tr, [role="row"], li, [class*="IndexTable__TableRow"], [class*="ResourceItem"], div[class*="Row"]');
            if (!row) return;

            const link = row.querySelector('a[href*="/products/"]');
            if (!link) return;

            const href = link.getAttribute('href') || '';
            const match = href.match(/\/products\/(\d{8,})/);
            if (!match) return;

            const id = match[1];
            if (seen.has(id)) return;
            seen.add(id);

            const title = (link.textContent || '').trim();
            let status = '';
            row.querySelectorAll('span, [class*="badge"], [class*="Badge"]').forEach(span => {
                const text = span.textContent.trim().toLowerCase();
                if (['rascunho', 'draft', 'ativo', 'active'].includes(text)) status = text;
            });

            products.push({ id, title: title || `Produto ${id}`, status, isSelected: true });
        });

        // Estratégia 2: Linhas com aria-selected="true" ou classe de seleção Polaris
        if (products.length === 0) {
            const selectedRows = document.querySelectorAll('[aria-selected="true"], [class*="TableRow--selected"], [class*="is-selected"]');
            selectedRows.forEach(row => {
                const link = row.querySelector('a[href*="/products/"]');
                if (!link) return;
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/products\/(\d{8,})/);
                if (!match) return;
                const id = match[1];
                if (seen.has(id)) return;
                seen.add(id);

                const title = (link.textContent || '').trim();
                products.push({ id, title: title || `Produto ${id}`, status: '', isSelected: true });
            });
        }

        return products;
    }

    /**
     * Extrai detalhes de TODOS os produtos visíveis na tela
     */
    function extractProductDetails() {
        const products = [];
        const seen = new Set();

        const rows = document.querySelectorAll('tr, [class*="Row"], [role="row"]');
        for (const row of rows) {
            const link = row.querySelector('a[href*="/products/"]');
            if (!link) continue;
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/products\/(\d{8,})/);
            if (!match) continue;
            const id = match[1];
            if (seen.has(id)) continue;
            seen.add(id);

            const title = (link.textContent || '').trim();
            let status = '';
            row.querySelectorAll('span, [class*="badge"], [class*="Badge"]').forEach(span => {
                const text = span.textContent.trim().toLowerCase();
                if (['rascunho', 'draft', 'ativo', 'active'].includes(text)) status = text;
            });

            if (title && title.length > 2) products.push({ id, title, status });
        }

        // Fallback por links diretos se não achar linhas
        if (products.length === 0) {
            document.querySelectorAll('a[href*="/products/"]').forEach(link => {
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/products\/(\d{8,})/);
                if (!match) return;
                const id = match[1];
                if (seen.has(id)) return;
                seen.add(id);
                const title = (link.textContent || '').trim().substring(0, 80);
                if (title && title.length > 3) products.push({ id, title, status: '' });
            });
        }

        return products;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  DETECÇÃO DE LOJA E FILTRO                                          ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function getStoreName() {
        const match = window.location.href.match(/\/store\/([^/]+)/);
        return match ? match[1] : 'desconhecida';
    }

    function getStoreLabel() {
        const store = getStoreName().toLowerCase();
        if (store.includes('fishing')) return 'BRK FISHING';
        if (store.includes('agro')) return 'BRK AGRO';
        if (store.includes('motors')) return 'BRK MOTORS';
        return store.toUpperCase();
    }

    function isFilteredByDraft() {
        const url = window.location.href.toLowerCase();
        return url.includes('status%5B%5D=draft') || url.includes('status=draft') || url.includes('rascunho');
    }

    function getDraftFilterUrl() {
        const store = getStoreName();
        return `https://admin.shopify.com/store/${store}/products?status%5B%5D=draft&limit=250`;
    }

    function getAllProductsUrl() {
        const store = getStoreName();
        return `https://admin.shopify.com/store/${store}/products?selectedView=all&limit=250`;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  LOG E STATUS                                                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function log(msg, type = 'info') {
        const el = document.getElementById('brk-shopify-log');
        if (!el) return;
        const ts = new Date().toLocaleTimeString('pt-BR');
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : '📋';
        el.textContent += (el.textContent ? '\n' : '') + `[${ts}] ${prefix} ${msg}`;
        el.scrollTop = el.scrollHeight;
    }

    function status(text) {
        const el = document.getElementById('brk-shopify-status');
        if (el) el.textContent = text;
    }

    function displayResults(products, isSelectedOnly = false) {
        const idsEl = document.getElementById('brk-shopify-ids');
        const countEl = document.getElementById('brk-shopify-count');

        if (products.length === 0) {
            if (isSelectedOnly) {
                log('Nenhum produto marcado com checkbox na tela! Marque os que deseja ou clique "Extrair Todos".', 'warn');
                status('⚠️ Nenhum produto selecionado');
            } else {
                log('Nenhum produto encontrado na página.', 'warn');
                status('⚠️ Nenhum produto');
            }
            return;
        }

        const ids = products.map(p => p.id).join('\n');
        if (idsEl) idsEl.value = ids;
        if (countEl) countEl.textContent = `${products.length} selecionado(s)`;

        const prefixMsg = isSelectedOnly ? 'SELECIONADOS via checkbox' : 'da tela';
        status(`✅ ${products.length} produtos ${prefixMsg}!`);
        log(`Extraídos ${products.length} produtos ${prefixMsg}:`, 'success');
        products.forEach((p, i) => {
            log(`  ${i + 1}. ${p.id} — ${p.title.substring(0, 45)}${p.status ? ' [' + p.status + ']' : ''}`);
        });
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  UI — PAINEL                                                        ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    function buildLauncher() {
        if (document.getElementById('brk-shopify-launcher')) return;
        const btn = document.createElement('button');
        btn.id = 'brk-shopify-launcher';
        btn.innerText = '🔗 Extrair IDs';
        btn.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 999998;
            background: linear-gradient(135deg, ${ACCENT}, #5B21B6);
            color: #fff; border: none; padding: 12px 18px; border-radius: 10px;
            font-weight: bold; cursor: pointer; font-size: 14px;
            box-shadow: 0 4px 15px rgba(127,0,255,0.4);
            transition: transform 0.2s;
        `;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = () => {
            const existing = document.getElementById('brk-shopify-panel');
            if (existing) { existing.remove(); return; }
            buildPanel();
        };
        document.body.appendChild(btn);
    }

    function buildPanel() {
        const box = document.createElement('div');
        box.id = 'brk-shopify-panel';
        box.style.cssText = `
            position: fixed; top: 16px; right: 16px; z-index: 999999;
            background: #0f172a; color: #e2e8f0;
            width: 480px; max-height: 88vh; overflow: auto;
            border-radius: 16px; border: 1px solid ${ACCENT}40;
            box-shadow: 0 10px 40px rgba(127,0,255,0.25);
            font: 13px/1.5 system-ui, sans-serif;
        `;

        const storeName = getStoreName();
        const storeLabel = getStoreLabel();
        const isDraft = isFilteredByDraft();

        box.innerHTML = `
            <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#0f172a,#1e1b4b);border-radius:16px 16px 0 0">
                <div>
                    <div style="font-weight:700;font-size:15px;color:#a78bfa">🔗 Shopify ID Extractor v3</div>
                    <div style="font-size:11px;color:#64748b">Loja: <strong style="color:#a78bfa">${storeLabel}</strong></div>
                </div>
                <button id="brk-shopify-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px">✕</button>
            </div>
            <div style="padding:14px 16px;display:grid;gap:12px">

                <div id="brk-shopify-status" style="color:#10b981;font-weight:600;font-size:13px">
                    ${isDraft ? '✅ Filtro RASCUNHO ativo' : '📋 Pronto para extrair'}
                </div>

                <!-- AÇÃO PRINCIPAL: EXTRAIR SELECIONADOS -->
                <div style="background:#1e1b4b;border-radius:10px;padding:12px;border:1px solid ${ACCENT}50">
                    <div style="font-size:12px;color:#a78bfa;font-weight:700;margin-bottom:6px">🎯 SELEÇÃO PERSONALIZADA</div>
                    <div style="font-size:11px;color:#94a3b8;line-height:1.5;margin-bottom:10px">
                        Marque as caixas de seleção (☑️) dos produtos que deseja importar e clique abaixo:
                    </div>
                    <button id="brk-extract-selected" style="width:100%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:0;border-radius:8px;padding:12px 14px;font-weight:700;cursor:pointer;font-size:14px;box-shadow:0 4px 12px rgba(16,185,129,0.3)">
                        🎯 Extrair APENAS os Produtos Marcados (☑️)
                    </button>
                </div>

                <!-- EXTRAÇÃO ALTERNATIVA (TODOS / FILTRO) -->
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button id="brk-extract-all" style="background:#334155;color:#fff;border:0;border-radius:8px;padding:9px 12px;font-weight:600;cursor:pointer;font-size:12px;flex:1">
                        🔍 Extrair Todos Visíveis
                    </button>
                    <button id="brk-filter-draft" style="background:#334155;color:#f59e0b;border:0;border-radius:8px;padding:9px 12px;font-weight:600;cursor:pointer;font-size:12px">
                        ${isDraft ? '✓ Já em Rascunho' : 'Filtrar Rascunho'}
                    </button>
                </div>

                <!-- RESULTADO -->
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">IDs Prontos para a Magis5</label>
                        <span id="brk-shopify-count" style="font-size:12px;color:#10b981;font-weight:700">0 selecionado(s)</span>
                    </div>
                    <textarea id="brk-shopify-ids" rows="6" readonly style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#020617;color:#10b981;font-family:monospace;font-size:12px;resize:vertical" placeholder="Marque os produtos na tabela da Shopify e clique 'Extrair APENAS os Marcados'..."></textarea>
                </div>

                <!-- BOTÃO COPIAR -->
                <button id="brk-copy-ids" style="background:linear-gradient(135deg,${ACCENT},#5B21B6);color:#fff;border:0;border-radius:8px;padding:11px 14px;font-weight:700;cursor:pointer;font-size:13px">
                    📋 Copiar IDs para o Clipboard
                </button>

                <!-- LOG -->
                <div>
                    <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px">Log</label>
                    <div id="brk-shopify-log" style="background:#020617;border-radius:10px;padding:10px;max-height:14vh;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;color:#64748b;border:1px solid #1e293b"></div>
                </div>

                <div style="font-size:10px;color:#475569;text-align:center;padding-top:4px;border-top:1px solid #1e293b">
                    Hook Prime v4.0 · Shopify Extractor v3 (Checkbox Mode)
                </div>
            </div>
        `;

        document.body.appendChild(box);

        // Bindings
        box.querySelector('#brk-shopify-close').onclick = () => box.remove();

        box.querySelector('#brk-extract-selected').onclick = () => {
            const selected = extractSelectedProductDetails();
            displayResults(selected, true);
        };

        box.querySelector('#brk-extract-all').onclick = () => {
            const products = extractProductDetails();
            displayResults(products, false);
        };

        box.querySelector('#brk-filter-draft').onclick = () => {
            if (isDraft) {
                log('Já está filtrado por Rascunho!', 'success');
                return;
            }
            log('Navegando para filtro Rascunho...');
            window.location.href = getDraftFilterUrl();
        };

        box.querySelector('#brk-copy-ids').onclick = async () => {
            const text = document.getElementById('brk-shopify-ids')?.value || '';
            if (!text) { log('Extraia os IDs primeiro!', 'warn'); return; }
            await navigator.clipboard.writeText(text);
            const count = text.split('\n').filter(l => l.trim()).length;
            log(`📋 ${count} IDs copiados! Cole no painel "🚀 Magis5 Import" na aba da Magis5.`, 'success');
            status(`📋 ${count} IDs copiados → Pronto para a Magis5!`);
        };

        log(`Loja: ${storeLabel} (${storeName})`);
        log('💡 Marque os checkboxes dos produtos desejados e clique no botão verde!');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INICIALIZAÇÃO                                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    setTimeout(buildLauncher, 3000);

    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (location.href.includes('/products')) setTimeout(buildLauncher, 2000);
        }
    }, 1000);

})();
