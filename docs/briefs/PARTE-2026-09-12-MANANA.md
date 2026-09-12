# PARTE — mañana del 12 de septiembre de 2026

Continúa [TRASPASO-2026-09-12-MADRUGADA.md](TRASPASO-2026-09-12-MADRUGADA.md), que se queda en la
4.19.74. Esto es lo que pasó desde que él abrió la app por la mañana.

> **Antes de tocar nada:** `npm run salud` y `node scripts/errores.mjs --kind=beta`.
> Y **el buzón**: `.claude/canal-equipo/messages/cursor` (gitignored, no está en el repo).

---

## 1. ESTADO AL MEDIODÍA

| | |
|---|---|
| producción (`main`) | **4.18.25** · sin tocar |
| beta publicada | **4.19.76.1** — verificado con `version.json` del canal, no con Actions |
| `beta` remota | `3f3cd79e` |
| panel de beta | **22 tandas**, ninguna con veredicto suyo ya dado |
| en local sin pushear | nada |

Versiones de la mañana: **4.19.75** (categorizador, mía) y **4.19.76** (Efectivo + botnav, Cursor).

---

## 2. ⚠ LO PRIMERO: HAY UNA COSA ESPERÁNDOLE A ÉL

**El one-shot de 3 filas está listo, revisado y SIN APLICAR.** `scripts/recat-una-vez.mjs`, verde
técnico de Cursor, ensayo reproducido. Falta **su sí**:

| fila | cambio | importe |
|---|---|---|
| `AIGUES DE BARCELONA` | viajes → **energia** | 81,29 € |
| `SQ *PASTABAR BARCELONA S.` | viajes → otros | 156,70 € |
| `Juanjo Sabadell` | parking → otros | 100,00 € |

Y **2 apartadas** que no se tocan porque él ya les puso etiqueta a mano: `APOLLON GALLERY`
(él dijo joyería) y `FCIA COLLADO PALLARES` (su padre dijo salud). Esas las decide él aparte.

Cuando conteste: `npm run build` → ensayo otra vez → `--aplica`. **En ese orden**, porque el script
aborta si el build no está al día (si no, daría un falso «0 a corregir»).

---

## 3. SUS TRES RECHAZOS DE LA MAÑANA, Y QUÉ ERA CADA UNO

### 08:57 · `barcelona-no-es-un-viaje` — **no era del código**
*«Aigües de Barcelona precisamente sale como si fuera viaje»*. El arreglo funcionaba: pasado por el
`autoCategory` REAL, `AIGUES DE BARCELONA` → `energia`, con acentos, con `RECIBO` delante y con
`, S.A.` detrás. Lo que veía era una fila **sellada** de antes.

**El paso 2 de la tanda le pedía mirar exactamente lo que el arreglo no toca.** Un paso que no podía
pasar ni estando todo bien. De ahí sale el **filtro 6** del panel, ya en memoria
(`panel-beta-solo-lo-probable`).

### 09:16 · `botnav-sin-repintar` y 09:21 · `ficha-cuenta` — **arreglados por Cursor en la 4.19.76**
El Efectivo no guardaba el saldo si cerrabas la ficha con el foco dentro del campo, y subir en
Gastos después de haber bajado repintaba de más. Tandas nuevas: `ficha-efectivo-guarda` y
`botnav-subir-sin-lag`.

---

## 4. LO QUE SALIÓ DE INVESTIGAR SU RECHAZO (4.19.75)

Barriendo sus **237 comercios distintos** contra las listas de `00-core.js`: 17 términos de ≥4
letras casan dentro de otra palabra. **Doce aciertan igual** (`hamburgues` en HAMBURGUESERIA,
`pizza` en TELEPIZZA, `burger` en KIWIBURGER) y no se tocan. Cuatro no:

| comercio real suyo | término | caía en |
|---|---|---|
| `Transporte publico` | `sport` ⊂ tran**SPORT**e | ocio |
| `BRESSOLGRAMENET S.A.` | `ramen` ⊂ bressolg**RAMEN**et | bares |
| `APOLLON GALLERY` | `pollo` ⊂ a**POLLO**n | bares |
| `Mangopay (vinted)` | `mango` ⊂ **MANGO**pay | compras |

Nace **`KW_INICIO`**, hermana de `KW_PALABRA` y **no la misma**: `KW_PALABRA` son PREFIJOS
(BARCELOna) y piden límite por los dos lados; `KW_INICIO` son SUFIJOS o infijos (aPOLLOn) y les
basta con límite por delante. Pedirles los dos lados dejaría de reconocer los plurales
(«POLLOS ASADOS» ya no sería un bar).

---

## 5. ⚠ LO QUE MÁS IMPORTA QUE NO REPITAS

### El test te dice que te has equivocado — y hay que dejarle
`mango` parecía de la familia de `KW_INICIO` y **no lo es**: MANGOpay *empieza* por mango, o sea
que es un prefijo. Lo tenía escrito, convencido, y el test se puso rojo. Y al quitar `sport` de en
medio apareció que **en la lista de Transporte no existía la palabra «transporte»**: el arreglo a
medias dejaba el movimiento igual de huérfano, solo que en «otros» en vez de en «ocio».

