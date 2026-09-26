# FIN-08 · daños históricos: diagnóstico y propuesta

Fecha: 26/9/2026. Investigación y propuesta, **sin reparación de datos reales**.
No se prueba una pérdida individual adicional ni se autoriza restauración, import familiar,
backfill masivo, migración, cambio de identidad o despliegue. FIN-03 y OPS-02 siguen abiertos;
FIN-04 es también una dependencia para confirmar escrituras sin pisar decisiones posteriores.

## Base y estado contrastados

- Worktree administrado exclusivo `fin08-diagnostico`, rama `codex/fin08-diagnostico`, desde
  `origin/beta` **8bf229d429f4316289719ec4b583726a688ab5eb**. La raíz y FIN-07 quedan intactos.
- Fetch remoto: `origin/main` **91c5a4f43eaa84ac1a11a00f76c0dfccae998b0e**. Cierre documental
  sobre el merge FIN-07 **8cd41f093f6f718f39aeb1a41755993d40889aef**; no relanzar su deploy.
- `npm run salud` consultado en esta sesión: producción HTTP **4.26.52**, beta **4.26.52.1**,
  bundles y APK HTTP 200. APK estable 4.26.32/code 48; beta 4.26.49/code 50.
  Su frase «no hay nada pendiente» compara VERSION y **no acredita contenido/aprobación**.
  Diff main/beta conserva FIN-05 y selector; sus checklists/veredictos pendientes no se alteran.
- FIN-06 cliente aprobado/publicado; su backend preparado no se despliega. Referencia del último
  Supabase en el cierre FIN-07: Action 36196554737/be59e27c; aquí no se inspeccionó el código
  remoto activo, índices reales ni RLS. SQL/Edge descritos debajo son **los del repo**.
- FIN-07 está cerrado. Descarga completa de filas accesibles no garantiza snapshot global,
  identidad ni que todas las filas lleguen al render. No se reabre la paginación.
- Reconsultados sin relanzar: Promote 36257644323 y Pages 36258292782 `completed/success`;
  Pages corresponde al merge 8cd41f09. No se repite toda la evidencia HTTP/ZIP del cierre FIN-07.

## Qué se demuestra y qué no

**Demostrado:** mecanismos ejecutables que pueden colapsar filas, crear ocultaciones amplias,
proponer DELETE o cambiar campos. Se contrastan con código actual, commits y fixtures ficticios.
**Hipótesis:** que alguno explica una fila ausente/categoría incorrecta de una cartera concreta.
**Falta:** evidencia privada original, copias previas, tabla cruda actual, identidad de origen,
decisiones del usuario y versión efectiva de cada escritor al producirse el incidente.

El [informe del 6/9](incidencias-integridad-2026-09-06.md) registra discrepancias visibles en
capturas privadas. No se han vuelto a inspeccionar esas imágenes en este chat; ese relato no
permite asignar UUID ni probar DELETE remoto. No se han recibido aquí extractos/capturas/copias
privadas con ruta autorizada ni acceso de lectura a una cartera. **Inventario de filas reales:
no realizado**; no equivale a cero filas dañadas. No se buscan datos personales en carpetas
ajenas ni se extraen carteras a través de herramientas de diagnóstico.

## Matriz de mecanismos y evidencia necesaria

Los símbolos son referencias estables; las líneas pueden desplazarse. Todos los archivos de
fuente son relativos al repo. Las observaciones actuales se refieren a la base indicada.

