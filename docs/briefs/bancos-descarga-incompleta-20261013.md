# Descarga incompleta: revisión de reservas del13/10/2026

Task vigente: `bancos-descarga-incompleta-revision-reservas-codex-20261013`.
Claim/base canónica124: `f5904735b514751ee926d25c22c92195b6ce3653`, inmutable.
Rebase de los tres commits propios de PR223 sobre la dependencia REMOTA expresamente ordenada:
`origin/claude/brokers-falsa-caducidad`, `2d53ab24dc32a83faf17ce08c3b2d50b304d8e55`.
Esa dependencia contiene VERSION4.26.122; no es un rollback publicado de beta124.
La rama ajena se conserva. La ejecución propia se revisa contra2d53, no contra una integración nueva.
El result histórico9798 y su enmienda terminala7b1 permanecen cerrados; esta revisión tiene claim/result nuevos.

## Qué corrige

- La ventana que rebasa páginas/filas y lleva acuse119 conserva las filas sin id. El handler y
  el cliente reales importan60 de84 (igual que la base2d53), y2000 filas en el límite de filas.
  Tres pulsaciones conservan bankTx/libro y su multiplicidad, sin sumar otra copia.
  Sin acuse o con enlace/cuenta cortados por otra causa no se acredita identidad ambigua.
- El guard de fecha se aplica también al prefijo sellado. Omitir previous equivale a [].
  Un expired explícito retira el snapshot bankTx del banco, conservando sus asientos de Gastos.
- El límite de ventana explica que faltan movimientos y ofrece Importar histórico para buscarlos.
  El timeout explica que el banco tarda y permite reintentar. El tramo antiguo pendiente tiene
  una respuesta real: cuentas completas, gapPending y page_limit del siguiente trozo; conserva
  además el visto de actualizado de los saldos. bank_read_failed se retira de es/en/ca.
- transactions_budget se clasifica como límite propio, no provider_error.
  readChunk conserva el motivo tanto al quedarse sin llamadas como al recibir un trozo cortado.
- El catch/consulta de sesión de Claude quedan intactos. El arnés recibe ebFailure,
  ebSessionVerdict y decryptSessionId real. Solo hay UN logObDemandResult por enlace;
  el diagnóstico posterior de autenticación de Claude sigue aparte.

## Pruebas y frontera de ejecución

Los40 casos iniciales reprodujeron35 PASS/5 FAIL antes de la corrección. El foco ampliado termina
en51 PASS/0 FAIL, incluyendo base real, estado entre pulsaciones y el bloque real del reporte.
Once mutantes dan EXIT1: excepción119, acuse ausente, futuro, enlace/cuenta truncados,
ambas causas readChunk, budget, texto engañoso, actualizado y snapshot caducado.
Fuente y artefactos se restauran byte a byte. Deno nativo:34 PASS/0 FAIL en
enablebanking/demand-window/crypto. Los demás focos y los exits constan en el result.

El e2e revisado tiene24 casos es/en/ca y recibe el JSON del handler actual mediante un transporte
sintético compartido (tests/helpers/bank-download-fixture.mjs), no flags fabricados en el spec.
Comprueba avisos, extracto previo, prefijo sin id, repetición de los límites y el actualizado.
Primera focal remota38410341236:15 PASS/9 FAIL,1worker/0retries/0skip. Los seis
segundos clicks intentaban atravesar el reporte abierto; tres aserciones concatenaban el icono
con un espacio que el DOM no tiene. Se cierra el reporte antes de la segunda pulsación y se
comprueban texto/icono por fila. El run completo anterior se canceló al cambiar el SHA; no es
un pase. Se bloquea además toda petición externa del navegador. Nueva ejecución/EXIT exactos
se consignan en PR/result; ningún resultado se hereda de la sonda ajena21/21.

test.yml admite focal_spec opcional: agrega un job focal independiente con1worker/0retries y
reporte JSON, sin cambiar ni condicionar el job test completo. Así un rojo de catálogo/versión
no inventa aceptación DOM ni impide obtener la evidencia que pide esta revisión. Las etiquetas
de ambos jobs y sus gates siguen separadas. No se ejecuta Chromium ni suite pesada local.

