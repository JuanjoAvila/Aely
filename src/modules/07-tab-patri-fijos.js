/* ============================================================
   TAB: PATRIMONIO
   ============================================================ */
/* LA FICHA DE UNA CUENTA (2026-09-11) — el rediseño que pidió y aprobó viendo la maqueta.
   Antes: un botón «Editar» abría en canal las CINCO cuentas a la vez, cada una con casilla de
   nombre, casilla de saldo, tres chips de rol y papelera, más dos pistas al final. Suyo: «es muy
   cutrón que se despliegue abajo para editar y es bastante feo. Piensa algo chulo».
   Lo que eligió: tocar la cuenta y que suba una ficha **como la de apuntar un gasto** — la misma
   hoja de abajo que ya usa a diario, con `useSheetSwipe`, así que se cierra tirando y no hay que
   aprender nada nuevo. Tampoco hay «Guardar»: cada cambio se guarda al vuelo, como en el resto.
   Y lo que rechazó de la primera maqueta: meter todo en una cartilla única («separado como está
   me gusta ya») y la flecha al lado del importe. */
function AccountSheet({open, cuenta, state, set, totals, onClose, onRemove, onSaldo, onRole, rolVista, saldoMostrado, sincronizada, onBankSync, onReconnectBank, bankBusy, onCajero, onEntrada}){
  const [borrando,setBorrando]=React.useState(false);
  const [saldo,setSaldo]=React.useState("");
  const [corrigiendo,setCorrigiendo]=React.useState(false);
  const [renombrando,setRenombrando]=React.useState(false);
  /* El borrador debe sobrevivir al cierre por atrás/swipe sin depender del blur: al cerrar
     con el foco dentro no siempre llega (rechazo 4.19.67 paso 5, 2026-09-12). */
  const saldoRef=React.useRef("");
  const cuentaRef=React.useRef(cuenta);
  const conectadaRef=React.useRef(false);
  React.useEffect(function(){
    if(!open||!cuenta) return;
    setBorrando(false);
    setCorrigiendo(false);
    setRenombrando(false);
    /* Corregir empieza limpio: precargar un float largo (5585.049999…) llenaba el límite de
       siete dígitos de NumPad y parecía bloqueado. El saldo vigente ya se ve justo encima. */
    setSaldo(""); saldoRef.current="";
  },[open,cuenta&&cuenta.id]);
  /* El saldo solo se escribe en las cuentas TUYAS. En una conectada lo manda el banco y editarlo
     aquí sería mentirse: se enseña con su candado y la hora del último sync. */
  const guardaSaldo=function(){
    const a=cuentaRef.current;
    if(!a||conectadaRef.current) return;
    const n=parseFloat(String(saldoRef.current).replace(",","."));
    if(!isFinite(n)) return;
    onSaldo(a.id, n);
  };
  /* Cerrar = volcar el saldo PRIMERO. El blur sigue por si salta al nombre con el teclado
     («flechita»), que era el único camino que le funcionaba. */
  const cerrar=function(){ guardaSaldo(); onClose(); };
  /* Atrás conserva su callback de apertura, pero onSaldo usa los totales del padre. Un gasto
     recibido con la ficha abierta —también durante la salida— cambia la base necesaria para
     guardar el saldo tecleado. Resolver el cierre vigente AL TERMINAR evita usar esos totales
     viejos y deja que atrás salga con la misma animación que el arrastre (18/10/2026). */
  const cerrarRef=React.useRef(cerrar); cerrarRef.current=cerrar;
  const swipe=useSheetSwipe(!!open, function(){ cerrarRef.current(); });
  useBackClose(!!open, swipe.close);
  if(!open||!cuenta) return null;
  const a=cuenta;
  cuentaRef.current=a;
  const conectada=sincronizada(a);
  conectadaRef.current=conectada;
  const efectivo=isEfectivoEnt(a);
  /* Las tres opciones con su FRASE. Eran tres chips sueltos y la explicación vivía en letra
     pequeña al final de la tarjeta, así que había que bajar a buscarla para saber qué hacía cada
     uno. El efectivo SOLO es gasto diario (hotfix 13/9): no tiene recibos domiciliados ni puede
     ser la cuenta principal (eso es TR). */
  const roles=efectivo ? [["diario","ac_role_diario","ac_role_diario_d"]]
    : [["fijos","ac_role_fijos","ac_role_fijos_d"],["diario","ac_role_diario","ac_role_diario_d"],["ambos","ac_role_ambos","ac_role_ambos_d"]];
  /* `rolVista` = lo que se VE (gasto diario efectivo, extras incluidos). `accRole` solo mira el
     campo de la cuenta y mentiría en un EXTRA de expenseBanks. */
  /* Una cuenta OB nueva todavía NO tiene rol. Pintar «Recibos» por defecto sería afirmar una
     decisión que el usuario no ha tomado y, peor, animaría a pensar que ya afecta a los fijos. */
  const rolActual=a._obKey?null:(rolVista||accRole(a));
  const guardaNombre=function(v){
    set(function(s){
      if(a._obKey){
        const ob=Object.assign({},s.obLabels||{}); ob[a._obKey]=v;
        return Object.assign({},s,{obLabels:ob});
      }
      return Object.assign({},s,{accounts:(s.accounts||[]).map(function(x){ return x.id===a.id?Object.assign({},x,{name:v}):x; })});
    });
  };
  const banco=entOf(a.ent).label||a.aspsp||"🏦";
  const missingFx=!!a._obKey&&a.value==null;
  const saldoHoy=missingFx?null:(Number(saldoMostrado(a))||0);
  const gastosCuenta=(state.expenses||[]).filter(function(e){ return !e.autoGemelo && expenseBankOf(e)===a.ent; })
    .sort(function(x,y){ return dateMs(y.date)-dateMs(x.date); });
  const histKey=a.accountOrderKey||(a._obKey?("ob:"+a._obKey):("acc:"+a.id));
  const limite14=new Date(); limite14.setHours(0,0,0,0); limite14.setDate(limite14.getDate()-13);
  const allHistory=((state.accountBalanceHistory||{})[histKey]||[]).filter(function(p){
    return p&&p.day&&Number.isFinite(Number(p.value));
  }).slice(-31);
  const history=allHistory.filter(function(p){
    return p&&p.day&&dateMs(p.day+"T12:00:00")>=limite14.getTime()&&Number.isFinite(Number(p.value));
  }).slice(-14);
  const spark=history.map(function(p){ return Number(p.value); });
  const sparkMin=Math.min.apply(null,spark), sparkMax=Math.max.apply(null,spark), sparkSpan=sparkMax-sparkMin;
  const hoy=new Date(), inicioMesKey=hoy.getFullYear()+"-"+String(hoy.getMonth()+1).padStart(2,"0")+"-01";
  const monthPoint=allHistory.find(function(p){ return p.day===inicioMesKey; });
  const deltaMes=!missingFx&&monthPoint?saldoHoy-Number(monthPoint.value):null;
  const cuentasMismaEnt=(state.accounts||[]).filter(function(x){ return x.ent===a.ent; }).length+
    (state.obAccounts||[]).filter(function(x){ return x.ent===a.ent; }).length;
  const projected=!missingFx&&cuentasMismaEnt===1&&totals.projectedByBank&&Number.isFinite(totals.projectedByBank[a.ent])
    ? totals.projectedByBank[a.ent] : null;
  const issue=(state.bankIssues||[]).find(function(is){
    if(is.ent&&is.ent===a.ent) return true;
    return is.aspsp&&typeof entFromAspsp==="function"&&entFromAspsp(is.aspsp)===a.ent;
  });
  const accionBanco=function(){
    if(!conectada){
      cerrar();
      try{ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})); }catch(e){}
      return;
    }
    if(issue&&typeof onReconnectBank==="function"){ onReconnectBank(issue.aspsp); return; }
    if(typeof onBankSync==="function") onBankSync();
  };
  const verTodos=function(){
    const nav=document.querySelector('.botnav-tab[data-tour="gastos"]');
    if(!nav||typeof nav.click!=="function") return;
    try{ window.__mcExpBank=a.ent; }catch(e){}
    cerrar(); nav.click();
    setTimeout(function(){
      try{ window.dispatchEvent(new CustomEvent("mc-open-expenses-bank",{detail:{ent:a.ent}})); }catch(e){}
    },0);
  };
  const cambiaSaldo=function(next){
    setSaldo(function(prev){
      const v=typeof next==="function"?next(prev):next;
      saldoRef.current=v; return v;
    });
  };
  /* PARTE MÍA (14/10/2026). Una conjunta con la pareja no es suya entera: aquí dice qué parte
     cuenta en el patrimonio. Solo el patrimonio; gastos y presupuesto no la miran. Si el banco
     da dos titulares y no la ha puesto, se le sugiere aquí, sin preguntar al abrir la app. */
  const shareKind=a._obKey?"ob":"account";
  const shareItem=a._obKey?{key:a._obKey,iban:a.iban}:a;
  const sharePct=accountSharePct(state,shareItem,shareKind);
  const shareTxt=new Intl.NumberFormat(loc(),{maximumFractionDigits:2}).format(sharePct==null?100:sharePct)+" %";
  const pareceConjunta=sharePct==null&&(accountLooksJoint(a._holder||a.name)||/conjunt|compartid|joint|shared/i.test(a.name||""));
  const pedirParte=function(){
    askText({ title:t("ac_share_title"), sub:t("ac_share_sub"), ph:"50", ok:t("ac_share_ok"),
      value:sharePct==null?"":String(sharePct).replace(".",numDecSep()),
      chips:[{v:50,label:"50 %"},{v:100,label:"100 %"}] })
      .then(function(raw){
        if(raw==null) return;   // null = canceló
        const pct=parseAccountShare(raw);
        if(pct==null){ askConfirm({title:t("ac_share_bad"),ok:t("ask_ok"),cancel:t("fj_cancel")}).then(function(again){ if(again) pedirParte(); }); return; }
        set(function(s){ return setAccountShare(s, shareItem, shareKind, pct); });
      });
  };
  /* Los movimientos viejos del banco que no dicen su cuenta: los atribuye él, aquí, cuando la
     cuenta no es suya entera y el banco tiene más de una (`setAccountLegacy`). Son tres respuestas,
     así que es `askChoice`: «preguntar después» no guarda nada. Se deshace en el mismo sitio. */
  const legacyKey=accountShareKey(shareItem,shareKind);
  const legacyDec=((state.settings||{}).accountShareLegacy||{})[a.ent]||null;
  const legacyN=cuentasMismaEnt>1?accountLegacyCount(state,a.ent):0;
  const verLegacy=legacyN>0&&(!!legacyDec||sharePct!=null);
  const pedirLegacy=function(){
    askChoice({ title:tf("ac_legacy_q",{n:legacyN,bank:banco}), sub:tf("ac_legacy_sub",{n:legacyN}), options:[
      {v:"yes",label:t("ac_legacy_yes")},{v:"no",label:t("ac_legacy_no")},{v:"later",label:t("ac_legacy_later")}] })
      .then(function(v){
        if(v!=="yes"&&v!=="no") return;   // null = canceló; «later» = sin decidir
        set(function(s){ return setAccountLegacy(s, a.ent, {key:legacyKey, no:v==="no", day:netWorthDay()}); });
      });
  };
  const title=a.name||banco;
  const sub=conectada?tf("ac_synced_sub",{bank:banco}):tf("ac_manual_sub",{bank:banco});
  const balanceDate=a.balanceAt||a.lastSync;
  const staleAge=conectada&&balanceDate?Date.now()-dateMs(balanceDate):0;
  const stale=!!a.balanceStale||staleAge>48*60*60*1000;
  const staleDay=stale&&balanceDate?new Date(balanceDate).toLocaleDateString(loc(),staleAge>6*24*60*60*1000?{day:"numeric",month:"short"}:{weekday:"long"}):"";
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back",onClick:cerrar},
      React.createElement("div",Object.assign({className:"v4-sheet",ref:swipe.sheetRef,onClick:function(e){ e.stopPropagation(); },style:{maxHeight:"calc(88dvh / var(--zoom,1))"}}, swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"v4-account-head"},
          React.createElement(Mono,{ent:a.ent,size:44}),
          React.createElement("div",{className:"v4-account-head-copy"},
            React.createElement("div",{className:"v4-account-title"}, title),
            React.createElement("div",{className:"v4-account-sub"}, sub)),
          React.createElement("button",{type:"button",className:"v4-account-rename",onClick:function(){ setRenombrando(function(v){ return !v; }); }}, t("ac_rename"))
        ),
        renombrando && React.createElement("input",{className:"v4-account-name",value:a.name||"",autoFocus:true,
          placeholder:t("pt_name_ph"),onChange:function(e){ guardaNombre(e.target.value); }}),
        React.createElement("div",{className:"v4-account-balance"},
          React.createElement("div",{className:"v4-micro"}, t("ac_balance_today")),
          React.createElement("div",{className:"v4-account-amount serif num",style:missingFx?{whiteSpace:"normal",fontSize:22,letterSpacing:0,overflowWrap:"anywhere"}:null}, missingFx?fxAmountText(a._nativeValue,a.cur,state):eur(saldoHoy)),
          (deltaMes!=null&&Math.abs(deltaMes)>=.005 || projected!=null || stale) && React.createElement("div",{className:"v4-account-balance-meta"},
            deltaMes!=null&&Math.abs(deltaMes)>=.005 && React.createElement("span",{className:"v4-account-delta"+(deltaMes<0?" down":"")},
              tf(deltaMes<0?"ac_delta_month_down":"ac_delta_month",{x:eur(Math.abs(deltaMes))})),
            projected!=null && React.createElement("span",null,tf("ac_eom",{x:eur(projected)})),
            stale && React.createElement("span",{className:"v4-account-stale"},staleDay?tf("st_stale",{day:staleDay}):t("pt_ob_stale"))),
          !missingFx&&history.length>=2
            ? React.createElement(React.Fragment,null,
                React.createElement("div",{className:"v4-account-spark","aria-label":t("ac_spark_from")+" · "+t("ac_spark_to")},
                  spark.map(function(v,i){
                    const h=sparkSpan>0?18+((v-sparkMin)/sparkSpan)*82:55;
                    return React.createElement("i",{key:i,style:{height:h+"%",animationDelay:(i*.025)+"s"}});
                  })),
                React.createElement("div",{className:"v4-account-spark-foot"},
                  React.createElement("span",null,new Date(history[0].day+"T12:00:00").toLocaleDateString(loc(),{day:"numeric",month:"short"})),React.createElement("span",null,t("ac_spark_to"))))
            : null,
          /* UNA línea de notas bajo el saldo (DIS-37, auditoría de diseño 233): «Su histórico empieza
             hoy» y «lo pone el banco» eran dos textos sueltos de 11-12 px que se leían como restos. */
          (function(){
            const nota=[conectada?t("pt_ficha_banco"):"", (missingFx||history.length<2)?t("ac_spark_new"):"",
              conectada&&balanceDate?tf("pt_ficha_sync",{x:new Date(balanceDate).toLocaleString()}):""].filter(Boolean).join(" · ");
            return nota && React.createElement("div",{className:"v4-account-lock"},nota);
          })()
        ),
        React.createElement("div",{className:"v4-account-share",style:{padding:"14px 0 2px"}},
          React.createElement("div",{className:"v4-ficha-k"}, t("ac_share_q")),
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
            React.createElement("div",{style:{flex:"1 1 auto",minWidth:0}},
              React.createElement("span",{className:"v4-ficha-ot num","data-testid":"ac-share-pct"}, shareTxt),
              React.createElement("span",{className:"v4-ficha-od"},
                sharePct==null||missingFx?t("ac_share_all"):tf("ac_share_counts",{x:eur(saldoHoy*sharePct/100)}))),
            React.createElement("button",{type:"button",className:"v4-account-action",style:{flex:"0 0 auto",minHeight:40,padding:"6px 14px"},
              "data-testid":"ac-share-edit",onClick:pedirParte}, t("ac_share_change"))),
          pareceConjunta && React.createElement("div",{className:"hint",style:{marginTop:8}}, t("ac_share_joint_hint")),
          verLegacy && React.createElement("div",{"data-testid":"ac-legacy",style:{display:"flex",alignItems:"center",gap:10,marginTop:10}},
            React.createElement("div",{className:"hint",style:{flex:"1 1 auto",minWidth:0,margin:0}},
              !legacyDec ? tf("ac_legacy_q",{n:legacyN,bank:banco})
                : tf(legacyDec.key!==legacyKey?"ac_legacy_done_other":legacyDec.no?"ac_legacy_done_no":"ac_legacy_done_yes",{bank:banco})),
            React.createElement("button",{type:"button",className:"v4-account-action",style:{flex:"0 0 auto",minHeight:40,padding:"6px 14px"},
              "data-testid":"ac-legacy-btn",onClick:function(){
                if(legacyDec) set(function(s){ return setAccountLegacy(s, a.ent, null); }); else pedirLegacy();
              }}, t(legacyDec?"ac_legacy_undo":"ac_legacy_decide")))
        ),
        React.createElement("div",{className:"v4-account-actions"},
          /* Sacar del cajero y entrada de efectivo viven en la ficha del Efectivo (DIS-32, auditoría
             de diseño 233): sueltas bajo la lista de cuentas eran dos píldoras sin dueño. */
          efectivo && onCajero && React.createElement("button",{type:"button",className:"v4-account-action","data-act":"ef-cajero",onClick:onCajero},t("ef_cajero_btn")),
          efectivo && onEntrada && React.createElement("button",{type:"button",className:"v4-account-action","data-act":"ef-entrada",onClick:onEntrada},t("ef_in_btn")),
          !conectada && React.createElement("button",{type:"button",className:"v4-account-action"+(corrigiendo?" on":""),onClick:function(){
            if(corrigiendo) guardaSaldo(); else cambiaSaldo(""); setCorrigiendo(function(v){ return !v; });
          }},corrigiendo?t("done"):t("ac_fix_balance")),
          !efectivo && React.createElement("button",{type:"button",className:"v4-account-action"+(issue?" warn":""),disabled:bankBusy,onClick:accionBanco},
            bankBusy?t("bp_syncing"):t(!conectada?"ac_connect":(issue?"ac_reconnect":"ac_sync_now")))
        ),
        corrigiendo && !conectada && React.createElement("div",{className:"v4-account-correct"},
          React.createElement("div",{className:"v4-account-correct-row"},
            React.createElement("button",{type:"button",className:"v4-account-sign","aria-label":t("ac_change_sign"),onClick:function(){ cambiaSaldo(function(v){ return String(v||"").charAt(0)==="-"?String(v).slice(1):("-"+String(v||"")); }); }},"±"),
            React.createElement("div",{className:"v4-account-correct-amount serif num"},saldo?eur(parseNumPadRaw(saldo)):"—")),
          React.createElement(NumPad,{value:saldo,onChange:cambiaSaldo})),
        React.createElement("div",{style:{padding:"14px 0 4px"}},
          React.createElement("div",{className:"v4-ficha-k"}, t("ac_role_q")),
          React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:7}},
            roles.map(function(r){
              const on=rolActual===r[0];
              return React.createElement("button",{key:r[0],type:"button",className:"v4-ficha-op"+(on?" on":""),disabled:missingFx,
                /* `onRole` = `pickRole` del padre: no solo `applyAccountRole`. Un EXTRA de gasto
                   diario vive en `settings.expenseBanks`, y sin ese camino la ficha mentiría al
                   tocar «Recibos» (dejaría el banco contando igual). */
                onClick:function(){ if(typeof onRole==="function") onRole(a, r[0]);
                  else set(function(s){ return applyAccountRole(s, totals, a.id, r[0]); }); }},
                React.createElement("span",{className:"v4-ficha-radio"}),
                React.createElement("span",{style:{minWidth:0}},
                  React.createElement("span",{className:"v4-ficha-ot"}, t(r[1])),
                  React.createElement("span",{className:"v4-ficha-od"}, t(r[2])))
              );
            })
          )
        ),
        gastosCuenta.length>0 && React.createElement("div",{className:"v4-account-latest"},
          React.createElement("div",{className:"v4-account-latest-head"},
            React.createElement("span",null,cuentasMismaEnt===1?t("ac_last_movs"):tf("ac_last_bank",{bank:banco})),
            React.createElement("button",{type:"button",onClick:verTodos},t("ac_see_all"))),
          gastosCuenta.slice(0,3).map(function(e){
            const c=catOf(e.category), incoming=Number(e.amount)<0, d=new Date(dateMs(e.date));
            return React.createElement("div",{className:"v4-mov v4-account-mov",key:e.id},
              React.createElement("div",{className:"tile",style:{borderColor:c.color+"55",color:c.color,background:c.color+"18"}},c.icon),
              React.createElement("div",{className:"nm"},
                React.createElement("div",{className:"nm-title"},e.merchant||"—"),
                React.createElement("div",{className:"meta"},d.toLocaleDateString(loc(),{day:"numeric",month:"short"}))),
              React.createElement("div",{className:"am num"+(incoming?" pos":"")},(incoming?"+":"−")+eur(Math.abs(Number(e.amount)||0))));
          })
        ),
        a._obKey
          ? React.createElement("div",{className:"hint",style:{marginTop:15}}, t("v4_acc_locked"))
          : borrando
          ? React.createElement("div",{style:{marginTop:15}},
              React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginBottom:8,lineHeight:1.45}}, t("pt_acc_del_q")),
              React.createElement("div",{style:{display:"flex",gap:8}},
                React.createElement("button",{type:"button",className:"v4-ficha-quitar",style:{flex:1},
                  onClick:function(){ onRemove(a.id); onClose(); }}, t("pt_acc_del_yes")),
                React.createElement("button",{type:"button",className:"rchip",style:{flex:1,padding:"10px"},
                  onClick:function(){ setBorrando(false); }}, t("pt_acc_del_no"))))
          : React.createElement("button",{type:"button",className:"v4-ficha-quitar",style:{width:"100%",marginTop:15},
              onClick:function(){ setBorrando(true); }}, t("pt_ficha_quitar"))
      )
    ), document.body);
}

