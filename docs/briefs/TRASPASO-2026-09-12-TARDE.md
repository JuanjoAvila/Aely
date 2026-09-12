# TRASPASO — tarde del 12 de septiembre de 2026

Para la sesión que siga. Continúa [PARTE-2026-09-12-MANANA.md](PARTE-2026-09-12-MANANA.md) y
[TRASPASO-2026-09-12-MADRUGADA.md](TRASPASO-2026-09-12-MADRUGADA.md).

> **Lo primero, siempre:** `npm run salud` · `node scripts/errores.mjs --kind=beta` ·
> `node scripts/errores.mjs --kind=feedback --limit=50`
> **Y el buzón:** `.claude/canal-equipo/messages/cursor` (gitignored, no está en el repo).
> Los JSON de Cursor pueden venir con BOM: `readFileSync(...).replace(/^﻿/,"")` antes de
> `JSON.parse`, o revienta.

---

## 0. ⚠ LO QUE ÉL PIDIÓ EXPRESAMENTE HOY, Y VA PRIMERO

### 0.1 CALLARSE. En serio.
*«claude DEJA DE ESCRIBIR… solo háblame para 2 cosas: 1. bloqueos que me necesites. 2. ALGO SUPER
IMPORTANTE que deba saber. 3. o cuando te diga qué tal vamos… sino sigue pero sin escribir nada
por favor, que me llenas de contexto todas las putas conversaciones, te lo he dicho hasta la
saciedad»*.

Me lo dijo **dos veces** esta tarde y la segunda con un *«QUE TE HE DICHO CLAUDE???»*. Trabajar en
silencio: encadenar tandas, y hablar solo por bloqueo real, por algo grave, o cuando pregunte.
Instaló a propósito el plugin **`i-have-adhd`** (marketplace `ayghri/i-have-adhd`) con el flag
`~/.claude/.i-have-adhd-always` puesto, para forzar respuestas cortas. No es broma: es la norma.

### 0.2 A partir de ahora reporta los bugs DESDE LA APP
*«creo que usaré lo de sugerencias y errores para reportarte errores… porque conforme voy probando
las betas me encuentro cosas y al final se me olvidan… no siempre estoy delante del ordenador»*.

O sea: **`node scripts/errores.mjs --kind=feedback --limit=50` pasa a ser tan obligatorio como
`--kind=beta`**, y hay que mirarlo en cada vuelta.

### 0.3 El panel, en cada subida
*«cada vez que subáis, comprobadme lo de las tareas que tengo que probar, que no sean repetitivas
y que no me bloqueen, que realmente pueda probarlas… siempre actualizadito»*. Y cuando le ofrecí
que eligiera qué quitar: *«no quiero ir probando, deja todo lo que sea para probar por mí QUE DE
VERDAD PUEDA PROBAR»* — la poda la hacemos nosotros con los seis filtros
([[panel-beta-solo-lo-probable]]), no él.

---

## 1. ESTADO AL CERRAR LA TARDE

| | |
|---|---|
| producción (`main`) | **4.18.25** · sin tocar hoy |
| beta publicada | **4.19.79.1** — verificado con `version.json` del canal |
| `beta` remota | `180478b8` |
| **en vuelo** | **`tanda/suministros` = `5f92bd31` (4.19.80)** — ver §2 |
| panel de beta | **23 tandas**, ninguna con veredicto suyo ya dado |
| servidor | `categorize` e `ingest` **DESPLEGADAS** hoy (§3) |

Versiones de hoy: 4.19.75 (mía), 4.19.76 / .77 / .78 / .79 (Cursor), y la 4.19.80 sin subir.

---

## 2. ⚠ LO QUE ESTÁ A MEDIAS: la 4.19.80 (agua / luz / gas)

**Rama `tanda/suministros`, commit `5f92bd31`. NO está en `beta` y NO está revisada por Cursor.**

Petición suya de esta tarde, viendo la 4.19.79 funcionar: *«ahora sí sale lo de Aigües de
Barcelona luz gas y agua, creo que eso se debería separar… porque sale un símbolo de rayito en
Aigües de Barcelona que no encaja para nada. Agua por un lado con su símbolo, luz por otro y gas
por otro»*.

### Lo que ya está hecho
- `energia` retirado. Nacen **`agua` 💧, `luz` 💡 y `gas` 🔥** en `CATEGORIES` (`00-core.js`).
- Las listas `KW` repartidas — **es un reparto, no una ampliación**: las mismas palabras de
  `energia`, cada una en su sitio. La única nueva es `nedgia`, y entra solo porque sin ella él no
  puede PROBAR la categoría Gas.
