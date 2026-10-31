# UX17 · Filtros de Gastos: deslizadores y contador

Candidato local sobre `9ef9f19b49938d207271289176f2314b858152a1`, sin push ni PR.
La ejecución de pruebas, build y navegador está pendiente del circuito de recursos autorizado.
No acredita entrega en beta ni aceptación móvil.

El botón junto al buscador usa un SVG de deslizadores, con el trazo y las variables de los
iconos de Gastos. Mide 46 px y reutiliza el globito de las secciones. El contador muestra
`nFilters` exacto en un nodo independiente y no se monta con cero filtros. La clase activa,
los resúmenes y las acciones de selección, apertura, cierre y limpieza conservan su cálculo.
El nombre accesible y el título usan la clave existente `g_filters` en es/en/ca; el icono y
el globito son decorativos y el botón informa de la apertura mediante `aria-expanded`.

Los nueve specs afectados y la ayuda común apuntan al botón de la pantalla activa sin
depender del emoji. Se conservan sus oráculos de comportamiento y se añaden comprobaciones
DOM de ausencia del badge, conteo exacto de uno y de tres filtros reales, limpieza y nombre
localizado con apertura por teclado. Los specs existentes de cierre por gesto/atrás siguen
abriendo la misma hoja. No se añaden specs nuevos ni cambia el mapa del runner.

Validación pendiente: ejecutar los specs afectados contra un artefacto recién ensamblado de
esta fuente, con reserva propia de Chromium y del servidor/puerto, un worker y cero retries.
Revisar el commit final de forma independiente y obtener el GO exacto del coordinador antes
de publicar una única PR draft a beta. No se modifican reglas financieras, backend, versiones
ni catálogo; tampoco los opcionales de UX17 o `useCountUp`.
