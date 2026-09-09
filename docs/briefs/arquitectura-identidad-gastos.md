# Identidad de gastos — decisión de arquitectura, 2026-09-08

> Recuperado de la PR #30 el 9/9 para que el diseño no dependa de una rama sin integrar.
> Es un diagnóstico sobre `c37be5ee`, no una auditoría renovada de cada fila de la tabla.
> El histórico ya tiene UUID/ACK de lote y el backfill inseguro de `possibleDup` fue retirado.
> La identidad general, las confirmaciones de edición y el legado siguen pendientes: ver
> [BACKLOG.md](../BACKLOG.md), FIN-03/04/07. Reproducir cada caso contra la base actual antes de editar.
> Diseño para ensayo aislado; no autoriza migraciones ni despliegues en producción.

Estado: **diseño revisado contra c37be5ee, pendiente de implementación y ensayo de migración**.
Responde a `ESQUEMA-INDICE-DEDUP`, mensaje de Claude `20260907T185830Z`.
El objetivo es conservar cargos distintos y reconocer reintentos de un mismo cargo sin inventar
identidad a partir del importe. No hay autorización para cambiar la base de datos de la familia.

## Decisión

Mantener `expenses.id` como UUID canónico. Sustituir finalmente la unicidad por atributos por
unicidad de **identidad de origen**, cuando el origen la proporcione. El banco es contexto;
dos cargos del mismo banco, día e importe siguen siendo dos filas si sus identidades difieren.

No quitar hoy `expenses_dedup_idx`, no añadir solo banco y no falsear fecha/comercio para esquivarlo.
Un UUID nuevo en cada sincronización tampoco sirve: distingue filas pero duplica los reintentos.
Separar identidad, similitud y decisión humana. Una coincidencia heurística solo propone revisión.

## Hallazgos contrastados (buscar por símbolo si se desplazan las líneas)

| Camino | Evidencia en esta base | Consecuencia |
|---|---|---|
| SQL / alta | `0001_init.sql:26`, `00-core.js:addExpense` | UNIQUE por usuario/timestamp/importe/comercio. `ignoreDuplicates` no confirma qué UUID quedó guardado. |
| Importación | `08-motor-bank.js:importObExpenses`, `kOf` | Dedup por día/importe/nombre SIN banco/cuenta, incluso si los IDs externos son distintos. |
| Reintento del mismo lote | `importObExpenses`, `seen` | Se inicializa con el estado previo, pero no se actualiza al añadir una fila. Mismo extId con contenido distinto puede entrar dos veces. |
| Multicuenta | `flattenBankTx` | Concatena `accounts[].transactions`, pierde `uid` de cuenta y corta a 150. No puede construir identidad por cuenta ni asegurar snapshot completo. |
| Lecturas | `00-core.js:mergeExpenses`, `11-app-main.js:syncCloudExpenses` | Agrupan por la misma clave débil; cambiar SQL no basta. `mergeExpenses` colapsa incluso dos filas ya locales. |
| Confirmación | `syncCloudExpenses` + `expenseFromRow` | `keep` conserva todo origen distinto de `supabase`, pero `expenseFromRow` devuelve `manual`, `ob`, etc. No está garantizada la adopción del UUID remoto que promete el comentario de `addExpense`. |
| Persistencia | `addExpense` / `expenseFromRow`, `slimForCloud` | No llevan `extId`, cuenta ni `possibleDup`/decisión. `slimForCloud` elimina expenses: no hay segunda copia completa en app_state. |
| Borrado/edición | `04-tab-gastos.js:keyOfE`, `00-core.js:resolvePossibleDup` | Lápidas por atributos; pueden esconder el gemelo. Los IDs cortos aún modifican por atributos. |
| Servidor/widget | `ingest/index.ts`, `_shared/presupuesto.ts:filasComoLaApp` | Ingest sigue escribiendo con el índice viejo y descartando por similitud; el cálculo vuelve a colapsar por día. |
| Histórico grande | `cloud.pullExpenses` | Tope de 2000 sin paginación: ausencia de una fila en el pull no demuestra que no exista ni que haya sido borrada. |

