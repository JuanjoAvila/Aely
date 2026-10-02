# FEATURE-0210-01 · Gasolina y Taxi

Petición humana del 2/10/2026. Propietario: Codex, rama aislada `codex/feature-0210-01-gasolina-taxi`, candidata 4.26.85 sobre 3467bbd4fddcd213f862bedddac971c827099f3d. Borrador separable, sin publicación beta ni producción. APK80/code52 y Android intactos.

## Contrato y reproducción

Taxi no existía en CATEGORIES ni en ALLOWED del candidato base: no se cambia una identidad anterior. Combustible/taxi compartían Transporte. Apuntar ahora permite Gasolina ⛽ y Taxi 🚕; Gastos comparte esos IDs en filtros y límites. Nombres es/en/ca. Los apuntes ya guardados como Transporte/Otros y su límite permanecen: no hay migración ni reparto histórico.

La división vive solo en las altas nuevas. autoCategory conserva las reglas anteriores porque seedFlows reevalúa Otros antiguos. La elección personal gana a keywords/MCC, incluso Otros. Carburante/gasolinera explícitos y estaciones inequívocas permiten Gasolina; una marca Repsol sola conserva Transporte, Repsol Luz/Gas y Uber Eats conservan su finalidad. Recarga eléctrica sigue Transporte. MCC de tarjeta 5541/5542 y 4121 completan solo Otros genérico o una marca energética exacta sin finalidad. Metro, recarga eléctrica y Diesel jeans conservan Transporte aunque reciban MCC de combustible/taxi/supermercado. Un concepto reconocido y la elección manual conservan prioridad. Repsol recarga/carga eléctrica, recàrrega elèctrica y EV charging conservan Transporte; UBER *EATS/Uber-Eats/UberEats se reconocen como comida en altas nuevas. Correspondencias contrastadas con el [manual Visa](https://usa.visa.com/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf); el MCC no prueba qué se compró en una tienda con servicios auxiliares.

## Frontera servidor

El espejo de ingest y ALLOWED/HINTS de categorize se preparan solo en fuente, **sin despliegue**. No se ha consultado el hash ni tablas de Supabase vivo. El clasificador anterior aún puede dar Transporte a notificaciones nuevas; no se atribuye esta mejora a una captura Wallet nueva ni se reinterpretan sus filas guardadas.

El selector, filtro, límites y altas manuales/MCC web no necesitan ese despliegue. La migración 0001 define expenses.cat como text sin whitelist y las migraciones registradas no restringen esos IDs. El cliente cloud real escribe e.category y expenseFromRow conserva las categorías explícitas. No hay SQL nueva. En tests con BD simulada, alta/pull conservan gasolina/taxi aunque el comercio sea ambiguo. presupuesto.ts del SHA base cuenta ambos IDs como gasto diario, igual que el cliente. El handler real con clasificador del SHA base conserva una categoría elegida a mano tanto en retry con ACK como en conflicto de un alta manual. Son contratos de fuente, sin acreditación del servidor vivo.

## Revisión independiente y estado del corte

El SHA912652 se retuvo sin subir por NO-GO independiente: MCC podía pisar Metro/Recarga/Diesel y el helper confundía Repsol recarga eléctrica/UBER *EATS. La matriz nueva combina 35 pares merchant+MCC, 16 elecciones manuales+MCC y conceptos claros/redundantes, además del espejo TS. La fuente corregida pasa40 focales. DOM6 y panel63 del corte anterior **no acreditan este runtime nuevo**; se esperan revalidación bajolease42, guardian final y cotejo read-only de SHA corregido.

## Pruebas y estado

- gasolina-taxi registrado en run-tests: **40 contratos PASS**, cliente y TS real, overrides/MCC/negativos, seedFlows+migrate con histórico/límites inalterados, suma de categorías=presupuesto, cloud/pull y presupuesto anterior. Las tres traducciones cambian la huella funcional. El test contra 3467 falla Gasolinera Norte: Otros≠Gasolina (RED previo).
- e2e/gasolina-taxi.spec.mjs registrado en CROSSCUTTING: **6/6 DOM PASS en 61,35 s**, es/en/ca para selector, altas, negativos, filtros, límites y recarga; CLI0. Lease39 concedida y liberada expresamente. HTML probado SHA256 ae0aacaf2d403d1f1a1a8ed0a8fd5652af75d6a375dc1931a690772425ebd406. Puerto4285 sin listener, ningún servidor/navegador propio tras cerrar.
- Suite Node completa: 110 etapas en 1.736,8 s; se detectaron fallos durante desarrollo en beta-tandas-vacias, beta-veredictos, beta-sources e ingest-handler, corregidos y repetidos por separado en la fuente final. Memoria-espejo sigue fallando por desfase externo preexistente; no se modifica ni se presenta la suite global como verde. Deno y CI exacta pendientes.
- revisar-beta completo final **63/63 PASS en 3,0 min, CLI0**. Pasada inicial62/63: una consulta de producción iniciada por el panel de arranque podía terminar después de instalar los recibos del mock y sobrescribirlos; DOM ya mostraba10 restantes pero el cálculo puro veía17. Se espera la promesa cacheada ya iniciada antes de instalar el mock. Runtime y expectativas intactos; repetición completa63/63.
- Catálogo mixto real conservado: nueva tanda más las dieciséis previas; revisar-beta espera 17 modernas/18 con checklist implícita y actualiza IDs de entrega exacta. Sin aislar RELEASE_NOTES para ocultar el catálogo mixto.
- beta-sources final: 1.029 dependencias y 336 datos mutados; closure completa registrada, sin reducir dependencias ni repinar referencias históricas. beta-veredictos, beta-tandas-vacias e ingest-handler finales PASS. Revisión independiente/entrega beta/veredicto móvil pendientes.

## Huellas reales frente a 3467

Ocho IDs cambian por dependencia real. Los otros ocho existentes y **todas las superficies nativas** se conservan. Edge aquí significa fuente modificada, no función entregada. Las referencias originales y sus guiones permanecen; las aprobaciones previas no se trasladan al código cambiado.

| ID | Superficies cambiadas | Código actual |
|---|---|---|
| fin05-widget-reentrada | web | 642de2838d22a67a18200065a4cc338ad06d6d101484dcd407bcb2d11ea49ab5 |
| fin05-pago-cerrada | web+edge | ad05b911e9c45cb7fb4bcd5d8fa51e006630db000bd5b26d83ab7412ac1a4d77 |
| tr-descripcion-clasificacion | web | 9a0cabbd5f2d0ea4a4fa59c8de0eac182a6e70436ceb9acca5330dec1190782e |
| widget-banco | web | 54144ea1179d4ec1b5db078eb97e42d2dd830f577575849035acaafcb3f47f5a |
| widget-app-cerrada | web+edge | ad05b911e9c45cb7fb4bcd5d8fa51e006630db000bd5b26d83ab7412ac1a4d77 |
| inc-2909-02-inicio-natural | web | 07dad3d9cfb8ebf477553414d7a62de56482a8f50c946934ef3c523b8120c28b |
| inc-3009-nomina-anticipada | web | 1a86f54ee3558f0fe9e626ae039c0301dbc2c54eff76d4ef4f86bf39f160cce1 |
| inc-2909-01-widget-periodo | web | 6775c8fa478d735c4168dc3fbde093be1a12505e9c60f76fb299fc492237fcf2 |

## Tamaño y limpieza

A/B con mismo host/minificador y sellos comprobados 82.99/85.99: crudo 2.010.528 → 2.039.730 B (+29.202); minificado 1.292.833 → 1.294.402 B (+1.569); gzip9 351.893 → 352.423 B (+530); tres bloqueantes en ambos. El coordinador autorizó mínimos 1265/345 KiB por el catálogo/idiomas necesario, con margen final de 958/857 B. Guardián final PASS. Una integración conjunta exige A/B propia; no se suman autorizaciones.

Artefacto A sellado SHA256 e2e82418a3888065d463b0e7251e55cc326cf3dc81002c198af2afa337e4d21a; B sellado SHA256 51b30655303966f931402cad180f46e42c3b2f1e19fb88277edabad9bcb01844.

Sin datos reales, capturas privadas, sondas en raíz ni cambios de cuentas. Evidencia local sintética en test-results ignorado. Las copias temporales de tamaño se retiran tras registrar bytes y hashes; no se borran ramas/worktrees. Worktree/rama conservados. Este corte no certifica publicación.
