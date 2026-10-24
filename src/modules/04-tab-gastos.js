/* ============================================================
   TAB: GASTOS
   ============================================================ */
// «Mi ciclo» (petición pareja 2026-07-11): su nómina no cae en día fijo (23, 24…), así que el mes
// natural le descuadra el ahorro. El ciclo se ancla al ÚLTIMO COBRO REAL apuntado: el ingreso
// más reciente ≥200 € de los últimos 45 días (los bizums pequeños no cuentan). Sin cobro → mes.
function lastPaydayOf(expenses, nowMs, delSet, eligible){
  const now=nowMs!=null?nowMs:Date.now();
  const todayEnd=new Date(now); todayEnd.setHours(23,59,59,999);
  const cut=now-45*86400000;
  // El banco guarda muchas fechas a las 12:00; cobrar hoy por la mañana ya abre el ciclo.
  // Un apunte fechado mañana no puede adelantar ese reinicio. Se recorre sin ordenar/copiar
  // el histórico porque Inicio consulta el presupuesto en cada render.
  let best=null, bestMs=-Infinity;
  (expenses||[]).forEach(function(e){
    // Un posible duplicado no confirma que haya entrado dinero; no puede reiniciar el límite.
    if(!e || e.possibleDup || !(e.amount<=-200) || eligible && !eligible(e)) return;
    if(expenseIsTombstoned(e,delSet)) return;
    if(!isFinite(new Date(e.date).getTime())) return;
    const ms=dateMs(e.date);
    if(ms>=cut && ms<=todayEnd.getTime() && ms>bestMs){ best=e; bestMs=ms; }
  });
  if(!best) return null;
  const d=parseDate(best.date);
  return { start:new Date(d.getFullYear(),d.getMonth(),d.getDate()), inc:best };   // desde las 00:00 del día del cobro
}
// Al usar «Mi ciclo» como presupuesto, un traspaso o un Bizum grande no puede fingir
// que se ha cobrado la nómina. El filtro informativo antiguo conserva su ancla histórica;
// el límite solo se reinicia con un ingreso identificado por nombre o flujo periódico.
function budgetPaydayOf(state, nowMs, expenses){
  const flows=(state.flows||[]).filter(function(f){ return f&&f.kind==="income"&&!f.once&&Number(f.amount)>=200; });
  return lastPaydayOf(expenses||state.expenses, nowMs, expenseDeletedSet(state), function(e){
    if(CAT_NEUTRAS[e.category] || e.category==="bizum") return false;
    // Algunos bancos ponen la empresa como comercio y «NÓMINA» solo en el concepto.
    const name=recNorm([e.merchant,e.note,e.concept].join(" "));
    if(/\b(nomina|salario|sueldo|salary|payroll|haberes)\b/.test(name)) return true;
    const bank=expenseBankOf(e);
    if(!bank) return false;
    const d=parseDate(e.date), month=d.getMonth()+1, year=d.getFullYear();
    return flows.some(function(f){ return (f.to||"sabadell")===bank && flowOccursIn(f,month,year)
      && recAmtClose(Number(f.amount),Math.abs(e.amount)) && recNameMatch(f.name,e.merchant); });
  });
}
/* Límites del período EN MILISEGUNDOS, calculados UNA vez. Antes `inPreset` se llamaba por gasto y
   se construía dentro tres o cuatro `new Date()` (startOfMonth, el mes pasado…): con un histórico
   de miles de movimientos eran decenas de miles de objetos Date por render, y era buena parte del
   lag que crecía con el uso (feedback 2026-07-24). Devuelve {from,to} con Infinity de comodín. */
function presetBoundsMs(preset,range,cycleStart){
  const now=new Date();
  // Inicio y FIN de mes en Madrid, como `startOfMonth`: con el fin en hora del dispositivo, un
  // apunte del 1 de octubre a las 00:00 en Madrid (30/9 22:00Z) quedaba fuera del mes en una
  // máquina en UTC (reporte 2026-10-07). saltar 35 días y volver a `inicioDeMesMs` cae siempre en el mes siguiente.
  const monthStart=inicioDeMesMs(now);
  const nextMonthStart=inicioDeMesMs(monthStart+35*864e5);
  const monthEnd=nextMonthStart-1;
  if(preset==="month") return {from:startOfMonth().getTime(), to:monthEnd};
  if(preset==="cycle"){
    const tomorrow=new Date(now); tomorrow.setHours(24,0,0,0);
    return {from:(cycleStart||startOfMonth()).getTime(), to:cycleStart?tomorrow.getTime()-1:new Date(now.getFullYear(),now.getMonth()+1,1).getTime()-1};
  }
  if(preset==="last") return {from:inicioDeMesMs(monthStart-1), to:monthStart-1};
  // Tres meses naturales de Madrid (mes actual y los dos anteriores): inicio local + fin Madrid
  // sumaban casi cuatro meses en cuanto el dispositivo no estaba en Madrid.
  if(preset==="3m") return {from:inicioDeMesMs(inicioDeMesMs(monthStart-1)-1), to:monthEnd};
  if(preset==="custom"){
    let from=-Infinity, to=Infinity;
    if(range&&range.from){ const f=new Date(range.from+"T00:00:00"); if(!isNaN(f.getTime())) from=f.getTime(); }
    if(range&&range.to){ const tt=new Date(range.to+"T00:00:00"); if(!isNaN(tt.getTime())){ tt.setHours(23,59,59,999); to=tt.getTime(); } }
    return {from:from, to:to};
  }
  return {from:-Infinity, to:Infinity};   // "all" y cualquier preset desconocido
}
function inBounds(ms,b){ return ms>=b.from && ms<=b.to; }
// La elección de fechas debe mover juntas lista y cifras; el presupuesto de Inicio y
// sus lectores conserva su propia ventana (reporte 2/10/2026).
function gastosPeriodOf(preset,bounds,cycle){
  return {startMs:bounds.from,todayEndMs:bounds.to===Infinity?Infinity:bounds.to+1,
    cycle:preset==="cycle"?cycle:null};
}
/* GASTOS v5 · LA CIFRA VIVA (20/10/2026, docs/design/gastos-v5/SPEC.md §3).
   Arriba se ve lo gastado del mes y, al bajar, lo gastado HASTA el día que queda bajo la
   cabecera. Eso no se puede calcular en cada evento de scroll recorriendo el histórico (AGENTS
   §7 bis): se recorre UNA vez por cambio de datos y se guarda la suma por día; el scroll solo
   consulta tablas.
   Día = día del DISPOSITIVO, el mismo con el que la lista agrupa sus encabezados; mes = mes de
   MADRID, el de las ventanas del presupuesto (`inicioDeMesMs`). En España coinciden siempre.
   La caché va por HORA porque los cambios de hora de Madrid caen en hora en punto: todas las
   filas de la misma hora son del mismo día, y así no se construye un `Date` por fila. */
const _gastosDiaCache=new Map();
function gastosDia(ms){
  const hk=Math.floor(ms/36e5);
  let v=_gastosDiaCache.get(hk);
  if(v) return v;
  if(_gastosDiaCache.size>60000) _gastosDiaCache.clear();
  const d=new Date(hk*36e5);
  v={k:d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(), ym:madridYmdParts(hk*36e5).ym};
  _gastosDiaCache.set(hk,v);
  return v;
}
/* Suma por día de lo que cuenta en el presupuesto, con la MISMA regla fila a fila que
   `monthBudgetStats` (`budgetRowSigned`). `sp` = gastado, `inc` = ingresos que cuentan.
   `cum` acumula desde el principio del mes de Madrid (`porMes`) o desde el principio de la
   ventana (ciclo, rango, todo), en orden de fecha. `earliest` = la fila más antigua del
   histórico: sirve para no comparar con un mes que el histórico no cubre entero. */
function gastosCifraDias(state, expenses, period, fromMs, toMs, porMes){
  const delSet=period.cycle?expenseDeletedSet(state):null;
  const st=Object.assign({},state,{expenses:expenses});
  const days=Object.create(null), months=Object.create(null);
  let earliest=Infinity;
  (expenses||[]).forEach(function(e){
    if(!e) return;
    const ms=dateMs(e.date);
    if(ms<earliest) earliest=ms;
    if(ms<fromMs || ms>=toMs) return;
    const v=budgetRowSigned(e, st, period, delSet);
    if(!v) return;
    // Día del dispositivo Y mes de Madrid: fuera de España un mismo día local puede caer en dos
    // meses de Madrid, y cada parte suma en el suyo (como en la lista).
    const info=gastosDia(ms), key=info.k+"|"+info.ym;
    let day=days[key];
    if(!day) day=days[key]={k:info.k, ym:info.ym, sp:0, inc:0};
    if(v>0) day.sp+=v; else day.inc-=v;
  });
  const keys=Object.keys(days).map(function(x){ return days[x]; }).sort(function(a,b){ return a.k-b.k || (a.ym<b.ym?-1:a.ym>b.ym?1:0); });
  let run={sp:0,inc:0}, lastYm=null;
  keys.forEach(function(day){
    if(porMes && day.ym!==lastYm){ run={sp:0,inc:0}; lastYm=day.ym; }
    run={sp:run.sp+day.sp, inc:run.inc+day.inc};
    day.cum=run;
    const m=months[day.ym]||(months[day.ym]={sp:0,inc:0});
    m.sp+=day.sp; m.inc+=day.inc;
  });
  return {days:days, keys:keys, months:months, earliest:earliest, porMes:!!porMes};
}
/* Lo acumulado hasta el día `k` (aaaammdd) del mes `ym` incluido. Un día sin nada que cuente
   hereda lo del último día que sí; antes del primero (o del primero de SU mes, si se acumula por
   mes), cero. Búsqueda binaria: se llama en cada cambio de día visible, no puede recorrer nada. */
function gastosCumDia(cifra, k, ym){
  const keys=cifra.keys;
  const antes=function(d){ return d.k<k || d.k===k && (!ym || d.ym<=ym); };
  let lo=0, hi=keys.length-1, at=-1;
  while(lo<=hi){ const mid=(lo+hi)>>1; if(antes(keys[mid])){ at=mid; lo=mid+1; } else hi=mid-1; }
  if(at<0) return {sp:0,inc:0};
  const day=keys[at];
  if(cifra.porMes && ym && day.ym!==ym) return {sp:0,inc:0};
  return day.cum;
}
function gastosDiaDe(cifra, k, ym){ return cifra.days[k+"|"+ym]||null; }
function gastosValor(x, mode){ return mode==="net" ? x.sp-x.inc : x.sp; }
// «2026-09» ↔ índice de mes: con aritmética de enteros, sin `Date`.
function gastosYmPrev(ym){
  const y=+ym.slice(0,4), m=+ym.slice(5,7);
  return m===1 ? (y-1)+"-12" : y+"-"+String(m-1).padStart(2,"0");
}
function gastosYmInicioMs(ym){ return inicioDeMesMs(Date.UTC(+ym.slice(0,4),+ym.slice(5,7)-1,15)); }

