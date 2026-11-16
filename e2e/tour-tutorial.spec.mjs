/* TOUR DE BIENVENIDA (coach-marks) — `Tour` en 02-ui-shared.js.
 *
 * Causa real del descuadre en su Oppo (CDP 4/8): `html.smalltext body{zoom:0.92}` — el rect
 * viene en px de pantalla y left/top fixed se leían en espacio pre-zoom. Aquí se prueba también
 * con letra pequeña. tipOnly = velo a pantalla entera (mismo tono), sin recorte.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

async function abrirAjustesConGesto(page) {
  const cdp = await page.context().newCDPSession(page);
  const y = 200,
    x0 = 30,
    x1 = page.viewportSize().width - 20,
    pasos = 16;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / pasos, y }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator(".settings-push.open")).toBeVisible({ timeout: 5_000 });
}

/* Mismo orden que `steps` en 02-ui-shared.js. tipOnly = velo sin recorte. */
const PASOS = [
  { sel: ".page .v4-hero-amt, [data-tour='hero-amt']", pad: 18 },
  { tipOnly: true },
  { sel: '.botnav-tab[data-tour="gastos"]' },
  { sel: ".botnav-fab", round: true },
  { sel: '.botnav-tab[data-tour="plan"]' },
  // El de Plan (`data-seg`): desde la 235 Gastos también lleva un `.v4-seg` (sus secciones) y,
  // premontado a la izquierda, `.first()` medía ese y no el que enseña el tour.
  { sel: ".v4-seg:has(> .v4-seg-btn[data-seg])" },
  { sel: '.botnav-tab[data-tour="cartera"]' },
  { sel: ".v4-avatar, [data-tour='avatar']", round: true },
  { tipOnly: true },
  { sel: ".botnav-row" },
];

async function targetBoxDe(page, paso) {
  return page.locator(paso.sel).first().boundingBox();
}

async function assertSpotSobreTarget(page, paso, i, tol) {
  if (paso.tipOnly) {
    const spot = page.locator(".tour-spot");
    await expect(spot).toHaveClass(/tiponly/, { timeout: 5_000 });
    // Velo visible a pantalla (no opacity:0): mismo tono de tutorial.
    const box = await spot.boundingBox();
    const vp = page.viewportSize();
    expect(box, `paso ${i}: tipOnly sin velo`).toBeTruthy();
    expect(box.width, `paso ${i}: velo estrecho`).toBeGreaterThan(vp.width * 0.9);
    expect(box.height, `paso ${i}: velo bajo`).toBeGreaterThan(vp.height * 0.9);
    return;
  }
  const spotBox = await page.locator(".tour-spot").boundingBox();
  const targetBox = await targetBoxDe(page, paso);
  expect(spotBox, `paso ${i}: no hay .tour-spot`).toBeTruthy();
  expect(targetBox, `paso ${i}: sin target`).toBeTruthy();
  const pad = paso.pad != null ? paso.pad : paso.round ? 8 : 10;
  const sx = spotBox.x + spotBox.width / 2,
    sy = spotBox.y + spotBox.height / 2;
  const tx = targetBox.x + targetBox.width / 2,
    ty = targetBox.y + targetBox.height / 2;
  expect(Math.abs(sx - tx), `paso ${i}: centro x descuadrado`).toBeLessThan(tol);
  expect(Math.abs(sy - ty), `paso ${i}: centro y descuadrado`).toBeLessThan(tol);
  expect(spotBox.width, `paso ${i}: foco más estrecho que el target`).toBeGreaterThanOrEqual(targetBox.width - 2);
  expect(spotBox.height, `paso ${i}: foco más bajo que el target`).toBeGreaterThanOrEqual(targetBox.height - 2);
  expect(pad).toBeGreaterThan(0);
}

async function assertTipNoTapaSpot(page, i, tipOnly) {
  if (tipOnly) return;
  const spot = await page.locator(".tour-spot").boundingBox();
  const tip = await page.locator(".tour-tip").boundingBox();
  expect(spot, `paso ${i}: spot`).toBeTruthy();
  expect(tip, `paso ${i}: tip`).toBeTruthy();
  const solapa = !(tip.x + tip.width < spot.x || tip.x > spot.x + spot.width || tip.y + tip.height < spot.y || tip.y > spot.y + spot.height);
  expect(solapa, `paso ${i}: la tarjeta tapa el foco (tip y=${tip.y} h=${tip.height}, spot y=${spot.y} h=${spot.height})`).toBe(false);
}