| ID / tipo | Evidencia código/historial contrastada | Estado y efecto | Qué permitiría confirmar un caso real |
|---|---|---|---|
| M1 · colapso en mezcla | `00-core.js:keyOfExpense`, `mergeExpenses`, `mergeExpensesFromCloud`. Antes del Paso 0 la clave era día/importe/comercio para todos; `92477163` añade ID solo a manuales. | **Actual:** OB/ob-hist/notificaciones conservan la clave sin UUID, banco ni cuenta. Dos UUID de bancos distintos pueden quedar en una fila. `mergeExpenses` colapsa también prevList. `mergeExpensesFromCloud` selecciona la primera clave y refresca sus campos, conserva ID local; puede juntar categoría/nota de B con ID/banco de A. | Tabla cruda o copia con ambos UUID, fuentes/cuentas distintas y local antes/después. Comparar campos e identidad; suma o número visible solos no bastan. Ausencia local no implica DELETE cloud. |
| M2 · rechazo antes del alta diaria | `08-motor-bank.js:importObExpenses`, `seen`, `scopedKOf`, `modeledHit`. | **Actual:** seen acota banco+extId, pero clave secundaria banco/día/importe/nombre aún descarta IDs externos distintos del mismo banco; no lleva cuenta. Fijos/puntuales modelados y ventana mes+8 días también excluyen filas por diseño. No confundir exclusión prevista con pérdida. | Feed original por proveedor/cuenta/transacción, período solicitado, versión y configuración de recibos; distinguir no importado de borrado. Dos cuentas con mismo banco no se distinguen en diario aplanado. |
| M3 · alta no insertada en nube | `0001_init.sql:expenses_dedup_idx`; `00-core.js:addExpense/addExpensesBatch`; ingest upsert. Ninguna migración del repo retira ese índice. | **Contrato repo actual:** UNIQUE usuario/**instante completo**/importe/comercio; ignoreDuplicates. UUID distinto no salva conflicto de atributos. OB fecha al mediodía local favorece colisiones. addExpense no devuelve UUID canónico; lote solo ACK de insertadas; `histApplyBatchAck` retira localmente candidatos sin ACK en camino online. No se ha ejecutado PostgreSQL ni comprobado índice vivo. | Copia local/source previa + resultado INSERT/ACK exacto + tabla/índices reales. `skipped`/conflicto no prueba identidad. Conservar informe privado de rechazadas, no reimportar a ciegas. |
| M4 · lápida amplia / ocultación | `00-core.js:expenseIsTombstoned`, `pushDeleted`; `08-motor-bank.js:delSet`; espejo `_shared/presupuesto.ts:filasComoLaApp`. | **Actual:** lápidas antiguas día/importe/comercio siguen ocultando gemelos, incluso manuales con otro ID y banco. Import diario admite lápida no acotada por banco. Poda a 500: ausencia de lápida no prueba que nunca hubo borrado. Tabla puede conservar filas ocultas. | `deleted` previo/actual de cada cliente y app_state, fila cloud cruda y copia antes de decisión. Una clave amplia no identifica cuál se quería borrar. No borrar todas las lápidas. |
| M5 · retirada local automática histórica | `ae8a101622d2eaf851092b6d894ead71c45dc9e8` (`279a71ac^`): `fixMovInvasion` retiraba OB «Movimiento» por importe ±3 días frente a otra vía, sin exigir banco; escribía lápidas. `279a71ac` elimina esa rama. | **Histórico reproducido; contenido hoy.** Actual no elimina ni crea lápida por esa similitud, pero todavía repara categorías bajo `_fixMovInvasion2`. No cambiar/subir flags para forzar otra reparación. | Copia anterior/posterior y flags efectivos, UUID/origen de fila retirada, prueba de ejecución de aquella versión. Lápida sola no demuestra que la creó esta limpieza. |
| M6 · DELETE remoto automático histórico | `f9540749` añade `reconcileObDupes` → `syncCloudExpenses` → `cloud.deleteExpense`; `ae8a1016` propone borrado OB sin nombre por importe ±3 días, sin banco, y entrada de cashback; `279a71ac` retira esas propuestas/call site. | **Histórico reproducido:** candidato crossbank, eliminación local y lápida. DELETE antiguo filtra usuario+timestamp completo+importe+comercio; no se afirma DELETE masivo por día. Con el UNIQUE del repo la terna no permite varias filas iguales simultáneas. La prueba propone DELETE, no lo ejecuta en nube. | Copia previa con fila, log/ACK DELETE o auditoría servidor y tabla cruda posterior con visibilidad estable. Sin ACK/auditoría: ausencia con identidad probada es compatible con borrado, no causalidad demostrada. |
| M7 · categorías e inversiones arrastradas | `8d1222ae` corrige `04-tab-gastos.js:setCat`: antes aprendía «Movimiento»→inversión y arrastraba hermanos en Otros con compras de participaciones. `fixMovInvasion`, `seedFlows`, `resolveCategory`, `refreshExpenseFromCloud` siguen ejecutando transformaciones. | **Histórico demostrado por diff. Actual:** neutras/Movimiento no se aprenden; Otros no manuales y categoria genérica del pull se resuelven por reglas/overrides; energía se remapea. Cuotas/cashback/aporte aún se clasifican según contrato. Categoría visible puede diferir de cat cruda. Una regla mejor hoy no prueba error pasado ni decisión humana. | Snapshot original de cat/catOverrides/debtId, nota editada, referencias invest*, posiciones/aportaciones y acción/ACK. Reparar categoría sola puede dejar inversión artificial; modificar posiciones sin enlace probado también daña. |
| M8 · one-shot de recategorizar | `scripts/recat-una-vez.mjs`, commits `90932e74`, `2558a3a9`, `53b76caa`. Comparación regla antigua/nueva, apartado de override actual. | **Riesgo actual leído, no ejecutado:** cat igual a regla vieja no prueba autoría; un usuario pudo escoger esa misma categoría y después quitar override. SELECT único limit50000 sin cursor; PATCH por id sin precondición de cat/revisión; HTTP OK no valida cardinalidad; copia parcial del plan en temporal, no restauración integral verificada. No usar ni su modo ensayo sobre familia en este ticket: imprime datos privados. | Plan/ACK original privado y copia previa completa, decisión humana y versión de reglas. No afirmar que este script se aplicó a ninguna fila por existir en Git. |
| M9 · lectura parcial / feed corto | Historial `pullExpenses` tuvo limit2000 y luego keyset fecha con página corta/tope; FIN-07 corrige esos límites. `flattenBankTx` antiguo slice150 retirado por `5730fc7c`; diario y helper bancario conservan ventanas/topes de proveedor. | **Lectura, no DELETE.** FIN-07 obtiene filas accesibles; filtro de lápidas y mezcla siguen M1/M4. bankTx es feed, no copia íntegra del histórico. Diario pierde UID de cuenta; histórico `histFlattenHistoryLinks` conserva procedencia local, no la serializa completa a expenses. | Tabla cruda paginada o export consistente de servidor; respuesta bancaria con truncated/errores, cuentas y continuation. Un resultado parcial se aparta; no propone bajas por ausencia. |
| M10 · decisiones/ediciones perdidas o reintroducción | `expenseCloudEq`, `setExpenseDup/Bank/Cat/Note/deleteExpense`; UUID local puede diferir del remoto; no comprueban filas afectadas, varias resuelven sin sesión. `syncCloudExpenses` backfill sube locales no presentes por clave. | **Actual FIN-03/04 abierto:** falsa confirmación o source antiguo reescrito; nota editada local protegida no equivale a persistencia. Backfill puede reinsertar una fila solo-local ausente en nube; restore + siguiente pull no es rollback. No reintroducir backfill de marca possibleDup retirado. | UUID canónico, sesión, patch y ACK fila resultante, dos clientes/estado de cola. Comparación transaccional y arbitraje de todos los escritores antes de reparar. |
| M11 · ingest: rechazo/retirada específica | Antiguo ingest anterior a `dbf8c2fc`: descarte por ±10 min/importe y día/comercio. Actual `_shared/ingest_identity.ts:esGemeloIngest/tieneGemeloAnterior` + `ingest/index.ts`. | **Código repo:** eventos sin identidad quedan posibles repetidos; con claves TR/Wallet se rechaza antes de insertar o se borra solo UUID recién insertado tras carrera. Exige puertas cruzadas/tarjeta TR/importe/tiempo, no demuestra transaction_id bancario compartido. No confundir este DELETE con la ruta retirada M6 ni afirmar contención universal. Backend activo no inspeccionado; deployment/identidad es OPS-01/FIN-03. | Payload/clave de evento privado, proveedor/cuenta/transacción del banco, versión Edge efectiva y ACK. Dos avisos parecidos de puertas distintas pueden requerir revisión de identidad; no restaurar todos los skipped. |

