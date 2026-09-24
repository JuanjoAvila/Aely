/* ============================================================
   v4 — Plan (Recibos/Deudas/Metas), Cartera, Sheet Apuntar
   Spec: docs/design/handoff/SPEC-v4.md §5–7
   ============================================================ */

function PlanTab({state, set, totals, showToast, simple, gotoSeg, clearGoto}){
  const [seg,setSeg]=useState("recibos");
  const [manageOpen,setManageOpen]=useState(false);
  // Modo sencillo: solo Recibos (spec §2).
  const segs=simple
    ? [{id:"recibos",lab:t("v4_plan_recibos")}]
    : [{id:"recibos",lab:t("v4_plan_recibos")},{id:"deudas",lab:t("v4_plan_deudas")},{id:"metas",lab:t("v4_plan_metas")}];
  const charges=useMemo(function(){
    return planChargesMonth(state, totals.curMonth, totals.curYear, totals.today);
  },[state.fixed,state.debts,state.oneoffs,state.flows,totals.curMonth,totals.curYear,totals.today]);
  const pick=useMemo(function(){
    return planCoverPickBank(totals, charges.pendingByBank, charges.pendingBills, charges.paidBills);
  },[totals.minByBank,totals.minDayByBank,totals.mainBank,charges.pendingByBank,charges.pendingBills,charges.paidBills]);
  const coverBank=pick.bank;
  const cover=pick.cover;
  const billsEuroTotal=charges.paidBillsTotal+charges.pendingBillsTotal;
  const allBillsPaid=billsEuroTotal>0&&charges.pendingBillsTotal<=0;
  // Sin inventar 0 € si la cuenta del recibo ya no existe en bankBal (Codex 2050Z).
  // Antes de coverTone: si va después, var hoisting deja balKnown falsy y all-paid pinta verde con saldo negativo.
  var balKnown=false, balNow=0;
  if(coverBank!=null&&totals.bankBal&&Object.prototype.hasOwnProperty.call(totals.bankBal, coverBank)){
    var balRaw=Number(totals.bankBal[coverBank]);
    if(isFinite(balRaw)){ balKnown=true; balNow=balRaw; }
  }
  // Todo pagado no fuerza verde si el saldo conocido es negativo (Codex 2055Z).
  const coverTone=allBillsPaid
    ? ((balKnown&&balNow<0)?"bad":"ok")
    : cover.tone;
  const stCls=coverTone==="bad"?"st bad":(coverTone==="warn"?"st warn":"st");
  const bankLab=coverBank&&typeof entOf==="function"?entOf(coverBank).label:"";
  const coverHead=coverTone==="bad"?t("v4_plan_state_bad_h"):(coverTone==="warn"?t("v4_plan_state_warn_h"):t("v4_plan_state_ok_h"));
  const leftForPhrase=coverBank!=null?(pick.pending||0):charges.pendingBillsTotal;
  const hasMinDay=cover.minDay!=null&&cover.minDay>0;
  // Frases propias: todo pagado / sin día (minDay 0) — NUNCA «el día ya» (review Claude 1845Z).
  const coverPhrase=(!billsEuroTotal)
    ? t("v4_plan_state_none")
    : (allBillsPaid
      ? (coverBank&&balKnown
        ? tf("v4_plan_state_all_paid",{x:eur0(balNow),bank:bankLab})
        : t("v4_plan_state_all_paid_nobank"))
      : (coverBank!=null&&cover.min!=null&&isFinite(cover.min)
        ? tf((coverTone==="bad"?"v4_plan_state_bad":(coverTone==="warn"?"v4_plan_state_warn":"v4_plan_state_ok"))+(hasMinDay?"":"_noday"),{
            left:eur0(leftForPhrase), end:eur0(cover.min), bank:bankLab, day:hasMinDay?String(cover.minDay):"", min:eur0(cover.min)
          })
        : t("v4_plan_state_none")));
  const coverAria=coverHead+". "+coverPhrase;
  // Puerta viva desde Ajustes: flag pendiente si Plan aún no montó (cold start / idle).
  useEffect(function(){
    var onOpen=function(){
      try{ window.__mcOpenBillsPending=false; }catch(e){}
      setSeg("recibos");
      setManageOpen(true);
    };
    try{ if(window.__mcOpenBillsPending) onOpen(); }catch(e){}
    window.addEventListener("mc-open-bills", onOpen);
    return function(){ window.removeEventListener("mc-open-bills", onOpen); };
  },[]);
  const biggestForCover=(charges.pendingBills||[]).filter(function(x){ return x.bank===coverBank; })
    .slice().sort(function(a,b){ return Math.abs(b.amount)-Math.abs(a.amount); })[0]||null;
  useEffect(function(){ if(simple && seg!=="recibos") setSeg("recibos"); },[simple,seg]);
  // «Ver plan» desde Inicio fuerza el segmento (recibos/metas): sin esto quedaba el último
  // que usaste (p.ej. Deudas) y el link engañaba (feedback 2026-07-18). gotoSeg lleva ts para
  // re-disparar aunque pidas dos veces el mismo segmento.
  useEffect(function(){
    if(!gotoSeg||!gotoSeg.id) return;
    setSeg(simple?"recibos":gotoSeg.id);
    if(clearGoto) clearGoto();
  },[gotoSeg&&gotoSeg.ts]);
  /* «EN DEUDAS Y METAS SE RELENTIZA DE MANERA MUY BESTIA» — CAPÍTULO 2 (2026-07-26 noche).
     La 4.12.0 sacó el montaje de las PESTAÑAS fuera del gesto y él confirmó que deslizar «va de
     10»… pero seguía marcando esto como fallo, y tenía razón: aquí dentro había otro montaje al
     tocar. Estos tres segmentos se pintaban con `seg==="deudas" && <Debts/>`, así que estrenar
     Deudas montaba el componente ENTERO dentro del toque. Medido con la CPU x6: **203 ms de hilo
     bloqueado** recién abierta la app, 119 ms con ella ya reposada.

     ⚠ Y el guardián no lo veía: `rendimiento-tabs.spec.mjs` medía ENTRAR EN PLAN, que aterriza en
     Recibos, y nunca tocaba el segmento de Deudas. Pasaba en verde mientras él seguía viendo el
     tirón — de ahí que esto sobreviviera a dos versiones.

     Mismo arreglo que el carrusel: montar en huecos libres y luego solo enseñar/esconder, sin
     desmontar. Y esconder con `height:0 + overflow:hidden + visibility:hidden` A PROPÓSITO, NO con
     `display:none`: `display:none` se salta el layout, así que el coste no desaparecería, solo se
     mudaría al momento de enseñarlo — que es exactamente la trampa que ya costó una vuelta con
     `content-visibility` en las pestañas. Así el layout se paga una vez, en reposo. */
  const [segMounted,setSegMounted]=useState(function(){ return {recibos:true}; });
  useEffect(function(){ setSegMounted(function(m){ return m[seg]?m:Object.assign({},m,{[seg]:true}); }); },[seg]);
  useEffect(function(){
    if(simple) return;
    var cancelled=false;
    mcScheduleIdle(function(){
      if(cancelled) return;
      setSegMounted(function(m){ return m.deudas?m:Object.assign({},m,{deudas:true}); });
      mcScheduleIdle(function(){
        if(!cancelled) setSegMounted(function(m){ return m.metas?m:Object.assign({},m,{metas:true}); });
      }, 4000);
    }, 4000);
    return function(){ cancelled=true; };
  },[simple]);
  /* Y OJO CON CÓMO SE ESCONDEN — aquí me equivoqué yo primero (2026-07-26 noche). Empecé con
     `height:0 + overflow:hidden + visibility:hidden` para no perder el layout… y `visibility:hidden`
     SIGUE PINTANDO: el elemento no se ve, pero participa en estilo, capas y pintado. Como los tres
     segmentos viven dentro del `.track` que se mueve con el dedo, al deslizar se repintaban los
     TRES en cada frame. Trazado: **323 `Paint`, 114 `UpdateLayoutTree` y 95 `Layerize` en un solo
     gesto**, o sea 126 ms repartidos en trocitos — que no es una tarea larga que salte a la vista,
     pero es exactamente su «al entrar en Deudas, moverte, y luego deslizar va con muchísimo lag».
     Cambié un tirón de 203 ms al entrar por un peaje en CADA deslizada: mal negocio.
     `display:none` NO pinta, NO calcula estilo y NO hace layout, y React conserva el estado del
     componente igual, que era lo único que se quería conservar: lo caro es MONTARLO, y eso ya se
     paga una vez en un hueco libre.

     SEGUNDA VUELTA, 2026-07-27 — y aquí el que se equivocó fui yo. La solución que quedó fue
     `visibility:hidden` SIEMPRE + `content-visibility:hidden` solo mientras el dedo arrastra, con
     la idea de que el recálculo cayera después del `touchend`. Él lo siguió notando: «vas a
     deudas, te mueves dentro de deudas y luego deslizas a otra tab, es horrible el lag». Y tenía
     razón: ese peaje no desaparecía, solo se movía tres milisegundos más allá.

     Medidas de HOY (CPU x12, medianas de 5), que es lo que manda porque el premontaje y el que las
     páginas ya no cuelguen del render de App han cambiado el terreno:

       | cómo se esconden          | entrar en Plan | abrir Deudas | salir de Plan |
       | visibility:hidden (antes) |     162 ms     |    198 ms    |    185 ms     |
       | content-visibility SIEMPRE|      90 ms     |    148 ms    |    182 ms     |
       | display:none              |      74 ms     |    253 ms    |    176 ms     |

     Gana `content-visibility:hidden` puesto SIEMPRE: casi tan barato como `display:none` al entrar
     y MUCHO mejor al abrir un segmento (148 vs 253), porque a diferencia de `display:none`
     conserva el estado ya renderizado y solo tiene que volver a pintarlo. Y no era medible antes
     de tener el resto arreglado, que es justo por qué esta decisión se re-mide en vez de heredarse.
     Al ponerse siempre, sobra la regla especial de `.track.dragging` que había en shell.html. */
  const oculto={height:0,overflow:"hidden",contentVisibility:"hidden",pointerEvents:"none"};
  const segElRef=useRef({});
  const capa=function(id,hijo){
    if(!segMounted[id]) return null;
    return React.createElement("div",{key:id,"data-seg":id,ref:function(el){ segElRef.current[id]=el; },style:seg===id?null:oculto,"aria-hidden":seg!==id}, hijo);
  };

  /* DESLIZAR VERTICAL PARA CAMBIAR DE SEGMENTO (petición 2026-08-03: «no depender de la otra
     mano para tocar arriba»). SOLO arriba del todo tirando hacia abajo: Recibos → Deudas → Metas
     → Recibos. Abajo del todo es la OLA nativa (feedback 4/8 noche), no el sentido inverso — si
     reclamábamos ese borde con `touch-action:none` + preventDefault, matábamos la ola. A mitad
     de lista = scroll normal. Eje x/y con `gestureAxis` (mismo que el swipe de pestañas); si sale
     horizontal, este gesto se aparta y deja pasar el de `.viewport`. */
  const planScreenRef=useRef(null);
  const enterDirRef=useRef(null);
  useEffect(function(){
    if(simple) return undefined;   // modo sencillo: un único segmento, no hay a dónde ir
    const root=planScreenRef.current; if(!root) return undefined;
    // Orden fijo, NO derivado de `segs` (ese array es literal nuevo en cada render de PlanTab):
    // si esta lista dependiera de `segs`, el efecto se desmontaría y remontaría en CUALQUIER
    // re-render del componente —cambie o no `simple`/`seg`—, y si eso pasa a mitad de un gesto
    // (entre un touchmove y el siguiente) los listeners viejos se sueltan y los nuevos arrancan
    // con sx/sy/axis en blanco: el primer arrastre después de aterrizar en Plan se perdía así
    // (visto en el e2e: el primer deslizamiento no cambiaba de segmento y el segundo sí).
    const order=["recibos","deudas","metas"];
    const TH=0.07, FLICK_V=0.4, FLICK_MIN=26, MAX_PULL=46;
    // Solo ARRIBA → abajo cambia de segmento. Abajo = ola. Plan en reposo va SIEMPRE en pan-y
    // (si `mc-touch-own` queda puesto al estar arriba, `touch-action:none` bloquea también
    // BAJAR a ver el contenido — feedback 5/8). `mc-touch-own` solo durante el gesto que nace
    // arriba: tirón abajo = segmento; dedo arriba = scroll a mano hasta salir del tope.
    let sx=0, sy=0, t0=0, axis=null, mode=null, dir=0, dyRaw=0, raf=0, pend=null;
    let startAtTop=false, lastY=0, pageEl=null, ownOn=false;
    const paint=function(){
      raf=0;
      const el=segElRef.current[seg];
      if(el) el.style.transform=pend?("translate3d(0,"+pend+"px,0)"):"";
    };
    const queue=function(v){ pend=v; if(!raf) raf=requestAnimationFrame(paint); };
    const resist=function(px){ return Math.pow(Math.min(1,px/160),0.72)*MAX_PULL; };
    const cleanup=function(el){ if(el){ el.style.transition=""; el.style.transform=""; } };
    const atTopOf=function(pg){ return !pg || (pg.scrollTop||0)<=2; };
    const setOwn=function(on){
      if(!pageEl||!pageEl.classList) return;
      if(on && !ownOn){ pageEl.classList.add("mc-touch-own"); ownOn=true; }
      else if(!on && ownOn){ pageEl.classList.remove("mc-touch-own"); ownOn=false; }
    };
    const onStart=function(e){
      if(document.documentElement.classList.contains("sheet-open")) return;
      if(!(e.touches&&e.touches[0])) return;
      const tt=e.touches[0];
      pageEl=root.closest(".page");
      sx=tt.clientX; sy=tt.clientY; lastY=tt.clientY; t0=Date.now();
      axis=null; mode=null; dir=0; dyRaw=0;
      startAtTop=atTopOf(pageEl);
      // touch-action se decide al empezar el gesto: none solo si nacemos arriba (segmento).
      setOwn(!!startAtTop);
    };
    const onMove=function(e){
      if(axis==="x"||mode==="x") return;
      if(!(e.touches&&e.touches[0])) return;
      const tt=e.touches[0], ddx=tt.clientX-sx, ddy=tt.clientY-sy;
      if(axis===null){
        const eje=gestureAxis(ddx,ddy);
        if(!eje) return;
        axis=eje;
        if(axis==="x"){ mode="x"; setOwn(false); return; }
        if(ddy>0 && startAtTop && atTopOf(pageEl)){ dir=1; mode="seg"; }
        else { mode="scroll"; }
      }
      if(mode==="scroll"){
        e.stopPropagation();
        // Con none el navegador no scrollea: empujamos scrollTop (dedo arriba → baja la lista).
        if(ownOn && pageEl){
          const fingerUp=lastY-tt.clientY;
          lastY=tt.clientY;
          if(fingerUp){
            pageEl.scrollTop=Math.max(0, (pageEl.scrollTop||0)+fingerUp);
            if(pageEl.scrollTop>2) setOwn(false);
          }
          if(e.cancelable) e.preventDefault();
        }
        return;
      }
      if(mode!=="seg") return;
      e.stopPropagation();
      if((dir>0&&ddy<0)||(dir<0&&ddy>0)){ dyRaw=0; queue(0); return; }
      dyRaw=Math.abs(ddy);
      lastY=tt.clientY;
      if(e.cancelable) e.preventDefault();
      queue(mcReduced()?0:dir*resist(dyRaw));
    };
    const finish=function(allowCommit){
      if(raf){ cancelAnimationFrame(raf); raf=0; }
      pend=null;
      if(mode!=="seg"){
        setOwn(false);
        axis=null; mode=null;
        return;
      }
      const el=segElRef.current[seg];
      const dt=Math.max(1,Date.now()-t0);
      const vel=dyRaw/dt;
      const pasa=allowCommit && (dyRaw>(window.innerHeight||700)*TH || (vel>FLICK_V && dyRaw>FLICK_MIN));
      if(pasa){
        try{ if(navigator.vibrate) navigator.vibrate(8); }catch(err){}
        const i=order.indexOf(seg);
        const nextId=order[(i+(dir>0?1:-1)+order.length)%order.length];
        cleanup(el);
        enterDirRef.current=dir>0?"down":"up";
        setSegMounted(function(m){ return m[nextId]?m:Object.assign({},m,{[nextId]:true}); });
        setSeg(nextId);
      } else if(el && !mcReduced()){
        el.style.transition="transform .22s cubic-bezier(.32,.72,0,1)";
        el.style.transform="";
        setTimeout(function(){ cleanup(el); }, 230);
      } else cleanup(el);
      setOwn(false);
      axis=null; mode=null; dir=0; dyRaw=0;
    };
    const onTouchEnd=function(){ finish(true); };
    // `touchcancel` (el sistema se lleva el dedo): el gesto NO cuenta, se queda como estaba —
    // mismo criterio que el cierre del perfil en `onCancel` de 11-app-main.js.
    const onTouchCancel=function(){ finish(false); };
    root.addEventListener("touchstart", onStart, {passive:true});
    root.addEventListener("touchmove", onMove, {passive:false});
    root.addEventListener("touchend", onTouchEnd, {passive:true});
    root.addEventListener("touchcancel", onTouchCancel, {passive:true});
    return function(){
      if(raf) cancelAnimationFrame(raf);
      setOwn(false);
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchCancel);
    };
  },[simple, seg]);
  // Entrada sutil SOLO cuando el segmento cambia por este gesto (tocar la pestaña de arriba
  // sigue siendo instantáneo, a propósito: ese toque ya es una decisión explícita del usuario).
  useEffect(function(){
    const dir=enterDirRef.current; if(!dir) return;
    enterDirRef.current=null;
    const el=segElRef.current[seg]; if(!el) return;
    const cls=dir==="down"?"v4-seg-enter-down":"v4-seg-enter-up";
    el.classList.add(cls);
    const clear=function(){ el.classList.remove(cls); el.removeEventListener("animationend",clear); };
    el.addEventListener("animationend", clear);
    const to=setTimeout(clear, 500);   // red de seguridad si el evento no llega
    return function(){ clearTimeout(to); };
  },[seg]);

  return React.createElement("div",{className:"v4-screen",ref:planScreenRef},
    React.createElement("h1",{className:"v4-title serif"}, simple?t("v4s_plan_left_title"):t("v4_plan_title")),
    simple && React.createElement("div",{className:"v4-card v4-card-hero rise v4-plan-cover v4-plan-cover-simple","data-plan-state":coverTone,role:"group","aria-label":coverAria},
      React.createElement("div",{className:"v4-plan-simple-hero"},
        React.createElement("div",{className:stCls}, coverHead),
        React.createElement("div",{className:"v4-plan-simple-amt num serif"}, eur0(charges.pendingBillsTotal)),
        React.createElement("div",{className:"ph"}, coverPhrase),
        biggestForCover && React.createElement("div",{className:"ph",style:{marginTop:6}},
          tf("v4_plan_biggest",{name:biggestForCover.name,amount:eur0(biggestForCover.amount)}))
      )
    ),
    !simple && React.createElement("div",{className:"v4-seg",role:"tablist"},
      segs.map(function(s){
        return React.createElement("button",{key:s.id,type:"button",role:"tab","aria-selected":seg===s.id,"data-seg":s.id,
          className:"v4-seg-btn"+(seg===s.id?" on":""),onClick:function(){ setSeg(s.id); }}, s.lab);
      })
    ),
    capa("recibos", React.createElement(PlanBills,{state:state,set:set,totals:totals,charges:charges,manageOpen:manageOpen,setManageOpen:setManageOpen,simple:simple,showToast:showToast})),
    !simple && capa("deudas", React.createElement(Debts,{state:state,set:set,showToast:showToast})),
    !simple && capa("metas", React.createElement(Goals,{state:state,set:set,totals:totals,showToast:showToast}))
  );
}

