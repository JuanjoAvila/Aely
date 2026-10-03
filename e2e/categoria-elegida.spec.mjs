import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* LA CATEGORÍA ELEGIDA NO SE DESHACE (INC-0210-02, 2026-10-02).
   El contrato de lógica vive en `tests/categoria-manual-persistente.test.mjs`. Esto abre Gastos de
   verdad porque el fallo se veía en la fila: corregida a Restaurantes y, tras el siguiente pull,
   otra vez en Recibos. Se ejecuta el `cloud.setExpenseCat` real contra un doble de la tabla que
   puede responder cero filas, que es como falla un UPDATE por id que no casa. Datos ficticios. */

const A="550e8400-e29b-41d4-a716-446655440001", B="550e8400-e29b-41d4-a716-446655440002",
  C="550e8400-e29b-41d4-a716-446655440003", D="550e8400-e29b-41d4-a716-446655440004", E="550e8400-e29b-41d4-a716-446655440005";
const COMEDOR="Comedor Allianz Plaza", SEGURO="Allianz Seguros";
const fecha=new Date().toISOString();
const nube=(id,comercio,importe,cat,banco)=>({id,fecha,comercio,importe,cat,source:"ob:"+(banco||"caixabank")});

async function entrar(page){
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
}
async function abrir(page,lang){
  await seedLoggedInDashboard(page,{__seedOnce:true,
    expenses:[{id:A,date:fecha,merchant:COMEDOR,amount:11.5,category:"recibos",source:"ob",ent:"caixabank"}],
    __cloudRows:{expenses:[nube(A,COMEDOR,11.5,"recibos")]},
    accounts:[{id:"caixa",ent:"caixabank",name:"Cuenta ficticia",value:920,bankIban:"fixture",role:"diario"},
      {id:"saba",ent:"sabadell",name:"Otra cuenta ficticia",value:500,bankIban:"fixture2",role:"diario"}],
    settings:{lang,autoPrices:false,expenseBanks:["caixabank","sabadell"],budgetCycle:false}});
  // La tabla sobrevive al reinicio y sus UPDATE filtran por id de verdad.
  await page.addInitScript(()=>{
    const guardadas=JSON.parse(localStorage.getItem("_catFixtureRows")||"null");
    if(guardadas) window.__e2eCloudRows.expenses=guardadas;
    window.__catFixture={mode:localStorage.getItem("_catFixtureMode")||"zero",calls:[],
      save(){ localStorage.setItem("_catFixtureRows",JSON.stringify(window.__e2eCloudRows.expenses)); localStorage.setItem("_catFixtureMode",this.mode); }};
    const desc=Object.getOwnPropertyDescriptor(window,"supabase");
    Object.defineProperty(window,"supabase",{configurable:true,set:desc.set,get(){
      const lib=desc.get(); if(!lib) return lib;
      return {createClient(){ const base=lib.createClient();
        return Object.assign({},base,{from(table){
          const chain=base.from(table);
          if(table!=="expenses") return chain;
          chain.update=function(patch){
            const filtros={}, fixture=window.__catFixture;
            const q={eq(k,v){ filtros[k]=v; return q; },select(){ return q; },
              then(resolve){
                if(!("cat" in patch)) return resolve({data:[],error:null});
                fixture.calls.push(filtros.id+"→"+patch.cat);
                if(fixture.mode==="error") return resolve({data:null,error:{message:"synthetic 503"}});
                const hit=fixture.mode==="zero"?[]:window.__e2eCloudRows.expenses.filter(r=>r.id===filtros.id);
                hit.forEach(r=>Object.assign(r,patch)); fixture.save();
                resolve({data:hit.map(r=>({id:r.id})),error:null});
              }};
            return q;
          };
          return chain;
        }});
      }};
    }});
  });
  await entrar(page);
}
const volver=async page=>{ await page.waitForTimeout(30); await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange"))); };
const modo=(page,mode)=>page.evaluate(mode=>{ window.__catFixture.mode=mode; window.__catFixture.calls=[]; window.__catFixture.save(); },mode);
const llamadas=page=>page.evaluate(()=>window.__catFixture.calls.slice());
const enNube=(page,id)=>page.evaluate(id=>window.__e2eCloudRows.expenses.find(r=>r.id===id).cat,id);
const cats=loc=>loc.locator(".nm-cat").evaluateAll(els=>els.map(el=>el.textContent.trim()).sort());

for(const lang of ["es","en","ca"]){
  test(`la categoría elegida sobrevive al pull y al reinicio, la heredan los pagos equivalentes y otro móvil puede cambiarla (${lang})`,async({page})=>{
    await abrir(page,lang);
    const nombre=await page.evaluate(()=>({bares:catName("bares"),recibos:catName("recibos")}));
    const comedor=page.locator("button.v4-mov").filter({hasText:COMEDOR});
    const seguro=page.locator("button.v4-mov").filter({hasText:SEGURO});
    await expect(comedor).toHaveCount(1);
    await expect(comedor.locator(".nm-cat")).toHaveText(nombre.recibos);

    // Corrección a mano desde la ficha; la tabla responde «cero filas», sin error.
    await comedor.click();
    const directa=page.getByTestId("exp-cat-bares");
    if(await directa.count()) await directa.click();
    else{
      await page.getByTestId("exp-cat").locator("xpath=preceding-sibling::div[1]/button").click();
      await page.getByTestId("expense-all-cat-bares").click();
    }
    await page.locator(".v4-sheet-back").first().click({position:{x:5,y:5}});
    await expect(comedor.locator(".nm-cat")).toHaveText(nombre.bares);
    await expect.poll(()=>llamadas(page)).toContain(A+"→bares");
    expect(await enNube(page,A)).toBe("recibos");

    // Pull con la tabla sin actualizar, también con error: no vuelve a Recibos y se reintenta.
    await modo(page,"error");
    await volver(page);
    await expect.poll(()=>llamadas(page)).toContain(A+"→bares");
    await expect(comedor.locator(".nm-cat")).toHaveText(nombre.bares);

    // La tabla ya escribe. Llegan un pago equivalente, el mismo nombre en otro banco y un seguro.
    // E: mismo comercio, banco y tarjeta, pero con la fecha del gasto corregido, ANTERIOR a
    // haberlo enseñado: no se recategoriza aunque el móvil lo vea ahora por primera vez.
    await page.waitForTimeout(30);
    await page.evaluate(({rows,viejo})=>{ const ahora=new Date().toISOString();
      rows.forEach(r=>window.__e2eCloudRows.expenses.push(Object.assign({},r,{fecha:ahora}))); window.__e2eCloudRows.expenses.push(viejo); },
      {rows:[nube(B,COMEDOR,12.75,"recibos"),nube(D,COMEDOR,30,"recibos","sabadell"),nube(C,SEGURO,48,"recibos")],viejo:nube(E,COMEDOR,9.25,"recibos")});
    await modo(page,"ok");
    await volver(page);
    await expect(comedor).toHaveCount(4);
    await expect.poll(()=>cats(comedor)).toEqual([nombre.bares,nombre.bares,nombre.recibos,nombre.recibos].sort());
    await expect(seguro.locator(".nm-cat")).toHaveText(nombre.recibos);
    // Un segundo pull puede colarse antes de la confirmación: importa QUÉ se sube, no cuántas veces.
    await expect.poll(()=>llamadas(page).then(c=>[...new Set(c)].sort())).toEqual([A+"→bares",B+"→bares"]);
    expect([await enNube(page,A),await enNube(page,B),await enNube(page,D),await enNube(page,C),await enNube(page,E)]).toEqual(["bares","bares","recibos","recibos","recibos"]);

    // Reinicio: nada cambia y no queda nada por subir.
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(comedor).toHaveCount(4);
    await volver(page);
    await expect.poll(()=>cats(comedor)).toEqual([nombre.bares,nombre.bares,nombre.recibos,nombre.recibos].sort());
    await expect(seguro.locator(".nm-cat")).toHaveText(nombre.recibos);

    // Otro móvil devuelve el primer pago a la categoría ORIGINAL: se adopta, sin pelear.
    await modo(page,"ok");
    await page.evaluate(id=>{ window.__e2eCloudRows.expenses.find(r=>r.id===id).cat="recibos"; window.__catFixture.save(); },A);
    await volver(page);
    await expect.poll(()=>cats(comedor)).toEqual([nombre.bares,nombre.recibos,nombre.recibos,nombre.recibos].sort());
    await volver(page);
    await expect.poll(()=>cats(comedor)).toEqual([nombre.bares,nombre.recibos,nombre.recibos,nombre.recibos].sort());
    expect(await llamadas(page)).toEqual([]);
    expect(await enNube(page,A)).toBe("recibos");
  });
}
