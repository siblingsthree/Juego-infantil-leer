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
    <button class="speak-btn" id="${speakId}" aria-label="Escuchar otra vez">${ICONS.raw('speaker')}</button>
    <p class="prompt-text">${text}</p>
  </div>`;
}

const A = {};

/* 1. Presentación de una letra. */
A.intro = (letter, opts = {}) => async (root, api) => {
  const base = DATA.LETTERS[letter];
  const info = Object.assign({}, base, opts.word ? { word: opts.word, emoji: opts.emoji } : {});
  const vowel = isVowel(letter);
  const syls = vowel ? [] : (opts.syllables || DATA.syllablesFor(letter));
  const shown = opts.nameHint || info.name;
  root.innerHTML = `
    ${promptHTML(info.silent ? `La <b>hache</b> es muda: no suena.` : `Esta letra suena como en <b>${U.esc(info.word)}</b>. Tócala para oírla.`)}
    <div class="intro">
      <button class="bigletter font-letters" id="bl" aria-label="Letra ${U.esc(shown)}">${letter.toUpperCase()}<span class="lower">${letter}</span></button>
      <button class="example" id="ex"><span class="emoji">${info.emoji}</span><span class="word font-letters">${U.esc(fmtText(info.word))}</span></button>
      ${syls.length ? `<div class="tiles" id="syls">${syls.map(s => `<button class="tile font-letters" data-s="${s}">${U.esc(fmtText(s))}</button>`).join('')}</div>` : ''}
    </div>
    <div class="actions"><button class="btn go big" id="next" data-say="Siguiente">Siguiente${ico('next')}</button></div>`;
  // Primero el sonido en contexto (sílabas y palabra), después el nombre, que es el dato secundario.
  const speech = info.silent
    ? `Esta es la hache. Es muda: no suena. ${info.word} empieza por hache, pero oímos: ${info.word}. ${syls.join(', ')}.`
    : vowel
      ? `Esta letra suena ${info.name}. ${info.name}, como en ${info.word}. Se llama ${info.name}.`
      : `Esta letra suena como en ${info.word}: ${syls[0]}. Con ella decimos: ${syls.join(', ')}. Se llama ${shown}.`;
  root.querySelector('#sp').onclick = () => api.say(speech);
  root.querySelector('#bl').onclick = () => { api.sfx('tap'); Voice.sound(letter, info.name); };
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
            await api.praise(first ? null : U.pick(DATA.PRAISES_RETRY));
            resolve(first);
          } else {
            first = false; wrong++; api.sfx('no'); api.miss(target);
            card.classList.add('wrong', 'dim'); setTimeout(() => card.classList.remove('wrong'), 700);
            const msg = kind === 'letter'
              ? `Esa es la ${letterName(v)}. Escucha: ${letterName(target)}. Busca la ${letterName(target)}.`
              : `Esa es ${v}. Escucha: ${target}. Busca ${target}.`;
            api.say(msg);
            if (wrong >= 2) { cards.find(c => c.dataset.v === target).classList.add('hint'); api.say(`Es esta: ${kind === 'letter' ? letterName(target) : target}. Tócala.`); }
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
A.buildSyllable = (consonants, rounds, only = null) => async (root, api) => {
  let hits = 0;
  const extra = DATA.CONSONANTS.filter(c => !consonants.includes(c) && c.length === 1);
  for (let r = 0; r < rounds; r++) {
    if (!api.alive()) return { hits, total: rounds };
    const c = U.pick(consonants);
    const v = only ? U.pick(only).slice(c.length) : U.pick(DATA.LETTERS[c].vowels || DATA.VOWELS);
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
          await api.praise(`${target}. Has juntado la ${letterName(sel[0])} y la ${sel[1]}.`);
          resolve(first);
        } else {
          // Solo se marca lo que está mal: si la vocal es correcta, se queda puesta.
          first = false; api.sfx('no'); api.miss(target);
          const okC = sel[0] === c, okV = sel[1] === v;
          slots[0].classList.add(okC ? 'keep' : 'wrong');
          slots[1].classList.add(okV ? 'keep' : 'wrong');
          api.say(okV ? `La ${v} está bien. Escucha: ${target}. ¿Qué letra va delante?`
            : okC ? `La ${letterName(c)} está bien. Escucha: ${target}. ¿Qué vocal va detrás?`
            : `Eso dice ${made}. Escucha otra vez: ${target}.`);
          await U.wait(900);
          if (!okC) { sel[0] = null; slots[0].textContent = ''; }
          if (!okV) { sel[1] = null; slots[1].textContent = ''; }
          slots.forEach(s => s.classList.remove('wrong'));
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
          await api.praise(`${word.w}. ${U.pick(DATA.PRAISES)}`);
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
    <div class="actions"><button class="btn hint" id="help" data-say="Ayuda para leer">${ico('question')}Ayúdame</button></div>`;
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
        await api.praise(`${word.w}. ${U.pick(DATA.PRAISES)}`);
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
      ${text.length === 1 && STROKES.get(fmtText(text)) ? `<button class="btn hint" id="demo" data-say="Ver cómo se hace">${ico('eye')}Ver</button>` : ''}
      <button class="btn soft" id="clear" data-say="Borrar todo">${ico('eraser')}Borrar</button>
      ${guide ? '' : `<button class="btn hint" id="hint" data-say="Pista: ver la letra">${ico('bulb')}Pista</button>`}
      <button class="btn go big" id="done" disabled data-say="Listo: comprobar">${ico('check')}Listo</button>
    </div>`;
  root.querySelector('#sp').onclick = () => api.say(spokenMsg);
  api.say(spokenMsg);
  const doneBtn = root.querySelector('#done');
  const tracer = new Tracer(root.querySelector('#tc'), { text: fmtText(text), guide, onInk: () => { doneBtn.disabled = false; } });
  root.querySelector('#clear').onclick = () => { api.sfx('tap'); tracer.clear(); doneBtn.disabled = true; };
  const demoBtn = root.querySelector('#demo');
  if (demoBtn) {
    demoBtn.onclick = async () => { api.sfx('tap'); api.say('Mira cómo se hace. Empieza en el punto verde.'); await tracer.playDemo(); };
    // Con guía, la animación se muestra sola la primera vez (modelo en movimiento: Wright y Wright 1980).
    // Sin bloquear: si la niña toca "Listo" durante la animación, se atiende igual.
    if (guide) U.wait(900).then(() => { if (api.alive() && root.isConnected) { api.say(`Mira cómo se hace la ${speakText}. Empieza en el punto verde.`); tracer.playDemo(); } });
  }
  let startHinted = false;
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
        await api.praise(attempts ? U.pick(DATA.PRAISES_RETRY) : `Has seguido la forma de la ${speakText}.`);
        return { hits: attempts === 0 ? 1 : 0, total: 1 };
      }
      if (!res.ok && !startHinted && !tracer.startedAtStart()) {
        startHinted = true;
        api.say('Empieza en el punto verde y sigue la flecha del lápiz.');
        tracer.showHint(4000); tracer.playDemo();
        continue;
      }
      if (res.mirrored) {
        // Letra en espejo: normal hasta los 7 años. Se muestra el modelo con su punto de inicio y no cuenta como intento.
        api.say(`Está del revés. Mira el punto verde: ahí empieza. Vuelve a hacerla.`);
        tracer.showHint(4000);
        continue;
      }
      attempts++;
      api.sfx('no');
      if (!res.sizeOk) api.say('Hazla más grande, del tamaño de la letra gris.');
      else if (res.coverage < 0.3) api.say('Falta pintar más. Sigue toda la letra con el dedo.');
      else if (res.precision < 0.5) api.say('Te saliste un poco. Intenta ir por encima de los puntos.');
      else api.say(U.pick(DATA.RETRY));
      tracer.showHint(3500);
      if (attempts >= 2 && !skip) {
        skip = document.createElement('button');
        skip.className = 'btn go'; skip.dataset.say = 'Siguiente'; skip.innerHTML = 'Siguiente' + ico('next');
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
      { name: '¿Con qué empieza?', run: A.initialSound(DATA.VOWELS, 2) },
      ...cases.map(c => ({ name: 'Traza', run: traceLetter(v, c, true) })),
      { name: 'Escribe', run: traceLetter(v, cases[0], false) },
    ];
  }
  if (lesson.type === 'consonant') {
    const c = lesson.letter;
    const idx = DATA.CONSONANTS.indexOf(c);
    const known = DATA.CONSONANTS.slice(0, idx);
    const pool = [c, ...known.slice(-3), ...DATA.VOWELS];
    const syls = lesson.syllables || DATA.syllablesFor(c);
    return [
      { name: 'Conoce', run: A.intro(c, lesson) },
      { name: 'Escucha y toca', run: A.pickLetter(c, pool, 3) },
      ...(c.length === 1 && c !== 'h' && !lesson.syllables ? [{ name: '¿Con qué empieza?', run: A.initialSound([c, ...known.filter(k => k.length === 1 && k !== 'h').slice(-2), ...DATA.VOWELS.slice(0, 2)], 2) }] : []),
      ...cases.map(k => ({ name: 'Traza', run: traceLetter(c, k, true) })),
      { name: 'Sílabas', run: A.pickSyllable(syls, [...syls, ...known.slice(-1).flatMap(DATA.syllablesFor)], 3) },
      { name: 'Forma', run: A.buildSyllable([c], 3, lesson.syllables) },
      { name: 'Dilo tú', run: A.saySyllable(c, U.pick(lesson.syllables ? lesson.syllables.map(x => x.slice(c.length)) : (DATA.LETTERS[c].vowels || DATA.VOWELS))) },
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
      { name: 'Dilo tú', run: (() => { const c = U.pick(lesson.consonants); return A.saySyllable(c, U.pick(DATA.LETTERS[c].vowels || DATA.VOWELS)); })() },
      { name: 'Escucha y toca', run: A.pickSyllable(syls, syls, 3) },
      { name: 'Escribe', run: A.trace(U.pick(syls), { guide: false }) },
    ];
  }
  if (lesson.type === 'game') return buildGameSteps(lesson);
  if (lesson.type === 'units') {
    const us = U.shuffle(lesson.units);
    return [
      { name: 'Escucha y toca', run: A.pickSyllable(lesson.units, lesson.units, 4) },
      { name: 'Forma', run: A.buildUnit(us[0]) },
      { name: 'Forma', run: A.buildUnit(us[1]) },
      { name: 'Dilo tú', run: A.sayUnit(us[2]) },
      { name: 'Traza', run: A.trace(us[3], { guide: true }) },
      { name: 'Arma', run: A.buildWord(U.pick(lesson.words), lesson.words) },
      { name: 'Escribe', run: A.trace(us[4] || us[0], { guide: false }) },
    ];
  }
  if (lesson.type === 'closed') {
    const ws = U.shuffle(lesson.words);
    const w = i => ws[i % ws.length];
    return [
      { name: 'Lee', run: A.readWord(w(0), lesson.words) },
      { name: 'Dictado', run: A.dictation(w(1)) },
      { name: '¿Cuál es?', run: A.pickWord(w(2), lesson.words) },
      { name: 'Arma', run: A.buildWord(w(3), lesson.words) },
      { name: 'Lee en voz alta', run: A.sayWord(w(0)) },
      { name: 'Traza', run: A.trace(w(4).w, { guide: true }) },
      { name: 'Dictado', run: A.dictation(w(5)) },
    ];
  }
  if (lesson.type === 'sentences') {
    const ss = U.shuffle(lesson.sentences);
    const sn = i => ss[i % ss.length];
    return [
      { name: 'Lee la frase', run: A.readSentence(sn(0), lesson.sentences) },
      { name: 'Ordena', run: A.orderSentence(sn(1)) },
      { name: 'Lee la frase', run: A.readSentence(sn(2), lesson.sentences) },
      { name: 'Lee en voz alta', run: A.saySentence(sn(0)) },
      { name: 'Ordena', run: A.orderSentence(sn(3)) },
      { name: 'Lee la frase', run: A.readSentence(sn(4), lesson.sentences) },
    ];
  }
  if (lesson.type === 'story') {
    return [
      { name: 'Cuento', run: A.story(lesson.story) },
      { name: 'Ordena', run: A.orderSentence(U.pick(lesson.story.lines)) },
      { name: 'Lee en voz alta', run: A.saySentence(lesson.story.lines[0]) },
    ];
  }
  if (lesson.type === 'words') {
    const ws = U.shuffle(lesson.words).slice(0, 6);
    const w = i => ws[i % ws.length];
    return [
      { name: 'Arma', run: A.buildWord(w(0), lesson.words) },
      { name: 'Lee', run: A.readWord(w(1), lesson.words) },
      { name: 'Sílaba perdida', run: A.missingSyllable(w(2), lesson.words) },
      { name: 'Traza', run: A.trace(w(3).w, { guide: true }) },
      { name: '¿Cuál es?', run: A.pickWord(w(4), lesson.words) },
      { name: 'Lee en voz alta', run: A.sayWord(w(1)) },
      { name: 'Dictado', run: A.dictation(w(0)) },
      { name: 'Escribe', run: A.trace(w(5).w, { guide: false }) },
    ];
  }
  return [];
}

/* 7. Dilo tú: la niña pronuncia la sílaba o la palabra y el micrófono la reconoce.
   Nunca bloquea: tras un intento fallido (o si no hay micrófono) aparece "Ya lo dije". */
function speakActivity({ kind, target, display, promptText, promptSpoken, modelSpoken, rounds = 1 }) {
  return async (root, api) => {
    root.innerHTML = `
      ${promptHTML(promptText)}
      <div class="say">
        ${display}
        <button class="mic-btn" id="mic" aria-label="Hablar" data-say="Micrófono para hablar"><span class="mic-icon">${ICONS.raw('mic')}</span><span class="mic-label">Dilo tú</span></button>
        <p class="heard" id="heard" aria-live="polite"></p>
      </div>
      <div class="actions" id="say-actions"></div>`;
    const mic = root.querySelector('#mic');
    const heard = root.querySelector('#heard');
    const actions = root.querySelector('#say-actions');
    root.querySelector('#sp').onclick = () => api.say(promptSpoken);
    const targetBtn = root.querySelector('[data-say]');
    if (targetBtn) targetBtn.onclick = () => { api.sfx('tap'); api.say(targetBtn.dataset.say); };
    api.say(promptSpoken);

    let attempts = 0, first = true, done = false, busy = false, selfBtn = null, skipBtn = null;
    const addSelf = () => {
      if (selfBtn) return;
      selfBtn = document.createElement('button');
      selfBtn.className = 'btn hint'; selfBtn.dataset.say = 'Ya lo dije'; selfBtn.innerHTML = ico('thumb') + 'Ya lo dije';
      actions.appendChild(selfBtn);
    };
    const addSkip = () => {
      if (skipBtn) return;
      skipBtn = document.createElement('button');
      skipBtn.className = 'btn go'; skipBtn.dataset.say = 'Siguiente'; skipBtn.innerHTML = 'Siguiente' + ico('next');
      actions.appendChild(skipBtn);
    };
    if (!Listen.supported || window.top !== window.self) {
      heard.textContent = Listen.platformHint('unsupported') + ' Dilo en voz alta y toca "Ya lo dije".';
      addSelf();
    }

    const ok = await new Promise(resolve => {
      mic.onclick = async () => {
        if (done || busy) return;
        busy = true; mic.classList.add('listening'); mic.querySelector('.mic-label').textContent = 'Te escucho…';
        heard.textContent = '';
        api.sfx('pop');
        const res = await Listen.listen({ onInterim: t => { heard.textContent = `Oigo: «${t}»`; } });
        mic.classList.remove('listening'); mic.querySelector('.mic-label').textContent = 'Dilo tú'; busy = false;
        if (done) return;
        if (res.status === 'result') {
          const hit = Listen.matches(res.alternatives, target, { kind });
          heard.textContent = `He oído: «${res.alternatives[0].trim()}»`;
          if (hit) {
            done = true; mic.classList.add('correct'); api.sfx('ok');
            await api.praise();
            return resolve(first);
          }
          attempts++; first = false; api.sfx('no');
          mic.classList.add('wrong'); setTimeout(() => mic.classList.remove('wrong'), 700);
          api.say(`He oído ${res.alternatives[0]}. Vamos a decirlo juntos: ${modelSpoken}. Ahora tú.`);
        } else if (res.status === 'denied' || res.status === 'nomic' || res.status === 'network' || res.status === 'error') {
          heard.textContent = 'El micrófono no funciona aquí. ' + Listen.platformHint(res.status) + ' Mientras tanto, dilo en voz alta y toca "Ya lo dije".';
          api.say('No puedo usar el micrófono. Dilo en voz alta y toca: ya lo dije.');
          addSelf();
        } else {
          attempts++;
          heard.textContent = 'No te he oído. ' + (attempts >= 2 ? Listen.platformHint('nospeech') : 'Acércate y dilo más fuerte.');
          api.say(`No te he oído. Dilo más fuerte: ${modelSpoken}.`);
        }
        if (attempts >= 1) addSelf();
        if (attempts >= 2) addSkip();
        if (selfBtn) selfBtn.onclick = async () => { if (done) return; done = true; api.sfx('ok'); await Promise.race([api.say(modelSpoken), U.wait(4000)]); resolve(false); };
        if (skipBtn) skipBtn.onclick = () => { if (done) return; done = true; resolve(false); };
      };
      if (selfBtn) selfBtn.onclick = async () => { if (done) return; done = true; api.sfx('ok'); await Promise.race([api.say(modelSpoken), U.wait(4000)]); resolve(false); };
    });
    return { hits: ok ? 1 : 0, total: 1 };
  };
}

A.saySyllable = (c, v) => {
  const syl = c + v;
  return speakActivity({
    kind: 'syllable', target: syl,
    display: `<div class="equation font-letters">
        <span class="eq-letter cons">${U.esc(fmtText(c))}</span><span class="eq-op">+</span>
        <span class="eq-letter vow">${U.esc(fmtText(v))}</span><span class="eq-op">=</span>
        <button class="eq-result" data-say="${U.esc(syl)}" aria-label="Oír ${U.esc(syl)}">?</button>
      </div>`,
    promptText: `¿La <b>${U.esc(letterName(c))}</b> con la <b>${U.esc(v)}</b>? Dilo en voz alta`,
    promptSpoken: `¿La ${letterName(c)} con la ${v}? ¿Qué dice? Toca el micrófono y dilo en voz alta.`,
    modelSpoken: syl,
  });
};

A.sayWord = word => speakActivity({
  kind: 'word', target: word.w,
  display: `<div class="say-word">
      <span class="emoji">${word.e}</span>
      <button class="read-word font-letters" data-say="${U.esc(word.w)}">${U.esc(fmtText(word.w))}</button>
    </div>`,
  promptText: 'Lee la palabra en voz alta',
  promptSpoken: 'Lee la palabra en voz alta. Toca el micrófono y dila.',
  modelSpoken: word.s.join(', ') + '. ' + word.w,
});

/* ====================== Juegos de conciencia fonológica y lectura ====================== */

/* 8. ¿Con qué empieza? Se oye la palabra y se ve el dibujo (no se lee); se elige la letra inicial. */
A.initialSound = (letters, rounds) => async (root, api) => {
  let hits = 0;
  const bank = DATA.initialWords().filter(x => letters.includes(x.l));
  const used = new Set();
  for (let r = 0; r < rounds; r++) {
    if (!api.alive()) return { hits, total: rounds };
    const candidates = bank.filter(x => !used.has(x.w));
    const item = U.pick(candidates.length ? candidates : bank);
    used.add(item.w);
    const distractors = U.shuffle(letters.filter(l => l !== item.l)).slice(0, 2);
    const options = U.shuffle([item.l, ...distractors]);
    const spoken = `${item.w}. ¿Con qué letra empieza ${item.w}?`;
    root.innerHTML = `
      ${promptHTML('¿Con qué letra empieza?')}
      <div class="round-count">${r + 1} / ${rounds}</div>
      <button class="word-target big-emoji" id="pic" aria-label="${U.esc(item.w)}"><span class="emoji">${item.e}</span></button>
      <div class="cards" id="cards">${options.map(o => `<button class="card font-letters" data-v="${o}">${U.esc(fmtLetter(o))}</button>`).join('')}</div>`;
    root.querySelector('#sp').onclick = () => api.say(spoken);
    root.querySelector('#pic').onclick = () => { api.sfx('tap'); api.say(item.w); };
    api.say(spoken);
    const cards = [...root.querySelectorAll('.card')];
    let wrong = 0, first = true, done = false;
    const ok = await new Promise(resolve => {
      cards.forEach(card => card.onclick = async () => {
        if (done) return;
        if (card.dataset.v === item.l) {
          done = true; card.classList.add('correct'); api.sfx('ok');
          await api.praise(`${item.w} empieza por ${letterName(item.l)}. ${U.pick(DATA.PRAISES)}`);
          resolve(first);
        } else {
          first = false; wrong++; api.sfx('no');
          card.classList.add('wrong'); setTimeout(() => card.classList.remove('wrong'), 700);
          api.say(`${letterName(card.dataset.v)}, no. Escucha el principio: ${item.w}.`);
          if (wrong >= 2) cards.find(c => c.dataset.v === item.l).classList.add('hint');
        }
      });
    });
    if (ok) hits++;
    await U.wait(400);
  }
  return { hits, total: rounds };
};

/* 9. Palmadas: contar las sílabas de una palabra oída. */
A.clapSyllables = (rounds) => async (root, api) => {
  let hits = 0;
  const bank = DATA.syllableCountWords();
  const used = new Set();
  for (let r = 0; r < rounds; r++) {
    if (!api.alive()) return { hits, total: rounds };
    const wantN = [1, 2, 3, 2, 4, 1, 3][r % 7];
    const pool = bank.filter(x => x.n === wantN && !used.has(x.w));
    const item = U.pick(pool.length ? pool : bank);
    used.add(item.w);
    const spoken = `${item.w}. ¿Cuántas palmadas tiene ${item.w}? ${item.s.join(', ')}.`;
    root.innerHTML = `
      ${promptHTML('¿Cuántas palmadas tiene?')}
      <div class="round-count">${r + 1} / ${rounds}</div>
      <button class="word-target big-emoji" id="pic" aria-label="${U.esc(item.w)}"><span class="emoji">${item.e}</span></button>
      <div class="syl-reveal font-letters" id="reveal"></div>
      <div class="claps" id="claps">${[1, 2, 3, 4].map(n => `<button class="clap" data-n="${n}" aria-label="${n}">${'👏'.repeat(n)}<b>${n}</b></button>`).join('')}</div>`;
    root.querySelector('#sp').onclick = () => api.say(spoken);
    root.querySelector('#pic').onclick = () => { api.sfx('tap'); api.say(item.s.join('. ')); };
    api.say(spoken);
    const claps = [...root.querySelectorAll('.clap')];
    const reveal = root.querySelector('#reveal');
    let first = true, done = false;
    const ok = await new Promise(resolve => {
      claps.forEach(b => b.onclick = async () => {
        if (done) return;
        const n = +b.dataset.n;
        if (n === item.n) {
          done = true; b.classList.add('correct'); api.sfx('ok');
          reveal.innerHTML = item.s.map(x => `<span class="syl-chip">${U.esc(fmtText(x))}</span>`).join('');
          await api.praise(`${item.s.join(', ')}. ${item.n === 1 ? 'Una palmada' : item.n + ' palmadas'}. ${U.pick(DATA.PRAISES)}`);
          resolve(first);
        } else {
          first = false; api.sfx('no');
          b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 700);
          api.say(`Vamos a dar palmadas juntos: ${item.s.join('. ')}.`);
        }
      });
    });
    if (ok) hits++;
    await U.wait(500);
  }
  return { hits, total: rounds };
};

/* 10. Parejas: memoria con mayúscula y minúscula de la misma letra. */
A.memory = (letters) => async (root, api) => {
  const chosen = U.shuffle(letters).slice(0, 4);
  const cards = U.shuffle(chosen.flatMap(l => [{ l, face: l.toUpperCase() }, { l, face: l }]));
  root.innerHTML = `
    ${promptHTML('Busca las parejas: mayúscula y minúscula')}
    <div class="memory" id="mem">${cards.map((c, i) => `<button class="mcard" data-i="${i}" data-l="${c.l}" aria-label="Carta"><span class="mcard-back">?</span><span class="mcard-face font-letters">${U.esc(c.face)}</span></button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say('Busca las parejas. Cada letra grande tiene su letra pequeña.');
  api.say('Busca las parejas. Toca dos cartas: la letra grande y su letra pequeña.');
  const els = [...root.querySelectorAll('.mcard')];
  let open = [], lock = false, found = 0, misses = 0;
  await new Promise(resolve => {
    els.forEach(el => el.onclick = async () => {
      if (lock || el.classList.contains('open') || el.classList.contains('matched')) return;
      api.sfx('tap');
      el.classList.add('open');
      api.say(letterName(el.dataset.l));
      open.push(el);
      if (open.length < 2) return;
      lock = true;
      const [a, b] = open;
      if (a.dataset.l === b.dataset.l) {
        await U.wait(500);
        a.classList.add('matched'); b.classList.add('matched'); api.sfx('ok');
        found++;
        if (found === chosen.length) { await api.praise(); resolve(); }
      } else {
        misses++;
        await U.wait(1100);
        a.classList.remove('open'); b.classList.remove('open'); api.sfx('no');
      }
      open = []; lock = false;
    });
  });
  // Puntúa como "a la primera" si hubo pocos fallos para el número de parejas.
  return { hits: misses <= chosen.length ? 1 : 0, total: 1 };
};

/* 11. Caza letras: tocar todas las letras objetivo en una cuadrícula. */
A.huntLetters = (target, pool, rounds) => async (root, api) => {
  let hits = 0;
  for (let r = 0; r < rounds; r++) {
    if (!api.alive()) return { hits, total: rounds };
    const count = 3 + (r % 2);
    const others = pool.filter(l => l !== target);
    const grid = U.shuffle([...Array(count).fill(target), ...Array.from({ length: 12 - count }, () => U.pick(others))]);
    const spoken = `Busca todas las letras ${letterName(target)}. Hay ${count}.`;
    root.innerHTML = `
      ${promptHTML(`Caza todas las <b>${U.esc(letterName(target))}</b>`)}
      <div class="round-count" id="left">Quedan ${count}</div>
      <div class="hunt" id="hunt">${grid.map((l, i) => `<button class="hcell font-letters" data-v="${l}" data-i="${i}">${U.esc(fmtLetter(l))}</button>`).join('')}</div>`;
    root.querySelector('#sp').onclick = () => api.say(spoken);
    api.say(spoken);
    const cells = [...root.querySelectorAll('.hcell')];
    const left = root.querySelector('#left');
    let remaining = count, wrong = 0, done = false;
    await new Promise(resolve => {
      cells.forEach(c => c.onclick = async () => {
        if (done || c.classList.contains('found')) return;
        if (c.dataset.v === target) {
          c.classList.add('found'); api.sfx('pop'); remaining--;
          left.textContent = remaining ? `Quedan ${remaining}` : '¡Todas!';
          if (!remaining) { done = true; api.sfx('ok'); await api.praise(); resolve(); }
        } else {
          wrong++; api.sfx('no');
          c.classList.add('wrong'); setTimeout(() => c.classList.remove('wrong'), 600);
          api.say(`Esa es la ${letterName(c.dataset.v)}. Busca la ${letterName(target)}.`);
        }
      });
    });
    if (wrong === 0) hits++;
    await U.wait(400);
  }
  return { hits, total: rounds };
};

/* 12. Sílaba perdida: la palabra con un hueco y tres sílabas para elegir. */
A.missingSyllable = (word, lessonWords) => async (root, api) => {
  const idx = Math.floor(Math.random() * word.s.length);
  const missing = word.s[idx];
  const others = [...new Set(lessonWords.flatMap(w => w.s).filter(s => s !== missing))];
  const options = U.shuffle([missing, ...U.shuffle(others).slice(0, 2)]);
  const spoken = `${word.w}. Falta una sílaba. ¿Cuál es?`;
  root.innerHTML = `
    ${promptHTML('¿Qué sílaba falta?')}
    <button class="word-target" id="pic" aria-label="${U.esc(word.w)}"><span class="emoji">${word.e}</span></button>
    <div class="slots font-letters" id="slots">${word.s.map((s, i) => i === idx ? '<span class="slot gap"></span>' : `<span class="slot filled">${U.esc(fmtText(s))}</span>`).join('')}</div>
    <div class="tiles" id="tiles">${options.map(s => `<button class="tile font-letters" data-v="${U.esc(s)}">${U.esc(fmtText(s))}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(spoken);
  root.querySelector('#pic').onclick = () => { api.sfx('tap'); api.say(word.w); };
  api.say(spoken);
  const gap = root.querySelector('.slot.gap');
  let first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.tile').forEach(t => t.onclick = async () => {
      if (done) return;
      if (t.dataset.v === missing) {
        done = true; gap.textContent = fmtText(missing); gap.classList.add('correct'); t.classList.add('used'); api.sfx('ok');
        await api.praise(word.s.join(', ') + '. ' + word.w + '. ' + U.pick(DATA.PRAISES));
        resolve(first);
      } else {
        first = false; api.sfx('no');
        t.classList.add('wrong'); setTimeout(() => t.classList.remove('wrong'), 700);
        const tryWord = word.s.map((s, i) => i === idx ? t.dataset.v : s).join('');
        api.say(`Eso diría ${tryWord}. Escucha: ${word.s.join(', ')}.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 13. ¿Cuál es? Se ve el dibujo y se elige la palabra escrita entre tres (lectura). */
A.pickWord = (word, lessonWords) => async (root, api) => {
  const others = U.shuffle(lessonWords.filter(w => w.w !== word.w)).slice(0, 2);
  const options = U.shuffle([word, ...others]);
  const spoken = `${word.w}. ¿Dónde pone ${word.w}?`;
  root.innerHTML = `
    ${promptHTML('¿Dónde pone la palabra?')}
    <button class="word-target" id="pic" aria-label="${U.esc(word.w)}"><span class="emoji">${word.e}</span></button>
    <div class="cards words" id="cards">${options.map(o => `<button class="card word-card font-letters" data-v="${U.esc(o.w)}">${U.esc(fmtText(o.w))}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(spoken);
  root.querySelector('#pic').onclick = () => { api.sfx('tap'); api.say(word.w); };
  api.say(spoken);
  let first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.card').forEach(card => card.onclick = async () => {
      if (done) return;
      if (card.dataset.v === word.w) {
        done = true; card.classList.add('correct'); api.sfx('ok');
        await api.praise();
        resolve(first);
      } else {
        first = false; api.sfx('no');
        card.classList.add('wrong'); setTimeout(() => card.classList.remove('wrong'), 700);
        const o = DATA.wordByText[card.dataset.v];
        api.say(`Ahí pone ${o.w}: ${o.s.join(', ')}. Busca ${word.w}: ${word.s.join(', ')}.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 14. Dictado: se oye la palabra y se escribe letra a letra con fichas. */
A.dictation = (word) => async (root, api) => {
  const letters = [...word.w.normalize('NFD').replace(/[̀-ͯ]/g, '')];
  const extra = U.shuffle(['a', 'e', 'i', 'o', 'u', 'm', 'p', 's', 'l', 't', 'n', 'd'].filter(l => !letters.includes(l))).slice(0, 2);
  const tiles = U.shuffle([...letters, ...extra]);
  const spoken = `Dictado: ${word.w}. ${word.s.join(', ')}. Escribe ${word.w} con las letras.`;
  root.innerHTML = `
    ${promptHTML('Escribe la palabra que oyes')}
    <button class="word-target" id="pic" aria-label="${U.esc(word.w)}"><span class="emoji">${word.e}</span></button>
    <div class="slots letters font-letters" id="slots">${letters.map(() => '<span class="slot small"></span>').join('')}</div>
    <div class="tiles" id="tiles">${tiles.map((l, i) => `<button class="tile small font-letters" data-v="${l}" data-i="${i}">${U.esc(fmtText(l))}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(spoken);
  root.querySelector('#pic').onclick = () => { api.sfx('tap'); api.say(word.s.join('. ')); };
  api.say(spoken);
  const slots = [...root.querySelectorAll('.slot')];
  let pos = 0, first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.tile').forEach(t => t.onclick = async () => {
      if (done || t.disabled) return;
      if (t.dataset.v === letters[pos]) {
        api.sfx('pop'); t.disabled = true; t.classList.add('used');
        slots[pos].textContent = fmtText(t.dataset.v); slots[pos].classList.add('filled'); pos++;
        if (pos === letters.length) {
          done = true; slots.forEach(s => s.classList.add('correct')); api.sfx('ok');
          await api.praise(`${word.w}. ${U.pick(DATA.PRAISES)}`);
          resolve(first);
        } else api.say(letterName(t.dataset.v));
      } else {
        first = false; api.sfx('no');
        t.classList.add('wrong'); setTimeout(() => t.classList.remove('wrong'), 700);
        const sylIdx = (() => { let n = 0; for (let i = 0; i < word.s.length; i++) { n += word.s[i].length; if (pos < n) return i; } return word.s.length - 1; })();
        api.say(`Escucha: ${word.s[sylIdx]}. ${word.s.join(', ')}.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* Lecciones del mundo de juegos: se adaptan a las letras ya trabajadas. */
function buildGameSteps(lesson) {
  const known = Progress.knownLetters();
  const single = known.filter(l => l.length === 1 && l !== 'h');
  const cons = Progress.knownConsonants();
  const tier = cons.every(c => DATA.CONSONANTS.indexOf(c) < 7) ? 1 : cons.some(c => c.length > 1) ? 3 : 2;
  const words = DATA.WORDS.filter(w => w.tier <= tier);
  const pickWords = n => U.shuffle(words).slice(0, n);
  // Sonido inicial: vocales y consonantes continuas (m, s, l, f, n) antes que las oclusivas (Herrera y Defior 2005).
  const initialPool = [...DATA.VOWELS, ...single.filter(l => DATA.CONTINUOUS.includes(l)), ...single.filter(l => !DATA.VOWELS.includes(l) && !DATA.CONTINUOUS.includes(l))].slice(0, 8);
  switch (lesson.game) {
    case 'initial': return [{ name: '¿Con qué empieza?', run: A.initialSound(initialPool, 6) }];
    case 'clap': return [{ name: 'Palmadas', run: A.clapSyllables(6) }];
    case 'memory': return [{ name: 'Parejas', run: A.memory(single) }, { name: 'Parejas', run: A.memory(single) }];
    case 'hunt': return U.shuffle(single).slice(0, 3).map(l => ({ name: 'Caza letras', run: A.huntLetters(l, single, 1) }));
    case 'review': {
      // Repaso espaciado: las letras completadas hace más tiempo vuelven a salir.
      const due = Progress.dueForReview(3).map(id => id.replace(/^[vc]-/, '')).filter(l => DATA.LETTERS[l]);
      if (!due.length) return [{ name: 'Repaso', run: A.pickLetter('a', DATA.VOWELS, 3) }];
      return due.flatMap(l => DATA.VOWELS.includes(l)
        ? [{ name: 'Repaso', run: A.pickLetter(l, DATA.VOWELS, 2) }, { name: 'Escribe', run: A.trace(fmtText(l) === l.toUpperCase() ? l.toUpperCase() : l, { guide: false, spoken: letterName(l) }) }]
        : [{ name: 'Repaso', run: A.pickSyllable(DATA.syllablesFor(l), [...DATA.syllablesFor(l), ...DATA.syllablesFor(U.pick(cons))], 2) }, { name: 'Forma', run: A.buildSyllable([l], 1) }]);
    }
    case 'missing': return pickWords(5).map(w => ({ name: 'Sílaba perdida', run: A.missingSyllable(w, words) }));
    case 'which': return pickWords(5).map(w => ({ name: '¿Cuál es?', run: A.pickWord(w, words) }));
    case 'dictation': return pickWords(4).map(w => ({ name: 'Dictado', run: A.dictation(w) }));
  }
  return [];
}

/* ====================== Sílabas 2, frases y cuentos ====================== */

/* 15. Forma la unidad (sílaba inversa o trabada) tocando sus letras en orden. */
A.buildUnit = (unit) => async (root, api) => {
  const letters = [...unit];
  const extra = U.shuffle([...DATA.VOWELS, 'm', 'p', 's', 'l', 't', 'n', 'r', 'b'].filter(l => !letters.includes(l))).slice(0, 2);
  const tiles = U.shuffle([...letters, ...extra]);
  const spoken = `Forma: ${unit}. ${letters.map(letterName).join(', ')}.`;
  root.innerHTML = `
    ${promptHTML('Forma la sílaba que oyes, letra a letra')}
    <div class="slots letters font-letters" id="slots">${letters.map(() => '<span class="slot small"></span>').join('')}</div>
    <div class="tiles" id="tiles">${tiles.map((l, i) => `<button class="tile small font-letters ${DATA.VOWELS.includes(l) ? 'vow' : 'cons'}" data-v="${l}" data-i="${i}">${U.esc(fmtText(l))}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(spoken);
  api.say(spoken);
  const slots = [...root.querySelectorAll('.slot')];
  let pos = 0, first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.tile').forEach(t => t.onclick = async () => {
      if (done || t.disabled) return;
      if (t.dataset.v === letters[pos]) {
        api.sfx('pop'); t.disabled = true; t.classList.add('used');
        slots[pos].textContent = fmtText(t.dataset.v); slots[pos].classList.add('filled'); pos++;
        if (pos === letters.length) {
          done = true; slots.forEach(s => s.classList.add('correct')); api.sfx('ok');
          await api.praise(`${unit}. Has puesto ${letters.map(letterName).join(', ')}, en orden.`);
          resolve(first);
        } else api.say(letterName(t.dataset.v));
      } else {
        first = false; api.sfx('no'); api.miss(unit);
        t.classList.add('wrong'); setTimeout(() => t.classList.remove('wrong'), 700);
        api.say(`Escucha: ${unit}. Ahora toca la ${letterName(letters[pos])}.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 16. Dilo tú con una unidad de dos o tres letras. */
A.sayUnit = (unit) => {
  const letters = [...unit];
  const names = letters.map(letterName);
  return speakActivity({
    kind: 'syllable', target: unit,
    display: `<div class="equation font-letters">
        ${letters.map((l, i) => `<span class="eq-letter ${DATA.VOWELS.includes(l) ? 'vow' : 'cons'}">${U.esc(fmtText(l))}</span>${i < letters.length - 1 ? '<span class="eq-op">+</span>' : ''}`).join('')}
        <span class="eq-op">=</span><button class="eq-result" data-say="${U.esc(unit)}" aria-label="Oír ${U.esc(unit)}">?</button>
      </div>`,
    promptText: `¿${names.slice(0, -1).map(n => `la <b>${U.esc(n)}</b>`).join(', ')} con la <b>${U.esc(names[names.length - 1])}</b>? Dilo en voz alta`,
    promptSpoken: `¿${names.slice(0, -1).map(n => 'la ' + n).join(', ')} con la ${names[names.length - 1]}? ¿Qué dice? Toca el micrófono y dilo.`,
    modelSpoken: unit,
  });
};

/* 17. Lee la frase y toca la escena. Cada palabra se puede tocar para oírla (cuenta como ayuda). */
A.readSentence = (sentence, pool) => async (root, api) => {
  const others = U.shuffle(pool.filter(x => x.t !== sentence.t && x.e[0] !== sentence.e[0] && x.e.slice(-2) !== sentence.e.slice(-2))).slice(0, 2);
  const options = U.shuffle([sentence, ...others]);
  root.innerHTML = `
    ${promptHTML('Lee la frase y toca su dibujo')}
    <div class="sentence font-letters" id="sentence">${sentence.words.map((w, i) => `<button class="sword" data-i="${i}">${U.esc(fmtText(w))}</button>`).join(' ')}<span class="dot">.</span></div>
    <div class="cards scenes" id="cards">${options.map(o => `<button class="card scene" data-v="${U.esc(o.t)}" aria-label="${U.esc(o.t)}">${o.e}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say('Lee la frase y toca su dibujo.');
  api.say('Lee la frase. Si una palabra cuesta, tócala para oírla. Luego toca el dibujo.');
  let first = true, done = false;
  root.querySelectorAll('.sword').forEach(b => b.onclick = () => { api.sfx('tap'); api.say(sentence.words[+b.dataset.i]); });
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.card').forEach(card => card.onclick = async () => {
      if (done) return;
      if (card.dataset.v === sentence.t) {
        done = true; card.classList.add('correct'); api.sfx('ok');
        await api.praise(`Has leído: ${sentence.t}`);
        resolve(first);
      } else {
        first = false; api.sfx('no');
        card.classList.add('wrong', 'dim'); setTimeout(() => card.classList.remove('wrong'), 700);
        api.say(`Escucha la frase: ${sentence.t} Busca ese dibujo.`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 18. Ordena la frase: se oye y se ve la escena; se tocan las palabras en orden. */
A.orderSentence = (sentence) => async (root, api) => {
  const tiles = U.shuffle(sentence.words.map((w, i) => ({ w, i })));
  const spoken = `Escucha: ${sentence.t} Ordena las palabras.`;
  root.innerHTML = `
    ${promptHTML('Ordena las palabras de la frase')}
    <button class="word-target" id="pic" aria-label="${U.esc(sentence.t)}"><span class="emoji">${sentence.e}</span></button>
    <div class="slots words font-letters" id="slots">${sentence.words.map(() => '<span class="slot word"></span>').join('')}</div>
    <div class="tiles" id="tiles">${tiles.map(t => `<button class="tile word font-letters" data-i="${t.i}">${U.esc(fmtText(t.w))}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(spoken);
  root.querySelector('#pic').onclick = () => { api.sfx('tap'); api.say(sentence.t); };
  api.say(spoken);
  const slots = [...root.querySelectorAll('.slot')];
  let pos = 0, first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.tile').forEach(t => t.onclick = async () => {
      if (done || t.disabled) return;
      const i = +t.dataset.i;
      if (i === pos) {
        api.sfx('pop'); t.disabled = true; t.classList.add('used');
        slots[pos].textContent = fmtText(sentence.words[i]); slots[pos].classList.add('filled'); pos++;
        if (pos === sentence.words.length) {
          done = true; slots.forEach(s => s.classList.add('correct')); api.sfx('ok');
          await api.praise(`${sentence.t} Has ordenado la frase entera.`);
          resolve(first);
        } else api.say(sentence.words[i]);
      } else {
        first = false; api.sfx('no');
        t.classList.add('wrong'); setTimeout(() => t.classList.remove('wrong'), 700);
        api.say(`Escucha otra vez: ${sentence.t} ¿Qué palabra va ahora?`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};

/* 19. Lee la frase en voz alta (micrófono). */
A.saySentence = (sentence) => speakActivity({
  kind: 'sentence', target: sentence.t,
  display: `<div class="say-word"><span class="emoji">${sentence.e}</span><button class="read-word sentence-read font-letters" data-say="${U.esc(sentence.t)}">${U.esc(fmtText(sentence.t))}</button></div>`,
  promptText: 'Lee la frase en voz alta',
  promptSpoken: 'Lee la frase en voz alta. Toca el micrófono y léela.',
  modelSpoken: sentence.t,
});

/* 20. Mini-cuento: cada frase con su escena, lectura con resaltado palabra a palabra, y una pregunta. */
A.story = (story) => async (root, api) => {
  let line = 0;
  const renderLine = () => {
    const l = story.lines[line];
    root.innerHTML = `
      ${promptHTML(`<b>${U.esc(story.title)}</b> · ${line + 1} de ${story.lines.length}`)}
      <div class="story">
        <div class="scene-big"><span class="emoji">${l.e}</span></div>
        <div class="sentence font-letters" id="sentence">${l.words.map((w, i) => `<button class="sword" data-i="${i}">${U.esc(fmtText(w))}</button>`).join(' ')}<span class="dot">.</span></div>
        <div class="actions">
          <button class="btn nav" id="read" data-say="Oír la frase">${ico('speaker')}Oír</button>
          <button class="btn go big" id="next" data-say="${line < story.lines.length - 1 ? 'Pasar página' : 'La pregunta'}">${line < story.lines.length - 1 ? 'Pasar página' : 'Pregunta'}${ico(line < story.lines.length - 1 ? 'next' : 'question')}</button>
        </div>
      </div>`;
    const words = [...root.querySelectorAll('.sword')];
    words.forEach(b => b.onclick = () => { api.sfx('tap'); api.say(l.words[+b.dataset.i]); });
    // Lectura con resaltado: por tiempo proporcional a la longitud de cada palabra (los eventos de
    // límite de palabra de la voz no son fiables en móvil).
    const readAloud = async () => {
      const total = l.words.reduce((a, w) => a + w.length + 1, 0);
      const est = 350 + total * 95 / Settings.get().rate;
      api.say(l.t);
      let t = 0;
      for (let i = 0; i < words.length; i++) {
        const dur = (l.words[i].length + 1) / total * est;
        setTimeout(() => { words.forEach(w => w.classList.remove('lit')); words[i].classList.add('lit'); }, t);
        t += dur;
      }
      setTimeout(() => words.forEach(w => w.classList.remove('lit')), t + 300);
    };
    root.querySelector('#sp').onclick = readAloud;
    root.querySelector('#read').onclick = readAloud;
    api.say(line === 0 ? `${story.title}. Lee la frase. Si quieres, toca "oír" para escucharla.` : 'Lee la frase.');
  };
  for (line = 0; line < story.lines.length; line++) {
    if (!api.alive()) return { hits: 0, total: 1 };
    renderLine();
    await api.waitClick(root.querySelector('#next'));
  }
  // Pregunta de comprensión
  const q = story.q;
  const options = U.shuffle(q.options);
  root.innerHTML = `
    ${promptHTML(U.esc(q.t))}
    <div class="cards" id="cards">${options.map(o => `<button class="card emoji-card" data-v="${o}">${o}</button>`).join('')}</div>`;
  root.querySelector('#sp').onclick = () => api.say(q.t);
  api.say(q.t);
  let first = true, done = false;
  const ok = await new Promise(resolve => {
    root.querySelectorAll('.card').forEach(card => card.onclick = async () => {
      if (done) return;
      if (card.dataset.v === q.ok) {
        done = true; card.classList.add('correct'); api.sfx('ok');
        await api.praise('Has entendido el cuento.');
        resolve(first);
      } else {
        first = false; api.sfx('no');
        card.classList.add('wrong', 'dim'); setTimeout(() => card.classList.remove('wrong'), 700);
        api.say(`Piensa en el cuento: ${story.lines.map(x => x.t).join(' ')} ${q.t}`);
      }
    });
  });
  return { hits: ok ? 1 : 0, total: 1 };
};
