'use strict';
/* Actividades. Cada una es una función async (root, api) => { hits, total }.
   hits = aciertos a la primera; total = oportunidades. Con eso se calculan las estrellas. */
const U = {
  shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; },
  pick(a) { return a[Math.floor(Math.random() * a.length)]; },
  esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); },
  wait(ms) { return new Promise(r => setTimeout(r, ms)); },
};

/* Texto según el modo de letras elegido por los padres. */
function fmtText(s) { return Settings.get().caseMode === 'upper' ? s.toUpperCase() : s; }
function fmtLetter(l) {
  const m = Settings.get().caseMode;
  if (m === 'upper') return l.toUpperCase();
  if (m === 'lower') return l;
  return l.toUpperCase() + ' ' + l;
}
function letterName(l) { return DATA.LETTERS[l].name; }
function isVowel(l) { return DATA.VOWELS.includes(l); }

function promptHTML(text, speakId = 'sp') {
  return `<div class="prompt">
    <button class="speak-btn" id="${speakId}" aria-label="Escuchar otra vez">🔊</button>
    <p class="prompt-text">${text}</p>
  </div>`;
}

const A = {};

/* 1. Presentación de una letra. */
A.intro = letter => async (root, api) => {
  const info = DATA.LETTERS[letter];
  const vowel = isVowel(letter);
  const syls = vowel ? [] : DATA.syllablesFor(letter);
  root.innerHTML = `
    ${promptHTML(`Esta es la letra <b>${U.esc(info.name)}</b>. Tócala para oírla.`)}
    <div class="intro">
      <button class="bigletter font-letters" id="bl" aria-label="Letra ${U.esc(info.name)}">${letter.toUpperCase()}<span class="lower">${letter}</span></button>
      <button class="example" id="ex"><span class="emoji">${info.emoji}</span><span class="word font-letters">${U.esc(fmtText(info.word))}</span></button>
      ${syls.length ? `<div class="tiles" id="syls">${syls.map(s => `<button class="tile font-letters" data-s="${s}">${U.esc(fmtText(s))}</button>`).join('')}</div>` : ''}
    </div>
    <div class="actions"><button class="btn primary big" id="next">Siguiente ➜</button></div>`;
  const speech = vowel
    ? `Esta es la letra ${info.name}. ${info.name}, de ${info.word}.`
    : `Esta es la letra ${info.name}. ${info.name}, de ${info.word}. Con ella decimos: ${syls.join(', ')}.`;
  root.querySelector('#sp').onclick = () => api.say(speech);
  root.querySelector('#bl').onclick = () => { api.sfx('tap'); api.say(info.name); };
  root.querySelector('#ex').onclick = () => { api.sfx('tap'); api.say(info.word); };
  root.querySelectorAll('.tile').forEach(t => t.onclick = () => { api.sfx('tap'); api.say(t.dataset.s); });
  api.say(speech);
  await api.waitClick(root.querySelector('#next'));
  return { hits: 0, total: 0 };
};

/* 2. Escucha y toca (letras o sílabas). */
function pickActivity({ kind, targets, pool, rounds }) {
  return async (root, api) => {
    let hits = 0;
    const order = U.shuffle(targets);
    for (let r = 0; r < rounds; r++) {
      if (!api.alive()) return { hits, total: rounds };
      const target = order[r % order.length];
      const distractors = U.shuffle(pool.filter(x => x !== target)).slice(0, 2);
      const options = U.shuffle([target, ...distractors]);
      const spoken = kind === 'letter' ? `Toca la letra ${letterName(target)}.` : `Toca la sílaba: ${target}.`;
      const label = kind === 'letter' ? `Toca la letra <b>${U.esc(letterName(target))}</b>` : 'Toca la sílaba que oyes';
      root.innerHTML = `
        ${promptHTML(label)}
        <div class="round-count">${r + 1} / ${rounds}</div>
        <div class="cards" id="cards">
          ${options.map(o => `<button class="card font-letters" data-v="${U.esc(o)}">${U.esc(kind === 'letter' ? fmtLetter(o) : fmtText(o))}</button>`).join('')}
        </div>`;
      root.querySelector('#sp').onclick = () => api.say(spoken);
      api.say(spoken);
      const cards = [...root.querySelectorAll('.card')];
      let wrong = 0, first = true, done = false;
      const ok = await new Promise(resolve => {
        cards.forEach(card => card.onclick = async () => {
          if (done) return;
          const v = card.dataset.v;
          if (v === target) {
            done = true; card.classList.add('correct'); api.sfx('ok');
            await api.praise();
            resolve(first);
          } else {
            first = false; wrong++; api.sfx('no');
            card.classList.add('wrong'); setTimeout(() => card.classList.remove('wrong'), 700);
            const msg = kind === 'letter'
              ? `Esa es la ${letterName(v)}. Busca la ${letterName(target)}.`
              : `Esa es ${v}. Busca: ${target}.`;
            api.say(msg);
            if (wrong >= 2) cards.find(c => c.dataset.v === target).classList.add('hint');
          }
        });
      });
      if (ok) hits++;
      await U.wait(350);
    }
    return { hits, total: rounds };
  };
}
A.pickLetter = (target, pool, rounds) => pickActivity({ kind: 'letter', targets: [target], pool, rounds });
A.pickSyllable = (targets, pool, rounds) => pickActivity({ kind: 'syllable', targets, pool, rounds });

