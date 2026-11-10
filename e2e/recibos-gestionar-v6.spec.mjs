import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* Tus recibos (Gestionar) según la SPEC §3 del rediseño de Recibos y el prototipo que aprobó el
   dueño (docs/design/plan-recibos/): tarjeta «SE TE VAN CADA MES» que alterna con el año, buscador,
   chips de banco y secciones planas (Recibos, Cuotas de deuda, De una sola vez, avisos de solapes y
   Personas). Se mira lo que se pinta y que la cifra de arriba sea la suma de las secciones. */
const YM = 2026 * 12 + 10;
const settings = { autoPrices: false, theme: "green", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const cuentas = [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }, { id: "rev", ent: "revolut", role: "fijos", value: 400 }];
const recibo = (id, name, amount, day, extra) => Object.assign({ id, name, amount, freq: "mes", day, account: "sabadell" }, extra || {});
const fixed = [
  recibo("alq", "Alquiler", 850, 1, { category: "hogar" }),
  recibo("gym", "Gimnasio", 39.9, 2),
  recibo("spo", "Spotify", 10.99, 2, { account: "revolut" }),
  recibo("seg", "Seguro del coche", 41.2, 3),
  recibo("net", "Netflix", 12.99, 8, { account: "revolut" }),
  recibo("dis", "Disney+", 8.99, 12, { account: "revolut" }),
  recibo("hbo", "HBO Max", 9.99, 14, { account: "revolut" }),
  // Compartido con la pareja (Bizum) y la familia (se descuenta de lo que se le paga a Mamá).
  recibo("pepe", "Pepephone", 22, 20, { bankAmount: 85, reparto: [
    { id: "pe_pareja", n: "Pareja", via: "bizum", amt: 10 }, { id: "pe_fam", n: "Familia", via: "debt", debtId: "mama", amt: 53 }] }),
  recibo("yt", "YouTube Premium", 4.99, 22, { bankAmount: 9.98, reparto: [{ id: "pe_pareja", n: "Pareja", via: "bizum", amt: 4.99 }] }),
  // Trimestral: en la fila su cobro, en la sección su parte de cada mes (30 / 3 = 10).
  recibo("agua", "Agua", 30, 25, { freq: "trimestral" })
];
const mama = { id: "mama", name: "Mamá", monthly: 197, amort: 250, value: 5000, account: "sabadell", day: 1, asOf: YM - 1 };
const hipo = { id: "hipo", name: "Hipoteca", monthly: 660.85, value: 120000, account: "sabadell", day: 1, asOf: YM - 1 };
const itv = { id: "itv", name: "ITV del coche", amount: 45.6, day: 12, month: 11, year: 2026, account: "sabadell" };
const viejo = { id: "old", name: "Multa vieja", amount: 90, day: 3, month: 9, year: 2026, account: "sabadell" };

const num = (s) => Number(String(s).replace(/[^\d,]/g, "").replace(",", "."));
const cent = (x) => Math.round(x * 100);

async function abreGestionar(page, overrides) {
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true, lastBackup: "2026-10-18", bankTx: [], flows: [], expenses: [], settings, accounts: cuentas,
    fixed, debts: [hipo, mama], oneoffs: [itv, viejo] }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  // La portada (rama de la portada) vuelve a «Todos ›» con `data-testid="plan-todos"`; hasta que
  // se integre, el enlace de hoy se llama «Gestionar».
  await recibos.getByTestId("plan-todos").or(recibos.getByTestId("plan-due").getByRole("button", { name: "Gestionar" })).click();
  const hub = page.locator('[data-bills-manage] [data-screen="bills-home"]');
  await expect(hub).toBeVisible();
  return hub;
}
const sec = (hub, id) => hub.locator('[data-mg-sec="' + id + '"]');
const fila = (hub, id) => hub.locator('[data-bill-id="' + id + '"]');

