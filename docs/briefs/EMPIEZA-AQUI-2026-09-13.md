# EMPIEZA AQUÍ — sesión del 13 de septiembre de 2026

Traspaso de la noche del 12/9. Fue un día largo: **de la 4.19.79 a la 4.19.99**, con él probando en
vivo y reportando sin parar. Esto es lo que hay que saber para seguir sin preguntarle nada.

---

## 0. LOS TRES COMANDOS, SIEMPRE, ANTES DE TOCAR NADA

    npm run salud
    node scripts/errores.mjs --kind=beta --limit=20
    node scripts/errores.mjs --kind=feedback --limit=20

Y **el cuarto, nuevo desde ayer y ya ha resuelto un bug él solo**:

    node scripts/errores.mjs --kind=hist

Es la telemetría de la sonda del histórico. La noche del 12/9 dijo, sin que nadie le preguntara,
que se estaban tirando **1.104 filas de 1.230**. No la ignores.

**Y el buzón:** `.claude/canal-equipo/messages/cursor` (gitignored). Los JSON de Cursor pueden
llevar BOM: `.replace(/^\uFEFF/,"")` antes de `JSON.parse`.

---

## 1. CÓMO SE TRABAJA AQUÍ (esto no es opcional)

- **Nada se decide ni se toca sin pasarlo por Cursor por el buzón.** Él lo dijo con todas las
  letras: *«tú distribuyes, pero él te corrige… NUNCA tenéis que tirar solos»*. Si ves algo mal de
  Cursor, se habla hasta el acuerdo — no se impone.
- **Escribir poco.** Solo por bloqueo real, algo importante, o si pregunta.
- **Una tanda terminada y revisada SE PUBLICA en beta y se le avisa.** No se le pide permiso para
  publicar en beta. `main` sí necesita su OK.
- **El árbol está COMPARTIDO con Cursor.** El 12/9 nos pisamos dos veces. **Trabaja en un worktree**
  (`git worktree add -b tanda/xxx .claude/worktrees/claude-xxx`) y engancha `node_modules` con una
  junction de PowerShell: `New-Item -ItemType Junction -Path "<wt>\node_modules" -Target "E:\Mi cartera\node_modules"`.
- **Verifica por CONTENIDO, no por el mensaje del merge.** `git show origin/beta:fichero | grep ...`.

---

## 2. ESTADO AL CERRAR

| | |
|---|---|
| producción (`main`) | **4.18.25** |
| beta publicada | **4.19.96.1** ⚠ |
| `beta` remota | `4.19.98` (`e9ea731e`) |
| sin publicar aún | **4.19.97, .98 y .99** |

⚠ **Lo primero de la mañana: que la 97/98/99 le lleguen al móvil.** Ahora mismo tiene en la mano una
versión **sin tres arreglos suyos**, y uno de ellos es el que él cree que no funciona (ver §3).

Mis ramas, todas empujadas y a review de Cursor:
`tanda/rol-sin-salto-2` (97) · `tanda/hist-uniq-banco` (99).

---

## 3. ⚠ SU RECHAZO DEL SALDO ES ANTERIOR AL ARREGLO

Dijo: *«lo del saldo que baja en Trade Republic sigue exactamente igual… no lo estáis arreglando»*.
**Probó la 4.19.96.1 y el arreglo es la 4.19.97.** No ha probado la versión buena.

Es el patrón de [[rechazo-anterior-al-arreglo]]: **compara la hora del veredicto con la del arreglo
ANTES de re-diagnosticar**. Le pasó igual el 11/9 con cuatro de cinco rechazos.

**Qué era, para que no se re-investigue:** cambiar el rol de una cuenta le movía el saldo. La
4.19.84 curó `paidNet` (los recibos ya cobrados) y **se dejó la otra mitad**, `spentOwn`:
`gastoDelMesPorBanco(gastos, dailyEnt)` manda los gastos **sin banco** a la cuenta de gasto diario,
así que al pasar a serlo hereda los huérfanos del mes y la fórmula se los RESTA. Arreglado en la 97.

Y la lección cara: **mi test daba verde sobre el arreglo a medias** porque montaba los totales con
`spentByBank: {}`. Un doble más simple que la app justo en lo que importa no prueba nada.

---

## 4. LO QUE SIGUE ROTO

| qué | de quién | dónde está |
|---|---|---|
| **Degradación acumulativa** — exprimir el scroll en Gastos hasta que se ralentiza la app ENTERA | **mío, sin empezar** | §5 |
| **El signo de Trade Republic** en el histórico | sin asignar | §6 |
| `4.19.93/guardar-cta` — el botón Guardar cortado y el halo al borrar | Cursor | rechazada 2 veces |
| `4.19.94/swipe-sin-corte` — se corta la cabecera al deslizar | Cursor | su 98 lo reintenta, falta veredicto |
| Tironcillo al abrir Ajustes (UX-02) | Cursor lo ofreció | pendiente |
| Sugerir IA al escribir el concepto | mío | **brief antes de picar**, acordado |
| Categorías automáticas por deudas | backlog | idea suya del 13:59 |

---

## 5. LO PRIMERO DE LA MAÑANA: la degradación acumulativa

