/* ============================================================
   DIÁLOGOS DE LA APP (askText / askConfirm)
   ============================================================
   window.prompt/confirm pintan el cuadro NATIVO del sistema: gris, con la tipografía de
   Android y botones «CANCEL/OK» en inglés aunque la app esté en español. Cantaba tanto que
   la primera petición de fuera del círculo técnico fue justo esa (2026-07-15).
   askText → Promise<string|null> (null = canceló) · askConfirm → Promise<bool>.
   Son PROMESAS: el prompt nativo era síncrono, así que al portar un sitio hay que mover lo
   de después dentro del .then() (ojo con los early-return del patrón viejo).
   Sin host montado ya NO caen al diálogo nativo (auditoría 14/11/2026: era el último camino a
   «CANCEL/OK»): cuentan como «cancelar». La pantalla del candado, que era el caso, monta su
   propio `AskHost` (ver el `if(locked)` de App). */
var askEmit=null;
function askDialog(o){
  return new Promise(function(resolve){
    if(!askEmit){ try{ console.warn("askDialog sin AskHost"); }catch(e){} resolve(o.input?null:false); return; }
    askEmit(Object.assign({},o,{resolve:resolve}));
  });
}
function askText(o){ return askDialog(Object.assign({input:true},o)); }
function askConfirm(o){ return askDialog(Object.assign({input:false},o)); }
/* ELEGIR ENTRE VARIAS, no solo sí/no (2026-09-10).
   Nace de una decisión suya: al quitar un banco, «que te pregunte» qué hacer con sus movimientos.
   Con `askConfirm` habría que inventarse cuál de las dos cosas es «aceptar», y eso es adivinar con
   su dinero — que es justo lo que no queremos.
   `options`: [{v, label, sub}]. Resuelve con el `v` elegido, o `null` si cancela.
   Sin `AskHost` montado, como `askDialog`: cancelar. */
function askChoice(o){
  const opts=(o&&o.options)||[];
  return new Promise(function(resolve){
    if(!askEmit){ resolve(null); return; }
    askEmit(Object.assign({},o,{input:false,options:opts,resolve:resolve}));
  });
}
function AskHost(){
  const [cur,setCur]=useState(null);
  const [val,setVal]=useState("");
  const sheetRef=useRef(null);
  const returnFocusRef=useRef(null);
  useEffect(function(){
    askEmit=function(o){ setVal(o.value!=null?String(o.value):""); setCur(o); };
    return function(){ askEmit=null; };
  },[]);
  /* Marca el documento mientras hay diálogo: el CSS apaga el halo de `.v4-cta` debajo
     (si no, Guardar se lee a través del velo al borrar un gasto — 12/9).
     useLayoutEffect, no useEffect: con el efecto normal el primer frame pinta el
     ask encima CON el halo mint todavía encendido, y él lo veía «muy rápido pero
     se nota» (3er rechazo 13/9). Layout corre antes del paint. */
  useLayoutEffect(function(){
    var root=document.documentElement;
    if(cur) root.classList.add("ask-open");
    else root.classList.remove("ask-open");
    return function(){ root.classList.remove("ask-open"); };
  },[cur]);
  // Una acción terminal no puede recargar antes del back que limpia ESTE Ask:
  // esa navegación cancela el reload. Cancelar y los demás Ask resuelven como siempre.
  const done=function(r){
    const f=cur.resolve; setCur(null); setVal("");
    if(cur.terminal&&r===true){
      mcSandboxTransition(true);
      _mcBackDrop(back.current,function(consumed){
        if(!consumed) mcSandboxTransition(false);
        f(consumed);
      });
    }
    else f(r);
  };
  const ok=function(){ done(cur.input?String(val):true); };
  // Con opciones, cancelar es `null` («no he elegido»), no `false` («he dicho que no»): con tres
  // caminos posibles, un `false` se confundiría con haber elegido el primero.
  const cancel=function(){ done((cur.input||(cur.options||[]).length>0)?null:false); };
  const cancelRef=useRef(null); cancelRef.current=cancel;
  // Al encadenar diálogos la entrada cambia, pero la closure de apertura conserva esta ref:
  // Atrás debe resolver el Ask actual, no volver a cancelar el primero de la cadena.
  const back=useBackClose(!!cur,function(){ if(cancelRef.current) cancelRef.current(); },cur);
  useEffect(function(){
    if(!cur) return undefined;
    // El callback predictivo vive fuera de React y tiene prioridad sobre AndroidX mientras una
    // pantalla hija está abierta. Esta puerta le permite cerrar primero el Ask que la cubre.
    const close=function(){ cancel(); };
    window.__mcCloseTopAsk=close;
    return function(){ if(window.__mcCloseTopAsk===close) delete window.__mcCloseTopAsk; };
  },[cur]);
  useEffect(function(){
    if(!cur) return undefined;
    returnFocusRef.current=document.activeElement;
    const id=requestAnimationFrame(function(){
      const root=sheetRef.current;
      if(!root) return;
      const first=root.querySelector('input:not([disabled]),button:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href],[tabindex]:not([tabindex="-1"])');
      if(first) first.focus(); else root.focus();
    });
    const keydown=function(e){
      const root=sheetRef.current;
      if(!root) return;
      if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); cancel(); return; }
      if(e.key!=="Tab") return;
      if(!mcTabTrap(e,root)){ e.preventDefault(); root.focus(); }
    };
    document.addEventListener("keydown",keydown);
    return function(){
      cancelAnimationFrame(id);
      document.removeEventListener("keydown",keydown);
      const back=returnFocusRef.current;
      requestAnimationFrame(function(){
        if(back&&back.isConnected){ back.focus(); return; }
        // Al confirmar un borrado, el botón que abrió Ask puede desaparecer en el mismo render.
        // En ese caso dejamos el foco en el título de la pantalla que sigue abierta, no en body.
        const fallback=document.querySelector("[data-inv-screen] h1")||document.querySelector(".settings-push.open h1")||document.querySelector(".botnav-fab");
        if(fallback) fallback.focus();
      });
    };
  },[cur]);
  if(!cur) return React.createElement(HelpHost,null);
  return React.createElement(React.Fragment,null,
    React.createElement(HelpHost,null),
    ReactDOM.createPortal(
    React.createElement("div",{className:"askback"+(cur.compact?" ask-compact":"")+(cur.img?" ask-preview":""),onClick:cancel},
      React.createElement("div",{className:"tabsheet",ref:sheetRef,role:"dialog","aria-modal":"true",
        "aria-labelledby":cur.img?null:"ask-dialog-title","aria-label":cur.img?cur.title:null,tabIndex:-1,onClick:function(e){ e.stopPropagation(); }},
        // Con vista previa el título solo repetía el de la imagen y le quitaba altura (Enorme a
        // 360, filtro de diseño 19/11): queda para el lector de pantalla, no se pinta.
        !cur.img && React.createElement("div",{className:"ts-title",id:"ask-dialog-title"},cur.title),
        cur.sub && React.createElement("div",{className:"ts-hint"},cur.sub),
        // `img`: vista previa de lo que se va a guardar (informe del mes, 19/11/2026).
        cur.img && React.createElement("img",{className:"ask-img",src:cur.img,alt:cur.title||"",draggable:false}),
        // `live(valor)`: una línea que depende de lo tecleado (p. ej. cuotas que quita amortizar).
        // null = no se pinta: el diálogo no enseña nada que aún no se sabe. Su hueco sí se guarda: si
        // apareciera con la primera cifra, el campo bajaba un renglón bajo el dedo (filtro de diseño 242).
        // A la derecha, encima de la cifra que acompaña.
        cur.input && cur.live && (function(){ const x=cur.live(val); return React.createElement("div",{className:"ts-hint ask-live","data-ask-live":x?"1":undefined},x||""); })(),
        cur.input && React.createElement("input",{className:"af-in num ask-in"+(cur.compact?" ask-in-compact":""),autoFocus:true,
          type:cur.secret?"password":"text",
          inputMode:cur.secret?"text":(cur.mode||"decimal"), placeholder:cur.ph||"", value:val,
          onChange:function(e){ setVal(e.target.value); },
          onKeyDown:function(e){ if(e.key==="Enter") ok(); }}),
        cur.input && (cur.chips||[]).length>0 && React.createElement("div",{className:"ask-chips"},
          cur.chips.map(function(c){ return React.createElement("button",{key:String(c.v),className:"chip",
            onClick:function(){ setVal(String(c.v)); }}, c.label); })),
        /* Varias opciones, una debajo de otra y cada una con su explicación. En fila no caben:
           lo que hay que leer aquí no es la etiqueta, es la consecuencia. */
        (cur.options||[]).length>0 && React.createElement("div",{className:"ask-opts"},
          cur.options.map(function(op){
            return React.createElement("button",{key:String(op.v),type:"button",className:"ask-opt",
              onClick:function(){ done(op.v); }},
              React.createElement("span",{className:"ask-opt-t"}, op.label),
              op.sub && React.createElement("span",{className:"ask-opt-s"}, op.sub));
          })),
        React.createElement("div",{className:"ask-btns"},
          React.createElement("button",{className:"btn btn-ghost",onClick:cancel}, cur.cancel||t("fj_cancel")),
          // `alt`: una segunda acción que no es cancelar (Compartir junto a Guardar). Resuelve "alt".
          cur.alt && React.createElement("button",{className:"btn btn-ghost",onClick:function(){ done("alt"); }}, cur.alt),
          // Con opciones, el botón de aceptar sobra: elegir una YA es aceptar.
          (cur.options||[]).length===0 && React.createElement("button",{className:"btn btn-primary",style:cur.danger?{background:"linear-gradient(160deg,#E2705F,#C4553F)",color:"#fff"}:null,
            onClick:ok}, cur.ok||t("ask_ok")))
      )
    ), document.body));
}

/* ============================================================
   TAB: INVERSIONES
   ============================================================ */
/* CANDIDATAS DE UN BRÓKER QUE SE SINCRONIZA SOLO (revisión de dinero 19/11, D7). `brokerSuggest`
   busca por ISIN o ticker en TODA la cartera, y el sync de TR/MyInvestor lo usa sin vista previa
   cada 30 min: con VWCE en IBKR (por conexión) y en TR, el de TR le ponía sus 4 participaciones a
   la de IBKR, IBKR se las devolvía a las 12 h, y mientras tanto el patrimonio contaba TR dos veces.
   Fuera lo que ya lleva otra sincronización: lo que puso una conexión (`src:"api:…"`) y lo de los
   otros brókers que se sincronizan solos. Lo demás (manual, de fichero, de cualquier `ent`) sigue
   siendo candidato, como hasta hoy: hay carteras con posiciones de TR que se crearon a mano con
   otro `ent` y que, con un filtro por `ent` estricto, dejarían de actualizarse sin aviso. */