## Inventario privado requerido antes de escoger filas

Un fichero privado fuera de Git/canal, con acceso autorizado por propietario y sin mezclar
usuarios. Una fila de inventario por evidencia de operación, incluso cuando no existe UUID cloud;
no inventar uno para cubrir el hueco. El informe público solo contiene mecanismo/estado/conteos
no identificables; originales y hashes de evidencia personal permanecen privados.

| Grupo | Campos mínimos del inventario privado |
|---|---|
| Identidad | Propietario opaco, UUID local/cloud/original o «ausente», origen/proveedor, cuenta opaca y transacción externa, ingest_event_id/extId cuando existan, vínculo probado o ambiguo y motivo. No asumir que banco = cuenta. |
| Valores originales | Importe firmado, moneda ISO y original/convertido si constan, precisión/redondeo, fecha operación/contabilización/instante y zona conocidos, banco, comercio/obName, nota/nota_edit. Desconocido = ausente, nunca EUR/1:1/hora inventados. |
| Decisiones | cat cruda/visible, overrides vigentes en cada snapshot, possibleDup/possibleDupOf o decisión conocida, source/#dup, debtId/cuotaNo, deleted con todas las coincidencias, flags de limpieza, invest* y referencias/order. |
| Evidencia | Identificador privado de copia y hash, fecha/cliente/versión/procedencia, fuente de comparación independiente, resultado de lectura completa, ACK/log disponible, antes/después. Clasificación: visible oculto / no insertado / borrado compatible / borrado acreditado / campo divergente / ambiguo. |
| Propuesta | Acción exacta por UUID/campo, precondición y valor antes/después, razón, confianza, autoridad/decisión requerida, conflictos/otros gemelos, rollback y estado pendiente. |