// Fila de una suscripción detectada. Importe EDITABLE antes de «pasar a Fijos» (petición
// 2026-08-03: recibos que se repiten cada mes pero varían de importe —luz, gas— para no dejarlos
// con el de este mes y tener que corregirlo a mano el que viene) + botón para descartarla del
// todo cuando no es una suscripción de verdad (ej. gasolina: se repite, pero nunca va a ser un
// importe fijo). Componente propio porque cada fila necesita su PROPIO estado de edición —dentro
// de un .map() no se pueden usar hooks por elemento.
function SubRow({sp, state, set, showToast}){
  const c=catOf(sp.cat);
  const [amt,setAmt]=useState(String(sp.amount).replace(".",","));
  const toFixed=function(){
    const useAmt=parseFloat(String(amt).replace(",",'.'))||sp.amount;
    const lastE=(state.expenses||[]).filter(function(e){ return catKey(e.merchant)===sp.key && e.amount>0; }).sort(function(a,b){ return dateMs(b.date)-dateMs(a.date); })[0];
    const acc=(state.accounts||[]).find(function(a){ return accRole(a)==="fijos"; })||(state.accounts||[]).find(function(a){ return accRole(a)==="ambos"; });
    const it={ id:uid(), name:sp.name, amount:useAmt, freq:"mes", account:(acc&&acc.ent)||"sabadell" };
    const dd=lastE? parseDate(lastE.date).getDate() : null; if(dd>=1&&dd<=31) it.day=dd;
    set(function(s){ return Object.assign({},s,{fixed:(s.fixed||[]).concat([it])}); });
    showToast(tf("sub_tofixed_done",{n:sp.name,b:entOf((acc&&acc.ent)||"sabadell").label}));
  };
  const dismiss=function(){
    set(function(s){ return Object.assign({},s,{subsDismissed:(s.subsDismissed||[]).concat([sp.key])}); });
    showToast(t("sub_dismissed_ok"));
  };
  // Las acciones necesitan el ancho de la tarjeta: junto al importe quedaban recortadas en móvil.
  return React.createElement("div",{className:"sub-row",style:{display:"grid",gridTemplateColumns:"34px minmax(0,1fr)",gap:"6px 11px"}},
    React.createElement("div",{className:"sub-ic",style:{borderColor:c.color+"55",color:c.color}}, c.icon),
    React.createElement("div",{className:"sub-mid"},
      React.createElement("div",{className:"sub-name"}, sp.name),
      React.createElement("div",{className:"sub-meta"}, tf("sub_months",{n:sp.months})+" · "+tf("sub_peryear",{y:eur0(sp.yearly)}))
    ),
    React.createElement("div",{className:"sub-amt num",style:{display:"flex",alignItems:"baseline",gap:2,gridColumn:2,minWidth:0}},
      React.createElement("input",{type:"text",inputMode:"decimal",value:amt,onChange:function(e){ setAmt(e.target.value); },
        style:{width:"10ch",minWidth:0,textAlign:"right",background:"transparent",border:"none",borderBottom:"1px dashed var(--bd)",color:"inherit",font:"inherit"}}),
      " €"+t("sub_permonth")
    ),
    React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gridColumn:"1 / -1",gap:6,alignItems:"center"}},
      React.createElement("button",{className:"chip",style:{fontSize:11.5,padding:"3px 10px"},onClick:toFixed}, "→ "+t("sub_tofixed")),
      React.createElement("button",{className:"chip",style:{fontSize:11.5,padding:"3px 10px"},onClick:dismiss,title:t("sub_dismiss")}, "✕ "+t("sub_dismiss"))
    )
  );
}
function Expenses({state, set, onSync, syncing, syncStatus, showToast, stopSwipe, cancelSwipe, focusExp, clearFocus, forceAllTs, onGoPlan}){
  /* «Ver todo» desde una ficha puede llegar antes de que Gastos termine de montar. Conservamos
     ese destino solo durante la navegación: el estado inicial lo consume y el evento cubre el
     caso en que la pestaña ya estaba viva. No se guarda en preferencias. */
  const bankPending=typeof window!=="undefined"&&window.__mcExpBank||"";
  const cycleEnabled=!!(state.settings&&state.settings.budgetCycle);
  /* Gastos v5 (20/10/2026): «months» es la lista entera mes a mes con la cifra viva; sustituye a
     Este mes / Mes pasado / 3 meses, que ahora son la fila de meses. Mi ciclo, Rango y Todo siguen
     y se eligen en Filtros (su sitio definitivo, SPEC §7). Con el presupuesto por ciclo, se
     arranca en el ciclo: es lo que dice Inicio y la cifra de arriba tiene que coincidir. */
  const presetDef=cycleEnabled?"cycle":"months";
  const [preset,setPreset]=useState(bankPending?"all":presetDef);
  const cycleEnabledPrev=useRef(cycleEnabled);
  useEffect(function(){
    if(cycleEnabledPrev.current===cycleEnabled) return;
    cycleEnabledPrev.current=cycleEnabled;
    setPreset(cycleEnabled?"cycle":"months");
  },[cycleEnabled]);
  // Tras importar una hoja: salta a "Todo" — lo importado suele traer fechas fuera del mes en
  // curso, y "Este mes" las tapaba en silencio (feedback 2026-08-01).
  useEffect(function(){ if(forceAllTs) setPreset("all"); },[forceAllTs]);
  const [range,setRange]=useState({from:"",to:""});
  const [calPick,setCalPick]=useState(null);   // "from" | "to" | null — rango a medida, calendario de la casa
  const [sel,setSel]=useState([]);   // categorías seleccionadas; [] = todas
  /* Contrato confirmado 16/9: al entrar se ven los bancos marcados como gasto diario. Vacío
     sigue significando TODOS y queda disponible como elección explícita en el filtro. */
  const [bankSel,setBankSel]=useState(function(){
    const ent=typeof window!=="undefined"&&window.__mcExpBank||"";
    if(ent){ try{ window.__mcExpBank=""; }catch(e){} return [ent]; }
    return expenseBankEnts(state).slice();
  });
  /* La ficha de una cuenta puede mandar aquí sin pasar por `11-app-main.js`: primero activa la
     pestaña mediante su botón real y después este evento efímero deja el histórico filtrado por
     esa cuenta. No se persiste, así volver a entrar en Gastos conserva su comportamiento normal. */
  useEffect(function(){
    const h=function(e){
      const ent=e&&e.detail&&e.detail.ent||window.__mcExpBank; if(!ent) return;
      try{ window.__mcExpBank=""; }catch(err){}
      setPreset("all"); setBankSel([ent]); setBucketSel([]); setSel([]); setQ(""); setFilterOpen(false);
    };
    window.addEventListener("mc-open-expenses-bank",h);
    return function(){ window.removeEventListener("mc-open-expenses-bank",h); };
  },[]);
  /* Filtro por cajón (2026-08-17): «cuenta», «ingreso», «neutra», «otrobanco». Es lo que le deja
     separar el caos que describió al volver del crucero. Arranca VACÍO = se ve todo: la lista
     sigue siendo el histórico completo por defecto, esto es para explorar, no un modo nuevo. */
  const [bucketSel,setBucketSel]=useState([]);
  const [q,setQ]=useState("");        // búsqueda por texto (comercio/categoría)
  const [filterOpen,setFilterOpen]=useState(false);
  const [visible,setVisible]=useState(CONFIG.PAGE_SIZE);
  const [dragExpense,setDragExpense]=useState(null);
  const dragExpenseRef=useRef(null);
  const suppressOpenRef=useRef(0);
  const [aiBusy,setAiBusy]=useState(false);
  const [undoDelete,setUndoDelete]=useState(null);
  const undoDeleteRef=useRef(null);
  const undoTimerRef=useRef(null);
  useEffect(function(){
    return function(){ if(undoTimerRef.current) clearTimeout(undoTimerRef.current); };
  },[]);
  // Trabajo pesado (suscripciones) solo la 1ª vez que Gastos está activo. NO resetear al
  // salir: si no, los chips de banco parpadean al ir Resumen↔Gastos (feedback 2026-07-16).
  const [heavyOk,setHeavyOk]=useState(false);
  const heavyOkRef=useRef(false);
  const heavyIdleGen=useRef(0);
  // Lo caro de Gastos (detectar suscripciones y pintar su tarjeta) esperaba a que la pestaña
  // estuviera ACTIVA, así que se pagaba AL LLEGAR: en la cola del gesto de deslizar. Medido con
  // la CPU estrangulada x6 y trazado con `Tracing` (2026-07-26): la primera entrada en Gastos
  // costaba una tarea de ~67 ms, de los cuales **59,7 ms eran un Layout completo** (1.196
  // objetos, `partialLayout:false`) — el de las ~50 etiquetas que aparecen de golpe al ponerse
  // `heavyOk` en true. Y se pagaba igual llegando por gesto que tocando la barra de abajo, así
  // que no era el gesto: era esto.
  //
  // Es el mismo error que tenía el montaje de las pestañas, y se arregla igual: el coste no se
  // puede evitar, pero sí ELEGIR CUÁNDO se paga. Ahora se adelanta a un hueco libre aunque la
  // pestaña no esté activa (a esas alturas ya está montada y no hay ningún dedo en la pantalla).
  // El tope generoso —4 s frente a 40 ms— es lo que impide que se cuele a la fuerza en mitad del
  // arranque, que sigue siendo el momento más ocupado; con la pestaña activa manda la prisa.
  //
  // ⚠ Y el aviso de «eres la activa» NO PUEDE ser una prop (2026-07-27 noche). Con `active` en
  // props, CADA entrada a Gastos reconstruía Expenses entero encima del carrusel — y eso era
  // justo su «Deudas→Gastos lagazo / Deudas→Cartera fluido»: hacia Cartera el memo de Gastos no
  // se tocaba; hacia Gastos sí. El expediente ya lo había medido («dejar active fijo quita la
  // asimetría») y lo descartó mal: se puede enterarse sin re-render vía `mcOnGastosActive`.
  // Chips de banco/categoría: el scroll horizontal se quedó en el sheet de filtros
  // (2026-08-05). Aquí solo se resetea al entrar si hubiera resto de scroll de versiones viejas.
  useEffect(function(){ heavyOkRef.current=heavyOk; },[heavyOk]);
  useEffect(function(){
    var unsub=mcOnGastosActive(function(active){
      if(heavyOkRef.current) return;
      var gen=++heavyIdleGen.current;
      mcScheduleIdle(function(){
        if(gen!==heavyIdleGen.current || heavyOkRef.current) return;
        setHeavyOk(true);
      }, active?40:4000);
    });
    return function(){ heavyIdleGen.current++; unsub(); };
  },[]);
  const expensesDef=useDeferredValue(state.expenses);
  const keyOfE=keyOfExpense;
  const delExpense=function(e){
    if(undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const key=expenseDeletionKey(e), list=state.expenses||[], index=list.findIndex(function(x){ return x.id===e.id; });
    const wasCloud=cloud.enabled();
    const pair=gemeloAutomaticoDe(state,e);
    const paired=pair&&list.find(function(x){ return x.autoGemelo===e.id&&keyOfE(x)===pair.banco; });
    const pairedIndex=paired?list.indexOf(paired):-1;
    // La lápida entra junto con la retirada local: si la nube refresca durante los cinco segundos,
    // no puede resucitar la fila por detrás del toast. La escritura remota sí se encadena para que
    // Deshacer vuelva a subir el MISMO id después de que termine cualquier delete aún en vuelo.
    set(function(s){
      const next=Object.assign({},s,{
        expenses:(s.expenses||[]).filter(function(x){ return x.id!==e.id&&(!paired||x.id!==paired.id); })
      },lapidaPon(s,key));
      // Borrar el movimiento visible también retira su apunte oculto; Deshacer devuelve ambos.
      if(paired){
        Object.assign(next,lapidaPon(next,expenseDeletionKey(paired)));
        // También es un borrado a mano: sin este rastro su lápida parecería una respuesta
        // antigua «es el mismo» y reservaría el aviso del siguiente pago igual.
        next.gemelos=pushGemelos(next.gemelos,[bankDeletionLink(paired)]);
      }
      // Un apunte del banco borrado A MANO deja rastro «sin aviso» (12/10/2026): así el importador
      // no confunde su lápida con un «es el mismo» antiguo y no da por reclamado ningún aviso.
      if(e.source==="ob"||e.source==="ob-hist") next.gemelos=pushGemelos(next.gemelos,[bankDeletionLink(e)]);
      return next;
    });
    const pending={expense:e,key:key,index:index<0?list.length:index,wasCloud:wasCloud,paired:paired,pairedIndex:pairedIndex,
      cloudDelete:wasCloud?Promise.all([e].concat(paired?[paired]:[]).map(function(row){ return borrarGastoNube(row,"gastos-borrar"); })):Promise.resolve()};
    undoDeleteRef.current=pending; setUndoDelete(pending);
    undoTimerRef.current=setTimeout(function(){
      if(undoDeleteRef.current!==pending) return;
      undoDeleteRef.current=null; undoTimerRef.current=null; setUndoDelete(null);
    },5000);
  };
  const undoLastDelete=function(){
    const pending=undoDeleteRef.current;
    if(!pending) return;
    if(undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current=null; undoDeleteRef.current=null; setUndoDelete(null);
    set(function(s){
      const expenses=(s.expenses||[]).slice();
      if(!expenses.some(function(x){ return x.id===pending.expense.id; })){
        expenses.splice(Math.min(pending.index,expenses.length),0,pending.expense);
      }
      // Con su hora: la lápida ya pudo subir a la nube, y sin ella volvería del otro móvil.
      if(pending.paired&&!expenses.some(function(x){ return x.id===pending.paired.id; })){
        expenses.splice(Math.min(pending.pairedIndex,expenses.length),0,pending.paired);
      }
      const next=Object.assign({},s,{expenses:expenses},lapidaLevanta(s,pending.key));
      if(pending.paired) Object.assign(next,lapidaLevanta(next,expenseDeletionKey(pending.paired)));
      return next;
    });
    if(pending.wasCloud){
      Promise.resolve(pending.cloudDelete).then(function(){ return Promise.all([pending.expense].concat(pending.paired?[pending.paired]:[]).map(function(row){ return subirGasto(row,"gastos-deshacer"); })); });
    }
  };
  /* Posible repetido OB↔noti (2026-09-07): «es el mismo» borra la fila OB; «son distintos»
     quita la marca y la fila ya cuenta. La lápida solo al borrar (mismo camino que delExpense). */
  const resolveDup=function(e, same){
    if(!e || !e.possibleDup) return;
    set(function(s){
      let next=resolvePossibleDup(s, e.id, same);
      if(same){
        next=Object.assign({},next,lapidaPon(next, expenseDeletionKey(e)));
        if(cloud.enabled()) borrarGastoNube(e, "gastos-dup");
      }
      // «Son distintos»: hay que QUITAR la marca también en la nube (B09-D). Si no, la fila sigue
      // siendo `ob-dup:` allí, el servidor la deja fuera del presupuesto y el siguiente pull la
      // vuelve a apagar en el móvil.
      else if(cloud.enabled()) cloud.setExpenseDup(e, false).catch(function(err){ cloud.logEvent("error","setExpenseDup gastos-dup: "+keyOfExpense(e), _errCloudMsg(err)); });
      return next;
    });
    if(same) showToast(t("g_dup_same"));
    else showToast(t("g_dup_diff"));
  };
  const separarGemelo=function(e,unir){
    set(function(s){
      const next=unir?unirGemeloAutomatico(s,e.id):separarGemeloAutomatico(s,e.id);
      if(next===s) return s;
      const repairs=gemelosCambiosNube(next,s.expenses);
      if(cloud.enabled()) setTimeout(function(){ repairs.forEach(function(r){ cloud.setExpenseDup(r.expense,r.dup).catch(function(){}); }); },0);
      return next;
    });
    showToast(t(unir?"g_auto_paired":"g_auto_separated"));
  };
  const withdrawalPending=useRef({});
  const withdrawalState=useRef(state); withdrawalState.current=state;
  const [withdrawalStatus,setWithdrawalStatus]=useState(null);
  const recognizeWithdrawal=function(ex){
    if(!canRecognizeWithdrawal(ex) || ex.category==="traspaso" || withdrawalPending.current[ex.id]) return;
    if(!canRecognizeWithdrawal(ex,withdrawalState.current)){
      showToast(t(withdrawalReceiptLink(withdrawalState.current,ex)||cargoDeRecibo(ex,withdrawalState.current)?"f_withdraw_receipt_blocked":"f_withdraw_error")); return;
    }
    withdrawalPending.current[ex.id]=true;
    askConfirm({title:t("f_withdraw_title"),sub:tf("f_withdraw_sub",{x:eur(ex.amount)}),ok:t("f_withdraw_ok")})
      .then(async function(yes){
        if(!yes) return;
        setWithdrawalStatus({id:ex.id,status:"pending"});
        let timer;
        try{
          if(!canRecognizeWithdrawal(ex,withdrawalState.current)) throw new Error("withdrawal unavailable");
          let ack;const sandbox=mcSandbox();
          if(!sandbox) ack=await Promise.race([cloud.confirmExpenseWithdrawal(ex,function(){ return withdrawalState.current; }),new Promise(function(_,reject){
            timer=setTimeout(function(){ reject(new Error("withdrawal timeout")); },10000);
          })]);
          let applied=false,receiptUndone=false;
          ReactDOM.flushSync(function(){ set(function(s){ const next=sandbox?applyRecognizedWithdrawal(s,ex,Date.now()):reconcileConfirmedWithdrawal(s,ex,ack,Date.now());
            receiptUndone=!!withdrawalReceiptLink(s,ex)&&!withdrawalReceiptLink(next,ex);
            applied=next!==s || canRecognizeWithdrawal(ex,s)&&(s.expenses||[]).some(function(e){ return e.id===ex.id && e.category==="traspaso"
              && withdrawalRowMatches(ex,{id:e.id,source:expenseSourceForCloud(e),fecha:e.date,importe:e.amount,comercio:e.merchant}); });
            return next; }); });
          setWithdrawalStatus({id:ex.id,status:applied?"done":"error",receiptUndone:receiptUndone});
          showToast(t(applied?(receiptUndone?"f_withdraw_receipt_undone":"f_withdraw_done"):withdrawalReceiptLink(withdrawalState.current,ex)?"f_withdraw_receipt_blocked":"f_withdraw_error"));
        }catch(err){
          setWithdrawalStatus({id:ex.id,status:"error"});
          showToast(t(withdrawalReceiptLink(withdrawalState.current,ex)?"f_withdraw_receipt_blocked":"f_withdraw_error"));
        }finally{ clearTimeout(timer); }
      }).finally(function(){ delete withdrawalPending.current[ex.id]; });
  };
  // Recategorizar un gasto a mano: actualiza ESTE, recuerda el comercio (catOverrides) para los
  // futuros y arregla otros gastos del mismo comercio que estuvieran en "Otros".
  const setCat=function(ex,newCat){
    if(withdrawalPending.current[ex.id]) return;
    if(newCat==="traspaso" && canRecognizeWithdrawal(ex)){ recognizeWithdrawal(ex); return; }
    const mkey=catKey(ex.merchant);
    // "Movimiento" es el hueco que deja un banco que no manda NINGÚN dato (Trade Republic por
    // Open Banking, ver `mapTransaction` en enablebanking.ts) — no es un comercio de verdad, así
    // que ni se aprende como override (contaminaría CUALQUIER futuro gasto sin datos, de cualquier
    // banco) ni dispara el "recategoriza también los del mismo comercio en Otros" (bug 2026-08-04:
    // eso convertía TODOS los movimientos sin datos en Inversión de un solo toque, cada uno con su
    // propia compra de participaciones).
    // Y "Inversión" NUNCA se aprende como override, venga de donde venga el comercio: es un destino
    // del dinero, no un tipo de tienda (ver el blindaje gemelo en `autoCategory`, 00-core.js).
    const learnable = mkey && ex.merchant!=="Movimiento" && !CAT_NEUTRAS[newCat];
    set(function(s){
      const ov=Object.assign({}, s.catOverrides||{}); if(learnable) ov[mkey]=newCat;
      USER_OVERRIDES=Object.assign({},ov);
      // La equivalencia vale desde AHORA, no desde la fecha del gasto corregido: corregir uno
      // del mes pasado no autoriza a recategorizar lo que baje con fecha de ayer. Y solo en su
      // mismo banco y forma de pago. Repetir la elección no mueve el instante.
      let rules=s.catRules||{};
      if(learnable && CAT[newCat] && !isManualExpenseSource(ex.source)){
        const rk=catRuleKey(ex), had=rules[rk];
        if(!had || had.cat!==newCat || !Number.isFinite(had.at)){
          rules=Object.assign({},rules); rules[rk]={ cat:newCat, at:Date.now() };
        }
      }
      USER_CAT_RULES=Object.assign({},rules);
      // El cashback/round-up ENTRA al efectivo y días después SALE hacia el fondo: dos apuntes del
      // banco para un solo movimiento de dinero. Al marcar la salida como Inversión, su entrada
      // gemela va con ella — si no, sigue contando como ingreso del mes (2026-08-04, queja suya:
      // «me lo detecta duplicado en inversiones y luego como ingreso al principio del mes»).
      const twinIdx = newCat==="inversion" ? findCashbackTwin(s.expenses, ex) : -1;
      const twinId = twinIdx>=0 ? s.expenses[twinIdx].id : null;
      // Marcar a mano un round-up/cashback como "Inversión" (o deshacerlo) compra/vende de verdad
      // participaciones en el fondo enlazado de esa cuenta — mismo importe real del banco, ver
      // `applyInvestBuy`/`reverseInvestBuy` en 08-motor-bank.js (2026-08-03).
      let invState=s;
      const exps=s.expenses.map(function(e){
        const isTarget=e.id===ex.id;
        const isTwin=!!twinId && e.id===twinId;
        const isSibling=!isTarget && !isTwin && learnable && catKey(e.merchant)===mkey && e.category==="otros";
        if(!isTarget && !isTwin && !isSibling) return e;
        const wasInv=e.category==="inversion", willBeInv=newCat==="inversion";
        const upd=Object.assign({},e,{category:newCat});
        // Lo que la nube aún puede devolver hasta que se entere (ver `keepCategoryChoices`).
        const stale=catStaleAfter(e,newCat);
        if(stale && stale.length) upd.catStale=stale; else delete upd.catStale;
        delete upd.catAckAt;   // decisión nueva: aún nadie la ha confirmado
        // Sacarla de «Deudas» es decir «esto no es la cuota»: pierde la marca (4.21.0).
        if(isTarget && upd.debtId && newCat!=="deudas") delete upd.debtId;
        // El gemelo solo cambia de categoría: el dinero ya lo compra su pareja, comprarlo dos veces
        // duplicaría las participaciones del fondo.
        if(isTwin) return upd;
        if(!wasInv && willBeInv){
          const ib=applyInvestBuy(invState, e.ent, Math.abs(e.amount));
          if(ib){ invState=ib.state; upd.investInvId=ib.invId; upd.investShares=ib.shares; upd.investCInv=ib.cInv; upd.investAmountEur=ib.amountEur; }
        } else if(wasInv && !willBeInv && e.investInvId){
          invState=reverseInvestBuy(invState, e.investInvId, e.investShares, e.investCInv, e.investAmountEur);
          delete upd.investInvId; delete upd.investShares; delete upd.investCInv; delete upd.investAmountEur;
        }
        return upd;
      });
      // Durable en la tabla: sin esto el siguiente pull —que reemplaza los gastos de la nube con
      // lo que hay en `expenses`— devolvía la categoría vieja (2026-08-04).
      if(cloud.enabled()){
        cloud.setExpenseCat(ex,newCat).then(function(n){
          // Solo una escritura confirmada deja de protegerse (cero filas no es un error en Supabase).
          if(n>0) set(function(p){ const l=ackCategoryWrite(p.expenses, ex, newCat, Date.now()); return l===p.expenses?p:Object.assign({},p,{expenses:l}); });
        }).catch(function(){});
        if(twinId){ const tw=s.expenses.find(function(e){ return e.id===twinId; }); if(tw) cloud.setExpenseCat(tw,newCat).catch(function(){}); }
      }
      const fuera={expenses:exps,catOverrides:ov,catRules:rules};
      // «Esto no es la cuota»: lápida para que `marcarCuotasDeDeuda` no la vuelva a meter (4.21.0).
      if((ex.debtId||ex.category==="deudas") && newCat!=="deudas"){
        const k=keyOfExpense(ex), prevNo=s.cuotaNo||[];
        if(prevNo.indexOf(k)<0) fuera.cuotaNo=prevNo.concat([k]).slice(-200);
        // Y olvida el comercio que se aprendió al marcarla a mano, o el siguiente cargo volvería (4.22.2).
        const ak=cuotaAliasKey(ex);
        if(ak && s.cuotaAlias && s.cuotaAlias[ak]){ fuera.cuotaAlias=Object.assign({},s.cuotaAlias); delete fuera.cuotaAlias[ak]; }
      }
      return Object.assign({},invState,fuera);
    });
    const cc=CATEGORIES.concat([INGRESO_CAT,INVERSION_CAT,TRASPASO_CAT]).find(function(x){ return x.id===newCat; });
    if(showToast) showToast(tf("v4_moved_cat",{cat:(cc?cc.icon+" ":"")+catName(newCat)}));
  };
  /* «Es la cuota de…» desde la ficha (4.22.2, su rechazo: «no la puedo cambiar manualmente?»).
     La fila va a «Deudas» con esa deuda y el comercio se aprende para el mes que viene. */
  const setCuota=function(ex,debtId){
    let subir=null;
    set(function(s){ const r=marcarCuotaAMano(s, ex.id, debtId); if(!r) return s; subir=r.e; return r.state; });
    if(subir && cloud.enabled()) cloud.setExpenseDeuda(subir).catch(function(){});
    if(showToast) showToast(tf("v4_moved_cat",{cat:DEUDA_CAT.icon+" "+catName("deudas")}));
  };
  /* «No es este recibo» (12/10/2026): el sync casa por nombre e importe parecidos y puede
     equivocarse. Sin la marca, la fila vuelve a contar como un gasto cualquiera. */
  const quitarRecibo=function(ex){
    let subir=null;
    set(function(s){ const r=quitarCargoDeRecibo(s, ex.id); if(!r) return s; subir=r.e; return r.state; });
    // La marca viaja en `source`, y se busca la fila por lo que es: su id aquí puede no ser el de la nube.
    if(subir && cloud.enabled()) cloud.setExpenseRecibo(subir).catch(function(){});
  };
  const setReceipt=function(ex,fixedId){
    if(withdrawalPending.current[ex.id]){ showToast(t("f_withdraw_receipt_pending")); return; }
    const ds=String(ex.date||"").slice(0,10),y=Number(ds.slice(0,4)),m=Number(ds.slice(5,7)),now=new Date();
    const today=y===now.getFullYear()&&m===now.getMonth()+1?now.getDate():new Date(y,m,0).getDate();
    const f=(state.fixed||[]).find(function(x){ return x.id===fixedId; });
    const expected={identity:fixedPaymentIdentity(expenseBankOf(ex),ex),model:f&&fixedPaymentModel(f,m),paidYm:f&&f.paidYm,paidDay:f&&f.paidDay};
    const save=function(){
      if(withdrawalPending.current[ex.id]){ showToast(t("f_withdraw_receipt_pending")); return; }
      let subir=null;
      // El diálogo es asíncrono: otra sincronización puede sustituir el cargo o editar el recibo.
      set(function(s){
        // Solo si de ESTE cargo se dijo «no es este recibo»: confirmar lo deshace y repone la marca.
        const r=fixedId!=null&&reponerCargoDeRecibo(s,ex.id,fixedId,y,m,today,expected);
        if(r){ subir=r.e; return r.state; }
        return linkFixedPayment(s,ex.id,fixedId,y,m,today,expected);
      });
      if(subir && cloud.enabled()) cloud.setExpenseRecibo(subir).catch(function(){});
    };
    // Deshacer el vínculo de un cargo marcado es decir «no es este recibo»: una sola salida.
    if(fixedId==null && cargoDeRecibo(ex,state)){ quitarRecibo(ex); return; }
    if(fixedId==null){ save(); return; }
    // Un puntual solo llega aquí para deshacer su «no es este recibo»: no tiene vínculo de pago.
    const de=f||(state.oneoffs||[]).find(function(x){ return x.id===fixedId; });
    /* El diálogo de siempre promete que el presupuesto se conserva, y es verdad salvo al deshacer
       un «no es este recibo»: ahí el cargo vuelve a ser el de su recibo y deja de sumar en
       Gastos, que es lo que dice el texto de la marca. Solo se anuncia si la marca va a volver
       de verdad (`admiteMarcaDe`): con el recibo movido a otro banco no vuelve. */
    const repone=!!de&&reciboNoDe(state,fixedId,reciboNoIdentidad(ex),ex.id).length>0&&admiteMarcaDe(ex,de);
    if(!f&&!repone) return;
    askConfirm({title:tf("f_receipt_confirm",{name:de.name}),
      sub:repone?tf("f_recibo_marca",{name:de.name}):tf("f_receipt_confirm_sub",{merchant:ex.merchant,amount:eur(ex.amount),bank:entOf(expenseBankOf(ex)).label,date:fmtIsoCorto(ds),planned:entOf(accOf(f)).label,expected:eur(f.bankAmount>0?f.bankAmount:occAmountIn(f,m))}),
      ok:t("f_receipt_yes")}).then(function(yes){ if(yes) save(); });
  };
  // Marca/desmarca un gasto como "no tarjeta" (bizum/transferencia) para que no cuente el round-up TR.
  const setCardFlag=function(ex,noCard){
    set(function(s){ return Object.assign({},s,{expenses:s.expenses.map(function(e){ return e.id===ex.id?Object.assign({},e,{noCard:noCard?true:undefined}):e; })}); });
    if(cloud.enabled()) cloud.setExpenseNoCard(ex,noCard).catch(function(){});   // durable en la tabla
  };
  // Cambia el BANCO de un gasto manual (petición 2026-07-18). Solo manuales: los de OB/TR ya
  // vienen con su banco real y cambiárselo sería mentirse.
  const setBank=function(ex,b){
    if(ex && ex.source && ex.source!=="manual") return;
    set(function(s){ return Object.assign({},s,{expenses:s.expenses.map(function(e){ return e.id===ex.id?Object.assign({},e,{ent:b||undefined}):e; })}); });
    if(cloud.enabled()) cloud.setExpenseBank(ex,b).catch(function(){});   // durable (source manual:banco)
  };
  // Guarda el CONCEPTO escrito a mano (2026-07-24). `noteEdited` blinda el texto: el siguiente
  // sync del banco rellena conceptos vacíos, pero nunca pisa lo que ha escrito el usuario.
  // Vacío = se borra la nota, y también queda marcado (si no, el banco la volvería a poner).
  const noteSequence=useRef(0);
  const saveNote=function(ex, note){
    const raw=String(note||"").trim().slice(0,160);
    if(raw===String(ex.note||"").trim()&&!ex.notePending) return;
    const pending=cloud.enabled()&&!mcSandbox()&&!mcSandboxTransition();
    const at=noteSequence.current=Math.max(Date.now(),noteSequence.current+1,(ex.noteEditAt||0)+1);
    set(function(s){ return Object.assign({},s,{expenses:s.expenses.map(function(e){
      return e.id===ex.id ? Object.assign({},e,{note:raw||undefined, noteEdited:true,noteEditAt:at,notePending:pending}) : e;
    })}); });
    if(pending) cloud.setExpenseNote(ex,raw).then(function(ack){
      if(!ack)throw new Error("note unconfirmed");
      set(function(s){return Object.assign({},s,{expenses:s.expenses.map(function(e){
        return e.id===ex.id&&e.noteEditAt===at?Object.assign({},e,{notePending:false}):e;
      })});});
    }).catch(function(){showToast(t("g_note_unconfirmed"));});
  };
  // EDITAR un gasto (comercio / importe / gasto↔ingreso): para corregir lo que la ingesta parsea
  // mal (financiación Cofidis que notifica el TOTAL pero TR solo cobra la cuota, bizums antiguos
  // que entraron como gasto…). En la nube la clave es fecha|importe|comercio → se hace tombstone
  // de la fila vieja (deleted + deleteExpense) y se inserta la corregida, o el pull la resucitaría.
  const [editExp,setEditExp]=useState(null);   // {id, merchant, amount, income} — usado por el sheet de detalle
  const editCola=useRef({pend:[], fin:Promise.resolve()});   // escrituras de `saveEdit` en la nube
  const renameState=useRef(state);renameState.current=state;
  const renameSequence=useRef(0);
  const renameTimer=useRef(0), retryRef=useRef(null);
  /* Cada fallo espera antes del siguiente intento (2 s, 8 s y luego cada 30 s). Sin espera, el
     cambio de estado de un fallo relanzaba el envío en el acto y los tres intentos se gastaban
     en ~9 ms (beta 4.26.153). Lo que falló por red se adelanta al volver la conexión o la app. */
  const renameEspera=function(job,red){
    job.tries=(job.tries||0)+1;job.red=!!red;
    const ms=RENAME_BACKOFF_MS[Math.min(job.tries,RENAME_BACKOFF_MS.length)-1];
    job.waitUntil=Date.now()+ms;
    clearTimeout(renameTimer.current);
    renameTimer.current=setTimeout(function(){ if(retryRef.current) retryRef.current(); },ms+20);
  };
  const retryRenames=function(volvioRed){
    if(!cloud.enabled()||mcSandbox()||mcSandboxTransition())return;
    const s=renameState.current, owner=s._historyOwner,deleted=expenseDeletedSet(s);
    (s.expenses||[]).forEach(function(e){
      const pending=e.renamePending;
      if(!pending||pending.quarantined||expenseIsTombstoned(e,deleted)||editCola.current.pend.some(function(p){return p.rename&&p.id===e.id&&p.rename.at===pending.at;}))return;
      const job={id:e.id,rename:pending,current:function(){
        const fresh=renameState.current;if(fresh._historyOwner!==owner)return null;
        return (fresh.expenses||[]).find(function(x){return x.id===e.id&&x.date===e.date&&x.amount===e.amount&&x.renamePending&&!x.renamePending.quarantined&&x.renamePending.at===pending.at&&!expenseIsTombstoned(x,expenseDeletedSet(fresh));});
      },ack:function(orig,ack){set(function(fresh){return fresh._historyOwner===owner?expenseRenameAck(fresh,orig,pending,ack):fresh;});},fail:function(orig,failures,quarantined,red){
        const fresh=renameState.current,active=fresh._historyOwner===owner&&(fresh.expenses||[]).some(function(x){return x.id===orig.id&&x.date===orig.date&&x.amount===orig.amount&&x.renamePending&&x.renamePending.at===pending.at&&!x.renamePending.quarantined;});
        if(!active)return;
        if(!quarantined)renameEspera(job,red);
        if(red)return; // sin red: ni cuenta ni toca el estado
        set(function(s){return s._historyOwner===owner?expenseRenameFailure(s,orig,pending,failures):s;});
        if(quarantined)showToast(t("g_rename_paused"));
      }};
      editCola.current.pend.push(job);
    });
    if(volvioRed)editCola.current.pend.forEach(function(p){ if(p.rename&&p.red)p.waitUntil=0; });
    if(editCola.current.pend.length)subeEdicionesDeGasto(editCola.current);
  };
  retryRef.current=retryRenames;
  // Lo que se editó sin conexión se sube al volver: ver `subeEdicionesDeGasto`.
  useEffect(function(){
    const alVolver=function(){retryRenames(true);};
    const alVerse=function(){ if(document.visibilityState==="visible")retryRenames(true); };
    retryRenames();
    window.addEventListener("online",alVolver);
    document.addEventListener("visibilitychange",alVerse);
    return function(){ window.removeEventListener("online",alVolver); document.removeEventListener("visibilitychange",alVerse); };
  },[state.expenses]);
  useEffect(function(){ return function(){ clearTimeout(renameTimer.current); }; },[]);
  const [detailId,setDetailId]=useState(null);     // id del gasto abierto en sheet (SPEC §14)
  // PUNTO 5: al tocar la noti de un gasto, App pasa focusExp ({amount,merchant}) → abrimos la ficha
  // del gasto que casa (mismo importe y comercio parecido, el más reciente; si no, el último gasto).
  useEffect(function(){
    if(!focusExp) return;
    const cands=(state.expenses||[]).filter(function(e){
      if(Math.abs(Math.abs(e.amount)-focusExp.amount)>0.005) return false;
      if(focusExp.merchant){ const m=(e.merchant||"").toLowerCase(), fm=focusExp.merchant.toLowerCase(); if(m.indexOf(fm.slice(0,Math.min(6,fm.length)))<0 && fm.indexOf(m)<0) return false; }
      return true;
    }).sort(function(a,b){ return dateMs(b.date)-dateMs(a.date); });
    if(cands[0]){
      setDetailId(cands[0].id); setEditExp({id:cands[0].id, merchant:cands[0].merchant||"", amount:String(Math.abs(cands[0].amount)).replace('.',','), income:cands[0].amount<0, date:String(cands[0].date||"").slice(0,10)});
      if(clearFocus) clearFocus();
      return;
    }
    // Sin match todavía: lo normal es que el gasto de la noti AÚN esté bajando de la nube
    // (App ya lanzó syncCloudExpenses) → esperamos a que lleguen gastos nuevos (dep state.expenses
    // re-ejecuta) en vez de abrir "el último" a ciegas (abría la ficha EQUIVOCADA — feedback
    // pareja 2026-07-10, punto 8). Si en 12s no aparece, abrimos el más reciente como antes.
    const tm=setTimeout(function(){
      const e=(state.expenses||[]).slice().sort(function(a,b){ return dateMs(b.date)-dateMs(a.date); })[0];
      if(e){ setDetailId(e.id); setEditExp({id:e.id, merchant:e.merchant||"", amount:String(Math.abs(e.amount)).replace('.',','), income:e.amount<0, date:String(e.date||"").slice(0,10)}); }
      if(clearFocus) clearFocus();
    }, 12000);
    return function(){ clearTimeout(tm); };
  },[focusExp, state.expenses]);
  const saveEdit=function(orig, extra){
    const ed=Object.assign({}, editExp, extra||{});
    const locked=!!(orig.source && orig.source!=="manual");
    const amt=locked?Math.abs(orig.amount):(parseFloat(String(ed.amount).replace(',','.'))||0);
    if(amt<=0){ showToast(t("g_invalid")); return; }
    const signed=locked?orig.amount:(ed.income? -amt : amt);
    const merch=(ed.merchant||"").trim()||orig.merchant;
    /* NO se pone `editExp` a null: eso CONGELABA LA PANTALLA (bug suyo 2026-08-17, «al modificarlo
       y guardarlo se bloquea, solo si tiras para atrás puedes seguir»). El sheet decide si pintarse
       con `!exp || !editExp`, pero sus candados (`useSheetSwipe`, que pone `overflow:hidden` y se
       come TODOS los `touchmove` de fuera del sheet) van con `!!exp` a secas. Al vaciar `editExp`
       el sheet dejaba de pintarse, `sheetRef` pasaba a null —así que ningún toque contaba como
       «dentro»— y el candado se quedaba puesto sobre una pantalla vacía. Atrás lo liberaba porque
       ahí sí se cierra de verdad.
       Viene de la v3.108.0, no de esta tanda; saltaba con cualquier blur del importe o del nombre.
       Además, el comentario de `closeSave` dice que al perder el foco se GUARDA pero NO se cierra:
       vaciar el estado de edición era justo lo contrario. Ahora se deja sincronizado con lo
       guardado, que es lo que ese comentario prometía. */
    const sincroniza=function(e){
      setEditExp({ id:e.id, merchant:e.merchant||"", amount:String(Math.abs(e.amount)).replace('.',','),
        income:e.amount<0, note:e.note||"", date:String(e.date||"").slice(0,10) });
    };
    const origDay=String(orig.date||"").slice(0,10);
    const newDay=String(ed.date||origDay).slice(0,10);
    if(signed===orig.amount && merch===(orig.merchant||"") && newDay===origDay&&!orig.renamePending){ sincroniza(orig); return; }   // sin cambios
    const cat = ed.income ? "ingreso" : (orig.category==="ingreso" ? autoCategory(merch) : orig.category);
    const splitByEdit=(signed!==orig.amount||newDay!==origDay)&&!!gemeloAutomaticoDe(state,orig);
    if(splitByEdit) separarGemelo(orig);
    const upd=Object.assign({},orig,{merchant:merch, amount:signed, category:cat});
    if(newDay!==origDay) upd.date=newDay;
    /* Al renombrar un movimiento del banco, guardar CÓMO LO LLAMABA ÉL (2026-08-17). El dedup de
       Open Banking casa por día|importe|comercio, así que sin esto el siguiente sync no reconoce
       la fila renombrada y vuelve a meter el gasto — el caso de «Movimiento» de Trade Republic,
       que es justo el que él quiere poder renombrar. Las filas nuevas ya nacen con `obName`; esto
       cubre las que YA tiene en el móvil, que se sellan la primera vez que las toca. */
    const esDeBanco=orig.source==="ob"||orig.source==="ob-hist";
    if(esDeBanco && upd.obName==null && merch!==(orig.merchant||"")) upd.obName=orig.merchant||"";
    if(ed.income) upd.noCard=true;   // un ingreso nunca alimenta el round-up
    /* Si toca el importe en euros a mano, el rastro «eran 1.520 ₺» deja de corresponderse: se
       borra en vez de arrastrarlo. Un dato viejo al lado de uno nuevo no es media verdad, es una
       mentira — y en el detalle se leerían juntos como si fueran el mismo pago. */
    if(signed!==orig.amount){ delete upd.origAmount; delete upd.origCur; }
    if(signed===orig.amount&&newDay===origDay&&cloud.enabled()&&!mcSandbox()&&!mcSandboxTransition()){
      if(orig.renamePending&&orig.renamePending.merchant===merch){
        if(!orig.renamePending.quarantined){retryRenames();return;}
        if(!ed.retryRename)return; // cerrar la ficha no equivale a pedir otro envío
      }
      const at=renameSequence.current=Math.max(Date.now(),renameSequence.current+1,(orig.renamePending&&orig.renamePending.at||0)+1);
      set(function(s){return expenseRenameDraft(s,orig,merch,at);});
      return;
    }
    // La lápida de cuenta significa borrado: al cambiar solo el nombre ocultaría
    // también la fila renombrada por su obName. Como FIN04, usar ambas claves sin ámbito
    // permite además levantar la vieja al volver al nombre original.
    const soloNombreBanco=esDeBanco&&upd.obName!=null&&merch!==(orig.merchant||"")&&signed===orig.amount&&newDay===origDay;
    set(function(s){ return rekeyFixedPaymentExpense(Object.assign({},s,{
      expenses:s.expenses.map(function(x){ return x.id===orig.id?upd:x; })
    },lapidasAlEditar(s, soloNombreBanco?keyOfExpense(orig):expenseDeletionKey(orig), soloNombreBanco?keyOfExpense(upd):expenseDeletionKey(upd))),orig,upd); });
    // Borrado y alta en la nube, en orden y detrás de la edición anterior (`subeEdicionesDeGasto`).
    if(cloud.enabled()){ editCola.current.pend.push({orig:orig, upd:upd}); subeEdicionesDeGasto(editCola.current); }
    sincroniza(upd); showToast(t(splitByEdit?"g_auto_edit_separated":"g_edited"));
  };

  const todayKey=new Date().toDateString();
  // Las ventanas de mes son de Madrid: el memo también debe caducar al cambiar el día ALLÍ, que
  // en un dispositivo de otra zona no coincide con `todayKey`.
  const mad=madridYmdParts(Date.now()), madridDay=mad.ym+"-"+mad.d;
  const cycle=useMemo(()=>cycleEnabled?budgetPaydayOf(state,null,expensesDef)
    :lastPaydayOf(expensesDef,null,expenseDeletedSet(state)),
    [expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.flows,cycleEnabled,todayKey]);
  // Bancos presentes en el período (o configurados como gasto) → chips de filtro.
  // "_manual" = apuntados a mano / sin banco conocido (no mezclar con OB).
  // Chips de banco: baratos y SIEMPRE visibles (no dependen de heavyOk → sin flash).
  // `todayKey` invalida ciclo, filtros y cabecera cuando la app queda abierta al cruzar el día;
  // así el 26 o el día 1 no conserva cifras del período anterior en un memo.
  const bounds=useMemo(function(){ return presetBoundsMs(preset,range,cycle&&cycle.start); },[preset,range,cycle,todayKey,madridDay]);
  /* En «months» la lista no tiene ventana (es el histórico entero, mes a mes), pero la cifra de
     arriba y el desglose son los del MES EN CURSO: desde el día 1 de Madrid hasta el día 1 del mes
     siguiente, como la tarjeta de antes. Inicio (`budgetPeriodOf`) no pone tope: un apunte fechado
     el mes que viene suma allí al mes en curso. Aquí sale en SU mes de la lista y no puede sumar
     también arriba (e2e gastos-mes-madrid); con apuntes normales las dos cifras son la misma. */
  const selectedPeriod=useMemo(function(){
    if(preset==="months"){
      const ini=inicioDeMesMs(Date.now());
      return {startMs:ini, todayEndMs:inicioDeMesMs(ini+35*864e5), cycle:null};
    }
    return gastosPeriodOf(preset,bounds,cycle);
  },[preset,bounds,cycle,todayKey,madridDay]);
  const diarioEnts=useMemo(function(){ return expenseBankEnts(state); },[state.accounts, state.settings]);
  const diarioPrev=useRef(diarioEnts.slice());
  const diarioKey=diarioEnts.slice().sort().join("|");
  useEffect(function(){
    const prev=diarioPrev.current;
    setBankSel(function(cur){ return sameEntList(cur,prev)?diarioEnts.slice():cur; });
    diarioPrev.current=diarioEnts.slice();
  },[diarioKey]);
  const bankOpts=useMemo(function(){
    const seen={}; const order=[];
    const add=function(k){ if(!k||seen[k]) return; seen[k]=1; order.push(k); };
    expenseBankEnts(state).forEach(add);
    (state.accounts||[]).forEach(function(a){ if(a&&a.ent) add(a.ent); });
    let hasManual=false;
    (expensesDef||[]).forEach(function(e){
      if(!inBounds(dateMs(e.date),bounds)) return;
      const b=expenseBankOf(e); if(b) add(b); else hasManual=true;
    });
    if(hasManual) order.push("_manual");
    return order;
  },[expensesDef,state.accounts,state.settings,bounds]);
  // UNA sola pasada en vez de cuatro `.filter()` encadenados: cada eslabón construía un array
  // intermedio del tamaño del histórico y volvía a recorrerlo entero (2026-07-24).
  const filtered=useMemo(()=>{
    const needle=q.trim().toLowerCase();
    const catSet=sel.length? new Set(sel) : null;         // indexOf en cada gasto era O(n·m)
    const bankSet=bankSel.length? new Set(bankSel) : null;
    const bkSet=bucketSel.length? new Set(bucketSel) : null;
    const out=[];
    const src=expensesDef||[];
    for(let i=0;i<src.length;i++){
      const e=src[i];
      // La lápida puede venir de otro dispositivo sin retirar aún esta fila local.
      if(e.autoGemelo||expenseIsTombstoned(e,expenseDeletedSet(state))) continue;
      if(!inBounds(dateMs(e.date),bounds)) continue;
      // `debt:<id>` en la misma lista que las categorías: el chip de cada deuda (4.21.0).
      if(catSet && !catSet.has(e.category) && !(e.debtId && catSet.has("debt:"+e.debtId))) continue;
      if(bankSet && !bankSet.has(expenseBankOf(e)||"_manual")) continue;
      if(bkSet && !bkSet.has(expenseBucket(e, state))) continue;
      if(needle){
        // El concepto también se busca: si tu padre busca «alquiler» tiene que salir el bizum
        // cuyo mensaje lo dice, aunque el título sea solo el nombre de la persona (2026-07-24).
        const hay=(e.merchant||"").toLowerCase().indexOf(needle)!==-1
          || String(e.note||"").toLowerCase().indexOf(needle)!==-1
          || catName(e.category).toLowerCase().indexOf(needle)!==-1;
        if(!hay) continue;
      }
      out.push(e);
    }
    return sortExpensesForDisplay(out,state);
    // `state.settings`/`state.accounts` van en las dependencias porque `expenseBucket` los lee
    // (qué bancos son de gasto diario): cambiar eso tiene que re-filtrar la lista.
  },[expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,bounds,sel,bankSel,bucketSel,q,state.settings,state.accounts,state.fixed,state.oneoffs,state.reciboNo]);

  /* El asa reclama el dedo desde el principio: dejar que la fila entera fuera arrastrable
     convertiría un scroll normal en cambios de orden accidentales. El destino se resuelve contra
     el DOM porque solo hay unas pocas filas visibles; `moveExpenseWithinDay` vuelve a comprobar
     la fecha antes de guardar, así un dedo que cruce un separador nunca mezcla días. */
  const startExpenseDrag=useCallback(function(ev,e){
    ev.stopPropagation(); cancelSwipe();
    const d={from:e.id,to:e.id,day:String(e.date||"").slice(0,10)};
    dragExpenseRef.current=d; setDragExpense(d);
  },[cancelSwipe]);
  const moveExpenseDrag=useCallback(function(ev){
    const d=dragExpenseRef.current; if(!d||!ev.touches||!ev.touches[0]) return;
    ev.stopPropagation();
    const p=ev.touches[0], hit=document.elementFromPoint(p.clientX,p.clientY);
    const row=hit&&hit.closest&&hit.closest("[data-expense-id]");
    if(!row||row.getAttribute("data-expense-day")!==d.day) return;
    const to=row.getAttribute("data-expense-id"); if(!to||to===d.to) return;
    d.to=to; setDragExpense({from:d.from,to:d.to,day:d.day});
  },[]);
  const endExpenseDrag=useCallback(function(){
    const d=dragExpenseRef.current;
    if(d&&d.from!==d.to){ suppressOpenRef.current=Date.now()+400; set(function(s){ return moveExpenseWithinDay(s,d.from,d.to); }); }
    dragExpenseRef.current=null; setDragExpense(null);
  },[set]);

  // Las fechas elegidas mueven cabecera y categorías junto a la lista (reporte 2/10).
  // Buscar o filtrar bancos/categorías sigue explorando movimientos sin redefinir el límite.
  // `accounts` + `settings` van en deps: monthBudgetStats → expenseCountsBudget → expenseBankEnts
  // lee rol diario y expenseBanks. Sin ellos, quitar un banco de gasto diario dejaba la cabecera
  // alta hasta que un sync cambiaba `expenses` (B09-A / feedback familia 2026-09-06).
  const budgetApplies=preset==="months"||preset==="cycle";
  const monthSummary=useMemo(function(){
    const bs=monthBudgetStats(Object.assign({},state,{expenses:expensesDef}),null,null,null,selectedPeriod);
    // No existe una foto histórica del límite ni un presupuesto acumulado para varios meses.
    // Enseñar el límite actual como margen del pasado inventaría dinero disponible.
    if(!budgetApplies){ bs.budget=null; bs.remaining=null; }
    const periodLabel=preset==="custom"
      ? (range.from?fmtIsoCorto(range.from):t("g_all"))+" → "+(range.to?fmtIsoCorto(range.to):t("g_all"))
      : preset==="months" ? monthLong(mad.m-1) : preset==="all" ? t("gv5_all") : t("g_"+preset);
    return {
      spent:bs.spent, income:bs.income, balance:bs.balance, mode:bs.mode, against:bs.against, shown:bs.shown,
      budget:bs.budget, reserved:bs.reserved, remaining:bs.remaining,
      cycle:!!selectedPeriod.cycle,
      periodLabel:periodLabel, budgetApplies:budgetApplies
    };
  },[expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.budget,state.reservaLog,state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,selectedPeriod,preset,range,budgetApplies,todayKey,madridDay]);
  /* Sumas por día para la cifra viva. Mismas porciones del estado que la cabecera (las lee
     `expenseCountsBudget`); NO depende de la búsqueda ni de los filtros: la cifra es la del
     presupuesto, igual que antes la tarjeta («buscar no redefine el límite»). */
  const cifra=useMemo(function(){
    const months=preset==="months";
    const to=months||bounds.to===Infinity?Infinity:bounds.to+1;
    return gastosCifraDias(state, expensesDef, months?{cycle:null}:selectedPeriod, months?-Infinity:bounds.from, to, months);
  },[expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,selectedPeriod,preset,bounds,todayKey,madridDay]);
  // Desglose por categoría: misma regla/ventana que la cabecera. categoryBudgets en deps
  // porque una fila a 0 con límite tiene que aparecer aunque no haya gastos nuevos.
  const catBreakdown=useMemo(function(){
    const rows=categorySpentByMonth(Object.assign({},state,{expenses:expensesDef}),null,null,selectedPeriod);
    return budgetApplies?rows:rows.filter(function(row){ return row.spent>0; }).map(function(row){ return {id:row.id,spent:row.spent,limit:null}; });
  },[expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.categoryBudgets,state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,selectedPeriod,budgetApplies,todayKey,madridDay]);
  /* Abierto o plegado, por cuenta. `!==false` y no `!!`: quien nunca lo ha tocado lo ve ABIERTO
     —es como está hoy y como él lo aprobó—, y solo se pliega quien lo pliegue a mano. */
  const catsOpen=!(state.settings && state.settings.gastosCatsOff);
  // La fecha del cobro sigue a la vista al plegar la explicación; ocultarla dejaba «Mi ciclo»
  // sin una referencia comprobable y la tarjeta larga volvía a ocupar la pantalla (28/9).
  const cycleHelpOpen=!(state.settings && state.settings.gastosCycleHelpOff);
  const toggleCycleHelp=useCallback(function(){
    set(function(s){
      const st=Object.assign({}, s.settings||{});
      if(st.gastosCycleHelpOff) delete st.gastosCycleHelpOff; else st.gastosCycleHelpOff=true;
      return Object.assign({}, s, { settings:st });
    });
  },[set]);
  const toggleCats=useCallback(function(){
    set(function(s){
      const st=Object.assign({}, s.settings||{});
      if(st.gastosCatsOff) delete st.gastosCatsOff; else st.gastosCatsOff=true;
      return Object.assign({}, s, { settings:st });
    });
  },[set]);
  const editCatBudget=useCallback(function(id){
    const cur=Number((state.categoryBudgets||{})[id])||0;
    const parseAmt=function(raw){ return Math.abs(parseFloat(String(raw==null?"":raw).replace(/\s/g,"").replace(",","."))||0); };
    const chips=[{v:100,label:"100 €"},{v:200,label:"200 €"},{v:300,label:"300 €"}];
    if(cur>0) chips.push({v:0,label:t("g_cat_budget_clear")});
    askText({ title:tf("g_cat_budget_title",{cat:catName(id)}), sub:t("g_cat_budget_sub"),
      ph:cur>0?String(cur).replace(".",","):"200", ok:t("save"), chips:chips })
      .then(function(raw){
        if(raw==null) return;
        const amt=parseAmt(raw);
        set(function(s){
          const next=Object.assign({}, s.categoryBudgets||{});
          if(!(amt>0)) delete next[id];
          else next[id]=+amt.toFixed(2);
          return Object.assign({}, s, { categoryBudgets:next });
        });
      });
  },[set, state.categoryBudgets]);
  const subs=useMemo(function(){ return heavyOk?detectSubscriptions(expensesDef):[]; },[heavyOk,expensesDef]);
  const suggestAi=function(ex){
    if(!(state.settings&&state.settings.aiCat)){ showToast(t("ai_cat_off")); return; }
    if(!ex||aiBusy) return;
    // KW locales primero (mismas que ingest): Recibos/heladería/… no esperan a desplegar la Edge.
    const local=autoCategory(ex.merchant||"");
    if(local && local!=="otros" && CAT[local]){
      setCat(ex,local);
      showToast(tf("ai_cat_ok",{c:catName(local)}));
      return;
    }
    if(!cloud.enabled()){ showToast(t("ai_cat_none")); return; }
    setAiBusy(true);
    cloud.suggestCategory(ex.merchant||"").then(function(res){
      const cat=res&&res.category;
      if(!cat||cat==="otros"||!CAT[cat]){ showToast(t("ai_cat_none")); return; }
      setCat(ex,cat);
      showToast(tf("ai_cat_ok",{c:catName(cat)}));
    }).catch(function(e){ showToast("⚠ "+((e&&e.message)||e)); }).finally(function(){ setAiBusy(false); });
  };
  useEffect(()=>{ setVisible(CONFIG.PAGE_SIZE); },[preset,range,sel,bankSel,bucketSel,q]);
  /* LA PAGINACIÓN DE LA LISTA — sus fallos, y el de 2026-07-27.
     1. «Cuando bajas hacia abajo RAPIDÍSIMO deslizando se para cada cierto tiempo.» El centinela
        se vigilaba con `rootMargin:120px`, o sea que la tanda siguiente no se pedía hasta tenerlo
        casi encima, y llegaban de 12 en 12: en un desliz rápido te comes el final de la lista
        antes de que dé tiempo a pintar la siguiente. Con 600 px / +24 aún se notaba el tope
        (feedback 2026-07-27: «hasta cierto gasto se bloquea y al milisegundo puedo seguir»).
        Ahora se pide con 2.000 px de antelación y de 60 en 60 (la PRIMERA tanda sigue siendo
        de 12, que es lo que se pinta al entrar y lo que vigila el presupuesto de rendimiento).
     2. «Cuando le doy otra vez a "Este mes" sale lo de la foto y no carga nada aun esperando un
        rato.» Éste era un fallo de verdad y llevaba escondido desde siempre: el observador se
        creaba en un efecto atado a `filtered.length`, pero el centinela SOLO EXISTE mientras
        `visible<filtered.length`. Al llegar al final de la lista se desmonta, y el observador se
        quedaba mirando un nodo huérfano; si algo lo volvía a montar sin que cambiara
        `filtered.length` —volver a pulsar el filtro que ya estaba puesto resetea `visible` a 12
        con la misma lista— nadie lo vigilaba: «Cargando más…» ahí clavado para siempre.
        Ahora el observador se ata al nodo con una callback ref, así que se rehace exactamente
        cuando el centinela nace o muere, pasen lo que pasen las dependencias del efecto. */
  const filtLen=useRef(0); filtLen.current=filtered.length;   // el observador vive fuera del render: sin esto cerraría sobre una longitud vieja
  const ioRef=useRef(null);
  const sentinelRefCb=useCallback(function(el){
    if(ioRef.current){ ioRef.current.disconnect(); ioRef.current=null; }
    if(!el) return;
    const io=new IntersectionObserver(function(es){
      if(es[0].isIntersecting) setVisible(function(v){ return v<filtLen.current ? v+CONFIG.PAGE_SIZE*5 : v; });
    },{rootMargin:"2000px"});
    io.observe(el); ioRef.current=io;
  },[]);
  useEffect(function(){ return function(){ if(ioRef.current) ioRef.current.disconnect(); }; },[]);
  /* LA LISTA SE SUELTA AL VOLVER ARRIBA (13/9, medido en su OnePlus 13 con 2.500 gastos).
     Su queja: «he bajado y subido varias veces… y de repente se ha comenzado a ralentizar».
     La paginación solo CRECÍA: cada vez que bajaba se añadían 60 filas y ninguna se iba al subir.
     Medido con gestos reales: con 554 filas QUIETAS, 0 frames lentos; pero cada tanda nueva cuesta
     más cuanto más hay pintado (8 → 26 → 27 → 32 frames >33 ms por ciclo, de 374 a 794 filas), y
     ciclar arriba/abajo —su gesto— lo acumula sin techo. `content-visibility` se probó y EMPEORA
     (layouts ×3). Así que al llegar arriba del todo, y quieto un momento, vuelve a la primera tanda:
     el siguiente viaje hacia abajo empieza barato otra vez. Quitar filas de ABAJO estando arriba no
     mueve lo que se ve. */
  const rootRef=useRef(null);
  const visibleRef=useRef(visible); visibleRef.current=visible;
  useEffect(function(){
    const root=rootRef.current;
    const host=root && root.closest ? root.closest(".page") : null;
    if(!host) return undefined;
    let tm=0;
    const onScroll=function(){
      if(host.scrollTop>150 || visibleRef.current<=CONFIG.PAGE_SIZE) return;
      if(tm) clearTimeout(tm);
      tm=setTimeout(function(){
        tm=0;
        if(host.scrollTop<=150 && visibleRef.current>CONFIG.PAGE_SIZE) setVisible(CONFIG.PAGE_SIZE);
      }, 300);
    };
    host.addEventListener("scroll", onScroll, {passive:true});
    return function(){ host.removeEventListener("scroll", onScroll); if(tm) clearTimeout(tm); };
  },[]);

  // Abrir la ficha de un movimiento. useCallback = referencia ESTABLE: si cambiara en cada render,
  // el React.memo de MovRow no serviría para nada y volveríamos al problema de siempre.
  const openDetail=useCallback(function(e){
    if(Date.now()<suppressOpenRef.current) return;
    setDetailId(e.id);
    setEditExp({id:e.id, merchant:e.renamePending?e.renamePending.merchant:e.merchant||"", amount:String(Math.abs(e.amount)).replace('.',','), income:e.amount<0, note:e.note||"", date:String(e.date||"").slice(0,10)});
  },[]);
  // Invalida las filas memoizadas cuando cambia el idioma o la moneda de visualización (las leen
  // de globales que React.memo no ve).
  const l10nKey=CURLANG+"|"+DISP.sym;

  /* Meses de la lista (para la fila de meses) y dónde empieza cada uno. Una pasada por cambio de
     lista; `gastosDia` va por caché de hora, sin un `Date` por fila. */
  const mesesLista=useMemo(function(){
    const first=Object.create(null), orden=[];
    for(let i=0;i<filtered.length;i++){
      const info=gastosDia(dateMs(filtered[i].date));
      if(!first[info.ym]){ first[info.ym]={i:i,k:info.k,ym:info.ym}; orden.push(info.ym); }
    }
    if(!first[mad.ym]) orden.push(mad.ym);
    orden.sort();
    const nuevo=filtered.length?gastosDia(dateMs(filtered[0].date)):null;
    return {orden:orden, first:first, newestK:nuevo&&nuevo.k, newestYm:nuevo&&nuevo.ym};
  },[filtered,madridDay]);
  /* LA CABECERA, COMO DATOS (SPEC §3). `top` es lo que se ve arriba del todo; `line(k)` lo que se
     ve cuando el día k queda bajo la cabecera. Todo sale de tablas ya calculadas: la cabecera lo
     consulta en cada cambio de día visible sin recorrer nada.
     · Mes en curso: la cifra de Inicio y su margen contra el presupuesto. Sin presupuesto, contra
       el mes anterior HASTA EL MISMO DÍA (a día 20, contra septiembre entero siempre sería «menos»).
     · Mes cerrado: su total y «cerrado». NUNCA contra el límite: no hay foto histórica del límite
       y el de hoy aplicado al pasado inventaría margen (regla de la tarjeta de antes, que se
       conserva). Contra el mes anterior solo si el histórico lo cubre ENTERO: con medio mes
       cargado, «menos que agosto» sería falso.
     · Bajando dentro de un mes: lo acumulado hasta ese día. */
  const cab=useMemo(function(){
    const mode=monthSummary.mode;
    const fmt=function(x){ x=Math.abs(x); return x<1?eur(x):eur0(x); };
    const mesDe=function(ym){ return monthLong(+ym.slice(5,7)-1); };
    // En modo balance la cifra se enseña sin signo, como `shown` de `monthBudgetStats`.
    const shownOf=function(v){ return mode==="net"?Math.abs(v):v; };
    // En balance la cifra es un neto: debajo se dice de qué sale, como hacía la tarjeta de antes
    // («Mi ciclo explica el margen», 28/9). Con gasto bruto no hace falta: la cifra ES el gasto.
    const subDe=function(x){ return mode==="net"?tf("gv5_net_sub",{g:eur(x.sp),i:eur(x.inc)}):null; };
    const cubre=function(ym){ return cifra.earliest<gastosYmInicioMs(ym); };
    const vsBudget=function(){
      const r=monthSummary.remaining;
      if(r==null) return null;
      return r<0?{tail:tf("gv5_over",{x:fmt(r)}),tone:"coral"}:{tail:tf("gv5_under",{x:fmt(r)}),tone:"mint"};
    };
    const vsPrev=function(cur,prev,ym,mismoDia){
      const diff=cur-prev, mes=mesDe(ym), sd=mismoDia?"_sd":"";
      if(Math.abs(diff)<1) return {tail:tf("gv5_same"+sd,{mes:mes}),tone:"muted"};
      return {tail:tf((diff>0?"gv5_more":"gv5_less")+sd,{x:fmt(diff),mes:mes}),tone:diff>0?"coral":"mint"};
    };
    let top;
    if(preset==="months"){
      let st=vsBudget();
      const pym=gastosYmPrev(mad.ym);
      if(!st && cubre(pym)){
        const prevK=+pym.slice(0,4)*10000+(+pym.slice(5,7))*100+mad.d;
        st=vsPrev(monthSummary.against, gastosValor(gastosCumDia(cifra,prevK,pym),mode), pym, true);
      }
      top={n:monthSummary.shown, pre:tf(mode==="net"?"gv5_net_in":"gv5_spent_in",{mes:mesDe(mad.ym)}), tail:st&&st.tail, tone:st&&st.tone, ym:mad.ym};
    } else if(preset==="cycle"){
      const st=vsBudget();
      top={n:monthSummary.shown, pre:t("gv5_cycle"), tail:st&&st.tail, tone:st&&st.tone, ym:null};
    } else top={n:monthSummary.shown, pre:monthSummary.periodLabel, ym:null};
    top.sub=subDe({sp:monthSummary.spent, inc:monthSummary.income});
    const line=function(k, ym){
      if(preset==="months"){
        const first=mesesLista.first[ym], esPrimero=!!first&&first.k===k;
        if(esPrimero && ym===mad.ym) return top;
        if(esPrimero && ym<mad.ym){
          const m=cifra.months[ym]||{sp:0,inc:0}, v=gastosValor(m,mode), pym=gastosYmPrev(ym);
          const st=cubre(pym)?vsPrev(v,gastosValor(cifra.months[pym]||{sp:0,inc:0},mode),pym,false):null;
          return {n:shownOf(v), pre:tf("gv5_closed",{mes:mesDe(ym)}), tail:st&&st.tail, tone:st&&st.tone, ym:ym, sub:subDe(m)};
        }
        const c=gastosCumDia(cifra,k,ym);
        return {n:shownOf(gastosValor(c,mode)), pre:tf(mode==="net"?"gv5_upto_net":"gv5_upto",{mes:mesDe(ym),d:k%100}), ym:ym, sub:subDe(c)};
      }
      if(k===mesesLista.newestK && ym===mesesLista.newestYm) return top;
      const d=(k%100)+" "+monthShort(Math.floor(k/100)%100-1).toLowerCase(), c=gastosCumDia(cifra,k);
      return {n:shownOf(gastosValor(c,mode)), sub:subDe(c),
        pre:preset==="cycle"?tf("gv5_cycle_upto",{d:d}):tf("gv5_period_upto",{period:monthSummary.periodLabel,d:d}), ym:null};
    };
    const meses=mesesLista.orden.map(function(ym){
      const y=+ym.slice(0,4);
      return {ym:ym, label:mesDe(ym)+(y!==mad.y?" "+y:"")};
    });
    return {top:top, line:line, meses:meses};
  },[monthSummary,cifra,mesesLista,preset,madridDay,l10nKey]);
  /* Tocar un mes salta a su primer día. Si aún no está pintado (la lista va por tandas), se
     amplía la tanda y el salto se hace al montarse el día. El mes en curso es volver arriba. */
  const diasRef=useRef(null);
  const saltoRef=useRef(null);
  const mesesListaRef=useRef(mesesLista); mesesListaRef.current=mesesLista;
  const hostDe=function(){ const r=rootRef.current; return r&&r.closest?r.closest(".page"):null; };
  const scrollHost=function(top){
    const h=hostDe(); if(!h) return;
    // Suave solo en saltos cortos: cruzar tres meses deslizando hace rodar la cifra por todos los
    // días de por medio y tarda; lejos, se aparece directamente en el mes elegido.
    const lejos=Math.abs(h.scrollTop-top)>h.clientHeight*2.5;
    h.scrollTo({top:Math.max(0,top), behavior:mcReduced()||lejos?"auto":"smooth"});
  };
  const saltaADia=function(k){
    const h=hostDe(), root=rootRef.current; if(!h||!root) return false;
    const el=root.querySelector('[data-gx-day="'+k.k+'"][data-gx-ym="'+k.ym+'"]'), head=root.querySelector(".gx-head");
    if(!el||!head) return false;
    // La raya de lectura es el borde de la cabecera YA ENCOGIDA (con la fila de meses debajo):
    // su caja no cambia de alto al encogerse, solo se suma lo que sobresale la fila de meses.
    const pad=parseFloat(getComputedStyle(h).paddingTop)||0;
    const raya=pad+head.offsetHeight+GX_MESES_SOBRE;
    scrollHost(h.scrollTop+el.getBoundingClientRect().top-h.getBoundingClientRect().top-raya+2);
    return true;
  };
  const irAMes=useCallback(function(ym){
    const L=mesesListaRef.current, first=L.first[ym];
    if(!first || first.i===0){ scrollHost(0); return; }
    if(saltaADia(first)) return;
    saltoRef.current=first;
    setVisible(function(v){ return Math.max(v, first.i+CONFIG.PAGE_SIZE); });
  },[]);
  useLayoutEffect(function(){
    // La lista acaba de cambiar: la cabecera vuelve a buscar los días la próxima vez que mire.
    diasRef.current=null;
    if(saltoRef.current!=null && saltaADia(saltoRef.current)) saltoRef.current=null;
  });
  const clearFilters=function(){
    setSel([]);
    setBucketSel([]);
    // Borrar filtros = volver a la preselección automática de gasto diario y al periodo de entrada.
    setBankSel(diarioEnts.slice());
    setPreset(presetDef);
  };

  // Resumen de filtros activos, para el botón "Filtros" (badge) y la línea de chips debajo.
  // Se calcula aquí (no memoizado: sel/bankSel son arrays cortos) porque lo usan dos sitios:
  // el botón junto al buscador y la línea de resumen + "Borrar filtros".
  // La preselección automática no cuenta como filtro puesto; «Todos» sí amplía la vista a mano.
  const bankSelIsDefault=sameEntList(bankSel, diarioEnts);
  const nCatSel=sel.length;
  const nBankSel=bankSelIsDefault?0:Math.max(1,bankSel.length);
  // El periodo vive en Filtros desde la v5: cuenta como filtro solo si no es el de entrada.
  const nPeriod=preset!==presetDef?1:0;
  const nFilters=nCatSel+nBankSel+bucketSel.length+nPeriod;
  const filterParts=[];
  if(nPeriod) filterParts.push(monthSummary.periodLabel);
  if(bucketSel.length===1) filterParts.push(t("g_bk_"+bucketSel[0]));
  else if(bucketSel.length>1) filterParts.push(bucketSel.length+" "+t("g_bk_title").toLowerCase());
  if(nCatSel===1) filterParts.push(filterSelLabel(sel[0], state.debts));
  else if(nCatSel>1) filterParts.push(nCatSel+" "+t("g_filters_cats"));
  if(!bankSelIsDefault){
    if(bankSel.length===0) filterParts.push(t("g_allbanks"));
    else if(bankSel.length===1){
      const b=bankSel[0];
      filterParts.push(b==="_manual"?t("g_bank_manual"):(entOf(b).label||b));
    } else filterParts.push(bankSel.length+" "+t("g_filters_banks"));
  }

  const shown=filtered.slice(0,visible);
  /* A LA FILA SE LE PASA EL NÚMERO, NO EL `Date` (2026-07-27, y esto llevaba roto desde siempre).
     `parseDate` cachea los MILISEGUNDOS pero devuelve `new Date(ms)`: un objeto NUEVO en cada
     llamada. Como la fecha viajaba a `MovRow` como prop, la comparación superficial de
     `React.memo` fallaba SIEMPRE por esa prop —da igual que el gasto sea idéntico—, así que
     cualquier re-render de Gastos repintaba las doce filas. Se cuidó que `onOpen` fuera estable
     (ahí al lado está el comentario) y la fecha se coló por debajo.
     Se vio saliendo de Deudas hacia Gastos: el perfilador ponía `MovRow` como la función más cara
     de la app en ese gesto. Con un número, la comparación acierta y la fila solo se rehace cuando
     cambia de verdad; el `Date` se construye DENTRO, que es donde se usa para formatear. */
  /* GASTOS v5 · LOS DÍAS (SPEC §4.2 y §4.4). Cada gasto en su tarjeta y, por día, los cargos del
     banco que pagan un recibo o una cuota en UNA fila gris desplegable: se siguen viendo (4.26.122:
     todo cargo del banco aparece) sin ocupar la lista. Buscando o filtrando por categoría no se
     agrupa: lo que has pedido ver no puede quedar plegado. Ninguna regla de qué cuenta cambia: el
     cajón es el mismo `expenseBucket` que pintaba «Recibo: X» y «ya cuenta en el Plan». */
  const agrupa=!q.trim() && !sel.length;
  const hoy=new Date();
  const hoyK=hoy.getFullYear()*10000+(hoy.getMonth()+1)*100+hoy.getDate();
  const ayer=new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()-1);
  const ayerK=ayer.getFullYear()*10000+(ayer.getMonth()+1)*100+ayer.getDate();
  const dias=[]; let dia=null;
  shown.forEach(function(e){
    const ms=dateMs(e.date), info=gastosDia(ms);
    if(!dia||dia.k!==info.k||dia.ym!==info.ym){ dia={k:info.k, ym:info.ym, ms:ms, rows:[], gris:[]}; dias.push(dia); }
    const bucket=expenseBucket(e, state);
    const l=e.debtId&&filterSelLabel("debt:"+e.debtId,state.debts);
    const recibo=reciboEtiqueta(state,e);
    if(agrupa && (bucket==="recibo"||bucket==="deuda")){
      let g=dia.gris.find(function(x){ return x.kind===bucket; });
      if(!g){ g={kind:bucket, items:[], total:0}; dia.gris.push(g); }
      g.items.push({e:e, ms:ms, sub:bucket==="recibo"?recibo:(l||catName("deudas"))});
      g.total+=Math.abs(e.amount||0);
    } else dia.rows.push({e:e, ms:ms, l:l, bucket:bucket, recibo:recibo});
  });
  const etiquetaDia=function(d){
    if(d.k===hoyK) return t("g_today");
    if(d.k===ayerK) return t("g_yesterday");
    const f=new Date(d.ms), o={weekday:"short",day:"numeric",month:"short"};
    if(f.getFullYear()!==hoy.getFullYear()) o.year="numeric";
    return f.toLocaleDateString(loc(),o).replace(/,/g,"");
  };
  // Lo que cuenta ese día, con la misma regla que la cifra de arriba: sumados, dan la cifra.
  const totalDia=function(k,ym){
    const d=gastosDiaDe(cifra,k,ym);
    if(!d || !(d.sp>0) && !(monthSummary.mode==="net"&&d.inc>0)) return null;
    const v=gastosValor(d,monthSummary.mode);
    return (v<0?"+":"")+eur(Math.abs(v));
  };
  const simple=!!(state.settings&&state.settings.simpleMode);

  return React.createElement("div",{className:"v4-screen gx-root",ref:rootRef,"data-periodo":preset},
    React.createElement(GastosCabecera,{rootRef:rootRef, cab:cab, meses:preset==="months"?cab.meses:null, onMes:irAMes, stopSwipe:stopSwipe, diasRef:diasRef}),
    React.createElement("div",{className:"filters"},
      // Filtros vive PEGADO al buscador (2026-08-05): los dos acotan la misma lista de abajo,
      // así que van en la misma fila — antes el botón quedaba solo, en su propia línea entre el
      // buscador y "Sincronizar", sin pertenecer claramente a ninguno de los dos (feedback: «se
      // queda raro en medio»). Sincronizar es una acción de red (trae datos nuevos), no de
      // filtrado, así que se queda donde estaba, lejos de este grupo.
      React.createElement("div",{style:{display:"flex",gap:8,marginBottom:9}},
        React.createElement("div",Object.assign({className:"searchbar",style:{flex:1,minWidth:0,marginBottom:0}},stopSwipe),
          React.createElement("span",{className:"searchbar-ic"},"🔍"),
          React.createElement("input",{className:"searchbar-in",type:"search",placeholder:t("g_search"),value:q,onChange:e=>setQ(e.target.value)}),
          q && React.createElement("button",{className:"searchbar-x",onClick:()=>setQ(""),title:"×"},"✕")
        ),
        React.createElement("button",{type:"button",className:"v4-chip"+(nFilters?" on":""),onClick:function(){ setFilterOpen(true); },title:t("g_filters"),
          style:{minHeight:0,padding:"0 14px",fontWeight:700,flex:"0 0 auto"}},
          "🎛️"+(nFilters?" "+nFilters:""))
      ),
      // «Mi ciclo»: enseña QUÉ cobro ancla el ciclo (si el detectado no es el bueno, se corrige
      // apuntando la nómina real como ingreso, o usando Rango…).
      preset==="cycle" && React.createElement("div",{className:"v4-cycle-box"+(cycleHelpOpen?"":" compacto"),"data-testid":"gastos-cycle-help"},
        React.createElement("div",{className:"v4-cycle-head"},
          React.createElement("div",{className:"v4-cycle-main"},
            React.createElement("strong",null,cycle?"📅 "+t("g_cycle"):t("g_cycle_none_t")),
            React.createElement("div",null,cycle
              ? tf("g_cycle_from",{d:cycle.start.toLocaleDateString(loc(),{day:'2-digit',month:'2-digit'}), x:"+"+eur0(Math.abs(cycle.inc.amount))+((cycle.inc.merchant&&cycle.inc.merchant!=="Ingreso")?" · "+cycle.inc.merchant:"")})
              : t("g_cycle_fallback"))),
          React.createElement("button",{type:"button",className:"v4-chip",onClick:toggleCycleHelp,
            "aria-expanded":cycleHelpOpen,"aria-controls":cycleHelpOpen?"gastos-cycle-explanation":undefined},
            t(cycleHelpOpen?"g_cycle_help_hide":"g_cycle_help_show"))),
        cycleHelpOpen && React.createElement("div",{id:"gastos-cycle-explanation",className:"v4-cycle-explanation"},
          cycle ? t(cycleEnabled?"g_cycle_budget_hint":"g_cycle_filter_hint") : t("g_cycle_none"))
      ),
      preset==="custom" && React.createElement("div",null,
        React.createElement("div",Object.assign({className:"range"},stopSwipe),
          React.createElement("button",{type:"button",className:"v4-chip"+(calPick==="from"?" on":""),onClick:function(){ setCalPick(calPick==="from"?null:"from"); }},
            range.from?fmtIsoCorto(range.from):t("g_custom")),
          React.createElement("span",null,"→"),
          React.createElement("button",{type:"button",className:"v4-chip"+(calPick==="to"?" on":""),onClick:function(){ setCalPick(calPick==="to"?null:"to"); }},
            range.to?fmtIsoCorto(range.to):t("g_custom"))
        ),
        calPick && React.createElement(McCal,{value:calPick==="from"?range.from:range.to, onPick:function(iso){
          setRange(function(r){ const n=Object.assign({},r); n[calPick]=iso; return n; });
          setCalPick(null);
        }})
      ),
      // Resumen de los filtros activos (categorías/bancos) + botón para quitarlos. El botón que
      // ABRE el sheet ya no vive aquí: se movió junto al buscador (ver arriba).
      nFilters>0 && React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginTop:2}},
        React.createElement("span",{style:{fontSize:12.5,color:"var(--muted)",lineHeight:1.35,flex:"1 1 120px"}}, filterParts.join(" · ")),
        React.createElement("button",{type:"button",className:"v4-chip",onClick:clearFilters,style:{padding:"8px 12px"}}, t("g_filters_clear"))
      )
    ),
    /* SE PUEDE OCULTAR (petición de su pareja, 10/9, y con razón).
       Sus palabras: «esta chulo pero mi pareja lo vio y me dijo que es too much, que le gustaria
       que se pudiera ocultar y habilitarlo si tu quieres».
       El desglose lista TODAS las categorías con gasto del mes, así que en cuanto tienes vida
       normal son ocho o diez filas fijas encima de la lista de gastos. A él le sirve —fue idea
       suya ponerles límite— y a ella le tapa lo que viene a mirar. No es un fallo de la función:
       es que no todo el mundo quiere lo mismo abierto siempre.
       Plegado, deja UNA línea: sigue estando y no molesta. El estado va en `settings` (por
       cuenta, que cada uno tiene la suya), y por defecto ABIERTO: quien ya lo tiene no se
       encuentra con que le han escondido algo sin avisar. Se pliega quien quiera plegarlo.
       v5 (20/10/2026): sale de la tarjeta resumen, que ya no existe, y se queda aquí hasta que
       la sección Categorías (tandas 2 y 3) lo sustituya: es la única puerta para poner un
       límite a una categoría y no se puede perder antes de que exista la nueva. */
    catBreakdown.length>0 && React.createElement("div",{className:"v4-gastos-cats"+(catsOpen?"":" cerrado"),"data-testid":"gastos-cats"},
      React.createElement("button",{type:"button",className:"v4-gastos-cats-h",
        "aria-expanded":catsOpen,"aria-controls":"gastos-cats-body",onClick:toggleCats},
        React.createElement("span",{className:"v4-gastos-cats-t"},
          catsOpen ? t("v4_gastos_cats")
                   : tf(catBreakdown.length===1?"v4_gastos_cats_period_n1":"v4_gastos_cats_period_n",{n:catBreakdown.length,period:monthSummary.periodLabel})),
        React.createElement("span",{className:"v4-gastos-cats-fold"},
          (catsOpen?"▾ ":"▸ ")+t(catsOpen?"v4_gastos_cats_hide":"v4_gastos_cats_show"))),
      React.createElement("div",{id:"gastos-cats-body",className:"v4-gastos-cats-body"+(catsOpen?" abierto":""),"aria-hidden":!catsOpen},
      React.createElement("div",{className:"v4-gastos-cats-inner"},catBreakdown.map(function(row){
        const cat=catOf(row.id);
        const lim=row.limit;
        const pct=lim>0?Math.min(100, row.spent/lim*100):0;
        return React.createElement("button",{key:row.id,type:"button",className:"v4-gastos-cat",
            "data-cat":row.id,onClick:function(){ editCatBudget(row.id); }},
          React.createElement("div",{className:"v4-gastos-cat-row"},
            React.createElement("span",{className:"v4-gastos-cat-name"}, (cat.icon||"")+" "+catName(row.id)),
            React.createElement("span",{className:"v4-gastos-cat-amt num"}, eur0(row.spent))),
          lim>0
            ? React.createElement(React.Fragment,null,
                React.createElement("span",{className:"v4-gastos-cat-hint"}, tf("v4_gastos_cat_limit",{x:eur0(lim)})),
                React.createElement("div",{className:"bar",role:"progressbar","aria-valuemin":0,"aria-valuemax":lim,"aria-valuenow":row.spent},
                  React.createElement("i",{style:{width:pct+"%",background:cat.color||"var(--mint)"}})))
            : null);
      })))
    ),
    React.createElement("div",{className:"action-row"},
      React.createElement("button",{className:"btn btn-ghost",onClick:onSync,disabled:syncing,"aria-describedby":"gastos-refresh-scope"}, syncing?React.createElement(React.Fragment,null,React.createElement("span",{className:"spin"}),t("g_refreshing_expenses")):React.createElement(React.Fragment,null,React.createElement(I.sync,{width:16,height:16}),t("g_refresh_expenses")))
    ),
    React.createElement("p",{className:"hint",id:"gastos-refresh-scope"},t("g_refresh_expenses_hint")),
    React.createElement("div",{className:"sync-note"},
      React.createElement("span",{className:"sync-dot "+(syncStatus.type||"idle")}),
      React.createElement(SyncHora,{msg:syncStatus.msg,lastSync:state.lastSync})
    ),