// D8 (tercera revisión): fuera también lo importado por fichero de OTRO bróker (`csv:degiro` con el
// mismo ISIN que TR), y las del propio bróker primero, para que la suya gane a una manual que case.
function brkSyncCandidates(investments, ent){
  const out=(investments||[]).filter(function(i){
    const src=String(i.src||"");
    if(src.indexOf("api:")===0) return false;
    if(src.indexOf("csv:")===0 && src!=="csv:"+ent) return false;
    return i.ent===ent || !BRK_OWN_SYNC[i.ent];
  });
  return out.filter(function(i){ return i.ent===ent; }).concat(out.filter(function(i){ return i.ent!==ent; }));
}
// sugerencia de mapeo ISIN→posición (la usa la sincro TR): primero por ISIN guardado, luego por palabras del nombre
function brokerSuggest(pos, investments){
  const byIsin=investments.find(function(i){ return i.isin && i.isin===pos.isin; });
  if(byIsin) return byIsin.id;
  // ticker exacto (Revolut solo da ticker: «NVDA» no casa por nombre con «NVIDIA» y sin esto
  // el importador proponía crear duplicados de posiciones que ya existían — feedback 2026-07-13)
  const tk=String(pos.ticker||pos.isin||"").toUpperCase();
  if(tk){ const ms=investments.filter(function(i){ return i.ticker && String(i.ticker).toUpperCase()===tk; });
    // con ticker repetido (duplicados históricos del import), manda la posición VIVA (value>0)
    const byTicker=ms.find(function(i){ return i.value>0; })||ms[0]; if(byTicker) return byTicker.id; }
  const words=String(pos.name||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").split(/[^a-z0-9&]+/).filter(function(w){ return w.length>=4; });
  let best=null, bestScore=0;
  investments.forEach(function(i){
    const nm=String(i.name||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    const score=words.reduce(function(a,w){ return a+(nm.indexOf(w)>=0?1:0); },0);
    if(score>bestScore){ bestScore=score; best=i.id; }
  });
  return best;
}

/* ============================================================
   IMPORTADOR CSV DE BRÓKER — Revolut Invest (petición 2026-07-12)
   ============================================================
   Revolut exporta (Invest → More → Documents → Stocks → Account statement → «Excel»,
   que en realidad es un CSV de texto) UNA sola tabla de actividad, SIN snapshot de
   posiciones. Cabecera real verificada (2019→2025):
     Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate
   Reconstruimos las posiciones sumando la actividad. Todo se procesa EN EL MÓVIL: el
   fichero no se sube a ningún sitio. Dos cosas del formato real que hay que respetar:
   (1) importes con símbolo de divisa pegado y coma de miles ("$1,108.22 ", "€50"),
       negativos en paréntesis contable "($0.01)" o con signo "-$30.93";
   (2) la CANTIDAD usa el separador decimal del IDIOMA de la cuenta Revolut → una cuenta
       en español da COMA y el campo va entrecomillado ("0,76672417"). */

// Divide una línea CSV respetando comillas dobles (campos con comas dentro). `sep` solo lo pasan
// los perfiles de bróker nuevos: un DEGIRO exportado con Excel en español sale con «;».
function csvSplitLine(line, sep){
  sep=sep||",";
  const out=[]; let cur=""; let q=false;
  for(let i=0;i<line.length;i++){ const c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else { if(c==='"') q=true; else if(c===sep){ out.push(cur); cur=""; } else cur+=c; }
  }
  out.push(cur); return out;
}
// Normaliza un número con separadores ambiguos a "decimal = punto". Cubre los DOS formatos
// que Revolut mezcla según el idioma de la cuenta (feedback 2026-07-13: una cuenta ES exporta
// "88,94 €" y el parser viejo lo leía como 8894 → posiciones con costes disparatados):
//   US "1,108.22" · EU "1.108,22" · solo coma "88,94" (decimal) / "1,108" (miles) · solo punto.
function revoNum(s){
  if(s.indexOf('.')>=0 && s.indexOf(',')>=0){
    if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,"").replace(/,/g,".");  // EU: punto=miles, coma=decimal
    else s=s.replace(/,/g,"");                                                          // US: coma=miles
  } else if(s.indexOf(',')>=0){
    const parts=s.split(',');
    if(parts.length===2 && parts[1].length!==3) s=parts[0]+"."+parts[1];   // "88,94" / "0,76672417" → decimal
    else s=s.replace(/,/g,"");                                             // "1,108" / "1,234,567" → miles
  } else if(s.split('.').length>2){ s=s.replace(/\./g,""); }               // "1.234.567" → miles EU
  return s;
}
// "$1,108.22 " / "€88,94" / "($0.01)" / "-$30.93" / "$0" → número con signo (decimal = punto).
function revoAmt(s){
  s=String(s==null?"":s).trim(); if(!s) return null;
  let neg=false;
  if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1); }      // negativo estilo contable
  if(s.indexOf('-')>=0||s.indexOf('−')>=0) neg=true;    // guion ASCII o signo menos unicode
  s=revoNum(s.replace(/[^0-9.,]/g,""));                      // fuera símbolo, espacios, signo → decimal=punto
  if(s===""||s===".") return null;
  const n=parseFloat(s); if(!isFinite(n)) return null;
  return neg?-n:n;
}
// Participaciones: el decimal puede ser punto ("1.63453043") o coma ("0,76672417", cuenta ES).
function revoQty(s){
  s=String(s==null?"":s).trim().replace(/\s/g,""); if(!s) return null;
  s=revoNum(s.replace(/[^0-9.,\-]/g,""));
  const n=parseFloat(s); return isFinite(n)?Math.abs(n):null;   // el signo lo pone el tipo de fila, no la cantidad
}
// Divisa: primero por el símbolo del importe ($→USD, €→EUR, £→GBP), si no por el campo Currency.
function revoCur(amountStr, curField){
  const a=String(amountStr||""); if(a.indexOf('€')>=0) return "EUR"; if(a.indexOf('$')>=0) return "USD"; if(a.indexOf('£')>=0) return "GBP";
  const c=String(curField||"").trim().toUpperCase(); return c||"EUR";
}
// Tipo de fila → clase (substring, robusto a variantes no vistas como BUY - LIMIT).
function revoClassify(type){
  const t=String(type||"").toLowerCase();
  if(t.indexOf('buy')>=0) return 'buy';
  if(t.indexOf('sell')>=0) return 'sell';
  if(t.indexOf('dividend')>=0) return 'dividend';
  if(t.indexOf('split')>=0) return 'split';
  if(t.indexOf('transfer')>=0) return 'transfer';
  if(t.indexOf('fee')>=0||t.indexOf('custody')>=0) return 'fee';
  if(t.indexOf('trade')>=0) return 'trade';     // formato antiguo "TRADE - MARKET" (el signo decide)
  return 'other';                               // cash top-up / withdrawal / interest → sin ticker, informativo
}
// Parsea el CSV → {rows:[{date,ticker,type,kind,qty,price,amount,cur}], skipped, from, to}. null si no es un CSV reconocible.
function revoParse(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").filter(function(l){ return l.trim()!==""; });
  if(!lines.length) return null;
  let hi=-1;
  for(let i=0;i<Math.min(lines.length,6);i++){ const low=lines[i].toLowerCase();
    if(low.indexOf('ticker')>=0 && low.indexOf('type')>=0 && low.indexOf('quantity')>=0){ hi=i; break; } }
  if(hi<0) return null;
  const head=csvSplitLine(lines[hi]).map(function(h){ return h.trim().toLowerCase(); });
  const col=function(n){ return head.indexOf(n); };
  const ci={ date:col('date'), ticker:col('ticker'), type:col('type'), qty:col('quantity'),
             price:col('price per share'), amount:col('total amount'), cur:col('currency') };
  if(ci.ticker<0||ci.type<0) return null;
  const rows=[]; let skipped=0; let from=null,to=null;
  for(let i=hi+1;i<lines.length;i++){
    const f=csvSplitLine(lines[i]); if(f.length<3){ skipped++; continue; }
    const ticker=(f[ci.ticker]||"").trim().toUpperCase();
    const type=(f[ci.type]||"").trim(); const kind=revoClassify(type);
    const amountStr=ci.amount>=0?f[ci.amount]:"";
    const row={ date:(f[ci.date]||"").slice(0,10), ticker:ticker, type:type, kind:kind,
      qty:ci.qty>=0?revoQty(f[ci.qty]):null, price:ci.price>=0?revoAmt(f[ci.price]):null,
      amount:revoAmt(amountStr), cur:revoCur(amountStr, ci.cur>=0?f[ci.cur]:"") };
    if(!ticker && (kind==='buy'||kind==='sell'||kind==='split'||kind==='transfer')){ skipped++; continue; }
    rows.push(row);
    const d=row.date; if(d){ if(!from||d<from) from=d; if(!to||d>to) to=d; }
  }
  return { rows:rows, skipped:skipped, from:from, to:to };
}
// Agrega la actividad por ticker → posiciones {ticker,name,shares,cost,cur,divi,fees}. Coste MEDIO;
// las ventas restan coste proporcional (no el importe de venta); splits/traspasos ajustan solo shares.
function revoAggregate(parsed){
  const by={};
  const get=function(tk,cur){ if(!by[tk]) by[tk]={ticker:tk,name:tk,shares:0,cost:0,cur:cur||"EUR",buys:0,sells:0,splits:0,divi:0,fees:0}; return by[tk]; };
  let dividends=0, fees=0;
  (parsed.rows||[]).forEach(function(r){
    if(r.kind==='dividend'){ dividends+=Math.abs(r.amount||0); if(r.ticker) get(r.ticker,r.cur).divi+=Math.abs(r.amount||0); return; }
    if(r.kind==='fee'){ fees+=Math.abs(r.amount||0); if(r.ticker) get(r.ticker,r.cur).fees+=Math.abs(r.amount||0); return; }
    if(!r.ticker) return;
    const p=get(r.ticker,r.cur); if(r.cur) p.cur=r.cur;
    let q=Number(r.qty||0); const amt=Math.abs(Number(r.amount||0));
    // fila sin cantidad pero con precio+importe (pasa en extractos viejos) → cantidad = importe/precio.
    // Sin este fallback una VENTA sin cantidad no restaba nada y la posición «vendida» reaparecía entera.
    if(!(q>0) && r.price>0 && amt>0) q=amt/r.price;
    if(r.kind==='buy' || (r.kind==='trade' && (r.amount==null||r.amount>=0))){ p.shares+=q; p.cost+=amt; p.buys++; }
    else if(r.kind==='sell' || (r.kind==='trade' && r.amount<0)){
      const avg=p.shares>0?p.cost/p.shares:0; const sq=Math.min(q,p.shares);
      p.shares-=sq; p.cost-=avg*sq; p.sells++;
    }
    else if(r.kind==='split' || r.kind==='transfer'){ p.shares+=q; p.splits++; }   // coste 0: solo ajusta participaciones
  });
  const positions=Object.keys(by).map(function(k){ const p=by[k];
      return { ticker:p.ticker, name:p.name, shares:+p.shares.toFixed(8), cost:+Math.max(0,p.cost).toFixed(2), cur:p.cur, divi:+p.divi.toFixed(2), buys:p.buys, sells:p.sells, splits:p.splits }; })
    .filter(function(p){ return p.shares>0.0001; })   // fuera el «polvo» de posiciones liquidadas (antes 1e-8: resucitaba restos)
    .sort(function(a,b){ return b.cost-a.cost; });
  return { positions:positions, dividends:+dividends.toFixed(2), fees:+fees.toFixed(2) };
}

/* MATERIAS PRIMAS — el SEGUNDO extracto de Revolut (backlog «Revolut a medias», 2026-07-12:
   «solo pilla las acciones», el oro nunca entraba). Confirmado con los CSV reales del usuario
   (2026-07-15): el oro NO está en el extracto de Stocks, va en Invest → Documentos →
   «Materias primas» → «Extracto de cuenta», y no se parece en nada al de acciones:
     Tipo,Producto,Fecha de inicio,Fecha de finalización,Descripción,Importe,Comisión,Divisa,State,Saldo
     Cambio,Actual,2025-08-28 15:56:48,…,Conversión a XAU,0.033804,0.000338,XAU,COMPLETADO,0.033466
   Es el extracto de una cuenta corriente (cabecera en el IDIOMA de la cuenta) y el importe ya
   viene en ONZAS, no en euros. Por eso revoParse (que exige Ticker/Type/Quantity) lo rechazaba.
   Cantidad = columna SALDO de la última fila (Revolut ya da el acumulado); de respaldo, la suma
   de Importe−Comisión. Con los datos reales las dos vías dan lo mismo (0.258218 XAU).
   OJO (limitación real, no pereza): este extracto NO trae el coste en euros — la pata en EUR de
   la conversión vive en el extracto de la cuenta corriente, que es otro fichero. Así que los
   metales se importan SIN coste: se re-ancla la CANTIDAD y se respeta el coste que ya tuvieras.
   Con la cantidad y el ticker basta para que el precio en vivo (XAU→GC=F) haga el resto. */
var REVO_METALS={ XAU:"met_xau", XAG:"met_xag", XPT:"met_xpt", XPD:"met_xpd" };
function revoParseCommodities(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").filter(function(l){ return l.trim()!==""; });
  if(!lines.length) return null;
  let hi=-1, head=null;
  const hasAny=function(h,names){ return names.some(function(n){ return h.indexOf(n)>=0; }); };
  for(let i=0;i<Math.min(lines.length,6);i++){
    const h=csvSplitLine(lines[i]).map(function(x){ return x.trim().toLowerCase(); });
    if(hasAny(h,['divisa','currency']) && hasAny(h,['importe','amount']) && hasAny(h,['saldo','balance'])){ hi=i; head=h; break; }
  }
  if(hi<0) return null;
  const col=function(names){ for(let k=0;k<names.length;k++){ const j=head.indexOf(names[k]); if(j>=0) return j; } return -1; };
  const ci={ cur:col(['divisa','currency']), amt:col(['importe','amount']), fee:col(['comisión','comision','fee']),
             bal:col(['saldo','balance']), state:col(['state','estado']),
             d0:col(['fecha de inicio','started date']), d1:col(['fecha de finalización','completed date']) };
  const by={}; let from=null,to=null,skipped=0;
  for(let i=hi+1;i<lines.length;i++){
    const f=csvSplitLine(lines[i]); if(f.length<3){ skipped++; continue; }
    const cur=(f[ci.cur]||"").trim().toUpperCase();
    // este MISMO formato es el del extracto de la cuenta en €: si no es un metal, no es cosa nuestra
    if(!REVO_METALS[cur]){ skipped++; continue; }
    const st=ci.state>=0?(f[ci.state]||"").trim().toUpperCase():"";
    if(st && st.indexOf("COMPLET")<0){ skipped++; continue; }        // COMPLETADO / COMPLETED
    const di=ci.d1>=0?ci.d1:ci.d0;
    const date=di>=0?String(f[di]||"").slice(0,10):"";
    const amt=ci.amt>=0?revoAmt(f[ci.amt]):null;
    const fee=ci.fee>=0?revoAmt(f[ci.fee]):null;
    const bal=ci.bal>=0?revoAmt(f[ci.bal]):null;
    const p=by[cur]||(by[cur]={ticker:cur,net:0,ops:0,bal:null,balKey:null,mov:[]});
    p.ops++; p.net+=(amt||0)-Math.abs(fee||0);
    // Cada conversión, con su MARCA DE TIEMPO COMPLETA (no solo el día): es la clave con la que
    // se casa contra el extracto en € para sacar el coste (ver revoMetalCostsFromFiat). El 30/01
    // hubo dos conversiones el mismo día, así que por fecha sola no bastaría.
    const ts0=ci.d0>=0?String(f[ci.d0]||"").trim():"";
    p.mov.push({ ts:ts0, qty:(amt||0)-Math.abs(fee||0) });
    // desempate por nº de línea: varias conversiones el mismo día (pasó el 30/01) y la buena es la última
    const key=date+"#"+String(i).padStart(6,"0");
    if(bal!=null && (p.balKey==null||key>=p.balKey)){ p.bal=bal; p.balKey=key; }
    if(date){ if(!from||date<from) from=date; if(!to||date>to) to=date; }
  }
  const positions=Object.keys(by).map(function(k){ const p=by[k];
      return { ticker:p.ticker, name:t(REVO_METALS[p.ticker]), shares:+Number(p.bal!=null?p.bal:p.net).toFixed(8),
               cost:null, cur:"USD", metal:true, buys:0, sells:0, splits:0, divi:0, mov:p.mov }; })
    .filter(function(p){ return p.shares>0.000001; })     // metal vendido del todo (la plata): fuera
    .sort(function(a,b){ return b.shares-a.shares; });
  if(!positions.length) return null;
  return { positions:positions, dividends:0, fees:0, from:from, to:to, skipped:skipped, metals:true };
}
/* COSTE DE LOS METALES — la pata en EUROS, que vive en OTRO fichero (petición 2026-07-25:
   «lo del puto oro no funciona de saber cuántas ganancias tengo»).
   Revolut parte cada conversión en dos apuntes, en dos extractos distintos:
     · Materias primas → «Conversión a XAU», Importe 0,033804, Divisa XAU   (las ONZAS)
     · Cuenta principal → «Conversión a XAU», Importe −100,00, Divisa EUR   (los EUROS)
   Comparten la MARCA DE TIEMPO exacta («2025-08-28 15:56:48»), que es la única clave fiable:
   el 30/01/2026 el usuario hizo dos conversiones el mismo día (oro a las 09:19 y plata a las
   11:10), así que casar por fecha suelta mezclaría metales.
   Hasta ahora el coste había que teclearlo a mano metal por metal; con los dos ficheros sale solo.
   Devuelve { XAU: { "<ts>": eurosPagados } }. La comisión en € se SUMA al coste (es dinero que
   pusiste); la comisión en onzas no se toca aquí porque ya viene descontada de la cantidad. */
