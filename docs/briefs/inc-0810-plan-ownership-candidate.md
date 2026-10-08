# Plan: prototipo aislado de ownership del host

Preparación sobre `170fccb2045e3f06105f1576a6837aac71bd4243`, que conserva runtime
beta106 `8dcc5ed39b6e212ba1e34a90b550685794ce0bd5`. No es una tanda ni una entrega;
no se cambia versión, registro beta, APK, Edge, dinero o gates. No integrar ni publicar.

La calibración anterior distingue trabajo de estilo/layout entre condiciones CSS aun sin
consultar estilo durante el gesto. Es una asociación de trabajo, no la reproducción del
lag humano ni prueba de permisos nativos. AGENTS §7 bis exige discriminar frames naturales
antes de atribuir una optimización. Este prototipo lleva esa comparación a una fuente mínima.

## Delta acotado

Sólo `PlanTab.setOwn` añade/retira `mc-plan-touch-own` junto a `mc-touch-own` en una misma
mutación de clase. Conserva ownOn, scroll manual, prevención/propagación, ejes, umbrales,
commit y cancelación. Una regla posterior al ownership genérico deja `touch-action:auto`
exclusivamente en `.page.page-scroll-host.mc-plan-touch-own`. No lleva `!important`:
los bloqueos de sheet/perfil siguen ganando. No cambia App, Inicio ni el host no aparcado.
El marcador propio debe desaparecer al terminar, cancelar o limpiar el efecto.

La re-renderización de App puede reconciliar sus clases o sincronizar el ownership genérico.
La prueba usa el evento offline real del estado UI y exige limpieza de ambos marcadores al
cancelar. No amplía el runtime con otra reparación si ese contrato falla. Tampoco interpreta
el CSS leído durante un toque como los permisos decididos antes de él; se conserva el límite
de [Pointer Events](https://www.w3.org/TR/pointerevents/latest/#the-touch-action-css-property).

## Banco A/B aislado

El helper archiva por SHA completo beta106, candidata HEAD **ya comprometida** y main
`56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b`. Aborta si falta cualquier objeto; no usa un
servidor existente ni una fuente alternativa. Ensambla cada archivo en temporal propio,
abre HTTP en loopback con puerto libre y coteja SHA de fuente/hash HTML servido antes de
probar. Cierra servidores y elimina sólo sus temporales. No hay dependencias nuevas.
Cada fuente usa contexto nuevo, mismo reloj/fixture ficticio y bloqueo de requests externas.

Tres casos comparan Recibos, Deudas y Metas, en primera pasada y después de doce ciclos de
scroll y navegación táctil. El navegador aterriza realmente tras swipes y usa CPU×6. Se
miden timestamps de rAF natural, sin Tracing/Profiler ni lecturas DOM/estilo/dimensiones por
frame. Se esperan dos frames **antes** del dedo para tener una referencia anterior; durante
el dedo sólo corren los movimientos CDP y su intervalo fijo. Captura inicio y cierre nativos,
scroll efectivo y 450 ms posteriores de observación. Las comprobaciones DOM llegan después
de parar el lector. Frames que atraviesan un borde se conservan separados; uno que cruza
todo el gesto tampoco se cuenta dos veces. Valores duplicados/desordenados o bordes sin
cobertura invalidan el informe, no generan un falso cero. Se emiten muestras individuales,
no promedios, ratios ni causa humana. Si baseline no reproduce un caso malo o candidata no
lo distingue, el prototipo sigue sin aceptación ni versión publicable.

Cuatro casos de contratos cruzan movimiento normal/reducido y safe-bottom 0/34: Inicio
sin marca nueva y con ownership CSS original, adquisición real de ambas marcas en Plan,
re-renderización/cancelación, scroll ordinario, deriva, círculo de segmentos, swipe horizontal
con aterrizaje y prioridad del sheet real. No se escriben importes; se coteja una huella de
deudas/metas/fijos/histórico antes/después, además de liberar ambos marcadores.

Las 21/27 sondas históricas conservan fuentes e informes en sus ramas de diagnóstico. No se
alteran aquí sus aserciones baseline-none. La composición CI de este prototipo debe restaurar
byteexact el spec nativo original beta (274 líneas) en vez de ejecutar aquellas sondas con
una semántica nueva. Ese cambio de composición requiere revisión explícita del coordinador;
no recorta contratos originales y no convierte el diagnóstico histórico en una prueba verde
nueva. La rama de este autor conserva los archivos históricos sin editarlos.

## Verificación y límites

Sintaxis, mapa de suites, privacidad y diff se comprueban localmente. Proof Node adicional
prueba mutación atómica/cleanup, prioridad y alcance CSS, bordes/duplicados/orfandad de frames,
cierre del input al fallar un movimiento y huella que distingue una mutación de ahorro.
Infraestructura de archivos/servidores se prueba tras el commit final; no significa DOM.
Chromium local ausente: cero gestos reales ejecutados aquí. Revisión fuerte y CI exacta
pendientes; conservar NO-GO previo y detenerse si una guardia no pasa. INC-2709-09 sigue abierto.

La clasificación conserva cada intervalo que cruza inicio/cierre y `touchIntersecting` incluye todos los intervalos que intersectan el toque: este resumen solapa las fases y no se suma a ellas. El guard de invariancia compara el estado local completo y el historial serializados mediante SHA-256, antes/después de cada muestra y bloque de uso. La prueba de re-render exige la píldora offline visible y comprueba que App ha retirado el marcador genérico y que el host fijo conserva CSS auto sin sheet antes de cancelar. Registra por separado si React conserva el marcador específico Plan; no exige ni atribuye supervivencia. Al terminal exige ambos ausentes.