/* Recibos conserva la portada compacta que ya funcionaba: el diagnóstico largo y el anillo
   convertían Plan en un mensaje gigante y alejaban lo que la familia viene a mirar. «Gestionar»
   sí se mantiene como puerta al editor nuevo (feedback real 2026-09-17). */
function PlanBills({state, set, totals, charges, manageOpen, setManageOpen, simple, showToast}){
  const [paidExpanded,setPaidExpanded]=useState(false);
  const [pendExpanded,setPendExpanded]=useState(false);
  const paidPanelId="v4-paid-panel";
  const month=totals.curMonth;
  const pack=charges||planChargesMonth(state, totals.curMonth, totals.curYear, totals.today);
  // «Lo que aún saldrá» = recibos + traspasos pendientes. Ingresos NUNCA aquí (NO-GO 17/9).
  const pending=pack.pendingBills.concat(pack.transfersPending);
  const paid=pack.paidBills;
  const incomePend=pack.incomePending||[];
  // Atrás real (history) pliega el «Ya has pagado»; Escape del e2e no basta (Claude 1845Z).
  useBackClose(!!paidExpanded, function(){ setPaidExpanded(false); });
  const openManage=function(){
    if(setManageOpen) setManageOpen(true);
    else try{ window.dispatchEvent(new CustomEvent("mc-open-bills")); }catch(e){}
  };
  const rowSub=function(x){
    if(simple){
      if(x.kind==="income") return tf("v4s_row_income",{bank:entOf(x.bank).label});
      if(x.kind==="transfer"){
        var toEnt=x.to||null;
        var inv=toEnt&&((state.investments||[]).some(function(i){ return i.ent===toEnt; })||(state.accounts||[]).some(function(a){ return a.ent===toEnt&&a.role==="extra"; }));
        return inv?tf("v4s_row_invest",{bank:entOf(toEnt).label}):tf("v4s_row_to",{bank:entOf(toEnt||x.bank).label});
      }
      if(x.kind==="debt"||x.kind==="balloon") return tf("v4s_row_debt",{name:x.name});
      return tf("v4s_row_from",{bank:entOf(x.bank).label});
    }
    var tag=x.kind==="income"?t("fj_income_tag"):(x.kind==="transfer"?t("fj_transfer_tag"):(x.kind==="debt"||x.kind==="balloon"?t("fj_debt_tag"):t("fj_fixed_tag")));
    return tag+(x.bank?" · "+entOf(x.bank).label:"");
  };
  const row=function(x){
    const income=!!x.income || (x.amount<0);
    const amt=Math.abs(x.amount);
    const cls=simple?("v4-mov"+(x.paid?" v4-paid":"")):("v4-charge"+(x.paid?" v4-paid":""));
    if(simple){
      return React.createElement("div",{className:cls,key:x.id},
        React.createElement("div",{className:"tile","aria-hidden":true}, x.day||"—"),
        React.createElement("div",{className:"nm"},
          React.createElement("div",{className:"nm-title"}, x.paid?"✓ "+x.name:x.name),
          React.createElement("div",{className:"meta"}, rowSub(x))
        ),
        React.createElement("div",{className:"am"+(income?" pos":"")}, (income?"+":"")+eur(amt))
      );
    }
    return React.createElement("div",{className:cls,key:x.id},
      React.createElement("div",{className:"dt"},
        React.createElement("div",{className:"d"}, x.day||"—"),
        React.createElement("div",{className:"m"}, monthShort(month-1))
      ),
      React.createElement("div",{className:"nm"},
        React.createElement("div",null, x.paid?"✓ "+x.name:x.name),
        React.createElement("div",{className:"sub"}, rowSub(x))
      ),
      React.createElement("div",{className:"am"+(income?" pos":"")}, (income?"+":"")+eur(amt))
    );
  };
  const paidLabel=pack.paidBillsCount===1
    ? tf("v4_paid_fold_one",{n:1,amount:eur0(pack.paidBillsTotal)})
    : tf("v4_paid_fold",{n:pack.paidBillsCount,amount:eur0(pack.paidBillsTotal)});
  return React.createElement(React.Fragment,null,
    !simple && React.createElement("div",{className:"v4-card v4-card-hero rise"},
      React.createElement("div",{className:"v4-micro"}, tf("v4_plan_left",{month:monthLong(month-1)})),
      React.createElement("div",{className:"serif num",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6}}, eur(pack.pendingBillsTotal)),
      React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",marginTop:14,fontSize:13.5,color:"var(--muted)"}},
        React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:"var(--mint)",flex:"0 0 auto"}}),
        (function(){
          const account=(state.accounts||[]).find(accFixed);
          const bank=account&&account.ent;
          /* Una sola fuente para normal y sencillo: `planCoverState` parte del mínimo diario y
             descuenta únicamente las cuotas SIN fecha. El saldo final podía quedar positivo por
             una nómina posterior y ocultar un descubierto anterior (feedback 2026-09-18). */
          const cover=bank&&planCoverState(totals,bank,0,pack.pendingBills);
          if(!cover||typeof cover.min!=="number"||!isFinite(cover.min)) return "—";
          const day=cover.minDay>0?cover.minDay:0;
          return tf("v4_plan_liq",{amount:eur0(cover.min),when:day?" "+tf("v4_plan_liq_day",{d:day}):"",bank:entOf(bank).label});
        })()
      )
    ),
    React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null,simple?t("v4_aun_saldra"):t("v4_pendiente")),
        // Sencillo: sin «Gestionar» aquí — solo Ajustes → Cambiar mis recibos (NO-GO §5bis.2).
        !simple && React.createElement("button",{type:"button",className:"link",onClick:openManage}, t("v4_gestionar"))
      ),
      pending.length===0
        ? React.createElement("div",{className:"ph",style:{padding:"8px 4px 4px"}}, t("v4_aun_saldra_empty"))
        : (pendExpanded?pending:pending.slice(0,3)).map(row),
      pending.length>3 && React.createElement("button",{type:"button",className:"v4-link-mini",onClick:function(){ setPendExpanded(function(v){ return !v; }); }},
        pendExpanded ? t("v4_ver_menos") : tf("v4_ver_mas",{n:pending.length-3}))
    ),
    incomePend.length>0 && React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null,t("v4_aun_entrara"))
      ),
      incomePend.map(row)
    ),
    !simple && React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},t("v4_ya_pagado")+" · "+eur(pack.paidBillsTotal)),
      (paidExpanded?paid:paid.slice(0,3)).map(row),
      paid.length>3 && React.createElement("button",{type:"button",className:"v4-link-mini",onClick:function(){ setPaidExpanded(function(v){ return !v; }); }},
        paidExpanded?t("v4_ver_menos"):tf("v4_ver_mas",{n:paid.length-3}))
    ),
    simple && pack.paidBillsCount>0 && React.createElement("button",{type:"button",className:"v4-paid-fold",
      id:"v4-paid-fold-btn","aria-expanded":paidExpanded?"true":"false","aria-controls":paidPanelId,
      onClick:function(){ setPaidExpanded(function(v){ return !v; }); }},
      React.createElement("span",null, paidLabel),React.createElement("span",{"aria-hidden":true}, paidExpanded?"▾":"▸")),
    simple && paidExpanded && React.createElement("div",{className:"v4-section",id:paidPanelId,role:"region","aria-labelledby":"v4-paid-fold-btn"}, paid.map(row)),
    // También en sencillo: la puerta vive en Ajustes → Dinero (NO-GO §5bis.2).
    React.createElement(BillsManagePush,{open:manageOpen,onClose:function(){ setManageOpen(false); },state:state,set:set,totals:totals,simple:!!simple,showToast:showToast})
  );
}

