/* ============================================================
   PLAN › REPARTO DEL PERIODO (A dónde va tu sueldo) — motor puro
   Prototipo aprobado por el dueño: coord-notas/diseno-deudas-metas/prototipo.html.
   TODO en céntimos enteros y cada euro en UN solo trozo:
     Recibos · Deudas · Metas · Ahorro · Gastos · Libre = lo que entra.
   Respeta el mes natural y «Mi ciclo» (`repPeriodo`). Nada de esto se escribe en el estado: se
   calcula al vuelo, así que apagar el interruptor devuelve cada cifra a como estaba.
   ============================================================ */
const REP_DIAS_ENTRADA_PREVIA=120;
const repCts=function(x){ return Math.round((Number(x)||0)*100); };
const repDiasDe=function(y,m){ return new Date(y,m,0).getDate(); };
/* La ventana del periodo. Mes natural: día 1 de Madrid → día 1 siguiente. «Mi ciclo»: del cobro de la
   nómina al mismo día del mes siguiente. `meses` son los meses de calendario que toca: los recibos y
   las cuotas son de calendario, y en un ciclo caen en dos. */
function repPeriodoDe(startMs, cycleStart, nowMs){
  const now=nowMs!=null?nowMs:Date.now(), hoy=madridYmdParts(now);
  if(cycleStart){
    const sy=cycleStart.getFullYear(), sm=cycleStart.getMonth()+1, sd=cycleStart.getDate();
    const em0=sm%12, ey=sy+(sm===12?1:0), em=em0+1, ed=Math.min(sd,repDiasDe(ey,em));
    const endMs=new Date(ey,em-1,ed).getTime();
    const tomorrow=new Date(now); tomorrow.setHours(24,0,0,0);
    return {cycle:true,startMs:startMs,endMs:endMs,gastoEndMs:Math.min(endMs,tomorrow.getTime()),hoy:hoy,
      meses:[{y:sy,m:sm},{y:ey,m:em}],ini:{y:sy,m:sm,d:sd},fin:{y:ey,m:em,d:ed}};
  }
  const p=madridYmdParts(startMs+12*3600000), endMs=inicioDeMesMs(startMs+35*864e5);
  return {cycle:false,startMs:startMs,endMs:endMs,gastoEndMs:endMs,hoy:hoy,meses:[{y:p.y,m:p.m}],ini:null,fin:null,y:p.y,m:p.m};
}
function repPeriodo(state, nowMs){
  const now=nowMs!=null?nowMs:Date.now();
  const payday=state&&state.settings&&state.settings.budgetCycle?budgetPaydayOf(state,now):null;
  return payday?repPeriodoDe(payday.start.getTime(),payday.start,now):repPeriodoDe(inicioDeMesMs(now),null,now);
}
/* ¿Cae este cargo (año, mes 1-12, día o null) dentro del periodo? Un cargo sin día se cuenta en el
   periodo que contiene el día 1 de su mes: una sola vez por mes, nunca en dos ciclos. */
function repEnPeriodo(P, y, m, day){
  if(!P.cycle) return y===P.y && m===P.m;
  const k=function(yy,mm,dd){ return (yy*12+mm-1)*32+dd; };
  const dd=day==null?1:Math.min(day,repDiasDe(y,m));
  const v=k(y,m,dd);
  return v>=k(P.ini.y,P.ini.m,P.ini.d) && v<k(P.fin.y,P.fin.m,P.fin.d);
}
// «Hoy» de cada mes para el motor de recibos: el actual, el que ya pasó entero, o el que aún no ha llegado.
function repHoyDe(P, y, m){
  const a=y*12+m, b=P.hoy.y*12+P.hoy.m;
  return a===b?P.hoy.d:(a<b?31:0);
}
/* Lo que una deuda cuesta de TU bolsillo ese mes (céntimos): lo que sale del banco (`debtCuotaIn`) MÁS lo
   que descuentas de un recibo compartido (`deudaDescuentoMes`: ese dinero también es tuyo, solo que sale
   del banco dentro del recibo). Es la misma cifra que cuenta la fila de la deuda en Recibos («pagas 197 € + 53 €
   de Pepephone» = 250) y lo que cuenta «Queda por pagar». Restar el descuento en vez de sumarlo dejaría fuera
   del reparto dinero que sí sale (197 − 53 = 144 cuando de verdad se pagan 250). Con el recibo, que cuenta SOLO
   tu parte, cada euro queda en un solo trozo: recibo 90 € (50 tuyos) + cuota 260 € = 50 + 300. */
