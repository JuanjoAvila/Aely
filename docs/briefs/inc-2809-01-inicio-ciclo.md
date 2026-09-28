# INC-2809-01 · Inicio y presupuesto por ciclo · 28/9/2026

## Hallazgo reproducido

Base `origin/beta` `9ed9f17b53bc66786d6c8dd4873b4aaeed911903` (4.26.66). En el ciclo, `monthBudgetStats` calcula `against = spent − income` y `remaining = budget − against`. Gastos usa esas dos cifras en su barra y disponible; el anillo de Inicio usa `against`, pero la frase «Has gastado» mostraba `spent`. Con datos **sintéticos** de 1.450 € de gasto, 470 € de ingreso posterior y 1.000 € de presupuesto, Inicio podía enseñar 98 % junto a «Has gastado 1.450 € de tus 1.000 €», mientras Gastos enseñaba 980 € netos y 20 € disponibles.

El pie «Tu primer mes empieza hoy» procedía de `budgetStreak.current === 0`, que solo dice que no hay una racha de meses cerrados. No demuestra que hoy sea el primer día ni que no haya actividad. Los movimientos visibles del mismo mes lo desmentían.

## Corrección candidata 4.26.67

Inicio muestra «Gasto neto desde el cobro» con céntimos y el disponible o exceso calculado del mismo `against` que el anillo y Gastos. El mes natural conserva su frase de gasto bruto y su proyección diaria. El pie con racha cero dice «Mes en curso»; el ciclo muestra «Mi ciclo» en el mismo lugar. `monthBudgetStats`, los movimientos, el widget y la APK no cambian. Si no se reconoce una nómina reciente, el ajuste sigue usando el mes natural como antes.

El E2E en `e2e/presupuesto-fluido.spec.mjs` abre Inicio y Gastos con presupuesto por ciclo encendido y apagado en es/en/ca. Comprueba DOM, porcentaje, neto, disponible, gasto bruto mensual, actividad anterior al cobro, ingreso posterior de otro banco, ingreso superior al gasto y exceso del límite. **16/16** pasaron en Chromium móvil local. `test:syntax`, `i18n-keys`, `docs-frescura`, `month-budget-stats` y `presupuesto-rendimiento` pasaron. Bundle medido: 1.254.894 B minificados y 342.031 B gzip; se amplió el tope gzip 1 KiB (15 B de exceso sobre el anterior). `npm test` local solo falla por `memoria-espejo`: ocho espejos de la memoria local de Claude ya difieren de este checkout; son archivos ajenos a INC-2809-01. Deno no está instalado localmente. CI de beta debe comprobar la suite en su entorno.

Estado de publicación: candidata local, pendiente de commit, CI, bundle beta servido y prueba del dueño en móvil. El identificador de prueba es `inc-2809-01-inicio-ciclo`; las cinco tandas nativas previas siguen pendientes en beta. No promocionar a producción con esta evidencia sintética; el dueño debe validar su pantalla real.
