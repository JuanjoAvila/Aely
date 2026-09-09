/* ============================================================
   TAB: DEUDAS
   ============================================================ */
/* ASESOR DE AMORTIZACIÓN (#11) — «¿cuándo amortizar?»
   El interés (TAE) es opcional por deuda (d.apr, se edita aquí mismo): con él la tarjeta
   estima intereses ahorrados, el coste de esperar y compara contra el efectivo remunerado
   (interestApr de las cuentas, p.ej. TR). Sin él, al menos simula cuántas cuotas te quitas.
   Los números usan el modelo lineal de la app (ver debtBalance): son una estimación honesta,
   no la liquidación exacta del banco. */
function AmortAdvisor({state, set, onAmort}){
  const debts=(state.debts||[]).filter(function(d){ return debtBalance(d)>0.005; });
  const [selId,setSelId]=useState(null);
  const [amtStr,setAmtStr]=useState("500");
  if(!debts.length) return null;
  const d=debts.find(function(x){ return x.id===selId; })||debts[0];
  const bal=debtBalance(d);
  const apr=d.apr!=null?d.apr:null;
  const setApr=function(v){ set(function(s){ return Object.assign({},s,{debts:s.debts.map(function(x){ return x.id===d.id?Object.assign({},x,{apr:v}):x; })}); }); };
  const amt=Math.min(Math.max(0,parseFloat(String(amtStr).replace(',','.'))||0), bal);
  const am=debtAmort(d), leftNow=debtLeft(d);
  const nb=+(bal-amt).toFixed(2);
  let leftNew=null, cut=null;
  if(d.months!=null && am>0){
    const viaM=Math.max(0, nb-(d.balloon||0));
    leftNew=viaM>0?Math.ceil(viaM/am):((d.balloon>0&&nb>0.005)?1:0);
    cut=Math.max(0,(leftNow||0)-leftNew);
  }
  const inMonths=function(k){ const dt=new Date(); dt.setDate(1); dt.setMonth(dt.getMonth()+k); return monthLong(dt.getMonth())+" "+dt.getFullYear(); };
  const r=(apr||0)/1200;
  // ahorro ≈ el importe deja de «deber» durante lo que queda de vida del préstamo + la cola que se corta
  const savedTerm=(apr>0&&leftNew!=null)?(amt*r*leftNew+(amt/2)*r*(cut||0)):null;
  const savedYr=(apr>0&&leftNew==null)?amt*(apr/100):null;
  const waitCost=(apr>0)?bal*r:null;
  const cashApr=(state.accounts||[]).reduce(function(mx,a){ return Math.max(mx,a.interestApr||0); },0);
  const ranked=debts.filter(function(x){ return x.apr>0; }).sort(function(a,b){ return b.apr-a.apr; });
  const res=function(txt,color){ return React.createElement("div",{className:"hint",style:{marginTop:6,color:color||"var(--text)",lineHeight:1.5}}, txt); };
  return React.createElement(CollapsibleCard,{title:"💡 "+t("da_title"),sub:t("da_sub"),dot:"#E2C05F",defaultOpen:false,storageKey:"debt_advisor"},
    debts.length>1 && React.createElement("select",{className:"af-in",style:{marginBottom:8},value:d.id,onChange:function(e){ setSelId(e.target.value); }},
      debts.map(function(x){ return React.createElement("option",{key:x.id,value:x.id}, x.name+" · "+eur0(debtBalance(x))); })),
    React.createElement("div",{className:"row",style:{marginTop:0}},
      React.createElement("span",{className:"muted"},t("da_rate")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",placeholder:"—",value:apr!=null?apr:"",onChange:function(e){ const v=String(e.target.value).trim(); setApr(v===""?null:(parseFloat(v.replace(',','.'))||0)); }})),
    apr==null && React.createElement("div",{className:"hint",style:{marginTop:4}}, t("da_rate_hint")),
    React.createElement("div",{className:"row",style:{marginTop:6}},
      React.createElement("span",{className:"muted"},t("da_amount")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",value:amtStr,onChange:function(e){ setAmtStr(e.target.value); }})),
    React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}},
      [100,250,500,1000].filter(function(v){ return v<=bal; }).map(function(v){
        return React.createElement("button",{key:v,className:"chip",onClick:function(){ setAmtStr(String(v)); }}, eur0(v)); })),
    amt>0 && React.createElement("div",{style:{marginTop:10,padding:"10px 12px",borderRadius:12,background:"var(--surface-2)",border:"1px solid var(--line)"}},
      cut!=null && (cut>0 ? res("📆 "+tf("da_cut",{n:cut,d:inMonths(leftNew),d0:inMonths(leftNow)})) : res("📆 "+t("da_nocut"))),
      savedTerm!=null && savedTerm>=0.5 && res("💶 "+tf("da_saved",{x:eur(savedTerm)}),"var(--mint)"),
      savedYr!=null && savedYr>=0.5 && res("💶 "+tf("da_saved_yr",{x:eur(savedYr)}),"var(--mint)"),
      waitCost!=null && waitCost>=0.5 && res("⏳ "+tf("da_wait",{x:eur(waitCost)})),
      apr===0 && res("🧊 "+tf("da_rate0",{p:cashApr>0?tf("da_rate0_cash",{b:cashApr}):""})),
      apr>0 && cashApr>0 && (apr>=cashApr
        ? res("✅ "+tf("da_beats_cash",{a:apr,b:cashApr}))
        : res("⚖️ "+tf("da_under_cash",{a:apr,b:cashApr}))),
      ranked.length>1 && res(tf("da_first",{name:ranked[0].name,p:ranked[0].apr}))
    ),
    amt>0 && React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:10},onClick:function(){
      askConfirm({ title:tf("da_apply_q",{x:eur0(amt),name:d.name}), sub:t("da_apply_sub"), ok:"💸 "+t("db_amortize") })
        .then(function(yes){ if(yes) onAmort(d, amt); });
    }}, tf("da_apply",{x:eur0(amt)})),
    React.createElement("div",{className:"hint",style:{marginTop:8,fontSize:11.5}}, t("da_est"))
  );
}
function Debts({state, set, showToast}){
  // editar el saldo re-ancla la proyección para que siga desde ahí. Sin plazo: se re-ancla asOf.
  // Con plazo: asOf NO se toca (re-anclarlo resetearía debtPaidCount y el «Quedan n/tot» volvería
  // al plazo completo); en su lugar se ajusta value para que el pendiente sea lo tecleado y se
  // recalculan las cuotas que quedan con la misma amortización (como amortize()).
  const ed=useEditable(state.debts,it=>set(s=>Object.assign({},s,{debts:it})), { display:d=>Math.round(debtBalance(d)*100)/100, extra:(d,typed)=>{
    const am=debtAmort(d);
    if(d.months==null || !(am>0)) return {asOf:ymNow()};
    const paid=debtPaidCount(d);
    const viaM=Math.max(0,typed-(d.balloon||0));
    const left=viaM>0?Math.ceil(viaM/am):((d.balloon>0&&typed>0.005)?1:0);
    return { value:+(typed+am*paid).toFixed(2), months:paid+left };
  } });
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({name:"",value:"",monthly:"",months:"",day:"",account:"sabadell",down:"",balloon:"",paid:""});
  const banks=(function(){ const b=[]; (state.accounts||[]).forEach(a=>{ if(b.indexOf(a.ent)<0) b.push(a.ent); }); ["sabadell","trade_republic","familia"].forEach(x=>{ if(b.indexOf(x)<0) b.push(x); }); return b; })();
  const total=state.debts.reduce((a,d)=>a+debtBalance(d),0);
  const monthly=state.debts.reduce((a,d)=>a+(debtActive(d)?(d.monthly||0):0),0);
  const addDebt=()=>{
    const v=parseFloat(String(form.value).replace(',','.'))||0;
    const months=parseInt(form.months,10)||0;
    const balloon=parseFloat(String(form.balloon).replace(',','.'))||0;
    const down=parseFloat(String(form.down).replace(',','.'))||0;
    const paid=parseInt(form.paid,10)||0;
    const viaMonthly=Math.max(0, v-balloon);                 // lo que cubren las cuotas (el resto = pago final)
    let m=parseFloat(String(form.monthly).replace(',','.'))||0;
    if(v<=0){ showToast(t("db_err_amount")); return; }
    if(m<=0 && months<=0){ showToast(t("db_err_quota")); return; }
    if(paid>0 && months>0 && paid>=months){ showToast(t("db_err_paid")); return; }
    if(months>0 && m<=0) m=+(viaMonthly/months).toFixed(2);  // 0%: cuota = (financiado − pago final) / plazo
    const it={id:uid(),ent:"familia",name:form.name||t("db_newdebt"),value:v,original:v,monthly:m,asOf:ymNow(),account:form.account||"sabadell",note:t("db_addedmanual")};
    const day=cleanDay(form.day); it.day=day||1;   // día 1 por defecto → entra en el motor de líquido
    if(months>0){ it.months=months; it.amort=+(viaMonthly/months).toFixed(2); }   // amortiza principal lineal; el pago final limpia el resto
    if(balloon>0) it.balloon=balloon;
    if(down>0) it.downPayment=down;
    // deuda ya empezada: retrasa el ancla tantos meses como cuotas pagadas para que
    // debtPaidCount()===paid hoy (compensa el +1 que suma si la cuota de este mes ya pasó)
    if(paid>0){ let anchor=ymNow()-paid; if(months>0 && it.day!=null && it.day<=new Date().getDate()) anchor+=1; it.asOf=anchor; }
    set(s=>Object.assign({},s,{debts:s.debts.concat([it])}));
    setForm({name:"",value:"",monthly:"",months:"",day:"",account:"sabadell",down:"",balloon:"",paid:""}); setAdding(false);
    showToast(t("db_added"));
  };
  const delDebt=(id)=> set(s=>Object.assign({},s,{debts:s.debts.filter(d=>d.id!==id)}));
  // amortización anticipada: baja el pendiente y acorta el plazo (misma cuota, menos meses).
  // doAmort es la operación; amortize solo pregunta el importe. El asesor (#11) llama a doAmort.
  const doAmort=(d,rawAmt)=>{
    const bal=debtBalance(d);
    const amt=Math.min(rawAmt||0, bal);
    if(amt<=0) return;
    const nb=+(bal-amt).toFixed(2);
    set(s=>Object.assign({},s,{debts:s.debts.map(x=>{
      if(x.id!==d.id) return x;
      const o=Object.assign({},x,{value:+(x.value-amt).toFixed(2)});   // el ancla no se toca: el pendiente baja justo lo amortizado
      if(nb<=0.005){ if(x.months!=null) o.months=debtPaidCount(x); delete o.balloon; }
      else if(x.months!=null){ const am=debtAmort(x); if(am>0){ const viaM=Math.max(0,nb-(x.balloon||0)); o.months=debtPaidCount(x)+(viaM>0?Math.ceil(viaM/am):(x.balloon>0?1:0)); } }
      return o;
    })}));
    showToast(nb<=0.005?t("db_amortize_full"):tf("db_amortized",{x:eur(amt),y:eur(nb)}));
  };
  const amortize=(d)=>{
    const bal=debtBalance(d);
    askText({ title:tf("db_amortize_prompt",{name:d.name}), sub:tf("db_amortize_sub",{x:eur(bal)}),
      ph:"0,00 €", ok:"💸 "+t("db_amortize"),
      // atajos: los importes redondos que quepan + «todo» para liquidarla de un toque
      chips:[100,250,500].filter(function(v){ return v<bal; }).map(function(v){ return {v:v,label:eur0(v)}; })
        .concat([{v:+bal.toFixed(2), label:tf("ask_all",{x:eur0(bal)})}])
    }).then(function(raw){
      if(raw==null) return;
      doAmort(d, parseFloat(String(raw).replace(',','.'))||0);
    });
  };
  const debtEmoji=function(d){
    const n=String(d.name||"").toLowerCase();
    if(/coche|auto|car|seat|bmw/.test(n)) return "🚗";
    if(/casa|hipo|piso|mort/.test(n)) return "🏠";
    if(/móvil|movil|phone|móvil|iphone/.test(n)) return "📱";
    if(/estudio|máster|master|uni/.test(n)) return "🎓";
    return "💳";
  };
  // Cuotas que quedan: las financiaciones lo saben por su plazo; sin plazo (hipoteca/préstamo
  // a mano) se ESTIMA con el ritmo de amortización actual. Devuelve {n,tot} o null.
  const leftInfo=function(d){
    const left=debtLeft(d);
    if(left!=null) return {n:left, tot:d.months||left};
    const am=debtAmort(d), bal=debtBalance(d);
    if(!(am>0) || !(bal>0.005)) return null;
    return {n:Math.ceil(bal/am), tot:Math.ceil((d.original||bal)/am)};
  };
  const endsLabel=function(d){
    // Mismo texto para TODAS las deudas (feedback 2026-07-21: el «a este ritmo acabas ~» de
    // hipoteca/préstamo cantaba distinto del «acabas en» de las financiaciones). La fecha sin
    // plazo sigue siendo una estimación con la amortización actual, igual de honesta.
    const li=leftInfo(d);
    if(!li) return null;
    const dt=new Date(); dt.setDate(1); dt.setMonth(dt.getMonth()+li.n);
    return tf("v4_debts_ends",{d:monthLong(dt.getMonth())+" "+dt.getFullYear()});
  };
  return React.createElement("div",null,
    React.createElement("div",{className:"v4-card v4-card-hero rise"},
      React.createElement("div",{className:"v4-micro"},t("v4_debts_hero")),
      React.createElement("div",{className:"serif num",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6,color:"var(--coral)"}},eur(total)),
      React.createElement("div",{style:{marginTop:12,fontSize:13.5,color:"var(--muted)",lineHeight:1.45}},tf("v4_debts_sub",{x:eur0(monthly)}))
    ),
    state.debts.map(function(d){
      const bal=debtBalance(d);
      const paid=Math.max(0,(d.original||bal)-bal);
      const pct=Math.min(100,(paid/(d.original||1))*100);
      // «Quedan n/tot cuotas» en TODAS las deudas (feedback 2026-07-21): sin plazo va estimado.
      const li=leftInfo(d);
      const day=debtChargeDay(d);
      return React.createElement("div",{className:"v4-debt-card rise",key:d.id},
        React.createElement("div",{className:"v4-debt-top"},
          React.createElement("span",{className:"v4-debt-emoji"},debtEmoji(d)),
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",{className:"v4-debt-name"},d.name),
            React.createElement("div",{className:"v4-debt-sub"},
              [d.monthly?tf("db_quota",{x:eur0(d.monthly)}):null, day?tf("fj_day_n",{d:day}):null, li?tf("db_left",{n:li.n,tot:li.tot,x:eur0(d.monthly||0)}):null].filter(Boolean).join(" · ")
            )
          ),
          ed.editing
            ? React.createElement("input",{className:"editv num",value:ed.draft[d.id],inputMode:"decimal",onChange:function(e){const v=e.target.value;ed.setDraft(function(dr){return Object.assign({},dr,{[d.id]:v});});}})
            : React.createElement("div",{className:"v4-debt-bal serif num"},eur(bal))
        ),
        React.createElement("div",{className:"v4-debt-bar"},React.createElement("i",{style:{width:pct+"%"}})),
        React.createElement("div",{className:"v4-debt-foot"},
          React.createElement("span",null,tf("db_paidoff",{x:eur0(paid),p:Math.round(pct)})),
          endsLabel(d) && React.createElement("span",null," · "+endsLabel(d))
        ),
        (d.balloon>0||d.downPayment>0) && React.createElement("div",{className:"v4-debt-sub",style:{marginTop:6,color:"var(--tan)"}},
          d.balloon>0?tf("db_balloon_line",{x:eur0(d.balloon)}):"",
          d.downPayment>0?(d.balloon>0?" · ":"")+tf("db_down_line",{x:eur0(d.downPayment)}):""),
        !ed.editing && bal>0.005 && React.createElement("button",{className:"v4-debt-amort",onClick:function(){ amortize(d); }},t("v4_amort_now")),
        ed.editing && React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:10,color:"var(--coral)"},onClick:function(){ delDebt(d.id); }},t("db_delete"))
      );
    }),
    React.createElement("button",{className:"btn btn-block "+(ed.editing?"btn-primary":"btn-ghost"),style:{marginTop:8},onClick:function(){ ed.editing?ed.save():ed.start(); }}, ed.editing?t("db_savechanges"):t("db_editbalances")),
    React.createElement("div",{className:"v4-tip"},
      React.createElement(AmortAdvisor,{state:state,set:set,onAmort:doAmort})
    ),
    adding
      ? React.createElement("div",{className:"add-form",style:{marginTop:12}},
          React.createElement("input",{className:"af-in",placeholder:t("db_concept"),value:form.name,onChange:function(e){ setForm(Object.assign({},form,{name:e.target.value})); }}),
          React.createElement("div",{className:"af-row"},
            React.createElement("input",{className:"af-in num",placeholder:t("db_amount"),inputMode:"decimal",value:form.value,onChange:function(e){ setForm(Object.assign({},form,{value:e.target.value})); }}),
            React.createElement("input",{className:"af-in num",placeholder:t("db_quota_ph"),inputMode:"decimal",value:form.monthly,onChange:function(e){ setForm(Object.assign({},form,{monthly:e.target.value})); }})
          ),
          React.createElement("div",{className:"af-row"},
            React.createElement("input",{className:"af-in num",placeholder:t("db_months_ph"),inputMode:"numeric",value:form.months,onChange:function(e){ setForm(Object.assign({},form,{months:e.target.value})); }}),
            React.createElement("input",{className:"af-in num",placeholder:t("db_day_ph"),inputMode:"numeric",style:{maxWidth:80},value:form.day,onChange:function(e){ setForm(Object.assign({},form,{day:e.target.value})); }}),
            React.createElement("select",{className:"af-in",value:form.account,onChange:function(e){ setForm(Object.assign({},form,{account:e.target.value})); }}, banks.map(function(b){ return React.createElement("option",{key:b,value:b},entOf(b).label); }))
          ),
          React.createElement("div",{className:"af-row"},
            React.createElement("input",{className:"af-in num",placeholder:t("db_down_ph"),inputMode:"decimal",value:form.down,onChange:function(e){ setForm(Object.assign({},form,{down:e.target.value})); }}),
            React.createElement("input",{className:"af-in num",placeholder:t("db_balloon_ph"),inputMode:"decimal",value:form.balloon,onChange:function(e){ setForm(Object.assign({},form,{balloon:e.target.value})); }})
          ),
          React.createElement("input",{className:"af-in num",placeholder:t("db_paid_ph"),inputMode:"numeric",value:form.paid,onChange:function(e){ setForm(Object.assign({},form,{paid:e.target.value})); }}),
          React.createElement("div",{className:"hint",style:{fontSize:11,marginTop:2}},t("db_paid_hint")),
          React.createElement("div",{className:"hint",style:{fontSize:11,marginTop:2}},t("db_financing_hint")),
          React.createElement("div",{className:"hint",style:{fontSize:11,marginTop:2}},t("db_balloon_hint")),
          React.createElement("button",{className:"btn btn-primary btn-block",onClick:addDebt},t("db_add"))
        )
      : React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:10},onClick:function(){ setAdding(true); }},React.createElement(I.plus,{width:16,height:16}),t("db_add")),
    React.createElement("div",{className:"hint",style:{padding:"10px 4px 0"}},t("db_hint"))
  );
}