Una suma igual puede esconder sustitución de filas, signo/categoría cambiados o dos operaciones
colapsadas. Comparar primero conjunto de UUID/origen y campos, luego conteos y sumas **por moneda,
cuenta, período y signo**. No sumar monedas distintas ni compensar pérdidas con un saldo parecido.

## Propuesta concreta por daño (para aprobar después, no ejecutar ahora)

Puerta común: FIN-03 debe resolver identidad canónica/compatibilidad y FIN-04 confirmación y
conflictos. No basta parche por atributos. Si el protocolo disponible no garantiza esas
precondiciones, bloquear la escritura. OPS-02 debe demostrar rollback cloud **y** local en pruebas.

| Daño confirmado | Propuesta limitada | Precondición y parada |
|---|---|---|
| Fila cloud existente oculta por lápida/filtro/merge | Recuperar visibilidad de UUID concretos conservando contenido; sustituir solo decisión amplia acreditada por decisiones por identidad con protocolo capaz. Ningún INSERT/DELETE cloud por mero problema visual. | Identidad y voluntad original probadas; enumerar todos los UUID afectados por la misma lápida. Si no se sabe cuál fue borrado voluntariamente, mantener evidencia y revisión possibleDup; no retirar clave amplia en bloque. M1 necesita lector capaz de conservar multiplicidad. |
| Alta legítima nunca insertada/rechazada por conflicto | Proponer alta aditiva desde evidencia completa, identidad estable y UUID original solo si probado y seguro. Ausente sin UUID: needs_identity, no rellenarlo desde una terna. | Origen estable y prueba de que falta en todas las fuentes completas; no reintento con UUID aleatorio ni falsear fecha/nombre para esquivar UNIQUE. FIN-03 debe permitir ambas filas y hacer reentrega idempotente antes. |
| DELETE real acreditado | Restaurar únicamente fila(s) autorizadas desde copia íntegra verificable, con misma identidad y valores; retirar solo lápida de esa decisión. | Distinguir borrado automático indebido de borrado humano. UUID libre/origen no ocupado ni borrado posterior legítimo. Un payload bancario semejante no reconstruye nota/decisiones originales. Si faltan, declarar recuperación parcial y pedir decisión posterior. |
| Categoría/nota/banco/decisión divergente | Patch del campo exacto sobre UUID/revisión esperada, usando valor histórico autorizado; preservar cambios posteriores en otros campos y notas editadas. Sin clasificación masiva por regla antigua/nueva. | Prueba de intención/campo anterior; conflicto detiene la fila. Si no se sabe cuál categoría es correcta, revisión sin aplicar. `possibleDup` sigue pendiente cuando no hay prueba de mismo/distinto. |
| Inversión artificial causada por recategorización | Propuesta separada dentro del caso: revertir solo efectos enlazados a UUID y transacción invest* probados, con posiciones/coste/participaciones respaldados y ensayo. | No restar por importe agregado ni reverseInvestBuy sin traza íntegra; precios actuales no reconstruyen coste histórico. Si enlaces faltan, se aparta ese efecto y no se promete reparación integral. |
| Lectura incompleta, snapshot desactualizado o configuración que excluye presupuesto | Diagnóstico de visibilidad/completitud; no crear ni eliminar filas. Confirmar en entorno aislado con copia/tabla cruda y filtros explícitos. | No usar producción como banco de pruebas ni cambiar configuración financiera para forzar totales. Pending→booked/Wallet/TR sin identidad demostrada permanecen como ambigüedad. |

