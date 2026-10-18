# Night H: referencias BOOK en el histórico

Base: `ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13` (4.26.141).
Contrato autorizado: dos BOOK con referencias distintas de la misma cuenta, día,
importe y comercio conservan dos cargos. Caso sintético: 1250 + 1250 = 2500 céntimos.
Antes, el histórico conservaba 1250; invertir la entrada cambiaba el superviviente.
Esto demuestra un mecanismo de pérdida, no la causa del incidente real de CaixaBank.

El aplanado conserva referencias BOOK distintas y mantiene la elección previa para
legacy/PDNG. Reutiliza los ordinales del diario, incluidos los ya guardados, antes de
filtrar referencias conocidas. Así una lectura truncada con solo B no consume A ni
choca con su fecha al subir por el batch existente. La clasificación evita también
que otra referencia contabilizada aparezca como duplicado exacto o cercano.

Los ordinales y la cuenta acompañan ambos destinos de importación al serializador
existente. Los borrados con referencia reservan su ranura; las lápidas antiguas sin
referencia conservan su alcance. Se mantienen las absorciones acotadas por cuenta,
la ambigüedad frente a pendientes y el ACK del batch. La clasificación prepara las
fechas/ordinales de los candidatos antes de que la pantalla seleccione e importe.

Validación focal sintética: `tests/hist-book-reference.test.mjs`, registrada en el
runner, con 13 grupos en UTC/Madrid. Ejecuta los bloques reales de selección y alta
de la pantalla y el batch real con transporte local que reproduce la clave única;
no es DOM/E2E ni una llamada a Supabase. Cubre selección parcial, relectura truncada,
repeticiones y orden inverso, dos cuentas, ingresos, nube, diario, legacy, pendientes,
borrados y absorciones. Controles existentes: hist-uniq-por-banco, hist-import-dup,
hist-dia-local, hist-fecha-que-baila. Build, sintaxis, registro, privacidad y seguridad.

Seis mutantes semánticos: colapsar BOOK, comparar referencias distintas por contenido,
omitir ordinales existentes, omitir identidad de ingresos, omitir reserva de borrados,
omitir lápidas de absorción. Todos producen EXIT1 por aserción. La primera prueba de
reserva no mataba su mutante; se añadió la respuesta truncada que solo contiene C.
Se conserva ese EXIT0 inicial y el posterior EXIT1. Un error inicial del entorno de
pruebas (`uid` léxico ausente) se corrigió antes de obtener los RED funcionales; se
conserva como fallo de harness, no como evidencia causal.

Limitaciones: el tamaño minificado supera el límite 1328 KiB. VERSION, catálogo,
recibo de entrega beta y topes permanecen sin cambios. Integración, CI general,
DOM/CPU6, APK, beta servida y aceptación móvil no están acreditados. No ProductREADY.
El desacoplamiento balances/transactions queda en investigación + RED/propuesta;
no se modifica servidor, SQL, CLOUD_WRITES ni se despliega. PR265–273 quedan intactas.
