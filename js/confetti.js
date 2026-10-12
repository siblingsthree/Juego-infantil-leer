'use strict';
/* Confeti ligero para celebrar aciertos. */
const Confetti = (() => {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  let parts = [], raf = 0;
  const COLORS = ['#FF8A3D', '#3BA3F0', '#3FB46A', '#FFC43D', '#E65A5F', '#9B6BF2'];
  function fit() { canvas.width = innerWidth; canvas.height = innerHeight; }
  window.addEventListener('resize', fit); fit();
  function burst(n = 70, x = innerWidth / 2, y = innerHeight * 0.4) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) n = Math.min(n, 15);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: 0.25, life: 70 + Math.random() * 40, r: 4 + Math.random() * 5, c: COLORS[i % COLORS.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.99; p.life--; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }
  return { burst };
})();
