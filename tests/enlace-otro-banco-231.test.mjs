// SU PRUEBA DE LA 4.26.231 (13/11/2026), con nombres y cifras inventados (nunca los de la cartera real).
// Una entrada «YouTube y móvil <persona>» de 15 € puesta en Trade Republic; la persona debe 5 + 10 en
// «Te deben»; le paga 15 € en SABADELL, con su nombre largo («Noraida …» cuando él la llama «Nora») y el
// banco escribe «ABONO TRANSFERENCIA». Antes: el selector solo enseñaba Trade Republic, nada casaba solo
// y «Te deben» seguía «pendiente». Cada mutante del motor (08) tiene que tumbar al menos un caso.
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8").replaceAll("\r\n","\n");
const order=JSON.parse(source("src/build-order.json"));
const shell=source("src/shell.html");
const reloj={ms:0};
const cargar=(cambiar)=>{
  const c=loadPureLogic(shell.replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>{
    const s=source("src/modules/"+f); return f==="08-motor-bank.js"&&cambiar?cambiar(s):s; }).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
  return c;
};
reloj.ms=Date.parse("2026-11-13T12:00:00Z");
const Y=2026, M=11, HOY=13, copia=x=>JSON.parse(JSON.stringify(x));
const fila=(id,ent,date,amount,merchant,extra)=>Object.assign({id,ent,date,amount,merchant,source:"ob",status:"BOOK",category:amount<0?"ingreso":"otros"},extra||{});
const VID={id:"vid",name:"Vídeo",amount:10,bankAmount:15,freq:"mes",day:2,account:"sabadell",reparto:[{id:"pe_nora",n:"Nora",via:"transfer",amt:5}]};
const TEL={id:"tel",name:"Móvil",amount:20,bankAmount:30,freq:"mes",day:4,account:"sabadell",reparto:[{id:"pe_nora",n:"Nora",via:"transfer",amt:10}]};
const ENT={id:"ent",kind:"income",name:"Vídeo y móvil Nora",amount:15,to:"trade_republic",day:1};
const PAGO=fila("p1","sabadell","2026-11-06",-15,"Noraida Ejemplo Prat",{note:"ABONO TRANSFERENCIA"});
const estado=(cambios)=>copia(Object.assign({
  accounts:[{id:"sab",ent:"sabadell",role:"fijos",value:1000},{id:"tr",ent:"trade_republic",role:"fijos",value:300}],
  fixed:[VID,TEL],debts:[],oneoffs:[],flows:[ENT],expenses:[],bankTx:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],
  settings:{profile:{fullName:"Leo Sastre Ruano"}},trasAbonoDesde:20261101
},cambios||{}));

