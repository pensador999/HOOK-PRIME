/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — Cinematic 3D Intro v2 (Three.js + GSAP)
   Refined: Minimal silhouette ninja, atmospheric transition,
   no shockwave, extended breathing timeline (~8s)
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

  // ═══ PERFORMANCE ═══
  var isMobile = window.innerWidth < 768;
  var CLOUD_COUNT = isMobile ? 60 : 120;
  var PARTICLE_COUNT = isMobile ? 80 : 200;

  // ═══ WAIT FOR DEPS ═══
  function waitForDeps(cb) {
    if (window.THREE && window.gsap) return cb();
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if ((window.THREE && window.gsap) || tries > 80) {
        clearInterval(iv);
        if (window.THREE && window.gsap) cb();
        else showApp();
      }
    }, 100);
  }

  // ═══ CLOUD TEXTURE ═══
  function makeCloudTexture() {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(180,180,180,0.35)');
    g.addColorStop(0.3, 'rgba(140,140,140,0.18)');
    g.addColorStop(0.7, 'rgba(100,100,100,0.05)');
    g.addColorStop(1, 'rgba(60,60,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  // ═══ MAIN INTRO ═══
  function initIntro() {
    var W = window.innerWidth;
    var H = window.innerHeight;

    // ── Container ──
    var container = document.createElement('div');
    container.id = 'hp-intro';
    document.body.prepend(container);

    // ── Renderer ──
    var renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.7;
    container.appendChild(renderer.domElement);

    // ── Scene ──
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.04);

    // ── Camera ──
    var camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
    camera.position.set(0, 0.5, 45);
    camera.lookAt(0, 0, 0);

    // ── HUD Overlay ──
    var overlay = document.createElement('div');
    overlay.className = 'hp-intro-overlay';
    overlay.innerHTML =
      '<div class="hp-intro-title" id="hp-intro-title"></div>' +
      '<div class="hp-intro-subtitle" id="hp-intro-subtitle">SISTEMA ATIVADO</div>' +
      '<div class="hp-intro-wipe"></div>';
    container.appendChild(overlay);

    // ═══════════════════════════════
    //  CLOUD SYSTEM
    // ═══════════════════════════════
    var cloudTex = makeCloudTexture();
    var cloudGroup = new THREE.Group();
    var clouds = [];

    for (var i = 0; i < CLOUD_COUNT; i++) {
      var mat = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true,
        opacity: 0.25 + Math.random() * 0.3, depthWrite: false,
        blending: THREE.NormalBlending,
        color: new THREE.Color(
          0.12 + Math.random() * 0.08,
          0.10 + Math.random() * 0.06,
          0.10 + Math.random() * 0.06
        ),
      });
      var sprite = new THREE.Sprite(mat);
      var s = 8 + Math.random() * 20;
      sprite.scale.set(s, s * 0.55, 1);
      sprite.position.set(
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 90
      );
      sprite.userData.speed = 0.008 + Math.random() * 0.025;
      sprite.userData.drift = (Math.random() - 0.5) * 0.004;
      clouds.push(sprite);
      cloudGroup.add(sprite);
    }
    scene.add(cloudGroup);

    // ═══════════════════════════════
    //  LIGHTS
    // ═══════════════════════════════
    var ambientLight = new THREE.AmbientLight(0x0a0a12, 0.2);
    scene.add(ambientLight);

    // Red atmosphere — behind clouds, pulsing
    var redLight = new THREE.PointLight(0xaa1111, 0, 60);
    redLight.position.set(5, 12, -25);
    scene.add(redLight);
    var redLight2 = new THREE.PointLight(0x771111, 0, 40);
    redLight2.position.set(-12, -4, 5);
    scene.add(redLight2);

    // Ninja rim light — from behind, subtle
    var rimLight = new THREE.PointLight(0x222233, 0, 15);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // Ninja reveal spot — very tight, dim
    var ninjaSpot = new THREE.SpotLight(0xccccdd, 0, 20, Math.PI / 8, 0.7);
    ninjaSpot.position.set(-2, 5, 8);
    ninjaSpot.target.position.set(0, 0.5, 0);
    scene.add(ninjaSpot);
    scene.add(ninjaSpot.target);

    // System green (used during transition only)
    var systemLight = new THREE.PointLight(0x0ae448, 0, 30);
    systemLight.position.set(0, 0, 5);
    scene.add(systemLight);

    // ═══════════════════════════════
    //  NINJA — MINIMAL SILHOUETTE
    // ═══════════════════════════════
    // Philosophy: shadow, silhouette, posture, mystery.
    // The fog and lighting do the work, not polygon detail.
    var shadowMat = new THREE.MeshStandardMaterial({
      color: 0x050505, roughness: 0.9, metalness: 0.1,
    });
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xbb1100 });

    var ninja = new THREE.Group();
    ninja.position.set(0, -1.8, 0);

    // Torso — single smooth form
    var torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.22, 1.2, 12),
      shadowMat
    );
    torso.position.y = 1.4;
    ninja.add(torso);

    // Shoulders — wider top
    var shoulders = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.12, 0.3),
      shadowMat
    );
    shoulders.position.y = 2.0;
    ninja.add(shoulders);

    // Head group — starts tilted down (will animate)
    var headGroup = new THREE.Group();
    headGroup.position.y = 2.3;
    headGroup.rotation.x = 0.25; // Looking down initially

    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      shadowMat
    );
    headGroup.add(head);

    // Hood — wrapping over head
    var hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
      shadowMat
    );
    hood.position.y = 0.04;
    headGroup.add(hood);

    // Eyes — tiny, dim until reveal
    var eyeGeo = new THREE.SphereGeometry(0.018, 6, 6);
    var leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.06, 0.01, 0.17);
    leftEye.visible = false; // Hidden until head lifts
    headGroup.add(leftEye);
    var rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.06, 0.01, 0.17);
    rightEye.visible = false;
    headGroup.add(rightEye);

    // Eye glow — very subtle
    var eyeGlow = new THREE.PointLight(0xaa1100, 0, 2);
    eyeGlow.position.set(0, 0.01, 0.2);
    headGroup.add(eyeGlow);

    ninja.add(headGroup);

    // Arms — resting at sides, relaxed
    var armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.9, 8);

    var rightArm = new THREE.Mesh(armGeo, shadowMat);
    rightArm.position.set(-0.42, 1.4, 0);
    rightArm.rotation.z = 0.08;
    ninja.add(rightArm);

    var leftArm = new THREE.Mesh(armGeo, shadowMat);
    leftArm.position.set(0.42, 1.4, 0);
    leftArm.rotation.z = -0.08;
    ninja.add(leftArm);

    // Legs — simple, grounded
    var legGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 8);
    var rightLeg = new THREE.Mesh(legGeo, shadowMat);
    rightLeg.position.set(-0.15, 0.4, 0);
    ninja.add(rightLeg);
    var leftLeg = new THREE.Mesh(legGeo, shadowMat);
    leftLeg.position.set(0.15, 0.4, 0);
    ninja.add(leftLeg);

    // Katana — diagonal across back, barely visible
    var katana = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.8, 0.002),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.7 })
    );
    katana.position.set(0.18, 1.7, -0.18);
    katana.rotation.z = 0.35;
    ninja.add(katana);

    ninja.visible = false;
    scene.add(ninja);

    // ═══════════════════════════════
    //  PARTICLE SYSTEM
    // ═══════════════════════════════
    var particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    var particleSpeeds = [];
    var particlePhase = 'drift'; // 'drift' | 'slow' | 'organize' | 'system'

    for (var pi = 0; pi < PARTICLE_COUNT; pi++) {
      particlePositions[pi * 3] = (Math.random() - 0.5) * 50;
      particlePositions[pi * 3 + 1] = (Math.random() - 0.5) * 30;
      particlePositions[pi * 3 + 2] = (Math.random() - 0.5) * 60;
      particleSpeeds.push({
        vx: (Math.random() - 0.5) * 0.015,
        vy: Math.random() * 0.025 + 0.005,
        vz: (Math.random() - 0.5) * 0.015,
        tx: 0, ty: 0, tz: 0, // targets for organize phase
      });
    }
    var particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    var particleMat = new THREE.PointsMaterial({
      color: 0x0ae448, size: isMobile ? 0.15 : 0.1,
      transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    var particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Pre-compute "organized" target positions (grid/line pattern)
    function setOrganizeTargets() {
      var cols = Math.ceil(Math.sqrt(PARTICLE_COUNT));
      for (var oi = 0; oi < PARTICLE_COUNT; oi++) {
        var row = Math.floor(oi / cols);
        var col = oi % cols;
        particleSpeeds[oi].tx = (col - cols / 2) * 0.4;
        particleSpeeds[oi].ty = (row - cols / 2) * 0.3;
        particleSpeeds[oi].tz = 2; // In front of camera
      }
    }
    setOrganizeTargets();

    // ═══════════════════════════════
    //  STATE
    // ═══════════════════════════════
    var clock = new THREE.Clock();
    var animating = true;
    var elapsed = 0;

    // ═══════════════════════════════
    //  RENDER LOOP
    // ═══════════════════════════════
    function animate() {
      if (!animating) return;
      requestAnimationFrame(animate);

      var dt = clock.getDelta();
      elapsed += dt;

      // Cloud movement
      for (var ci = 0; ci < clouds.length; ci++) {
        var cl = clouds[ci];
        cl.position.z += cl.userData.speed;
        cl.position.x += cl.userData.drift;
        if (cl.position.z > 50) cl.position.z = -50;
      }

      // Particle movement
      var pos = particleGeo.attributes.position.array;
      for (var ppi = 0; ppi < PARTICLE_COUNT; ppi++) {
        var idx = ppi * 3;
        var sp = particleSpeeds[ppi];

        if (particlePhase === 'drift') {
          pos[idx] += sp.vx;
          pos[idx + 1] += sp.vy;
          pos[idx + 2] += sp.vz;
          if (pos[idx + 1] > 20) {
            pos[idx + 1] = -15;
            pos[idx] = (Math.random() - 0.5) * 50;
            pos[idx + 2] = (Math.random() - 0.5) * 60;
          }
        } else if (particlePhase === 'slow') {
          pos[idx] += sp.vx * 0.3;
          pos[idx + 1] += sp.vy * 0.2;
          pos[idx + 2] += sp.vz * 0.3;
        } else if (particlePhase === 'organize') {
          // Lerp toward target positions
          pos[idx] += (sp.tx - pos[idx]) * 0.03;
          pos[idx + 1] += (sp.ty - pos[idx + 1]) * 0.03;
          pos[idx + 2] += (sp.tz - pos[idx + 2]) * 0.03;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Ninja subtle breathing
      if (ninja.visible) {
        torso.scale.y = 1 + Math.sin(elapsed * 1.5) * 0.008;
        shoulders.position.y = 2.0 + Math.sin(elapsed * 1.5) * 0.003;
      }

      // Red light pulse
      if (redLight.userData && redLight.userData.base > 0) {
        redLight.intensity = redLight.userData.base * (1 + Math.sin(elapsed * 1.2) * 0.25);
      }

      renderer.render(scene, camera);
    }

    // ═══════════════════════════════
    //  TITLE TEXT
    // ═══════════════════════════════
    function buildTitle() {
      var el = document.getElementById('hp-intro-title');
      if (!el) return;
      var text = 'HOOK PRIME';
      el.innerHTML = text.split('').map(function (c) {
        return c === ' '
          ? '<span class="hp-intro-char">&nbsp;</span>'
          : '<span class="hp-intro-char">' + c + '</span>';
      }).join('');
    }

    // ═══════════════════════════════
    //  GSAP MASTER TIMELINE (~8s)
    // ═══════════════════════════════
    function createTimeline() {
      buildTitle();
      var tl = gsap.timeline({ onComplete: cleanup });

      // ══════════════════════════════
      // CENA 01 — ATMOSFERA (0 → 2.0s)
      // ══════════════════════════════
      tl.to(scene.fog, { density: 0.028, duration: 1.5, ease: 'power1.out' }, 0);
      tl.to(ambientLight, { intensity: 0.4, duration: 1.5, ease: 'power1.out' }, 0);
      tl.to(particleMat, { opacity: 0.25, duration: 2, ease: 'power1.out' }, 0.5);

      // Camera slow advance through clouds
      tl.to(camera.position, { z: 20, duration: 4, ease: 'power1.inOut' }, 0);
      tl.to(camera.position, { y: 0.3, duration: 3, ease: 'power2.inOut' }, 0);

      // Red atmosphere emerges — not fixed, pulsing behind clouds
      tl.to(redLight, {
        intensity: 2.5, duration: 2, ease: 'power1.in',
        onStart: function () { redLight.userData = { base: 2.5 }; }
      }, 0.8);
      tl.to(redLight2, { intensity: 1.5, duration: 2.5, ease: 'power1.in' }, 1.0);

      // ══════════════════════════════
      // CENA 02 — NINJA PRESENÇA (2.0 → 4.0s)
      // ══════════════════════════════
      // Figure appears as silhouette in fog
      tl.call(function () { ninja.visible = true; }, null, 2.0);

      // Fog clears just enough to see a shape
      tl.to(scene.fog, { density: 0.018, duration: 2, ease: 'power2.out' }, 2.0);

      // Rim light from behind — creates edge silhouette
      tl.to(rimLight, { intensity: 1.5, duration: 1.2, ease: 'power2.out' }, 2.0);

      // Camera settles closer, slightly off-center
      tl.to(camera.position, { z: 7, duration: 2.5, ease: 'power2.inOut' }, 2.0);
      tl.to(camera.position, { x: -0.3, duration: 2, ease: 'sine.inOut' }, 2.2);

      // Very dim spot reveals partial figure
      tl.to(ninjaSpot, { intensity: 1.2, duration: 1.5, ease: 'power2.out' }, 2.5);

      // 3.0s — Ninja slowly raises head
      tl.to(headGroup.rotation, {
        x: -0.05, duration: 1.2, ease: 'power3.out',
      }, 3.0);

      // 3.2s — Eyes become visible
      tl.call(function () {
        leftEye.visible = true;
        rightEye.visible = true;
      }, null, 3.2);
      tl.to(eyeGlow, { intensity: 0.6, duration: 0.8, ease: 'power2.out' }, 3.2);

      // Particles respond — slow down near ninja
      tl.call(function () { particlePhase = 'slow'; }, null, 3.0);

      // Small shoulder/hand movement — awareness
      tl.to(rightArm.rotation, { z: 0.12, duration: 0.8, ease: 'power2.out' }, 3.5);
      tl.to(rightArm.rotation, { z: 0.08, duration: 0.5, ease: 'power2.inOut' }, 4.0);

      // ══════════════════════════════
      // CENA 03 — TRANSFORMAÇÃO (4.0 → 5.2s)
      // Camera through atmosphere, chaos → order
      // ══════════════════════════════

      // Brief stillness — almost nothing happens
      // Then camera pushes through

      // Camera accelerates forward through the ninja/fog
      tl.to(camera.position, {
        z: -5, duration: 1, ease: 'power3.in',
      }, 4.2);
      tl.to(camera.position, {
        y: 0, x: 0, duration: 0.8, ease: 'power2.inOut',
      }, 4.2);

      // Red fades, green begins
      tl.to(redLight, { intensity: 0, duration: 0.8, ease: 'power2.in' }, 4.0);
      tl.to(redLight2, { intensity: 0, duration: 0.8, ease: 'power2.in' }, 4.0);
      tl.to(rimLight, { intensity: 0, duration: 0.6 }, 4.2);
      tl.to(ninjaSpot, { intensity: 0, duration: 0.6 }, 4.2);
      tl.to(eyeGlow, { intensity: 0, duration: 0.4 }, 4.2);

      // Fog thickens as camera passes through
      tl.to(scene.fog, { density: 0.06, duration: 0.6, ease: 'power2.in' }, 4.2);
      // Then clears to near black
      tl.to(scene.fog, { density: 0.12, duration: 0.4 }, 4.8);

      // System green light slowly emerges
      tl.to(systemLight, { intensity: 1.5, duration: 1, ease: 'power1.out' }, 4.5);

      // Particles begin organizing — chaos to structure
      tl.call(function () { particlePhase = 'organize'; }, null, 4.5);
      tl.to(particleMat, { opacity: 0.6, size: 0.08, duration: 0.8, ease: 'power1.out' }, 4.5);

      // Cloud opacity fades
      tl.call(function () {
        clouds.forEach(function (cl) {
          gsap.to(cl.material, { opacity: 0, duration: 0.8 });
        });
      }, null, 4.3);

      // ══════════════════════════════
      // CENA 04 — IDENTIDADE (5.2 → 6.7s)
      // HOOK PRIME appears alone
      // ══════════════════════════════

      // Scene is now almost dark with organized green dots
      tl.to(scene.fog, { density: 0.2, duration: 0.5 }, 5.0);
      tl.to(systemLight, { intensity: 0.5, duration: 0.5 }, 5.0);

      // HOOK PRIME text — horizontal mask reveal
      tl.set('.hp-intro-title', { visibility: 'visible' }, 5.2);
      tl.fromTo('.hp-intro-char',
        { opacity: 0, y: 20, filter: 'blur(8px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          stagger: 0.06, duration: 0.5, ease: 'power3.out',
        }, 5.3
      );

      // Moment of pause — let the name breathe (5.8 → 6.7)
      // Only subtle particle movement in background

      // ══════════════════════════════
      // CENA 05 — SISTEMA (6.7 → 8.0s)
      // Subtitle + interface reveal
      // ══════════════════════════════

      // Subtitle appears
      tl.fromTo('.hp-intro-subtitle',
        { opacity: 0, letterSpacing: '20px', y: 8 },
        { opacity: 0.5, letterSpacing: '10px', y: 0, duration: 0.6, ease: 'power2.out' },
        6.7
      );

      // Begin fading 3D scene
      tl.to(particleMat, { opacity: 0, duration: 0.6 }, 7.0);
      tl.to(systemLight, { intensity: 0, duration: 0.5 }, 7.0);

      // Title and subtitle fade
      tl.to('.hp-intro-title', { opacity: 0, y: -10, duration: 0.4, ease: 'power2.in' }, 7.2);
      tl.to('.hp-intro-subtitle', { opacity: 0, duration: 0.3 }, 7.3);

      // Wipe — the interface emerges
      tl.fromTo('.hp-intro-wipe',
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(100% at 50% 50%)', opacity: 1, duration: 0.6, ease: 'power3.inOut' },
        7.3
      );

      // Final removal
      tl.to('#hp-intro', { opacity: 0, duration: 0.3 }, 7.7);

      return tl;
    }

    // ═══════════════════════════════
    //  CLEANUP
    // ═══════════════════════════════
    function cleanup() {
      animating = false;

      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(function (m) { m.dispose(); });
          } else {
            obj.material.dispose();
          }
        }
      });

      if (cloudTex) cloudTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      window.removeEventListener('resize', onResize);

      var el = document.getElementById('hp-intro');
      if (el) el.remove();

      showApp();
    }

    // ═══════════════════════════════
    //  RESIZE
    // ═══════════════════════════════
    function onResize() {
      W = window.innerWidth;
      H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    }
    window.addEventListener('resize', onResize);

    // ═══════════════════════════════
    //  BOOT
    // ═══════════════════════════════
    animate();
    createTimeline();
  }

  // ═══ BOOT ═══
  waitForDeps(function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initIntro);
    } else {
      initIntro();
    }
  });

})();
