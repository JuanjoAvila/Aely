import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* 2026-10-10. Un familiar, en producción, veía la lista de categorías de Gastos pintada
   encima de Inicio (la tarjeta vacía «Aún no hay recibos» y «Tus metas») con la pestaña
   activa todavía en Inicio. Inicio no pinta categorías: era la página de Gastos premontada,
   en el mismo recto que el host fijo, con el desglose en `visibility:visible` atravesando
   el `hidden` del padre. Sin temática el fondo opaco del host lo tapa; con temática, no.
   Esta prueba tiene que fallar si se quita la guarda de `.track.scroll-host-park`. */

const CATS = ["compras", "tasas", "bares", "agua", "super", "transporte", "luz", "ocio", "salud", "hogar"];

function gastosDelMes() {
  return CATS.map((c, i) => ({
    id: "solape-" + c,
    date: "2026-10-08",
    amount: 40 + i * 15,
    merchant: c,
    category: c,
    source: "manual",
  }));
}

test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

async function cajasVisiblesDeGastos(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const gastos = [...document.querySelectorAll(".track > .page")].find((p) => p.querySelector(".v4-periods"));
    if (!gastos) return ["sin-pagina-gastos"];
    const mal = [];
    const nodes = [gastos, ...gastos.querySelectorAll("*")];
    for (const el of nodes) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) continue;
      const nombre = el.getAttribute("data-testid") || (typeof el.className === "string" ? el.className : el.tagName);
      mal.push(String(nombre).slice(0, 60) + "@" + Math.round(r.left) + "," + Math.round(r.top));
      if (mal.length >= 6) break;
    }
    return mal;
  });
}

async function volverAInicio(page) {
  const activa = await page.locator(".botnav-tab.active").getAttribute("data-tour");
  if (activa !== "inicio") {
    await page.locator('.botnav-tab[data-tour="inicio"]').click();
  }
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "inicio");
  await expect(page.locator(".track > .page").first()).toHaveClass(/\bpage-scroll-host\b/);
}

test("Inicio activa: Gastos premontada no tiene cajas visibles, ni antes ni después de apuntar", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    budget: 200,
    accounts: [],
    fixed: [],
    debts: [],
    flows: [],
    oneoffs: [],
    obAccounts: [],
    expenses: gastosDelMes(),
    goals: [{ id: "g1", name: "Viaje", target: 1000, saved: 120, emoji: "✈️" }],
    settings: { autoPrices: false, theme: "green", season: "otono" },
  });
  await page.goto("/");
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "inicio");
  const inicio = page.locator(".page-scroll-host");
  await expect(inicio.getByText("Aún no hay recibos", { exact: true })).toBeVisible();
  await expect(inicio.getByText("Tus metas", { exact: true })).toBeVisible();
  // El desglose tiene que estar ya en el DOM (premontado). Si no está, la prueba no mira nada.
  await expect(page.locator(".track .v4-gastos-cat").first()).toBeAttached({ timeout: 20_000 });

  const antes = await cajasVisiblesDeGastos(page);
  expect(antes, "con Inicio activa, Gastos ya tenía cajas en el viewport: " + antes.join(" | ")).toEqual([]);

  const anotar = ["compras", "agua", "luz"];
  for (const cat of anotar) {
    await page.locator(".botnav-fab").click();
    const sheet = page.locator(".v4-exp-sheet");
    await expect(sheet).toBeVisible();
    await sheet.locator(".v4-ficha-cat-title button").click();
    const todas = page.locator(".v4-ficha-cat-sheet");
    await expect(todas).toBeVisible();
    await todas.locator('[data-testid="expense-all-cat-' + cat + '"]').click();
    await expect(todas).toHaveCount(0);
    const keys = sheet.locator(".v4-keys");
    await keys.getByRole("button", { name: "1", exact: true }).click();
    await keys.getByRole("button", { name: "2", exact: true }).click();
    await sheet.locator(".v4-cta").click();
    await expect(sheet).toHaveCount(0);
  }

  await volverAInicio(page);
  const despues = await cajasVisiblesDeGastos(page);
  expect(despues, "tras apuntar, Gastos seguía teniendo cajas en el viewport: " + despues.join(" | ")).toEqual([]);

  // La guarda no puede esconder el desglose cuando Gastos SÍ es la pestaña activa.
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(page.locator(".botnav-tab.active")).toHaveAttribute("data-tour", "gastos");
  await expect(page.locator(".page-scroll-host .v4-gastos-cat").first()).toBeVisible();

  await volverAInicio(page);
  const alVolver = await cajasVisiblesDeGastos(page);
  expect(alVolver, "al volver a Inicio, Gastos volvió a asomar: " + alVolver.join(" | ")).toEqual([]);
});