// El nombre se guardaba al escribir y cancelar no era posible. La ficha mantiene todo local
// hasta Guardar; cerrar, volver atrás y cancelar el borrado no cambian el patrimonio (10/10).
function AssetSheet({asset,set,onClose}){
  const [name,setName]=useState(asset.name||"");
  const [raw,setRaw]=useState(asset.value==null?"":String(asset.value));
  const [kind,setKind]=useState(asset.kind||"piso");
  const swipe=useSheetSwipe(true,onClose);
  useBackClose(true,swipe.close);
  const amount=Number(raw.replace(",","."));
  const valid=name.trim()&&/^\d+(?:[.,]\d{1,2})?$/.test(raw)&&Number.isSafeInteger(Math.round(amount*100));
  const save=function(){
    if(!valid) return;
    const next=Object.assign({},asset,{id:asset.id||uid(),name:name.trim(),kind:kind,value:amount});
    set(function(s){
      const old=(s.assets||[]).find(function(a){ return a.id===asset.id; });
      if(asset.id&&!old) return s;
      if(old&&old.name===next.name&&old.kind===next.kind&&old.value===next.value) return s;
      const assets=asset.id?s.assets.map(function(a){ return a.id===asset.id?Object.assign({},a,{name:next.name,kind:next.kind,value:next.value}):a; }):(s.assets||[]).concat(next);
      return Object.assign({},s,{assets:assets,assetValueHistory:recordAssetValues(s.assetValueHistory,netWorthDay(),assets,s.assets,asset.id?null:next.id)});
    });
    onClose();
  };
  const remove=function(){
    askConfirm({title:tf("goods_delete_q",{name:asset.name}),sub:t("goods_delete_sub"),ok:t("goods_delete")}).then(function(ok){
      if(!ok) return;
      set(function(s){ return Object.assign({},s,{assets:(s.assets||[]).filter(function(a){ return a.id!==asset.id; })}); });
      onClose();
    });
  };
  return ReactDOM.createPortal(React.createElement("div",{className:"tabsheet-back",onClick:onClose},
    React.createElement("div",Object.assign({className:"tabsheet",role:"dialog","aria-modal":true,"aria-label":t(asset.id?"v4_edit_goods":"goods_add"),ref:swipe.sheetRef,onClick:function(e){e.stopPropagation();}},swipe.sheetTouch),
      React.createElement("div",{className:"v4-sheet-handle"}),
      React.createElement("h2",{className:"serif"},t(asset.id?"v4_edit_goods":"goods_add")),
      React.createElement("div",{className:"add-form"},
        React.createElement("label",null,t("goods_name"),React.createElement("input",{className:"af-in",value:name,onChange:function(e){setName(e.target.value);}})),
        React.createElement("label",null,t("goods_value"),React.createElement("input",{className:"af-in num",inputMode:"decimal",value:raw,"aria-invalid":!!raw&&!valid,onChange:function(e){setRaw(e.target.value);}})),
        React.createElement("div",{className:"row"},["piso","coche"].map(function(k){return React.createElement("button",{type:"button",className:"chip"+(kind===k?" active":""),key:k,"aria-pressed":kind===k,onClick:function(){setKind(k);}},t(k==="piso"?"goods_home":"goods_car"));})),
        !valid&&React.createElement("div",{className:"hint"},t("goods_invalid")),
        React.createElement("div",{className:"row"},
          React.createElement("button",{type:"button",className:"btn btn-ghost",onClick:onClose},t("fj_cancel")),
          React.createElement("button",{type:"button",className:"btn btn-primary",disabled:!valid,onClick:save},t("save"))),
        asset.id&&React.createElement("button",{type:"button",className:"btn btn-ghost",onClick:remove},t("goods_delete"))
      )
    )),document.body);
}