test("cabecera, tarjeta con desglose y secciones con sus cifras: la de arriba es la suma de Recibos y Cuotas", async ({ page }) => {
  const hub = await abreGestionar(page);
  await expect(hub.locator(".settings-push-h h1")).toHaveText("Tus recibos");
  await expect(hub.locator(".settings-push-h .back svg")).toHaveCount(1);
  // Recibos: 850 + 39,90 + 10,99 + 41,20 + 12,99 + 8,99 + 9,99 + 22 (tu parte) + 4,99 + 10 (agua al mes) = 1.011,05.
  // Cuotas: 660,85 + 250 (197 del banco + 53 de Pepephone) = 910,85. Total 1.921,90.
  await expect(hub.locator("[data-bills-total]")).toHaveText("1.921,90 €");
  await expect(hub.locator("[data-bills-desglose]")).toHaveText("recibos 1.011,05 € + cuotas 910,85 €");
  await expect(sec(hub, "serv").locator('[data-mg-sum="serv"]')).toHaveText("1.011,05 €/mes");
  await expect(sec(hub, "debt").locator('[data-mg-sum="debt"]')).toHaveText("910,85 €/mes");
  const total = num(await hub.locator("[data-bills-total]").innerText());
  const partes = num(await sec(hub, "serv").locator('[data-mg-sum="serv"]').innerText()) + num(await sec(hub, "debt").locator('[data-mg-sum="debt"]').innerText());
  expect(cent(total)).toBe(cent(partes));
  // Y es la misma que publica el motor (`billsHeroTotal`), no otra cuenta.
  const motor = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return billsHeroTotal(s, null); });
  expect(cent(motor)).toBe(cent(total));

  // Recibos: cuatro a la vista por día, casilla «N DÍA», «categoría · banco», y «Ver los 10».
  const serv = sec(hub, "serv");
  await expect(serv.locator(".pr6-sec-h")).toContainText("Recibos");
  await expect(serv.locator('[data-act="bill-add"]')).toHaveText("Añadir");
  await expect(serv.locator(":scope > .pr6-row")).toHaveCount(4);
  await expect(serv.locator(":scope > .pr6-row").first()).toHaveAttribute("data-bill-id", "alq");
  await expect(fila(hub, "alq").locator(".dt")).toHaveText("1DÍA");
  await expect(fila(hub, "alq").locator(".sub")).toHaveText("Hogar · Sabadell");
  await expect(fila(hub, "alq").locator(".am")).toHaveText("850,00 €");
  await expect(fila(hub, "agua").locator(".sub")).toHaveText("Sabadell · cada tres meses");
  await expect(fila(hub, "agua").locator(".am")).toHaveText("30,00 €");
  await expect(fila(hub, "pepe").locator(".sub")).toContainText("compartido");
  const mas = serv.locator('[data-mg-more="serv"]');
  await expect(mas).toHaveText("Ver los 10");
  await expect(fila(hub, "agua")).not.toBeInViewport();
  await mas.click();
  await expect(mas).toHaveAttribute("aria-expanded", "true");
  await expect(mas).toHaveText("Ver menos");
  await mas.click();
  await expect(mas).toHaveAttribute("aria-expanded", "false");

  // Cuotas de deuda, con lo que se descuenta de un recibo compartido.
  const debt = sec(hub, "debt");
  await expect(fila(hub, "mama").locator(".sub")).toHaveText("197 € + 53 € de Pepephone");
  await expect(fila(hub, "mama").locator(".am")).toHaveText("250,00 €");
  await expect(debt.locator('[data-act]')).toHaveCount(0);

  // De una sola vez: los que vienen con su fecha; el que ya pasó no sale.
  const once = sec(hub, "once");
  await expect(once.locator(".pr6-sec-h")).toContainText("no se repiten");
  await expect(once.locator('[data-act="bill-add-once"]')).toHaveCount(1);
  await expect(fila(hub, "itv").locator(".dt")).toHaveText(/^12\s*NOV$/, { useInnerText: true });
  await expect(fila(hub, "old")).toHaveCount(0);

  // Personas: avatar con inicial, sus recibos y su parte al mes.
  const pe = sec(hub, "people");
  await expect(pe.locator('[data-act="persona-add"]')).toHaveText("Añadir");
  await expect(pe.locator('[data-persona="pe_pareja"]')).toContainText("P");
  await expect(pe.locator('[data-persona="pe_pareja"] .sub')).toHaveText("Pepephone y YouTube Premium · 14,99 € al mes");
  await expect(pe.locator('[data-persona="pe_fam"] .sub')).toHaveText("Pepephone · 53 € al mes · se descuenta de Mamá");

  // Al año: tocar la tarjeta lo multiplica todo por doce, también secciones y filas.
  await hub.locator("[data-bills-hero]").click();
  await expect(hub.locator("[data-bills-hero] .v4-micro")).toHaveText("SE TE VAN AL AÑO");
  await expect(hub.locator("[data-bills-total]")).toHaveText("23.062,80 €");
  await expect(sec(hub, "serv").locator('[data-mg-sum="serv"]')).toHaveText("12.132,60 €/año");
  await expect(fila(hub, "agua").locator(".am")).toHaveText("120,00 €");
  await hub.locator("[data-bills-hero]").click();
  await expect(hub.locator("[data-bills-total]")).toHaveText("1.921,90 €");
});

