/* ═══════════════════════════════════════════════════════════════
   HOOK PRIME — Canvas Background (Constellation Field)
   Partículas orgânicas conectadas que reagem ao cursor
   Estilo GSAP Showcase — sutil, cinematográfico, vivo
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CONFIG = {
    particleCount: 60,
    connectionDistance: 120,
    mouseRadius: 180,
    particleColor: 'rgba(127, 0, 255, 0.25)',
    lineColor: 'rgba(127, 0, 255, 0.06)',
    lineColorActive: 'rgba(127, 0, 255, 0.15)',
    particleMinSize: 1,
    particleMaxSize: 2.5,
    speed: 0.3,
    mouseForce: 0.02,
  };

  let canvas, ctx, particles = [], mouse = { x: -1000, y: -1000 }, raf;

  class Particle {
    constructor(w, h) {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * CONFIG.speed;
      this.vy = (Math.random() - 0.5) * CONFIG.speed;
      this.size = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);
      this.alpha = 0.2 + Math.random() * 0.5;
      this.pulseSpeed = 0.005 + Math.random() * 0.01;
      this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update(w, h, time) {
      // Mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CONFIG.mouseRadius) {
        const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius * CONFIG.mouseForce;
        this.vx += (dx / dist) * force;
        this.vy += (dy / dist) * force;
      }

      // Damping
      this.vx *= 0.99;
      this.vy *= 0.99;

      this.x += this.vx;
      this.y += this.vy;

      // Bounds
      if (this.x < 0) { this.x = 0; this.vx *= -1; }
      if (this.x > w) { this.x = w; this.vx *= -1; }
      if (this.y < 0) { this.y = 0; this.vy *= -1; }
      if (this.y > h) { this.y = h; this.vy *= -1; }

      // Pulse
      this.currentAlpha = this.alpha * (0.6 + 0.4 * Math.sin(time * this.pulseSpeed + this.pulsePhase));
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.particleColor.replace('0.25', this.currentAlpha.toFixed(2));
      ctx.fill();
    }
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'hp-canvas-bg';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.7;';
    document.body.prepend(canvas);

    ctx = canvas.getContext('2d');
    resize();

    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    document.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    loop(0);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Re-create particles on resize
    particles = [];
    for (let i = 0; i < CONFIG.particleCount; i++) {
      particles.push(new Particle(canvas.width, canvas.height));
    }
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.connectionDistance) {
          const opacity = 1 - dist / CONFIG.connectionDistance;

          // Brighter near mouse
          const midX = (particles[i].x + particles[j].x) / 2;
          const midY = (particles[i].y + particles[j].y) / 2;
          const mouseDist = Math.sqrt((midX - mouse.x) ** 2 + (midY - mouse.y) ** 2);
          const isNearMouse = mouseDist < CONFIG.mouseRadius * 1.5;

          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = isNearMouse
            ? CONFIG.lineColorActive.replace('0.15', (opacity * 0.2).toFixed(3))
            : CONFIG.lineColor.replace('0.06', (opacity * 0.06).toFixed(3));
          ctx.lineWidth = isNearMouse ? 1 : 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function loop(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.update(canvas.width, canvas.height, time);
    }

    drawConnections();

    for (const p of particles) {
      p.draw(ctx);
    }

    raf = requestAnimationFrame(loop);
  }

  // Init after DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup
  window.HUB = window.HUB || {};
  window.HUB._canvasBg = { destroy: () => { cancelAnimationFrame(raf); canvas?.remove(); } };

})();
