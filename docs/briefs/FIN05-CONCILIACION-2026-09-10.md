# FIN-05: el widget recibe un conjunto distinto de movimientos

Diagnóstico de Codex, **10/9/2026**, sobre `bbf742bd`. Estado: **causa de divergencia
reproducida; corrección y conciliación de datos pendientes**. No es una entrega de producto.
Los datos y capturas originales permanecen fuera del repositorio público.

## Evidencia actual

- Pages sirve **4.18.8**, beta **4.19.22.1**, APK **42 / 4.18.3**. Verificados por red;
  los últimos Tests y Deploy de main terminaron correctamente. El informe de mes y los
  límites por categoría ya se portaron a producción; `npm run listo` todavía los presenta
  como pendientes porque compara versiones y ramas, no los portes ya publicados.
- La consulta de solo lectura del mes, usando el cálculo de ingest, reproduce el total
  alto del widget. Cliente y servidor **coinciden al céntimo sobre las mismas filas**.
- El modo leído de `app_state.data.settings.gTotalMode` es **neto**, comprobado en esa
  consulta. La frase del widget «de ... este mes» no distingue neto de separado. Descartar
  diferencias de ingresos suponiendo modo separado contradice esta evidencia.
- La copia diaria anterior al pago contiene ingresos activos cuya clave también está en
  `app_state.data.deleted`. El cliente los cuenta; `filasComoLaApp` los excluye en servidor.
  Hay además una fila local sin correspondencia en la consulta del mes. No se ha cambiado
  ninguna fila, lápida ni configuración durante el diagnóstico.
- La copia es anterior al incidente. No permite afirmar qué filas exactas conserva AHORA
  el móvil, ni cuál de los dos totales debe prevalecer. La coincidencia numérica acota la
  investigación, pero no sustituye la conciliación de identidades y decisiones.
- No hay marcas `#dup` en las filas remotas consultadas del mes. El supuesto de que este
  caso concreto era un posible repetido pendiente no queda demostrado.
- La inspección posterior de Claude confirma funciones desplegadas anteriores a cambios
  de septiembre. Es una deriva que debe corregirse mediante su plan de despliegue, pero
  **no demuestra que una fila `#dup` cause estas capturas**. FIN-05 permanece abierto;
  verificar despliegue y conciliar conjuntos son comprobaciones distintas.

## Camino de código comprobado

1. `TrExpenseListener` toma `month.spent` de ingest y llama a `MiCarteraWidget.saveMonth`.
   `saveMonth` **reemplaza** `spent`: no le suma el precio de la compra. La parte incremental
   afecta a `safeLiq` y `cash`; no explica por sí misma el salto de gasto mensual.
2. Ingest filtra `state.deleted` y colapsa claves día/importe/comercio antes de calcular.
   `monthBudgetStats` recorre los gastos locales activos sin aplicar esa lista de borrados.
3. `syncCloudExpenses` filtra las filas entrantes con las lápidas, pero conserva las filas
   locales de fuentes `ob`, `manual`, etc. Si una de ellas contradice una lápida, la
   discrepancia puede sobrevivir al pull y al reinicio.
4. `saveEdit` añade la clave anterior a `deleted`, conserva el UUID local y lanza DELETE y
   UPSERT remotos en paralelo, sin comprobar confirmación. Dos riesgos independientes:
   volver a una clave antes editada y carreras de borrado/alta. No atribuir una carrera
   concreta a las capturas sin evidencia temporal.

## Reproducción ejecutada con datos sintéticos

Se extrajo y ejecutó el cuerpo real de `saveEdit` de `04-tab-gastos.js`, con `set` en memoria
y nube desactivada. Sin reimplementar el editor en el test:

1. Sembrar un ingreso de **12 €**, comercio `Ingreso de prueba`, banco diario, fecha
   `2026-09-02T12:00:00Z`, UUID estable.
2. Renombrar a `Concepto cambiado` y volver a `Ingreso de prueba`.
3. La lista local sigue conteniendo **una fila**. `deleted` contiene su clave actual.
4. Serializar esa fila al formato de expenses y ejecutar `filasComoLaApp`: devuelve
   **cero filas**. Con el mismo estado, app muestra 12 y servidor 0 en modo neto.

Esto demuestra una forma de fabricar el estado contradictorio. **No demuestra que el dueño
haya seguido esos dos pasos**. No es un test verde de un arreglo: el fallo sigue presente.

## Corrección propuesta y límites

- **No filtrar silenciosamente la lista local por las lápidas**, ni vaciar `deleted` para
  cuadrar cifras. Sus claves no incluyen banco ni UUID: podrían señalar otro movimiento.
- **No sustituir el total absoluto del servidor por sumar el precio al último total**.
  Se romperían reintentos, ingresos, cambio de mes y movimientos añadidos por otro cliente.
- Preparar conciliación visible: fila local, estado remoto por UUID, lápida coincidente,
  procedencia, fecha de cada evidencia y efecto de cada decisión. Los casos sin identidad
  fiable quedan pendientes; no se vinculan por parecido de importe/nombre.
- Las nuevas ediciones requieren UPDATE de la fila canónica con confirmación y control de
  concurrencia; nunca DELETE+UPSERT concurrentes. Una escritura que afecta cero filas debe
  quedar pendiente visible. El paso parcial de `source` de PR #43 no cubre todavía este editor.
- Diseñar lápidas por identidad con compatibilidad para clientes anteriores antes de
  retirar las claves históricas. No migrar ni recuperar filas reales automáticamente.
- Revisión independiente obligatoria: renombrar A→B→A, cambiar importe y volver, dos filas
  legítimas iguales de bancos distintos, dos clientes, offline, timeout tras commit,
  cero filas afectadas, reintento y notificación posterior. Comprobar presupuesto y filas.
- El arbitraje de respuestas tardías del widget sigue siendo otro pendiente. Si se toca
  Java necesita APK; la discrepancia de conjuntos no demuestra por sí sola que haga falta.

## Orden operativo de esta sesión

El dueño devuelve la dirección a **Codex**. Se conserva el reparto para no duplicar trabajo:
Cursor: visor y paginación del histórico; Claude: panel de pruebas, modo inicial y pulsación
larga; Codex: conciliación del widget y revisión de las tandas aprobadas. Los encargos se
enviaron al canal local; un encargo no acredita que otra sesión lo haya recibido.

Tandas nuevas separables desde main; arreglos de funcionalidades que solo existen en beta
deben declarar esa dependencia. Nunca portar todo el histórico solo para corregir su visor.
El dueño autoriza publicar las aprobadas que estén aisladas y verificadas; no toda beta.