- Espejo exacto en `supabase/functions/_shared/ingest_logic.ts` (el guardián `categorias-dual` lo
  exige) y `ALLOWED` + `HINTS` en `supabase/functions/categorize/index.ts`.
- i18n en los tres idiomas (`cat_agua` / `cat_luz` / `cat_gas`).
- **Remapeo de lo viejo** en `seedFlows` (ver §5.1, que es la trampa).
- Tests: 12 casos de conducta en `tests/categories.test.mjs` + `tests/suministros-legacy.test.mjs`
  nuevo (6 casos), registrado en `scripts/run-tests.mjs`. **Los 17 verificados EN ROJO** quitando
  el cambio entero.

### 🔴 LO QUE LO BLOQUEA
**`presupuesto-rendimiento` en rojo por 0,03 KB de gzip** (330,03 sobre un tope de 330,00).

Medido, para que no se re-investigue:
- el tip de Cursor **ya venía con 329,90 KB**, o sea 0,10 KB de aire;
- mi cambio suma **0,13 KB** gzip (0,7 KB minificado) y es irreducible: son las 3 entradas de
  `CATEGORIES` y las 9 cadenas de i18n, o sea la función en sí;
- ya recorté media docena de palabras clave que había metido **sin un comercio suyo detrás**
  (emasesa, hidraqua, butano, electricidad…), que además iba contra la norma de la casa.

Y el propio `tests/presupuesto-rendimiento.test.mjs` dice dos cosas en tensión: *«Recorta, o sube
el tope explicando por qué»* y *«si el gzip se acerca al tope, se recorta; no se sube»*.
**Está a voto de Cursor** (mensaje `20260912T14…-claude-suministros-y-el-gzip`). No subir el tope
por decisión propia: es una norma escrita y Cursor ya subió hoy el del minificado a 1195.

### Lo que falta para cerrarla
1. Voto de Cursor sobre el gzip (recortar de otro sitio o subir el tope con justificación).
2. `npm test` entero en verde.
3. **Review de Cursor EJECUTANDO** (norma: nada mío va a beta sin eso).
4. Merge a `refs/heads/beta` + push, y avisarle de que la pruebe.
5. ⚠ **Y el servidor de esta tanda NO se despliega hasta el promote.** Cursor fue explícito: el
   split sí rompería al cliente de producción (4.18.25 no conoce los ids `agua`/`luz`/`gas`). Va
   cliente+servidor juntos: bump beta → él prueba → promote → deploy.

---

## 3. LO QUE SÍ SE CERRÓ HOY

### 4.19.75 — el categorizador (mía)
Su rechazo de `barcelona-no-es-un-viaje` **no era del código**: el paso 2 de la tanda le pedía
mirar filas viejas de un arreglo que solo toca las nuevas. De investigarlo salieron **4 trampas
más** medidas sobre sus 237 comercios: `sport`⊂tran**SPORT**e (→ Ocio), `ramen`⊂bressolg**RAMEN**et,
`pollo`⊂a**POLLO**n, `mango`⊂**MANGO**pay. Nace `KW_INICIO` (sufijos, límite solo por delante)
junto a `KW_PALABRA` (prefijos, límite por los dos lados).

### 4.19.76 → 4.19.79 — Cursor
Efectivo que no guardaba al cerrar la ficha; lag al subir en Gastos; long-press para ordenar
cuentas; **y el pull muerto** (§5.2).

### Las filas corregidas en su nube
Con su OK y el verde de Cursor, vía `scripts/recat-una-vez.mjs`:
`AIGUES DE BARCELONA` viajes→energia, `SQ *PASTABAR` viajes→otros, `Juanjo Sabadell`
parking→otros, y las **3 filas de `APOLLON GALLERY` → `joyeria`** (él confirmó que es una
joyería). Todo verificado leyendo de vuelta de la nube.

### El servidor, DESPLEGADO
Él: *«despliega el servidor con verificación de cursor siempre»*. Hecho, una a una y con
migraciones en «no»:

    run 34691043259  categorize  → Deployed Functions on project …: categorize
    run 34691104906  ingest      → Deployed Functions on project …: ingest
    Aplicar migraciones → SKIPPED   (la base de datos NO se tocó)

