import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function openVersion(page, version, seenVersion, paused = false) {
  const now = new Date("2026-09-15T12:00:00Z");
  await page.clock.install({ time: now });
  if (paused) await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await seedLoggedInDashboard(page, { __seenVersion: seenVersion });
  // Se sella la respuesta que recibe el navegador, sin cambiar la app ni los ficheros generados.
  await page.route("**/", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/APP_VERSION:\s*"[^"]*"/, "APP_VERSION: " + JSON.stringify(version));
    await route.fulfill({ response, body });
  });
  await page.addInitScript(() => {
    window.__newsWasMounted = false;
    new MutationObserver(() => {
      if (document.querySelector(".wn-panel")) window.__newsWasMounted = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");
  if (paused) await expect.poll(async () => {
    await page.clock.runFor(25);
    return page.locator(".botnav").count();
  }).toBe(1);
  await expect(page.locator(".botnav")).toBeVisible();
}

for (const [version, seen] of [["dev", "dev"], ["4.23.1.7", "4.23.1"]]) {
  test("Novedades ya vistas no aparecen después del helper: " + version, async ({ page }) => {
    await openVersion(page, version, seen);
    await dismissNews(page);
    // Ejecuta los timers reales de la app: si cambia su regla y programa el popup, esto falla.
    await page.clock.runFor(2000);
    await expect(page.locator(".wn-panel")).toHaveCount(0);
    expect(await page.evaluate(() => window.__newsWasMounted)).toBe(false);
  });
}

for (const withSeedMarker of [true, false]) {
  test("Novedades tardías se esperan y se cierran" + (withSeedMarker ? "" : " sin garantía del fixture"), async ({ page }) => {
    await openVersion(page, "4.23.1.8", "4.22.0", true);
    if (!withSeedMarker) await page.evaluate(() => { delete window.__e2eNewsSeenVersion; });
    await expect(page.locator(".wn-panel")).toHaveCount(0);
    const closing = dismissNews(page);
    await page.clock.runFor(2000);
    await closing;
    expect(await page.evaluate(() => window.__newsWasMounted)).toBe(true);
    await expect(page.locator(".wn-panel")).toHaveCount(0);
  });
}
