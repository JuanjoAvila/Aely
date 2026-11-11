import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Tus recibos y el alta, tres peticiones del dueño del 11/11/2026 mirando la pantalla de verdad:
   - Cada sección enseña como mucho TRES filas y «Ver los N» despliega el resto; buscar sigue
     encontrando lo plegado. Personas también (antes salían las seis seguidas).
   - Sin la tarjeta «¿Me lo puedo permitir?» al final: repetía «¿Y si gasto…?» de «¿Te llega?».
   - Al dar de alta un recibo que ya tienes, una tarjeta que lo dice (solo informa). La luz y el gas
     de la misma compañía, el mismo día y por lo mismo NO son el mismo recibo.
   Y las filas de Recibos, compactas como el prototipo: se mide su alto a 412 px. Datos inventados. */
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuentas = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }, { id: "tr", ent: "trade_republic", role: "fijos", value: 400 }];
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const conPersona = (id, name, day, pid, n) => recibo(id, name, 10, day, { bankAmount: 20, reparto: [{ id: pid, n, via: "bizum", amt: 10 }] });
const seis = [
  conPersona("r1", "Netflix", 3, "p1", "Ana"), conPersona("r2", "Spotify", 4, "p2", "Bea"), conPersona("r3", "Disney+", 6, "p3", "Carla"),
  conPersona("r4", "HBO Max", 7, "p4", "Dani"), conPersona("r5", "Filmin", 9, "p5", "Eva"), conPersona("r6", "Prime Video", 11, "p6", "Fran")
];

async function abrePlan(page, overrides, vp) {
  test.info().annotations.push({ type: "own-clock" });
  if (vp) await page.setViewportSize(vp);
  await page.clock.install({ time: new Date("2026-11-11T12:00:00+01:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-11-11", bankTx: [], debts: [], flows: [], oneoffs: [], expenses: [], settings, accounts: cuentas }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  return page.locator('.page-live .v4-screen > [data-seg="recibos"]');
}
async function abreTodos(page, recibos) {
  await recibos.getByTestId("plan-todos").click();
  const hub = page.locator('[data-bills-manage] [data-screen="bills-home"]');
  await expect(hub).toBeVisible();
  return hub;
}
const sec = (hub, id) => hub.locator('[data-mg-sec="' + id + '"]');
const hoja = (page) => page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
const paso = (page, n) => hoja(page).locator('[data-rp4-paso="' + n + '"]');
const teclea = async (page, n, digits) => { for (const d of digits) await paso(page, n).locator('.v4-keys button[aria-label="' + d + '"]').click(); };
const siguiente = (page) => hoja(page).locator(".rp4-cta");
// Del importe al resumen: el día y el banco (con dos bancos se elige).
async function hastaResumen(page, cifra, dia) {
  await expect(hoja(page)).toHaveAttribute("data-paso", "1");
  await teclea(page, 1, cifra);
  await siguiente(page).click();
  await paso(page, 2).locator('[data-rp4-dia="' + dia + '"]').click();
  await siguiente(page).click();
  await paso(page, 3).locator('[data-rp4-banco="sabadell"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "4");
}

test("Tus recibos: tres por sección y «Ver los N»; Personas igual; buscar encuentra lo plegado", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: seis });
  const hub = await abreTodos(page, recibos);
  // Recibos: tres a la vista y el resto plegado.
  const serv = sec(hub, "serv");
  await expect(serv.locator(":scope > .pr6-row")).toHaveCount(3);
  await expect(serv.locator('[data-mg-more="serv"]')).toHaveText("Ver los 6");
  await expect(serv.locator(".pr6-fold")).not.toHaveClass(/open/);
  // Personas: tres y «Ver los 6».
  const gente = sec(hub, "people");
  await expect(gente.locator("[data-persona]")).toHaveCount(6);
  await expect(gente.locator(".pr6-mg-pl > [data-persona]")).toHaveCount(3);
  const mas = gente.locator('[data-mg-more="people"]');
  await expect(mas).toHaveText("Ver los 6");
  await expect(mas).toHaveAttribute("aria-expanded", "false");
  // Plegadas siguen en el DOM (se despliegan con transición) pero sin alto y fuera del foco.
  const pliegue = gente.locator("#mg-mas-people");
  const alto = () => pliegue.evaluate((e) => Math.round(e.getBoundingClientRect().height));
  await expect(pliegue.locator(".pr6-fold-in")).toHaveAttribute("aria-hidden", "true");
  expect(await alto()).toBe(0);
  await mas.click();
  await expect(mas).toHaveAttribute("aria-expanded", "true");
  await expect(mas).toHaveText("Ver menos");
  await expect(pliegue.locator(".pr6-fold-in")).not.toHaveAttribute("aria-hidden", "true");
  await expect.poll(alto).toBeGreaterThan(150);
  // Plegar deja a la vista el principio de la sección.
  await mas.click();
  await expect(mas).toHaveAttribute("aria-expanded", "false");
  await expect.poll(alto).toBe(0);
  await page.waitForTimeout(500);
  await expect(gente.locator(".pr6-sec-h")).toBeInViewport();
  // Buscar algo que está plegado lo enseña, sin «Ver los N».
  await hub.locator("[data-bills-search]").fill("prime");
  await expect(serv.locator('[data-bill-id="r6"]')).toBeVisible();
  await expect(serv.locator("[data-mg-more]")).toHaveCount(0);
  // Y sin la tarjeta «¿Me lo puedo permitir?» al final.
  await hub.locator("[data-bills-search]").fill("");
  await expect(hub.locator('[data-mg-sec="people"]')).toBeVisible();
  await expect(page.locator("[data-bills-afford]")).toHaveCount(0);
  await expect(page.locator("[data-bills-manage]")).not.toContainText("¿Me lo puedo permitir?");
});

