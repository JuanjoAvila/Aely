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
    const reduceMotion=function(){
      try{ return (window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches) || document.documentElement.classList.contains("reduce-motion"); }catch(e){ return false; }
    };
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
      queue(reduceMotion()?0:dir*resist(dyRaw));
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
      } else if(el && !reduceMotion()){
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
    React.createElement("h1",{className:"v4-title serif"}, t("v4_plan_title")),
    React.createElement("div",{className:"v4-seg",role:"tablist"},
      segs.map(function(s){
        return React.createElement("button",{key:s.id,role:"tab","aria-selected":seg===s.id,
          className:"v4-seg-btn"+(seg===s.id?" on":""),onClick:function(){ setSeg(s.id); }}, s.lab);
      })
    ),
    capa("recibos", React.createElement(PlanBills,{state:state,set:set,totals:totals,manageOpen:manageOpen,setManageOpen:setManageOpen})),
    !simple && capa("deudas", React.createElement(Debts,{state:state,set:set,showToast:showToast})),
    !simple && capa("metas", React.createElement(Goals,{state:state,set:set,totals:totals,showToast:showToast}))
  );
}

/* Recibos prioriza lo que todavía saldrá de la cuenta este mes. Fijos (edición completa,
   simulador, conciliación…) vive SOLO dentro de la hoja «Gestionar» — mezclarlo aquí abajo
   duplicaba próximos cargos y desglose de banco que ya se ven arriba (feedback 2026-07-17). */
function PlanBills({state, set, totals, manageOpen, setManageOpen}){
  const [paidExpanded,setPaidExpanded]=useState(false);
  const [pendExpanded,setPendExpanded]=useState(false);
  const month=totals.curMonth, year=totals.curYear, today=totals.today;
  const charges=[];
  (state.fixed||[]).forEach(function(e){
    const amount=occAmountIn(e,month);
    if(occursIn(e,month) && amount>0) charges.push({
      id:"fixed_"+e.id, name:e.name, amount:amount, day:dayIn(e,month), bank:accOf(e),
      paid:isPaidIn(e,month,today), sub:t("fj_fixed_tag")
    });
  });
  (state.debts||[]).forEach(function(d){
    if(!debtActive(d)) return;
    const bank=d.account||"sabadell", day=debtChargeDay(d), paid=isDebtPaidThisMonth(d,today);
    if((d.monthly||0)>0) charges.push({id:"debt_"+d.id,name:d.name,amount:d.monthly,day:day,bank:bank,paid:paid,sub:t("fj_debt_tag")});
    const balloon=debtBalloonIn(d,year,month);
    if(balloon>0) charges.push({id:"balloon_"+d.id,name:d.name+" "+t("db_balloon_tag"),amount:balloon,day:day,bank:bank,paid:paid,sub:t("fj_debt_tag")});
  });
  // Nómina y transferencias del mes (como en Gestionar): lo que ya entró/salió cuenta en «Ya pagado».
  (state.flows||[]).forEach(function(f){
    if(!flowOccursIn(f,month,year)) return;
    const day=flowDay(f,year,month);
    const paid=day!=null && day<=today;
    const amt=+(f.amount||0);
    if(!(amt>0)) return;
    if(f.kind==="income"){
      charges.push({id:"flow_"+f.id,name:f.name||t("fj_income"),amount:-amt,day:day,bank:f.to||"sabadell",paid:paid,sub:t("fj_income_tag"),income:true});
    } else if(f.kind==="transfer"){
      charges.push({id:"flow_"+f.id,name:f.name||t("fj_transfer"),amount:amt,day:day,bank:f.from||"sabadell",paid:paid,sub:t("fj_transfer_tag")});
    }
  });
  charges.sort(function(a,b){ return ((a.day||99)-(b.day||99)) || (Math.abs(b.amount)-Math.abs(a.amount)); });
  const pending=charges.filter(function(x){ return !x.paid; });
  // Lista completa (sin agrupar ni «Ver más»): en Gestionar salía todo y aquí faltaban ingresos/traspasos.
  const paid=charges.filter(function(x){ return x.paid; });
  const pendingTotal=pending.reduce(function(sum,x){ return sum+(x.income?0:Math.abs(x.amount)); },0);
  const paidTotal=paid.reduce(function(sum,x){ return sum+(x.income?0:Math.abs(x.amount)); },0);
  const fixedAccount=(state.accounts||[]).find(function(a){ return accFixed(a); });
  const projected=fixedAccount && totals.projectedByBank && totals.projectedByBank[fixedAccount.ent];
  const liquidity=typeof projected==="number" ? tf("v4_plan_liq",{amount:eur0(projected),bank:entOf(fixedAccount.ent).label}) : "—";
  const row=function(x){
    const income=!!x.income || (x.amount<0);
    const amt=Math.abs(x.amount);
    return React.createElement("div",{className:"v4-charge"+(x.paid?" v4-paid":""),key:x.id},
      React.createElement("div",{className:"dt"},
        React.createElement("div",{className:"d"}, x.day||"—"),
        React.createElement("div",{className:"m"}, monthShort(month-1))
      ),
      React.createElement("div",{className:"nm"},
        React.createElement("div",null, x.paid?"✓ "+x.name:x.name),
        React.createElement("div",{className:"sub"}, x.sub+(x.bank?" · "+entOf(x.bank).label:""))
      ),
      React.createElement("div",{className:"am"+(income?" pos":"")}, (income?"+":"")+eur(amt))
    );
  };
  return React.createElement(React.Fragment,null,
    React.createElement("div",{className:"v4-card v4-card-hero rise"},
      React.createElement("div",{className:"v4-micro"}, tf("v4_plan_left",{month:monthLong(month-1)})),
      React.createElement("div",{className:"serif num",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6}}, eur(pendingTotal)),
      React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",marginTop:14,fontSize:13.5,color:"var(--muted)"}},
        React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:"var(--mint)",flex:"0 0 auto"}}),
        liquidity
      )
    ),
    React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null,t("v4_pendiente")),
        React.createElement("button",{className:"link",onClick:function(){ setManageOpen(true); }},t("v4_gestionar"))
      ),
      (pendExpanded?pending:pending.slice(0,3)).map(row),
      pending.length>3 && React.createElement("button",{className:"v4-link-mini",onClick:function(){ setPendExpanded(function(v){ return !v; }); }},
        pendExpanded ? t("v4_ver_menos") : tf("v4_ver_mas",{n:pending.length-3}))
    ),
    React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},t("v4_ya_pagado")+" · "+eur(paidTotal)),
      (paidExpanded?paid:paid.slice(0,3)).map(row),
      paid.length>3 && React.createElement("button",{className:"v4-link-mini",onClick:function(){ setPaidExpanded(function(v){ return !v; }); }},
        paidExpanded ? t("v4_ver_menos") : tf("v4_ver_mas",{n:paid.length-3}))
    ),
    React.createElement(BillsManageSheet,{open:manageOpen,onClose:function(){ setManageOpen(false); },state:state,set:set,totals:totals})
  );
}

