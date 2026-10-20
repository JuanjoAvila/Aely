INC1710 — aviso de recarga a1800ms, alineado con beta141

Task `inc1710-pr265-reload-fallback-delay-codex-20261018`; claim c3b2fc09, ACK 910f4130. Base histórica3f6410f29a9c617443c9c3b1d8751a4afa5ebad1 preservada. Alineación con ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13 mediante merge normal conservando ambas ascendencias, bajo2893f0d3. Candidata para la misma PR265, pendiente de revisión/integración.

El aviso y la marca local `mc_mode_change_reopen_required` se programan después de solicitar `location.reload()` y solo aparecen si este documento sigue vivo y en transición a los1800ms. Una recarga normal no los emite. Pagehide, desmontaje o cancelación de transición limpian el temporizador. Entrar, salir y recargar sin volcar usan el mismo helper; textos y persistencia conservados.

La alineación conserva exactamente, normalizando EOL, `pushAppState`, la selección `cloudUploadState/uploadState` y todo el módulo Deudas/Metas con el closer de PlanEditSheet de141. El efecto mantiene las dependencias `[uploadState,uid]` y el uploader de141, envueltos en la cancelación/rearmado de transición ya revisada en PR265. No vuelve a la llamada directa antigua ni fuerza un flush local. El control dirigido ejecuta efecto y uploader reales: cancela sin escribir, rearma la edición y conserva sello esperado y ACK. Sin cambio de contrato financiero ni de CLOUD_WRITES.

Evidencia dirigida nueva, Chromium sintético,1worker/0retry:

- ROJO causal preservado sobre HTML canónico3f: EXIT1 por marca prematura en recarga normal.
- Fuente141 más delta: ida y vuelta normal PASS, cero avisos/marcas y cero escrituras SDK entre confirmar y pagehide. Una ejecución sobre141.
- Recarga cancelada: entrada y salida PASS en contextos independientes, umbral1799/1800ms exacto, una marca nativa y aviso visible,31 escritores bloqueados por dirección y reapertura correcta. EXIT0,dos casos. Se conserva Performance nativa antes de instalar el reloj, que sustituye mark/getEntries por stubs.
- Fallos de arnés preservados: botón fuera del viewport al congelar antes de acabar la animación; en141, Performance sustituida por el reloj (aviso a1800,contador0). El segundo intento ejecuta solo las direcciones canceladas pendientes. Error sintáctico privado de la sonda conservado y corregido antes de ejecutar; otro error privado al preparar documentación no ejecutó cambios y se sustituyó por edición directa.
- Build EXIT0; efecto/uploader3 comprobaciones EXIT0; sintaxis EXIT0; registro de pruebas EXIT0. HTML servido141 SHA256 `4c425c5abf0ca2abe4b7464198b148fbb0030ed79b92d62a94e971f8f024ffd2`, estable antes/después. Servidores propios cerrados.

No se repiten suites60/60,9/9,mutantes ni24 activaciones terminadas. La evidencia antigua mantiene su fuente histórica. Evidencia privada en inc1710d141-green-delay, inc1710d141-green-canceled-native-performance e inc1710d141-checks. Catálogos generados por build; VERSION, catálogos fuente y topes no se editan. Pendientes revisión independiente, gates generales de integración/CI, artefacto servido y Android físico. Sin CPU6, Gradle/APK, bancos, SQL vivo, Edge, merge a beta, despliegue o ProductREADY.

Los cortes de abajo son históricos; el aviso inmediato y sus estados de entrega quedan sustituidos por este corte.

INC1710 remates — sucesor privado de 673, pendiente de revisión ROOT

Task `inc1710-pr265-dirty-flush-remates-codex-20261018`; base exacta `673fc18f2498893306c1bfbaca13ddaff5643927`. Claim `ddf4cf37de75927b83f2d1a3133aae772fa4450c`, ACK `3fd69831488c0be96fa5dd58a58a80ae98a608c7`, admisión privada ROOT61 del 18/10. Checkout nuevo `work/inc1710r`; la fuente anterior 673 y su resultado bloqueado/released se conservan. PR265 no se actualiza en esta fase.

ROJO causal sobre el blob canónico de 673: el test original `modo-inicial.spec.mjs:23` falla al comparar la cartera real antes/después de `mcSeedSandboxVacio` (EXIT1). Abrir la guarda ejecutaba `flushPersist` y escribía el estado automático de arranque. No había una edición del usuario que autorizase esa escritura; el búfer pendiente por sí solo no lo distinguía. El test original permanece intacto.

