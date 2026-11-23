/* ============================================================
   PLAN › BARRA DE REPARTO, HOJA «A DÓNDE VA TU SUELDO», DEUDAS Y METAS NUEVAS
   Prototipo aprobado: coord-notas/diseno-deudas-metas/prototipo.html. Las cifras salen del motor
   (`planReparto`, `deudasEscalera`, `metasResumen`, en 17-plan-reparto.js); aquí solo se pinta.
   ============================================================ */
const RPT_COLS={rec:"--s-rec",deu:"--s-deu",met:"--s-met",aho:"--s-aho",gas:"--s-gas",lib:"--s-lib"};
const RPT_I={
  chev:"M6 9.5l6 6 6-6", check:"M5 12.5l4.5 4.5L19 7.5", plus:"M12 5v14M5 12h14", x:"M6 6l12 12M18 6L6 18", back:"M15 5l-7 7 7 7"
};
function rptIcon(k,size,style){
  return React.createElement("svg",{viewBox:"0 0 24 24",width:size||16,height:size||16,fill:"none",stroke:"currentColor",strokeWidth:2.1,strokeLinecap:"round",
    strokeLinejoin:"round","aria-hidden":"true",style:style||undefined},React.createElement("path",{d:RPT_I[k]}));
}
// Céntimos → texto con la moneda de pantalla (y el ojo): sin signo, el signo lo pone la frase.
const rptC=function(c){ return eur(Math.abs(c||0)/100); };
const rptC0=function(c){ return eur0(Math.abs(c||0)/100); };
const rptPl=function(n,uno,muchos){ return n===1?uno:muchos; };
// Mes absoluto (año*12+mes0) → «feb 2027».
function rptMes(abs){
  const s=monthShort(abs%12);
  return (CURLANG==="en"?s:s.toLowerCase())+" "+Math.floor(abs/12);
}
// Y en corto para el pie de cada escalón: «feb 27».
function rptMesCorto(abs){
  const s=monthShort(abs%12);
  return (CURLANG==="en"?s:s.toLowerCase())+" "+String(Math.floor(abs/12)).slice(2);
}
// El estado de la barra y de la hoja: una sola función para las dos, como en el prototipo.
function rptTitular(r){
  const pre=r.siGastasTodo&&r.presupuesto!=null;
  const fr=function(txt){ return pre?t("rpt_si_todo")+txt:txt.charAt(0).toUpperCase()+txt.slice(1); };
  const mv=r.movido>0?tf("rpt_moved",{x:rptC(r.movido)}):"";
  const pasa=r.pasa;
  const inc=pasa?tf("rpt_pasas",{x:rptC(r.pasaC)})+(mv?" · "+mv:" "+t("rpt_de_tu_pres")):(mv||(r.reservaDeudas>0?tf("rpt_res_info",{x:rptC(r.reservaDeudas)}):""));
  const w=pasa?" wrn":"";
  if(r.st==="wait") return {l:t("rpt_libre"),a:"—",cls:"",p:t("rpt_wait")};
  if(r.st==="todo") return {l:t("rpt_todo"),a:"",cls:"ok"+w,p:inc||t("rpt_todo_sub")};
  if(r.st==="cubre") return {l:t("rpt_faltan"),a:rptC(r.falta),cls:"neg",p:fr(t("rpt_cubre"))};
  if(r.st==="nollega") return {l:t("rpt_faltan"),a:rptC(r.falta),cls:"neg bad",p:fr(tf("rpt_nollega",{x:rptC(r.hueco)}))};
  if(r.st==="faltan") return {l:t("rpt_faltan"),a:rptC(r.falta),cls:"neg",p:pre?t("rpt_si_todo_s"):""};
  return {l:r.st==="nobud"?t("rpt_libre_hasta"):t("rpt_libre"),a:rptC(r.libre),cls:w.trim(),p:inc};
}
// La barra apilada: cada trozo con su color, el gasto partido en lo gastado y lo que aún queda de presupuesto.
function RptBarraTrozos({r,grande}){
  if(r.entra==null) return React.createElement("div",{className:"rpt-pb none"+(grande?" lg":""),"aria-hidden":"true"});
  const scale=Math.max(r.entra,r.total), parts=[];
  let x=0;
  const put=function(k,c,bg){ if(c<=0) return; parts.push(React.createElement("i",{key:k,"data-k":k,style:{left:(x/scale*100)+"%",width:"calc("+(c/scale*100)+"% - 2px)",background:bg}})); x+=c; };
  r.trozos.forEach(function(p){
    if(p.k==="gas"){ const s=Math.min(r.gastado,p.c); put("gas",s,"var(--s-gas)"); put("gasl",p.c-s,"color-mix(in srgb,var(--s-gas) 42%,var(--bg))"); }
    else put(p.k,p.c,"var("+RPT_COLS[p.k]+")");
  });
  const corta=r.falta>0&&grande, cut=r.entra/scale*100;
  return React.createElement("div",{className:"rpt-pb"+(grande?" lg":"")+(corta?" short":""),"aria-hidden":"true"},parts,
    corta&&React.createElement("b",{className:"x",style:{left:cut+"%",right:0}}),
    corta&&React.createElement("b",{className:"cut",style:{left:"calc("+cut+"% - 1px)"}}),
    corta&&React.createElement("span",{className:"sl",style:{right:"calc("+(100-cut)+"% + 4px)"}},t("rpt_sueldo")));
}
const RPT_DEPS_REPARTO=function(s){
  return [s.expenses,s.fixed,s.debts,s.goals,s.reservaLog,s.aportaciones,s.budget,s.settings,s.flows,s.oneoffs,s.accounts,s.deleted,s.reciboNo,
    s.bankTx,s.obAbsorbedPending,s.obAbsorbedConfirmed,s._historyOwner,s.cuotaNo,s.cuotaAlias,s.reciboBorrado];
};
function useReparto(state,totals){
  const hoy=totals&&totals.today;
  return useMemo(function(){ return planReparto(state,{saldo:totals&&typeof totals.liquid==="number"?totals.liquid:null}); },
    RPT_DEPS_REPARTO(state).concat([totals&&totals.liquid,hoy,totals&&totals.curMonth]));
}
/* La barra fina de arriba de Plan: el estado en una línea y el reparto en una barra. Tocarla abre la hoja. */
function RptBarra({state,totals,onJump}){
  const r=useReparto(state,totals), [abierta,setAbierta]=useState(false), H=rptTitular(r);
  return React.createElement(React.Fragment,null,
    React.createElement("button",{type:"button",className:"rpt-lb "+H.cls,"data-testid":"plan-reparto-barra","data-st":r.st,
      "aria-label":H.l+(H.a?" "+H.a:"")+". "+t("rpt_ver_reparto"),onClick:function(){ setAbierta(true); }},
      React.createElement("span",{className:"rpt-lb-h"},
        React.createElement("span",{className:"rpt-lb-m"},
          React.createElement("span",{className:"rpt-lb-l"},H.cls.indexOf("ok")===0&&rptIcon("check",15),H.l),
          H.a&&React.createElement("span",{className:"rpt-lb-a"},H.a)),
        r.entra!=null&&React.createElement("span",{className:"rpt-lb-d"},tf("rpt_de",{x:rptC(r.entra)})),
        React.createElement("span",{className:"rpt-lb-c"},rptIcon("chev",16))),
      React.createElement(RptBarraTrozos,{r:r}),
      H.p&&React.createElement("span",{className:"rpt-lb-p"},H.p)),
    abierta&&React.createElement(RptRepartoHoja,{r:r,state:state,onClose:function(){ setAbierta(false); },
      onJump:function(seg){ setAbierta(false); if(onJump) onJump(seg); }}));
}
/* «Tu mes en cifras» (diseño plan-mezcla, orden del dueño 23/11): se abre al tocar la cabecera de Recibos, que
   no cambia de aspecto. Tres cosas distintas y cada una con su fuente: «Queda por pagar» y su reparto por tipo
   (recibos, deudas, gastos, metas, ahorro) salen de `planReparto`; «cubre / no llega» es el saldo de hoy contra
   eso; y «te faltan» (aviso) es que los ingresos del mes no llegan al plan completo. Lo que no se sabe va «—». */
