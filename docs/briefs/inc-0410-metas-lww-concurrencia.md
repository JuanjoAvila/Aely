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
7. `pushState` sin sello conocido hace `upsert` a ciegas; con sello es compare-and-swap, pero el sello (`updated_at`) lo pone el cliente y ningún trigger lo impide repetirse: con sello repetido o relojes empatados el servidor acepta dos escrituras y pierde una sin conflicto. El lazo «conflicto → pull → fusionar → resubir» existe, pero **ni el CAS ni una fusión en cliente bastan por sí solos para la corrección**: sin un sello que cambie en toda escritura aceptada, el conflicto nunca salta y la fusión nunca corre.

## Propuesta (modelo en el test, no producto)

- **I1** `saved = apertura + Σ créditos con identidad` (`goalLog` ∪ asientos positivos de la meta). Las liberaciones no restan.
- **I2** Los registros se unen por `id` (idempotente; replay inocuo; conmutativo).
- **I3** `apertura` es un registro de último-gana. En un estado legacy vale `saved − Σ créditos` de ese lado. Dos lados con el mismo ancestro dan la misma apertura. Si difieren, alguien escribió `saved` sin identidad (cliente viejo): esa escritura es irrecuperable, gana la más reciente y debería marcarse.
- **I4** Borrados con lápida (`deletedGoals`, `deletedRules`), como `deleted` en gastos: la unión no resucita.
- **I5** Céntimos enteros en toda suma.
- Campos no aditivos (nombre, objetivo): gana el más reciente, como hoy.

## Qué se resuelve en cliente y qué no

**Propuestas en cliente (no probadas como suficientes):** la fusión en `syncFromCloud` y que «Aportar», borrar regla y borrar meta escriban `goalLog`/lápidas; la apertura explícita al primer crédito; céntimos enteros. Dependen del CAS existente, que aquí no se da por suficiente (hallazgo 7). Sobre el esquema aditivo, **no está probado** que un cliente viejo conserve con seguridad los campos que no conoce: queda por comprobar contra el código real de esos clientes.

**Exige contrato backend separado (no inventado aquí):** crecimiento y compactación de `goalLog`/lápidas en una sola fila `app_state`; escrituras sin sello (`upsert`) que hoy pisan; reloj de cliente (`_savedAt`) como árbitro de los campos no aditivos; clientes viejos activos durante la transición (su `saved` sin identidad no se puede fusionar). Si el dueño no quiere ese riesgo, la alternativa es filas por aportación en el servidor.

## Decisiones del dueño pendientes

1. **Borrar una meta mientras otro dispositivo aporta a ella.** El modelo hace prevalecer el borrado; la aportación queda en `goalLog` huérfana, sin sumar a nadie. Hoy una orden resucita la meta con el aporte y la otra lo pierde en silencio. Los escenarios de política omiten el resultado a propósito: **no asertan** que la meta borrada no reaparezca (solo registran el desenlace observado), y que la aportación quede retenida no es observable en el esquema actual.
2. **Editar el «ahorrado» (`saveEdit`) a la vez que otro aporta:** el modelo conserva el aporte sobre la apertura editada. Es la lectura razonable, pero es decisión de producto.
3. Qué hacer con aportes hechos por clientes viejos durante la transición (I3).

## Pruebas

`tests/metas-lww-concurrente.test.mjs` (ya en `run-tests`, sin tocar el runner). Cada escenario corre sobre el producto real y sobre el modelo, con el mismo ejecutor: tres relojes (A más reciente, B más reciente y **empate de `_savedAt`**) × quién sube primero = **6 variantes** por escenario de dos clientes, y 1 en los de un solo cliente (replay, céntimos). Son **20 escenarios y 105 variantes por lado**; el test comprueba ese conteo, no se escribe a ojo. (La versión anterior decía «4 variantes» y su etiqueta de reloj iba invertida: «A más reciente» era en realidad el reloj más antiguo.)

Cada caso lleva clase y se distingue en la salida: `perdida` (una aportación o asiento independiente desaparece), `precision` (coma flotante), `guarda` (no duplicar / no liberar dos veces) y `politica` (depende de una decisión del dueño: se ejecuta y se registra, **no se asere ningún desenlace**).

