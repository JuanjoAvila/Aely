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
  // Modo sencillo: solo Recibos (spec §2).
  const segs=simple
    ? [{id:"recibos",lab:t("v4_plan_recibos")}]
    : [{id:"recibos",lab:t("v4_plan_recibos")},{id:"deudas",lab:t("v4_plan_deudas")},{id:"metas",lab:t("v4_plan_metas")}];
  const charges=useMemo(function(){
    return planChargesMonth(state, totals.curMonth, totals.curYear, totals.today);
  },[state.fixed,state.debts,state.oneoffs,state.flows,state.bankTx,state.accounts,state.expenses,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,totals.curMonth,totals.curYear,totals.today]);
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
      const dest=Math.max(0,Math.min(max,Math.round(y+pr.top-quiero)));
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

  return React.createElement("div",{className:"v4-screen",ref:planScreenRef,"data-edge-capture":simple?null:"1"},
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
          className:"v4-seg-btn"+(seg===s.id?" on":""),onClick:function(){ if(seg!==s.id) mcTickHaptic(); setSeg(s.id); }}, s.lab);
      })
    ),
    capa("recibos", simple
      ? React.createElement(PlanBills,{state:state,set:set,totals:totals,charges:charges,evidence:evidence,manageOpen:manageOpen,setManageOpen:setManageOpen})
      : React.createElement(PlanRecibos,{state:state,set:set,totals:totals,charges:charges,evidence:evidence,manageOpen:manageOpen,setManageOpen:setManageOpen,
          manageEdit:manageEdit,setManageEdit:setManageEdit,showToast:showToast,onGoDebts:irADeuda})),
    !simple && capa("deudas", React.createElement(Debts,{state:state,set:set,showToast:showToast})),
    !simple && capa("metas", React.createElement(Goals,{state:state,set:set,totals:totals,showToast:showToast}))
  );
}

/* Recibos en modo SENCILLO: la portada compacta que ya funcionaba. El rediseño v6 (`PlanRecibos`)
   es para el modo normal y el sencillo sigue como estaba (SPEC Plan Recibos §0). Aquí no hay
   «Gestionar»: la puerta vive en Ajustes → Cambiar mis recibos (NO-GO §5bis.2). */