/* 3. Forma la sílaba: consonante + vocal. */
A.buildSyllable = (consonants, rounds) => async (root, api) => {
  let hits = 0;
  const extra = DATA.CONSONANTS.filter(c => !consonants.includes(c));
  for (let r = 0; r < rounds; r++) {
    if (!api.alive()) return { hits, total: rounds };
    const c = U.pick(consonants);
    const v = U.pick(DATA.LETTERS[c].vowels || DATA.VOWELS);
    const target = c + v;
    const consRow = U.shuffle([...new Set([c, ...U.shuffle(consonants).slice(0, 2), ...extra])].slice(0, 3));
    const spoken = `Forma la sílaba: ${target}.`;
    root.innerHTML = `
      ${promptHTML('Forma la sílaba que oyes')}
      <div class="round-count">${r + 1} / ${rounds}</div>
      <div class="slots font-letters" id="slots"><span class="slot" data-i="0"></span><span class="slot" data-i="1"></span></div>
      <div class="tiles" id="cons">${consRow.map(x => `<button class="tile cons font-letters" data-v="${x}">${U.esc(fmtText(x))}</button>`).join('')}</div>
      <div class="tiles" id="vows">${DATA.VOWELS.map(x => `<button class="tile vow font-letters" data-v="${x}">${U.esc(fmtText(x))}</button>`).join('')}</div>`;
    root.querySelector('#sp').onclick = () => api.say(spoken);
    api.say(spoken);
    const slots = [...root.querySelectorAll('.slot')];
    let sel = [null, null], first = true, done = false;
    const ok = await new Promise(resolve => {
      const check = async () => {
        if (sel[0] == null || sel[1] == null) return;
        const made = sel[0] + sel[1];
        if (made === target) {
          done = true; slots.forEach(s => s.classList.add('correct')); api.sfx('ok');
          api.say(target);
          await api.praise();
          resolve(first);
        } else {
          first = false; api.sfx('no');
          slots.forEach(s => s.classList.add('wrong'));
          api.say(`Eso dice ${made}. Escucha otra vez: ${target}.`);
          await U.wait(900);
          sel = [null, null];
          slots.forEach(s => { s.textContent = ''; s.classList.remove('wrong'); });
        }
      };
      root.querySelectorAll('.tile').forEach(t => t.onclick = () => {
        if (done) return;
        api.sfx('tap');
        const i = t.classList.contains('cons') ? 0 : 1;
        sel[i] = t.dataset.v;
        slots[i].textContent = fmtText(t.dataset.v);
        api.say(t.dataset.v === 'h' ? 'hache' : t.dataset.v);
        check();
      });
    });
    if (ok) hits++;
    await U.wait(350);
  }
  return { hits, total: rounds };
};

