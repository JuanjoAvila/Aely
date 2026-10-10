import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews} from "./fixtures.mjs";

const labels={
  es:{add:"Añadir bien",edit:"Editar bienes",name:"Nombre del bien",value:"Valor en euros",save:"Guardar",cancel:"Cancelar",del:"Borrar bien",car:"Vehículo"},
  en:{add:"Add asset",edit:"Edit assets",name:"Asset name",value:"Value in euros",save:"Save",cancel:"Cancel",del:"Delete asset",car:"Vehicle"},
  ca:{add:"Afegeix un bé",edit:"Edita els béns",name:"Nom del bé",value:"Valor en euros",save:"Desa",cancel:"Cancel·la",del:"Esborra el bé",car:"Vehicle"},
};
async function open(page,lang,assets=[],textSize="normal"){
  await seedLoggedInDashboard(page,{__seedOnce:true,assets,accounts:[],investments:[],debts:[],expenses:[],
    fixed:[],flows:[],oneoffs:[],obAccounts:[],settings:{lang,textSize,autoPrices:false}});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
}

test("Bienes: cero válido y edición conservan la nota y los demás bienes",async({page})=>{
  const l=labels.es;
  const assets=[{id:"cero",kind:"piso",name:"Vivienda sintética",value:100,note:"Nota conservada"},
    {id:"otro",kind:"coche",name:"Otro bien",value:50.25,note:"No editar"}];
  await open(page,"es",assets);
  await page.locator("button.v4-mov").filter({hasText:assets[0].name}).click();
  const sheet=page.getByRole("dialog",{name:l.edit,exact:true});
  await sheet.getByLabel(l.value).fill("0");
  await sheet.getByRole("button",{name:l.save,exact:true}).click();
  expect((await stored(page)).assets).toEqual([{...assets[0],value:0},assets[1]]);
  await expect.poll(async()=>Number((await page.locator(".cartera-hero-amt").textContent()).replace(/\D/g,""))).toBe(5025);
});

test("Bienes: la ficha cabe a360px con letra grande",async({page},testInfo)=>{
  await page.setViewportSize({width:360,height:640});
  await open(page,"es",[{id:"vista",kind:"piso",name:"Bien sintético",value:1250}],"huge");
  await page.locator("button.v4-mov").filter({hasText:"Bien sintético"}).click();
  const sheet=page.getByRole("dialog",{name:labels.es.edit,exact:true});
  const box=await sheet.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(360);
  await expect(sheet.getByRole("button",{name:labels.es.save,exact:true})).toBeInViewport();
  await expect(sheet.getByRole("button",{name:labels.es.del,exact:true})).toBeInViewport();
  await page.screenshot({path:testInfo.outputPath("bienes-editor.png")});
});
async function stored(page){
  return page.evaluate(()=>{window.dispatchEvent(new Event("pagehide"));const s=mcLoadRaw(mcStateKey());
    return {assets:s.assets,accounts:s.accounts,investments:s.investments,debts:s.debts,expenses:s.expenses};});
}
for(const lang of ["es","en","ca"]){
  test(`Bienes completo: alta vacía, validación, edición y borrado (${lang})`,async({page})=>{
    const l=labels[lang];
    await open(page,lang);
    const before=await stored(page);
    // La base falla aquí: no existe puerta alguna cuando se borra el último bien.
    await expect(page.getByRole("button",{name:l.add,exact:true})).toBeVisible({timeout:3000});
    await page.getByRole("button",{name:l.add,exact:true}).click();
    let sheet=page.getByRole("dialog",{name:l.add,exact:true});
    await expect(sheet.getByRole("button",{name:l.save,exact:true})).toBeDisabled();
    await sheet.getByLabel(l.name).fill("Vehículo sintético");
    for(const invalid of ["-1","12.345","12xyz","Infinity",""]){
      await sheet.getByLabel(l.value).fill(invalid);
      await expect(sheet.getByRole("button",{name:l.save,exact:true})).toBeDisabled();
      expect(await stored(page)).toEqual(before);
    }
    await sheet.getByLabel(l.value).fill("1200,25");
    await sheet.getByRole("button",{name:l.car,exact:true}).click();
    await sheet.getByRole("button",{name:l.cancel,exact:true}).click();
    expect(await stored(page)).toEqual(before);
    await page.getByRole("button",{name:l.add,exact:true}).click();
    await sheet.getByLabel(l.name).fill("Vehículo sintético");
    await sheet.getByLabel(l.value).fill("1200,25");
    await sheet.getByRole("button",{name:l.car,exact:true}).click();
    await sheet.getByRole("button",{name:l.save,exact:true}).click();
    const after=await stored(page);
    expect(after.assets).toHaveLength(1);
    expect(after.assets[0]).toMatchObject({name:"Vehículo sintético",kind:"coche",value:1200.25});
    expect({...after,assets:[]}).toEqual(before);
    await expect.poll(async()=>Number((await page.locator(".cartera-hero-amt").textContent()).replace(/\D/g,""))).toBe(120025);
    await page.reload();
    await expect(page.locator(".botnav")).toBeVisible();
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    const row=page.locator("button.v4-mov").filter({hasText:"Vehículo sintético"});
    await row.click();
    sheet=page.getByRole("dialog",{name:l.edit,exact:true});
    await sheet.getByLabel(l.name).fill("Vehículo actualizado");
    await sheet.getByLabel(l.value).fill("2100.75");
    await sheet.getByRole("button",{name:l.save,exact:true}).click();
    const edited=await stored(page);
    expect(edited.assets[0]).toMatchObject({id:after.assets[0].id,name:"Vehículo actualizado",kind:"coche",value:2100.75});
    await expect.poll(async()=>Number((await page.locator(".cartera-hero-amt").textContent()).replace(/\D/g,""))).toBe(210075);
    await page.locator("button.v4-mov").filter({hasText:"Vehículo actualizado"}).click();
    await sheet.getByRole("button",{name:l.del,exact:true}).click();
    await page.locator(".askback").getByRole("button",{name:l.cancel,exact:true}).click();
    expect(await stored(page)).toEqual(edited);
    await sheet.getByRole("button",{name:l.del,exact:true}).click();
    await page.locator(".askback").getByRole("button",{name:l.del,exact:true}).click();
    expect(await stored(page)).toEqual(before);
    await expect(page.getByRole("button",{name:l.add,exact:true})).toBeVisible();
    await expect.poll(async()=>Number((await page.locator(".cartera-hero-amt").textContent()).replace(/\D/g,""))).toBe(0);
    await page.reload();
    expect(await stored(page)).toEqual(before);
  });
}
