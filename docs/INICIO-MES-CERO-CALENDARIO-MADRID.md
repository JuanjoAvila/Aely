# Inicio: margen agotado y calendario de Madrid

Estado: PR225 en borrador, mantenimiento sobre la base promovida126 `33d39cb8` por señal `fa1902f5`, conservando el contenido Widget `b518f369`. Fuente anterior `525f9302` y su CI terminal se preservan. Claim/base123 y result anterior `b457f1db` permanecen inmutables. DOM321/1SKIP pertenece a125; DOM126 no está validado. Sin Ready, merge, publicación propia ni aceptación móvil. Las secciones inferiores conservan la evidencia de cada fuente.

## Tarjeta del mes

En `cyclePaceState` de `src/modules/03-tab-dash.js`, primero se redondea al céntimo. Un gasto superior al límite sigue siendo exceso/coral. La igualdad ahora devuelve `tight/tan` antes de la salida verde de los primeros tres días. Se reutilizan `v42_cycle_tight` en es/en/ca y los colores existentes. Los umbrales de diferencia entre porcentaje gastado y tiempo transcurrido siguen en −15/10/40. El anillo sigue representando restante/presupuesto.

| Caso sintético | Antes | Candidato |
|---|---|---|
| 900 restantes, día15/30, presupuesto1000 | comfort/mint | igual |
| 200 restantes, día15/30 | tight/tan | igual |
| 0 restantes, día30/30 | good/mint | tight/tan |
| 0 restantes, día1/30 | start/mint | tight/tan |
| −0,01 restantes | over/coral | igual |
| Sin presupuesto | tarjeta vacía y acceso para configurarlo | igual |

## Fronteras del dinero

El productor Widget conserva la propiedad de `lastPaydayOf` (04); esta rama hereda su corrección de nómina. Se cambian exclusivamente `budgetPeriodOf` (08), la rama ciclo de `presetBoundsMs` (04) y el helper compartido `madridDayStartMs` (08). Los informes con fecha explícita siguen usando mes natural; el mes sin ciclo conserva su extremo abierto. Otros presets permanecen iguales.

Con nómina BOOK1800 y compra BOOK12,34 del1oct, a30sep22:01Z, el extremo local de UTC/Canarias ocultaba la compra del día civil de Madrid: gasto0/margen500. Tras compartir el extremo Madrid, Inicio, cabecera del ciclo de Gastos y el escritor real `nat.updateWidget` envían12,34 y dejan487,66. En Madrid las ocho filas del barrido antes/después conservan exactamente fronteras y cifras.

El guardián `tests/nomina-calendario-madrid.test.mjs`, registrado en `run-tests`, ejecuta procesos separados UTC/Madrid/Canarias: cambio de mes/año, bisiesto y DST marzo/octubre antes/después de ocho medianoches. Usa el importador real y el escritor web real del widget, con datos sintéticos; verifica BOOK, veto futura/PDNG/UNKNOWN/duplicada. La integración necesita 37 unidades de dependencia técnica en 19 alcances: 19 del helper, 9 del lector Madrid y 9 de su formatter. La propuesta privada detectó 57 mutaciones. Por orden `a4328161`, el autor retira todas las declaraciones de `beta-sources.json`; el fichero queda idéntico al de la base de ejecución. No se modifica ningún ID, nota, pasos de revisión ni retiro.

## Evidencia conservada de la entrega79

- Tarjeta: rojo causal anterior; verde posterior en UTC/Madrid/Canarias. El test existente sigue matando sus24 mutaciones.
- Calendario: antes UTC48fallos/Canarias48/Madrid0; sólo presupuesto reduce a16/16/0; presupuesto+lista y comparación de payload real:0 en las tres zonas.
- Sintaxis, Gastos período y mes Madrid: EXIT0. Presupuesto de tamaño: EXIT0, 1384146B/380158B con reserva95B y sello123.99999, bajo 1384448/380928B. Topes intactos.
- Se han añadido18 casos DOM cero/negativo, tres idiomas y día1/15/30. NO ejecutados todavía; tampoco se atribuyen los tres rojos originales UTC a una reproducción DOM, ni suite local completa, CI final o aceptación móvil.
- El guardián focal con la propuesta de dependencias dio EXIT1: Catálogo123 congelaba los descriptores. El coordinador respondió que catálogo, retiros y VERSION pertenecen a integración: se entrega sin modificar guardianes ni declarar dependencias. `docs-frescura` da EXIT1 sólo por código candidato sin VERSION nueva; las versiones entre documentos sí cuadran y VERSION/notas pertenecen a la integración.
- FIN01 conserva su lease físico. No se lanza Chromium hasta devolución explícita y admisión propia. No se modifica su cerrojo, ni se adopta por reloj o ausencia de PID.

