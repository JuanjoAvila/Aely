# Tanda 5 — La meta ahorrada sustituye el «gasto del mes»

> **Diseño cerrado. No hay código escrito.** Para que Cursor implemente de una pasada.
> Autor: Claude Code (Opus), 2026-08-18. Leído contra el repo en `beta` **4.18.3** y contra su
> nube real (`app_state`), no de memoria.

## Lo que pidió (sus palabras, crucero 17/8)

> «Una meta ahorrada que sustituye **temporalmente** el gasto del mes: gastar de la hucha de una
> meta no es gasto corriente. Si marcas varios bancos en la meta, un gasto de esos bancos elige la
> meta solo. Al llegar a 0 €, vuelve el presupuesto normal.»

El caso real: ahorra 2.000 € para un viaje. Durante el viaje gasta 1.500 €. Hoy la app le diría
«te has pasado un 150% del presupuesto» — y es mentira: ese dinero estaba apartado justo para eso.
El presupuesto mensual mide la disciplina del **gasto corriente**; el viaje no lo es.

---

## ⚠ Antes de nada: hoy esto no le sirve todavía

Miré su nube el 18/8. Tiene **2 metas, las dos 🏠 y las dos al 0%** (`saved` = 0). Con la hucha
vacía no hay nada que sustituya a nada: la tanda funcionaría, pero no se notaría hasta que ahorre.
Y el crucero, que era el caso de uso que la inspiró, **ya pasó** (7/8).

No es motivo para no hacerla — es motivo para no ponerla por delante de cosas que sí le duelen hoy
(ver el bug del saldo cruzado en [`bug-saldo-cruzado-gasto-diario.md`](bug-saldo-cruzado-gasto-diario.md),
que encontré diseñando esta). Que decida él el orden sabiendo esto.

---

## La decisión de diseño que lo cambia todo

El plan del crucero avisaba: «⚠ Reescribe `monthBudgetStats`. Toca TRES sitios (cliente, ingest,
widget) → no empezar hasta que la 1a esté aprobada».

**No hace falta reescribir `monthBudgetStats`.** Hay una puerta más estrecha por la que pasa
exactamente la misma decisión, y ya existe:

```
monthBudgetStats(state)                        ← NO se toca
  └─ expenseCountsBudget(e, s)   01-i18n.js:2136   ← se le añade UNA condición
       └─ CAT_NEUTRAS + expenseCountsCash
```

Ya es el único sitio del cliente donde se decide si un gasto mueve el presupuesto, y su espejo
servidor `cuentaParaPresupuesto()` (`_shared/presupuesto.ts:114`) hace lo mismo. Un gasto imputado
a una meta es, a efectos del presupuesto, **exactamente igual que una inversión o un traspaso**:
dinero suyo que cambia de sitio. La categoría neutra ya existe y ya está probada; esto es un
neutro más, con otra razón.

Consecuencia: el cambio son **dos funciones + UI**, no una reescritura de la fórmula de dinero.

## Y una segunda decisión que ahorra una APK entera

Si —y solo si— **los bancos de la meta nunca son la cuenta de gasto diario**, esta tanda
**no toca Java** y viaja entera por OTA.

Por qué: el widget recibe de `ingest` un `counts: 0|1` y lo usa para dos cosas — no mover
`budgetLeft` y no bajar `safeLiq`/`cash`. Si el gasto del viaje sale de Revolut (que no es la
cuenta de gasto diario), `safeLiq` —que es del banco diario— no debe bajar de todos modos.
`counts:0` hace ya lo correcto **sin tocar una línea de Java**.

Si en cambio la meta se liga a Trade Republic (su cuenta diaria), el gasto SÍ sale de esa cuenta
de verdad, y `counts:0` dejaría `safeLiq` sin bajar → el widget diría que puede gastar dinero que
ya no tiene. Eso obligaría a partir `counts` en dos señales y **a una APK nueva**.