/* Alta de gasto/ingreso: FAB Apuntar (SPEC §7). */
    (function(){
      // SPEC §4: suscripciones solo si hay novedad (activas, aún no pasadas a Fijos, ni descartadas
      // a mano — petición 2026-08-03: poder quitar una detección que no es una suscripción de
      // verdad, ej. la gasolina, que se repite pero nunca va a tener un importe fijo).
      const dismissed=state.subsDismissed||[];
      const novel=(subs||[]).filter(function(sp){
        if(!sp.active) return false;
        if(dismissed.indexOf(sp.key)!==-1) return false;
        return !(state.fixed||[]).some(function(f){ return catKey(f.name)===sp.key; });
      });
      if(!novel.length) return null;
      return React.createElement("div",{style:{marginTop:14}}, React.createElement(CollapsibleCard,{title:t("sub_title")+" · "+novel.length,sub:tf("sub_sub",{n:novel.length,y:eur0(novel.reduce(function(a,s){return a+(s.active?s.yearly:0);},0))}),dot:"#C9A6F0",defaultOpen:true,storageKey:"g_subs_novel",help:t("h_subs")},
        novel.map(function(sp){ return React.createElement(SubRow,{key:sp.key,sp:sp,state:state,set:set,showToast:showToast}); }),
        React.createElement("div",{className:"hint",style:{marginTop:8}}, t("sub_hint"))
      ));
    })(),
    React.createElement("div",{className:"v4-gastos-list gx-list",style:{marginTop:6}},
      React.createElement("div",{className:"v4-gastos-list-body"},
        shown.length===0
          ? (function(){
              // "No hay gastos aquí · cambia el filtro" asustaba a principio de mes/ciclo, cuando
              // lo normal es no haber gastado nada todavía: no falta nada, no hay que "cambiar
              // el filtro" (feedback 2026-08-01). Solo si hay histórico real en OTRO período y
              // no hay ningún filtro activo (búsqueda/categoría/banco) es "vacío por normal";
              // si además hay un filtro puesto, el mensaje de siempre sigue siendo el correcto.
              // bankSel igual a los de gasto diario cuenta como "sin filtro": es la
              // preselección automática (2026-08-17: todos los marcados, no solo el principal).
              const sinFiltros=!q.trim() && !sel.length && !bucketSel.length && bankSelIsDefault;
              const hayHistorico=(expensesDef||[]).length>0;
              const esVacioNormal=sinFiltros && hayHistorico && preset==="cycle";
              return React.createElement("div",{className:"empty"},
                React.createElement("div",{className:"ttl"}, esVacioNormal?t("g_empty_period_t"):t("g_empty_t")),
                esVacioNormal?t("g_empty_period_d"):t("g_empty_d"));
            })()
          : dias.map(function(d){
              const tot=totalDia(d.k,d.ym);
              return React.createElement("section",{key:d.k+"|"+d.ym,className:"gx-dia","data-gx-day":d.k,"data-gx-ym":d.ym},
                React.createElement("div",{className:"gx-dia-h"},
                  React.createElement("span",{className:"gx-dia-t"},etiquetaDia(d)),
                  tot && React.createElement("span",{className:"gx-dia-tot num","data-testid":"gastos-dia-total"},tot)),
                d.rows.map(function(g){
                  return React.createElement(MovRow,{key:g.e.id||g.ms, e:g.e, ms:g.ms, l:g.l, onOpen:openDetail, l10n:l10nKey,
                    bucket:g.bucket,recibo:g.recibo,dragging:!!(dragExpense&&dragExpense.from===g.e.id),
                    dragOver:!!(dragExpense&&dragExpense.to===g.e.id&&dragExpense.from!==g.e.id),
                    onDragStart:startExpenseDrag,onDragMove:moveExpenseDrag,onDragEnd:endExpenseDrag});
                }),
                d.gris.slice().sort(function(a,b){ return a.kind==="recibo"?-1:b.kind==="recibo"?1:0; }).map(function(g){
                  return React.createElement(GastosGris,{key:d.k+"|"+g.kind, g:g, onOpen:openDetail, onGoPlan:onGoPlan, simple:simple});
                }));
            }),
        visible<filtered.length && React.createElement("div",{className:"sentinel",ref:sentinelRefCb},t("g_loadmore")),
        // El final de la lista dice hasta dónde llega el histórico: sin esto no se sabe si no hay
        // más o si falta por cargar (SPEC §4, «Hasta aquí: 1 de agosto»).
        shown.length>0 && visible>=filtered.length && React.createElement("div",{className:"gx-fin"},
          tf("gv5_end",{d:new Date(dateMs(filtered[filtered.length-1].date)).toLocaleDateString(loc(),{day:"numeric",month:"long",year:"numeric"})}))
      )
    ),
    React.createElement(GastosFilterSheet,{
      open:filterOpen, onClose:function(){ setFilterOpen(false); },
      sel:sel, setSel:setSel, bankSel:bankSel, setBankSel:setBankSel,
      bucketSel:bucketSel, setBucketSel:setBucketSel,
      bankOpts:bankOpts, diarioEnts:diarioEnts, debts:state.debts,
      preset:preset, setPreset:setPreset, presetDef:presetDef
    }),
    React.createElement(ExpenseDetailSheet,{
      exp:detailId?(state.expenses||[]).find(function(e){ return e.id===detailId; }):null,
      editExp:editExp, setEditExp:setEditExp,
      // Cerrar también guarda el último dígito del teclado. Borrar pasa `true` para no resucitar
      // el gasto con un guardado tardío en el mismo lote de React.
      onClose:function(skipSave){
        const ex=(state.expenses||[]).find(function(e){ return e.id===detailId; });
        if(!skipSave && ex && editExp) saveEdit(ex);
        setDetailId(null); setEditExp(null);
      },
      setCat:setCat, setCuota:setCuota, setReceipt:setReceipt, quitarRecibo:quitarRecibo, setCardFlag:setCardFlag, setBank:setBank, delExpense:delExpense, saveEdit:saveEdit, saveNote:saveNote,
      resolveDup:resolveDup, separarGemelo:separarGemelo, recognizeWithdrawal:recognizeWithdrawal, withdrawalStatus:withdrawalStatus,
      showToast:showToast, aiBusy:aiBusy, suggestAi:suggestAi, state:state
    }),
    undoDelete && ReactDOM.createPortal(
      React.createElement("div",{className:"v4-undo-toast",role:"status","data-testid":"expense-undo"},
        React.createElement("span",null,t(undoDelete.paired?"g_auto_deleted":"f_undo_deleted")),
        React.createElement("button",{type:"button",onClick:undoLastDelete},t("f_undo"))),document.body)
  );
}

