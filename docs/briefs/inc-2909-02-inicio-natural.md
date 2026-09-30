# INC-2909-02 · Inicio al desactivar Mi ciclo · 30/9/2026

## Reproducción y contrato

Rama separable `tanda/inc-2909-02-inicio-natural` desde main `12884f48107b82ffc8592c51180f2074a8546139`, candidata fuente 4.26.68. Antes del arreglo, el DOM en es/en/ca falla en los tres perfiles con modo Balance: tras desactivar Mi ciclo se espera 67 % con 600 € de compras y presupuesto 900 € tras reservar 100 €, pero el anillo presenta 0 %. El perfil Gastos pasa. En ciclo ambos tienen neto 20 €, consumo 2 % y margen 980 €. Importes y bancos ficticios, ninguna consulta de movimientos familiares.

`dashboardBudgetStats` alinea la tarjeta mensual de Inicio con su frase de gasto bruto. Pregúntame, los avisos de umbral y el reto de presupuesto usan el mismo consumo y margen para no dar respuestas incompatibles. Reutiliza las mismas filas y reservas; no fuerza el modo guardado ni convierte un balance positivo de Gastos en gasto. El ciclo mantiene su neto incluso negativo y el margen ampliado. La nómina deja de compensar visualmente las compras mensuales de Inicio; neutras, posibles repetidos y bancos no computables siguen excluidos. Un límite enteramente reservado con compras da anillo lleno y aviso de exceso. Sin presupuesto configurado se invita a configurarlo; sin actividad hay 0 % legítimo.

## Validación y límites

Suite Chromium de la candidata: **501 aprobados y uno omitido** (incluye 7 de rendimiento),
21 casos nuevos es/en/ca. Runner Node completo ejecutado: solo falla el desfase preexistente de
memoria-espejo; Deno local omitido. Presupuesto minificado/gzip dentro del tope, sin ampliarlo.
La guía continua se aclara a petición directa del dueño: leer/reponder Claude y tratar el rechazo
más reciente como veto a una aprobación anterior. `inc-3009-01-cargos` fue rechazado durante
esta tarea; gas desaparece pero dos recibos pagados siguen pendientes según su relato. PR76 no
se promociona; diagnóstico separado remitido a Claude y seguimiento prioritario del sucesor.

Primera regresión: tres casos rojos en modo Balance y tres verdes en modo Gastos sobre main original. Tras el arreglo, 22/22 E2E de Inicio/Gastos pasan, más el contrato `month-budget-stats`. El spec nuevo está registrado para Inicio en el mapa, y el motor exige suite completa. Se amplían los casos de límite, reservas y estados vacíos. Claude revisó `45d94d21` y emitió NO-GO: encontró que Pregúntame, avisos y reto todavía restaban la nómina mensual. Se corrigen los tres lectores y se ejecutan sus funciones reales con importes sintéticos; el efecto real de avisos confirma el agotamiento, la ausencia de repetición y el reinicio del ciclo. La suite completa anterior no sustituye la revisión del nuevo SHA. CI y publicación aún pendientes al escribir este corte.

El reporte familiar no incluía estado sanitizado: la reproducción prueba una causa concreta compatible con el relato, no que fuera la configuración exacta de esa cuenta. Hace falta validación móvil y OK específico de `inc-2909-02-inicio-natural` antes de main. No se modifica APK, Edge, SQL, saldos ni histórico; widget INC-2909-01 y nómina PR78 siguen separados.

## Canales al empezar

`npm run listo` sobre origin/beta `96b9210b` no puede leer veredictos: falta `SUPABASE_SERVICE_ROLE_KEY`. No consta aprobación nueva verificable. PR76 gas continúa en borrador; PR78 nómina está abierta, no revisada en este objetivo. No se promueve toda beta ni se repite Deudas.

HTTP y ZIP revalidados: producción 4.26.67, SHA-256 `4cc6e0ba97a2c9e7c23ece6affbfa23677fae920bc9413532631121f0e547b6d`, SW `4.26.67-2026-09-30-12884f4`, HTML/SW iguales a Pages; APK48 4.26.32. Beta 4.26.71.1, huella `bba29bcbdd912837`, ZIP SHA-256 `a6d5da1a52f449048694c49623826a34efaaaf64a18556fe8a7fca0c927204e3`, SW `4.26.71.1-2026-09-30-79b981a`, APK51 4.26.55. Sellos y APK del ZIP coinciden con manifiestos. Actions 36767159109/36764259812 SUCCESS; la documental mantuvo el bundle previo. Ocho tandas, todas pendientes salvo veredicto posterior identificable.

## Integración local beta

Fuente 4.26.73 en codex/inc-2909-02-beta desde beta96b9210b. La candidata de nómina PR78/4.26.72 no se integra aquí y debe renumerarse al integrarla después. Se trasladan exclusivamente los cambios de INC-2909-02 y se conservan las ocho tandas y el código ya presentes en beta. El rechazo móvil de recibos está confirmado; las cinco tandas nativas tienen OK histórico con un id versionado anterior y siguen sin APK estable51: Claude implementa su reconciliación en otra rama, sin borrarlas aquí.

Claude GO a candidata3912aa11 (árbol idéntico a74abbd78, unificado con su bump) e integración71b6e552. Verificó delta runtime idéntico, 193 notas anteriores conservadas, build limpia y contratos en local/UTC; tres mutaciones prueban que regresar cada lector al neto mensual rompe su guardián. Suite Chromium completa sobre integración71b6e552: **529 aprobados y uno omitido**, incluidos siete de rendimiento. Node completo: único fallo preexistente memoria-espejo; Deno local omitido. docs-frescura pasó sobre el SHA commiteado, sin ampliar los topes de descarga. CI y publicación todavía pendientes en este corte.
