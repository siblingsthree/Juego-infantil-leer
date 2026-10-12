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
    <div class="actions"><button class="btn primary big" id="next" data-say="Siguiente"><span class="ico">➡️</span>Siguiente</button></div>`;
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
          first = false; api.sfx('no'); api.miss(target);
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
    <div class="actions"><button class="btn ghost" id="help" data-say="Ayuda para leer"><span class="ico">🙋</span>Ayúdame</button></div>`;
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
      <button class="btn ghost" id="clear" data-say="Borrar todo"><span class="ico">🧽</span>Borrar</button>
      ${guide ? '' : '<button class="btn ghost" id="hint" data-say="Pista: ver la letra"><span class="ico">💡</span>Pista</button>'}
      <button class="btn good big" id="done" disabled data-say="Listo: comprobar"><span class="ico">✅</span>Listo</button>
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
        await api.praise(attempts ? U.pick(DATA.PRAISES_RETRY) : `Has seguido la forma de la ${speakText}.`);
        return { hits: attempts === 0 ? 1 : 0, total: 1 };
      }
      if (res.mirrored) {
        // Letra en espejo: normal hasta los 7 años. Se muestra el modelo con su punto de inicio y no cuenta como intento.
        api.say(`Está del revés. Mira el punto verde: ahí empieza. Vuelve a hacerla.`);
        tracer.showHint(4000);
        continue;
      }
      attempts++;
      api.sfx('no');
      if (res.coverage < 0.3) api.say('Falta pintar más. Sigue toda la letra con el dedo.');
      else if (res.precision < 0.5) api.say('Te saliste un poco. Intenta ir por encima de los puntos.');
      else api.say(U.pick(DATA.RETRY));
      tracer.showHint(3500);
      if (attempts >= 2 && !skip) {
        skip = document.createElement('button');
        skip.className = 'btn ghost'; skip.dataset.say = 'Siguiente'; skip.innerHTML = '<span class="ico">➡️</span>Siguiente';
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
        <button class="mic-btn" id="mic" aria-label="Hablar" data-say="Micrófono para hablar"><span class="mic-icon">🎤</span><span class="mic-label">Dilo tú</span></button>
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
      selfBtn.className = 'btn ghost'; selfBtn.dataset.say = 'Ya lo dije'; selfBtn.innerHTML = '<span class="ico">👍</span>Ya lo dije';
      actions.appendChild(selfBtn);
    };
    const addSkip = () => {
      if (skipBtn) return;
      skipBtn = document.createElement('button');
      skipBtn.className = 'btn ghost'; skipBtn.dataset.say = 'Siguiente'; skipBtn.innerHTML = '<span class="ico">➡️</span>Siguiente';
      actions.appendChild(skipBtn);
    };
    if (!Listen.supported) {
      heard.textContent = 'Este navegador no escucha. Dilo en voz alta y toca "Ya lo dije".';
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
        } else if (res.status === 'denied') {
          heard.textContent = 'No tengo permiso para usar el micrófono. Dilo en voz alta y toca "Ya lo dije".';
          api.say('No puedo usar el micrófono. Dilo en voz alta y toca: ya lo dije.');
          addSelf();
        } else if (res.status === 'network') {
          heard.textContent = 'Para escuchar hace falta conexión a internet.';
          addSelf();
        } else {
          attempts++;
          heard.textContent = 'No te he oído. Acércate y dilo más fuerte.';
          api.say(`No te he oído. Dilo más fuerte: ${modelSpoken}.`);
        }
        if (attempts >= 1) addSelf();
        if (attempts >= 2) addSkip();
        if (selfBtn) selfBtn.onclick = () => { if (done) return; done = true; api.sfx('ok'); api.say(modelSpoken); resolve(false); };
        if (skipBtn) skipBtn.onclick = () => { if (done) return; done = true; resolve(false); };
      };
      if (selfBtn) selfBtn.onclick = () => { if (done) return; done = true; api.sfx('ok'); api.say(modelSpoken); resolve(false); };
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
          api.say(`${item.w} empieza por ${letterName(item.l)}.`);
          await api.praise();
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
          api.say(`${item.s.join(', ')}. ${item.n === 1 ? 'Una palmada' : item.n + ' palmadas'}.`);
          await api.praise();
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
        api.say(word.s.join(', ') + '. ' + word.w);
        await api.praise();
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
          await api.say(word.w);
          await api.praise();
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
