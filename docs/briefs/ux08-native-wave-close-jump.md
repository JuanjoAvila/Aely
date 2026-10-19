# UX08 / INC-2709-03 · scroll nativo y cierre · candidata web

Base exacta `dca4c71c640e3ebbc26256f9e79572fdda94e39e` (beta 4.26.150).
El objetivo confirmado el 19/10 es **conservar la ola nativa Android en los bordes**.
El rótulo histórico «sin ola» de la integración anterior expresaba el objetivo al revés.
Esta candidata conserva la corrección de geometría de PR285 y no cambia su entrega histórica.

## Dos reproducciones independientes

En la ficha de un recibo, un gesto vertical de 50 px iniciado dentro del contenido en el
borde superior se convertía en una traslación de toda la hoja de 46 px. El gesto pertenecía
al cierre por arrastre en vez de al scroll del navegador. Se separan esas acciones: el
contenido conserva sus bordes nativos; el asa sigue cerrando hacia abajo y Atrás sigue
funcionando lateralmente. El alta usa el mismo contrato. No hay animación que imite la ola.

Después de desplazar la ficha, tocar el velo empieza su salida. Un segundo toque dentro
de la hoja, cancelado mientras sale, borraba el transform de cierre: los frames muestran
que vuelve hacia arriba antes de desaparecer. `onTouchCancel` ahora respeta un cierre ya
iniciado, igual que los controladores de inicio y fin. No se añade ninguna espera ni se
restaura a ciegas el scroll. Plan mantiene su scrollTop y su ancla durante todos esos frames.

Las dos comprobaciones fallan sobre la base y pasan con la candidata. Las observaciones
iniciales de la salida y de la llegada solamente no detectaban el retroceso intermedio;
se conservan esos resultados junto al registro continuo que sí lo descubre.

## Inventario y límites

Gestionar, Servicios, Cuotas, Ingresos, Puntuales y el simulador usan los pushes existentes.
La ficha y el alta son portales hermanos. Gestionar/categorías ya conservan `overflow:auto`,
`overscroll-behavior:auto`, `touch-action:auto`, geometría completa del viewport y ninguna
capa transformada en reposo sobre esta base. Los bordes superior/inferior de Servicios no
desplazan el hub ni la raíz en la reproducción web. No se atribuye a PR285 una supresión
que estos datos no demuestran, ni se revierte su limpieza de capas/containing block.

En ficha/alta se retira únicamente la promoción permanente `will-change:transform` y se
reutiliza `plainScroll` para limpiar el gesto lateral al cancelar. Las transiciones de
entrada/salida y el candado compartido siguen vigentes. Su `touch-action:pan-x pan-y`
calculado permite desplazamiento nativo; no hace falta sustituirlo ni tocar otras pantallas.
`.app{overflow:clip}` de `200e9a6e` permanece intacto.

Las pruebas usan UI real, tacto CDP, viewport estrecho, datos sintéticos y red externa
abortada. Registran CSS efectivo, scroll, geometría, cancelaciones, historia de un nivel y
el SHA256 del HTML servido. Comparan byte a byte las dos claves financieras una vez sellada
la copia automática del arranque. La cantidad, signo, categoría, pagado, deuda y enlaces
persistidos no cambian durante estos recorridos. El nuevo spec está en E2E_MAP; shell/02
siguen siendo CORE, sin recortar el gate de integración.

**La ola visual del sistema operativo sigue SIN VERIFICAR.** Desktop no permite certificar
el stretch/glow Android ni demostrar que todas las pantallas del móvil estén reparadas.
El salto reproducido corresponde a cancelación durante la salida; los cierres ordinarios
probados ya conservaban el fondo. No se presenta como explicación de cualquier otro salto.
No hay CPU6, perfiles, trazas, suite general, APK, backend, merge ni despliegue en este corte.
VERSION, catálogo y topes permanecen intactos. Gates y EXIT exactos: cierre privado.

## Aceptación después de integrar y servir una beta nueva

El coordinador debe cotejar versión, fuente, manifiesto y hash realmente servidos antes
de enviar la única notificación pendiente con la URL. En el móvil: comparar los bordes
de Plan con Gestionar, las cuatro categorías, simulador, ficha y pasos del alta; bajar y
subir por listas con contenido, volver un nivel, cancelar Atrás y cerrar tras desplazar.
Comprobar la ola superior/inferior, la posición del fondo, el asa y ausencia de retroceso
si se toca/cancela durante la salida. Cancelar el alta sin guardar. No hay URL nueva
acreditada ni aceptación móvil en esta candidata.

Texto familiar propuesto para la integración: ES «Las fichas de recibos dejan deslizar hasta
sus bordes y no reaparecen si se cancela un toque mientras se cierran»; EN «Receipt sheets
let scrolling reach their edges and no longer reappear when a touch is cancelled as they
close»; CA «Les fitxes de rebuts deixen desplaçar-se fins als extrems i no reapareixen si es
cancel·la un toc mentre es tanquen».