### MEDIR TU COPIA DE LA REALIDAD NO ES MEDIR LA SUYA. Dos veces en el mismo fichero
`recat-una-vez.mjs` iba a escribir en su nube y tenía **dos** agujeros de la misma familia:

1. Comparaba las dos reglas con **`USER_OVERRIDES` vacío**, y `autoCategory` (`00-core.js:391`)
   consulta **primero** lo que él ha enseñado a mano. `apollon gallery → joyeria` es SUYO y esas
   filas están en `bares`: el script las daba por bug nuestro y las habría movido a «otros»,
   borrándole la etiqueta. **Era justo la fila que Cursor y yo dimos por buena los dos.**
2. Y la clave con la que buscaba el override la había **reescrito a mano** (`trim`+`lower`, sin
   NFD). La de la app quita acentos. Hoy no hay claves con acento en la nube, así que no se veía —
   pero «To Jubilació» ya existe en sus datos.

Ahora aparta lo que tenga override suyo, y **coge `catKey` del bundle o aborta**.

### Dos trampas de git de este repo
- **Hay rama `beta` Y tag `beta`** (el tag es la Release que sirve el OTA). Cualquier orden que
  reciba `beta` a secas es una lotería: `push` falla, y `git branch` también. Un `git branch` que
  falló encadenado con un `reset --hard` **me borró un commit** (recuperado del reflog).
  → `refs/heads/beta` siempre, y **`git switch beta`** en vez de `checkout` (`switch` solo acepta
  ramas, así que no sufre la ambigüedad; `checkout refs/heads/beta` te deja en DETACHED).
- **Mensajes de commit por heredoc `-F -`, nunca `-m` con backticks**: bash se los ejecuta y el
  mensaje sale con huecos. Ya pasó hoy y hubo que amendar.

### Y el código de salida detrás de un pipe
`git push … | tail -3` seguido de `echo $?` da **0** aunque el push haya fallado. Casi canto una
subida como buena estando rota. Capturar `$?` justo después, o redirigir a fichero.

---

## 6. QUIÉN LLEVA QUÉ

**Cursor** (reservados: `07-tab-patri-fijos.js`, `shell.html`):
- **Long-press para ordenar las cuentas**, con el efecto que él pidió.
- **Los ingresos que le faltan al móvil**: 314,22 € en su teléfono contra 601,62 € en la nube.
  Herramienta: `scripts/diag-mes.mjs`.
- **El ticket de `setCat` → hermanos en la NUBE** (ver abajo). Suyo, y quedó acordado que nadie lo
  pica en paralelo.
- La ola nativa de Android, que sigue abierta.

**Sin dueño, esperando decisión suya:**
- Desplegar `_shared` a las Edge Functions. `ingest` es de ayer 11:16 y los arreglos del
  categorizador son de las 23:08 en adelante, así que **el servidor sigue con las reglas viejas**.
  La vía de Open Banking clasifica en el CLIENTE (le llega por OTA), pero la de **notificaciones**
  va por servidor. Toca producción.
- Los traspasos internos (`To Cuenta Remunerada`, `From Jubilació`…) que caen en «Otros». Sin
  tocar a propósito: `traspaso` es neutra y adivinarla movería meses cerrados.

---

## 7. ⚠ HALLAZGO NUEVO SIN CERRAR: la misma fila con dos categorías

Su padre tiene **`nistal → bares`** en `catOverrides`, y las **31 filas de NISTAL siguen guardadas
como `otros` en la nube** (717,40 €, media 23 €).

Causa: `migrate` (`01-i18n.js:3008`) recategoriza lo que está en «otros» **en el objeto de estado
LOCAL**, y eso no vuelve a la tabla `expenses`. En el móvil de su padre se ve «bares»; en la nube
pone «otros». Y **la nube es lo que lee el servidor** (`presupuesto.ts`) y por tanto el **widget**.

Alcance votado con Cursor, en este orden:
1. **La causa**: que `setCat`, al aprender un override, haga PATCH también de los hermanos «otros»
   del mismo comercio **en la nube** — hoy solo toca el target y su gemelo de cashback.
2. Un one-shot **opcional** «overrides → expenses» por usuario, con ensayo, y **nunca silencioso
   desde `migrate`**: eso sí movería totales de meses cerrados y necesita su OK y el de su padre.

**De paso, dos cosas que el traspaso de la madrugada daba por suyas y no lo son:** `NISTAL` es de
su **padre**, y `BOCINE` (43,95 €, una sola fila) es del **tercer usuario**. No hay que preguntarle
por ninguna de las dos.

---

## 8. EL PANEL, QUE AHORA ES UN ENCARGO PERMANENTE

Suyo, esta mañana: *«cada vez que subáis, comprobadme lo de las tareas que tengo que probar, que no
sean repetitivas y que no me bloqueen, que realmente pueda probarlas… siempre actualizadito»*.

Cuando lo dijo, el panel arrastraba **cinco tandas ya juzgadas** — una aprobada **seis días antes**
— sin haber pasado ni una semana desde la limpieza de 56 → 13. **La pasada del filtro 1 va con cada
bump**, no cuando se acumule. Y un rechazo cuyo arreglo aún no existe **también sale**: dejarlo
puesto es garantizar que lo vuelva a probar y lo vuelva a rechazar.

Los seis filtros están en memoria (`panel-beta-solo-lo-probable`), espejados en `docs/memoria/`.
