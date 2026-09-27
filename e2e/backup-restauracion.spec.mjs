import { test, expect } from "@playwright/test";
import { backupCloud, backupDay, ids, expense, row, stored, client, openBackups, viewCopy, pull } from "./ops02-backup-cloud.mjs";

const financialWrites = server => server.calls.filter(q=>["expenses","app_state","state_backups"].includes(q.table)&&q.op!=="read");
const halves = page => page.evaluate(()=>[localStorage.getItem("micartera_v3"),localStorage.getItem("micartera_v3_exp")]);
async function withCopy(page,server,make,overrides={}){
  await client(page,server,overrides);
  const state=await stored(page),copy=make(state);
  server.db.state_backups=[{user_id:"e2e-user",day:backupDay,data:copy}];
  await openBackups(page);
  return {state,copy};
}

// Sustituye la caracterización del reemplazo inseguro por su contrato aprobado de solo lectura.
// El ensayo anterior permanece reproducible en bc2fa093; no se omiten estos guardianes.
test("ver/cerrar no cambia mitades, decisiones, lápidas ni cloud; B conserva su cartera",async({page,browser})=>{
  const server=backupCloud();server.db.expenses=[row(expense(0)),row(expense(2))];
  const {copy}=await withCopy(page,server,s=>({...s,budget:333,deleted:["OPS02 lápida antigua"],
    expenses:[expense(0,{amount:11,note:"nota de copia",possibleDup:true,possibleDupOf:ids[1]}),expense(1)]}));
  const before=await halves(page),remote=JSON.stringify(server.db),writes=financialWrites(server).length;
  await page.evaluate(()=>{window.__ops02Persist=[];const orig=localStorage.setItem.bind(localStorage);
    localStorage.setItem=function(k,v){if(k==="micartera_v3"||k==="micartera_v3_exp")window.__ops02Persist.push(k);orig(k,v);};});
  await viewCopy(page);
  const preview=page.locator(".bk-preview");
  await expect(preview).toContainText("Solo lectura");
  await expect(preview.locator(".chip.active")).toContainText("Campos distintos");
  await expect(preview.getByRole("button",{name:/Campos distintos · 1/})).toBeVisible();
  await expect(preview.getByRole("button",{name:/Solo en la copia · 1/})).toBeVisible();
  await expect(preview.getByRole("button",{name:/Solo en la cartera · 1/})).toBeVisible();
  await preview.locator(".bk-expense button").click();
  await expect(preview.locator(".bk-expense-fields")).toContainText("nota de copia");
  await expect(preview.locator(".bk-expense-fields")).toContainText("Posible repetido");
  await expect(preview.locator(".bk-state-field").filter({hasText:"Borrados recordados"})).toHaveCount(1);
  await preview.locator(".bk-close").click();
  await page.waitForTimeout(1600);
  expect(await halves(page)).toEqual(before);
  expect(await page.evaluate(()=>window.__ops02Persist)).toEqual([]);
  expect(JSON.stringify(server.db)).toBe(remote);expect(financialWrites(server).length).toBe(writes);
  const context=await browser.newContext(),b=await context.newPage();
  await client(b,server,{__ops02FreshLogin:true});
  const second=await stored(b);expect(second.budget).not.toBe(copy.budget);
  expect(second.expenses.map(e=>e.id).sort()).toEqual([ids[0],ids[2]].sort());
  await context.close();
});

test("igual suma no oculta UUID diferentes; legado no se empareja por parecido",async({page})=>{
  const server=backupCloud();server.db.expenses=[row(expense(0))];
  await withCopy(page,server,s=>({...s,expenses:[expense(1,{amount:10}),expense(0,{id:"legado",amount:0})]}));
  await viewCopy(page);const preview=page.locator(".bk-preview");
  await expect(preview.getByRole("button",{name:/Iguales · 0/})).toBeVisible();
  await expect(preview.getByRole("button",{name:/Sin correspondencia segura · 1/})).toBeVisible();
  await expect(preview.locator(".bk-counts")).toContainText("10 en la copia · 10 en la cartera");
  await preview.getByRole("button",{name:/Solo en la copia/}).click();
  await expect(preview.locator(".chip.active")).toContainText("Solo en la copia");
  await expect(preview.locator(".bk-expense")).toContainText(ids[1]);
  await preview.getByRole("button",{name:/Sin correspondencia segura/}).click();
  await expect(preview.locator(".bk-expense")).toContainText("legado");
});