test("alta: tocar «Gas» con un gas que ya tienes avisa en el nombre y en el resumen, sin impedir guardar", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("gas", "Gas (Naturgy)", 45, 5, { category: "gas" })] });
  const hub = await abreTodos(page, recibos);
  await hub.locator('[data-act="bill-add"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await paso(page, 0).locator('[data-rp4-sug="gas"]').click();
  await hastaResumen(page, "48", 6);
  const aviso = paso(page, 4).locator('[data-rp4="dup"]');
  await expect(aviso).toContainText("Ya tienes «Gas (Naturgy)» · 45,00 € el día 5");
  await expect(aviso).toContainText("Ver ese");
  // Es solo un aviso: se puede guardar igual.
  await expect(siguiente(page)).toBeEnabled();
  // «Lu» no avisa; «Gas» tecleado sí, ya en el nombre.
  await hoja(page).locator('[data-rp4-fila="0"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await paso(page, 0).locator('[data-rp4="name"]').fill("Ga");
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toHaveCount(0);
  await paso(page, 0).locator('[data-rp4="name"]').fill("Gas");
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toContainText("Ya tienes «Gas (Naturgy)»");
  // «Ver ese» abre el que ya estaba.
  await paso(page, 0).locator('[data-rp4="dup"]').click();
  await expect(hoja(page)).toHaveAttribute("data-modo", "edit");
  await expect(paso(page, 4).locator(".rp4-row-v").first()).toHaveText("Gas (Naturgy)");
});

test("alta: la luz y el gas de la misma compañía, mismo banco y mismo día, NO avisan", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "GC RE OCTOPUS ENERGY", 52, 25, { category: "luz" })] });
  const hub = await abreTodos(page, recibos);
  await hub.locator('[data-act="bill-add"]').click();
  await paso(page, 0).locator('[data-rp4-sug="gas"]').click();
  await hastaResumen(page, "52", 25);
  await expect(paso(page, 4).locator('[data-rp4="dup"]')).toHaveCount(0);
  // Ni compartiendo el nombre de la compañía: «Octopus gas» es gas, el otro es luz.
  await hoja(page).locator('[data-rp4-fila="0"]').click();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Octopus gas");
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toHaveCount(0);
});

