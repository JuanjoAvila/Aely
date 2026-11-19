PR315, contrato de paginado (26/10/2026): se conserva el comportamiento del lector y
handler base. Cada lectura admite hasta doce páginas exitosas. Solo un rechazo
inicial `WRONG_TRANSACTIONS_PERIOD` puede añadir un intento para cambiar a
`strategy=longest`: máximo trece en ese caso, doce sin rechazo. Otros errores no
permiten un intento extra. El histórico usa longest desde el principio. El tramo
antiguo conserva su guardia de transporte compartida: no estrena doce llamadas.

No se introduce lectura por intervalos nueva, `window_slice`, cambios de cliente ni
SQL. La ventana que cabe en doce páginas se devuelve entera también con rechazo,
con las mismas filas y céntimos que la base. El cursor a «ahora» cuando una ventana
rebasa esos límites y el contrato partial/sealed del cliente quedan pendientes
aparte en [BACKLOG](BACKLOG.md). Fuente y pruebas sintéticas; sin despliegue.

FIN-11 candidata privada: presupuesto, ingest y widget reciben `obAbsorbedPending`
con el titular autenticado, además de `deleted`. La protección se aplica antes de
la deduplicación FIN-15. Sin SQL ni despliegue; servidor nuevo antes del cliente,
por el coordinador tras revisión. [Contrato](briefs/fin11-absorciones-pendientes-20261017.md).

H2 candidata de `bank-sync`, ronda 2: reserva hasta 5 s de saldo dentro de los 15 s por cuenta; movimientos con el resto, serialidad y topes intactos. Cuenta solo UID válidos; conserva códigos cerrados y registra fallo de saldo. El cliente antiguo mantiene la parada de movimientos tras fallo de saldo; el capaz separa ambas fases. ACK exige fila actualizada. Sin despliegue: Edge requiere OK del dueño después de su beta. [Contrato y límites](briefs/h2-saldos-movimientos-20261018.md).

FIN-15 (beta 4.26.138, 16/10/2026): `filasComoLaApp` deduplica una referencia bancaria estable
por banco + `#ref`, aunque cambie el día al contabilizar. Aplica `deleted` y `ob-absorbed`
antes de consumir la referencia; conserva el comportamiento de filas antiguas sin `#ref`.
Month legacy y widget v2 comparten el lector. **Claude despliega ingest ANTES del cliente**
y verifica la fuente desplegada; la beta no acredita ese despliegue. Sin SQL ni migración.
Referencias diferentes entre días sin alias estable siguen siendo filas distintas.

Mes natural sin la nómina (26/10/2026, rama `claude/neto-sin-nomina`): `ingest/widget.ts` compara
gasto − ingresos sin la nómina, con tope en 0, y usa `nominas`/`noNominas` de `widgetPeriod`
(más `comercioDeNomina` para una nómina que llega con la app cerrada); un ingreso grande que no
sabe decidir deja el widget sin foto. Recibos del Plan (`~recibo.`) y aportaciones a meta
(`~meta.`) quedan fuera como en `cuentaParaPresupuesto`. **Necesita desplegar `ingest`**, sin SQL
ni secretos, y el orden da igual: acepta los DOS alcances. La web anterior (alcance de 8, sin
listas) recibe el bruto que pinta su Inicio; la nueva (también de 8, con las listas en el hueco del
ancla, que es lo único que acepta el nativo), el neto sin nómina. Un alcance que no casa
con ninguna sigue sin foto. `month` legado no cambia.

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

## Crons: el keepalive de MyInvestor y la purga de `rate_limits` (31/10 y 18/11/2026)

`pg_cron` tiene `myinvestor-keepalive` (0011) y, cuando se aplique la 0030, `aely-rate-limits-purga`
(una vez al día, solo borra cubos de frenos ya caducados). No existe cron de Open Banking ni de avisos:
la lectura del banco el día del recibo (Recibos v6, SPEC §11.1) está pendiente de decisión del
dueño, y los avisos de la víspera los dan el cliente y el `AlertCheckWorker` de la APK. Antes de
programar cualquier lectura de `bank-sync`, ver «Open Banking: lectura sola al entrar, con tope» en
`docs/ARQUITECTURA.md`.

## Brókers por conexión: IBKR Flex y Kraken (19/11/2026) — en fuente, SIN desplegar

Rama `claude/brokers-api`. Plan aprobado: credenciales de **solo lectura**, cifradas en el
servidor como MyInvestor. Nada está activo hasta aplicar la migración y desplegar las tres
funciones, desde `main` y con el OK del dueño.

**Orden:** 1) aplicar `0031_broker_links.sql` (aditiva: tabla `broker_links`, RLS de solo lectura
propia, grant por columnas sin `cred_*` ni `nonce`, y `broker_next_nonce` solo para `service_role`);
2) desplegar `broker-connect`, `broker-sync` y `broker-disconnect` (llevan `_shared/brokers/*`,
`_shared/crypto.ts` y `_shared/request_body.ts`); 3) desplegar `delete-account` (borra también
`broker_links`); 4) publicar el cliente. Un cliente sin estas funciones no las llama: la tarjeta
solo aparece si el usuario enciende el chip del bróker.

**Secretos:** ninguno nuevo. `broker-connect` **se niega a guardar** (código `no_key`, 503) si
`TOKEN_ENCRYPTION_KEY` falta o no es válida, con o sin `TOKEN_ENCRYPTION_REQUIRED`, y lo comprueba
antes de mandar la credencial al bróker. Además, no escribe nada que no salga con el prefijo
`enc:v1:`.

