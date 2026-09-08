/* ============================================================
   CAPA 2 — Open Banking: el saldo real del banco re-ancla el motor.
   ============================================================ */
// Mapea el nombre del banco de Enable Banking ("Banco de Sabadell", "MyInvestor Banco"…)
// a la entidad de la app (sabadell, revolut, myinvestor…). null si no casa con ninguna.
function entFromAspsp(name){
  const n=String(name||"").toLowerCase();
  for(const k in ENT){
    if(k==="familia") continue;
    if(n.indexOf(k)>=0 || n.indexOf(String(ENT[k].label).toLowerCase())>=0) return k;
  }
  return null;
}
// Elige el saldo "de hoy" de la lista de balances del banco. Preferimos el disponible/esperado
// (lo que ves en la app del banco) y caemos al contable. Devuelve número o null.
//
// 2026-08-18: el Revolut del padre salió a −204,54 € («del banco») y al sincronizar pasó a
// 22,06 €. `pickBankBalance` caía a `balances[0]` si no reconocía el tipo, y un ITAV/XPCD
// negativo ganaba aunque hubiera un CLBD positivo. Un saldo en rojo inventado es peor que
// dejar el de antes: si no hay tipo conocido, o si el elegido es <0 y hay otro ≥0, no se pinta.
function pickBankBalance(balances){
  if(!Array.isArray(balances) || !balances.length) return null;
  const pri=["ITAV","XPCD","CLBD","OTHR","PRCD"];
  const num=function(x){ const n=Number(x&&x.amount); return isFinite(n) ? n : null; };
  const known=function(list){
    for(let p=0;p<pri.length;p++){
      const b=list.find(function(x){ return String(x&&x.type).toUpperCase()===pri[p]; });
      const n=b ? num(b) : null;
      if(n!=null) return n;
    }
    return null;
  };
  const picked=known(balances);
  if(picked==null) return null;
  if(picked<0){
    const pos=balances.filter(function(x){ return num(x)>=0; });
    if(!pos.length) return null;
    const better=known(pos);
    return better!=null ? better : num(pos[0]);
  }
  return picked;
}
// Construye una "cuenta extra" (obAccount) = saldo puro de una cuenta secundaria del banco
// (p.ej. Revolut compartida). NO participa en el motor de cash-flow; solo suma al patrimonio.
function mkObAcct(lk, ac, bal){
  const cur=(ac.currency || (ac.balances&&ac.balances[0]&&ac.balances[0].currency) || "EUR");
  return { key:String(ac.uid||ac.iban||(lk&&lk.aspsp)), ent:entFromAspsp(lk&&lk.aspsp), iban:ac.iban||null, name:ac.name||null, value:+Number(bal).toFixed(2), cur:cur, aspsp:(lk&&lk.aspsp)||null };
}
// Nombre "bonito" por defecto para una cuenta extra (el banco suele devolver algo feo: los
// titulares de una conjunta, un tipo técnico o nada). El usuario puede sobreescribirlo (obLabels).
function niceObName(o){
  const nm=String((o&&o.name)||"").trim();
  if(/&| y | i |,/.test(nm) && nm.length>16) return t("pt_ob_joint");        // varios titulares → conjunta
  if(/joint|compart|shared|conjunt/i.test(nm)) return t("pt_ob_joint");
  if(/saving|ahorro|estalvi/i.test(nm)) return t("pt_ob_saving");
  if(/current|corriente|corrent|payroll|n[oó]mina|personal|main/i.test(nm)) return t("pt_ob_current");
  if(nm) return nm.length>22 ? nm.slice(0,20)+"…" : nm;
  return o&&o.iban ? "···"+String(o.iban).slice(-4) : t("pt_ob_extra");
}
// PROMOCIONAR una cuenta OB a cuenta CON ROL (bug pareja 2026-07-11: sus cuentas de Revolut/
// CaixaBank vivían solo en obAccounts —sin rol— y al crear un gasto fijo solo salía Trade
// Republic). Crea la cuenta manual anclada al saldo real del banco (misma fórmula «fijos» de
// applyBankBalances), la saca de obAccounts (sin doble conteo) y, si el rol pedido no es
// «fijos», re-ancla con applyAccountRole (que además garantiza UNA sola cuenta de gasto diario).
function promoteObAccount(s, totals, key, role, id){
  const o=(s.obAccounts||[]).find(function(x){ return x.key===key; });
  if(!o || !o.ent) return s;
  const now=new Date();
  const bal=toEurAmt(o.value||0, o.cur||"EUR", s);
  const base=+((bal - monthNetForAccount(s, o.ent, now.getFullYear(), now.getMonth()+1, now.getDate())).toFixed(2));
  const name=((s.obLabels||{})[o.key]) || niceObName(o);
  const acc={ id:id||uid(), ent:o.ent, name:name, value:base, role:"fijos", spendFrom:false };
  if(o.iban) acc.bankIban=o.iban;                            // el sync del banco la re-ancla por IBAN
  let ns=Object.assign({},s,{ accounts:(s.accounts||[]).concat([acc]), obAccounts:(s.obAccounts||[]).filter(function(x){ return x.key!==key; }) });
  if(role && role!=="fijos") ns=applyAccountRole(ns, totals, acc.id, role);
  return ns;
}
// MULTI-CUENTA: aplica los saldos reales de TODAS las cuentas de los bancos enlazados.
// · La cuenta PRIMARIA de cada banco (la que ya tienes creada en la app) se RE-ANCLA igual que
//   editar a mano: value = saldoBanco − movimientosYaOcurridosEsteMes, para que dynBal muestre
//   HOY el saldo real y la proyección a fin de mes siga encima.
// · Las cuentas EXTRA (2ª, 3ª… de cualquier banco, o todas las de un banco sin cuenta manual)
//   van a state.obAccounts como SALDOS PUROS que suman al patrimonio, SIN tocar el motor
//   (cero riesgo de doble conteo con fijos/flows/round-up).
// · La cuenta de gasto (spendFrom / Trade Republic) NUNCA la toca el banco (fuera de Open Banking).
/* ¿EL SALDO DE ESTE BANCO LO MANDA UN PUENTE NATIVO? (2026-08-01)
   Trade Republic es el único caso: su integración propia (`06-sync-brokers.js`) re-ancla la cuenta
   TR con el `availableCash` que da el puente, y además le pone las posiciones. Desde que Enable
   Banking lista TR como ASPSP normal, TR puede llegar TAMBIÉN por Open Banking — y ahí está el
   ÚNICO choque real entre las dos integraciones: las dos escribirían el mismo `value` con fórmulas
   distintas, así que el saldo bailaría según cuál sincronizara la última. Los movimientos no
   chocan (van deduplicados por `ext_id`), y las posiciones solo las trae el puente.

   Así que no se bloquea la conexión: se reparte el trabajo. El puente nativo manda en el SALDO y
   las posiciones; Open Banking aporta los MOVIMIENTOS, que es justo lo que faltaba —las compras
   con la tarjeta de TR entrando solas en Gastos, en vez de a mano.

   Solo aplica si el puente está encendido: quien tenga TR ÚNICAMENTE por Open Banking (nadie hoy,
   pero es gratis dejarlo bien) sigue recibiendo su saldo por el camino normal. */
function saldoLoMandaPuenteNativo(s, ent){
  if(ent!=="trade_republic") return false;
  const pref=(s&&s.settings||{}).brokersOn;
  if(Array.isArray(pref)) return pref.indexOf("trade_republic")>=0;
  // Sin preferencia guardada, el chip se deduce de si hay inversiones de ese bróker (misma regla
  // que la pantalla de bancos): tener posiciones de TR ES tener el puente en marcha.
  return (s&&s.investments||[]).some(function(i){ return i && i.ent==="trade_republic"; });
}
// Función PURA: {state, changed, synced:[{ent,bal}], obAccounts:[]}.
function applyBankBalances(s, links){
  if(!s || !Array.isArray(links) || !links.length) return { state:s, changed:false, synced:[], obAccounts:(s&&s.obAccounts)||[] };
  const now=new Date(), cy=now.getFullYear(), cm=now.getMonth()+1, td=now.getDate();
  const accounts=(s.accounts||[]).slice();
  let changed=false; const synced=[]; const obAccts=[]; const usedPrimary={};
  links.forEach(function(lk){
    if(lk && lk.ok===false){
      // Banco que falló/caducó este sync: CONSERVA sus cuentas sincronizadas tal y como estaban,
      // marcadas rancias (stale) para que Patrimonio enseñe «caducado» en vez de esfumarlas.
      // (Bug CaixaBank 2026-07-11: al reconstruir obAccounts sin el banco caído, desaparecía.)
      const asp=String((lk&&lk.aspsp)||"").toLowerCase();
      (s.obAccounts||[]).forEach(function(o){ if(String(o.aspsp||"").toLowerCase()===asp) obAccts.push(Object.assign({},o,{stale:true})); });
      return;
    }
    const ent=entFromAspsp(lk && lk.aspsp);
    // TR por Open Banking: su saldo ya lo pone el puente nativo. Se sale ANTES de tocar `accounts`
    // y `obAccounts` —ni re-ancla ni crea cuenta extra, que sería doble conteo en Patrimonio— y
    // sus movimientos siguen su camino, que van por `flattenBankTx`/`importObExpenses` y no por
    // aquí. Ver `saldoLoMandaPuenteNativo`.
    if(saldoLoMandaPuenteNativo(s, ent)) return;
    // Si este banco al final no aporta NINGUNA cuenta utilizable (todas ok:false o sin saldo),
    // conserva las que ya tenía marcadas rancias, igual que un banco caído: reconstruir
    // obAccounts sin él las esfumaría en silencio (caso CaixaBank 2026-07-11, segunda variante).
    const keepStale=function(){
      const asp=String((lk&&lk.aspsp)||"").toLowerCase();
      (s.obAccounts||[]).forEach(function(o){ if(String(o.aspsp||"").toLowerCase()===asp) obAccts.push(Object.assign({},o,{stale:true})); });
    };
    // cuentas del banco: shape nuevo (lk.accounts) o antiguo (una sola, de lk.balances)
    const accs=(Array.isArray(lk.accounts)&&lk.accounts.length)
      ? lk.accounts.filter(function(a){ return a && a.ok!==false; })
      : [{ uid:lk.iban||lk.aspsp, iban:lk.iban||null, name:null, balances:(lk&&lk.balances) }];
    if(!accs.length){ keepStale(); return; }
    if(ent==null){   // banco SIN cuenta manual en la app → TODAS sus cuentas van a obAccounts
      let pushed=0;
      accs.forEach(function(ac){ const bal=pickBankBalance(ac.balances); if(bal!=null){ obAccts.push(mkObAcct(lk,ac,bal)); pushed++; } });
      if(!pushed) keepStale();
      return;
    }
    // hay ent conocido: re-ancla CADA cuenta MANUAL de ese banco (puede haber varias desde que
    // una cuenta OB se puede promocionar con rol, 2026-07-11): 1º casa por IBAN guardado; si no,
    // la primera cuenta del banco aún libre. Cualquier rol vale: si un banco OB es tu cuenta de
    // gasto diario (o "todo"), su saldo real también re-ancla. La TR de gasto del creador nunca
    // entra aquí porque TR no está en Open Banking (sin link posible).
    const ownerOf={};                                        // idx de accs → idx de accounts
    accounts.forEach(function(a,i){
      if(a.ent!==ent || usedPrimary[i]) return;
      let j=-1;
      if(a.bankIban) j=accs.findIndex(function(ac,k){ return ownerOf[k]==null && ac.iban && ac.iban===a.bankIban; });
      if(j<0) j=accs.findIndex(function(ac,k){ return ownerOf[k]==null; });
      if(j<0) return;
      ownerOf[j]=i; usedPrimary[i]=true;
    });
    let contributed=0;
    accs.forEach(function(ac,k){
      const bal=pickBankBalance(ac.balances); if(bal==null) return;
      contributed++;
      if(ownerOf[k]!=null){
        const a=accounts[ownerOf[k]];
        // re-anclaje = despejar `value` de la fórmula de dynBal para que HOY muestre el saldo real.
        // fijos:  dyn = value + paidNet
        // diario: dyn = value + inyección − gasto − round-up − aporte
        // ambos:  dyn = value + inyección − gasto − round-up − aporte + paidNet
        const role=accRole(a);
        let newBase;
        if(role==="fijos"){
          newBase=+((bal - monthNetForAccount(s, ent, cy, cm, td)).toFixed(2));
        } else {
          const monthStart=startOfMonth();
          const monthExp=(s.expenses||[]).filter(function(e){ return parseDate(e.date)>=monthStart; });
          const spentM=monthExp.reduce(function(x,e){ return x+e.amount; },0);
          const ruMv=(a.roundupManual!=null)?a.roundupManual:roundupOf(monthExp, a.roundup||0);
          const miMv=a.monthlyInvest||0;
          const injMv=nominaYaEntro()?accInject(a):0;
          newBase=+((bal - injMv + spentM + ruMv + miMv - (role==="ambos"?monthNetForAccount(s, ent, cy, cm, td):0)).toFixed(2));
        }
        synced.push({ ent:ent, bal:bal, iban:ac.iban||null });
        if(Math.abs((a.value||0)-newBase)>0.005 || (ac.iban && a.bankIban!==ac.iban)){
          accounts[ownerOf[k]]=Object.assign({}, a, { value:newBase, bankIban:ac.iban||a.bankIban });
          changed=true;
        }
      } else {
        obAccts.push(mkObAcct(lk,ac,bal));
        synced.push({ ent:ent, bal:bal, iban:ac.iban||null });
      }
    });
    if(!contributed) keepStale();
  });
  const obChanged=JSON.stringify(s.obAccounts||[])!==JSON.stringify(obAccts);
  const newState=(changed||obChanged) ? Object.assign({},s,{accounts:accounts, obAccounts:obAccts}) : s;
  return { state:newState, changed:changed||obChanged, synced:synced, obAccounts:obAccts };
}

// Eventos PENDIENTES de un banco este mes (cargos −, ingresos +) con su día.
// Espejo EXACTO de la lógica evsByBank del motor (totals) para un solo banco, reutilizable
// por el simulador "¿me lo puedo permitir?". today = día de hoy (solo cuenta lo no pagado).
function bankPendingEvents(state, bank, y, m, today){
  const evs=[];
  (state.fixed||[]).forEach(function(e){ if(occursIn(e,m)&&accOf(e)===bank&&!isPaidIn(e,m,today)) evs.push({day:dayIn(e,m)||0, amt:-occAmountIn(e,m)}); });
  (state.debts||[]).forEach(function(d){ if(debtActive(d)&&(d.account||"sabadell")===bank&&!isDebtPaidThisMonth(d,today)){ evs.push({day:debtChargeDay(d), amt:-(d.monthly||0)}); const bl=debtBalloonIn(d,y,m); if(bl>0) evs.push({day:debtChargeDay(d), amt:-bl}); } });
  (state.oneoffs||[]).forEach(function(o){ if(oneoffOccurs(o,y,m)&&(o.account||"sabadell")===bank&&(o.amount||0)!==0&&!isPaidThisMonth(o,today)) evs.push({day:o.day||0, amt:-o.amount}); });
  (state.flows||[]).forEach(function(f){ if(!flowOccursIn(f,m,y)||flowPaid(f,y,m,today))return; const dd=flowDay(f,y,m); if(f.kind==="income"&&(f.to||"sabadell")===bank) evs.push({day:dd||99, amt:f.amount}); else if(f.kind==="transfer"&&(f.from||"sabadell")===bank) evs.push({day:dd||0, amt:-f.amount}); });
  return evs;
}
// Recorre los eventos por día desde un saldo inicial y devuelve el punto MÍNIMO (peor momento) y el final.
function minWalk(startBal, evs){
  const s=evs.slice().sort(function(a,b){ return a.day-b.day; });
  let run=startBal, mn=startBal, md=0;
  s.forEach(function(ev){ run+=ev.amt; if(run<mn-0.005){ mn=run; md=ev.day; } });
  return {min:mn, minDay:md, end:run};
}

/* ============================================================
   CAPA 3 — Conciliación: el banco confirma tus fijos (o te avisa).
   PURA y ADVISORY: NO muta gastos ni saldo (eso lo hace la Capa 2).
   Casa los movimientos reales del banco (state.bankTx) con los cargos
   modelados del mes (fixed + cuotas + puntuales) por NOMBRE y/o IMPORTE.
   ============================================================ */
