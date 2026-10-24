# FIN-03 / FIN-09: identidad de gastos, fase de diseño

Estado: **diseño propuesto, sin arreglo de producto ni migración aplicada**. Base exacta
`a9916c3cdb21c93f9d3a47653c0608e630ce50ab`. Causa y regla aceptadas por Claude en
`86cbba1336ff575492cdc2eeb2ca8e6054e21631`; ese GO solo autoriza este diseño. El corte de
esquema sigue pendiente de decisión de Claude y del dueño. No acredita beta, despliegue,
reparación histórica ni aceptación móvil.

## Evidencia contra esta base

Fixture sintética: CaixaBank y Sabadell, mismo día/comercio, dos compras de 250 céntimos.
El importador devuelve dos filas y 500 céntimos. Reimportar no añade ninguna; una referencia
idéntica en bancos distintos conserva dos filas y dos referencias del mismo banco conservan
sus ordinales. El transporte `source` conserva banco y referencia.

El ROJO está después: `keyOfExpense` omite banco y referencia, y `mergeExpenses` y
`mergeExpensesFromCloud` dejan una fila y 250 céntimos. Incluso dos timestamps distintos del
mismo día se funden al leer. Un pull puede adoptar la categoría del segundo banco en el UUID
del primero. `claveComoLaApp` / `filasComoLaApp` repiten el colapso en servidor.

`addExpense` y `addExpensesBatch` usan el conflicto
`user_id,fecha,importe,comercio`: sus funciones reales frente a un SDK sintético que reproduce
el índice de `0001_init.sql` conservan una fila y un ACK. **El índice usa el timestamp completo,
no solo el día**: los dos OB normalizados al mismo mediodía chocan; con horas distintas el
modelo conserva dos filas, aunque los lectores luego las fundan.

Ensayo ya terminado: 14 casos, 7 controles PASS y 7 ROJOS causales, EXIT 1, sin omitidos ni
reintentos. Un fallo anterior del ensamblado privado del harness se conserva aparte y no cuenta
como ROJO de producto. Se adjunta [la misma reproducción](fin03-identidad-gastos/causal-red.mjs)
con rutas portables; no se repite el ensayo financiero por empaquetarlo. Las aserciones y los
datos de prueba se cotejan contra el original privado. Ejecutable optativo, deliberadamente
rojo; no se incorpora como un gate verde a la suite de producto en esta fase de diseño:

```sh
TZ=Europe/Madrid node --experimental-strip-types --test docs/briefs/fin03-identidad-gastos/causal-red.mjs
```

No se ejecutó PostgreSQL/RLS, ingest desplegado, navegador, Deno ni banco real. El doble SDK
demuestra el contrato del código y del esquema del repo, no el índice que esté desplegado.

## Contrato de identidad

Separar identidad de similitud; ni un importe ni un comercio demuestran identidad.

| Origen | Identidad propuesta | Resultado |
|---|---|---|
| Banco con identidad completa | `(usuario, proveedor, cuenta opaca estable, referencia)` | Mismo origen: mismo UUID canónico; origen distinto: fila distinta. |
| Manual nuevo | UUID creado y retenido una vez antes de encolar | Reintento del UUID: una fila; dos UUID legítimos: dos filas. |
| Legado sin origen completo | `identity_version=1`, regla anterior explícita | No inventar cuenta/referencia ni reclasificarlo por parecido. |
| Banco sin cuenta estable o referencia fiable | Sin alta automática v2 demostrada | Conservar incertidumbre/cola y proponer revisión; no fabricar un origen. |

Proveedor y cuenta son datos de **origen inmutables**, independientes del banco que se edita
en la UI. La cuenta no es la posición del array, un nombre visible ni una cadena reconstruida
de fecha/importe/comercio. La estabilidad tras reconexión debe demostrarse; un UID que cambie
necesita un alias probado por el proveedor. No registrar IBAN ni datos familiares como origen
en fixtures o documentación pública. El transporte de `obAcc` y la identidad de absorción
pertenecen a FIN-10; este diseño no los implementa.