/* Hoja «Gestionar»: aquí vive Fijos entero (servicios, cuotas, flujos, puntuales, simulador,
   conciliación…). Antes se «dumpeaba» tal cual debajo de Recibos y mezclaba edición con la
   vista diaria — ahora solo aparece si el usuario pide gestionar (feedback 2026-07-17). */
function BillsManageSheet({open, onClose, state, set, totals}){
  useBackClose(!!open, onClose);
  const swipe=useSheetSwipe(!!open, onClose);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet",style:{maxHeight:"90dvh"},ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"v4-section-h"},
          React.createElement("span",{className:"serif",style:{fontSize:19,fontWeight:600}}, t("v4_gestionar")),
          React.createElement("button",{className:"link","aria-label":t("au_close"),onClick:onClose},"✕")
        ),
        React.createElement("p",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.45,margin:"0 0 12px"}}, t("v4_gestionar_h")),
        React.createElement("div",{className:"v4-embed-legacy"}, React.createElement(Fijos,{state:state,set:set,totals:totals}))
      )
    ), document.body);
}

function CarteraTab({state, set, totals, fetchPrices, pricing, simple, onBankSync, onReconnectBank, showToast}){
  const [invTools,setInvTools]=useState(false);
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
      Promise.resolve(b.status()).then(function(r){ setTrDead(!(r&&r.connected)); }).catch(function(){});
    };
    check();
    const onVis=function(){ if(document.visibilityState==="visible") check(); };
    const onEvt=function(e){
      if(e&&e.detail&&typeof e.detail.connected==="boolean"){ setTrDead(!e.detail.connected); return; }
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
        React.createElement(Wealth,{state:state,set:set,totals:totals,v4Embed:true,parte:"cuentas",showToast:showToast})
      ) },
      // Bienes (piso, coche…) es su propio bloque: no son cuentas de banco y el usuario quiere
      // colocarlos donde le apetezca (feedback 2026-07-25).
      (state.assets||[]).length>0 && { id:"bienes", label:t("pt_goods"), el:React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-sec-h"}, t("pt_goods")),
        React.createElement(Wealth,{state:state,set:set,totals:totals,v4Embed:true,parte:"bienes"})
      ) },
      !simple && { id:"inversiones", label:t("v4_inversiones"), el:React.createElement("div",{className:"rise",style:{animationDelay:".12s"}},
        React.createElement("div",{className:"v4-sec-h"}, t("v4_inversiones")),
        React.createElement(Investments,{state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,v4Embed:true}),
        React.createElement("button",{type:"button",className:"v4-link-mini",style:{marginTop:10},onClick:function(){ setInvTools(true); }}, t("v4_inv_tools")+" ›")
      ) }
    ]}),
    // El sheet vive FUERA de los bloques ordenables: es un portal, no una sección, y meterlo
    // dentro lo desmontaría al reordenar (cerrándose solo a media consulta).
    !simple && React.createElement(InvToolsSheet,{open:invTools,onClose:function(){ setInvTools(false); },state:state,set:set,fetchPrices:fetchPrices,pricing:pricing})
  );
}