// normaliza un nombre para casar ("Mamá"→"mama", "COMUNIDAD PROPIETARIOS"→tokens)
function recNorm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim(); }
function recTokens(s){ return recNorm(s).split(" ").filter(function(w){ return w.length>=4; }); }
// ¿comparten nombre? (uno contiene al otro, o un token ≥4 en común)
function recNameMatch(a,b){
  const na=recNorm(a), nb=recNorm(b);
  if(!na||!nb) return false;
  if(na.length>=4 && nb.indexOf(na)>=0) return true;
  if(nb.length>=4 && na.indexOf(nb)>=0) return true;
  const ta=recTokens(a), tb=recTokens(b);
  return ta.some(function(w){ return tb.indexOf(w)>=0; });
}
// igual importe si difiere < max(0,50€, 2%)
function recAmtClose(a,b){ return Math.abs(a-b) <= Math.max(0.5, 0.02*Math.max(Math.abs(a),Math.abs(b))); }
// pareja "creíble" cuando solo casa el nombre: el importe no puede ser disparatado
// (evita emparejar YouTube Premium 4,33 con un cargo genérico de 25,99 — feedback 2026-07-06)
function recSane(a,b){ return Math.abs(a-b) <= Math.max(6, 0.5*Math.max(Math.abs(a),Math.abs(b))); }
// día (1-31) de una fecha "YYYY-MM-DD"
function recDay(ds){ const p=String(ds||"").slice(0,10).split("-"); return p.length===3?(parseInt(p[2],10)||null):null; }

const REC_GRACE=3;   // días de gracia antes de avisar "aún no aparece" (cargos que se cobran tarde, p.ej. hipoteca a fin de mes)
function reconcileBank(state, y, m, today){
  const tx=(state && state.bankTx)||[];
  const res={ hasData:tx.length>0, confirmed:[], shared:[], mismatch:[], missing:[], newCharges:[], income:[], feed:[] };
  if(!tx.length) return res;
  const ym=y+"-"+(m<10?"0":"")+m;
  // bancos OB del usuario (cuentas con rol de fijos, incluida "ambos"; el gasto de tarjeta de TR no es OB)
  const obEnts={}; (state.accounts||[]).forEach(function(a){ if(accFixed(a)) obEnts[a.ent]=true; });
  // movimientos de ESTE mes en esos bancos (convención: amount POSITIVO = gasto)
  const month=tx.filter(function(t){ return String(t.date||"").slice(0,7)===ym && obEnts[t.ent]; });
  res.feed=month.slice().sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  // Cobertura del feed por entidad: día más antiguo que el banco ha reportado ESTE mes.
  // Si la sync está vieja/parcial y no llega hasta el día del cargo, NO afirmamos "aún no aparece"
  // (no podemos saberlo: el movimiento podría estar fuera de la ventana de datos descargada).
  const entCoverMinDay={};
  month.forEach(function(t){ const dd=recDay(t.date); if(dd==null) return; const e=t.ent; if(entCoverMinDay[e]==null || dd<entCoverMinDay[e]) entCoverMinDay[e]=dd; });
  const feedCovers=function(ent,day){ const md=entCoverMinDay[ent]; return md!=null && day>=md; };
  // cargos modelados de este mes por entidad
  const modeled=[];
  (state.fixed||[]).forEach(function(e){ const ent=accOf(e); if(!obEnts[ent]||!occursIn(e,m)) return; const amt=occAmountIn(e,m); if(amt<=0) return; modeled.push({name:e.name,amount:amt,day:dayIn(e,m),ent:ent,id:e.id,kind:"fixed",bankAmount:(typeof e.bankAmount==="number"?e.bankAmount:null)}); });
  (state.debts||[]).forEach(function(d){ const ent=d.account||"sabadell"; if(!obEnts[ent]||!debtActive(d)) return; const amt=(d.monthly||0)+debtBalloonIn(d,y,m); if(amt<=0) return; modeled.push({name:d.name||"Cuota",amount:amt,day:d.day||null,ent:ent,id:d.id,kind:"debt",bankAmount:(typeof d.bankAmount==="number"?d.bankAmount:null)}); });
  (state.oneoffs||[]).forEach(function(o){ const ent=o.account||"sabadell"; if(!obEnts[ent]||!oneoffOccurs(o,y,m)||(o.amount||0)<=0) return; modeled.push({name:o.name||"Cargo",amount:o.amount,day:o.day||null,ent:ent,id:o.id,kind:"oneoff",bankAmount:(typeof o.bankAmount==="number"?o.bankAmount:null)}); });

  const debits=month.filter(function(t){ return (t.amount||0)>0; }).map(function(t){ return Object.assign({},t,{_used:false}); });
  const credits=month.filter(function(t){ return (t.amount||0)<0; });
  // Cola del MES ANTERIOR (día ≥15): cargos de primeros de mes que el banco adelanta al último
  // día hábil (hipoteca del día 1 cobrada el 30) o que pagaste antes de tiempo NO deben salir
  // como "aún no aparece" — se buscan también ahí y cuentan como confirmados.
  const prevY=(m===1)?y-1:y, prevM=(m===1)?12:m-1;
  const pym=prevY+"-"+(prevM<10?"0":"")+prevM;
  const prevTail=tx.filter(function(t){ return String(t.date||"").slice(0,7)===pym && obEnts[t.ent] && (t.amount||0)>0 && (recDay(t.date)||0)>=15; });
  // avisos que el usuario ha ocultado ("Ocultar aviso") y movimientos ignorados
  const dismissed={}; (state.bankDismissed||[]).forEach(function(k){ dismissed[k]=1; });
  res.ym=ym;

  // empareja cada cargo modelado con el mejor movimiento (nombre vale más; entre los que casan, importe cercano)
  modeled.sort(function(a,b){ return b.amount-a.amount; });
  modeled.forEach(function(mc){
    // si lo marcaste "compartido", el banco cobra el BRUTO (bankAmount); tú modelas tu parte (amount)
    const target=(typeof mc.bankAmount==="number" && mc.bankAmount>0) ? mc.bankAmount : mc.amount;
    let best=null, bestScore=-1;
    debits.forEach(function(d){
      if(d._used || d.ent!==mc.ent) return;
      const nameOk=recNameMatch(mc.name, d.merchant);
      const amtOk=recAmtClose(target, d.amount);
      // el nombre solo no basta si los importes no tienen nada que ver: mejor dejarlo sin
      // emparejar (saldrá como "no aparece"/"sin modelar") que inventar un "no cuadra" absurdo
      if(!amtOk && !(nameOk && recSane(target, d.amount))) return;
      const score=(nameOk?2:0)+(amtOk?1:0) - Math.abs(target-d.amount)/100000;
      if(score>bestScore){ bestScore=score; best=d; }
    });
    if(best){
      best._used=true;
      if(recAmtClose(target, best.amount)){
        if(typeof mc.bankAmount==="number" && Math.abs(mc.bankAmount-mc.amount)>0.005)
          res.shared.push({name:mc.name, net:mc.amount, gross:best.amount, ent:mc.ent, id:mc.id, kind:mc.kind});
        else res.confirmed.push({name:mc.name, amount:best.amount, ent:mc.ent});
      } else if(!dismissed["mm|"+mc.id+"|"+ym]) res.mismatch.push({name:mc.name, modeled:mc.amount, bank:best.amount, ent:mc.ent, id:mc.id, kind:mc.kind});
    } else {
      // ¿se cobró a FINAL del mes pasado? (último día hábil / pago adelantado) → confirmado
      const prev=prevTail.find(function(d){ return !d._used2 && d.ent===mc.ent && (recAmtClose(target,d.amount)||(recNameMatch(mc.name,d.merchant)&&recSane(target,d.amount))); });
      if(prev){ prev._used2=true; res.confirmed.push({name:mc.name, amount:prev.amount, ent:mc.ent}); }
      else if(mc.day!=null && (today-mc.day)>=REC_GRACE && feedCovers(mc.ent, mc.day) && !dismissed["miss|"+mc.id+"|"+ym]){
        // "no aparece" solo si: (1) el día ya pasó con margen (gracia, no llora por cargos de fin de mes)
        // Y (2) el feed del banco realmente cubre ese día (si no, la sync no ha llegado: no inventamos avisos).
        res.missing.push({name:mc.name, amount:mc.amount, day:mc.day, ent:mc.ent, id:mc.id, kind:mc.kind});
      }
    }
  });
  // transferencias e ingresos modelados (flows): los reconocemos para que NO salgan como "sin modelar"
  // (nómina entrante, transfers a TR/MyInvestor…). Casan por nombre O importe; las transfers varían cada mes,
  // así que solo confirmamos su presencia (no las marcamos "no cuadra").
  const usedCredit={};
  (state.flows||[]).forEach(function(f){
    if(!flowOccursIn(f,m,y)) return;
    if(f.kind==="transfer"){
      const ent=f.from||"sabadell"; if(!obEnts[ent]) return; const amt=f.amount||0; let best=null;
      debits.forEach(function(d){ if(d._used||d.ent!==ent) return; if(recNameMatch(f.name,d.merchant)||recAmtClose(amt,d.amount)){ if(!best||Math.abs(amt-d.amount)<Math.abs(amt-best.amount)) best=d; } });
      if(best){ best._used=true; res.confirmed.push({name:f.name||"Transferencia", amount:best.amount, ent:ent}); }
    } else if(f.kind==="income"){
      const ent=f.to||"sabadell"; if(!obEnts[ent]) return; const amt=f.amount||0; let bi=-1;
      credits.forEach(function(c,ci){ if(usedCredit[ci]||c.ent!==ent) return; if(recNameMatch(f.name,c.merchant)||recAmtClose(amt,-c.amount)){ if(bi<0||Math.abs(amt-(-credits[bi].amount))>Math.abs(amt-(-c.amount))) bi=ci; } });
      if(bi>=0){ usedCredit[bi]=true; res.confirmed.push({name:f.name||"Ingreso", amount:-credits[bi].amount, ent:ent}); }
    }
  });
  // movimientos que el usuario ha decidido ignorar (doble cobro del banco, comisiones que se devuelven…)
  const dkey=function(x){ return x.id || ((x.merchant||"")+"|"+x.amount+"|"+x.date); };
  // cargos del banco que no casan con nada modelado (excluidos los ignorados)
  debits.forEach(function(d){ if(d._used) return; const x={merchant:d.merchant, amount:d.amount, date:d.date, ent:d.ent, card:!!d.card, id:d.id||null}; if(!dismissed[dkey(x)]) res.newCharges.push(x); });
  // ingresos vistos no reconocidos como nómina/transfer (informativo)
  credits.forEach(function(c,ci){ if(!usedCredit[ci]) res.income.push({merchant:c.merchant, amount:-c.amount, date:c.date, ent:c.ent}); });
  return res;
}

// Aplana los movimientos de los bancos enlazados (que devuelve bank-sync) al formato
// que usa la conciliación. Adjunta la entidad (sabadell…) y recorta a lo reciente.
function flattenBankTx(links){
  const out=[];
  (links||[]).forEach(function(lk){
    const ent=entFromAspsp(lk && lk.aspsp);
    if(!ent) return;
    // En multicuenta el top-level solo contiene la PRIMERA cuenta compatible. Los movimientos
    // nuevos de una segunda cuenta estaban en `accounts[].transactions` y el cliente ni los
    // miraba: el banco figuraba sincronizado pero Gastos decía que no había nada nuevo.
    let txs=[];
    const accountTx=(lk.accounts||[]).filter(function(a){ return a&&Array.isArray(a.transactions); });
    if(accountTx.length) accountTx.forEach(function(a){ txs=txs.concat(a.transactions); });
    else txs=(lk.transactions||[]).slice();   // shape antiguo: una sola cuenta en top-level
    txs.forEach(function(t){
      // `note` = concepto del extracto (remittance_information): lo que hace que el histórico se
      // entienda sin abrir la app del banco (2026-07-24).
      out.push({ ent:ent, id:t.ext_id||null, date:String(t.date||"").slice(0,10), amount:Number(t.amount)||0, merchant:t.merchant||"", note:t.note||"", card:!!t.card, status:t.status||"" });
    });
  });
  out.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  return out.slice(0,150);   // últimos ~150 movimientos
}

/* GASTO VARIABLE VÍA OPEN BANKING (2026-08-05): entra TODO de CUALQUIER banco sincronizado
   (gastos e ingresos), estilo extracto de banca. Lo que RESTA del presupuesto y del saldo de
   gasto diario es solo lo de `expenseBankEnts` (cuenta diaria + extras marcados). El resto se
   apunta igual pero con `budgetSkip:true` → se ve en Gastos con marca «no afecta».

   En la cuenta diaria / extras de gasto: cualquier cargo, salvo si YA casa con un Fijo/deuda/
   puntual de ese mes (`matchesModeled`) — si no, recibos se contarían dos veces.
   En bancos fuera de gasto diario: también cualquier cargo (misma exclusión de modelados).

   INGRESOS: de cualquier banco (para «Mi ciclo»). Idempotente por ext_id + dedup. */
