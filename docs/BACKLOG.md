# Backlog operativo — Aely

**Limpieza del 26/10/2026, sobre beta 4.26.182 (`acae53b68`), aprobada y camino de producción.**
Antes este fichero era una pila de cortes fechados (9/9, 25/9, 27/9, 30/9, 4/10, 7/10, 15/10,
18/10, 19/10…) que repetían los mismos IDs hasta cinco veces con estados distintos: 449
menciones de 126 IDs. Quien llegaba no sabía qué fila mandaba, y dos IDs se usaban para dos
cosas distintas (PRO-09, OPS-08). Ahora hay **una lista de pendientes** y **un archivo de lo
hecho**. Cada cierre se comprobó contra `CHANGELOG.md`, `git log origin/beta`, el código de
`src/modules` y `supabase/functions` y los veredictos del panel que recoge el CHANGELOG.

- **Regla de lectura.** «En beta» ≤ 4.26.159 = en producción (promoción del 20/10, «adelante con
  todo»). De la 160 a la 182 = aprobado por el dueño y pendiente solo de promocionar: el panel de
  beta ya no enseña ninguna tanda vieja (las aprobadas salen del array; las rechazadas lo dicen
  en el CHANGELOG y volvieron con arreglo nuevo).
- **El detalle de antes no se ha perdido**: está en los briefs enlazados y en la historia de git
  (`git show acae53b68:docs/BACKLOG.md`). El porqué de cada arreglo vive en el `CHANGELOG.md`.
- **Prioridad:** P0 = va con la próxima producción o toca dinero ya; P1 = dinero o uso diario;
  P2 = mejora o riesgo acotado; P3 = idea o decisión sin prisa. **Depende de:** dueño (decisión
  o prueba suya), Codex/Claude (código), servidor (Edge/SQL/despliegue), APK (nativo, no viaja
  por OTA).
- Un punto marcado **(verificar)** no está demostrado ni hecho ni roto: se deja abierto a
  propósito hasta que alguien lo mire en la app o en el servidor.

## Pendiente

### P0 · con la próxima producción

| ID | Qué falta y por qué | Depende de |
|---|---|---|
| Despliegues de la promoción 160-182 | Las betas posteriores a la producción 4.26.159 cambian Edge que **no se despliegan en beta**: `ingest` (inicio-mes-futuro de la 174, aportación a meta de la 172 —hasta desplegar, el widget la cuenta como gasto—, categoría Coche de la 162), `categorize` (Coche, 162) y `bank-callback` (SEC-02 F1, 180). Desplegar con Actions, una a una, tras ver Pages servido. Sin desplegar, la app está bien pero el servidor y el widget cuentan con la regla vieja. | dueño (OK) + servidor |

### P1 · dinero y uso diario

