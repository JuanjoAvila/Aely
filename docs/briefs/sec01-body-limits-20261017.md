# SEC-01: port de entradas de once funciones, candidata privada

GO causal `d0c6134774cacfaa8c0dfc1fb5503d06ea821111`. Rama propia desde
PR249 `536882888eacc70921e462ab98e27620f613a29b`, cuya rama se conserva congelada.
No desplegado, sin PR ni resultado de cierre todavía. El claim original sigue abierto.

Se incorporan únicamente entradas de bank-aspsps/connect/disconnect/sync/callback,
categorize, delete-account y las cuatro MyInvestor. El lector cuenta bytes mientras llegan, cancela al exceder
y rechaza UTF8/JSON/forma inválidos con400 o tamaño con413. Los límites aprobados son
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
no se presenta ese diff heredado como implementación propia SEC01. Sin push, PR o result
durante el hold. Esperar turno de publicación del coordinador.

Ingest/help/prices,09/hoja,VERSION,catálogo,caps y oráculos ajenos están intactos. No suite,
CPU6,Gradle,SQLvivo,bancos reales,deploy ni móvil. La documentación central de despliegues
se actualizará al integrar la fuente completa; este brief no acredita servicio vivo.
