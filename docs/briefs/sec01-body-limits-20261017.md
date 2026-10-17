# SEC-01: port de entradas de once funciones, PR256 y remates privados

GO causal `d0c6134774cacfaa8c0dfc1fb5503d06ea821111`. Rama propia desde
PR249 `536882888eacc70921e462ab98e27620f613a29b`, cuya rama se conserva congelada.
PR256 draft entregada en `0cd215b0cf6ab30a38bf2324e5b99618a9d34c28` y result original
`f49adc1fce258a920081d0838c887907336b17ac` cerrado e inmutable. No desplegado.
La sucesora `sec01-pr256-callback-redirect-docs-remates-codex-20261017` mantiene al
mismo titular y PR; claim nuevo `4fb5a77c549cabd3aafd65f8a491087686659e41`,
ACK `317eef820d570b2d7b603893774b4bfb73d09d5b`, abierto durante estos remates privados.

Se incorporan únicamente entradas de bank-aspsps/connect/disconnect/sync/callback,
categorize, delete-account y las cuatro MyInvestor. El lector cuenta bytes mientras llegan, cancela al exceder
y rechaza UTF8/JSON/forma inválidos con400 o tamaño con413 en las rutas JSON;
callback devuelve302 de error cerrado, según el remate aprobado debajo. Los límites son
16KiB para bancos,32KiB sync,64KiB credenciales,8KiB categorize y1KiB callback.
delete-account declara `verify_jwt=true`: la falta anterior de sección no demuestra
un bypass, porque el gateway exige JWT por defecto y el handler reautentica.

El orden aprobado se conserva: callback cuotaIP → entrada → state válido → cuota usuario
→ consumo/canje. El resto valida entrada antes de auth/cuota/efectos. Un callback con
body inválido termina antes del lookup incluso si el state resultara caducado; un GET
sin cuerpo con state caducado sigue302. El límite IP conserva su rechazo302 anterior.
No se modifican umbrales, guards de reconexión, cursores ni contadores. Dos aserciones
de tipos en bank-sync conservan la misma selección de acks/aspsps tras leer unknown.
Categorize conserva su error400 `merchant` y el recorte legítimo de120 caracteres.

Baseline nueva antes del fix: Deno52 casos,15PASS/37FAIL, EXIT1. Tras el port:52PASS,
EXIT0; lector puro4PASS. El ajuste posterior de texto400 se verifica con7 casos Deno
de categorize y17 grupos Node. La comprobación Deno real de ciclo de vida pasa16 casos
tras corregir únicamente dos anotaciones TypeScript. No se atribuyen los fallos iniciales
del arnés/typecheck a rojo causal. Los logs privados conservan cada ensayo.

Once mutantes detectados por aserciones: quitar lectura acotada, medirUTF16,
quitar cancelación, ignorar tamaño anunciado, ignorar forma, interpretar JSON roto como{},
consumir state antes de validar, quitar auth, validar después del proveedor,
quitar configuración JWT y rechazar el límite exacto. El mutante de userInitiated queda
pendiente de la fase MyInvestor autorizada. Se conservan los oráculos financieros.

Los arneses Node que quitaban imports ahora cargan el lector real dentro de un cierre;
no se sustituye por una respuesta siempre válida. Ejecuciones locales Node usaron un
adaptador privado con el parser TypeScript nativo porque no hay esbuild instalado en el
checkout; no se atribuye una ejecución del runner estándar. Los focos de cuotas, paginación,
progreso, reconexión, carreras, categorías, seguridad y mapas pasan. Privacidad completa
quedaEXIT1 por dependencia `@sentry/browser` ausente; sus demás casos terminaron, sin
instalar dependencias ni utilizar node_modules de otro checkout.

## Fuente MyInvestor incorporada sin sustituir sus guards

Result finalPR252 `ba68ab652ad7ce1f3da7a46b5e73ba6541299a3e`, fuente final
`3544dd35ffcf4b6cc81342eace87770ff2e83a3b`, recibidos completos bajo instrucción
del coordinador. Merge normal `59d1b59255f4564c4c3b24d434285beb2d8ce83b`, padres
`7b7b0f9d3f9242a71fa6c539a3b1dee8c8453072` y `3544dd35ffcf4b6cc81342eace87770ff2e83a3b`.
Único conflicto en permisos/selección de argumentos Deno del runner, resuelto conservando
las dos entradas de tests SEC01 y los permisos/argumentos de carreras OPS08. Las siete
fuentes bancarias y el lector de bytes quedaron intactos: no se repitieron52+4+16 ni los11
mutantes bancarios por el solo merge. Las ramas congeladas permanecen intactas.

