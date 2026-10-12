'use strict';
/* Voz (Web Speech API, español) y efectos de sonido (WebAudio, sin archivos). */
const Voice = (() => {
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voices = [];
  let chosen = null;

  function refresh() {
    if (!supported) return;
    voices = speechSynthesis.getVoices().filter(v => /^es([-_]|$)/i.test(v.lang));
    const want = Settings.get().voiceURI;
    chosen = voices.find(v => v.voiceURI === want)
      || voices.find(v => /es[-_]ES/i.test(v.lang) && /google|mónica|monica|natural|neural/i.test(v.name))
      || voices.find(v => /es[-_]ES/i.test(v.lang))
      || voices[0] || null;
  }
  if (supported) {
    refresh();
    speechSynthesis.addEventListener('voiceschanged', refresh);
  }

  /* Devuelve una promesa que se resuelve al terminar (o tras un tope de tiempo:
     algunos navegadores no disparan onend después de cancel()). */
  function say(text, opts = {}) {
    return new Promise(resolve => {
      if (!supported || !text) return resolve();
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (!chosen) refresh();
        if (chosen) u.voice = chosen;
        u.lang = chosen ? chosen.lang : 'es-ES';
        u.rate = opts.rate != null ? opts.rate : Settings.get().rate;
        u.pitch = opts.pitch != null ? opts.pitch : 1.05;
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        u.onend = finish; u.onerror = finish;
        speechSynthesis.speak(u);
        setTimeout(finish, Math.min(12000, 1500 + text.length * 120));
      } catch (e) { resolve(); }
    });
  }
  function stop() { if (supported) try { speechSynthesis.cancel(); } catch (e) { /* nada */ } }
  return { supported, say, stop, refresh, voices: () => voices, current: () => chosen };
})();

const Sfx = (() => {
  let ctx = null;
  function ac() {
    if (!Settings.get().soundFx) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function note(c, freq, t0, dur, type = 'sine', gain = 0.18) {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const PATTERNS = {
    tap: [[520, 0, 0.08, 'triangle']],
    ok: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.2]],
    no: [[220, 0, 0.18, 'sawtooth', 0.08], [180, 0.12, 0.22, 'sawtooth', 0.08]],
    win: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1046, 0.36, 0.35]],
    pop: [[880, 0, 0.06, 'triangle', 0.12]],
  };
  function play(name) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    (PATTERNS[name] || PATTERNS.tap).forEach(([f, dt, dur, type, gain]) => note(c, f, t + dt, dur, type, gain));
  }
  return { play };
})();

/* Reconocimiento de voz (Web Speech API). Funciona en Chrome, Edge y Safari (iOS 14.5+);
   Chrome y Edge envían el audio a sus servidores, así que necesita conexión.
   Devuelve siempre un objeto { status, alternatives }, nunca lanza. */
const Listen = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;
  let active = null;

  function stop() { if (active) { try { active.abort(); } catch (e) { /* nada */ } active = null; } }

  function listen({ lang = 'es-ES', timeout = 7000, onInterim = () => {} } = {}) {
    return new Promise(resolve => {
      if (!supported) return resolve({ status: 'unsupported', alternatives: [] });
      stop();
      Voice.stop();
      let rec;
      try { rec = new SR(); } catch (e) { return resolve({ status: 'error', alternatives: [] }); }
      active = rec;
      rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
      let finals = [], interim = '', settled = false;
      const finish = (status) => {
        if (settled) return; settled = true;
        clearTimeout(timer); active = null;
        const alts = finals.length ? finals : (interim ? [interim] : []);
        resolve({ status: alts.length ? 'result' : status, alternatives: alts });
      };
      const timer = setTimeout(() => { try { rec.stop(); } catch (e) { /* nada */ } setTimeout(() => finish('nospeech'), 1500); }, timeout);
      rec.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) { for (let j = 0; j < r.length; j++) finals.push(r[j].transcript); }
          else { interim = r[0].transcript; onInterim(interim); }
        }
      };
      rec.onerror = e => {
        const code = (e && e.error) || 'error';
        finish(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : code === 'no-speech' ? 'nospeech' : code === 'network' ? 'network' : 'error');
      };
      rec.onend = () => finish('nospeech');
      try { rec.start(); } catch (e) { finish('error'); }
    });
  }

  /* Normaliza para comparar lo oído con lo esperado: sin tildes, sin signos, y con las
     equivalencias de pronunciación del español (b/v, ll/y, z/s, c/k, ce/se, ge/je, h muda). */
  function canon(s) {
    let t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/ñ/g, 'ni').replace(/[^a-z]/g, '');
    t = t.replace(/qu/g, 'k').replace(/c([ei])/g, 's$1').replace(/c/g, 'k').replace(/z/g, 's')
      .replace(/g([ei])/g, 'j$1').replace(/gu([ei])/g, 'g$1').replace(/v/g, 'b').replace(/ll/g, 'y')
      .replace(/h/g, '').replace(/w/g, 'u');
    return t;
  }
  function distance(a, b) {
    const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  /* ¿Alguna alternativa oída vale como el objetivo? Para sílabas basta con que lo oído empiece
     por la sílaba (un reconocedor suele completar "pa" como "papá" o "para"). */
  function matches(alternatives, target, { kind = 'syllable' } = {}) {
    const t = canon(target);
    if (!t) return false;
    return alternatives.some(a => {
      const words = String(a).toLowerCase().split(/\s+/).map(canon).filter(Boolean);
      const whole = canon(a);
      if (kind === 'syllable') return whole === t || words.some(w => w === t || w.startsWith(t)) || whole.startsWith(t);
      // Palabras: exacta, o con un solo error que no sea la primera letra (cambiar "pato" por "gato" sí es fallo).
      return whole === t || words.includes(t) || (t.length >= 5 && words.some(w => w[0] === t[0] && distance(w, t) <= 1));
    });
  }
  return { supported, listen, stop, canon, matches };
})();