function PlanBills({state, set, totals, charges, evidence, manageOpen, setManageOpen}){
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
        React.createElement("div",{className:"meta"}, rowSub(x))
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
    React.createElement(BillsManagePush,{open:manageOpen,onClose:function(){ setManageOpen(false); },state:state,set:set,totals:totals,simple:true})
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
   Prueba gratis y permanencia no salen: hoy ningún recibo guarda esas fechas (llegan con el alta
   por pasos, tanda 4) y un aviso sin dato sería inventado. */
const PR6_DIF_CENT=50, PR6_FANTASMA_MIN=2, PR6_MESES_ATRAS=12, PR6_FANTASMA_CALLA=3;
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
      if(!occursIn(f,p.m)) continue;
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
  // Mes a mes y no recibo a recibo: el índice de gastos se rehace al cambiar de mes y con veinte
  // mil movimientos recorrerlo una vez por recibo y mes se notaría en el móvil.
  const cands=pack.pendingBills.map(function(x){ return {x:x,f:reciboDe(x.id),miss:0,last:0,done:false}; }).filter(function(c){ return c.f; });
  const meses=cands.length?pr6MesesConBanco(s):null;
  for(let k=1;k<=PR6_MESES_ATRAS;k++){
    const vivos=cands.filter(function(c){ return !c.done; });
    if(!vivos.length) break;
    const p=atras(k), clave="|"+p.y+"-"+String(p.m).padStart(2,"0");
    vivos.forEach(function(c){
      const f=c.f;
      if(!occursIn(f,p.m)||!(occAmountIn(f,p.m)>0)||fixedPausedIn(f,p.y,p.m)) return;
      if(fixedPaymentEvidence(fixedPaymentState(s,f,p.y,p.m,p.fin))){ c.last=p.ym; c.done=true; return; }
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
    else if(a&&a.rv==="ghost") review.push(Object.assign({},x,{rv:"ghost",meses:a.meses}));
    else if(x.overdue&&x.day!=null&&today-x.day>PR6_MARGEN_DIAS) review.push(Object.assign({},x,{rv:"late"}));
    else due.push(x);
  });
  /* Pagado solo por calendario (sin cargo del banco detrás): no se enseña como pagado ni suma en
     lo pendiente, igual que el «Por confirmar» de antes (INC-1810-03/04). Es lo que hay que mirar. */
  pack.paidBills.forEach(function(x){
    const a=avisos[x.id];
    if(proof.confirmed[x.id]===false) review.push(Object.assign({},x,{paid:false,unconfirmed:true,rv:"unconf"}));
    else if(a&&(a.rv==="diff"||a.rv==="up")&&!pospuesto[x.id]) review.push(Object.assign({},x,{rv:a.rv,cobrado:a.cobrado,previsto:a.previsto}));
    else paid.push(x);
  });
  const byDay=function(a,b){ return (a.day==null?99:a.day)-(b.day==null?99:b.day); };
  // Prioridad de la SPEC: primero lo que no se ha cobrado, luego lo que se cobró raro.
  const prio={ghost:1,late:1,unconf:2,diff:2,up:2};
  review.sort(function(a,b){ return (prio[a.rv]-prio[b.rv])||byDay(a,b); });
  const week=pack.pendingBills.filter(function(x){ return x.day!=null&&x.day-today>=0&&x.day-today<=6; }).length;
  const paidTotal=paid.reduce(function(sum,x){ return sum+Math.abs(x.amount); },0);
  return {review:review, due:due, paid:paid, week:week, paidTotal:paidTotal, paidChanged:paid.some(planChargeChanged)};
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
    const b={bank:bank, known:false, bal:null, pend:Number(pack.pendingByBank[bank])||0, min:null, minDay:null, shortDay:null, falta:0,
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
   tres días sería mentir. Sin lectura (cuenta a mano, TR por el puente) no hay frescura: 0. */
function pr6LecturaMs(state, bank){
  let ms=0;
  const at=(state&&state.obBalAt)||{};
  Object.keys(at).forEach(function(asp){
    if(entFromAspsp(asp)!==bank) return;
    const v=dateMs(at[asp]);
    if(v>0&&(!ms||v<ms)) ms=v;
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
function PlanRecibos({state, set, totals, charges, evidence, manageOpen, setManageOpen, manageEdit, setManageEdit, showToast, onGoDebts}){
  const [revOpen,setRevOpen]=useState(false);
  const [dueOpen,setDueOpen]=useState(false);
  const [paidOpen,setPaidOpen]=useState(false);
  const [ficha,setFicha]=useState(null);
  const [llegaOpen,setLlegaOpen]=useState(false);
  const paidRef=useRef(null);
  const [pospuesto,setPospuesto]=useState(pr6PospuestoLeer);
  const [deshacer,setDeshacer]=useState(null);
  const deshacerT=useRef(0);
  useEffect(function(){ return function(){ clearTimeout(deshacerT.current); }; },[]);
  const month=totals.curMonth, today=totals.today, year=totals.curYear;
  const pack=charges||planChargesMonth(state, totals.curMonth, totals.curYear, today);
  const proof=evidence||paymentEvidenceUI(state,totals.curYear,totals.curMonth,today);
  // `pack` y `proof` ya dependen de recibos, gastos y extracto; `revisado` vive en el recibo.
  const avisos=useMemo(function(){ return planRecibosAvisos(state,pack,proof,year,month,today); },[pack,proof,state.fixed,year,month,today]);
  const v=useMemo(function(){ return planRecibosVista(pack,proof,today,avisos,pospuesto); },[pack,proof,today,avisos,pospuesto]);
  // Pausados este mes: no suman ni salen como pendientes, pero se ven tachados en «Ya pagados»
  // para poder devolverlos al mes con un toque (SPEC §2.5).
  const pausados=useMemo(function(){
    return (state.fixed||[]).filter(function(f){ return occursIn(f,month)&&occAmountIn(f,month)>0&&fixedEnPausa(state,f,year,month,today); });
  },[pack,state.fixed,year,month,today]);
  const posponer=function(x){
    const next=Object.assign({},pr6PospuestoLeer(),{[x.id]:pr6Hoy()});
    pr6PospuestoGuardar(next); setPospuesto(next);
    clearTimeout(deshacerT.current);
    setDeshacer({id:x.id,name:x.name});
    deshacerT.current=setTimeout(function(){ setDeshacer(null); },5000);
  };
  const quitarPospuesto=function(){
    if(!deshacer) return;
    const next=Object.assign({},pr6PospuestoLeer()); delete next[deshacer.id];
    pr6PospuestoGuardar(next); setPospuesto(next);
    clearTimeout(deshacerT.current); setDeshacer(null);
  };
  const devolverAlMes=function(f){
    const cur=year*12+month;
    set(function(s){ const e=(s.fixed||[]).find(function(o){ return o.id===f.id; }); return e?fixedPausa(s,e.id,cur+1,Number(e.pausedUntil)||0):s; });
    if(showToast) showToast(tf("pr6_vuelve_toast",{name:f.name}));
  };
  const llega=useMemo(function(){ return planRecibosLlega(totals,pack); },[totals.minByBank,totals.minDayByBank,totals.bankBal,pack]);
  useBackClose(!!paidOpen, function(){ setPaidOpen(false); });
  const openManage=function(){ setManageEdit(null); setManageOpen(true); };
  const abrir=function(x){
    if(x.kind==="debt"||x.kind==="balloon"){ if(onGoDebts) onGoDebts(String(x.id).replace(/^(debt|balloon)_/,"")); return; }
    if(/^(fixed|oneoff)_/.test(String(x.id))) setFicha({id:x.id});
  };
  // El desplegable se ve entero: mueve la página lo justo, sin escribir scrollTop a mano (INC-0710-01).
  const verPlegado=function(el){
    if(!el) return;
    setTimeout(function(){ try{ el.scrollIntoView({block:"nearest",behavior:mcReduced()?"auto":"smooth"}); }catch(e){} },380);
  };
  const conflictOf=function(x){
    const match=String(x.id).match(/^(fixed|debt|balloon)_(.*)$/),kind=match&&match[1]!=="fixed"?"debts":"fixed";
    const item=match&&(state[kind]||[]).find(function(e){return String(e.id)===match[2];});
    return item&&planSyncConflict(state,kind,item.id);
  };
  const subOf=function(x){
    if(x.kind==="debt"||x.kind==="balloon") return t("fj_debt_tag")+" · "+entOf(x.bank).label;
    const f=/^fixed_/.test(String(x.id))&&(state.fixed||[]).find(function(e){ return "fixed_"+e.id===x.id; });
    return (f&&f.category&&CAT[f.category]?catName(f.category)+" · ":"")+entOf(x.bank).label;
  };
  const cuando=function(x){
    if(x.day==null) return "";
    const n=x.day-today;
    if(n===0) return t("pr6_hoy");
    if(n===1) return t("pr6_manana");
    if(n>1) return tf("pr6_en_dias",{n:n});
    return n===-1?t("pr6_tocaba_ayer"):tf("pr6_tocaba",{n:-n});
  };
  // Las filas plegadas siguen en el DOM (se despliegan con transición), pero fuera del foco.
  const plegado=function(open){ return open?null:{"aria-hidden":"true",inert:""}; };
  const dueRow=function(x){
    const n=x.day==null?null:x.day-today;
    return React.createElement("button",{type:"button",className:"v4-charge pr6-row",key:x.id,"data-recibo":x.id,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"dt","aria-hidden":"true"},
        React.createElement("span",{className:"d"}, x.day||"—"),
        React.createElement("span",{className:"m"}, monthShort(month-1))),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name,React.createElement(PlanConflictDot,{record:conflictOf(x)})),
        React.createElement("span",{className:"sub"}, subOf(x)),
        x.day!=null&&React.createElement("span",{className:"pr6-when"+(n!=null&&n<=1?" soon":"")}, cuando(x))),
      React.createElement("span",{className:"am num"}, eur(Math.abs(x.amount))));
  };
  const revRow=function(x){
    const cobro=x.rv==="diff"||x.rv==="up";
    return React.createElement("button",{type:"button",className:"v4-charge pr6-rev",key:x.id,"data-recibo":x.id,"data-review":x.rv,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"pr6-ico","aria-hidden":"true"},
        React.createElement("svg",{width:19,height:19,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round",strokeLinejoin:"round"},
          React.createElement("path",{d:PR6_ICO[x.rv]||PR6_ICO.unconf}))),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name,React.createElement(PlanConflictDot,{record:conflictOf(x)})),
        React.createElement("span",{className:"sub pr6-why"}, pr6Motivo(x))),
      // Lo cobrado de más o de menos se enseña tal cual lo cobró el banco.
      React.createElement("span",{className:"am num"}, eur(cobro?x.cobrado:Math.abs(x.amount))));
  };
  const pausadoRow=function(f){
    return React.createElement("button",{type:"button",className:"v4-charge v4-paid pr6-prow pr6-skip",key:"p_"+f.id,"data-recibo":"fixed_"+f.id,"data-pausado":"1",
      "aria-label":f.name+" · "+t("pr6_este_mes_no"),onClick:function(){ devolverAlMes(f); }},
      React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},"–"),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, f.name),
        React.createElement("span",{className:"sub"}, t("pr6_este_mes_no"))),
      React.createElement("span",{className:"am num"}, eur(occAmountIn(f,month))));
  };
  const paidRow=function(x){
    // Si el cargo no fue lo previsto, se dice cuánto fue (la cifra de la fila sigue siendo la previsión).
    const how=[x.paidBank?tf("pr6_cargo_de",{bank:entOf(x.paidBank).label}):"",planChargeChanged(x)?tf("v4_charge_actual",{x:eur(x.paidAmount)}):""]
      .filter(Boolean).join(" · ");
    return React.createElement("button",{type:"button",className:"v4-charge v4-paid pr6-prow",key:x.id,"data-recibo":x.id,onClick:function(){ abrir(x); }},
      React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},"✓"),
      React.createElement("span",{className:"nm"},
        React.createElement("span",{className:"pr6-nm"}, x.name,React.createElement(PlanConflictDot,{record:conflictOf(x)})),
        React.createElement("span",{className:"sub"},
          x.day!=null&&React.createElement(React.Fragment,null,React.createElement("span",{className:"d"},x.day)," ",React.createElement("span",{className:"m"},monthShort(month-1)),how?" · ":""),
          how)),
      React.createElement("span",{className:"am num"}, planChargeAmount(x)));
  };
  // Como mucho tres a la vista; el resto se despliega debajo con «Ver los N» (SPEC §2.3–2.4).
  const lista=function(items,render,open,setOpen,id){
    const rest=items.slice(3);
    return React.createElement(React.Fragment,null,
      items.slice(0,3).map(render),
      rest.length>0&&React.createElement("div",{className:"pr6-fold"+(open?" open":""),id:id},
        React.createElement("div",Object.assign({className:"pr6-fold-in"},plegado(open)), rest.map(render))),
      rest.length>0&&React.createElement("button",{type:"button",className:"pr6-more","aria-expanded":open?"true":"false","aria-controls":id,
        onClick:function(e){ const sec=e.currentTarget.parentNode; setOpen(function(o){ if(o) verPlegado(sec); return !o; }); }},
        open?t("v4_ver_menos"):tf("pr6_ver_los",{n:items.length}),
        pr6Chev()));
  };
  const nPend=pack.pendingBills.length, nBills=nPend+pack.paidBills.length+pausados.length;
  const countLine=nPend>0
    ? tf(nPend===1?"pr6_count_one":"pr6_count",{n:nPend})+(v.week>0?" · "+tf("pr6_count_week",{n:v.week}):"")
    : (nBills>0?t("pr6_all_paid"):"");
  const paidTotalLabel=v.paidChanged?tf("v4_charge_expected",{x:eur(v.paidTotal)}):eur(v.paidTotal);
  const fichaRow=ficha&&(pack.pendingBills.concat(pack.paidBills).find(function(x){ return x.id===ficha.id; })||null);
  // Pausar o borrar desde la ficha saca el recibo del mes antes de que la hoja termine de irse:
  // sin olvidarla, reaparecía abierta en cuanto el recibo volvía al mes.
  useEffect(function(){ if(ficha&&!fichaRow) setFicha(null); },[ficha,fichaRow]);
  return React.createElement(React.Fragment,null,
    React.createElement("div",{className:"v4-card v4-card-hero rise pr6-sum","data-testid":"plan-summary"},
      React.createElement("div",{className:"v4-micro"}, tf("v4_plan_left",{month:monthLong(month-1)})),
      React.createElement("div",{className:"serif num pr6-big"}, eur(pack.pendingBillsTotal)),
      countLine&&React.createElement("div",{className:"pr6-count","data-testid":"plan-count"}, countLine),
      llega&&nPend>0&&React.createElement("div",{className:"pr6-pills"},
        React.createElement("button",{type:"button",className:"pr6-pill"+(llega.ok?" ok":""),"data-testid":"plan-llega","aria-haspopup":"dialog",
          onClick:function(){ setLlegaOpen(true); }},
          llega.ok&&React.createElement("span",{className:"pr6-pill-ok","aria-hidden":"true"},"✓"),
          llega.ok?t("pr6_llega"):tf("pr6_falta",{x:eur0(llega.falta)}),
          // Sin la flecha no se ve que la píldora se abre.
          React.createElement("svg",{className:"pr6-pill-go",width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
            React.createElement("path",{d:"M9 6l6 6-6 6"}))))),
    v.review.length>0&&React.createElement("section",{className:"pr6-sec","data-testid":"plan-review","aria-label":t("pr6_revisar")},
      React.createElement("div",{className:"pr6-sec-h"},
        React.createElement("span",null, t("pr6_revisar"),React.createElement("span",{className:"pr6-n"}, v.review.length))),
      lista(v.review,revRow,revOpen,setRevOpen,"pr6-rev-more")),
    React.createElement("section",{className:"pr6-sec","data-testid":"plan-due","aria-label":t("v4_pendiente")},
      React.createElement("div",{className:"pr6-sec-h v4-section-h"},
        // «Pendiente» y no «Por pagar»: la petición del dueño del 26/10/2026 (la otra palabra
        // necesitaba una línea de ayuda debajo para entenderse) sigue en pie con el rediseño.
        React.createElement("span",null, t("v4_pendiente")),
        React.createElement("button",{type:"button",className:"link",onClick:openManage}, t("pr6_todos"))),
      v.due.length===0
        ? React.createElement("div",{className:"pr6-empty"}, t("pr6_nada"))
        : lista(v.due,dueRow,dueOpen,setDueOpen,"pr6-due-more")),
    nBills>0&&React.createElement("section",{className:"pr6-paid"+(paidOpen?" open":""),ref:paidRef,"data-testid":"plan-paid","aria-label":t("pr6_ya_pagados")},
      React.createElement("button",{type:"button",className:"pr6-paid-h","aria-expanded":paidOpen?"true":"false","aria-controls":"pr6-paid-list",
        onClick:function(){ setPaidOpen(function(o){ if(!o) verPlegado(paidRef.current); return !o; }); }},
        React.createElement("span",{className:"pr6-tick","aria-hidden":"true"},"✓"),
        React.createElement("span",{className:"pr6-paid-t"}, t("pr6_ya_pagados"),React.createElement("span",{className:"pr6-n"},"· "+v.paid.length)),
        React.createElement("span",{className:"pr6-paid-amt num"}, paidTotalLabel),
        pr6Chev()),
      React.createElement("div",{className:"pr6-fold"+(paidOpen?" open":""),id:"pr6-paid-list"},
        React.createElement("div",Object.assign({className:"pr6-fold-in"},plegado(paidOpen)), v.paid.map(paidRow), pausados.map(pausadoRow)))),
    /* Traspasos y entradas siguen también aquí: los que mueven el mínimo ya salen (y se editan) en
       «¿Te llega?», pero quitarlos de la portada deja sin verlos de un vistazo a quien los miraba
       aquí; la SPEC no los pinta ni los descarta, así que eso lo decide el dueño. */
    pack.transfersPending.length>0&&React.createElement("div",{className:"v4-section","data-testid":"plan-transfers"},
      React.createElement("div",{className:"v4-section-h"},t("v4_plan_transfers")),pack.transfersPending.map(function(x){ return planRecibosFlowRow(x,month); })),
    (pack.incomePending||[]).length>0&&React.createElement("div",{className:"v4-section"},
      React.createElement("div",{className:"v4-section-h"},React.createElement("span",null,t("v4_aun_entrara"))),
      pack.incomePending.map(function(x){ return planRecibosFlowRow(x,month); })),
    llegaOpen&&React.createElement(LlegaSheet,{state:state,set:set,totals:totals,pack:pack,onClose:function(){ setLlegaOpen(false); }}),
    deshacer&&React.createElement("div",{className:"v4-undo-toast",role:"status","data-testid":"plan-deshacer"},
      React.createElement("span",null, tf("pr6_manana_toast",{name:deshacer.name})),
      React.createElement("button",{type:"button",onClick:quitarPospuesto}, t("f_undo"))),
    ficha&&fichaRow&&React.createElement(ReciboFicha,{key:ficha.id,row:fichaRow,state:state,set:set,totals:totals,evidence:proof,showToast:showToast,
      aviso:v.review.find(function(x){ return x.id===ficha.id; })||null,
      onPosponer:posponer,
      onClose:function(){ setFicha(null); },
      onEdit:function(id){ setFicha(null); setManageEdit(id); setManageOpen(true); }}),
    React.createElement(BillsManagePush,{open:manageOpen,onClose:function(){ setManageOpen(false); setManageEdit(null); },state:state,set:set,totals:totals,simple:false,editId:manageEdit})
  );
}
// Icono gris por tipo de aviso (SPEC §2.3): reloj, ojo tachado, subida, flechas y duda.
const PR6_ICO={
  late:"M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  ghost:"M3 3l18 18M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a10 10 0 005.4-1.6",
  up:"M3 17l6-6 4 4 8-8M15 7h6v6",
  diff:"M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
  unconf:"M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 100-18 9 9 0 000 18z"
};
function pr6Motivo(x){
  if(x.rv==="late") return t("pr6_no_llegado");
  if(x.rv==="ghost") return tf("pr6_fantasma",{n:x.meses});
  if(x.rv==="up") return tf("pr6_ha_subido",{x:eur((Math.round(x.cobrado*100)-Math.round(x.previsto*100))/100)});
  if(x.rv==="diff") return tf("pr6_esperabas",{x:eur(x.previsto)});
  return t("pr6_sin_cargo");
}
// Mes corto de un año*12+mes, en minúscula salvo en inglés («hasta dic», «until Dec»).
function pr6Mes(ym){ const s=monthShort((ym-1)%12); return CURLANG==="en"?s:s.toLowerCase(); }
// «pausado hasta feb» en Todos y en la edición (SPEC §2.6.1); "" si no hay pausa por delante.
function pr6PausaTxt(r,cur){
  const u=r&&r.kind==="fixed"&&r.item?Number(r.item.pausedUntil):0;
  return u>cur?tf("pr6_pausado_hasta",{m:pr6Mes(u)}):"";
}
function pr6Chev(){
  return React.createElement("svg",{className:"pr6-chev",width:14,height:14,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.4,strokeLinecap:"round","aria-hidden":"true"},
    React.createElement("path",{d:"M6 9l6 6 6-6"}));
}
function planRecibosFlowRow(x,month){
  const income=x.amount<0;
  const tag=x.kind==="income"?t("fj_income_tag"):t("fj_transfer_tag");
  return React.createElement("div",{className:"v4-charge",key:x.id},
    React.createElement("div",{className:"dt"},
      React.createElement("div",{className:"d"}, x.day||"—"),
      React.createElement("div",{className:"m"}, monthShort(month-1))),
    React.createElement("div",{className:"nm"},
      React.createElement("div",null, x.name),
      React.createElement("div",{className:"sub"}, tag+(x.bank?" · "+entOf(x.bank).label:""))),
    React.createElement("div",{className:"am"+(income?" pos":"")}, income?"+":"",eur(Math.abs(x.amount))));
}
/* Hoja «¿Te llega?» (SPEC §4): un bloque por banco con recibos pendientes, el recorrido resumido
   (tienes hoy · recibos que faltan · entradas antes del último recibo) y, si no llega, UN aviso
   con cuánto pasar y antes de qué día. Sin botón de actualizar ni sugerencias (descartados). */
