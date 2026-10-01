# OPS-3009-03 · integración panel75

Candidata local4.26.75 sobre merge real Recibos74 9ecd6a172e1c451016e6b4e102fa7b8e8bdc5359 (fuente idéntica a a004d16e). Delta de panel483e8874 revisado por Claude; el SHA integrado requiere su propia revisión. No publicada ni considerada servida. Recibos74 está servida y cotejada por el coordinador; el coordinador conserva el gate de75 y Chromium. Sin main/Android/Edge/SQL ni datos reales.

## Referencias y alcance

Siete referencias originales conservadas, sin repinar: TR, arranque y ayuda mantienen código idéntico y OK; fin05-widget-reentrada, fin05-pago-cerrada, widget-banco y widget-app-cerrada cambian en web por monthBudgetStats/dashboardBudgetStats de Inicio73 y pierden solo desde. Conservan historial, huella antigua, codigoDesde y revisionesDesde; hashes Android/Edge idénticos. APK51 conserva significado legado; widget52 es trabajo separado.

Inicio73 y Recibos74 tienen alcances explícitos de helpers y lectores. Recibos incluye identidad/prueba/elegibilidad/link/rekey, ficha y Plan; sus mutaciones cambian digest. No se afirma análisis automático ni cierre mágico del grafo de dependencias. Falta/ambigüedad en fuente activa aborta build. Histórico hasta67 no se reabre.

## Aprobación frente a entrega

Partes modernos por huella de guion+SHA; alias antiguo solo auditado con igual código. Rechazo71 se conserva separado del recibo74; último rechazo/retirada manda. Cambio de opinión remoto falla conservando aprobación; reset no borra retirada. Marcas viejas no completan código nuevo. Recibo web deriva fuente ensamblada; APK/Edge requieren evidencia propia, no Git ni versión numérica.

Bootstrap PR92 2f045a1e tiene CI36790590843 verde (480 DOM/perf ejecutados y1 captura opcional omitida; Node/Deno verde) y GO exacto de Claude informado por coordinador00:27:30UTC. Main sigue retenido por impacto de sello SW/ZIP. No se condiciona falsamente su gate a75.

## Verificación de candidata

Build correcto. 26 contratos de veredictos y5 de fuentes verdes. FullNode UTC22,8s: único fallo memoria-espejo por10 fuentes locales externas ya desfasadas; Deno ausente, no se reclama npm test completo verde. Los cinco mutantes salen1 por fallo semántico y ninguno por ReferenceError. Medida1.278.280 B minificado /347.946 B gzip9 frente a base74 1.275.031 /346.752 B. +3 KiB crudos1249 y gzip340 sin cambio; sin dependencias/CDN. DOM lease14:48 casos únicos comprobados. Primera pasada46/48 verdes en40,8s; dos fixtures fijadas (versión actual75 para guion74; recibo de entrega explícitamente ausente). Repetición acotada2/2 verde en3,0s,0flaky/0skip. es/en/ca verdes en la primera pasada. Siete módulos financieros, APK y195 notas históricas base conservados. No reclamar verde de npm test local: memoria-espejo tiene diferencias externas ya existentes y Deno no está instalado localmente. CI exacta y aprobación móvil pendientes.

Chromium lease14 liberado explícitamente al coordinador tras completar los dos casos corregidos. Sin navegador en ejecución de esta tarea. Fuentes finales requieren GO nuevo de Claude y CI exacta antes de publicación; no se reutiliza el GO483e8874.

Coordinador liberó74: CI36796405875 SUCCESS sobre9ecd6a172e1c451016e6b4e102fa7b8e8bdc5359,538 DOM+7perf/1skip. HTTP beta4.26.74.1 fp b0901f80ab92c94b, ZIP2b48dbcd77be6c7e9753879510bb73d230e79cf355ce8be57272b97ba5f0f3f6, SW4.26.74.1-2026-10-01-9ecd6a17, APK51 canal/ZIP iguales. Autorizó push de candidata y PR draft para CI, sin merge75 hasta GO exacto y gate final. Main67/APK48 siguen intactos.

Auditoría posterior al primer push reprodujo una dependencia omitida: mutar CAT_NEUTRAS no alteraba el digest de Recibos aunque fixedExpenseEligible/ficha la leen. Se añade el bloque explícito y guardián rojo→verde; cambia solo digest/recibo, no el motor ni el panel ejecutado en DOM. CI36797834391 cancelada por SHA obsoleto; revisión exacta/CI nuevas requeridas.

## Reparación de la clase de dependencias

Claude retiró GO6b9 y vetó7b/b770 (mensaje createdAt00:54:06UTC). Se amplía cada alcance con funciones concretas llamadas transitivamente00/01/08, incluidas const/flechas. Guardián561 mutaciones verdes, umbrales de categorías/notas/cuotas explícitos, whitelist razonada de transporte/traducción/telemetría. Parser delimitado por vm.Script, sin deps y sin ejecutar dinero; no es grafo de llamadas dinámicas/métodos ni prueba completa de todos los datos globales.