/* Trozos de una subfila («Recibos», «Sabadell», «falta su parte») separados por «·», en Plan ›
   Recibos y en Cartera (auditoría de diseño 237: con elipsis se leía «Sabadell · f…»). El espacio va
   FUERA de cada trozo para que el renglón solo pueda partir entre ellos; el «·» va al FINAL del trozo
   de delante, como en la fila de Gastos: delante del de detrás, a 360 un renglón empezaba por
   «· Diario + Recibos» (filtro de diseño 237). Uno largo («pagas 197 € + 53 € de Pepephone») sí
   puede partir por sus espacios: si no, se saldría de la tarjeta. */
function mcTrozos(partes, cls){
  const ps=partes.filter(Boolean);
  return React.createElement("span",{className:cls||"mc-trozos"},
    ps.map(function(p,i){
      return React.createElement(React.Fragment,{key:i}, i>0?" ":null,
        React.createElement("span",{className:String(p).length<=22?"mc-pt":null}, p+(i<ps.length-1?" ·":"")));
    }));
}
function Wealth({state, set, totals, parte, showToast, onBankSync, onReconnectBank, bankBusy, titulo, iconos}){
  const [sheetAcc,setSheetAcc]=React.useState("");   // id de la cuenta cuya ficha está abierta (v4)
  const [sheetAsset,setSheetAsset]=useState(null);
  const [balanceReady,setBalanceReady]=React.useState(function(){ return !!window.__mcBootReady; });
  React.useEffect(function(){
    if(balanceReady) return;
    const ready=function(){ setBalanceReady(true); };
    window.addEventListener("mc-boot-ready",ready);
    if(window.__mcBootReady) ready();
    return function(){ window.removeEventListener("mc-boot-ready",ready); };
  },[balanceReady]);
  const accountDrag=useListLongPress("button.v4-mov[data-account-key]","data-account-key",parte!=="bienes",function(from,to){
    set(function(s){ return moveAccountInList(s,from,to); });
  });
  const bindListDrag=accountDrag.bind, dragAcc=accountDrag.drag, suppressSheetRef=accountDrag.suppressClickRef;
  // Quitar a mano una cuenta manual del patrimonio (la del onboarding no se va sola al desloguear el banco:
  // las manuales viven en state.accounts, no en obAccounts, y bankDisconnect solo purga obAccounts).
  const removeAccount=(id)=>{
    set(function(s){
      const a=(s.accounts||[]).find(function(x){ return x.id===id; });
      if(a && isEfectivoEnt(a)) return removeEfectivoAccount(s, id);
      // Si se va la que cargaba el neto del banco, lo hereda su hermana sin cambiar de saldo (238).
      return conservaNetoDeBanco(s, Object.assign({},s,{accounts:(s.accounts||[]).filter(function(x){ return x.id!==id; })}));
    });
  };
  const ruM=totals.roundupThisMonth||0;                                     // round-up del mes (sale del efectivo de gasto)
  const miM=totals.monthlyInvestThisMonth||0;                               // aporte periódico del mes (idem)
  const shownAcc=(i)=> saldoCuentaMostrada(i, {
    injTR:totals.injTR||0, spentByBank:totals.spentByBank||{}, paidNetByBank:totals.paidNetByBank||{},
    roundup:ruM, monthlyInvest:miM
  });
  /* La app no tenía histórico por cuenta. Guardamos un cierre REAL por día (máximo 400), tanto de
     cuentas propias como de las filas OB aún no promocionadas. No se reconstruye hacia atrás con
     movimientos potencialmente truncados: hasta el segundo día la ficha dice que empieza hoy. */
  React.useEffect(function(){
    if(parte!=="cuentas"||!balanceReady) return;
    const today=netWorthDay();
    const rows=accountBalanceRows(state,shownAcc);
    const current=state.accountBalanceHistory||{};
    const needs=rows.some(function(r){
      const list=current[r.key]||[], last=list[list.length-1];
      return !last||last.day!==today||Number(last.value)!==r.value;
    });
    if(!needs) return;
    set(function(s){
      const all=recordAccountBalances(s.accountBalanceHistory,today,rows);
      return all!==s.accountBalanceHistory?Object.assign({},s,{accountBalanceHistory:all}):s;
    },false);
  },[parte,balanceReady,state.accounts,state.obAccounts,state.accountBalanceHistory,totals]);
  /* Guardar el saldo de UNA cuenta (lo que hace la ficha). La base de inicio de mes la despeja
     `manualBalanceWrite` contra el estado fresco, no aquí: la misma regla en dos sitios es lo que
     el 11/9 le pintó a su padre 455,50 € donde el banco decía 26,46 ([[misma-regla-en-dos-sitios]]). */
  const guardarSaldoDe=function(id, tecleado){
    const expected=manualBalanceTarget((state.accounts||[]).find(function(a){return a.id===id;}));
    set(function(s){
      return manualBalanceWrite(s,[{id:id,typed:Number(tecleado),expected:expected}]);
    });
  };
  // Cartera pinta cuentas y bienes planos; inversiones van aparte (Investments).
    // Rol EFECTIVO para pintar (feedback 2026-07-21, como Trade Republic original: el rol va
    // DEBAJO del banco, sin carritos sueltos): «gasto diario» cuenta tanto si la cuenta es la
    // principal (rol diario/ambos) como si su banco es extra de gasto diario (expenseBanks);
    // «recibos» se apaga en los extras marcados solo-diario (settings.dailyOnlyBanks — flag
    // SOLO visual: sin recibos domiciliados en ese banco no mueve ningún número).
    const expDaily=expenseBankEnts(state);
    const dailyOnlyEnts=function(s){ return ((s&&s.settings&&s.settings.dailyOnlyBanks)||[]); };
    const dailyEffOf=function(a){ return accDaily(a) || expDaily.indexOf(a.ent)>=0; };
    const fixedEffOf=function(a){ return accRole(a)==="ambos" || (accFixed(a) && !(dailyEffOf(a) && dailyOnlyEnts(state).indexOf(a.ent)>=0)); };
    const roleLab=function(a){
      const dy=dailyEffOf(a), fx=fixedEffOf(a);
      if(dy&&fx) return t("rl_diario")+" + "+t("rl_fijos");
      if(dy) return t("rl_diario");
      if(fx) return t("rl_fijos");
      return a.name||"";
    };
    // Cuenta re-anclada por Open Banking: su saldo lo trae el banco (no se edita a mano).
    const isSynced=function(a){ return !!(a.bankIban||a.bankUid); };
    const badge=function(txt, color){
      // Color como variable: el CSS lo oscurece en el tema Claro, donde «del banco» daba 2,2:1.
      return React.createElement("span",{className:"v4-ob-badge",style:{"--b":color}}, txt);
    };
    const toast=function(msg){ if(typeof showToast==="function") showToast(msg); };
    /* «Gasto diario» admite VARIOS bancos (v4.6.3). Definido ANTES de la ficha y de las filas:
       la ficha llama aquí (no a `applyAccountRole` a pelo) para que un EXTRA en expenseBanks
       también salga/entre al tocar Recibos / Gasto diario. */
    const pickRole=function(a,r){
      /* Efectivo (hotfix 13/9): SOLO «Gasto diario» como EXTRA (expenseBanks + dailyOnlyBanks).
         Nunca `applyAccountRole` (no puede quitarle el diario a TR) ni toast `ef_no_diario`
         (ese camino bloqueaba justo lo que él pedía). */
      if(isEfectivoEnt(a)){
        if(r!=="diario") return;
        try{ window.dispatchEvent(new CustomEvent("mc-bank-role-changed")); }catch(e){}
        set(function(s){
          const eb=expenseBankEnts(s).slice();
          const dOnly=dailyOnlyEnts(s).slice();
          if(eb.indexOf("efectivo")<0) eb.push("efectivo");
          if(dOnly.indexOf("efectivo")<0) dOnly.push("efectivo");
          return Object.assign({},s,{settings:Object.assign({},s.settings,{expenseBanks:eb, dailyOnlyBanks:dOnly})});
        });
        return;
      }
      try{ window.dispatchEvent(new CustomEvent("mc-bank-role-changed")); }catch(e){}
      set(function(s){
        const patchSet=function(ns,patch){ return Object.assign({},ns,{settings:Object.assign({},ns.settings,patch)}); };
        const drop=function(list,e){ const i=list.indexOf(e); if(i>=0) list.splice(i,1); return list; };
        const add=function(list,e){ if(list.indexOf(e)<0) list.push(e); return list; };
        const eb=expenseBankEnts(s).slice();
        const dOnly=dailyOnlyEnts(s).slice();
        const isPrimary=accDaily(a);
        const hasPrimary=(s.accounts||[]).some(function(x){ return accDaily(x); });
        let ns=s;
        if(r==="fijos"){
          if(isPrimary) ns=applyAccountRole(ns, totals, a.id, "fijos");
          return patchSet(ns,{expenseBanks:drop(eb,a.ent), dailyOnlyBanks:drop(dOnly,a.ent)});
        }
        if(r==="diario"){
          if(isPrimary || !hasPrimary){
            ns=applyAccountRole(ns, totals, a.id, "diario");
            return patchSet(ns,{dailyOnlyBanks:drop(dOnly,a.ent)});
          }
          return patchSet(ns,{expenseBanks:add(eb,a.ent), dailyOnlyBanks:add(dOnly,a.ent)});
        }
        if(isPrimary || !hasPrimary){
          ns=applyAccountRole(ns, totals, a.id, "ambos");
          return patchSet(ns,{dailyOnlyBanks:drop(dOnly,a.ent)});
        }
        return patchSet(ns,{expenseBanks:add(eb,a.ent), dailyOnlyBanks:drop(dOnly,a.ent)});
      });
    };
    const rolVistaOf=function(a){
      const dy=dailyEffOf(a), fx=fixedEffOf(a);
      if(dy&&fx) return "ambos";
      if(dy) return "diario";
      return "fijos";
    };
    /* LA FILA ENTERA SE TOCA Y ABRE LA FICHA DE ESA CUENTA (2026-09-11).
       Antes había UN botón «Editar» que abría en canal las CINCO cuentas a la vez, cada una con su
       casilla de nombre, su casilla de saldo, tres chips de rol y una papelera, más dos pistas al
       final. Suyo: «es muy cutrón que se despliegue abajo para editar y es bastante feo».
       Lo que se enseñó y aprobó: tocar la cuenta y que suba una ficha como la de apuntar un gasto.
       Y explícitamente **sin la flecha** al lado del importe: «pero sin la flecha esa que sale al
       lado del dinero que tienes». Si toda la tarjeta responde al toque, el chevron solo mete
       ruido justo al lado del número, que es lo que va a leer.
       Long-press para ordenar: listeners en el efecto de arriba (mismo gesto que las pestañas). */
    // El importe de la fila es lo que hay en el banco; si solo una parte es suya, se dice al lado
    // (así la suma de las filas no parece no cuadrar con el total).
    const shareMeta=function(item,kind){ const p=accountSharePct(state,item,kind); return p==null?"":tf("pt_share_meta",{n:new Intl.NumberFormat(loc(),{maximumFractionDigits:2}).format(p)}); };
    const accRow=function(a,rowKey){
      const rowDragging=!!(dragAcc&&dragAcc.from===rowKey);
      const rowOver=!!(dragAcc&&dragAcc.to===rowKey&&dragAcc.from!==rowKey);
      return React.createElement("button",{className:"v4-mov"+(rowDragging?" dragging":"")+(rowOver?" drag-over":""),key:rowKey,type:"button",
        "data-account-key":rowKey,"data-account-id":a.id,"aria-label":[a.name,entOf(a.ent).label].filter(function(x,i,l){ return x&&l.indexOf(x)===i; }).join(" · ")+" · "+eur(shownAcc(a)),
        title:t("drag_hint"),
        onClick:function(){ if(Date.now()<suppressSheetRef.current) return; setSheetAcc(rowKey); }},
        React.createElement("div",{className:"tile",style:{background:"transparent",border:"none",padding:0}},React.createElement(Mono,{ent:a.ent,size:44})),
        /* Título = la cuenta y debajo, en UNA línea, banco y uso (DIS-33, auditoría de diseño 233):
           estas filas ponían el banco de título y las de Open Banking la cuenta, así que en la
           misma lista se leían al revés según de dónde viniera cada una. */
        (function(){
          const banco=entOf(a.ent).label, tit=a.name||banco, rol=roleLab(a);
          const meta=[banco!==tit?banco:"", rol!==a.name?rol:"", shareMeta(a,"account")].filter(Boolean);
          return React.createElement("div",{className:"nm"},
            // El nombre se recorta antes que la marca «del banco»: con un nombre largo la marca
            // saltaba sola a otra línea.
            React.createElement("div",{className:"v4-meta-row"},React.createElement("span",{className:"v4-meta-1l"},tit), isSynced(a)&&badge(t("pt_ob_badge"),"#7FB5E8")),
            /* Sin elipsis (auditoría de diseño 237, P1-5: «CaixaBank · 🛒 Gasto diario…»): trozos
               enteros que bajan de renglón entre ellos si no caben, como las subfilas de Recibos. */
            React.createElement("div",{className:"meta v4-meta-trozos"}, meta.length?mcTrozos(meta):"—"));
        })(),
        React.createElement("div",{className:"am num"},eur(shownAcc(a)))
      );
    };
    const cashAcc=(state.accounts||[]).find(isEfectivoEnt);
    const parseAmt=function(raw){ return Math.abs(parseFloat(String(raw==null?"":raw).replace(/\s/g,"").replace(",","."))||0); };
    const doSaqueCajero=function(){
      const banks=(state.accounts||[]).filter(function(a){ return a.ent && !isEfectivoEnt(a); });
      if(!banks.length){ toast("⚠ "+t("ef_need_bank")); return; }
      const bankChips=banks.map(function(a){ return { v:a.ent, label:entOf(a.ent).label }; });
      askText({ title:t("ef_cajero_bank"), sub:t("ef_cajero_bank_sub"), ph:entOf(banks[0].ent).label, ok:t("ef_cajero_next"), chips:bankChips })
        .then(function(entRaw){
          if(entRaw==null) return;
          const ent=banks.some(function(b){ return b.ent===entRaw; }) ? entRaw : banks[0].ent;
          askText({ title:t("ef_cajero_title"), sub:tf("ef_cajero_sub",{bank:entOf(ent).label}), ph:"200", ok:t("ef_cajero_ok"),
            chips:[{v:50,label:"50 €"},{v:100,label:"100 €"},{v:200,label:"200 €"}] })
            .then(function(raw){
              if(raw==null) return;
              const amt=parseAmt(raw);
              if(!(amt>0)){ toast("⚠ "+t("g_invalid")); return; }
              set(function(s){ return applySaqueCajero(s, ent, amt); });
              toast(t("ef_cajero_done"));
            });
        });
    };
    const doEntradaEfectivo=function(){
      askText({ title:t("ef_in_title"), sub:t("ef_in_sub"), ph:"20", ok:t("ef_in_ok"),
        chips:[{v:10,label:"10 €"},{v:20,label:"20 €"},{v:50,label:"50 €"}] })
        .then(function(raw){
          if(raw==null) return;
          const amt=parseAmt(raw);
          if(!(amt>0)){ toast("⚠ "+t("g_invalid")); return; }
          set(function(s){ return applyEntradaEfectivo(s, amt); });
          toast(t("ef_in_done"));
        });
    };
    const doAddEfectivo=function(){
      askText({ title:t("ef_create_title"), sub:t("ef_create_sub"), ph:"120", ok:t("ef_create_ok") })
        .then(function(raw){
          if(raw==null) return;
          const amt=raw===""?0:parseAmt(raw);
          if(raw!=="" && !(amt>=0)){ toast("⚠ "+t("g_invalid")); return; }
          set(function(s){ return ensureEfectivoAccount(s, amt); });
          toast(t("ef_create_done"));
        });
    };
    const obRow=function(o,rowKey){
      const custom=(state.obLabels||{})[o.key]; const disp=(custom!=null&&custom!=="")?custom:niceObName(o);
      // La badge va en la línea de meta, no pegada al nombre: con nombres largos (o «caducado»)
      // se cortaba y descuadraba la fila (feedback 2026-07-18).
      const dragging=!!(dragAcc&&dragAcc.from===rowKey);
      const dragOver=!!(dragAcc&&dragAcc.to===rowKey&&dragAcc.from!==rowKey);
      return React.createElement("button",{className:"v4-mov"+(dragging?" dragging":"")+(dragOver?" drag-over":""),key:rowKey,type:"button",
        "data-account-key":rowKey,"data-ob-key":o.key,"aria-label":disp+" · "+fxAmountText(o.value||0,o.cur||"EUR",state),
        title:t("drag_hint"),onClick:function(){ if(Date.now()<suppressSheetRef.current) return; setSheetAcc(rowKey); }},
        React.createElement("div",{className:"tile",style:{background:"transparent",border:"none",padding:0}},React.createElement(Mono,{ent:o.ent||"",size:44})),
        React.createElement("div",{className:"nm"},
          React.createElement("div",null, disp),
          React.createElement("div",{className:"meta"}, entOf(o.ent).label+(shareMeta(o,"ob")?" · "+shareMeta(o,"ob"):""),
            o.stale ? badge(t("pt_ob_badge")+" · "+t(o.staleKind==="expired"?"bp_st_expired":"pt_ob_stale"),"#E2A05F") : badge(t("pt_ob_badge"),"#7FB5E8"))
        ),
        React.createElement("div",{className:"am num",style:toEurAmt(o.value,o.cur,state)==null?{maxWidth:"52%",whiteSpace:"normal",textAlign:"right",overflowWrap:"anywhere",flex:"0 1 auto"}:null}, fxAmountText(o.value||0,o.cur||"EUR",state))
      );
    };
    // «Gasto diario» sigue admitiendo VARIOS bancos (v4.6.3). Modelo por debajo: UNA cuenta
    // PRINCIPAL de gasto (spendFrom — el motor necesita una sola) + bancos extra en
    // settings.expenseBanks. Lo que cambia (feedback 2026-07-21) es la selección: cada banco
    // muestra UN solo estado — o Recibos, o Gasto diario, o Todo — nada de «recibos fijo» en
    // los extras. En un extra, «Gasto diario» = expenseBanks + dailyOnlyBanks (recibos fuera);
    // «Todo» = expenseBanks sin dailyOnly (recibos y gasto diario a la vez).
    // `pickRole` vive arriba (antes de las filas): lo usa también la ficha.
    const orderedAccountRows=accountRowsInOrder(state);
    const sheetRow=orderedAccountRows.find(function(r){ return r.key===sheetAcc; })||null;
    const sheetCuenta=sheetRow&&sheetRow.kind==="ob" ? (function(){
      const o=sheetRow.item, custom=(state.obLabels||{})[o.key];
      return Object.assign({},o,{
        id:sheetRow.key, name:(custom!=null&&custom!=="")?custom:niceObName(o), _holder:o.name,
        value:toEurAmt(o.value||0,o.cur||"EUR",state), _nativeValue:o.value, _obKey:o.key, accountOrderKey:sheetRow.key
      });
    })() : (sheetRow&&sheetRow.item)||null;
    const pickSheetRole=function(a,r){
      if(a&&a._obKey&&a.value==null) return;
      if(!a||!a._obKey){ if(a) pickRole(a,r); return; }
      const nid=uid();
      set(function(s){ return promoteObAccount(s,totals,a._obKey,r,nid); });
    };
    /* CUENTAS Y BIENES SON DOS BLOQUES, NO UNO (feedback 2026-07-25: «¿por qué has metido bienes
       junto con mis cuentas? sepáralo»). Al hacer Cartera ordenable quedaron dentro del mismo
       bloque, así que el piso y el coche viajaban pegados a las cuentas del banco y no se podían
       colocar por separado. `parte` los separa sin duplicar nada: sin `parte` sigue pintando los
       dos, que es como lo usa el resto de la app. */
    return React.createElement("div",null,
      titulo && parte==="cuentas" && React.createElement("div",{className:"v4-sec-h v4-section-h"},
        React.createElement("span",null,titulo),
        React.createElement("div",{className:"v4-sec-acts"},
          /* Sin «Editar» (16/11/2026, petición suya): la ficha de cada fila ya cubre nombre, saldo,
             rol, parte suya y quitarla, también en las cuentas EXTRA de Open Banking (darles rol las
             promociona, `pickSheetRole`). El editor desplegable que abría solo era un duplicado. */
          iconos)),
      titulo && parte==="bienes" && React.createElement("div",{className:"v4-sec-h v4-section-h"},
        React.createElement("span",null,titulo),
        React.createElement("button",{type:"button",className:"link","data-act":"asset-add","aria-label":t("goods_add"),onClick:function(){setSheetAsset({});}},t("pf_add"))),
      parte!=="bienes" && React.createElement("div",{className:"v4-card-list",ref:bindListDrag},
        React.createElement(FxNotice,{missing:(state.obAccounts||[]).filter(function(o){ return toEurAmt(o.value,o.cur,state)==null; }).length}),
        orderedAccountRows.map(function(row){
          return row.kind==="account" ? accRow(row.item,row.key) : obRow(row.item,row.key);
        }),
        !cashAcc && React.createElement("button",{type:"button",className:"v4-link-mini",style:{margin:"8px 4px",display:"block"},onClick:doAddEfectivo}, t("ef_create_btn"))
      ),
      // La ficha de la cuenta que esté abierta. Portal a `body`, así que da igual dónde se monte.
      React.createElement(AccountSheet,{
        open:!!sheetCuenta, cuenta:sheetCuenta,
        state:state, set:set, totals:totals, onClose:function(){ setSheetAcc(""); },
        onRemove:removeAccount, onSaldo:guardarSaldoDe, onRole:pickSheetRole,
        rolVista:sheetRow&&sheetRow.kind==="account"?rolVistaOf(sheetRow.item):null,
        saldoMostrado:function(a){ return a&&a._obKey?a.value:shownAcc(a); },
        sincronizada:function(a){ return !!(a&&a._obKey)||isSynced(a); },
        onBankSync:onBankSync, onReconnectBank:onReconnectBank, bankBusy:bankBusy,
        onCajero:doSaqueCajero, onEntrada:doEntradaEfectivo
      }),
      parte!=="cuentas" && (state.assets||[]).length>0 && React.createElement(React.Fragment,null,
        // El título solo cuando van juntos: en Cartera lo pone la cabecera del bloque (`titulo`), y repetirlo
        // dejaría «Bienes» dos veces seguidas.
        parte!=="bienes" && React.createElement("div",{className:"v4-sec-h"}, t("pt_goods")),
        state.assets.map(function(a){
          return React.createElement("button",{className:"v4-mov",key:a.id,
            type:"button",
            style:{width:"100%",textAlign:"left",color:"var(--text)"},
            onClick:function(){ setSheetAsset(a); }},
            // Baldosa de 44 como la de las cuentas: suelto, el emoji descuadraba el texto con las filas de arriba (237, P2-9).
            React.createElement("div",{className:"tile v4-bien-tile"},a.kind==="piso"?"🏡":"🚙"),
            React.createElement("div",{className:"nm"},
              React.createElement("div",null,a.name),
              a.note && React.createElement("div",{className:"meta"},a.note)
            ),
            React.createElement("div",{className:"am num"},eur0(a.value))
          );
        })
      ),
      parte!=="cuentas" && React.createElement(React.Fragment,null,
        sheetAsset&&React.createElement(AssetSheet,{asset:sheetAsset,set:set,onClose:function(){setSheetAsset(null);}})
      )
    );
}