function revoMetalCostsFromFiat(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").filter(function(l){ return l.trim()!==""; });
  if(!lines.length) return null;
  let hi=-1, head=null;
  const hasAny=function(h,names){ return names.some(function(n){ return h.indexOf(n)>=0; }); };
  for(let i=0;i<Math.min(lines.length,6);i++){
    const h=csvSplitLine(lines[i]).map(function(x){ return x.trim().toLowerCase(); });
    if(hasAny(h,['divisa','currency']) && hasAny(h,['importe','amount']) && hasAny(h,['descripción','descripcion','description'])){ hi=i; head=h; break; }
  }
  if(hi<0) return null;
  const col=function(names){ for(let k=0;k<names.length;k++){ const j=head.indexOf(names[k]); if(j>=0) return j; } return -1; };
  const ci={ cur:col(['divisa','currency']), amt:col(['importe','amount']), fee:col(['comisión','comision','fee']),
             desc:col(['descripción','descripcion','description']), state:col(['state','estado']),
             d0:col(['fecha de inicio','started date']) };
  if(ci.desc<0||ci.amt<0||ci.d0<0) return null;
  // «Conversión a XAU» / «Exchanged to XAU»: el metal va en la DESCRIPCIÓN, no en la divisa
  // (la divisa de esta fila es el euro, que es justo lo que venimos a buscar).
  const re=/(?:conversi[óo]n a|exchanged? to)\s+(XAU|XAG|XPT|XPD)\b/i;
  const out={}; let n=0;
  for(let i=hi+1;i<lines.length;i++){
    const f=csvSplitLine(lines[i]); if(f.length<3) continue;
    const cur=(f[ci.cur]||"").trim().toUpperCase();
    if(REVO_METALS[cur]) continue;                       // esta fila ya es la de onzas, no la de euros
    const m=re.exec(String(f[ci.desc]||"")); if(!m) continue;
    const st=ci.state>=0?(f[ci.state]||"").trim().toUpperCase():"";
    if(st && st.indexOf("COMPLET")<0) continue;
    const amt=revoAmt(f[ci.amt]); if(amt==null) continue;
    const fee=ci.fee>=0?revoAmt(f[ci.fee]):null;
    const tk=m[1].toUpperCase();
    (out[tk]||(out[tk]={}))[String(f[ci.d0]||"").trim()]=Math.abs(amt)+Math.abs(fee||0);
    n++;
  }
  return n?out:null;
}
/* Coste de lo que TE QUEDA, a coste medio — la misma convención que ya usa la app con TR
   (coste = precio medio × participaciones). Cada compra suma euros y onzas; cada venta se lleva
   su parte proporcional del coste, así que vender la mitad deja la mitad del coste.
   Si a UNA sola compra le falta su pata en euros, devuelve null: más vale enseñar «—» y que el
   usuario lo teclee que pintar un coste a medias que haga que el «sube/baja» mienta (AGENTS §1). */
function revoMetalCost(mov, costs){
  if(!mov||!mov.length||!costs) return null;
  const ord=mov.slice().sort(function(a,b){ return a.ts<b.ts?-1:(a.ts>b.ts?1:0); });
  let qty=0, cost=0, faltan=0;
  for(let i=0;i<ord.length;i++){
    const o=ord[i];
    if(o.qty>0){
      const eur=costs[o.ts];
      if(eur==null) faltan++; else cost+=eur;
      qty+=o.qty;
    }else if(o.qty<0){
      const vend=Math.min(-o.qty, qty);
      if(qty>0) cost-=cost*(vend/qty);
      qty-=vend;
    }
  }
  if(faltan) return null;
  return qty>0.000001 ? +cost.toFixed(2) : null;
}
/* Emparejar un metal con la posición que ya tengas. brokerSuggest NO vale aquí: el oro se
   llevaba a mano y SIN ticker, así que por ticker no hay nada que casar, y por nombre todas
   las palabras de «Oro (XAU)» tienen 3 letras (el matcher exige 4+) → devolvía null y el metal
   se quedaba en «no tocar», teniendo que mapearlo a mano justo en el caso que veníamos a
   arreglar (visto al probarlo, 2026-07-15).
   Por NOMBRE solo se busca el código («Oro (XAU)» contiene XAU): buscar «GOLD» en el nombre
   casaría «Goldman Sachs» con el oro y le machacaría las participaciones al aplicar. GOLD y
   SILVER solo valen como TICKER exacto (GOLD es el símbolo histórico del oro en esta app). */
var REVO_METAL_ALIAS={ XAU:["GOLD"], XAG:["SILVER"], XPT:[], XPD:[] };
function revoMetalSuggest(tk, investments){
  const tickers=[tk].concat(REVO_METAL_ALIAS[tk]||[]);
  const hit=(investments||[]).find(function(i){
    if(tickers.indexOf(String(i.ticker||"").toUpperCase())>=0) return true;
    return String(i.name||"").toUpperCase().indexOf(tk)>=0;
  });
  return hit?hit.id:null;
}
// Los extractos de «Pérdidas y Ganancias» (Date acquired/Date sold/Gross PnL) NO son extractos de
// cuenta: no llevan la actividad, solo lo YA VENDIDO. Uno de ellos hasta se llama
// «trading-account-statement-…» por fuera. Detectarlos para decir cuál es el bueno en vez de
// soltar un «no reconocido» y que el usuario pruebe ficheros a ciegas (le pasó, 2026-07-15).
function revoIsPnl(text){
  const low=String(text||"").slice(0,600).toLowerCase();
  return (low.indexOf('date acquired')>=0 && low.indexOf('date sold')>=0) || low.indexOf('gross pnl')>=0;
}

/* ============================================================
   MOTOR COMÚN DE IMPORTACIÓN POR FICHERO (plan de brókers, fases 0 y 1 — 18/11/2026)
   ============================================================
   Revolut fue el primero y todo vivía dentro de su tarjeta. Para DEGIRO e Interactive Brokers
   (un amigo del dueño los usa) se saca el esqueleto común: cada bróker es una lista de PERFILES,
   uno por tipo de fichero, y el motor hace siempre lo mismo con ellos:
     1. primera pasada: los ficheros que solo AYUDAN (el extracto en € de los metales, las
        Transacciones de DEGIRO) dejan sus datos en una memoria que dura entre análisis, para que
        se puedan soltar en cualquier orden y de uno en uno;
     2. segunda pasada: el primer perfil que entiende el fichero saca posiciones;
     3. la misma clave en dos ficheros: manda el último.
   Revolut se queda EXACTAMENTE como estaba (sus tests son la red): sus tres perfiles llaman a
   las mismas funciones y en el mismo orden que el `analyzeAll` de antes.
   Todo se procesa en el móvil y no se sube a ningún sitio (AGENTS §9). */
var BRK_ISIN=/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
// Cabecera comparable entre idiomas: sin tildes, sin mayúsculas y sin dobles espacios.
function brkKey(h){ return String(h||"").replace(/^﻿/,"").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," "); }
function brkRows(text){
  const lines=String(text||"").replace(/^﻿/,"").replace(/\r/g,"").split("\n").filter(function(l){ return l.trim()!==""; });
  if(!lines.length) return [];
  const sep=lines[0].split(";").length>lines[0].split(",").length?";":",";
  return lines.map(function(l){ return csvSplitLine(l,sep); });
}
/* El separador decimal se decide UNA vez por fichero, no celda a celda. `revoNum` adivina por
   celda y con DEGIRO en español falla: «0,125» participaciones lo lee como 125 (miles). Se cuentan
   las celdas que solo pueden ser de un formato («189,95», «1.234,5» frente a «189.95», «1,234.5»). */
function brkDecimal(rows){
  let c=0,p=0;
  rows.forEach(function(f){ f.forEach(function(x){
    const s=String(x||"").trim(); if(!/^[^\d]{0,5}[\d.,]+[^\d]{0,5}$/.test(s)) return;
    if(/\d\.\d{3},\d/.test(s)||/^[^\d]*\d+,(\d{1,2}|\d{4,})[^\d]*$/.test(s)) c++;
    else if(/\d,\d{3}\.\d/.test(s)||/^[^\d]*\d+\.(\d{1,2}|\d{4,})[^\d]*$/.test(s)) p++;
  }); });
  return c>p?",":(p>c?".":null);
}
function brkNum(s, dec){
  s=String(s==null?"":s).trim(); if(!s) return null;
  let neg=false;
  if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1); }
  if(s.indexOf("-")>=0||s.indexOf("−")>=0) neg=true;
  let d=s.replace(/[^0-9.,]/g,""); if(!/\d/.test(d)) return null;
  if(dec===",") d=d.replace(/\./g,"").replace(/,/g,".");
  else if(dec===".") d=d.replace(/,/g,"");
  else d=revoNum(d);
  const n=parseFloat(d); return isFinite(n)?(neg?-n:n):null;
}
// Columna por sinónimos: primero igual, luego «empieza por» (DEGIRO recorta y cambia las cabeceras según el idioma).
function brkCol(head, syns){
  for(let k=0;k<syns.length;k++){ const j=head.indexOf(syns[k]); if(j>=0) return j; }
  for(let k=0;k<syns.length;k++){ for(let j=0;j<head.length;j++){ if(head[j] && head[j].indexOf(syns[k])===0) return j; } }
  return -1;
}
/* Importe con su divisa. DEGIRO pone la divisa en una columna SIN NOMBRE pegada al importe, unas
   veces delante («Valor local» = USD y el número en la siguiente) y otras detrás (Transacciones). */
var BRK_CUR=/^([A-Z]{3}|GBX|GBp)$/;
function brkMoney(f, j, dec){
  if(j<0) return {amt:null,cur:null};
  const a=String(f[j]||"").trim(), b=String(f[j+1]||"").trim();
  let m=/^([A-Z]{3})\s+(.+)$/.exec(a);
  if(m) return {amt:brkNum(m[2],dec),cur:m[1]};
  if(BRK_CUR.test(a)) return {amt:brkNum(b,dec),cur:a};
  return {amt:brkNum(a,dec),cur:BRK_CUR.test(b)?b:null};
}
function brkIsoDate(s){
  s=String(s||"").trim(); let m;
  if((m=/^(\d{4})-?(\d{2})-?(\d{2})/.exec(s))) return m[1]+"-"+m[2]+"-"+m[3];
  if((m=/^(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{4})/.exec(s))) return m[3]+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[1]).slice(-2);
  return null;
}
/* Peniques (GBX/GBp, Londres): el BCE no tiene cambio para ellos y tomarlos por libras multiplica
   por 100. Con el «Valor en EUR» del fichero (y sin un coste nativo que se quedaría huérfano) la
   posición va en €; si no, se pasa a libras ÷100, que es exacto. */
