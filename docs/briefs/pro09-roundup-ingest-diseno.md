# PRO-09 · Round-up de TR: diseño, sin implementación

Fase limitada por la decisión de Claude `360dcf54c9ce4f514f3255820f6ca847dacebf91`
del 17/10/2026, posterior al GO A `468ffa260baaee706524c8ebdbe1b4401a57fe7b`.
**Se entrega diseño y reproducción causal. No se implementa, genera una migración,
crea una tabla ni cambia dinero.** La PR será borrador contra `main`; después de
la entrega y revisión, Claude y el dueño decidirán si abren otro proyecto.

Base funcional exacta: `a9916c3cdb21c93f9d3a47653c0608e630ce50ab`. Los ficheros
de esta candidata son exclusivamente documentación e investigación bajo
`docs/briefs/`. No cambia el runtime, los índices de `expenses`, los escritores
financieros, las migraciones activas, los runners, VERSION, catálogo o topes.

## Contrato y procedencia de los datos

La entrada operativa de `docs/BACKLOG.md:49` pide leer la notificación **«Round up
Invertido»** y emparejarla con Open Banking por banco, céntimo, ventana y nombre
sin duplicar dinero, después de UX-15. Ese PRO-09 es distinto del identificador
histórico de Pregúntame. No se reabre su ayuda remota ni UX-15/PR244.

El único contenido real aportado es esa etiqueta. Texto completo, importes,
cuentas, comercios, referencias y fechas de las reproducciones son sintéticos;
no son un payload completo observado de TR ni acreditan sus variantes reales.

El GO A acepta una señal tipada e idempotente pendiente. Antes de un BOOK único
no hay efecto en efectivo, presupuesto, widget o posiciones. Al casar, **el BOOK
es la única salida de caja** y se etiqueta como round-up/inversión respetando
decisiones previas. La señal no compra participaciones, inventa precios ni suma
recompensas. La opción B, asiento financiero inmediato, está descartada.

## Por qué se necesita un almacén separado

En la base, `_shared/ingest_logic.ts:198-222` incluye redondeo/round-up/invertido
en el ruido. `ingest/index.ts:138` devuelve `skipped` antes de escribir gastos.
Permitir el texto como compra no implementa A: la sonda anterior duplica una
señal de 42c a 84c al llegar su BOOK con nombre, y la red TR/Wallet puede darle
el ACK de una compra diferente de 43c por su tolerancia de 2c.

No se reutilizan estos almacenes:

| Almacén | Motivo verificado para descartarlo |
| --- | --- |
| `expenses#dup` | Es dinero pendiente de una decisión existente. Los codecs reales permiten quitar `#dup` y activar `expenseCountsCash`; una señal no puede adquirir caja al pulsar «son distintos». |
| `app_events` | Es telemetría sin datos financieros, de lectura solo-admin, sin recibo idempotente ni vínculo 1:1. No acredita recepción durable al titular. |
| `app_state` | Es una foto por usuario con revisión/LWW; un bolsón JSON no prueba identidad independiente de eventos ni vinculación atómica a BOOK. |

Hay otra incompatibilidad del asiento inmediato: aun con categoría inversión y
`noCard`, la salida real puede sumarse al redondeo estimado en saldo y cierre.
La fixture anterior de compra 3,58 + inversión 0,42 muestra 995,58 en lugar de
996,00 desde un saldo sintético de 1.000,00. Es un riesgo contrafactual del diseño
B, no una afirmación de que el ingest desplegado ya admita esa señal.

## Tabla propuesta, inerte y fuera de migraciones

[`schema.proposed.sql`](pro09-roundup-ingest/schema.proposed.sql) es el borrador
existente, preservado byte a byte. Está fuera de `supabase/migrations`, sin
ordinal registrado, con excepción incondicional **antes** del DDL y `rollback`.
No es una migración generada/aplicada ni un esquema validado por PostgreSQL.
La decisión de diseño prohíbe generar una migración en esta fase, aunque llegue
a estar disponible la CLI.

`roundup_signals` propondría recibo UUID, titular, hash del evento, instante
nativo/recepción/caducidad, banco TR, cuenta opaca si existe, importe entero en
céntimos EUR y signo de salida, semántica/nombre acotados, estado/revisión y UUID
del BOOK al vincular. No guardaría cuerpo crudo, paquete/key nativos, tokens,
perfil, posiciones o una cartera JSON.

Los índices propuestos separan usuario/evento y una señal por BOOK; no sustituyen
la comprobación de dueño, unicidad bidireccional, decisiones y concurrencia.
El borrador no añade una FK que cambie por arrastre el borrado de gastos ni el
UNIQUE de FIN03. La operación futura tendría que verificar dueño/UUID del BOOK
y definir su retirada sin borrar la identidad del recibo. Es una decisión
pendiente; el DDL aislado no garantiza ese comportamiento.

