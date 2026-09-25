# Reanudar · día de recibo fijo sin doble descuento

Fecha: 2026-09-24

Rama de trabajo: `codex/gasto-fijo-dia-24sep`

Betas previas: `4.26.46.1` rechazada; `4.26.46.2` aprobada inicialmente y reabierta por un caso inverso comunicado antes de producción; `4.26.46.3` bloqueada por revisión externa; `4.26.46.4` rechazada por el caso Pepegas de madrugada

Siguiente beta objetivo: `4.26.46.5`

## Alcance único

Corregir que un gasto fijo ya confirmado por el banco vuelva a descontarse al cambiar su día a
otro posterior dentro del mismo mes y que uno aún no cobrado se dé falsamente por pagado al
corregirlo a hoy. No mezclar esta tanda con otras tareas.

## Causa y solución

La conciliación reconocía el movimiento real, pero el motor decidía «pagado» solo comparando el
día planificado con el día actual. Mover Iberdrola 120 € del 20 al 28 hacía reaparecerla como
pendiente aunque el banco ya la hubiera cobrado.

Al editar el día, la identidad devuelta por `reconcileBank` permite guardar `paidYm` en el fijo.
Es una sola marca mensual, no un movimiento nuevo. `isPaidIn` respeta esa confirmación aunque el
día visible cambie. Si después cambia el importe o el banco, se reconcilia otra vez el fijo ya
editado: una corrección que aún coincide conserva el pago; otro cargo pierde la marca. `bankTx` no
se sube a la nube, por eso la marca mínima vive en el fijo sincronizable.

El dueño rechazó `4.26.46.1` desde el panel: la luz se había cobrado el día 24 y, al cambiar su día
previsto al 27, «Ya pagado» enseñaba 27 aunque todavía era 24. La protección financiera funcionaba,
pero confundía previsión con fecha real. La corrección conserva `paidDay` desde la coincidencia
bancaria: la fila pagada sigue mostrando 24 y el 27 queda como calendario de próximos meses. El
estado creado por la beta rechazada (`paidYm` sin `paidDay`) recupera la fecha desde `bankTx` sin
mutarlo.

Aunque `4.26.46.2` quedó aprobada en el panel para ese caso, antes de producción el dueño planteó
el inverso: hoy 25, recibo previsto para el 24 todavía no cobrado y cambio al 25. La reproducción
demostró que `isPaidIn` lo clasificaba pagado solo por `día <= hoy`, sin `bankTx`. Esa pregunta
reabre y sustituye el veredicto anterior: no se promociona `.2`.

La edición guarda en `wait` el año-mes únicamente cuando el día corregido ya ha llegado, la
conciliación no encuentra cargo, el feed sincronizado de esa cuenta cubre esa fecha y
`lastBankSync` es del mismo día local y tiene menos de 30 minutos. `isPaidIn`
no puede entonces inventar el pago por calendario; un movimiento real sí prevalece. Una edición
posterior con el cargo ya presente convierte la espera en `paidYm` + `paidDay`; `bankTx` sigue
siendo local y no se muta. Sin cobertura bancaria suficiente no se inventa una ausencia y el modo
solo-calendario conserva su comportamiento anterior.

Claude bloqueó `4.26.46.3` porque reanclar `accounts[].value` suponía conocer cuándo se había
fijado el saldo base, dato que no existe. La solución final no modifica ninguna cuenta. Retirar el
falso pago cambia el neto de Sabadell de −120 € a 0 y hace visibles esos 120 € porque aún siguen
en el banco; el saldo almacenado, Revolut y cualquier otra cuenta permanecen intactos.

El dueño rechazó `4.26.46.4` con Pepegas: a la 01:06 del 25 cambió el día ficticio 20 por el día
real 25 después de que el banco ya lo hubiera cobrado de madrugada. El feed local aún era el de
la noche anterior y solo contenía movimientos antiguos; `covered` probaba el inicio de la ventana,
pero no su actualidad. El motor lo tomó como ausencia, lo puso pendiente y elevó el saldo visible
de Sabadell. Ahora un feed viejo nunca puede negar un cobro de hoy. Una coincidencia exacta gana
siempre; para el caso no cobrado hay que sincronizar justo antes de editar.

## Evidencia exigida

- `tests/fixed-day-reconcile.test.mjs`: cobro real 24 y previsión 27; una ocurrencia pagada con día
  visible 24, cero pendientes, saldo de Sabadell estable, saldo de Revolut estable, gastos
  históricos idénticos, una sola fila fija y persistencia de ambas fechas sin `bankTx`.
- `e2e/plan-gestionar.spec.mjs`: edición real 24 → 27 desde Plan; una sola fila en «Ya pagado» con
  el día bancario 24, previsión 27 guardada y ninguna copia pendiente.
- Sin movimiento bancario, un recibo del día 27 continúa pendiente.
- Caso inverso exacto: reloj en 25/09, recibo de Iberdrola 120 € previsto el 24 y un feed de
  Sabadell que llega al día 10 pero no contiene ese cargo; editarlo al 25 deja una sola fila
  pendiente, cero pagadas y neto de Sabadell 0. Los 120 € vuelven al saldo visible porque no han
  salido; ninguna base de cuenta, Revolut ni los gastos históricos cambian. Al añadir el movimiento
  real del 25 pasa una sola vez a pagado y el neto queda en −120 €.
- Sin feed bancario, editar 24 → 25 conserva la regla solo-calendario y no crea una espera que no
  podría resolverse.
- El E2E edita 24 → 25 desde Plan con cobertura bancaria pero sin cargo y exige la espera mensual,
  una fila pendiente, cero pagadas, el saldo honesto y ningún cambio en cuentas o histórico.