/* Lo que la fila de meses sobresale por debajo de la caja de la cabecera cuando se encoge (px).
   Tiene que cuadrar con `.gx-head.compact::before` y `.gx-meses` en shell.html. */
const GX_MESES_SOBRE=36;
/* CABECERA DE GASTOS v5 (SPEC §2.1 y §3). Componente propio a propósito: la cifra cambia con el
   día que queda debajo al bajar, y ese cambio NO puede re-renderizar Expenses ni la lista
   (cientos de filas): el día visible es estado SOLO de esta cabecera. Encogerse es `transform` y
   `opacity` sobre una caja de alto fijo: bajar no recoloca nada de la lista. El scroll se lee en
   un `requestAnimationFrame` y el día se busca por bisección entre los encabezados ya pintados,
   así cada frame cuesta unas pocas lecturas aunque haya meses enteros cargados. */
function GastosCabecera({rootRef, cab, meses, onMes, stopSwipe, diasRef}){
  const [vista,setVista]=useState({k:null, ym:null, compact:false});
  const headRef=useRef(null), mesesRef=useRef(null), calcRef=useRef(null);
  useEffect(function(){
    const root=rootRef.current, host=root&&root.closest?root.closest(".page"):null;
    if(!host) return undefined;
    let raf=0;
    const calc=function(){
      raf=0;
      const head=headRef.current; if(!head) return;
      const compact=host.scrollTop>40;
      let els=diasRef.current;
      if(!els) els=diasRef.current=Array.prototype.slice.call(root.querySelectorAll("[data-gx-day]"));
      const raya=head.getBoundingClientRect().bottom+(compact?GX_MESES_SOBRE:0)+1;
      let lo=0, hi=els.length-1, at=-1;
      while(lo<=hi){ const mid=(lo+hi)>>1; if(els[mid].getBoundingClientRect().top<=raya){ at=mid; lo=mid+1; } else hi=mid-1; }
      const k=at>=0?+els[at].getAttribute("data-gx-day"):null, ym=at>=0?els[at].getAttribute("data-gx-ym"):null;
      setVista(function(v){ return v.k===k&&v.ym===ym&&v.compact===compact?v:{k:k, ym:ym, compact:compact}; });
    };
    calcRef.current=function(){ if(!raf) raf=requestAnimationFrame(calc); };
    host.addEventListener("scroll",calcRef.current,{passive:true});
    calc();
    return function(){ host.removeEventListener("scroll",calcRef.current); if(raf) cancelAnimationFrame(raf); };
  },[]);
  // Datos nuevos (un filtro, un gasto que entra): el día de debajo puede ser otro.
  useEffect(function(){ if(calcRef.current) calcRef.current(); },[cab]);
  const line=vista.k==null?cab.top:cab.line(vista.k, vista.ym);
  const ymSel=line.ym||(cab.top&&cab.top.ym);
  /* La pastilla del mes activo se DESLIZA (referencia del dueño, 20/10): una sola capa que se
     mueve con `transform` hasta el mes nuevo; su ancho se fija sin animar. Y la fila se desplaza
     sola para que el mes activo quede a la vista. */
  const [pasti,setPasti]=useState(null);
  useLayoutEffect(function(){
    const box=mesesRef.current; if(!box) return;
    const el=box.querySelector('[data-ym="'+ymSel+'"]'); if(!el) return;
    const x=el.offsetLeft, w=el.offsetWidth;
    setPasti(function(p){ return p&&p.x===x&&p.w===w?p:{x:x,w:w}; });
    if(vista.compact){
      const want=x-(box.clientWidth-w)/2;
      if(Math.abs(box.scrollLeft-want)>2) box.scrollTo({left:Math.max(0,want),behavior:mcReduced()?"auto":"smooth"});
    }
  },[ymSel, vista.compact, meses&&meses.length, l10nKeyOf()]);
  const tone=line.tone?" gx-tone-"+line.tone:"";
  return React.createElement("div",{className:"gx-head"+(vista.compact?" compact":""),ref:headRef},
    React.createElement("h1",{className:"v4-title serif"}, t("v4_gastos_title")),
    React.createElement(GxCifra,{n:line.n}),
    React.createElement("div",{className:"gx-status","data-testid":"gastos-estado"},
      React.createElement("span",null,line.pre),
      line.tail ? React.createElement(React.Fragment,null," · ",React.createElement("span",{className:"gx-tail"+tone},line.tail)) : null),
    // En balance la línea existe siempre (aunque vacía): la caja no cambia de alto al bajar.
    cab.top.sub!=null && React.createElement("div",{className:"gx-status gx-status-sub","data-testid":"gastos-desglose"},line.sub||""),
    meses && React.createElement("div",Object.assign({className:"gx-meses",ref:mesesRef,role:"group","aria-label":t("gv5_meses"),"aria-hidden":!vista.compact,"data-testid":"gastos-meses"},stopSwipe),
      pasti && React.createElement("span",{className:"gx-mes-pasti","aria-hidden":true,style:{width:pasti.w,transform:"translateX("+pasti.x+"px)"}}),
      meses.map(function(m){
        const on=m.ym===ymSel;
        return React.createElement("button",{key:m.ym,type:"button",className:"gx-mes"+(on?" on":""),"data-ym":m.ym,"aria-pressed":on,
          tabIndex:vista.compact?0:-1,onClick:function(){ onMes(m.ym); }}, m.label);
      }))
  );
}
function l10nKeyOf(){ return CURLANG+"|"+DISP.sym; }
/* LA CIFRA RUEDA POR DÍGITO (referencia del dueño, 20/10: «este es el nivel que aspiro de
   fluidez»). Cada dígito es una tira 0–9 que sube o baja con `translateY`: sin layout ni anchos
   que cambien (cifras tabulares, celda de ancho fijo), y si llega otro cambio a mitad, la
   transición sale desde donde está. Se alinea por la DERECHA para que las unidades no salten
   de casilla cuando el número gana una cifra. Con «reducir movimiento» cambia sin rodar. */
