import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// La fila inerte era el fallo: abrir el editor no debe escribir ni cambiar cifras.
// Sólo datos sintéticos; se ejercita la ruta Cartera que usa la familia.
const goods = [
  {id:"goods-touch-home",kind:"piso",name:"Vivienda de prueba",value:125000,note:"Nota sintética de vivienda"},
  {id:"goods-touch-car",kind:"coche",name:"Vehículo de prueba",value:7500,note:"Nota sintética de vehículo"},
];
const labels = {
  es:{edit:"Editar bienes",save:"Guardar",name:"Nombre del bien",value:"Valor en euros",cancel:"Cancelar"},
  en:{edit:"Edit assets",save:"Save",name:"Asset name",value:"Value in euros",cancel:"Cancel"},
  ca:{edit:"Edita els béns",save:"Desa",name:"Nom del bé",value:"Valor en euros",cancel:"Cancel·la"},
};
test.use({hasTouch:true});

async function dragRow(page,row){
  await row.scrollIntoViewIfNeeded();
  const box=await row.boundingBox();
  const cdp=await page.context().newCDPSession(page);
  const x=box.x+Math.min(100,box.width/2), y=box.y+box.height/2;
  try{
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    for(const dy of [-15,-35,-60]){
      await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+dy}]});
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await page.waitForTimeout(150);
  }finally{await cdp.detach();}
}

async function financialState(page){
  return page.evaluate(()=>{
    const s=mcLoadRaw(mcStateKey());
    return {assets:s.assets,accounts:s.accounts,investments:s.investments,expenses:s.expenses,
      debts:s.debts,fixed:s.fixed,flows:s.flows,oneoffs:s.oneoffs,goals:s.goals,history:s.history};
  });
}

for(const lang of ["es","en","ca"]) for(const textSize of ["normal","huge"]){
  test(`Bienes: tocar abre el editor existente sin cambiar datos (${lang}, ${textSize})`,async({page})=>{
    await page.setViewportSize({width:393,height:800});
    await seedLoggedInDashboard(page,{__seedOnce:true,assets:goods,
      settings:{autoPrices:false,lang,textSize}});
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
    const before=await financialState(page);
    await page.evaluate(()=>{
      window.__goodsStateWrites=[];
      const original=localStorage.setItem.bind(localStorage), key=mcStateKey();
      localStorage.setItem=function(k,v){
        if(k===key||k===key+EXP_SUFFIX) window.__goodsStateWrites.push(k);
        return original(k,v);
      };
    });
    const row=page.locator(".v4-mov").filter({hasText:goods[0].name}).first();
    await expect(row).toBeVisible();
    // El rojo acusa la fila inerte ya presente, no la ausencia de un selector nuevo.
    await expect(row).toHaveJSProperty("tagName","BUTTON");
    await expect(row).toHaveAttribute("type","button");
    await expect(row).toContainText(goods[0].note);
    await dragRow(page,row);
    await expect(row.locator("input.editv")).toHaveCount(0);
    expect(await financialState(page)).toEqual(before);
    expect(await page.evaluate(()=>window.__goodsStateWrites)).toEqual([]);
    if(textSize==="huge"){
      await row.focus();
      await page.keyboard.press("Enter");
    }else await row.tap();
    const sheet=page.getByRole("dialog",{name:labels[lang].edit,exact:true});
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel(labels[lang].value)).toHaveValue(String(goods[0].value));
    await expect(sheet.getByLabel(labels[lang].name)).toHaveValue(goods[0].name);
    await expect(row).toHaveJSProperty("tagName","BUTTON");
    await expect(row.locator("input")).toHaveCount(0);
    await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
    expect(await financialState(page)).toEqual(before);
    expect(await page.evaluate(()=>window.__goodsStateWrites)).toEqual([]);
    const save=sheet.getByRole("button",{name:labels[lang].save,exact:true});
    await expect(save).toHaveCount(1);
    await save.click();
    await expect(row).toHaveJSProperty("tagName","BUTTON");
    await expect(row.locator("input")).toHaveCount(0);
    // El volcado tiene debounce: pagehide comprueba lo que realmente quedará guardado.
    await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
    expect(await financialState(page)).toEqual(before);
    // Un borrador de nombre y valor también se cancela sin escribir.
    await row.tap();
    await sheet.getByLabel(labels[lang].name).fill("Borrador cancelado");
    await sheet.getByLabel(labels[lang].value).fill("99");
    await sheet.getByRole("button",{name:labels[lang].cancel,exact:true}).click();
    await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
    expect(await financialState(page)).toEqual(before);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    expect(await financialState(page)).toEqual(before);
  });
}