function repCuotaPropia(state, d, y, m, today){
  const a=repCts(debtCuotaIn(d,y,m));
  if(!(a>0)) return {cuota:0,desc:0,propia:0};
  const desc=repCts(deudaDescuentoMes(state,d,y,m,today).amt);
  return {cuota:a,desc:desc,propia:a+desc};
}
/* Los cargos del banco que SON la cuota de una deuda pero siguen sin enlazar (`cuotasDeDeudaPorMarcar`
   es la misma regla que los enlaza). Cuentan como gastado hasta que alguien los marque; si además la
   cuota resta del presupuesto, restaría dos veces. Se guarda por referencia de gastos y deudas. */
const _repSinEnlazarMemo=new WeakMap();
function repCuotasSinEnlazar(state){
  const exps=(state&&state.expenses)||[];
  const k=[state&&state.debts,state&&state.cuotaNo,state&&state.cuotaAlias];
  const hit=_repSinEnlazarMemo.get(exps);
  if(hit&&hit.k.every(function(x,i){ return x===k[i]; })) return hit.m;
  const m=new Map();
  try{ (cuotasDeDeudaPorMarcar(state)||[]).forEach(function(a){ m.set(a.e,a.debtId); }); }catch(e){}
  _repSinEnlazarMemo.set(exps,{k:k,m:m});
  return m;
}
function repHayInterruptor(state){ return (state&&state.debts||[]).some(function(d){ return d&&d.restarPres===true; }); }
/* LA RESERVA DE CADA DEUDA, CALCULADA (céntimos): el interruptor «Restar del presupuesto» significa
   «mi presupuesto ya incluye esta cuota», así que en su periodo el límite de gastos baja lo que cuesta
   la cuota. NO se escribe en `reservaLog`: se deduce del plan cada vez, así apagarlo (o acabar la deuda)
   devuelve el presupuesto sin liberar nada a mano ni poder quedarse a medias. Solo la cuota (tu parte);
   el pago final no entra: no es una cuota que un presupuesto mensual vaya a incluir.
   → {total, porDeuda:{id:céntimos}} */
function reservaDeudasPeriodo(state, P){
  const out={total:0,porDeuda:{}};
  if(!repHayInterruptor(state)) return out;
  (state.debts||[]).forEach(function(d){
    if(!d||d.restarPres!==true) return;
    let c=0;
    P.meses.forEach(function(mm){
      if(!debtActiveIn(d,mm.y,mm.m)) return;
      const dy=cleanDay(dayOf(d));
      if(!repEnPeriodo(P,mm.y,mm.m,dy)) return;
      c+=repCuotaPropia(state,d,mm.y,mm.m,repHoyDe(P,mm.y,mm.m)).propia;
    });
    if(c>0){ out.porDeuda[d.id]=c; out.total+=c; }
  });
  return out;
}
/* Lo que `monthBudgetStats` necesita de todo esto: euros que restan del límite y las filas que no deben
   contar dos veces. Sin ningún interruptor encendido no toca nada (misma cifra que siempre). */
function reservaDeudasParaPresupuesto(state, startMs, cycleStart, nowMs){
  if(!repHayInterruptor(state)) return {euros:0,sinContar:null};
  const P=repPeriodoDe(startMs,cycleStart||null,nowMs);
  // Solo el periodo en curso o futuro: uno ya cerrado (meses pasados, racha, imagen de mes cerrado)
  // queda como sin el interruptor, porque las deudas de HOY no dicen lo que pasó entonces.
  // El reloj es el real: `nowMs` de un mes cerrado apunta a ese mes, no a hoy.
  if(P.endMs<=Date.now()) return {euros:0,sinContar:null};
  const r=reservaDeudasPeriodo(state,P);
  if(!(r.total>0)) return {euros:0,sinContar:null};
  const sin=new Set();
  repCuotasSinEnlazar(state).forEach(function(debtId,e){ if(r.porDeuda[debtId]>0) sin.add(e); });
  return {euros:r.total/100,sinContar:sin.size?sin:null};
}

