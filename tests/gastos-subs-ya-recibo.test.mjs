// Gastos no propone como suscripción «por revisar» lo que ya es un recibo (beta 4.26.227,
// 11/11/2026): el recibo «Agua» de Plan tenía su cargo del mes enlazado y el banco lo cobraba con
// el nombre del acreedor; el detector, que solo comparaba nombres, lo sacaba en la bandeja y
// «Pasar a Recibos» habría creado el recibo otra vez. La regla es la del motor de pagos
// (`cargoDeRecibo`, `paymentEvidenceUI`) más el nombre exacto; compartir una palabra no basta
// (NO-GO de la revisión de dinero del 11/11: escondía suscripciones reales). «Visto en tu banco»
// (Recibos) conserva su regla de nombre de siempre y añade solo la exclusión por enlace. Datos inventados.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const order=JSON.parse(read("src/build-order.json"));
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>read("src/modules/"+f)).join("\n")));
vm.runInNewContext(read("src/modules/14-v4-screens.js"),c);
const AHORA=new Date("2026-09-30T12:00:00+02:00").getTime();
c.Date=class extends Date { constructor(...a){ super(...(a.length?a:[AHORA])); } static now(){ return AHORA; } };

const agua={id:"agua",name:"Agua",amount:41.20,freq:"mes",day:8,account:"sabadell"};
const fila=(id,date,p)=>Object.assign({id,date,amount:41.20,merchant:"HIDRICAS SINTETICAS SA",category:"hogar",source:"ob",ent:"sabadell",status:"BOOK"},p);
// Tres meses sin marcar (forman la «suscripción») y el de este mes, cobrado el 10 (el recibo es el 8).
const antes=[fila("a6","2026-06-10"),fila("a7","2026-07-10"),fila("a8","2026-08-10")];
const control=["2026-07-14","2026-08-14","2026-09-14"].map((d,i)=>fila("nf"+i,d,{amount:9.99,merchant:"STREAMING SINTETICO",category:"ocio",ent:"revolut"}));
const estado=p=>Object.assign({accounts:[{id:"sb",ent:"sabadell",role:"fijos",value:900},{id:"rv",ent:"revolut",role:"diario",value:300}],
  fixed:[agua],bankTx:[],debts:[],oneoffs:[],flows:[],goals:[],expenses:[]},p);
const porRevisar=s=>{
  const subs=c.detectSubscriptions(s.expenses).filter(x=>x.active), keys=c.subsDeRecibos(s);
  return [...subs.filter(sp=>!c.subEsRecibo(s,sp,keys)).map(sp=>sp.name)].sort();
};

test("el cargo de este mes enlazado al recibo: el comercio ya es recibo",()=>{
  const s=estado({expenses:antes.concat(fila("a9","2026-09-10",{reciboId:"agua"}),control)});
  // Sin la regla, los meses de antes siguen formando la suscripción: es el fallo que vio.
  assert.ok(c.detectSubscriptions(s.expenses).some(x=>x.name==="HIDRICAS SINTETICAS SA"),"premisa: el detector la ve");
  assert.equal(c.subsDeRecibos(s).has(c.catKey("HIDRICAS SINTETICAS SA")),true);
  assert.deepEqual(porRevisar(s),["STREAMING SINTETICO"]);
});

test("sin marca, pagado por el motor con el adeudo del banco (día 10 frente al 8): también es recibo",()=>{
  const cargo=fila("a9","2026-09-10",{concept:"ADEUDO RECIBO SEPA"});
  const s=estado({expenses:antes.concat(cargo,control),bankTx:[{id:"t9",ent:"sabadell",date:"2026-09-10",amount:41.20,merchant:"HIDRICAS SINTETICAS SA",concept:"ADEUDO RECIBO SEPA",status:"BOOK"}]});
  assert.equal(c.fixedPaymentState(s,agua,2026,9,30).paid,true,"premisa: Recibos lo da por pagado");
  assert.deepEqual(porRevisar(s),["STREAMING SINTETICO"]);
});

