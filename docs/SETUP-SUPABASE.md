FIN-15 (candidata, 16/10/2026): `filasComoLaApp` deduplica una referencia bancaria estable
por banco + `#ref`, aunque cambie el día al contabilizar. Aplica `deleted` y `ob-absorbed`
antes de consumir la referencia; conserva el comportamiento de filas antiguas sin `#ref`.
Month legacy y widget v2 comparten el lector. **Claude despliega ingest ANTES del cliente**
y verifica la fuente desplegada; esta candidata no acredita ese despliegue. Sin SQL ni migración.
Referencias diferentes entre días sin alias estable siguen siendo filas distintas.

Promoción117: inventario12/10 confirma bank-syncv33 alineado; ingestv50 y pricesv13 se prueban con fuentes desplegadas exactas y transportes sintéticos en prod117-edge-compat. SEC02/ingest-widget viajan como fuente sin despliegue ni anuncio de funciones activas. [Pins y límites](briefs/prod-completa-117.md).

Compras4 (15/10/2026, candidata PR235): la absorción de un BOOK tras lectura truncada guarda
una lápida `ob-absorbed|banco|referencia|ordinal` en `app_state.deleted`. Los dos primeros valores
van codificados con `encodeURIComponent`; el ordinal identifica la ranura sin depender de nombre
o importe corregidos después. `filasComoLaApp` en
`_shared/presupuesto.ts` debe reconocerla tanto para month como para widget. Orden de integración:
**desplegar ingest con este lector antes de publicar el cliente**, verificar sus fuentes exactas
y después validar ambos sobre las mismas filas sintéticas. El servidor nuevo conserva filas y
lápidas legacy; un servidor anterior ignora el nuevo marcador y puede seguir sumando la fila
absorbida. No requiere SQL, migración ni secretos. Esta entrega cambia solo fuente y pruebas;
no despliega ni acredita funciones vivas. El cambio de referencia entre días queda fuera.

# Setup Supabase — Fase 1 (Aely)

## MyInvestor: contador consecutivo · candidato sin desplegar (14/10/2026)

`0026_myinvestor_access_counter.sql` añade, de forma idempotente, dos UUID internos:
`connection_version` cambia al conectar; `access_counter_version` cambia al conectar y al
completar una lectura buena. El bucket de `rate_limits` incluye la versión del contador:
cambiarla deja el contador activo en cero sin borrar buckets de otras peticiones. Las filas
anteriores quedan inertes para el nuevo sync y conservan la limpieza manual de 0019.
No cambian el límite de dos fallos antes del aviso del tercero ni la ventana de seis horas.

Sólo `userInitiated:true` cuenta un `access_401_after_refresh`; la ausencia del argumento,
`false` y otros valores se consideran automáticos. El cron keepalive no cuenta ni cambia la
versión del contador. Una lectura buena, manual o automática, lo reinicia. El cliente pasa
`true` en el botón de la hoja y en Actualizar manual; la apertura suave pasa `false`.

El refresco y el recifrado legacy se condicionan a la versión de conexión. Caducar y reiniciar
el contador exigen además la versión del contador que se leyó al entrar. Si otra lectura buena
ya lo cambió, sync sella `last_sync` con la sola guarda de conexión, sin volver a cambiar el
contador ganador ni borrar sus fallos posteriores. Cero filas en ese segundo UPDATE rechaza
las posiciones antiguas por reconexión real; no se usa un SELECT previo como acuse. Si falla
el sello por error devuelto o excepción, responde `ok:true` con las posiciones leídas y
`code:counter_not_saved`: no acredita reset ni sello persistidos. Las escrituras comprueban
el error y una fila devuelta: cero filas nunca acredita un reset o caducidad.
No se da `connected:true` si falla el guardado de una reconexión. Los grants nuevos son sólo
de columna para `service_role`; no se añaden tablas, funciones RPC ni políticas RLS.

Orden seguro, **pendiente de revisión y ejecución del coordinador**:

