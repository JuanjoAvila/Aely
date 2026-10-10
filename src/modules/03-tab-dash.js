/* ============================================================
   TAB: INICIO (v4) — SPEC-v4.md §3
   ============================================================ */
function dashOrderOf(s, allIds){
  const saved=((s.settings&&s.settings.dashOrder)||[]).filter(function(id){ return allIds.indexOf(id)>=0; });
  return saved.concat(allIds.filter(function(id){ return saved.indexOf(id)<0; }));
}
const CYCLE_COMFORT_DIFF=-15, CYCLE_GOOD_DIFF=10, CYCLE_TIGHT_DIFF=40;
function cyclePaceState(spent,budget,elapsed,days){
  const used=Math.round(spent*100), limit=Math.round(budget*100), excess=Math.max(0,used-limit)/100;
  if(used>limit) return {id:"over",tone:"coral",excess:excess};
  if(elapsed<3) return {id:"start",tone:"mint",excess:0};
  const diff=limit>0&&days>0?used/limit*100-elapsed/days*100:0;
  return {id:diff<=CYCLE_COMFORT_DIFF?"comfort":diff<=CYCLE_GOOD_DIFF?"good":diff<=CYCLE_TIGHT_DIFF?"tight":"slow",
    tone:diff<=CYCLE_GOOD_DIFF?"mint":"tan",excess:0};
}
function cycleMoney(value){
  // Los euros enteros caben como en la maqueta; un céntimo real no desaparece al redondear.
  return Number.isInteger(Math.round(value*DISP.k*100)/100)?eur0(value):eur(value);
}
function cycleTiming(bud,nowMs){
  const now=new Date(nowMs==null?Date.now():nowMs), start=new Date(bud.periodStart);
  const civil=function(d){ return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()); };
  let end=new Date(start.getFullYear(),start.getMonth()+1,1);
  // El lector financiero sólo marca ciclo tras identificar el cobro; conserva esa ancla
  // sin recorrer otra vez el histórico para decidir si se puede mostrar el ritmo.
  if(bud.cycle){
    const last=new Date(start.getFullYear(),start.getMonth()+2,0).getDate();
    end=new Date(start.getFullYear(),start.getMonth()+1,Math.min(start.getDate(),last));
  }
  const days=Math.max(1,(civil(end)-civil(start))/864e5), elapsed=Math.max(0,(civil(now)-civil(start))/864e5);
  return {days:days,elapsed:elapsed,left:Math.max(0,(civil(end)-civil(now))/864e5),reliable:!!bud.cycle};
}
function NetWorthNow({value, shown, simple, series, ready}){
  series=series||[];
  const today=dayKey(new Date()), current=series.length&&series[series.length-1].day===today;
  const ranges=useMemo(function(){ return netWorthRanges(series,today); },[series,today]);
  const [picked,setPicked]=useState("1m"), [touch,setTouch]=useState(null), [info,setInfo]=useState(false);
  const svgRef=useRef(null), frameRef=useRef(0), fingerRef=useRef(null);
  const range=ranges.find(function(r){ return r.id===picked; })||ranges[0];
  const points=range?range.points:[], active=touch!=null?points[touch]:null;
  const delta=points.length>1?points[points.length-1].value-points[0].value:null;
  const color=delta!=null&&delta<0?"var(--coral)":"var(--mint)";
  const chart=useMemo(function(){ return netWorthChartGeometry(points); },[points]);
  useEffect(function(){ setTouch(null); },[range&&range.id]);
  useEffect(function(){ return function(){ cancelAnimationFrame(frameRef.current); }; },[]);
  useBackClose(info,function(){ setInfo(false); });
  const valid=typeof value==="number" && Number.isFinite(value);
  const p=valid?eurParts(active?active.value:typeof shown==="number" && Number.isFinite(shown)?shown:value):null;
  const move=function(e){
    e.stopPropagation();
    if(!chart||!svgRef.current||!e.touches.length) return;
    const rect=svgRef.current.getBoundingClientRect(), x=e.touches[0].clientX;
    const local=(x-rect.left)/rect.width*320;
    fingerRef.current=Math.max(0,Math.min(points.length-1,Math.round((local-4)/312*(points.length-1))));
    if(!frameRef.current) frameRef.current=requestAnimationFrame(function(){ frameRef.current=0; setTouch(fingerRef.current); });
  };
  const release=function(e){ e.stopPropagation(); cancelAnimationFrame(frameRef.current); frameRef.current=0; setTouch(null); };
  const id=React.useId();
  return React.createElement("div",{className:"v4-hero v42-net","data-tour":"hero","data-testid":"inicio-net-current",style:{"--v42-play":ready===false?"paused":"running"}},
    React.createElement("div",{className:"v4-net-current-head"},
      React.createElement("div",{className:"v4-micro"}, t(simple?"v4_money_total":"d_networth")),
      React.createElement("button",{type:"button",className:"v42-net-info","aria-label":t("v42_net_info_title"),onClick:function(){ setInfo(!info); }},"i")
    ),
    active&&React.createElement("span",{className:"v42-net-date","data-testid":"inicio-net-date"},new Date(active.day+"T12:00:00").toLocaleDateString(loc(),{day:"numeric",month:"short",year:"numeric"})),
    React.createElement("div",{className:"v4-hero-amt num","data-tour":"hero-amt"},
      p?p.sign+p.ent:"—", p&&React.createElement("span",null,","+(p.dec||"00")+" "+p.sym)),
    !valid&&React.createElement("div",{className:"hint",role:"status"}, t("v4_net_unknown")),
    valid&&series.length<2&&React.createElement("div",{className:"hint"},t("v42_net_missing")),
    valid&&current&&delta!=null&&React.createElement("div",{className:"v42-net-delta","data-testid":"inicio-net-delta",style:{color:color}},
      tf("v42_net_"+(delta<0?"less_":"more_")+range.id,{x:netWorthDeltaMoney(delta)})),
    valid&&chart&&React.createElement("div",{className:"v42-net-chart","data-noswipe":"1",onTouchStart:move,onTouchMove:move,onTouchEnd:release,onTouchCancel:release},
      React.createElement("svg",{ref:svgRef,key:range.id,viewBox:"0 0 320 80",preserveAspectRatio:"none",role:"img","aria-label":t("v42_net_chart"),style:{color:color}},
        React.createElement("defs",null,React.createElement("linearGradient",{id:id,x1:"0",x2:"0",y1:"0",y2:"1"},
          React.createElement("stop",{offset:"0%",stopColor:"currentColor",stopOpacity:.2}),React.createElement("stop",{offset:"100%",stopColor:"currentColor",stopOpacity:0}))),
        React.createElement("path",{className:"v42-net-fill",d:chart.fill,fill:"url(#"+id+")"}),
        React.createElement("path",{className:"v42-net-line",d:chart.path,fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke",pathLength:1}),
        React.createElement("circle",{className:"v42-net-halo",cx:chart.xy[points.length-1].x,cy:chart.xy[points.length-1].y,r:4,fill:"currentColor"}),
        React.createElement("circle",{className:"v42-net-dot",cx:chart.xy[points.length-1].x,cy:chart.xy[points.length-1].y,r:4,fill:"currentColor"}),
        active&&React.createElement("g",{"data-testid":"inicio-net-guide"},
          React.createElement("line",{x1:chart.xy[touch].x,x2:chart.xy[touch].x,y1:0,y2:80,stroke:"var(--muted)",strokeDasharray:"2 3"}),
          React.createElement("circle",{cx:chart.xy[touch].x,cy:chart.xy[touch].y,r:4,fill:"currentColor"}))
      )),
    valid&&ranges.length>0&&React.createElement("div",{className:"v42-net-ranges"},ranges.map(function(r){
      return React.createElement("button",{key:r.id,type:"button","aria-pressed":range.id===r.id,onClick:function(){ setPicked(r.id); setTouch(null); }},t("v42_range_"+r.id));
    })),
    info&&React.createElement("div",{className:"hint",role:"note"},t("v42_net_info"))
  );
}
function Dashboard({state, totals, budgetStreak, set, onOpenSettings, onOpenProfile, onGoGastos, onGoPlan, showToast}){
  const tt=totals;
  const simple=!!(state.settings&&state.settings.simpleMode);
  const [budgetOpen,setBudgetOpen]=useState(false);
  /* Barra de letra FUERA de Ajustes (11/9): la quería a mano mientras usa la app, no enterrada
     en dos sitios de settings. Vive en Inicio, junto al avatar. */
  /* Puertas de arranque: el count-up no puede vivir detrás del splash. Si venció la espera
     de nube de esa cortina, no se empieza otra espera que oculte los datos locales (29/9). */
  const [splashGone,setSplashGone]=useState(function(){
    try{ return !!(window.__mcSplashGone) || !document.getElementById("mc-load"); }catch(e){ return true; }
  });
  const [bootReady,setBootReady]=useState(function(){
    try{ return !!window.__mcBootReady || !!window.__mcSplashTimedOut || navigator.onLine===false; }catch(e){ return true; }
  });
  useEffect(function(){
    if(splashGone) return undefined;
    const on=function(){ setSplashGone(true); };
    window.addEventListener("mc-splash-gone", on);
    return function(){ window.removeEventListener("mc-splash-gone", on); };
  },[splashGone]);
  useEffect(function(){
    if(bootReady || !splashGone) return undefined;
    const on=function(){ setBootReady(true); };
    window.addEventListener("mc-boot-ready", on);
    // Por si el evento se emitió entre el useState inicial y este effect.
    try{ if(window.__mcBootReady) setBootReady(true); }catch(e){}
    if(window.__mcSplashTimedOut){
      setBootReady(true);
      return function(){ window.removeEventListener("mc-boot-ready", on); };
    }
    /* Offline-first de verdad (16/9): el estado local ya está cargado de forma síncrona. Esperar
       medio segundo a una nube que sabemos ausente pintaba Inicio vacío tras el splash. */
    var offline=false;
    try{ offline=navigator.onLine===false; }catch(e){}
    if(offline){
      setBootReady(true);
      try{ mcBootReady(); }catch(e){}
      return function(){ window.removeEventListener("mc-boot-ready", on); };
    }
    // Con red sí se conserva el margen: evita pintar local y hacer saltar las cifras tras el pull.
    const topeMs=2000;
    const tope=setTimeout(function(){
      setBootReady(true);
      try{ mcBootReady(); }catch(e){}
    }, topeMs);
    return function(){ window.removeEventListener("mc-boot-ready", on); clearTimeout(tope); };
  },[bootReady, splashGone]);
  const shownNet=useCountUp(tt.netWorth||0, splashGone);
  const showSkel=splashGone && !bootReady && !window.__mcSplashTimedOut;

  const nameGuess=(function(){
    try{
      const em=(window.__mcEmail)||"";
      if(em&&em.indexOf("@")>0) return em.split("@")[0].replace(/[._]/g," ");
    }catch(e){}
    return "";
  })();
  const greetName=(function(){
    if(!nameGuess) return "";
    const first=nameGuess.trim().split(/\s+/)[0]||"";
    return first.charAt(0).toUpperCase()+first.slice(1);
  })();
  const initials=(function(){
    if(!nameGuess) return "MC";
    const parts=nameGuess.trim().split(/\s+/);
    return ((parts[0]||"M").charAt(0)+(parts[1]||parts[0]||"C").charAt(0)).toUpperCase();
  })();

  // Mismas filas computables; bruto mensual o neto del ciclo, según lo que dice la tarjeta.
  const bud=dashboardBudgetStats(state);
  const budAmt=bud.budget!=null?bud.budget:(state.budget||0);
  const spentAgainst=Math.max(0,bud.against), rem=bud.remaining!=null?bud.remaining:budAmt-spentAgainst;
  const timing=cycleTiming(bud), paceState=cyclePaceState(spentAgainst,budAmt,timing.elapsed,timing.days);
  const series=useMemo(function(){ return netWorthSeries(state,{today:dayKey(new Date()),debtTotal:tt.debtTotal}); },
    [state.accounts,state.obAccounts,state.accountBalanceHistory,state.invHistory,state.investments,state.assets,state.expenses,state.deleted,tt.debtTotal]);

  const overdue=[];
  // La fecha prevista no es un pago: la misma lectura de evidencia que Plan conserva los
  // vencidos aparte y retira el gas confirmado aunque arrastre `wait` (feedback 30/9).
  const upcoming=(function(){
    const today=tt.today||new Date().getDate();
    const cm=tt.curMonth;
    const rows=[];
    (state.fixed||[]).forEach(function(f){
      const amount=occAmountIn(f,cm);
      if(!(amount>0) || !occursIn(f,cm)) return;
      const status=fixedPaymentState(state,f,tt.curYear,cm,today);
      if(status.paid) return;
      const row={day:status.day, name:f.name||t("fj_fixed"), sub:(entOf(accOf(f)).label||""), amount:amount, pos:false};
      (status.overdue?overdue:rows).push(row);
    });
    (state.debts||[]).forEach(function(d){
      if(!debtActive(d) || !(d.monthly>0)) return;
      if(isDebtPaidThisMonth(d,today,state,tt.curYear,cm)) return;
      rows.push({day:debtChargeDay(d), name:d.name, sub:t("fj_debt_tag"), amount:d.monthly, pos:false});
    });
    (state.flows||[]).forEach(function(f){
      if(!(f.amount>0) || f.kind==="transfer") return;
      if(!flowOccursIn(f,cm,tt.curYear)) return;
      if(flowPaidIn(state,f,tt.curYear,cm,today)) return;
      const day=flowDay(f,tt.curYear,cm)||1;
      rows.push({day:day, name:f.name||t("cat_ingreso"), sub:entOf(f.ent||f.account||"").label||"", amount:f.amount, pos:true});
    });
    rows.sort(function(a,b){ return (a.day==null?99:a.day)-(b.day==null?99:b.day); });
    return rows.slice(0,3);
  })();

  // 🎉 Deudas a las que les queda LA ÚLTIMA cuota: alegría en Inicio (petición 2026-07-18
  // «para alegrar un poco el mes»). debtLeft<=1 = la cuota de este mes (o la próxima) es la última.
  /* Y SE PUEDE QUITAR (2026-09-12, reportado por él desde la app): «está chulo que te aparezca
     el aviso pero cansa mucho verlo cada día… estaría bien poder quitarlo». La tarjeta se queda
     —le gusta— pero se descarta como el informe del mes cerrado, con el mismo «Descartar».
     Se descarta POR DEUDA, no de golpe: cada deuda llega a su última cuota UNA vez, así que
     esto es «ya lo he visto», no «no me lo cuentes nunca más». Y vive en `settings` para que
     viaje a la nube: si no, el otro móvil se lo volvería a enseñar cada día. */
  const partyOff=(state.settings&&state.settings.partyDismissed)||[];
  const partyDebts=(state.debts||[]).filter(function(d){
    const l=debtLeft(d); return debtActive(d) && l!=null && l<=1 && partyOff.indexOf(d.id)===-1;
  });
  const dismissParty=function(id){
    set(function(s){
      const prev=(s.settings&&s.settings.partyDismissed)||[];
      if(prev.indexOf(id)!==-1) return s;
      return Object.assign({},s,{settings:Object.assign({},s.settings,{partyDismissed:prev.concat([id])})});
    });
  };

  // Inicio resume tres metas activas; Plan conserva todas sin cambiar su orden ni sus saldos.
  const goals=(state.goals||[]).filter(function(g){ return !g.done; }).slice(0,3);
  const recent=useMemo((s=state)=>(s.expenses||[]).filter(e=>!expenseIsTombstoned(e,expenseDeletedSet(s))).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,3),[state.expenses,state.deleted]);
  const ringPct=budAmt>0?Math.max(0,Math.min(1,spentAgainst/budAmt)):spentAgainst>0?1:0;
  /* P6 — el anillo usa una animación de montaje, con estado final directo si se reduce
     el movimiento. Pausarla hasta que salga el splash evita gastarla detrás de la cortina. */
  const monthName=monthLong(new Date().getMonth());
  const closedCard=closedMonthCardOf(state);

  return React.createElement("div",{className:"v4-screen"},
    React.createElement("div",{className:"v4-inicio-head rise"},
      React.createElement("div",null,
        React.createElement("div",{className:"v4-inicio-date"}, new Date().toLocaleDateString(loc(),{weekday:"long",day:"numeric",month:"long"})),
        React.createElement("div",{className:"v4-inicio-hi"}, greetName?tf("v4_hola",{n:greetName}):t("v4_hola_anon"))
      ),
      React.createElement("div",{className:"aely-help-head-actions"},
        React.createElement("button",{type:"button",className:"aely-help-entry-mini","aria-label":t("help_title"),onClick:function(){
          try{ window.dispatchEvent(new CustomEvent("mc-open-help",{detail:helpOpenDetail(state, tt, {
            onConsent:function(ok){ set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,{helpAiOk:!!ok,helpAiAsked:true})}); }); }
          })})); }catch(e){}
        }}, "?"),
        React.createElement("button",{className:"v4-avatar","data-tour":"avatar","aria-label":t("pf_title"),
          onClick:function(){ if(onOpenProfile) onOpenProfile(); else if(onOpenSettings) onOpenSettings(); }}, initials)
      )
    ),

    /* B4 — entre splash fuera y nube lista: siluetas, no ceros. Si se pintan detrás del splash
       nadie las ve (misma trampa que el count-up). prefers-reduced-motion: sin brillo (CSS). */
    showSkel && React.createElement("div",{"data-tour":"boot-skel","aria-hidden":"true",style:{marginTop:10}},
      [0,1,2].map(function(i){ return React.createElement("div",{key:"sk"+i,className:"v4-skel"}); })
    ),

    !showSkel && closedCard && React.createElement("div",{className:"v4-card rise","data-tour":"closed-month",style:{animationDelay:".02s",marginTop:4}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontWeight:800,fontSize:15}}, tf("mr_title",{mes:monthLong(closedCard.month)+" "+closedCard.year})),
          React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:4,lineHeight:1.4}}, t("mr_sub"))
        ),
        React.createElement("button",{type:"button",className:"link",style:{flexShrink:0,fontSize:13},onClick:function(){
          set(function(s){ return dismissClosedMonthCard(s, closedCard.ym); });
        }}, t("mr_later"))
      ),
      React.createElement("div",{className:"num",style:{fontWeight:800,fontSize:26,marginTop:10}}, eur0(closedCard.stats.shown)),
      React.createElement("div",{style:{fontSize:12,color:"var(--muted)"}}, t("rp_spent")),
      closedCard.stats.budget!=null && closedCard.stats.budget>0 && React.createElement("div",{style:{fontSize:12.5,marginTop:6}},
        tf("rp_of_budget",{b:eur0(closedCard.stats.budget),p:Math.round(Math.min(100,(closedCard.stats.against/(closedCard.stats.budget||1))*100))})),
      closedCard.topCat && React.createElement("div",{style:{fontSize:12.5,marginTop:6}},
        tf("mr_top",{cat:catName(closedCard.topCat.id), x:eur0(closedCard.topCat.amount)})),
      React.createElement("div",{style:{fontSize:12.5,marginTop:6}},
        closedCard.saved>=0 ? tf("mr_saved",{x:eur0(closedCard.saved)}) : tf("mr_over",{x:eur0(Math.abs(closedCard.saved))})),
      React.createElement("button",{type:"button",className:"btn btn-primary btn-block",style:{marginTop:12},onClick:function(){
        shareMonthReport(state, totals, showToast, {startMs:closedCard.startMs, endMs:closedCard.endMs, ym:closedCard.ym});
        if(showToast) showToast(t("mr_shared"));
      }}, t("mr_share"))
    ),

    !showSkel && React.createElement(NetWorthNow,{value:tt.netWorth, shown:shownNet, simple:simple, series:series, ready:splashGone}),

    // Sin presupuesto, Inicio escondia su tarjeta estrella y te quedabas sin la mitad de la app
    // sin saber por que (P3). En vez de esconderla, la misma tarjeta en vacio y con salida: abre
    // el `BudgetSheet` que ya existe, el mismo que el boton de editar presupuesto.
    !showSkel && !(state.budget>0) && React.createElement("div",{className:"v4-card rise",style:{animationDelay:".1s",marginTop:8}},
      React.createElement("div",{className:"v4-empty"},
        React.createElement("div",{className:"em"}, "🎯"),
        React.createElement("div",{className:"ti"}, t("v4_nobud_t")),
        React.createElement("div",{className:"ph"}, t("v4_nobud_p")),
        React.createElement("button",{className:"btn cta",onClick:function(){ setBudgetOpen(true); }}, t("v4_nobud_cta"))
      )
    ),

    !showSkel && state.budget>0 && React.createElement("div",{className:"v42-cycle-section"},
      React.createElement("div",{className:"v42-cycle-head"},
        React.createElement("span",null,t("v42_this_cycle")),
        React.createElement("button",{type:"button",className:"link",onClick:function(){ if(onGoGastos) onGoGastos(); }},t("v4_see_gastos"))),
      React.createElement("div",{className:"v4-card v4-budget v42-cycle",role:"button",tabIndex:0,"data-state":paceState.id,
        style:{color:"var(--"+paceState.tone+")","--cycle-color":"var(--"+paceState.tone+")","--v42-play":splashGone?"running":"paused"},onClick:function(){ setBudgetOpen(true); },
        onKeyDown:function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setBudgetOpen(true); } }},
        React.createElement("div",{className:"v4-ring v42-cycle-ring","aria-hidden":true},
          React.createElement("svg",{width:76,height:76,viewBox:"0 0 76 76"},
            React.createElement("circle",{cx:38,cy:38,r:32,fill:"none",stroke:"var(--sur2)",strokeWidth:6}),
            React.createElement("circle",{className:"v42-cycle-draw",cx:38,cy:38,r:32,fill:"none",stroke:"currentColor",strokeWidth:6,
              strokeLinecap:"round",pathLength:100,strokeDasharray:(ringPct*100)+" 100",transform:"rotate(-90 38 38)",
              style:{"--cycle-pct":ringPct*100}})),
          React.createElement("div",{className:"v42-cycle-percent num"},Math.round(ringPct*100),React.createElement("span",null,"%"))),
        React.createElement("div",{className:"v4-budget-txt"},
          React.createElement("div",{className:"st",style:{color:"inherit"}},tf("v42_cycle_"+paceState.id,{x:cycleMoney(paceState.excess)})),
          React.createElement("div",{className:"ph v42-cycle-amount"},
            React.createElement("span",{className:"serif num",style:{color:paceState.id==="over"?"var(--coral)":"var(--text)"}},cycleMoney(rem)),
            React.createElement("span",{className:"v42-cycle-of"},tf("v42_cycle_of",{x:cycleMoney(budAmt)}))),
          paceState.id!=="over"&&timing.reliable&&timing.left>0&&React.createElement("div",{className:"v42-cycle-pace","data-testid":"inicio-cycle-pace"},
            React.createElement("b",null,tf("v42_cycle_daily",{x:eur0(Math.floor(Math.max(0,rem)/timing.left))})),
            " ",tf(timing.left===1?"v42_cycle_day":"v42_cycle_days",{n:timing.left}))
        )
      )
    ),
    React.createElement(BudgetSheet,{open:budgetOpen,budget:state.budget,onClose:function(){ setBudgetOpen(false); },onSave:function(b){
      set(function(s){
        const map=Object.assign({},s.budgetByMonth||{}); map[budgetYmKey()]=b;
        return Object.assign({},s,{budget:b,budgetByMonth:map});
      });
    }}),

    !showSkel && partyDebts.length>0 && React.createElement("div",{className:"v4-card rise v4-party",style:{animationDelay:".12s",marginTop:8,padding:"14px 16px"}},
      partyDebts.map(function(d){
        return React.createElement("div",{key:d.id,style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}},
          React.createElement("div",null,
            React.createElement("div",{style:{fontWeight:800,fontSize:15,lineHeight:1.35}}, tf("v4_debt_party_1",{name:d.name,x:eur0(d.monthly||0)})),
            React.createElement("div",{style:{fontSize:13,color:"var(--muted)",marginTop:3}}, tf("v4_debt_party_sub",{x:eur0(d.monthly||0)}))
          ),
          React.createElement("button",{type:"button",className:"link","data-testid":"party-dismiss",style:{flexShrink:0,fontSize:13},
            onClick:function(){ dismissParty(d.id); }}, t("mr_later"))
        );
      })
    ),

    // Estado vacio en vez de esconder la seccion (P4, spec §27): un Inicio recien instalado se
    // quedaba en hero + «Ultimos movimientos» vacio y no se veia que la app hace mas cosas.
    !showSkel && upcoming.length===0 && overdue.length===0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".15s"}},
      React.createElement("div",{className:"v4-section-h"}, React.createElement("span",null, t("v4_upcoming"))),
      React.createElement("div",{className:"v4-empty"},
        React.createElement("div",{className:"em"}, "🧾"),
        React.createElement("div",{className:"ti"}, t("v4_noup_t")),
        React.createElement("div",{className:"ph"}, t("v4_noup_p")),
        React.createElement("button",{className:"btn cta",onClick:function(){
          try{ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})); }catch(e){}
        }}, t("v4_noup_cta"))
      )
    ),

    !showSkel && upcoming.length>0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".15s"}},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null, t("v4_upcoming")),
        // «Ver plan» fuerza el segmento Recibos: sin esto aterrizabas en el último subtab
        // usado (Deudas) — feedback 2026-07-18.
        React.createElement("button",{className:"link",onClick:function(){ if(onGoPlan) onGoPlan("recibos"); }}, t("v4_see_plan"))
      ),
      React.createElement("div",{className:"v4-card",style:{padding:"6px 16px"}},
        upcoming.map(function(u,i){
              return React.createElement("div",{key:i,className:"v4-charge"},
                React.createElement("div",{className:"dt"},
                  React.createElement("div",{className:"d"}, u.day==null?"—":String(u.day).padStart(2,"0")),
                  React.createElement("div",{className:"m"}, monthName.slice(0,3))
                ),
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{className:"nm"}, u.name),
                  u.sub && React.createElement("div",{className:"sub"}, u.sub)
                ),
                React.createElement("div",{className:"am num"+(u.pos?" pos":"")}, (u.pos?"+":"")+eur(u.amount))
              );
            })
      )
    ),

    !showSkel && overdue.length>0 && React.createElement("div",{className:"v4-section rise"},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null,t("v4_charges_overdue")),
        React.createElement("button",{className:"link",onClick:function(){ if(onGoPlan) onGoPlan("recibos"); }},t("v4_see_plan"))),
      React.createElement("div",{className:"v4-card",style:{padding:"6px 16px"}},
        overdue.sort(function(a,b){ return a.day-b.day; }).slice(0,3).map(function(u,i){
          return React.createElement("div",{key:i,className:"v4-charge"},
            React.createElement("div",{className:"dt"},React.createElement("div",{className:"d"},String(u.day).padStart(2,"0")),React.createElement("div",{className:"m"},monthName.slice(0,3))),
            React.createElement("div",{style:{flex:1,minWidth:0}},React.createElement("div",{className:"nm"},u.name),React.createElement("div",{className:"sub"},u.sub+" · "+t("v4_charge_unconfirmed"))),
            React.createElement("div",{className:"am num"},eur(u.amount)));
        }))
    ),

    !showSkel && goals.length===0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".2s"}},
      React.createElement("div",{className:"v4-section-h"}, React.createElement("span",null, t("v4_your_goals"))),
      React.createElement("div",{className:"v4-empty"},
        React.createElement("div",{className:"em"}, "🎯"),
        React.createElement("div",{className:"ti"}, t("v4_nogoal_t")),
        React.createElement("div",{className:"ph"}, t("v4_nogoal_p")),
        React.createElement("button",{className:"btn cta",onClick:function(){ if(onGoPlan) onGoPlan("metas"); }}, t("v4_nogoal_cta"))
      )
    ),

    !showSkel && goals.length>0 && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".2s"}},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null, t("v4_your_goals")),
        React.createElement("button",{className:"link",onClick:function(){ if(onGoPlan) onGoPlan("metas"); }}, t("v4_see_plan"))
      ),
      // stopPropagation: el carrusel scrollea en horizontal y sin esto el gesto burbujeaba al
      // viewport y cambiaba de pestaña a la vez (feedback 2026-07-18, aparecía al crear metas).
      React.createElement("div",{className:"v4-goals",
        onTouchStart:function(e){ e.stopPropagation(); },
        onTouchMove:function(e){ e.stopPropagation(); }},
        goals.map(function(g){
          const pct=goalPct(g); const eta=goalEta(g, tt.ahorroMensual);
          return React.createElement("div",{key:g.id,className:"v4-goal"},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
              React.createElement("span",{style:{fontSize:28}}, g.emoji||"🎯"),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("div",{style:{fontWeight:800,fontSize:15.5}}, g.name),
                React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:2}}, eur0(g.saved||0)+" "+t("gl_of")+" "+eur0(g.target||0))
              ),
              React.createElement("div",{className:"serif num v4-goal-pct",style:{fontWeight:600,fontSize:18}}, Math.round(pct)+"%")
            ),
            React.createElement("div",{className:"bar"}, React.createElement("i",{style:{width:pct+"%"}})),
            React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)"}}, eta.text)
          );
        })
      )
    ),

    !showSkel && React.createElement("div",{className:"v4-section rise",style:{animationDelay:".25s"}},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null, t("v4_recent")),
        React.createElement("button",{className:"link",onClick:function(){ if(onGoGastos) onGoGastos(); }}, t("v4_all"))
      ),
      React.createElement("div",{className:"v4-card",style:{padding:"6px 14px"}},
        recent.length===0
          ? React.createElement("div",{style:{padding:"18px 4px",color:"var(--muted)",fontSize:14}}, t("v4_recent_empty"))
          : recent.map(function(e){
              const c=catOf(e.category); const pos=e.amount<0;
              return React.createElement("div",{key:e.id||(e.date+e.amount+e.merchant),className:"v4-mov"},
                React.createElement("div",{className:"tile",style:{background:(c.color||"#5FD08A")+"22"}}, c.icon||"📦"),
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{className:"nm"}, e.merchant||catName(e.category)),
                  React.createElement("div",{className:"meta"}, catName(e.category)+(e.source&&String(e.source).indexOf("ob:")===0?" · "+t("g_bank_ob"):""))
                ),
                React.createElement("div",{className:"am num"+(pos?" pos":"")}, (pos?"+":"")+eur(Math.abs(e.amount)))
              );
            })
      )
    )
  );
}
