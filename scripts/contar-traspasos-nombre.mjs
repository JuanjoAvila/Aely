#!/usr/bin/env node
/**
 * ¿CUÁNTOS GASTOS CONVIRTIÓ EN TRASPASO LA REGLA DEL NOMBRE? (revisión externa del 15/11/2026, ALTA)
 *
 * Del 12/11 (230) a la 234, `salidasTraspasoPropio` pasaba a «traspaso» —y subía a la nube— una
 * salida con el nombre del titular en CUALQUIER texto (también de ordenante o en la nota) y a un 2 %
 * de un traspaso previsto. La 234 lo deja en beneficiario = titular entero y al céntimo, o la otra pata.
 *
 * ESTO SOLO CUENTA. No escribe nada, ni en la nube ni en ningún fichero. La limpieza, si la hay, va
 * aparte y con el OK del dueño.
 *
 * ⚠ No hay marca que separe lo que puso la regla de lo que él marcó a mano: las dos escriben solo
 * `cat:"traspaso"` (y `catAckAt` se suelta al asentarse). Así que una «sospechosa» es una fila que la
 * regla VIEJA marcaba y la NUEVA no: pudo ponerla la regla o él. Por eso se revisan una a una.
 *
 * Las dos reglas salen del MISMO motor en dos momentos (`git show <commit>` contra el de ahora), como
 * en `recat-una-vez.mjs`: ninguna copia de la lógica aquí.
 *
 * Uso:  node scripts/contar-traspasos-nombre.mjs [--viejo=0184ef82c] [--desde=2026-10-24] [--ids]
 *       Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local. Sin --ids solo saca números.
 *       ⚠ Con --ids saca ids, fechas e importes SUYOS: para mirar y ya, nunca al repo (es PÚBLICO).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogic } from "./load-pure-logic.mjs";

const TRANSFER=/ (transferencia|transferencias|transfer|traspaso|traspasos|transf) /;

/* `nuevo` y `viejo`: el motor de ahora y el de antes de la 234, los dos leyendo la hora de `reloj.ms`.
   Revisadas = salidas de banco ya en «traspaso» que el banco llama transferencia, desde `desde` (la
   regla solo tocaba el mes en curso y los 7 últimos días del anterior: lo de antes no pudo ser ella). */
export function contarTraspasosPorNombre(nuevo, viejo, s, o){
  const desde=String(o&&o.desde||"2026-10-24"), reloj=o&&o.reloj, horaAntes=reloj&&reloj.ms;
  const out={ revisadas:0, sospechosas:[], conPrueba:[] };
  const exps=(s&&s.expenses)||[];
  try{
    exps.forEach(function(e){
      if(!e||e.category!=="traspaso"||!nuevo.esFilaDeBanco(e)||!(Number(e.amount)>0)||String(e.date).slice(0,10)<desde) return;
      if(e.withdrawalConfirmedAt) return;   // retirada de efectivo que él confirmó: otra puerta
      if(!TRANSFER.test(" "+nuevo.recNorm([e.merchant,e.obName,e.concept,e.note].join(" "))+" ")) return;
      out.revisadas++;
      // La misma fila como estaba antes de marcarla, el día de su movimiento: ¿la marcaba cada regla?
      const fuera=Object.assign({},e,{category:"otros"}); delete fuera.catStale; delete fuera.catAckAt;
      const sim=Object.assign({},s,{expenses:exps.map(function(x){ return x===e?fuera:x; })});
      if(reloj) reloj.ms=Date.parse(String(e.date).slice(0,10)+"T12:00:00Z");
      const marca=function(c){ return c.salidasTraspasoPropio(sim).some(function(x){ return x.id===e.id; }); };
      if(!marca(viejo)) return;
      const fila={ id:e.id, date:String(e.date).slice(0,10), amount:Number(e.amount), bank:nuevo.expenseBankOf(e) };
      (marca(nuevo)?out.conPrueba:out.sospechosas).push(fila);
    });
  } finally { if(reloj) reloj.ms=horaAntes; }
  return out;
}

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function motor(leer, reloj){
  const order=JSON.parse(leer("src/build-order.json"));
  const c=loadPureLogic(leer("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>leer("src/modules/"+f)).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
  return c;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const arg=(k,d)=>{ const a=process.argv.find(x=>x.startsWith("--"+k+"=")); return a?a.slice(k.length+3):d; };
  const viejoRev=arg("viejo","0184ef82c"), desde=arg("desde","2026-10-24"), ids=process.argv.includes("--ids");
  const env={};
  const f=path.join(root,".env.local");
  if(fs.existsSync(f)) for(const line of fs.readFileSync(f,"utf8").split(/\r?\n/)){ const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,""); }
  const KEY=Object.assign(env,process.env).SUPABASE_SERVICE_ROLE_KEY;
  if(!KEY){ console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }
  const BASE="https://sfyfjagbnhbplrljpbvh.supabase.co";
  const api=async p=>{ const r=await fetch(BASE+"/rest/v1/"+p,{headers:{apikey:KEY,Authorization:"Bearer "+KEY}}); if(!r.ok){ console.error("HTTP "+r.status+" en "+p); process.exit(1); } return r.json(); };
  const reloj={ms:Date.now()};
  const nuevo=motor(p=>fs.readFileSync(path.join(root,p),"utf8").replaceAll("\r\n","\n"),reloj);
  const viejo=motor(p=>execFileSync("git",["show",viejoRev+":"+p],{cwd:root,encoding:"utf8",maxBuffer:64<<20}).replaceAll("\r\n","\n"),reloj);
  for(const {user_id,data} of await api("app_state?select=user_id,data")){
    const filas=await api("expenses?select=*&user_id=eq."+user_id+"&fecha=gte."+desde+"T00:00:00Z&order=fecha.asc");
    if(!filas.length) continue;
    const s=Object.assign({},data,{expenses:filas.map(r=>nuevo.expenseFromRow(r))});
    const r=contarTraspasosPorNombre(nuevo,viejo,s,{desde,reloj});
    console.log("usuario "+String(user_id).slice(0,8)+"…: "+r.revisadas+" salidas en traspaso revisadas · "+r.sospechosas.length+" sospechosas (la regla vieja sí, la nueva no) · "+r.conPrueba.length+" con prueba fuerte");
    if(ids) r.sospechosas.forEach(x=>console.log("   "+x.id+"  "+x.date+"  "+x.amount.toFixed(2)+"  "+x.bank));
  }
}