Corrección: la apertura de la guarda cancela el push de nube, sin invocar el volcado local. El temporizador y el `pagehide` existentes siguen guardando exclusivamente su búfer pendiente; un búfer vacío sigue siendo no-op. `mcRecargarSinVolcar` descarta el estado anterior solo si el documento está fijado en PRUEBAS: al entrar desde REAL al modo vacío, su `pagehide` conserva la edición real pendiente. Ninguna modificación del cuerpo de persistencia, `mcSaveRaw`, esquema/particiones, LWW, modo fijado, lista CLOUD_WRITES o envoltura de escritores. Dos pruebas nuevas retienen deliberadamente el temporizador de 400ms y exigen el guardado real por `pagehide`, tanto al entrar normal como vacío.

Recuperación: mientras la transición esté abierta se muestra un aviso fijo, accesible por `role=alert`, en es/en/ca para cerrar y reabrir la app. Si la recarga se cancela, el aviso y la guarda permanecen; al reabrir, el documento nuevo aplica las banderas existentes. Diagnóstico LOCAL de código único `mc_mode_change_reopen_required` mediante Performance mark, sin detalle ni valores. Se emite conservadoramente al abrir la transición: no afirma detectar una cancelación que el navegador no comunica al llamador. No es un evento remoto de app_events, no persiste entre documentos y no salta la guarda de `cloud.logEvent`. La revisión debe valorar expresamente si este diagnóstico local satisface la telemetría solicitada; no se añade un contrato de nube ni un outbox/esquema nuevo.

Prueba de ventana: se retiene la llamada REAL a `history.back` después de confirmar el Ask. Antes del pop y del cambio de bandera se invoca `cloud.pushState` con datos reales sintéticos y después las 31 puertas CLOUD_WRITES; todas deben quedar bloqueadas. Tras liberar el back se espera el `load` del documento nuevo y la disponibilidad del bundle. Los bytes se comparan entre el `pagehide` posterior al flush real y el init siguiente. La mutación privada de la envoltura a `mcSandboxFlag()` falla exactamente por una escritura en ese intervalo (esperado0/obtenido1, EXIT1), sin ReferenceError; solo se modifica el HTML servido en memoria.

Evidencia fuera del checkout: `work/evidence/inc1710r-*`, inventario `work/inc1710r-review-inventory.json` y checkpoint final en `outputs/inc1710-pr265-remates-candidate-checkpoint.json`. Incluye los EXIT reales, la mutación esperada y el fallo del primer arnés de persistencia (localizador exacto incorrecto, EXIT1/10 casos no ejecutados), seguido de su corrección. Los cinco conjuntos focales y la estabilidad de 24 activaciones se contabilizan en ese checkpoint, sin mezclar repeticiones/retornos con casos únicos. Cada ejecución usa OWN48541 por bind exclusivo, 1worker/0retry/maxFailures1, y cierra su servidor. No se repite una batería completa por cambios de documentación.

Solo candidata privada para revisión. Sin push, actualización PR/result público, CI general, integración, beta desplegada/servida, CPU6, APK, nube/bancos reales o aceptación móvil. VERSION, catálogos fuente, caps y oráculos ajenos intactos. Los artefactos i18n e index y las huellas de beta-delivery son derivados del único build propio, no una entrega beta.

Historial anterior preservado a continuación; sus afirmaciones de flush y verde corresponden a 673 y quedan sustituidas por este sucesor y su evidencia.

INC1710-01 — candidata privada con guarda de transición; validación focal verde

Continuación expresa `8ac59d41bc4d9cb20ca56aac9a2a7a10a8ab1326`, desde la candidata preservada654d38a7. La ventana empieza al aceptar el Ask, antes del cambio de flag/semilla y de esperar el acuse OWN. La guarda existente de escritores ahora rechaza también mientras `mcSandboxTransition()` está activo. La lista CLOUD_WRITES no cambia. El estado de transición solo vive en el documento; el arranque destino vuelve a su valor inicial y a su modo fijado normal. Un acuse inválido libera la ventana y rearma el push habitual.

Archivos adicionales expresamente necesarios: `00-core.js` para estado/guarda y para que las entradas directas de activar/vaciar/salir también abran la ventana; `11-app-main.js` para cancelar el debounce de1200ms, impedir rearmarlo durante la ventana y ejecutar el `flushPersist` ya existente. No se cambia el cuerpo del volcado, las particiones, el esquema ni el modo fijado. `05-dialogs-inv.js` abre la guarda al confirmar y la libera si no llega el acuse exacto; 02/10 conservan la candidata anterior. Pruebas adicionales en `tests/security.test.mjs`, `tests/backclose-history.test.mjs` y el spec ya registrado `e2e/modo-pruebas.spec.mjs`.

