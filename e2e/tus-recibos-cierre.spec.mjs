/* Tus recibos: cerrarla con un desliz rápido y, sin parar, deslizar hacia otra pestaña (vídeo del
 * dueño, 11/11). Al desmontarse la pantalla, el foco volvía a «Todos», que vive en Plan; con el
 * carrusel ya camino de Gastos, el navegador desplazaba `.viewport` de lado para enseñarlo y
 * asomaba Cartera a medio gesto. Se mira lo que se pinta: el carrusel nunca se desplaza de lado
 * y la pestaña de destino aterriza en su sitio. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const settings = { autoPrices: false, theme: "cyber", lang: "es", simpleMode: false, expenseBanks: ["sabadell"] };
const recibo = (id, name, amount, day) => ({ id, name, amount, freq: "mes", day, account: "sabadell" });

test("cerrar Tus recibos de un desliz y pasar a Gastos no desplaza el carrusel", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "El gesto táctil real usa CDP");
  test.info().annotations.push({ type: "own-clock" });
  await page.clock.install({ time: new Date("2026-10-18T12:00:00+02:00") });
  await page.route("**/*", (r) => new URL(r.request().url()).hostname === "127.0.0.1" ? r.continue() : r.abort());
  const fixed = [];
  for (let i = 0; i < 10; i++) fixed.push(recibo("r" + i, "Recibo " + (i + 1), 10 + i, 21 + (i % 7)));
  await seedLoggedInDashboard(page, { __seedOnce: true, lastBackup: "2026-10-18", debts: [], flows: [], oneoffs: [], settings,
    accounts: [{ id: "bank", ent: "sabadell", role: "fijos", value: 3000 }], fixed, expenses: [], bankTx: [] });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.waitForTimeout(700);
  await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: /^(Gestionar|Todos)\b/ }).click();
  await expect(page.locator("[data-bills-manage]")).toBeVisible();
  await page.waitForTimeout(800);

  const cdp = await page.context().newCDPSession(page);
  // Con la CPU de un portátil la pantalla se desmonta antes de que llegue el segundo gesto.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.evaluate(() => {
    window.__vp = [];
    const vp = document.querySelector(".viewport");
    const loop = () => { window.__vp.push(vp.scrollLeft); if (window.__vp.length < 240) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  // Fling: pocas muestras muy separadas, como un dedo rápido a 120 Hz.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 60, y: 430 }] });
  for (const x of [110, 200, 320]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 430 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(150);
  // Y sin esperar a que acabe de irse, otro desliz a la derecha: Plan → Gastos.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 80, y: 300 }] });
  for (const x of [130, 200, 290]) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 300 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  await expect(page.locator("[data-bills-manage]")).toHaveCount(0);
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "gastos");
  const vp = await page.evaluate(() => window.__vp);
  expect(Math.max(...vp)).toBe(0);
  // Gastos queda entera a la vista, sin trozos de otra pestaña al lado.
  const gastos = await page.evaluate(() => {
    const pages = document.querySelector(".track").children;
    return Math.round(pages[1].getBoundingClientRect().left);
  });
  expect(gastos).toBe(0);
});
