# RELEVO A CODEX — 16/9/2026, mediodía

Claude se queda sin tokens. Codex recoge desde aquí. Todo lo que dice «verificado» se comprobó
por EXIT real o parseando el resultado, nunca por el mensaje de un commit.

---

## 0. LO QUE HAY QUE HACER AHORA (por orden)

### 1. Terminar el PROMOTE de la ronda 4.24 a producción — **está a un push**

Rama `promote/4.24.5`, tip **`e82e43c2`**, encima de `641c1244` (= `origin/beta`).
Worktree: `.claude/worktrees/claude-rev-4244` (con `npm ci` hecho).

**DOBLE VERDE ya pasado sobre ese tip exacto:** `npm test` → **277 passed, EXIT 0** ·
`TZ=UTC npm test` → **277 passed, EXIT 0**. Una sola suite a la vez en la máquina.

Tres commits sobre beta:
- `9445307c` — las CINCO entradas 4.24.x del JSON colapsadas en UNA nota (4.24.5) con `tandas: []`.
- `f41dbd32` — espejo de memoria (`panel-beta-reabre-ajustes`).
- `e82e43c2` — el test `inicio-offline` que estaba verde por la razón equivocada (ver §2).

Lo que queda, en este orden (receta de `promote-4-19-106-como-se-hizo`):

1. **Commit vacío de cabeza con `[skip ci]`.** ⚠ Obligatorio: la ronda toca
   `supabase/functions/ingest/index.ts` y `_shared/ingest_logic.ts`, así que un push normal a
   `main` dispara `supabase.yml` (paths `supabase/**`) y **despliega las TRECE funciones de
   golpe** — incluidas `bank-aspsps` (43 días de atraso) y `prices` (52) con un mes de `_shared`
   sin estrenar. Y `[skip ci]` también apaga `test.yml`: **la suite local es el único guardián
   de este promote**, por eso van las dos pasadas enteras y no afectados.
2. **Push a `main`** (fast-forward limpio: `origin/main` no tiene NI UN commit que falte en beta).
   ⚠ El clasificador de permisos bloquea el push a main: pedirle OK explícito a Juanjo.
3. **`deploy.yml` a mano** por Actions. Verificar `/Aely/` **por contenido**, no por el run verde.
4. **Puente `JuanjoAvila/Mi-Cartera`**: copiar `version.json`, `bundle.zip` y `apk.json` con
   `gh api -X PUT repos/JuanjoAvila/Mi-Cartera/contents/<f>`. No lo hace ningún workflow.
   Verificar `/Mi-Cartera/` por contenido.
5. **Edge `ingest` DESPUÉS de que Pages sirva el cliente, y SOLO con su OK explícito**
   (`supabase.yml -f funcion=ingest -f migraciones=no`). Lleva `ingest_skip` +
   `clasificarConMotivo` de 4.24.1. Él lo dejó dicho así: «y después la Edge ingest, con mi OK».
6. **Resetear la numeración de beta** (4.24.x → 4.25.0): lo pide en cada promote.
7. **`merge origin/main` en beta.**

### 2. Después: la pila 4.25 → 4.26 → 4.27, **POR BLOQUES**

Verificado que la cadena está bien encajada hoy:

| tanda | rama | tip | estado |
|---|---|---|---|
| 4.25 bancos + tooling | `codex/bancos-historico-caixa` | `f9e11263` | **revisada entera por Claude** |
| 4.26 categorías | `codex/categorias-personales` | `8c70d897` | cuelga de 4.25 ✔ |
| 4.27 ayuda (IA APAGADA) | `codex/asistente-hibrido` | `73bb3ca5` | cuelga de 4.26 ✔ |

⚠ Son una CADENA: empujar el tip de 4.27 a beta le mete las tres a la vez, y él pidió por
bloques. Uno, su veredicto, y el siguiente:

1. beta ← `f9e11263` + desplegar `bank-sync` (**OK suyo ya dado**). Comprobar **en vivo** que su
   CaixaBank trae movimientos (campos `truncated`/`transactionError`, sin 5xx).
2. Con su veredicto → beta ← `8c70d897`.
3. Con su veredicto → beta ← `73bb3ca5`. La IA remota sigue apagada hasta que él vea el coste.

Si algo se rechaza, se arregla en ESE eslabón y se recoloca lo de arriba. Las tandas que él
aprueba se BORRAN del array de notas; las que no, se quedan.

---

## 1. ESTADO AL RELEVAR

| | |
|---|---|
| producción (`main`) | **4.23.1** `c34fe81c` — sin tocar todavía |
| beta | **4.24.4** `641c1244`, publicada y **APROBADA** |
| veredictos 16/9 06:50Z | ✅ `4.24.4/ajustes-no-bucle` 2 ok/0 fallos · ✅ `4.24.2/inicio-offline-2` 2 ok/0 fallos |
| promote listo | `promote/4.24.5` `e82e43c2` — doble verde, sin empujar |
| APK | 46 (4.20.4). 4.24.x es solo cliente: viaja por OTA, no toca el nativo |
| Edge | nada desplegado hoy. Pendientes: `ingest` (tras el promote) y `bank-sync` (con 4.25) |