const GX_DIGITOS=["0","1","2","3","4","5","6","7","8","9"];
function GxCifra({n}){
  const ok=typeof n==="number"&&isFinite(n);
  if(!ok) return React.createElement("div",{className:"gx-num num"},React.createElement("span",{"data-testid":"gastos-cifra"},"—"));
  const p=eurParts(n), ent=p.ent, dec=","+p.dec;
  const celdas=function(txt, base){
    const out=[];
    for(let i=0;i<txt.length;i++){
      const ch=txt[i], pos=txt.length-i;   // posición desde la derecha: estable al crecer
      const dg=GX_DIGITOS.indexOf(ch);
      out.push(dg<0
        ? React.createElement("span",{key:base+"s"+pos+ch,className:"gx-sep"},ch)
        : React.createElement("span",{key:base+pos,className:"gx-dig"},
            React.createElement("span",{className:"gx-dig-tira",style:{transform:"translateY("+(-dg*10)+"%)"}},
              GX_DIGITOS.map(function(d){ return React.createElement("span",{key:d},d); }))));
    }
    return out;
  };
  // El texto entero va en un nodo oculto a la vista: es el que leen los lectores de pantalla (las
  // tiras de dígitos son `aria-hidden`) y el que comprueban los e2e.
  const txt=ent+dec+" "+p.sym;
  return React.createElement("div",{className:"gx-num num"},
    React.createElement("span",{className:"gx-num-txt","data-testid":"gastos-cifra"},txt),
    React.createElement("span",{className:"gx-num-ent","aria-hidden":true},celdas(ent,"e")),
    React.createElement("span",{className:"gx-num-dec","aria-hidden":true},celdas(dec,"d")," "+p.sym));
}
/* FILA GRIS: los cargos de un día que pagan recibos o cuotas (SPEC §4.4). Se ven, no suman al
   día ni a la cifra (ya cuentan en el Plan, regla de siempre), y se despliegan con un solo toque
   de vibración. Cada cargo sigue abriendo su ficha: ahí viven «No es este recibo» y «no es la
   cuota», que no se pueden quedar sin camino por plegarlos. El estado de abierto es de la fila:
   abrir una no repinta la lista. */
