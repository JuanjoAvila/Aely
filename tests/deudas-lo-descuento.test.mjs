// «Lo descuento» en una deuda que no cuadra y «baja cada mes» en Editar deuda (feedback 1/11/2026).
// Cifras inventadas: el repo es público. Se corre con TZ=Europe/Madrid y TZ=UTC.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";

const html=fs.readFileSync("public/index.html","utf8"),source=extractPureLogicSource(html);
const time=Date.parse("2026-10-14T12:00:00Z");
class Clock extends Date{constructor(...a){super(...(a.length?a:[time]));}static now(){return time;}}
const c=createLogicSandbox({Date:Clock});vm.runInNewContext(source,c);
const cents=x=>Math.round(x*100),plain=x=>JSON.parse(JSON.stringify(x));
const anchor=2026*12+9-6; // seis meses pagados antes de octubre de 2026
const debt=extra=>({id:"dx",name:"Préstamo sintético",value:12000,monthly:300,months:40,day:5,asOf:anchor,account:"banco",...extra});
const recibo=(parte,extra)=>({id:"rx",name:"Fibra sintética",amount:+(90-parte).toFixed(2),bankAmount:90,freq:"mes",day:12,account:"banco",
  reparto:[{id:"pe_x",n:"Persona X",via:"debt",debtId:"dx",amt:parte}],...extra});
const st=(d,fixed)=>({debts:[d],fixed:fixed||[],accounts:[],flows:[],oneoffs:[]});
const one=s=>s.debts[0];
let n=0;const caso=(name,fn)=>{fn();n++;};

caso("casa: la cuota baja sola y no se pregunta",()=>{
  const antes=st(debt()),bruto=st(debt(),[recibo(40)]),despues=c.deudasTrasReparto(antes,bruto);
  assert.equal(one(despues).monthly,260);assert.equal(one(despues).amort,300);
  assert.deepEqual(plain(c.descuentoDescuadre(antes,despues)),[]);
});

caso("no casa: se pregunta con lo que sale del banco y lo que baja",()=>{
  const d=debt({amort:271.43}),antes=st(d),despues=c.deudasTrasReparto(antes,st(d,[recibo(40)]));
  assert.equal(one(despues),d,"deudasTrasReparto sigue sin tocarla");
  assert.deepEqual(plain(c.descuentoDescuadre(antes,despues)),[{id:"dx",name:"Préstamo sintético",paga:260,baja:300,descuento:40}]);
});

caso("no casa + acepta: cuota 260, baja 300, saldo de hoy intacto y plazo coherente",()=>{
  const d=debt({amort:271.43}),antes=st(d),despues=c.deudasTrasReparto(antes,st(d,[recibo(40)]));
  const q=c.descuentoDescuadre(antes,despues)[0],fijo=c.deudaFijarDescuento(despues,q.id,q.paga,q.baja),x=one(fijo);
  const saldo=cents(c.debtBalance(d)),paid=c.debtPaidCount(d);
  assert.equal(x.monthly,260);assert.equal(x.amort,300);
  assert.equal(cents(c.debtBalance(x)),saldo,"Cambiar lo que baja no mueve el saldo de hoy");
  assert.equal(x.months,paid+Math.ceil(saldo/30000));assert.equal(c.debtLeft(x),Math.ceil(saldo/30000));
  assert.equal(x.asOf,d.asOf);
  assert.equal(fijo.fixed,despues.fixed,"El recibo no se toca");
  assert.deepEqual(plain(c.descuentoDescuadre(antes,fijo)),[],"Ya cuadra: 260 + 40 = 300");
  // Y desde aquí cuadra: quitar el descuento devuelve la cuota a 300 sin `amort` aparte.
  const sin=c.deudasTrasReparto(fijo,Object.assign({},fijo,{fixed:[]}));
  assert.equal(one(sin).monthly,300);assert.equal(one(sin).amort,undefined);
  assert.equal(cents(c.debtBalance(one(sin))),saldo);
});

caso("no casa + acepta con otra bajada tecleada",()=>{
  const d=debt({amort:271.43}),despues=c.deudasTrasReparto(st(d),st(d,[recibo(40)]));
  const x=one(c.deudaFijarDescuento(despues,"dx",260,310));
  assert.equal(x.monthly,260);assert.equal(x.amort,310);assert.equal(cents(c.debtBalance(x)),cents(c.debtBalance(d)));
});

