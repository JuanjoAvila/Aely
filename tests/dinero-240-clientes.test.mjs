// Integración 240 (240-dinero): el posible repetido con clientes de dos versiones alrededor del cierre
// de mes (P2-B de la revisión de 240-saldos, segunda vuelta) y el sobre de efectivo fuera de los
// bancos de gasto (su P3).
// Desde la 240 el ancla con la lectura del banco deja el posible repetido FUERA del `value`; antes lo
// dejaba dentro y el cierre lo restaba. La marca `anclaReglas` (de 240-recibos) dice con qué regla se
// ancló, y `cierreReglas` con qué regla se cerró cada mes. El «cliente viejo» es el código de la beta
// 4.26.239 (`eb75d2908`, el mismo mecanismo de commit inmutable que `recibo-invariante`).
// Dos bancos siempre (BBVA de gasto y una cuenta de recibos en ING). Datos inventados. Corre con TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {execFileSync} from "node:child_process";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const BASE="eb75d2908415c5447555a5fb7c5b75ad6f48bfc7";
const disco=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const deGit=f=>execFileSync("git",["show",BASE+":"+f],{encoding:"utf8",maxBuffer:3e7,cwd:new URL("..",import.meta.url)});
const reloj={t:0};
function carga(src){
  const order=JSON.parse(src("src/build-order.json"));
  const c=loadPureLogic(src("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>src("src/modules/"+f)).join("\n")));
  vm.runInNewContext(src("src/modules/14-v4-screens.js"),c);
  c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[reloj.t])); } static now(){ return reloj.t; } };
  return c;
}
const nuevo=carga(disco), viejo=carga(deGit);
const json=x=>JSON.parse(JSON.stringify(x));
const cents=n=>Math.round(n*100);
const pinta=(c,s)=>{ const i=c.insumosSaldoGasto(s),o={}; s.accounts.forEach(a=>{ o[a.id]=cents(c.saldoCuentaMostrada(a,i)); }); return o; };
const enlace=(aspsp,uid,amount)=>({aspsp,ok:true,accounts:[{uid,ok:true,balances:[{type:"ITAV",amount,currency:"EUR"}],transactions:[]}]});
const OCT28=new Date(2026,9,28,18).getTime(), NOV2=new Date(2026,10,2,9).getTime(), NOV3=new Date(2026,10,3,9).getTime();
const vacio={debts:[],bankTx:[],oneoffs:[],flows:[],goals:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],fixed:[],_dynBalAnchored:true,_netoUnaCuenta:true};

// BBVA «ambos» por Open Banking. El banco dice 1.000 y ya lleva la compra de 20 y UN cargo de 48: el
// aviso del móvil y la fila sin nombre del extracto son la misma compra (posible repetido).
const casoOB=()=>Object.assign(json(vacio),{
  accounts:[{id:"a",ent:"bbva",role:"ambos",spendFrom:true,value:3000},{id:"b",ent:"ing",role:"fijos",value:600}],
  settings:{},trAnchor:"2026-10",budget:800,
  expenses:[
    {id:"w1",date:"2026-10-15T08:00:00.000Z",merchant:"Bar",amount:48,category:"bares",source:"wallet",ent:"bbva"},
    {id:"o1",date:"2026-10-15T10:00:00.000Z",merchant:"",amount:48,category:"otros",source:"ob",ent:"bbva",possibleDup:true,possibleDupOf:"w1"},
    {id:"m1",date:"2026-10-12T12:00:00.000Z",merchant:"Mercadona",amount:20,category:"super",source:"ob",ent:"bbva"}]});
const lee=(c,s)=>{ reloj.t=OCT28; return Object.assign(c.applyBankBalances(json(s),[enlace("BBVA","bbva",1000),enlace("ING","ing",600)]).state,{obBalAt:{BBVA:new Date(OCT28).toISOString(),ING:new Date(OCT28).toISOString()}}); };
const cierra=(c,s)=>{ reloj.t=NOV2; return c.reconcileTR(json(s)); };

