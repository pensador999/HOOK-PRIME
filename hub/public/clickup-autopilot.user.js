// ==UserScript==
// @name         HOOK PRIME - ClickUp Autopilot
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @updateURL    http://localhost:3001/userscripts/clickup-autopilot.user.js
// @downloadURL  http://localhost:3001/userscripts/clickup-autopilot.user.js
// @description  Integra as tarefas do ClickUp com o Hub local do HOOK PRIME
// @author       HOOK PRIME
// @match        https://app.clickup.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    const HUB_URL = 'http://localhost:3001/api/autopilot/tasks';

    function createHookButton() {
        const btn = document.createElement('button');
        btn.id = 'hook-prime-btn';
        btn.innerText = '🚀 Enviar para HOOK PRIME';
        btn.style.cssText = `
            background: linear-gradient(135deg, #668800, #AAFF00);
            color: #FFFFFF;
            border: none;
            padding: 6px 14px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 12px;
            cursor: pointer;
            margin-left: 15px;
            box-shadow: 0 4px 10px rgba(10, 186, 181, 0.3);
            z-index: 9999;
            transition: all 0.2s;
        `;
        
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            btn.innerText = 'Enviando...';
            btn.style.opacity = '0.7';

            // Capturar dados da tarefa
            let title = '';
            let description = '';

            // Tentar capturar o título
            const titleEl = document.querySelector('cu-task-title textarea') || document.querySelector('.cu-task-title__text') || document.querySelector('h1');
            if (titleEl) {
                title = titleEl.value || titleEl.innerText || titleEl.textContent;
            }

            // Tentar capturar a descrição — múltiplos seletores (ClickUp muda frequentemente)
            const descSelectors = [
                '.cu-task-description .ProseMirror',
                '.cu-task-description',
                '.ql-editor',
                '.ProseMirror',
                '.task-description',
                '.cu-task-body__description',
                '[data-testid="task-description"]',
                '.cu-rich-text__content',
                '.cu-editor-content',
                '.task-detail__description',
                '.cu-markdown__content'
            ];
            
            for (const sel of descSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const text = el.innerText || el.textContent || '';
                    if (text.trim().length > 5) {
                        description = text.trim();
                        break;
                    }
                }
            }

            // Fallback: capturar texto de toda a view da tarefa (pega tudo, incluindo códigos)
            if (!description || description.trim().length < 10) {
                const taskView = document.querySelector('.cu-task-view-modal') 
                    || document.querySelector('.cu-modal__inner')
                    || document.querySelector('[data-testid="task-detail-view"]')
                    || document.querySelector('.cu-panel__body');
                if (taskView) {
                    description = taskView.innerText || taskView.textContent || '';
                }
            }

            // Disparar requisição para o HUB local
            GM_xmlhttpRequest({
                method: "POST",
                url: HUB_URL,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    url: window.location.href
                }),
                onload: function(res) {
                    if(res.status === 200) {
                        btn.innerText = '✅ Enviado!';
                        btn.style.background = '#88CC00';
                        setTimeout(() => {
                            btn.innerText = '🚀 Enviar para HOOK PRIME';
                            btn.style.background = 'linear-gradient(135deg, #668800, #AAFF00)';
                            btn.style.opacity = '1';
                        }, 3000);
                    } else {
                        btn.innerText = '❌ Erro no Hub';
                        console.error('Erro HUB:', res.responseText);
                    }
                },
                onerror: function(err) {
                    console.error('Erro na requisição', err);
                    btn.innerText = '❌ Hub Offline';
                    alert('Verifique se o seu servidor do HOOK PRIME está rodando no localhost:3001');
                }
            });
        };

        return btn;
    }

    // Observador para inserir o botão na barra de título da tarefa quando for aberta
    const observer = new MutationObserver(() => {
        // ClickUp muda as classes constantemente, procuramos locais comuns na barra superior da tarefa
        const headerToolbar = document.querySelector('.cu-task-view-header__actions') || document.querySelector('.cu-task-view-header__right') || document.querySelector('.cu-task-title-bar');
        
        if (headerToolbar && !document.getElementById('hook-prime-btn')) {
            const btn = createHookButton();
            headerToolbar.prepend(btn);
        }

        autoScanBoard();
    });

    // Floating Status Badge
    function createStatusBadge() {
        const badge = document.createElement('div');
        badge.id = 'hook-prime-status';
        badge.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            z-index: 99999;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            transition: all 0.3s;
            background: #333;
        `;
        badge.innerText = 'HOOK PRIME: Verificando...';
        document.body.appendChild(badge);
        return badge;
    }

    function updateStatus(isOnline) {
        let badge = document.getElementById('hook-prime-status');
        if (!badge) badge = createStatusBadge();
        if (isOnline) {
            badge.innerText = '🟢 HOOK PRIME Connected';
            badge.style.background = 'linear-gradient(135deg, #668800, #AAFF00)';
        } else {
            badge.innerText = '🔴 HOOK PRIME Offline';
            badge.style.background = '#666';
        }
    }

    function pingHub() {
        GM_xmlhttpRequest({
            method: "GET",
            url: 'http://localhost:3001/api/autopilot/ping',
            onload: function(res) { updateStatus(true); },
            onerror: function(err) { updateStatus(false); }
        });
    }

    let hasAutoScanned = false;
    function autoScanBoard() {
        if (!window.location.href.includes('app.clickup.com/12901270')) return;
        if (hasAutoScanned) return;

        const columns = Array.from(document.querySelectorAll('.cu-panel-board__column, .cu-board-column, .cu-data-view-item'));
        const todoColumn = columns.find(col => {
            const text = col.innerText || '';
            return text.toUpperCase().includes('A FAZER') || text.toUpperCase().includes('TO DO');
        });
        
        if (todoColumn) {
            const tasks = Array.from(todoColumn.querySelectorAll('.cu-panel-board__card, .cu-board-card, [data-test="task-card"], .cu-task-row'));
            if (tasks.length > 0) {
                hasAutoScanned = true; // Só faz o scan uma vez
                
                tasks.forEach(task => {
                    const titleEl = task.querySelector('[data-test="task-row__name"], .cu-panel-board__card-title, .cu-board-card__title, .task-name');
                    const title = titleEl ? (titleEl.innerText || titleEl.textContent).trim() : '';
                    const linkEl = task.querySelector('a');
                    const url = linkEl ? linkEl.href : window.location.href;
                    
                    if (title) {
                        GM_xmlhttpRequest({
                            method: "POST",
                            url: HUB_URL,
                            headers: { "Content-Type": "application/json" },
                            data: JSON.stringify({ title, description: title, url }),
                            onload: function(res) {
                                if (res.status === 200) updateStatus(true);
                            },
                            onerror: function(err) {
                                updateStatus(false);
                            }
                        });
                    }
                });
            }
        }
    }

    // Ping initial status
    pingHub();
    setInterval(pingHub, 30000); // verify every 30s

    observer.observe(document.body, { childList: true, subtree: true });

})();