function importObExpenses(s, txs){
  if(!txs || !txs.length) return null;
  const ents=expenseBankEnts(s);
  const allow={}; ents.forEach(function(e){ allow[e]=1; });
  const daily=(s.accounts||[]).find(function(a){ return accDaily(a); });
  const dailyEnt=daily&&daily.ent;
  /* VENTANA CON MARGEN DE FIN DE MES (2026-08-04). Antes era `startOfMonth()` a secas: TODO lo
     anterior al día 1 se tiraba antes de llegar a la app. Con la app de Trade Republic al lado se
     vio lo que costaba — su nómina llega a Sabadell y él se traspasa a TR lo del mes (+1.620 € el
     31 de julio, con el bizum del piso de 70 € y media docena de gastos ese mismo día): TODO eso
     desaparecía por caer un día antes del corte, y sin ese ingreso apuntado «Mi ciclo»
     (`lastPaydayOf`, 04-tab-gastos.js) no tiene a qué anclarse y se queda en el mes natural.
     No es un caso raro: cobrar y repartir el dinero el último día del mes es de lo más normal, y
     además muchos bancos contabilizan a caballo entre los dos meses.
     8 días —y no 45— a propósito: cubre el borde de fin de mes sin arrastrar meses enteros de
     histórico en cada sync. Los duplicados que esto pueda rozar ya los para la red de arriba
     (mismo importe ±3 días contra lo que entró por otra vía) más el dedup por ext_id y clave. */
  const som=new Date(startOfMonth().getTime() - 8*86400000);
  const seen={}; (s.expenses||[]).forEach(function(e){ if(e.extId) seen[e.extId]=1; });
  /* EL DEDUP USA EL NOMBRE DEL BANCO, NO EL QUE VE EL USUARIO (2026-08-17).
     Petición suya: poder renombrar el «Movimiento» que deja Trade Republic, que «queda feo». El
     problema es que renombrar rompía LAS TRES capas de dedup a la vez y el siguiente sync recreaba
     la fila: TR no manda `ext_id` (todo null, verificado), la clave día|importe|comercio deja de
     casar en cuanto cambias el comercio, y la red de «sin nombre ±3 días» solo mira gastos de OTRA
     fuente — el renombrado sigue siendo `ob`. Resultado: el gasto duplicado.
     Por eso la fila guarda `obName` = lo que dijo el banco, y la clave se calcula con eso. El
     usuario cambia `merchant` (lo que se lee en pantalla) y el dedup sigue viendo lo de siempre.
     Las filas de antes de este cambio no tienen `obName`: caen a `merchant`, que en ellas todavía
     es lo que puso el banco porque nadie las había podido renombrar sin romperlo. */
  const nameForKey=function(e){ return e.obName!=null ? e.obName : (e.merchant||""); };
  const kOf=function(e){ return String(e.date).slice(0,10)+"|"+e.amount+"|"+nameForKey(e); };
  const keys={}; (s.expenses||[]).forEach(function(e){ keys[kOf(e)]=1; });
  /* Lápidas: «es el mismo» borra la fila OB y deja clave en `deleted`. Sin esto el siguiente
     sync de TR volvería a meter el Movimiento y a marcarlo otra vez contra la noti. */
  const delSet={}; (s.deleted||[]).forEach(function(k){ delSet[k]=1; });
  /* POSIBLE REPETIDO, NO DESCARTE (2026-09-07). TR por OB no manda id/comercio/hora: un
     «Movimiento» sin nombre puede ser el mismo cargo que ya entró por la noti del móvil, o una
     compra distinta del mismo importe. Descartar callaba pérdidas (y, sin filtrar banco, un
     Revolut de 23 € se comía un TR). La red solo MIRA la misma entidad (`expenseBankOf`) y
     fuentes que no son OB; si casa 1 a 1, la fila OB ENTRA marcada (`possibleDup`) para que él
     diga «es el mismo» o «son distintos». Cero decisiones irreversibles automáticas. */
  const DUP_MS=3*86400000;
  const otrasVias=(s.expenses||[]).filter(function(e){
    return e && e.source!=="ob" && e.source!=="ob-hist";
  });
  const usadoDup={};
  const gemeloOtraVia=function(tx){
    if(tx.merchant && tx.merchant!=="Movimiento") return null;
    if(!tx.ent) return null;
    const ms=parseDate(tx.date).getTime();
    const hit=otrasVias.findIndex(function(e,i){
      if(usadoDup[i]) return false;
      if(expenseBankOf(e)!==tx.ent) return false;
      if(Math.abs((e.amount||0)-tx.amount)>0.005) return false;
      return Math.abs(dateMs(e.date)-ms)<=DUP_MS;
    });
    if(hit<0) return null;
    usadoDup[hit]=1;
    return otrasVias[hit];
  };
  // Cargos ya modelados ESTE mes por entidad (Fijos/deudas/puntuales), para no duplicar un recibo.
  const now=new Date(), ym=now.getMonth()+1, yy=now.getFullYear();
  const modeledByEnt={};
  const pushModeled=function(ent,name,amount){ if(!ent||!(amount>0)) return; (modeledByEnt[ent]=modeledByEnt[ent]||[]).push({name:name,amount:amount}); };
  (s.fixed||[]).forEach(function(f){ if(occursIn(f,ym)) pushModeled(accOf(f), f.name, occAmountIn(f,ym)); });
  (s.debts||[]).forEach(function(d){ if(debtActive(d)) pushModeled(d.account||"sabadell", d.name||"Cuota", (d.monthly||0)+debtBalloonIn(d,yy,ym)); });
  (s.oneoffs||[]).forEach(function(o){ if(oneoffOccurs(o,yy,ym)) pushModeled(o.account||"sabadell", o.name||"Cargo", o.amount||0); });
  const matchesModeled=function(ent,merchant,amount){
    return (modeledByEnt[ent]||[]).some(function(mm){ return recAmtClose(mm.amount,amount) && recNameMatch(mm.name,merchant); });
  };
  const add=[];
  txs.forEach(function(tx){
    const esIngreso = tx.amount<0;
    if(esIngreso){
      if(!tx.date || parseDate(tx.date)<som) return;
      if(tx.id && seen[tx.id]) return;
      const e={ id:mcExpenseId(), date:new Date(tx.date+"T12:00:00").toISOString(),
        merchant:tx.merchant||"Ingreso", amount:tx.amount,
        category: esTraspasoPropio(s, tx) ? TRASPASO_CAT.id : INGRESO_CAT.id, source:"ob", ent:tx.ent };
      e.obName=e.merchant;   // lo que dijo el banco: el dedup se queda con esto aunque él lo renombre
      // Ingresos fuera de gasto diario: se ven (Mi ciclo) pero no mueven el presupuesto «gastado».
      if(tx.ent && !allow[tx.ent]) e.budgetSkip=true;
      if(tx.id) e.extId=tx.id;
      const nt=cleanNote(tx.note, e.merchant); if(nt) e.note=nt;
      if(keys[kOf(e)] || delSet[kOf(e)]) return;
      const gemIn=gemeloOtraVia(tx);
      if(gemIn && gemIn.id){ e.possibleDup=true; e.possibleDupOf=gemIn.id; }
      keys[kOf(e)]=1; add.push(e);
      return;
    }
    // GASTO: entra de cualquier banco. Modelados (Fijos/deudas) no se duplican.
    if(matchesModeled(tx.ent, tx.merchant, tx.amount)) return;
    if(!tx.date || parseDate(tx.date)<som) return;
    if(tx.id && seen[tx.id]) return;
    const esDiario=tx.ent===dailyEnt;
    const esAporteInv = esDiario && daily && daily.monthlyInvest>0 && Math.abs(tx.amount-daily.monthlyInvest)<0.01;
    const e={ id:mcExpenseId(), date:new Date(tx.date+"T12:00:00").toISOString(),
      merchant:tx.merchant||"Compra", amount:tx.amount,
      category: esAporteInv ? "inversion" : categoryOfNewMerchant(tx.merchant||""), source:"ob", ent:tx.ent };
    e.obName=e.merchant;   // lo que dijo el banco: el dedup se queda con esto aunque él lo renombre
    if(tx.ent && !allow[tx.ent]) e.budgetSkip=true;
    if(tx.id) e.extId=tx.id;
    const nt=cleanNote(tx.note, e.merchant); if(nt) e.note=nt;
    if(keys[kOf(e)] || delSet[kOf(e)]) return;
    const gem=gemeloOtraVia(tx);
    if(gem && gem.id){ e.possibleDup=true; e.possibleDupOf=gem.id; }
    keys[kOf(e)]=1;
    add.push(e);
  });
  return add.length? add : null;
}

/* ============================================================
   RESERVAR DINERO: repartir la nómina entre metas al cobrar (2026-08-03).
   ============================================================
   Las metas (`state.goals`) son un bote aparte que no toca ninguna cuenta ni el presupuesto — por
   diseño (ver `ContributeGoalSheet` en 09-tab-debts-goals.js: "no mueve saldos de cuentas, la hucha
   de metas es un bote aparte"). Es justo lo que el usuario echaba en falta: contribuir a una meta
   no se notaba en "lo que puedes gastar", así que ahorrar Y controlar el gasto variable con la
   MISMA cuenta (su caso: Trade Republic es fondo de emergencia + round-up + inversión + gasto
   diario a la vez) no se podía ver claro.

   Reglas (`state.settings.reservaRules`): {id, name, kind:"fixed"|"pct", value, goalId}. Al
   detectarse un ingreso grande (mismo umbral que "Mi ciclo": `lastPaydayOf` en 04-tab-gastos.js,
   ≥200€ en los últimos 45 días) se calcula el reparto y el usuario CONFIRMA antes de aplicarlo
   (nunca en silencio: es dinero de verdad, aunque aquí solo sea contabilidad de la app). Al
   aplicar: cada regla suma a su meta (mismo mecanismo que "Aportar a una meta") y queda un
   registro en `state.reservaLog`, idempotente por `incomeKey` (fecha+importe+comercio del ingreso,
   igual criterio de dedup que el resto de este fichero) para no aplicar la misma nómina dos veces.

   Lo reservado YA NO cuenta como "disponible para gastar": `monthSummary` en 04-tab-gastos.js
   resta el total reservado desde el inicio del período del presupuesto antes de calcular "lo que
   te queda" — sin eso, la sensación de "esto está apartado de verdad" no existía por mucho que
   sumara a una meta. */
function reservaKeyOf(income){ return String(income&&income.date).slice(0,10)+"|"+((income&&income.amount)||0)+"|"+((income&&income.merchant)||""); }
// Reparto de un ingreso según las reglas configuradas: el importe fijo o porcentual de cada regla,
// sin pasarse nunca del propio ingreso ni dejar ninguna meta en negativo. Ignora reglas huérfanas
// (meta borrada) o metas ya cumplidas (no tiene sentido seguir metiéndoles dinero).
function reservaPlanFor(state, incomeAmount){
  const rules=(state.settings&&state.settings.reservaRules)||[];
  const goals=state.goals||[];
  const gross=Math.abs(incomeAmount||0);
  let used=0;
  const plan=[];
  rules.forEach(function(r){
    if(!r||!r.goalId) return;
    const g=goals.find(function(x){ return x.id===r.goalId; });
    if(!g||g.done) return;
    let amt=r.kind==="pct" ? gross*(Math.max(0,r.value||0)/100) : Math.max(0,r.value||0);
    amt=Math.min(amt, Math.max(0, gross-used));
    amt=+amt.toFixed(2);
    if(amt<=0) return;
    used+=amt;
    plan.push({ ruleId:r.id, goalId:g.id, name:r.name||g.name, amount:amt });
  });
  return { plan:plan, total:+used.toFixed(2), remainder:+(gross-used).toFixed(2) };
}
// ¿Ya se aplicó el reparto de ESTE ingreso? (idempotencia: una nómina, un reparto.)
function reservaAlreadyApplied(state, income){
  const k=reservaKeyOf(income);
  return (state.reservaLog||[]).some(function(x){ return x.incomeKey===k; });
}
// Aplica el reparto: suma cada meta (mismo efecto que "Aportar a una meta") y deja el registro que
// hace que se descuente del presupuesto. Función PURA — devuelve el nuevo estado sin mutar `state`.
function applyReserva(state, income, plan, bankEnt){
  if(!plan || !plan.length) return state;
  if(reservaAlreadyApplied(state,income)) return state;
  const k=reservaKeyOf(income);
  let goals=(state.goals||[]).slice();
  plan.forEach(function(p){
    goals=goals.map(function(g){
      if(g.id!==p.goalId) return g;
      const ns=Math.max(0,(g.saved||0)+p.amount);
      return Object.assign({},g,{saved:ns, fromBank:bankEnt||g.fromBank, done:ns>=g.target, doneAt:(ns>=g.target&&!g.doneAt)?new Date().toISOString():g.doneAt});
    });
  });
  const log=(state.reservaLog||[]).concat(plan.map(function(p){
    return { id:uid(), ruleId:p.ruleId, goalId:p.goalId, name:p.name, amount:p.amount, date:income.date, incomeKey:k };
  }));
  return Object.assign({},state,{goals:goals, reservaLog:log});
}
// Total reservado desde `fromMs` — lo que hay que restar del presupuesto del período que se esté
// mirando, para que lo apartado se note de verdad en "lo que puedes gastar".
function reservedSince(state, fromMs){
  return (state.reservaLog||[]).reduce(function(a,x){ return dateMs(x.date)>=fromMs ? a+(x.amount||0) : a; },0);
}
/* Misma cifra en Gastos, Resumen y el widget (2026-08-05). `totals.thisMonthSpent` suma TODO
   (ingresos en negativo + inversión/traspaso): sirve para el efectivo de TR, NO para «has gastado
   X de tus Y». Aquí se excluyen neutras, se resta lo reservado al presupuesto, y `shown` es lo
   que pinta la cabecera de Gastos (gasto bruto o |balance| según gTotalMode). */
function monthBudgetStats(state, nowMs){
  const startMs=inicioDeMesMs(nowMs!=null?nowMs:Date.now());
  let spent=0, income=0;
  (state.expenses||[]).forEach(function(e){
    if(dateMs(e.date)<startMs) return;
    // Solo bancos de gasto diario (+ a mano). El resto se ve en la lista pero no mueve la cifra.
    if(!expenseCountsBudget(e, state)) return;
    if(e.amount>0) spent+=e.amount;
    else if(e.amount<0) income+=Math.abs(e.amount);
  });
  const reserved=reservedSince(state, startMs);
  const budgetRaw=typeof state.budget==="number" && state.budget>0 ? state.budget : null;
  const budget=budgetRaw==null?null:Math.max(0,+(budgetRaw-reserved).toFixed(2));
  const mode=(state.settings&&state.settings.gTotalMode)||"split";
  const balance=income-spent;
  const against=mode==="net"?(spent-income):spent;
  const shown=mode==="net"?Math.abs(balance):spent;
  const remaining=budget==null?null:budget-against;
  return {spent:spent, income:income, balance:balance, mode:mode, budget:budget, reserved:reserved,
    remaining:remaining, against:against, shown:shown};
}

/* EL CASHBACK ENTRA Y LUEGO SALE — son DOS apuntes del banco, un solo movimiento de dinero
   (2026-08-04, caso real suyo: «el cashback me lo detecta duplicado en categoría inversiones y
   luego como ingreso al principio del mes»). Trade Republic ABONA el saveback/round-up al efectivo
   (+8,38 € el 1/8) y días después lo RETIRA para comprar el fondo (−8,38 € el 3/8). Por separado
   cada uno es correcto, pero juntos inflan los ingresos del mes con dinero que nunca se quedó.
   Al marcar la SALIDA como Inversión se busca su entrada gemela —mismo importe al céntimo, misma
   cuenta, sin nombre de comercio, dentro de 10 días ANTES— y se marca también: así el par entero
   deja de contar, ni como ingreso ni como gasto. Devuelve el índice del gemelo o -1.
   Solo mira ingresos SIN comercio: un bizum de 8,38 € de un amigo tiene su nombre y no se toca. */
/* DINERO TUYO QUE CAMBIA DE CUENTA, no dinero nuevo (2026-08-04, decisión suya). Su nómina llega a
   Sabadell y él se traspasa a Trade Republic lo del mes (+1.620 €): sin esto se apuntaba como un
   ingreso más, y el día que se conecte también el banco de ORIGEN el mismo dinero contaría dos
   veces. Se marca `traspaso`: se apunta igual —«Mi ciclo» necesita ese apunte para saber cuándo
   empieza tu mes (`lastPaydayOf` mira el importe, no la categoría)— pero no suma a los ingresos.
   Criterio, deliberadamente estrecho para no tragarse un cobro de verdad: ingreso GRANDE, sin
   comercio (con nombre es un bizum/pago real y se respeta), y solo en una cuenta que TIENE un
   traspaso entrante ya modelado en `flows` — o sea, que el propio usuario declaró que se manda
   dinero ahí. El importe no tiene que cuadrar con el modelado: lo que se traspasa cada mes varía
   (él modeló 1.550 € y este mes movió 1.620 €), así que exigir el importe exacto lo dejaría fuera
   justo los meses que cambia. */
function esTraspasoPropio(s, tx){
  if(!tx || !(tx.amount<=-200)) return false;                         // mismo umbral que «Mi ciclo»
  const m=String(tx.merchant||"").trim();
  if(m && m!=="Movimiento" && m!=="Ingreso") return false;            // con nombre = cobro real
  return (s.flows||[]).some(function(f){ return f && f.kind==="transfer" && f.to===tx.ent; });
}
/* CONTENCIÓN 4.18.6 (1d-CONTENCION-A) — corre en cada sync, sin flag.
   Conserva todas las filas: ya NO borra ni crea lápidas por similitud
   (importe ±3 días entre OB sin nombre y otra vía). Devuelve siempre
   `borrar:[]`. Puede RECATEGORIZAR la salida de un cashback/round-up a
   «Inversión» (neutra) sin borrar la entrada. Contrato de identidad y
   recovery van en tickets siguientes. Ver syncCloudExpenses (solo recat). */
function reconcileObDupes(state){
  const exps=(state&&state.expenses)||[];
  if(!exps.length) return { state:state, borrar:[], recat:[] };
  // Solo sync diario (`ob`). El histórico (`ob-hist`) ya pasó por preview + dedup 1:1;
  // un barrido ciego al volver a primer plano (cashback/twin) lo deshacía — plan N.
  const esOb=function(e){ return e && e.source==="ob"; };
  const sinNombre=function(e){ const m=String((e&&e.merchant)||"").trim(); return !m || m==="Movimiento" || m==="Ingreso"; };
  /* Cashback: solo recat de la salida si hay rewardInv. setExpenseCat aún
     empareja por atributos — migrar a ID de fila antes de tocar el índice. */
  const recat=[];
  const usadoTwin={};
  exps.forEach(function(g){
    if(!esOb(g) || !(g.amount>0) || !sinNombre(g)) return;
    const acc=(state.accounts||[]).find(function(a){ return a.ent===g.ent && a.rewardInv; });
    if(!acc) return;
    if(acc.monthlyInvest>0 && Math.abs(g.amount-acc.monthlyInvest)<0.01) return;   // el aporte fijo va aparte
    const i=findCashbackTwin(exps, g);
    if(i<0 || usadoTwin[exps[i].id]) return;
    usadoTwin[exps[i].id]=1;
    if(g.category!=="inversion") recat.push({ expense:g, cat:"inversion" });
  });
  if(!recat.length) return { state:state, borrar:[], recat:[] };
  const nuevaCat={}; recat.forEach(function(r){ nuevaCat[r.expense.id]=r.cat; });
  const quedan=exps.map(function(e){ return nuevaCat[e.id] ? Object.assign({},e,{category:nuevaCat[e.id]}) : e; });
  return { state:Object.assign({},state,{expenses:quedan}), borrar:[], recat:recat };
}

function findCashbackTwin(expenses, gasto){
  if(!gasto || !(gasto.amount>0)) return -1;
  const ms=dateMs(gasto.date);
  return (expenses||[]).findIndex(function(e){
    if(!e || e.id===gasto.id) return -1 === 0;                       // nunca a sí mismo
    if(!(e.amount<0) || e.category==="inversion") return false;      // solo ingresos aún sin marcar
    if(e.ent!==gasto.ent) return false;                              // misma cuenta
    if(e.merchant && e.merchant!=="Movimiento" && e.merchant!=="Ingreso") return false;   // con nombre = real
    if(Math.abs(Math.abs(e.amount)-gasto.amount)>0.005) return false;                     // mismo importe
    const d=ms-dateMs(e.date);
    return d>=0 && d<=10*86400000;                                   // la entrada va ANTES que la salida
  });
}

