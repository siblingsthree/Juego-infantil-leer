'use strict';
/* Ajustes y progreso, guardados en el dispositivo (localStorage). Todo envuelto en try/catch:
   en navegación privada o con datos bloqueados el juego sigue funcionando sin guardar. */
const Settings = (() => {
  const KEY = 'bosque-letras:settings';
  const DEFAULTS = { caseMode: 'upper', rate: 0.9, voiceURI: null, freeMode: false, soundFx: true, twoTap: true, sessionMinutes: 10, childName: '' };
  let cache = null;
  function get() {
    if (cache) return cache;
    try { cache = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { cache = Object.assign({}, DEFAULTS); }
    return cache;
  }
  function set(patch) {
    cache = Object.assign({}, get(), patch);
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* sin almacenamiento */ }
    return cache;
  }
  return { get, set, DEFAULTS };
})();

const Progress = (() => {
  const KEY = 'bosque-letras:progress';
  let data = null;
  function load() {
    if (data) return data;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    if (!data || typeof data !== 'object') data = { lessons: {}, stickers: [], misses: {}, sessions: [], tests: [] };
    data.lessons = data.lessons || {};
    data.stickers = data.stickers || [];
    data.misses = data.misses || {};
    data.sessions = data.sessions || [];
    data.tests = data.tests || [];
    return data;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* sin almacenamiento */ } }
  function stars(lessonId) { return (load().lessons[lessonId] || {}).stars || 0; }
  function complete(lesson) {
    const d = load();
    const prev = d.lessons[lesson.id] || { stars: 0, plays: 0 };
    const plays = prev.plays + 1;
    d.lessons[lesson.id] = { stars: Math.min(3, plays), plays, last: Date.now() };
    if (!d.stickers.includes(lesson.emoji)) d.stickers.push(lesson.emoji);
    save();
    return d.lessons[lesson.id];
  }
  /* Fallos por letra o sílaba, para el informe familiar. */
  function miss(key) { const d = load(); d.misses[key] = (d.misses[key] || 0) + 1; save(); }
  function hardest(n = 5) { return Object.entries(load().misses).sort((a, b) => b[1] - a[1]).slice(0, n); }
  /* Sesiones: minutos jugados por día. */
  function logSession(minutes) {
    const d = load(); const day = new Date().toISOString().slice(0, 10);
    const last = d.sessions[d.sessions.length - 1];
    if (last && last.day === day) last.minutes += minutes; else d.sessions.push({ day, minutes });
    if (d.sessions.length > 60) d.sessions.splice(0, d.sessions.length - 60);
    save();
  }
  /* Repaso: lecciones completadas hace más tiempo (intervalos crecientes: 1, 3, 7 sesiones). */
  function dueForReview(n = 3) {
    const d = load();
    return Object.entries(d.lessons).filter(([id]) => /^(v|c)-/.test(id))
      .sort((a, b) => a[1].last - b[1].last).slice(0, n).map(([id]) => id);
  }
  /* Punto de partida: marca como completadas todas las lecciones anteriores a un mundo. */
  function startFrom(worldId) {
    const d = load();
    for (const w of DATA.WORLDS) {
      if (w.id === worldId) break;
      if (w.free) continue;
      for (const l of w.lessons) { if (!d.lessons[l.id]) d.lessons[l.id] = { stars: 1, plays: 1, last: Date.now() - 86400000 }; if (!d.stickers.includes(l.emoji)) d.stickers.push(l.emoji); }
    }
    save();
  }
  function isUnlocked(world, idx) {
    if (Settings.get().freeMode || world.free || idx === 0) return true;
    return stars(world.lessons[idx - 1].id) > 0;
  }
  /* Consonantes ya trabajadas (con estrella). Si aún no hay ninguna, las tres primeras. */
  function knownConsonants() {
    const known = DATA.CONSONANTS.filter(c => stars('c-' + c) > 0);
    return known.length >= 2 ? known : DATA.CONSONANTS.slice(0, 3);
  }
  function knownLetters() { return [...DATA.VOWELS, ...knownConsonants()]; }
  function worldDone(world) { return world.lessons.filter(l => stars(l.id) > 0).length; }
  function reset() { data = { lessons: {}, stickers: [], misses: {}, sessions: [], tests: [] }; save(); }
  function addTest(t) { const d = load(); d.tests.push(t); save(); }
  return { load, stars, complete, miss, hardest, logSession, dueForReview, startFrom, isUnlocked, worldDone, reset, knownConsonants, knownLetters, addTest };
})();
