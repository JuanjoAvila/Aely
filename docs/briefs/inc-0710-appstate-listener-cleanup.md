# Reentrada por sesión · candidata100

Preparación local desde beta99/3aeed496, sin publicación. Portado exclusivamente el cleanup Promise del listener appStateChange del efecto dependiente de uid. La versión anterior buscaba remove sobre la Promise y no liberaba el handle nativo: cada cambio de sesión podía dejar otro callback vivo. Se libera el handle inmediato o tardío y se bloquea el callback retirado. Errores de alta/retirada no producen rechazos sin tratar.

Alcance acotado a cambios de uid; INC-2709-09 acumulativo sigue abierto. No se acredita que este defecto sea su causa general ni que afecte al uso continuado sin cambiar de sesión. OnVis y sus operaciones se conservan; sin APK, Edge, SQL, datos reales ni sincronización bancaria automática.

Registro nuevo independiente, sin repin de aprobaciones. Catálogo e identidades96/98/99 conservadas. Node causal y discovery DOM; ejecución DOM real y CI exacta pendientes. La integración requiere primero comprobar beta99 servida, revisión independiente y gates del coordinador.

Verificación local: Node causal pasa Promise inmediata/tardía, handle síncrono, errores de alta/retirada, ausencia de uid, callback retirado y contraprueba roja con fuente99. El registro cambia ante mutantes de cleanup/guardia. Mapas, catálogo220, notas/idiomas, sintaxis7bloques y privacidad verdes; discovery1DOM, cero DOM ejecutados. Las219 notas anteriores y sus guiones/revisiones coinciden exactamente con99, incluidas96/98/99. Presupuesto intacto: dev1317856B crudos/358941B gzip; sellado100.99999:1317867/358951B, márgenes21/473B y3bloqueantes. Artefactos finales regenerados dev; SW/APK intactos. Margen crudo estrecho, CI exacta obligatoria.
