/* «TUS RECIBOS»: GESTIONAR DEJA DE SER LA APP VIEJA DENTRO DE UN CAJÓN (v4.1 §2, variante A).
 *
 * Antes, «Gestionar» abría un sheet que montaba `<Fijos>` entero: seis cartillas, formularios
 * abiertos, simulador y conciliación, todo dentro de `.v4-embed-legacy`. Lo que se veía al tocar
 * era la app de antes, y además era el punto lento de Plan. Ahora es una pantalla hija con cuatro
 * grupos en los que se ENTRA.
 *
 * Lo que vigilan estas pruebas es sobre todo lo que se podía PERDER al quitar `<Fijos>`:
 *   · la comparación con el banco (solo vivía ahí) → ahora en Ajustes › Mis bancos;
 *   · recibos con importe distinto por mes (`schedule`) y con meses concretos (`months`), y el
 *     «primer/último día hábil» (`when`) de lo que entra — tocar el nombre no puede aplanar nada;
 *   · el cargo de una sola vez, que va por mes y año, no por periodicidad;
 *   · las cuotas en modo sencillo, donde Deudas no existe y «se cambian en Deudas» no lleva a nada.
 *
 * Selectores: los del núcleo de Cursor (`487864ad`): `[data-bills-manage]`, `.v4-bills-*`. Los
 * grupos y las filas se buscan por su TEXTO dentro de su contenedor, que es lo que ve él. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const hoy = new Date();
const mesActual = hoy.getMonth() + 1;
const anoActual = hoy.getFullYear();
const ymHoy = `${anoActual}-${String(mesActual).padStart(2, "0")}`;

const accounts = [
  { id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" },
  { id: "rev", ent: "revolut", name: "Tarjeta", value: 300, role: "diario" },
];
const fixed = [
  { id: "luz", name: "Luz", amount: 50, freq: "mes", account: "sabadell", day: 5 },
  // Importe distinto por mes: si la ficha lo aplana al tocar el nombre, se pierde el de julio.
  { id: "ibi", name: "IBI", amount: 80, freq: "año", account: "sabadell",
    schedule: [{ m: 1, amt: 80 }, { m: 7, amt: 120 }] },
  // Meses que NO son los de por defecto de «bimestral» (1-3-5…): el agua de febrero.
  { id: "agua", name: "Agua", amount: 30, freq: "bimestral", months: [2, 4, 6, 8, 10, 12], account: "sabadell" },
];
const debts = [
  { id: "coche", name: "Préstamo coche", monthly: 100, value: 2400, anchor: 2400, account: "sabadell", day: 10 },
];
// `when` solo existe en lo que entra/se mueve (`flowDay`, 07:858).
const flows = [
  { id: "nomina", name: "Nómina", amount: 1800, kind: "income", to: "sabadell", when: "last" },
];
const oneoffs = [
  { id: "itv", name: "ITV", amount: 45, month: mesActual, year: anoActual, account: "sabadell" },
];
const base = { accounts, fixed, debts, flows, oneoffs, budget: 1000 };

async function appLista(page, overrides = {}) {
  await seedLoggedInDashboard(page, Object.assign({}, base, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

const hub = (page) => page.locator("[data-bills-manage]");
const titulo = (page) => hub(page).locator(".settings-push-h h1");
const ficha = (page) => page.locator('.v4-sheet[data-sheet="bill"]');
const alta = (page) => page.locator('.v4-sheet[data-sheet="bill-add"]');
const tituloHoja = (sheet) => sheet.locator(".settings-push-h h1");
const grupo = (page, texto) => hub(page).locator(".v4-bills-group").filter({ hasText: texto });
const fila = (page, texto) => hub(page).locator(".v4-bills-row").filter({ hasText: texto });

async function abreTusRecibos(page) {
  const simple = await page.evaluate(() => {
    try { return !!(JSON.parse(localStorage.getItem("micartera_v3") || "{}").settings || {}).simpleMode; } catch (e) { return false; }
  });
  if (simple) {
    // §5bis.2: sin link en Plan — puerta Ajustes › Dinero → Plan + BillsManage vivo
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
    const billsBtn = page.getByRole("button", { name: /Cambiar mis recibos|Change my bills|Canviar els meus rebuts/i });
    await expect(billsBtn).toBeVisible({ timeout: 15_000 });
    await billsBtn.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await billsBtn.evaluate((el) => el.click());
  } else {
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const nombre = await page.evaluate(() => t("v4_gestionar"));
    await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: nombre, exact: true }).click();
  }
  await expect(hub(page)).toBeVisible();
}

const estado = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}"));

test("la comparación con el banco sigue viva: ahora está en Mis bancos", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankTx: [{ id: "tx1", ent: "sabadell", date: `${ymHoy}-05`, amount: 50, merchant: "ENDESA" }],
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const rec = page.locator("[data-bank-reconcile]");
  await expect(rec).toContainText("¿Cuadran tus recibos con el banco?");
  await expect(rec).not.toContainText(/concilia|modela|Fijos/i);
});

test("Gestionar abre «Tus recibos», sin la app vieja y sin segunda puerta al banco", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await expect(titulo(page)).toHaveText("Tus recibos");
  await expect(hub(page).locator(".v4-embed-legacy")).toHaveCount(0);
  // Piezas que solo pinta `<Fijos>`: su resumen y su «el que más pesa».
  await expect(page.locator(".liqbox, .culpa")).toHaveCount(0);
  await expect(hub(page).locator(".v4-bills-afford")).toContainText("¿Me lo puedo permitir?");
  // La comparación con el banco vive en Mis bancos: aquí no se duplica.
  await expect(hub(page).locator(".v4-bills-recon")).toHaveCount(0);
  // Precondiciones de la ola nativa de Android: el push es el scroller físico, sin textura
  // transformada ni overscroll bloqueado. Chromium no dibuja la ola; el móvil valida el efecto.
  const scrollCss = await hub(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { overflowY: cs.overflowY, overscrollY: cs.overscrollBehaviorY,
      transform: cs.transform, touchAction: cs.touchAction,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(scrollCss.overflowY).toBe("auto");
  expect(scrollCss.overscrollY).toBe("auto");
  expect(scrollCss.transform).toBe("none");
  expect(scrollCss.touchAction).toBe("auto");
  expect(scrollCss.scrollHeight).toBeGreaterThan(scrollCss.clientHeight);
});

test("cuatro grupos con su cuenta, y el de una sola vez no dice «al mes»", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await expect(hub(page).locator(".v4-bills-group")).toHaveCount(4);
  await expect(grupo(page, "Servicios y suministros")).toContainText("3 recibos");
  await expect(grupo(page, "Cuotas de deuda")).toContainText(/1 cuota/);
  await expect(grupo(page, "Lo que entra y lo que mueves")).toBeVisible();
  const once = grupo(page, "Cargos de una sola vez");
  await expect(once).toContainText("este mes");
  await expect(once).not.toContainText("al mes");
  await expect(hub(page).locator(".v4-bills-hero-amt")).toHaveText(/\d/);
});

for (const lang of ["es", "en", "ca"]) {
  test(`ninguna palabra de contable ni castellano colado (${lang})`, async ({ page }) => {
    await appLista(page, { settings: { lang } });
    await abreTusRecibos(page);
    const txt = await hub(page).innerText();
    expect(txt).not.toMatch(/fij[oa]s?\b|flujo|concilia|modelad|traspaso|\bfixed\b|reconcil|\bfixes\b|\bflux\b|traspàs/i);
    if (lang !== "es") expect(txt).not.toMatch(/Tus recibos|Servicios y suministros|Cargos de una sola vez/);
    // La ficha de «lo que entra» también ofrece el tipo de día: antes reaparecía «Un día fijo»
    // al profundizar aunque el hub estuviera limpio (revisión cruzada Cursor 2026-09-17).
    await hub(page).locator(".v4-bills-group").nth(2).click();
    await hub(page).locator(".v4-bills-row").first().click();
    const detailTxt = await ficha(page).innerText();
    expect(detailTxt).not.toMatch(/fij[oa]s?\b|flujo|concilia|modelad|traspaso|\bfixed\b|reconcil|\bfixes\b|\bflux\b|traspàs/i);
  });
}

test("atrás de Android quita UNA pantalla cada vez", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await expect(titulo(page)).toHaveText("Servicios y suministros");

  await page.goBack();
  await expect(titulo(page)).toHaveText("Tus recibos");

  await page.goBack();
  await expect(hub(page)).toHaveCount(0);
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
});

test("renombrar no aplana el importe por mes, los meses ni el día hábil", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);

  await grupo(page, "Servicios y suministros").click();
  await fila(page, "IBI").click();
  await expect(ficha(page)).toContainText("cambia de importe según el mes");
  await ficha(page).locator("input.v4-bills-search").first().fill("IBI casa");
  await ficha(page).locator(".settings-push-h .back").click();

  await fila(page, "Agua").click();
  await ficha(page).locator("input.v4-bills-search").first().fill("Agua del pueblo");
  await ficha(page).locator(".settings-push-h .back").click();
  await hub(page).locator(".settings-push-h .back").click();

  await grupo(page, "Lo que entra y lo que mueves").click();
  await fila(page, "Nómina").click();
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText("Último día hábil");
  await ficha(page).locator("input.v4-bills-search").first().fill("Nómina de papá");

  await expect.poll(async () => {
    const s = await estado(page);
    const by = (list, id) => (s[list] || []).find((x) => x.id === id) || {};
    return {
      ibi: [by("fixed", "ibi").name, JSON.stringify(by("fixed", "ibi").schedule)],
      agua: [by("fixed", "agua").name, JSON.stringify(by("fixed", "agua").months), by("fixed", "agua").freq],
      nomina: [by("flows", "nomina").name, by("flows", "nomina").when],
    };
  }).toEqual({
    ibi: ["IBI casa", JSON.stringify([{ m: 1, amt: 80 }, { m: 7, amt: 120 }])],
    agua: ["Agua del pueblo", JSON.stringify([2, 4, 6, 8, 10, 12]), "bimestral"],
    nomina: ["Nómina de papá", "last"],
  });
});

test("alta por pasos: cada dos meses pregunta EN QUÉ meses y el teclado empieza vacío", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await hub(page).locator(".v4-bills-add").first().click();

  await expect(tituloHoja(alta(page))).toHaveText("¿Qué es?");
  await alta(page).locator("input.v4-bills-search").fill("Basuras");
  await alta(page).locator(".v4-cta").click();

  await expect(tituloHoja(alta(page))).toHaveText("¿Cuánto?");
  const importe = alta(page).locator(".v4-account-correct-amount");
  await expect(importe).toHaveText("—");
  for (const k of ["3", "5"]) await alta(page).getByRole("button", { name: k, exact: true }).click();
  await expect(importe).toContainText("35");
  await alta(page).locator(".v4-cta").click();

  await expect(tituloHoja(alta(page))).toHaveText("¿Cada cuánto?");
  await alta(page).locator(".v4-ficha-op").filter({ hasText: "Cada dos meses" }).click();
  await alta(page).locator(".v4-cta").click();
  await expect(alta(page)).toContainText("¿En qué meses?");
  await alta(page).locator(".mchip").filter({ hasText: /^feb/i }).click();
  await expect(alta(page)).toContainText(/al mes repartidos/);

  // Atrás de Android dentro del alta vuelve al paso anterior, sin tirar lo tecleado.
  await alta(page).locator(".v4-cta").click();
  await page.goBack();
  await expect(tituloHoja(alta(page))).toHaveText("¿En qué meses?");
  await alta(page).locator(".v4-cta").click();

  // Un recibo no tiene «último día hábil» (`when` es solo de lo que entra): no se ofrece.
  await expect(alta(page).locator(".v4-ficha-op").filter({ hasText: "Último día hábil" })).toHaveCount(0);
  await alta(page).locator(".v4-cta").click();

  await expect.poll(async () => {
    const f = ((await estado(page)).fixed || []).find((x) => x.name === "Basuras");
    return f ? { amount: f.amount, freq: f.freq, feb: (f.months || []).includes(2), ene: (f.months || []).includes(1) } : null;
  }).toEqual({ amount: 35, freq: "bimestral", feb: true, ene: false });
});

test("un cargo de una sola vez se apunta por mes y año, no por periodicidad", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Cargos de una sola vez").click();
  await hub(page).locator(".v4-bills-add").click();

  await alta(page).locator("input.v4-bills-search").fill("Dentista");
  await alta(page).locator(".v4-cta").click();
  for (const k of ["9", "0"]) await alta(page).getByRole("button", { name: k, exact: true }).click();
  await alta(page).locator(".v4-cta").click();
  await expect(alta(page)).not.toContainText("¿Cada cuánto?");
  await alta(page).locator(".v4-cta").click();
  await alta(page).locator(".v4-cta").click();

  await expect.poll(async () => {
    const o = ((await estado(page)).oneoffs || []).find((x) => x.name === "Dentista");
    return o ? { amount: o.amount, hasMonth: Number.isInteger(o.month), hasYear: Number.isInteger(o.year) } : null;
  }).toEqual({ amount: 90, hasMonth: true, hasYear: true });
});

test("en modo sencillo las cuotas se cambian aquí: Deudas no existe", async ({ page }) => {
  await appLista(page, { settings: { simpleMode: true } });
  await abreTusRecibos(page);
  await expect(grupo(page, "Cuotas de deuda")).not.toContainText("Deudas");
  await grupo(page, "Cuotas de deuda").click();
  await fila(page, "Préstamo coche").click();
  await expect(ficha(page)).not.toContainText(/en Deudas/);
  await expect(ficha(page).locator(".v4-keys, .v4-numpad, input").first()).toBeVisible();
});

test("fuera del modo sencillo las cuotas dicen dónde se cambian", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Cuotas de deuda").click();
  await expect(fila(page, "Préstamo coche")).toContainText(/en Deudas/);
});

test("quitar un recibo tiene Deshacer y vuelve con el MISMO id", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await fila(page, "Luz").click();
  await ficha(page).locator(".v4-ficha-quitar").click();

  const undo = page.locator(".v4-undo-toast");
  await expect(undo).toBeVisible();
  await expect(fila(page, "Luz")).toHaveCount(0);
  await page.waitForTimeout(2500);
  await expect(undo).toBeVisible();
  await undo.getByRole("button", { name: "Deshacer" }).click();
  await expect(fila(page, "Luz")).toHaveCount(1);
  await expect.poll(async () => ((await estado(page)).fixed || []).filter((f) => f.id === "luz").length).toBe(1);
});

test("sin nada apuntado: una tarjeta que explica", async ({ page }) => {
  await appLista(page, { fixed: [], debts: [], flows: [], oneoffs: [] });
  await abreTusRecibos(page);
  const empty=hub(page).locator(".v4-empty[data-bills-empty]");
  await expect(empty).toContainText("Aún no hay recibos");
  await expect(empty).toContainText("Conecta tu banco y los detecto solos.");
  await empty.getByRole("button",{name:/Añadir un recibo/}).click();
  await expect(alta(page)).toHaveAttribute("data-step","what");
});

test("buscar algo que no existe lo dice, y un nombre larguísimo no rompe el ancho", async ({ page }) => {
  const largo = "Seguro del hogar de la casa del pueblo con ampliación de contenido y responsabilidad civil";
  await appLista(page, { fixed: fixed.concat([{ id: "largo", name: largo, amount: 22, freq: "mes", account: "sabadell" }]) });
  await abreTusRecibos(page);

  const buscar = hub(page).locator("input.v4-bills-search").first();
  await buscar.fill("zzzz");
  await expect(hub(page).locator(".v4-bills-empty")).toContainText("No hay ningún recibo con ese nombre.");
  await buscar.fill("");

  await grupo(page, "Servicios y suministros").click();
  const f = fila(page, "Seguro del hogar");
  await expect(f).toBeVisible();
  const box = await f.boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