Elección para una edición real pendiente de subir: conservarla por la vía local durable existente, no por una cola nueva. El flush usa la clave de la sesión fijada; al volver al modo real, el arranque carga esa cartera, syncFromCloud conserva el local de _savedAt más reciente y el push normal la envía. El E2E hace una edición REAL por Settings (reduceMotion), comprueba que es durable pero que aún no está en ningún upsert, activa el sandbox, verifica sus bytes al pagehide y al init siguiente, sale por Settings y observa el upsert normal del tercer arranque con esa edición y presupuesto500. Sin cambios de persistencia o de selección LWW.

Nueva evidencia focal: `work/evidence/inc171001-green-window-guard-immediate-pending-edit/`, 3/3, EXIT0, OWN48541/1worker0retry/maxFailures1. En TODOS los casos se programa el escritor de0ms; dispara realmente bajo la guarda (no se elimina el timer de la sonda). Confirmación→pagehide: Activar19,4ms, Vaciar15,7ms, Desactivar15,3ms; el retorno adicional a real15,8ms. Cero llamadas de escritura en las cuatro ventanas y tres particiones reales byte a byte en confirmación/pagehide/init destino. El estado de la semilla está marcado `INC171001_SEED_ONLY`; no aparece en NINGÚN upsert de todo el registro, sin limpiar contadores ni dormir el arranque.

Seguridad EXIT0 ejecuta la envoltura REAL para todos los escritores en transición con pinned real, demuestra su reactivación al cancelar y el bloqueo normal en el sandbox destino. También ejecuta el efecto REAL de App con timers controlados para probar cancelación, entrega de la edición al flush existente y rearmado si el acuse falla. Historial/Ask:30 contratos EXIT0, ahora incluyen apertura de la guarda antes de esperar y liberación al fallar. Logs en `work/evidence/inc171001-window-node/`. El registro existente de estos archivos no ha cambiado y no se ha repetido su test intacto.

El upsert antiguo a4ms llevaba presupuesto REAL500, no la semilla9999: era la API cloud.pushState del documento real, pendiente mientras la navegación ocurría. La prueba antigua permanece ROJA sin retag; la fuente nueva cubre esa llamada con la guarda incluso antes de mutar el flag. Todo dato y cliente son sintéticos/interceptados:0mutaciones de red productivas. ConflictosINC0410 no integrado en503; no se afirma un oráculo poblado de conflicto. Sin CI general, integración, beta servida, físico móvil, despliegue o ProductREADY. Solo candidata privada, sin push/PR/result.

Historial de la fase anterior, conservada sin ocultar su bloqueo:

INC1710-01 — candidata privada654d38a7 BLOQUEADA: el escritor inmediato todavía atravesaba la ventana

Actualización de producto tras GO `c87b4f67d32c3305d1df3b1d07e0b5959a76b08d` y admisión privada ROOT60 del 17/10. Se implementó únicamente el camino terminal del Ask en 02/05/10: retirar su entrada propia, esperar el pop exacto y entonces resolver la confirmación. Cancelar y los Ask normales resuelven como antes; entrada ajena, fallos de History o un pop inesperado no autorizan la transición. Sin timeout, cambios de nube, guardas, CLOUD_WRITES, modo fijado o volcado. Fuente padre 503.

Resultados nuevos, conservados por separado de los rojos originales:

- El nuevo caso de ventana completa falla sobre503 (EXIT1, stop-first-failure): la recarga no llega y disparan el escritor pendiente, el backup diario y el push de estado posterior; los payloads son de presupuesto real500. Esto reproduce y explica causalmente el primer upsert: no se elimina como ruido ni se duerme hasta ocultarlo.
- Con la candidata, Activar/Vaciar/Desactivar pasan 3/3 (EXIT0, 1worker0retry). Confirmación→pagehide dura 14,9/20,1/12,5ms. Cero llamadas de escritura en esos intervalos, incluida una sonda pendiente de500ms por la API real de cloud; escritores activos y comprobados antes de Activar. El guard sandbox sigue bloqueando la misma API tras arrancar dentro.
- Los bytes reales de main/expenses/balhist coinciden en confirmación, pagehide y primer init del documento nuevo, antes de su sync normal. Este corte explícito no afirma que la metadata de la sesión real siguiente nunca cambie. INC0410/copia de conflicto sigue ausente.
- 30 contratos Node del controlador/Ask (incluidos seis casos nuevos de acuse exacto, cancelación, entrada/pop ajenos y errores) EXIT0; seguridad EXIT0; registro relevante EXIT0. Los comandos/EXITs están en la evidencia privada; el stdout de la primera ejecución de history está en el transcript de herramientas.
- PRUEBA ADVERSARIAL NUEVA, mismo HTML de la candidata, sin rebuild ni cambios de producto: escritor pendiente de0ms al confirmar Activar. EXIT1. El acuse propio llega, se solicita el reload, pero el escritor todavía corre entre beforeunload y pagehide. A los4ms de confirmar hay `app_state.upsert`, bandera=1, pinned=false, presupuesto500; pagehide llega a los14,1ms. Las particiones reales se conservan y la recarga sí completa, pero NO se satisface cero escrituras en toda la ventana. El endpoint estaba simulado y toda red externa interceptada; ninguna escritura productiva ocurrió.

