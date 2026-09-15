/* Guías revisadas y destinos cerrados: la IA interpreta la duda, pero no inventa
   pantallas ni modifica dinero. Lo habitual funciona también sin conexión. */
const HELP_TOPICS=[
  {id:"cash",title:"help_cash",body:"help_cash_body",actions:["cash","accounts"]},
  {id:"goals",title:"help_goals",body:"help_goals_body",actions:["goals","debts"]},
  {id:"debts",title:"help_debts",body:"help_debts_body",actions:["debts","goals"]},
  {id:"banks",title:"help_banks",body:"help_banks_body",actions:["banks","expenses","history"]},
  {id:"history",title:"help_history",body:"help_history_body",actions:["history","banks"]},
  {id:"categories",title:"help_categories",body:"help_categories_body",actions:["expenses"]},
  {id:"receipts",title:"help_receipts",body:"help_receipts_body",actions:["receipts","banks"]}
];
const HELP_ACTION_LABELS={cash:"help_open_cash",accounts:"help_open_accounts",goals:"help_open_goals",debts:"help_open_debts",banks:"help_open_banks",expenses:"help_open_expenses",history:"help_open_history",receipts:"help_open_receipts",settings:"settings"};
function helpTopic(id){ return HELP_TOPICS.find(function(x){ return x.id===id; }); }
function helpLocalTopics(question){
  var q=String(question||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  var hits=[];
  var add=function(id,re){ if(re.test(q)) hits.push(id); };
  add("cash",/\b(efectivo|efectiu|cash|cajero|caixer|atm|billetes|monedas)\b/);
  add("categories",/\b(categoria[s]?|categoritz\w*|categoriz\w*|categoris\w*|categor[yi]\w*|mapfre|clasific\w*|classific\w*|otros|altres)\b/);
  add("history",/\b(historic\w*|history|import\w*|extracto[s]?|extracte[s]?|statement[s]?)\b/);
  add("goals",/\b(ahorr\w*|estalvi\w*|saving[s]?|save|meta[s]?|goal[s]?)\b/);
  add("debts",/\b(deuda[s]?|deute[s]?|debt[s]?|prestamo[s]?|prestec[s]?|loan[s]?|hipoteca|mortgage|cuota[s]?)\b/);
  add("receipts",/\b(recibo[s]?|rebut[s]?|bill[s]?|domicili\w*)\b/);
  add("banks",/\b(banco[s]?|banc[s]?|bank[s]?|caixa\w*|sabadell|revolut|trade republic|sincron\w*|sync\w*|no (sale|carga|aparece|llega|leyo)|missing)\b/);
  return hits.slice(0,3);
}
function helpValidatedTopics(value){
  if(!Array.isArray(value)||value.length>3||value.some(function(id){ return typeof id!=="string"||!helpTopic(id); })) return [];
  return value.filter(function(id,i){ return typeof id==="string"&&helpTopic(id)&&value.indexOf(id)===i; });
}
function HelpAssistant({onClose,onAction,online,signedIn,simple,hiddenTabs,hasCash}){
  const [question,setQuestion]=useState("");
  const [asked,setAsked]=useState("");
  const [topics,setTopics]=useState([]);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const requestRef=useRef(0);
  const panelRef=useRef(null);
  const resultRef=useRef(null);
  useBackClose(true,onClose);
  useEffect(function(){
    var before=document.activeElement;
    var node=panelRef.current;
    if(node) node.querySelector("button").focus();
    // Un botón desactivado mientras consulta puede perder el foco: Escape debe funcionar
    // también si el navegador ha devuelto el foco al body.
    var escape=function(e){ if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown",escape,true);
    return function(){ window.removeEventListener("keydown",escape,true); requestRef.current++; if(before&&before.isConnected) before.focus(); };
  },[]);
  useEffect(function(){
    if((asked||topics.length)&&resultRef.current) resultRef.current.scrollIntoView({block:"start"});
  },[topics]);
  const send=function(e){
    if(e) e.preventDefault();
    var text=question.trim(); if(!text) return;
    if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
    requestRef.current++; setBusy(false); setAsked(text); setTopics(helpLocalTopics(text)); setStatus("help_local");
  };
  const askOnline=async function(){
    if(busy||!online||!signedIn||!cloud.enabled()||!asked||question.trim()!==asked) return;
    var id=++requestRef.current; setBusy(true); setStatus("");
    var timer;
    try{
      // La caída de la sesión o de la red también puede bloquear antes de llegar al modelo.
      // La guía local queda utilizable aunque el transporte tarde en rechazar la petición.
      var result=await Promise.race([cloud.askHelp(asked,CURLANG),new Promise(function(resolve,reject){ timer=setTimeout(function(){ reject(new Error("timeout")); },20000); })]);
      if(id!==requestRef.current) return;
      var selected=helpValidatedTopics(result&&result.topics);
      if(result&&result.ok&&selected.length){ setTopics(selected); setStatus("help_ai_matched"); }
      else setStatus(result&&result.error==="limited"?"help_limited":result&&result.ok?"help_unknown":"help_unavailable");
    }catch(e){ if(id===requestRef.current) setStatus("help_unavailable"); }
    finally{ clearTimeout(timer); if(id===requestRef.current) setBusy(false); }
  };
  const choose=function(id){ requestRef.current++; setBusy(false); setTopics([id]); setStatus("help_local"); };
  const action=function(id,index){
    // El modo sencillo puede ocultar destinos: abrir Ajustes explica cómo recuperarlos,
    // sin cambiar preferencias a escondidas ni acabar en una pestaña distinta.
    var tab=id==="expenses"?"gastos":id==="accounts"?"cartera":["goals","debts","receipts"].indexOf(id)>=0?"plan":null;
    var blocked=(simple&&(id==="goals"||id==="debts"))||(tab&&(hiddenTabs||[]).indexOf(tab)>=0);
    var target=blocked?"settings":id==="cash"&&!hasCash?"accounts":id;
    return React.createElement("button",{key:target,type:"button",className:index===0?"btn btn-primary":"btn btn-ghost",onClick:function(){ onAction(target); }},t(blocked?"help_show_settings":HELP_ACTION_LABELS[target]));
  };
  return React.createElement("div",{className:"aely-help",role:"dialog","aria-modal":"true","aria-labelledby":"help-title",ref:panelRef,onKeyDown:function(e){
    if(e.key!=="Tab") return;
    var nodes=Array.from(panelRef.current.querySelectorAll("button:not(:disabled),textarea"));
    var first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
  }},
    React.createElement("div",{className:"aely-help-head"},React.createElement("h1",{id:"help-title"},t("help_title")),React.createElement("button",{type:"button",className:"btn btn-ghost",onClick:onClose,"aria-label":t("v4_back")},"×")),
    React.createElement("div",{className:"aely-help-body"},
      React.createElement("p",{className:"hint"},t("help_intro")),
      React.createElement("form",{onSubmit:send},
        React.createElement("label",{htmlFor:"help-question"},t("help_question")),
        React.createElement("textarea",{id:"help-question",className:"v4-input",rows:3,maxLength:600,value:question,placeholder:t("help_placeholder"),onChange:function(e){ setQuestion(e.target.value); }}),
        React.createElement("button",{type:"submit",className:"btn btn-primary",disabled:!question.trim()},t("help_send"))),
      React.createElement("div",{className:"aely-help-topics"},HELP_TOPICS.map(function(x){ return React.createElement("button",{key:x.id,className:"chip",type:"button",onClick:function(){ choose(x.id); }},t(x.title)); })),
      React.createElement("div",{ref:resultRef,role:"status","aria-live":"polite"},status&&React.createElement("p",{className:"hint"},t(status))),
      asked&&!topics.length&&React.createElement("p",null,t("help_unknown")),
      topics.map(function(id){ var item=helpTopic(id); return React.createElement("article",{key:id,className:"v4-card","data-help-topic":id},
        React.createElement("h2",null,t(item.title)),React.createElement("p",{style:{whiteSpace:"pre-line",lineHeight:1.6}},t(item.body)),
        (simple||hiddenTabs&&hiddenTabs.length>0)&&React.createElement("p",{className:"hint"},t("help_hidden")),
        React.createElement("div",{className:"aely-help-actions"},item.actions.filter(function(id){ return id!=="cash"||hasCash; }).map(action).filter(function(el,i,list){ return list.findIndex(function(x){ return x.key===el.key; })===i; }))); }),
      asked&&React.createElement("div",{className:"aely-help-remote"},
        React.createElement("p",{className:"hint"},t("help_privacy")),
        React.createElement("button",{type:"button",className:"btn btn-ghost",disabled:busy||!online||!signedIn||!cloud.enabled()||question.trim()!==asked,onClick:askOnline},t(busy?"help_wait":online&&signedIn&&cloud.enabled()?"help_online":"help_offline")))
    )
  );
}
