# INC-0710 · Mes de Gastos en Madrid · candidata99

Preparación local sobre beta98/b7abebb6, sin publicación. Fuente Claude2741c262 portada exclusivamente en runtime, tests y mapas, sin sus artefactos. Incluye corrección de etiquetas mensuales que la revisión encontró todavía dependientes del dispositivo. Mes, mes pasado y tres meses usan Madrid en límites, memo, cabecera y marcas; ciclo/custom conservan su contrato local.

Nueva tanda `inc-0710-gastos-mes-madrid`, sin heredar aprobaciones. Se preservan todas las notas existentes, rechazo97 y revisión98, Inicio96 y sus identidades no afectadas. Los alcances existentes que incluyen Expenses cambian honestamente: movilidad, periodo, sin-límite y nómina. No repinar ni simular lectura/veredictos.

Pruebas: Node en UTC/Madrid/Los Angeles/Auckland; DOM es/en/ca×UTC/Madrid×cambio de mes/año/verano/invierno, importes2300 en mes/500 pasado/2900 tres meses, categorías/lista/fechas y exclusión de primer instante del siguiente mes. Revisión independiente y CI exacta pendientes. La disponibilidad/ejecución local del navegador se registrará antes de cerrar la candidata.

Sin APK, Edge, SQL, sincronización bancaria ni datos reales. INC-2709-09 acumulativo sigue abierto y separado; coherencia de fecha no acredita reparación del lag.

Verificación local: build y sintaxis del bundle7bloques; NodeMadrid4zonas y gastos-periodo; docs-frescura y29repositorioshistoria; relevant-tests, idiomas, notas-sin-duplicados, beta-tandas/beta-veredictos, release-notes-max, security y privacidad con exit0. Playwright descubre36casos incluyendo12 de memo en la misma página al cruzar medianocheMadrid. El intento real chromium.launch aborta antes de crear página: ejecutable chromium_headless_shell1228 ausente; búsqueda sin otro binario, no se instala. Cero DOM ejecutados localmente. Suitebeta-sources detectó contadorPERSIST18 obsoleto por nueva tanda escritora19; se conserva el guardián de correspondencia código/guardado y se añade aserción explícita de la nueva dependencia. Reejecución completa pesada aún pendiente al preparar el cierre; CI exacta sigue obligatoria.

Corrección local del gate de tamaño tras CI37570338021/source5fa2350b: presupuesto-rendimiento falló por72B crudos sobre1287KiB; gzip y tres recursos bloqueantes cumplían, y DOM no llegó a ejecutarse. Se factoriza por render la elección mensual de Madrid y las opciones idénticas de las dos marcas de fecha; límites, memo, ciclo y rango siguen iguales. A/B con el mismo minificador:1317960→1317815B crudos (−145B),358912→358920B gzip (+8B), frente a límites1317888/359424B. No se suben presupuestos ni se recortan catálogo o idiomas. Fuente todavía local; CI exacta y DOM reales pendientes.

Sellado de estrés4.26.99.99999 en copia de medición:1317825B crudos/358929B gzip, márgenes63/495B; artefactos finales restaurados por build, sin modificar SW. Nombres locales claros y cortos evitan parsear caracteres repetidos, con minifyIdentifiers desactivado. NodeMadrid4TZ, gastos-periodo, mapas, catálogo, sintaxis, privacidad, docs y presupuesto verdes; discovery36DOM, sin ejecuciónDOM. La fuente96 y revisiónFAB98 se conservan exactas.

Revisión de alcance: la declaración compartida queda inmediatamente después de todayKey, dentro del cálculo de periodos. Así no contamina el alcance explícito del editor de cargos (saveEdit→todayKey); se conserva su revisión exacta sin ampliar, recortar ni repinar el registro. Mismo orden efectivo de cálculos y opciones, con semántica y peso equivalentes.

Medición final tras recolocar la declaración:1317815B crudos/358923B gzip; sellado4.26.99.99999:1317825/358932B (márgenes63/492B). Cargos, Inicio96 y FAB98 vuelven a coincidir exactamente con5fa; los guiones se mantienen.

## Corrección del rojo DOM · relevo13

CI37572568352/source3aeed496 alcanzó los36casos reales de `gastos-mes-madrid` y detectó marcas vacías. La causa es de producto: las tres llamadas `React.createElement("span", texto)` trataban fecha/«Hoy» como props, sin hijo que pintar. Se añade exclusivamente `null` como props en las tres, sin cambiar límites, dinero, etiquetas, idiomas, fixtures ni sus aserciones. El guardián DOM existente permanece íntegro.

A/B causal local con el React de producción embebido en `src/shell.html` y la expresión real de las marcas: en3aeed496 los tres `props.children` son `undefined`; en la fuente corregida son `01 oct`, `Hoy 1`, `31 oct`. Es prueba de elementos React, no ejecución DOM. Build, sintaxis7bloques, Madrid4TZ, gastos-periodo, mapas y privacidad pasan. Intento real `chromium.launch` bloqueado antes de página por binario1234 ausente; no se instala. Presupuesto-rendimiento bloqueado por falta de esbuild en las dependencias disponibles; los topes permanecen intactos y su CI exacta sigue obligatoria. Publicación y36DOM corregidos pendientes. INC-2709-09 sigue abierto.
