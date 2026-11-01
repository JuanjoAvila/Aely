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
const soloNuevos=process.env.AELY_LO_DESCUENTO_CASES==="r164";
assert.ok(!process.env.AELY_LO_DESCUENTO_CASES||soloNuevos,"Filtro de casos desconocido");
let n=0;const caso=(name,fn)=>{if(!soloNuevos){fn();n++;}};

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

caso("B1: ligada, cuota 260 y «baja 300» tecleada se guarda tal cual (no baja 260 en silencio)",()=>{
  const d=debt();delete d.months;const saldo=cents(c.debtBalance(d));
  const r=c.debtEditResult(d,{...c.debtEditDraft(d),monthly:"260",amort:"300",amortSet:true});
  assert.equal(r.error,undefined);assert.equal(r.item.monthly,260);assert.equal(r.item.amort,300);
  assert.equal(cents(c.debtBalance(r.item)),saldo);
  // Sin tocar el campo (borrador de antes) la bajada sigue a la cuota, como siempre.
  assert.equal(c.debtEditResult(d,{...c.debtEditDraft(d),monthly:"260"}).item.amort,undefined);
  // Con plazo: 300 cuadra con el plazo de siempre → se guarda sin «no encajan».
  const p=debt({amort:300}),rp=c.debtEditResult(p,{...c.debtEditDraft(p),monthly:"260",amort:"300",amortSet:true});
  assert.equal(rp.error,undefined);assert.equal(rp.item.monthly,260);assert.equal(rp.item.amort,300);assert.equal(rp.item.months,40);
  // Y si lo tecleado no encaja con el plazo tecleado, el aviso habla de lo que baja, sin rango de cuotas.
  const mal=c.debtEditResult(p,{...c.debtEditDraft(p),months:"25",amort:"300",monthly:"260",amortSet:true});
  assert.equal(mal.error,"db_err_term_amort");assert.equal(mal.range,undefined);
});

caso("R1: el descuadre ya guardado se detecta y propone lo que le pasas",()=>{
  const s=st(debt({amort:271.43}),[recibo(40)]);
  assert.deepEqual(plain(c.descuentoDescuadreGuardado(s,one(s))),{id:"dx",name:"Préstamo sintético",paga:260,baja:300,descuento:40});
  const bien=st(debt({monthly:260,amort:300}),[recibo(40)]);assert.equal(c.descuentoDescuadreGuardado(bien,one(bien)),null);
  const tae=st(debt({amort:271.43,apr:3}),[recibo(40)]);assert.equal(c.descuentoDescuadreGuardado(tae,one(tae)),null);
  assert.equal(c.descuentoDescuadreGuardado(st(debt({amort:271.43})),debt({amort:271.43})),null,"Sin descuento no hay nada que señalar");
  // Cuota ya bajada a mano (260) con una bajada rara: se propone la cuota tal cual.
  const baja=st(debt({monthly:260,amort:310}),[recibo(40)]);assert.equal(c.descuentoDescuadreGuardado(baja,one(baja)).paga,260);
  const fijo=c.deudaFijarDescuento(s,"dx",260,300);assert.equal(c.descuentoDescuadreGuardado(fijo,one(fijo)),null);
});

caso("R2: con otra bajada (310) y quitando el recibo, se pregunta y vuelve a cuadrar",()=>{
  const d=debt({amort:271.43}),s=st(d,[recibo(40)]),fijo=c.deudaFijarDescuento(s,"dx",260,310);
  const sin=c.deudasTrasReparto(fijo,Object.assign({},fijo,{fixed:[]}));
  assert.equal(one(sin).monthly,260,"deudasTrasReparto solo no la arregla");
  const q=c.descuentoDescuadre(fijo,sin);assert.deepEqual(plain(q),[{id:"dx",name:"Préstamo sintético",paga:300,baja:300,descuento:0}]);
  const ok=one(c.deudaFijarDescuento(sin,"dx",q[0].paga,q[0].baja));
  assert.equal(ok.monthly,300);assert.equal(ok.amort,undefined);assert.equal(cents(c.debtBalance(ok)),cents(c.debtBalance(d)));
});

caso("R3: ficha sencilla con TAE no acorta el plazo al bajar la cuota",()=>{
  let s=st(debt({apr:7}));const set=fn=>{s=fn(s);},saldo=cents(c.debtBalance(one(s)));
  c.patchDebtFields(set,"dx",{monthly:250});
  assert.equal(one(s).months,40);assert.equal(one(s).monthly,250);assert.equal(cents(c.debtBalance(one(s))),saldo);
});

caso("R2b: una bajada distinta confirmada deja de señalarse hasta que cambie algo",()=>{
  const s=st(debt({amort:271.43}),[recibo(40)]),fijo=c.deudaFijarDescuento(s,"dx",260,310),x=one(fijo);
  assert.equal(x.monthly,260);assert.equal(x.amort,310);
  assert.equal(c.descuentoDescuadreGuardado(fijo,x),null,"Lo que confirmó ya es lo cuadrado");
  // Si cambia la cuota, el descuento o el recibo, vuelve a señalarse.
  assert.ok(c.descuentoDescuadreGuardado(fijo,{...x,monthly:255}));
  const otra=Object.assign({},fijo,{fixed:[recibo(45)]});assert.ok(c.descuentoDescuadreGuardado(otra,one(otra)));
});