test("marca a un recibo borrado o vetado («No es este recibo»): vuelve a proponerse",()=>{
  const sinRecibo=estado({fixed:[],expenses:antes.concat(fila("a9","2026-09-10",{reciboId:"agua"}),control)});
  assert.deepEqual(porRevisar(sinRecibo),["HIDRICAS SINTETICAS SA","STREAMING SINTETICO"]);
  const marcada=fila("a9","2026-09-10",{reciboId:"agua"});
  const vetada=estado({expenses:antes.concat(marcada,control)});
  const r=c.quitarCargoDeRecibo(vetada,"a9");
  assert.ok(r,"premisa: se puede desenlazar");
  assert.deepEqual(porRevisar(r.state),["HIDRICAS SINTETICAS SA","STREAMING SINTETICO"]);
});

test("nombre exacto del recibo: no se propone; sin enlace ni nombre, sí",()=>{
  const s=estado({fixed:[Object.assign({},agua,{name:"Hidricas Sinteticas SA",amount:60})],expenses:antes.concat(control)});
  assert.deepEqual(porRevisar(s),["STREAMING SINTETICO"]);
  const sinNada=estado({expenses:antes.concat(control)});
  assert.deepEqual(porRevisar(sinNada),["HIDRICAS SINTETICAS SA","STREAMING SINTETICO"],"sin enlace ni nombre, es una propuesta");
});

test("compartir una palabra con un recibo NO la esconde: siguen saliendo y contando",()=>{
  const rec=(id,name,amount)=>({id,name,amount,freq:"mes",day:3,account:"sabadell"});
  const serie=(p,merchant,amount)=>["2026-07-20","2026-08-20","2026-09-20"].map((d,i)=>fila(p+i,d,{amount,merchant,category:"ocio",ent:"revolut"}));
  const s=estado({fixed:[rec("g1","Google One",1.99),rec("am","Amazon Prime",4.99),rec("ca","Casa",300)],
    expenses:serie("yt","GOOGLE *YOUTUBEPREMIUM",13.99).concat(serie("mu","AMAZON MUSIC",10.99),serie("cl","CASA DEL LIBRO CLUB",7.5))});
  assert.deepEqual(porRevisar(s),["AMAZON MUSIC","CASA DEL LIBRO CLUB","GOOGLE *YOUTUBEPREMIUM"]);
});

const vistos=s=>[...c.rp4VistoEnBanco(s,0).map(x=>x.name)].sort();
test("«Visto en tu banco»: un cargo enlazado con otro nombre no sale; su regla de nombre sigue igual",()=>{
  assert.deepEqual(vistos(estado({expenses:antes.concat(control)})),["HIDRICAS SINTETICAS SA","STREAMING SINTETICO"],"premisa: sin enlace sale");
  assert.deepEqual(vistos(estado({expenses:antes.concat(fila("a9","2026-09-10",{reciboId:"agua"}),control)})),["STREAMING SINTETICO"],"marcado");
  const sinMarca=estado({expenses:antes.concat(fila("a9","2026-09-10",{concept:"ADEUDO RECIBO SEPA"}),control),
    bankTx:[{id:"t9",ent:"sabadell",date:"2026-09-10",amount:41.20,merchant:"HIDRICAS SINTETICAS SA",concept:"ADEUDO RECIBO SEPA",status:"BOOK"}]});
  assert.deepEqual(vistos(sinMarca),["STREAMING SINTETICO"],"pagado por el motor");
  // Aquí compartir palabra sí esconde, como antes de este arreglo (solo propone recibos nuevos).
  assert.deepEqual(vistos(estado({fixed:[Object.assign({},agua,{name:"Hidricas",amount:60})],expenses:antes.concat(control)})),["STREAMING SINTETICO"]);
});
