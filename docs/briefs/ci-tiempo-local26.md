# Tiempo de validación · ensayo local del9/10/2026 sobre beta110

Corte del ensayo local9/10/2026: fuente beta110 `c7593e86f6665d69fa20bd3f5f8f20c4710a5d9c`, rama `codex/ci-tiempo-beta110-local26`. Primario11049 y matrices/nueve grupos PASS;131 de132 etapas Node acreditadas entre140+142, con1RED local de privacidad protegido. Deno0 y Chromium/perf omitidos localmente; la CI completa del SHA final debe verificarse por separado. El alcance preparado tiene12 archivos; la edición factual final sólo cambió cuatro docs sin ejecutar Node. La evidencia109, el primario/rojo136 y24RED140 se conservan; no se atribuyen a otra ejecución ni se ocultan.

## Alcance y compatibilidad

Doce archivos: nueve fuentes/docs/tests/scripts (`scripts/beta-source-code.mjs`, `scripts/beta-revisions.mjs`, `scripts/run-tests.mjs`, `tests/beta-source-context.test.mjs`, `tests/beta-sources.test.mjs`, `CHANGELOG.md`, `README.md`, `docs/TESTING.md` y este documento), más tres generados (`public/index.html`, `public/release-notes.json`, `public/beta-delivery.json`). Los dos parsers base110 son idénticos a Git `f4ffb934`; se aplican sus deltas revisados. El runner conserva la etapa `backclose-history` añadida en110 y registra el nuevo guardián después de `beta-sources`. Las secciones110 existentes de los tres documentos se conservan.

No modifica fuentes runtime, versión, dependencias declaradas/lock, Android, servidor, workflows, caps, catálogo fuente, registro de alcances, referencias históricas ni aliases. El primario136 exacto se preservó antes de editar el noveno archivo. Sólo su caso BackClose110 cambia de reader actual a fuente110 inmutable, manteniendo íntegros sus asserters109→110; añade un contrato independiente del candidato actual. Los demás casos y matrices permanecen literales, incluidos sus lectores actuales. La corrección pasó el primario49 en138 y140. La edición factual final del ensayo sólo cambió cuatro docs, sin Node ni nuevos cambios de scripts/tests, build, commit, PR, push o publicación en ese paso.

## Diseño y nueve guardianes

`revisionReader` conserva la lectura única y normalización CRLF que ya hacía `betaRevision`, con un contexto nuevo para cada llamada. Máscaras y fragmentos viven en ese contexto; sus claves usan fichero, texto exacto y descriptor completo. Los índices sintácticos de funciones/datos reutilizan los dos mapas globales originales, por fichero+texto completo normalizado y con cota32 por mapa. Los registros almacenados son copias privadas congeladas; todos los retornos públicos reciben copias editables. Ningún lector, fragmento, máscara, digest o revisión se comparte globalmente. Un contexto vivo conserva su índice aunque otro mutante lo expulse; el WeakMap no retiene lectores muertos, sin afirmar cuándo GC los libera.

Se conservan scanner, validación VM, delimitación, cierre transitivo, excepciones benignas, hashes y errores de alcance. Solo se memoiza trabajo exitoso. Los campos actuales de los índices son primitivos; las copias/freeze superficiales no presuponen estructuras anidadas futuras.

Los nueve grupos del nuevo guardián conservan bytes, asserters, datos y referencias de la candidata revisada: equivalencia sobre todas las unidades actuales; snapshot por revisión/cambios de igual longitud; mutantes funciones/datos/miembros/helpers/efectos/CRLF; descriptor mutable completo; errores repetidos; histórico8dcc; contaminación deliberada de registros/Map públicos; reutilización exacta entre lectores; presión40 variantes sobre cota32. El algoritmo de referencia procede de Git inmutable `f4ffb9340adfd0a13b631271e8158d2c630613c0`, leyendo los mismos inputs actuales que la candidata. En110 ese bucle incluye las37 unidades reales; los nueve grupos pasaron en136/138/140 y el primario corregido49 en138/140, con ambos contratos separados y matrices completas.

## Evidencia109 y límites