1. Revisar y aplicar `0026_myinvestor_access_counter.sql`, sin crear otra migración. Antes de
   confirmar, probarla dentro de `BEGIN`/`ROLLBACK`: ejecutar su SQL existente en esa transacción,
   comprobar columnas, idempotencia (segunda ejecución) y privilegios; terminar con `ROLLBACK`.
   Esta prueba no aplica la migración definitivamente. Comprobación de privilegios propuesta
   (cada fila debe devolver `false` en las tres columnas de permisos):

   ```sql
   BEGIN;
   -- Ejecutar aquí el contenido revisado de 0026, dos veces, sin COMMIT.
   SELECT col,
     has_column_privilege('authenticated', 'public.myinvestor_links', col, 'SELECT') AS puede_leer,
     has_column_privilege('authenticated', 'public.myinvestor_links', col, 'INSERT') AS puede_insertar,
     has_column_privilege('authenticated', 'public.myinvestor_links', col, 'UPDATE') AS puede_cambiar
   FROM (VALUES ('connection_version'), ('access_counter_version')) AS columnas(col);
   ROLLBACK;
   ```

   Si aparece `true`, revisar también grants de tabla/heredados: un REVOKE de columna no quita
   un permiso concedido a toda la tabla. No seguir al despliegue hasta resolverlo. La aplicación
   definitiva de 0026 se hace después por el circuito de migraciones autorizado.
2. Desplegar `myinvestor-connect` con las columnas ya disponibles.
3. Publicar el cliente con `userInitiated` explícito en **beta y después en producción**;
   comprobar la entrega efectiva en ambos canales.
4. Desplegar `myinvestor-sync` **sólo cuando ese cliente ya esté en producción**. El cliente
   anterior no señala manualidad: con el sync nuevo no suma los fallos del usuario y pierde
   la oferta de reconectar al tercero. Una beta con el argumento no cubre producción.
5. Mantener `myinvestor-keepalive` **sin redesplegar** en esta tanda.

Sync sin migración devuelve `counter_not_available` sin llamar al banco. Quedan en BACKLOG,
fuera de esta PR, la guarda de conexión del refresco en keepalive y la purga de los buckets
versionados de `rate_limits`; no se modifica ni ejecuta ninguna de esas operaciones aquí.
Rollback de Edge/cliente: volver a las fuentes anteriores; conservar las columnas aditivas.
La vuelta al sync antiguo recuperaría su contador antiguo acumulado: no acredita contador cero.
SQL, advisors y aceptación bancaria/móvil reales no se han ejecutado en este encargo.

`ingest/widget.ts` calcula la respuesta widget v2 de la ventana guardada
por la app, validando ancla y scope; month conserva su payload mensual legacy para APK antiguas.
El total v2 requiere conteo exacto, páginas completas con identidades únicas y el pago visible.
Conteo ausente/cambiante, consulta fallida o truncada y pago ausente devuelven `widget:null`.
El cálculo opcional de `widget` se ejecuta después del aviso de presupuesto y en su propio
bloque de errores: una excepción de paginación o cálculo conserva `month` y `alert` para las
APK anteriores. El rechazo de páginas parciales tiene un límite de consultas en su doble de
prueba, para que su eliminación falle en lugar de dejar el runner en bucle.
La matriz contra Inicio distingue presupuesto ausente (scope null) de todo reservado (scope 0,
con margen conocido). V2 aplica el filtro por categoría de Inicio también a filas con marca
de cuota; el cálculo de month legacy no cambia. La marca por sí sola no sustituye una categoría
explícita de ese lector. Esta fuente se valida con datos sintéticos, sin modificar gastos.
El listener admite ambos contratos. No requiere secretos, esquema ni migraciones nuevos.
El despliegue de ingest se ejecuta mediante el workflow manual `supabase.yml`, con migraciones=no.
Un push no activa ese workflow. Validación sintética en
`ingest/widget.test.ts` (Deno registrado) y handler real con BD en memoria; no llamar al ingest
activo con pagos de prueba. Contrato/limitaciones nativas en [Setup Android](SETUP-ANDROID.md).

FEATURE-0210-01: ingest_logic y ALLOWED/HINTS de categorize incorporan Gasolina/Taxi solo en fuente de la candidata85. No se ha desplegado ninguna función ni se ha consultado el hash/BD de Supabase vivo; el clasificador anterior puede seguir dando Transporte hasta un gate de despliegue específico. El catálogo/selector/filtros/límites y altas manuales/MCC web funcionan sin despliegue; las notificaciones clasificadas por el servidor anterior aún pueden entrar como Transporte. La migración0001 define expenses.cat como text sin whitelist y las migraciones registradas no la restringen; no requiere SQL nueva. Tests sintéticos ejecutan alta cloud/pull con ambos IDs, presupuesto.ts del SHA3467 y retry/ACK/conflicto de ingest con clasificador de ese baseline: preservan elección manual y cuentan categorías diarias. Esto prueba fuente/contratos, no estado vivo ni captura Wallet nueva.

