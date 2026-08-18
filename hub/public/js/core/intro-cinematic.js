/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — Cinematic 3D Intro (Three.js + GSAP)
   Real-time rendered scene: procedural clouds, 3D ninja,
   volumetric fog, particle systems, energy burst, dynamic light
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

  // ═══ HIDE APP ═══
  function hideApp() {
    var w = document.querySelector('.app-wrapper');
    if (w) w.style.visibility = 'hidden';
  }

  function showApp() {
    var w = document.querySelector('.app-wrapper');
    if (w) {
      w.style.visibility = 'visible';
      if (window.gsap) gsap.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
    }
    sessionStorage.setItem('hp-intro-seen', 'true');
  }

  hideApp();

  // ═══ PERFORMANCE TIER ═══
  var isMobile = window.innerWidth < 768;
  var CLOUD_COUNT = isMobile ? 60 : 120;
  var PARTICLE_COUNT = isMobile ? 100 : 250;

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

  // ═══ CLOUD TEXTURE (Procedural) ═══
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
    renderer.toneMappingExposure = 0.8;
    container.appendChild(renderer.domElement);

    // ── Scene ──
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.035);

    // ── Camera ──
    var camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 200);
    camera.position.set(0, 1, 45);
    camera.lookAt(0, 0, 0);

    // ── HUD Overlay (text + transition) ──
    var overlay = document.createElement('div');
    overlay.className = 'hp-intro-overlay';
    overlay.innerHTML = '<div class="hp-intro-title" id="hp-intro-title"></div>' +
      '<div class="hp-intro-subtitle">SISTEMA ATIVADO</div>' +
      '<div class="hp-intro-flash"></div>' +
      '<div class="hp-intro-wipe"></div>';
    container.appendChild(overlay);

    // ═══════════════════════════════
    //  CLOUD SYSTEM (Procedural Sprites)
    // ═══════════════════════════════
    var cloudTex = makeCloudTexture();
    var cloudGroup = new THREE.Group();
    var clouds = [];

    for (var i = 0; i < CLOUD_COUNT; i++) {
      var mat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.3 + Math.random() * 0.3,
        depthWrite: false,
        blending: THREE.NormalBlending,
        color: new THREE.Color(0.15 + Math.random() * 0.1, 0.12 + Math.random() * 0.08, 0.12 + Math.random() * 0.08),
      });
      var sprite = new THREE.Sprite(mat);
      var s = 8 + Math.random() * 18;
      sprite.scale.set(s, s * 0.6, 1);
      sprite.position.set(
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 80
      );
      sprite.userData.speed = 0.01 + Math.random() * 0.03;
      sprite.userData.drift = (Math.random() - 0.5) * 0.005;
      clouds.push(sprite);
      cloudGroup.add(sprite);
    }
    scene.add(cloudGroup);

    // ═══════════════════════════════
    //  LIGHTS
    // ═══════════════════════════════
    var ambientLight = new THREE.AmbientLight(0x111118, 0.3);
    scene.add(ambientLight);

    var redLight = new THREE.PointLight(0xcc2222, 0, 60);
    redLight.position.set(0, 10, -20);
    scene.add(redLight);

    var redLight2 = new THREE.PointLight(0x882222, 0, 40);
    redLight2.position.set(-15, -5, 10);
    scene.add(redLight2);

    var ninjaSpot = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 6, 0.5);
    ninjaSpot.position.set(0, 8, 10);
    ninjaSpot.target.position.set(0, 0, 0);
    scene.add(ninjaSpot);
    scene.add(ninjaSpot.target);

    var energyLight = new THREE.PointLight(0x0ae448, 0, 25);
    energyLight.position.set(0.6, 1.5, 0.5);
    scene.add(energyLight);

    // ═══════════════════════════════
    //  NINJA CHARACTER (3D Geometry)
    // ═══════════════════════════════
    var darkMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, roughness: 0.8, metalness: 0.15,
    });
    var armorMat = new THREE.MeshStandardMaterial({
      color: 0x111111, roughness: 0.5, metalness: 0.4,
    });
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    var bladeMat = new THREE.MeshStandardMaterial({
      color: 0x888888, roughness: 0.2, metalness: 0.9,
    });
    var beltMat = new THREE.MeshStandardMaterial({
      color: 0x220000, roughness: 0.6, metalness: 0.3,
    });

    var ninja = new THREE.Group();
    ninja.position.set(0, -1.6, 0);

    // Torso
    var torsoGeo = new THREE.BoxGeometry(0.7, 1.1, 0.4);
    var torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 1.5;
    ninja.add(torso);

    // Belt
    var beltGeo = new THREE.BoxGeometry(0.75, 0.15, 0.45);
    var belt = new THREE.Mesh(beltGeo, beltMat);
    belt.position.y = 1.0;
    ninja.add(belt);

    // Head
    var headGroup = new THREE.Group();
    headGroup.position.y = 2.3;

    var headGeo = new THREE.SphereGeometry(0.22, 16, 12);
    var head = new THREE.Mesh(headGeo, darkMat);
    headGroup.add(head);

    // Hood
    var hoodGeo = new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65);
    var hood = new THREE.Mesh(hoodGeo, darkMat);
    hood.position.y = 0.03;
    headGroup.add(hood);

    // Mask (lower face)
    var maskGeo = new THREE.BoxGeometry(0.2, 0.08, 0.15);
    var mask = new THREE.Mesh(maskGeo, darkMat);
    mask.position.set(0, -0.08, 0.14);
    headGroup.add(mask);

    // Eyes
    var eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
    var leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.07, 0.02, 0.2);
    headGroup.add(leftEye);
    var rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.07, 0.02, 0.2);
    headGroup.add(rightEye);

    // Eye glow light
    var eyeGlow = new THREE.PointLight(0xff2200, 0.5, 3);
    eyeGlow.position.set(0, 0.02, 0.25);
    headGroup.add(eyeGlow);

    ninja.add(headGroup);

    // Arms
    var armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.5, 8);
    var forearmGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.45, 8);

    // Right arm group (will animate)
    var rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(-0.45, 1.8, 0);
    var rightUpper = new THREE.Mesh(armGeo, darkMat);
    rightUpper.position.y = -0.25;
    rightArmGroup.add(rightUpper);
    var rightForeGroup = new THREE.Group();
    rightForeGroup.position.y = -0.5;
    var rightFore = new THREE.Mesh(forearmGeo, darkMat);
    rightFore.position.y = -0.22;
    rightForeGroup.add(rightFore);
    rightArmGroup.add(rightForeGroup);
    ninja.add(rightArmGroup);

    // Left arm (static)
    var leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(0.45, 1.8, 0);
    leftArmGroup.rotation.z = 0.15;
    var leftUpper = new THREE.Mesh(armGeo, darkMat);
    leftUpper.position.y = -0.25;
    leftArmGroup.add(leftUpper);
    var leftFore = new THREE.Mesh(forearmGeo, darkMat);
    leftFore.position.y = -0.65;
    leftArmGroup.add(leftFore);
    ninja.add(leftArmGroup);

    // Legs
    var legGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.7, 8);
    var rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(-0.17, 0.35, 0);
    ninja.add(rightLeg);
    var leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(0.17, 0.35, 0);
    ninja.add(leftLeg);

    // Katana on back
    var katanaGroup = new THREE.Group();
    katanaGroup.position.set(0.2, 1.8, -0.25);
    katanaGroup.rotation.z = 0.3;
    var handleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8);
    var handle = new THREE.Mesh(handleGeo, beltMat);
    katanaGroup.add(handle);
    var bladeGeo = new THREE.BoxGeometry(0.015, 0.6, 0.003);
    var blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.48;
    katanaGroup.add(blade);
    ninja.add(katanaGroup);

    ninja.visible = false;
    scene.add(ninja);

    // ═══════════════════════════════
    //  PARTICLE SYSTEM
    // ═══════════════════════════════
    var particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    var particleSpeeds = [];
    for (var pi = 0; pi < PARTICLE_COUNT; pi++) {
      particlePositions[pi * 3] = (Math.random() - 0.5) * 50;
      particlePositions[pi * 3 + 1] = (Math.random() - 0.5) * 30;
      particlePositions[pi * 3 + 2] = (Math.random() - 0.5) * 60;
      particleSpeeds.push({
        vx: (Math.random() - 0.5) * 0.02,
        vy: Math.random() * 0.03 + 0.01,
        vz: (Math.random() - 0.5) * 0.02,
      });
    }
    var particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    var particleMat = new THREE.PointsMaterial({
      color: 0x0ae448,
      size: isMobile ? 0.15 : 0.12,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // ═══════════════════════════════
    //  ENERGY SYSTEM
    // ═══════════════════════════════
    // Energy orb (forms at ninja's hand)
    var energyOrbGeo = new THREE.SphereGeometry(0.01, 16, 16);
    var energyOrbMat = new THREE.MeshBasicMaterial({
      color: 0x0ae448, transparent: true, opacity: 0,
    });
    var energyOrb = new THREE.Mesh(energyOrbGeo, energyOrbMat);
    energyOrb.position.set(-0.6, 0.9, 0.3);
    ninja.add(energyOrb);

    // Shockwave ring
    var ringGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 32);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x0ae448, transparent: true, opacity: 0,
    });
    var shockRing = new THREE.Mesh(ringGeo, ringMat);
    shockRing.position.set(0, 0.2, 0);
    shockRing.rotation.x = Math.PI / 2;
    scene.add(shockRing);

    // Second ring
    var ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.02, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x0ae448, transparent: true, opacity: 0 })
    );
    ring2.position.copy(shockRing.position);
    ring2.rotation.x = Math.PI / 2;
    scene.add(ring2);

    // ═══════════════════════════════
    //  STATE
    // ═══════════════════════════════
    var clock = new THREE.Clock();
    var burstActive = false;
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

        if (burstActive) {
          // Scatter from center
          var dx = pos[idx];
          var dy = pos[idx + 1] - 0.2;
          var dz = pos[idx + 2];
          var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          pos[idx] += (dx / d) * 0.5;
          pos[idx + 1] += (dy / d) * 0.5;
          pos[idx + 2] += (dz / d) * 0.5;
        } else {
          pos[idx] += sp.vx;
          pos[idx + 1] += sp.vy;
          pos[idx + 2] += sp.vz;
          // Reset particles that go too far
          if (pos[idx + 1] > 20) {
            pos[idx + 1] = -15;
            pos[idx] = (Math.random() - 0.5) * 50;
            pos[idx + 2] = (Math.random() - 0.5) * 60;
          }
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Ninja idle breathing
      if (ninja.visible) {
        torso.scale.y = 1 + Math.sin(elapsed * 2) * 0.015;
        headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.03;
      }

      // Eye flicker
      eyeGlow.intensity = 0.3 + Math.sin(elapsed * 8) * 0.15;

      // Red light pulse
      if (redLight.intensity > 0) {
        redLight.intensity = redLight.userData.base * (1 + Math.sin(elapsed * 1.5) * 0.3);
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
    //  GSAP MASTER TIMELINE
    // ═══════════════════════════════
    function createTimeline() {
      buildTitle();
      var tl = gsap.timeline({ onComplete: cleanup });

      // ── 0.0–0.8: ATMOSPHERE ──
      // Fog lifts, ambient increases
      tl.to(scene.fog, { density: 0.025, duration: 1, ease: 'power1.out' }, 0);
      tl.to(ambientLight, { intensity: 0.6, duration: 1.2, ease: 'power1.out' }, 0);
      tl.to(particleMat, { opacity: 0.4, duration: 1.5, ease: 'power1.out' }, 0.3);

      // ── 0.8–2.0: CAMERA ADVANCE ──
      // Camera pushes through clouds
      tl.to(camera.position, { z: 15, duration: 3, ease: 'power1.inOut' }, 0.5);
      tl.to(camera.position, { y: 0.5, duration: 2.5, ease: 'power2.inOut' }, 0.5);

      // Red lights emerge
      tl.to(redLight, {
        intensity: 3,
        duration: 1.5,
        ease: 'power1.in',
        onStart: function () { redLight.userData.base = 3; }
      }, 0.8);
      tl.to(redLight2, { intensity: 2, duration: 2, ease: 'power1.in' }, 1.0);

      // ── 2.0–3.0: NINJA REVEAL ──
      tl.call(function () { ninja.visible = true; }, null, 2.0);
      // Ninja fades in via fog clearing and spot light
      tl.to(scene.fog, { density: 0.015, duration: 1.5, ease: 'power2.out' }, 2.0);
      tl.to(ninjaSpot, { intensity: 2.5, duration: 1.2, ease: 'power2.out' }, 2.0);

      // Camera settles closer
      tl.to(camera.position, { z: 6, y: 0.3, duration: 2, ease: 'power2.inOut' }, 2.0);
      // Subtle lateral camera movement
      tl.to(camera.position, { x: -0.5, duration: 1.5, ease: 'sine.inOut' }, 2.2);
      tl.to(camera.position, { x: 0.3, duration: 1.5, ease: 'sine.inOut' }, 3.0);

      // Head tilt
      tl.to(headGroup.rotation, { x: -0.15, duration: 0.8, ease: 'power2.out' }, 2.5);
      tl.to(headGroup.rotation, { x: 0, duration: 0.5, ease: 'power2.inOut' }, 3.0);

      // ── 3.0–4.0: ENERGY INTERACTION ──
      // Raise right arm
      tl.to(rightArmGroup.rotation, { z: -1.8, duration: 0.7, ease: 'power3.out' }, 3.0);
      tl.to(rightForeGroup.rotation, { z: 0.6, duration: 0.5, ease: 'power2.out' }, 3.2);

      // Energy orb grows
      tl.to(energyOrbMat, { opacity: 0.9, duration: 0.5, ease: 'power2.out' }, 3.2);
      tl.to(energyOrb.scale, { x: 15, y: 15, z: 15, duration: 0.8, ease: 'power2.out' }, 3.2);

      // Energy light
      tl.to(energyLight, { intensity: 6, duration: 0.6, ease: 'power2.out' }, 3.3);

      // Converge particles toward energy
      tl.call(function () {
        var pArr = particleGeo.attributes.position.array;
        for (var k = 0; k < PARTICLE_COUNT; k++) {
          var ii = k * 3;
          particleSpeeds[k].vx = (-pArr[ii]) * 0.02;
          particleSpeeds[k].vy = (0.9 - pArr[ii + 1]) * 0.02;
          particleSpeeds[k].vz = (-pArr[ii + 2]) * 0.02;
        }
      }, null, 3.3);

      // ── 3.8–4.2: ENERGY BURST ──
      // Shockwave
      tl.to(ringMat, { opacity: 0.8, duration: 0.1 }, 3.8);
      tl.to(shockRing.scale, { x: 30, y: 30, z: 30, duration: 0.8, ease: 'power2.out' }, 3.8);
      tl.to(ringMat, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 4.0);
      // Second ring (delayed)
      tl.to(ring2.material, { opacity: 0.6, duration: 0.1 }, 3.95);
      tl.to(ring2.scale, { x: 25, y: 25, z: 25, duration: 0.7, ease: 'power2.out' }, 3.95);
      tl.to(ring2.material, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 4.2);

      // Particle scatter burst
      tl.call(function () { burstActive = true; }, null, 3.85);

      // Flash
      tl.to('.hp-intro-flash', { opacity: 0.7, duration: 0.08 }, 3.85);
      tl.to('.hp-intro-flash', { opacity: 0, duration: 0.2, ease: 'power2.out' }, 3.93);

      // Energy orb explodes
      tl.to(energyOrb.scale, { x: 60, y: 60, z: 60, duration: 0.4, ease: 'power2.out' }, 3.85);
      tl.to(energyOrbMat, { opacity: 0, duration: 0.3 }, 3.9);
      tl.to(energyLight, { intensity: 15, duration: 0.15, ease: 'power2.out' }, 3.85);
      tl.to(energyLight, { intensity: 0, duration: 0.5, ease: 'power2.in' }, 4.0);

      // Camera shake
      tl.to(camera.position, { x: 0.2, duration: 0.05, yoyo: true, repeat: 5 }, 3.85);
      tl.to(camera.rotation, { z: 0.02, duration: 0.05, yoyo: true, repeat: 3 }, 3.88);

      // ── 4.0–5.0: TITLE + TRANSITION ──
      // Title
      tl.fromTo('.hp-intro-char', { opacity: 0, y: 40, rotateX: -90 },
        { opacity: 1, y: 0, rotateX: 0, stagger: 0.04, duration: 0.4, ease: 'back.out(2)' }, 4.0);
      tl.fromTo('.hp-intro-subtitle', { opacity: 0, letterSpacing: '25px' },
        { opacity: 0.7, letterSpacing: '12px', duration: 0.5, ease: 'power3.out' }, 4.2);

      // Scene fades
      tl.to(scene.fog, { density: 0.08, duration: 1, ease: 'power2.in' }, 4.3);
      tl.to(ninjaSpot, { intensity: 0, duration: 0.6 }, 4.4);
      tl.to(redLight, { intensity: 0, duration: 0.6 }, 4.4);
      tl.to(camera.position, { z: 3, duration: 0.7, ease: 'power2.in' }, 4.3);

      // Hide title
      tl.to('.hp-intro-title', { opacity: 0, scale: 1.1, duration: 0.3 }, 4.6);
      tl.to('.hp-intro-subtitle', { opacity: 0, duration: 0.3 }, 4.6);

      // Wipe transition
      tl.fromTo('.hp-intro-wipe', { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(100% at 50% 50%)', opacity: 1, duration: 0.7, ease: 'power3.inOut' }, 4.6);

      // Final
      tl.to('#hp-intro', { opacity: 0, duration: 0.3 }, 5.0);

      return tl;
    }

    // ═══════════════════════════════
    //  CLEANUP (Release ALL GPU)
    // ═══════════════════════════════
    function cleanup() {
      animating = false;

      // Dispose all geometries and materials
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
