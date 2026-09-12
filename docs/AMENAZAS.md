# Modelo de amenazas — Aely

> Escrito el 2026-07-28. Sale de la segunda tanda de la review externa, donde se anotó que era
> «el más útil de los suyos porque no es papel: alimenta dos filas ya pendientes». Eso es lo que
> pretende esta página — no lucir, sino dejar por escrito **qué está cubierto y con qué**, para
> que lo que NO lo está deje de ser una sensación y pase a ser una tarea con nombre.

**Qué hay que proteger, por orden.** No es el código: es que nadie que no sea el dueño de una
cartera pueda ver sus movimientos, sus saldos o sus tokens de banco; y que sus datos no se
pierdan ni se corrompan. El repo es público a propósito (lo exige Pages gratis), así que la
seguridad no puede depender de que nadie mire el código.

## Superficie real

| Pieza | Dónde corre | Quién puede hablarle |
|-------|-------------|----------------------|
| PWA / APK | El móvil de cada usuario | Quien tenga el móvil |
| Supabase (Postgres + Auth) | Nube | Cualquiera con la URL y la clave anónima (que es pública por diseño) |
| 10 Edge Functions | Nube | Igual; algunas exigen JWT y otras no pueden (`ingest`, `myinvestor-keepalive`) |
| GitHub Pages | Nube | Todo el mundo, en lectura |
| Release `beta` | Nube | Todo el mundo, en lectura |

## La tabla

| # | Amenaza | Estado | Con qué |
|---|---------|--------|---------|
| 1 | **XSS en el cliente** (un comercio o un concepto con `<script>`) | ✅ | React escapa todo lo que pinta y no se usa `dangerouslySetInnerHTML` en ningún sitio. Encima, CSP sin `unsafe-eval` y con `script-src` cerrado. `e2e/csp.spec.mjs` vigila que la política no se relaje ni bloquee nada. |
| 2 | **Inyección SQL** | ✅ | No se construye SQL en el cliente: todo va por PostgREST parametrizado o por RPC. Las funciones SQL propias (`check_rate_limit`) reciben argumentos tipados. |
| 3 | **Leer la cartera de otro** | ✅ | RLS en todas las tablas, con política por `auth.uid()`. La clave anónima no da acceso a nada sin sesión. |
| 4 | **Token de ingest robado** (el del lector de notificaciones) | ✅ | 256 bits de `crypto.getRandomValues`, viaja **en cabecera** (no en la URL, que acaba en logs), y se compara en tiempo constante. Rate limit de 60/min por IP. `tests/security.test.mjs` falla si alguna credencial vuelve a salir de `Math.random()`. |
| 5 | **Notificación falsa** que apunte un gasto que no existe | ⚠ | El `ingest` valida el token, así que hace falta robarlo primero (#4). Con el token, sí se pueden inyectar movimientos. **Impacto: datos sucios, no robo.** Se asume: el arreglo real es firmar cada apunte, y no compensa hoy. |
| 6 | **Replay** de una petición legítima | ⚠ | El `state` del OAuth caduca a los 30 min y **solo vale una vez**, así que el paso crítico (autorizar un banco) está cubierto. El `ingest` no tiene anti-replay: repetir la misma petición duplica el gasto. Mitigado a medias por el dedupe del cliente. |
| 7 | **Función pública abusada** (`ingest`, `myinvestor-keepalive`) | ⚠ | `ingest`: token + rate limit. `myinvestor-keepalive`: secreto guardado **en la BD** (`cron_secrets`, con RLS sin políticas → nadie lo lee desde fuera), nunca en el repo. Falta rate limit en `prices`, `categorize` y las `bank-*`. → **tarea abierta**. |
| 8 | **Basura en el cuerpo de una petición** | ❌ | **Sin auditar.** Ninguna Edge Function valida tipos, tamaños ni rangos de forma sistemática: un campo inesperado da un 500 en vez de un 400. No es robo de datos, pero es la puerta por la que se cuelan los problemas de verdad. → **tarea abierta, la más gorda de esta página.** |
| 9 | **Datos personales en los logs** | ⚠ | `guard-privacy` vigila el cliente (que no se logueen importes ni correos). Lo que acaba en `app_events` y en Sentry **no está auditado**: un mensaje de error puede arrastrar un importe o un IBAN. → **tarea abierta.** Las métricas de uso nuevas (4.13.0) sí nacen cerradas: vocabulario fijo en `USO_OK`, sin texto libre. |
| 10 | **Secretos en el repo** | ✅ | Repo público y ni una clave dentro. Los CSV de extractos están en `.gitignore`. El espejo de la memoria (`npm run memoria`) **aborta** si algo sensible sobrevive al filtro. |
| 11 | **Bundle OTA manipulado** | ⚠ | Se descarga de GitHub por HTTPS y solo avanza de versión (`_mcNewerVer`). No hay firma propia: quien controlara la cuenta de GitHub podría publicar un bundle. Se asume — es la misma confianza que ya se le da al repo. |
| 12 | **Móvil perdido o prestado** | ✅ | Bloqueo por huella opcional (Ajustes → Cuenta). Sin él, quien tenga el móvil desbloqueado ve la cartera: igual que cualquier app de banco sin PIN propio. |
| 13 | **Un banco corta el acceso por «uso robótico»** | ✅ | No es seguridad, pero se comporta igual de mal: desde la 4.1.0 **no hay auto-sync** al abrir ni al volver a primer plano. Los syncs vivos están listados en `ARQUITECTURA.md`. |

## Lo que sale de aquí (y va al ROADMAP)

1. **Validar la entrada de las diez Edge Functions** (#8) — tipos, tamaños y rangos de cada campo,
   con un test que mande basura y espere un **400**, no un 500.
2. **Auditar qué acaba en `app_events` y en Sentry** (#9) y limpiarlo **en origen**, no al leerlo.
3. **Extender el rate limit** a `prices`, `categorize` y `bank-*` (#7) — o dejar escrito aquí por
   qué no hace falta en cada una, que también es una respuesta válida.

Las tres estaban ya en la tabla de la review; lo que añade esta página es **por qué** importan y
en qué orden. La #8 va primera porque es la única marcada en rojo.

## Cómo se mantiene

Esta página **no se actualiza sola y no la vigila ningún test**. La regla es la de la casa
(AGENTS §6 bis): si un cambio toca autenticación, permisos, una Edge Function o algo que viaje a
la nube, se revisa la fila que le toque **en el mismo commit**. Un modelo de amenazas que miente
es peor que no tenerlo, porque da tranquilidad falsa.
