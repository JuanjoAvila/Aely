#!/usr/bin/env node
/**
 * ¿CUÁNTAS DEUDAS CAMBIAN DE SALDO CON LA 234? (revisión de dinero 234, aviso H-A3)
 *
 * La 234 pone tope a las cuotas pagadas (`debtPaidCount` ≤ plazo) y hace que la última absorba el
 * redondeo. Lo normal es que solo se muevan céntimos (600,03 en 12 ya no se queda en 0,03 debidos).
 * Pero una deuda heredada cuyo plazo no cubría lo que se debía (1.000 en 8 cuotas de 100) antes
 * seguía bajando sola pasado el plazo, sin ningún cobro, hasta 0; ahora se queda en lo que faltaba
 * (200) para siempre. Eso sube Deudas y baja el patrimonio de hoy y del histórico. Esto cuenta cuántas.
 *
 * ESTO SOLO CUENTA. No escribe nada, ni en la nube ni en ningún fichero.
 *
 * Los dos saldos salen del MISMO motor en dos momentos (`git show <commit>` contra el de ahora), como
 * en `contar-traspasos-nombre.mjs`: ninguna copia de la lógica aquí.
 *
 * Uso:  node scripts/contar-deudas-234.mjs [--viejo=0184ef82c] [--detalle]
 *       Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local (o en el entorno). Sin --detalle solo saca
 *       números por usuario: deudas, cuántas cambian, cuántas pasan de 0 a deber algo y la diferencia
 *       total de hoy redondeada a decenas de euros.
 *       ⚠ Con --detalle saca, por deuda (sin nombre), el saldo viejo y nuevo y su plazo: importes
 *       SUYOS para mirar y ya, nunca al repo (es PÚBLICO).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogic } from "./load-pure-logic.mjs";

/* `nuevo` y `viejo`: el motor de ahora y el de antes de la 234, los dos leyendo la hora de `reloj.ms`.
   Una deuda «cambia» si su saldo de hoy difiere en más de medio céntimo. */
export function contarDeudas234(nuevo, viejo, s){
  const out={ total:0, cambian:0, deCeroAPositivo:0, diferencia:0, detalle:[] };
  ((s&&s.debts)||[]).forEach(function(d){
    if(!d) return;
    out.total++;
    const antes=Number(viejo.debtBalance(d))||0, ahora=Number(nuevo.debtBalance(d))||0;
    if(Math.abs(ahora-antes)<=0.005) return;
    out.cambian++;
    if(antes<=0.005&&ahora>0.005) out.deCeroAPositivo++;
    out.diferencia+=ahora-antes;
    out.detalle.push({ viejo:+antes.toFixed(2), nuevo:+ahora.toFixed(2), plazo:d.months==null?null:d.months,
      vencidas:d.months==null?null:(nuevo.debtCuotasDesdeAncla?nuevo.debtCuotasDesdeAncla(d):null) });
  });
  return out;
}
// Decenas de euros: la cifra que se enseña sin detalle no dice importes al céntimo.
export const enDecenas=x=>Math.round((Number(x)||0)/10)*10;

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function motor(leer, reloj){
  const order=JSON.parse(leer("src/build-order.json"));
  const c=loadPureLogic(leer("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>leer("src/modules/"+f)).join("\n")));
  c.Date=class extends Date{ constructor(...a){ super(...(a.length?a:[reloj.ms])); } static now(){ return reloj.ms; } };
  return c;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const arg=(k,d)=>{ const a=process.argv.find(x=>x.startsWith("--"+k+"=")); return a?a.slice(k.length+3):d; };
  const viejoRev=arg("viejo","0184ef82c"), detalle=process.argv.includes("--detalle");
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
    const r=contarDeudas234(nuevo,viejo,data||{});
    if(!r.total) continue;
    console.log("usuario "+String(user_id).slice(0,8)+"…: "+r.total+" deudas · "+r.cambian+" cambian de saldo hoy · "+r.deCeroAPositivo+" pasan de 0 a deber · diferencia total hoy ≈ "+enDecenas(r.diferencia)+" €");
    if(detalle) r.detalle.forEach(x=>console.log("   viejo "+x.viejo.toFixed(2)+" → nuevo "+x.nuevo.toFixed(2)+" · plazo "+x.plazo+" · vencidas "+x.vencidas));
  }
}
