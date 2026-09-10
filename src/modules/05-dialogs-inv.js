/* ============================================================
   DIÁLOGOS DE LA APP (askText / askConfirm)
   ============================================================
   window.prompt/confirm pintan el cuadro NATIVO del sistema: gris, con la tipografía de
   Android y botones «CANCEL/OK» en inglés aunque la app esté en español. Cantaba tanto que
   la primera petición de fuera del círculo técnico fue justo esa (2026-07-15).
   askText → Promise<string|null> (null = canceló) · askConfirm → Promise<bool>.
   Son PROMESAS: el prompt nativo era síncrono, así que al portar un sitio hay que mover lo
   de después dentro del .then() (ojo con los early-return del patrón viejo).
   Si el host no está montado (p.ej. la pantalla del candado, que va antes que el árbol de la
   app) caen al diálogo nativo: feo, pero nunca se pierde la acción. */
var askEmit=null;
function askDialog(o){
  return new Promise(function(resolve){
    if(!askEmit){ resolve(o.input?window.prompt(o.title,o.value||""):window.confirm(o.title)); return; }
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
   Sin `AskHost` montado cae a `confirm()` con la PRIMERA opción, para no perder la acción. */
function askChoice(o){
  const opts=(o&&o.options)||[];
  return new Promise(function(resolve){
    if(!askEmit){ resolve(window.confirm(o.title)? (opts[0]&&opts[0].v) : null); return; }
    askEmit(Object.assign({},o,{input:false,options:opts,resolve:resolve}));
  });
}
function AskHost(){
  const [cur,setCur]=useState(null);
  const [val,setVal]=useState("");
  useEffect(function(){
    askEmit=function(o){ setVal(o.value!=null?String(o.value):""); setCur(o); };
    return function(){ askEmit=null; };
  },[]);
  if(!cur) return null;
  // resolve ANTES de perder cur, y solo una vez: cerrar por el fondo y por «Cancelar» son el mismo camino
  const done=function(r){ const f=cur.resolve; setCur(null); setVal(""); f(r); };
  const ok=function(){ done(cur.input?String(val):true); };
  // Con opciones, cancelar es `null` («no he elegido»), no `false` («he dicho que no»): con tres
  // caminos posibles, un `false` se confundiría con haber elegido el primero.
  const cancel=function(){ done((cur.input||(cur.options||[]).length>0)?null:false); };
  return ReactDOM.createPortal(
    React.createElement("div",{className:"askback"+(cur.compact?" ask-compact":""),onClick:cancel},
      React.createElement("div",{className:"tabsheet",onClick:function(e){ e.stopPropagation(); }},
        React.createElement("div",{className:"ts-title"},cur.title),
        cur.sub && React.createElement("div",{className:"ts-hint"},cur.sub),
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
          // Con opciones, el botón de aceptar sobra: elegir una YA es aceptar.
          (cur.options||[]).length===0 && React.createElement("button",{className:"btn btn-primary",style:cur.danger?{background:"linear-gradient(160deg,#E2705F,#C4553F)",color:"#fff"}:null,
            onClick:ok}, cur.ok||t("ask_ok")))
      )
    ), document.body);
}

/* ============================================================
   TAB: INVERSIONES
   ============================================================ */
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

// Divide una línea CSV respetando comillas dobles (campos con comas dentro).
function csvSplitLine(line){
  const out=[]; let cur=""; let q=false;
  for(let i=0;i<line.length;i++){ const c=line[i];
    if(q){ if(c==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=c; }
    else { if(c==='"') q=true; else if(c===','){ out.push(cur); cur=""; } else cur+=c; }
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

/* Tarjeta de importación CSV de Revolut. Vive junto a Trade Republic en «Mis bancos»
   (Revolut es un bróker más). Previsualización obligatoria + mapeo por posición antes
   de aplicar: el usuario cuadra contra su app de Revolut y decide. Re-ancla shares+coste
   a las posiciones mapeadas (o crea nuevas). No pisa un ISIN real con el ticker. */
function BrokerImport({state, set, fetchPrices, open, onToggle}){
  const [text,setText]=useState("");
  const [parsed,setParsed]=useState(null);
  const [map,setMap]=useState({});
  const [mcost,setMcost]=useState({});      // coste € que TÚ tecleas para un metal (Revolut no lo trae)
  const [err,setErr]=useState(null);        // null | "bad" | "pnl" | "fiat"
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
    const acc={ positions:[], dividends:0, fees:0, from:null, to:null, skipped:0 };
    let any=false, allPnl=true;
    // PRIMERA PASADA: recoger el coste en euros de los metales. Vive en el extracto de la CUENTA
    // (otro fichero), y el usuario puede soltarlos en cualquier orden — así que se juntan antes
    // de parsear nada, y da igual cuál venga primero. Se acumulan en fiatRef: soltar el extracto
    // en € en una tanda y el de metales en la siguiente tiene que funcionar igual.
    const mcosts=fiatRef.current;
    let fiatN=0;
    txts.forEach(function(src){
      const c=revoMetalCostsFromFiat(src);
      if(c){ fiatN++; Object.keys(c).forEach(function(tk){ Object.assign(mcosts[tk]||(mcosts[tk]={}), c[tk]); }); }
    });
    txts.forEach(function(src){
      let res=null;
      const p=revoParse(src);
      const agg=p?revoAggregate(p):null;
      if(agg && agg.positions.length) res=Object.assign({},agg,{from:p.from,to:p.to,skipped:p.skipped});
      else {
        res=revoParseCommodities(src);
        // El coste que antes había que teclear a mano, ahora calculado: casa cada conversión con
        // su pata en euros por marca de tiempo y aplica coste medio (ver revoMetalCost).
        if(res) res.positions.forEach(function(po){
          if(po.metal && po.mov) po.cost=revoMetalCost(po.mov, mcosts[po.ticker]);
        });
      }
      if(!res){ if(!revoIsPnl(src)) allPnl=false; return; }
      any=true;
      res.positions.forEach(function(po){
        const j=acc.positions.findIndex(function(x){ return x.ticker===po.ticker; });
        if(j>=0) acc.positions[j]=po; else acc.positions.push(po);   // mismo ticker en dos ficheros: manda el último
      });
      acc.dividends+=res.dividends||0; acc.fees+=res.fees||0; acc.skipped+=res.skipped||0;
      if(res.from && (!acc.from||res.from<acc.from)) acc.from=res.from;
      if(res.to && (!acc.to||res.to>acc.to)) acc.to=res.to;
    });
    // Un fichero que SOLO aporta los euros de los metales está perfectamente entendido: lo que
    // falta es el de Materias primas (las onzas). Decirlo así, en vez de «formato raro», es la
    // diferencia entre saber qué subir y probar ficheros a ciegas.
    if(!any){ setErr(fiatN?"fiat":(allPnl?"pnl":"bad")); setParsed(null); return; }
    const m={};
    acc.positions.forEach(function(po){
      // el metal primero por su vía (más específica que el matcher por palabras del nombre)
      const sug=(po.metal?revoMetalSuggest(po.ticker,state.investments):null)
        || brokerSuggest({ticker:po.ticker,name:po.name}, state.investments);
      // Sin sugerencia clara el defecto es NO TOCAR (antes era «crear nueva» y el import
      // sembraba posiciones extra de valores ya vendidos — feedback 2026-07-13). Solo con
      // la cartera vacía compensa crear todo de serie.
      m[po.ticker]=sug||((state.investments||[]).length?"":"__new");
    });
    setParsed(acc); setMap(m);
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
  const mappedN=parsed?parsed.positions.filter(function(p){ return map[p.ticker]; }).length:0;
  const apply=function(){
    const pos=parsed.positions;
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
  if(open===false) return React.createElement("div",{className:"bk-card bk-csv"},
    bkBrand({logo:"CSV", logoStyle:{background:"#9BD0E022",color:"#9BD0E0"}, title:t("bi_rev_title"), sub:t("bi_sub"),
             badge:null, open:false, onToggle:onToggle}));
  return React.createElement("div",{className:"bk-card bk-csv"},
    bkBrand({logo:"CSV", logoStyle:{background:"#9BD0E022",color:"#9BD0E0"}, title:t("bi_rev_title"), sub:t("bi_sub"),
             badge:null, open:true, onToggle:onToggle}),
    React.createElement("div",{className:"hint",style:{marginTop:0,marginBottom:8}},t("bi_hint")),
    React.createElement("button",{className:"chip",style:{marginBottom:10},onClick:function(){ setSteps(!steps); }}, (steps?"▾ ":"▸ ")+t("bi_rev_steps_btn")),
    steps && React.createElement("ol",{style:{margin:"0 0 12px",paddingLeft:18,fontSize:12.5,color:"var(--muted)",lineHeight:1.6}},
      (t("bi_rev_steps")||[]).map(function(st,i){ return React.createElement("li",{key:i,style:{marginBottom:4}}, st); })
    ),
    !parsed && doneN==null && React.createElement(React.Fragment,null,
      React.createElement("label",{className:"btn btn-ghost btn-block",style:{cursor:"pointer",marginBottom:8}}, t("bi_file"),
        React.createElement("input",{type:"file",accept:".csv,text/csv,text/plain",multiple:true,style:{display:"none"},onChange:onFile})),
      React.createElement("textarea",{className:"af-in",style:{width:"100%",minHeight:70,fontFamily:"monospace",fontSize:11,boxSizing:"border-box"},placeholder:t("bi_paste_ph"),value:text,onChange:function(e){ setText(e.target.value); }}),
      React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:8},disabled:!text.trim(),onClick:function(){ analyze(); }}, t("bi_analyze"))
    ),
    // «fiat» no es un fallo: el fichero se leyó bien y sus datos están guardados. Va en caja
    // neutra (no de alarma) para no dar por roto lo que ha funcionado.
    err && React.createElement("div",{className:err==="fiat"?"hint":"alarmbox",style:{marginTop:10}},
      err==="fiat"?t("bi_err_fiat"):(err==="pnl"?t("bi_err_pnl"):t("bi_err"))),
    parsed && React.createElement(React.Fragment,null,
      React.createElement("div",{className:"hint",style:{marginTop:6}}, tf("bi_summary",{n:parsed.positions.length, from:parsed.from||"—", to:parsed.to||"—"})),
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
      React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:mappedN===0,onClick:apply}, tf("bi_apply",{n:mappedN})),
      React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:function(){ setParsed(null); }}, t("fj_cancel")),
      React.createElement("div",{className:"hint"},t("bi_apply_hint"))
    ),
    doneN!=null && React.createElement("div",{className:"hint",style:{color:"var(--mint)",fontWeight:700,marginTop:8}}, tf("bi_done",{n:doneN}))
  );
}

