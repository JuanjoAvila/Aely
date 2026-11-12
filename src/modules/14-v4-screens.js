/* ============================================================
   v4 — Plan (Recibos/Deudas/Metas), Cartera, Sheet Apuntar
   Spec: docs/design/handoff/SPEC-v4.md §5–7
   ============================================================ */

// Orden fijo del tirón de Plan (ver `useTironSeccion`: no puede ser un literal del render).
const PLAN_SEG_ORDEN=["recibos","deudas","metas"];
function PlanTab({state, set, totals, showToast, simple, gotoSeg, clearGoto}){
  const [seg,setSeg]=useState("recibos");
  // Deuda a la que hay que llevar al llegar a Deudas ({id,ts}); ver `irADeuda`.
  const [focoDeuda,setFocoDeuda]=useState(null);
  const [manageOpen,setManageOpen]=useState(false);
  // «Editar» desde la ficha de un recibo abre Todos directamente en su edición.
  const [manageEdit,setManageEdit]=useState(null);
  const [debtDayRequest,setDebtDayRequest]=useState(null);
  const editDebtDay=function(d){ setDebtDayRequest({id:d.id,ts:Date.now()}); };
  // Modo sencillo: solo Recibos (spec §2).
  const segs=simple
    ? [{id:"recibos",lab:t("v4_plan_recibos")}]
    : [{id:"recibos",lab:t("v4_plan_recibos")},{id:"deudas",lab:t("v4_plan_deudas")},{id:"metas",lab:t("v4_plan_metas")}];
  const charges=useMemo(function(){
    return planChargesMonth(state, totals.curMonth, totals.curYear, totals.today);
  },[state.fixed,state.debts,state.oneoffs,state.flows,state.bankTx,state.accounts,state.expenses,state.deleted,state.reciboNo,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,totals.curMonth,totals.curYear,totals.today]);
  const evidence=useMemo(function(){ return paymentEvidenceUI(state,totals.curYear,totals.curMonth,totals.today); },
    [state.fixed,state.debts,state.oneoffs,state.bankTx,state.accounts,state.expenses,state.deleted,state.reciboNo,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,totals.curMonth,totals.curYear,totals.today]);
  const unconfirmed=charges.paidBills.filter(function(x){return evidence.confirmed[x.id]===false;}).length;
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
    : (allBillsPaid&&unconfirmed?(balKnown&&balNow<0
      ? tf("help_cue_balance",{x:eur0(balNow),bank:bankLab})
      : tf(unconfirmed===1?"v4_payment_all_except_one":"v4_payment_all_except",{n:unconfirmed})):(allBillsPaid
      ? (coverBank&&balKnown
        ? tf("v4_plan_state_all_paid",{x:eur0(balNow),bank:bankLab})
        : t("v4_plan_state_all_paid_nobank"))
      : (coverBank!=null&&cover.min!=null&&isFinite(cover.min)
        ? tf((coverTone==="bad"?"v4_plan_state_bad":(coverTone==="warn"?"v4_plan_state_warn":"v4_plan_state_ok"))+(hasMinDay?"":"_noday"),{
            left:eur0(leftForPhrase), end:eur0(cover.min), bank:bankLab, day:hasMinDay?String(cover.minDay):"", min:eur0(cover.min)
          })
        : t("v4_plan_state_none"))));
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
    // Desde otra pestaña la transición ya es el carrusel: la sección no anima por su cuenta.
    if(!simple&&gotoSeg.id==="deudas"&&gotoSeg.debtId!=null) setFocoDeuda({id:String(gotoSeg.debtId),ts:gotoSeg.ts});
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
  // Cada capa premontada se maqueta una vez en un hueco libre (ver `mcCalentarCapa`).
  const calentadas=useRef({});
  useEffect(function(){
    Object.keys(segMounted).forEach(function(id){
      if(calentadas.current[id]||id===seg) return;
      calentadas.current[id]=true;
      mcScheduleIdle(function(){ if(segElRef.current[id]) mcCalentarCapa(segElRef.current[id]); },4000);
    });
  },[segMounted]);
  /* Lo que se abre desde Recibos se ensaya en seco (`mcEnsayar`) la primera vez que Recibos está a
     la vista, de uno en uno y en huecos libres: «¿Te llega?», Tus recibos y la hoja de editar. Así
     el primer toque en cada uno cuesta lo que los siguientes. Con algo ya abierto encima espera. */
  const ensayados=useRef(0), ensayoDatos=useRef(null);
  ensayoDatos.current={state:state,totals:totals,pack:charges};
  useEffect(function(){
    const el=segElRef.current.recibos;
    if(simple||seg!=="recibos"||ensayados.current>=3||!el||typeof IntersectionObserver!=="function") return undefined;
    let vivo=true, tm=0, esperas=0;
    const nada=function(){};
    const cola=[
      function(d){ return React.createElement(LlegaSheet,{state:d.state,set:nada,totals:d.totals,pack:d.pack,onClose:nada,ensayo:true}); },
      function(d){ return React.createElement(BillsManagePush,{open:true,onClose:nada,state:d.state,set:nada,totals:d.totals,simple:false,ensayo:true}); },
      function(d){
        const r=billsGroupRows(d.state,"serv",d.totals.curMonth,d.totals.curYear).find(function(x){ return x.kind==="fixed"; });
        const bancos=Array.from(new Set((d.state.accounts||[]).map(function(a){ return a.ent; }).filter(Boolean)));
        return r?React.createElement(ReciboPasos,{mode:"edit",row:r,state:d.state,set:nada,totals:d.totals,banks:bancos.length?bancos:["sabadell"],
          onClose:nada,onSaved:nada,onRemove:nada,onEditOther:nada,ensayo:true}):null;
      }
    ];
    const sigue=function(dl){
      if(!vivo||ensayados.current>=cola.length) return;
      const h=document.documentElement.classList, d=ensayoDatos.current;
      if(h.contains("sheet-open")||h.contains("bills-open")){ tm=setTimeout(function(){ mcScheduleIdle(sigue,1500); },2000); return; }
      // Con algo moviéndose (un scroll, una animación) el hueco entre fotogramas es de pocos ms: se
      // espera a que pare, que cada ensayo ocupa el hilo lo que la primera apertura de verdad.
      if(dl&&!dl.didTimeout&&typeof dl.timeRemaining==="function"&&dl.timeRemaining()<8&&esperas<10){
        esperas++; tm=setTimeout(function(){ mcScheduleIdle(sigue,1500); },150); return;
      }
      esperas=0;
      // Sin recibos no hay nada de esto que abrir.
      if(!(d.state.fixed||[]).length) return;
      try{ const e=cola[ensayados.current++](d); if(e) mcEnsayar(e); }catch(err){}
      if(ensayados.current<cola.length) tm=setTimeout(function(){ mcScheduleIdle(sigue,1500); },120);
    };
    const io=new IntersectionObserver(function(es){
      if(!es.some(function(x){ return x.isIntersecting; })) return;
      io.disconnect();
      tm=setTimeout(function(){ mcScheduleIdle(sigue,1500); },700);
    });
    io.observe(el);
    return function(){ vivo=false; io.disconnect(); clearTimeout(tm); };
  },[seg,simple]);
  const capa=function(id,hijo){
    if(!segMounted[id]) return null;
    return React.createElement("div",{key:id,"data-seg":id,ref:function(el){ segElRef.current[id]=el; },style:seg===id?null:oculto,"aria-hidden":seg!==id}, hijo);
  };

  /* DESLIZAR VERTICAL PARA CAMBIAR DE SEGMENTO (petición 2026-08-03: «no depender de la otra
     mano para tocar arriba»). Recibos → Deudas → Metas → Recibos. La mecánica vive en
     `useTironSeccion` (02-ui-shared.js) desde Gastos v5, que la usa igual: un solo sitio. */
  const planScreenRef=useRef(null);
  const entradaRef=useTironSeccion(planScreenRef,{activo:!simple, seg:seg, orden:PLAN_SEG_ORDEN, respaldo:true, cortaScroll:true,
    capa:function(id){ return segElRef.current[id]; },
    alPasar:function(nextId){
      setSegMounted(function(m){ return m[nextId]?m:Object.assign({},m,{[nextId]:true}); });
      setSeg(nextId);
    }});

  /* TOCAR UNA DEUDA LLEVA A SU TARJETA, CON SUAVIDAD (queja del dueño 28/10/2026: «que vaya más
     suave y al sitio exacto de donde está la deuda, que ahora es muy bestia»). Medido antes: la
     sección cambiaba en UN frame sin transición, el scroll se quedaba donde estaba Recibos y la
     tarjeta tocada caía 600 px por debajo de la pantalla — había que bajar a buscarla.
     Ahora: entra con la misma animación que el tirón entre secciones, y la página se desliza
     (scroll nativo `smooth`, sin trabajo por frame nuestro) hasta dejar la tarjeta centrada en
     lo que se ve entre el borde de arriba y la barra inferior. La barra se descuenta SIEMPRE,
     aunque esté escondida: al subir reaparece y la taparía. */
  const irADeuda=function(debtId){
    setSegMounted(function(m){ return m.deudas?m:Object.assign({},m,{deudas:true}); });
    if(seg!=="deudas"&&entradaRef) entradaRef.current="down";
    setSeg("deudas");
    setFocoDeuda(debtId!=null?{id:String(debtId),ts:Date.now()}:null);
  };
  useEffect(function(){
    if(!focoDeuda||seg!=="deudas"||!segMounted.deudas) return undefined;
    const id=focoDeuda.id;
    let raf=0, n=0, antes=null, cancel=false;
    // Posición en la página por `offsetTop` y no por `getBoundingClientRect`: la sección entra con
    // un `translateY` y las tarjetas con `.rise`, y un rect medido a mitad de animación apuntaría
    // 16 px de más. offsetTop ignora transforms.
    const topEn=function(el,pg){
      let y=0, n2=el;
      while(n2&&n2!==pg){ y+=n2.offsetTop; n2=n2.offsetParent; }
      return n2===pg?y:null;
    };
    const paso=function(){
      raf=0; if(cancel) return;
      const capaEl=segElRef.current.deudas;
      let card=null;
      try{ card=capaEl&&capaEl.querySelector('[data-debt-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]'); }catch(e){}
      const pg=card&&card.closest(".page");
      const y=pg?topEn(card,pg):null;
      // Se espera a que el layout se quede quieto dos frames seguidos: Deudas puede estar
      // montándose ahora mismo (premontaje en hueco libre) y medir antes da un sitio que se mueve.
      if(y==null||antes==null||Math.abs(y-antes)>0.5){
        antes=y;
        if(++n<60) raf=requestAnimationFrame(paso);
        else setFocoDeuda(null);
        return;
      }
      const pr=pg.getBoundingClientRect();
      const nav=document.querySelector(".botnav");
      const H=window.innerHeight||pr.bottom;
      const arriba=Math.max(pr.top,0)+16;
      const abajo=Math.min(pr.bottom,H-(nav?nav.offsetHeight:0))-16;
      const alto=card.offsetHeight, hueco=abajo-arriba;
      const quiero=hueco>alto?arriba+(hueco-alto)/2:arriba;
      const max=Math.max(0,pg.scrollHeight-pg.clientHeight);
      let dest=Math.max(0,Math.min(max,Math.round(y+pr.top-quiero)));
      // La primera tarjeta ya entra entera con el título y los botones quietos.
      // Centrarla subía el scroll 41 px y el título se iba 15 px por arriba
      // (Pixel 5, 1/11/2026; los botones seguían a +29). Con la barra de estado
      // ese hueco se come la cabecera. Si cabe sin bajar, no se mueve.
      if(dest>0 && pr.top+y>=0 && pr.top+y+alto<=abajo) dest=0;
      // Si la página aún entra por el carrusel (venías de Gastos), se coloca sin deslizar: llega ya
      // en su sitio y el movimiento es solo el del carrusel, no dos a la vez.
      const enSitio=Math.abs(pr.left)<2;
      try{ pg.scrollTo({top:dest,behavior:(enSitio&&!mcReduced())?"smooth":"auto"}); }catch(e){ pg.scrollTop=dest; }
      // El resalte NO se cancela al limpiar el efecto (este mismo `setFocoDeuda(null)` lo limpia).
      card.classList.add("v4-foco");
      setTimeout(function(){ card.classList.remove("v4-foco"); }, 1700);
      setFocoDeuda(null);
    };
    raf=requestAnimationFrame(paso);
    return function(){ cancel=true; if(raf) cancelAnimationFrame(raf); };
  },[focoDeuda&&focoDeuda.ts, seg, segMounted.deudas]);

  return React.createElement("div",{className:"v4-screen v4-plan",ref:planScreenRef,"data-edge-capture":simple?null:"1"},
    // Fondo bajo la barra de estado: al bajar, el título, los botones y la tarjeta pasaban por
    // debajo de la hora y los iconos (vídeo del dueño, 7/11). El mismo que la cabecera de Gastos.
    React.createElement("div",{className:"v4-plan-techo","aria-hidden":"true"}),
    React.createElement("div",{className:"v4-plan-cab"},
      React.createElement("h1",{className:"v4-title serif"}, simple?t("v4s_plan_left_title"):t("v4_plan_title")),
      React.createElement(OjoImportes,{state:state,set:set})),
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
          className:"v4-seg-btn"+(seg===s.id?" on":""),onClick:function(){ if(seg!==s.id) mcTickHaptic(); setSeg(s.id); }}, s.lab);
      })
    ),
    capa("recibos", simple
      ? React.createElement(PlanBills,{state:state,set:set,totals:totals,charges:charges,evidence:evidence,manageOpen:manageOpen,setManageOpen:setManageOpen,onEditDebtDay:editDebtDay})
      : React.createElement(PlanRecibos,{state:state,set:set,totals:totals,charges:charges,evidence:evidence,manageOpen:manageOpen,setManageOpen:setManageOpen,activo:seg==="recibos",
          manageEdit:manageEdit,setManageEdit:setManageEdit,showToast:showToast,onGoDebts:irADeuda,onEditDebtDay:editDebtDay})),
    !simple && capa("deudas", React.createElement(Debts,{state:state,set:set,showToast:showToast})),
    !simple && capa("metas", React.createElement(Goals,{state:state,set:set,totals:totals,showToast:showToast})),
    debtDayRequest&&React.createElement(Debts,{state:state,set:set,showToast:showToast,editorOnly:true,editDayRequest:debtDayRequest,onEditDayClose:function(){setDebtDayRequest(null);}})
  );
}

/* El ojo (SPEC Plan Recibos §8): esconde TODAS las cifras de dinero de la app («•••• €») desde los
   formateadores; los conteos se siguen viendo. La SPEC deja al dueño elegir dónde va: de momento en
   la cabecera de Plan, que es donde se diseñó. Se guarda en `settings` para que dure y viaje. */
function OjoImportes({state, set}){
  const oculto=!!(state.settings&&state.settings.ocultarImportes);
  return React.createElement("button",{type:"button",className:"v4-ojo"+(oculto?" on":""),"data-testid":"ojo-importes",
    "aria-pressed":oculto?"true":"false","aria-label":t(oculto?"pr6_ojo_ver":"pr6_ojo_ocultar"),
    onClick:function(){ mcTickHaptic(); set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings||{},{ocultarImportes:!oculto})}); }); }},
    React.createElement("svg",{width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},
      React.createElement("path",{d:"M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"}),
      React.createElement("circle",{cx:12,cy:12,r:3}),
      oculto&&React.createElement("path",{d:"M4 4l16 16"})));
}

/* Recibos en modo SENCILLO: la portada compacta que ya funcionaba. El rediseño v6 (`PlanRecibos`)
   es para el modo normal y el sencillo sigue como estaba (SPEC Plan Recibos §0). Aquí no hay
   «Gestionar»: la puerta vive en Ajustes → Cambiar mis recibos (NO-GO §5bis.2). */
function PlanBills({state, set, totals, charges, evidence, manageOpen, setManageOpen,onEditDebtDay}){
  const [paidExpanded,setPaidExpanded]=useState(false);
  const [pendExpanded,setPendExpanded]=useState(false);
  const paidPanelId="v4-paid-panel";
  const pack=charges||planChargesMonth(state, totals.curMonth, totals.curYear, totals.today);
  // Sencillo conserva las salidas juntas; el matiz aclara que mover dinero no suma recibos.
  const pending=pack.pendingBills.concat(pack.transfersPending);
  const proof=evidence||paymentEvidenceUI(state,totals.curYear,totals.curMonth,totals.today);
  const unconfirmed=pack.paidBills.filter(function(x){return proof.confirmed[x.id]===false;}).map(function(x){return Object.assign({},x,{paid:false,unconfirmed:true});});
  const paid=pack.paidBills.filter(function(x){return proof.confirmed[x.id]!==false;});
  // Solo el subtotal de esta lista cambia; la previsión financiera del pack queda intacta.
  const paidTotal=paid.reduce(function(sum,x){return sum+Math.abs(x.amount);},0);
  const hasChangedPaid=paid.some(planChargeChanged);
  const incomePend=pack.incomePending||[];
  // Atrás real (history) pliega el «Ya has pagado»; Escape del e2e no basta (Claude 1845Z).
  useBackClose(!!paidExpanded, function(){ setPaidExpanded(false); });
  const rowSub=function(x){
    if(x.unconfirmed) return entOf(x.bank).label;
    // El recibo conserva el banco previsto; el cargo confirmado puede haber salido de otro.
    var bank=x.paid&&x.paidBank?x.paidBank:x.bank;
    if(x.overdue) return entOf(x.bank).label+" · "+t("v4_charge_unconfirmed");
    if(x.kind==="income") return tf("v4s_row_income",{bank:entOf(x.bank).label});
    if(x.kind==="transfer"){
      var toEnt=x.to||null;
      var inv=toEnt&&((state.investments||[]).some(function(i){ return i.ent===toEnt; })||(state.accounts||[]).some(function(a){ return a.ent===toEnt&&a.role==="extra"; }));
      return inv?tf("v4s_row_invest",{bank:entOf(toEnt).label}):tf("v4s_row_to",{bank:entOf(toEnt||x.bank).label});
    }
    if(x.kind==="debt"||x.kind==="balloon") return tf("v4s_row_debt",{name:x.name})+(x.paidBank&&x.paidBank!==x.bank?" · "+entOf(x.paidBank).label:"");
    return tf("v4s_row_from",{bank:entOf(bank).label})+(planChargeChanged(x)?" · "+tf("v4_charge_actual",{x:eur(x.paidAmount)}):"");
  };
  const row=function(x){
    const match=String(x.id).match(/^(fixed|debt|balloon)_(.*)$/),kind=match&&match[1]!=="fixed"?"debts":"fixed";
    const item=match&&(state[kind]||[]).find(function(e){return String(e.id)===match[2];});
    const conflict=item&&planSyncConflict(state,kind,item.id);
    const income=!!x.income || (x.amount<0);
    return React.createElement("div",{className:"v4-mov"+(x.paid?" v4-paid":""),key:x.id},
      React.createElement("div",{className:"tile","aria-hidden":true}, x.day||"—"),
      React.createElement("div",{className:"nm"},
        React.createElement("div",{className:"nm-title"}, x.paid?"✓ "+x.name:x.name,React.createElement(PlanConflictDot,{record:conflict})),
        React.createElement("div",{className:"meta"}, rowSub(x)),
        x.kind==="debt"&&React.createElement(DebtDayPrompt,{debt:item,onOpen:onEditDebtDay})
      ),
      React.createElement("div",{className:"am"+(income?" pos":"")}, income?"+":"",planChargeAmount(x))
    );
  };
  const paidTotalLabel=hasChangedPaid?tf("v4_charge_expected",{x:eur0(paidTotal)}):eur0(paidTotal);
  const paidLabel=paid.length===1
    ? tf("v4_paid_fold_one",{n:1,amount:paidTotalLabel})
    : tf("v4_paid_fold",{n:paid.length,amount:paidTotalLabel});
  return React.createElement(React.Fragment,null,
    React.createElement("div",{className:"v4-section","data-testid":"plan-due"},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null,t("v4_aun_saldra"))
      ),
      // Solo cuando se mezclan traspasos con recibos: ahí sí hace falta decir qué suma.
      pending.length>0&&pack.transfersPending.length>0&&React.createElement("div",{className:"ph"},t("v4_payment_mixed_hint")),
      pending.length===0
        ? React.createElement("div",{className:"ph",style:{padding:"8px 4px 4px"}}, t("v4_aun_saldra_empty"))
        : (pendExpanded?pending:pending.slice(0,3)).map(row),
      pending.length>3 && React.createElement("button",{type:"button",className:"v4-link-mini",onClick:function(){ setPendExpanded(function(v){ return !v; }); }},
        pendExpanded ? t("v4_ver_menos") : tf("v4_ver_mas",{n:pending.length-3}))
    ),
    unconfirmed.length>0 && React.createElement("div",{className:"v4-section","data-testid":"plan-unconfirmed"},
      React.createElement("div",{className:"v4-section-h"},t("v4_payment_pending")+" · "+unconfirmed.length),
      React.createElement("div",{className:"ph"},t("v4_payment_pending_hint")),unconfirmed.map(row)),
    incomePend.length>0 && React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},
        React.createElement("span",null,t("v4_aun_entrara"))
      ),
      incomePend.map(row)
    ),
    paid.length>0 && React.createElement("button",{type:"button",className:"v4-paid-fold",
      id:"v4-paid-fold-btn","aria-expanded":paidExpanded?"true":"false","aria-controls":paidPanelId,
      onClick:function(){ setPaidExpanded(function(v){ return !v; }); }},
      React.createElement("span",null, paidLabel),React.createElement("span",{"aria-hidden":true}, paidExpanded?"▾":"▸")),
    paidExpanded && React.createElement("div",{className:"v4-section",id:paidPanelId,role:"region","aria-labelledby":"v4-paid-fold-btn"}, paid.map(row)),
    // También en sencillo: la puerta vive en Ajustes → Dinero (NO-GO §5bis.2).
    React.createElement(BillsManagePush,{key:"manage-bills",open:manageOpen,onClose:function(){ setManageOpen(false); },state:state,set:set,totals:totals,simple:true})
  );
}
/* La factura variable acredita su bruto real, pero no permite inventar la parte propia de un
   compartido: se conserva la previsión y se nombra aparte del cargo bancario. Lo usan las dos
   portadas (sencilla y v6) para que digan lo mismo. */
function planChargeChanged(x){ return !!(x.paid&&x.paidAmount>0&&Math.abs(x.paidAmount-x.plannedBankAmount)>=0.005); }
function planChargeAmount(x){
  const amt=eur(Math.abs(x.amount));
  return planChargeChanged(x)?React.createElement(React.Fragment,null,
    React.createElement("small",{style:{display:"block",fontSize:10,color:"var(--muted)",fontWeight:400}},tf("v4_charge_expected",{x:""}).trim()),amt):amt;
}

/* PLAN › RECIBOS v6 — tanda 1 (diseño cerrado con el dueño el 26/10/2026,
   docs/design/plan-recibos/SPEC.md §2). Tiene que contestar de un vistazo cuánto queda por
   pagar, qué hay que mirar y qué ya se pagó; lo demás vive un toque más abajo (Todos y la ficha).
   Las cifras salen de la MISMA fuente que el resto de la app (`planChargesMonth` y
   `paymentEvidenceUI`): la tarjeta y Inicio no pueden decir dos cosas distintas.

   Un recibo vencido no pasa a «Para revisar» el mismo día: el banco tarda uno o dos días en
   contabilizar un cargo y avisar de «No ha llegado» a la mañana siguiente sería ruido. */
const PR6_MARGEN_DIAS=2;
/* Avisos de «Para revisar» de la tanda 2 (SPEC §2.3), solo con dato real:
   - «Esperabas X» / «Ha subido X»: pagado con cargo del banco a 0,50 o más de lo previsto (en
     céntimos, nunca en flotante). «Ha subido» solo si el mes anterior en que tocaba el banco ya
     cobró ESE mismo importe: un recibo que baila (luz, gas) cobra cada mes otra cifra y eso no
     es una subida.
   - «Hace N meses que no se cobra»: dos cobros seguidos o más sin cargo en meses en que ese
     banco SÍ trae movimientos, después de uno que sí se cobró. Sin un cobro anterior con prueba
     no se afirma nada (recibo nuevo, banco sin conectar o pagado por otro lado).
   - «Hoy/Mañana empieza a cobrar» y «Fin de permanencia: nov 2026»: solo con la fecha que él
     tecleó en «Más opciones» (`pr6PruebaDias`, `pr6PermAviso`). Sin fecha no sale nada. */
// `PR6_DIF_CENT` vive en el motor (08): lo comparte con el resumen del mes cerrado.
const PR6_FANTASMA_MIN=2, PR6_MESES_ATRAS=12, PR6_FANTASMA_CALLA=3;
function pr6MesesConBanco(s){
  const ex=s.expenses;
  if(!Array.isArray(ex)) return new Set();
  const cache=pr6MesesConBanco.cache||(pr6MesesConBanco.cache=new WeakMap());
  let meses=cache.get(ex);
  if(meses) return meses;
  meses=new Set();
  ex.forEach(function(x){ if(x&&(x.source==="ob"||x.source==="ob-hist")) meses.add(expenseBankOf(x)+"|"+String(x.date||"").slice(0,7)); });
  cache.set(ex,meses);
  return meses;
}
/* Prueba gratis y permanencia (decisión del dueño del 10/11/2026, SPEC §2.3, §2.6.2 y §7): dos
   fechas opcionales del recibo. `pruebaHasta` = "AAAA-MM-DD", el día en que empieza a cobrar;
   `permHasta` = año*12+mes en que acaba la permanencia. La permanencia solo avisa; los meses de
   prueba no se cobran y salen de lo que queda por pagar (`fixedSinCobroIn`, 07), pero no de «Se te
   van cada mes», como el prototipo. Un cliente viejo las ignora. */
function pr6PruebaDias(f,y,m,today){
  const k=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f&&f.pruebaHasta||""));
  return k?Math.round((Date.UTC(+k[1],+k[2]-1,+k[3])-Date.UTC(y,m-1,today))/864e5):null;
}
// Fin de permanencia este mes o el que viene, y sin «Ya lo he mirado» para ESA fecha.
function pr6PermAviso(f,cur){
  const p=Number(f&&f.permHasta)||0;
  return p>0&&p-cur>=0&&p-cur<=1&&Number(f.revisado&&f.revisado.perm)!==p?p:0;
}
function planRecibosAvisos(s, pack, proof, y, m, today){
  const out={}, cur=y*12+m;
  const reciboDe=function(id){ const k=/^fixed_(.*)$/.exec(String(id)); return k?(s.fixed||[]).find(function(e){ return String(e.id)===k[1]; }):null; };
  const atras=function(k){ const t=cur-k, yy=Math.floor((t-1)/12); return {y:yy,m:t-yy*12,ym:t,fin:new Date(yy,t-yy*12,0).getDate()}; };
  const visto=function(f,kind){ return Number(f.revisado&&f.revisado[kind])||0; };
  pack.paidBills.forEach(function(x){
    if(proof.confirmed[x.id]===false||!(x.paidAmount>0)) return;
    const f=reciboDe(x.id);
    if(!f) return;
    const dif=Math.round(x.paidAmount*100)-Math.round(x.plannedBankAmount*100);
    if(Math.abs(dif)<PR6_DIF_CENT||visto(f,"distinto")===cur) return;
    let antes=null;
    for(let k=1;k<=PR6_MESES_ATRAS&&antes==null;k++){
      const p=atras(k);
      if(!occursIn(f,p.m,p.y)) continue;
      const st=fixedPaymentState(s,f,p.y,p.m,p.fin);
      antes=fixedPaymentEvidence(st)&&st.paidAmount>0?st.paidAmount:0;
    }
    const sube=dif>0&&antes>0&&Math.round(antes*100)===Math.round(x.paidAmount*100);
    /* «Esperabas X» solo si el cargo lo casó el banco con su tolerancia. Enlazado a mano (prueba
       «expense»), quien lo enlazó ya vio las dos cifras (Gastos las pone en la confirmación y
       «¿Cuál es el cargo?» enseña cada importe): volver a preguntarlo sería ruido. «Ha subido»
       sí sale igual: son dos meses seguidos al precio nuevo y eso no lo confirmó nadie. */
    if(!sube){
      const ahora=fixedPaymentState(s,f,y,m,today);
      if(ahora.proof&&ahora.proof.kind==="expense") return;
    }
    out[x.id]={rv:sube?"up":"diff",cobrado:x.paidAmount,previsto:x.plannedBankAmount};
  });
  /* «Cobró distinto» de un recibo aún sin pagar (P1-11): el banco trae un adeudo parecido con otro
     nombre. No se da por pagado: se pregunta (`fixedPaymentCobroDistinto` pone las vallas). */
  pack.pendingBills.forEach(function(x){
    const f=reciboDe(x.id), cargo=f&&fixedPaymentCobroDistinto(s,f,y,m,today,true);
    if(cargo) out[x.id]={rv:"cand",cobrado:Number(cargo.amount),previsto:f.bankAmount>0?Number(f.bankAmount):occAmountIn(f,m,y),cargo:cargo};
  });
  // Mes a mes y no recibo a recibo: el índice de gastos se rehace al cambiar de mes y con veinte
  // mil movimientos recorrerlo una vez por recibo y mes se notaría en el móvil.
  const cands=pack.pendingBills.map(function(x){ return {x:x,f:reciboDe(x.id),miss:0,last:0,done:false}; }).filter(function(c){ return c.f&&!out[c.x.id]; });
  const meses=cands.length?pr6MesesConBanco(s):null;
  for(let k=1;k<=PR6_MESES_ATRAS;k++){
    const vivos=cands.filter(function(c){ return !c.done; });
    if(!vivos.length) break;
    const p=atras(k), clave="|"+p.y+"-"+String(p.m).padStart(2,"0");
    vivos.forEach(function(c){
      const f=c.f;
      if(!occursIn(f,p.m,p.y)||!(occAmountIn(f,p.m,p.y)>0)||fixedSinCobroIn(f,p.y,p.m)) return;
      if(fixedMarcadoAMano(f,p.y,p.m)!=null||fixedPaymentEvidence(fixedPaymentState(s,f,p.y,p.m,p.fin))){ c.last=p.ym; c.done=true; return; }
      // Sin movimientos de ese banco ese mes no se sabe si se cobró: ahí se deja de contar.
      if(!meses.has(accOf(f)+clave)){ c.done=true; return; }
      c.miss++;
    });
  }
  cands.forEach(function(c){
    if(!c.last||c.miss<PR6_FANTASMA_MIN) return;
    const ok=visto(c.f,"fantasma");
    if(ok&&cur<ok+PR6_FANTASMA_CALLA) return;
    out[c.x.id]={rv:"ghost",meses:cur-c.last};
  });
  // La prueba que empieza a cobrar hoy o mañana va la primera (prioridad 0): pasa por delante.
  pack.pendingBills.forEach(function(x){
    const f=reciboDe(x.id), d=f&&pr6PruebaDias(f,y,m,today);
    if(d===0||d===1) out[x.id]={rv:"trial",dias:d};
  });
  // La permanencia es lo último (prioridad 3): solo si ese recibo no tiene otro aviso. Un pagado sin
  // cargo del banco ya sale en «Para revisar» por eso, que pesa más.
  const pagadoSinCargo=function(x){ return pack.paidBills.indexOf(x)>=0&&proof.confirmed[x.id]===false; };
  pack.pendingBills.concat(pack.paidBills).forEach(function(x){
    if(out[x.id]||pagadoSinCargo(x)) return;
    const f=reciboDe(x.id), p=f&&pr6PermAviso(f,cur);
    if(p) out[x.id]={rv:"perm",ym:p};
  });
  return out;
}
/* «Te lo recuerdo mañana» (SPEC §2.3). Es una comodidad de este móvil, no un dato: vive en el
   almacén local, caduca solo al cambiar el día y, si el almacén falla, el aviso sigue saliendo. */
const PR6_POSPUESTO_KEY="mc_pr6_pospuesto";
function pr6Hoy(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function pr6PospuestoLeer(){
  try{ const o=JSON.parse(localStorage.getItem(PR6_POSPUESTO_KEY)||"{}"),hoy=pr6Hoy(),out={};
    Object.keys(o||{}).forEach(function(k){ if(o[k]===hoy) out[k]=hoy; }); return out;
  }catch(e){ return {}; }
}
function pr6PospuestoGuardar(o){ try{ localStorage.setItem(PR6_POSPUESTO_KEY,JSON.stringify(o)); }catch(e){} }
/* Enlaces de baja (SPEC §2.6.2): solo páginas oficiales de ayuda comprobadas a mano el
   28/10/2026 (cargan y explican cómo cancelar). Sin URL comprobada no sale el enlace. */
const PR6_BAJA=[
  {re:/netflix/, name:"Netflix", url:"https://help.netflix.com/es-es/node/407"},
  {re:/spotify/, name:"Spotify", url:"https://support.spotify.com/es/article/cancel-premium/"},
  {re:/youtube/, name:"YouTube Premium", url:"https://support.google.com/youtube/answer/6308278?hl=es"},
  {re:/icloud|apple (music|tv|one|arcade)/, name:"Apple", url:"https://support.apple.com/es-es/118428"}
];
function pr6Baja(name){
  const s=String(name||"").toLowerCase();
  return PR6_BAJA.find(function(b){ return b.re.test(s); })||null;
}
function planRecibosVista(pack, proof, today, avisos, pospuesto){
  avisos=avisos||{};
  pospuesto=pospuesto||{};
  const review=[], due=[], paid=[];
  // Lo pospuesto no desaparece: vuelve a su sitio de siempre (Pendiente o Ya pagados) hasta
  // mañana, así lo pendiente sigue cuadrando con la cifra de arriba.
  pack.pendingBills.forEach(function(x){
    const a=avisos[x.id];
    if(pospuesto[x.id]) due.push(x);
    else if(a&&a.rv==="trial") review.push(Object.assign({},x,{rv:"trial",dias:a.dias}));
    else if(a&&a.rv==="ghost") review.push(Object.assign({},x,{rv:"ghost",meses:a.meses}));
    else if(a&&a.rv==="cand") review.push(Object.assign({},x,{rv:"cand",cobrado:a.cobrado,previsto:a.previsto,cargo:a.cargo}));
    else if(x.overdue&&x.day!=null&&today-x.day>PR6_MARGEN_DIAS) review.push(Object.assign({},x,{rv:"late"}));
    else if(a&&a.rv==="perm") review.push(Object.assign({},x,{rv:"perm",permYm:a.ym}));
    else due.push(x);
  });
  /* Pagado solo por calendario (sin cargo del banco detrás): no se enseña como pagado ni suma en
     lo pendiente, igual que el «Por confirmar» de antes (INC-1810-03/04). Es lo que hay que mirar. */
  pack.paidBills.forEach(function(x){
    const a=avisos[x.id];
    if(proof.confirmed[x.id]===false) review.push(Object.assign({},x,{paid:false,unconfirmed:true,rv:"unconf"}));
    else if(a&&(a.rv==="diff"||a.rv==="up")&&!pospuesto[x.id]) review.push(Object.assign({},x,{rv:a.rv,cobrado:a.cobrado,previsto:a.previsto}));
    else if(a&&a.rv==="perm"&&!pospuesto[x.id]) review.push(Object.assign({},x,{rv:"perm",permYm:a.ym}));
    else paid.push(x);
  });
  const byDay=function(a,b){ return (a.day==null?99:a.day)-(b.day==null?99:b.day); };
  // Prioridad de la SPEC: primero lo que no se ha cobrado, luego lo que se cobró raro.
  const prio={trial:0,ghost:1,late:1,unconf:2,diff:2,up:2,cand:2,perm:3};
  review.sort(function(a,b){ return (prio[a.rv]-prio[b.rv])||byDay(a,b); });
  const week=pack.pendingBills.filter(function(x){ return x.day!=null&&x.day-today>=0&&x.day-today<=6; }).length;
  // Lo que se cobró de verdad: la fila ya decía «Cargo 54,71 € · Previsto 54,26 €» y la suma iba con
  // lo previsto (auditoría 226, P2-8). La diferencia se suma a tu parte; sin cargo del banco
  // (marcado a mano) cuenta lo previsto.
  const paidTotal=Math.round(paid.reduce(function(sum,x){ return sum+Math.abs(x.amount)+(planChargeChanged(x)?x.paidAmount-x.plannedBankAmount:0); },0)*100)/100;
  return {review:review, due:due, paid:paid, week:week, paidTotal:paidTotal, paidChanged:paid.some(planChargeChanged)};
}
/* En qué sección cae un recibo con el estado de después: el aviso dice dónde queda de verdad, no
   «vuelve a Pendiente» cuando cae en «Para revisar» (auditoría 9/11, P1-6). */
function pr6DondeQueda(s, id, y, m, today){
  const pack=planChargesMonth(s,m,y,today), proof=paymentEvidenceUI(s,y,m,today);
  const v=planRecibosVista(pack,proof,today,planRecibosAvisos(s,pack,proof,y,m,today),{});
  const en=function(l){ return l.some(function(x){ return x.id===id; }); };
  return en(v.review)?"review":en(v.paid)?"paid":"due";
}
/* «¿Te llega?» banco a banco (SPEC §4): un bloque por banco con recibos pendientes. El mínimo es el
   de la portada de siempre (`planCoverState` sobre el recorrido de `totals`), así la píldora y la
   hoja no pueden decir cosas distintas. `gasto` = {bank, amt} del «¿Y si gasto…?»: un gasto de hoy
   baja todo el recorrido por igual, así que el mínimo baja justo eso y su día no se mueve; lo que
   sí cambia es el primer día en negativo, y ese se vuelve a recorrer (`minWalk`). */
function planRecibosBancos(totals, pack, gasto){
  return Object.keys(pack.pendingByBank||{}).map(function(bank){
    const evs=(totals.evsByBank&&totals.evsByBank[bank])||[];
    // Entradas y traspasos que caen antes del último recibo: los de después no tocan el mínimo.
    const ultimo=pack.pendingBills.reduce(function(d,x){ return x.bank===bank?Math.max(d,Number(x.day)||0):d; },0);
    // Pagados según Plan pero aún no restados del saldo (cuenta a mano sin lectura posterior):
    // el recorrido los cobra, así que la hoja los enseña en su fila (revisión t3, R4-1).
    const sinRestar=evs.reduce(function(s,e){ return e.sinRestar?s-e.amt:s; },0);
    const b={bank:bank, known:false, bal:null, pend:Number(pack.pendingByBank[bank])||0, sinRestar:sinRestar, min:null, minDay:null, shortDay:null, falta:0,
      flows:evs.filter(function(e){ return e.id!=null&&(e.kind==="income"||e.kind==="transfer")&&e.day<=ultimo; })};
    /* `minByBank` arranca en `bankBal[b]||0` también para un banco sin cuenta: con un recibo en
       un banco que no tienes dado de alta salía «Falta 200 €» inventado (revisión 28/10/2026).
       Solo cuentan los bancos con saldo de verdad; el resto enseña «—». */
    const bal=totals.bankBal&&Object.prototype.hasOwnProperty.call(totals.bankBal,bank)?Number(totals.bankBal[bank]):NaN;
    if(!isFinite(bal)) return b;
    const cover=planCoverState(totals,bank,0,pack.pendingBills);
    if(!cover||typeof cover.min!=="number"||!isFinite(cover.min)) return b;
    const extra=gasto&&gasto.bank===bank&&gasto.amt>0?gasto.amt:0;
    b.known=true; b.bal=bal; b.min=cover.min-extra; b.minDay=cover.minDay;
    if(b.min<-0.005){
      b.falta=Math.ceil(-b.min*DISP.k-1e-9)/DISP.k;
      // Una cuota sin día resta en `planCoverState` sin día conocido: entonces no se inventa fecha.
      b.shortDay=minWalk(bal-extra,evs).shortDay;
    }
    return b;
  });
}
/* ¿Llega el dinero? La píldora suma lo que falta en cada banco con saldo conocido; sin ninguno no
   se afirma nada (SPEC §4). «Falta» redondea hacia arriba en la moneda que se enseña. */
function planRecibosLlega(totals, pack){
  const bs=planRecibosBancos(totals,pack,null).filter(function(b){ return b.known; });
  if(!bs.length) return null;
  const short=bs.reduce(function(s,b){ return b.min<0?s-b.min:s; },0);
  return short>0.005?{ok:false,falta:Math.ceil(short*DISP.k-1e-9)/DISP.k}:{ok:true};
}
/* Hora de la última lectura buena del saldo de un banco (`obBalAt`, la que dice el servidor). Con
   dos conexiones del mismo banco manda la más vieja: decir «hace 2 h» de un saldo en parte de hace
   tres días sería mentir. Sin lectura (cuenta a mano, TR por el puente) no hay frescura: 0.
   Tampoco la hay si una conexión de ese banco está caída o sin saldo (`bankIssues`, cuentas
   rancias): esa no deja hora en `obBalAt` y la de la otra pasaría por la de todo el banco. */
function pr6LecturaMs(state, bank){
  state=state||{};
  const rancio=(state.bankIssues||[]).some(function(i){ return i&&i.ent===bank; })
    ||(state.accounts||[]).some(function(a){ return a&&a.ent===bank&&a.balanceStale; })
    ||(state.obAccounts||[]).some(function(o){ return o&&o.ent===bank&&o.stale; });
  if(rancio) return 0;
  let ms=0;
  const at=state.obBalAt||{};
  Object.keys(at).forEach(function(asp){
    if(entFromAspsp(asp)!==bank) return;
    // `Date.parse` y no `dateMs`: con una fecha ilegible `dateMs` devuelve AHORA y pintaría
    // «saldo de ahora» inventado (revisión t3, R1).
    const v=Date.parse(at[asp]);
    if(isFinite(v)&&v>0&&(!ms||v<ms)) ms=v;
  });
  return ms;
}
function pr6FrescuraTxt(ms, now){
  if(!(ms>0)) return "";
  const min=Math.max(0,Math.floor((now-ms)/60000));
  if(min<1) return t("pr6_fresh_now");
  if(min<60) return tf("pr6_fresh_min",{n:min});
  if(min<24*60) return tf("pr6_fresh_h",{n:Math.floor(min/60)});
  // A partir de un día se cuenta en días de calendario, que es como se piensa «ayer».
  const a=new Date(ms), b=new Date(now);
  const d=Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate())-new Date(a.getFullYear(),a.getMonth(),a.getDate()))/864e5);
  if(d<=1) return t("pr6_fresh_ayer");
  if(d<7) return tf("pr6_fresh_d",{n:d});
  return tf("pr6_fresh_fecha",{x:a.toLocaleDateString(loc(),{day:"numeric",month:"short"})});
}
function PlanRecibos({state, set, totals, charges, evidence, manageOpen, setManageOpen, manageEdit, setManageEdit, showToast, onGoDebts, activo, onEditDebtDay}){
  const [revOpen,setRevOpen]=useState(false);
  const [dueOpen,setDueOpen]=useState(false);
  const [paidOpen,setPaidOpen]=useState(false);
  const [entOpen,setEntOpen]=useState(false), [inOpen,setInOpen]=useState(false), [trOpen,setTrOpen]=useState(false);
  const [ficha,setFicha]=useState(null);
  const [undoFicha,setUndoFicha]=useState(null), [avisoFicha,setAvisoFicha]=useState(null);
  // La ficha desaparece al quitar el último recibo; el controlador vive en Plan para poder reponerlo.
  const fichaUndo=useBillUndo(state,set,activo!==false&&!manageOpen,function(token){
    setFicha(null); setUndoFicha(token); setAvisoFicha(null);
  },function(key,finish){
    if(finish) setFicha(null);
    setAvisoFicha(t(key||"gb_undo_changed"));
  });
  const cerrarFicha=function(){ fichaUndo.cancel(); setFicha(null); setUndoFicha(null); };
  useEffect(function(){
    if(!undoFicha) return undefined;
    const id=setTimeout(function(){ setUndoFicha(null); },Math.max(0,undoFicha.until-Date.now()));
    return function(){ clearTimeout(id); };
  },[undoFicha]);
  useEffect(function(){
    if(!avisoFicha) return undefined;
    const id=setTimeout(function(){ setAvisoFicha(null); },4500);
    return function(){ clearTimeout(id); };
  },[avisoFicha]);
  useEffect(function(){
    if(activo===false||manageOpen){ setFicha(null); setUndoFicha(null); setAvisoFicha(null); }
  },[activo,manageOpen]);
  const avisoQuitar=React.createElement(React.Fragment,null,
    undoFicha&&React.createElement(BillUndoToast,{onUndo:function(){ if(fichaUndo.undo(undoFicha)!==false) setUndoFicha(null); }}),
    avisoFicha&&React.createElement(BillUndoToast,{notice:avisoFicha}));
  // Las hojas de «¿Te llega?» y «Te deben» guardan su abierto/cerrado en `Pr6HojaHost`: abrirlas no repinta Recibos.
  const llegaHost=useRef(null), debenHost=useRef(null);
  const paidRef=useRef(null), entRef=useRef(null);
  const [pospuesto,setPospuesto]=useState(pr6PospuestoLeer);
  const [deshacer,setDeshacer]=useState(null);
  const deshacerT=useRef(0);
  const vivo=useRef(state); vivo.current=state;
  useEffect(function(){ return function(){ clearTimeout(deshacerT.current); }; },[]);
  const month=totals.curMonth, today=totals.today, year=totals.curYear;
  const pack=charges||planChargesMonth(state, totals.curMonth, totals.curYear, today);
  const proof=evidence||paymentEvidenceUI(state,totals.curYear,totals.curMonth,today);
  // `pack` y `proof` ya dependen de recibos, gastos y extracto; `revisado` vive en el recibo. El
  // «cobró distinto» lee además vetos, borrados y cuotas aprendidas, que el paquete no siempre lleva.
  const avisos=useMemo(function(){ return planRecibosAvisos(state,pack,proof,year,month,today); },
    [pack,proof,state.fixed,state.expenses,state.bankTx,state.reciboNo,state.deleted,state.debts,state.oneoffs,state.cuotaAlias,year,month,today]);
  /* Vista del mes siguiente «Nov ›» (SPEC §2.2). Misma lectura que los cargos del mes que viene de
     Inicio (`planChargesMonth` con hoy = 0: de ese mes aún no ha llegado nada), así las dos
     pantallas no pueden decir cosas distintas. Solo se calcula mientras se mira. */
  const [vista,setVista]=useState("mes");
  const sig=vista==="sig";
  const sigM=month===12?1:month+1, sigY=month===12?year+1:year;
  const sigPack=useMemo(function(){ return sig?planChargesMonth(state,sigM,sigY,0):null; },
    [sig,sigM,sigY,state.fixed,state.debts,state.oneoffs,state.flows,state.bankTx,state.accounts,state.expenses,state.deleted,state.reciboNo,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner]);
  /* Primer uso (SPEC §9): sin recibos, puntuales, cuotas ni entradas no hay nada que enseñar y la
     tarjeta en 0 no dice nada. Se mira el plan entero, no solo este mes, para no esconder nada. */
  const vacio=!(state.fixed||[]).length&&!(state.oneoffs||[]).length&&!(state.debts||[]).some(debtActive)&&!(state.flows||[]).length;
  /* Resumen del mes cerrado (SPEC §2.1): los primeros días del mes, hasta que se cierre. El
     descarte es de ESE mes y vive en `settings` para que el otro móvil no lo vuelva a sacar. */
  const fotos=state.settings&&state.settings.pr6Fotos;
  const cerrado=useMemo(function(){ return !vacio&&today<=PR6_CERRADO_DIAS?planRecibosMesCerrado(state,year,month):null; },
    [vacio,today,year,month,fotos,state.fixed,state.debts,state.oneoffs,state.flows,state.bankTx,state.accounts,state.expenses,state.deleted,state.reciboNo,state.reciboBorradoAt,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner]);
  const cerradoNo=Number(state.settings&&state.settings.pr6CerradoNo)||0;
  const [cerradoAbierto,setCerradoAbierto]=useState(false);
  const [cerradoSale,setCerradoSale]=useState(false);
  const cerradoT=useRef(0);
  useEffect(function(){ return function(){ clearTimeout(cerradoT.current); }; },[]);
  const descartarCerrado=function(){
    if(!cerrado) return;
    const ym=cerrado.ym;
    // Primero se pliega y luego se guarda: si se guardara antes, desaparecería de golpe.
    setCerradoSale(true);
    clearTimeout(cerradoT.current);
    cerradoT.current=setTimeout(function(){
      set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings||{},{pr6CerradoNo:ym})}); });
    },mcReduced()?0:400);
  };
  /* Foto del mes en curso (ver `planRecibosConFoto`, 08): lo que Plan enseña hoy, para que el
     resumen del mes que viene no tenga que releer este mes con datos que ya habrán cambiado. Sin
     sello de edición (`set(…, false)`): es lectura, no algo que él haya cambiado. */
  useEffect(function(){
    set(function(s){ return planRecibosConFoto(s,year,month,today,pack,proof); },false);
  },[pack,proof,year,month,today]);
  const [impOpen,setImpOpen]=useState(false);
  const [addNow,setAddNow]=useState(0);
  const importables=useMemo(function(){ return vacio?pr6Importables(state):[]; },[vacio,state.expenses,state.fixed]);
  const v=useMemo(function(){ return planRecibosVista(pack,proof,today,avisos,pospuesto); },[pack,proof,today,avisos,pospuesto]);
  // Pausados este mes: no suman ni salen como pendientes, pero se ven tachados en «Ya pagados»
  // para poder devolverlos al mes con un toque (SPEC §2.5). Solo la pausa: el que está en prueba
  // gratis no se cobra este mes y no hay nada que devolver; el prototipo ni lo enseña (`fromNext`).
  const pausados=useMemo(function(){
    return (state.fixed||[]).filter(function(f){ return occursIn(f,month,year)&&occAmountIn(f,month,year)>0&&fixedPausedIn(f,year,month)&&fixedEnPausa(state,f,year,month,today); });
  },[pack,state.fixed,year,month,today]);
  // Un solo aviso con «Deshacer» para todo lo que se hace de un toque en Recibos.
  const avisarDeshacer=function(msg,undo){
    clearTimeout(deshacerT.current);
    setDeshacer({msg:msg,undo:undo});
    deshacerT.current=setTimeout(function(){ setDeshacer(null); },5000);
  };
  const posponer=function(x){
    const next=Object.assign({},pr6PospuestoLeer(),{[x.id]:pr6Hoy()});
    pr6PospuestoGuardar(next); setPospuesto(next);
    avisarDeshacer(tf("pr6_manana_toast",{name:x.name}),function(){
      const n=Object.assign({},pr6PospuestoLeer()); delete n[x.id];
      pr6PospuestoGuardar(n); setPospuesto(n);
    });
  };
  const deshacerYa=function(){
    if(!deshacer) return;
    deshacer.undo();
    clearTimeout(deshacerT.current); setDeshacer(null);
  };
  /* Un toque devuelve al mes un recibo saltado (SPEC §2.5), pero con «Deshacer»: era fácil
     tocarlo sin querer al repasar «Ya pagados» y la cifra de arriba subía sin más (P1-6). */
  /* El Deshacer repone la FOTO de antes (la fila del recibo y el `value` de las cuentas que movió),
     no vuelve a pausar: reanudar borra `manualPauseBalance` y repone la base de la cuenta, y pausar
     otra vez compensaba desde el saldo ya bajado, así que la cuenta se quedaba 75 € por debajo
     (revisión de dinero 9/11, B1). Solo si nadie ha tocado esa fila ni esas cuentas entretanto. */
  const devolverAlMes=function(f){
    const cur=year*12+month;
    const quita=function(s){ const e=(s.fixed||[]).find(function(o){ return o.id===f.id; }); return e?fixedPausa(s,e.id,cur+1,Number(e.pausedUntil)||0):s; };
    const donde=pr6DondeQueda(quita(state),"fixed_"+f.id,year,month,today);
    let foto=null;
    set(function(s){
      const n=quita(s), fila=function(x){ return (x.fixed||[]).find(function(o){ return o.id===f.id; })||null; };
      const cuentas=[];
      (n.accounts||[]).forEach(function(a,i){ const b=(s.accounts||[])[i]; if(b&&b.id===a.id&&b.value!==a.value) cuentas.push({id:a.id,antes:b.value,despues:a.value}); });
      foto={antes:fila(s),despues:fila(n),cuentas:cuentas};
      return n;
    });
    const intacto=function(s){
      if(!foto||!foto.antes) return false;
      const e=(s.fixed||[]).find(function(o){ return o.id===f.id; });
      return !!e&&goalSyncEqual(e,foto.despues)&&foto.cuentas.every(function(c){ const a=(s.accounts||[]).find(function(x){ return x.id===c.id; }); return a&&a.value===c.despues; });
    };
    avisarDeshacer(tf(donde==="review"?"pr6_revisar_toast":donde==="paid"?"pr6_a_pagados_toast":"pr6_vuelve_toast",{name:f.name}),function(){
      // Una sync que cambió la fila o la cuenta entretanto: no se pisa, y se dice (no callar el fallo).
      if(!intacto(vivo.current)){ if(showToast) showToast(t("pr6_undo_cambio")); return; }
      set(function(s){
        if(!intacto(s)) return s;
        return Object.assign({},s,{
          fixed:s.fixed.map(function(o){ return o.id===f.id?foto.antes:o; }),
          accounts:foto.cuentas.length?s.accounts.map(function(a){ const c=foto.cuentas.find(function(x){ return x.id===a.id; }); return c?Object.assign({},a,{value:c.antes}):a; }):s.accounts});
      });
    });
  };
  const llega=useMemo(function(){ return planRecibosLlega(totals,pack); },[totals.minByBank,totals.minDayByBank,totals.bankBal,pack]);
  // «Te deben» (SPEC §5): lo que te deben de sus partes este mes y aún no te han pagado. Lee los
  // ingresos del mes (`teDebenRecibido`), así que depende también de gastos y borrados.
  const deben=useMemo(function(){ return teDebenMes(state,year,month,today); },
    [pack,state.fixed,state.debts,state.expenses,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,year,month,today]);
  const debenTotal=deben.reduce(function(a,p){ return a+Math.round(p.falta*100); },0)/100;
  useBackClose(!!paidOpen, function(){ setPaidOpen(false); });
  useBackClose(!!entOpen, function(){ setEntOpen(false); });
  const openManage=function(){ setManageEdit(null); setManageOpen(true); };
  const abrir=function(x){
    if(/^(fixed|oneoff|debt|balloon|flow)_/.test(String(x.id))) setFicha({id:x.id});
  };
  // Cargo de Gastos marcado como cuota de cada deuda este mes (para decirlo en su fila).
  const enlaces=useMemo(function(){
    const out={};
    pack.pendingBills.concat(pack.paidBills).forEach(function(x){
      if(x.kind!=="debt"&&x.kind!=="balloon") return;
      const id=String(x.id).replace(/^(debt|balloon)_/,"");
      const ce=deudaCargoEnlazado(state,(state.debts||[]).find(function(d){ return String(d.id)===id; }),year,month,today);
      if(ce&&!ce.acredita) out[x.id]=ce;
    });
    return out;
  },[pack,state.debts,state.expenses,year,month,today]);
  const verPlegado=pr6VerPlegado;
  const conflictOf=function(x){
    const match=String(x.id).match(/^(fixed|debt|balloon)_(.*)$/),kind=match&&match[1]!=="fixed"?"debts":"fixed";
    const item=match&&(state[kind]||[]).find(function(e){return String(e.id)===match[2];});
    return item&&planSyncConflict(state,kind,item.id);
  };
  const subOf=function(x){
    /* Con lo descontado de otro recibo, «pagas 197 € + 53 € de Pepephone» ya dice que es una cuota:
       delante de «cuota de deuda ·» la línea se iba a tres renglones (auditoría 9/11, P2-1). */
    if(x.kind==="debt"||x.kind==="balloon") return enlaces[x.id]
      ? tf("pr6_enlazado_x",{x:eur(Number(enlaces[x.id].x.amount))})+" · "+(x.descuento?pr6PagasMas(x):entOf(x.bank).label)
      : (x.descuento?pr6PagasMas(x):t("pr6_cuota")+" · "+entOf(x.bank).label);
    const f=/^fixed_/.test(String(x.id))&&(state.fixed||[]).find(function(e){ return "fixed_"+e.id===x.id; });
    const cat=f&&f.category&&CAT[f.category]?pr6CatDe(catName(f.category),f.name):"";
    return (cat?cat+" · ":"")+entOf(x.bank).label
      +(x.teDeben?" · "+pr6TeHanPagado(x.teDeben):"");
  };
  // Días que faltan; en la vista del mes siguiente, contados de calendario hasta ese día.
  const diasHasta=function(x){
    if(x.day==null) return null;
    if(!sig) return x.day-today;
    return Math.round((new Date(sigY,sigM-1,x.day)-new Date(year,month-1,today))/864e5);
  };
  const cuando=function(x){
    const n=diasHasta(x);
    if(n==null) return "";
    if(n===0) return t("pr6_hoy");
    if(n===1) return t("pr6_manana");
    if(n>1) return tf("pr6_en_dias",{n:n});
    return n===-1?t("pr6_tocaba_ayer"):tf("pr6_tocaba",{n:-n});
  };
  const esVariable=function(x){ const f=/^fixed_/.test(String(x.id))&&(state.fixed||[]).find(function(e){ return "fixed_"+e.id===x.id; }); return !!(f&&f.variable); };
  const plegado=function(open){ return open?null:{"aria-hidden":"true",inert:""}; };
  /* En la vista del mes siguiente la ficha no vale: enseña el estado de ESTE mes (pagado, cargo…).
     Un recibo o puntual abre su edición; una cuota, Deudas, como siempre. */
  const abrirSig=function(x){
    if(x.kind==="debt"||x.kind==="balloon"){ abrir(x); return; }
    const k=/^(fixed|oneoff)_(.*)$/.exec(String(x.id));
    if(k){ setManageEdit(k[2]); setManageOpen(true); }
  };
  const withDayPrompt=function(x,row){
    const d=x.kind==="debt"&&(state.debts||[]).find(function(d){return "debt_"+d.id===x.id;});
    return React.createElement(React.Fragment,{key:x.id},row,React.createElement(DebtDayPrompt,{debt:d,onOpen:onEditDebtDay}));
  };
  const dueRow=function(x){
    const n=diasHasta(x);
    // El nombre se corta con elipsis en la fila; el lector de pantalla lee la frase entera
    // (nombre · banco · cuándo · importe) en vez de los trozos sueltos (auditoría 2026-11-07).
    const lbl=[x.name,subOf(x),x.day!=null?cuando(x):"",(esVariable(x)?"≈ ":"")+eur(Math.abs(x.amount))].filter(Boolean).join(" · ");
    const fila=React.createElement("button",{type:"button",className:"v4-charge pr6-row",key:x.id,"data-recibo":x.id,"aria-label":lbl,onClick:function(){ if(sig) abrirSig(x); else abrir(x); }},
      React.createElement("span",{className:"dt","aria-hidden":"true"},
        React.createElement("span",{className:"d"}, x.day||"—"),
        React.createElement("span",{className:"m"}, monthShort((sig?sigM:month)-1))),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name,React.createElement(PlanConflictDot,{record:conflictOf(x)})),
        /* Un renglón: «categoría · banco · en 14 días». Con tres (nombre, banco y cuándo sueltos) cada
           fila medía 93 px a 412 y una cuota llegaba a cuatro («las tarjetas son enormes», 11/11/2026).
           Lo que no cabe se acorta por delante; cuándo se queda entero, que es lo que se mira. */
        React.createElement("span",{className:"sub pr6-sub-cat"},
          React.createElement("span",{className:"pr6-cat"}, subOf(x)),
          x.day!=null&&React.createElement("span",{className:"pr6-bk pr6-when"+(n!=null&&n<=1?" soon":"")}, "· "+cuando(x)))),
      // «Cambia cada mes» (alta por pasos): la cifra es una previsión, se marca con «≈».
      React.createElement("span",{className:"am num"}, (esVariable(x)?"≈ ":"")+eur(Math.abs(x.amount))));
    return withDayPrompt(x,fila);
  };
  /* «No ha llegado» en la fila, como la SPEC (§2.3) y el prototipo: «tocaba hace 8 días» obligaba a
     hacer la cuenta y la fecha ya va en la ficha (auditorías de la 218 y la 222, P2-1).
     La prueba gratis y la permanencia, cortas en la fila: «Mañana empieza a cobrar» y «Fin de
     permanencia: dic 2026» partían en dos renglones a 360 px (auditorías de la 221 y la 222). El icono
     y «Para revisar» ya dicen qué es; la ficha y el lector de pantalla llevan la frase entera (`pr6Motivo`). */
  const motivoFila=function(x){
    if(enlaces[x.id]) return tf("pr6_enlazado_x",{x:eur(Number(enlaces[x.id].x.amount))});
    if(x.rv==="trial") return t(x.dias===0?"pr6_prueba_hoy_fila":"pr6_prueba_manana_fila");
    if(x.rv==="perm") return tf("pr6_perm_fila",{x:pr6MesAno(x.permYm)});
    return pr6Motivo(x);
  };
  const revRow=function(x){
    const cobro=x.rv==="diff"||x.rv==="up"||x.rv==="cand";
    const lbl=[x.name,enlaces[x.id]?tf("pr6_enlazado_x",{x:eur(Number(enlaces[x.id].x.amount))}):pr6Motivo(x),eur(cobro?x.cobrado:Math.abs(x.amount))].filter(Boolean).join(" · ");
    const fila=React.createElement("button",{type:"button",className:"v4-charge pr6-rev",key:x.id,"data-recibo":x.id,"data-review":x.rv,"aria-label":lbl,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"pr6-ico","aria-hidden":"true"},
        React.createElement("svg",{width:19,height:19,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round"},
          React.createElement("path",{d:PR6_ICO[x.rv]||PR6_ICO.unconf}))),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name,React.createElement(PlanConflictDot,{record:conflictOf(x)})),
        React.createElement("span",{className:"sub pr6-why"}, motivoFila(x))),
      // Lo cobrado de más o de menos se enseña tal cual lo cobró el banco.
      React.createElement("span",{className:"am num"}, eur(cobro?x.cobrado:Math.abs(x.amount))));
    return withDayPrompt(x,fila);
  };
  const pausadoRow=function(f){
    return React.createElement("button",{type:"button",className:"v4-charge v4-paid pr6-prow pr6-skip",key:"p_"+f.id,"data-recibo":"fixed_"+f.id,"data-pausado":"1",
      "aria-label":f.name+" · "+t("pr6_este_mes_no"),onClick:function(){ devolverAlMes(f); }},
      React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},"–"),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, f.name),
        React.createElement("span",{className:"sub"}, t("pr6_este_mes_no"))),
      React.createElement("span",{className:"am num"}, eur(occAmountIn(f,month,year))));
  };
  const paidRow=function(x){
    // Si el cargo no fue lo previsto, se dice cuánto fue (la cifra de la fila sigue siendo la previsión).
    const how=[x.aMano?t("pr6_a_mano_sub"):x.paidBank?tf("pr6_cargo_de",{bank:entOf(x.paidBank).label}):"",planChargeChanged(x)?tf("v4_charge_actual",{x:eur(x.paidAmount)}):"",
      x.descuento?pr6PagasMas(x):""].filter(Boolean).join(" · ");
    return withDayPrompt(x,React.createElement("button",{type:"button",className:"v4-charge v4-paid pr6-prow",key:x.id,"data-recibo":x.id,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},"✓"),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name,React.createElement(PlanConflictDot,{record:conflictOf(x)})),
        React.createElement("span",{className:"sub"},
          x.day!=null&&React.createElement(React.Fragment,null,React.createElement("span",{className:"d"},x.day)," ",React.createElement("span",{className:"m"},monthShort(month-1)),how?" · ":""),
          how)),
      React.createElement("span",{className:"am num"}, planChargeAmount(x))));
  };
  /* Lo que entra y lo que mueves, con las MISMAS filas que Por pagar y Ya pagados (12/11/2026, «va
     diferente toda esa sección»): tocar abre su ficha, y lo que ha llegado pasa a «Ya ha entrado»
     con el movimiento que lo acredita en vez de desaparecer. */
  const flowsDone=pack.flowsDone||[];
  const flowSub=function(x){
    return x.kind==="transfer"?tf("fl_de_a",{from:entOf(x.bank).label,to:x.to?entOf(x.to).label:"—"}):entOf(x.bank).label;
  };
  const flowAmt=function(x){ return (x.kind==="income"?"+":"")+eur(Math.abs(x.amount)); };
  const flowRow=function(x){
    const n=diasHasta(x);
    const lbl=[x.name,flowSub(x),x.day!=null?cuando(x):"",flowAmt(x)].filter(Boolean).join(" · ");
    return React.createElement("button",{type:"button",className:"v4-charge pr6-row",key:x.id,"data-flujo":x.id,"aria-label":lbl,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"dt","aria-hidden":"true"},
        React.createElement("span",{className:"d"}, x.day||"—"),
        React.createElement("span",{className:"m"}, monthShort(month-1))),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name),
        React.createElement("span",{className:"sub pr6-sub-cat"},
          React.createElement("span",{className:"pr6-cat"}, flowSub(x)),
          x.day!=null&&React.createElement("span",{className:"pr6-bk pr6-when"+(n!=null&&n<=1?" soon":"")}, "· "+cuando(x)))),
      React.createElement("span",{className:"am num"+(x.kind==="income"?" pos":"")}, flowAmt(x)));
  };
  const entRow=function(x){
    const how=x.aMano?t("pr6_a_mano_sub"):x.paidBank?tf("fl_mov_de",{bank:entOf(x.paidBank).label}):"";
    return React.createElement("button",{type:"button",className:"v4-charge v4-paid pr6-prow",key:x.id,"data-flujo":x.id,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},"✓"),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name),
        React.createElement("span",{className:"sub"},
          x.day!=null&&React.createElement(React.Fragment,null,React.createElement("span",{className:"d"},x.day)," ",React.createElement("span",{className:"m"},monthShort(month-1)),how?" · ":""),
          how)),
      React.createElement("span",{className:"am num"+(x.kind==="income"?" pos":"")}, flowAmt(x)));
  };
  // Lo que ha entrado de verdad: con movimiento, su importe; marcado a mano, lo previsto. Los traspasos no suman: no es dinero nuevo.
  const entTotal=Math.round(flowsDone.reduce(function(a,x){ return x.kind==="income"?a+(x.paidAmount>0?x.paidAmount:Math.abs(x.amount)):a; },0)*100)/100;
  const nPend=pack.pendingBills.length, nBills=nPend+pack.paidBills.length+pausados.length;
  const countLine=nPend>0
    ? tf(nPend===1?"pr6_count_one":"pr6_count",{n:nPend})+(v.week>0?" · "+tf("pr6_count_week",{n:v.week}):"")
    : (nBills>0?t("pr6_all_paid"):"");
  const fichaRow=ficha&&(pack.pendingBills.concat(pack.paidBills,pack.transfersPending,pack.incomePending||[],flowsDone).find(function(x){ return x.id===ficha.id; })||null);
  // Pausar o borrar desde la ficha saca el recibo del mes antes de que la hoja termine de irse:
  // sin olvidarla, reaparecía abierta en cuanto el recibo volvía al mes.
  useEffect(function(){ if(ficha&&!fichaRow) setFicha(null); },[ficha,fichaRow]);
  // Al cambiar de mes la lista vuelve a sus tres primeras: lo desplegado era del otro mes.
  // La entrada lateral solo al cambiar: al abrir Plan la tarjeta ya sube con `rise`.
  const [vistaAnim,setVistaAnim]=useState(false);
  const irVista=function(v){ setDueOpen(false); setVistaAnim(true); setVista(v); };
  /* La vista entra de lado animando SIEMPRE el mismo nodo (capa fija). Antes se remontaba con
     `key` y una animación CSS: la capa nacía con la vista nueva y en su móvil la lista salía en
     blanco el primer fotograma (barrido del 7/11). */
  const vistasRef=useRef(null);
  React.useLayoutEffect(function(){
    const el=vistasRef.current;
    if(!vistaAnim||!el||!el.animate||mcReduced()) return;
    const a=el.animate([{opacity:.4,transform:"translateX("+(vista==="sig"?16:-16)+"px)"},{opacity:1,transform:"none"}],
      {duration:320,easing:"cubic-bezier(.22,.61,.36,1)"});
    return function(){ a.cancel(); };
  },[vista]);
  const cambiarVista=function(){ irVista(sig?"mes":"sig"); };
  /* El mes siguiente es una capa más: el atrás (también el de la APK) vuelve primero al mes en
     curso. Y al salir de Recibos (otro segmento u otra pestaña) se vuelve al mes en curso: Plan
     está premontado y, si no, al volver seguía en diciembre (revisión 31/10/2026). La pestaña
     activa no llega como prop a propósito (11-app-main.js: cambiar de pestaña no re-renderiza las
     páginas), así que se mira la pestaña de Plan de la barra (`active`) solo mientras dura la vista.
     La clase de la página no sirve: `page-live` la llevan también las vecinas premontadas. */
  useBackClose(sig,function(){ irVista("mes"); });
  useEffect(function(){ if(sig&&activo===false) setVista("mes"); },[sig,activo]);
  useEffect(function(){
    if(!sig) return undefined;
    const tab=document.querySelector('.botnav-tab[data-tour="plan"]');
    if(!tab||typeof MutationObserver==="undefined") return undefined;
    const mo=new MutationObserver(function(){ if(!tab.classList.contains("active")) setVista("mes"); });
    mo.observe(tab,{attributes:true,attributeFilter:["class"]});
    return function(){ mo.disconnect(); };
  },[sig]);
  const sigN=sigPack?sigPack.pendingBills.length:0;
  // Al cambiar de mes la tarjeta no repite su `rise`: entra de lado con el resto de la vista.
  const tarjeta=React.createElement("div",{className:"v4-card v4-card-hero pr6-sum"+(vistaAnim?"":" rise"),"data-testid":"plan-summary","data-vista":vista},
    React.createElement("div",{className:"pr6-vista"},
      React.createElement("div",{className:"pr6-sum-h"},
        React.createElement("div",{className:"v4-micro"}, sig?tf("pr6_se_van",{month:monthLong(sigM-1)}):tf("v4_plan_left",{month:monthLong(month-1)})),
        React.createElement("button",{type:"button",className:"pr6-mes-nav","data-testid":"plan-mes-nav",onClick:cambiarVista,
          "aria-label":sig?monthLong(month-1):monthLong(sigM-1)}, sig?"‹ "+monthShort(month-1):monthShort(sigM-1)+" ›")),
      React.createElement("div",{className:"serif num pr6-big"}, eur(sig?sigPack.pendingBillsTotal:pack.pendingBillsTotal)),
      sig
        ? sigN>0&&React.createElement("div",{className:"pr6-count","data-testid":"plan-count"}, tf(sigN===1?"pr6_count_one":"pr6_count",{n:sigN}))
        : countLine&&React.createElement("div",{className:"pr6-count","data-testid":"plan-count"}, countLine),
      // «¿Te llega?» recorre el saldo de ESTE mes: en el siguiente no hay recorrido que enseñar.
      !sig&&(llega&&nPend>0||debenTotal>0.005)&&React.createElement("div",{className:"pr6-pills"},
        llega&&nPend>0&&React.createElement("button",{type:"button",className:"pr6-pill "+(llega.ok?"ok":"falta"),"data-testid":"plan-llega","aria-haspopup":"dialog",
          onClick:function(){ if(llegaHost.current) llegaHost.current(true); }},
          llega.ok&&React.createElement("span",{className:"pr6-pill-ok","aria-hidden":"true"},"✓"),
          llega.ok?t("pr6_llega"):tf("pr6_falta",{x:eur0(llega.falta)}),
          // Sin la flecha no se ve que la píldora se abre.
          React.createElement("svg",{className:"pr6-pill-go",width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
            React.createElement("path",{d:"M9 6l6 6-6 6"}))),
        debenTotal>0.005&&React.createElement("button",{type:"button",className:"pr6-pill","data-testid":"plan-deben","aria-haspopup":"dialog",
          onClick:function(){ if(debenHost.current) debenHost.current(true); }},
          tf("pr6_te_deben",{x:eur(debenTotal)}),
          React.createElement("svg",{className:"pr6-pill-go",width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
            React.createElement("path",{d:"M9 6l6 6-6 6"}))))));
  const manage=React.createElement(BillsManagePush,{key:"manage-bills",open:manageOpen,onClose:function(){ setManageOpen(false); setManageEdit(null); setAddNow(0); },state:state,set:set,totals:totals,simple:false,editId:manageEdit,addNow:addNow,onGoDebts:onGoDebts});
  /* La hoja de importar vive fuera de la rama del primer uso: al añadir, el plan deja de estar
     vacío y, dentro de esa rama, la hoja se desmontaba de golpe; el segundo toque de un doble
     toque caía entonces en el «+» de abajo (revisión 31/10/2026). Ahora cierra con su animación y
     añade al terminar, con el velo aún encima. */
  const importar=impOpen&&React.createElement(RecibosImportSheet,{items:importables,set:set,showToast:showToast,onClose:function(){ setImpOpen(false); }});
  if(vacio){
    // Con cargos repetidos en el banco, la importación; sin ellos, directo al alta por pasos.
    const empezar=function(){
      if(importables.length){ setImpOpen(true); return; }
      setManageEdit(null); setAddNow(Date.now()); setManageOpen(true);
    };
    const bancos=Array.from(new Set(importables.map(function(d){ return entOf(d.bank).label; })));
    return React.createElement(React.Fragment,null,
      React.createElement("section",{className:"v4-card rise pr6-onb","data-testid":"plan-onb"},
        // La flecha que da la vuelta es de «cargos que se repiten»; sin ninguno, el «+» de empezar uno.
        React.createElement("span",{className:"pr6-onb-ico","aria-hidden":"true"},
          React.createElement("svg",{width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round"},
            React.createElement("path",{d:importables.length?"M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5":"M12 5v14M5 12h14"}))),
        React.createElement("span",{className:"pr6-onb-t"},
          React.createElement("span",{className:"serif pr6-onb-n"}, importables.length?tf(importables.length===1?"pr6_onb_1":"pr6_onb_n",{n:importables.length}):t("pr6_onb_vacio")),
          bancos.length>0&&React.createElement("span",{className:"pr6-onb-s"}, tf("pr6_onb_en",{x:pr6Lista(bancos)}))),
        React.createElement("button",{type:"button",className:"pr6-cta","data-testid":"plan-empezar",onClick:empezar}, t("pr6_empezar"))),
      importar,
       manage,avisoQuitar);
  }
  /* Sin cifra del mes cerrado la tarjeta solo decía «— en recibos · sin datos de octubre»: ruido. La
     SPEC §2.1 pide líneas con dato real, así que no sale (auditorías de la 218 y la 222, P2-7). Si lo
     que falta es el mes de antes sí sale, con el porqué (rechazo de la beta 206). */
  const verCerrado=!!cerrado&&cerrado.cent!=null&&cerrado.ym!==cerradoNo;
  const lineasCerrado=cerrado?pr6LineasCerrado(cerrado):[];
  return React.createElement(React.Fragment,null,
    // Se pliega (no desaparece) al descartarlo y al pasar al mes siguiente, donde no sale (SPEC §2.1).
    verCerrado&&React.createElement("div",Object.assign({className:"pr6-cz"+(sig||cerradoSale?" fuera":"")},sig||cerradoSale?{"aria-hidden":"true",inert:""}:null),
      React.createElement("div",{className:"pr6-cz-in"},
        React.createElement("section",{className:"pr6-cerr","data-testid":"plan-cerrado","aria-label":pr6TituloCerrado(cerrado)},
          React.createElement("div",{className:"pr6-cerr-h"},
            React.createElement("span",{className:"pr6-cerr-ico","aria-hidden":"true"},
              React.createElement("svg",{width:17,height:17,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round",strokeLinejoin:"round"},
                React.createElement("path",{d:"M5 12.5l4.5 4.5L19 7.5"}))),
            React.createElement(lineasCerrado.length?"button":"div",Object.assign({className:"pr6-cerr-t"},lineasCerrado.length?{type:"button","aria-expanded":cerradoAbierto?"true":"false","aria-controls":"pr6-cerr-det",
              onClick:function(){ setCerradoAbierto(function(o){ return !o; }); }}:null),
              React.createElement("span",{className:"pr6-cerr-n"}, pr6TituloCerrado(cerrado)),
              React.createElement("span",{className:"num pr6-cerr-l","data-testid":"plan-cerrado-linea"}, pr6LineaCerrado(cerrado)),
              React.createElement("span",{className:"num pr6-cerr-l","data-testid":"plan-cerrado-vs"}, pr6VsCerrado(cerrado))),
            React.createElement("button",{type:"button",className:"pr6-cerr-x","aria-label":t("pr6c_cerrar"),"data-testid":"plan-cerrado-x",onClick:descartarCerrado},
              React.createElement("svg",{width:15,height:15,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
                React.createElement("path",{d:"M6 6l12 12M18 6L6 18"})))),
          lineasCerrado.length>0&&React.createElement("div",{className:"pr6-fold"+(cerradoAbierto?" open":""),id:"pr6-cerr-det"},
            React.createElement("div",Object.assign({className:"pr6-fold-in pr6-cerr-det"},plegado(cerradoAbierto)),
              lineasCerrado.map(function(l){
                return React.createElement("div",{className:"pr6-cerr-row",key:l.k,"data-linea":l.k},
                  React.createElement("span",null,l.l),React.createElement("span",{className:"num"},l.v));
              })))))),
    // Toda la vista entra de lado al cambiar de mes, no solo la tarjeta (feedback 28/10).
    React.createElement("div",{className:"pr6-vistas",ref:vistasRef},
    tarjeta,
    !sig&&v.review.length>0&&React.createElement("section",{className:"pr6-sec","data-testid":"plan-review","aria-label":t("pr6_revisar")},
      React.createElement("div",{className:"pr6-sec-h"},
        React.createElement("span",null, t("pr6_revisar"),React.createElement("span",{className:"pr6-n"}, v.review.length))),
      pr6Tres(v.review,revRow,revOpen,setRevOpen,"pr6-rev-more")),
    React.createElement("section",{className:"pr6-sec","data-testid":"plan-due","data-vista":vista,"aria-label":sig?pr6EnMes(sigM):t("pr6_por_pagar")},
      React.createElement("div",{className:"pr6-sec-h v4-section-h"},
        /* «Por pagar», como la SPEC (§2.4) y el prototipo. El «Pendiente» del 26/10 fue cosa nuestra al
           quitar la línea de ayuda de la pantalla vieja, no una petición suya (b4621988f). */
        React.createElement("span",null, sig?pr6Cap(pr6EnMes(sigM)):t("pr6_por_pagar")),
        React.createElement("button",{type:"button",className:"link pr6-todos","data-testid":"plan-todos",onClick:openManage}, t("pr6_todos"),
          React.createElement("svg",{width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
            React.createElement("path",{d:"M9 6l6 6-6 6"})))),
      sig
        ? (sigN===0
          ? React.createElement("div",{className:"pr6-empty"}, tf("pr6_nada_sig",{month:monthLong(sigM-1)}))
          : pr6Tres(sigPack.pendingBills,dueRow,dueOpen,setDueOpen,"pr6-due-more"))
        : (v.due.length===0
          ? React.createElement("div",{className:"pr6-empty"}, t("pr6_nada"))
          : pr6Tres(v.due,dueRow,dueOpen,setDueOpen,"pr6-due-more"))),
    !sig&&(v.paid.length>0||pausados.length>0)&&React.createElement("section",{className:"pr6-paid pr6-paid-in"+(paidOpen?" open":""),ref:paidRef,"data-testid":"plan-paid","aria-label":t("pr6_ya_pagados")},
      React.createElement("button",{type:"button",className:"pr6-paid-h","aria-expanded":paidOpen?"true":"false","aria-controls":"pr6-paid-list",
        onClick:function(){ setPaidOpen(function(o){ if(!o) verPlegado(paidRef.current); return !o; }); }},
        React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},
          React.createElement("svg",{width:15,height:15,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:3,strokeLinecap:"round",strokeLinejoin:"round"},
            React.createElement("path",{d:"M5 12.5l4.5 4.5L19 7.5"}))),
        /* Una sola línea, como el prototipo: «Previsto» y el chevron la partían en dos con la letra
           del sistema al 110 % (su captura del 9/11). Lo que se cobró distinto ya lo dice su fila. */
        React.createElement("span",{className:"pr6-paid-t"}, React.createElement("span",{className:"pr6-paid-l"}, t("pr6_ya_pagados")),React.createElement("span",{className:"pr6-n"},"· "+v.paid.length)),
        React.createElement("span",{className:"pr6-paid-amt num"}, eur(v.paidTotal)),
        React.createElement("span",{className:"pr6-paid-v","aria-hidden":"true"}, paidOpen?t("pr6_ocultar"):t("pr6_ver")),
        pr6Chev()),
      React.createElement("div",{className:"pr6-fold"+(paidOpen?" open":""),id:"pr6-paid-list"},
        React.createElement("div",Object.assign({className:"pr6-fold-in"},plegado(paidOpen)), v.paid.map(paidRow), pausados.map(pausadoRow)))),
    /* Traspasos y entradas siguen también aquí: los que mueven el mínimo ya salen (y se editan) en
       «¿Te llega?», pero quitarlos de la portada deja sin verlos de un vistazo a quien los miraba
       aquí; la SPEC no los pinta ni los descarta, así que eso lo decide el dueño. Son de ESTE mes:
       en la vista del siguiente no salen. */
    !sig&&pack.transfersPending.length>0&&React.createElement("section",{className:"pr6-sec","data-testid":"plan-transfers"},
      React.createElement("div",{className:"pr6-sec-h"},React.createElement("span",null,t("v4_plan_transfers"))),
      pr6Tres(pack.transfersPending,flowRow,trOpen,setTrOpen,"pr6-tr-more")),
    !sig&&(pack.incomePending||[]).length>0&&React.createElement("section",{className:"pr6-sec","data-testid":"plan-income"},
      React.createElement("div",{className:"pr6-sec-h"},React.createElement("span",null,t("v4_aun_entrara"))),
      pr6Tres(pack.incomePending,flowRow,inOpen,setInOpen,"pr6-in-more")),
    // «Ya ha entrado»: el «Ya pagados» de lo que entra, plegado igual y con el mismo gesto.
    !sig&&flowsDone.length>0&&React.createElement("section",{className:"pr6-paid pr6-paid-in"+(entOpen?" open":""),ref:entRef,"data-testid":"plan-entrado","aria-label":t("fl_ya_entrado")},
      React.createElement("button",{type:"button",className:"pr6-paid-h","aria-expanded":entOpen?"true":"false","aria-controls":"pr6-ent-list",
        onClick:function(){ setEntOpen(function(o){ if(!o) verPlegado(entRef.current); return !o; }); }},
        React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},
          React.createElement("svg",{width:15,height:15,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:3,strokeLinecap:"round",strokeLinejoin:"round"},
            React.createElement("path",{d:"M5 12.5l4.5 4.5L19 7.5"}))),
        React.createElement("span",{className:"pr6-paid-t"}, React.createElement("span",{className:"pr6-paid-l"}, t("fl_ya_entrado")),React.createElement("span",{className:"pr6-n"},"· "+flowsDone.length)),
        React.createElement("span",{className:"pr6-paid-amt num","data-testid":"plan-entrado-total"}, entTotal>0?"+"+eur(entTotal):""),
        React.createElement("span",{className:"pr6-paid-v","aria-hidden":"true"}, entOpen?t("pr6_ocultar"):t("pr6_ver")),
        pr6Chev()),
      React.createElement("div",{className:"pr6-fold"+(entOpen?" open":""),id:"pr6-ent-list"},
        React.createElement("div",Object.assign({className:"pr6-fold-in"},plegado(entOpen)), flowsDone.map(entRow))))),
    importar,
    React.createElement(Pr6HojaHost,{hostRef:llegaHost,render:function(cerrar){ return React.createElement(LlegaSheet,{state:state,set:set,totals:totals,pack:pack,onClose:cerrar}); }}),
    React.createElement(Pr6HojaHost,{hostRef:debenHost,render:function(cerrar){ return React.createElement(TeDebenSheet,{state:state,set:set,totals:totals,deben:deben,onClose:cerrar}); }}),
    deshacer&&React.createElement("div",{className:"v4-undo-toast",role:"status","data-testid":"plan-deshacer"},
      React.createElement("span",null, deshacer.msg),
      React.createElement("button",{type:"button",onClick:deshacerYa}, t("f_undo"))),
    ficha&&fichaRow&&(fichaRow.kind==="debt"||fichaRow.kind==="balloon")&&React.createElement(DeudaFicha,{key:ficha.id,row:fichaRow,state:state,totals:totals,
      onClose:function(){ setFicha(null); },onGoDebts:onGoDebts}),
    ficha&&fichaRow&&(fichaRow.kind==="income"||fichaRow.kind==="transfer")&&React.createElement(FlujoFicha,{key:ficha.id,row:fichaRow,state:state,set:set,totals:totals,showToast:showToast,
      onDeshacer:avisarDeshacer,onClose:function(){ setFicha(null); },
      onEdit:function(id){ setFicha(null); setManageEdit(id); setManageOpen(true); }}),
    ficha&&fichaRow&&fichaRow.kind!=="debt"&&fichaRow.kind!=="balloon"&&fichaRow.kind!=="income"&&fichaRow.kind!=="transfer"&&React.createElement(ReciboFicha,{key:ficha.id,row:fichaRow,state:state,set:set,totals:totals,evidence:proof,showToast:showToast,
      aviso:v.review.find(function(x){ return x.id===ficha.id; })||null,
      onPosponer:posponer, onDeshacer:avisarDeshacer,
      onClose:cerrarFicha,
      onRemove:function(id){ setAvisoFicha(null); quitarReciboPreguntando(fichaUndo,id); },
      onEdit:function(id){ cerrarFicha(); setManageEdit(id); setManageOpen(true); }}),
    manage,avisoQuitar
  );
}
/* Una hoja de Recibos que se abre y se cierra sola. Con el abierto en `PlanRecibos`, abrir «¿Te llega?»
   repintaba todas las filas (cada una con su gesto de deslizar desde la 221) en el mismo fotograma en que
   la hoja empieza a subir: a 6× de CPU, un fotograma de 100 ms (auditoría de la 222, P2-6). Aquí solo se
   pinta la hoja; si Recibos cambia con ella abierta, le llega lo nuevo por `render`. */
function Pr6HojaHost({hostRef, render}){
  const [open,setOpen]=useState(false);
  useEffect(function(){ hostRef.current=setOpen; return function(){ hostRef.current=null; }; },[hostRef]);
  const cerrar=useCallback(function(){ setOpen(false); },[]);
  return open?render(cerrar):null;
}
/* Textos del resumen del mes cerrado. El mes con mayúscula al principio («Septiembre cerrado»);
   en catalán, con su artículo («més que l'agost», «més que el setembre»). */
const PR6_CERRADO_DIAS=7;
function pr6Cap(s){ s=String(s||""); return s.charAt(0).toUpperCase()+s.slice(1); }
/* La categoría de un recibo solo si dice algo que el nombre no dice: «Luz / Luz · Sabadell» repetía
   lo mismo dos veces (auditoría 216, N5). */
function pr6CatDe(c,name){
  const norm=function(x){ return String(x||"").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); };
  return c&&norm(c)!==norm(name)?c:"";
}
function pr6MesCon(m){
  const n=monthLong(m-1);
  if(CURLANG!=="ca") return n;
  return /^[aeiouàèéíòóú]/i.test(n)?"l'"+n:"el "+n;
}
function pr6TituloCerrado(c){ return tf("pr6c_titulo",{mes:pr6Cap(monthLong(c.m-1))}); }
/* La cifra y la comparación van en DOS renglones, cada uno de una línea a 393 px. La comparación
   SIEMPRE sale (rechazo de la beta 206, 1/11/2026: «salía pero no salía el vs»): con la diferencia
   o, si no se puede comparar, con el porqué en una línea. Un mes cerrado sin cifra no pinta la
   tarjeta (`verCerrado`): nunca una más baja que la real. */
function pr6LineaCerrado(c){
  return tf("pr6c_total",{x:eur(c.cent/100)});
}
function pr6VsCerrado(c){
  const p=c.prev||{y:c.m===1?c.y-1:c.y,m:c.m===1?12:c.m-1,cent:null};
  const mes=pr6Mes(p.y*12+p.m);
  // En catalán la preposición va pegada al mes: «d'agost», «de setembre», «a l'agost», «al setembre».
  const ca=function(m,de){ const n=monthLong(m-1), v=/^[aeiouàèéíòóú]/i.test(n); return CURLANG!=="ca"?n:de?(v?"d'":"de ")+n:(v?"a l'":"al ")+n; };
  if(!c.prev) return tf("pr6c_vs_sin_recibos",{mes:mes,largo:ca(p.m,false)});
  if(p.cent==null) return tf("pr6c_vs_sin_datos",{mes:mes,largo:ca(p.m,true)});
  const d=c.cent-p.cent;
  return d===0?tf("pr6c_igual",{mes:mes}):tf("pr6c_vs",{d:(d>0?"+":"−")+eur(Math.abs(d)/100),mes:mes});
}
// «En diciembre», y en catalán «A l'abril» con los meses que empiezan por vocal, como Inicio.
function pr6EnMes(m){
  const n=monthLong(m-1);
  return tf(/^[aeiouàèéíòóú]/i.test(n)?"v4_upcoming_in_v":"v4_upcoming_in",{mes:n});
}
// Como mucho cuatro líneas y solo las que tienen dato (SPEC §2.1); sin ninguna no se despliega.
function pr6LineasCerrado(c){
  const out=[];
  if(c.sube) out.push({k:"sube",l:tf("pr6c_sube",{name:c.sube.name,mes:c.prev?pr6MesCon(c.prev.m):""}),v:"+"+eur(c.sube.cent/100)});
  if(c.cambia) out.push({k:"cambia",l:tf(c.cambia.cent>0?"pr6c_subio":"pr6c_bajo",{name:c.cambia.name}),v:(c.cambia.cent>0?"+":"−")+eur(Math.abs(c.cambia.cent)/100)});
  if(c.noLlegaron>0) out.push({k:"no",l:t("pr6c_no_llegaron"),v:String(c.noLlegaron)});
  return out.slice(0,4);
}
// «Sabadell y Revolut» con la conjunción del idioma.
function pr6Lista(xs){
  try{ return new Intl.ListFormat(loc(),{type:"conjunction"}).format(xs); }catch(e){ return xs.join(", "); }
}
/* Primer uso (SPEC §9): cargos que se repiten en el banco y aún no son recibo. Mismo detector que
   «Visto en tu banco» del alta por pasos, pero aquí se añaden sin pasar por el resumen de cada uno,
   así que solo entran los que se han cobrado TODOS los meses seguidos: un cargo con huecos puede
   ser bimestral y darlo de alta como mensual inventaría cobros que no existen. */
function pr6Importables(state){
  // Con el importe del ÚLTIMO cargo, no la mediana: si subió, el recibo nuevo tiene que casar ya
  // con el cobro de este mes (revisión 31/10/2026: Netflix 12,99 → 13,99).
  return rp4VistoEnBanco(state,0).filter(function(d){ return d.seguido&&d.day!=null&&d.bank; })
    .map(function(d){ return d.ultimo>0?Object.assign({},d,{amount:d.ultimo}):d; });
}
function RecibosImportSheet({items, set, showToast, onClose}){
  const elegidos=useRef(null);
  const alCerrar=function(){
    const xs=elegidos.current;
    elegidos.current=null;
    if(xs&&xs.length){
      xs.forEach(function(d){
        const it=conMesDeAlta({id:uid(),name:d.name,amount:Math.round(d.amount*100)/100,freq:"mes",day:d.day,account:d.bank});
        if(d.cat) it.category=d.cat;
        addFixedItem(set,it);
      });
      if(showToast) showToast(xs.length===1?t("pr6_imp_toast1"):tf("pr6_imp_toast",{n:xs.length}));
    }
    onClose();
  };
  const swipe=useSheetSwipe(true,alCerrar);
  useBackClose(true,swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const lista=useMemo(function(){ return items.slice().sort(function(a,b){ return a.day-b.day; }); },[items]);
  const [off,setOff]=useState({});
  const n=lista.filter(function(d,i){ return !off[i]; }).length;
  const alguno=lista.some(function(d,i){ return off[i]; });
  const todos=function(){
    if(alguno){ setOff({}); return; }
    const o={}; lista.forEach(function(d,i){ o[i]=true; }); setOff(o);
  };
  const hecho=useRef(false);
  const anadir=function(){
    if(hecho.current||!n) return;
    hecho.current=true;
    // Se añade al terminar de bajar la hoja (`alCerrar`): mientras baja, el velo sigue encima y
    // un segundo toque no llega a lo de debajo.
    elegidos.current=lista.filter(function(d,i){ return !off[i]; });
    mcTickHaptic();
    swipe.close();
  };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet pr6-imp","data-testid":"plan-import",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
        ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"pr6-imp-h"},
          React.createElement("h2",{className:"serif pr6-ll-t",id:titleId,ref:titleRef,tabIndex:-1}, tf("pr6_imp_t",{n:n,m:lista.length})),
          React.createElement("button",{type:"button",className:"link","data-testid":"plan-import-todos",onClick:todos}, alguno?t("pr6_imp_marcar"):t("pr6_imp_quitar"))),
        React.createElement("div",{className:"pr6-imp-l"},
          lista.map(function(d,i){
            const on=!off[i];
            return React.createElement("button",{type:"button",key:i,role:"switch","aria-checked":on?"true":"false",className:"pr6-imp-row"+(on?"":" off"),"data-testid":"plan-import-row",
              onClick:function(){ setOff(function(o){ const x=Object.assign({},o); x[i]=!x[i]; return x; }); }},
              React.createElement("span",{className:"nm"},
                React.createElement("span",{className:"pr6-nm"}, d.name),
                React.createElement("span",{className:"sub"}, (d.cat&&CAT[d.cat]?catName(d.cat)+" · ":"")+entOf(d.bank).label+" · "+tf("pr6_dia",{d:d.day}))),
              React.createElement("span",{className:"am num"}, eur(d.amount)),
              React.createElement("span",{className:"pr6-imp-dot","aria-hidden":"true"}));
          })),
        React.createElement("button",{type:"button",className:"pr6-cta","data-testid":"plan-import-ok",disabled:!n,onClick:anadir},
          n===0?t("pr6_imp_ninguno"):n===1?t("pr6_imp_add1"):tf("pr6_imp_add",{n:n})))),
    document.body);
}
// Icono gris por tipo de aviso (SPEC §2.3): reloj, ojo tachado, subida, flechas y duda.
const PR6_ICO={
  late:"M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  ghost:"M3 3l18 18M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a10 10 0 005.4-1.6",
  up:"M3 17l6-6 4 4 8-8M15 7h6v6",
  diff:"M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
  cand:"M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
  trial:"M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  perm:"M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  unconf:"M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 100-18 9 9 0 000 18z"
};
// Avisos que se pueden dejar para mañana (botón «Recuérdamelo mañana» de la ficha). «Pagado sin cargo
// del banco» no: ahí lo que falta es decir cómo se pagó, y mañana seguiría igual.
const PR6_POSPONIBLE={late:1,diff:1,up:1,ghost:1,cand:1,trial:1,perm:1};
function pr6Motivo(x){
  if(x.rv==="late") return t("pr6_no_llegado");
  if(x.rv==="ghost") return tf("pr6_fantasma",{n:x.meses});
  if(x.rv==="up") return tf("pr6_ha_subido",{x:eur((Math.round(x.cobrado*100)-Math.round(x.previsto*100))/100)});
  if(x.rv==="diff"||x.rv==="cand") return tf("pr6_esperabas",{x:eur(x.previsto)});
  if(x.rv==="trial") return t(x.dias===0?"pr6_prueba_hoy":"pr6_prueba_manana");
  if(x.rv==="perm") return tf("pr6_perm_fin",{x:pr6MesAno(x.permYm)});
  return t("pr6_sin_cargo");
}
// «nov 2026» (en inglés «Nov 2026»), de un año*12+mes.
function pr6MesAno(ym){ return pr6Mes(ym)+" "+Math.floor((ym-1)/12); }
// Mes corto de un año*12+mes, en minúscula salvo en inglés («hasta dic», «until Dec»).
function pr6Mes(ym){ const s=monthShort((ym-1)%12); return CURLANG==="en"?s:s.toLowerCase(); }
// «pausado hasta feb» en Todos y en la edición (SPEC §2.6.1); "" si no hay pausa por delante.
function pr6PausaTxt(r,cur){
  // La misma regla que deja fuera de la cifra (`billsPausado`): lo atenuado es lo que no suma.
  return r&&r.kind==="fixed"&&r.item&&billsPausado(r.item,(cur-1)%12+1,Math.floor((cur-1)/12))?tf("pr6_pausado_hasta",{m:pr6Mes(Number(r.item.pausedUntil))}):"";
}
function pr6Chev(){
  return React.createElement("svg",{className:"pr6-chev",width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
    React.createElement("path",{d:"M6 9l6 6 6-6"}));
}
// El desplegable se ve entero: mueve la página lo justo, sin escribir scrollTop a mano (INC-0710-01).
function pr6VerPlegado(el){
  if(!el) return;
  setTimeout(function(){ try{ el.scrollIntoView({block:"nearest",behavior:mcReduced()?"auto":"smooth"}); }catch(e){} },380);
}
/* Como mucho tres a la vista; el resto se despliega debajo con «Ver los N» (SPEC §2.3–2.4). Es la
   misma lista en la portada de Recibos y en Tus recibos, donde el SPEC decía cuatro y el dueño pidió
   tres (11/11/2026): seis personas seguidas llenaban la pantalla. Al plegar, la sección vuelve a
   verse desde su principio. `more` añade atributos al botón (los e2e lo buscan por sección). */
function pr6Tres(items,render,open,setOpen,id,more){
  const rest=items.slice(3);
  return React.createElement(React.Fragment,null,
    items.slice(0,3).map(render),
    rest.length>0&&React.createElement("div",{className:"pr6-fold"+(open?" open":""),id:id},
      // Las filas plegadas siguen en el DOM (se despliegan con transición), pero fuera del foco.
      React.createElement("div",Object.assign({className:"pr6-fold-in"},open?null:{"aria-hidden":"true",inert:""}), rest.map(render))),
    rest.length>0&&React.createElement("button",Object.assign({type:"button",className:"pr6-more","aria-expanded":open?"true":"false","aria-controls":id,
      onClick:function(e){ const sec=e.currentTarget.parentNode; setOpen(function(o){ if(o) pr6VerPlegado(sec); return !o; }); }},more),
      open?t("v4_ver_menos"):tf("pr6_ver_los",{n:items.length}),
      pr6Chev()));
}
/* «te han pagado 0 de 1» no se entendía (¿uno de qué?). Con una sola persona se dice su parte. */
function pr6TeHanPagado(d){
  if(d.n===1) return t(d.pagados?"pr6_su_parte_ok":"pr6_su_parte_falta");
  return tf("pr6_te_han_pagado",{a:d.pagados,n:d.n});
}
/* Personas y compartidos (Plan › Recibos v6, tanda 5; SPEC §5-§6). El modelo vive en 08
   (`repartoVigente`, `teDebenMes`, `deudaDescuentoMes`…); aquí solo se pinta y se escribe con él. */
function pr6PagasMas(x){ return tf("pr6_pagas_mas",{a:cycleMoney(x.bankAmt),b:cycleMoney(x.descuento.amt),from:x.descuento.from.join(", ")}); }
function pr6Inicial(n){ const c=String(n||"").trim().charAt(0); return c?c.toUpperCase():"·"; }
const PE_VIAS=[["bizum","pe_bizum"],["transfer","pe_transfer"],["debt","pe_debt"]];
function peViaTxt(state,p){
  if(p.via!=="debt") return t(p.via==="bizum"?"pe_bizum":"pe_transfer");
  const d=(state.debts||[]).find(function(o){ return o.id===p.debtId; });
  return t("pe_debt")+(d?" · "+d.name:"");
}
/* Hoja «Te deben» (SPEC §5): por persona, sus partes de este mes y «Ya me lo ha pagado». Lo que
   se descuenta de una deuda no sale aquí. Lo recibido casa solo cuando el banco trae su nombre
   (`teDebenRecibido`); si no, se marca a mano. Un pago a medias enseña lo que pagó y lo que falta,
   y el total de arriba es solo lo que falta: «Dar por pagado» lo salda, o se deja como está. */
function TeDebenSheet({state, set, totals, deben, onClose}){
  const swipe=useSheetSwipe(true,onClose,{soloVelo:true});
  useBackClose(true,swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const [persona,setPersona]=useState(null);
  const y=totals.curYear, m=totals.curMonth, today=totals.today;
  const todos=deben.length>0&&deben.every(function(p){ return p.pagado; });
  // Deshacer lo que casó SOLO veta esos ingresos para esa persona (no eran suyos; si no, volverían
  // a casar). Deshacer una marca a mano solo quita la marca.
  const marcar=function(p){ set(function(s){ return repartoMarcarCobrado(s,p.id,y,m,today,!p.pagado,p.pagado&&!p.aMano&&p.auto?p.ingresos:null); }); };
  const queda=deben.reduce(function(a,p){ return a+Math.round(p.falta*100); },0)/100;
  // Quien ya ha pagado va al final (SPEC §5, prototipo). El orden se fija al ABRIR: si la fila se
  // fuera abajo al tocar «Ya me lo ha pagado», el «Deshacer» ya no estaría bajo el dedo.
  const orden=useRef(null);
  if(!orden.current) orden.current=deben.filter(function(p){ return !p.pagado; }).concat(deben.filter(function(p){ return p.pagado; })).map(function(p){ return p.id; });
  const filas=deben.slice().sort(function(a,b){
    const ia=orden.current.indexOf(a.id), ib=orden.current.indexOf(b.id);
    return (ia<0?1e9:ia)-(ib<0?1e9:ib);
  });
  return ReactDOM.createPortal(
    React.createElement(React.Fragment,null,
      React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
        React.createElement("div",Object.assign({className:"v4-sheet pr6-ll","data-testid":"deben-sheet",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
          ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
          React.createElement("div",{className:"v4-sheet-handle"}),
          React.createElement("div",{className:"pr6-deben-h"},
            React.createElement("h2",{className:"serif pr6-ll-t",id:titleId,ref:titleRef,tabIndex:-1}, t("pr6_te_deben_t")),
            queda>0&&React.createElement("span",{className:"serif num pr6-deben-tot","data-testid":"deben-total"}, eur(queda))),
          React.createElement("div",{className:"pr6-fold"+(todos?" open":"")},
            React.createElement("div",Object.assign({className:"pr6-fold-in"},todos?null:{"aria-hidden":"true",inert:""}),
              React.createElement("div",{className:"pr6-empty","data-testid":"deben-todos"}, t("pr6_te_han_pagado_todos")))),
          filas.map(function(p){
            // Con el ingreso que lo pagó, por dónde y qué día («Bizum el 6», SPEC §5); marcado a mano no
            // hay fecha que dar y se dice solo por dónde (no se inventa).
            const via=p.auto&&!p.aMano?tf("pr6_deben_via_dia",{via:t(p.viaRec==="bizum"?"pe_bizum":"pe_transfer"),d:p.dia})
              :p.via==="bizum"||p.via==="transfer"?peViaTxt(state,p):t("pr6_te_lo_ha_pagado");
            const parcial=!p.pagado&&p.recibido>0;
            return React.createElement("div",{className:"pr6-ll-b pe-deben"+(p.pagado?" ok":""),key:p.id,"data-testid":"deben-persona","data-persona":p.id},
              React.createElement("div",{className:"pr6-ll-h"},
                React.createElement("span",{className:"pe-ava","aria-hidden":"true"}, pr6Inicial(p.n)),
                React.createElement("button",{type:"button",className:"pr6-ficha-t pe-link","data-act":"persona",onClick:function(){ setPersona(p.id); }},
                  React.createElement("span",{className:"pr6-ll-n"}, p.n),
                  React.createElement("span",{className:"pr6-ficha-s"}, p.items.map(function(i){ return i.name+" "+eur(i.amt); }).join(" + "))),
                React.createElement("span",{className:"pr6-ll-r"},
                  React.createElement("span",{className:"serif num pr6-ll-a","data-testid":"deben-cifra"}, eur(p.amt)),
                  p.pagado
                    ?React.createElement("button",{type:"button",className:"pe-deben-ok","data-act":"deben-pagado","aria-pressed":"true",onClick:function(){ marcar(p); }},
                      "✓ "+via+" · "+t("f_undo"))
                    :React.createElement("span",{className:"pr6-ll-l","data-testid":"deben-estado"},
                      parcial?tf("pr6_deben_parcial",{a:eur(p.recibido),b:eur(p.falta)}):t("pr6_deben_pend")))),
              !p.pagado&&React.createElement("button",{type:"button",className:"pr6-btn pr6-btn-wide pe-deben-cta","data-act":"deben-pagado","aria-pressed":"false",
                onClick:function(){ marcar(p); }}, t(parcial?"pr6_deben_saldar":"pr6_ya_me_lo_ha_pagado")));
          }))),
      persona!=null&&React.createElement(PersonaSheet,{key:persona,pid:persona,state:state,set:set,totals:totals,onClose:function(){ setPersona(null); }})),
    document.body);
}
/* Ficha de una persona (SPEC §6). Tres usos:
   - `pid`: la que ya existe. Cambiar nombre o forma de pago o «Borrar» toca todos sus recibos.
   - sin `pid` desde Todos: nueva, y hay que decir qué recibos comparte (sin recibo no tiene dónde
     vivir: las personas están dentro de los recibos, no en una lista aparte).
   - `draft` desde el alta por pasos: no escribe nada, devuelve la persona al reparto del borrador. */
function PersonaSheet({pid, draft, mensual:draftMensual, sinBorrar, state, set, totals, onClose, onCreate, onCompartidoViejo}){
  const swipe=useSheetSwipe(true,onClose);
  useBackClose(true,swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const y=totals.curYear, m=totals.curMonth, today=totals.today;
  const edit=pid!=null;
  const p=edit?personasDe(state).find(function(x){ return x.id===pid; })||null:null;
  const [n,setN]=useState(p?p.n:"");
  const [via,setVia]=useState(p?p.via:"bizum");
  const [debtId,setDebtId]=useState(p&&p.via==="debt"?p.debtId:null);
  const [ids,setIds]=useState([]);
  const [gone,setGone]=useState(false);
  const savedRef=useRef(false);
  // Borrada desde otro sitio (o desde el otro móvil) mientras estaba abierta: no hay qué enseñar.
  useEffect(function(){ if(edit&&!p&&!savedRef.current) swipe.close(); },[edit,p]);
  const deudas=(state.debts||[]).filter(deudaDescontable);
  const esViejo=function(id){ const e=(state.fixed||[]).find(function(f){ return f.id===id; }); return !!e&&Number(e.bankAmount)>0&&!repartoVigente(e); };
  const mensual=function(id){ const e=(state.fixed||[]).find(function(f){ return f.id===id; }); return !!e&&chargeMonths(e).length===12; };
  // También los compartidos de antes: la persona se queda con lo que no es tuyo (`personaEnRecibos`).
  const elegibles=!edit&&!draft?(state.fixed||[]).filter(function(e){ return repartoAdmite(e)&&(!(Number(e.bankAmount)>0)||repartoVigente(e)||Number(e.bankAmount)>Number(e.amount)); }):[];
  // «Lo descuento» va contra una cuota mensual: solo en recibos que se cobran todos los meses.
  const debtOk=deudas.length>0&&(edit?!!p&&p.recibos.every(function(r){ return mensual(r.id); }):draft?!!draftMensual:ids.every(mensual));
  const ok=!!n.trim()&&(via!=="debt"||debtOk&&deudas.some(function(d){ return d.id===debtId; }))&&(edit||draft||ids.length>0);
  const guardar=function(){
    if(savedRef.current||!ok) return;
    savedRef.current=true;
    const datos={n:n.trim(),via:via};
    if(via==="debt") datos.debtId=debtId;
    if(draft) onCreate(Object.assign({id:"pe_"+uid()},datos));
    else if(edit){
      const cambio=function(s){ return personaEditar(s,pid,datos,y,m,today); };
      descuentoPregunta(state,cambio).then(function(fix){ set(function(s){ return conDescuentoFijado(fix,cambio(s)); }); swipe.close(); });
      return;
    }
    else {
      /* Un compartido de antes no dice de quién es el resto: darle todo a esta persona sin
         enseñarlo ponía «Lo descuento» de 63 donde eran 53 (rev. t5 R2-1). Ese recibo se abre en
         Editar con la persona ya en el reparto, para ver y ajustar las partes antes de guardar. */
      const persona=Object.assign({id:"pe_"+uid()},datos);
      const viejo=ids.find(function(id){ return esViejo(id); });
      const resto=ids.filter(function(id){ return id!==viejo; });
      const cambio=function(s){ return personaEnRecibos(s,persona,resto,y,m,today); };
      // Con un compartido de antes también se pregunta por el resto antes de abrirlo (rev. R5).
      descuentoPregunta(state,resto.length?cambio:function(s){ return s; }).then(function(fix){
        if(resto.length) set(function(s){ return conDescuentoFijado(fix,cambio(s)); });
        if(viejo&&onCompartidoViejo){ onClose(); onCompartidoViejo(viejo,persona); return; }
        swipe.close();
      });
      return;
    }
    swipe.close();
  };
  const borrar=function(){
    if(!gone){ setGone(true); return; }
    savedRef.current=true;
    const cambio=function(s){ return personaEditar(s,pid,null,y,m,today); };
    descuentoPregunta(state,cambio).then(function(fix){ set(function(s){ return conDescuentoFijado(fix,cambio(s)); }); swipe.close(); });
  };
  const chip=function(key,label,on,go,dis){
    return React.createElement("button",{type:"button",key:key,className:"chip"+(on?" active":""),"aria-pressed":on?"true":"false",disabled:!!dis,onClick:go},label);
  };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet pr6-ll","data-sheet":"persona",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
        ref:swipe.sheetRef,onClick:function(e){
          e.stopPropagation();
          // «¿Seguro?» se cancela tocando en cualquier otro sitio (SPEC §6, §10).
          if(gone&&!(e.target.closest&&e.target.closest('[data-act="persona-borrar"]'))) setGone(false);
        }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("h2",{className:"serif pr6-ll-t",id:titleId,ref:titleRef,tabIndex:-1}, p?p.n:t("pe_nueva")),
        React.createElement("input",{className:"pr6-search","data-pe":"name",value:n,placeholder:t("pe_nombre"),"aria-label":t("pe_nombre"),
          onChange:function(e){ setN(e.target.value); }}),
        React.createElement("div",{className:"pr6-lbl"}, t("pe_como_paga")),
        React.createElement("div",{className:"v4-chips wrap","data-pe":"via"},
          PE_VIAS.filter(function(v){ return v[0]!=="debt"||deudas.length>0; }).map(function(v){
            return chip(v[0],t(v[1]),via===v[0],function(){ setVia(v[0]); if(v[0]==="debt"&&debtId==null&&deudas.length===1) setDebtId(deudas[0].id); },v[0]==="debt"&&!debtOk);
          })),
        deudas.length>0&&!debtOk&&(edit||draft)&&React.createElement("div",{className:"hint","data-testid":"pe-solo-mensual"}, t("rp5_descuento_mensual")),
        React.createElement("div",{className:"pr6-fold"+(via==="debt"?" open":"")},
          React.createElement("div",Object.assign({className:"pr6-fold-in"},via==="debt"?null:{"aria-hidden":"true",inert:""}),
            React.createElement("div",{className:"pr6-lbl"}, t("pe_descuenta_de")),
            React.createElement("div",{className:"v4-chips wrap","data-pe":"deuda"},
              deudas.map(function(d){ return chip(d.id,d.name,debtId===d.id,function(){ setDebtId(d.id); }); })))),
        edit&&p&&React.createElement("div",{className:"pe-recibos","data-testid":"pe-recibos"},
          React.createElement("div",{className:"pr6-lbl"}, t("pe_recibos")),
          p.recibos.map(function(r){
            return React.createElement("div",{className:"pr6-ll-row",key:r.id},React.createElement("span",null,r.name),React.createElement("span",{className:"num"},eur(r.amt)));
          })),
        !edit&&!draft&&React.createElement(React.Fragment,null,
          React.createElement("div",{className:"pr6-lbl"}, t("pe_que_recibos")),
          elegibles.length?React.createElement("div",{className:"v4-chips wrap","data-pe":"recibos"},
            elegibles.map(function(e){
              const on=ids.indexOf(e.id)>=0;
              // Un solo compartido de antes cada vez: sus partes se ajustan en su propia hoja.
              return chip(e.id,e.name,on,function(){ setIds(function(o){ return on?o.filter(function(x){ return x!==e.id; }):o.filter(function(x){ return !(esViejo(e.id)&&esViejo(x)); }).concat([e.id]); }); },via==="debt"&&!on&&!mensual(e.id));
            })):React.createElement("div",{className:"pr6-empty"}, t("pe_sin_recibos")),
          via==="debt"&&elegibles.some(function(e){ return !mensual(e.id); })&&React.createElement("div",{className:"hint","data-testid":"pe-solo-mensual"}, t("rp5_descuento_mensual")),
          ids.some(esViejo)&&React.createElement("div",{className:"hint","data-testid":"pe-viejo"}, tf("pe_viejo_ajustar",{name:((state.fixed||[]).find(function(f){ return f.id===ids.find(esViejo); })||{}).name||""}))),
        React.createElement("button",{type:"button",className:"pr6-cta","data-act":"persona-guardar",disabled:!ok,"aria-disabled":ok?"false":"true",onClick:guardar}, t("rp4_guardar")),
        // Desde el alta por pasos no se borra: el borrador la seguiría teniendo y la volvería a poner.
        edit&&!sinBorrar&&React.createElement("button",{type:"button",className:"pr6-btn pr6-btn-wide"+(gone?" pr6-seguro":""),"data-act":"persona-borrar",onClick:borrar},
          gone?t("pe_seguro"):t("pe_borrar")))),
    document.body);
}
/* Hoja «¿Te llega?» (SPEC §4): un bloque por banco con recibos pendientes, el recorrido resumido
   (tienes hoy · recibos que faltan · entradas antes del último recibo) y, si no llega, UN aviso
   con cuánto pasar y antes de qué día. Sin botón de actualizar ni sugerencias (descartados). */
function LlegaSheet({state, set, totals, pack, onClose, ensayo}){
  // `ensayo`: montaje en seco de `mcEnsayar`, sin candado ni entrada de Atrás.
  const swipe=useSheetSwipe(!ensayo,onClose,{soloVelo:true});
  useBackClose(!ensayo,swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const today=totals.today;
  const base=useMemo(function(){ return planRecibosBancos(totals,pack,null); },[totals,pack]);
  const conSaldo=base.filter(function(b){ return b.known; });
  const [raw,setRaw]=useState("");
  const [teclado,setTeclado]=useState(false);
  // Atrás con el teclado abierto lo pliega a él, no la hoja entera (auditoría 4.26.218).
  useBackClose(teclado,function(){ setTeclado(false); });
  /* El teclado (plegado) se monta cuando la hoja ya ha subido, no con ella: sus teclas se maquetaban
     en el mismo fotograma de la entrada y con la CPU a ×6 ese fotograma duraba 200 ms (auditoría
     9/11). Si se toca el importe antes, nace en ese momento. */
  const [tecladoListo,setTecladoListo]=useState(false);
  useEffect(function(){ const id=setTimeout(function(){ setTecladoListo(true); },520); return function(){ clearTimeout(id); }; },[]);
  /* Con tres o cuatro bancos el «¿Y si gasto…?» queda al fondo y el teclado se abría por debajo
     de lo que se ve: «se ve la zona pero al tocar no hace nada» (beta 4.26.200). Se toca en
     cualquier punto de la zona y el teclado sube a la vista.
     Se acompaña fotograma a fotograma mientras se abre, no al acabar: antes, a los 380 ms, un
     `scrollIntoView` suave daba un segundo empujón cuando todo parecía quieto y él lo vio «en dos
     tiempos en vez de 1» (vídeo 11/11). Ahora el fondo de la zona se queda pegado al borde de la hoja
     mientras el teclado crece, y todo llega a su sitio en el mismo movimiento. Un dedo encima lo
     suelta: no se pelea con quien ya está desplazando. Las teclas no lo sueltan: lo que aparece al
     teclear la primera cifra (el resultado, el colchón, la cuota a plazos) crece por encima del
     teclado y, acompañado, el teclado no se mueve bajo el dedo que sigue escribiendo. */
  const zonaRef=useRef(null);
  const [plazos,setPlazos]=useState(false);
  const amt=parseNumPadRaw(raw);
  useEffect(function(){
    if(!teclado) return undefined;
    const el=zonaRef.current, hoja=el&&el.closest(".v4-sheet");
    if(!hoja) return undefined;
    let raf=0;
    const fin=performance.now()+(mcReduced()?0:450);
    const suelta=function(e){ if(e&&e.target&&e.target.closest&&e.target.closest(".v4-keys")) return; cancelAnimationFrame(raf); raf=0; };
    const paso=function(){
      const sobra=el.getBoundingClientRect().bottom-hoja.getBoundingClientRect().bottom;
      if(sobra>0.5) hoja.scrollTop+=sobra;
      raf=performance.now()<fin?requestAnimationFrame(paso):0;
    };
    raf=requestAnimationFrame(paso);
    hoja.addEventListener("touchstart",suelta,{passive:true});
    hoja.addEventListener("wheel",suelta,{passive:true});
    return function(){ suelta(); hoja.removeEventListener("touchstart",suelta); hoja.removeEventListener("wheel",suelta); };
  },[teclado,amt>0,plazos]);
  // Por defecto el banco principal si tiene saldo: quien teclea sin mirar los chips piensa en él.
  const [gBank,setGBank]=useState(function(){
    const main=conSaldo.find(function(b){ return b.bank===totals.mainBank; });
    return main?main.bank:conSaldo.length?conSaldo[0].bank:null;
  });
  const [flujo,setFlujo]=useState(null);
  /* «A plazos» (lo que hacía «¿Me lo puedo permitir?», decisión del dueño 11/11/2026): este mes solo
     sale la entrada; la cuota empieza el que viene. El mismo teclado escribe el importe, los meses o
     la entrada: el campo que se toca es el que recibe las teclas, y su primera tecla lo sustituye. */
  const [campo,setCampo]=useState("amt");
  const [rawMeses,setRawMeses]=useState("12");
  const [rawDown,setRawDown]=useState("");
  const fresco=useRef(false);
  // Solo un plazo entero de 2 a 120 vale: con 0 o vacío se pintaba «12 meses» sin serlo (revisión 229, P2-2).
  const meses=/^\d+$/.test(rawMeses)&&+rawMeses>=2&&+rawMeses<=120?+rawMeses:null;
  const dw=plazos?Math.min(amt,parseNumPadRaw(rawDown)):0;
  const sale=plazos?dw:amt;
  const gasto=sale>0&&gBank?{bank:gBank,amt:sale}:null;
  const bancos=gasto?planRecibosBancos(totals,pack,gasto):base;
  const elegido=amt>0&&gBank&&bancos.find(function(b){ return b.bank===gBank&&b.known; });
  const tocaCampo=function(c){
    if(teclado&&campo===c){ setTeclado(false); return; }
    if(c!==campo){ fresco.current=c!=="amt"; setCampo(c); }
    setTeclado(true);
  };
  const modo=function(p){ setPlazos(p); if(!p&&campo!=="amt"){ fresco.current=false; setCampo("amt"); } };
  const teclas={amt:[raw,setRaw],meses:[rawMeses,setRawMeses],entrada:[rawDown,setRawDown]}[campo];
  const now=Date.now();
  const justo=function(b){
    if(b.min<-0.005) return t("pr6_te_faltan");
    if(b.minDay==null) return t("pr6_justo_sin");
    return b.minDay<=today?t("pr6_justo_hoy"):tf("pr6_justo",{d:b.minDay});
  };
  const pasa=function(b){
    const v={x:eur0(b.falta),bank:entOf(b.bank).label};
    if(b.shortDay==null) return tf("pr6_pasa_sin",v);
    return b.shortDay<=today?tf("pr6_pasa_hoy",v):tf("pr6_pasa",Object.assign(v,{d:b.shortDay}));
  };
  const fila=function(k,lbl,val){ return React.createElement("div",{className:"pr6-ll-row",key:k},React.createElement("span",null,lbl),React.createElement("span",{className:"num"},val)); };
  const flujoRow=function(e){
    const nombre=e.name||t(e.kind==="income"?"fj_income":"fj_transfer");
    const lbl=e.day>0&&e.day<99?tf("pr6_dia_n",{name:nombre,d:e.day}):nombre;
    // Un traspaso sale de un banco y entra en otro tuyo: cada bloque enseña su lado.
    if(e.kind!=="income") return fila("f_"+e.id,lbl,(e.amt>0?"+ ":"− ")+eur(Math.abs(e.amt)));
    return React.createElement("button",{type:"button",className:"pr6-ll-row pr6-ll-in",key:"f_"+e.id,"data-testid":"llega-flow","data-flow":e.id,onClick:function(){ setFlujo(e.id); }},
      React.createElement("span",null,lbl),
      React.createElement("span",{className:"num pos"},"+ "+eur(e.amt)),
      React.createElement("svg",{width:13,height:13,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},React.createElement("path",{d:"M9 6l6 6-6 6"})));
  };
  const bloque=function(b){
    const fresco=pr6FrescuraTxt(pr6LecturaMs(state,b.bank),now);
    return React.createElement("div",{className:"pr6-ll-b",key:b.bank,"data-testid":"llega-banco","data-bank":b.bank},
      React.createElement("div",{className:"pr6-ll-h"},
        React.createElement(Mono,{ent:b.bank,size:38}),
        React.createElement("span",{className:"pr6-ficha-t"},
          React.createElement("span",{className:"pr6-ll-n"}, entOf(b.bank).label),
          fresco&&React.createElement("span",{className:"pr6-ficha-s pr6-ll-f","data-testid":"llega-fresco"}, fresco)),
        React.createElement("span",{className:"pr6-ll-r","data-testid":"llega-cifra"},
          b.known&&React.createElement("span",{className:"pr6-ll-l"}, justo(b)),
          React.createElement("span",{className:"serif num pr6-ll-a"}, b.known?eur(Math.abs(b.min)):"—"))),
      // Con el teclado abierto se pliega el detalle: la hoja no crece y la cifra de arriba sigue a la vista.
      React.createElement("div",{className:"pr6-fold"+(teclado?"":" open")},
        React.createElement("div",Object.assign({className:"pr6-fold-in pr6-ll-det"},teclado?{"aria-hidden":"true",inert:""}:null),
          fila("hoy",t("pr6_tienes_hoy"),b.known?eur(b.bal):"—"),
          fila("rec",t("pr6_faltan_recibos"),"− "+eur(b.pend)),
          b.sinRestar>0.005&&fila("sinr",t("pr6_sin_restar"),"− "+eur(b.sinRestar)),
          b.flows.map(flujoRow),
          b.known&&b.min<-0.005&&React.createElement("div",{className:"pr6-ll-tip","data-testid":"llega-tip"},
            React.createElement("svg",{width:16,height:16,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},React.createElement("path",{d:"M5 12h14M13 6l6 6-6 6"})),
            pasa(b)))));
  };
  return ReactDOM.createPortal(
    React.createElement(React.Fragment,null,
      React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
        React.createElement("div",Object.assign({className:"v4-sheet pr6-ll","data-testid":"llega-sheet",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
          ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
          React.createElement("div",{className:"v4-sheet-handle"}),
          React.createElement("h2",{className:"serif pr6-ll-t",id:titleId,ref:titleRef,tabIndex:-1}, t("pr6_llega_t")),
          bancos.map(bloque),
          conSaldo.length>0&&React.createElement("div",{className:"pr6-ll-wi","data-testid":"llega-gasto",ref:zonaRef,
            onClick:function(e){ if(!teclado&&!(e.target.closest&&e.target.closest(".chip,[data-sin-teclado]"))) setTeclado(true); }},
            React.createElement("span",{className:"pr6-ll-n"}, t("pr6_si_gasto")),
            React.createElement("div",{className:"pr6-ll-wr"},
              React.createElement("button",{type:"button",className:"serif num pr6-ll-amt"+(teclado&&campo==="amt"?" on":"")+(raw?"":" ph"),"aria-expanded":teclado&&campo==="amt"?"true":"false","data-testid":"llega-gasto-amt",
                onClick:function(){ tocaCampo("amt"); }}, raw?eur(amt):t("pr6_importe")),
              // Los bancos van juntos: si no caben al lado del importe bajan enteros a su renglón y el
              // importe no se aplasta (a 393 px con tres bancos medía 47 px y «900,00 €» se partía).
              conSaldo.length>1&&React.createElement("div",{className:"pr6-ll-bks"}, conSaldo.map(function(b){
                const on=b.bank===gBank;
                return React.createElement("button",{type:"button",key:b.bank,className:"chip"+(on?" active":""),"aria-pressed":on?"true":"false","data-bank":b.bank,onClick:function(){ setGBank(b.bank); }}, entOf(b.bank).label);
              }))),
            React.createElement("div",{className:"pr6-ll-modo","data-testid":"llega-modo"},
              [[false,"pr6_de_una_vez"],[true,"pr6_a_plazos"]].map(function(mm){
                const on=plazos===mm[0];
                return React.createElement("button",{type:"button",key:mm[1],className:"chip"+(on?" active":""),"aria-pressed":on?"true":"false","data-modo":mm[0]?"plazos":"una",onClick:function(){ modo(mm[0]); }}, t(mm[1]));
              })),
            React.createElement("div",{className:"pr6-fold"+(plazos?" open":"")},
              React.createElement("div",Object.assign({className:"pr6-fold-in pr6-ll-plf"},plazos?null:{"aria-hidden":"true",inert:""}),
                React.createElement("button",{type:"button",className:"num pr6-ll-amt pr6-ll-cmp"+(teclado&&campo==="meses"?" on":"")+(rawMeses?"":" ph"),"data-campo":"meses",onClick:function(){ tocaCampo("meses"); }}, rawMeses?tf("pr6_meses_n",{n:rawMeses}):t("pr6_meses")),
                React.createElement("button",{type:"button",className:"num pr6-ll-amt pr6-ll-cmp"+(teclado&&campo==="entrada"?" on":"")+(dw>0?"":" ph"),"data-campo":"entrada",onClick:function(){ tocaCampo("entrada"); }}, dw>0?tf("pr6_entrada_x",{x:eur(dw)}):t("pr6_entrada")))),
            elegido&&React.createElement("span",{className:"pr6-ll-wt"+(elegido.min<-0.005?"":" ok"),"data-testid":"llega-gasto-txt"},
              elegido.min<-0.005?tf("pr6_no_llega",{x:eur(-elegido.min)}):tf("pr6_si_llega",{x:eur(elegido.min)})),
            React.createElement(AffordSim,{state:state,set:set,totals:totals,bancos:bancos,bank:gBank,amt:amt,dw:dw,meses:meses,plazos:plazos}),
            React.createElement("div",{className:"pr6-fold"+(teclado?" open":"")},
              React.createElement("div",Object.assign({className:"pr6-fold-in"},teclado?null:{"aria-hidden":"true",inert:""}),
                (tecladoListo||teclado)&&React.createElement(NumPad,{value:teclas[0],onChange:function(fn){
                  const desde=fresco.current; fresco.current=false;
                  teclas[1](function(r){ const b=desde?"":r; return typeof fn==="function"?fn(b):fn; });
                }})))))),
      flujo!=null&&React.createElement(NominaSheet,{key:flujo,flowId:flujo,state:state,set:set,totals:totals,onClose:function(){ setFlujo(null); }})),
    document.body);
}
/* Editar una entrada prevista desde «¿Te llega?» (SPEC §4): importe con teclado y día con − / +.
   Es la MISMA edición que Todos (`patchFlowById`): cambia la entrada para todos los meses y no
   añade ningún campo. Si su día iba por regla («último laborable») y no se toca, la regla sigue. */
function NominaSheet({flowId, state, set, totals, onClose}){
  const swipe=useSheetSwipe(true,onClose);
  useBackClose(true,swipe.close);
  const f=(state.flows||[]).find(function(x){ return x.id===flowId; })||null;
  const dia0=f?flowDay(f,totals.curYear,totals.curMonth):null;
  const [raw,setRaw]=useState(function(){ return f&&f.amount>0?String(+Number(f.amount).toFixed(2)).replace(".",numPadDecSep()):""; });
  // El primer toque del teclado sustituye la cifra en vez de añadirse detrás (SPEC §7).
  const fresh=useRef(true);
  const [marcado,setMarcado]=useState(true);
  const [dia,setDia]=useState(dia0||1);
  const hold=useRef(null);
  const paraHold=function(){ const h=hold.current; if(h){ clearTimeout(h.t); clearInterval(h.i); } hold.current=null; };
  useEffect(function(){ return paraHold; },[]);
  const diaTocado=useRef(false);
  const paso=function(d){ diaTocado.current=true; setDia(function(x){ const n=x+d; return n<1?31:n>31?1:n; }); };
  // Mantener pulsado acelera: primero despacio y, al rato, rápido.
  const empieza=function(d){ return function(e){
    if(e.button!=null&&e.button!==0) return;
    e.preventDefault(); paraHold(); paso(d);
    const h={n:0,i:null};
    h.t=setTimeout(function(){ h.i=setInterval(function(){ paso(d); h.n++; if(h.n===8){ clearInterval(h.i); h.i=setInterval(function(){ paso(d); },55); } },140); },400);
    hold.current=h;
  }; };
  if(!f) return null;
  const amt=parseNumPadRaw(raw);
  const guardar=function(){
    if(!(amt>0)) return;
    const patch={};
    if(Math.abs(amt-Number(f.amount))>=0.005) patch.amount=+amt.toFixed(2);
    // Sin día previsto solo se escribe uno si lo ha movido: el 1 del selector nadie lo ha elegido.
    if(dia0!=null?dia!==dia0:diaTocado.current){ patch.day=dia; patch.when=null; }
    if(Object.keys(patch).length) patchFlowById(set,f.id,patch);
    swipe.close();
  };
  const bank=f.to||"sabadell";
  const btnDia=function(d,lbl,txt){ return React.createElement("button",{type:"button",className:"pr6-nd-b","aria-label":lbl,"data-act":d<0?"dia-menos":"dia-mas",
    onPointerDown:empieza(d),onPointerUp:paraHold,onPointerLeave:paraHold,onPointerCancel:paraHold,
    onKeyDown:function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); paso(d); } }},txt); };
  return React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
    React.createElement("div",Object.assign({className:"v4-sheet pr6-nd","data-testid":"nomina-sheet",role:"dialog","aria-modal":"true","aria-label":f.name||t("fj_income"),
      ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"pr6-ll-h"},
        React.createElement(Mono,{ent:bank,size:38}),
        React.createElement("span",{className:"pr6-ficha-t"},
          React.createElement("span",{className:"serif pr6-ll-t"}, f.name||t("fj_income")),
          React.createElement("span",{className:"pr6-ficha-s"}, tf("pr6_entra_en",{bank:entOf(bank).label})))),
      React.createElement("div",{className:"pr6-nd-v"},
        React.createElement("span",{className:"serif num"+(marcado&&raw?" sel":""),"data-testid":"nomina-importe"}, eur(amt))),
      React.createElement("div",{className:"pr6-nd-d"},
        btnDia(-1,t("pr6_dia_menos"),"−"),
        React.createElement("span",{className:"num","data-testid":"nomina-dia"}, tf("pr6_dia",{d:dia})),
        btnDia(1,t("pr6_dia_mas"),"+")),
      React.createElement(NumPad,{value:raw,onChange:function(fn){
        const desde=fresh.current; fresh.current=false; setMarcado(false);
        setRaw(function(r){ const b=desde?"":r; return typeof fn==="function"?fn(b):fn; });
      }}),
      React.createElement("button",{type:"button",className:"pr6-cta","data-act":"guardar",disabled:!(amt>0),onClick:guardar}, t("save"))));
}

/* «Este año» de la ficha (SPEC §2.6): lo pagado en el año, en TU parte. Solo si cada mes en que
   tocaba hay un pago acreditado; con un mes sin dato la suma saldría corta y aparentaría ser
   exacta, así que no se enseña (AGENTS §1). El bruto real vale para un recibo propio; en uno
   compartido no se puede deducir la parte propia del cargo, y cuenta la prevista. */
function reciboPagadoEnAno(s,f,y,curM,today){
  let total=0, alguno=false;
  for(let m=1;m<=curM;m++){
    const a=occAmountIn(f,m,y);
    if(!(a>0)||!occursIn(f,m,y)) continue;
    const st=fixedPaymentState(s,f,y,m,m===curM?today:new Date(y,m,0).getDate());
    const aMano=!fixedPaymentEvidence(st)&&fixedMarcadoAMano(f,y,m)!=null;
    if(!fixedPaymentEvidence(st)&&!aMano){ if(m===curM) continue; return null; }
    const compartido=f.bankAmount>0&&Math.abs(f.bankAmount-a)>=0.005;
    total+=!aMano&&!compartido&&st.paidAmount>0?st.paidAmount:a;
    alguno=true;
  }
  return alguno?total:null;
}
/* La fila de Gastos que acredita el recibo, si la hay (la que `paymentEvidenceUI` atribuye). */
function reciboCargoFila(s,proof,fixedId){
  let id=null;
  proof.byExpense.forEach(function(rel,expId){ if(rel&&rel.kind==="fixed"&&rel.id===fixedId) id=expId; });
  return id==null?null:(s.expenses||[]).find(function(x){ return x.id===id; })||null;
}
/* «No es este recibo»: deshace el vínculo con las MISMAS piezas que la ficha de Gastos. Con la
   marca del cargo, `quitarCargoDeRecibo` (veta el cargo para ese recibo); sin marca, retirar la
   prueba a mano; y si lo pagó el extracto sin marca, vetar ese cargo (`quitarPagoDelExtracto`).
   → {state, e} o null si no hay nada que deshacer desde aquí. */
function reciboDesenlazar(s,f,x,y,m,today){
  if(!x) return null;
  if(x.reciboId===f.id) return quitarCargoDeRecibo(s,x.id)||null;
  const n=linkFixedPayment(s,x.id,null,y,m,today);
  return n!==s?{state:n,e:null}:quitarPagoDelExtracto(s,f,x,y,m,today);
}
/* Cargos que se pueden elegir a mano para un recibo: los que el motor dejaría enlazar
   (`fixedExpenseEligible`, del mes y hasta hoy) y que no acreditan ya a otro recibo. */
function reciboCargosElegibles(s,f,y,m,today){
  const ym=y+"-"+String(m).padStart(2,"0");
  const usados=new Set();
  (s.fixed||[]).forEach(function(o){
    if(o.id===f.id) return;
    const id=reciboPagadoCon(fixedPaymentState(s,o,y,m,today));
    if(id) usados.add(id);
  });
  return (s.expenses||[]).filter(function(x){
    if(!x||!(Number(x.amount)>0)||String(x.date||"").slice(0,7)!==ym||x.debtId||x.possibleDup) return false;
    if(x.reciboId&&x.reciboId!==f.id) return false;
    if(usados.has(fixedPaymentIdentity(expenseBankOf(x),x))) return false;
    return fixedExpenseEligible(s,x,f,y,m,today);
  });
}
/* Cargos del banco del recibo que hoy NO se pueden elegir solo porque el banco aún no los ha
   confirmado (pendientes o con fecha posterior a hoy). Se enseñan sin poder tocarlos: la regla de
   prueba de pago no cambia (un pendiente no demuestra el pago, NO-GO 3/10), pero «Sin cargos de
   Sabadell este mes» con el cargo ya en Gastos era mentira (compra en domingo que el banco apunta
   el lunes, beta 4.26.210, 1/11/2026). */
function reciboCargosPorConfirmar(s,f,y,m,today,elegibles){
  const ym=y+"-"+String(m).padStart(2,"0"), bank=accOf(f), deleted=expenseDeletedSet(s);
  const ya=new Set((elegibles||[]).map(function(x){ return x.id; }));
  return (s.expenses||[]).filter(function(x){
    if(!x||ya.has(x.id)||!(Number(x.amount)>0)||String(x.date||"").slice(0,7)!==ym||x.debtId||x.possibleDup||metaDeGasto(x)) return false;
    if(x.reciboId&&x.reciboId!==f.id) return false;
    if(expenseBankOf(x)!==bank||CAT_NEUTRAS[x.category]||x.category==="ingreso"||expenseIsTombstoned(x,deleted)) return false;
    const st=String(x.status||"").toUpperCase(), d=recDay(x.date);
    return !!x.obPending||(!!st&&st!=="BOOK")||(d!=null&&d>today);
  }).sort(function(a,b){ return dateMs(String(b.date).slice(0,10))-dateMs(String(a.date).slice(0,10)); });
}
function reciboCargoTexto(x){ return String((x&&(x.merchant||x.obName))||""); }
/* La cuota de una deuda en Recibos (beta 4.26.200): «sale un cargo que YA está enlazado, no deja
   pulsarlo y te lleva a Deudas». Tocarla abre su ficha con el cargo que Gastos le ha marcado este
   mes y, si aún no la da por pagada, el motivo. Solo LEE: quién acredita la cuota sigue siendo
   `debtPaymentState` (08): la fila enlazada paga la cuota con lo que cobró (decisión del dueño); aquí no
   se decide nada de dinero.
   → {x, acredita, motivo} o null sin cargo marcado. */
function deudaCargoEnlazado(s, d, y, m, today){
  if(!d) return null;
  const st=debtPaymentState(s,d,y,m,today);
  if(st.expense) return {x:st.expense, acredita:true, motivo:null, cuota:(Number(d.monthly)||0)+debtBalloonIn(d,y,m)};
  const fin=new Date(y,m-1,today,23,59,59).getTime(), borrados=expenseDeletedSet(s);
  // La misma ventana que usa el motor para atar un cargo a la cuota de un mes.
  const filas=(s.expenses||[]).filter(function(x){
    if(!x||x.debtId!==d.id||x.possibleDup||!(Number(x.amount)>0)||expenseIsTombstoned(x,borrados)) return false;
    const ms=dateMs(String(x.date||"").slice(0,10));
    if(!isFinite(ms)||ms>fin) return false;
    const c=cuotaCargoCercano(d,ms);
    return c.key===y+"-"+m&&c.dias<=CUOTA_ALIAS_DIAS;
  }).sort(function(a,b){ return dateMs(String(b.date).slice(0,10))-dateMs(String(a.date).slice(0,10)); });
  if(!filas.length) return null;
  const x=filas[0], cuota=(Number(d.monthly)||0)+debtBalloonIn(d,y,m);
  const motivo=cleanDay(dayOf(d))==null?"sin_dia":Math.round(cuota*100)!==Math.round(Number(x.amount)*100)?"importe":"banco";
  return {x:x, acredita:false, motivo:motivo, cuota:cuota};
}
function DeudaFicha({row, state, totals, onClose, onGoDebts}){
  const swipe=useSheetSwipe(true,onClose);
  useBackClose(true,swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const y=totals.curYear, m=totals.curMonth, today=totals.today;
  const id=String(row.id).replace(/^(debt|balloon)_/,"");
  const d=(state.debts||[]).find(function(o){ return String(o.id)===id; })||null;
  const ce=useMemo(function(){ return deudaCargoEnlazado(state,d,y,m,today); },[state,d,y,m,today]);
  const x=ce&&ce.x, b=x?expenseBankOf(x)||row.bank:row.bank;
  // Pagada con otro importe: se dice lo previsto, como en los recibos («Esperabas X»).
  const nota=!ce?"":ce.acredita?(Math.round(ce.cuota*100)!==Math.round(Number(x.amount)*100)?tf("pr6_esperabas",{x:eur(ce.cuota)}):""):ce.motivo==="importe"?tf("pr6_deuda_importe",{x:eur(Number(x.amount)),y:eur(ce.cuota)})
    :ce.motivo==="sin_dia"?t("pr6_deuda_sin_dia"):t("pr6_deuda_sin_banco");
  // Se cierra la hoja y, al terminar de bajar, Deudas se abre con la deuda a la vista.
  const verDeuda=function(){ swipe.close(); setTimeout(function(){ if(onGoDebts) onGoDebts(id); },320); };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet pr6-ficha","data-sheet":"deuda",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
        ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"pr6-step on"},
          React.createElement("div",{className:"pr6-ficha-h"},
            React.createElement("span",{className:"pr6-dt","aria-hidden":"true"},
              React.createElement("span",{className:"d serif num"}, row.day||"—"),
              React.createElement("span",{className:"m"}, monthShort(m-1))),
            React.createElement("span",{className:"pr6-ficha-t"},
              React.createElement("span",{id:titleId,ref:titleRef,tabIndex:-1,className:"pr6-ficha-n"}, row.name),
              React.createElement("span",{className:"pr6-ficha-s"}, t("fj_debt_tag")+" · "+entOf(row.bank).label)),
            React.createElement("span",{className:"serif num pr6-ficha-a"}, eur(Math.abs(row.amount)))),
          x&&React.createElement("div",{className:"pr6-cargo","data-testid":"deuda-cargo","data-acredita":ce.acredita?"1":"0"},
            React.createElement(Mono,{ent:b,size:34}),
            React.createElement("span",{className:"pr6-cand-t"},
              React.createElement("span",{className:"pr6-cand-n"}, reciboCargoTexto(x)||entOf(b).label),
              React.createElement("span",{className:"pr6-cand-s"}, (recDay(x.date)||"")+" "+monthShort((Number(String(x.date).slice(5,7))||m)-1)+" · "+entOf(b).label+" · "+eur(Number(x.amount)))),
            // El aro vacío parecía algo que marcar: solo sale, lleno, cuando el cargo paga la cuota.
            ce.acredita&&React.createElement("span",{className:"pr6-ring on","aria-hidden":"true"},"✓")),
          nota&&React.createElement("div",{className:"pr6-nota","data-testid":"deuda-nota"}, nota),
          React.createElement("div",{className:"pr6-btns"},
            React.createElement("button",{type:"button",className:"pr6-btn","data-act":"ver-deuda",onClick:verDeuda}, t("pr6_ver_deuda")))))),
    document.body);
}
function ReciboFicha({row, state, set, totals, evidence, showToast, onClose, onEdit, onRemove, aviso, onPosponer, onDeshacer}){
  const swipe=useSheetSwipe(true,onClose,{soloVelo:true});
  useBackClose(true,swipe.close);
  const [paso,setPaso]=useState(0);           // 0 ficha · 1 «¿Cuál es el cargo?»
  const trackRef=useRef(null);
  usePasosCarril(trackRef,swipe.sheetRef,paso);
  const [pausa,setPausa]=useState(false);
  const [gone,setGone]=useState(false);       // «Ya no lo tengo» pide un segundo toque
  const [rechazo,setRechazo]=useState(false); // vino de «No es este recibo»
  const [elegido,setElegido]=useState(null);
  const linkLive=useRef(true);
  const linkState=useRef(state);linkState.current=state;
  const [linkPending,setLinkPending]=useState(null);
  const linkSerial=useRef(0),linkHandled=useRef(0);
  useEffect(function(){ linkLive.current=true;return function(){ linkLive.current=false; }; },[]);
  const [otros,setOtros]=useState(false);
  const [q,setQ]=useState("");
  useBackClose(paso===1,function(){ setPaso(0); });
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const y=totals.curYear, m=totals.curMonth, today=totals.today;
  const fixedId=/^fixed_/.test(String(row.id))?String(row.id).slice(6):null;
  const oneoffId=/^oneoff_/.test(String(row.id))?String(row.id).slice(7):null;
  const f=fixedId!=null?(state.fixed||[]).find(function(e){ return String(e.id)===fixedId; }):null;
  const compartido=!!f&&Number(f.bankAmount)>0&&Math.round(Number(f.bankAmount)*100)!==Math.round(Math.abs(row.amount)*100);
  const st=useMemo(function(){ return f?fixedPaymentState(state,f,y,m,today):null; },[state,f,y,m,today]);
  useEffect(function(){
    // Si el padre rechaza el updater, el mismo estado también debe cerrar con el aviso de fallo.
    if(!linkPending||linkHandled.current===linkPending.serial) return;
    linkHandled.current=linkPending.serial;setLinkPending(null);
    const cur=(state.fixed||[]).find(function(e){ return e.id===linkPending.fixedId; });
    const x=(state.expenses||[]).find(function(e){return e&&e.id===linkPending.expenseId;});
    const p=cur&&fixedPaymentProof(state,cur,y,m,today);
    const restored=linkPending.subirRows.every(function(row){const e=(state.expenses||[]).find(function(x){return x&&x.id===row.id;});return e&&fixedPaymentIdentity(expenseBankOf(e),e)===row.identity&&(e.reciboId||null)===row.reciboId;});
    // Reponer un veto también puede recuperar solo la marca o el BOOK, sin crear una proof.
    const ok=!!cur&&!!x&&fixedPaymentModel(cur,m)===linkPending.model&&fixedPaymentIdentity(expenseBankOf(x),x)===linkPending.identity&&restored&&
      (linkPending.proof?!!p&&JSON.stringify(p)===JSON.stringify(linkPending.proof):
        !reciboNoDe(state,cur.id,reciboNoIdentidad(x),x.id).length&&(reciboPagadoCon(fixedPaymentState(state,cur,y,m,today))||null)===linkPending.paymentIdentity);
    // El Ask puede durar: solo el estado comprometido permite anunciar o subir el enlace.
    if(ok&&cloud.enabled()) linkPending.subirRows.forEach(function(row){const e=(state.expenses||[]).find(function(x){return x&&x.id===row.id;});if(e) cloud.setExpenseRecibo(e).catch(function(){});});
    if(showToast) showToast(ok?tf("pr6_pagado_toast",{name:row.name}):t("pr6_link_fail"));
    swipe.close();
  },[state,linkPending,y,m,today]);
  const confirmado=row.paid&&evidence.confirmed[row.id]!==false;
  const fila=useMemo(function(){ return f&&confirmado?reciboCargoFila(state,evidence,f.id):null; },[state,evidence,f,confirmado]);
  const desenlace=useMemo(function(){
    if(!f||!fila) return null;
    const r=reciboDesenlazar(state,f,fila,y,m,today);
    // Solo se ofrece si de verdad deja de estar pagado con ESE cargo (si no, el botón mentiría).
    const f2=r&&(r.state.fixed||[]).find(function(e){ return e.id===f.id; });
    return f2&&reciboPagadoCon(fixedPaymentState(r.state,f2,y,m,today))!==fixedPaymentIdentity(expenseBankOf(fila),fila)?r:null;
  },[state,f,fila,y,m,today]);
  const ano=useMemo(function(){ return f?reciboPagadoEnAno(state,f,y,m,today):null; },[state,f,y,m,today]);
  const base=rechazo&&desenlace?desenlace.state:state;
  // Tras «No es este recibo» no se vuelve a ofrecer el cargo que se acaba de rechazar.
  const pool=useMemo(function(){
    if(paso!==1||!f) return [];
    return reciboCargosElegibles(base,f,y,m,today).filter(function(x){ return !(rechazo&&fila&&x.id===fila.id); });
  },[paso,base,f,y,m,today,rechazo,fila]);
  const bank=f?accOf(f):row.bank;
  const target=f?(f.bankAmount>0?f.bankAmount:occAmountIn(f,m,y)):Math.abs(row.amount);
  const dayF=f?dayIn(f,m,y):row.day;
  const dms=function(x){ return dateMs(String(x.date).slice(0,10)); };
  // Lista para ELEGIR a mano, más ancha a propósito que el casado automático (SPEC §2.6.3):
  // del banco del recibo, desde 7 días antes de su día, a ± max(2 €, 15 %), por parecido de importe.
  const delBanco=pool.filter(function(x){ return expenseBankOf(x)===bank; });
  const cands=delBanco.filter(function(x){
    const d=recDay(x.date);
    return (dayF==null||d==null||d>=dayF-7)&&Math.abs(Number(x.amount)-target)<=Math.max(2,target*0.15);
  }).sort(function(a,b){ return Math.abs(a.amount-target)-Math.abs(b.amount-target); });
  const recientes=delBanco.filter(function(x){ return cands.indexOf(x)<0; }).sort(function(a,b){ return dms(b)-dms(a); }).slice(0,4);
  const porConfirmar=useMemo(function(){
    return paso===1&&f?reciboCargosPorConfirmar(base,f,y,m,today,pool):[];
  },[paso,base,f,y,m,today,pool]);
  const qq=q.trim().toLowerCase();
  const encontrados=qq?pool.filter(function(x){
    const a=Number(x.amount).toFixed(2), qn=qq.replace(",",".");
    return reciboCargoTexto(x).toLowerCase().indexOf(qq)>=0||a.indexOf(qn)>=0;
  }).sort(function(a,b){ return dms(b)-dms(a); }):[];
  const elegir=function(x){
    if(elegido) return;
    setElegido(x.id);
    mcTickHaptic();
    setTimeout(function(){
      const visto={paidYm:f.paidYm||null,paidDay:f.paidDay||null};
      // Pura: se ensaya sobre lo que se ve (aviso y subida) y se aplica sobre el estado vivo.
      const enlaza=function(s){
        const cur=(s.fixed||[]).find(function(e){ return e.id===f.id; });
        // Otra confirmación llegó con la ficha abierta: no se escribe encima.
        if(!cur||(cur.paidYm||null)!==visto.paidYm||(cur.paidDay||null)!==visto.paidDay) return null;
        let s2=s; const subir=[];
        if(rechazo&&fila){ const u=reciboDesenlazar(s,f,fila,y,m,today); if(!u) return null; s2=u.state; if(u.e) subir.push(u.e); }
        /* La marca de pago se lee DESPUÉS de desenlazar: quitar el cargo viejo borra el `paidYm`
           que el sync derivó de él, y con la de antes `linkFixedPayment` lo tomaba por otra
           confirmación y rechazaba el nuevo («No se ha podido enlazar», revisión 28/10/2026). */
        const f2=(s2.fixed||[]).find(function(e){ return e.id===f.id; });
        const expected={identity:fixedPaymentIdentity(expenseBankOf(x),x),model:fixedPaymentModel(f,m),paidYm:f2.paidYm,paidDay:f2.paidDay};
        // Si de este cargo se dijo «no es este recibo», elegirlo lo deshace (como en Gastos).
        const r=reponerCargoDeRecibo(s2,x.id,f.id,y,m,today,expected);
        const n=r?r.state:linkFixedPayment(s2,x.id,f.id,y,m,today,expected);
        if(n===s2) return null;
        if(r&&r.e) subir.push(r.e);
        return {state:n,subir:subir};
      };
      const apply=function(confirmedWarnings){
        if(!linkLive.current) return;
        let live=linkState.current;
        if(rechazo&&fila){const u=reciboDesenlazar(live,f,fila,y,m,today);if(u)live=u.state;}
        const cur=(live.fixed||[]).find(function(e){return e.id===f.id;}),cargo=(live.expenses||[]).find(function(e){return e&&e.id===x.id;});
        const warnings=fixedPaymentManualLinkWarnings(live,cargo,cur,y,m,today),signature=JSON.stringify(warnings);
        // La confirmación responde al aviso vivo, también si otra sincronización añade un BOOK.
        if(warnings.length&&signature!==confirmedWarnings){
          askConfirm({title:tf("f_receipt_confirm",{name:cur.name}),
            sub:React.createElement("span",{"data-testid":"receipt-manual-link-warning"},warnings.map(function(w){return tf("f_receipt_possible_same",{name:w.name,date:fmtIsoCorto(w.date)});}).join(" · ")),
            ok:t("f_receipt_other_payment")}).then(function(yes){if(yes) apply(signature);else if(linkLive.current)setElegido(null);});return;
        }
        const prueba=enlaza(linkState.current);
        if(!prueba){if(showToast) showToast(t("pr6_link_fail"));swipe.close();return;}
        const linked=(prueba.state.fixed||[]).find(function(e){return e.id===f.id;});
        setLinkPending({serial:++linkSerial.current,fixedId:f.id,expenseId:x.id,identity:fixedPaymentIdentity(expenseBankOf(x),x),model:fixedPaymentModel(f,m),
          proof:linked.paymentProofs&&linked.paymentProofs[y*12+m]||null,paymentIdentity:reciboPagadoCon(fixedPaymentState(prueba.state,linked,y,m,today))||null,
          subirRows:prueba.subir.map(function(e){return {id:e.id,identity:fixedPaymentIdentity(expenseBankOf(e),e),reciboId:e.reciboId||null};})});
        set(function(s){ const r=enlaza(s); return r?r.state:s; });
      };
      apply();
    },260);
  };
  const aunNo=function(){
    const prueba=reciboDesenlazar(state,f,fila,y,m,today);
    /* Una marca a mano vieja que quedó debajo del cargo no vuelve a salir al rechazarlo: «Aún no se
       ha cobrado» quiere decir eso, que no está pagado (revisión de dinero 9/11). */
    set(function(s){ const u=reciboDesenlazar(s,f,fila,y,m,today); return u?fixedMarcarAMano(u.state,f.id,y,m,null):s; });
    if(prueba&&prueba.e&&cloud.enabled()) cloud.setExpenseRecibo(prueba.e).catch(function(){});
    /* El aviso dice dónde queda de verdad: con una marca de pago que el banco ya dejó (`paidYm`)
       el recibo no vuelve a pendiente, pasa a «Para revisar» (revisión 28/10/2026). */
    const f2=prueba&&(prueba.state.fixed||[]).find(function(e){ return e.id===f.id; });
    const sigue=!!(f2&&fixedPaymentState(prueba.state,f2,y,m,today).paid);
    if(showToast&&prueba) showToast(tf(sigue?"pr6_revisar_toast":"pr6_vuelve_toast",{name:row.name}));
    swipe.close();
  };
  /* «Marcado a mano» (SPEC §2.6.3) y su «Desmarcar» (§2.6.1), los dos con Deshacer. El deshacer
     solo repone si nadie ha cambiado la marca entretanto (otro móvil, otra pestaña). */
  const aMano=!!row.aMano;
  const marcaAMano=function(dia,msg){
    if(!f) return;
    const antes=fixedMarcadoAMano(f,y,m);
    set(function(s){ return fixedMarcarAMano(s,f.id,y,m,dia); });
    mcTickHaptic();
    const deshacer=function(){ set(function(s){
      const e=(s.fixed||[]).find(function(o){ return o.id===f.id; });
      return e&&fixedMarcadoAMano(e,y,m)===dia?fixedMarcarAMano(s,f.id,y,m,antes):s;
    }); };
    if(onDeshacer) onDeshacer(msg,deshacer); else if(showToast) showToast(msg);
    swipe.close();
  };
  const marcarAMano=function(){ marcaAMano(today,tf("pr6_a_mano_toast",{name:row.name})); };
  const desmarcar=function(){
    const donde=pr6DondeQueda(fixedMarcarAMano(state,f.id,y,m,null),row.id,y,m,today);
    marcaAMano(null,tf(donde==="review"?"pr6_revisar_toast":"pr6_vuelve_toast",{name:row.name}));
  };
  const cargoRow=function(x){
    const on=elegido===x.id, b=expenseBankOf(x);
    return React.createElement("button",{type:"button",key:x.id,className:"pr6-cand"+(on?" on":""),"data-cargo":x.id,onClick:function(){ elegir(x); }},
      React.createElement(Mono,{ent:b,size:38}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, reciboCargoTexto(x)||entOf(b).label),
        React.createElement("span",{className:"pr6-cand-s"}, (recDay(x.date)||"")+" "+monthShort(m-1)+" · "+entOf(b).label)),
      React.createElement("span",{className:"pr6-cand-a num"}, eur(Number(x.amount))),
      React.createElement("span",{className:"pr6-ring","aria-hidden":"true"},"✓"));
  };
  // Sin botón ni anillo: se ve que el cargo ha llegado, pero no se puede elegir hasta que el banco lo confirme.
  const pendRow=function(x){
    const b=expenseBankOf(x);
    return React.createElement("div",{key:x.id,className:"pr6-cand pend","data-cargo-pend":x.id},
      React.createElement(Mono,{ent:b,size:38}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, reciboCargoTexto(x)||entOf(b).label),
        React.createElement("span",{className:"pr6-cand-s"}, t("pr6_pend_banco"))),
      React.createElement("span",{className:"pr6-cand-a num"}, eur(Number(x.amount))));
  };
  // Cabecera y estado del pago.
  // En catalán, «l'1» y «l'11»: el artículo se apostrofa ante vocal (auditoría 226).
  const sub=dayF!=null?tf(dayF===1||dayF===11?"pr6_se_cobra_v":"pr6_se_cobra",{d:dayF,bank:entOf(bank).label}):entOf(bank).label;
  const pagoBanco=confirmado&&st?st.paidBank||bank:null;
  const pagoTxt=confirmado?(fila?reciboCargoTexto(fila):st&&st.bankTx?String(st.bankTx.merchant||""):st&&st.proof&&st.proof.merchant?String(st.proof.merchant):""):"";
  const pagoDia=confirmado?(st&&st.day!=null?st.day:row.day):null;
  /* Casos especiales (SPEC §2.6.2): una pareja de botones en lugar de los normales. «Editar» y
     «Pausar» siguen debajo; «No es este recibo» no, porque ahí la pregunta es si el cargo está
     bien, no cuál es. */
  const rv=aviso&&aviso.rv;
  const especial=rv==="diff"||rv==="up"||rv==="ghost"||rv==="cand"||rv==="trial"||rv==="perm";
  const cur=y*12+m;
  // «Desde ahora» cambia el importe del recibo: solo cuando es un importe único cada vez. Con
  // pagos a medida o un anual repartido no hay una cifra que poner sin inventarla.
  const precioSimple=!!f&&!hasSchedule(f)&&Math.abs(occAmountIn(f,m,y)-Number(f.amount))<0.005;
  const cerrarCon=function(msg){ if(showToast&&msg) showToast(msg); swipe.close(); };
  const revisado=function(kind,val){
    set(function(s){
      let cambia=false;
      const fixed=(s.fixed||[]).map(function(e){
        if(e.id!==f.id) return e;
        cambia=true;
        return Object.assign({},e,{revisado:Object.assign({},e.revisado,{[kind]:val!=null?val:cur})});
      });
      return cambia?Object.assign({},s,{fixed:fixed}):s;
    });
    cerrarCon(null);
  };
  const nuevoPrecio=function(){
    // Lo que cobra el banco: en un recibo compartido es `bankAmount`. Sin reparto tu parte no se
    // deduce sola; con reparto (tanda 5) las partes tecleadas se quedan, las de a partes iguales se
    // rehacen y tu parte es lo que queda, para que siga cuadrando al céntimo.
    const rv=repartoVigente(f), rr=rv?repartoResolver(rv,aviso.cobrado):null;
    const parche=rr&&rr.ok?{bankAmount:aviso.cobrado,amount:rr.mia,reparto:rr.partes}:f.bankAmount>0?{bankAmount:aviso.cobrado}:{amount:aviso.cobrado};
    // La edición de siempre (`patchFixedById`), pero recogida como updater para hacerlo todo en uno.
    let editar=null;
    patchFixedById(function(u){ editar=u; },f.id,parche);
    const previa=f.paymentProofs&&f.paymentProofs[cur];
    set(function(s){
      // Una parte «Lo descuento» a partes iguales cambia con el precio: la cuota de su deuda también.
      let n=deudasTrasReparto(s,editar(s));
      const e=(n.fixed||[]).find(function(o){ return o.id===f.id; });
      /* El importe forma parte del contrato de la prueba de pago: al cambiarlo, la de este mes deja
         de valer y el recibo volvía a pendiente, con la cifra de arriba sumando un pago ya hecho
         (banco de pruebas, 28/10/2026). La misma prueba se ata al importe nuevo; si no basta, se
         vuelve a enlazar el MISMO cargo, como desde Gastos. */
      if(e&&!fixedPaymentState(n,e,y,m,today).paid){
        if(previa){
          const r=Object.assign({},n,{fixed:n.fixed.map(function(o){
            return o.id===e.id?Object.assign({},o,{paymentProofs:Object.assign({},o.paymentProofs,{[cur]:fixedPaymentBind(previa,o,m)})}):o;
          })});
          if(fixedPaymentState(r,r.fixed.find(function(o){ return o.id===e.id; }),y,m,today).paid) n=r;
        }
        const e2=(n.fixed||[]).find(function(o){ return o.id===f.id; });
        if(fila&&!fixedPaymentState(n,e2,y,m,today).paid) n=linkFixedPayment(n,fila.id,f.id,y,m,today);
      }
      /* El saldo que se ve no se mueve: la previsión del mes resta el importe PREVISTO de lo ya
         pagado, y cambiarlo restaba la diferencia de precio a un saldo que ya era el del banco
         (Luz 50 cobrada a 50,90: 2000 → 1999,10; revisión de dinero 28/10/2026). */
      return n===s?s:conSaldoMostrado(s,n);
    });
    cerrarCon(tf("pr6_precio_toast",{name:row.name,x:eur(aviso.cobrado)}));
  };
  /* «Cobró distinto» sin pagar (P1-11): el cargo lo propone el motor y lo decide él. «Sí, es este»
     enlaza ESE cargo por el camino de «¿Cuál es el cargo?» (`linkFixedPayment`); «No es este
     recibo» lo veta para este recibo (`reciboNo`, viaja al otro móvil). Los dos con Deshacer, que
     solo repone si nadie lo ha cambiado entretanto. */
  const cargoCand=rv==="cand"&&aviso.cargo?aviso.cargo:null;
  const esEsteCargo=function(){
    const x=cargoCand, ym=y*12+m;
    const expected={identity:fixedPaymentIdentity(expenseBankOf(x),x),model:fixedPaymentModel(f,m),paidYm:f.paidYm||null,paidDay:f.paidDay||null};
    if(linkFixedPayment(state,x.id,f.id,y,m,today,expected)===state){ cerrarCon(t("pr6_link_fail")); return; }
    set(function(s){ return linkFixedPayment(s,x.id,f.id,y,m,today,expected); });
    mcTickHaptic();
    const deshacer=function(){ set(function(s){
      const e=(s.fixed||[]).find(function(o){ return o.id===f.id; }), p=e&&e.paymentProofs&&e.paymentProofs[ym];
      return p&&p.kind==="expense"&&p.expenseId===x.id?linkFixedPayment(s,x.id,null,y,m,today):s;
    }); };
    const msg=tf("pr6_a_pagados_toast",{name:row.name});
    if(onDeshacer) onDeshacer(msg,deshacer); else if(showToast) showToast(msg);
    swipe.close();
  };
  const noEsEsteCargo=function(){
    const x=cargoCand, claves=reciboNoClaves(f.id,reciboNoIdentidad(x),x.id);
    const veta=function(s){ return Object.assign({},s,reciboNoPon(s,claves,true,Date.now())); };
    const donde=pr6DondeQueda(veta(state),row.id,y,m,today);
    set(veta);
    const deshacer=function(){ set(function(s){
      return claves.every(function(k){ return (s.reciboNo||[]).indexOf(k)>=0; })?Object.assign({},s,reciboNoPon(s,claves,false,Date.now())):s;
    }); };
    const msg=tf(donde==="review"?"pr6_revisar_toast":"pr6_vuelve_toast",{name:row.name});
    if(onDeshacer) onDeshacer(msg,deshacer); else if(showToast) showToast(msg);
    swipe.close();
  };
  const quitar=function(){
    if(!gone){ setGone(true); return; }
    onRemove(f.id);
  };
  const par=[];
  const parBtn=function(key,label,go,main){ return React.createElement("button",{type:"button",key:key,className:main?"pr6-cta pr6-par":"pr6-btn pr6-par","data-act":key,onClick:go},label); };
  const yaNo=function(){ return React.createElement("button",{type:"button",key:"quitar",className:"pr6-btn pr6-par"+(gone?" pr6-seguro":""),"data-act":"quitar",onClick:quitar},gone?t("pr6_seguro_borrar"):t("pr6_ya_no")); };
  if(f&&rv==="cand"){
    par.push(parBtn("es-este",t("pr6_es_este"),esEsteCargo,true));
    par.push(parBtn("no-es-cargo",t("pr6_no_es_este"),noEsEsteCargo,false));
  } else if(f&&rv==="diff"){
    par.push(parBtn("solo-mes",t("pr6_solo_mes"),function(){ revisado("distinto"); },true));
    if(precioSimple) par.push(parBtn("desde-ahora",t("pr6_desde_ahora"),nuevoPrecio,false));
  } else if(f&&rv==="up"){
    if(precioSimple) par.push(parBtn("actualizar",t("pr6_actualizar"),nuevoPrecio,true));
    par.push(yaNo());
  } else if(f&&rv==="ghost"){
    par.push(parBtn("sigue",t("pr6_sigue"),function(){ revisado("fantasma"); },true));
    par.push(yaNo());
  } else if(f&&rv==="trial"){
    // «Me lo quedo» quita la fecha: ya no hay prueba que vigilar y el recibo sigue como siempre.
    par.push(parBtn("me-lo-quedo",t("pr6_me_lo_quedo"),function(){
      set(function(s){ return Object.assign({},s,{fixed:(s.fixed||[]).map(function(e){
        if(e.id!==f.id||!("pruebaHasta" in e)) return e;
        const n=Object.assign({},e); delete n.pruebaHasta; return n; })}); });
      cerrarCon(tf("pr6_te_lo_quedas",{name:row.name}));
    },true));
    par.push(yaNo());
  } else if(f&&rv==="perm"){
    // «Ya lo he mirado» calla ESA fecha: si luego la cambia, vuelve a avisar de la nueva.
    par.push(parBtn("ya-mirado",t("pr6_ya_mirado"),function(){ revisado("perm",aviso.permYm); },true));
    par.push(yaNo());
  }
  const nota=rv==="late"&&dayF!=null?tf("pr6_nota_late",{d:dayF})
    :rv==="diff"||rv==="cand"?tf("pr6_nota_diff",{x:eur(aviso.cobrado),y:eur(aviso.previsto)})
    :rv==="up"?tf("pr6_nota_up",{x:eur(aviso.previsto)})
    :rv==="ghost"?tf("pr6_fantasma",{n:aviso.meses})
    :rv==="trial"||rv==="perm"?pr6Motivo(aviso):"";
  const baja=(rv==="up"||rv==="ghost"||rv==="trial")?pr6Baja(row.name):null;
  // Pausar (SPEC §2.6.1): con el recibo ya pagado la pausa empieza el mes que viene, así este
  // mes no se toca. «Hasta X» = vuelve a cobrarse en X.
  const pagado=!!row.paid;
  const desde=pagado?cur+1:cur;
  const pausaChips=[];
  if(f&&Number(f.pausedUntil)>cur) pausaChips.push({key:"reanudar",label:t("pr6_reanudar"),go:function(){ set(function(s){ return fixedPausa(s,f.id,0,0); }); cerrarCon(tf("pr6_reanudado_toast",{name:row.name})); }});
  if(f&&!pagado) pausaChips.push({key:"mes",label:t("pr6_solo_mes"),go:function(){ set(function(s){ return fixedPausa(s,f.id,cur,cur+1); }); cerrarCon(tf("pr6_pausa_mes_toast",{name:row.name})); }});
  [2,3,4,6].forEach(function(k){
    const hasta=cur+k, mes=pr6Mes(hasta);
    pausaChips.push({key:"h"+k,label:tf("pr6_hasta",{m:mes}),go:function(){ set(function(s){ return fixedPausa(s,f.id,desde,hasta); }); cerrarCon(tf("pr6_pausado_toast",{name:row.name,m:mes})); }});
  });
  const posponible=!!PR6_POSPONIBLE[rv];
  /* «Ya está pagado» va en la fila de acciones, con el tamaño de las demás: suelto ocupaba todo el
     ancho con la altura de la CTA de un paso y se comía la ficha (vídeo del dueño, 8/11). */
  const botones=[];
  if(!confirmado&&f&&rv!=="ghost"&&rv!=="cand"&&rv!=="trial") botones.push(React.createElement("button",{type:"button",key:"pg",className:"pr6-btn"+(par.length?"":" pr6-btn-main"),"data-act":"pagado",onClick:function(){ setRechazo(false); setElegido(null); setOtros(false); setQ(""); setPaso(1); }},t("pr6_ya_pagado_btn")));
  if(aMano&&confirmado) botones.push(React.createElement("button",{type:"button",key:"dm",className:"pr6-btn","data-act":"desmarcar",onClick:desmarcar},t("pr6_desmarcar")));
  if(desenlace&&!especial) botones.push(React.createElement("button",{type:"button",key:"no",className:"pr6-btn","data-act":"no-es",onClick:function(){ setRechazo(true); setElegido(null); setOtros(false); setQ(""); setPaso(1); }},t("pr6_no_es_este")));
  if(f||oneoffId) botones.push(React.createElement("button",{type:"button",key:"ed",className:"pr6-btn","data-act":"editar",onClick:function(){ onEdit(f?f.id:oneoffId); }},t("pr6_editar")));
  if(f) botones.push(React.createElement("button",{type:"button",key:"pa",className:"pr6-btn","data-act":"pausar","aria-expanded":pausa?"true":"false",onClick:function(){ setPausa(function(o){ return !o; }); }},t("pr6_pausar")));
  const fichaPanel=React.createElement("div",{className:"pr6-step"+(paso===0?" on":""),"aria-hidden":paso===0?null:"true",inert:paso===0?undefined:""},
    React.createElement("div",{className:"pr6-ficha-h"},
      React.createElement("span",{className:"pr6-dt","aria-hidden":"true"},
        React.createElement("span",{className:"d serif num"}, dayF||"—"),
        React.createElement("span",{className:"m"}, monthShort(m-1))),
      React.createElement("span",{className:"pr6-ficha-t"},
        React.createElement("span",{id:titleId,ref:titleRef,tabIndex:-1,className:"pr6-ficha-n"}, row.name),
        React.createElement("span",{className:"pr6-ficha-s"}, sub)),
      // Compartido: arriba lo que cobra el banco y tu parte en su chip, como en el diseño (SPEC §2.6).
      React.createElement("span",{className:"serif num pr6-ficha-a","data-testid":"recibo-importe"}, eur(rv==="diff"||rv==="up"||rv==="cand"?aviso.cobrado:compartido?Number(f.bankAmount):Math.abs(row.amount)))),
    nota&&React.createElement("div",{className:"pr6-nota","data-testid":"recibo-nota"}, nota),
    // El cargo que se pregunta, como lo llama el banco: sin aro, porque aún no paga nada.
    cargoCand&&React.createElement("div",{className:"pr6-cargo","data-testid":"recibo-cargo-cand"},
      React.createElement(Mono,{ent:expenseBankOf(cargoCand),size:34}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, reciboCargoTexto(cargoCand)||entOf(expenseBankOf(cargoCand)).label),
        React.createElement("span",{className:"pr6-cand-s"}, (recDay(cargoCand.date)||"")+" "+monthShort(m-1)+" · "+entOf(expenseBankOf(cargoCand)).label))),
    (ano!=null||compartido)&&React.createElement("div",{className:"pr6-chips"},
      ano!=null&&React.createElement("span",{className:"pr6-chip","data-testid":"recibo-ano"}, tf("pr6_este_ano",{x:eur(ano)})),
      compartido&&React.createElement("span",{className:"pr6-chip","data-testid":"recibo-tu-parte"}, tf("pr6_tu_parte",{x:eur(Math.abs(row.amount))}))),
    confirmado&&aMano&&React.createElement("div",{className:"pr6-cargo","data-testid":"recibo-a-mano"},
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, t("pr6_a_mano")),
        React.createElement("span",{className:"pr6-cand-s"}, row.day+" "+monthShort(m-1)+" · "+t("pr6_sin_cargo").toLowerCase())),
      React.createElement("span",{className:"pr6-ring on","aria-hidden":"true"},"✓")),
    confirmado&&!aMano&&React.createElement("div",{className:"pr6-cargo","data-testid":"recibo-cargo"},
      React.createElement(Mono,{ent:pagoBanco,size:34}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, pagoTxt||entOf(pagoBanco).label),
        React.createElement("span",{className:"pr6-cand-s"}, (pagoDia!=null?pagoDia+" "+monthShort(m-1)+" · ":"")+entOf(pagoBanco).label)),
      React.createElement("span",{className:"pr6-ring on","aria-hidden":"true"},"✓")),
    par.length>0&&React.createElement("div",{className:"pr6-btns","data-testid":"recibo-par"},par),
    baja&&React.createElement("a",{className:"pr6-baja",href:baja.url,target:"_blank",rel:"noopener noreferrer","data-testid":"recibo-baja"}, tf("pr6_baja",{name:baja.name})),
    f&&React.createElement("div",{className:"pr6-fold"+(pausa?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in pr6-pausa","data-testid":"recibo-pausa"},pausa?null:{"aria-hidden":"true",inert:""}),
        pausaChips.map(function(c){ return React.createElement("button",{type:"button",key:c.key,className:"chip","data-pausa":c.key,onClick:c.go},c.label); }))),
    botones.length>0&&React.createElement("div",{className:"pr6-btns pr6-acts"},botones),
    posponible&&React.createElement("button",{type:"button",className:"pr6-more","data-act":"posponer",onClick:function(){ if(onPosponer) onPosponer(row); swipe.close(); }},t("pr6_manana_btn")));
  const lista=qq?encontrados:cands.concat(otros||!cands.length?recientes:[]);
  const elegirPanel=f&&React.createElement("div",{className:"pr6-step"+(paso===1?" on":""),"aria-hidden":paso===1?null:"true",inert:paso===1?undefined:""},
    React.createElement("div",{className:"pr6-pick-h"},
      React.createElement("button",{type:"button",className:"pr6-back","aria-label":t("v4_back"),onClick:function(){ setPaso(0); }},"‹"),
      React.createElement("span",{className:"pr6-ficha-t"},
        React.createElement("span",{className:"serif pr6-pick-t"}, rechazo?t("pr6_con_cual"):t("pr6_cual_cargo")),
        React.createElement("span",{className:"pr6-ficha-s"}, row.name+" · "+eur(Math.abs(row.amount))))),
    // Con la lupa, como el buscador de Tus recibos y el prototipo: sin ella parecía un campo de texto más.
    React.createElement("label",{className:"pr6-mg-q pr6-pick-q"},
      React.createElement("svg",{width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round","aria-hidden":"true"},
        React.createElement("circle",{cx:11,cy:11,r:7}),React.createElement("path",{d:"M20 20l-3.5-3.5"})),
      React.createElement("input",{className:"pr6-mg-qi",type:"search",value:q,placeholder:t("pr6_buscar_cargo"),"aria-label":t("pr6_buscar_cargo"),
        onChange:function(e){ setQ(e.target.value); }})),
    !qq&&!cands.length&&recientes.length>0&&React.createElement("div",{className:"pr6-lbl"}, tf("pr6_otros_cargos",{bank:entOf(bank).label})),
    React.createElement("div",{className:"pr6-cands","data-testid":"recibo-cargos"}, lista.map(cargoRow)),
    !qq&&porConfirmar.length>0&&React.createElement("div",{className:"pr6-cands","data-testid":"recibo-cargos-pend"}, porConfirmar.map(pendRow)),
    !lista.length&&!(!qq&&porConfirmar.length)&&React.createElement("div",{className:"pr6-empty"}, qq?tf("pr6_sin_resultados",{q:q.trim()}):tf("pr6_sin_cargos",{bank:entOf(bank).label})),
    !qq&&cands.length>0&&recientes.length>0&&React.createElement("button",{type:"button",className:"pr6-more",onClick:function(){ setOtros(function(o){ return !o; }); }},
      otros?t("pr6_menos_cargos"):tf("pr6_otros_cargos",{bank:entOf(bank).label})),
    !rechazo&&React.createElement("button",{type:"button",className:"pr6-btn pr6-btn-wide","data-act":"a-mano",onClick:marcarAMano},t("pr6_marcar_a_mano")),
    rechazo&&React.createElement("button",{type:"button",className:"pr6-btn pr6-btn-wide","data-act":"aun-no",onClick:aunNo},t("pr6_aun_no")));
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet pr6-ficha","data-sheet":"recibo",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
        ref:swipe.sheetRef,onClick:function(e){
          e.stopPropagation();
          // «¿Seguro? Borrar» se cancela tocando en cualquier otro sitio (SPEC §10).
          if(gone&&!(e.target.closest&&e.target.closest('[data-act="quitar"]'))) setGone(false);
        }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{ref:trackRef,className:"pr6-track"+(paso===1?" pick":"")}, fichaPanel, elegirPanel))),
    document.body);
}
/* LA FICHA DE LO QUE ENTRA Y LO QUE MUEVES (12/11/2026): la misma hoja que la de un recibo, con sus
   dos pasos (ficha · «¿Cuál es el ingreso?»), sus clases y sus botones, pero con el motor de las
   entradas (`flowEstadoMes`, `flowEnlazar`, `flowDesenlazar`, `flowMarcarAMano`, 08). Un recibo
   tiene pausa, prueba gratis y repartos; una entrada no, y meterla en `ReciboFicha` llenaba aquella
   de ramas que no se usan. Lo que se ve y cómo se mueve es lo mismo. */
function FlujoFicha({row, state, set, totals, showToast, onClose, onEdit, onDeshacer}){
  const swipe=useSheetSwipe(true,onClose,{soloVelo:true});
  useBackClose(true,swipe.close);
  const [paso,setPaso]=useState(0);
  const trackRef=useRef(null);
  usePasosCarril(trackRef,swipe.sheetRef,paso);
  const [rechazo,setRechazo]=useState(false);
  const [elegido,setElegido]=useState(null);
  const [otros,setOtros]=useState(false);
  const [q,setQ]=useState("");
  useBackClose(paso===1,function(){ setPaso(0); });
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const y=totals.curYear, m=totals.curMonth, today=totals.today;
  const flowId=String(row.id).replace(/^flow_/,"");
  const f=(state.flows||[]).find(function(o){ return o&&String(o.id)===flowId; })||null;
  const st=useMemo(function(){ return f?flowEstadoMes(state,f,y,m,today):null; },[state,f,y,m,today]);
  const tr=!!f&&f.kind==="transfer";
  const entra=f?flowBancoEntra(f):null, sale=f?flowBancoSale(f):null;
  // Tras «No es este» no se vuelve a ofrecer el movimiento que se acaba de rechazar.
  const pool=useMemo(function(){
    if(paso!==1||!f) return [];
    return flowFilasElegibles(state,f,y,m,today).filter(function(x){ return !(rechazo&&st&&st.expense&&x.id===st.expense.id); });
  },[paso,state,f,y,m,today,rechazo,st]);
  if(!f||!st) return null;
  const target=Number(f.amount)||0, dayF=flowDay(f,y,m);
  const bank=entra||sale||"sabadell";
  const dms=function(x){ return dateMs(String(x.date).slice(0,10)); };
  // Lista para elegir a mano, más ancha que el casado solo, como la de un recibo (SPEC §2.6.3).
  const cands=pool.filter(function(x){
    const d=recDay(x.date), a=Math.abs(Number(x.amount));
    return (dayF==null||d==null||d>=dayF-7)&&Math.abs(a-target)<=Math.max(2,target*0.15);
  }).sort(function(a,b){ return Math.abs(Math.abs(a.amount)-target)-Math.abs(Math.abs(b.amount)-target); });
  const recientes=pool.filter(function(x){ return cands.indexOf(x)<0; }).sort(function(a,b){ return dms(b)-dms(a); }).slice(0,4);
  const qq=q.trim().toLowerCase();
  const encontrados=qq?pool.filter(function(x){
    return reciboCargoTexto(x).toLowerCase().indexOf(qq)>=0||Math.abs(Number(x.amount)).toFixed(2).indexOf(qq.replace(",","."))>=0;
  }).sort(function(a,b){ return dms(b)-dms(a); }):[];
  const avisa=function(msg,undo){ if(onDeshacer&&undo) onDeshacer(msg,undo); else if(showToast) showToast(msg); };
  // Lo que se hizo se deshace solo si nadie lo ha cambiado entretanto (otro móvil, una sync).
  const llegadaDe=function(s){ const o=(s.flows||[]).find(function(x){ return x&&x.id===f.id; }); return o?JSON.stringify(flowLlegadaGuardada(o,y,m)):null; };
  const elegir=function(x){
    if(elegido) return;
    setElegido(x.id);
    mcTickHaptic();
    setTimeout(function(){
      const antes=state;
      const enlaza=function(s){ const u=rechazo?flowDesenlazar(s,f.id,y,m,today):s; return flowEnlazar(u,f.id,x.id,y,m,today); };
      const prueba=enlaza(antes);
      if(prueba===antes||!flowEstadoMes(prueba,prueba.flows.find(function(o){ return o.id===f.id; }),y,m,today).llego){
        if(showToast) showToast(t("pr6_link_fail")); swipe.close(); return;
      }
      const tras=llegadaDe(prueba);
      set(enlaza);
      avisa(tf("fl_entrado_toast",{name:row.name}),function(){ set(function(s){ return llegadaDe(s)===tras?flowDesenlazar(s,f.id,y,m,today):s; }); });
      swipe.close();
    },260);
  };
  const aMano=function(){
    set(function(s){ return flowMarcarAMano(s,f.id,y,m,today); });
    mcTickHaptic();
    avisa(tf("fl_entrado_toast",{name:row.name}),function(){ set(function(s){ return flowMarcarAMano(s,f.id,y,m,null); }); });
    swipe.close();
  };
  const desmarcar=function(){
    set(function(s){ return flowMarcarAMano(s,f.id,y,m,null); });
    avisa(tf("fl_vuelve_toast",{name:row.name}),function(){ set(function(s){ return flowMarcarAMano(s,f.id,y,m,today); }); });
    swipe.close();
  };
  // «Aún no ha llegado» tras «No es este»: el movimiento queda apartado y la entrada vuelve a esperar.
  const aunNo=function(){
    set(function(s){ return flowDesenlazar(s,f.id,y,m,today); });
    if(showToast) showToast(tf("fl_vuelve_toast",{name:row.name}));
    swipe.close();
  };
  const movRow=function(x){
    const on=elegido===x.id, b=expenseBankOf(x);
    return React.createElement("button",{type:"button",key:x.id,className:"pr6-cand"+(on?" on":""),"data-cargo":x.id,onClick:function(){ elegir(x); }},
      React.createElement(Mono,{ent:b,size:38}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, reciboCargoTexto(x)||entOf(b).label),
        React.createElement("span",{className:"pr6-cand-s"}, (recDay(x.date)||"")+" "+monthShort(m-1)+" · "+entOf(b).label)),
      React.createElement("span",{className:"pr6-cand-a num"+(Number(x.amount)<0?" pos":"")}, (Number(x.amount)<0?"+":"")+eur(Math.abs(Number(x.amount)))),
      React.createElement("span",{className:"pr6-ring","aria-hidden":"true"},"✓"));
  };
  const sub=tr?tf("fl_de_a",{from:entOf(sale).label,to:f.to?entOf(f.to).label:"—"}):tf("pr6_entra_en",{bank:entOf(bank).label});
  const late=!st.llego&&st.overdue&&dayF!=null;
  const movBanco=st.llego&&!st.aMano?(st.bank||bank):null;
  const movTxt=st.expense?reciboCargoTexto(st.expense):"";
  const botones=[];
  if(!st.llego) botones.push(React.createElement("button",{type:"button",key:"ll",className:"pr6-btn pr6-btn-main","data-act":"llego",onClick:function(){ setRechazo(false); setElegido(null); setOtros(false); setQ(""); setPaso(1); }},t("fl_llego_btn")));
  if(st.llego&&st.aMano) botones.push(React.createElement("button",{type:"button",key:"dm",className:"pr6-btn","data-act":"desmarcar",onClick:desmarcar},t("pr6_desmarcar")));
  if(st.llego&&!st.aMano) botones.push(React.createElement("button",{type:"button",key:"no",className:"pr6-btn","data-act":"no-es",onClick:function(){ setRechazo(true); setElegido(null); setOtros(false); setQ(""); setPaso(1); }},t("fl_no_es")));
  botones.push(React.createElement("button",{type:"button",key:"ed",className:"pr6-btn","data-act":"editar",onClick:function(){ onEdit(f.id); }},t("pr6_editar")));
  const fichaPanel=React.createElement("div",{className:"pr6-step"+(paso===0?" on":""),"aria-hidden":paso===0?null:"true",inert:paso===0?undefined:""},
    React.createElement("div",{className:"pr6-ficha-h"},
      React.createElement("span",{className:"pr6-dt","aria-hidden":"true"},
        React.createElement("span",{className:"d serif num"}, (st.llego?st.day:dayF)||"—"),
        React.createElement("span",{className:"m"}, monthShort(m-1))),
      React.createElement("span",{className:"pr6-ficha-t"},
        React.createElement("span",{id:titleId,ref:titleRef,tabIndex:-1,className:"pr6-ficha-n"}, row.name),
        React.createElement("span",{className:"pr6-ficha-s"}, sub)),
      React.createElement("span",{className:"serif num pr6-ficha-a"+(tr?"":" pos"),"data-testid":"flujo-importe"}, (tr?"":"+")+eur(target))),
    late&&React.createElement("div",{className:"pr6-nota","data-testid":"flujo-nota"}, tf("pr6_nota_late",{d:dayF})),
    st.llego&&st.aMano&&React.createElement("div",{className:"pr6-cargo","data-testid":"flujo-a-mano"},
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, t("pr6_a_mano")),
        React.createElement("span",{className:"pr6-cand-s"}, st.day+" "+monthShort(m-1)+" · "+t("fl_sin_mov").toLowerCase())),
      React.createElement("span",{className:"pr6-ring on","aria-hidden":"true"},"✓")),
    movBanco&&React.createElement("div",{className:"pr6-cargo","data-testid":"flujo-mov"},
      React.createElement(Mono,{ent:movBanco,size:34}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, movTxt||entOf(movBanco).label),
        React.createElement("span",{className:"pr6-cand-s"}, (st.day!=null?st.day+" "+monthShort(m-1)+" · ":"")+entOf(movBanco).label+(st.amount>0&&Math.round(st.amount*100)!==Math.round(target*100)?" · "+eur(st.amount):""))),
      React.createElement("span",{className:"pr6-ring on","aria-hidden":"true"},"✓")),
    React.createElement("div",{className:"pr6-btns pr6-acts"},botones));
  const lista=qq?encontrados:cands.concat(otros||!cands.length?recientes:[]);
  const elegirPanel=React.createElement("div",{className:"pr6-step"+(paso===1?" on":""),"aria-hidden":paso===1?null:"true",inert:paso===1?undefined:""},
    React.createElement("div",{className:"pr6-pick-h"},
      React.createElement("button",{type:"button",className:"pr6-back","aria-label":t("v4_back"),onClick:function(){ setPaso(0); }},"‹"),
      React.createElement("span",{className:"pr6-ficha-t"},
        React.createElement("span",{className:"serif pr6-pick-t"}, t(tr?"fl_cual_tr":"fl_cual")),
        React.createElement("span",{className:"pr6-ficha-s"}, row.name+" · "+eur(target)))),
    React.createElement("label",{className:"pr6-mg-q pr6-pick-q"},
      React.createElement("svg",{width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round","aria-hidden":"true"},
        React.createElement("circle",{cx:11,cy:11,r:7}),React.createElement("path",{d:"M20 20l-3.5-3.5"})),
      React.createElement("input",{className:"pr6-mg-qi",type:"search",value:q,placeholder:t("pr6_buscar_cargo"),"aria-label":t("pr6_buscar_cargo"),
        onChange:function(e){ setQ(e.target.value); }})),
    !qq&&!cands.length&&recientes.length>0&&React.createElement("div",{className:"pr6-lbl"}, tf("fl_otros",{bank:entOf(bank).label})),
    React.createElement("div",{className:"pr6-cands","data-testid":"flujo-movs"}, lista.map(movRow)),
    !lista.length&&React.createElement("div",{className:"pr6-empty"}, qq?tf("pr6_sin_resultados",{q:q.trim()}):tf("fl_sin_movs",{bank:entOf(bank).label})),
    !qq&&cands.length>0&&recientes.length>0&&React.createElement("button",{type:"button",className:"pr6-more",onClick:function(){ setOtros(function(o){ return !o; }); }},
      otros?t("fl_menos"):tf("fl_otros",{bank:entOf(bank).label})),
    !rechazo&&React.createElement("button",{type:"button",className:"pr6-btn pr6-btn-wide","data-act":"a-mano",onClick:aMano},t(tr?"fl_otra_forma_tr":"fl_otra_forma")),
    rechazo&&React.createElement("button",{type:"button",className:"pr6-btn pr6-btn-wide","data-act":"aun-no",onClick:aunNo},t("fl_aun_no")));
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet pr6-ficha","data-sheet":"flujo",role:"dialog","aria-modal":"true","aria-labelledby":titleId,
        ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{ref:trackRef,className:"pr6-track"+(paso===1?" pick":"")}, fichaPanel, elegirPanel))),
    document.body);
}

/* §2 variante A: `.settings-push` hub. Reconcile → BankPanel (Claude). */
function gbTxt(key, vars){
  // Las claves ya viven en LANG.es/en/ca; conservar el antiguo respaldo castellano duplicaba
  // texto y podía tapar una traducción ausente en vez de dejar que i18n-keys la detectase.
  return vars?tf(key,vars):t(key);
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

/* §2 variante A: `.settings-push` hub. Reconcile → BankPanel (Claude).
   Ajustes dispara `mc-open-bills` → PlanTab abre este push con state vivo (no snapshot). */
// El acuse no viaja al JSON ni a la nube: solo identifica el resultado que React comprometió.
const BILL_UNDO_COMMIT=Symbol("bill-undo-commit"), billUndoUploads=new Map();
function billUndoCopy(x){
  if(!x||typeof x!=="object") return x;
  if(Array.isArray(x)) return x.map(billUndoCopy);
  const out={}; Object.keys(x).forEach(function(k){ Object.defineProperty(out,k,{value:billUndoCopy(x[k]),enumerable:true,writable:true,configurable:true}); }); return out;
}
function billUndoPeriod(s){ return {day:madridYmdParts(Date.now()),month:startOfMonth().getTime(),start:budgetPeriodOf(s).startMs}; }
function billUndoReview(s,id){
  const rows=(s.fixed||[]).filter(function(x){ return x.id===id; });
  if(rows.length!==1||(s.oneoffs||[]).some(function(x){ return x.id===id; })) return null;
  const item=rows[0],ids=(item.reparto||[]).filter(function(x){ return x.via==="debt"; }).map(function(x){ return x.debtId; });
  const debts=(s.debts||[]).filter(function(d){ return ids.indexOf(d.id)>=0; });
  if(new Set(debts.map(function(d){ return d.id; })).size!==debts.length) return null;
  return billUndoCopy({owner:s._historyOwner||null,simple:!!(s.settings&&s.settings.simpleMode),item:item,debts:debts,fixed:(s.fixed||[]).filter(function(f){ return f.id===id||(f.reparto||[]).some(function(x){ return ids.indexOf(x.debtId)>=0; }); }),period:billUndoPeriod(s)});
}
function billUndoExpense(e){
  // Las etiquetas pueden cambiar sin que el cargo deje de ser el mismo; nunca se reponen.
  const out=billUndoCopy(e); ["category","cat","note","tags","noteEdited","categoryEdited"].forEach(function(k){ delete out[k]; }); return out;
}
function billUndoRemove(s,review,fixes,now){
  if(!review||!goalSyncEqual(review,billUndoReview(s,review.item.id))) return {state:s,error:true};
  const r=sinCargoDelPlan(s,"fixed",review.item.id,now),next=conDescuentoFijado(fixes,deudasTrasReparto(s,r.state));
  const preserve=!!r.subir.length||(s.expenses||[]).some(function(e){ return e.reciboId===review.item.id&&dateMs(e.date)>=startOfMonth().getTime()&&cargoDeRecibo(e,s); });
  const debts=[];
  (next.debts||[]).forEach(function(d){
    const before=(s.debts||[]).find(function(x){ return x.id===d.id; });
    // Cancelar el ajuste deja delta vacío, pero esa deuda sigue vinculada al recibo.
    if(!before||(goalSyncEqual(before,d)&&!review.debts.some(function(x){ return x.id===d.id; }))) return;
    const fields=[];
    Array.from(new Set(Object.keys(before).concat(Object.keys(d)))).forEach(function(k){
      const had=Object.prototype.hasOwnProperty.call(before,k),has=Object.prototype.hasOwnProperty.call(d,k);
      if(had!==has||!goalSyncEqual(before[k],d[k])) fields.push({key:k,had:had,value:billUndoCopy(before[k])});
    });
    debts.push({id:d.id,after:billUndoCopy(d),fields:fields});
  });
  // Un vínculo huérfano también cuenta: reponerlo no debe descontar sobre una deuda nueva.
  Array.from(new Set((review.item.reparto||[]).filter(function(x){ return x.via==="debt"; }).map(function(x){ return x.debtId; }))).forEach(function(id){
    if(!debts.some(function(d){ return d.id===id; })) debts.push({id:id,after:null,fields:[]});
  });
  // SinCargo ya compensa las marcas; se evalúa de nuevo desde la cuenta ACTUAL con el delta
  // completo, pues la cuota aceptada también entra en el saldo de una cuenta de fijos ya cobrada.
  const balanced=preserve?conSaldoMostrado(s,Object.assign({},next,{accounts:s.accounts})):next;
  return {state:balanced,subir:r.subir,undo:{owner:review.owner,item:billUndoCopy(review.item),debts:debts,expenses:r.subir.map(billUndoExpense),preserveBalance:preserve,period:billUndoPeriod(s),tomb:billUndoCopy(next.reciboBorrado[review.item.id]),at:next.reciboBorradoAt[review.item.id]}};
}
function billUndoRestore(s,undo,now){
  const id=undo.item.id;
  if((s._historyOwner||null)!==undo.owner||!goalSyncEqual(undo.period,billUndoPeriod(s))||(s.fixed||[]).concat(s.oneoffs||[]).some(function(f){ return f.id===id; })||
    !goalSyncEqual(s.reciboBorrado&&s.reciboBorrado[id],undo.tomb)||!s.reciboBorradoAt||s.reciboBorradoAt[id]!==undo.at) return {state:s,error:true};
  // Todo o nada: validar antes de reponer el recibo, marcas o compensaciones de saldo.
  if(undo.debts.some(function(d){
    const rows=(s.debts||[]).filter(function(x){ return x.id===d.id; });
    return d.after===null?rows.length!==0:rows.length!==1||!goalSyncEqual(rows[0],d.after);
  })) return {state:s,error:true};
  let skipped=false;
  const safe=undo.expenses.filter(function(e){
    const rows=(s.expenses||[]).filter(function(x){ return x.id===e.id; });
    const ok=rows.length===1&&goalSyncEqual(billUndoExpense(rows[0]),e)&&admiteMarcaDe(rows[0],undo.item)&&
      !expenseIsTombstoned(rows[0],expenseDeletedSet(s))&&!reciboVetado(s,id,reciboNoIdentidad(rows[0]),rows[0].id)&&
      !(s.expenses||[]).some(function(x){ return x.id!==e.id&&x.ent===e.ent&&x.date===e.date&&x.amount===e.amount&&x.merchant===e.merchant; });
    if(!ok) skipped=true; return ok;
  }).map(function(e){ return e.id; });
  const guarded=Object.assign({},s,{reciboBorrado:Object.assign({},s.reciboBorrado,{[id]:Object.assign({},undo.tomb,{x:safe})})});
  const r=conReciboEnPlan(guarded,"fixed",billUndoCopy(undo.item),now);
  let changed=false;
  const debts=(s.debts||[]).map(function(d){
    const delta=undo.debts.find(function(x){ return x.id===d.id; });
    if(!delta||!delta.fields.length) return d;
    const restored=Object.assign({},d); delta.fields.forEach(function(f){ if(f.had) restored[f.key]=billUndoCopy(f.value); else delete restored[f.key]; });
    changed=true; return restored;
  });
  const next=changed?Object.assign({},r.state,{debts:debts}):r.state;
  const balanced=undo.preserveBalance?conSaldoMostrado(s,Object.assign({},next,{accounts:s.accounts})):next;
  return {state:balanced,subir:r.subir,skipped:skipped};
}
function billUndoSend(rows,owner){
  if(!cloud.enabled()||!owner||mcSandbox()) return Promise.resolve();
  return Promise.all((rows||[]).map(function(e){
    // La puerta existente busca por estos campos, no por id: retirar y reponer van en ese orden.
    const key=JSON.stringify([owner,e.ent,e.date,e.amount,e.merchant]);
    const next=(billUndoUploads.get(key)||Promise.resolve()).catch(function(){}).then(function(){
      return cloud.session().then(function(session){ if(!session||session.user.id!==owner) throw new Error("bill-undo-owner"); return cloud.setExpenseRecibo(e); });
    });
    billUndoUploads.set(key,next);
    next.catch(function(){}).then(function(){ if(billUndoUploads.get(key)===next) billUndoUploads.delete(key); });
    return next;
  }));
}
function useBillUndo(state,set,open,onRemoved,onNotice){
  const [pending,setPending]=React.useState(null);
  const committed=React.useRef(state),life=React.useRef(false),visible=React.useRef(open),busy=React.useRef(null),token=React.useRef(null);
  React.useLayoutEffect(function(){ life.current=true; return function(){
    life.current=false; if(busy.current) busy.current.cancelled=true; busy.current=null; token.current=null;
  }; },[]);
  React.useLayoutEffect(function(){
    committed.current=state; visible.current=open;
    if(pending&&!pending.operation.done){
      const operation=pending.operation;
      if(operation.until!=null&&Date.now()>=operation.until) operation.cancelled=true;
      if(!pending.submitted&&open&&life.current&&!operation.cancelled){
        // Solo la intención viaja en transición. Escribir desde este layout impide que React
        // reutilice un cálculo eager encolado después de que la hoja se haya cerrado.
        setPending(Object.assign({},pending,{submitted:true}));
        set(function(s){
          if(operation.cancelled) return s;
          const r=pending.calculate(s); if(r.state===s) return s;
          return Object.assign({},r.state,{[BILL_UNDO_COMMIT]:{operation:operation,owner:s._historyOwner||null,undo:r.undo,subir:r.subir,skipped:r.skipped}});
        });
      } else {
        const ack=state[BILL_UNDO_COMMIT]; operation.done=true;
        if(busy.current===operation) busy.current=null;
        setPending(null);
        if(pending.submitted&&ack&&ack.operation===operation){
          billUndoSend(ack.subir,ack.owner).catch(function(){ if(life.current&&visible.current) onNotice("gb_undo_sync_error"); });
          if(open&&life.current){
            if(operation.kind==="remove"){
              const tkn={undo:ack.undo,until:Date.now()+5000}; token.current=tkn; onRemoved(tkn);
            } else if(ack.skipped) onNotice("gb_undo_partial");
          }
        } else if(open&&life.current&&!operation.cancelled) onNotice(operation.kind==="remove"?"gb_remove_changed":null,operation.kind==="remove");
      }
    }
    if(!open){ if(busy.current) busy.current.cancelled=true; busy.current=null; token.current=null; }
  });
  const submit=function(operation,calculate){
    React.startTransition(function(){ setPending({operation:operation,calculate:calculate,submitted:false}); });
  };
  return {
    // El host de Plan sigue montado después de quitar: solo un cierre explícito cancela su intención.
    cancel:function(){ if(busy.current) busy.current.cancelled=true; busy.current=null; token.current=null; },
    remove:function(id){
      if(busy.current||!life.current||!visible.current) return;
      const operation={kind:"remove"},review=billUndoReview(committed.current,id); busy.current=operation;
      if(!review){ busy.current=null; onNotice("gb_remove_changed",true); return; }
      descuentoPregunta(committed.current,function(s){ return deudasTrasReparto(s,Object.assign({},s,{fixed:(s.fixed||[]).filter(function(f){ return f.id!==id; })})); }).then(function(fixes){
        if(!life.current||!visible.current||busy.current!==operation) return;
        const now=Date.now(); submit(operation,function(s){ return billUndoRemove(s,review,fixes,now); });
      }).catch(function(){ if(busy.current===operation){ busy.current=null; if(life.current&&visible.current) onNotice("gb_remove_changed",true); } });
    },
    undo:function(tkn){
      if(busy.current||!tkn||token.current!==tkn||!life.current||!visible.current) return false;
      token.current=null; if(Date.now()>=tkn.until) return true;
      const operation={kind:"undo",until:tkn.until},now=Date.now(); busy.current=operation;
      submit(operation,function(s){ return billUndoRestore(s,tkn.undo,now); });
      return true;
    }
  };
}
function BillUndoToast({onUndo,notice}){
  return React.createElement("div",{className:"v4-undo-toast"+(notice?" v4-bills-saved":""),role:"status","data-testid":notice?"bills-saved":undefined},
    React.createElement("span",null,notice||gbTxt("gb_removed")),
    onUndo&&React.createElement("button",{type:"button",onClick:onUndo},t("f_undo")||"Deshacer"));
}
function BillsManagePush({open, onClose, state, set, totals, simple, editId, addNow, onGoDebts, ensayo}){
  // En el ensayo en seco (`mcEnsayar`) se pinta igual, pero no toca <html>, el foco ni el Atrás.
  const vivo=!!open&&!ensayo;
  const [q,setQ]=React.useState("");
  // Tus recibos (SPEC §3): cifras al año, banco elegido en los chips, secciones desplegadas y el aviso que se va.
  const [anual,setAnual]=React.useState(false);
  const [banco,setBanco]=React.useState(null);
  const [abiertos,setAbiertos]=React.useState({});
  const [solapeSale,setSolapeSale]=React.useState(null);
  const [detail,setDetail]=React.useState(null);
  const [reviewBill,setReviewBill]=React.useState(null);
  const [addStep,setAddStep]=React.useState(null);
  // Hoja por pasos (tanda 4): {mode:"add"|"edit", row?, once?, n}. Recibos y puntuales; los
  // ingresos y el modo sencillo siguen con el alta y la ficha de antes.
  const [pasos,setPasos]=React.useState(null);
  // Ficha de persona (tanda 5): {pid} para una que ya está en recibos, {} para una nueva.
  const [persona,setPersona]=React.useState(null);
  const [addForm,setAddForm]=React.useState({name:"",amount:"",freq:"mes",months:[],day:"",when:"",account:"sabadell",kind:"fixed"});
  const [undoBill,setUndoBill]=React.useState(null);
  const undoTimer=React.useRef(null);
  const [savedBill,setSavedBill]=React.useState(null);
  const fixedUndo=useBillUndo(state,set,open,function(token){
    editOnly.current=false; setDetail(null); setPasos(null);
    if(undoTimer.current) clearTimeout(undoTimer.current);
    const snap={kind:"fixed",token:token}; setUndoBill(snap);
    undoTimer.current=setTimeout(function(){ setUndoBill(function(current){ return current===snap?null:current; }); undoTimer.current=null; },5000);
  },function(key,finish){
    if(finish){ editOnly.current=false; setDetail(null); setPasos(null); }
    setSavedBill({msg:t(key||"gb_undo_changed")});
  });
  const rootRef=React.useRef(null);
  const titleRef=React.useRef(null);
  const prevFocus=React.useRef(null);
  const popRef=React.useRef(null);
  const detailRef=React.useRef(null);
  const addStepRef=React.useRef(null);
  const openerRef=React.useRef(null);
  const hadSheetRef=React.useRef(false);
  const pageSwipe=useEdgePageClose(vivo,onClose,!detail&&!addStep&&!pasos&&!persona,rootRef,{plainScroll:true});
  const cm=totals.curMonth, cy=totals.curYear;
  // Ola nativa (INC-2709-03, 19/10): Android solo la pinta en el scroller RAÍZ, y Chromium
  // promociona un `fixed` a pantalla completa como raíz implícita SOLO si es el único candidato
  // (RootScrollerController: «only promote if we have a unique match»). Con Gestionar abierto
  // seguían desplazables debajo el host de Plan (y Ajustes si se entró desde ahí): dos o tres
  // candidatos → ninguno raíz → sin ola. Lo de debajo deja de desplazar mientras esto está
  // abierto; `overflow:hidden` conserva su scrollTop para la vuelta.
  /* La barra de abajo se queda a la vista, como en el prototipo (N8, decisión del dueño 10/11/2026).
     Vive dentro de `.app-shell`, que con temporada es su propio contexto de apilamiento (z 1): por
     mucho z-index que lleve no puede pasar por encima de esto, que cuelga de <body>. App la saca a
     <body> mientras dura `mc-bills-open`; sigue sin transform ni desenfoque, así que no corta la ola.
     Tocar una pestaña la cierra: sin eso se quedaba encima de la pestaña nueva. */
  const closeTabRef=React.useRef(null);
  React.useEffect(function(){
    if(!vivo) return undefined;
    var h=document.documentElement;
    h.classList.add("bills-open");
    try{ window.dispatchEvent(new CustomEvent("mc-bills-open",{detail:true})); }catch(e){}
    // En captura, antes que el cambio de pestaña: la activa (Plan) cierra deslizando, otra de golpe.
    var onTab=function(ev){
      var b=ev.target&&ev.target.closest&&ev.target.closest(".botnav-tab");
      if(b&&closeTabRef.current) closeTabRef.current(b.classList.contains("active"));
    };
    document.addEventListener("click", onTab, true);
    return function(){
      h.classList.remove("bills-open");
      document.removeEventListener("click", onTab, true);
      try{ window.dispatchEvent(new CustomEvent("mc-bills-open",{detail:false})); }catch(e){}
    };
  },[vivo]);
  React.useEffect(function(){
    if(!open){
      editOnly.current=false;
      setQ(""); setAnual(false); setBanco(null); setAbiertos({}); setSolapeSale(null); setDetail(null); setAddStep(null); setPasos(null); setPersona(null);
      if(undoTimer.current){ clearTimeout(undoTimer.current); undoTimer.current=null; }
      setUndoBill(null);
      setSavedBill(null);
    }
  },[open]);
  React.useEffect(function(){
    return function(){ if(undoTimer.current) clearTimeout(undoTimer.current); };
  },[]);
  React.useEffect(function(){
    if(!savedBill) return undefined;
    const id=setTimeout(function(){ setSavedBill(null); },4500);
    return function(){ clearTimeout(id); };
  },[savedBill]);
  const pop=React.useCallback(function(){
    if(detail){ setDetail(null); return; }
    if(addStep){ setAddStep(null); return; }
    if(pasos){ setPasos(null); return; }
    pageSwipe.close();
  },[detail, addStep, pasos]);
  popRef.current=pop; detailRef.current=detail; addStepRef.current=addStep||pasos||persona;
  // Con la misma pestaña (Plan) se cierra deslizando, como el ‹; con otra, de golpe: la pestaña nueva ya entra.
  closeTabRef.current=function(anim){ editOnly.current=false; if(anim) pageSwipe.close(); else onClose(); };
  /* «Editar» desde la ficha de Recibos (v6): entra directo en la edición de ESE recibo y, al
     cerrarla, vuelve a Recibos en vez de dejarte en Todos, que nadie había pedido abrir. */
  const editOnly=React.useRef(false);
  const onCloseRef=React.useRef(onClose); onCloseRef.current=onClose;
  React.useEffect(function(){
    if(!open||editId==null) return;
    // También lo que entra y lo que mueves: «Editar» de su ficha en Recibos llega aquí igual.
    const r=billsGroupRows(state,"serv",cm,cy).concat(billsGroupRows(state,"prox",cm,cy),billsGroupRows(state,"in",cm,cy))
      .find(function(x){ return String(x.id)===String(editId); });
    if(r){ editOnly.current=true; abrirFila(r); }
  },[open,editId]);
  /* «Empezar» del primer uso sin cargos en el banco (SPEC §9): directo al alta por pasos y, al
     cerrarla, de vuelta a Recibos, igual que «Editar» desde la ficha. */
  React.useEffect(function(){
    if(!open||!addNow||simple) return;
    editOnly.current=true;
    setPasos({mode:"add",once:false,n:addNow});
  },[open,addNow]);
  const closeDetail=React.useCallback(function(){
    setDetail(null);setReviewBill(null);
    if(editOnly.current){ editOnly.current=false; onCloseRef.current(); }
  },[]);
  const closeAdd=React.useCallback(function(){ setAddStep(null); },[]);
  const closePasos=React.useCallback(function(){
    setPasos(null);
    if(editOnly.current){ editOnly.current=false; onCloseRef.current(); }
  },[]);
  /* Un recibo o un puntual se edita en la hoja por pasos; con un conflicto de sincronización
     pendiente, la ficha de antes, que es la que sabe revisarlo. */
  const abrirFila=function(r){
    if(!simple&&(r.kind==="fixed"&&!planSyncConflict(state,"fixed",r.id)||r.kind==="oneoff"||r.kind==="flow")){ setPasos({mode:"edit",row:r,n:Date.now()}); return; }
    setDetail(r);
  };
  useBackClose(vivo, pop);
  // Dialog a11y: foco inicial/restore SOLO al abrir/cerrar el hub (deps=[open]).
  // Si remonta al cambiar detail/addStep, el cleanup restaura foco y el rAF roba el h1
  // detrás de la ficha (Claude BAJA + Codex 2100Z).
  React.useEffect(function(){
    if(!vivo) return undefined;
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
      /* Sin desplazar (vídeo del dueño, 11/11): «Todos» vive en Plan, y si al cerrar con un
         desliz rápido el dedo ya iba hacia otra pestaña, el foco a pelo hacía que el navegador
         desplazara `.viewport` de lado para enseñarlo y asomaba Cartera a medio carrusel. */
      if(el&&typeof el.focus==="function") try{ el.focus({preventScroll:true}); }catch(err){}
    };
  },[vivo]);
  // Al cerrar ficha/alta: devolver foco al control que las abrió (Codex 2100Z).
  React.useEffect(function(){
    var sheet=!!(detail||addStep||pasos);
    if(hadSheetRef.current&&!sheet&&open){
      var el=openerRef.current;
      var id=requestAnimationFrame(function(){
        if(el&&typeof el.focus==="function"&&(!rootRef.current||rootRef.current.contains(el))){
          // Sin desplazar: con las secciones en la misma pantalla, el foco devuelto movía la lista
          // hasta el «Añadir» o la fila tocada al cerrar la hoja.
          try{ el.focus({preventScroll:true}); }catch(err){}
        }
      });
      hadSheetRef.current=false;
      return function(){ cancelAnimationFrame(id); };
    }
    hadSheetRef.current=sheet;
    return undefined;
  },[detail, addStep, pasos, open]);
  /* Tus recibos (SPEC §3, prototipo del 26/10): secciones planas en vez de los grupos de la v4.1
     que abrían otra pantalla. Las filas salen de `billsGroupRows` y cada sección suma su
     `monthly`, la misma cuenta que `billsHeroTotal`: la cifra de arriba ES la suma de Recibos y
     Cuotas, no otra fórmula que pueda descuadrarse. El banco filtra también la cifra; buscar no.
     Un pausado (`r.paused`) se queda en la lista, atenuado y con «pausado hasta X», pero no suma
     (P2-9, decisión del dueño 10/11/2026): sumarlo prometía un gasto que ese mes no llega.
     Al año cada fila pone lo suyo de los próximos doce meses (`r.anual`, sin los cobros de la
     pausa) y la cifra sigue siendo la suma de las secciones, que suman eso mismo (P2-b). */
  /* Las filas se calculan una vez por estado: desplegar una sección, abrir una hoja encima o montar
     el resto de la pantalla repintan esto con el MISMO `state`, y cada repintado volvía a recorrer
     todos los recibos, cuotas y traspasos (la mitad de lo que tardaba este componente al abrir
     «Editar», perfil a ×6 del 10/11/2026). */
  const todas=React.useMemo(function(){
    if(!open) return null;
    const de=function(g){ return billsGroupRows(state,g,cm,cy); };
    return {serv:de("serv").sort(function(a,b){ return (cleanDay(a.item.day)||32)-(cleanDay(b.item.day)||32); }),
      debt:de("debt").sort(function(a,b){ return (cleanDay(a.item.day)||32)-(cleanDay(b.item.day)||32); }),once:de("prox"),"in":de("in")};
  },[open,state,cm,cy]);
  const mg=todas?(function(){
    const pasa=function(r){ return !banco||r.bank===banco; };
    const bancos=[];
    ["serv","debt","once","in"].forEach(function(g){ todas[g].forEach(function(r){ if(r.bank&&bancos.indexOf(r.bank)<0) bancos.push(r.bank); }); });
    const filtradas={}, suma={};
    const cuanto=function(r){ const m=Math.abs(Number(r.monthly)||0); return anual?(r.anual!=null?r.anual:m*12):(r.paused?0:m); };
    Object.keys(todas).forEach(function(g){
      filtradas[g]=todas[g].filter(pasa);
      suma[g]=filtradas[g].reduce(function(a,r){ return a+Math.round(cuanto(r)*100); },0)/100;
    });
    return {todas:todas,filas:filtradas,suma:suma,bancos:bancos.length>1?bancos:[]};
  })():null;
  /* La cifra va directa, sin contar: al cambiar de mes a año o de banco pasaba casi un segundo por
     cifras que no existen (1.987,95 €, 277,65 €…) y cada paso repintaba la pantalla entera
     (auditoría 216, N4). El cambio lo marca el fundido de `.pr6-mg-sum .pr6-big`. */
  const hero=mg?Math.round((mg.suma.serv+mg.suma.debt)*100)/100:0;
  /* Lo que queda por debajo de la primera pantalla se monta un fotograma después: abrir Tus recibos
     maquetaba ~500 nodos de golpe y, con la CPU a ×6, ese fotograma pasaba de 120 ms (P1-13). La
     pantalla entra de lado, así que lo de abajo llega antes de que se vea. */
  const [resto,setResto]=React.useState(!!ensayo);
  React.useEffect(function(){
    if(!open){ setResto(false); return undefined; }
    let id=requestAnimationFrame(function(){ id=requestAnimationFrame(function(){ setResto(true); }); });
    return function(){ cancelAnimationFrame(id); };
  },[open]);
  if(!open) return null;
  const banks=Array.from(new Set((state.accounts||[]).map(function(a){ return a.ent; }).filter(Boolean)));
  if(!banks.length) banks.push("sabadell");
  const billBanks=(state.accounts||[]).filter(function(a){
    const r=accRole(a); return r==="fijos"||r==="ambos"||!a.role;
  });
  const bankList=billBanks.length?billBanks.map(function(a){ return a.ent; }):banks;
  const personas=personasDe(state);
  const openDetail=function(row){
    openerRef.current=document.activeElement;
    setSavedBill(null);
    abrirFila(row);
  };
  const startAdd=function(kind,nombre){
    openerRef.current=document.activeElement;
    setSavedBill(null);
    if(!simple&&(kind==="fixed"||kind==="oneoff"||kind==="flow")){ setPasos({mode:"add",once:kind==="oneoff",flujo:kind==="flow",nombre:nombre||"",n:Date.now()}); return; }
    setAddForm({name:nombre||"",amount:"",freq:"mes",months:[],day:"",when:"",account:bankList[0]||"sabadell",kind:kind||"fixed",
      month:cm, year:cy, flowKind:"income"});
    setAddStep("what");
  };
  const confirmSaved=function(kind,name,msg){
    // El toast global decía solo «Guardado» mientras el alta se iba: aquí queda visible
    // qué se añadió en la pantalla de Recibos, también al salir de una lista hija.
    setSavedBill({kind:kind,name:name,msg:msg||null});
  };
  const removeWithUndo=function(row){
    setSavedBill(null);
    if(row.kind==="fixed"){ fixedUndo.remove(row.id); return; }
    const snap={kind:row.kind, item:Object.assign({},row.item)};
    if(row.kind==="flow") removeFlowById(set,row.id);
    else if(row.kind==="oneoff") removeOneoffById(set,row.id);
    else return;
    // Tras borrar se queda en Todos: ahí está el «Deshacer».
    editOnly.current=false;
    setDetail(null); setPasos(null);
    if(undoTimer.current) clearTimeout(undoTimer.current);
    setUndoBill(snap);
    undoTimer.current=setTimeout(function(){ setUndoBill(null); undoTimer.current=null; },5000);
  };
  const undoLastBill=function(){
    if(!undoBill) return;
    if(undoBill.kind==="fixed"&&fixedUndo.undo(undoBill.token)===false) return;
    if(undoTimer.current){ clearTimeout(undoTimer.current); undoTimer.current=null; }
    if(undoBill.kind==="flow") addFlowItem(set,undoBill.item);
    else if(undoBill.kind==="oneoff") addOneoffItem(set,undoBill.item);
    setUndoBill(null);
  };
  /* Buscar por nombre (sin acentos) o por el principio del importe («39,9» encuentra 39,90 €),
     como el prototipo. Mientras se busca, todo a la vista y sin avisos ni personas. */
  const sinTilde=function(x){ return String(x||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); };
  const qq=sinTilde(q.trim());
  const casa=function(r){
    if(!qq) return true;
    if(sinTilde(r.name).indexOf(qq)>=0) return true;
    if(!/^[\d.,]+$/.test(qq)) return false;
    // «4.99» y «4,99» son lo mismo para quien busca (el teclado del móvil pone uno u otro), y
    // «1.250» es mil doscientos cincuenta: se prueban las dos lecturas del separador.
    // También por lo que cobra el banco: en un compartido es lo que sale en el extracto, no tu parte
    // («29,94» no encontraba el YouTube de 4,99 €; auditoría 226).
    return [r.monthly,r.item&&r.item.bankAmount,r.cash].some(function(v){
      if(!(Math.abs(Number(v))>0)) return false;
      const a=Math.abs(Number(v)).toFixed(2);
      return a.indexOf(qq.replace(/\./g,"").replace(",","."))===0||a.indexOf(qq.replace(/,/g,""))===0;
    });
  };
  const lower=function(x){ return CURLANG==="en"?x:String(x).toLowerCase(); };
  const amt=function(x,variable){ return (variable?"≈ ":"")+eur(x); };
  // El próximo cobro de un recibo (de este mes en adelante): su día, su mes y su importe.
  const proximo=function(e){
    for(let i=0;i<12;i++){
      const m=(cm-1+i)%12+1, y=cy+Math.floor((cm-1+i)/12);
      if(occursIn(e,m,y)) return {m:m,y:y,day:cleanDay(dayIn(e,m,y)),amt:occAmountIn(e,m,y)};
    }
    return {m:cm,y:cy,day:cleanDay(e.day),amt:Number(e.amount)||0};
  };
  const fila=function(r){
    const e=r.item||{};
    if(r.kind==="fixed"){
      const nx=proximo(e), sch=hasSchedule(e), anualF=e.freq==="año"||e.freq==="anual";
      // `lower` respeta el inglés por los meses; la frecuencia va a mitad de frase y en inglés salía
      // «Sabadell · Once a year» (auditoría 4.26.218).
      const fr=sch?pr6Lista(e.schedule.slice().sort(function(a,b){ return a.m-b.m; }).map(function(x){ return (cleanDay(x.day)||"—")+" "+lower(monthShort(x.m-1)); }))
        :(e.freq&&e.freq!=="mes"&&e.freq!=="mensual"?gbTxt((RP4_FREQS.find(function(f){ return f[0]===e.freq; })||[0,"gb_freq_y"])[1]).toLowerCase():"");
      const pausa=pr6PausaTxt(r,cy*12+cm);
      return {d1:nx.day||"—",d2:sch||anualF?monthShort(nx.m-1):t("mg_dia"),paused:!!pausa,
        sub:pausa||[e.category&&CAT[e.category]?pr6CatDe(catName(e.category),e.name):"",entOf(r.bank).label,fr,repartoVigente(e)?t("mg_compartido"):""].filter(Boolean).join(" · "),
        amt:amt(anual?r.anual:nx.amt,e.variable)};
    }
    if(r.kind==="debt"){
      const from=r.descuento>0?deudaDescuentoDe(state,e):[];
      // «Mamá · 197 € + 53 € de Pepephone» (SPEC §3): con lo que pone otro, el banco sobra y la
      // línea se partía en dos a 412 px (auditoría 216, P2-1).
      return {d1:cleanDay(e.day)||"—",d2:t("mg_dia"),
        sub:from.length?tf("mg_mas",{a:cycleMoney(r.cash),b:cycleMoney(r.descuento),from:pr6Lista(from)}):entOf(r.bank).label,
        amt:eur(anual?r.anual:Math.abs(Number(r.monthly)||0))};
    }
    if(r.kind==="oneoff") return {d1:cleanDay(e.day)||"—",d2:monthShort((Number(e.month)||cm)-1),
      sub:[e.category&&CAT[e.category]?pr6CatDe(catName(e.category),e.name):"",entOf(r.bank).label].filter(Boolean).join(" · "),amt:eur(Math.abs(Number(r.monthly)||0))};
    return {d1:cleanDay(e.day)||"—",d2:t("mg_dia"),income:r.income,
      sub:t(r.income?"fj_income_tag":"fj_transfer_tag")+" · "+entOf(r.bank).label,
      amt:(r.income?"+":"")+eur(Math.abs(Number(r.monthly)||0))};
  };
  const tocarFila=function(r){
    // Una cuota se cambia en Deudas (SPEC §3): se cierra esto y se llega a su tarjeta.
    if(r.kind==="debt"&&onGoDebts&&!simple){ const id=r.id; pageSwipe.close(); setTimeout(function(){ onGoDebts(id); },320); return; }
    openDetail(Object.assign({},r,r.kind==="debt"?{locked:!simple}:null));
  };
  const filaEl=function(r){
    const f=fila(r);
    return React.createElement("button",{type:"button",className:"v4-charge pr6-row v4-bills-row"+(f.paused?" pr6-mg-off":""),key:r.kind+"_"+r.id,
      "data-bill-id":r.id,"data-kind":r.kind,"aria-label":[r.name,f.sub,f.amt].filter(Boolean).join(" · "),onClick:function(){ tocarFila(r); }},
      React.createElement("span",{className:"dt","aria-hidden":"true"},
        React.createElement("span",{className:"d serif num"}, f.d1),
        React.createElement("span",{className:"m"}, f.d2)),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, r.name||"—",React.createElement(PlanConflictDot,{record:planSyncConflict(state,r.kind==="debt"?"debts":r.kind,r.id)})),
        React.createElement("span",{className:"sub"}, f.sub)),
      React.createElement("span",{className:"am serif num"+(f.income?" pos":"")}, f.amt));
  };
  const plus=React.createElement("svg",{width:15,height:15,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.6,strokeLinecap:"round","aria-hidden":"true"},
    React.createElement("path",{d:"M12 5v14M5 12h14"}));
  // `pr6Tres` pliega con un booleano; aquí cada sección guarda el suyo en `abiertos`.
  const abrirSec=function(id){ return function(fn){ setAbiertos(function(o){ return Object.assign({},o,{[id]:fn(!!o[id])}); }); }; };
  const seccion=function(id,titulo,derecha,add){
    const rows=mg.filas[id].filter(casa);
    if(!rows.length&&(qq||id!=="serv")) return null;
    return React.createElement("section",{className:"pr6-sec pr6-mg-sec",key:id,"data-mg-sec":id,"aria-label":titulo},
      React.createElement("div",{className:"pr6-sec-h"},
        React.createElement("span",{className:"pr6-mg-st"},
          React.createElement("span",null,titulo),
          React.createElement("span",{className:"pr6-mg-ss num","data-mg-sum":id}, derecha)),
        add&&React.createElement("button",{type:"button",className:"link pr6-mg-add","data-act":add.act,"aria-label":add.label,onClick:add.go}, plus,t("mg_anadir"))),
      // Buscando, todas las que casan: plegadas no se encontrarían.
      qq?rows.map(filaEl):pr6Tres(rows,filaEl,!!abiertos[id],abrirSec(id),"mg-mas-"+id,{"data-mg-more":id}));
  };
  const porMes=function(x){ return tf(anual?"mg_por_ano":"mg_por_mes",{x:eur(x)}); };
  const secciones=[
    seccion("serv",t("mg_recibos"),porMes(mg.suma.serv),{act:"bill-add",label:t("mg_add_recibo"),go:function(){ startAdd("fixed"); }}),
    seccion("debt",gbTxt("gb_g_debt"),porMes(mg.suma.debt),null),
    seccion("once",t("mg_una_vez"),t("mg_no_repiten"),{act:"bill-add-once",label:t("mg_add_once"),go:function(){ startAdd("oneoff"); }}),
    // Entradas y traspasos no están en el prototipo, pero solo aquí se dan de alta y se cambian:
    // sin esta sección se quedaban sin puerta (AGENTS §7). No suman a lo que se te va.
    seccion("in",gbTxt("gb_g_in"),gbTxt("gb_g_in_sub"),{act:"bill-add-flow",label:t("mg_add_flow"),go:function(){ startAdd("flow"); }})
  ].filter(Boolean);
  const nadaQ=!!qq&&secciones.length===0;
  /* Solapes (SPEC §3): detector prudente en 08 (`recibosSolapes`). La × lo guarda en `settings`
     como el resumen del mes cerrado, para que no vuelva en el otro móvil; si cambia qué recibos
     se solapan, la clave cambia y el aviso vuelve. */
  const solapesNo=(state.settings&&state.settings.recSolapesNo)||[];
  /* Con un banco elegido, solo los solapes y las personas de ese banco: «Spotify y YouTube» seguía
     con Revolut aunque YouTube se cobra en Sabadell (auditoría 216, N3). */
  const bancoDe={}; mg.todas.serv.forEach(function(r){ bancoDe[r.id]=r.bank; });
  const enBanco=function(id){ return !banco||bancoDe[id]===banco; };
  const solapes=qq?[]:recibosSolapes(state).filter(function(o){
    return solapesNo.indexOf(o.key)<0&&o.key.split(":")[1].split(",").every(enBanco);
  });
  const quitarSolape=function(o){
    setSolapeSale(o.key);
    setTimeout(function(){
      setSolapeSale(null);
      set(function(s){ const prev=(s.settings&&s.settings.recSolapesNo)||[]; if(prev.indexOf(o.key)>=0) return s;
        return Object.assign({},s,{settings:Object.assign({},s.settings||{},{recSolapesNo:prev.concat([o.key]).slice(-20)})}); });
    },mcReduced()?0:380);
  };
  const ICO_SOLAPE={musica:"M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z",series:"M4 5h16v11H4zM8 20h8M12 16v4"};
  const solapeEl=function(o){
    const n=o.nombres.length, lista=pr6Lista(o.nombres);
    const titulo=o.tipo==="musica"?tf("mg_ov_musica",{list:lista}):tf("mg_ov_series",{n:n,list:lista});
    const sub=tf(n===2?(o.tipo==="musica"?"mg_ov_m2":"mg_ov_v2"):(o.tipo==="musica"?"mg_ov_mn":"mg_ov_vn"),{x:eur(o.mensual),n:n});
    const sale=solapeSale===o.key;
    return React.createElement("div",Object.assign({className:"pr6-cz"+(sale?" fuera":""),key:o.key},sale?{"aria-hidden":"true",inert:""}:null),
      React.createElement("div",{className:"pr6-cz-in"},
        React.createElement("div",{className:"pr6-cerr pr6-mg-ov","data-solape":o.tipo},
          React.createElement("div",{className:"pr6-cerr-h"},
            React.createElement("span",{className:"pr6-cerr-ico","aria-hidden":"true"},
              React.createElement("svg",{width:16,height:16,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round"},
                React.createElement("path",{d:ICO_SOLAPE[o.tipo]}))),
            React.createElement("span",{className:"pr6-cerr-t"},
              React.createElement("span",{className:"pr6-cerr-n"}, titulo),
              React.createElement("span",{className:"num pr6-cerr-l"}, sub)),
            React.createElement("button",{type:"button",className:"pr6-cerr-x","aria-label":t("mg_ov_x"),"data-act":"solape-x",onClick:function(){ quitarSolape(o); }},
              React.createElement("svg",{width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
                React.createElement("path",{d:"M6 6l12 12M18 6L6 18"})))))));
  };
  // Personas (SPEC §3/§6): con quién compartes recibos; tocar abre su ficha, «Añadir» una nueva.
  const personasVer=personas.map(function(p){ return banco?Object.assign({},p,{recibos:p.recibos.filter(function(r){ return enBanco(r.id); })}):p; })
    .filter(function(p){ return p.recibos.length>0; });
  const personasEl=!qq&&(state.fixed||[]).length>0&&React.createElement("section",{className:"pr6-sec pr6-mg-sec","data-mg-sec":"people","aria-label":gbTxt("pe_title")},
    React.createElement("div",{className:"pr6-sec-h"},
      React.createElement("span",{className:"pr6-mg-st"},
        React.createElement("span",null,gbTxt("pe_title")),
        React.createElement("span",{className:"pr6-mg-ss"}, t("mg_personas_sub"))),
      React.createElement("button",{type:"button",className:"link pr6-mg-add","data-act":"persona-add","aria-label":gbTxt("pe_add"),
        onClick:function(){ openerRef.current=document.activeElement; setPersona({}); }}, plus,t("mg_anadir"))),
    personasVer.length>0&&React.createElement("div",{className:"pr6-mg-pl","data-testid":"pe-lista"},
      pr6Tres(personasVer,function(p){
        const total=p.recibos.reduce(function(a,r){ return a+Math.round(r.amt*100); },0)/100;
        const d=p.via==="debt"&&(state.debts||[]).find(function(o){ return o.id===p.debtId; });
        const sub=tf("mg_persona_sub",{list:pr6Lista(p.recibos.map(function(r){ return r.name; })),x:cycleMoney(total)})+(d?" · "+tf("mg_se_descuenta",{x:d.name}):"");
        return React.createElement("button",{type:"button",className:"pr6-mg-pe",key:p.id,"data-persona":p.id,"aria-label":p.n+" · "+sub,
          onClick:function(){ openerRef.current=document.activeElement; setPersona({pid:p.id}); }},
          React.createElement("span",{className:"pe-ava","aria-hidden":"true"}, pr6Inicial(p.n)),
          React.createElement("span",{className:"nm"},
            React.createElement("span",{className:"pr6-nm"}, p.n),
            React.createElement("span",{className:"sub"}, sub)),
          React.createElement("svg",{className:"pr6-mg-go",width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
            React.createElement("path",{d:"M9 6l6 6-6 6"})));
      },!!abiertos.people,abrirSec("people"),"mg-mas-people",{"data-mg-more":"people"})));
  const hub=React.createElement("div",{className:"v4-bills-hub","data-screen":"bills-home"},
    React.createElement("div",{className:"settings-push-h pr6-mg-h"},
      React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:pop},
        React.createElement("svg",{width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},
          React.createElement("path",{d:"M19 12H5M11 6l-6 6 6 6"}))),
      React.createElement("h1",{id:"bills-manage-title",tabIndex:-1,ref:titleRef}, gbTxt("gb_title"))),
    // Tocar la tarjeta pasa de lo de cada mes a lo del año (y vuelta), también en filas y secciones.
    React.createElement("button",{type:"button",className:"v4-card v4-card-hero pr6-sum pr6-mg-sum","data-bills-hero":"1","aria-pressed":anual?"true":"false",
      onClick:function(){ setAnual(function(a){ return !a; }); }},
      React.createElement("span",{className:"v4-micro pr6-mg-lbl"}, anual?t("mg_al_ano"):gbTxt("gb_hero_label"),
        React.createElement("svg",{width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},
          React.createElement("path",{d:"M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"}))),
      React.createElement("span",{className:"serif num pr6-big v4-bills-hero-amt","data-bills-total":"1",key:anual+"|"+(banco||"")}, eur(hero)),
      mg.suma.debt>0&&mg.suma.serv>0&&React.createElement("span",{className:"pr6-count num","data-bills-desglose":"1"},
        tf("mg_desglose",{a:eur(mg.suma.serv),b:eur(mg.suma.debt)}))),
    React.createElement("label",{className:"pr6-mg-q"},
      React.createElement("svg",{width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round","aria-hidden":"true"},
        React.createElement("circle",{cx:11,cy:11,r:7}),React.createElement("path",{d:"M20 20l-3.5-3.5"})),
      React.createElement("input",{type:"search",className:"pr6-mg-qi","data-bills-search":"1",value:q,placeholder:gbTxt("gb_search"),"aria-label":gbTxt("gb_search"),
        onChange:function(e){ setQ(e.target.value); }})),
    mg.bancos.length>0&&React.createElement("div",{className:"v4-chips pr6-mg-chips",role:"radiogroup","aria-label":t("mg_cuenta")},
      [null].concat(mg.bancos).map(function(b){
        const on=banco===b;
        return React.createElement("button",{type:"button",role:"radio","aria-checked":on?"true":"false",className:"v4-chip"+(on?" on":""),key:b||"todas","data-mg-bank":b||"todas",
          onClick:function(){ setBanco(b); }}, b?entOf(b).label:t("mg_todas"));
      })),
    secciones.slice(0,resto||qq?3:1),
    (resto||qq)&&solapes.map(solapeEl),
    (resto||qq)&&personasEl,
    (resto||qq)&&secciones.slice(3),
    nadaQ&&React.createElement("div",{className:"pr6-mg-nada","data-bills-noresults":"1"},
      React.createElement("span",null, tf("mg_nada",{q:q.trim()})),
      React.createElement("button",{type:"button",className:"pr6-cta","data-act":"bill-add-q",onClick:function(){ startAdd("fixed",q.trim().charAt(0).toUpperCase()+q.trim().slice(1)); }},
        plus,tf("mg_anadir_q",{q:q.trim()})))
    /* Sin «¿Me lo puedo permitir?» al final: repetía «¿Y si gasto…?» de «¿Te llega?» y el
       prototipo no la lleva (petición del dueño, 11/11/2026). Lo que no repetía, «a plazos» y el
       colchón de cada cuenta, vive ahora dentro de «¿Y si gasto…?» (`AffordSim`). */
  );
  return ReactDOM.createPortal(
    React.createElement(React.Fragment,null,
      React.createElement("div",{ref:rootRef,className:"settings-push open v4-bills-push mc-page-enter","data-bills-manage":"1","data-screen":"bills-home",
        role:"dialog","aria-modal":"true","aria-labelledby":"bills-manage-title"},
        hub),
      persona && React.createElement(PersonaSheet,{key:persona.pid||"nueva",pid:persona.pid,state:state,set:set,totals:totals,onClose:function(){ setPersona(null); },
        onCompartidoViejo:function(id,p){ const r=billsGroupRows(state,"serv",cm,cy).find(function(x){ return x.id===id; }); if(r) setPasos({mode:"edit",row:r,conPersona:p,n:Date.now()}); }}),
      detail && (detail.kind==="fixed"&&planSyncConflict(state,"fixed",detail.id)&&!reviewBill?React.createElement(PlanConflictSheet,{
        record:planSyncConflict(state,"fixed",detail.id),current:(state.fixed||[]).find(function(f){return f.id===detail.id;})||detail.item,onClose:closeDetail,
        onDiscard:function(){const c=planSyncConflict(state,"fixed",detail.id);set(function(s){return planSyncDiscard(s,c);});closeDetail();},
        onReview:function(){setReviewBill(planSyncConflict(state,"fixed",detail.id));setDetail(Object.assign({},detail,{item:(state.fixed||[]).find(function(f){return f.id===detail.id;})||detail.item}));}
      }):React.createElement(BillsItemSheet,{
        row:detail, state:state, set:set, banks:bankList, simple:simple,review:reviewBill,
        onClose:function(){setReviewBill(null);closeDetail();}, onRemove:removeWithUndo
      })),
      addStep && React.createElement(BillsAddWizard,{
        step:addStep, setStep:setAddStep, form:addForm, setForm:setAddForm, banks:bankList,
        onClose:closeAdd, set:set, onSaved:confirmSaved
      }),
      pasos && React.createElement(ReciboPasos,{key:pasos.mode+"_"+(pasos.row?pasos.row.kind+pasos.row.id:"n")+"_"+pasos.n,
        mode:pasos.mode, row:pasos.row, once:pasos.once, flujo:pasos.flujo, nombre:pasos.nombre, conPersona:pasos.conPersona, state:state, set:set, totals:totals, banks:bankList,
        onClose:closePasos, onSaved:confirmSaved, onRemove:removeWithUndo,
        onEditOther:function(id){ const r=billsGroupRows(state,"serv",cm,cy).find(function(x){ return x.id===id; }); if(r) setPasos({mode:"edit",row:r,n:Date.now()}); }
      }),
      savedBill && !addStep && !pasos && React.createElement("div",{className:"v4-undo-toast v4-bills-saved",role:"status","data-testid":"bills-saved"},
        React.createElement("span",null,
          React.createElement("strong",null,savedBill.msg||gbTxt("gb_saved_"+savedBill.kind)),
          !savedBill.msg&&React.createElement("small",null,savedBill.name))),
      undoBill && React.createElement(BillUndoToast,{onUndo:undoLastBill})
    ),
    document.body);
}

function BillsItemSheet({row, state, set, banks, simple, onClose, onRemove,review}){
  const item=planReviewDraft(row.item,review);
  const [reviewPatch,setReviewPatch]=React.useState({});
  const [reviewError,setReviewError]=React.useState("");
  const reviewCommit=usePlanEditSave({state:state,set:set,field:"fixed",item:row.item,review:review,onClose:onClose});
  const locked=row.kind==="debt"&&!simple;
  const [name,setName]=React.useState(item.name||"");
  const [amount,setAmount]=React.useState(review&&review.fields.indexOf("amount")>=0&&item.amount!=null?String(item.amount):"");
  const [freq,setFreq]=React.useState(item.freq||"mes");
  // En deudas, months es el plazo NUMÉRICO; solo los recibos guardan meses como lista
  // (crash real al abrir una cuota, 2026-09-27).
  const [months,setMonths]=React.useState(row.kind==="fixed"&&Array.isArray(item.months)?item.months.slice():[]);
  const [day,setDay]=React.useState(item.day?String(item.day):"");
  const [when,setWhen]=React.useState(item.when||"");
  const [account,setAccount]=React.useState(review?item.account||row.bank||banks[0]||"sabadell":row.bank||banks[0]||"sabadell");
  const [amort,setAmort]=React.useState(item.amort!=null?String(item.amort):"");
  const hasSched=hasSchedule(item);
  // La fila del hub es una foto: la pausa se lee del recibo vivo para que «Reanudar» se vaya al tocarlo.
  const vivo=row.kind==="fixed"?(state.fixed||[]).find(function(e){ return e.id===row.id; }):null;
  const now=new Date(), pausaEdit=vivo?pr6PausaTxt({kind:"fixed",item:vivo},now.getFullYear()*12+now.getMonth()+1):"";
  const titleRef=React.useRef(null);
  const sideRef=React.useRef(null);
  const swipe=useSheetSwipe(true,onClose,{nativeScroll:true});
  // Hoja inferior: atrás la baja, no la saca de lado (vídeo del dueño, 8/11).
  const side=useEdgePageClose(true,onClose,true,sideRef,{plainScroll:true,hoja:swipe.close});
  const sheetRef=swipe.sheetRef;
  const titleId="bills-item-title";
  React.useEffect(function(){ if(!review)setAmount(""); },[row.id]);
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
  const saveAmt=function(e){
    const b=e.currentTarget;
    if(locked||hasSched||b.disabled) return;
    const n=parseNumPadRaw(amount);
    if(!amount.trim()) return;
    // La ficha se cerraba en el mismo toque y «Guardado» apenas llegaba a verse. Sellar primero
    // evita un segundo set si el usuario repite el toque y deja una confirmación breve en su sitio.
    b.disabled=true;
    b.textContent="✓ "+gbTxt("gb_save_ok");
    if(row.kind==="fixed") patchFixedById(set,item.id,{amount:n});
    else if(row.kind==="flow") patchFlowById(set,item.id,{amount:Math.abs(n)});
    else if(row.kind==="oneoff") patchOneoffById(set,item.id,{amount:n});
    else if(row.kind==="debt"&&simple) patchDebtFields(set,item.id,{monthly:n});
    setTimeout(function(){ if(b.isConnected) swipe.close(); },650);
  };
  const saveMeta=function(patch){
    if(locked) return;
    if(review){setReviewPatch(function(p){return Object.assign({},p,patch);});return;}
    if(row.kind==="fixed") patchFixedById(set,item.id,patch);
    else if(row.kind==="flow") patchFlowById(set,item.id,patch);
    else if(row.kind==="oneoff") patchOneoffById(set,item.id,patch);
    else if(row.kind==="debt"&&simple) patchDebtFields(set,item.id,patch);
  };
  const saveReview=function(){
    const patch=Object.assign({},reviewPatch);
    if(!name.trim()||day!==""&&cleanDay(day)==null){setReviewError("plan_edit_invalid");return;}
    if(amount.trim()&&!hasSched){const n=parseNumPadRaw(amount);if(!Number.isFinite(n)){setReviewError("plan_edit_invalid");return;}patch.amount=n;}
    reviewCommit.save(planFixedReviewResult(state,row.item,review,patch));
  };
  const freqs=[["mes","gb_freq_m"],["bimestral","gb_freq_2m"],["trimestral","gb_freq_3m"],["semestral","gb_freq_6m"],["año","gb_freq_y"]];
  return React.createElement("div",{ref:sideRef,className:"v4-sheet-back mc-edge-back",onClick:swipe.close},
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
          !review&&React.createElement("button",{type:"button",className:"v4-bills-add",style:{width:"100%",marginTop:8},onClick:saveAmt,"aria-live":"polite"}, t("done")))),
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
      review&&["cat","category"].filter(function(k){return review.fields.indexOf(k)>=0;}).map(function(k){return React.createElement("label",{key:k},t("plan_conflict_category"),React.createElement("input",{className:"v4-bills-search",value:reviewPatch[k]==null?"":String(reviewPatch[k]),onChange:function(e){saveMeta({[k]:e.target.value});}}));}),
      (reviewError||reviewCommit.error)&&React.createElement("div",{role:"alert",className:"hint"},t(reviewError||reviewCommit.error)),
      review&&React.createElement("button",{type:"button",className:"btn btn-primary btn-block",disabled:reviewCommit.pending,onClick:saveReview},t("db_savechanges")),
      !review&&pausaEdit&&React.createElement("button",{type:"button",className:"btn btn-ghost btn-block","data-act":"bill-resume",style:{marginTop:16},
        onClick:function(){ set(function(s){ return fixedPausa(s,row.id,0,0); }); }}, pr6Cap(pausaEdit)+" · "+t("pr6_reanudar")),
      !review&&!locked && row.kind!=="debt" && React.createElement("button",{type:"button",className:"v4-ficha-quitar","data-act":"bill-remove",style:{width:"100%",marginTop:16},
        onClick:function(){ onRemove(row); }}, gbTxt("gb_del")),
      locked && React.createElement("div",{className:"hint",style:{marginTop:16}}, gbTxt("gb_locked"))
    ));
}

/* AÑADIR Y EDITAR UN RECIBO POR PASOS (Plan › Recibos v6, tanda 4; SPEC §7). Cinco pasos en un
   carril: nombre, importe, cuándo, cuenta y resumen. Se cierra por donde entró: deslizar a la
   derecha (o Atrás) vuelve un paso y en el primero cierra; hacia abajo cierra desde cualquiera.
   En edición se abre en el resumen y cada línea lleva a su paso y vuelve.
   Guarda con los escritores de siempre: `addFixedItem`, `addOneoffItem` y, al editar,
   `fixedEditarRecibo` (08), que es quien decide «Solo este mes / Desde ahora» sin reescribir un
   mes ya pagado. «Solo una vez» es un cargo puntual (`oneoffs`) y «En varios pagos», `schedule`. */
const RP4_SUG=[["luz","luz"],["agua","agua"],["gas","gas"],["internet","recibos"],["movil","recibos"],["alquiler","hogar"],
  ["seguro","recibos"],["gimnasio","salud"],["netflix","ocio"],["spotify","ocio"],["hacienda","tasas"],["comunidad","hogar"]];
/* Icono propio de cada sugerencia, de trazo como el resto de Recibos (el prototipo): el emoji de la
   categoría no casaba con el servicio (Gimnasio 💊, Netflix y Spotify 🎭, Internet y Móvil 🧾; P2-4). */
const RP4_ICO={luz:"M13 2L4 14h7l-1 8 9-12h-7l1-8z",agua:"M12 3c-3 4.5-6 7.6-6 11a6 6 0 0012 0c0-3.4-3-6.5-6-11z",
  gas:"M12 3c1 3 4 5 4 9.5a4 4 0 01-8 0c0-2 1-3.2 2-4 0 2 .8 3 2 3 0-3-1.2-5.5 0-8.5z",internet:"M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01",
  movil:"M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2",alquiler:"M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  seguro:"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z",gimnasio:"M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12",netflix:"M4 5h16v11H4zM8 20h8M12 16v4",
  spotify:"M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z",hacienda:"M3 10l9-6 9 6M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18",
  comunidad:"M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M2 21h20M8 8h2M8 12h2M8 16h2"};
const RP4_FREQS=[["mes","gb_freq_m"],["bimestral","gb_freq_2m"],["trimestral","gb_freq_3m"],["semestral","gb_freq_6m"],["año","gb_freq_y"]];
function rp4Raw(n){
  if(!(Number(n)>0)) return "";
  return (Math.round(Number(n)*100)/100).toFixed(2).replace(/\.00$/,"").replace(".",numPadDecSep());
}
function rp4Cent(n){ return Math.round((Number(n)||0)*100); }
/* Un «Lo descuento» que no cuadra con su deuda se pregunta antes de guardar (feedback 1/11/2026: se
   pintaba «pagas 250 € + 53 €» sin decir nada). `cambio` es la misma transformación que se va a
   guardar, pasada por el estado que se ve. Resuelve con lo que dijo, o null si no hay nada que
   preguntar o no quiere tocarla: el recibo se guarda igual y la deuda se queda como estaba.
   En euros como el campo, no con eur(), que pasa a la moneda de visualización (revisión d139d). */
function descuentoBajaPregunta(q){
  return askText({title:tf("rp6_desc_q",{x:NF.format(q.paga)+" €"}),sub:q.name,value:rp4Raw(q.baja),ph:NF.format(0)+" €",
    ok:t("rp6_desc_ok"),cancel:t("rp6_desc_no")}).then(function(raw){
    const baja=raw==null?0:parseNumPadRaw(raw);
    return baja>0?{id:q.id,paga:q.paga,baja:baja}:null;
  });
}
// Una pregunta por deuda descuadrada, una detrás de otra (rev. lo-descuento R4: antes solo la primera).
function descuentoPregunta(state,cambio){
  const fixes=[];
  return descuentoDescuadre(state,cambio(state)).reduce(function(p,q){
    return p.then(function(){ return descuentoBajaPregunta(q).then(function(f){ if(f) fixes.push(f); }); });
  },Promise.resolve()).then(function(){ return fixes; });
}
function conDescuentoFijado(fixes,s){ return (fixes||[]).reduce(function(o,f){ return deudaFijarDescuento(o,f.id,f.paga,f.baja); },s); }
/* El descuadre ya guardado (R1): primero cuánto le pasa (puede que la cuota guardada ya sea esa),
   luego la pregunta de siempre con lo que baja. Cancelar cualquiera de las dos no toca nada. */
function descuentoAjustarGuardado(state,set,d){
  const q=descuentoDescuadreGuardado(state,d);
  if(!q) return;
  askText({title:t("rp6_pasas_q"),sub:q.name,value:rp4Raw(q.paga),ph:NF.format(0)+" €",ok:t("ask_ok")}).then(function(raw){
    const paga=raw==null?0:parseNumPadRaw(raw);
    if(!(paga>0)) return;
    descuentoBajaPregunta({id:q.id,name:q.name,paga:paga,baja:Math.round((paga+q.descuento)*100)/100}).then(function(f){
      if(f) set(function(s){ return conDescuentoFijado([f],s); });
    });
  });
}
// Esta puerta también identifica el alcance beta: delega en el mismo controlador de Todos.
function quitarReciboPreguntando(undo,id){ return undo.remove(id); }
function rp4DiasMes(ym){ const Y=Math.floor((ym-1)/12), M=ym-Y*12; return new Date(Y,M,0).getDate(); }
/* Un cargo de una sola vez de hoy o de antes este mes ya «se habría cobrado» por calendario sin
   ningún cargo detrás: lo de hoy sin cobro es cargo de hoy (decisión del dueño, t3). Se apunta
   desde mañana; lo de hoy ya cobrado está en Gastos. */
function rp4OnceOk(o, cur, today){ return !!o&&cleanDay(o.day)!=null&&o.day<=rp4DiasMes(o.ym)&&(o.ym>cur||o.ym===cur&&o.day>today); }
function rp4MesTxt(m, y, curY){ return monthShort(m-1)+(y!=null&&y!==curY?" "+String(y).slice(2):""); }
/* Pagos de «En varios pagos»: el último es el resto (SPEC §7.3). Céntimos para no perder uno al
   repartir. Meses distintos: `schedule` no admite dos pagos el mismo mes (el segundo no se cobraría). */
function rp4Plan(plan, total){
  const pl=plan||[], n=pl.length;
  let otros=0;
  pl.forEach(function(x,i){ if(i<n-1) otros+=rp4Cent(parseNumPadRaw(x.amt)); });
  const resto=rp4Cent(total)-otros;
  const meses=pl.map(function(x){ return x.m; });
  const ok=n>=2&&resto>0&&pl.every(function(x,i){ return i===n-1||rp4Cent(parseNumPadRaw(x.amt))>0; })
    &&new Set(meses).size===n&&pl.every(function(x){ return cleanDay(x.day); });
  return {ok:ok, resto:resto/100, sched:pl.map(function(x,i){ return {m:x.m, day:x.day, amt:i===n-1?resto/100:rp4Cent(parseNumPadRaw(x.amt))/100}; })
    .sort(function(a,b){ return a.m-b.m; })};
}
function rp4PlanInicial(total, name, cm){
  // Hacienda: 60 % el 30 de junio y el resto el 5 de noviembre, como la declaración. El resto, mitad y mitad.
  const tax=/hacienda|irpf|renta|hisenda|tax/i.test(name||"");
  const a=Math.round((Number(total)||0)*(tax?0.6:0.5)*100)/100;
  const m1=cm%12+1, m2=m1%12+1;
  return tax?[{m:6,day:30,amt:rp4Raw(a)},{m:11,day:5,amt:""}]:[{m:m1,day:1,amt:rp4Raw(a)},{m:m2,day:1,amt:""}];
}
/* «Visto en tu banco»: cargos que se repiten en el extracto (`detectSubscriptions`, el mismo
   detector de Gastos) y que aún no son un recibo. Solo filas del banco: lo apuntado a mano no se
   ha «visto» en ningún banco. */
function rp4VistoEnBanco(state, max){
  const fx=state.fixed||[];
  const ex=(state.expenses||[]).filter(function(x){
    return x&&esFilaDeBanco(x)&&!x.debtId&&!x.possibleDup&&!CAT_NEUTRAS[x.category]&&x.category!=="ingreso";
  });
  // Un cobro ya enlazado a un recibo con otro nombre tampoco se propone (`subsDeRecibos`, 08): el
  // agua salía aquí con su cargo del mes ya en «Ya pagados» (11/11/2026).
  const subs=detectSubscriptions(ex), enlazados=subs.length?subsDeRecibos(state):null;
  return subs.filter(function(g){
    if(!g.active||!(g.amount>0)||!g.ult.length) return false;
    if(enlazados&&enlazados.has(g.key)) return false;
    return !fx.some(function(f){ return recNameMatch(f.name,g.name)||recNameMatch(g.name,f.name); });
  }).slice(0,max===0?Infinity:(max||3)).map(function(g){
    const e=g.ult[0].e;
    // `seguido`: cobrado todos los meses de su primer a su último cobro (`span`), sin huecos.
    return {name:String(g.name||"").trim(), amount:g.amount, day:recDay(e.date), bank:expenseBankOf(e), cat:g.cat&&CAT[g.cat]&&!CAT_NEUTRAS[g.cat]?g.cat:"", seguido:g.span===g.months, ultimo:Number(g.ult[0].amount)||0};
  }).filter(function(d){ return d.name; });
}
/* ¿Ya tienes este recibo? (SPEC §7: aviso de duplicado). Solo informa, no impide guardar.
   - Mismo nombre, o el tecleado es el principio de uno que ya está («Lu» no, «Luz» sí).
   - Nombres que casan con `recNameMatch`, la regla de siempre, pero sin palabras de relleno: dos
     comercializadoras «… Energía» no son el mismo recibo.
   - Misma categoría e importe parecido (`recAmtClose`), cuando ya se sabe el importe, solo en
     luz, agua y gas, que se tienen una vez por casa: en ocio o telefonía dos de 12,99 € son dos
     servicios distintos.
   Con categorías distintas NUNCA avisa: la luz y el gas de la misma compañía, el mismo día y por lo
   mismo son dos recibos (corrección del dueño, 11/11/2026). La categoría es la elegida o, si no
   hay, la que dice el nombre («Octopus gas» es gas aunque Octopus venda luz) o la que se deduce de
   él (`autoCategory`), así «GC RE OCTOPUS ENERGY» es luz. El día no cuenta nunca: muchos recibos
   se cobran el mismo. */
const RP4_DUP_RELLENO=/^(energia|energy|electrica|electricidad|factura|recibo|cuota|pago|servicio|servicios|suministro|suministros|comercializadora|espana|spain|iberica|seguro|seguros)$/;
const RP4_DUP_CASA={luz:/\b(luz|llum|electricity)\b/,agua:/\b(agua|aigua|water)\b/,gas:/\bgas\b/};
function rp4Duplicado(fixed, name, category, amount){
  const qn=recNorm(name);
  if(qn.length<3) return null;
  const catDe=function(n,c){
    const nn=recNorm(n), dice=Object.keys(RP4_DUP_CASA).filter(function(k){ return RP4_DUP_CASA[k].test(nn); });
    const x=c||(dice.length===1?dice[0]:autoCategory(n));
    return x&&x!=="otros"&&CAT[x]?x:"";
  };
  const sin=function(n){ return recNorm(n).split(" ").filter(function(w){ return !RP4_DUP_RELLENO.test(w); }).join(" "); };
  const qc=catDe(name,category), qs=sin(name);
  return (fixed||[]).find(function(e){
    if(!e||!e.name) return false;
    const n=recNorm(e.name), ec=catDe(e.name,e.category);
    if(qc&&ec&&qc!==ec) return false;
    if(n===qn||n.indexOf(qn)===0) return true;
    if(qs&&recNameMatch(qs,sin(e.name))) return true;
    return !!(qc&&qc===ec&&RP4_DUP_CASA[qc]&&amount>0&&recAmtClose(amount,Number(e.amount)||0));
  })||null;
}
/* − / + que acelera al mantener pulsado (SPEC §7.3). El teclado (detail 0) da un paso por toque. */
function RpPaso({label, onStep, dir}){
  const h=useRef(null);
  const stop=function(){ const x=h.current; if(!x) return; clearTimeout(x.t); clearInterval(x.i); h.current=null; };
  useEffect(function(){ return stop; },[]);
  const down=function(e){
    if(e.button!=null&&e.button!==0) return;
    stop(); onStep(dir);
    const x={t:0,i:0}; h.current=x;
    x.t=setTimeout(function(){ x.i=setInterval(function(){ onStep(dir); },90); },380);
  };
  return React.createElement("button",{type:"button",className:"rp4-step-btn","aria-label":label,
    onPointerDown:down,onPointerUp:stop,onPointerLeave:stop,onPointerCancel:stop,
    onClick:function(e){ if(e.detail===0) onStep(dir); }}, dir<0?"−":"+");
}
/* Al cambiar de paso, el que se va sigue a la vista mientras desliza y los dos pasan de un alto al
   otro. Antes el que se iba se plegaba de golpe (alto 0) y el que llegaba entraba desde opacidad 0:
   durante el deslizamiento la hoja se veía vacía (vídeo del dueño, 7/11, «Editar recibo» → «¿Qué
   recibo es?»). Si se había bajado, el que se va se queda donde estaba en vez de saltar arriba.
   `scrollRef` es lo que scrollea (null en una hoja que crece con su contenido). */
function usePasosCarril(trackRef, scrollRef, paso){
  const prev=useRef(paso);
  React.useLayoutEffect(function(){
    const p=prev.current; prev.current=paso;
    const sc=scrollRef&&scrollRef.current, s=sc?sc.scrollTop:0;
    if(sc) sc.scrollTop=0;
    const tr=trackRef.current;
    if(!tr||p===paso||mcReduced()) return;
    const viejo=tr.children[p], nuevo=tr.children[paso];
    if(!viejo||!nuevo) return;
    const fin=function(){ [viejo,nuevo].forEach(function(el){ el.style.maxHeight=""; el.style.overflow=""; el.style.transform=""; el.style.transition=""; }); };
    // Punto de partida sin transición del alto (medir ya recalcula estilos y, con ella puesta, el que
    // se va arrancaba desde 0): los dos con el alto del que se va.
    viejo.style.transition=nuevo.style.transition="opacity .28s ease";
    // Plegado, el paso encoge sus filas (columna flex): se mide con el alto suelto.
    viejo.style.maxHeight="none";
    const hv=viejo.offsetHeight, hn=nuevo.offsetHeight;
    viejo.style.maxHeight=nuevo.style.maxHeight=hv+"px";
    viejo.style.overflow=nuevo.style.overflow="hidden";
    /* Un salto de varios pasos (del resumen a «Nombre») cruzaba los intermedios, que están vacíos:
       se desliza solo un ancho, con el que se va puesto al lado del que llega. */
    const lado=paso<p?paso+1:paso-1, objetivo=tr.style.transform;
    viejo.style.transform="translate("+((lado-p)*100)+"%,"+(-s)+"px)";
    tr.style.transition="none"; tr.style.transform="translateX("+(-lado*100)+"%)";
    void tr.offsetHeight;
    tr.style.transition=""; tr.style.transform=objetivo;
    viejo.style.transition=nuevo.style.transition="";
    // Los dos van al alto del que llega: el carril (y una hoja que mide lo que enseña) crece o encoge
    // seguido, y el que se va solo se recorta si el nuevo es más bajo. Al final se pliega ya invisible.
    viejo.style.maxHeight=nuevo.style.maxHeight=hn+"px";
    const t=setTimeout(fin,420);
    return function(){ clearTimeout(t); fin(); };
  },[paso]);
}
function ReciboPasos({mode, row, once, flujo, nombre, conPersona, state, set, totals, banks, onClose, onSaved, onEditOther, onRemove, ensayo}){
  const edit=mode==="edit";
  const y=totals.curYear, m=totals.curMonth, today=totals.today, cur=y*12+m;
  /* Lo que entra y lo que mueves (`flujo`) se da de alta y se edita con ESTOS pasos desde el
     12/11/2026 («incluso la creación es diferente»): nombre, importe, cuándo, cuenta y resumen, como
     un recibo. Sin «En varios pagos» ni Más opciones (un flujo no los tiene); el día puede ir por
     regla (primer o último día hábil), como siempre; y un traspaso elige de qué cuenta sale y a cuál va. */
  const kind=edit?row.kind:(flujo?"flow":once?"oneoff":"fixed");
  const esFlujo=kind==="flow";
  const it=edit?row.item:null;
  const vivo=edit&&kind==="fixed"?(state.fixed||[]).find(function(e){ return e.id===row.id; })||it:it;
  /* Compartido (tanda 5): el importe que se teclea es lo que cobra el banco y tu parte sale del
     reparto. Uno compartido de antes (solo `bankAmount`, sin decir con quién) no se convierte
     solo: su importe sigue bloqueado hasta que digas con quién lo pagas (`viejo`). */
  const vigente=edit&&kind==="fixed"?repartoVigente(it):null;
  const viejo=edit&&kind==="fixed"&&!vigente&&Number(it.bankAmount)>0&&repartoAdmite(it);
  /* Un reparto que ya no cuadra (lo rompió un cliente viejo o una mezcla a medias) se ofrece para
     rehacerlo: sus personas vuelven al borrador y al guardar cuadra de nuevo (rev. t5, R5). */
  const roto=viejo&&Array.isArray(it.reparto)?it.reparto.filter(function(x){ return x&&typeof x.id==="string"&&x.id&&String(x.n||"").trim()&&REPARTO_VIAS.indexOf(x.via)>=0; }):[];
  const inicial=React.useMemo(function(){
    // El último día del mes ya no queda «desde mañana» en este mes: se empieza en el siguiente.
    // Con el mes en curso marcado (y desactivado) el −/+ daba el día 32 (beta, 31/10/2026).
    // «Añadir "x" como recibo» desde el buscador de Tus recibos llega con el nombre puesto.
    if(!edit) return {name:nombre||"",category:"",amount:"",variable:false,mode:once?"once":"rec",freq:"mes",months:[],day:null,
      once:{ym:today>=rp4DiasMes(cur)?cur+1:cur,day:null},plan:null,account:banks[0]||"sabadell",reparto:[],
      fk:"income",when:"",to:null};
    if(kind==="flow"){
      const ms=Array.isArray(it.months)?it.months.slice().sort(function(a,b){ return a-b; }):[];
      // Sin `freq` guardada (los de antes) se deduce de los meses; si no cuadra con ninguna, «Una vez al año» con sus meses.
      const fr=it.freq&&RP4_FREQS.some(function(q){ return q[0]===it.freq; })?it.freq:!ms.length?"mes"
        :(["bimestral","trimestral","semestral"].find(function(q){ return goalSyncEqual(chargeMonths({freq:q}),ms); })||"año");
      const tr=it.kind==="transfer";
      return {name:it.name||"",category:"",amount:rp4Raw(it.amount),variable:false,mode:it.once?"once":"rec",freq:fr,months:fr==="mes"?[]:ms,
        day:cleanDay(it.day),when:it.when||"",once:it.once?{ym:Number(it.once.y)*12+Number(it.once.m),day:cleanDay(it.day)||1}:{ym:cur,day:today},plan:null,
        account:tr?(it.from||"sabadell"):(it.to||"sabadell"),to:tr?(it.to||null):null,fk:tr?"transfer":"income",reparto:[]};
    }
    if(kind==="oneoff") return {name:it.name||"",category:"",amount:rp4Raw(it.amount),variable:false,mode:"once",freq:"mes",months:[],day:it.day||null,
      once:{ym:(Number(it.year)||y)*12+(Number(it.month)||m),day:cleanDay(it.day)||1},plan:null,account:it.account||banks[0]||"sabadell",reparto:[]};
    const sch=hasSchedule(it);
    return {name:it.name||"",category:it.category||"",amount:rp4Raw(sch?it.schedule.reduce(function(a,x){ return a+(Number(x.amt)||0); },0):vigente||viejo?it.bankAmount:it.amount),
      variable:!!it.variable,mode:sch?"split":"rec",freq:({mensual:"mes",anual:"año"})[it.freq]||it.freq||"mes",months:Array.isArray(it.months)?it.months.slice():[],day:cleanDay(it.day),
      once:{ym:cur,day:today},plan:sch?it.schedule.map(function(x){ return {m:x.m,day:cleanDay(x.day),amt:rp4Raw(x.amt)}; }):null,account:accOf(it),
      reparto:(vigente||roto).map(function(x){ return {id:x.id,n:x.n,via:x.via,debtId:x.via==="debt"?x.debtId:null,amt:x.auto?"":rp4Raw(x.amt)}; })
        // Desde Todos › Personas con un compartido de antes: la persona entra con todo el resto a la vista.
        .concat(conPersona&&viejo&&!roto.length?[{id:conPersona.id,n:conPersona.n,via:conPersona.via,debtId:conPersona.via==="debt"?conPersona.debtId:null,
          amt:Number(it.bankAmount)>Number(it.amount)?rp4Raw(Math.round((it.bankAmount-it.amount)*100)/100):""}]:[]),
      prueba:typeof it.pruebaHasta==="string"?it.pruebaHasta:null,perm:Number(it.permHasta)>0?Number(it.permHasta):null};
  },[]);
  const [paso,setPaso]=useState(edit?4:0);
  /* Al abrir solo nace el paso que se ve. Los otros cuatro (teclado, 31 días, meses, bancos) están
     plegados fuera de la vista, pero se creaban y maquetaban con la hoja, en el fotograma en que
     empieza a subir: 434 cajas que maquetar, ahora 174 (trazas a ×6 del 10/11/2026). Llegan cuando
     ya ha subido, o en el mismo toque que cambia de paso. En el ensayo en seco van todos: es su
     primera vez. */
  const [otros,setOtros]=useState(!!ensayo);
  useEffect(function(){
    let vivo=true;
    const id=setTimeout(function(){ mcScheduleIdle(function(){ if(vivo) setOtros(true); },600); },560);
    return function(){ vivo=false; clearTimeout(id); };
  },[]);
  // Por dónde se ha llegado a cada paso: Atrás deshace ESE camino. Con «Visto en tu banco» (del
  // nombre al resumen) o al tocar una línea del resumen, volver iba por pasos que nadie había
  // abierto (beta 4.26.200: «al darle al de 2.050 hace cosas raras»).
  const rastro=useRef([]);
  // Ya se ha visto el resumen: desde un paso, el botón vuelve a él en vez de seguir uno a uno.
  const [resumido,setResumido]=useState(edit);
  const espera=useRef(0), sigue=useRef(null);
  const suelta=function(){ if(sigue.current) sigue.current(); };
  useEffect(function(){ return function(){ clearTimeout(espera.current); suelta(); }; },[]);
  // Lo siguiente que hay que elegir, a la vista y sin salto: la hoja ACOMPAÑA al plegable fotograma a
  // fotograma mientras crece o se cierra, como «¿Te llega?» en la 228. Antes esperaba 380 ms a que
  // terminara de abrirse y luego se deslizaba aparte: se abría, se paraba y daba un segundo empujón; y al
  // cerrar, el hueco desaparecía antes de tiempo y la hoja caía de golpe (vídeo del 11/11, «Más opciones»).
  const diasRef=useRef(null), mesesRef=useRef(null), pagosRef=useRef(null);
  const masRef=useRef(null), masBtnRef=useRef(null), extraRefs={prueba:useRef(null),perm:useRef(null)}, extraBtnRefs={prueba:useRef(null),perm:useRef(null)};
  const acompana=function(body,paso,ms,fin){
    suelta();
    let raf=0;
    const hasta=performance.now()+(mcReduced()?0:ms), t0=performance.now();
    const corta=function(){
      cancelAnimationFrame(raf); raf=0;
      body.removeEventListener("touchstart",corta); body.removeEventListener("wheel",corta);
      if(sigue.current===corta) sigue.current=null;
      if(fin) fin();
    };
    const vuelta=function(){
      const ahora=performance.now();
      paso(Math.min(1,(ahora-t0)/Math.max(1,hasta-t0)));
      if(ahora<hasta) raf=requestAnimationFrame(vuelta); else corta();
    };
    // Un dedo en la hoja manda: deja de acompañar y no pelea con quien desliza.
    body.addEventListener("touchstart",corta,{passive:true}); body.addEventListener("wheel",corta,{passive:true});
    sigue.current=corta;
    raf=requestAnimationFrame(vuelta);
  };
  const mostrar=function(ref,conTitulo){
    const el=ref.current, body=el&&el.closest(".rp4-body");
    if(!body) return;
    acompana(body,function(){
      /* A la vista lo que hay que elegir SIN que el título del paso se salga por arriba: con «nearest» a secas
         «¿Cuándo se cobra?» quedaba cortado a media altura contra el borde del cuerpo (revisión 7/11). */
      const st=el.closest(".rp4-step"), h=st&&st.querySelector(".rp4-h");
      const b=body.getBoundingClientRect(), e=el.getBoundingClientRect();
      let d=e.bottom>b.bottom-12?e.bottom-b.bottom+12:(e.top<b.top?e.top-b.top-8:0);
      // Solo con «titulo»: en «En varios pagos» el título no se corta; al elegir meses/días lo que se elige manda.
      // Con un ref en su lugar, lo que no se sale por arriba es esa fila: la que se ha tocado para abrir.
      const tope=conTitulo&&conTitulo.current?conTitulo.current:h;
      if(d>0&&conTitulo&&tope) d=Math.min(d,Math.max(tope.getBoundingClientRect().top-b.top-8,0));
      if(Math.abs(d)>0.5) body.scrollTop+=d;
    },650);
  };
  /* Al plegar, el hueco se iba en las primeras décimas y el navegador recolocaba la hoja de golpe para no
     dejar hueco debajo. Se reserva el alto mientras la hoja baja con la misma curva del plegable. */
  const ocultar=function(ref){
    const el=ref.current, body=el&&el.closest(".rp4-body"), track=body&&body.firstElementChild;
    if(!track) return;
    const alto=body.scrollHeight, desde=body.scrollTop, vista=body.clientHeight;
    const hasta=Math.max(0,Math.min(desde,alto-el.getBoundingClientRect().height-vista));
    if(desde-hasta<1) return;
    track.style.minHeight=alto+"px";
    acompana(body,function(p){ body.scrollTop=desde-(desde-hasta)*(1-Math.pow(1-p,3)); },350,function(){ track.style.minHeight=""; });
  };
  const [f,setF]=useState(inicial);
  const [fresh,setFresh]=useState(false);
  const [scope,setScope]=useState("desde");
  const [gone,setGone]=useState(false);
  const [padFor,setPadFor]=useState(null);
  const [tecleado,setTecleado]=useState(false);
  // Abierto si ya hay algo dentro: así se ve lo que tiene sin buscarlo (prototipo: `addMore`).
  const [mas,setMas]=useState(!!vigente||viejo||!!(inicial.prueba||inicial.perm));
  const [extra,setExtra]=useState(null);   // «prueba» o «perm» desplegado dentro de Más opciones
  const [persona,setPersona]=useState(null);   // {pid} o {draft:true}: ficha de persona encima
  const [nuevas,setNuevas]=useState(conPersona?[conPersona]:[]);       // personas creadas en este alta, aún sin recibo
  // Lo que se ha tocado al editar: solo eso va al recibo. Releer y volver a escribir lo demás
  // (unos pagos sin día, unos meses por defecto) lo cambiaría sin que nadie lo pidiera.
  const [tocado,setTocado]=useState(roto.length||conPersona&&viejo?{reparto:true}:{});
  const toca=function(){ const ks=arguments; setTocado(function(o){ const n=Object.assign({},o); Array.prototype.forEach.call(ks,function(k){ n[k]=true; }); return n; }); };
  const savedRef=useRef(false);
  const titleRef=useRef(null), sideRef=useRef(null);
  const onCloseRef=useRef(onClose); onCloseRef.current=onClose;
  // `ensayo`: montaje en seco de `mcEnsayar`, sin candado, gesto de borde ni entrada de Atrás.
  const swipe=useSheetSwipe(!ensayo,function(){ onCloseRef.current&&onCloseRef.current(); },{nativeScroll:true,soloVelo:true});
  const sheetRef=swipe.sheetRef;
  const pasoRef=useRef(paso); pasoRef.current=paso;
  const upd=function(p){ setF(function(o){ return Object.assign({},o,p); }); };
  const ir=function(n){
    clearTimeout(espera.current); suelta();
    setPadFor(null); setGone(false);
    const p=pasoRef.current, r=rastro.current;
    if(n===p) return;
    /* Del resumen a cualquier paso se apunta SIEMPRE el resumen: Atrás vuelve a él (antes, «Nombre»
       tras «Visto en tu banco» vaciaba el rastro y Atrás cerraba la hoja con el borrador; revisión
       del QA). Volver al resumen recorta el rastro hasta él; ir adonde se venía es volver. */
    const ri=n===4?r.lastIndexOf(4):-1;
    if(p===4) r.push(p);
    else if(ri>=0) r.length=ri;
    else if(r.length&&r[r.length-1]===n) r.pop(); else r.push(p);
    if(n===1) setFresh(!!f.amount);
    if(n===4) setResumido(true);
    pasoRef.current=n; setOtros(true); setPaso(n);
  };
  const padRef=useRef(padFor); padRef.current=padFor;
  // Con un teclado abierto, Atrás (botón, gesto o sistema) cierra solo el teclado (rev. t5, uso 2).
  useBackClose(padFor!=null,function(){ setPadFor(null); });
  const atras=React.useCallback(function(){
    clearTimeout(espera.current); suelta();
    if(padRef.current!=null){ setPadFor(null); return true; }
    setPadFor(null); setGone(false);
    const r=rastro.current;
    // En el primer paso atrás cierra, y la hoja baja como subió (sin animar desaparecía de golpe).
    if(!r.length){ swipe.close(); return false; }
    const n=r.pop(); pasoRef.current=n; setOtros(true); setPaso(n); return true;
  },[]);
  const atrasRef=useRef(atras); atrasRef.current=atras;
  useBackClose(!ensayo,function(){ atrasRef.current(); },paso);
  // Tercer argumento verdadero y distinto en cada paso: con el paso 0 a secas el gesto quedaba apagado.
  const side=useEdgePageClose(!ensayo,atras,"p"+paso,sideRef,{plainScroll:true,hoja:swipe.close,soloPaso:function(){ return rastro.current.length>0; }});
  // El paso de llegada se ve desde arriba: el carril cambia de contenido, no de sitio.
  const bodyRef=useRef(null), trackRef=useRef(null);
  usePasosCarril(trackRef,bodyRef,paso);
  useEffect(function(){
    const id=requestAnimationFrame(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); });
    return function(){ cancelAnimationFrame(id); };
  },[paso]);
  const mesesElegir=f.mode==="rec"&&f.freq!=="mes";
  const diasListos=f.mode==="rec"&&(f.freq==="mes"||f.months.length>0);
  // Tras «Cada mes» solo había días visibles; al pasar a «Una vez al año» el plegable de meses
  // aún se abría (350 ms) y parecía que solo quedaban los días 1–31 (beta 4.26.209).
  useLayoutEffect(function(){
    if(paso!==2||!mesesElegir) return;
    mostrar(mesesRef);
  },[paso,f.freq,f.mode,mesesElegir]);
  useEffect(function(){
    const onKey=function(e){
      if(document.documentElement.classList.contains("ask-open")||document.querySelector('[data-sheet="persona"]')) return;
      if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); side.close(); return; }
      if(e.key!=="Tab"||!sheetRef.current) return;
      e.stopPropagation();
      const list=Array.prototype.filter.call(sheetRef.current.querySelectorAll('button,a,input,[tabindex]:not([tabindex="-1"])'),function(el){ return !el.disabled&&el.offsetParent!==null&&!el.closest("[inert]"); });
      if(!list.length) return;
      const first=list[0], last=list[list.length-1], idx=list.indexOf(document.activeElement);
      if(idx===-1){ e.preventDefault(); (e.shiftKey?last:first).focus(); return; }
      if(e.shiftKey&&idx===0){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&idx===list.length-1){ e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown",onKey,true);
    return function(){ document.removeEventListener("keydown",onKey,true); };
  },[]);
  const amt=parseNumPadRaw(f.amount);
  const plan=f.mode==="split"?(f.plan||rp4PlanInicial(amt,f.name,m)):null;
  const pr=plan?rp4Plan(plan,amt):null;
  const setPlan=function(fn){ setF(function(o){ const pl=(o.plan||rp4PlanInicial(parseNumPadRaw(o.amount),o.name,m)).map(function(x){ return Object.assign({},x); }); fn(pl); return Object.assign({},o,{plan:pl}); }); };
  const onceDias=rp4DiasMes(f.once.ym);
  const ok=[
    !!String(f.name||"").trim(),
    amt>0,
    f.mode==="once"?cleanDay(f.once.day)!=null&&f.once.day<=onceDias&&f.once.ym>=cur&&(edit&&!tocado.when||rp4OnceOk(f.once,cur,today))
      :f.mode==="split"?!!(pr&&pr.ok)
      :(cleanDay(f.day)!=null||esFlujo&&!!f.when)&&(f.freq!=="año"||f.months.length>0),
    !!f.account&&(!esFlujo||f.fk!=="transfer"||!!f.to&&f.to!==f.account),
    true];
  /* ¿Lo pagas con alguien? (tanda 5). Las personas que ya están en otros recibos y las creadas en
     esta hoja; el nombre y la forma de pago salen de la persona, por si se editó con la hoja abierta. */
  const conocidas=personasDe(state).concat(nuevas.filter(function(x){ return !personasDe(state).some(function(p){ return p.id===x.id; }); }));
  const deQuien=function(x){ return conocidas.find(function(p){ return p.id===x.id; })||x; };
  const admite=kind==="fixed"&&f.mode==="rec"&&f.freq!=="año";
  const mensual=f.mode==="rec"&&f.freq==="mes";
  const rr=kind==="fixed"&&f.reparto.length?repartoResolver(f.reparto.map(function(x){ const q=deQuien(x);
    return {id:x.id,n:q.n,via:q.via,debtId:q.via==="debt"?q.debtId:null,amt:parseNumPadRaw(x.amt),auto:!(parseNumPadRaw(x.amt)>0)}; }),amt):null;
  // Compartir pide un recibo de cada vez, que tu parte no se quede en cero y, para descontar de
  // una deuda, que se cobre todos los meses (la cuota es la misma cada mes).
  const repOk=!rr||admite&&rr.ok&&(mensual||!rr.partes.some(function(x){ return x.via==="debt"; }));
  // Al editar solo cuenta lo tocado: un recibo viejo con pagos sin día se puede renombrar igual.
  const listo=(edit&&(kind==="fixed"||esFlujo)?ok[0]&&ok[3]&&(!tocado.amount||ok[1])&&(!(tocado.when||(f.mode==="split"&&tocado.amount))||ok[2]):ok.every(Boolean))&&repOk;
  // Visto en tu banco y duplicado: solo al dar de alta (en edición ya sabes qué recibo es).
  const visto=React.useMemo(function(){ return edit||esFlujo?[]:rp4VistoEnBanco(state); },[state.expenses,state.fixed]);
  const qn=recNorm(f.name);
  // También con el nombre de una sugerencia o del buscador: «Gas» tocado avisa igual que tecleado.
  const dup=!edit&&kind==="fixed"?rp4Duplicado(state.fixed,f.name,f.category,f.mode==="split"?0:amt):null;
  // Lo que se ve en el resumen sale del mismo recibo que se guardaría.
  const borrador=function(){
    const base={name:String(f.name).trim(),amount:amt,account:f.account};
    if(f.category) base.category=f.category;
    if(f.variable) base.variable=true;
    // Prueba gratis y permanencia (Más opciones): solo si se pusieron, nunca una fecha por defecto.
    if(kind==="fixed"&&f.mode!=="once"){ if(f.prueba) base.pruebaHasta=f.prueba; if(f.perm) base.permHasta=f.perm; }
    if(f.mode==="split") return Object.assign(base,{freq:"año",schedule:pr.sched,day:pr.sched[0].day,amount:Math.round(amt*100)/100});
    base.freq=f.freq;
    const def=chargeMonths({freq:f.freq});
    if(f.freq!=="mes"&&f.months.length){ const ms=f.months.slice().sort(function(a,b){ return a-b; }); if(!goalSyncEqual(ms,def)) base.months=ms; }
    base.day=cleanDay(f.day);
    // Compartido: el banco cobra el importe entero y tu parte es lo que queda (SPEC §6).
    if(rr&&rr.ok){ base.amount=rr.mia; base.bankAmount=Math.round(amt*100)/100; base.reparto=rr.partes; }
    else if(viejo&&!f.reparto.length){ base.amount=it.amount; base.bankAmount=it.bankAmount; }
    return base;
  };
  const cambios=edit&&kind==="fixed"?(function(){
    const d=borrador(), p={};
    let ks=[];
    if(tocado.name) ks=ks.concat(["name","category"]);
    if(tocado.amount) ks=ks.concat(["amount","variable"]);
    if(tocado.amount||tocado.reparto) ks=ks.concat(["amount","bankAmount","reparto"]);
    if(tocado.when) ks=ks.concat(["freq","day","months","schedule"]);
    if(tocado.account) ks.push("account");
    if(tocado.prueba) ks.push("pruebaHasta");
    if(tocado.perm) ks.push("permHasta");
    // En varios pagos el importe es la suma de los pagos: van juntos.
    if(f.mode==="split"&&(tocado.amount||tocado.when)) ks=ks.concat(["amount","freq","day","months","schedule"]);
    Array.from(new Set(ks)).forEach(function(k){
      const norm=function(v){ return v==null||v===false||(Array.isArray(v)&&!v.length)?null:v; };
      const a=norm(it[k]), b=norm(d[k]);
      if(!goalSyncEqual(a,b)) p[k]=b;
    });
    if(p.amount!=null&&rp4Cent(p.amount)===rp4Cent(it.amount)) delete p.amount;
    return p;
  })():null;
  // «Solo este mes / Desde ahora» (SPEC §7): solo si cambian importe o día de un recibo de los de
  // cada vez, que se cobra este mes y aún no se ha pagado. Pagado ya, «Desde ahora» no lo toca.
  const pagadoYa=edit&&kind==="fixed"&&vivo?fixedPaymentState(state,vivo,y,m,today).paid:false;
  const conScope=!!cambios&&("amount" in cambios||"day" in cambios)&&f.mode==="rec"&&!hasSchedule(it)&&!(it.bankAmount>0)&&!f.reparto.length
    &&occursIn(it,m)&&occursIn(Object.assign({},it,cambios),m)&&!pagadoYa&&!("freq" in cambios)&&!("months" in cambios);
  const guardar=function(){
    if(savedRef.current||!listo) return;
    savedRef.current=true;
    const nombre=String(f.name).trim();
    if(esFlujo){
      const tr=f.fk==="transfer", d={name:nombre,kind:f.fk,amount:Math.round(amt*100)/100,to:tr?f.to:f.account,from:tr?f.account:undefined};
      if(f.mode==="once"){ const Y=Math.floor((f.once.ym-1)/12); Object.assign(d,{once:{y:Y,m:f.once.ym-Y*12},day:f.once.day,when:undefined,months:undefined,freq:undefined}); }
      else {
        const ms=f.months.slice().sort(function(a,b){ return a-b; });
        Object.assign(d,{once:undefined,freq:f.freq==="mes"?undefined:f.freq,months:f.freq==="mes"||!ms.length?undefined:ms,
          day:f.when?undefined:cleanDay(f.day),when:f.when||undefined});
      }
      if(!edit){
        const it={id:uid()};
        Object.keys(d).forEach(function(k){ if(d[k]!==undefined) it[k]=d[k]; });
        addFlowItem(set,it);
        onSaved(f.fk,nombre);
      } else {
        // Solo lo tocado: releer y reescribir lo demás cambiaría la entrada sin que nadie lo pidiera.
        const ks=[];
        if(tocado.name) ks.push("name");
        if(tocado.amount) ks.push("amount");
        if(tocado.when) ks.push("once","day","when","months","freq");
        if(tocado.account) ks.push("kind","to","from");
        const patch={};
        ks.forEach(function(k){ if(!goalSyncEqual(it[k]===undefined?null:it[k],d[k]===undefined?null:d[k])) patch[k]=d[k]; });
        if(Object.keys(patch).length) patchFlowById(set,row.id,patch);
        onSaved(f.fk,nombre,tf("rp4_saved",{name:nombre}));
      }
      swipe.close();
      return;
    }
    if(!edit){
      if(f.mode==="once"){
        const Y=Math.floor((f.once.ym-1)/12), M=f.once.ym-Y*12;
        addOneoffItem(set,{id:uid(),name:nombre,amount:Math.round(amt*100)/100,month:M,year:Y,day:f.once.day,account:f.account});
        onSaved("oneoff",nombre);
      } else {
        const nuevo=conMesDeAlta(Object.assign({id:uid()},borrador()));
        descuentoPregunta(state,function(s){ return deudasTrasReparto(s,Object.assign({},s,{fixed:(s.fixed||[]).concat([nuevo])})); }).then(function(fix){
          addFixedItem(set,nuevo);
          if(fix) set(function(s){ return conDescuentoFijado(fix,s); });
          onSaved("fixed",nombre);
          swipe.close();
        });
        return;
      }
    } else if(kind==="oneoff"){
      const Y=Math.floor((f.once.ym-1)/12), M=f.once.ym-Y*12;
      const patch={name:nombre,amount:Math.round(amt*100)/100,month:M,year:Y,day:f.once.day,account:f.account};
      // Igual que `patchOneoffById`, en una sola escritura.
      set(function(s){
        let cambia=false;
        const oneoffs=(s.oneoffs||[]).map(function(o){ if(o.id!==row.id) return o; const n=Object.assign({},o,patch); if(goalSyncEqual(n,o)) return o; cambia=true; return n; });
        return cambia?Object.assign({},s,{oneoffs:oneoffs}):s;
      });
      onSaved("oneoff",nombre,tf("rp4_saved",{name:nombre}));
    } else {
      const sc=conScope?scope:"desde";
      // Un «Lo descuento» que entra, cambia o sale mueve también la cuota de esa deuda.
      const cambio=function(s){ return deudasTrasReparto(s,fixedEditarRecibo(s,row.id,cambios,sc,y,m,today)); };
      if(Object.keys(cambios).length){
        descuentoPregunta(state,cambio).then(function(fix){
          set(function(s){ return conDescuentoFijado(fix,cambio(s)); });
          onSaved("fixed",nombre,tf(sc==="mes"?"rp4_saved_mes":"rp4_saved",{name:nombre}));
          swipe.close();
        });
        return;
      }
      onSaved("fixed",nombre,tf(sc==="mes"?"rp4_saved_mes":"rp4_saved",{name:nombre}));
    }
    swipe.close();
  };
  const siguiente=function(e){
    if(!ok[paso]) return;
    /* El segundo toque de un doble toque en «Siguiente»/«Listo» cae ya en el resumen (`detail` 2):
       no guarda sin haberlo visto (revisión del QA). Un toque suelto siempre lleva `detail` 1. */
    if(paso===4){ if(e&&e.detail>1) return; guardar(); return; }
    ir(resumido?4:paso+1);
  };
  const ctaLabel=paso===4?(edit?t("rp4_guardar"):t("rp4_add")):(resumido?t("rp4_listo"):t("rp4_next"));
  const ctaOn=ok[paso]&&(paso<4||listo);
  const titulos=esFlujo?[f.fk==="transfer"?"fl_t_name_tr":"fl_t_name","fl_t_amount","fl_t_when",f.fk==="transfer"?"fl_t_from":"fl_t_to",edit?"fl_t_edit":"rp4_t_sum"]
    :["rp4_t_name","rp4_t_amount","rp4_t_when","rp4_t_account",edit?"rp4_t_edit":"rp4_t_sum"];
  const bankLabel=function(b){ return b?entOf(b).label:"—"; };
  const freqTxt=function(fr){ const x=RP4_FREQS.find(function(q){ return q[0]===fr; }); return x?gbTxt(x[1]):""; };
  const lower=function(s){ return CURLANG==="en"?s:String(s).toLowerCase(); };
  const onceY=Math.floor((f.once.ym-1)/12), onceM=f.once.ym-onceY*12;
  const proximo=pr?(pr.sched.find(function(x){ return x.m>=m; })||pr.sched[0]):null;
  const amtTxt=amt>0?(f.variable?"≈ ":"")+eur(amt):"—";
  const cuandoTxt=f.mode==="once"?((f.once.day||"—")+" "+rp4MesTxt(onceM,onceY,y))
    :f.mode==="split"?(pr?pr.sched.map(function(x){ return (x.day||"—")+" "+monthShort(x.m-1); }).join(" · "):"—")
    :esFlujo&&f.when?gbTxt(f.when==="first"?"gb_when_first":"gb_when_last")+" · "+freqTxt(f.freq).toLowerCase()
    :(cleanDay(f.day)?f.day+" · "+freqTxt(f.freq).toLowerCase():"—");
  const subTxt=[f.category&&CAT[f.category]?catName(f.category):"",esFlujo&&f.fk==="transfer"?tf("fl_de_a",{from:bankLabel(f.account),to:bankLabel(f.to)}):bankLabel(f.account),
    f.mode==="once"?t("rp4_una_vez"):f.mode==="split"?"":freqTxt(f.freq).toLowerCase()].filter(Boolean).join(" · ");
  const panel=function(i,kids){
    return React.createElement("section",{key:i,className:"pr6-step rp4-step"+(paso===i?" on":""),"data-rp4-paso":i,
      "aria-hidden":paso===i?null:"true",inert:paso===i?undefined:""},
      React.createElement("h2",{className:"rp4-h",tabIndex:-1,ref:paso===i?titleRef:null,id:paso===i?"rp4-title":undefined}, t(titulos[i])),
      paso===i||otros?kids:null);
  };
  /* «Ya tienes «Gas» · 45 € el día 5 · Ver ese», en el nombre y otra vez en el resumen: tocando una
     sugerencia se salta al importe y el aviso del primer paso no llegaba a verse. */
  const dupEl=function(key){
    const d=cleanDay(dup&&dup.day);
    return React.createElement("div",{key:key,className:"pr6-fold"+(dup?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in"},dup?null:{"aria-hidden":"true",inert:""}),
        dup&&React.createElement("button",{type:"button",className:"rp4-dup","data-rp4":"dup",onClick:function(){ onEditOther(dup.id); }},
          React.createElement("span",{className:"rp4-dup-t"}, tf("rp4_dup",{name:dup.name}),
            React.createElement("span",{className:"rp4-dim num"}," · "+(d?tf("rp4_dup_dia",{x:eur(Number(dup.amount)||0),d:d}):eur(Number(dup.amount)||0)))),
          React.createElement("span",{className:"rp4-dup-go"}, t("rp4_dup_ver")))));
  };
  // 1 · Nombre
  const sugs=RP4_SUG.filter(function(u){ const l=recNorm(t("rp4_s_"+u[0])); return !tecleado||!qn||l.indexOf(qn)>=0; });
  // Lo que entra o lo que mueves: el sentido se elige aquí, antes del nombre, porque cambia lo que se pregunta después.
  const flujoTipo=esFlujo&&React.createElement("div",{key:"fk",className:"rp4-modes",role:"radiogroup","data-rp4":"tipo"},
    [["income","gb_flow_income"],["transfer","gb_flow_move"]].map(function(k){
      const on=f.fk===k[0];
      return React.createElement("button",{type:"button",role:"radio","aria-checked":on?"true":"false",key:k[0],className:"rp4-mode"+(on?" on":""),"data-rp4-tipo":k[0],
        onClick:function(){ if(on) return; upd({fk:k[0],to:k[0]==="transfer"?(banks.find(function(b){ return b!==f.account; })||null):null}); toca("account"); }}, gbTxt(k[1]));
    }));
  const flujoSugs=esFlujo&&f.fk==="income"&&!edit&&React.createElement("div",{key:"fsg",className:"rp4-sugs"},
    ["fl_s_nomina","fl_s_pension"].map(function(k){
      const label=t(k), on=f.name===label;
      return React.createElement("button",{type:"button",key:k,className:"rp4-sug"+(on?" on":""),"aria-pressed":on?"true":"false","data-rp4-sug":k,onClick:function(){
        upd({name:label}); setTecleado(false); toca("name");
        clearTimeout(espera.current); espera.current=setTimeout(function(){ ir(1); },180);
      }}, label);
    }));
  const p0=panel(0,[
    flujoTipo,
    React.createElement("input",{key:"in",className:"pr6-search rp4-name","data-rp4":"name",value:f.name,placeholder:t(esFlujo?"fl_name_ph":"rp4_name_ph"),"aria-label":t("rp4_r_name"),
      onChange:function(e){ upd({name:e.target.value,category:""}); setTecleado(true); toca("name"); }}),
    flujoSugs,
    dupEl("dup"),
    !edit&&!qn&&visto.length>0&&React.createElement("div",{key:"vb",className:"rp4-visto","data-testid":"rp4-visto"},
      React.createElement("div",{className:"pr6-lbl"}, t("rp4_visto")),
      visto.map(function(d,i){
        return React.createElement("button",{type:"button",key:i,className:"pr6-cand","data-rp4-visto":i,onClick:function(){
          upd({name:d.name,category:d.cat,amount:rp4Raw(d.amount),day:d.day,account:banks.indexOf(d.bank)>=0?d.bank:f.account,mode:"rec",freq:"mes",months:[],variable:false});
          toca("name","amount","when","account");
          ir(4);
        }},
          React.createElement("span",{className:"pr6-dt rp4-dt-s","aria-hidden":"true"},
            React.createElement("span",{className:"d serif num"}, d.day||"—"),
            React.createElement("span",{className:"m"}, t("rp4_dia"))),
          React.createElement("span",{className:"pr6-cand-t"},
            React.createElement("span",{className:"pr6-cand-n"}, d.name),
            React.createElement("span",{className:"pr6-cand-s rp4-visto-bank"}, (d.cat?catName(d.cat)+" · ":"")+bankLabel(d.bank))),
          React.createElement("span",{className:"pr6-cand-a num"}, eur(d.amount)));
      })),
    !esFlujo&&sugs.length>0&&React.createElement("div",{key:"sg",className:"rp4-sugs"},
      sugs.map(function(u){
        const label=t("rp4_s_"+u[0]), on=f.name===label;
        return React.createElement("button",{type:"button",key:u[0],className:"rp4-sug"+(on?" on":""),"aria-pressed":on?"true":"false","data-rp4-sug":u[0],onClick:function(){
          const p={name:label,category:u[1]};
          if(u[0]==="hacienda"){ p.mode="split"; p.plan=null; }
          upd(p); setTecleado(false); toca("name"); if(p.mode) toca("when");
          clearTimeout(espera.current); espera.current=setTimeout(function(){ ir(1); },180);
        }},
          React.createElement("span",{className:"rp4-sug-i","aria-hidden":"true"},
            React.createElement("svg",{width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"},
              React.createElement("path",{d:RP4_ICO[u[0]]}))), label);
      }))
  ]);
  // 2 · Importe. El primer número que tecleas sustituye al que había.
  const p1=panel(1,[
    React.createElement("div",{key:"a",className:"rp4-amt"},
      React.createElement("span",{className:"rp4-dim"}, f.name||"—"),
      React.createElement("div",{className:"serif num rp4-amt-v"+(fresh&&f.amount?" fresh":""),"data-rp4":"amount"}, f.amount?eur(amt):eur(0)),
      !esFlujo&&React.createElement("button",{type:"button",className:"rp4-var"+(f.variable?" on":""),"aria-pressed":f.variable?"true":"false","data-rp4":"variable",
        onClick:function(){ upd({variable:!f.variable}); toca("amount"); }}, t("rp4_variable"))),
    React.createElement(NumPad,{key:"k",value:f.amount,onChange:function(fn){
      setF(function(o){
        const nuevo=fresh?fn(""):"";
        const v=fresh&&nuevo!==""?nuevo:fn(o.amount||"");
        return Object.assign({},o,{amount:v});
      });
      setFresh(false); toca("amount");
    }})
  ]);
  // 3 · Cuándo
  const dias=function(sel,pick){
    const out=[];
    for(let d=1;d<=31;d++) out.push(React.createElement("button",{type:"button",key:d,className:"rp4-day num"+(sel===d?" on":""),"aria-pressed":sel===d?"true":"false",
      "data-rp4-dia":d,onClick:function(){ pick(d); toca("when"); }}, d));
    return React.createElement("div",{className:"rp4-days",ref:diasRef}, out);
  };
  const tarjeta=function(x,i,n,soloUna){
    const ultimo=i===n-1;
    const meses=[];
    if(soloUna){ for(let k=0;k<12;k++){ const ym=cur+k, Y=Math.floor((ym-1)/12), M=ym-Y*12;
      meses.push({k:ym,on:f.once.ym===ym,dis:ym===cur&&today>=rp4DiasMes(ym),label:rp4MesTxt(M,Y,y),go:function(){
        const d=f.once.day?Math.min(f.once.day,rp4DiasMes(ym)):null;
        upd({once:{ym:ym,day:d&&rp4OnceOk({ym:ym,day:d},cur,today)?d:null}}); toca("when"); }}); } }
    else for(let M=1;M<=12;M++){ const usado=plan.some(function(o,j){ return j!==i&&o.m===M; }); meses.push({k:M,on:x.m===M,dis:usado,label:monthShort(M-1),go:function(){ setPlan(function(pl){ pl[i].m=M; }); toca("when"); }}); }
    const max=soloUna?onceDias:31;
    const mover=function(dir){
      toca("when");
      // Este mes, desde mañana: un puntual de hoy sin cargo contaría como pagado (rev. t4, B2).
      if(soloUna) setF(function(o){ const mx=rp4DiasMes(o.once.ym), mn=o.once.ym===cur?today+1:1;
        if(mn>mx) return o;
        const dd=o.once.day==null?(dir>0?mn:mx):o.once.day+dir;
        return Object.assign({},o,{once:{ym:o.once.ym,day:dd<mn?mx:dd>mx?mn:dd}}); });
      else setPlan(function(pl){ const dd=(pl[i].day||0)+dir; pl[i].day=dd<1?31:dd>31?1:dd; });
    };
    const dia=soloUna?f.once.day:x.day;
    return React.createElement("div",{key:i,className:"rp4-pago","data-rp4-pago":i},
      !soloUna&&React.createElement("div",{className:"rp4-pago-h"},
        React.createElement("span",{className:"rp4-pago-n","aria-hidden":"true"}, i+1),
        // Un pago guardado sin día enseña «—»: no se le pone uno que nadie dijo.
        React.createElement("span",{className:"num rp4-pago-f"}, (x.day||"—")+" "+monthShort(x.m-1)),
        ultimo?React.createElement("span",{className:"num rp4-pago-a rp4-dim","data-rp4":"resto"}, pr.resto>0?eur(pr.resto):"—")
          :React.createElement("button",{type:"button",className:"num rp4-pago-a"+(padFor===i?" on":""),"aria-label":tf("rp4_importe_pago",{n:i+1}),"data-rp4-importe":i,
            onClick:function(){ setPadFor(padFor===i?null:i); }}, x.amt?eur(parseNumPadRaw(x.amt)):"—"),
        n>2&&React.createElement("button",{type:"button",className:"rp4-x","aria-label":t("rp4_quitar_pago"),onClick:function(){ setPadFor(null); setPlan(function(pl){ pl.splice(i,1); }); toca("when"); }},"×")),
      !soloUna&&!ultimo&&React.createElement("div",{className:"pr6-fold"+(padFor===i?" open":"")},
        React.createElement("div",Object.assign({className:"pr6-fold-in"},padFor===i?null:{"aria-hidden":"true",inert:""}),
          React.createElement(NumPad,{value:x.amt,onChange:function(fn){ setPlan(function(pl){ pl[i].amt=fn(pl[i].amt||""); }); toca("when"); }}))),
      React.createElement("div",{className:"rp4-meses"}, meses.map(function(o){
        return React.createElement("button",{type:"button",key:o.k,className:"rp4-mes"+(o.on?" on":""),"aria-pressed":o.on?"true":"false",disabled:!!o.dis,onClick:o.go}, o.label);
      })),
      React.createElement("div",{className:"rp4-dia-row"},
        React.createElement(RpPaso,{label:t("rp4_dia_menos"),dir:-1,onStep:mover}),
        React.createElement("span",{className:"num rp4-dia-v","data-rp4":"dia"}, tf("rp4_dia_n",{d:dia?Math.min(dia,max):"—"})),
        React.createElement(RpPaso,{label:t("rp4_dia_mas"),dir:1,onStep:mover})));
  };
  const modo=function(k,label,disabled){
    const on=f.mode===k;
    return React.createElement("button",{type:"button",role:"radio","aria-checked":on?"true":"false",key:k,disabled:disabled,className:"rp4-mode"+(on?" on":""),"data-rp4-modo":k,
      onClick:function(){ if(edit&&kind==="oneoff") return; setPadFor(null); upd({mode:on?"rec":k}); toca("when"); if(!on) mostrar(pagosRef,true); }}, label);
  };
  const p2=panel(2,[
    React.createElement("div",{key:"fr",className:"pr6-fold"+(f.mode==="rec"?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in"},f.mode==="rec"?null:{"aria-hidden":"true",inert:""}),
        React.createElement("div",{className:"rp4-freqs",role:"radiogroup","aria-label":t("rp4_t_when")},
          RP4_FREQS.map(function(q){
            const on=f.freq===q[0];
            return React.createElement("button",{type:"button",role:"radio","aria-checked":on?"true":"false",key:q[0],className:"rp4-mode"+(on?" on":""),"data-rp4-freq":q[0],
              onClick:function(){ upd({freq:q[0],months:q[0]==="mes"?[]:(f.freq===q[0]?f.months:(q[0]==="año"?[]:chargeMonths({freq:q[0]})))}); toca("when"); if(q[0]!=="mes") mostrar(mesesRef); }}, gbTxt(q[1]));
          })))),
    React.createElement("div",{key:"md",className:"rp4-modes",role:"radiogroup"},
      modo("once",t("rp4_once"),edit&&kind==="fixed"),
      !esFlujo&&modo("split",t("rp4_split"),edit&&kind==="oneoff")),
    React.createElement("div",{key:"ms",className:"pr6-fold"+(f.mode==="rec"&&f.freq!=="mes"?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in"},f.mode==="rec"&&f.freq!=="mes"?null:{"aria-hidden":"true",inert:""}),
        React.createElement("div",{className:"pr6-lbl"}, gbTxt("gb_months_q")),
        React.createElement("div",{ref:mesesRef,className:"rp4-msel"},React.createElement(MonthPicker,{selected:f.months,onToggle:function(mm){
          setF(function(o){ const n=o.months.slice(), k=n.indexOf(mm); if(k>=0) n.splice(k,1); else n.push(mm); return Object.assign({},o,{months:n}); });
          toca("when");
          // Elegidos los meses falta el día, y quedaba debajo del botón: «ya no te muestra más
          // opciones» (beta 4.26.200). Se trae a la vista con un desplazamiento suave.
          mostrar(diasRef);
        }})),
        f.freq!=="mes"&&amt>0&&React.createElement("div",{className:"hint"}, fixedAddPreview(borrador())))),
    React.createElement("div",{key:"dd",className:"pr6-fold"+(diasListos?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in"},diasListos?null:{"aria-hidden":"true",inert:""}),
        dias(esFlujo&&f.when?null:cleanDay(f.day),function(d){ upd({day:d,when:""}); }),
        // Una nómina que cae el último día hábil cambia de día cada mes: la regla de siempre de las entradas.
        esFlujo&&React.createElement("div",{className:"rp4-modes",role:"radiogroup","data-rp4":"regla"},
          [["first","gb_when_first"],["last","gb_when_last"]].map(function(w){
            const on=f.when===w[0];
            return React.createElement("button",{type:"button",role:"radio","aria-checked":on?"true":"false",key:w[0],className:"rp4-mode"+(on?" on":""),"data-rp4-regla":w[0],
              onClick:function(){ upd({when:on?"":w[0]}); toca("when"); }}, gbTxt(w[1]));
          })))),
    React.createElement("div",{key:"pl",className:"pr6-fold"+(f.mode!=="rec"?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in rp4-pagos",ref:pagosRef},f.mode!=="rec"?null:{"aria-hidden":"true",inert:""}),
        f.mode==="once"&&tarjeta({},0,1,true),
        f.mode==="split"&&plan.map(function(x,i){ return tarjeta(x,i,plan.length,false); }),
        f.mode==="split"&&plan.length<12&&React.createElement("button",{type:"button",className:"pr6-more","data-rp4":"otro-pago",onClick:function(){
          toca("when");
          setPlan(function(pl){
            const ult=pl[pl.length-1], resto=rp4Plan(pl,parseNumPadRaw(f.amount)).resto;
            const libre=function(M){ return !pl.some(function(o){ return o.m===M; }); };
            let M=ult.m; for(let k=0;k<12&&!libre(M);k++) M=M%12+1;
            ult.amt=resto>0?rp4Raw(Math.round(resto/2*100)/100):"";
            pl.push({m:M,day:ult.day,amt:""});
          });
        }}, "+ "+t("rp4_otro_pago"))))
  ]);
  // 4 · Cuenta. Elegirla lleva al resumen. Un traspaso elige dos: de cuál sale y a cuál va (la segunda lleva al resumen).
  const bancoCand=function(b,on,attr,go){
    const bal=totals.bankBal&&Object.prototype.hasOwnProperty.call(totals.bankBal,b)?Number(totals.bankBal[b]):NaN;
    return React.createElement("button",Object.assign({type:"button",key:b,className:"pr6-cand"+(on?" on":""),"aria-pressed":on?"true":"false",onClick:go},attr),
      React.createElement(Mono,{ent:b,size:38}),
      React.createElement("span",{className:"pr6-cand-t"}, React.createElement("span",{className:"pr6-cand-n"}, entOf(b).label)),
      isFinite(bal)&&React.createElement("span",{className:"pr6-cand-a num"}, eur(bal)),
      React.createElement("span",{className:"pr6-ring"+(on?" on":""),"aria-hidden":"true"},"✓"));
  };
  const alResumen=function(){ clearTimeout(espera.current); espera.current=setTimeout(function(){ ir(4); },240); };
  const traspaso=esFlujo&&f.fk==="transfer";
  const p3=panel(3,[
    React.createElement("div",{key:"b",className:"pr6-cands"},
      banks.map(function(b){
        return bancoCand(b,f.account===b,{"data-rp4-banco":b},function(){
          upd(traspaso&&f.to===b?{account:b,to:null}:{account:b}); toca("account");
          if(!traspaso||f.to&&f.to!==b) alResumen();
        });
      })),
    traspaso&&React.createElement("div",{key:"dl",className:"pr6-lbl"}, t("fl_t_dest")),
    traspaso&&React.createElement("div",{key:"d",className:"pr6-cands","data-rp4":"destino"},
      banks.filter(function(b){ return b!==f.account; }).map(function(b){
        return bancoCand(b,f.to===b,{"data-rp4-destino":b},function(){ upd({to:b}); toca("account"); if(f.account) alResumen(); });
      }))
  ]);
  // 5 · Resumen
  const filas=[["rp4_r_name",f.name||"—",0],["rp4_r_amount",f.mode==="split"&&amt>0?tf("rp4_en_pagos",{x:eur(amt),n:plan.length}):amtTxt,1],
    [f.mode==="split"?"rp4_r_pays":f.mode==="once"?"rp4_r_date":"rp4_r_day",cuandoTxt,2],[traspaso?"fl_r_from":esFlujo?"fl_r_to":"rp4_r_account",bankLabel(f.account),3]]
    .concat(traspaso?[["fl_r_dest",bankLabel(f.to),3]]:[]);
  const pausa=edit&&kind==="fixed"&&vivo?pr6PausaTxt({kind:"fixed",item:vivo},cur):"";
  const baja=edit?pr6Baja(f.name):null;
  const mesNombre=lower(monthLong(m-1));
  // Más opciones › ¿Lo pagas con alguien? (SPEC §7): rejilla de personas, una fila por cada una
  // con su importe (vacío = a partes iguales) y tu parte, que es lo que queda.
  // La primera persona de un compartido de antes se lleva lo que no es tuyo: tu parte no cambia.
  const primeraDeViejo=function(o){ return viejo&&!o.reparto.length&&Number(it.bankAmount)>Number(it.amount)?rp4Raw(Math.round((it.bankAmount-it.amount)*100)/100):""; };
  const padFresco=useRef(null);
  const enReparto=function(id){ return f.reparto.some(function(x){ return x.id===id; }); };
  const ponQuita=function(q){
    setPadFor(null); toca("reparto");
    setF(function(o){ return Object.assign({},o,{reparto:o.reparto.some(function(x){ return x.id===q.id; })
      ?o.reparto.filter(function(x){ return x.id!==q.id; })
      :o.reparto.concat([{id:q.id,n:q.n,via:q.via,debtId:q.via==="debt"?q.debtId:null,amt:primeraDeViejo(o)}])}); });
  };
  const guardada=function(id){ return personasDe(state).some(function(p){ return p.id===id; }); };
  /* Más opciones › Prueba gratis y Permanencia (SPEC §7, decisión del dueño del 10/11/2026): una
     línea plegada con lo que hay («No» o la fecha) que se despliega en dos chips y un − / + que
     acelera al mantener pulsado, como el prototipo. La prueba se cuenta en días (el día en que
     empieza a cobrar) y la permanencia en meses; ninguna puede quedar antes de hoy. */
  const dos=function(n){ return String(n).padStart(2,"0"); };
  const hoyYmd=y+"-"+dos(m)+"-"+dos(today);
  const ymdMas=function(ymd,n){ const k=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd); return new Date(Date.UTC(+k[1],+k[2]-1,+k[3]+n)).toISOString().slice(0,10); };
  const diaMes=function(ymd){ const k=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd||""); return k?(+k[3])+" "+pr6Mes(+k[1]*12+(+k[2])):""; };
  const pruebaPaso=function(dir){
    toca("prueba");
    setF(function(o){ const n=ymdMas(o.prueba||ymdMas(hoyYmd,7-dir),dir); return Object.assign({},o,{prueba:n<hoyYmd?hoyYmd:n}); });
  };
  const permPaso=function(dir){
    toca("perm");
    setF(function(o){ return Object.assign({},o,{perm:Math.max(cur,(o.perm||cur+12-dir)+dir)}); });
  };
  const chip7=function(k,label,on,go){ return React.createElement("button",{type:"button",key:k,className:"rp7-chip"+(on?" on":""),"aria-pressed":on?"true":"false","data-rp7-chip":k,onClick:go},label); };
  const extraFila=function(key,label,val,on,cuerpo){
    const open=extra===key;
    return React.createElement("div",{key:key,className:"rp7-x","data-rp7":key},
      // Lo desplegado quedaba bajo «Guardar» y había que subir la hoja a mano (auditoría 226, P1-1).
      React.createElement("button",{type:"button",ref:extraBtnRefs[key],className:"rp7-row","aria-expanded":open?"true":"false",onClick:function(){ setExtra(open?null:key); if(open) ocultar(extraRefs[key]); else mostrar(extraRefs[key],extraBtnRefs[key]); }},
        React.createElement("span",{className:"rp7-k"}, label),
        React.createElement("span",{className:"rp7-v num"+(on?"":" rp4-dim"),"data-rp7-valor":key}, val),
        pr6Chev()),
      React.createElement("div",{className:"pr6-fold"+(open?" open":"")},
        React.createElement("div",Object.assign({className:"pr6-fold-in rp7-in",ref:extraRefs[key]},open?null:{"aria-hidden":"true",inert:""}), cuerpo)));
  };
  const extrasUI=[
    extraFila("prueba",t("rp7_prueba"),f.prueba?tf("rp7_hasta_dia",{x:diaMes(f.prueba)}):t("rp7_no"),!!f.prueba,[
      React.createElement("div",{key:"c",className:"rp7-chips"},
        chip7("sin",t("rp7_sin_prueba"),!f.prueba,function(){ toca("prueba"); upd({prueba:null}); }),
        chip7("mes",t("rp7_un_mes"),false,function(){ toca("prueba"); upd({prueba:ymdMas(hoyYmd,30)}); })),
      React.createElement("div",{key:"p",className:"rp4-dia-row"},
        React.createElement(RpPaso,{label:t("rp4_dia_menos"),dir:-1,onStep:pruebaPaso}),
        React.createElement("span",{className:"num rp4-dia-v rp7-fecha","data-rp7-fecha":"prueba"}, f.prueba?tf("rp7_empieza",{x:diaMes(f.prueba)}):"—"),
        React.createElement(RpPaso,{label:t("rp4_dia_mas"),dir:1,onStep:pruebaPaso}))]),
    extraFila("perm",t("rp7_perm"),f.perm?tf("rp7_hasta",{x:pr6MesAno(f.perm)}):t("rp7_no"),!!f.perm,[
      React.createElement("div",{key:"c",className:"rp7-chips"},
        chip7("sin",t("rp7_sin_perm"),!f.perm,function(){ toca("perm"); upd({perm:null}); }),
        chip7("ano",t("rp7_un_ano"),false,function(){ toca("perm"); upd({perm:cur+12}); })),
      React.createElement("div",{key:"p",className:"rp4-dia-row"},
        React.createElement(RpPaso,{label:t("rp7_mes_menos"),dir:-1,onStep:permPaso}),
        React.createElement("span",{className:"num rp4-dia-v rp7-fecha","data-rp7-fecha":"perm"}, f.perm?tf("rp7_hasta",{x:pr6MesAno(f.perm)}):"—"),
        React.createElement(RpPaso,{label:t("rp7_mes_mas"),dir:1,onStep:permPaso}))])];
  const repUI=kind==="fixed"&&f.mode!=="once"&&React.createElement("div",{key:"mas",className:"rp5-mas"},
    React.createElement("button",{type:"button",ref:masBtnRef,className:"pr6-more","aria-expanded":mas?"true":"false","data-act":"mas-opciones",onClick:function(){ setMas(function(o){ return !o; }); if(mas) ocultar(masRef); else mostrar(masRef,masBtnRef); }},
      t("rp5_mas"), pr6Chev()),
    React.createElement("div",{className:"pr6-fold"+(mas?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in rp5-in",ref:masRef},mas?null:{"aria-hidden":"true",inert:""}),
        React.createElement("div",{className:"pr6-lbl"}, t("rp5_con_alguien")),
        !admite?React.createElement("div",{className:"hint"}, t("rp5_no_admite"))
          :React.createElement("div",{className:"rp5-grid","data-testid":"rp5-grid"},
            conocidas.map(function(q){
              const on=enReparto(q.id);
              return React.createElement("button",{type:"button",key:q.id,className:"rp5-ava"+(on?" on":""),"aria-pressed":on?"true":"false","data-persona":q.id,
                disabled:q.via==="debt"&&!mensual&&!on,onClick:function(){ ponQuita(q); }},
                React.createElement("span",{className:"pe-ava","aria-hidden":"true"}, pr6Inicial(q.n)),
                React.createElement("span",{className:"rp5-ava-n"}, q.n));
            }),
            React.createElement("button",{type:"button",className:"rp5-ava","data-act":"persona-otra",onClick:function(){ setPersona({draft:true}); }},
              React.createElement("span",{className:"pe-ava","aria-hidden":"true"},"+"),
              React.createElement("span",{className:"rp5-ava-n"}, t("rp5_otra")))),
        f.reparto.map(function(x,i){
          const q=deQuien(x), r=rr&&rr.partes[i], k="r"+x.id, tecleo=parseNumPadRaw(x.amt)>0;
          return React.createElement("div",{key:x.id,className:"rp5-row","data-rp5-persona":x.id},
            React.createElement("div",{className:"rp5-row-h"},
              React.createElement("button",{type:"button",className:"rp5-nm",onClick:function(){ if(guardada(x.id)) setPersona({pid:x.id}); }},
                React.createElement("span",{className:"rp5-nm-n"}, q.n),
                React.createElement("span",{className:"rp4-dim"}, peViaTxt(state,q))),
              React.createElement("button",{type:"button",className:"num rp4-pago-a"+(padFor===k?" on":"")+(tecleo?"":" rp5-auto"),"data-rp5-importe":x.id,"aria-label":tf("rp5_importe_de",{name:q.n}),
                onClick:function(){ padFresco.current=padFor===k?null:k; setPadFor(padFor===k?null:k); }}, tecleo?eur(parseNumPadRaw(x.amt)):r&&r.amt>0?eur(r.amt):"—"),
              React.createElement("button",{type:"button",className:"rp4-x","aria-label":tf("rp5_quitar",{name:q.n}),onClick:function(){ ponQuita(q); }},"×")),
            React.createElement("div",{className:"pr6-fold"+(padFor===k?" open":"")},
              React.createElement("div",Object.assign({className:"pr6-fold-in"},padFor===k?null:{"aria-hidden":"true",inert:""}),
                React.createElement(NumPad,{value:x.amt,onChange:function(fn){
                  toca("reparto");
                  // Como en el importe: el primer número al abrir el teclado sustituye la parte que había.
                  const fresco=padFresco.current===k; padFresco.current=null;
                  setF(function(o){ return Object.assign({},o,{reparto:o.reparto.map(function(z){
                    if(z.id!==x.id) return z;
                    const nuevo=fresco?fn(""):"";
                    return Object.assign({},z,{amt:fresco&&nuevo!==""?nuevo:fn(z.amt||"")}); })}); });
                }}))));
        }),
        roto.length>0&&React.createElement("div",{className:"hint","data-testid":"rp5-rehacer"}, t("rp5_rehacer")),
        rr&&!rr.ok&&rr.mia<=0&&React.createElement("div",{className:"hint","data-testid":"rp5-supera"}, t("rp5_supera")),
        admite&&!mensual&&conocidas.some(function(q){ return q.via==="debt"; })&&React.createElement("div",{className:"hint","data-testid":"rp5-solo-mensual"}, t("rp5_descuento_mensual")),
        (rr||viejo)&&React.createElement("div",{className:"pr6-ll-row rp5-mine","data-testid":"rp5-tu-parte"},
          React.createElement("span",null, t("rp5_tu_parte")),
          React.createElement("span",{className:"num"+(rr&&!rr.ok?" rp5-mal":"")}, rr?(rr.ok?eur(rr.mia):"—"):eur(it.amount))),
        extrasUI)));
  const p4=panel(4,[
    React.createElement("div",{key:"h",className:"pr6-ficha-h rp4-sum-h"},
      React.createElement("span",{className:"pr6-dt","aria-hidden":"true"},
        React.createElement("span",{className:"d serif num"}, f.mode==="once"?(f.once.day||"—"):proximo?(proximo.day||"—"):(cleanDay(f.day)||"—")),
        React.createElement("span",{className:"m"}, f.mode==="once"?monthShort(onceM-1):proximo?monthShort(proximo.m-1):t("rp4_dia"))),
      React.createElement("span",{className:"pr6-ficha-t"},
        React.createElement("span",{className:"pr6-ficha-n"}, f.name||"—"),
        React.createElement("span",{className:"pr6-ficha-s"}, subTxt)),
      React.createElement("span",{className:"serif num pr6-ficha-a","data-rp4":"sum-amt"}, amtTxt)),
    dupEl("dup"),
    React.createElement("div",{key:"r",className:"rp4-rows"},
      filas.map(function(r){
        // Un compartido de antes no dice de quién es el resto: su importe espera a que lo digas.
        const bloqueado=r[2]===1&&viejo&&!f.reparto.length;
        return React.createElement("button",{type:"button",key:r[0],className:"rp4-row","data-rp4-fila":r[2],disabled:bloqueado,onClick:function(){ ir(r[2]); }},
          React.createElement("span",{className:"rp4-row-k"}, t(r[0])),
          React.createElement("span",{className:"rp4-row-v num"}, r[1]),
          !bloqueado&&pr6Chev());
      })),
    repUI,
    conScope&&React.createElement("div",{key:"sc",className:"rp4-scope",role:"radiogroup","aria-label":t("rp4_scope"),"data-testid":"rp4-scope"},
      [["mes",tf("rp4_solo_mes",{m:mesNombre})],["desde",t("pr6_desde_ahora")]].map(function(o){
        const on=scope===o[0];
        return React.createElement("button",{type:"button",role:"radio","aria-checked":on?"true":"false",key:o[0],className:"rp4-mode"+(on?" on":""),"data-rp4-scope":o[0],
          onClick:function(){ setScope(o[0]); }}, o[1]);
      })),
    conScope&&scope==="mes"&&amt>0&&React.createElement("div",{key:"scx",className:"hint","data-testid":"rp4-scope-mes"}, tf("rp4_mes_cobra",{x:eur(amt)})),
    pausa&&React.createElement("button",{type:"button",key:"pa",className:"pr6-btn pr6-btn-wide","data-act":"bill-resume",
      onClick:function(){ set(function(s){ return fixedPausa(s,row.id,0,0); }); }}, pr6Cap(pausa)+" · "+t("pr6_reanudar")),
    edit&&gone&&baja&&React.createElement("a",{key:"bj",className:"pr6-baja",href:baja.url,target:"_blank",rel:"noopener noreferrer"}, tf("rp4_baja_antes",{name:baja.name})),
    edit&&React.createElement("button",{type:"button",key:"x",className:"pr6-btn pr6-btn-wide"+(gone?" pr6-seguro":""),"data-act":"bill-remove",
      onClick:function(){ if(!gone){ setGone(true); return; } onRemove(row); }}, gone?t("pr6_seguro_borrar"):t("pr6_ya_no"))
  ]);
  // La ficha de persona va fuera de la hoja: sus gestos y toques no pueden subir hasta esta.
  return React.createElement(React.Fragment,null,React.createElement("div",{ref:sideRef,className:"v4-sheet-back mc-edge-back",onClick:swipe.close},
    React.createElement("div",Object.assign({ref:sheetRef,className:"v4-sheet pr6-ficha rp4","data-sheet":"recibo-pasos","data-paso":paso,"data-modo":edit?"edit":"add",
      role:"dialog","aria-modal":"true","aria-labelledby":"rp4-title",
      onClick:function(e){
        e.stopPropagation();
        // «¿Seguro? Borrar» se cancela tocando en cualquier otro sitio (SPEC §7, §10).
        if(gone&&!(e.target.closest&&e.target.closest('[data-act="bill-remove"],.pr6-baja'))) setGone(false);
      }},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"rp4-top"},
        React.createElement("button",{type:"button",className:"pr6-back","data-act":"back","aria-label":paso===(edit?4:0)?t("rp4_cerrar"):t("v4_back"),onClick:side.close},"‹"),
        !edit&&React.createElement("div",{className:"rp4-prog","aria-hidden":"true"},
          [0,1,2,3].map(function(i){ return React.createElement("i",{key:i,className:paso>=i?"on":""}); }))),
      React.createElement("div",{ref:bodyRef,className:"rp4-body"},
        React.createElement("div",{ref:trackRef,className:"pr6-track rp4-track",style:{transform:"translateX("+(-paso*100)+"%)"}}, p0,p1,p2,p3,p4)),
      React.createElement("div",{className:"rp4-foot"},
        React.createElement("button",{type:"button",className:"pr6-cta rp4-cta"+(ctaOn?"":" is-wait"),"data-act":paso===4?"confirm":"next","data-rp4-cta":"1",
          "aria-disabled":ctaOn?"false":"true",tabIndex:ctaOn?0:-1,onClick:function(e){ if(!ctaOn) return; siguiente(e); }}, ctaLabel)))),
    persona&&React.createElement(PersonaSheet,{key:persona.pid||"nueva",pid:persona.pid,draft:!!persona.draft,mensual:mensual,sinBorrar:true,state:state,set:set,totals:totals,
      onClose:function(){ setPersona(null); },
      onCreate:function(q){
        setNuevas(function(o){ return o.concat([q]); });
        toca("reparto");
        setF(function(o){ return Object.assign({},o,{reparto:o.reparto.concat([{id:q.id,n:q.n,via:q.via,debtId:q.via==="debt"?q.debtId:null,amt:primeraDeViejo(o)}])}); });
      }}));
}

function bankListButtons(banks, current, onPick){
  return React.createElement("div",{className:"v4-bills-banks"},
    (banks||[]).map(function(b){
      return React.createElement("button",{type:"button",key:b,className:"v4-bills-bank"+(current===b?" on":""),onClick:function(){ onPick(b); }},
        React.createElement(Mono,{ent:b,size:28}), entOf(b).label);
    }));
}

function BillsAddWizard({step, setStep, form, setForm, banks, onClose, set, onSaved}){
  const setF=function(patch){ setForm(function(f){ return Object.assign({},f,patch); }); };
  const freqs=[["mes","gb_freq_m"],["bimestral","gb_freq_2m"],["trimestral","gb_freq_3m"],["semestral","gb_freq_6m"],["año","gb_freq_y"]];
  const stepRef=React.useRef(step), formRef=React.useRef(form);
  const savedRef=React.useRef(false);
  const titleRef=React.useRef(null);
  const sideRef=React.useRef(null);
  const onCloseRef=React.useRef(onClose);
  onCloseRef.current=onClose;
  const swipe=useSheetSwipe(true,function(){ onCloseRef.current&&onCloseRef.current(); },{nativeScroll:true});
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
  const stepBackRef=React.useRef(stepBack);
  stepBackRef.current=stepBack;
  useBackClose(true,function(){ stepBackRef.current(); },step);
  // El primer paso ya sale con la ola: la de bajada de la hoja (`hoja`), nunca de lado; los demás
  // vuelven un paso con su transición (vídeo del dueño, 8/11).
  const side=useEdgePageClose(true,stepBack,step,sideRef,{plainScroll:true,hoja:swipe.close,soloPaso:function(){ return stepRef.current!=="what"; }});
  React.useLayoutEffect(function(){
    // El fondo persiste entre pasos; cada Atrás debe dejar el anterior centrado y listo para otro.
    const el=sideRef.current; if(!el) return;
    el.classList.remove("mc-page-dragging");
    el.style.cssText="";
  },[step]);
  // Solo reenfocar título al cambiar de paso — nunca al teclear el form (Codex 2120Z).
  React.useEffect(function(){
    var id=requestAnimationFrame(function(){ if(titleRef.current) titleRef.current.focus(); });
    return function(){ cancelAnimationFrame(id); };
  },[step]);
  // Trap Tab/Escape estable (stepBack vía ref).
  React.useEffect(function(){
    var onKey=function(e){
      if(document.documentElement.classList.contains("ask-open")) return;
      if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); side.close(); return; }
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
  const fixedDraft=function(amt){
    const it={name:form.name||"Recibo",amount:amt,freq:form.freq||"mes",account:form.account};
    if(form.freq!=="mes"&&form.months&&form.months.length) it.months=form.months.slice().sort(function(a,b){ return a-b; });
    return it;
  };
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
      const it=conMesDeAlta(Object.assign({id:uid()},fixedDraft(amt)));
      const d=cleanDay(form.day); if(d) it.day=d;
      addFixedItem(set,it);
    }
    onSaved(form.kind==="flow"?(form.flowKind||"income"):form.kind,String(form.name||"").trim());
    swipe.close();
  };
  // La vista previa lee el MISMO recibo que se guardará: si no, vuelve a contar otra cosa (FIN-21).
  const preview=function(){
    const amt=parseFloat(String(form.amount).replace(",","."))||0;
    if(!(amt>0)||form.kind!=="fixed") return null;
    return fixedAddPreview(fixedDraft(amt));
  };
  const title=step==="what"?gbTxt("gb_step_what"):step==="amount"?gbTxt("gb_step_how_much"):
    step==="freq"?gbTxt("gb_step_how_often"):step==="months"?gbTxt("gb_months_q"):
    step==="monthyear"?gbTxt("gb_step_monthyear"):gbTxt("gb_step_when");
  return React.createElement("div",{ref:sideRef,className:"v4-sheet-back mc-edge-back",onClick:swipe.close},
    React.createElement("div",Object.assign({ref:sheetRef,className:"v4-sheet","data-sheet":"bill-add","data-step":step,role:"dialog","aria-modal":"true","aria-labelledby":titleId,
      onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"settings-push-h",style:{padding:"0 0 8px"}},
        React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:side.close},"‹"),
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

/* La cifra grande de Cartera, en su propio componente (20/10/2026). La transición (B2, al
   ACTIVAR Cartera por el bus: premontaje e IntersectionObserver se probaron y fallan) repinta en
   cada frame mientras dura; dentro de CarteraTab eso era repintar también las dos listas de
   cuentas, los bienes y las inversiones ~57 veces en 950 ms. Aquí solo se repinta el número. */
function CarteraHeroAmt({target}){
  const [carteraOn,setCarteraOn]=useState(false);
  useEffect(function(){ return mcOnCarteraActive(setCarteraOn); },[]);
  const ph=eurParts(useCountUp(target, carteraOn));
  return React.createElement("div",{className:"serif num cartera-hero-amt",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6}},
    ph.ent, React.createElement("span",{style:{fontSize:22,color:"var(--muted)"}},ph.sep+ph.dec+" "+ph.sym));
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
  const heroTarget=allOn ? (totals.netWorth||0) : active.reduce(function(a,x){ return a+x.v; },0);
  return React.createElement("div",{className:"v4-screen"},
    React.createElement("h1",{className:"v4-title serif"}, t("v4_cartera_title")),
    React.createElement("div",{className:"v4-card v4-card-hero rise",style:{animationDelay:".05s"}},
      React.createElement("div",{className:"v4-micro"}, heroLab),
      React.createElement(FxNotice,{missing:totals.fxMissing}),
      React.createElement(CarteraHeroAmt,{target:heroTarget}),
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
       `OrderableSections` guarda el orden en settings.secOrder.cartera, así que viaja con la
       cuenta y está en el sitio donde el usuario ya sabe buscarlo («⇅ Ordenar secciones» al pie).
       Se inventó un mecanismo nuevo cero: el que había ya hacía justo esto (hoy solo lo usa Cartera). */
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
        React.createElement(Wealth,{state:state,set:set,totals:totals,parte:"cuentas",showToast:showToast,
          onBankSync:doBankSync,onReconnectBank:onReconnectBank,bankBusy:bankBusy})
      ) },
      // Bienes (piso, coche…) es su propio bloque: no son cuentas de banco y el usuario quiere
      // colocarlos donde le apetezca (feedback 2026-07-25).
      { id:"bienes", label:t("pt_goods"), el:React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-sec-h"}, t("pt_goods")),
        React.createElement(Wealth,{state:state,set:set,totals:totals,parte:"bienes"})
      ) },
      // `data-cartera-sec`: aquí aterriza «Abrir en Cartera ›» de la fila gris de Inversiones de
      // Gastos (`goInversiones`, 11-app-main), aunque el bloque se haya reordenado.
      !simple && { id:"inversiones", label:t("v4_inversiones"), el:React.createElement("div",{className:"rise","data-cartera-sec":"inversiones",style:{animationDelay:".12s"}},
        React.createElement("div",{className:"v4-sec-h"}, t("v4_inversiones")),
        React.createElement(Investments,{state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,syncInv:syncInv,showToast:showToast}),
        React.createElement("button",{type:"button",className:"v4-link-mini",style:{marginTop:10},ref:invLinkRef,onClick:function(){ setInvTools(true); }}, t("iv_see_all")+" ›")
      ) }
    ]}),
    // La hija vive FUERA de los bloques ordenables: es un portal, no una sección, y meterla
    // dentro la desmontaría al reordenar (cerrándose sola a media consulta).
    !simple && React.createElement(InvestmentsPush,{open:invTools,onClose:closeInvestments,state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,syncInv:syncInv,totals:totals,showToast:showToast})
  );
}

function InvestmentsPush({open, onClose, state, set, fetchPrices, pricing, syncInv, totals, showToast}){
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
      React.createElement(Investments,{state:state,set:set,fetchPrices:fetchPrices,pricing:pricing,syncInv:syncInv,totals:totals,fullMode:true,showToast:showToast})
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
  const fxHint=entryCur!=="EUR" ? (toEurAmt(amt,entryCur,state)==null?t("fx_no_rate"):tf("f_fx_eq",{
    x:NF.format(toEurAmt(amt,entryCur,state))+" €",date:fmtIsoCorto(state.fxDate||date)
  })) : null;
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
  return { handle:p.handle||"", fullName:p.fullName||"" };
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
        // Ni "empty" a secas: es la clase GLOBAL de estado vacío (padding 34px y centrado) y
        // convertía cada «Añadir» en una caja de 127 px — el perfil vacío medía 1.787 px (INC-2709-10).
        React.createElement("div",{className:"pr-val"+(empty?" pr-val-empty":"")}, empty?t("pf_add"):value)
      ),
      React.createElement("span",{className:"pr-edit","aria-hidden":"true"}, "✎")
    );
  };
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
      row(t("pf_basic"), val(p.fullName), function(){ edit("fullName", t("pf_name"), t("pf_name_ph")); }),
      row(t("pf_email"), email||null, function(){
        if(onOpenSettings) onOpenSettings();
      })
    ),
    React.createElement("p",{style:{fontSize:12,color:"var(--muted-2)",lineHeight:1.45,margin:"18px 2px 0"}}, t("pf_hint")),
    onOpenSettings && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:14},onClick:function(){ onClose(); onOpenSettings(); }}, t("pf_to_settings"))
  );
}
