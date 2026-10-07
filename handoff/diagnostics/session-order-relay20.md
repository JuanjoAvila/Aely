# Orden de sesión inicial — SDK vendorizado real, fuente cacc2a0d

Tarea `inc-0710-initial-session-order-claude-relay20`. Sin cambio de producto, versión ni entrega.
Reproducir: `node handoff/diagnostics/session-order-relay20.mjs salida.json` (Node 22, sin red ni cuentas).

Ejecuta `public/vendor/supabase.min.js` (supabase-js 2.110.0) **tal cual**, con sesiones, almacenamiento y
transporte (`fetch`) inventados, y los fragmentos exactos `cloud.session`, `cloud.onAuth`, el efecto de
montaje de `11-app-main.js` y `mcScheduleIdle` extraídos del fichero (hashes en el JSON). Se repite sin y con
un `navigator.locks` sintético FIFO. Un envoltorio solo anota el orden (evento SDK / resolución de
getSession) antes de entregar al consumidor; no altera la semántica.

## Conclusión: CONFIRMADO, pero con una ventana mínima (no alcanzable desde la UI)

El SDK real SÍ puede producir `SIGNED_IN B` y después la resolución tardía de `getSession()` con A,
dejando `sessionRef=A` y una segunda solicitud de sync para A (`login-B-during-boot-with-A-stored`, con y sin locks):
`INITIAL_SESSION:A > SIGNED_IN:B > set:B > sync:B > getSession→A > set:A > sync:A`. Causa: `getSession()` espera
`initializePromise` y luego la cola de lock; el `signInWithPassword` emitido en el mismo arranque entra y emite antes
de que continúe la continuación de `getSession`.

Barrido de causa: con `signIn(B)` lanzado tras k microtareas del montaje, A tardía ocurre para **k ≤ 3** y no para k ≥ 4
(igual con y sin locks). La ventana son microtareas dentro del mismo turno: exige un login programático en el
mismo tick del montaje con A ya guardada. Un toque del usuario, la respuesta de red o el retorno de enlace mágico
quedan fuera.

Controles (todos terminan con la referencia correcta): arranque con A guardada, sin sesión, token caducado con refresh,
login lento solapado con el arranque (getSession ya resolvió A antes: B gana), cambio A→B tras el arranque,
signout, login sin sesión previa, retorno de enlace mágico B con A guardada (la URL se procesa dentro de
`initializePromise`, así que getSession ya devuelve B; el orden interno de esta fila varía entre ejecuciones, el final siempre es B).

Hechos del SDK útiles al consumidor (orden real observado): con sesión guardada llega primero `SIGNED_IN` (o
`TOKEN_REFRESHED` si caducó) y luego `INITIAL_SESSION`, ambos ANTES de que resuelva `getSession`. `INITIAL_SESSION`
siempre se emite, así que la rama `getSession().then` es redundante como fuente de verdad. Además, al arrancar con
sesión se solicita sync dos veces para el mismo usuario (evento + idle de getSession): comportamiento actual, no probado como daño aquí.

## Riesgo y guarda mínima propuesta (sin implementar)

Riesgo práctico bajo; no hay vía de UI. Si se quiere cerrar igualmente: en el efecto, una variable local `authSeen`
que `onAuth` pone a true, y en el `.then` de `cloud.session()` volver tras `clearTimeout` (sin `sessionRef`,
`setSession` ni sync) cuando `authSeen` sea true. No cambia login/switch/signout ni la decisión de identidad en `onAuth`.
Separado del defecto de disposal (cleanup/unsubscribe): puede ir en el mismo bloque de 11-app-main.js pero con su propio guardián.

Cobertura/alcance: este bloque y `onAuth` no están cubiertos por los selectores actuales (hallazgo previo: 0/31). Un
fix necesita su guardián en `steps` de `run-tests.mjs` y alcance propio; este diagnóstico no es ni sustituye eso.

## Límites

Sin navegador ni móvil: `navigator.locks` es sintético y `fetch` inventado. No mide rendimiento ni demuestra
INC-2709-09; la navegación ordinaria no remonta. Cero escrituras reales; `syncFromCloud` no se ejecuta (solo espía).
