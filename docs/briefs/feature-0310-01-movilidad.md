# FEATURE-0310-01 · Multas, Zona azul y Peajes

Petición humana del 3/10/2026. Candidata aislada 4.26.88 reservada por el coordinador, rama `codex/feature-0310-01-movilidad`, base b51b095d (Gasolina/Taxi85 implementadas). No incorpora Plan/Gastos ni Claude86/widget por asociación. Sin publicación beta/producción, APK, Edge, SQL ni pagos reales.

## Contrato

IDs aditivos `multas`, `zona_azul`, `peajes`; nombres es/en/ca, iconos 🚨/🅿️/🛣️ y colores ya existentes. Parking y Zona azul comparten símbolo de aparcamiento pero tienen nombre/ID/límite distintos. Apuntar, ficha, filtros, desglose y límites usan el catálogo común. Los apuntes de Impuestos y multas/Parking/Transporte/Otros y sus límites permanecen: no hay reparto histórico ni migración.

Solo altas nuevas: multas explícitas o sanciones de tráfico; zona azul/blava y estacionamiento regulado; peaje/peatge explícitos o toll road/payment. La sanción tiene prioridad sobre su lugar. Una administración, app de parking o autopista a secas no prueba un destino nuevo. Sanción administrativa conserva su categoría general previa. Negativos UberEats/Repsol Luz/Gas/recarga/Metro y selección manual prioritaria se conservan, incluso Otros y un MCC discrepante. `autoCategory` conserva sus reglas, pues `seedFlows` también lee Otros antiguos.

## Fuentes y fronteras

Espejo ingest y ALLOWED/HINTS de categorize preparados solo en fuente. Ninguna función desplegada ni cartera real consultada. Un servidor anterior puede seguir clasificando tasas/parking/transporte. `expenses.cat` es text sin whitelist en migraciones registradas; no requiere SQL nueva. La escritura cloud real y `expenseFromRow` conservan IDs explícitos, y presupuesto.ts del baseline los cuenta como gasto diario en pruebas sintéticas. `ingest-handler` ejecuta el handler con BD simulada y clasificador anterior para retry/ACK/conflicto: no pisa una categoría elegida. Esto no acredita RLS, estado Edge vivo ni captura Wallet nueva.

El alcance nuevo incluye catálogo, tres traducciones, clasificador, MCC, altas, selector/ficha/filtros, desglose/límites, escrituras cloud y lectura/sync de App. Registra también superficie Edge de ingest_logic y categorize: la web permite elegir las categorías, pero la entrega completa de clasificación servidor queda sin confirmar hasta recibo específico. Conserva alcances y referencias históricas; no repina ni inventa aliases. Cambios de huella legítimos deberán requerir revisión nueva.

## Verificación en curso

- RED contra b51b095d: `movilidad-categorias --source-ref` falla Multa DGT, tasas ≠ multas. Primero faltaba esbuild local; se reutilizó node_modules existente sin instalar dependencias y se obtuvo el rojo financiero real.
- Motor focal: 44 contratos PASS cliente/TS, negativos, manual/MCC, histórico/límites, suma diaria, presupuesto baseline, alta cloud/lectura y huella de nueve etiquetas.
- ingest-handler completo: 14 casos PASS; tres categorías adicionales probadas en retry y conflicto.
- DOM `movilidad-categorias.spec.mjs`: nueve casos registrados en CROSSCUTTING, es/en/ca. Pendiente de ejecutar con lease expresa canónica. `revisar-beta` mantiene el catálogo mixto completo: 18 modernas/19 con checklist implícita; entrega selectiva antigua deja once posteriores, sin ocultar tandas.
- Suite Node final, fullguard de alcances, A/B tamaño, SHA, PR y CI pendientes. No se presenta cierre global por contratos focales.

`npm run salud` local confirma VERSION/paquete y APK80/code52 alineados; red/sandbox impiden consultar Pages/release/APK y Supabase carece de credenciales. Sus refs locales no acreditan canales activos. Chromium permanece parado hasta cesión expresa; el coordinador escribe el lease. La petición inicial de mensaje fue rechazada por auto-review, el humano autorizó después coordinar ese chat y la reserva88 se confirmó expresamente.

## Integración posterior

Integrar solo después de SHA/revisión/pruebas finales, con Plan/Gastos85 preparada en otro chat. Serializar publicación; conservar entradas85 y anteriores, rechazo/retirada e identidades históricas. No promocionar producción ni desplegar Edge/APK por CI o por el PR. Aceptación móvil propia pendiente.