Dado [[ota-no-cambia-contrato-nativo]] y que la familia arrastra APKs viejas: **la cuenta de gasto
diario no puede ser banco de meta.** La UI lo impide y lo explica. Reversible si él lo pide, pero
entonces es tanda con APK y va después de la 1a.

---

## Modelo de datos

Cuatro campos nuevos. **Ninguna migración de base de datos** y ninguna columna nueva en `expenses`
(ver «por qué no se guarda en el gasto», abajo).

```js
goal.spendAsBudget : true            // esta meta es el «gasto del mes»
goal.banks         : ["revolut"]     // bancos cuyos gastos salen de la hucha
goal.spendSince    : "2026-08-18T..."// ISO. Desde cuándo. SIN esto el histórico cambia solo
goal.spendUntil    : null | "ISO"    // cuándo dejó de comer gastos (null = sigue activa)
goal.spent         : 0               // acumulado gastado de la hucha (lo mantiene la app)
```

**`goal.saved` NO se toca.** Se añade `goal.spent` aparte, y el saldo de la hucha es:

```js
saldoMeta(g) = Math.max(0, (g.saved||0) - (g.spent||0))
```

Por qué separado y no restando de `saved`: `saved` alimenta `goalPct`, `goalEta`, `done`/`doneAt`,
`applyReserva` y el hero «llevas ahorrado». Si gastar bajase `saved`, una meta cumplida **se
descumpliría al usarla** — consigue el viaje, se va de viaje, y la app le quita la medalla. Con
`spent` aparte, la barra de progreso y la medalla se quedan quietas y solo cambia el saldo.

⚠ Único sitio que sí hay que corregir: el hero de Metas (`totalSaved`, `09-tab-debts-goals.js:374`)
debe sumar `saved - spent`, o dirá que tiene ahorrado dinero que ya se gastó.

### Por qué la imputación NO se guarda en el gasto

La tentación es `expense.goalId`. Se descarta: obliga a una columna nueva en la tabla `expenses`,
y sobre todo obliga a que **`ingest` escriba** esa columna al crear la fila con la app cerrada.
Dos escritores del mismo dato es literalmente de donde salieron los dos últimos bugs de
presupuesto (el widget que se contradecía, y el 964 vs 234 de agosto).

En su lugar la imputación se **deriva** de datos que ya viven en `app_state` y que ambos lados ya
leen. Misma entrada → misma respuesta, sin que nadie tenga que escribir nada:

```js
// Espejo exacto en cliente y servidor. Es la única regla nueva de la tanda.
function metaQueSeComeElGasto(gasto, goals){
  const ent = expenseBankOf(gasto);            // bancoDeSource() en el servidor
  if(!ent) return null;                        // a mano sin banco → nunca sale de una hucha
  const ms = fechaMs(gasto);
  for(const g of goals||[]){
    if(!g || !g.spendAsBudget) continue;
    if(!(g.banks||[]).includes(ent)) continue;
    if(ms < fechaMs(g.spendSince)) continue;               // antes de activarla, no
    if(g.spendUntil && ms >= fechaMs(g.spendUntil)) continue; // después de agotarla, tampoco
    return g;
  }
  return null;
}
```

`spendSince`/`spendUntil` no son adorno: **son lo que impide que el histórico se reescriba solo.**
Sin `spendSince`, activar la meta hoy sacaría del presupuesto los gastos de Revolut de hace tres
meses y las cifras de meses cerrados cambiarían solas. Sin `spendUntil`, desactivarla los
devolvería de golpe. Los dos congelan la ventana.

---

## Qué se toca, exactamente