function LlegaSheet({state, set, totals, pack, onClose}){
  const swipe=useSheetSwipe(true,onClose);
  useBackClose(true,swipe.close);
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const today=totals.today;
  const base=useMemo(function(){ return planRecibosBancos(totals,pack,null); },[totals,pack]);
  const conSaldo=base.filter(function(b){ return b.known; });
  const [raw,setRaw]=useState("");
  const [teclado,setTeclado]=useState(false);
  const [gBank,setGBank]=useState(conSaldo.length?conSaldo[0].bank:null);
  const [flujo,setFlujo]=useState(null);
  const amt=parseNumPadRaw(raw);
  const gasto=amt>0&&gBank?{bank:gBank,amt:amt}:null;
  const bancos=gasto?planRecibosBancos(totals,pack,gasto):base;
  const elegido=gasto&&bancos.find(function(b){ return b.bank===gBank&&b.known; });
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
    if(e.kind!=="income") return fila("f_"+e.id,lbl,"− "+eur(Math.abs(e.amt)));
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
          conSaldo.length>0&&React.createElement("div",{className:"pr6-ll-wi","data-testid":"llega-gasto"},
            React.createElement("span",{className:"pr6-ll-n"}, t("pr6_si_gasto")),
            React.createElement("div",{className:"pr6-ll-wr"},
              React.createElement("button",{type:"button",className:"serif num pr6-ll-amt"+(teclado?" on":"")+(raw?"":" ph"),"aria-expanded":teclado?"true":"false","data-testid":"llega-gasto-amt",
                onClick:function(){ setTeclado(function(o){ return !o; }); }}, raw?eur(amt):t("pr6_importe")),
              conSaldo.length>1&&conSaldo.map(function(b){
                const on=b.bank===gBank;
                return React.createElement("button",{type:"button",key:b.bank,className:"chip"+(on?" active":""),"aria-pressed":on?"true":"false","data-bank":b.bank,onClick:function(){ setGBank(b.bank); }}, entOf(b.bank).label);
              })),
            elegido&&React.createElement("span",{className:"pr6-ll-wt"+(elegido.min<-0.005?"":" ok"),"data-testid":"llega-gasto-txt"},
              elegido.min<-0.005?tf("pr6_no_llega",{x:eur(-elegido.min)}):tf("pr6_si_llega",{x:eur(elegido.min)})),
            React.createElement("div",{className:"pr6-fold"+(teclado?" open":"")},
              React.createElement("div",Object.assign({className:"pr6-fold-in"},teclado?null:{"aria-hidden":"true",inert:""}),
                React.createElement(NumPad,{value:raw,onChange:setRaw})))))),
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
  const paso=function(d){ setDia(function(x){ const n=x+d; return n<1?31:n>31?1:n; }); };
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
    if(dia!==dia0){ patch.day=dia; patch.when=null; }
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
    const a=occAmountIn(f,m);
    if(!(a>0)||!occursIn(f,m)) continue;
    const st=fixedPaymentState(s,f,y,m,m===curM?today:new Date(y,m,0).getDate());
    if(!fixedPaymentEvidence(st)){ if(m===curM) continue; return null; }
    const compartido=f.bankAmount>0&&Math.abs(f.bankAmount-a)>=0.005;
    total+=!compartido&&st.paidAmount>0?st.paidAmount:a;
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
   prueba a mano. → {state, e} o null si no hay nada que deshacer desde aquí. */