**Qué hace cada una** (todas `verify_jwt = true`, freno por usuario de la 0019):

| Función | Cuerpo (tope) | Qué hace |
|---|---|---|
| `broker-connect` | `{broker, a, b}` (2 KiB) | IBKR: `SendRequest` + `GetStatement` de prueba (v3, reintenta 1019 hasta ~30 s) y exige la sección Open Positions. Kraken: `GetApiKeyInfo` y **rechaza sin guardar** cualquier clave con `withdraw-funds`, `modify-trades`, `close-trades`, `add-funds`, `earn-funds`, `add-withdraw-address` o `update-withdraw-address`, sin `query-funds` o con lista de IP. Si todo cuadra, guarda cifrado y devuelve la primera lectura |
| `broker-sync` | `{broker, userInitiated?}` (1 KiB) | Lee y **devuelve** (no escribe posiciones). IBKR: el XML de Flex tal cual, que interpreta `ibkrParseFlexXml` en el móvil. Kraken: vuelve a comprobar los permisos (si la clave ganó alguno peligroso, **borra la credencial** y deja la fila `rejected`), `BalanceEx` y precio con el `Ticker` público. Los fallos solo tocan la fila de la misma `connection_version` |
| `broker-disconnect` | `{broker}` (1 KiB) | Borra la fila. Revocar el token o la clave en el bróker lo hace el usuario (la app lo dice) |

Los registros de las tres llevan solo códigos cerrados (`flex_1012`, `kraken_perm`…); nunca la
credencial, el cuerpo del bróker ni el id del usuario (lo vigila `brokers/handlers.test.ts`).

**Comprobar tras aplicar la 0031** (SQL Editor, con `begin … rollback`):

```sql
select col, has_column_privilege('authenticated', 'public.broker_links', col, 'SELECT') as puede_leer
  from unnest(array['broker','status','last_sync','last_code','meta','cred_a','cred_b','nonce']) as col;
-- cred_a, cred_b y nonce tienen que salir en false.
select has_function_privilege('authenticated', 'public.broker_next_nonce(uuid, text)', 'EXECUTE'); -- false
```

**Fuera de esta ronda:** DEGIRO (sesión no oficial, necesita una cuenta real para medir), Binance
(cierra en España el 31/12/2026) y el coste de Kraken (`TradesHistory`): hoy es «—».

## Auditoría de seguridad 14/11 · ronda 233 en fuente, SIN desplegar

### Open Banking: la vinculación la confirma quien la inició (P2-01)

Problema: el `state` ata la vuelta del banco con quien llamó a `bank-connect`, pero no con el
navegador que vuelve (el callback no lleva sesión). Otra cuenta de Aely podía mandarle a alguien
la URL de su banco y quedarse 90 días de lectura de sus movimientos. Una cookie no sirve: en la
APK la vuelta llega por el navegador del sistema, no por la WebView que empezó.

Solución en dos fases (ver `_shared/entrada.ts` y `docs/ARQUITECTURA.md`):

- **Fase 1, en esta ronda, compatible con web 4.26.232 y APK 64.** `bank-connect` acepta
  `confirm:true` y marca el state con `.c`. Con esa marca, `bank-callback` canjea el código como
  siempre pero deja el enlace en `pending` con la huella de un token de un solo uso, y manda el
  token a quien vuelve: web `APP_URL?bank=confirm&t=<token>`, APK `APP_URL/back.html?confirm=<token>`.
  La función nueva **`bank-confirm`** (JWT) lo activa solo si el enlace es del usuario que llama,
  dentro de 1 h desde la emisión y sobre la misma generación. **Sin `.c` nada cambia**: ningún
  cliente instalado manda `confirm`, así que desplegar las tres funciones no cambia nada visible.
  Un state `confirm:…` usado como state del banco se rechaza (`msg=state`).
- **Cliente (pendiente, otra ronda; toca `public/back.html`, `00-core.js` y `11-app-main.js`):**
  1. `cloud.bankConnect` manda `confirm:true`.
  2. `back.html`: si llega `?confirm=<43 caracteres base64url>`, saltar a
     `micartera://bank?msg=confirm%3A<token>` (la APK 64 solo reenvía `msg`, y lo guarda como
     `bank|error|confirm:<token>`: no hace falta APK nueva).
  3. App: `?bank=confirm&t=` (web) y `bank|error|confirm:` (APK) llaman a
     `sb.functions.invoke("bank-confirm",{body:{token}})`; con `ok` hace lo mismo que hoy con
     `?bank=ok` (toast + sync); con error, el toast genérico de reconectar.
  4. e2e de la vuelta en web y del deep link en APK.
- **Fase 2, cuando la web con el cliente nuevo lleve días servida y no queden clientes sin OTA:**
  secreto `BANK_REQUIRE_CONFIRM=1`. Desde ese momento `bank-connect` marca siempre `.c` y
  `bank-callback` exige confirmación también a states sin marca. Es lo que cierra el ataque: en
  fase 1 el atacante puede no pedir confirmación. Un cliente viejo en fase 2 conecta, pero el
  banco se queda «pendiente» hasta actualizar. Para volver atrás, borrar el secreto.