| Fichero | Cambio |
|---|---|
| `src/modules/01-i18n.js:2136` `expenseCountsBudget` | `if(metaQueSeComeElGasto(e, s.goals)) return false;` antes del resto |
| `src/modules/00-core.js` | `metaQueSeComeElGasto()` + `saldoMeta()` (junto a `expenseBankOf`) |
| `supabase/functions/_shared/presupuesto.ts:114` `cuentaParaPresupuesto` | el espejo, leyendo `data.goals` |
| `supabase/functions/ingest/index.ts` | pasar `st?.data?.goals` a la comprobación de `mueveElPresupuesto` |
| `src/modules/09-tab-debts-goals.js` | UI de la meta: interruptor + bancos + saldo; `totalSaved` con `spent` |
| `src/modules/04-tab-gastos.js` | cabecera: la hucha manda mientras esté activa |
| `src/modules/11-app-main.js` | recalcular `goal.spent` al sincronizar + cerrar la ventana al agotarse |
| Java | **nada** (con la restricción de la cuenta diaria) |

### Cómo se mantiene `goal.spent` (y por qué la app es la única que lo escribe)

Al abrir/sincronizar, la app recorre sus gastos una vez y recalcula:

```js
goal.spent = Σ importes de los gastos que caen en la ventana de esa meta   // recalculado, no acumulado
```

Recalculado desde cero, nunca sumado incrementalmente: así es idempotente y un gasto borrado se
descuenta solo. Es el mismo criterio que ya usa `reconcileObDupes` («corre SIEMPRE y es
idempotente», `08-motor-bank.js:604`) y por el mismo motivo: las limpiezas con flag ya fallaron dos
veces en esta casa.

**`ingest` no escribe `goal.spent` ni `spendUntil`.** Solo lee `goals` para responder `counts:0`.
Escribir `app_state` desde la Edge Function abriría una carrera con el móvil, que también lo
escribe. Efecto secundario honesto y que hay que decirle: con la app cerrada, la hucha puede
pasarse de la raya hasta que abra la app; el widget dejará de contar esos gastos durante ese rato.
Se corrige solo al abrir. Es un desfase acotado, no una cifra inventada.

---

## Las trampas que el plan pedía cerrar

**1. ¿Sustituye el techo, descuenta del spent, o marca neutra?**
El **mecanismo** es neutra (no cuenta, ni en `spent` ni en `budget`). La **presentación** es
sustituir el techo: mientras la meta esté activa con saldo, la cabecera de Gastos y el widget
enseñan la hucha de protagonista y el presupuesto normal pasa a segunda línea.

Se separan a propósito. Si el techo se sustituyera de verdad en la fórmula, sus gastos corrientes
de ese mes (la luz, el súper de casa) se quedarían sin techo contra el que medirse. Él sigue
teniendo vida normal mientras está de viaje.

```
🚢 Viaje · quedan 1.200 € de 2.000        ← protagonista mientras haya saldo
   Tu mes aparte: 340 € de 1.000          ← el de siempre, más pequeño
```

**2. ¿Varias metas a la vez?**
**Una sola** en modo «gasto del mes». Al activar una, la anterior se desactiva (con su aviso). Es
la misma regla que ya rige la cuenta de gasto diario («solo puede haber UNA a la vez; la UI
degrada las demás», `01-i18n.js:2099`) y evita tener que explicar prioridades cuando dos metas
comparten banco. `metaQueSeComeElGasto` devuelve la primera que casa, así que aunque el estado
llegase sucio de otra versión, es determinista y no revienta.

**3. ¿Qué pasa cuando la hucha se agota a mitad de un gasto?** (300 € y quedan 200)
El gasto entra **entero** en la meta, la hucha queda en **0** (nunca negativa) y se cierra la
ventana (`spendUntil = ahora`) con aviso: «🚢 Viaje: se acabó la hucha. Lo que pagues con Revolut
vuelve a tu presupuesto». A partir de ahí, presupuesto normal.

Por qué no se parte el gasto en dos trozos (200 a la meta + 100 al presupuesto), que sería lo
exacto: partir obliga a que el presupuesto sume **importes parciales**, y eso sí reescribe la
fórmula en los tres sitios — incluido el widget Java, que solo recibe totales. Además rompería el
dedup por `día|importe|comercio`, que es de donde salieron los duplicados de TR. El error máximo
está acotado al importe de un solo gasto y se ve en pantalla.
→ **Decisión reversible.** Si prefiere el reparto exacto, es otra tanda y lleva APK.