test("cliente nuevo ancla y cierra: el día 1 sigue el banco, y el mes queda marcado como cerrado con la regla nueva",()=>{
  const s=lee(nuevo,casoOB());
  assert.deepEqual(pinta(nuevo,s),{a:100000,b:60000});
  assert.equal(nuevo.anclaConReglas(s.accounts[0]),true,"el ancla nueva marca la cuenta");
  const c=cierra(nuevo,s);
  assert.deepEqual(pinta(nuevo,c),{a:100000,b:60000});
  assert.deepEqual(json(c.accounts[0].cierreReglas),{"2026-10":240});
});

test("ancló un cliente viejo y cierra el nuevo: cierre con la regla vieja y el día 1 sigue el banco (antes 1.048)",()=>{
  const s=lee(viejo,casoOB());
  assert.deepEqual(pinta(viejo,s),{a:104800,b:60000},"el error de siempre del viejo: el repetido dentro del ancla");
  assert.equal(nuevo.cierreConReglaVieja(s.accounts[0]),true);
  const c=cierra(nuevo,s);
  assert.deepEqual(pinta(nuevo,c),{a:100000,b:60000});
  assert.equal(c.accounts[0].cierreReglas,undefined,"el mes se cerró con la regla vieja: sin entrada");
});

test("una escritura vieja de `value` invalida la marca, y la cuenta vuelve a cerrar con la regla vieja",()=>{
  const s=lee(nuevo,casoOB()); s.accounts[0].value+=10;
  assert.equal(nuevo.anclaConReglas(s.accounts[0]),false);
  assert.equal(nuevo.cierreConReglaVieja(s.accounts[0]),true);
});

test("ancla el nuevo y cierra un cliente viejo: 952. Sin arreglo posible (el viejo no conoce la marca): que no convivan",()=>{
  // Documenta el límite que dice la revisión: este test falla si alguien cree haberlo arreglado sin
  // tocar al cliente viejo.
  const c=cierra(viejo,lee(nuevo,casoOB()));
  assert.equal(pinta(nuevo,c).a,95200);
});

test("lo que mueve `value` sin cambiar sus reglas renueva la marca: cambiar de rol, conservar el neto, migrar",()=>{
  // Un recibo cobrado en BBVA para que cambiar el rol de la «ambos» sí mueva su base.
  const base=Object.assign(casoOB(),{fixed:[{id:"luz",name:"Luz",amount:40,day:5,account:"bbva",freq:"mes"}]});
  const s=lee(nuevo,base);
  const T={injTR:0,spentByBank:{},paidNetByBank:{},roundupThisMonth:0,monthlyInvestThisMonth:0};
  const r=nuevo.applyAccountRole(s,Object.assign(T,nuevo.insumosSaldoGasto(s)),"a","diario");
  assert.notEqual(r.accounts[0].value,s.accounts[0].value,"el rol nuevo mueve la base");
  assert.equal(nuevo.anclaConReglas(r.accounts[0]),true,"y la marca la sigue");
  assert.deepEqual(pinta(nuevo,r),pinta(nuevo,s),"sin mover lo pintado");
  assert.equal(nuevo.cierreConReglaVieja(r.accounts[0]),false);
  // Dos cuentas de recibos en ING, las dos marcadas, con el estado de antes de la 238.
  const dos=Object.assign(json(s),{_netoUnaCuenta:false,accounts:json(s.accounts).concat([{id:"b2",ent:"ing",role:"fijos",value:300}]),
    fixed:[{id:"tel",name:"Teléfono",amount:30,day:3,account:"ing",freq:"mes"}]});
  dos.accounts.forEach(a=>{ a.anclaReglas={r:240,v:a.value,t:null}; });
  const m=nuevo.migraNetoUnaCuenta(json(dos));
  assert.ok(m.accounts.some((a,i)=>a.value!==dos.accounts[i].value),"la migración mueve alguna base");
  m.accounts.forEach(a=>assert.equal(nuevo.anclaConReglas(a),true,a.id));
  // Reordenar las dos de ING: el neto pasa a la otra y las dos conservan la marca.
  const orden=Object.assign(json(m),{accounts:[m.accounts[0],m.accounts[2],m.accounts[1]]});
  const k=nuevo.conservaNetoDeBanco(m,orden);
  assert.ok(k.accounts.some((a,i)=>a.value!==orden.accounts[i].value),"reordenar mueve alguna base");
  k.accounts.forEach(a=>assert.equal(nuevo.anclaConReglas(a),true,a.id));
});

