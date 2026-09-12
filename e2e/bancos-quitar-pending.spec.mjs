import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* QUITAR UN BANCO PENDIENTE LIMPIA bankIssues (rechazo 4.19.66 + 12/9).
 *
 * La zona de bancos desaparecía bien (loadLinks tras disconnect), pero `state.bankIssues` solo
 * se reescribe al sincronizar → Cartera seguía con «pendiente de conectar», y el «✓ al día»
 * no volvía nunca (issues.length>0). El banner de Cartera lee `state.bankIssues`: si el array
 * queda a 0 tras quitar, el aviso se ha ido. */

async function appLista(page, overrides = {}) {
  await page.addInitScript(() => {
    try { localStorage.removeItem("_betaPanelAbierto"); localStorage.removeItem("_betaPanelScroll"); } catch (e) {}
  });
  await seedLoggedInDashboard(page, overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

test("quitar Caixa pendiente limpia bankIssues al momento", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankTx: [], /* evita bootstrap sync al abrir */
    bankIssues: [{ aspsp: "CaixaBank", ent: "caixabank", kind: "pending" }],
    accounts: [
      { id: "diario", ent: "sabadell", name: "Nómina", value: 900, role: "diario", spendFrom: true },
      { id: "cx", ent: "caixabank", name: "Caixa", value: 100, role: "fijos", bankIban: "ES00" },
    ],
    __cloudRows: {
      bank_links: [{
        aspsp_name: "CaixaBank",
        aspsp_country: "ES",
        status: "pending",
        accounts: [],
      }],
    },
  });

  await expect.poll(() => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return (s.bankIssues || []).length;
  })).toBe(1);

  await page.evaluate(() => {
    cloud.bankDisconnect = async function() {
      window.__e2eLinks = [];
      return { ok: true };
    };
    cloud.bankLinks = async function() { return window.__e2eLinks || []; };
    window.__e2eLinks = [{
      aspsp_name: "CaixaBank",
      aspsp_country: "ES",
      status: "pending",
      accounts: [],
    }];
  });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: "CaixaBank" } }));
  });
  const panel = page.locator(".v4-banks");
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(panel.locator('[data-aspsp="CaixaBank"]')).toBeVisible();
  /* focusAspsp ya abre el acordeón; un click en la fila lo cerraría. */
  const quitar = panel.getByRole("button", { name: /Quitar|Remove|Treu/i });
  if (!(await quitar.count())) {
    await panel.locator('[data-aspsp="CaixaBank"] .v4-mov').first().click();
  }
  await quitar.click();
  await panel.getByRole("button", { name: /Sí, quitar|Yes, remove|Sí, treu/i }).click();
  await page.locator(".ask-opt").first().click();

  await expect.poll(() => page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
    return (s.bankIssues || []).length;
  })).toBe(0);
});