const REP_DEVOLUCION_RE=/\b(devolucion|devoluciones|reembolso|retrocesion|anulacion|refund|chargeback|reversal|rechazo)\b/;
// Una devolución, o un Bizum recibido: el dinero vuelve a lo que gastaste, no es ingreso (misma idea que el límite de Gastos).
function repEsDevolucion(e){
  if(e.category==="bizum") return true;
  return REP_DEVOLUCION_RE.test(recNorm([e.merchant,e.note,e.concept,e.obName].join(" ")));
}
/* Los porcentajes del reparto: enteros que SIEMPRE suman 100, repartiendo los restos a los trozos con más
   decimales. La base es lo que entra; si falta dinero, la base es lo que hay que pagar (el total asignado):
   así cada trozo es su parte del plan y nunca se ve 236 % (sobre un sueldo de 1.500 se ven 3.539 de plan).
   Lo que falta se dice aparte, también sobre ese total (faltaP), y ya va dentro de los trozos. */
function repPorcentajes(trozos, entra, total, falta){
  if(!(entra>0)) return trozos.map(function(){ return null; });
  const base=falta&&total>0?total:entra, target=100;
  const raw=trozos.map(function(x){ return x.c*100/base; }), fl=raw.map(Math.floor);
  const resto=target-fl.reduce(function(p,q){ return p+q; },0);
  raw.map(function(x,i){ return [x-fl[i],i]; }).sort(function(p,q){ return q[0]-p[0]||p[1]-q[1]; })
    .slice(0,Math.max(0,resto)).forEach(function(p){ fl[p[1]]++; });
  return fl;
}
/* EL REPARTO. `o.saldo` (euros) es lo que hay en tus cuentas; sin él no se dice si «lo cubre».
   Devuelve céntimos en todo menos `saldo`/`queda`, que también lo son (`*C`). Invariante, probada en
   test: trozos + libre = entra, al céntimo, en todos los estados. */
