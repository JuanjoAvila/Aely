# FIN17 · memoria de absorciones confirmadas

Fuente desde `fbff73ee`, contrato Claude `066532de` y `0036b768`. Investigación, rojos
históricos y fallos intermedios se conservan en la evidencia privada del titular.

Tras el ACK real de FIN11 se persiste y relee `obAbsorbedConfirmed` antes de retirar la
intención pendiente. El registro viaja en `slimForCloud`, se une fuera del ganador LWW y
se guarda en una partición por propietario. Una caída entre escrituras conserva la
protección pendiente o ambas; no acredita atomicidad entre claves ni con el servidor.

Su umbral es 1000, separado de las 200 intenciones y las 500/200 lápidas/relojes normales.
Solo al faltar espacio se pueden retirar confirmadas de más de 90 días; edades inválidas,
futuras o de exactamente 90 días no habilitan expulsión. La unión aplica esa misma regla;
si quedan más de 1000 se conservan todas con telemetría, sin bloquear la cartera ni altas
ajenas. La poda normal no toca este
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

Remates F1–F5, sobre beta141 exacta `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13`:
el aviso se guarda por dispositivo y propietario, se consume una vez y se elimina al
resolver la cola. No viaja en `app_state`. `SIGNED_OUT` elimina las particiones confirmada
y pendiente del propietario saliente; el guardado posterior no recrea una partición vacía.
Las particiones de otros propietarios se conservan.

El formato compacto v1 usa un diccionario y buckets de hash corto. Cada entrada conserva
su testigo de identidad completo; el hash nunca decide si se oculta un movimiento y las
colisiones conservan todos los testigos. Los lectores admiten el array anterior y el pack.
La partición local solo se escribe cuando sus bytes cambian y se relee antes de separar el
registro del estado ligero. Un fallo de persistencia mantiene el registro como fallback.
Se omite el push completo únicamente si coinciden el payload semántico y el CAS confirmado;
`_savedAt` por sí solo no cambia ese payload. Un cambio ajeno reenvía el registro compacto:
es el contrato actual, aceptado en `55d1f423`; columna/RPC separada queda para FIN18.

Medición sintética idéntica de 1000 entradas frente a `5fb63762`: registro 310940 → 151419
bytes; estado principal 311293 → 376 bytes; dos persistencias iguales 2 → 1 escrituras.
Cinco llamadas (inicial, tres cambios solo de `_savedAt`, cambio de presupuesto) generan
5 → 2 envíos. Es medición de bytes y llamadas, no de fluidez ni CPU6.

M9, M11 y M12 son sondas reconstruidas con la descripción autorizada, no bytes originales
del revisor. Cada mutante tiene diff, SHA256 y ejecución independiente EXIT1 por aserción;
los controles reales cubren estado tras pull, stats del handler de notificación y sync sin
presembrar el registro. La combinación beta141 preserva la decisión cloudOnly de Metas y
une las confirmadas incluso cuando se rechazan reservas locales en conflicto.

El cliente que aún no leyó el registro, los escritores antiguos y la carrera entre comprobar
y subir pueden reinsertar; la expulsión autorizada de confirmadas antiguas también limita
la retención. FIN18, cerco atómico de servidor con esquema, queda en backlog del dueño.
La fuente de lectores servidor no acredita su despliegue. Sin SQL, bancos reales, Edge,
APK ni cambios de VERSION/catálogo/topes ajenos. CI, integración, servido y aceptación móvil
son gates distintos; un verde sintético no es ProductREADY.
El pack necesita el lector servidor compatible antes de integrar/publicar el cliente.
El contrato de polaridad NightC es una dependencia de integración; esta rama no modifica
el trabajo ajeno ni declara verificada esa combinación.

Pruebas focales: `tests/fin17-confirmed-absorptions.test.mjs` (incluye ocho controles y
mutantes escritor/poda/ref-only) y `e2e/fin17-confirmed-absorptions.spec.mjs` (reapertura,
propietario y avisos H2). El mutante de reapertura FIN11 conserva su aserción y retira solo
la restauración pendiente dentro de la nueva composición, sin desactivar confirmadas.
