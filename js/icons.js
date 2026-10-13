'use strict';
/* Iconos propios (SVG en línea), iguales en todos los dispositivos. Trazo redondeado, sin relleno. */
const ICONS = (() => {
  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const P = d => `<path d="${d}"/>`;
  const I = {
    next: svg(P('M4 12h13') + P('M12 6l6 6-6 6')),
    back: svg(P('M20 12H7') + P('M12 6l-6 6 6 6')),
    check: svg(P('M4 12.5l5 5L20 6.5')),
    eraser: svg(P('M4 16.5l9-9 5 5-5.5 5.5H8z') + P('M14.5 4.5l5 5')),
    bulb: svg(P('M9 18h6') + P('M10 21h4') + P('M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z')),
    speaker: svg(P('M4 9v6h4l5 4V5L8 9H4z') + P('M16 8.5a5 5 0 0 1 0 7') + P('M19 5.5a9 9 0 0 1 0 13')),
    home: svg(P('M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')),
    replay: svg(P('M3.5 12a8.5 8.5 0 1 0 2.8-6.3') + P('M3 4v5h5')),
    list: svg(P('M8 6h13M8 12h13M8 18h13') + P('M3.5 6h.01M3.5 12h.01M3.5 18h.01')),
    mic: svg(P('M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z') + P('M5 11a7 7 0 0 0 14 0') + P('M12 18v3')),
    eye: svg(P('M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z') + '<circle cx="12" cy="12" r="3"/>'),
    thumb: svg(P('M7 11v10H3V11h4z') + P('M7 11l4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.2l-1.3 7.2a2 2 0 0 1-2 1.6H7')),
    gear: svg('<circle cx="12" cy="12" r="3.5"/>' + P('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1')),
    book: svg(P('M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z') + P('M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z')),
    question: svg(P('M9 9.5a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.4-1.5 2.4') + P('M12 18.5h.01')),
    moon: svg(P('M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z')),
    trophy: svg(P('M8 21h8M12 17v4') + P('M7 4h10v5a5 5 0 0 1-10 0z') + P('M7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3')),
    play: svg(P('M7 5l12 7-12 7z')),
  };
  return { get: n => `<span class="ico">${I[n] || ''}</span>`, raw: n => I[n] || '' };
})();
const ico = n => ICONS.get(n);
