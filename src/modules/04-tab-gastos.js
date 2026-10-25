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
   histórico: sirve para no comparar con un mes que el histórico no cubre entero.
   `fila` (opcional) cambia la regla por fila: el filtro de categoría suma solo lo de esa
   categoría con la regla del desglose (`gastosFilaCat`). `n` cuenta las filas que suman y `tot`
   es el total de la ventana (la cifra del filtro fuera de «meses»). */
function gastosCifraDias(state, expenses, period, fromMs, toMs, porMes, fila){
  const delSet=period.cycle?expenseDeletedSet(state):null;
  const st=Object.assign({},state,{expenses:expenses});
  const days=Object.create(null), months=Object.create(null);
  let earliest=Infinity;
  (expenses||[]).forEach(function(e){
    if(!e) return;
    const ms=dateMs(e.date);
    if(ms<earliest) earliest=ms;
    if(ms<fromMs || ms>=toMs) return;
    const v=fila?fila(e, st):budgetRowSigned(e, st, period, delSet);
    if(!v) return;
    // Día del dispositivo Y mes de Madrid: fuera de España un mismo día local puede caer en dos
    // meses de Madrid, y cada parte suma en el suyo (como en la lista).
    const info=gastosDia(ms), key=info.k+"|"+info.ym;
    let day=days[key];
    if(!day) day=days[key]={k:info.k, ym:info.ym, sp:0, inc:0, n:0};
    if(v>0) day.sp+=v; else day.inc-=v;
    day.n++;
  });
  const keys=Object.keys(days).map(function(x){ return days[x]; }).sort(function(a,b){ return a.k-b.k || (a.ym<b.ym?-1:a.ym>b.ym?1:0); });
  let run={sp:0,inc:0}, lastYm=null;
  const tot={sp:0,inc:0,n:0};
  keys.forEach(function(day){
    if(porMes && day.ym!==lastYm){ run={sp:0,inc:0}; lastYm=day.ym; }
    run={sp:run.sp+day.sp, inc:run.inc+day.inc};
    day.cum=run;
    const m=months[day.ym]||(months[day.ym]={sp:0,inc:0,n:0});
    m.sp+=day.sp; m.inc+=day.inc; m.n+=day.n;
    tot.sp+=day.sp; tot.inc+=day.inc; tot.n+=day.n;
  });
  return {days:days, keys:keys, months:months, earliest:earliest, porMes:!!porMes, tot:tot};
}
/* La regla del DESGLOSE por categoría (`categorySpentByMonth`), fila a fila: solo gasto (>0) que
   cuenta en el presupuesto, y la categoría tal como se PINTA (`catOf`: un id retirado suma en
   «Otros», como la fila de Categorías). Así el total del filtro es exactamente la cifra de su fila
   en Categorías, y la suma de los días del filtro, ese total. */
function gastosFilaCat(id){
  return function(e, st){ return e.amount>0 && catOf(e.category||"otros").id===id && expenseCountsBudget(e, st) ? e.amount : 0; };
}
/* La regla por fila de los filtros de la hoja: solo lo que está en la lista (`filtrados`), y de
   ello lo que la tarjeta no pinta como «no cuenta» (recibos y cuotas, inversiones y traspasos, otro
   banco, posibles repetidos) salvo que ese cajón se haya pedido en «Qué contar». Gasto en positivo,
   lo que entra en negativo, como `budgetRowSigned`. La aportación a una meta (`meta`) tampoco suma:
   la tanda 6 nació antes que ese cajón y, con un filtro de la hoja, la cifra y el total del día la
   contaban aunque su tarjeta dijera que no cuenta (integración de la 4.26.172). No está entre los
   chips de «Qué contar», así que con filtro nunca suma, igual que en el presupuesto. */
