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
| 🧱 Las letras | consonantes en orden de dificultad: m, p, s, l, t, n, d, f, r, b, c (ca/co/cu y ce/ci aparte), g (ga/go/gu y ge/gi aparte), v, z, ñ, j, y, h (muda), y las letras dobles qu, ch, ll | 23 |
| 🧩 Las sílabas | mezclas de sílabas de varias letras | 9 |
| 📖 Las palabras | palabras con dibujo, armadas por sílabas; de 2 a 4 sílabas; "Letras dobles" al final | 8 |
| 🔤 Sílabas 2 | sílabas inversas (al, es, un), palabras cerradas (sol, pan, limón) y trabadas (pla, bra, tre) | 7 |
| 📚 Las frases | frases decodificables con escena, ordenar frases, leer en voz alta y seis mini-cuentos con pregunta de comprensión | 9 |
| 🎪 Los juegos | juegos sueltos, siempre abiertos, que usan las letras ya trabajadas, más un repaso espaciado | 8 |

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
| ¿Con qué empieza? | Oye una palabra y ve su dibujo (no la lee); elige la letra inicial | Conciencia fonémica: sonido inicial |
| Palmadas | Oye una palabra y toca cuántas palmadas (sílabas) tiene, de 1 a 4 | Conciencia silábica |
| Parejas | Memoria: empareja mayúscula y minúscula de la misma letra | Reconocimiento de ambas formas |
| Caza letras | Toca todas las letras objetivo en una cuadrícula de 12 | Discriminación visual de letras |
| Sílaba perdida | Palabra con un hueco; elige la sílaba que falta | Lectura y análisis silábico |
| ¿Cuál es? | Ve el dibujo y elige la palabra escrita entre tres | Lectura de palabras |
| Dictado | Oye la palabra y la escribe letra a letra con fichas | Ortografía y segmentación en fonemas |

| Repaso | Las letras completadas hace más tiempo vuelven a salir | Recuperación espaciada |
| Forma la sílaba (letras) | Sílaba inversa o trabada tocando sus letras en orden | Síntesis fonémica |
| Lee la frase | Lee una frase (cada palabra se puede oír al tocarla) y toca su escena | Lectura de frases |
| Ordena | Oye la frase y ordena sus palabras | Sintaxis y memoria de la frase |
| Cuento | Cuatro frases con escena, lectura con resaltado palabra a palabra y una pregunta con tres dibujos | Comprensión lectora |

El mundo 🎪 Los juegos usa las letras que ya tienen estrella (si aún no hay ninguna, m, p y s) y palabras del nivel alcanzado, así que crece con la niña. Varios de estos juegos también aparecen dentro de las lecciones de vocales, consonantes y palabras.

Detalles que importan a esta edad (4 a 7 años, muchos aún no leen):

- **Doble toque con voz**: los botones de acción y navegación (siguiente, borrar, listo, pista, volver, mundos, lecciones, micrófono) dicen en voz alta qué hacen al primer toque y se quedan marcados con un anillo amarillo y un dedo; el segundo toque, antes de 4 segundos, ejecuta la acción. Las respuestas de los ejercicios (tarjetas de letras, fichas de sílabas, dibujos) son de un solo toque: si dijeran su letra al tocarlas, bastaría con ir probando hasta oír la correcta. Se desactiva en los ajustes para niños que ya leen.
- Botones con icono grande además del texto, de al menos 64 px de alto.

- Las letras se dibujan con la fuente **Andika**, pensada para lectores que empiezan: la "a" y la "g" tienen la forma que se enseña a escribir.
- Por defecto todo va en **mayúsculas**, como en Infantil. En los ajustes se cambia a minúsculas o a ambas.
- Feedback que un niño de 5 años entiende: al primer fallo se atenúa la tarjeta tocada y se repite el sonido buscado; al segundo se ilumina la correcta y se le pide tocarla, para que la última acción sea siempre correcta. Sin aspa roja ni zumbido (dos notas suaves).
- Elogio de proceso, no de persona ni inflado: "has escuchado muy bien", "has juntado la pe y la a", "lo has vuelto a intentar y ha salido". Nada de "eres una campeona" ni "fantástico" (Kamins y Dweck 1999; Brummelman 2014).
- Las estrellas premian la práctica: una por cada vez que se completa la lección (hasta tres), no el acierto a la primera (Deci 1999). El confeti sale solo a veces.
- Tras dos trazos fallidos aparece "Siguiente". Las letras en espejo (b por d, p por q) no cuentan como fallo: el juego las detecta, muestra el modelo con su punto verde de inicio y pide repetir.
- Las lecciones se desbloquean en orden dentro de cada mundo. El "modo libre" de los ajustes abre todas.
- La "z" solo forma za, zo, zu. La "h" se oye muda. La "c" y la "g" se pronuncian como corresponde ante e, i.

## Sesiones cortas y familia