La propuesta limita `authenticated` a leer sus recibos y reserva escrituras al
servidor; `anon` no accede. La documentación de Supabase distingue grants y RLS:
una tabla expuesta necesita RLS y permisos adecuados; una política SELECT por
`auth.uid()` limita las filas del titular. Es fundamento para el diseño, **no
prueba de políticas desplegadas**. [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Identidad nativa y límites de packetId

`TrExpenseListener.java:209` calcula SHA-256 de fuente, paquete, `nativeKey` y
`postTime`; produce `v1_` más 64 caracteres hexadecimales. El fallback de key usa
paquete/id/tag. Título y texto no forman la identidad. El POST lleva fuente,
fecha y `evento`, **no el paquete ni una atestación**. La Edge puede validar
la forma y autenticar al titular por su token, pero no reconstruir ni acreditar
la app emisora a partir del hash.

Dos móviles pueden producir hashes distintos para una misma notificación; el
hash tampoco es una referencia bancaria. En una fase posterior, A exigiría la
forma nativa a esta vía sin endurecer el helper legacy de compras. No se fabrica
identidad con texto/importe ni se promete idempotencia de una APK que no aporta
huella válida. Se propone rechazar recepción tipada sin huella con código
cerrado y sin efecto, conservando la conducta de compras legacy; la forma exacta
de esa respuesta queda por decidir.

## ACK de recepción propuesto

Después de confirmar una fila de recibo, la respuesta propuesta es:

```json
{"ok":true,"skipped":true,"received":true,"status":"pending","receipt":"UUID-opaco"}
```

Los campos son propuesta de contrato, no API implementada o desplegada. No hay
`ack` UUID de un gasto confirmado, importe/comercio de gasto, `alert`, `month`,
`widget` o delta financiero. El receptor Android actual sale antes de notificar
o actualizar widget cuando `skipped=true`; se documenta esa puerta de
compatibilidad, sin ejecutar Java ni acreditar comportamiento físico.

Un reintento con igual usuario/hash devolvería el mismo recibo/estado, sin
sobrescribir importe, nombre, instante o caducidad con un body actualizado.
Un ACK perdido exige lectura del recibo y comparación de la identidad; error,
tabla ausente o respuesta incierta no permiten `received=true`. Un estado
`matched` tampoco convierte a la señal en una segunda salida de caja.

## Matching exacto y caducidad

Se conserva el contrato aprobado:

- Mismo usuario y banco; cuenta compatible sin inventar una cuando falta.
  Varias cuentas posibles o más de un candidato no se resuelven con wildcard.
- Céntimo y signo exactos, EUR conocido. No tolerancia de 2c ni conversión FX
  inventada; una compra similar sigue siendo otra identidad.
- Diferencia de hasta tres **días calendario de Europe/Madrid**, inclusivos,
  usando el instante de la señal y la fecha bancaria con su procedencia. No
  equivale a restar 72 horas; los casos de DST/medianoche siguen pendientes.
- BOOK y nombre/semántica explícita de round-up en ambos lados. Un nombre de
  fondo aislado no demuestra round-up; `Movimiento` y compras con palabras
  parecidas no habilitan la vía. No se han confirmado alias reales de TR.
- Unicidad 1:1 en ambos lados de la foto completa considerada. No tomar el primer
  candidato, reutilizar una señal ni absorber referencias distintas. Ambigüedad
  o falta de BOOK conserva la señal pendiente, sin dinero.

Se propone caducar al **fin del séptimo día calendario de Madrid**, donde el día
local del evento es día 0. Ejemplo sintético: evento 16/10 → fin del 23/10 local;
el límite excluyente sería 24/10 a las 00:00 Europe/Madrid. No se añade una duración
de 7×24h en UTC. Un reintento no desplaza el límite y una recepción ya vencida no
se reactiva. Este cálculo y sus fronteras no se han ejecutado en PostgreSQL.

**Retención propuesta, no decidida:** conservar el recibo mínimo y su hash
terminal mientras exista la cuenta, para que un replay posterior a la caducidad
no lo recree. Caducidad financiera y borrado de identidad son conceptos distintos.
Sin cuerpo crudo y sin cron/purga nuevos. Proponer al dueño un máximo de 200
señales activas por titular: al llenarse no expulsar ninguna ni dar un falso ACK;
rechazar altas nuevas con código cerrado/reintento definido. Los recibos
terminales requerirían paginación y una decisión explícita de retención/borrado;
no se presenta este borrador como almacenamiento ilimitado ya resuelto. Si el
dueño elige un plazo finito de identidad, debe aceptar también un horizonte
finito de idempotencia o aprobar una forma compacta que lo preserve.

## Mecanismo atómico propuesto, sin SQL de negocio implementado

Se propone una operación de servidor transaccional que reciba al titular ya
autenticado; no confiar en un `user_id` arbitrario del cliente. La recepción
idempotente y la reconciliación posterior compartirían este contrato:

1. Validar tipo/hash/fechas/céntimos y confirmar el recibo por usuario/hash sin
   actualizarlo a partir de un replay. La fecha de expiración es inmutable.
2. Serializar las operaciones nuevas del mismo usuario/banco dentro de la
   transacción y bloquear recibo/BOOK antes de decidir. Contar candidatos en
   ambos lados, exigir foto completa y revalidar dueño, estado, referencia,
   cuenta, importe, nombre y revisión/decisión al escribir.
3. Si hay un par único y la política de categoría lo permite, registrar el
   vínculo y etiquetar **esa** fila BOOK como inversión en la misma transacción.
   No cambiar importe/fecha/banco/ref, ni insertar/eliminar otro gasto, ni
   invocar `applyInvestBuy` o alterar posiciones/recompensas.
4. Un error o cardinalidad distinta de una fila no acredita vínculo. Si el
   commit perdió su ACK, leer exactamente recibo/BOOK/revisión; no restaurar
   decisiones ni repetir efectos monetarios por parecido.
5. Un BOOK nuevo/retirado o una decisión posterior debe conservar el recibo y
   reevaluar bajo una política aprobada; no reutilizarlo hacia otra referencia
   solo porque el primer UUID ya no aparezca.

Un posible lock sería de transacción, no de sesión. PostgreSQL documenta que los
advisory locks de transacción terminan con ella; solo coordinan participantes
del protocolo. Un SELECT previo o bloquear únicamente filas existentes no prueba
que no aparezcan nuevos candidatos. Con Read Committed, dos lecturas pueden ver
fotos distintas; hay que diseñar el protocolo de inserción, aislamiento y
reintentos completo. Estos son requisitos/inferencias de diseño, **no una RPC
ya probada**. [Locks de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)
· [Aislamiento](https://www.postgresql.org/docs/current/transaction-iso.html).

La ruta concreta para pedir reconciliación (RPC/Edge) y sus permisos quedan
pendientes. No se crea una función pública privilegiada en este trabajo. La guía
de Supabase recomienda `security invoker` y controlar EXECUTE; si otra fase
justifica `security definer`, necesitará `search_path` restringido y autorización
explícita. No se confía en metadata editable del usuario. [Funciones y permisos](https://supabase.com/docs/guides/database/functions).

## Dos opciones para la procedencia de «Otros»

El escritor real `setExpenseCat` guarda `{cat:'otros'}` también cuando el usuario
lo selecciona expresamente. Esa fila se parece a una clasificación automática
«Otros»; `expenseFromRow` no recupera procedencia que el esquema no guarda.

| Opción de proyecto futuro | Conducta y límite |
| --- | --- |
| **1 · Procedencia/versionado explícitos** | Un marcador de elección y una revisión separan automático/manual; el escritor de categoría confirma la decisión, incluso al volver a elegir Otros. La operación atómica compara esa revisión antes de etiquetar. El legado sin marcador queda desconocido, sin inventar backfill. Requiere decidir esquema, escritores y compatibilidad, fuera de un lector mínimo; no implementado. |
| **2 · Legado conservador sin nueva inferencia** | Una categoría sin prueba de procedencia se conserva, incluido Otros; la señal queda pendiente/bloqueada para revisión explícita. Solo una futura decisión expresa o una prueba de origen aprobada permitiría reclasificar. Reduce automatismo y puede dejar señales sin casar, pero no pisa una elección desconocida. Tampoco reconstruye decisiones históricas; no implementado. |

No se ha elegido una de las dos por el dueño. Ni «Otros significa automático» ni
«cualquier inversión fue aceptada por el usuario» son inferencias válidas.

## Lector mínimo y clientes antiguos

`pullExpenses` pagina la tabla monetaria y `syncCloudExpenses` mezcla sus filas.
Un lector de señales sería separado, paginado y ligado a la sesión, fuera de
`expenses`, `pushState`, históricos y backups financieros. Tras acreditar el
BOOK en nube podría pedir la reconciliación admitida; nunca dispararía
`bankSync` ni cambiaría la cadencia bancaria. La respuesta monetaria seguirá
conteniendo una sola fila BOOK, con la categoría y decisión preservadas.

Los clientes antiguos no conocen recibos ni el marcador de decisión futuro.
Sus upserts/escrituras y lecturas tardías pueden recrear/alterar una fila sin
participar del protocolo. Un lock nuevo no los vuelve participantes. Hay que
definir gating/versiones y orden de despliegue con Claude antes de activar nada;
no se promete cierre distribuido, compatibilidad de escritura o RLS por disponer
de un fichero DDL. FIN03/FIN10/FIN11 y sus ramas quedan fuera de este diseño.

## Reproducción causal y resultados conservados

Los guiones son investigación bajo `docs/briefs/pro09-roundup-ingest/`, **fuera del
runner de regresiones verdes**. No se han añadido ficheros bajo `tests/` ni
silenciado rojos para que pase una suite. Al implementar un contrato aprobado
en otro trabajo, sus guardianes deberán pasar al runner correspondiente; esta
fase no se adelanta a ese paso ni cambia `scripts/run-tests.mjs`.

`runtime.mjs` carga handler/helpers/cálculos reales y el mock Data API existente;
no implementa el matcher propuesto. Por defecto exige que las fuentes leídas
coincidan con la base funcional, aunque el HEAD tenga commits de docs. Node24
quita tipos TypeScript; no son ejecuciones Deno, PostgREST, SQL/RLS ni Android.
`--against-working-tree` permite un ensayo futuro explícito con otras fuentes,
sin convertir una ejecución anterior en evidencia de ese cambio.

```sh
node docs/briefs/pro09-roundup-ingest/causal-red.mjs
node docs/briefs/pro09-roundup-ingest/previous-risks.mjs --post-only
node docs/briefs/pro09-roundup-ingest/previous-risks.mjs --boundaries-only
node docs/briefs/pro09-roundup-ingest/previous-risks.mjs --posted-boundary-only
node docs/briefs/pro09-roundup-ingest/previous-risks.mjs --same-day-identity-only
node docs/briefs/pro09-roundup-ingest/previous-risks.mjs --cash-risk-only
```

**Son comandos con EXIT1 esperado en la base**, no una receta de suite verde.
El modo de fronteras original contiene una variante +3 con BOOK futuro respecto
al reloj17/10: se conserva como escenario y su evidencia se sustituye por
`--posted-boundary-only` con reloj23/10. No se suman como dos casos distintos.
Sin `PRO09_EVIDENCE_DIR`, los guiones no escriben artefactos; ese env opt-in puede
señalar un directorio privado ya creado. Nunca se publican logs con rutas locales.

[`evidence-summary.json`](pro09-roundup-ingest/evidence-summary.json) conserva
los resultados ya ejecutados antes del empaquetado:

| Grupo | Resultado real previo | Interpretación |
| --- | --- | --- |
| 30 casos únicos anteriores | 18PASS / 12FAIL | Solo3 son aceptación de la base que ignora la señal;9 son riesgos contrafactuales de apertura, ventana, identidad o caja/cierre. No son12bugs desplegados. |
| 8 casos nuevos de A | 5PASS / 3FAIL · EXIT1 | Dos oráculos propuestos de recibo/acuse estable ausente; una sonda invalida almacenar señal como expense#dup. Los otros5 controles conservan compras y documentan identidad/procedencia. |

La primera fixture mandaba fecha ISO en lugar de milisegundos nativos: los casos
afectados se excluyeron y solo ellos se repitieron tras corregirla. Cinco controles
independientes se conservaron sin repetir. No se oculta esa ejecución ni se
atribuye un mutante de fix: no existe fix de producto.

El empaquetado cambia únicamente rutas/imports, validación de fuente base y
sumidero opt-in de evidencia; conserva los cuerpos de fixtures/aserciones. Las
copias portables **no se han ejecutado de nuevo** por orden de no repetir los
casos terminados. Las comprobaciones de sintaxis/empaquetado no son otro pase
financiero. No se ha usado ni simulado `roundup_signals` como solución durable.

## Referencias actuales y decisiones pendientes

Se consultaron el 17/10/2026 las guías oficiales enlazadas de RLS, funciones,
locks y aislamiento, más el [changelog de Supabase](https://supabase.com/changelog).
La salida Markdown no fue compatible con el lector web; se usaron las páginas
HTML y el buscador oficial de documentación. La noticia TLS del12/10 se registra
solo como contexto de compatibilidad futura, no como ensayo del dispositivo o
del proyecto real. No se inspeccionó la configuración/esquema vivo.

Pendiente de Claude y el dueño: tabla/representación final, opción de categoría,
ACK, retención/cupo, operación atómica, permisos, lector/gating de clientes y
proyecto de implementación. No hay CLI Supabase/psql/docker verificados en PATH
en la preparación; no se pidió instalar ni se ejecutó SQL. Deno fuera de PATH fue
informado por Claude en el canal: este trabajador no lo ejecutó ni lo necesitó
para empaquetar documentación.

El orden futuro, si se autoriza otro proyecto, debe empezar por pruebas SQL/RLS y
concurrencia aisladas, compatibilidad de clientes/decisiones y migración revisada;
solo después activar servidor/lector con despliegue de Claude y gates propios.
**Este documento y una PR borrador no autorizan esos pasos ni acreditan entrega,
CI general, artefacto servido o aceptación móvil.**
