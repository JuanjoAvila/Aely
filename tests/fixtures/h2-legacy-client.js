// Consumidores exactos de beta ff53b0e7243fe79f9164bbc1bcf2313fb2e28d13. Fixture de compatibilidad; no runtime.
function mkObAcct(lk, ac, bal, info){
  const cur=(ac.currency || (ac.balances&&ac.balances[0]&&ac.balances[0].currency) || "EUR");
  return { key:String(ac.uid||ac.iban||(lk&&lk.aspsp)), ent:entFromAspsp(lk&&lk.aspsp), iban:ac.iban||null, name:ac.name||null, value:+Number(bal).toFixed(2), cur:cur, aspsp:(lk&&lk.aspsp)||null,
    /* Rastro para diagnosticar el baile del saldo (queja de su padre, 11/9): qué saldo de los
       que manda el banco hemos usado, y cuáles había. Sin esto solo se ve el número. */
    balTipo:(info&&info.tipo)||null, balTipos:(info&&info.tipos)||undefined };
}

function applyBankBalances(s, links){
  if(!s || !Array.isArray(links) || !links.length) return { state:s, changed:false, synced:[], obAccounts:(s&&s.obAccounts)||[] };
  const now=new Date(), cy=now.getFullYear(), cm=now.getMonth()+1, td=now.getDate();
  const accounts=(s.accounts||[]).slice();
  let changed=false; const synced=[]; const obAccts=[]; const usedPrimary={};
  // Gasto del mes por banco UNA vez (misma lista que al pintar). Si se recalcula dentro del
  // bucle con `spentM` global, un segundo banco diario/ambos se come los gastos ajenos.
  const monthStart=startOfMonth();
  /* Sin el cargo de un recibo (revisión del 12/10/2026): al pintar esa fila no cuenta, y si aquí
     sí contaba el saldo salía inflado justo después de sincronizar (banco 1848 → pantalla 2000,
     los 152 € de los recibos). Solo se quita esa fila: el resto del mes sigue en crudo, como
     estaba, para no mover el anclaje de nada más. */
  const monthExp=(s.expenses||[]).filter(function(e){ return parseDate(e.date)>=monthStart && !cargoDeRecibo(e, s); });
  const dailyAcc=(s.accounts||[]).find(function(x){ return accDaily(x); });
  const dailyEnt=dailyAcc&&dailyAcc.ent;
  const porBanco=gastoDelMesPorBanco(monthExp, dailyEnt);
  links.forEach(function(lk){
    if(lk && lk.ok===false){
      // Banco que falló/caducó este sync: CONSERVA sus cuentas sincronizadas tal y como estaban,
      // marcadas rancias (stale) para que Patrimonio enseñe «caducado» en vez de esfumarlas.
      // (Bug CaixaBank 2026-07-11: al reconstruir obAccounts sin el banco caído, desaparecía.)
      const asp=String((lk&&lk.aspsp)||"").toLowerCase();
      (s.obAccounts||[]).forEach(function(o){ if(String(o.aspsp||"").toLowerCase()===asp) obAccts.push(Object.assign({},o,{stale:true,staleKind:lk.expired?"expired":"temporary"})); });
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
      (s.obAccounts||[]).forEach(function(o){ if(String(o.aspsp||"").toLowerCase()===asp) obAccts.push(Object.assign({},o,{stale:true,staleKind:lk&&lk.expired?"expired":"temporary"})); });
    };
    // cuentas del banco: shape nuevo (lk.accounts) o antiguo (una sola, de lk.balances)
    const accs=(Array.isArray(lk.accounts)&&lk.accounts.length)
      ? lk.accounts.filter(function(a){ return a && a.ok!==false; })
      : [{ uid:lk.iban||lk.aspsp, iban:lk.iban||null, name:null, balances:(lk&&lk.balances) }];
    if(!accs.length){ keepStale(); return; }
    if(ent==null){   // banco SIN cuenta manual en la app → TODAS sus cuentas van a obAccounts
      let pushed=0;
      accs.forEach(function(ac){ const inf=pickBankBalanceInfo(ac.balances); if(inf.valor!=null){ obAccts.push(mkObAcct(lk,ac,inf.valor,inf)); pushed++; } });
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
      const inf=pickBankBalanceInfo(ac.balances); const bal=inf.valor; if(bal==null) return;
      contributed++;
      if(ownerOf[k]!=null){
        const a=accounts[ownerOf[k]];
        // re-anclaje = despejar `value` para que HOY muestre el saldo real del banco.
        // Misma fórmula que al pintar (`saldoCuentaMostrada` ↔ `valueDesdeSaldo`). Antes
        // `spentM` sumaba TODOS los bancos del mes y, con rol diario/ambos, inflaba la base
        // (padre: Revolut 26 € del banco → 455 € en pantalla; 2026-09-11).
        const role=accRole(a);
        let newBase;
        if(role==="fijos"){
          // Pintado: value + paidNet. paidNet = monthNetForAccount → base = bal − monthNet.
          newBase=+((bal - monthNetForAccount(s, ent, cy, cm, td)).toFixed(2));
        } else {
          const ruMv=(a.roundupManual!=null)?a.roundupManual:roundupOf(monthExp, a.roundup||0);
          const miMv=a.monthlyInvest||0;
          const injMv=nominaYaEntro()?accInject(a):0;
          newBase=valueDesdeSaldo({
            shown:bal, injTR:injMv, spentOwn:porBanco[ent]||0,
            roundup:ruMv, monthlyInvest:miMv,
            ambos:role==="ambos",
            paidNet:monthNetForAccount(s, ent, cy, cm, td)
          });
        }
        synced.push({ ent:ent, bal:bal, iban:ac.iban||null });
        /* ⚠ EL RASTRO SE REFRESCA AUNQUE EL IMPORTE NO CAMBIE (lo caza Cursor en la review, 11/9).
           Antes esto solo escribía si cambiaba `value` o `bankIban`. O sea que si el banco pasaba
           de mandar ITAV a mandar CLBD con el MISMO importe, el rastro se quedaba con la etiqueta
           vieja — y ese es justo el caso para el que existe el rastro: «mismo número, otra
           etiqueta». El instrumento estaba ciego a lo único que tenía que ver. */
        const rastroCambia = (inf.tipo||null)!==(a.balTipo||null) || Math.abs((a.balSaldo==null?NaN:a.balSaldo)-bal)>0.005;
        // Sin IBAN, el uid de la cuenta del banco: es lo que llevan sus movimientos (`obAcc`) y lo
        // único que deja contar la parte de una principal a medias (revisión 14/10).
        const uidCambia = !ac.iban && ac.uid!=null && a.bankUid!==String(ac.uid);
        if(Math.abs((a.value||0)-newBase)>0.005 || (ac.iban && a.bankIban!==ac.iban) || rastroCambia || uidCambia){
          /* El rastro va también aquí: la Revolut de su padre es una cuenta PRINCIPAL re-anclada,
             no una obAccount, y era justo la que le bailaba. `balSaldo` es el saldo crudo que mandó
             el banco, sin la fórmula de dynBal encima, para poder comparar manzanas con manzanas. */
          accounts[ownerOf[k]]=Object.assign({}, a, { value:newBase, bankIban:ac.iban||a.bankIban,
            balTipo:inf.tipo||null, balTipos:inf.tipos&&inf.tipos.length?inf.tipos:undefined, balSaldo:bal },
            uidCambia?{bankUid:String(ac.uid)}:null);
          changed=true;
        }
      } else {
        obAccts.push(mkObAcct(lk,ac,bal,inf));
        synced.push({ ent:ent, bal:bal, iban:ac.iban||null });
      }
    });
    if(!contributed) keepStale();
  });
  const obChanged=JSON.stringify(s.obAccounts||[])!==JSON.stringify(obAccts);
  const newState=(changed||obChanged) ? Object.assign({},s,{accounts:accounts, obAccounts:obAccts}) : s;
  return { state:newState, changed:changed||obChanged, synced:synced, obAccounts:obAccts };
}