test("alta: dos comercializadoras de luz que solo comparten «Energy» no avisan", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("luz", "GC RE OCTOPUS ENERGY", 52, 25, { category: "luz" })] });
  const hub = await abreTodos(page, recibos);
  await hub.locator('[data-act="bill-add"]').click();
  await paso(page, 0).locator('[data-rp4="name"]').fill("Holaluz Energy");
  await expect(paso(page, 0).locator('[data-rp4="name"]')).toHaveValue("Holaluz Energy");
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toHaveCount(0);
});

test("alta desde el buscador sin resultados: misma categoría e importe parecido avisa en el resumen", async ({ page }) => {
  const recibos = await abrePlan(page, { fixed: [recibo("gas", "Gas casa", 45, 5, { category: "gas" }), recibo("net", "Netflix", 12.99, 8, { category: "ocio" })] });
  const hub = await abreTodos(page, recibos);
  await hub.locator("[data-bills-search]").fill("nedgia");
  await expect(hub.locator("[data-bills-noresults]")).toBeVisible();
  await hub.locator('[data-act="bill-add-q"]').click();
  await expect(hoja(page)).toHaveAttribute("data-paso", "0");
  await expect(paso(page, 0).locator('[data-rp4="name"]')).toHaveValue("Nedgia");
  // Sin importe todavía no hay con qué comparar.
  await expect(paso(page, 0).locator('[data-rp4="dup"]')).toHaveCount(0);
  await siguiente(page).click();
  await hastaResumen(page, "45", 20);
  await expect(paso(page, 4).locator('[data-rp4="dup"]')).toContainText("Ya tienes «Gas casa» · 45,00 € el día 5");
});

/* Filas de Recibos a 412 px (su OnePlus 13). Antes: fecha grande, nombre, banco y «en 14 días» en
   renglones sueltos, y una cuota de deuda en cuatro. Ahora una línea de subtítulo con elipsis. */
test("filas compactas a 412 px: una línea de subtítulo, también la cuota de deuda", async ({ page }) => {
  const recibos = await abrePlan(page, {
    fixed: [recibo("luz", "GC RE OCTOPUS ENERGY SL FACTURA", 52, 25, { category: "luz" }), recibo("gas", "Gas", 41, 25, { category: "gas" }),
      recibo("agua", "Agua", 30, 28, { category: "agua" })],
    debts: [{ id: "tv", name: "Tele a plazos", monthly: 39, value: 400, account: "trade_republic", day: 29, asOf: 2026 * 12 + 10 }]
  }, { width: 412, height: 915 });
  const due = recibos.getByTestId("plan-due");
  const filas = due.locator(".pr6-row");
  await expect(filas.first()).toBeVisible();
  const medidas = await filas.evaluateAll((els) => els.map((e) => {
    const sub = e.querySelector(".sub"), lh = parseFloat(getComputedStyle(sub).lineHeight) || parseFloat(getComputedStyle(sub).fontSize) * 1.3;
    return { id: e.getAttribute("data-recibo"), alto: Math.round(e.getBoundingClientRect().height), sub: sub.textContent, renglones: Math.round(sub.getBoundingClientRect().height / lh * 10) / 10 };
  }));
  test.info().annotations.push({ type: "altos-412", description: JSON.stringify(medidas) });
  for (const m of medidas) {
    // Una sola línea de subtítulo, con «cuándo» dentro.
    expect(m.renglones, m.id + ": " + m.sub).toBeLessThanOrEqual(1.1);
    expect(m.sub, m.id).toMatch(/en \d+ días|mañana|hoy/);
    // Como el prototipo: casilla de 56 px + 12 + 12 de relleno + borde, ≈ 82 px.
    expect(m.alto, m.id).toBeLessThanOrEqual(84);
  }
  expect(medidas.find((m) => /^debt_/.test(m.id)).sub).toMatch(/^cuota · Trade Republic ?· en \d+ días$/);
});