test("metadatos antiguos y ausencia de ID se inspeccionan crudos sin inventar identidad",async({page})=>{
  const server=backupCloud();await withCopy(page,server,s=>({...s,expenses:[
    {date:"20/09/2026",amount:0.1,merchant:7,possibleDup:"false",note:{old:true}},
    expense(0,{id:42,date:Date.parse("2026-09-20T12:00:00Z"),amount:0.2,noCard:1,category:8})]}));
  const before=await halves(page),writes=financialWrites(server).length;
  await viewCopy(page);const preview=page.locator(".bk-preview");
  await expect(preview.locator(".bk-counts")).toContainText("0,3 en la copia");
  await expect(preview.locator(".bk-counts")).not.toContainText("000000000");
  await preview.getByRole("button",{name:/Sin correspondencia segura/}).click();
  await expect(preview.locator(".bk-expense")).toHaveCount(2);
  await preview.getByRole("button",{name:/Sin nombre guardado/}).click();
  await expect(preview.locator(".bk-expense-fields")).toContainText('"false"');
  await expect(preview.locator(".bk-expense-fields")).toContainText('"old":true');
  await expect(preview.locator(".bk-expense-fields")).toContainText('"20/09/2026"');
  await expect(preview.locator(".bk-expense").first()).toContainText("Identificador: —");
  await preview.locator(".bk-close").click();
  expect(await halves(page)).toEqual(before);expect(financialWrites(server).length).toBe(writes);
});

test("pull con visor abierto actualiza solo cartera; copia estable, sin backfill desde la copia",async({page})=>{
  const server=backupCloud();server.db.expenses=[row(expense(0))];
  await withCopy(page,server,s=>({...s,expenses:[expense(1)]}));
  await viewCopy(page);
  server.db.expenses.push(row(expense(2)));
  await pull(page,server);
  expect((await stored(page)).expenses.map(e=>e.id).sort()).toEqual([ids[0],ids[2]].sort());
  await expect(page.locator(".bk-counts")).toContainText("1 en la copia · 2 en la cartera");
  expect(server.db.expenses.map(e=>e.id)).not.toContain(ids[1]);
  expect(server.calls.some(q=>q.table==="expenses"&&q.op!=="read")).toBe(false);
  await page.locator(".bk-close").click();await page.reload();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await expect(page.locator(".bk-preview")).toHaveCount(0);
  expect((await stored(page)).expenses.map(e=>e.id)).not.toContain(ids[1]);
});

for(const [name,damage,reason] of [
  ["expenses corruptos",s=>({...s,expenses:"corrupta"}),"listas de datos"],
  ["UUID repetidos",s=>({...s,expenses:[expense(0),expense(0)]}),"identificadores repetidos"],
  ["importe inválido",s=>({...s,expenses:[expense(0,{amount:"10"})]}),"importes inválidos"],
])test("rechaza "+name+" antes de escribir",async({page})=>{
  const server=backupCloud();await withCopy(page,server,damage);
  const before=await halves(page),writes=financialWrites(server).length;
  await page.getByRole("button",{name:"Ver copia",exact:true}).click();
  await expect(page.getByText(new RegExp(reason))).toBeVisible();
  await expect(page.locator(".bk-preview")).toHaveCount(0);
  expect(await halves(page)).toEqual(before);expect(financialWrites(server).length).toBe(writes);
});

test("offline al descargar conserva estado y permite reintento; copia abierta sigue visible sin red",async({page})=>{
  const server=backupCloud();await withCopy(page,server,s=>({...s,expenses:[expense(1)]}));
  const before=await halves(page);
  server.setOffline(true);await page.getByRole("button",{name:"Ver copia",exact:true}).click();
  await expect(page.getByText(/OPS02 sin red sintética/)).toBeVisible();expect(await halves(page)).toEqual(before);
  server.setOffline(false);await viewCopy(page);server.setOffline(true);
  await page.locator(".bk-preview").getByRole("button",{name:/Solo en la copia/}).click();
  await expect(page.locator(".bk-expense")).toContainText(ids[1]);
  await page.locator(".bk-close").click();expect(await halves(page)).toEqual(before);
});

test("cerrar antes de terminar descarga ignora su resultado",async({page})=>{
  const server=backupCloud();await withCopy(page,server,s=>s);
  const before=await halves(page),query=server.query;
  let release;server.query=q=>q.table==="state_backups"&&q.single?
    new Promise(resolve=>{release=()=>query(q).then(resolve);}):query(q);
  await page.getByRole("button",{name:"Ver copia",exact:true}).click();
  await expect.poll(()=>!!release).toBe(true);
  await page.getByRole("button",{name:"‹ Ajustes",exact:true}).click();await release();
  await expect(page.locator(".bk-preview")).toHaveCount(0);expect(await halves(page)).toEqual(before);
});

for(const [lg,title] of [["en","Read only"],["ca","Només lectura"]])test("visor traducido "+lg,async({page})=>{
  const server=backupCloud();await withCopy(page,server,s=>s,{settings:{autoPrices:false,theme:"green",lang:lg}});
  await viewCopy(page);await expect(page.locator(".bk-preview")).toContainText(title);
  await expect(page.locator(".bk-preview")).not.toContainText("bk_");
});
