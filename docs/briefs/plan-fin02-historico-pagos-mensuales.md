# FIN-02 — el histórico descarta pagos mensuales de verdad

**Estado:** contrastado por Claude el 9/9 leyendo el código, no solo la auditoría.
**Bloquea:** dar por terminada la importación histórica y aprobar `4.19.8/import-historico`.
**Implementa:** Cursor, después de integrar FIN-01 (comparten UI, tests y notas de versión).

## Qué falla, con las líneas delante

`src/modules/08-motor-bank.js:813` `dedupeHistRecibos` marca duplicado por

```
histReciboDupKey = comercio normalizado | importe | banco      (:810)
```

**Sin fecha.** Y `histClassifyCandidates` (:894) se lo aplica a TODOS los candidatos
`kind:"out"` y `card:false` antes de decidir destino:

```
if(recibDup[i]) return { status:"dup", reason:"recibo-lote", ... }   (:902)
```

Tres recibos de luz de 12 € del mismo comercio y banco, de junio, julio y agosto, son la misma
clave. Entra uno; los otros dos quedan `dup` con motivo `recibo-lote` y la UI los pinta
desmarcados (`10-app-components.js:532`, en verde menta). Son **tres pagos reales de tres meses
distintos**: el usuario importa su histórico y se le quedan fuera dos meses sin que nada avise.

## Por qué el guardo ya no protege lo que protegía

El comentario de `:800` explica su origen: con destino por defecto «Recibo», aceptar todo creaba
tres Fijos idénticos, y un Fijo se cobra **todos los meses para siempre** en `monthNetForAccount`.
Era una protección cara de perder.

Pero desde el híbrido C el destino por defecto es **gasto puntual**:

```
return { status:"new", ..., defDest:"gasto", suggestRecibo:!x.card, ... }   (:914)
```

y el commit **ni siquiera crea Fijos todavía**:

```
if(c.defDest==="recibo") return;   // Fijos: tanda UI     (08-motor-bank.js:926)
return { expAdds:expAdds, fixAdds:[], ... }               (:944)
```

Hoy el guardo no evita ningún Fijo duplicado —no hay ninguno que crear— y sí destruye pagos
mensuales legítimos. Eso es lo que lo convierte en P1 y no en un ajuste de sensibilidad.

## Cómo se arregla (dirección, no orden cerrada)

Separar **identidad del pago** de **protección al crear un Fijo**:

1. `histClassifyCandidates` deja de pasar todos los candidatos por `dedupeHistRecibos`. Dos cargos
   del mismo comercio, importe y banco en **meses distintos** son dos gastos, y ya está.
2. La protección se traslada al momento en que el usuario marca varios como «Recibo»
   (`10-app-components.js:506` ya cuenta `nRecibo`): ahí, y solo ahí, varios equivalentes deben
   acabar en **un** Fijo. Si el destino Fijo sigue sin implementarse, la protección va escrita
   junto a esa implementación, no en la clasificación.
3. **Mismo día, mismo comercio, mismo importe, mismo banco** sigue siendo sospechoso de repetido
   de verdad: eso no se toca. El eje que falta es la fecha, no el criterio entero.
4. `histCandExisting` (:846) compara contra lo ya guardado **con día** y es 1:1: no tocarlo.

## Aceptación — sin esto no lo reviso

| # | Caso | Resultado exigido |
|---|---|---|
| 1 | Tres cargos de 12 €, mismo comercio y banco, 12/6, 12/7 y 12/8. Estado sin gastos, fijos ni deudas | Los **tres** `status:"new"`, `defDest:"gasto"`. Cero `recibo-lote` |
| 2 | Dos cargos idénticos el **mismo día**, mismo importe/comercio/banco | Sigue avisando: uno entra, el otro queda marcado. No se pierde el aviso de repetido real |
| 3 | Marcar los tres del caso 1 como «Recibo» | **Un** Fijo, no tres. Es la garantía que no se puede perder al quitar el guardo |
| 4 | Un cargo que coincide con un Fijo/deuda/puntual ya modelado | Sigue saliendo `dup` motivo `modeled` (`histMatchesModeled`, :858) |
| 5 | Un cargo idéntico a un gasto ya guardado ese día | Sigue `dup` motivo `existing`, y 1:1: dos candidatos contra un guardado marcan **uno** |
| 6 | Reimportar el mismo extracto dos veces | La segunda vez no crea nada nuevo: los pilla `existing` |
| 7 | Importar y **deshacer** | `histUndoBatch` quita exactamente el lote, sin tocar `state.deleted`; segunda pasada idempotente |
| 8 | Avisos de deuda/ahorro y coincidencias ambiguas | Siguen apareciendo. El arreglo no puede llevárselos por delante |

Unitario sobre lógica pura (`loadPureLogicFromFile`) **y** E2E de la previsualización real: el caso 1
tiene que verse con los tres marcados en pantalla, no solo devolver un array correcto.

## Límites

- No cambia movimientos ya importados ni escribe migración retroactiva.
- No toca `histCandDupKey`, `histApplyBatchAck` ni el ACK del histórico (agujeros A/B ya cerrados).
- Que dos importes coincidan no demuestra misma identidad: esto no inventa un id bancario. Ese
  problema es FIN-03 y se decide aparte.
