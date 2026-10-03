# INC-0210-02 · La categoría elegida a mano no se deshace

Candidata **4.26.86**, sobre Validaciones82 `3467bbd4fddcd213f862bedddac971c827099f3d`. Solo cliente.
Sin servidor, migraciones, APK ni publicación propia. Datos de prueba ficticios.

## Síntoma

Un comercio de comida cuyo nombre contiene el de una aseguradora se corrige a Restaurantes y al
día siguiente vuelve a estar en Recibos.

## Causa, reproducida en Node

Dos caminos independientes, los dos con el override ya aprendido:

1. **La fila corregida.** `refreshExpenseFromCloud` adopta la categoría de la tabla en toda fila
   que no sea manual. La corrección se sube con `setExpenseCat`, que filtra por id: si el id local
   no es el de la tabla, el UPDATE afecta a cero filas y no devuelve error. El siguiente pull trae
   la categoría anterior y la pone encima.
2. **El pago equivalente del día siguiente.** `ingest` categoriza en servidor por palabra clave y
   no conoce `catOverrides`. `resolveCategory` acepta cualquier categoría ordinaria de la nube
   distinta de «otros», así que el override exacto del comercio no llega a consultarse.

Un seguro con otro nombre seguía en Recibos antes y después: es el comportamiento correcto.

## Qué se cambia

- **Nada de reglas de aseguradoras, palabras clave, MCC ni servidor.** El alias es ambiguo; la
  única fuente fiable es la decisión de quien usa la app.
- **La fila corregida.** `setCat` anota en la fila `catStale`: las categorías que la tabla puede
  devolver todavía. `cloud.setExpenseCat` devuelve cuántas filas escribió.
  - Sin escritura confirmada (cero filas, error, sin red): si la nube repite una categoría de
    `catStale`, se conserva la local y `keepCategoryChoices` reintenta con la fila de la nube,
    cuyo id sí casa. Si trae una categoría que no es ni la local ni una anterior, viene de otro
    dispositivo y se adopta.
  - Con escritura confirmada (`catAckAt`): toda lectura empezada después es la verdad, aunque
    diga la categoría original. Una lectura empezada antes, o sin hora, puede ser una foto vieja:
    no pisa y no se reintenta.
- **El pago equivalente.** `catRules` (en `app_state`) guarda comercio exacto + banco + con o
  sin tarjeta → categoría e instante de la corrección (no la fecha del gasto corregido). Una fila
  que el dispositivo ve por primera vez, no manual, de categoría ordinaria y con fecha
  estrictamente posterior a ese instante, nace con esa categoría, queda anotada como no
  confirmada y se sube. Corregir hoy un gasto del mes pasado no recategoriza una fila de ayer
  que baje ahora; una fecha sin hora del mismo día cae antes del instante y tampoco.
- **Lo aprendido antes.** No traía fecha ni contexto. `seedCatRules` los deduce una vez de las
  filas ya corregidas (mismo comercio, categoría igual a la aprendida) y valen desde ese día.
- `mergeExpensesFromCloud` y `refreshExpenseFromCloud` no se modifican.

## Frontera entre dos dispositivos

- La tabla `expenses` es la única verdad compartida por fila. No hay columna de procedencia ni
  de hora de categoría, y no se añade: `catStale` y `catAckAt` existen solo en el dispositivo
  que corrigió.
- Sin confirmación no se puede saber si la categoría anterior que devuelve la tabla es «mi
  escritura no llegó» o «otro dispositivo eligió justo esa». Se conserva lo local y se reintenta:
  gana la escritura que llegue después en tiempo real, sin inventar un orden.
- `catRules` viaja con `app_state`, que es último-en-escribir-gana. Puede no haber llegado a
  otro dispositivo o perderse si este sube un estado más viejo. Allí el pago entra con la
  categoría del servidor hasta que la tabla reciba la corrección.
- Un dispositivo con una versión anterior no anota nada: se comporta como antes.

## Límites conocidos

- El servidor sigue categorizando por palabra clave. Hasta que la subida llega, el widget y el
  presupuesto calculado en servidor ven la categoría del servidor.
- La identidad es nombre exacto normalizado + banco + con/sin tarjeta. El contexto disponible en
  la fila no incluye MCC. Si un comercio y un cargo distinto comparten nombre, banco y forma de
  pago, son indistinguibles.
- Las filas que ya estaban en el dispositivo antes de la corrección no se recategorizan solas.

## Pruebas

- `tests/categoria-manual-persistente.test.mjs`: catorce contratos, en `run-tests`.
- `e2e/categoria-elegida.spec.mjs`: corrección en la ficha contra una tabla que responde cero
  filas, error y éxito; pago equivalente, mismo nombre en otro banco, reinicio y cambio desde
  otro dispositivo, en es/en/ca. En `E2E_MAP` bajo Gastos.
- Mutantes sobre bundle reconstruido (sin protección, regla sin fecha, confirmación fija, no
  escuchar al otro dispositivo, regla sin banco ni tarjeta, sin reintento, aplicar a filas ya
  vistas): los siete tumban Node; cinco tumban también el DOM. La fecha y las filas ya vistas
  solo las fija Node.
- No se ha probado contra la tabla real ni en un móvil.
