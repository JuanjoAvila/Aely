import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");

/* LA PRIMERA SUBIDA DEL HISTÓRICO VA EN LOTES (backlog 19/11). Sin nada en la nube, el repaso de
   `syncFromCloud` subía cada gasto local con su propio upsert: 20.000 gastos, 20.000 peticiones.
   `subirGastosEnLotes` los manda de 500 en 500 por `addExpensesBatch` (el mismo alta idempotente) y
   deja sueltos solo los cargos de recibo, que necesitan `setExpenseRecibo` si la fila ya estaba. */
let total=0,fallos=0;
async function test(name,fn){ try{ await fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
function harness(opts={}){
  const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
  const log={lotes:[],sueltos:[],errores:[],recibos:0};
  // `cloud` es un const del monolito: no cuelga del sandbox, se coge del contexto.
  c.cloud=vm.runInContext("cloud",c);
  c.cloud.enabled=()=>true;
  c.cloud.addExpensesBatch=async function(l){ log.lotes.push(l.length); if(opts.fallaPrimero&&log.lotes.length===1) throw new Error("x"); return {cloudIds:[],offline:false}; };
  c.cloud.addExpense=async function(e){ log.sueltos.push(e.id); return opts.yaEstaba?false:true; };
  c.cloud.setExpenseRecibo=async function(){ log.recibos++; };
  c.cloud.logEvent=function(kind,msg){ log.errores.push(msg); };
  return {c,log};
}
const gastos=(n,o)=>Array.from({length:n},(_,i)=>Object.assign({id:"g"+i,date:"2026-01-01",amount:1+i/100,merchant:"Comercio "+i,category:"otros"},o));

await test("1.202 gastos: tres lotes (500, 500, 200) y solo los dos recibos sueltos",async()=>{
  const {c,log}=harness();
  await c.subirGastosEnLotes(gastos(1200).concat(gastos(2,{reciboId:"r"}).map((e,i)=>Object.assign(e,{id:"r"+i}))),"backfill");
  assert.deepEqual(log.lotes,[500,500,200]);
  assert.deepEqual(log.sueltos,["r0","r1"]);
});

await test("el recibo que ya estaba en la nube sigue recibiendo su marca",async()=>{
  const {c,log}=harness({yaEstaba:true});
  await c.subirGastosEnLotes(gastos(3).concat([{id:"r",date:"2026-01-02",amount:9,merchant:"Luz",reciboId:"luz"}]),"backfill");
  assert.equal(log.recibos,1);
  assert.deepEqual(log.lotes,[3]);
});

await test("un lote que falla se apunta y los demás siguen",async()=>{
  const {c,log}=harness({fallaPrimero:true});
  await c.subirGastosEnLotes(gastos(1100),"backfill");
  assert.deepEqual(log.lotes,[500,500,100]);
  assert.equal(log.errores.length,1);
  assert.match(log.errores[0],/^addExpensesBatch backfill: 500$/);
});

await test("uno solo va por el camino de siempre; sin nube no sale nada",async()=>{
  const {c,log}=harness();
  await c.subirGastosEnLotes(gastos(1),"backfill");
  assert.deepEqual(log.lotes,[]);assert.deepEqual(log.sueltos,["g0"]);
  c.cloud.enabled=()=>false;
  await c.subirGastosEnLotes(gastos(50),"backfill");
  assert.deepEqual(log.lotes,[]);assert.equal(log.sueltos.length,1);
});

await test("el repaso de syncFromCloud sube por lotes, no fila a fila",()=>{
  const main=read("src/modules/11-app-main.js");
  assert.equal(main.split('subirGasto(e, "backfill")').length,1,"ya no sube fila a fila");
  assert.equal(main.split('subirGastosEnLotes(backfill, "backfill");').length,2);
});

console.log(`\n${total} OK, ${fallos} fallos`);
if(fallos) process.exit(1);
