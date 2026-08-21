/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — Cinematic Video Intro v3
   Live wallpaper video background + GSAP text reveal
   Replaces Three.js 3D scene with video for performance & quality
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ═══ GUARDS ═══
  if (sessionStorage.getItem('hp-intro-seen') === 'true') {
    var aw = document.querySelector('.app-wrapper');
    if (aw) aw.style.visibility = 'visible';
    return;
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var aw2 = document.querySelector('.app-wrapper');
    if (aw2) aw2.style.visibility = 'visible';
    sessionStorage.setItem('hp-intro-seen', 'true');
    return;
  }

  // ═══ APP VISIBILITY ═══
  function hideApp() {
    var w = document.querySelector('.app-wrapper');
    if (w) w.style.visibility = 'hidden';
  }

  function showApp() {
    var w = document.querySelector('.app-wrapper');
    if (w) {
      w.style.visibility = 'visible';
      if (window.gsap) gsap.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' });
    }
    sessionStorage.setItem('hp-intro-seen', 'true');
  }

  hideApp();

  // ═══ WAIT FOR GSAP ═══
  function waitForGsap(cb) {
    if (window.gsap) return cb();
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.gsap || tries > 60) {
        clearInterval(iv);
        if (window.gsap) cb();
        else { showApp(); }
      }
    }, 100);
  }

  waitForGsap(function () { init(); });

  // ═══ INIT ═══
  function init() {
    // ── Create intro container ──
    var intro = document.createElement('div');
    intro.id = 'hp-intro';
    intro.innerHTML = [
      // Video background
      '<video class="hp-intro-video" autoplay muted loop playsinline>',
      '  <source src="assets/intro-video.mp4" type="video/mp4">',
      '</video>',
      // Dark overlay for contrast
      '<div class="hp-intro-darken"></div>',
      // Scan line effect
      '<div class="hp-intro-scanlines"></div>',
      // Text overlay
      '<div class="hp-intro-overlay">',
      '  <div class="hp-intro-title" id="hp-title">HOOK PRIME</div>',
      '  <div class="hp-intro-subtitle" id="hp-subtitle">ENTERPRISE AUTOMATION SYSTEM</div>',
      '</div>',
      // Wipe transition
      '<div class="hp-intro-wipe"></div>',
    ].join('\n');

    document.body.prepend(intro);

    // ── Wait for video ready ──
    var video = intro.querySelector('.hp-intro-video');
    var titleEl = document.getElementById('hp-title');
    var subtitleEl = document.getElementById('hp-subtitle');

    // Split title into chars for GSAP animation
    var titleText = titleEl.textContent;
    titleEl.innerHTML = '';
    var chars = [];
    for (var i = 0; i < titleText.length; i++) {
      var span = document.createElement('span');
      span.className = 'hp-intro-char';
      span.textContent = titleText[i] === ' ' ? '\u00A0' : titleText[i];
      titleEl.appendChild(span);
      chars.push(span);
    }

    // ── Build GSAP Timeline (compressed for ~1.79s video) ──
    function startTimeline() {
      var tl = gsap.timeline({
        onComplete: function () {
          cleanup();
        }
      });

      // Phase 1: Video fades in (already playing)
      tl.to(intro, { opacity: 1, duration: 0.3, ease: 'none' });

      // Phase 2: Title reveal — character by character
      tl.set(titleEl, { visibility: 'visible' }, 0.3);
      tl.from(chars, {
        y: 30,
        opacity: 0,
        filter: 'blur(8px)',
        duration: 0.4,
        ease: 'power3.out',
        stagger: 0.03,
      }, 0.3);

      // Phase 3: Subtitle fade in
      tl.to(subtitleEl, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out',
      }, 1.0);

      // Phase 4: Brief hold
      tl.to({}, { duration: 0.8 }, 1.5);

      // Phase 5: Wipe transition
      tl.to('.hp-intro-darken', {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.in',
      }, 2.3);

      tl.to([titleEl, subtitleEl], {
        opacity: 0,
        y: -15,
        duration: 0.3,
        ease: 'power2.in',
      }, 2.3);

      tl.to('.hp-intro-wipe', {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.inOut',
      }, 2.7);

      // Phase 6: Reveal app
      tl.add(function () {
        showApp();
      }, 2.9);

      // Phase 7: Remove intro
      tl.to(intro, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out',
      }, 2.9);
    }

    // ── Start when video is ready ──
    if (video.readyState >= 2) {
      startTimeline();
    } else {
      video.addEventListener('canplay', function onCanPlay() {
        video.removeEventListener('canplay', onCanPlay);
        startTimeline();
      });
      // Fallback: start anyway after 3s
      setTimeout(function () {
        startTimeline();
      }, 3000);
    }

    // ── Skip on click/tap ──
    intro.addEventListener('click', function () {
      gsap.killTweensOf('*');
      cleanup();
    });

    // ── Cleanup ──
    function cleanup() {
      showApp();
      if (video) {
        video.pause();
        video.src = '';
      }
      gsap.to(intro, {
        opacity: 0,
        duration: 0.4,
        onComplete: function () {
          if (intro.parentNode) intro.parentNode.removeChild(intro);
        }
      });
    }

    // ── Safety timeout: max 6s ──
    setTimeout(function () {
      if (intro.parentNode) cleanup();
    }, 6000);
  }
})();