// ---------- Resolver el posible repetido de un mes cerrado, según con qué regla se cerró ----------
// BBVA diaria a mano (sin lectura): el aviso de 48 y la fila sin nombre, y Mercadona 20. Sin
// lectura, nadie más lo corrige: lo decide la regla con la que se cerró octubre.
const casoAMano=redondeo=>Object.assign(json(vacio),{
  accounts:[{id:"a",ent:"bbva",role:"diario",spendFrom:true,value:1000,roundup:redondeo},{id:"b",ent:"ing",role:"fijos",value:600}],
  settings:{},trAnchor:"2026-10",budget:800,
  expenses:[
    {id:"w1",date:"2026-10-10T08:00:00.000Z",merchant:"Bar",amount:48,category:"bares",source:"wallet",ent:"bbva"},
    {id:"o1",date:"2026-10-10T10:00:00.000Z",merchant:"",amount:48,category:"otros",source:"ob-hist",ent:"bbva",possibleDup:true,possibleDupOf:"w1"},
    {id:"m1",date:"2026-10-12T12:00:00.000Z",merchant:"Mercadona",amount:20,category:"super",source:"manual",ent:"bbva"}]});
const resuelve=(s,mismo)=>{ reloj.t=NOV3; return nuevo.resolvePossibleDup(json(s),"o1",mismo); };

test("mes cerrado por un cliente viejo (restó el repetido): «es el mismo» devuelve el importe, «son distintos» no lo vuelve a restar",()=>{
  const c=cierra(viejo,casoAMano(0));
  assert.equal(pinta(nuevo,c).a,88400,"el viejo lo restó al cerrar");
  assert.equal(c.accounts[0].cierreReglas,undefined);
  assert.equal(pinta(nuevo,resuelve(c,true)).a,93200,"verdad con «es el mismo»: salieron 68");
  assert.equal(pinta(nuevo,resuelve(c,false)).a,88400,"verdad con «son distintos»: salieron 116");
});

test("con redondeo: tras un cierre viejo, «son distintos» solo resta el redondeo que ese cierre no estimó",()=>{
  // El cierre viejo estimaba el redondeo sin el repetido (20 → 1,00 y el aviso de 48 → 1,00).
  const c=cierra(viejo,casoAMano(1));
  assert.equal(pinta(nuevo,c).a,100000-11600-200);
  assert.equal(pinta(nuevo,resuelve(c,true)).a,100000-6800-200,"«es el mismo» devuelve los 48");
  assert.equal(pinta(nuevo,resuelve(c,false)).a,100000-11600-300,"«son distintos»: la compra de verdad también redondea");
});

test("mes cerrado por el nuevo: «son distintos» resta el importe y «es el mismo» nada (el P2-A, por la marca del mes)",()=>{
  const c=cierra(nuevo,casoAMano(0));
  assert.deepEqual(json(c.accounts[0].cierreReglas),{"2026-10":240});
  assert.equal(pinta(nuevo,c).a,93200);
  assert.equal(pinta(nuevo,resuelve(c,false)).a,88400);
  assert.equal(pinta(nuevo,resuelve(c,true)).a,93200);
});