const GX_NO_SUMA={neutra:1, otrobanco:1, posible:1, deuda:1, recibo:1, meta:1};
function gastosFilaVista(filtrados, cajones){
  const en=new Set(filtrados);
  return function(e, st){
    if(!en.has(e)) return 0;
    const bk=expenseBucket(e, st);
    if(GX_NO_SUMA[bk] && cajones.indexOf(bk)===-1) return 0;
    return e.amount>0||e.amount<0 ? e.amount : 0;
  };
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
// La ventana de un mes de Madrid con la forma de `selectedPeriod` (sin ciclo): día 1 → día 1 siguiente.
function gastosMesVentana(ym){
  const ini=gastosYmInicioMs(ym);
  return {startMs:ini, todayEndMs:inicioDeMesMs(ini+35*864e5), cycle:null};
}

/* SUSCRIPCIONES COMO BANDEJA (Gastos v5, SPEC §6): cada detectada es una tarjeta y al tocarla sale
   su ficha con los últimos cobros y las tres decisiones. Las cifras son las de la detección de
   siempre (`detectSubscriptions`: mediana al mes, mediana × 12 al año); fechas, día y banco salen
   de los cargos reales que guarda (`ult`). «Seguidos» solo si no falta ningún mes entre el primero
   y el último: un cobro cada dos meses no puede salir como «cada mes». */
function gxSubFrec(sp){ return sp.span===sp.months?tf("gv5_sub_seguidos",{n:sp.months}):tf("gv5_sub_de",{n:sp.months,m:sp.span}); }
function gxSubBanco(sp){ const bk=sp.ult&&sp.ult[0]?expenseBankOf(sp.ult[0].e):null; return bk?(entOf(bk).label||entOf(bk).mono):null; }
const GxSubTarjeta=React.memo(function GxSubTarjeta({sp, vuelve, onOpen}){
  const c=catOf(sp.cat), bk=gxSubBanco(sp);
  return React.createElement("button",{type:"button",className:"gx-sub","data-sub":sp.key,onClick:function(){ onOpen(sp.key); }},
    React.createElement("span",{className:"gx-sub-ic","aria-hidden":true,style:{background:c.color+"22",color:c.color}},c.icon),
    React.createElement("span",{className:"gx-sub-txt"},
      React.createElement("span",{className:"gx-sub-nm"},sp.name),
      React.createElement("span",{className:"gx-sub-meta"},gxSubFrec(sp)+(bk?" · "+bk:"")),
      vuelve&&React.createElement("span",{className:"gx-sub-vuelve"},t("gv5_sub_vuelve"))),
    React.createElement("span",{className:"gx-sub-am"},
      React.createElement("span",{className:"num serif"},eur(sp.amount)),
      React.createElement("span",{className:"gx-sub-mes"},t("gv5_sub_almes"))));
});
/* Ficha de una suscripción (SPEC §6.4). `f` = {sp, vuelve}, una FOTO de la tarjeta tocada: la
   acción la quita de la bandeja y la hoja tiene que poder cerrarse con su animación enseñando
   todavía lo que se decidió. El importe se puede corregir antes de pasarla a Recibos (petición
   2026-08-03: luz y gas varían y no hay que arreglarlo a mano el mes siguiente). Las dos que no
   tienen vuelta atrás en la app (baja y «no es») preguntan antes; si se cancela, la ficha sigue. */
function GxSubFicha({f, onClose, onRecibos, onBaja, onNo}){
  const open=!!f, sp=f&&f.sp;
  const swipe=useSheetSwipe(open, onClose);
  useBackClose(open, swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  const [amt,setAmt]=useState({k:null, v:""});
  if(sp && amt.k!==sp.key) setAmt({k:sp.key, v:String(sp.amount).replace(".",",")});
  useEffect(function(){ if(open&&titleRef.current) titleRef.current.focus({preventScroll:true}); },[open]);
  if(!open) return null;
  const c=catOf(sp.cat), bk=gxSubBanco(sp), u0=sp.ult[0];
  const tras=function(p){ Promise.resolve(p).then(function(ok){ if(ok!==false) swipe.close(); }); };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet gx-subf","data-sheet":"sub-ficha",role:"dialog","aria-modal":"true","aria-labelledby":titleId,ref:swipe.sheetRef,
          style:{maxHeight:"90dvh"},onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"gx-subf-cab"},
          React.createElement("span",{className:"gx-sub-ic gx-subf-ic","aria-hidden":true,style:{background:c.color+"22",color:c.color}},c.icon),
          React.createElement("div",{className:"gx-sub-txt"},
            React.createElement("h1",{id:titleId,ref:titleRef,tabIndex:-1,className:"gx-subf-nm"},sp.name),
            React.createElement("span",{className:"gx-sub-meta"},tf("gv5_sub_dia",{d:parseDate(u0.e.date).getDate()})+" · "+(bk||t("gv5_sub_sinbanco"))),
            React.createElement("span",{className:"gx-sub-meta"},gxSubFrec(sp))),
          React.createElement("span",{className:"gx-sub-am"},
            React.createElement("span",{className:"num serif gx-subf-amt"},eur(sp.amount)),
            React.createElement("span",{className:"gx-sub-mes"},t("gv5_sub_almes")))),
        f.vuelve&&React.createElement("div",{className:"gx-sub-vuelve gx-subf-vuelve"},t("gv5_sub_vuelve")),
        React.createElement("div",{className:"gx-subf-et"},t("gv5_sub_ultimos")),
        React.createElement("div",{className:"gx-subf-hist"},
          sp.ult.map(function(x,i){
            return React.createElement("div",{key:i,className:"gx-subf-fila"},
              React.createElement("span",{className:"num"},new Date(x.ms).toLocaleDateString(loc(),{day:"numeric",month:"short",year:"numeric"})),
              React.createElement("span",{className:"num gx-subf-fila-am"},eur(x.amount)));
          })),
        React.createElement("p",{className:"gx-subf-anio"},
          tf(sp.span===sp.months?"gv5_sub_anio":"gv5_sub_anio_si",{y:eur0(sp.yearly)})+" "+t("gv5_sub_fijo")),
        React.createElement("label",{className:"gx-subf-imp"},
          React.createElement("span",null,t("gv5_sub_importe")),
          React.createElement("span",{className:"num"},
            React.createElement("input",{type:"text",inputMode:"decimal",value:amt.v,"data-testid":"sub-importe",
              onChange:function(e){ setAmt({k:sp.key, v:e.target.value}); }}),
            " € "+t("gv5_sub_almes"))),
        React.createElement("button",{type:"button",className:"btn btn-primary btn-block","data-sub-accion":"recibos",
          onClick:function(){ onRecibos(sp, amt.v); swipe.close(); }}, t("gv5_sub_recibos")),
        React.createElement("button",{type:"button",className:"btn btn-ghost btn-block","data-sub-accion":"baja",
          onClick:function(){ tras(onBaja(sp)); }}, t("gv5_sub_baja")),
        React.createElement("button",{type:"button",className:"gx-subf-no","data-sub-accion":"no",
          onClick:function(){ tras(onNo(sp)); }}, t("sub_dismiss"))
      )), document.body);
}
// La «i» de Suscripciones (SPEC §6.3): el texto que antes iba encima de la lista, en su hoja.
function GxSubInfo({open, onClose}){
  const swipe=useSheetSwipe(!!open, onClose);
  useBackClose(!!open, swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(open&&titleRef.current) titleRef.current.focus({preventScroll:true}); },[open]);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet gx-subf","data-sheet":"sub-info",role:"dialog","aria-modal":"true","aria-labelledby":titleId,ref:swipe.sheetRef,
          onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("h1",{id:titleId,ref:titleRef,tabIndex:-1,className:"gx-subf-nm serif"},t("gv5_sub_info")),
        [[t("gv5_sub_i_que_t"),t("gv5_sub_i_que")],[t("gv5_sub_i_como_t"),t("gv5_sub_i_como")],[t("gv5_sub_i_hacer_t"),t("gv5_sub_i_hacer")]].map(function(x,i){
          return React.createElement("div",{key:i,className:"gx-subi"},
            React.createElement("div",{className:"gx-subi-t"},x[0]),
            React.createElement("div",{className:"gx-subi-d"},x[1]));
        }),
        React.createElement("button",{type:"button",className:"btn btn-primary btn-block",onClick:swipe.close},t("gv5_sub_i_ok"))
      )), document.body);
}
function Expenses({state, set, showToast, stopSwipe, cancelSwipe, focusExp, clearFocus, forceAllTs, onGoPlan, onGoInversiones}){
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
  /* Sección de Gastos v5 (SPEC §2.2): movs | cats | subs. No se guarda: entrar en Gastos es
     siempre venir a ver movimientos. El ref es para quien vive fuera del render (el observador
     de la paginación, el tirón). */
  const [secc,setSecc]=useState("movs");
  const seccRef=useRef(secc); seccRef.current=secc;
  const seccElRef=useRef({});
  /* Filtro de categoría (SPEC §4.1 y §5, tanda 3): tocar una categoría en Categorías enseña sus
     movimientos de ESE mes con una píldora que lo quita. `ym` null = el mes en curso (así no se
     queda clavado en el mes viejo si la app sigue abierta al cambiar de mes). Es otra cosa que las
     categorías de la hoja de Filtros: aquí la cifra de arriba pasa a ser la de la categoría.
     `mesSel` es el mes que enseña Categorías (fila de meses, null = el en curso); el filtro nace
     en ese mes. */
  const [catFil,setCatFil]=useState(null);
  const [mesSel,setMesSel]=useState(null);
  /* El ciclo que se ve en Mi ciclo (petición del dueño, 25/10/2026: «que el filtro de meses salga
     también en Mi ciclo y que se note en cuál estás»): el inicio en ms de un ciclo pasado, o null
     = el en curso. Como `mesSel`, no se guarda: entrar en Gastos es ver el ciclo de hoy. */
  const [cicloSel,setCicloSel]=useState(null);
  const cicloSelRef=useRef(cicloSel); cicloSelRef.current=cicloSel;
  const catFilRef=useRef(catFil); catFilRef.current=catFil;
  const mesSelRef=useRef(mesSel); mesSelRef.current=mesSel;
  /* Al salir de Gastos vuelve a Movimientos, sin filtro de categoría y en el mes en curso: todas
     las puertas de entrada (Inicio «Ver gastos», «Ver todo» de una cuenta, la notificación,
     importar) vienen a ver movimientos, y quedarse en Categorías o filtrado haría que aterrizaran
     en otra cosa. Se hace en un hueco libre y solo si sigue fuera: no puede costar un render en
     mitad del gesto de cambiar de pestaña. */
  useEffect(function(){
    let fuera=false;
    return mcOnGastosActive(function(active){
      fuera=!active;
      if(active || seccRef.current==="movs" && !catFilRef.current && !mesSelRef.current && cicloSelRef.current==null) return;
      mcScheduleIdle(function(){
        if(!fuera) return;
        if(seccRef.current!=="movs") setSecc("movs");
        if(catFilRef.current) setCatFil(null);
        if(mesSelRef.current) setMesSel(null);
        if(cicloSelRef.current!=null) setCicloSel(null);
      }, 1500);
    });
  },[]);
  // Tras importar una hoja: salta a "Todo" — lo importado suele traer fechas fuera del mes en
  // curso, y "Este mes" las tapaba en silencio (feedback 2026-08-01).
  useEffect(function(){ if(forceAllTs){ setPreset("all"); setSecc("movs"); setCatFil(null); } },[forceAllTs]);
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
      setPreset("all"); setBankSel([ent]); setBucketSel([]); setSel([]); setQ(""); setFilterOpen(false); setSecc("movs"); setCatFil(null);
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
  /* «Es aportación a la meta X» desde la ficha (decisión suya del 24/10/2026). Toca dinero, así que
     PONERLA se confirma diciendo qué cambia («de 100 € a 350 €»), y si la meta ya tenía algo
     ahorrado avisa de lo único que la app no puede saber: si ese mismo dinero ya lo sumó él a mano
     con «Aportar» o con un reparto. En ese caso contaría dos veces, y la app no adivina cuál de los
     dos apuntes es el bueno. QUITARLA no pregunta: deja todo como estaba. La marca sube a la nube
     (`setExpenseMeta`) y solo deja de protegerse con su acuse (`ackMetaWrite`). */
  const metaEnVuelo=useRef({});
  const subeMeta=function(e){
    if(!cloud.enabled()) return;
    const k=keyOfExpense(e)+"|"+(e.goalId||""), owner=state._historyOwner;
    metaEnVuelo.current[k]=true;
    cloud.setExpenseMeta(e).then(function(n){
      if(n>0) set(function(p){ if(p._historyOwner!==owner) return p; const l=ackMetaWrite(p.expenses, e, e.goalId||null); return l===p.expenses?p:Object.assign({},p,{expenses:l}); });
    }).catch(function(){}).then(function(){ delete metaEnVuelo.current[k]; });
  };
  const setMeta=function(ex,goalId){
    const subirMeta=function(){
      let subir=null;
      set(function(s){ const r=marcarAportacionMeta(s, ex.id, goalId); if(!r) return s; subir=r.e; return r.state; });
      if(!subir) return;
      const g=goalId&&(state.goals||[]).find(function(x){ return x.id===goalId; });
      if(showToast) showToast(goalId?tf("f_meta_ok",{name:(g&&g.name)||""}):t("f_meta_off"));
      subeMeta(subir);
    };
    if(goalId==null){ subirMeta(); return; }
    const g=(state.goals||[]).find(function(x){ return x.id===goalId; });
    if(!g) return;
    const antes=metaAhorrado(g,state);
    const sub=tf("f_meta_confirm_sub",{x:eur(ex.amount),a:eur(antes),b:eur(Math.round((antes+ex.amount)*100)/100)})+((g.saved||0)>0?" "+t("f_meta_confirm_doble"):"");
    askConfirm({title:tf("f_meta_confirm_t",{name:g.name||""}),sub:sub,ok:t("f_meta_confirm_ok")}).then(function(yes){ if(yes) subirMeta(); });
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
  /* La marca de meta que no llegó a la nube (sin red, o con la fila aún sin subir) se reintenta al
     abrir, al volver la red y al volver a primer plano, como los renombres. Sin esto `metaPend`
     protegía la fila para siempre: este móvil no la contaba como gasto y el otro y el widget sí, y
     una retirada hecha en el otro móvil no llegaba nunca (revisión del 25/10/2026). Solo escribe en
     la tabla `expenses`: no despierta ningún sync de bancos (AGENTS §7). */
  const reintentaMetas=function(){
    if(!cloud.enabled()||mcSandbox()||mcSandboxTransition())return;
    const s=renameState.current, deleted=expenseDeletedSet(s);
    (s.expenses||[]).forEach(function(e){
      if(e&&e.metaPend&&!expenseIsTombstoned(e,deleted)&&!metaEnVuelo.current[keyOfExpense(e)+"|"+(e.goalId||"")]) subeMeta(e);
    });
  };
  useEffect(function(){ reintentaMetas(); },[]);
  // Lo que se editó sin conexión se sube al volver: ver `subeEdicionesDeGasto`.
  useEffect(function(){
    const alVolver=function(){retryRenames(true);reintentaMetas();};
    const alVerse=function(){ if(document.visibilityState==="visible"){retryRenames(true);reintentaMetas();} };
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
  /* CICLOS PASADOS (25/10/2026). Cada uno se busca con la MISMA regla que el en curso (el cobro
     que lo abre, `budgetPaydayOf` o `lastPaydayOf`), preguntando por el último cobro antes de que
     empezara el siguiente; acaba el día antes de que empiece el siguiente. Si no aparece el cobro
     de antes, la fila se para ahí: un ciclo sin su cobro sería inventado. Solo se calcula en Mi
     ciclo. Lista de más viejo a más nuevo, como la de meses. */
  const ciclos=useMemo(function(){
    if(preset!=="cycle" || !cycle) return null;
    const delSet=expenseDeletedSet(state);
    const busca=function(ms){ return cycleEnabled?budgetPaydayOf(state,ms,expensesDef):lastPaydayOf(expensesDef,ms,delSet); };
    const out=[{start:cycle.start, inc:cycle.inc, from:cycle.start.getTime(), to:null}];
    for(let i=0;i<GX_CICLOS_MAX;i++){
      const sig=out[out.length-1], prev=busca(sig.from-1);
      if(!prev || !(prev.start.getTime()<sig.from)) break;
      out.push({start:prev.start, inc:prev.inc, from:prev.start.getTime(), to:sig.from-1});
    }
    return out.reverse();
  },[preset,cycle,expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.flows,cycleEnabled]);
  // El ciclo pasado elegido (null = el en curso, también si el elegido ya no existe).
  const cicloPas=ciclos&&cicloSel!=null?ciclos.find(function(c){ return c.to!=null&&c.from===cicloSel; })||null:null;
  const cicloPasRef=useRef(cicloPas); cicloPasRef.current=cicloPas;
  /* El RANGO del ciclo que se ve, para la línea bajo la cifra (decisión del dueño, 25/10/2026:
     «mes + fechas»: la pastilla dice el mes y debajo «24 sep – 23 oct»). Uno pasado acaba el día
     antes del cobro siguiente; el en curso, el día antes del mismo día del mes que viene (el cobro
     que lo cierra aún no ha llegado; si ese mes es más corto, su último día). */
  const cicloRango=useMemo(function(){
    if(preset!=="cycle" || !cycle) return null;
    if(cicloPas) return {ini:cicloPas.from, fin:cicloPas.to};
    const s=cycle.start;
    const fin=Math.min(new Date(s.getFullYear(),s.getMonth()+1,s.getDate()-1).getTime(), new Date(s.getFullYear(),s.getMonth()+2,0).getTime());
    return {ini:s.getTime(), fin:fin};
  },[preset,cycle,cicloPas]);
  const cicloTxt=function(fin){ return tf("gv5_ciclo_rango",{d1:gxDiaCorto(cicloRango.ini), d2:gxDiaCorto(fin)}); };
  const bounds=useMemo(function(){
    if(cicloPas) return {from:cicloPas.from, to:cicloPas.to};
    return presetBoundsMs(preset,range,cycle&&cycle.start);
  },[preset,range,cycle,cicloPas,todayKey,madridDay]);
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
    // Un ciclo pasado lleva SU cobro: es el que no suma como ingreso dentro de él (`budgetRowSigned`).
    return gastosPeriodOf(preset,bounds,cicloPas||cycle);
  },[preset,bounds,cycle,cicloPas,todayKey,madridDay]);
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
    // Filtro de categoría: la categoría como se pinta (`catOf`, igual que su fila en Categorías) y,
    // en «meses», solo su mes de Madrid.
    const fil=catFil, filVentana=fil&&preset==="months"?gastosMesVentana(fil.ym||mad.ym):null;
    const out=[];
    const src=expensesDef||[];
    for(let i=0;i<src.length;i++){
      const e=src[i];
      // La lápida puede venir de otro dispositivo sin retirar aún esta fila local.
      if(e.autoGemelo||expenseIsTombstoned(e,expenseDeletedSet(state))) continue;
      const ms=dateMs(e.date);
      if(!inBounds(ms,bounds)) continue;
      if(fil){
        if(filVentana && (ms<filVentana.startMs || ms>=filVentana.todayEndMs)) continue;
        if(catOf(e.category||"otros").id!==fil.id) continue;
        // Los cargos de las filas grises (recibos, cuotas, metas, inversiones) no se enseñan con
        // filtro (SPEC §4.4): no suman a la categoría. Siguen en Movimientos sin filtro y en su fila gris.
        if(grisDeGasto(e, expenseBucket(e, state))) continue;
      }
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
  },[expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,bounds,sel,bankSel,bucketSel,q,catFil,preset,madridDay,state.settings,state.accounts,state.fixed,state.oneoffs,state.reciboNo]);

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
  // Un ciclo pasado es como un mes cerrado: sin límite (no hay foto del límite de entonces).
  const budgetApplies=preset==="months"||preset==="cycle"&&!cicloPas;
  const monthSummary=useMemo(function(){
    const bs=monthBudgetStats(Object.assign({},state,{expenses:expensesDef}),null,null,null,selectedPeriod);
    // No existe una foto histórica del límite ni un presupuesto acumulado para varios meses.
    // Enseñar el límite actual como margen del pasado inventaría dinero disponible.
    if(!budgetApplies){ bs.budget=null; bs.remaining=null; }
    const periodLabel=preset==="custom"
      ? (range.from?fmtIsoCorto(range.from):t("g_all"))+" → "+(range.to?fmtIsoCorto(range.to):t("g_all"))
      : preset==="months" ? monthLong(mad.m-1) : preset==="all" ? t("gv5_all")
      : cicloPas ? cicloTxt(cicloRango.fin) : t("g_"+preset);
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
  /* Lo mismo para el filtro de categoría: sus sumas por día con la regla del desglose. En «meses»
     se acumula por mes sobre el histórico entero (para comparar con la misma categoría el mes
     anterior); en Mi ciclo / Rango / Todo, dentro de la ventana. Solo existe con filtro puesto. */
  const catFilId=catFil&&catFil.id;
  const cifraCat=useMemo(function(){
    if(!catFilId) return null;
    const months=preset==="months";
    const to=months||bounds.to===Infinity?Infinity:bounds.to+1;
    return gastosCifraDias(state, expensesDef, {cycle:null}, months?-Infinity:bounds.from, to, months, gastosFilaCat(catFilId));
  },[catFilId,expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,preset,bounds,todayKey,madridDay]);
  /* Las sumas de LO QUE SE VE con los filtros de la hoja (tanda 6: categorías, bancos o «Qué
     contar»): las mismas filas que la lista (`filtered`, misma referencia de cada gasto; si además
     hay búsqueda, también la cuenta) y, de ellas, las que la tarjeta no marca como «no cuenta» —
     salvo que ese cajón sea justo el que se ha pedido en «Qué contar». Así la cifra de arriba y el
     total de cada día cuadran con las tarjetas de debajo. La búsqueda SOLA sigue explorando sin
     redefinir la cifra (contrato de siempre, `gastos-periodo-categorias`): él pidió los filtros.
     Sin filtros la cifra es la del presupuesto (`cifra`). */
  const filtraVista=!catFilId && (sel.length>0 || bucketSel.length>0 || !sameEntList(bankSel,diarioEnts));
  const cifraFil=useMemo(function(){
    if(!filtraVista) return null;
    const months=preset==="months";
    const to=months||bounds.to===Infinity?Infinity:bounds.to+1;
    return gastosCifraDias(state, expensesDef, {cycle:null}, months?-Infinity:bounds.from, to, months, gastosFilaVista(filtered, bucketSel));
  },[filtraVista,filtered,bucketSel,expensesDef,preset,bounds]);
  /* Categorías enseña el mes elegido en su fila de meses (SPEC §5). El límite y la barra del
     presupuesto solo en el mes en curso (o Mi ciclo): no hay foto del límite de un mes pasado, y
     el de hoy aplicado al pasado inventaría margen (la misma regla que la cifra, §3). */
  const catsYm=preset==="months"?(mesSel||mad.ym):null;
  const catsActual=!catsYm || catsYm===mad.ym;
  const catsPeriod=useMemo(function(){ return catsActual?selectedPeriod:gastosMesVentana(catsYm); },[catsActual,catsYm,selectedPeriod]);
  const catsBudget=budgetApplies&&catsActual;
  // Desglose por categoría: misma regla/ventana que la cabecera. categoryBudgets en deps
  // porque una fila a 0 con límite tiene que aparecer aunque no haya gastos nuevos.
  const catBreakdown=useMemo(function(){
    const rows0=categorySpentByMonth(Object.assign({},state,{expenses:expensesDef}),null,null,catsPeriod);
    // Una categoría que ya no existe (id viejo o raro) se PINTA como «Otros» (catOf); agrupar por
    // el id crudo enseñaba dos filas «Otros» (90 € y 15 €, captura de la tanda 2, 24/10). Se suma
    // en la que se ve, así el total sigue cuadrando con la cifra de arriba.
    const juntas={};
    rows0.forEach(function(r){
      const k=catOf(r.id).id;
      const j=juntas[k]||(juntas[k]={id:k,spent:0,limit:null});
      j.spent=+(j.spent+r.spent).toFixed(2);
      if(r.id===k) j.limit=r.limit;
    });
    const rows=Object.keys(juntas).map(function(k){ return juntas[k]; }).sort(function(a,b){
      if(b.spent!==a.spent) return b.spent-a.spent;
      return String(a.id).localeCompare(String(b.id));
    });
    return catsBudget?rows:rows.filter(function(row){ return row.spent>0; }).map(function(row){ return {id:row.id,spent:row.spent,limit:null}; });
  },[expensesDef,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.categoryBudgets,state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,catsPeriod,catsBudget,todayKey,madridDay]);
  /* Las categorías de la hoja de Filtros: las de MÁS GASTO del periodo que se ve, sacadas de este
     mismo desglose (no de otra cuenta): así las cinco de la hoja son las cinco primeras de
     Categorías. Sin las que no han gastado nada (las de límite a 0). */
  const masGastadas=useMemo(function(){
    return catBreakdown.filter(function(r){ return r.spent>0; }).map(function(r){ return r.id; });
  },[catBreakdown]);
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
  // Las que aún piden una decisión: activas, sin pasar a Recibos y sin descartar a mano. Las
  // cuenta el globito del icono y las enseña su sección (antes se filtraban al pintar).
  // «Ya la he dado de baja» (SPEC §6.4) guarda la fecha de su último cobro: se esconde mientras no
  // llegue uno posterior, y si llega vuelve con aviso (darla de baja no es descartarla para siempre).
  const novelSubs=useMemo(function(){
    const dismissed=state.subsDismissed||[], baja=state.subsBaja||{};
    return (subs||[]).filter(function(sp){
      if(!sp.active) return false;
      if(dismissed.indexOf(sp.key)!==-1) return false;
      if(baja[sp.key]!=null && !(sp.lastMs>baja[sp.key])) return false;
      return !(state.fixed||[]).some(function(f){ return catKey(f.name)===sp.key; });
    });
  },[subs,state.subsDismissed,state.subsBaja,state.fixed]);
  const [subFicha,setSubFicha]=useState(null);
  const [subInfo,setSubInfo]=useState(false);
  // Cambiar de sección cierra las fichas (SPEC §2.2): salir de Gastos también vuelve a Movimientos.
  useEffect(function(){ if(secc!=="subs"){ setSubFicha(null); setSubInfo(false); } },[secc]);
  const subsBaja=state.subsBaja;
  const abreSub=useCallback(function(key){
    const sp=novelSubs.find(function(x){ return x.key===key; });
    if(sp) setSubFicha({sp:sp, vuelve:!!subsBaja&&subsBaja[key]!=null});
  },[novelSubs,subsBaja]);
  const cierraSub=useCallback(function(){ setSubFicha(null); },[]);
  const abreSubInfo=useCallback(function(){ setSubInfo(true); },[]);
  const cierraSubInfo=useCallback(function(){ setSubInfo(false); },[]);
  /* Las tres decisiones. «Pasar a Recibos» es lo de siempre (crea el recibo mensual en la cuenta
     de Recibos, o la de «todo», con el día del último cobro) y se deshace borrándolo en Plan; las
     otras dos no tienen vuelta atrás en la app, así que preguntan (resuelven a false si cancela). */
  const subARecibos=function(sp, amtTxt){
    const useAmt=parseFloat(String(amtTxt).replace(",","."))||sp.amount;
    const acc=(state.accounts||[]).find(function(a){ return accRole(a)==="fijos"; })||(state.accounts||[]).find(function(a){ return accRole(a)==="ambos"; });
    const it={ id:uid(), name:sp.name, amount:useAmt, freq:"mes", account:(acc&&acc.ent)||"sabadell" };
    const dd=parseDate(sp.ult[0].e.date).getDate(); if(dd>=1&&dd<=31) it.day=dd;
    set(function(s){ return Object.assign({},s,{fixed:(s.fixed||[]).concat([it])}); });
    showToast(tf("gv5_sub_recibos_ok",{n:sp.name,b:entOf((acc&&acc.ent)||"sabadell").label}));
  };
  const subBaja=function(sp){
    return askConfirm({title:tf("gv5_sub_baja_q",{n:sp.name}), sub:t("gv5_sub_baja_sub"), ok:t("gv5_sub_baja_si")}).then(function(ok){
      if(!ok) return false;
      set(function(s){ const b=Object.assign({},s.subsBaja); b[sp.key]=sp.lastMs; return Object.assign({},s,{subsBaja:b}); });
      showToast(tf("gv5_sub_baja_ok",{n:sp.name}));
      return true;
    });
  };
  const subNo=function(sp){
    return askConfirm({title:tf("gv5_sub_no_q",{n:sp.name}), sub:t("gv5_sub_no_sub"), ok:t("sub_dismiss"), danger:true}).then(function(ok){
      if(!ok) return false;
      set(function(s){ return Object.assign({},s,{subsDismissed:(s.subsDismissed||[]).concat([sp.key])}); });
      showToast(t("sub_dismissed_ok"));
      return true;
    });
  };
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
  useEffect(()=>{ setVisible(CONFIG.PAGE_SIZE); },[preset,range,sel,bankSel,bucketSel,q,catFil]);
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
    // Con Movimientos escondido (otra sección) el centinela no puede pedir tandas: cargaría la
    // lista entera por detrás sin que nadie la mire.
    const io=new IntersectionObserver(function(es){
      if(es[0].isIntersecting && seccRef.current==="movs") setVisible(function(v){ return v<filtLen.current ? v+CONFIG.PAGE_SIZE*5 : v; });
    },{rootMargin:"2000px"});
    io.observe(el); ioRef.current=io; sentinelElRef.current=el;
  },[]);
  // Y al volver a Movimientos se le vuelve a preguntar: si ya estaba a la vista mientras se
  // ignoraba, el observador no avisa otra vez por sí solo y «Cargando más…» se quedaría clavado.
  const sentinelElRef=useRef(null);
  useEffect(function(){
    const io=ioRef.current, el=sentinelElRef.current;
    if(secc!=="movs" || !io || !el || !el.isConnected) return;
    io.unobserve(el); io.observe(el);
  },[secc]);
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
    const etiquetaMes=function(ym){ const y=+ym.slice(0,4); return mesDe(ym)+(y!==mad.y?" "+y:""); };
    // Meses para la fila fija de Categorías y del filtro: los que tienen algo que cuenta, y el en curso.
    const mesesPres=preset!=="months"?null:Object.keys(cifra.months).concat(cifra.months[mad.ym]?[]:[mad.ym]).sort()
      .map(function(ym){ return {ym:ym, label:etiquetaMes(ym)}; });
    /* La fila de CICLOS de Mi ciclo: cambia el ciclo enseñado, no salta en la lista. En Movimientos
       sale al bajar, como la de Meses: fija se veía todo el rato y él la quería solo al hacer scroll
       (25/10, tras la beta 4.26.172; el rango «24 sep – 23 oct» bajo la cifra ya dice qué ciclo es).
       Fija sigue en Categorías y con el filtro de categoría (SPEC §2.1). Cada ciclo se llama por el mes en que cae casi entero (su inicio + 15 días: el
       que empieza el 30 de septiembre es el de octubre); si dos caen en el mismo mes (un cobro
       adelantado), el segundo se llama por su día de inicio, para no tener dos pastillas iguales. */
    const cicloKey=function(c){ return "c"+c.from; };
    const vistos={};
    const ciclosFila=!ciclos?null:ciclos.map(function(c){
      let label=etiquetaMes(madridYmdParts(c.from+15*864e5).ym);
      if(vistos[label]) label=gxDiaCorto(c.from);
      vistos[label]=1;
      return {ym:cicloKey(c), label:label};
    });
    const cicloYm=ciclos?cicloKey(cicloPas||ciclos[ciclos.length-1]):null;
    // Bajando en Mi ciclo, lo sumado va del inicio del ciclo al día de debajo: «24 sep – 2 oct».
    const cicloHasta=function(k,d){ return cicloRango?cicloTxt(new Date(Math.floor(k/10000),Math.floor(k/100)%100-1,k%100).getTime()):tf("gv5_cycle_upto",{d:d}); };
    /* CON FILTRO DE CATEGORÍA (SPEC §3): la cifra es lo de esa categoría en ese mes, con la regla
       del desglose (la misma cifra que su fila en Categorías), y bajando, hasta el día de arriba.
       La línea cuenta los movimientos que suman y compara con la MISMA categoría el mes anterior:
       hasta el mismo día si es el mes en curso, y solo si el histórico cubre ese mes entero. Es
       gasto bruto siempre: una categoría no tiene «balance». */
    // La cifra del presupuesto, sin filtros: arriba sin filtros y siempre en Categorías.
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
      // Su rango, en curso o pasado; «en tu ciclo» solo si no hay cobro que lo marque.
      top={n:monthSummary.shown, pre:cicloRango?cicloTxt(cicloRango.fin):t("gv5_cycle"), tail:st&&st.tail, tone:st&&st.tone, ym:cicloYm};
    } else top={n:monthSummary.shown, pre:monthSummary.periodLabel, ym:null};
    top.sub=subDe({sp:monthSummary.spent, inc:monthSummary.income});
    /* CON FILTROS DE LA HOJA (categorías, bancos o qué contar; tanda 6, su «cuando
       tocas un filtro el número de arriba no cambia»): el MISMO camino que el filtro de categoría,
       con las sumas de lo que se ve (`cifraFil`). La cifra es lo gastado menos lo que ha entrado
       entre lo filtrado (con solo gastos, lo gastado: lo mismo que el filtro de Categorías) y debajo
       se dice de qué sale. La fila de meses sigue siendo la de la lista (o la de ciclos). */
    const fc=catFil&&cifraCat?cifraCat:cifraFil;
    if(fc){
      const months=preset==="months", fym=months?(catFil&&catFil.ym||mad.ym):null;
      const nTxt=function(n){ return tf(n===1?"gv5_fil_n1":"gv5_fil_n",{n:n}); };
      // Con el filtro de categoría `inc` es siempre 0 (solo suma gasto): su cifra no cambia.
      const val=function(x){ return x.sp-x.inc; };
      const subF=function(x){ return x.inc>0?tf("gv5_net_sub",{g:eur(x.sp),i:eur(x.inc)}):null; };
      let ftop;
      if(months){
        const m=fc.months[fym]||{sp:0,inc:0,n:0}, pym=gastosYmPrev(fym);
        let st=null;
        if(cubre(pym)){
          if(fym===mad.ym){
            const prevK=+pym.slice(0,4)*10000+(+pym.slice(5,7))*100+mad.d;
            st=vsPrev(val(m), val(gastosCumDia(fc,prevK,pym)), pym, true);
          } else st=vsPrev(val(m), val(fc.months[pym]||{sp:0,inc:0}), pym, false);
        }
        ftop={n:Math.abs(val(m)), pre:nTxt(m.n), tail:st&&st.tail, tone:st&&st.tone, ym:fym, sub:subF(m)};
      } else ftop={n:Math.abs(val(fc.tot)), pre:nTxt(fc.tot.n), ym:cicloYm, sub:subF(fc.tot)};
      // En balance la línea de debajo existe siempre: la caja no cambia de alto al bajar.
      if(ftop.sub==null && monthSummary.mode==="net") ftop.sub="";
      const fline=function(k, ym){
        if(k===mesesLista.newestK && ym===mesesLista.newestYm) return ftop;
        const c=gastosCumDia(fc,k,months?ym:undefined), d=(k%100)+" "+monthShort(Math.floor(k/100)%100-1).toLowerCase();
        return {n:Math.abs(val(c)), ym:months?ym:null, sub:subF(c),
          pre:months?tf("gv5_upto",{mes:mesDe(ym),d:k%100}):preset==="cycle"?cicloHasta(k,d):tf("gv5_period_upto",{period:monthSummary.periodLabel,d:d})};
      };
      if(catFil){
        const fmeses=ciclosFila||mesesPres;
        return {top:ftop, pres:top, line:fline, meses:fmeses, fijos:!!fmeses, mesesPres:mesesPres, ciclos:ciclosFila, etiquetaMes:etiquetaMes};
      }
      const lmeses=months?mesesLista.orden.map(function(ym){ return {ym:ym, label:etiquetaMes(ym)}; }):ciclosFila;
      return {top:ftop, pres:top, line:fline, meses:lmeses, fijos:false, mesesPres:mesesPres, ciclos:ciclosFila, etiquetaMes:etiquetaMes};
    }
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
        pre:preset==="cycle"?cicloHasta(k,d):tf("gv5_period_upto",{period:monthSummary.periodLabel,d:d}), ym:null};
    };
    const meses=preset==="months"?mesesLista.orden.map(function(ym){ return {ym:ym, label:etiquetaMes(ym)}; }):ciclosFila;
    return {top:top, line:line, meses:meses, fijos:false, mesesPres:mesesPres, ciclos:ciclosFila, etiquetaMes:etiquetaMes};
  },[monthSummary,cifra,cifraCat,cifraFil,catFil,mesesLista,preset,ciclos,cicloPas,cicloRango,madridDay,l10nKey]);
  /* La cabecera de las otras secciones (SPEC §3): Categorías enseña el gasto del periodo y su
     margen (el mismo que arriba en Movimientos); Suscripciones, lo que suman al mes las que
     esperan decisión. No dependen del día visible: su `line` es siempre la misma. */
  const subsMes=novelSubs.reduce(function(a,sp){ return a+(Number(sp.amount)||0); },0);
  const cabSecc=useMemo(function(){
    let top;
    if(secc==="cats" && !catsActual){
      // Un mes cerrado: su total con la regla de la cifra y sin margen (no hay límite del pasado).
      const mode=monthSummary.mode, m=cifra.months[catsYm]||{sp:0,inc:0}, v=gastosValor(m,mode);
      top={n:mode==="net"?Math.abs(v):v, ym:catsYm, pre:tf("gv5_cats_pre",{period:cab.etiquetaMes(catsYm)}),
        sub:mode==="net"?tf("gv5_net_sub",{g:eur(m.sp),i:eur(m.inc)}):null};
    } else if(secc==="cats"){
      const per=preset==="months"?monthLong(mad.m-1):preset==="cycle"&&!cicloPas?t("g_cycle"):monthSummary.periodLabel;
      const r=monthSummary.remaining, x=r==null?null:Math.abs(r)<1?eur(Math.abs(r)):eur0(Math.abs(r));
      // Categorías enseña siempre la cifra del presupuesto: su desglose no sigue a los filtros.
      const pres=cab.pres||cab.top;
      top={n:pres.n, sub:pres.sub, ym:cab.ciclos?cab.top.ym:catsYm, pre:tf("gv5_cats_pre",{period:per}),
        tail:r==null?null:tf(r<0?"gv5_over":"gv5_under",{x:x}), tone:r==null?null:r<0?"coral":"mint"};
    } else {
      const n=novelSubs.length;
      top={n:heavyOk?subsMes:null, ym:null, pre:!heavyOk?"":n?tf("gv5_subs_n",{n:n}):t("gv5_subs_none")};
    }
    // En Mi ciclo, Categorías lleva la misma fila de ciclos: enseña el desglose del ciclo elegido.
    const meses=secc==="cats"?(cab.ciclos||cab.mesesPres):null;
    return {top:top, line:function(){ return top; }, meses:meses, fijos:!!meses, ciclos:secc==="cats"?cab.ciclos:null};
  },[secc,cab,cifra,catsActual,catsYm,preset,cicloPas,monthSummary,novelSubs,subsMes,heavyOk,madridDay,l10nKey]);
  /* Tocar un mes salta a su primer día. Si aún no está pintado (la lista va por tandas), se
     amplía la tanda y el salto se hace al montarse el día. El mes en curso es volver arriba. */
  const diasRef=useRef(null);
  const saltoRef=useRef(null), saltoForzadoRef=useRef(null);
  const mesesListaRef=useRef(mesesLista); mesesListaRef.current=mesesLista;
  const hostDe=function(){ const r=rootRef.current; return r&&r.closest?r.closest(".page"):null; };
  const scrollHost=function(top){
    const h=hostDe(); if(!h) return;
    // Suave solo en saltos cortos: cruzar tres meses deslizando hace rodar la cifra por todos los
    // días de por medio y tarda; lejos, se aparece directamente en el mes elegido.
    const lejos=Math.abs(h.scrollTop-top)>h.clientHeight*2.5;
    h.scrollTo({top:Math.max(0,top), behavior:mcReduced()||lejos?"auto":"smooth"});
  };
  // El scroll que deja el día `k` justo bajo la cabecera ya encogida (null si aún no está montado).
  const destinoDe=function(k){
    const h=hostDe(), root=rootRef.current; if(!h||!root) return null;
    const el=root.querySelector('[data-gx-day="'+k.k+'"][data-gx-ym="'+k.ym+'"]'), head=root.querySelector(".gx-head");
    if(!el||!head) return null;
    // La raya de lectura es el borde de la cabecera YA ENCOGIDA (con la fila de meses debajo):
    // su caja no cambia de alto al encogerse, solo se suma lo que sobresale la fila de meses.
    const pad=parseFloat(getComputedStyle(h).paddingTop)||0;
    const raya=pad+head.offsetHeight+GX_MESES_SOBRE;
    return h.scrollTop+el.getBoundingClientRect().top-h.getBoundingClientRect().top-raya+2;
  };
  /* AFINAR EL SALTO cuando el scroll ha parado (rechazo de la beta 4.26.173, en Meses: «si estás
     en octubre y tocas el anterior, te lleva al día 1 y sigue sin cambiarte de mes»). Los días aún
     sin pintar (`content-visibility:auto` en `.gx-dia`) miden lo ESTIMADO (`altoEst`) y el destino
     se calcula con eso; al llegar se pintan los de alrededor con su alto real y el día pedido se
     mueve. En su móvil las filas no miden lo del Pixel 5 (letra del sistema), y el error acumulado
     de un mes de días bastaba para dejar bajo la cabecera el 1 del mes de después, con su pastilla.
     Ya pintado alrededor, la segunda medida es la buena; se repite hasta que cuadra, porque el
     ajuste puede pintar algún día más. Un dedo en la pantalla lo corta: manda él. */
  const afinaRef=useRef(0);
  const afinaSalto=function(k, min){
    const h=hostDe(); if(!h) return;
    if(afinaRef.current) cancelAnimationFrame(afinaRef.current);
    let frames=0, ajustes=0, quietos=0, st=-1;
    const corta=function(){ if(afinaRef.current) cancelAnimationFrame(afinaRef.current); afinaRef.current=0; };
    const fin=function(){ afinaRef.current=0; h.removeEventListener("touchstart",corta); };
    h.addEventListener("touchstart",corta,{passive:true, once:true});
    const paso=function(){
      if(++frames>120 || ajustes>6) return fin();
      // El salto suave sigue moviéndose: se espera a que pare (dos frames quieto).
      if(Math.abs(h.scrollTop-st)>0.5){ st=h.scrollTop; quietos=0; afinaRef.current=requestAnimationFrame(paso); return; }
      if(++quietos<2){ afinaRef.current=requestAnimationFrame(paso); return; }
      const d=destinoDe(k); if(d==null) return fin();
      const top=Math.max(d, min||0);
      const max=h.scrollHeight-h.clientHeight, want=Math.max(0,Math.min(top,max));
      if(Math.abs(h.scrollTop-want)<=1) return fin();
      ajustes++;
      // Si el ajuste deja de caber, el día pedido manda en el tope (ver abajo `saltoForzadoRef`).
      saltoForzadoRef.current=top>max+1?{k:k.k, ym:k.ym, st:Math.max(0,max), t:Date.now()}:null;
      h.scrollTo({top:want, behavior:"auto"});
      st=h.scrollTop; quietos=0;
      afinaRef.current=requestAnimationFrame(paso);
    };
    afinaRef.current=requestAnimationFrame(paso);
  };
  const saltaADia=function(k, min){
    const h=hostDe(); if(!h) return false;
    let top=destinoDe(k); if(top==null) return false;
    top=Math.max(top, min||0);
    const max=h.scrollHeight-h.clientHeight;
    /* Sin el hueco del pie, un mes del final de la lista no puede subir hasta la raya: el scroll se
       queda en el tope. La cabecera enseña entonces el día pedido mientras el scroll siga ahí
       (lo lee `GastosCabecera`); al mover el dedo vuelve a mandar lo que queda debajo. */
    saltoForzadoRef.current=top>max+1?{k:k.k, ym:k.ym, st:Math.max(0,max), t:Date.now()}:null;
    scrollHost(top);
    // Ya en el tope no hay scroll que avise a la cabecera: se le avisa a mano.
    if(saltoForzadoRef.current && Math.abs(h.scrollTop-saltoForzadoRef.current.st)<=2) h.dispatchEvent(new Event("scroll"));
    afinaSalto(k, min);
    return true;
  };
  // El salto pendiente de `eligeCiclo`, ya con la lista del ciclo elegido.
  const resuelveSaltoCiclo=function(){
    if(!cicloPasRef.current){ saltoRef.current=null; scrollHost(0); return; }
    const L=mesesListaRef.current;
    if(L.newestK==null){ saltoRef.current=null; return; }
    /* El primer día de la lista está casi arriba: dejarlo justo bajo la cabecera encogida pediría
       menos scroll del que la encoge (`compact`, más de 40 px) y la fila se escondería. Con 41 px
       el día queda igual a la vista: lo que pasa bajo la cabecera es su margen de arriba. */
    if(saltaADia({k:L.newestK, ym:L.newestYm}, 41)) saltoRef.current=null;
  };
  const irAMes=useCallback(function(ym){
    const L=mesesListaRef.current, first=L.first[ym];
    if(!first || first.i===0){ scrollHost(0); return; }
    if(saltaADia(first)) return;
    saltoRef.current=first;
    setVisible(function(v){ return Math.max(v, first.i+CONFIG.PAGE_SIZE); });
  },[]);
  /* Cambiar de sección vuelve arriba del todo (SPEC §2.2) y vibra UN toque, el mismo del cambio
     de segmento de Plan (mcTickHaptic: respeta el «sin vibración» y no repite si el tirón ya ha
     sonado). Con el tirón ya se está arriba: no hay nada que mover. */
  // Cambiar de sección también quita el filtro de categoría (SPEC §2.2).
  const irASecc=useCallback(function(id){
    if(id===seccRef.current) return;
    mcTickHaptic();
    const h=hostDe(); if(h && h.scrollTop>0) h.scrollTo({top:0, behavior:"auto"});
    setSecc(id); setCatFil(null);
  },[]);
  useTironSeccion(rootRef,{activo:true, seg:secc, orden:GX_SECC,
    // El asa de ordenar, el buscador, los meses y el rango se quedan el dedo (`stopSwipe`).
    ignora:"[data-noswipe]",
    capa:function(id){ return seccElRef.current[id]; },
    alPasar:function(id){ setSecc(id); setCatFil(null); }});
  /* CATEGORÍAS → FILTRO (SPEC §5): tocar una categoría lleva a Movimientos con esa categoría y el
     mes que enseña Categorías, arriba del todo. Las categorías de la hoja de Filtros se sueltan:
     las dos a la vez podían dejar la lista vacía sin que la píldora dijera por qué. Sin vibración:
     es un toque normal; vibra la pulsación larga, que es la que abre el límite. */
  const filtraCat=useCallback(function(id){
    const h=hostDe(); if(h && h.scrollTop>0) h.scrollTo({top:0, behavior:"auto"});
    setSel([]); setCatFil({id:id, ym:mesSelRef.current}); setSecc("movs");
  },[]);
  const quitaCatFil=useCallback(function(){ setCatFil(null); },[]);
  /* La fila de meses de Categorías y del filtro (fija, SPEC §2.1) CAMBIA el mes enseñado en vez de
     saltar en la lista; con filtro, la categoría se mantiene. El mes en curso se guarda como null. */
  const eligeMes=useCallback(function(ym){
    const v=ym===madridYmdParts(Date.now()).ym?null:ym;
    setMesSel(v);
    setCatFil(function(c){ return c&&c.ym!==v?{id:c.id, ym:v}:c; });
    const h=hostDe(); if(h && h.scrollTop>0) h.scrollTo({top:0, behavior:"auto"});
  },[]);
  /* La fila de ciclos CAMBIA el ciclo enseñado (lista, cifra y desglose a la vez); con filtro de
     categoría, se mantiene. El ciclo en curso se guarda como null. */
  const eligeCiclo=useCallback(function(key){
    const ms=+String(key).slice(1);
    /* En Movimientos, como la fila de Meses: la lista queda en el PRIMER día del ciclo tocado, bajo
       la cabecera encogida y con la fila a la vista (rechazo de la beta 4.26.173: «cuando le das un
       mes te lleva al principio del todo y se quita»). Arriba del todo la cabecera se despliega y
       la fila se esconde. El ciclo en curso sí vuelve arriba, como el mes en curso en Meses. La
       lista del ciclo nuevo aún no está pintada: el salto lo hace el efecto de abajo al montarse. */
    if(seccRef.current==="movs" && !catFilRef.current){
      saltoRef.current={ciclo:ms};
      if(ms===cicloSelRef.current) resuelveSaltoCiclo();
      setCicloSel(ms);
      return;
    }
    setCicloSel(ms);
    const h=hostDe(); if(h && h.scrollTop>0) h.scrollTo({top:0, behavior:"auto"});
  },[]);
  /* PULSACIÓN LARGA = LÍMITE (decisión del dueño, tanda 3). Con el toque ya ocupado en filtrar, el
     límite de una categoría tiene dos entradas que abren la MISMA hoja: mantener pulsada su fila
     aquí y el chip junto a la píldora del filtro. Un toque de vibración (`mcTickHaptic`, respeta
     el «sin vibración»). Se anula si el dedo se mueve (es scroll o el tirón de sección) y el click
     que llega al soltar no filtra. Punteros y no `touch*`: el mismo código sirve con ratón. */
  const largaRef=useRef(null), largaHechaRef=useRef(0);
  const largaSuelta=function(){ const l=largaRef.current; if(l){ clearTimeout(l.timer); largaRef.current=null; } };
  useEffect(function(){ return largaSuelta; },[]);
  const editCatBudgetRef=useRef(null); editCatBudgetRef.current=editCatBudget;
  const catPulsa=function(id){
    return {
      onPointerDown:function(ev){
        if(ev.button>0) return;
        largaSuelta();
        const l={x:ev.clientX, y:ev.clientY, timer:0};
        l.timer=setTimeout(function(){
          if(largaRef.current!==l) return;
          largaRef.current=null; largaHechaRef.current=Date.now()+700;
          mcSinSeleccionHastaSoltar();
          mcTickHaptic(); editCatBudgetRef.current(id);
        },GX_LARGA_MS);
        largaRef.current=l;
      },
      onPointerMove:function(ev){ const l=largaRef.current; if(l && (Math.abs(ev.clientX-l.x)>10 || Math.abs(ev.clientY-l.y)>10)) largaSuelta(); },
      onPointerUp:largaSuelta, onPointerCancel:largaSuelta, onPointerLeave:largaSuelta,
      onContextMenu:function(ev){ ev.preventDefault(); },
      // La hoja se abre con el dedo aún puesto: al soltar, el click que fabrica el navegador caería
      // en su fondo y la cerraría en el acto («toque fuera»). Sin click, la hoja se queda.
      onTouchEnd:function(ev){ if(Date.now()<largaHechaRef.current && ev.cancelable) ev.preventDefault(); },
      onClick:function(){ if(Date.now()<largaHechaRef.current) return; filtraCat(id); }
    };
  };
  useLayoutEffect(function(){
    // La lista acaba de cambiar: la cabecera vuelve a buscar los días la próxima vez que mire.
    diasRef.current=null;
    if(saltoRef.current!=null && saltoRef.current.ciclo!=null) resuelveSaltoCiclo();
    else if(saltoRef.current!=null && saltaADia(saltoRef.current)) saltoRef.current=null;
  });
  const clearFilters=function(){
    setSel([]);
    setCatFil(null);
    setBucketSel([]);
    // Borrar filtros = volver a la preselección automática de gasto diario y al periodo de entrada.
    setBankSel(diarioEnts.slice());
    setPreset(presetDef);
    setCicloSel(null);
  };
  // Elegir periodo en Filtros (o «Restablecer») vuelve al ciclo en curso.
  const ponPreset=useCallback(function(p){ setCicloSel(null); setPreset(p); },[]);
  useEffect(function(){ if(preset!=="cycle") setCicloSel(null); },[preset]);

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

  const simple=!!(state.settings&&state.settings.simpleMode);
  // Elegir categorías en la hoja suelta el filtro de la píldora: dos filtros de categoría a la vez
  // dejaban la lista vacía sin que se viera cuál sobraba.
  const setSelHoja=function(v){ setCatFil(null); setSel(v); };

  /* Lo que acompaña al periodo vive con él, en Filtros → Periodo (su sitio en el SPEC §7): la
     ayuda de Mi ciclo (QUÉ cobro ancla el ciclo; si el detectado no es el bueno, se corrige
     apuntando la nómina real como ingreso, o usando Rango…) y las fechas del Rango. Encima de la
     lista se apilaban con el desglose y «Actualizar gastos», y la lista dejaba de mandar
     (captura suya de la beta 4.26.164, 24/10). */
  const periodoExtra=preset==="cycle" ? (
    React.createElement("div",{className:"v4-cycle-box"+(cycleHelpOpen?"":" compacto"),"data-testid":"gastos-cycle-help"},
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
        cycle ? t(cycleEnabled?"g_cycle_budget_hint":"g_cycle_filter_hint") : t("g_cycle_none")))
  ) : preset==="custom" ? (
    React.createElement("div",null,
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
      }}))
  ) : null;
  /* Las tres secciones viven montadas y solo se enseña una, escondidas como los segmentos de Plan
     (`content-visibility:hidden`, ver el porqué largo en PlanTab): volver a Movimientos no vuelve a
     montar cientos de filas, y el tirón mueve la capa activa como allí. */
  const capa=function(id,hijo){
    return React.createElement("div",{key:id,className:"gx-secc","data-gx-secc":id,ref:function(el){ seccElRef.current[id]=el; },
      role:"tabpanel","aria-label":t(GX_SECC_TXT[id]),style:secc===id?null:GX_OCULTO,"aria-hidden":secc!==id}, hijo);
  };
  const catsMax=catBreakdown.reduce(function(m,r){ return Math.max(m,r.spent); },0);
  const presu=catsBudget&&monthSummary.budget>0?monthSummary.budget:null;
  const cabVista=secc==="movs"?cab:cabSecc;
  /* La píldora del filtro (SPEC §4.1) y, a su lado, el chip del LÍMITE de esa categoría: la otra
     entrada a la misma hoja que la pulsación larga. Con límite y en el periodo en que manda (mes en
     curso o Mi ciclo) dice lo que queda, con la cifra de su fila en Categorías: el filtro la suma
     con la misma regla. En un mes cerrado solo dice el límite (no hay foto del límite pasado). */
  const filCat=catFil?catOf(catFil.id):null;
  const filLim=catFil?Number((state.categoryBudgets||{})[catFil.id])||0:0;
  const filYm=catFil&&preset==="months"?(catFil.ym||mad.ym):null;
  const filManda=!!catFil&&budgetApplies&&(!filYm||filYm===mad.ym);
  const filGastado=!cifraCat?0:filYm?((cifraCat.months[filYm]||{sp:0}).sp):cifraCat.tot.sp;
  const filQueda=+(filLim-filGastado).toFixed(2);
  const filFmt=function(x){ x=Math.abs(x); return x<1?eur(x):eur0(x); };
  const filLimTxt=!(filLim>0)?t("gv5_fil_lim_poner")
    : tf("gv5_fil_lim",{x:eur0(filLim)})+(filManda?" · "+tf(filQueda<0?"gv5_fil_pasado":"gv5_fil_quedan",{x:filFmt(filQueda)}):"");
  const usado=Math.max(0,monthSummary.against||0);

  /* Con la fila de ciclos al bajar, la página tiene que poder bajar SIEMPRE lo justo para que salga:
     al empezar un ciclo hay tres gastos, no hay scroll y no habría forma de ir a un ciclo pasado
     (ver `.gx-root.gx-ciclos-al-bajar` en shell.html). */
  const ciclosAlBajar=!!(cabVista.ciclos && !cabVista.fijos);
  return React.createElement("div",{className:"v4-screen gx-root"+(ciclosAlBajar?" gx-ciclos-al-bajar":""),ref:rootRef,"data-periodo":preset,"data-secc":secc,"data-edge-capture":"1"},
    React.createElement(GastosCabecera,{rootRef:rootRef, cab:cabVista, meses:cabVista.meses, fijos:cabVista.fijos,
      onMes:cabVista.ciclos?eligeCiclo:cabVista.fijos?eligeMes:irAMes, mesesAria:cabVista.ciclos?"gv5_ciclos":"gv5_meses", stopSwipe:stopSwipe, diasRef:diasRef, saltoForzadoRef:saltoForzadoRef, secc:secc, onSecc:irASecc, nSubs:novelSubs.length,
      onInfo:secc==="subs"&&heavyOk?abreSubInfo:null}),
    capa("movs", React.createElement(React.Fragment,null,
      React.createElement("div",{className:"filters"},
        // Filtros vive PEGADO al buscador (2026-08-05): los dos acotan la misma lista de abajo,
        // así que van en la misma fila — antes el botón quedaba solo, en su propia línea entre el
        // buscador y "Sincronizar", sin pertenecer claramente a ninguno de los dos (feedback: «se
        // queda raro en medio»). Sincronizar es una acción de red (trae datos nuevos), no de
        // filtrado: va aparte, al pie de la lista (tanda 2).
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
        // Resumen de los filtros activos (categorías/bancos) + botón para quitarlos. El botón que
        // ABRE el sheet ya no vive aquí: se movió junto al buscador (ver arriba).
        nFilters>0 && React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginTop:2}},
          React.createElement("span",{style:{fontSize:12.5,color:"var(--muted)",lineHeight:1.35,flex:"1 1 120px"}}, filterParts.join(" · ")),
          React.createElement("button",{type:"button",className:"v4-chip",onClick:clearFilters,style:{padding:"8px 12px"}}, t("g_filters_clear"))
        ),
        catFil && React.createElement("div",{className:"gx-fil","data-testid":"gastos-filtro-cat"},
          React.createElement("button",{type:"button",className:"gx-fil-pil","data-cat":catFil.id,onClick:quitaCatFil,
              "aria-label":tf("gv5_fil_quitar",{x:catName(catFil.id)}),
              style:{background:(filCat.color||"#6CC688")+"26",borderColor:(filCat.color||"#6CC688")+"66",color:filCat.color}},
            React.createElement("span",{className:"gx-fil-pil-t"},catName(catFil.id)+" · "+(filYm?cab.etiquetaMes(filYm):monthSummary.periodLabel)),
            React.createElement("span",{className:"gx-fil-x","aria-hidden":true},"✕")),
          React.createElement("button",{type:"button",className:"v4-chip gx-fil-lim"+(filManda&&filLim>0&&filQueda<0?" sobre":""),"data-testid":"gastos-filtro-limite",
            onClick:function(){ editCatBudget(catFil.id); }},filLimTxt))
      ),
      React.createElement(GastosLista,{filtered:filtered, visible:visible, state:state, cifra:cifraCat||cifraFil||cifra, mode:cifraCat?"split":cifraFil?"net":monthSummary.mode,
        q:q, sel:sel, bucketSel:bucketSel, bankSelIsDefault:bankSelIsDefault, preset:preset, hayHistorico:(expensesDef||[]).length>0,
        dragExpense:dragExpense, openDetail:openDetail, startExpenseDrag:startExpenseDrag, moveExpenseDrag:moveExpenseDrag, endExpenseDrag:endExpenseDrag,
        onGoPlan:onGoPlan, onGoInversiones:onGoInversiones, simple:simple, l10nKey:l10nKey, sentinelRefCb:sentinelRefCb}))),
    /* Movimientos acaba en «Hasta aquí», sin pie: el último día ya no necesita una pantalla vacía
       debajo para llegar a la cabecera (lo resuelve la raya de `GastosCabecera` al final de la
       lista). Ese hueco, con el borde de la última tarjeta asomando bajo la cabecera, era el
       «sigue habiendo esto al final» (25/10/2026). */
    /* CATEGORÍAS (SPEC §5): el desglose que antes iba encima de la lista, con la barra del
       presupuesto arriba (solo mes en curso / Mi ciclo: sin límite en el pasado, regla de §3).
       Tocar una categoría filtra Movimientos por ella; mantenerla pulsada abre su límite (la otra
       puerta es el chip junto a la píldora del filtro). Ya no se pliega: el
       «es too much» de su pareja (10/9) era porque tapaba la lista, y aquí ya no tapa nada. */
    capa("cats", React.createElement("div",{className:"gx-cats","data-testid":"gastos-cats"},
      presu!=null && React.createElement("div",{className:"gx-cats-pres"},
        React.createElement("div",{className:"gx-cats-barra",role:"progressbar","aria-label":t("gv5_cats_pres"),"aria-valuemin":0,"aria-valuemax":presu,"aria-valuenow":+usado.toFixed(2)},
          React.createElement("i",{className:"gx-cats-in",style:{width:(Math.min(usado,presu)/Math.max(usado,presu)*100)+"%"}}),
          usado>presu && React.createElement("i",{className:"gx-cats-over",style:{width:((usado-presu)/usado*100)+"%"}})),
        React.createElement("div",{className:"gx-cats-pie"},
          React.createElement("span",null,tf("gv5_cats_of",{x:eur0(presu)})),
          React.createElement("span",null,monthSummary.periodLabel))),
      // Sin la pista no se adivina que tocar filtra y que mantener pulsado pone el límite.
      catBreakdown.length>0 && React.createElement("p",{className:"hint"},t("gv5_cats_hint")),
      catBreakdown.length===0
        ? React.createElement("div",{className:"empty"},t("gv5_cats_vacio"))
        : React.createElement("div",{className:"gx-cats-lista"},catBreakdown.map(function(row){
            const cat=catOf(row.id);
            const lim=row.limit;
            const pct=lim>0?Math.min(100, row.spent/lim*100):0;
            return React.createElement("button",Object.assign({key:row.id,type:"button",className:"v4-gastos-cat gx-cat",
                "data-cat":row.id},catPulsa(row.id)),
              React.createElement("span",{className:"gx-cat-ic","aria-hidden":true,style:{background:(cat.color||"#6CC688")+"22",color:cat.color}},cat.icon||""),
              React.createElement("span",{className:"gx-cat-txt"},
                React.createElement("span",{className:"v4-gastos-cat-row"},
                  React.createElement("span",{className:"v4-gastos-cat-name"}, catName(row.id)),
                  React.createElement("span",{className:"v4-gastos-cat-amt num"}, eur0(row.spent))),
                lim>0
                  ? React.createElement(React.Fragment,null,
                      React.createElement("span",{className:"v4-gastos-cat-hint"}, tf("v4_gastos_cat_limit",{x:eur0(lim)})),
                      React.createElement("span",{className:"bar",role:"progressbar","aria-valuemin":0,"aria-valuemax":lim,"aria-valuenow":row.spent},
                        React.createElement("i",{style:{width:pct+"%",background:cat.color||"var(--mint)"}})))
                  // Sin límite, la barra es relativa a la categoría que más lleva: solo compara.
                  : React.createElement("span",{className:"gx-cat-rel","aria-hidden":true},
                      React.createElement("i",{style:{width:(catsMax>0?row.spent/catsMax*100:0)+"%",background:cat.color||"var(--mint)"}}))));
          })))),
    /* SUSCRIPCIONES (SPEC §6): bandeja de las que piden decisión (activas, sin pasar a Recibos, sin
       descartar ni dar de baja), una tarjeta por cada una y su ficha al tocarla. Vacía, lo dice en
       vez de dejar la sección en blanco. Mientras la detección no ha corrido (`heavyOk`, se
       difiere a propósito) no se afirma nada. */
    capa("subs", React.createElement("div",{className:"gx-subs","data-testid":"gastos-subs"},
      !heavyOk ? null
      : novelSubs.length
        ? React.createElement("div",{className:"gx-subs-lista"},
            novelSubs.map(function(sp){ return React.createElement(GxSubTarjeta,{key:sp.key,sp:sp,vuelve:!!subsBaja&&subsBaja[sp.key]!=null,onOpen:abreSub}); }))
        : React.createElement("div",{className:"gx-vacio"},
            React.createElement("div",{className:"gx-vacio-ic","aria-hidden":true},"✓"),
            React.createElement("div",{className:"gx-vacio-t serif"},t("gv5_subs_ok_t")),
            React.createElement("div",{className:"gx-vacio-d"},t("gv5_subs_ok_d"))))),
    React.createElement(GxSubFicha,{f:subFicha, onClose:cierraSub, onRecibos:subARecibos, onBaja:subBaja, onNo:subNo}),
    React.createElement(GxSubInfo,{open:subInfo, onClose:cierraSubInfo}),
    React.createElement(GastosFilterSheet,{
      open:filterOpen, onClose:function(){ setFilterOpen(false); },
      sel:sel, setSel:setSelHoja, bankSel:bankSel, setBankSel:setBankSel,
      bucketSel:bucketSel, setBucketSel:setBucketSel,
      bankOpts:bankOpts, diarioEnts:diarioEnts, debts:state.debts,
      preset:preset, setPreset:ponPreset, presetDef:presetDef, periodoExtra:periodoExtra,
      masGastadas:masGastadas, nVer:filtered.length, lastSync:state.lastSync
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
      setCat:setCat, setCuota:setCuota, setMeta:setMeta, setReceipt:setReceipt, quitarRecibo:quitarRecibo, setCardFlag:setCardFlag, setBank:setBank, delExpense:delExpense, saveEdit:saveEdit, saveNote:saveNote,
      resolveDup:resolveDup, separarGemelo:separarGemelo, recognizeWithdrawal:recognizeWithdrawal, withdrawalStatus:withdrawalStatus,
      showToast:showToast, aiBusy:aiBusy, suggestAi:suggestAi, state:state
    }),
    undoDelete && ReactDOM.createPortal(
      React.createElement("div",{className:"v4-undo-toast",role:"status","data-testid":"expense-undo"},
        React.createElement("span",null,t(undoDelete.paired?"g_auto_deleted":"f_undo_deleted")),
        React.createElement("button",{type:"button",onClick:undoLastDelete},t("f_undo"))),document.body)
  );
}

