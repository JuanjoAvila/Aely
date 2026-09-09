# FIN-03/04 — identidad, confirmación y conflictos entre dispositivos

**Entrega de Codex, 9/9/2026.** Apoyo solicitado por el dueño y coordinado por el canal:
Cursor confirmó que no lleva FIN-03/04 ni FIN-05 y pidió informe aislado, sin editar `src/`
ni BACKLOG. Claude conserva dirección e integración de FIN-01/02.
Rama `codex/identidad-ack-2026-09-09`, base `8f07c47d` (beta publicada al consultar: 4.19.14.1).
Comparados `00-core.js` y `11-app-main.js` con `fb628ff1` de FIN-02: sin diferencias.
Los cambios aún sin commit de Claude no forman parte de esa comparación.

## Resultado y qué desbloquea

**El problema no es solo el UNIQUE ni el UUID divergente.** El pull conserva también versiones
locales antiguas de una fila con el **mismo UUID**. Y `source` mezcla banco, origen y decisión:
una escritura legítima del banco con datos antiguos puede reabrir una decisión ya confirmada.
Pedir RETURNING después del UPDATE no evita este último caso: puede confirmar una escritura
semánticamente incorrecta. Hace falta separar campos y comprobar la revisión esperada.

No se ha modificado código de la app, esquema ni datos reales. Las ocho reproducciones de abajo
ejecutan funciones reales con estado y transporte simulados; **no son ocho bugs ya corregidos**
ni pruebas de RLS/SQL desplegado. Aportan un contrato para implementar y revisar FIN-03/04.

Complementa [la arquitectura general](arquitectura-identidad-gastos.md), no la sustituye.
Ese documento ya cubre origen estable, migración, compatibilidad y rollback.
[Backlog operativo](../BACKLOG.md): FIN-03/04/07; FIN-05 sigue siendo un trabajo distinto.

## Ocho reproducciones ejecutadas

| Caso | Resultado observado | Resultado requerido |
|---|---|---|
| 1. Local UUID B, remoto UUID A; resto coincide | Pull conserva B y `possibleDup=true`, no adopta A | Una correspondencia solo por atributos queda ambigua; si hay ACK/origen probado, adoptar A y su revisión, actualizando referencias |
| 2. Local y remoto con UUID A; nube tiene categoría nueva y decisión resuelta | Pull conserva categoría vieja y pendiente local | Sin operación local pendiente, gana la revisión remota; con operación pendiente, conflicto/rebase explícito, no omisión silenciosa |
| 3. Un gasto local TR y otro remoto Sabadell iguales en día/importe/comercio | Solo una fila visible | Dos UUID distintos no se colapsan por parecido; legado ambiguo conserva evidencia y revisión |
| 4. Lápida por atributos de TR y gasto remoto Sabadell parecido | Ninguna fila remota visible | Borrado por identidad exacta, sin esconder el gemelo de otro banco |
| 5. `mergeExpenses` con dos UUID ya locales de bancos distintos | Devuelve una fila | No perder una fila ya existente al unir arrays |
| 6. `setExpenseDup` recibe respuesta sin error pero cero filas afectadas | Resuelve `undefined` como el éxito normal | Resultado explícito `unconfirmed/missing`; no retirar operación ni presentar guardado confirmado |
| 7. `setExpenseDup` sin sesión | Resuelve `undefined`, no envía nada | Persistir pendiente o error visible; sesión ausente no es ACK |
| 8. Confirmar distintos y luego cambiar banco desde copia antigua | `ob:trade_republic` vuelve a `ob:revolut#dup` | Cambiar banco conserva decisión vigente; escritura obsoleta entra en conflicto |

**Causa de 1/2/3:** `syncCloudExpenses` usa `keep=prev.expenses.filter(source!=="supabase")`.
`expenseFromRow` devuelve `ob/manual/macrodroid/ob-hist`, por lo que conservar siempre esos
objetos impide refrescar datos remotos. Luego `keepKeys` por día/importe/comercio tapa la llegada.
Cambiar solo `mergeExpenses` NO arregla este segundo algoritmo dentro de App.

**Causa de 4:** `deleted` es una clave sin banco/UUID aplicada antes del merge. Añadir banco
mejora un caso, pero tampoco distingue dos cargos legítimos del mismo banco.