/* ============================================================
   TAB: GASTOS FIJOS
   ============================================================ */
const MONTHS_ES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/* ============================================================
   MOTOR DINÁMICO — calendario de gastos fijos
   Cada gasto fijo sabe en qué meses (1-12) se cobra. Si no se ha
   asignado a mano, se deriva de la frecuencia. Los anuales sin mes
   quedan "sin programar" hasta que el usuario elige el mes.
   ============================================================ */
function chargeMonths(e){
  // El anual se reparte entre meses reales: un duplicado no puede reducir su cobro (FIN-25).
  const months=e&&e.schedule&&e.schedule.length?e.schedule.map(x=>x.m):e&&e.months&&e.months.length?e.months:null;
  if(months) return Array.from(new Set(months.filter(m=>Number.isInteger(m)&&m>=1&&m<=12))).sort((a,b)=>a-b);
  const f=e&&e.freq;
  if(f==="mes"||f==="mensual") return [1,2,3,4,5,6,7,8,9,10,11,12];
  if(f==="bimestral")  return [1,3,5,7,9,11];
  if(f==="trimestral") return [1,4,7,10];
  if(f==="semestral")  return [1,7];
  return [];   // anual sin mes asignado → sin programar
}
// ¿se cobra este gasto en el mes m (1-12)?
// Con año, un mes ya pagado que el recibo nuevo ya no cobra sigue contando como suyo si «Desde
// ahora» lo dejó apuntado (`soloMes[ym].on`): editar no borra un pago del historial.
const occursIn=(e,m,y)=> chargeMonths(e).indexOf(m)>=0 || !!(y!=null&&fixedSoloMes(e,y,m)&&fixedSoloMes(e,y,m).on===true);
/* Pausa de un recibo (Plan › Recibos v6). `pausedFrom` y `pausedUntil` son año*12+mes, como
   `paidYm`: desde `pausedFrom` incluido hasta `pausedUntil` sin incluir, que es el mes en que
   vuelve («Hasta dic» = se cobra otra vez en diciembre, como en el prototipo aprobado). Son
   opcionales: un cliente sin esto los ignora y el recibo le sigue saliendo como siempre. */