/* §2 variante A: `.settings-push` hub, sin montar `<Fijos>`. Reconcile → BankPanel (Claude). */
function gbTxt(key, vars){
  // Las claves ya viven en LANG.es/en/ca; conservar el antiguo respaldo castellano duplicaba
  // texto y podía tapar una traducción ausente en vez de dejar que i18n-keys la detectase.
  return vars?tf(key,vars):t(key);
}
function gbSub(key, n){
  return gbTxt(n===1?key+"_one":key, {n:n});
}

/* En una lista de recibos el logo del banco dice de dónde sale, no QUÉ es, y mezclaba todas las
   filas a ojos de quien solo quiere encontrar luz, agua o teléfono (feedback del padre, 23/9).
   Son pictogramas locales y ligeros: nada de una librería ni de una petición de red. */
function billGlyph(row){
  const s=String((row&&row.name)||"").toLowerCase();
  if(/luz|electric|energ|endesa|iberdrola|gas\b/.test(s)) return "⚡";
  if(/agua|aig[uü]a/.test(s)) return "💧";
  if(/m[oó]vil|telefon|internet|fibra|wifi/.test(s)) return "📶";
  if(/seguro|asseguran|insurance/.test(s)) return "🛡️";
  if(/alquiler|lloguer|rent|hipoteca|mortgage/.test(s)) return "🏠";
  if(/pr[eé]stamo|pr[eé]stec|loan|deuda|deute/.test(s)||(row&&row.kind==="debt")) return "💳";
  if(/netflix|spotify|disney|prime|hbo|stream/.test(s)) return "🎬";
  if(/gimnas|gym|fitness/.test(s)) return "🏋️";
  if(/coleg|escola|guarder|school|univers/.test(s)) return "🎓";
  if(/ibi|impuesto|impost|tax/.test(s)) return "🏛️";
  if(/n[oó]mina|salari|salary/.test(s)||(row&&row.income)) return "💼";
  if(/dent|m[eé]dic|metge|salud|salut|health/.test(s)) return "🩺";
  return row&&row.kind==="flow"?"↔️":row&&row.kind==="oneoff"?"📅":"🧾";
}

/* §2 variante A: `.settings-push` hub, sin montar `<Fijos>`. Reconcile → BankPanel (Claude).
   Ajustes dispara `mc-open-bills` → PlanTab abre este push con state vivo (no snapshot). */
