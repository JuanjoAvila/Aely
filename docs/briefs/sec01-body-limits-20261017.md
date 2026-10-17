# SEC-01: port de entradas, fase bancaria privada

GO causal `d0c6134774cacfaa8c0dfc1fb5503d06ea821111`. Rama propia desde
PR249 `536882888eacc70921e462ab98e27620f613a29b`, cuya rama se conserva congelada.
No desplegado, sin PR ni resultado de cierre todavía. El claim original sigue abierto.

Se incorporan únicamente entradas de bank-aspsps/connect/disconnect/sync/callback,
categorize y delete-account. El lector cuenta bytes mientras llegan, cancela al exceder
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

## Dependencia antes de completar la entrega

MyInvestor permanece intacto. Esperar el result final de rematesPR252 y autorización del
coordinador para leerlo; después merge normal de su cabeza final en esta rama propia.
Solo entonces incorporar las cuatro guardas restantes y probar emisor real00-core con
userInitiated true/false/ausente, variantes OTP y mutante de pérdida del flag. Los rojos de
main y el hallazgo PR211 que rechazaba ese flag se conservan por separado, no como evidencia
de la fuente futura. No tocar la rama de PR252 ni la de PR249.

Ingest/help/prices,09/hoja,VERSION,catálogo,caps y oráculos ajenos están intactos. No suite,
CPU6,Gradle,SQLvivo,bancos reales,deploy ni móvil. La documentación central de despliegues
se actualizará al integrar la fuente completa; este brief no acredita servicio vivo.