const GX_GRIS={recibo:{lab:"v4_plan_recibos",seg:"recibos"}, deuda:{lab:"v4_plan_deudas",seg:"deudas"}};
function GastosGris({g, onOpen, onGoPlan, simple}){
  const [open,setOpen]=useState(false);
  const def=GX_GRIS[g.kind];
  const toggle=function(){ setOpen(function(o){ return !o; }); mcTickHaptic(); };
  // En modo sencillo Plan solo tiene Recibos: «Abrir en Plan · Deudas» llevaría a otro sitio.
  const conPlan=!!onGoPlan && (!simple || g.kind==="recibo");
  return React.createElement("div",{className:"gx-gris"+(open?" abierto":""),"data-gris":g.kind},
    React.createElement("button",{type:"button",className:"gx-gris-h","aria-expanded":open,onClick:toggle},
      React.createElement("span",{className:"gx-gris-dot gx-gris-dot-"+g.kind,"aria-hidden":true}),
      React.createElement("span",{className:"gx-gris-t"},tf("gv5_no_cuentan",{x:t(def.lab)})),
      React.createElement("span",{className:"gx-gris-amt num"},eur(g.total)),
      React.createElement("span",{className:"gx-gris-n num"},g.items.length)),
    React.createElement("div",{className:"gx-gris-body","aria-hidden":!open},
      React.createElement("div",{className:"gx-gris-inner"},
        g.items.map(function(it){
          const e=it.e, bk=expenseBankOf(e);
          const nombre=e.renamePending&&!e.renamePending.quarantined&&e.renamePending.merchant?e.renamePending.merchant:e.merchant;
          const fecha=new Date(it.ms).toLocaleDateString(loc(),{day:"2-digit",month:"2-digit"});
          return React.createElement("button",{key:e.id,type:"button",className:"gx-gris-it","data-gris-id":e.id,tabIndex:open?0:-1,onClick:function(){ onOpen(e); }},
            React.createElement("span",{className:"gx-gris-it-txt"},
              React.createElement("span",{className:"gx-gris-it-nm"},nombre||"—"),
              React.createElement("span",{className:"gx-gris-it-sub"},[it.sub,fecha,bk?(entOf(bk).label||entOf(bk).mono):null].filter(Boolean).join(" · "))),
            React.createElement("span",{className:"gx-gris-it-amt num"},eur(Math.abs(e.amount||0))));
        }),
        conPlan && React.createElement("button",{type:"button",className:"gx-gris-plan",tabIndex:open?0:-1,onClick:function(){ onGoPlan(def.seg); }},
          tf("gv5_plan_open",{x:t(def.lab)})+" ›")))
  );
}

/* La hora de «Última sincronización» escucha la lectura de la nube por su cuenta (19/10/2026): una lectura sin
   cambios ya no reescribe `state.lastSync` (ver `mcSetLecturaNube`), y pasarla como prop de
   Expenses la reconstruiría entera en cada vuelta a primer plano, que es lo que se quitó. */
