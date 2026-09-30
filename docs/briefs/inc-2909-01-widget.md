# INC-2909-01 · Widget: periodo y magnitud

**Revisión 1/10: PR87 NO-GO sobre 26c2fd08 y primera variante PR90 NO-GO sobre 51641d80. Reparación cliente/nativa verificada localmente con 34/34 DOM; fuente 4.26.76 provisional. Pendientes GO independiente y CI; nada publicado, instalado ni desplegado. Coordinador asigna versión y APK finales.**

El dueño comunicó Balance en widget mientras Inicio mostraba Mi ciclo. Contrato antiguo: mes natural y shown, igual que ingest, anunciado por Android como gastado. Cambiar solo web a bruto haría alternar cifras; OTA no cambia Java/textos de APK51.

## Reproducciones contra PR87

Fixtures ficticios, sin consultar datos familiares:

| Caso | Resultado ejecutado | Gate |
|---|---|---|
| APK51 compras500/ingreso1800 | Web500 frente ingest legado1300/margen2300 | Conservar payload completo legado. |
| Respuesta incompatible, foto sin ACK | pendingUnknown no conserva identidad; app limpia aviso | Reentrada no demuestra inclusión. |
| Backend propuesto, filas/reserva mañana | App neto120/presupuesto1000; servidor140/900 | Falta límite superior. |
| Backend, ancla ausente | Neto−1660 en el mismo fixture | No inventar margen por falta de evidencia. |
| Ciclo desactivado, ventana antigua | ventanaDelWidget sigue devolviendo ciclo | Persistencia no prueba selección vigente. |

Dos primeros: guardianes rojos y verdes Node/Java reales. Otros: fuente Git exacta del backend propuesto, que queda en NO-GO.

## Variante cliente/nativa

- APK51 mantiene payload legado sin camposv2. Ingest/SQL intactos; delta original53561b09 de PR87 separado.
- Negociación widgetContract termina antes del primer envío; ninguna foto legacy provisional degrada v2 guardado.
- V2 usa dashboardBudgetStats: mes=gasto bruto, ciclo=gasto neto con signo (gasto−otros ingresos), excluyendo nómina ancla. Nunca se etiqueta Balance (ingresos−gasto). Gastos conserva sus preferencias. Periodo, magnitud e idioma explícitos, también con presupuesto.
- Alcance parcial de INC-2909-01: seguimiento de Inicio/presupuesto. No reproduce la vista Balance de Gastos; selección de modos y aceptación móvil permanecen abiertas.
- scope vincula ventana/ancla/magnitud/presupuesto reservado/bancos de gasto/banco widget. Respuesta v2 debe demostrar misma ventana y alcance no vacío idéntico. Servidor activo y PR87 sin esa evidencia quedan rechazados.
- unknownJournal conserva identidad, sin deltas inventados, hasta ACK/lápida verificable de foto app. Reentrada/cambio de periodo no equivale a cobertura. Cambiar alcance convierte deltas anteriores en desconocidos hasta ACK.
- App cerrada sin confirmación: «Abre la app», sin gasto/disponible/saldo. App abierta con lectura válida: misma magnitud que Inicio. No se promete suma autónoma hasta entrega backend propia autorizada.

## Verificación y límites

widget-coherente/arbitraje existentes registrados; Java real con orden inverso, ACK, lápidas, bancos,45d,mes/ciclo,textos y desconocidos persistidos. DOM widget-banco ya mapeado, ampliado es/en/ca con neto negativo, otro banco, neutras/duplicados, reservas/futuro, día1 y negociación retrasada.

DOM final: **31/31 PASS**, 49,7 s, sin reintentos, TZ UTC y contexto Europe/Madrid. La primera pasada dio 28 PASS y 3 fallos de una expectativa incorrecta del identificador manual del ancla; se corrigió el fixture, conservando importes y comportamiento. El guardián Node fija el reloj al 27/9 para que el día 1 no convierta una nómina sintética en futura.

Compilación Android real :app:compileReleaseJavaWithJavac correcta tras apk:prep en este worktree. No APK final: candidata Claude311a7c29…9734 es de otra fuente. Runner local de lógica omitió Chromium por turno y Deno por ausencia; memoria-espejo externo preexistente. El exceso propio minificado se corrigió: 1.264.588 B bajo el tope existente; gzip 344.445 B exige +1 KiB documentado. CI y SHA final pendientes.

FIN05 mantiene prueba real de pago/reentrada. Nómina pertenece a INC3009-02: aquí se reutiliza Inicio sin reconstruir ancla desde feed local ausente. Backend futuro debe validar selección/fecha/ancla compartida y calcular alcance, nunca eco de cadena. Despliegue expreso de una función, sin SQL/migraciones.

Repetición final Node en UTC, 1/10: widget-coherente, Java/arbitraje, sintaxis, idiomas, frescura y presupuesto PASS. Runner completo de lógica **no verde**: memoria-espejo externo desfasado y cuatro fixtures dependientes del día 1 (`cuotas-deudas`, `invest-category`, `saldo-por-banco`, `rol-cuenta-sin-salto`). Los cuatro fallan también ejecutados contra un `git archive` de la base intacta a03a2a06; quedan fuera de esta reparación. Deno ausente se omite; Chromium se verificó por separado. Recompilación Android final BUILD SUCCESSFUL, 69 tareas, sin instalar ni publicar APK. El coordinador debe resolver los gates y asignar versión definitiva antes de liberar.

