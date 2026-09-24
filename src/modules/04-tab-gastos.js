/* ============================================================
   TAB: GASTOS
   ============================================================ */
const DATE_PRESETS=[
  {id:"month",label:"Este mes"},{id:"cycle",label:"Mi ciclo"},{id:"last",label:"Mes pasado"},
  {id:"3m",label:"Últimos 3 meses"},{id:"all",label:"Todo"},{id:"custom",label:"Rango…"},
];
// «Mi ciclo» (petición pareja 2026-07-11): su nómina no cae en día fijo (23, 24…), así que el mes
// natural le descuadra el ahorro. El ciclo se ancla al ÚLTIMO COBRO REAL apuntado: el ingreso
// más reciente ≥200 € de los últimos 45 días (los bizums pequeños no cuentan). Sin cobro → mes.
function lastPaydayOf(expenses){
  const cut=Date.now()-45*86400000;
  const cands=(expenses||[]).filter(function(e){ return e.amount<=-200 && dateMs(e.date)>=cut; })
    .sort(function(a,b){ return dateMs(b.date)-dateMs(a.date); });
  if(!cands[0]) return null;
  const d=parseDate(cands[0].date);
  return { start:new Date(d.getFullYear(),d.getMonth(),d.getDate()), inc:cands[0] };   // desde las 00:00 del día del cobro
}
/* Límites del período EN MILISEGUNDOS, calculados UNA vez. Antes `inPreset` se llamaba por gasto y
   se construía dentro tres o cuatro `new Date()` (startOfMonth, el mes pasado…): con un histórico
   de miles de movimientos eran decenas de miles de objetos Date por render, y era buena parte del
   lag que crecía con el uso (feedback 2026-07-24). Devuelve {from,to} con Infinity de comodín. */
