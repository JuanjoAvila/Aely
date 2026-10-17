# SEC03 · consumo único del callback bancario

Remates privados sobre `7ce911a2bbd19e1d710cba1284bf0a7ff8a637c7`, misma PR257,
por GO de revisión `9751cc0391055f6eb66ac79b243db5ab729b9e03`. El predecesor queda
inmutable. La primera entrega partió de la fuente aprobada PR249 `53688288`
con GO causal `68d79894adb2b7a67448c062c36b0a09d65d93b7` y consulta `c9be87b4`.
Sin despliegue, migración ni SQL vivo. Este SEC03 de callback es distinto del
histórico SEC-03 de privacidad de logs.

## Problema y cambio

Dos callbacks podían leer el mismo state válido y ambos seguir a OAuth: el
UPDATE anterior filtraba solo por id y no comprobaba error ni filas afectadas.
Con dobles sintéticos y snapshots separados se observaron dos intentos de canje
y dos escrituras; el control secuencial solo canjeó una vez. Además, un error
devuelto al consumir no impedía el canje, y un error al guardar la sesión se
anunciaba como éxito. No se afirma aceptación doble de códigos por un banco real.

El consumo ahora filtra por id, state original y emisión del snapshot (IS NULL
para legacy), y pide el id actualizado. Solo una fila con el id esperado y sin
error permite OAuth. Cero filas, error, excepción, respuesta ausente o forma
inesperada detienen el canje y la escritura final. El guardado final también exige
una fila con el id esperado y sin error; cero filas o respuesta no verificable
devuelven error cerrado. Se reutiliza `error`, ya traducido,
con302 web y puente APK; no cambia el cliente ni añade códigos.

No hay restauración ni reintento de state: ante commit con respuesta perdida,
leer después null no prueba quién lo consumió; hay que reconectar. Esto falla
cerrado en la autorización y no cambia el fail-open del rate limiter.

Se conserva el orden IP hash60/60 → lookup → caducidad30min → usuario10/600 →
consumo → OAuth → guardado, así como compatibilidad legacy, cuentas y cursor.

## Primera entrega `7ce911a2` · evidencia conservada

`tests/bank-callback-state.test.mjs`, registrado en steps y recorte servidor,
ejecuta el handler y helpers reales con BD stateful, barrera de snapshots y
OAuth/cifrado sintéticos. 37 casos PASS, EXIT0. Cubren ambos retornos, ganador
único/replay, cambios de state/emisión, borrado, errores antes/después del commit,
respuesta ausente/cardinalidad/id inválidos, legacy, cuotas/orden/caducidad,
cursor y error de guardado final.

Cuatro mutaciones textuales del handler mueren por las mismas aserciones,
cada proceso EXIT1:

| Mutante | Fallo observado |
|---|---|
| `sin-state` | Dos intentos OAuth en vez de uno, web y APK |
| `acepta-cero` | Éxito tras borrado, nuevo state o emisión cambiada |
| `acepta-error` | Éxito al aceptar una respuesta con error y fila |
| `exito-sin-guardar` | Éxito web/APK pese a error de guardado final |

El doble error+fila es deliberadamente contradictorio para comprobar la guarda
explícita de error, no una respuesta real de PostgREST observada. Las mutaciones
no se basan en aserciones de texto ni alteran las fuentes guardadas.

La ejecución local utiliza un adaptador privado Node24 `stripTypeScriptTypes`
en lugar de esbuild, ausente en el checkout OWN; el test registrado mantiene
esbuild para Node20 de CI. No se instalaron ni prestaron dependencias. No es
una ejecución stock de esbuild, Deno, SDK, Postgres o transporte real.

Tras el cambio causal del handler y los dobles de UPDATE, pasan también los tres
grupos focales de cuotas/state del callback, reconexión, las20 carreras de
revocación/callback, entrada-edge y el guardián de recorte. No se repiten los
doce mutantes SEC02: su footer estático en el runner focal no acredita ejecución.
Privacidad completa sale EXIT1 por `@sentry/browser` ausente; su caso del callback
sí pasa. Los dos primeros fallos del test nuevo fueron prototipos de objetos
de VM en aserciones de cuota: corregidos clonando los argumentos del doble,
sin cambiar producto; no son ROJO causal.