/* Secciones de Gastos v5 en el orden del tirón (fijo: ver `useTironSeccion`) y su nombre. */
const GX_SECC=["movs","cats","subs"];
const GX_SECC_TXT={movs:"gv5_sec_movs", cats:"gv5_sec_cats", subs:"gv5_sec_subs"};
// Mismo escondite que los segmentos de Plan (ver el porqué medido en PlanTab).
const GX_OCULTO={height:0,overflow:"hidden",contentVisibility:"hidden",pointerEvents:"none"};
// Lo que hay que mantener pulsada una categoría para abrir su límite: más que un toque rápido
// (~100–200 ms) y antes de que Android ofrezca su menú (~500 ms), que de todas formas se anula.
const GX_LARGA_MS=450;
/* La hoja que abre una pulsación larga sale con el dedo AÚN PUESTO, y Android sigue con su gesto
   de mantener: seleccionaba el texto que quedaba bajo el dedo en la hoja recién abierta (el título
   «…restaurantes» en azul con sus asas) y sacaba «Copiar · Seleccionar todo» (vídeo suyo, 25/10).
   La hoja va en un portal, fuera de `.gx-root`, así que su `user-select:none` no la cubre. Hasta
   que se levanta el dedo (y un momento más, lo que tarda en llegar el menú) nada de la página se
   puede seleccionar (`html.mc-sin-sel`), ni empezar una selección ni abrir el menú contextual;
   los campos de texto vuelven a poder seleccionarse en cuanto se suelta. */