⚠ **El workflow bueno estaba solo en `main`.** El de `beta` era el viejo (`workflow_dispatch: {}`
→ las TRECE funciones + migraciones si existe la contraseña). Portado a `beta` en `180478b8`. Y
ojo al fondo: un `workflow_dispatch` despliega **el código de la rama que elijas**, así que para
desplegar arreglos que solo están en `beta` hay que dispararlo **sobre `beta`**.

    gh workflow run supabase.yml --ref beta -f funcion=<nombre> -f migraciones=no

---

## 4. QUIÉN LLEVA QUÉ

**Cursor** — reservados: `07-tab-patri-fijos.js`, `shell.html`, y el merge del pull.
1. **El filtro de Gastos** (bug nuevo suyo, ver §6.1). Suyo, dijo que no lo piquemos en paralelo.
2. **Los ingresos que le faltan al móvil**: 314,22 € en su teléfono contra 601,62 € en la nube.
   Su hipótesis ahora: puede ser el pull muerto de §5.2 — *«que sincronice con la 79 y me diga si
   cuadra»*.
3. **`setCat` → hermanos en la NUBE** (§6.2).
4. La ola nativa de Android, que sigue abierta.

**Yo (Claude)**: el categorizador, el panel, las notas, y la 4.19.80 de §2.

---

## 5. ⚠ LAS TRAMPAS DE HOY. LEER ANTES DE TOCAR

### 5.1 `migrate` NO corre para los estados actuales
Al cargar: `(saved._dataVer>=6) ? saved : migrate(saved)` (`01-i18n.js:3133`). **`migrate` solo
corre para estados legacy.** Lo que tiene que correr siempre va en **`seedFlows`** — que es donde
vive la recategorización de «otros» y donde puse el remapeo de `energia`.

Y el test lo cazó de la peor forma: apuntaba a `migrate`, salía **rojo con el arreglo puesto**, o
sea fallaba por la razón equivocada. Está escrito dentro del test para que nadie lo «ordene».

### 5.2 El pull no refrescaba NADA (4.19.78/79)
`syncCloudExpenses` filtraba `source!=="supabase"` para decidir qué reemplazar, pero
`expenseFromRow` **no emite nunca `"supabase"`** (lo convierte a `"manual"`). Resultado: el filtro
no descartaba ninguna fila y **la categoría/importe/nota de una fila ya vista nunca se
actualizaba**. Solo entraban filas nuevas.

Cazado porque corregí `AIGUES DE BARCELONA` en la nube y su móvil siguió diciendo «Viajes» con
«Ya estás al día». **Y lo primero que hice fue comparar las horas** — mi escritura 12:45:58, su
captura 12:48 — porque el error clásico es diagnosticar sobre una captura anterior al arreglo.

Arreglado por Cursor con `mergeExpensesFromCloud`. **Y su primer arreglo (4.19.78) traía dos
regresiones que encontré EJECUTANDO su código, no leyéndolo:**
1. `put("possibleDupOf", incoming.possibleDupOf)` con `incoming` que **no declara esa propiedad**
   → `put(…, undefined)` la BORRABA en cada pull. Se perdía el gemelo de los «posibles repetidos».
2. Realinear el `id` local al uuid de la nube **huérfana `settings.expenseOrder`**, que es un array
   de ids → se perdía el orden a mano que él acababa de aprobar.

Cerrado en 4.19.79. **La 4.19.78 mala nunca se publicó**: el canal saltó de la .77 a la .79.

### 5.3 `CAT` y `CATEGORIES` son `const` → no viajan al sandbox de los tests
`assert.ok(!ctx.CAT.energia)` no comprueba nada: revienta con `Cannot read properties of
undefined`. Eso se comprueba leyendo el fichero, como ya hacía el test de la IA.

### 5.4 Las trampas de git de este repo
- **Hay rama `beta` Y tag `beta`.** `git push origin beta` falla; `git branch` también; y
  `for-each-ref` muestra la rama como **`heads/beta`** por eso mismo. Usar `refs/heads/beta`
  siempre, y **`git switch`** (no acepta tags, así que no sufre la ambigüedad) en vez de
  `checkout refs/heads/beta`, que deja **DETACHED HEAD**.
- Un `git branch` que falló **encadenado con un `reset --hard` me borró un commit** (recuperado
  del reflog). Una orden destructiva va SOLA.
