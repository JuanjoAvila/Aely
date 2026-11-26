/* ============================================================
   PLAN › BARRA DE REPARTO, HOJA «A DÓNDE VA TU SUELDO», DEUDAS Y METAS NUEVAS
   Prototipo aprobado: coord-notas/diseno-deudas-metas/prototipo.html. Las cifras salen del motor
   (`planReparto`, `deudasEscalera`, `metasResumen`, en 17-plan-reparto.js); aquí solo se pinta.
   ============================================================ */
const RPT_COLS={rec:"--s-rec",deu:"--s-deu",met:"--s-met",aho:"--s-aho",gas:"--s-gas",lib:"--s-lib"};
const RPT_I={
  chev:"M6 9.5l6 6 6-6", chevr:"M9 6l6 6-6 6", check:"M5 12.5l4.5 4.5L19 7.5", plus:"M12 5v14M5 12h14", x:"M6 6l12 12M18 6L6 18", back:"M15 5l-7 7 7 7"
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
const RPT_DEPS_REPARTO=function(s){
  return [s.expenses,s.fixed,s.debts,s.goals,s.reservaLog,s.aportaciones,s.budget,s.settings,s.flows,s.oneoffs,s.accounts,s.deleted,s.reciboNo,
    s.bankTx,s.obAbsorbedPending,s.obAbsorbedConfirmed,s._historyOwner,s.cuotaNo,s.cuotaAlias,s.reciboBorrado];
};
function useReparto(state,totals){
  const hoy=totals&&totals.today;
  return useMemo(function(){ return planReparto(state,{saldo:totals&&typeof totals.liquid==="number"?totals.liquid:null}); },
    RPT_DEPS_REPARTO(state).concat([totals&&totals.liquid,hoy,totals&&totals.curMonth]));
}
/* Plan ya no lleva la fila «Libre · Entran» arriba (orden del dueño 24/11): el reparto y su frase viven en la hoja «A dónde va tu
   sueldo», que se abre desde la tarjeta de Recibos (ver `PlanMesTap`). Este componente solo la monta y le da su `openRef`. */
function RptBarra({state,set,showToast,totals,onJump,openRef}){
  const r=useReparto(state,totals), [abierta,setAbierta]=useState(false);
  useEffect(function(){ openRef.current=setAbierta; return function(){ openRef.current=null; }; },[openRef]);
  return abierta&&React.createElement(RptRepartoHoja,{r:r,state:state,set:set,showToast:showToast,totals:totals,onClose:function(){ setAbierta(false); },
    onJump:function(seg){ setAbierta(false); if(onJump) onJump(seg); }});
}
/* La cabecera de Recibos como botón: mismo dibujo de siempre (etiqueta, cifra, cuenta) y un chip «Tu sueldo ›» a la
   derecha de la cuenta que dice que se abre. Abre la hoja de «A dónde va tu sueldo»; si los ingresos no llegan al plan, la etiqueta del botón
   lo dice también para quien la lee en voz alta (sin puntito en la flecha, 24/11). */
function PlanMesTap({state,totals,onOpen,children}){
  const r=useReparto(state,totals);
  return React.createElement("button",{type:"button",className:"pr6-sum-tap","data-testid":"plan-cifras","aria-haspopup":"dialog",
    "aria-label":t("rpt_ver_reparto")+(r.falta>0?". "+t("rpt_faltan")+" "+rptC(r.falta):""),onClick:onOpen},
    children,
    RptInfo({inner:true}));
}
/* Icono «i» que abre «A dónde va tu sueldo» (sin texto; zona de toque de 44 px). Dentro de la tarjeta de Recibos (ya es un botón) va como span. */
function RptInfo({onClick,inner,testid}){
  const dib=React.createElement("svg",{width:20,height:20,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round","aria-hidden":"true"},
    React.createElement("circle",{cx:12,cy:12,r:9}),React.createElement("path",{d:"M12 11v5.2M12 7.7h.01"}));
  return inner?React.createElement("span",{className:"rpt-info pr6-sum-go","data-testid":"plan-reparto-chip","aria-hidden":"true"},dib)
    :React.createElement("button",{type:"button",className:"rpt-info","data-testid":testid||"plan-reparto-chip","aria-haspopup":"dialog","aria-label":t("rpt_chip"),title:t("rpt_chip"),onClick:onClick},dib);
}
/* Hoja genérica de esta pantalla: asa, título con cerrar, cuerpo con scroll y pie fijo opcional. */
function RptHoja({title,icono,onClose,back,onBack,children,foot,closer,testid}){
  const swipe=useSheetSwipe(true,onClose); useBackClose(true,swipe.close);
  if(closer) closer.current=swipe.close;
  // Esc cierra la hoja de arriba (lo tenía «Tu mes en cifras»; con una sola hoja lo hereda toda la pantalla).
  useEffect(function(){
    const key=function(e){ if(e.key==="Escape"){ e.stopPropagation(); swipe.close(); } };
    document.addEventListener("keydown",key);
    return function(){ document.removeEventListener("keydown",key); };
  },[swipe.close]);
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
function RptRepartoHoja({r,state,set,showToast,totals,onClose,onJump}){
  const [vista,setVista]=useState("reparto");
  const subDe=function(k){
    if(k==="rec") return rptPl(r.nRec,t("rpt_n_rec_1"),tf("rpt_n_rec",{n:r.nRec}));
    if(k==="deu") return rptPl(r.nDeu,t("rpt_n_cuotas_1"),tf("rpt_n_cuotas",{n:r.nDeu}));
    if(k==="met") return tf("rpt_n_ritmo",{n:r.nMet});
    if(k==="aho") return t("rpt_plan_mensual");
    return r.sinPresupuesto?t("rpt_gastado_hasta_hoy"):r.gastado>r.presupuesto?tf("rpt_sobre_pres",{x:rptC(r.gastado-r.presupuesto)}):tf("rpt_de_x",{a:rptC(r.gastado),b:rptC(r.presupuesto)});
  };
  const nombre={rec:t("rpt_rec"),deu:t("rpt_deu"),met:t("rpt_met"),aho:t("rpt_aho"),gas:t("rpt_gas")};
  if(vista==="gas"){
    return React.createElement(RptHoja,{title:t("rpt_gas"),onClose:onClose,back:true,onBack:function(){ setVista("reparto"); },testid:"plan-reparto-detalle"},
      React.createElement("div",{className:"rpt-sg"},rptKv(t("rpt_gastado"),rptC(r.gastado)),
        r.presupuesto==null?null:rptKv(t("rpt_presupuesto"),rptC(r.presupuesto)),
        r.presupuesto==null?null:rptKv(r.gastado>r.presupuesto?t("rpt_de_mas"):t("rpt_quedan"),rptC(Math.abs(r.presupuesto-r.gastado)))));
  }
  if(vista==="aho"){
    /* El ahorro mensual planificado se edita donde ya se edita (`SavingsPlanCard`, `state.aportaciones`): UNA sola fuente de verdad. */
    const aps=(state.aportaciones||[]).filter(function(a){ return a&&Number(a.amount)>0; });
    return React.createElement(RptHoja,{title:t("rpt_aho"),onClose:onClose,back:true,onBack:function(){ setVista("reparto"); },testid:"plan-reparto-detalle"},
      set&&React.createElement(SavingsPlanCard,{state:state,set:set,totals:totals,showToast:showToast}),
      React.createElement("div",{className:"rpt-sg"},rptKv(t("rpt_invertido"),rptC(r.inversion)),
        !set&&aps.map(function(a){ return rptKv(a.name||t("d_saving"),rptC(Math.round(Number(a.amount)*100)),a.id); })));
  }
  /* La cascada (orden del dueño 24/11): lo que entra, menos cada destino con su importe de TODO el mes, y el
     resultado. Los destinos son exactamente los de `planReparto` (`r.total` = su suma), así que la cuenta cuadra al
     céntimo y el resultado es el mismo número que la línea de la cabecera. Nada de «Otros»: lo que no existe no sale. */
  const pasos=r.trozos.filter(function(x){ return x.k!=="lib"&&x.c>0; });
  const res=r.entra==null?null:r.falta>0?{l:t("rpt_faltan"),a:rptC(r.falta),c:"rojo"}:r.libre>0?{l:r.st==="nobud"?t("rpt_libre_hasta"):t("rpt_sobran"),a:rptC(r.libre),c:"verde"}:{l:t("rpt_todo"),a:"",c:"verde"};
  const paso=function(x){
    return React.createElement("button",{key:x.k,type:"button",className:"cas-row","data-k":x.k,"data-c":x.c,
      onClick:function(){ if(x.k==="aho"||x.k==="gas") setVista(x.k); else onJump(x.k==="rec"?"recibos":x.k==="deu"?"deudas":"metas"); }},
      React.createElement("span",{className:"cas-nm"},React.createElement("i",{className:"rpt-sw",style:{background:"var("+RPT_COLS[x.k]+")"}}),nombre[x.k]),
      React.createElement("span",{className:"cas-sub"},subDe(x.k)),
      React.createElement("span",{className:"cas-am"},"− "+rptC(x.c),rptIcon("chevr",13,{marginLeft:6,opacity:.5,verticalAlign:"-1px"})));
  };
  return React.createElement(RptHoja,{title:t("rpt_sheet_title"),onClose:onClose,testid:"plan-reparto-hoja"},
    React.createElement("div",{className:"cas-entra"},React.createElement("span",null,t("rpt_entran")),
      React.createElement("b",{className:"serif num","data-testid":"plan-reparto-entra"},r.entra==null?"—":rptC(r.entra))),
    React.createElement("div",{className:"cas-list","data-testid":"plan-cascada"},pasos.map(paso)),
    React.createElement("div",{className:"cas-res"+(res?" "+res.c:""),"data-testid":"plan-reparto-res"},
      React.createElement("span",{className:"cas-res-l"},res?res.l:t("rpt_wait")),
      res&&res.a&&React.createElement("b",{className:"serif num","data-testid":"plan-reparto-cifra"},res.a)),
    r.traspaso>0&&React.createElement("div",{className:"rpt-own"},React.createElement("span",null,t("rpt_traspaso")),React.createElement("s",null,rptC(r.traspaso))));
}

/* ---------------- Interruptor «Restar del presupuesto» (ficha de una deuda y hoja de alta/edición) ---------------- */
// Cuánto cambia el reparto al encender o apagar ESTA deuda; las demás se quedan como están. Todo sale de `planReparto`
// con y sin el interruptor: aquí no se calcula dinero, solo se eligen las cifras que explican el efecto en tu presupuesto de Gastos.
function rptRestarNums(state,d){
  const con=function(on){ return Object.assign({},state,{debts:(state.debts||[]).map(function(x){
    if(x.id!==d.id) return x;
    const y=Object.assign({},x); if(on) y.restarPres=true; else delete y.restarPres;
    return y; })}); };
  const off=planReparto(con(false),{}), on=planReparto(con(true),{}), enc=d.restarPres===true;
  const mover=Math.max(0,off.gas-on.gas);
  const antes=off.presupuestoRaw==null?0:off.presupuestoRaw-off.gastado, despues=on.presupuestoRaw==null?0:on.presupuestoRaw-on.gastado;
  const q=on.reservaDeudas-off.reservaDeudas;
  // Tu presupuesto de Gastos, con y sin la cuota dentro; el aviso de pasarte compara lo gastado con el de después.
  const pa=off.presupuesto==null?0:off.presupuesto, pb=on.presupuesto==null?0:on.presupuesto;
  return {sinPresupuesto:off.sinPresupuesto,
    p:pa!==pb?tf("rpt_gas_pasa",{a:rptC(pa),b:rptC(pb)}):"",
    m:mover>0?tf("rpt_libre_sube",{x:rptC(mover)}):tf("rpt_salen",{x:rptC(q)}),
    w:despues<0?tf(enc?"rpt_te_pasas":"rpt_te_pasarias",{x:rptC(-despues)}):""};
}
/* La fila del interruptor, una sola para la ficha de la deuda, la hoja de alta y la de edición (y la de metas). */
function RptSwitch({on,onClick,sub,act}){
  return React.createElement("button",{type:"button",className:"rpt-rsv-h",role:"switch","aria-checked":!!on,"data-act":act||"restar-presupuesto",onClick:onClick},
    React.createElement("span",null,React.createElement("span",{className:"rpt-rsv-t"},t("rpt_resta_t")),sub?React.createElement("span",{className:"rpt-rsv-s"},sub):null),
    React.createElement("span",{className:"rpt-swt"}));
}
/* El interruptor dentro de una hoja de alta o edición (deuda o meta): la misma fila, con su caja. Sin presupuesto no hay de dónde
   restar y se dice, como en la ficha. `sub` fija la línea de debajo (las metas dicen el aporte); si no, la cuota al mes. */
function RptRestarHoja({state,on,cuota,sub,onToggle}){
  const sin=useMemo(function(){ return planReparto(state,{}).sinPresupuesto; },RPT_DEPS_REPARTO(state));
  if(sin) return React.createElement("div",{className:"rpt-rsv"},React.createElement("span",{className:"rpt-rsv-t"},t("rpt_resta_t")),React.createElement("span",{className:"rpt-rsv-s"},t("rpt_sin_pres")));
  return React.createElement("div",{className:"rpt-rsv","data-testid":"hoja-restar"},
    React.createElement(RptSwitch,{on:on,onClick:onToggle,act:"hoja-restar",sub:sub!==undefined?sub:(cuota>0?tf("rpt_resta_s",{x:rptC(Math.round(cuota*100))}):"")}));
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
    React.createElement(RptSwitch,{on:enc,onClick:cambia,sub:tf("rpt_resta_s",{x:rptC(cuota)})}),
    React.createElement("div",{className:"rpt-pvb"},
      n.p&&React.createElement("div",{"data-pv":"p"},n.p),
      React.createElement("div",{"data-pv":"m"},n.m),
      n.w&&React.createElement("div",{className:"rpt-pvw","data-pv":"w"},n.w)));
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
    // El importe «−260 €/mes» (o «/mo») no se parte; la línea sí puede saltar en los « · ».
    const s=tf("rpt_esc_desde",{m:rptMes(x.desde),name:nombreDe(x.k),x:rptC0(x.c)})+(x.final>0?" · "+tf("rpt_esc_final",{x:rptC0(x.final),m:rptMes(x.ultimo)}):"");
    return s.replace(/(−)([^·]*?)(\/(?:mes|mo))/g,function(_,sig,cuerpo,suf){
      return sig+"\u2060"+cuerpo.replace(/[\u0020\u202F]/g,"\u00A0")+"\u2060"+suf.replace("/","/\u2060");
    });
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
/* Pie de una ficha: la acción principal sola y, debajo, Editar y Eliminar como texto, alineados y sin peso (Eliminar en coral;
   el borrado pide confirmación en quien lo recibe). Una sola jerarquía para deudas y metas. */
function rptPie(principal,onEditar,onEliminar){
  return [principal||null,React.createElement("div",{key:"s",className:"rpt-sf-2"},
    React.createElement("button",{type:"button",className:"rpt-lnk","data-act":"ficha-editar",onClick:onEditar},t("fj_edit")),
    React.createElement("button",{type:"button",className:"rpt-lnk del","data-act":"ficha-eliminar",onClick:onEliminar},t("rpt_eliminar")))];
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
  const pie=rptPie(viva
    ?React.createElement("button",{key:"a",type:"button",className:"rpt-btn","data-act":"ficha-amortizar",onClick:function(){ h.amortizar(d,function(){ if(cierra.current) cierra.current(); }); }},t("db_amortize"))
    :React.createElement("button",{key:"a",type:"button",className:"rpt-btn","data-act":"ficha-cerrar-deuda",onClick:function(){ if(d.settledAt) h.archivar(d); else h.liquidada(d); onClose(); }},t(d.settledAt?"db_archive":"db_settle_ok")),
    function(){ onClose(); h.editar(d); },function(){ onClose(); h.eliminar(d); });
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
/* La cabecera de Metas, Deudas (y, con su propio dibujo, Recibos): título pequeño, cifra grande en serif, subtítulo y una tarjeta de
   dos celdas con divisor. El tono de la cifra: verde (Metas), rojo (Deudas) o el del texto (Recibos). */
function RptHero({testid,titulo,cifra,tono,sub,celdas,accion,t0,onInfo}){
  return React.createElement("section",{className:"rpt-hero","data-testid":testid},
    React.createElement("div",{className:"rpt-hh"},React.createElement("div",{className:"rpt-ht"},titulo),accion||null),
    React.createElement("div",{className:"rpt-big plan-summary-amount"+(tono?" "+tono:""),"data-testid":t0||undefined},cifra),
    onInfo?React.createElement("div",{className:"rpt-hsrow"},React.createElement("div",{className:"rpt-hs"},sub),RptInfo({onClick:onInfo,testid:"plan-reparto-info-"+(testid==="debts-summary"?"deudas":"metas")}))
      :React.createElement("div",{className:"rpt-hs"},sub),
    React.createElement("div",{className:"rpt-facts m"},celdas.map(function(c,i){
      return React.createElement(c.onClick?"button":"div",{key:i,type:c.onClick?"button":undefined,className:"rpt-fact"+(c.cls?" "+c.cls:""),"data-testid":c.testid||undefined,
        "aria-label":c.aria||undefined,onClick:c.onClick||undefined},
        React.createElement("span",null,c.l),React.createElement("b",null,c.v));
    })));
}
/* «+ Añadir» pequeño a un lado de la cabecera: el mismo en Recibos, Deudas y Metas (el botón verde ancho se quitó). */
function RptAnadir({act,label,onClick}){
  return React.createElement("button",{type:"button",className:"link pr6-mg-add","data-act":act,"aria-label":label,onClick:onClick},
    React.createElement("svg",{width:15,height:15,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.6,strokeLinecap:"round","aria-hidden":"true"},React.createElement("path",{d:"M12 5v14M5 12h14"})),t("mg_anadir"));
}
function RptDeudasVista({state,r,visibles,archivadas,h,total,showArchive,setShowArchive,tabs,onAdd,onInfo}){
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
  // Cada lista en SU tarjeta, como «Por pagar» de Recibos: borde, fondo propio, filas con línea fina y, a la derecha de la
  // cabecera, el total de la lista (rojo lo que falta, verde lo ya pagado). Solo las dos listas del mes llevan total.
  const seccion=function(titulo,lista,tipo,id,suma){ return lista.length>0&&React.createElement("section",{className:"rpt-sec rpt-cs"+(tipo==="pend"?" pend":tipo==="hecha"?" hecha":""),"data-sec":id,key:id},
    React.createElement("div",{className:"rpt-sech"},React.createElement("span",null,titulo),suma!=null&&React.createElement("b",{className:"num rpt-sech-t","data-testid":"debts-suma-"+id},rptC(suma))),
    React.createElement("div",{className:"rpt-list rpt-card"},lista.map(function(d){ return fila(d,tipo); }))); };
  return React.createElement("div",{className:"rpt"},
    // Misma cabecera que la de Metas, con la cifra en rojo (es lo que se debe). Las cifras son las de siempre: lo que pagas este
    // mes, lo ya pagado y lo que falta, lo que debes en total y qué deuda acaba antes.
    React.createElement(RptHero,{onInfo:onInfo,testid:"debts-summary",titulo:t("rpt_d_hero"),cifra:rptC(tot),tono:"rojo",t0:"debts-mes",
      sub:React.createElement("span",{"data-testid":"debts-pagados"},tf("rpt_d_sub",{a:rptC(pag),b:rptC(tot-pag)})),
      accion:onAdd&&React.createElement(RptAnadir,{act:"debt-add",label:t("db_add"),onClick:onAdd}),
      celdas:[{l:t("rpt_d_debes"),v:eur0(total),testid:"debts-debes"},
        priDeuda?{l:t("rpt_d_acaba_antes"),v:priDeuda.name+" · "+rptMes(pri.ultimo),testid:"debts-acaba",onClick:function(){ h.abrir(priDeuda); },aria:t("rpt_d_acaba_antes")+": "+priDeuda.name}:{l:t("rpt_d_acaba_antes"),v:"—"}]}),
    tabs,
    seccion(t("rpt_d_por_pagar"),pend,"pend","pend",tot-pag),
    seccion(t("rpt_d_pagado"),hechas,"hecha","hechas",pag),
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
  const pie=rptPie(!g.done&&rem>0&&React.createElement("button",{key:"a",type:"button",className:"rpt-btn","data-act":"ficha-aportar",onClick:function(){ onClose(); h.aportar(g); }},t("gl_contribute")),
    function(){ onClose(); h.editar(g); },function(){ onClose(); h.eliminar(g); });
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
function RptMetasVista({state,goals,h,tabs,onAdd,onInfo}){
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
    React.createElement(RptHero,{onInfo:onInfo,testid:"goals-summary",titulo:t("v4_goals_hero"),cifra:rptC0(sv),tono:"verde",sub:tf("rpt_m_de_total",{x:rptC0(tg)}),
      accion:onAdd&&React.createElement(RptAnadir,{act:"goal-new",label:t("v4_goal_new"),onClick:onAdd}),
      celdas:[{l:t("rpt_m_apartas"),v:rptC0(res.ritmo)+t("rpt_m_mes")},{l:f2[0],v:f2[1],cls:res.hueco>0||res.vencidas>0?"warn":res.conFecha>0?"ok":""}]}),
    tabs,
    abiertas.length>0&&React.createElement("section",{className:"rpt-sec"},React.createElement("div",{className:"rpt-sech"},React.createElement("span",null,t("rpt_m_en_marcha"))),React.createElement("div",{className:"rpt-list"},abiertas.map(fila))),
    hechas.length>0&&React.createElement("section",{className:"rpt-sec"},React.createElement("div",{className:"rpt-sech"},React.createElement("span",null,t("rpt_m_conseguidas"))),React.createElement("div",{className:"rpt-list"},hechas.map(fila))));
}
