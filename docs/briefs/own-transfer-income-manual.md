# Entrada bancaria como traspaso propio — candidata para revisión

En Gastos, la ficha de un ingreso bancario ofrece «Es un traspaso entre mis cuentas». La persona acredita la propiedad con ese toque: el nombre del movimiento nunca basta. No hace falta una pareja. Nómina y Bizum quedan excluidos, también si aparecen en el concepto o nombre original del banco.

Si existe una única salida exacta en otro banco propio (mismo céntimo, signo opuesto, hasta dos días civiles de Madrid), una opción sin seleccionar permite marcarla también. Una pareja ambigua, rechazada o no confirmable no impide decidir sólo sobre la entrada.

«Contar como ingreso» es una decisión nueva sólo sobre la entrada. La salida se cambia desde su propia ficha si hace falta. No es deshacer una operación conjunta ni recuperar una categoría histórica. Esta distinción permanece tras recargar y no necesita marcas nuevas en source.

## Dinero y persistencia

Sólo cambia cat: ingreso ↔ traspaso en la entrada; la salida opcional pasa a traspaso. Importes, signo, fecha, saldos, cuentas, reglas y referencias bancarias se conservan. No se aprende ninguna regla por el nombre. El traspaso neutro deja de devolver margen como ingreso.

Ejemplo sintético: límite 1.000, otros gastos 100, salida 80 e ingreso 80. Antes quedan 900. Sólo entrada neutra deja 820; ambas neutras dejan 900. Volver sólo la entrada a ingreso deja 980: es la nueva decisión individual solicitada, no restaurar ambas filas.

Cada fila usa UUID/owner y CAS sobre la foto remota, incluida nota y nombre original; exige ACK completo de una fila. La entrada se confirma primero. Sólo entonces se intenta la salida elegida y se vuelve a comprobar su identidad. Son dos operaciones independientes, sin atomicidad conjunta. Si falla la segunda, la entrada confirmada se conserva y aparece «Entrada guardada; salida sin confirmar». No se escribe una compensación que pueda pisar otra decisión. Timeout, cambio de propietario o modo pruebas impiden nuevas fases; una escritura ya enviada puede requerir Actualizar movimientos para conocer el resultado.

## Verificación aislada

Las pruebas se amplían en los ficheros ya registrados own-transfer-confirm de Node y navegador: entrada sin pareja, contrato de inversa, consentimiento opcional, céntimos/Madrid, exclusiones, CAS y ACK incompletos, parcial, recarga, fuente intacta y aislamiento de pruebas. En fixture sintética aislada: own-transfer-confirm 268 casos y persist-commit aprobados tras la corrección de replay de React; siete suites de presupuesto, finanzas, FIN19, categoría persistente, idiomas y seguridad aprobadas sin cambios posteriores en sus áreas. Playwright: 95 casos aprobados, sin omitidos ni reintentos, un trabajador. La prueba exige persistencia local completa, conserva dinero/cuentas y reproduce ACK parcial, recarga, inversa individual y modo pruebas. La revisión independiente de código de dinero y del ajuste de replay no tuvo hallazgos pendientes. Causal sobre la base 144506c: el mismo caso sin pareja falla por ausencia de la acción; la candidata lo supera en los tres idiomas. Revisión final de dinero e integración pendientes del integrador. CI, build oficial, beta servida y aceptación móvil reales pendientes. No cambios de servidor, schema, versiones ni catálogo.
