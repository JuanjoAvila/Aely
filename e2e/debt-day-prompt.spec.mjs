import {test,expect} from "@playwright/test";
import {seedLoggedInDashboard,dismissNews,esperaNubeQuieta} from "./fixtures.mjs";

const YM=2026*12+9;
const copy={
  es:{tab:"Deudas",edit:"Editar deuda",cancel:"Cancelar",save:"Guardar cambios",prompt:"Sin día de cobro · ponle día"},
  en:{tab:"Debts",edit:"Edit debt",cancel:"Cancel",save:"Save changes",prompt:"No payment day · set a day"},
  ca:{tab:"Deutes",edit:"Edita el deute",cancel:"Cancel·la",save:"Desa els canvis",prompt:"Sense dia de cobrament · posa-hi dia"}
};
const debt=(id,extra={})=>({id,name:"Deuda sintética "+id,value:1234.56,original:2345.67,monthly:100.01,amort:80.03,asOf:YM,account:"sabadell",unknown:{keep:7},...extra});
const rows=()=>[debt("missing"),debt("null",{day:null}),debt("zero",{day:0}),debt("dated",{day:28}),
  debt("finished",{value:0,months:1,asOf:YM-2}),debt("settled",{value:0,settledAt:"2026-10-01T10:00:00Z"}),debt("inactive",{monthly:0})];
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).debts);
const sheet=(page,lang="es")=>page.getByRole("dialog",{name:copy[lang].edit,exact:true});
const financial=page=>page.evaluate(()=>{
  const s=loadState();
  return {accounts:s.accounts,debts:s.debts,fixed:s.fixed,flows:s.flows,oneoffs:s.oneoffs,goals:s.goals,
    assets:s.assets,investments:s.investments,expenses:s.expenses,
    balances:s.debts.map(d=>Math.round(debtBalance(d)*100)),charges:planChargesMonth(s,10,2026,18)};
});
async function open(page,lang="es",entry="plan",overrides={}){
  test.info().annotations.push({type:"own-clock"});
  await page.clock.install({time:new Date("2026-10-18T12:00:00Z")});
  await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
  await seedLoggedInDashboard(page,{__seedOnce:true,debts:rows(),expenses:[],fixed:[],flows:[],oneoffs:[],goals:[],
    accounts:[{id:"fixed-a",ent:"sabadell",role:"fijos",value:5000.37},{id:"fixed-b",ent:"sabadell",role:"fijos",value:7000.19}],
    settings:{lang,autoPrices:false,theme:"green",reservaRules:[],simpleMode:false},...overrides});
  await page.goto("/");await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  await expect.poll(()=>page.locator('[data-testid="plan-due"]').evaluate(el=>Math.abs(el.closest(".page").getBoundingClientRect().left))).toBeLessThan(2);
  if(entry==="debts")await page.getByRole("tab",{name:copy[lang].tab,exact:true}).click();
}
const active=page=>page.locator('.v4-screen:visible [data-debt-day-id]:visible');
const prompt=(page,id)=>page.locator('[data-debt-day-id="'+id+'"]:visible');