test("buscador, chips de banco, ✕ de los avisos y la puerta a una persona, a un recibo y a una cuota", async ({ page }) => {
  const hub = await abreGestionar(page);
  // Avisos de solapes con los recibos de verdad.
  const ov = hub.locator("[data-solape]");
  await expect(ov).toHaveCount(2);
  await expect(hub.locator('[data-solape="musica"]')).toContainText("Spotify y YouTube Premium incluyen música");
  await expect(hub.locator('[data-solape="musica"]')).toContainText("15,98 € al mes entre los dos");
  await expect(hub.locator('[data-solape="series"]')).toContainText("3 plataformas de series: Netflix, Disney+ y HBO Max");
  await expect(hub.locator('[data-solape="series"]')).toContainText("31,97 € al mes entre las 3");
  await hub.locator('[data-solape="musica"] [data-act="solape-x"]').click();
  await expect(hub.locator('[data-solape="musica"]')).toHaveCount(0);
  await expect(hub.locator('[data-solape="series"]')).toHaveCount(1);
  // Guardado: al volver a entrar no sale.
  await expect.poll(() => page.evaluate(() => (mcLoadRaw(mcStateKey()).settings.recSolapesNo || []).length)).toBe(1);

  // Chips: Todas, Sabadell y Revolut. Revolut deja solo lo suyo y la cifra lo sigue.
  const chips = hub.locator("[data-mg-bank]");
  await expect(chips).toHaveText(["Todas", "Sabadell", "Revolut"]);
  await expect(hub.locator('[data-mg-bank="todas"]')).toHaveAttribute("aria-checked", "true");
  await hub.locator('[data-mg-bank="revolut"]').click();
  await expect(hub.locator('[data-mg-bank="revolut"]')).toHaveAttribute("aria-checked", "true");
  await expect(sec(hub, "serv").locator(".pr6-row")).toHaveCount(4);
  await expect(sec(hub, "debt")).toHaveCount(0);
  await expect(hub.locator("[data-bills-total]")).toHaveText("42,96 €");
  await hub.locator('[data-mg-bank="todas"]').click();
  await expect(hub.locator("[data-bills-total]")).toHaveText("1.921,90 €");

  // Buscador: por nombre sin acentos y por importe; sin resultados, ofrece darlo de alta.
  const q = hub.locator("[data-bills-search]");
  await q.fill("gimnasio");
  await expect(hub.locator(".pr6-row")).toHaveCount(1);
  await expect(fila(hub, "gym")).toBeVisible();
  await expect(hub.locator("[data-solape]")).toHaveCount(0);
  await expect(sec(hub, "people")).toHaveCount(0);
  await q.fill("660");
  await expect(hub.locator(".pr6-row")).toHaveCount(1);
  await expect(fila(hub, "hipo")).toBeVisible();
  await q.fill("piscina");
  await expect(hub.locator("[data-bills-noresults]")).toContainText("Nada con «piscina»");
  await hub.locator('[data-act="bill-add-q"]').click();
  const pasos = page.locator('.v4-sheet[data-sheet="recibo-pasos"]');
  await expect(pasos).toBeVisible();
  await expect(pasos.locator("input").first()).toHaveValue("Piscina");
  await page.goBack();
  await expect(pasos).toHaveCount(0);
  await q.fill("");

  // Una persona abre su ficha.
  await sec(hub, "people").locator('[data-persona="pe_fam"]').click();
  const ps = page.locator('.v4-sheet[data-sheet="persona"]');
  await expect(ps).toBeVisible();
  await expect(ps).toContainText("Familia");
  await page.goBack();
  await expect(ps).toHaveCount(0);

  // Un recibo abre su edición por pasos.
  await fila(hub, "gym").click();
  await expect(pasos).toBeVisible();
  await expect(pasos).toContainText("Gimnasio");
  await page.goBack();
  await expect(pasos).toHaveCount(0);
  await expect(hub).toBeVisible();

  // Una cuota lleva a su tarjeta en Deudas y cierra Tus recibos.
  await fila(hub, "mama").click();
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator('.v4-seg-btn[data-seg="deudas"]')).toHaveAttribute("aria-selected", "true");
});

