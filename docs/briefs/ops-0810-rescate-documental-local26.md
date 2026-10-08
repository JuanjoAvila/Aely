# Rescate documental de ocho PR — coordinación local26

**8/10/2026.** Continuación del [inventario de30 PR](ops-0810-inventario-rescates-local26.md), ya preservado mediante [PR184](https://github.com/JuanjoAvila/Aely/pull/184), merge `e56d47cd`. No se repite la auditoría de30 fuentes ni se ejecuta implementación.

Base propia de lectura: coordinación `34fec9d560477b2d9a11ca984d20a0c32da017fe`. Contraste de producto: main `56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b` y beta `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5`. Son refs congeladas, no una promesa de estado servido después del corte.

## Resultado concreto

Se compararon **42 pares PR/documento, 29 rutas distintas**, de108/106/110/134/86/83/92/44. Seis briefs no existían en ninguna de las tres refs; tres briefs financieros ya conservaban el contrato y su ampliación de integración. Los14 documentos de memoria saneados de134 son blobs exactos en main y beta; su ausencia parcial en coordinación no justifica copiar procedimientos históricos a esa rama.

El rescate añade tres briefs históricos saneados y este registro; amplía tres briefs existentes sólo con constancia final de CI y límites; corrige la identificación del sucesor134 en el inventario. Todo queda bajo docs/briefs. No se añade verificador permanente que el runner no ejecute.

| PR / head fuente exacto | Qué se conserva ahora | Destino | Qué se descarta o no se vuelve a copiar |
|---|---|---|---|
|108 · `2205d9632e85e4ba7867838d6d15608baf392730`| CI final37116952467 SUCCESS,666 funcionales +7 rendimiento; corrección del total673 y vínculo de integración60d4863f.|[Movilidad](feature-0310-01-movilidad.md), adición fechada.| Gasolina/Taxi tiene blob idéntico en las tres refs. Contrato Movilidad ya íntegro. No restaurar roadmap/version88 ni atribuir CI de fuente a la unión o entrega Edge activa.|
|106 · `9a232f1f01550c4413704c75dc560eb6521d2d7e`| CI final37111269065 SUCCESS,654 funcionales +7 rendimiento; integración2264e90e y fronteras de ACK/concurrencia.|[Categoría elegida](inc-0210-02-categoria-elegida.md), adición fechada.| No duplicar el contrato ni el acta beta85 ya conservados. No recuperar bump86 o declarar RLS/móvil por equivalencia.|
|110 · `bab0d0a301843e2c2ce068bb45a292e785f88f75`| CI final37118946223 SUCCESS,663 funcionales +7 rendimiento; unión039d3036 y límites de huérfanas/last-write-wins.|[Borrar regla](inc-0310-01-meta-regla.md), adición fechada.| Contrato y cierre local ya presentes. No rehabilitar CI canceladas c88/1fc, ni absorber la edición nueva de reglas por asociación.|
|134 · `7e5f1f396d1dc92053f1a5fabaad9a56e58cce42`| Relación de sustitución **142**, squash537edc1c, CI37469376085, igualdad de14 blobs y exportador posterior más estricto.|Este registro y errata del [inventario](ops-0810-inventario-rescates-local26.md).| No restaurar14 memorias ni su operación local en coordinación. No merge de historia134 NO-GO;135 no es su sucesor de saneamiento.|
|86 · `d5c43596f2d6ca08905062311f24ca23bbda9b2a`| Rechazo humano de75 pese a publicación; siete títulos, límites del404 y evidencia del relevo panel351053b9.|[Panel: historia rescatada](beta-panel-veredictos.md), secciones de reclamación/relevo.| No copiar en bruto coordinación-nocturna/reclamación/relevo: propietarios/chats, buzones/vigías, reservas76/77, heartbeat/plazos/leases son caducos. Sin partes o consultas privadas.|
|83 · `e7fec4b446936ffa4361867b8d8ebdb75656d72b`| Por qué mover de versión perdía veredictos, último rechazo/retirada y aprobación≠entrega; limitaciones del diseño inicial.|Mismo [brief de panel](beta-panel-veredictos.md), sin otro duplicado.| No restaurar FNV8 como identidad suficiente, alias de partes históricos ni requisito APK51 como comprobación actual. No copiar app_events ni fechas/veredictos privados.|
|92 · `2f045a1e21e55b612b4483e63e9633f7ccf79235`| A/B con cuatro hashes, recibo sourceSha/alcance, reseal real de SW/ZIP, rojo de relojes y CI final36790590843 SUCCESS.|[Bootstrap histórico](beta-delivery-bootstrap.md).| No restaurar fixtures o fuente67 ni gate operativo antiguo. El A/B histórico no afirma bytes iguales en una publicación con otro SHA/fecha.|
|44 · `2050ce327bc931510742c3c582a9faf36155da89`| Repro sintético del editor A→B→A, identidad/lápida, límite causal y matriz futura con concurrencia.|[FIN05 histórico](FIN05-CONCILIACION-2026-09-10.md).| No copiar consultas/cifras/conteos familiares, modo leído, estado Edge ni diagnóstico de filas del mes. No reinstalar recomendaciones antiguas sobre lectores/lápidas ni mensajes listo que ya no sean ciertos.|

Los tres documentos fuente de86 se consolidan con83 en **un solo destino**. Esto conserva la evidencia útil de seis briefs ausentes sin crear seis relatos operativos duplicados. El registro de blobs de abajo permite recuperar el texto histórico original desde Git si hace falta, sin convertirlo en instrucciones activas.

## Corrección de134: el saneamiento llegó por142, no135

[PR142](https://github.com/JuanjoAvila/Aely/pull/142) se declara sucesor aislado de134, conservando el NO-GO de la historia anterior; está MERGED con squash `537edc1c33433fe122266e21f0d158c7b943b625`. Fuente final `3e4ff6577fa3384187ef99a2aba53221ab5f2fd2`; [CI37469376085](https://github.com/JuanjoAvila/Aely/actions/runs/37469376085) completed/SUCCESS y head exacto comprobados.

Los14 documentos docs/memoria de134 tienen blob idéntico al source134 tanto en main56c7 como en beta8dcc. El commit squash142 es ancestro de main, **no de beta**: para beta la conclusión es equivalencia de contenido, no la misma genealogía. No inferir un merge por ver blobs iguales.

El exportador final en ambas refs tiene blob `54ba22de76793f68d72a697cbe9419cf234cde53`, igual al de squash142; el source134 era b66018a8. La diferencia conserva validación atómica y añade detección de cifras que continúan una etiqueta financiera tras párrafo vacío. Test vigente en ambas refs: blob `41a0c5dcde49971cd18d11caff06b76cafb3a166`. No se ejecutó aquí y no se presenta esa identidad como resultado nuevo de pruebas.

[PR135](https://github.com/JuanjoAvila/Aely/pull/135), head `d43d1aec0f6afd873a4e76d50111f3a9643ff943`, cambió el guard de frescura con ancla histórica y su propio acto de integración; su cuerpo excluye los20 archivos de134. La fila del inventario que proponía “sustitución135” era incorrecta y se corrige a142. Este rescate preserva esa relación y el motivo de no fusionar la historia134, sin volver a exportar memorias privadas ni reactivar instrucciones.

## Constancias finales de fuente, sin cerrar otros gates

La API de Actions devuelve completed/SUCCESS y head exacto en los cinco runs37116952467,37111269065,37118946223,36790590843 y37469376085. Se leyeron logs de los tres primeros para registrar las cantidades indicadas y privacidad. Los candidatos rechazados/cancelados y el rojo inicial de fixtures siguen descritos en sus actas.

Los commits de integración60d4863f (Movilidad),2264e90e (categoría) y039d3036 (Metas87) son ancestros de ambas refs de producto congeladas. Se reutiliza la equivalencia de runtime comprobada en el inventario; no se reinterpreta como aceptación financiera/nativa ni se ejecuta nuevamente la suite. Los límites específicos siguen en cada brief.

Este bloque puede servir al coordinador para una decisión administrativa después de conservarlo; **no cierra ni fusiona108/106/110/134/86/83/92/44**. Tampoco sanea el historial público anterior mediante borrado o force-push.

## Cambios concurrentes reconocidos, fuera de este rescate

La fuente original185 de Claude (`9cd4aa9c51450e98b1d6fa11a1956d49c2ce178d`) tiene derivación Nav107 propia. La candidata186 de producción (`154982c3eae3e45daf41fa1e68cc1d649d415093`) seguía OPEN al leerla y pertenece al trabajo de las cinco tandas aprobadas. Fuente187 de Grok (`edc84ecd9743e4888f4ae4a8b802ed31164289da`) entrega explicación del gráfico con su contexto financiero y derivación Inicio109. No se modifican ni reauditan esos runtimes ni se atribuye su CI/entrega a este informe.

La falta de ACK de Grok del inventario fue una observación del corte anterior; **no describe su actividad después del resultado187**. Conservar el corte histórico evita volver a declarar inactividad actual a partir de aquella lectura. Esta tarea no cambia routines ni envía comentarios/reviews públicos.

## Validación del bloque

Verificación textual prevista y realizada antes de entregar: siete destinos del bloque más errata del inventario, sólo docs/briefs; ocho PR fuente/42 pares/29 rutas; seis ausentes consolidados sin perder títulos; tres adiciones que preservan bytes anteriores; ausencia de patrones privados y de nuevos enlaces locales rotos; git diff --check y guard-privacy. Se comparan prefijos de los tres briefs con la base congelada para demostrar que no se reemplazaron sus contratos.

Sin build/npm test, Node pesado o Chromium: no hay runtime nuevo que probar. El guard de privacidad es el control ligero existente. No se añaden datos ni se toca el WIP raíz, canal, backend, schedulers o ramas ajenas. La rama y worktree propios quedan disponibles para revisión.

## Registro textual de los 42 pares comparados

Los SHA de blob son Git; no SHA256 de un archivo descargado. “Igual” significa bytes de blob idénticos al source indicado; “distinto” exige leer el delta, no demuestra pérdida. Referencias congeladas en la cabecera permiten repetir cada comparación con `git show <ref>:<ruta>`. No se restauran documentos generales ni memorias por ser distintos o faltar en coordinación.

| PR | Documento fuente | Blob fuente | coordinación | main | beta |
|---|---|---|---|---|---|
| 108 | `docs/ARQUITECTURA.md` | `54a3fa479ffdddb6353e87d41e6d1bc49a12a6b0` | distinto | distinto | distinto |
| 108 | `docs/BACKLOG.md` | `d5e99d995b7167f2cf5f28f8e5924f05a4c03029` | distinto | distinto | distinto |
| 108 | `docs/ROADMAP.md` | `eaed811b0238a3ba5d3708a764fdd9d0ab946326` | distinto | distinto | distinto |
| 108 | `docs/SETUP-SUPABASE.md` | `ac2907c16cb8bda74441ce5a00638467effbf062` | distinto | distinto | distinto |
| 108 | `docs/TESTING.md` | `dcc3bd8b0088c96cd8712765b1bb2badffb2acf3` | distinto | distinto | distinto |
| 108 | `docs/briefs/feature-0210-01-gasolina-taxi.md` | `a024e25f89e79f626ab5e00c341759fc4d71a472` | igual | igual | igual |
| 108 | `docs/briefs/feature-0310-01-movilidad.md` | `47cbb2a115684a98f9e1c3abedc68c95b07493f0` | distinto | distinto | distinto |
| 106 | `docs/ARQUITECTURA.md` | `eda4784a6e1ae31f4cb773907210198edb5663c7` | distinto | distinto | distinto |
| 106 | `docs/ROADMAP.md` | `847a5377d4099c8d427077c96c81f1b98a926e8b` | distinto | distinto | distinto |
| 106 | `docs/TESTING.md` | `35db2513e2a3fa5aed1d0d27cae3a09da23491dc` | distinto | distinto | distinto |
| 106 | `docs/briefs/inc-0210-02-categoria-elegida.md` | `6db85742be7ef731d9f9dccb44224fb3a558870c` | distinto | distinto | distinto |
| 110 | `docs/ARQUITECTURA.md` | `5e0f5bce26ee92e3cda7ac0fb7cfd2680c64ca4d` | distinto | distinto | distinto |
| 110 | `docs/BACKLOG.md` | `05ee7941cc49cf500d0b9340a0a34f44a7e79e44` | distinto | distinto | distinto |
| 110 | `docs/ROADMAP.md` | `457d6b73c2d0edfea51d34d763d55129c107d60f` | distinto | distinto | distinto |
| 110 | `docs/TESTING.md` | `045eaf95d3e4299d71d5686e547c3484bb77b29f` | distinto | distinto | distinto |
| 110 | `docs/briefs/inc-0310-01-meta-regla.md` | `12b4654d689f94705e185e8595e9c0f6ef889a00` | distinto | distinto | distinto |
| 134 | `docs/TESTING.md` | `3f2b640a99e5d03b0e8c9261d626e6b81b5d5962` | distinto | distinto | distinto |
| 134 | `docs/memoria/MEMORY.md` | `16205f07b8a73d56566c4d53ef0373ed05255900` | distinto | igual | igual |
| 134 | `docs/memoria/buzon-hora-real-y-turno-chromium.md` | `98c9e1f4b6b8168f2345dc7585f8b9a8c9e4a11a` | ausente | igual | igual |
| 134 | `docs/memoria/canal-equipo-tres-agentes.md` | `12aa28c5894f0b5c2396375d6b185789355b1997` | distinto | igual | igual |
| 134 | `docs/memoria/claude-a-la-nube-canal-rama.md` | `4e6efa5ea9d3c683e7c121e6827f35a7b55f6293` | ausente | igual | igual |
| 134 | `docs/memoria/feedback-autonomo-sin-pedir-permiso.md` | `ceb65c921e440867f94e59a7e5714c244664771d` | ausente | igual | igual |
| 134 | `docs/memoria/feedback-no-dar-por-hecho.md` | `9e67f863b5aa19d93adff86f539a2d8addf61948` | distinto | igual | igual |
| 134 | `docs/memoria/initial-session-carrera-freshlogin.md` | `9bcaccd191ac5fe96fad5fd4a7b73288562cd63e` | ausente | igual | igual |
| 134 | `docs/memoria/mi-cartera-deploy.md` | `af03290cb4710f5b614fe8ef6de1cdd5670b24af` | distinto | igual | igual |
| 134 | `docs/memoria/promote-4-19-106-como-se-hizo.md` | `36fe3a1277d9ba108e85dd42253f2a700ad692ac` | distinto | igual | igual |
| 134 | `docs/memoria/relevo-automatico-cada-4h.md` | `1fba95b019ed6d6e8e4d94d0a0080a2e111ea1d2` | ausente | igual | igual |
| 134 | `docs/memoria/revisar-docs-frescura-tras-commit.md` | `031a37ae537d9086f72aff5d158031b905f1f233` | ausente | igual | igual |
| 134 | `docs/memoria/revisar-worktree-de-otro-agente.md` | `23b428d7939799ee7f594dbc9f9fe45afee95eae` | distinto | igual | igual |
| 134 | `docs/memoria/traspaso-2026-09-24-manana.md` | `42fa86508aa735e529c2bac72cc80fdcb4cc9456` | distinto | igual | igual |
| 134 | `docs/memoria/traspaso-2026-10-01-manana.md` | `97c5e6ad20523fba0dc4843a15148bb98cca44d1` | ausente | igual | igual |
| 86 | `docs/briefs/coordinacion-nocturna-2026-09-30.md` | `9a7f2467d6359891807752eb4f1cb162a3f76816` | ausente | ausente | ausente |
| 86 | `docs/briefs/pruebas-beta-reclamacion-2026-10-01.md` | `dde621153d64ff2bdd775d60e7d6c3ef826f2edb` | ausente | ausente | ausente |
| 86 | `docs/briefs/relevo-coordinacion-2026-10-01.md` | `0d0e7ce3f328ca85f907de1fae081016b4affd55` | ausente | ausente | ausente |
| 83 | `docs/ROADMAP.md` | `b3931d0ff271b11c2d7c16ea0d71115a1d9f0748` | distinto | distinto | distinto |
| 83 | `docs/TESTING.md` | `be71a14d0002471f9b7419e889784f5175d92e7a` | distinto | distinto | distinto |
| 83 | `docs/briefs/beta-panel-veredictos.md` | `485156bd7003b6b322743ddfc4c4eadfda43d40e` | ausente | ausente | ausente |
| 92 | `docs/ARQUITECTURA.md` | `f035b7e826b408227a2d5adc97283a6e2c610b84` | distinto | distinto | distinto |
| 92 | `docs/TESTING.md` | `77b589426a5f1ae1aa892c7b8ba9df1e78ae4b52` | distinto | distinto | distinto |
| 92 | `docs/briefs/beta-delivery-bootstrap.md` | `3738ccf707bee3343511053bc50ae2d6a76e583d` | ausente | ausente | ausente |
| 44 | `docs/BACKLOG.md` | `d8275cf97b42d41b87ff0c89ee2a0edc6fa0a4c4` | distinto | distinto | distinto |
| 44 | `docs/briefs/FIN05-CONCILIACION-2026-09-10.md` | `935a087f8357cd97cf4ae5b3bc484e202655cb64` | ausente | ausente | ausente |