| ID | Qué falta y por qué | Depende de |
|---|---|---|
| Nómina de cada miembro (revisión R3, 26/10/2026) · **antes de producción** | El mes natural aparta la nómina de lo que devuelve margen (`claude/neto-sin-nomina`). Si la nómina de alguien NO cumple `esNomina` (≥200 €, no Bizum ni neutra, y «nómina/salario/sueldo/salary/payroll/haberes» en comercio, nota o concepto, o un ingreso periódico de Plan que case), cuenta como ingreso y su mes dice «quedan 1.500» con todo gastado: el «0 %» de INC-2909-02 otra vez. Comprobar en SOLO LECTURA, con los datos de la nube de cada cuenta de la familia, la nómina de los últimos meses; a quien no la cumpla, darle de alta el ingreso en Plan o un paso en el panel de beta. Lo mismo para la paga extra (R7: doble importe sin la palabra). | Coordinador + dueño |
| Despliegue de `ingest` del mes sin nómina | `ingest/widget.ts` acepta los dos alcances (web anterior: bruto; web nueva: neto sin nómina), así que puede desplegarse antes o después de promocionar la web sin dejar el widget sin foto. Sin SQL ni secretos. | Servidor |
| Cursor bancario partial/sealed + SEC-02 (13 intentos) | La PR315 (4.26.181) solo documenta y protege el contrato actual de `bank-sync`: 12 páginas buenas + un rechazo inicial de periodo. **No resuelve** que una ventana que no cabe en 12 páginas se acuse como «ahora» y deje movimientos sin volver a pedir. El prototipo de continuación por fechas sumaba bien, pero marcarlo partial/sealed retenía un BOOK viejo de 1251 céntimos frente a su corrección a 1252 y dejaba PDNG frente a BOOK con la misma referencia (la clave real banco/ref/signo suprime un cambio de céntimos). Falta un contrato de cobertura y reconciliación: conservar prefijos, corregir filas anteriores, clientes viejos, ACK perdido/replay, multicuenta, horizonte y el día indivisible que supera los límites sin fingir completitud. | Codex + servidor |
| FIN-29 + FIN-30 (fundidos: misma lápida) | La lápida de un renombrado es la misma que la de un borrado (`día\|importe\|nombre`, sin ámbito): con Sabadell A y CaixaBank C iguales el mismo día, renombrar A oculta C (640 → 320). FIN-30 es la variante con un cliente anterior a la 4.26.160 y un DELETE fallido. Hallado en la revisión de la PR 288; hay que distinguir lápida de renombrado y de borrado. | Codex |
| INC-2709-09 / UX-01 (fundidos el 15/10) · lag sostenido | Hechas la vuelta a primer plano (146), Gastos r3 (175) y el gesto entre pestañas (149). **Queda:** la tarjeta de Inicio pintada a medias (hace falta adb + CDP en su móvil buscando «Tile memory limits exceeded») y los restos de Gastos v5 medidos a CPU ×6: añadir filas en tramos pequeños en vez de +`PAGE_SIZE*5` de golpe (frames >32 ms, sigue así en `04-tab-gastos.js`), el frame de ~60 ms al cambiar de sección, el recálculo de ~2.660 nodos de Plan al deslizar y virtualizar o recortar Movimientos. Medir A/B como dice AGENTS §7 bis. | Claude + dueño (su móvil) |
| SES-01 + PRO-06 (fundidos: misma fiabilidad de brókers) | Las sesiones de Trade Republic y MyInvestor duran horas (pedido 15/10). Hay telemetría (139), guardas de keepalive (OPS-07/OPS-08 CAS) y contador (136), pero nada acredita que la sesión real dure. Medida 16/10: el refresh de 30 min deja de renovarse. | servidor |
| SEC-02 F2 fase 2 · gemelas nativas | El cliente ya lee la marca (179); el escritor de `ingest` sigue detrás de `INGEST_NATIVE_TWINS` **apagado**. Encenderlo con un móvil sin ese lector funde gemelas y cuenta doble al sincronizar Trade Republic (9,95 → 19,90), y el doble sube a la nube y al widget. Condición: todos los móviles de la familia en 4.26.179 o posterior tras promocionar, confirmado por el dueño. Aparte, el debounce de 180 s de la APK puede tragarse la segunda compra igual. [Informe](briefs/sec02-edge-limits-replay-audit.md) | dueño + servidor (+ APK para el debounce) |
| OPS-01 (+ validación de FIN-06) | Repo frente a servidor vivo: matriz función/migración/versión activa con pruebas de contrato. Sigue sin acreditarse con un pago real la parte Wallet-divisas de `ingest` (FIN-06, cliente cerrado en 4.26.51). | servidor + dueño (un pago real) |

### P2 · mejoras y riesgos acotados