function suite(c){
  const fallos=[];
  const caso=(nombre,fn)=>{ try{ fn(); }catch(e){ fallos.push(nombre+": "+e.message); } };
  const nora=s=>c.teDebenMes(s,Y,M,HOY).find(x=>x.id==="pe_nora");
  const fila_=(s,id)=>{ const p=c.planChargesMonth(s,M,Y,HOY); return p.flowsDone.concat(p.incomePending).find(x=>x.id==="flow_"+id); };
  const elegibles=(s,id)=>Array.from(c.flowFilasElegibles(s,s.flows.find(f=>f.id===id),Y,M,HOY),x=>x.id);
  const mostrado=(s,ent)=>{ const a=s.accounts.find(x=>x.ent===ent), i=c.insumosSaldoGasto(s);
    return Math.round(c.saldoCuentaMostrada(a,{injTR:i.injTR,spentByBank:i.spentByBank,paidNetByBank:i.paidNetByBank,roundup:i.roundup,monthlyInvest:i.monthlyInvest})*100)/100; };

  caso("E1 · su caso: el pago exacto en otro banco, con su nombre largo y «ABONO», deja las dos hechas",()=>{
    const s=estado({expenses:[PAGO]});
    assert.ok(elegibles(s,"ent").includes("p1"),"se puede elegir aunque sea de otro banco");
    assert.equal(nora(s).pagado,true,"«Te deben» lo coge solo"); assert.deepEqual([...nora(s).ingresos],["p1"]);
    assert.equal(fila_(s,"ent").expenseId,"p1","y la entrada gemela, con ESE movimiento");
  });
  caso("E2 · una entrada que no es de nadie: el importe exacto de otro banco se elige a mano, no solo, y no ancla",()=>{
    const CLASES={id:"cla",kind:"income",name:"Clases",amount:20,to:"trade_republic",day:10};
    const s=estado({fixed:[],flows:[CLASES],expenses:[fila("a1","sabadell","2026-11-09",-20,"ACADEMIA EJEMPLO")]});
    assert.deepEqual(elegibles(s,"cla"),["a1"]);
    assert.equal(fila_(s,"cla").expenseId,null,"no casa solo");
    const n=c.flowEnlazar(s,"cla","a1",Y,M,HOY,1);
    assert.equal(fila_(n,"cla").expenseId,"a1");
    assert.equal(n.flows[0].paidYm,undefined,"no es el banco que lo recibe: no ancla");
    assert.equal(mostrado(n,"trade_republic"),mostrado(s,"trade_republic")); assert.equal(mostrado(n,"sabadell"),mostrado(s,"sabadell"));
  });
  caso("E3 · de otro banco y de otra cifra no sale",()=>{
    assert.deepEqual(elegibles(estado({flows:[Object.assign({},ENT,{name:"Clases"})],fixed:[],expenses:[fila("a1","sabadell","2026-11-06",-14,"ACADEMIA")]}),"ent"),[]);
  });
  caso("E4 · el nombre abreviado solo con el importe exacto y sin otra persona que case igual",()=>{
    const otra=Object.assign({},VID,{id:"vid2",reparto:[{id:"pe_nor",n:"Nor",via:"transfer",amt:15}],bankAmount:25});
    assert.equal(nora(estado({fixed:[VID,TEL,otra],expenses:[PAGO]})).pagado,false,"«Nor» también es principio de «Noraida»: no se sabe");
    const catorce=Object.assign({},PAGO,{amount:-14});
    assert.equal(nora(estado({expenses:[catorce]})).recibido,0,"14 € no es lo que debe ni una de sus partes");
    const diez=Object.assign({},PAGO,{amount:-10});
    assert.equal(nora(estado({flows:[],expenses:[diez]})).recibido,10,"10 € es una de sus partes");
  });
  caso("E5 · «ABONO» a secas es una transferencia; una devolución no",()=>{
    const s=estado({flows:[],expenses:[fila("b1","sabadell","2026-11-06",-15,"TRANSFERENCIA NORA EJEMPLO",{note:"ABONO TRANSFERENCIA"})]});
    assert.equal(nora(s).pagado,true);
    const d=estado({flows:[],expenses:[fila("b1","sabadell","2026-11-06",-15,"DEVOLUCION BIZUM NORA EJEMPLO")]});
    assert.equal(nora(d).pagado,false);
  });
  caso("E6 · 15 € de cualquiera en otro banco no los coge sola la gemela, ni pagan a la persona",()=>{
    const s=estado({expenses:[fila("x1","sabadell","2026-11-06",-15,"BIZUM DE OTRA GENTE")]});
    assert.ok(elegibles(s,"ent").includes("x1"),"se puede elegir a mano");
    assert.equal(fila_(s,"ent").expenseId,null);
    assert.equal(nora(s).pagado,false);
  });
  /* ---------- Re-revisión de la 231 ---------- */
  const persona=(id,n,amt)=>({id:"r_"+id,name:"Recibo "+n,amount:10,bankAmount:10+amt,freq:"mes",day:2,account:"sabadell",reparto:[{id,n,via:"transfer",amt}]});
  const debe=(s,id)=>c.teDebenMes(s,Y,M,HOY).find(x=>x.id===id);
  caso("F1 · el nombre abreviado no casa con comercios, empresas, otra gente ni sin transferencia",()=>{
    const solo=(n,merchant,extra)=>estado({fixed:[persona("pe_x",n,5)],flows:[],expenses:[fila("z1","sabadell","2026-11-06",-5,merchant,Object.assign({concept:"TRANSFERENCIA"},extra||{}))]});
    assert.equal(debe(solo("Mar","MARKETPLACE EJEMPLO SL"),"pe_x").recibido,0,"empresa");
    assert.equal(debe(solo("Mar","Maria Lopez Gil"),"pe_x").recibido,0,"otra persona: María no es Mar");
    assert.equal(debe(solo("Pol","POLONIA TRAVEL"),"pe_x").recibido,0,"comercio");
    assert.equal(debe(solo("Sol","SOLRED SA",{concept:"ABONO"}),"pe_x").recibido,0,"reembolso de combustible");
    assert.equal(debe(solo("Nora","Noraida Prat"),"pe_x").recibido,0,"sin dos apellidos");
    assert.equal(debe(solo("Nora","Noraida Ejemplo Prat",{concept:"INGRESO EFECTIVO"}),"pe_x").recibido,0,"no es transferencia ni Bizum");
    assert.equal(debe(solo("Nora","Noraida Ejemplo Prat"),"pe_x").recibido,5,"y con todo en regla, sí");
  });
  caso("F2 · lo que él enlaza a la gemela le enseña el nombre: desde ahí casa por alias",()=>{
    const ENT2={id:"en2",kind:"income",name:"Vídeo Nana",amount:5,to:"trade_republic",day:1};
    const fx=persona("pe_nana","Nana",5), pago=fila("z1","sabadell","2026-11-06",-5,"Noraida Ejemplo Prat",{note:"ABONO TRANSFERENCIA"});
    const s=estado({fixed:[fx],flows:[ENT2],expenses:[pago]});
    assert.equal(debe(s,"pe_nana").recibido,0,"«Nana» no es principio de «Noraida»");
    const a=c.debenAprenderAlias(s,"pe_nana",pago,true,1);
    assert.equal(debe(a,"pe_nana").pagado,true,"con el alias, sí");
    // El mes siguiente también, y otro nombre no.
    const dic=Object.assign({},a,{expenses:[fila("z2","sabadell","2026-12-05",-5,"Noraida Ejemplo Prat",{note:"ABONO TRANSFERENCIA"}),fila("z3","sabadell","2026-12-05",-5,"Otra Ejemplo Prat",{note:"ABONO TRANSFERENCIA"})]});
    const d=c.teDebenMes(dic,Y,12,10).find(x=>x.id==="pe_nana");
    assert.deepEqual([...d.ingresos],["z2"]);
    assert.equal(debe(c.debenAprenderAlias(a,"pe_nana",pago,false,2),"pe_nana").recibido,0,"y olvidarlo lo quita");
    assert.equal(c.debenAprenderAlias(s,"pe_nana",fila("z4","sabadell","2026-11-06",-5,"BIZUM RECIBIDO"),true,1),s,"un texto genérico no es un alias");
    // El mismo alias en dos personas no decide.
    const ambas=c.debenAprenderAlias(Object.assign({},a,{fixed:[fx,persona("pe_otra","Otra",5)]}),"pe_otra",pago,true,3);
    assert.equal(debe(ambas,"pe_nana").recibido,0);
  });
  caso("F3 · un movimiento, una cosa: la entrada de otro banco no se queda el pago que «Te deben» da a la persona",()=>{
    const GEM={id:"gem",kind:"income",name:"Vídeo Nora",amount:5,to:"trade_republic",day:1};
    const CLA={id:"cla",kind:"income",name:"Clases",amount:5,to:"sabadell",day:6};
    const s=estado({fixed:[persona("pe_nora","Nora",5)],flows:[GEM,CLA],expenses:[fila("p1","sabadell","2026-11-06",-5,"Noraida Ejemplo Prat",{note:"ABONO TRANSFERENCIA"})]});
    assert.equal(debe(s,"pe_nora").pagado,true);
    assert.equal(fila_(s,"gem").expenseId,"p1");
    assert.equal(fila_(s,"cla").expenseId,null,"«Clases» no lo coge también");
  });
  caso("F4 · lo que no es un pago aunque diga «abono»",()=>{
    const s=t=>estado({flows:[],expenses:[fila("b1","sabadell","2026-11-06",-15,t)]});
    for(const t of ["ABONO RETROCESO BIZUM NORA EJEMPLO","ABONO PROMOCION NORA EJEMPLO","BIZUM RECHAZADO NORA EJEMPLO","ABONO BONIFICACION NORA EJEMPLO","TRANSFERENCIA CANCELADA NORA EJEMPLO"])
      assert.equal(nora(s(t)).recibido,0,t);
    assert.equal(nora(s("ABONO TRANSFERENCIA NORA EJEMPLO")).pagado,true);
  });
  return fallos;
}

