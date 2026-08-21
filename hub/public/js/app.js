/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — App Core (Router, Estado, Toasts, Relógio)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ───────── Estado global ─────────
  const state = {
    currentPage: 'dashboard',
    counters: {
      planilhas: 0,
      pastas: 0,
      fluxos: 1,
      tempo: '—'
    }
  };

  // Disponibiliza estado global
  window.HUB = window.HUB || {};

  // 🔒 HTML escape helper (TD-008: XSS prevention)
  window.HUB.esc = function(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
  window.HUB.state = state;

  // ───────── Mapa de páginas ─────────
  const pages = {
    dashboard:     { title: 'Dashboard',              render: () => window.HUB.renderDashboard?.() },
    autopilot:     { title: '🚀 Lucas RTX',           render: () => window.HUB.renderAutopilot?.() },
    spreadsheet:   { title: 'Gerador de Planilhas',    render: () => window.HUB.renderSpreadsheet?.() },
    folders:       { title: 'Gerenciador de Pastas',    render: () => window.HUB.renderFolders?.() },
    flow:          { title: 'Fluxo de Trabalho',        render: () => window.HUB.renderFlow?.() },
    images:           { title: 'Gerenciador de Imagens',    render: () => window.HUB.renderImageManager?.() },
    'image-crosser':  { title: '🔀 Cruzador de Imagens',   render: () => window.HUB.renderImageCrosser?.() },
    history:          { title: 'Histórico de Tarefas',      render: () => window.HUB.renderHistory?.() },
    'ean-viewer':     { title: 'EAN Viewer',              render: () => window.HUB.renderEanViewer?.() },
  };

  // ───────── Navegação SPA ─────────
  function navigate(page) {
    if (!pages[page]) return;
    state.currentPage = page;

    // Atualiza sidebar
    document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    // Atualiza título da top bar
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = pages[page].title;

    // Renderiza conteúdo (GSAP handles transition via gsap-init.js)
    const content = document.getElementById('app-content');
    pages[page].render();

    // Atualiza hash na URL
    history.pushState(null, '', `#${page}`);
  }

  // Disponibiliza navegação globalmente
  window.HUB.navigate = navigate;

  // ───────── Relógio na top bar ─────────
  function updateClock() {
    const el = document.getElementById('topbar-time');
    if (!el) return;
    const now = new Date();
    const opts = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
    let formatted = now.toLocaleDateString('pt-BR', opts);
    // Capitaliza primeira letra
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    el.textContent = formatted;
  }

  // ───────── Sistema de Toast ─────────
  /**
   * Exibe uma notificação toast
   * @param {string} message - Mensagem a exibir
   * @param {'success'|'error'|'info'|'warning'} type - Tipo do toast
   * @param {number} duration - Duração em ms (padrão 3500)
   */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✅',
      error:   '❌',
      info:    'ℹ️',
      warning: '⚠️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast__message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.classList.add('toast--removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  window.HUB.showToast = showToast;

  // ───────── Inicialização ─────────
  document.addEventListener('DOMContentLoaded', () => {
    // Listeners da sidebar
    document.querySelectorAll('.sidebar__link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.page);
      });
    });

    // Relógio — atualiza imediatamente e depois a cada minuto
    updateClock();
    setInterval(updateClock, 60000);

    // Rota inicial baseada no hash
    const hash = location.hash.replace('#', '');
    const initialPage = pages[hash] ? hash : 'dashboard';
    navigate(initialPage);

    // Botão Voltar / Avançar do navegador
    window.addEventListener('popstate', () => {
      const h = location.hash.replace('#', '');
      if (pages[h]) navigate(h);
    });
  });
})();