async function comprobarPasos(page) {
  for (let i = 0; i < PASOS.length; i++) {
    await expect(page.locator(".tour-tip")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(1_100);
    await assertSpotSobreTarget(page, PASOS[i], i, 16);
    await assertTipNoTapaSpot(page, i, !!PASOS[i].tipOnly);
    const btn = page.locator(".tour-btns button.btn-primary");
    const texto = (await btn.textContent()) || "";
    if (/listo|done|fet/i.test(texto)) break;
    await btn.click();
  }
}

test("tour de bienvenida: los 10 pasos caen sobre su sitio y el tip no los tapa", async ({ page }) => {
  await seedLoggedInDashboard(page, { tourSeen: false });
  await page.goto("/");
  await appLista(page);
  await expect(page.locator(".tour-wrap")).toBeVisible({ timeout: 5_000 });
  await comprobarPasos(page);
  await page.locator(".tour-btns button.btn-primary").click();
  await expect(page.locator(".tour-wrap")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}").tourSeen), { timeout: 5_000 })
    .toBe(true);
});

test("tour con letra pequeña (zoom body 0.92): el foco sigue al target — regresión Oppo", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    tourSeen: false,
    settings: { autoPrices: false, theme: "green", textSize: "small", lang: "es" },
  });
  await page.goto("/");
  await appLista(page);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).zoom), { timeout: 5_000 })
    .toBe("0.92");
  await expect(page.locator(".tour-wrap")).toBeVisible({ timeout: 5_000 });
  await comprobarPasos(page);
});

const TOLERANCIA_RAPIDA = 18;
test("al tocar «Siguiente» el recorte llega al sitio nuevo sin hacerte esperar", async ({ page }) => {
  await seedLoggedInDashboard(page, { tourSeen: false });
  await page.goto("/");
  await appLista(page);
  await expect(page.locator(".tour-wrap")).toBeVisible({ timeout: 5_000 });

  for (let i = 1; i < PASOS.length; i++) {
    await page.waitForTimeout(1_100);
    await page.locator(".tour-btns button.btn-primary").click();
    await page.waitForTimeout(400);
    await assertSpotSobreTarget(page, PASOS[i], i, TOLERANCIA_RAPIDA);
  }
});

test("Ajustes → Ver el tutorial reabre el mismo tour, ya con los pasos de gestos", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  await expect(page.locator(".tour-wrap")).toHaveCount(0);

  await abrirAjustesConGesto(page);

  await page.locator(".settings-push.open input").first().fill("tutorial");
  await page
    .locator(".settings-push.open")
    .getByText(/Ver el tutorial|See the tour|Veure el tutorial/i)
    .first()
    .click();

  await expect(page.locator(".tour-wrap")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".settings-push.open")).toHaveCount(0);
  await page.waitForTimeout(1_100);
  await assertSpotSobreTarget(page, PASOS[0], 0, 16);
  await assertTipNoTapaSpot(page, 0, false);
});

test("la tarjeta fija de gestos ya no existe en Ajustes", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await appLista(page);
  await abrirAjustesConGesto(page);
  await expect(page.locator(".settings-push.open .coach-card, .settings-push.open .coach-pill")).toHaveCount(0);
});

test("mensajes del tour: sin «verde», sin «borde», sin «arriba del todo»", async ({ page }) => {
  await seedLoggedInDashboard(page, { tourSeen: false });
  await page.goto("/");
  await appLista(page);
  await expect(page.locator(".tour-wrap")).toBeVisible({ timeout: 5_000 });

  const textos = [];
  for (let i = 0; i < PASOS.length; i++) {
    await page.waitForTimeout(700);
    textos.push(((await page.locator(".tour-txt").textContent()) || "").toLowerCase());
    const btn = page.locator(".tour-btns button.btn-primary");
    const t = (await btn.textContent()) || "";
    if (/listo|done|fet/i.test(t)) break;
    await btn.click();
  }
  const todo = textos.join(" | ");
  expect(todo).not.toMatch(/verde|green|verd\b/);
  expect(todo).not.toMatch(/borde izquierdo|left edge|vora esquerra/);
  expect(todo).not.toMatch(/si estás arriba del todo|while you're at the very top|si ets a dalt de tot/);
});
