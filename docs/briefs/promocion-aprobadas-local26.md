# Candidata selectiva99/100/101/102/106 · 8/10/2026

Preparación sobre `main 56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b`, versión candidata4.26.106.
Beta congelada `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5` sirve4.26.106.1.
No acredita merge ni producción. El coordinador serializa revisión, integración y entrega.

## Autorización e identidad

El dueño confirmó directamente las cinco aprobaciones en el chat de auditoría y volvió a
ordenar su promoción y la limpieza posterior del panel en el chat coordinador. La lectura
privada limitada cotejó ID, versión y huella de cada unidad y no encontró revocación posterior.
Las filas carecen de correo: no se usa un `user_id` no nulo como prueba de autor. La fuente
autorizadora es la confirmación humana directa. Sin informes, eventos o identidades personales
en esta acta; los errores ajenos al alcance siguen separados y el lag móvil continúa abierto.

| Unidad | Fuente publicada | Identidad aprobada vigente |
|---|---|---|
| Gastos99, `inc-0710-gastos-mes-madrid` |8e103e90 /4.26.99.1|129f411e:5fc9d11500312761610d07b9e945f5225a04ecdf6610b4ceb79f58cfb443baf6|
| Reentrada100, `inc-0710-appstate-listener-cleanup` |eabf8200 /4.26.100.2|4c00cdc5:5f759191a838c9b71fd8e4569e59d3515b17a44ea466adbd9e8d60b65953e876|
| Avisos101, `inc-0710-banknotif-cleanup` |77b7d5e4 /4.26.101.1|c64f5cf6:44c999c85629a89ed2b21ab1a1b7e78079b7a6658d266ccb2a8c91676970327e|
| Sesión102, `inc-0710-auth-disposal` |6b812796; aprobada en4.26.106.1|d0a9f5dd:443f7eca97d8340fa614ad89d8cc4ba9886b2a362a6268c6816fbcd76f61e57f|
| Recientes106, `inc-0810-dashboard-recents-memo` |8dcc5ed3 /4.26.106.1|732d5518:0ea35f8daf07ce767c88d3ddc3f732a7e6ca4af5ded38dd330f3ea61b45f66aa|

El código102 vigente incluye las dependencias compartidas con106. La identidad histórica
anterior102 no es la aprobada más reciente y no se hereda por número de versión.
[Matriz completa de las cinco unidades y todos los scopes previos](promocion-aprobadas-local26-identity.json).
Cuando la ancla nueva no existe en main, `before` es null con `BETA_SCOPE_ABSENT`; no se recorta
el descriptor para inventar un digest anterior.

## Separación

Los módulos00/03/04/11 coinciden íntegramente con beta aprobada; todos los demás módulos
coinciden con main. El shell entero coincide con beta; desde la primera etiqueta style hasta
el final coincide con main. El único delta adicional es la compactación del encabezado100,
incluida en su fuente aprobada. CSP, preloads y script de tema se conservan.

Cinco scopes nuevos originales. Los28previos mantienen todas sus unidades y auditorías;
sólo Gastos-periodo, Movilidad y Gastos-sin-límite añaden `madridYmdParts` y `_mcMadridYmdFmt`,
el cierre transitivo original99 que exige el guardián. Las revisiones de ocho scopes previos
cambian por las dependencias compartidas seleccionadas: la matriz enumera las unidades
exactas y su digest actual frente a beta. No son ocho aprobaciones nuevas ni entregas
nativas. Los recibos deben representar el código actual, sin fijarlos al baseline anterior.

Android/APK52, Supabase/Edge/SQL, workflows y SW fuente conservados, incluido su inventario
de archivos. No103/104/105/Plan ni widget170. Las217notas anteriores de main permanecen
intactas, con cinco notas familiares es/en/ca originales añadidas y `tandas:[]` en producción.
El perfil virtual previo se sustituye por el A/B de la memoización real de106.

## Gates y artefactos

Comandos focales: build, check-syntax, gastos-mes-madrid, appstate-listener-cleanup,
banknotif-listener-cleanup, auth-disposal/fit, dashboard-memo-instrument,
beta-sources, docs-frescura, relevant-tests, guard-privacy y presupuesto-rendimiento.
`node scripts/verify-selective106.mjs --candidate=SHA` verifica alcance y todo el inventario.
Para el árbol sin commit, omitir candidate. Es un gate de esta promoción específica.

Presupuesto1287KiB/351KiB/3bloqueantes intacto. Node completo, DOM con lease canónico,
revisión independiente y CI exacta deben acompañar el SHA final. Las limitaciones locales
de memoria-espejo, Bash bajo sandbox o Deno se registran aparte; no se silencian en CI.