/* ============================================================
   METAS DE AHORRO (#15)
   ============================================================ */
/* ============================================================
   RESERVAR DINERO (2026-08-03) — petición del usuario: su caso es una sola cuenta (Trade
   Republic) que hace de fondo de emergencia + round-up + inversión + gasto diario a la vez, y
   quería que ahorrar para una meta se notara de verdad en "lo que puede gastar", no solo en un
   bote aparte. Ver la explicación larga en `08-motor-bank.js` (reservaPlanFor/applyReserva).
   ============================================================ */
// Editor de reglas: nombre opcional, importe fijo o % de la nómina, y a qué meta va.
function ReservaRules({state, set}){
  const goals=(state.goals||[]).filter(function(g){ return !g.done; });
  const rules=(state.settings&&state.settings.reservaRules)||[];
  const [adding,setAdding]=useState(false);
  const blank={name:"",kind:"fixed",value:"",goalId:goals[0]&&goals[0].id||""};
  const [form,setForm]=useState(blank);
  const setRules=function(next){ set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,{reservaRules:next})}); }); };
  const addRule=function(){
    const v=parseFloat(String(form.value).replace(',','.'))||0;
    if(v<=0 || !form.goalId) return;
    const r={id:uid(),name:form.name||"",kind:form.kind,value:v,goalId:form.goalId};
    setRules(rules.concat([r]));
    setForm(blank); setAdding(false);
  };
  const delRule=function(id){ setRules(rules.filter(function(r){ return r.id!==id; })); };
  const goalName=function(id){ const g=(state.goals||[]).find(function(x){ return x.id===id; }); return g?((g.emoji||"🎯")+" "+g.name):t("rr_goal_gone"); };
  if(!goals.length && !rules.length) return null;   // sin metas activas no hay nada que configurar
  return React.createElement(CollapsibleCard,{title:t("rr_title"),sub:rules.length?tf("rr_sub",{n:rules.length}):t("rr_sub_empty"),dot:"#5FD08A",storageKey:"g_reserva_rules",help:t("h_reserva")},
    rules.length===0 && React.createElement("div",{className:"hint"}, t("rr_none")),
    rules.map(function(r){
      return React.createElement("div",{key:r.id,className:"sub-row"},
        React.createElement("div",{className:"sub-mid"},
          React.createElement("div",{className:"sub-name"}, r.name||goalName(r.goalId)),
          React.createElement("div",{className:"sub-meta"}, (r.kind==="pct"?tf("rr_row_pct",{v:r.value}):tf("rr_row_fixed",{v:eur0(r.value)}))+" → "+goalName(r.goalId))
        ),
        React.createElement("button",{className:"chip",style:{fontSize:11.5,padding:"3px 10px"},onClick:function(){ delRule(r.id); }}, "✕")
      );
    }),
    goals.length>0 && (adding
      ? React.createElement("div",{className:"add-form",style:{marginTop:10}},
          React.createElement("input",{className:"af-in",placeholder:t("rr_name_ph"),value:form.name,onChange:function(e){ setForm(Object.assign({},form,{name:e.target.value})); }}),
          React.createElement("div",{className:"af-row"},
            React.createElement("select",{className:"af-in",value:form.kind,onChange:function(e){ setForm(Object.assign({},form,{kind:e.target.value})); }},
              React.createElement("option",{value:"fixed"},t("rr_kind_fixed")),
              React.createElement("option",{value:"pct"},t("rr_kind_pct"))),
            React.createElement("input",{className:"af-in num",inputMode:"decimal",placeholder:form.kind==="pct"?"%":"€",value:form.value,onChange:function(e){ setForm(Object.assign({},form,{value:e.target.value})); }})
          ),
          React.createElement("select",{className:"af-in",value:form.goalId,onChange:function(e){ setForm(Object.assign({},form,{goalId:e.target.value})); }},
            goals.map(function(g){ return React.createElement("option",{key:g.id,value:g.id}, (g.emoji||"🎯")+" "+g.name); })),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},onClick:addRule}, t("rr_save")),
          React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setAdding(false); setForm(blank); }}, t("gl_cancel"))
        )
      : React.createElement("button",{className:"v4-ghost-add",style:{marginTop:8},onClick:function(){ setForm(blank); setAdding(true); }}, t("rr_add"))
    )
  );
}
// Banner de "nómina detectada": aparece cuando `lastPaydayOf` encuentra un ingreso grande que aún
// no se ha repartido ni descartado. Nunca aplica en silencio — siempre pide confirmación, porque
// aunque solo mueva cifras dentro de la app, es DINERO DE VERDAD para quien lo mira.
function ReservaDetect({state, set, showToast}){
  const dismissed=(state.reservaDismissed)||[];
  const cycle=useMemo(function(){ return lastPaydayOf(state.expenses); },[state.expenses]);
  const rules=(state.settings&&state.settings.reservaRules)||[];
  if(!cycle || !cycle.inc || !rules.length) return null;
  const income=cycle.inc;
  const key=reservaKeyOf(income);
  if(reservaAlreadyApplied(state,income) || dismissed.indexOf(key)!==-1) return null;
  const plan=reservaPlanFor(state, income.amount);
  if(!plan.plan.length) return null;
  const dailyEnt=(state.accounts||[]).find(function(a){ return accDaily(a); });
  const apply=function(){
    set(function(s){ return applyReserva(s, income, plan.plan, dailyEnt&&dailyEnt.ent); });
    if(showToast) showToast(t("rr_applied_ok"));
  };
  const dismiss=function(){ set(function(s){ return Object.assign({},s,{reservaDismissed:(s.reservaDismissed||[]).concat([key])}); }); };
  return React.createElement("div",{className:"v4-card rise",style:{borderColor:"var(--mint-dim)",marginBottom:14}},
    React.createElement("div",{style:{fontWeight:800,fontSize:14.5}}, tf("rr_detect_t",{x:eur0(Math.abs(income.amount))})),
    React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:4}}, tf("rr_detect_sub",{d:parseDate(income.date).toLocaleDateString(loc(),{day:'2-digit',month:'2-digit'})})),
    React.createElement("div",{style:{marginTop:10}}, plan.plan.map(function(p){
      return React.createElement("div",{key:p.ruleId,style:{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}},
        React.createElement("span",null, p.name), React.createElement("span",{className:"num"}, eur0(p.amount)));
    })),
    plan.remainder>0 && React.createElement("div",{style:{fontSize:12,color:"var(--muted-2)",marginTop:4}}, tf("rr_remainder",{x:eur0(plan.remainder)})),
    React.createElement("div",{className:"af-row",style:{marginTop:10}},
      React.createElement("button",{className:"btn btn-primary",style:{flex:1},onClick:apply}, t("rr_apply")),
      React.createElement("button",{className:"btn btn-ghost",style:{flex:1},onClick:dismiss}, t("rr_dismiss"))
    )
  );
}
function Goals({state, set, totals, showToast}){
  const tt=totals||{};
  const goals=state.goals||[];
  const gm=gamifOf(state, totals);
  const [adding,setAdding]=useState(false);
  const [editing,setEditing]=useState(false);
  const [drafts,setDrafts]=useState({});
  const [contribGoal,setContribGoal]=useState(null);   // meta abierta en la hoja de aportar
  const blank={name:"",emoji:"🎯",target:"",saved:"",deadline:"",monthly:""};
  const [form,setForm]=useState(blank);

  const addGoal=function(){
    const tg=parseFloat(String(form.target).replace(',','.'))||0; if(tg<=0) return;
    const sv=parseFloat(String(form.saved).replace(',','.'))||0;
    const mo=parseFloat(String(form.monthly).replace(',','.'))||0;
    const done=sv>=tg;
    const g={id:uid(),name:form.name||t("gl_newdefault"),emoji:form.emoji||"🎯",target:tg,saved:sv,deadline:form.deadline||null,monthly:mo>0?mo:null,color:"#5FD08A",createdAt:new Date().toISOString(),done:done,doneAt:done?new Date().toISOString():null};
    set(function(s){ return Object.assign({},s,{goals:(s.goals||[]).concat([g])}); });
    setForm(blank); setAdding(false);
  };
  // Aportar a una meta: hoja propia con teclado numérico in-app (como el + de gastos) y elección
  // de banco de origen — así no salta el teclado del sistema y no rompe la estética (2026-07-18).
  const contribute=function(g){ setContribGoal(g); };
  const addToGoal=function(g,amt,bank){
    if(!amt) return;
    set(function(s){ return Object.assign({},s,{goals:(s.goals||[]).map(function(x){
      if(x.id!==g.id) return x;
      const ns=Math.max(0,(x.saved||0)+amt);
      const becameDone=!x.done && ns>=x.target;
      if(becameDone){ celebrate(); if(showToast) showToast(tf("gl_celebrate",{name:x.name})); }
      // fromBank: recuerda el último banco de origen (para pre-seleccionarlo la próxima vez y mostrarlo).
      return Object.assign({},x,{saved:ns,fromBank:bank||x.fromBank,done:ns>=x.target,doneAt:(ns>=x.target&&!x.doneAt)?new Date().toISOString():x.doneAt});
    })}); });
  };
  const delGoal=function(id){ set(function(s){ return Object.assign({},s,{goals:(s.goals||[]).filter(function(g){return g.id!==id;})}); }); if(goals.length<=1) setEditing(false); };
  const startEdit=function(){ const d={}; goals.forEach(function(g){ d[g.id]={name:g.name,emoji:g.emoji||"🎯",target:String(g.target),saved:String(g.saved),deadline:g.deadline||"",monthly:g.monthly!=null?String(g.monthly):""}; }); setDrafts(d); setEditing(true); };
  const setD=function(id,k,v){ setDrafts(function(dr){ const n=Object.assign({},dr); n[id]=Object.assign({},n[id],{[k]:v}); return n; }); };
  const saveEdit=function(){
    set(function(s){ return Object.assign({},s,{goals:(s.goals||[]).map(function(g){
      const d=drafts[g.id]; if(!d) return g;
      const tg=parseFloat(String(d.target).replace(',','.'))||g.target;
      const svN=parseFloat(String(d.saved).replace(',','.'));
      const sv=isNaN(svN)?g.saved:Math.max(0,svN);
      const moN=parseFloat(String(d.monthly).replace(',','.'));
      const mo=(isNaN(moN)||moN<=0)?null:moN;
      const done=sv>=tg;
      return Object.assign({},g,{name:d.name||g.name,emoji:d.emoji||g.emoji,target:tg,saved:sv,deadline:d.deadline||null,monthly:mo,done:done,doneAt:done?(g.doneAt||new Date().toISOString()):null});
    })}); });
    setEditing(false);
  };

  const totalSaved=goals.reduce(function(a,g){return a+(g.saved||0);},0);
  const totalTarget=goals.reduce(function(a,g){return a+(g.target||0);},0);

  const emojiPicker=function(cur,onPick){
    return React.createElement("div",{className:"emoji-pick"}, GOAL_EMOJIS.map(function(e){
      return React.createElement("button",{key:e,type:"button",className:(cur===e?"on":""),onClick:function(){ onPick(e); }}, e);
    }));
  };

  return React.createElement("div",null,
    React.createElement("div",{className:"v4-card v4-card-hero rise"},
      React.createElement("div",{className:"v4-micro"},t("v4_goals_hero")),
      React.createElement("div",{className:"serif num",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6,color:"var(--mint)"}},eur(totalSaved)),
      totalTarget>0 && React.createElement("div",{style:{marginTop:10,fontSize:13.5,color:"var(--muted)"}},tf("gl_total_sub",{x:eur0(totalTarget)}))
    ),
    React.createElement(ReservaDetect,{state:state,set:set,showToast:showToast}),
    goals.length===0 && !adding && React.createElement("div",{className:"empty"},
      React.createElement("div",{className:"ttl"},t("gl_empty_t")), t("gl_empty_d")),

    goals.map(function(g){
      const pct=goalPct(g); const eta=goalEta(g, tt.ahorroMensual||0); const ed=editing&&drafts[g.id];
      return React.createElement("div",{className:"v4-goal-card rise",key:g.id},
        React.createElement("div",{className:"v4-debt-top"},
          React.createElement("span",{className:"v4-debt-emoji"}, ed?ed.emoji:(g.emoji||"🎯")),
          React.createElement("div",{style:{flex:1,minWidth:0}},
            ed
              ? React.createElement("input",{className:"af-in",value:ed.name,onChange:function(e){ setD(g.id,"name",e.target.value); }})
              : React.createElement("div",{className:"v4-debt-name"}, g.name, g.done && React.createElement("span",{className:"goal-medal"}," "+t("gl_done_badge"))),
            !ed && React.createElement("div",{className:"v4-debt-sub"}, eur0(g.saved||0)+" "+t("gl_of")+" "+eur0(g.target||0))
          ),
          !ed && React.createElement("div",{className:"serif num",style:{fontSize:22,fontWeight:550,color:"var(--mint)"}}, Math.round(pct)+"%")
        ),
        React.createElement("div",{className:"v4-goal-bar"},React.createElement("i",{style:{width:pct+"%",background:g.done?"linear-gradient(90deg,#F2C14E,#F2C14E)":"linear-gradient(90deg,var(--mint),var(--mint-hi))"}})),
        ed
          ? React.createElement(React.Fragment,null,
              React.createElement("div",{className:"af-row",style:{marginTop:10}},
                React.createElement("input",{className:"af-in num",placeholder:t("gl_saved_ph"),inputMode:"decimal",value:ed.saved,onChange:function(e){ setD(g.id,"saved",e.target.value); }}),
                React.createElement("input",{className:"af-in num",placeholder:t("gl_target_ph"),inputMode:"decimal",value:ed.target,onChange:function(e){ setD(g.id,"target",e.target.value); }})
              ),
              React.createElement("input",{className:"af-in",type:"month",style:{marginTop:8},value:ed.deadline,onChange:function(e){ setD(g.id,"deadline",e.target.value); }}),
              React.createElement("input",{className:"af-in num",style:{marginTop:8},placeholder:t("gl_monthly_ph"),inputMode:"decimal",value:ed.monthly,onChange:function(e){ setD(g.id,"monthly",e.target.value); }}),
              React.createElement("div",{style:{marginTop:8}}, emojiPicker(ed.emoji,function(e){ setD(g.id,"emoji",e); })),
              React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:10,color:"var(--coral)"},onClick:function(){ delGoal(g.id); }},t("gl_delete"))
            )
          : React.createElement(React.Fragment,null,
              React.createElement("div",{className:"goal-eta "+eta.cls,style:{marginTop:8}}, eta.text),
              !g.done && React.createElement("button",{className:"v4-goal-cta",onClick:function(){ contribute(g); }}, t("gl_contribute"))
            )
      );
    }),

    goals.length>0 && React.createElement("button",{className:"btn btn-block "+(editing?"btn-primary":"btn-ghost"),style:{marginTop:4},onClick:function(){ editing?saveEdit():startEdit(); }}, editing?t("gl_save"):t("gl_edit")),

    React.createElement("div",{style:{marginTop:14}}, React.createElement(ReservaRules,{state:state,set:set})),

    adding
      ? React.createElement("div",{className:"add-form",style:{marginTop:12}},
          React.createElement("input",{className:"af-in",placeholder:t("gl_name_ph"),value:form.name,onChange:function(e){ setForm(Object.assign({},form,{name:e.target.value})); }}),
          emojiPicker(form.emoji,function(e){ setForm(Object.assign({},form,{emoji:e})); }),
          React.createElement("div",{className:"af-row"},
            React.createElement("input",{className:"af-in num",placeholder:t("gl_target_ph"),inputMode:"decimal",value:form.target,onChange:function(e){ setForm(Object.assign({},form,{target:e.target.value})); }}),
            React.createElement("input",{className:"af-in num",placeholder:t("gl_saved_ph"),inputMode:"decimal",value:form.saved,onChange:function(e){ setForm(Object.assign({},form,{saved:e.target.value})); }})
          ),
          React.createElement("label",{className:"goal-dl-lbl"},t("gl_deadline")),
          React.createElement("input",{className:"af-in",type:"month",value:form.deadline,onChange:function(e){ setForm(Object.assign({},form,{deadline:e.target.value})); }}),
          React.createElement("input",{className:"af-in num",placeholder:t("gl_monthly_ph"),inputMode:"decimal",value:form.monthly,onChange:function(e){ setForm(Object.assign({},form,{monthly:e.target.value})); }}),
          React.createElement("button",{className:"btn btn-primary btn-block",onClick:addGoal},t("gl_create")),
          React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setAdding(false); setForm(blank); }},t("gl_cancel"))
        )
      : (!editing || goals.length===0) && React.createElement("button",{className:"v4-ghost-add",onClick:function(){ setAdding(true); }},t("v4_goal_new")),

    React.createElement(ContributeGoalSheet,{goal:contribGoal,state:state,onClose:function(){ setContribGoal(null); },
      onContribute:function(amt,bank){ addToGoal(contribGoal,amt,bank); setContribGoal(null); }})
  );
}

