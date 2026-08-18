/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — GSAP Enterprise Animation System v2.0
   Nível Showcase: SVG Morphing, Text Split Animations,
   Magnetic Buttons, Cursor Glow, ScrollTrigger Reveals,
   Parallax Layers, Stagger Orchestration
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  function waitForGSAP(cb) {
    if (window.gsap) return cb();
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (window.gsap || tries > 50) { clearInterval(iv); if (window.gsap) cb(); }
    }, 100);
  }

  // ═══════════════════════════════════════════════
  //  1. CURSOR GLOW FOLLOWER
  // ═══════════════════════════════════════════════
  function initCursorGlow() {
    const glow = document.createElement('div');
    glow.className = 'hp-cursor-glow';
    document.body.appendChild(glow);

    const ring = document.createElement('div');
    ring.className = 'hp-cursor-ring';
    document.body.appendChild(ring);

    let mx = -100, my = -100;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
    });

    // Smooth follow with GSAP ticker
    gsap.ticker.add(() => {
      gsap.set(glow, { x: mx, y: my });
      gsap.to(ring, { x: mx, y: my, duration: 0.5, ease: 'power3.out' });
    });

    // Scale up on interactive elements
    document.addEventListener('mouseenter', (e) => {
      if (e.target.closest('button, a, .card, .sidebar__link, .btn, input, select')) {
        gsap.to(glow, { scale: 2.5, opacity: 0.15, duration: 0.3 });
        gsap.to(ring, { scale: 1.8, borderColor: 'rgba(10,228,72,0.5)', duration: 0.3 });
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      if (e.target.closest('button, a, .card, .sidebar__link, .btn, input, select')) {
        gsap.to(glow, { scale: 1, opacity: 0.08, duration: 0.3 });
        gsap.to(ring, { scale: 1, borderColor: 'rgba(255,255,255,0.15)', duration: 0.3 });
      }
    }, true);
  }

  // ═══════════════════════════════════════════════
  //  2. MAGNETIC BUTTONS
  // ═══════════════════════════════════════════════
  function initMagneticButtons() {
    document.addEventListener('mousemove', (e) => {
      const btns = document.querySelectorAll('.btn--primary, .btn--magnetic, .card--glow');
      btns.forEach(btn => {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 120;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          gsap.to(btn, {
            x: dx * force * 0.3,
            y: dy * force * 0.3,
            duration: 0.4,
            ease: 'power3.out',
          });
        } else {
          gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
        }
      });
    });
  }

  // ═══════════════════════════════════════════════
  //  3. TEXT SPLIT ANIMATION
  // ═══════════════════════════════════════════════
  function animateTextSplit(selector, options = {}) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (el.dataset.animated === 'true') return;
      el.dataset.animated = 'true';

      const text = el.textContent;
      const type = options.type || 'chars'; // 'chars' | 'words'

      if (type === 'chars') {
        el.innerHTML = text.split('').map(char =>
          char === ' '
            ? '<span class="hp-split-char" style="display:inline-block">&nbsp;</span>'
            : `<span class="hp-split-char" style="display:inline-block">${char}</span>`
        ).join('');

        gsap.fromTo(el.querySelectorAll('.hp-split-char'),
          { opacity: 0, y: 40, rotateX: -90 },
          {
            opacity: 1, y: 0, rotateX: 0,
            duration: options.duration || 0.6,
            stagger: options.stagger || 0.02,
            ease: options.ease || 'back.out(2)',
            delay: options.delay || 0,
          }
        );
      } else {
        el.innerHTML = text.split(' ').map(word =>
          `<span class="hp-split-word" style="display:inline-block;overflow:hidden"><span style="display:inline-block">${word}</span></span>`
        ).join(' ');

        gsap.fromTo(el.querySelectorAll('.hp-split-word > span'),
          { y: '110%' },
          {
            y: '0%',
            duration: options.duration || 0.8,
            stagger: options.stagger || 0.05,
            ease: options.ease || 'power4.out',
            delay: options.delay || 0,
          }
        );
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  4. SVG DRAW ANIMATION
  // ═══════════════════════════════════════════════
  function animateSVGDraw(svgSelector, options = {}) {
    const paths = document.querySelectorAll(`${svgSelector} path, ${svgSelector} line, ${svgSelector} circle, ${svgSelector} polyline`);
    paths.forEach(path => {
      const length = path.getTotalLength ? path.getTotalLength() : 100;
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(path, {
        strokeDashoffset: 0,
        duration: options.duration || 2,
        ease: options.ease || 'power2.inOut',
        delay: options.delay || 0,
        stagger: options.stagger || 0.1,
      });
    });
  }

  // ═══════════════════════════════════════════════
  //  5. STAGGER CARD REVEAL
  // ═══════════════════════════════════════════════
  function staggerReveal(selector, options = {}) {
    const els = document.querySelectorAll(selector);
    if (els.length === 0) return;

    gsap.fromTo(els,
      {
        opacity: 0,
        y: options.y || 60,
        scale: options.scale || 0.92,
        rotateY: options.rotateY || 0,
        filter: 'blur(8px)',
      },
      {
        opacity: 1, y: 0, scale: 1, rotateY: 0,
        filter: 'blur(0px)',
        duration: options.duration || 0.7,
        stagger: {
          each: options.stagger || 0.08,
          from: options.from || 'start',
        },
        ease: options.ease || 'power3.out',
        delay: options.delay || 0,
        clearProps: 'transform,filter',
      }
    );
  }

  // ═══════════════════════════════════════════════
  //  6. NUMBER COUNTER (Odômetro Premium)
  // ═══════════════════════════════════════════════
  function animateCounter(element, targetValue, duration = 1.5) {
    if (!element) return;
    const isNum = !isNaN(parseFloat(targetValue));
    if (!isNum) { element.textContent = targetValue; return; }

    const target = parseFloat(targetValue);
    const obj = { val: 0 };

    gsap.to(obj, {
      val: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        element.textContent = Math.round(obj.val).toLocaleString('pt-BR');
      },
      onComplete: () => {
        // Subtle pulse when done
        gsap.fromTo(element,
          { scale: 1.2, color: '#0ae448' },
          { scale: 1, color: '', duration: 0.4, ease: 'elastic.out(1, 0.5)' }
        );
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  7. PAGE TRANSITIONS (Cinema-Grade)
  // ═══════════════════════════════════════════════
  function animatePageIn() {
    const content = document.getElementById('app-content');
    if (!content) return;

    // Main content fade + slide
    gsap.fromTo(content,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
    );

    // Stagger all cards, grids, sections
    requestAnimationFrame(() => {
      staggerReveal('.card, .module-card, .stat-card', { delay: 0.1 });
      staggerReveal('.grid > div', { delay: 0.2, stagger: 0.06 });

      // Animate titles with text split
      animateTextSplit('.card__title, .content h2, .content h3', { type: 'words', delay: 0.15 });

      // Animate stats
      const stats = content.querySelectorAll('.stat-card__value');
      stats.forEach(el => {
        const num = parseFloat(el.textContent.replace(/[^\d.-]/g, ''));
        if (!isNaN(num) && num > 0) animateCounter(el, num);
      });
    });
  }

  // ═══════════════════════════════════════════════
  //  8. HOVER EFFECTS (Premium)
  // ═══════════════════════════════════════════════
  function initHoverEffects() {
    // Cards — tilt 3D
    document.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.card, .module-card');
      if (!card || card.dataset.tilt === 'disabled') return;

      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      gsap.to(card, {
        rotateY: x * 8,
        rotateX: -y * 5,
        transformPerspective: 800,
        duration: 0.4,
        ease: 'power2.out',
      });
    });

    document.addEventListener('mouseleave', (e) => {
      const card = e.target.closest('.card, .module-card');
      if (card) {
        gsap.to(card, {
          rotateY: 0, rotateX: 0,
          duration: 0.6, ease: 'elastic.out(1, 0.6)',
        });
      }
    }, true);

    // Buttons — spring bounce
    document.addEventListener('mouseenter', (e) => {
      const btn = e.target.closest('.btn--primary, .btn');
      if (btn) gsap.to(btn, { scale: 1.06, duration: 0.25, ease: 'back.out(3)' });
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const btn = e.target.closest('.btn--primary, .btn');
      if (btn) gsap.to(btn, { scale: 1, duration: 0.3, ease: 'power2.out' });
    }, true);

    // Sidebar links — slide + icon bounce
    const links = document.querySelectorAll('.sidebar__link');
    links.forEach(link => {
      link.addEventListener('mouseenter', () => {
        gsap.to(link, { x: 8, duration: 0.3, ease: 'power3.out' });
        const icon = link.querySelector('svg, span:first-child');
        if (icon) gsap.fromTo(icon, { rotate: 0 }, { rotate: 10, yoyo: true, repeat: 1, duration: 0.15 });
      });
      link.addEventListener('mouseleave', () => {
        gsap.to(link, { x: 0, duration: 0.3, ease: 'power3.out' });
      });
    });
  }

  // ═══════════════════════════════════════════════
  //  9. SIDEBAR & TOPBAR ENTRANCE
  // ═══════════════════════════════════════════════
  function animateAppEntrance() {
    // Sidebar — stagger from left
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      gsap.fromTo(sidebar,
        { x: -60, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }
      );
    }

    const links = document.querySelectorAll('.sidebar__link');
    if (links.length) {
      gsap.fromTo(links,
        { opacity: 0, x: -40 },
        { opacity: 1, x: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', delay: 0.3 }
      );
    }

    // Logo
    const logo = document.querySelector('.sidebar__logo');
    if (logo) {
      gsap.fromTo(logo,
        { opacity: 0, scale: 0.8, rotate: -10 },
        { opacity: 1, scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)', delay: 0.1 }
      );
    }

    // Topbar
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      gsap.fromTo(topbar,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.2 }
      );
    }

    // Version badge
    const version = document.querySelector('.sidebar__version');
    if (version) {
      gsap.fromTo(version,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', delay: 0.8 }
      );
    }
  }

  // ═══════════════════════════════════════════════
  //  10. TOAST ANIMATION
  // ═══════════════════════════════════════════════
  function animateToast(el) {
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, x: 100, scale: 0.8, rotateZ: 5 },
      { opacity: 1, x: 0, scale: 1, rotateZ: 0, duration: 0.5, ease: 'back.out(2)' }
    );
  }

  // ═══════════════════════════════════════════════
  //  11. HOOK INTO APP NAVIGATION
  // ═══════════════════════════════════════════════
  function hookNavigation() {
    const origNavigate = window.HUB.navigate;
    if (!origNavigate) return;

    window.HUB.navigate = function (page) {
      const content = document.getElementById('app-content');
      if (content && window.gsap) {
        // Cinematic exit
        const tl = gsap.timeline();
        tl.to(content, { opacity: 0, y: -15, scale: 0.98, duration: 0.2, ease: 'power2.in' })
          .call(() => {
            origNavigate(page);
            requestAnimationFrame(() => animatePageIn());
          });
      } else {
        origNavigate(page);
      }
    };
  }

  // ═══════════════════════════════════════════════
  //  12. SVG HERO ANIMATION (Dashboard)
  // ═══════════════════════════════════════════════
  function createHeroSVG() {
    // Only on dashboard
    const content = document.getElementById('app-content');
    if (!content) return;

    const existing = content.querySelector('.hp-hero-svg');
    if (existing) return;

    // Create animated SVG circuit pattern in header
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hp-hero-svg');
    svg.setAttribute('viewBox', '0 0 400 80');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '80');
    svg.style.cssText = 'position:absolute;top:0;left:0;right:0;pointer-events:none;opacity:0.3;';

    // Create circuit-like paths
    const paths = [
      'M0,40 Q50,10 100,40 T200,40 T300,40 T400,40',
      'M0,60 Q80,30 160,60 T320,60 T400,60',
      'M0,20 Q60,50 120,20 T240,20 T400,20',
    ];

    paths.forEach((d, i) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', `rgba(10,228,72,${0.15 - i * 0.03})`);
      path.setAttribute('stroke-width', '1');
      svg.appendChild(path);
    });

    // Pulsing dots at intersections
    [50, 150, 250, 350].forEach(cx => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', 40);
      circle.setAttribute('r', '2');
      circle.setAttribute('fill', '#0ae448');
      circle.setAttribute('class', 'hp-hero-dot');
      svg.appendChild(circle);
    });

    const heroCard = content.querySelector('.card--glow, .module-card--hero');
    if (heroCard) {
      heroCard.style.position = 'relative';
      heroCard.style.overflow = 'hidden';
      heroCard.prepend(svg);

      // Animate paths drawing
      animateSVGDraw('.hp-hero-svg', { duration: 2.5, delay: 0.5 });

      // Pulse dots
      gsap.fromTo('.hp-hero-dot',
        { scale: 0, opacity: 0, transformOrigin: 'center' },
        { scale: 1, opacity: 1, duration: 0.4, stagger: 0.15, delay: 1.5, ease: 'back.out(3)' }
      );

      // Continuous pulse
      gsap.to('.hp-hero-dot', {
        scale: 1.5, opacity: 0.5,
        duration: 1.5, repeat: -1, yoyo: true,
        stagger: 0.3, ease: 'sine.inOut',
        delay: 2.5,
      });
    }
  }

  // ═══════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════
  waitForGSAP(() => {
    // Set GSAP defaults
    gsap.defaults({ overwrite: 'auto' });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  });

  function boot() {
    initCursorGlow();
    initMagneticButtons();
    initHoverEffects();
    animateAppEntrance();

    // Hook navigation after app.js loads
    setTimeout(() => {
      hookNavigation();
      animatePageIn();
      createHeroSVG();
    }, 300);
  }

  // ═══ EXPORT ═══
  window.HUB.gsapFx = {
    animatePageIn,
    animateCounter,
    animateTextSplit,
    animateSVGDraw,
    staggerReveal,
    animateToast,
    createHeroSVG,
  };

})();
