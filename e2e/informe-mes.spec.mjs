import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root=process.env.AELY_SOURCE_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
function source(file){
  if(!process.env.AELY_SOURCE_REF)return fs.readFileSync(path.join(root,file),"utf8");
  const r=spawnSync("git",["-C",root,"show",process.env.AELY_SOURCE_REF+":"+file],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw Error("Lectura de fuente inmutable: "+file);return r.stdout;
}
const order=JSON.parse(source("src/build-order.json"));
const js=order.map(file=>source("src/modules/"+file).replace(/\n?$/,"\n")).join("");
const parts=source("src/shell.html").split("<!--MC_APP_SCRIPT-->");
if(parts.length!==2)throw Error("Marcador único de la fuente real requerido");
const sourceHtml=parts[0]+js.trimEnd()+parts[1];
const sourceSHA=createHash("sha256").update(sourceHtml).digest("hex");

test.beforeEach(async ({page,baseURL})=>{
  console.log("informe-mes sourceHTML SHA256="+sourceSHA);
  await page.route("**/*",async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==new URL(baseURL).origin)return route.abort();
    if(route.request().isNavigationRequest()&&(url.pathname==="/"||url.pathname==="/index.html"))
      return route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:sourceHtml});
    return route.fallback();
  });
  await page.addInitScript(()=>{
    window.__reportTexts=[];window.__reportShares=[];
    const fill=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(...a){
      if(this.canvas.width===1080&&this.canvas.height===1350)window.__reportTexts.push(String(a[0]));
      return fill.apply(this,a);
    };
    Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>true});
    Object.defineProperty(navigator,"share",{configurable:true,value:async({files})=>{
      window.__reportShares.push(files.map(f=>({name:f.name,type:f.type,size:f.size})));
    }});
  });
});

/* INFORME DEL MES CERRADO — tarjeta en Inicio los primeros días.
 * Cifras del mes ANTERIOR (no del nuevo). Descartar la quita. */