/* Hoja «Aportar a una meta» — teclado numérico propio + banco de origen (2026-07-18).
   El teclado del sistema rompía la estética y no dejaba elegir el banco; esto es igual que
   el sheet «Apuntar» del +. No mueve saldos de cuentas (la hucha de metas es un bote aparte),
   solo suma a la meta y recuerda de qué banco la nutres. */
function ContributeGoalSheet({goal, state, onClose, onContribute}){
  const [raw,setRaw]=useState("");
  const [bank,setBank]=useState(null);
  const bankOpts=useMemo(function(){
    const seen={}; const out=[];
    (state.accounts||[]).forEach(function(a){ if(a&&a.ent&&!seen[a.ent]){ seen[a.ent]=1; out.push(a.ent); } });
    return out;
  },[state.accounts]);
  useEffect(function(){
    if(goal){
      setRaw("");
      // Pre-selecciona el último banco usado en esta meta, o la cuenta de gasto diario, o la 1ª.
      const daily=(state.accounts||[]).find(function(a){ return accDaily(a); });
      setBank(goal.fromBank || (daily&&daily.ent) || (bankOpts[0]||null));
    }
  },[goal]);
  useBackClose(!!goal, onClose);
  const swipe=useSheetSwipe(!!goal, onClose);
  if(!goal) return null;
  const amt=parseNumPadRaw(raw);
  const save=function(){
    if(!(amt>0)) return;
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
    onContribute(amt, bank);
  };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:onClose},
      React.createElement("div",Object.assign({className:"v4-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"serif",style:{fontSize:20,fontWeight:600,textAlign:"center",marginBottom:2}}, (goal.emoji||"🎯")+" "+tf("gl_contribute_title",{name:goal.name})),
        React.createElement("div",{className:"v4-apuntar-amt serif num"},
          raw?raw+" €":React.createElement("span",{style:{color:"var(--muted-2)"}},"0 €")),
        bankOpts.length>0 && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"v4-exp-sec",style:{marginTop:2}}, t("gl_contribute_from")),
          React.createElement("div",{className:"v4-chips"},
            bankOpts.map(function(b){
              return React.createElement("button",{key:b,className:"v4-chip"+(bank===b?" on":""),onClick:function(){ setBank(b); }},
                "🏦 "+entOf(b).label);
            })
          )
        ),
        React.createElement(NumPad,{value:raw, onChange:setRaw}),
        React.createElement("button",{className:"v4-cta",disabled:!(amt>0),style:!(amt>0)?{opacity:.5}:null,onClick:save},
          amt>0?tf("gl_contribute_save",{x:eur(amt)}):t("gl_contribute"))
      )
    ), document.body);
}