VERSION/notas/catálogos/Retiro/topes se mantienen como los de la dependencia. Los rojos de
frescura y tamaño son gates de integración declarados (1.385.472/1.382.400 B minificados,
380.463/379.904 B gzip), sin aflojar oráculos ni guardar código
para ocultarlos. Sin main/beta, despliegue, SQL/RLS, APK o consulta de banco/DB real.
FIN01 ajeno sigue retenido. B no se reclama hasta verificar el result/release de A.

## Primera entrega, evidencia histórica (no es el estado de esta revisión)

### Descarga bancaria incompleta — candidato13/10/2026

Encargo `bancos-descarga-incompleta-codex-20261013`. Base histórica122
`e6e211a5d94e50b03597d5c91230c974d3e72232`; ejecución rebasada sobre123
`3625fa7ed5134cfbc5e364adc4f588bfdaf670c0`. Fuente para revisión; no despliegue ni publicación.

## Por qué aparecía el mismo aviso

Inventario de la base122, anterior al cambio:

| Camino | Fuente | Qué veía la persona |
|---|---|---|
| Tope12 páginas/2000 filas, continuación repetida o error después de una página | `_shared/enablebanking.ts:91-138` devuelve `truncated` o `transactionError`; `08-motor-bank.js:2376-2393`, `bankReadWarnings` | El mismo `bank_read_partial` |
| Tramo antiguo todavía pendiente, aunque la ventana actual terminase bien | `11-app-main.js:782`, `l.gapPending` | El mismo aviso; podía duplicarse con el anterior |
| Causa perdida antes de la primera página | `bank-sync/index.ts:72`, `logObDemandResult` | Registro `error`,0 páginas sin causa; UI podía mostrar fallo genérico |

Los textos de `01-i18n.js:2696/2765/2834` eran:

- es: «{bank}: la descarga está incompleta. Lo recibido se conserva, pero pueden faltar movimientos.»
- en: «{bank}: the download is incomplete. Received transactions are kept, but some may be missing.»
- ca: «{bank}: la descàrrega és incompleta. Es conserva el que s'ha rebut, però poden faltar moviments.»

Los avisos de reconexión,429,timeout o cuenta fallida tenían prioridad en el helper. La ruta
directa `gapPending` de App no distinguía esa prioridad. Además, `11-app-main.js:693/739`
sustituía el extracto guardado por el prefijo nuevo, tanto para las pruebas de pago como al
devolver el estado. Un saldo leído correctamente no demostraba movimientos completos.

## Cambio y fronteras

El lector emite `readReason`: `page_limit`, `row_limit`, `time_limit`, `repeated_cursor`,
`invalid_response`, `provider_error`. El log añade listas saneadas `reasons`/`failureCodes`;
el mensaje libre del proveedor no se copia. La continuación repetida termina con error parcial
y no ofrece un acuse de lectura completa. El cliente distingue interrupción externa, límite
propio y tramo antiguo pendiente en es/en/ca; conserva el fallback de servidor anterior.

El adaptador mínimo de App pasa `prev.bankTx` a `flattenBankTx`. Un banco incompleto conserva
sus filas anteriores y admite solo filas nuevas BOOK con id no ambiguo, importe finito y fecha
válida no futura. No corrige ids ya guardados ni importa filas nuevas sin id desde un prefijo:
sin identidad no se puede distinguir una repetición de otro cargo igual. Los bancos completos
siguen sustituyendo su extracto como antes. El importador y las decisiones financieras no se
reescriben; los tests ejecutan las lápidas, ordinales, gemelos y marcas de recibo heredadas123.
Un motivo en el enlace puede corresponder al SIGUIENTE trozo antiguo no recibido: si todas las
cuentas devueltas están completas, el prefijo antiguo entregado ya está sellado y119 puede
acusarlo. Sus filas sin id se conservan con la multiplicidad máxima entre lectura y caché,
por banco/día/importe/comercio/estado, no sumándolas. Una cuenta realmente cortada continúa
rechazando nuevas filas sin id. Esto no cambia el importador ni el cursor: evita quemar filas
de un prefijo completo que el cliente recibió antes del fallo posterior.

**Cursor119:** proveedor/timeout/repetición no adelantan el tramo no recibido. La recuperación
antigua solo acusa trozos completos ya sellados. La excepción anterior de ventana que desborda
12 páginas/2000 filas sigue avanzando/ofreciendo acuse para no atascar el hueco permanentemente;
`bank-sync-progreso` exige esa política. No se presenta esa excepción como garantía de haber
leído todo. No cambian `allRead`, escrituras de cursor, `ackCursor`, `keepsCursor`, cola ni auth.
El catch diario reservado a Claude permanece idéntico al padre123.