function mcSinSeleccionHastaSoltar(){
  const html=document.documentElement;
  const corta=function(ev){ if(ev.cancelable) ev.preventDefault(); };
  let hecho=false;
  const fin=function(){
    if(hecho) return; hecho=true;
    setTimeout(function(){
      html.classList.remove("mc-sin-sel");
      document.removeEventListener("selectstart",corta,true);
      document.removeEventListener("contextmenu",corta,true);
      try{ const s=window.getSelection&&window.getSelection(); if(s&&!s.isCollapsed) s.removeAllRanges(); }catch(e){}
    },400);
    document.removeEventListener("touchend",fin,true);
    document.removeEventListener("touchcancel",fin,true);
    document.removeEventListener("pointerup",fin,true);
    document.removeEventListener("pointercancel",fin,true);
  };
  html.classList.add("mc-sin-sel");
  document.addEventListener("selectstart",corta,true);
  document.addEventListener("contextmenu",corta,true);
  document.addEventListener("touchend",fin,true);
  document.addEventListener("touchcancel",fin,true);
  document.addEventListener("pointerup",fin,true);
  document.addEventListener("pointercancel",fin,true);
}
/* LA LISTA DE MOVIMIENTOS, EN SU PROPIO MEMO (Gastos v5, tanda 2, 24/10/2026). Cambiar de sección
   (Movimientos / Categorías / Suscripciones) es estado de Expenses, y sin esto cada cambio volvía a
   recorrer los días pintados (cajón, recibo y deuda de cada fila) y a construir la lista entera
   aunque no cambiara nada (AGENTS §7 bis). Todo lo que recibe es estable mientras no cambien los
   datos, los filtros o la tanda pintada: las callbacks van en `useCallback` y nada viaja como
   `Date`. Si añades una prop, que sea estable, o el memo queda de adorno. */
