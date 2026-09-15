import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const cases = [
  ["sin servicio", {ok:true,category:"otros",ai:false}, /No se pudo consultar/, false],
  ["límite temporal", {ok:true,category:"otros",ai:"limit"}, /límite temporal/, false],
  ["error remoto", {ok:true,category:"otros",ai:"error"}, /No se pudo consultar/, false],
  ["sin contexto suficiente", {ok:true,category:"otros",reason:"uncertain"}, /No hay sugerencia clara/, false],
  ["reglas inaccesibles", {ok:true,category:"bares",rulesUnavailable:true}, /categorías guardadas/, false],
  ["Otros elegido por el usuario", {ok:true,category:"otros",source:"personal"}, /Tienes guardado «Otros»/, false],
  ["regla personal", {ok:true,category:"bares",source:"personal"}, /Categoría: Bares y restaurantes/, true],
];

for (const [name, data, message, changes] of cases) {
  test("Sugerir categoría distingue " + name + " y conserva el gasto", async ({ page }) => {
    await seedLoggedInDashboard(page, {
      expenses:[{id:"synthetic",date:new Date().toISOString(),amount:12,merchant:"QZXV",category:"compras",source:"manual",ent:"sabadell"}],
      settings:{autoPrices:false,theme:"green",aiCat:true},
      __cloudFns:{categorize:{data,error:null}},
    });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible();
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await page.locator("button.v4-mov").filter({hasText:"QZXV"}).click();
    const sheet=page.locator(".v4-exp-sheet");
    await sheet.getByRole("button",{name:/Sugerir categoría/}).click();
    await expect(page.locator(".toast")).toContainText(message);
    await expect(sheet.locator(".v4-chip.on").filter({hasText:changes?"Bares y restaurantes":"Compras"})).toHaveCount(1);
    await expect(sheet.locator(".v4-exp-amt")).toHaveValue("12");
  });
}