function planReparto(state, o){
  o=o||{};
  state=state||{};
  const P=o.periodo||repPeriodo(state,o.nowMs), now=o.nowMs!=null?o.nowMs:Date.now();
  const delSet=expenseDeletedSet(state), flows=nominaFlowsOf(state);
  const viva=function(e){ return e&&!e.possibleDup&&!e.autoGemelo&&!expenseIsTombstoned(e,delSet); };
  const sinEnlazar=repCuotasSinEnlazar(state);
  /* ---- Entra, y lo que se gastó ---- */
  let entra=0, devolucion=0, traspaso=0, nominaLlego=false, gastado=0, metaGastos={}, inversion=0;
  const desdePrevio=P.startMs-REP_DIAS_ENTRADA_PREVIA*864e5;
  let nominaAntes=flows.length>0;
  (state.expenses||[]).forEach(function(e){
    if(!e) return;
    const ms=dateMs(e.date), neg=Number(e.amount)<0;
    if(neg&&!nominaAntes&&ms>=desdePrevio&&ms<P.startMs&&e.amount<=-200&&viva(e)&&!CAT_NEUTRAS[e.category]&&esNomina(e,flows)) nominaAntes=true;
    if(ms<P.startMs||ms>=P.gastoEndMs||!viva(e)) return;
    if(neg){
      if(CAT_NEUTRAS[e.category]){ if(e.category==="traspaso") traspaso+=repCts(-e.amount); return; }
      const c=repCts(-e.amount);
      if(repEsDevolucion(e)) devolucion+=c;
      else{
        entra+=c;
        if(e.amount<=-200&&esNomina(e,flows)) nominaLlego=true;
      }
      return;
    }
    if(!(e.amount>0)) return;
    const b=expenseBucket(e,state), c=repCts(e.amount);
    if(b==="cuenta"||b==="otrobanco"){ if(!sinEnlazar.has(e)) gastado+=c; }
    else if(b==="meta"){ const id=metaDeGasto(e); metaGastos[id]=(metaGastos[id]||0)+c; }
    else if(b==="neutra"&&e.category==="inversion"&&recompensaDe(e)!=="saveback") inversion+=c;
  });
  gastado=Math.max(0,gastado-devolucion);
  // Con nómina esperada y sin llegar, nada de % ni de Libre. Sin nómina de ninguna clase, lo que haya entrado.
  const esperaNomina=!nominaLlego&&nominaAntes;
  const entraC=esperaNomina||!(entra>0)?null:entra;
  /* ---- Recibos (tu parte, sin deudas) ---- */
  let recC=0, recQ=0, nRec=0;
  P.meses.forEach(function(mm){
    const pack=planChargesMonth(state,mm.m,mm.y,repHoyDe(P,mm.y,mm.m));
    pack.pendingBills.concat(pack.paidBills).forEach(function(x){
      if(x.kind==="debt"||x.kind==="balloon"||x.kind==="transfer"||x.kind==="income"||!(x.amount>0)) return;
      if(!repEnPeriodo(P,mm.y,mm.m,x.day)) return;
      const c=repCts(x.amount);
      recC+=c; nRec++;
      if(!x.paid) recQ+=c;
    });
  });
  /* ---- Deudas: tu parte de la cuota (banco + lo descontado de un recibo compartido) y el pago final, que es dinero que sale ---- */
  let deuC=0, deuQ=0, nDeu=0; const deudas=[];
  P.meses.forEach(function(mm){
    (state.debts||[]).forEach(function(d){
      if(!d||!debtActiveIn(d,mm.y,mm.m)) return;
      const dy=cleanDay(dayOf(d));
      if(!repEnPeriodo(P,mm.y,mm.m,dy)) return;
      const hoyM=repHoyDe(P,mm.y,mm.m), q=repCuotaPropia(state,d,mm.y,mm.m,hoyM), bl=repCts(debtBalloonIn(d,mm.y,mm.m));
      if(!(q.cuota>0)&&!(bl>0)) return;
      const pagada=!!debtPaymentState(state,d,mm.y,mm.m,hoyM).paid;
      deuC+=q.propia+bl; nDeu++;
      if(!pagada) deuQ+=q.propia+bl;
      deudas.push({id:d.id,c:q.propia,finalC:bl,pagada:pagada,restar:d.restarPres===true});
    });
  });
  const resD=reservaDeudasPeriodo(state,P);
  /* ---- Metas: lo mayor entre el ritmo previsto y lo ya movido (reservas + gastos con meta) ---- */
  const hecho={};
  let reservasC=0;
  (state.reservaLog||[]).forEach(function(x){
    const ms=new Date(x&&x.date).getTime();
    if(!isFinite(ms)||ms<P.startMs||ms>=P.endMs) return;
    const c=repCts(x.amount);
    reservasC+=c;
    const id=x.goalId||"?"; hecho[id]=(hecho[id]||0)+c;
  });
  Object.keys(metaGastos).forEach(function(id){ hecho[id]=(hecho[id]||0)+metaGastos[id]; });
  let metC=0, metQ=0, nMet=0;
  const abiertas={};
  (state.goals||[]).forEach(function(g){
    if(!g||g.done||(g.saved||0)>=(g.target||0)&&g.target>0) return;
    abiertas[g.id]=1;
    const ritmo=repCts(metaRitmoMensual(state,g)), h=Math.max(0,hecho[g.id]||0);
    if(ritmo>0) nMet++;
    metC+=Math.max(ritmo,h); metQ+=Math.max(0,ritmo-h);
  });
  Object.keys(hecho).forEach(function(id){ if(!abiertas[id]) metC+=Math.max(0,hecho[id]); });
  /* ---- Ahorro: aportaciones planificadas o inversión real, sin lo que ya va a una meta ---- */
  const ahoPlan=(state.aportaciones||[]).reduce(function(a,x){ return a+repCts(x&&x.amount); },0);
  const ahoC=Math.max(ahoPlan,inversion), ahoQ=Math.max(0,ahoPlan-inversion);
  /* ---- Gastos: max(presupuesto, gastado) ---- */
  const bud=typeof state.budget==="number"&&state.budget>0?repCts(state.budget):null;
  const limRaw=bud==null?null:bud-reservasC-resD.total, lim=limRaw==null?null:Math.max(0,limRaw);
  const lim0=bud==null?null:Math.max(0,bud-reservasC);
  const gasC=lim==null?gastado:Math.max(lim,gastado), gas0=lim0==null?gastado:Math.max(lim0,gastado);
  const movido=Math.max(0,gas0-gasC);
  const gasQ=lim==null?0:Math.max(0,lim-gastado);
  const total=recC+deuC+metC+ahoC+gasC;
  const libre=entraC==null?null:entraC-total, falta=libre!=null&&libre<0?-libre:0;
  const trozos=[{k:"rec",c:recC},{k:"deu",c:deuC},{k:"met",c:metC},{k:"aho",c:ahoC},{k:"gas",c:gasC}];
  if(libre!=null&&libre>0) trozos.push({k:"lib",c:libre});
  const pct=repPorcentajes(trozos,entraC,total,falta>0);
  trozos.forEach(function(x,i){ x.p=pct[i]; });
  const faltaP=falta>0&&total>0?Math.min(100,Math.max(1,Math.round(falta*100/total))):0;
  /* ---- Lo que QUEDA por pagar este mes y si tu saldo lo cubre ---- */
  const quedaC=recQ+deuQ+gasQ+metQ+ahoQ;
  const saldoC=o.saldo==null||!isFinite(o.saldo)?null:repCts(o.saldo);
  const pasa=resD.total>0&&limRaw!=null&&gastado>limRaw;
  let st="normal";
  if(entraC==null) st="wait";
  else if(falta>0) st=saldoC==null?"faltan":(saldoC>=quedaC?"cubre":"nollega");
  else if(libre===0) st="todo";
  else if(bud==null) st="nobud";
  return {periodo:P,now:now,st:st,entra:entraC,esperaNomina:esperaNomina,trozos:trozos,total:total,libre:libre,falta:falta,
    siGastasTodo:lim!=null&&gastado<lim,sinPresupuesto:bud==null,
    faltaP:faltaP,rec:recC,deu:deuC,met:metC,aho:ahoC,gas:gasC,gastado:gastado,presupuesto:lim,presupuestoRaw:limRaw,presupuestoBruto:bud,reservasC:reservasC,inversion:inversion,ahoPlan:ahoPlan,
    reservaDeudas:resD.total,porDeuda:resD.porDeuda,movido:movido,pasa:pasa,pasaC:pasa?gastado-limRaw:0,
    queda:quedaC,qRec:recQ,qDeu:deuQ,qGas:gasQ,qMet:metQ,qAho:ahoQ,saldo:saldoC,hueco:saldoC==null?0:Math.max(0,quedaC-saldoC),
    nRec:nRec,nDeu:nDeu,nMet:nMet,deudas:deudas,devolucion:devolucion,traspaso:traspaso};
}

