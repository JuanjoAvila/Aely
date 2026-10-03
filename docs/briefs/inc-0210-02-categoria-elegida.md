# INC-0210-02 · La categoría elegida a mano no se deshace

Candidata **4.26.86**. Desarrollada sobre Validaciones82 `3467bbd4fddcd213f862bedddac971c827099f3d` (`9a232f1f`) e integrada el 3/10 sobre la beta 85 `cdfb2f2c9d3edf90b8f6299cdbb11d26feafe8c3`. Solo cliente.
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

## Integración sobre la beta 85 (3/10)

- Trece conflictos resueltos a mano, sin `-X theirs`: versión, documentación, notas, panel e2e, presupuesto de tamaño, alcances y generados. Los módulos de `src/` se fusionaron sin conflicto y el resultado es el runtime de la 85 más el de esta tanda.
- Notas: la 86 encima de 85, 84 y 83 y de todo el histórico. Alcances: los de la 85 más los de esta tanda, unidos por tanda y superficie.
- Los generados de `public/` salen de `build-app`, no del merge.
- Tamaño, mismo host y minificador, sellos 85.99→86.99: 1.297.925/353.252 B → 1.301.888/354.552 B (+3.963/+1.300). Topes 1272/347 KiB autorizados por el coordinador; márgenes 640/776 B.
- Cierre de alcances: la tanda de Gastos por periodo lee ahora `catRuleKey`, `catStaleAfter`, `ackCategoryWrite` y `USER_CAT_RULES`, y los vigila. Las otras dieciocho y esta ya cerraban.
- Los GO separados a `9a232f1f` y a `96c8e349` no acreditan la unión; lo que sigue se ejecutó sobre ella.
- Node completo en UTC: único rojo `memoria-espejo`, que depende de la memoria local de la máquina. Guardián de alcances: 1.254 dependencias y 409 datos mutados. Deno no está instalado en esa máquina: sin acreditar.
- Mutantes sobre bundle reconstruido que mueren: guarda de saldo de la cuota, protección de la categoría, frontera de fecha de la regla, confirmación fija, ventana de categorías, Uber Eats y los nombres «Benzina» y «Fuel». Quitar «Taxi» del catalán no se nota (se escribe igual en el idioma de respaldo) y no cuenta. `i18n-keys` y `categories` no detectan un `cat_<id>` ausente porque la clave es dinámica: hueco anterior a esta tanda.
- DOM conjunto con lease 51: 116 de 116 (Plan 39, Gastos por periodo 5, Gasolina/Taxi 6, categoría elegida 3, panel 63) en es/en/ca, sin reintentos, HTML `bcd6e54187c2e88d…`.
- Pendiente: CI exacta, entrega beta y móvil.