function fixedPausedIn(e,y,m){
  const u=Number(e&&e.pausedUntil);
  if(!(u>0)) return false;
  const ym=y*12+m;
  return ym>=(Number(e.pausedFrom)||0)&&ym<u;
}
/* Prueba gratis (decisión del dueño del 10/11/2026: «como el diseño»). `pruebaHasta` ("AAAA-MM-DD")
   es el día en que empieza a cobrar: los meses de antes no se cobran y el prototipo los saca del
   mes (`fromNext`); el mes en que acaba sí cuenta, porque ese día cobra. Opcional, como la pausa. */
function fixedEnPruebaIn(e,y,m){
  const k=/^(\d{4})-(\d{2})-\d{2}$/.exec(String(e&&e.pruebaHasta||""));
  return !!k&&y*12+m<Number(k[1])*12+Number(k[2]);
}
/* Ese mes no se cobra: pausa o prueba gratis. Es lo que miran lo que queda por pagar, el recorrido
   de «¿Te llega?», los avisos y el año (`billsAnualDe`), para que cuadren entre sí. «Se te van cada
   mes» (`billsPausado`) y Pausar/Reanudar (`fixedPausa`) siguen leyendo solo la pausa: un recibo en
   prueba cuesta eso al mes en cuanto empieza a cobrar, como en el prototipo, y no es una pausa. */
function fixedSinCobroIn(e,y,m){
  return fixedPausedIn(e,y,m)||fixedEnPruebaIn(e,y,m);
}
/* «Solo este mes» (Plan › Recibos v6, tanda 4). `soloMes` = {[año*12+mes]: {amt?, day?}}: lo que
   ese mes concreto se cobra distinto sin tocar el recibo. «Desde ahora» lo usa también para dejar
   los meses ya pagados con las cifras con que se pagaron. Sin año (`y`) no aplica: los meses de
   otro año y las medias (`fixedMonthlyOf`) leen el recibo de siempre. Un cliente sin esto lo
   ignora y ve el importe de siempre, que es real, no inventado. */
function fixedSoloMes(e,y,m){
  const o=e&&e.soloMes&&y!=null&&e.soloMes[y*12+m];
  return o&&typeof o==="object"?o:null;
}
// importe del cobro EN EL MES m. Si hay `schedule` (importes a medida, p.ej. seguro 172,05 + 166,94)
// usa ese importe; si es anual sin schedule reparte el total entre los meses marcados; si no, amount.
function occAmountIn(e,m,y){
  const o=fixedSoloMes(e,y,m);
  if(o&&typeof o.amt==="number"&&isFinite(o.amt)&&o.amt>=0) return o.amt;
  if(e.schedule && e.schedule.length){ const s=e.schedule.find(x=>x.m===m); return s?(s.amt||0):0; }
  if(e.freq==="año"||e.freq==="anual"){ const n=chargeMonths(e).length||1; return e.amount/n; }
  return e.amount;
}
// compat: importe "representativo" de una ocurrencia (primer mes) — para etiquetas
const occAmount=(e)=> occAmountIn(e, chargeMonths(e)[0]||(new Date().getMonth()+1));
// banco del que se cobra (por defecto Sabadell)
const accOf=(e)=> e.account||"sabadell";
// día válido (1-31) o null — global para que lo usen Fijos y Deudas
const cleanDay=(v)=>{ const n=parseInt(String(v),10); return (n>=1&&n<=31)?n:null; };
// día del cobro en el mes m (schedule tiene su propio día por cobro)
// Un «día 31» en un mes de 30 es el último día de ese mes: el banco lo cobra ahí. Sin recortarlo
// salía «31 NOV», «en 22 días» y no vencía nunca, así que tampoco restaba del saldo (auditoría 9/11, P1-5).
function dayIn(e,m,y){
  const o=fixedSoloMes(e,y,m);
  let d=o&&cleanDay(o.day)?cleanDay(o.day):e&&e.schedule&&e.schedule.length?((e.schedule.find(x=>x.m===m)||{}).day||null):(e&&e.day)||null;
  // Un día imposible (32, «x») se deja tal cual: no es un 31 y no se convierte en uno válido.
  if(cleanDay(d)===Number(d)&&m>=1&&m<=12){ const fin=new Date(y||new Date().getFullYear(),m,0).getDate(); if(d>fin) d=fin; }
  /* El mes en que acaba la prueba gratis el primer cobro llega el día en que acaba, antes o después
     de su día de siempre, como el prototipo (`r.day = r.trial.day`). Solo hacia delante (revisión de
     la 221) el aviso decía «Cobra mañana» y la ficha «Se cobra el 15» del mismo recibo (auditoría de
     la 222, P1-1). Sin año (calendario, medias) no cambia nada. */
  const pk=y&&/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(e&&e.pruebaHasta||""));
  if(pk&&+pk[1]===y&&+pk[2]===m&&cleanDay(d)!=null&&cleanDay(pk[3])!=null) d=+pk[3];
  return d;
}
// día simple (objetos sin schedule: deudas)
const dayOf=(e)=> (e&&e.day)||null;
// Deudas sin día explícito: día 1 (entran en el motor de líquido como los fijos; antes quedaban
// fuera hasta cerrar mes — bug #2 «deuda no dinámica»).
function debtChargeDay(d){ const dd=dayOf(d); return (dd!=null && dd>0) ? dd : 1; }
function isDebtPaidThisMonth(d,today,s,y,m){ return s&&debtPaymentState(s,d,y,m,today).paid || debtChargeDay(d)<=today; }
// ¿ya se cobró en el mes m? (su día ya pasó o ES HOY). Solo tiene sentido para el mes actual.
// `<=`: lo programado para HOY cuenta como hecho. Clave para no duplicar la nómina/cargos del día
// con el saldo real del banco (que ya los refleja) → si no, fin de mes los sumaría por segunda vez.
// El día es una previsión editable: `paidYm` conserva el mes que el banco ya confirmó para que
// moverlo no convierta el mismo recibo en otro pendiente. Si se corrige a un día que ya ha llegado
// con feed RECIÉN sincronizado que cubre el día pero sin cargo, `wait` guarda ese año-mes e
// impide inventar el pago. Un feed viejo no sirve para negar un cobro de hoy (feedback 25/9).
// Rehacer un vínculo crea una prueba expense antes del pull. Solo su origen bancario local
// adelanta el calendario; BOOK conserva su regla anterior y las notificaciones no mueven saldo.
const isPaidIn=(e,m,t,y,s)=>{
  const year=y||new Date().getFullYear(),ym=year*12+m,d=dayIn(e,m,year);
  if(e.paidYm===ym) return true;
  const p=s&&fixedPaymentProof(s,e,year,m,t);
  return !!(p&&p.kind==="expense"&&fixedPaymentDerivedDay(s,{proof:p})) || e.wait!==ym&&d!=null&&d<=t;
};
/* «Lo pagué de otra forma» (SPEC §2.6.3) sin cargo del banco detrás: ese banco ya NO lo va a cobrar.
   Una sola regla para todo lo que resta recibos de un banco (saldo de la cuenta, pendiente y
   previsto de `totals`, «¿Te llega?», avisos de la víspera): si cada sitio lo leía a su manera, el
   previsto a fin de mes decía otra cosa que «¿Te llega?» y una cuenta manual perdía el importe el
   día del recibo (revisión de dinero 9/11, C1). Un cargo real manda sobre la marca. */