**Causa de 6/7:** los métodos solo leen `error`; algunas rutas abortan sin consulta y devuelven
el mismo resultado. Además, `resolveDup` confirma en UI tras cambiar estado local y silencia el
rechazo con `.catch(function(){})`. Cambiar solo la promesa de cloud dejaría el éxito falso visible.

**Causa de 8:** `setExpenseBank` serializa `source` desde el objeto viejo completo, incluyendo
`possibleDup`. Es una carrera de campos compartidos, aun con UUID correcto y una fila afectada.
También hay que probar el orden contrario: resolver decisión desde un objeto con banco antiguo.

## Primer encargo implementable: cerrar el contrato de confirmación

No abrir simultáneamente una migración de identidad y una reparación de datos antiguos.
Primero Claude/Cursor pueden implementar y revisar este contrato en un entorno aislado:

1. **Distinguir identidad local de remota confirmada.** Un UUID generado en el móvil no acredita
   un alta aceptada. Guardar el estado de sincronización por usuario y fila, sin usar `source`
   como señal de «es local» o «es remoto». Confirmación por ACK/consulta de UUID exacto;
   cero coincidencias no autoriza buscar otra fila por importe.
2. **Resultados explícitos de cada operación:** `confirmed`, `pending`, `conflict`,
   `needs_identity` o error. `undefined` no puede significar las cinco cosas.
   Lectura vacía, sesión ausente, abort por campos incompletos y UPDATE de cero filas son diferentes.
   No inferir «no existe» frente a permisos RLS solo a partir de cero filas.
3. **Cola persistente antes de la petición**, por usuario, `operationId`, identidad exacta y
   revisión base. Sobrevive a cierre, logout/login del mismo usuario y timeout después del commit.
   Nunca drenar operaciones de A con sesión B. Al salir de cuenta, aislar/proteger la cola conforme
   al circuito de logout/RGPD existente; no exponer la cartera anterior al usuario siguiente.
4. **Una operación pendiente conserva solo los campos que modifica.** Banco no reconstruye
   decisión; categoría no pisa nota/banco. Evitar guardar objetos completos antiguos como patch.
   Separar semánticamente `bank`, `origin`, `reviewStatus` y referencias al gemelo.
5. **La UI distingue cambio local de confirmación remota.** Puede mostrar estado local pendiente,
   pero no afirmar que otro dispositivo ya lo ve. Si falta identidad fiable, mantener la acción
   revisable y explicar el bloqueo. No crear lápida por atributos ni borrar otra fila para salir.
6. **Salir del updater de React para enviar la escritura.** El updater calcula estado; la cola
   gobierna el efecto. React puede reevaluar updaters: lanzar DELETE/UPDATE dentro de ellos no
   debe producir una segunda operación lógica.
7. **No borrar antes de desambiguar.** Añadir `.select('id')` DESPUÉS de un DELETE por atributos
   puede revelar que se tocaron varias filas cuando el daño ya está hecho. Ninguna operación
   destructiva del nuevo protocolo entra por el fallback ambiguo.
8. **No activar el contrato nuevo para datos reales hasta cerrar cliente/servidor conjuntamente.**
   En el protocolo antiguo se puede detectar/explicar falta de confirmación, pero no prometer
   idempotencia, persistencia de decisiones ni conciliación entre dispositivos.

## Contrato servidor mínimo para FIN-03/04

Solicitud conceptual, independiente de la implementación final de columnas/RPC:

```text
operationId, canonicalId u origen probado, expectedRevision,
kind: create | set_bank | set_category | set_note | review | delete,
patch del campo autorizado (sin user_id libre)
```

Respuesta:

```text
confirmed: operationId + canonicalId + revision + fila resultante
conflict: operationId + revision/fila actual (sin aplicar el patch obsoleto)
needs_identity: sin escritura; evidencia insuficiente
```

- Propietario desde sesión. Comprobar pertenencia del gemelo al mismo usuario antes de `review`.
- `operationId` único por usuario con comprobación del contenido: reutilizar un ID con otro patch
  es error. Un reintento devuelve el mismo resultado guardado, **sin volver a aplicar el patch**.
- Comprobar revisión y aplicar patch en una transacción. Dos peticiones contra revisión 7:
  solo una puede generar 8; la otra entra en conflicto. Un SELECT previo fuera de la transacción
  no lo garantiza.