function brkPence(po){
  if(po.cur!=="GBX" && po.cur!=="GBp") return po;
  if(po.valueEurHint!=null && (po.cost==null || po.costEur!=null))
    return Object.assign(po,{cur:"EUR", valueHint:po.valueEurHint, cost:po.costEur, price:null});
  const d=function(n){ return n==null?null:+(n/100).toFixed(4); };
  return Object.assign(po,{cur:"GBP", valueHint:d(po.valueHint), cost:po.cost==null?null:+(po.cost/100).toFixed(2), price:d(po.price)});
}
function brkHeadRow(rows, need){
  for(let i=0;i<Math.min(rows.length,6);i++){ const h=rows[i].map(brkKey); if(need(h)) return i; }
  return -1;
}

/* ---- DEGIRO: Cartera.csv (lo que tienes hoy) + Transacciones.csv (lo que te costó) ----
   Cabeceras de las cuatro lenguas de la cuenta (es/en/nl/de). Fixtures sintéticos en
   tests/broker-degiro.test.mjs: no hay ficheros reales y los de un usuario no se commitean. */
var DEGIRO_COLS={
  prod:["producto","product","produkt"],
  isin:["simbolo/isin","symbol/isin","symbool/isin","isin"],
  qty:["cantidad","quantity","amount","aantal","anzahl","numero","number"],
  close:["precio de cierre","closing","slotkoers","schlusskurs","cierre"],
  local:["valor local","local value","lokale waarde","wert in lokalwahrung","lokalwahrung"],
  eur:["valor en eur","value in eur","waarde in eur","wert in eur","valor eur","value eur"],
  date:["fecha","date","datum"], time:["hora","time","tijd","uhrzeit","zeit"],
  price:["precio","price","koers","kurs"],
  value:["valor","value","waarde","wert"],
  fee:["costes de transaccion","costes","transaction and/or third","transaction costs","transactiekosten","transaktionskosten","transaktionsund"],
  total:["total","totaal","gesamt"],
  order:["id orden","order id","order-id","orderid"]
};
function degiroHead(h, tx){
  const c=function(k){ return brkCol(h,DEGIRO_COLS[k]); };
  if(tx) return c("date")>=0 && c("isin")>=0 && c("qty")>=0 && c("price")>=0 && h.indexOf("isin")>=0;
  return c("prod")>=0 && c("isin")>=0 && c("qty")>=0 && c("local")>=0 && c("date")<0;
}
/* Si ninguna celda decide el decimal (todas con tres decimales, «0,125»), decide el IDIOMA de la
   cabecera, que es el de los números: en inglés punto, en es/nl/de coma. Nunca se vuelve a
   adivinar celda a celda, que leía «0,125» participaciones como 125 (revisión de dinero 18/11).
   Solo cabeceras que existen ÚNICAMENTE en inglés: «product» y «date» también son neerlandés. */
function degiroDec(head){
  return head.some(function(h){ return ["quantity","closing","local value"].indexOf(h)>=0; })?".":",";
}
// Transacciones → operaciones por ISIN. Cada fila lleva su clave (orden + fecha + cantidad) para que
// soltar el mismo fichero dos veces no duplique compras.
function degiroParseTx(text){
  const rows=brkRows(text); const hi=brkHeadRow(rows,function(h){ return degiroHead(h,true); });
  if(hi<0) return null;
  const head=rows[hi].map(brkKey); const ci={}; Object.keys(DEGIRO_COLS).forEach(function(k){ ci[k]=brkCol(head,DEGIRO_COLS[k]); });
  // «Valor» a secas es el importe en EUR: se busca EXACTO, que «valor local» también empieza por «valor».
  ci.value=-1; DEGIRO_COLS.value.some(function(n){ const j=head.indexOf(n); if(j>=0){ ci.value=j; return true; } return false; });
  const body=rows.slice(hi+1); const dec=brkDecimal(body)||degiroDec(head);
  const ops={}; let n=0;
  body.forEach(function(f){
    const isin=String(f[ci.isin]||"").trim().toUpperCase(); if(!BRK_ISIN.test(isin)) return;
    const q=brkNum(f[ci.qty],dec); if(!q) return;
    const date=brkIsoDate(f[ci.date]); const time=ci.time>=0?String(f[ci.time]||"").trim():"";
    const loc=brkMoney(f,ci.local,dec), val=brkMoney(f,ci.value,dec), fee=brkMoney(f,ci.fee,dec), tot=brkMoney(f,ci.total,dec);
    const feeAbs=Math.abs(fee.amt||0);
    let eurTot=null;
    if(tot.amt!=null && (!tot.cur||tot.cur==="EUR")) eurTot=Math.abs(tot.amt);
    else if(val.amt!=null && (!val.cur||val.cur==="EUR") && (!feeAbs||fee.cur==="EUR"||!fee.cur)) eurTot=Math.abs(val.amt)+feeAbs;
    // La comisión va en EUR y el coste nativo en la moneda del valor: se pasa con el cambio QUE
    // SALE DE LA PROPIA FILA (local ÷ EUR), así da igual en qué sentido escriba DEGIRO su tipo.
    let feeLoc=0;
    if(feeAbs){
      if(!fee.cur||fee.cur===loc.cur) feeLoc=feeAbs;
      else if(fee.cur==="EUR" && loc.amt && val.amt && (!val.cur||val.cur==="EUR")) feeLoc=feeAbs*Math.abs(loc.amt)/Math.abs(val.amt);
      else feeLoc=null;
    }
    const k=[ci.order>=0?String(f[ci.order]||"").trim():"",date,time,isin,q].join("|");
    const o=ops[isin]||(ops[isin]={});
    if(!o[k]) n++;
    o[k]={ ts:(date||"")+" "+time, qty:q, local:loc.amt==null?null:Math.abs(loc.amt), cur:loc.cur||null, eur:eurTot, feeLoc:feeLoc, fees:fee.cur==="EUR"||!fee.cur?feeAbs:0 };
  });
  return n?ops:null;
}
/* Coste MEDIO de lo que te queda, como `revoAggregate`: cada venta se lleva su parte del coste.
   Un solo dato que falte en una COMPRA deja ese coste en null: «—» antes que un coste a medias. */
function degiroCostOf(byKey){
  const ord=Object.keys(byKey).map(function(k){ return byKey[k]; }).sort(function(a,b){ return a.ts<b.ts?-1:(a.ts>b.ts?1:0); });
  let sh=0, cL=0, cE=0, okL=true, okE=true, buys=0, sells=0, cur=null;
  ord.forEach(function(o){
    if(o.qty>0){ sh+=o.qty; buys++;
      if(o.cur){ if(cur && cur!==o.cur) okL=false; cur=o.cur; }
      if(o.local==null||o.feeLoc==null) okL=false; else cL+=o.local+o.feeLoc;
      if(o.eur==null) okE=false; else cE+=o.eur; }
    else { const q=Math.min(-o.qty,sh); const fr=sh>0?q/sh:0; cL-=cL*fr; cE-=cE*fr; sh-=q; sells++; }
  });
  return { shares:+sh.toFixed(8), cost:okL?+cL.toFixed(2):null, costEur:okE?+cE.toFixed(2):null, cur:cur, buys:buys, sells:sells };
}
function degiroParseCartera(text, memo){
  const rows=brkRows(text); const hi=brkHeadRow(rows,function(h){ return degiroHead(h,false); });
  if(hi<0) return null;
  const head=rows[hi].map(brkKey); const ci={}; ["prod","isin","qty","close","local","eur"].forEach(function(k){ ci[k]=brkCol(head,DEGIRO_COLS[k]); });
  const body=rows.slice(hi+1); const dec=brkDecimal(body)||degiroDec(head);
  const tx=(memo&&memo.degiroTx)||null;
  const positions=[], cash=[], warnings=[], present=[]; let skipped=0;
  body.forEach(function(f){
    const name=String(f[ci.prod]||"").trim(); const id=String(f[ci.isin]||"").trim().toUpperCase();
    const q=brkNum(f[ci.qty],dec); const loc=brkMoney(f,ci.local,dec);
    // La fila del efectivo («CASH & CASH FUND…») no trae ISIN ni cantidad: es dinero, no una posición.
    if(!id && !q){ if(loc.amt!=null) cash.push({cur:loc.cur||"EUR",amt:loc.amt}); return; }
    // Solo una cantidad ILEGIBLE cuenta como presente; una a 0 es una posición cerrada y tiene que
    // poder salir como «ya no está» (tercera revisión de dinero 18/11: Tesla a 0 seguía sumando 600 €).
    if(!id || !(q>0)){ skipped++; if(id && q==null) present.push(id); return; }
    const isin=BRK_ISIN.test(id)?id:null;
    const eurV=ci.eur>=0?brkMoney(f,ci.eur,dec).amt:null;
    const close=ci.close>=0?brkNum(f[ci.close],dec):null;
    const po={ key:isin||id, isin:isin, sym:isin?null:id, name:name||id, shares:q, cur:loc.cur||"EUR",
      valueHint:loc.amt, valueEurHint:eurV, price:close, cost:null, costEur:null, costWhy:"need_tx", buys:0, sells:0 };
    // Dos vías (AGENTS §7): cantidad × cierre tiene que dar el valor local que trae el fichero.
    if(close!=null && loc.amt!=null && Math.abs(q*close-loc.amt)>Math.max(0.05,Math.abs(loc.amt)*0.005)) warnings.push({k:"check",name:po.name});
    if(tx){
      const ops=isin?tx[isin]:null;
      if(!ops) po.costWhy="tx_missing";
      else { const c=degiroCostOf(ops); po.buys=c.buys; po.sells=c.sells;
        // Si las operaciones no explican las participaciones de hoy (traspaso de entrada, split,
        // un rango de fechas corto) su coste no es el tuyo: «—» y se dice por qué.
        if(Math.abs(c.shares-q)>1e-6) po.costWhy="tx_mismatch";
        else { po.cost=(!c.cur||c.cur===po.cur)?c.cost:null; po.costEur=c.costEur; po.costWhy=po.cost==null&&po.costEur==null?"tx_partial":null; } }
    }
    positions.push(brkPence(po));
  });
  if(!positions.length && !cash.length) return null;
  return { positions:positions, cash:cash, warnings:warnings, present:present, skipped:skipped, dividends:0, fees:0, from:null, to:null, snapshot:true };
}

/* ---- Interactive Brokers: Flex Query (XML o CSV) y Activity Statement ----
   El XML se lee con una expresión regular y no con DOMParser: Flex lo trae todo en atributos de
   etiquetas de una línea, y así el MISMO parser corre en los tests de Node (que no tienen DOM) y
   valdrá tal cual para la fase 3, cuando el mismo XML llegue por la API. */