## Trade Republic:100 filas,1 página, sin continuación

La [FAQ oficial de Enable Banking](https://enablebanking.com/docs/faq/) exige seguir con los
mismos parámetros mientras haya `continuation_key`, incluso tras una página vacía.
La [referencia API](https://enablebanking.com/docs/api/reference/) define su ausencia/null como
fin del paginado. El código devuelve completo en ese caso antes de aplicar los topes propios;
100 está por debajo de2000 y1 por debajo de12. No se encontró una garantía oficial específica
que permita afirmar que100 significa truncamiento de TR. Es evidencia insuficiente para
inventar un aviso o movimientos ausentes; el test mantiene completa esa respuesta.

Si el proveedor confirma un límite por banco o una evidencia autorizada demuestra que falta
un subtramo, se podría proponer una capacidad explícita del proveedor o una comparación de
rangos cerrados. Eso requeriría otro alcance y sus consultas acotadas: no se introduce aquí
una heurística por contar100, nuevas consultas ni acceso al banco real.

## Verificación y lo no probado

- Base122: el primer banco causal dio5 PASS/20 FAIL, EXIT1. Tras el arreglo y rebase123:
 34 PASS/0 FAIL, EXIT0. Dos casos comparan el updater real123 con el candidato y comprueban
 los dos consumidores del extracto; otros tres prueban lápidas reales y ordinal/vínculo resuelto.
 La regresión adicional del handler+updater reprodujo32 PASS/2 FAIL antes del ajuste de prefijos
 sellados: exige que la fila antigua sin id entre antes de su acuse y no sume otra vez el grupo.
- Seis mutaciones causales dieron EXIT1 y se restauraron: retirar extracto previo, declarar
 completo el cursor repetido, atribuir el tope al proveedor, filtrar causa libre, descartar el
 prefijo sellado y sumar su multiplicidad a la caché. Los artefactos se regeneraron desde fuente.
- Node focal: paginado, progreso, acuse, reconexión, hueco, recuperación, invariante de recibos,
 mapa, i18n, seguridad, sintaxis y privacidad dieron EXIT0. Build EXIT0. `docs-frescura` pasó
 antes del commit; después dio EXIT1 solo porque hay código candidato tras el ancla123 sin
 bump autorizado. Todos los números de versión siguen alineados. No se fuerza esa puerta.
- Deno2.9.0 real: `enablebanking.test.ts` y `demand-window.test.ts`,23 PASS/0 FAIL, EXIT0,
 con `--no-lock --cached-only --allow-env`. Sin nuevo fichero de lock ni dependencia.
- Presupuesto oficial de123: EXIT1. Medición con el mismo test y solo formato de bytes:
 1.386.301 B minificados frente a1.384.448 B (exceso1.853 B);
 380.786 B gzip frente a380.928 B (margen142 B);3 bloqueantes frente a3.
 No se amplían topes, no se recortan contratos para caber. El sellado final se mide en integración.
-21 casos DOM registrados; **sin ejecución local de Chromium**, por el turno ocupado ajeno.
 CI remota sobre SHA final pendiente al escribir esta evidencia; un fallo anterior a Playwright
 deja esos21 sin verificar. No hay prueba con cartera real, proveedor real, móvil ni servidor desplegado.
- `beta-sources` local alcanzó18 casos sin fallo mostrado, pero el proceso recibió SIGTERM por
 el límite de60 segundos del arnés: EXIT no disponible. No se declara verde ni se repite una
 suite costosa local; el veredicto completo corresponde a la CI remota.

La revisión limpia y la entrega beta corresponden al coordinador. VERSION, notas, catálogo,
topes, workflows, APK, SQL y producción no forman parte de este candidato.
`npm run build` regenera `public/index.html`, idiomas y los campos derivados de huella de
`public/beta-delivery.json`/`public/release-notes.json`: no añade notas o tandas ni repina
`scripts/beta-sources.json`. Las identidades históricas y la revisión de catálogo corresponden
a integración; las huellas derivadas nuevas no acreditan aceptación.
