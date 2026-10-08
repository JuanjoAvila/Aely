# Inventario de PR y rescates — coordinación local 26

Corte de lectura: **2026-10-08 17:39 UTC**. Inventario completo de **30 PR abiertas, 26 draft**: 183,182,181,180,170,151,146,141,134,131,110,108,106,105,103,100,96,92,90,88,87,86,83,81,80,78,76,48,44,43. Segunda lectura de la lista al terminar: mismas 30 identidades.

Este documento entrega decisiones y evidencia para que el coordinador integre o cierre después del rescate indicado. Esta auditoría no modifica runtime, no promociona, no despliega, no cierra PR ajenas y no comenta en ellas. Los números de PR y los números de versión son espacios distintos: PR103 no es versión103 y PR105 no es versión105.

## Estado que condiciona el inventario

| Referencia | SHA leído | Árbol |
|---|---|---|
| beta | `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5` | `7f290849b0f7b3ceef17b73463b48eb59a65f70c` |
| main | `56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b` | `849d951e3d24b6d132c154956e41479537e93982` |
| base documental codex/coordinacion | `a3e82236906848212da707c002886b8d386ab02d` | Base del inventario, sin integración de producto |

Producción HTTP sigue anunciando **4.26.98** y su recibo fuente coincide con main56c7e328. La entrega beta descargada del release **beta** anuncia **4.26.106.1**, huella `fe89bb7c152a10e8`, y recibo fuente8dcc5ed3. HTML, SW, notas y recibo se leyeron dentro del ZIP; apk.json externo y el del ZIP son idénticos. No se recalculó el hash del binario APK ni se instaló un dispositivo. La fuente nativa publicada sigue en **APK52 / 4.26.80**, no entrega unknownLoss de170.

La promoción de las tandas **99,100,101,102,106**, ya aprobadas por el usuario, y la reconciliación de su panel pertenecen a la tarea de promoción vigente. Este informe no vuelve a pedir aprobación ni ejecuta otra promoción. Su validación exacta del árbol y de los artefactos actuales sigue siendo necesaria; un verde de una rama o de una PR auxiliar no sustituye esa comprobación.

### Artefactos beta leídos

Assets del release actualizados a 2026-10-08T03:26:15Z. Hashes SHA256 recalculados sobre los bytes extraídos:

| Archivo en ZIP | Bytes | SHA256 |
|---|---:|---|
| index.html | 1317884 | `637cae52c58157e5e7c3da80260e31ca7382bfbca6b7778c629564ea350c3c0f` |
| sw.js | 4033 | `fb310b9bb4a20a3f71c4b45ab986884c553a7a37bb384e47c48652694add1726` |
| release-notes.json | 288104 | `0331ffc55ee004266c0aa2a1b83502a3ffae59382d953be8e8020e3a5eb5d05c` |
| beta-delivery.json | 28227 | `01d8aa5e1ff532962534984d516287e332c87a2ee98d07b878bcda022c95207f` |
| apk.json | 995 | `5170941b57568c5cc4972666fdd4275f502d2e5292c20af49c49e7abb3091539` |

HTML: APP_VERSION4.26.106.1. SW: `4.26.106.1-2026-10-08-8dcc5ed3`. Catálogo de 223 entradas: cabecera106,102,101,100,99,98,97,96,95,94; ninguna entrada103/104/105. Estos hashes verifican los archivos descargados, no aceptación humana ni instalación nativa.

## Matriz completa: conservar antes de cerrar

“Integrada” expresa equivalencia de la unidad indicada en las refs congeladas, no cierre de una incidencia real. Ninguno de los 30 heads completos es ancestro de beta/main: se compararon commits de integración, blobs de tests, helpers vigentes y cambios de fuente. La presencia de líneas fue una criba; las decisiones de equivalencia incorporan la lectura de los reemplazos indicados. Los números de líneas ausentes no son una medida de mejora ni autorizan un merge de ramas antiguas.