const GastosLista=React.memo(function GastosLista({filtered, visible, state, cifra, mode, q, sel, bucketSel, bankSelIsDefault, preset, hayHistorico,
    dragExpense, openDetail, startExpenseDrag, moveExpenseDrag, endExpenseDrag, onGoPlan, onGoInversiones, simple, l10nKey, sentinelRefCb}){
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
    const bucket=expenseBucket(e, state), gris=grisDeGasto(e, bucket);
    const l=e.debtId&&filterSelLabel("debt:"+e.debtId,state.debts);
    // En una aportación, la «etiqueta» es la meta (o el bróker): la fila suelta (buscando) y la gris dicen cuál.
    const recibo=gris==="meta"?metaEtiqueta(state,e):gris==="inversion"?inversionEtiqueta(state,e):reciboEtiqueta(state,e);
    if(agrupa && gris){
      let g=dia.gris.find(function(x){ return x.kind===gris; });
      if(!g){ g={kind:gris, items:[], total:0}; dia.gris.push(g); }
      g.items.push({e:e, ms:ms, sub:gris==="deuda"?(l||catName("deudas")):recibo});
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
    if(!d || !(d.sp>0) && !(mode==="net"&&d.inc>0)) return null;
    const v=gastosValor(d,mode);
    return (v<0?"+":"")+eur(Math.abs(v));
  };
  return (
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
                            const esVacioNormal=sinFiltros && hayHistorico && preset==="cycle";
              return React.createElement("div",{className:"empty"},
                React.createElement("div",{className:"ttl"}, esVacioNormal?t("g_empty_period_t"):t("g_empty_t")),
                esVacioNormal?t("g_empty_period_d"):t("g_empty_d"));
            })()
          : dias.map(function(d){
              const tot=totalDia(d.k,d.ym);
              /* Alto estimado del día para `content-visibility:auto` (ver `.gx-dia` en shell.html).
                 Los días que aún no se han pintado nunca ocupan esto; si la estimación fuese un
                 alto fijo y corto, la lista pesaría menos de lo que mide de verdad, el centinela
                 seguiría dentro de sus 2.000 px tras cada tanda y el observador —que solo avisa
                 al CAMBIAR— no volvería a pedir más (pasó al probarlo el 25/10: se quedaba en 132
                 filas). Con filas y grises contadas el error es de unos px por día. `auto` hace
                 que, una vez pintado, recuerde el alto real. */
              const altoEst=GX_DIA_CAB+d.rows.length*GX_FILA_ALTO+d.gris.length*GX_GRIS_ALTO;
              return React.createElement("section",{key:d.k+"|"+d.ym,className:"gx-dia","data-gx-day":d.k,"data-gx-ym":d.ym,
                  style:{containIntrinsicSize:"auto "+altoEst+"px"}},
                React.createElement("div",{className:"gx-dia-h"},
                  React.createElement("span",{className:"gx-dia-t"},etiquetaDia(d)),
                  tot && React.createElement("span",{className:"gx-dia-tot num","data-testid":"gastos-dia-total"},tot)),
                d.rows.map(function(g){
                  return React.createElement(MovRow,{key:g.e.id||g.ms, e:g.e, ms:g.ms, l:g.l, onOpen:openDetail, l10n:l10nKey,
                    bucket:g.bucket,recibo:g.recibo,dragging:!!(dragExpense&&dragExpense.from===g.e.id),
                    dragOver:!!(dragExpense&&dragExpense.to===g.e.id&&dragExpense.from!==g.e.id),
                    onDragStart:startExpenseDrag,onDragMove:moveExpenseDrag,onDragEnd:endExpenseDrag});
                }),
                d.gris.slice().sort(function(a,b){ return GX_GRIS[a.kind].ord-GX_GRIS[b.kind].ord; }).map(function(g){
                  return React.createElement(GastosGris,{key:d.k+"|"+g.kind, g:g, onOpen:openDetail, onGoPlan:onGoPlan, onGoInversiones:onGoInversiones, simple:simple});
                }));
            }),
        visible<filtered.length && React.createElement("div",{className:"sentinel",ref:sentinelRefCb},t("g_loadmore")),
        // El final de la lista dice hasta dónde llega el histórico: sin esto no se sabe si no hay
        // más o si falta por cargar (SPEC §4, «Hasta aquí: 1 de agosto»).
        shown.length>0 && visible>=filtered.length && React.createElement("div",{className:"gx-fin"},
          tf("gv5_end",{d:new Date(dateMs(filtered[filtered.length-1].date)).toLocaleDateString(loc(),{day:"numeric",month:"long",year:"numeric"})}))
      )
    )
  );
});