/* 4. Arma la palabra con sílabas. */
A.buildWord = (word, lessonWords) => async (root, api) => {
  const others = lessonWords.flatMap(w => w.s).filter(s => !word.s.includes(s));
  const tiles = U.shuffle([...word.s, ...U.shuffle([...new Set(others)]).slice(0, 2)]);
  const spoken = `Escucha: ${word.w}. Arma la palabra ${word.w}.`;
  root.innerHTML = `
    ${promptHTML('Arma la palabra que oyes')}
    <div class="word-target"><span class="emoji">${word.e}</span></div>
    <div class="slots font-letters" id="slots">${word.s.map((_, i) => `<span class="slot" data-i="${i}"></span>`).join('')}</div>
    <div class="tiles" id="tiles">${tiles.map((s, i) => `<button class="tile font-letters" data-v="${U.esc(s)}" data-i="${i}">${U.esc(fmtText(s))}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(spoken);
  root.querySelector('.word-target').onclick = () => api.say(word.w);
  api.say(spoken);
  const slots = [...root.querySelectorAll('.slot')];
  let pos = 0, first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.tile').forEach(t => t.onclick = async () => {
      if (done || t.disabled) return;
      if (t.dataset.v === word.s[pos]) {
        api.sfx('pop');
        t.disabled = true; t.classList.add('used');
        slots[pos].textContent = fmtText(t.dataset.v); slots[pos].classList.add('filled');
        pos++;
        if (pos === word.s.length) {
          done = true; slots.forEach(s => s.classList.add('correct')); api.sfx('ok');
          await api.say(word.w);
          await api.praise();
          resolve(first);
        } else {
          api.say(t.dataset.v);
        }
      } else {
        first = false; api.sfx('no');
        t.classList.add('wrong'); setTimeout(() => t.classList.remove('wrong'), 700);
        api.say(`${word.w}. ${word.s.join(', ')}.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 5. Lee la palabra y toca el dibujo. Sin audio inicial: aquí se lee de verdad. */
A.readWord = (word, lessonWords) => async (root, api) => {
  const others = U.shuffle(lessonWords.filter(w => w.w !== word.w && w.e !== word.e)).slice(0, 2);
  const options = U.shuffle([word, ...others]);
  root.innerHTML = `
    ${promptHTML('Lee la palabra y toca su dibujo')}
    <div class="read-word font-letters" id="rw">${U.esc(fmtText(word.w))}</div>
    <div class="cards" id="cards">${options.map(o => `<button class="card emoji-card" data-v="${U.esc(o.w)}" aria-label="${U.esc(o.w)}">${o.e}</button>`).join('')}</div>
    <div class="actions"><button class="btn ghost" id="help">🔊 Ayúdame a leer</button></div>`;
  root.querySelector('#sp').onclick = () => api.say('Lee la palabra y toca su dibujo.');
  api.say('Lee la palabra. ¿Qué dice? Toca su dibujo.');
  const cards = [...root.querySelectorAll('.card')];
  let first = true, done = false;
  // Leer sílaba a sílaba, como ayuda (cuenta como no acertado a la primera).
  root.querySelector('#help').onclick = async () => { first = false; api.sfx('tap'); await api.say(word.s.join('. ') + '. ' + word.w); };
  root.querySelector('#rw').onclick = () => root.querySelector('#help').click();
  const ok = await new Promise(resolve => {
    cards.forEach(card => card.onclick = async () => {
      if (done) return;
      if (card.dataset.v === word.w) {
        done = true; card.classList.add('correct'); api.sfx('ok');
        api.say(word.w);
        await api.praise();
        resolve(first);
      } else {
        first = false; api.sfx('no');
        card.classList.add('wrong'); setTimeout(() => card.classList.remove('wrong'), 700);
        api.say(`Eso es ${card.dataset.v}. Lee otra vez: ${word.s.join(', ')}.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 6. Traza (con guía) o escribe (sin guía) una letra, sílaba o palabra. */
A.trace = (text, { guide = true, spoken = null } = {}) => async (root, api) => {
  const speakText = spoken || text;
  const spokenMsg = guide ? `Sigue la letra con el dedo: ${speakText}.` : `Ahora escribe tú, sin ayuda: ${speakText}.`;
  root.innerHTML = `
    ${promptHTML(guide ? `Sigue los puntos: <b class="font-letters">${U.esc(fmtText(text))}</b>` : `Escribe tú: <b>${U.esc(speakText)}</b>`)}
    <div class="trace-wrap"><canvas id="tc" aria-label="Zona para escribir"></canvas></div>
    <div class="actions trace-actions">
      <button class="btn ghost" id="clear">↺ Borrar</button>
      ${guide ? '' : '<button class="btn ghost" id="hint">💡 Pista</button>'}
      <button class="btn primary big" id="done" disabled>✔ Listo</button>
    </div>`;
  root.querySelector('#sp').onclick = () => api.say(spokenMsg);
  api.say(spokenMsg);
  const doneBtn = root.querySelector('#done');
  const tracer = new Tracer(root.querySelector('#tc'), { text: fmtText(text), guide, onInk: () => { doneBtn.disabled = false; } });
  root.querySelector('#clear').onclick = () => { api.sfx('tap'); tracer.clear(); doneBtn.disabled = true; };
  const hintBtn = root.querySelector('#hint');
  if (hintBtn) hintBtn.onclick = () => { api.sfx('tap'); tracer.showHint(3000); };
  let attempts = 0, skip = null;
  try {
    while (api.alive()) {
      const which = await Promise.race([
        api.waitClick(doneBtn).then(() => 'done'),
        skip ? api.waitClick(skip).then(() => 'skip') : new Promise(() => {}),
      ]);
      if (which === 'skip') return { hits: 0, total: 1 };
      const res = tracer.evaluate();
      if (res.ok) {
        api.sfx('ok');
        await api.praise();
        return { hits: attempts === 0 ? 1 : 0, total: 1 };
      }
      attempts++;
      api.sfx('no');
      if (res.coverage < 0.3) api.say('Falta pintar más. Sigue toda la letra con el dedo.');
      else if (res.precision < 0.5) api.say('Te saliste un poco. Intenta ir por encima de los puntos.');
      else api.say(U.pick(DATA.RETRY));
      tracer.showHint(3500);
      if (attempts >= 2 && !skip) {
        skip = document.createElement('button');
        skip.className = 'btn ghost'; skip.textContent = 'Siguiente ➜';
        root.querySelector('.trace-actions').appendChild(skip);
      }
    }
    return { hits: 0, total: 1 };
  } finally { tracer.destroy(); }
};

/* Secuencia de actividades de cada tipo de lección. */
function buildSteps(lesson) {
  const mode = Settings.get().caseMode;
  const cases = mode === 'both' ? ['upper', 'lower'] : [mode];
  const cased = (l, c) => (c === 'upper' ? l.toUpperCase() : l);
  // Las letras llegan ya con mayúscula/minúscula decidida; fmtText no las altera en modo 'both' ni 'lower'.
  const traceLetter = (l, c, guide) => A.trace(cased(l, c), { guide, spoken: letterName(l) });

  if (lesson.type === 'vowel') {
    const v = lesson.letter;
    return [
      { name: 'Conoce', run: A.intro(v) },
      { name: 'Escucha y toca', run: A.pickLetter(v, DATA.VOWELS, 3) },
      ...cases.map(c => ({ name: 'Traza', run: traceLetter(v, c, true) })),
      { name: 'Escribe', run: traceLetter(v, cases[0], false) },
    ];
  }
  if (lesson.type === 'consonant') {
    const c = lesson.letter;
    const idx = DATA.CONSONANTS.indexOf(c);
    const known = DATA.CONSONANTS.slice(0, idx);
    const pool = [c, ...known.slice(-3), ...DATA.VOWELS];
    const syls = DATA.syllablesFor(c);
    return [
      { name: 'Conoce', run: A.intro(c) },
      { name: 'Escucha y toca', run: A.pickLetter(c, pool, 3) },
      ...cases.map(k => ({ name: 'Traza', run: traceLetter(c, k, true) })),
      { name: 'Sílabas', run: A.pickSyllable(syls, syls, 3) },
      { name: 'Forma', run: A.buildSyllable([c], 3) },
      { name: 'Traza', run: A.trace(syls[0], { guide: true }) },
      { name: 'Escribe', run: A.trace(U.pick(syls), { guide: false }) },
    ];
  }
  if (lesson.type === 'syllables') {
    const syls = lesson.consonants.flatMap(DATA.syllablesFor);
    return [
      { name: 'Escucha y toca', run: A.pickSyllable(syls, syls, 5) },
      { name: 'Forma', run: A.buildSyllable(lesson.consonants, 4) },
      { name: 'Traza', run: A.trace(U.pick(syls), { guide: true }) },
      { name: 'Escucha y toca', run: A.pickSyllable(syls, syls, 3) },
      { name: 'Escribe', run: A.trace(U.pick(syls), { guide: false }) },
    ];
  }
  if (lesson.type === 'words') {
    const ws = U.shuffle(lesson.words).slice(0, 6);
    const w = i => ws[i % ws.length];
    return [
      { name: 'Arma', run: A.buildWord(w(0), lesson.words) },
      { name: 'Lee', run: A.readWord(w(1), lesson.words) },
      { name: 'Arma', run: A.buildWord(w(2), lesson.words) },
      { name: 'Traza', run: A.trace(w(3).w, { guide: true }) },
      { name: 'Lee', run: A.readWord(w(4), lesson.words) },
      { name: 'Escribe', run: A.trace(w(5).w, { guide: false }) },
    ];
  }
  return [];
}