Una identidad conocida de banco/referencia distinta nunca se une por similitud. Una transición
PDNG→BOOK solo usa los alias ya demostrados; no ampliar ventanas ni heurísticas. La identidad
completa no se deduce de que exista un UUID, ni de un `#ref` sin cuenta. Filas antiguas con
referencia siguen siendo v1 hasta una correspondencia exacta y autorizada; no se hace backfill
automático. Tampoco se recuperan cargos históricos perdidos por deducción.

### Alta y ACK v2, todavía sin implementar

Una futura operación de servidor autenticada, ligada a `auth.uid()`, recibe UUID estable y
origen exacto. Devuelve `{canonicalId, status: inserted|existing|needs_review, revision}`.
El conflicto de origen devuelve el UUID que ya existe sin pisar decisiones humanas. Un UUID
presentado con otro dueño/origen no se adopta. Importe, moneda o identidad discrepantes se
conservan para revisión; no se consideran éxito porque un upsert devolvió `error:null`.

El cliente conserva una cola persistente hasta ese ACK. Un timeout tras commit reintenta la
misma operación; no crea UUID nuevo. Debe adoptar el UUID canónico también en orden manual,
referencias de gemelos y operaciones pendientes. Ediciones y borrados comprueban dueño,
identidad y revisión; no se decide una equivalencia por parecido.

La unicidad debe arbitrar carreras, no un SELECT previo. La futura operación tendrá que
resolver PK y origen bajo concurrencia y releer el canónico; `DO NOTHING RETURNING` no devuelve
el ID de una fila que no se insertó. No se propone hoy una RPC ni un trigger que simule este
contrato. Inmutabilidad, RLS, permisos mínimos y revisión requieren ensayo propio antes de v2.

### Lectores y decisiones

Importación, merge local, pull, backfill, contadores y servidor/widget deben usar la misma
versión de identidad. Para v2, sumar por UUID canónico/estado de revisión, nunca por atributos.
Las decisiones de duplicado y edición deben sobrevivir al segundo cliente. El legado conserva
su comportamiento versionado; no pasar de contar una a contar todas sus filas sin revisión.

Las lápidas siguen su contrato compatible y el trabajo de FIN-11. Este diseño no convierte
claves antiguas en borrados masivos ni cambia sus topes. Antes de una implementación conjunta
deben acordarse lectores de ambas versiones y adopción de UUID, sin tocar aquí sus fuentes.

## Esquema aditivo propuesto y reversión

Nuevos archivos, **fuera de `supabase/migrations` y de su ejecución automática**:

- [01-additive.proposed.sql](fin03-identidad-gastos/01-additive.proposed.sql): añade
  `identity_version`, `origin_kind`, `origin_provider`, `origin_account`, `origin_ref` y un
  UNIQUE de origen; conserva PK, índice antiguo, datos, RLS y grants. No contiene RPC ni backfill.
- [01-additive.rollback.proposed.sql](fin03-identidad-gastos/01-additive.rollback.proposed.sql):
  quita únicamente lo añadido, sin CASCADE ni borrar filas. Aborta si existe identidad v2 o
  metadatos de origen. Antes de usarlo deberán estar desactivados y drenados todos los
  productores/lectores v2. La comprobación y el DDL se serializan en una transacción.

Se elige un UNIQUE normal `(user_id, origin_provider, origin_account, origin_ref)`, sin
predicado, para disponer de un objetivo explícito de conflicto futuro. Los NULL de manuales y
legado no se tratan como una identidad común. La CHECK exige v1 sin metadatos, o v2 manual sin
origen, o v2 bancario con las tres cadenas completas y no vacías; `IS TRUE` evita que un NULL
desconocido pase la comprobación. No se normalizan referencias cambiando mayúsculas/espacios.

