// Banco de pruebas del reparto del Plan: el motor real (src/modules en el orden del build) con el
// reloj clavado en el sábado 21/11/2026 a las 12:00 de Madrid. Cifras inventadas: el repo es público.
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../../"+f,import.meta.url),"utf8");
export const AHORA=Date.parse("2026-11-21T11:00:00Z");
export function cargarMotor(mutar){
  const order=JSON.parse(read("src/build-order.json"));
  const js=order.map(f=>{
    const t=read("src/modules/"+f);
    return f==="17-plan-reparto.js"&&mutar?mutar(t):t;
  }).join("\n");
  const html=read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js);
  class Reloj extends Date{constructor(...a){super(...(a.length?a:[AHORA]));}static now(){return AHORA;}}
  const c=createLogicSandbox({Date:Reloj});
  vm.runInNewContext(extractPureLogicSource(html),c);
  return c;
}
export const ym=(k)=>({y:Math.floor(k/12),m:k%12+1});
export const NOV=2026*12+10;               // mes absoluto de noviembre de 2026 (0-indexado el mes)
export const dia=(d,m=11,y=2026)=>y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")+"T10:00:00.000Z";
export const mov=(id,d,amount,extra)=>Object.assign({id:id,date:dia(d),amount:amount,category:amount<0?"ingreso":"otros",merchant:"Comercio "+id,ent:"sabadell",source:"manual"},extra||{});
// Estado base: una cuenta de gasto diario, nómina el día 3 y un presupuesto de 900 €.
export function base(over){
  return Object.assign({budget:900,settings:{expenseBanks:["sabadell"]},
    accounts:[{ent:"sabadell",role:"diario",spendFrom:true,value:2380}],
    expenses:[mov("n1",3,-3000,{merchant:"Nómina Empresa SL"}),mov("g1",5,120.5,{category:"super"}),mov("g2",12,60,{category:"ocio"})],
    fixed:[],debts:[],goals:[],flows:[],oneoffs:[],reservaLog:[],aportaciones:[],deleted:[]},over||{});
}
// Estados «con todo apagado»: ningún interruptor y las mismas cifras que antes de existir el interruptor.
export function escenariosApagado(){
  const deuda=extra=>Object.assign({id:"d1",name:"Préstamo sintético",value:12000,monthly:260,months:40,day:5,asOf:NOV-6,account:"sabadell"},extra||{});
  const reparto=[{id:"p1",n:"Ana",via:"debt",debtId:"d1",amt:40}];
  const recibo={id:"r2",name:"Fibra sintética",amount:50,bankAmount:90,day:12,freq:"mes",account:"sabadell",reparto};
  const cuota=mov("c1",5,260,{category:"otros",source:"ob:sabadell",merchant:"Cargo cuota"});
  return [
    base(),
    base({debts:[deuda()]}),
    base({debts:[deuda({restarPres:false})]}),
    base({debts:[deuda({restarPres:false})],fixed:[recibo]}),
    base({debts:[deuda()],expenses:base().expenses.concat([cuota])}),
    base({debts:[deuda({restarPres:false})],expenses:base().expenses.concat([cuota]),reservaLog:[{id:"x",goalId:"g1",amount:150,date:dia(4)}],goals:[{id:"g1",name:"Viaje",target:3000,saved:0}]}),
    base({settings:{expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"net"},debts:[deuda({restarPres:false})],expenses:base().expenses.concat([cuota])}),
  ];
}