Orden de despliegue (una función cada vez, por Actions): **`bank-confirm` → `bank-callback` →
`bank-connect`**. Con otro orden tampoco se rompe nada (sin `confirm:true` nadie entra en el modo
nuevo), pero así nunca existe un token que no se pueda canjear. Sin migración ni secretos nuevos
obligatorios. Si `BANK_REQUIRE_CONFIRM=1` se pusiera sin cliente nuevo, conectar un banco dejaría
el enlace pendiente y la app no sabría confirmarlo: no activarlo antes de tiempo.

### Cifrado de tokens: comprobar la clave y activar el modo estricto (P2-04)

`_shared/crypto.ts` cifra con `TOKEN_ENCRYPTION_KEY` los `session_id` de Enable Banking y los
tokens de MyInvestor. **Si falta la clave, por defecto se siguen guardando en claro** (como hasta
ahora: cerrarlo a ciegas dejaría sin poder conectar bancos si el secreto no existe), pero la
función deja **una línea `ENC_MISSING`** en su log por cada arranque de instancia, sin ningún dato
del secreto. Con **`TOKEN_ENCRYPTION_REQUIRED=1`** ya no se guarda nada en claro: el guardado lanza
y la conexión falla con el error genérico de cada función. Leer valores viejos sin prefijo sigue
funcionando en los dos modos (es lo que permite recifrarlos).

Cómo comprobarlo, todo de **solo lectura** 👤:

1. **Project Settings → Edge Functions → Secrets**: tiene que aparecer `TOKEN_ENCRYPTION_KEY`
   (el panel solo enseña el resumen, no el valor). Debe ser 32 bytes en base64 (44 caracteres).
2. **Edge Functions → Logs** de `bank-callback`, `myinvestor-connect`, `myinvestor-sync` y
   `myinvestor-keepalive` tras desplegar esta ronda: buscar `ENC_MISSING`. Si aparece, la clave
   NO está llegando a esa función.
3. **SQL Editor**, solo recuentos (no selecciona ningún valor):
   ```sql
   select count(*) filter (where session_id is not null and session_id not like 'enc:v1:%') as eb_en_claro,
          count(*) filter (where session_id like 'enc:v1:%') as eb_cifrados
     from public.bank_links;
   select count(*) filter (where access_token is not null and access_token not like 'enc:v1:%') as mi_en_claro,
          count(*) filter (where access_token like 'enc:v1:%') as mi_cifrados
     from public.myinvestor_links;
   ```
   `*_en_claro` debería ser 0. Si no lo es: con la clave puesta, `myinvestor-sync` recifra lo de
   MyInvestor en la siguiente lectura; un banco en claro se recifra al reconectarlo.

Activar el modo estricto **solo con los tres pasos en verde**: añadir el secreto
`TOKEN_ENCRYPTION_REQUIRED` = `1`. Para volver atrás basta borrarlo. Si se activa y falta la clave,
conectar o reconectar un banco o MyInvestor falla (nada se guarda en claro), y además
`myinvestor-sync`/`myinvestor-keepalive` no pueden guardar los tokens renovados, así que la sesión de
MyInvestor acaba caducando. Por eso el orden es: clave comprobada → estricto, nunca al revés.

### Topes de lo que cuesta dinero o cuota (P2-06)

Con el registro abierto, un freno solo por usuario no pone techo: basta con crear cuentas. Ahora
cada función de pago tiene además un cupo **global**, y las cuentas con **menos de 7 días**
(`user.created_at`, `_shared/cupos.ts`) comparten uno propio y menor, para que un bucle de altas
no deje sin servicio a las cuentas de siempre. Sin migración: usa `check_rate_limit` (0019).

| Función | Por usuario | Global cuentas de siempre | Global cuentas nuevas | Al pasarse |
|---|---|---|---|---|
| `prices` | 30 / 10 min (**encendido por defecto**; `PRICES_RATE_LIMIT=0` lo apaga) | `prices-total-hour` 240/h | `prices-new-hour` 60/h | 429 `limited`; la app conserva los precios de antes |
| `help-assistant` | 15 / 10 min y 30/día (nuevas: 10/día) | `help-assistant-total-day` 1000/día (el de siempre) | `help-assistant-new-day` 100/día | 429 `limited`; queda la ayuda local |
| `categorize` (solo camino IA) | 40 / 10 min y 300/día (nuevas: 60/día) | `categorize-ai-total-day` 3000/día | `categorize-ai-new-day` 300/día | 200 «otros» con `ai:"limit"` |

El uso de la app no se acerca: precios se piden a mano (botón, tirar para refrescar, al editar una
inversión) y la IA de categorías solo cuando las palabras clave no saben. Si algún tope saltara en
uso normal, `PRICES_RATE_LIMIT=0` apaga el de precios sin redesplegar. Cerrar el registro
(Authentication → Sign In / Providers → «Allow new users to sign up») sigue siendo decisión del
dueño y lo complementa.

### P3 de la misma auditoría hechos en esta ronda

- **`delete-account` (P3-06/P3-09):** 5 intentos cada 10 min por usuario ANTES de reautenticar
  (con una sesión robada era un probador de contraseñas); los errores de Auth vuelven como `error`.
  La revocación del consentimiento de Enable Banking al borrar la cuenta llegó en la ronda A
  (18/11, abajo).
- **Migración `0027_hogar_funciones_sin_anon.sql`:** `revoke execute … from anon` en
  `join_household_by_code` e `is_household_member`. Sin efecto para la app. Aplicarla a mano en
  SQL Editor o con `migraciones=si`.
- **`supabase.yml` (P3-15):** `permissions: contents: read` explícito; el despliegue sigue con
  `SUPABASE_ACCESS_TOKEN`, sin cambios de flujo.

