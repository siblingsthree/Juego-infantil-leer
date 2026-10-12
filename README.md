# Bosque de Letras

Juego web para que una niña de 5 años aprenda a **leer y escribir en español**: vocales, consonantes, sílabas directas (ma, me, mi…) y palabras. Todo con **voz** (la del propio navegador) y **escritura con el dedo** corregida automáticamente.

No necesita instalación ni servidor: es HTML, CSS y JavaScript sin dependencias. Funciona en tablet, móvil y ordenador, y se puede instalar como app (PWA) y usar sin conexión.

## Cómo jugar

- Abre `index.html` con un servidor local (`python3 -m http.server`, luego `http://localhost:8000`) o publícalo en GitHub Pages (ver abajo).
- O abre directamente `dist/bosque-de-letras.html`, que lleva todo en un solo archivo. Se genera con `python3 tools/build-single.py`.
- Recomendado: Chrome, Edge o Safari en iPad. Son los que traen voces en español de calidad.

## Diseño pedagógico

Sigue el **método silábico** habitual en Infantil: sonidos de las letras, luego sílabas directas (consonante + vocal) y por último palabras decodificables solo con lo aprendido.

| Mundo | Qué aprende | Lecciones |
|---|---|---|
| 🌈 Las vocales | A, E, I, O, U | 5 |
| 🧱 Las letras | consonantes en orden de dificultad: m, p, s, l, t, n, d, f, r, b, c, g, v, z, ñ, j, y, h; cada una con sus sílabas | 18 |
| 🧩 Las sílabas | mezclas de sílabas de varias letras | 9 |
| 📖 Las palabras | palabras con dibujo, armadas por sílabas; de 2 a 4 sílabas | 7 |

Cada lección encadena actividades cortas y termina con estrellas y una pegatina para el álbum:

| Actividad | Qué hace la niña | Qué entrena |
|---|---|---|
| Conoce | Ve la letra grande con una palabra y su dibujo; toca para oír | Nombre y sonido |
| Escucha y toca | Oye una letra o sílaba y la elige entre tres | Reconocimiento (lectura) |
| Forma la sílaba | Oye "mo" y toca la consonante y la vocal | Conciencia fonológica |
| Traza | Repasa con el dedo la letra guía sobre pauta escolar | Grafía con apoyo |
| Escribe | Escribe sin guía; hay botón de pista | Grafía sin apoyo |
| Arma la palabra | Ve el dibujo, oye la palabra y ordena sus sílabas | Síntesis silábica |
| Lee | Ve la palabra escrita (sin audio) y toca su dibujo | Lectura real |
| Dilo tú | Ve "P + A = ?", oye "¿la pe con la a?" y lo dice al micrófono | Lectura en voz alta de sílabas |
| Lee en voz alta | Ve la palabra con su dibujo y la lee al micrófono | Lectura en voz alta de palabras |

Detalles que importan a esta edad (4 a 7 años, muchos aún no leen):

- **Doble toque con voz**: los botones de acción y navegación (siguiente, borrar, listo, pista, volver, mundos, lecciones, micrófono) dicen en voz alta qué hacen al primer toque y se quedan marcados con un anillo amarillo y un dedo; el segundo toque, antes de 4 segundos, ejecuta la acción. Las respuestas de los ejercicios (tarjetas de letras, fichas de sílabas, dibujos) son de un solo toque: si dijeran su letra al tocarlas, bastaría con ir probando hasta oír la correcta. Se desactiva en los ajustes para niños que ya leen.
- Botones con icono grande además del texto, de al menos 64 px de alto.

- Las letras se dibujan con la fuente **Andika**, pensada para lectores que empiezan: la "a" y la "g" tienen la forma que se enseña a escribir.
- Por defecto todo va en **mayúsculas**, como en Infantil. En los ajustes se cambia a minúsculas o a ambas.
- Nunca hay castigo: tras dos fallos se ilumina la respuesta, y tras dos trazos fallidos aparece "Siguiente".
- Las lecciones se desbloquean en orden dentro de cada mundo. El "modo libre" de los ajustes abre todas.
- La "z" solo forma za, zo, zu. La "h" se oye muda. La "c" y la "g" se pronuncian como corresponde ante e, i.

## Corrección del trazo

La letra guía se pinta en un lienzo oculto. Al pulsar "Listo" se miden dos cosas:

- **Cobertura**: qué parte de la letra quedó pintada.
- **Precisión**: qué parte de la pintura cae dentro de la letra ampliada con un margen de tolerancia.

