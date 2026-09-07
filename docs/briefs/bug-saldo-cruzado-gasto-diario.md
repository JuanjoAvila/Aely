# 🐛 Un gasto de Revolut baja el saldo de Trade Republic — 257,17 € hoy

> Encontrado el 2026-08-18 diseñando la tanda 5. **No estaba en el plan del crucero.**
> Medido contra su nube real, no deducido del código.

## El síntoma, con su número

```
Cuenta de gasto diario: trade_republic
settings.expenseBanks: ["myinvestor","trade_republic","revolut"]

thisMonthSpent (lo que se resta ENTERO al saldo de TR):  1.629,81 €
  · trade_republic ......... 1.372,64 €   ← correcto
  · revolut ................   257,17 €   ⚠ no es la cuenta diaria

>>> El saldo de Trade Republic sale 257,17 € POR DEBAJO de lo real.
>>> Y ese importe tampoco se descuenta de Revolut.
```

Reproducir: `node scripts/diag-widget.mjs` o el desglose de arriba. **La cifra sube cada vez que
paga con Revolut** y se reinicia al cambiar de mes.

## Por qué pasa

`dynBal()` ([11-app-main.js:1451](../../src/modules/11-app-main.js#L1451)) calcula el saldo de la
cuenta de gasto diario así:

```js
let v = a.value + injTR - thisMonthSpent - roundupThisMonth - monthlyInvestThisMonth;
```

`thisMonthSpent` ([:1430](../../src/modules/11-app-main.js#L1430)) suma **todos** los gastos que
pasan `expenseCountsCash()`, y esa función acepta cualquier banco que esté en `expenseBanks` —
hoy tres. Cuando se escribió esa línea, la cuenta de gasto diario era el **único** banco de gastos
y `thisMonthSpent` era exactamente «lo que ha salido de TR». Al ampliar `expenseBanks` a varios
bancos dejó de serlo, y nadie volvió a mirar `dynBal`.

Las cuentas que **no** son la diaria no compensan: su saldo es `value + paidNetByBank[ent]`, y
`paidNetByBank` sale de `monthNetForAccount`, que recorre fijos, deudas, puntuales y flujos —
**no los gastos**. Así que el dinero no aparece descontado en ningún sitio: solo se lo come TR.

## A qué le afecta de verdad

1. **Cartera**: el saldo de Trade Republic sale bajo. El patrimonio **total** sí cuadra (el dinero
   se gastó de verdad); lo que está mal es el reparto entre bancos.
2. **El widget «Puedes gastar»**: `safeLiq` sale de `minByBank[trade_republic]`, que arranca de
   este saldo ([:1652](../../src/modules/11-app-main.js#L1652)). Con el saldo hundido, el widget
   le dice que puede gastar menos de lo que puede.
3. **Las alertas de saldo mínimo** (`bankAlerts`, saldo proyectado en negativo) pueden saltar por
   dinero que en realidad tiene.

⚠ **Lo que este bug NO explica**, para que nadie lo cruce: el Δ de 205 € entre el widget y la app
era de `spent`, no del saldo, y ya está diagnosticado y cerrado (notis gemelas + lápidas, ver
`plan-vuelta-crucero.md`). Son dos cosas distintas que se parecen en el tamaño. No mezclar.

## El arreglo — y la trampa que tiene

Lo obvio (restar a cada banco lo suyo) **rompe otra cosa** si se hace a lo bruto:

- **Trade Republic** no pasa por Open Banking (`applyBankBalances` no la toca nunca, a propósito):
  su `value` es una base de principio de mes, y **sí** hay que restarle lo gastado.
- **Revolut / CaixaBank** están ancladas por IBAN y se re-anclan al saldo **real** del banco. Ese
  saldo ya lleva los gastos descontados por el propio banco. Restárselos otra vez los contaría dos
  veces.

Por eso el arreglo correcto es **estrecho**: que la cuenta diaria reste solo lo suyo, y no tocar
las demás.

```js
// nuevo, junto a thisMonthSpent
const spentByBank = {};                       // gasto del mes por banco de origen
thisMonthExp.forEach(function(e){
  const b = expenseBankOf(e) || (cuenta diaria);   // a mano sin banco → sale de la diaria
  spentByBank[b] = (spentByBank[b]||0) + e.amount;
});

// dynBal, cuenta diaria: lo suyo, no el total
let v = a.value + injTR - (spentByBank[a.ent]||0) - roundupThisMonth - monthlyInvestThisMonth;
```

### ⚠ La misma fórmula está escrita CINCO veces

Esto es lo que convierte un cambio de una línea en una tanda con cuidado. La fórmula del saldo de
la cuenta de gasto (y su **inversa**, la que traduce lo que él teclea a mano al `value` guardado)
vive en cinco sitios y **todos tienen que cambiar a la vez**:

| Dónde | Qué es |
|---|---|
| [11-app-main.js:1453](../../src/modules/11-app-main.js#L1453) | `dynBal` — la de referencia |
| [01-i18n.js:2167](../../src/modules/01-i18n.js#L2167) | `spendBal` |
| [01-i18n.js:2173](../../src/modules/01-i18n.js#L2173) | la inversa (guardar) |
| [07-tab-patri-fijos.js:12 y :20](../../src/modules/07-tab-patri-fijos.js#L12) | `spendBal` + `toStored` |
| [06-sync-brokers.js:468](../../src/modules/06-sync-brokers.js#L468) | la inversa al sincronizar TR |

Si se cambia `dynBal` y no las inversas, **editar el saldo a mano guardará un número torcido** —
que es peor que el bug de ahora, porque queda escrito en su estado.

**Recomendación:** extraer la fórmula y su inversa a **una** pareja de funciones en `00-core.js`
(`saldoCuentaGasto()` / `valueDesdeSaldo()`) y que los cinco sitios llamen ahí. Es exactamente el
caso de [[misma-regla-en-dos-sitios]], pero por quintuplicado; un test de constantes no lo caza.

### Lo que NO se toca

`thisMonthSpent` **se queda como está** y sigue exportándose: en `13-hogar.js` y en el fallback de
`budgetLeft` significa «lo gastado este mes», que es correcto y no tiene nada que ver con el saldo
de un banco. Solo cambian los cinco sitios que calculan el **saldo de la cuenta de gasto**.

## Criterios de «hecho»

1. Con un gasto de 100 € en Revolut: el saldo de Trade Republic **no se mueve**.
2. Con un gasto de 100 € en Trade Republic: su saldo baja 100 €, como siempre.
3. Un gasto apuntado a mano **sin banco** sigue saliendo de la cuenta de gasto diario (como hoy).
4. Editar el saldo de TR a mano y volver a leerlo devuelve **el mismo número** (ida y vuelta por
   la inversa). Es la prueba que caza el desastre de cambiar solo la mitad.
5. Sincronizar Revolut por Open Banking no descuenta sus gastos dos veces.
6. El patrimonio total no cambia con el arreglo — solo el reparto entre bancos.
7. Test nuevo `tests/saldo-por-banco.test.mjs` con los seis casos, **en rojo antes del arreglo**.

## Prioridad

Alta, y por delante de la tanda 5 y la 6:

- Es **dinero mal pintado en Cartera**, que es de lo que más se queja.
- **La tanda 6 (efectivo) lo necesita hecho antes.** Si se añade Efectivo como banco de gasto sin
  arreglar esto, cada gasto en efectivo bajará el saldo de Trade Republic. La tanda 6 no puede
  entrar antes.
- Es **OTA puro**: no toca Java, no hace falta APK.

## RELEASE_NOTES (en cristiano)

> **Cada banco descuenta lo suyo.** Si pagabas con un banco que no era el del día a día, el gasto
> se le restaba por error al saldo del principal. El dinero total siempre fue correcto, pero el
> reparto entre cuentas no. Ya está cada euro en su sitio.