/* CATEGORÍA "INVERSIÓN" (2026-08-03): round-up/cashback/aporte automático de un bróker que llega
   como movimiento REAL de Open Banking — dinero que sale del efectivo pero no es gasto ni ingreso,
   va a un fondo. Mismo cálculo de "comprar participaciones" que ya usaba `reconcileTR` (01-i18n.js)
   para su simulación a ciegas, ahora con el importe REAL del banco en vez de estimado. Se llama
   desde `runBankSync` (11-app-main.js, auto al reconocer el aporte mensual exacto) y desde `setCat`
   (04-tab-gastos.js, cuando el usuario marca a mano un round-up/cashback como Inversión). Función
   PURA — no muta `state`. `reverseInvestBuy` deshace exactamente lo que compró esta (con los MISMOS
   `shares`/`cInv` que devolvió, no recalculados, para no descuadrar si el cambio USD se movió entre medias).*/
function applyInvestBuy(state, ent, amountEur){
  if(!(amountEur>0)) return null;
  const acc=(state.accounts||[]).find(function(a){ return a.ent===ent && a.rewardInv; });
  if(!acc) return null;
  const inv=(state.investments||[]).find(function(i){ return i.id===acc.rewardInv; });
  if(!inv) return null;
  const cInv = inv.cur==="USD" ? amountEur/(state.fx||1) : amountEur;   // a la moneda de la inversión
  const boughtShares = (inv.shares>0 && inv.value>0) ? +(cInv/(inv.value/inv.shares)).toFixed(6) : 0;
  const newInv=Object.assign({},inv,{
    shares: +(((inv.shares||0)+boughtShares)).toFixed(6),
    value:  +(((inv.value||0)+cInv)).toFixed(2),
    cost:   +(((inv.cost||0)+cInv)).toFixed(2),
  });
  const investments=(state.investments||[]).map(function(i){ return i.id===inv.id?newInv:i; });
  const trRewardsTotal=+(((state.trRewardsTotal||0)+amountEur)).toFixed(2);   // acumulado histórico (€)
  return {
    state: Object.assign({},state,{investments:investments, trRewardsTotal:trRewardsTotal}),
    invId: inv.id, shares: boughtShares, cInv: cInv, amountEur: amountEur,
  };
}
function reverseInvestBuy(state, invId, shares, cInv, amountEur){
  const inv=(state.investments||[]).find(function(i){ return i.id===invId; });
  if(!inv) return state;
  const newInv=Object.assign({},inv,{
    shares: Math.max(0,+(((inv.shares||0)-(shares||0))).toFixed(6)),
    value:  Math.max(0,+(((inv.value||0)-(cInv||0))).toFixed(2)),
    cost:   Math.max(0,+(((inv.cost||0)-(cInv||0))).toFixed(2)),
  });
  const investments=(state.investments||[]).map(function(i){ return i.id===invId?newInv:i; });
  const trRewardsTotal=Math.max(0,+(((state.trRewardsTotal||0)-(amountEur||0))).toFixed(2));
  return Object.assign({},state,{investments:investments, trRewardsTotal:trRewardsTotal});
}

/* IMPORTAR HISTÓRICO — duplicados de RECIBO dentro del propio lote (2026-07-31, caso real: -9k
   en Revolut de golpe). Un recibo recurrente (alquiler, seguro, suscripción…) aparece UNA VEZ POR
   MES en 3 meses de extracto: son 3 movimientos reales y distintos en el banco, pero la MISMA
   factura. `BankHistoryImport` ya evita duplicar contra un Fijo que YA EXISTE (`fixNames`), pero
   nada evitaba duplicar ENTRE los propios candidatos del lote — así que "aceptar todo" con 3
   meses de histórico creaba 3 Fijos idénticos para la misma factura, y cada uno se cobra TODOS
   LOS MESES en el motor (`monthNetForAccount`): una factura duplicada 3 veces resta su importe 3
   veces cada mes, para siempre, hasta que alguien lo note y las borre a mano.
   Clave: comercio normalizado + importe + banco (misma que `histReciboDupKey`). `cands` ya viene
   ordenado por fecha descendente (más reciente primero) — nos quedamos con esa y marcamos como
   duplicado el resto. Solo mira candidatos con `kind:"out"` y `card:false` (los que `defDest`
   manda a "recibo"; tarjeta e ingresos son gasto/ingreso real cada vez, no se tocan). */
function histReciboDupKey(x){
  const norm=String((x&&x.merchant)||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  return norm+"|"+((x&&x.amount)||0)+"|"+((x&&x.ent)||"");
}
function dedupeHistRecibos(cands){
  const dup={};
  const seen={};
  (cands||[]).forEach(function(x,i){
    if(!x || x.kind!=="out" || x.card) return;
    const k=histReciboDupKey(x);
    if(seen[k]==null) seen[k]=i; else dup[i]=true;
  });
  return dup;
}

/* IMPORTAR HISTÓRICO — duplicados contra lo que YA GUARDASTE (2026-08-03, petición suya: que esta
   pantalla compare como el import de Excel en vez de esconder gastos sin explicar por qué faltan).
   `dedupeHistRecibos` de arriba compara candidatos ENTRE SÍ (misma factura repetida en 3 meses de
   extracto); esto compara cada candidato contra `state.expenses`, con el MISMO criterio que usa el
   import de Excel (`hojaClave`, 15-import-hoja.js): día + importe (con el signo de dentro de la
   app: gasto positivo, ingreso negativo) + comercio normalizado. El ext_id exacto (mismo apunte
   literal que ya trajo el sync diario) se sigue filtrando ANTES, en `BankHistoryImport.search()`,
   en silencio — no hay ambigüedad ahí. Aquí solo entran los que coinciden "por casualidad de
   datos" sin ext_id, que es donde de verdad hace falta que el usuario VEA la comparación en vez de
   fiarse de un descarte mudo. */
function histCandDupKey(dt, amountSigned, merchant){
  const dia=String(dt||"").slice(0,10);
  const norm=String(merchant||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  return dia+"|"+Math.round(amountSigned*100)+"|"+norm;
}
function histCandExisting(cands, expenses){
  // 1:1 como usadoDup del sync diario (agujero H): dos candidatos contra UN guardado
  // solo marcan uno; el mapa 1:N antiguo marcaba los dos y el preview mentía.
  const porClave={};
  (expenses||[]).forEach(function(e){
    const k=histCandDupKey(e.date, e.amount, e.merchant);
    (porClave[k]=porClave[k]||[]).push(e);
  });
  const out={};
  (cands||[]).forEach(function(x,i){
    if(!x) return;
    const signed = x.kind==="in" ? -Math.abs(x.amount) : Math.abs(x.amount);
    const list=porClave[histCandDupKey(x.date, signed, x.merchant)];
    if(list&&list.length) out[i]=list.shift();
  });
  return out;
}

/* IMPORT HISTÓRICO — clasificar / construir / deshacer (tanda motor, 2026-09-08).
   Puros: no escriben nube ni mutan state. UI orquesta en tandas siguientes. */
function histMatchesModeled(state, cand){
  if(!cand || cand.kind==="in" || cand.card) return null;
  const d=parseDate(cand.date);
  if(!d || !isFinite(d.getTime())) return null;
  const ym=d.getMonth()+1, yy=d.getFullYear();
  const amount=Math.abs(cand.amount||0);
  const merchant=cand.merchant||"";
  const ent=cand.ent;
  const modeled=[];
  const push=function(e,name,amt){ if(e&&amt>0) modeled.push({ent:e,name:name,amount:amt}); };
  (state.fixed||[]).forEach(function(f){ if(occursIn(f,ym)) push(accOf(f), f.name, occAmountIn(f,ym)); });
  (state.debts||[]).forEach(function(db){ if(debtActive(db)) push(db.account||"sabadell", db.name||"Cuota", (db.monthly||0)+debtBalloonIn(db,yy,ym)); });
  (state.oneoffs||[]).forEach(function(o){ if(oneoffOccurs(o,yy,ym)) push(o.account||"sabadell", o.name||"Cargo", o.amount||0); });
  for(let i=0;i<modeled.length;i++){
    const mm=modeled[i];
    if(mm.ent!==ent) continue;
    if(recAmtClose(mm.amount,amount) && recNameMatch(mm.name,merchant)) return mm;
  }
  return null;
}
function histSignSuspectByBank(cands){
  const by={};
  (cands||[]).forEach(function(x){
    if(!x||!x.ent) return;
    by[x.ent]=by[x.ent]||{in:0,n:0};
    by[x.ent].n++;
    if(x.kind==="in") by[x.ent].in++;
  });
  const flagged={};
  Object.keys(by).forEach(function(ent){
    const b=by[ent];
    if(b.n>=3 && (b.in/b.n)>0.7) flagged[ent]=true;
  });
  return flagged;
}
function histClassifyCandidates(cands, state){
  state=state||{};
  const existing=histCandExisting(cands, state.expenses);
  const recibDup=dedupeHistRecibos(cands);
  const daily=(state.accounts||[]).find(function(a){ return accDaily(a); });
  const rows=(cands||[]).map(function(x,i){
    if(!x) return null;
    if(existing[i]) return { status:"dup", reason:"existing", match:existing[i], defDest:null, suggestRecibo:false, category:null };
    if(recibDup[i]) return { status:"dup", reason:"recibo-lote", match:null, defDest:null, suggestRecibo:false, category:null };
    const modeled=histMatchesModeled(state, x);
    if(modeled) return { status:"dup", reason:"modeled", match:modeled, defDest:null, suggestRecibo:false, category:null };
    if(x.kind==="in"){
      const tx={ amount:-Math.abs(x.amount||0), merchant:x.merchant, ent:x.ent, date:x.date };
      const cat=esTraspasoPropio(state, tx) ? (typeof TRASPASO_CAT!=="undefined"?TRASPASO_CAT.id:"traspaso") : (typeof INGRESO_CAT!=="undefined"?INGRESO_CAT.id:"ingreso");
      return { status:"new", reason:null, match:null, defDest:"ingreso", suggestRecibo:false, category:cat };
    }
    const amt=Math.abs(x.amount||0);
    const esAporte=!!(daily && daily.ent===x.ent && daily.monthlyInvest>0 && Math.abs(amt-daily.monthlyInvest)<0.01);
    const cat=esAporte ? "inversion" : (typeof categoryOfNewMerchant==="function"?categoryOfNewMerchant(x.merchant||""):(typeof autoCategory==="function"?autoCategory(x.merchant||""):"otros"));
    // Híbrido C: default Gasto; recibo solo si el usuario lo marca (suggestRecibo).
    return { status:"new", reason:null, match:null, defDest:"gasto", suggestRecibo:!x.card, category:cat };
  });
  return { rows:rows, signSuspect:histSignSuspectByBank(cands) };
}
function histBuildCommit(cands, classifications, state, opts){
  opts=opts||{};
  const batchId=opts.batchId || ("hist-"+(typeof mcExpenseId==="function"?mcExpenseId():String(Date.now())));
  const expAdds=[];
  const investmentsBefore=(state&&state.investments)||null;
  (cands||[]).forEach(function(x,i){
    const c=classifications && classifications[i];
    if(!x||!c||c.status!=="new") return;
    if(c.defDest==="recibo") return;   // Fijos: tanda UI
    const signed = x.kind==="in" ? -Math.abs(x.amount||0) : Math.abs(x.amount||0);
    const merchant=x.merchant||(x.kind==="in"?"Ingreso":"Compra");
    const e={
      id:(typeof mcExpenseId==="function"?mcExpenseId():("h"+i)),
      date:new Date(String(x.date||"").slice(0,10)+"T12:00:00").toISOString(),
      merchant:merchant,
      amount:signed,
      category:c.category||"otros",
      source:"ob-hist",
      ent:x.ent,
      importBatchId:batchId,
      obName:merchant
    };
    if(x.id) e.extId=x.id;
    expAdds.push(e);
  });
  return { expAdds:expAdds, fixAdds:[], batchId:batchId, investmentsSnapshot:investmentsBefore };
}
/* Deshacer un batch: quita filas locales del batch y lista ids de nube para borrar POR ID.
   Nunca escribe state.deleted (agujero B). cloudDeleteById solo debe llevar ids con ACK
   (insertados de verdad); el llamador no mete los que chocaron en la terna (agujero A). */
function histUndoBatch(state, lastHistImport){
  if(!state||!lastHistImport||!lastHistImport.batchId){
    return { nextState:state, cloudDeleteById:[], ok:false, reason:"empty" };
  }
  const batchId=lastHistImport.batchId;
  const cloudIds=(lastHistImport.cloudIds||[]).slice();
  const localIds=new Set(lastHistImport.localIds||[]);
  cloudIds.forEach(function(id){ localIds.add(id); });
  const nextEx=(state.expenses||[]).filter(function(e){
    if(!e) return false;
    if(e.importBatchId===batchId) return false;
    if(localIds.has(e.id)) return false;
    return true;
  });
  // Idempotente: segunda pasada no toca deleted ni vuelve a listar.
  return {
    nextState:Object.assign({},state,{expenses:nextEx}),
    cloudDeleteById:cloudIds,
    ok:true,
    reason:null
  };
}

/* Bancos que NO están sirviendo datos, con el motivo, para el banner «Reconectar» y la noti.

   Antes solo se listaban los `expired`. Se quedaban fuera los enlaces rotos sin cuentas
   (`noacct`, típico de un banco que se enlazó a medias) y los que el servidor devuelve como
   `skipped`: el padre le daba a Sincronizar, no pasaba nada, y no había forma de saber que un
   banco estaba pidiendo permiso otra vez ni DÓNDE se arreglaba (feedback 2026-07-24).

   `kind`: "expired" (el permiso caducó, se reconecta) · "noacct" (enlace sin cuentas utilizables).
   Los fallos PASAJEROS (rate-limit, 5xx) NO entran aquí a propósito: se reintentan solos y sacarlos
   en un banner haría que «se cae cada dos por tres» otra vez (feedback 2026-07-17). */
function bankIssuesOf(links){
  return (links||[]).filter(function(l){
    return l && l.ok===false && (l.expired || l.noacct);
  }).map(function(l){
    return { aspsp:l.aspsp, ent:entFromAspsp(l.aspsp), kind: l.expired ? "expired" : "noacct" };
  });
}

/* Rellena el CONCEPTO de los gastos que YA estaban apuntados, usando lo que acaba de traer el
   banco (2026-07-24). Sin esto, el concepto solo saldría en lo nuevo y el histórico de siempre
   —justo el que hay que consultar— seguiría mudo.
   Reglas: solo rellena huecos (nunca pisa un concepto que ya hay) y NUNCA toca los que el usuario
   escribió a mano (noteEdited). Devuelve el MISMO array si no hay nada que cambiar, para no
   provocar un render de más. */
function enrichNotesFromBankTx(expenses, txs){
  if(!expenses || !expenses.length || !txs || !txs.length) return expenses;
  const byExt={}, byKey={};
  const kOf=function(d,a,m){ return String(d).slice(0,10)+"|"+Math.abs(Number(a)||0).toFixed(2)+"|"+String(m||"").toLowerCase(); };
  txs.forEach(function(tx){
    const n=String(tx&&tx.note||"").trim();
    if(!n) return;
    if(tx.id) byExt[tx.id]=n;
    byKey[kOf(tx.date,tx.amount,tx.merchant)]=n;
  });
  let touched=false;
  const out=expenses.map(function(e){
    if(!e || e.noteEdited || (e.note&&String(e.note).trim())) return e;
    const raw=(e.extId&&byExt[e.extId]) || byKey[kOf(e.date,e.amount,e.merchant)];
    if(!raw) return e;
    const nt=cleanNote(raw, e.merchant);
    if(!nt) return e;
    touched=true;
    return Object.assign({},e,{note:nt});
  });
  return touched? out : expenses;
}

// Selector compacto de meses (1-12) para gastos no mensuales.
function MonthPicker({selected, onToggle}){
  const sel=selected||[];
  return React.createElement("div",{className:"month-picker"},
    MONTHS_ES.map((lbl,i)=>{
      const m=i+1, on=sel.indexOf(m)>=0;
      return React.createElement("button",{key:m,type:"button",className:"mchip"+(on?" on":""),
        onClick:(ev)=>{ ev.stopPropagation(); onToggle(m); }}, monthShort(i));
    })
  );
}

/* "¿Me lo puedo permitir?" — simula una compra hipotética y dice cómo afecta al punto
   más bajo del mes de ese banco (reusa el motor minWalk). Distintivo: mira el FUTURO. */
function AffordSim({state, totals, set}){
  const accounts=(state.accounts||[]);
  const defBank=(accounts.find(function(a){return a.ent==="sabadell";})?"sabadell":(accounts[0]&&accounts[0].ent))||"sabadell";
  const [amount,setAmount]=useState("");
  const [day,setDay]=useState(String(totals.today||new Date().getDate()));
  const [bank,setBank]=useState(defBank);
  // Modo «a plazos» (petición 2026-07-18): además del contado, simula financiarlo — cuota,
  // cómo suben tus fijos y si te cabe cada mes; y puede crear la deuda de un toque.
  const [mode,setMode]=useState("cash");     // cash | fin
  const [months,setMonths]=useState("12");
  const [down,setDown]=useState("");
  const [finName,setFinName]=useState("");
  const [finDone,setFinDone]=useState(false);
  const acc=accounts.find(function(a){return a.ent===bank;});
  const floor=(acc&&acc.floor>0)?acc.floor:0;          // colchón mínimo opcional de esta cuenta
  const setFloor=function(v){ const n=parseFloat(String(v).replace(',','.')); set(function(s){ return Object.assign({},s,{accounts:s.accounts.map(function(a){ return a.ent===bank?Object.assign({},a,{floor:(isNaN(n)||n<=0)?undefined:n}):a; })}); }); };
  const amt=parseFloat(String(amount).replace(',','.'))||0;
  const dd=Math.max(1,Math.min(31,parseInt(day)||totals.today||1));
  const start=(totals.bankBal&&totals.bankBal[bank])||0;
  const evs=bankPendingEvents(state, bank, totals.curYear, totals.curMonth, totals.today);
  const base=minWalk(start, evs);
  // A plazos: este mes solo sale la ENTRADA (la 1ª cuota llega el mes que viene); al contado, todo.
  const fin=mode==="fin";
  const nM=Math.max(1,Math.min(120,parseInt(months)||12));
  const dw=fin ? Math.min(amt, Math.max(0,parseFloat(String(down).replace(',','.'))||0)) : 0;
  const quota=fin ? +(((amt-dw)/nM).toFixed(2)) : 0;
  const hitNow=fin ? dw : amt;
  const sim=minWalk(start, hitNow>0?evs.concat([{day:dd, amt:-hitNow}]):evs);
  const BUFFER=50;
  const breaksFloor = floor>0 && sim.min < floor;
  const verdict = amt<=0 ? null : (sim.min<-0.005 ? "no" : (breaksFloor ? "floor" : (sim.min<BUFFER ? "tight" : "yes")));
  const lowTxt = sim.minDay ? tf("af_low",{x:eur(sim.min),d:sim.minDay}) : tf("af_low_noday",{x:eur(sim.min)});
  const verdictTxt = verdict==="no"?t("af_no"):(verdict==="floor"?tf("af_floor_break",{x:eur0(floor)}):(verdict==="tight"?t("af_tight"):t("af_yes")));
  // ¿Te cabe la cuota CADA MES? margen libre = nómina − fijos − presupuesto variable.
  const incomeM=(state.flows||[]).reduce(function(a,f){ return a+((f&&f.kind==="income"&&!f.once)?(f.amount||0):0); },0);
  const freeM=incomeM-(totals.fijosMensual||0)-(state.budget||0);
  const quotaVerdict = !fin||quota<=0 ? null
    : incomeM<=0 ? "none"
    : quota>freeM ? "no" : (quota>freeM*0.5 ? "tight" : "ok");
  const endLbl=(function(){ const d0=new Date(); d0.setDate(1); d0.setMonth(d0.getMonth()+nM); return monthLong(d0.getMonth())+" "+d0.getFullYear(); })();
  const createDebt=function(){
    if(!(quota>0)) return;
    const financed=+((amt-dw).toFixed(2));
    const it={ id:uid(), ent:"familia", name:finName.trim()||t("db_newdebt"), value:financed, original:financed,
      monthly:quota, amort:quota, months:nM, asOf:ymNow(), account:bank, day:dd, note:t("db_addedmanual") };
    if(dw>0) it.downPayment=dw;
    set(function(s){ return Object.assign({},s,{debts:(s.debts||[]).concat([it])}); });
    setFinDone(true);
  };
  return React.createElement(CollapsibleCard,{title:t("af_title"),sub:t("af_sub"),dot:"#9BD0E0",defaultOpen:false,storageKey:"fj_afford",help:t("h_afford")},
    React.createElement("div",{style:{display:"flex",gap:6,marginBottom:8}},
      [["cash","af_mode_cash"],["fin","af_mode_fin"]].map(function(mm){
        return React.createElement("button",{key:mm[0],className:"chip"+(mode===mm[0]?" on":""),style:mode===mm[0]?{background:"var(--mint)",color:"#06120C",borderColor:"var(--mint)"}:null,
          onClick:function(){ setMode(mm[0]); setFinDone(false); }}, t(mm[1]));
      })),
    React.createElement("div",{className:"af-row"},
      React.createElement("input",{className:"af-in num",inputMode:"decimal",placeholder:t("af_amount"),value:amount,onChange:function(e){ setAmount(e.target.value); setFinDone(false); }}),
      React.createElement("input",{className:"af-in num",inputMode:"numeric",style:{flex:"0 0 30%"},placeholder:t("af_day"),value:day,onChange:function(e){ setDay(e.target.value); }})
    ),
    fin && React.createElement("div",{className:"af-row",style:{marginTop:8}},
      React.createElement("input",{className:"af-in num",inputMode:"numeric",placeholder:t("af_fin_months"),value:months,onChange:function(e){ setMonths(e.target.value); setFinDone(false); }}),
      React.createElement("input",{className:"af-in num",inputMode:"decimal",placeholder:t("af_fin_down"),value:down,onChange:function(e){ setDown(e.target.value); setFinDone(false); }})
    ),
    accounts.length>1 && React.createElement("select",{className:"af-in",style:{marginTop:8},value:bank,onChange:function(e){ setBank(e.target.value); }},
      accounts.map(function(a){ return React.createElement("option",{key:a.id,value:a.ent}, entOf(a.ent).label); })),
    React.createElement("div",{className:"af-floor"},
      React.createElement("span",{className:"muted"}, tf("af_floor",{bank:entOf(bank).label})),
      React.createElement("input",{key:"floor-"+bank,className:"af-in num",style:{flex:"0 0 38%",textAlign:"right"},inputMode:"decimal",placeholder:t("af_floor_ph"),defaultValue:floor||"",onBlur:function(e){ setFloor(e.target.value); }})),
    (floor>0 && base.min<floor) && React.createElement("div",{className:"af-below"}, tf("af_below",{x:eur0(floor),y:eur(base.min)})),
    React.createElement("div",{className:"af-info"},
      React.createElement("div",{className:"af-safe"}, tf("af_safe",{x:eur(Math.max(0, base.min-Math.max(0,floor)))})),
      React.createElement("div",{className:"muted",style:{fontSize:11.5,marginTop:3}}, tf("af_eom",{x:eur(base.end)}))
    ),
    amt>0 && React.createElement("div",{className:"af-result "+verdict,style:{marginTop:10}},
      React.createElement("div",{className:"af-verdict"}, verdictTxt),
      React.createElement("div",{className:"af-low"}, lowTxt),
      React.createElement("div",{className:"af-delta num"}, tf("af_from_to",{a:eur(base.min),b:eur(sim.min)}))
    ),
    fin && amt>0 && quota>0 && React.createElement("div",{style:{marginTop:10,padding:"10px 12px",borderRadius:12,background:"var(--surface-2)",border:"1px solid var(--line)"}},
      React.createElement("div",{className:"hint",style:{marginTop:0,color:"var(--text)",fontWeight:700}}, "📅 "+tf("af_fin_quota",{x:eur(quota),n:nM,d:endLbl})),
      React.createElement("div",{className:"hint",style:{marginTop:6}}, tf("af_fin_fixed",{a:eur0(totals.fijosMensual||0),b:eur0((totals.fijosMensual||0)+quota)})),
      quotaVerdict==="ok" && React.createElement("div",{className:"hint",style:{marginTop:6,color:"var(--mint)"}}, tf("af_fin_margin_ok",{x:eur0(freeM-quota)})),
      quotaVerdict==="tight" && React.createElement("div",{className:"hint",style:{marginTop:6,color:"var(--tan)"}}, tf("af_fin_margin_tight",{x:eur0(freeM)})),
      quotaVerdict==="no" && React.createElement("div",{className:"hint",style:{marginTop:6,color:"var(--coral)"}}, tf("af_fin_margin_no",{x:eur0(Math.max(0,freeM))})),
      quotaVerdict==="none" && React.createElement("div",{className:"hint",style:{marginTop:6}}, t("af_fin_margin_none")),
      finDone
        ? React.createElement("div",{className:"hint",style:{marginTop:8,color:"var(--mint)",fontWeight:700}}, t("af_fin_created"))
        : React.createElement(React.Fragment,null,
            React.createElement("input",{className:"af-in",style:{marginTop:8},placeholder:t("af_fin_name_ph"),value:finName,onChange:function(e){ setFinName(e.target.value); }}),
            React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},onClick:createDebt}, tf("af_fin_create",{x:eur(quota)}))
          ),
      React.createElement("div",{className:"hint",style:{marginTop:8,fontSize:11.5}}, t("af_fin_hint"))
    )
  );
}