caso("no casa + cancela: no se toca nada",()=>{
  const d=debt({amort:271.43}),antes=st(d),despues=c.deudasTrasReparto(antes,st(d,[recibo(40)]));
  // Cancelar = la UI no llama a deudaFijarDescuento; lo que se guarda es `despues` tal cual.
  assert.equal(one(despues),d);assert.equal(one(despues).monthly,300);assert.equal(one(despues).amort,271.43);
  assert.equal(c.deudaFijarDescuento(despues,"dx",0,300),despues,"Sin cifras válidas tampoco");
  assert.equal(c.deudaFijarDescuento(despues,"otra",260,300),despues);
});

caso("con interés: ni se pregunta, ni se ajusta, ni se ofrece editar lo que baja",()=>{
  const d=debt({apr:3.2,amort:271.43}),despues=c.deudasTrasReparto(st(d),st(d,[recibo(40)]));
  assert.deepEqual(plain(c.descuentoDescuadre(st(d),despues)),[]);
  assert.equal(c.deudaFijarDescuento(despues,"dx",260,300),despues);
  const draft=c.debtEditDraft(d);assert.equal("amort" in draft,false);
  const r=c.debtEditResult(d,{...draft,amort:"500"});assert.equal(r.item,d,"Con TAE el campo se ignora");
  assert.equal(c.debtEditAmortDePlazo(d,{...draft,months:"50"}),null);
});

caso("Editar deuda: cambiar lo que baja re-ancla y saca el plazo (pide confirmarlo)",()=>{
  const d=debt({amort:271.43}),draft=c.debtEditDraft(d);
  assert.equal(draft.amort,"271.43");
  assert.equal(c.debtEditResult(d,draft).item,d,"Guardar lo mismo no toca nada");
  const r=c.debtEditResult(d,{...draft,amort:"300"}),x=r.item,saldo=cents(c.debtBalance(d)),paid=c.debtPaidCount(d);
  assert.equal(r.error,undefined);assert.equal(x.amort,undefined,"Igual a la cuota: no se guarda aparte");assert.equal(x.monthly,300);
  assert.equal(cents(c.debtBalance(x)),saldo);assert.equal(x.months,paid+Math.ceil(saldo/30000));
  const change=c.debtEditTermChange(d,{...draft,amort:"300"},r);assert.equal(change.before,40);assert.equal(change.after,x.months);
  assert.equal(c.debtEditResult(d,{...draft,amort:"0"}).error,"db_edit_amort_zero");
  assert.equal(c.debtEditResult(d,{...draft,amort:"abc"}).error,"plan_edit_invalid");
});

caso("Editar deuda: el plazo nuevo no se valida contra la bajada vieja",()=>{
  const d=debt({monthly:250,amort:196.68,months:60}),draft=c.debtEditDraft(d),saldo=cents(c.debtBalance(d)),paid=c.debtPaidCount(d);
  const plazo=paid+Math.ceil(saldo/25000),form={...draft,months:String(plazo)};
  assert.equal(c.debtEditResult(d,form).error,"db_err_term_quota","Sin recalcular, la bajada vieja no encaja");
  const a=c.debtEditAmortDePlazo(d,form);assert.equal(a,String(Math.ceil(saldo/(plazo-paid))/100));
  const r=c.debtEditResult(d,{...form,amort:a});assert.equal(r.error,undefined);
  assert.equal(r.item.months,plazo);assert.equal(cents(c.debtBalance(r.item)),saldo);assert.equal(r.item.monthly,250);
});

caso("financiación al 0 % ligada: el plazo no mueve lo que baja",()=>{
  const d=debt({monthly:300,amort:300}),draft=c.debtEditDraft(d);
  assert.equal(c.debtEditAmortDePlazo(d,{...draft,months:"45"}),null);
  // Cuota tocada sin tocar lo que baja: siguen moviéndose juntas, como antes.
  const r=c.debtEditResult(d,{...draft,monthly:"200",months:String(c.debtPaidCount(d)+Math.ceil(c.debtBalance(d)/200))});
  assert.equal(r.error,undefined);assert.equal(r.item.amort,200);
});

caso("ficha sencilla: cambiar lo que baja no mueve el saldo de hoy",()=>{
  let s=st(debt({amort:271.43}));const set=fn=>{s=fn(s);},saldo=cents(c.debtBalance(one(s)));
  c.patchDebtFields(set,"dx",{amort:300});
  assert.equal(one(s).amort,undefined,"300 = la cuota: no hace falta guardarlo");
  assert.equal(cents(c.debtBalance(one(s))),saldo);assert.equal(c.debtLeft(one(s)),Math.ceil(saldo/30000));
  c.patchDebtFields(set,"dx",{account:"otro"});assert.equal(cents(c.debtBalance(one(s))),saldo);
});

console.log("deudas-lo-descuento: "+n+" casos OK ("+(process.env.TZ||"TZ local")+")");