test("sin solapes inventados y con «Lo que entra» y «¿Me lo puedo permitir?» todavía a mano", async ({ page }) => {
  const hub = await abreGestionar(page, {
    fixed: [recibo("prime", "Amazon Prime", 4.99, 5), recibo("net", "Netflix", 12.99, 8), recibo("mov", "Movistar fibra", 40, 9)],
    flows: [{ id: "nom", name: "Nómina", kind: "income", amount: 1800, day: 28, to: "sabadell" }], debts: [], oneoffs: []
  });
  await expect(hub.locator("[data-solape]")).toHaveCount(0);
  await expect(hub.locator("[data-bills-desglose]")).toHaveCount(0);
  const ent = sec(hub, "in");
  await expect(ent).toContainText("Nómina");
  await expect(fila(hub, "nom").locator(".am")).toHaveText("+1.800,00 €");
  await expect(ent.locator('[data-act="bill-add-flow"]')).toHaveCount(1);
  // Lo que entra no suma a lo que se va.
  await expect(hub.locator("[data-bills-total]")).toHaveText("57,98 €");
  await hub.locator("[data-bills-afford]").click();
  await expect(page.locator('[data-bills-manage]')).toHaveAttribute("data-screen", "bills-afford");
  await page.goBack();
  await expect(page.locator('[data-bills-manage]')).toHaveAttribute("data-screen", "bills-home");
});

test("un recibo en pausa no suma este mes; al año solo faltan los cobros de la pausa, y el simulador parte de la misma cifra (P2-9)", async ({ page }) => {
  // Comunidad pausada octubre y noviembre; Gimnasio pagado en octubre y pausado noviembre y diciembre;
  // Agua (trimestral de ene/abr/jul/oct) pausada solo octubre; un seguro anual de marzo pausado hasta
  // enero. Los cuatro dicen «pausado hasta…» y ninguno entra en la cifra del mes.
  const hub = await abreGestionar(page, { fixed: fixed.concat([
    recibo("com", "Comunidad", 75, 5, { pausedFrom: YM, pausedUntil: YM + 2 }),
    recibo("sh", "Seguro de hogar", 600, 10, { freq: "año", months: [3], pausedFrom: YM, pausedUntil: YM + 3 })]).map((r) =>
    r.id === "gym" ? Object.assign({}, r, { pausedFrom: YM + 1, pausedUntil: YM + 3 })
      : r.id === "agua" ? Object.assign({}, r, { pausedFrom: YM, pausedUntil: YM + 1 }) : r) });
  await expect(fila(hub, "com")).toHaveClass(/pr6-mg-off/);
  await expect(fila(hub, "com").locator(".sub")).toHaveText("pausado hasta dic");
  await expect(fila(hub, "com").locator(".am")).toHaveText("75,00 €");
  await expect(fila(hub, "gym").locator(".sub")).toHaveText("pausado hasta ene");
  await expect(fila(hub, "sh").locator(".sub")).toHaveText("pausado hasta ene");
  await expect(fila(hub, "agua").locator(".sub")).toHaveText("pausado hasta nov");
  await expect(fila(hub, "alq")).not.toHaveClass(/pr6-mg-off/);
  // 1.011,05 − 39,90 del gimnasio − 10 del agua = 961,15; la comunidad y el seguro no estaban.
  await expect(sec(hub, "serv").locator('[data-mg-sum="serv"]')).toHaveText("961,15 €/mes");
  await expect(hub.locator("[data-bills-total]")).toHaveText("1.872,00 €");
  await expect(hub.locator("[data-bills-desglose]")).toHaveText("recibos 961,15 € + cuotas 910,85 €");
  const motor = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey()); return billsHeroTotal(s, null); });
  expect(cent(motor)).toBe(187200);
  // Al año (oct 2026 – sep 2027) solo faltan los cobros que caen en la pausa: comunidad 900 − 150,
  // gimnasio 478,80 − 79,80, agua 120 − 30 (el de octubre) y el seguro entero (se cobra en marzo).
  // Recibos: 11.533,80 de los que no se pausan + 750 + 399 + 90 + 600 = 13.372,80; cuotas 10.930,20.
  await hub.locator("[data-bills-hero]").click();
  await expect(hub.locator("[data-bills-total]")).toHaveText("24.303,00 €");
  await expect(sec(hub, "serv").locator('[data-mg-sum="serv"]')).toHaveText("13.372,80 €/año");
  await expect(hub.locator("[data-bills-desglose]")).toHaveText("recibos 13.372,80 € + cuotas 10.930,20 €");
  await expect(fila(hub, "com").locator(".am")).toHaveText("750,00 €");
  await expect(fila(hub, "agua").locator(".am")).toHaveText("90,00 €");
  await expect(fila(hub, "sh").locator(".am")).toHaveText("600,00 €");
  const anual = await page.evaluate(() => { const s = mcLoadRaw(mcStateKey());
    return ["serv", "debt"].reduce((a, g) => a + billsGroupRows(s, g, 10, 2026).reduce((b, r) => b + (r.anual != null ? r.anual : r.monthly * 12), 0), 0); });
  expect(cent(anual)).toBe(2430300);
  await hub.locator("[data-bills-hero]").click();
  await expect(hub.locator("[data-bills-total]")).toHaveText("1.872,00 €");

  // «¿Me lo puedo permitir?» a plazos: los fijos parten de la cifra de arriba, no de la que contaba los pausados.
  await hub.locator("[data-bills-afford]").click();
  const sim = page.locator('[data-bills-manage] [data-testid="afford-sim"]');
  await expect(sim).toBeVisible();
  await sim.getByRole("button", { name: "A plazos" }).click();
  await sim.getByPlaceholder("Importe €").fill("1200");
  await expect(sim).toContainText(/Tus fijos pasarían de 1\.?872 € a 1\.?972 €\/mes/);
});