## Ronda A · servidor (18/11/2026) — en fuente, SIN desplegar

Rama `claude/ronda-a-servidor`. Nada de esto está activo hasta desplegar cada función y aplicar las
migraciones, con el OK del dueño. Ninguna función cambia de contrato con la app: la web y la APK
instaladas siguen funcionando igual con o sin estos despliegues.

### Qué hay que desplegar (una función cada vez, por Actions)

| Función | Por qué | Notas |
|---|---|---|
| `delete-account` | Revoca en Enable Banking antes de borrar (P3-06) | Lleva `_shared/eb-revocar.ts` |
| `bank-callback` | Revoca la sesión que crea y no consta guardada (SEC-02) | Ídem |
| `bank-connect`, `bank-aspsps`, `bank-disconnect` | Códigos cerrados en vez de `error.message` (P3-09) | `bank-disconnect` no cambia su revocación |
| `myinvestor-connect`, `myinvestor-sync`, `myinvestor-disconnect`, `myinvestor-keepalive` | Ídem | El aviso de MyInvestor al iniciar sesión se queda |

`_shared/cors.ts` y `_shared/ratelimit.ts` cambian también, pero **sin cambio de comportamiento sin
secretos nuevos**: las funciones que los empaquetan (todas, `ingest` y `bank-sync` incluidas) se
pueden desplegar cuando toque por lo suyo.

### Qué cambia

- **Borrar la cuenta revoca los consentimientos bancarios** (`delete-account`, P3-06). En paralelo,
  tope de 8 s como `bank-disconnect`; si el proveedor falla, la cuenta se borra igual (el derecho a
  borrar no depende de él) y la consola de la función guarda `delete-account: revocación no
  completada {total, fallos:[{step,status,code}]}`, sin id ni texto del proveedor. MyInvestor no
  tiene cierre equivalente: no consta un logout en su API no oficial; al borrar la fila el
  keepalive deja de renovar y los tokens caducan solos.
- **El callback tardío ya no deja sesiones huérfanas** (`bank-callback`, reserva de la PR314). Se
  revoca la sesión recién canjeada SOLO cuando consta que no se guardó: el UPDATE final volvió sin
  filas y sin error (otra generación ganó), el GET de cuentas no respondió, o algo falló antes de
  guardar. Con error o acuse ambiguo no se toca: podría estar guardada, y revocarla mataría un
  enlace activo. El diagnóstico añade `huerfanaRevocada: true|false` cuando se intentó. En esa
  rama la redirección puede tardar hasta 8 s más.
- **Errores cerrados** (P3-09): las funciones de la tabla devuelven `error:"error"` en vez del
  mensaje de PostgREST o de la excepción. La app ya enseñaba su texto propio (`errTxt`). Pendiente:
  el `catch` final de `bank-sync` (ronda E). Lo vigila `_shared/errores-cerrados.test.ts`.

### Interruptores preparados y APAGADOS (secretos de Edge; sin ellos, todo como siempre)

| Secreto | Valor | Efecto | Quién decide |
|---|---|---|---|
| `ALLOW_LOCAL_ORIGINS` | `0` | CORS deja de aceptar `http://localhost:*` (P3-10). La APK (`https://localhost`) y la app publicada siguen. Rompe el desarrollo local contra producción. | Dueño (pregunta 9) |
| `RATE_LIMIT_IP_DIAG` | `1` | Apunta UNA vez por instancia la forma de las cabeceras de IP (sin IPs) | Cualquiera, para medir |
| `RATE_LIMIT_IP_SOURCE` | `xff-last` / `cf` | Cambia de dónde sale la IP del cubo de `ingest` y `bank-callback` (P3-04). Por defecto, el primer `x-forwarded-for` | Tras medir |

**Cómo decidir `RATE_LIMIT_IP_SOURCE` sin ver ninguna IP** 👤:
1. Secreto `RATE_LIMIT_IP_DIAG=1` y desplegar `bank-callback` (o esperar a su próximo despliegue).
2. Desde cualquier equipo: `curl -s -o /dev/null -H "X-Forwarded-For: 203.0.113.7" "https://<REF>.supabase.co/functions/v1/bank-callback?code=x&state=diagnostico"`
   (devuelve el 302 de error de siempre: el `state` no existe y no se consume nada).
3. Edge Functions → Logs de `bank-callback`: la línea `rate-limit cabeceras: {...}`.
   - `primeroDePrueba: true` → el gateway **concatena** la XFF del cliente: el primer salto lo elige
     quien llama. Si además `cfIgualUltimo: true`, usar `RATE_LIMIT_IP_SOURCE=cf`.
   - `algunoDePrueba: false` → el gateway **sustituye** la XFF: lo de siempre es correcto.
4. Borrar `RATE_LIMIT_IP_DIAG`. Ojo: si el último salto fuera interno de Supabase, `xff-last`
   metería todas las peticiones en un cubo y el freno de 60/min tumbaría el lector de la familia.

El freno **sigue abriéndose si falla** (BD caída, migración sin aplicar): regla de la casa, se decide
mantenerla.

### Migraciones 0028–0030

⚠ **`migraciones=si` aplica TODAS las pendientes del ref lanzado** (`db push --include-all`), no
solo una. A 18/11 la 0027 no está aplicada en la BD; lanzar desde esta rama aplicaría 0027, 0028,
0029 y 0030 juntas. Si se quiere solo la 0027, lanzar desde un ref que no tenga las demás, o pegarla
a mano en el SQL Editor. Ninguna se ha ejecutado contra un Postgres (no hay uno local): probarlas
antes con `begin; … rollback;` en el SQL Editor.