### Copia restaurable y simulación sin escrituras

1. Con autorización específica de **lectura privada**, capturar fuente cruda completa de expenses
   y app_state, ambas claves locales (`micartera_v3`, `micartera_v3_exp`), decisiones/lápidas,
   referencias de lote/ACK/order y, si hay efectos de inversión, entidades enlazadas. Cada captura
   tiene propietario, versión/fecha, hash y validación de esquema/UUID/campos. Fuentes concurrentes
   no forman un snapshot por tomarlas a la vez: exigir snapshot servidor consistente o detectar
   cambios y abortar. No usar FIN-07 como prueba de atomicidad global.
2. Guardar copia íntegra inmutable fuera de repo y canal; verificar lectura y hash de vuelta.
   Copia automática no equivale a historial inmutable: `backupState` upsert por usuario/día,
   poda a 30 días y captura el estado que conoce ese cliente (puede estar incompleto).
   El mismo día puede sobrescribirse desde otro cliente. No declarar que existe copia anterior
   intacta sin inspeccionarla. Retención puede haber vencido.
3. Ensayar restore de esa estructura en perfil/servidor **aislados con datos ficticios** y rechazar
   copia corrupta/incompleta/otro dueño. `AutoBackupsPanel.restore` actual llama mcSaveRaw y set,
   no repone expenses cloud; el efecto de App/backfill/pull posterior puede resubir/remezclar.
   No usarlo sobre la cartera real como test ni como rollback coordinado.
4. Planner offline puro: compara snapshots por UUID/origen, genera plan inmutable con ID/hash,
   filas autorizadas, campos exactos, valores esperados y resultantes, conflictos y explicación.
   **Cero llamadas de cloud/import/restore/migrate/seedFlows**, ni guardado local de la app.
   Si una fila no tiene identidad o snapshot fiables: apartado needs_identity. Simular sobre
   clones; proyectar conteos, conjuntos y sumas por moneda; mismo input → mismo plan.
5. Antes de una aprobación real, entregar lista privada revisable y ensayo/rollback con resultados
   por UUID/campo, no solo un total. La aprobación debe nombrar hash del plan, dueño, filas/campos,
   copia y límites; no es permiso global ni se hereda de la publicación de FIN-07.

### Aceptación de una reparación futura