## Apuntes iguales con ordinal (12/10, rama `claude/tr-iguales-ordinal`): `ingest` ANTES que la web, nunca después

Cambia solo `_shared/presupuesto.ts` (`ordinalDeSource`, `claveComoLaApp` con el sufijo `|#n`, y
`bancoDeSource` leyendo `ob-hist:…#n2` con el banco limpio). La única función que lo importa es
`ingest`, así que es la única que hay que desplegar: sin migración ni secreto. Orden obligatorio:
**`ingest` primero, o a la vez que el cliente; nunca después**. El servidor nuevo sobre filas de
clientes viejos (sin `#n`) devuelve EXACTAMENTE lo mismo que el servidor anterior (probado en
`ob-iguales-ordinal` y `widget.test.ts`), así que desplegarlo antes es inocuo. Al revés no: con el
cliente nuevo y el `ingest` de hoy, el servidor funde las k filas iguales en una y el widget deja
de cuadrar con la app (36 o 48 frente a 60 en la sonda de la revisión). Rollback: desplegar el
`ingest` anterior; las filas con `#n` se leen con el banco de siempre y solo pierden la separación.

## Cargo de recibo en Gastos (13/10, rama `claude/recibo-banco-no-acredita`): `ingest` DE ESTA RAMA antes que su web

El `ingest` del ordinal lee el banco LIMPIO también en `ob:<ent>~recibo.<id>` (`bancoDeSource`),
así que ese servidor, tal cual, CUENTA el cargo de un recibo que la app no cuenta. El servidor
desplegado antes del ordinal lo dejaba fuera sin saberlo (leía un banco inexistente); el del
ordinal ya no. Por eso esta rama añade a `_shared/presupuesto.ts` `esCargoDeRecibo` y lo excluye
en `cuentaParaPresupuesto`. Orden obligatorio: **desplegar `ingest` desde esta rama antes, o a la
vez, que su web**. Es inocuo adelantarlo: hasta que salga la web no existe ninguna fila
`~recibo.`. Al revés, el widget suma cada recibo cobrado (medido en test: 200,40 frente a 3,40).
Sin migración ni secreto. No se ha desplegado nada.

**Condición de publicación (revisión del 13/10).** No es solo el servidor: un MÓVIL con la
4.26.120 (ordinal sin esta entrega) lee `ob:<ent>~recibo.<id>` con el banco limpio y cuenta el
cargo (102,40 frente a 40 en la sonda), y al reescribir la fila le borra la marca. Mientras la
120 esté solo en beta no hay filas `~recibo.` y no pasa nada; el riesgo es tener en producción
la 120 y, en otro móvil de la misma cuenta, esta entrega. **La 4.26.120 no se promociona a
producción sin esta entrega**, y el `ingest` de esta rama va antes que su web.

Integración (13/10): la rama entra en la candidata 4.26.122, encima de la 4.26.121, que lleva
dentro la 120. El `ingest` que se despliega es el de la 122 (`_shared/presupuesto.ts` con
`esCargoDeRecibo`), antes que su web, y ni la 120 ni la 121 van a producción sin la 122.

## Integración 4.26.127 (14/10): bancos, cuatro funciones Edge SIN desplegar

Reúne tres ramas (falsa caducidad `2d53ab24`, PR 226 `e677099f`, PR 223 `c71129e1`) sobre la 4.26.126. Funciones que cambian respecto a la producción 4.26.126: `bank-sync`, `bank-disconnect`, `myinvestor-sync` y `myinvestor-keepalive`, más los compartidos `_shared/enablebanking.ts` y `_shared/myinvestor.ts` (los importan, así que se despliegan una a una con sus dependencias). No hay migración (el limitador de MyInvestor reutiliza el de la 0019) ni secreto nuevo. Orden recomendado: `myinvestor-sync` y `myinvestor-keepalive` comparten la regla de caducidad, así que van juntas; `bank-sync` y `bank-disconnect` comparten el guard de sesión y `state_issued_at`. Un cliente anterior ignora los campos nuevos de `bank-sync`; el cliente nuevo con la Edge anterior conserva el aviso genérico de descarga incompleta. Rollback: volver a la fuente de `33d39cb8`; no borra ni restaura datos. Los detalles de cada rama siguen en las secciones de debajo.