- **0028 · Hogar** (P3-05). Encontrado al revisarlo: **el freno de la 0022 no contaba los fallos**.
  `join_household_by_code` lanza `invalid_code`, y la excepción deshace la transacción de la RPC con
  su contador dentro: solo se contaban los aciertos. La función nueva `join_household(p_code)`
  devuelve `{ok, code}` sin lanzar, así que sus fallos sí se quedan; la vieja se conserva para la app
  instalada. Además: tope global de 200 códigos fallidos/hora (cierra las dos funciones para todos
  esa hora), `invite_expires_at` (NULL = no caduca), códigos nuevos o cambiados de ≥10 letras/cifras
  (trigger solo en `insert` o `update of invite_code`: los de 6 siguen valiendo), el dueño puede
  expulsar (`household_members_delete_owner`) y la foto del que sale se borra (trigger). **Falta la
  parte de la app** (otra ronda): usar `join_household`, botón de expulsar, rotar el código con
  caducidad y regenerar los de 6. **El hueco sigue abierto** hasta retirar `join_household_by_code`: la
  vieja sigue lanzando `invalid_code`, así que sus fallos siguen sin contarse aunque se aplique la 0028
  (revisión de la ronda A, P2-2); la retirada (`revoke execute … from authenticated`) va en el
  inventario, después de que la app use `join_household`. Prueba sugerida en el SQL Editor (como `authenticated`):
  ```sql
  begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
  select public.join_household('NOEXISTE00');   -- {"ok":false,"code":"invalid_code"}
  reset role;
  select bucket, hits from public.rate_limits where bucket = 'hh-join-miss-global';  -- hits ≥ 1
  rollback;
  ```
- **0029 · admin sin correo** (P3-08). Ninguna cuenta nueva nace admin; no toca ninguna fila. Antes
  de aplicarla, `select count(*) from public.profiles where is_admin;` debe dar 1.
  **Admin por `user_id`** (solo si hiciera falta darlo de nuevo, a mano 👤):
  `update public.profiles set is_admin = true where user_id = '<UUID de Authentication → Users>';`
- **0030 · purga diaria de `rate_limits`** (T-08). `pg_cron` a las 04:17 UTC llama a
  `prune_rate_limits()` (borra ventanas de hace más de 2 días; la ventana más larga de cualquier
  freno es 1 día, así que no cambia ninguna decisión). Motivo: los cubos por IP (`ingest-ip:`,
  `bank-callback-ip:`) nacen con cada cambio de IP del móvil y no vuelven, y un hash de IP sigue
  siendo dato seudónimo. **Medir antes y después** (solo lectura):
  ```sql
  select split_part(bucket, ':', 1) as freno, count(*) as filas,
         count(*) filter (where window_start < now() - interval '2 days') as caducadas
    from public.rate_limits group by 1 order by 2 desc;
  ```

### Lo que queda fuera de esta ronda (y por qué)

- **Cifrado de tokens obligatorio** (`TOKEN_ENCRYPTION_REQUIRED=1`, P2-04): el código ya está; falta
  comprobar la clave y los recuentos (pasos arriba), y la credencial local de Supabase está
  caducada (pregunta 6).
- **Gemelas nativas** (`INGEST_NATIVE_TWINS`): secreto, solo con todos los móviles en ≥4.26.179
  (pregunta 4). Riesgo de contar doble: ver «SEC02 F2» abajo.
- **Cerrar el alta de cuentas** (Auth → «Allow new users to sign up»): ajuste del dueño (pregunta 3).
- **Privacidad de los logs de la plataforma** (SEC-03 servidor): en el código de estas funciones no
  queda ningún registro con texto libre; lo que guarde el gateway (URL con `code`/`state` del
  callback, cabeceras) no se controla desde el código y hay que mirarlo en el panel con credencial.
  Reescribir la historia del repo, solo con decisión expresa.
- **Matriz función/migración/versión viva** (OPS-01): necesita token de lectura de Supabase y un
  script nuevo en `scripts/` (fuera de esta ronda), además del pago real con Wallet en divisas.

## SEC01: límites del cuerpo por función · PR256 candidata, sin desplegar (17/10/2026)

`_shared/request_body.ts` aplica estos límites de bytes del cuerpo mientras lee el
stream, antes de reservarlo entero. `Content-Length` permite el rechazo anticipado;
su ausencia o un valor menor no sustituye el conteo real. El límite exacto se admite.

| Función | Máximo del cuerpo |
|---|---:|
| `bank-aspsps` | 16 384 bytes (16 KiB) |
| `bank-connect` | 16 384 bytes (16 KiB) |
| `bank-disconnect` | 16 384 bytes (16 KiB) |
| `bank-sync` | 32 768 bytes (32 KiB) |
| `bank-callback` | 1 024 bytes (1 KiB) |
| `categorize` | 8 192 bytes (8 KiB) |
| `delete-account` | 65 536 bytes (64 KiB) |
| `myinvestor-connect` | 65 536 bytes (64 KiB) |
| `myinvestor-sync` | 1 024 bytes (1 KiB) |
| `myinvestor-disconnect` | 1 024 bytes (1 KiB) |
| `myinvestor-keepalive` | 1 024 bytes (1 KiB) |