/* Pantalla "Logros" (rediseño 1a): la gamificación (nivel + retos + medallas) vive aquí, FUERA de
   "Metas". El Resumen resume racha+nivel en un titular; el detalle (medallas/retos) vive en esta pantalla. */
function Achievements({state, totals}){
  const gm=gamifOf(state, totals);
  return React.createElement("div",null,
    /* ---------- NIVEL ---------- */
    React.createElement("div",{className:"card gm-level",style:{marginTop:4,padding:"15px 16px"}},
      React.createElement("div",{className:"gm-lvl-top"},
        React.createElement("span",{className:"gm-lvl-ic"}, GM_ICONS[gm.lvl]),
        React.createElement("div",{style:{flex:1,minWidth:0}},
          React.createElement("div",{className:"gm-lvl-name"}, "Nv "+(gm.lvl+1)+" · "+t("gm_lvl_"+gm.lvl)),
          React.createElement("div",{className:"gm-lvl-sub num"}, t("gm_score")+": "+eur0(gm.savedScore))),
        React.createElement("span",{className:"gm-lvl-badge"}, t("gm_level"))
      ),
      React.createElement("div",{className:"bar",style:{marginTop:10}},React.createElement("i",{style:{width:gm.lvlProg+"%",background:"linear-gradient(90deg,#C9A6F0,#7FB5E8)"}})),
      React.createElement("div",{className:"gm-lvl-next"}, gm.nextMin!=null ? tf("gm_next",{x:eur0(Math.max(0,gm.nextMin-gm.savedScore)),n:gm.lvl+2}) : t("gm_maxlvl"))
    ),

    /* ---------- RETOS DEL MES ---------- */
    React.createElement("div",{className:"card",style:{marginTop:12,padding:"15px 16px"}},
      React.createElement("div",{className:"gm-sec-h"}, t("gm_retos")),
      (function(){ const r=gm.budgetReto; const over=r.budget>0&&r.margin<0;
        return React.createElement("div",{className:"gm-reto"},
          React.createElement("div",{className:"gm-reto-top"},
            React.createElement("span",{className:"gm-reto-name"}, "🎯 "+t("gm_reto_budget")),
            React.createElement("span",{className:"gm-reto-pct num"+(over?" over":"")}, eur0(r.spent)+" / "+eur0(r.budget))),
          React.createElement("div",{className:"bar"},React.createElement("i",{style:{width:Math.min(100,r.pct)+"%",background: over?"linear-gradient(90deg,#E2705F,#E2705F)":"linear-gradient(90deg,var(--mint),var(--mint-bright))"}})),
          React.createElement("div",{className:"gm-reto-sub"+(over?" warn":" ok")}, r.budget<=0 ? "—" : (over?tf("gm_reto_budget_over",{x:eur0(-r.margin)}):tf("gm_reto_budget_ok",{x:eur0(r.margin)})))
        ); })(),
      (function(){ const r=gm.ruReto;
        return React.createElement("div",{className:"gm-reto",style:{marginTop:12}},
          React.createElement("div",{className:"gm-reto-top"},
            React.createElement("span",{className:"gm-reto-name"}, "🪙 "+t("gm_reto_roundup")),
            React.createElement("span",{className:"gm-reto-pct num"}, r.done?t("gm_reto_done"):(Math.round(r.pct)+"%"))),
          React.createElement("div",{className:"bar"},React.createElement("i",{style:{width:Math.min(100,r.pct)+"%",background:r.done?"linear-gradient(90deg,#F2C14E,#F2C14E)":"linear-gradient(90deg,#E6C36A,#F2C14E)"}})),
          React.createElement("div",{className:"gm-reto-sub ok"}, tf("gm_reto_roundup_sub",{x:eur(r.cur),y:eur0(r.goal)}))
        ); })()
    ),

    /* ---------- LOGROS ---------- */
    React.createElement("div",{className:"card",style:{marginTop:12,padding:"15px 16px"}},
      React.createElement("div",{className:"gm-sec-h"}, t("gm_logros")),
      React.createElement("div",{className:"gm-streak"+(gm.streak.current>0?" on":"")},
        gm.streak.current>=2 ? tf("gm_streak",{n:gm.streak.current}) : (gm.streak.current===1?t("gm_streak_1"):t("gm_streak_none")),
        gm.streak.best>gm.streak.current && React.createElement("span",{className:"gm-streak-best"}, " · "+tf("gm_streak_best",{n:gm.streak.best}))
      ),
      React.createElement("div",{className:"gm-badges"}, gm.badges.map(function(b){
        return React.createElement("div",{key:b.id,className:"gm-badge"+(b.unlocked?" on":""),title:b.unlocked?t("gm_b_"+b.id):t("gm_locked")},
          React.createElement("span",{className:"gm-badge-ic"}, b.unlocked?"🏅":"🔒"),
          React.createElement("span",{className:"gm-badge-lbl"}, t("gm_b_"+b.id))
        );
      }))
    )
  );
}