## Desconexión y carrera con callback (13/10): candidato, SIN desplegar

`bank-disconnect` reutiliza `decryptSessionId` de `_shared/token_store.ts`, también empleado
por la rama de falsa caducidad de Claude, y codifica el id antes del DELETE. Si falla, el
diagnóstico conserva sólo `step`, estado HTTP y código cerrado (`ebFailure`, `DESCIFRADO` o
`SIN_CODIGO`); el borrado local permanece aislado por usuario/banco y no depende de ese registro.
`bank-sync` condiciona exclusivamente su UPDATE final a sesión y `state_issued_at` originales,
con `IS NULL` para filas antiguas. No cambia cifrado, clave, schema, RLS, callback, acuses ni
el resto de escrituras de cursor. No requiere migración ni secreto nuevo.

Dependencia de ejecución autorizada: `claude/brokers-falsa-caducidad`,
`2d53ab24dc32a83faf17ce08c3b2d50b304d8e55`, reaplicada sobre beta124 (`f5904735b`).
No acredita despliegue de esa dependencia.
Las superficies candidatas son `bank-disconnect` y `bank-sync`; cualquier despliegue lo decide
el coordinador tras revisión. Rollback de estas dos modificaciones: su fuente en2d53ab24,
sin borrar o restaurar datos. [Pruebas y solapes](briefs/bancos-revoca-callback-20261013.md).

## Avisos de descarga incompleta (13/10): candidato en fuente, SIN desplegar

`bank-sync` y `_shared/enablebanking.ts` añaden el motivo cerrado de interrupción/topes y su
diagnóstico en `app_events`. El cliente conserva el extracto incompleto y distingue los avisos
en tres idiomas. No hay migración, secreto, cambio RLS ni nueva consulta al banco; no se amplían
plazos o límites. El catch de autenticación reservado al candidato de falsa caducidad permanece
idéntico. El despliegue corresponde al coordinador después de revisión y prueba beta.
Cliente anterior ignora los campos nuevos; cliente nuevo con Edge anterior conserva el aviso
genérico cuando no llega motivo. Rollback de fuente: volver al padre123; no elimina estado ni
modifica la forma de acuse119. [Alcance y pruebas](briefs/bancos-descarga-incompleta-20261013.md).

## bank-sync con tramo antiguo (INC-2709-06): solo en fuente, SIN desplegar

`bank-sync` y `_shared/enablebanking.ts` (parámetros `maxPages` y `dateTo` de `fetchBankTransactions`)
cambian para recuperar el tramo anterior a la ventana del sync a demanda; el detalle está en
`ARQUITECTURA.md`. No hay migración, secreto ni función nueva: `last_sync` hace de cursor. Orden de
despliegue: primero `bank-sync` (solo esa función) y después el cliente. Los cuatro cruces son
seguros: la función nueva con cliente viejo entrega la ventana de siempre, y el cliente nuevo con
la función vieja manda un campo que esta ignora y no recibe `syncFrom`, así que no guarda nada
anterior a su margen. Rollback: desplegar el `bank-sync` anterior; un cursor sellado que quede en
`last_sync` es una fecha válida para él.

## Acuse del cursor y reconexión que lo conserva (12/10): solo en fuente, SIN desplegar

Cambian `bank-sync` (acuse, `ackLinkKey`; con cliente de acuse y `last_sync` nulo escribe la
víspera de la ventana como punto de partida, mirando el error de esa escritura y reintentándola una vez), `bank-callback` (no pone `last_sync` a null si
vuelven las mismas cuentas; guarda `hash` en `accounts`; si el GET de la sesión falla sale con
`msg=error` sin tocar la fila) y `bank-connect` (solo un comentario). Sin
migración ni secreto: la clave del acuse usa `state_issued_at` (0019) y `accounts` es jsonb.
Los cruces están probados en `bank-sync-acuse` y `bank-reconnect`: función nueva con cliente sin
`acks` escribe el cursor como antes; cliente nuevo con el `bank-sync` desplegado no recibe `ack`
y no guarda nada; `bank-callback` nuevo con el `bank-sync` desplegado recupera el hueco. Orden
recomendado: `bank-sync`, después `bank-callback`, y por último el cliente. Ojo con
`bank-callback` antes de que producción tenga el cliente con `recoverGaps`: ese cliente no
recupera el tramo y, con el cursor conservado por detrás de la ventana, su `last_sync` no sube
hasta que actualice. Rollback: desplegar las funciones anteriores; los acuses guardados en los
móviles se ignoran y un `hash` de más en `accounts` no molesta.