Es una propuesta de DDL, no una migración numerada lista para despliegue. Antes de convertirla
en migración operativa hacen falta herramienta local, revisión, ensayo, inventario de esquema
y aprobación. No se editan `0001` ni las migraciones ya publicadas. Los locks, tiempos y volumen
de construcción/validación de índice quedan pendientes de medir, no se presumen inocuos.

**La reversión aquí prometida es solo la fase aditiva sin uso v2.** Después de almacenar
identidades nuevas no se eliminan columnas automáticamente. Después de permitir gemelos no
se puede recrear el UNIQUE viejo si los datos ya lo violan. Borrar gemelos o restaurar una
copia por encima de altas posteriores no es rollback seguro: habría que pausar escrituras
afectadas, conservar colas y reconciliar hacia delante con autorización separada.

## Convivencia y plan de dos pasos

### Paso 1: expansión compatible, sin afirmar que FIN-09 está arreglado

Conservar `expenses_dedup_idx` y añadir el esquema de origen propuesto. Mantener capacidad v2
desactivada. Un cliente antiguo sigue usando su mismo objetivo de conflicto y no duplica un
reintento. **El índice nuevo no elimina el choque del viejo**: dos orígenes distintos con la
misma tupla antigua siguen sin poder coexistir. Un escritor que apunte al índice de origen
puede recibir `23505` del índice antiguo; no debe convertirlo en éxito ni perder su cola.

En una fase futura separada, desplegar lectores compatibles y el protocolo de ACK, cola y
operación autenticada v2, todavía sin activar la inserción de gemelos. Incluir TODOS los
escritores: web/OTA, clientes cacheados, ingest/Edge y cualquier integración externa. Una
release nueva o una sesión conocida no prueba que no queden escritores antiguos desconectados.

### Paso 2: corte condicionado, no concedido por este diseño

Ensayar copia restaurable, identidad, permisos/RLS, carreras, rollback y protocolos de cada
escritor. Solo se podrá retirar la unicidad por atributos cuando el contrato antiguo ya no
sea necesario y exista una estrategia probada para clientes cacheados que vuelvan tarde.
La activación y el corte tienen que ser coordinados; no activar v2 en una tabla que todavía
rechaza sus gemelos ni retirar el índice antes de adaptar los clientes.

**No hay solución transparente en esta misma tabla que conserve un UNIQUE global sobre los
cuatro atributos y a la vez admita dos filas con esos mismos cuatro atributos.** Añadir banco
al índice, sustituirlo por un parcial de legado o poner una vista delante no mantiene por sí
solo el objetivo `ON CONFLICT` de los clientes antiguos. No se falsean fecha/comercio ni se
trasladan datos a otro almacén de forma implícita para aparentar compatibilidad.

Si no se puede acreditar el fin del contrato antiguo y su retorno tardío, **no ejecutar el
paso 2**: se conserva el índice y se declara el fallo aún abierto. Una pasarela/almacén v2
separado que mantuviera el endpoint antiguo sería otro diseño con fuente de verdad, permisos,
conciliación y coste propios; no se implementa ni se presume aprobado aquí. Bloquear al cliente
antiguo con un error tampoco equivale a mantener compatibilidad.

### Caso exacto del cliente antiguo

Los dos métodos actuales del cliente usan:

```js
{ onConflict: 'user_id,fecha,importe,comercio', ignoreDuplicates: true }
```

Su forma SQL relevante es:

```sql
INSERT INTO expenses (id,user_id,fecha,importe,comercio,source)
VALUES (:id,:user_id,:same_timestamp,2.50,'Cafe sintetico',:source)
ON CONFLICT (user_id,fecha,importe,comercio) DO NOTHING
RETURNING id;
```