- Una decisión resuelta es un estado explícito con revisión. Ausencia de `#dup` no distingue
  legado sin revisar de «distinto» confirmado. El backfill inseguro retirado no vuelve.
- Conflicto no significa «el último reloj del móvil gana». Leer versión actual y ofrecer/rebasar
  solo una operación compatible; conflictos de revisión/borrado no se reintentan a ciegas.
- Adoptar ACK aunque el componente original ya no esté montado, mediante la cola. Si la UI ya
  conoce revisión 10, un ACK tardío de revisión 8 confirma SU operación, pero no rebaja la fila.
- Versionar la capacidad del servidor y todos sus escritores. Una columna `revision` no protege
  nada si una OTA vieja o ingest puede escribir directamente sin comprobarla. La retirada del
  UNIQUE viejo sigue requiriendo el plan coordinado del documento general; no basta un cliente beta.

## Orden y reservas propuestos para Claude

| Entrega | Alcance | Puerta para continuar |
|---|---|---|
| A. Contrato y pruebas de cola/confirmación | Tests aislados, tipos de resultado y estados; sin cambiar SQL vivo ni datos | Casos 6/7, timeout tras commit, sesión cruzada y ACK fuera de orden |
| B. Identidad/origen + RPC revisada | Esquema aditivo y RPC en base de pruebas; firma concreta y migración reversible antes del corte | Dos altas concurrentes de mismo origen, dos cargos legítimos iguales, RLS, operación repetida con payload distinto |
| C. Lectores y edición | Adaptar import, merge, App pull, referencias, borrado, UI y cola con capacidad nueva | Casos 1–5/8, dos clientes, sin pérdida de referencias ni decisiones |
| D. Lectura completa y legado | FIN-07, paginación/cambios concurrentes; inventario de filas ambiguas, sin reparación automática | Más de 2000 filas; misma identidad/suma/campos tras reinicio y recuperación |
| E. Publicación coordinada | Inventario de OTAs/APK/ingest/escritores, ensayo y autorización de producción | Plan de corte y rollback que no borra altas nuevas ni deja escribiendo clientes incompatibles |

No basta un mock del SDK para B: ejecutar PostgreSQL/Supabase de pruebas. A puede avanzar sin
tocar la base familiar; C debe integrar como unidad sus lectores y escritores.
No prometer instantáneas completas usando solo OFFSET mientras cambian las filas. FIN-07 debe
definir su contrato de paginación/cursor y el tratamiento de altas, cambios de fecha y borrados
durante la descarga; ausencia en una página nunca crea una lápida.

**Tests a registrar cuando se implemente:** ampliar `expense-id-cloud` y suites de import/merge;
prueba de cola con transporte determinista; E2E de la pantalla real con dos contextos de navegador;
integración SQL para concurrencia/RLS. Los tests actuales que exigen fallback eterno por atributos
deben revisarse con el contrato de legado, no borrarse para pintar verde.

## Reproducción copiable (solo datos ficticios)

Desde la raíz del worktree de la base indicada: `npm run build`, después ejecutar el bloque
con Node en modo módulo por stdin (`node --input-type=module`). No crea archivos, no conecta
a Supabase ni hace modificaciones en los datos de la app.

Se extrae el cuerpo real de `syncCloudExpenses`; se sustituyen transporte, notificaciones y
migraciones ajenas por simulaciones explícitas. Por eso demuestra la selección/merge/identidad de
ese cuerpo, no una sincronización completa de producción. Las respuestas de UPDATE son simuladas
para comprobar cómo reacciona el método real a cero filas o a un patch atrasado.