El diseño115 fue descartado: al retirar reutilización global, el micro de18 revisiones pasó835,966→1108,440ms (+32,59%) y4639→10970 compilaciones VM. Se conserva el rojo sintáctico114 y su corrección de cierre del fixture. V2 en118 pasó sintaxis y nueve guardianes; micro de18 revisiones en cuatro procesos nuevos:834,019→469,874ms (−43,66%),4639→4089 compilaciones. No sustituye la matriz completa.

Dos primeros adaptadores del primario completo fallaron sin concluir nada sobre B:122 omitía nueve casos META87 generados al inventariar nombres;125 rechazaba un fixture sintético explícito ya existente. Sus informes y adaptadores se conservaron. V3 corrige solo el observador:47 casos primarios exactos,152 inputs109 congelados, referencias Git separadas, guardas fail-closed de fuentes reales y allowlist exacta de nueve inputs sintéticos existentes. El test y sus asserters no se editaron.

ABBA127–130 ejecutó cuatro procesos nuevos serializados. Las implementaciones A/B eran diferentes, pero ambas leían todos los mismos bytes109 congelados, incluidos los scripts completos. Por proceso:47 casos PASS,1782 tuplas de funciones,701 de datos,3708 asserters y ocho errores de ancla esperados; resultados/errores/superficies/alcances/mutaciones exactamente iguales.

| Muestra | Variante | Tiempo primario instrumentado | CPU | Compilaciones VM |
|---|---|---:|---:|---:|
| A1 ·127 | base |303,947s|299,265s|1213733|
| B1 ·128 | V2 |128,708s|125,391s|1038685|
| B2 ·129 | V2 |127,925s|124,923s|1038685|
| A2 ·130 | base |305,149s|300,421s|1213733|

Media304,548→128,317s:−57,8666%,2,3734×; variación A1/A2:0,3949%, B1/B2:0,6105%. CPU media299,843→125,157s (−58,2592%); compilaciones−14,4223%. La instrumentación/observador forma parte de estos tiempos; no demuestra la duración sin instrumentar.

Igualdad canónica de los cuatro payloads: SHA-256 `9bf3b7fa5457c834295e978f33fffaab8e6e8b7d470c5e67819e6570b626d7f5`; serialización JSON UTF-8 con claves ordenadas y arrays en orden original, excluyendo trazas físicas/contadores pero incluyendo inputs, alcances, tuplas, resultados y errores. Resumen privado `ci-context-full-v3-abba130-summary.json`, SHA-256 `39c83142b5860eda663d55a9e8c0e66294ed7b1765811c95e87ce500ef091243`; adaptadorV3 `4f4ab2c46d30fbe1774d80e8080db62f4befb1b2addb3de4c2e0b77da5778c98`. Informes brutos, fallos previos, adaptadores y liberaciones explícitas siguen en el worktree109.

Esto acredita únicamente el primario completo local instrumentado109. No acredita runner completo, CI, RAM, rendimiento sostenido ni móvil. RSS no comparable: B1/B2/A2 cargaron/retuvieron un informe previo de aproximadamente185MB que A1 no cargó; máximo RSS incluye preparación hasta terminar la etapa. No se atribuye un pico al parser ni se deduce liberación de memoria.

## Rojo136 conservado y separación de contratos

La concesión inicial136 comunicada no estaba escrita: dos lecturas devolvieron135 y el preflight se detuvo sin Node. Tras corrección/readback real136 y liberación expresa135, se ejecutaron sintaxis3 (exit0), nueve grupos completos (exit0,4,104s) y comparación37 con algoritmo B/lectores separados (exit0,4,380s).35 revisiones completas permanecen exactas; únicamente `beta-panel-veredictos` y `ops-0410-panel-cola` cambian web/código. Ninguna delta native/Edge, de registro/alcance/referencias, historial o227 notas fuente. En el catálogo calculado sólo cambia web/código de `beta-panel-veredictos` en4.26.82; no se mantiene su identidad anterior ni aprobación por alias.