function SyncHora({msg, lastSync}){
  const [leida,setLeida]=useState(0);
  useEffect(function(){ return mcOnLecturaNube(setLeida); },[]);
  const at=Math.max(lastSync||0, leida||0);
  return msg || (at?tf("g_lastsync",{d:new Date(at).toLocaleString(loc(),{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}):t("g_nosync"));
}

/* ---------- Fila del histórico ----------
   Va en React.memo a propósito. Antes se pintaba en línea dentro de Expenses, así que CUALQUIER
   cambio de estado (un toast, un sync de la nube, teclear en el buscador, el snapshot diario de
   inversiones…) volvía a construir las cientos de filas que hay en pantalla tras un rato haciendo
   scroll — y a más histórico, peor. Es la otra mitad del «se ralentiza cuanto más la uso»
   (feedback 2026-07-24).

   `l10n` (idioma|símbolo de moneda) es un prop a posta: catName/entOf/eur leen globales que memo
   no puede ver, así que sin él cambiar de idioma o de moneda dejaría las filas en el idioma viejo.
   `onOpen` tiene que ser ESTABLE (useCallback) o el memo no sirve de nada. */
const MovRow=React.memo(function MovRow({e, ms, l, onOpen, bucket, recibo, dragging, dragOver, onDragStart, onDragMove, onDragEnd}){
  // `ms` y no un `Date`: ver el porqué donde se construyen los grupos. El objeto se crea aquí,
  // que es la única línea que lo necesita, y solo cuando la fila se pinta de verdad.
  // `bucket` (string) lo pasa el padre: si se pasara `state` entero, el memo no acertaría nunca.
  const d=new Date(ms);
  const c=catOf(e.category);
  const isIncome=e.amount<0;
  const bk=expenseBankOf(e);
  const pendingName=!!(e.renamePending&&!e.renamePending.quarantined&&e.renamePending.merchant);
  const shownName=pendingName?e.renamePending.merchant:e.merchant;
  const note=expenseNote(e);   // concepto del bizum / descripción del banco (2026-07-24)
  // Un ingreso NO va apagado: entra dinero, no es un gasto que se descarta. Solo se atenúan los
  // dos cajones que no mueven el presupuesto, y cada uno dice el suyo en vez de un «no afecta»
  // genérico que hacía que una inversión y un recibo de Sabadell parecieran lo mismo.
  const skip=bucket==="neutra"||bucket==="otrobanco"||bucket==="posible"||bucket==="deuda"||bucket==="recibo";
  // El recibo dice CUÁL es, y si solo lo parece lo pregunta: «no cuenta» a secas haría dudar.
  const skipTxt=!skip?"":(bucket==="recibo"?recibo:t("g_skip_"+bucket));
  return React.createElement("button",{type:"button","data-expense-id":e.id,"data-expense-day":String(e.date||"").slice(0,10),
      className:"v4-mov"+(skip?" v4-mov-skip":"")+(dragging?" dragging":"")+(dragOver?" drag-over":""),
      onClick:function(ev){ if(ev.target&&ev.target.closest&&ev.target.closest(".v4-mov-drag")) return; onOpen(e); },style:skip?{opacity:.72}:null},
    React.createElement("div",{className:"tile",style:{borderColor:c.color+"55",color:c.color,background:c.color+"18"}},c.icon),
    React.createElement("div",{className:"nm"},
      // Renombrado en vuelo: la lista enseña ya el nombre nuevo, igual que la ficha, sin tocar
      // `merchant` (eso solo cambia con el ack del servidor). En cuarentena vuelve al guardado.
      React.createElement("div",{className:"nm-title"}, shownName||"—",
        pendingName?React.createElement("span",{"data-testid":"mov-rename-pending",role:"img",title:t("g_rename_pending"),"aria-label":t("g_rename_pending"),style:{marginLeft:6,opacity:.7}},"⏳"):null),
      note && React.createElement("div",{className:"nm-note"}, note),
      React.createElement("div",{className:"nm-cat",style:{color:c.color}}, l||catName(e.category)),
      React.createElement("div",{className:"meta"},
        React.createElement("span",null,d.toLocaleDateString(loc(),{day:'2-digit',month:'2-digit'})),
        bk?React.createElement(React.Fragment,null,
          React.createElement("span",{className:"sep"},"·"),
          React.createElement("span",null,entOf(bk).label||entOf(bk).mono)
        ):null,
        skip?React.createElement(React.Fragment,null,
          React.createElement("span",{className:"sep"},"·"),
          React.createElement("span",{style:{color:"var(--muted-2)"}}, skipTxt)
        ):null
      )
    ),
    React.createElement("div",{className:"am num"+(isIncome?" pos":"")+(skip?" muted":"")}, (isIncome?"+":"")+eur(Math.abs(e.amount))),
    React.createElement("span",{className:"v4-mov-drag",role:"img","data-noswipe":"1","aria-label":t("drag_hint"),title:t("drag_hint"),
      onTouchStart:function(ev){ onDragStart(ev,e); },onTouchMove:onDragMove,onTouchEnd:onDragEnd,onTouchCancel:onDragEnd},"⠿")
  );
});

/* Sheet de filtros (2026-08-05): categorías + bancos con buscador, sin la fila infinita de chips.
   Misma mecánica que el resto de hojas (`useSheetSwipe` + atrás). */
/* Nombre de lo que hay en `sel`: una categoría, o `debt:<id>` = el chip de una deuda (4.21.0).
   Una deuda borrada ya no tiene chip; si seguía marcada, se lee como «Cuota de deuda». */
function filterSelLabel(id, debts){
  if(!id.startsWith("debt:")) return catName(id);
  const d=(debts||[]).find(function(x){ return x && ("debt:"+x.id)===id; });
  return d&&d.name||catName("deudas");
}
function GastosFilterSheet({open, onClose, sel, setSel, bankSel, setBankSel, bucketSel, setBucketSel, bankOpts, diarioEnts, debts, preset, setPreset, presetDef}){
  const swipe=useSheetSwipe(!!open, onClose);
  useBackClose(!!open, swipe.close);
  const [qCat,setQCat]=useState("");
  const [filterCatsOpen,setFilterCatsOpen]=useState(false);
  useEffect(function(){
    if(open){ setQCat(""); setFilterCatsOpen(false); }
  },[open]);
  if(!open) return null;
  /* `deudas` sigue siendo la marca interna que evita contar dos veces la cuota, pero no se pinta
     como categoría normal: cada deuda del Plan tiene su filtro propio (feedback 24/9). */
  const debtList=(debts||[]).filter(function(d){ return d && d.id; });
  const allCats=CATEGORIES.concat([INGRESO_CAT,INVERSION_CAT,TRASPASO_CAT]);
  const needle=qCat.trim().toLowerCase();
  const cats=needle
    ? allCats.filter(function(c){ return catName(c.id).toLowerCase().indexOf(needle)!==-1 || c.id.indexOf(needle)!==-1; })
    : allCats;
  const toggleCat=function(id){
    setSel(function(prev){
      const has=prev.indexOf(id)!==-1;
      return has?prev.filter(function(x){ return x!==id; }):prev.concat([id]);
    });
  };
  const toggleBank=function(b){
    setBankSel(function(prev){
      const has=prev.indexOf(b)!==-1;
      return has?prev.filter(function(x){ return x!==b; }):prev.concat([b]);
    });
  };
  const clearAll=function(){
    setSel([]);
    setBucketSel([]);
    // Igual que el chip de «Borrar filtros»: volver a los bancos de gasto diario y al periodo de entrada.
    setBankSel(diarioEnts.slice());
    setPreset(presetDef);
  };
  const toggleBucket=function(b){
    setBucketSel(function(prev){
      const has=prev.indexOf(b)!==-1;
      return has?prev.filter(function(x){ return x!==b; }):prev.concat([b]);
    });
  };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet v4-gastos-filter-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); },style:{maxHeight:"88vh"}}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"serif",style:{fontSize:22,fontWeight:550,marginBottom:6}}, t("g_filters")),
        React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",lineHeight:1.45,marginBottom:12}}, t("g_filters_hint")),
        /* «Qué contar» va PRIMERO y sin buscador: son cuatro y es lo que él vino a separar
           («hay bastante caos entre gastos que cuentan, ingresos y movimientos que no cuentan»).
           Las categorías y los bancos siguen debajo, igual que siempre. */
        /* PERIODO (Gastos v5, 20/10/2026). Los botones Este mes / Mi ciclo / Más… salieron de la
           pantalla: los meses son ahora la fila que aparece al bajar, y Mi ciclo, Rango y Todo
           viven aquí, que es su sitio en el diseño (SPEC §7). Mi ciclo no se puede perder: es la
           forma de mirar el gasto de quien no cobra el día 1 (petición de su pareja, 11/7). */
        React.createElement("div",{style:{fontSize:12,fontWeight:800,color:"var(--muted-2)",letterSpacing:".04em",textTransform:"uppercase",marginBottom:8}}, t("gv5_periodo")),
        React.createElement("div",{className:"gx-periodo",role:"radiogroup","aria-label":t("gv5_periodo")},
          [["months","gv5_p_months"],["cycle","g_cycle"],["custom","gv5_p_range"],["all","g_all"]].map(function(p){
            const on=preset===p[0];
            return React.createElement("button",{key:p[0],type:"button",role:"radio","aria-checked":on,className:"gx-periodo-op"+(on?" on":""),
              "data-periodo":p[0],onClick:function(){ setPreset(p[0]); }}, t(p[1]));
          })),
        React.createElement("div",{style:{fontSize:12,fontWeight:800,color:"var(--muted-2)",letterSpacing:".04em",textTransform:"uppercase",marginBottom:8}}, t("g_bk_title")),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}},
          React.createElement("button",{type:"button",className:"v4-chip"+(bucketSel.length===0?" on":""),onClick:function(){ setBucketSel([]); }}, t("g_bk_all")),
          /* SIN chip «De otros bancos» (rechazo suyo, 2026-08-17): «no hace nada y tampoco se ve
             para qué está dado que ya puedes elegir los bancos abajo». Las dos cosas ciertas.
             Antes no hacía nada porque el filtro arrancaba en UN solo banco diario y «de otros
             bancos» era exactamente lo contrario → cruce vacío. Ahora arranca en TODOS los de
             gasto diario, y aun así el chip sobra: los chips de banco de abajo ya hacen eso.
             El cajón `otrobanco` sigue existiendo: es el que hace que la fila diga «no es del
             día a día». */
          [["cuenta","💸"],["ingreso","💰"],["neutra","📈"]].map(function(p){
            const on=bucketSel.indexOf(p[0])!==-1;
            return React.createElement("button",{key:p[0],type:"button",className:"v4-chip"+(on?" on":""),onClick:function(){ toggleBucket(p[0]); }},
              p[1]+" "+t("g_bk_"+p[0]));
          })
        ),
        /* Las categorías son la lista larga del filtro. Cerradas dejan una sola fila y el número
           activo; así bancos y «Qué contar» siguen a mano sin obligar a atravesar veinte chips. */
        React.createElement("div",{className:"v4-filter-cats"+(filterCatsOpen?" abierto":"")},
          React.createElement("button",{type:"button",className:"v4-filter-cats-toggle","aria-expanded":filterCatsOpen,
              "aria-controls":"gastos-filter-cats-body",onClick:function(){ setFilterCatsOpen(function(v){ return !v; }); }},
            React.createElement("span",null,t("g_filters_cats")),
            React.createElement("span",{className:"v4-filter-cats-state"},
              (sel.length ? tf(sel.length===1?"g_filters_cat_active_one":"g_filters_cat_active",{n:sel.length}) : t("g_filters_cat_none"))+" "+(filterCatsOpen?"▾":"▸"))
          ),
          React.createElement("div",{id:"gastos-filter-cats-body",className:"v4-filter-cats-body","aria-hidden":!filterCatsOpen},
            React.createElement("div",{className:"v4-filter-cats-inner"},
              React.createElement("div",{className:"searchbar",style:{marginBottom:12}},
                React.createElement("span",{className:"searchbar-ic"},"🔍"),
                React.createElement("input",{className:"searchbar-in",type:"search",placeholder:t("g_filters_search"),value:qCat,onChange:function(e){ setQCat(e.target.value); }}),
                qCat && React.createElement("button",{className:"searchbar-x",type:"button",onClick:function(){ setQCat(""); }},"✕")
              ),
              /* El filtro conserva la multiselección, pero comparte la anatomía de Apuntar y
                 Modificar: icono arriba, nombre debajo y selección visible. Los chips antiguos
                 daban la impresión de ser otro sistema de categorías (rechazo 23/9). */
              React.createElement("div",{className:"v4-ficha-cat-title"},
                React.createElement("span",null,t("g_filters_cats")),
                React.createElement("button",{type:"button","aria-pressed":sel.length===0,onClick:function(){ setSel([]); }},
                  t("g_allcats")+(sel.length===0?" ✓":""))),
              React.createElement(ExpenseCategoryGrid,{items:cats,selectedMany:sel,onPick:toggleCat,testPrefix:"gastos-filter-cat"}),
              /* Una ficha por deuda: se crean y desaparecen solas con las deudas del Plan (4.21.0). */
              (function(){
                const ds=needle ? debtList.filter(function(d){ return String(d.name||"").toLowerCase().indexOf(needle)!==-1; }) : debtList;
                if(!ds.length) return null;
                return React.createElement(React.Fragment,null,
                  React.createElement("div",{style:{fontSize:12,fontWeight:800,color:"var(--muted-2)",letterSpacing:".04em",textTransform:"uppercase",marginBottom:8}}, t("g_filters_debts")),
                  React.createElement(ExpenseCategoryGrid,{items:ds.map(function(d){ return {id:"debt:"+d.id,icon:DEUDA_CAT.icon,label:d.name||catName("deudas")}; }),
                    selectedMany:sel,onPick:toggleCat,testPrefix:"filtro-deudas"})
                );
              })()
            )
          )
        ),
        bankOpts.length>0 && React.createElement(React.Fragment,null,
          React.createElement("div",{style:{fontSize:12,fontWeight:800,color:"var(--muted-2)",letterSpacing:".04em",textTransform:"uppercase",marginBottom:8}}, t("g_filters_banks")),
          React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}},
            React.createElement("button",{type:"button",className:"v4-chip"+(bankSel.length===0?" on":""),onClick:function(){ setBankSel([]); }}, t("g_allbanks")),
            bankOpts.map(function(b){
              const on=bankSel.indexOf(b)!==-1;
              const lbl=b==="_manual"?t("g_bank_manual"):entOf(b).label;
              return React.createElement("button",{key:b,type:"button",className:"v4-chip"+(on?" on":""),onClick:function(){ toggleBank(b); }}, lbl);
            })
          )
        ),
        React.createElement("div",{style:{display:"flex",gap:10,marginTop:8}},
          React.createElement("button",{type:"button",className:"btn btn-ghost",style:{flex:1},onClick:clearAll}, t("g_filters_clear")),
          React.createElement("button",{type:"button",className:"btn btn-primary",style:{flex:1.4},onClick:onClose}, t("g_filters_done"))
        )
      )
    ), document.body);
}