- Sin variable: **caracterización** (`caracteriza · …`), **exit 0**. Cada escenario con `hoyPierde` incumple en alguna variante; las guardas de no duplicar cumplen siempre en el producto.
- `LWW_ESPERADO=1`: **contrato deseado** (`contrato · …`), **exit 1** mientras el producto no lo cumpla. Rojo real contra la base `0dbc3c88`: **22 casos en rojo** (2 diagnóstico inicial, 10 pérdidas del producto, 1 precisión, 1 empate de `_savedAt`, 2 de transporte real, 6 del MODELO), idéntico con `TZ=UTC` y `TZ=Europe/Madrid`.

### Añadido en el endurecimiento (tras la revisión independiente NO-GO)

- **Dobles borrados** con `removeReservaRule` real en los dos clientes (cada uno con su `uid`): misma regla mensual, misma reserva por ingreso y reserva parcialmente liberada. Contrato: una liberación por origen (`releaseOf`). El producto lo cumple hoy **por accidente** (el LWW descarta uno de los dos estados enteros); el **modelo lo viola** (la unión por `id` conserva las dos liberaciones, que liberarían el presupuesto dos veces). Controles de reglas independientes, borrado + aporte a otra meta y replay con ACK perdido. No hay reparación retroactiva de liberaciones ya duplicadas: no se asere ni se inventa.
- **Reparto por ingreso** con `applyReserva` real desde dos clientes con `uid` distintos: mismo `incomeKey`, regla y meta → un solo asiento (identidad **semántica** `incomeKey + regla`, todavía propuesta: unir solo por `id` la rompe, y el modelo queda NO-GO). Controles con `incomeKey` distinto, reglas distintas y metas distintas: no deben perder aportes independientes.
- **Empate de `_savedAt`**: el producto adopta la nube y el cambio local no subido se pierde (`localNewer` es estricto). La fusión del modelo **no es conmutativa con empate** ni sobre metas/registros (campos no aditivos tomados «del de la izquierda») ni sobre el estado completo con configuración distinta (presupuesto, ajustes): NO-GO. Con relojes distintos sí es conmutativa (control).
- **Transporte fiel**: el `pushState`/`pullState` reales de `00-core.js` contra un doble de Supabase. El sello `updated_at` lo pone el **cliente** (`new Date().toISOString()`) y ninguna migración lo sustituye por un trigger (se comprueba). Con sello repetido o relojes empatados, el servidor **acepta dos escrituras y pierde una sin conflicto**. La nube de la matriz (`v1, v2…`) es un escenario **ideal** explícito, no una garantía del backend; el mismo guion sí choca ahí. Por tanto **no se afirma que el CAS sea suficiente** sin probar que el sello cambia en toda escritura aceptada y no se repite, cosa que esta suite no puede probar contra Supabase.
- **Bloqueo documentado**: sin sello conocido (`upsert` a ciegas: clientes antiguos o primer push sin pull) el servidor no compara nada y pisa; ninguna fusión en cliente lo arregla.

### Modelo: NO-GO explícito

El modelo de la propuesta **no es una solución ni se implementa todavía**. Incumple cuatro casos de guarda (los tres dobles borrados y el reparto del mismo ingreso) y la conmutatividad con empate. Están marcados `modeloNoGo` y verdes solo en caracterización; con `LWW_ESPERADO=1` son rojo. Retirar la marca exige que el modelo los cumpla, no bajar el assert. Mutantes del modelo, medidos por separado (no se generaliza de uno a otro): sin la unión de `goalLog` ponen en rojo 7 casos; sin lápidas de reglas (`deletedRules`), 3; sin lápidas de metas (`deletedGoals`), **ninguno**, porque la política de meta borrada no se asere (decisión 1).

## Decisiones del dueño pendientes (no elegidas aquí)

1. Borrado frente a aporte (borrar la meta mientras otro aporta). 2. Edición absoluta (`saveEdit`) frente a aporte. 3. Transición de clientes sin identidad (I3). Los dos primeros son escenarios `politica` que solo registran los desenlaces observados; no se implementan `goalLog` ni lápidas por arrastre.

## Límites

Doble de nube en Node con la semántica de `pushState` (la real, extraída del fuente, sobre un `from().update()/upsert()` falso) y un doble ideal; sin móviles reales, sin Supabase, sin reloj real ni red. No acredita `npm test` entero, e2e ni Android.