Textual: *«he bajado y subido varias veces, luego he scrolleado y otra vez subido y bajado y de
repente se ha comenzado a ralentizar… hasta que la app ENTERA se ha ralentizado, ha sido
horroroso»*.

**No es lo mismo que la ola ni el stopper** (aquello era por gesto; esto es acumulativo y contagia
a toda la app). Ya descarté que sean los timers de la barra (`pinNavVisible`/`revealNav` sí hacen
`clearTimeout`).

**Está acordado con Cursor: mido yo primero, cero fix especulativo.** Lo que hay que mirar es la
PENDIENTE, no el frame:

1. `getEventListeners(document)` y del `.page` activo, antes y después de ~20 ciclos.
2. `performance.memory.usedJSHeapSize` y `document.getElementsByTagName('*').length` cada 5 ciclos.
3. Timers y `rAF` vivos.

Si sube en escalera y no baja, ahí está. Si la curva es plana, es trabajo por frame y toca el
perfilador. Con la medida delante: si la fuga es del gesto/barra/ola → la arregla Cursor; si es de
la lista de Gastos → la pico yo.

⚠ Se puede reproducir en local con Playwright (ciclos de scroll + muestreo), no hace falta su móvil
para la primera pasada.

---

## 6. EL SIGNO DE TRADE REPUBLIC — con su caso delante

De sus capturas del 12/9, comparando el histórico con la app de TR:

| en la app de Trade Republic | lo que ofrece el histórico |
|---|---|
| FTSE All-World · **2 sept** · *Saveback* · **10,34 € que SALEN** hacia la inversión | «Movimiento» · **2026-09-01** · **+10,34 € como INGRESO** |
| «Interés» · 1 sept · +13,72 € (ingreso de verdad) | +13,72 € ingreso ✅ correcto |

O sea: **signo invertido Y un día de menos**, y solo en algunas filas. El interés, que sí es
ingreso, llega bien. Su frase: *«cosa que no es un puto ingreso, es un gasto que se va hacia
inversiones»*.

⚠ Ojo con [[ob-signo-volteado-duplica]]: un signo volteado ya le duplicó filas antes (el famoso
475 €). **No tocar a ojo.** Hay `histSignSuspectByBank` en `08-motor-bank.js` — empieza por ahí y
mide con la sonda antes de cambiar nada.

---

## 7. LO QUE SÍ SE ARREGLÓ EL 12/9 (para no re-hacerlo)

- **El OTA de la familia**, que el renombre a Aely había matado — ver [[renombrar-el-repo-mata-el-OTA]].
  ⚠ **El repo puente `Mi-Cartera` NO se borra** mientras circule una APK ≤45. Los seis pasos para
  apagarlo están en `docs/RELEASE.md`.
- La ola nativa, el corte al deslizar (a medias), el saldo al cambiar de rol, el aviso de la última
  cuota, el banco pendiente, el banco que no salía hasta salir y entrar.
- **Tres claves de identidad sin banco**, en tres sitios distintos, todas el mismo día:
  `histCandExisting`, el aplanado del histórico, y (ya conocida) la del sync. **Si escribes una
  clave que identifique un movimiento, el banco va dentro.**
- Guardianes nuevos: `ota-bases-espejo`, `notas-sin-duplicados` (ya cazó una de verdad),
  `hist-dia-local`, `hist-fecha-que-baila`, `hist-uniq-por-banco`, `rol-cuenta-sin-salto`.

---

## 8. EL MURO DEL GZIP

    minificado  1193 / 1195 KB       gzip  331 / 332 KB

Está al 100%. La última tanda entró por los pelos con UNA cadena nueva. **No subas el tope**: lo
prohíbe el propio test.

⚠ Propuse partir los idiomas a JSON y **me inventé el ahorro («dos tercios»)**. Lo retiré: no estaba
medido, y mis dos intentos de medirlo se contradijeron. **Condición 0 acordada con Cursor: primero
el A/B real** (bundle actual contra bundle sin los idiomas inactivos, sobre el MINIFICADO, que es lo
que mide el test), y solo si el ahorro compensa se pica. Si es de 3 KB, hay que buscar el peso en
otro sitio.

---

## 9. LO QUE VIENE DESPUÉS (encargo suyo, ya en `docs/BACKLOG.md` como OPS-06)

*«cuando acabemos de implementarlo todo te pediré que la destroces: pruebas de rendimiento a full,
probando todo tipo de botones, intentando hackearla a ver si hay fallos de seguridad, antes de
publicarla en la Play Store»*.

Tres frentes: rendimiento, aporrear la interfaz, y **seguridad** — RLS de cada tabla, qué viaja en
`app_events`, permisos del manifiesto, qué guarda `localStorage`. Con usuarios de fuera, un fallo de
RLS deja de ser un susto en familia.

---

## 10. Y SU FRASE DE CIERRE

> *«hemos avanzado mucho, destrozado también mucho, y al final hemos subido algunas cosillas a prod
> aunque sea… poco a poco. A ver si podemos arreglar mañana lo que nos queda y dejamos limpia beta
> para seguir con el backlog.»*

Ese es el objetivo del 13/9: **cerrar los rechazos, promocionar, y volver al backlog.**