test("`cierreReglas` va por mes: dos meses de golpe, un repetido de dos cierres atrás, y solo los últimos 12",()=>{
  const s=casoAMano(0); s.trAnchor="2026-09";
  s.expenses.forEach(e=>{ e.date=e.date.replace("2026-10","2026-09"); });
  s.accounts[0].cierreReglas={}; for(let m=1;m<=12;m++) s.accounts[0].cierreReglas["2025-"+String(m).padStart(2,"0")]=240;
  const c=cierra(nuevo,s);
  assert.equal(c.trAnchor,"2026-11");
  const k=Object.keys(c.accounts[0].cierreReglas).sort();
  assert.equal(k.length,12);
  assert.deepEqual(k.slice(-2),["2026-09","2026-10"]);
  assert.equal(pinta(nuevo,resuelve(c,false)).a,88400,"septiembre se cerró con la regla nueva");
  // Y si septiembre lo hubiera cerrado un viejo (sin entrada), «es el mismo» devuelve.
  const sinSep=json(c); delete sinSep.accounts[0].cierreReglas["2026-09"];
  assert.equal(pinta(nuevo,resuelve(sinSep,true)).a,pinta(nuevo,c).a+4800);
});

test("la diaria a mano y la TR del puente cierran SIEMPRE con la regla nueva (su `value` ya significaba lo nuevo)",()=>{
  const s=casoAMano(0);
  assert.equal(nuevo.cierreConReglaVieja(s.accounts[0]),false,"a mano, sin marca");
  reloj.t=OCT28;
  const tr=nuevo.applyTrCash(Object.assign(json(s),{accounts:[{id:"t",ent:"trade_republic",role:"diario",spendFrom:true,value:0},s.accounts[1]]}),900,
    Object.assign({roundupThisMonth:0,monthlyInvestThisMonth:0},nuevo.insumosSaldoGasto(s)));
  assert.equal(nuevo.cierreConReglaVieja(tr.accounts[0]),false,"la del puente tampoco");
});

// ---------- El sobre de efectivo fuera de los bancos de gasto (P3 de la revisión) ----------
test("sobre de efectivo fuera de los bancos de gasto: resta sus compras al pintar y al cerrar",()=>{
  reloj.t=OCT28;
  const s=Object.assign(json(vacio),{trAnchor:"2026-10",budget:800,settings:{expenseBanks:["bbva"]},
    accounts:[{id:"a",ent:"bbva",role:"diario",spendFrom:true,value:1000},{id:"e",ent:"efectivo",name:"Efectivo",role:"fijos",value:200},{id:"b",ent:"ing",role:"fijos",value:600}],
    expenses:[{id:"x1",date:"2026-10-05T10:00:00.000Z",merchant:"Kiosco",amount:39.09,category:"otros",source:"manual",ent:"efectivo"},
      {id:"x2",date:"2026-10-20T10:00:00.000Z",merchant:"Mercado",amount:50,category:"super",source:"manual",ent:"efectivo"},
      {id:"x3",date:"2026-10-21T10:00:00.000Z",merchant:"Mercado",amount:50,category:"super",source:"manual",ent:"efectivo",possibleDup:true}]});
  assert.equal(pinta(nuevo,s).e,11091,"antes 200: fuera del filtro no restaba nada");
  assert.equal(pinta(nuevo,s).a,100000,"la diaria no se come el sobre");
  const c=cierra(nuevo,s);
  assert.equal(pinta(nuevo,c).e,11091,"y el cierre resta lo mismo: el día 1 no rebota");
  assert.equal(c.accounts[1].value,110.91);
  // Dentro del filtro, igual que siempre.
  reloj.t=OCT28;
  const dentro=Object.assign(json(s),{settings:{expenseBanks:["bbva","efectivo"]}});
  assert.equal(pinta(nuevo,dentro).e,11091);
  assert.equal(pinta(viejo,dentro).e,11091);
});
