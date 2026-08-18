/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — GSAP Animations System
   Animações premium: page transitions, card stagger, hover fx,
   counter animations, scroll-triggered reveals
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ═══ GSAP CHECK ═══
  function waitForGSAP(cb) {
    if (window.gsap) return cb();
    let tries = 0;
    const check = setInterval(() => {
      tries++;
      if (window.gsap || tries > 50) {
        clearInterval(check);
        if (window.gsap) cb();
        else console.warn('[GSAP] Não carregado após 5s');
      }
    }, 100);
  }

  // ═══ PAGE TRANSITIONS ═══
  function animatePageIn() {
    if (!window.gsap) return;
    const content = document.getElementById('app-content');
    if (!content) return;

    gsap.fromTo(content,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
    );

    // Stagger cards
    requestAnimationFrame(() => {
      const cards = content.querySelectorAll('.card, .module-card, .stat-card, .grid > div');
      if (cards.length > 0) {
        gsap.fromTo(cards,
          { opacity: 0, y: 30, scale: 0.95 },
          {
            opacity: 1, y: 0, scale: 1,
            duration: 0.5,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }
    });
  }

  // ═══ COUNTER ANIMATIONS (Odômetro) ═══
  function animateCounter(element, targetValue, duration = 1.2) {
    if (!window.gsap || !element) return;

    const isNumeric = !isNaN(parseFloat(targetValue));
    if (!isNumeric) {
      element.textContent = targetValue;
      return;
    }

    const target = parseFloat(targetValue);
    const obj = { val: 0 };

    gsap.to(obj, {
      val: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        element.textContent = Math.round(obj.val).toLocaleString('pt-BR');
      }
    });
  }

  // ═══ HOVER EFFECTS ═══
  function initHoverEffects() {
    if (!window.gsap) return;

    // Cards
    document.addEventListener('mouseenter', (e) => {
      const card = e.target.closest('.card, .module-card, .stat-card');
      if (card) {
        gsap.to(card, {
          scale: 1.02,
          boxShadow: '0 8px 40px rgba(10, 228, 72, 0.08)',
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.card, .module-card, .stat-card');
      if (card) {
        gsap.to(card, {
          scale: 1,
          boxShadow: 'none',
          duration: 0.3,
          ease: 'power2.out',
          clearProps: 'boxShadow',
        });
      }
    }, true);

    // Buttons — spring bounce
    document.addEventListener('mouseenter', (e) => {
      const btn = e.target.closest('.btn, button.btn--primary');
      if (btn) {
        gsap.to(btn, { scale: 1.05, duration: 0.2, ease: 'back.out(2)' });
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const btn = e.target.closest('.btn, button.btn--primary');
      if (btn) {
        gsap.to(btn, { scale: 1, duration: 0.25, ease: 'power2.out' });
      }
    }, true);

    // Sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar__link');
    sidebarLinks.forEach(link => {
      link.addEventListener('mouseenter', () => {
        gsap.to(link, { x: 6, duration: 0.25, ease: 'power2.out' });
      });
      link.addEventListener('mouseleave', () => {
        gsap.to(link, { x: 0, duration: 0.25, ease: 'power2.out' });
      });
    });
  }

  // ═══ SIDEBAR ENTRANCE ═══
  function animateSidebar() {
    if (!window.gsap) return;
    const links = document.querySelectorAll('.sidebar__link');
    const logo = document.querySelector('.sidebar__logo');

    if (logo) {
      gsap.fromTo(logo,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }
      );
    }

    if (links.length > 0) {
      gsap.fromTo(links,
        { opacity: 0, x: -30 },
        {
          opacity: 1, x: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: 'power3.out',
          delay: 0.2,
        }
      );
    }
  }

  // ═══ TOPBAR ENTRANCE ═══
  function animateTopbar() {
    if (!window.gsap) return;
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      gsap.fromTo(topbar,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 }
      );
    }
  }

  // ═══ STATS ANIMATION ═══
  function animateStats(container) {
    if (!window.gsap) return;
    const statEls = (container || document).querySelectorAll('.stat-card__value, .ap-stat__value, .rtx-stat__value');
    statEls.forEach(el => {
      const raw = el.textContent.trim();
      const num = parseFloat(raw.replace(/[^\d.-]/g, ''));
      if (!isNaN(num) && num > 0) {
        animateCounter(el, num, 1.5);
      }
    });
  }

  // ═══ TOAST ANIMATION ═══
  function animateToast(toastEl) {
    if (!window.gsap || !toastEl) return;
    gsap.fromTo(toastEl,
      { opacity: 0, x: 80, scale: 0.9 },
      { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
    );
  }

  // ═══ HOOK INTO APP NAVIGATION ═══
  function hookNavigation() {
    const origNavigate = window.HUB.navigate;
    if (!origNavigate) return;

    window.HUB.navigate = function (page) {
      const content = document.getElementById('app-content');
      if (content && window.gsap) {
        gsap.to(content, {
          opacity: 0, y: -10,
          duration: 0.15,
          ease: 'power2.in',
          onComplete: () => {
            origNavigate(page);
            // After render, animate in
            requestAnimationFrame(() => {
              animatePageIn();
            });
          }
        });
      } else {
        origNavigate(page);
      }
    };
  }

  // ═══ INIT ═══
  waitForGSAP(() => {
    document.addEventListener('DOMContentLoaded', () => {
      animateSidebar();
      animateTopbar();
      initHoverEffects();

      // Hook into navigation after app.js loads
      setTimeout(() => {
        hookNavigation();
        animatePageIn();
      }, 200);
    });
  });

  // ═══ EXPORT ═══
  window.HUB.gsapFx = {
    animatePageIn,
    animateCounter,
    animateStats,
    animateToast,
    initHoverEffects,
  };

})();
