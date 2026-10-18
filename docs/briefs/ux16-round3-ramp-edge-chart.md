# UX16 · rampa, tirón y cursor de Inicio · tercera ronda

Candidata desde `7090802099ac0c7956c0d3597a9936a82c52a95f`. El rechazo comunicado
de APK57 pide un relleno continuo y sutil, algo más de intensidad en los bordes,
repetición mientras se tira y un tick por punto cambiado de la gráfica de Inicio.
El añadido sobre botnav fue anulado por la corrección de la gráfica. Se conserva
PR276; no se modifica la barra de pestañas ni el cálculo financiero de la serie.

## Relleno y toque nativo

El plan anterior ofrecía hasta diez LOW_TICK durante el relleno cuando no había
control de amplitud. Eso puede explicar los golpes separados, sin acreditar que
fuera la ruta real del móvil. Se elimina ese tren: el relleno solo solicita una
onda sin repetición, sin intervalos apagados, de 3 a 30/255 durante el tiempo real
de animationstart (1100 ms actualmente, máximo 1200). Sus sesenta tramos suavizan
la progresión; el techo coincide con el nuevo toque del borde.

**Sin control de amplitud o si falla la onda, el relleno guarda silencio.** No se
simula continuidad con primitivas ni con un toque fuerte. Esto limita la cobertura
de motores compatibles y requiere comprobación en la próxima APK. La
[documentación Android](https://developer.android.com/develop/ui/views/haptics/custom-haptic-effects)
explica que una onda con amplitudes positivas puede sonar al máximo en un motor
sin ese control; la selección lo exige explícitamente.

Borde y cursor comparten un único toque: 8 ms a 30/255 con amplitud controlable,
una LOW_TICK a escala 0,25 si está soportada y tiene duración conocida, o la
reserva muy suave SEGMENT_FREQUENT_TICK/silencio. Los efectos explícitos usan
USAGE_TOUCH; ajustes del sistema y View, visibilidad y foco siguen mandando.
La respuesta por llamada mantiene path, api y capacidades y añade continuous.
Indica la ruta seleccionada del código al ejecutarse: no acredita percepción.

## Tirón y cursor

La llegada por inercia conserva su cerrojo por extremo y rearme tras separación.
El tirón de 10 px arma un solo temporizador de 150 ms. Repite mientras el mismo
dedo siga contra el mismo extremo; soltar, cancelar, cambiar hacia dentro, iniciar
otro gesto, abandonar el extremo, ocultar el documento o bloquear el gesto lo
detiene. Sin dedo no se inicia repetición. No se modifica la física del scroll.

El cursor usa el RAF que ya actualizaba el punto. Compara el día del punto que se
va a pintar con el anterior y permite un tick solo con cambio y al menos 35 ms
desde el último. Los puntos omitidos en un barrido rápido no encolan pulsos para
después. Sin búsquedas sobre el histórico, nuevos layouts ni temporizadores por
touchmove; mantiene data-noswipe y las mismas decisiones horizontal/vertical,
espera de activación y cancelación. Movimiento reducido silencia todos los RPC.

## Evidencia y límites

- RED web en el HTML base intacto: EXIT1, dieciocho controles pasan y cinco
  comprobaciones fallan (tirón y gráfica). GREEN: veintitrés comprobaciones EXIT0,
  Edge155, un navegador, cero reintentos, puerto propio48548. DOM/RAF/scroll reales,
  contactos y transporte nativo sintéticos; sin fling físico ni prueba Android.
- RED JVM: compila EXIT0 y falla por dos aserciones (techo antiguo y escala).
  GREEN: cuatro métodos nuevos EXIT0 sobre techo, toque único, selección continua
  y muestreo de rampa. Los contratos anteriores de tren de primitivas se reemplazan
  explícitamente; los métodos históricos no se vuelven a ejecutar como evidencia.
- javac del plugin contra API Android35 real con dobles Capacitor EXIT0; ejecución
  Java con dobles Android/Capacitor API36: diez controles nuevos EXIT0, incluidos
  silencio del relleno sin amplitud, error de efecto, ajustes y USAGE_TOUCH.
  No equivale a enlazar Capacitor real, Gradle, APK o ejecutar el motor.
- Nueve mutantes semánticos nuevos muertos con EXIT1 de aserción: techo, motor sin
  amplitud, escala, hueco apagado, repetición, liberación, punto sin cambiar,
  frecuencia y movimiento reducido de la gráfica. No hay kills por sintaxis.
- Se conserva un fallo privado de quoting al crear los arneses y los dos lanzamientos
  que encontraron el módulo ausente; cero casos ejecutados y sin atribuirlos al RED.

Las instrucciones AGENTS/EMPIEZA de esta base son byteidénticas a las ya leídas
completas. El nuevo spec queda registrado. No se repiten los controles de rondas
anteriores ni pruebas ajenas. El build genera public/index; el recibo beta-delivery
y las notas generadas se conservan exactos a la base para reconciliación del integrador.
VERSION, catálogo y caps no cambian. No se ejecutan Gradle/APK, suite/CI general,
CPU6, beta-sources, tamaño oficial, docs-frescura, SQL, bancos ni despliegue.
Revisión Claude, integración, servido y aceptación física de la intensidad, ruta
real, inercia WebView y suavidad siguen pendientes. No ProductREADY.
