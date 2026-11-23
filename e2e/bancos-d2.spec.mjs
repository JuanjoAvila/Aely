import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* D2 bancos, remates menores de la pasada 4 del filtro de diseño (24/11/2026): el «·» de una fila
 * nunca abre renglón, un banco sin logo lleva sus iniciales y la ficha de un bróker conectado no
 * repite lo que ya dice su cabecera. Render puro, por eso va en e2e (AGENTS §7). */
const hace = (h) => new Date(Date.now() - h * 3600000).toISOString();
const en = (d) => new Date(Date.now() + d * 86400000).toISOString();
const LINKS = [
  { aspsp_name: "Banco de Sabadell", aspsp_country: "ES", iban: "ES11", status: "active", valid_until: en(60), last_sync: hace(1), accounts: [{ uid: "a1" }] },
  { aspsp_name: "Banco Cetelem", aspsp_country: "ES", iban: "ES44", status: "active", valid_until: en(60), last_sync: hace(1), accounts: [{ uid: "a5" }, { uid: "a6" }] },
];

async function abre(page, extra = {}) {
  await seedLoggedInDashboard(page, Object.assign({
    __cloudRows: { bank_links: LINKS }, __cloudFns: { "bank-aspsps": { data: { ok: true, aspsps: [] }, error: null } },
    hasBankLink: true, obAccounts: [], accounts: [],
    investments: [{ id: "i2", ent: "myinvestor", name: "Fondo", shares: 5, value: 500, cost: 500, cur: "EUR" }],
    settings: { autoPrices: false, theme: "green", brokersOn: ["myinvestor"], textSize: "huge" },
  }, extra));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const push = page.locator(".v4-banks-push");
  await expect(push).toHaveClass(/open/, { timeout: 10_000 });
  return push;
}

test("el «·» de la fila nunca abre renglón (Enorme a 360) y «Otro banco» lleva iniciales", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const push = await abre(page);
  await expect(push.locator('.bk-row[data-aspsp="Banco Cetelem"]')).toHaveCount(1);
  const sueltos = await push.locator(".bk-mt .nw").evaluateAll((els) => els.map((e) => e.textContent.trim()).filter((x) => /^·\s*\S/.test(x)));
  expect(sueltos).toEqual([]);
  const caidos = await push.locator(".bk-mt .nw").evaluateAll((els) => els.filter((e) => e.textContent.trim() === "·").filter((e) => {
    const prev = e.previousElementSibling;
    return !prev || Math.abs(e.getBoundingClientRect().top - prev.getBoundingClientRect().top) > 4;
  }).length);
  expect(caidos).toBe(0);
  await expect(push.locator('.bk-row[data-aspsp="Banco Cetelem"] .mono')).toHaveText("BC");
  // Sin saldo: «—» con su etiqueta y en el MISMO renglón que el nombre, aunque sea Enorme (no hincha la tarjeta).
  const am = push.locator('.bk-row[data-aspsp="Banco Cetelem"] .bk-am');
  await expect(am).toHaveText("—");
  await expect(am).toHaveAttribute("aria-label", "sin saldo");
  const mismo = await am.evaluate((el) => {
    const nm = el.parentElement.querySelector(".bk-nm");
    return el.getBoundingClientRect().top < nm.getBoundingClientRect().bottom - 2;
  });
  expect(mismo).toBe(true);
});

test("la ficha de MyInvestor conectado no repite el estado y se «Quita», no se «Desconecta»", async ({ page }) => {
  await abre(page, {
    __cloudRows: { bank_links: LINKS, myinvestor_links: [{ status: "active", last_sync: hace(1), updated_at: hace(1), device_id: "d1" }] },
  });
  await page.locator('.bk-row[data-broker="myinvestor"] .bk-nm').click();
  const flow = page.locator('.bk-ficha[data-bk-ficha="myinvestor"] [data-broker-flow="myinvestor"]');
  await expect(flow.getByRole("button", { name: /Quitar/ })).toBeVisible({ timeout: 10_000 });
  await expect(flow).not.toContainText("conectado");
  await expect(flow).not.toContainText("Login con tu usuario");
  await expect(flow).not.toContainText("Desconectar");
});
