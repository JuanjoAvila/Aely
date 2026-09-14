# EMPIEZA AQUÍ — sesión siguiente al 15/9/2026 (madrugada)

Traspaso de la sesión del 14/9 (tarde-noche). Producción pasó de **4.21.2 → 4.23.1**, con la
migración **0024** y las tres Edge de **SEC-01** desplegadas. Todo lo marcado «verificado» se
comprobó por contenido o en vivo, no por el verde de Actions.

---

## 0. ARRANQUE (desde la RAÍZ `E:\Mi cartera`, no desde un worktree)

    npm run salud
    node scripts/errores.mjs --kind=beta --limit=20
    node scripts/errores.mjs --kind=feedback --limit=20
    node scripts/errores.mjs --kind=hist
    node scripts/errores.mjs --kind=ingest_skip --since=2d     # NUEVO: descartes de ingest

⚠ **Lee la salida ENTERA de `--kind=beta`**: el 14/9 un `| tail` escondió su aprobación de 4.22.2
y le dije que no había veredicto.
Buzón con Cursor: `.claude/canal-equipo/messages/cursor` (gitignored). **Arma el watcher AL EMPEZAR.**

## 1. CÓMO SE TRABAJA (lo que costó caro el 14/9)

- **Plan → voto de Cursor → picar → review EJECUTANDO en worktree del revisor → beta.**
- **UNA sola suite con e2e a la vez EN LA MÁQUINA.** Todos los worktrees comparten
  `127.0.0.1:4237`. El 14/9 salieron 13, 49 y 164 e2e rojos, todos `ERR_CONNECTION_REFUSED`, por
  correr Cursor y yo a la vez. Avisar por el buzón «corro suite en X» y esperar «libre».
- **La fuente es `src/modules/*.js`.** `build-app` ensambla `public/index.html` y `npm test` pisa lo
  editado a mano ahí. Los tests de lógica leen el `public/index.html` COMPILADO: compilar antes.
- **La suite, DESPUÉS del commit y con `git status` limpio.** Un arreglo commiteado detrás del bump
  tumba `docs-frescura`; y `public/release-notes.json` va en el commit (se me olvidó en 4.23.1).
- **`supabase/functions/**` también exige bump** (`docs-frescura`): servidor y cliente de una misma
  tanda van en UNA versión.
