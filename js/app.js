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
    runToken++; Voice.stop(); Listen.stop();
    view = { name: 'home' };
    setTop({ title: 'Bosque de Letras', back: null });
    const total = DATA.WORLDS.reduce((a, w) => a + w.lessons.length, 0);
    const done = DATA.WORLDS.reduce((a, w) => a + Progress.worldDone(w), 0);
    const resting = Session.isClosed();
    screen.innerHTML = `
      <section class="home">
        <div class="hero">
          <button class="mascot" id="mascot" aria-label="Lía la lechuza">${resting ? '😴' : MASCOT}</button>
          <div class="bubble">${resting ? 'Lía descansa. Hoy ya hemos jugado. ¡Hasta mañana!' : '¡Hola! Soy <b>Lía</b>. ¿Qué quieres aprender hoy?'}</div>
        </div>
        <div class="worlds">
          ${DATA.WORLDS.map(w => `
            <button class="world world-${w.color}" data-w="${w.id}" data-say="${U.esc(w.title)}">
              <span class="world-emoji">${w.emoji}</span>
              <span class="world-title">${U.esc(w.title)}</span>
              <span class="world-hint">${U.esc(w.hint)}</span>
              <span class="world-progress"><i style="width:${Math.round(100 * Progress.worldDone(w) / w.lessons.length)}%"></i></span>
              <span class="world-count">${Progress.worldDone(w)} / ${w.lessons.length}</span>
            </button>`).join('')}
        </div>
        <div class="home-foot">
          <button class="btn ghost" id="album" data-say="Mi álbum de pegatinas"><span class="ico">🏆</span>Mi álbum (${Progress.load().stickers.length})</button>
          <span class="muted">${done} de ${total} lecciones</span>
        </div>
      </section>`;
    screen.querySelector('#mascot').onclick = () => { Sfx.play('pop'); Voice.say('¡Hola! Soy Lía la lechuza. Toca un mundo para empezar a jugar.'); };
    screen.querySelectorAll('.world').forEach(b => b.onclick = () => {
      if (Session.isClosed()) { Sfx.play('no'); Voice.say('Hoy ya hemos jugado. Un adulto puede abrirlo en ajustes.'); b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 600); return; }
      Sfx.play('tap'); world(b.dataset.w);
    });
    screen.querySelector('#album').onclick = () => { Sfx.play('tap'); album(); };
  }

  /* ---------- Mundo: lista de lecciones ---------- */
  function world(id) {
    runToken++; Voice.stop(); Listen.stop();
    const w = DATA.WORLDS.find(x => x.id === id);
    view = { name: 'world', id };
    setTop({ title: `${w.emoji} ${w.title}`, back: home });
    Voice.say(w.title);
    screen.innerHTML = `
      <section class="lessons">
        ${w.lessons.map((l, i) => {
          const unlocked = Progress.isUnlocked(w, i);
          const st = Progress.stars(l.id);
          const sayName = l.letter ? (DATA.VOWELS.includes(l.letter) ? `La vocal ${l.letter}` : `La letra ${DATA.LETTERS[l.letter].name}`) : l.title;
          return `<button class="lesson ${unlocked ? '' : 'locked'} ${st ? 'done' : ''}" data-i="${i}" data-say="${U.esc(unlocked ? sayName : 'Cerrado. Primero termina la lección anterior')}" ${unlocked ? '' : 'aria-disabled="true"'}>
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
    const token = ++runToken; Voice.stop(); Listen.stop();
    const l = w.lessons[idx];
    view = { name: 'lesson', world: w.id, idx };
    const steps = buildSteps(l);
    let hits = 0, total = 0;
    const api = {
      say: t => Voice.say(t),
      sfx: n => Sfx.play(n),
      alive: () => token === runToken,
      waitClick: el => new Promise(r => { el.onclick = () => { Sfx.play('tap'); r(); }; }),
      miss: key => Progress.miss(key),
      praise: async (text) => {
        // Confeti solo a veces, para que no sea previsible (Deci 1999: la recompensa esperada desmotiva).
        if (Math.random() < 0.4) Confetti.burst(50);
        Voice.say(text || U.pick(DATA.PRAISES));
        await U.wait(1100);
      },
    };
    Session.start();
    for (let i = 0; i < steps.length; i++) {
      if (token !== runToken) return;
      setTop({
        title: `${l.emoji} ${l.title}`,
        back: () => world(w.id),
        dotsHtml: steps.map((s, j) => `<i class="dot ${j < i ? 'done' : ''} ${j === i ? 'now' : ''}" title="${U.esc(s.name)}"></i>`).join(''),
      });
      screen.innerHTML = '';
      resetIdle();
      const root = document.createElement('section');
      root.className = 'stage';
      root.dataset.step = steps[i].name;
      screen.appendChild(root);
      const r = await steps[i].run(root, api);
      if (token !== runToken) return;
      hits += r.hits; total += r.total;
    }
    const firstTime = Progress.stars(l.id) === 0;
    // Las estrellas premian la práctica (veces completada), no el acierto a la primera.
    const rec = Progress.complete(l);
    Session.lessonDone();
    summary(w, idx, rec.stars, firstTime);
  }

  function summary(w, idx, stars, firstTime) {
    const l = w.lessons[idx];
    const next = w.lessons[idx + 1];
    setTop({ title: `${l.emoji} ${l.title}`, back: () => world(w.id) });
    Confetti.burst(140);
    Sfx.play('win');
    const tipFn = DATA.FAMILY_TIPS[l.type] || DATA.FAMILY_TIPS.game;
    const tip = tipFn(l.letter || '');
    const closing = Session.shouldClose();
    Voice.say(closing
      ? 'Has terminado la lección y hemos jugado un buen rato. Lo dejamos por hoy. Cuéntale a alguien qué has aprendido.'
      : stars === 3 ? 'Lección completada. Ya la has practicado tres veces: se nota.' : stars === 2 ? 'Lección completada. Cada vez que la repites, la aprendes mejor.' : 'Lección completada. Si la repites otro día, ganarás otra estrella.');
    screen.innerHTML = `
      <section class="summary">
        <div class="summary-stars">${[1, 2, 3].map(n => `<span class="big-star ${n <= stars ? 'on' : ''}" style="animation-delay:${n * 0.25}s">★</span>`).join('')}</div>
        <h2>${closing ? 'Hemos terminado por hoy' : '¡Lección completada!'}</h2>
        ${firstTime ? `<p class="sticker-earned">Nueva pegatina para tu álbum: <span class="emoji">${l.emoji}</span></p>` : '<p class="muted">Esta pegatina ya la tenías. Repetir también cuenta.</p>'}
        <div class="family-tip"><span class="emoji">👨‍👩‍👧</span><div><b>Para hacer juntos, sin pantalla:</b><br>${U.esc(tip)}</div></div>
        ${closing ? `<p class="muted">Llevamos ${Session.minutes()} minutos. Para seguir, un adulto puede abrirlo en ⚙️ Ajustes.</p>` : ''}
        <div class="actions column">
          ${closing ? '<button class="btn primary big" id="home" data-say="Hasta mañana"><span class="ico">🌙</span>Hasta mañana</button>' : next ? `<button class="btn primary big" id="next" data-say="Siguiente lección"><span class="ico">➡️</span>Siguiente: ${U.esc(next.title)}</button>` : '<button class="btn primary big" id="home" data-say="Volver al bosque"><span class="ico">🏡</span>Volver al bosque</button>'}
          ${closing ? '' : '<button class="btn ghost" id="again" data-say="Jugar otra vez"><span class="ico">🔁</span>Otra vez</button>'}
          ${closing ? '' : '<button class="btn ghost" id="list" data-say="Ver las lecciones"><span class="ico">📋</span>Lecciones</button>'}
        </div>
      </section>`;
    const q = s => screen.querySelector(s);
    if (q('#next')) q('#next').onclick = () => { Sfx.play('tap'); lesson(w, idx + 1); };
    if (q('#home')) q('#home').onclick = () => { Sfx.play('tap'); if (closing) Session.close(); home(); };
    if (q('#again')) q('#again').onclick = () => { Sfx.play('tap'); lesson(w, idx); };
    if (q('#list')) q('#list').onclick = () => { Sfx.play('tap'); world(w.id); };
  }

  /* ---------- Sesión: termina sola a los N minutos (EdTech Hub 2025; OMS/AAP/AEP) ---------- */
  const Session = (() => {
    let startedAt = 0, closed = false, lastLog = 0;
    function start() { if (!startedAt) { startedAt = Date.now(); lastLog = startedAt; } }
    function minutes() { return startedAt ? Math.round((Date.now() - startedAt) / 60000) : 0; }
    function lessonDone() { const now = Date.now(); Progress.logSession(Math.max(1, Math.round((now - lastLog) / 60000))); lastLog = now; }
    function shouldClose() { const lim = Settings.get().sessionMinutes; return !closed && lim > 0 && startedAt && (Date.now() - startedAt) >= lim * 60000; }
    function close() { closed = true; }
    function reopen() { startedAt = Date.now(); lastLog = startedAt; closed = false; }
    function isClosed() { return closed; }
    return { start, minutes, lessonDone, shouldClose, close, reopen, isClosed };
  })();

  /* ---------- Repetir la instrucción si no pasa nada en 20 segundos ---------- */
  let idleTimer = 0;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (view.name !== 'lesson') return;
    idleTimer = setTimeout(() => {
      const sp = document.querySelector('#screen #sp');
      if (sp && modal.hidden && view.name === 'lesson' && !speechSynthesis.speaking) sp.onclick && sp.onclick();
      resetIdle();
    }, 20000);
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, resetIdle, true));

  /* ---------- Álbum de pegatinas ---------- */
  function album() {
    runToken++; Voice.stop(); Listen.stop();
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
        <label>Micrófono (actividad "Dilo tú")</label>
        <small>${Listen.supported ? 'Este navegador puede escuchar. La primera vez pedirá permiso para el micrófono; en Chrome y Edge necesita conexión a internet.' : 'Este navegador no reconoce voz. En esa actividad aparece el botón "Ya lo dije" para que confirmes tú.'}</small>
      </div>
      <div class="field">
        <label for="rate">Velocidad de la voz: <output id="rateOut">${s.rate}</output></label>
        <input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="${s.rate}">
      </div>
      <div class="field">
        <label for="sessionMinutes">Minutos por sesión: <output id="sessionOut">${s.sessionMinutes || 'sin límite'}</output></label>
        <input type="range" id="sessionMinutes" min="0" max="20" step="5" value="${s.sessionMinutes}">
        <small>Al terminar la lección en curso, Lía se despide. Las sesiones cortas (5 a 10 minutos) funcionan mejor que las largas; la Asociación Española de Pediatría recomienda nada de pantallas antes de los 6 años y como mucho una hora al día de 6 a 12, siempre acompañados. 0 = sin límite.</small>
        ${Session.isClosed() ? '<button class="btn ghost" id="reopen">▶️ Seguir jugando hoy</button>' : ''}
      </div>
      <div class="field">
        <label for="startFrom">Punto de partida</label>
        <select id="startFrom">
          <option value="">Desde el principio (vocales)</option>
          <option value="letras">Ya conoce las vocales: empezar por las letras</option>
          <option value="silabas">Ya conoce las letras: empezar por las sílabas</option>
          <option value="palabras">Ya lee sílabas: empezar por las palabras</option>
        </select>
        <small>Marca como hechas las lecciones anteriores, para que un niño de 6 o 7 años no tenga que recorrerlo todo.</small>
      </div>
      <div class="field">
        <label>Informe para la familia</label>
        <div class="report">${familyReport()}</div>
      </div>
      <div class="field row">
        <label for="freeMode">Modo libre: todas las lecciones abiertas</label>
        <input type="checkbox" id="freeMode" ${s.freeMode ? 'checked' : ''}>
      </div>
      <div class="field row">
        <label for="twoTap">Doble toque con voz: el primer toque dice qué hace el botón y el segundo lo hace</label>
        <input type="checkbox" id="twoTap" ${s.twoTap ? 'checked' : ''}>
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
    q('#sessionMinutes').oninput = e => { Settings.set({ sessionMinutes: +e.target.value }); q('#sessionOut').value = +e.target.value || 'sin límite'; };
    if (q('#reopen')) q('#reopen').onclick = () => { Session.reopen(); closeModal(); home(); };
    q('#startFrom').onchange = e => { if (e.target.value) { Progress.startFrom(e.target.value); q('.report').innerHTML = familyReport(); } };
    q('#soundFx').onchange = e => Settings.set({ soundFx: e.target.checked });
    q('#twoTap').onchange = e => Settings.set({ twoTap: e.target.checked });
    q('#test').onclick = () => Voice.say('Hola. Vamos a jugar con las letras: ma, me, mi, mo, mu.');
    q('#close').onclick = () => { closeModal(); refresh(); };
    q('#reset').onclick = () => {
      if (q('#reset').dataset.armed) { Progress.reset(); closeModal(); home(); return; }
      q('#reset').dataset.armed = '1'; q('#reset').textContent = '¿Seguro? Toca otra vez para borrar';
    };
  }

  /* Informe local para la familia: dominado, en curso, letras que más cuestan, minutos por día. */
  function familyReport() {
    const d = Progress.load();
    const done = Object.keys(d.lessons).length;
    const total = DATA.WORLDS.filter(w => !w.free).reduce((a, w) => a + w.lessons.length, 0);
    const hard = Progress.hardest(5);
    const days = d.sessions.slice(-7);
    const mins = days.reduce((a, x) => a + x.minutes, 0);
    const letterLabel = k => DATA.LETTERS[k] ? `${k.toUpperCase()} (${DATA.LETTERS[k].name})` : k;
    const tips = hard.slice(0, 2).map(([k]) => DATA.LETTERS[k] ? (DATA.VOWELS.includes(k) ? DATA.FAMILY_TIPS.vowel(k) : DATA.FAMILY_TIPS.consonant(k)) : `Decid despacio "${k}" dando una palmada y buscad palabras que la tengan.`);
    return `
      <ul>
        <li><b>${done}</b> de ${total} lecciones completadas · <b>${d.stickers.length}</b> pegatinas</li>
        <li>Últimos 7 días con juego: <b>${days.length}</b> · minutos: <b>${mins}</b></li>
        <li>Lo que más cuesta: ${hard.length ? hard.map(([k, n]) => `<b>${U.esc(letterLabel(k))}</b> (${n} fallos)`).join(', ') : 'aún sin datos'}</li>
      </ul>
      ${tips.length ? `<p><b>Para practicar sin pantalla:</b></p><ul>${tips.map(t => `<li>${U.esc(t)}</li>`).join('')}</ul>` : ''}
      <p class="muted">Las letras en espejo (b/d, p/q) son normales hasta los 7 años; el juego no las cuenta como fallo.</p>`;
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
