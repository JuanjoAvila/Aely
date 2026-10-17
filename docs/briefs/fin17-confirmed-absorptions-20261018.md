# FIN17 · memoria de absorciones confirmadas

Fuente desde `fbff73ee`, contrato Claude `066532de` y `0036b768`. Investigación, rojos
históricos y fallos intermedios se conservan en la evidencia privada del titular.

Tras el ACK real de FIN11 se persiste y relee `obAbsorbedConfirmed` antes de retirar la
intención pendiente. El registro viaja en `slimForCloud`, se une fuera del ganador LWW y
se guarda en una partición por propietario. Una caída entre escrituras conserva la
protección pendiente o ambas; no acredita atomicidad entre claves ni con el servidor.

Su tope es 1000, separado de las 200 intenciones y las 500/200 lápidas/relojes normales.
Solo al faltar espacio se pueden retirar confirmadas de más de 90 días; edades inválidas,
futuras o de exactamente 90 días no habilitan expulsión. Una unión que no cabe no se
trunca ni sobreescribe: se conserva protección y se avisa. La poda normal no toca este
registro. Las edades ilegibles se serializan como `null`, para no perder la entrada.

Los escritores simples, batch, backfill, edición diferida y sus reintentos consultan el
registro durable después de los `await`, con sesión y propietario vigentes. Un alta
denegada no es un ACK ni dispara una reparación de recibo. Los DELETE de limpieza siguen
funcionando. Se preservan banco/referencia/ordinal/día, compatibilidad simétrica de cuenta
ausente de FIN10 y veto de superviviente; nunca se deduce una retirada por referencia sola.
Los lectores cliente, presupuesto e ingest/widget aplican esta protección antes de consumir
una referencia. Los cambios de registro invalidan sus cachés y memos.

El batch comprueba además la sesión del mismo SDK después de evaluar todas las filas y
justo antes de releer el registro y construir el envío. Un cambio de propietario al evaluar
una fila posterior no puede dejar subir las que se habían aprobado antes. El rojo de revisión
con dos filas detectó esa ventana en el filtro del fallback; el filtro inicial ya era seguro.

H2 conserva **640 céntimos inciertos**, los originales y la intención, con aviso breve
es/en/ca y telemetría de código cerrado. El rojo histórico de 320 queda como límite conocido:
no se presenta como deduplicación resuelta. No se fabrica propietario, no se expulsa una
intención sin confirmar ni se añade caducidad silenciosa o liquidación manual.

El cliente que aún no leyó el registro, los escritores antiguos y la carrera entre comprobar
y subir pueden reinsertar; la expulsión autorizada de confirmadas antiguas también limita
la retención. FIN18, cerco atómico de servidor con esquema, queda en backlog del dueño.
La fuente de lectores servidor no acredita su despliegue. Sin SQL, bancos reales, Edge,
APK ni cambios de VERSION/catálogo/topes ajenos. CI, integración, servido y aceptación móvil
son gates distintos; un verde sintético no es ProductREADY.

Pruebas focales: `tests/fin17-confirmed-absorptions.test.mjs` (incluye ocho controles y
mutantes escritor/poda/ref-only) y `e2e/fin17-confirmed-absorptions.spec.mjs` (reapertura,
propietario y avisos H2). El mutante de reapertura FIN11 conserva su aserción y retira solo
la restauración pendiente dentro de la nueva composición, sin desactivar confirmadas.
