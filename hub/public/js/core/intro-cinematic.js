/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — Cinematic Intro Experience
   5-second immersive intro with ninja reveal, atmospheric layers,
   particle system, SVG energy, and system transition
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ═══ GUARDS ═══
  if (sessionStorage.getItem('hp-intro-seen') === 'true') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ═══ CONFIG ═══
  const DURATION = 5.5; // total seconds
  const PARTICLE_COUNT = 50;

  // ═══ STATE ═══
  let particles = [];
  let particleCtx = null;
  let particleCanvas = null;
  let rafId = null;
  let burstPhase = false;

  // ═══ BUILD DOM ═══
  function buildIntro() {
    // Hide app
    const appWrapper = document.querySelector('.app-wrapper');
    if (appWrapper) appWrapper.style.visibility = 'hidden';

    const intro = document.createElement('div');
    intro.id = 'hp-intro';
    intro.innerHTML = `
      <div class="hp-intro-layer hp-intro-black"></div>
      <div class="hp-intro-layer hp-intro-clouds-far">
        <img src="assets/intro/clouds-bg.jpg" alt="" draggable="false">
      </div>
      <div class="hp-intro-layer hp-intro-mist"></div>
      <div class="hp-intro-layer hp-intro-red-atmo"></div>
      <div class="hp-intro-layer hp-intro-ninja">
        <img src="assets/intro/ninja-hero.jpg" alt="" draggable="false">
      </div>
      <canvas class="hp-intro-layer hp-intro-particles"></canvas>
      <svg class="hp-intro-layer hp-intro-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        <path d="M200,300 Q350,100 500,300 T800,300" fill="none" stroke="rgba(10,228,72,0.35)" stroke-width="1.5" class="hp-svg-path"/>
        <path d="M100,350 Q300,150 500,350 T900,350" fill="none" stroke="rgba(10,228,72,0.25)" stroke-width="1" class="hp-svg-path"/>
        <path d="M300,250 Q400,50 500,250 T700,250" fill="none" stroke="rgba(10,228,72,0.3)" stroke-width="1.2" class="hp-svg-path"/>
        <path d="M0,400 Q250,200 500,400 T1000,400" fill="none" stroke="rgba(10,228,72,0.15)" stroke-width="0.8" class="hp-svg-path"/>
        <circle cx="500" cy="300" r="80" fill="none" stroke="rgba(10,228,72,0.2)" stroke-width="0.5" class="hp-svg-path"/>
        <circle cx="500" cy="300" r="150" fill="none" stroke="rgba(10,228,72,0.1)" stroke-width="0.5" class="hp-svg-path"/>
      </svg>
      <div class="hp-intro-layer hp-intro-text">
        <div class="hp-intro-title" id="hp-intro-title"></div>
        <div class="hp-intro-subtitle">SISTEMA ATIVADO</div>
      </div>
      <div class="hp-intro-layer hp-intro-flash"></div>
      <div class="hp-intro-layer hp-intro-wipe"></div>
    `;

    document.body.prepend(intro);
    return intro;
  }

  // ═══ PARTICLE SYSTEM ═══
  function initParticles(canvas) {
    particleCanvas = canvas;
    particleCtx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 1.2 - 0.3,
        size: Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        life: 1,
      });
    }

    renderParticles();
  }

  function renderParticles() {
    if (!particleCtx) return;
    const ctx = particleCtx;
    const w = particleCanvas.width;
    const h = particleCanvas.height;

    ctx.clearRect(0, 0, w, h);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      if (burstPhase) {
        // Burst: scatter outward from center
        const cx = w / 2;
        const cy = h / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.vx += (dx / dist) * 0.8;
        p.vy += (dy / dist) * 0.8;
        p.vx *= 0.98;
        p.vy *= 0.98;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.002;

      if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        if (!burstPhase) {
          p.x = Math.random() * w;
          p.y = h + 10;
          p.vy = -Math.random() * 1.2 - 0.3;
          p.vx = (Math.random() - 0.5) * 0.5;
          p.life = 1;
        } else {
          particles.splice(i, 1);
          continue;
        }
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(10, 228, 72, ${p.alpha * p.life})`;
      ctx.fill();
    }

    rafId = requestAnimationFrame(renderParticles);
  }

  // ═══ SVG DRAW ═══
  function setupSVGPaths() {
    const paths = document.querySelectorAll('.hp-svg-path');
    paths.forEach(path => {
      if (path.getTotalLength) {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
      }
    });
  }

  // ═══ TEXT ANIMATION ═══
  function buildTitle() {
    const titleEl = document.getElementById('hp-intro-title');
    if (!titleEl) return;
    const text = 'HOOK PRIME';
    titleEl.innerHTML = text.split('').map(c =>
      c === ' '
        ? '<span class="hp-intro-char">&nbsp;</span>'
        : `<span class="hp-intro-char">${c}</span>`
    ).join('');
  }

  // ═══ MASTER TIMELINE ═══
  function createTimeline() {
    const tl = gsap.timeline({
      onComplete: () => cleanup(),
    });

    // ── 0.0s–1.0s: ATMOSPHERE ──
    tl.to('.hp-intro-black', { opacity: 0, duration: 1, ease: 'power2.out' }, 0)
      .fromTo('.hp-intro-clouds-far img', { scale: 1.25, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 1.5, ease: 'power1.out' }, 0)
      .fromTo('.hp-intro-mist', { opacity: 0 }, { opacity: 0.4, duration: 1.2, ease: 'power1.inOut' }, 0.3)
      .fromTo('.hp-intro-red-atmo', { opacity: 0 }, { opacity: 1, duration: 1.5, ease: 'power1.inOut' }, 0.5);

    // ── 1.0s–2.2s: APPROACH ──
    tl.to('.hp-intro-clouds-far img', { scale: 1.35, duration: 3.5, ease: 'none' }, 1)
      .to('.hp-intro-mist', { opacity: 0.6, x: 30, duration: 2, ease: 'none' }, 1)
      .fromTo('.hp-intro-ninja img', { opacity: 0, scale: 0.85, y: 40, filter: 'blur(20px)' },
        { opacity: 0.3, scale: 0.9, y: 20, filter: 'blur(10px)', duration: 1.2, ease: 'power2.out' }, 1.2);

    // ── 2.2s–3.5s: NINJA REVEAL ──
    tl.to('.hp-intro-ninja img', {
      opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
      duration: 1.3, ease: 'power3.out',
    }, 2.2)
      .to('.hp-intro-particles', { opacity: 1, duration: 0.5 }, 2.2);

    // SVG draw
    tl.to('.hp-svg-path', {
      strokeDashoffset: 0,
      duration: 2,
      stagger: 0.15,
      ease: 'power2.inOut',
    }, 2.5);

    // ── 3.5s–4.3s: ENERGY BURST ──
    // Title chars
    tl.fromTo('.hp-intro-char', {
      opacity: 0, y: 50, rotateX: -90,
    }, {
      opacity: 1, y: 0, rotateX: 0,
      stagger: 0.04, duration: 0.5, ease: 'back.out(2)',
    }, 3.5);

    // Subtitle
    tl.fromTo('.hp-intro-subtitle', {
      opacity: 0, letterSpacing: '30px',
    }, {
      opacity: 0.6, letterSpacing: '12px',
      duration: 0.6, ease: 'power3.out',
    }, 3.8);

    // Green flash
    tl.to('.hp-intro-flash', {
      opacity: 0.5, duration: 0.08, ease: 'none',
    }, 4.0)
      .to('.hp-intro-flash', {
        opacity: 0, duration: 0.15, ease: 'power2.out',
      }, 4.08);

    // Trigger particle burst
    tl.call(() => { burstPhase = true; }, null, 4.0);

    // ── 4.3s–5.5s: TRANSITION TO SYSTEM ──
    tl.to('.hp-intro-ninja img', {
      scale: 1.15, opacity: 0, duration: 0.7, ease: 'power2.in',
    }, 4.3)
      .to('.hp-intro-text', {
        scale: 1.1, opacity: 0, duration: 0.5, ease: 'power2.in',
      }, 4.3)
      .to('.hp-intro-svg', {
        scale: 1.2, opacity: 0, duration: 0.6, ease: 'power2.in',
      }, 4.4)
      .to('.hp-intro-clouds-far', {
        scale: 1.4, opacity: 0, duration: 0.8, ease: 'power2.in',
      }, 4.3);

    // Wipe
    tl.fromTo('.hp-intro-wipe', {
      clipPath: 'circle(0% at 50% 50%)',
      backgroundColor: '#0a0a0a',
      opacity: 1,
    }, {
      clipPath: 'circle(100% at 50% 50%)',
      duration: 0.8, ease: 'power3.inOut',
    }, 4.5);

    // Final fade
    tl.to('#hp-intro', { opacity: 0, duration: 0.3, ease: 'power2.out' }, 5.2);

    return tl;
  }

  // ═══ CLEANUP ═══
  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    particleCtx = null;
    particles = [];

    const intro = document.getElementById('hp-intro');
    if (intro) intro.remove();

    const appWrapper = document.querySelector('.app-wrapper');
    if (appWrapper) {
      appWrapper.style.visibility = 'visible';
      if (window.gsap) {
        gsap.fromTo(appWrapper,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: 'power2.out' }
        );
      }
    }

    sessionStorage.setItem('hp-intro-seen', 'true');
  }

  // ═══ INIT ═══
  function init() {
    if (!window.gsap) {
      // No GSAP, skip
      const appWrapper = document.querySelector('.app-wrapper');
      if (appWrapper) appWrapper.style.visibility = 'visible';
      return;
    }

    buildIntro();
    buildTitle();
    setupSVGPaths();

    const canvas = document.querySelector('.hp-intro-particles');
    if (canvas) initParticles(canvas);

    // Start timeline after images preload
    const imgs = document.querySelectorAll('#hp-intro img');
    let loaded = 0;
    const total = imgs.length;

    function checkReady() {
      loaded++;
      if (loaded >= total) {
        requestAnimationFrame(() => createTimeline());
      }
    }

    imgs.forEach(img => {
      if (img.complete) { checkReady(); }
      else {
        img.addEventListener('load', checkReady);
        img.addEventListener('error', checkReady);
      }
    });

    // Fallback: start after 2s even if images fail
    setTimeout(() => {
      if (document.getElementById('hp-intro')) {
        createTimeline();
      }
    }, 2000);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
