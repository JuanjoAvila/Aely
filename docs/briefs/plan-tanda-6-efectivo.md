# Tanda 6 — Controlar el dinero en efectivo

> Diseño de una página, como pedía el plan. Cursor implementa la v1.
> Claude Code (Opus), 2026-08-18, leído contra `beta` 4.18.3.

## Lo que pidió

> «Controlar el dinero en EFECTIVO: lo que tienes, lo que entra y lo que sale.»

Y el plan añade la restricción buena: *«acorde con la app (cuenta / rol), **no un segundo
patrimonio inventado**»*.

## ⚠ Tiene una dependencia dura

**No se puede empezar antes de arreglar [`bug-saldo-cruzado-gasto-diario.md`](bug-saldo-cruzado-gasto-diario.md).**
Si se añade Efectivo como banco de gasto con el bug vivo, cada gasto en efectivo le bajará el
saldo de **Trade Republic**. Sería añadir una fuente nueva al mismo error, con dinero que ni
siquiera está en un banco.

## La idea: el efectivo no es un módulo nuevo, es una cuenta más

Casi todo lo que hace falta ya existe. El efectivo encaja como **una cuenta manual sin banco**:

```js
ENT.efectivo = { label:"Efectivo", mono:"€", color:"#8FA89A" }   // 00-core.js:273
// y en state.accounts, una cuenta normal:
{ id, ent:"efectivo", name:"Efectivo", value: 120, role:"fijos" }   // sin bankIban: nunca OB
```

Con eso solo, ya sale gratis: suma al patrimonio (`liquid` recorre `accounts`), aparece en el
selector de banco al apuntar un gasto, se puede elegir como origen al aportar a una meta, y se ve
en Cartera como una tarjeta más. **Cero motor nuevo.**

Lo que **no** sale gratis son las tres cosas que él pidió:

| Lo que pidió | Cómo se resuelve | ¿Existe ya? |
|---|---|---|
| **Lo que tienes** | saldo de la cuenta `efectivo` | ✅ sale solo |
| **Lo que sale** | gastos con `ent:"efectivo"` | ⚠ falta que bajen el saldo |
| **Lo que entra** | sacar del cajero = traspaso banco → efectivo | ⚠ falta el gesto |

## Las dos piezas que hay que escribir

### 1. Que el saldo de efectivo baje al gastar

Hoy una cuenta que no es la diaria vale `value + paidNetByBank[ent]`, y `paidNetByBank` sale de
`monthNetForAccount`, que recorre fijos/deudas/puntuales/flujos — **no los gastos**. Para las
cuentas de banco eso es correcto: su `value` se re-ancla al saldo real por IBAN, que ya lleva los
gastos descontados por el propio banco.

**El efectivo no tiene banco que lo re-ancle.** Si nadie le resta los gastos, el saldo se queda
clavado para siempre.

Regla nueva, que es la que el arreglo del bug de arriba debe dejar preparada:

```js
// Una cuenta descuenta sus propios gastos SOLO si nadie la re-ancla al banco.
const anclada = !!a.bankIban;        // OB pone el saldo real: no tocar
if(!anclada) saldo -= spentByBank[a.ent] || 0;
```

Así el efectivo se comporta como lo que es —un sobre del que sacas billetes— y las cuentas de
banco siguen exactamente igual que hoy.

### 2. «Saqué del cajero» — el gesto que junta las dos mitades

Sacar 200 € del cajero son **dos apuntes de un solo movimiento**: salen del banco y entran en el
sobre. El patrimonio no cambia. Es el mismo patrón que ya está resuelto para los traspasos entre
bancos, y la categoría **`traspaso` ya es neutra** (`CAT_NEUTRAS`, `00-core.js:169`): se apunta,
se ve, y no cuenta como gasto. No hay que inventar nada.

Faltan dos cosas pequeñas:

- **Detectarlo.** Hoy no hay ninguna palabra clave de cajero (`grep` de «cajero»/«atm» en
  `00-core.js`: **cero resultados**). Añadirlas a `autoCategory` y a `ingest_logic.ts` — las
  mismas en los dos sitios — para que una retirada de Open Banking caiga en `traspaso` sola y deje
  de contarse como gasto. Esto ya es una mejora aunque no se use el efectivo.
- **Ofrecer la otra mitad.** Al detectar una retirada: *«¿Han entrado 200 € en tu efectivo?»* con
  Sí / No. **Nunca automático**: si él sacó el dinero para dárselo a alguien, ese dinero no está
  en su sobre, y apuntarlo sería inventar euros.

Y a mano, un botón en la tarjeta de Efectivo: **«Saqué del cajero»** (elige banco e importe, crea
el par) y **«Entró efectivo»** (le devuelven dinero, una propina, la paga).

## Decisiones tomadas (reversibles si dice otra cosa)

- **¿Cuenta para el presupuesto?** **Sí.** Un café pagado en efectivo es gasto corriente igual que
  con tarjeta. Se marca `efectivo` en `expenseBanks` al crearla, y él puede quitarlo.
- **¿Puede ser la cuenta de «gasto diario»?** **No.** Ese rol es único y es de Trade Republic, y
  arrastra round-up e inyección de nómina, que no tienen sentido en un sobre de billetes.
- **¿Se puede quedar en negativo?** **No**: no puedes gastar billetes que no tienes. Si un gasto
  deja el sobre bajo cero, se apunta igual pero se avisa («te faltan 12 € por cuadrar») — el aviso
  suele significar que se olvidó de apuntar una retirada, y decírselo vale más que esconderlo.
- **¿Open Banking?** Nunca. `efectivo` no puede enlazarse a ningún banco ni aparecer en la lista
  de conectar.
- **¿Widget?** No cambia nada. El widget enseña el saldo de la cuenta **diaria**, y el efectivo no
  lo es. **Sin APK: esta tanda es OTA pura.**

## Criterios de «hecho»

1. Crear la cuenta de Efectivo desde Cartera y ponerle lo que lleva en la cartera de verdad.
2. Apuntar un gasto eligiendo Efectivo → el saldo del sobre baja, **y ningún otro saldo se mueve**.
3. «Saqué del cajero» 200 € de Sabadell → Sabadell −200, Efectivo +200, patrimonio **igual**, y no
   aparece como gasto del mes.
4. Una retirada que entra por Open Banking se categoriza `traspaso` sola y ofrece la otra mitad.
   Decir que **No** no apunta nada.
5. El gasto en efectivo cuenta en la cabecera de Gastos igual que uno de tarjeta.
6. Borrar la cuenta de Efectivo no deja gastos huérfanos ni descuadra el patrimonio.
7. Tres idiomas, diálogos propios, sin `alert`. Test `tests/efectivo.test.mjs`.

## RELEASE_NOTES (en cristiano)

> **El dinero de la cartera, también controlado.** Ahora puedes llevar la cuenta de lo que tienes
> en efectivo: apunta lo que sacas del cajero, lo que te entra y lo que te gastas en metálico, y
> el saldo se mantiene solo. Cuando el banco detecta una retirada, la app te ofrece sumarla a tu
> efectivo de un toque.