Auditoría ampliada real desde Git: TR17aeacc0 digestbc52c03907b58e369b540753e055c313309f072f80d5b860bc48fc4488b50814; ayuda17aeacc0 digest140f79ec7c3eb53e59b52b7c1cb015d129fdda75231f9082d3f54bb2512eb9fd; arranque269729 digest0ff7d998ea1e1084c074447210b3f4c568f896c8516a74c8640da7197bb2600c. Los tres coinciden con el código actual; solo la cobertura amplía el hash. Siete metadataoriginales de src intactas. Builder mantiene referenciaAnterior y compara contra la referencia histórica ampliada; cuatro widgets conservan código anterior y siguen nuevos/pending por cambio web real.

26veredictos y10fuentes/guardianes pasan en preparación. PinHEAD/SHA ajeno, digestforjado, sourceausente o helperTR mutado tienen guardia. CI7b36798260496 cancelada por NO-GO; ninguna de esas cabezas es entrega válida. Runtimefinanciero, panel, publicindex y e2e siguen idénticos7b; la build cambia digests y metadata externos. Nuevas Nodecompleta/ClaudeGO/CIexactas antesfreeze/publicar.

Root reprodujo un repin coherente conservando SHA antiguo y recalculando todos los hashes desde helper nuevo. Se cierra verificando por git show cada fuente real del commit auditado y descriptor histórico almacenado; no basta la coherencia de metadata. Guardia returnfalse/esTraspasoPropio con hashes forjados coherentes debe abortar; commit/archivo histórico ausente también. Tests exige fetch-depth:0. No render ni cálculo financiero cambiado.

Node final con lectura Git real:95,3s, único fallo memoria-espejo10 fuentes locales externas ya desfasadas; Deno ausente local. 26 contratos de veredictos y11fuentes/guardianes verdes;561 mutaciones de cuerpos más categorías/notas/cuotas, repin coherente returnfalse y fuente Git ausente. Cinco mutantes de veredictos verdes como guardianes (cada mutante falla conexit1 semántico, sinReferenceError). El HTML, e2e, metadataoriginales de src ytodos módulos de dinero son idénticos7b357fd9; min1.278.280 B/gzip9347.946 B sin aumento. DOM final48/48 PASS en30,5s, UTC y un worker, es/en/ca,0failed/0flaky/0skipped; informe test-results/panel75-final-dom.json. Lease15 liberado explícitamente tras terminar Chromium. Revisión de Claude y CI exacta pendientes sobre el SHA final congelado; no se reutiliza ningún GO anterior.

## Corrección de constantes tras NO-GO5532

Claude vetó5532a22c en createdAt2026-10-01T01:49:39.610Z: funciones e historia verificadas, datos financieros leídos sin cobertura. CI36802029020 cancelada y obsoleta; ningún GO de esa cabeza acredita esta reparación.

El lector recoge82 declaraciones concretas de datos de00/01/08, incluidas cachés múltiples de una línea. Cierre transitivo de llamadas y lecturas de identificadores/inicializadores; el análisis de identificadores es conservador, sin afirmar binding formal, aliases dinámicos ni cobertura de otros módulos. Se vigilan MC_TZ/cachés de frontera de mes, REC_GRACE, categorías/KW, CONFIG, lápidas y también divisa/formato numérico. benignData excluye solo textos/idiomas con motivo; propiedades, comentarios, textos y regex no cuentan, pero un identificador en ternario sí. Descriptores redundantes dentro de bloques ya cubiertos se eliminan. Un mutante que rompa un ancla debe abortar, no fabricar recibo.

Node completo final126,9s:26 contratos de veredictos y14 guardianes de fuentes verdes,629 mutaciones de funciones y209 de datos. Cambios semánticos MC_TZ→UTC y REC_GRACE3→4 invalidan revisión; referencia histórica permanece. Único fallo externo memoria-espejo10fuentes ya desfasadas; Deno ausente local. Informe test-results/panel75-data-node.log. No se reclama npm test local entero verde.

Ampliación histórica calculada de nuevo por Git real: TR17aeacc0 codigo900092316d5df0b190fb66b8f04490063a6f817519046ecfad61393e492e0cde; ayuda17aeacc0 codigo3e97e637144a7f84fce4846d2eb13c3836d54deb1d27a3e4aadbb8bd10723e11; arranque269729 codigo0ff7d998ea1e1084c074447210b3f4c568f896c8516a74c8640da7197bb2600c. Los tres igualan el código actual; src conserva intactas las siete referencias originales. Informe test-results/panel75-data-audit.json. Historial verificable contra Git, ausencia/repin coherente siguen abortando.

HTML/runtime financiero, e2e, Android/Supabase y apk.json idénticos5532/7b. La build regenera solo digests y metadata externos. Min1.278.280B/gzip9347.946B sin incremento. El DOM48/48 de lease15 pertenece al metadata anterior; liberado. DOM de los metadatos de constantes pendiente en CI completa exacta, sin volver a usar lease15 ni afirmar prueba local nueva. Fuente corregida requiere revisión exacta nueva de Claude y gate del coordinador; sin merge ni publicación.