Verificación local de preparación: build y siete bloques vm.Script PASS; las seis regresiones
focales PASS. Cierre de diez etapas (auth/fit, panel, sintaxis, docs, privacidad, presupuesto,
mapa y notas duplicadas) exit0 en53,8s. Artefacto temporal sellado por los scripts oficiales:
1317787bytes minificados,358972gzip9, siete bloques vm.Script y APP_VERSION4.26.106; bajo
1317888/359424bytes. DOM local sobre a500ffd1/HTMLdf37:116funcionales PASS y4perfiles
A/B CPU6 seriales PASS, sin fallos, omisiones ni flaky. Ocho renders del presupuesto:
baseline8cálculos frente memo0cálculos/8hits con3.000/5.200gastos sintéticos; edición,
alta, borrado, undo, sync y reloj conservan los controles DOM y no sincronizan bancos.
El encabezado100 conserva15elementos/atributos/orden/CSP/viewport/script según DOMParser
real, sin red; sonda retirada. Lease95 liberada expresamente, procesos y puerto4210 a cero.
La primera suite Node sobre WIP cambiante terminó exit1/504,1s; no se atribuye al SHA final.
Tras corregir la metadata de scopes/producción se repiten los guardianes. Supabase-workflow
PASS fuera del sandbox. Docs-frescura-history falla29fixtures en Windows porque Git no admite
el os.devNull configurado como archivo global; memoria-espejo aborta sobre una cifra en
la memoria local ajena, sin escribirla. Deno no está instalado. CI Linux completa sigue obligatoria.

Cierre beta-sources actual exit0:1731dependencias mutadas, closure completo, auditorías,
compatibilidades y mutantes de identidad sin recortes. Verificador completo exit0; contraprueba
con candidate=beta8dcc falla en conservación del historial main, como debe hacerlo una mezcla
entera. Los tests del transporte/auth/fit conservan sus controles rojos anteriores.

CI37820790471 sobre checkout e63c44f2 (treec1c8af1b, exacto a a500ffd1) terminó exit1:
el runner todavía llamaba al instrumento virtual borrado al sustituirlo por memo106.
Su nueva etapa ya pasaba; todas las otras etapas Node y los cuatro ficheros Deno pasaron.
DOM/perf remotos no arrancaron y el paso final de privacidad quedó omitido por ese fallo,
aunque guard-privacy Node pasó. Se retira únicamente el registro obsoleto; el runtime,
las cinco identidades y el HTML local probado se conservan. CI completa nueva obligatoria.

Producción leída4.26.98, recibo fuente56c7e328 y APK4.26.80/code52. Beta publicador37718742824
SUCCESS; ZIPsha256 `7c15e9c9cc5db641053293c22defe1215187232c829248cee5216a37c8febd0a`,
fingerprint `fe89bb7c152a10e8`; catálogo106, cinco códigos y recibo fuente8dcc coinciden.
HTMLAPP_VERSION4.26.106.1 y SW4.26.106.1-2026-10-08-8dcc5ed3 cotejados en el ZIP.
Estos artefactos prueban la beta, no la entrega de esta candidata en producción.

## Retirada beta diferida

[Parche revisable](selectiva106-beta-cleanup.patch), basado exactamente en beta8dcc:
quita únicamente los cinco IDs de todos los arrays tandas, conserva los223objetos de notas
y deja `tandas:[]` cuando se vacían. Conserva todos los otros IDs, incluidas unidades
pendientes y rechazadas, y no escribe ni elimina almacenes de veredictos. Dos regresiones
de metadata pasan a leer el catálogo histórico8dcc para seguir vigilando su identidad
aunque las tarjetas entregadas ya no estén en la cola.

Preview del lector real betaChecklist: con los recibos estables actuales muestra exactamente
las cinco tarjetas; con el recibo web candidato y el mismo APK estable52, tras la retirada
queda a cero. No se afirma esa entrega: es una simulación de los recibos futuros. Los otros
IDs del catálogo histórico quedan literalmente intactos, sin fabricar aceptación nativa/Edge.

**No aplicar hasta entrega real**: revisión/CI/merge/publisher terminal y manifest4.26.106,
bundleZIP, HTML, SW, catálogo y recibo exacto del SHA integrado cotejados. APK/nativo/Edge
conservan gates independientes. Entonces, sobre beta fresca, comprobar el parche con
`git apply --check docs/briefs/selectiva106-beta-cleanup.patch`, aplicarlo y ensamblar.
Si beta incorporó otras tandas, adaptar exclusivamente esas cinco retiradas y conservar
todo lo añadido; nunca forzar el parche. Regenerar release-notes/beta-delivery/index,
probar beta-tandas-vacias, beta-veredictos, beta-sources y revisar-beta DOM. El coordinador
elige el sello beta nuevo sin reutilizar un número ya servido. Publicación beta y comprobación
del panel son posteriores a la producción, no gates sustituidos por este parche.