function InvToolsSheet({open, onClose, state, set, fetchPrices, pricing}){
  useBackClose(!!open, onClose);
  const swipe=useSheetSwipe(!!open, onClose);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet",style:{maxHeight:"92dvh"},ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"v4-section-h"},
          React.createElement("span",{className:"serif",style:{fontSize:19,fontWeight:600}}, t("v4_inv_tools")),
          React.createElement("button",{className:"link","aria-label":t("au_close"),onClick:onClose},"✕")
        ),
        React.createElement("p",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.45,margin:"0 0 12px"}}, t("v4_inv_tools_h")),
        React.createElement("div",{className:"v4-embed-legacy"}, React.createElement(Investments,{state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,v4Embed:false,toolsMode:true}))
      )
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
  // Moneda en la que tecleas el importe (NO la de pantalla). Por defecto la de visualización;
  // se puede cambiar a liras/dólares/… sin tocar Ajustes.
  const [entryCur,setEntryCur]=useState("EUR");
  // Banco del apunte (petición 2026-07-18: «poder elegir el banco si apuntas un gasto manual»).
  // Opciones = los bancos de tus cuentas; por defecto la de gasto diario (lo que ya hacía Gastos).
  const [bank,setBank]=useState(null);
  const [bankOpen,setBankOpen]=useState(false);
  const [date,setDate]=useState(function(){ return isoLocal(); });
  const [calOpen,setCalOpen]=useState(false);
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
      setKind("gasto"); setRaw(""); setNote(""); setCat("super");
      setTocadaAMano(false); setIaPara(null); setIaCat(null); setSugKw(null);
      setDate(isoLocal()); setCalOpen(false); setBankOpen(false);
      // Defecto = banco diario, no el sobre (aunque el sobre también sea gasto diario).
      setBank(dailyBankEnt);
      // Arranca en la moneda de pantalla (o la última que usó al apuntar en este viaje).
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
  useBackClose(!!open, onClose);
  const swipe=useSheetSwipe(!!open, onClose);
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
      category:isIn?"ingreso":cat, source:"manual", card:!isIn
    };
    if(bank) e.ent=bank;   // banco elegido → filtro por banco en Gastos (y viaja en source)
    // Rastro del importe original (informativo; la lista sigue en la moneda de visualización).
    if(entryCur!=="EUR"){ e.origAmount=amt; e.origCur=entryCur; }
    set(function(s){ return Object.assign({},s,{expenses:(s.expenses||[]).concat([e])}); });
    if(cloud.enabled()) subirGasto(e, "v4-apuntar");
    onClose();
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
  const cats=CATEGORIES.filter(function(c){ return c.id!=="otros"; }).concat(CATEGORIES.filter(function(c){ return c.id==="otros"; }));
  const chipIA=(kind==="gasto") ? sugerenciaApuntar({
    concepto:note.trim(), tocadaAMano:tocadaAMano, iaOn:aiOn, nube:cloud.enabled(),
    iaPara:iaPara, iaCat:iaCat
  }).chipIA : null;
  const pickCat=function(id){
    setCat(id); setTocadaAMano(true); setSugKw(null);
  };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        /* Cuerpo con scroll; Guardar fuera (shell: .v4-sheet flex + .v4-sheet-body). */
        React.createElement("div",{className:"v4-sheet-body"},
          React.createElement("div",{className:"v4-toggle"},
            React.createElement("button",{className:kind==="gasto"?"on":"",onClick:function(){ setKind("gasto"); }},"💸 "+t("v4_gasto")),
            React.createElement("button",{className:kind==="ingreso"?"on":"",onClick:function(){ setKind("ingreso"); }},"💰 "+t("v4_ingreso"))
          ),
          React.createElement("div",{className:"v4-apuntar-amt serif num"},
            raw?raw+" "+entrySym:React.createElement("span",{style:{color:"var(--muted-2)"}},"0 "+entrySym)),
          entryCur!=="EUR" && React.createElement("div",{style:{fontSize:12,color:"var(--muted)",textAlign:"center",marginTop:-4,marginBottom:6}}, t("ap_fx_hint")),
          React.createElement("div",{className:"v4-chips","aria-label":t("ap_cur_lbl")},
            curChips.map(function(c){
              return React.createElement("button",{key:c,type:"button",className:"v4-chip"+(entryCur===c?" on":""),onClick:function(){ pickCur(c); }},
                (CUR_SYM[c]||c)+" "+c);
            })
          ),
          React.createElement("input",{className:"v4-input",placeholder:t("v4_apuntar_ph"),value:note,onChange:function(e){ setNote(e.target.value); }}),
          React.createElement("div",{className:"v4-chips"},
            React.createElement("button",{type:"button",className:"v4-chip"+(calOpen?" on":""),"data-testid":"ap-date",
              onClick:function(){ setCalOpen(function(v){ return !v; }); setBankOpen(false); }},
              "📅 "+fmtIsoCorto(date)),
            /* Chip directo del sobre (hotfix 13/9 review): si solo está dentro de la lista del
               🏦, no se ve «elegir efectivo» — su queja literal. Alterna con el banco diario. */
            hasEfectivo && React.createElement("button",{type:"button",
              className:"v4-chip"+(bank==="efectivo"?" on":""),"data-testid":"ap-efectivo",
              onClick:function(){
                setCalOpen(false); setBankOpen(false);
                setBank(function(b){ return b==="efectivo"?dailyBankEnt:"efectivo"; });
              }},
              "💶 "+entOf("efectivo").label),
            bankOpts.length>0 && React.createElement("button",{type:"button",className:"v4-chip"+(bankOpen?" on":""),"data-testid":"ap-bank",
              onClick:function(){ setBankOpen(function(v){ return !v; }); setCalOpen(false); }},
              bankChipLabel(bank))
          ),
          calOpen && React.createElement(McCal,{value:date, onPick:function(iso){ setDate(iso); setCalOpen(false); }}),
          bankOpen && bankOpts.length>0 && React.createElement("div",{className:"v4-chips wrap","data-testid":"ap-bank-list"},
            React.createElement("button",{type:"button",className:"v4-chip"+(bank==null?" on":""),onClick:function(){ setBank(null); setBankOpen(false); }}, t("ap_bank_none")),
            bankOpts.map(function(b){
              return React.createElement("button",{key:b,type:"button",className:"v4-chip"+(bank===b?" on":""),onClick:function(){ setBank(b); setBankOpen(false); }},
                bankChipLabel(b));
            })
          ),
          kind==="gasto" && React.createElement("div",{className:"v4-chips","data-testid":"ap-cats"},
            chipIA && React.createElement("button",{type:"button",key:"ia_"+chipIA,
              className:"v4-chip"+(cat===chipIA?" on":""),"data-testid":"ap-ia-chip",
              onClick:function(){ pickCat(chipIA); }},
              "✨ "+catName(chipIA)),
            cats.map(function(c){
              const sugerida=sugKw===c.id && cat===c.id && !tocadaAMano;
              return React.createElement("button",{key:c.id,type:"button",
                className:"v4-chip"+(cat===c.id?" on":""),"data-testid":"ap-cat-"+c.id,
                onClick:function(){ pickCat(c.id); }},
                c.icon+" "+catName(c.id)+(sugerida?" ✨":""));
            })
          ),
          React.createElement(NumPad,{value:raw, onChange:setRaw})
        ),
        React.createElement("button",{className:"v4-cta",onClick:save},
          kind==="ingreso"?t("v4_save_in"):t("v4_save_gasto"))
      )
    ), document.body);
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