## bank-sync desplegado para beta 4.26.53.1: concepto y MCC opcionales

El cambio en `_shared/enablebanking.ts` añade concept separado de la descripción bancaria y MCC opcional normalizado; mantiene signo, identidad, merchant, note y contrato anterior. Lo consume bank-sync en diario e histórico. No exige migraciones, secretos, nuevas llamadas al proveedor ni cambios en ingest. Desplegado con autorización explícita el 26/9/2026: únicamente bank-sync, migraciones=no, [Action 36271682736](https://github.com/JuanjoAvila/Aely/actions/runs/36271682736), SHA 7839acb769fb9175434a1b652be3917faab02261. La etapa de migraciones fue omitida; el log confirma solo bank-sync. Servicio compartido con producción, cliente publicado solo en beta. El despliegue previo comprobado fue Action 35978144828, SHA f53e865277f676998d76844fd047357f4adc1569. Comparados bank-sync, enablebanking y cors (sus imports locales) contra ese SHA, solo cambia la adición de estos campos. Rollback por ese SHA. No usar despliegue general. Cliente antiguo ignora los campos; cliente nuevo conserva la clasificación previa sin ellos. No se promete que TR real entregue datos útiles.

## Bank-sync 4.25.0: desplegado y comprobado

La corrección del paginado de `bank-sync` quedó comprobada el 24/9/2026 con datos reales de
CaixaBank: los movimientos de agosto, incluidos unos 100 €, ya estaban en Gastos. Por eso repetir
«Importar histórico» no ofrecía filas nuevas; no era una pérdida de datos. No hay backfill ni se
borran filas existentes. Para rollback, desplegar el `bank-sync` anterior.

Guía paso a paso para arrancar las tripas en la nube. Lo que tú haces (una vez) va marcado con 👤.
El código (esquema, funciones, CI) ya está en el repo dentro de `supabase/`.

## Arquitectura objetivo

```
[Notificación TR en Android]
        │ MacroDroid
        ▼
[Edge Function: ingest]  ──►  [Postgres: tabla expenses]
                                      ▲
[App PWA] ── @supabase/supabase-js ───┤  (login magic-link, RLS por usuario)
        │                             ▼
        └──► [Edge Function: prices] ──► Finnhub   [Postgres: tabla app_state (JSONB)]
```

- **Auth:** magic link por email (Supabase Auth).
- **Datos:** gastos en `expenses` (relacional) + resto del estado en `app_state` (JSONB, una fila por usuario).
- **RLS activado:** cada usuario solo ve lo suyo. La función `ingest` usa la service role key para escribir tus gastos sin sesión.

---

## Paso 1 — Crear el proyecto 👤

1. Entra en https://supabase.com → **Start your project** (gratis, sin tarjeta).
2. **New project**: nombre `mi-cartera`, región Europa (ej. *West EU / Ireland*), genera una **Database Password** y **guárdala** (la necesitas para CI).
3. Cuando termine de provisionar, ve a **Project Settings → API** y apunta:
   - **Project URL** → ej. `https://xxxxxxxx.supabase.co`
   - **anon public key** (clave pública, va en el cliente)
   - **service_role key** (SECRETA, solo backend)
   - El **Project Ref** es el `xxxxxxxx` de la URL.

## Paso 2 — Crear el esquema 👤

Opción rápida (recomendada la primera vez): **SQL Editor → New query**, pega el contenido de
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) y dale a **Run**.

(En CI, `SUPABASE_DB_PASSWORD` solo habilita migraciones si se selecciona expresamente `migraciones=si` al lanzar el workflow manual; revisar previamente el SQL.)

### Migración 0019 — límite de peticiones y caducidad del `state` (4.10.0)

`0019_rate_limit.sql` añade la tabla `rate_limits` (sin políticas RLS a propósito: NADIE llega desde
el cliente, solo la service_role a través de `check_rate_limit`) y la columna
`bank_links.state_issued_at`.

Qué frena y por qué:

| Función | Límite | Motivo |
|---|---|---|
| `ingest` | 60/min **por IP** | No pide sesión; su única credencial es un token. Sin freno se prueban tokens a la velocidad de la red. Por IP y no por token: contar por token no frena a quien va probando tokens distintos, que es justo el ataque. |
| `myinvestor-connect` | 10 cada 10 min **por usuario** | Por ahí van el usuario y la CONTRASEÑA reales del banco. Un bucle de reintentos puede dejar al usuario **bloqueado en su propio banco**. |
| `prices` | **sin cuota activa** (SEC-02) | Propuesta documentada 30/600 por usuario (`PRICES_RATE_PROPOSAL`) **apagada por defecto**. No confundir con `categorize`/`help-assistant`. 30×25 fetches no protege Finnhub ~60/min. Ver [brief](briefs/sec02-prices-limites.md). Activar exigiría autorización + `PRICES_RATE_LIMIT=1` en deploy aparte. |

**Si la migración no está aplicada, no se rompe nada**: `rateLimit()` deja pasar y lo apunta en la
consola de la función. Un freno de seguridad que tumba la app cuando se rompe convierte un incidente
pequeño en uno grande.

`state_issued_at` la escribe `bank-connect` y la lee `bank-callback`: la autorización del banco
caduca a los 30 minutos y el `state` se **gasta** al usarlo. Los enlaces creados antes de esta
migración no tienen marca y se dan por buenos, para no romper una reconexión a medias.

### Migración 0025 — identidad idempotente de notificaciones (4.26.6)

`0025_expenses_ingest_event.sql` añade `expenses.ingest_event_id` y un índice único parcial por
usuario. No hace backfill ni toca movimientos anteriores. El lector Android nuevo manda la
identidad estable del evento y `ingest` la confirma solo cuando la fila existe; una reentrega o
una carrera concurrente recupera la fila anterior en vez de crear o anunciar otro gasto.

Despliegue obligatorio, en este orden: **migración 0025 → Edge `ingest` → APK nueva**. La Edge
tolera clientes antiguos sin `ingest_event_id`, pero una OTA sola no puede corregir la identidad
que genera el lector instalado. Para el histórico de CaixaBank se despliega además `bank-sync` y
después el cliente web que invoca un banco por petición. No afirmar que está resuelto con datos
reales hasta probar CaixaBank seleccionada en solitario.

### Telemetría financiera de las Edge

Los eventos de soporte de `bank-sync` son deliberadamente cerrados: banco, estado, número de
cuentas/filas, duración y código de error conocido. No se guardan payloads de Enable Banking,
movimientos, importes, comercios, fechas, referencias ni titulares. Esta garantía vive también en
`tests/security.test.mjs`. `bank-callback` tampoco serializa `session.access` —puede contener IBAN—
ni la query OAuth —lleva `code` y `state`—: solo conserva su forma y recuentos. El cliente común de
Enable Banking convierte una respuesta fallida en estado HTTP + código corto y nunca incluye el
cuerpo del proveedor. `ingest` registra el motivo, la fuente y las longitudes de una notificación
descartada, o códigos cerrados de error; nunca su texto, comercio o importe.

Para aplicar toda la frontera hay que desplegar **`bank-aspsps`**, **`bank-connect`**,
**`bank-disconnect`**, **`bank-callback`** y **`bank-sync`** —todas empaquetan el cliente compartido—,
más **`ingest`**. Modificar los ficheros en una rama o publicar una OTA no cambia las Edge que están
sirviendo a los móviles.

### CORS: lista blanca, no `*` (4.10.0)

Las Edge Functions ya no responden `Access-Control-Allow-Origin: *`. El origen permitido lo pone
`withCors` (`supabase/functions/_shared/cors.ts`) y sale de **`APP_URL`** más `https://localhost`
(la WebView de la APK) y localhost con puerto (desarrollo y e2e). **Si mudas la app de dominio,
cambia `APP_URL`** o el navegador bloqueará las respuestas. `tests/edge-sintaxis.test.mjs` falla si
alguien vuelve a poner el `*`.

## Paso 3 — Crear tu usuario y obtener tu UUID 👤

1. **Authentication → Providers → Email**: deja activado *Email*. Para magic link, activa *Enable email confirmations* (o magic link).
2. **Authentication → Users → Add user** (o entra una vez desde la app con tu email).
3. Copia el **User UID** (uuid) de tu usuario → lo necesitas como `INGEST_USER_ID`.

## Paso 3b — Configurar las URLs de Auth (CRÍTICO para el magic link) 👤

En **Authentication → URL Configuration**:
- **Site URL:** la URL de tu app en GitHub Pages (cópiala de Settings → Pages del repo; normalmente `https://juanjoavila.github.io/Aely/`).
- **Redirect URLs:** añade la misma URL y, por comodidad, un comodín: `https://juanjoavila.github.io/Aely/**`.