La aprobación móvil de «posible repetido» no demuestra conservación de todos los cargos, ni local
ni remota. El índice descrito es el del repo; **no se ha inspeccionado pg_indexes en producción**.

## Contrato de datos objetivo

- UUID de fila estable, generado una vez y persistido ANTES de encolar un alta offline.
  El reintento reutiliza ese UUID. Las modificaciones usan UUID + usuario y comprueban fila afectada.
- `identity_version` explícita: legado = 1 por defecto; RPC nueva escribe 2. No inferir protocolo
  de que haya UUID (ya existen UUID antiguos) ni de origen no NULL (un manual nuevo no tiene origen).
  Este marcador decide qué política de lectura/revisión corresponde durante la transición.
- Columnas propuestas de origen: `origin_provider`, `origin_account`, `origin_id`, todas texto
  nullable; CHECK: o las tres NULL o las tres no vacías. UNIQUE normal sobre
  `(user_id, origin_provider, origin_account, origin_id)`. Filas antiguas quedan con las tres NULL;
  no se reconstruyen IDs bancarios a partir de fecha/importe/comercio.
- La PK ya hace idempotentes las altas manuales. La clave de origen hace idempotente importar
  la misma transacción en dos dispositivos con UUID locales diferentes. El alta devuelve el UUID
  canónico y el cliente lo adopta también en orden manual, referencias de gemelos y operaciones pendientes.
- `origin_account` es una identidad de cuenta opaca y estable, nunca la posición del array ni solo
  la entidad bancaria. Preservar `accounts[].uid` desde bank-sync; comprobar estabilidad al renovar
  consentimiento. Si cambia, resolver alias con evidencia del proveedor en servidor; no fusionar
  por nombre/banco. IBAN ni extractos personales se escriben en fixtures, logs o documentación pública.
- Identidad de origen inmutable aunque se cambie el banco visible, categoría, comercio o nota.
  Pending→booked solo reutiliza identidad con referencia estable demostrada; no por parecido.
- Guardar la revisión de posible duplicado (`pending`, `distinct`, `same`) y referencia al gemelo
  en la tabla, con relación restringida al mismo usuario. `pending` no cuenta; `distinct` cuenta;
  `same` conserva registro/identidad pero no cuenta. Así la decisión sobrevive a reinstalación.
- Borrado lógico por UUID (`deleted_at`) en el protocolo nuevo. Conservar identidad de origen
  después del borrado impide resucitarlo al reimportar; el gemelo conserva su propia fila.
  Borrado de cuenta/RGPD sigue eliminando datos por el circuito existente.

