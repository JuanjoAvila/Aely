# Logos de banco — los ORIGINALES, para medir

Estos PNG **no se usan en la app**. Están aquí para lo mismo que `docs/design/aely/logo Aely.png`:
para que el trazo SVG se saque **midiendo el original**, no dibujándolo de memoria.

## Por qué existe esta carpeta

El 11/9 él pidió los logos de los bancos de verdad. Se dibujaron a ojo dos veces y las dos salieron
mal — la primera eran literalmente las iniciales (`S`, `R`, `T`, `M`), la segunda unas formas que
tampoco se reconocían. Su reacción: «qué puta mierda es esa, no son los logos».

Es exactamente lo que ya había pasado con el logo de Aely: dos intentos a ojo rechazados
(«esto es un mierdón», «no se parece nada») y solo salió bien cuando se **midió el PNG original**.
Ver el comentario de `I.logo` en `src/modules/02-ui-shared.js`.

## De dónde salen

**Del directorio de Enable Banking** (`bank-aspsps` → campo `logo`), que es la misma fuente por la
que la app conecta con sus bancos. No son de una búsqueda de imágenes: son los que el propio
proveedor de Open Banking publica para cada entidad.

## Qué parte usar

Ninguno cabe entero en un tile de 44 px: casi todos llevan el nombre al lado. **Se usa el isotipo**:

| fichero | isotipo que sirve |
|---|---|
| `sabadell.png` | la bola azul con la **B** blanca (a la izquierda del texto) |
| `trade_republic.png` | el símbolo de la **onda** (dos barras onduladas, a la derecha del texto) |
| `myinvestor.png` | el **círculo de degradado** con el «my» dentro |
| `revolut.png` | la **R** — hay trazo oficial en simple-icons (`revolut`) |
| `caixabank.png` | la **estrella** — hay trazo oficial en simple-icons (`caixabank`) |

## Reglas

- **SVG inline en el bundle, nunca estos PNG.** El gzip va al 99 % (326/330): meter PNG lo revienta.
- El trazo se saca **midiendo**. Si alguien lo dibuja a ojo, vuelve a salir mal.
- **La prueba de fuego:** tapa el nombre del banco en la lista de Cuentas. Si no sabes cuál es, no
  está hecho. Eso no lo caza ningún test.
- Uso nominativo: identifican al banco en su lista de cuentas. No van en el icono de Aely, ni en
  material promocional, ni deformados.
