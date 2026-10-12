'use strict';
/* Navegación y pantallas: inicio, mundo, lección, álbum y ajustes para padres. */
const App = (() => {
  const screen = document.getElementById('screen');
  const topTitle = document.getElementById('top-title');
  const dots = document.getElementById('dots');
  const backBtn = document.getElementById('btn-back');
  const settingsBtn = document.getElementById('btn-settings');
  const modal = document.getElementById('modal');
  let runToken = 0;
  let view = { name: 'home' };

  const MASCOT = '🦉';

  function setTop({ title, back, dotsHtml = '' }) {
    topTitle.textContent = title;
    backBtn.hidden = !back;
    backBtn.onclick = back || null;
    dots.innerHTML = dotsHtml;
  }
  function starsHtml(n, max = 3) {
    return `<span class="stars" aria-label="${n} de ${max} estrellas">${'★'.repeat(n)}<span class="dim">${'★'.repeat(max - n)}</span></span>`;
  }

  /* ---------- Inicio ---------- */
  function home() {
    runToken++; Voice.stop();
    view = { name: 'home' };
    setTop({ title: 'Bosque de Letras', back: null });
    const total = DATA.WORLDS.reduce((a, w) => a + w.lessons.length, 0);
    const done = DATA.WORLDS.reduce((a, w) => a + Progress.worldDone(w), 0);
    screen.innerHTML = `
      <section class="home">
        <div class="hero">
          <button class="mascot" id="mascot" aria-label="Lía la lechuza">${MASCOT}</button>
          <div class="bubble">¡Hola! Soy <b>Lía</b>. ¿Qué quieres aprender hoy?</div>
        </div>
        <div class="worlds">
          ${DATA.WORLDS.map(w => `
            <button class="world world-${w.color}" data-w="${w.id}">
              <span class="world-emoji">${w.emoji}</span>
              <span class="world-title">${U.esc(w.title)}</span>
              <span class="world-hint">${U.esc(w.hint)}</span>
              <span class="world-progress"><i style="width:${Math.round(100 * Progress.worldDone(w) / w.lessons.length)}%"></i></span>
              <span class="world-count">${Progress.worldDone(w)} / ${w.lessons.length}</span>
            </button>`).join('')}
        </div>
        <div class="home-foot">
          <button class="btn ghost" id="album">🏆 Mi álbum (${Progress.load().stickers.length})</button>
          <span class="muted">${done} de ${total} lecciones</span>
        </div>
      </section>`;
    screen.querySelector('#mascot').onclick = () => { Sfx.play('pop'); Voice.say('¡Hola! Soy Lía la lechuza. Toca un mundo para empezar a jugar.'); };
    screen.querySelectorAll('.world').forEach(b => b.onclick = () => { Sfx.play('tap'); world(b.dataset.w); });
    screen.querySelector('#album').onclick = () => { Sfx.play('tap'); album(); };
  }

  /* ---------- Mundo: lista de lecciones ---------- */
  function world(id) {
    runToken++; Voice.stop();
    const w = DATA.WORLDS.find(x => x.id === id);
    view = { name: 'world', id };
    setTop({ title: `${w.emoji} ${w.title}`, back: home });
    Voice.say(w.title);
    screen.innerHTML = `
      <section class="lessons">
        ${w.lessons.map((l, i) => {
          const unlocked = Progress.isUnlocked(w, i);
          const st = Progress.stars(l.id);
          return `<button class="lesson ${unlocked ? '' : 'locked'} ${st ? 'done' : ''}" data-i="${i}" ${unlocked ? '' : 'aria-disabled="true"'}>
            <span class="lesson-emoji">${unlocked ? l.emoji : '🔒'}</span>
            <span class="lesson-title font-letters">${U.esc(l.title)}</span>
            ${starsHtml(st)}
          </button>`;
        }).join('')}
      </section>`;
    screen.querySelectorAll('.lesson').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (!Progress.isUnlocked(w, i)) { Sfx.play('no'); Voice.say('Primero termina la lección anterior.'); b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 600); return; }
      Sfx.play('tap'); lesson(w, i);
    });
  }

  /* ---------- Lección ---------- */
  async function lesson(w, idx) {
    const token = ++runToken; Voice.stop();
    const l = w.lessons[idx];
    view = { name: 'lesson', world: w.id, idx };
    const steps = buildSteps(l);
    let hits = 0, total = 0;
    const api = {
      say: t => Voice.say(t),
      sfx: n => Sfx.play(n),
      alive: () => token === runToken,
      waitClick: el => new Promise(r => { el.onclick = () => { Sfx.play('tap'); r(); }; }),
      praise: async () => {
        Confetti.burst(60);
        Voice.say(U.pick(DATA.PRAISES));
        await U.wait(1100);
      },
    };
    for (let i = 0; i < steps.length; i++) {
      if (token !== runToken) return;
      setTop({
        title: `${l.emoji} ${l.title}`,
        back: () => world(w.id),
        dotsHtml: steps.map((s, j) => `<i class="dot ${j < i ? 'done' : ''} ${j === i ? 'now' : ''}" title="${U.esc(s.name)}"></i>`).join(''),
      });
      screen.innerHTML = '';
      const root = document.createElement('section');
      root.className = 'stage';
      root.dataset.step = steps[i].name;
      screen.appendChild(root);
      const r = await steps[i].run(root, api);
      if (token !== runToken) return;
      hits += r.hits; total += r.total;
    }
    const ratio = total ? hits / total : 1;
    const stars = ratio >= 0.85 ? 3 : ratio >= 0.55 ? 2 : 1;
    const firstTime = Progress.stars(l.id) === 0;
    Progress.complete(l, stars);
    summary(w, idx, stars, firstTime);
  }

  function summary(w, idx, stars, firstTime) {
    const l = w.lessons[idx];
    const next = w.lessons[idx + 1];
    setTop({ title: `${l.emoji} ${l.title}`, back: () => world(w.id) });
    Confetti.burst(140);
    Sfx.play('win');
    Voice.say(stars === 3 ? '¡Lección completada! Tres estrellas. ¡Eres increíble!' : stars === 2 ? '¡Lección completada! Dos estrellas. ¡Muy bien!' : '¡Lección completada! Sigue practicando y ganarás más estrellas.');
    screen.innerHTML = `
      <section class="summary">
        <div class="summary-stars">${[1, 2, 3].map(n => `<span class="big-star ${n <= stars ? 'on' : ''}" style="animation-delay:${n * 0.25}s">★</span>`).join('')}</div>
        <h2>¡Lección completada!</h2>
        ${firstTime ? `<p class="sticker-earned">Nueva pegatina para tu álbum: <span class="emoji">${l.emoji}</span></p>` : '<p class="muted">Ya tenías esta pegatina. ¡Buen repaso!</p>'}
        <div class="actions column">
          ${next ? `<button class="btn primary big" id="next">Siguiente: ${U.esc(next.title)} ➜</button>` : '<button class="btn primary big" id="home">🏡 Volver al bosque</button>'}
          <button class="btn ghost" id="again">↺ Repetir</button>
          <button class="btn ghost" id="list">📋 Ver lecciones</button>
        </div>
      </section>`;
    const q = s => screen.querySelector(s);
    if (q('#next')) q('#next').onclick = () => { Sfx.play('tap'); lesson(w, idx + 1); };
    if (q('#home')) q('#home').onclick = () => { Sfx.play('tap'); home(); };
    q('#again').onclick = () => { Sfx.play('tap'); lesson(w, idx); };
    q('#list').onclick = () => { Sfx.play('tap'); world(w.id); };
  }

  /* ---------- Álbum de pegatinas ---------- */
  function album() {
    runToken++; Voice.stop();
    view = { name: 'album' };
    setTop({ title: '🏆 Mi álbum', back: home });
    const have = Progress.load().stickers;
    const all = DATA.WORLDS.flatMap(w => w.lessons.map(l => l.emoji));
    const uniq = [...new Set(all)];
    Voice.say(have.length ? `Tienes ${have.length} pegatinas.` : 'Tu álbum está vacío. Completa una lección para ganar tu primera pegatina.');
    screen.innerHTML = `
      <section class="album">
        <p class="muted">${have.length} de ${uniq.length} pegatinas</p>
        <div class="stickers">${uniq.map(e => `<span class="sticker ${have.includes(e) ? 'on' : ''}">${have.includes(e) ? e : '?'}</span>`).join('')}</div>
      </section>`;
  }

  /* ---------- Ajustes para padres (con puerta parental) ---------- */
  function openModal(html) { modal.innerHTML = `<div class="modal-card">${html}</div>`; modal.hidden = false; }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  function parentGate() {
    const a = 2 + Math.floor(Math.random() * 5), b = 2 + Math.floor(Math.random() * 5);
    const answer = a + b;
    const opts = U.shuffle([answer, answer + 1, answer - 1, answer + 3]);
    openModal(`
      <h2>Para madres y padres</h2>
      <p>Para entrar, resuelve: <b>${a} + ${b}</b></p>
      <div class="gate">${opts.map(o => `<button class="btn ghost" data-v="${o}">${o}</button>`).join('')}</div>
      <button class="btn link" id="cancel">Cancelar</button>`);
    modal.querySelectorAll('.gate .btn').forEach(b => b.onclick = () => { if (+b.dataset.v === answer) settings(); else { b.classList.add('wrong'); Sfx.play('no'); } });
    modal.querySelector('#cancel').onclick = closeModal;
  }

  function settings() {
    const s = Settings.get();
    Voice.refresh();
    const voices = Voice.voices();
    const cur = Voice.current();
    openModal(`
      <h2>Ajustes</h2>
      <div class="field">
        <label for="caseMode">Tipo de letra</label>
        <select id="caseMode">
          <option value="upper" ${s.caseMode === 'upper' ? 'selected' : ''}>Mayúsculas (A, MA, PATO)</option>
          <option value="lower" ${s.caseMode === 'lower' ? 'selected' : ''}>Minúsculas (a, ma, pato)</option>
          <option value="both" ${s.caseMode === 'both' ? 'selected' : ''}>Ambas (traza A y a)</option>
        </select>
        <small>En Infantil se suele empezar por mayúsculas; pasa a minúsculas cuando reconozca bien las letras.</small>
      </div>
      <div class="field">
        <label for="voice">Voz</label>
        <select id="voice" ${voices.length ? '' : 'disabled'}>
          ${voices.length ? voices.map(v => `<option value="${U.esc(v.voiceURI)}" ${cur && v.voiceURI === cur.voiceURI ? 'selected' : ''}>${U.esc(v.name)} (${U.esc(v.lang)})</option>`).join('') : '<option>No hay voces en español en este dispositivo</option>'}
        </select>
        <small>${Voice.supported ? 'Las voces las pone el navegador. En Chrome, Edge y Safari (iPad) suele haber voz en español.' : 'Este navegador no tiene síntesis de voz. Prueba con Chrome, Edge o Safari.'}</small>
      </div>
      <div class="field">
        <label for="rate">Velocidad de la voz: <output id="rateOut">${s.rate}</output></label>
        <input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="${s.rate}">
      </div>
      <div class="field row">
        <label for="freeMode">Modo libre: todas las lecciones abiertas</label>
        <input type="checkbox" id="freeMode" ${s.freeMode ? 'checked' : ''}>
      </div>
      <div class="field row">
        <label for="soundFx">Efectos de sonido</label>
        <input type="checkbox" id="soundFx" ${s.soundFx ? 'checked' : ''}>
      </div>
      <div class="actions">
        <button class="btn ghost" id="test">🔊 Probar voz</button>
        <button class="btn primary" id="close">Guardar y cerrar</button>
      </div>
      <details class="danger">
        <summary>Reiniciar progreso</summary>
        <p>Se borran las estrellas y las pegatinas de este dispositivo.</p>
        <button class="btn danger" id="reset">Borrar todo el progreso</button>
      </details>`);
    const q = sel => modal.querySelector(sel);
    q('#caseMode').onchange = e => Settings.set({ caseMode: e.target.value });
    q('#voice').onchange = e => { Settings.set({ voiceURI: e.target.value }); Voice.refresh(); };
    q('#rate').oninput = e => { q('#rateOut').value = e.target.value; Settings.set({ rate: +e.target.value }); };
    q('#freeMode').onchange = e => Settings.set({ freeMode: e.target.checked });
    q('#soundFx').onchange = e => Settings.set({ soundFx: e.target.checked });
    q('#test').onclick = () => Voice.say('Hola. Vamos a jugar con las letras: ma, me, mi, mo, mu.');
    q('#close').onclick = () => { closeModal(); refresh(); };
    q('#reset').onclick = () => {
      if (q('#reset').dataset.armed) { Progress.reset(); closeModal(); home(); return; }
      q('#reset').dataset.armed = '1'; q('#reset').textContent = '¿Seguro? Toca otra vez para borrar';
    };
  }

  function refresh() {
    if (view.name === 'home') home();
    else if (view.name === 'world') world(view.id);
    else if (view.name === 'album') album();
  }

  settingsBtn.onclick = () => { Sfx.play('tap'); parentGate(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  function start() {
    if (!Voice.supported) {
      const b = document.createElement('div'); b.className = 'banner';
      b.textContent = 'Este navegador no tiene voz. El juego funciona, pero sin audio. Prueba con Chrome, Edge o Safari.';
      document.body.prepend(b);
    }
    home();
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  return { start, home };
})();

App.start();