/* ============================================================
   CAPA 3 — Conciliación bancaria: tarjeta ADVISORY en Fijos.
   Lee state.bankTx (movimientos reales del banco) y los casa con los cargos
   modelados del mes. NO muta nada salvo el botón opt-in "+ Añadir a Fijos".
   ============================================================ */
function Reconcile({state, set}){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth()+1, today=now.getDate();
  const r=reconcileBank(state, y, m, today);
  const [added,setAdded]=useState({});
  if(!r.hasData) return null;
  const okCount=r.confirmed.length+r.shared.length;
  const nIssues=r.mismatch.length+r.missing.length+r.newCharges.length;
  const sub = nIssues ? tf("rec_sub_issues",{n:nIssues, ok:okCount})
            : (okCount ? tf("rec_sub_ok",{ok:okCount}) : t("rec_sub_none"));
  const dot = nIssues ? "#E2A05F" : "#5FD08A";
  const rowS={padding:"8px 0",borderTop:"1px solid var(--line)",fontSize:13,lineHeight:1.4};
  const secT={fontSize:12,fontWeight:800,color:"var(--muted)",margin:"12px 0 2px"};
  const mb={background:"var(--surface-2)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:9,padding:"5px 9px",fontSize:11.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"};
  const actRow={display:"flex",gap:6,marginTop:6,flexWrap:"wrap",alignItems:"center"};
  const keyOf=function(nc){ return (nc.merchant||"")+"|"+nc.amount+"|"+nc.date; };
  // muta el cargo modelado correcto (fixed / debt / oneoff) por id
  const updateCharge=function(id,kind,patch){
    set(function(s){ const key=kind==="debt"?"debts":(kind==="oneoff"?"oneoffs":"fixed");
      return Object.assign({},s,{[key]:(s[key]||[]).map(function(e){ return e.id===id?Object.assign({},e,patch):e; })}); });
  };
  const adjustToBank=function(x){ const f=x.kind==="debt"?"monthly":"amount"; const p={}; p[f]=+Number(x.bank).toFixed(2); updateCharge(x.id,x.kind,p); };
  const markShared=function(x){ updateCharge(x.id,x.kind,{bankAmount:+Number(x.bank).toFixed(2)}); };
  const reassign=function(x,ent){ updateCharge(x.id,x.kind,{account:ent}); };
  const entList=Array.from(new Set((state.accounts||[]).map(function(a){ return a.ent; })));
  const addAsFixed=function(nc){
    const k=keyOf(nc);
    set(function(s){ const it={id:uid(),name:nc.merchant||"Gasto fijo",amount:+Number(nc.amount).toFixed(2),freq:"mes",account:nc.ent}; const dd=recDay(nc.date); if(dd) it.day=dd; return Object.assign({},s,{fixed:(s.fixed||[]).concat([it])}); });
    setAdded(function(a){ return Object.assign({},a,{[k]:true}); });
  };
  // "Ignorar": oculta un movimiento del banco (doble cobro, comisión que te devuelven…). Persistente.
  const dismiss=function(nc){ const dk=nc.id || ((nc.merchant||"")+"|"+nc.amount+"|"+nc.date); set(function(s){ const cur=(s.bankDismissed||[]); return cur.indexOf(dk)>=0?s:Object.assign({},s,{bankDismissed:cur.concat([dk])}); }); };
  // "Ocultar aviso": silencia un aviso concreto (no cuadra / aún no aparece) durante ESTE mes
  // (pago adelantado, cargo que ya sabes que está bien…). La clave lleva el mes → al siguiente vuelve a vigilar.
  const hideIssue=function(prefix,x){ set(function(s){ const k=prefix+"|"+x.id+"|"+r.ym; const cur=s.bankDismissed||[]; return cur.indexOf(k)>=0?s:Object.assign({},s,{bankDismissed:cur.concat([k])}); }); };
  return React.createElement(CollapsibleCard,{title:t("rec_title"), sub:sub, dot:dot, storageKey:"f_recon", defaultOpen:nIssues>0, help:t("h_recon")},
    r.mismatch.length>0 && React.createElement(React.Fragment,{key:"mm"},
      React.createElement("div",{style:Object.assign({},secT,{color:"var(--coral)"})}, t("rec_mismatch_t")),
      r.mismatch.map(function(x,i){ return React.createElement("div",{key:i,style:rowS},
        React.createElement("div",null, tf("rec_mismatch_l",{name:x.name, modeled:eur(x.modeled), bank:eur(x.bank)})),
        x.id && React.createElement("div",{style:actRow},
          React.createElement("button",{style:mb,onClick:function(){ adjustToBank(x); }}, tf("rec_adjust",{x:eur(x.bank)})),
          React.createElement("button",{style:mb,onClick:function(){ markShared(x); }}, t("rec_mark_shared")),
          React.createElement("button",{style:mb,onClick:function(){ hideIssue("mm",x); }}, t("rec_hide"))
        )
      ); })
    ),
    r.shared.length>0 && React.createElement(React.Fragment,{key:"sh"},
      React.createElement("div",{style:Object.assign({},secT,{color:"var(--blue)"})}, t("rec_shared_t")),
      r.shared.map(function(x,i){ return React.createElement("div",{key:i,style:rowS},
        React.createElement("div",null, tf("rec_shared_l",{name:x.name, net:eur(x.net), gross:eur(x.gross)})),
        x.id && React.createElement("div",{style:actRow},
          React.createElement("button",{style:mb,onClick:function(){ updateCharge(x.id,x.kind,{bankAmount:null}); }}, t("rec_unshare")))
      ); })
    ),
    r.missing.length>0 && React.createElement(React.Fragment,{key:"ms"},
      React.createElement("div",{style:secT}, t("rec_missing_t")),
      r.missing.map(function(x,i){ const others=entList.filter(function(e){ return e!==x.ent; }); return React.createElement("div",{key:i,style:rowS},
        React.createElement("div",null, tf("rec_missing_l",{name:x.name, amount:eur(x.amount), day:x.day})),
        x.id && React.createElement("div",{style:actRow},
          React.createElement("button",{style:mb,onClick:function(){ hideIssue("miss",x); }}, t("rec_hide")),
          others.length>0 && React.createElement(React.Fragment,null,
            React.createElement("span",{style:{fontSize:11.5,color:"var(--muted-2)"}}, t("rec_pay_from")),
            others.map(function(e){ return React.createElement("button",{key:e,style:mb,onClick:function(){ reassign(x,e); }}, "↪ "+entOf(e).label); })))
      ); })
    ),
    r.newCharges.length>0 && React.createElement(React.Fragment,{key:"nc"},
      React.createElement("div",{style:Object.assign({},secT,{color:"var(--blue)"})}, t("rec_new_t")),
      r.newCharges.map(function(x,i){ const k=keyOf(x); return React.createElement("div",{key:i,style:Object.assign({},rowS,{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8})},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:700}}, eur(x.amount)+" · "+(x.merchant||"")),
          React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)"}}, tf("rec_new_l",{merchant:(x.card?t("rec_card"):entOf(x.ent).label), day:recDay(x.date)||"?"}))),
        added[k]
          ? React.createElement("span",{style:{fontSize:12,color:"var(--mint)",fontWeight:700,whiteSpace:"nowrap"}}, t("rec_added"))
          : React.createElement("div",{style:{display:"flex",gap:6,flexShrink:0}},
              React.createElement("button",{onClick:function(){ addAsFixed(x); },style:Object.assign({},mb,{padding:"6px 10px",fontSize:12})}, t("rec_add")),
              React.createElement("button",{onClick:function(){ dismiss(x); },style:Object.assign({},mb,{padding:"6px 10px",fontSize:12,color:"var(--muted-2)"})}, t("rec_ignore"))
            )
      ); })
    ),
    r.confirmed.length>0 && React.createElement("div",{key:"cf",style:Object.assign({},rowS,{color:"var(--mint)",fontWeight:700})}, tf("rec_confirmed",{n:r.confirmed.length})),
    r.feed.length>0 && React.createElement("details",{key:"fd",style:{marginTop:10}},
      React.createElement("summary",{style:{fontSize:12,fontWeight:800,color:"var(--muted)",cursor:"pointer"}}, t("rec_feed")),
      r.feed.slice(0,12).map(function(tx,i){ const inc=(tx.amount||0)<0; return React.createElement("div",{key:i,style:Object.assign({},rowS,{display:"flex",justifyContent:"space-between",gap:8})},
        React.createElement("span",{style:{color:"var(--muted)"}}, (recDay(tx.date)||"")+" · "+(tx.merchant||"")),
        React.createElement("span",{className:"num",style:{fontWeight:700,color:inc?"var(--mint)":"var(--text)",whiteSpace:"nowrap"}}, (inc?"+":"")+eur(Math.abs(tx.amount)))
      ); })
    ),
    React.createElement("div",{key:"hint",style:{fontSize:11,color:"var(--muted-2)",marginTop:10,lineHeight:1.4}}, t("rec_hint"))
  );
}