El exceso cancela la lectura; UTF-8, JSON o forma inválidos se rechazan sin efectos
de producto. Las rutas JSON devuelven 413 por tamaño o 400 por entrada inválida.
`bank-callback` conserva el protocolo del navegador: **302 de error cerrado** a la web
o al puente `back.html` de la APK, también por cuerpo inválido o demasiado grande,
sin reflejar el cuerpo ni code/state. Primero aplica la cuota IP; el rechazo de entrada
ocurre antes del lookup/consumo de state, la cuota del usuario y el canje OAuth.
GET sin cuerpo y las formas legítimas de cliente/cron conservan sus rutas anteriores.
Estos límites son preventivos; no son máximos observados en bancos ni cambian cuotas,
CAS o contadores. Ingest/help/prices quedan fuera de este port.

La tabla describe la fuente candidata, no funciones vivas. Sin migración ni secretos
nuevos. Revisión, integración, despliegue y aceptación móvil siguen pendientes del
circuito de Claude; el orden previsto es PR249 → PR252 → PR256 → SEC03 en beta140.
Esta documentación no autoriza ese despliegue ni incorpora SEC03/ABA a PR256.

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

## Aportación a una meta (24/10, rama `claude/meta-aportacion`): `ingest` con `esAportacionAMeta`

La web marca un cargo del banco como aportación a una meta con `ob:<ent>~meta.<id>` y lo saca del
gasto del mes. El `ingest` desplegado lee el banco limpio (`bancoDeSource` corta en `~`) y lo
CUENTA: hasta desplegar el `ingest` con `esAportacionAMeta` (`_shared/presupuesto.ts`), el widget
de quien use la marca dice más gastado que Inicio (exactamente el importe marcado). Es inocuo
adelantarlo: sin la web nueva no existe ninguna fila `~meta.`. Sin migración ni secreto. Desplegar
`ingest` (lo importan `ingest/index.ts` y `ingest/widget.ts`) va aparte, con el OK del dueño.

Un móvil con una versión anterior lee esa fila como un gasto normal (la cuenta, igual que el
servidor viejo) y, si cambia su banco o resuelve un «posible repetido» en ella, reescribe `source`
sin la marca: la fila vuelve a contar en todos los móviles. Degrada al lado que se ve, no esconde
dinero; con todos los móviles de la cuenta en la versión nueva no pasa.

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

## OPS-07 keepalive (16/10): candidato, SIN desplegar

`myinvestor-keepalive` condiciona también la escritura de éxito al `refresh_token`
almacenado que leyó antes de llamar al banco. Una reconexión o rotación concurrente
conserva sus tokens y metadatos. La respuesta del UPDATE distingue cero filas de un
guardado: cero filas cuenta como `skipped`, nunca como renovación o caducidad.

Cada enlace activo produce como máximo un intento de evento `mi_keepalive` por tick,
sin email, tokens, dispositivo ni texto del proveedor. Solo se conserva el `user_id`
estructural obligatorio de `app_events` (0006, FK; criterio de coordinación del16/10),
mensaje fijo y `detail` con `outcome` (`ok`, `rejected`, `skipped`), `http` (número o
null si no hubo respuesta), `hasRefreshExpiresIn` (presencia, también para cero/null),
`hasRefreshToken` (booleano: la respuesta contiene un refresco no vacío) y `guarded`
(UPDATE sin error que no encontró la fila original). `code` solo admite `ok`, `rejected`,
`http_403`, `http_other`, `no_access_token`, `network`, `decrypt`, `encrypt`, `no_creds`,
`save_error` y `raced`. No se registran tokens ni el valor de la duración. `save_error`
con HTTP 200/201 distingue el guardado fallido después de un refresco aceptado.
Fallos de red, descifrado, cifrado o guardado son `skipped`; los errores
de diagnóstico no alteran el resultado ni impiden tratar los demás enlaces.

Un éxito consulta el último evento `mi_keepalive` del mismo usuario en la última hora,
ordenado por `created_at` descendente y por `id` descendente en caso de empate
(`bigint identity`, migración0006). Solo omite el registro si ese último `detail` es
idéntico: `ok → 500 → ok` registra la recuperación, y un éxito sin `refreshExpiresIn`
o sin `refreshToken` registra el cambio de presencia y su posterior recuperación.
Los 403 mantienen su límite separado por `code:http_403`, para no ocultar ni contar
errores de lectura del cuerpo. Si falla cualquiera de estas consultas, omite el
diagnóstico. Esto limita los ticks secuenciales,
pero no es un bloqueo atómico entre cron concurrentes. No hay migración, secreto nuevo
ni cambio de RLS. Se reutilizan los grants de0018 y los límites de0023; solo se ha leído
el esquema versionado, no el servidor. La retención de eventos sigue siendo la existente.

Tras un refresco aceptado, un error devuelto o una excepción del UPDATE permite **un solo
reintento del mismo guardado**, con los mismos tokens cifrados, metadatos y guarda del
refresco original. No vuelve a llamar al banco. Cero filas sin error significa `raced`
y corta los intentos. Si fallan ambos, se registra `save_error`: **no es inocuo**, el banco
puede haber invalidado el refresco anterior y el enlace podría necesitar reconexión.
La carrera general entre keepalive y sync sigue en backlog separado; esta guarda no
serializa ambos procesos. Si el primer UPDATE se aplicó pero devolvió un error o su
respuesta se perdió, el reintento puede encontrar cero filas porque el propio primer
intento cambió el token. También se informa `skipped`/`raced`, con `guarded:true`, aunque
los tokens nuevos estén guardados. **`raced` no demuestra que haya otro escritor**:
solo acredita que ese intento sin error no encontró el token original. No se hace una
lectura adicional para resolver esta ambigüedad; la prueba sintética de respuesta
perdida la caracteriza sin afirmar un fallo de persistencia ni una renovación confirmada.

