import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// El alcance debe entenderse ANTES de pulsar: el estado de última lectura no explica
// si se consultará al banco. Criterio UX15 aprobado el 16/10/2026.
for(const caso of [
  {lang:"es",label:"Actualizar gastos",busy:"Actualizando gastos…",hint:"Trae los gastos guardados en la nube, incluidas las notificaciones. No consulta tus bancos.",cloud:/nube/,notif:/notificaciones/,banks:/no consulta (?:a )?(?:tus |los )?bancos/i},
  {lang:"en",label:"Refresh expenses",busy:"Refreshing expenses…",hint:"Fetches expenses saved in the cloud, including notifications. It does not contact your banks.",cloud:/cloud/,notif:/notifications/,banks:/does not contact your banks/i},
  {lang:"ca",label:"Actualitza les despeses",busy:"Actualitzant les despeses…",hint:"Recupera les despeses desades al núvol, incloses les notificacions. No consulta els teus bancs.",cloud:/núvol/,notif:/notificacions/,banks:/no consulta (?:els teus |els )?bancs/i},
]) test(`Gastos explica el alcance de actualizar sin consultar bancos (${caso.lang})`,async({page})=>{
  await seedLoggedInDashboard(page,{settings:{lang:caso.lang,autoPrices:false,theme:"green"},expenses:[]});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const screen=page.locator('.v4-screen').filter({has:page.locator('.gx-head')});   // Gastos v5: cabecera fija
  const action=screen.locator('.action-row');
  await expect(action).toBeVisible();
  // Una sola explicación visible debe contener origen y límite de la acción.
  const explanation=screen.getByText(caso.banks).filter({hasText:caso.cloud}).filter({hasText:caso.notif});
  await expect(explanation).toBeVisible({timeout:1500});
  await expect(explanation).toHaveText(caso.hint);
  const button=action.getByRole("button",{name:caso.label,exact:true});
  await expect(button).toHaveAccessibleDescription(caso.hint);
  await page.evaluate(()=>{
    window.__ux15Pulls=0;
    window.__ux15Invokes=(window.__e2eInvokes||[]).length;
    const pull=cloud.pullExpenses;
    cloud.pullExpenses=function(...args){
      window.__ux15Pulls++;
      return new Promise(resolve=>setTimeout(resolve,900)).then(()=>pull.apply(cloud,args));
    };
  });
  await button.click();
  const busy=action.getByRole("button",{name:caso.busy,exact:true});
  await expect(busy).toBeDisabled();
  await expect(explanation).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(explanation).toBeVisible();
  expect(await page.evaluate(()=>window.__ux15Pulls)).toBe(1);
  expect(await page.evaluate(()=>(window.__e2eInvokes||[]).slice(window.__ux15Invokes).filter(x=>x.name==="bank-sync"))).toEqual([]);
});
