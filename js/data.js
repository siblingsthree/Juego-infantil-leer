'use strict';
/* Contenido pedagógico: letras, sílabas, palabras y la estructura de mundos/lecciones.
   Orden de consonantes según el método silábico habitual en español:
   primero las de trazo y sonido más sencillos (m, p, s, l, t, n, d). */
const DATA = (() => {
  const VOWELS = ['a', 'e', 'i', 'o', 'u'];
  const CONSONANTS = ['m', 'p', 's', 'l', 't', 'n', 'd', 'f', 'r', 'b', 'c', 'g', 'v', 'z', 'ñ', 'j', 'y', 'h'];

  // name: cómo se dice el nombre de la letra. word/emoji: ejemplo para presentarla.
  // vowels: restringe las sílabas que se forman (za zo zu; nunca "ze", "zi").
  const LETTERS = {
    a: { name: 'a', word: 'avión', emoji: '✈️' },
    e: { name: 'e', word: 'elefante', emoji: '🐘' },
    i: { name: 'i', word: 'isla', emoji: '🏝️' },
    o: { name: 'o', word: 'oso', emoji: '🐻' },
    u: { name: 'u', word: 'uva', emoji: '🍇' },
    m: { name: 'eme', word: 'mono', emoji: '🐒' },
    p: { name: 'pe', word: 'pato', emoji: '🦆' },
    s: { name: 'ese', word: 'sapo', emoji: '🐸' },
    l: { name: 'ele', word: 'luna', emoji: '🌙' },
    t: { name: 'te', word: 'tomate', emoji: '🍅' },
    n: { name: 'ene', word: 'nube', emoji: '☁️' },
    d: { name: 'de', word: 'dado', emoji: '🎲' },
    f: { name: 'efe', word: 'foca', emoji: '🦭' },
    r: { name: 'erre', word: 'ratón', emoji: '🐭' },
    b: { name: 'be', word: 'bebé', emoji: '👶' },
    c: { name: 'ce', word: 'casa', emoji: '🏠' },
    g: { name: 'ge', word: 'gato', emoji: '🐱' },
    v: { name: 'uve', word: 'vaca', emoji: '🐄' },
    z: { name: 'zeta', word: 'zapato', emoji: '👟', vowels: ['a', 'o', 'u'] },
    'ñ': { name: 'eñe', word: 'piña', emoji: '🍍' },
    j: { name: 'jota', word: 'jirafa', emoji: '🦒' },
    y: { name: 'ye', word: 'yoyó', emoji: '🪀' },
    h: { name: 'hache', word: 'hoja', emoji: '🍃' },
  };

  // Palabras decodificables con sílabas directas (consonante + vocal) o vocal sola.
  // tier 1: solo consonantes m p s l t n d.  tier 2: el resto.
  const W = (w, s, e, tier) => ({ w, s, e, tier });
  const WORDS = [
    W('mamá', ['ma', 'má'], '👩', 1), W('papá', ['pa', 'pá'], '👨', 1),
    W('mano', ['ma', 'no'], '✋', 1), W('pato', ['pa', 'to'], '🦆', 1),
    W('luna', ['lu', 'na'], '🌙', 1), W('sopa', ['so', 'pa'], '🍲', 1),
    W('mapa', ['ma', 'pa'], '🗺️', 1), W('moto', ['mo', 'to'], '🛵', 1),
    W('dedo', ['de', 'do'], '👆', 1), W('sapo', ['sa', 'po'], '🐸', 1),
    W('pino', ['pi', 'no'], '🌲', 1), W('dado', ['da', 'do'], '🎲', 1),
    W('lupa', ['lu', 'pa'], '🔍', 1), W('tele', ['te', 'le'], '📺', 1),
    W('oso', ['o', 'so'], '🐻', 1), W('mono', ['mo', 'no'], '🐒', 1),
    W('lata', ['la', 'ta'], '🥫', 1), W('lana', ['la', 'na'], '🧶', 1),
    W('nota', ['no', 'ta'], '🎵', 1), W('seta', ['se', 'ta'], '🍄', 1),
    W('ola', ['o', 'la'], '🌊', 1), W('paloma', ['pa', 'lo', 'ma'], '🕊️', 1),
    W('pelota', ['pe', 'lo', 'ta'], '⚽', 1), W('tomate', ['to', 'ma', 'te'], '🍅', 1),
    W('paleta', ['pa', 'le', 'ta'], '🍭', 1), W('patata', ['pa', 'ta', 'ta'], '🥔', 1),
    W('pepino', ['pe', 'pi', 'no'], '🥒', 1), W('maleta', ['ma', 'le', 'ta'], '🧳', 1),
    W('casa', ['ca', 'sa'], '🏠', 2), W('gato', ['ga', 'to'], '🐱', 2),
    W('rana', ['ra', 'na'], '🐸', 2), W('bebé', ['be', 'bé'], '👶', 2),
    W('vaca', ['va', 'ca'], '🐄', 2), W('nube', ['nu', 'be'], '☁️', 2),
    W('boca', ['bo', 'ca'], '👄', 2), W('cama', ['ca', 'ma'], '🛏️', 2),
    W('piña', ['pi', 'ña'], '🍍', 2), W('vela', ['ve', 'la'], '🕯️', 2),
    W('bota', ['bo', 'ta'], '👢', 2), W('hoja', ['ho', 'ja'], '🍃', 2),
    W('rosa', ['ro', 'sa'], '🌹', 2), W('pera', ['pe', 'ra'], '🍐', 2),
    W('foca', ['fo', 'ca'], '🦭', 2), W('café', ['ca', 'fé'], '☕', 2),
    W('uva', ['u', 'va'], '🍇', 2), W('bici', ['bi', 'ci'], '🚲', 2),
    W('coco', ['co', 'co'], '🥥', 2), W('pavo', ['pa', 'vo'], '🦃', 2),
    W('hada', ['ha', 'da'], '🧚', 2), W('búho', ['bú', 'ho'], '🦉', 2),
    W('yoyó', ['yo', 'yó'], '🪀', 2),
    W('zapato', ['za', 'pa', 'to'], '👟', 2), W('jirafa', ['ji', 'ra', 'fa'], '🦒', 2),
    W('cereza', ['ce', 're', 'za'], '🍒', 2), W('camisa', ['ca', 'mi', 'sa'], '👕', 2),
    W('cohete', ['co', 'he', 'te'], '🚀', 2), W('banana', ['ba', 'na', 'na'], '🍌', 2),
    W('abeja', ['a', 'be', 'ja'], '🐝', 2), W('araña', ['a', 'ra', 'ña'], '🕷️', 2),
    W('helado', ['he', 'la', 'do'], '🍦', 2), W('oveja', ['o', 've', 'ja'], '🐑', 2),
    W('gorila', ['go', 'ri', 'la'], '🦍', 2), W('conejo', ['co', 'ne', 'jo'], '🐰', 2),
    W('corona', ['co', 'ro', 'na'], '👑', 2), W('regalo', ['re', 'ga', 'lo'], '🎁', 2),
    W('cometa', ['co', 'me', 'ta'], '🪁', 2), W('música', ['mú', 'si', 'ca'], '🎶', 2),
    W('mariposa', ['ma', 'ri', 'po', 'sa'], '🦋', 2), W('teléfono', ['te', 'lé', 'fo', 'no'], '📞', 2),
  ];
  const wordByText = Object.fromEntries(WORDS.map(x => [x.w, x]));
  const pick = (...ws) => ws.map(w => wordByText[w]);

  function syllablesFor(c) {
    const vs = LETTERS[c].vowels || VOWELS;
    return vs.map(v => c + v);
  }

  const WORLDS = [
    {
      id: 'vocales', title: 'Las vocales', emoji: '🌈', color: 'sky',
      hint: 'Escucha, reconoce y traza A, E, I, O, U.',
      lessons: VOWELS.map(v => ({ id: 'v-' + v, title: v.toUpperCase() + ' ' + v, emoji: LETTERS[v].emoji, type: 'vowel', letter: v })),
    },
    {
      id: 'letras', title: 'Las letras', emoji: '🧱', color: 'accent',
      hint: 'Cada consonante con sus sílabas: ma, me, mi, mo, mu…',
      lessons: CONSONANTS.map(c => ({ id: 'c-' + c, title: c.toUpperCase() + ' ' + c, emoji: LETTERS[c].emoji, type: 'consonant', letter: c })),
    },
    {
      id: 'silabas', title: 'Las sílabas', emoji: '🧩', color: 'good',
      hint: 'Mezcla sílabas de varias letras: escucha, forma y escribe.',
      lessons: [
        { id: 's-mp', title: 'M y P', emoji: '🐒', type: 'syllables', consonants: ['m', 'p'] },
        { id: 's-sl', title: 'S y L', emoji: '🌙', type: 'syllables', consonants: ['s', 'l'] },
        { id: 's-tnd', title: 'T, N y D', emoji: '🎲', type: 'syllables', consonants: ['t', 'n', 'd'] },
        { id: 's-mix1', title: 'Mezcla 1', emoji: '🎨', type: 'syllables', consonants: ['m', 'p', 's', 'l', 't', 'n', 'd'] },
        { id: 's-frb', title: 'F, R y B', emoji: '👶', type: 'syllables', consonants: ['f', 'r', 'b'] },
        { id: 's-cgv', title: 'C, G y V', emoji: '🐱', type: 'syllables', consonants: ['c', 'g', 'v'] },
        { id: 's-znj', title: 'Z, Ñ y J', emoji: '🦒', type: 'syllables', consonants: ['z', 'ñ', 'j'] },
        { id: 's-yh', title: 'Y y H', emoji: '🍃', type: 'syllables', consonants: ['y', 'h'] },
        { id: 's-mix2', title: 'Mezcla 2', emoji: '🎪', type: 'syllables', consonants: CONSONANTS },
      ],
    },
    {
      id: 'palabras', title: 'Las palabras', emoji: '📖', color: 'star',
      hint: 'Arma, lee y escribe palabras con las sílabas aprendidas.',
      lessons: [
        { id: 'w-1', title: 'Palabras 1', emoji: '👩', type: 'words', words: pick('mamá', 'papá', 'mano', 'pato', 'luna', 'sopa', 'mapa', 'moto') },
        { id: 'w-2', title: 'Palabras 2', emoji: '🐸', type: 'words', words: pick('dedo', 'sapo', 'pino', 'dado', 'lupa', 'tele', 'oso', 'mono') },
        { id: 'w-3', title: 'Palabras 3', emoji: '🎵', type: 'words', words: pick('lata', 'lana', 'nota', 'seta', 'ola', 'paloma', 'pelota', 'tomate') },
        { id: 'w-4', title: 'Palabras largas', emoji: '⚽', type: 'words', words: pick('paleta', 'patata', 'pepino', 'maleta', 'pelota', 'tomate', 'paloma') },
        { id: 'w-5', title: 'Palabras 5', emoji: '🏠', type: 'words', words: pick('casa', 'gato', 'rana', 'bebé', 'vaca', 'nube', 'boca', 'cama') },
        { id: 'w-6', title: 'Palabras 6', emoji: '🍍', type: 'words', words: pick('piña', 'vela', 'bota', 'hoja', 'rosa', 'pera', 'foca', 'café', 'uva', 'bici', 'coco', 'pavo', 'hada', 'búho', 'yoyó') },
        { id: 'w-7', title: 'Palabras 7', emoji: '🦋', type: 'words', words: pick('zapato', 'jirafa', 'cereza', 'camisa', 'cohete', 'banana', 'abeja', 'araña', 'helado', 'oveja', 'gorila', 'conejo', 'corona', 'regalo', 'cometa', 'música', 'mariposa', 'teléfono') },
      ],
    },
  ];

  const PRAISES = ['¡Muy bien!', '¡Genial!', '¡Lo hiciste!', '¡Bravo!', '¡Fantástico!', '¡Qué bien lo haces!', '¡Eres una campeona!'];
  const RETRY = ['Casi. Inténtalo otra vez.', 'Mmm, no. Prueba de nuevo.', 'Escucha otra vez.'];

  return { VOWELS, CONSONANTS, LETTERS, WORDS, WORLDS, PRAISES, RETRY, syllablesFor, wordByText };
})();