| ID | Qué falta y por qué | Depende de |
|---|---|---|
| Mes cerrado con el límite de HOY (INC-2909-02) | Desde `claude/neto-sin-nomina` (26/10/2026) la tarjeta de mes cerrado, la imagen del informe y las rachas comparan lo mismo que el mes en curso (gasto − ingresos sin nómina, `limiteDeStats`). Queda: la tarjeta (`03-tab-dash.js:398-399`) y la imagen (`02-ui-shared.js`) usan el límite ACTUAL en un mes pasado; las rachas ya usan el de cada mes (`budgetByMonth`). | Decisión de producto |
| Traspasos propios con nombre, como ingreso (revisión R4, 26/10/2026) | Desde que el mes natural resta los ingresos (salvo nómina), una recarga a TR desde otra cuenta TUYA que el banco manda con tu nombre como comercio queda como «ingreso» y devuelve margen (con tope en el límite). `esTraspasoPropio` solo reconoce filas OB sin nombre que entran en una cuenta con traspaso modelado. No hay criterio seguro para ampliarlo: el cliente no recibe el IBAN de la contraparte (`mapTransaction` solo pasa nombres y concepto), no se guarda el titular de las cuentas, y «traspaso»/«transferencia» en el concepto también lo escribe un amigo. Arreglo propuesto: que `bank-sync` pase el IBAN de la contraparte y se compare con los `bankIban` de sus cuentas conectadas. **(verificar)** con sus datos reales si ocurre. | Codex/Claude + servidor |
| FIN-03 + FIN-18 (fundidos; FIN-09 ya cerrado por FIN-19) | Identidad de gastos de extremo a extremo (UUID/origen/ACK, carreras, índice `expenses_dedup_idx` sin banco) y cerco atómico de servidor con esquema separado. **Aparcado**: FIN-19 (160) cubrió el caso visible de dos bancos el mismo día en el cliente. No migrar datos familiares ni tocar el índice sin decisión. [Arquitectura](briefs/arquitectura-identidad-gastos.md) | dueño + servidor |
| FIN-08 + OPS-02 + INC-0310-01 (fundidos: reparar el pasado) | Daños históricos previos a la contención de 4.18.6, recuperación compartida desde copias y reservas huérfanas de reglas de Metas borradas con la versión antigua. Las tres piden inventario privado por fila, copia restaurable y propuesta revisable; nada automático al arrancar. Dependen de FIN-03. | dueño + servidor |
| FIN-25 | Un recibo anual con meses repetidos o imposibles divide mal (600 € con [5,5] cobra 300 una vez): `chargeMonths` (`07-tab-patri-fijos.js`) devuelve los meses sin quitar repetidos ni validar 1-12. | Codex |
| FIN-28 | Un cargo sin `extId` (Wallet/MacroDroid) se puede enlazar a mano a otro recibo del mismo importe mientras el BOOK paga el suyo: sin referencia no hay con qué comparar. Baja. | Codex |
| FIN-35 | Con la moneda global en USD/GBP y sin tipo de cambio, Cartera cae a € pero «Tus inversiones» arranca en esa moneda y lo pinta todo «—»: debería arrancar en EUR. Menor. | Codex |
| SEC-02 (sesión huérfana) + SEC-04 (fundidos: carreras del callback OAuth) | El callback tardío que pierde la carrera (F1, 180) deja su sesión de Enable Banking huérfana en el proveedor, sin revocar; y el callback frente a una autorización nueva sigue en estudio con `connection_version`. [Alcance](briefs/sec03-callback-atomic-state.md) | servidor + dueño (si se revoca) |
| SEC-03 · servidor | El cliente de privacidad de logs está cerrado (4.26.57); falta la privacidad Edge/gateway por función. La retirada de cifras viejas de la historia pública del repo (commits `6fcc3e0e`/`05a8fb4f`) exige reescribir historia: **solo con decisión expresa**, nunca force-push automático. | servidor + dueño |
| UX-03 + UX-09 + UX-10 (fundidos: el splash; UX-03 absorbió INC-2709-01) | El splash nativo sale con el verde por defecto y luego cambia al tema; debería salir con el tema desde el primer frame (guardarlo en el lado nativo). La «respiración» del logo si tarda (UX-10) ya existe en el splash web desde la 4.26.117 (verificar si basta o la quería en el nativo). Rama aparcada `wip/splash-icono-nativo`. | APK |
| UX-2909-04 · frescura por banco (verificar) | La revisión de ingresos manuales coincidentes está hecha (PR 251) y la hora de la última lectura sale al pie de Filtros (169). El diseño de «cuándo se actualizó cada banco» entró solo como documento (PR310, 177); no consta implementado. | Codex + dueño (diseño) |
| UX-17 · restos de Gastos v5 | Botón de filtros con icono de deslizadores y globito (SPEC §4.1; hoy sigue el chip «🎛️ N», que muchas specs usan como selector). Opcionales si él lo pide: chip del límite más corto, «Pasar a Recibos» marcando los cargos ya hechos, «deshacer» en el aviso, toque sobre la hora de Filtros para releer. | Claude (+ dueño para los opcionales) |
| PRO-09 (round-up) | Round-up de Trade Republic desde «Round up Invertido»: diseño pendiente de emparejarlo con Open Banking. Mismo ID que Pregúntame por error histórico; es otra cosa. | Codex + dueño (diseño) |
| PRO-01 (verificar) | Meta financiada fuera del gasto corriente ([plan](briefs/plan-tanda-5-meta-gasto-mes.md)). La «aportación a meta» de la 172 saca lo aportado de lo que cuenta; falta ver si cubre también gastar desde la meta sin tocar el presupuesto. | dueño (alcance) |
| PRO-03 (verificar) | Los recordatorios existen (víspera y 2-3 días antes); lo pedido y no hecho es que el aviso diga si el saldo previsto llega. | Codex |
| INC-2909-02 (verificar) | 0 % al salir de Mi ciclo en la cuenta de su pareja. Hubo arreglo (4.26.73) y contraste posterior, pero nadie confirmó que el síntoma humano se fue. | dueño (que lo mire su pareja) |
| OPS-06 + OPS-03 (fundidos: antes de la Play Store) | La «ronda de tortura» que pidió el 12/9 (rendimiento sostenido, aporrear botones, sin red, seguridad: `localStorage`, `app_events`, permisos, RLS, Edge sin autenticar; ⚠ el `applicationId` no se toca) y la beta con varios probadores sin hacerlos administradores. Va justo antes de DEC-01. | Claude/Codex + servidor |
| OPS-05 | Higiene de PR, ramas y worktrees. Borrar ramas o worktrees siempre con permiso: puede haber trabajo sin subir. | dueño (permiso) |

