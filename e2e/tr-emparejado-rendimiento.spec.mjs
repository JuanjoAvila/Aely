import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {seedLoggedInDashboard,dismissNews,installFixtureClock} from "./fixtures.mjs";
test.use({serviceWorkers:"block"});
const sources=[
 ["beta125",execFileSync("git",["show","6342459b0eeecd65eb1817db8e01bc179787c549:public/index.html"],{encoding:"utf8",maxBuffer:16e6})],
 ["nogo228",execFileSync("git",["show","2ff4c59ed6cd0a3c436efda2f2c0a7fc40925fdb:public/index.html"],{encoding:"utf8",maxBuffer:16e6})],
 ["candidate",fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8")]
];
for(const pairs of [380,5708])test("CPU6: 20000 filas y "+pairs+" pares, categoria y sync vacio",async({page},info)=>{
 test.setTimeout(240000);const result={rows:20000,pairs,rate:6,sources:{}};
 for(const [name,html] of sources){
  await installFixtureClock(page);await seedLoggedInDashboard(page);
  await page.route(/\/$/,route=>route.fulfill({contentType:"text/html",body:html}));
  await page.goto("/");await expect(page.locator(".botnav")).toBeVisible();await dismissNews(page);
  expect(await page.evaluate(()=>typeof reconcileGemelosAutomaticos==="function"&&String(reconcileGemelosAutomaticos).includes("gemeloCache"))).toBe(name==="candidate");
  const match=/setStateRaw\(prev=>\{([\s\S]*?)\}\); \},\[\]\);/.exec(html);expect(match).toBeTruthy();
  const cdp=await page.context().newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
  result.sources[name]=await page.evaluate(({pairs,body})=>{
   const upd=new Function("prev","updater",body),expenses=[];
   for(let i=0;i<pairs;i++){
    const amount=(1000+i)/100,day="2026-10-08";
    expenses.push({id:"a"+i,date:day+"T08:00:00Z",amount,merchant:"Aviso "+i,category:"otros",source:"macrodroid",ent:"trade_republic"});
    expenses.push({id:"b"+i,date:day+"T12:00:00Z",amount,merchant:"Movimiento",obName:"Movimiento",category:"otros",source:"ob",ent:"trade_republic",possibleDup:true,possibleDupOf:"a"+i});
   }
   while(expenses.length<20000)expenses.push({id:"m"+expenses.length,date:"2026-10-08",amount:1,merchant:"Manual",source:"manual"});
   let s={expenses,gemelos:[],deleted:[],accounts:[],settings:{},fixed:[],debts:[]};
   if(typeof reconcileGemelosAutomaticos==="function")s=reconcileGemelosAutomaticos(s);
   const initialPairs=s.expenses.filter(e=>e.autoGemelo).length,initialGemelos=s.gemelos.length;
   const values={category:[],emptySync:[]};let stable=true;
   for(let i=0;i<4;i++){
    let start=performance.now();const next=upd(s,p=>({...p,expenses:p.expenses.map((e,j)=>j===19999?{...e,category:"c"+i}:e)}));values.category.push(performance.now()-start);
    stable=stable&&next.gemelos===s.gemelos;s=next;
    start=performance.now();const empty=upd(s,p=>({...p,expenses:p.expenses.slice()}));values.emptySync.push(performance.now()-start);stable=stable&&empty.gemelos===s.gemelos;s=empty;
   }
   const median=a=>a.slice(1).sort((a,b)=>a-b)[1];return {initialPairs,initialGemelos,categoryMs:median(values.category),emptySyncMs:median(values.emptySync),stable,samples:values};
  },{pairs,body:match[1]});
  expect(result.sources[name].initialPairs).toBe(name==="beta125"?0:pairs);
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});await cdp.detach();await page.unroute(/\/$/);
 }
 console.log(JSON.stringify({trPairCpu6:result}));await info.attach("cpu6-"+pairs+".json",{body:JSON.stringify(result,null,2),contentType:"application/json"});
 expect(result.sources.candidate.stable).toBe(true);
 expect(result.sources.candidate.categoryMs).toBeLessThan(result.sources.nogo228.categoryMs*0.35);
 expect(result.sources.candidate.emptySyncMs).toBeLessThan(result.sources.nogo228.emptySyncMs*0.35);
});
