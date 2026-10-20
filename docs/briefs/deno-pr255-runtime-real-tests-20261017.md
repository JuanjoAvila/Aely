# PR255: runtime existente y pruebas Deno reales

Candidata privada bajo `deno-pr255-runtime-real-tests-remates-codex-20261017`,
grant Claude `2f4ca4701141736aa098902cbeaac5905c4b2d0e`, sucesora5397e1b9.
Base de producto `f7bba04d983c55cf97043594b6e13d9f5b652a84`, misma PR255.
El result anterior77423905 y su fuente se conservan inmutables. Sin push de estos
remates, actualización de PR ni nuevo result durante la fase privada.

## Runtime y selección

Se verificó Deno2.9.0 existente en el perfil, fuera de PATH; V8
14.9.207.2-rusty y TypeScript6.0.3. El SHA256 del binario es
`906a1ed48c754ceb91dd2192baaec0e2226b64291b99b630fe0a0a080537def8`.
No se descargó ni instaló runtime. El informe anterior acreditaba ausencia en
PATH, no ausencia de una instalación en el perfil.

El runner prueba PATH primero. Solo un `ENOENT` abre el fallback:
`AELY_DENO` absoluto, si está configurado; en otro caso, los perfiles
`USERPROFILE` y `HOME` más `.deno/bin/deno[.exe]`, sin duplicar la misma ruta.
Una configuración inválida/inexistente falla expresamente; no cambia al perfil
para tapar ese error. Tampoco tapa errores, señales o permiso denegado en PATH.
Usa argv literal, `shell:false`, y registra ejecutable, versión, intentos y tiempos.

Todas las pruebas usan `--cached-only --no-lock --no-prompt`: las dependencias
deben existir ya en caché, no se crea lockfile y ningún permiso se concede por
un diálogo. Los permisos por archivo anteriores se conservan: env solo en crypto,
lectura acotada a `supabase/functions` solo en myinvestor-counter; el resto sin
permisos de acceso. Ningún archivo recibe allow-net/run/write.

## Main exacto y ejecuciones

Una única lectura de fuente main, expresamente admitida y contada en OWN12,
confirmó `a9916c3cdb21c93f9d3a47653c0608e630ce50ab`. Se creó un checkout
aislado de ese SHA. Se inventariaron sus diez Deno con blob Git, SHA256 y argv.
No se incorporó producto de otra rama. No existe myinvestor-token-race en esa
fuente: PR252 no se fusionó ni se inventó cobertura para ella.

Cada archivo se invocó por separado y en serie con el runner focal, conservando
su stop al primer fallo. El entorno del proceso se redujo a rutas del sistema y
caché; los servicios son fixtures sintéticas. Las fuentes main quedaron limpias.

| Archivo bajo `supabase/functions/` | Casos aprobados | EXIT efectivo | Duración ms |
|---|---:|---:|---:|
| `_shared/crypto.test.ts` | 2 | 0 | 911 |
| `_shared/enablebanking.test.ts` | 21 | 0 | 605 |
| `_shared/myinvestor-counter.test.ts` | 22 | 0 | 1043 |
| `_shared/myinvestor.test.ts` | 11 | 0 | 608 |
| `bank-disconnect/lifecycle.test.ts` | 16 | 0 | 8979 |
| `bank-sync/demand-window.test.ts` | 11 | 0 | 1025 |
| `delete-account/delete-account.test.ts` | 3 | 0 | 501 |
| `ingest/ingest.test.ts` | 15 | 0 | 493 |
| `ingest/widget.test.ts` | 9 | 0 | 587 |
| `prices/prices.test.ts` | 21 | 0 | 561 |

131 casos aprobados en diez archivos. Suma de ejecuciones válidas:15313ms.
Tiempo realizado incluyendo el intento fallido y el overhead del primer lote:
15648ms. No es una sola pasada cronometrada de la suite general.

Se conserva el primer lote:9 archivos EXIT0 y lifecycle EXIT1 antes de ejecutar
casos, en6669ms. Deno buscaba `npm:@types/node` en un node_modules local ausente.
La ayuda del runtime confirma que `--node-modules-dir=none` usa la caché global,
sin instalar ni usar node_modules ajenos. Solo ese archivo añade la opción y se
vuelve a invocar:EXIT0,16 casos,8979ms; su prueba de proveedor colgado tarda8s.
No se usa `--no-check`, no se descarga el paquete y no se repiten los nueve verdes.

## Contratos nuevos y mutaciones

Antes del cambio, los siete contratos de fallback dieron EXIT1:6FAIL/1PASS.
Tras el cambio, siete nuevos más seis contratos anteriores afectados por la
sonda/argv dan13PASS/EXIT0. Los dos contratos antiguos de selección inválida e
inventario ilegible no se repiten porque no cambia su ruta.
La opción de caché de lifecycle tiene su propio rojo y verde:1FAIL/EXIT1 antes,
1PASS/EXIT0 después. Son14 contratos distintos verificados en estas dos pasadas.

Seis mutantes nuevos salen1 usando solo los ocho contratos nuevos:
quitar fallback de perfil, ignorar AELY_DENO, tapar runtime roto, perder el
ejecutable resuelto, permitir descargas y omitir typecheck. Los seis mutantes
de la entrega anterior permanecen como evidencia anterior; no se repiten.

## Límites

Solo cambia tooling/tests/documentación de PR255. No se modifica el bloque Deno
general ni los workflows: Claude decide la integración con estos tiempos.
No suite general Node/E2E/CPU6, Gradle/APK, SQL vivo, bancos reales, deploy ni
main/beta push. No09/hoja, VERSION, catálogo, caps u oráculos. Esta prueba local
real de Deno no acredita CI, integración, artefactos servidos ni aceptación móvil.
La siguiente entrega pública requiere otro turno serial; el claim sucesor sigue
abierto. Presupuesto:OWN10 cerrado10/10; OWN12 usado4/12, de los cuales solo uno
se usó en esta fase para leer main. Cero lecturas del canal durante la fase privada.