- Caso Pepegas exacto: reloj 25/09 01:06, previsión antigua 20, edición a 25, última sync 24/09
  23:50 y feed con movimientos anteriores. Exige una fila pagada, cero pendientes, neto −12,50 €,
  ambos saldos invariantes, cuentas e histórico idénticos y ningún duplicado. El E2E repite la
  edición desde la ficha y comprueba el DOM.
- El bundle se reconstruye desde `src/`; el presupuesto minificado no se amplía.

## Límite conocido

La corrección prueba el cambio desde la ficha vigente de Plan y la confirmación de Open Banking.
No inventa confirmaciones ni ausencias cuando falta cobertura bancaria reciente y no migra ni recategoriza
el histórico. La espera explícita nace al editar el recibo en un dispositivo cuyo feed cubre la
fecha, fue sincronizado el mismo día local y tiene como máximo 30 minutos; no reinterpreta en masa
los fijos antiguos que nadie ha tocado. Como `bankTx` es local pero
`wait` se sincroniza, otro dispositivo respetará esa espera hasta recibir el cargo o una edición
posterior. Quien use solo calendario conserva la regla por fecha. Es un cambio web/OTA; no requiere
APK nueva.

La sync reciente no garantiza que Sabadell ya haya contabilizado una domiciliación de hace pocos
minutos. Además, `flattenBankTx` aún no persiste por entidad la marca `truncated` que devuelve la
Edge cuando corta páginas por tiempo, tope o cursor cíclico. Claude no lo considera bloqueo de
esta tanda; queda inventariado como refuerzo separado para no convertir una lectura parcial en
prueba de ausencia.

## Verificación local del 25/09

- Build, sintaxis, presupuesto sin ampliar, `fixed-day-reconcile`, `plan-charges`,
  `reconcile-bank`, notas en tres idiomas y mapa de pruebas: OK sobre la corrección final.
- `plan-gestionar.spec.mjs`: 30/30 sobre la corrección final, incluidos 24 → 27 cobrado, 24 → 25
  sin cobro con feed reciente y Pepegas 20 → 25 a la 01:06 con el feed de ayer.
- `fixed-day-reconcile` y los dos E2E financieros pasan tanto con la zona local como con `TZ=UTC`,
  que es la zona de la CI; los relojes del test se construyen como hora local, no como ISO fijo.
- Suite Playwright completa sobre `4.26.46.3`: 421 aprobadas y 1 captura opcional omitida (422 en
  total). El delta final vuelve a ejecutar localmente su spec completa; la CI de la nueva beta
  debe repetir la suite global por tocar el núcleo.
- Todos los unitarios del plan relevante pasan salvo `docs-frescura` al ejecutarlo desde
  `codex/gasto-fijo-dia-24sep`: detecta correctamente commits posteriores al bump. En la rama
  `beta` esa comprobación se omite por diseño porque las correcciones de una ronda conservan
  `VERSION` y se publican como `4.26.46.RUN_NUMBER`; la CI de beta debe quedar verde.
- Claude 5.5 Opus confirmó que `7f51d065` era financieramente correcto y retiró la objeción al
  guardián de rama. Después bloqueó `50aae61f` (`4.26.46.3`) por el reanclaje ciego del saldo base
  y porque una espera sin cobertura bancaria rompería el modo solo-calendario. Ambos puntos quedan
  corregidos en `31ca7226`. Su PASS dejó anotado que `covered` era laxo; el rechazo móvil de
  `4.26.46.4` confirmó ese límite. Falta su revisión de la nueva barrera por `lastBankSync` antes de
  ofrecer `4.26.46.5` como candidata.

Antes de preguntar por un rechazo, ejecutar siempre `node scripts/errores.mjs --kind=beta`: el
comentario escrito en Ajustes → Revisar esta beta es la fuente del veredicto.

## Regla de cierre del objetivo

Este objetivo **no termina al publicar beta**. Después de comprobar que la corrección de `4.26.46`
está realmente
en el canal beta, queda a la espera del veredicto móvil del dueño:

- Si la rechaza, corregir únicamente esta tanda, volver a verificar y publicar otra beta. Repetir
  hasta que la apruebe.
- Si la aprueba expresamente, promover la ronda completa a producción, revisar el diff resultante
  `main` frente a `beta`, ejecutar `npm run test:syntax`, confirmar Pages/manifest con
  `npm run salud` y solo entonces cerrar el objetivo.
- No promocionar ni publicar producción por inferencia o por un verde de CI.

## Prompt para la siguiente conversación

> Continúa el objetivo activo «gasto fijo: cambio de día sin doble descuento». Lee
> `docs/briefs/REANUDAR-GASTO-FIJO-DIA.md`, verifica primero `origin/beta`, Actions, el manifiesto y
> `npm run salud` y lee primero `node scripts/errores.mjs --kind=beta`; no pidas que repita un
> comentario escrito en el panel. La aprobación de 4.26.46.2 quedó revocada por el caso inverso y
> 4.26.46.3 fue bloqueada por revisión externa; no promociones ninguna. Pregúntame por el veredicto móvil de la
> última beta 4.26.46.x. `4.26.46.4` quedó rechazada por Pepegas a la 01:06: un feed de ayer lo
> devolvía a pendiente y subía Sabadell. Si la he rechazado,
> reproduce exactamente el fallo, corrige esta misma tanda y vuelve a subirla a beta; el objetivo
> sigue abierto. Si la he aprobado expresamente, promueve la ronda completa a producción, revisa
> el merge y la sintaxis, verifica el estado publicado y solo entonces completa el objetivo. No
> avances a otra tarea antes de cerrar esta y no publiques producción sin mi aprobación.
