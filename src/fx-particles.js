const MAX_PARTICLES = 120;
const AMBIENT_COUNTS = [0, 12, 24, 40];

export function initFx(canvas, { prefersReducedMotion = false } = {}) {
  const noop = { emitBurst() {}, setAmbient() {}, destroy() {} };

  if (!canvas || prefersReducedMotion || typeof canvas.getContext !== 'function') {
    return noop;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return noop;
  }

  const particles = [];
  let ambientTarget = 0;
  let rafId = 0;
  let running = false;
  let lastTime = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else if (particles.length > 0 || ambientTarget > 0) {
      start();
    }
  });

  function spawnAmbient() {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + 6,
      vx: (Math.random() - 0.5) * 8,
      vy: -12 - Math.random() * 18,
      life: 1,
      decay: 0.05 + Math.random() * 0.05,
      size: 1 + Math.random() * 1.6,
      ambient: true
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    const ambientAlive = particles.filter((p) => p.ambient).length;
    if (ambientAlive < ambientTarget && particles.length < MAX_PARTICLES && Math.random() < 0.35) {
      spawnAmbient();
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt * (p.ambient ? 1 : 14);

      if (p.life <= 0 || p.y < -10) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, p.life)) * 0.85;
      ctx.fillStyle = p.color || '#f2d98a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (particles.length === 0 && ambientTarget === 0) {
      running = false;
      return;
    }

    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running || document.hidden) {
      return;
    }

    running = true;
    lastTime = performance.now();
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(rafId);
  }

  return {
    emitBurst(x, y, { count = 12, spread = 1, palette = ['#f2d98a', '#d8b768', '#fff8df'] } = {}) {
      const room = MAX_PARTICLES - particles.length;
      const amount = Math.max(0, Math.min(count, room));

      for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (30 + Math.random() * 90) * spread;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          life: 1,
          decay: 0.08 + Math.random() * 0.06,
          size: 1.4 + Math.random() * 2.2,
          color: palette[i % palette.length],
          ambient: false
        });
      }

      start();
    },
    setAmbient(level) {
      ambientTarget = AMBIENT_COUNTS[Math.max(0, Math.min(AMBIENT_COUNTS.length - 1, level))] || 0;
      if (ambientTarget > 0) {
        start();
      }
    },
    destroy() {
      stop();
      particles.length = 0;
      window.removeEventListener('resize', resize);
    }
  };
}
