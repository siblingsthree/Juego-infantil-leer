'use strict';
/* Doble toque con voz. Cualquier botón con data-say="…" funciona así:
   primer toque: lo dice en voz alta y se queda "armado" (anillo amarillo);
   segundo toque, antes de 4 segundos: ejecuta la acción.
   Las respuestas de los ejercicios (tarjetas, fichas) no llevan data-say: son de un toque,
   porque si dijeran su letra al tocarlas la niña no tendría que leer. */
const TwoTap = (() => {
  let armed = null, timer = 0;
  function disarm() {
    if (armed) armed.classList.remove('armed');
    armed = null; clearTimeout(timer);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-say]');
    if (!el || el.disabled || !Settings.get().twoTap) return;
    if (el.closest('#modal')) return; // los ajustes son para adultos
    if (armed === el) { disarm(); return; } // segundo toque: la acción sigue su curso
    e.preventDefault(); e.stopPropagation();
    disarm();
    armed = el; el.classList.add('armed');
    Sfx.play('tap');
    Voice.say(`${el.dataset.say}. Toca otra vez.`);
    timer = setTimeout(disarm, 4000);
  }, true);
  // Si cambia la pantalla, nada queda armado.
  new MutationObserver(() => { if (armed && !armed.isConnected) disarm(); }).observe(document.body, { childList: true, subtree: true });
  return { disarm };
})();