/* Lo que la fila de meses sobresale por debajo de la caja de la cabecera cuando se encoge (px).
   Tiene que cuadrar con `.gx-head.compact.con-meses::before` y `.gx-meses` en shell.html. */
const GX_MESES_SOBRE=36;
/* Altos (px) con los que se estima un día de Movimientos antes de pintarlo: cabecera del día
   (padding 18 + título), fila normal (~90 con la línea de abajo + hueco de 6; medido con
   Pixel 5) y franja gris cerrada (48 + 2 de borde + 6). Tienen que seguir a `.gx-dia`, `.gx-list .v4-mov` y `.gx-gris-h` en shell.html. */
const GX_DIA_CAB=46, GX_FILA_ALTO=96, GX_GRIS_ALTO=56;
/* Sin fila de meses (Mi ciclo sin ciclos detectados, Rango, Todo) el fondo encogido se QUEDA DENTRO de la caja: la cifra
   y la línea suben al encogerse y lo que quedaba debajo era hueco. Rechazo suyo de la beta
   4.26.164 (24/10, Mi ciclo + balance): el fondo seguía bajando 36 px para unos meses que no
   existen y tapaba la lista con una franja vacía. Cuadra con `.gx-head.compact::before`. */
const GX_SIN_MESES_RECORTE=16;
/* Con la fila de meses FIJA (Categorías y filtro de categoría, SPEC §2.1) la fila va dentro de la
   caja, que crece lo que ella mide: no sobresale y no hay nada que sumar. */