STOP obligatorio conforme a la admisión: se conserva la candidata bloqueada para revisión, no se presenta como FINAL/GO. Resolver o aceptar este intervalo necesita respuesta de Claude antes de seguir: no se puede asumir autorización para un fence de escrituras, cambio de guardas, pinned o volcado. No se ha tocado ninguno, ni se han limpiado contadores o relajado el oráculo para pasar.

El build regenera index y las huellas derivadas de `public/release-notes.json`/`beta-delivery.json`: solo cambian fingerprints calculados de fuente (incluidas revisiones dependientes de02), no textos/reviews/versiones ni los catálogos fuente, beta-sources o caps. Todos los hashes y los del HTML servido se congelan con la candidata; no acreditan beta servida ni APK55. Sin suite completa, CI, integración, CPU6, Gradle/APK, despliegue o aceptación móvil.

Evidencia nueva fuera del checkout: `work/evidence/inc171001-red-whole-window-503/`, `work/evidence/inc171001-green-terminal-whole-window/`, `work/evidence/inc171001-immediate-writer-product-probe/` y `work/evidence/inc171001-node-product/`. El caso inmediato es un probe privado conservado en `work/inc171001-immediate.spec.mjs`; no se oculta tras el 3/3 funcional. No se ha publicado PR, fuente o result.

Diagnóstico y propuesta históricos de la fase anterior (conservados también byte a byte en beforeimages):

Base exacta: `503d23267091eb5aa0b0e37dd94fac20ea37bd08` (package 4.26.140).
Rama local aislada: `codex/inc171001-settings-diagnosis-20261017`.
Claim `147b93d33734b9810e036147ae9c6fdc28391062`, ACK `d359c90180039cb82b9e8ce5cfc8ec9f5a3e8b9a`.

El fallo se reproduce desde los botones reales de Settings. No es solo un interruptor sin repintar: la sesión mantiene el modo anterior porque la recarga solicitada se cancela con el retroceso que limpia la entrada del diálogo.

Secuencia observada en Chromium, para Activar, Vaciar y Desactivar:

1. `AskHost.done()` cierra el diálogo y resuelve la promesa; el `.then` de Settings cambia las banderas/semilla y llama a `location.reload()` (directa o por `mcRecargarSinVolcar`).
2. CDP registra `frameScheduledNavigation` y `frameRequestedNavigation`, ambos con `reason: reload`. Se dispara `beforeunload`.
3. La limpieza de `useBackClose` retira la entrada del Ask. `_mcBackFlush` → `_mcBackConsume` → `history.back()` ocurre después de `beforeunload` y antes de un `pagehide`/nuevo documento.
4. CDP registra la cancelación de la navegación programada y una navegación dentro del mismo documento. El contador de arranques sigue en 1; no llega un nuevo HTML.
5. Volver atrás y abrir Settings repinta la bandera cruda, aunque `mcSandbox()` continúa fijado en el modo anterior. Una recarga manual posterior, usada solo como control diagnóstico, sube el contador a 2 y completa la transición en los tres casos.

| Acción real | Bandera tras aceptar | Modo que sigue vivo | Resultado esperado ausente |
| --- | --- | --- | --- |
| Entrar a probar | `_mcSandbox=1` | real, presupuesto 500 | sandbox de presupuesto 9999 y banda |
| Vaciar | `_mcSandboxVacio=1`, semilla vacía | sandbox anterior, vacío fijado=false | onboarding |
| Salir a mi cartera real | `_mcSandbox` ausente | sandbox, presupuesto 9999 | cartera real de presupuesto 500 |