function brkXmlUnesc(s){ return String(s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&"); }
function brkXmlTags(text, name){
  const out=[]; const re=new RegExp("<"+name+"\\b([^>]*?)\\/?>","g"); let m;
  while((m=re.exec(text))){ const o={}; m[1].replace(/([A-Za-z_][\w.\-]*)\s*=\s*"([^"]*)"/g,function(_,k,v){ o[k.toLowerCase()]=brkXmlUnesc(v); return ""; }); out.push(o); }
  return out;
}
var IBKR_SKIP={ OPT:1, FOP:1, FUT:1, WAR:1, CFD:1, CASH:1, "EQUITY AND INDEX OPTIONS":1, FUTURES:1, FOREX:1, OPTIONS:1 };
/* Filas ya normalizadas (claves en minúscula, las de Flex) → posiciones. Con SUMMARY y LOT a la
   vez manda SUMMARY; si solo hay lotes, se suman. */
function ibkrPositions(rows, dec){
  const by={}; const accts={}; const warnings=[], present=[]; let deriv=0, shorts=0;
  rows.forEach(function(r){
    const cat=String(r.assetcategory||r.assetclass||"").toUpperCase();
    if(IBKR_SKIP[cat]){ deriv++; return; }
    const isin=String(r.isin||r.securityid||"").trim().toUpperCase();
    const sym=String(r.symbol||"").trim(); const exch=String(r.listingexchange||"").trim();
    const key=BRK_ISIN.test(isin)?isin:(sym+(exch?"@"+exch:""));
    if(!key) return;
    const lvl=String(r.levelofdetail||"SUMMARY").toUpperCase();
    /* POR CUENTA (revisión de dinero 18/11): un Flex de varias cuentas (individual + conjunta, IRA…)
       trae una fila SUMMARY por cuenta y por valor. Quedarse con la última dejaba VWCE 20+5 en 5 y
       el patrimonio 2.402 € más bajo sin aviso. Cada cuenta manda su SUMMARY (o sus lotes) y se suman. */
    const acct=String(r.accountid||r.clientaccountid||r.account||"").trim();
    if(acct) accts[acct]=1;
    const g=by[key]||(by[key]={});
    const a=g[acct]||(g[acct]={sum:null,lots:[]});
    if(lvl==="LOT") a.lots.push(r); else a.sum=r;
  });
  const positions=[];
  const nAcct=Object.keys(accts).length;
  if(nAcct>1) warnings.push({k:"accounts",n:nAcct});
  Object.keys(by).forEach(function(key){
    const g=by[key]; const rs=[];
    Object.keys(g).forEach(function(k){ const a=g[k]; Array.prototype.push.apply(rs, a.sum?[a.sum]:a.lots); });
    const r0=rs[0];
    /* Lo que el fichero TRAE pero no se importa (dos monedas, cantidad ilegible) sigue
       presente: si no, `brkGoneOf` lo marcaba «ya no está» y salía del patrimonio algo que se
       tiene (segunda revisión de dinero 18/11: VWCE en € y en $, −2.402 € sin motivo). */
    const sigue=function(){ present.push(key); if(r0.symbol) present.push(String(r0.symbol).trim()); };
    // El mismo valor en dos monedas no se suma: se avisa y no entra.
    const curs={}; rs.forEach(function(r){ curs[String(r.currency||r.currencyprimary||"").trim().toUpperCase()]=1; });
    if(Object.keys(curs).length>1){ warnings.push({k:"mixcur",name:String(r0.description||r0.symbol||key).trim()}); sigue(); return; }
    const num=function(r,k){ return brkNum(r[k],dec); };
    const tot=function(k){ let s=0,ok=true; rs.forEach(function(r){ const v=num(r,k); if(v==null) ok=false; else s+=v; }); return ok?s:null; };
    const q=tot("position")!=null?tot("position"):tot("quantity");
    if(q==null){ sigue(); return; }
    // Corta: no se importa y la larga de antes ya no está (si quedara presente, seguiría sumando).
    if(q<0){ shorts++; return; }
    if(!(q>0)) return;
    const cur=String(r0.currency||r0.currencyprimary||"").trim().toUpperCase()||null;
    const val=tot("positionvalue"), costN=tot("costbasismoney"), mark=num(r0,"markprice");
    const isin=BRK_ISIN.test(String(r0.isin||r0.securityid||"").toUpperCase())?String(r0.isin||r0.securityid).toUpperCase():null;
    /* Coste en € anclado SOLO si la posición ya es en euros. `fxRateToBase` es el cambio del DÍA
       DEL INFORME, no el de cuando compraste: anclarlo congelaría un coste que no pagaste. Sin
       ancla, la app convierte el coste nativo al cambio de hoy, como con cualquier valor en $. */
    const po={ key:key, isin:isin, sym:String(r0.symbol||"").trim()||null, exch:String(r0.listingexchange||"").trim()||null,
      name:String(r0.description||r0.symbol||key).trim(), shares:+q.toFixed(8), cur:cur||"EUR",
      valueHint:val, price:mark, cost:costN==null?null:+Math.abs(costN).toFixed(2), costEur:null,
      costWhy:costN==null?"no_cost":(cur==="EUR"?null:"fx_today"), buys:0, sells:0 };
    if(cur==="EUR" && po.cost!=null) po.costEur=po.cost;
    if(!cur) warnings.push({k:"nocur",name:po.name});
    // Dos vías: cantidad × precio de marca (× multiplicador) contra el valor que trae el fichero.
    const mult=num(r0,"multiplier")||num(r0,"mult")||1;
    if(mark!=null && val!=null && Math.abs(q*mark*mult-val)>Math.max(0.05,Math.abs(val)*0.005)) warnings.push({k:"check",name:po.name});
    positions.push(brkPence(po));
  });
  if(deriv) warnings.push({k:"deriv",n:deriv});
  if(shorts) warnings.push({k:"short",n:shorts});
  return { positions:positions, warnings:warnings, present:present };
}
function ibkrCash(rows, dec){
  const out=[];
  rows.forEach(function(r){ const c=String(r.currency||r.currencyprimary||"").toUpperCase(); const v=brkNum(r.endingcash,dec);
    if(c && c.indexOf("BASE")<0 && v!=null && Math.abs(v)>0.004) out.push({cur:c,amt:v}); });
  return out;
}
function ibkrParseFlexXml(text){
  text=String(text||"");
  if(text.indexOf("<FlexQueryResponse")<0 && text.indexOf("<FlexStatement")<0) return null;
  const pos=ibkrPositions(brkXmlTags(text,"OpenPosition"),".");
  const cash=ibkrCash(brkXmlTags(text,"CashReportCurrency"),".");
  const st=brkXmlTags(text,"FlexStatement")[0]||{};
  const to=brkIsoDate(st.todate||((brkXmlTags(text,"OpenPosition")[0]||{}).reportdate)||"");
  if(!pos.positions.length && !cash.length) return null;
  return { positions:pos.positions, cash:cash, warnings:pos.warnings, present:pos.present, skipped:0, dividends:0, fees:0, from:brkIsoDate(st.fromdate||""), to:to, snapshot:true };
}
// Flex en CSV: los mismos campos que el XML, en columnas («CurrencyPrimary» en vez de «currency»).
// Si se activan las cabeceras de sección, las filas llegan como HEADER/DATA,<sección>,…
function ibkrParseFlexCsv(text){
  const rows=brkRows(text); if(!rows.length) return null;
  let head=null; const recs=[];
  rows.forEach(function(f){
    const t0=String(f[0]||"").trim().toUpperCase();
    if(/^(BOF|BOA|BOS|EOS|EOA|EOF)$/.test(t0)) return;
    if(t0==="HEADER"||t0==="DATA") f=f.slice(2);
    const low=f.map(function(x){ return String(x||"").trim().toLowerCase(); });
    if(low.indexOf("symbol")>=0 || low.indexOf("currencyprimary")>=0 || low.indexOf("clientaccountid")>=0){ head=low; return; }
    if(!head) return;
    const o={}; head.forEach(function(h,j){ if(h) o[h]=f[j]; }); recs.push(o);
  });
  if(!recs.length) return null;
  const dec=brkDecimal(rows)||".";
  const pos=ibkrPositions(recs.filter(function(r){ return (r.position!=null||r.quantity!=null) && (r.markprice!=null||r.positionvalue!=null); }),dec);
  const cash=ibkrCash(recs.filter(function(r){ return r.endingcash!=null; }),dec);
  if(!pos.positions.length && !cash.length) return null;
  let to=null; recs.forEach(function(r){ const d=brkIsoDate(r.reportdate||""); if(d && (!to||d>to)) to=d; });
  return { positions:pos.positions, cash:cash, warnings:pos.warnings, present:pos.present, skipped:0, dividends:0, fees:0, from:null, to:to, snapshot:true };
}
/* Activity Statement: un CSV con muchas secciones; la primera columna dice cuál. Se leen «Open
   Positions» (solo las filas Summary), el ISIN de «Financial Instrument Information» y el
   efectivo de «Cash Report». Las filas «Total» se usan para cuadrar por la otra vía. */
var MONTHS_EN=["january","february","march","april","may","june","july","august","september","october","november","december"];
function ibkrParseActivity(text){
  const rows=brkRows(text);
  if(!rows.length || !rows.some(function(f){ return String(f[1]||"").trim()==="Header" && brkKey(f[0])==="open positions"; })) return null;
  const dec=brkDecimal(rows)||".";
  const heads={}; const data={}; const totals=[];
  rows.forEach(function(f){
    const sec=brkKey(f[0]), kind=String(f[1]||"").trim();
    if(kind==="Header"){ heads[sec]=f.slice(2).map(function(x){ return String(x||"").trim().toLowerCase().replace(/[\s\/]+/g,""); }); return; }
    const h=heads[sec]; if(!h) return;
    const o={}; h.forEach(function(k,j){ o[k]=f[j+2]; });
    if(kind==="Data") (data[sec]||(data[sec]=[])).push(o);
    else if(kind==="Total" && sec==="open positions") totals.push(o);
  });
  const fin={}; (data["financial instrument information"]||[]).forEach(function(r){ if(r.symbol) fin[String(r.symbol).trim()]=r; });
  const op=(data["open positions"]||[]).filter(function(r){ return String(r.datadiscriminator||"Summary").toLowerCase()==="summary"; }).map(function(r){
    const fi=fin[String(r.symbol||"").trim()]||{};
    return { assetcategory:r.assetcategory, currency:r.currency, symbol:r.symbol, description:fi.description||r.symbol,
      isin:fi.securityid||"", listingexchange:fi.listingexch||"", position:r.quantity, markprice:r.closeprice,
      positionvalue:r.value, costbasismoney:r.costbasis, multiplier:r.mult };
  });
  const pos=ibkrPositions(op,dec);
  // Por la otra vía: la fila «Total» de cada divisa contra la suma de lo que se ha leído.
  totals.forEach(function(tr){
    const c=String(tr.currency||"").toUpperCase(); const v=brkNum(tr.value,dec); if(!c||v==null) return;
    const s=pos.positions.filter(function(p){ return p.cur===c; }).reduce(function(a,p){ return a+(p.valueHint||0); },0);
    if(Math.abs(s-v)>0.05 && !pos.warnings.some(function(w){ return w.k==="deriv"||w.k==="short"; })) pos.warnings.push({k:"total",name:c});
  });
  const cash=[];
  (data["cash report"]||[]).forEach(function(r){
    if(brkKey(r.currencysummary)!=="ending cash") return;
    const c=String(r.currency||"").toUpperCase(); const v=brkNum(r.total,dec);
    if(c && c.indexOf("BASE")<0 && v!=null && Math.abs(v)>0.004) cash.push({cur:c,amt:v});
  });
  let to=null;
  (data["statement"]||[]).forEach(function(r){
    if(brkKey(r.fieldname)!=="period") return;
    const re=/([a-z]+)\s+(\d{1,2}),\s*(\d{4})/gi; let m, last=null; while((m=re.exec(String(r.fieldvalue||"")))) last=m;
    const mi=last?MONTHS_EN.indexOf(last[1].toLowerCase()):-1;
    if(mi>=0) to=last[3]+"-"+("0"+(mi+1)).slice(-2)+"-"+("0"+last[2]).slice(-2);
  });
  if(!pos.positions.length && !cash.length) return null;
  return { positions:pos.positions, cash:cash, warnings:pos.warnings, present:pos.present, skipped:0, dividends:0, fees:0, from:null, to:to, snapshot:true };
}

/* PERFILES. `aux` = el fichero solo aporta datos a la memoria; `parse` = saca posiciones.
   El orden importa dentro de cada bróker: es el de los `if` del importador de Revolut de antes. */
var BROKER_PROFILES=[
  { id:"revolut-stocks", ent:"revolut", detect:function(x){ return !!revoParse(x); },
    parse:function(x){ const p=revoParse(x); const agg=p?revoAggregate(p):null;
      return (agg && agg.positions.length)?Object.assign({},agg,{from:p.from,to:p.to,skipped:p.skipped}):null; } },
  { id:"revolut-metals", ent:"revolut", detect:function(x){ return !!revoParseCommodities(x); },
    parse:function(x,memo){ const res=revoParseCommodities(x);
      // El coste que antes había que teclear a mano, ahora calculado: casa cada conversión con
      // su pata en euros por marca de tiempo y aplica coste medio (ver revoMetalCost).
      if(res) res.positions.forEach(function(po){ if(po.metal && po.mov) po.cost=revoMetalCost(po.mov, (memo.metalEur||{})[po.ticker]); });
      return res; } },
  { id:"revolut-fiat", ent:"revolut", detect:function(x){ return !!revoMetalCostsFromFiat(x); },
    aux:function(x,memo){ const c=revoMetalCostsFromFiat(x); if(!c) return false;
      const m=memo.metalEur||(memo.metalEur={});
      Object.keys(c).forEach(function(tk){ Object.assign(m[tk]||(m[tk]={}), c[tk]); }); return true; } },
  { id:"degiro-cartera", ent:"degiro", detect:function(x){ return !!degiroParseCartera(x,null); }, parse:degiroParseCartera },
  { id:"degiro-tx", ent:"degiro", detect:function(x){ return !!degiroParseTx(x); },
    aux:function(x,memo){ const o=degiroParseTx(x); if(!o) return false;
      const m=memo.degiroTx||(memo.degiroTx={});
      Object.keys(o).forEach(function(isin){ Object.assign(m[isin]||(m[isin]={}), o[isin]); }); return true; } },
  { id:"ibkr-flex-xml", ent:"ibkr", detect:function(x){ return !!ibkrParseFlexXml(x); }, parse:ibkrParseFlexXml },
  { id:"ibkr-activity", ent:"ibkr", detect:function(x){ return !!ibkrParseActivity(x); }, parse:ibkrParseActivity },
  { id:"ibkr-flex-csv", ent:"ibkr", detect:function(x){ return !!ibkrParseFlexCsv(x); }, parse:ibkrParseFlexCsv }
];
function brokerDetect(text){
  return BROKER_PROFILES.filter(function(p){ try{ return p.detect(text); }catch(e){ return false; } }).map(function(p){ return p.id; });
}
/* El análisis entero de una tanda de ficheros de UN bróker. `memo` es la memoria entre tandas
   (la tarjeta la guarda en un ref). Devuelve {acc} o {err}: «aux» = solo llegaron ficheros de
   ayuda; «pnl» = el de Pérdidas y Ganancias de Revolut; «other:<bróker>» = es de otro bróker. */
function brokerAnalyze(ent, txts, memo){
  memo=memo||{};
  const profs=BROKER_PROFILES.filter(function(p){ return p.ent===ent; });
  const acc={ positions:[], dividends:0, fees:0, from:null, to:null, skipped:0, cash:[], warnings:[], present:[], snapshot:false };
  let any=false, allPnl=true, auxN=0;
  // PRIMERA PASADA: los ficheros de ayuda, antes de parsear nada, para que dé igual el orden.
  txts.forEach(function(src){ profs.forEach(function(p){ if(p.aux && p.aux(src,memo)) auxN++; }); });
  txts.forEach(function(src){
    let res=null;
    for(let k=0;k<profs.length && !res;k++){ if(profs[k].parse) res=profs[k].parse(src,memo); }
    if(!res){ if(!revoIsPnl(src)) allPnl=false; return; }
    any=true;
    res.positions.forEach(function(po){
      if(po.key==null) po.key=po.ticker;
      const j=acc.positions.findIndex(function(x){ return x.key===po.key; });
      if(j>=0) acc.positions[j]=po; else acc.positions.push(po);   // misma clave en dos ficheros: manda el último
    });
    acc.dividends+=res.dividends||0; acc.fees+=res.fees||0; acc.skipped+=res.skipped||0;
    if(res.from && (!acc.from||res.from<acc.from)) acc.from=res.from;
    if(res.to && (!acc.to||res.to>acc.to)) acc.to=res.to;
    if(res.cash) acc.cash=acc.cash.concat(res.cash);
    if(res.warnings) acc.warnings=acc.warnings.concat(res.warnings);
    if(res.present) acc.present=acc.present.concat(res.present);
    if(res.snapshot) acc.snapshot=true;
  });
  if(any) return { acc:acc };
  // Un fichero de ayuda solo está perfectamente entendido: lo que falta es el otro.
  if(auxN) return { err:"aux" };
  if(ent==="revolut" && allPnl) return { err:"pnl" };
  for(let i=0;i<txts.length;i++){
    const ids=brokerDetect(txts[i]); const o=BROKER_PROFILES.find(function(p){ return ids.indexOf(p.id)>=0 && p.ent!==ent; });
    if(o) return { err:"other:"+o.ent };
  }
  return { err:"bad" };
}
// Sugerencia SOLO por ISIN o ticker exacto y dentro del mismo bróker: por palabras del nombre
// «Vanguard All-World» casaría con «Vanguard S&P 500» y le pisaría las participaciones.
function brkSuggest(po, investments, ent){
  const mine=(investments||[]).filter(function(i){ return i.ent===ent; });
  const byIsin=po.isin && mine.find(function(i){ return i.isin===po.isin; });
  if(byIsin) return byIsin.id;
  const sym=String(po.sym||"").toUpperCase();
  const bySym=sym && mine.find(function(i){ return String(i.ticker||i.fileSym||"").toUpperCase()===sym && (!i.fileExch||!po.exch||i.fileExch===po.exch); });
  return bySym?bySym.id:null;
}
/* Posiciones del bróker que el fichero ya NO trae (vendidas). No se borran solas: se marcan con
   la fecha, y borrarla es cosa del usuario desde Editar. Sin esto vuelven los «cadáveres» y las
   resurrecciones de las sagas de Revolut y Trade Republic. Solo con un fichero de cartera
   COMPLETA (snapshot): con unas transacciones sueltas no se puede saber qué ya no está. */
function brkGoneOf(investments, ent, positions, map, present){
  const keys={};
  (present||[]).forEach(function(x){ x=String(x||"").toUpperCase(); if(!x) return; if(BRK_ISIN.test(x)) keys[x]=1; else keys["s:"+x.split("@")[0]]=1; });
  positions.forEach(function(p){ if(p.isin) keys[p.isin]=1; if(p.sym) keys["s:"+String(p.sym).toUpperCase()]=1; if(map[p.key]) keys["#"+map[p.key]]=1; });
  // También por el símbolo del fichero: una posición sin ISIN que SIGUE en el fichero (aunque se
  // deje en «no tocar») no está vendida, y marcarla la sacaría del patrimonio.
  const sym=function(i){ const x=String(i.fileSym||i.ticker||"").toUpperCase(); return x && keys["s:"+x]; };
  return (investments||[]).filter(function(i){ return i.ent===ent && !keys["#"+i.id] && !(i.isin && keys[i.isin]) && !sym(i) && (i.src==="csv:"+ent||i.src==="api:"+ent||i.isin); });
}
// Brókers con sincronización propia: sus posiciones no se ofrecen al importar un fichero de otro,
// porque cambiarlas de bróker haría que su sincronización las volviera a crear (contaría doble).
// Lo que ya re-ancla una conexión por API (IBKR, Kraken: `src:"api:…"`) tampoco: su sync la
// volvería a poner donde estaba.
var BRK_OWN_SYNC={ trade_republic:1, myinvestor:1 };
function brkTargetOk(i, ent){ return i.ent===ent || (!BRK_OWN_SYNC[i.ent] && String(i.src||"").indexOf("api:")!==0); }
/* Aplicar (DEGIRO, IBKR y los que vengan). Solo lo mapeado; lo que el fichero no trae se
   respeta. El precio en vivo NO se engancha: `prices` aún no sabe la moneda de cada cotización
   (un GBp tomado por GBP multiplica por 100), así que el símbolo del fichero se guarda aparte
   (`fileSym`) y el valor es el del fichero, con su fecha, hasta que eso esté. */
function brkApplyFile(s, ent, positions, map, goneMark, at, src){
  // `src`: de dónde viene el dato — "csv:<bróker>" por fichero, "api:<bróker>" por conexión.
  src=src||"csv:"+ent;
  const used={};
  let inv=(s.investments||[]).map(function(i){
    if(goneMark[i.id]) return Object.assign({},i,{fileGone:at});
    const po=brkTargetOk(i, ent) && positions.find(function(p){ return map[p.key]===i.id; });
    if(!po) return i;
    used[po.key]=1;
    const patch={ shares:po.shares, ent:ent, src:src };
    const sameCur=!i.cur||i.cur===po.cur;
    // Cambiar de moneda solo si el fichero trae también el coste: un coste viejo en € dentro de
    // una posición en $ haría mentir la ganancia.
    const curOk=sameCur || po.cost!=null || po.costEur!=null || !(Number(i.cost)>0);
    if(curOk){
      patch.cur=po.cur;
      if(po.valueHint!=null){ patch.value=+po.valueHint.toFixed(2); patch.fileAt=at; }
      if(po.cost!=null || po.costEur!=null){
        patch.cost=po.cost; patch.costEur=po.costEur;
        // Un `costEur` anclado (el € que de verdad se pagó) no se tira si el fichero trae lo mismo
        // que ya había —mismas participaciones y mismo coste nativo— pero sin ancla propia.
        if(po.costEur==null && typeof i.costEur==="number" && sameCur && i.shares===po.shares && Number(i.cost)===po.cost) patch.costEur=i.costEur;
      }
    }
    if(patch.value==null){ const pps=(i.shares>0 && i.value>0)?(i.value/i.shares):null; if(pps!=null) patch.value=+(pps*po.shares).toFixed(2); }
    if(!i.isin && po.isin) patch.isin=po.isin;
    if(po.sym){ patch.fileSym=po.sym; if(po.exch) patch.fileExch=po.exch; }
    const out=Object.assign({},i,patch);
    delete out.fileGone;
    if(out.costEur==null) delete out.costEur;
    return out;
  });
  const created=positions.filter(function(p){ return map[p.key]==="__new" && !used[p.key]; }).map(function(po){
    const o={ id:uid(), ent:ent, name:po.name, shares:po.shares, cur:po.cur||"EUR", src:src,
      value:po.valueHint!=null?+po.valueHint.toFixed(2):(po.cost!=null?po.cost:0), cost:po.cost };
    if(po.valueHint!=null) o.fileAt=at;
    if(po.costEur!=null) o.costEur=po.costEur;
    if(po.isin) o.isin=po.isin;
    if(po.sym){ o.fileSym=po.sym; if(po.exch) o.fileExch=po.exch; }
    return o;
  });
  if(created.length) inv=inv.concat(created);
  return Object.assign({},s,{investments:inv});
}

/* ---- Brókers por CONEXIÓN: IBKR (Flex Web Service) y Kraken (clave de solo lectura), 19/11 ----
   El dueño no quería ficheros: «que nadie tenga que entrar en la app del bróker». La credencial se
   guarda cifrada en el servidor (`broker-connect`) y `broker-sync` devuelve lo que hay; el dinero
   se decide AQUÍ con el mismo motor que los ficheros de la 243:
   · La PRIMERA lectura pasa por la vista previa: se elige a qué posición va cada cosa, «no tocar»
     de serie. Esas claves quedan como «conocidas» (`brokerApi[ent].known`).
   · Las siguientes re-anclan solas lo que ya casa (ISIN o símbolo, mismo bróker) y marcan lo que
     ya no está (solo lo que puso esta conexión). Una posición NUEVA no se crea sola: se propone
     (`pend`) y se revisa con la misma vista previa. Decisión del dueño, 19/11.
   · Solo con una lectura COMPLETA (`ok` y `snapshot`): una parcial no marca nada. */
var BRK_API=["ibkr","kraken"];
// IBKR da el cierre del último día hábil: más de dos veces al día no trae nada nuevo.
var BRK_API_THROTTLE={ ibkr:12*3600*1000, kraken:30*60*1000 };
var BRK_API_CODES=["flex_1012","flex_1015","flex_1013","flex_1014","flex_1018","flex_1019","flex_1025","flex_temp","flex_no_positions","flex_bad",
  "kraken_perm","kraken_no_funds","kraken_ip","kraken_otp","kraken_key","kraken_nonce","kraken_rate","kraken_temp","kraken_bad",
  "no_key","rate","expired","not_linked"];
/** Código cerrado del servidor → clave de texto. Lo desconocido, al genérico: nunca un texto del bróker. */
function brkApiErr(code){ return BRK_API_CODES.indexOf(code)>=0?"bx_e_"+code:"bx_e_error"; }
/* Respuesta de broker-connect/-sync → lo mismo que sale de un fichero. IBKR manda su XML tal cual
   y lo lee `ibkrParseFlexXml`; Kraken ya viene en posiciones, y aun así se revisa cada número:
   una cantidad o un valor que no sea un número positivo no entra (quedaría en 0 €). */
function brkApiSnapshot(res){
  if(!res||res.ok!==true||res.snapshot!==true) return null;
  if(res.broker==="ibkr"){
    const xml=String(res.flexXml||"");
    const p=ibkrParseFlexXml(xml);
    if(p) return p;
    /* Cuenta VACÍA (revisión de dinero 19/11): sin ninguna <OpenPosition> y sin efectivo, el parser
       del fichero devuelve null y se tomaba por un error, así que al venderlo TODO nada salía como
       «ya no está» y el valor viejo seguía sumando. El servidor ya ha comprobado que la sección
       existe: una lectura completa con cero posiciones es un dato, no un fallo. Si hay alguna
       posición que el parser no supo leer, sigue siendo error (no se marca nada). */
    if(xml.indexOf("<FlexQueryResponse")<0 || !/<OpenPositions[\s/>]/.test(xml) || /<OpenPosition\s/.test(xml)) return null;
    const st=brkXmlTags(xml,"FlexStatement")[0]||{};
    return { positions:[], present:[], cash:[], warnings:[], skipped:0, dividends:0, fees:0, from:null, to:brkIsoDate(st.todate||"")||null, snapshot:true };
  }
  if(res.broker!=="kraken"||!Array.isArray(res.positions)) return null;
  const present=(Array.isArray(res.present)?res.present:[]).map(String);
  const positions=[];
  res.positions.forEach(function(p){
    if(!p||!p.key) return;
    const q=Number(p.shares), v=Number(p.valueHint);
    if(!(q>0)||!(v>0)||!isFinite(v)){ present.push(String(p.sym||p.key)); return; }
    positions.push({ key:String(p.key), isin:null, sym:String(p.sym||p.key), exch:null, name:String(p.name||p.key), shares:q,
      cur:p.cur==="USD"?"USD":"EUR", valueHint:v, price:Number(p.price)||null, cost:null, costEur:null, costWhy:"api_nocost", buys:0, sells:0 });
  });
  return { positions:positions, present:present, cash:Array.isArray(res.cash)?res.cash:[], warnings:Array.isArray(res.warnings)?res.warnings:[],
    skipped:0, dividends:0, fees:0, from:null, to:/^\d{4}-\d{2}-\d{2}$/.test(String(res.asOf||""))?res.asOf:null, snapshot:true };
}
function brkApiMeta(s, ent, meta){
  const o=Object.assign({},s.brokerApi||{}); o[ent]=meta;
  return Object.assign({},s,{brokerApi:o});
}
/* EL VÍNCULO ES LA DECISIÓN (revisión de dinero 19/11). La vista previa guarda en `links` a qué
   posición fue cada clave del bróker, y la lectura automática SOLO re-ancla esos vínculos. Antes
   volvía a emparejar por ISIN o ticker con `brkSuggest`, que también encuentra lo que el usuario
   dejó en «no tocar»: VWCE llevado a mano en dos posiciones (suya y de su pareja, mismo ISIN)
   pasaba a valer el bróker entero en una y seguía sumando la otra (+600 € inventados). Y una
   posición con ticker distinto del símbolo del bróker («BTC-EUR» frente a «BTC») dejaba de casar
   y se congelaba sin aviso. */
function brkApiLinkOf(inv, ent, links, po){
  const id=links[po.key];
  if(id && inv.some(function(i){ return i.id===id; })) return id;
  // De reserva, solo lo que ya puso esta conexión y por lo que guardó ella (ISIN o su símbolo).
  const own=inv.find(function(i){ return i.ent===ent && i.src==="api:"+ent && ((po.isin && i.isin===po.isin) || (!po.isin && po.sym && i.fileSym===po.sym)); });
  return own?own.id:null;
}
/** Lo que el usuario decidió en la vista previa (primera lectura o revisión de nuevas). */
function brkApiReview(s, ent, parsed, map, goneMark){
  const was=(s.brokerApi||{})[ent]||{};
  const at=parsed.to||isoLocal();
  const before={}; (s.investments||[]).forEach(function(i){ before[i.id]=1; });
  const next=brkApplyFile(s, ent, parsed.positions, map, goneMark||{}, at, "api:"+ent);
  const nuevas=(next.investments||[]).filter(function(i){ return !before[i.id]; });
  const links=Object.assign({},was.links||{});
  parsed.positions.forEach(function(po){
    const v=map[po.key];
    if(v && v!=="__new") links[po.key]=v;
    else if(v==="__new"){
      const c=nuevas.find(function(i){ return po.isin?i.isin===po.isin:(i.fileSym===po.sym && !i.isin); });
      if(c) links[po.key]=c.id;
    }
    // «no tocar» no deja vínculo: esa clave queda conocida y la automática no la toca nunca.
  });
  const known=(was.known||[]).slice();
  parsed.positions.forEach(function(p){ if(known.indexOf(p.key)<0) known.push(p.key); });
  const pend=(was.pend||[]).filter(function(p){ return known.indexOf(p.key)<0; });
  return brkApiMeta(next, ent, Object.assign({},was,{known:known, links:links, pend:pend, at:Date.now(), asOf:at}));
}
/** Lectura automática tras la primera: re-ancla lo que casa, marca lo vendido, PROPONE lo nuevo.
 *  Sin primera revisión (`known`) no toca nada: devuelve null. */
function brkApiAuto(s, ent, parsed){
  const was=(s.brokerApi||{})[ent];
  if(!was||!Array.isArray(was.known)||!parsed||!parsed.snapshot) return null;
  const map={}, pend=[];
  /* Un vínculo a una posición que ya no existe (la borraste) se suelta y la clave vuelve a
     proponerse: si no, desaparecía para siempre sin forma de recuperarla (revisión 19/11, R1). */
  const inv=s.investments||[], links={}, known=was.known.slice();
  Object.keys(was.links||{}).forEach(function(k){
    if(inv.some(function(i){ return i.id===was.links[k]; })) links[k]=was.links[k];
    else { const j=known.indexOf(k); if(j>=0) known.splice(j,1); }
  });
  parsed.positions.forEach(function(po){
    const id=brkApiLinkOf(inv, ent, links, po);
    if(id) map[po.key]=id;
    else if(known.indexOf(po.key)<0) pend.push(po);
  });
  const goneMark={};
  brkGoneOf(s.investments, ent, parsed.positions, map, parsed.present).forEach(function(i){ if(i.src==="api:"+ent && !i.fileGone) goneMark[i.id]=1; });
  const at=parsed.to||isoLocal();
  const next=brkApplyFile(s, ent, parsed.positions, map, goneMark, at, "api:"+ent);
  return { s:brkApiMeta(next, ent, Object.assign({},was,{known:known, links:links, pend:pend, at:Date.now(), asOf:at})),
    n:Object.keys(map).length, pend:pend.length, gone:Object.keys(goneMark).length };
}

/* Lo que cambia por bróker al importar por fichero. El logo, el nombre y el estado los pone la
   ficha del bróker en «Mis bancos» (D1, 19/11), así que aquí ya no hay monogramas ni colores. */
var BROKER_FILE_CARDS={
  revolut:{ btn:"bi_rev_steps_btn", steps:"bi_rev_steps", file:"bi_file", accept:".csv,text/csv,text/plain" },
  degiro:{ btn:"bf_steps_btn", steps:"bf_degiro_steps", file:"bf_file", hint:"bf_hint", ph:"bf_paste_ph", accept:".csv,text/csv,text/plain" },
  ibkr:{ btn:"bf_steps_btn", steps:"bf_ibkr_steps", file:"bf_file", hint:"bf_hint", ph:"bf_paste_ph", accept:".csv,.xml,text/csv,text/xml,application/xml,text/plain" }
};
/* Importación por fichero, dentro de la ficha del bróker en «Mis bancos».
   Previsualización obligatoria + mapeo por posición antes de aplicar: el usuario cuadra contra
   la app de su bróker y decide. Re-ancla participaciones y coste a las posiciones mapeadas (o
   crea nuevas). No pisa un ISIN real con el ticker. */
function BrokerImport({state, set, fetchPrices, ent}){
  ent=ent||"revolut";
  const rev=ent==="revolut";
  const card=BROKER_FILE_CARDS[ent];
  const [text,setText]=useState("");
  const [parsed,setParsed]=useState(null);
  const [map,setMap]=useState({});
  const [gone,setGone]=useState({});        // posición que ya no está en el fichero → "" no tocar · "mark"
  const [mcost,setMcost]=useState({});      // coste € que TÚ tecleas para un metal (Revolut no lo trae)
  const [err,setErr]=useState(null);        // null | "bad" | "pnl" | "aux" | "other:<bróker>"
  /* La pata en EUROS de las conversiones a metal vive en el extracto de la cuenta NORMAL de
     Revolut, que no trae ni una posición. Se RECUERDA entre análisis para que los ficheros se
     puedan soltar de uno en uno y en cualquier orden.
     Feedback 2026-07-25: el usuario subió justo ese fichero —el que le hacía falta para que el
     oro dijera cuánto gana— y le saltó «No he podido leer el CSV», cuando se había leído
     perfectamente: los 1.000 € de sus seis conversiones a XAU estaban ahí. El error era del
     importador, que solo daba por «entendido» un fichero si sacaba POSICIONES. */
  const fiatRef=useRef({});
  const [doneN,setDoneN]=useState(null);
  const [steps,setSteps]=useState(false);
  // Coste efectivo de una posición: el del CSV si viniera, y para los metales el que teclees tú
  // (así el «sube/baja» sale — sin coste no hay % contra el que comparar, feedback 2026-07-17).
  const costOf=function(po){
    if(po.metal){ const raw=mcost[po.ticker]; if(raw!=null && String(raw).trim()!==""){ const n=revoAmt(String(raw)); if(n!=null && n>0) return n; } }
    return po.cost;
  };
  // Cada fichero es O acciones O materias primas (formatos que no se parecen en nada, ver
  // revoParseCommodities). Se admiten VARIOS a la vez y se fusionan: la cartera de Revolut
  // vive repartida en dos extractos y pedir dos pasadas era pedir que se le olvide una.
  const analyzeAll=function(txts){
    setErr(null); setDoneN(null);
    // La memoria entre tandas (fiatRef) es lo que deja soltar el extracto en € hoy y el de metales
    // mañana, o Transacciones antes que Cartera: ver brokerAnalyze.
    const r=brokerAnalyze(ent, txts, fiatRef.current);
    // Un fichero que SOLO aporta datos de ayuda está perfectamente entendido: lo que falta es el
    // otro. Decirlo así, en vez de «formato raro», es la diferencia entre saber qué subir y
    // probar ficheros a ciegas.
    if(r.err){ setErr(r.err); setParsed(null); return; }
    const acc=r.acc;
    const m={};
    acc.positions.forEach(function(po){
      if(!rev){ m[po.key]=brkSuggest(po, state.investments, ent)||""; return; }
      // el metal primero por su vía (más específica que el matcher por palabras del nombre)
      const sug=(po.metal?revoMetalSuggest(po.ticker,state.investments):null)
        || brokerSuggest({ticker:po.ticker,name:po.name}, brkSyncCandidates(state.investments, "revolut"));
      // Sin sugerencia clara el defecto es NO TOCAR (antes era «crear nueva» y el import
      // sembraba posiciones extra de valores ya vendidos — feedback 2026-07-13). Solo con
      // la cartera vacía compensa crear todo de serie.
      m[po.key]=sug||((state.investments||[]).length?"":"__new");
    });
    setParsed(acc); setMap(m); setGone({});
  };
  const analyze=function(txt){ analyzeAll([txt!=null?txt:text]); };
  const onFile=function(e){
    const files=Array.prototype.slice.call((e.target&&e.target.files)||[]); if(!files.length) return;
    Promise.all(files.map(function(f){ return new Promise(function(res){
      const r=new FileReader(); r.onload=function(){ res(String(r.result||"")); }; r.onerror=function(){ res(""); }; r.readAsText(f);
    }); })).then(function(txts){
      // con un solo fichero se rellena el textarea (permite reintentar «Analizar»); con varios
      // no: pegados uno detrás de otro serían un churro que ningún parser reconoce.
      setText(txts.length===1?txts[0]:"");
      analyzeAll(txts);
    });
  };
  const mappedN=parsed?parsed.positions.filter(function(p){ return map[p.key]; }).length:0;
  // Lo que ya no está en el fichero se marca de serie (marcar no mueve dinero: solo avisa) y
  // se puede dejar sin tocar. Borrarla sigue siendo cosa del usuario, desde Editar.
  const goneList=(parsed && !rev && parsed.snapshot)?brkGoneOf(state.investments, ent, parsed.positions, map, parsed.present):[];
  const goneMark={}; goneList.forEach(function(i){ if(gone[i.id]!=="") goneMark[i.id]=1; });
  const goneN=Object.keys(goneMark).length;
  const apply=function(){
    const pos=parsed.positions;
    if(!rev){
      const at=parsed.to||isoLocal();
      set(function(s){ return brkApplyFile(s, ent, pos, map, goneMark, at); });
      setDoneN(mappedN+goneN); setParsed(null); setText("");
      if(fetchPrices) setTimeout(function(){ fetchPrices(true); },50);
      return;
    }
    set(function(s){
      let inv=(s.investments||[]).map(function(i){
        const po=pos.find(function(p){ return map[p.ticker]===i.id; });
        if(!po) return i;
        const pcost=costOf(po);
        const patch={ shares:po.shares };
        if(pcost!=null) patch.cost=pcost;        // metales: si tecleaste el coste, entra; si no, se respeta el que hubiera
        if(!i.isin) patch.ticker=po.ticker;      // nunca pisar un ISIN real con un ticker
        // el valor se re-escala al nuevo nº de participaciones con el último precio conocido
        // (value/shares viejos). Antes el valor se quedaba tal cual y el % contra el coste
        // nuevo salía disparatado: un Broadcom con más acciones que ayer aparecía a −39%
        // cuando Revolut decía −6% (feedback 2026-07-13, «rotísimo»).
        const pps=(i.shares>0 && i.value>0)?(i.value/i.shares):null;
        // sin precio por participación (p.ej. el oro, que se llevaba a mano y sin «shares»)
        // el valor de partida es el coste; si tampoco hay coste, se deja el que ya tenía.
        // En los dos casos dura un suspiro: fetchPrices() al final lo pone en vivo.
        patch.value=+((pps!=null?pps*po.shares:(pcost!=null?pcost:(i.value||0)))).toFixed(2);
        return Object.assign({},i,patch);
      });
      const created=pos.filter(function(p){ return map[p.ticker]==="__new"; }).map(function(po){
        // sin precio en vivo (Revolut no da ISIN para el feed) → value arranca = coste; el usuario lo afina a mano.
        // Metal: si tecleaste el coste entra (así el % sube/baja sale); si no, cost null (sin % falso)
        // y value lo pone el precio en vivo (XAU→oro spot).
        const pcost=costOf(po);
        return { id:uid(), ent:"revolut", name:po.name, ticker:po.ticker, shares:po.shares,
                 value:pcost!=null?pcost:0, cost:pcost!=null?pcost:null, cur:po.cur||"EUR" };
      });
      if(created.length) inv=inv.concat(created);
      return Object.assign({},s,{investments:inv});
    });
    setDoneN(mappedN); setParsed(null); setText("");
    // y nada más re-anclar, precios en vivo en silencio: el valor pasa de «último conocido» a real
    if(fetchPrices) setTimeout(function(){ fetchPrices(true); },50);
  };
  // Vive dentro de la ficha de su bróker en Mis bancos (D1, 19/11): sin tarjeta ni monograma propio.
  const cardProps={className:"bk-flow","data-broker-file":ent};
  const errTxt=!err?null:(err==="aux"?t(rev?"bi_err_fiat":"bf_err_aux"):(err==="pnl"?t("bi_err_pnl")
    :(err.indexOf("other:")===0?tf("bf_err_other",{x:entOf(err.slice(6)).label}):t("bi_err"))));
  // Importe en su moneda, sin pasar a €: el cambio lo pone la app al pintar (y si no lo hay, «—»).
  const natAmt=function(n,cur){ return n==null?"—":NF.format(n)+" "+(cur||"EUR"); };
  return React.createElement("div",cardProps,
    React.createElement("div",{className:"hint",style:{marginTop:0,marginBottom:8}},t(card.hint||"bi_hint")),
    React.createElement("button",{className:"chip",style:{marginBottom:10},onClick:function(){ setSteps(!steps); }}, (steps?"▾ ":"▸ ")+t(card.btn)),
    steps && React.createElement("ol",{className:"bf-in",style:{margin:"0 0 12px",paddingLeft:18,fontSize:12.5,color:"var(--muted)",lineHeight:1.6}},
      (t(card.steps)||[]).map(function(st,i){ return React.createElement("li",{key:i,style:{marginBottom:4}}, st); })
    ),
    !parsed && doneN==null && React.createElement(React.Fragment,null,
      React.createElement("label",{className:"btn btn-ghost btn-block",style:{cursor:"pointer",marginBottom:8}}, t(card.file),
        React.createElement("input",{type:"file",accept:card.accept,multiple:true,style:{display:"none"},onChange:onFile})),
      React.createElement("textarea",{className:"af-in",style:{width:"100%",minHeight:70,fontFamily:"monospace",fontSize:11,boxSizing:"border-box"},placeholder:t(card.ph||"bi_paste_ph"),value:text,onChange:function(e){ setText(e.target.value); }}),
      React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},disabled:!text.trim(),onClick:function(){ analyze(); }}, t("bi_analyze"))
    ),
    // «aux» no es un fallo: el fichero se leyó bien y sus datos están guardados. Va en caja
    // neutra (no de alarma) para no dar por roto lo que ha funcionado.
    err && React.createElement("div",{className:err==="aux"?"hint":"alarmbox",style:{marginTop:10}}, errTxt),
    parsed && !rev && React.createElement(BrokerFilePreview,{parsed:parsed, ent:ent, state:state, map:map, setMap:setMap,
      goneList:goneList, gone:gone, setGone:setGone, mappedN:mappedN, goneN:goneN, natAmt:natAmt,
      apply:apply, cancel:function(){ setParsed(null); }}),
    parsed && rev && React.createElement("div",{className:"bf-in"},
      React.createElement("div",{className:"hint",style:{marginTop:6}}, tf(parsed.positions.length===1?"bi_summary_one":"bi_summary",{n:parsed.positions.length, from:parsed.from||"—", to:parsed.to||"—"})),
      parsed.skipped>0 && React.createElement("div",{className:"hint",style:{marginTop:0}}, tf("bi_skipped",{n:parsed.skipped})),
      mappedN<parsed.positions.length && React.createElement("div",{className:"hint",style:{marginTop:4}}, t("bi_unmatched_hint")),
      parsed.positions.map(function(po){
        // desglose de la reconstrucción («N compras · M ventas · splits») para poder auditar
        // por qué salen estas participaciones cuando no cuadran con la app de Revolut
        const ops=[ po.buys>0?tf("bi_buys",{n:po.buys}):null, po.sells>0?tf("bi_sells",{n:po.sells}):null, po.splits>0?tf("bi_splits",{n:po.splits}):null ].filter(Boolean).join(" · ");
        return React.createElement("div",{key:po.ticker,className:"row",style:{alignItems:"flex-start",flexDirection:"column",gap:6}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",width:"100%",gap:10}},
            React.createElement("div",{style:{minWidth:0}},
              React.createElement("div",{className:"rname"},(po.metal?po.name:po.ticker)+(po.cur&&po.cur!=="EUR"?(" · "+po.cur):"")),
              React.createElement("div",{className:"rsub"}, po.shares+" "+t(po.metal?"bi_oz":"bi_shares")+(ops?(" · "+ops):""))),
            // el coste de un metal no viene en el extracto: si lo tecleaste abajo lo mostramos, si no «—»
            React.createElement("div",{className:"rval num"}, (function(){ const c=costOf(po); return c!=null?eur(c):"—"; })())),
          React.createElement("select",{className:"af-in",value:map[po.ticker]||"",onChange:function(e){ const v=e.target.value; setMap(function(m){ const n=Object.assign({},m); n[po.ticker]=v; return n; }); }},
            React.createElement("option",{value:""},t("bi_notouch")),
            React.createElement("option",{value:"__new"},t("tr_createnew")),
            (state.investments||[]).map(function(i){ return React.createElement("option",{key:i.id,value:i.id}, i.name+(i.cur==="USD"?" ($)":"")); })
          ),
          // Metal: campo OPCIONAL para teclear lo que te costó en €. Revolut no lo trae en el CSV,
          // así que sin esto el oro/plata nunca puede pintar «sube/baja». Lo dejamos a mano y claro
          // (feedback 2026-07-17). Solo se pide si vas a tocar la posición (mapeada o nueva).
          po.metal && map[po.ticker] && React.createElement("input",{className:"af-in num",inputMode:"decimal",
            placeholder:t("bi_metal_cost_ph"), value:mcost[po.ticker]||"",
            onChange:function(e){ const v=e.target.value; setMcost(function(m){ const n=Object.assign({},m); n[po.ticker]=v; return n; }); }})
        );
      }),
      // Si el coste ha salido solo (extracto en € cruzado) hay que DECIRLO: si no, el usuario ve
      // un número que no ha tecleado y no sabe de dónde sale ni si puede fiarse.
      parsed.positions.some(function(p){ return p.metal; }) && React.createElement("div",{className:"hint",style:{marginTop:4}},
        t(parsed.positions.some(function(p){ return p.metal && p.cost!=null; })?"bi_metal_auto":"bi_metal_hint")),
      (parsed.dividends>0) && React.createElement("div",{className:"hint",style:{marginTop:2}}, tf("bi_cash_info",{int:eur(0), div:eur(parsed.dividends)})),
      React.createElement("div",{className:"hint",style:{marginTop:2}}, t("bi_usd_hint")),
      React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:mappedN===0,onClick:apply}, tf(mappedN===1?"bi_apply_one":"bi_apply",{n:mappedN})),
      React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:function(){ setParsed(null); }}, t("fj_cancel")),
      React.createElement("div",{className:"hint"},t("bi_apply_hint"))
    ),
    doneN!=null && React.createElement("div",{className:"hint",style:{color:"var(--mint)",fontWeight:700,marginTop:8}}, tf(doneN===1?"bi_done_one":"bi_done",{n:doneN}))
  );
}
/* Vista previa de DEGIRO / IBKR. Por fila: qué trae el fichero (participaciones, valor en su
   moneda) y el coste, o «—» con el porqué. Nada se aplica sin elegir a qué posición va. */
