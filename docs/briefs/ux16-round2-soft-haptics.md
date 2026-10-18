# UX16 · suavidad e inercia · segunda ronda

Candidata de revisión desde beta `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`.
Encargo nuevo tras el rechazo comunicado del APK 56: un toque fuerte en vez de
acompañar el relleno y ausencia de toque al llegar al extremo por inercia.
Primera ronda, su resultado y sus pruebas quedan cerrados; no se presentan como
validación de esta revisión. No hay APK nuevo ni aceptación física acreditada.

## Causa y ruta nativa

En la fuente anterior, API 36 cumple la guarda `>=33`. El código solo intentaba
LOW_TICK y cualquier falta de soporte, duración desconocida o excepción acababa
en CLOCK_TICK, también usado por el borde. Es una explicación posible del toque
fuerte; no identifica la ruta que tomó realmente el OnePlus, que no se ha sondado.

Ahora, con ajuste táctil y View habilitados, visibles y con foco:

| Capacidad | Relleno | Borde |
|---|---|---|
| API 33+ y amplitud controlable | Onda sin repetición, 10→60/255, hasta doce tramos que suman la duración real | 8 ms a 10/255 |
| API 33+ y LOW_TICK con duración conocida | Hasta diez primitivas, escala 0,04→0,16, pausas descontando la duración del motor | Una LOW_TICK a 0,04 |
| Sin ambas rutas o excepción | SEGMENT_FREQUENT_TICK en API 34+; silencio si no está disponible | Igual |

Nunca se usa amplitud por defecto ni CLOCK_TICK como reserva. El tope sigue en
1200 ms; el anillo mantiene su animationstart real y su duración efectiva
(1100 ms actualmente). No se cambia su pausa del splash, delay, selector ni
deduplicación por instancia. Los efectos explícitos usan USAGE_TOUCH; no hay
flags para ignorar ajustes. Cada llamada devuelve path, api, amplitudeControl,
lowTick y primitiveMs, sin logs ni datos personales. Esa respuesta permite
diagnosticar la próxima APK; no se afirma una observación del dispositivo actual.

La [documentación de Android](https://developer.android.com/reference/android/view/HapticFeedbackConstants#SEGMENT_FREQUENT_TICK)
define esta reserva como muy suave y permite que el dispositivo la omita cuando
no pueda producirla adecuadamente. Los valores bajos elegidos requieren aceptación
física: la amplitud solicitada no mide la sensación. Se conserva compile SDK y no
se incorporan APIs 36 exclusivas ni dependencias.

## Borde web

El observador pasivo captura scroll, que no burbujea, y conserva una pequeña ficha
por scroller en WeakMap. Una llegada desde el interior a 0/máximo puede pulsar con
el dedo ya levantado. Repetir eventos o empezar otro gesto en ese borde no rearma;
se exige separarse 12 px (la mitad del rango en scrollers muy cortos). El tirón
inicial de 10 px sigue disponible. No hay pulso por la posición inicial del DOM.
Se conservan stopSwipe, scroll horizontal, páginas inactivas/sin ola, navegación,
Perfil/Ajustes, movimiento reducido y documento oculto. No cambia la física del
scroll. Una animación o desplazamiento programático con eventos de scroll puede
producir la misma señal de llegada: el evento no identifica el origen físico.

## Evidencia focal nueva

- RED navegador sobre el artefacto base intacto: EXIT1, diez controles y cinco
  fallos. GREEN: quince comprobaciones EXIT0, DOM y scroll reales con secuencia
  sintética de inercia; Edge 155, un navegador, cero reintentos, puerto propio.
  Transporte háptico doble: no prueba vibración ni un fling físico.
- RED JVM: compila EXIT0 y falla por aserción EXIT1, 0,12 frente a 0,04. GREEN:
  tres métodos nuevos EXIT0: escala, elección de capacidades (incluido API36) y
  presupuesto de onda para diez duraciones. No se repiten los tres métodos viejos.
- Plugin completo: javac con API Android35 real y dobles de Capacitor EXIT0.
  Ejecución del código Java de producción con dobles Android/Capacitor API36:
  trece controles EXIT0, incluidos USAGE_TOUCH, ajustes, foco y reserva por error.
  No equivale a compilación Gradle, enlace Capacitor real ni ejecución Android.
- Ocho mutantes semánticos nuevos muertos con EXIT1 de aserción: prioridad de onda,
  ajuste, rampa, tope, listener scroll, rearme por dedo, separación y stopSwipe.
  Una novena mutación redundante (quitar solo la guarda de movimiento reducido del
  listener) sobrevive: pulse y transporte conservan sus guardas. Se preserva.
- El spec nuevo se registra en relevant-tests. El spec antiguo adapta únicamente
  sus expectativas que contradicen el nuevo rearme; no se ejecuta de nuevo ni
  se atribuyen sus 25 resultados anteriores a esta fuente.

Los comandos privados, fuentes, EXITs y hashes se conservan en el manifiesto del
titular. No se ejecutan Gradle/APK, suite general/CI, CPU6, beta-sources, tamaño
oficial, docs-frescura, SQL, bancos ni despliegue. VERSION, catálogo y caps intactos.
Claude debe revisar/integrar y compilar la APK; servido y aceptación del motor,
intensidad del sistema e inercia WebView real siguen pendientes. No ProductREADY.

APIs consultadas: [onda con amplitudes](https://developer.android.com/reference/android/os/VibrationEffect#createWaveform(long%5B%5D,%20int%5B%5D,%20int)),
[USAGE_TOUCH](https://developer.android.com/reference/android/os/VibrationAttributes#USAGE_TOUCH),
[efectos personalizados](https://developer.android.com/develop/ui/views/haptics/custom-haptic-effects).