// Día del mes en que se marcó pagado a mano (`fixed.pagadoAMano`, {año*12+mes: día}), o null.
function fixedMarcadoAMano(e,y,m){
  const p=e&&e.pagadoAMano, d=p&&typeof p==="object"?Number(p[y*12+m]):NaN;
  return d>=1&&d<=31?d:null;
}
function fixedPagadoFuera(s,e,y,m,t){
  return !!s&&fixedMarcadoAMano(e,y,m)!=null&&!fixedPaymentEvidence(fixedPaymentState(s,e,y,m,t==null?new Date(y,m,0).getDate():t));
}
/* ¿YA LO RESTA EL SALDO QUE SE VE? (ronda 237). En una cuenta de recibos el saldo mostrado es
   `value + paidNet`, y `paidNet` (`monthNetForAccount`) resta el recibo con ESTA regla. Antes
   «¿Te llega?» decidía lo mismo con otra (`reciboEnElSaldo` sin el calendario) y, en una cuenta a
   mano sin lectura del banco, un alquiler de 650 € ya restado del «Tienes hoy» volvía a restarse
   en «Pagado, aún sin restar del saldo»: «Falta 34 €» donde lo justo eran 616,10 €. La usan el
   saldo (`monthNetForAccount`) y el recorrido de «¿Te llega?» (`reciboEnElSaldo`): si una cambia,
   cambian las dos, y también lo pendiente de `totals` (11, ronda 240). `bp` se calcula una vez por
   mes; quien recorre todos los recibos lo pasa con `fixedSaldoBp`. */
function fixedSaldoBp(s,y,m,t){
  const ym=y*12+m;
  return t!=null&&(s.fixed||[]).some(function(e){ return e.wait===ym; })?reconcileBank(s,y,m,t).paidAt:null;
}
function fixedRestaDelSaldo(s,e,y,m,t,bp){
  const closed=(t==null);
  if(!occursIn(e,m,y)||fixedEnPausa(s,e,y,m,closed?new Date(y,m,0).getDate():t)) return false;
  if(bp===undefined) bp=fixedSaldoBp(s,y,m,t);
  return (closed||!!(bp&&bp[e.id])||isPaidIn(e,m,t,y,s))&&!fixedPagadoFuera(s,e,y,m,t);
}
/* COBRADO ANTES DE SU DÍA Y YA LEÍDO (revisión de la 237, H3). El banco cobró el Teléfono del 8 el
   día 3 y se leyó el 4: ese saldo ya lo lleva, pero `paidNet` (la regla de arriba) lo resta al llegar
   el día 8, y el saldo pintado bajaba otra vez (970 con 1.000 en el banco; el cierre del mes lo
   arrastraba a diciembre).
   El `value` NO cambia de significado: todos los clientes lo anclan con la regla de arriba. Un móvil
   con la versión anterior y otro con esta conviven en la misma cuenta (beta y main, y el primer
   arranque tras actualizar con el Service Worker sirviendo el bundle viejo). Con un sello en la
   cuenta que cambiaba el `value`, el viejo enseñaba 1.030 con 1.000 en el banco, y si re-anclaba el
   viejo el nuevo enseñaba 970 y cerraba el mes en 890 (revisión de la 240, P2-2). Aquí la corrección
   no se guarda: se SUMA al pintar (`insumosSaldoGasto`) y al cerrar el mes (`reconcileTR`), y se
   deduce del extracto y de la hora de la lectura CON LA QUE SE ANCLÓ ese `value` (la `t` de la marca
   de abajo). Un cliente viejo sigue como siempre (con H3, sin inventar dinero).
   La hora es la de la marca y no la del banco (`obBalAt`): el servidor solo manda la del enlace si
   leyó TODAS sus cuentas, así que con otra cuenta del enlace fallando se quedaba en una lectura vieja
   mientras esta se re-anclaba hoy, y se devolvía un recibo que el saldo ya no llevaba (1.030 con el
   banco en 1.000, y el cierre también; revisión de la 240, segunda vuelta, P1). Sin marca válida
   (otro `value`, o sin hora) no se devuelve nada.
   Cuenta un recibo si:
   - lo resta la regla de arriba SOLO por calendario (con marca `paidYm` o prueba de un cargo
     enlazado ya restaba antes, y si esa marca llegó después de leer, `conSaldoMostrado` ya movió el
     `value`; en un mes con `wait` se queda como estaba);
   - su día llegó DESPUÉS de la lectura (lo de antes ya era neutro al anclar), o no tiene día y el mes
     está cerrado;
   - un cargo del banco (BOOK, o su fila de Open Banking) lo pagó como muy tarde el día de la lectura.
   Solo en la cuenta que carga el neto y si la lee Open Banking: el extracto no es el saldo de una
   cuenta a mano (el alquiler BOOK de 750 de `fixed-ispaidin`). ⚠ Con dos cuentas de recibos en el
   banco `fixedPaymentState` no casa el cargo solo: ahí H3 sigue como antes (P3-2). */
/* MARCA DE ANCLAJE POR CUENTA (ronda 240): «este `value` se ancló con las reglas N». Una regla que
   CAMBIA lo que significa `value` (lo que se resta al anclar o al cerrar el mes) solo se puede aplicar
   a una cuenta anclada con ella: un móvil con la versión anterior conserva los campos que no conoce
   (`Object.assign`) y re-ancla con su regla, y si la marca fuera solo «r» el nuevo leería un `value`
   viejo como nuevo (revisión de la 240, P2-2 en recibos y P2-B en saldos). Por eso la marca lleva el
   `value` con el que se puso y solo vale mientras coincide: cualquier escritura de `value` que no la
   renueve (un cliente viejo, o código nuevo que aún no la conoce) la invalida sola y la cuenta vuelve
   a leerse con la regla de antes. Falla hacia lo de siempre, nunca hacia una mezcla.
   Lleva también la hora de la lectura de ESA cuenta (`t`, el `balanceAt` por cuenta que manda el
   servidor) con la que se ancló: la de H3 de arriba.
   La ponen `applyBankBalances` al re-anclar; la renuevan, con la misma `t`, el cierre de mes
   (`reconcileTR`) y todo lo que desplaza `value` sin cambiar su significado (`conValor`), si ya valía.
   La usa también la regla del posible repetido (ronda 240 saldos): el ancla nueva lo deja fuera del
   `value` y un cierre viejo lo restaría otra vez (ver `cierreConReglaVieja`, 01). */
const ANCLA_REGLAS=240;
function anclaConReglas(a, r){
  const m=a&&a.anclaReglas;
  return !!m&&typeof m==="object"&&Number(m.r)>=(r==null?ANCLA_REGLAS:r)&&Math.abs((Number(m.v)||0)-(Number(a.value)||0))<=0.005;
}
function selloAncla(value, t){ return {r:ANCLA_REGLAS, v:+(Number(value)||0).toFixed(2), t:t||null}; }
/* La cuenta con otro `value` que NO cambia con qué reglas se ancló (desplazar para conservar lo pintado,
   pasarse el neto entre hermanas, cambiar de rol, migrar, resolver un posible repetido): si la marca
   valía, se renueva con el `value` nuevo y la misma hora. Sin esto, reordenar una cuenta de Open
   Banking la dejaba sin marca y su cierre siguiente la trataba como anclada por un cliente viejo
   (revisión 240-saldos, segunda vuelta, P2-B punto 2). */
function conValor(a, v){
  return Object.assign({}, a, {value:v}, anclaConReglas(a)?{anclaReglas:selloAncla(v, a.anclaReglas.t)}:null);
}
// Hora (ms) de la lectura con la que se ancló el `value` de la cuenta que lleva los recibos del banco; 0 si no se sabe.
function lecturaDeSusRecibos(s, ent){
  const c=cuentaDelNetoDeBanco(s.accounts, ent);
  /* Rancia (su saldo falló en la última sincronización): no se devuelve nada. Su `value` sigue siendo
     el de la marca, pero se prefiere lo prudente: pinta como siempre (970 con el banco en 1.000, H3
     de la base, de menos) hasta la próxima lectura buena. */
  if(!c||!(c.bankIban||c.bankUid||c.balSaldo!=null)||c.balanceStale||!anclaConReglas(c)) return 0;
  const t=Date.parse(c.anclaReglas.t);
  return isFinite(t)&&t>0?t:0;
}
/* Cargos BOOK de cada banco ordenados por importe, una vez por extracto: filtro barato antes de casar
   el recibo. `fixedPaymentState` cuesta (recorre el extracto y los demás recibos): llamarlo por cada
   recibo en cada pintado llevaba `totals` de 255 a 796 ms con 25 recibos y 1.000 movimientos (revisión
   de la 240, P2-1). Solo pasa un recibo con una prueba guardada del mes, o con un cargo del mes de
   importe parecido, con fecha no posterior a la lectura, que lleve su nombre (o, si su día ya llegó,
   aunque no lo lleve: `fixedPaymentState` casa también por importe, pero nunca antes de su día). Sin
   la fecha, a final de mes con una lectura de hace días pasaban todos los recibos cobrados en su día y
   `totals` casi se duplicaba (segunda vuelta, P2). Un cargo cuya fecha contable el banco corrija a
   otro día se queda fuera: H3 de siempre, de menos. */