```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadPureLogicFromFile} from './scripts/load-pure-logic.mjs';
const c=loadPureLogicFromFile();
const core=fs.readFileSync('src/modules/00-core.js','utf8');
const main=fs.readFileSync('src/modules/11-app-main.js','utf8');
const start=main.indexOf('return cloud.pullExpenses().then(function(rows){');
const end=main.indexOf('\n  };',start);
assert(start>=0 && end>start);
const pull=new Function('cloud','stateRef','set','expenseFromRow','reconcileObDupes',
  'fixMovInvasion','showToast','t','setTimeout',main.slice(start,end));
const a='550e8400-e29b-41d4-a716-446655440001';
const b='550e8400-e29b-41d4-a716-446655440002';
const e={id:b,date:'2026-09-09T10:00:00.000Z',amount:12,merchant:'Prueba',
  category:'bares',source:'ob',ent:'trade_republic',possibleDup:true};
const row={id:a,fecha:e.date,importe:12,comercio:'Prueba',cat:'super',
  source:'ob:trade_republic'};
async function sync(expenses,rows,deleted=[]){
  const ref={current:{expenses,deleted}};
  await pull({pullExpenses:async()=>rows,addExpense:async()=>{},setExpenseCat:async()=>{}},
    ref,f=>{ref.current=f(ref.current)},c.expenseFromRow,s=>({state:s,recat:[]}),
    s=>s,()=>{},x=>x,()=>{});
  return ref.current.expenses;
}
let out=await sync([e],[row]);
console.log('1. UUID tras pull:',out[0].id,'pendiente:',!!out[0].possibleDup);
out=await sync([{...e,id:a}],[row]);
console.log('2. Mismo UUID, categoria remota super:',out[0].category,'pendiente:',!!out[0].possibleDup);
out=await sync([e],[{...row,source:'ob:sabadell'}]);
console.log('3. Dos bancos, filas tras pull:',out.length);
out=await sync([],[{...row,source:'ob:sabadell'}],[e.date.slice(0,10)+'|12|Prueba']);
console.log('4. Lapida TR, filas Sabadell visibles:',out.length);
console.log('5. Merge UUID distintos:',c.mergeExpenses([e,{...e,id:a,ent:'sabadell'}],[]).list.length);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function method(name,args){
  const marker='async '+name+'('+args+'){',i=core.indexOf(marker);
  assert(i>=0);const j=core.indexOf('\n    },',i);assert(j>i);
  return new AsyncFunction('sb','expenseSourceForCloud','expenseCloudEq',...args.split(',').map(x=>x.trim()),
    core.slice(i+marker.length,j));
}
const dup=method('setExpenseDup','e, isDup'), bank=method('setExpenseBank','e, ent');
const remote={source:'ob:trade_republic#dup'},filters=[];
let affect=false;
const q={update(patch){this.patch=patch;return this},
  eq(k,v){filters.push([k,v]);return this},
  then(ok){if(affect)Object.assign(remote,this.patch);
    return Promise.resolve({data:[],count:affect?1:0,error:null}).then(ok)}};
const sb={auth:{getSession:async()=>({data:{session:{user:{id:'fixture-owner'}}}})},from:()=>q};
console.log('6. UPDATE cero filas resuelve:',await dup(sb,c.expenseSourceForCloud,c.expenseCloudEq,e,false));
console.log('7. Sin sesion resuelve:',await dup({auth:{getSession:async()=>({data:{session:null}})}},
  c.expenseSourceForCloud,c.expenseCloudEq,e,false));
affect=true;
await dup(sb,c.expenseSourceForCloud,c.expenseCloudEq,e,false);
console.log('8a. Decision confirmada source:',remote.source);
await bank(sb,c.expenseSourceForCloud,c.expenseCloudEq,e,'revolut');
console.log('8b. Cambio banco con copia antigua:',remote.source);
```

Salida obtenida: UUID B/pendiente; mismo UUID categoría vieja/pendiente; una fila de dos bancos;
cero filas tras lápida ajena; una fila tras merge de dos UUID; `undefined` en ambos falsos éxitos;
decisión sin marca seguida de `ob:revolut#dup`.

## Estado del resto del equipo al consultar

Cursor entregó review FIN-01 sobre `96b0fe4f` y FIN-02 sobre `78653421`, con resultados en el
canal. Su review FIN-02 señala que faltaba E2E del preview creando un solo Fijo; en el checkout
principal Claude ya estaba añadiendo pruebas de esa pantalla. No se ha interferido en ese trabajo.
La beta publicada seguía 4.19.14.1 al consultar; los fixes 4.19.15/16 estaban en ramas de trabajo.

El límite de round-up/saveback detectado por ambos queda separado: revisar en vivo y cierre con
los mismos gastos elegibles por banco, sin convertir recibos/efectivo en compras TR. Esta entrega
no cambia ese cálculo ni valida su arreglo. FIN-05 requiere además el servidor vivo (OPS-01).