const reales=suite(cargar());
assert.deepEqual(reales,[],"el motor de verdad pasa todos los casos");
console.log("enlace-otro-banco-231: casos OK");

const MUTANTES=[
  ["solo el banco de la entrada",'flowFilaLibre(x,deleted)&&flowFilaEncajaO(f,x)) out.push(x);\n  });\n  const planned','flowFilaLibre(x,deleted)&&flowFilaEncaja(f,x)) out.push(x);\n  });\n  const planned'],
  ["otro banco con cualquier importe",'&&Math.round(-a*100)===Math.round(Number(f.amount)*100);','&&true;'],
  ["la entrada coge sola de otro banco sin que nombre a su persona",'\n    &&(flowFilaEncaja(f,x)||!!gem&&debenNombra(s,gem,x,ps))',''],
  ["«abono» vuelve a ser devolución",'devuelta|reembolso','devuelta|abono|reembolso'],
  ["sin nombre abreviado",'q[0].indexOf(w[0])===0','false'],
  ["nombre abreviado con cualquier importe",'!(c===p.c||(p.partes||[]).indexOf(c)>=0)','false'],
  ["nombre abreviado sin transferencia ni Bizum",'if(!TRASPASO_PALABRA.test(txt)&&!/ bizum /.test(txt)) return false;',''],
  ["nombre abreviado sin apellidos",'return q.length>=3&&q[0]','return q[0]'],
  ["nombre abreviado de una empresa",'&&debenPersonaFisica(q.join(" "))',''],
  ["nombre abreviado que es otro nombre de pila",'&&!DEBEN_NOMBRES.has(q[0])',''],
  ["sin alias",'return debenAliasDe(s,o.id).indexOf(pag)>=0||','return '],
  ["alias de cualquier texto",'if(!pid||!debenAliasValido(a)) return s;','if(!pid) return s;'],
  ["la otra entrada no aparta el pago de la persona por su nombre abreviado",'return !!w&&debenNombra(s,p,x,ps)','return !!w&&w.every(function(k){ return txt.indexOf(" "+k+" ")>=0; })'],
  ["«retroceso», «promoción»… vuelven a ser pagos",'|retroceso|rechazo|rechazado|rechazada|cancelado|cancelada|cancelacion|','|'],
  ["«bonificación» vuelve a ser pago",'|promocion|bonificacion|','|promocion|'],
];
let muertos=0;
for(const [nombre,de,a] of MUTANTES){
  const c=cargar(s=>{ assert.ok(s.includes(de),"el mutante «"+nombre+"» encuentra su fragmento"); return s.replace(de,a); });
  assert.ok(suite(c).length>0,"mutante vivo: "+nombre);
  muertos++;
}
console.log("enlace-otro-banco-231: "+muertos+" mutantes detectados");
