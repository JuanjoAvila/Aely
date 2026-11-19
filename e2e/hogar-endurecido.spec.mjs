/* HOGAR ENDURECIDO (SEG-10, ronda F, 19/11/2026).
 *
 * El dueño regenera el código (un código viejo de 6 sale destacado) y puede quitar a un miembro;
 * quien no es dueño no ve ninguna de las dos cosas. Unirse prueba primero `join_household` (0028) y,
 * si la BD aún no la tiene, la RPC de antes. Todo contra la pantalla real del Hogar con la nube
 * simulada de `fixtures.mjs`. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const ME = "e2e-user", OTRO = "u-pareja", HID = "h-e2e";
const hogar = (extra = {}) => Object.assign({ id: HID, name: "Casa", invite_code: "ABC123", created_by: ME }, extra);
const filas = (rolMio = "owner", extra = {}) => ({
  // La fila propia primero: el doble de la nube no filtra las lecturas simples.
  household_members: [
    { household_id: HID, user_id: ME, role: rolMio },
    { household_id: HID, user_id: OTRO, role: rolMio === "owner" ? "member" : "owner" },
  ],
  households: [hogar(extra)],
  household_snapshots: [
    { household_id: HID, user_id: OTRO, published_at: "2026-11-18T10:00:00Z", payload: { displayName: "Pareja", netWorth: 1000, accounts: [], fixedTop: [] } },
  ],
});

async function abrirHogar(page, overrides) {
  await seedLoggedInDashboard(page, Object.assign({ __seedOnce: true }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-shared")));
}

test("dueño con código viejo: regenera y quita a un miembro", async ({ page }) => {
  await abrirHogar(page, { __cloudRows: filas("owner") });
  const card = page.locator("[data-hogar]");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.locator("[data-hogar-flojo]")).toBeVisible();
  await card.locator('[data-act="hh-regen"]').click();
  await page.locator(".ask-btns .btn-primary").last().click();
  await expect(card.locator("[data-hogar-flojo]")).toHaveCount(0);
  const code = await page.evaluate(() => window.__e2eCloudRows.households[0].invite_code);
  expect(code).toMatch(/^[A-Z2-9]{10}$/);
  await expect(card.locator("[data-hogar-code]")).toContainText(code);
  const upd = await page.evaluate(() => (window.__e2eUpdates || []).filter((u) => u.tabla === "households").map((u) => Object.keys(u.value).sort()));
  expect(upd[0]).toEqual(["invite_code", "invite_expires_at"]);

  const fila = card.locator(`[data-hogar-miembro="${OTRO}"]`);
  await expect(fila).toContainText("Pareja");
  await expect(card.locator(`[data-hogar-miembro="${ME}"]`)).toHaveCount(0);
  await fila.getByRole("button", { name: "Quitar" }).click();
  await page.locator(".ask-btns .btn-primary, .ask-btns .btn-danger").last().click();
  await expect.poll(() => page.evaluate((o) => window.__e2eCloudRows.household_members.some((m) => m.user_id === o), OTRO)).toBe(false);
  await expect(card.locator(`[data-hogar-miembro="${OTRO}"]`)).toHaveCount(0);
});

test("quien no es dueño no ve regenerar ni quitar", async ({ page }) => {
  await abrirHogar(page, { __cloudRows: filas("member", { created_by: OTRO }) });
  const card = page.locator("[data-hogar]");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.locator('[data-act="hh-regen"]')).toHaveCount(0);
  await expect(card.locator("[data-hogar-miembros]")).toHaveCount(0);
});

test("unirse sin la 0028 cae a la RPC de antes", async ({ page }) => {
  await abrirHogar(page, { __cloudRows: { household_members: [], households: [], household_snapshots: [] },
    __cloudRpc: { join_household_by_code: { data: HID, error: null } } });
  await page.getByRole("button", { name: "Unirme con código" }).click();
  await page.getByPlaceholder("Código de invitación").fill("abcdefghjk");
  await page.getByRole("button", { name: "Unirme", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window.__e2eRpcCalls || []).map((c) => c.name))).toEqual(["join_household", "join_household_by_code"]);
  await expect(page.locator(".toast")).toContainText("Te has unido");
});
