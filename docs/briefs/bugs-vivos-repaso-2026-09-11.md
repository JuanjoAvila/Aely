# Repaso de los «bugs vivos» del inventario — 11/9/2026

El inventario (`mi-cartera-backlog-2026-08.md` §2) viene de agosto. Antes de ponerse a arreglar,
comprobado uno a uno cuáles siguen vivos. **Un bug que ya no existe cuesta más que uno nuevo**: se
re-diagnostica, se «arregla» algo que no estaba roto y se mete riesgo gratis. Es exactamente lo que
pasó esta madrugada con el modo inicial (ver `rechazo-anterior-al-arreglo`).

---

## 3. «El presupuesto del mes en Resumen no cuadra» → **CERRADO, con evidencia**

La sospecha de agosto era que Inicio usaba un cálculo distinto al de Gastos. **Ya no.**

- `03-tab-dash.js:56` → `monthBudgetStats(state)`
- `04-tab-gastos.js:413` → `monthBudgetStats(state)`

Misma función, mismos argumentos: no pueden dar cifras distintas.

Quedaba una vía por la que sí podrían descuadrar y la comprobé: **Gastos memoriza el resultado y
Inicio no**. Si la función leyera algún campo que no está en las dependencias del memo, Gastos se
quedaría con un número viejo mientras Inicio enseña el fresco. El conjunto real que lee
`monthBudgetStats` (líneas 576-602 de `08-motor-bank.js`, más `reservedSince` y `expenseBankEnts`):

    budget · expenses · settings · reservaLog · accounts

Y las dependencias del memo de Gastos:

    [state.expenses, state.budget, state.reservaLog, state.accounts, state.settings]

**Coinciden exactamente.** No hay staleness.

⚠ Por el camino me equivoqué: un `grep` de 70 líneas me sacó un `state.categoryBudgets` y llegué a
pensar que faltaba en las dependencias. Estaba en `categorySpentByMonth`, la función de al lado —
`monthBudgetStats` cierra en la 602. **Mirar el límite de la función antes de afirmar nada** de lo
que una ventana de grep saca.

## 2. «Doble filtro de bancos en Mis bancos» → sigue SIN CONFIRMAR

Probablemente lo cerró la tanda `bancos` (16 ok / 0 fallo el 4/8), pero no hay ítem explícito sobre
el doble filtro en su detalle. **No tocar sin que él lo confirme mirándolo**: si ya está, cualquier
cambio es riesgo gratis.

## 4. «El widget descontrolado» → VIVO, y es el 475 €

Es el mismo hilo que su queja del 10/9 (457 + 2,40 → 475 en vez de 460). El arreglo de la ventana de
mes (`f0698252`) vive en `beta`, dentro de la tanda `4.19.2/ventana-mes` **que él rechazó**, y por eso
no está en producción. Circular: la tanda se rechazó por este bug, y el bug no se arregla sin la
tanda. Romperlo pide desplegar cliente y servidor con la MISMA regla de mes a la vez.

## 5. «Gastos de bancos que no son el de gasto diario no entran» → VIVO, pero es DECISIÓN suya

Está así **por diseño** (evita duplicar con los Fijos modelados), pero él lo vive como bug: «todos
los malditos gastos que no sale ni uno». Existe `settings.expenseBanks` para ampliarlo. Tiene coste
de doble conteo, así que **no se toca sin decidirlo con él**.

## 1. «Ajustes → Dinero lleno de cosas muertas» → de Cursor (lista del 11/9)
