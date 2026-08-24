// ==UserScript==
// @name         Extrator de SKUs - Sankhya (iframe)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  SOMENTE LEITURA — pesquisa via scope.query + integração automática Magis5
// @match        https://brk.sankhyacloud.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    if (!document.title.toLowerCase().includes('sankhya') && !window.location.href.toLowerCase().includes('sankhya')) {
        return;
    }

    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║  CONFIGURAÇÃO                                                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝
    const CFG = {
        delaySugestoes: 1500,   // tempo para loadSuggestions() renderizar resultados
        tentativas: 3,          // tentativas de leitura por SKU
        delayEntreSKUs: 800,    // pausa entre um SKU e outro
        timeoutInput: 25000,    // timeout para achar o input na 1ª vez
    };

    const norm = s => (s || '').replace(/\r/g,'').trim();
    const sleep = ms => new Promise(r => setTimeout(r, ms));

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

})();