Inventario focal (15 archivos, grupos de hasta8): inicio-cargos, inicio-v42, inicio-v42-rendimiento, inicio-solape-gastos, inicio-offline, inicio-mes-natural, inicio-grafica-significado, nomina-anticipada, pulido-vacios, pulido-numpad, pulido-apuntar, presupuesto-fluido, presupuesto-bancos, widget-banco, gastos-categorias-presupuesto. La evidencia de cada ejecución y sus salidas reales se conservará antes del result.

## Mantenimiento sobre beta124

La CI primaria de la fuente79 (Tests38385035060, job115254595911) terminó FAILURE/EXIT1 a las11:02:14Z del13/10. Además de cuatro aserciones de beta-sources y el VERSION de docs-frescura, fallaron month-budget-stats, widget-arbitraje y recibo-invariante. Deno7archivos pasó; E2E/rendimiento no se ejecutaron y el paso de privacidad del workflow quedó skipped. No se sustituye esa evidencia por las pruebas locales de mantenimiento.

La comparación causal ejecutó los tres tests oficiales sobre snapshots exactos1233625fa7e, dependenciaWidget6f161fc8, candidato79dd0697 y beta124f5904735 en procesos UTC/Madrid/Canarias (36ejecuciones). Se repitió el árbitro con zona JVM explícita, porque TZ de Node no basta en Windows (12ejecuciones).

| Test oficial | 123/beta124 | Widget6f y candidato79 | Rebase previo sobre66 | Causa observada |
|---|---|---|---|---|
| month-budget-stats | EXIT0 en las tres zonas | EXIT1 UTC/Canarias; EXIT0 Madrid | igual | getDate local devuelve25 para la medianoche Madrid del26sep (25sep22Z). Fixture exacto: spent100/income400/remaining1300 iguales en las12combinaciones |
| widget-arbitraje | EXIT0 en las tres zonas | JVM UTC EXIT1; Madrid/Canarias EXIT0 | igual | Calendar de UTC añade46días desde25sep22Z y llega a10nov23:00Madrid, todavía día45. CalendarMadrid/Canarias llega a11nov00:00Madrid, ya día46. Se ejecutó WidgetPeriod real |
| recibo-invariante | EXIT0 en las tres zonas | EXIT1 UTC/Canarias,19pass/3fail; EXIT0 Madrid | igual | comparación completa incluye periodStart local de la119 frente al anclaMadrid; el fallo del caso5 interrumpe296extractos y el primeranual interrumpe3, de ahí476frente775 |

Una sonda monetaria SEPARADA, sin editar assertions ni convertir los oficiales en verde, ejecutó el generador y las cadenas reales de los300extractos amplios en ambas fuentesWidget6f/79 y las tres zonas:151casos por UTC/Canarias con sólo fechas periodStart diferentes;0diferencias de importes, saldos o cierres; Madrid0diferencias. La primera clasificación de la sonda contaba periodStart anidados como importes; ese EXIT1 de instrumentación se conservó y la clasificación corregida tiene evidencia v2 aparte. No acredita todo escenario financiero o runtime.

Los fallos adicionales ya existían en la dependencia, antes de los cambios propios. Se ha solicitado scope canónico secuencial para los tres oráculos; no se modifican aquí ni se clasifican como simples rojos de catálogo.

Tras rebase sobre66e1f947, sólo son propios la igualdad en cyclePaceState, budgetPeriodOf, rama cycle de presetBoundsMs y su helper.02 y la tarjeta/serie de patrimonio reservada a Claude permanecen intactas; lastPaydayOf se hereda del titular. Registro beta-sources, VERSION, guardianes y topes son los de la dependencia. Conflictos generados resueltos con build; CHANGELOG124 preservado.

Controles finales ligeros: sintaxis, nuevo barrido de calendario, Gastos-período, mesMadrid y registro EXIT0; Inicio-v42 EXIT0 en las tres zonas, con sus24mutaciones. Los tres oficiales conservan el patrón rojo anterior. Tamaño:1383654B crudo/379998B gzip, reservas95B y sello124.99999,230B/94B sobre topes124(1351/371KiB), EXIT1; ningún tope se cambia. CI remota del SHA final se despacha aparte. Runner FIN01nonce6fa sigue ajeno; sin PW/Chromium/CPU6/Gradle local.

Revisión posterior del productor: `327e5e86` modifica exclusivamente los dos asserts locales de month-budget-stats a la medianoche exacta Madrid y su documentación. Se hereda mediante rebase, sin tocar los tests desde esta rama. Las tres ejecuciones post327 de month-budget-stats dan EXIT0. JavaUTC y recibosUTC/Canarias continúan pendientes de scope nuevo, con su causa y sus EXIT anteriores conservados. Tests38407073951 del head7db quedó obsoleto: cancelación solicitada, sin atribuir terminal cancelado mientras no se confirme. La CI del nuevo head se registra en evidencia independiente y en PR225.