- Ediciones con Edit/Write o con un `.mjs` escrito con Write. Los heredocs desde Bash comen `\`.
- `TZ=UTC npm test` además del local. Beta sin preguntar; main solo con su OK.

## 2. ESTADO AL CERRAR

| | |
|---|---|
| producción (`main`) | **4.23.1** (`c34fe81c`). `/Aely/` y el puente `/Mi-Cartera/` sirven 4.23.1 (verificado) |
| beta | **4.23.1**; Cursor sube **4.24.0** (`762bfc39`, Inicio sin internet) tras mi VERDE (268/268 local y UTC) |
| APK | **46** en la calle; los dos `apk.json` = 46 |
| BD | migraciones **0001–0024** aplicadas. **0024** verificada en vivo (grant `device_id` de MyInvestor + revokes) |
| Edge | `bank-callback`, `ingest`, `myinvestor-keepalive` con SEC-01 (probadas en vivo: `eb_error`, 403, 401) |
| en rama sin publicar | **4.24.1** `7dfe0183`, rama `tanda/bugs-4241` (origin): bug 2 + servidor del bug 3 |

## 3. LO DE HOY, CERRADO

1. **4.22.3 a prod**: cuotas de meses pasados + «Es la cuota de…» + nit de Cursor (alias antes del
   corte por categorías neutras).
2. **OPS-06 BD viva**: RLS y políticas = repo. Bug real: la 0012 constaba y su grant NO estaba →
   MyInvestor no sincronizaba solo. **0024** lo repara. Guardián `grants-migraciones`.
3. **SEC-01 (4.23.0 → 4.23.1 en prod)**: `bank-callback` solo devuelve códigos; el cliente y
   `back.html` nunca pintan el texto de la URL; `ingest` con topes (413, recortes);
   `timingSafeEqual` en `_shared/entrada.ts`. Test `entrada-edge` + e2e `bank-callback-msg`.
4. **DEC-01 decidido por él**: instalador de **Play Store, pero lo ÚLTIMO**; hasta entonces se sigue
   actualizando por nuestro canal. No tocar el instalador propio.

## 4. LOS 4 BUGS QUE LEVANTÓ EL 14/9 (con capturas)

| # | Bug | Quién | Estado |
|---|---|---|---|
| 1 | **Widget con valor viejo tras pagar** (abre la app → bien; sale → bien) | Cursor | Plan votado. Pista: comparar `month` de `ingest` (`_shared/presupuesto.ts`) con `monthBudgetStats`; ¿resta ingresos de TODOS los bancos? (su mes: 49,74 € de Sabadell). Si es nativo → APK |
| 2 | **«El balance no cuadra»** | Claude | **Hecho en 4.24.1, sin publicar.** La cifra era correcta (813,84 / 329,12); la FILA pintaba como ingreso los de Sabadell y un traspaso entrante. `expenseBucket` alineado; test de propiedad `bucket-igual-que-balance` (falla con el código viejo); e2e. Separado y SIN hacer: el «+18,09 Juan Jose» de Sabadell es contrapartida de un traspaso de TR — simular contra `expenses` reales antes de picar |
| 3 | **Padre: «1331 BAR» 65,60 € (13/9) no entró** | Claude | Medido: ni fila ni error de nadie; parser OK con ese nombre. No hay más datos (él no puede conseguir la noti). **4.24.1**: `ingest_skip` en app_events por cada descarte + `clasificarConMotivo` (no mira bizum/recibido/transferencia en el comercio; «BAR EL RECIBIDOR» se tiraba). Pendiente: contadores en el lector nativo (próxima APK). El padre apunta a mano |
| 4 | **Sin internet, Inicio = 3 esqueletos eternos** | Cursor | **4.24.0 VERDE**, a beta. Probar: modo avión y abrir la app |

## 5. MAÑANA, POR ORDEN

1. Arranque (§0) + watcher. Leer su veredicto de **4.24.0** si lo hay.
2. **4.24.1** (`7dfe0183`): suite local + UTC con la máquina libre → review EJECUTANDO de Cursor en
   worktree propio → push FF a beta (encima de 4.24.0). La tanda `balance-ingresos` tiene 3 pasos.
3. Tras su veredicto de 4.24.x: promote como 4.23.1 (nota única `tandas:[]`, `[skip ci]`,
   `deploy.yml`, verificar `/Aely/`, puente) y **después** Edge `ingest` (con `ingest_skip`) con su OK.
4. Bug 1 (Cursor) y el traspaso +18,09 (plan con simulación).
5. Mirar `myinvestor_links.updated_at`: que el pg_cron del keepalive siga pasando con la clave buena.

## 6. TODO LO DEMÁS QUE QUEDA (resumen de `docs/BACKLOG.md`, ver detalle allí)

**Dinero e integridad (P1):** FIN-03 identidad de gastos de extremo a extremo (diseño) · FIN-04
decisiones/ediciones entre móviles (parcial) · FIN-05 widget con app cerrada (parcial; se cruza con
el bug 1) · FIN-07 histórico de la nube completo (`pullExpenses` corta en 2000) · FIN-08 daños
históricos previos (investigar) · el 475 del widget por signo volteado de Open Banking.
**Operación y seguridad:** OPS-01 repo vs servidor vivo (3 funciones con `_shared` atrasado según
`salud`: `bank-aspsps`, `prices`, `myinvestor-keepalive` ya al día) · OPS-02 restauración probada ·
OPS-03 beta con varios probadores (15/18 tandas con en/ca en castellano) · OPS-04 métricas ·
OPS-05 higiene de PR/ramas · OPS-06 resto: `localStorage` en claro, SEC-03 qué viaja en
app_events, SEC-02 freno en más Edge (`bank-connect`/`bank-sync`), la «ronda de tortura»
(rendimiento, aporrear botones) antes de Play.
**Experiencia:** UX-01 gestos/scroll entre pestañas · UX-02 tironcillo al abrir Ajustes/perfil
(Cursor) · long-press · la ola nativa de Android bloqueada en algunas pestañas · UX-03 splash e icono
(aparcado) · UX-04 sugerencias · rechazo vivo `guardar-cta` (botón Guardar cortado en letra Normal) ·
aviso «última cuota» que cansa verlo cada día (quitarlo).
**Funciones:** PRO-01 meta financiada fuera del gasto · PRO-03 recordatorio de recibos grandes (falta
una cosa) · PRO-04 informe PDF · PRO-05 push de nueva versión (FCM) · PRO-06 MyInvestor fiable ·
PRO-07 pensiones y ahorro · PRO-08 Hogar con dos usuarios · todas las monedas · importador del
histórico con `cuotaAlias`.
**Técnico/decisiones:** TEC-01 módulos financieros · TEC-02 i18n huérfanas (aparcado) · DEC-01
Play/marca/monetización (Play al final) · compactar memoria cuando crezca.