`node tests/beta-sources.test.mjs` actual completo, sin flags/adaptador:47PASS/1RED, exit1,140,506s observados. Ambas matrices exhaustivas pasan y el único rojo es «BackClose110 actual conserva las36 unidades109 y declara únicamente el cambio real de Brókers»: esperaba `[Brókers]` frente a109, pero el checkout posterior añade `[beta-panel-veredictos,ops-0410-panel-cola]`. El rojo se conserva; no es causa de regresión financiera demostrada ni un verde. El primario termina sin recortes; no exporta tuplas individuales en stdout y no se añadió instrumentación para capturarlas. Privacidad/frescura/map no se ejecutaron por stop de revisión.140,506s es wall time local observado, no A/B, CI ni comparación directa con ABBA.

ACK/resumen136 SHA-256 `45d3f49839b47157d7ebb440eb7efa6909b83552048f7aec8383d0e848c8ce4b`; log íntegro `6ed763fce63d55e31092bd0f89ea5544114b545c429d2203b3e94b19c01f5485`. Liberación expresa136, procesos propios/listeners4173–4473 a0, ocho fuentes y todas las evidencias previas exactas al cerrar. El primario136 antes de corregir se conserva byte a byte, SHA-256 `abf40ba4542fdcc065c533fdce3ee9677f8f9032960d4005351c9bb728edded9`.

Preparación autorizada: el contrato histórico109→110 usa lectores Git `f4ffb934`/`c7593e86`, manteniendo todos sus asserters:36→37, sólo Brókers,226 notas y cinco retiros/referencias intactos. Se añade un caso del candidato actual contra110:37 registro/alcances/referencias iguales,35 revisiones completas exactas, únicamente dos deltas web/código de scripts, otras superficies e historial intactos y227 notas/pendientes/rechazos exactos. La fuente110 fija sólo reemplaza al reader actual del caso histórico; en el caso nuevo110 es baseline y el candidato sigue en `read`. Todos los otros casos, matrices y sufijo/prefijo del archivo permanecen literales. No se actualizan referencias de registro ni se amplía el esperado histórico a tres.

La corrección se ejecutó en138 y140: primario49 y matrices exhaustivas PASS, nueve grupos PASS.138 pasó también sintaxis4/privacidad/frescura14/mapa13;143,060s de primario y4,184s del guardián son observaciones locales, no A/B ni CI. No concede aprobación móvil, hereda veredictos ni autoriza main.

## Runner140 y recuperación de dependencias142

Plan140 por interfaz existente: build:true,steps:all,deno:true,playwright:false,e2e:none. Ejecutó build y132 etapas Node sin filtros de etapas;359,537s observados, exit1,108 etapas retornan0/24RED. Primario49 y ambas matrices PASS, guardián9 PASS.23 fallos se producen antes de aserciones por paquetes declarados ausentes:21esbuild,1pngjs y1simple-icons.1RED independiente es memoria-espejo: aborta al detectar una cifra financiera local que el filtro no sanea, sin escribir ni copiar memoria cruda/importe. Script idéntico a Git110; no se editó memoria, filtro ni se añadió override. El control sintético sync-memoria sí pasó; no sustituye el control de memoria local.

Deno solicitado pero no instalado:0PASS; primer intento devuelve omisión explícita y los cuatro archivos restantes no se intentan. CI debe acreditar los cinco. Chromium/perf se omitieron expresamente, no se presentan como verdes. Presupuesto140 RED antes de medir por falta de esbuild; caps no se tocaron. Resumen140 SHA-256 `bb1f9dd0c7aaee3b5ab61d93fe28f464c4b84dce7c2d6dfab54e1430878da083`; todos los rojos/logs permanecen congelados.

142 restaura sólo el lock existente: npmci offline instala109 paquetes en4,286s, sin necesitar fallback de red, nuevas dependencias ni cambios de package/lock. Verificados esbuild/API/binario Windows0.25.5, pngjs7.0.0 y simple-icons16.30.0. El plan build:false/deno:false/playwright:false/e2e:none repite únicamente las23 etapas bloqueadas:23PASS, exit0,6,883s observados; no se repiten108 etapas, primario49 ni ABBA. Presupuesto oficial default PASS con reserva configurada,1295/353KiB/3 intactos; salida redondeada1294/353KiB y3 bloqueantes. No equivale a verificar un artefacto servido/sellado.

