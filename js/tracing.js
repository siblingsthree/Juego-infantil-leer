'use strict';
/* Trazado de letras en canvas con corrección automática.
   - Se dibuja la letra guía con la fuente Andika (formas escolares: "a" y "g" de un piso).
   - La niña pinta encima con el dedo o el ratón.
   - Corrección: cobertura (qué parte de la letra quedó pintada) y precisión
     (qué parte de la pintura cayó dentro de la letra ampliada con un margen de tolerancia). */
class Tracer {
  constructor(canvas, opts) {
    this.canvas = canvas;
    canvas.tracer = this; // acceso para pruebas automáticas
    this.ctx = canvas.getContext('2d');
    this.text = opts.text;
    this.guide = opts.guide !== false;
    this.font = "'Andika', 'Nunito', Arial, sans-serif";
    this.strokes = [];
    this.current = null;
    this.hintUntil = 0;
    this.onInk = opts.onInk || (() => {});
    this.mask = document.createElement('canvas');
    this.tol = document.createElement('canvas');
    this.ink = document.createElement('canvas');
    this.w = 0; this.h = 0; this.dpr = 1; this.fs = 10;

    this._down = e => this.begin(e);
    this._move = e => this.move(e);
    this._up = e => this.end(e);
    canvas.addEventListener('pointerdown', this._down);
    canvas.addEventListener('pointermove', this._move);
    canvas.addEventListener('pointerup', this._up);
    canvas.addEventListener('pointercancel', this._up);
    canvas.addEventListener('pointerleave', this._up);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement);
    this.resize();
    if (document.fonts && document.fonts.load) {
      document.fonts.load(`700 40px Andika`).then(() => this.resize()).catch(() => {});
    }
  }

  destroy() {
    this.ro.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    c.removeEventListener('pointerleave', this._up);
  }

  cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.floor(r.width), h = Math.floor(r.height);
    if (!w || !h) return;
    this.w = w; this.h = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * this.dpr; this.canvas.height = h * this.dpr;
    [this.mask, this.tol, this.ink].forEach(c => { c.width = w; c.height = h; });
    this.layout();
    this.redrawInk();
    this.render();
  }

  layout() {
    const m = this.mask.getContext('2d');
    let fs = this.h * 0.62;
    m.font = `700 ${fs}px ${this.font}`;
    const maxW = this.w * 0.86;
    const tw = m.measureText(this.text).width;
    if (tw > maxW) fs = fs * maxW / tw;
    this.fs = fs;
    this.baseY = this.h * 0.70;
    this.x = this.w / 2;
    this.lineW = Math.max(10, fs * 0.13);

    const setup = c => { c.clearRect(0, 0, this.w, this.h); c.font = `700 ${fs}px ${this.font}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = '#000'; c.strokeStyle = '#000'; c.lineJoin = 'round'; c.lineCap = 'round'; };
    setup(m);
    m.fillText(this.text, this.x, this.baseY);
    const t = this.tol.getContext('2d');
    setup(t);
    t.lineWidth = Math.max(18, fs * 0.26);
    t.strokeText(this.text, this.x, this.baseY);
    t.fillText(this.text, this.x, this.baseY);

    const md = m.getImageData(0, 0, this.w, this.h).data;
    this.letterPixels = [];
    const step = 2;
    for (let y = 0; y < this.h; y += step) {
      for (let x = 0; x < this.w; x += step) {
        if (md[(y * this.w + x) * 4 + 3] > 60) this.letterPixels.push(y * this.w + x);
      }
    }
    this.tolData = t.getImageData(0, 0, this.w, this.h).data;
    // Caja del contorno de la letra, para encajar los trazos autorizados.
    let x0 = this.w, y0 = this.h, x1 = 0, y1 = 0;
    for (const i of this.letterPixels) { const y = Math.floor(i / this.w), x = i % this.w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    this.bbox = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
    const authored = this.text.length === 1 && typeof STROKES !== 'undefined' ? STROKES.get(this.text) : null;
    this.demoStrokes = authored ? authored.map(st => st.map(p => ({ x: this.bbox.x + p.x * this.bbox.w, y: this.bbox.y + p.y * this.bbox.h }))) : null;
    this.start = this.demoStrokes ? this.demoStrokes[0][0] : this.startPoint(md);
    this.demoProgress = null;
  }

  /* Animación: un lápiz recorre los trazos en orden, dejando estela. Devuelve una promesa. */
  playDemo() {
    if (!this.demoStrokes) return Promise.resolve();
    if (this._demoCancel) this._demoCancel();
    return new Promise(resolve => {
      const speed = this.fs * 0.9; // píxeles por segundo
      const total = this.demoStrokes.reduce((a, st) => a + STROKES.length(st.map(p => ({ x: p.x, y: p.y }))), 0);
      const pause = 0.35; // segundos entre trazos
      const duration = total / speed + pause * (this.demoStrokes.length - 1) + 0.4;
      const t0 = performance.now();
      let raf = 0, stopped = false;
      this._demoCancel = () => { stopped = true; cancelAnimationFrame(raf); this.demoProgress = null; this.render(); resolve(); };
      const tick = () => {
        if (stopped) return;
        const t = (performance.now() - t0) / 1000;
        this.demoProgress = t;
        this.render();
        if (t < duration) raf = requestAnimationFrame(tick);
        else { this.demoProgress = null; this._demoCancel = null; this.render(); resolve(); }
      };
      raf = requestAnimationFrame(tick);
    });
  }

  /* Dibuja la estela y el lápiz según el tiempo transcurrido. */
  drawDemo(c) {
    const speed = this.fs * 0.9, pause = 0.35;
    let t = this.demoProgress;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = this.cssVar('--accent', '#ff6b35'); c.lineWidth = Math.max(6, this.fs * 0.08);
    let pen = null;
    for (const st of this.demoStrokes) {
      const len = STROKES.length(st);
      const dur = len / speed;
      const frac = Math.max(0, Math.min(1, t / dur));
      // dibuja la parte recorrida
      let acc = 0; const target = frac * len;
      c.beginPath(); c.moveTo(st[0].x, st[0].y);
      for (let i = 1; i < st.length; i++) {
        const seg = Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y);
        if (acc + seg >= target) {
          const k = seg ? (target - acc) / seg : 0;
          pen = { x: st[i - 1].x + (st[i].x - st[i - 1].x) * k, y: st[i - 1].y + (st[i].y - st[i - 1].y) * k };
          c.lineTo(pen.x, pen.y); break;
        }
        acc += seg; c.lineTo(st[i].x, st[i].y);
        if (i === st.length - 1) pen = st[i];
      }
      c.stroke();
      if (t < dur) break;
      t -= dur + pause;
      if (t < 0) { break; }
    }
    if (pen) {
      c.font = `${Math.max(24, this.fs * 0.3)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText('✏️', pen.x + this.fs * 0.08, pen.y + this.fs * 0.02);
    }
    c.restore();
  }

  /* Punto de inicio orientativo: las letras redondas (a c d e g o q) empiezan por el trazo curvo,
     arriba a la derecha del óvalo; las demás, arriba a la izquierda. Solo se marca en letras sueltas. */
  startPoint(md) {
    if (this.text.length !== 1) return null;
    const round = 'acdegoqCGOQ'.includes(this.text);
    let top = -1, xs = [];
    for (let y = 0; y < this.h && top < 0; y++) for (let x = 0; x < this.w; x++) if (md[(y * this.w + x) * 4 + 3] > 60) { top = y; break; }
    if (top < 0) return null;
    const y = Math.min(this.h - 1, top + Math.round(this.fs * 0.04));
    for (let x = 0; x < this.w; x++) if (md[(y * this.w + x) * 4 + 3] > 60) xs.push(x);
    if (!xs.length) return null;
    return { x: round ? xs[xs.length - 1] - this.fs * 0.04 : xs[0] + this.fs * 0.05, y: y + this.fs * 0.05 };
  }

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  begin(e) {
    if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    this.current = [this.point(e)];
    this.strokes.push(this.current);
    this.drawSegment(this.current);
    this.render();
    this.onInk();
  }
  move(e) {
    if (!this.current) return;
    e.preventDefault();
    const pts = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of pts) this.current.push(this.point(ev));
    this.drawSegment(this.current.slice(-Math.min(this.current.length, pts.length + 1)));
    this.render();
  }
  end(e) {
    if (!this.current) return;
    this.current = null;
    this.render();
  }

  drawSegment(pts) {
    const c = this.ink.getContext('2d');
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#000'; c.lineWidth = this.lineW;
    c.beginPath();
    if (pts.length === 1) { c.arc(pts[0].x, pts[0].y, this.lineW / 2, 0, Math.PI * 2); c.fillStyle = '#000'; c.fill(); return; }
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
  }
  redrawInk() {
    const c = this.ink.getContext('2d');
    c.clearRect(0, 0, this.w, this.h);
    for (const s of this.strokes) this.drawSegment(s);
  }

  render() {
    const c = this.ctx, w = this.w, h = this.h, fs = this.fs;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    // Pauta escolar: línea base, línea media (altura de las minúsculas) y línea superior.
    c.lineWidth = 2;
    c.strokeStyle = this.cssVar('--line', '#bfd6c7');
    const lines = [this.baseY, this.baseY - fs * 0.5, this.baseY - fs * 0.72, this.baseY + fs * 0.22];
    lines.forEach((y, i) => {
      c.setLineDash(i === 1 ? [8, 10] : []);
      c.beginPath(); c.moveTo(w * 0.04, y); c.lineTo(w * 0.96, y); c.stroke();
    });
    c.setLineDash([]);
    const showGuide = this.guide || Date.now() < this.hintUntil;
    if (showGuide) {
      c.font = `700 ${fs}px ${this.font}`;
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillStyle = this.cssVar('--guide', '#c9ddd0');
      c.fillText(this.text, this.x, this.baseY);
      c.lineWidth = Math.max(2, fs * 0.02);
      c.strokeStyle = this.cssVar('--muted', '#5e7a6b');
      c.setLineDash([fs * 0.06, fs * 0.05]);
      c.strokeText(this.text, this.x, this.baseY);
      c.setLineDash([]);
      if (this.start) {
        c.beginPath(); c.arc(this.start.x, this.start.y, Math.max(7, fs * 0.05), 0, Math.PI * 2);
        c.fillStyle = this.cssVar('--good', '#27c26b'); c.fill();
        c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke();
      }
    }
    if (this.demoProgress != null && this.demoStrokes) this.drawDemo(c);
    // Tinta: el canvas de tinta es negro; se tiñe con el color del tema.
    c.save();
    c.globalCompositeOperation = 'source-over';
    const tinted = document.createElement('canvas');
    tinted.width = w; tinted.height = h;
    const tc = tinted.getContext('2d');
    tc.drawImage(this.ink, 0, 0);
    tc.globalCompositeOperation = 'source-in';
    tc.fillStyle = this.cssVar('--ink', '#2e7bd6');
    tc.fillRect(0, 0, w, h);
    c.drawImage(tinted, 0, 0);
    c.restore();
  }

  clear() { this.strokes = []; this.current = null; this.redrawInk(); this.render(); }
  startedAtStart() {
    if (!this.start || !this.strokes.length) return true;
    const p = this.strokes[0][0];
    return Math.hypot(p.x - this.start.x, p.y - this.start.y) < this.fs * 0.3;
  }
  showHint(ms = 2500) {
    this.hintUntil = Date.now() + ms; this.render();
    setTimeout(() => this.render(), ms + 20);
  }
  hasInk() { return this.strokes.some(s => s.length > 2); }

  /* Puntúa la tinta (por defecto la real; con mirror=true, la tinta reflejada horizontalmente,
     para detectar letras en espejo: normales hasta los 7 años, no se penalizan). */
  evaluate(mirror = false) {
    let src = this.ink;
    if (mirror) {
      src = document.createElement('canvas'); src.width = this.w; src.height = this.h;
      const mc = src.getContext('2d'); mc.translate(this.w, 0); mc.scale(-1, 1); mc.drawImage(this.ink, 0, 0);
      // Reflejar respecto al centro de la letra, no del lienzo: la letra está centrada en this.x.
    }
    const d = src.getContext('2d').getImageData(0, 0, this.w, this.h).data;
    let covered = 0;
    for (const i of this.letterPixels) if (d[i * 4 + 3] > 40) covered++;
    const coverage = this.letterPixels.length ? covered / this.letterPixels.length : 0;
    let inkCount = 0, inside = 0;
    for (let y = 0; y < this.h; y += 2) {
      for (let x = 0; x < this.w; x += 2) {
        const i = (y * this.w + x) * 4 + 3;
        if (d[i] > 40) { inkCount++; if (this.tolData[i] > 40) inside++; }
      }
    }
    const precision = inkCount ? inside / inkCount : 0;
    const covThr = this.guide ? 0.72 : 0.62;
    const precThr = this.guide ? 0.55 : 0.5;
    const res = { coverage, precision, ok: inkCount > 40 && coverage >= covThr && precision >= precThr, mirrored: false };
    // Letras asimétricas: si la tinta reflejada encaja claramente mejor que la real, está en espejo.
    if (!mirror && inkCount > 40 && this.text.length === 1 && 'bdpqBDPQJLFEKNSZszjrcCGfeaghyRPNZ'.includes(this.text)) {
      const m = this.evaluate(true);
      const score = r => r.coverage * 0.6 + r.precision * 0.4;
      if (m.coverage >= covThr && m.precision >= precThr && score(m) > score(res) + 0.12) { res.mirrored = true; res.ok = false; }
    }
    return res;
  }
}
