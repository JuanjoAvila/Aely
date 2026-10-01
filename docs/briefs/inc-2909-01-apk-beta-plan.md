# INC-2909-01 · Plan de APK exclusiva de beta

Estado vigente1/10: prebuild80/code52 desde26a31f9d PASS, assetbeta602841368 subido y descarga/hash/firma verificados (6.512.756 B,1189545e…87b608). public/apk.json52 ahora apunta a ese asset real. Guiones/guardias intactos, fixtures c9887ab8/2b03894a incorporados. Fuente final80 en preparación: CI exacta y recompilación final con manifiesto52/reemplazo binario obligatorios antes de entrega. Beta77 ya cotejada por root, sin publisher concurrente; no main/Edge/SQL/install. [Acta](inc-2909-01-widget.md#fuente-final80-en-preparación--1102026).

## Historial de planificación previo a parent79

Estado 1/10/2026: **candidata local52 autorizada para compilar/verificar por el nuevo coordinador, sin autorización de subida ni entrega**. Fuente cliente/nativa `821733fc7d65c895e288dba74d4ed412d01b3285`, PR90; 34/34 DOM PASS y **GO independiente de Claude al SHA exacto**, respuesta del 30/9 a las 23:18:28 UTC (1/10 01:18:28 Madrid). Preparación de Panel75 conservada69e7b315; rama aislada de review, VERSION4.26.78 provisional y gradle52. Base definitiva llegará después de UI77/nómina/retirada; no confundir el binario local con su entrega final. Edge fuera. La APK de51641d80 sigue obsoleta.

## Circuito que existe hoy

El coordinador único `01a0f653-42f0-7ed0-80a8-29ed5837b446` revoca la retención de compilación para esta candidata reproducible. Solo `release:apk -- --dry-run`, sin su modo normal, sin subida, sin teléfono y sin main/Edge/SQL. El manifiesto public/apk.json51 permanece intacto hasta tener asset real autorizado; por tanto frescura debe denunciar la divergencia provisional51/52, nunca se relaja esa guardia. Caps mínimos locales1250/341 KiB para los1.279.912/348.560 B medidos, +1/1 sobre75; volver a medir sobre parentfinal y revisar en CI. No se cambia runtime821 ni ACK.

Preparación más reciente sobre Panel75/`569d792234abe76a5597b278c4be8cd0796cb5d7`: VERSION78 provisional, runtime821 intacto y alcances/guardianes75 propios. El injerto74 anterior queda conservado como evidencia, no es la base final. Aún faltan76/77 y gate concreto de base/versión; no compilar ni subir APK. Los recibos del build acreditan solo web; los cinco Java en el registro no prueban un binario instalado.

Preparación local autorizada sobre `a004d16e12a4d8e2bd10462ee54d7a2f3f3f797c` (4.26.74): injerto acotado de fuente821733fc con VERSION4.26.78 provisional, posterior a Panel75/Nómina76/Retirada77. SDK/aapt/apksigner/JBR/Gradle y firma existente comprobados sin copiar claves; WEBDEBUG0 y sin bypass. Esta base no es la integración final y no habilita todavía compilar Android ni subir el candidato.

- `scripts/release-apk.mjs` alinea versionName con VERSION, ejecuta guard-webdebug, apk:prep y assembleRelease, comprueba BuildConfig, aapt y firma, y copia `Aely-VERSION.apk`. Su modo normal crea `vVERSION` con target **main**, como APK de producción: no sirve para esta entrega exclusiva de beta.
- `--dry-run` **sí compila y verifica**; omite subida y escritura de apk.json. No ejecutarlo durante la preparación del plan. `--skip-upload` también compila, pero escribe un manifiesto dirigido a `vVERSION` sin demostrar que existe: tampoco usarlo para beta.
- `.github/workflows/beta.yml` publica en la release fija **beta**, marcada prerelease. Copia public/apk.json al asset apk.json, empaqueta public completo y sella la web como VERSION.N. No compila Android. Borra/reemplaza solo bundle.zip, version.json y apk.json; conserva cualquier APK binario subido a esa release.
- `scripts/huella-bundle.mjs` incluye public/apk.json: cambiar el manifiesto de APK altera la huella y puede publicar una OTA. No es una operación invisible para el canal beta.
- La web (`mcFetchManifest`) elige el manifiesto según el canal local del móvil; el worker nativo OtaCheckWorker recibe ese canal por syncOtaState. Estable consulta Pages, beta consulta la release beta. Un manifiesto beta ausente puede caer a estable; no sustituirlo por un aviso de APK52 sin comprobar qué está servido.

Consulta API realizada para el plan: release beta prerelease, título **Beta 4.26.73.1**, assets apk.json/bundle.zip/version.json, sin APK binaria propia en esa release. Referencias locales cotejadas: beta e6d00dde, main 12884f48; main/public/apk.json anuncia 4.26.32/code48 y esta rama aún conserva 4.26.55/code51. Son un corte de planificación; revalidar remotos y URLs servidas antes de ejecutar.

## Gates y orden de ejecución propuesto

### Reserva definitiva recibida: web4.26.80 / APK52

Coordinador01a0f653 reserva80 después de nómina78 y retirada79. **No recompilar hasta parent79 comunicado, versionName80 y fuente congelada.** La candidata local78/52 únicamente inspecciona la receta; no se sube ni instala. Nombre final propuesto `Aely-4.26.80-beta-52.apk`, exclusivamente en la release fija `beta` prerelease. URL del manifiesto:

`https://github.com/JuanjoAvila/Aely/releases/download/beta/Aely-4.26.80-beta-52.apk`

Después del asset real y verificado, public/apk.json52 llevará versionName4.26.80 y esa URL. Nunca la URL v4.26.80 que imprime el dry-run de producción; no ejecutar su modo normal. Notas: «El widget sigue el mes o Mi ciclo de Inicio y pide abrir la app cuando falta confirmar un pago.» No escribir este JSON todavía ni afirmar que la descarga exista.

Orden final: injertar runtime/alcance80 sobre79, preservar tandas/historia, medir caps mínimos y revisar fuente exacta; compilar candidata80 con manifiesto51 aún intacto; **solo con gate de subida previa**, subir asset sin anunciar y comprobar descarga/firma/hash. Escribir el manifiesto real y congelar su commit final dentro de la misma tanda/version (enmienda local antes de push si el guardián de bump lo requiere). CI exacta y build final del SHA con JSON52; reemplazar el binario previo antes de que se anuncie y cotejar hash por descarga; después publicar web80.N+manifiesto52 en beta con Actions serializada. No introducir una URL404 para lograr un verde ni reutilizar el binario provisional78.

Sin fallback inadvertido durante el cotejo: release beta/api y apk.json servido deben responder con el manifiesto52 y URL/asset de beta; web y worker deben resolver ese canal, sin acabar en Pages estable. `mcFetchManifest` y el worker existentes conservan fallback heredado si falta beta; `OtaCheckWorker` además usa null al fallar la lectura. **No se afirma que ese fallback desaparezca del runtime**: no se ha cambiado este worker. Se evita en la entrega comprobando la respuesta beta efectiva y su procedencia. Si se exige suprimir también el fallback nativo ante error de red, falta cambio/gate propio y revisión antes de congelarAPK80. APK48 estable, Pages/puente y main permanecen fuera de esta entrega.

1. **Congelar integración.** El coordinador incorpora el tooling de fechas aprobado y los cambios web autorizados, conserva todas las tandas pendientes y asigna VERSION definitiva. Revisión independiente y CI del código real; no mezclar Edge/SQL de PR87. Revisar explícitamente los cambios de fuentes respecto a 821733fc. Mantener main, APK estable48 y sus manifiestos fuera de esta operación.

2. **Revisar metadatos nativos.** En la candidata beta autorizada: android/app/build.gradle versionCode52 y versionName=VERSION; VERSION/package/lock/notas/README/ROADMAP coherentes. Canal beta del móvil se conserva local, no se impone a la familia ni se comparte en app_state. La app sigue siendo `com.micartera.app`, misma firma; no generar `.debug` ni instalar/desinstalar para preparar evidencia. El cambio de APK requiere una nueva revisión del alcance de las pruebas nativas: no reciclar un OK de APK51 sobre widget v2.

3. **Resolver la existencia del asset antes del manifiesto.** El circuito oficial sube la APK y después escribe apk.json. Por eso hay un tramo de preparación donde gradle52 y el manifiesto anterior51 no cuadran: no llamarlo CI final ni publicar esa rama. Propuesta a autorizar por el coordinador: generar y verificar una APK candidata y subirla **sin anunciar** a la release beta con nombre único `Aely-VERSION-beta-52.apk`, manteniendo el apk.json servido anterior. Solo después de comprobar asset/HTTP se escribe el manifiesto52 de la candidata. No escribir un public/apk.json dirigido a una descarga inexistente. Si no se autoriza esta subida previa sin anuncio, conservar el JSON propuesto fuera de public y dejar pendiente la entrega; no saltar el guardián.

4. **Compilar y verificar después del gate.** Usar `npm run release:apk -- --dry-run` para el circuito oficial de preparación y verificación, sin su subida a vVERSION ni su JSON de producción. MICARTERA_WEBDEBUG=0, sin bypass; firma local fuera del repo, sin copiar URL/token de ingest. Exigir BuildConfig DEBUG/WEB_DEBUG false, INGEST_URL vacía, VERSION_NAME/CODE correctos. Aapt debe acreditar package/versionName/versionCode. Apksigner debe existir y verificar firma, CN=Mi Cartera y certificado SHA-256 `e4cf4a212911890007a66c870bf5859685b315967f7fe752295b52620648f01b`; no aceptar el aviso opcional del script que omite la firma si falta la herramienta. Registrar tamaño y SHA-256 propios de cada APK, nunca reutilizar el hash del artefacto obsoleto.

5. **Commit y CI finales.** public/apk.json52 apunta al asset real de la release beta, con versionName definitiva y notas claras. Actualizar la tabla de alineación/documentación. Tras commit, docs-frescura y CI de integración completos, además de privacidad y guardianes de APK sin token/canales/widget. Con los metadatos finales ya en Git, recompilar la APK desde ese SHA exacto: la primera APK sin anuncio no acredita el commit final. Verificar dentro del ZIP APP_VERSION=VERSION, ausencia de dev y assets iguales a www generado oficialmente; verificar Java/DEX y registrar la procedencia exacta. Solo este segundo artefacto final sustituye al candidato previo, antes de ofrecerlo desde el manifiesto beta. No copiar public a www a mano.

6. **Subida beta, sin estable.** El coordinador autoriza y serializa las escrituras en la release beta para no competir con beta.yml. Subir el binario final bajo el nombre autorizado; verificar por descarga completa su SHA-256, tamaño y firma. Si se reemplaza el candidato previo del mismo nombre, comprobar que la URL ya devuelve el binario final antes de anunciar52. El manifiesto solo se modifica en la candidata de beta; no escribir main/public/apk.json, Pages ni el manifiesto estable del puente. No ejecutar release:apk normal, promote-beta ni un merge completo a main para esta entrega.

7. **Publicación web y manifiesto conjunta.** Con el APK final accesible y el CI final verde, el coordinador integra/publica el SHA exacto en beta. beta.yml debe terminar SUCCESS y servir VERSION.N con su mismo sello, huella, ZIP y SW. Descargar apk.json servido: code52, versionName definitiva, URL beta del APK final, sin fallback inadvertido a estable. Cotejar HTML del ZIP, manifiesto dentro del bundle, apk.json independiente y binario. Un HTTP distinto de404 no basta: exigir descarga correcta y hash. Releer la release como prerelease. Verificar después que los manifiestos estables de Pages/puente siguen anunciando48 y sus bytes/URLs anteriores; conservar evidencia antes/después.

8. **Prueba en móvil, entrega parcial.** No instalar durante esta preparación. Una vez disponible para el dueño: en canal beta se ofrece52; estable sigue ofreciendo48. Tras instalación voluntaria comprobar appInfo/versión nativa, web VERSION.N, widgetContract2, textos es/en/ca, mes/ciclo, negociación/ACK al cruzar el día1, reentrada sin doble conteo y aviso sin cifras con ingest legado. FIN05 exige compra real con app cerrada y explicación de saldo/disponible. Balance/modos de Gastos sigue abierto: APK52 para Inicio/presupuesto no acredita ese alcance. No marcar tanda completa solo por APK firmada, CI o disponibilidad del asset.

## Manifiesto propuesto, todavía sin escribir

```json
{
  "versionCode": 52,
  "versionName": "VERSION_DEFINITIVA",
  "url": "https://github.com/JuanjoAvila/Aely/releases/download/beta/Aely-VERSION_DEFINITIVA-beta-52.apk",
  "notes": "APK de pruebas: el widget muestra el periodo y la cifra de Inicio."
}
```

La vuelta al canal estable no instala una APK48 encima de52 ni autoriza desinstalar y perder datos. Antes de una futura promoción nativa se requiere aceptación específica y una entrega compatible con los códigos ya instalados; el plan actual no incluye esa promoción.

Observación no bloqueante de Claude: el ACK v2 crece con las filas TR/ingest históricas y viaja en cada envío. No se recorta por fecha en esta entrega: habría que demostrar antes que ningún evento antiguo aún desconocido queda fuera de recepción/ACK, especialmente si afecta al saldo. Una eventual optimización es otra verificación, no permiso para cambiar ahora la fuente que recibió GO.

**Pendiente del coordinador:** VERSION/base definitivas, aceptación del tramo de subida sin anuncio, publicador de los assets y orden serializado con beta.yml. GO de fuente confirmado; CI integrado y aceptación móvil siguen pendientes. Hasta entonces: ninguna build nueva, subida, instalación, manifiesto52 o bandera de tarea completada.