/* MES DE LA ÚLTIMA CUOTA de una deuda (año*12+mes0), o null sin plazo ni saldo. UNA sola fuente: la usan la
   fecha «acabas en» de la ficha y la escalera. Con plazo, `debtLeft` solo descuenta la cuota de ESTE mes si su
   día ya pasó: si aún está por cobrar sigue contando y la última cae en mes actual + n − 1. Una compra con
   el ancla en un mes futuro aún no ha pagado nada: su 1.ª cuota cae en el ancla y la última en ancla + n − 1.
   Sin plazo (saldo estimado) el saldo solo baja al cambiar de mes: mes actual + n. */
function debtUltimoMes(d, nowMs, li){
  if(li===undefined) li=debtLeftInfo(d);
  if(!li) return null;
  const p=madridYmdParts(nowMs!=null?nowMs:Date.now());
  const futura=d.months!=null&&li.n>0&&typeof d.asOf==="number"&&d.asOf>ymAbs(p.y,p.m-1);
  const pendiente=d.months!=null&&li.n>0&&!futura&&debtChargeDay(d,p.y,p.m)>p.d;
  return futura?d.asOf+li.n-1:p.y*12+p.m-1+li.n-(pendiente?1:0);
}
/* LA ESCALERA DE CUOTAS (ficha de Deudas): cuánto pagas de cuotas hoy y cuánto bajará cuando acabe cada
   deuda, en orden de fin. Cifras de TU parte (la misma que el reparto) y fechas del plan; sin plazo,
   estimadas con lo que amortizas (`debtLeftInfo`). Sin saldo o sin cuota que acabe, la deuda no sale.
   → {hoy: céntimos, pasos:[{id, v: céntimos que quedan, ultimo: mes absoluto (año*12+mes0) de su última
   cuota, desde: el mes siguiente, final: céntimos del pago final}]} */