function BrokerFilePreview({parsed, ent, state, map, setMap, goneList, gone, setGone, mappedN, goneN, natAmt, apply, cancel, api}){
  // `api`: la misma vista para la conexión automática; solo cambian las frases que hablan de «fichero».
  const brokerName=entOf(ent).short||entOf(ent).label;
  const setOne=function(k,v){ setMap(function(m){ const n=Object.assign({},m); n[k]=v; return n; }); };
  const taken={}; Object.keys(map).forEach(function(k){ const v=map[k]; if(v && v!=="__new") taken[v]=1; });
  const sinPareja=parsed.positions.filter(function(p){ return !map[p.key]; });
  const warn=parsed.warnings||[];
  const sm={fontSize:12,color:"var(--muted)",lineHeight:1.4};
  const nPos=parsed.positions.length, nAp=mappedN+goneN;
  return React.createElement("div",{className:"bf-in"},
    // Una cartera de DEGIRO no trae fecha: sin ella, «· — → —» no dice nada y se quita.
    React.createElement("div",{className:"hint",style:{marginTop:6}}, (nPos===1?t("v4_inv_position"):tf("iv_positions",{n:nPos}))+(parsed.to?" · "+new Date(parsed.to+"T12:00:00").toLocaleDateString(loc(),{day:"2-digit",month:"short",year:"numeric"}):"")),
    sinPareja.length>0 && React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",margin:"4px 0 6px"}},
      React.createElement("span",{className:"hint",style:{margin:0,flex:"1 1 160px"}}, t("bf_unmatched")),
      React.createElement("button",{type:"button",className:"chip","data-act":"bf-create-all",style:{minHeight:44},onClick:function(){
        setMap(function(m){ const n=Object.assign({},m); sinPareja.forEach(function(p){ n[p.key]="__new"; }); return n; }); }},
        sinPareja.length===1?t("bf_create_one"):tf("bf_create_all",{n:sinPareja.length}))),
    parsed.positions.map(function(po){
      // En la vía por conexión un coste que no llega no se pinta como «—» suelto: ya lo dice su línea.
      const cost=po.costEur!=null?eur(po.costEur):(po.cost!=null?natAmt(po.cost,po.cur):(api?null:"—"));
      /* Cripto (Kraken): la cantidad va en su unidad («0,25 BTC»), no en «participaciones», que son de
         fondos; y el símbolo no se repite en una tercera línea si ya es el nombre (filtro de diseño 19/11). */
      const cripto=api && !po.isin && po.sym && po.sym===po.name;
      const qty=po.shares.toLocaleString(loc(),{maximumFractionDigits:8})+" "+(cripto?po.sym:t("bi_shares"));
      return React.createElement("div",{key:po.key,className:"row","data-bf-row":po.key,style:{alignItems:"flex-start",flexDirection:"column",gap:6}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",width:"100%",gap:10}},
          React.createElement("div",{style:{minWidth:0}},
            React.createElement("div",{className:"rname",style:{overflowWrap:"anywhere"}}, po.name+(po.cur!=="EUR"?" · "+po.cur:"")),
            React.createElement("div",{className:"rsub"}, qty+" · "+natAmt(po.valueHint,po.cur)),
            (po.isin||po.sym) && !cripto && React.createElement("div",{className:"rsub",style:{opacity:.8}}, po.isin||po.sym)),
          cost && React.createElement("div",{className:"rval num",style:{flex:"0 0 auto"}}, cost)),
        // Sin coste, o con coste sin anclar en €: se dice por qué en una línea.
        po.costWhy && React.createElement("div",{style:sm}, t("bf_cost_"+po.costWhy)),
        React.createElement("select",{className:"af-in bf-sel",value:map[po.key]||"",onChange:function(e){ setOne(po.key,e.target.value); }},
          React.createElement("option",{value:""},t("bi_notouch")),
          React.createElement("option",{value:"__new"},t("tr_createnew")),
          /* Una posición, una fila (revisión de dinero 19/11, R3): con dos filas a la misma solo se
             aplicaba la primera y la otra no sumaba nunca. La ya elegida en otra fila sale apagada. */
          (state.investments||[]).filter(function(i){ return brkTargetOk(i, ent); }).map(function(i){ return React.createElement("option",{key:i.id,value:i.id,disabled:!!taken[i.id]&&map[po.key]!==i.id}, i.ent===ent?i.name:i.name+" · "+(entOf(i.ent).short||entOf(i.ent).label)); })));
    }),
    goneList.length>0 && React.createElement("div",{style:{marginTop:10}},
      React.createElement("div",{className:"bk-sec",style:{marginBottom:4}}, api?tf("bx_gone_title",{x:brokerName}):t("bf_gone_title")),
      goneList.map(function(i){
        // El selector debajo y a todo el ancho, como en las filas de arriba: al lado, con letra
        // Enorme, el nombre bajaba a tres líneas.
        return React.createElement("div",{key:i.id,className:"row","data-bf-gone":i.id,style:{alignItems:"flex-start",flexDirection:"column",gap:6}},
          React.createElement("div",{className:"rname",style:{overflowWrap:"anywhere"}}, i.name),
          React.createElement("select",{className:"af-in bf-sel",value:gone[i.id]===""?"":"mark",
            onChange:function(e){ const v=e.target.value==="mark"?"mark":""; setGone(function(g){ const n=Object.assign({},g); n[i.id]=v; return n; }); }},
            React.createElement("option",{value:"mark"},t("bf_gone_mark")),
            React.createElement("option",{value:""},t("bi_notouch"))));
      })),
    warn.map(function(w,j){ return React.createElement("div",{key:j,className:"hint",style:{marginTop:4}}, tf("bf_w_"+w.k,{x:w.name||"",n:w.n||0})); }),
    (parsed.cash||[]).length>0 && React.createElement("div",{className:"hint",style:{marginTop:4}},
      tf(api?"bx_cash":"bf_cash",{x:parsed.cash.map(function(c){ return natAmt(c.amt,c.cur); }).join(" · ")})),
    React.createElement("div",{className:"hint",style:{marginTop:4}}, api?tf("bx_value",{x:brokerName}):t("bf_value_file")),
    React.createElement("div",{className:"bf-foot"},
      React.createElement("button",{className:"btn btn-ghost",style:{flex:"0 0 auto",minHeight:44},onClick:cancel}, t("fj_cancel")),
      /* Por conexión, «nada que aplicar» también es una respuesta: una cuenta vacía o todo en «no
         tocar» se confirma con «Listo» y queda decidido; si no, la primera lectura no acababa nunca. */
      React.createElement("button",{className:"btn btn-primary","data-act":"bf-apply",style:{flex:1,minHeight:44},disabled:nAp===0&&!api,onClick:apply}, nAp===0&&api?t("bx_review_done"):tf(nAp===1?"bi_apply_one":"bi_apply",{n:nAp})))
  );
}