| PR | Unidad / decisión | Evidencia actual | Próximo paso serial | Qué se pierde al cerrar antes |
|---|---|---|---|---|
| [#183](https://github.com/JuanjoAvila/Aely/pull/183) | Tooling recuperable | Cuatro archivos propios: lifecycle-inflight, registro y docs. CI37810907496 SUCCESS; checkout y árbol idénticos al head. | Revisar GO y diff de cuatro archivos contra main fresco antes de integrar tooling. No cierre hasta conservar evidencia. | Contratos con pull retenido y respuesta antigua; no es reparación del lag. |
| [#182](https://github.com/JuanjoAvila/Aely/pull/182) | Diagnóstico / NO-GO producto | CI37799640112 SUCCESS; guard de bytes crudos y Plan serial. A/B no distingue mejora constante. | Rescatar helper/spec/contrato/acta como diagnóstico separado; cerrar CI ONLY sin merge después de preservar delta. | Ocho controles, hash crudo y medición serial. Su ancestry incluye beta no aprobada en ese corte. |
| [#181](https://github.com/JuanjoAvila/Aely/pull/181) | Diagnóstico / NO-GO producto | CI37798235197 SUCCESS tras recuperar 27 B. Selector excluye sheet; no demuestra mejora. | Preservar corrección de prioridad CSS en acta/prototipo182; cierre CI ONLY sin merge al reconciliar. | Control de sheet:none y reserva de tamaño, no una optimización aceptada. |
| [#180](https://github.com/JuanjoAvila/Aely/pull/180) | Diagnóstico / NO-GO producto | CI37772570681 FAILURE; prototipo con mc-p y fixture corregido. | Usar sucesor182 para evidencia; conservar primer rojo y riesgo de especificidad antes de cerrar sin merge. | Rojo previo y prueba de por qué un verde anterior no acreditaba ownership/sheet. |
| [#170](https://github.com/JuanjoAvila/Aely/pull/170) | Producto nativo recuperable / gate APK | unknownLoss no está en beta/main; CI37710922572 verifica árbol7fdb90ba. | Mantener draft. Integración futura con cinco códigos nativos nuevos, historial, revisión y APK firmada propia. | Persistencia conservadora de incertidumbre tras pérdida de identidad; APK52 no contiene esta fuente. |
| [#151](https://github.com/JuanjoAvila/Aely/pull/151) | Reemplazada parcialmente / ancestry recuperable | Gastos99 sustituye cierre/memo Madrid de d0a73ad4; no absorbe identidad/ACK heredados de146/141/131. | No merge. Separar propuesta UTC superada de familia Caixa aún pendiente. Conservar repro/mutante y enlace a99 antes de cierre administrativo. | Tests UTC y la ancestry financiera si se confundieran con una sola unidad absorbida. |
| [#146](https://github.com/JuanjoAvila/Aely/pull/146) | Producto financiero recuperable / NO-GO | Añade cierre transitivo de scopes sobre141; seis tests Caixa y helpers siguen ausentes. | Conservar junto a131/141; revalidar alcance en port mínimo actualizado, sin repins ni despliegue Edge por arrastre. | Prueba de dependencias histDate/obHistNoticeSeen/addExpensesBatch y cierre transitivo. |
| [#141](https://github.com/JuanjoAvila/Aely/pull/141) | Producto financiero recuperable / NO-GO | Port de131 sobre beta95. obExtCloudSuffix, ACK diario/histórico y tests siguen fuera. | Usar como fuente de integración futura, sin fusionar rama antigua. Reparación ISO/widget separada y fullguard pendientes. | Identidad/extId y concurrencia del importador; no absorbidas por99. |
| [#134](https://github.com/JuanjoAvila/Aely/pull/134) | Tooling absorbido y endurecido / residuo histórico | Exportador y 272 líneas de tests añadidos presentes en main/beta; versión actual agrega continuaciones entre párrafos. | Reconciliar saneamiento de docs y evidencia de NO-GO; cierre por sustitución135 tras comparar los 20 archivos. No merge de historia original. | Historia de rechazo y saneamiento; no hace falta restaurar el filtro menos estricto. |
| [#131](https://github.com/JuanjoAvila/Aely/pull/131) | Producto financiero recuperable / NO-GO | 626 líneas añadidas del motor no están en beta/main; seis guardianes y e2e Caixa ausentes. | Mantener. Extraer identidad/ACK/commit como unidad actual con revisión y suite; conservar rojo widget ISO sin canonizar fixtures. | Dos BOOK con referencias distintas, ACK exacto, setter diferido e histórico durante ACK. |
| [#110](https://github.com/JuanjoAvila/Aely/pull/110) | Integrada por equivalencia / doc residual | 26 líneas añadidas de motor presentes; removeReservaRule activo con limpieza de sent. Node reserva/paridad conservados; e2e evolucionado. | Rescatar constancia CI37118946223 y supersesión87→94 en brief actual; luego cierre sin merge. Edición de reglas y concurrencia siguen aparte. | Trazabilidad del GO final; no pérdida del contrato de liberación comprobable. |
| [#108](https://github.com/JuanjoAvila/Aely/pull/108) | Integrada por equivalencia / gate Edge | Runtime añadido de catálogo/i18n/motor presente; e2e Movilidad/Gasolina y tests exactos. Integración60d4863f ancestro de ambos. | Rescatar cierre final de CI/publicación en brief de Movilidad; cierre sin merge después. Fuente Edge idéntica no acredita deploy. | Evidencia final del injerto; clasificador servidor requiere verificación independiente. |
| [#106](https://github.com/JuanjoAvila/Aely/pull/106) | Integrada por equivalencia / doc residual | 102 líneas core,20 Gastos,10 App añadidas presentes. categoria-elegida y categoria-manual-persistente con blobs idénticos;2264e90e ancestro. | Anotar CI37111269065/absorción e identidad vigente en brief; después cierre sin merge. No recuperar bumps86 ni tests de catálogo viejo. | Cierre documental del candidato; no la lógica de categorías manuales. |
| [#105](https://github.com/JuanjoAvila/Aely/pull/105) | Producto nativo recuperable / reemplazada por170 | Normalización de journal y test offline no integrados. Port f6e1da fue NO-GO identidad;170 amplía protección. | Conservar brief inc-0210-04-widget-intermitente (ausente en ambos) y 110 líneas de test offline antes de cerrar como sustituida; comparar contra170. | Matriz transporte/offline/reinicio y explicación del formato; no asumir que170 conserva cada caso. |
| [#103](https://github.com/JuanjoAvila/Aely/pull/103) | Integrada / test equivalente | Commit runtime02bdff20 ancestro de beta/main; logs-privacidad del head idéntico. La versión81 fue corregida por82. | Cierre sin merge tras anotación81 no publicada/82 sustituta; ningún runtime que rescatar. | Sólo contexto de preparación; no confundir PR103 con WIP versión103. |
| [#100](https://github.com/JuanjoAvila/Aely/pull/100) | Integrada / doc residual | Runtime d45fb8b1 ancestro de ambos. retirada-bancaria Node y e2e exactos al head; QA actualizado. | Conservar limitaciones ACK/timeout y evidencia roja anterior en acta; cerrar sin merge. No recuperar scope provisional79. | Contexto de CI79 roja y cierre beta80; contrato de Retirada sigue presente. |
| [#96](https://github.com/JuanjoAvila/Aely/pull/96) | Integrada / mantenimiento posterior | eaf55e4a ancestro ambos; ob-ingresos y nomina-anticipada exactos; guarda positiva BOOK/fecha Madrid presente. | Cerrar por absorción tras actualizar encabezado histórico76→78/80. No restaurar catálogo ni fixtures75. | Historia del injerto; no el filtro de ingresos cobrados. |
| [#92](https://github.com/JuanjoAvila/Aely/pull/92) | Tooling sustituido / brief ausente | Build ya emite recibo web; refs beta/main y HTTP lo prueban. Reloj/fixtures y tests principales conservados, fuentes ampliadas. | Rescatar beta-delivery-bootstrap con cabecera histórica: A/B byteigual, CI36790590843 y efecto SW pese a VERSION fija; luego cierre sin merge. | Explicación del efecto de reseal y recibo, hoy sólo en la PR. |
| [#90](https://github.com/JuanjoAvila/Aely/pull/90) | Integrada / gate externo | Cinco Java modificados son blobs idénticos a beta/main; web y tests widget conservados. APK52 publicada. | Cerrar por absorción después de reconciliar acta y gate de APK/Edge instalado/activo; no declarar incidencia humana cerrada. | Trazabilidad de APK obsoleta/NO-GO160 frente130 y posterior reparación, no Java exclusivo. |
| [#88](https://github.com/JuanjoAvila/Aely/pull/88) | Reemplazada por100 / integrada | Fuente temprana de Retirada superada por d45fb8b1 y test vigente más amplio de100. | Conservar comparación con100 y límites de efectivo/ACK; cerrar sin merge después de rescate documental si falta. | Sólo historia del primer contrato; no reintegrar flushSync/identidad anteriores. |
| [#87](https://github.com/JuanjoAvila/Aely/pull/87) | Reemplazada por90 / gate Edge | Contrato widget inicial sustituido por v2 de90; Java antiguo difiere deliberadamente; presupuesto/ingest también difieren. | Conservar acta/repro de compatibilidad legacy-v2; verificar fuente servidor efectiva antes de cerrar por sustitución. No merge. | Evidencia Edge/ventana que una APK sola no entrega. |
| [#86](https://github.com/JuanjoAvila/Aely/pull/86) | Documentación recuperable | Tres briefs nocturnos/reclamación/relevo NO existen en beta/main. | Rescatar relato saneado del rechazo y siete títulos con cabecera histórica, sin rutinas/roles caducos; luego cierre sin merge. | Evidencia de que panel75 no satisfizo petición humana y pendientes nativos. |
| [#83](https://github.com/JuanjoAvila/Aely/pull/83) | Sustituida / documentación recuperable | Huella actual incorpora código64 y recibos por superficie; parser acepta huella8:64. Tests/contrato evolucionados. | Rescatar beta-panel-veredictos como historia75 y enlazar82/92/93. Cerrar sin merge; no restaurar comparación sólo número APK. | Motivo de aprobaciones repetidas y alias históricos, brief ausente. |
| [#81](https://github.com/JuanjoAvila/Aely/pull/81) | Integrada / equivalencia verificada | inicio-cargos y fixed-payment-state exactos; receiptLinked usa withdrawalReceiptLink y misma prueba de pago ampliada. | Anotar integración74/80 y fixture posterior; cerrar sin merge. Preservar limitaciones de RLS/aceptación real. | Constancia CI36788840453 y su relación con integración, ya detallada en PR. |
| [#80](https://github.com/JuanjoAvila/Aely/pull/80) | Integrada / equivalencia verificada | inicio-mes-natural, month-budget-stats, budget-notis-deps idénticos. monthBudgetStats añadió selectedPeriod posteriormente. | Cerrar sin merge tras reconocer helper split/dashboard y lectores conservados; no restaurar firma antigua. | Sólo estado histórico de publicación73, no cálculo natural. |
| [#78](https://github.com/JuanjoAvila/Aely/pull/78) | Reemplazada por96 / integrada / integrada | Filtro negativo inicial OB_NO_COBRADO sustituido por guarda positiva status!=BOOK y fecha válida/cobrada. | Conservar límites de PDNG previo y fuente final eaf55e4a; cerrar sin merge. No volver al filtro que admitía estados desconocidos. | Historia de la primera causa; tests originales ampliados por96. |
| [#76](https://github.com/JuanjoAvila/Aely/pull/76) | Reemplazada por81 / integrada | fixedPaymentState fue ampliado con prueba durable/enlace. DOM Plan/fixed-day/plan-charges conservados. | Cierre por sustitución81 tras cabecera histórica71→74. No reintegrar versión anterior de paid/overdue. | Primer rojo de recibo wait y distinción previsto/confirmado. |
| [#48](https://github.com/JuanjoAvila/Aely/pull/48) | Paquete externo recuperable / gate Edge | Paquete ops01-categorize, prepare-categorize-package y test handler ausentes en beta/main. | Mantener. Releer función activa/permisos actuales; paquete exclusivo y rollback, revisión/CI nuevos si drift. No deploy en esta auditoría. | Preflight de cuatro fuentes, intento403 histórico y rollback reproducible; source actual distinto no prueba deploy. |
| [#44](https://github.com/JuanjoAvila/Aely/pull/44) | Forense/documentación recuperable | FIN05-CONCILIACION ausente y12 líneas de mensajes listo no presentes; herramienta actual evolucionada. | Rescatar conclusión sintética del editor/lápidas y límite de identidad con fecha histórica; portar sólo mensajes aún ciertos. | Repro de renombrar A→B→A y distinción mismas sumas/mismas filas; no copiar consultas privadas. |
| [#43](https://github.com/JuanjoAvila/Aely/pull/43) | Producto financiero recuperable | 46/50 líneas core añadidas y expense-source-ack106 líneas ausentes; métodos UUID parcial/CAS no absorbidos por categoría106. | Mantener. Port y pruebas sobre base efectiva, con cola/UI pendiente propias; validar conflictos/ACK/RLS sin datos reales. | FIN04.1 de source parcial: banco/decisión, cero filas y actualización concurrente; categoría manual no lo reemplaza. |

## Identidades congeladas de las 30 PR

| PR | Head exacto leído | Árbol del head | Check visible del head |
|---|---|---|---|
| #183 | `11e516ced5f9a270c01aec89767ac1423bc5f58a` | `506923d7f45fc72cc113e1f16f20fd0f998a6aa4` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/37810907496/job/113427186085) |
| #182 | `e404dd3960d356161674de34b2adc51928dc283d` | `434746f4ea60d1c44f15c3d672015f3586eb79fe` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/37799640112/job/113388110889) |
| #181 | `0d443254b4327b79db3a540cc617e36c036fd8b1` | `3586fc3b196f0d1472f223860e1e4b2b0c4c446a` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/37798235197/job/113383215204) |
| #180 | `fe4f1a5487be588c91b8c67886b6697779d60087` | `8620092f3255293bd15770613eee2401b80ced66` | [FAILURE](https://github.com/JuanjoAvila/Aely/actions/runs/37772570681/job/113295486977) |
| #170 | `f4142b0e3d0b14bbb50623c9d6842e7ee8258a16` | `7fdb90ba2b003c077714a02b82251c0bd48745b2` | Sin check visible; no equivale a no haber otra CI de verificación |
| #151 | `d0a73ad4a4e6ec95efca7c2f8df1aa5cae8597dc` | `ef917f4b42964bdc57eb9c0cf26adbb6fee9bccf` | Sin check visible; no equivale a no haber otra CI de verificación |
| #146 | `6592b17907c6597e088340005ca343b9d6fda0c8` | `8b87033d530a2a27a2891881b62333c8c3a31aa6` | Sin check visible; no equivale a no haber otra CI de verificación |
| #141 | `4becee158124e50349b466202ec49c383e5529b0` | `8d018d811fa378245560657763ba45c0a5f87a5d` | Sin check visible; no equivale a no haber otra CI de verificación |
| #134 | `7e5f1f396d1dc92053f1a5fabaad9a56e58cce42` | `0c11d19d684b146c539b697ab5264fbccfa9dbbb` | [CANCELLED](https://github.com/JuanjoAvila/Aely/actions/runs/37367989594/job/111957743811) |
| #131 | `b797e3b230c71cca9ddb5efb07a6c40467c3e6fe` | `c2c716f7feb0d993567bf7643ebc126a94d0fa0e` | Sin check visible; no equivale a no haber otra CI de verificación |
| #110 | `bab0d0a301843e2c2ce068bb45a292e785f88f75` | `829a34a3374228ac8b62cb7e863d3b2871b65536` | Sin check visible; no equivale a no haber otra CI de verificación |
| #108 | `2205d9632e85e4ba7867838d6d15608baf392730` | `a187dd42514e8c907a0409fd64c611f68ea52c46` | Sin check visible; no equivale a no haber otra CI de verificación |
| #106 | `9a232f1f01550c4413704c75dc560eb6521d2d7e` | `9b23cd19edd96858f50f24292bbb0d883a52d9f6` | Sin check visible; no equivale a no haber otra CI de verificación |
| #105 | `9711219766449e4e7c50081b00f7f4da7d7abd1e` | `9c702bc142176cd724dc906ea3e79c9ca08683ab` | Sin check visible; no equivale a no haber otra CI de verificación |
| #103 | `931d802a502470e09124a9da986c76a0ed4449d3` | `b18d181c63bf08ca9f33670a178f6affaba4d70f` | Sin check visible; no equivale a no haber otra CI de verificación |
| #100 | `5dab22a8c8eff485ba6751e0e59184f1808a5454` | `230981eb0dbcf2172e61cdfd4e052bd6d56e70ff` | Sin check visible; no equivale a no haber otra CI de verificación |
| #96 | `8941adfc46e92f0264a18e465b421d7f2bc848b4` | `8c8bd7cf7b6ae10106f379068507de39d3eb3d72` | Sin check visible; no equivale a no haber otra CI de verificación |
| #92 | `2f045a1e21e55b612b4483e63e9633f7ccf79235` | `44f1a90f7a6514fae382188a706ce1c2270678a9` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/36790590843/job/110142299690) |
| #90 | `821733fc7d65c895e288dba74d4ed412d01b3285` | `9cddeef5137e6534578afd36a89992111eec1770` | Sin check visible; no equivale a no haber otra CI de verificación |
| #88 | `11a7e3dfebd710af4b31b66d01a84569b7c2eed4` | `0b7fb238881557e7387efd48f6bd41aa2e7811a6` | Sin check visible; no equivale a no haber otra CI de verificación |
| #87 | `26c2fd082959f168323b6df221b14af71b36953e` | `9fddd68d52563226cd70fa2e36dfac87a0b5a9fe` | Sin check visible; no equivale a no haber otra CI de verificación |
| #86 | `d5c43596f2d6ca08905062311f24ca23bbda9b2a` | `597933716a7f581feb3603f3f4b7530192f3c37c` | Sin check visible; no equivale a no haber otra CI de verificación |
| #83 | `e7fec4b446936ffa4361867b8d8ebdb75656d72b` | `71ef6d21926c386525c8b7d84af62be15580a8ab` | Sin check visible; no equivale a no haber otra CI de verificación |
| #81 | `3170a9aaceef4e90ce6bc1586a3973c330802ebf` | `92e0c7454b163892eeeb91015459e28eacdb2333` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/36788840453/job/110136621854) |
| #80 | `3912aa1164278a1e7b67d9f37b19897771701ace` | `3e704fc5c69d36f979ff34e43c59b0c9933adeb9` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/36773669265/job/110086090940) |
| #78 | `f37d605968f41c54487e10f50115dcaf6bc22c29` | `fb1d99fc519c98ba6f6fd06531b2486d13c90ed2` | Sin check visible; no equivale a no haber otra CI de verificación |
| #76 | `1e2395b9afb63eff1a89e6f03b6f3444cdb17e19` | `00cea37d1b96d1bc7c4aee899c16a83e29f3abf8` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/36762809092/job/110049387609) |
| #48 | `1ddcf25cd2ace00e405287491003aa958a43130c` | `45347b95e00ce3699b1812901fe9bb06ebf3b3d3` | [SUCCESS](https://github.com/JuanjoAvila/Aely/actions/runs/36320201056/job/108622444636) |
| #44 | `2050ce327bc931510742c3c582a9faf36155da89` | `b9bb8f9c7962e214b459fecdc958f99d323aa896` | Sin check visible; no equivale a no haber otra CI de verificación |
| #43 | `bf450c0b54828e3c0f59f3c6955e30e569f94355` | `3552aaa2f0aab5c0c7fd0b7c71d73efec4187b62` | Sin check visible; no equivale a no haber otra CI de verificación |

## Versiones fallidas, no publicadas y ramas CI ONLY

### 103: Plan sin entrega verificable de ese árbol

Fuente WIP `codex/plan-animation-wip103-relay21`, SHA `9a0dddb4d29d7de74ded68ff4c4a21ad124c1167`, árbol `e9ba7a8d3553d2b48e05da855059c76a0e5a37b1`. Su acta inc-0710-plan-animation-cleanup103-relay21 mantiene **NO-GO**: cero guardianes de103 y cero DOM de103; el build abortó, el locator se ajustó sin rerun y public/index.html conservaba102. El presupuesto cero medido era102, no103; 32 scopes y 222 notas no se habían auditado. Conservar diagnóstico y el rojo; no rescatar un catálogo o un bundle como producto terminado.

La [PR103](https://github.com/JuanjoAvila/Aely/pull/103) antigua pertenece a preparación81 y su runtime02bdff20 sí está integrado. No tiene relación causal con ese WIP103.

### 104: hueco sin evidencia de entrega

No se encontró entrada en notas, artefacto servido ni una entrega de fuente verificada correspondiente a104. Registrar **sin entrega verificable**; el salto numérico no demuestra una función perdida que haya que reconstruir.

### 105: candidato widget aislado, sin APK propia publicada

Fuente `codex/widget105-isolated-source-relay21`, SHA `f6e1da025b34140aa4bad6a52393307542ff9bb0`. Portaba la normalización del journal de PR105. Tests locales de formato/dedup:205; comprobación independiente:88. [CI37691886612](https://github.com/JuanjoAvila/Aely/actions/runs/37691886612) terminó FAILURE: cinco identidades nativas cambiadas, 27/32 iguales, web/Edge iguales; la pérdida por overflow seguía sin reparar. **Source only / NO-GO**, sin APK publicada de105.

[PR170](https://github.com/JuanjoAvila/Aely/pull/170) conserva una continuación más amplia con unknownLoss. El árbol exacto se verificó en otra PR de CI; sigue siendo source, sin integración ni APK nueva. No cerrar105 antes de preservar la matriz offline/reinicio y revisar qué pruebas no conserva170.

### Plan180→181→182: recuperar instrumentación, mantener NO-GO de producto

Las tres PR son **CI ONLY**, con ancestry de beta: nunca fusionarlas completas a main. 180 fue roja;181 corrigió el selector que podía imponerse a sheet:none y retiró redundancia CSS (27 bytes crudos / 3 gzip). La variante previa había excedido presupuesto en18 bytes antes de E2E. 182 añade guard de bytes crudos, ocho controles y aislamiento serial de los grupos Plan.

El A/B de182 no demuestra mejora constante. Número de frames rAF >32ms por dos pasadas:

| Grupo | beta | main | candidato182 |
|---|---|---|---|
| Recibos | [1,0] | [1,0] | [1,1] |
| Deudas | [1,1] | [1,0] | [1,0] |
| Metas | [0,0] | [0,0] | [0,0] |

No hubo frames >32ms tras el cierre en esas pasadas. No reproduce ni cierra el lag humano sostenido. Rescatar helper/spec/contrato y acta como diagnóstico independiente; conservar que `html:not(.sheet-open) .page.page-scroll-host.mc-p` evita el conflicto de especificidad cuando una sheet exige none. Un posterior trabajo de producto necesitaría otra reproducción discriminante y revisión propia.

### 183: tooling con CI terminal, no entrega de producto

[CI37810907496](https://github.com/JuanjoAvila/Aely/actions/runs/37810907496) completada SUCCESS. Cuatro archivos: e2e/lifecycle-inflight.spec.mjs, scripts/relevant-tests.mjs, docs/TESTING.md y docs/briefs/inc-2709-09-lifecycle-network-v3.md. Checkout merge37ac7d3b, árbol igual al head11e516ce; 843 funcionales y11 rendimiento verdes, privacidad OK. Lecturas retenidas/respuestas tardías están cubiertas en el banco; no atribuirle reparación del lag ni nueva aceptación móvil. Revisión de fuente exacta/diff contra main vigente antes de integrar tooling; no necesita rerun por haberse leído su estado terminal.

Actualización recibida del coordinador al cerrar el informe: su lectura de esos cuatro archivos no encuentra bloqueo y conserva cleanup y límites de mismo payload. Revisión registrada en su evidencia privada; integración de tooling en cola después de las tandas aprobadas. No se publicó comentario público de esa revisión y este inventario no intenta publicarlo por otra vía. El estado de integración sigue pendiente.

## CI de verificación: distinguir head, checkout y árbol

Logs oficiales de checkout leídos y objetos contrastados con Git. Las PR auxiliares pueden verificar una fuente aunque el propio head no muestre checks. Guardar esta relación evita declarar “sin CI” por mirar sólo el panel de la PR de fuente.

| Run | Estado terminal | Head del run | Checkout ejecutado | Árbol ejecutado |
|---|---|---|---|---|
| [37710922572](https://github.com/JuanjoAvila/Aely/actions/runs/37710922572), widget170 | SUCCESS | `b58fc98771f4144a90f41236cbe8f417bf42efb2` | `4f8f7a321bd6273a4034edea41b7671a00cb7b71` | `7fdb90ba2b003c077714a02b82251c0bd48745b2`, igual a170 |
| [37772570681](https://github.com/JuanjoAvila/Aely/actions/runs/37772570681), Plan180 | FAILURE | `fe4f1a5487be588c91b8c67886b6697779d60087` | `13f63fa36ba8a58016750dd294ac0e3b97c42ff0` | `8620092f3255293bd15770613eee2401b80ced66` |
| [37798235197](https://github.com/JuanjoAvila/Aely/actions/runs/37798235197), Plan181 | SUCCESS | `0d443254b4327b79db3a540cc617e36c036fd8b1` | `04c85b7f970e55617aa3eae82ca005d64b93e0f8` | `3586fc3b196f0d1472f223860e1e4b2b0c4c446a` |
| [37799640112](https://github.com/JuanjoAvila/Aely/actions/runs/37799640112), Plan182 | SUCCESS | `e404dd3960d356161674de34b2adc51928dc283d` | `7d0f1ee25c0910b76de17f8a4205720773d986d9` | `434746f4ea60d1c44f15c3d672015f3586eb79fe` |
| [37810907496](https://github.com/JuanjoAvila/Aely/actions/runs/37810907496), tooling183 | SUCCESS | `11e516ced5f9a270c01aec89767ac1423bc5f58a` | `37ac7d3bf94f178d1a11118c41425771950c291c` | `506923d7f45fc72cc113e1f16f20fd0f998a6aa4`, igual al head |
| [37718742824](https://github.com/JuanjoAvila/Aely/actions/runs/37718742824), publisher beta | SUCCESS | Fuente8dcc5ed3 | `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5` | `7f290849b0f7b3ceef17b73463b48eb59a65f70c` |
| [37736997197](https://github.com/JuanjoAvila/Aely/actions/runs/37736997197), Pages main | SUCCESS | Fuente56c7e328 | `56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b` | `849d951e3d24b6d132c154956e41479537e93982` |

Widget170:884 funcionales +1 omitido /9 rendimiento. Plan182:884 funcionales +1 omitido /20 rendimiento, siete casos Plan seriales. Publisher beta:884 funcionales /13 rendimiento. Pages main:841 funcionales /11 rendimiento; [Tests37736997159](https://github.com/JuanjoAvila/Aely/actions/runs/37736997159) también SUCCESS. Las cantidades difieren por árbol/suite; no sumar verdes ni equiparar producto con instrumentación.

## Por qué ocho números publicados no son ocho incidencias resueltas

El catálogo permite citar96/97/98/99/100/101/102/106 como versiones servidas en el recorrido auditado. No permite cerrar ocho incidencias. 97 tuvo rechazo y fue sustituida por98; conservar la historia del rechazo. 98,97,96 llevan tandas vacías en el catálogo actual, no borrar por ello su historia.

Las cinco unidades explícitas vigentes son:

| Versión | Tanda del catálogo actual | Alcance |
|---|---|---|
| 99 | inc-0710-gastos-mes-madrid | Cierre del mes Gastos en Madrid; no absorbe la familia de identidad Caixa131/141/146 |
| 100 | inc-0710-appstate-listener-cleanup | Limpieza de listener AppState |
| 101 | inc-0710-banknotif-cleanup | Limpieza de listener de notificaciones bancarias |
| 102 | inc-0710-auth-disposal | Suscripción/callback de sesión |
| 106 | inc-0810-dashboard-recents-memo | Memo de movimientos recientes al abrir/cerrar presupuesto |

INC-2709-09, lag progresivo en uso real, sigue **OPEN**. Las mejoras sintéticas y disposals no acreditan el escenario real; instalación APK/función Edge son gates independientes.

## Orden de rescate para el coordinador

1. Terminar el trabajo de promoción99/100/101/102/106 y panel en su tarea vigente; ninguna mezcla de ramas CI ONLY. Los trabajos vivos de indicador de navegación, significado del gráfico y edición Metas tienen dueño propio y no se incorporan al inventario como entregas.
2. Para108/106, rescatar primero el cierre documental final en sus briefs: CI37118946223 corresponde a110, CI37111269065 a106; integración60d4863f de108 y2264e90e de106 ya son ancestros de beta/main. Revisar el CI final específico de108 antes de afirmar una corrida no comprobada aquí. Tras conservar la evidencia faltante, el coordinador puede cerrar108/106 por equivalencia, sin merge ni bump histórico.
3. Rescatar documentación ausente de86/83/92/44 con cabecera histórica y relato saneado. Conservar el rechazo humano de panel75 y los siete títulos; no reinstalar rutinas ni roles antiguos. Para105 comparar la matriz offline contra170 antes del cierre por sustitución.
4. Registrar sustituciones/equivalencias de103/100/96/90/88/87/81/80/78/76/110 y134 según cada fila; gates externos siguen abiertos. Cerrar una PR administrativa no cierra una incidencia humana.
5. Mantener fuentes recuperables43 (UUID parcial/CAS),131/141/146 (Caixa identity/ACK),170 (unknownLoss/APK) y48 (paquete exclusivo categorize). Rebase/port mínimo, pruebas y revisión actuales antes de decidir integración. No arrastrar bump, catálogo o fuente Edge por un cherry-pick antiguo.
6. Recuperar diagnóstico180/181/182 separadamente; revisar183 como tooling de cuatro archivos con CI terminal. No anunciar ganancia de rendimiento humano.

Las decisiones son propuestas de cola, no cierres ejecutados. Si cambia beta/main, actualizar primero el corte y volver a comprobar las unidades afectadas.

## Grok: solicitud enviada, actividad no confirmada

La evidencia pública contradice la reserva heredada: [comentario6043055926](https://github.com/JuanjoAvila/Aely/issues/130#issuecomment-6043055926), 2026-10-07T17:19:53Z, dice que Grok estaba libre; [6018848769](https://github.com/JuanjoAvila/Aely/issues/130#issuecomment-6018848769), 2026-10-06T14:48Z, liberaba la reserva UTC. Mensajes posteriores del coordinador que conservaban la reserva no son ACK nuevo. La propuesta de151 quedó NO-GO de alcance y el motor99 vigente procede del trabajo coherente posterior.

La petición nueva es [6065018856](https://github.com/JuanjoAvila/Aely/issues/130#issuecomment-6065018856), 2026-10-08T17:04:45Z. El task.json público de pro-02-0810-chart-meaning-grok-local fue creado a17:05:23.873Z, base8dcc5ed3, exige ACK/RESERVA en issue130 antes de editar y delimita Dashboard/UI/i18n/e2e/doc. En la lectura final de ese canal seguía siendo el último comentario: **sin ACK nuevo**. El directorio contiene task.json; su falta de claim/result no bastaría por sí sola, porque el contrato admite ACK en issue130.

No hay una herramienta disponible de scheduler/proveedor de Grok ni sesión visible de Grok en las superficies examinadas. La rutina local del coordinador menciona vigilancia de colaboradores, pero no demuestra una ejecución de Grok. La confirmación de rutina privada/selectiva de cuatro horas se conserva como autorización; por sí sola no prueba el último disparo. **La causa de la falta de ACK queda sin verificar.** El paso útil es consultar la rutina existente en el proveedor y su última ejecución/error; no crear otra instancia ni contar la solicitud como trabajo activo. No se modificó ningún scheduler ni se emitió recordatorio a un tercero en esta auditoría.

## Método y límites

Lecturas: Git fetch de refs actuales, lista completa de PR/heads/files/commits/checks, cambios contra merge-base, equivalencias de commits de integración y blobs de guardianes, lectura de helpers vigentes, logs oficiales de CI y checkout, artefactos beta descargados y HTTP público de producción. Para equivalencias financieras se conservaron límites de ACK, fecha, concurrencia y RLS; no se consultaron filas privadas, secretos ni proveedores bancarios.

Se reutilizó historia como pista, pero las decisiones del corte se contrastaron con fuentes actuales. No se ejecutó npm test, build ni navegador de producto: el cambio propio es un solo documento. Las pruebas de CI citadas son evidencia externa del árbol indicado. La auditoría de artefactos de producción cubre version.json, apk.json y recibo; no compara íntegro un ZIP de producción ni acredita SW instalado.

Validación de la entrega documental: comprobar 30 filas y30 heads únicos, ausencia de rutas locales/datos personales, git diff --check y guard-privacy. El worktree y la rama propios se conservan para revisión; ningún WIP, rama o worktree ajeno se limpia ni se borra.