const _cargosBookPorBanco=new WeakMap();
function cargosBookDelBanco(s, ent){
  const tx=s.bankTx||[];
  let porBanco=_cargosBookPorBanco.get(tx);
  if(!porBanco){
    porBanco={};
    tx.forEach(function(x){ if(x&&String(x.status||"").toUpperCase()==="BOOK"&&Number(x.amount)>0) (porBanco[x.ent]=porBanco[x.ent]||[]).push({a:Number(x.amount),m:x.merchant,d:String(x.date||"").slice(0,10)}); });
    Object.keys(porBanco).forEach(function(k){ porBanco[k].sort(function(p,q){ return p.a-q.a; }); });
    _cargosBookPorBanco.set(tx, porBanco);
  }
  return porBanco[ent]||[];
}
function puedeHaberloCobrado(s,e,y,m,t,target,rd){
  if(e.paymentProofs&&e.paymentProofs[y*12+m]) return true;
  const lista=cargosBookDelBanco(s,accOf(e)), dd=dayIn(e,m,y), porImporte=t==null||dd!=null&&dd<=t;
  const mes=y+"-"+String(m).padStart(2,"0")+"-", hasta=mes+String(rd).padStart(2,"0");
  // Sin su nombre, `fixedPaymentPorImporte` exige el céntimo y el día a ±`CUOTA_DIAS` de su ventana: un
  // cargo cualquiera que solo se le parezca en el importe no lo paga, y no merece casarlo.
  const ventana=porImporte?fixedPaymentContender(e,y,m):null, cents=Math.round(target*100);
  // Primer cargo dentro de la tolerancia de `recAmtClose` (búsqueda binaria; la tolerancia nunca pasa del 2 % o 0,50).
  const desde=target-Math.max(0.5,0.021*target);
  let lo=0,hi=lista.length;
  while(lo<hi){ const mid=(lo+hi)>>1; if(lista[mid].a<desde) lo=mid+1; else hi=mid; }
  for(let i=lo;i<lista.length&&lista[i].a<=target*1.03+0.5;i++){
    const x=lista[i];
    if(x.d.slice(0,8)!==mes||x.d>hasta||!recAmtClose(target,x.a)) continue;
    if(recNameMatch(e.name,x.m)) return true;
    const dia=Number(x.d.slice(8,10));
    if(ventana&&ventana.day!=null&&Math.round(x.a*100)===cents&&dia>=ventana.dMin-CUOTA_DIAS&&dia<=ventana.dMax+CUOTA_DIAS) return true;
  }
  return false;
}
// Día del cargo del banco que pagó el recibo, si fue como muy tarde el de la lectura `r` (ms); si no, null.
function fixedCobradoAntesDeLeer(s,e,y,m,t,r){
  if(!(r>0)) return null;
  const l=new Date(r);
  if(l.getFullYear()*12+l.getMonth()+1!==y*12+m) return null;
  const target=typeof e.bankAmount==="number"&&e.bankAmount>0?e.bankAmount:occAmountIn(e,m,y);
  if(!puedeHaberloCobrado(s,e,y,m,t,target,l.getDate())) return null;
  const d=diaDelCargoQuePaga(s,e,y,m,t==null?new Date(y,m,0).getDate():t);
  return d>=1&&d<=l.getDate()?d:null;
}
/* El día del cargo del banco que paga el recibo (`fixedPaymentDerivedDay` de `fixedPaymentState`),
   recordado mientras no cambie nada de lo que lee el casado: el saldo, el previsto y «¿Te llega?» lo
   piden en el mismo pintado y cada vez recorría el extracto entero (P2-1). Las claves son los arrays
   del estado: cualquier cambio de extracto, recibos, gastos, vetos, lápidas, cuentas, cuotas o
   puntuales los sustituye y la memoria vieja se queda sin usar. */
const _diaCargoMemo=new WeakMap(), _sinDato={};
function diaDelCargoQuePaga(s,e,y,m,t){
  let nodo=_diaCargoMemo;
  [s.bankTx,s.fixed,s.expenses,s.reciboNo,s.deleted,s.accounts,s.debts,s.oneoffs].forEach(function(k){
    const o=k&&typeof k==="object"?k:_sinDato;
    let sig=nodo.get(o); if(!sig){ sig=new WeakMap(); nodo.set(o,sig); } nodo=sig;
  });
  let porRecibo=nodo.get(e); if(!porRecibo){ porRecibo=new Map(); nodo.set(e,porRecibo); }
  const k=y+"|"+m+"|"+t;
  if(!porRecibo.has(k)){ const st=fixedPaymentState(s,e,y,m,t); porRecibo.set(k, st.paid?Number(fixedPaymentDerivedDay(s,st))||0:0); }
  return porRecibo.get(k);
}
// Lo que hay que devolverle a `paidNet` de un banco (t null = mes cerrado). Ver arriba.
/* Recordado por los arrays que lee y por la lectura de la marca (que ya dice si vale con el `value` de
   hoy): `conSaldoMostrado` pide el saldo de antes y el de después, y el de antes ya lo calculó `totals`
   con el mismo estado (segunda vuelta, P2). */
const _devueltoMemo=new WeakMap();
function cobrosLeidosDelMes(s, ent, y, m, t){
  const r=lecturaDeSusRecibos(s, ent);
  if(!(r>0)) return 0;
  const l=new Date(r), ym=y*12+m;
  if(l.getFullYear()*12+l.getMonth()+1!==ym) return 0;
  let nodo=_devueltoMemo;
  [s.bankTx,s.fixed,s.expenses,s.reciboNo,s.deleted,s.debts,s.oneoffs].forEach(function(k){
    const o=k&&typeof k==="object"?k:_sinDato;
    let sig=nodo.get(o); if(!sig){ sig=new WeakMap(); nodo.set(o,sig); } nodo=sig;
  });
  let porClave=nodo.get(_sinDato); if(!porClave){ porClave=new Map(); nodo.set(_sinDato,porClave); }
  // El casado mira cuántas cuentas de recibos tiene el banco: va en la clave, como la lectura.
  const fijas=(s.accounts||[]).filter(function(a){ return a&&a.ent===ent&&accFixed(a); }).length;
  const clave=[ent,y,m,t,r,fijas].join("|");
  if(porClave.has(clave)) return porClave.get(clave);
  const rd=l.getDate();
  let bp, conBp=false, devuelve=0;
  (s.fixed||[]).forEach(function(e){
    if(accOf(e)!==ent||e.paidYm===ym||e.wait===ym) return;
    const dd=dayIn(e,m,y);
    if(t==null ? (dd!=null&&dd<=rd) : (dd==null||dd<=rd||dd>t)) return;
    // Lo barato primero: casi nunca hay un cargo anterior a la lectura que lo pague.
    if(fixedCobradoAntesDeLeer(s,e,y,m,t,r)==null) return;
    const p=fixedPaymentProof(s,e,y,m,t==null?new Date(y,m,0).getDate():t);
    if(p&&p.kind==="expense"&&fixedPaymentDerivedDay(s,{proof:p})) return;
    if(!conBp){ bp=fixedSaldoBp(s,y,m,t); conBp=true; }
    if(!fixedRestaDelSaldo(s,e,y,m,t,bp)) return;
    devuelve+=occAmountIn(e,m,y);
  });
  porClave.set(clave, devuelve);
  return devuelve;
}
/* ¿El «Tienes hoy» de su banco lleva ya restado este recibo (TU parte, `occAmountIn`)? Solo en un
   banco con cuenta de recibos (las de gasto diario no llevan `paidNet`) y con `fixedRestaDelSaldo`.
   Con lectura del banco, al anclar se sumó el `paidNet` de ese momento: lo que ya restaba al leer
   queda neutro, así que solo cuenta si empezó a restar DESPUÉS de la lectura (el día de la lectura
   con el reloj del móvil, como `today`). Sirve igual para un recibo pagado que para uno sin cobro
   (revisión de la 237, H2). Empieza a restar el día del calendario; si no resta por calendario
   (`wait`), el día del cobro que da el extracto (`bp`). Con su día de calendario, un recibo en
   espera al leer el 9 y cobrado el 10 salía «ya dentro de lo leído» y «¿Te llega?» lo restaba otra
   vez (revisión de la 237, H4: mínimo 30 € más bajo). Si la espera llegó después de la lectura, el
   `value` ya se desplazó para no mover el saldo (`conSaldoMostrado`): da lo mismo. */
function fixedEnSaldoMostrado(s,e,y,m,t,leidoMs,bp){
  if(bp===undefined) bp=fixedSaldoBp(s,y,m,t);
  if(!(s.accounts||[]).some(function(a){ return a&&a.ent===accOf(e)&&accFixed(a); })||!fixedRestaDelSaldo(s,e,y,m,t,bp)) return false;
  if(!(leidoMs>0)) return true;
  const l=new Date(leidoMs),lm=l.getFullYear()*12+l.getMonth()+1;
  const dd=isPaidIn(e,m,t,y,s)?dayIn(e,m,y):(bp&&bp[e.id])||dayIn(e,m,y);
  return !(lm>y*12+m||lm===y*12+m&&dd!=null&&dd<=l.getDate());
}
const isPaidThisMonth=(e,today)=>{ const d=dayOf(e); return d!=null && d<=today; };
// ¿el gasto necesita que el usuario le asigne un mes? (anual sin programar)
const needsMonth=(e)=> (e.freq==="año"||e.freq==="anual") && !(e.months&&e.months.length) && !(e.schedule&&e.schedule.length);
// ¿tiene importes/días a medida por cobro?
const hasSchedule=(e)=> !!(e&&e.schedule&&e.schedule.length);

/* --- Días laborables (lun-vie; sin festivos, aproximación) --- */
// día del mes (número, mes 1-12) del primer/último día laborable
function firstWorkDom(y,m){ for(let d=1;d<=7;d++){ const wd=new Date(y,m-1,d).getDay(); if(wd!==0 && wd!==6) return d; } return 1; }
function lastWorkDom(y,m){ const last=new Date(y,m,0).getDate(); for(let d=last;d>=1;d--){ const wd=new Date(y,m-1,d).getDay(); if(wd!==0 && wd!==6) return d; } return last; }
// día efectivo de un movimiento recurrente según su regla (`when`) o su día fijo
function flowDay(f,y,m){ if(f.when==="last") return lastWorkDom(y,m); if(f.when==="first") return firstWorkDom(y,m); return f.day||null; }
const flowPaid=(f,y,m,today)=>{ const d=flowDay(f,y,m); return d!=null && d<=today; };
// Movimientos recurrentes (nómina/transferencias): por defecto cada mes salvo que tengan months
const flowMonths=(f)=> (f&&f.months&&f.months.length)?f.months:[1,2,3,4,5,6,7,8,9,10,11,12];
// Un flow puntual (f.once={y,m}) solo ocurre en ese mes/año concreto (como un cargo puntual);
// el resto son recurrentes (mensuales por defecto). Si f.once existe, el año importa.
const flowOccursIn=(f,m,y)=> f && f.once ? (f.once.y===y && f.once.m===m) : (flowMonths(f).indexOf(m)>=0);
// ¿este flow puntual ya pasó (mes/año cerrado)? para ocultarlo de la lista una vez cumplido
const flowOncePast=(f,y,m)=> f && f.once && (f.once.y<y || (f.once.y===y && f.once.m<m));
// Cargos puntuales (un solo cobro en un mes/año concreto): imprevistos, amortizaciones…
const oneoffOccurs=(o,y,m)=> o && o.year===y && o.month===m;
const oneoffPast=(o,y,m)=> o && (o.year<y || (o.year===y && o.month<m));   // de un mes ya cerrado