function Fijos({state, set, totals}){
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({});
  const [draftM,setDraftM]=useState({});
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({name:"",amount:"",freq:"mes",months:[],day:""});
  const monthly=(e)=>{ if(hasSchedule(e)){ return e.schedule.reduce((a,x)=>a+(x.amt||0),0)/12; } return e.amount*(FREQ_M[e.freq]||1); };
  const list=state.fixed.slice().sort((a,b)=>monthly(b)-monthly(a));
  const servSum=state.fixed.reduce((a,e)=>a+monthly(e),0);
  const cuotas=state.debts.reduce((a,d)=>a+(debtActive(d)?(d.monthly||0):0),0);
  const grand=servSum+cuotas;
  const top=list.filter(e=>monthly(e)>0)[0];

  // bancos disponibles (de las cuentas que tiene el usuario), Sabadell primero
  const banks=Array.from(new Set(state.accounts.map(a=>a.ent)));
  if(banks.indexOf("sabadell")>0){ banks.splice(banks.indexOf("sabadell"),1); banks.unshift("sabadell"); }
  // el default "sabadell" solo vale si ESTE usuario tiene Sabadell; si no, el <select> enseñaba un
  // banco pero se guardaba otro (multiusuario 2026-07-11) → siempre un banco de SU lista
  const bankOr=(b)=> banks.indexOf(b)>=0 ? b : (banks[0]||"sabadell");

  // lecturas robustas: si el borrador no tiene el id (p.ej. recién añadido en modo edición), usa el valor real
  const dAmt=(e)=> draft[e.id]!=null ? draft[e.id] : e.amount;
  const dMonths=(e)=> draftM[e.id]!=null ? draftM[e.id] : (hasSchedule(e)? e.schedule.map(x=>x.m) : (e.months||[]));
  const dBank=(e)=> draft["b_"+e.id]!=null ? draft["b_"+e.id] : accOf(e);
  const dDay=(e)=> draft["d_"+e.id]!=null ? draft["d_"+e.id] : (e.day||"");
  const cleanDay=(v)=>{ const n=parseInt(String(v),10); return (n>=1&&n<=31)?n:null; };
  // importes/días a medida por cobro (schedule)
  const dSched=(e)=> draft["sc_"+e.id]!=null ? draft["sc_"+e.id] : hasSchedule(e);
  const dSA=(e,m)=>{ const k="sa_"+e.id+"_"+m; return draft[k]!=null ? draft[k] : (hasSchedule(e)? (((e.schedule.find(x=>x.m===m)||{}).amt)||"") : occAmountIn(e,m)); };
  const dSD=(e,m)=>{ const k="sd_"+e.id+"_"+m; return draft[k]!=null ? draft[k] : (dayIn(e,m)||""); };

  const startEdit=()=>{ const d={},dm={}; state.fixed.forEach(e=>{d[e.id]=e.amount; d["b_"+e.id]=accOf(e); d["d_"+e.id]=e.day||""; d["sc_"+e.id]=hasSchedule(e); dm[e.id]=(hasSchedule(e)?e.schedule.map(x=>x.m):(e.months||[])).slice(); if(hasSchedule(e)){ e.schedule.forEach(x=>{ d["sa_"+e.id+"_"+x.m]=x.amt; d["sd_"+e.id+"_"+x.m]=x.day||""; }); }}); setDraft(d); setDraftM(dm); setEditing(true); };
  const toggleSched=(id)=> setDraft(d=>Object.assign({},d,{["sc_"+id]: !(d["sc_"+id]!=null?d["sc_"+id]:hasSchedule((state.fixed.find(x=>x.id===id)||{})))}));
  const saveEdit=()=>{ set(s=>Object.assign({},s,{fixed:s.fixed.map(e=>{
      const base=Object.assign({},e,{amount:parseFloat(String(dAmt(e)).replace(',','.'))||0, account:dBank(e), day:cleanDay(dDay(e)), months:dMonths(e).slice().sort((a,b)=>a-b)});
      if(e.freq!=="mes" && dSched(e)){
        const ms=dMonths(e).slice().sort((a,b)=>a-b);
        base.schedule=ms.map(m=>({ m:m, amt:parseFloat(String(dSA(e,m)).replace(',','.'))||0, day:cleanDay(dSD(e,m)) }));
      } else { delete base.schedule; }
      return base;
    })})); setEditing(false); };
  const toggleDraftM=(id,m)=> setDraftM(dm=>{ const base=dm[id]!=null?dm[id]:(((state.fixed.find(x=>x.id===id)||{}).months)||[]); const cur=base.slice(); const i=cur.indexOf(m); if(i>=0)cur.splice(i,1); else cur.push(m); return Object.assign({},dm,{[id]:cur}); });
  const del=(id)=> set(s=>Object.assign({},s,{fixed:s.fixed.filter(e=>e.id!==id)}));
  const toggleFormM=(m)=> setForm(f=>{ const cur=(f.months||[]).slice(); const i=cur.indexOf(m); if(i>=0)cur.splice(i,1); else cur.push(m); return Object.assign({},f,{months:cur}); });
  const addFixed=()=>{ const amt=parseFloat(String(form.amount).replace(',','.'))||0; if(amt===0){ return; } const it={id:uid(),name:form.name||"Gasto fijo",amount:amt,freq:form.freq,account:bankOr(form.account||"sabadell")}; const dd=cleanDay(form.day); if(dd) it.day=dd; if(form.freq!=="mes"&&form.months&&form.months.length) it.months=form.months.slice().sort((a,b)=>a-b); set(s=>Object.assign({},s,{fixed:s.fixed.concat([it])})); setForm({name:"",amount:"",freq:"mes",months:[],day:"",account:(form.account||"sabadell")}); setAdding(false); };

  // --- edición de cuotas de deuda (día + banco + cuota), igual que los gastos fijos ---
  const [editingD,setEditingD]=useState(false);
  const [draftD,setDraftD]=useState({});
  const dDMon=(x)=> draftD[x.id]!=null?draftD[x.id]:x.monthly;
  const dDBank=(x)=> draftD["b_"+x.id]!=null?draftD["b_"+x.id]:(x.account||"sabadell");
  const dDDay=(x)=> draftD["dy_"+x.id]!=null?draftD["dy_"+x.id]:(x.day||"");
  const dDAmort=(x)=> draftD["am_"+x.id]!=null?draftD["am_"+x.id]:(x.amort!=null?x.amort:(x.monthly||""));
  const startEditD=()=>{ const d={}; state.debts.forEach(x=>{ d[x.id]=x.monthly; d["b_"+x.id]=x.account||"sabadell"; d["dy_"+x.id]=x.day||""; d["am_"+x.id]=(x.amort!=null?x.amort:(x.monthly||"")); }); setDraftD(d); setEditingD(true); };
  const saveEditD=()=>{ set(s=>Object.assign({},s,{debts:s.debts.map(x=>{ const mon=parseFloat(String(dDMon(x)).replace(',','.'))||0; const am=parseFloat(String(dDAmort(x)).replace(',','.')); const o=Object.assign({},x,{ monthly:mon, account:dDBank(x), day:cleanDay(dDDay(x)) }); if(am>0 && Math.abs(am-mon)>0.005){ o.amort=am; } else { delete o.amort; } return o; })})); setEditingD(false); };

  // --- edición de movimientos recurrentes (nómina + transferencias) — motor cash-flow ---
  const flows=state.flows||[];
  const [editingF,setEditingF]=useState(false);
  const [draftF,setDraftF]=useState({});
  const [addingF,setAddingF]=useState(false);
  const [formF,setFormF]=useState({kind:"income",name:"",amount:"",day:"",when:"",to:"sabadell",from:"sabadell",once:false,month:new Date().getMonth()+1,year:new Date().getFullYear()});
  const fAmt=(f)=> draftF[f.id]!=null?draftF[f.id]:f.amount;
  const fDay=(f)=> draftF["dy_"+f.id]!=null?draftF["dy_"+f.id]:(f.day||"");
  const fWhen=(f)=> draftF["wh_"+f.id]!=null?draftF["wh_"+f.id]:(f.when||"");
  const fTo=(f)=> draftF["to_"+f.id]!=null?draftF["to_"+f.id]:(f.to||"sabadell");
  const fFrom=(f)=> draftF["fr_"+f.id]!=null?draftF["fr_"+f.id]:(f.from||"sabadell");
  const startEditF=()=>{ const d={}; flows.forEach(f=>{ d[f.id]=f.amount; d["dy_"+f.id]=f.day||""; d["wh_"+f.id]=f.when||""; d["to_"+f.id]=f.to||"sabadell"; d["fr_"+f.id]=f.from||"sabadell"; }); setDraftF(d); setEditingF(true); };
  const saveEditF=()=>{ set(s=>Object.assign({},s,{flows:(s.flows||[]).map(f=>{ const wh=fWhen(f); const o=Object.assign({},f,{amount:parseFloat(String(fAmt(f)).replace(',','.'))||0}); if(wh){ o.when=wh; delete o.day; } else { o.when=undefined; delete o.when; o.day=cleanDay(fDay(f)); } if(f.kind==="income"){ o.to=fTo(f); delete o.from; } else { o.from=fFrom(f); o.to=fTo(f); } return o; })})); setEditingF(false); };
  const delFlow=(id)=> set(s=>Object.assign({},s,{flows:(s.flows||[]).filter(f=>f.id!==id)}));
  const addFlow=()=>{ const amt=parseFloat(String(formF.amount).replace(',','.'))||0; if(amt===0) return; const it={id:uid(),kind:formF.kind,name:formF.name||(formF.kind==="income"?"Ingreso":"Transferencia"),amount:amt}; if(formF.when){ it.when=formF.when; } else { const dd=cleanDay(formF.day); if(dd) it.day=dd; } if(formF.kind==="income"){ it.to=formF.to||"sabadell"; } else { it.from=formF.from||"sabadell"; it.to=formF.to||"trade_republic"; } if(formF.once){ it.once={y:parseInt(formF.year,10)||new Date().getFullYear(), m:parseInt(formF.month,10)||(new Date().getMonth()+1)}; } set(s=>Object.assign({},s,{flows:(s.flows||[]).concat([it])})); setFormF({kind:"income",name:"",amount:"",day:"",when:"",to:"sabadell",from:"sabadell",once:false,month:new Date().getMonth()+1,year:new Date().getFullYear()}); setAddingF(false); };
  const whenLabel=(f)=> f.when==="last"?t("fj_when_last"):f.when==="first"?t("fj_when_first"):(f.day?tf("fj_day_n",{d:f.day}):null);

  // --- cargos puntuales (un solo cobro): imprevistos, amortizaciones… ---
  const [addingO,setAddingO]=useState(false);
  const [formO,setFormO]=useState({name:"",amount:"",month:new Date().getMonth()+1,year:new Date().getFullYear(),day:"",account:"sabadell"});
  const addOneoff=()=>{ const amt=parseFloat(String(formO.amount).replace(',','.'))||0; if(amt===0) return; const it={id:uid(),name:formO.name||"Cargo puntual",amount:amt,month:parseInt(formO.month,10)||(new Date().getMonth()+1),year:parseInt(formO.year,10)||new Date().getFullYear(),account:bankOr(formO.account||"sabadell")}; const dd=cleanDay(formO.day); if(dd) it.day=dd; set(s=>Object.assign({},s,{oneoffs:(s.oneoffs||[]).concat([it])})); setFormO({name:"",amount:"",month:new Date().getMonth()+1,year:new Date().getFullYear(),day:"",account:"sabadell"}); setAddingO(false); };
  const delOneoff=(id)=> set(s=>Object.assign({},s,{oneoffs:(s.oneoffs||[]).filter(o=>o.id!==id)}));
  const [editingO,setEditingO]=useState(false);   // modo edición GLOBAL de la tarjeta (como Servicios)
  const [draftsO,setDraftsO]=useState({});
  const startEditAllO=(list)=>{ const d={}; list.forEach(function(o){ d[o.id]={name:o.name,amount:String(o.amount),day:o.day?String(o.day):"",month:o.month,year:o.year,account:o.account||"sabadell"}; }); setDraftsO(d); setEditingO(true); };
  const setDO=(id,k,v)=> setDraftsO(function(dr){ const n=Object.assign({},dr); n[id]=Object.assign({},n[id],{[k]:v}); return n; });
  const saveAllO=()=>{ set(s=>Object.assign({},s,{oneoffs:(s.oneoffs||[]).map(function(o){ const dd=draftsO[o.id]; if(!dd) return o; const amt=parseFloat(String(dd.amount).replace(',','.')); const day=cleanDay(dd.day); const n=Object.assign({},o,{name:dd.name||o.name,amount:isNaN(amt)?o.amount:amt,month:parseInt(dd.month,10)||o.month,year:parseInt(dd.year,10)||o.year,account:dd.account||"sabadell"}); if(day) n.day=day; else delete n.day; return n; })})); setEditingO(false); };

  // resumen de meses para el subtítulo de cada fila
  const monthsLabel=(e)=>{ const ms=chargeMonths(e); if(e.freq==="mes"||ms.length>=12) return null; if(!ms.length) return t("fj_nomonth"); return ms.map(m=>monthShort(m-1)).join(", "); };

  // --- Próximos cargos (motor dinámico): qué se cobra este mes y el que viene ---
  const cm=totals.curMonth, nm=cm===12?1:cm+1, today=totals.today, cy=totals.curYear, ny=cm===12?cy+1:cy;
  const oneoffs=state.oneoffs||[];
  const chargesOf=(mo,yr)=>{ const items=[];
    state.fixed.forEach(e=>{ if(occursIn(e,mo)&&occAmountIn(e,mo)!==0) items.push({key:e.id,name:e.name,amount:occAmountIn(e,mo),bank:accOf(e),day:dayIn(e,mo),paid:mo===cm&&isPaidIn(e,mo,today)}); });
    state.debts.forEach(d=>{ if(debtActive(d)){ items.push({key:d.id,name:d.name,amount:d.monthly,debt:true,bank:d.account||"sabadell",day:debtChargeDay(d),paid:mo===cm&&isDebtPaidThisMonth(d,today)}); const bl=debtBalloonIn(d,yr,mo); if(bl>0) items.push({key:d.id+"_balloon",name:d.name+" "+t("db_balloon_tag"),amount:bl,debt:true,bank:d.account||"sabadell",day:debtChargeDay(d),paid:mo===cm&&isDebtPaidThisMonth(d,today)}); } });
    oneoffs.forEach(o=>{ if(oneoffOccurs(o,yr,mo)&&(o.amount||0)!==0) items.push({key:o.id,name:o.name,amount:o.amount,oneoff:true,bank:o.account||"sabadell",day:o.day||null,paid:mo===cm&&yr===cy&&isPaidThisMonth(o,today)}); });
    return items; };
  const byDay=(a,b)=> ((a.day||99)-(b.day||99)) || (b.amount-a.amount);   // por DÍA; sin día, al final
  // flujos de efectivo del mes (nómina + transferencias): se mezclan con el resto, ordenados por día
  const flowsOf=(mo,yr)=> (state.flows||[]).filter(f=>flowOccursIn(f,mo,yr)).map(f=>({
    key:f.id, name:f.name, flow:true, kind:f.kind,
    amount: f.kind==="income" ? -(f.amount||0) : (f.amount||0),   // ingreso = entra (verde +) · transfer = sale
    bank: f.kind==="income" ? (f.to||"sabadell") : (f.from||"sabadell"),
    day: flowDay(f,yr,mo), paid: mo===cm&&yr===cy ? flowPaid(f,yr,mo,today) : false
  }));
  const thisM=chargesOf(cm,cy).concat(flowsOf(cm,cy)).sort(byDay);
  const nextM=chargesOf(nm,ny);
  const thisPending=thisM.filter(x=>!x.paid), thisPaid=thisM.filter(x=>x.paid);
  const nextSum=nextM.reduce((a,x)=>a+x.amount,0);   // solo cargos (sin flujos) para el subtotal
  const rowCharge=(x)=> React.createElement("div",{className:"row"+(x.paid?" paid-row":""),key:x.key},
    React.createElement("div",{className:"rl"},React.createElement("div",null,
      React.createElement("div",{className:"rname"}, x.name, x.day && React.createElement("span",{className:"day-badge"},tf("fj_day_n",{d:x.day}))),
      React.createElement("div",{className:"rsub"}, (x.paid?t("fj_paid_tag"):"")+(x.flow?(x.kind==="income"?t("fj_income_tag"):t("fj_transfer_tag")):x.oneoff?t("fj_oneoff_tag"):x.debt?t("fj_debt_tag"):t("fj_fixed_tag"))+(x.bank&&x.bank!=="sabadell"?" · "+entOf(x.bank).label:"")))),
    React.createElement("div",{className:"rval num",style:x.amount<0?{color:"var(--mint)"}:null},(x.amount<0?"+":"")+eur(Math.abs(x.amount))));
  // totales por mes (12) para detectar meses "cargados" por encima de lo normal
  const monthTotals=[]; for(let mo=1;mo<=12;mo++){ let tt=0; state.fixed.forEach(e=>{ if(occursIn(e,mo)) tt+=occAmountIn(e,mo); }); tt+=cuotas; monthTotals[mo]=tt; }
  const avgMonth=monthTotals.slice(1).reduce((a,b)=>a+b,0)/12;
  // primer mes de los próximos 4 que se dispara (>30% sobre la media)
  let heavy=null; for(let k=0;k<4;k++){ const mo=((cm-1+k)%12)+1; if(monthTotals[mo]>avgMonth*1.3 && monthTotals[mo]>avgMonth+150){ heavy={mo:mo,total:monthTotals[mo],soon:k}; break; } }

  return React.createElement("div",null,
    React.createElement("div",{className:"total-bar"},
      React.createElement("div",null,React.createElement("div",{className:"tl"},t("fj_monthly")),React.createElement("div",{className:"tn num"},eur(grand))),
      React.createElement("div",{className:"cnt"},tf("fj_peryear",{x:eur0(grand*12)}))
    ),
    top && React.createElement("div",{className:"culpa"},
      React.createElement("span",null,t("fj_top_a")),
      React.createElement("span",{className:"big",style:{fontSize:15}}, top.name),
      React.createElement("span",null,tf("fj_top_b",{x:eur0(monthly(top))}))
    ),
    React.createElement(OrderableSections,{tab:"fijos",state:state,set:set,items:[
      {id:"afford",label:t("af_title"),el:React.createElement(AffordSim,{state:state, totals:totals, set:set})},
      {id:"recon",label:t("rec_title"),el:React.createElement(Reconcile,{state:state, set:set})},
      /* MOTOR DINÁMICO: próximos cargos */
      {id:"prox",label:tf("fj_prox",{m:monthShort(cm-1)}),el:
    React.createElement(CollapsibleCard,{title:tf("fj_prox",{m:monthShort(cm-1)}),sub:tf("fj_prox_sub",{x:eur0(totals.cargosMes)}),dot:"#E2A05F",storageKey:"f_prox",defaultOpen:true},
      // estado del banco principal (Sabadell): cash-flow del mes (saldo + nómina − transfers − fijos)
      React.createElement("div",{className:"liqbox"+((totals.mainMin<0||totals.mainProjected<0)?" danger":"")},
        React.createElement("div",{className:"liqrow"},
          React.createElement("span",{className:"muted"},tf("fj_today",{bank:entOf(totals.mainBank).label})),
          React.createElement("span",{className:"num"},eur0(totals.mainBal))),
        totals.mainIncome>0 && React.createElement("div",{className:"liqrow"},
          React.createElement("span",{className:"muted"},t("fj_in")),
          React.createElement("span",{className:"num",style:{color:"var(--mint)"}},"+"+eur0(totals.mainIncome))),
        totals.mainTransferOut>0 && React.createElement("div",{className:"liqrow"},
          React.createElement("span",{className:"muted"},t("fj_transf")),
          React.createElement("span",{className:"num"},"−"+eur0(totals.mainTransferOut))),
        React.createElement("div",{className:"liqrow"},
          React.createElement("span",{className:"muted"},t("fj_pend")),
          React.createElement("span",{className:"num"},"−"+eur0(totals.mainPending))),
        React.createElement("div",{className:"liqrow strong"},
          React.createElement("span",null,t("fj_eom")),
          React.createElement("span",{className:"num",style:{color:totals.mainProjected<0?"var(--coral)":"var(--mint)"}},eur0(totals.mainProjected))),
        // punto más bajo del mes (importa el orden: si los fijos salen antes de cobrar)
        (totals.mainMin < totals.mainProjected-0.5) && React.createElement("div",{className:"liqrow",style:{color:totals.mainMin<0?"var(--coral)":"var(--muted-2)"}},
          React.createElement("span",null,(totals.mainMin<0?"⚠ ":"")+(totals.mainMinDay?tf("fj_low_day",{d:totals.mainMinDay}):t("fj_low"))),
          React.createElement("span",{className:"num"},eur0(totals.mainMin)))
      ),
      // ALARMA: el saldo mínimo del mes se va a negativo (bajón antes de cobrar o no llegar a fin de mes)
      totals.bankAlerts.length>0 && React.createElement("div",{className:"alarmbox"},
        t("fj_alarm"),totals.bankAlerts.map(b=>entOf(b).label).join(", "),
        (totals.bankAlerts.length===1 && totals.minDayByBank[totals.bankAlerts[0]])
          ? tf("fj_alarm_a",{x:eur0(totals.minByBank[totals.bankAlerts[0]]),d:totals.minDayByBank[totals.bankAlerts[0]]})
          : t("fj_alarm_b")),
      // aviso de mes cargado en el horizonte
      heavy && React.createElement("div",{className:"hint",style:{margin:"8px 0 4px",color:"#E2A05F",fontWeight:600}},
        (heavy.soon===0?t("fj_heavy_now"):heavy.soon===1?t("fj_heavy_next"):tf("fj_heavy_in",{m:monthShort(heavy.mo-1)}))+tf("fj_heavy_b",{x:eur0(heavy.total),avg:eur0(avgMonth)})),
      React.createElement("div",{className:"hint",style:{margin:"8px 0 4px"}}, thisPending.length?tf("fj_pend_in",{m:monthShort(cm-1)}):t("fj_allpaid")),
      thisPending.map(rowCharge),
      thisPaid.length>0 && React.createElement("div",{className:"hint",style:{margin:"10px 0 2px"}},tf("fj_paid_m",{x:eur0(totals.paidThisMonth)})),
      thisPaid.map(rowCharge),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},tf("fj_pend_tot",{m:monthShort(cm-1)})),React.createElement("span",{className:"num"},eur(totals.pendingThisMonth))),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},tf("fj_next_m",{m:monthShort(nm-1)})),React.createElement("span",{className:"num"},eur(nextSum))),
      totals.sinProgramar>0 && React.createElement("div",{className:"hint",style:{marginTop:8,color:"#E2A05F"}},tf("fj_noprog",{n:totals.sinProgramar}))
    )},
      {id:"serv",label:t("fj_serv"),el:
    React.createElement(CollapsibleCard,{title:t("fj_serv"),sub:tf("fj_permonth",{x:eur0(servSum)}),dot:"#7FB5E8",storageKey:"f_serv",help:t("h_serv"),
      right:React.createElement("button",{className:"edit-link"+(editing?" save":""),onClick:e=>{e.stopPropagation(); editing?saveEdit():startEdit();}},editing?t("fj_save"):t("fj_edit"))},
      list.map(e=>{
        const m=monthly(e); const isCredit=m<0; const mlbl=monthsLabel(e);
        const nMonths=chargeMonths(e).length;
        const schedTotal=hasSchedule(e)? e.schedule.reduce((a,x)=>a+(x.amt||0),0) : 0;
        const perCharge=hasSchedule(e) ? tf("fj_custom",{x:eur0(schedTotal)}) : ((e.freq==="año"||e.freq==="anual")&&nMonths>1 ? tf("fj_percharge",{x:eur0(occAmount(e))}) : "");
        const row=React.createElement("div",{className:"row",key:e.id},
          React.createElement("div",{className:"rl"},
            editing && React.createElement("button",{className:"del-btn",onClick:()=>del(e.id)},"✕"),
            React.createElement("div",null,
              React.createElement("div",{className:"rname"},e.name),
              React.createElement("div",{className:"rsub"},
                (e.freq!=="mes" ? freqLabel(e.freq)+(hasSchedule(e)?"":" · "+eur(e.amount)+"/"+(e.freq==="año"?t("fj_year"):t("fj_time")))+perCharge : t("fj_mensual")),
                accOf(e)!=="sabadell" && React.createElement("span",null," · "+entOf(accOf(e)).label),
                mlbl && React.createElement("span",{style:{color:needsMonth(e)?"#E2A05F":"var(--muted-2)"}}," · "+mlbl)
              )
            )
          ),
          editing
            ? React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                React.createElement("input",{className:"editv num",value:dAmt(e),inputMode:"decimal",onChange:ev=>{const v=ev.target.value;setDraft(d=>Object.assign({},d,{[e.id]:v}));}}),
                React.createElement("span",{style:{fontSize:11,color:"var(--muted-2)"}},"/"+freqLabel(e.freq).slice(0,3))
              )
            : React.createElement("div",{className:"rval num",style:isCredit?{color:"var(--mint)"}:null},
                React.createElement("div",null, (isCredit?"+":"")+eur(Math.abs(m)) ),
                e.freq!=="mes" && React.createElement("div",{className:"rvsub",style:{color:"var(--muted-2)"}},t("fj_prorated"))
              )
        );
        if(editing){
          return React.createElement("div",{key:e.id,style:{borderBottom:"1px solid var(--line-soft)"}},
            row,
            React.createElement("div",{style:{padding:"2px 4px 10px"}},
              React.createElement("div",{className:"edit-extra"},
                React.createElement("span",{className:"rsub"},t("fj_chargedin")),
                React.createElement("select",{className:"af-in",style:{width:"auto",padding:"6px 9px",fontSize:12.5},value:dBank(e),onChange:ev=>{const v=ev.target.value;setDraft(d=>Object.assign({},d,{["b_"+e.id]:v}));}}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label))),
                React.createElement("span",{className:"rsub",style:{marginLeft:4}},t("fj_day")),
                React.createElement("input",{className:"af-in num",style:{width:54,padding:"6px 8px",fontSize:12.5},inputMode:"numeric",placeholder:"—",value:dDay(e),onChange:ev=>{const v=ev.target.value;setDraft(d=>Object.assign({},d,{["d_"+e.id]:v}));}})
              ),
              e.freq!=="mes" && React.createElement("div",{style:{marginTop:8}},
                React.createElement("div",{className:"rsub",style:{marginBottom:5}},t("fj_whatmonths")),
                React.createElement(MonthPicker,{selected:dMonths(e),onToggle:(mm)=>toggleDraftM(e.id,mm)})
              ),
              e.freq!=="mes" && dMonths(e).length>0 && React.createElement("div",{style:{marginTop:8}},
                React.createElement("button",{type:"button",className:"mchip"+(dSched(e)?" on":""),style:{width:"auto",padding:"5px 10px"},onClick:()=>toggleSched(e.id)}, (dSched(e)?"✓ ":"")+t("fj_diffamounts")),
                dSched(e) && React.createElement("div",{style:{marginTop:8}},
                  dMonths(e).slice().sort((a,b)=>a-b).map(m=>React.createElement("div",{key:m,className:"sched-row"},
                    React.createElement("span",{className:"rsub",style:{width:34}},monthShort(m-1)),
                    React.createElement("input",{className:"af-in num",style:{flex:1,padding:"6px 8px",fontSize:12.5},inputMode:"decimal",placeholder:t("fj_amount"),value:dSA(e,m),onChange:ev=>{const v=ev.target.value;setDraft(d=>Object.assign({},d,{["sa_"+e.id+"_"+m]:v}));}}),
                    React.createElement("span",{className:"rsub"},t("fj_day")),
                    React.createElement("input",{className:"af-in num",style:{width:50,padding:"6px 8px",fontSize:12.5},inputMode:"numeric",placeholder:"—",value:dSD(e,m),onChange:ev=>{const v=ev.target.value;setDraft(d=>Object.assign({},d,{["sd_"+e.id+"_"+m]:v}));}})
                  )),
                  React.createElement("div",{className:"hint",style:{fontSize:11}},t("fj_sched_hint"))
                )
              )
            )
          );
        }
        return row;
      }),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("fj_serv_tot")),React.createElement("span",{className:"num"},eur(servSum))),
      adding
        ? React.createElement("div",{className:"add-form",style:{marginTop:12}},
            React.createElement("input",{className:"af-in",placeholder:t("fj_concept_gym"),value:form.name,onChange:e=>setForm(Object.assign({},form,{name:e.target.value}))}),
            React.createElement("div",{className:"af-row"},
              React.createElement("input",{className:"af-in num",placeholder:"0,00 €",inputMode:"decimal",value:form.amount,onChange:e=>setForm(Object.assign({},form,{amount:e.target.value}))}),
              React.createElement("select",{className:"af-in",value:form.freq,onChange:e=>setForm(Object.assign({},form,{freq:e.target.value,months:[]}))}, FREQ_OPTS.map(f=>React.createElement("option",{key:f,value:f},freqLabel(f))))
            ),
            form.freq!=="mes" && React.createElement("div",{style:{marginTop:4}},
              React.createElement("div",{className:"rsub",style:{marginBottom:5}},t("fj_whatmonths_opt")),
              React.createElement(MonthPicker,{selected:form.months,onToggle:toggleFormM})
            ),
            React.createElement("div",{className:"edit-extra"},
              React.createElement("span",{className:"rsub"},t("fj_chargedin")),
              React.createElement("select",{className:"af-in",style:{width:"auto",padding:"8px 11px"},value:bankOr(form.account||"sabadell"),onChange:e=>setForm(Object.assign({},form,{account:e.target.value}))}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label))),
              React.createElement("span",{className:"rsub",style:{marginLeft:4}},t("fj_day")),
              React.createElement("input",{className:"af-in num",style:{width:60,padding:"8px 10px"},inputMode:"numeric",placeholder:"—",value:form.day,onChange:e=>setForm(Object.assign({},form,{day:e.target.value}))})
            ),
            React.createElement("div",{className:"hint",style:{fontSize:11.5}},t("fj_day_hint")),
            React.createElement("div",{className:"af-row"},
              React.createElement("button",{className:"btn btn-ghost",style:{flex:1},onClick:()=>{setAdding(false); setForm({name:"",amount:"",freq:"mes",months:[],day:"",account:"sabadell"});}},t("fj_cancel")),
              React.createElement("button",{className:"btn btn-primary",style:{flex:2},onClick:addFixed},t("fj_addfixed"))
            )
          )
        : React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:12},onClick:()=>setAdding(true)},React.createElement(I.plus,{width:16,height:16}),t("fj_addfixed"))
    )},
      {id:"cuotas",label:t("fj_debts"),el:
    React.createElement(CollapsibleCard,{title:t("fj_debts"),sub:tf("fj_permonth",{x:eur0(cuotas)}),dot:"#E2705F",storageKey:"f_cuotas",help:t("h_debts"),
      right:React.createElement("button",{className:"edit-link"+(editingD?" save":""),onClick:e=>{e.stopPropagation(); editingD?saveEditD():startEditD();}},editingD?t("fj_save"):t("fj_edit"))},
      state.debts.map(d=>{
        const bnk=d.account||"sabadell";
        const row=React.createElement("div",{className:"row",key:d.id},
          React.createElement("div",{className:"rl"},React.createElement(Mono,{ent:d.ent,size:38}),
            React.createElement("div",null,
              React.createElement("div",{className:"rname"}, d.name, d.day && React.createElement("span",{className:"day-badge"},tf("fj_day_n",{d:d.day}))),
              React.createElement("div",{className:"rsub"},tf("fj_pending",{x:eur0(debtBalance(d))})+(bnk!=="sabadell"?" · "+entOf(bnk).label:"")))),
          editingD
            ? React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                React.createElement("input",{className:"editv num",style:{width:70},value:dDMon(d),inputMode:"decimal",onChange:ev=>{const v=ev.target.value;setDraftD(s=>Object.assign({},s,{[d.id]:v}));}}),
                React.createElement("span",{style:{fontSize:11,color:"var(--muted-2)"}},t("fj_permonth2")))
            : React.createElement("div",{className:"rval num"},eur(d.monthly)+t("fj_permonth2"))
        );
        if(editingD){
          return React.createElement("div",{key:d.id,style:{borderBottom:"1px solid var(--line-soft)"}},
            row,
            React.createElement("div",{style:{padding:"2px 4px 10px"}},
              React.createElement("div",{className:"edit-extra"},
                React.createElement("span",{className:"rsub"},t("fj_chargedin")),
                React.createElement("select",{className:"af-in",style:{width:"auto",padding:"6px 9px",fontSize:12.5},value:dDBank(d),onChange:ev=>{const v=ev.target.value;setDraftD(s=>Object.assign({},s,{["b_"+d.id]:v}));}}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label))),
                React.createElement("span",{className:"rsub",style:{marginLeft:4}},t("fj_day")),
                React.createElement("input",{className:"af-in num",style:{width:54,padding:"6px 8px",fontSize:12.5},inputMode:"numeric",placeholder:"—",value:dDDay(d),onChange:ev=>{const v=ev.target.value;setDraftD(s=>Object.assign({},s,{["dy_"+d.id]:v}));}})
              ),
              React.createElement("div",{className:"edit-extra",style:{marginTop:6}},
                React.createElement("span",{className:"rsub"},t("fj_amort")),
                React.createElement("input",{className:"af-in num",style:{width:80,padding:"6px 8px",fontSize:12.5},inputMode:"decimal",value:dDAmort(d),onChange:ev=>{const v=ev.target.value;setDraftD(s=>Object.assign({},s,{["am_"+d.id]:v}));}}),
                React.createElement("span",{className:"rsub",style:{flex:1}},t("fj_amort_hint"))
              )
            )
          );
        }
        return row;
      }),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("fj_debts_tot")),React.createElement("span",{className:"num"},eur(cuotas))),
      React.createElement("div",{className:"hint",style:{fontSize:11.5,marginTop:6}},t("fj_debts_hint"))
    )},
      {id:"flows",label:t("fj_flows"),el:
    React.createElement(CollapsibleCard,{title:t("fj_flows"),sub:t("fj_flows_sub"),dot:"#5FD08A",storageKey:"f_flows",defaultOpen:false,help:t("h_flows"),
      right:React.createElement("button",{className:"edit-link"+(editingF?" save":""),onClick:e=>{e.stopPropagation(); editingF?saveEditF():startEditF();}},editingF?t("fj_save"):t("fj_edit"))},
      flows.filter(f=>!flowOncePast(f,cy,cm)).map(f=>{
        const inc=f.kind==="income";
        const sub=inc ? tf("fj_inc_to",{bank:entOf(f.to||"sabadell").label}) : tf("fj_tr_fromto",{from:entOf(f.from||"sabadell").label,to:entOf(f.to||"trade_republic").label});
        const row=React.createElement("div",{className:"row",key:f.id},
          React.createElement("div",{className:"rl"},
            editingF && React.createElement("button",{className:"del-btn",onClick:()=>delFlow(f.id)},"✕"),
            React.createElement("div",null,
              React.createElement("div",{className:"rname"}, f.name, whenLabel(f) && React.createElement("span",{className:"day-badge"},whenLabel(f)), f.once && React.createElement("span",{className:"day-badge",style:{background:"#E2A05F22",color:"#E2A05F",marginLeft:4}}, "📅 "+monthShort(f.once.m-1)+" "+f.once.y)),
              React.createElement("div",{className:"rsub"}, sub))),
          editingF
            ? React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                React.createElement("input",{className:"editv num",style:{width:74},value:fAmt(f),inputMode:"decimal",onChange:ev=>{const v=ev.target.value;setDraftF(s=>Object.assign({},s,{[f.id]:v}));}}))
            : React.createElement("div",{className:"rval num",style:{color:inc?"var(--mint)":null}}, (inc?"+":"−")+eur(Math.abs(f.amount)))
        );
        if(editingF){
          return React.createElement("div",{key:f.id,style:{borderBottom:"1px solid var(--line-soft)"}},
            row,
            React.createElement("div",{style:{padding:"2px 4px 10px"}},
              React.createElement("div",{className:"edit-extra"},
                React.createElement("span",{className:"rsub"}, inc?t("fj_entersin"):t("fj_from")),
                React.createElement("select",{className:"af-in",style:{width:"auto",padding:"6px 9px",fontSize:12.5},value: inc?fTo(f):fFrom(f),onChange:ev=>{const v=ev.target.value; const key=inc?"to_":"fr_"; setDraftF(s=>Object.assign({},s,{[key+f.id]:v}));}}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label))),
                !inc && React.createElement("span",{className:"rsub"},"→"),
                !inc && React.createElement("select",{className:"af-in",style:{width:"auto",padding:"6px 9px",fontSize:12.5},value:fTo(f),onChange:ev=>{const v=ev.target.value;setDraftF(s=>Object.assign({},s,{["to_"+f.id]:v}));}}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label))),
                React.createElement("span",{className:"rsub",style:{marginLeft:4}},t("fj_when")),
                React.createElement("select",{className:"af-in",style:{width:"auto",padding:"6px 9px",fontSize:12.5},value:fWhen(f),onChange:ev=>{const v=ev.target.value;setDraftF(s=>Object.assign({},s,{["wh_"+f.id]:v}));}},
                  React.createElement("option",{value:""},t("fj_fixedday")),
                  React.createElement("option",{value:"last"},t("fj_lastwork")),
                  React.createElement("option",{value:"first"},t("fj_firstwork"))),
                !fWhen(f) && React.createElement("input",{className:"af-in num",style:{width:50,padding:"6px 8px",fontSize:12.5},inputMode:"numeric",placeholder:t("fj_day"),value:fDay(f),onChange:ev=>{const v=ev.target.value;setDraftF(s=>Object.assign({},s,{["dy_"+f.id]:v}));}})
              )
            )
          );
        }
        return row;
      }),
      addingF
        ? React.createElement("div",{className:"add-form",style:{marginTop:12}},
            React.createElement("div",{className:"af-row"},
              React.createElement("button",{className:"btn "+(formF.kind==="income"?"btn-primary":"btn-ghost"),style:{flex:1},onClick:()=>setFormF(Object.assign({},formF,{kind:"income",to:"sabadell"}))},t("fj_income")),
              React.createElement("button",{className:"btn "+(formF.kind==="transfer"?"btn-primary":"btn-ghost"),style:{flex:1},onClick:()=>setFormF(Object.assign({},formF,{kind:"transfer",from:"sabadell",to:(banks.filter(b=>b!=="sabadell")[0]||"trade_republic")}))},t("fj_transfer"))
            ),
            React.createElement("div",{className:"af-row"},
              React.createElement("button",{className:"btn "+(!formF.once?"btn-primary":"btn-ghost"),style:{flex:1},onClick:()=>setFormF(Object.assign({},formF,{once:false}))},"🔁 "+t("fj_recurring")),
              React.createElement("button",{className:"btn "+(formF.once?"btn-primary":"btn-ghost"),style:{flex:1},onClick:()=>setFormF(Object.assign({},formF,{once:true}))},"📅 "+t("fj_once"))
            ),
            formF.once && React.createElement("div",{className:"edit-extra"},
              React.createElement("span",{className:"rsub"}, t("fj_month")),
              React.createElement("select",{className:"af-in",style:{width:"auto",padding:"8px 11px"},value:formF.month,onChange:e=>setFormF(Object.assign({},formF,{month:e.target.value}))}, MONTHS_ES.map((lbl,i)=>React.createElement("option",{key:i+1,value:i+1},monthShort(i)))),
              React.createElement("span",{className:"rsub",style:{marginLeft:4}}, t("fj_year_lbl")),
              React.createElement("input",{className:"af-in num",style:{width:74,padding:"8px 10px"},inputMode:"numeric",value:formF.year,onChange:e=>setFormF(Object.assign({},formF,{year:e.target.value}))})
            ),
            React.createElement("input",{className:"af-in",placeholder:t("fj_concept_payroll"),value:formF.name,onChange:e=>setFormF(Object.assign({},formF,{name:e.target.value}))}),
            React.createElement("div",{className:"af-row"},
              React.createElement("input",{className:"af-in num",placeholder:"0,00 €",inputMode:"decimal",value:formF.amount,onChange:e=>setFormF(Object.assign({},formF,{amount:e.target.value}))}),
              React.createElement("select",{className:"af-in",value:formF.when,onChange:e=>setFormF(Object.assign({},formF,{when:e.target.value}))},
                React.createElement("option",{value:""},t("fj_fixedday")),
                React.createElement("option",{value:"last"},t("fj_lastwork")),
                React.createElement("option",{value:"first"},t("fj_firstwork"))),
              !formF.when && React.createElement("input",{className:"af-in num",placeholder:t("fj_day"),inputMode:"numeric",style:{maxWidth:70},value:formF.day,onChange:e=>setFormF(Object.assign({},formF,{day:e.target.value}))})
            ),
            React.createElement("div",{className:"edit-extra"},
              React.createElement("span",{className:"rsub"}, formF.kind==="income"?t("fj_entersin"):t("fj_from")),
              React.createElement("select",{className:"af-in",style:{width:"auto",padding:"8px 11px"},value: formF.kind==="income"?formF.to:formF.from,onChange:e=>{const v=e.target.value; setFormF(Object.assign({},formF, formF.kind==="income"?{to:v}:{from:v}));}}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label))),
              formF.kind==="transfer" && React.createElement("span",{className:"rsub"},"→"),
              formF.kind==="transfer" && React.createElement("select",{className:"af-in",style:{width:"auto",padding:"8px 11px"},value:formF.to,onChange:e=>setFormF(Object.assign({},formF,{to:e.target.value}))}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label)))
            ),
            React.createElement("div",{className:"af-row"},
              React.createElement("button",{className:"btn btn-ghost",style:{flex:1},onClick:()=>{setAddingF(false); setFormF({kind:"income",name:"",amount:"",day:"",when:"",to:"sabadell",from:"sabadell",once:false,month:new Date().getMonth()+1,year:new Date().getFullYear()});}},t("fj_cancel")),
              React.createElement("button",{className:"btn btn-primary",style:{flex:2},onClick:addFlow},t("fj_addmove"))
            )
          )
        : React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:12},onClick:()=>setAddingF(true)},React.createElement(I.plus,{width:16,height:16}),t("fj_addflow")),
      React.createElement("div",{className:"hint",style:{fontSize:11.5,marginTop:6}},t("fj_flows_hint"))
    )},
      {id:"oneoffs",label:t("fj_oneoffs"),el:
    (function(){ const up=oneoffs.filter(o=>!oneoffPast(o,cy,cm)).sort((a,b)=> (a.year-b.year)||(a.month-b.month) );
      return React.createElement(CollapsibleCard,{title:t("fj_oneoffs"),sub:t("fj_oneoffs_sub"),dot:"#E2A05F",storageKey:"f_oneoff",defaultOpen:false,help:t("h_oneoffs"),
        right: up.length? React.createElement("button",{className:"edit-link"+(editingO?" save":""),onClick:e=>{ e.stopPropagation(); editingO?saveAllO():startEditAllO(up); }}, editingO?t("fj_save"):t("fj_edit")) : null},
        up.length? up.map(function(o){
          if(editingO){
            const d=draftsO[o.id]||{}; return React.createElement("div",{className:"add-form",key:o.id,style:{marginBottom:10}},
              React.createElement("input",{className:"af-in",placeholder:t("fj_concept_amort"),value:d.name||"",onChange:e=>setDO(o.id,"name",e.target.value)}),
              React.createElement("div",{className:"af-row"},
                React.createElement("input",{className:"af-in num",placeholder:"0,00 €",inputMode:"decimal",value:d.amount||"",onChange:e=>setDO(o.id,"amount",e.target.value)}),
                React.createElement("select",{className:"af-in",value:d.month,onChange:e=>setDO(o.id,"month",e.target.value)}, MONTHS_ES.map((lbl,i)=>React.createElement("option",{key:i+1,value:i+1},monthShort(i)))),
                React.createElement("input",{className:"af-in num",placeholder:t("fj_day"),inputMode:"numeric",style:{maxWidth:64},value:d.day||"",onChange:e=>setDO(o.id,"day",e.target.value)})
              ),
              React.createElement("div",{className:"edit-extra"},
                React.createElement("span",{className:"rsub"},t("fj_year_lbl")),
                React.createElement("input",{className:"af-in num",style:{width:74,padding:"8px 10px"},inputMode:"numeric",value:d.year,onChange:e=>setDO(o.id,"year",e.target.value)}),
                React.createElement("span",{className:"rsub",style:{marginLeft:4}},t("fj_bank")),
                React.createElement("select",{className:"af-in",style:{width:"auto",padding:"8px 11px"},value:d.account,onChange:e=>setDO(o.id,"account",e.target.value)}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label)))
              ),
              React.createElement("button",{className:"btn btn-ghost btn-block",style:{color:"var(--coral)"},onClick:()=>delOneoff(o.id)},t("db_delete"))
            );
          }
          return React.createElement("div",{className:"row",key:o.id},
            React.createElement("div",{className:"rl"},
              React.createElement("div",null,
                React.createElement("div",{className:"rname"}, o.name, o.day && React.createElement("span",{className:"day-badge"},tf("fj_day_n",{d:o.day}))),
                React.createElement("div",{className:"rsub"}, monthShort(o.month-1)+" "+o.year+(o.account!=="sabadell"?" · "+entOf(o.account).label:"")))),
            React.createElement("div",{className:"rval num"}, eur(o.amount))
          );
        }) : React.createElement("div",{className:"hint"},t("fj_oneoffs_empty")),
      addingO
        ? React.createElement("div",{className:"add-form",style:{marginTop:12}},
            React.createElement("input",{className:"af-in",placeholder:t("fj_concept_amort"),value:formO.name,onChange:e=>setFormO(Object.assign({},formO,{name:e.target.value}))}),
            React.createElement("div",{className:"af-row"},
              React.createElement("input",{className:"af-in num",placeholder:"0,00 €",inputMode:"decimal",value:formO.amount,onChange:e=>setFormO(Object.assign({},formO,{amount:e.target.value}))}),
              React.createElement("select",{className:"af-in",value:formO.month,onChange:e=>setFormO(Object.assign({},formO,{month:e.target.value}))}, MONTHS_ES.map((lbl,i)=>React.createElement("option",{key:i+1,value:i+1},monthShort(i)))),
              React.createElement("input",{className:"af-in num",placeholder:t("fj_day"),inputMode:"numeric",style:{maxWidth:64},value:formO.day,onChange:e=>setFormO(Object.assign({},formO,{day:e.target.value}))})
            ),
            React.createElement("div",{className:"edit-extra"},
              React.createElement("span",{className:"rsub"},t("fj_year_lbl")),
              React.createElement("input",{className:"af-in num",style:{width:74,padding:"8px 10px"},inputMode:"numeric",value:formO.year,onChange:e=>setFormO(Object.assign({},formO,{year:e.target.value}))}),
              React.createElement("span",{className:"rsub",style:{marginLeft:4}},t("fj_bank")),
              React.createElement("select",{className:"af-in",style:{width:"auto",padding:"8px 11px"},value:bankOr(formO.account),onChange:e=>setFormO(Object.assign({},formO,{account:e.target.value}))}, banks.map(b=>React.createElement("option",{key:b,value:b},entOf(b).label)))
            ),
            React.createElement("div",{className:"af-row"},
              React.createElement("button",{className:"btn btn-ghost",style:{flex:1},onClick:()=>{setAddingO(false); setFormO({name:"",amount:"",month:cm,year:cy,day:"",account:"sabadell"});}},t("fj_cancel")),
              React.createElement("button",{className:"btn btn-primary",style:{flex:2},onClick:addOneoff},t("fj_addoneoff"))
            )
          )
        : React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:12},onClick:()=>setAddingO(true)},React.createElement(I.plus,{width:16,height:16}),t("fj_addoneoff")),
      React.createElement("div",{className:"hint",style:{fontSize:11.5,marginTop:6}},t("fj_oneoff_hint"))
    ); })()}
    ]}),
    React.createElement("div",{className:"hint",style:{padding:"0 4px"}},tf("fj_foot",{x:eur0(grand*12)}))
  );
}