function deudasEscalera(state, nowMs){
  const hoy=madridYmdParts(nowMs!=null?nowMs:Date.now());
  const vivas=[];
  (state&&state.debts||[]).forEach(function(d){
    if(!d||!debtActive(d)) return;
    const q=repCuotaPropia(state,d,hoy.y,hoy.m,hoy.d), li=debtLeftInfo(d);
    if(!(q.propia>0)||!li||!(li.n>0)) return;
    vivas.push({id:d.id,c:q.propia,ultimo:debtUltimoMes(d,nowMs),final:repCts(d.balloon)});
  });
  vivas.sort(function(a,b){ return a.ultimo-b.ultimo; });
  let v=vivas.reduce(function(a,x){ return a+x.c; },0);
  const hoyC=v, pasos=vivas.map(function(x){ v-=x.c; return {id:x.id,c:x.c,v:Math.max(0,v),ultimo:x.ultimo,desde:x.ultimo+1,final:x.final}; });
  return {hoy:hoyC,pasos:pasos};
}
/* Lo de arriba de Metas: lo que apartas al mes y lo que te falta para llegar a tiempo. La previsión de
   cada meta es la de siempre (`goalEta` con `metaRitmoMensual`); aquí solo se suma. */
function metasResumen(state){
  let ritmo=0, ahorrado=0, objetivo=0, hueco=0, vencidas=0, conFecha=0;
  (state&&state.goals||[]).forEach(function(g){
    if(!g) return;
    const gv=metaConAportes(g,state);
    ahorrado+=repCts(gv.saved); objetivo+=repCts(g.target);
    if(g.done||goalRemaining(gv)<=0) return;
    const r=repCts(metaRitmoMensual(state,g));
    ritmo+=r;
    if(g.deadline) conFecha++;
    const eta=goalEta(gv,metaRitmoMensual(state,g));
    if(eta.cls!=="warn") return;
    const dl=monthsUntil(g.deadline);
    if(dl!=null&&dl<=0) vencidas++;
    else if(dl!=null) hueco+=Math.max(0,Math.ceil(repCts(goalRemaining(gv))/dl)-r);
  });
  return {ritmo:ritmo,ahorrado:ahorrado,objetivo:objetivo,hueco:hueco,vencidas:vencidas,conFecha:conFecha};
}

/* EL ICONO SALE DEL NOMBRE (no lo elige nadie). Por palabra entera: «casa» a secas no es la hipoteca (una
   «financiación del gimnasio en casa» salía con la casita) y «uni» dentro de «unidad» no es estudios.
   Lo que se le debe a alguien de la familia lleva una persona, no la tarjeta genérica. */
function debtIcoKind(name){
  const n=String(name||"").toLowerCase();
  const w=function(re){ return new RegExp("(^|[^a-záéíóúàèòïüñç])(?:"+re+")(?=$|[^a-záéíóúàèòïüñç])").test(n); };
  // Lo que se le debe a alguien de la familia lleva una persona, no la tarjeta genérica: «Mamá»
  // con una tarjeta parecía una financiación del banco (auditoría 237, P2-7). Va por palabra entera
  // para que «papelería» no sea «papá».
  const persona=/(^|[^a-záéíóúàèòïüñç])(mam[aá]|pap[aá]|madre|padre|famil\w*|herman[oa]s?|abuel[oa]s?|t[ií][oa]s?|amig[oa]s?|suegr[oa]s?|mum|mom|dad|mother|father|brother|sister|friend|grandma|grandpa|mare|pare|germ[àa]n?a?|avi|[àa]via)(?=$|[^a-záéíóúàèòïüñç])/;
  return w("coche|auto|car|seat|bmw|moto")?"car":w("hipoteca|hipotecas|mortgage|piso|vivienda")?"home":w("m[óo]vil|phone|iphone")?"phone":w("estudios?|m[áa]ster|master|universidad|uni|carrera")?"study":persona.test(n)?"person":"card";
}
