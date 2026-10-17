# SEC-02 · frecuencia de Open Banking

Fuente candidata contra `main a9916c3cdb21c93f9d3a47653c0608e630ce50ab`.
GO causal de Claude: `5267ceb4005ecb98b37da2f8e4efbb280fb85c33`, mensaje
`coordinador-17-10b-go-inc0410-ops08-sec02-ux290904`. Sin despliegue.

Las tres funciones no llamaban al limitador. En el ROJO previo, una RPC sintética
configurada para denegar nunca era consultada: connect emitía `/auth` y escribía
pending; sync diario/histórico llegaba al banco; callback canjeaba `/sessions` y
escribía el enlace. Tres contratos fallaban, con siete controles correctos.
Veinte connect concurrentes llegaban veinte veces al proveedor. Evidencia local
sintética; no acredita el estado desplegado.

## Contrato aprobado

| Ruta | Bucket estable | Máximo / ventana | Lugar del freno |
|---|---|---|---|
| bank-connect | `bank-connect:<user>` | 10 / 600 s | Tras getUser, antes de firmar, `/auth` y upsert |
| bank-sync | `bank-sync:<user>` | 30 / 600 s | Antes de leer enlaces, aplicar acuses o consultar el banco; diario e histórico comparten cuota |
| bank-callback | `bank-callback-ip:<hash>` | 60 / 60 s | Antes del lookup de state |
| bank-callback | `bank-callback:<user>` | 10 / 600 s | Tras state conocido/no caducado y antes de consumirlo |

Se reutilizan `rateLimit`, `bucketKey`, `callerIp` y la RPC de la migración 0019.
El contador persiste entre isolates. La RPC usa un UPSERT atómico por bucket;
las pruebas de concurrencia usan un modelo de esa sentencia, no Postgres vivo.
Su ventana reinicia cuando el inicio es estrictamente anterior a `ahora-ventana`,
no en la igualdad. No es una ventana deslizante exacta ni un bloqueo de concurrencia.

Connect/sync devuelven 429 con `rate_limit`, conservando CORS. Callback mantiene
302 por el retorno de error existente: `?bank=error&msg=error` para web y
`back.html?msg=error` para APK. Usa el código genérico cerrado ya traducido;
no añade códigos, textos de proveedor ni rutas de UI. Denegar no consume state,
modifica enlaces/cursores ni inserta app_events, y no toca al proveedor.

Se conserva el fail-open del helper ante error/excepción de la RPC, con su log
de código cerrado. Sin migraciones, cambios de RLS, purga, secretos ni cambios
de sincronización: Open Banking sigue solo a demanda. El histórico serial puede
pedir un banco por invocación; treinta intentos no equivalen a treinta llamadas
PSD2, porque hay varias cuentas/páginas por sync. La cuota es un freno Edge,
no una garantía del límite de cada banco. La IP depende de cabeceras del proxy;
su hash minimiza datos guardados, pero no autentica ni acredita confianza en
esas cabeceras. Se conserva la identidad IP que ya usa ingest.

## Inventario y pruebas

0019 crea `rate_limits`, `check_rate_limit` y la purga manual. Solo service_role
ejecuta la RPC; la tabla no expone políticas al cliente. El helper es el único
escritor de funciones Edge; los triggers/funciones SQL de 0022 y 0023 también
usan la RPC. `prune_rate_limits` borra ventanas antiguas manualmente.

Lectores Edge previos: ingest 60/60 por hash IP; myinvestor-connect 10/600 por
usuario; categorize 40/600; help-assistant 15/600, 30/día por usuario y 1000/día
global; myinvestor-sync 2/21600 por versión del contador; prices tiene una
propuesta 30/600 apagada por defecto. Este cambio no altera esos contratos.

`node tests/bank-sync-paging.test.mjs` ejecuta también
`tests/helpers/bank-rate-contracts.mjs`, sin crear un test huérfano del runner:
nueve grupos para límites/fronteras/usuario/concurrencia, diario-histórico-acuse,
IP hash, state, CORS, retorno web/APK, autenticación, preflight y fail-open.
Doce mutantes deben morir: ignorar cualquiera de los cuatro frenos, elevar sus
límites, mezclar usuarios, cambiar ventana, consumir state al denegar y sustituir
el 302 del callback por un 429. Se ejecutan los handlers actuales y el helper
real; SDK, RPC y transporte están simulados y sin red.

Los bancos sintéticos de reconexión, paginado, cursores y privacidad cargan el
helper actual y permiten la cuota mediante su RPC sintética: esos escenarios
siguen probando integridad financiera, mientras el contrato SEC-02 sí cuenta.

Documentación actual consultada: [Functions/Auth](https://supabase.com/docs/guides/functions/auth-legacy-jwt),
[límites recursivos](https://supabase.com/docs/guides/functions/recursive-functions)
y changelog, incluida la retirada CBC TLS anunciada el 12/10/2026. Los límites
recursivos de la plataforma no cubren peticiones entrantes ni proveedor externo.

## Límites de entrega

No acredita Deno, Postgres real, CI general, Edge desplegadas ni aceptación
móvil. El doble canje concurrente del mismo state sigue siendo un hallazgo
independiente, SEC-03: esta cuota no garantiza consumo atómico. Claude pidió
investigarlo tras SEC-02 y consultar antes de producto; no está reparado aquí.
No cambia VERSION, catálogo, caps, oráculos financieros, Deudas/Metas ni cliente.
El despliegue de estas tres funciones corresponde a Claude, por separado.