### P3 · ideas y decisiones sin prisa

| ID | Qué es | Depende de |
|---|---|---|
| Widget: magnitud «uso» en el mes (revisión R5, 26/10/2026) · próxima APK | Desde el mes sin nómina el widget v2 manda en `spent` lo comparado con el límite (gasto − ingresos sin nómina), porque el nativo pinta «quedan» como límite − `spent`. Pero el título sigue «ESTE MES · GASTO» (`WidgetPeriod.labels`; `MiCarteraWidget.java:209` solo acepta `gasto` en el mes) y puede enseñar 1.436 € con 1.922 gastados, o «0 €» si entró más de lo gastado. Propuesta: magnitud nueva `uso` con «ESTE MES · USADO DEL LÍMITE» / «THIS MONTH · LIMIT USED» / «AQUEST MES · ÚS DEL LÍMIT»; la app la manda solo si el nativo declara soportarla (contrato), y si no sigue con `gasto`. Alternativa: «te quedan» en grande y el gasto bruto en la línea pequeña. | APK |
| FIN-13 | Editar importe o día del aviso de Trade Republic separa la pareja aviso/movimiento (a propósito desde 4.26.130). ¿Seguir así o conservar el vínculo? | dueño |
| FIN-3009-04 | Reservar las cuotas obligatorias de deudas del mes y descontarlas del disponible, como las metas. Evolutivo sin diseño. | dueño (diseño) |
| PRO-20 | Colchón / fondo de emergencia: decisiones suyas del 18/10 tomadas (opt-in por cuenta/meta/inversión, recibos obligatorios + presupuesto de vida, «aguantas N meses», vive en Plan); falta solo el diseño visual con su OK. | dueño (diseño) |
| PRO-21 | Categorías con subcategorías (Coche → taller, ITV…). La base «Coche» ya está (162); lo demás toca filtro, límites, palabras clave e IA: diseño antes de código. | dueño (diseño) |
| UX-19 | Cartera v5 (Cuentas · Inversiones · Bienes con el patrón de Gastos v5). Diseño con su OK antes de código. | dueño (diseño) |
| FIN-34 | El widget pinta siempre en EUR aunque la app esté en otra moneda. Necesita contrato de moneda, nativo y APK nueva. | APK |
| FIN-26 | `semana` cuenta ×4,345 en `FREQ_M` pero no entra en el calendario mensual. Hoy la UI no ofrece `semana`. | Codex |
| UX-17 · `useCountUp` | Con un objetivo no numérico la cifra queda en NaN (`+(target\|\|0)` sin comprobar) y al llegar a p=1 conviene fijar el objetivo exacto. Técnico. | Codex |
| PRO-04 | Exportar el informe en PDF (hoy solo imagen; el PDF que existe es de importación). Confirmar que lo quiere. | dueño |
| PRO-05 | Aviso push de versión nueva con la app cerrada (FCM o equivalente sin dependencias nuevas). | dueño + servidor + APK |
| PRO-07 | Pensiones y cuentas de ahorro: sin alcance ni proveedor. | dueño |
| PRO-08 | Hogar existe ([HOGAR](HOGAR.md)); falta la validación con dos usuarios reales. | dueño |
| PRO-09 (Pregúntame remoto) | La ayuda local está publicada; la remota sigue apagada hasta aprobar coste y que la pregunta salga del móvil. | dueño |
| Purga de `rate_limits` | `prune_rate_limits()` existe y es manual a propósito (`0019_rate_limit.sql`); decidir si se automatiza, midiendo antes cuántas filas hay. Antes se llamaba OPS-08, ID que luego se dio a la guarda CAS. | dueño + servidor |
| OPS-04 (verificar) | Métricas agregadas de uso: la instrumentación existe desde 4.13; falta confirmar si hay vista SQL. | servidor |
| UX-02 / UX-06 (verificar) | Restos del pulido v4 de septiembre: perfil con menos contenido inicial, B4 (esqueletos) y B5 (repaso en tema claro). Rediseños posteriores pueden haberlos dejado sin objeto. | Claude |
| TEC-01 / TEC-02 | Refactor financiero por dominios y claves i18n presuntamente huérfanas: aparcados a propósito. | — |
| DEC-01 / DEC-02 / BIZ-01 | Marca, Play Store (siempre al final), monetización (precio que baja con la permanencia) e ideas opcionales. | dueño |