function reciboDesenlazar(s,f,x,y,m,today){
  if(!x) return null;
  if(x.reciboId===f.id) return quitarCargoDeRecibo(s,x.id)||null;
  const n=linkFixedPayment(s,x.id,null,y,m,today);
  return n!==s?{state:n,e:null}:null;
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
function reciboCargoTexto(x){ return String((x&&(x.merchant||x.obName))||""); }
function ReciboFicha({row, state, set, totals, evidence, showToast, onClose, onEdit, aviso, onPosponer}){
  const swipe=useSheetSwipe(true,onClose);
  useBackClose(true,swipe.close);
  const [paso,setPaso]=useState(0);           // 0 ficha · 1 «¿Cuál es el cargo?»
  const [pausa,setPausa]=useState(false);
  const [gone,setGone]=useState(false);       // «Ya no lo tengo» pide un segundo toque
  const [rechazo,setRechazo]=useState(false); // vino de «No es este recibo»
  const [elegido,setElegido]=useState(null);
  const [otros,setOtros]=useState(false);
  const [q,setQ]=useState("");
  useBackClose(paso===1,function(){ setPaso(0); });
  const titleRef=useRef(null), titleId=React.useId();
  useEffect(function(){ if(titleRef.current) titleRef.current.focus({preventScroll:true}); },[]);
  const y=totals.curYear, m=totals.curMonth, today=totals.today;
  const fixedId=/^fixed_/.test(String(row.id))?String(row.id).slice(6):null;
  const oneoffId=/^oneoff_/.test(String(row.id))?String(row.id).slice(7):null;
  const f=fixedId!=null?(state.fixed||[]).find(function(e){ return String(e.id)===fixedId; }):null;
  const st=useMemo(function(){ return f?fixedPaymentState(state,f,y,m,today):null; },[state,f,y,m,today]);
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
  const target=f?(f.bankAmount>0?f.bankAmount:occAmountIn(f,m)):Math.abs(row.amount);
  const dayF=f?dayIn(f,m):row.day;
  const dms=function(x){ return dateMs(String(x.date).slice(0,10)); };
  // Lista para ELEGIR a mano, más ancha a propósito que el casado automático (SPEC §2.6.3):
  // del banco del recibo, desde 7 días antes de su día, a ± max(2 €, 15 %), por parecido de importe.
  const delBanco=pool.filter(function(x){ return expenseBankOf(x)===bank; });
  const cands=delBanco.filter(function(x){
    const d=recDay(x.date);
    return (dayF==null||d==null||d>=dayF-7)&&Math.abs(Number(x.amount)-target)<=Math.max(2,target*0.15);
  }).sort(function(a,b){ return Math.abs(a.amount-target)-Math.abs(b.amount-target); });
  const recientes=delBanco.filter(function(x){ return cands.indexOf(x)<0; }).sort(function(a,b){ return dms(b)-dms(a); }).slice(0,4);
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
      const prueba=enlaza(state);
      if(prueba) set(function(s){ const r=enlaza(s); return r?r.state:s; });
      if(prueba&&cloud.enabled()) prueba.subir.forEach(function(e){ cloud.setExpenseRecibo(e).catch(function(){}); });
      if(showToast) showToast(prueba?tf("pr6_pagado_toast",{name:row.name}):t("pr6_link_fail"));
      swipe.close();
    },260);
  };
  const aunNo=function(){
    const prueba=reciboDesenlazar(state,f,fila,y,m,today);
    set(function(s){ const u=reciboDesenlazar(s,f,fila,y,m,today); return u?u.state:s; });
    if(prueba&&prueba.e&&cloud.enabled()) cloud.setExpenseRecibo(prueba.e).catch(function(){});
    /* El aviso dice dónde queda de verdad: con una marca de pago que el banco ya dejó (`paidYm`)
       el recibo no vuelve a pendiente, pasa a «Para revisar» (revisión 28/10/2026). */
    const f2=prueba&&(prueba.state.fixed||[]).find(function(e){ return e.id===f.id; });
    const sigue=!!(f2&&fixedPaymentState(prueba.state,f2,y,m,today).paid);
    if(showToast&&prueba) showToast(tf(sigue?"pr6_revisar_toast":"pr6_vuelve_toast",{name:row.name}));
    swipe.close();
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
  // Cabecera y estado del pago.
  const sub=dayF!=null?tf("pr6_se_cobra",{d:dayF,bank:entOf(bank).label}):entOf(bank).label;
  const pagoBanco=confirmado&&st?st.paidBank||bank:null;
  const pagoTxt=confirmado?(fila?reciboCargoTexto(fila):st&&st.bankTx?String(st.bankTx.merchant||""):st&&st.proof&&st.proof.merchant?String(st.proof.merchant):""):"";
  const pagoDia=confirmado?(st&&st.day!=null?st.day:row.day):null;
  /* Casos especiales (SPEC §2.6.2): una pareja de botones en lugar de los normales. «Editar» y
     «Pausar» siguen debajo; «No es este recibo» no, porque ahí la pregunta es si el cargo está
     bien, no cuál es. */
  const rv=aviso&&aviso.rv;
  const especial=rv==="diff"||rv==="up"||rv==="ghost";
  const cur=y*12+m;
  // «Desde ahora» cambia el importe del recibo: solo cuando es un importe único cada vez. Con
  // pagos a medida o un anual repartido no hay una cifra que poner sin inventarla.
  const precioSimple=!!f&&!hasSchedule(f)&&Math.abs(occAmountIn(f,m)-Number(f.amount))<0.005;
  const cerrarCon=function(msg){ if(showToast&&msg) showToast(msg); swipe.close(); };
  const revisado=function(kind){
    set(function(s){
      let cambia=false;
      const fixed=(s.fixed||[]).map(function(e){
        if(e.id!==f.id) return e;
        cambia=true;
        return Object.assign({},e,{revisado:Object.assign({},e.revisado,{[kind]:cur})});
      });
      return cambia?Object.assign({},s,{fixed:fixed}):s;
    });
    cerrarCon(null);
  };
  const nuevoPrecio=function(){
    // Lo que cobra el banco: en un recibo compartido es `bankAmount`; tu parte no se deduce sola.
    const parche=f.bankAmount>0?{bankAmount:aviso.cobrado}:{amount:aviso.cobrado};
    // La edición de siempre (`patchFixedById`), pero recogida como updater para hacerlo todo en uno.
    let editar=null;
    patchFixedById(function(u){ editar=u; },f.id,parche);
    const previa=f.paymentProofs&&f.paymentProofs[cur];
    set(function(s){
      let n=editar(s);
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
  const quitar=function(){
    if(!gone){ setGone(true); return; }
    removeFixedById(set,f.id);
    cerrarCon(tf("pr6_borrado_toast",{name:row.name}));
  };
  const par=[];
  const parBtn=function(key,label,go,main){ return React.createElement("button",{type:"button",key:key,className:main?"pr6-cta pr6-par":"pr6-btn pr6-par","data-act":key,onClick:go},label); };
  const yaNo=function(){ return React.createElement("button",{type:"button",key:"quitar",className:"pr6-btn pr6-par"+(gone?" pr6-seguro":""),"data-act":"quitar",onClick:quitar},gone?t("pr6_seguro_borrar"):t("pr6_ya_no")); };
  if(f&&rv==="diff"){
    par.push(parBtn("solo-mes",t("pr6_solo_mes"),function(){ revisado("distinto"); },true));
    if(precioSimple) par.push(parBtn("desde-ahora",t("pr6_desde_ahora"),nuevoPrecio,false));
  } else if(f&&rv==="up"){
    if(precioSimple) par.push(parBtn("actualizar",t("pr6_actualizar"),nuevoPrecio,true));
    par.push(yaNo());
  } else if(f&&rv==="ghost"){
    par.push(parBtn("sigue",t("pr6_sigue"),function(){ revisado("fantasma"); },true));
    par.push(yaNo());
  }
  const nota=rv==="late"&&dayF!=null?tf("pr6_nota_late",{d:dayF})
    :rv==="diff"?tf("pr6_nota_diff",{x:eur(aviso.cobrado),y:eur(aviso.previsto)})
    :rv==="up"?tf("pr6_nota_up",{x:eur(aviso.previsto)})
    :rv==="ghost"?tf("pr6_fantasma",{n:aviso.meses}):"";
  const baja=(rv==="up"||rv==="ghost")?pr6Baja(row.name):null;
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
  const posponible=rv==="late"||especial;
  const botones=[];
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
      React.createElement("span",{className:"serif num pr6-ficha-a"}, eur(rv==="diff"||rv==="up"?aviso.cobrado:Math.abs(row.amount)))),
    nota&&React.createElement("div",{className:"pr6-nota","data-testid":"recibo-nota"}, nota),
    ano!=null&&React.createElement("div",{className:"pr6-chips"},
      React.createElement("span",{className:"pr6-chip","data-testid":"recibo-ano"}, tf("pr6_este_ano",{x:eur(ano)}))),
    confirmado&&React.createElement("div",{className:"pr6-cargo","data-testid":"recibo-cargo"},
      React.createElement(Mono,{ent:pagoBanco,size:34}),
      React.createElement("span",{className:"pr6-cand-t"},
        React.createElement("span",{className:"pr6-cand-n"}, pagoTxt||entOf(pagoBanco).label),
        React.createElement("span",{className:"pr6-cand-s"}, (pagoDia!=null?pagoDia+" "+monthShort(m-1)+" · ":"")+entOf(pagoBanco).label)),
      React.createElement("span",{className:"pr6-ring on","aria-hidden":"true"},"✓")),
    par.length>0&&React.createElement("div",{className:"pr6-btns","data-testid":"recibo-par"},par),
    baja&&React.createElement("a",{className:"pr6-baja",href:baja.url,target:"_blank",rel:"noopener noreferrer","data-testid":"recibo-baja"}, tf("pr6_baja",{name:baja.name})),
    !confirmado&&f&&rv!=="ghost"&&React.createElement("button",{type:"button",className:"pr6-cta","data-act":"pagado",onClick:function(){ setRechazo(false); setElegido(null); setOtros(false); setQ(""); setPaso(1); }},t("pr6_ya_pagado_btn")),
    f&&React.createElement("div",{className:"pr6-fold"+(pausa?" open":"")},
      React.createElement("div",Object.assign({className:"pr6-fold-in pr6-pausa","data-testid":"recibo-pausa"},pausa?null:{"aria-hidden":"true",inert:""}),
        pausaChips.map(function(c){ return React.createElement("button",{type:"button",key:c.key,className:"chip","data-pausa":c.key,onClick:c.go},c.label); }))),
    botones.length>0&&React.createElement("div",{className:"pr6-btns"},botones),
    posponible&&React.createElement("button",{type:"button",className:"pr6-more","data-act":"posponer",onClick:function(){ if(onPosponer) onPosponer(row); swipe.close(); }},t("pr6_manana_btn")));
  const lista=qq?encontrados:cands.concat(otros||!cands.length?recientes:[]);
  const elegirPanel=f&&React.createElement("div",{className:"pr6-step"+(paso===1?" on":""),"aria-hidden":paso===1?null:"true",inert:paso===1?undefined:""},
    React.createElement("div",{className:"pr6-pick-h"},
      React.createElement("button",{type:"button",className:"pr6-back","aria-label":t("v4_back"),onClick:function(){ setPaso(0); }},"‹"),
      React.createElement("span",{className:"pr6-ficha-t"},
        React.createElement("span",{className:"serif pr6-pick-t"}, rechazo?t("pr6_con_cual"):t("pr6_cual_cargo")),
        React.createElement("span",{className:"pr6-ficha-s"}, row.name+" · "+eur(Math.abs(row.amount))))),
    React.createElement("input",{className:"pr6-search",type:"search",value:q,placeholder:t("pr6_buscar_cargo"),"aria-label":t("pr6_buscar_cargo"),
      onChange:function(e){ setQ(e.target.value); }}),
    !qq&&!cands.length&&recientes.length>0&&React.createElement("div",{className:"pr6-lbl"}, tf("pr6_otros_cargos",{bank:entOf(bank).label})),
    React.createElement("div",{className:"pr6-cands","data-testid":"recibo-cargos"}, lista.map(cargoRow)),
    !lista.length&&React.createElement("div",{className:"pr6-empty"}, qq?tf("pr6_sin_resultados",{q:q.trim()}):tf("pr6_sin_cargos",{bank:entOf(bank).label})),
    !qq&&cands.length>0&&recientes.length>0&&React.createElement("button",{type:"button",className:"pr6-more",onClick:function(){ setOtros(function(o){ return !o; }); }},
      otros?t("pr6_menos_cargos"):tf("pr6_otros_cargos",{bank:entOf(bank).label})),
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
        React.createElement("div",{className:"pr6-track"+(paso===1?" pick":"")}, fichaPanel, elegirPanel))),
    document.body);
}

