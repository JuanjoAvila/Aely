# FIN04 fase 2 · PR293 R3: lectura y commit antes de escribir

Continuación privada del WIP 7811d426862d1ddc57be5eb04c0620a9fb7604ab,
con padre beta 4.26.163 e5ff9eef17d9e6626205539ca0f459db5a52171e.
Rebase final sin conflictos sobre beta164 ce5969d3b787ab2a98e736d2036b2c7626ff1d4f.
El informe de entrega identifica las fuentes y los EXIT de cada corrida.
PR296 se porta encima de R3 en la misma entrega; la fusión por grupos de
recibos/deudas y su interfaz de conflictos siguen fuera de este alcance A.

El temporizador y la reconexión no suben el snapshot anterior al primer pull.
La ausencia acreditada permite INSERT, nunca upsert; una colisión provoca una
relectura limitada. Una revisión válida conserva UPDATE con CAS por titular.
La respuesta exige una sola fila con revisión y sesión revalidada.
Un formato inválido con revisión permite rescatar la copia del mismo titular
por CAS, pero no acredita lectura válida, aportación mensual ni backup.

R3 separa evaluar el updater de su commit de React. Un marcador no serializable
permite a useLayoutEffect acreditar lectura y revisión tras aplicar el estado.
Evaluar y descartar el updater no habilita escrituras ni persiste colas.
El debounce toma la copia comprometida al dispararse; cambiar sesión cancela
el commit anterior. Un ACK antiguo tampoco cambia revisión o base de Metas
mientras otro merge espera commit: se comprueba en respuesta y updater diferido.
El backup diario espera lectura válida comprometida y actualiza lastBackup
como mantenimiento, sin renovar _savedAt.

## Verificación y límites

fin04-first-pull.test.mjs cubre INSERT/CAS/ACK/cache; fin04-commit.test.mjs
cubre render retenido, debounce, sesión, colas, backup y ambas ventanas de ACK.
Los dos casos nuevos fallaron sobre el WIP anterior; tras las guardias el archivo
completo pasó 9/9. La continuación ejecutó realmente persistencia.spec.mjs y
sync-pull-refresco.spec.mjs: 14/14, sin reintentos. La selección anterior de 41
no los incluía; se conserva como evidencia distinta. Los 87 focales previos
se solapan con otras selecciones y no se suman como casos únicos.
El primer runner Node entero dejó 200 etapas verdes y 12 fallidas de 212;
no es el resultado final de la fuente corregida.

Se conservan los oráculos 4237, 120023 y 10011 céntimos. Los escenarios heredados
de primera lectura/recuperación aíslan la carrera mediante un sello remoto
posterior al arranque; no acreditan convergencia general LWW. PR296 verifica
mantenimiento con tiempo natural, dos titulares, edición offline y recarga.

No se cambian VERSION, catálogo, caps, memoria histórica, servidor ni despliegue
para obtener un verde. Node entero final, revisión, CI, integración, servido exacto
y aceptación física móvil conservan resultados y gates propios. No es ProductREADY.