Se hereda después el fixture hermético A/B del productor4672146d: checksum y código histórico exactos, sin exigir un objetoGit perdido al rebasar. Producto idéntico. `tests/widget-ciclo.test.mjs` pasa35filas web+JVM en cinco zonas y864casos A/B Madrid. La CI38407712624 del source920 queda obsoleta por ese arreglo de preparación; cancelación solicitada y evidencia aparte, sin atribuirle PASS ni reescribir el result anterior. La CI del nuevo SHA se verificará y se conservará completa.

## Candidato final sobre beta125

La señal125 y el head del productor se verificaron con refs completas. El rebase conserva02/i18n/shell/11/catálogo/VERSION del productor;03 sólo añade dos líneas en cyclePaceState. La nota125 del CHANGELOG no se pierde. Todos los conflictos generados se resolvieron con build oficial. La petición de scope de los oráculos Java/recibos queda atendida por el titular7f, heredado enb518; no se duplicaron sus cambios. La invariancia histórica de recibos se compara explícitamente en Madrid y se mantiene separada de los controles multizona.

Por orden8352c386, los focales propios inferiores a10min se ejecutan sin cerrojo. El DIR FIN01 no se modifica. Se usaron puertos propios, servidor sin reuse, verificación de raíz y hash servido, un worker/cero retries, deadline global9min, fuentes inmutables durante cada bloque. El rendimiento es un caso corto (9,8s totales), con ventanas1,4s/arrastre; no suite ni CPU frenada larga.

Nómina causal DOM: fuente123 exacta con oráculos124,6PASS/3FAIL UTC, uno por idioma, salario importado oculto en la lista. Con producto corregido, los tres checks aún esperaban el comportamiento local antiguo; se actualizan sólo esas dos llamadas a exigir ciclo y margen500 en todas las zonas. UI125:9PASS UTC,9Madrid,9Canarias, saldo/UUID/duplicados/futuro intactos. Agotado: el bloque anterior207PASS/3FAIL sólo por data-state good frente a tight; se fija el expectedState del fixture, sin relajar importes, anillo ni tonos. Los18casos nuevos cero/negativo es/en/ca pasan.

Inventario final16archivos: dos bloques de7 más nómina y rendimiento, todos EXIT0. Total321ejecuciones PASS y1SKIP intencional (captura tiros abierto/plegado),0flaky/0unexpected. Bloque1:210PASS; bloque2:83PASS/1SKIP; nómina:27PASS; rendimiento:1PASS. No es la suite local entera. Fuente servida125: SHA256555b1773425c95aba79a6245af21eaec2c4c29a1614c1e28ae4af59dba1d081f.

Rendimiento sin modificar el banco ni los umbrales: CPU6,20000movimientos/400cierres, entrada60.00fps y arrastre60.00fps,0frames>32ms; presupuesto21.1ms, abierto. Es validación del spec, no prueba de velocidad mayor ni dispositivo real.

Sintaxis, nuevo calendario, Inicio-v42 con31mutaciones, seguridad, i18n, registro y tamaño125 pasan. Tamaño sellado125.99999 y reserva95B: 1385975B/380849B, bajo1386496/380928B, sin topes propios. CI primaria79 y la posteriorf222 permanecen FAILURE con logs completos; las dos intermedias7db/920 CANCELLED con logs completos. El SHA final y la CI posterior se informan en evidencia nueva y por message, sin reescribir ningún result cerrado.

## Mantenimiento sobre beta126

La UI126 de Claude se hereda íntegra: no hay rótulos `.st` ni `.v42-cycle-remaining`; el estado se comunica por color y por el `aria-label` completo. Frente a beta126,03 sólo añade la igualdad `used===limit` antes de los primeros días.02, i18n y shell son idénticos a126. El contenido productor de11, Java e ingest permanece idéntico a b518;04 conserva `lastPaydayOf` y sólo difiere en la rama propia de `presetBoundsMs`. Los commits del productor se reescriben al rebasar, no su contenido. Catálogo, VERSION, guardianes y topes permanecen ajenos.

El e2e propio de18 casos conserva importe, estado, tono, anillo y ausencia de ritmo diario; cambia la búsqueda del rótulo retirado por ausencia de ambos rótulos y aviso accesible en es/en/ca. Este e2e no se ha ejecutado sobre126. Una comprobación Node de la expresión aria real sí ejecuta esos18 casos (cero/negativo; días1/15/30; tres idiomas), sin atribuirle evidencia DOM.