- La sesión termina sola a los 10 minutos (ajustable de 5 a 20, o sin límite): al acabar la lección en curso Lía se despide, propone contarle a alguien lo aprendido y el inicio queda "en descanso" hasta que un adulto lo reabre en ajustes. Las sesiones cortas rinden más que las largas (EdTech Hub 2025) y la Asociación Española de Pediatría desaconseja pantallas antes de los 6 años.
- Cada lección termina con una propuesta para hacer juntos sin pantalla (buscar cosas que empiecen por un sonido, escribir la letra en harina, palmadas con los nombres de casa, leer un cuento en papel). Los ensayos con apps de lectura solo muestran ganancias claras cuando hay un adulto implicado (McTigue 2020).
- Si no pasa nada en 20 segundos, la instrucción se repite sola.
- Informe para la familia en ajustes: lecciones completadas, días y minutos de la última semana, letras y sílabas que más cuestan, y dos ideas para practicar sin pantalla.
- Punto de partida: un niño de 6 o 7 años puede empezar por las letras, las sílabas o las palabras sin recorrer las vocales.
- Repaso espaciado: la lección "Repaso" del mundo de juegos vuelve a sacar las letras completadas hace más tiempo.

## Sonido de las letras

La voz sintetizada no sabe pronunciar un fonema aislado (/m/ sin vocal), así que el juego presenta cada consonante por su sonido en contexto ("suena como en mono: mo, ma, me...") y deja el nombre ("se llama eme") como dato secundario. Si grabas tus propios audios en `audio/sonidos/<letra>.mp3` (por ejemplo `m.mp3` con "mmm"), el juego los usa automáticamente al tocar la letra grande. Es la mejora de más valor pedagógico pendiente.

## Animación del trazo y fichas en papel

- Al trazar una letra con guía, un lápiz recorre primero la letra en el orden y dirección escolares (letras de palo desde arriba a la izquierda; redondas desde arriba a la derecha girando a la izquierda) y marca el punto verde de inicio. El botón "Ver" lo repite. Si la niña empieza lejos del punto, se le indica una vez sin penalizar. Los trazos están en `js/strokes.js`, en coordenadas relativas a la caja de cada letra.
- `fichas.html` genera hojas A4 imprimibles por letra con pauta de 5 mm, el mismo punto de inicio y una propuesta para hacer juntos. La escritura con lápiz en papel complementa la pantalla; la instrucción solo motora en pantalla apenas transfiere (Santangelo y Graham 2016).

## Corrección del trazo

La forma manda, no el sitio: lo dibujado se alinea con la letra guía (se desplaza y se escala a su recuadro) antes de comparar, así la niña puede hacer la letra en cualquier parte del lienzo y de cualquier tamaño razonable. Al pulsar "Listo" se miden tres cosas:

- **Cobertura**: qué parte de la letra queda tapada por el trazo de la niña, engordado un poco (un trazo desplazado o algo más pequeño sigue contando; son niños, tiene que entenderse, no encajar).
- **Precisión**: qué parte del trazo cae dentro de la letra ampliada con un margen generoso (un cuarto de su altura).
- **Tamaño**: lo dibujado ocupa más o menos lo que la letra (una O pequeña no vale por una d).

La exigencia se elige en ajustes: relajada (por defecto, 4 y 5 años), normal o exigente (6 y 7 años). Los umbrales están en `js/tracing.js` (`evaluate`). Las letras en espejo (b por d, p por q) se detectan comparando el trazo reflejado y no cuentan como fallo.

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

## Versión

El número de versión (`VERSION` en `js/data.js`) se muestra en pequeño abajo a la derecha de todas las pantallas y en los ajustes. Súbelo en cada cambio que publiques: es la forma de saber que el dispositivo no está mostrando una copia antigua.

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
js/strokes.js         orden y dirección de trazo de cada letra
fichas.html           fichas imprimibles A4 con pauta
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

## Base pedagógica

El diseño sigue un informe de investigación propio (carpeta `reports/`, no incluida en el repositorio) que revisa la evidencia sobre método fonético frente a silábico y global en español, conciencia fonológica, grafomotricidad y trazado en pantalla, feedback y recompensas, dosis y tiempo de pantalla, reconocimiento de voz infantil y apps existentes (Letrilandia, Micho, Ludiletras, Leo con Grin, GraphoGame, Lalilo, Khan Kids, Duolingo ABC). Pendiente: audios grabados de fonemas (ver "Sonido de las letras") y audio por región (seseo, yeísmo).

## Piloto con familias

En `piloto/` están la guía para las familias, el protocolo para quien coordina, la hoja de registro y una propuesta de una página para entidades. La app incluye, en ajustes, una prueba de lectura de dos minutos que administra un adulto (10 letras, 10 sílabas, 5 palabras) y un botón que copia un informe anónimo de uso y resultados para enviarlo al coordinador. Nada sale del dispositivo si la familia no lo copia.

## Propósito

Este juego no tiene fin comercial y no lo tendrá: es gratuito, sin publicidad, sin cuentas y sin recogida de datos, con licencia CC BY-NC-SA para que nadie pueda cerrarlo ni venderlo. Si trabajas en una entidad educativa o de atención a dificultades de aprendizaje y quieres revisarlo, adaptarlo o pilotarlo, el material de `piloto/propuesta-entidad.md` resume qué pedimos y qué ofrecemos.