| Situación | Resultado que debe comprobar el ensayo SQL |
|---|---|
| Índice viejo intacto, primer cargo | Una fila y un ID retornado. |
| Reintento de la misma tupla contra el índice viejo | Ninguna fila retornada, total una; no es ACK canónico del existente. |
| Dos bancos, mismos timestamp/importe/comercio, índices viejo+nuevo | Segundo cargo antiguo descartado; por objetivo de origen v2, conflicto no cubierto del viejo (`23505`). FIN-09 sigue abierto. |
| Se quita el viejo o se sustituye solo por banco | El `onConflict` antiguo deja de inferir índice y falla `42P10`, incluso al reintentar. Corte incompatible, prohibido sin resolver la transición. |
| Solo v2 tras un corte futuro ensayado, dos orígenes distintos | Dos filas y 500 céntimos; repetición exacta del origen recupera el mismo canónico vía ACK, no otra alta. |

Las reglas de inferencia del objetivo y `RETURNING` se contrastaron con la documentación
oficial de [INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html).
La propuesta usa la semántica normal de NULL de
[UNIQUE y CHECK](https://www.postgresql.org/docs/current/ddl-constraints.html).
Estos fundamentos no prueban que la migración se haya ejecutado ni que la Data API desplegada
responda de una forma concreta.

## Ensayo SQL aislado: preparado, no ejecutado

En esta máquina no se detectaron `postgres`, `initdb`, `pg_ctl`, `psql`, `docker` ni `supabase`
en PATH, ni Docker/PostgreSQL en las ubicaciones estándar revisadas. La resolución local de
`@electric-sql/pglite` dio `MODULE_NOT_FOUND`. No se instaló nada, no se arrancó ningún servicio
y no se inspeccionaron credenciales o bases de datos ajenas. Esto documenta la búsqueda
realizada, no demuestra que no exista algún binario fuera de esas rutas.

Se adjunta [old-client-isolated-cases.sql](fin03-identidad-gastos/old-client-isolated-cases.sql):
fixture de tablas TEMP, índices y SAVEPOINT/DO sintéticos que muestra coexistencia, `23505` y
`42P10`; termina con ROLLBACK. Debe ejecutarse exclusivamente en un motor efímero local
autorizado, nunca contra Supabase vivo. **No ejecutado: sin motor local descubierto.** No
valida el DDL propuesto íntegro, RLS, concurrencia, la Data API ni el contrato completo de ACK.
Un futuro ensayo debe aplicar también los archivos aditivos reales y su reversión sobre una
base desechable, con columnas/tipos/permisos de la versión concreta del servidor.

## Contención opcional, solo propuesta

Un merge podría separar dos filas cuando ambas acrediten bancos distintos, con el espejo
equivalente en servidor. Requiere decisión propia sobre avisos, banco editable y lápidas
legadas; no se cambia directamente `keyOfExpense` para no extender su alcance silenciosamente.
No arregla el choque al guardar, no reconstruye identidad de cuenta y no cierra FIN-03/09.
No se ha implementado, medido ni mutado esa contención.

## Gates pendientes antes de cualquier producto

Contrato de transición aprobado por Claude y dueño; motor SQL aislado y versión real;
inventario restaurable del esquema; cuentas/reconexiones; dos clientes/carreras; RLS entre
usuarios; ACK perdido/timeout; conservación de ediciones, gemelos y lápidas; >2000 filas;
retorno de cliente antiguo; comportamiento al fallar/podar; cliente/servidor con los mismos
céntimos. Mantener los siete ROJOS y los siete controles, y matar mutantes de banco/origen,
referencias, adopción de UUID/ACK y dedup del servidor cuando haya fix autorizado.

Esta fase no cambia cliente/servidor, VERSION, catálogo, caps ni oráculos. No hay SQL vivo,
reparación familiar, fullsuite/CPU6, Gradle, despliegue ni aceptación móvil. Los resultados
de diseño y los ROJOS no equivalen a una solución de producto.