## APK local anterior, OBSOLETA por NO-GO · 1/10

Fuente cliente/nativa congelada `51641d8061b48fb6c35795d704a197c0d4cc15ce`, [PR90 borrador](https://github.com/JuanjoAvila/Aely/pull/90). `apk:prep` y `assembleRelease`: BUILD SUCCESSFUL, 201 tareas. APK 6.493.066 B, SHA-256 `f24e8fffff4b75a88996f29d7bd04000ace7aae2158a9a8eefaf384e8a779b7c`; aapt acredita `com.micartera.app`, **metadatos anteriores 4.26.55/code51**. No se asigna versión nueva aquí: **solo artefacto de revisión, no instalar ni publicar**. La entrega definitiva exige recompilar con versión/code autorizados y volver a cotejar firma, aapt y hash.

Apksigner verifica esquemas v1/v2, `CN=Mi Cartera`, certificado SHA-256 `e4cf4a212911890007a66c870bf5859685b315967f7fe752295b52620648f01b`. Assets del ZIP idénticos a `www` generado por `apk:prep`, web 4.26.76; DEX contiene WidgetPeriod, unknownJournal y textos nuevos. BuildConfig release: DEBUG/WEB_DEBUG false, INGEST_URL vacía. Configuración de firma copiada retirada tras compilar, sin copiar token; dos archivos generados de Capacitor restaurados. Sin subida, instalación ni cambio de apk.json/canales/Edge.

## NO-GO de Claude y reparación posterior · 1/10

Claude reprodujo contra 51641d80: ciclo desde 26/9, foto 100 €, pago 29/9 de 30 €, reentrada 2/10 con foto 130 €; la cobertura mensual omitía el evento y Java sumaba 160 €. El nuevo guardián ejecuta el bloque real del pull, construye su cobertura y pasa ese ACK al árbitro Java: **rojo 160≠130, verde 130**, sin cambiar importes. También prueba el mismo ciclo sin ACK, unknownJournal con ingest legado y recepción real de un evento de la ventana anterior. La APK local de 51641d80 queda **obsoleta**, no prueba esta reparación.

V2 construye cobertura al enviar usando las filas del último pull completo: incluye la ventana del ciclo y también identidades anteriores efectivamente recibidas, porque pueden afectar al saldo actual. No acredita filas futuras. Legacy conserva su cobertura mensual histórica exacta. Un desconocido ausente del pull sigue bloqueando, incluso al cambiar de ventana: la fecha no demuestra saldo; se retira solo por identidad recibida o lápida. No se reutilizan deltas de otra selección.

Negociación sin respuesta: tras 3 s el nativo oculta cifras con aviso, se reintenta tras otros 3 s y no se envía contrato legacy por timeout. La APK nueva rechaza todo payload sin v2 antes de modificar la foto y solo una foto v2 válida limpia el aviso; APK51 ejecuta su receptor antiguo. Test del efecto JS real con reloj controlado: timeout, aviso, retry y resolución v2 PASS; Java real rechaza contrato 0/1 y admite 2. Compilación Android final PASS. DOM ampliado a 34 casos: **34/34 PASS**, 52,1 s, sin reintentos, TZ UTC y contexto Europe/Madrid; lease 10 liberado, sin más Chromium previsto. Pendiente revisión independiente nueva.

Tamaño de la corrección: minificado 1.264.964 B, 324 B sobre el tope anterior; +1 KiB documentado. Gzip 344.546 B dentro de 337 KiB. No se construye otra APK hasta congelar y revisar la reparación.

DOM ejecutado con código `cd9e58993f10125f00d1011ff0884f63ae912e4a`; antes de ejecutar se corrigió solo la expectativa del fixture legacy (50 € futuros según su contrato histórico, frente a 130 € del ciclo). Esa modificación del test y esta acta quedan en el commit final, sin cambio de fuente cliente/nativa. Primer intento restringido no pudo acceder al ejecutable Chromium y no abrió navegador: no fue una ejecución funcional. Repetición real con acceso al binario instalado y lease 10: todos PASS.

Rojos preexistentes verificados en UTC contra base `a03a2a06304c8542f4819a66ea1f5b5917a5c01a`: `cuotas-deudas` blob `87b25bee4b659c74c7044289355d6186afbd2b2f`, `invest-category` `2e3cbbd37c4e42a045a404d4eef6766dbe6fb878`, `saldo-por-banco` `c7ae96ed6452336a30ed70581c518db1eb086680`, `rol-cuenta-sin-salto` `4f9a1b66b3454cc9c11828bf2c3e9aa85f37ebe3`; mismos blobs en la candidata y mismos errores ejecutando la base. `sync-memoria.mjs` blob `220f7959c272713b0ffded4c184a77efa996f84f`, sin cambios: espejo externo ya desfasado antes de reparar. No se duplican las correcciones de fechas que gestiona el coordinador; la integración deberá traer su tooling verificado.