test("Inicio: tarjeta del mes cerrado con cifra acotada; descartar la quita", async ({ page }) => {
  // 2 de septiembre 2026 (Madrid): dentro de la ventana de 5 días.
  await page.clock.install({ time: new Date("2026-09-02T12:00:00+02:00") });
  await seedLoggedInDashboard(page, {
    budget: 500,
    budgetByMonth: {"2026-08":500},
    expenses: [
      { id: "a1", date: "2026-08-10T12:00:00.000Z", amount: 40, merchant: "Super Ago", category: "super", source: "manual" },
      { id: "s1", date: "2026-09-01T12:00:00.000Z", amount: 99, merchant: "Super Sep", category: "super", source: "manual" },
    ],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  const card = page.locator("[data-tour='closed-month']");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText("40");
  await expect(card).not.toContainText("139");
  await expect(card).not.toContainText("99");

  await card.getByRole("button", { name: /Descartar/i }).click();
  await expect(card).toHaveCount(0);
});

function fixture(snapshot=500.25){
  return {__seedOnce:true,budget:900,budgetByMonth:{"2026-10":snapshot},
    settings:{autoPrices:false,theme:"green",gTotalMode:"split",expenseBanks:["sabadell"]},
    accounts:[{id:"sab",ent:"sabadell",name:"Cuenta sintética",value:1000,role:"diario",spendFrom:true}],
    expenses:[
      {id:"g",date:"2026-10-10T12:00:00Z",amount:420.10,merchant:"Super sintético",category:"super",ent:"sabadell",source:"manual"},
      {id:"b",date:"2026-10-12T12:00:00Z",amount:-60.05,merchant:"Bizum recibido",category:"bizum",ent:"sabadell",source:"manual"},
      {id:"n",date:"2026-10-28T12:00:00Z",amount:-2100,merchant:"Nómina sintética",category:"ingreso",ent:"sabadell",source:"manual"},
      {id:"nuevo",date:"2026-11-01T12:00:00Z",amount:99,merchant:"Super noviembre",category:"super",ent:"sabadell",source:"manual"}],
    reservaLog:[{date:"2026-10-20T12:00:00Z",amount:20.02},{date:"2026-11-01T12:00:00Z",amount:99}]};
}
async function open(page,state,iso="2026-11-02T10:00:00Z"){
  await page.clock.install({time:new Date(iso)});
  await seedLoggedInDashboard(page,state);
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible({timeout:15000});await dismissNews(page);
  const card=page.locator("[data-tour='closed-month']");await expect(card).toBeVisible();return card;
}
async function share(page,card,filename){
  await card.getByRole("button",{name:/Crear imagen del informe/i}).click();
  await expect.poll(()=>page.evaluate(()=>window.__reportShares.length)).toBe(1);
  const data=await page.evaluate(()=>({text:window.__reportTexts.join(" ").replace(/\s/g," "),files:window.__reportShares[0]}));
  expect(data.files).toHaveLength(1);expect(data.files[0].name).toBe(filename);
  expect(data.files[0].type).toBe("image/png");expect(data.files[0].size).toBeGreaterThan(0);
  return data.text;
}

test("histórico: DOM y canvas usan 480,23 y75% aunque hoy tenga900",async({page})=>{
  const card=await open(page,fixture());
  await expect(card).toContainText(/octubre 2026/i);
  await expect(card).toContainText(/480\s*€.*75%/);await expect(card).not.toContainText(/900\s*€|880\s*€/);
  const text=await share(page,card,"mi-cartera-2026-10.png");
  expect(text).toMatch(/Octubre 2026/);expect(text).toMatch(/480 €.*75%/);expect(text).not.toMatch(/900 €|880 €/);
});

for(const [kind,snapshot,reason] of [
  ["ausente",undefined,"Límite de este mes no guardado"],
  ["cero",0,"Este mes no tenía límite configurado"],
  ["inválido","0x10","Límite de este mes no disponible"],
  ["null",null,"Límite de este mes no guardado"]]){
  test("histórico "+kind+": motivo propio igual en DOM e imagen, sin porcentaje",async({page})=>{
    const s=fixture(snapshot);if(kind==="ausente")delete s.budgetByMonth;
    const card=await open(page,s);await expect(card).toContainText(reason);await expect(card).not.toContainText(/\d+%/);
    const text=await share(page,card,"mi-cartera-2026-10.png");expect(text).toContain(reason);expect(text).not.toMatch(/\d+%|NaN|Infinity/);
  });
}

test("diciembre conserva año y PNG al empezar enero en Madrid",async({page})=>{
  const s=fixture("500.25");s.budgetByMonth={"2025-12":100,"2026-12":"500.25","2027-01":900};
  s.expenses=s.expenses.map(e=>({...e,date:e.date.replace("2026-10","2026-12").replace("2026-11","2027-01")}));
  s.reservaLog=s.reservaLog.map(e=>({...e,date:e.date.replace("2026-10","2026-12").replace("2026-11","2027-01")}));
  const card=await open(page,s,"2026-12-31T23:30:00Z");
  await expect(card).toContainText(/diciembre 2026/i);await expect(card).toContainText(/480\s*€.*75%/);
  const text=await share(page,card,"mi-cartera-2026-12.png");expect(text).toContain("Diciembre 2026");expect(text).toMatch(/480 €.*75%/);
});

test("reporte sin opt mantiene el presupuesto actual al compartir desde Ajustes",async({page})=>{
  await open(page,fixture());
  // Se invoca la misma entrada del botón de Ajustes: no se sustituye el cálculo ni el canvas.
  await page.evaluate(()=>{
    const s=mcLoadRaw(mcStateKey());
    shareMonthReport(s,{netWorth:0});
  });
  await expect.poll(()=>page.evaluate(()=>window.__reportShares.length)).toBe(1);
  const data=await page.evaluate(()=>({text:window.__reportTexts.join(" ").replace(/\s/g," "),file:window.__reportShares[0][0].name}));
  expect(data.text).toMatch(/Noviembre 2026/);expect(data.text).toMatch(/801 €.*12%/);expect(data.file).toBe("mi-cartera-2026-11.png");
});

test("el día6 conserva el cierre fuera de la ventana de cinco días",async({page})=>{
  await page.clock.install({time:new Date("2026-11-06T10:00:00Z")});await seedLoggedInDashboard(page,fixture());
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible({timeout:15000});await dismissNews(page);
  await expect(page.locator("[data-tour='closed-month']")).toHaveCount(0);
});
