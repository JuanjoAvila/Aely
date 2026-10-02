# INC-0210-03 · Gastos por periodo · 2/10/2026

Propietario: Codex. Base3467bbd4fddcd213f862bedddac971c827099f3d, rama codex/inc-0210-03-gastos-periodo. Candidata4.26.84, sin publicación, revisión ajena ni aprobación móvil en este corte.

El reporte describe categorías del ciclo actual al elegir otro mes o fechas. La causa en fuente: la lista leía presetBoundsMs, mientras cabecera y categorías consultaban budgetPeriodOf sin esa elección. El contrato humano del2/10 prevalece sobre el comentario histórico del28/9 de cabecera fija.

La ventana explícita opcional de monthBudgetStats/categorySpentByMonth comparte fechas y conserva predicados de dinero, bancos diarios, ingresos netos del ciclo y reservas. Los lectores sin esa opción conservan su contrato. Gastos toma el mismo array diferido para cifras y lista. Rango local empieza a medianoche y termina al final del día; Mi ciclo acaba al final de hoy. Los filtros de búsqueda/categorías/bancos exploran sin redefinir el presupuesto.

No existe historial del límite ni presupuesto acumulado: fuera del mes/ciclo actual, margen y presupuesto se muestran como — con explicación es/en/ca. Se ocultan límites y barras de categoría fuera de su ventana aplicable; no se escala un límite mensual por días ni se inventa un presupuesto pasado.

Pruebas registradas: gastos-periodo en steps; gastos-periodo-categorias en E2E_MAP de Gastos. Datos sintéticos: meses con categorías distintas, rango con extremos incluidos, inversión/otro banco/duplicado excluidos, Bizum externo en neto, nómina sin doble suma y futuro fuera del ciclo. DOM abre el calendario real y las pantallas, en es/en/ca. Panel conserva catálogo real mixto y añade el ID propio; no se aíslan notas para esconder tandas.

Estado de verificación local: motor5periodos y fronteras PASS. Rojo DOM contra3467: al escoger Mes pasado falta Compras70€ (8,1 s); verde final5 DOM Gastos +7 panel real en es/en/ca (12/12,31,5 s). Regresiones de categorías/ayuda/Inicio y ciclo:32 PASS y1 captura opcional omitida (1,5 min). Sintaxis, idiomas, frescura documental, registro de pruebas, privacidad y presupuesto PASS. La guardia completa mantiene1075 mutantes de función y338 de dato; cierre propio100 funciones y33 datos, sin modificar el extractor. La CI exacta se acredita en el PR y el relevo, no se presume por estas pruebas locales. Sin APK, instalación, Edge, SQL, cambios de datos reales ni producción. La validación del caso familiar requiere prueba móvil después de entregar beta.

A/B sellado82.99→84.99 contra3467, mismo host/minificador y gzip9:1.292.833/351.893→1.294.456/352.299 B (+1.623/+406). Topes mínimos1265/345 KiB autorizados por coordinador:904/981 B de margen y3 ficheros bloqueantes iguales. Una integración conjunta requiere su A/B propio.

El cambio opcional del motor invalida legítimamente las huellas web de fin05-widget-reentrada, fin05-pago-cerrada, widget-banco, widget-app-cerrada, inc-2909-02-inicio-natural, inc-3009-nomina-anticipada, inc-2909-03-retirada e inc-2909-01-widget-periodo. Referencias históricas y guiones ajenos conservados; no se fabrica equivalencia, entrega nativa ni aprobación nueva. La compatibilidad955 se prueba sobre su fuente Git real, no sobre un motor cambiado.

Reserva Chromium38 liberada EXPRESAMENTE: CLI0, servidor4252 sin listener y sin navegador scoped. HTML DOM final SHA-256:1e59ed424046bc995d74a273d1bcb30c793112df6a456f0118771b00d839a281. Copia temporal para A/B eliminada; quedan solo informes ignorados de pruebas, sin sondas ni ramas/worktrees borrados.