Estos son **criterios pendientes de implementar/ensayar**, no garantías del cliente actual.
Sin servidor capaz o sin aislamiento verificable de todos los escritores, no hay escritura real.

| Escenario | Resultado exigido |
|---|---|
| Aplicación normal | Solo UUID/campos aprobados cambian; identidad/importe/moneda/fecha/banco/nota y decisiones no autorizadas iguales byte a byte o normalización justificada. Conjuntos y conteos exactos; deltas de sumas previstos por moneda/cuenta/mes. Cargos legítimos parecidos sobreviven. |
| Reinicio a mitad | Journal duradero con operationId/UUID/hash/ACK; reanudar tras leer estado actual, sin repetir efecto de inversión ni restaurar snapshot entero. No inferir éxito de progreso de UI. |
| Segundo cliente / ingest / OTA antigua | Detectar revisión/snapshot cambiado y detener conflicto; ACK tardío no rebaja datos nuevos. Todos los escritores respetan protocolo o se aíslan con corte autorizado. Comprobar pull/backfill no reintroduce estado viejo. Un lector viejo que vuelve a colapsar invalida el ensayo. |
| Red perdida antes de commit | Sin ACK no afirmar aplicada; conservar plan y comprobar estado por UUID/operación al volver. La app offline mantiene evidencia, no crea sustitutos con nuevos UUID. |
| Timeout después de commit | Consultar ledger/resultante; reintento de la misma operationId devuelve mismo resultado sin reaplicar. HTTP 200 con cero filas no cuenta como ACK. |
| Repetición / orden invertido | Plan exacto repetido = cero delta adicional; mismo operationId con otro payload rechazado. Conflicto o identidad ambigua no se soluciona buscando gemelo por parecido. |
| Rollback | Restaurar solo delta propio con precondición del estado posterior esperado; si hubo edición/alta posterior, conflicto y revisión. Copia completa permite recuperación de desastre bajo corte, no sobrescritura cotidiana automática. Reinicio y segundo cliente conservan resultado. |

## Reproducciones ejecutadas sin datos reales

Se usó `loadPureLogicFromFile` sobre el artefacto de la base beta y fixtures ficticios, con Node
por stdin, sin crear scripts ni conectar a red. Diez asserts verdes:

| Caso | Resultado observado |
|---|---|
| R1 merge de OB con UUID/bancos distintos y misma clave | 2 → 1 fila |
| R2 manuales con UUID distintos | 2 → 2 filas |
| R3 lápida heredada de A aplicada a otro UUID/banco | ocultación = true |
| R4 cloud B refresca local A con misma clave | 1 fila; ID y banco A, categoría/nota B |
| R5 import diario: IDs externos distintos del mismo banco, ingreso igual/día | 2 → 1 alta |
| R6 import diario: bancos distintos | 2 → 2 altas (la mezcla posterior R1 puede colapsarlas) |
| R7 reconciliación previa a contención con cruce de bancos | 2 → 1 fila; propone 1 DELETE y 1 lápida |
| R8 reconciliación actual del mismo fixture | 2 filas, 0 DELETE, 0 lápidas |
| R9 fix de arranque previo frente actual | anterior 1 fila/1 lápida; actual 2 filas/0 lápidas |
| R10 cat cruda Otros en fila OB con comercio de supermercado ficticio | cruda Otros / leída Supermercado |

La primera comparación histórica aisló funciones de `279a71ac^` con helpers actuales; se repitió
R7/R9 contra **el artefacto histórico completo** `ae8a1016:public/index.html` y ambos resultados
coincidieron. La reproducción no acredita despliegue/ejecución en una cuenta ni ACK DELETE.
Una forma copiable de repetir el núcleo (Node módulo por stdin desde este worktree):