function BillsManagePush({open, onClose, state, set, totals, simple, showToast}){
  const [stack,setStack]=React.useState(["hub"]);
  const [group,setGroup]=React.useState(null);
  const [q,setQ]=React.useState("");
  const [detail,setDetail]=React.useState(null);
  const [addStep,setAddStep]=React.useState(null);
  const [addForm,setAddForm]=React.useState({name:"",amount:"",freq:"mes",months:[],day:"",when:"",account:"sabadell",kind:"fixed"});
  const [undoBill,setUndoBill]=React.useState(null);
  const undoTimer=React.useRef(null);
  const rootRef=React.useRef(null);
  const subRef=React.useRef(null);
  const titleRef=React.useRef(null);
  const prevFocus=React.useRef(null);
  const popRef=React.useRef(null);
  const detailRef=React.useRef(null);
  const addStepRef=React.useRef(null);
  const openerRef=React.useRef(null);
  const hadSheetRef=React.useRef(false);
  const view=stack[stack.length-1];
  const pageSwipe=useEdgePageClose(!!open,onClose,view==="hub"&&!detail&&!addStep,rootRef);
  const sub=useEdgePageClose(!!open,function(){ setStack(["hub"]); setGroup(null); },view!=="hub"&&!detail&&!addStep,subRef);
  const cm=totals.curMonth, cy=totals.curYear;
  React.useEffect(function(){
    if(!open){
      setStack(["hub"]); setGroup(null); setQ(""); setDetail(null); setAddStep(null);
      if(undoTimer.current){ clearTimeout(undoTimer.current); undoTimer.current=null; }
      setUndoBill(null);
    }
  },[open]);
  React.useEffect(function(){
    return function(){ if(undoTimer.current) clearTimeout(undoTimer.current); };
  },[]);
  const pop=React.useCallback(function(){
    if(detail){ setDetail(null); return; }
    if(addStep){ setAddStep(null); return; }
    if(view==="hub"){ pageSwipe.close(); return; }
    sub.close();
  },[view, detail, addStep]);
  popRef.current=pop; detailRef.current=detail; addStepRef.current=addStep;
  const closeDetail=React.useCallback(function(){ setDetail(null); },[]);
  const closeAdd=React.useCallback(function(){ setAddStep(null); },[]);
  useBackClose(!!open, pop);
  // El hub conserva su entrada y cada pantalla hija añade otra. Antes toda la pila compartía
  // una sola: el primer Atrás volvía al hub, pero el segundo ya sacaba de Plan (QA 2026-09-16).
  useBackClose(!!open && (view==="list"||view==="afford"), pop);
  // Dialog a11y: foco inicial/restore SOLO al abrir/cerrar el hub (deps=[open]).
  // Si remonta al cambiar detail/addStep, el cleanup restaura foco y el rAF roba el h1
  // detrás de la ficha (Claude BAJA + Codex 2100Z).
  React.useEffect(function(){
    if(!open) return undefined;
    prevFocus.current=document.activeElement;
    var id=requestAnimationFrame(function(){ if(titleRef.current) titleRef.current.focus(); });
    var onKey=function(e){
      if(document.documentElement.classList.contains("ask-open")) return;
      if(detailRef.current||addStepRef.current){
        // Hojas hijas (portal) atrapan Tab/Escape en capture; aquí no robamos foco.
        return;
      }
      if(e.key==="Escape"){ e.preventDefault(); popRef.current&&popRef.current(); return; }
      if(e.key!=="Tab"||!rootRef.current) return;
      var nodes=rootRef.current.querySelectorAll('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      var list=Array.prototype.filter.call(nodes,function(el){ return !el.disabled&&el.offsetParent!==null; });
      if(!list.length) return;
      var first=list[0], last=list[list.length-1];
      // Título con tabIndex=-1 no está en la lista: sin esto el Tab se escapa al DOM de detrás.
      var idx=list.indexOf(document.activeElement);
      if(!rootRef.current.contains(document.activeElement)||idx===-1){
        e.preventDefault(); (e.shiftKey?last:first).focus(); return;
      }
      if(e.shiftKey&&idx===0){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&idx===list.length-1){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return function(){
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      var el=prevFocus.current;
      if(el&&typeof el.focus==="function") try{ el.focus(); }catch(err){}
    };
  },[open]);
  // Al cerrar ficha/alta: devolver foco al control que las abrió (Codex 2100Z).
  React.useEffect(function(){
    var sheet=!!(detail||addStep);
    if(hadSheetRef.current&&!sheet&&open){
      var el=openerRef.current;
      var id=requestAnimationFrame(function(){
        if(el&&typeof el.focus==="function"&&(!rootRef.current||rootRef.current.contains(el))){
          try{ el.focus(); }catch(err){}
        }
      });
      hadSheetRef.current=false;
      return function(){ cancelAnimationFrame(id); };
    }
    hadSheetRef.current=sheet;
    return undefined;
  },[detail, addStep, open]);
  const hero=billsHeroTotal(state,totals);
  const shownHero=useCountUp(hero,!!open,true);
  if(!open) return null;
  const banks=Array.from(new Set((state.accounts||[]).map(function(a){ return a.ent; }).filter(Boolean)));
  if(!banks.length) banks.push("sabadell");
  const billBanks=(state.accounts||[]).filter(function(a){
    const r=accRole(a); return r==="fijos"||r==="ambos"||!a.role;
  });
  const bankList=billBanks.length?billBanks.map(function(a){ return a.ent; }):banks;
  const nAll=billsCountAll(state,cm,cy);
  const groupMeta=function(id){
    const n=billsGroupRows(state,id,cm,cy).length;
    const total=billsGroupMonthly(state,id,cm,cy);
    if(id==="serv") return {id:id,emoji:"💡",title:gbTxt("gb_g_serv"),sub:gbSub("gb_g_serv_sub",n),total:total,n:n};
    if(id==="debt") return {id:id,emoji:"💳",title:gbTxt("gb_g_debt"),
      sub:simple?gbTxt(n===1?"gb_g_debt_sub_simple_one":"gb_g_debt_sub_simple",{n:n}):gbSub("gb_g_debt_sub",n),total:total,n:n};
    if(id==="in") return {id:id,emoji:"💰",title:gbTxt("gb_g_in"),sub:gbTxt("gb_g_in_sub"),total:total,n:n};
    return {id:id,emoji:"📅",title:gbTxt("gb_g_once"),sub:gbSub("gb_g_once_sub",n),total:total,n:n,once:true};
  };
  const groups=["serv","debt","in","once"].map(groupMeta);
  /* La ola representa exactamente la cifra «se te van cada mes»: servicios y cuotas. Ingresos
     y cargos puntuales siguen en sus grupos, pero meterlos aquí falsearía el reparto del total. */
  const heroGroups=groups.filter(function(g){ return (g.id==="serv"||g.id==="debt")&&g.total>0; });
  const push=function(v){ setStack(function(s){ return s.concat([v]); }); };
  const openGroup=function(id){ setGroup(id); setQ(""); push("list"); };
  const openDetail=function(row){ openerRef.current=document.activeElement; setDetail(row); };
  const startAdd=function(kind){
    openerRef.current=document.activeElement;
    setAddForm({name:"",amount:"",freq:"mes",months:[],day:"",when:"",account:bankList[0]||"sabadell",kind:kind||"fixed",
      month:cm, year:cy, flowKind:"income"});
    setAddStep("what");
  };
  const removeWithUndo=function(row){
    const snap={kind:row.kind, item:Object.assign({},row.item)};
    if(row.kind==="fixed") removeFixedById(set,row.id);
    else if(row.kind==="flow") removeFlowById(set,row.id);
    else if(row.kind==="oneoff") removeOneoffById(set,row.id);
    else return;
    setDetail(null);
    if(undoTimer.current) clearTimeout(undoTimer.current);
    setUndoBill(snap);
    undoTimer.current=setTimeout(function(){ setUndoBill(null); undoTimer.current=null; },5000);
  };
  const undoLastBill=function(){
    if(!undoBill) return;
    if(undoTimer.current){ clearTimeout(undoTimer.current); undoTimer.current=null; }
    if(undoBill.kind==="fixed") addFixedItem(set,undoBill.item);
    else if(undoBill.kind==="flow") addFlowItem(set,undoBill.item);
    else if(undoBill.kind==="oneoff") addOneoffItem(set,undoBill.item);
    setUndoBill(null);
  };
  const listRows=(function(){
    if(view!=="list"&&view!=="hub") return [];
    let rows=group?billsGroupRows(state,group,cm,cy):[];
    if(view==="hub"&&q.trim()){
      const qq=q.trim().toLowerCase();
      rows=["serv","debt","in","once"].reduce(function(a,g){ return a.concat(billsGroupRows(state,g,cm,cy)); },[])
        .filter(function(r){ return String(r.name||"").toLowerCase().indexOf(qq)>=0; });
    } else if(q.trim()){
      const qq=q.trim().toLowerCase();
      rows=rows.filter(function(r){ return String(r.name||"").toLowerCase().indexOf(qq)>=0; });
    }
    return rows.map(function(r){
      if(r.kind==="debt") return Object.assign({},r,{locked:!simple});
      return r;
    });
  })();
  const billRow=function(r){
    const attrs={"data-bill-id":r.id};
    if(r.locked) attrs["data-locked"]="1";
    return React.createElement("button",Object.assign({type:"button",className:"v4-mov v4-bills-row",key:r.kind+"_"+r.id,onClick:function(){ openDetail(r); }},attrs),
      React.createElement("div",{className:"tile v4-bill-kind-icon","data-bill-icon":billGlyph(r),"aria-hidden":"true"}, billGlyph(r)),
      React.createElement("div",{className:"nm"},
        React.createElement("div",{className:"nm-title"}, r.name||"—"),
        React.createElement("div",{className:"meta"}, r.locked?gbTxt("gb_locked"):entOf(r.bank).label)),
      React.createElement("div",{className:"am num"+(r.income?" pos":"")}, (r.income?"+":"")+eur(Math.abs(r.monthly||0))));
  };
  const head=function(title,active){
    // La pantalla padre queda pintada debajo mientras la hija acompaña al dedo. Solo el título
    // activo recibe el foco y etiqueta el diálogo; así no duplicamos IDs ni tabulamos por detrás.
    return React.createElement("div",{className:"settings-push-h"},
      React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:pop},"‹"),
      React.createElement("h1",{id:active&&"bills-manage-title",tabIndex:-1,ref:active?titleRef:null}, title));
  };
  const hub=React.createElement("div",{className:"v4-bills-hub","data-screen":"bills-home",inert:view!=="hub"?"":undefined},
    head(gbTxt("gb_title"),view==="hub"),
    React.createElement("div",{className:"v4-card v4-card-hero v4-bills-hero","data-bills-hero":"1"},
      React.createElement("div",{className:"v4-micro"}, gbTxt("gb_hero_label")),
      React.createElement("div",{className:"serif num v4-bills-hero-amt","data-bills-total":"1"}, eur(shownHero)),
      React.createElement("div",{className:"v4-bills-hero-sub"}, gbSub("gb_hero_sub",nAll)),
      hero>0 && React.createElement("div",{className:"v4-stackbar v4-bills-hero-bar","data-bills-wave":"1","aria-hidden":"true"},
        heroGroups.map(function(g,i){
          const colors=["var(--mint)","var(--blue)"];
          return React.createElement("i",{key:g.id,style:{flex:Math.max(.02,g.total/hero*100),background:colors[i%colors.length]}});
        }))),
    React.createElement("div",{className:"v4-bills-search-row"},
      React.createElement("input",{className:"v4-bills-search","data-bills-search":"1",value:q,placeholder:gbTxt("gb_search"),
        onChange:function(e){ setQ(e.target.value); }}),
      React.createElement("button",{type:"button",className:"v4-bills-add","data-act":"bill-add",onClick:function(){ startAdd("fixed"); },
        "aria-label":gbTxt("gb_add")},"+")),
    q.trim()
      ? React.createElement("div",{className:"v4-bills-list"},
          listRows.length===0 && React.createElement("div",{className:"v4-bills-empty","data-bills-noresults":"1"}, gbTxt("gb_search_empty")),
          listRows.map(billRow))
      : React.createElement("div",{className:"v4-bills-groups"},
          groups.filter(function(g){ return g.n>0; }).map(function(g){
            return React.createElement("button",{type:"button",className:"v4-bills-group",key:g.id,"data-group":g.id,onClick:function(){ openGroup(g.id); }},
              React.createElement("div",{className:"v4-bills-group-tile"}, g.emoji),
              React.createElement("div",{className:"v4-bills-group-copy"},
                React.createElement("div",{className:"v4-bills-group-t"}, g.title),
                React.createElement("div",{className:"v4-bills-group-s"}, g.sub)),
              React.createElement("div",{className:"v4-bills-group-amt serif num"},
                eur(g.total), React.createElement("span",null, g.once?" "+gbTxt("gb_this_month"):" "+gbTxt("gb_per_month"))),
              React.createElement("span",{className:"v4-bills-group-chev"},"›"));
          }),
          nAll===0 && React.createElement("div",{className:"v4-empty","data-bills-empty":"1"},
            React.createElement("div",{className:"em"},"🧾"),
            React.createElement("div",{className:"ti"}, gbTxt("gb_empty")),
            React.createElement("div",{className:"ph"}, gbTxt("gb_empty_sub")),
            React.createElement("button",{type:"button",className:"v4-cta cta","data-act":"bill-empty-add",onClick:function(){ startAdd("fixed"); }}, gbTxt("gb_add")))),
    React.createElement("button",{type:"button",className:"v4-bills-afford","data-bills-afford":"1",onClick:function(){ push("afford"); }},
      React.createElement("div",{className:"v4-bills-afford-t"}, gbTxt("gb_afford")),
      React.createElement("div",{className:"v4-bills-afford-s"}, gbTxt("gb_afford_sub")))
  );
  const listView=React.createElement("div",{className:"v4-bills-hub","data-screen":"bills-group","data-group":group||""},
    head((groups.find(function(g){ return g.id===group; })||{}).title||gbTxt("gb_title"),view==="list"),
    React.createElement("div",{className:"v4-bills-search-row"},
      React.createElement("input",{className:"v4-bills-search","data-bills-search":"1",value:q,placeholder:gbTxt("gb_search"),
        onChange:function(e){ setQ(e.target.value); }}),
      group!=="debt" && React.createElement("button",{type:"button",className:"v4-bills-add","data-act":"bill-add",onClick:function(){
        startAdd(group==="in"?"flow":(group==="once"?"oneoff":"fixed"));
      },"aria-label":gbTxt("gb_add")},"+")),
    React.createElement("div",{className:"v4-bills-list"},
      listRows.map(billRow),
      listRows.length===0 && React.createElement("div",{className:"v4-bills-empty","data-bills-empty":"1"}, gbTxt("gb_empty")))
  );
  const affordView=React.createElement("div",{className:"v4-bills-hub","data-screen":"bills-afford"},
    head(gbTxt("gb_afford"),view==="afford"),
    React.createElement("div",{className:"v4-bills-afford-body"},
      React.createElement(AffordSim,{state:state,totals:totals,set:set})));
  const screenAttr=view==="list"?"bills-group":(view==="afford"?"bills-afford":"bills-home");
  return ReactDOM.createPortal(
    React.createElement(React.Fragment,null,
      React.createElement("div",{ref:rootRef,className:"settings-push open v4-bills-push mc-page-enter","data-bills-manage":"1","data-screen":screenAttr,
        role:"dialog","aria-modal":"true","aria-labelledby":"bills-manage-title"},
        hub,
        view!=="hub" && React.createElement("div",{ref:subRef,className:"settings-push open v4-bills-push mc-page-enter"}, view==="list"?listView:affordView)),
      detail && React.createElement(BillsItemSheet,{
        row:detail, set:set, banks:bankList, simple:simple, showToast:showToast,
        onClose:closeDetail, onRemove:removeWithUndo
      }),
      addStep && React.createElement(BillsAddWizard,{
        step:addStep, setStep:setAddStep, form:addForm, setForm:setAddForm, banks:bankList,
        onClose:closeAdd, set:set, showToast:showToast
      }),
      undoBill && React.createElement("div",{className:"v4-undo-toast",role:"status"},
        React.createElement("span",null, gbTxt("gb_removed")),
        React.createElement("button",{type:"button",onClick:undoLastBill}, t("f_undo")||"Deshacer"))
    ),
    document.body);
}

function BillsItemSheet({row, set, banks, simple, showToast, onClose, onRemove}){
  const item=row.item;
  const locked=row.kind==="debt"&&!simple;
  const [name,setName]=React.useState(item.name||"");
  const [amount,setAmount]=React.useState("");
  const [freq,setFreq]=React.useState(item.freq||"mes");
  const [months,setMonths]=React.useState((item.months||[]).slice());
  const [day,setDay]=React.useState(item.day?String(item.day):"");
  const [when,setWhen]=React.useState(item.when||"");
  const [account,setAccount]=React.useState(row.bank||banks[0]||"sabadell");
  const [amort,setAmort]=React.useState(item.amort!=null?String(item.amort):"");
  const hasSched=hasSchedule(item);
  const titleRef=React.useRef(null);
  const sideRef=React.useRef(null);
  const swipe=useSheetSwipe(true,onClose);
  const side=useEdgePageClose(true,onClose,true,sideRef);
  const sheetRef=swipe.sheetRef;
  const titleId="bills-item-title";
  React.useEffect(function(){ setAmount(""); },[row.id]);
  useBackClose(true, side.close);
  // Portal hermano del hub: dialog propio con trap/Escape; restore lo hace el hub (Codex 2050/2100Z).
  // deps=[]: si [onClose] remonta, cada tecla (saveMeta→set) reenfoca el h1 (Claude NO-GO / Codex 2120Z).
  React.useEffect(function(){
    var id=requestAnimationFrame(function(){ if(titleRef.current) titleRef.current.focus(); });
    var onKey=function(e){
      if(document.documentElement.classList.contains("ask-open")) return;
      if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); side.close(); return; }
      if(e.key!=="Tab"||!sheetRef.current) return;
      // Siempre cortar: el hub escucha en bubble y ve foco fuera de rootRef (portal) → lo robaba (Codex 2105Z).
      e.stopPropagation();
      var nodes=sheetRef.current.querySelectorAll('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      var list=Array.prototype.filter.call(nodes,function(el){ return !el.disabled&&el.offsetParent!==null; });
      if(!list.length) return;
      var first=list[0], last=list[list.length-1];
      var idx=list.indexOf(document.activeElement);
      if(!sheetRef.current.contains(document.activeElement)||idx===-1){
        e.preventDefault(); (e.shiftKey?last:first).focus(); return;
      }
      if(e.shiftKey&&idx===0){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&idx===list.length-1){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return function(){
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey, true);
      // Restore lo hace el hub (openerRef); aquí no pisar ese foco (Codex 2100Z).
    };
  },[]);
  const saveAmt=function(){
    if(locked||hasSched) return;
    const n=parseFloat(String(amount).replace(",","."));
    if(!isFinite(n)||String(amount).trim()==="") return;
    if(row.kind==="fixed") patchFixedById(set,item.id,{amount:n});
    else if(row.kind==="flow") patchFlowById(set,item.id,{amount:Math.abs(n)});
    else if(row.kind==="oneoff") patchOneoffById(set,item.id,{amount:n});
    else if(row.kind==="debt"&&simple) patchDebtFields(set,item.id,{monthly:n});
    if(showToast) showToast(gbTxt("gb_save_ok"));
    swipe.close();
  };
  const saveMeta=function(patch){
    if(locked) return;
    if(row.kind==="fixed") patchFixedById(set,item.id,patch);
    else if(row.kind==="flow") patchFlowById(set,item.id,patch);
    else if(row.kind==="oneoff") patchOneoffById(set,item.id,patch);
    else if(row.kind==="debt"&&simple) patchDebtFields(set,item.id,patch);
  };
  const freqs=[["mes","gb_freq_m"],["bimestral","gb_freq_2m"],["trimestral","gb_freq_3m"],["semestral","gb_freq_6m"],["año","gb_freq_y"]];
  return React.createElement("div",{ref:sideRef,className:"v4-sheet-back",onClick:swipe.close},
    React.createElement("div",Object.assign({ref:sheetRef,className:"v4-sheet","data-sheet":"bill",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
      onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"settings-push-h",style:{padding:"0 0 8px"}},
        React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:side.close},"‹"),
        React.createElement("h1",{id:titleId,tabIndex:-1,ref:titleRef}, name||row.name||"—")),
      !locked && React.createElement("input",{className:"v4-bills-search",value:name,placeholder:t("pt_name_ph"),
        onChange:function(e){ const v=e.target.value; setName(v); saveMeta({name:v}); }}),
      React.createElement("div",{className:"v4-account-balance",style:{marginTop:12}},
        React.createElement("div",{className:"v4-micro"}, locked?gbTxt("gb_locked"):t("pt_ficha_saldo")),
        React.createElement("div",{className:"v4-account-amount serif num"}, eur(Math.abs(row.monthly||item.amount||0))),
        hasSched && React.createElement("div",{className:"hint"}, gbTxt("gb_bill_locked_amt")),
        !locked && !hasSched && React.createElement("div",{className:"v4-account-correct",style:{marginTop:10}},
          React.createElement("div",{className:"v4-account-correct-amount serif num"}, amount?eur(parseNumPadRaw(amount)):"—"),
          React.createElement(NumPad,{value:amount,onChange:function(next){
            setAmount(function(prev){ return typeof next==="function"?next(prev):next; });
          }}),
          React.createElement("button",{type:"button",className:"v4-bills-add",style:{width:"100%",marginTop:8},onClick:saveAmt}, t("done")))),
      row.kind==="fixed" && !locked && React.createElement("div",{style:{marginTop:14}},
        React.createElement("div",{className:"v4-ficha-k"}, gbTxt("gb_step_how_often")),
        freqs.map(function(f){
          const on=freq===f[0];
          return React.createElement("button",{key:f[0],type:"button",className:"v4-ficha-op"+(on?" on":""),
            onClick:function(){ setFreq(f[0]); const p={freq:f[0]}; if(f[0]==="mes"){ p.months=[]; } setMonths(f[0]==="mes"?[]:months); saveMeta(p); }},
            React.createElement("span",{className:"v4-ficha-radio"}),
            React.createElement("span",{className:"v4-ficha-ot"}, gbTxt(f[1])));
        }),
        freq!=="mes" && React.createElement("div",{style:{marginTop:8}},
          React.createElement("div",{className:"v4-ficha-k"}, gbTxt("gb_months_q")),
          React.createElement(MonthPicker,{selected:months,onToggle:function(m){
            setMonths(function(cur){
              const n=cur.slice(); const i=n.indexOf(m); if(i>=0) n.splice(i,1); else n.push(m);
              saveMeta({months:n.slice().sort(function(a,b){ return a-b; }), freq:freq});
              return n;
            });
          }}))),
      (row.kind==="flow"||row.kind==="fixed"||(row.kind==="debt"&&simple)) && React.createElement("div",{style:{marginTop:14}},
        React.createElement("div",{className:"v4-ficha-k"}, gbTxt("gb_step_when")),
        row.kind==="flow" && [["","gb_when_day"],["first","gb_when_first"],["last","gb_when_last"]].map(function(w){
          const on=(when||"")===w[0];
          return React.createElement("button",{key:w[0]||"day",type:"button",className:"v4-ficha-op"+(on?" on":""),
            onClick:function(){ setWhen(w[0]); if(w[0]){ setDay(""); saveMeta({when:w[0], day:null}); } else saveMeta({when:"", day:cleanDay(day)}); }},
            React.createElement("span",{className:"v4-ficha-radio"}),
            React.createElement("span",{className:"v4-ficha-ot"}, gbTxt(w[1])));
        }),
        (!when) && React.createElement("input",{className:"v4-bills-search",inputMode:"numeric",placeholder:t("fj_day"),value:day,
          onChange:function(e){ const v=e.target.value; setDay(v); saveMeta({day:cleanDay(v), when:""}); }})),
      !locked && React.createElement("div",{style:{marginTop:14}},
        React.createElement("div",{className:"v4-ficha-k"}, gbTxt("gb_step_account")),
        bankListButtons(banks, account, function(b){ setAccount(b); const p=row.kind==="flow"?(item.kind==="income"?{to:b}:{from:b}):{account:b}; saveMeta(p); })),
      row.kind==="debt"&&simple && React.createElement("input",{className:"v4-bills-search",style:{marginTop:8},value:amort,placeholder:t("fj_amort"),
        onChange:function(e){ setAmort(e.target.value); }, onBlur:function(){ const n=parseFloat(String(amort).replace(",",".")); if(isFinite(n)) saveMeta({amort:n}); }}),
      !locked && row.kind!=="debt" && React.createElement("button",{type:"button",className:"v4-ficha-quitar","data-act":"bill-remove",style:{width:"100%",marginTop:16},
        onClick:function(){ onRemove(row); }}, gbTxt("gb_del")),
      locked && React.createElement("div",{className:"hint",style:{marginTop:16}}, gbTxt("gb_locked"))
    ));
}

