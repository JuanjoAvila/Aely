# INC-3009-NOMINA-ANTICIPADA — un abono pendiente no es un cobro

## Injerto local76 sobre Panel75 · cierre de funciones y datos, 1/10

Rama codex/inc-3009-02-graft75-76 sobre569d792234abe76a5597b278c4be8cd0796cb5d7, parent75 final con arreglo exclusivo de fixture; src/scripts/public idénticos al GO de fuente e975c4a2. Se conserva la guardia revisada5c2146c3; solo11 líneas netas de importObExpenses. Core, Inicio73, Gastos, panel10, totals, Recibos74, calendario, Android, Edge y SQL iguales a parent. No reparación ni lectura de datos reales.

Root informa GO de fuente75 por auditoría independiente de funciones/datos e historia Git. CI36804139697 roja únicamente en fixture revisar-beta: esperó2 tandas y obtuvo11 por llegada asíncrona del recibo de producción. La corrección está incorporada en569d7922 (esperar2 y retrasar250ms el mock de entrega); no cambia runtime ni importes. CI75 nueva36805802277 pendiente. Root autoriza ahora subir candidata76 terminada, PR draft y CI completa sin esperar deploy75. Merge/publicación76 requieren75 servida y gates exactos del coordinador. Claude agotó cuota; no se atribuye un GO suyo a esta integración.

Registro Nómina conserva los alcances anteriores y usa la guardia beta-source-code del parent; no scanner nuevo ni excepciones nuevas. Guardia de funciones/datos detectó17 declaraciones adicionales (cloud/formatos/saldos/cachés y ventanas) y12 funciones transitivas. Se incorporaron por nombre exacto. No existe OB_NO_COBRADO en runtime ni en scope actual del parent; no hubo descriptor que retirar. Las baselines históricas congeladas permanecen intactas.

Validación actual:817 mutaciones de funciones y260 de datos pasan; Nómina tiene187 funciones y50 datos transitivos.15 contratos beta-sources,26 veredictos,14 tandas, build y sintaxis pasan. Fecha Madrid y su caché se añaden solo al scope TR actual porque el importador ahora los lee; la baseline histórica ampliada conserva SHA y referencias de e975 sin repinar. El panel mantiene2 OK idénticos (ayuda/arranque) y5 cambios web, con historia TR intacta.

Nota76 es/en/ca suma una tanda sobre las diez de75.196 notas base conservan textos y guiones; única variación histórica de src: retirar desde de TR en68. Historial, huella, codigoDesde y revisionesDesde originales intactos. No se borra ni fabrica ningún parte remoto.

84/84 contratos en cuatro zonas y107 etapas Node con único rojo memoria-espejo acreditan37ea02d0 antes de los deltas de tooling/metadata. Por orden del coordinador no se repite la suite completa ni18 DOM financieros con runtime idéntico. Dos mutantes propios status/future y cinco del panel fallaron semánticamente, sin ReferenceError. No Deno ni npm test local completamente verde.

A/B contra e975 (public idéntico a569d7922) con minificador real: base1.278.213/347.928 B crudos/gzip9;76 1.278.665/348.098 (+452/+170). Sello4.26.76.99:1.278.672/348.104 B. Tope heredado1249/340 KiB, margen304/56 B; no se amplía. Informe nomina76-e975-size.json. Sello de publicación y HTTP76 todavía inexistentes.

DOM anterior18/18 pertenece a aaa95803, no esta integración. Test conserva bruto de Inicio73/neto de Gastos; calendario UTC global, manual explícito y filas históricas quedan fuera. Sin nuevo Chromium; push y PR draft autorizados tras las comprobaciones finales. Revisión automática rechazó un aviso anterior al coordinador por autorización humana no acreditada; no se reintentó, y root recuperó el cierre leyendo este chat.

Todo el apartado siguiente conserva la evidencia del SHA revisado `aaa95803`, no un GO nuevo.

**30/9/2026 · Claude, encargo de Codex (diagnóstico + candidata beta).**