```js
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {loadPureLogic,loadPureLogicFromFile} from './scripts/load-pure-logic.mjs';
const c=loadPureLogicFromFile();
const h=execFileSync('git',['show','ae8a1016:public/index.html'],
  {encoding:'utf8',maxBuffer:8000000});
const old=loadPureLogic(h.replace(/MI CARTERA v3|MICARTERA v3|MiCartera v3/g,'AELY v3'));
const a='550e8400-e29b-41d4-a716-446655440001';
const b='550e8400-e29b-41d4-a716-446655440002';
const e={id:a,date:'2026-09-26T12:00:00.000Z',amount:17,
  merchant:'Comercio ficticio',category:'otros',source:'ob',ent:'sabadell',note:'Nota A'};
assert.equal(c.mergeExpenses([e,{...e,id:b,ent:'revolut'}],[]).list.length,1);
assert.equal(c.mergeExpenses([{...e,source:'manual'},{...e,id:b,source:'manual'}],[]).list.length,2);
assert.equal(c.expenseIsTombstoned({...e,id:b,ent:'revolut'},
  {[c.keyOfExpenseLegacy(e)]:1}),true);
const m=c.mergeExpensesFromCloud([e],[{...e,id:b,ent:'revolut',category:'super',note:'Nota B'}]);
assert.deepEqual([m.list.length,m.list[0].id,m.list[0].ent,m.list[0].category,m.list[0].note],
  [1,a,'sabadell','super','Nota B']);
const s={accounts:[],settings:{expenseBanks:['sabadell','revolut']},expenses:[],
  fixed:[],debts:[],oneoffs:[],investments:[],catOverrides:{}};
const tx={id:'tx-ficticia-A',date:'2026-09-26',amount:-17,merchant:'Ingreso ficticio',ent:'sabadell'};
assert.equal(c.importObExpenses(s,[tx,{...tx,id:'tx-ficticia-B'}]).length,1);
assert.equal(c.importObExpenses(s,[tx,{...tx,id:'tx-ficticia-B',ent:'revolut'}]).length,2);
const pair=[{...e,merchant:'Movimiento'},{...e,id:b,source:'macrodroid',ent:'revolut'}];
const r=old.reconcileObDupes({...s,expenses:pair});
assert.deepEqual([r.state.expenses.length,r.borrar.length,r.state.deleted.length],[1,1,1]);
assert.equal(old.fixMovInvasion({...s,expenses:pair}).expenses.length,1);
assert.equal(c.reconcileObDupes({...s,expenses:pair}).borrar.length,0);
assert.equal(c.fixMovInvasion({...s,expenses:pair}).expenses.length,2);
assert.equal(c.expenseFromRow({id:a,fecha:e.date,importe:17,comercio:'Mercadona ficticio',
  cat:'otros',source:'ob:sabadell'}).category,'super');
console.log('FIN-08: mecanismos reproducidos; ninguna cartera real usada');
```

Para R5/R6 el día del fixture debe estar en la ventana del importador. Esta ejecución es del
26/9/2026; repetición futura exige reloj fijo o fixture nuevo, sin inferir un arreglo por cero altas.

### Simulación concreta de la propuesta (solo memoria)

Se ejecutó además un planner mínimo sobre **dos filas ficticias**, una ausente y otra con cat
divergente, con identidad de origen explícita en ambas fuentes. Generó un patch de categoría
y una alta propuesta; clonó en memoria, comprobó UUID/campos completos, conteo 1→2 y EUR 17→34,
hash del input intacto y segunda comparación con delta cero. No llama al motor de la app.
Esto demuestra el formato de comparación, **no** implementación de recuperación, ACK duradero,
idempotencia de servidor, aislamiento, ni copia restaurable real. Ambos UUID son del fixture.

Bloque ejecutable por stdin, sin ficheros ni red:

```js
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const id=n=>'550e8400-e29b-41d4-a716-'+String(n).padStart(12,'0');
const row=(n,cat)=>({id:id(n),origin:{provider:'fixture',account:'account-A',
  transaction:'transaction-'+n},amount:17,currency:'EUR',date:'2026-09-26',
  bank:'bank-A',note:'Nota ficticia '+n,cat});
const before=[row(1,'super'),row(2,'super')], current=[row(1,'otros')];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inputHash=hash(current), ops=[];
for(const r of before){
  const got=current.find(x=>x.id===r.id);
  if(!got) ops.push({kind:'restore',id:r.id,expected:'absent',after:r});
  else if(JSON.stringify(got.origin)!==JSON.stringify(r.origin))
    ops.push({kind:'needs_identity',id:r.id});
  else if(got.cat!==r.cat)
    ops.push({kind:'patch',id:r.id,field:'cat',expected:got.cat,after:r.cat});
}
const projected=structuredClone(current);
for(const op of ops){
  if(op.kind==='restore') projected.push(structuredClone(op.after));
  if(op.kind==='patch') projected.find(r=>r.id===op.id)[op.field]=op.after;
}
assert.equal(hash(current),inputHash);
assert.equal(ops.length,2);
assert.equal(projected.length,2);
assert.equal(projected.reduce((n,r)=>n+r.amount,0),34);
assert.equal(current.reduce((n,r)=>n+r.amount,0),17);
assert.deepEqual(projected.sort((a,b)=>a.id.localeCompare(b.id)),before);
assert.equal(before.filter(r=>{
  const got=projected.find(x=>x.id===r.id);
  return !got||JSON.stringify(got)!==JSON.stringify(r);
}).length,0);
console.log('Dry-run ficticio PASS; ninguna escritura');
```

## Validación y siguiente decisión única

Cinco suites existentes ejecutadas: `merge-expenses-cloud`, `pull-historico-entero`,
`expense-id-cloud`, `hist-import-dup`, `invest-category` → Node **19/19** entradas verdes
(tres ficheros agrupan asserts propios; no son solo 19 casos financieros). No se añade test
permanente ni herramienta de reparación. No se presenta suite E2E/Deno completa ni prueba móvil,
SQL vivo o rollback real. El contenido M1/M4/M6/M8 es diagnóstico, no cambio de conducta.

`relevant-tests` y `guard-privacy` verdes; diff sin whitespace. `docs-frescura` confirma todos
los números/alineaciones y falla **solo** en «código sin bump»: esta rama propia hereda dos fixes
FIN-07 posteriores al bump (`00-core.js`, `01-i18n.js`). Es la excepción de nombre de rama
documentada en EMPIEZA-AQUI; no se cambia VERSION ni se falsea la rama para silenciarla.
El diff FIN-08 contra 8bf229d4 es exclusivamente documental. Guard-privacy mira la app generada,
no sustituye la inspección del nuevo brief: este contiene solo fixtures y referencias de código,
sin extractos, datos de cartera, secretos ni identificadores de origen reales.

**Claude real: PASS** al SHA `e482c200e4915c920c0d13b2ae7c155746a6a865`, mensaje
`20260926T1830Z-claude-fin08-e482c200`. Revisó brief y backlog, ejecutó los dos bloques tal cual
con EXIT=0 en su worktree, contrastó clave manual/lápidas/retención/DELETE histórico y privacidad.
El resultado de investigación/propuesta está revisado; la recuperación de datos reales sigue pendiente.

Condiciones no bloqueantes del reviewer para el encargo siguiente: lectura cloud por el
propietario con su sesión o exportación propia, sin service_role de agente ni contraseña en
herramientas; nombrar antes de empezar una ubicación privada fuera del repo **y** del canal
local compartido. R5/R6 requieren reloj fijo si se convierten en tests permanentes.
Cambios de este ticket: este brief y únicamente la fila FIN-08 del backlog. Sin feature/APK,
publicación visible, despliegue ni acceso/escritura en movimientos reales.

**Siguiente decisión única:** aceptar este diagnóstico/propuesta y decidir si se autoriza un
inventario privado **solo lectura** de fuentes/copias concretas del propietario, con ubicación
y comparación definidas. No autoriza reparación. Si no existen fuentes íntegras, se mantiene
«no confirmable» por fila; avanzar identidad FIN-03 y ensayo OPS-02 necesita sus propios encargos.
