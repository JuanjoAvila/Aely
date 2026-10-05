# INC-0410 · Metas: aportaciones simultáneas desde dos dispositivos (contrato)

Sobre `44966bdc` (4.26.95). Solo contrato, simulaciones y pruebas con datos sintéticos: sin cambio de producto, sin reparar datos reales y sin aceptación móvil. Sucede al diagnóstico cerrado (`df63b7aa`): con dos clientes que parten del mismo estado, el segundo en subir pierde su aportación en ambos órdenes de reloj. La propuesta `max(saved)` no resuelve aportaciones independientes a la misma meta.

## Qué escribe hoy cada operación (leído del código, no supuesto)

| Operación | Toca `goals[].saved` | Asiento en `reservaLog` | Identidad |
|---|---|---|---|
| «Aportar a una meta» (`addToGoal`) | sí, `saved + importe` en coma flotante | **no** | ninguna |
| Editar la meta (`saveEdit`) | **absoluto**: puede bajarlo | no | ninguna |
| Regla mensual (`applyReservaMensual`) | sí, a 2 decimales | sí, `mensual\|regla\|AAAA-MM` | idempotente |
| Reparto por ingreso (`applyReserva`) | sí | sí, `uid()` + `incomeKey` | por ingreso |
| Borrar regla (`removeReservaRule`) | **no**: conserva lo aportado | sí, importe negativo con `releaseOf` | única |
| Borrar meta (`delGoal`) | la quita | no deja lápida | ninguna |

Consecuencias que condicionan cualquier propuesta:

1. **`saved` no se puede derivar del registro.** Un aporte manual no deja asiento, la apertura (lo ya ahorrado al crear la meta) tampoco, y las liberaciones no restan. Derivar `saved = Σ reservaLog` borra la apertura legacy.
2. **Los aportes manuales no tienen identidad.** No se puede distinguir «A aportó 100» de «el servidor ya aplicó lo de A y se perdió el ACK». Un delta contra el ancestro (`remoto + (local − ancestro)`) cuenta dos veces un reintento. Es el bloqueo mínimo: sin un id por aportación manual solo se puede elegir entre perder o duplicar.
3. **Un asiento manual en `reservaLog` no vale como identidad:** ese registro resta del presupuesto del mes (`reservedSince`), así que un aporte manual dejaría de ser «solo meta». La identidad debe ir en un registro propio (`goalLog`).
4. **El registro de asientos ya fusiona bien por `id`**; lo que falla es que `syncFromCloud` sustituye el estado entero por el más reciente (`_savedAt`, reloj del cliente) y descarta `goals`, `reservaLog` y `settings.reservaRules` del otro lado.
5. El test anterior asentaba `man|<meta>` en `reservaLog`; el producto no lo hace. Se conserva como estaba (caracteriza la misma pérdida con otra forma) y la matriz usa las operaciones fieles.
6. Hallazgo aparte, visible en la matriz: `addToGoal` suma en coma flotante (0,10 + 0,20 = 0,30000000000000004), y la regla mensual sí redondea.
7. `pushState` sin sello conocido hace `upsert` a ciegas; con sello es compare-and-swap. El lazo «conflicto → pull → fusionar → resubir» ya existe, así que una fusión en cliente no necesita backend nuevo para ser **correcta**.

## Propuesta (modelo en el test, no producto)

- **I1** `saved = apertura + Σ créditos con identidad` (`goalLog` ∪ asientos positivos de la meta). Las liberaciones no restan.
- **I2** Los registros se unen por `id` (idempotente; replay inocuo; conmutativo).
- **I3** `apertura` es un registro de último-gana. En un estado legacy vale `saved − Σ créditos` de ese lado. Dos lados con el mismo ancestro dan la misma apertura. Si difieren, alguien escribió `saved` sin identidad (cliente viejo): esa escritura es irrecuperable, gana la más reciente y debería marcarse.
- **I4** Borrados con lápida (`deletedGoals`, `deletedRules`), como `deleted` en gastos: la unión no resucita.
- **I5** Céntimos enteros en toda suma.
- Campos no aditivos (nombre, objetivo): gana el más reciente, como hoy.

## Qué se resuelve en cliente y qué no

**En cliente (con el CAS que ya existe):** la fusión en `syncFromCloud` y que «Aportar», borrar regla y borrar meta escriban `goalLog`/lápidas; la apertura explícita al primer crédito; céntimos enteros. Cambio de esquema aditivo: un cliente viejo conserva los campos que no conoce al hacer `Object.assign` con la nube.

**Exige contrato backend separado (no inventado aquí):** crecimiento y compactación de `goalLog`/lápidas en una sola fila `app_state`; escrituras sin sello (`upsert`) que hoy pisan; reloj de cliente (`_savedAt`) como árbitro de los campos no aditivos; clientes viejos activos durante la transición (su `saved` sin identidad no se puede fusionar). Si el dueño no quiere ese riesgo, la alternativa es filas por aportación en el servidor.

## Decisiones del dueño pendientes

1. **Borrar una meta mientras otro dispositivo aporta a ella.** El modelo hace prevalecer el borrado; la aportación queda en `goalLog` huérfana, sin sumar a nadie. Hoy una orden resucita la meta con el aporte y la otra lo pierde en silencio. El test solo asere que la meta borrada no reaparece; que la aportación quede retenida no es observable en el esquema actual.
2. **Editar el «ahorrado» (`saveEdit`) a la vez que otro aporta:** el modelo conserva el aporte sobre la apertura editada. Es la lectura razonable, pero es decisión de producto.
3. Qué hacer con aportes hechos por clientes viejos durante la transición (I3).

## Pruebas

`tests/metas-lww-concurrente.test.mjs` (ya en `run-tests`, sin tocar el runner). Cada escenario corre en 4 variantes (quién tiene el reloj más nuevo × quién sube primero) sobre el producto real y sobre el modelo, con el mismo ejecutor: dos aportes a la misma meta, apertura legacy, misma regla y mes en ambos, reglas distintas en la misma meta, regla + aporte manual, liberación + aporte, borrar meta + aportar, replay con ACK perdido y céntimos. El modelo se comprueba además conmutativo e idempotente, y se documentan con su caso las tres contrapropuestas descartadas (`max`, delta contra ancestro, `saved = Σ registro`). Un mutante que quita la unión de `goalLog` o las lápidas pone en rojo el modelo.

- Sin variable: caracterización, **exit 0** (cada escenario con `hoyPierde` incumple en algún orden; las guardas de no duplicar —misma regla/mes y replay— cumplen siempre).
- `LWW_ESPERADO=1`: contrato deseado, **exit 1** mientras el producto no lo cumpla.

## Límites

Doble de nube en Node con la semántica de `pushState`; sin móviles reales, sin Supabase, sin reloj real ni red. No acredita `npm test` entero, e2e ni Android.