## Hecho (archivo)

Una línea por punto, con dónde se cerró. Si algo vuelve, se abre un ID nuevo con su caso; no se
reabre uno de aquí por parecido.

**Dinero**

- FIN-01 · efectivo al cerrar mes — 4.19.15 (`96b0fe4f`).
- FIN-02 · el histórico perdía pagos mensuales — 4.19.16 (`f0fccc70`).
- FIN-04 · decisiones y ediciones con dos móviles — fase 1 en 151/153, A+SAVEDAT en 170, B en 173, plazo de lectura en 176; aprobadas.
- FIN-05 / INC-2909-01 (fundidos) · widget con app cerrada, periodo y modo — 4.26.80, `widget-app-cerrada` (4/10) y 4.26.116.
- FIN-06 · divisa sin cambio en el cliente — 4.26.51 (validación con pago real en OPS-01).
- FIN-07 · histórico de la nube completo — 4.26.52.
- FIN-09 → FIN-19 · misma compra en dos bancos el mismo día — 4.26.160 (PR 288; restos en FIN-29/30).
- FIN-10 · identidad y lápidas de Open Banking — 4.26.141.
- FIN-11 · reintento de la lápida `ob-absorbed` — 4.26.142 (PR 266), claves v2/v3 reconciliadas después.
- FIN-12 · financiaciones antes de existir en la gráfica — mes en 139, día en 163.
- FIN-14 · `obAcc` en la nube — se reconstruye desde `source` al bajar (`bankRefDeSource(raw,"acc")`, `00-core.js`) desde FIN-19.
- FIN-15 · pendiente y contabilizada contaban doble — 4.26.135 y 138.
- FIN-16 · plazo y cuota a la vez — 4.26.139.
- FIN-17 · registro de absorciones confirmadas — 4.26.142 (PR 267).
- FIN-20 / FIN-21 · recibos con meses a mano y vista previa del anual — 4.26.159.
- FIN-22 · Trade Republic en € con la moneda en USD — 4.26.161.
- FIN-23 / FIN-24 · un cargo pagaba dos recibos del mismo importe — 4.26.159.
- FIN-27 · el BOOK de tarjeta pagaba el mes siguiente — 4.26.177 (PR 308).
- FIN-31 / FIN-32 / FIN-33 · Cartera sin tipo de cambio, GBP y eje de la proyección — 4.26.161.
- FIN-36 / FIN-37 · deudas en hora de Madrid y validar `startDay` una vez — 4.26.174.
- INC-0210-01 · cuota ya pagada pendiente en Plan — 4.26.86.
- INC-0210-03 · categorías por periodo en Gastos — 4.26.86.
- INC-0310-01 · borrar regla de Meta conservaba el descuento — corrección hacia delante (lo histórico sigue en FIN-08).
- INC-0410 · Metas: máximo tres en Inicio (96), editar regla (108), conflictos de escritura (141) y plan con dos móviles (173).
- INC-1810-02 · renombrar recibo rompía su pago — 4.26.144 (vínculos ya rotos se rehacen a mano).
- INC-1810-03 / INC-1810-04 (fundidos: misma regla de ✓ solo con cargo real) · cuota y YouTube — 145, rechazos en 148 y 155, `youtube-r4` en 158.
- INC-1910-01 · bajar la cuota ofrece alargar el plazo — 4.26.147.
- INC-2709-04 · crash de Cuotas de deuda — 4.26.59.
- INC-2709-05 · cifras incompatibles Inicio/Gastos — superada por 66, 73, 78 y 126.
- INC-2709-06 · cargos de CaixaBank — sin quejas de nadie de la familia a 19/10; vigilar.
- INC-2809-01 · Inicio y Mi ciclo — 4.26.66.
- INC-2909-03 · retirada de CaixaBank sin salida — 4.26.79 (+`withdrawalConfirmedAt` en 134).
- INC-3009-01 · gas pagado en Próximos cargos — 4.26.71/74.
- INC-3009-02 · nómina Sabadell anticipada — 4.26.78.
- FEATURE-0210-01 · Gasolina y Taxi — 4.26.86.
- Saldo de cuenta (PR 268) — 4.26.142.
- inicio-mes-futuro · un apunte del mes que viene cuenta en su mes — 4.26.174 (el `ingest` va en P0).
- Aportación a meta desde la ficha del gasto — 4.26.172 (el `ingest` va en P0).