/* Ciclos pasados que se buscan hacia atrás en Mi ciclo: un año, de sobra para mirar atrás sin
   recorrer el histórico entero en cada cambio. */
const GX_CICLOS_MAX=12;
// «31 ago»: el día corto de las líneas de la cabecera y del rango de los ciclos.
function gxDiaCorto(ms){ const d=new Date(ms); return d.getDate()+" "+monthShort(d.getMonth()).toLowerCase(); }
function gxRayaExtra(compact, conMeses, fijos){ return !compact||fijos?0:conMeses?GX_MESES_SOBRE:-GX_SIN_MESES_RECORTE; }
/* CABECERA DE GASTOS v5 (SPEC §2.1 y §3). Componente propio a propósito: la cifra cambia con el
   día que queda debajo al bajar, y ese cambio NO puede re-renderizar Expenses ni la lista
   (cientos de filas): el día visible es estado SOLO de esta cabecera. Encogerse es `transform` y
   `opacity` sobre una caja de alto fijo: bajar no recoloca nada de la lista. El scroll se lee en
   un `requestAnimationFrame` y el día se busca por bisección entre los encabezados ya pintados,
   así cada frame cuesta unas pocas lecturas aunque haya meses enteros cargados. */
function GastosCabecera({rootRef, cab, meses, fijos, onMes, mesesAria, stopSwipe, diasRef, saltoForzadoRef, secc, onSecc, nSubs, onInfo}){
  const [vista,setVista]=useState({k:null, ym:null, compact:false});
  const headRef=useRef(null), mesesRef=useRef(null), calcRef=useRef(null);
  // El cálculo vive en un efecto montado una vez: lee si hay meses por ref, no por cierre viejo.
  const conMesesRef=useRef(!!meses); conMesesRef.current=!!meses;
  const fijosRef=useRef(!!fijos); fijosRef.current=!!fijos;
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
      let raya=head.getBoundingClientRect().bottom+gxRayaExtra(compact,conMesesRef.current,fijosRef.current)+1;
      /* AL FINAL DE LA LISTA los últimos días no pueden subir hasta la raya (debajo no hay nada que
         scrollear). Antes se les dejaba una pantalla vacía debajo para que subieran, y él lo vio
         como un fallo: el borde de la última tarjeta asomando bajo la cabecera y un hueco enorme
         (captura del 25/10/2026). Ahora, en el último tramo del scroll, la raya BAJA a la vez que
         sube la lista, y con todo bajado llega al último día: cada día sigue pasando por la
         cabecera una vez y en orden, sin hueco. Con la lista aún por cargar (centinela) no aplica. */
      if(els.length && !root.querySelector(".gx-list .sentinel")){
        const max=host.scrollHeight-host.clientHeight, quedan=Math.max(0,max-host.scrollTop);
        const falta=els[els.length-1].getBoundingClientRect().top-quedan-raya;
        const tramo=Math.min(falta,max);
        if(falta>0 && tramo>0 && quedan<tramo) raya+=falta*(1-quedan/tramo);
      }
      let lo=0, hi=els.length-1, at=-1;
      while(lo<=hi){ const mid=(lo+hi)>>1; if(els[mid].getBoundingClientRect().top<=raya){ at=mid; lo=mid+1; } else hi=mid-1; }
      let k=at>=0?+els[at].getAttribute("data-gx-day"):null, ym=at>=0?els[at].getAttribute("data-gx-ym"):null;
      // El salto a un mes del final (ver `saltaADia`): en el tope manda el día pedido. Se olvida al
      // salir del tope ya llegado, o si no llega (un dedo cortó el scroll suave).
      const sf=saltoForzadoRef&&saltoForzadoRef.current;
      if(sf){
        if(Math.abs(host.scrollTop-sf.st)<=2){ sf.llego=true; k=sf.k; ym=sf.ym; }
        else if(sf.llego || Date.now()-sf.t>1500) saltoForzadoRef.current=null;
      }
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
    if(vista.compact || fijos){
      const want=x-(box.clientWidth-w)/2;
      if(Math.abs(box.scrollLeft-want)>2) box.scrollTo({left:Math.max(0,want),behavior:mcReduced()?"auto":"smooth"});
    }
  },[ymSel, vista.compact, fijos, meses&&meses.length, l10nKeyOf()]);
  const tone=line.tone?" gx-tone-"+line.tone:"";
  const mesesVis=vista.compact||!!fijos;
  // `data-gx-vista` (el día que manda en la cabecera) es para los e2e: al final de la lista ya no
  // se puede calcular a mano qué scroll pone un día debajo de la cabecera.
  return React.createElement("div",{className:"gx-head"+(vista.compact?" compact":"")+(meses?" con-meses":"")+(fijos?" meses-fijos":""),ref:headRef,
      "data-gx-vista":vista.k==null?"":vista.k+"|"+vista.ym},
    React.createElement("div",{className:"gx-titulo"},
      React.createElement("h1",{className:"v4-title serif"}, t("v4_gastos_title")),
      React.createElement(GxSecciones,{secc:secc, onSecc:onSecc, nSubs:nSubs})),
    React.createElement(GxCifra,{n:line.n}),
    React.createElement("div",{className:"gx-status"+(onInfo?" con-info":""),"data-testid":"gastos-estado"},
      React.createElement("span",null,line.pre),
      line.tail ? React.createElement(React.Fragment,null," · ",React.createElement("span",{className:"gx-tail"+tone},line.tail)) : null,
      // La «i» de Suscripciones (SPEC §6.3), la misma que la de la gráfica de Inicio. La letra la
      // pone el CSS: así el texto de la línea de estado sigue siendo solo la frase.
      onInfo ? React.createElement("button",{type:"button",className:"v42-net-info gx-info","aria-label":t("gv5_sub_info"),"aria-haspopup":"dialog","data-testid":"subs-info",onClick:onInfo}) : null),
    // En balance la línea existe siempre (aunque vacía): la caja no cambia de alto al bajar.
    cab.top.sub!=null && React.createElement("div",{className:"gx-status gx-status-sub","data-testid":"gastos-desglose"},line.sub||""),
    meses && React.createElement("div",Object.assign({className:"gx-meses",ref:mesesRef,role:"group","aria-label":t(mesesAria||"gv5_meses"),"aria-hidden":!mesesVis,"data-testid":"gastos-meses"},stopSwipe),
      pasti && React.createElement("span",{className:"gx-mes-pasti","aria-hidden":true,style:{width:pasti.w,transform:"translateX("+pasti.x+"px)"}}),
      meses.map(function(m){
        const on=m.ym===ymSel;
        return React.createElement("button",{key:m.ym,type:"button",className:"gx-mes"+(on?" on":""),"data-ym":m.ym,"aria-pressed":on,
          tabIndex:mesesVis?0:-1,onClick:function(){ onMes(m.ym); }}, m.label);
      }))
  );
}
function l10nKeyOf(){ return CURLANG+"|"+DISP.sym; }
/* LOS TRES ICONOS DE SECCIÓN (SPEC §2.1): Movimientos (líneas), Categorías (barras) y
   Suscripciones (reloj con flecha = «se repite»), con el globito de las que esperan decisión.
   Son pestañas de verdad (`role="tab"`, `aria-selected`) y cada una dice su nombre: el icono solo
   no se entiende con un lector de pantalla. */
const GX_SECC_ICO={
  movs:["M4 7h16M4 12h12M4 17h8"],
  cats:["M6 20v-6M12 20V4M18 20v-10"],
  subs:["M3.5 12a8.5 8.5 0 1 0 2.5-6","M3 3v4h4","M12 8v4l3 2"]
};
function GxSecciones({secc, onSecc, nSubs}){
  return React.createElement("div",{className:"gx-secciones",role:"tablist","aria-label":t("gv5_secciones")},
    GX_SECC.map(function(id){
      const on=secc===id, globo=id==="subs"&&nSubs>0;
      return React.createElement("button",{key:id,type:"button",role:"tab","aria-selected":on,"data-gx-tab":id,
          className:"gx-sec"+(on?" on":""),"aria-label":t(GX_SECC_TXT[id])+(globo?" · "+tf("gv5_subs_globo",{n:nSubs}):""),
          onClick:function(){ onSecc(id); }},
        React.createElement("svg",{"aria-hidden":true,width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round"},
          GX_SECC_ICO[id].map(function(d){ return React.createElement("path",{key:d,d:d}); })),
        globo && React.createElement("span",{className:"gx-sec-globo num","aria-hidden":true,"data-testid":"gastos-subs-globo"},nSubs>99?"99+":nSubs));
    }));
}
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
/* FILA GRIS: los cargos de un día que pagan recibos o cuotas, o que van a una meta o a un bróker (SPEC §4.4). Se
   ven, no suman al día ni a la cifra (ya cuentan en el Plan, o son dinero tuyo que cambia de sitio), y se despliegan con un solo toque
   de vibración. Cada cargo sigue abriendo su ficha: ahí viven «No es este recibo» y «no es la
   cuota», que no se pueden quedar sin camino por plegarlos. El estado de abierto es de la fila:
   abrir una no repinta la lista. */
// Orden en el día: Recibos, Deudas y Metas, el mismo que los segmentos de Plan; Inversiones al
// final, que no es del Plan sino de Cartera (`cartera`: su enlace va a `onGoInversiones`).
const GX_GRIS={recibo:{lab:"v4_plan_recibos",seg:"recibos",ord:0}, deuda:{lab:"v4_plan_deudas",seg:"deudas",ord:1}, meta:{lab:"v4_plan_metas",seg:"metas",ord:2},
  inversion:{lab:"tab_inv",cartera:true,ord:3}};
/* ¿Va este cargo a una fila gris? → su clase, o null. Sale del cajón (`expenseBucket`), así que no
   cambia qué cuenta: solo cómo se pinta. Las inversiones son el cajón «neutra» pero SOLO la
   categoría Inversión y solo lo que sale (25/10/2026): un traspaso entre cuentas propias o una
   cuota sin deuda no son inversiones, y el rótulo tiene que decir la verdad de lo que agrupa; y
   una venta o un rescate (entra dinero) no puede sumarse a un total de aportaciones. Esos siguen
   como tarjeta atenuada con su «no es un gasto». */
function grisDeGasto(e, bucket){
  if(bucket==="recibo"||bucket==="deuda"||bucket==="meta") return bucket;
  if(bucket==="neutra" && e && e.category==="inversion" && (e.amount||0)>0) return "inversion";
  return null;
}
function GastosGris({g, onOpen, onGoPlan, onGoInversiones, simple}){
  const [open,setOpen]=useState(false);
  const def=GX_GRIS[g.kind];
  const toggle=function(){ setOpen(function(o){ return !o; }); mcTickHaptic(); };
  // En modo sencillo Plan solo tiene Recibos: «Abrir en Plan · Deudas» llevaría a otro sitio. Y
  // Cartera no enseña inversiones: el enlace llevaría a un bloque que no está.
  const ir=def.cartera?onGoInversiones:onGoPlan;
  const conPlan=!!ir && (!simple || g.kind==="recibo");
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
        conPlan && React.createElement("button",{type:"button",className:"gx-gris-plan",tabIndex:open?0:-1,onClick:function(){ ir(def.seg); }},
          (def.cartera?t("gv5_cartera_open"):tf("gv5_plan_open",{x:t(def.lab)}))+" ›")))
  );
}

/* La hora de «Última sincronización» escucha la lectura de la nube por su cuenta (19/10/2026): una lectura sin
   cambios ya no reescribe `state.lastSync` (ver `mcSetLecturaNube`), y pasarla como prop de
   Expenses la reconstruiría entera en cada vuelta a primer plano, que es lo que se quitó.
   Desde que no hay botón (Gastos v5) es lo único que dice lo frescos que están los gastos. */
