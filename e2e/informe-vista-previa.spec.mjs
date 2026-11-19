import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* INFORME DEL MES — vista previa antes de guardar (19/11/2026: «no guarda nada; que lo enseñe
 * primero, que lo guarde después y que al tocar el archivo se abra»). En la APK no había forma de
 * guardar: `<a download>` con `blob:` no hace nada en la WebView y aun así se decía «guardado».
 * El guardado nativo (MediaStore + noti que abre el fichero) es Java y aquí es un doble: se
 * comprueba qué se le pide, no la carpeta del móvil. */

const state = {
  budget: 900,
  settings: { autoPrices: false, theme: "green", gTotalMode: "split", expenseBanks: ["sabadell"] },
  accounts: [{ id: "sab", ent: "sabadell", name: "Cuenta sintética", value: 1000, role: "diario", spendFrom: true }],
  expenses: [{ id: "g", date: "2026-11-10T12:00:00Z", amount: 120.5, merchant: "Super sintético", category: "super", ent: "sabadell", source: "manual" }],
};

async function boot(page) {
  await page.clock.install({ time: new Date("2026-11-19T10:00:00Z") });
  await page.route("https://**/*", (route) => route.abort());
  await seedLoggedInDashboard(page, state);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

async function openPreview(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.getByRole("heading", { name: /Ajustes/i })).toBeVisible({ timeout: 8_000 });
  await page.locator(".set-row", { hasText: "Informe del mes" }).click();
  const sheet = page.locator(".askback.ask-preview");
  const img = sheet.locator("img.ask-img");
  await expect(img).toBeVisible();
  // La imagen de verdad (1080×1350), no un hueco: se ha decodificado entera.
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth + "x" + el.naturalHeight)).toBe("1080x1350");
  // El mes lo dice la imagen; la hoja no lo repite pintado, solo para el lector de pantalla.
  await expect(sheet.getByRole("dialog")).toHaveAttribute("aria-label", "Noviembre 2026");
  await expect(sheet.locator(".ts-title")).toHaveCount(0);
  return sheet;
}

// Imagen y botones caben enteros en pantalla: nada cortado por abajo.
async function cabe(page, sheet) {
  // Tras la subida de la hoja (sheetup): a mitad de animación todo está más abajo.
  await page.waitForFunction(() => { const s = document.querySelector(".ask-preview .tabsheet"); return s && s.getAnimations().every((a) => a.playState !== "running"); });
  const vh = await page.evaluate(() => window.innerHeight);
  for (const loc of [sheet.locator("img.ask-img"), sheet.locator(".ask-btns .btn").last()]) {
    const b = await loc.boundingBox();
    expect(b && b.y >= 0 && b.y + b.height <= vh + 1, "dentro de la pantalla: " + JSON.stringify(b) + " vh=" + vh).toBe(true);
  }
}

test("Ajustes → Informe del mes: vista previa entera; Cerrar no guarda nada", async ({ page }) => {
  await boot(page);
  let downloads = 0;
  page.on("download", () => { downloads++; });
  const sheet = await openPreview(page);
  await cabe(page, sheet);
  await expect(sheet.getByRole("button", { name: "Guardar" })).toBeVisible();
  await sheet.getByRole("button", { name: "Cerrar" }).click();
  await expect(sheet).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(downloads, "cerrar la vista previa no descarga").toBe(0);
});

test("navegador: Guardar descarga el PNG con su nombre", async ({ page }) => {
  await boot(page);
  const sheet = await openPreview(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Guardar" }).click()]);
  expect(dl.suggestedFilename()).toBe("aely-informe-2026-11.png");
  await expect(page.locator(".toast")).toContainText("Informe guardado en Descargas");
});

test("APK 65+: Guardar manda el PNG al nativo (Descargas + aviso que lo abre); sin Compartir", async ({ page }) => {
  await boot(page);
  // El doble va DESPUÉS de arrancar: natPlugin() se lee al pulsar, y así el resto de la app no
  // cree que vive en Android.
  await page.evaluate(() => {
    window.__saved = [];
    window.Capacitor = { Plugins: { MiCartera: {
      ensureNotifPerm: () => Promise.resolve(),
      saveToDownloads: (o) => { window.__saved.push(o); return Promise.resolve({ ok: true, uri: "content://media/external/downloads/1", name: o.name, inDownloads: true }); },
    } } };
  });
  const sheet = await openPreview(page);
  await expect(sheet.getByRole("button", { name: "Compartir" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__saved.length), "nada se guarda sin pulsar Guardar").toBe(0);
  await sheet.getByRole("button", { name: "Guardar" }).click();
  await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(1);
  const o = await page.evaluate(() => { const x = window.__saved[0]; return { ...x, data: x.data.slice(0, 22), len: x.data.length }; });
  expect(o).toMatchObject({ name: "aely-informe-2026-11.png", mime: "image/png", data: "data:image/png;base64,", title: "Informe guardado en Descargas" });
  expect(o.body, "el nativo pone el nombre real del fichero").toContain("{f}");
  expect(o.len).toBeGreaterThan(5000);
  await expect(page.locator(".toast")).toContainText("Informe guardado en Descargas");
});

test("APK antigua (sin saveToDownloads): lo dice en vez de fingir que ha guardado", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { window.__notif = []; window.Capacitor = { Plugins: { MiCartera: { showNotification: (o) => { window.__notif.push(o); return Promise.resolve(); } } } }; });
  let downloads = 0;
  page.on("download", () => { downloads++; });
  const sheet = await openPreview(page);
  await sheet.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator(".toast")).toContainText("actualiza la app");
  await page.waitForTimeout(300);
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => window.__notif.length), "sin aviso de «guardado» falso").toBe(0);
});
