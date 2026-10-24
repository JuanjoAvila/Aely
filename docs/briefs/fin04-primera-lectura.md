# FIN04 fase 2 · PR1 A: leer antes de escribir

Candidata aislada desde beta 4.26.161 (`13e814d2289b279c80f325125e8168570b3a1d35`).
Se entrega A separada, como permite el GO con cambios: la puerta inicial afecta al
temporizador, reconexión, sesión, lectura inválida y ACK. B (fusión por grupos de
recibos/deudas y su interfaz de conflictos) queda pendiente de otro encargo.

Con el primer pull retenido, el temporizador y la reconexión enviaban el estado local
con revisión nula mediante upsert. Dos RED independientes del navegador y SDK real
reproducen la sustitución de un recibo sintético de 4237 céntimos por uno de 777.

La puerta común de `pushAppState` exige una lectura válida del mismo titular. Una
lectura sustituida o una sesión cerrada no habilita el envío ni permite adoptar su
ACK. Un error, una cartera inválida o una fila sin revisión mantienen la puerta
cerrada; no se interpretan como ausencia. Solo la ausencia acreditada permite
crear con `insert`, cuya colisión no sobrescribe la fila. Con revisión se conserva
UPDATE por propietario y revisión. La respuesta debe contener exactamente una
fila con revisión; se revalida la sesión antes de actualizar la cache.

Se conserva el ACK de Metas ligado al payload enviado. La prueba local de una
lectura ya aplicada sigue habilitando su reserva mensual aunque falle otra lectura
posterior; ese caso no abre la puerta de escritura de la lectura fallida. El fallo de la lectura no
se convierte en un nuevo mecanismo de reintentos: requiere una posterior lectura
válida por las rutas de sincronización existentes.

## Verificación y límites

`fin04-first-pull.test.mjs` comprueba INSERT, colisión, CAS, ACK vacío/múltiple/sin
revisión, sesión y cache. Los mutantes `upsert` y `money` se activan con
`FIN04_FIRST_PULL_MUTANT`; sus fallos se distinguen de los tests normales.
`fin04-first-pull.spec.mjs` usa la app, React y Supabase JS 2.110.0 incluidos, con
auth y transporte sintéticos; retiene el GET de forma explícita, simula correctamente
la unicidad en INSERT y abre dos contextos en los escenarios válidos. Está registrado
para `11-app-main.js`; `00-core.js` ya fuerza los tests de núcleo.

La primera pasada tras la corrección detectó además que las normalizaciones de
arranque pueden volver más reciente el estado local bajo el LWW existente. No se
ha cambiado ese contrato en A. Para aislar la carrera, el escenario remoto lleva
un sello posterior al arranque y el segundo cliente una copia ya normalizada.
Por tanto, estos verdes no acreditan la convergencia general de recibos/deudas.

Documentación primaria consultada antes del cambio: [INSERT](https://supabase.com/docs/reference/javascript/insert),
[UPDATE](https://supabase.com/docs/reference/javascript/update),
[SELECT](https://supabase.com/docs/reference/javascript/select) y
[changelog](https://supabase.com/changelog). INSERT/UPDATE requieren `select` para
devolver filas. El changelog revisado no cambia estas firmas; los avisos de TLS y
extensiones PostgreSQL no justifican cambios de servidor en este alcance.

No hay cambios de VERSION, catálogo, notas, límites, servidor, migraciones ni
despliegue. Suite general, CPU6, CI exacta, integración, servido y aceptación móvil
son gates distintos; los resultados locales no los sustituyen.

El catálogo161 dirigido falla: los alcances `inc-0310-01-meta-regla` e
`inc-0810-metas-editar-regla` usan como ancla literal el antiguo `pullOkRef` que
devolvía `true` incondicionalmente. La integración debe actualizar esos descriptores
y sus revisiones para la nueva prueba de lectura; esta candidata no modifica el catálogo.