---

## 2. LO QUE SE APRENDIÓ HOY (y no se puede perder)

- **4.24.4 no bastaba: el bucle de Ajustes tenía otra puerta.** La reapertura devuelve el panel a
  la misma altura con `scrollTop=y`, y eso dispara `scroll` igual que un dedo → renovaba la marca
  y borraba `_betaPanelReabierto`. Ahora la marca la pone `pointerdown`. Está en la memoria
  `panel-beta-reabre-ajustes`.
- **PENDIENTE (hallazgo 2, no bloquea):** en e2e la reapertura automática abre AJUSTES pero el
  panel **no llega a montarse** — el `setTimeout(0)` que dispara `mc-open-beta-review` corre antes
  de que `SettingsPanel` registre el listener. Si en su móvil pasa igual, la mitad «vuelve al
  panel y a la misma altura» (10/9) nunca ha funcionado. Mirarlo con calma.
- **⚠⚠ Un test estaba VERDE POR LA RAZÓN EQUIVOCADA y solo lo destapó el promote.**
  `inicio-offline` → «release-notes falla: panel beta usa la cabeza cacheada»: abortaba la ruta de
  `release-notes.json`, pero **el SW la tiene precacheada, así que `page.route` no corta nada**; y
  sembraba `_rnHead_4.24.2` cuando en e2e `CONFIG.APP_VERSION` es **«dev»**. Lo que lo ponía verde
  era el texto de la tanda REAL en el JSON del repo. Al colapsar la ronda para producción ese
  texto desapareció y saltó el rojo. Arreglado en `e82e43c2`: SW bloqueado en ese caso, clave
  derivada en caliente, texto que solo existe en localStorage, y se comprueba que
  `RELEASE_NOTES` se quedó en UNA entrada. **Moraleja para revisar tests de red: si hay SW por
  delante, `page.route` miente.**
- **`servidor-al-dia` compara FECHAS, no SHAs.** Resuelta la duda de si desplegar `bank-sync`
  arrastraba un mes de `_shared`: **no**. Solo `bank-aspsps` (43 d) y `prices` (52 d) van
  atrasadas; `bank-sync` no sale en la tabla, así que su copia desplegada ya lleva `_shared`
  reciente y el delta real es lo de la tanda.
- **Dos runners a la vez = rojo de infra con firma conocida** (`ERR_CONNECTION_REFUSED :4202` en
  cascada tras N verdes). Pasó dos veces hoy. Una suite a la vez EN LA MÁQUINA, avisando por el
  buzón, aunque el puerto vaya por cwd.

---

## 3. REVIEW DE 4.25 (hecha por Claude, para que no se repita)

Revisada entera: Edge, cliente, notas y tooling. Todo aplicado por Codex.

- **Verificado el riesgo gordo:** `bank-sync` se despliega a PRODUCCIÓN y lo recibe también el
  cliente 4.23.1, que no se actualiza. El nuevo `date_from` (mes UTC − 8 d) coincide **a
  granularidad de día** con el `som` de `importObExpenses` de producción (mes de Madrid − 8 d).
  Sin agujero para la familia.
- **Compat de `deadLinks`:** comprobado contra `origin/main` que `histFlattenHistoryLinks` recorre
  `accounts`; con `accounts: []` no hay candidatos, filas ni banco de filtro. **No hay banco
  fantasma** en producción.
- **Queda propuesto, sin hacer (no bloquea):** un guardián de tres líneas para que
  `run-tests.mjs` no pueda saltarse en silencio un test. Ahora enumera él los ficheros
  (`readdirSync` + filtro `.spec.mjs`) en vez de dejar que Playwright descubra; hoy coincide
  clavado, pero el `testMatch` por defecto también coge `*.test.mjs`: el día que alguien escriba
  `e2e/loquesea.test.mjs`, se saltaría **en silencio y con la suite en verde**.
- **Para el inventario, no para hoy:** `bank-aspsps` lleva 43 días sin desplegar y es la que lista
  los bancos al conectar uno.

---

## 4. NORMAS QUE ÉL REPITIÓ HOY

- Review = tests **afectados + CI**; el autor pasa la suite completa local + `TZ=UTC`.
- Plan y voto antes de picar; worktree propio con `npm ci`; **una suite a la vez** en la máquina.
- La fuente es `src/modules/*.js` — `build-app` ensambla `public/index.html`.
- **Ningún paso del panel puede dejarle fuera de la app con el panel abierto** sin decirle cómo
  salir. El paso 1 de 4.24.4 lo pide (es el único modo de probar el bucle), así que lleva escrito
  el rescate: «entra en Revisar la beta y pulsa ‹ Ajustes: eso lo corta en seco».
- Escribir poco.