function presetBoundsMs(preset,range,cycleStart){
  const now=new Date();
  if(preset==="month") return {from:startOfMonth().getTime(), to:Infinity};
  if(preset==="cycle") return {from:(cycleStart||startOfMonth()).getTime(), to:Infinity};
  if(preset==="last") return {from:startOfMonth(new Date(now.getFullYear(),now.getMonth()-1,1)).getTime(), to:startOfMonth().getTime()-1};
  if(preset==="3m") return {from:new Date(now.getFullYear(),now.getMonth()-2,1).getTime(), to:Infinity};
  if(preset==="custom"){
    let from=-Infinity, to=Infinity;
    if(range&&range.from){ const f=new Date(range.from); if(!isNaN(f.getTime())) from=f.getTime(); }
    if(range&&range.to){ const tt=new Date(range.to); if(!isNaN(tt.getTime())){ tt.setHours(23,59,59,999); to=tt.getTime(); } }
    return {from:from, to:to};
  }
  return {from:-Infinity, to:Infinity};   // "all" y cualquier preset desconocido
}
function inBounds(ms,b){ return ms>=b.from && ms<=b.to; }
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
  return React.createElement("div",{className:"sub-row"},
    React.createElement("div",{className:"sub-ic",style:{borderColor:c.color+"55",color:c.color}}, c.icon),
    React.createElement("div",{className:"sub-mid"},
      React.createElement("div",{className:"sub-name"}, sp.name),
      React.createElement("div",{className:"sub-meta"}, tf("sub_months",{n:sp.months})+" · "+tf("sub_peryear",{y:eur0(sp.yearly)})),
      React.createElement("div",{style:{display:"flex",gap:6,marginTop:5,alignItems:"center"}},
        React.createElement("button",{className:"chip",style:{fontSize:11.5,padding:"3px 10px"},onClick:toFixed}, "→ "+t("sub_tofixed")),
        React.createElement("button",{className:"chip",style:{fontSize:11.5,padding:"3px 10px"},onClick:dismiss,title:t("sub_dismiss")}, "✕ "+t("sub_dismiss"))
      )
    ),
    React.createElement("div",{className:"sub-amt num",style:{display:"flex",alignItems:"baseline",gap:2}},
      React.createElement("input",{type:"text",inputMode:"decimal",value:amt,onChange:function(e){ setAmt(e.target.value); },
        style:{width:52,textAlign:"right",background:"transparent",border:"none",borderBottom:"1px dashed var(--bd)",color:"inherit",font:"inherit"}}),
      " €"+t("sub_permonth")
    )
  );
}
function Expenses({state, set, onSync, syncing, syncStatus, showToast, stopSwipe, cancelSwipe, focusExp, clearFocus, forceAllTs}){
  /* «Ver todo» desde una ficha puede llegar antes de que Gastos termine de montar. Conservamos
     ese destino solo durante la navegación: el estado inicial lo consume y el evento cubre el
     caso en que la pestaña ya estaba viva. No se guarda en preferencias. */
  const bankPending=typeof window!=="undefined"&&window.__mcExpBank||"";
  const [preset,setPreset]=useState(bankPending?"all":"month");
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
  const [morePeriods,setMorePeriods]=useState(false);
  const [filterOpen,setFilterOpen]=useState(false);
  const [visible,setVisible]=useState(CONFIG.PAGE_SIZE);
  const [dragExpense,setDragExpense]=useState(null);
  const dragExpenseRef=useRef(null);
  const suppressOpenRef=useRef(0);
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({merchant:"",amount:"",category:"super",income:false,noCard:false,date:""});
  const [catEdit,setCatEdit]=useState(null);   // id del gasto al que estás cambiando la categoría
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
    const key=keyOfE(e), list=state.expenses||[], index=list.findIndex(function(x){ return x.id===e.id; });
    const wasCloud=cloud.enabled();
    // La lápida entra junto con la retirada local: si la nube refresca durante los cinco segundos,
    // no puede resucitar la fila por detrás del toast. La escritura remota sí se encadena para que
    // Deshacer vuelva a subir el MISMO id después de que termine cualquier delete aún en vuelo.
    set(function(s){ return Object.assign({},s,{
      expenses:(s.expenses||[]).filter(function(x){ return x.id!==e.id; }),
      deleted:pushDeleted(s.deleted,key)
    }); });
    const pending={expense:e,key:key,index:index<0?list.length:index,wasCloud:wasCloud,
      cloudDelete:wasCloud?borrarGastoNube(e,"gastos-borrar"):Promise.resolve()};
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
      const deleted=(s.deleted||[]).slice();
      const di=deleted.lastIndexOf(pending.key); if(di>=0) deleted.splice(di,1);
      const expenses=(s.expenses||[]).slice();
      if(!expenses.some(function(x){ return x.id===pending.expense.id; })){
        expenses.splice(Math.min(pending.index,expenses.length),0,pending.expense);
      }
      return Object.assign({},s,{expenses:expenses,deleted:deleted});
    });
    if(pending.wasCloud){
      Promise.resolve(pending.cloudDelete).then(function(){ return subirGasto(pending.expense,"gastos-deshacer"); });
    }
  };
  /* Posible repetido OB↔noti (2026-09-07): «es el mismo» borra la fila OB; «son distintos»
     quita la marca y la fila ya cuenta. La lápida solo al borrar (mismo camino que delExpense). */
  const resolveDup=function(e, same){
    if(!e || !e.possibleDup) return;
    set(function(s){
      let next=resolvePossibleDup(s, e.id, same);
      if(same){
        next=Object.assign({},next,{deleted:pushDeleted(next.deleted, keyOfE(e))});
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
  // Recategorizar un gasto a mano: actualiza ESTE, recuerda el comercio (catOverrides) para los
  // futuros y arregla otros gastos del mismo comercio que estuvieran en "Otros".
  const setCat=function(ex,newCat){
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
        cloud.setExpenseCat(ex,newCat).catch(function(){});
        if(twinId){ const tw=s.expenses.find(function(e){ return e.id===twinId; }); if(tw) cloud.setExpenseCat(tw,newCat).catch(function(){}); }
      }
      const fuera={expenses:exps,catOverrides:ov};
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
    setCatEdit(null);
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
  const saveNote=function(ex, note){
    const raw=String(note||"").trim().slice(0,160);
    if(raw===String(ex.note||"").trim()) return;   // sin cambios: ni set ni viaje a la nube
    set(function(s){ return Object.assign({},s,{expenses:s.expenses.map(function(e){
      return e.id===ex.id ? Object.assign({},e,{note:raw||undefined, noteEdited:true}) : e;
    })}); });
    if(cloud.enabled()) cloud.setExpenseNote(ex,raw).catch(function(){});
  };
  // EDITAR un gasto (comercio / importe / gasto↔ingreso): para corregir lo que la ingesta parsea
  // mal (financiación Cofidis que notifica el TOTAL pero TR solo cobra la cuota, bizums antiguos
  // que entraron como gasto…). En la nube la clave es fecha|importe|comercio → se hace tombstone
  // de la fila vieja (deleted + deleteExpense) y se inserta la corregida, o el pull la resucitaría.
  const [editExp,setEditExp]=useState(null);   // {id, merchant, amount, income} — usado por el sheet de detalle
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
    if(signed===orig.amount && merch===(orig.merchant||"") && newDay===origDay){ sincroniza(orig); return; }   // sin cambios
    const cat = ed.income ? "ingreso" : (orig.category==="ingreso" ? autoCategory(merch) : orig.category);
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
    set(function(s){ return Object.assign({},s,{
      expenses:s.expenses.map(function(x){ return x.id===orig.id?upd:x; }),
      deleted:pushDeleted(s.deleted, keyOfE(orig))
    }); });
    if(cloud.enabled()){ borrarGastoNube(orig, "gastos-editar"); subirGasto(upd, "gastos-editar"); }
    sincroniza(upd); showToast(t("g_edited"));
  };

  const cycle=useMemo(()=>lastPaydayOf(expensesDef),[expensesDef]);
  // Bancos presentes en el período (o configurados como gasto) → chips de filtro.
  // "_manual" = apuntados a mano / sin banco conocido (no mezclar con OB).
  // Chips de banco: baratos y SIEMPRE visibles (no dependen de heavyOk → sin flash).
  // `todayKey` en las dependencias a propósito: los límites de «Este mes» / «Últimos 3 meses» se
  // calculan con la fecha de HOY, y la app se queda abierta días en el móvil. Sin esto, cruzar la
  // medianoche (o el cambio de mes) dejaría el filtro anclado al día en que se abrió y «Este mes»
  // enseñaría el mes pasado. Antes no pasaba porque el cálculo se rehacía en cada render.
  const todayKey=new Date().toDateString();
  const bounds=useMemo(function(){ return presetBoundsMs(preset,range,cycle&&cycle.start); },[preset,range,cycle,todayKey]);
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
  },[expensesDef,bounds,sel,bankSel,bucketSel,q,state.settings,state.accounts]);

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

  // La cabecera es siempre el mes natural: los filtros sirven para explorar, pero no deben hacer
  // que el presupuesto parezca cambiar al mirar otro período o una categoría.
  // Cifras = `monthBudgetStats` (misma fuente que Resumen y el widget).
  // `accounts` + `settings` van en deps: monthBudgetStats → expenseCountsBudget → expenseBankEnts
  // lee rol diario y expenseBanks. Sin ellos, quitar un banco de gasto diario dejaba la cabecera
  // alta hasta que un sync cambiaba `expenses` (B09-A / feedback familia 2026-09-06).
  const monthSummary=useMemo(function(){
    const now=new Date();
    const bs=monthBudgetStats(state);
    return {
      spent:bs.spent, income:bs.income, balance:bs.balance, mode:bs.mode,
      budget:bs.budget, reserved:bs.reserved, remaining:bs.remaining,
      day:now.getDate(),
      last:new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),
      month:monthLong(now.getMonth())
    };
  },[state.expenses,state.budget,state.reservaLog,state.accounts,state.settings]);
  // Desglose por categoría: misma regla/ventana que la cabecera. categoryBudgets en deps
  // porque una fila a 0 con límite tiene que aparecer aunque no haya gastos nuevos.
  const catBreakdown=useMemo(function(){
    return categorySpentByMonth(state);
  },[state.expenses,state.categoryBudgets,state.accounts,state.settings]);
  /* Abierto o plegado, por cuenta. `!==false` y no `!!`: quien nunca lo ha tocado lo ve ABIERTO
     —es como está hoy y como él lo aprobó—, y solo se pliega quien lo pliegue a mano. */
  const catsOpen=!(state.settings && state.settings.gastosCatsOff);
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
    setEditExp({id:e.id, merchant:e.merchant||"", amount:String(Math.abs(e.amount)).replace('.',','), income:e.amount<0, note:e.note||"", date:String(e.date||"").slice(0,10)});
    setCatEdit(null);
  },[]);
  // Invalida las filas memoizadas cuando cambia el idioma o la moneda de visualización (las leen
  // de globales que React.memo no ve).
  const l10nKey=CURLANG+"|"+DISP.sym;

  // Resumen de filtros activos, para el botón "Filtros" (badge) y la línea de chips debajo.
  // Se calcula aquí (no memoizado: sel/bankSel son arrays cortos) porque lo usan dos sitios:
  // el botón junto al buscador y la línea de resumen + "Borrar filtros".
  // La preselección automática no cuenta como filtro puesto; «Todos» sí amplía la vista a mano.
  const bankSelIsDefault=sameEntList(bankSel, diarioEnts);
  const nCatSel=sel.length;
  const nBankSel=bankSelIsDefault?0:Math.max(1,bankSel.length);
  const nFilters=nCatSel+nBankSel+bucketSel.length;
  const filterParts=[];
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
  const groups=[]; let last=null;
  shown.forEach(function(e){
    const ms=dateMs(e.date), d=new Date(ms), k=dayKey(d);
    if(k!==last){
      const today=dayKey(new Date()), yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
      const label=k===today?t("g_today"):k===dayKey(yesterday)?t("g_yesterday"):d.toLocaleDateString(loc(),{weekday:"long",day:"numeric",month:"short"});
      groups.push({sep:label}); last=k;
    }
    groups.push({e:e,ms:ms});
  });

  const addExpense=()=>{
    const amt=parseFloat(String(form.amount).replace(',','.'))||0;
    if(amt<=0){ showToast(t("g_invalid")); return; }
    const signed=form.income? -amt : amt;   // ingreso = negativo (resta del gasto del mes)
    // Fecha elegible (petición 2026-07-11: una transferencia de hace días no podía apuntarse en su
    // día). Vacía = ahora; con fecha = ese día a las 12:00 local (evita bailes de zona horaria).
    const when=form.date? new Date(form.date+"T12:00:00") : new Date();
    const ex={ id:mcExpenseId(), date:(isNaN(when.getTime())?new Date():when).toISOString(), merchant:form.merchant||(form.income?"Ingreso":"Gasto"), amount:signed, category:form.income?"ingreso":form.category, source:"manual" };
    if(form.income) ex.noCard=true;                   // un ingreso nunca alimenta el round-up (igual que al editar)
    else if(form.noCard) ex.noCard=true;              // bizum/transfer: no cuenta round-up
    // Gasto a mano: etiqueta el banco de gasto diario si hay uno (filtro por banco; 2026-07-16)
    if(!form.income){ const daily=(state.accounts||[]).find(function(a){ return accDaily(a); }); if(daily&&daily.ent) ex.ent=daily.ent; }
    set(s=>Object.assign({},s,{expenses:[ex].concat(s.expenses)}));
    if(cloud.enabled()) subirGasto(ex, "gastos-apuntar");   // lo guarda también en la BD
    // Avisos al apuntar (notificaciones "de andar por casa", las push reales llegarán con el APK):
    // pasarse del presupuesto > cruzar el 80% > gasto tocho (≥15% del presupuesto). Si no, el toast normal.
    let msg = form.income ? t("g_saved_i") : t("g_saved_g");
    let isAlert=false;
    if(!form.income && (state.budget||0)>0){
      const bud=state.budget;
      const monthStartMs=startOfMonth().getTime();
      const before=(state.expenses||[]).filter(e=>dateMs(e.date)>=monthStartMs).reduce((a,e)=>a+e.amount,0);
      const after=before+amt;
      if(before<=bud && after>bud){ msg=tf("al_over",{x:eur0(after),b:eur0(bud)}); isAlert=true; }
      else if(before<bud*0.8 && after>=bud*0.8 && after<=bud){ msg=tf("al_80",{p:Math.round(after/bud*100)}); isAlert=true; }
      else if(amt>=bud*0.15 && amt>=50){ msg=tf("al_big",{x:eur0(amt)}); isAlert=true; }
    }
    // En la app Android los avisos también salen como notificación de verdad (quedan en la bandeja).
    if(isAlert){ const nat=natPlugin(); if(nat&&nat.showNotification){ try{ nat.showNotification({title:"Aely",body:msg}).catch(function(){}); }catch(e){} } }
    setForm({merchant:"",amount:"",category:form.category,income:false,noCard:false,date:""}); setAdding(false); showToast(msg);
  };

  return React.createElement("div",{className:"v4-screen",ref:rootRef},
    React.createElement("h1",{className:"v4-title serif"}, t("v4_gastos_title")),
    React.createElement("section",{className:"v4-gastos-summary"},
      React.createElement("div",{className:"v4-gastos-summary-top"},
        React.createElement("div",{className:"v4-gastos-summary-main"},
          React.createElement("div",{className:"v4-gastos-summary-label"},
            monthSummary.mode==="net"
              ? tf("v4_gastos_net_in",{month:monthSummary.month})
              : tf("v4_gastos_spent_in",{month:monthSummary.month})),
          // Importe en blanco, sin signo, € al lado (como el patrimonio). El rojo/menos
          // confundía el «balance» con una alarma (feedback 2026-07-17).
          (function(){
            const amt=monthSummary.mode==="net"?Math.abs(monthSummary.balance):monthSummary.spent;
            const p=eurParts(amt);
            return React.createElement("div",{className:"v4-gastos-summary-amount num"},
              p.ent, React.createElement("span",{className:"cents"},","+p.dec+" "+p.sym));
          })(),
          // Dos filas (etiqueta | importe) en vez de una sola frase «Gastos X · ingresos Y»:
          // con ¥/₺ y letra pequeña la frase se partía a mitad y solapaba el presupuesto
          // (feedback 2026-08-05 tras multidivisa).
          (function(){
            const pair=function(lbl, amt){
              return React.createElement("div",{className:"v4-gastos-summary-pair"},
                React.createElement("span",{className:"lbl"}, lbl),
                React.createElement("span",{className:"amt num"}, amt));
            };
            if(monthSummary.mode==="net"){
              return React.createElement("div",{className:"v4-gastos-summary-sub"},
                pair(t("v4_gastos_lbl_spent"), eur(monthSummary.spent)),
                pair(t("v4_gastos_lbl_income"), eur(monthSummary.income)));
            }
            if(!(monthSummary.income>0)) return null;
            return React.createElement("div",{className:"v4-gastos-summary-sub"},
              pair(t("v4_gastos_lbl_income"), eur(monthSummary.income)),
              pair(t("v4_gastos_lbl_balance"),
                (monthSummary.balance>=0?"+":"−")+eur(Math.abs(monthSummary.balance))));
          })()
        ),
        React.createElement("div",{className:"v4-gastos-summary-budget"},
          React.createElement("div",null,tf("v4_gastos_of",{x:monthSummary.budget==null?"—":eur(monthSummary.budget)})),
          React.createElement("div",{className:"v4-gastos-summary-left"},tf("v4_gastos_left",{x:monthSummary.remaining==null?"—":eur(monthSummary.remaining)}))
        )
      ),
      React.createElement("div",{className:"v4-gastos-progress",role:"progressbar","aria-valuemin":0,"aria-valuemax":monthSummary.budget||0,"aria-valuenow":monthSummary.spent},
        React.createElement("i",{style:{width:monthSummary.budget==null?"0%":Math.min(100,monthSummary.spent/monthSummary.budget*100)+"%"}})
      ),
      React.createElement("div",{className:"v4-gastos-progress-marks"},
        React.createElement("span","1 "+monthSummary.month),
        React.createElement("span",tf("v4_gastos_today_mark",{d:monthSummary.day})),
        React.createElement("span",monthSummary.last+" "+monthSummary.month)
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
         encuentra con que le han escondido algo sin avisar. Se pliega quien quiera plegarlo. */
      catBreakdown.length>0 && React.createElement("div",{className:"v4-gastos-cats"+(catsOpen?"":" cerrado"),"data-testid":"gastos-cats"},
        React.createElement("button",{type:"button",className:"v4-gastos-cats-h",
          "aria-expanded":catsOpen,"aria-controls":"gastos-cats-body",onClick:toggleCats},
          React.createElement("span",{className:"v4-gastos-cats-t"},
            catsOpen ? t("v4_gastos_cats")
                     : (catBreakdown.length===1 ? t("v4_gastos_cats_n1") : tf("v4_gastos_cats_n",{n:catBreakdown.length}))),
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
      )
    ),
    React.createElement("div",{className:"filters"},
      React.createElement("div",{className:"v4-periods"},
        DATE_PRESETS.slice(0,2).map(function(p){ return React.createElement("button",{key:p.id,className:"v4-period-btn"+(preset===p.id?" on":""),onClick:function(){ setPreset(p.id); setMorePeriods(false); }},t("g_"+p.id)); }),
        React.createElement("button",{className:"v4-period-btn"+(morePeriods||DATE_PRESETS.slice(2).some(function(p){ return p.id===preset; })?" on":""),onClick:function(){ setMorePeriods(!morePeriods); }},t("v4_period_more"))
      ),
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
      preset==="cycle" && React.createElement("div",{className:"v4-cycle-box"},
        cycle
          ? React.createElement(React.Fragment,null,
              React.createElement("strong",null,"📅 "+t("g_cycle")),
              tf("g_cycle_from",{d:cycle.start.toLocaleDateString(loc(),{day:'2-digit',month:'2-digit'}), x:"+"+eur0(Math.abs(cycle.inc.amount))+((cycle.inc.merchant&&cycle.inc.merchant!=="Ingreso")?" · "+cycle.inc.merchant:"")}))
          : React.createElement(React.Fragment,null,
              React.createElement("strong",null,t("g_cycle_none_t")),
              t("g_cycle_none"))
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
        React.createElement("button",{type:"button",className:"v4-chip",onClick:function(){
          setSel([]);
          setBucketSel([]);
          // Borrar filtros = volver a la preselección automática de gasto diario.
          setBankSel(diarioEnts.slice());
        },style:{padding:"8px 12px"}}, t("g_filters_clear"))
      )
    ),
    React.createElement("div",{className:"action-row"},
      React.createElement("button",{className:"btn btn-ghost",onClick:onSync,disabled:syncing}, syncing?React.createElement(React.Fragment,null,React.createElement("span",{className:"spin"}),t("g_syncing")):React.createElement(React.Fragment,null,React.createElement(I.sync,{width:16,height:16}),t("g_sync")))
    ),
    React.createElement("div",{className:"sync-note"},
      React.createElement("span",{className:"sync-dot "+(syncStatus.type||"idle")}),
      syncStatus.msg || (state.lastSync?tf("g_lastsync",{d:new Date(state.lastSync).toLocaleString(loc(),{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}):t("g_nosync"))
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
    React.createElement("div",{className:"v4-gastos-list",style:{marginTop:14}},
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
              const esVacioNormal=sinFiltros && hayHistorico && (preset==="month"||preset==="cycle");
              return React.createElement("div",{className:"empty"},
                React.createElement("div",{className:"ttl"}, esVacioNormal?t("g_empty_period_t"):t("g_empty_t")),
                esVacioNormal?t("g_empty_period_d"):t("g_empty_d"));
            })()
          : groups.map(function(g,i){ return g.sep
              ? React.createElement("div",{className:"day-sep",key:"s"+i},g.sep)
              : React.createElement(MovRow,{key:g.e.id||i, e:g.e, ms:g.ms, onOpen:openDetail, l10n:l10nKey,
                  bucket:expenseBucket(g.e, state),dragging:!!(dragExpense&&dragExpense.from===g.e.id),
                  dragOver:!!(dragExpense&&dragExpense.to===g.e.id&&dragExpense.from!==g.e.id),
                  onDragStart:startExpenseDrag,onDragMove:moveExpenseDrag,onDragEnd:endExpenseDrag}); }),
        visible<filtered.length && React.createElement("div",{className:"sentinel",ref:sentinelRefCb},t("g_loadmore"))
      )
    ),
    React.createElement(PeriodMoreSheet,{open:morePeriods,onClose:function(){ setMorePeriods(false); },preset:preset,setPreset:setPreset}),
    React.createElement(GastosFilterSheet,{
      open:filterOpen, onClose:function(){ setFilterOpen(false); },
      sel:sel, setSel:setSel, bankSel:bankSel, setBankSel:setBankSel,
      bucketSel:bucketSel, setBucketSel:setBucketSel,
      bankOpts:bankOpts, diarioEnts:diarioEnts, debts:state.debts
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
      setCat:setCat, setCuota:setCuota, setCardFlag:setCardFlag, setBank:setBank, delExpense:delExpense, saveEdit:saveEdit, saveNote:saveNote,
      resolveDup:resolveDup,
      showToast:showToast, aiBusy:aiBusy, suggestAi:suggestAi, state:state
    }),
    undoDelete && ReactDOM.createPortal(
      React.createElement("div",{className:"v4-undo-toast",role:"status","data-testid":"expense-undo"},
        React.createElement("span",null,t("f_undo_deleted")),
        React.createElement("button",{type:"button",onClick:undoLastDelete},t("f_undo"))),document.body)
  );
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
const MovRow=React.memo(function MovRow({e, ms, onOpen, bucket, dragging, dragOver, onDragStart, onDragMove, onDragEnd}){
  // `ms` y no un `Date`: ver el porqué donde se construyen los grupos. El objeto se crea aquí,
  // que es la única línea que lo necesita, y solo cuando la fila se pinta de verdad.
  // `bucket` (string) lo pasa el padre: si se pasara `state` entero, el memo no acertaría nunca.
  const d=new Date(ms);
  const c=catOf(e.category);
  const isIncome=e.amount<0;
  const bk=expenseBankOf(e);
  const note=expenseNote(e);   // concepto del bizum / descripción del banco (2026-07-24)
  // Un ingreso NO va apagado: entra dinero, no es un gasto que se descarta. Solo se atenúan los
  // dos cajones que no mueven el presupuesto, y cada uno dice el suyo en vez de un «no afecta»
  // genérico que hacía que una inversión y un recibo de Sabadell parecieran lo mismo.
  const skip=bucket==="neutra"||bucket==="otrobanco"||bucket==="posible"||bucket==="deuda";
  const skipTxt=skip?t("g_skip_"+bucket):"";
  return React.createElement("button",{type:"button","data-expense-id":e.id,"data-expense-day":String(e.date||"").slice(0,10),
      className:"v4-mov"+(skip?" v4-mov-skip":"")+(dragging?" dragging":"")+(dragOver?" drag-over":""),
      onClick:function(ev){ if(ev.target&&ev.target.closest&&ev.target.closest(".v4-mov-drag")) return; onOpen(e); },style:skip?{opacity:.72}:null},
    React.createElement("div",{className:"tile",style:{borderColor:c.color+"55",color:c.color,background:c.color+"18"}},c.icon),
    React.createElement("div",{className:"nm"},
      React.createElement("div",{className:"nm-title"}, e.merchant||"—"),
      note && React.createElement("div",{className:"nm-note"}, note),
      React.createElement("div",{className:"nm-cat",style:{color:c.color}}, catName(e.category)),
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
   Misma mecánica que PeriodMoreSheet (swipe abajo + atrás). */
/* Nombre de lo que hay en `sel`: una categoría, o `debt:<id>` = el chip de una deuda (4.21.0).
   Una deuda borrada ya no tiene chip; si seguía marcada, se lee como «Deudas». */
function filterSelLabel(id, debts){
  if(String(id).indexOf("debt:")!==0) return catName(id);
  const d=(debts||[]).find(function(x){ return x && ("debt:"+x.id)===id; });
  return d ? (d.name||catName("deudas")) : catName("deudas");
}
function GastosFilterSheet({open, onClose, sel, setSel, bankSel, setBankSel, bucketSel, setBucketSel, bankOpts, diarioEnts, debts}){
  useBackClose(!!open, onClose);
  const swipe=useSheetSwipe(!!open, onClose);
  const [qCat,setQCat]=useState("");
  const [filterCatsOpen,setFilterCatsOpen]=useState(false);
  useEffect(function(){
    if(open){ setQCat(""); setFilterCatsOpen(false); }
  },[open]);
  if(!open) return null;
  /* Sin deudas no sale ni la categoría «Deudas» ni su sección (apunte de Cursor al brief). */
  const debtList=(debts||[]).filter(function(d){ return d && d.id; });
  const allCats=CATEGORIES.concat([INGRESO_CAT,INVERSION_CAT,TRASPASO_CAT]).concat(debtList.length?[DEUDA_CAT]:[]);
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
    // Igual que el chip de «Borrar filtros»: volver a los bancos de gasto diario.
    setBankSel(diarioEnts.slice());
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

/* Sheet «Más…» de períodos. Antes era un portal pelado SIN useSheetSwipe/useBackClose: era el
   único sheet que no se podía cerrar tirando hacia abajo («el más de la foto» — feedback
   2026-07-18) ni con el gesto atrás. Mismo patrón que BudgetSheet. */
function PeriodMoreSheet({open, onClose, preset, setPreset}){
  useBackClose(!!open, onClose);
  const swipe=useSheetSwipe(!!open, onClose);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"serif",style:{fontSize:22,fontWeight:550,marginBottom:14}}, t("v4_period_more")),
        DATE_PRESETS.slice(2).map(function(p){
          return React.createElement("button",{key:p.id,type:"button",className:"v4-sheet-row"+(preset===p.id?" on":""),onClick:function(){ setPreset(p.id); onClose(); }}, t("g_"+p.id));
        })
      )
    ), document.body);
}

/* Sheet detalle/edición de un movimiento. Layout alineado con Apuntar/Cartera (feedback 2026-07-17). */
function ExpenseDetailSheet({exp, editExp, setEditExp, onClose, setCat, setCuota, setCardFlag, setBank, delExpense, saveEdit, saveNote, resolveDup, showToast, aiBusy, suggestAi, state}){
  /* UNA SOLA CONDICIÓN para pintarse y para los candados. Iban por separado (`!!exp` en los hooks,
     `!exp || !editExp` para pintar) y en cuanto se separaban el sheet desaparecía dejando el
     `overflow:hidden` y el bloqueo de `touchmove` puestos sobre una pantalla vacía: nada respondía
     hasta darle a atrás (bug 2026-08-17). La causa concreta ya está arreglada en `saveEdit`; esto
     es para que ninguna otra vía que vacíe `editExp` pueda volver a dejar la app muerta. */
  const abierto=!!exp && !!editExp;
  const swipe=useSheetSwipe(abierto, onClose);
  useBackClose(abierto, swipe.close);
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
    {id:"cash",testId:"exp-efectivo",label:t("f_meta_cash"),lead:React.createElement("span",null,"💶"),on:bk==="efectivo",locked:auto,
      onClick:function(){ setBank(exp,bk==="efectivo"?null:"efectivo"); }},
    {id:"date",testId:"exp-date",label:fmtIsoCorto(dateIso),lead:React.createElement("span",null,"📅"),on:calOpen,
      onClick:function(){ setCalOpen(function(v){ return !v; }); setBankOpen(false); }}
  ];
  const duplicate=exp.possibleDup && React.createElement("div",{className:"hint",style:{margin:"0 0 12px",padding:"10px 12px",borderRadius:12,background:"var(--surface-2)"}},
    React.createElement("div",{style:{fontWeight:600,marginBottom:4}},t("g_dup_title")),
    React.createElement("div",{style:{marginBottom:10}},t("g_dup_sub")),
    React.createElement("div",{className:"row",style:{gap:8}},
      React.createElement("button",{type:"button",className:"btn btn-primary",style:{flex:1},onClick:function(){ resolveDup&&resolveDup(exp,true); onClose(true); }},t("g_dup_same")),
      React.createElement("button",{type:"button",className:"btn btn-ghost",style:{flex:1},onClick:function(){ resolveDup&&resolveDup(exp,false); onClose(true); }},t("g_dup_diff"))));
  const afterMeta=React.createElement(React.Fragment,null,
    calOpen && React.createElement(McCal,{value:dateIso,onPick:function(iso){ setCalOpen(false); saveEdit(exp,{date:iso}); }}),
    bankOpen && !auto && bankOpts.length>0 && React.createElement("div",{className:"v4-chips wrap","data-testid":"exp-bank-list"},
      React.createElement("button",{type:"button",className:"v4-chip"+(!bk?" on":""),onClick:function(){ setBank(exp,null); setBankOpen(false); }},t("ap_bank_none")),
      bankOpts.map(function(b){ return React.createElement("button",{key:b,type:"button",className:"v4-chip"+(bk===b?" on":""),
        onClick:function(){ setBank(exp,b); setBankOpen(false); }},"🏦 "+entOf(b).label); })),
    trace,duplicate);
  const debtOptions=(state.debts||[]).filter(function(d){ return d&&d.id; });
  const adjustments=React.createElement("div",{className:"v4-ficha-adjust"},
    React.createElement("button",{type:"button",className:"v4-ficha-adjust-row",onClick:function(){ setAdjustOpen(adjustOpen==="note"?null:"note"); }},
      React.createElement("span",null,t("f_note_row")),React.createElement("span",{className:"value"},editExp.note||t("f_note_none")),React.createElement("span",{className:"chev"},"›")),
    adjustOpen==="note" && React.createElement("div",{className:"v4-ficha-adjust-open"},
      React.createElement("input",{className:"v4-exp-note-in",value:editExp.note||"",maxLength:160,placeholder:t("v4_exp_note_ph"),
        onChange:function(e){ const v=e.target.value; setEditExp(function(p){ return Object.assign({},p,{note:v}); }); },
        onBlur:function(){ saveNote(exp,editExp.note); },"aria-label":t("v4_exp_note")})),
    !isIncome && debtOptions.length>0 && React.createElement(React.Fragment,null,
      React.createElement("button",{type:"button",className:"v4-ficha-adjust-row",onClick:function(){ setAdjustOpen(adjustOpen==="debt"?null:"debt"); }},
        React.createElement("span",null,t("f_debt_row")),React.createElement("span",{className:"value"},exp.debtId?catName("deudas"):t("f_no")),React.createElement("span",{className:"chev"},"›")),
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
    React.createElement("span",{className:"v4-ficha-saved"},t("f_autosaved")),
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