for(const lang of Object.keys(copy))for(const entry of ["plan","debts"]){
  test(`${entry}/${lang}: ausencia, null y cero cancelan intactos y guardan día 1 explícito`,async({page})=>{
    await open(page,lang,entry);
    await expect(active(page)).toHaveCount(3);
    for(const id of ["dated","finished","settled","inactive"])await expect(prompt(page,id)).toHaveCount(0);
    for(const id of ["missing","null","zero"]){
      const before=await financial(page),beforeRows=await saved(page);
      const button=prompt(page,id);await expect(button).toHaveText(copy[lang].prompt);
      if(entry==="debts")await expect(page.locator('[data-debt-id="'+id+'"] .plan-debt-details')).not.toContainText(/día 1|day 1|dia 1/i);
      await expect(button).toHaveAccessibleName("Deuda sintética "+id+" · "+copy[lang].prompt);
      if(lang==="es"&&id==="missing")await page.screenshot({path:test.info().outputPath(entry+"-sin-dia.png")});
      await button.focus();await button.press("Enter");
      const dialog=sheet(page,lang),day=dialog.locator('[data-debt-field="day"]');
      await expect(day).toBeFocused();await expect(day).toHaveValue("");
      await expect(day).toBeInViewport({ratio:1});
      if(lang==="es"&&id==="missing")await page.screenshot({path:test.info().outputPath(entry+"-editor-dia.png")});
      await expect(dialog.locator('[data-debt-field="name"]')).toHaveValue("Deuda sintética "+id);
      expect(await financial(page)).toEqual(before);
      await day.fill("31");await dialog.getByRole("button",{name:copy[lang].cancel,exact:true}).click();
      await expect(dialog).toHaveCount(0);expect(await financial(page)).toEqual(before);
      await button.click();await expect(day).toBeFocused();await day.fill("1");
      expect(await financial(page)).toEqual(before);
      await dialog.getByRole("button",{name:copy[lang].save,exact:true}).click();await expect(dialog).toHaveCount(0);
      const expected=beforeRows.map(d=>d.id===id?{...d,day:1}:d);
      await expect.poll(()=>saved(page)).toEqual(expected);await expect(prompt(page,id)).toHaveCount(0);
    }
    await page.reload();await page.waitForFunction(()=>!document.getElementById("mc-load"));
    expect((await saved(page)).slice(0,3).map(d=>d.day)).toEqual([1,1,1]);
  });
}
for(const entry of ["plan","debts"])for(const day of [2,31]){
  test(`${entry}: día ${day} usa el resultado financiero existente y mantiene las otras deudas`,async({page})=>{
    await open(page,"es",entry);const before=await saved(page);
    await prompt(page,"missing").click();const dialog=sheet(page),input=dialog.locator('[data-debt-field="day"]');
    await input.fill(String(day));
    const expected=await page.evaluate(day=>{const d=loadState().debts.find(d=>d.id==="missing");return debtEditResult(d,{...debtEditDraft(d),day:String(day)});},day);
    expect(expected.error).toBeUndefined();await dialog.getByRole("button",{name:copy.es.save,exact:true}).click();await expect(dialog).toHaveCount(0);
    expect(await saved(page)).toEqual(before.map(d=>d.id==="missing"?expected.item:d));
  });
}
test("día vacío, cero y 32 no guardan; la edición normal conserva su borrador legado",async({page})=>{
  await open(page,"es","debts");const before=await financial(page);await prompt(page,"missing").click();
  const dialog=sheet(page),input=dialog.locator('[data-debt-field="day"]');
  for(const value of ["","0","32"]){await input.fill(value);await dialog.getByRole("button",{name:copy.es.save,exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();expect(await financial(page)).toEqual(before);}
  await dialog.getByRole("button",{name:copy.es.cancel,exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.locator('[data-debt-id="missing"] .plan-item-open').click();await expect(input).toHaveValue("1");
  await dialog.getByRole("button",{name:copy.es.save,exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await financial(page)).toEqual(before);
});
test("Plan sencillo abre el mismo editor y cancelar conserva cifras y estado",async({page})=>{
  await open(page,"es","plan",{settings:{lang:"es",autoPrices:false,theme:"green",reservaRules:[],simpleMode:true}});
  const before=await financial(page);await prompt(page,"missing").click();await expect(sheet(page).locator('[data-debt-field="day"]')).toBeFocused();
  await sheet(page).getByRole("button",{name:copy.es.cancel,exact:true}).click();await expect(sheet(page)).toHaveCount(0);expect(await financial(page)).toEqual(before);
});
for(const concurrent of [false,true])test(`día1 tras confirmar plazo revalida antes de normalizar, concurrencia=${concurrent}`,async({page})=>{
  const d=debt("term",{value:2000,original:2000,monthly:200,amort:200,months:10,asOf:YM-4});
  await open(page,"es","debts",{debts:[d]});await prompt(page,"term").click();const dialog=sheet(page);
  await dialog.locator('[data-debt-field="day"]').fill("1");await dialog.locator('[data-debt-field="balance"]').fill("1300,25");
  const expected=await page.evaluate(()=>{const d=loadState().debts[0];return debtEditResult(d,{...debtEditDraft(d),day:"1",balance:"1300,25"});});
  expect(expected.error).toBeUndefined();
  await dialog.getByRole("button",{name:copy.es.save,exact:true}).click();await expect(page.locator(".askback")).toBeVisible();
  expect((await saved(page))[0]).toEqual(d);
  if(concurrent){
    await page.evaluate(()=>{const el=document.querySelector('.plan-edit-sheet');let f=el[Object.keys(el).find(k=>k.startsWith("__reactFiber$"))];while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;if(!f)throw Error("Falta editor real");f.memoizedProps.set(s=>({...s,debts:s.debts.map(d=>({...d,value:2050}))}));});
    await expect.poll(async()=>(await saved(page))[0].value).toBe(2050);
  }
  await page.locator(".askback").getByRole("button",{name:copy.es.save,exact:true}).click();
  if(concurrent){await expect(dialog.getByRole("alert")).toContainText("cambió o se borró");expect((await saved(page))[0]).toEqual({...d,value:2050});}
  else{await expect(dialog).toHaveCount(0);expect((await saved(page))[0]).toEqual({...expected.item,day:1});}
});

for(const localDay of [28,null])test(`conflicto aviso sin día: conserva borrador local ${localDay===null?"sin día":"28"} al revisar`,async({page})=>{
  // La copia diaria diferida no forma parte del gesto de revisar/cancelar que se compara aquí.
  await open(page,"es","debts",{lastBackup:"2026-10-18"});
  const live=()=>page.evaluate(()=>{
    const el=document.querySelector('[data-debt-id="missing"]');let f=el[Object.keys(el).find(k=>k.startsWith("__reactFiber$"))];
    while(f?.return)f=f.return;
    // El nodo DOM puede apuntar al alternate anterior: la comparación debe leer el árbol comprometido.
    const stack=[f.stateNode.current];
    while(stack.length){const current=stack.pop();if(current.type===Debts&&!current.memoizedProps.editorOnly)return current.memoizedProps.state;
      if(current.sibling)stack.push(current.sibling);if(current.child)stack.push(current.child);}
    throw Error("Falta estado comprometido de Deudas");
  });
  await page.evaluate(localDay=>{
    const el=document.querySelector('[data-debt-id="missing"]');let f=el[Object.keys(el).find(k=>k.startsWith("__reactFiber$"))];
    while(f&&!(f.memoizedProps?.state&&f.memoizedProps?.set))f=f.return;
    if(!f)throw Error("Falta set real de Deudas");
    f.memoizedProps.set(s=>{const d=s.debts.find(d=>d.id==="missing");return {...s,_planSync:{...s._planSync,owner:s._historyOwner,
      conflicts:[{kind:"debts",id:d.id,fields:["day","name","note"],local:{...d,day:localDay,name:"Borrador local",note:"Nota local conservada"}}]}};});
  },localDay);
  await expect.poll(async()=>(await live())._planSync?.conflicts?.[0]?.local.name).toBe("Borrador local");
  await esperaNubeQuieta(page);
  const before=await live();
  const review=async()=>{
    await prompt(page,"missing").click();
    await page.getByRole("dialog").getByRole("button",{name:"Revisar mi cambio",exact:true}).click();
    const day=sheet(page).locator('[data-debt-field="day"]');
    await expect(day).toHaveValue(localDay===null?"":"28");await expect(day).toBeFocused();await expect(day).toBeInViewport({ratio:1});
    await expect(sheet(page).locator('[data-debt-field="name"]')).toHaveValue("Borrador local");
    await expect(sheet(page).locator('[data-debt-field="note"]')).toHaveValue("Nota local conservada");
    return day;
  };
  await review();expect(await live()).toEqual(before);
  await sheet(page).getByRole("button",{name:copy.es.cancel,exact:true}).click();await expect(sheet(page)).toHaveCount(0);
  expect(await live()).toEqual(before);
  if(localDay===null){
    const day=await review();await day.fill("1");expect(await live()).toEqual(before);
    await sheet(page).getByRole("button",{name:copy.es.save,exact:true}).click();await expect(sheet(page)).toHaveCount(0);
    const after=await live();expect(after.debts).toEqual(before.debts.map(d=>d.id==="missing"?{...d,day:1,name:"Borrador local",note:"Nota local conservada"}:d));
    expect(after._planSync.conflicts).toEqual([]);
  }
});