Baseline MyInvestor nueva antes del fix sobre el merge:30casos,10PASS/20FAIL, EXIT1.
Final32casos nuevos PASS: rechazo antes de auth/cuota/recifrado, transporte real00-core,
true/false/ausencia de body, OTP numérico/parcial/null, storeTokens y formas inválidas.
La prueba semántica comprueba la tercera caducidad manual y que false/ausencia no suman.
Regresión inicial conjunta:79PASS/1FAIL; el caso previo del cliente que manda `"true"`
exige que siga siendo automático. Se corrigió el validador, no el oráculo: corrección
focal1PASS; los otros21contadores y27carreras quedaron verdes en la ejecución anterior.
Doce mutantes nuevos muertos por aserción, incluida intención manual perdida, objeto
cerrado a{}, OTP numérico rechazado, auth retirada, parseo tras cuota/recifrado, topes
y coerción indebida de `"true"` a manual. No se hereda el verde del titular OPS08.

Los Node focales de keepalive/sync/emisor pasan con el adaptador nativo privado; los
cuatro handlers MyInvestor pasan la comprobación de tipos Deno cached-only/no-run.
Los arneses de carreras/contadores cargan ahora el lector real, conservando sus oráculos.
`myinvestor-refresh-save.ts`, `token_store.ts` y `myinvestor.ts` conservan exactamente la
fuente aprobada3544dd35. Solo se añaden los imports/guardas y se cambia la lectura del
body en connect/sync. No cambian CAS, contadores, cuotas, timeout ni telemetría.

Se conservan los rojos originales de main y la incompatibilidad de PR211 por separado.
La candidata incluye por ascendencia las fuentes aprobadas PR249/PR252 y sus documentos;
no se presenta ese diff heredado como implementación propia SEC01. La primera entrega
se hizo en turno serial; el primer rechazo non-fast-forward y la reevaluación expresa
posterior permanecen preservados. Esta fase no repite ni publica esa entrega.

Ingest/help/prices,09/hoja,VERSION,catálogo,caps y oráculos ajenos están intactos. No suite,
CPU6,Gradle,SQLvivo,bancos reales,deploy ni móvil. Este brief no acredita servicio vivo.

## Remates de la revisión independiente sobre 0cd215b0

GO `cb8c56a979b663a3b167618af8a1f9bb4c5d4603`: solo cuerpo inválido de callback y
tabla de límites existentes por función en `docs/SETUP-SUPABASE.md`. La salida inválida
reutiliza el302 de error cerrado ya existente: web `?bank=error&msg=error`, APK
`back.html?msg=error`. No expone JSON, cuerpo ni query OAuth; no añade diagnóstico.
Se conserva cuota IP → lectura acotada → lookup/state válido → cuota usuario → canje.
Ningún cambio al lector, topes, otros handlers, CAS/contadores de PR252 o guards de PR249.

ROJO causal contra handler/lector exactos de `0cd215b0`, con las nuevas aserciones:
5PASS/12FAIL, EXIT1. Tras sustituir solo la respuesta inválida:17PASS/0FAIL, EXIT0.
Comando focal: `deno test --no-config --no-lock
--allow-read=supabase/functions,supabase/config.toml
supabase/functions/_shared/input_handlers.test.ts --filter '/callback/'`.
Los43casos ajenos quedaron filtrados. Web/APK cubren JSON roto, null/array, tamaño real
y anunciado, UTF8 inválido, stream cancelado antes del lookup, límite exacto admitido,
GET y destinos válidos; se conservan los controles de cuota IP/usuario y state caducado.
Un mutante aislado que restaura JSON400/413 muere con las12aserciones runtime, EXIT1
(5PASS/12FAIL); no fallo de tipos. No se repite la campaña anterior de23mutantes.
`deno test --cached-only --no-run --no-config --no-lock
supabase/functions/bank-callback/index.ts`: EXIT0, tipos, no ejecución real del banco.

Se consultaron changelog y documentación de estados HTTP de Supabase; los3xx de
`Response.redirect` están contemplados para flujos de autenticación
([referencia](https://supabase.com/docs/guides/functions/status-codes)). El aviso TLS
del12/10 no cambia este protocolo de respuesta. Los tests ejecutan el handler y lector
reales con SDK/RPC/proveedor/cifrado sintéticos y sin permisos de red/entorno.

Fuente privada pendiente de turno serial para actualizar la misma PR256 y publicar
el result nuevo. No fetch de canal, anuncio de presupuesto, push ni PRupdate en esta fase;
ledger propio10/12, quedan2, sin reset/herencia. SEC03 sigue separado; ABA/schema fuera.
Claude conserva revisión/integración249→252→256→SEC03 en beta140 y despliegue. CI general,
docs-frescura, beta-sources, servicio vivo y aceptación móvil pendientes; privacidad completa
sigue con el EXIT1 previo por dependencia Sentry ausente. Sin ProductREADY.