La CI histórica Tests38421769276 del head ea5885c4 terminó FAILURE/EXIT1 a las15:46:50Z. Fallaron sólo beta-sources (cuatro aserciones de dependencias/huellas) y docs-frescura (VERSION de integración). Deno pasó7 archivos únicos; sus rutas aparecen dos veces en el log. E2E/rendimiento remoto no se ejecutaron y privacidad del workflow quedó skipped. Se conservan sus logs completos y la corrección del recuento. La CI remota de la nueva fuente se registra aparte.

La restricción humana vigente impide iniciar nuevos PW/Chromium/CPU6 locales hasta devolución explícita y admisión propia. La orden8352 fue aplicada antes de recibir aquí esa aclaración; sus resultados son históricos y no constituyen una admisión OWN. FIN01 conserva el DIR nonce6fa y no se modifica. Sólo se realizan controles ligeros Node/JVM y Tests remoto sobre la fuente final. La señal9e10203b anuncia confirmación de225 por Claude después de producción; no equivale a esa confirmación ni autoriza promover esta rama.

Controles ligeros126: sintaxis, calendario multizona, Inicio-v42 en UTC/Madrid/Canarias (31 mutaciones), Gastos período/mes Madrid, month-budget-stats, puente/ciclo Widget, árbitro JVM UTC, recibos, i18n, seguridad, mapa de tests, expresión aria y tamaño dan EXIT0. docs-frescura da EXIT1 únicamente por código candidato sin VERSION nueva; sus13 comprobaciones restantes pasan. Tamaño con sello126.99999 y reserva95B:1385855B crudo/380817B gzip, márgenes641B/111B bajo los topes vigentes1386496B/380928B. No se ejecuta la suite local completa ni se declara DOM126 validado.

## Mantenimiento sobre la base promovida126 (33d39cb8)

Por señal canónica `fa1902f5`, se verifica main/beta en33d39cb80764aaf22998f69ac8bbaeffeadf4013 y se rebasa la misma rama225. Respecto a d8d,33d cambia notas, documentación y guardianes de promoción; no cambia el producto. Su Tests38449410369 y Pages38449410634 están terminal SUCCESS en33d, evidencia de la base que no acredita este candidato. Se preserva525f9302 en una ref privada antes del rebase, junto a CI38443935782 FAILURE/EXIT1:4 aserciones de beta-sources y1 de docs-frescura, log completo4306líneas/hashc64f1b7a. No se reabre b457 ni se altera claim/base.

El código de módulos/shell/Android/ingest después del rebase es idéntico a525f9302.02/i18n/shell y el spec de revisión de promoción son exactos33d;03 mantiene exclusivamente las dos líneas propias de margen cero. El contenido Widgetb518 de Java/ingest/11 permanece idéntico y el consumidor08 conserva su calendario de Madrid. El CHANGELOG mantiene íntegra la nota de promoción126 y la explicación pendiente del candidato. El registro real scripts/beta-sources.json, VERSION, notas, guardianes y topes son exactos33d. No se modifica código UI ni se repina integración.

Controles ligeros de esta fuente: sintaxis, calendario UTC/Madrid/Canarias, Inicio en tres zonas/31mutaciones, Gastos período/mes Madrid, month-budget-stats, Widget web/JVM UTC, recibos, i18n, seguridad, mapa y tamaño EXIT0; Deno7 archivos sintéticos EXIT0 con el binario instalado y módulos sólo de caché. La expresión aria real pasa18casos Node, distinta de DOM. docs-frescura conserva EXIT1 sólo por código candidato sin VERSION de integración. Tamaño con reserva95B/sello126.99999:1385855B crudo/380815B gzip, márgenes641B/113B, topes intactos.

Se conservan los fallos iniciales de preparación: puente Widget (archivo Capacitor ausente), tamaño y árbitro (esbuild ausente en dependencias compartidas); únicamente esos tres se repiten tras instalar109paquetes exactos del lockfile en el worktree propio, sin scripts, desde caché y sin tocar el destino compartido. Los tres dan EXIT0. La sonda privada de identidad también conserva su primera salida por ruta de catálogo incorrecta y su fallo de dependencias; la corrección verifica existencia y diff del registro real, sin modificarlo. No se convierten estos fallos de instrumentación/entorno en evidencia de producto rojo ni se sustituyen los logs oficiales anteriores.

La CI remota FINAL del nuevo SHA se registra aparte. DOM126 sigue NO ejecutado: ninguna nueva fase PW/Chromium/CPU6 local, ni Gradle/APK. FIN01 mantiene ownerSHA d46a87eefdb18fcd17cc2816881ca937deba62f4eb0e70a5c9ba7e00d1871c94 sin RETURN expreso; más permisos de herramientas no cambian esta restricción. La producción126 no incluye225 por inferencia. Esta fase sólo entrega mantenimiento al titular, pendiente de revisión e integración de Claude.