/* --- Deuda dinámica: saldo proyectado que baja solo cada mes ---
   No mutamos el dato guardado (para no descuadrar la sync). `value` es el saldo
   ANCLA y `asOf` el mes (entero absoluto año*12+mes) en que era cierto. El saldo
   de hoy = value − amortización/mes × meses transcurridos, con suelo en 0.
   `amort` es lo que reduce el principal (por defecto la cuota); puede diferir de la
   cuota en efectivo (p.ej. préstamo familiar: paga 197 € pero amortiza 250 €/mes). */
const ymAbs=(y,m0)=> y*12+m0;                         // m0 = mes 0-indexado
// Las anclas de deuda comparten el calendario de Inicio: en UTC aún puede ser el mes anterior.
const ymNow=()=>{ const p=madridYmdParts(Date.now()); return ymAbs(p.y, p.m-1); };
const debtAmort=(d)=> d && d.amort!=null ? d.amort : ((d&&d.monthly)||0);
// nº de pagos ya hechos. Una financiación (con `months`) cuenta TAMBIÉN el pago de ESTE mes si ya pasó
// su día (ej. financias el 599/4 con día 26 y hoy es 28 → el 1er pago del 26 ya cuenta).
// Un ancla en un mes que aún no ha llegado es una compra a plazos cuya 1.ª cuota cae ese mes («¿Y si gasto…?»
// › «A plazos», 11/11/2026): hasta entonces no hay nada pagado. Las altas de Deudas nunca anclan en el futuro.
// Con plazo, nunca más de `months`: pasado el plazo no se cobra nada, así que tampoco se paga nada
// (sin tope el saldo seguía bajando solo, sin ningún cobro; revisión externa 15/11/2026).
function debtPaidCount(d){ const n=debtCuotasDesdeAncla(d); return d.months!=null?Math.min(n,Math.max(0,d.months)):n; }
/* Lo mismo SIN tope: las cuotas que han vencido desde el ancla. Lo usan solo editar y amortizar, que
   re-anclan una deuda ya vencida con saldo (dato heredado) contando desde hoy: con el tope, el plazo
   nuevo quedaba antes de hoy y la deuda no volvía a cobrar nunca. */
function debtCuotasDesdeAncla(d){ const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(); if(anchor>ymNow()) return 0; let n=Math.max(0, ymNow()-anchor); if(d.months!=null){ const dd=debtChargeDay(d); if(dd<=madridYmdParts(Date.now()).d) n+=1; } return n; }
/* LA ÚLTIMA CUOTA SE LLEVA EL REDONDEO (revisión externa 15/11/2026). La cuota se guarda redondeada al
   céntimo y se cobraba igual los n meses: 600,03 en 12 sumaba 600,00 y dejaba 0,03 debidos para
   siempre; 1.199,99 en 7 cobraba 1.200,01. En céntimos, la última amortiza lo que falta: principal
   (value − pago final) − (n − 1) × amort. Devuelve cuánto se aparta de `amort` (céntimos, con signo).
   null = no aplica: sin plazo, o un saldo que el plazo no cubre ni de lejos (más de un céntimo por
   cuota de diferencia, dato heredado): eso no es redondeo y darlo por pagado sería inventar. Una
   última parcial tras amortizar (350 con cuota 100 → 100, 100, 100 y 50) sí aplica. */
function debtUltimaAjuste(d){
  if(!d||d.months==null||!(d.months>=1)) return null;
  const n=d.months, A=Math.round(debtAmort(d)*100), P=Math.round((Number(d.value)||0)*100)-Math.round((Number(d.balloon)||0)*100);
  if(!(A>0)||!(P>0)) return null;
  const last=P-(n-1)*A;
  return last>0&&last<=A+n?last-A:null;
}
// Saldo tras `n` cuotas pagadas. Con el ajuste de la última, acabado el plazo no queda nada.
function debtBalanceAfter(d, n){
  if(d.months!=null){ n=Math.min(n,d.months); if(n>=d.months&&debtUltimaAjuste(d)!=null) return 0; }
  let b=d.value - debtAmort(d)*n; if(d.balloon>0 && d.months!=null && n>=d.months) b-=d.balloon; return Math.max(0, b);
}
/* La cuota en EFECTIVO del mes (y, m 1-12; sin mes, el de hoy): `monthly`, salvo la última de un plazo,
   que lleva el ajuste. Solo cuando la cuota ES lo que amortiza (financiación al 0 %): si difieren
   (intereses, préstamo familiar que paga 197 y baja 250) lo que el banco cobre el último mes no lo
   sabemos y se queda la cuota de siempre. El pago final va aparte (`debtBalloonIn`). */
function debtCuotaIn(d, y, m){
  const q=Number(d&&d.monthly)||0;
  if(!(q>0)||d.months==null||Math.round(debtAmort(d)*100)!==Math.round(q*100)) return q;
  if(y==null){ const p=madridYmdParts(Date.now()); y=p.y; m=p.m; }
  const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(), adj=debtUltimaAjuste(d);
  return adj!=null&&(y*12+(m-1))===anchor+d.months-1 ? (Math.round(q*100)+adj)/100 : q;
}
// Financiación tipo coche: además de entrada (downPayment, ya pagada = informativa) y cuotas,
// hay un PAGO FINAL (balloon) en el último mes del plazo. debtBalloonIn(d,y,m): balloon si (y,m 1-12)
// es ese último mes; 0 si no. La amort lineal ya se fija a (value−balloon)/months al crear la deuda,
// así el saldo baja con las cuotas y el balloon limpia el resto al final.
function debtBalloonIn(d, y, m){ if(!d || !(d.balloon>0) || d.months==null) return 0; const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(); return (y*12+(m-1))===(anchor+d.months-1) ? d.balloon : 0; }
function debtBalance(d){ if(!d || d.value==null) return 0; return debtBalanceAfter(d, debtPaidCount(d)); }
// ¿la cuota sigue cobrándose este mes? Una financiación (con `months` = plazo) deja de
// cobrar al acabar el plazo o al llegar el saldo a 0. Sin plazo (hipoteca/préstamo): mientras quede saldo.
/* ¿Es (y, m 1-12) el mes de la ÚLTIMA cuota de un plazo? Pagada la última, el saldo es 0 y la deuda
   deja de estar activa; pero el cargo de ese mes sigue siendo su cuota (revisión de dinero 234, H-A2). */
function debtUltimaCuotaEn(d, y, m){
  if(!d||!(Number(d.monthly)>0)||d.months==null||!(d.months>=1)) return false;
  const anchor=(typeof d.asOf==="number")?d.asOf:ymNow();
  return y*12+(m-1)===anchor+d.months-1;
}
/* Para el motor que reconoce cuotas en lo que trae el banco: la deuda activa, o una cuya última cuota
   cae este mes o el anterior hace pocos días (el banco a veces apunta el cargo con retraso). Sin esto el
   cargo de la última, que deja el saldo a 0, entraba como gasto. Que el cargo sea de un mes del plazo
   lo mira `debtCuotaDelPlazo`. */
const DEBT_GRACIA_DIAS=10;
function debtCuotaReciente(d){
  if(debtActive(d)) return true;
  if(!d||!(Number(d.monthly)>0)||d.months==null||!(d.months>=1)) return false;
  const p=madridYmdParts(Date.now()), now=ymAbs(p.y,p.m-1), last=((typeof d.asOf==="number")?d.asOf:ymNow())+d.months-1;
  return now===last||(now===last+1&&p.d<=DEBT_GRACIA_DIAS);
}
// ¿La clave «id|año-mes» de una cuota cae dentro del plazo? (sin plazo, siempre).
function debtCuotaDelPlazo(d, key){
  if(!d||d.months==null) return true;
  const mm=/\|(\d+)-(\d+)$/.exec(String(key||""));
  if(!mm) return true;
  const anchor=(typeof d.asOf==="number")?d.asOf:ymNow();
  return Number(mm[1])*12+Number(mm[2])-1<=anchor+d.months-1;
}
function debtActive(d){ if(!d || !d.monthly) return false; const bal=debtBalance(d); if(d.months!=null){ const anchor=(typeof d.asOf==="number")?d.asOf:ymNow(); return ymNow()>=anchor && (ymNow()-anchor) < d.months && bal>0.005; } return bal>0.005; }
/* ¿Se cobra la cuota en el mes (y, m 1-12) que se mira? Con el ancla en este mes o antes es `debtActive`
   tal cual (mira hoy, como siempre). Solo una compra a plazos que aún no ha empezado (ancla futura,
   «¿Y si gasto…?») se mira por el mes pedido: su 1.ª cuota tiene que salir en la vista del mes que viene
   de Recibos, que antes la daba en 0 (revisión de dinero 229, ronda 2). */
function debtActiveIn(d, y, m){
  const anchor=d&&typeof d.asOf==="number"?d.asOf:ymNow();
  if(!d||!d.monthly||d.months==null||anchor<=ymNow()) return debtActive(d);
  const ym=y*12+(m-1);
  return ym>=anchor && ym<anchor+d.months && Number(d.value)>0.005;
}
// cuotas que quedan de una financiación (null si no tiene plazo)
function debtLeft(d){ if(!d || d.months==null) return null; return Math.max(0, d.months - debtPaidCount(d)); }
// Movimientos netos de un banco en un mes (m 1-12): +ingresos −fijos −cuotas −puntuales −traspasos
// que salen +traspasos que le llegan de otro banco tuyo (`flowAbonaEn`, 08).
// todayLim null = mes cerrado (cuentan todos); número = solo los YA ocurridos (día <= todayLim, regla isPaidIn).
function monthNetForAccount(s, ent, y, m, t){
  const closed=(t==null);
  const hit=function(d){ return closed ? true : (d!=null && d<=t); };
  const bp=fixedSaldoBp(s,y,m,t);
  let net=0;
  // El recibo, con la regla compartida con «¿Te llega?» (`fixedRestaDelSaldo`).
  (s.fixed||[]).forEach(function(e){ if(accOf(e)===ent && fixedRestaDelSaldo(s,e,y,m,t,bp)) net -= occAmountIn(e,m,y); });
  (s.debts||[]).forEach(function(d){ if(debtActive(d) && (d.account||"sabadell")===ent && hit(debtChargeDay(d))) net -= debtCuotaIn(d,y,m) + debtBalloonIn(d,y,m); });
  (s.oneoffs||[]).forEach(function(o){ if(oneoffOccurs(o,y,m) && (o.account||"sabadell")===ent && (o.amount||0)!==0 && hit(o.day!=null?o.day:null)) net -= o.amount; });
  // El traspaso sale el día previsto; al destino llega ese día, o antes si su banco ya lo trajo.
  (s.flows||[]).forEach(function(f){
    if(!flowOccursIn(f,m,y)) return;
    const pd=flowDay(f,y,m), bd=flowConfirmedDay(f,y,m), dd=bd!=null?bd:pd;
    if(f.kind==="income"){ if((f.to||"sabadell")===ent && hit(dd)) net += (f.amount||0); }
    else if(f.kind==="transfer"){
      if((f.from||"sabadell")===ent && hit(pd)) net -= (f.amount||0);
      if(flowAbonaEn(s,f,y,m)===ent && hit(dd)) net += (f.amount||0);
    }
  });
  return net;
}