function PlanMesHoja({state,totals,mes,onClose,onBanco}){
  const r=useReparto(state,totals), closer=useRef(null), rootRef=useRef(null);
  const saldo=r.saldo, dif=saldo==null?null:saldo-r.queda;
  // Como en el diseño: mientras la hoja está abierta, la pantalla de detrás ni se enfoca ni se lee.
  useEffect(function(){
    const app=document.getElementById("root"), antes=document.activeElement;
    if(app) app.setAttribute("inert","");
    const hoja=rootRef.current&&rootRef.current.closest(".v4-sheet"), x=hoja&&hoja.querySelector(".rpt-sx");
    if(x) x.focus({preventScroll:true});
    const key=function(e){ if(e.key==="Escape"&&closer.current){ e.stopPropagation(); closer.current(); } };
    document.addEventListener("keydown",key);
    return function(){
      document.removeEventListener("keydown",key);
      if(app) app.removeAttribute("inert");
      if(antes&&antes.focus&&document.contains(antes)) antes.focus({preventScroll:true});
    };
  },[]);
  const trozos=[["rec",r.qRec,"rpt_rec"],["deu",r.qDeu,"rpt_deu"],["gas",r.qGas,"rpt_gas"],["met",r.qMet,"rpt_met"],["aho",r.qAho,"rpt_aho"]].filter(function(x){ return x[1]>0; });
  const estado=r.queda<=0?t("pm_nada"):dif==null?"":dif>=0?t("pm_cubre"):t("pm_nollega");
  return React.createElement(RptHoja,{title:t("pm_title"),onClose:onClose,closer:closer,testid:"plan-mes-hoja"},
    React.createElement("div",{ref:rootRef,className:"pm-body"},
      React.createElement("div",{className:"v4-micro"},tf("v4_plan_left",{month:mes})),
      React.createElement("div",{className:"serif num pm-big","data-testid":"plan-mes-queda"},rptC(r.queda)),
      estado&&React.createElement("div",{className:"pm-est"+(dif!=null&&dif<0&&r.queda>0?" bad":""),"data-testid":"plan-mes-estado"},estado),
      React.createElement("div",{className:"rpt-sg"},
        rptKv(t("pm_saldo"),saldo==null?"—":rptC(saldo),"saldo"),
        rptKv(dif!=null&&dif<0?t("pm_faltan"):t("pm_sobran"),dif==null?"—":rptC(dif),"dif")),
      r.falta>0&&React.createElement("div",{className:"pm-aviso",role:"note","data-testid":"plan-mes-aviso"},tf("pm_aviso",{x:rptC(r.falta)})),
      trozos.length>0&&React.createElement("div",{className:"rpt-sg"},
        React.createElement("div",{className:"pm-sub"},t("pm_donde")),
        React.createElement("div",{className:"rpt-pb lg",style:{display:"flex"},"aria-hidden":"true"},trozos.map(function(x,i){
          return React.createElement("i",{key:x[0],style:{position:"static",flex:x[1],background:"var("+RPT_COLS[x[0]]+")",marginRight:i<trozos.length-1?2:0}});
        })),
        trozos.map(function(x){
          return React.createElement("div",{className:"rpt-kv","data-k":x[0],key:x[0]},
            React.createElement("span",null,React.createElement("i",{className:"rpt-sw",style:{background:"var("+RPT_COLS[x[0]]+")"}}),t(x[2])),
            React.createElement("b",null,rptC(x[1])));
        })),
      onBanco&&React.createElement("button",{type:"button",className:"pm-banco","data-testid":"plan-mes-banco",onClick:onBanco},t("pm_banco"),rptIcon("chev",16,{transform:"rotate(-90deg)"}))));
}
/* La cabecera de Recibos como botón: mismo dibujo de siempre (etiqueta, cifra, cuenta) y una flecha pequeña que
   dice que se abre. El aviso «te faltan X» vive DENTRO de la hoja (orden del dueño 23/11): cerrada, solo un
   puntito en la flecha para que no quede escondido. */
