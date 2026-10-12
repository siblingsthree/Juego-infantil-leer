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