**Uso diario y pantallas**

- INC-0710-01 · salto de scroll en Plan — 4.26.124.
- INC-0810 · Perfil → Ajustes → cerrar sacaba de la app — ya corregido en beta `f695a299` (12/10).
- INC-0810 · Recientes de Inicio — 4.26.106.
- INC-1710 · separación de modos — 4.26.142 (PR 265).
- INC-1810-01 · Guardar de Deudas no respondía — NO_REPRO, guardián e2e en 4.26.177 (PR 309); lo de bajar la cuota era INC-1910-01.
- INC-2709-01 → UX-03 · arranque con poca red — 4.26.69 (el splash sigue en P2).
- INC-2709-02 · deudas terminadas: confirmar y archivar — 4.26.70.
- INC-2709-03 / UX-08 (fundidos) · ola nativa en Gestionar plan — `gestionar-plan-ola-r2`, 4.26.153.
- INC-2709-07 · Bienes con toque y edición — 4.26.111 y 113.
- INC-2709-08 · ordenar brókers manteniendo pulsado — 4.26.147.
- INC-2709-10 · casillas gigantes del perfil — 4.26.77.
- INC-2709-11 · anillo de Inicio recortado — rediseño v42 (respuesta del dueño 19/10).
- INC-2709-12 · línea Cyberpunk sobre el + — 4.26.77.
- INC-2709-13 / UX-06 · círculo del + e indicador — 4.26.98 y 107.
- INC-2709-14 · botón Preguntar — 4.26.77.
- INC-2709-15 · botones de suscripciones — obsoleto: esa zona ya no existe.
- INC-2809-02 · ayuda de Mi ciclo plegable — 4.26.68.
- UX-04 · mensaje de bancos y acceso superior — 9/9.
- UX-05 · un solo filtro en el histórico de bancos — 9/9 (`bancos-historico-filtro`).
- UX-07 · temas Primavera, Otoño y Cyberpunk — publicados.
- UX-11 · saltito vertical tras cerrar una hoja — NO_REPRO en 48 casos (19/10); con un vídeo suyo se abre de nuevo.
- UX-12 · Deudas y Metas al estilo v4 — 4.26.138 y 141.
- UX-13 · Atrás con teclado cierra solo el teclado — 4.26.141.
- UX-14 · deslizar rápido entre pestañas — 4.26.149.
- UX-15 · «Sincronizar» de Gastos — renombrado en 138 y retirado en 169 (decisión del 20/10).
- UX-16 · vibración — ronda 6 aprobada en 4.26.157 (el ajustador sigue solo en beta).
- UX-17 · Gastos v5, tandas 1 a 6 — 4.26.164 a 172, más el lag r3 en 175; restos en P1/P2/P3.
- UX-18 · idioma recibido de otro móvil — 4.26.178.
- PRO-02 · fin de mes en paz — sustituido por 125, 126 y 134.
- REC-GUARDADO-01 y Atrás en el alta de Recibos — 4.26.48 y 47.
- BRAND-01 · la app se llama Aely — web, `app_name` nativo, icono A-Dot y APK `Aely-*.apk`.