function PlanMesTap({state,totals,onOpen,children}){
  const r=useReparto(state,totals), aviso=r.falta>0;
  return React.createElement("button",{type:"button",className:"pr6-sum-tap","data-testid":"plan-cifras","data-aviso":aviso?"1":"0","aria-haspopup":"dialog",
    "aria-label":t("pm_ver")+(aviso?". "+tf("pm_aviso",{x:rptC(r.falta)}):""),onClick:onOpen},
    children,
    React.createElement("span",{className:"pr6-sum-go","aria-hidden":"true"},rptIcon("chev",16),aviso&&React.createElement("i",{className:"pr6-sum-dot","data-testid":"plan-cifras-punto"})));
}
/* Hoja genérica de esta pantalla: asa, título con cerrar, cuerpo con scroll y pie fijo opcional. */
function RptHoja({title,icono,onClose,back,onBack,children,foot,closer,testid}){
  const swipe=useSheetSwipe(true,onClose); useBackClose(true,swipe.close);
  if(closer) closer.current=swipe.close;
  return ReactDOM.createPortal(React.createElement("div",{className:"v4-sheet-back",onClick:swipe.close},
    React.createElement("div",Object.assign({className:"v4-sheet rpt-sheet",role:"dialog","aria-modal":true,"aria-label":title,"data-testid":testid||undefined,
      ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("div",{className:"v4-sheet-body rpt-sb"},
        React.createElement("div",{className:"rpt-sh"},
          back&&React.createElement("button",{type:"button",className:"rpt-sback","aria-label":t("rpt_volver"),onClick:onBack},rptIcon("back",20)),
          icono||null,
          React.createElement("div",{className:"rpt-st"},title),
          React.createElement("button",{type:"button",className:"rpt-sx","aria-label":t("gl_cancel"),onClick:swipe.close},rptIcon("x",20))),
        children),
      foot&&React.createElement("div",{className:"rpt-sf"},foot))),document.body);
}
const rptKv=function(k,v,key){ return v==null?null:React.createElement("div",{className:"rpt-kv",key:key||k},React.createElement("span",null,k),React.createElement("b",null,v)); };
function RptRepartoHoja({r,state,onClose,onJump}){
  const [vista,setVista]=useState("reparto"), H=rptTitular(r);
  const subDe=function(k){
    if(k==="rec") return rptPl(r.nRec,t("rpt_n_rec_1"),tf("rpt_n_rec",{n:r.nRec}));
    if(k==="deu") return rptPl(r.nDeu,t("rpt_n_cuotas_1"),tf("rpt_n_cuotas",{n:r.nDeu}));
    if(k==="met") return tf("rpt_n_ritmo",{n:r.nMet});
    if(k==="aho") return t("rpt_plan_mensual");
    if(k==="gas") return r.sinPresupuesto?t("rpt_gastado_hasta_hoy"):r.gastado>r.presupuesto?tf("rpt_sobre_pres",{x:rptC(r.gastado-r.presupuesto)}):tf("rpt_de_x",{a:rptC(r.gastado),b:rptC(r.presupuesto)});
    return t("rpt_sin_asignar");
  };
  const nombre={rec:t("rpt_rec"),deu:t("rpt_deu"),met:t("rpt_met"),aho:t("rpt_aho"),gas:t("rpt_gas"),lib:r.sinPresupuesto?t("rpt_libre_hasta"):t("rpt_libre")};
  const fila=function(x){
    const enlace=x.k!=="lib", p=x.p==null?"—":x.p;
    return React.createElement(enlace?"button":"div",{key:x.k,type:enlace?"button":undefined,className:"rpt-row","data-k":x.k,"data-p":x.p==null?"":x.p,
      onClick:enlace?function(){ if(x.k==="aho"||x.k==="gas") setVista(x.k); else onJump(x.k==="rec"?"recibos":x.k==="deu"?"deudas":"metas"); }:undefined},
      React.createElement("span",{className:"rpt-l"},React.createElement("div",{className:"rpt-d"},p),React.createElement("div",{className:"rpt-m"},x.p==null?" ":"%")),
      React.createElement("span",{className:"rpt-nm"},React.createElement("i",{className:"rpt-sw",style:{background:"var("+RPT_COLS[x.k]+")"}}),nombre[x.k]),
      React.createElement("span",{className:"rpt-sub"},subDe(x.k)),
      React.createElement("span",{className:"rpt-am"},rptC(x.c)));
  };
  if(vista==="gas"){
    return React.createElement(RptHoja,{title:t("rpt_gas"),onClose:onClose,back:true,onBack:function(){ setVista("reparto"); },testid:"plan-reparto-detalle"},
      React.createElement("div",{className:"rpt-sg"},rptKv(t("rpt_gastado"),rptC(r.gastado)),
        r.presupuesto==null?null:rptKv(t("rpt_presupuesto"),rptC(r.presupuesto)),
        r.presupuesto==null?null:rptKv(r.gastado>r.presupuesto?t("rpt_de_mas"):t("rpt_quedan"),rptC(Math.abs(r.presupuesto-r.gastado)))));
  }
  if(vista==="aho"){
    const aps=(state.aportaciones||[]).filter(function(a){ return a&&Number(a.amount)>0; });
    return React.createElement(RptHoja,{title:t("rpt_aho"),onClose:onClose,back:true,onBack:function(){ setVista("reparto"); },testid:"plan-reparto-detalle"},
      React.createElement("div",{className:"rpt-sg"},aps.map(function(a){ return rptKv(a.name||t("d_saving"),rptC(Math.round(Number(a.amount)*100)),a.id); }),
        rptKv(t("rpt_invertido"),rptC(r.inversion))));
  }
  return React.createElement(RptHoja,{title:t("rpt_sheet_title"),onClose:onClose,testid:"plan-reparto-hoja"},
    React.createElement("div",{className:"rpt-rph "+H.cls},
      React.createElement("div",{className:"rpt-hs",style:{fontSize:13,marginTop:8}},H.cls.indexOf("ok")===0?React.createElement("span",{style:{color:"var(--mint-ink,var(--mint))",fontWeight:800}},H.l):H.l),
      H.a&&React.createElement("div",{className:"rpt-big","data-testid":"plan-reparto-cifra"},H.a),
      H.p&&React.createElement("div",{className:"rpt-rp"},H.p),
      React.createElement("div",{className:"rpt-hs"},t("rpt_entran")+" ",React.createElement("b",{"data-testid":"plan-reparto-entra"},r.entra==null?"—":rptC(r.entra))),
      r.traspaso>0&&React.createElement("div",{className:"rpt-own"},React.createElement("span",null,t("rpt_traspaso")),React.createElement("s",null,rptC(r.traspaso)))),
    React.createElement(RptBarraTrozos,{r:r,grande:true}),
    React.createElement("div",{className:"rpt-list",style:{marginTop:10}},r.trozos.map(fila),
      r.falta>0&&React.createElement("div",{className:"rpt-row","data-k":"short","data-p":r.faltaP},
        React.createElement("span",{className:"rpt-l"},React.createElement("div",{className:"rpt-d"},r.faltaP),React.createElement("div",{className:"rpt-m"},"%")),
        React.createElement("span",{className:"rpt-nm"},React.createElement("i",{className:"rpt-sw ov"}),t("rpt_faltan")),
        React.createElement("span",{className:"rpt-sub"},t("rpt_sobre_entra")),
        React.createElement("span",{className:"rpt-am",style:{color:"var(--coral)"}},rptC(r.falta)))),
    r.falta>0&&React.createElement("div",{className:"rpt-sg","data-queda":"1"},
      rptKv(t("rpt_q_rec"),rptC(r.qRec)),rptKv(t("rpt_q_deu"),rptC(r.qDeu)),rptKv(t("rpt_q_gas"),rptC(r.qGas)),
      rptKv(t("rpt_q_mov"),rptC(r.qMet+r.qAho)),rptKv(t("rpt_q_total"),rptC(r.queda)),rptKv(t("rpt_q_saldo"),r.saldo==null?"—":rptC(r.saldo))));
}

/* ---------------- Interruptor «Restar del presupuesto» (ficha de una deuda) ---------------- */
// Cuánto cambia el reparto al encender o apagar ESTA deuda; las demás se quedan como están.
function rptRestarNums(state,d){
  const con=function(on){ return Object.assign({},state,{debts:(state.debts||[]).map(function(x){
    if(x.id!==d.id) return x;
    const y=Object.assign({},x); if(on) y.restarPres=true; else delete y.restarPres;
    return y; })}); };
  const off=planReparto(con(false),{}), on=planReparto(con(true),{}), enc=d.restarPres===true;
  const mover=Math.max(0,off.gas-on.gas);
  const parte=Math.max(0,(on.presupuestoRaw==null?0:on.presupuestoRaw));
  const antes=off.presupuestoRaw==null?0:off.presupuestoRaw-off.gastado, despues=on.presupuestoRaw==null?0:on.presupuestoRaw-on.gastado;
  const q=on.reservaDeudas-off.reservaDeudas;
  return {sinPresupuesto:off.sinPresupuesto,
    p:enc?rptC(Math.max(0,despues)):rptC(Math.max(0,antes))+" → "+rptC(Math.max(0,despues)),
    m:mover>0?tf("rpt_moved",{x:rptC(mover)}):tf("rpt_salen",{x:rptC(q)}),
    w:despues<0?(enc?t("rpt_te_pasas"):t("rpt_te_pasarias"))+" "+rptC(-despues):"", parte:parte};
}
function RptRestar({state,set,d,cuota}){
  const n=rptRestarNums(state,d), enc=d.restarPres===true;
  if(n.sinPresupuesto) return React.createElement("div",{className:"rpt-rsv"},React.createElement("span",{className:"rpt-rsv-t"},t("rpt_resta_t")),React.createElement("span",{className:"rpt-rsv-s"},t("rpt_sin_pres")));
  const cambia=function(){
    set(function(s){ return Object.assign({},s,{debts:(s.debts||[]).map(function(x){
      if(x.id!==d.id) return x;
      const y=Object.assign({},x); if(enc) delete y.restarPres; else y.restarPres=true;
      return y; })}); });
  };
  return React.createElement("div",{className:"rpt-rsv","data-rsv":d.id},
    React.createElement("button",{type:"button",className:"rpt-rsv-h",role:"switch","aria-checked":enc,"data-act":"restar-presupuesto",onClick:cambia},
      React.createElement("span",null,React.createElement("span",{className:"rpt-rsv-t"},t("rpt_resta_t")),React.createElement("span",{className:"rpt-rsv-s"},tf("rpt_resta_s",{x:rptC(cuota)}))),
      React.createElement("span",{className:"rpt-swt"})),
    React.createElement("div",{className:"rpt-pvg"},React.createElement("span",null,t("rpt_para_gastar")),React.createElement("b",{"data-pv":"p"},n.p)),
    React.createElement("div",{className:"rpt-pvm","data-pv":"m"},n.m),
    n.w&&React.createElement("div",{className:"rpt-pvw","data-pv":"w"},n.w));
}

/* ---------------- Escalera de cuotas ---------------- */
function RptEscalera({state,d}){
  const [sel,setSel]=useState(null);
  const e=useMemo(function(){ return deudasEscalera(state); },[state.debts,state.fixed,state.expenses,state.deleted,state.accounts]);
  const i=e.pasos.findIndex(function(x){ return x.id===d.id; });
  if(i<0) return null;
  const pasos=[{k:"hoy",v:e.hoy}].concat(e.pasos.map(function(x){ return {k:x.id,v:x.v,ultimo:x.ultimo,desde:x.desde,final:x.final,c:x.c}; }));
  const idx=i+1, show=idx>4?pasos.slice(0,4).concat([pasos[idx]]):pasos.slice(0,5);
  const max=Math.max.apply(null,show.map(function(x){ return x.v; }).concat([1]));
  const nombreDe=function(id){ const dd=(state.debts||[]).find(function(x){ return x.id===id; }); return dd?dd.name:""; };
  const cap=function(x){
    if(x.k==="hoy") return tf("rpt_esc_hoy",{x:rptC0(x.v)});
    return tf("rpt_esc_desde",{m:rptMes(x.desde),name:nombreDe(x.k),x:rptC0(x.c)})+(x.final>0?" · "+tf("rpt_esc_final",{x:rptC0(x.final),m:rptMes(x.ultimo)}):"");
  };
  const act=sel!=null&&show[sel]?sel:show.findIndex(function(x){ return x===pasos[idx]; });
  return React.createElement("div",{className:"rpt-sg","data-stair":d.id},
    React.createElement("div",{className:"rpt-stairs",role:"group","aria-label":t("rpt_esc_aria"),style:{gridTemplateColumns:"repeat("+show.length+",minmax(0,1fr))"}},
      show.map(function(x,n){
        return React.createElement("button",{key:x.k,type:"button",className:"rpt-stp","aria-pressed":n===act,"aria-label":cap(x),"data-cap":cap(x),onClick:function(){ setSel(n); }},
          x.final>0&&React.createElement("span",{className:"rpt-fin"},"+"+Math.round(x.final/100).toLocaleString(CURLANG==="en"?"en-GB":"es-ES")),
          React.createElement("em",null,Math.round(x.v/100).toLocaleString(CURLANG==="en"?"en-GB":"es-ES")),
          React.createElement("i",{style:{height:Math.max(3,x.v/max*44)+"px"}}),
          React.createElement("small",null,x.k==="hoy"?t("rpt_hoy"):rptMesCorto(x.desde)));
      })),
    React.createElement("div",{className:"rpt-stc","aria-live":"polite"},cap(show[act]||show[0])));
}

/* ---------------- Deudas: lista y ficha ---------------- */
function rptFinTexto(finAbs,n){
  if(finAbs==null) return "";
  return n===1?tf("rpt_d_ultima",{m:rptMes(finAbs)}):n!=null&&n<=3?tf("rpt_d_quedan",{n:n,m:rptMes(finAbs)}):tf("rpt_d_acaba",{m:rptMes(finAbs)});
}
function RptFila({id,l,nombre,punto,sub,subCls,subTest,am,amCls,onClick,attrs}){
  return React.createElement("button",Object.assign({type:"button",className:"rpt-row","aria-label":nombre,onClick:onClick},attrs||{}),
    React.createElement("span",{className:"rpt-l"},l),
    React.createElement("span",{className:"rpt-nm"},nombre,punto||null),
    React.createElement("span",{className:"rpt-sub "+(subCls||""),"data-testid":subTest||undefined},sub),
    React.createElement("span",{className:"rpt-am "+(amCls||"")},am));
}
const rptDia=function(d,m){ return [React.createElement("div",{className:"rpt-d",key:"d"},d),React.createElement("div",{className:"rpt-m",key:"m"},m)]; };
/* El icono sale del nombre (no lo elige nadie), con el trazo de la barra de abajo en vez de emojis de colores:
   cada móvil los pinta distinto y desentonaban (auditoría 15/11, DIS-27). */
function rptDebtIco(name){
  const k=debtIcoKind(name);
  return React.createElement("span",{className:"rpt-dico"},React.createElement("svg",{viewBox:"0 0 24 24",width:22,height:22,fill:"none",stroke:"currentColor",strokeWidth:2.1,strokeLinecap:"round",
    strokeLinejoin:"round","aria-hidden":"true","data-ico":k},DEBT_ICO[k].map(function(e,i){ return React.createElement(e[0],Object.assign({key:i},e[1])); })));
}
/* Ficha de una deuda: lo que debes, el interruptor, la escalera y los datos; amortizar, editar y eliminar al pie. */
function RptDeudaFicha({d,state,set,r,h,onClose}){
  const bal=debtBalance(d), orig=d.original||bal, paid=Math.max(0,orig-bal), pct=Math.min(100,orig>0?paid/orig*100:0);
  const li=debtLeftInfo(d), hoy=madridYmdParts(Date.now());
  const fila=r.deudas.find(function(x){ return x.id===d.id; }), cuota=fila?fila.c:repCts(d.monthly);
  const e=useMemo(function(){ return deudasEscalera(state); },[state.debts,state.fixed,state.expenses,state.deleted]);
  const paso=e.pasos.find(function(x){ return x.id===d.id; });
  const day=cleanDay(dayOf(d)), desc=d.monthly>0?deudaDescuentoMes(state,d,hoy.y,hoy.m,hoy.d):null;
  const [datos,setDatos]=useState(false);
  const viva=bal>0.005;
  const cierra=useRef(null);
  const pie=viva
    ?[React.createElement("button",{key:"a",type:"button",className:"rpt-btn pri wide","data-act":"ficha-amortizar",onClick:function(){ h.amortizar(d,function(){ if(cierra.current) cierra.current(); }); }},t("db_amortize")),
      React.createElement("button",{key:"e",type:"button",className:"rpt-btn","data-act":"ficha-editar",onClick:function(){ onClose(); h.editar(d); }},t("fj_edit")),
      React.createElement("button",{key:"x",type:"button",className:"rpt-btn del","data-act":"ficha-eliminar",onClick:function(){ onClose(); h.eliminar(d); }},t("rpt_eliminar"))]
    :[React.createElement("button",{key:"a",type:"button",className:"rpt-btn pri wide","data-act":"ficha-cerrar-deuda",onClick:function(){ if(d.settledAt) h.archivar(d); else h.liquidada(d); onClose(); }},t(d.settledAt?"db_archive":"db_settle_ok")),
      React.createElement("button",{key:"e",type:"button",className:"rpt-btn","data-act":"ficha-editar",onClick:function(){ onClose(); h.editar(d); }},t("fj_edit")),
      React.createElement("button",{key:"x",type:"button",className:"rpt-btn del","data-act":"ficha-eliminar",onClick:function(){ onClose(); h.eliminar(d); }},t("rpt_eliminar"))];
  return React.createElement(RptHoja,{title:d.name,icono:rptDebtIco(d.name),onClose:onClose,closer:cierra,foot:pie,testid:"plan-deuda-ficha"},
    React.createElement("div",{className:"rpt-big","data-testid":"ficha-saldo",style:{marginTop:8}},eur(bal)),
    viva&&React.createElement("div",{className:"rpt-hs"},tf("rpt_d_amortizado",{p:Math.round(pct)})),
    viva&&React.createElement("div",{className:"rpt-bar"},React.createElement("i",{style:{width:pct+"%"}})),
    !viva&&React.createElement("div",{className:"rpt-hs"},t(d.settledAt?"db_settled":"db_est_zero")),
    viva&&React.createElement(RptRestar,{state:state,set:set,d:d,cuota:cuota}),
    viva&&React.createElement(RptEscalera,{state:state,d:d}),
    viva&&day==null&&React.createElement("div",{className:"rpt-kv",style:{marginTop:10}},React.createElement("span",null,t("rpt_d_dia_cobro")),
      React.createElement("button",{type:"button",className:"rpt-link",style:{minHeight:44,padding:8,margin:"-10px -8px"},"data-act":"ficha-poner-dia",onClick:function(){ onClose(); h.ponerDia(d); }},t("rpt_d_poner_dia"))),
    desc&&desc.amt>0&&React.createElement("div",{className:"rpt-hs","data-testid":"debt-descuento"},tf("pr6_pagas_mas",{a:eur(d.monthly),b:eur(desc.amt),from:desc.from.join(", ")})),
    descuentoDescuadreGuardado(state,d)&&React.createElement("button",{type:"button",className:"chip","data-act":"debt-descuadre",style:{alignSelf:"flex-start",marginTop:6},
      onClick:function(){ descuentoAjustarGuardado(state,set,d); }},t("rp6_no_cuadra")),
    (d.balloon>0||d.downPayment>0)&&React.createElement("div",{className:"rpt-hs",style:{color:"var(--tan)"}},
      d.balloon>0?tf("db_balloon_line",{x:eur0(d.balloon)}):"",d.downPayment>0?(d.balloon>0?" · ":"")+tf("db_down_line",{x:eur0(d.downPayment)}):""),
    viva&&React.createElement("button",{type:"button",className:"rpt-door dat","aria-expanded":datos,onClick:function(){ setDatos(!datos); }},
      React.createElement("span",null,t("rpt_datos")),React.createElement("span",{className:"rpt-chev"},rptIcon("chev",16))),
    viva&&React.createElement("div",{className:"rpt-fold"+(datos?" open":"")},React.createElement("div",{inert:datos?undefined:""},
      rptKv(t("rpt_d_cuota"),eur(d.monthly||0)),day==null?null:rptKv(t("rpt_d_dia_cobro"),String(day)),
      li?rptKv(t("rpt_d_cuotas"),tf("rpt_d_n_de",{n:li.n,tot:li.tot})):null,paso?rptKv(t("rpt_d_acaba_k"),rptMes(paso.ultimo)):null,
      d.balloon>0?rptKv(t("rpt_d_pago_final"),eur(d.balloon)):null,
      rptKv(t("rpt_d_interes"),d.apr>0?String(d.apr).replace(".",",")+" %":t("rpt_d_sin_interes")),
      rptKv(t("plan_conflict_account"),entOf(d.account||"sabadell").label))));
}
/* La lista de Deudas: cabecera «Este mes pagas», por pagar, ya pagado, terminadas y sin cuota este mes. */
function RptDeudasVista({state,r,visibles,archivadas,h,total,showArchive,setShowArchive}){
  const hoy=madridYmdParts(Date.now());
  const esc=useMemo(function(){ return deudasEscalera(state); },[state.debts,state.fixed,state.expenses,state.deleted]);
  const finDe=function(id){ const p=esc.pasos.find(function(x){ return x.id===id; }); return p?p.ultimo:null; };
  const porId={}; r.deudas.forEach(function(x){ porId[x.id]=x; });
  const vivas=visibles.filter(function(d){ return debtBalance(d)>0.005; }), cero=visibles.filter(function(d){ return debtBalance(d)<=0.005; });
  const enPeriodo=vivas.filter(function(d){ return porId[d.id]; }), otras=vivas.filter(function(d){ return !porId[d.id]; });
  const tot=r.deudas.reduce(function(a,x){ return a+x.c+x.finalC; },0), pag=r.deudas.reduce(function(a,x){ return a+(x.pagada?x.c+x.finalC:0); },0);
  const pend=enPeriodo.filter(function(d){ return !porId[d.id].pagada; }).sort(function(a,b){ const x=cleanDay(dayOf(a)),y=cleanDay(dayOf(b)); return (x==null?99:x)-(y==null?99:y); });
  const hechas=enPeriodo.filter(function(d){ return porId[d.id].pagada; });
  const pri=esc.pasos[0], priDeuda=pri&&(state.debts||[]).find(function(x){ return x.id===pri.id; });
  const fila=function(d,tipo){
    const day=cleanDay(dayOf(d)), li=debtLeftInfo(d), fin=finDe(d.id), x=porId[d.id];
    const desc=d.monthly>0?deudaDescuentoMes(state,d,hoy.y,hoy.m,hoy.d):null;
    let sub, subCls="", subTest, l, amCls=tipo==="hecha"?"q":"";
    if(day==null&&tipo!=="otra"&&tipo!=="cero"){ sub=t("rpt_d_falta_dia"); subCls="go"; }
    else if(desc&&desc.amt>0){ sub=tf("pr6_pagas_mas",{a:eur(d.monthly),b:eur(desc.amt),from:desc.from.join(", ")}); subTest="debt-descuento"; }
    else if(tipo==="cero") sub=t(d.settledAt?"db_settled":"db_est_zero");
    else sub=tipo==="hecha"?(day?tf("rpt_d_dia_acaba",{d:day,m:fin!=null?rptMes(fin):"—"}):rptFinTexto(fin,li&&li.n)):(fin!=null?rptFinTexto(fin,li&&li.n):(li?tf("db_left_count",{n:li.n,tot:li.tot}):""));
    if(tipo==="hecha") l=React.createElement("div",{style:{display:"grid",placeItems:"center",color:"var(--mint-ink,var(--mint))"}},rptIcon("check",22));
    else l=rptDia(day==null?"—":String(day).padStart(2,"0"),day==null?t("rpt_d_dia"):monthShort(hoy.m-1).toLowerCase());
    const importe=x?x.c:repCts(d.monthly);
    return React.createElement(RptFila,{key:d.id,nombre:d.name,punto:React.createElement(PlanConflictDot,{record:planSyncConflict(state,"debts",d.id)}),l:l,sub:sub,subCls:subCls,subTest:subTest,am:rptC(importe),amCls:amCls,onClick:function(){ h.abrir(d); },attrs:{"data-debt-id":d.id,"data-act":"debt-open"}});
  };
  const seccion=function(titulo,lista,tipo,id){ return lista.length>0&&React.createElement("section",{className:"rpt-sec","data-sec":id,key:id},
    React.createElement("div",{className:"rpt-sech"},React.createElement("span",null,titulo)),React.createElement("div",{className:"rpt-list"},lista.map(function(d){ return fila(d,tipo); }))); };
  return React.createElement("div",{className:"rpt"},
    React.createElement("section",{className:"rpt-hero","data-testid":"debts-summary"},
      React.createElement("div",{className:"rpt-ht"},t("rpt_d_hero")),
      React.createElement("div",{className:"rpt-big plan-summary-amount"},rptC(tot)),
      React.createElement("div",{className:"rpt-hs"},tf("rpt_d_sub",{a:rptC(pag),b:rptC(tot-pag)})),
      React.createElement("div",{className:"rpt-dl"},
        React.createElement("span",null,t("rpt_d_debes")+" ",React.createElement("b",null,eur0(total))),
        priDeuda&&React.createElement("button",{type:"button",onClick:function(){ h.abrir(priDeuda); },"aria-label":t("rpt_d_acaba_antes")+": "+priDeuda.name},
          t("rpt_d_acaba_antes")+" ",React.createElement("b",null,priDeuda.name),(" · "+rptMes(pri.ultimo))))),
    seccion(t("rpt_d_por_pagar"),pend,"pend","pend"),
    seccion(t("rpt_d_pagado"),hechas,"hecha","hechas"),
    seccion(t("rpt_d_sin_cuota"),otras,"otra","otras"),
    seccion(t("rpt_d_terminadas"),cero,"cero","cero"));
}

/* ---------------- Metas: lista y ficha ---------------- */
/* La previsión de siempre (`goalEta`) trae un círculo de color en el texto; aquí el estado lo da el punto de la fila,
   así que se quita para no pintarlo dos veces. */
function rptSinPunto(texto){
  return Array.from(String(texto||"")).filter(function(ch){ const c=ch.codePointAt(0); return !(c>=0x1F7E0&&c<=0x1F7EB||c===0x1F534||c===0x1F535); })
    .join("").replace(/ +/g," ").replace(/ +·/g," ·").trim();
}
function RptMetaNivel({g,gv}){
  const pct=goalPct(gv);
  if(g.done||pct>=100) return React.createElement("div",{className:"rpt-lvl full"},rptIcon("check",22));
  if(!(gv.saved>0)) return React.createElement("div",{className:"rpt-lvl empty"},rptIcon("plus",18));
  return React.createElement("div",{className:"rpt-lvl"},React.createElement("i",{style:{height:pct+"%"}}),React.createElement("span",null,Math.round(pct)+"%"));
}
function RptMetaFicha({g,state,h,onClose}){
  const gv=metaConAportes(g,state), pct=goalPct(gv), ritmo=metaRitmoReglas(state,g), eta=goalEta(gv,metaRitmoMensual(state,g)), rem=goalRemaining(gv);
  const cierra=useRef(null);
  const pie=[!g.done&&rem>0&&React.createElement("button",{key:"a",type:"button",className:"rpt-btn pri wide","data-act":"ficha-aportar",onClick:function(){ onClose(); h.aportar(g); }},t("gl_contribute")),
    React.createElement("button",{key:"e",type:"button",className:"rpt-btn","data-act":"ficha-editar",onClick:function(){ onClose(); h.editar(g); }},t("fj_edit")),
    React.createElement("button",{key:"x",type:"button",className:"rpt-btn del","data-act":"ficha-eliminar",onClick:function(){ onClose(); h.eliminar(g); }},t("rpt_eliminar"))];
  return React.createElement(RptHoja,{title:(g.emoji||"🎯")+" "+g.name,onClose:onClose,closer:cierra,foot:pie,testid:"plan-meta-ficha"},
    React.createElement("div",{className:"rpt-big","data-testid":"goal-saved",style:{marginTop:8}},eur0(gv.saved||0)),
    React.createElement("div",{className:"rpt-hs"},eur0(g.target||0)!==""?tf("rpt_m_de",{x:eur0(g.target||0),p:Math.round(pct)}):""),
    React.createElement("div",{className:"rpt-bar"},React.createElement("i",{style:{width:pct+"%"}})),
    React.createElement("div",{className:"rpt-sg"},
      rptKv(t("rpt_m_estado"),rptSinPunto(eta.text)||t("rpt_m_sin_prevision")),
      rem>0?rptKv(t("rpt_m_faltan"),eur0(rem)):null,
      rptKv(t("rpt_m_al_mes"),ritmo>0?eur0(ritmo):t("rpt_m_sin_ritmo")),
      rptKv(t("rpt_m_fecha"),g.deadline?monthLong(+g.deadline.slice(5,7)-1)+" "+g.deadline.slice(0,4):t("rpt_m_sin_fecha")),
      gv.aportado>0?React.createElement("div",{className:"rpt-kv",key:"gx","data-testid":"goal-from-gastos"},React.createElement("span",null,t("rpt_m_desde_gastos")),React.createElement("b",null,eur(gv.aportado))):null,
      g.fromBank?rptKv(t("rpt_m_banco"),entOf(g.fromBank).label):null));
}
function RptMetasVista({state,goals,h}){
  const res=useMemo(function(){ return metasResumen(state); },[state.goals,state.expenses,state.deleted,state.settings,state.reservaLog]);
  const abiertas=goals.filter(function(g){ return !g.done&&goalPct(metaConAportes(g,state))<100; }), hechas=goals.filter(function(g){ return abiertas.indexOf(g)<0; });
  const fila=function(g){
    const gv=metaConAportes(g,state), eta=goalEta(gv,metaRitmoMensual(state,g));
    const dot=eta.cls==="warn"?React.createElement("i",{className:"rpt-dot",key:"p"}):eta.cls==="ok"?React.createElement("i",{className:"rpt-dot ok",key:"p"}):null;
    return React.createElement(RptFila,{key:g.id,nombre:g.name,l:React.createElement(RptMetaNivel,{g:g,gv:gv}),sub:[dot,rptSinPunto(eta.text)||tf("rpt_m_de_solo",{x:eur0(g.target||0)})],
      am:gv.saved>0?eur0(gv.saved):eur0(g.target||0),amCls:gv.saved>0?"":"q",onClick:function(){ h.abrir(g); },attrs:{"data-goal-id":g.id,"data-act":"goal-open"}});
  };
  const sv=res.ahorrado, tg=res.objetivo;
  const f2=res.hueco>0?[t("rpt_m_a_tiempo_falta"),"+"+rptC0(res.hueco)+t("rpt_m_mes")]:res.vencidas>0?[t("rpt_m_fecha_pasada"),rptPl(res.vencidas,t("rpt_m_n_metas_1"),tf("rpt_m_n_metas",{n:res.vencidas}))]:res.conFecha>0?[t("rpt_m_a_tiempo"),t("rpt_m_todas")]:[t("rpt_m_fecha"),t("rpt_m_sin_fecha")];
  return React.createElement("div",{className:"rpt"},
    React.createElement("section",{className:"rpt-hero","data-testid":"goals-summary"},
      React.createElement("div",{className:"rpt-ht"},t("v4_goals_hero")),
      React.createElement("div",{className:"rpt-big plan-summary-amount"},rptC0(sv)),
      React.createElement("div",{className:"rpt-hs"},tf("rpt_m_de_total",{x:rptC0(tg)})),
      React.createElement("div",{className:"rpt-facts m"},
        React.createElement("div",{className:"rpt-fact"},React.createElement("span",null,t("rpt_m_apartas")),React.createElement("b",{className:"serif"},rptC0(res.ritmo)+t("rpt_m_mes"))),
        React.createElement("div",{className:"rpt-fact"+(res.hueco>0||res.vencidas>0?" warn":res.conFecha>0?" ok":"")},React.createElement("span",null,f2[0]),React.createElement("b",{className:"serif"},f2[1])))),
    abiertas.length>0&&React.createElement("section",{className:"rpt-sec"},React.createElement("div",{className:"rpt-sech"},React.createElement("span",null,t("rpt_m_en_marcha"))),React.createElement("div",{className:"rpt-list"},abiertas.map(fila))),
    hechas.length>0&&React.createElement("section",{className:"rpt-sec"},React.createElement("div",{className:"rpt-sech"},React.createElement("span",null,t("rpt_m_conseguidas"))),React.createElement("div",{className:"rpt-list"},hechas.map(fila))));
}
