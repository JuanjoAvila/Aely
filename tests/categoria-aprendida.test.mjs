/* LA APP APRENDE DE SUS CORRECCIONES DE CATEGORÍA (19/11, «la IA sigue igual de retrasada»).
 *
 * La IA de pago nunca corrió (no hay clave en el servidor): lo que de verdad categoriza son las
 * palabras clave y lo que él enseña al corregir (`setCat`, que escribe `catOverrides`/`catRules`).
 * Aquí se fija qué hacen con eso las altas y el pull, con datos ficticios:
 *   · una corrección se aplica al SIGUIENTE movimiento del mismo comercio, entre por un alta nueva
 *     del banco o por la nube, aunque el banco lo escriba con otro número de tienda o forma jurídica;
 *   · NO pisa la categoría que él puso a mano en otro movimiento, ni el histórico, ni lo genérico
 *     («Compra 123»), ni cuando dos correcciones de la misma base se contradicen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const APRENDE = Date.parse("2026-11-10T12:00:00.000Z");
// Lo que deja `setCat` (04-tab-gastos) en memoria tras corregir un gasto del banco: el comercio
// exacto en `catOverrides` y la regla comercio|banco|tarjeta con el instante en `catRules`.
function corrige(cli, s, ex, cat, ahora = APRENDE) {
  const ov = Object.assign({}, s.catOverrides || {}, { [cli.catKey(ex.merchant)]: cat });
  const rules = Object.assign({}, s.catRules || {}, { [cli.catRuleKey(ex)]: { cat, at: ahora } });
  vm.runInNewContext("USER_OVERRIDES=" + JSON.stringify(ov) + ";USER_CAT_RULES=" + JSON.stringify(rules), cli);
  return Object.assign({}, s, { catOverrides: ov, catRules: rules });
}
const gasto = (n, merchant, extra) => Object.assign({ id: uuid(n), date: "2026-11-01T10:00:00.000Z", merchant, amount: 10 + n,
  category: "super", source: "ob", ent: "sabadell" }, extra);
const fila = (n, comercio, fecha, cat) => ({ id: uuid(n), fecha, importe: 10 + n, comercio, cat, source: "ob:sabadell" });

test("una corrección se aplica al siguiente alta del mismo comercio, aunque cambie el número de tienda", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(cli.categoryOfNewMerchant("SUPER EJEMPLO 1234"), "otros", "punto de partida: sin aprender");
  corrige(cli, {}, gasto(1, "Super Ejemplo 1234"), "bares");
  assert.equal(cli.categoryOfNewMerchant("Super Ejemplo 1234"), "bares", "mismo texto");
  assert.equal(cli.categoryOfNewMerchant("SUPER EJEMPLO 5678"), "bares", "otra tienda de la misma cadena");
  assert.equal(cli.categoryOfNewMerchant("Super Ejemplo, S.L.U."), "bares", "con la forma jurídica");
  assert.equal(cli.sugerenciaApuntar({ concepto: "super ejemplo" }).kwCat, "bares", "y al apuntarlo a mano");
});

test("lo aprendido gana a la palabra clave en el siguiente cargo, pero no en otro comercio", () => {
  const cli = loadPureLogicFromFile();
  assert.equal(cli.categoryOfNewMerchant("MERCADONA 0001"), "super");
  corrige(cli, {}, gasto(1, "MERCADONA 0001"), "regalos");
  assert.equal(cli.categoryOfNewMerchant("MERCADONA 0002"), "regalos");
  assert.equal(cli.categoryOfNewMerchant("LIDL 0002"), "super", "otro comercio sigue con su palabra clave");
});

test("el cargo siguiente que baja de la nube nace con lo aprendido (mismo banco y forma de pago)", () => {
  const cli = loadPureLogicFromFile();
  corrige(cli, {}, gasto(1, "MERCADONA 0001"), "regalos");
  const nueva = cli.expenseFromRow(fila(2, "MERCADONA 0002", "2026-11-12T10:00:00.000Z", "super"));
  assert.equal(nueva.category, "super", "el servidor la clasificó por palabra clave");
  const r = cli.keepCategoryChoices([], [nueva], Date.now());
  assert.equal(r.incoming[0].category, "regalos");
  assert.deepEqual(Array.from(r.incoming[0].catStale), ["super"], "y se protege hasta que la nube se entere");
});

test("NO pisa lo anterior a la corrección ni otro banco", () => {
  const cli = loadPureLogicFromFile();
  corrige(cli, {}, gasto(1, "MERCADONA 0001"), "regalos");
  const vieja = cli.expenseFromRow(fila(3, "MERCADONA 0003", "2026-11-05T10:00:00.000Z", "super"));
  assert.equal(cli.keepCategoryChoices([], [vieja], Date.now()).incoming[0].category, "super", "fecha anterior a enseñarlo");
  const otroBanco = Object.assign(cli.expenseFromRow(fila(4, "MERCADONA 0004", "2026-11-12T10:00:00.000Z", "super")), { ent: "revolut" });
  assert.equal(cli.keepCategoryChoices([], [otroBanco], Date.now()).incoming[0].category, "super", "otro banco");
});

test("NO pisa la categoría puesta a mano en otro movimiento del mismo comercio", () => {
  const cli = loadPureLogicFromFile();
  // Él ya había puesto a mano «ocio» en un cargo (confirmado por la nube) y ahora corrige otro a «bares».
  const aMano = gasto(5, "Super Ejemplo 1234", { category: "ocio", date: "2026-11-12T10:00:00.000Z" });
  const s = corrige(cli, { expenses: [aMano] }, gasto(6, "Super Ejemplo 1234"), "bares");
  assert.equal(s.catOverrides["super ejemplo 1234"], "bares");
  // El pull vuelve a traer ese cargo tal y como él lo dejó: es una fila que este móvil ya conoce.
  const vuelve = cli.expenseFromRow(fila(5, "Super Ejemplo 1234", "2026-11-12T10:00:00.000Z", "ocio"));
  const r = cli.keepCategoryChoices([aMano], [vuelve], Date.now());
  assert.equal(r.incoming[0].category, "ocio");
  assert.equal(r.recat.length, 0);
  // Y releer el histórico (`resolveCategory`, lo que pasa en cada pull) tampoco lo mueve.
  assert.equal(cli.resolveCategory("ocio", "Super Ejemplo 1234"), "ocio");
});

test("lo genérico y lo contradictorio no se aprende por parecido", () => {
  const cli = loadPureLogicFromFile();
  vm.runInNewContext("USER_OVERRIDES={'compra 123':'ocio','tienda prueba 1':'regalos','tienda prueba 2':'bares'};USER_CAT_RULES={}", cli);
  assert.equal(cli.categoryOfNewMerchant("Compra 999"), "otros", "«Compra» con número no es un comercio");
  assert.equal(cli.categoryOfNewMerchant("TIENDA PRUEBA 3"), "otros", "dos correcciones distintas: no se adivina");
  assert.equal(cli.comercioBase("Transferencia 0001"), "");
  assert.equal(cli.comercioBase("Movimiento"), "");
});

/* Los tres de abajo salen de la revisión de dinero del 19/11: eran garantías ciertas en el código
   pero sin test que cayera al romperlas (mutantes vivos), o comercios distintos que se fundían. */
