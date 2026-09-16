# EMPIEZA AQUÍ — 16/9/2026 (él teletrabaja: sesión larga)

Traspaso de la sesión del 15/9 (tarde-noche, cerrada ~20:40Z). Rama de este fichero:
`docs/traspaso-15-9-noche` (encima de `fd31aa20`). Todo lo «verificado» se comprobó por EXIT real,
por contenido o en vivo.

---

## 0. ARRANQUE (desde la RAÍZ `E:\Mi cartera`)

    npm run salud
    node scripts/errores.mjs --kind=beta --since=24h --json      # leer ENTERO, con `detalle[].nota`
    node scripts/errores.mjs --kind=feedback --limit=20
    node scripts/errores.mjs --kind=hist
    node scripts/errores.mjs --kind=ingest_skip --since=2d

Buzón: `.claude/canal-equipo/messages/{cursor,codex}` — **arma el watcher AL EMPEZAR** (un Monitor
para las dos carpetas; caduca a los 30 min, re-armar). Mensajes con hora REAL (`date -u`).

## 1. ESTADO AL CERRAR

| | |
|---|---|
| producción (`main`) | **4.23.1** `c34fe81c` (sin cambios hoy) |
| beta | **4.24.3** `fd31aa20`, publicada (CI completa verde) |
| veredictos | ✅ **4.24.1** balance-ingresos · ✅ **4.24.3** banco-espera-nube · ⛔ **4.24.2** inicio-offline-2 |
| en curso | **4.24.4** (Cursor): el panel de beta reabre Ajustes para siempre |
| congelado | Codex 4.25 bancos+tooling · 4.26 categorías · 4.27 ayuda (ramas en origin/local, SIN beta) |
| Edge | nada desplegado hoy. Pendientes: `ingest` (4.24.1) y `bank-sync` (4.25, **OK suyo dado**) |
| BD | 3 filas suyas marcadas `ob:trade_republic#dup` a mano con su OK (ids en la memoria `movil-viejo-repite-movimientos`) |

## 2. LO PRIMERO MAÑANA, POR ORDEN

1. **Su rechazo de 4.24.2 — «se abre todo el rato Ajustes».** Causa (Claude y Cursor por separado):
   `BetaReviewPanel` al montar reescribe `_betaPanelAbierto` y `11-app-main` reabre Ajustes si la marca
   tiene < 2 h → cada reapertura renueva la marca; solo «‹ Ajustes» del panel la borra. El paso 2 de
   4.24.2 le hizo salir con el panel abierto. Atajo dado: Ajustes → Revisar esta beta → «‹ Ajustes».
   **4.24.4 (Cursor, votado):** reabrir no renueva; cerrar Ajustes o el panel olvida; último veredicto
   olvida; máx. una reapertura; e2e que fallen con el código viejo; notas sin tandas de 4.24.1/4.24.3
   y re-preguntar solo el paso 2 de 4.24.2 reescrito. Preguntarle si el atajo funcionó.
   Review de Claude = afectados + CI (norma nueva, abajo) → FF a beta.
2. **Con 4.24.4 aprobada: PROMOTE 4.24.x a producción** como 4.23.1 (`promote-4-19-106-como-se-hizo`:
   FF o `-s ours`, cabeza `[skip ci]`, nota única `tandas:[]`, `deploy.yml` a mano, verificar `/Aely/`
   y puente) **y después Edge `ingest`** (lleva `ingest_skip` + `clasificarConMotivo` de 4.24.1) con su OK.
3. **4.25 de Codex a beta + desplegar `bank-sync`** (su OK ya dado hoy). Rama
   `origin/codex/bancos-historico-caixa` `6a3aea64` (fuente = `b6ff6d39`, VERDE ejecutando de Cursor
   27/27 local+UTC; pareja completa 298/298 Madrid+UTC sobre la pila). Rebasear encima de 4.24.4,
   pasos del panel probables TRAS el despliegue, `gh workflow run supabase.yml --ref beta -f funcion=bank-sync`,
   comprobar en vivo (campos `truncated`/`transactionError`, sin 5xx) y que su CaixaBank trae movimientos.
4. **4.26 categorías personales** (Codex; revisada leyendo por Claude: bien) y **4.27 asistente de
   ayuda** (local sí; la parte IA va APAGADA con `AELY_HELP_AI_ENABLED` y la función sin desplegar
   hasta que él vea el coste). Publicar por bloques, no cuatro tandas de golpe.

## 3. DECISIONES SUYAS DE HOY

- **Review = tests AFECTADOS + CI del SHA.** El autor pasa la suite completa local + `TZ=UTC` tras el
  commit; el revisor ejecuta afectados + guardianes y lee el diff. Rojo o código cambiado → completa.
- **`bank-sync` se despliega con 4.25 en beta.**
- Las 3 filas duplicadas se marcaron «posible repetido» (no borradas).

## 4. LO QUE SE APRENDIÓ (y está en la memoria)

- El «+18,09» no era el banco: una **web 4.18.25 con estado de 3 días** sincronizó antes del pull y
  resubió «Movimiento» ya renombrados. Se vio con `created_at` + `ping` del mismo segundo.
  Arreglo 4.24.3 (aprobado): el banco espera a la nube.
- Re-marcar repetidos desde el móvil **ya estaba descartado** (comentario B09-D de
  `syncCloudExpenses`). Leer los «AQUÍ NO VA…» antes de proponer. Rama `wip/gemelo-red-a` = NO integrar.
- El doble de Supabase de los e2e compartía cadena entre consultas: ahora una por `from()`.
- Puerto e2e por checkout desde el 10/9; aun así, una suite a la vez (rojos de carga).
- Un worktree sin `node_modules` da «No tests found / two versions of @playwright/test»: `npm ci`.
- Codex con Edge veía `indicador-arco` rojo; con el Chromium de Playwright, verde.
- **Un paso del panel que le hace salir de la app con el panel abierto = Ajustes pegado** (hasta 4.24.4).

## 5. LO DEMÁS (sin cambios): `docs/BACKLOG.md` y `EMPIEZA-AQUI-2026-09-16.md` §6.
Pendiente viejo: mirar `myinvestor_links.updated_at` (pg_cron del keepalive).