Ejecución: dos casos diagnósticos nuevos, cada uno 1 test/1 worker/0 retries/maxFailures=1, puerto OWN48541 adquirido por bind exclusivo y cerrado al terminar. Ambos EXIT1 por la transición, sin errores de página. El segundo añade observación de History/CDP y control manual; no es una repetición de aceptación ni un verde de producto. Antes hubo un fallo de preflight del arnés (EXIT1, sin ejecutar Chromium) al comparar el checkout CRLF con el blob LF; el servidor finalmente sirvió el blob canónico sin transformar ni editar la fuente.

HTML servido SHA256 `82956808743a80415a7eebaa0785976b838d9e0e279cc39c2e52a71ef58ff65a`; todas las peticiones documentales coinciden. El HTML canónico está sin sello de versión (`dev`); esto acredita la fuente 503, no la identidad del APK55/OTA real. Todos los archivos de `src` y el HTML local conservan sus hashes antes/después. Sin build, stamp o cambios de producto.

El primer caso dejó visibles los efectos de arranque de la fixture: cambió la clave principal por `lastBackup`/`_savedAt` y registró un `app_state.upsert` simulado con bandera=1/modo real fijado. No se borra esa evidencia ni se presenta como contaminación financiera real: solo había datos sintéticos y cliente simulado. El segundo caso siembra una copia de seguridad ya hecha y espera los efectos de arranque antes de tomar el corte. Conserva byte a byte `micartera_v3`, `micartera_v3_exp` y `micartera_v3_balhist` en las tres acciones, con cero escrituras al doble durante cada acción y cero mutaciones de red productivas. Todas las solicitudes externas fueron abortadas; solo hubo GET externos.

INC0410/clave de copia de conflictos NO está integrado en 503: la búsqueda de fuente no encuentra esa persistencia y la fixture no tiene claves de conflicto. La comparación vacía de claves de conflicto no acredita un oráculo con conflictos poblados; habrá que añadirlo si la futura base incorpora esa implementación.

Comparación estática contra producción 134 (`2751c866c`): son idénticos los fragmentos de sandbox, persistencia partida, controles de Settings, resolución/registro de AskHost y consumo/flush de History. Por tanto no se atribuye la introducción a PR248, a la limpieza129 ni al velo140. El código del controlador que consume History se remonta a `eea7366ba4` del 8/10; PR248 modifica la decisión de IME en otras ramas. No se ejecutó un navegador sobre134 y no se afirma que134 falle o pase. El cambio del velo actúa sobre `.v4-sheet-back`; este diálogo es `.askback`/`.tabsheet`.

Propuesta para la siguiente fase de PRODUCTO, todavía sin implementar:

- Añadir una transición terminal explícita para estos diálogos: cerrar y consumir primero la entrada OWN del Ask; solo tras el acuse exacto de su navegación pendiente, cambiar bandera/semilla y recargar. Sin temporizador arbitrario, sin consumir historial ajeno y sin cambiar a mitad de sesión los modos fijados.
- Alcance previsto: `02-ui-shared.js` para un acuse de consumo de la entrada propia; `05-dialogs-inv.js` para una opción de confirmación terminal; `10-app-components.js` para solicitarla en entrar/vaciar/salir/copiar/probar vacío. Los dos primeros archivos requieren ampliación expresa del scope original antes de editarlos. Mantener el comportamiento normal de los demás diálogos.
- Tests dirigidos: registro/cancelación/consumo OWN, cambios inmediatos tras las tres acciones, reapertura por atrás, las tres particiones reales byte a byte, cero escrituras desde sandbox y desde modo vacío; registrar selección focal y documentar el contrato. El oráculo de conflicto queda condicionado a presencia real en la base.
- No se propone editar escrituras de nube, sus guardas ni `CLOUD_WRITES`, ni la fijación de modo o el volcado. Si el diseño necesitara suprimir escrituras pendientes o cambiar esa semántica, consultar a Claude y esperar respuesta aplicable antes de implementarlo. La ventana de modo incoherente del primer caso queda expresamente señalada para esa revisión.

Pruebas/observaciones: `work/evidence/inc171001-baseline-settings-503-exact-blob/` y `work/evidence/inc171001-causal-history-navigation-503/`, fuera del checkout. Resumen con fragmentos completos, hashes y eventos: `work/inc171001-causal-static-diagnosis.json`. La fixture añadida a `e2e/modo-pruebas.spec.mjs` sigue como WIP privado sin commit.

No se ha publicado PR/result ni fuente de producto. Sin CI general, integración, beta servida, móvil físico o ProductREADY. PR248 y los checkouts anteriores se conservan.
