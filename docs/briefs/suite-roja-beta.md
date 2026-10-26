# Suite roja en beta

Encargo `suite-roja-en-beta-codex-20261011`. Primera causa preparada sobre beta117
`c5f62d6603d016150afd9d0e20547b608b323045`; ese corte conserva su evidencia histórica.
La ejecución119 `788432f4682c199edd785f6973d9353330c0064a` conserva su CI38289139565:
1062 funcionales aprobados, una omisión, doce pases de rendimiento y un flaky recuperado
por retry1 en `rendimiento.spec:93` (fría17.0ms/caliente5.8ms frente a fría/3). No acredita
cero retries ni la campaña10×UTC/Madrid.
El corte122 `7fb69edd` conserva su CI38349261171 todavía en curso al rebasar, sin
veredicto terminal ni crédito de estabilidad para la fuente nueva. Su diagnóstico Node de caché
(0 parseos calientes y40.000 fríos, mutante detectado) tampoco acredita el comportamiento DOM.
Ejecución vigente rebasada sobre beta123 `3625fa7ed5134cfbc5e364adc4f588bfdaf670c0`
por señal expresa de Claude `4104af76` del13/10. Task y claim mantienen su base histórica8ad.
Se repiten Node, mutantes y checks ligeros sobre la nueva candidata; los resultados anteriores
no acreditan estabilidad de esta fuente.

## Transporte real de revisar-beta

El rojo de la antigua línea95 espera cero tandas después de volver online. La fase offline
anterior sólo esperaba que siguiera visible una tanda: esa era ya la lista pintada. El transporte
comparte la promesa en vuelo. Si la segunda vuelta ocurre antes de acabar la consulta offline,
recibe su respuesta anterior y no la entrega nueva; la velocidad de la red cambia el resultado.

Node reproduce ese orden con `12-boot.js` y `betaPruebasEntrega` reales: con el vuelo offline
detenido, la vuelta online comparte su promesa y conserva9.9.2 sin la tanda nueva entregada.
Después de terminarlo, una nueva vuelta consulta9.9.3 y acredita la entrega. Son versiones
sintéticas, no una publicación. No se cambia el contrato de compartir consultas en vuelo.

El spec ahora espera a que empiece y termine la consulta offline inicial. En la siguiente
fase detiene las respuestas, comprueba que arrancó otra consulta y que sigue pendiente,
la termina y sólo entonces cambia a online. No relaja ningún oráculo ni añade tiempo/reintentos.

`node tests/beta-prod-refresh.test.mjs`: tres comprobaciones pasan. Tres mutantes sobre
el transporte real salen conEXIT1: eliminar el vuelo compartido, quitar el rescate offline
y reescribir el recibo idéntico. Se registra el guardián en `scripts/run-tests.mjs`.

## Límites pendientes

- No se ejecutó Chromium local. La reserva de Claude retornó expresamente; la retención
  independiente FIN01 sigue comunicada por el supervisor, sin admisión de nuevos recursos.
- Falta ejecutar diez veces seguidas cada spec tocado y dos suites completas, UTC y Madrid,
  sobre una candidata congelada, con los slots y el cerrojo propios requeridos.
- Botnav-indicador y rendimiento siguen bajo diagnóstico; este cambio no los da por resueltos.
- Metas con `first_underbudget` y `first_reto` correlacionados correspondía al titular de
  Recibos revisión3. La base123 conserva la integración118, cuya aprobación y retiro comunicó
  Claude; su fixture financiero y su autoridad no se sustituyen con un mock de Suite roja.
- Los contratos y retiros heredados, incluido el catálogo actual123 y las lecturas históricas,
  se conservan íntegros; no se modifica el fixture financiero ni el formato de source nuevo.
- No se cambia VERSION, catálogo, notas, presupuestos de tamaño ni producto. Los topes
  publicados1352/372KiB llegan con la base123, sin ampliación propia. Sus posibles
  rojos de integración se declaran por separado, con cifras y el SHA que los produjo.