Con guía se exige 72 % de cobertura y 55 % de precisión; sin guía, 62 % y 50 %. Los umbrales están en `js/tracing.js` (`evaluate`). Se puede ajustar si resulta demasiado fácil o difícil.

## Voz: síntesis y reconocimiento

**Síntesis (el juego habla)**: Web Speech API, `speechSynthesis`. Usa las voces en español que tenga el dispositivo; en los ajustes se elige voz y velocidad.

**Reconocimiento (el juego escucha)**: Web Speech API, `SpeechRecognition`. Lo usan las actividades "Dilo tú" y "Lee en voz alta".

| Navegador | Habla | Escucha |
|---|---|---|
| Chrome / Edge (Android, Windows, Mac) | sí | sí, con conexión a internet (el audio se procesa en servidores de Google o Microsoft) |
| Safari (iPad, iPhone, Mac) | sí | sí, con Siri y Dictado activados |
| Firefox | sí | no |

Cómo se decide que lo dijo bien (`js/audio.js`, `Listen.matches`):

- Se comparan hasta cinco alternativas que devuelve el reconocedor, sin tildes ni mayúsculas.
- Se igualan pronunciaciones del español: b/v, ll/y, z/s, c/k, ce/se, ge/je, h muda, qu/k.
- Sílabas: vale si lo oído empieza por la sílaba. Un reconocedor adulto suele convertir "pa" en "papá" o "para", y eso cuenta como acierto.
- Palabras: exacta, o con un solo error que no sea la primera letra. "Gato" por "pato" es fallo.

El reconocimiento nunca bloquea: si falla una vez aparece "Ya lo dije" para que un adulto confirme, y a la segunda aparece "Siguiente". Sin micrófono, sin permiso o sin conexión aparece el mismo botón. Un reconocedor de habla adulta entiende mal a un niño de 5 años con una sílaba suelta; la tolerancia está pensada para eso, y "Ya lo dije" no suma estrella.

El micrófono solo funciona en páginas servidas por HTTPS o en `localhost`. En la versión publicada como artefacto de Claude no está disponible; sí en GitHub Pages.

## Ajustes para madres y padres

El engranaje de arriba a la derecha pide una suma sencilla (puerta parental). Dentro:

- Tipo de letra: mayúsculas, minúsculas o ambas.
- Voz y velocidad (las voces las aporta el dispositivo).
- Doble toque con voz (activado por defecto), modo libre y efectos de sonido.
- Reiniciar progreso.

El progreso y los ajustes se guardan en el navegador del dispositivo (localStorage). No hay cuentas ni se envía nada a internet.

## Publicar en GitHub Pages

1. En GitHub: Settings → Pages → Source: **GitHub Actions**.
2. Haz push a `master` (o `main`). El flujo `.github/workflows/pages.yml` publica la web.
3. Abre la URL que aparece en el flujo. Desde el móvil, "Añadir a pantalla de inicio" la instala como app.

## Estructura

```
index.html            pantalla única; todo lo demás se dibuja con JS
css/style.css         estilos, tema claro y oscuro
js/data.js            letras, sílabas, palabras, mundos y lecciones
js/store.js           ajustes y progreso (localStorage)
js/audio.js           voz (Web Speech API) y efectos (WebAudio)
js/tracing.js         lienzo de trazado y corrección
js/confetti.js        celebración
js/twotap.js          doble toque con voz en los botones de acción
js/activities.js      las actividades y la secuencia de cada lección
js/app.js             navegación, lección, resumen, álbum y ajustes
sw.js, manifest.webmanifest, icon.svg   instalación como app y uso sin conexión
tools/build-single.py genera dist/bosque-de-letras.html (un solo archivo)
```

## Limitaciones conocidas y siguientes pasos

- El reconocimiento de voz no funciona sin conexión en Chrome y Edge, ni en Firefox.
- La voz depende del dispositivo. Sin voz en español el juego funciona, pero en silencio. Un siguiente paso natural es grabar audios propios (o generarlos con un servicio de voz) y guardarlos en `audio/`.
- La síntesis de voz dice el **nombre** de la consonante ("eme"), no su sonido aislado. Por eso el juego apoya siempre en las sílabas, que sí suenan bien.
- El trazo se corrige por forma, no por orden de los trazos. Añadir flechas de dirección por letra sería la siguiente mejora de escritura.
- Para añadir palabras: una línea en `js/data.js` con sílabas, emoji y nivel, y añadirla a una lección.

## Licencia

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es): se puede copiar, compartir y adaptar con atribución, **sin uso comercial** y manteniendo la misma licencia. Ver `LICENSE`.
