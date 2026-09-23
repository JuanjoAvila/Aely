/* EDITAR PRESUPUESTO MENSUAL (feedback 18/9, punto 8).
 *
 * La prueba entra por la tarjeta real de Inicio: el editor debe usar una cifra más contenida y
 * conservarse montado mientras sale. Guardar sigue cambiando solo `budget`; movimiento reducido
 * no obliga a esperar una animación que el usuario ha pedido quitar. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function abrir(page, reduced){
  if(reduced) await page.emulateMedia({ reducedMotion:"reduce" });
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:500,expenses:[],accounts:[]});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(() => !document.getElementById("mc-load"),null,{timeout:30_000});
  await dismissNews(page);
  const ajustes=page.locator(".settings-push.open").filter({has:page.getByRole("heading",{name:/Ajustes|Settings|Ajustos/i})});
  if(await ajustes.count()) await ajustes.locator(".settings-push-h .back").click();
  await page.locator(".v4-budget").click();
  const sheet=page.locator(".v4-budget-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

test("el presupuesto entra más pausado, con cifra compacta, y sale antes de desmontarse",async({page})=>{
  const sheet=await abrir(page,false);
  const medidas=await sheet.evaluate(function(el){
    const amount=el.querySelector(".v4-ob-stepper .serif");
    return {anim:parseFloat(getComputedStyle(el).animationDuration)*1000,font:parseFloat(getComputedStyle(amount).fontSize)};
  });
  expect(medidas.anim).toBeGreaterThanOrEqual(400);
  expect(medidas.font).toBeLessThanOrEqual(42);
  await page.waitForTimeout(450);
  await sheet.getByRole("button",{name:"+",exact:true}).click();
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(1);
  await expect(sheet).toHaveCSS("transform",/matrix|translate3d/);
  await page.waitForTimeout(120);
  await expect(sheet).toHaveCount(1);
  await expect(sheet).toHaveCount(0,{timeout:1_000});
  await expect.poll(async()=>page.evaluate(function(){
    const key=localStorage.getItem("_mcSandbox")==="1"?"micartera_sandbox":"micartera_v3";
    return JSON.parse(localStorage.getItem(key)).budget;
  })).toBe(550);
});

test("movimiento reducido cierra sin espera",async({page})=>{
  const sheet=await abrir(page,true);
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(0);
});