El índice nullable no falla por duplicados lógicos ya existentes: las filas antiguas no reciben
una clave inventada. PostgreSQL permite múltiples NULL con UNIQUE normal. Antes de rellenar claves
reales se comprueban conflictos; no se borra ninguna fila para que «entre» el índice.
[Referencia de constraints](https://www.postgresql.org/docs/16/ddl-constraints.html).

## Alta transaccional y confirmación

Preparar una RPC versionada para protocolo 2; no otro upsert que ignore el resultado.
Contrato: `{canonicalId, status: inserted|existing|needs_review, revision}` o error explícito.
Usuario derivado de autenticación, RLS, permisos mínimos, sin confiar en un user_id libre enviado
por el cliente. Si se usa SECURITY DEFINER, fijar search_path, restringir EXECUTE y verificar dueño
de todas las filas/referencias. Registrar la RPC como escritura protegida del modo pruebas.

1. Si existe UUID: comprobar propietario e identidad; devolver existente solo si casa. No tratar
   cualquier conflicto de PK como éxito ni sobrescribir una fila ajena.
2. Si existe origen exacto: devolver su UUID; conservar ediciones humanas. Una discrepancia de
   importe/moneda no se oculta bajo `ignoreDuplicates`: revisión o transición validada del proveedor.
3. Insertar si no existe; resolver las carreras mediante las restricciones y relectura canónica.
   Ensayar dos transacciones concurrentes; un SELECT previo sin UNIQUE no garantiza idempotencia.
4. El cliente mantiene cola persistente de operaciones hasta ACK; error/auth ausente/timeout no
   equivale a guardado. Reintentar tras vuelta a primer plano sin reescribir todo el histórico.
  No mostrar «al día» si quedan altas fallidas. Ediciones/borrados requieren resultado confirmado.
  Serializar operaciones de una misma fila y exigir revisión esperada en ediciones/borrados para
  que un reintento antiguo no pise un cambio confirmado desde otro dispositivo.

Sin ID bancario fiable (TR es el caso documentado), **no existe una función de fecha/importe/nombre
que distinga con certeza un reintento de dos compras idénticas**. Conservar evidencia y marcar la
ambigüedad. No generar un UUID por cada refresh ni usar el índice del array como identidad.
Importar multiplicidad automáticamente exige snapshot completo, cuenta, ventana, paginación y
proveniencia conocidas; hoy el recorte a 150 lo impide. Para una primera entrega acotada, llevar
esos lotes ambiguos a revisión con estado persistido; la confirmación explícita crea los UUID.
No prometer importación automática exacta para ese caso hasta tener ese contrato.

## Secuencia segura de implementación y despliegue

**A — Solo desarrollo, sin efectos en producción.** Claude prepara migración aditiva con columnas,
índice y RPC desactivada para uso real. Cursor prepara protocolo 2 detrás de capacidad del servidor.
Se conserva el índice antiguo: mientras exista, los gemelos siguen bloqueados y NO se anuncia
resuelto el problema. Probar contra PostgreSQL/Supabase de pruebas y dos clientes aislados.

**B — Lectores y escritores compatibles ANTES del corte.** Actualizar como una unidad importación,
merge/pull/backfill, conversiones, borrado/edición, revisión de repetidos y presupuesto de ingest.
Para filas nuevas, sumar por UUID/estado de revisión; no aplicar dedup por atributos. Para legado,
inventariar grupos que la UI venía colapsando (notificaciones dobles reales incluidas): no pasar de
sumar una a sumar todas sin revisión. Conservarlos y exponer la ambigüedad; no «limpiarlos» en SQL.
Las lápidas viejas no se traducen en borrados masivos por parecido; resolverlas solo con identidad
demostrada, preservando el legado mientras haya ambigüedad. Cambiar los tests que exigen fallback
eterno por atributos: abortar de forma visible una edición ambigua es preferible a tocar gemelos.

**C — Ensayo de migración.** Copia privada/restaurable del esquema y datos; comparar por usuario
conteos, suma firmada de importes, UUIDs y campos editados antes/después. Las sumas solas no bastan.
Backfill paginado de >2000 filas. No mapear un UUID local a uno remoto solo porque se parecen;
si no hay correspondencia exacta, conservar y revisar. Distinguir fila perdida de consulta parcial.
Volver a conectar un segundo cliente sin estado y probar todas las decisiones de duplicado.

**D — Corte autorizado de producción, solo con B y C verdes.** Inventariar TODOS los escritores:
OTA de cada dispositivo, ingest desplegado y cualquier MacroDroid/cliente externo que escriba
directamente. Preparar compatibilidad en cada uno y comprobar versión/capacidad realmente activa.
No basta que beta esté actualizada: Supabase es único y la familia puede seguir con otra OTA.
Solo entonces retirar `expenses_dedup_idx` y activar protocolo 2; ensayar previamente bloqueo,
timeout y rollback de esa operación. No editar migración 0001; usar nuevas migraciones numeradas.

**Límite explícito de compatibilidad:** al retirar ese índice los clientes viejos que aún manden
`ON CONFLICT(user_id,fecha,importe,comercio)` fallarán: necesita un índice compatible. Un índice
parcial o añadir banco no conserva ese contrato. No aceptar ese fallo silencioso como transición.
[Referencia de ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html).
Si no se puede retirar el uso de clientes antiguos, **no ejecutar D**. La alternativa es un almacén
v2 separado con migración por usuario y adaptador legado, trabajo distinto que no se debe improvisar
en esta tanda. La opción por defecto aquí es migración coordinada en la tabla existente, sin dos
fuentes de verdad permanentes. No prometer compatibilidad eterna con APK/OTAs cacheadas antiguas.

**Rollback:** antes del corte, desactivar capacidad v2 y conservar esquema aditivo/datos. Después
de insertar gemelos, NO recrear el UNIQUE viejo ni restaurar una copia que borre altas nuevas.
Pausar escrituras afectadas conservando cola local y resolver hacia delante; una restauración
necesita reconciliar todas las operaciones posteriores. La prueba de este límite forma parte de C.

## Pruebas de aceptación obligatorias

1. Dos IDs de proveedor distintos, mismo banco/día/importe/comercio: dos filas locales/remotas y
   suma de ambas; variante con bancos y cuentas distintos, incluso si el extId se repite entre cuentas.
2. Mismo origen repetido en el lote, en dos syncs y en dos clientes concurrentes: una sola fila;
   mismo UUID manual reintentado: una; dos UUID manuales legítimos iguales en atributos: dos.
3. Pull/reinicio/segundo cliente conservan identidades, ediciones humanas y decisiones pending/distinct/same.
4. Borrar/editar uno no oculta/toca el gemelo; reimportar el borrado no lo resucita; legado ambiguo
   no emite UPDATE/DELETE por atributos. Categorizar no cambia banco, importe ni filas ajenas.
5. Error RPC, timeout tras commit y falta de sesión: cola intacta, aviso, reintento sin duplicado.
6. Proveedor sin ID, snapshot parcial y renovación de cuenta: revisión conservada, cero descartes
   por parecido y cero «identidad» basada en orden. Ingest: dos notificaciones de un mismo pago no
   inflan presupuesto; dos pagos reales parecidos no se descartan automáticamente.
7. App, alertas e ingest/widget calculan igual para mismas filas/estados; no basta probar helpers.
   Si cambia payload nativo, APK nueva. Si cambia solo cálculo servidor, despliegue Supabase autorizado.
8. Migración con datos legado, RLS entre dos usuarios, >2000 filas, rollback y cliente antiguo.
   Unitarios en runner, E2E en mapa y SQL de integración ejecutado realmente. Un mock de Supabase
   no prueba UNIQUE, carreras, RLS ni el plan de corte.

## Reproducción mínima del defecto actual

Desde la raíz, ejecutar `npm run build` y este JavaScript con Node en modo módulo
(`node --input-type=module`, entrada estándar). Solo utiliza datos sintéticos y lógica local:

```js
import { loadPureLogicFromFile } from './scripts/load-pure-logic.mjs';
const c = loadPureLogicFromFile();
const date = new Date().toISOString().slice(0, 10);
const s = { accounts: [{id:'a', ent:'caixa', role:'diario'}], expenses: [],
  fixed: [], debts: [], oneoffs: [], settings: {expenseBanks:['caixa','sabadell']} };
const a = {ent:'caixa', id:'tx-a', date, amount:12, merchant:'Prueba'};
for (const [label, b] of [
  ['IDs distintos', {...a, id:'tx-b'}],
  ['Bancos distintos', {...a, ent:'sabadell', id:'tx-b'}],
  ['Mismo ID, cambia contenido', {...a, merchant:'Otro'}]
]) console.log(label, (c.importObExpenses(s, [a,b]) || []).length);
const rows = [
  {id:'550e8400-e29b-41d4-a716-446655440001', date, amount:12, merchant:'Prueba', ent:'caixa'},
  {id:'550e8400-e29b-41d4-a716-446655440002', date, amount:12, merchant:'Prueba', ent:'sabadell'}
];
console.log('Merge de UUIDs distintos', c.mergeExpenses(rows, []).list.length);
```

Resultado reproducido en esta auditoría: **1, 1, 2, 1**. Objetivo: **2, 2, 1 con discrepancia
revisable, 2**. Los tests existentes `ob-ingresos`, `ob-renombrar` y `expense-id-cloud` pasan;
no demuestran este contrato. Este guion documenta el fallo, no sustituye los tests de implementación.
