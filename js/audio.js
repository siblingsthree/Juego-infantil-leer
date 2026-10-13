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
     algunos navegadores no disparan onend después de cancel()).
     Manías de Safari (iPhone/iPad) que se evitan aquí:
     - cancel() seguido de speak() en el mismo instante deja la nueva frase "pendiente" sin sonar:
       solo se cancela si de verdad está hablando, y se espera un momento antes de hablar.
     - el sintetizador puede quedarse en pausa: se llama a resume() antes de hablar.
     - a veces una frase nunca arranca: si no empieza en 1,2 s, se reintenta una vez. */
  let seq = 0;
  function say(text, opts = {}) {
    return new Promise(resolve => {
      if (!supported || !text) return resolve();
      const my = ++seq;
      let done = false, started = false, retried = false, u = null;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const build = () => {
        u = new SpeechSynthesisUtterance(text);
        if (!chosen) refresh();
        if (chosen) u.voice = chosen;
        u.lang = chosen ? chosen.lang : 'es-ES';
        u.rate = opts.rate != null ? opts.rate : Settings.get().rate;
        u.pitch = opts.pitch != null ? opts.pitch : 1.05;
        u.onstart = () => { started = true; };
        u.onend = finish;
        u.onerror = e => { if (e && e.error === 'interrupted' || e && e.error === 'canceled') finish(); else finish(); };
        return u;
      };
      const speakNow = () => {
        if (done || my !== seq) return finish();
        try { speechSynthesis.resume(); speechSynthesis.speak(build()); } catch (e) { return finish(); }
        setTimeout(() => {
          if (done || started || my !== seq) return;
          if (!retried) { retried = true; try { speechSynthesis.cancel(); } catch (e) { /* nada */ } setTimeout(speakNow, 120); }
          else finish();
        }, 1200);
      };
      try {
        const busy = speechSynthesis.speaking || speechSynthesis.pending;
        if (busy) { speechSynthesis.cancel(); setTimeout(speakNow, 80); } else speakNow();
        setTimeout(finish, Math.min(14000, 2500 + text.length * 120));
      } catch (e) { finish(); }
    });
  }
  function stop() { seq++; if (supported) try { speechSynthesis.cancel(); } catch (e) { /* nada */ } }
  /* Sonido de una letra: si hay un audio grabado en audio/sonidos/<letra>.mp3 se usa (la voz
     sintetizada no sabe pronunciar /m/ aislada); si no, se dice el nombre de la letra. */
  const soundCache = {};
  function sound(letter, fallbackText) {
    return new Promise(resolve => {
      if (soundCache[letter] === false) return say(fallbackText).then(resolve);
      const a = soundCache[letter] || new Audio(`audio/sonidos/${encodeURIComponent(letter)}.mp3`);
      soundCache[letter] = a;
      stop();
      a.onended = () => resolve();
      a.onerror = () => { soundCache[letter] = false; say(fallbackText).then(resolve); };
      a.play().catch(() => { soundCache[letter] = false; say(fallbackText).then(resolve); });
    });
  }
  return { supported, say, sound, stop, refresh, voices: () => voices, current: () => chosen };
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
    no: [[392, 0, 0.14, 'sine', 0.1], [330, 0.13, 0.2, 'sine', 0.1]],  // dos notas suaves descendentes, sin zumbido
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

  let listen = function ({ lang = 'es-ES', timeout = 7000, onInterim = () => {} } = {}) {
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
        last.error = code;
        finish(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : code === 'no-speech' ? 'nospeech' : code === 'network' ? 'network' : code === 'audio-capture' ? 'nomic' : 'error');
      };
      rec.onstart = () => { last.started = true; };
      rec.onend = () => finish('nospeech');
      try { rec.start(); } catch (e) { last.error = String(e && e.message || e); finish('error'); }
    });
  }
  /* Último intento, para la prueba de micrófono de los ajustes. */
  const last = { status: null, error: null, started: false, alternatives: [] };
  function platformHint(status) {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const inFrame = window.top !== window.self;
    if (inFrame) return 'La página está dentro de otra (por ejemplo el enlace de Claude): ahí el micrófono está bloqueado. Abre la dirección de github.io directamente.';
    if (!supported) return ios ? 'Este navegador no reconoce voz. En iPhone o iPad usa Safari.' : 'Este navegador no reconoce voz. Usa Chrome, Edge o Safari.';
    if (status === 'denied') return ios
      ? 'Safari no tiene permiso. En el iPhone: Ajustes → Safari → Micrófono → Permitir; y Ajustes → General → Teclado → Activar dictado. Si lo abriste desde el icono de pantalla de inicio, prueba primero en Safari normal.'
      : 'El navegador no tiene permiso de micrófono. Toca el candado o el icono junto a la dirección → Permisos → Micrófono → Permitir.';
    if (status === 'nomic') return 'No se encuentra ningún micrófono. Comprueba que otra app no lo esté usando.';
    if (status === 'network') return 'El reconocimiento necesita conexión a internet (Chrome y Edge envían el audio a sus servidores).';
    if (status === 'nospeech') return (ios && standalone)
      ? 'No se oyó nada. En iPhone, abierto desde el icono de pantalla de inicio, el reconocimiento a veces no arranca: prueba en Safari normal.'
      : 'No se oyó nada en 7 segundos. Habla fuerte y cerca; el permiso debería haberse pedido la primera vez.';
    return '';
  }
  const _listen = listen;
  listen = async function (opts) { last.status = null; last.error = null; last.started = false; const r = await _listen(opts); last.status = r.status; last.alternatives = r.alternatives; return r; };

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
      if (kind === 'sentence') {
        const need = String(target).toLowerCase().replace(/[.,¿?¡!]/g, '').split(/\s+/).map(canon).filter(w => w.length > 2);
        const got = need.filter(w => words.some(x => x === w || (w.length >= 4 && distance(x, w) <= 1)));
        return need.length ? got.length >= Math.ceil(need.length / 2) : false;
      }
      // Palabras: exacta, o con un solo error que no sea la primera letra (cambiar "pato" por "gato" sí es fallo).
      return whole === t || words.includes(t) || (t.length >= 5 && words.some(w => w[0] === t[0] && distance(w, t) <= 1));
    });
  }
  return { supported, listen: (...a) => listen(...a), stop, canon, matches, last, platformHint };
})();