**Servidor, seguridad y operación**

- SEC-01 · validar entradas Edge — `delete-account` explícito en `config.toml` y once funciones leen el cuerpo por `_shared/request_body.ts` (tope de tamaño); `ingest` y `help-assistant` tienen tope propio (413) y `prices` corta a 25 símbolos validados.
- SEC-02 F1 · el callback tardío ya no pisa una reconexión — 4.26.180 (despliegue en P0).
- SEC-02 F3 · contrato 12+1 de `bank-sync` documentado y con guardianes — 4.26.181 (lo que no resuelve está en P1).
- SEC-03 · privacidad de logs en el cliente — 4.26.57 (lo de servidor sigue en P2).
- OPS-07 · `myinvestor-keepalive` sin guarda — ya guarda por `refresh_token` leído (`.eq("refresh_token", …)`, código `raced`).
- OPS-08 · guarda CAS de refresh entre keepalive y sync — lote del 18/10.
- OPS-0410 · cola del panel beta y coste de tests — 4.26.93.
- OPS-3009-03 · reconciliar panel tras producción — superado: el panel se reconcilia en cada bump.

### Cierre del día · 27 de septiembre de 2026

Este ancla la cita `docs/ROADMAP.md`. Aquel corte (las 14 incidencias INC-2709 y la tabla de
estado de todos los objetivos) está entero en `git show acae53b68:docs/BACKLOG.md`; cada una de
sus filas ya está arriba, en Pendiente o en este archivo.

## Cierre de cada encargo

Registrar **ID, base, SHA/PR, prueba que reproducía el fallo, resultado después, revisión ajena,
CI y versión realmente publicada**, o el bloqueo concreto. Al cerrar, la línea pasa de Pendiente
a «Hecho (archivo)» con su versión: no se escribe un corte fechado nuevo encima, que es lo que
convirtió este fichero en una pila ilegible. Sin datos personales en el repo público.
Implementado no significa probado en Android ni desplegado en Supabase.