**Revisión independiente INC-3009-02 · 1/10/2026.** Base PR [#78](https://github.com/JuanjoAvila/Aely/pull/78)
`f37d605968f41c54487e10f50115dcaf6bc22c29`. Fuente 4.26.72 antigua **no publicable**: esperar
Recibos 74, Panel 75 y versión definitiva del coordinador. Parche separado, sin publicación móvil.

Runtime y pruebas congelados en `5c2146c31668cbee3c761107cbffb1981bd1feb8`.
Tras congelar el runtime, `docs-frescura` mantiene todos los números coherentes pero falla su
guardia de código posterior al último bump: es el bloqueo de publicación deliberado hasta la
versión definitiva. No se oculta ni se cambia la fuente 72 para saltarlo. El runner completo
citado debajo corresponde al árbol probado antes de ese commit.
Para integrar, portar la guardia inicial de PR78 y el delta de revisión del motor/tests, preservar
el contenido posterior de Recibos/Panel y reconstruir `public/index.html` con la versión nueva.
No fusionar los metadatos de versión 72 ni el artefacto antiguo. El verde local no es CI de la
futura integración; la revisión ajena sobre el SHA final la coordina el chat de entregas.

**GO independiente de código recibido el 1/10 a las 00:42:09 Europe/Madrid:** Claude revisó
`aaa95803ffe0b906ae33371e84f95857ebbdba3d` (runtime `5c2146c3`) en worktree detached,
con build limpia y sin Chromium. Su informe acredita dos mutaciones rojas: volver a admitir
estados desconocidos y quitar el corte de fecha futura hacen caer sus respectivos contratos.
Su runner solo falla `docs-frescura` por bump pendiente y `memoria-espejo` preexistente.
Este GO de código no aprueba publicación, calendario completo ni reparación histórica.

Cotejo adicional propio: `ob-ingresos --zone-child` ejecutado en UTC, Europe/Madrid,
America/New_York y Asia/Tokyo, 21 contratos por zona, **84/84 PASS**. El argumento explícito
importa: sin él el runner se relanza siempre en UTC/Madrid y cambiar solo la TZ exterior no
demuestra cuatro zonas distintas. No se ha vuelto a arrancar Chromium.

Riesgo conservador de lista blanca: si un banco usa `OTHR` u otro estado desconocido para un
abono contabilizado, la guardia lo deja fuera hasta conocer el contrato. No se inventa el ingreso
ni se añaden eventos con importes, comercios o secretos para investigarlo. Posible observabilidad
sanitizada requiere alcance propio; no se arrastra a este parche ni cambia saldos/histórico.

La revisión reproduce BOOK futuro admitido (1.800 € ficticios del 30/9 con reloj del 29/9),
estados `UNKNOWN`/` PDNG ` y fechas inexistentes. Aunque mañana no abría ciclo, ese ingreso
podía aumentar saldo/disponible mensual. Guardia reparada: estado normalizado BOOK o ausente,
fecha YYYY-MM-DD válida no posterior a hoy Madrid mediante `madridYmdParts` existente.
Se filtra antes de seen/keys: cuando llegue su día el mismo abono puede entrar.

`ob-ingresos`, ya registrado en runner, fija reloj y se relanza UTC/Madrid: 21 contratos por zona,
PDNG→BOOK, UUID estable al repetir, banco+id, renombrado sin id, manual genérico posible duplicado,
ancla y saldo tras sincronizar. PDNG con saldo 400 € deja cero filas; BOOK con saldo 2.200 € deja
una de −1.800 €, muestra 2.200 € y conserva presupuesto de ciclo 500 €; repetir no muestra
4.000 € ni duplica. Runner Node completo: 105 etapas Node, único fallo preexistente
`memoria-espejo`; sintaxis y mapa pasan. La frescura de números pasa y el gate de publicación
tras commit queda pendiente del bump definitivo. DOM `nomina-anticipada.spec.mjs`
registrado para motor: **18/18 PASS**, es/en/ca, 9 en Madrid (19,1 s) y 9 en UTC (19,2 s).
Lease 6 leído antes de cada arranque; liberado al acabar, cero procesos Chromium de Playwright.
Informes locales en `test-results/nomina-madrid.json` y `nomina-utc.json`.
El primer intento esperaba UUID antes del guardado diferido; se corrigió la espera del test.
La preferencia de balance neto se declara explícita; los importes no cambian para pasar pruebas.
Sin Deno, Edge, SQL, APK, datos reales ni publicación beta/main en esta revisión.

**Calendario residual, fuera de esta tanda por decisión del coordinador:** a 30/9 22:01Z, BOOK
del 1/10 es hoy Madrid y se admite en ambas zonas; BOOK del 2/10 no. Ancla/periodo aún usan día
del dispositivo: UTC puede mantener mes natural hasta 00:00Z y, con balance neto, mostrar
disponible 2.300 € con presupuesto 500 €/ingreso 1.800 €, mientras Madrid abre ciclo y muestra
500 €. No se declara corregido el calendario global ni cerrado
el fallo financiero completo; necesita objetivo separado. El DOM caracteriza esa diferencia.

**Identidad residual:** manual con nombre explícito+OB con nombre explícito no se emparejan por
parecido; el genérico queda possibleDup. Filas previamente importadas no se reparan/borran aquí,
ni se recomienda borrarlas por parecido sin decisión explícita sobre cada fila.

Texto para la futura versión de integración (sin publicar esta fuente antigua):
es: «Los ingresos bancarios pendientes o con fecha futura esperan al día del cobro.»
en: «Pending bank income and future-dated credits wait until the payment date.»
ca: «Els ingressos bancaris pendents o amb data futura esperen el dia del cobrament.»

## Síntoma (dueño, 30/9)

Una nómina apareció en Sabadell como movimiento normal antes de estar cobrada, y Mi ciclo arrancó con ella.

## Ruta y causa

1. `bank-sync` → `fetchBankTransactions` (`_shared/enablebanking.ts`) pide `/transactions` **sin filtrar el estado**: Enable Banking devuelve BOOK y PDNG juntos.
2. `mapTransaction` conserva `status`, y `flattenBankTx` (`08-motor-bank.js`) lo pasa al cliente.
3. `importObExpenses` **ignoraba `status`**: un abono PDNG entraba como ingreso `source:"ob"` sin marca alguna, con `date = booking_date || value_date`.
4. `budgetPaydayOf` → `lastPaydayOf` (`04-tab-gastos.js`) ancla el ciclo en el último ingreso de 200 € o más, con fecha de hoy o anterior, y nombre de nómina o flujo compatible. Nada distingue si ya está cobrado.
5. La fila sube a la nube y los demás dispositivos heredan el ancla.

`flowEarlyBankMatches` (nómina adelantada) y `fixedPaymentState` (recibos) **ya exigían BOOK**; el importador era la única lectura que no.

Otras vías descartadas: el lector de notificaciones (`ingest`) solo convierte en ingreso los Bizum recibidos. Un posible duplicado con `possibleDup` ya se excluye del ancla.

## Corrección inicial (fuente 4.26.72, PR #78)

`importObExpenses` no importa ingresos con estado `PDNG|HOLD|SCHD|CNCL|RJCT|INFO`. Entran cuando llegan como BOOK. Sin estado se mantiene el comportamiento anterior.

Pruebas: `tests/ob-ingresos.test.mjs`, tres casos:

- PDNG y el resto de estados no entran y no anclan el ciclo.
- BOOK entra y ancla.
- Sin estado sigue entrando.

El primero **falla sin el arreglo** (comprobado revirtiendo el cambio de `src`).

## Límites y riesgos

- No toca cargos pendientes (compras con tarjeta PDNG). Siguen entrando como hasta hoy; queda fuera de esta tanda.
- No limpia filas ya importadas. Si PDNG ya entró y BOOK llega con otra identidad/fecha, puede verse dos veces. No borrar por parecido: requiere decisión explícita sobre cada fila.
- No se verificó con el extracto real qué `status` mandó Sabadell ese día: no se leyeron datos reales. Si Sabadell no informara `status`, este arreglo no cambiaría nada. Dato mínimo a pedir al dueño: una captura de la app de Sabadell en la que la nómina figure como pendiente o retenida antes del abono.
- Sin Edge, SQL, APK ni workflows.