function bankListButtons(banks, current, onPick){
  return React.createElement("div",{className:"v4-bills-banks"},
    (banks||[]).map(function(b){
      return React.createElement("button",{type:"button",key:b,className:"v4-bills-bank"+(current===b?" on":""),onClick:function(){ onPick(b); }},
        React.createElement(Mono,{ent:b,size:28}), entOf(b).label);
    }));
}

function BillsAddWizard({step, setStep, form, setForm, banks, onClose, set, showToast}){
  const setF=function(patch){ setForm(function(f){ return Object.assign({},f,patch); }); };
  const freqs=[["mes","gb_freq_m"],["bimestral","gb_freq_2m"],["trimestral","gb_freq_3m"],["semestral","gb_freq_6m"],["año","gb_freq_y"]];
  const stepRef=React.useRef(step), formRef=React.useRef(form);
  const savedRef=React.useRef(false);
  const titleRef=React.useRef(null);
  const onCloseRef=React.useRef(onClose);
  onCloseRef.current=onClose;
  const swipe=useSheetSwipe(true,function(){ onCloseRef.current&&onCloseRef.current(); });
  const sheetRef=swipe.sheetRef;
  const titleId="bills-add-title";
  stepRef.current=step; formRef.current=form;
  const stepBack=React.useCallback(function(){
    const cur=stepRef.current, f=formRef.current||{};
    if(cur==="what"){ swipe.close(); return false; }
    if(cur==="amount") setStep("what");
    else if(cur==="freq"||cur==="monthyear") setStep("amount");
    else if(cur==="months") setStep("freq");
    else if(cur==="when"||cur==="preview") setStep(f.kind==="oneoff"?"monthyear":(f.freq==="mes"?"freq":"months"));
    else { swipe.close(); return false; }
    return true;
  },[setStep]);
  const entryRef=React.useRef(null), stepBackRef=React.useRef(stepBack);
  stepBackRef.current=stepBack;
  React.useEffect(function(){
    _mcBackInitOnce();
    const arm=function(){
      const e={close:function(){ if(stepBackRef.current()) arm(); },_byPop:false};
      entryRef.current=e;
      _mcBackStack.push(e);
      try{ history.pushState({mcOverlay:true}, ""); }catch(err){}
    };
    arm();
    return function(){
      const e=entryRef.current; if(!e) return;
      const i=_mcBackStack.indexOf(e); if(i>=0) _mcBackStack.splice(i,1);
      if(!e._byPop){ _mcIgnorePop=true; try{ history.back(); }catch(err){ _mcIgnorePop=false; } }
      entryRef.current=null;
    };
  },[]);
  // Solo reenfocar título al cambiar de paso — nunca al teclear el form (Codex 2120Z).
  React.useEffect(function(){
    var id=requestAnimationFrame(function(){ if(titleRef.current) titleRef.current.focus(); });
    return function(){ cancelAnimationFrame(id); };
  },[step]);
  // Trap Tab/Escape estable (stepBack vía ref).
  React.useEffect(function(){
    var onKey=function(e){
      if(document.documentElement.classList.contains("ask-open")) return;
      if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); stepBackRef.current&&stepBackRef.current(); return; }
      if(e.key!=="Tab"||!sheetRef.current) return;
      e.stopPropagation();
      var nodes=sheetRef.current.querySelectorAll('button,a,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      var list=Array.prototype.filter.call(nodes,function(el){ return !el.disabled&&el.offsetParent!==null; });
      if(!list.length) return;
      var first=list[0], last=list[list.length-1];
      var idx=list.indexOf(document.activeElement);
      if(!sheetRef.current.contains(document.activeElement)||idx===-1){
        e.preventDefault(); (e.shiftKey?last:first).focus(); return;
      }
      if(e.shiftKey&&idx===0){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&idx===list.length-1){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return function(){ document.removeEventListener("keydown", onKey, true); };
  },[]);
  const commit=function(){
    if(savedRef.current) return;
    const amt=parseFloat(String(form.amount).replace(",","."))||0;
    if(!(amt>0)) return;
    // La hoja sigue montada durante la salida. Sin este guardo, dos toques rápidos creaban
    // dos recibos distintos antes de que acabara la animación (feedback 2026-09-18, punto 12).
    savedRef.current=true;
    if(form.kind==="flow"){
      const it={id:uid(),kind:form.flowKind||"income",name:form.name||(form.flowKind==="income"?"Ingreso":"Movimiento"),amount:amt};
      if(form.when) it.when=form.when; else { const d=cleanDay(form.day); if(d) it.day=d; }
      if(it.kind==="income") it.to=form.account; else { it.from=form.account; it.to=banks.find(function(b){ return b!==form.account; })||form.account; }
      addFlowItem(set,it);
    } else if(form.kind==="oneoff"){
      const it={id:uid(),name:form.name||"Cargo",amount:amt,month:form.month,year:form.year,account:form.account};
      const d=cleanDay(form.day); if(d) it.day=d;
      addOneoffItem(set,it);
    } else {
      const it={id:uid(),name:form.name||"Recibo",amount:amt,freq:form.freq||"mes",account:form.account};
      const d=cleanDay(form.day); if(d) it.day=d;
      if(form.freq!=="mes"&&form.months&&form.months.length) it.months=form.months.slice().sort(function(a,b){ return a-b; });
      addFixedItem(set,it);
    }
    if(showToast) showToast(gbTxt("gb_save_ok"));
    swipe.close();
  };
  const preview=function(){
    const amt=parseFloat(String(form.amount).replace(",","."))||0;
    if(!(amt>0)||form.kind!=="fixed") return null;
    const mEq=amt*(FREQ_M[form.freq]||1);
    if(form.freq==="mes") return gbTxt("gb_preview_m",{x:eur(mEq)});
    const ms=(form.months&&form.months.length)?form.months:chargeMonths({freq:form.freq,months:form.months});
    return gbTxt("gb_preview",{x:eur(mEq),total:eur(amt*(ms.length||1)),months:ms.map(function(m){ return monthShort(m-1); }).join(", ")});
  };
  const title=step==="what"?gbTxt("gb_step_what"):step==="amount"?gbTxt("gb_step_how_much"):
    step==="freq"?gbTxt("gb_step_how_often"):step==="months"?gbTxt("gb_months_q"):
    step==="monthyear"?gbTxt("gb_step_monthyear"):gbTxt("gb_step_when");
  return React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
    React.createElement("div",Object.assign({ref:sheetRef,className:"v4-sheet","data-sheet":"bill-add","data-step":step,role:"dialog","aria-modal":"true","aria-labelledby":titleId,
      onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"settings-push-h",style:{padding:"0 0 8px"}},
        React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:function(){ stepBack(); }},"‹"),
        React.createElement("h1",{id:titleId,tabIndex:-1,ref:titleRef}, title)),
      step==="what" && React.createElement(React.Fragment,null,
        React.createElement("input",{className:"v4-bills-search",autoFocus:true,value:form.name,placeholder:gbTxt("gb_step_what"),
          onChange:function(e){ setF({name:e.target.value}); }}),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"next",style:{marginTop:16},disabled:!String(form.name||"").trim(),
          onClick:function(){ setStep("amount"); }}, gbTxt("gb_next"))),
      step==="amount" && React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-account-correct-amount serif num"}, form.amount?eur(parseNumPadRaw(form.amount)):"—"),
        React.createElement(NumPad,{value:form.amount||"",onChange:function(next){ setF({amount:typeof next==="function"?next(form.amount||""):next}); }}),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"next",style:{marginTop:12},disabled:!(parseFloat(String(form.amount).replace(",","."))>0),
          onClick:function(){ setStep(form.kind==="oneoff"?"monthyear":"freq"); }}, t("done"))),
      step==="freq" && form.kind==="fixed" && React.createElement(React.Fragment,null,
        freqs.map(function(f){
          return React.createElement("button",{key:f[0],type:"button",className:"v4-ficha-op"+(form.freq===f[0]?" on":""),
            onClick:function(){ setF({freq:f[0], months:f[0]==="mes"?[]:(form.months||[])}); }},
            React.createElement("span",{className:"v4-ficha-radio"}),
            React.createElement("span",{className:"v4-ficha-ot"}, gbTxt(f[1])));
        }),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"next",style:{marginTop:12},onClick:function(){
          setStep(form.freq==="mes"?"when":"months");
        }}, t("done"))),
      step==="freq" && form.kind==="flow" && React.createElement(React.Fragment,null,
        [["income",gbTxt("gb_flow_income")],["transfer",gbTxt("gb_flow_move")]].map(function(k){
          return React.createElement("button",{key:k[0],type:"button",className:"v4-ficha-op"+(form.flowKind===k[0]?" on":""),
            onClick:function(){ setF({flowKind:k[0]}); }},
            React.createElement("span",{className:"v4-ficha-radio"}),
            React.createElement("span",{className:"v4-ficha-ot"}, k[1]));
        }),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"next",style:{marginTop:12},onClick:function(){ setStep("when"); }}, t("done"))),
      step==="months" && React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-ficha-k"}, gbTxt("gb_months_q")),
        React.createElement(MonthPicker,{selected:form.months||[],onToggle:function(m){
          setF({months:(function(){ const n=(form.months||[]).slice(); const i=n.indexOf(m); if(i>=0) n.splice(i,1); else n.push(m); return n; })()});
        }}),
        preview() && React.createElement("div",{className:"hint",style:{marginTop:10}}, preview()),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"next",style:{marginTop:12},onClick:function(){ setStep("when"); }}, t("done"))),
      step==="monthyear" && React.createElement(React.Fragment,null,
        React.createElement("div",{className:"af-row",style:{marginBottom:10}},
          React.createElement("input",{className:"v4-bills-search",inputMode:"numeric",value:String(form.month),onChange:function(e){ setF({month:parseInt(e.target.value,10)||1}); },placeholder:gbTxt("gb_month")}),
          React.createElement("input",{className:"v4-bills-search",inputMode:"numeric",value:String(form.year),onChange:function(e){ setF({year:parseInt(e.target.value,10)||new Date().getFullYear()}); },placeholder:gbTxt("gb_year")})),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"next",style:{marginTop:12},onClick:function(){ setStep("when"); }}, t("done"))),
      step==="when" && React.createElement(React.Fragment,null,
        form.kind==="flow" && [["","gb_when_day"],["first","gb_when_first"],["last","gb_when_last"]].map(function(w){
          return React.createElement("button",{key:w[0]||"d",type:"button",className:"v4-ficha-op"+((form.when||"")===w[0]?" on":""),
            onClick:function(){ setF({when:w[0], day:w[0]?"":form.day}); }},
            React.createElement("span",{className:"v4-ficha-radio"}),
            React.createElement("span",{className:"v4-ficha-ot"}, gbTxt(w[1])));
        }),
        !form.when && React.createElement("input",{className:"v4-bills-search",inputMode:"numeric",placeholder:t("fj_day"),value:form.day||"",
          onChange:function(e){ setF({day:e.target.value}); }}),
        React.createElement("div",{className:"v4-ficha-k",style:{marginTop:12}}, gbTxt("gb_step_account")),
        bankListButtons(banks, form.account, function(b){ setF({account:b}); }),
        form.kind==="fixed" && form.freq==="mes" && preview() && React.createElement("div",{className:"hint",style:{marginTop:10}}, preview()),
        React.createElement("button",{type:"button",className:"v4-cta","data-act":"confirm",style:{marginTop:16},onClick:commit}, gbTxt("gb_add_btn")))
    ));
}

