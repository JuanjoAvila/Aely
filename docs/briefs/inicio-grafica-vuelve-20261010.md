# Inicio: restaurar la gráfica de producción110

Encargo de Claude `inicio-grafica-vuelve-codex-20261010`, desde
`74c5f075bf08e38e289992195ad97e3a71a8b031`. La112 interpretó el rechazo de la variante109
como permiso para retirar toda la gráfica. La orden humana del10/10 exige recuperar la que
ya estaba en main4.26.110, `bdd756363261290b2f9da56aa0c9873c8eae911b`.

## Cambio acotado

- `Sparkline` recupera exactamente la función de producción110: área degradada, línea verde,
  punto final, dimensiones320×70 y escala existente. No se añade el rediseño109 ni el WIP113.
- El hero vuelve a mostrarla bajo el patrimonio, con el total actual como último punto y el
  vacío anterior cuando no hay histórico. Desaparece «Ahora» en los tres idiomas y su CSS.
- Se conserva el cálculo, la moneda, el count-up y la protección de112: un total desconocido
  muestra «—» y su explicación. La gráfica sólo lee el histórico; no lo cambia ni crea asientos.
- Se mantienen la función real `NetWorthNow` y su puerta en Dashboard. El nombre técnico no
  añade una etiqueta a la pantalla ni conserva código muerto.
- Los textos `v4_hist_empty` son los de producción110, es/en/ca. No se toca VERSION,
  catálogo, notas, APK, backend ni ramas de publicación.

## Evidencia y gate

Los25 casos DOM comunes del candidato pasan contra un checkout separado del SHA exacto de
main110, con el mismo fixture sintético. El servidor entrega el HTML construido de esa base;
su SHA256 coincide con el disco. El caso de área/línea/punto compara atributos literales y
captura únicamente el hero sintético. El candidato añade tres casos de total desconocido.
El control negativo definitivo sobre el artefacto112 falla por SVG ausente. Los74 casos de
Inicio, vacíos, arranque offline, presupuesto mensual, arco, informe y smoke pasan en la
fixture de integración, sin reintentos, omisiones ni flaky. El presupuesto del bundle de esa
fixture pasa con los topes existentes; no es un artefacto publicado.

El cuerpo de `Sparkline` coincide byte a byte, normalizando sólo CRLF, con producción110
(SHA256 `d88a1e85f7657bc87b8eddd4ef46f2629dc985d0b9f8aad84c30cfb8319627b6`).
Las capturas del hero tienen las mismas dimensiones982×542: texto y dibujo coinciden
visualmente. La comparación de píxeles encuentra7733 diferencias de como máximo1 unidad
por canal, localizadas en el degradado; no se presenta una igualdad binaria de las capturas.

`npm run build` normal falla con `BETA_SCOPE_ABSENT` en `src/shell.html`: el descriptor112
exige `.v4-net-current-head` y `.v4-net-now`, retirados con la etiqueta. El encargo reserva los
catálogos al coordinador, así que no se conservan estilos muertos como anclas ni se cambian
metadatos fuera de alcance. Claude tiene el bloqueo y puede actualizar el descriptor al integrar.

La fixture DOM omite sólo esas dos selecciones del descriptor en memoria al ensamblar. No
escribe un catálogo modificado, no altera código de producto ni se aplica a `npm test`.
Esa pasada verifica la UI restaurada; no acredita el build normal ni una suite completa verde.
Los resultados finales y exitcodes se entregan por el result de la sesión titular.

No hay publicación ni aprobación móvil. El histórico sigue siendo numérico y sin fechas,
con el comportamiento de producción110; no se introduce una interpretación de ganancias ni
otra limpieza de sus datos. La identidad y el guion112 requieren revisión del coordinador
porque la nueva fuente ya no describe una pantalla sin gráfica.