Resultado combinado del ensayo local9/10/2026:131 de132 etapas Node acreditadas en140+142;1RED local de privacidad permanece protegido. No se declara todo Node PASS ni validación total. Deno0/Chromium/perf se omitieron localmente; la CI completa del SHA final de la candidata debe verificarse por separado. Resumen142 SHA-256 `8fce6ab56d7b665be19e4ca66bf39aae2c5652bbe2cf8498be93313c68e06cf6`; liberaciones140/142 expresas, sesiones terminales y procesos/puertos propios0. Son tiempos locales sin atribución A/B, CI, RAM o móvil.

## Generados y corte de entrega

Build140 cambia exactamente tres generados y conserva sus bytes de tamaño: `public/release-notes.json` sólo cambia web/código de `beta-panel-veredictos` en4.26.82; `public/beta-delivery.json` sólo cambia los dos digests web declarados; `public/index.html` sólo sustituye `_rnSha` por el sello del catálogo nuevo. Comparación normalizada del resto de HTML exacta; los JSONen/ca siguen byte a byte iguales. Fuente runtime,227 notas fuente, guiones pendientes/rechazados, retiros y referencias permanecen exactos. Generados conservados sin restaurar ni stagear.

Inventario generado140 SHA-256 `a5d47c313e3873f6341c1c4904ff43b0bd4a87c2bdf6be7fbc9da4b93745618d`; diff `3e91aabc676134cf3ab2f5a5f3a0ee83a28afbc99254c7584641ec82000c8747`. Las comparaciones37 en136/138/140/142 usan algoritmo B y readers separados:35 revisiones completas exactas y sólo dos deltas web/código, sin superficies nativas/Edge extra ni referencia/alias de compatibilidad.

Corte comunicado por el coordinador al solicitar esta preparación final (9/10): integración194 enmain `798`, Publisher `37876949733` y Tests `37876949728` todavía pendientes; no entrega acreditada en ese corte. Es una integración distinta de esta candidata tooling y sus resultados no acreditan su CI final ni se heredan como aprobación. No se atribuye aquí una publicación del port.

## Identidad real y requisitos de entrega

El registro110 tiene37 unidades. Exactamente `beta-panel-veredictos` y `ops-0410-panel-cola` incluyen ambos scripts completos en alcance web con `unidades:true`; por ello sus cambios legítimos de identidad deben quedar visibles. Igualdad de algoritmos con reader fijo no demuestra igualdad entre repos distintos. El micro18 tampoco cubría esas dos unidades.

Después de editar docs, los mínimos Node son privacidad/frescura; mapa sólo si cambia estructura. No se repiten primario49,23 etapas,108 etapas ni ABBA por rutina. La revisión del alcance final12 y autorización de fuente final preceden al draftPR a beta; la CI completa de su SHA exacto debe verificarse por separado, incluidos Deno5/Chromium/perf que no cubre el plan local. El rojo de memoria local se conserva fuera del arreglo de caché. No se reescriben identidades ni aprobaciones para ocultar las dos deltas. Un nuevo rojo exige revisión, sin recortar oráculos ni inventar equivalencia.

El runner real se intentó completo en140 y la recuperación142 fue sólo23 etapas justificadas:131 acreditadas/1RED protegido. El coste observado del guardián queda separado en138/140, sin compararlo con CI ni afirmar ahorro del runner. El ensayo local no cubre los cinco archivos Deno, Chromium/perf ni la CI completa del SHA final; son requisitos separados de entrega. Como los scripts alimentan los veredictos/recibos del panel, este port no habilita main por ser tooling: cualquier cambio visible del panel necesita beta y revisión humana de ese alcance. La evidencia local no acredita publicación ni aceptación móvil; la entrega beta y la producción aprobada siguen sus requisitos de verificación. El coordinador es quien concede/libera el turno; este chat no escribe la coordinación ni recupera leases por reloj.