function CarteraTab({state, set, totals, fetchPrices, pricing, simple, onBankSync, syncInv, onReconnectBank, showToast}){
  const [invTools,setInvTools]=useState(false);
  const invLinkRef=useRef(null);
  const closeInvestments=function(){
    setInvTools(false);
    // La pantalla hija devuelve el foco a la puerta que la abrio; sin esto, al cerrar con
    // Atrás el lector de pantalla se queda apuntando a un nodo que ya no existe.
    requestAnimationFrame(function(){ if(invLinkRef.current) invLinkRef.current.focus(); });
  };
  // TR desconectado (y el usuario SÍ lo tuvo conectado alguna vez → mc_tr_phone guardado):
  // banner con botón que abre Mis bancos directamente. UX padre 2026-07-18: al ver el saldo
  // descuadrado se fue a la app de Trade Republic — el arreglo debe estar donde está el problema.
  // Se reconsulta al volver a primer plano y cuando App avisa por `mc-tr-status` (antes solo
  // miraba al montar y el banner se quedaba mudo tras un sync que caducaba la sesión).
  const [trDead,setTrDead]=useState(false);
  useEffect(function(){
    const check=function(){
      const b=(typeof trBridge==="function")?trBridge():null;
      if(!b||!b.status) return;
      if(!(typeof trPhoneSaved==="function"&&trPhoneSaved())){ setTrDead(false); return; }
      /* Un flag `connected=false` del puente no demuestra que la cookie haya muerto. Solo el
         resultado firme de un sync manual (`_trAuthExpired`) enciende este banner. */
      Promise.resolve(b.status()).then(function(r){
        setTrDead(!!(r&&r.authExpired) || (typeof trAuthExpiredSaved==="function"&&trAuthExpiredSaved()));
      }).catch(function(){});
    };
    check();
    const onVis=function(){ if(document.visibilityState==="visible") check(); };
    const onEvt=function(e){
      if(e&&e.detail&&typeof e.detail.connected==="boolean"){
        setTrDead(!!e.detail.authExpired || (typeof trAuthExpiredSaved==="function"&&trAuthExpiredSaved())); return;
      }
      check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("mc-tr-status", onEvt);
    return function(){
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mc-tr-status", onEvt);
    };
  },[]);
  // Qué compone el gráfico del hero: liquidez / inversiones / bienes, multiseleccionables
  // (petición 2026-07-18: «quiero ver inversiones + líquido, por ejemplo»). Todo ON por defecto.
  // Se PERSISTE en settings.carteraParts (petición 2026-07-18: «que se guarde tu elección aunque
  // cierres la app»): al arrancar se lee de ahí, y cada toque escribe el estado (sincroniza como todo).
  const savedParts=(state.settings&&state.settings.carteraParts)||null;
  const [selParts,setSelParts]=useState(savedParts||{liq:true,inv:true,goods:true});
  const [bankBusy,setBankBusy]=useState(false);
  const togglePart=function(k){
    setSelParts(function(p){
      const n=Object.assign({},p,{[k]:!p[k]});
      if(!n.liq&&!n.inv&&!n.goods) return p;   // dejar 0 marcados = gráfico vacío sin sentido
      set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,{carteraParts:n})}); });
      return n;
    });
  };
  const liq=totals.liquid||0, inv=totals.invested||0, goods=totals.assetsTotal||0;
  const parts=[
    {k:"liq",  v:liq,   color:"var(--mint)",  lab:t("d_liquid")},
    {k:"inv",  v:inv,   color:"var(--blue)",  lab:t("d_invest")},
    {k:"goods",v:goods, color:"var(--cream)", lab:t("d_goods")},
  ];
  const active=parts.filter(function(x){ return selParts[x.k]; });
  const allOn=active.length===3;
  const sum=Math.max(0.01, active.reduce(function(a,x){ return a+x.v; },0));
  // Con todo marcado el hero sigue siendo el patrimonio neto (deudas descontadas, como siempre);
  // con selección parcial enseña la suma de lo marcado (sin deudas — no aplican a un subconjunto).
  const heroLab=allOn ? t(simple?"v4_money_total":"d_networth")
    : t("v4_sel_partial")+" · "+active.map(function(x){ return x.lab; }).join(" + ");
  const doBankSync=function(){
    if(!onBankSync||bankBusy) return;
    setBankBusy(true);
    Promise.resolve(onBankSync()).finally(function(){ setBankBusy(false); });
  };
  /* B2 — count-up al ACTIVAR Cartera (bus), no al montar ni al «verse» por geometría.
     Premontaje e IntersectionObserver se probaron y fallan; el bus es el de Gastos. */
  const [carteraOn,setCarteraOn]=useState(false);
  useEffect(function(){ return mcOnCarteraActive(setCarteraOn); },[]);
  const heroTarget=allOn ? (totals.netWorth||0) : active.reduce(function(a,x){ return a+x.v; },0);
  const shownHero=useCountUp(heroTarget, carteraOn);
  const ph=eurParts(shownHero);
  return React.createElement("div",{className:"v4-screen"},
    React.createElement("h1",{className:"v4-title serif"}, t("v4_cartera_title")),
    React.createElement("div",{className:"v4-card v4-card-hero rise",style:{animationDelay:".05s"}},
      React.createElement("div",{className:"v4-micro"}, heroLab),
      React.createElement("div",{className:"serif num cartera-hero-amt",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6}},
        ph.ent, React.createElement("span",{style:{fontSize:22,color:"var(--muted)"}},","+ph.dec+" "+ph.sym)),
      React.createElement("div",{className:"v4-stackbar",style:{marginTop:16}},
        active.map(function(x){
          return React.createElement("i",{key:x.k,style:{flex:Math.max(0.02,(x.v/sum)*100),background:x.color}});
        })
      ),
      React.createElement("div",{className:"v4-legend"},
        parts.map(function(x){
          const on=!!selParts[x.k];
          return React.createElement("button",{key:x.k,type:"button",className:"v4-legend-btn"+(on?"":" off"),
            "aria-pressed":on,onClick:function(){ togglePart(x.k); }},
            React.createElement("b",{style:{background:x.color}}), x.lab+" "+eur0(x.v));
        })
      ),
      allOn && React.createElement("div",{style:{marginTop:12,fontSize:13,color:"var(--muted)"}},
        t("v4_debts_foot_a"),
        React.createElement("span",{style:{color:"var(--coral)",fontWeight:700}}, " "+eur0(-(totals.debtTotal||0))+" "),
        t("v4_debts_foot_b"))
    ),
    // Banners de reconexión: el arreglo a UN toque, en la pantalla donde se VE el problema.
    (state.bankIssues||[]).map(function(is){
      const lbl=is.ent?entOf(is.ent).label:(is.aspsp||"🏦");
      // «noacct» = enlazado pero el banco no devuelve ninguna cuenta: el texto de «permiso
      // caducado» ahí despistaba, porque no hay ningún permiso que renovar (2026-07-24).
      const noacct=is.kind==="noacct";
      /* «pending» = se quedó a medio autorizar en el banco. No es un permiso caducado —nunca
         llegó a haberlo— ni un enlace sin cuentas: es que el viaje al banco no terminó. Hasta
         el 11/9 este caso no llegaba siquiera a la app (ver `bankIssuesOf`), así que su
         CaixaBank se quedó ahí semanas sin que nada lo dijera. */
      const pend=is.kind==="pending";
      /* TRADE REPUBLIC ENTRA POR DOS PUERTAS, Y SE ROMPEN POR SEPARADO (petición suya, 10/9:
         «estaría bien identificar cuándo falla por la api externa de trade republic y cuándo falla
         por open banking, me refiero a trade republic»).
         · Open Banking (esto): el permiso de Enable Banking. Es lo que trae sus COMPRAS con tarjeta.
           Se arregla con el OAuth del banco.
         · La API propia de TR (el banner de abajo): la sesión con PIN + SMS. Es lo que trae sus
           POSICIONES y su EFECTIVO. Se arregla dentro de la app.
         Hasta ahora los dos avisos decían «Trade Republic» y los dos decían «Reconectar Trade
         Republic», así que no había forma de saber cuál tocar — y tocar el que no era no hacía
         nada. Con cualquier otro banco esto no pasa: solo hay una puerta. */
      const esTR=is.ent==="trade_republic";
      return React.createElement("div",{key:"bi_"+is.aspsp,className:"v4-card v4-bank-issue",style:{marginTop:10,padding:"14px 16px",border:"1px solid rgba(226,112,95,.45)",background:"rgba(226,112,95,.08)"}},
        React.createElement("div",{style:{fontWeight:800,fontSize:14.5,lineHeight:1.4}},
          esTR ? t(noacct?"bk_tr_ob_noacct":"bk_tr_ob") : tf(pend?"bk_issue_pending":(noacct?"bk_issue_noacct":"bk_issue"),{bank:lbl})),
        React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:3,lineHeight:1.45}},
          esTR ? t("bk_tr_ob_sub") : t(pend?"bk_issue_pending_sub":(noacct?"bk_issue_noacct_sub":"bk_issue_sub"))),
        onReconnectBank && React.createElement("button",{type:"button",className:"v4-cta",style:{marginTop:10,height:46},onClick:function(){ onReconnectBank(is.aspsp); }},
          esTR ? t("bk_tr_ob_cta") : tf("bk_issue_cta",{bank:lbl}))
      );
    }),
    trDead && React.createElement("div",{className:"v4-card v4-tr-issue",style:{marginTop:10,padding:"14px 16px",border:"1px solid rgba(226,112,95,.45)",background:"rgba(226,112,95,.08)"}},
      React.createElement("div",{style:{fontWeight:800,fontSize:14.5,lineHeight:1.4}}, t("bk_tr_dead")),
      React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:3,lineHeight:1.45}}, t("bk_tr_sub")),
      // TR no es Open Banking: el CTA abre Mis bancos con la tarjeta de TR desplegada (PIN+SMS),
      // nunca un OAuth de Enable Banking.
      React.createElement("button",{type:"button",className:"v4-cta",style:{marginTop:10,height:46},onClick:function(){ try{ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:"trade_republic"}})); }catch(e){} }}, t("bk_tr_cta"))
    ),
    /* BLOQUES ORDENABLES (petición 2026-07-25: «poder ordenar las cosas de la tab de cartera»).
       Mismo mecanismo que ya usan Fijos/Patrimonio/Deudas/Inversiones/Metas desde la 3.94:
       `OrderableSections` guarda el orden en settings.secOrder.cartera, así que viaja con la
       cuenta y está en el sitio donde el usuario ya sabe buscarlo («⇅ Ordenar secciones» al pie).
       Se inventó un mecanismo nuevo cero: el que había ya hacía justo esto. */
    React.createElement(OrderableSections,{tab:"cartera",state:state,set:set,items:[
      { id:"cuentas", label:t("v4_cuentas"), el:React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-sec-h",style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}},
          React.createElement("span",null, t("v4_cuentas")),
          /* DOS ICONOS, NO DOS PÍLDORAS DE TEXTO (11/9). Con «Conectar cuentas» y «↻ Sincronizar
             bancos» escritos, el título se partía en dos líneas en su móvil. Llevan su `title` y
             su `aria-label`, así que no se pierde el nombre para quien lo necesite. */
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:7,flex:"0 0 auto"}},
            // Sync a demanda: el auto-sync al abrir la app se retiró (los bancos veían «bot» y
            // caducaban la conexión cada dos por tres — feedback 2026-07-18).
            state.hasBankLink && onBankSync && React.createElement("button",{type:"button",
              className:"v4-ic-mini"+(bankBusy?" girando":""),disabled:bankBusy,onClick:doBankSync,
              title:bankBusy?t("bp_syncing"):t("v4_sync_banks"),"aria-label":t("v4_sync_banks")},
              React.createElement("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round"},
                React.createElement("path",{d:"M20 11a8 8 0 0 0-13.7-5.7L3 8"}),
                React.createElement("path",{d:"M3 3v5h5"}),
                React.createElement("path",{d:"M4 13a8 8 0 0 0 13.7 5.7L21 16"}),
                React.createElement("path",{d:"M21 21v-5h-5"}))),
            // Misma puerta que Inicio → Próximos cargos (11/9): sin esto solo se conectaba
            // desde ahí o desde Ajustes, y en Cartera → Tus cuentas no había forma.
            React.createElement("button",{type:"button",className:"v4-ic-mini",
              title:t("v4_connect_accounts"),"aria-label":t("v4_connect_accounts"),
              onClick:function(){ try{ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})); }catch(e){} }},
              React.createElement("svg",{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round"},
                React.createElement("path",{d:"M3 9.5 12 4l9 5.5"}),
                React.createElement("path",{d:"M5 10v8M10 10v8M14 10v5M19 10v3"}),
                React.createElement("path",{d:"M3 20h11"}),
                React.createElement("path",{d:"M18 16v6M15 19h6"})))
          )
        ),
        React.createElement(Wealth,{state:state,set:set,totals:totals,v4Embed:true,parte:"cuentas",showToast:showToast,
          onBankSync:doBankSync,onReconnectBank:onReconnectBank,bankBusy:bankBusy})
      ) },
      // Bienes (piso, coche…) es su propio bloque: no son cuentas de banco y el usuario quiere
      // colocarlos donde le apetezca (feedback 2026-07-25).
      (state.assets||[]).length>0 && { id:"bienes", label:t("pt_goods"), el:React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-sec-h"}, t("pt_goods")),
        React.createElement(Wealth,{state:state,set:set,totals:totals,v4Embed:true,parte:"bienes"})
      ) },
      !simple && { id:"inversiones", label:t("v4_inversiones"), el:React.createElement("div",{className:"rise",style:{animationDelay:".12s"}},
        React.createElement("div",{className:"v4-sec-h"}, t("v4_inversiones")),
        React.createElement(Investments,{state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,syncInv:syncInv,v4Embed:true,showToast:showToast}),
        React.createElement("button",{type:"button",className:"v4-link-mini",style:{marginTop:10},ref:invLinkRef,onClick:function(){ setInvTools(true); }}, t("iv_see_all")+" ›")
      ) }
    ]}),
    // La hija vive FUERA de los bloques ordenables: es un portal, no una sección, y meterla
    // dentro la desmontaría al reordenar (cerrándose sola a media consulta).
    !simple && React.createElement(InvestmentsPush,{open:invTools,onClose:closeInvestments,state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,syncInv:syncInv,showToast:showToast})
  );
}

