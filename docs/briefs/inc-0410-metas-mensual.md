# INC-0410 · Reglas mensuales de Metas: descontar y aportar al guardar

Borrador web 4.26.94 sobre beta 4.26.93.2 (`4e65fa11`), entrega de Claude en `codex/inc-0410-metas-mensual` y cierre de Codex en `codex/0410-metas94-history-e2e`. Sin publicar y sin aceptación móvil. Continúa el [acta del alta de reglas](inc-0410-metas-alta.md), que cubre el lector de importes, los avisos y el guardado del estado; esta cubre el contrato que decidió el dueño el 4/10.

## Qué pidió

Su rechazo de la 4.26.87 decía que, al añadir una regla, no quedaba aplicada y no aparecía la base a descontar, que él compara con el presupuesto mensual. Con el reparto por ingreso eso era el funcionamiento previsto: la regla esperaba al siguiente cobro y pedía confirmarlo. El 4/10 decidió el contrato: **guardar la regla descuenta del presupuesto del mes y aporta a la meta en el momento**, sin elegir ingreso ni confirmar aparte. Ejemplo acordado, sintético: presupuesto 1000 y regla de 100 dejan 900 disponibles y la meta con 100 más.

## Qué hace

- Las reglas que crea la pantalla llevan `mensual:true`. `addReservaRule` las aplica en la misma escritura: suma a la meta y añade un asiento a `reservaLog`, que es lo que restan Inicio, Gastos, el widget y el servidor. No crea movimientos ni toca `expenses`.
- Un asiento por regla y mes natural de Madrid: su id es `mensual|<regla>|AAAA-MM`. Repetir la escritura, recargar u otro dispositivo dan el mismo id.
- El porcentaje se calcula sobre el presupuesto mensual bruto. Sin presupuesto, la regla de porcentaje se guarda, no aporta y su fila lo dice; la de importe fijo aporta y el disponible sigue sin cifra.
- La aportación no se recorta al hueco que le queda a la meta: la cumple y deja de repetirse.
- Borrar la regla usa la reversión que ya existía: libera el descuento una vez y conserva lo aportado.
- Cada fila dice lo asentado este mes o por qué no (sin presupuesto, meta no activa, aún sin aplicar).
- Las reglas anteriores, sin `mensual`, conservan el reparto por ingreso con confirmación y no se migran.

## Cuándo se asienta un mes nuevo

Al abrir la app, cuando termina bien el pull de estado de ese arranque; y al volver a primer plano (aviso del navegador o `appStateChange` en Android), solo si falta el asiento del mes y después de bajar el estado de la nube. Sin sesión o con el pull fallido no se aporta. Tampoco si ese pull no leyó un estado válido: una nube con datos corruptos hace que la app conserve y resuba lo local, y eso no prueba nada; solo cuenta un estado válido o que aún no exista ninguno. La comprobación es de cada pull, de modo que dos pulls solapados no se prestan la validez. Sin nube configurada se asienta directamente. No consulta bancos.

## Decisiones del coordinador (4/10)

1. Identidad por regla y mes de Madrid, no por periodo de presupuesto ni por zona del móvil: cambiar entre «mes» y «mi ciclo», o corregir el cobro que abre el ciclo, no puede crear otra aportación.
2. «Mi ciclo» resta todos los asientos reales que contiene. Una regla creada entre el inicio del ciclo y el fin del mes natural deja dos asientos en ese primer ciclo (el del alta y el del mes siguiente), y los dos cuentan: son dos aportaciones reales.
3. Primera entrega: al guardar y el mes en curso al abrir o volver. No se reconstruyen meses en los que la app no llegó a asentar, no hay proceso en el servidor y no corre con la app cerrada.

## Límites

- El estado se sincroniza entero y gana el más reciente (`_savedAt`). Eso es anterior a esta entrega: si un dispositivo con cambios locales más nuevos sube después, lo aportado desde otro puede perderse como cualquier otro cambio de estado. Esta entrega solo garantiza que sus caminos automáticos no escriben sin haber bajado antes el estado.
- El servidor y el widget suman `reservaLog` por fecha; aquí se ha comprobado el lector de la app (`monthBudgetStats`), no su ejecución.
- Editar una regla ya creada y el máximo de tres metas en Inicio quedan fuera.
- El lag descrito en el rechazo no se reprodujo (medida y límites en el acta del alta).

## Pruebas

- `tests/reserva-dinero.test.mjs` (en `run-tests`): alta 1000/100, idempotencia, porcentaje sobre el bruto, sin base, mes siguiente, identidad de Madrid con instantes UTC (invierno y verano), cambio de vista y de cobro, borrado, meta cumplida o borrada, ciclo con dos asientos, fijo sin presupuesto, objetivo rebasado, pendiente y convivencia con las reglas por ingreso. Seis mutantes del motor lo hacen fallar.
- `tests/beta-sources.test.mjs`: el alcance de la tanda vigila el motor mensual y el bloque de App que espera al pull, con mutantes (aportar con el pull fallido, saltárselo, no escuchar la vuelta web o nativa, no asentar tras el arranque). El panel de revisión no depende del guardado de App: el guardián cuenta llamadas reales a `set`, no la declaración de `store.set`.
- `e2e/metas-alta-regla.spec.mjs` y `e2e/metas-borrar-regla.spec.mjs`, en el mapa: el alta mensual en es/en/ca y el contrato por ingreso con reglas sembradas. El coordinador ejecutó el primero y `persistencia` sobre `8ff6402a` (51 pruebas, 0 fallos) y acreditó el guardián de la retirada tardía con su mutante. El commit final necesita su propia pasada.
- `tests/metas-pull-transport.test.mjs` (en `run-tests`, del coordinador): ejecuta el `syncFromCloud` y el `reservaMensualAlDia` reales con nube y gastos diferidos; pulls solapados, cinco respuestas inválidas, fallo de gastos, estado válido con idempotencia y primera cuenta.
- `e2e/metas-mensual.spec.mjs` (en el mapa, del coordinador): la app real en es/en/ca con alta de 100 sobre 1000, mes nuevo, dos dispositivos, vuelta web y nativa con pull, error de nube e idempotencia. Pendiente de ejecutar sobre el commit final.

## Tamaño

Medida oficial del coordinador sobre `8ff6402a`: 1.316.330 B minificado y 358.513 B gzip, +8.257/+2.308 sobre la 93 servida; topes ampliados a 1286/351 KiB. Con el retorno nativo, la lectura estricta de la nube y la puerta por pull, medida oficial sobre `d8255941`: 1.317.146/358.744 B; tope crudo a 1287 KiB (quedan 742 B) y gzip sin cambio (680 B).