Cada llamada a MyInvestor tiene un máximo de 10 segundos para recibir cabeceras **y cuerpo**.
El timeout aborta la petición, cuenta `skipped`/`network` y permite tratar el siguiente enlace;
el temporizador siempre se limpia. No limita las consultas a la BD ni garantiza que un lote
arbitrariamente grande termine dentro del límite global de la Edge Function. No hay reintento bancario.

Pruebas: handler real con dobles sintéticos en `tests/myinvestor-keepalive.test.mjs`,
ya registrado en `scripts/run-tests.mjs` y el grupo Edge de `scripts/relevant-tests.mjs`.
Protege reconexión, valor cifrado original, aislamiento por usuario, outcomes, privacidad,
errores de persistencia/telemetría, límite horario, códigos, reintento acotado y timeout
de cabeceras/cuerpo. La fuente no toca sync, token_store
ni cliente. Claude decide el despliegue de esta función **después de producción MyInvestor**;
CI, integración, despliegue y aceptación real mantienen sus gates propios. Rollback:
restaurar solo esta función desde la base93705650, sin borrar ni restaurar datos.

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

**Migraciones por CI (`supabase.yml`, 16/11/2026).** El paso «Aplicar migraciones» hace `supabase link` y
`supabase db push --remote --include-all --password … --yes`. Según la referencia de la CLI
(<https://supabase.com/docs/reference/cli/supabase-db-push>), sin flag de destino `db push` apunta a la base
LOCAL; `--remote` apunta al proyecto enlazado, `--password` sigue vigente pero solo junto a `--remote`,
`--yes` es global y obligatorio sin terminal, y `--linked`/`--db-url`/`--project-ref` siguen en v3 pero
deprecados (se quitan en v4). Antes el paso llevaba `continue-on-error` y un fallo del SQL salía en verde:
ahora la función se despliega igualmente, pero el paso final «Resultado de migraciones» emite
`::error::` y pone el job en rojo. Rojo con función desplegada = SQL sin aplicar.
`tests/supabase-workflow.test.mjs` lo vigila.

**CLI fijada (18/11/2026, SEG-20).** `setup-cli` instala la **3.2.0** exacta, no `latest`, y las dos
acciones van fijadas por SHA (los que resolvían `@v4`/`@v1` en el último despliegue bueno, run
44246722285). Comprobado sin tocar producción: la CLI 2.117 rechaza `db push --remote`
(«Unrecognized flag»), y la referencia de la 3.2.0 (`apps/cli/docs/supabase/db/push.md` y
`docs/command-target.md` en el tag `v3.2.0` de `supabase/cli`) confirma `--remote` = proyecto
enlazado, `--password` solo con `--remote`, `--yes` obligatorio sin terminal y `--include-all`. En la
3.x `link` ignora `--password` con un aviso (no conecta a la BD), así que el paso ya no se lo pasa.
En la v4 desaparecen `--linked` y `--project-ref`: antes de subir de versión hay que pasar
`functions deploy` a `--remote=<ref>`. El test exige SHA en cada `uses:` y una versión 3.x exacta.

### Migración 0019 — límite de peticiones y caducidad del `state` (4.10.0)

`0019_rate_limit.sql` añade la tabla `rate_limits` (sin políticas RLS a propósito: NADIE llega desde
el cliente, solo la service_role a través de `check_rate_limit`) y la columna
`bank_links.state_issued_at`.

Qué frena y por qué:

| Función | Límite | Motivo |
|---|---|---|
| `ingest` | 60/min **por IP** | No pide sesión; su única credencial es un token. Sin freno se prueban tokens a la velocidad de la red. Por IP y no por token: contar por token no frena a quien va probando tokens distintos, que es justo el ataque. |
| `myinvestor-connect` | 10 cada 10 min **por usuario** | Por ahí van el usuario y la CONTRASEÑA reales del banco. Un bucle de reintentos puede dejar al usuario **bloqueado en su propio banco**. |
| `prices` | 30 cada 10 min **por usuario** + cupo global por hora (P2-06, ronda 233) | Encendido por defecto desde P2-06; `PRICES_RATE_LIMIT=0` lo apaga. Cuenta peticiones, no fetches al proveedor. Ver «Topes de lo que cuesta dinero o cuota» arriba y el [brief](briefs/sec02-prices-limites.md) de SEC-02. |

**Si la migración no está aplicada, no se rompe nada**: `rateLimit()` deja pasar y lo apunta en la
consola de la función. Un freno de seguridad que tumba la app cuando se rompe convierte un incidente
pequeño en uno grande.

`state_issued_at` la escribe `bank-connect` y la lee `bank-callback`: la autorización del banco
caduca a los 30 minutos y el `state` se **gasta** al usarlo. Los enlaces creados antes de esta
migración no tienen marca y se dan por buenos, para no romper una reconexión a medias.

SEC03 callback (fuente candidata, sin despliegue): tras las cuotas IP/usuario y la caducidad,
el consumo hace UPDATE por id, state original y emisión igual (IS NULL para legacy), con
retorno de id. Solo una fila confirmada sin error habilita el canje OAuth. Cero filas, error
o respuesta ambigua producen el302 de error existente, sin restaurar/reintentar el state;
puede requerirse reconectar. Un error devuelto al guardar la sesión tampoco anuncia éxito.
La carrera con una nueva autorización durante OAuth sigue abierta como SEC-04:
connection_version, sin guarda por timestamp ni migración en esta candidata.
[Contrato, pruebas y límites](briefs/sec03-callback-atomic-state.md).

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

`migraciones` conserva `no` por defecto. Solo `si` junto con contraseña habilita `db push --include-all`; requiere revisión y autorización separadas. `--include-all` aplica **todas** las migraciones del ref lanzado que falten en el registro remoto, no solo la última: antes de lanzarlo, mirar qué hay pendiente. Desde el 16/11 un fallo del SQL pone el job en rojo (paso «Resultado de migraciones»), aunque la función se despliegue igual.
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


## OPS-08 — candidata CAS sobre PR241, sin desplegar

Las fuentes de keepalive y sync incorporan `_shared/myinvestor-refresh-save.ts`; desplegar ambas con su helper requiere revisión y operación exclusiva de Claude. No añade SQL/migración/secretos. Exige `connection_version` ya introducida en la migración0026: comprobar su disponibilidad dentro del circuito de despliegue existente. Si falta, keepalive omite el enlace sin consumir refresh. El recifrado legacy de sync compara el snapshot antes de escribir y vuelve a leerlo; `token_store.ts` permanece igual a main.

No basta con un UPDATE sin error: debe devolver filas o confirmarse su propio patch tras un acuse perdido. El readback se acota; una lectura fallida queda indeterminada y no anuncia renovación ni posiciones al día. Se mantienen timeout, clasificación HTTP y limitación de telemetría de PR241. CAS no serializa dos consumos externos; OPS-09 queda fuera. [Pruebas y límites](briefs/ops08-refresh-cas.md).

4.26.174 (25/10/2026): `functions/ingest/widget.ts` e `index.ts` cambian (PR298 R2, inicio-mes-futuro): el widget y el resumen mensual cuentan un apunte con fecha del mes que viene en SU mes y no en el actual, como Inicio y Gastos en la web. NO se despliega en beta; `ingest` va con la próxima producción, con el OK del dueño. Hasta entonces el widget puede sumar ese apunte al mes en curso (la web no).

## SEC02 F2: candidato sin cambio de esquema

El candidato [de identidad nativa de ingest](briefs/sec02-ingest-native-slots.md) conserva los índices y los onConflict existentes. Reserva ranuras de milisegundos y conserva identidad/ordinal en los lectores. No necesita SQL; despliegue y prueba móvil pendientes.

### Ingest: fase 1 del lector nativo

INGEST_NATIVE_TWINS permanece ausente/apagado por defecto. El código de la marca nativa propia solo se ejecuta con valor exacto1. No hay SQL ni cambio del UNIQUE de cuatro columnas. La activación queda para una PR posterior, tras confirmar todos los lectores móviles; esta fuente no acredita despliegue. [Contrato y excepciones OFF/R1](briefs/sec02-ingest-native-slots.md).

Riesgo exacto antes de la fase 2 (revisión independiente de la PR313, punto E). Encender `INGEST_NATIVE_TWINS` mientras algún móvil siga con un lector anterior a esta fase 1 es dinero mal contado: ese móvil no conoce la marca `native:trade_republic#…`, la lee como «a mano sin banco» y (1) la cuenta siempre, (2) funde las gemelas del mismo día (dos compras iguales cuentan una), y (3) al sincronizar Open Banking de Trade Republic el «Movimiento» no se empareja con el aviso, así que cada compra nativa cuenta DOBLE (9,95 → 19,90). Esa fila de banco sube a la nube sin `#dup`, de modo que el doble se propaga a los demás móviles y al widget. **Condición de la fase 2:** todos los móviles de la familia en una versión igual o posterior a la 4.26.179 una vez promocionada a producción (la primera de producción que lleve este lector), confirmado por el dueño. Desplegar `ingest` con el interruptor apagado es inocuo: con valor ausente/0/false el handler conserva filas y céntimos de siempre.


## bank-callback · Carrera con una reconexión posterior

El guardado final condiciona el UPDATE a la fila/propietario y a la generación consumida: `state IS NULL` más `state_issued_at` original, con `IS NULL` para legacy. Exige acuse de una única fila con el id esperado; si falta o es ambiguo devuelve error sin restaurar state, reintentar ni tocar una autorización nueva. No añade SQL, migraciones ni revocaciones al proveedor. [Causa y pruebas sintéticas](briefs/sec02-callback-generation-fence.md); despliegue y aceptación reales son pasos separados.

4.26.180 (26/10/2026): `functions/bank-callback/index.ts` cambia (PR314, SEC-02 F1): el guardado final exige id, dueño, `state IS NULL` y la `state_issued_at` original (o NULL en legacy), de modo que un callback tardío no pisa una reconexión posterior. Sin SQL ni variables nuevas. **`bank-callback` queda por desplegar en producción**: NO se despliega en beta; va con la próxima producción, Edge una a una y con el OK del dueño (orden recomendado arriba: `bank-sync`, `bank-callback`, cliente). Reserva: el callback tardío que pierde la carrera deja su sesión de Enable Banking huérfana en el proveedor, sin revocar (ver BACKLOG, SEC-02).