**4. La misma regla en dos sitios.**
[[misma-regla-en-dos-sitios]]: el test carga **las dos** implementaciones y exige el mismo
booleano. Ya existe el andamio en `tests/presupuesto-servidor.test.mjs`.

**5. Sin inventar euros.**
Si la meta no tiene `saved`, o no tiene bancos, o `spendSince` no es una fecha válida →
`metaQueSeComeElGasto` devuelve `null` y todo se comporta como hoy. Ningún camino nuevo puede
producir un número donde antes no había ninguno.

**6. Interacción con `reservedSince` (revisada, no hay doble conteo).**
Hoy apartar dinero para una meta ya baja el presupuesto del mes (`reservedSince`, `08-motor-bank.js:549`).
Son dos cosas distintas y las dos correctas: apartar reduce lo que te queda por gastar, y gastar de
la hucha no consume presupuesto.
⚠ Caso de borde a sabiendas: si aparta **y** gasta esos mismos euros **dentro del mismo mes**, el
presupuesto de ese mes le queda más bajo de lo estricto. El error es conservador (le deja menos
margen, no más) y es raro. Se documenta, no se arregla.

**7. Al activar la meta, ¿qué pasa con los gastos ya apuntados de ese banco este mes?**
No se tocan en silencio. Se ofrece una vez, con la cifra delante: «¿Meter también los 4 gastos de
Revolut de este mes (312 €) en la hucha?» → Sí mueve `spendSince` al día 1 del mes; No lo deja en
hoy. Nunca por defecto.

---

## Criterios de «hecho»

1. Meta con 2.000 € ahorrados, Revolut marcado, activa → un gasto de 100 € en Revolut **no** mueve
   «gastado este mes» ni en Gastos, ni en Resumen, ni en el widget; la hucha pasa a 1.900 €.
2. El mismo gasto con la meta **desactivada** cuenta como siempre.
3. Un gasto de Trade Republic (cuenta diaria) sigue contando **siempre** — no se puede ligar.
4. Un gasto **anterior** a `spendSince` no se imputa: las cifras de meses cerrados no se mueven.
5. Al agotarse: hucha en 0 exacto (nunca negativa), aviso, y el siguiente gasto ya cuenta normal.
6. Desactivar y reactivar no reescribe el pasado.
7. Meta cumplida que se gasta: conserva la medalla y el 100% de la barra.
8. `presupuesto-servidor` verde: cliente y servidor dicen lo mismo con el mismo estado.
9. Tres idiomas (es/en/ca), diálogos propios, sin `alert`.
10. `npm test` entero en verde y `node scripts/run-tests.mjs` sin tests huérfanos.

## Tests que hay que escribir (rojo antes que verde)

- `tests/meta-gasto-mes.test.mjs` — imputación por banco, ventana `spendSince`/`spendUntil`, hucha
  que no baja de 0, `saved` intacto, `done` que no se revierte.
- Ampliar `tests/presupuesto-servidor.test.mjs` — mismo estado con meta activa por las dos
  implementaciones, mismo resultado.
- Ampliar `tests/widget-coherente.test.mjs` — `counts:0` para un gasto imputado.
- Guardián: la cuenta de gasto diario **no** puede acabar en `goal.banks`.

## RELEASE_NOTES (en cristiano, la lee toda la familia)

> **Ahorras para algo concreto y ahora la app lo sabe.** Si tienes una meta con dinero guardado —un
> viaje, un capricho, un cambio de móvil— puedes decirle que lo que pagues con un banco salga de
> esa hucha en vez de tu presupuesto del mes. Mientras dure, Gastos te enseña lo que queda del
> bote. Cuando se acaba, todo vuelve a la normalidad y te avisa.