test("la barra de abajo se ve encima de Tus recibos, no tapa la última fila y cada pestaña lo cierra (N8)", async ({ page }) => {
  const hub = await abreGestionar(page);
  const nav = page.locator(".botnav");
  await expect(nav).toHaveCount(1);
  await expect(nav).toBeInViewport();
  await expect(nav).not.toHaveClass(/botnav-hidden/);
  // Por encima de verdad: lo que hay en el centro de la pestaña Gastos es la pestaña, no la lista.
  const encima = () => page.evaluate(() => {
    const b = document.querySelector('.botnav-tab[data-tour="gastos"]').getBoundingClientRect();
    const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return !!(el && el.closest(".botnav"));
  });
  await expect.poll(encima).toBe(true);
  // Sin desenfoque ni transform: encima del scroller raíz cortaban la ola de Android.
  const st = await nav.evaluate((el) => { const s = getComputedStyle(el); return { bf: s.backdropFilter, tr: s.transform, wc: s.willChange }; });
  expect(st).toEqual({ bf: "none", tr: "none", wc: "auto" });
  // Al fondo del todo, lo último de la lista queda por encima de la barra.
  // Lo último es «¿Me lo puedo permitir?» (se monta un fotograma después que lo de arriba).
  const ultimo = page.locator("[data-bills-manage] [data-bills-afford]");
  await expect(ultimo).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => {
    const p = document.querySelector("[data-bills-manage]"); p.scrollTop = p.scrollHeight;
    const ult = p.querySelector("[data-bills-afford]").getBoundingClientRect();
    return Math.round(document.querySelector(".botnav").getBoundingClientRect().top - ult.bottom);
  })).toBeGreaterThanOrEqual(0);

  // Otra pestaña: se cierra Tus recibos y se llega a ella; la barra vuelve a su sitio.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator('.botnav-tab[data-tour="gastos"]')).toHaveClass(/active/);
  await expect(page.locator(".app-shell > .botnav")).toHaveCount(1);
  await expect(page.locator("html")).not.toHaveClass(/bills-open/);

  // Plan otra vez (la suya): se cierra deslizando y deja Plan › Recibos.
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  const recibos = page.locator('.page-live .v4-screen > [data-seg="recibos"]');
  await recibos.getByTestId("plan-todos").click();
  await expect(hub).toBeVisible();
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  await expect(recibos).toBeVisible();

  // ← y el atrás del sistema también la devuelven a `.app-shell`.
  await recibos.getByTestId("plan-todos").click();
  await expect(hub).toBeVisible();
  await expect(page.locator("body > .botnav")).toHaveCount(1);
  await hub.locator(".settings-push-h .back").click();
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator(".app-shell > .botnav")).toHaveCount(1);
  await recibos.getByTestId("plan-todos").click();
  await expect(hub).toBeVisible();
  await page.goBack();
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator(".app-shell > .botnav")).toHaveCount(1);
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  // Y el borde (atrás nativo de Android): la pantalla acompaña al dedo con la barra quieta encima.
  await recibos.getByTestId("plan-todos").click();
  await expect(hub).toBeVisible();
  const borde = (phase, progress) => page.evaluate(([f, p]) => { const e = new Event("mcNativeEdgeBack"); e.phase = f; e.progress = p; window.dispatchEvent(e); }, [phase, progress]);
  await borde("start", 0); await borde("progress", .5);
  await expect(page.locator("body > .botnav")).toBeInViewport();
  await borde("invoke", 1);
  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator(".app-shell > .botnav")).toHaveCount(1);
});
