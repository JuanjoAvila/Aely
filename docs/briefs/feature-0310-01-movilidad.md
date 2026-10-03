# FEATURE-0310-01 · Multas, Zona azul y Peajes

Petición humana del 3/10/2026. Candidata aislada 4.26.88 reservada por el coordinador, rama `codex/feature-0310-01-movilidad`, base b51b095d (Gasolina/Taxi85 implementadas). No incorpora Plan/Gastos ni Claude86/widget por asociación. Sin publicación beta/producción, APK, Edge, SQL ni pagos reales.

## Contrato

IDs aditivos `multas`, `zona_azul`, `peajes`; nombres es/en/ca, iconos 🚨/🅿️/🛣️ y colores ya existentes. Parking y Zona azul comparten símbolo de aparcamiento pero tienen nombre/ID/límite distintos. Apuntar, ficha, filtros, desglose y límites usan el catálogo común. Los apuntes de Impuestos y multas/Parking/Transporte/Otros y sus límites permanecen: no hay reparto histórico ni migración.

Solo altas nuevas: multas explícitas o sanciones de tráfico; zona azul/blava y estacionamiento regulado; peaje/peatge explícitos o toll road/payment. La sanción tiene prioridad sobre su lugar. Una administración, app de parking o autopista a secas no prueba un destino nuevo. Sanción administrativa conserva su categoría general previa. Negativos UberEats/Repsol Luz/Gas/recarga/Metro y selección manual prioritaria se conservan, incluso Otros y un MCC discrepante. `autoCategory` conserva sus reglas, pues `seedFlows` también lee Otros antiguos.

## Fuentes y fronteras

Espejo ingest y ALLOWED/HINTS de categorize preparados solo en fuente. Ninguna función desplegada ni cartera real consultada. Un servidor anterior puede seguir clasificando tasas/parking/transporte. `expenses.cat` es text sin whitelist en migraciones registradas; no requiere SQL nueva. La escritura cloud real y `expenseFromRow` conservan IDs explícitos, y presupuesto.ts del baseline los cuenta como gasto diario en pruebas sintéticas. `ingest-handler` ejecuta el handler con BD simulada y clasificador anterior para retry/ACK/conflicto: no pisa una categoría elegida. Esto no acredita RLS, estado Edge vivo ni captura Wallet nueva.

El alcance nuevo incluye catálogo, tres traducciones, clasificador, MCC, altas, selector/ficha/filtros, desglose/límites, escrituras cloud y lectura/sync de App. Registra también superficie Edge de ingest_logic y categorize: la web permite elegir las categorías, pero la entrega completa de clasificación servidor queda sin confirmar hasta recibo específico. Conserva alcances y referencias históricas; no repina ni inventa aliases. Cambios de huella legítimos deberán requerir revisión nueva.

## Verificación

- RED contra b51b095d: `movilidad-categorias --source-ref` falla Multa DGT, tasas ≠ multas. Primero faltaba esbuild local; se reutilizó node_modules existente sin instalar dependencias y se obtuvo el rojo financiero real.
- Motor focal: 45 contratos PASS cliente/TS, negativos, manual/MCC, histórico/límites, suma diaria, presupuesto baseline, alta cloud/lectura, edición cloud conservando los otros campos y huella de nueve etiquetas.
- ingest-handler completo: 14 casos PASS; tres categorías adicionales probadas en retry y conflicto.
- DOM final completo: 78 PASS / CLI0 / fail0 / skip0 / retry0 / flaky0, 278.536 ms, un worker bajo FEATURE47/puerto4488. Incluye nueve casos nuevos es/en/ca (altas/manual, filtros/límites/edición/offline, pull/reentrada), seis de Gasolina/Taxi y 63 de revisar-beta. El panel mantiene el catálogo mixto: 18 modernas/19 con checklist implícita; entrega selectiva antigua deja once posteriores, sin ocultar tandas. El primer pase dio 76 PASS y dos fallos del selector del test: la ficha usa «Las/Les 33», no «Todas/Totes». Se corrigió el selector dentro de la ficha y se repitieron los 78, sin cambiar runtime ni debilitar aserciones.
- Fullguard final completo PASS (CLI0): 1.134 dependencias de funciones y 372 de datos mutadas; cierre transitivo de 105 funciones/36 datos/13 miembros cloud. El primer intento detectó tres dependencias ausentes: se amplió solo el alcance nuevo y se repitió entero, sin reducir guardias ni cambiar los 17 alcances anteriores.
- A/B contra b51b095d, misma herramienta y sellado comparable: +926 bytes fuente, +621 minificados y +237 gzip. Candidata: 1.295.023 minificados / 352.660 gzip, bajo los topes existentes (márgenes 337/620 bytes). Los tres scripts bloqueantes se conservan; no se aumentan presupuestos.
- Suite Node general: 112 etapas / 1.840.965 ms, CLI1 por el primer beta-sources (corregido y repetido entero, CLI0) y memoria-espejo local desfasado. Deno no instalado: etapa omitida; no se acredita suite Deno local. Motor focal final repetido tras ampliar la edición cloud: 45 PASS; Gasolina/Taxi: 40 PASS. Sintaxis (siete scripts), privacidad, docs-frescura y relevant-tests finales CLI0. La CI exacta se solicita sobre el SHA del PR; estas comprobaciones locales no se presentan como suite global verde.
- Fuente de implementación: c35a92a9, sobre b51b095d. HTML ensamblado comprobado por HTTP y disco: SHA-256 `1c3debb8f41bdd4d46580ad0f09b23ff35ad37b10aad564181875d21de46d284`. Resultado final JSON y cierre de procesos conservados en test-results; listener4488=0/Chromium propio=0 y liberación expresa al coordinador tras terminar. Sin nuevo arranque tras liberar.

`npm run salud` local confirma VERSION/paquete y APK80/code52 alineados; red/sandbox impidieron consultar Pages/release/APK y Supabase carece de credenciales. Sus refs locales no acreditan canales activos. La reserva88 y la coordinación de ese chat fueron autorizadas expresamente; solo el coordinador escribe el lease.

## Integración posterior

Integrar solo después de SHA/revisión/pruebas finales, con Plan/Gastos85 preparada en otro chat. Serializar publicación; conservar entradas85 y anteriores, rechazo/retirada e identidades históricas. No promocionar producción ni desplegar Edge/APK por CI o por el PR. Aceptación móvil propia pendiente.