El ROJO anterior7 FAIL/7 controles y modelo11 PASS se conservan como evidencia
de investigación; no se repiten ni se presentan como validación de este fix.

## Remates de revisión `9751cc03` · validación privada actual

El doble distingue `.eq(col, null)` de `.is(col, null)` tanto al leer como al
actualizar. El primero no casa con SQL null; el segundo conserva el enlace legacy.
Contrato cotejado con [eq](https://supabase.com/docs/reference/javascript/using-filters-eq)
e [is](https://supabase.com/docs/reference/javascript/using-filters-is). El guardado
final encadena `.select("id")` y comprueba error, array, cardinalidad e id; pedir
filas se corresponde con [select tras UPDATE](https://supabase.com/docs/reference/javascript/using-modifiers-select).
No añade predicados de generación ni reintentos.

El nuevo ROJO ejecutó el handler original `7ce911a2`, con tests nuevos y doble
corregido:21 casos,11 PASS/10 FAIL, EXIT1. Dos fallos son borrado real entre
consumo y guardado final (web/APK); ocho son respuestas sin confirmación válida.
El verde focal del handler corregido ejecutó31 casos, EXIT0: esos21 y los diez
controles afectados de ganador único/replay, cuotas, caducidad, cursor y error
final. `SEC03_TEST_GROUPS` permite seleccionar esos grupos sin repetir los25
casos no afectados del mismo archivo. El default registrado contiene56 casos;
no se afirma una ejecución nueva de todos ellos ni de las suites anteriores.

Cinco mutantes textuales afectados terminan EXIT1 por aserciones del handler:

| Mutante | Oráculo que lo mata |
|---|---|
| `legacy-eq-null` | Legacy debe completar y conservar cursor; con eq(null) se rechaza |
| `final-acepta-cero` | Fila borrada no puede anunciar éxito web/APK |
| `final-sin-json` | Guardado correcto debe devolver éxito; sin representación no se confirma |
| `final-acepta-error` | Error+fila contradictorio sigue rechazado |
| `exito-sin-guardar` actualizado | Error final nunca anuncia éxito |

El primer intento del último mutante falló por ancla LF/CRLF sin ejecutar casos:
se conserva y se excluye de causalidad. Se normalizó solo el texto de las anclas
y se repitió únicamente ese mutante, que entonces dio2 fallos runtime. Los otros
cuatro no se repitieron. El verde31 precede a esa normalización de saltos de línea;
producto, fixtures y oráculos del verde permanecen iguales.

La cadena de escritura final cambió, por lo que se ejecutó lifecycle real con
Deno2.9.0 instalado, SDK real y REST/OAuth sintéticos:16/16, EXIT0. Args:
`test --cached-only --no-config --no-lock --no-prompt --node-modules-dir=none supabase/functions/bank-disconnect/lifecycle.test.ts`.
Sin allow-net/run/write, descargas ni instalación; el fixture REST existente ya
devuelve representación y no necesitó edición. Sus avisos de cuota son fail-open
del doble sin RPC, no evidencia de contadores vivos. Los16/16 del revisor sobre
`7ce911a2` siguen siendo evidencia distinta de esta nueva ejecución.

Solo callback, test y este brief cambian. La ausencia de esbuild/Sentry y los
EXIT1 de la primera fase se conservan; no se repiten ni se presentan como verdes.
Sin fetch/canal/avisos/activación de presupuesto/push/PR/result durante esta fase.

## Límite explícito: SEC-04

Una autorización nueva durante OAuth todavía puede recibir la escritura final
del callback antiguo, que sigue filtrando por id. No se introduce una guarda
ABA por fecha: Claude la excluye de esta PR y reserva `connection_version` para
SEC-04, registrado en BACKLOG. No se amplía bank-connect ni el esquema.

Pendientes: ejecución stock de Node/esbuild y privacidad completa, Postgres y
transporte real, revisión final Claude, CI general/docs-frescura/beta-sources e
integración tras PR256 por Claude, artefacto servido,
despliegue por Claude y aceptación móvil. Sin fullsuite, CPU6, Gradle, bancos,
migración/SQL vivo ni cambios09, hoja, VERSION, catálogo, caps u oráculos.
