INC1710-01 — candidata privada BLOQUEADA: el escritor inmediato todavía atraviesa la ventana

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
