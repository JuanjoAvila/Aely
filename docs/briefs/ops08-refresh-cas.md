# OPS-08: guardado de refresh entre keepalive y sync

Candidata sin despliegue. GO causal de Claude `5267ceb4`, propuesta A solamente.
La rama nace de PR241 `fdc0524d` y reconcilia sin conflictos main exacto `a9916c3c`
en `70c49941`: conserva la telemetría/timeout/guardas de PR241 y las protecciones
de contador/reconexión de main. No modifica la rama congelada de PR241.

La reproducción inicial en main da EXIT1, 7 fallos y 4 controles; la base reconciliada
da EXIT1, 4 fallos y 7 controles. El caso más fuerte no presupone dos consumos
concurrentes del mismo refresh: sync guarda R1, pierde el acuse, keepalive usa R1
y guarda R2, y el reintento de sync restaura R1. También se cubren ambos órdenes
con una primera respuesta sin refreshToken y una rotación posterior.

`miSaveRefresh` compara atómicamente usuario, `connection_version` y refresh almacenado;
si no rota el refresh, compara también acceso almacenado. Reutiliza un único patch
cifrado en un máximo de dos UPDATE, y sólo reintenta si falló y el readback conserva
el snapshot. Un error de transporte no acredita fracaso del commit: el readback
reconoce el patch propio, otro enlace/token o un resultado indeterminado. Cero filas
sin error nunca cuenta como guardado confirmado. No repite llamadas al banco.

El recifrado legacy de sync usa ese CAS antes de releer el snapshot coherente;
`token_store.ts` no se amplía. El rechazo usa guarda de refresh y conexión en el
UPDATE de caducidad, cerrando la ventana entre SELECT y UPDATE. Sin versión de
conexión disponible, keepalive omite el enlace antes de consumir su credencial.

Pruebas registradas en el runner: Deno `myinvestor-token-race.test.ts`, junto con
los contratos existentes de contador y los Node focales de keepalive/sync. Los
mutantes eliminan refresh/conexión/acceso, CAS de cada escritor, acuse de filas,
control de error o reintento guardado, y repiten refresh. La entrega publica sus
EXIT reales y limitaciones; un fallo de infraestructura no cuenta como mutante muerto.

Límite explícito: CAS evita escrituras obsoletas, pero no serializa los consumos
en el proveedor. Si éste acepta dos rotaciones concurrentes, el primero que
persista puede no ser el último token emitido. OPS-09 queda como propuesta de
serialización por usuario, fuera de esta candidata, sin migración/RPC.
Despliegue exclusivo de Claude; CI general, servidor real y aceptación móvil
no se deducen de los fixtures sintéticos. No cambia VERSION, catálogo ni oráculos.

Referencias actuales de API: [UPDATE y retorno de filas](https://supabase.com/docs/reference/javascript/update),
[igualdad y NULL](https://supabase.com/docs/reference/javascript/eq).

## Remates de revisión de PR252 (GO e3d09d2f)

El caso M10 ahora entrega un refresh distinto en cada una de las tres pulsaciones
manuales que siguen en 401 tras renovarse: exige caducidad en la tercera, tres
refresh y seis lecturas, sin posiciones ni otro intento bancario. Quitar
`link = { ...link, ...enc }` deja el snapshot viejo y hace fallar ese caso con
`refresh_raced` en lugar de ofrecer reconectar. La asignación de producto se conserva.

El inventario local de la fuente4aa3e015 no encuentra consumidores de producción
de `ensureMiLinkEncrypted`: sólo su definición, dobles y una prueba que lo invoca.
Se retiran esa función, su fixture y esa prueba; las pruebas del recifrado real
guardado en sync permanecen. La referencia histórica del CHANGELOG describe su
versión antigua. La mención previa a token_store sin cambios corresponde a la
primera candidata; este remate retira únicamente el helper sin consumidores.

Faltar `connection_version` emite `connection_unavailable`, manteniendo el mismo
payload cerrado y sin llamadas bancarias ni UPDATE. No se presenta como fallo de
guardado. Candidata para revisión, sin despliegue; estos remates no repiten los
nueve mutantes anteriores ni acreditan CI o entrega por su evidencia sintética.