function InvestmentsPush({open, onClose, state, set, fetchPrices, pricing, syncInv, showToast}){
  const tr=useRef(null), sr=useRef(null);
  const [shown,setShown]=useState(false);
  // Inversiones y Gestionar comparten compositor: el arrastre web nace en cualquier punto y el
  // borde nativo de Android 14+ entrega su progreso real sin esperar a que se levante el dedo.
  const pageSwipe=useEdgePageClose(!!open,onClose,!!open,sr);
  const closePush=pageSwipe.close;
  useBackClose(!!open, closePush);
  useLayoutEffect(function(){
    if(!open) return undefined;
    let e2=0;
    const e1=requestAnimationFrame(function(){ e2=requestAnimationFrame(function(){ setShown(true); }); });
    mcSheetLock();
    return function(){
      cancelAnimationFrame(e1); if(e2) cancelAnimationFrame(e2);
      mcSheetUnlock(); setShown(false);
    };
  },[open]);
  useEffect(function(){
    if(!open) return undefined;
    const id=requestAnimationFrame(function(){ if(tr.current) tr.current.focus(); });
    const keydown=function(e){
      const root=sr.current;
      if(!root) return;
      // AskHost vive por encima de esta pantalla. Mientras esté abierto, su diálogo es quien
      // posee Escape y Tab; interceptarlos aquí cerraba Inversiones o sacaba el foco del aviso.
      if(document.documentElement.classList.contains("ask-open")) return;
      if(e.key==="Escape"){ e.preventDefault(); closePush(); return; }
      if(e.key!=="Tab") return;
      const focusable=Array.from(root.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'))
        .filter(function(el){ return el.getClientRects().length>0; });
      if(!focusable.length){ e.preventDefault(); tr.current&&tr.current.focus(); return; }
      const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
      const at=focusable.indexOf(active);
      if(e.shiftKey&&at<=0){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&(at<0||active===last)){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown",keydown);
    return function(){ cancelAnimationFrame(id); document.removeEventListener("keydown",keydown); };
  },[open]);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"settings-push v4-investments-push"+(shown?" open":""),"data-inv-screen":"1",ref:sr,role:"dialog","aria-modal":"true","aria-labelledby":"iv-screen-title"},
      React.createElement("div",{className:"settings-push-h"},
        React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:closePush},"‹"),
        React.createElement("h1",{id:"iv-screen-title",tabIndex:-1,ref:tr}, t("iv_title"))
      ),
      React.createElement(Investments,{state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,syncInv:syncInv,fullMode:true,showToast:showToast})
    ), document.body);
}

/* Sheet FAB «Apuntar» — teclado propio, gasto/ingreso (SPEC §7).
   La MONEDA DEL APUNTE es independiente de la de visualización (Ajustes → Dinero):
   en el crucero apuntas en ₺ y sigues viendo la app en € (feedback 2026-08-05).
   Se guarda siempre en €; sin tipo de cambio no se guarda — no inventamos el cambio. */
function ApuntarSheet({open, onClose, state, set, showToast, goGastos}){
  const [kind,setKind]=useState("gasto"); // gasto | ingreso
  const [raw,setRaw]=useState("");
  const [note,setNote]=useState("");
  const [cat,setCat]=useState("super");
  const [nc,setNc]=useState(false);
  // Moneda en la que tecleas el importe (NO la de pantalla). Por defecto la de visualización;
  // se puede cambiar a liras/dólares/… sin tocar Ajustes.
  const [entryCur,setEntryCur]=useState("EUR");
  const [curOpen,setCurOpen]=useState(false);
  // Banco del apunte (petición 2026-07-18: «poder elegir el banco si apuntas un gasto manual»).
  // Opciones = los bancos de tus cuentas; por defecto la de gasto diario (lo que ya hacía Gastos).
  const [bank,setBank]=useState(null);
  const [bankOpen,setBankOpen]=useState(false);
  const [date,setDate]=useState(function(){ return isoLocal(); });
  const [calOpen,setCalOpen]=useState(false);
  const [allCatsOpen,setAllCatsOpen]=useState(false);
  /* Sugerir categoría al escribir el concepto (13/9, opción A): palabras clave se aplican solas;
     la IA solo ofrece un chip. Lo que tocas a mano manda. */
  const [tocadaAMano,setTocadaAMano]=useState(false);
  const [iaPara,setIaPara]=useState(null);
  const [iaCat,setIaCat]=useState(null);
  const [sugKw,setSugKw]=useState(null);
  const noteRef=useRef(note); noteRef.current=note;
  const tocadaRef=useRef(tocadaAMano); tocadaRef.current=tocadaAMano;
  const iaParaRef=useRef(iaPara); iaParaRef.current=iaPara;
  const iaCatRef=useRef(iaCat); iaCatRef.current=iaCat;
  const aiOn=!!(state.settings&&state.settings.aiCat);
  const bankOpts=useMemo(function(){
    const seen={}; const out=[];
    (state.accounts||[]).forEach(function(a){ if(a&&a.ent&&!seen[a.ent]){ seen[a.ent]=1; out.push(a.ent); } });
    // El sobre tiene chip propio al lado de 📅; fuera de la lista del 🏦 para no duplicarlo.
    return out.filter(function(e){ return e!=="efectivo"; });
  },[state.accounts]);
  const hasEfectivo=useMemo(function(){
    return (state.accounts||[]).some(isEfectivoEnt);
  },[state.accounts]);
  // Diario «de verdad» (no el sobre): al apagar el chip 💶 se vuelve aquí.
  const dailyBankEnt=useMemo(function(){
    const d=(state.accounts||[]).find(function(a){ return a && accDaily(a) && !isEfectivoEnt(a); })
      || (state.accounts||[]).find(function(a){ return a && accDaily(a); });
    return (d&&d.ent)||null;
  },[state.accounts]);
  const bankChipLabel=function(ent){
    if(ent==null) return t("ap_bank_none");
    return (isEfectivoEnt(ent)?"💶 ":"🏦 ")+entOf(ent).label;
  };
  useEffect(function(){
    if(open){
      setKind("gasto"); setRaw(""); setNote(""); setCat("super"); setNc(false);
      setTocadaAMano(false); setIaPara(null); setIaCat(null); setSugKw(null);
      setDate(isoLocal()); setCalOpen(false); setBankOpen(false); setCurOpen(false); setAllCatsOpen(false);
      // Ayuda «Pregúntame» marca efectivo sin tocar 11 (mismo patrón que __mcExpBank en §3).
      var wantCash=false;
      try{ wantCash=!!window.__mcApuntarCash; window.__mcApuntarCash=false; }catch(e){}
      setBank(wantCash&&hasEfectivo?"efectivo":dailyBankEnt);
      const last=(state.settings&&state.settings.apuntarCur)||(state.settings&&state.settings.currency)||"EUR";
      setEntryCur(String(last).toUpperCase());
    }
  },[open]);
  /* Debounce 400 ms KW / 900 ms IA (brief opción A). Refs: el timer no debe pillarse el texto viejo. */
  useEffect(function(){
    if(!open || kind!=="gasto") return undefined;
    const tKw=setTimeout(function(){
      const texto=String(noteRef.current||"").trim();
      const sug=sugerenciaApuntar({
        concepto:texto, tocadaAMano:tocadaRef.current, iaOn:aiOn, nube:cloud.enabled(),
        iaPara:iaParaRef.current, iaCat:iaCatRef.current
      });
      if(sug.kwCat){ setCat(sug.kwCat); setSugKw(sug.kwCat); }
      else if(!tocadaRef.current) setSugKw(null);
    }, 400);
    const tIa=setTimeout(function(){
      const texto=String(noteRef.current||"").trim();
      const sug=sugerenciaApuntar({
        concepto:texto, tocadaAMano:tocadaRef.current, iaOn:aiOn, nube:cloud.enabled(),
        iaPara:iaParaRef.current, iaCat:iaCatRef.current
      });
      if(!sug.pedirIA) return;
      setIaPara(texto);
      cloud.suggestCategory(texto).then(function(res){
        if(String(noteRef.current||"").trim()!==texto) return;
        const c=res&&res.category;
        if(c && c!=="otros" && CAT[c]) setIaCat(c);
        else setIaCat(null);
      }).catch(function(){ /* ya marcamos iaPara: no reintentar en bucle */ });
    }, 900);
    return function(){ clearTimeout(tKw); clearTimeout(tIa); };
  },[open, note, kind, aiOn]);
  const swipe=useSheetSwipe(!!open, onClose);
  useBackClose(!!open, swipe.close);
  // La pasada por todo el histórico queda preparada con la hoja cerrada; cambiar de categoría
  // ya solo recoloca ocho chips y no mete trabajo O(n) en mitad del gesto (vídeo 2026-09-17).
  const fichaCatsBase=useMemo(function(){
    return expenseTopCategoryRanking(state.expenses,XC);
  },[state.expenses]);
  const fichaCats=useMemo(function(){
    return expenseTopCategoryPick(fichaCatsBase,cat,XC);
  },[fichaCatsBase,cat]);
  if(!open) return null;
  const entrySym=CUR_SYM[entryCur]||entryCur;
  // Chips: siempre EUR + las de viaje más usadas (aunque el FX aún no haya llegado — al
  // guardar sin tipo sale toast, no inventamos el cambio). El resto, solo si hay tipo.
  const tbl=fxTableOf(state);
  const curAlways={ EUR:1, TRY:1, USD:1, GBP:1, CHF:1 };
  const curChips=CUR_LIST.filter(function(c){ return curAlways[c] || c===entryCur || tbl[c]>0; });
  const amt=parseNumPadRaw(raw);
  const pickCur=function(c){
    setEntryCur(c);
    // Recuerda la última para el siguiente Apuntar (viaje: no volver a buscar la lira cada vez).
    set(function(s){
      return Object.assign({},s,{settings:Object.assign({},s.settings,{apuntarCur:c})});
    });
  };
  const save=function(){
    if(!(amt>0)){ showToast(t("v4_apuntar_need")); return; }
    if(entryCur!=="EUR"){
      const r=tbl[entryCur];
      if(!(r>0)){ showToast(t("fx_no_rate")); return; }
    }
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
    const isIn=kind==="ingreso";
    // Guardamos en € (base de la app); lo tecleado iba en entryCur.
    const amtEur=+toEurAmt(amt, entryCur, state).toFixed(2);
    const e={
      id:mcExpenseId(), date:date||isoLocal(),
      amount:isIn?-Math.abs(amtEur):Math.abs(amtEur),
      merchant:note.trim()||(isIn?t("cat_ingreso"):catName(cat)),
      category:isIn?"ingreso":cat, source:"manual"
    };
    if(!isIn && nc) e.noCard=true;
    if(bank) e.ent=bank;   // banco elegido → filtro por banco en Gastos (y viaja en source)
    // Rastro del importe original (informativo; la lista sigue en la moneda de visualización).
    if(entryCur!=="EUR"){ e.origAmount=amt; e.origCur=entryCur; }
    set(function(s){ return Object.assign({},s,{expenses:(s.expenses||[]).concat([e])}); });
    if(cloud.enabled()) subirGasto(e, "v4-apuntar");
    swipe.close();
    if(goGastos) goGastos();
    showToast(isIn?t("v4_apuntar_ok_in"):t("v4_apuntar_ok"));
    if(!isIn && e.ent==="efectivo"){
      const cash=(state.accounts||[]).find(isEfectivoEnt);
      if(cash){
        const monthStart=startOfMonth();
        const spentPrev=(state.expenses||[]).filter(function(x){
          return x && x.ent==="efectivo" && parseDate(x.date)>=monthStart && expenseCountsCash(x, state);
        }).reduce(function(a,x){ return a+(x.amount||0); },0);
        const left=(cash.value||0)-(spentPrev+e.amount);
        if(left< -0.005) showToast("⚠ "+tf("ef_neg_warn",{x:eur(Math.abs(left))}));
      }
    }
  };
  const cats=XC.filter(function(c){ return c.id!=="otros"; }).concat(XC.filter(function(c){ return c.id==="otros"; }));
  const chipIA=(kind==="gasto") ? sugerenciaApuntar({
    concepto:note.trim(), tocadaAMano:tocadaAMano, iaOn:aiOn, nube:cloud.enabled(),
    iaPara:iaPara, iaCat:iaCat
  }).chipIA : null;
  const pickCat=function(id){
    setCat(id); setTocadaAMano(true); setSugKw(null);
  };
  const visibleCats=fichaCats.map(function(c){
    return Object.assign({},c,{suggested:sugKw===c.id && cat===c.id && !tocadaAMano});
  });
  const bankForPill=bank==="efectivo"?dailyBankEnt:bank;
  const meta=[
    {id:"bank",testId:"ap-bank",label:bankForPill?entOf(bankForPill).label:t("ap_bank_none"),
      lead:bankForPill?React.createElement(Mono,{ent:bankForPill,size:18}):React.createElement("span",null,"🏦"),on:bankOpen,
      onClick:function(){ setBankOpen(function(v){ return !v; }); setCalOpen(false); setCurOpen(false); }},
    {id:"cash",testId:"ap-efectivo",label:t("f_meta_cash"),lead:React.createElement("span",null,"💶"),on:bank==="efectivo",disabled:!hasEfectivo,
      onClick:function(){ setBank(function(b){ return b==="efectivo"?dailyBankEnt:"efectivo"; }); setBankOpen(false); setCalOpen(false); }},
    {id:"date",testId:"ap-date",label:fmtIsoCorto(date),lead:React.createElement("span",null,"📅"),on:calOpen,
      onClick:function(){ setCalOpen(function(v){ return !v; }); setBankOpen(false); setCurOpen(false); }}
  ];
  const afterMeta=React.createElement(React.Fragment,null,
    kind==="gasto" && React.createElement("button",{className:"v4-chip"+(nc?" on":""),"data-testid":"ap-payment",onClick:function(){ setNc(!nc); }},t(nc?"g_nocard":"g_card")),
    curOpen && React.createElement("div",{className:"v4-chips wrap","aria-label":t("ap_cur_lbl")},
      curChips.map(function(c){ return React.createElement("button",{key:c,type:"button",className:"v4-chip"+(entryCur===c?" on":""),
        onClick:function(){ pickCur(c); setCurOpen(false); }},(CUR_SYM[c]||c)+" "+c); })),
    calOpen && React.createElement(McCal,{value:date,onPick:function(iso){ setDate(iso); setCalOpen(false); }}),
    bankOpen && bankOpts.length>0 && React.createElement("div",{className:"v4-chips wrap","data-testid":"ap-bank-list"},
      React.createElement("button",{type:"button",className:"v4-chip"+(bank==null?" on":""),onClick:function(){ setBank(null); setBankOpen(false); }},t("ap_bank_none")),
      bankOpts.map(function(b){ return React.createElement("button",{key:b,type:"button",className:"v4-chip"+(bank===b?" on":""),
        onClick:function(){ setBank(b); setBankOpen(false); }},bankChipLabel(b)); })),
    chipIA && kind==="gasto" && React.createElement("div",{className:"v4-chips",style:{marginBottom:4}},
      React.createElement("button",{type:"button",className:"v4-chip"+(cat===chipIA?" on":""),"data-testid":"ap-ia-chip",
        onClick:function(){ pickCat(chipIA); }},"✨ "+catName(chipIA)))
  );
  const fxHint=entryCur!=="EUR" ? tf("f_fx_eq",{
    x:NF.format(toEurAmt(amt,entryCur,state))+" €",date:fmtIsoCorto(state.fxDate||date)
  }) : null;
  const ctaAmount=NF.format(amt)+(entrySym.length>1?" ":"")+entrySym;
  const main=ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet v4-exp-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement(ExpenseFichaLayout,{kind:kind,onKind:setKind,dateLabel:fmtIsoCorto(date),
          onDate:function(){ setCalOpen(function(v){ return !v; }); setBankOpen(false); setCurOpen(false); },
          amount:(raw||"0"),amountEmpty:!raw,currency:entrySym,onCurrency:function(){ setCurOpen(function(v){ return !v; }); setCalOpen(false); setBankOpen(false); },
          focused:true,concept:note,onConcept:setNote,fxHint:fxHint,meta:meta,afterMeta:afterMeta,
          categoryItems:visibleCats,allCategoryItems:cats,category:cat,onCategory:pickCat,onAllCategories:function(){ setAllCatsOpen(true); },
          numpad:React.createElement(NumPad,{value:raw,onChange:setRaw}),testPrefix:"ap",
          footer:React.createElement("button",{className:"v4-cta",onClick:save},kind==="ingreso"?tf("f_cta_add_in",{x:ctaAmount}):tf("f_cta_add",{x:ctaAmount}))})
      )
    ),document.body);
  return React.createElement(React.Fragment,null,main,
    React.createElement(ExpenseCategorySheet,{open:allCatsOpen,onClose:function(){ setAllCatsOpen(false); },items:cats,selected:cat,onPick:pickCat}));
}