/* §2 variante A: `.settings-push` hub. Reconcile → BankPanel (Claude). */
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

/* §2 variante A: `.settings-push` hub. Reconcile → BankPanel (Claude).
   Ajustes dispara `mc-open-bills` → PlanTab abre este push con state vivo (no snapshot). */
function BillsManagePush({open, onClose, state, set, totals, simple, editId}){
  const [stack,setStack]=React.useState(["hub"]);
  const [group,setGroup]=React.useState(null);
  const [q,setQ]=React.useState("");
  const [detail,setDetail]=React.useState(null);
  const [reviewBill,setReviewBill]=React.useState(null);
  const [addStep,setAddStep]=React.useState(null);
  const [addForm,setAddForm]=React.useState({name:"",amount:"",freq:"mes",months:[],day:"",when:"",account:"sabadell",kind:"fixed"});
  const [undoBill,setUndoBill]=React.useState(null);
  const undoTimer=React.useRef(null);
  const [savedBill,setSavedBill]=React.useState(null);
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
  const pageSwipe=useEdgePageClose(!!open,onClose,view==="hub"&&!detail&&!addStep,rootRef,{plainScroll:true});
  const sub=useEdgePageClose(!!open,function(){ setStack(["hub"]); setGroup(null); },view!=="hub"&&!detail&&!addStep,subRef,{plainScroll:true});
  const cm=totals.curMonth, cy=totals.curYear;
  // Ola nativa (INC-2709-03, 19/10): Android solo la pinta en el scroller RAÍZ, y Chromium
  // promociona un `fixed` a pantalla completa como raíz implícita SOLO si es el único candidato
  // (RootScrollerController: «only promote if we have a unique match»). Con Gestionar abierto
  // seguían desplazables debajo el host de Plan (y Ajustes si se entró desde ahí): dos o tres
  // candidatos → ninguno raíz → sin ola. Lo de debajo deja de desplazar mientras esto está
  // abierto; `overflow:hidden` conserva su scrollTop para la vuelta.
  React.useEffect(function(){
    if(!open) return undefined;
    var h=document.documentElement;
    h.classList.add("bills-open");
    return function(){ h.classList.remove("bills-open"); };
  },[open]);
  React.useEffect(function(){
    if(!open){
      editOnly.current=false;
      setStack(["hub"]); setGroup(null); setQ(""); setDetail(null); setAddStep(null);
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
    if(view==="hub"){ pageSwipe.close(); return; }
    sub.close();
  },[view, detail, addStep]);
  popRef.current=pop; detailRef.current=detail; addStepRef.current=addStep;
  /* «Editar» desde la ficha de Recibos (v6): entra directo en la edición de ESE recibo y, al
     cerrarla, vuelve a Recibos en vez de dejarte en Todos, que nadie había pedido abrir. */
  const editOnly=React.useRef(false);
  const onCloseRef=React.useRef(onClose); onCloseRef.current=onClose;
  React.useEffect(function(){
    if(!open||editId==null) return;
    const r=billsGroupRows(state,"serv",cm,cy).concat(billsGroupRows(state,"once",cm,cy))
      .find(function(x){ return String(x.id)===String(editId); });
    if(r){ editOnly.current=true; setDetail(r); }
  },[open,editId]);
  const closeDetail=React.useCallback(function(){
    setDetail(null);setReviewBill(null);
    if(editOnly.current){ editOnly.current=false; onCloseRef.current(); }
  },[]);
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
  const shownHero=useCountUp(hero,!!open);
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
  const openDetail=function(row){
    openerRef.current=document.activeElement;
    setSavedBill(null);
    setDetail(row);
  };
  const startAdd=function(kind){
    openerRef.current=document.activeElement;
    setSavedBill(null);
    setAddForm({name:"",amount:"",freq:"mes",months:[],day:"",when:"",account:bankList[0]||"sabadell",kind:kind||"fixed",
      month:cm, year:cy, flowKind:"income"});
    setAddStep("what");
  };
  const confirmSaved=function(kind,name){
    // El toast global decía solo «Guardado» mientras el alta se iba: aquí queda visible
    // qué se añadió en la pantalla de Recibos, también al salir de una lista hija.
    setSavedBill({kind:kind,name:name});
  };
  const removeWithUndo=function(row){
    setSavedBill(null);
    const snap={kind:row.kind, item:Object.assign({},row.item)};
    if(row.kind==="fixed") removeFixedById(set,row.id);
    else if(row.kind==="flow") removeFlowById(set,row.id);
    else if(row.kind==="oneoff") removeOneoffById(set,row.id);
    else return;
    // Tras borrar se queda en Todos: ahí está el «Deshacer».
    editOnly.current=false;
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
        React.createElement("div",{className:"nm-title"}, r.name||"—",React.createElement(PlanConflictDot,{record:planSyncConflict(state,r.kind==="debt"?"debts":r.kind,r.id)})),
        React.createElement("div",{className:"meta"}, r.locked?gbTxt("gb_locked"):entOf(r.bank).label+(pr6PausaTxt(r,cy*12+cm)?" · "+pr6PausaTxt(r,cy*12+cm):""))),
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
      React.createElement("div",{ref:rootRef,className:"settings-push open v4-bills-push mc-page-enter","data-bills-manage":"1","data-screen":screenAttr,"data-covered":view!=="hub"?"1":null,
        role:"dialog","aria-modal":"true","aria-labelledby":"bills-manage-title"},
        hub,
        view!=="hub" && React.createElement("div",{ref:subRef,className:"settings-push open v4-bills-push mc-page-enter"}, view==="list"?listView:affordView)),
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
      savedBill && !addStep && React.createElement("div",{className:"v4-undo-toast v4-bills-saved",role:"status"},
        React.createElement("span",null,
          React.createElement("strong",null,gbTxt("gb_saved_"+savedBill.kind)),
          React.createElement("small",null,savedBill.name))),
      undoBill && React.createElement("div",{className:"v4-undo-toast",role:"status"},
        React.createElement("span",null, gbTxt("gb_removed")),
        React.createElement("button",{type:"button",onClick:undoLastBill}, t("f_undo")||"Deshacer"))
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
  const side=useEdgePageClose(true,onClose,true,sideRef,{plainScroll:true});
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
        onClick:function(){ set(function(s){ return fixedPausa(s,row.id,0,0); }); }}, pausaEdit+" · "+t("pr6_reanudar")),
      !review&&!locked && row.kind!=="debt" && React.createElement("button",{type:"button",className:"v4-ficha-quitar","data-act":"bill-remove",style:{width:"100%",marginTop:16},
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
    if(cur==="what"){ onCloseRef.current&&onCloseRef.current(); return false; }
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
  // El primer paso ya sale con la ola: el callback de Atrás desmonta sin otra salida vertical.
  const side=useEdgePageClose(true,stepBack,step,sideRef,{plainScroll:true});
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
      const it=Object.assign({id:uid()},fixedDraft(amt));
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
  return React.createElement("div",{ref:sideRef,className:"v4-sheet-back",onClick:swipe.close},
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
    ph.ent, React.createElement("span",{style:{fontSize:22,color:"var(--muted)"}},","+ph.dec+" "+ph.sym));
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