// Copia para pegar en el chat; el textarea es la salida de las WebView sin `navigator.clipboard`.
function copiarTexto(txt,showToast){
  const viejo=function(){
    try{
      const ta=document.createElement("textarea"); ta.value=txt; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select(); const ok=document.execCommand("copy"); ta.remove();
      if(showToast) showToast(ok?t("hv_copied"):t("hv_copy_fail"));
    }catch(e){ if(showToast) showToast(t("hv_copy_fail")); }
  };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ if(showToast) showToast(t("hv_copied")); },viejo);
  else viejo();
}
/* Sheet detalle/edición de un movimiento. Layout alineado con Apuntar/Cartera (feedback 2026-07-17). */
// La marca explícita puede seguir puesta aunque el cargo no acredite el pago. Nombrarla
// con un matiz evita contradecir el chip seleccionado, sin convertirla en prueba financiera.
function expensePaymentLabelUI(state,e,kind,relation){
  if(relation&&relation.kind===kind) return relation.name||"—";
  var id=kind==="debt"?e.debtId:e.reciboId;
  if(!id) return t("f_no");
  var rows=(kind==="debt"?state.debts||[]:(state.fixed||[]).concat(state.oneoffs||[])).filter(function(x){return x&&x.id===id;});
  return rows.length===1&&String(rows[0].name||"").trim()?tf("f_link_unconfirmed",{name:rows[0].name}):"—";
}
function ExpenseDetailSheet({exp, editExp, setEditExp, onClose, setCat, setCuota, setReceipt, quitarRecibo, setCardFlag, setBank, delExpense, saveEdit, saveNote, resolveDup, separarGemelo, showToast, aiBusy, suggestAi, state, recognizeWithdrawal, withdrawalStatus}){
  /* UNA SOLA CONDICIÓN para pintarse y para los candados. Iban por separado (`!!exp` en los hooks,
     `!exp || !editExp` para pintar) y en cuanto se separaban el sheet desaparecía dejando el
     `overflow:hidden` y el bloqueo de `touchmove` puestos sobre una pantalla vacía: nada respondía
     hasta darle a atrás (bug 2026-08-17). La causa concreta ya está arreglada en `saveEdit`; esto
     es para que ninguna otra vía que vacíe `editExp` pueda volver a dejar la app muerta. */
  const abierto=!!exp && !!editExp;
  const paymentDay=new Date().toDateString();
  const paymentRelation=useMemo(function(){return abierto?expensePaymentRelationUI(state,exp):null;},
    [abierto,exp,paymentDay,state.fixed,state.debts,state.oneoffs,state.expenses,state.bankTx,state.accounts,state.deleted,state.reciboNo,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner]);
  const swipe=useSheetSwipe(abierto, onClose);
  useBackClose(abierto, swipe.close);
  // Diagnóstico de «Paga un recibo»: canal beta o la APK .debug de pruebas, nunca en la estable.
  const [diagDebug,setDiagDebug]=useState(false);
  useEffect(function(){
    let vivo=true;
    try{
      const plugin=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.AelyHaptics;
      if(plugin&&typeof plugin.info==="function") Promise.resolve(plugin.info()).then(function(r){ if(vivo&&r&&r.debug) setDiagDebug(true); },function(){});
    }catch(e){}
    return function(){ vivo=false; };
  },[]);
  const [calOpen,setCalOpen]=useState(false);
  const [bankOpen,setBankOpen]=useState(false);
  const [allCatsOpen,setAllCatsOpen]=useState(false);
  const [adjustOpen,setAdjustOpen]=useState(null);
  const auto=!!(exp && exp.source && exp.source!=="manual");
  const catList=useMemo(()=>XC.concat(exp&&exp.category==="bizum"?[CAT.bizum]:[],INVERSION_CAT,TRASPASO_CAT),[exp&&exp.category]);
  // ExpenseDetailSheet permanece premontado: esta pasada O(n) ocurre al preparar Gastos, no al
  // tocar una fila. Al abrir solo se garantiza que la categoría actual esté entre ocho chips.
  const fichaCatsBase=useMemo(function(){
    return expenseTopCategoryRanking(state.expenses,catList);
  },[state.expenses,catList]);
  const fichaCats=useMemo(function(){
    return expenseTopCategoryPick(fichaCatsBase,exp&&exp.category,catList);
  },[fichaCatsBase,exp&&exp.category,catList]);
  useEffect(function(){
    if(!abierto){ setCalOpen(false); setBankOpen(false); setAllCatsOpen(false); setAdjustOpen(null); }
  },[abierto,exp&&exp.id]);
  // Modificar no tiene botón Guardar. El pequeño debounce evita una escritura del histórico por
  // cada dígito sin convertir «se guarda al momento» en «se guarda al cerrar».
  useEffect(function(){
    if(!abierto || auto) return undefined;
    const typed=parseFloat(String(editExp.amount||"").replace(',','.'))||0;
    if(Math.abs(typed-Math.abs(exp.amount))<0.005) return undefined;
    const tm=setTimeout(function(){ saveEdit(exp); },350);
    return function(){ clearTimeout(tm); };
  },[abierto,auto,exp&&exp.id,exp&&exp.amount,editExp&&editExp.amount]);
  if(!abierto) return null;
  const isIncome=exp.amount<0 || !!editExp.income;
  const bk=expenseBankOf(exp);
  const dateIso=String(editExp.date||exp.date||"").slice(0,10);
  const closeSave=function(){ saveEdit(exp); };   // blur solo guarda; no cierra (cerrar al cambiar cat saltaba de pantalla — feedback 2026-07-17)
  const doDel=function(){
    askConfirm({ title:tf("v4_exp_del_q",{name:(exp.merchant||"—")+" · "+eur(Math.abs(exp.amount))}), sub:t("v4_exp_del_sub"), ok:t("v4_exp_del"), danger:true })
      .then(function(yes){ if(!yes) return; swipe.close(function(){ delExpense(exp); onClose(true); }); });
  };
  const lockedToast=function(){ showToast(t("f_locked_toast")); };
  const bankOpts=(function(){
    const seen={},out=[];
    (state.accounts||[]).forEach(function(a){ if(a&&a.ent&&!seen[a.ent]){ seen[a.ent]=1; out.push(a.ent); } });
    return out;
  })();
  const traceRaw=String(exp.rawText||exp.notificationText||exp.raw||"").trim()||t("f_trace_missing");
  const traceDate=(function(){
    const d=exp.notifiedAt||exp.createdAt;
    if(!d) return fmtIsoCorto(exp.date);
    const parsed=new Date(d);
    return isNaN(parsed.getTime())?fmtIsoCorto(exp.date):parsed.toLocaleString(loc(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  })();
  const fxHint=(exp.origCur&&exp.origAmount>0) ? (
    NF.format(Math.abs(exp.origAmount))+" "+(CUR_SYM[exp.origCur]||exp.origCur)+" · "+
    tf("f_fx_eq",{x:NF.format(Math.abs(exp.amount))+" €",date:fmtIsoCorto(state.fxDate||exp.date)})
  ) : null;
  const trace=auto && React.createElement("div",{className:"v4-ficha-trace","data-testid":"exp-trace"},
    bk?React.createElement(Mono,{ent:bk,size:34}):React.createElement("div",{className:"mono",style:{width:34,height:34}},"🏦"),
    React.createElement("div",{className:"v4-ficha-trace-copy"},
      React.createElement("div",{className:"v4-ficha-trace-title"},tf("f_from_bank",{bank:bk?entOf(bk).label:t("bp_hist_bank_unknown")})),
      React.createElement("div",{className:"v4-ficha-trace-sub"},tf("f_from_bank_sub",{date:traceDate,raw:traceRaw}))));
  const meta=[
    {id:"bank",testId:"exp-bank",label:bk?entOf(bk).label:t("ap_bank_none"),lead:bk?React.createElement(Mono,{ent:bk,size:18}):React.createElement("span",null,"🏦"),
      on:bankOpen,locked:auto,onClick:function(){ setBankOpen(function(v){ return !v; }); setCalOpen(false); }},
    {id:"cash",testId:"exp-efectivo",label:t("f_meta_cash"),lead:React.createElement("span",null,"💶"),on:bk==="efectivo",
      onClick:function(){ if(auto){ showToast(t(withdrawalConfirmedUI(exp)?"f_withdraw_cash_limit":"f_locked_toast")); return; } setBank(exp,bk==="efectivo"?null:"efectivo"); }},
    {id:"date",testId:"exp-date",label:fmtIsoCorto(dateIso),lead:React.createElement("span",null,"📅"),on:calOpen,
      onClick:function(){ setCalOpen(function(v){ return !v; }); setBankOpen(false); }}
  ];
  const splitPair=gemeloSeparadoDe(state,exp);
  const autoPair=gemeloAutomaticoDe(state,exp);
  const paired=splitPair?React.createElement("div",{className:"hint"},React.createElement("button",{type:"button",className:"btn btn-ghost","data-testid":"exp-auto-rejoin",onClick:function(){separarGemelo(exp,true);onClose(true);}},t("g_auto_rejoin"))):autoPair&&React.createElement("div",{className:"hint","data-testid":"exp-auto-paired"},
    React.createElement("div",null,t("g_auto_paired")),
    React.createElement("button",{type:"button",className:"btn btn-ghost","data-testid":"exp-auto-separate",onClick:function(){ separarGemelo(exp); onClose(true); }},t("g_auto_separate")));
  const duplicate=exp.possibleDup && !exp.autoGemelo && React.createElement("div",{className:"hint",style:{margin:"0 0 12px",padding:"10px 12px",borderRadius:12,background:"var(--surface-2)"}},
    React.createElement("div",{style:{fontWeight:600,marginBottom:4}},t("g_dup_title")),
    React.createElement("div",{style:{marginBottom:10}},t("g_dup_sub")),
    React.createElement("div",{className:"row",style:{gap:8}},
      React.createElement("button",{type:"button",className:"btn btn-primary",style:{flex:1},onClick:function(){ resolveDup&&resolveDup(exp,true); onClose(true); }},t("g_dup_same")),
      React.createElement("button",{type:"button",className:"btn btn-ghost",style:{flex:1},onClick:function(){ resolveDup&&resolveDup(exp,false); onClose(true); }},t("g_dup_diff"))));
  const reciboDe=cargoDeRecibo(exp,state), reciboMarca=reciboDe?reciboDe.name||t("bp_hist_recibo"):"";
  // Marcado pero sin acreditar: hasta INC-1810-04 la única salida era quitar la marca.
  const reciboConfirmable=reciboDe&&reciboConfirmableUI(state,exp,paymentRelation);
  const reciboSi=reciboConfirmable&&React.createElement("button",{type:"button",className:"v4-chip","data-testid":"exp-recibo-si",onClick:function(){ setReceipt(exp,reciboConfirmable.id); }},t("f_recibo_si"));
  // A la vista al abrir la ficha, sin desplegar nada: un parecido dudoso se corrige de un toque.
  const reciboAviso=reciboDe&&React.createElement("div",{className:"hint","data-testid":"exp-recibo-marca",style:{margin:"0 0 12px",padding:"10px 12px",borderRadius:12,background:"var(--surface-2)"}},
    React.createElement("div",{style:{marginBottom:8}},tf(paymentRelation&&paymentRelation.kind==="fixed"&&paymentRelation.id===reciboDe.id?"f_recibo_marca":"f_recibo_quiza",{name:reciboMarca})),
    React.createElement("div",{className:"v4-chips wrap"},reciboSi,
      React.createElement("button",{type:"button",className:"v4-chip","data-testid":"exp-recibo-no",onClick:function(){ quitarRecibo(exp); }},t("f_recibo_no"))));
  const afterMeta=React.createElement(React.Fragment,null,
    calOpen && React.createElement(McCal,{value:dateIso,onPick:function(iso){ setCalOpen(false); saveEdit(exp,{date:iso}); }}),
    bankOpen && !auto && bankOpts.length>0 && React.createElement("div",{className:"v4-chips wrap","data-testid":"exp-bank-list"},
      React.createElement("button",{type:"button",className:"v4-chip"+(!bk?" on":""),onClick:function(){ setBank(exp,null); setBankOpen(false); }},t("ap_bank_none")),
      bankOpts.map(function(b){ return React.createElement("button",{key:b,type:"button",className:"v4-chip"+(bk===b?" on":""),
        onClick:function(){ setBank(exp,b); setBankOpen(false); }},"🏦 "+entOf(b).label); })),
    exp.renamePending&&React.createElement("div",{className:"hint",role:"status","data-testid":"expense-rename-pending"},t(exp.renamePending.quarantined?"g_rename_paused":"g_rename_pending")," ",React.createElement("button",{type:"button",className:"btn btn-ghost",onClick:function(){saveEdit(exp,{merchant:exp.renamePending.merchant,retryRename:true});}},t("g_note_retry"))),
    trace,duplicate,paired,reciboAviso,
    canRecognizeWithdrawal(exp) && React.createElement("div",{className:"hint","data-testid":"exp-withdrawal-info"},
      React.createElement("div",null,t("f_withdraw_fields")),
      exp.category!=="traspaso" && React.createElement("button",{type:"button",className:"btn btn-ghost","data-testid":"exp-withdrawal",
        disabled:!canRecognizeWithdrawal(exp,state)||withdrawalStatus && withdrawalStatus.id===exp.id && withdrawalStatus.status==="pending",
        onClick:function(){ recognizeWithdrawal(exp); }},t("f_withdraw_action")),
      exp.category==="traspaso" && React.createElement("div",{"data-testid":"exp-withdrawal-neutral"},t("f_withdraw_done")),
      (withdrawalReceiptLink(state,exp)||reciboDe)&&React.createElement("div",{"data-testid":"exp-withdrawal-receipt-blocked"},t("f_withdraw_receipt_blocked")),
      withdrawalStatus && withdrawalStatus.id===exp.id && withdrawalStatus.status==="done" && withdrawalStatus.receiptUndone && React.createElement("div",{role:"status"},t("f_withdraw_receipt_undone")),
      withdrawalConfirmedUI(exp)&&React.createElement("div",null,t("f_withdraw_cash_limit")),
      withdrawalStatus && withdrawalStatus.id===exp.id && withdrawalStatus.status!=="done" && React.createElement("div",{role:"status"},
        t(withdrawalStatus.status==="pending"?"f_withdraw_pending":"f_withdraw_error"))));
  const debtOptions=(state.debts||[]).filter(function(d){ return d&&d.id; });
  const receiptDate=String(exp.date||"").slice(0,10),receiptYear=Number(receiptDate.slice(0,4)),receiptMonth=Number(receiptDate.slice(5,7)),receiptNow=new Date();
  const receiptToday=receiptYear===receiptNow.getFullYear()&&receiptMonth===receiptNow.getMonth()+1?receiptNow.getDate():new Date(receiptYear,receiptMonth,0).getDate();
  const receiptLinked=withdrawalReceiptLink(state,exp);
  // El recibo o puntual que se vetó para ESTE cargo: ofrecerlo es la vuelta atrás de aquel «No es
  // este recibo».
  const vetadoAqui=function(r){ return r.id&&admiteMarcaDe(exp,r)&&reciboNoDe(state,r.id,reciboNoIdentidad(exp),exp.id).length>0; };
  /* Un recibo FIJO vetado para este cargo se ofrece aunque no sea «elegible» (13/10/2026): con
     dos cargos iguales el motor no admite vínculo a mano con ninguno, la opción no salía y el
     veto de uno de ellos no tenía vuelta atrás desde la ficha. */
  const receiptOptions=(state.fixed||[]).filter(function(f){
    // Bloquea solo una prueba real: un `paidYm` sin cargo detrás no puede esconder el cargo que lo paga (INC-1810-04).
    return vetadoAqui(f)||fixedExpenseEligible(state,exp,f,receiptYear,receiptMonth,receiptToday)&&
      (!fixedPaymentEvidence(fixedPaymentState(state,f,receiptYear,receiptMonth,receiptToday))||(receiptLinked&&receiptLinked.id===f.id));
  });
  // Los puntuales no se vinculan a mano; solo se ofrece el que se vetó para ESTE cargo (cuarta revisión).
  const receiptPuntuales=(state.oneoffs||[]).filter(vetadoAqui);
  const adjustments=React.createElement("div",{className:"v4-ficha-adjust"},
    // Con marca de recibo la fila sale siempre: si no, «No es este recibo» quedaba inalcanzable
    // cuando la marca venía de un puntual o la categoría era neutra.
    !isIncome&&!exp.possibleDup&&(exp.reciboId||reciboDe||receiptPuntuales.length>0||(!CAT_NEUTRAS[exp.category]&&(state.fixed||[]).length>0))&&React.createElement(React.Fragment,null,
      React.createElement("button",{type:"button",className:"v4-ficha-adjust-row","data-testid":"exp-receipt",onClick:function(){ setAdjustOpen(adjustOpen==="receipt"?null:"receipt"); }},
        React.createElement("span",null,t("f_receipt_row")),React.createElement("span",{className:"value","data-testid":"exp-receipt-value"},expensePaymentLabelUI(state,exp,"fixed",paymentRelation)),React.createElement("span",{className:"chev"},"›")),
      adjustOpen==="receipt"&&React.createElement("div",{className:"v4-ficha-adjust-open","data-testid":"exp-receipt-options"},
        React.createElement("div",{className:"hint"},t("f_receipt_hint")),
        React.createElement("div",{className:"v4-chips wrap"},
          // Un cargo marcado ya es de un recibo aunque no tenga vínculo a mano: primero se deshace
          // (es lo que pide el aviso de la retirada), y solo entonces se ofrece confirmar otro.
          reciboConfirmable&&React.createElement("button",{type:"button",className:"v4-chip","data-testid":"exp-receipt-"+reciboConfirmable.id,
            onClick:function(){ setReceipt(exp,reciboConfirmable.id); }},reciboConfirmable.name+" · "+eur(occAmountIn(reciboConfirmable,receiptMonth))),
          (receiptLinked||reciboDe)&&React.createElement("button",{type:"button",className:"v4-chip","data-testid":"exp-receipt-unlink",onClick:function(){ setReceipt(exp,null); }},t("f_receipt_unlink")),
          !receiptLinked&&!reciboDe&&receiptOptions.map(function(f){ return React.createElement("button",{key:f.id,type:"button",className:"v4-chip","data-testid":"exp-receipt-"+f.id,
            onClick:function(){ setReceipt(exp,f.id); }},f.name+" · "+eur(occAmountIn(f,receiptMonth))); }),
          !receiptLinked&&!reciboDe&&receiptPuntuales.map(function(o){ return React.createElement("button",{key:o.id,type:"button",className:"v4-chip","data-testid":"exp-receipt-"+o.id,
            onClick:function(){ setReceipt(exp,o.id); }},o.name+" · "+eur(o.amount)); })),
        !paymentRelation&&!receiptLinked&&!reciboDe&&!receiptOptions.length&&!receiptPuntuales.length&&React.createElement("div",{className:"hint"},t("f_receipt_none")),
        (mcChannel()==="beta"||diagDebug)&&React.createElement("button",{type:"button",className:"btn btn-ghost","data-testid":"exp-receipt-diag",style:{fontSize:12,padding:"4px 10px",marginTop:8},
          onClick:function(){ copiarTexto(reciboDiagText(state,exp),showToast); }},t("f_receipt_diag")))),
    React.createElement("button",{type:"button",className:"v4-ficha-adjust-row",onClick:function(){ setAdjustOpen(adjustOpen==="note"?null:"note"); }},
      React.createElement("span",null,t("f_note_row")),React.createElement("span",{className:"value"},editExp.note||t("f_note_none")),React.createElement("span",{className:"chev"},"›")),
    adjustOpen==="note" && React.createElement("div",{className:"v4-ficha-adjust-open"},
      React.createElement("input",{className:"v4-exp-note-in",value:editExp.note||"",maxLength:160,placeholder:t("v4_exp_note_ph"),
        onChange:function(e){ const v=e.target.value; setEditExp(function(p){ return Object.assign({},p,{note:v}); }); },
        onBlur:function(){ saveNote(exp,editExp.note); },"aria-label":t("v4_exp_note")})),
    exp.notePending&&React.createElement("div",{className:"hint",role:"status","data-testid":"expense-note-pending"},
      t("g_note_unconfirmed")," ",React.createElement("button",{type:"button",className:"btn btn-ghost",onClick:function(){saveNote(exp,exp.note);}},t("g_note_retry"))),
    !isIncome && (exp.debtId||debtOptions.length>0) && React.createElement(React.Fragment,null,
      React.createElement("button",{type:"button",className:"v4-ficha-adjust-row",onClick:function(){ setAdjustOpen(adjustOpen==="debt"?null:"debt"); }},
        React.createElement("span",null,t("f_debt_row")),React.createElement("span",{className:"value"},expensePaymentLabelUI(state,exp,"debt",paymentRelation)),React.createElement("span",{className:"chev"},"›")),
      adjustOpen==="debt" && React.createElement("div",{className:"v4-chips wrap v4-ficha-adjust-open","data-testid":"exp-cuota-de"},
        debtOptions.map(function(d){ const on=exp.category==="deudas"&&exp.debtId===d.id; return React.createElement("button",{key:d.id,type:"button",className:"v4-chip"+(on?" on":""),
          onClick:function(){ if(!on) setCuota(exp,d.id); }},DEUDA_CAT.icon+" "+(String(d.name||"").trim()||catName("deudas"))); }))),
    React.createElement("button",{type:"button",className:"v4-ficha-adjust-row",onClick:function(){
      if(auto){ lockedToast(); return; }
      const income=!editExp.income; setEditExp(function(p){ return Object.assign({},p,{income:income}); }); saveEdit(exp,{income:income});
    }},React.createElement("span",null,t("f_income_row")),React.createElement("span",{className:"value"},editExp.income?"✓":t("f_no")),React.createElement("span",{className:"chev"},"›")),
    !isIncome && React.createElement("button",{type:"button",className:"v4-ficha-adjust-row","data-testid":"exp-payment",onClick:function(){ setCardFlag(exp,!exp.noCard); }},
      React.createElement("span",null,t(exp.noCard?"g_nocard":"g_card")),React.createElement("span",{className:"chev"},"›")),
    cloud.enabled() && !isIncome && React.createElement("button",{type:"button",className:"v4-ficha-adjust-row",disabled:aiBusy,onClick:function(){ suggestAi(exp); }},
      React.createElement("span",null,aiBusy?t("ai_cat_busy"):t("ai_cat_btn")),React.createElement("span",{className:"chev"},"›"))
  );
  const amountChange=auto?function(){ lockedToast(); }:function(updater){
    setEditExp(function(p){ const v=typeof updater==="function"?updater(p.amount):updater; return Object.assign({},p,{amount:v}); });
  };
  const done=function(){
    saveEdit(exp);
    // «Listo» confirma y acompaña el cierre; antes solo se guardaba en segundo plano y la ficha
    // seguía bloqueando toda la pantalla, aunque el dato sí hubiera cambiado (feedback 18/9).
    swipe.close(function(){ onClose(true); });
  };
  const footer=React.createElement("div",{className:"v4-ficha-foot"},
    React.createElement("button",{type:"button",className:"v4-ficha-del",onClick:doDel},"🗑 "+t("f_del")),
    React.createElement("span",{className:"v4-ficha-saved"},t(withdrawalStatus && withdrawalStatus.id===exp.id && withdrawalStatus.status!=="done"
      ? (withdrawalStatus.status==="pending"?"f_withdraw_pending":"f_withdraw_unconfirmed") : "f_autosaved")),
    React.createElement("button",{type:"button",className:"v4-ficha-done",onClick:done},t("done")));
  const main=ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet v4-exp-sheet",style:{maxHeight:"90dvh"},ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement(ExpenseFichaLayout,{kind:editExp.income?"ingreso":"gasto",onKind:function(k){
            if(auto){ lockedToast(); return; }
            const income=k==="ingreso"; setEditExp(function(p){ return Object.assign({},p,{income:income}); }); saveEdit(exp,{income:income});
          },dateLabel:fmtIsoCorto(dateIso),onDate:function(){ setCalOpen(function(v){ return !v; }); setBankOpen(false); },
          amount:String(editExp.amount||"0"),amountEmpty:!editExp.amount,currency:"€",locked:auto,onLocked:lockedToast,focused:!auto,
          concept:editExp.merchant,onConcept:function(v){ setEditExp(function(p){ return Object.assign({},p,{merchant:v}); }); },onConceptBlur:closeSave,fxHint:fxHint,
          meta:meta,afterMeta:afterMeta,categoryItems:fichaCats,allCategoryItems:catList,category:exp.category,
          onCategory:function(id){ setCat(exp,id); },onAllCategories:function(){ setAllCatsOpen(true); },adjustments:adjustments,
          numpad:React.createElement(NumPad,{value:editExp.amount,onChange:amountChange}),footer:footer,testPrefix:"exp"})
      )
    ),document.body);
  return React.createElement(React.Fragment,null,main,
    React.createElement(ExpenseCategorySheet,{open:allCatsOpen,onClose:function(){ setAllCatsOpen(false); },items:catList,selected:exp.category,onPick:function(id){ setCat(exp,id); }}));
}

function BudgetSheet({open, budget, onClose, onSave}){
  const [b,setB]=useState(budget||700);
  useEffect(function(){ if(open) setB(Math.max(100, Math.round(budget||700))); },[open,budget]);
  const swipe=useSheetSwipe(!!open, onClose,{closeMs:320,snapMs:300,
    closeEase:"cubic-bezier(.22,1,.36,1)",snapEase:"cubic-bezier(.22,1,.36,1)"});
  useBackClose(!!open, swipe.close);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet v4-budget-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"serif",style:{fontSize:22,fontWeight:550,marginBottom:8}}, t("v4_budget_sheet")),
        React.createElement("p",{style:{color:"var(--muted)",fontSize:13.5,lineHeight:1.45,margin:"0 0 18px"}}, t("v4_budget_sheet_h")),
        React.createElement("div",{className:"v4-ob-stepper"},
          React.createElement("button",{type:"button","aria-label":"−",onClick:function(){ setB(function(x){ return Math.max(100,x-50); }); }},"−"),
          React.createElement("div",{className:"serif num"}, eur0(b)),
          React.createElement("button",{type:"button","aria-label":"+",onClick:function(){ setB(function(x){ return x+50; }); }},"+")
        ),
        React.createElement("button",{className:"v4-cta",style:{marginTop:18},onClick:function(){ onSave(b); swipe.close(); }}, t("save"))
      )
    ), document.body);
}