/* Perfil personal (pull-down tipo Revolut). Datos en settings.profile — NUNCA PII de ejemplo
   en el repo: placeholders vacíos y el usuario rellena en su móvil (feedback 2026-07-17). */
function profileOf(s){
  const p=((s&&s.settings)||{}).profile||{};
  return {
    handle:p.handle||"", fullName:p.fullName||"", birth:p.birth||"", nationality:p.nationality||"",
    address:p.address||"", phone:p.phone||"", accountPurpose:p.accountPurpose||"",
    taxResidency:p.taxResidency||"", jobStatus:p.jobStatus||"", jobSector:p.jobSector||"",
    jobRole:p.jobRole||"", salaryRange:p.salaryRange||"", wealthSource:p.wealthSource||"",
    netWorthRange:p.netWorthRange||"", investorPurpose:p.investorPurpose||""
  };
}
function ProfilePanel({state, set, onClose, onOpenSettings}){
  const p=profileOf(state);
  const email=(function(){ try{ return window.__mcEmail||""; }catch(e){ return ""; } })();
  const nameGuess=(function(){
    if(p.fullName) return p.fullName;
    if(email&&email.indexOf("@")>0) return email.split("@")[0].replace(/[._]/g," ");
    return "";
  })();
  const initials=(function(){
    const src=nameGuess||"MC";
    const parts=src.trim().split(/\s+/);
    return ((parts[0]||"M").charAt(0)+(parts[1]||parts[0]||"C").charAt(0)).toUpperCase();
  })();
  const handleShow=p.handle ? (p.handle.charAt(0)==="@"?p.handle:("@"+p.handle)) : "@"+(email?email.split("@")[0]:"micartera");
  const patch=function(key,val){
    set(function(s){
      const cur=profileOf(s);
      cur[key]=val;
      return Object.assign({},s,{settings:Object.assign({},s.settings,{profile:cur})});
    });
  };
  const edit=function(key, title, ph){
    askText({ title:title, ph:ph||"", value:p[key]||"", ok:t("ask_ok"), mode:"text", compact:true })
      .then(function(raw){ if(raw==null) return; patch(key, String(raw).trim()); });
  };
  const val=function(v){ return v&&String(v).trim() ? v : null; };
  const row=function(lab, value, onEdit){
    const empty=!val(value);
    return React.createElement("button",{type:"button",className:"profile-row",onClick:onEdit},
      React.createElement("div",{className:"pr-body"},
        React.createElement("div",{className:"pr-lab"}, lab),
        React.createElement("div",{className:"pr-val"+(empty?" empty":"")}, empty?t("pf_add"):value)
      ),
      React.createElement("span",{className:"pr-edit","aria-hidden":"true"}, "✎")
    );
  };
  const jobLines=[p.jobStatus,p.jobSector,p.jobRole,p.salaryRange].filter(function(x){ return val(x); });
  const jobDisplay=jobLines.length ? jobLines.join(" · ") : null;
  return React.createElement(React.Fragment,null,
    React.createElement("div",{className:"profile-pull-h"},
      React.createElement("button",{type:"button",className:"back","aria-label":t("v4_back"),onClick:onClose},"✕"),
      React.createElement("div",{className:"ph-main"},
        React.createElement("h1",null, t("pf_title")),
        React.createElement("button",{type:"button",className:"profile-handle",onClick:function(){ edit("handle", t("pf_handle"), "@usuario"); }},
          handleShow, React.createElement("span",{"aria-hidden":"true"},"✎"))
      ),
      React.createElement("div",{className:"profile-av","aria-hidden":"true"}, initials)
    ),
    /* HOGAR Y GASTOS COMPARTIDOS — se muda aquí desde el final de Cartera (2026-07-25: «lo de
       hogar y gastos compartidos se debería mover a otro lugar… ahí abajo del todo de Cartera
       no»). El perfil es la pantalla de TI y LOS TUYOS y está a un toque desde el avatar de
       Inicio; Cartera se queda solo con dinero. Y va ARRIBA del todo a propósito: el panel mide
       ~1.700 px, así que lo que se pone al final es exactamente lo que nadie ve. */
    React.createElement("div",{className:"profile-sec"}, t("pf_people")),
    React.createElement("div",{className:"profile-card"},
      React.createElement("button",{type:"button",className:"profile-row",onClick:function(){
        // El panel de Hogar va a z-index 96 (el perfil, a 72): puede abrirse mientras el perfil
        // se encoge por detrás, sin esperas ni parpadeo entre pantallas.
        if(onClose) onClose();
        try{ window.dispatchEvent(new CustomEvent("mc-open-shared")); }catch(e){}
      }},
        React.createElement("div",{className:"pr-body"},
          React.createElement("div",{className:"pr-lab"}, t("st_shared")),
          React.createElement("div",{className:"pr-val"}, t("v4_shared_sub"))
        ),
        React.createElement("span",{className:"pr-edit","aria-hidden":"true"}, "›")
      )
    ),
    React.createElement("div",{className:"profile-sec"}, t("pf_personal")),
    React.createElement("div",{className:"profile-card"},
      row(t("pf_basic"), [val(p.fullName),val(p.birth)].filter(Boolean).join(" · ")||null, function(){
        askText({ title:t("pf_name"), ph:t("pf_name_ph"), value:p.fullName||"", ok:t("ask_ok"), mode:"text", compact:true }).then(function(n){
          if(n==null) return;
          askText({ title:t("pf_birth"), ph:t("pf_birth_ph"), value:p.birth||"", ok:t("ask_ok"), mode:"text", compact:true }).then(function(b){
            if(b==null) return;
            set(function(s){
              const cur=profileOf(s);
              cur.fullName=String(n).trim(); cur.birth=String(b).trim();
              return Object.assign({},s,{settings:Object.assign({},s.settings,{profile:cur})});
            });
          });
        });
      }),
      row(t("pf_nationality"), p.nationality, function(){ edit("nationality", t("pf_nationality"), t("pf_country_ph")); }),
      row(t("pf_address"), p.address, function(){ edit("address", t("pf_address"), t("pf_address_ph")); }),
      row(t("pf_phone"), p.phone, function(){ edit("phone", t("pf_phone"), "+34 …"); }),
      row(t("pf_email"), email||null, function(){
        if(onOpenSettings) onOpenSettings();
      }),
      row(t("pf_account_purpose"), p.accountPurpose, function(){ edit("accountPurpose", t("pf_account_purpose"), t("pf_purpose_ph")); }),
      row(t("pf_tax"), p.taxResidency, function(){ edit("taxResidency", t("pf_tax"), t("pf_country_ph")); })
    ),
    React.createElement("div",{className:"profile-sec"}, t("pf_wealth")),
    React.createElement("div",{className:"profile-card"},
      row(t("pf_job"), jobDisplay, function(){
        askText({ title:t("pf_job_status"), ph:t("pf_job_status_ph"), value:p.jobStatus||"", ok:t("ask_ok"), mode:"text", compact:true }).then(function(a){
          if(a==null) return;
          askText({ title:t("pf_job_sector"), ph:t("pf_job_sector_ph"), value:p.jobSector||"", ok:t("ask_ok"), mode:"text", compact:true }).then(function(b){
            if(b==null) return;
            askText({ title:t("pf_job_role"), ph:t("pf_job_role_ph"), value:p.jobRole||"", ok:t("ask_ok"), mode:"text", compact:true }).then(function(c){
              if(c==null) return;
              askText({ title:t("pf_salary"), ph:t("pf_salary_ph"), value:p.salaryRange||"", ok:t("ask_ok"), mode:"text", compact:true }).then(function(d){
                if(d==null) return;
                set(function(s){
                  const cur=profileOf(s);
                  cur.jobStatus=String(a).trim(); cur.jobSector=String(b).trim();
                  cur.jobRole=String(c).trim(); cur.salaryRange=String(d).trim();
                  return Object.assign({},s,{settings:Object.assign({},s.settings,{profile:cur})});
                });
              });
            });
          });
        });
      }),
      row(t("pf_wealth_src"), p.wealthSource, function(){ edit("wealthSource", t("pf_wealth_src"), t("pf_wealth_src_ph")); }),
      row(t("pf_networth"), p.netWorthRange, function(){ edit("netWorthRange", t("pf_networth"), t("pf_networth_ph")); })
    ),
    React.createElement("div",{className:"profile-sec"}, t("pf_investor")),
    React.createElement("div",{className:"profile-card"},
      row(t("pf_inv_purpose"), p.investorPurpose, function(){ edit("investorPurpose", t("pf_inv_purpose"), t("pf_inv_purpose_ph")); })
    ),
    React.createElement("p",{style:{fontSize:12,color:"var(--muted-2)",lineHeight:1.45,margin:"18px 2px 0"}}, t("pf_hint")),
    onOpenSettings && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:14},onClick:function(){ onClose(); onOpenSettings(); }}, t("pf_to_settings"))
  );
}
