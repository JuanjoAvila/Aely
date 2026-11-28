# fix-ciclo-negativo (feedback 2026-11-28, producción, catalán)

**Síntoma:** Mi ciclo con límite 650 €: widget «DESPESA NETA -567 € · Pots gastar 1.217 €», Inicio «0 % · 1.216,68 € lliures».

**Diagnóstico (solo lectura, `service_role` existente, nada escrito):** con la lógica de `origin/main`
el ciclo de ella da `against≈-558` (ingresos 1.948 = Bizums/transferencias pequeñas ~498 + una llegada
genérica «Movimiento» de 1.450 € a Trade Republic el mismo día de la nómina). Esa llegada es la pata
de entrada de un traspaso propio CaixaBank→TR (la salida está en CaixaBank como «traspaso»). Prod no
la reconoce; beta sí (`traspasoPropioDerivado`, f0258b5e9) y con beta da `against≈892` (pasada ~242 €).

**Fix (defensa además del traspaso):**
- `budgetStatsFromAmounts(..., ciclo)`: en Mi ciclo lo usado = max(0, gasto − (ingresos − grandes)).
  Fin del «neto sin tope» de la 4.26.73: los reembolsos devuelven margen hasta el límite, no más.
- `monthBudgetStats`: en ciclo, ingreso ≥200 € de categoría `ingreso` (no ancla, no posible duplicado)
  = `grandes`, no devuelve margen. Devoluciones en la categoría del gasto sí.
- Widget: `grandes` viaja en `widgetPeriod` y en el alcance (3 huecos) → un ingest viejo no responde.
- Edge `ingest/widget.ts`: misma regla (grandes + tope 0).

**Tests:** `tests/ciclo-tope-ingresos.test.mjs` (en `steps`): antes 3/5 fallan, después 5/5.
`e2e/inicio-ciclo-tope.spec.mjs` (E2E_MAP 03+08, ca): pasa. `test:syntax` OK.

**Despliegue:** web (beta) + **Edge `ingest`** a la vez al promocionar. APK no hace falta.
No probado: Plan › Libre (`17-plan-reparto`) por si calcula su propio neto; tests de widget Deno sin correr.
