# Brief — las cuotas de tus deudas, visibles y filtrables en Gastos

**Idea suya (12/9, 13:59, desde la app):** *«estaría guay añadir categorías automáticamente por
las deudas, y que estas automáticamente se clasificaran en la zona de gastos en cuanto llegaran, y
así se pudieran filtrar y demás como el resto de cosas»*.

Estado: **brief, sin código.**

---

## 1. Cómo está hoy (leído en beta al redactar, 14/9)

- Las deudas viven en **Plan** (`state.debts`: nombre, cuota mensual, cuenta, día…) y su cuota ya
  resta de lo que puedes gastar a través del motor de Fijos.
- Cuando el banco manda el cargo de esa cuota, `importObExpenses` (08-motor-bank) lo **descarta a
  propósito** si casa con una deuda modelada (mismo banco, importe parecido y nombre parecido):
  `if(matchesModeled(...)) return;`. Es para no contar la cuota **dos veces** (una en Plan y otra
  en Gastos).
- Resultado: la cuota **no aparece en Gastos**, así que no se puede ver ni filtrar.

## 2. Qué se propone

1. **Que la cuota SÍ entre en Gastos**, marcada como de esa deuda (`debtId`), pero **sin contar**
   en el presupuesto del mes (igual que ya pasa con traspasos e inversiones: se ve apagada y no
   suma). Así no se cuenta dos veces.
2. **Categoría «Deudas» (neutra)** para todas, y en el filtro de Gastos cada deuda aparece como
   opción propia: «Préstamo coche», «Hipoteca»… Se crean y desaparecen solas con las deudas: no hay
   que mantenerlas a mano.
3. **Solo desde ahora hacia delante** en el sync diario. El histórico, en una segunda fase, con la
   misma regla.
4. Si una cuota no casa con ninguna deuda (otro importe, otro nombre), entra como hoy entraría
   cualquier gasto, sin inventar.

## 3. Lo que tiene que decidir él

1. **¿Una categoría por deuda o «Deudas» con filtro por cada una?** Recomendado: **«Deudas» + filtro
   por deuda** (no llena la lista de categorías, y el filtro da lo mismo).
2. **¿Que la cuota cuente en «gastado este mes»?** Recomendado: **no**, ya resta en el Plan; si
   contara, el mes saldría peor de lo que es.
3. **¿Traemos también las cuotas de meses pasados** con el histórico? Recomendado: sí, en una
   segunda tanda.

## 4. Riesgos a vigilar

- **El duplicado de siempre.** La cuota entra UNA vez: la regla de «ya modelado» pasa de *descartar*
  a *marcar*. Tests con DOS bancos y dos deudas del mismo importe.
- **Widget / servidor.** `cuentaParaPresupuesto` (servidor) tiene que excluirla igual que el cliente
  ([[misma-regla-en-dos-sitios]]): espejo en `presupuesto-servidor`.
- **Deudas en efectivo o sin banco**: no llegan por el banco, no cambian.
- **La marca viaja a la nube** (apuntes de Cursor): `debtId` y la categoría tienen que guardarse en
  la fila de `expenses` igual que el banco, para que el filtro y el espejo del servidor no dependan
  solo del móvil.
- **Misma deuda, dos cargos el mismo mes** (cuota + amortización extra): casar UNO con la cuota y
  dejar el otro como gasto normal; no marcar de más. Test propio.
- **Filtro:** sin deudas, la sección no sale. Si borras una deuda, sus cuotas viejas se quedan en
  «Deudas» (decidir si además salen como «Deuda borrada»).