function flattenBankTx(links, previous){
  previous=Array.isArray(previous)?previous:[];
  const out=[];
  const partial={}, reported={}, sealed={}, expired={};
  (links||[]).forEach(function(lk){
    const ent=entFromAspsp(lk && lk.aspsp);
    if(!ent) return;
    reported[ent]=true;
    if(lk.expired){ expired[ent]=true; return; }
    if(lk.ok===false || lk.truncated || lk.readReason || (lk.accounts||[]).some(function(a){ return a&&(a.ok===false||a.truncated||a.transactionError||a.readReason); })) partial[ent]=true;
    // El motivo del ENLACE puede ser el siguiente trozo antiguo que no entró. Si las cuentas
    // entregadas están completas, ese prefijo sí se selló:119 puede acusarlo, incluso sin ids.
    if(lk.ok!==false && lk.readReason && !lk.truncated && (lk.accounts||[]).length && lk.accounts.every(function(a){ return a&&a.ok===true&&!a.truncated&&!a.transactionError&&!a.readReason; })) sealed[ent]=true;
    // La excepción119 acusa una ventana que rebasa páginas/filas, aunque esté truncada.
    // Rechazar sus filas sin id vaciaba TR en cada pulsación; el acuse y TODAS las cuentas
    // deben acreditar ese mismo límite, nunca un corte del banco ni un enlace truncado.
    if(lk.ok===true && lk.ack && !lk.truncated && (lk.accounts||[]).length && lk.accounts.every(function(a){
      return a&&a.ok===true&&!a.transactionError&&(!a.truncated&&!a.readReason || (a.truncated&&(a.readReason==="page_limit"||a.readReason==="row_limit")));
    }) && lk.accounts.some(function(a){ return a.truncated; })) sealed[ent]=true;
    // En multicuenta el top-level solo contiene la PRIMERA cuenta compatible. Los movimientos
    // nuevos de una segunda cuenta estaban en `accounts[].transactions` y el cliente ni los
    // miraba: el banco figuraba sincronizado pero Gastos decía que no había nada nuevo.
    // Cada movimiento se queda con SU cuenta (IBAN, o el uid si el banco no da IBAN): con dos
    // cuentas en el mismo banco y una conjunta a medias, es lo que deja contar en el patrimonio
    // solo la parte de cada una (14/10/2026). El servidor ya lo mandaba; aquí se perdía.
    let txs=[], accs=[];
    const accountTx=(lk.accounts||[]).filter(function(a){ return a&&Array.isArray(a.transactions); });
    if(accountTx.length) accountTx.forEach(function(a){ txs=txs.concat(a.transactions); a.transactions.forEach(function(){ accs.push(a.iban||a.uid||null); }); });
    else txs=(lk.transactions||[]).slice();   // shape antiguo: una sola cuenta en top-level
    txs.forEach(function(t,i){
      if(partial[ent]&&(!t||t.amount==null||String(t.amount).trim()===""||!isFinite(Number(t.amount)))) return;
      // `note` = concepto del extracto (remittance_information): lo que hace que el histórico se
      // entienda sin abrir la app del banco (2026-07-24).
      out.push({ ent:ent, id:t.ext_id||null, date:String(t.date||"").slice(0,10), amount:Number(t.amount)||0, merchant:t.merchant||"", note:t.note||"", card:!!t.card, status:t.status||"", ...(t.mcc?{mcc:t.mcc}:{}), ...(t.concept?{concept:t.concept}:{}), ...(accs[i]?{acc:String(accs[i])}:{}) });
    });
  });
  if(Object.keys(partial).length||Object.keys(expired).length){
    // Una cuenta cortada no sustituye un extracto: solo añade BOOK nuevos inequívocos.
    // Un trozo antiguo ya sellado mantiene su lectura completa, aunque falle el siguiente.
    const kept=previous.filter(function(x){ return x&&!expired[x.ent]&&(partial[x.ent]||!reported[x.ent]); }), seen={}, counts={}, oldNoId={}, freshNoId={};
    const noIdKey=function(x){ const st=String(x.status||"").trim().toUpperCase(); return JSON.stringify([x.ent,String(x.date||"").slice(0,10),x.amount,x.merchant||"",!st||/book|post/i.test(st)?"BOOK":st]); };
    const today=madridYmdParts(Date.now()), todayYmd=today.y+"-"+String(today.m).padStart(2,"0")+"-"+String(today.d).padStart(2,"0"), days=[31,28,31,30,31,30,31,31,30,31,30,31];
    kept.forEach(function(x){ if(x.id) seen[x.ent+"|"+x.id]=1; else { const k=noIdKey(x); oldNoId[k]=(oldNoId[k]||0)+1; } });
    out.forEach(function(x){ if(x.id){ const k=x.ent+"|"+x.id; counts[k]=(counts[k]||0)+1; } });
    const fresh=out.filter(function(x){
      if(!partial[x.ent]) return true;
      const p=x.date.match(/^(\d{4})-(\d{2})-(\d{2})$/), y=p&&+p[1], m=p&&+p[2], d=p&&+p[3];
      const valid=p&&y>0&&m>=1&&m<=12&&d>=1&&d<=days[m-1]+(m===2&&y%4===0&&(y%100!==0||y%400===0)?1:0);
      if(!isFinite(x.amount)||!valid||x.date>todayYmd) return false;
      // Un prefijo completo o la excepción119 acreditan multiplicidad sin id. Se conserva
      // el máximo, no la suma; las fechas futuras tampoco se admiten por este camino.
      if(sealed[x.ent]&&!x.id){ const k=noIdKey(x); freshNoId[k]=(freshNoId[k]||0)+1; return freshNoId[k]>(oldNoId[k]||0); }
      const k=x.ent+"|"+x.id;
      return typeof x.id==="string"&&x.id.trim()&&counts[k]===1&&!seen[k]&&x.status==="BOOK";
    });
    out.length=0; kept.concat(fresh).forEach(function(x){ out.push(x); });
  }
  out.sort(function(a,b){ return String(b.date).localeCompare(String(a.date)); });
  // El servidor ya acota por cuenta. Un tope GLOBAL de 150 dejaba fuera un banco entero
  // si otro tenía más actividad reciente, antes incluso de llegar a importObExpenses.
  // Guardar el array viejo (otra clave del WeakMap) retendría toda la cadena de syncs.
  obPendingResponses.set(out,{links:links||[],previous:previous.filter(function(tx){return tx&&obIsPending(tx);})});
  return out;
}
