<!-- GENERADO POR scripts/sync-memoria.mjs — NO EDITAR A MANO.
     Espejo de la memoria del agente (cuotas-deudas-no-casan-por-nombre.md). Se regenera con `npm run memoria`.
     Pasado por el filtro de datos personales: el repo es PÚBLICO. -->

---
name: cuotas-deudas-no-casan-por-nombre
description: "14/9 tanda 4.21.0 — sus cuotas de deuda NO casan por nombre (el brief suponía que sí); se casan por banco+céntimo+día, y la marca no puede tocar el saldo"
metadata: 
  node_type: memory
  type: project
  originSessionId: f69d765e-fe32-4f3d-8203-899d3f519aa6
  modified: 2026-09-13T19:29:33.978Z
---

El brief de «cuotas de deudas en Gastos» suponía que `importObExpenses` tiraba la cuota por `matchesModeled` (nombre+importe). **Medido en la nube: de sus 4 deudas activas NINGUNA casa por nombre** — hipoteca = «PRESTAMOS ADEUDO CUOTA N.…» cobrada el 31 (día 1 en el Plan), préstamo piso = nombre de quien lo cobra, las de TR llegan por la NOTI (`macrodroid`: «Amazon», «Openbank Pay») y además por OB como «Movimiento». Ya entraban como gasto normal. El plan votado tal cual habría marcado 0 de 4.

Solución (4.21.0, votada por Cursor dos veces): `marcarCuotasDeDeuda` casa por banco + importe al céntimo + día ±4 (mes o contiguo), una por deuda/mes. Marca en la nube: OB `ob:<ent>~deuda.<id>` (con `~`: el servidor hace `split("#")[0]` y con `#` la SUMARÍA); `macrodroid` intacto + `cat:deudas` (un `macrodroid~` el servidor lo lee «a mano» → suma). ⚠ Hasta redesplegar `ingest`, el widget cuenta las de la noti.

**Why:** casi pico un plan que no hacía nada con sus datos, y casi saco la cuota de `expenseCountsCash` — eso habría hecho saltar el saldo de la cuenta diaria (el rol-sin-salto que ya rechazó tres veces). En la diaria `paidNet`=0 y el anclaje de `applyBankBalances` cuenta con el cargo.

**How to apply:** antes de picar cualquier regla de casado, simular contra `expenses` reales de la nube (script tipo `diag-widget.mjs`). Nunca cambiar qué filas entran en cash sin mirar el anclaje. Ver [[misma-regla-en-dos-sitios]], [[feedback-de-uno-en-uno]].
