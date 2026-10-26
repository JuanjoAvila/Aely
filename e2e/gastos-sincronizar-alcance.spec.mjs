import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosRoot, gastosAbreFiltros } from "./fixtures.mjs";

/* UX-15 + Gastos v5, tanda 5 (decisión del dueño, 20/10/2026): «Actualizar gastos» SE QUITA de
   Gastos. Lo que hacía (releer de la nube los gastos, también los de las notificaciones, sin
   preguntar a los bancos) lo hace la app sola al abrirla y al volver a ella. Lo que no se puede
   perder: saber de cuándo son los gastos y que eso no consulta al banco — ahora al pie de Filtros,
   en una sola explicación con origen y límite (criterio UX15 del 16/10). */
for(const caso of [
  {lang:"es",viejo:"Actualizar gastos",hint:"Los gastos guardados en la nube, también los de las notificaciones, se traen solos al abrir la app y al volver a ella. No consulta tus bancos.",cloud:/nube/,notif:/notificaciones/,banks:/no consulta tus bancos/i},
  {lang:"en",viejo:"Refresh expenses",hint:"Expenses saved in the cloud, including notifications, come in on their own when you open the app and when you come back to it. It does not contact your banks.",cloud:/cloud/,notif:/notifications/,banks:/does not contact your banks/i},
  {lang:"ca",viejo:"Actualitza les despeses",hint:"Les despeses desades al núvol, també les de les notificacions, arriben soles en obrir l'app i en tornar-hi. No consulta els teus bancs.",cloud:/núvol/,notif:/notificacions/,banks:/no consulta els teus bancs/i},
]) test(`sin botón: volver a la app relee la nube sin consultar bancos y Filtros dice de cuándo son (${caso.lang})`,async({page})=>{
  await seedLoggedInDashboard(page,{settings:{lang:caso.lang,autoPrices:false,theme:"green"},expenses:[]});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(gastosRoot(page)).toBeVisible();
  // El botón ya no está en ninguna parte de Gastos (ni en el pie ni en la cabecera).
  await expect(gastosRoot(page).getByRole("button",{name:caso.viejo})).toHaveCount(0);
  await expect(gastosRoot(page).locator(".sync-note")).toHaveCount(0);
  await page.waitForFunction(()=>_mcLecturaNube>0);

  // Volver a la app es la puerta: UNA lectura de la nube y NINGUNA llamada a los bancos (AGENTS §7).
  await page.evaluate(()=>{
    window.__ux15Pulls=0;
    window.__ux15Invokes=(window.__e2eInvokes||[]).length;
    window.__ux15Antes=_mcLecturaNube;
    const pull=cloud.pullExpenses;
    cloud.pullExpenses=function(...args){ window.__ux15Pulls++; return pull.apply(cloud,args); };
    let vis="hidden";
    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>vis});
    document.dispatchEvent(new Event("visibilitychange"));
    vis="visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(()=>_mcLecturaNube>window.__ux15Antes);
  expect(await page.evaluate(()=>window.__ux15Pulls)).toBe(1);
  expect(await page.evaluate(()=>(window.__e2eInvokes||[]).slice(window.__ux15Invokes).filter(x=>x.name==="bank-sync"))).toEqual([]);

  // Al pie de Filtros: la hora de la lectura y una sola explicación con origen y límite.
  await gastosAbreFiltros(page);
  const hoja=page.locator(".v4-gastos-filter-sheet");
  await expect(hoja.getByTestId("gastos-lectura")).toContainText(/\d{2}:\d{2}/);
  const explicacion=hoja.getByText(caso.banks).filter({hasText:caso.cloud}).filter({hasText:caso.notif});
  await expect(explicacion).toHaveText(caso.hint);
  // Va debajo del botón «Ver N»: es información, no una acción más de la hoja.
  // Las dos cajas en el mismo instante: por separado, con la hoja aún subiendo, la CI cargada las medía en fotogramas distintos.
  const cajas=await page.evaluate(()=>{const h=document.querySelector(".v4-gastos-filter-sheet");const v=h.querySelector(".gx-fil-ver").getBoundingClientRect(),l=h.querySelector("[data-testid=gastos-lectura]").getBoundingClientRect();return {verFin:v.y+v.height,lectura:l.y};});
  expect(cajas.lectura).toBeGreaterThan(cajas.verFin-1);
});