test("lo aprendido por parecido NO mueve el «Otros» que ya estaba guardado", () => {
  const cli = loadPureLogicFromFile();
  corrige(cli, {}, gasto(1, "Super Ejemplo 1234"), "bares");
  assert.equal(cli.categoryOfNewMerchant("SUPER EJEMPLO 5678"), "bares", "control: el alta sí lo aprende");
  // Lo que relee el histórico en cada carga y en cada pull: solo el texto exacto.
  assert.equal(cli.autoCategory("SUPER EJEMPLO 5678"), "otros");
  assert.equal(cli.resolveCategory("otros", "SUPER EJEMPLO 5678"), "otros");
  assert.equal(cli.expenseFromRow(fila(7, "SUPER EJEMPLO 5678", "2026-10-02T10:00:00.000Z", "otros")).category, "otros",
    "una fila vieja en «Otros» cambiaría de categoría en un mes cerrado");
});

test("inversión, traspaso y deudas no se contagian al comercio parecido", () => {
  for (const neutra of ["inversion", "traspaso", "deudas"]) {
    const cli = loadPureLogicFromFile();
    corrige(cli, {}, gasto(1, "Gestora Ejemplo 0001"), neutra);
    assert.equal(cli.categoryOfNewMerchant("GESTORA EJEMPLO 0002"), "otros", neutra + " en el alta");
    const nueva = cli.expenseFromRow(fila(2, "GESTORA EJEMPLO 0002", "2026-11-12T10:00:00.000Z", "otros"));
    const r = cli.keepCategoryChoices([], [nueva], Date.now());
    assert.equal(r.incoming[0].category, "otros", neutra + " en el pull");
    assert.equal(r.recat.length, 0);
  }
});

test("una pasarela con código o un tipo de local con número no enseñan a los demás", () => {
  const limpio = loadPureLogicFromFile();
  const cli = loadPureLogicFromFile();
  vm.runInNewContext("USER_OVERRIDES={'amzn mktp es*2k4xy12z0':'regalos','paypal *1234567':'regalos','taxi 4421':'regalos'," +
    "'bar 21':'regalos','farmacia 0453':'regalos','cuota prestamo 1234':'regalos'};USER_CAT_RULES={}", cli);
  for (const m of ["AMZN Mktp ES*9Z8QQ1AB3", "PAYPAL *998877A", "TAXI 9981", "Bar 33", "Farmacia 24h", "Cuota prestamo 9999"]) {
    assert.equal(cli.comercioBase(m), "", m);
    assert.equal(cli.categoryOfNewMerchant(m), limpio.categoryOfNewMerchant(m), m + ": otro pedido/local, manda la palabra clave");
  }
  assert.equal(cli.categoryOfNewMerchant("AMZN Mktp ES*2K4XY12Z0"), "regalos", "el mismo texto sí");
  // Con nombre detrás sigue siendo un comercio que se aprende.
  corrige(cli, {}, gasto(1, "PAYPAL *STEAM 111"), "ocio");
  assert.equal(cli.categoryOfNewMerchant("PAYPAL *STEAM 222"), "ocio");
  corrige(cli, {}, gasto(2, "Bar Pepe 1"), "regalos");
  assert.equal(cli.categoryOfNewMerchant("BAR PEPE 2"), "regalos");
});