> Sin esto, el enlace del email redirige a `localhost` y el login falla. Si pruebas también en local, añade `http://localhost` a las Redirect URLs.

## Paso 4 — Configurar los secretos de las funciones 👤

En **Project Settings → Edge Functions → Secrets** (o con la CLI), añade:

| Secreto | Valor |
|---|---|
| `FINNHUB_KEY` | tu key de finnhub.io |
| `INGEST_TOKEN` | un token largo aleatorio que invente (lo usará MacroDroid) |
| `INGEST_USER_ID` | el UUID de tu usuario del Paso 3 |
| `OPENAI_API_KEY` | key de OpenAI; necesaria para categorías IA y para la ayuda avanzada |
| `AELY_HELP_AI_ENABLED` | `true` solo después de aprobar privacidad, coste y despliegue de `help-assistant` |
| `OPENAI_HELP_MODEL` | opcional; modelo de Pregúntame (por defecto `gpt-5.6-sol`) |

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya las inyecta Supabase en las funciones; no las pongas a mano.

`help-assistant` permanece cerrado si falta la key o el flag exacto `true`. Desplegar el código no
activa por sí solo ninguna llamada de pago. La app conserva la guía local/offline y muestra un aviso
controlado si la función no está disponible. Antes de activar el flag, revisar el consentimiento,
los topes y la estimación de coste en
[`briefs/asistente-hibrido-2026-09-16.md`](briefs/asistente-hibrido-2026-09-16.md).

## Paso 5 — Configurar el despliegue manual desde GitHub 👤

En el repo: **Settings → Secrets and variables → Actions**:

- **Secrets** → New repository secret:
  - `SUPABASE_ACCESS_TOKEN` → genera uno en https://supabase.com/dashboard/account/tokens
  - `SUPABASE_DB_PASSWORD` *(opcional)* → la Database Password del Paso 1 (para migraciones seleccionadas expresamente)
- **Variables** → New repository variable:
  - `SUPABASE_PROJECT_REF` → el Project Ref del Paso 1

El workflow `Deploy Supabase` solo admite `workflow_dispatch`: ningún push, merge ni promote despliega funciones o ejecuta SQL. En Actions, seleccionar la referencia revisada y una función concreta autorizada. `funcion` es obligatorio: se rechazan vacío, rutas, metacaracteres o nombres sin `supabase/functions/<nombre>/index.ts`, antes de cualquier SQL. No existe despliegue global.

`migraciones` conserva `no` por defecto. Solo `si` junto con contraseña habilita `db push --include-all`; requiere revisión y autorización separadas. La ruta histórica conserva `continue-on-error`: un Action verde no acredita éxito de las migraciones, hay que comprobar el paso y su resultado.
Mientras no estén configurados, el workflow se salta el deploy sin fallar.

El proyecto Supabase es compartido: `beta` no tiene una Edge separada. Por eso una corrección de
`ingest` puede prepararse y revisarse en beta, pero solo se activa al
lanzar expresamente `supabase.yml` con autorización. No se debe presentar una prueba móvil de servidor como activa
antes de ese despliegue.

