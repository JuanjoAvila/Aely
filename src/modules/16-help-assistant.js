/* Pregúntame: una pregunta → una frase + un botón. Cifras solo en el móvil.
   Destinos cerrados; la Edge (si se activa) solo elige ids/cue, nunca prosa ni dinero. */
const HELP_TOPICS=[
  {id:"cash",title:"help_cash",body:"help_cash_body",cue:"help_cue_cash",actions:["cash","accounts"]},
  {id:"goals",title:"help_goals",body:"help_goals_body",cue:"help_cue_goals",actions:["goals","debts"]},
  {id:"debts",title:"help_debts",body:"help_debts_body",cue:"help_cue_debts",actions:["debts","goals"]},
  {id:"banks",title:"help_banks",body:"help_banks_body",cue:"help_cue_banks",actions:["banks","expenses"]},
  {id:"history",title:"help_history",body:"help_history_body",cue:"help_cue_history",actions:["history","banks"]},
  {id:"categories",title:"help_categories",body:"help_categories_body",cue:"help_cue_categories",actions:["expenses"]},
  {id:"receipts",title:"help_receipts",body:"help_receipts_body",cue:"help_cue_receipts",actions:["receipts","banks"]}
];
const HELP_ACTION_LABELS={cash:"help_open_cash",accounts:"help_open_accounts",goals:"help_open_goals",debts:"help_open_debts",banks:"help_open_banks",expenses:"help_open_expenses",history:"help_open_history",receipts:"help_open_receipts",settings:"settings"};
const HELP_CUES=["help_cue_cash","help_cue_goals","help_cue_goals_simple","help_cue_debts","help_cue_banks","help_cue_history","help_cue_categories","help_cue_receipts","help_cue_budget_left","help_cue_budget_none","help_cue_budget_over","help_cue_next_bills","help_cue_next_bills_one","help_cue_next_bills_amount","help_cue_next_bills_none","help_cue_end_ok","help_cue_end_warn","help_cue_end_unknown","help_cue_clarify","help_cue_balance","help_cue_balance_miss","help_cue_balance_many"];
const HELP_INTENTS=["budget_left","next_bills","end_of_month","account_balance"];
/* Ents reales del catálogo (misma clave que state.accounts[].ent). */
const HELP_BANKS=["sabadell","caixabank","revolut","trade_republic","myinvestor","efectivo","other"];
const HELP_BANK_RE=[
  ["sabadell",/\bsabadell\b/],
  ["caixabank",/\b(caixa|caixabank)\b/],
  ["revolut",/\brevolut\b/],
  ["trade_republic",/\b(trade republic|traderepublic|\btr\b)\b/],
  ["myinvestor",/\bmyinvestor\b/],
  ["efectivo",/\b(efectivo|efectiu|cash)\b/]
];
function helpBankLabel(key){
  if(key==="trade_republic") return "Trade Republic";
  if(key==="caixabank") return "CaixaBank";
  if(!key||key==="other") return "";
  return key.charAt(0).toUpperCase()+key.slice(1);
}
function helpTopic(id){ return HELP_TOPICS.find(function(x){ return x.id===id; }); }
function helpNorm(q){ return String(q||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function helpLooksSecret(q){
  var s=String(q||"");
  if(/\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/i.test(s)) return true;
  if(/\b(?:\d[ -]*?){13,19}\b/.test(s)) return true;
  if(/\b(pin|cvv|cvc|password|contrasena|contraseña|clave|token)\b\s*(?:es\s+|[:=]\s*)[^\s]{3,}/i.test(s)) return true;
  if(/\b(?:sk|pk|tok)_[A-Za-z0-9_-]{12,}\b/.test(s)) return true;
  return false;
}
function helpLocalBank(question){
  var q=helpNorm(question);
  for(var i=0;i<HELP_BANK_RE.length;i++){ if(HELP_BANK_RE[i][1].test(q)) return HELP_BANK_RE[i][0]; }
  return null;
}
function helpLocalTopics(question){
  var q=helpNorm(question);
  var hits=[];
  var add=function(id,re){ if(re.test(q)) hits.push(id); };
  add("cash",/\b(efectivo|efectiu|cash|cajero|caixer|atm|billetes|monedas)\b/);
  add("categories",/\b(categoria[s]?|categoritz\w*|categoriz\w*|categoris\w*|categor[yi]\w*|mapfre|clasific\w*|classific\w*|otros|altres)\b/);
  add("history",/\b(historic\w*|history|import\w*|extracto[s]?|extracte[s]?|statement[s]?)\b/);
  add("goals",/\b(ahorr\w*|estalvi\w*|saving[s]?|save|meta[s]?|goal[s]?)\b/);
  add("debts",/\b(deuda[s]?|deute[s]?|debt[s]?|prestamo[s]?|prestec[s]?|loan[s]?|hipoteca|mortgage|cuota[s]?)\b/);
  add("receipts",/\b(recibo[s]?|rebut[s]?|bill[s]?|domicili\w*)\b/);
  add("banks",/\b(banco[s]?|banc[s]?|bank[s]?|caixa\w*|sabadell|revolut|trade republic|sincron\w*|actualiz\w*|sync\w*|no (sale|carga|aparece|llega|leyo)|missing)\b/);
  return hits.slice(0,3);
}
function helpLocalIntent(question){
  var q=helpNorm(question);
  // «¿cómo cambio el presupuesto?» es guía, no cifra (P2 Claude 16/9).
  if(/\b(como|how)\b/.test(q) && /\b(presupuesto|pressupost|budget|recibo|rebut|bill|meta|goal|deuda|deute|debt)\b/.test(q))
    return null;
  if(/\b(cuanto|quant|how much)\b/.test(q) && /\b(queda|remain|left|presupuesto|pressupost|budget)\b/.test(q))
    return "budget_left";
  if(/\b(me queda|em queda)\b/.test(q) && /\b(mes|month|presupuesto|budget)\b/.test(q)
    && !/\b(cuota|recibo|rebut|deuda|deute|bill|debt)\b/.test(q))
    return "budget_left";
  if(/\b(que recibos|quin(s)? rebut|what bills|recibos.*falt|rebuts.*falt|proximos cargos|propers carrecs)\b/.test(q)
    || /\b(recibo|rebut|bill)\b/.test(q) && /\b(falt|pend|queda|next)\b/.test(q))
    return "next_bills";
  if(/\b(llego|arribo|fin de mes|fi de mes|end of (the )?month|llegare)\b/.test(q))
    return "end_of_month";
  if(/\b(cuanto (tengo|hay)|quant (tinc|hi ha)|how much.*(have|in)|saldo|balance)\b/.test(q) && helpLocalBank(question))
    return "account_balance";
  return null;
}
/* Pregúntame reutiliza el resumen financiero puro: pendiente = fixed+deudas no
   cobrados del mes (misma regla que totals.pendingThisMonth), no nº de bancos. */
function helpSnap(state, totals){
  state=state||{}; totals=totals||{};
  var budAmt=0, spent=0, rem=0;
  try{
    if(typeof monthBudgetStats==="function"){
      var bud=monthBudgetStats(state);
      budAmt=bud.budget!=null?bud.budget:(state.budget||0);
      spent=Math.max(0, bud.against||0);
      rem=bud.remaining!=null?bud.remaining:(budAmt-spent);
    }else{
      budAmt=Number(state.budget)||0;
      spent=Number(totals.spent)||0;
      rem=totals.remaining!=null?Number(totals.remaining):(budAmt-spent);
    }
  }catch(e){ budAmt=Number(state.budget)||0; }
  var pendN=0, pendTot=0;
  try{
    var today=totals.today||new Date().getDate();
    var cm=totals.curMonth!=null?totals.curMonth:(new Date().getMonth()+1);
    var cy=totals.curYear!=null?totals.curYear:new Date().getFullYear();
    if(typeof pendingBillsSummary==="function"){
      var pending=pendingBillsSummary(state,cm,cy,today);
      pendN=pending.count; pendTot=pending.total;
    }else if(totals.pendingThisMonth!=null){
      pendTot=Number(totals.pendingThisMonth)||0;
      pendN=pendTot>0?1:0;
    }
  }catch(e2){
    pendTot=Number(totals.pendingThisMonth)||0;
    pendN=pendTot>0?1:0;
  }
  var bals={}, balsCount={};
  try{
    var shownOpts={
      injTR:totals.injTR||0,
      spentByBank:totals.spentByBank||{},
      paidNetByBank:totals.paidNetByBank||{},
      roundup:totals.roundupThisMonth||0,
      monthlyInvest:totals.monthlyInvestThisMonth||0
    };
    (state.accounts||[]).forEach(function(a){
      if(!a||!a.ent) return;
      balsCount[a.ent]=(balsCount[a.ent]||0)+1;
      // Misma cifra que la fila de Cartera (no a.bal / dynBal inexistente).
      var shown=typeof saldoCuentaMostrada==="function"
        ? saldoCuentaMostrada(a, shownOpts)
        : (Number(a.value)||0);
      bals[a.ent]=(bals[a.ent]||0)+shown;
    });
  }catch(e3){
    bals=Object.assign({},totals.bankBal||{});
  }
  var fixedAcc=(state.accounts||[]).find(function(a){ return typeof accFixed==="function"&&accFixed(a); });
  // La proyección solo se atribuye a la cuenta marcada para recibos; sin ella no se adivina banco.
  var mainKey=(fixedAcc&&fixedAcc.ent)||null;
  var mainLabel=mainKey;
  try{ if(mainKey&&typeof entOf==="function") mainLabel=(entOf(mainKey).label)||mainKey; }catch(e4){}
  var projected=mainKey&&totals.projectedByBank&&isFinite(Number(totals.projectedByBank[mainKey]))
    ? Number(totals.projectedByBank[mainKey]) : null;
  return {
    budget:budAmt, spent:spent, remaining:rem,
    pendingCount:pendN, pendingTotal:pendTot,
    mainProjected:projected,
    mainBank:mainLabel||"",
    balances:bals,
    balanceCounts:balsCount
  };
}
function helpOpenDetail(state, totals, opts){
  state=state||{}; opts=opts||{};
  return {
    simple:!!(state.settings&&state.settings.simpleMode),
    hiddenTabs:typeof tabHiddenOf==="function"?tabHiddenOf(state):[],
    hasCash:(state.accounts||[]).some(function(a){ return typeof isEfectivoEnt==="function"?isEfectivoEnt(a):a.ent==="efectivo"; }),
    helpAiOk:!!(state.settings&&state.settings.helpAiOk),
    helpAiAsked:!!(state.settings&&state.settings.helpAiAsked),
    onConsent:typeof opts.onConsent==="function"?opts.onConsent:null,
    snap:helpSnap(state, totals)
  };
}
function helpValidatedTopics(value){
  if(!Array.isArray(value)||value.length>3||value.some(function(id){ return typeof id!=="string"||!helpTopic(id); })) return [];
  return value.filter(function(id,i){ return typeof id==="string"&&helpTopic(id)&&value.indexOf(id)===i; });
}
function helpValidatedCue(value){
  return (typeof value==="string"&&HELP_CUES.indexOf(value)>=0)?value:null;
}
function helpCueForTopic(topicId, value){
  var item=helpTopic(topicId);
  if(!item) return null;
  // El proveedor solo clasifica: la frase siempre queda ligada al tema local elegido.
  var cue=helpValidatedCue(value);
  if(cue&&cue!==item.cue) cue=null;
  return cue||item.cue;
}
function helpAnswerFromSnap(intent, snap, bank){
  snap=snap||{};
  if(intent==="budget_left"){
    var bud=Number(snap.budget)||0;
    var rem=snap.remaining!=null?Number(snap.remaining):(bud-(Number(snap.spent)||0));
    if(!(bud>0)) return {cue:"help_cue_budget_none",action:"expenses",vars:null};
    if(rem< -0.005) return {cue:"help_cue_budget_over",action:"expenses",vars:{x:Math.abs(rem),money:true}};
    return {cue:"help_cue_budget_left",action:"expenses",vars:{x:Math.max(0,rem),b:bud,money:true}};
  }
  if(intent==="next_bills"){
    var n=snap.pendingCount==null?null:(Number(snap.pendingCount)||0);
    var tot=Number(snap.pendingTotal)||0;
    if(!(tot>0)&&!(n>0)) return {cue:"help_cue_next_bills_none",action:"receipts",vars:null};
    if(!(n>0)) return {cue:"help_cue_next_bills_amount",action:"receipts",vars:{x:tot,moneyX:true}};
    if(n===1) return {cue:"help_cue_next_bills_one",action:"receipts",vars:{n:1,x:tot,moneyX:true}};
    return {cue:"help_cue_next_bills",action:"receipts",vars:{n:n,x:tot,moneyX:true}};
  }
  if(intent==="end_of_month"){
    var proj=snap.mainProjected;
    var bankName=snap.mainBank||"";
    if(proj==null||!isFinite(Number(proj))) return {cue:"help_cue_end_unknown",action:"receipts",vars:null};
    var ok=Number(proj)>=0;
    return {cue:ok?"help_cue_end_ok":"help_cue_end_warn",action:"receipts",vars:{x:Number(proj),bank:bankName,money:true}};
  }
  if(intent==="account_balance"){
    var bals=snap.balances||{};
    var counts=snap.balanceCounts||{};
    var key=bank&&HELP_BANKS.indexOf(bank)>=0?bank:null;
    if(!key||key==="other") return {cue:"help_cue_balance_miss",action:"accounts",vars:null};
    var label=helpBankLabel(key);
    if((counts[key]||0)>1)
      return {cue:"help_cue_balance_many",action:"accounts",vars:{bank:label,n:String(counts[key])}};
    if(bals[key]==null||!isFinite(Number(bals[key])))
      return {cue:"help_cue_balance_miss",action:"accounts",vars:null};
    return {cue:"help_cue_balance",action:"accounts",vars:{bank:label,x:Number(bals[key]),moneyX:true}};
  }
  return null;
}
function helpFormatVars(vars){
  if(!vars) return null;
  var out={};
  Object.keys(vars).forEach(function(k){
    if(k==="money"||k==="moneyX") return;
    var v=vars[k];
    if((vars.money&&(k==="x"||k==="b"))||(vars.moneyX&&k==="x")) out[k]=typeof eur0==="function"?eur0(v):String(v);
    else out[k]=String(v);
  });
  return out;
}
function helpPhrase(cue, vars){
  if(!cue) return "";
  var raw=t(cue);
  if(!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g,function(_,k){ return vars[k]!=null?String(vars[k]):""; });
}

function HelpAssistant({onClose,onAction,onConsent,online,signedIn,simple,hiddenTabs,hasCash,snap,helpAiOk,helpAiAsked}){
  const [question,setQuestion]=useState("");
  const [asked,setAsked]=useState("");
  const [answer,setAnswer]=useState(null); /* {phrase, action, topicIds, stepsId, low} */
  const [busy,setBusy]=useState(false);
  const [stepsOpen,setStepsOpen]=useState(false);
  const [consentOpen,setConsentOpen]=useState(false);
  const [remoteOk,setRemoteOk]=useState(!!helpAiOk);
  const [remoteAsked,setRemoteAsked]=useState(!!helpAiAsked);
  const [remoteNotice,setRemoteNotice]=useState(null);
  const requestRef=useRef(0);
  const dialogRef=useRef(null);
  const swipe=useSheetSwipe(true, onClose);
  useBackClose(true,onClose);
  useEffect(function(){
    var root=dialogRef.current;
    if(!root) return undefined;
    var first=root.querySelector("#help-question");
    if(first) first.focus({preventScroll:true});
    var keys=function(e){
      if(e.key==="Escape"){ e.preventDefault(); onClose(); return; }
      if(e.key!=="Tab") return;
      var xs=Array.prototype.filter.call(root.querySelectorAll('button:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'),function(x){ return x.offsetParent!==null; });
      if(!xs.length){ e.preventDefault(); return; }
      var a=xs[0],b=xs[xs.length-1];
      if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); b.focus(); }
      else if(!e.shiftKey&&document.activeElement===b){ e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown",keys);
    return function(){ document.removeEventListener("keydown",keys); };
  },[]);

  const paintLocal=function(text){
    if(helpLooksSecret(text)){
      setAnswer({phrase:t("help_secret"),action:null,topicIds:[],stepsId:null,low:false});
      return;
    }
    var intent=helpLocalIntent(text);
    if(intent){
      var built=helpAnswerFromSnap(intent, snap, helpLocalBank(text));
      if(built){
        setAnswer({phrase:helpPhrase(built.cue, helpFormatVars(built.vars)),action:built.action,topicIds:[],stepsId:null,low:false,intent:intent});
        return;
      }
    }
    var topics=helpLocalTopics(text);
    if(topics.length===1){
      var item=helpTopic(topics[0]);
      var cue1=(simple&&topics[0]==="goals")?"help_cue_goals_simple":(item.cue||item.title);
      setAnswer({phrase:t(cue1),action:item.actions[0],topicIds:topics,stepsId:topics[0],low:false});
      return;
    }
    if(topics.length>1){
      setAnswer({phrase:t("help_cue_clarify"),action:null,topicIds:topics,stepsId:null,low:true});
      return;
    }
    setAnswer({phrase:t("help_unknown"),action:null,topicIds:[],stepsId:null,low:true});
  };

  const send=function(e){
    if(e) e.preventDefault();
    var text=question.trim(); if(!text) return;
    if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
    requestRef.current++; setBusy(false); setAsked(text); setStepsOpen(false); setRemoteNotice(null);
    paintLocal(text);
    // OpenAI es opcional: solo con consentimiento, sesión y una duda local poco clara.
  };
  const askOnline=async function(forceOk){
    if(busy||!online||!signedIn||!cloud.enabled()||!(remoteOk||forceOk)||!asked) return;
    if(helpLooksSecret(asked)) return;
    var id=++requestRef.current; setBusy(true); setRemoteNotice(null);
    var timer;
    try{
      var result=await Promise.race([cloud.askHelp(asked,CURLANG),new Promise(function(resolve,reject){ timer=setTimeout(function(){ reject(new Error("timeout")); },20000); })]);
      if(id!==requestRef.current) return;
      if(!result||result.ok===false){
        setRemoteNotice(result&&result.error==="limited"?"help_limited":"help_unavailable");
        return;
      }
      var selected=helpValidatedTopics(result&&result.topics);
      var intent=(result&&HELP_INTENTS.indexOf(result.intent)>=0)?result.intent:null;
      var bank=(result&&HELP_BANKS.indexOf(result.bank)>=0)?result.bank:helpLocalBank(asked);
      if(intent){
        var built=helpAnswerFromSnap(intent, snap, bank);
        if(built){ setAnswer({phrase:helpPhrase(built.cue, helpFormatVars(built.vars)),action:built.action,topicIds:[],stepsId:null,low:result.confidence==="low",intent:intent}); return; }
      }
      if(selected.length){
        var top=helpTopic(selected[0]);
        var cue=helpCueForTopic(selected[0],result&&result.cue);
        setAnswer({phrase:t(cue),action:top.actions[0],topicIds:selected,stepsId:selected[0],low:result.confidence==="low"});
      } else {
        setAnswer({phrase:t("help_unknown"),action:null,topicIds:[],stepsId:null,low:true});
      }
    }catch(err){
      if(id===requestRef.current) setRemoteNotice("help_unavailable");
    }finally{ clearTimeout(timer); if(id===requestRef.current) setBusy(false); }
  };
  const chooseTopic=function(tid){
    var item=helpTopic(tid); if(!item) return;
    var cueT=(simple&&tid==="goals")?"help_cue_goals_simple":(item.cue||item.title);
    setAnswer({phrase:t(cueT),action:item.actions[0],topicIds:[tid],stepsId:tid,low:false});
    setStepsOpen(false);
  };
  const primaryAction=answer&&answer.action;
  const primaryBlocked=primaryAction&&((simple&&(primaryAction==="goals"||primaryAction==="debts"))||(["expenses","accounts","goals","debts","receipts"].indexOf(primaryAction)>=0&&(hiddenTabs||[]).indexOf(primaryAction==="expenses"?"gastos":primaryAction==="accounts"?"cartera":"plan")>=0));
  const ctaId=primaryBlocked?"settings":(primaryAction==="cash"&&!hasCash?"accounts":primaryAction);
  const ctaLabel=primaryBlocked?"help_show_settings":(ctaId==="accounts"&&primaryAction==="cash"&&!hasCash?"help_create_cash":HELP_ACTION_LABELS[ctaId]);

  return React.createElement("div",{className:"v4-sheet-back aely-help-back",onClick:onClose},
    React.createElement("div",Object.assign({className:"v4-sheet aely-help-sheet","data-sheet":"help",role:"dialog","aria-modal":"true","aria-labelledby":"help-title",ref:function(el){ swipe.sheetRef.current=el; dialogRef.current=el; },onClick:function(e){ e.stopPropagation(); }}, swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"aely-help-sheet-h"},
        React.createElement("h1",{id:"help-title",className:"serif"}, t("help_title")),
        React.createElement("button",{type:"button",className:"back","data-act":"back","aria-label":t("v4_back"),onClick:onClose},"‹")),
      React.createElement("p",{className:"hint"}, t("help_intro")),
      React.createElement("form",{onSubmit:send},
        React.createElement("textarea",{id:"help-question",className:"v4-bills-search aely-help-q",rows:3,maxLength:600,value:question,
          placeholder:t("help_placeholder"),"aria-label":t("help_question"),
          onChange:function(e){ setQuestion(e.target.value); }}),
        React.createElement("button",{type:"submit",className:"v4-cta",style:{marginTop:12},disabled:!question.trim()||busy}, t(busy?"help_wait":"help_send"))),
      !answer && React.createElement("div",{className:"aely-help-topics"},
        HELP_TOPICS.map(function(x){
          return React.createElement("button",{key:x.id,type:"button",className:"rchip",onClick:function(){ setQuestion(t(x.title)); chooseTopic(x.id); setAsked(t(x.title)); }}, t(x.title));
        })),
      answer && React.createElement("div",{className:"aely-help-answer",role:"status","aria-live":"polite"},
        answer.low && React.createElement("div",{className:"hint"}, t("help_maybe")),
        React.createElement("p",{className:"serif aely-help-phrase"}, answer.phrase),
        ctaId && React.createElement("button",{type:"button",className:"v4-cta",style:{marginTop:12},onClick:function(){ onAction(ctaId); }},
          t(ctaLabel)),
        answer.stepsId && React.createElement("button",{type:"button",className:"v4-link-mini",style:{marginTop:10},onClick:function(){ setStepsOpen(function(v){ return !v; }); }},
          stepsOpen?t("help_steps_hide"):t("help_steps_show")),
        stepsOpen && answer.stepsId && React.createElement("p",{className:"hint",style:{whiteSpace:"pre-line",marginTop:8}}, t(helpTopic(answer.stepsId).body)),
        answer.topicIds && answer.topicIds.length>1 && React.createElement("div",{className:"aely-help-topics",style:{marginTop:12}},
          answer.topicIds.map(function(tid){
            return React.createElement("button",{key:tid,type:"button",className:"rchip",onClick:function(){ chooseTopic(tid); }}, t(helpTopic(tid).title));
          })),
        answer.low && React.createElement("div",{className:"aely-help-topics",style:{marginTop:12}},
          HELP_TOPICS.slice(0,4).map(function(x){
            return React.createElement("button",{key:x.id,type:"button",className:"rchip",onClick:function(){ chooseTopic(x.id); }}, t(x.title));
          })),
        online && signedIn && cloud.enabled() && asked && answer.low && remoteOk && React.createElement("button",{type:"button",className:"btn btn-ghost",style:{marginTop:10},disabled:busy,onClick:function(){ askOnline(false); }}, t("help_try_again")),
        online && signedIn && cloud.enabled() && asked && answer.low && !remoteOk && !remoteAsked && React.createElement("button",{type:"button",className:"btn btn-ghost",style:{marginTop:10},onClick:function(){ setConsentOpen(true); }}, t("help_remote_try")),
        consentOpen && React.createElement("div",{className:"aely-help-consent"},
          React.createElement("div",{style:{fontWeight:800}},t("help_consent_title")),
          React.createElement("p",{className:"hint",style:{margin:"7px 0 0"}},t("help_consent_body")),
          React.createElement("div",{className:"ask-btns",style:{marginTop:12}},
            React.createElement("button",{type:"button",className:"btn btn-ghost",onClick:function(){ setConsentOpen(false); setRemoteAsked(true); if(onConsent) onConsent(false); }},t("help_consent_no")),
            React.createElement("button",{type:"button",className:"btn btn-primary",onClick:function(){ setConsentOpen(false); setRemoteAsked(true); setRemoteOk(true); if(onConsent) onConsent(true); askOnline(true); }},t("help_consent_yes"))))
      ),
      remoteNotice && React.createElement("div",{className:"hint aely-help-remote-note",role:"alert","aria-live":"assertive",style:{marginTop:12}},t(remoteNotice))
    )
  );
}

function HelpHost(){
  const [open,setOpen]=React.useState(false);
  const [ctx,setCtx]=React.useState({simple:false,hiddenTabs:[],hasCash:true,snap:{},helpAiOk:false,helpAiAsked:false,onConsent:null});
  const [online,setOnline]=React.useState(typeof navigator!=="undefined"?navigator.onLine:true);
  const triggerRef=React.useRef(null);
  React.useEffect(function(){
    const onOpen=function(e){
      const d=(e&&e.detail)||{};
      triggerRef.current=document.activeElement;
      setCtx({
        simple:!!d.simple,
        hiddenTabs:Array.isArray(d.hiddenTabs)?d.hiddenTabs:[],
        hasCash:d.hasCash!==false,
        snap:d.snap&&typeof d.snap==="object"?d.snap:{},
        helpAiOk:!!d.helpAiOk,
        helpAiAsked:!!d.helpAiAsked,
        onConsent:typeof d.onConsent==="function"?d.onConsent:null
      });
      setOpen(true);
    };
    const onNet=function(){ setOnline(!!navigator.onLine); };
    window.addEventListener("mc-open-help", onOpen);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return function(){
      window.removeEventListener("mc-open-help", onOpen);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  },[]);
  if(!open) return null;
  const signedIn=!!(typeof window!=="undefined"&&window.__mcEmail);
  const navigate=function(id){
    try{
      if(id==="cash"){
        var fab=document.querySelector('.botnav-fab[data-tour="apuntar"]');
        if(!fab) return;
        window.__mcApuntarCash=true;
        fab.click();
        return;
      }
      if(id==="expenses"){ var g=document.querySelector('.botnav-tab[data-tour="gastos"]'); if(g) g.click(); return; }
      if(id==="accounts"){ var c=document.querySelector('.botnav-tab[data-tour="cartera"]'); if(c) c.click(); return; }
      if(id==="goals"||id==="debts"||id==="receipts"){
        var ptab=document.querySelector('.botnav-tab[data-tour="plan"]');
        if(ptab) ptab.click();
        var frames=0;
        var openSegment=function(){
          try{
            var segId=id==="receipts"?"recibos":(id==="debts"?"deudas":"metas");
            var buttons=document.querySelectorAll('.page-live .v4-seg-btn[data-seg="'+segId+'"], .v4-seg-btn[data-seg="'+segId+'"]');
            if(buttons.length){ buttons[0].click(); return; }
          }catch(e){}
          frames++;
          if(frames<36) requestAnimationFrame(openSegment);
        };
        requestAnimationFrame(openSegment);
        return;
      }
      if(id==="banks"){ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})); return; }
      if(id==="history"){
        window.dispatchEvent(new CustomEvent("mc-open-settings"));
        setTimeout(function(){ try{ window.dispatchEvent(new CustomEvent("mc-open-history")); }catch(e){} }, 80);
        return;
      }
      if(id==="settings"){ window.dispatchEvent(new CustomEvent("mc-open-settings")); }
    }catch(e){}
  };
  /* Cierre: useBackClose hace history.back con _mcIgnorePop (el popstate no sirve
     para saber cuándo abrir OTRO overlay). Botnav basta con 2 rAF; bancos/ajustes
     esperan a que baje _mcIgnorePop (tope 400 ms). */
  const afterClose=function(then, waitHistory){
    setOpen(false);
    if(!waitHistory){
      requestAnimationFrame(function(){ requestAnimationFrame(then); });
      return;
    }
    var done=false, n=0;
    var finish=function(){
      if(done) return; done=true; clearInterval(iv); then();
    };
    var iv=setInterval(function(){
      n++;
      try{ if(!_mcIgnorePop||n>20) finish(); }catch(e){ finish(); }
    }, 20);
  };
  const closeAndRestore=function(){
    var el=triggerRef.current;
    setOpen(false);
    requestAnimationFrame(function(){ if(el&&document.contains(el)&&el.focus) el.focus({preventScroll:true}); });
  };
  return React.createElement(HelpAssistant,{
    onClose:closeAndRestore,
    online:online, signedIn:signedIn,
    simple:!!ctx.simple, hiddenTabs:ctx.hiddenTabs||[], hasCash:!!ctx.hasCash,
    snap:ctx.snap||{}, helpAiOk:!!ctx.helpAiOk, helpAiAsked:!!ctx.helpAiAsked, onConsent:ctx.onConsent,
    onAction:function(id){
      if(!Object.prototype.hasOwnProperty.call(HELP_ACTION_LABELS,id)) return;
      var overlay=id==="banks"||id==="history"||id==="settings";
      afterClose(function(){ navigate(id); }, overlay);
    }
  });
}
