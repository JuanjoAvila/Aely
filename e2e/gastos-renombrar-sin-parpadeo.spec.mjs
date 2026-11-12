import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";

/* Vídeo del 12/11/2026 (OnePlus, beta 4.26.230): al cerrar la ficha tras renombrar una
   transferencia de 1.550 €, su fila desaparecía un frame de la lista y volvía. El mismo `set`
   cambia el nombre y pone la lápida del nombre viejo; la lista leía los gastos diferidos con las
   lápidas al día, y en el render urgente la fila vieja quedaba tapada por su propia lápida.
   Se cuenta la fila en CADA frame (rAF) y en cada mutación del DOM desde el toque de «Listo». */
test("renombrar y cerrar la ficha no hace desaparecer la fila ni un frame",
  {annotation:{type:"own-clock",description:"Movimiento sintético del día de la prueba"}},
  async({page,context})=>{
    await context.route("**/*",route=>{
      const host=new URL(route.request().url()).hostname;
      return host==="127.0.0.1"||host==="localhost"?route.continue():route.abort();
    });
    const id="00000000-0000-4000-8000-0000000015a0";
    const hoy=new Date().toISOString();
    await seedLoggedInDashboard(page,{__seedOnce:true,__seenVersion:"4.26.191",
      expenses:[
        {id,date:hoy,amount:1550,merchant:"Transferencia sintética",category:"otros",source:"ob",ent:"sabadell"},
        {id:"00000000-0000-4000-8000-000000000500",date:hoy,amount:500,merchant:"Otra transferencia",category:"otros",source:"ob",ent:"sabadell"}],
      accounts:[{id:"synthetic",ent:"sabadell",name:"Cuenta sintética",value:5000,role:"diario"}],
      settings:{autoPrices:false,theme:"green",lang:"es",expenseBanks:["sabadell"],budgetCycle:false}});
    // Sin nube: el renombre local hace el mismo cambio (nombre + lápida) en un solo `set`.
    await page.addInitScript(()=>{ window.addEventListener("DOMContentLoaded",()=>{cloud.enabled=()=>false;}); });
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({timeout:15000});
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const sel='.page-scroll-host .gx-root button.v4-mov[data-expense-id="'+id+'"]';
    await expect(page.locator(sel)).toHaveCount(1);
    await page.locator(sel).click();
    const concept=page.locator(".v4-exp-sheet input.v4-ficha-concept");
    await expect(concept).toBeVisible();
    await concept.fill("Transferencia a Trade Sintética");
    await page.evaluate(sel=>{
      const w=window.__filas={ausente:0,muestras:0,on:true};
      const mira=function(){ w.muestras++; if(!document.querySelector(sel)) w.ausente++; };
      new MutationObserver(function(){ if(w.on) mira(); }).observe(document.body,{childList:true,subtree:true});
      (function frame(){ if(!w.on) return; mira(); requestAnimationFrame(frame); })();
    },sel);
    await page.locator(".v4-exp-sheet .v4-ficha-done").click();
    await expect(page.locator(".v4-exp-sheet")).toHaveCount(0);
    await expect(page.locator(sel)).toContainText("Transferencia a Trade Sintética");
    await page.waitForTimeout(400);
    const w=await page.evaluate(()=>{ window.__filas.on=false; return window.__filas; });
    expect(w.muestras).toBeGreaterThan(10);
    expect(w.ausente).toBe(0);
  });