FIN-05 amplía la respuesta mensual de `ingest` con `periodStart` (inicio del mes en
Europe/Madrid), `readAt` (instante anterior al SELECT), `eventKey` (identidad persistida),
`shownDelta`/`againstDelta` (contribución de esa fila), `expenseKey` (clave de lápida),
`counts` (presupuesto) y `cashCounts`
(efectivo de TR). Si el SELECT falla, `month` es `null`: una compra confirmada no autoriza
fabricar un total cero. El 26/9 se desplegó expresamente solo `ingest` desde `beta` en
`be59e27c` ([Action 36196554737](https://github.com/JuanjoAvila/Aely/actions/runs/36196554737));
no se ejecutaron migraciones nuevas. Aún falta verificar por separado la revisión activa que
responde y probar el circuito completo con la APK nueva en el móvil.

## Paso 6 — Repuntar MacroDroid (cuando esté probado) 👤

Cambia la URL del POST de MacroDroid del Apps Script a:

```
https://<PROJECT_REF>.supabase.co/functions/v1/ingest?token=<INGEST_TOKEN>
```

Mantén el Apps Script activo hasta confirmar que entran gastos por Supabase; luego se jubila.

---

## Estado del frontend

✅ **Ya cableado** en `public/index.html` (v3.4.0): cliente Supabase, login magic-link (botón de nube arriba), sincronización de `app_state`, lectura de `expenses` y precios vía la función `prices`. Offline-first: sin sesión, todo sigue con `localStorage`.

### Cómo probarlo (cuando termines los pasos 1–5)
1. Abre la app en el móvil (o GitHub Pages), pulsa el **icono de nube** arriba a la derecha.
2. Mete tu email → te llega el enlace → al abrirlo, vuelves a la app ya con sesión.
3. La primera vez sube tu estado actual a la nube. En otro dispositivo, inicia sesión y verás lo mismo.
4. El botón **Sincronizar** trae los gastos de la tabla `expenses`; **Precios USD** usa la función `prices`.

### Pendiente (futuro)
- Repuntar MacroDroid a la función `ingest` (Paso 6) y jubilar el Apps Script.
- Pantalla de login más cuidada (ahora usa el prompt nativo del navegador) e importación de los gastos históricos del Google Sheet.

FIN-06 (4.26.51): `_shared/wallet.ts` preparado con 30 ISO y paridad de céntimos/legacy USD con cliente. Sin cambio sigue devolviendo null; ingest no guarda euros inventados. El cambio del servidor está probado en repo pero NO desplegado al backend compartido: cualquier deploy de ingest requiere autorización específica. No hay migración de esquema ni de movimientos.

## Identidad autorizada para `npm run listo`

El CLI de revisión utiliza la configuración existente de Dev en `profiles` (`user_id`, `is_admin`), creada por `0016_profiles_and_privacy.sql`. Con la clave service role de `.env.local` lee únicamente esos campos de los perfiles administradores y exige una sola identidad con total exacto acreditado. Después consulta `app_events` con `user_id` igual a esa identidad; no basta con coincidir por tanda o huella.

Si falta el perfil, hay varios administradores, el formato/total es inválido o la consulta falla, el CLI sale con código 2 y veredictos indeterminados. No elige una cuenta por defecto, no utiliza correos como selector y no copia identidades al repo. La configuración real sigue pendiente de verificación donde se disponga de la clave; esta corrección no crea perfiles, cambia roles, aplica SQL ni despliega funciones.

## SEC-03 · logs (propuesta sin desplegar)

Cambios locales en bank-sync, bank-callback, ingest y _shared/ratelimit minimizan campos libres antes de app_events/consola. No se han aplicado al servidor ni se han consultado tablas/logs reales. La [matriz SEC-03](briefs/sec03-privacidad-logs.md) distingue mocks, fuente local y evidencia viva pendiente; un despliegue por función y el logging de plataforma son etapas independientes. No requiere migración ni cambio de RLS.

No desplegar ingest de la rama SEC-03 sin portar su delta de logger sobre la fuente activa revalidada: Claude informó una diferencia main/ingest49 (FIN-05/Wallet). La matriz registra este límite; SEC-03 no reemplaza funciones activas ni valida ese inventario con tablas/logs reales.

### Widget80 conserva ingest

No Edge/SQL desplegada ni modificada por el injerto. Ingest activo sigue legado; v2 oculta cifras sin evidencia compatible y pide abrir la app. DeltaPR87 sigue separado y NO-GO. Un backend futuro exige su autorización y guion real propio. [Acta](briefs/inc-2909-01-widget.md).


Movilidad88: espejo y ALLOWED/HINTS preparados como fuente. No despliega Edge ni SQL. Sin detalle inequívoco conserva tasas/parking/transporte; servidor anterior y requisitos Edge siguen pendientes.

Revisión PR226 (13/10), SIN desplegar: guard de snapshot en todos los UPDATE por enlace y
DELETE de desconexión; proveedor acotado8s con abort+race. Fila cambiada no se borra (409).
No schema/secreto nuevo. La [consulta posdespliegue preparada](briefs/bancos-revoca-callback-20261013.md)
verifica updated_at en sync normal y NO se ha ejecutado contra Postgres real.

Revisión de reservas PR223 (13/10), sin desplegar: el logger combina motivos de paginación y
diagnóstico de autenticación de la dependencia2d53 sin duplicar logObDemandResult. El presupuesto
propio se etiqueta page_limit. No se cambia el cursor/acuse119 ni el catch/consulta de sesión.
La fuente es candidata sobre esa dependencia, no una función desplegada de beta124.