// El loader corta antes de las pantallas v4. Se carga su función real: copiar aquí el .then
// daría verde aunque guardar empezara a escribir entre las dos preguntas.
const pantalla=fs.readFileSync("src/modules/14-v4-screens.js","utf8").replace(/\r\n/g,"\n");
function tramo(inicio,fin){
  const a=pantalla.indexOf(inicio),b=pantalla.indexOf(fin,a+inicio.length);
  assert.ok(a>=0&&b>a&&pantalla.lastIndexOf(inicio)===a&&pantalla.lastIndexOf(fin)===b,"Anclas únicas: "+inicio);
  return pantalla.slice(a,b);
}
function nodos(x){return !x?[]:Array.isArray(x)?x.flatMap(nodos):typeof x==="object"?[x,...nodos(x.children)]:[];}
async function dosDeudasJuntas(cancelarSegunda){
  const h=createLogicSandbox({Date:Clock}),valores=[];let cursor=0;
  h.React.useState=function(init){const i=cursor++;if(!(i in valores))valores[i]=typeof init==="function"?init():init;return [valores[i],v=>{valores[i]=typeof v==="function"?v(valores[i]):v;}];};
  h.React.createElement=(type,props,...children)=>({type,props:props||{},children});
  h.React.useId=()=>"persona-test";h.ReactDOM.createPortal=x=>x;
  vm.createContext(h);vm.runInContext(source,h);
  vm.runInContext(tramo('\nconst PE_VIAS=','\nfunction peViaTxt(')+tramo('\nfunction PersonaSheet(','\n/* Hoja «¿Te llega?»')+tramo('\nfunction rp4Raw(','\nfunction rp4DiasMes('),h);
  let cerrar;const cerrado=new Promise(resolve=>{cerrar=resolve;});
  h.useSheetSwipe=()=>({close:cerrar,sheetRef:{current:null},sheetTouch:{}});h.useBackClose=()=>{};
  const preguntas=[],esperas=[];
  h.askText=opciones=>new Promise(resolve=>{const q={opciones,responder:resolve};preguntas.push(q);if(esperas.length)esperas.shift()(q);});
  let vistas=0;
  const siguiente=()=>preguntas.length>vistas?Promise.resolve(preguntas[vistas++]):new Promise(resolve=>esperas.push(q=>{vistas++;resolve(q);}));
  const dx=debt({amort:271.43}),dy=debt({id:"dy",name:"Segundo préstamo",monthly:200,amort:177.77});
  const original={...st(dx,[recibo(40)]),debts:[dx,dy]},foto=plain(original);
  let estado=original;const escrituras=[];
  const set=fn=>{estado=fn(estado);escrituras.push(plain(estado));};
  const render=()=>{cursor=0;return h.PersonaSheet({pid:"pe_x",state:estado,set,totals:{curYear:2026,curMonth:10,today:14},onClose:cerrar});};
  const deudas=nodos(render()).find(x=>x.props["data-pe"]==="deuda");
  const elegir=nodos(deudas).find(x=>x.type==="button"&&x.props.key==="dy");assert.ok(elegir);
  elegir.props.onClick();
  const guardar=nodos(render()).find(x=>x.props["data-act"]==="persona-guardar");assert.equal(guardar.props.disabled,false);
  const sinEscribir=()=>{assert.equal(escrituras.length,0);assert.equal(estado,original);assert.deepEqual(plain(original),foto);};
  let alarma;
  try{
    await Promise.race([(async()=>{
      guardar.props.onClick();
      const primera=await siguiente();assert.equal(preguntas.length,1);assert.equal(primera.opciones.sub,dx.name);
      assert.equal(primera.opciones.value,"340");assert.match(primera.opciones.title,/340,00/);sinEscribir();
      primera.responder("340");
      const segunda=await siguiente();assert.equal(preguntas.length,2);assert.equal(segunda.opciones.sub,dy.name);
      assert.equal(segunda.opciones.value,"200");assert.match(segunda.opciones.title,/160,00/);sinEscribir();
      segunda.responder(cancelarSegunda?null:"200");await cerrado;
    })(),new Promise((_,reject)=>{alarma=setTimeout(()=>reject(new Error("No terminó el guardado de dos deudas")),3000);})]);
  }finally{clearTimeout(alarma);}
  assert.equal(escrituras.length,1);assert.equal(preguntas.length,2);assert.deepEqual(plain(original),foto);
  const [a,b]=estado.debts;assert.equal(a.monthly,340);assert.equal(a.amort,undefined);
  if(cancelarSegunda) assert.deepEqual(plain(b),plain(dy),"La cancelada queda entera como estaba");
  else {assert.equal(b.monthly,160);assert.equal(b.amort,200);}
  assert.equal(estado.fixed[0].reparto[0].debtId,"dy");
  for(const [antes,despues,baja] of cancelarSegunda?[[dx,a,340]]:[[dx,a,340],[dy,b,200]]){
    assert.equal(cents(h.debtBalance(despues)),cents(h.debtBalance(antes)),"Saldo al céntimo intacto");
    assert.equal(despues.months,h.debtPaidCount(antes)+Math.ceil(cents(h.debtBalance(antes))/cents(baja)));
  }
  n++;console.log("R164 dos deudas: "+(cancelarSegunda?"cancelar segunda conserva primera aceptada":"aceptar ambas")+", una escritura final OK");
}
await dosDeudasJuntas(false);
await dosDeudasJuntas(true);
assert.ok(n>0,"No se ejecutó ningún caso");
console.log("deudas-lo-descuento: "+n+" casos OK ("+(process.env.TZ||"TZ local")+")");