function SyncHora({lastSync}){
  const [leida,setLeida]=useState(0);
  useEffect(function(){ return mcOnLecturaNube(setLeida); },[]);
  const at=Math.max(lastSync||0, leida||0);
  return React.createElement("div",{className:"sync-note","data-testid":"gastos-lectura"},
    React.createElement("span",{className:"sync-dot"+(at?"":" idle")}),
    at?tf("g_lastsync",{d:new Date(at).toLocaleString(loc(),{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}):t("g_nosync"));
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
  const skip=bucket==="neutra"||bucket==="otrobanco"||bucket==="posible"||bucket==="deuda"||bucket==="recibo"||bucket==="meta";
  // El recibo dice CUÁL es, y si solo lo parece lo pregunta: «no cuenta» a secas haría dudar. La
  // aportación, igual: a qué meta va.
  // Una aportación a un bróker dice adónde fue si se sabe (`inversionEtiqueta`); si no, «no es un gasto».
  const skipTxt=!skip?"":(bucket==="recibo"||bucket==="meta"||(bucket==="neutra"&&recibo)?recibo:t("g_skip_"+bucket));
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
/* Hoja de Filtros definitiva (Gastos v5, SPEC §7): Periodo, Qué contar, Bancos y Categorías, con
   «Restablecer» arriba y un solo botón abajo que dice cuántos movimientos va a enseñar. Los
   filtros se aplican al tocarlos, como siempre: el botón solo cierra, y su número es el de la
   lista que queda debajo (`nVer`), no una cuenta aparte que pudiera no cuadrar con ella. */
function GastosFilterSheet({open, onClose, sel, setSel, bankSel, setBankSel, bucketSel, setBucketSel, bankOpts, diarioEnts, debts, preset, setPreset, presetDef, periodoExtra, masGastadas, nVer, lastSync}){
  const swipe=useSheetSwipe(!!open, onClose);
  useBackClose(!!open, swipe.close);
  const [qCat,setQCat]=useState("");
  const [filterCatsOpen,setFilterCatsOpen]=useState(false);
  useEffect(function(){
    if(open){ setQCat(""); setFilterCatsOpen(false); }
  },[open]);
  /* Las categorías en las que MÁS SE HA GASTADO en el periodo que se ve, en el orden de la vista
     Categorías (`masGastadas` sale de su mismo desglose). Hasta la t5 se contaban por número de
     movimientos y salían Ingreso, Traspaso y Otros delante de Viajes (rechazo suyo, 25/10/2026:
     «¿no deberían salir las que más he gastado?»). Se fija al ABRIR la hoja (solo depende de
     `open` a propósito): si el orden cambiara con la hoja abierta, el dedo acabaría en otra. */
  const usadas=useMemo(function(){ return open?(masGastadas||[]).slice():[]; },[open]);
  if(!open) return null;
  /* `deudas` sigue siendo la marca interna que evita contar dos veces la cuota, pero no se pinta
     como categoría normal: cada deuda del Plan tiene su filtro propio (feedback 24/9). */
  const debtList=(debts||[]).filter(function(d){ return d && d.id; });
  const allCats=CATEGORIES.concat([INGRESO_CAT,INVERSION_CAT,TRASPASO_CAT]);
  const needle=qCat.trim().toLowerCase();
  const cats=needle
    ? allCats.filter(function(c){ return catName(c.id).toLowerCase().indexOf(needle)!==-1 || c.id.indexOf(needle)!==-1; })
    : allCats;
  const toggle=function(setter,id){
    setter(function(prev){
      return prev.indexOf(id)!==-1?prev.filter(function(x){ return x!==id; }):prev.concat([id]);
    });
  };
  const toggleCat=function(id){ toggle(setSel,id); };
  const clearAll=function(){
    setSel([]);
    setBucketSel([]);
    // Igual que el chip de «Limpiar»: volver a los bancos de gasto diario y al periodo de entrada.
    setBankSel(diarioEnts.slice());
    setPreset(presetDef);
  };
  /* Las cinco de más gasto, en orden fijo mientras la hoja está abierta (si saltaran al marcarlas,
     el dedo acabaría en otra). Una marcada desde «Las N» que no sea de ellas se añade al final: si
     no, al plegar la lista no se vería qué categoría está filtrando. */
  const top=[];
  usadas.forEach(function(id){ const c=top.length<5&&allCats.find(function(x){ return x.id===id; }); if(c) top.push(c); });
  sel.forEach(function(id){ const c=allCats.find(function(x){ return x.id===id; }); if(c&&top.indexOf(c)===-1) top.push(c); });
  // El ✓ va escondido al lector: el nombre del botón es el del banco o la categoría, y su estado el `aria-pressed`.
  const chip=function(key,on,onClick,label,ic){
    return React.createElement("button",{key:key,type:"button",className:"v4-chip gx-fchip"+(on?" on":""),"aria-pressed":on,onClick:onClick,"data-fil":key},
      on && React.createElement("span",{"aria-hidden":true},"✓"),
      ic && React.createElement("span",{"aria-hidden":true,className:"gx-fchip-ic"},ic), label);
  };
  const lab=function(k){ return React.createElement("div",{className:"gx-fil-lab"},t(k)); };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet v4-gastos-filter-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); },style:{maxHeight:"88vh"}}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"gx-fil-top"},
          React.createElement("div",{className:"serif",style:{fontSize:22,fontWeight:550}}, t("g_filters")),
          React.createElement("button",{type:"button",className:"gx-fil-reset",onClick:clearAll}, t("gv5_fil_reset"))),
        /* PERIODO (Gastos v5, 20/10/2026). Los botones Este mes / Mi ciclo / Más… salieron de la
           pantalla: los meses son ahora la fila que aparece al bajar, y Mi ciclo, Rango y Todo
           viven aquí. Mi ciclo no se puede perder: es la forma de mirar el gasto de quien no
           cobra el día 1 (petición de su pareja, 11/7). */
        lab("gv5_periodo"),
        React.createElement("div",{className:"gx-periodo",role:"radiogroup","aria-label":t("gv5_periodo")},
          [["months","gv5_p_months"],["cycle","g_cycle"],["custom","gv5_p_range"],["all","g_all"]].map(function(p){
            const on=preset===p[0];
            return React.createElement("button",{key:p[0],type:"button",role:"radio","aria-checked":on,className:"gx-periodo-op"+(on?" on":""),
              "data-periodo":p[0],onClick:function(){ setPreset(p[0]); }}, t(p[1]));
          })),
        periodoExtra && React.createElement("div",{className:"gx-periodo-extra"},periodoExtra),
        /* QUÉ CONTAR: los tres cajones que separan lo que cuenta de lo que no («hay bastante caos
           entre gastos que cuentan, ingresos y movimientos que no cuentan»). Ninguno marcado = todo,
           como antes con el chip «Todo», que el diseño quita porque decía lo mismo que no marcar.
           SIN chip «De otros bancos» (rechazo suyo, 2026-08-17): los bancos de abajo ya hacen eso;
           el cajón `otrobanco` sigue siendo el que hace que la fila diga «no es del día a día». */
        lab("g_bk_title"),
        React.createElement("div",{className:"gx-fil-chips"},
          ["cuenta","ingreso","neutra"].map(function(b){
            return chip(b, bucketSel.indexOf(b)!==-1, function(){ toggle(setBucketSel,b); }, t("g_bk_"+b));
          })),
        /* BANCOS: arranca en TODOS los de gasto diario (contrato suyo del 16/9). «Todos los bancos»
           se queda aunque el diseño no lo pinte: es la ampliación explícita al histórico entero. */
        bankOpts.length>0 && React.createElement(React.Fragment,null,
          lab("g_filters_banks"),
          React.createElement("div",{className:"gx-fil-chips"},
            chip("_todos", bankSel.length===0, function(){ setBankSel([]); }, t("g_allbanks")),
            bankOpts.map(function(b){
              return chip(b, bankSel.indexOf(b)!==-1, function(){ toggle(setBankSel,b); }, b==="_manual"?t("g_bank_manual"):entOf(b).label);
            }))),
        /* CATEGORÍAS: las más usadas a mano y el resto detrás de «Las N», con su buscador y las
           mismas fichas que Apuntar (rechazo 23/9: los chips sueltos parecían otro sistema). */
        lab("g_filters_cats"),
        React.createElement("div",{className:"gx-fil-chips"},
          top.map(function(c){ return chip("c:"+c.id, sel.indexOf(c.id)!==-1, function(){ toggleCat(c.id); }, catName(c.id), c.icon); }),
          React.createElement("button",{type:"button",className:"v4-chip gx-fchip gx-fchip-mas v4-filter-cats-toggle","aria-expanded":filterCatsOpen,
              "aria-controls":"gastos-filter-cats-body",onClick:function(){ setFilterCatsOpen(function(v){ return !v; }); }},
            tf("gv5_fil_todas",{n:allCats.length})+(filterCatsOpen?" ▾":" ›"))),
        React.createElement("div",{className:"v4-filter-cats gx-fcats"+(filterCatsOpen?" abierto":"")},
          React.createElement("div",{id:"gastos-filter-cats-body",className:"v4-filter-cats-body","aria-hidden":!filterCatsOpen},
            React.createElement("div",{className:"v4-filter-cats-inner"},
              React.createElement("div",{className:"searchbar",style:{margin:"12px 0"}},
                React.createElement("span",{className:"searchbar-ic"},"🔍"),
                React.createElement("input",{className:"searchbar-in",type:"search",placeholder:t("g_filters_search"),value:qCat,onChange:function(e){ setQCat(e.target.value); }}),
                qCat && React.createElement("button",{className:"searchbar-x",type:"button",onClick:function(){ setQCat(""); }},"✕")
              ),
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
                  lab("g_filters_debts"),
                  React.createElement(ExpenseCategoryGrid,{items:ds.map(function(d){ return {id:"debt:"+d.id,icon:DEUDA_CAT.icon,label:d.name||catName("deudas")}; }),
                    selectedMany:sel,onPick:toggleCat,testPrefix:"filtro-deudas"})
                );
              })()
            )
          )
        ),
        React.createElement("button",{type:"button",className:"btn btn-primary btn-block gx-fil-ver",onClick:onClose},
          tf("gv5_fil_ver",{x:tf(nVer===1?"gv5_fil_n1":"gv5_fil_n",{n:nVer.toLocaleString(loc())})})),
        /* Aquí acaba «Actualizar gastos» (decisión del dueño, 20/10/2026): la nube se lee sola al
           abrir y al volver a la app, así que el botón ya no hacía nada que no pasara solo. Lo que
           sí se conserva es saber de cuándo son los gastos y que eso no pregunta al banco (UX-15). */
        React.createElement(SyncHora,{lastSync:lastSync}),
        React.createElement("p",{className:"hint gx-fil-nube"},t("gv5_fil_nube"))
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
function ExpenseDetailSheet({exp, editExp, setEditExp, onClose, setCat, setCuota, setMeta, setReceipt, quitarRecibo, setCardFlag, setBank, delExpense, saveEdit, saveNote, resolveDup, separarGemelo, showToast, aiBusy, suggestAi, state, recognizeWithdrawal, withdrawalStatus}){
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
  // Metas a las que se puede aportar: las abiertas, y la que ya tiene aunque esté cumplida.
  const metaActual=exp.goalId?(state.goals||[]).find(function(g){ return g&&g.id===exp.goalId; }):null;
  const metaOpciones=(state.goals||[]).filter(function(g){ return g&&g.id&&(!g.done||g.id===exp.goalId); });
  const metaOtraMarca=!exp.goalId&&esFilaDeBanco(exp)&&(!!exp.debtId||!!exp.reciboId);
  const metaRowOn=!!exp.goalId||((metaAdmiteMarca(exp)||metaOtraMarca)&&(state.goals||[]).length>0);
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
    /* «Es aportación a una meta» (24/10/2026). Sale en los cargos del banco que pueden llevarla y en
       los que ya la llevan (si no, quitarla no tendría camino). En una cuota o un recibo se ve, pero
       explica por qué no se puede: una marca por gasto. Un apunte a mano no la ofrece: para eso está
       «Aportar» en la meta, y esta marca solo sabe viajar en las filas del banco. */
    !isIncome && metaRowOn && React.createElement(React.Fragment,null,
      React.createElement("button",{type:"button",className:"v4-ficha-adjust-row","data-testid":"exp-meta",onClick:function(){ setAdjustOpen(adjustOpen==="meta"?null:"meta"); }},
        React.createElement("span",null,t("f_meta_row")),
        React.createElement("span",{className:"value","data-testid":"exp-meta-value"},metaActual?((metaActual.emoji||"🎯")+" "+(metaActual.name||"")):(exp.goalId?t("g_meta_borrada"):t("f_no"))),
        React.createElement("span",{className:"chev"},"›")),
      adjustOpen==="meta" && React.createElement("div",{className:"v4-ficha-adjust-open","data-testid":"exp-meta-options"},
        React.createElement("div",{className:"hint"},t(metaOtraMarca?"f_meta_otra":(metaOpciones.length||exp.goalId)?"f_meta_hint":"f_meta_ninguna")),
        !metaOtraMarca && React.createElement("div",{className:"v4-chips wrap"},
          metaOpciones.map(function(g){ const on=exp.goalId===g.id; return React.createElement("button",{key:g.id,type:"button",className:"v4-chip"+(on?" on":""),"data-testid":"exp-meta-"+g.id,"aria-pressed":on,
            onClick:function(){ if(!on) setMeta(exp,g.id); }},(g.emoji||"🎯")+" "+(String(g.name||"").trim()||t("v4_plan_metas"))); }),
          exp.goalId && React.createElement("button",{type:"button",className:"v4-chip","data-testid":"exp-meta-quitar",onClick:function(){ setMeta(exp,null); }},t("f_meta_quitar"))))),
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
