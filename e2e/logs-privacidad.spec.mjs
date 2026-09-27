import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Transporte Supabase simulado: se abre Actividad real, sin cuentas/logs de ninguna persona.
test("Actividad pinta diagnósticos útiles sin correo ni marcadores del transporte",async({page})=>{
  await seedLoggedInDashboard(page,{__cloudRows:{profiles:[{is_admin:true}]}});
  await page.addInitScript(()=>{
    window.__sec03Rows=[];
    const original=Object.getOwnPropertyDescriptor(window,"supabase");
    Object.defineProperty(window,"supabase",{configurable:true,get:original.get,set(lib){
      original.set(lib);const sb=original.get();if(!sb)return;
      const create=sb.createClient;sb.createClient=function(){
        const db=create();const from=db.from,session=db.auth.getSession;
        db.auth.getSession=async function(){const out=await session();out.data.session.user.email="sec03@example.invalid";return out;};
        db.from=function(table){const chain=from(table);if(table==="app_events"){
          chain.insert=async row=>{window.__sec03Rows.push({...row,created_at:"2026-09-27T12:00:00Z"});return {error:null};};
          chain.then=resolve=>resolve({data:window.__sec03Rows,error:null});
        }return chain;};return db;
      };
    }});
  });
  await page.route("https://**",route=>route.abort());
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await page.evaluate(async()=>{
    await cloud.logEvent("error","addExpense apuntar: ES9121000418450200051332 9876.54 SEC03_NOTA_BANCARIA","23505 token=sec03_secret_credential");
    await cloud.feedback("No abre Plan; correo sec03@example.invalid; token=sec03_secret_credential");
  });
  await page.locator(".v4-avatar").click();await page.getByRole("button",{name:/Ir a Ajustes|Go to Settings|Ves a Ajustos/i}).click();
  await page.getByText("Quién usa la app y sus errores",{exact:true}).click();
  const activity=page.getByText("👁 Actividad",{exact:true}).last().locator("..");
  await expect(activity).toContainText("addExpense");await expect(activity).toContainText("23505");await expect(activity).toContainText("No abre Plan");
  for(const marker of ["sec03@example.invalid","ES9121000418450200051332","9876.54","SEC03_NOTA_BANCARIA","sec03_secret_credential"])await expect(activity).not.toContainText(marker);
  const rows=await page.evaluate(()=>window.__sec03Rows);expect(rows.length).toBeGreaterThanOrEqual(2);expect(rows.every(row=>row.email===null)).toBe(true);
});