- **Mensajes de commit por heredoc `-F -`, nunca `-m` con backticks:** bash los ejecuta, el mensaje
  sale con huecos, y además me creó un fichero basura llamado `joyeria` en la raíz del repo.
- **`$?` detrás de un pipe es el del último proceso.** `git push … | tail -3; echo $?` da **0**
  aunque el push haya fallado. Casi canté una subida como buena estando rota.
- `git show "origin/main:.github/…"` necesita **`MSYS_NO_PATHCONV=1`** o el shell convierte las
  barras y los dos puntos.

### 5.5 El árbol es COMPARTIDO con Cursor
Dos veces hoy: Cursor trabajando sin commitear en el checkout mientras yo leía, y **la rama del
checkout cambiada bajo mis pies** — un commit mío se fue a `cursor/longpress-cuentas`. Se recolocó
sin tocar el árbol: `git branch -f beta <sha>` + `git push origin <sha>:refs/heads/beta`, **sin
`switch`**, para no arrancarle el árbol si está a medias.

---

## 6. HALLAZGOS ABIERTOS, CON DATO Y SIN CERRAR

### 6.1 El filtro de Gastos ya no marca solo las cuentas de gasto diario (suyo, hoy)
*«el filtro de gastos, te dije hace mucho tiempo y antes funcionaba, que las cuentas que estaban
en gastos diarios automáticamente se filtraba ahí en gastos y el resto no estaba marcado. Una vez
se quitaba un banco o ya no era de gastos diarios se actualizaba y ya no se marcaba en el filtro
automáticamente. Eso ahora no funciona.»*

⚠ **No contradice la 4.19.65**: aquello era que TODAS las cuentas **aparezcan** como opción; esto
es que las de gasto diario vengan **MARCADAS** por defecto. Quiere las dos.
Sospecha sin confirmar: **`be390cc8`** («vacío ya NO es *default de gasto diario* en la UI del
filtro»). **Es de Cursor**, está en su tip y dijo que no lo piquemos en paralelo.

### 6.2 La misma fila con dos categorías: nube vs móvil
Su padre tiene **`nistal → bares`** en `catOverrides` y las **31 filas siguen en `otros` en la
nube** (717,40 €). Causa: la recategorización de «otros» corre sobre el estado **LOCAL** y no
vuelve a la tabla `expenses`. En su móvil se ve «bares»; la nube dice «otros». **Y la nube es lo
que lee el servidor** (`presupuesto.ts`) y por tanto el widget.

Alcance votado con Cursor:
1. **La causa:** que `setCat`, al aprender un override, haga PATCH también de los hermanos «otros»
   del mismo comercio **en la nube** — hoy solo toca el target y su gemelo de cashback. **De Cursor.**
2. Un one-shot «overrides → expenses» por usuario: **MUERTO para su padre.** Él fue explícito:
   *«no es mío así que no lo toques»*.

La prueba viva de (1) es `APOLLON GALLERY`: tenía 3 filas, él etiquetó 2 como joyería y **la
tercera se quedó en `bares`** porque `setCat` no patchea los hermanos.

### 6.3 `NATURGY IBERIA` cae en Viajes
Por «iberia» la aerolínea, que va antes en el orden de categorías. **Comprobado contra el build
anterior al split: ya pasaba.** No es regresión, y **no hay ninguna fila suya afectada**, así que
no se toca a ojo. Anotado para decidirlo con dato.

### 6.4 El gzip no tiene aire
El tope está en 330 KB y el tip lo roza. Esto va a volver a morder en la siguiente versión que
añada texto. Merece una decisión de fondo, no un +2 KB cada vez.

### 6.5 `BOCINE` — no preguntar
Una sola fila de 43,95 € y **no es suya**, es del tercer usuario. Él: *«yo no lo tengo así que no
lo toques»*. El traspaso de la madrugada lo daba por suyo, igual que `NISTAL`, y las dos cosas
estaban mal.

---

## 7. PENDIENTE DE DECISIÓN SUYA

- **Nada bloqueante ahora mismo.** Lo último que contestó fue el sí a la joyería y al despliegue.
- Sigue abierto, de antes: los traspasos internos (`To Cuenta Remunerada`, `From Jubilació`…) que
  caen en «Otros». Sin tocar **a propósito**: `traspaso` es neutra y adivinarla movería meses ya
  cerrados.
- Las 12 Edge Functions que quedan sin desplegar. Hoy solo se tocaron `categorize` e `ingest`,
  que eran las que llevaban los arreglos del categorizador.
