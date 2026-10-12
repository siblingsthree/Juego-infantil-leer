'use strict';
/* Ajustes y progreso, guardados en el dispositivo (localStorage). Todo envuelto en try/catch:
   en navegación privada o con datos bloqueados el juego sigue funcionando sin guardar. */
const Settings = (() => {
  const KEY = 'bosque-letras:settings';
  const DEFAULTS = { caseMode: 'upper', rate: 0.9, voiceURI: null, freeMode: false, soundFx: true, twoTap: true };
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
    if (!data || typeof data !== 'object') data = { lessons: {}, stickers: [] };
    data.lessons = data.lessons || {};
    data.stickers = data.stickers || [];
    return data;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* sin almacenamiento */ } }
  function stars(lessonId) { return (load().lessons[lessonId] || {}).stars || 0; }
  function complete(lesson, stars) {
    const d = load();
    const prev = d.lessons[lesson.id] || { stars: 0, plays: 0 };
    d.lessons[lesson.id] = { stars: Math.max(prev.stars, stars), plays: prev.plays + 1, last: Date.now() };
    if (!d.stickers.includes(lesson.emoji)) d.stickers.push(lesson.emoji);
    save();
  }
  function isUnlocked(world, idx) {
    if (Settings.get().freeMode || idx === 0) return true;
    return stars(world.lessons[idx - 1].id) > 0;
  }
  function worldDone(world) { return world.lessons.filter(l => stars(l.id) > 0).length; }
  function reset() { data = { lessons: {}, stickers: [] }; save(); }
  return { load, stars, complete, isUnlocked, worldDone, reset };
})();
