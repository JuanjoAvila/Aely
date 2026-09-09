# FIN-04, paso 1 — escritura parcial y confirmación de source

Base `b7912fb1`, rama `codex/fin04-source-ack`. Implementación de transporte preparada para
revisión de Claude/Cursor; **no cierra FIN-03/04 ni está publicada en el móvil**.

## Qué cambia

Para filas con UUID, `setExpenseBank` y `setExpenseDup` leen `id,source` por usuario e identidad
exacta. Modifican solo el campo pedido sobre el valor remoto y condicionan el UPDATE al source
leído. Así no reconstruyen banco/decisión desde una copia local antigua. Solo aceptan como ACK
el mismo UUID y source esperado. Cero filas, pérdida de sesión, error o fuente desconocida no
son éxito. Si el otro campo cambió, releen hasta tres veces; un cambio concurrente del mismo
campo a otro valor devuelve conflicto. Si ya está el valor solicitado, confirman sin UPDATE.

No hay nuevas columnas/RPC, cambio de UNIQUE ni formatos nuevos de source. Los clientes antiguos
pueden leer las mismas filas. **No hay arbitraje global con escritores antiguos:** uno de ellos
todavía podría sobrescribir después. Tampoco detecta ABA ni ofrece revisión de servidor.
El ACK acredita ese instante, no que la fila quede inmutable después.

Los IDs cortos conservan su camino legado por atributos en este paso, con todos sus límites.
Los UUID sin fila confirmada no se sustituyen por una búsqueda de gemelos. El siguiente paso
debe comunicar `needs_identity`/pendiente al usuario y resolver el legado con evidencia.

## Alcance deliberado y dependencia siguiente

Los llamantes de Gastos aún silencian rechazos y hacen cambios locales optimistas. Este paso
**no convierte esa UI en confirmación fiable**, ni persiste una cola. Esa es la siguiente entrega:
cola por usuario, estado pendiente/error, acciones fuera de updaters y protección frente al pull.
Después se podrá refrescar por UUID sin pisar operaciones locales pendientes. No arreglar el
pull a ciegas antes de introducir esa protección.

Para integrar como versión visible, Claude asigna versión y añade notas/checklist coherentes con
el alcance realmente integrado. Texto orientativo: «Al cambiar el banco de un movimiento se
conservan los demás cambios guardados». No anunciar «sincronización arreglada» ni «decisiones
confirmadas en todos los móviles». Esta PR no incluye un despliegue de servidor ni requiere APK.

## Verificación ejecutada

- `expense-source-ack`: batería final de 18 contra los cuerpos de los métodos de `b7912fb1`,
  **16 FAIL / 2 OK, EXIT 1**; misma batería con el arreglo **18 OK / 0 FAIL, EXIT 0**.
  La primera pasada de 14 ya había dado 12 rojos antes y 14 verdes después; se añadieron casos
  de conflicto del mismo banco, operación ya aplicada, source NULL e inyección de sufijo.
- Se ejecutan los métodos reales extraídos de `00-core.js`, con transporte simulado que aplica
  filtros y provoca carreras entre SELECT y UPDATE. No sustituye una prueba SQL/RLS desplegada.
- `expense-id-cloud`, seguridad, mapa de pruebas y presupuesto de descarga: EXIT 0.
  Medido 1186/1188 KB minificado, 329/330 KB gzip; no se amplían los topes.
- La suite Node/Deno completa tiene un único fallo: `memoria-espejo` local desfasado. Los cuatro
  ficheros Deno pasan. Comprobado el mismo fallo, EXIT 1, en `codex-identidad-ack` sin este cambio.
  No se regenera memoria ajena para ocultarlo.
- Navegador Chromium, servidor propio puerto 4187: **164/166, EXIT 1**; fallaron dos límites de
  tiempo de `rendimiento-tabs`. Repetido ese fichero aislado, un worker: **3/3, EXIT 0**.
  No se cambió código ni se relajaron umbrales. No se presenta la primera pasada como toda verde.

## Prioridad para la consulta del dueño: tres opciones

1. **Primero confirmación y cola (recomendado).** Casos 1/2/6/7 del informe: hay rutas actuales
   de sync y «son distintos», con precondiciones demostradas sintéticamente. Corregirlos evita
   prometer guardados inexistentes. No se ha demostrado qué filas concretas suyas están afectadas.
2. **Priorizar conservación de gemelos.** Casos 3/4/5: riesgo de filas legítimas iguales y lápidas
   débiles, no teoría; para saber incidencia real hace falta inventario privado por identidad.
   Resolver de extremo a extremo requiere contrato de origen y plan de esquema/legado autorizado.
3. **Aplazar el caso 8 como prioridad de producto, conservar su defensa técnica.** El caso
   `setExpenseBank(OB pendiente)` reproduce la API, pero `ExpenseDetailSheet` oculta el cambio de
   banco cuando `source !== manual`, y `#dup` solo lo produce OB. No hay camino de UI actual
   demostrado para ese caso. Por tanto, fue excesivo describirlo como daño actual en el móvil.
   El helper se protege igualmente porque comparte transporte con decisiones y es una frontera
   fácil de romper en futuras llamadas.

No se han consultado ni alterado movimientos reales para elegir estas prioridades. Alcanzable,
reproducido y observado en los datos del dueño son tres afirmaciones diferentes.
