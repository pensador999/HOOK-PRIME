// ==UserScript==
// @name         Shopify ID Extractor — BRK
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extrai IDs de produtos da listagem Shopify + ativa produtos em massa + copia IDs para Magis5
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
    // ║  EXTRAÇÃO DE IDs                                                    ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Extrai IDs de todos os produtos visíveis na listagem.
     * A Shopify usa links com formato: /admin/products/{ID}
     * Também tenta extrair do React state e data attributes.
     */
    function extractProductIds() {
        const ids = new Set();

        // Estratégia 1: Links <a href="/store/.../products/{ID}">
        document.querySelectorAll('a[href*="/products/"]').forEach(link => {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/products\/(\d+)(?:\?|$|#)/);
            if (match) ids.add(match[1]);
        });

        // Estratégia 2: Links com formato /products/{ID} (sem query)
        if (ids.size === 0) {
            document.querySelectorAll('a[href*="/products/"]').forEach(link => {
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/products\/(\d{8,})/);
                if (match) ids.add(match[1]);
            });
        }

        // Estratégia 3: Rows na tabela de produtos — data attributes
        document.querySelectorAll('[data-primary-link-url*="/products/"]').forEach(el => {
            const url = el.getAttribute('data-primary-link-url') || '';
            const match = url.match(/\/products\/(\d+)/);
            if (match) ids.add(match[1]);
        });

        // Estratégia 4: Resource-list items com gid
        document.querySelectorAll('[data-resource-id]').forEach(el => {
            const gid = el.getAttribute('data-resource-id') || '';
            const match = gid.match(/(\d{8,})/);
            if (match) ids.add(match[1]);
        });

        return [...ids];
    }

    /**
     * Extrai informações detalhadas dos produtos visíveis:
     * ID, título, status, SKU (se visível)
     */
    function extractProductDetails() {
        const products = [];
        const seen = new Set();

        // Busca rows na tabela de produtos
        const rows = document.querySelectorAll('tr[class*="Row"], [class*="IndexTable-Row"], table tbody tr');

        for (const row of rows) {
            // Encontra o link do produto
            const link = row.querySelector('a[href*="/products/"]');
            if (!link) continue;

            const href = link.getAttribute('href') || '';
            const match = href.match(/\/products\/(\d+)/);
            if (!match) continue;

            const id = match[1];
            if (seen.has(id)) continue;
            seen.add(id);

            // Título
            const title = (link.textContent || '').trim();

            // Status (Rascunho / Ativo)
            const statusEl = row.querySelector('[class*="badge"], [class*="Badge"], span');
            let status = '';
            row.querySelectorAll('span').forEach(span => {
                const text = span.textContent.trim().toLowerCase();
                if (text === 'rascunho' || text === 'draft' || text === 'ativo' || text === 'active') {
                    status = text;
                }
            });

            products.push({ id, title, status });
        }

        // Fallback: se não encontrou por rows, usa links diretamente
        if (products.length === 0) {
            const links = document.querySelectorAll('a[href*="/products/"]');
            for (const link of links) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/\/products\/(\d{8,})/);
                if (!match) continue;
                const id = match[1];
                if (seen.has(id)) continue;
                seen.add(id);
                const title = (link.textContent || '').trim().substring(0, 80);
                if (title && title.length > 3) {
                    products.push({ id, title, status: '' });
                }
            }
        }

        return products;
    }

    /**
     * Filtra apenas produtos em rascunho
     */
    function extractDraftProducts() {
        const all = extractProductDetails();
        return all.filter(p =>
            p.status === 'rascunho' || p.status === 'draft' || p.status === ''
        );
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  FILTRO POR STATUS                                                  ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    /**
     * Verifica se a página está filtrando por rascunho
     */
    function isFilteredByDraft() {
        const url = window.location.href.toLowerCase();
        return url.includes('status=draft') || url.includes('rascunho');
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  UI — LOG E STATUS                                                  ║
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
            transition: transform 0.2s, box-shadow 0.2s;
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
            width: 480px; max-height: 85vh; overflow: auto;
            border-radius: 16px; border: 1px solid ${ACCENT}40;
            box-shadow: 0 10px 40px rgba(127,0,255,0.25);
            font: 13px/1.5 system-ui, sans-serif;
        `;

        // Detecta loja atual
        const storeMatch = window.location.href.match(/\/store\/([^/]+)/);
        const storeName = storeMatch ? storeMatch[1] : 'desconhecida';

        box.innerHTML = `
            <!-- Header -->
            <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#0f172a,#1e1b4b);border-radius:16px 16px 0 0">
                <div>
                    <div style="font-weight:700;font-size:15px;color:#a78bfa">🔗 Shopify ID Extractor</div>
                    <div style="font-size:11px;color:#64748b">Loja: <strong style="color:#a78bfa">${storeName}</strong></div>
                </div>
                <button id="brk-shopify-close" style="background:#ef4444;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px">✕</button>
            </div>

            <div style="padding:14px 16px;display:grid;gap:12px">

                <!-- Status -->
                <div id="brk-shopify-status" style="color:#10b981;font-weight:600;font-size:13px">Pronto</div>

                <!-- Botões de extração -->
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button id="brk-extract-all" style="background:linear-gradient(135deg,${ACCENT},#5B21B6);color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;font-size:13px;flex:1">🔍 Extrair TODOS os IDs</button>
                    <button id="brk-extract-draft" style="background:#334155;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;font-size:13px">📝 Só Rascunho</button>
                </div>

                <!-- Resultado -->
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">IDs Extraídos</label>
                        <span id="brk-shopify-count" style="font-size:12px;color:#64748b">0 produtos</span>
                    </div>
                    <textarea id="brk-shopify-ids" rows="8" readonly style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#020617;color:#10b981;font-family:monospace;font-size:12px;resize:vertical" placeholder="Clique em 'Extrair' para popular..."></textarea>
                </div>

                <!-- Detalhes -->
                <div>
                    <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Detalhes dos Produtos</label>
                    <textarea id="brk-shopify-details" rows="5" readonly style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#020617;color:#94a3b8;font-family:monospace;font-size:11px;resize:vertical" placeholder="ID  |  Título  |  Status"></textarea>
                </div>

                <!-- Botões de ação -->
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button id="brk-copy-ids" style="background:#059669;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px;flex:1">📋 Copiar IDs</button>
                    <button id="brk-copy-magis" style="background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px;flex:1">📦 Copiar p/ Magis5</button>
                </div>

                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button id="brk-scroll-load" style="background:#334155;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px;flex:1">⬇ Scroll + Carregar Todos</button>
                </div>

                <!-- Log -->
                <div>
                    <label style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:block">Log</label>
                    <div id="brk-shopify-log" style="background:#020617;border-radius:10px;padding:10px;max-height:15vh;overflow:auto;white-space:pre-wrap;font-family:monospace;font-size:11px;color:#64748b;border:1px solid #1e293b"></div>
                </div>

                <div style="font-size:11px;color:#475569;text-align:center;padding-top:4px;border-top:1px solid #1e293b">
                    HUB Hook Prime v4.0 · Shopify Extractor · Tampermonkey
                </div>
            </div>
        `;

        document.body.appendChild(box);

        // Event bindings
        box.querySelector('#brk-shopify-close').onclick = () => box.remove();

        box.querySelector('#brk-extract-all').onclick = () => {
            const products = extractProductDetails();
            displayResults(products);
        };

        box.querySelector('#brk-extract-draft').onclick = () => {
            const products = extractDraftProducts();
            displayResults(products);
        };

        box.querySelector('#brk-copy-ids').onclick = async () => {
            const text = document.getElementById('brk-shopify-ids')?.value || '';
            if (!text) { log('Nenhum ID extraído!', 'warn'); return; }
            await navigator.clipboard.writeText(text);
            log('IDs copiados para o clipboard!', 'success');
            status('📋 Copiado!');
        };

        box.querySelector('#brk-copy-magis').onclick = async () => {
            const text = document.getElementById('brk-shopify-ids')?.value || '';
            if (!text) { log('Nenhum ID extraído!', 'warn'); return; }
            // Formato para o Magis5 Import Autopilot (um ID por linha)
            await navigator.clipboard.writeText(text);
            log('IDs copiados no formato Magis5! Cole no painel "🚀 Magis5 Import"', 'success');
            status('📦 Pronto para Magis5!');
        };

        box.querySelector('#brk-scroll-load').onclick = async () => {
            await scrollAndLoadAll();
        };

        log('Painel aberto.', 'info');
        log(`Loja: ${storeName}`, 'info');
    }

    function displayResults(products) {
        const idsEl = document.getElementById('brk-shopify-ids');
        const detailsEl = document.getElementById('brk-shopify-details');
        const countEl = document.getElementById('brk-shopify-count');

        if (products.length === 0) {
            log('Nenhum produto encontrado na página. Tente "Scroll + Carregar Todos" primeiro.', 'warn');
            status('⚠ Nenhum produto encontrado');
            return;
        }

        // IDs (um por linha)
        const ids = products.map(p => p.id).join('\n');
        if (idsEl) idsEl.value = ids;

        // Detalhes
        const details = products.map(p =>
            `${p.id}  |  ${p.title.substring(0, 60)}  |  ${p.status || '—'}`
        ).join('\n');
        if (detailsEl) detailsEl.value = details;

        if (countEl) countEl.textContent = `${products.length} produto(s)`;

        status(`✅ ${products.length} produtos extraídos!`);
        log(`Extraídos ${products.length} produtos`, 'success');
        products.forEach(p => {
            log(`  ${p.id} — ${p.title.substring(0, 50)}${p.status ? ' [' + p.status + ']' : ''}`);
        });
    }

    /**
     * Scroll automático para carregar todos os produtos (lazy loading da Shopify)
     */
    async function scrollAndLoadAll() {
        log('⬇ Iniciando scroll automático para carregar todos os produtos...', 'info');
        status('Carregando produtos...');

        let lastCount = 0;
        let stableCount = 0;
        const maxStable = 5; // Para quando o count não muda por 5 iterações

        for (let i = 0; i < 100; i++) {
            // Scroll ao final da página
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(1500);

            const currentIds = extractProductIds();
            log(`  Scroll #${i + 1}: ${currentIds.length} produtos carregados`);

            if (currentIds.length === lastCount) {
                stableCount++;
                if (stableCount >= maxStable) {
                    log(`Todos os produtos carregados (${currentIds.length})`, 'success');
                    break;
                }
            } else {
                stableCount = 0;
                lastCount = currentIds.length;
            }

            // Tentar clicar "Mostrar mais" ou "Próximo"
            const nextBtns = document.querySelectorAll('button, a');
            for (const btn of nextBtns) {
                const text = (btn.textContent || '').trim().toLowerCase();
                if (text.includes('próxim') || text.includes('next') || text.includes('mostrar mais') || text.includes('load more')) {
                    try { btn.click(); } catch (_) {}
                    await sleep(2000);
                    break;
                }
            }
        }

        // Scroll de volta ao topo
        window.scrollTo(0, 0);

        const products = extractProductDetails();
        displayResults(products);
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  INICIALIZAÇÃO                                                      ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    // Aguarda a Shopify terminar de renderizar
    setTimeout(buildLauncher, 3000);

    // Re-check quando a URL muda (Shopify SPA)
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (location.href.includes('/products')) {
                setTimeout(buildLauncher, 2000);
            }
        }
    }, 1000);

})();
