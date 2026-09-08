/* ============================================================
   APP
   ============================================================ */
/* Mini-tutorial por pestaña: la primera vez que se abre una pestaña sale desplegado
   (feedback: «mi pareja no encontraba el lápiz de editar gastos»); al cerrarlo queda un
   botoncito «💡 ¿Cómo va esto?» para releerlo. Estado por pestaña en localStorage. */
const TabCoach=React.memo(function TabCoach({tabId}){
  const tips=t("coach_"+tabId);
  // v2 en roles Gastos/Fijos/Patri: tras aclarar variable vs fijo + filtro banco (2026-07-16)
  // se vuelve a mostrar una vez aunque ya hubieran cerrado el coach antiguo.
  const coachKey="_coach_"+tabId+((tabId==="gastos"||tabId==="fijos"||tabId==="patri")?"_v2":"");
  const [seen,setSeen]=useState(function(){ try{ return localStorage.getItem(coachKey)==="1"; }catch(e){ return true; } });
  const [open,setOpen]=useState(!seen);
  if(!Array.isArray(tips)||!tips.length) return null;
  const dismiss=function(){ try{ localStorage.setItem(coachKey,"1"); }catch(e){} setSeen(true); setOpen(false); };
  if(!open) return React.createElement("button",{className:"coach-pill",onClick:function(){ setOpen(true); }},"💡 "+t("coach_btn"));
  return React.createElement("div",{className:"coach-card"},
    React.createElement("div",{style:{fontWeight:800,fontSize:13.5,color:"var(--text)",marginBottom:4}},"💡 "+tf("coach_title",{tab:t("tab_"+tabId)})),
    tips.map(function(tip,i){ return React.createElement("div",{key:i,style:{display:"flex",gap:8,fontSize:12.5,color:"var(--muted)",lineHeight:1.5,marginTop:5}},
      React.createElement("span",{style:{flex:"0 0 auto"}},"·"),React.createElement("span",null,tip)); }),
    React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:10},onClick:dismiss},t("coach_ok"))
  );
});
const TABS=[
  {id:"dash",label:"Inicio",icon:I.home},
  {id:"gastos",label:"Gastos",icon:I.expense},
  {id:"plan",label:"Plan",icon:I.calendar},
  {id:"cartera",label:"Cartera",icon:I.invest},
];
// v4: nav fija 5 slots (4 tabs + FAB). Los destinos viejos viven dentro de Plan/Cartera/Ajustes.
const ADVANCED_TABS=[];
const SIMPLE_DASH_HIDDEN=[];
function tabHiddenOf(s){
  return [];
}
function tabOrderOf(s){
  return ["dash","gastos","plan","cartera"];
}

/* ============================================================
   ACTUALIZACIONES — hook único (2026-07-18)
   ============================================================
   La app tiene TRES canales de update y estaban desperdigados por App en efectos sueltos
   («spaghetti», feedback 2026-07-18). Este hook los agrupa; el transporte de bajo nivel
   (descargas, notis, service worker) sigue en 12-boot.js, que publica window._mc* y avisa
   por eventos. El mapa completo:
     1) WEB (PWA):  Service Worker esperando  → evento "mc-sw-update"  → pill «actualizar».
     2) OTA (APK):  bundle web nuevo (Capgo)  → evento "mc-ota-ready"  → pill; entra solo
        al próximo arranque si no lo tocas.
     3) APK:        apk.json con versionCode mayor → evento "mc-apk-update" → instalador.
   Chequeos: al arrancar (tick 150ms), al volver a primer plano y cada 30 min. */
function useUpdates(){
  // 1) SW web esperando
  const [updateReady,setUpdateReady]=useState(false);
  useEffect(function(){
    const h=function(){ setUpdateReady(true); if(window._mcNotifyUpdate) window._mcNotifyUpdate(null); };
    window.addEventListener("mc-sw-update", h);
    return function(){ window.removeEventListener("mc-sw-update", h); };
  },[]);
  // 2) OTA: pill también mientras descarga (hay _otaPending más nuevo aunque el bundle no esté listo)
  const readOta=function(){
    if(window._mcOtaReady&&window._mcOtaReady.id) return true;
    try{
      var p=localStorage.getItem("_otaPending");
      return !!(p&&window._mcNewerVer&&window._mcNewerVer(p, CONFIG.APP_VERSION));
    }catch(e){ return false; }
  };
  const [otaReady,setOtaReady]=useState(readOta);
  useEffect(function(){
    const h=function(){ setOtaReady(readOta()); };
    window.addEventListener("mc-ota-ready", h);
    if(window._mcRestoreOtaPending) window._mcRestoreOtaPending();
    var tick=function(){
      if(window._mcCheckOtaUpdates) window._mcCheckOtaUpdates();
      if(window._mcCheckApkUpdate) window._mcCheckApkUpdate();
    };
    setTimeout(tick, 150);
    var onVis=function(){ if(document.visibilityState==="visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    var iv=setInterval(tick, 30*60*1000);
    return function(){
      window.removeEventListener("mc-ota-ready", h);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
  },[]);
  // 3) APK nativo
  const [apkUpd,setApkUpd]=useState(window._mcApkUpdate||null);
  useEffect(function(){
    const h=function(){ setApkUpd(window._mcApkUpdate||null); };
    window.addEventListener("mc-apk-update", h);
    return function(){ window.removeEventListener("mc-apk-update", h); };
  },[]);
  // Acciones (la pill/el toast las pinta App; aquí solo la lógica).
  const applyUpdate=function(showToast){
    if(otaReady){
      if(window.__mcApplyOta){ window.__mcApplyOta(); return; }
      if(showToast) showToast(t("upd_downloading"));   // pending sin bundle listo aún
      return;
    }
    if(window.__mcApplyUpdate) window.__mcApplyUpdate();
  };
  const installApk=function(showToast){
    const nat=natPlugin();
    // Tocar el pill y que no ocurra NADA es el peor final posible: no sabes si has fallado el
    // toque, si la app está pensando o si se ha rendido (2026-07-26). Cada motivo, dicho.
    if(!nat) { if(showToast) showToast(t("apk_why_noapp")); return; }
    if(!nat.installApk){ if(showToast) showToast(t("apk_why_oldapk")); return; }
    if(!apkUpd){
      // Sin candidata: no es un fallo, es que el chequeo no encontró nada — y el porqué lo
      // dejó escrito quien lo miró.
      if(showToast) showToast(window._mcApkWhy||t("st_up_ok"));
      return;
    }
    if(showToast) showToast(t("apk_downloading"));
    nat.installApk({url:apkUpd.url}).then(function(r){
      if(r&&r.needsPermission&&showToast){ showToast(t("apk_perm")); return; }   // Android abrió el ajuste; reintocar
    }).catch(function(e){ if(showToast) showToast("⚠ "+((e&&e.message)||e)); });
  };
  const otaDownloaded=!!(window._mcOtaReady&&window._mcOtaReady.id);
  return { updateReady:updateReady, otaReady:otaReady, otaDownloaded:otaDownloaded, apkUpd:apkUpd, applyUpdate:applyUpdate, installApk:installApk };
}

/* Pantalla de bloqueo: pide huella al abrir la app cuando el candado está activado. */
function LockScreen({onUnlock}){
  const [err,setErr]=useState(false);
  const tryUnlock=function(){ setErr(false); bio.unlock().then(onUnlock).catch(function(){ setErr(true); }); };
  useEffect(function(){ const t=setTimeout(tryUnlock,350); return function(){ clearTimeout(t); }; },[]);
  const wrap={position:"fixed",inset:0,background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,color:"var(--text)",gap:"16px",padding:"24px",textAlign:"center"};
  const btn={padding:"14px 22px",borderRadius:"14px",border:"none",background:"var(--mint)",color:"#06120C",fontWeight:700,fontSize:"15px",cursor:"pointer"};
  const escape=function(){
    // la pantalla del candado va ANTES del árbol de la app: si AskHost aún no está montado,
    // askConfirm cae solo al confirm nativo (ver askDialog) y la salida de emergencia sigue viva.
    askConfirm({ title:t("lk_escape"), sub:t("lk_escape_sub"), ok:t("lk_escape_ok"), danger:true })
      .then(function(yes){ if(yes){ bio.disable(); onUnlock(); } });
  };
  const link={background:"none",border:"none",color:"var(--muted-2)",cursor:"pointer",fontSize:"12px",marginTop:"10px",textDecoration:"underline"};
  return React.createElement("div",{style:wrap},
    React.createElement("div",{style:{width:64,height:64,borderRadius:"50%",background:"#5FD08A22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px"}},"🔒"),
    React.createElement("div",{style:{fontWeight:700,fontSize:"22px",fontFamily:"Fraunces, serif"}},"Mi cartera"),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:"14px"}}, err?t("lk_failed"):t("lk_unlock")),
    React.createElement("button",{style:btn,onClick:tryUnlock},t("lk_unlockbtn")),
    React.createElement("button",{style:link,onClick:escape},t("lk_cant"))
  );
}

/* Panel de cuenta: login/registro con contraseña y toggle de huella. */
function AuthPanel({session, onClose, showToast, recovery, startMode}){
  const uid = session && session.user ? session.user.id : null;
  // startMode: "up" abre directo en "Crear cuenta" (onboarding → registro sin pasar por login;
  // feedback pareja 2026-07-10, punto 5). Por defecto "in" (iniciar sesión), como siempre.
  const [mode,setMode]=useState(recovery?"newpass":(startMode||"in"));
  const [email,setEmail]=useState((session&&session.user&&session.user.email)||"");
  const [pass,setPass]=useState("");
  const [busy,setBusy]=useState(false);
  const [bioOn,setBioOn]=useState(bio.enabled());
  // zIndex ALTO: debe quedar por encima del onboarding (z90) para que "Ya tengo cuenta" sea visible.
  const overlay={position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:120,padding:"20px"};
  const card={background:"#0F1A15",border:"1px solid #1e2b24",borderRadius:"18px",padding:"22px",width:"100%",maxWidth:"360px",color:"#E8F0EB",fontFamily:"Manrope, sans-serif"};
  const inp={width:"100%",padding:"12px 14px",margin:"6px 0",borderRadius:"12px",border:"1px solid #2a3a31",background:"#0B1410",color:"#fff",fontSize:"16px",boxSizing:"border-box"};
  const btn={width:"100%",padding:"12px",borderRadius:"12px",border:"none",background:"#5FD08A",color:"#06120C",fontWeight:700,fontSize:"15px",marginTop:"8px",cursor:"pointer"};
  const link={background:"none",border:"none",color:"#9BD0E0",cursor:"pointer",fontSize:"13px",marginTop:"12px",padding:"4px",width:"100%"};
  const submit=function(){
    if(!email||!pass){ showToast(t("au_need")); return; }
    setBusy(true);
    const p = mode==="in" ? cloud.signInPassword(email.trim(),pass) : cloud.signUpPassword(email.trim(),pass);
    p.then(function(){ showToast(mode==="in"?t("au_signedin"):t("au_created")); onClose(); })
     .catch(function(e){ showToast("✕ "+((e&&e.message)||e)); })
     .then(function(){ setBusy(false); });
  };
  const toggleBio=function(){
    if(bioOn){ bio.disable(); setBioOn(false); showToast(t("au_bio_dis")); return; }
    bio.enable(uid, (session&&session.user&&session.user.email)).then(function(){ setBioOn(true); showToast(t("au_bio_en")); }).catch(function(e){ showToast("✕ "+((e&&e.message)||e)); });
  };
  const stop=function(e){ e.stopPropagation(); };
  const sendReset=function(){
    if(!email){ showToast(t("au_need_email")); return; }
    setBusy(true);
    cloud.resetPassword(email.trim())
      .then(function(){ showToast(t("au_reset_sent")); setMode("in"); })
      .catch(function(e){ showToast("✕ "+((e&&e.message)||e)); })
      .then(function(){ setBusy(false); });
  };
  const saveNewPass=function(){
    if(!pass||pass.length<6){ showToast(t("au_pass_short")); return; }
    setBusy(true);
    cloud.updatePassword(pass)
      .then(function(){ showToast(t("au_pass_changed")); onClose(); })
      .catch(function(e){ showToast("✕ "+((e&&e.message)||e)); })
      .then(function(){ setBusy(false); });
  };
  // Recuperación: poner contraseña nueva (se llega desde el enlace del email; ya hay sesión temporal).
  if(mode==="newpass"){
    return React.createElement("div",{style:overlay,onClick:onClose},
      React.createElement("div",{style:card,onClick:stop},
        React.createElement("div",{style:{fontWeight:700,fontSize:"17px",marginBottom:"14px"}}, t("au_newpass_title")),
        React.createElement("input",{style:inp,type:"password",placeholder:t("au_pass"),value:pass,autoComplete:"new-password",onChange:function(e){ setPass(e.target.value); }}),
        React.createElement("button",{style:btn,disabled:busy,onClick:saveNewPass}, busy?"…":t("au_newpass_save")),
        React.createElement("button",{style:link,onClick:onClose},t("au_cancel"))
      )
    );
  }
  if(uid){
    return React.createElement("div",{style:overlay,onClick:onClose},
      React.createElement("div",{style:card,onClick:stop},
        React.createElement("div",{style:{fontWeight:700,fontSize:"17px"}},t("au_account")),
        React.createElement("div",{style:{color:"#9fb3a8",fontSize:"13px",marginBottom:"16px"}},(session.user.email||"")),
        bio.supported()
          ? React.createElement("button",{style:Object.assign({},btn,{background:bioOn?"#243b30":"#5FD08A",color:bioOn?"#cfe9da":"#06120C"}),onClick:toggleBio}, bioOn?t("au_bio_off"):t("au_bio_on"))
          : React.createElement("div",{style:{color:"#E6C36A",fontSize:"12px",margin:"6px 0"}},t("au_nobio")),
        React.createElement("button",{style:Object.assign({},btn,{background:"#3a2430",color:"#f3d0d8"}),onClick:function(){ cloud.signOut().then(function(){ showToast(t("au_signedout")); onClose(); }); }},t("au_signout")),
        React.createElement("button",{style:link,onClick:onClose},t("au_close"))
      )
    );
  }
  // Recuperar contraseña: pedir email y enviar el enlace.
  if(mode==="reset"){
    return React.createElement("div",{style:overlay,onClick:onClose},
      React.createElement("div",{style:card,onClick:stop},
        React.createElement("div",{style:{fontWeight:700,fontSize:"17px",marginBottom:"14px"}}, t("au_reset_title")),
        React.createElement("input",{style:inp,type:"email",placeholder:t("au_email"),value:email,autoComplete:"username",onChange:function(e){ setEmail(e.target.value); }}),
        React.createElement("button",{style:btn,disabled:busy,onClick:sendReset}, busy?"…":t("au_reset_send")),
        React.createElement("button",{style:link,onClick:function(){ setMode("in"); }}, t("au_back")),
        React.createElement("button",{style:link,onClick:onClose},t("au_cancel"))
      )
    );
  }
  return React.createElement("div",{style:overlay,onClick:onClose},
    React.createElement("div",{style:card,onClick:stop},
      React.createElement("div",{style:{fontWeight:700,fontSize:"17px",marginBottom:"14px"}}, mode==="in"?t("au_signin"):t("au_signup")),
      React.createElement("input",{style:inp,type:"email",placeholder:t("au_email"),value:email,autoComplete:"username",onChange:function(e){ setEmail(e.target.value); }}),
      React.createElement("input",{style:inp,type:"password",placeholder:t("au_pass"),value:pass,autoComplete:mode==="in"?"current-password":"new-password",onChange:function(e){ setPass(e.target.value); }}),
      React.createElement("button",{style:btn,disabled:busy,onClick:submit}, busy?"…":(mode==="in"?t("au_enter"):t("au_signup"))),
      mode==="in" && React.createElement("button",{style:link,onClick:function(){ setMode("reset"); }}, t("au_forgot")),
      React.createElement("button",{style:link,onClick:function(){ setMode(mode==="in"?"up":"in"); }}, mode==="in"?t("au_toup"):t("au_toin")),
      React.createElement("button",{style:link,onClick:onClose},t("au_cancel"))
    )
  );
}

/* ============================================================
   OPEN BANKING — sección dedicada "Mis bancos": conecta varios bancos,
   ve su estado y elige de la lista REAL de Enable Banking (con buscador y logos).
   Overlay a pantalla completa que abre SettingsPanel.
   ============================================================ */
/* IMPORTAR HISTÓRICO vía Open Banking (~90 días PSD2). Cargos + ingresos; por fila eliges
   destino: Gasto (variable) · Recibo (fijo mensual) · Ingreso. Tarjeta→Gasto, no-tarjeta→Recibo,
   crédito→Ingreso (pre-marcados). TR no aplica (no está en OB). Feedback 2026-07-18. */
function BankHistoryImport({state, set, showToast, onClose, linkEnts}){
  const expEnts=expenseBankEnts(state);
  const allowList=(linkEnts&&linkEnts.length)? linkEnts : expEnts;
  const allow={}; allowList.forEach(function(e){ allow[e]=1; });
  const banksLbl=allowList.map(function(e){ return entOf(e).label; }).join(", ");
  const [months,setMonths]=useState(3);
  const [loading,setLoading]=useState(false);
  const [cands,setCands]=useState(null);
  const [sel,setSel]=useState({});       // índice -> bool
  const [dest,setDest]=useState({});     // índice -> "gasto"|"recibo"|"ingreso"
  const [dupRecibo,setDupRecibo]=useState({});   // índice -> true (misma factura, otro mes del histórico)
  const [dupExist,setDupExist]=useState({});     // índice -> el gasto/ingreso YA guardado con el que coincide
  const [importing,setImporting]=useState(false);
  /* FILTROS (rediseño 3/8, petición suya: «me parece anticuada comparada con el import de Excel»,
     más un bug real que reportó: «seleccioné Trade Republic y salían también movimientos de Banco
     Sabadell»). Investigado: esta pantalla NUNCA tuvo filtro de banco — se buscaba y se importaba
     SIEMPRE de todos los bancos de `allowList` a la vez (Trade Republic incluido desde que admite
     Open Banking solo para sus movimientos), sin forma de acotar a uno. `bankFilter` vacío = todos
     (mismo patrón que el filtro de banco de la pestaña Gastos); con bancos dentro, solo esos se ven
     Y SE IMPORTAN — el filtro no es cosmético: `doImport` recorre `visible`, nunca `cands` entero,
     así que un banco fuera del filtro no puede colarse en el alta aunque su fila siguiera marcada
     por debajo (para combinar selecciones de varios filtros en una sola importación, basta volver
     a «Todos los bancos» antes de pulsar Importar: los `sel` de cada fila se conservan siempre,
     solo cambia qué se VE y qué CUENTA en cada momento). */
  const [bankFilter,setBankFilter]=useState([]);
  const [tipoFilter,setTipoFilter]=useState("all");   // "all" | "gasto" | "ingreso"
  const [mesFilter,setMesFilter]=useState("all");     // "all" | "YYYY-MM"
  const [revelado,setRevelado]=useState(0);           // filas ya "entradas" (animación, como el import de Excel)
  useBackClose(true, onClose);
  const kOf=function(dt,am,mc){ return String(dt).slice(0,10)+"|"+am+"|"+(mc||""); };
  const defDest=function(x){
    if(x.kind==="in") return "ingreso";
    if(x.card) return "gasto";
    return "recibo";
  };
  const search=function(){
    if(!allowList.length){ showToast(t("bp_hist_nodaily")); return; }
    setLoading(true); setCands(null);
    setBankFilter([]); setTipoFilter("all"); setMesFilter("all"); setRevelado(0);
    const d=new Date(); d.setMonth(d.getMonth()-months); const dateFrom=d.toISOString().slice(0,10);
    cloud.bankSyncHistory(dateFrom).then(function(res){
      const links=(res&&res.links)||[];
      // Dedup CIERTO por ext_id: el mismo apunte que el sync diario ya trajo solo. No hay
      // ambigüedad —es literalmente el mismo movimiento del banco— así que se descarta aquí, en
      // silencio: enseñarlo solo ensuciaría la lista con lo que ya entró cada día sin que hiciera falta.
      const seen={}; (state.expenses||[]).forEach(function(e){ if(e.extId) seen[e.extId]=1; });
      const fixNames={}; (state.fixed||[]).forEach(function(f){ fixNames[(f.name||"").toLowerCase()+"|"+(f.amount||0)+"|"+(f.account||"")]=1; });
      const out=[], uniq={};
      links.forEach(function(lk){
        const ent=entFromAspsp(lk&&lk.aspsp); if(!allow[ent]) return;
        (lk.accounts||[]).forEach(function(ac){
          (ac.transactions||[]).forEach(function(tx){
            const dt=String(tx.date||"").slice(0,10), am=Number(tx.amount)||0;
            if(!dt || !am) return;
            const isIn=am<0;
            const abs=Math.abs(am);
            if(tx.ext_id && seen[tx.ext_id]) return;
            const k=(tx.ext_id||"")+"|"+(isIn?"in":"out")+"|"+kOf(dt,abs,tx.merchant); if(uniq[k]) return; uniq[k]=1;
            out.push({ id:tx.ext_id||null, date:dt, amount:abs, merchant:tx.merchant||(isIn?t("cat_ingreso"):"Compra"), note:tx.note||"", card:!!tx.card, ent:ent, kind:isIn?"in":"out" });
          });
        });
      });
      out.sort(function(a,b){ return b.date.localeCompare(a.date); });
      setCands(out);
      // Duplicados de recibo DENTRO del propio lote (2026-07-31): 3 meses de histórico traen la
      // MISMA factura recurrente 3 veces — sin esto, "aceptar todo" crea 3 Fijos idénticos que se
      // cobran los 3 cada mes para siempre. Ver dedupeHistRecibos (08-motor-bank.js).
      const dup=dedupeHistRecibos(out);
      setDupRecibo(dup);
      // Duplicados contra lo que YA TIENES guardado (2026-08-03, mismo criterio y misma idea de UI
      // que el import de Excel): antes esto se descartaba en silencio con una clave sin normalizar
      // el comercio — ahora la fila se queda en la lista, tachada, para COMPARAR en vez de
      // desaparecer sin explicación. Ver histCandExisting (08-motor-bank.js).
      const dExist=histCandExisting(out, state.expenses||[]);
      setDupExist(dExist);
      const s0={}, d0={};
      out.forEach(function(x,i){
        d0[i]=defDest(x);
        // Pre-marca: tarjeta/ingreso sí; recibo (no tarjeta) también — es lo que evita teclear fijos.
        s0[i]=true;
        if(dExist[i]) s0[i]=false;      // ya está guardado con ese mismo día/importe/comercio
        if(d0[i]==="recibo"){
          const fk=(x.merchant||"").toLowerCase()+"|"+x.amount+"|"+x.ent;
          if(fixNames[fk]) s0[i]=false;   // ya tienes ese fijo
          else if(dup[i]) s0[i]=false;    // misma factura ya contada por otro mes del histórico
        }
      });
      setSel(s0); setDest(d0);
    }).catch(function(e){ showToast("⚠ "+((e&&e.message)||e)); setCands([]); }).finally(function(){ setLoading(false); });
  };
  const toggle=function(i){ setSel(function(p){ const n=Object.assign({},p); n[i]=!n[i]; return n; }); };
  const setDestI=function(i,d){ setDest(function(p){ const n=Object.assign({},p); n[i]=d; return n; }); setSel(function(p){ const n=Object.assign({},p); n[i]=true; return n; }); };
  const toggleBankFilter=function(ent){
    setBankFilter(function(p){ const i=p.indexOf(ent); if(i>=0) return p.filter(function(e){ return e!==ent; }); return p.concat([ent]); });
  };
  // Meses realmente presentes en el lote (no `months`): si el banco solo dio 47 días de verdad, un
  // filtro de mes que saliera vacío no serviría de nada.
  const monthsPresent=(function(){
    const vistos={}; const out=[];
    (cands||[]).forEach(function(x){ const k=x.date.slice(0,7); if(!vistos[k]){ vistos[k]=1; out.push(k); } });
    return out.sort().reverse();
  })();
  const monthLbl=function(k){ const p=k.split("-"); return monthShort(parseInt(p[1],10)-1)+" "+p[0]; };
  const passFilter=function(x){
    if(bankFilter.length && bankFilter.indexOf(x.ent)<0) return false;
    if(tipoFilter==="gasto" && x.kind==="in") return false;
    if(tipoFilter==="ingreso" && x.kind!=="in") return false;
    if(mesFilter!=="all" && x.date.slice(0,7)!==mesFilter) return false;
    return true;
  };
  // Lo que se VE es lo que se IMPORTA: `visible` (no `cands`) manda tanto en el contador como en
  // `doImport`. Es la garantía de que el filtro de banco arregla de raíz el bug que reportó.
  const visible=cands? cands.map(function(x,i){ return {x:x,i:i}; }).filter(function(o){ return passFilter(o.x); }) : [];
  const selCount=visible.filter(function(o){ return sel[o.i]; }).length;
  const repCount=visible.filter(function(o){ return dupRecibo[o.i]||dupExist[o.i]; }).length;
  const nuevosCount=visible.length-repCount;
  // Las filas entran contando, una detrás de otra — mismo efecto que el import de Excel (petición
  // suya 2026-07-28, aplicada aquí también por consistencia). El tope evita una espera eterna si
  // el histórico trae decenas de movimientos: pasado el tope, el resto aparece de golpe al acabar.
  useEffect(function(){
    if(!cands) return undefined;
    const tope=Math.min(24, cands.length);
    if(revelado>=tope) return undefined;
    const tm=setTimeout(function(){ setRevelado(function(n){ return n+1; }); }, revelado===0?90:34);
    return function(){ clearTimeout(tm); };
  },[cands,revelado]);
  const doImport=function(){
    if(!cands || !selCount) return;
    setImporting(true);
    const expAdds=[], fixAdds=[];
    visible.forEach(function(o){
      const i=o.i, x=o.x;
      if(!sel[i]) return;
      const d=dest[i]||defDest(x);
      if(d==="recibo"){
        const it={id:uid(),name:x.merchant||t("bp_hist_recibo"),amount:+Number(x.amount).toFixed(2),freq:"mes",account:x.ent};
        const dd=recDay(x.date); if(dd) it.day=dd;
        fixAdds.push(it);
        return;
      }
      if(d==="ingreso"){
        const e={ id:mcExpenseId(), date:new Date(x.date+"T12:00:00").toISOString(), merchant:x.merchant, amount:-Math.abs(x.amount), category:"ingreso", source:"ob-hist", ent:x.ent, noCard:true, income:true };
        if(x.id) e.extId=x.id;
        const nti=cleanNote(x.note, e.merchant); if(nti) e.note=nti;   // concepto del extracto (2026-07-24)
        expAdds.push(e); return;
      }
      const e={ id:mcExpenseId(), date:new Date(x.date+"T12:00:00").toISOString(), merchant:x.merchant, amount:Math.abs(x.amount), category:autoCategory(x.merchant||""), source:"ob-hist", ent:x.ent };
      if(x.id) e.extId=x.id;
      const nt=cleanNote(x.note, e.merchant); if(nt) e.note=nt;
      expAdds.push(e);
    });
    set(function(s){
      const next=Object.assign({},s);
      if(expAdds.length) next.expenses=expAdds.concat(s.expenses||[]);
      if(fixAdds.length) next.fixed=(s.fixed||[]).concat(fixAdds);
      return next;
    });
    setTimeout(function(){ expAdds.forEach(function(e){ cloud.addExpense(e).catch(function(){}); }); },0);
    const parts=[];
    if(expAdds.filter(function(e){ return e.amount>0; }).length) parts.push(tf("bp_hist_done_g",{n:expAdds.filter(function(e){ return e.amount>0; }).length}));
    if(expAdds.filter(function(e){ return e.amount<0; }).length) parts.push(tf("bp_hist_done_i",{n:expAdds.filter(function(e){ return e.amount<0; }).length}));
    if(fixAdds.length) parts.push(tf("bp_hist_done_r",{n:fixAdds.length}));
    showToast(parts.length?parts.join(" · "):tf("bp_hist_done",{n:selCount}));
    setImporting(false); onClose();
  };
  const wrap={position:"fixed",inset:0,zIndex:97,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const chip=function(n){ const on=months===n; return React.createElement("button",{key:n,onClick:function(){ setMonths(n); },style:{flex:1,padding:"9px 0",borderRadius:10,border:"1px solid "+(on?"var(--mint)":"var(--line)"),background:on?"var(--mint)":"var(--surface)",color:on?"#06120C":"var(--text)",fontWeight:800,fontSize:13,cursor:"pointer"}}, tf("bp_hist_m",{n:n})); };
  const bigBtn={width:"100%",padding:"14px",borderRadius:14,border:"none",background:"var(--mint)",color:"#06120C",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:12};
  const destChip=function(i,id,label){
    const on=(dest[i]||"")==id;
    return React.createElement("button",{key:id,type:"button",onClick:function(e){ e.stopPropagation(); setDestI(i,id); },
      style:{padding:"4px 9px",borderRadius:999,border:"1px solid "+(on?"var(--mint)":"var(--line)"),background:on?"rgba(95,208,138,.18)":"transparent",color:on?"var(--mint)":"var(--muted)",fontWeight:800,fontSize:11,cursor:"pointer"}}, label);
  };
  return React.createElement("div",{style:wrap,className:"hist-import"}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("bp_close")),
    React.createElement("div",{className:"serif",style:{fontSize:24,margin:"4px 0 4px"}}, t("bp_hist_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:14}},
      allowList.length? tf("bp_hist_sub",{banks:banksLbl}) : t("bp_hist_nodaily")),
    allowList.length>0 && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{display:"flex",gap:8,marginBottom:12}}, [1,2,3].map(chip)),
      React.createElement("button",{style:{width:"100%",padding:"12px",borderRadius:12,border:"1px solid var(--line)",background:"var(--surface)",color:"var(--text)",fontWeight:800,fontSize:14,cursor:"pointer"},disabled:loading,onClick:search}, loading?t("bp_hist_searching"):t("bp_hist_search")),
      cands!==null && cands.length===0 && !loading && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"20px 0"}}, t("bp_hist_none")),
      cands!==null && cands.length>0 && React.createElement("div",{style:{marginTop:14}},
        React.createElement("div",{style:{fontSize:12,color:"var(--muted-2)",marginBottom:8}}, tf("bp_hist_found",{n:visible.length})),
        /* FILTROS: banco (solo si hay más de uno entre los que se buscó — con uno solo no aporta
           nada elegirlo), tipo (gasto/ingreso) y mes (solo si el lote trae más de uno). Mismo
           patrón visual `.v4-chip`/`.v4-chips` que el resto de la app (Gastos ya filtra así por
           banco/categoría) — coherencia en vez de reinventar un control nuevo para esta pantalla. */
        allowList.length>1 && React.createElement("div",{className:"v4-chips meta-chips wrap"},
          React.createElement("button",{type:"button",className:"v4-chip"+(bankFilter.length===0?" on":""),onClick:function(){ setBankFilter([]); }}, t("g_allbanks")),
          allowList.map(function(ent){
            const on=bankFilter.indexOf(ent)>=0;
            return React.createElement("button",{key:ent,type:"button",className:"v4-chip"+(on?" on":""),onClick:function(){ toggleBankFilter(ent); }}, entOf(ent).label);
          })
        ),
        React.createElement("div",{className:"v4-chips meta-chips wrap"},
          [["all",t("bp_hist_f_all")],["gasto",t("bp_hist_f_gastos")],["ingreso",t("bp_hist_f_ingresos")]].map(function(o){
            const on=tipoFilter===o[0];
            return React.createElement("button",{key:o[0],type:"button",className:"v4-chip"+(on?" on":""),onClick:function(){ setTipoFilter(o[0]); }}, o[1]);
          })
        ),
        monthsPresent.length>1 && React.createElement("div",{className:"v4-chips meta-chips wrap"},
          React.createElement("button",{type:"button",className:"v4-chip"+(mesFilter==="all"?" on":""),onClick:function(){ setMesFilter("all"); }}, t("bp_hist_f_allmonths")),
          monthsPresent.map(function(k){
            const on=mesFilter===k;
            return React.createElement("button",{key:k,type:"button",className:"v4-chip"+(on?" on":""),onClick:function(){ setMesFilter(k); }}, monthLbl(k));
          })
        ),
        /* Marcador nuevos/repetidos, mismas clases `.hoja-marc*` que el import de Excel (2026-07-28):
           de un vistazo, cuánto de lo que ves es de verdad nuevo y cuánto ya lo tenías apuntado. */
        React.createElement("div",{className:"hoja-marc",style:{marginTop:4}},
          React.createElement("div",{className:"hoja-marc-c hoja-marc-ok"},
            React.createElement("b",null, String(nuevosCount)),
            React.createElement("span",null, t("bp_hist_nuevos"))),
          repCount>0 && React.createElement("div",{className:"hoja-marc-c hoja-marc-dup"},
            React.createElement("b",null, String(repCount)),
            React.createElement("span",null, t("bp_hist_repes")))
        ),
        visible.length===0
          ? React.createElement("div",{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"16px 0"}}, t("bp_hist_nofilter"))
          : React.createElement(React.Fragment,null,
          visible.map(function(o,vi){
          const i=o.i, x=o.x;
          const on=!!sel[i];
          const isIn=x.kind==="in";
          const isDup=!!(dupRecibo[i]||dupExist[i]);
          const dentro=vi<revelado;
          return React.createElement("div",{key:i,className:"hist-fila"+(dentro?" dentro":""),style:{border:"1px solid "+(on?"var(--mint)":"var(--line)"),background:on?"var(--mint)14":"var(--surface)",borderRadius:12,marginBottom:7,padding:"10px 12px"}},
            React.createElement("button",{type:"button",onClick:function(){ toggle(i); },style:{display:"flex",alignItems:"center",gap:11,width:"100%",background:"none",border:"none",color:"inherit",cursor:"pointer",textAlign:"left",padding:0}},
              React.createElement("span",{style:{width:20,height:20,borderRadius:6,border:"2px solid "+(on?"var(--mint)":"var(--muted-2)"),background:on?"var(--mint)":"transparent",color:"#06120C",fontWeight:900,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}, on?"✓":""),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("div",{style:{fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textDecoration:(!on&&isDup)?"line-through":"none",color:(!on&&isDup)?"var(--muted-2)":undefined}}, x.merchant),
                React.createElement("div",{style:{fontSize:11,color:"var(--muted-2)",marginTop:1}}, x.date, " · ", entOf(x.ent).label, isIn?"":(x.card?"":" · "+t("bp_hist_notcard"))),
                dupRecibo[i] ? React.createElement("div",{style:{fontSize:11,color:"var(--mint)",marginTop:1}}, "↺ "+t("bp_hist_dup"))
                  : (dupExist[i] ? React.createElement("div",{style:{fontSize:11,color:"var(--muted-2)",marginTop:1}}, "🗐 "+t("bp_hist_dupexist")) : null)),
              React.createElement("span",{style:{fontWeight:800,fontSize:14,flexShrink:0,color:isIn?"var(--mint)":"var(--text)"}}, (isIn?"+":"")+eur(x.amount))
            ),
            on && React.createElement("div",{style:{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",paddingLeft:31}},
              !isIn && destChip(i,"gasto",t("bp_hist_as_gasto")),
              !isIn && destChip(i,"recibo",t("bp_hist_as_recibo")),
              destChip(i,"ingreso",t("bp_hist_as_ingreso"))
            )
          );
        }),
        React.createElement("button",{style:Object.assign({},bigBtn,{opacity:(selCount&&!importing)?1:0.5}),disabled:!selCount||importing,onClick:doImport}, tf("bp_hist_import",{n:selCount}))
        )
      )
    )
  ));
}

/* Los tres brókers con integración propia. El id es el mismo `ent` que llevan las posiciones en
   `state.investments`, para poder deducir de la cartera cuáles usa el usuario sin preguntarle. */
var BROKER_CHIPS=[["trade_republic","Trade Republic"],["myinvestor","MyInvestor"],["revolut","Revolut"]];
function BankPanel({state, set, showToast, uid, onBankSync, onClose, totals, onLinks, fetchPrices, focusAspsp}){
  const [histOpen,setHistOpen]=useState(false);
  const [links,setLinks]=useState(null);          // null = cargando
  const [aspsps,setAspsps]=useState(null);        // null = sin cargar
  const [loadingA,setLoadingA]=useState(false);
  const [q,setQ]=useState("");
  const [busy,setBusy]=useState("");              // aspsp en curso / "__sync"
  const [picking,setPicking]=useState(false);
  const [confirming,setConfirming]=useState("");  // aspsp cuyo "¿quitar?" está abierto
  /* ACORDEÓN (feedback 2026-07-25: «no todo apilotonado con 198349123 funciones, es un coñazo
     esa pestaña comparado con el resto de la app»). Cada banco pintaba SIEMPRE sus tres botones
     (Actualizar / Reconectar / Quitar), así que con tres bancos enlazados eran nueve botones a la
     vez y la pantalla no dejaba ver lo único que se mira el 99% de las veces: si el banco está
     bien y cuándo se sincronizó. Ahora las acciones viven dentro del banco y se abren al tocarlo,
     de uno en uno. El ESTADO (la píldora de color) sigue siempre visible: es lo que avisa de que
     algo va mal, y esconderlo sería cambiar ruido por ceguera. */
  const [openBank,setOpenBank]=useState("");
  // Qué brókers usa este usuario. Sin elección previa se deducen de las posiciones que ya tiene
  // en cartera: así nadie pierde de vista un bróker que estaba usando, y quien no tiene ninguno
  // no ve tres formularios de login que no le sirven de nada.
  const brokersOn=(function(){
    const pref=(state&&state.settings||{}).brokersOn;
    if(Array.isArray(pref)) return pref;
    const ents=[]; (state.investments||[]).forEach(function(i){ if(i.ent&&ents.indexOf(i.ent)<0) ents.push(i.ent); });
    return BROKER_CHIPS.map(function(b){ return b[0]; }).filter(function(k){ return ents.indexOf(k)>=0; });
  })();
  const toggleBroker=function(k){
    const base=brokersOn.slice();
    const i=base.indexOf(k); if(i>=0) base.splice(i,1); else base.push(k);
    // Al apagar un bróker se pliega su tarjeta: si no, quedaba abierta la del siguiente render.
    if(i>=0) setOpenBank("");
    set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,{brokersOn:base})}); });
  };
  // Banco a resaltar al entrar (viene del sync o del banner de Cartera): lo centramos en
  // pantalla, que con tres o cuatro bancos enlazados el bueno se pierde en la lista (2026-07-24).
  // TR llega como focus «trade_republic» → abre su tarjeta de bróker (br:tr), no una fila OB.
  const focusRef=useRef(null);
  const trFocusRef=useRef(null);   // tarjeta de TR (bróker): vive DEBAJO de la lista de bancos OB
  useEffect(function(){
    if(!focusAspsp) return;
    if(focusAspsp==="trade_republic" || focusAspsp==="tr"){
      setOpenBank("br:tr");
      // La tarjeta de TR solo se pinta si el chip «Trade Republic» está encendido (línea ~653).
      // Si venías a reconectar y el chip estaba apagado (settings.brokersOn desactualizado), la
      // tarjeta ni existía: el deep-link aterrizaba en una lista vacía, sin fallo visible ni
      // forma de saber por qué (2026-07-31). Reconectar SIEMPRE implica que la quieres ver.
      if(brokersOn.indexOf("trade_republic")<0){
        set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,{brokersOn:brokersOn.concat(["trade_republic"])})}); });
      }
      // Sin esto, el padre aterrizaba en Mis bancos (arriba del todo) con la tarjeta de TR YA
      // abierta pero fuera de pantalla —tenía que bajar él mismo a buscarla entre los bancos OB—
      // y de ahí «le doy y no me lleva a Trade Republic» (2026-07-31). Mismo patrón que el resto
      // de bancos (más abajo), solo que la tarjeta de TR no tiene fila en `links`.
      const tm=setTimeout(function(){ try{ trFocusRef.current && trFocusRef.current.scrollIntoView({block:"center",behavior:"smooth"}); }catch(e){} }, 220);
      return function(){ clearTimeout(tm); };
    }
    if(!links || !links.length) return;
    // El banco al que venías a arreglar llega ABIERTO: si el acordeón lo dejara plegado, el
    // deep-link te dejaría mirando la tarjeta del banco roto sin el botón de reconectar delante.
    setOpenBank(focusAspsp);
    const el=focusRef.current; if(!el || !el.scrollIntoView) return;
    const tm=setTimeout(function(){ try{ el.scrollIntoView({block:"center",behavior:"smooth"}); }catch(e){} }, 220);
    return function(){ clearTimeout(tm); };
  },[focusAspsp,links]);
  useBackClose(picking, function(){ setPicking(false); setQ(""); });   // gesto atrás: sale del picker, no de la app
  const loadLinks=function(){ if(!cloud.enabled()){ setLinks([]); return; } cloud.bankLinks().then(function(rows){ setLinks(rows||[]); if(onLinks) onLinks(rows||[]);   // el contador de Ajustes se entera al momento
    if((rows||[]).some(function(r){return r.status==='active'||r.status==='pending';})) set(function(s){ return s.hasBankLink?s:Object.assign({},s,{hasBankLink:true}); });
    else if((rows||[]).length===0) set(function(s){ return s.hasBankLink?Object.assign({},s,{hasBankLink:false}):s; });   // sin bancos → dejar de llamar a bank-sync
  }).catch(function(){ setLinks([]); }); };
  useEffect(loadLinks,[uid]);
  const loadAspsps=function(){ if(aspsps!==null||loadingA) return; setLoadingA(true); cloud.bankAspsps("ES").then(function(rows){ setAspsps(rows||[]); }).catch(function(e){ setAspsps([]); showToast("⚠ "+((e&&e.message)||e)); }).finally(function(){ setLoadingA(false); }); };
  const openPicker=function(){ setPicking(true); loadAspsps(); };
  // Candado compartido con el banner de Cartera: dos toques no gastan el permiso dos veces
  // (invalid_request de Enable Banking — 2026-07-26).
  const connect=function(name,country){
    if(!cloud.enabled()||!uid){ showToast(t("bp_need_login")); return; }
    setBusy(name); showToast(t("bank_connecting"));
    set(function(s){ return Object.assign({},s,{hasBankLink:true}); });
    bankConnectOnce(name, country||"ES").then(function(d){ location.href=d.url; })
      .catch(function(e){
        setBusy("");
        if(e&&e.code==="busy"){ showToast("⚠ "+t("bank_error_busy")); return; }
        const msg=(e&&e.message)||String(e);
        showToast("⚠ "+t("bank_error")+": "+msg);
        /* ANTES ESTE FALLO ERA MUDO: solo un toast, que se lee y se olvida. La conexión de TR
           por Open Banking rechazada (2026-08-01: «da error») no dejó NINGÚN rastro en
           app_events — no había forma de saber, sin estar delante de su móvil en ese instante,
           si el fallo era del código, de un aviso legítimo de Enable Banking (TR sigue en
           "beta" por SU lado) o de la sesión. Ahora sí queda escrito: `errores.mjs --kind=error`
           lo enseña la próxima vez, con el banco y el mensaje real de Enable Banking. */
        try{ cloud.logEvent("error","bankConnect "+name+": "+msg.slice(0,180)); }catch(_){}
      });
  };
  // Issues de la última sync: pinta rojo aunque bank_links.status siga en «active»
  // (regresión 4.12.0.18: «marca 1 falla y en Mis bancos todos salen verdes»).
  const issueOf=function(aspsp){
    const list=state&&state.bankIssues||[];
    for(let i=0;i<list.length;i++){
      if(list[i] && String(list[i].aspsp||"").toLowerCase()===String(aspsp||"").toLowerCase()) return list[i];
    }
    return null;
  };
  const refresh=function(){ if(!onBankSync){ return; } setBusy("__sync"); Promise.resolve(onBankSync()).finally(function(){ setBusy(""); loadLinks(); }); };
  // Quitar banco (revoca en EB + borra la fila). Reversible: reaparece el picker para reconectar.
  // Purga al momento sus cuentas sincronizadas (obAccounts) del patrimonio: antes se quedaban
  // sumando hasta el siguiente bank-sync (feedback 2026-07-10). Las cuentas MANUALES no se tocan.
  const remove=function(name){ setBusy(name); cloud.bankDisconnect(name).then(function(){ setConfirming(""); showToast(tf("bp_removed",{bank:bankLabel(name)}));
    set(function(s){
      const ob=(s.obAccounts||[]).filter(function(o){ return String(o.aspsp||"").toLowerCase()!==String(name||"").toLowerCase(); });
      if(ob.length===(s.obAccounts||[]).length) return s;
      return Object.assign({},s,{obAccounts:ob});
    });
    loadLinks(); }).catch(function(e){ showToast("⚠ "+((e&&e.message)||e)); }).finally(function(){ setBusy(""); }); };

  const fmtD=function(x){ try{ return new Date(x).toLocaleDateString(); }catch(e){ return String(x); } };
  const fmtDT=function(x){ try{ return new Date(x).toLocaleString(); }catch(e){ return String(x); } };
  const bankLabel=function(nm){ const e=entFromAspsp(nm); return e?entOf(e).label:nm; };
  const connected={}; (links||[]).forEach(function(l){ connected[(l.aspsp_name||"").toLowerCase()]=l; });
  const ql=q.trim().toLowerCase();
  const shown=(aspsps||[]).filter(function(a){ return !ql || (a.name||"").toLowerCase().indexOf(ql)>=0; });

  const wrap={position:"fixed",inset:0,zIndex:95,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 14px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--mint)",fontSize:14,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:4};
  const pill=function(txt,col){ return React.createElement("span",{style:{fontSize:11,fontWeight:800,color:col,background:col+"1f",borderRadius:20,padding:"3px 9px",whiteSpace:"nowrap"}}, txt); };
  const mb={flex:"1 1 auto",minWidth:0,background:"var(--sur)",border:"1px solid var(--line-soft)",color:"var(--text)",borderRadius:12,padding:"10px 12px",fontSize:13,fontWeight:700,cursor:"pointer"};
  const bigBtn={width:"100%",padding:"14px",borderRadius:14,border:"none",background:"linear-gradient(160deg,var(--mint-hi),var(--mint))",color:"var(--on-mint)",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:8};
  const inp={width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid var(--line-soft)",background:"var(--sur)",color:"var(--text)",fontSize:16,boxSizing:"border-box"};

  const logoBox=function(a){
    const ent=entFromAspsp(a.name);
    if(a.logo) return React.createElement("img",{src:a.logo,alt:"",style:{width:36,height:36,borderRadius:9,objectFit:"contain",background:"#fff",flexShrink:0},onError:function(e){ e.target.style.display="none"; }});
    return React.createElement(Mono,{ent:ent||"",size:36});
  };

  // ---- vista PICKER (elegir banco de la lista real) ----
  if(picking){
    return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
      React.createElement("button",{style:back,onClick:function(){ setPicking(false); setQ(""); }}, "‹ "+t("bp_back")),
      React.createElement("div",{className:"serif",style:{fontSize:24,margin:"4px 0 4px",fontWeight:560}}, t("bp_pick_title")),
      React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:12}}, t("bp_pick_sub")),
      React.createElement("input",{style:inp,placeholder:t("bp_search"),value:q,onChange:function(e){ setQ(e.target.value); },autoFocus:true}),
      loadingA && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,padding:"18px 2px"}}, t("bp_loading")),
      (!loadingA && aspsps!==null && shown.length===0) && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,padding:"18px 2px"}}, t("bp_noresults")),
      React.createElement("div",{style:{marginTop:12}},
        shown.slice(0,80).map(function(a){
          const isC=!!connected[(a.name||"").toLowerCase()];
          // TR ya no se bloquea: se avisa de QUÉ va a aportar por aquí (los movimientos) para que
          // nadie crea que está conectando el bróker por segunda vez. Ver `bankConnectOnce`.
          const esTR=entFromAspsp(a.name)==="trade_republic";
          return React.createElement("button",{key:a.name+a.country,disabled:!!busy,onClick:function(){ connect(a.name,a.country); },
            className:"v4-mov",
            style:{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"12px 14px",borderRadius:16,border:"1px solid var(--line-soft)",background:"var(--sur)",marginBottom:8,cursor:busy?"default":"pointer",opacity:(busy&&busy!==a.name)?0.5:1,textAlign:"left"}},
            logoBox(a),
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{className:"nm"}, a.name),
              isC? React.createElement("div",{className:"meta",style:{color:"var(--mint)"}}, "✓ "+t("bp_already"))
                : (esTR? React.createElement("div",{className:"meta"}, t("bp_tr_ob"))
                : (a.beta? React.createElement("div",{className:"meta"}, "beta") : null))),
            React.createElement("span",{style:{color:"var(--muted-2)",fontWeight:800,fontSize:18}}, busy===a.name?"…":"›")
          );
        })
      )
    ));
  }

  // ---- vista PRINCIPAL (mis bancos conectados) ----
  return React.createElement("div",{className:"v4-banks",style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("bp_close")),
    React.createElement("div",{className:"serif",style:{fontSize:26,fontWeight:560,margin:"2px 0 4px"}}, t("bp_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:14}}, t("bp_intro")),
    links===null && React.createElement("div",{style:{color:"var(--muted)",fontSize:13}}, "…"),
    links!==null && links.length===0 && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{textAlign:"center",color:"var(--muted)",fontSize:13.5,padding:"18px 8px"}}, t("bp_empty"))
    ),
    (links||[]).map(function(l){
      const ent=entFromAspsp(l.aspsp_name);
      const vu=l.valid_until?new Date(l.valid_until).getTime():0;
      const soon=vu && (vu-Date.now()<14*86400000);
      const liveIssue=issueOf(l.aspsp_name);
      const noAcct = l.status==='error' || (liveIssue&&liveIssue.kind==="noacct");
      const liveDead = !!(liveIssue&&liveIssue.kind==="expired") || l.status==='expired';
      // El banco que venías a arreglar (desde el sync o el banner): resaltado y centrado.
      const isFocus = !!focusAspsp && l.aspsp_name===focusAspsp;
      // Píldora: gana el resultado de la ÚLTIMA sync sobre el status de la tabla. Si no, un
      // Sabadell caído seguía en verde porque bank_links aún decía «active».
      const sp = noAcct ? pill(t("bp_st_noacct"),"#E2A05F")
               : liveDead ? pill(t("bp_st_expired"),"var(--coral)")
               : l.status==='pending' ? pill(t("bp_st_pending"),"#E2A05F")
               : l.status==='active' ? (soon? pill(t("bp_st_soon"),"#E2A05F") : pill(t("bp_st_active"),"var(--mint)"))
               : pill(t("bp_st_expired"),"var(--coral)");
      const abierto = openBank===l.aspsp_name;
      // Abrir uno CIERRA el anterior (acordeón): con varios bancos desplegados volvíamos al muro
      // de botones que veníamos a quitar. Al plegar se cancela un «¿quitar?» a medias, que si no
      // quedaría armado y saltaría al volver a abrir.
      const toggle=function(){ setConfirming(""); setOpenBank(abierto?"":l.aspsp_name); };
      return React.createElement("div",{key:l.aspsp_name,"data-aspsp":l.aspsp_name,ref:isFocus?focusRef:null,className:isFocus?"bk-focus":undefined,style:{marginBottom:6}},
        React.createElement("div",{className:"v4-mov",role:"button",tabIndex:0,"aria-expanded":abierto?"true":"false",
          onClick:toggle,
          onKeyDown:function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggle(); } },
          style:{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:16,border:"1px solid "+((isFocus||liveDead||noAcct)?"var(--coral)":"var(--line-soft)"),background:"var(--sur)",cursor:"pointer"}},
          React.createElement(Mono,{ent:ent||"",size:40}),
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",{className:"nm"}, bankLabel(l.aspsp_name), (Array.isArray(l.accounts)&&l.accounts.length>1)?React.createElement("span",{style:{marginLeft:7,fontSize:11,fontWeight:700,color:"var(--mint)"}}, tf("bp_naccts",{n:l.accounts.length})):null),
            React.createElement("div",{className:"meta"}, l.last_sync?tf("bank_updated",{x:fmtDT(l.last_sync)}):t("bank_neversync")),
            l.valid_until?React.createElement("div",{className:"meta",style:{color:soon?"var(--coral)":undefined}}, tf("bank_consent",{x:fmtD(l.valid_until)})):null),
          sp,
          // Flecha: sin ella la tarjeta no se ve pulsable y el usuario no descubre las acciones.
          React.createElement("span",{"aria-hidden":"true",style:{marginLeft:2,color:"var(--muted)",fontSize:12,transition:"transform .18s ease",transform:abierto?"rotate(180deg)":"none"}}, "▾")),
        (abierto && noAcct) && React.createElement("div",{style:{fontSize:12,lineHeight:1.5,color:"#E2A05F",margin:"8px 2px 4px"}}, "⚠ "+t("bp_noacct_help")),
        !abierto ? null :
        (confirming===l.aspsp_name
          ? React.createElement("div",{className:"bk-actions",style:{marginTop:8}},
              React.createElement("span",{style:{fontSize:12.5,color:"var(--muted)",flex:"1 1 100%"}}, tf("bp_remove_q",{bank:bankLabel(l.aspsp_name)})),
              React.createElement("button",{style:Object.assign({},mb,{color:"var(--coral)",borderColor:"var(--coral)",opacity:busy?0.6:1}),disabled:!!busy,onClick:function(){ remove(l.aspsp_name); }}, busy===l.aspsp_name?t("bp_removing"):t("bp_remove_yes")),
              React.createElement("button",{style:mb,disabled:!!busy,onClick:function(){ setConfirming(""); }}, t("bp_remove_no")))
          : React.createElement("div",{className:"bk-actions",style:{marginTop:8}},
              React.createElement("button",{style:Object.assign({},mb,{opacity:busy?0.6:1}),disabled:!!busy,onClick:refresh}, busy==="__sync"?t("bp_syncing"):t("bank_refresh")),
              React.createElement("button",{style:Object.assign({},mb,{opacity:busy?0.6:1}),disabled:!!busy,onClick:function(){ connect(l.aspsp_name, l.aspsp_country||"ES"); }}, noAcct?t("bp_retry_link"):t("bank_reconnect")),
              React.createElement("button",{style:Object.assign({},mb,{opacity:busy?0.6:1,color:"var(--muted)",flex:"0 0 auto"}),disabled:!!busy,onClick:function(){ setConfirming(l.aspsp_name); }}, t("bp_remove"))))
      );
    }),
    React.createElement("button",{style:bigBtn,onClick:openPicker}, "+ "+t("bp_add")),
    (function(){
      const active=(links||[]).filter(function(l){ return l.status==='active'||l.status==='pending'; });
      if(!active.length) return null;
      const ents=[]; active.forEach(function(l){ const e=entFromAspsp(l.aspsp_name); if(e&&ents.indexOf(e)<0) ents.push(e); });
      if(!ents.length) return null;
      const cur=expenseBankEnts(state);
      const primaryEnt=(function(){
        const daily=(state.accounts||[]).find(function(a){ return accDaily(a); });
        return (daily&&daily.ent)||null;
      })();
      const onEnt=function(ent){ return cur.indexOf(ent)>=0; };
      const toggleEnt=function(ent){
        // La cuenta de gasto diario SIEMPRE cuenta (expenseBankEnts la reinyecta). Desmarcarla
        // parecía no hacer nada — rechazo 4.19.1/avisos-presupuesto al quitar TR. Aquí se deja
        // explícito: solo se quitan/añaden EXTRA.
        if(primaryEnt && ent===primaryEnt){ showToast(t("bp_expbanks_locked")); return; }
        set(function(s){
          const base=expenseBankEnts(s).slice();
          const i=base.indexOf(ent);
          if(i>=0){ if(base.length===1) return s; base.splice(i,1); }
          else base.push(ent);
          return Object.assign({},s,{settings:Object.assign({},s.settings,{expenseBanks:base})});
        });
      };
      return React.createElement("div",{style:{marginTop:18},"data-expbanks":"1"},
        React.createElement("div",{className:"v4-section-h"}, React.createElement("span",null, t("bp_expbanks"))),
        React.createElement("div",{style:{fontSize:12,color:"var(--muted)",lineHeight:1.45,marginBottom:10}}, t("bp_expbanks_hint")),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8}},
          ents.map(function(ent){
            const on=onEnt(ent);
            const locked=!!(primaryEnt&&ent===primaryEnt);
            return React.createElement("button",{
              key:ent,type:"button",
              className:"v4-chip"+(on?" on":"")+(locked?" v4-chip-locked":""),
              "data-ent":ent,
              "data-primary":locked?"1":undefined,
              onClick:function(){ toggleEnt(ent); }
            },
              (on?"✓ ":"")+entOf(ent).label+(locked?" · "+t("bp_expbanks_main"):""));
          })
        )
      );
    })(),
    ((links||[]).some(function(l){ return l.status==='active'; })) && React.createElement("button",{style:{width:"100%",padding:"12px",borderRadius:14,border:"1px solid var(--line-soft)",background:"var(--sur)",color:"var(--text)",fontWeight:700,fontSize:13.5,cursor:"pointer",marginTop:12},onClick:function(){ setHistOpen(true); }}, t("bp_hist_btn")),
    histOpen && ReactDOM.createPortal(React.createElement(BankHistoryImport,{
      state:state,set:set,showToast:showToast,onClose:function(){ setHistOpen(false); },
      linkEnts:(function(){
        const ents=[];
        (links||[]).forEach(function(l){
          if(!(l&&(l.status==="active"||l.status==="pending"))) return;
          const e=entFromAspsp(l.aspsp_name||l.aspsp); if(e&&ents.indexOf(e)<0) ents.push(e);
        });
        return ents.length?ents:null;
      })()
    }), document.body),
    React.createElement("div",{style:{height:1,background:"var(--line-soft)",margin:"22px 0 8px"}}),
    React.createElement("div",{className:"bk-sec"}, t("bp_brokers")),
    /* ¿QUÉ BRÓKERS USAS? (feedback 2026-07-25: «que te salgan directamente para loguear sin
       tenerlo es muy muy raro — ni mi pareja ni mi padre tienen MyInvestor y les sale»).
       Las tres tarjetas se pintaban SIEMPRE, así que todo el mundo veía formularios de login de
       brókers que no usa. Ahora las eliges tú.
       Por defecto se deducen de lo que YA tienes en cartera: quien venía usando un bróker no
       pierde nada, y quien no tiene ninguno (el padre, la pareja) empieza solo con los chips —
       que es justo lo que se pedía. La elección vive en settings, así que viaja con la cuenta. */
    (function(){
      const chips=BROKER_CHIPS.map(function(b){
        const on=brokersOn.indexOf(b[0])>=0;
        return React.createElement("button",{key:b[0],type:"button",className:"v4-chip"+(on?" on":""),onClick:function(){ toggleBroker(b[0]); }},
          (on?"✓ ":"")+b[1]);
      });
      return React.createElement("div",{style:{marginBottom:12}},
        React.createElement("div",{style:{fontSize:12,color:"var(--muted)",lineHeight:1.45,marginBottom:8}}, t("bp_which")),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8}}, chips));
    })(),
    brokersOn.indexOf("trade_republic")>=0 && React.createElement("div",{ref:trFocusRef},
      React.createElement(TRSync,{state:state,set:set,totals:totals,
        open:openBank==="br:tr", onToggle:function(){ setOpenBank(openBank==="br:tr"?"":"br:tr"); }})),
    brokersOn.indexOf("myinvestor")>=0 && React.createElement(MyInvestorSync,{state:state,set:set,
      open:openBank==="br:mi", onToggle:function(){ setOpenBank(openBank==="br:mi"?"":"br:mi"); }}),
    brokersOn.indexOf("revolut")>=0 && React.createElement(BrokerImport,{state:state,set:set,fetchPrices:fetchPrices,
      open:openBank==="br:rev", onToggle:function(){ setOpenBank(openBank==="br:rev"?"":"br:rev"); }}),
    React.createElement("div",{className:"bk-ver"}, "v"+(CONFIG.APP_VERSION||"?")),
    // (bp_apk_hint fuera 2026-07-18: párrafo de circunstancias ya resueltas — menos letra aquí)
    React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",marginTop:6,lineHeight:1.5}}, t("bp_foot"))
  ));
}

/* Página «Actividad» del admin (petición 2026-07-11): antes era un acordeón dentro de Ajustes y
   con los errores acumulándose el cajón se hacía gigante; ahora es una pantalla propia (patrón
   BankPanel) con filtro «solo errores». Sin traducir a propósito: consola privada del admin. */
/* ============================================================
   REVISAR LA BETA — «code review» pero probando la app, no leyendo código
   ============================================================
   Petición 2026-07-24. El propio usuario decía que un botón de «aprobar» era medio chorrada
   porque puede pedir el despliegue a mano… y para la parte de DESPLEGAR tiene razón. Lo que NO es
   redundante, y es el motivo real de que esto exista:

     1. QUÉ hay que probar. Se prueba días después, en el sofá, y para entonces ya no te acuerdas
        de qué traía la versión. La lista sale de RELEASE_NOTES de la versión que corre, así que
        no hay nada que mantener aparte: cada release trae su checklist sola.
     2. QUÉ falla, dicho EN EL MOMENTO. Encuentras el fallo usando la app y lo apuntas ahí mismo,
        en vez de acordarte a medias tres horas después.
     3. QUÉ se aprobó. Queda registrado qué versión, desde qué móvil y cuándo — con tres betas
        seguidas, «sube eso que ya lo probé» es ambiguo.

   El progreso se guarda en localStorage por versión: probar lleva días y cerrar la app no puede
   borrarlo. Sin traducir, como «Actividad»: es la consola privada del dueño. */
/* Versión BASE de la que corre: la beta lleva sufijo de compilación (4.11.0.8) y todo lo que se
   compara contra `RELEASE_NOTES` va por la base (4.11.0). Lo usan la checklist de beta y el popup
   de Novedades — la segunda lo hacía a pelo y por eso no marcaba nunca «tu versión». */
function mcVerBase(v){ return String(v||"").split(".").slice(0,3).join("."); }
/* Compara X.Y.Z sin depender de que `_mcNewerVer` ya esté colgado (tests / orden de carga). */
function mcIsNewer(a,b){
  if(typeof window!=="undefined"&&window._mcNewerVer) return window._mcNewerVer(a,b);
  a=String(a||"").split("."); b=String(b||"").split(".");
  for(var i=0;i<Math.max(a.length,b.length);i++){
    var x=parseInt(a[i]||0,10), y=parseInt(b[i]||0,10);
    if(x!==y) return x>y;
  }
  return false;
}
function betaChecklist(version, prodVersion){
  var base=mcVerBase(version);
  if(typeof RELEASE_NOTES==="undefined"||!RELEASE_NOTES.length) return { v:base, t:"", items:[], tandas:[] };
  /* RONDA ENTERA (2026-09-07). El panel cogía SOLO las notas de la versión que corre: en
     4.19.1.2 enseñaba «Solo ese movimiento» y dejaba fuera todo lo de 4.19.0 (posible repetido,
     IA, orden…) que YA estaba en el móvil. Con `prodVersion` se juntan las tandas de todas las
     versiones > producción y ≤ la que corre. Sin prod (aún preguntando / sin red): se queda el
     comportamiento de siempre —una sola versión—; en la duda, menos, no de más. */
  var round;
  var conProd=prodVersion!=null&&prodVersion!=="";
  if(!conProd){
    var one=RELEASE_NOTES.filter(function(n){ return n.v===base; })[0] || RELEASE_NOTES[0];
    round=one?[one]:[];
  }else{
    var prod=mcVerBase(prodVersion);
    round=RELEASE_NOTES.filter(function(n){
      return n&&n.v && mcIsNewer(n.v, prod) && !mcIsNewer(n.v, base);
    });
  }
  if(!round.length){
    var fb=RELEASE_NOTES.filter(function(n){ return n.v===base; })[0] || RELEASE_NOTES[0];
    round=fb?[fb]:[];
  }
  // El panel de revisión es la consola privada del dueño y va SIN traducir (como «Actividad»),
  // así que la checklist se lee siempre en castellano aunque la app esté en otro idioma.
  var tandas=[], planos=[], titulo="";
  round.forEach(function(notes){
    if(!titulo) titulo=rnT(notes.t,"es");
    betaTandas(notes).forEach(function(g){
      /* Con ronda multi-versión el id lleva la versión: dos tandas «id-fila» de bases distintas
         no se pisan en el veredicto. Sin prod (una sola versión) se conserva el id corto de
         siempre para no resetear lo ya enviado en esta compilación. */
      var id=conProd?(notes.v+"/"+g.id):g.id;
      var t=conProd?("v"+notes.v+(g.t?" · "+g.t:"")):g.t;
      tandas.push({ id:id, t:t, items:g.items });
      planos=planos.concat(g.items);
    });
  });
  return { v:base, t:titulo, items:planos, tandas:tandas };
}
/* LAS TANDAS DE UNA VERSIÓN — varias betas a la vez, cada una con su veredicto.
   Petición suya 2026-07-29: «que se pudieran implementar varias betas a la vez y que me des la
   opción de aprobarlas por separado pero que estén juntas». Es como trabaja él: varias cosas en
   vuelo, se prueban en la MISMA app —una sola instalación, un solo bundle— y cada una sube cuando
   está lista, sin esperar a la que va con retraso.

   Si una versión no declara tandas se devuelve UNA sola con todo dentro, y el panel se comporta
   exactamente como antes. Eso hace que las 69 versiones del histórico sigan funcionando y que
   declarar tandas sea opcional: una tanda pequeña no necesita ceremonia. */
function betaTandas(notes){
  if(notes && notes.tandas && notes.tandas.length){
    return notes.tandas.map(function(g){
      return { id:String(g.id), t:rnT(g.t,"es"), items:rnItems(g,"es") };
    });
  }
  return [{ id:"todo", t:"", items:rnItems(notes,"es") }];
}
/* CUENTA COMPARTIDA DE LA REVISIÓN — la MISMA lógica que usa el panel para heredar ✓/✗ entre
   compilaciones, extraída para que la fila de Ajustes cuente exactamente lo mismo que el panel
   (2026-08-01, bug suyo: «me sale revisar esta beta 0/26 cuando ya he aceptado o rechazado
   cosas»). La fila llevaba TODO ESTE TIEMPO leyendo `_betaReview_`+pack.v —la versión BASE, tipo
   "4.13.0"— mientras el panel SIEMPRE ha guardado (y sigue guardando) por la COMPILACIÓN exacta,
   `_betaReview_`+CONFIG.APP_VERSION, tipo "4.13.0.11". Esa clave base no la escribe nadie, así
   que la fila leía aire y enseñaba 0 pasara lo que pasara. Con `_betaReviewOk` (que sí es la
   fuente de verdad persistente, por TEXTO del punto) la fila cuenta lo mismo que ve el panel al
   abrirse. Ver `heredarOk` dentro de `BetaReviewPanel` — es la misma lógica de rescate. */
function betaMarksCount(pack){
  var okKey="_betaReviewOk";
  var prev=store.get(okKey);
  if(!prev){
    prev={};
    try{
      var pre="_betaReview_"+mcVerBase(CONFIG.APP_VERSION);
      for(var i=0;i<localStorage.length;i++){
        var k=localStorage.key(i);
        if(!k||k.indexOf(pre)!==0||k.slice(-2)==="_n") continue;
        var vieja=store.get(k)||{};
        pack.items.forEach(function(it,j){ if(vieja[j]==="ok"||vieja[j]==="na"||vieja[j]==="ko") prev[it]=vieja[j]; });
      }
    }catch(e){}
  }
  // Lo marcado en ESTA compilación manda sobre lo heredado (mismo criterio que el panel).
  var propias=store.get("_betaReview_"+CONFIG.APP_VERSION)||{};
  var n=0;
  pack.items.forEach(function(it,i){
    var v=propias[i]!==undefined ? propias[i] : prev[it];
    if(v==="ok"||v==="na"||v==="ko") n++;
  });
  return { n:n, tot:pack.items.length };
}
/* Versión que sirve Pages AHORA (cruda). `null` mientras pregunta o si falla la red.
   Sacada de `useYaEnProd` para que el panel de beta pueda armar la ronda entera (2026-09-07). */
function useProdVersion(){
  const [prod,setProd]=useState(null);
  useEffect(function(){
    if(!window._mcProdVersion) return;
    let vivo=true;
    window._mcProdVersion().then(function(v){ if(vivo) setProd(v||null); });
    return function(){ vivo=false; };
  },[]);
  return prod;
}
/* ¿LO QUE LLEVO PUESTO YA ESTÁ EN PRODUCCIÓN? (petición suya 2026-07-28)
   «Ponme que cuando suba algo a prod, la beta no haya nada para aprobar porque lógicamente ya lo
   hice para que subiera prod». Y es verdad: promocionar ES la aprobación. Pero el panel solo
   miraba la versión que corre en el móvil, así que después de subir la 4.12.1 a producción
   seguía enseñando su checklist entera como si faltara por probar.

   Se compara la base de lo que corre (4.12.1.3 → 4.12.1) contra lo que sirve Pages. Si producción
   ya va por ahí o más allá, esto está aprobado por definición. `null` mientras se pregunta o si
   la red falla: en la duda se sigue preguntando, que es el lado seguro. */
function useYaEnProd(){
  const prod=useProdVersion();
  if(!prod||!window._mcNewerVer) return null;
  const base=mcVerBase(CONFIG.APP_VERSION);
  /* UNA VERSIÓN QUE NO SE PUEDE COMPARAR NO DA NADA POR APROBADO (2026-07-28, cazado en CI).
     `_mcNewerVer` compara con `parseInt`, y `parseInt("dev")` es `NaN`, que PIERDE todas las
     comparaciones: sin este guardo, un bundle sin sellar (`APP_VERSION:"dev"` — el que hay en el
     repo hasta que `stamp-version` corre) contestaba «ya está en producción» y escondía el
     veredicto entero. Es exactamente la misma trampa del NaN que en la 4.9.2 dejó un móvil sin
     recibir una actualización nunca más. En la duda, se sigue preguntando. */
  if(!/^\d+\.\d+\.\d+$/.test(base)) return null;
  return !window._mcNewerVer(base, prod) ? prod : false;
}
function BetaReviewPanel({onClose, showToast}){
  useBackClose(true, onClose);
  const prod=useProdVersion();
  const pack=betaChecklist(CONFIG.APP_VERSION, prod);
  const yaEnProd=(!prod||!/^\d+\.\d+\.\d+$/.test(mcVerBase(CONFIG.APP_VERSION)))
    ? null
    : (!mcIsNewer(mcVerBase(CONFIG.APP_VERSION), prod) ? prod : false);
  // La clave va por la COMPILACIÓN (4.12.0.17), no por la versión base (4.12.0). Petición suya
  // 2026-07-26: «cuando me subas una nueva versión con el fix de eso, que se resetee y se ponga
  // vacío». Con la clave por versión base, la beta siguiente heredaba las cruces y los comentarios
  // de la anterior — o sea, el arreglo llegaba ya marcado como fallo. Cada beta empieza en blanco,
  // y dentro de la misma beta el progreso se conserva aunque cierres la app (que era el motivo de
  // guardarlo, porque probar lleva días).
  const storeKey="_betaReview_"+CONFIG.APP_VERSION;
  /* LO QUE YA DIO POR BUENO NO SE VUELVE A PREGUNTAR (petición suya 2026-07-26, por la noche:
     «si algo funciona CREO que no debería reventar con otra compilación»). El reseteo por
     compilación arreglaba una cosa y rompía otra: las cruces sí tienen que volver a preguntarse
     —son justo lo que se acaba de arreglar—, pero los ✓ también se borraban, y volver a probar
     siete puntos que ya iban bien es lo que hacía que no se acordara de nada («los pillo en
     momentos diferentes»).

     Así que los ✓ y los «no lo puedo probar» se guardan APARTE, en una lista que NO lleva el
     número de compilación, y que casa por el TEXTO del punto y no por su posición. Eso importa:
     · si reescribimos la nota, ha cambiado lo que se prueba → vuelve a preguntarse;
     · si la nota es idéntica, es literalmente lo mismo que ya probó → viene marcado;
     · y si se reordenan las notas, no se cruzan los cables (con índices, sí).

     ⚠ Y LOS ✗ TAMBIÉN SE HEREDAN, CON SU COMENTARIO (2026-08-01). Antes NO, con este argumento:
     «las cruces son justo lo que se acaba de arreglar, así que vuelven a preguntarse». El
     argumento es falso: el panel no tiene ni idea de si la compilación nueva ha tocado ese punto
     o no. Y el precio de equivocarse lo paga él SIEMPRE — la 4.13.0 sacó cinco compilaciones en
     tres días y cada una le borraba los tres fallos que acababa de escribir a mano, con sus
     notas. Sus palabras: «ya he repetido los mensajes 3 veces, estoy hasta los cojones».
     Ahora un ✗ heredado vuelve marcado, con su texto, y con un aviso de que viene de la
     compilación anterior: si el arreglo ha llegado, lo pone en ✓ de un toque; si no, ya está
     escrito y puede rechazar sin volver a teclear. Perder trabajo suyo es el fallo caro; que una
     cruz sobreviva de más se arregla con un dedo. */
  const okKey="_betaReviewOk";
  const notaKey="_betaReviewNotas";   // {texto del punto: comentario} — sobrevive a la compilación
  const heredarOk=function(){
    var prev=store.get(okKey);
    /* RESCATE DE LO YA APROBADO (2026-07-26 noche). La lista aparte se estrena en esta versión,
       así que la primera vez está vacía y lo que él aprobó en las betas anteriores se habría
       perdido igual — que es exactamente lo que notó al abrir la siguiente: «siguen saliendo las
       que aprobé». Se rescata de las claves por compilación que ya están guardadas en el móvil.
       Van por índice, y aquí el índice VALE: solo se leen las de la misma versión base, y las
       notas de una versión base no cambian de orden entre compilaciones. */
    if(!prev){
      prev={};
      try{
        var pre="_betaReview_"+mcVerBase(CONFIG.APP_VERSION);
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i);
          if(!k||k.indexOf(pre)!==0||k.slice(-2)==="_n") continue;
          var vieja=store.get(k)||{};
          pack.items.forEach(function(it,j){ if(vieja[j]==="ok"||vieja[j]==="na") prev[it]=vieja[j]; });
        }
      }catch(e){}
      store.set(okKey,prev);
    }
    var m={};
    pack.items.forEach(function(it,i){ var v=prev[it]; if(v==="ok"||v==="na"||v==="ko") m[i]=v; });
    return m;
  };
  /* Los comentarios de los ✗ heredados, por el mismo camino y con la misma clave (el TEXTO del
     punto). Van aparte de `okKey` para no cambiarle la forma a lo que ya está guardado en su
     móvil: allí los valores son "ok"/"na"/"ko" y aquí son strings largos. */
  const heredarNotas=function(){
    var prev=store.get(notaKey)||{};
    var n={};
    pack.items.forEach(function(it,i){ if(prev[it]) n[i]=prev[it]; });
    return n;
  };
  // {i: "ok" | "ko" | "na"} + notas de los que fallan. Lo heredado va DEBAJO de lo marcado en esta
  // compilación: si ya has tocado algo aquí, manda lo tuyo. (Con `||` en vez de mezcla, haber
  // marcado una sola casilla en esta beta apagaba la herencia entera.)
  const [marks,setMarks]=useState(function(){ return Object.assign(heredarOk(), store.get(storeKey)||{}); });
  const [notes,setNotes]=useState(function(){ return Object.assign(heredarNotas(), store.get(storeKey+"_n")||{}); });
  const [busy,setBusy]=useState(false);
  // Veredicto POR TANDA: {idTanda: "approved"|"rejected"}. Antes era uno solo para toda la beta,
  // y con varias cosas en vuelo eso obliga a esperar a la más lenta para subir la más rápida.
  const [sent,setSent]=useState(function(){ return store.get(storeKey+"_v") || {}; });
  // Cuántos venían ya marcados de compilaciones anteriores, para decírselo en vez de que parezca
  // que el panel se ha inventado unos ✓ que él no ha puesto en esta ronda.
  // Se separan los ✓/«no probable» de los ✗: el aviso de arriba no puede decir «los diste por
  // buenos» de una cruz, y las cruces heredadas además se señalan una a una (viene de antes →
  // compruébalo), que es la diferencia entre ahorrarle trabajo y mentirle.
  const heredadas=useRef((function(){ var h=heredarOk(), propias=store.get(storeKey)||{}, buenos=0, ko={};
    Object.keys(h).forEach(function(i){ if(propias[i]!==undefined) return; if(h[i]==="ko") ko[i]=true; else buenos++; });
    return {buenos:buenos, ko:ko, nKo:Object.keys(ko).length}; })());
  const heredados=useRef(heredadas.current.buenos);
  const save=function(m,n){ store.set(storeKey,m); if(n) store.set(storeKey+"_n",n); };
  const recordarOk=function(m){
    var prev=store.get(okKey)||{};
    pack.items.forEach(function(it,i){
      if(m[i]==="ok"||m[i]==="na"||m[i]==="ko") prev[it]=m[i]; else delete prev[it];
    });
    store.set(okKey,prev);
  };
  // El comentario de un ✗ se guarda por TEXTO en cuanto se escribe, no al enviar el veredicto:
  // si Android mata la app a media frase (pasa), lo escrito sigue ahí en la compilación siguiente.
  const recordarNota=function(i,txt){
    var prev=store.get(notaKey)||{};
    var it=pack.items[i]; if(it==null) return;
    if(txt&&txt.trim()) prev[it]=txt; else delete prev[it];
    store.set(notaKey,prev);
  };
  const mark=function(i,v){
    setMarks(function(p){ const m=Object.assign({},p); if(m[i]===v) delete m[i]; else m[i]=v; save(m,null); recordarOk(m);
      // Quitar el ✗ se lleva su comentario: si ya no falla, la nota es ruido en el parte siguiente.
      if(m[i]!=="ko") recordarNota(i,"");
      return m; });
  };
  const setNote=function(i,txt){ setNotes(function(p){ const n=Object.assign({},p); n[i]=txt; store.set(storeKey+"_n",n); recordarNota(i,txt); return n; }); };

  /* Las tandas comparten la numeración GLOBAL de los puntos (`marks` va por índice), así que
     cada tanda solo necesita saber qué índices son suyos. Se hace así y no con claves por tanda
     porque el guardado y la herencia de ✓ entre compilaciones ya van por ese índice y por el
     TEXTO del punto: cambiarlo habría tirado a la basura todo lo que ya tiene probado. */
  const grupos=(function(){
    var out=[], i=0;
    (pack.tandas||[]).forEach(function(g){
      var idx=g.items.map(function(){ return i++; });
      out.push({ id:g.id, t:g.t, items:g.items, idx:idx });
    });
    return out;
  })();
  const cuenta=function(idx){
    var r={ok:0,ko:0,na:0};
    idx.forEach(function(i){ var m=marks[i]; if(m==="ok")r.ok++; else if(m==="ko")r.ko++; else if(m==="na")r.na++; });
    r.pend=idx.length-r.ok-r.ko-r.na;
    return r;
  };
  const total=pack.items.length;
  const ok=pack.items.filter(function(_,i){ return marks[i]==="ok"; }).length;
  const ko=pack.items.filter(function(_,i){ return marks[i]==="ko"; }).length;
  // «No se puede probar» (petición suya 2026-07-26): hay cosas que no dependen de él —que llegue
  // la nómina, que el banco mande una notificación, un icono que solo se ve con la APK instalada—
  // y no tenían casilla. Al no poder marcarlas, contaban como pendientes y BLOQUEABAN el aprobar,
  // así que o mentía marcando «va bien» o la beta se quedaba sin veredicto. Esto NO bloquea.
  const na=pack.items.filter(function(_,i){ return marks[i]==="na"; }).length;
  const pend=total-ok-ko-na;

  /* EL VEREDICTO DICE TAMBIÉN QUÉ APK LLEVABA PUESTA (2026-07-26).
     El veredicto ya viajaba con la versión web (4.12.0.27), pero no con el `versionCode` del APK,
     y eso costó una sesión entera: «en deudas sigue igual» con los arreglos ya publicados, sin
     forma de saber si los tenía puestos —esa noche salieron seis betas seguidas— ni si el fallo
     era nativo (el icono) o web. Ahora lo dice el propio parte, y nadie tiene que preguntar. */
  const [apkCode,setApkCode]=useState(null);
  useEffect(function(){
    const nat=natPlugin();
    if(!nat||!nat.appInfo) return;
    Promise.resolve(nat.appInfo()).then(function(info){
      if(info&&info.versionCode!=null) setApkCode(String(info.versionCode));
    }).catch(function(){});
  },[]);
  /* EL VEREDICTO ES DE UNA TANDA, NO DE LA BETA ENTERA.
     El parte lleva el `id` de la tanda para que quien promociona sepa QUÉ subir: con varias cosas
     en vuelo, «aprobada» a secas no dice nada. `scripts/errores.mjs --kind=beta` las enseña una
     por línea. Cuando una versión no declara tandas, el id es "todo" y el parte queda igual que
     siempre — el histórico de veredictos se sigue leyendo sin cambiar nada. */
  const enviar=function(g, verdict){
    if(busy) return;
    setBusy(true);
    const c=cuenta(g.idx);
    const fallos=g.idx.map(function(i,j){ return marks[i]==="ko" ? {item:g.items[j].slice(0,140), nota:(notes[i]||"").slice(0,300)} : null; }).filter(Boolean);
    const conApk=CONFIG.APP_VERSION+(apkCode?" (APK "+apkCode+")":"");
    const etiq=g.t?(" ["+g.id+"] "+g.t):"";
    const payload={
      verdict:verdict, version:CONFIG.APP_VERSION, apk:apkCode, notas:pack.v,
      tanda:g.id, tandaTitulo:g.t||null,
      probados:c.ok, fallos:c.ko, sinProbar:c.pend, noProbable:c.na, heredados:heredados.current,
      noProbables:g.idx.map(function(i,j){ return marks[i]==="na" ? g.items[j].slice(0,140) : null; }).filter(Boolean),
      detalle:fallos,
      summary:(verdict==="approved" ? "✅ APROBADA " : "⛔ RECHAZADA ")+conApk+etiq+
        " · "+c.ok+" ok / "+c.ko+" fallo(s) / "+c.pend+" sin probar"+(c.na?" / "+c.na+" no probable(s)":"")+
        (fallos.length? " · "+fallos.map(function(f){ return f.nota||f.item; }).join(" | ") : "")
    };
    cloud.betaReport(payload)
      .then(function(){
        setSent(function(p){
          const n=Object.assign({},p); n[g.id]=verdict;
          store.set(storeKey+"_v",n);   // sobrevive a cerrar la app: probar lleva días
          return n;
        });
        showToast(verdict==="approved"?"✅ Aprobada · queda registrado":"⛔ Enviado · no se sube");
      })
      .catch(function(e){ showToast("✕ No se pudo enviar: "+((e&&e.message)||e)); })
      .finally(function(){ setBusy(false); });
  };

  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const btn=function(on,color){ return {flex:1,background:on?color:"var(--surface-2)",color:on?"#06120C":"var(--text)",
    border:on?"none":"1px solid var(--line)",borderRadius:12,padding:"9px 6px",fontSize:13,fontWeight:800,cursor:"pointer"}; };

  return React.createElement("div",{style:wrap,className:"beta-review"}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ Ajustes"),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 2px"}}, "🧪 Revisar la beta"),
    // Y a la vista, no solo en el parte: si un fallo es del icono o del instalador, lo primero que
    // hay que saber es qué APK lleva puesta — y hasta ahora aquí solo salía la versión web.
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:4}},
      "v"+CONFIG.APP_VERSION+(apkCode?" · APK "+apkCode:"")+(pack.t?" · "+pack.t:"")),
    React.createElement("div",{style:{color:"var(--muted-2)",fontSize:12,lineHeight:1.5,marginBottom:14}},
      yaEnProd
        ? "Esta versión ya la subiste tú, así que no hay nada que aprobar. La checklist se queda abajo por si quieres repasar algo."
        : "Pruébalo con calma: esto se guarda y puedes seguir otro día. Tu padre y tu pareja siguen en la versión estable hasta que lo apruebes."),
    // YA ESTÁ EN PRODUCCIÓN → no se pide veredicto (2026-07-28). Promocionar ES aprobar: pedirle
    // que apruebe otra vez lo que él mismo subió hace horas es ruido, y encima ruido que parece
    // trabajo pendiente cada vez que abre Ajustes.
    yaEnProd && React.createElement("div",{style:{fontSize:13,lineHeight:1.55,marginBottom:14,padding:"12px 14px",borderRadius:14,
      background:"var(--surface-2)",color:"var(--text)",border:"1px solid var(--mint-dim)"}},
      React.createElement("b",null,"✅ Ya está en producción"),
      React.createElement("div",{style:{color:"var(--muted)",marginTop:4}},
        "La v"+yaEnProd+" es la que tienen ahora tu padre y tu pareja. Esta beta ya pasó por aquí.")),
    (heredados.current>0||heredadas.current.nKo>0) && !yaEnProd && React.createElement("div",{style:{fontSize:12,lineHeight:1.5,marginBottom:14,padding:"9px 12px",borderRadius:12,
      background:"var(--surface-2)",color:"var(--muted)",border:"1px solid var(--line-soft)"}},
      heredados.current>0 && React.createElement("div",null,
        "✓ "+heredados.current+(heredados.current===1?" punto viene ya marcado":" puntos vienen ya marcados")+
        " porque los diste por buenos en una compilación anterior y su texto no ha cambiado. No hace falta repetirlos; si quieres, tócalos para desmarcar."),
      heredadas.current.nKo>0 && React.createElement("div",{style:{marginTop:heredados.current>0?7:0,color:"var(--coral)"}},
        "✗ "+heredadas.current.nKo+(heredadas.current.nKo===1?" fallo que marcaste antes sigue aquí, con lo que escribiste":" fallos que marcaste antes siguen aquí, con lo que escribiste")+
        ". No hace falta que lo vuelvas a teclear: si esta compilación lo arregla, tócalo y ponlo en ✓.")),

    // Progreso
    React.createElement("div",{style:{display:"flex",gap:10,alignItems:"center",marginBottom:14}},
      React.createElement("div",{style:{flex:1,height:8,borderRadius:8,background:"var(--surface-2)",overflow:"hidden"}},
        React.createElement("div",{style:{width:(total?Math.round((ok+ko+na)/total*100):0)+"%",height:"100%",
          background:ko?"var(--coral)":"var(--mint)",transition:"width .25s ease"}})),
      React.createElement("span",{style:{fontSize:12.5,fontWeight:700,color:"var(--muted)"}}, (ok+ko+na)+"/"+total)),

    pack.items.length===0 && React.createElement("div",{style:{fontSize:13,color:"var(--muted)"}},
      "Esta versión no trae notas, así que no hay checklist. Prueba lo que hayas tocado."),

    /* UNA SECCIÓN POR TANDA, cada una con su veredicto (petición suya 2026-07-29).
       El punto de todo esto: que una tanda lista pueda subir HOY sin esperar a la que todavía
       tiene un fallo. Antes el botón era uno solo para la beta entera, así que un punto rojo en
       cualquier sitio bloqueaba lo demás — que es justo lo que le pasa en el trabajo cuando una
       rama se queda atrás y arrastra a las otras. */
    grupos.map(function(g){
      const c=cuenta(g.idx);
      const v=sent[g.id];
      const listo=c.pend===0 && c.ko===0;
      return React.createElement("div",{key:g.id,className:"beta-tanda"},
        g.t && React.createElement("div",{className:"beta-tanda-h"},
          React.createElement("span",{className:"beta-tanda-t"}, g.t),
          React.createElement("span",{className:"beta-tanda-n"+(v==="approved"?" ok":v==="rejected"?" ko":"")},
            v==="approved" ? "✅ aprobada" : v==="rejected" ? "⛔ rechazada" : (c.ok+c.ko+c.na)+"/"+g.idx.length)),
        g.idx.map(function(i,j){
          const it=g.items[j], m=marks[i];
          return React.createElement("div",{key:i,className:"beta-item",style:{border:"1px solid "+(m==="ko"?"var(--coral)":m==="ok"?"var(--mint)":m==="na"?"var(--muted-2)":"var(--line-soft)"),
            borderRadius:16,padding:"12px 14px",marginBottom:10,background:"var(--sur)",opacity:m==="na"?0.72:1}},
            React.createElement("div",{style:{fontSize:13.5,lineHeight:1.5,marginBottom:10}}, it),
            // Una cruz que viene de la compilación anterior se dice, para que no parezca que la
            // acaba de poner él ni que el panel se inventa fallos. El comentario sigue debajo.
            m==="ko" && heredadas.current.ko[i] && React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",marginTop:-4,marginBottom:9}},
              "↩ lo marcaste en la compilación anterior · compruébalo y ponlo en ✓ si ya va"),
            React.createElement("div",{style:{display:"flex",gap:8}},
              React.createElement("button",{type:"button",style:btn(m==="ok","var(--mint)"),onClick:function(){ mark(i,"ok"); }}, "✓ Va bien"),
              React.createElement("button",{type:"button",style:btn(m==="ko","var(--coral)"),onClick:function(){ mark(i,"ko"); }}, "✗ Falla")),
            React.createElement("button",{type:"button",style:Object.assign({},btn(m==="na","var(--muted-2)"),{marginTop:8,width:"100%"}),
              onClick:function(){ mark(i,"na"); }}, "— No lo puedo probar"),
            m==="ko" && React.createElement("input",{className:"v4-exp-note-in",style:{marginTop:10},
              placeholder:"¿Qué pasa exactamente?",value:notes[i]||"",
              onChange:function(e){ setNote(i,e.target.value); }})
          );
        }),
        // El veredicto de ESTA tanda. Con la versión ya en producción no se pide ninguno.
        yaEnProd ? null
        : v ? React.createElement("div",{className:"beta-veredicto",style:{borderColor:v==="approved"?"var(--mint)":"var(--coral)"}},
            React.createElement("div",{style:{fontWeight:800,fontSize:14,marginBottom:5}},
              v==="approved" ? "✅ Aprobada" : "⛔ Rechazada"),
            React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",lineHeight:1.5}},
              /* El texto NO promete trocear la subida (2026-08-01). Antes decía «poniendo las
                 tandas que quieras en «tandas»», y eso solo funciona si cada tanda nació en su
                 rama `tanda/<id>`: si la ronda se commiteó mezclada —la 4.13.0, sin ir más
                 lejos—, el workflow PARA y él se queda mirando un error después de haber
                 aprobado. Aquí se dice lo que sí es verdad siempre: queda registrado con su
                 nombre. Cómo se sube es del otro lado (docs/TESTING.md). */
              v==="approved"
                ? "Queda registrado con su nombre («"+g.id+"»), así que quien la suba sabe exactamente qué subir."
                : "Queda registrado con lo que falla. Esta tanda no sube; las demás pueden seguir su camino."),
            React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:10},
              onClick:function(){ setSent(function(p){ const n=Object.assign({},p); delete n[g.id]; store.set(storeKey+"_v",n); return n; }); }},
              "↺ Cambiar de opinión"))
        : React.createElement(React.Fragment,null,
            c.ko>0 && React.createElement("button",{type:"button",className:"v4-danger",style:{marginTop:6},disabled:busy,
              onClick:function(){ enviar(g,"rejected"); }}, busy?"Enviando…":("⛔ Reportar "+c.ko+" fallo(s) · no subir")),
            React.createElement("button",{type:"button",className:"v4-cta",style:{marginTop:10,opacity:listo?1:0.45},
              disabled:busy||!listo,onClick:function(){ enviar(g,"approved"); }},
              busy?"Enviando…":(g.t?"✅ Aprobar esta tanda":"✅ Aprobar esta beta")),
            !listo && React.createElement("div",{style:{fontSize:12,color:"var(--muted-2)",textAlign:"center",marginTop:8,lineHeight:1.5}},
              c.ko>0 ? "Hay algo marcado como que falla: arréglalo antes de aprobar."
                     : "Te quedan "+c.pend+" cosa(s) por probar.")
          )
      );
    }),

    React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:14},
      onClick:function(){ store.del(storeKey); store.del(storeKey+"_n"); store.del(storeKey+"_v"); setMarks({}); setNotes({}); setSent({}); }},
      "↺ Empezar la revisión de cero")
  ));
}

function ActivityPanel({events, onReload, onClose}){
  const [flt,setFlt]=useState("all");   // all | error | feedback
  useBackClose(true, onClose);   // gesto atrás del móvil: cierra esta pantalla
  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const chip=function(on){ return {background:on?"var(--mint)":"var(--surface-2)",color:on?"#06120C":"var(--text)",border:on?"none":"1px solid var(--line)",borderRadius:20,padding:"6px 13px",fontSize:12.5,fontWeight:700,cursor:"pointer"}; };
  const nErr=(events||[]).filter(function(ev){ return ev.kind==="error"; }).length;
  const nFb=(events||[]).filter(function(ev){ return ev.kind==="feedback"; }).length;
  const nBeta=(events||[]).filter(function(ev){ return ev.kind==="beta"; }).length;   // veredictos de beta probada en el móvil
  const list=(events||[]).filter(function(ev){ return flt==="all" || ev.kind===flt; });
  return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ Ajustes"),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 2px"}}, "👁 Actividad"),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:12}},
      events===null ? "Cargando…" : ((events||[]).length+" eventos · "+nErr+" error(es) · solo tú ves esto")),
    React.createElement("div",{style:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}},
      React.createElement("button",{style:chip(flt==="all"),onClick:function(){ setFlt("all"); }},"Todo"),
      React.createElement("button",{style:chip(flt==="error"),onClick:function(){ setFlt("error"); }},"🐞 Solo errores"+(nErr?" ("+nErr+")":"")),
      React.createElement("button",{style:chip(flt==="feedback"),onClick:function(){ setFlt("feedback"); }},"💬 Sugerencias"+(nFb?" ("+nFb+")":"")),
      React.createElement("button",{style:chip(flt==="beta"),onClick:function(){ setFlt("beta"); }},"🧪 Betas"+(nBeta?" ("+nBeta+")":""))),
    events!==null && list.length===0 && React.createElement("div",{style:{fontSize:13,color:"var(--muted)",padding:"14px 0"}},
      flt==="error" ? "Sin errores en los últimos eventos. 🎉" : flt==="feedback" ? "Sin sugerencias todavía (llegan desde el popup de Novedades)." : flt==="beta" ? "Ninguna beta revisada todavía (se aprueban desde Ajustes → Dev → Pruebas → Revisar esta beta)." : "Sin eventos todavía (los pings/errores de los usuarios aparecerán aquí)."),
    list.map(function(ev,i){
      const d=new Date(ev.created_at);
      const when=d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
      const bd=ev.kind==="error"?"var(--coral)":ev.kind==="feedback"?"var(--blue)":"var(--line)";
      const ic=ev.kind==="error"?"🐞 ":ev.kind==="feedback"?"💬 ":"👋 ";
      return React.createElement("div",{key:i,style:{padding:"10px 12px",borderRadius:12,border:"1px solid "+bd,background:"var(--surface)",marginBottom:8,fontSize:12,lineHeight:1.5}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",gap:8}},
          React.createElement("span",{style:{fontWeight:800}},ic+(ev.email||"¿?")),
          React.createElement("span",{style:{color:"var(--muted-2)",flex:"0 0 auto"}},when)),
        ev.kind==="error" && React.createElement("div",{style:{color:"var(--coral)",overflowWrap:"anywhere"}},ev.message),
        ev.kind==="feedback" && React.createElement("div",{style:{overflowWrap:"anywhere"}},ev.message),
        ev.kind!=="ping" && ev.detail && React.createElement("div",{style:{color:"var(--muted-2)",fontSize:10.5,overflowWrap:"anywhere"}},ev.detail),
        React.createElement("div",{style:{color:"var(--muted-2)",fontSize:10.5}},"v"+(ev.app_version||"?")+" · "+(ev.platform||"?"))
      );
    }),
    React.createElement("button",{style:{width:"100%",padding:"12px",borderRadius:12,border:"1px solid var(--line)",background:"var(--surface-2)",color:"var(--text)",fontWeight:700,fontSize:14,marginTop:8,cursor:"pointer"},onClick:onReload},"↻ Recargar")
  ));
}

/* Privacidad DENTRO de la app (2026-07-17): antes era window.open("privacy.html","_blank"), que en
   el móvil abría una ventana sin safe-area (el título quedaba bajo el notch, «muy arriba») y de la
   que «costaba tirar para atrás». Ahora es un panel con cabecera, gesto atrás y el mismo diseño que
   el resto — mismo patrón que ActivityPanel. El contenido va en i18n (pv_*), en los tres idiomas. */
function PrivacyPanel({onClose}){
  useBackClose(true, onClose);   // gesto atrás del móvil: cierra esta pantalla
  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 32px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:560,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const card={background:"var(--sur)",border:"1px solid var(--line-soft)",borderRadius:18,padding:"6px 16px 14px",marginTop:14,boxShadow:"var(--shadow)"};
  const h2={fontSize:14.5,fontWeight:800,color:"var(--mint)",margin:"16px 0 8px",letterSpacing:.2};
  const pS={fontSize:14,lineHeight:1.6,color:"var(--text)",margin:0};
  const sec=function(h, body){
    return React.createElement("div",{style:card},
      React.createElement("div",{style:Object.assign({},h2,{marginTop:8})}, h),
      Array.isArray(body)
        ? React.createElement("ul",{style:{margin:0,paddingLeft:"1.15em"}}, body.map(function(x,i){ return React.createElement("li",{key:i,style:{fontSize:14,lineHeight:1.6,marginBottom:6}}, x); }))
        : React.createElement("p",{style:pS}, body)
    );
  };
  return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("st_back_settings")),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 4px"}}, "🔒 "+t("pv_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:12.5,marginBottom:4}}, t("pv_updated")),
    sec(t("pv_s1_h"), t("pv_s1")),
    sec(t("pv_s2_h"), t("pv_s2")),
    sec(t("pv_s3_h"), t("pv_s3")),
    sec(t("pv_s4_h"), t("pv_s4"))
  ));
}

/* Hogar y compartido DENTRO de Ajustes (2026-07-18): con la nav v4 de 4 tabs, la pestaña
   «Compartido» (hogar + grupos de gastos) se quedó sin sitio y era inalcanzable. Mismo patrón
   de pantalla propia que ActivityPanel/PrivacyPanel. */
function SharedPanel({state, set, uid, totals, showToast, meEmail, onClose}){
  useBackClose(true, onClose);
  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("v4_back")),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 10px"}}, "🏠 "+t("st_shared")),
    React.createElement(Shared,{state:state,set:set,uid:uid,totals:totals,showToast:showToast,meEmail:meEmail})
  ));
}

/* Sugerencias con pantalla propia (2026-07-18): antes la caja vivía dentro del popup de
   Novedades y quedaba enterrada entre versiones. Novedades queda solo como historial. */
function FeedbackPanel({state, set, showToast, onClose}){
  useBackClose(true, onClose);
  const [fb,setFb]=useState("");
  const [sending,setSending]=useState(false);
  const notes=(state&&state.verNotes)||[];
  const sendFb=function(){
    const txt=fb.trim(); if(!txt||sending) return;
    // El apunte se guarda SIEMPRE en el estado (sincroniza y se ve abajo); el envío a
    // app_events es aparte y avisa si no pudo (sin perder nada).
    const note={id:uid(), v:CONFIG.APP_VERSION, text:txt, date:new Date().toISOString()};
    set(function(s){ return Object.assign({},s,{verNotes:[note].concat(s.verNotes||[])}); });
    setSending(true);
    Promise.resolve().then(function(){ return cloud.feedback(txt); })
      .then(function(){ showToast(t("wn_fb_sent")); })
      .catch(function(){ showToast(t("wn_fb_offline")); })
      .then(function(){ setSending(false); });
    setFb("");
  };
  const delNote=function(id){ set(function(s){ return Object.assign({},s,{verNotes:(s.verNotes||[]).filter(function(n){ return n.id!==id; })}); }); };
  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const inp={width:"100%",minHeight:96,padding:"10px 12px",borderRadius:12,border:"1px solid var(--line)",background:"var(--bg-2)",color:"var(--text)",fontSize:14,fontFamily:"'Manrope',sans-serif",boxSizing:"border-box",resize:"vertical"};
  return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("st_back_settings")),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 4px"}}, t("wn_fb_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:12}}, t("wn_fb_hint")),
    React.createElement("textarea",{style:inp,placeholder:t("wn_fb_ph"),value:fb,onChange:function(e){ setFb(e.target.value); }}),
    React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:10},disabled:!fb.trim()||sending,onClick:sendFb}, sending?"…":("💬 "+t("wn_fb_send"))),
    notes.length>0 && React.createElement("div",{style:{marginTop:16}},
      React.createElement("div",{style:{fontWeight:700,fontSize:12,color:"var(--muted)",marginBottom:6}}, t("wn_yours")),
      notes.map(function(n){ return React.createElement("div",{key:n.id,style:{display:"flex",gap:8,alignItems:"flex-start",padding:"7px 0",borderTop:"1px solid var(--line)",fontSize:12,lineHeight:1.5}},
        React.createElement("div",{style:{flex:1,overflowWrap:"anywhere"}}, React.createElement("span",{style:{color:"var(--muted-2)"}},"v"+n.v+" · "+new Date(n.date).toLocaleDateString(loc(),{day:"2-digit",month:"2-digit"})+" — "), n.text),
        React.createElement("button",{className:"ex-del",title:"🗑",onClick:function(){ delNote(n.id); }},"🗑")); })
    )
  ));
}

/* ============================================================
   🕐 COPIAS AUTOMÁTICAS — restaurar un día de `state_backups` (2026-07-31).
   La copia diaria YA SE ESCRIBÍA sola (backupState, 11-app-main.js) desde hace tiempo, pero era
   de solo escritura: nadie podía MIRARLA ni restaurarla desde la app. Se echó en falta de verdad
   con un desastre real de importación (cuenta a -9k una semana entera, reconectando el banco una
   y otra vez sin arreglarlo): con esto habría sido un «Restaurar ayer» y listo, en vez de limpiar
   a mano gasto a gasto. Reutiliza el MISMO camino que ya prueba `doImport` del JSON manual
   (mcSaveRaw + set + askConfirm de dos pasos): restaurar un día es la misma operación peligrosa
   que restaurar un fichero, solo que el fichero lo trae la nube en vez de tu disco.
   ============================================================ */
function AutoBackupsPanel({state, set, showToast, uid, onClose}){
  useBackClose(true, onClose);
  const [days,setDays]=useState(null);     // null = cargando
  const [busy,setBusy]=useState("");
  useEffect(function(){
    cloud.listBackupDays(uid).then(function(rows){ setDays(rows||[]); })
      .catch(function(e){ setDays([]); showToast("⚠ "+((e&&e.message)||e)); });
  },[uid]);
  const restore=function(day){
    askConfirm({ title:tf("bk_auto_confirm",{day:day}), sub:t("st_confirm_import_sub"), ok:t("st_confirm_import_ok"), danger:true })
      .then(function(yes){
        if(!yes) return;
        setBusy(day);
        cloud.getBackup(uid, day).then(function(data){
          if(!data || !data.accounts){ showToast("✕ "+t("st_badfile")); return; }
          mcSaveRaw(mcStateKey(), data); set(function(){ return data; });
          showToast(t("st_imported")); onClose();
        }).catch(function(e){ showToast("⚠ "+((e&&e.message)||e)); }).finally(function(){ setBusy(""); });
      });
  };
  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const dayRow={display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"12px 14px",borderRadius:12,border:"1px solid var(--line)",marginBottom:8};
  const fmtDay=function(d){ try{ return new Date(d+"T12:00:00").toLocaleDateString(loc(),{weekday:"short",day:"2-digit",month:"short"}); }catch(e){ return d; } };
  return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("st_back_settings")),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 4px"}}, t("bk_auto_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:14}}, t("bk_auto_hint")),
    days===null && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,padding:"18px 2px"}}, t("bp_loading")),
    days!==null && days.length===0 && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,padding:"18px 2px"}}, t("bk_auto_none")),
    days!==null && days.map(function(d){
      return React.createElement("div",{key:d,style:dayRow},
        React.createElement("div",{style:{fontWeight:700,fontSize:14,textTransform:"capitalize"}}, fmtDay(d)),
        React.createElement("button",{className:"btn btn-ghost",disabled:!!busy,onClick:function(){ restore(d); }}, busy===d?"…":t("st_confirm_import_ok"))
      );
    })
  ));
}

/* ============================================================
   ✨ NOVEDADES — popup al actualizar + histórico + sugerencias
   ============================================================
   El CONTENIDO de las notas va solo en castellano a propósito (release notes para el
   círculo actual); el marco del panel sí está traducido (wn_*). Al publicar una versión:
   añadir su entrada AL PRINCIPIO del array, en cristiano y sin jerga. */
/* NOTAS DE VERSIÓN EN TRES IDIOMAS (petición desde el móvil, 2026-07-26: «que el histórico de
   actualizaciones sea en todos los idiomas, no solo español»).

   Cada entrada admite las dos formas:
     · texto suelto            → castellano (todo el histórico anterior a esta fecha)
     · {es:"…",en:"…",ca:"…"}  → traducida

   POR QUÉ NO SE TRADUCE EL HISTÓRICO ENTERO: serían cientos de KB y nadie lee en catalán una
   nota de hace dos meses. De aquí en adelante, cada nota nace en los tres.

   TOPE EN EL BUNDLE (2026-09-07): las notas se acumulaban para siempre (~12 % de la descarga
   gzip). `RELEASE_NOTES_MAX` + el build (`scripts/build-app.mjs`) dejan solo las N más nuevas
   en `public/index.html`. La fuente puede seguir creciendo; CHANGELOG.md guarda el resto.
   Subir N exige cambiar a propósito el test `release-notes-max` (si no, salta). */
function rnT(x,lg){ if(!x) return ""; if(typeof x==="string") return x; return x[lg||CURLANG]||x.es||""; }
/* Los puntos que lee la familia en Novedades. Si una versión declara TANDAS y se olvida de los
   `items` de primer nivel, el popup se quedaba con el título y ni una viñeta: le pasó a la 4.18.5,
   la única de 90 versiones (medido evaluando la lista, no a ojo). En vez de parchear esa entrada,
   se aplanan sus tandas — así ninguna versión futura puede volver a salir muda (2026-09-07). */
function rnItems(r,lg){
  var it=r&&r.items;
  if(!it){
    var tds=(r&&r.tandas)||[];
    if(!tds.length) return [];
    var pl=[]; tds.forEach(function(g){ pl=pl.concat(rnItems(g,lg)); });
    return pl;
  }
  if(Array.isArray(it)) return it;
  return it[lg||CURLANG]||it.es||[];
}
/* Cuántas versiones enseña Novedades / viaja en el OTA. No subir «por holgura»: cada una
   engorda la descarga de toda la familia. El test fija 20. */
var RELEASE_NOTES_MAX=20;
var RELEASE_NOTES=[
  {v:"4.19.6", d:"8 sep 2026",
   t:{es:"Un movimiento marcado como posible repetido tampoco suma en el widget",
      en:"A transaction flagged as a possible repeat no longer counts on the widget either",
      ca:"Un moviment marcat com a possible repetit tampoc no suma al giny"},
   tandas:[
     {id:"repetido-widget", t:{es:"📊 El posible repetido no suma en ningún sitio", en:"📊 The possible repeat counts nowhere", ca:"📊 El possible repetit no suma enlloc"},
      items:{
        es:[
          "Sincroniza los bancos hasta que salga un movimiento apagado, de los que avisan de posible repetido. Mira el total del mes arriba en Gastos y apúntalo.",
          "Cierra la app y mira el widget: tiene que decir esa MISMA cifra, sin sumar el movimiento apagado.",
          "Entra en ese movimiento y dale a «son distintos». Vuelve a Gastos: ahora sí suma. Cierra la app y mira el widget otra vez: tiene que haber subido lo mismo.",
          "Cierra la app del todo, ábrela y sincroniza: el que dejaste apagado tiene que seguir apagado, no encenderse solo."
        ],
        en:[
          "Sincroniza los bancos hasta que salga un movimiento apagado, de los que avisan de posible repetido. Mira el total del mes arriba en Gastos y apúntalo.",
          "Cierra la app y mira el widget: tiene que decir esa MISMA cifra, sin sumar el movimiento apagado.",
          "Entra en ese movimiento y dale a «son distintos». Vuelve a Gastos: ahora sí suma. Cierra la app y mira el widget otra vez: tiene que haber subido lo mismo.",
          "Cierra la app del todo, ábrela y sincroniza: el que dejaste apagado tiene que seguir apagado, no encenderse solo."
        ],
        ca:[
          "Sincroniza los bancos hasta que salga un movimiento apagado, de los que avisan de posible repetido. Mira el total del mes arriba en Gastos y apúntalo.",
          "Cierra la app y mira el widget: tiene que decir esa MISMA cifra, sin sumar el movimiento apagado.",
          "Entra en ese movimiento y dale a «son distintos». Vuelve a Gastos: ahora sí suma. Cierra la app y mira el widget otra vez: tiene que haber subido lo mismo.",
          "Cierra la app del todo, ábrela y sincroniza: el que dejaste apagado tiene que seguir apagado, no encenderse solo."
        ]}},
     {id:"widget-al-volver", t:{es:"🔄 El widget se pone al día al volver a la app", en:"🔄 The widget catches up when you return", ca:"🔄 El giny es posa al dia en tornar a l'app"},
      items:{
        es:[
          "Con la app cerrada, espera a que te entre una compra por notificación y mira el widget. Abre la app, mira el total del mes en Gastos y vuelve al escritorio SIN cerrarla del todo: el widget tiene que decir lo mismo que acabas de ver.",
          "Mira tus inversiones y traspasos viejos en Gastos: tienen que seguir apagados, como «no cuenta», y no haberse convertido en un gasto normal."
        ],
        en:[
          "Con la app cerrada, espera a que te entre una compra por notificación y mira el widget. Abre la app, mira el total del mes en Gastos y vuelve al escritorio SIN cerrarla del todo: el widget tiene que decir lo mismo que acabas de ver.",
          "Mira tus inversiones y traspasos viejos en Gastos: tienen que seguir apagados, como «no cuenta», y no haberse convertido en un gasto normal."
        ],
        ca:[
          "Con la app cerrada, espera a que te entre una compra por notificación y mira el widget. Abre la app, mira el total del mes en Gastos y vuelve al escritorio SIN cerrarla del todo: el widget tiene que decir lo mismo que acabas de ver.",
          "Mira tus inversiones y traspasos viejos en Gastos: tienen que seguir apagados, como «no cuenta», y no haberse convertido en un gasto normal."
        ]}}
   ],
   items:{
     es:["Si un movimiento sale marcado como posible repetido, deja de contar también en el widget y en los avisos, no solo dentro de la app.","Esa marca ya no se pierde al cerrar la app ni al cambiar de móvil.","El widget vuelve a recibir las cifras de la app al abrirla de nuevo.","Las inversiones y los traspasos conservan su categoría al recuperar los movimientos guardados."],
     en:["If a transaction is flagged as a possible repeat, it now stops counting on the widget and in alerts too, not just inside the app.","That flag no longer gets lost when you close the app or switch phones.","The widget receives the app's figures again when you return to the app.","Investments and transfers keep their category when saved transactions are retrieved."],
     ca:["Si un moviment surt marcat com a possible repetit, deixa de comptar també al giny i als avisos, no només dins de l'app.","Aquesta marca ja no es perd en tancar l'app ni en canviar de mòbil.","El giny torna a rebre les xifres de l'app quan s'obre de nou.","Les inversions i els traspassos conserven la categoria en recuperar els moviments desats."]
   }},
  {v:"4.19.5", d:"7 sep 2026",
   t:{es:"El historial de novedades guarda las últimas 20 versiones",
      en:"What's new keeps the last 20 versions",
      ca:"L'historial de novetats guarda les darreres 20 versions"},

   
   items:{
     es:["El historial de novedades guarda las últimas 20 versiones."],
     en:["What's new keeps the last 20 versions."],
     ca:["L'historial de novetats guarda les darreres 20 versions."]
   }},
  {v:"4.19.4", d:"7 sep 2026",
   t:{es:"La app arranca más suelta si tienes muchos movimientos",
      en:"The app starts more smoothly when you have lots of transactions",
      ca:"L'app arrenca més fluida si tens molts moviments"},

   
   items:{
     es:["Con muchos movimientos, cambiar de pestaña al arrancar vuelve a ir fluido."],
     en:["With lots of transactions, switching tabs right after launch feels smooth again."],
     ca:["Amb molts moviments, canviar de pestanya en arrencar torna a anar fluid."]
   }},
  {v:"4.19.3", d:"7 sep 2026",
   t:{es:"Revisar la beta enseña toda la ronda, con pasos claros",
      en:"Beta review shows the whole round, with clear steps",
      ca:"Revisar la beta ensenya tota la ronda, amb passos clars"},

   
   items:{
     es:["En Revisar la beta salen todas las tandas de la ronda, con pasos concretos para probar cada una."],
     en:["Beta review lists every tanda in the round, with concrete steps to try each one."],
     ca:["A Revisar la beta surten totes les tandes de la ronda, amb passos concrets per provar cadascuna."]
   }},
  {v:"4.19.2", d:"7 sep 2026",
   t:{es:"El gasto del mes cuadra con el widget a primera hora",
      en:"Month spend matches the widget first thing in the morning",
      ca:"La despesa del mes quadra amb el giny a primera hora"},
   tandas:[
     {id:"ventana-mes", t:{es:"📅 Mismo mes en todos sitios", en:"📅 Same month everywhere", ca:"📅 El mateix mes a tot arreu"},
      items:{
        es:[
          "Gastos: mira el total del mes arriba. Con la app cerrada, mira el widget: tiene que decir la misma cifra.",
          "Si apuntas un gasto pasada la medianoche del día 1, tiene que sumar en el mes nuevo en los dos sitios, no solo en uno.",
        ],
        en:[
          "Gastos: mira el total del mes arriba. Con la app cerrada, mira el widget: tiene que decir la misma cifra.",
          "Si apuntas un gasto pasada la medianoche del día 1, tiene que sumar en el mes nuevo en los dos sitios, no solo en uno.",
        ],
        ca:[
          "Gastos: mira el total del mes arriba. Con la app cerrada, mira el widget: tiene que decir la misma cifra.",
          "Si apuntas un gasto pasada la medianoche del día 1, tiene que sumar en el mes nuevo en los dos sitios, no solo en uno.",
        ]}}
   ],
   items:{
     es:["El total del mes en Gastos y en el widget coinciden también el día 1 a primera hora."],
     en:["The monthly total in Gastos and on the widget matches even early on the 1st."],
     ca:["El total del mes a Despeses i al giny coincideixen també el dia 1 a primera hora."]
   }},
  {v:"4.19.1", d:"7 sep 2026",
   t:{es:"Cambiar o borrar un movimiento ya no toca a otro igual",
      en:"Editing or deleting a transaction no longer hits another lookalike",
      ca:"Canviar o esborrar un moviment ja no toca un altre d'igual"},
   tandas:[
     {id:"id-fila", t:{es:"🎯 Solo ese movimiento", en:"🎯 Just that transaction", ca:"🎯 Només aquell moviment"},
      items:{
        es:[
          "Gastos: busca dos movimientos del MISMO día y el MISMO importe. Cambia la categoría de uno. Solo tiene que cambiar ese; el otro se queda como estaba.",
          "Con esos mismos dos: borra uno. Tiene que desaparecer solo el que tocaste. Cierra la app, vuelve a abrirla y sincroniza: el que quedaba sigue ahí.",
        ],
        en:[
          "Gastos: busca dos movimientos del MISMO día y el MISMO importe. Cambia la categoría de uno. Solo tiene que cambiar ese; el otro se queda como estaba.",
          "Con esos mismos dos: borra uno. Tiene que desaparecer solo el que tocaste. Cierra la app, vuelve a abrirla y sincroniza: el que quedaba sigue ahí.",
        ],
        ca:[
          "Gastos: busca dos movimientos del MISMO día y el MISMO importe. Cambia la categoría de uno. Solo tiene que cambiar ese; el otro se queda como estaba.",
          "Con esos mismos dos: borra uno. Tiene que desaparecer solo el que tocaste. Cierra la app, vuelve a abrirla y sincroniza: el que quedaba sigue ahí.",
        ]}},
     {id:"avisos-presupuesto", t:{es:"🔔 Avisos al pasar del 50/80/95/100", en:"🔔 Alerts at 50/80/95/100", ca:"🔔 Avisos en passar del 50/80/95/100"},
      items:{
        es:[
          "Ajustes → Gestionar mis bancos, apartado «También apuntar gastos de tarjeta de…». El chip de tu cuenta del día a día sale como «principal (obligatoria)»: tócalo y comprueba que te lo dice y NO se desmarca. Esa cuenta cuenta siempre.",
          "Ahora marca o desmarca un banco EXTRA (uno que no sea el principal). Vuelve a Gastos: el total del mes tiene que cambiar al momento, sin sincronizar.",
          "Sus movimientos NO se borran: con el banco desmarcado siguen en la lista, solo dejan de sumar en el total. Vuélvelo a marcar y el total vuelve a subir.",
          "Si con ese cambio cruzas el 50, 80, 95 o 100 por ciento de tu presupuesto, tiene que saltarte el aviso. Y una sola vez, no tres seguidos.",
        ],
        en:[
          "Ajustes → Gestionar mis bancos, apartado «También apuntar gastos de tarjeta de…». El chip de tu cuenta del día a día sale como «principal (obligatoria)»: tócalo y comprueba que te lo dice y NO se desmarca. Esa cuenta cuenta siempre.",
          "Ahora marca o desmarca un banco EXTRA (uno que no sea el principal). Vuelve a Gastos: el total del mes tiene que cambiar al momento, sin sincronizar.",
          "Sus movimientos NO se borran: con el banco desmarcado siguen en la lista, solo dejan de sumar en el total. Vuélvelo a marcar y el total vuelve a subir.",
          "Si con ese cambio cruzas el 50, 80, 95 o 100 por ciento de tu presupuesto, tiene que saltarte el aviso. Y una sola vez, no tres seguidos.",
        ],
        ca:[
          "Ajustes → Gestionar mis bancos, apartado «También apuntar gastos de tarjeta de…». El chip de tu cuenta del día a día sale como «principal (obligatoria)»: tócalo y comprueba que te lo dice y NO se desmarca. Esa cuenta cuenta siempre.",
          "Ahora marca o desmarca un banco EXTRA (uno que no sea el principal). Vuelve a Gastos: el total del mes tiene que cambiar al momento, sin sincronizar.",
          "Sus movimientos NO se borran: con el banco desmarcado siguen en la lista, solo dejan de sumar en el total. Vuélvelo a marcar y el total vuelve a subir.",
          "Si con ese cambio cruzas el 50, 80, 95 o 100 por ciento de tu presupuesto, tiene que saltarte el aviso. Y una sola vez, no tres seguidos.",
        ]}}
   ],
   items:{
     es:["Borrar o editar un movimiento apunta solo a ese, no a otro gemelo del mismo día."],
     en:["Deleting or editing a transaction targets only that one, not a same-day lookalike."],
     ca:["Esborrar o editar un moviment apunta només a aquell, no a un altre bessó del mateix dia."]
   }},
  {v:"4.19.0", d:"7 sep 2026",
   t:{es:"Sincronización más completa y Gastos a tu manera",en:"More complete syncing and expenses your way",ca:"Sincronització més completa i Despeses a la teva manera"},
   tandas:[
     {id:"tr-reactivo",t:{es:"🏦 Trade Republic sin reiniciar",en:"🏦 Trade Republic without restart",ca:"🏦 Trade Republic sense reiniciar"},items:{
       es:["Ajustes: si Trade Republic sale caído, conéctalo o sincronízalo. Tiene que pasar a conectado AHÍ MISMO, sin cerrar y abrir la app, Y salirte un aviso verde de que se ha conectado bien.","Vuelve a darle a Sincronizar estando ya conectado: te lo tiene que volver a decir. Pero abrir Ajustes sin tocar nada NO puede sacar ese aviso solo.","Vuelve a Cartera sin reiniciar: el aviso de TR caído también tiene que haber desaparecido."],
       en:["Ajustes: si Trade Republic sale caído, conéctalo o sincronízalo. Tiene que pasar a conectado AHÍ MISMO, sin cerrar y abrir la app, Y salirte un aviso verde de que se ha conectado bien.","Vuelve a darle a Sincronizar estando ya conectado: te lo tiene que volver a decir. Pero abrir Ajustes sin tocar nada NO puede sacar ese aviso solo.","Vuelve a Cartera sin reiniciar: el aviso de TR caído también tiene que haber desaparecido."],
       ca:["Ajustes: si Trade Republic sale caído, conéctalo o sincronízalo. Tiene que pasar a conectado AHÍ MISMO, sin cerrar y abrir la app, Y salirte un aviso verde de que se ha conectado bien.","Vuelve a darle a Sincronizar estando ya conectado: te lo tiene que volver a decir. Pero abrir Ajustes sin tocar nada NO puede sacar ese aviso solo.","Vuelve a Cartera sin reiniciar: el aviso de TR caído también tiene que haber desaparecido."]}},

     

     
     {id:"categoria-ia",t:{es:"🤖 Categoría de inteligencia artificial",en:"🤖 AI category",ca:"🤖 Categoria d'intel·ligència artificial"},items:{
       es:["Apuntar: crea un gasto a mano que se llame ChatGPT. Tiene que caer en Inteligencia artificial, no en Ocio.","Mira tus cargos VIEJOS de ChatGPT o Claude: tienen que seguir donde estaban. Esto solo aplica a lo nuevo, es lo que decidiste."],
       en:["Apuntar: crea un gasto a mano que se llame ChatGPT. Tiene que caer en Inteligencia artificial, no en Ocio.","Mira tus cargos VIEJOS de ChatGPT o Claude: tienen que seguir donde estaban. Esto solo aplica a lo nuevo, es lo que decidiste."],
       ca:["Apuntar: crea un gasto a mano que se llame ChatGPT. Tiene que caer en Inteligencia artificial, no en Ocio.","Mira tus cargos VIEJOS de ChatGPT o Claude: tienen que seguir donde estaban. Esto solo aplica a lo nuevo, es lo que decidiste."]}},
     {id:"orden-gastos",t:{es:"↕️ Ordenar a mano",en:"↕️ Manual ordering",ca:"↕️ Ordenar a mà"},items:{
       es:["Gastos: en un día con dos o más movimientos, arrastra uno por su asa y suéltalo encima o debajo de otro del mismo día.","Cierra la app, ábrela y vuelve a Gastos: tiene que seguir en el sitio donde lo dejaste, y ninguna fecha puede haber cambiado."],
       en:["Gastos: en un día con dos o más movimientos, arrastra uno por su asa y suéltalo encima o debajo de otro del mismo día.","Cierra la app, ábrela y vuelve a Gastos: tiene que seguir en el sitio donde lo dejaste, y ninguna fecha puede haber cambiado."],
       ca:["Gastos: en un día con dos o más movimientos, arrastra uno por su asa y suéltalo encima o debajo de otro del mismo día.","Cierra la app, ábrela y vuelve a Gastos: tiene que seguir en el sitio donde lo dejaste, y ninguna fecha puede haber cambiado."]}}
   ],
   items:{
     es:["Trade Republic actualiza saldo, posiciones y estado sin necesitar reiniciar.","La sincronización recoge movimientos de todas las cuentas enlazadas.","Si un movimiento del banco puede repetir uno del móvil, se marca para que lo resuelvas.","Las herramientas de inteligencia artificial tienen categoría propia.","Los movimientos se pueden ordenar a mano dentro de cada día."],
     en:["Trade Republic updates its balance, positions and status without requiring a restart.","Sync collects transactions from every linked account.","If a bank transaction may repeat one from your phone, it is marked so you can resolve it.","Artificial intelligence tools have their own category.","Transactions can be manually ordered within each day."],
     ca:["Trade Republic actualitza saldo, posicions i estat sense haver de reiniciar.","La sincronització recull moviments de tots els comptes enllaçats.","Si un moviment del banc pot repetir un del mòbil, es marca perquè el resolguis.","Les eines d'intel·ligència artificial tenen categoria pròpia.","Els moviments es poden ordenar manualment dins de cada dia."]
   }},
  {v:"4.18.7", d:"6 sep 2026",
   t:{es:"El total de Gastos se actualiza al cambiar de banco",
      en:"Gastos total updates when you change banks",
      ca:"El total de Despeses s'actualitza en canviar de banc"},
   tandas:[
     {id:"cabecera-bancos", t:{es:"📊 Cabecera al día", en:"📊 Header stays current", ca:"📊 Capçalera al dia"},
      items:{
        es:[
          "Si quitas o añades un banco de gasto diario, el total del mes en Gastos se actualiza al momento.",
          "Ya no hace falta sincronizar para que la cabecera deje de mostrar de más.",
        ],
        en:[
          "If you add or remove a daily-spend bank, the monthly total in Gastos updates right away.",
          "You no longer need to sync for the header to stop showing too much.",
        ],
        ca:[
          "Si treus o afegeixes un banc de despesa diària, el total del mes a Despeses s'actualitza de seguida.",
          "Ja no cal sincronitzar perquè la capçalera deixi de mostrar de més.",
        ],
      }},
   ],
   items:{
     es:[
       "Si quitas o añades un banco de gasto diario, el total del mes en Gastos se actualiza al momento.",
       "Ya no hace falta sincronizar para que la cabecera deje de mostrar de más.",
     ],
     en:[
       "If you add or remove a daily-spend bank, the monthly total in Gastos updates right away.",
       "You no longer need to sync for the header to stop showing too much.",
     ],
     ca:[
       "Si treus o afegeixes un banc de despesa diària, el total del mes a Despeses s'actualitza de seguida.",
       "Ja no cal sincronitzar perquè la capçalera deixi de mostrar de més.",
     ],
   }},
  {v:"4.18.6", d:"6 sep 2026",
   t:{es:"La app ya no borra movimientos por parecerse",
      en:"The app no longer deletes look-alike movements",
      ca:"L'app ja no esborra moviments per assemblar-se"},
   tandas:[
     {id:"contencion-dupes", t:{es:"🧾 Movimientos que se parecían", en:"🧾 Look-alike movements", ca:"🧾 Moviments que s'assemblaven"},
      items:{
        es:[
          "Si el banco y el móvil apuntaban lo mismo con nombres distintos, la app ya no borra uno de los dos por su cuenta.",
          "Puede que veas alguna fila de más mientras afinamos el criterio; el total del mes puede subir un poco hasta entonces.",
          "Los movimientos borrados a mano siguen borrados.",
        ],
        en:[
          "If the bank and your phone logged the same payment under different names, the app no longer deletes one of them on its own.",
          "You may see an extra row for a while while we refine the match; the monthly total may rise a little until then.",
          "Movements deleted by hand stay deleted.",
        ],
        ca:[
          "Si el banc i el mòbil apuntaven el mateix amb noms diferents, l'app ja no n'esborra un pel seu compte.",
          "Pot ser que vegis alguna fila de més mentre afinem el criteri; el total del mes pot pujar una mica fins aleshores.",
          "Els moviments esborrats a mà segueixen esborrats.",
        ],
      }},
   ],
   items:{
     es:[
       "Si el banco y el móvil apuntaban lo mismo con nombres distintos, la app ya no borra uno de los dos por su cuenta.",
       "Puede que veas alguna fila de más mientras afinamos el criterio; el total del mes puede subir un poco hasta entonces.",
       "Los movimientos borrados a mano siguen borrados.",
     ],
     en:[
       "If the bank and your phone logged the same payment under different names, the app no longer deletes one of them on its own.",
       "You may see an extra row for a while while we refine the match; the monthly total may rise a little until then.",
       "Movements deleted by hand stay deleted.",
     ],
     ca:[
       "Si el banc i el mòbil apuntaven el mateix amb noms diferents, l'app ja no n'esborra un pel seu compte.",
       "Pot ser que vegis alguna fila de més mentre afinem el criteri; el total del mes pot pujar una mica fins aleshores.",
       "Els moviments esborrats a mà segueixen esborrats.",
     ],
   }},
  {v:"4.18.5", d:"18 ago 2026",
   t:{es:"El fondo ya no parpadea al cambiar de pestaña",
      en:"No more flicker when switching tabs",
      ca:"El fons ja no parpelleja en canviar de pestanya"},
   tandas:[
     {id:"destello-tabs", t:"✨ Cambio de pestaña limpio", items:[
       "Al deslizar entre pestañas ya no se ve ese oscurecimiento del fondo.",
       "Pasaba con cualquier temática, también sin ninguna.",
       "Si estrenas la app, los gestos funcionan desde el primer momento (antes había que cerrarla y volver a abrirla).",
     ]},
   ],
  },
  {v:"4.18.4", d:"18 ago 2026",
   t:{es:"Cada banco descuenta lo suyo",
      en:"Each bank now subtracts only its own spending",
      ca:"Cada banc descompta el que és seu"},
   tandas:[
     {id:"saldo-cruzado", t:"🏦 Saldos por banco", items:[
       "Si pagabas con un banco que no era el del día a día, el gasto ya no se le resta al principal.",
       "El dinero total no cambia de sitio inventado: cada euro queda en su cuenta.",
       "Editar el saldo a mano y volver a mirarlo tiene que dar el mismo número.",
     ]},
   ],
   items:{
   es:[
    "🏦 Si pagabas con un banco que no era el del día a día, el gasto se le restaba por error al saldo del principal. El dinero total siempre fue correcto; el reparto entre cuentas, no. Ya está cada euro en su sitio.",
   ],
   en:[
    "🏦 Spending from a bank that wasn't your day-to-day account was wrongly taken off the main balance. The total was always right; the split between accounts wasn't. Each euro is in its place now.",
   ],
   ca:[
    "🏦 Si pagaves amb un banc que no era el del dia a dia, la despesa es restava per error al saldo del principal. El total sempre va ser correcte; el repartiment entre comptes, no. Cada euro ja és al seu lloc.",
   ]}},
  {v:"4.18.3", d:"18 ago 2026",
   t:{es:"El saldo del banco ya no salta a un número raro, y el widget deja de esconder lo que puedes gastar",
      en:"Bank balances no longer jump to a bogus figure, and the widget keeps showing what you can spend",
      ca:"El saldo del banc ja no salta a un número rar, i el widget deixa d'amagar el que pots gastar"},
   tandas:[
     {id:"ob-saldo-widget-apk", t:"🏦 Saldo del banco y widget", items:[
       "Si Revolut (u otro banco) salía en rojo inventado y al sincronizar se arreglaba, ya no debería pintar ese rojo: se queda el último saldo bueno.",
       "Abre la app: en el widget vuelve a verse «Puedes gastar».",
       "Cierra la app, paga, espera la noti: gastado del mes = Gastos. «Puedes gastar» solo se mueve con la app nueva instalada (no basta recargar).",
     ]},
   ],
   items:{
   es:[
    "🏦 El saldo de un banco ya no salta a un número en rojo inventado: si llega un dato raro, se queda el último bueno.",
    "📊 En el widget vuelve a verse «Puedes gastar». Para que se actualice también con la app cerrada, instala la actualización de la app.",
   ],
   en:[
    "🏦 A bank balance no longer jumps to a made-up negative: if a bad figure arrives, the last good one stays.",
    "📊 The widget shows «you can spend» again. For it to update with the app closed, install the app update.",
   ],
   ca:[
    "🏦 El saldo d'un banc ja no salta a un número en vermell inventat: si arriba una dada rara, es queda l'últim bo.",
    "📊 Al widget torna a veure's «Pots gastar». Perquè s'actualitzi amb l'app tancada, instal·la l'actualització de l'app.",
   ]}},
  {v:"4.18.2", d:"17 ago 2026",
   t:{es:"El widget ya dice el mismo gasto del mes que la app",
      en:"The widget now shows the same monthly spend as the app",
      ca:"El widget ja diu la mateixa despesa del mes que l'app"},
   tandas:[
     {id:"widget-ingest", t:"📊 Widget con la app cerrada", items:[
       "Mira el widget y abre Gastos: «gastado este mes» es el mismo número.",
       "Cierra la app del todo, paga con la tarjeta y espera la noti: el widget se actualiza y sigue cuadrando.",
       "Si una compra avisó dos veces (el banco y la cartera), el widget no la suma dos veces.",
       "Un rato después, sin abrir la app, el widget NO debe haberse descuadrado.",
     ]},
   ],
   items:{
   es:[
    "📊 El gasto del mes del widget es el mismo que el de la app, también si la tenías cerrada.",
    "Si una compra avisó dos veces (el banco y la cartera), solo cuenta una.",
   ],
   en:[
    "📊 The widget's month spending matches the app, even if the app was closed.",
    "If a purchase pinged you twice (the bank and the wallet), it only counts once.",
   ],
   ca:[
    "📊 La despesa del mes del widget és la mateixa que la de l'app, també si la tenies tancada.",
    "Si una compra t'ha avisat dues vegades (el banc i la cartera), només en compta una.",
   ]}},
  {v:"4.18.1", d:"17 ago 2026",
   t:{es:"Recibos, sugerir categoría en cualquier gasto, y el banco al apuntar sin el lío",
      en:"Bills, suggest a category on any payment, and a tidier bank picker",
      ca:"Rebuts, suggerir categoria en qualsevol despesa, i el banc en apuntar sense el embolic"},
   tandas:[
     {id:"recibos-ia-banco", t:"🧾 Recibos, sugerir categoría y banco al apuntar", items:[
       "Hay categoría Recibos: un Vodafone, un Mapfre o el alquiler ya no se quedan en Otros.",
       "Movistar Plus sigue en ocio (es la tele). El teléfono Movistar va a Recibos.",
       "Abres un gasto que NO está en Otros y también sale «Sugerir categoría».",
       "Al apuntar con +, el banco es una pastilla. Al tocarla se despliegan los bancos, no hay una fila de chips.",
     ]},
   ],
   items:{
   es:[
    "🧾 Recibos es una categoría propia: teléfono, internet, seguro o el alquiler ya no se quedan en Otros.",
    "✨ En cualquier movimiento puedes pedir una sugerencia de categoría, no solo si está en Otros.",
    "🏦 Al apuntar un gasto, el banco es una pastilla que se despliega, como los filtros de Gastos.",
   ],
   en:[
    "🧾 Bills is its own category: phone, internet, insurance or rent no longer sit in Other.",
    "✨ On any payment you can ask for a category suggestion, not only if it is in Other.",
    "🏦 When adding a payment, the bank is a pill that expands, like the filters in Spending.",
   ],
   ca:[
    "🧾 Rebuts és una categoria pròpia: telèfon, internet, assegurança o el lloguer ja no es queden a Altres.",
    "✨ En qualsevol moviment pots demanar un suggeriment de categoria, no només si és a Altres.",
    "🏦 En apuntar una despesa, el banc és una pastilla que es desplega, com els filtres de Despeses.",
   ]}},
  {v:"4.18.0", d:"17 ago 2026",
   t:{es:"Gastos de todos tus bancos del día a día, y más categorías",
      en:"Spending from every day-to-day bank, plus extra categories",
      ca:"Despeses de tots els teus bancs del dia a dia, i més categories"},
   tandas:[
     {id:"filtro-apuntar", t:"📅 Fecha al apuntar y todos los bancos del día a día", items:[
       "En Gastos, si tienes varios bancos marcados como gasto diario, salen los movimientos de TODOS ellos (no solo el principal).",
       "Un recibo de un banco que NO está marcado como gasto diario sigue sin contar para el presupuesto.",
       "Una inversión o un traspaso no cuenta aunque salga de un banco del día a día.",
       "Al apuntar un gasto con + puedes elegir el día, no solo hoy.",
       "Al abrir un movimiento puedes cambiarle la fecha.",
       "Si eliges un rango de fechas a medida, el calendario es el de la app (no el gris de Android).",
     ]},
     {id:"mas-categorias", t:"🍦 Heladería, joyería y videojuegos", items:[
       "Hay categorías nuevas: heladería, joyería y videojuegos.",
       "Un cargo de Steam o Instant Gaming cae en videojuegos, no en ocio.",
       "Una heladería ya no se mezcla con bares y restaurantes.",
     ]},
   ],
   items:{
   es:[
    "🏦 Si usas más de un banco para el día a día, Gastos enseña los movimientos de todos ellos. Un recibo de otro banco sigue sin contar, y una inversión tampoco.",
    "📅 Al apuntar un gasto o al editarlo puedes elegir el día. El calendario es el de la app.",
    "🍦 Heladería, joyería y videojuegos son categorías propias: Steam e Instant Gaming ya no se van a ocio.",
   ],
   en:[
    "🏦 If you use more than one bank for day-to-day spending, Spending shows movements from all of them. A bill from another bank still doesn't count, and neither does an investment.",
    "📅 When you add or edit a payment you can pick the day. The calendar is the app's own.",
    "🍦 Ice cream, jewellery and games are their own categories: Steam and Instant Gaming no longer land in leisure.",
   ],
   ca:[
    "🏦 Si uses més d'un banc per al dia a dia, Despeses ensenya els moviments de tots. Un rebut d'un altre banc continua sense comptar, i una inversió tampoc.",
    "📅 En apuntar una despesa o en editar-la pots triar el dia. El calendari és el de l'app.",
    "🍦 Gelateria, joieria i videojocs són categories pròpies: Steam i Instant Gaming ja no se'n van a oci.",
   ]}},
  {v:"4.17.2", d:"17 ago 2026",
   t:{es:"El widget deja de sumar un pago dos veces",
      en:"The widget stops counting the same payment twice",
      ca:"El widget deixa de sumar un pagament dues vegades"},
   tandas:[
     {id:"widget-coherente", t:"📊 El widget dice la verdad con la app cerrada", items:[
       "Mira el widget y abre la app: «gastado este mes» es el mismo número en los dos sitios.",
       "En el widget, «te quedan X» y «✅ Puedes gastar Y» tienen que cuadrar entre ellos (Y nunca puede ser mayor que X).",
       "Cierra la app del todo, haz un pago con la tarjeta y espera a la noti: el widget se actualiza y las tres cifras siguen cuadrando.",
       "Vuelve a mirar el widget un rato después, sin abrir la app: NO debe haber vuelto a descuadrarse (ese era el fallo).",
       "Haz un pago que no cuente para el presupuesto (una inversión o un traspaso): el gasto del mes del widget no se mueve.",
       "El saldo de la cuenta de gasto que sale abajo en el widget también baja con cada pago, sin esperar a abrir la app.",
       "★ Si una compra te avisó dos veces (el banco y la cartera), el widget no la suma dos veces: dice lo mismo que Gastos.",
     ]},
     {id:"gastos-orden", t:"🧾 En Gastos se ve qué cuenta y qué no", items:[
       "En Gastos, una inversión o un traspaso salen apagados y ponen «no es un gasto».",
       "Un recibo de un banco que no es el del día a día sale apagado y pone «no es del día a día» (antes los dos decían lo mismo).",
       "Un ingreso NO sale apagado: se ve en verde con su «+», porque entra dinero.",
       "Cada movimiento dice de qué banco sale, también los que apuntas a mano.",
       "Filtros (🎛️) → arriba del todo hay «Qué contar»: elige «Inversión y traspasos» y solo quedan esos.",
       "Prueba también «Ingresos»; con «Todo» vuelves a verlo entero. Ya no está «De otros bancos»: lo quitamos porque para eso valen los chips de banco de abajo.",
       "«Limpiar» quita también ese filtro, no solo las categorías y los bancos.",
       "★ Abre un movimiento, cámbiale el nombre y guarda: la pantalla SIGUE respondiendo (antes se quedaba muerta hasta darle a atrás).",
       "Con el nombre ya cambiado, cierra la ficha y vuelve a abrirla: el nombre nuevo sigue puesto.",
       "★ Sincroniza los bancos después de renombrarlo: el gasto NO puede aparecer duplicado (ese era el fallo).",
     ]},
   ],
   items:{
   es:[
    "📊 El gasto del mes del widget ya es el mismo que el de la app: si una compra te avisó dos veces (el banco y la cartera), no la suma dos veces, y lo que ya habías borrado deja de contarlo.",
   ],
   en:[
    "📊 The widget's month spending now matches the app: if a purchase pinged you twice (the bank and the wallet), it isn't added twice, and anything you already deleted stops counting.",
   ],
   ca:[
    "📊 La despesa del mes del widget ja és la mateixa que la de l'app: si una compra t'ha avisat dues vegades (el banc i la cartera), no la suma dues vegades, i el que ja havies esborrat deixa de comptar-lo.",
   ]}},
  {v:"4.17.1", d:"17 ago 2026",
   t:{es:"Orden en Gastos: qué cuenta, qué no, y de qué banco sale",
      en:"Order in Spending: what counts, what doesn't, and which bank it came from",
      ca:"Ordre a Despeses: què compta, què no, i de quin banc surt"},
   /* La tanda del widget sigue AQUÍ y con los puntos escritos IGUAL que en la 4.16.2 a propósito:
      el panel hereda los ✓/✗ de una compilación anterior casando por el TEXTO del punto, así que
      lo que él ya probó se conserva y solo le quedan los que faltaban. */
   tandas:[
     {id:"widget-coherente", t:"📊 El widget dice la verdad con la app cerrada", items:[
       "Mira el widget y abre la app: «gastado este mes» es el mismo número en los dos sitios.",
       "En el widget, «te quedan X» y «✅ Puedes gastar Y» tienen que cuadrar entre ellos (Y nunca puede ser mayor que X).",
       "Cierra la app del todo, haz un pago con la tarjeta y espera a la noti: el widget se actualiza y las tres cifras siguen cuadrando.",
       "Vuelve a mirar el widget un rato después, sin abrir la app: NO debe haber vuelto a descuadrarse (ese era el fallo).",
       "Haz un pago que no cuente para el presupuesto (una inversión o un traspaso): el gasto del mes del widget no se mueve.",
       "El saldo de la cuenta de gasto que sale abajo en el widget también baja con cada pago, sin esperar a abrir la app.",
     ]},
     {id:"gastos-orden", t:"🧾 En Gastos se ve qué cuenta y qué no", items:[
       "En Gastos, una inversión o un traspaso salen apagados y ponen «no es un gasto».",
       "Un recibo de un banco que no es el del día a día sale apagado y pone «no es del día a día» (antes los dos decían lo mismo).",
       "Un ingreso NO sale apagado: se ve en verde con su «+», porque entra dinero.",
       "Cada movimiento dice de qué banco sale, también los que apuntas a mano.",
       "Filtros (🎛️) → arriba del todo hay «Qué contar»: elige «Inversión y traspasos» y solo quedan esos.",
       "Prueba también «Ingresos»; con «Todo» vuelves a verlo entero. Ya no está «De otros bancos»: lo quitamos porque para eso valen los chips de banco de abajo.",
       "«Limpiar» quita también ese filtro, no solo las categorías y los bancos.",
       "★ Abre un movimiento, cámbiale el nombre y guarda: la pantalla SIGUE respondiendo (antes se quedaba muerta hasta darle a atrás).",
       "Con el nombre ya cambiado, cierra la ficha y vuelve a abrirla: el nombre nuevo sigue puesto.",
       "★ Sincroniza los bancos después de renombrarlo: el gasto NO puede aparecer duplicado (ese era el fallo).",
     ]},
   ],
   items:{
   es:[
    "🧾 En Gastos ahora se distingue de un vistazo lo que cuenta de lo que no: una inversión o un traspaso dicen «no es un gasto», y un recibo de otro banco dice «no es del día a día». Antes los dos ponían lo mismo y costaba saber por qué.",
    "🎛️ En los filtros hay un apartado nuevo, «Qué contar», para ver por separado los gastos que cuentan, los ingresos, las inversiones y traspasos, o lo que viene de otros bancos.",
    "✏️ Los movimientos que llegan del banco sin nombre (los que ponen «Movimiento») ya se pueden renombrar sin que la siguiente sincronización los vuelva a meter duplicados.",
   ],
   en:[
    "🧾 Spending now shows at a glance what counts and what doesn't: an investment or a transfer says «not spending», and a bill from another bank says «not day-to-day». Before, both said the same thing and it was hard to tell why.",
    "🎛️ The filters have a new section, «What to count», to look separately at spending that counts, income, investing and transfers, or whatever comes from other banks.",
    "✏️ Movements that arrive from the bank with no name (the ones saying «Movement») can now be renamed without the next sync bringing them back in duplicate.",
   ],
   ca:[
    "🧾 A Despeses ara es distingeix d'un cop d'ull el que compta del que no: una inversió o un traspàs diuen «no és una despesa», i un rebut d'un altre banc diu «no és del dia a dia». Abans tots dos deien el mateix i costava saber per què.",
    "🎛️ Als filtres hi ha un apartat nou, «Què comptar», per veure per separat les despeses que compten, els ingressos, les inversions i traspassos, o el que ve d'altres bancs.",
    "✏️ Els moviments que arriben del banc sense nom (els que posen «Moviment») ja es poden reanomenar sense que la següent sincronització els torni a posar duplicats.",
   ]}},
  {v:"4.16.2", d:"17 ago 2026",
   t:{es:"El widget de la pantalla de inicio deja de contradecirse",
      en:"The home screen widget stops contradicting itself",
      ca:"El widget de la pantalla d'inici deixa de contradir-se"},
   items:{
   es:[
    "📊 El widget de la pantalla de inicio se contradecía: podía decir que te quedaban 109 € y justo debajo que podías gastar 324 €. Pasaba con la app cerrada, cuando entraba un pago: actualizaba lo gastado pero se dejaba el resto de cifras del rato anterior. Ahora se actualizan todas juntas y siempre cuadran entre ellas.",
    "💳 El saldo de la cuenta de gasto que sale en el widget también se pone al día con cada pago, sin tener que abrir la app.",
   ],
   en:[
    "📊 The home screen widget was contradicting itself: it could say you had 109 € left and right below that you could spend 324 €. It happened with the app closed, when a payment came in: it updated the amount spent but kept the other figures from earlier. Now they all update together and always add up.",
    "💳 The spending account balance shown on the widget also keeps up with each payment, without having to open the app.",
   ],
   ca:[
    "📊 El widget de la pantalla d'inici es contradeia: podia dir que et quedaven 109 € i just a sota que podies gastar-ne 324 €. Passava amb l'app tancada, quan entrava un pagament: actualitzava el que s'havia gastat però es deixava la resta de xifres d'abans. Ara s'actualitzen totes juntes i sempre quadren.",
    "💳 El saldo del compte de despesa que surt al widget també es posa al dia amb cada pagament, sense haver d'obrir l'app.",
   ]}},
  {v:"4.16.1", d:"6 ago 2026",
   t:{es:"Arranque limpio, sin franja bajo la cámara",
      en:"Clean launch, no strip under the camera",
      ca:"Arrencada neta, sense franja sota la càmera"},
   items:{
   es:[
    "Al abrir la app ya no queda una franja rara debajo de la cámara.",
    "Si te ofrece instalar la app nueva, acéptala: es el arreglo de verdad (se instala encima sin perder nada).",
   ],
   en:[
    "Opening the app no longer leaves an odd strip under the camera.",
    "If it offers to install the new app, accept it: that's the real fix (installs on top without losing anything).",
   ],
   ca:[
    "En obrir l'app ja no queda una franja estranya sota la càmera.",
    "Si et ofereix instal·lar l'app nova, accepta-la: és l'arreglo de veritat (s'instal·la a sobre sense perdre res).",
   ]}},
  {v:"4.16.0", d:"6 ago 2026",
   t:{es:"Avisos que cuadran, monedas que no se pierden y más compras que se apuntan solas",
      en:"Alerts that add up, currencies that stick, and more purchases logged on their own",
      ca:"Avisos que quadren, monedes que no es perden i més compres que s'apunten soles"},
   /* tandas aprobadas y subidas 2026-08-06 — se QUITAN del array (panel de revisión), no se marcan */
   items:{
   es:[
    "🔔 El aviso de «llevas el X% del presupuesto» contaba de más: metía dentro los recibos del banco de gastos fijos y las inversiones. Ahora dice el mismo número que ves en Gastos, y el widget también.",
    "💳 Las compras pagadas con el móvil (Google Pay) ya se apuntan solas, con cualquier tarjeta. Antes solo entraban las de Trade Republic, así que las de otras tarjetas había que apuntarlas a mano.",
    "💱 Si apuntas un gasto en otra moneda, ahora queda guardado lo que costó de verdad (por ejemplo «1.520,00 ₺») y se ve en el detalle del gasto. Antes solo se guardaban los euros.",
    "🍺 Los sitios cuyo nombre acaba en «bar» ya se guardan como bares y no como «otros».",
    "🧹 Los nombres de comercio que llegan con caracteres raros del datáfono se limpian antes de guardarse.",
   ],
   en:[
    "🔔 The «you've used X% of your budget» alert was counting too much: it included bills from the fixed-costs bank and investments. Now it says the same figure you see in Spending, and so does the widget.",
    "💳 Purchases paid with the phone (Google Pay) are now logged on their own, with any card. Before, only Trade Republic ones came in, so anything else had to be entered by hand.",
    "💱 Log an expense in another currency and what it really cost is now kept (for example «1,520.00 ₺») and shown in the expense detail. Before, only the euros were saved.",
    "🍺 Places whose name ends in «bar» are now filed under bars instead of «other».",
    "🧹 Shop names that arrive with odd characters from the card terminal get cleaned up before being saved.",
   ],
   ca:[
    "🔔 L'avís de «portes el X% del pressupost» comptava de més: hi ficava els rebuts del banc de despeses fixes i les inversions. Ara diu el mateix número que veus a Despeses, i el widget també.",
    "💳 Les compres pagades amb el mòbil (Google Pay) ja s'apunten soles, amb qualsevol targeta. Abans només entraven les de Trade Republic, així que les altres calia apuntar-les a mà.",
    "💱 Si apuntes una despesa en una altra moneda, ara queda desat el que va costar de veritat (per exemple «1.520,00 ₺») i es veu al detall de la despesa. Abans només es desaven els euros.",
    "🍺 Els llocs que tenen un nom acabat en «bar» ja es desen com a bars i no com a «altres».",
    "🧹 Els noms de comerç que arriben amb caràcters estranys del datàfon es netegen abans de desar-se.",
   ]}},
  {v:"4.15.0", d:"5 ago 2026",
   t:{es:"Ambientación, conversor, presupuesto, extracto y filtros de Gastos",
      en:"Ambience, converter, budget, bank statements and Spending filters",
      ca:"Ambientació, convertidor, pressupost, extracte i filtres de Despeses"},
   tandas:[
     {id:"season-fx-soft", t:"🍂 Ambientación detrás de las cartillas", items:[
       "Ajustes → Apariencia → Temática → Verano (o Navidad/Halloween…): ves piezas muy suaves cayendo, sin molestar — también quieto en una pestaña.",
       "Arriba a la derecha hay un destello de luz suave que se QUEDA fijo (no aparece y desaparece al hacer scroll).",
       "Cambia de pestaña: la lluvia sigue el MISMO camino — no salta atrás ni se reinicia.",
       "Ajustes → Apariencia → Reducir animaciones: la lluvia y el destello desaparecen.",
       "Temática → Ninguna: vuelve el look normal, sin piezas.",
     ]},
     {id:"fx-converter", t:"🔁 Conversor de monedas", items:[
       "Ajustes → Dinero → Conversor de monedas: pon un importe, elige moneda de origen y de destino.",
       "Prueba 150 ₺ → € (o al revés con Intercambiar): el resultado usa el cambio del día.",
       "Ya NO está la lista fija «1 € → …»; el conversor la sustituye.",
     ]},
     {id:"presupuesto-resumen", t:"💶 Presupuesto: misma cifra en todos sitios", items:[
       "En Resumen, la tarjeta de presupuesto muestra lo mismo que la cabecera de Gastos (sin inversión/traspasos).",
       "Si tienes dinero reservado a metas, el presupuesto «que queda» ya lo descuenta.",
       "Los avisos al 50/80/95/100 % usan esa misma cifra (no un total distinto).",
       "El informe imagen y el reto de «mes bajo presupuesto» también cuadran con Resumen/Gastos.",
     ]},
     {id:"otros-bancos-vista", t:"🏦 Extracto de todos los bancos", items:[
       "Conecta un banco que NO sea el de gasto diario y sincroniza: sus movimientos aparecen en Gastos.",
       "Esos movimientos llevan la marca «no afecta»: no restan del presupuesto ni del saldo de gasto diario.",
       "Los bancos marcados como gasto diario (Cartera → rol) SÍ restan, como siempre.",
       "Ingresos de cualquier banco siguen entrando (para «Mi ciclo»).",
     ]},
     {id:"gastos-filtros-ia", t:"🎛️ Filtros y categorías más listos", items:[
       "En Gastos, toca «Filtros»: sheet con buscador de categorías y bancos (ya no hay dos filas interminables de chips).",
       "Nuevas categorías: Viajes, Mascotas, Educación, Luz/gas/agua — al apuntar y al filtrar.",
       "Booking/Vueling → Viajes; Zooplus → Mascotas; Endesa → Energía (ya no caen en «Otros» u Ocio).",
     ]},
     {id:"gastos-filtros-ubicacion", t:"🎛️ El botón de Filtros ya no queda suelto", items:[
       "En Gastos, «Filtros» se ha movido justo al lado del buscador — antes vivía solo, en su propia fila entre el buscador y «Sincronizar».",
       "Si tienes categorías o bancos seleccionados, siguen viéndose debajo, con «Borrar filtros» a mano.",
       "El resumen (gastado, presupuesto…) no ha perdido ni un milímetro de sitio.",
     ]},
     {id:"fix-novedades-nag", t:"🔔 Novedades ya no insiste sin motivo", items:[
       "En el canal beta, el popup de ✨ Novedades salía otra vez en CADA compilación nueva (4.15.0.1, .2, .3…) aunque fueran las mismas notas — hoy con 4-5 compilaciones en un día, de ahí «todo el rato me sale para actualizar».",
       "Ahora se marca como vista por versión base (4.15.0), no por el sello exacto de la compilación: si no hay una versión de verdad nueva, no vuelve a saltar.",
       "Instala esta compilación y cierra/abre la app un par de veces: Novedades no debería reaparecer sola.",
     ]},
     {id:"fix-season-glow", t:"✨ Destello de arriba fijo (y la barra limpia)", items:[
       "Con temática puesta, el destello suave de ARRIBA A LA DERECHA se queda fijo y se ve también parado, no solo al moverte por la app.",
       "Al cambiar de pestaña, las piezas que caen siguen su camino: no se reinician ni saltan atrás.",
       "La barra de abajo ya no enseña la lista a través suyo un momento al cambiar de pestaña (efecto raro de un arreglo anterior).",
     ]},
     {id:"fix-season-portal", t:"✨ Destello y barra (arreglo definitivo)", items:[
       "Con temática activa, baja y sube en Gastos: el destello de arriba a la derecha NO debería aparecer y desaparecer al hacer scroll.",
       "Desliza de pestaña (Inicio ↔ Gastos ↔ Plan): la barra de abajo no debería dejar ver la lista a través suya ni un segundo.",
       "Si algo sigue fallando, anótalo en la revisión beta con la versión que ves en Mis bancos.",
     ]},
     {id:"fix-season-glow-steady", t:"✨ Destello que no cambia nunca", items:[
       "Desliza de pestaña despacio (Inicio ↔ Gastos ↔ Plan): NO tiene que aparecer ningún verde claro arriba mientras se mueve. El fondo se queda exactamente igual de principio a fin.",
       "En ese mismo gesto, el contenido NO puede bajar unos píxeles y volver a subir: los títulos se quedan clavados a la misma altura.",
       "El destello de arriba a la derecha se queda igual durante todo el gesto — ni se enciende, ni se apaga, ni desaparece.",
       "Baja y sube dentro de una pestaña: igual, el destello no se mueve ni cambia de fuerza.",
       "La franja de los iconos de arriba (al lado de la cámara) es del mismo tono que el resto de la app, y no se nota ningún corte entre esa zona y la app.",
       "Nada cruza por delante de los iconos de arriba: las piezas de la temática caen ya por debajo.",
       "En modo Verano el destello es ya de día caluroso: cálido y bien visible arriba a la derecha. Las demás temáticas llevan la misma forma más contenida, para decidirlas una a una.",
       "Scrollea rápido dentro de una lista: el destello no puede dar ni un parpadeo.",
       "La barra de abajo sigue limpia (sin ver la lista a través).",
     ]},
     {id:"fix-season-glow-soft", t:"🌅 Destello suave de fondo", items:[
       "Ajustes → Apariencia → Temática → Verano: arriba se nota un lavado cálido tipo atardecer (melocotón/ámbar), suave y de fondo — no una raya encima del texto.",
       "Scrollea Inicio o Gastos: el destello se queda arriba (no desaparece al bajar la lista); el texto pasa por delante, sin taparse.",
       "Prueba Halloween (ámbar/óxido), Navidad (rojo suave), Invierno (azul plateado) y Pascua (rosa/verde): cada una con su tono, mismo estilo de lavado amplio.",
       "La franja de los iconos junto a la cámara sigue del mismo tono que la app.",
       "Desliza entre pestañas y baja/sube en una lista: sin parpadeo del destello; la barra de abajo sin dejar ver la lista.",
     ]},
     {id:"fix-season-tabs", t:"🚫 Pestañas sin mezclarse", items:[
       "Con temática activa, desliza Inicio ↔ Gastos: solo debe verse UNA pantalla a la vez — sin «Hola Juanjo» encima de «Tus gastos» ni cifras superpuestas.",
       "El lavado cálido de arriba se mantiene; el fondo de cada pestaña sigue siendo opaco.",
       "Scrollea dentro de Inicio o Gastos: sin parpadeo ni salto de píxeles.",
       "La barra de abajo sigue limpia al cambiar de pestaña.",
     ]}
   ],
   items:{
   es:[
    "🍂 Con una temática de temporada, las piezas caen muy suaves — sin molestar. El destello de arriba a la derecha se queda fijo (también al hacer scroll) y la lluvia no salta al cambiar de pestaña.",
    "🔁 En Ajustes → Dinero hay un conversor de verdad: eliges importe, moneda de origen y destino.",
    "💶 El presupuesto del mes es la misma cifra en Resumen, Gastos, avisos e informe: sin mezclar inversiones ni traspasos, y descontando lo reservado a metas.",
    "🏦 En Gastos ves el extracto de todos tus bancos. Solo el de gasto diario resta del presupuesto; el resto sale marcado como «no afecta».",
    "🎛️ En Gastos, los filtros van en un sheet con buscador (adiós a la fila interminable de chips). Hay categorías nuevas (viajes, mascotas, educación, luz/gas) y el reconocimiento de comercios acierta más.",
   ],
   en:[
    "🍂 With a seasonal theme on, pieces drift very softly. The soft glow at the top-right stays put (also when you scroll) and the drift doesn't jump when you switch tabs.",
    "🔁 In Settings → Money there's a real converter: pick an amount, a from-currency and a to-currency.",
    "💶 The monthly budget is the same figure on Home, Spending, alerts and the share image: investments and transfers stay out, and money reserved for goals is deducted.",
    "🏦 On Spending you see every linked bank's statement. Only your daily-spending bank hits the budget; the rest is marked «doesn't count».",
    "🎛️ On Spending, filters live in a searchable sheet (no more endless chip rows). New categories (travel, pets, education, utilities) and smarter merchant detection.",
   ],
   ca:[
    "🍂 Amb una temàtica de temporada, les peces cauen molt suaus. El destell de dalt a la dreta es queda fix (també en fer scroll) i la pluja no salta en canviar de pestanya.",
    "🔁 A Ajustos → Diners hi ha un convertidor de veritat: tries import, moneda d'origen i de destí.",
    "💶 El pressupost del mes és la mateixa xifra al Resum, Despeses, avisos i informe: sense barrejar inversions ni traspassos, i descomptant el reservat a metes.",
    "🏦 A Despeses veus l'extracte de tots els teus bancs. Només el de despesa diària resta del pressupost; la resta surt marcada com a «no afecta».",
    "🎛️ A Despeses, els filtres van en un full amb cercador (adéu a la fila interminable de xips). Hi ha categories noves (viatges, mascotes, educació, llum/gas) i el reconeixement de comerços encerta més.",
   ]}},
  {v:"4.14.1", d:"5 ago 2026",
   t:{es:"El resumen de Gastos ya no se desborda",
      en:"The Spending summary no longer overflows",
      ca:"El resum de Despeses ja no es desborda"},
   tandas:[],
   items:{
   es:[
    "📐 En Gastos, con monedas de importes largos (yen, lira…) y letra pequeña, el resumen ya no se desborda ni deja huecos raros entre la etiqueta y el importe.",
   ],
   en:[
    "📐 On Spending, with long currency amounts (yen, lira…) and small text, the summary no longer overflows or leaves odd gaps between the label and the amount.",
   ],
   ca:[
    "📐 A Despeses, amb monedes d'imports llargs (ien, lira…) i lletra petita, el resum ja no es desborda ni deixa forats rares entre l'etiqueta i l'import.",
   ]}},
  {v:"4.14.0", d:"5 ago 2026",
   t:{es:"Liras y monedas de verdad, y Ajustes → Dinero más claro",
      en:"Real liras and currencies, and a clearer Settings → Money",
      ca:"Lires i monedes de veritat, i Ajustos → Diners més clar"},
   /* TANDAS: multidivisa + gastos-fx-overflow SUBIDAS a prod 2026-08-05 → quitadas del array
      (no se marcan hechas: se BORRAN; si no, el panel las sigue pidiendo). */
   tandas:[],
   items:{
   es:[
    "💱 Nueva moneda: la lira turca. Si cambias la moneda de visualización, toda la app se adapta (útil si alguien usa otra divisa de casa).",
    "✍️ Al apuntar un gasto eliges la moneda ahí mismo (₺, $, €…) y se convierte a euros solo, con el cambio del día — sin tocar cómo se ve el resto de la app.",
    "📊 «Comparar monedas» enseña el cambio real (ya no sale una lista vacía).",
    "🧹 Ajustes → Dinero más limpio: fuera el presupuesto duplicado y los bancos de gasto diario (ya estaban en Resumen y Cartera). Se queda lo de la moneda y cómo se ve el total de gastos.",
   ],
   en:[
    "💱 New currency: the Turkish lira. Change the display currency and the whole app follows (handy if someone's home currency isn't the euro).",
    "✍️ When you log an expense you pick the currency right there (₺, $, €…) and it converts to euros on its own, at today's rate — without changing how the rest of the app looks.",
    "📊 «Compare currencies» shows real rates (no more empty dashes).",
    "🧹 Settings → Money is cleaner: the duplicate budget and daily-spending banks are gone (they already live on Overview and Portfolio). Currency and how the expenses total looks stay.",
   ],
   ca:[
    "💱 Nova moneda: la lira turca. Si canvies la moneda de visualització, tota l'app s'hi adapta (útil si algú usa una altra divisa de casa).",
    "✍️ En apuntar una despesa tries la moneda allà mateix (₺, $, €…) i es converteix a euros sola, amb el canvi del dia — sense tocar com es veu la resta de l'app.",
    "📊 «Comparar monedes» ensenya el canvi real (ja no surt una llista buida).",
    "🧹 Ajustos → Diners més net: fora el pressupost duplicat i els bancs de despesa diària (ja són al Resum i a Cartera). Es queda el de la moneda i com es veu el total de despeses.",
   ]}},
  {v:"4.13.0", d:"5 ago 2026",
   t:{es:"La app se mueve como te gusta, y tus bancos ya no se lían",
      en:"The app moves the way you like, and your banks stop getting mixed up",
      ca:"L'app es mou com t'agrada, i els teus bancs ja no s'embolica"},
   /* TANDAS: todas QUITADAS (aprobadas → se BORRAN del array, no se marcan hechas).
      `import` → 4.12.4; `arranque` → 4.12.3; `tutorial-gestos` QUITADA 4/8 (8/0 en .36);
      `bancos` / `temporada` / `reservar` / `import-docx-pdf` QUITADAS 4/8 (.31);
      `gestos` + `plan-swipe` QUITADAS 5/8 (aprobadas en 4.13.0.49). */
   tandas:[],
   items:{
   /* ⚠ SIN LOS 4 PUNTOS DE ARRANQUE (patrimonio, splash, temporadas, ambientación) NI LOS 3 DE
      IMPORTAR HOJA (Excel/CSV): esas dos partes de la ronda ya se promocionaron SOLAS a producción
      como 4.12.3 (2026-08-01) y 4.12.4 (2026-08-03) y ya se le contó a la familia ahí. Repetirlo
      aquí cuando el resto de la 4.13.0 (gestos/bancos) se apruebe sería la misma novedad dos veces. */
   es:[
    "🏦 Arreglado un lío gordo con Trade Republic: al conectarlo desde el buscador de bancos, algunos gastos se apuntaban al revés (contados como si fueran ingresos). Ya está bien, y además ahora puedes conectarlo por ahí para que tus compras se apunten solas: el saldo lo sigue dando su tarjeta de siempre.",
    "🧾 Al traer el histórico de un banco, una factura que se repite varios meses ya no se duplica: se cuenta una sola vez.",
    "🔌 Reconectar Trade Republic desde el aviso de Cartera ahora te lleva directo a su tarjeta.",
    "💾 Nuevo: Ajustes → Copia de seguridad → «Copias automáticas». Cada día se guarda una copia entera de tus datos, y ahora puedes verla y volver a un día anterior si algo se descuadra.",
    "🛒 Si cambias tu banco de gasto diario, sus compras ya aparecen en Gastos sin pasos de más.",
    "🎯 En Gastos y Cartera, al tirar arriba o abajo del todo la lista hace la misma ola que Ajustes.",
    "✨ La rayita de la barra de abajo ya no atraviesa el botón +: lo salta por encima (y si cambias a mitad, va al sitio sin cruzarlo).",
    "👇 En Plan, arriba del todo, tira hacia abajo para pasar de Recibos a Deudas y a Metas.",
    "🐣 Los iconos de la barra hacen su gracia al entrar en cada pestaña.",
    "📊 El gasto del mes en Resumen (y en el widget) es el mismo número que ves en Gastos.",
   ],
   en:[
    "🏦 Fixed a big mess with Trade Republic: connecting it from the bank search would sometimes log expenses backwards (counted as income). That's sorted, and you can now connect it there so your purchases log themselves: the balance still comes from its usual card.",
    "🧾 When bringing in a bank's history, a bill that repeats across several months no longer gets duplicated: it's counted once.",
    "🔌 Reconnecting Trade Republic from the Portfolio banner now takes you straight to its card.",
    "💾 New: Settings → Backup → «Automatic backups». A full copy of your data is saved every day, and now you can see it and go back to an earlier day if something gets out of sync.",
    "🛒 If you change your daily-spending bank, its purchases now show up in Expenses with no extra steps.",
    "🎯 In Expenses and Portfolio, pulling past the top or bottom now gives the same wave as Settings.",
    "✨ The little bar underneath the tabs no longer crosses through the + button: it hops over it (and if you switch mid-hop, it jumps to place without cutting through).",
    "👇 In Plan, at the very top, pull down to move from Bills to Debts to Goals.",
    "🐣 The tab icons do their thing when you land on each one.",
    "📊 Month spending on Overview (and the widget) matches the number you see in Expenses.",
   ],
   ca:[
    "🏦 Arreglat un embolic gros amb Trade Republic: en connectar-lo des del cercador de bancs, algunes despeses s'apuntaven al revés (comptades com si fossin ingressos). Ja està bé, i a més ara el pots connectar per aquí perquè les teves compres s'apuntin soles: el saldo el continua donant la seva targeta de sempre.",
    "🧾 En portar l'històric d'un banc, una factura que es repeteix diversos mesos ja no es duplica: es compta una sola vegada.",
    "🔌 Reconnectar Trade Republic des de l'avís de Cartera ara et porta directe a la seva targeta.",
    "💾 Nou: Ajustos → Còpia de seguretat → «Còpies automàtiques». Cada dia es desa una còpia sencera de les teves dades, i ara la pots veure i tornar a un dia anterior si alguna cosa es descuadra.",
    "🛒 Si canvies el teu banc de despesa diària, les seves compres ja apareixen a Despeses sense passos de més.",
    "🎯 A Despeses i Cartera, en estirar amunt o avall del tot la llista fa la mateixa ona que Ajustos.",
    "✨ La ratlleta de la barra de sota ja no travessa el botó +: el salta per sobre (i si canvies a mitja, va al lloc sense travessar-lo).",
    "👇 A Pla, amunt del tot, estira cap avall per passar de Rebuts a Deutes i a Metes.",
    "🐣 Les icones de la barra fan la seva gràcia en entrar a cada pestanya.",
    "📊 La despesa del mes al Resum (i al widget) és el mateix número que veus a Despeses.",
   ]}},
  {v:"4.12.3", d:"1 ago 2026",
   t:{es:"Un arranque más limpio, y tu dinero subiendo hasta la cifra otra vez",
      en:"A cleaner start-up, and your money counting up again",
      ca:"Un arrencada més neta, i els teus diners pujant fins a la xifra un altre cop"},
   items:{
   es:[
    "🚀 Al abrir la app, el nombre «Mi Cartera» ya no cambia de forma nada más aparecer: espera a estar listo del todo antes de mostrarse.",
    "💰 Y al abrir la app vuelves a ver tu dinero subiendo hasta la cifra: la animación estaba, pero se gastaba antes de que la vieses.",
    "🍂 Si tienes puesta una tematica de temporada, las piezas caen un momento al principio y paran solas — antes duraban mucho más y volvían a caer cada vez que cambiabas de pestaña.",
    "🎨 Con una temática puesta, ahora también se nota en el resto de la app (bordes y detalles), no solo en el botón central.",
   ],
   en:[
    "🚀 Opening the app, the «Mi Cartera» name no longer changes shape right after appearing: it waits until it is fully ready before showing.",
    "💰 And opening the app you can see your money counting up to the figure again: the animation was there, it just played before you could see it.",
    "🍂 If you have a seasonal theme on, the pieces fall for a moment at the start and then stop on their own — they used to last much longer and fall again every time you switched tabs.",
    "🎨 With a theme on, it now shows in the rest of the app too (borders and small details), not just the centre button.",
   ],
   ca:[
    "🚀 En obrir l'app, el nom «Mi Cartera» ja no canvia de forma just en aparèixer: espera a estar del tot llest abans de mostrar-se.",
    "💰 I en obrir l'app tornes a veure els teus diners pujant fins a la xifra: l'animació hi era, però es gastava abans que la veiessis.",
    "🍂 Si tens posada una temàtica de temporada, les peces cauen un moment al principi i paren soles — abans duraven molt més i tornaven a caure cada cop que canviaves de pestanya.",
    "🎨 Amb una temàtica posada, ara també es nota a la resta de l'app (vores i detalls), no només al botó central.",
   ]}},
  {v:"4.12.1", d:"27 jul 2026",
   t:{es:"Ajustes solo desde Resumen, y sin topes al abrir o bajar la lista",
      en:"Settings only from Home, and no more stops when opening or scrolling",
      ca:"Ajustos només des de Resum, i sense topalls en obrir o baixar la llista"},
   items:{
   es:[
    "⚙️ Ajustes ya no se abre desde el borde de las otras pestañas: solo desde Resumen, deslizando a la derecha.",
    "⚙️ Y al llegar a Resumen ya puedes abrir Ajustes al momento: antes hacía falta un segundo intento si venías de otra pestaña.",
    "👤 Abrir el perfil, cerrarlo y volver a abrirlo seguido ya responde a la primera: se había quedado sordo un instante al tercer gesto.",
    "📜 En Gastos, bajar la lista a toda velocidad ya no se para a medias: carga con más margen por delante.",
   ],
   en:[
    "⚙️ Settings no longer opens from the edge of other tabs: only from Home, by swiping right.",
    "⚙️ And once you are on Home you can open Settings right away: before, coming from another tab needed a second try.",
    "👤 Opening the profile, closing it and opening it again in a row now responds the first time: the third gesture used to go deaf for a moment.",
    "📜 In Expenses, scrolling the list flat out no longer stalls halfway: it loads with more room ahead.",
   ],
   ca:[
    "⚙️ Els ajustos ja no s'obren des de la vora de les altres pestanyes: només des de Resum, fent lliscar a la dreta.",
    "⚙️ I en arribar a Resum ja pots obrir Ajustos al moment: abans calia un segon intent si venies d'una altra pestanya.",
    "👤 Obrir el perfil, tancar-lo i tornar-lo a obrir seguit ja respon a la primera: el tercer gest s'havia quedat sord un instant.",
    "📜 A Despeses, baixar la llista a tota velocitat ja no s'atura a mitges: carrega amb més marge per davant.",
   ]}},
  {v:"4.12.0", d:"26 jul 2026",
   t:{es:"Más rápida al cambiar de pestaña, y los ingresos del banco ya se apuntan",
      en:"Faster when switching tabs, and money coming in now gets recorded",
      ca:"Més ràpida en canviar de pestanya, i els ingressos del banc ja s'apunten"},
   items:{
   es:[
    "💰 Los ingresos que llegan a tu banco ya se apuntan solos. Hasta ahora la app solo recogía las compras con tarjeta: cuando entraba una nómina o una transferencia, el saldo subía pero el movimiento no aparecía por ningún lado.",
    "🏦 Y al sincronizar los bancos ahora te dice qué ha pasado, en un solo aviso: «✓ CaixaBank al día · 1.234,56 € · 3 movimientos nuevos». Antes salía el saldo suelto, de un banco solamente aunque tuvieras varios, y en dos avisos seguidos.",
    "⚡ Entrar en Deudas y Metas ya no deja la app clavada un momento. Cada pestaña se preparaba justo al tocarla; ahora se prepara antes, mientras no estás haciendo nada.",
    "👌 Y deslizar entre pestañas va suave desde la primera vez, también si acabas de moverte dentro de Deudas o Metas.",
    "🎯 Al soltar el dedo al cambiar de pestaña ya no se pierde la fluidez: el arrastre iba bien y el medio segundo de después iba a trompicones. Ese tramo ya va tan limpio como el gesto.",
    "🖐️ Deslizar entre pestañas ya cuenta SIEMPRE. El móvil se quedaba con uno de cada tres gestos —creía que estabas haciendo scroll— y esa deslizada no cambiaba de pestaña: se movía a medias y se volvía. Por fuera parecía que la app se atascaba o que iba lenta, y lo que pasaba es que un tercio de los intentos no llegaba a contar.",
    "🔔 Si un banco pierde el permiso, el aviso te deja delante del aviso en Cartera. Tú decides cuándo reconectar: así no se abren dos autorizaciones a la vez ni se gasta el permiso.",
    "📈 Si Trade Republic se desconecta, también sale un aviso en Cartera para volver a entrar con el PIN y el código.",
    "📱 En Ajustes se ven las dos versiones: la de la app instalada y la que se actualiza sola.",
    "👤 Cerrar el perfil justo después de abrirlo vuelve a responder al momento.",
    "👤 Y abrirlo también: la pantalla del perfil entra a la primera, sin el tirón que daba antes. De paso va más suelta toda la app, porque ha dejado de rehacer por dentro pantallas que no habían cambiado.",
    "🌍 Las notas de cada versión, como esta, ya se leen en los tres idiomas de la app.",
    "🚪 La pantalla de entrada se queda solo con el logo: la barrita de carga sobraba.",
    "📲 Cuando hay una versión nueva de la app para instalar, ya se ofrece de verdad; y si por algo no se puede instalar, la app te dice el motivo en vez de quedarse callada.",
    "🎨 La app estrena su icono de verdad. El del escritorio y el de la pantalla de arranque eran todavía el genérico que trae la herramienta con la que está hecha.",
   ],
   en:[
    "💰 Money coming into your bank is now recorded automatically. Until now the app only picked up card purchases: when a salary or a transfer came in, your balance went up but the transaction appeared nowhere.",
    "🏦 And syncing your banks now tells you what happened, in a single message: «✓ CaixaBank up to date · €1,234.56 · 3 new transactions». It used to show a bare balance, for one bank only even if you had several, in two messages one after the other.",
    "⚡ Opening Debts and Goals no longer freezes the app for a moment. Each tab used to be prepared the instant you touched it; now it is prepared beforehand, while you are doing nothing.",
    "👌 And swiping between tabs is smooth from the very first time, even right after you have been scrolling inside Debts or Goals.",
    "🎯 Letting go after a tab swipe no longer kills the smoothness: the drag itself was fine, and the half-second after it juddered. That bit is now as clean as the gesture.",
    "🖐️ Swiping between tabs now always counts. The phone was taking over one in every three gestures —it thought you were scrolling— and that swipe never changed tab: it moved halfway and came back. From the outside it looked like the app was stuttering or slow, when in fact a third of your attempts simply did not count.",
    "🔔 If a bank loses its permission, the alert takes you to the warning in Portfolio. You choose when to reconnect, so two authorizations are not opened at once and the permission is not wasted.",
    "📈 If Trade Republic disconnects, a warning also appears in Portfolio so you can sign back in with your PIN and code.",
    "📱 Settings now shows both versions: the installed app and the one that updates itself.",
    "👤 Closing the profile right after opening it responds instantly again.",
    "👤 And opening it too: the profile screen comes in first time, without the stutter it had before. The whole app feels lighter as a result, because it has stopped rebuilding screens that had not changed.",
    "🌍 Release notes like these can now be read in all three languages of the app.",
    "🚪 The start screen keeps just the logo: the little loading bar was unnecessary.",
    "📲 When a new version of the app is ready to install, it is now actually offered; and if for some reason it cannot be installed, the app tells you why instead of staying silent.",
    "🎨 The app has a proper icon at last. The one on your home screen and on the start screen were still the generic one from the tool it is built with.",
   ],
   ca:[
    "💰 Els ingressos que arriben al teu banc ja s'apunten sols. Fins ara l'app només recollia les compres amb targeta: quan entrava una nòmina o una transferència, el saldo pujava però el moviment no apareixia enlloc.",
    "🏦 I en sincronitzar els bancs ara et diu què ha passat, en un sol avís: «✓ CaixaBank al dia · 1.234,56 € · 3 moviments nous». Abans sortia el saldo sol, d'un banc només encara que en tinguessis diversos, i en dos avisos seguits.",
    "⚡ Entrar a Deutes i Metes ja no deixa l'app clavada un moment. Cada pestanya es preparava just en tocar-la; ara es prepara abans, mentre no estàs fent res.",
    "👌 I lliscar entre pestanyes va suau des de la primera vegada, també si acabes de moure't dins de Deutes o Metes.",
    "🎯 En deixar anar el dit en canviar de pestanya ja no es perd la fluïdesa: l'arrossegament anava bé i el mig segon de després anava a trepets. Aquell tram ja va tan net com el gest.",
    "🖐️ Lliscar entre pestanyes ja compta SEMPRE. El mòbil es quedava amb un de cada tres gestos —es pensava que estaves fent scroll— i aquella lliscada no canviava de pestanya: es movia a mitges i tornava. Des de fora semblava que l'app s'encallava o anava lenta, i el que passava és que un terç dels intents no arribava a comptar.",
    "🔔 Si un banc perd el permís, l'avís et deixa davant de l'avís a Cartera. Tu decides quan reconnectar: així no s'obren dues autoritzacions a la vegada ni es gasta el permís.",
    "📈 Si Trade Republic es desconnecta, també surt un avís a Cartera per tornar a entrar amb el PIN i el codi.",
    "📱 A Ajustos es veuen les dues versions: la de l'app instal·lada i la que s'actualitza sola.",
    "👤 Tancar el perfil just després d'obrir-lo torna a respondre a l'instant.",
    "👤 I obrir-lo també: la pantalla del perfil entra a la primera, sense l'estirada que feia abans. De passada va més àgil tota l'app, perquè ha deixat de refer per dins pantalles que no havien canviat.",
    "🌍 Les notes de cada versió, com aquesta, ja es llegeixen en els tres idiomes de l'app.",
    "🚪 La pantalla d'entrada es queda només amb el logotip: la barreta de càrrega hi sobrava.",
    "📲 Quan hi ha una versió nova de l'app per instal·lar, ja s'ofereix de debò; i si per alguna cosa no es pot instal·lar, l'app et diu el motiu en comptes de quedar-se callada.",
    "🎨 L'app estrena icona de debò. La de l'escriptori i la de la pantalla d'arrencada encara eren la genèrica de l'eina amb què està feta.",
   ]}},
  {v:"4.11.0", d:"25 jul 2026",
   t:{es:"La app se presenta al abrirse, y los bienes van por su cuenta",
      en:"The app introduces itself when it opens, and assets stand on their own",
      ca:"L'app es presenta en obrir-se, i els béns van pel seu compte"},
   items:{
   es:[
    "🚪 Al abrir la app ya se ve su logo mientras carga, en vez de una pantalla en negro.",
    "🏡 Tus bienes (piso, coche…) tienen ahora su propio bloque en Cartera, separado de las cuentas del banco. Puedes subirlo o bajarlo con «⇅ Ordenar secciones».",
    "👤 Cerrar el perfil vuelve a ir a la primera, también si habías bajado dentro. Abrirlo y cerrarlo se sienten igual de suaves.",
    "🔔 Se acabaron los avisos repetidos de que hay una versión nueva.",
    "✨ El popup de Novedades marca bien cuál es la versión que llevas puesta.",
    "💡 Por si acaso: el patrimonio de Inicio sube contando hasta tu cifra. Es una animación — el número final siempre ha sido el correcto.",
   ],
   en:[
    "🚪 Opening the app now shows its logo while it loads, instead of a black screen.",
    "🏡 Your assets (flat, car…) now have their own block in Portfolio, separate from your bank accounts. Move it up or down with «⇅ Reorder sections».",
    "👤 Closing your profile works first time again, even if you had scrolled down inside it. Opening and closing now feel the same.",
    "🔔 No more repeated notifications about a new version being available.",
    "✨ The What's new popup now correctly marks which version you are running.",
    "💡 Just in case: the net worth on Home counts up to your figure. It's an animation — the final number was always the right one.",
   ],
   ca:[
    "🚪 En obrir l'app ja es veu el seu logotip mentre carrega, en lloc d'una pantalla en negre.",
    "🏡 Els teus béns (pis, cotxe…) tenen ara el seu propi bloc a Cartera, separat dels comptes del banc. El pots pujar o baixar amb «⇅ Ordenar seccions».",
    "👤 Tancar el perfil torna a anar a la primera, també si havies baixat a dins. Obrir-lo i tancar-lo se senten igual de suaus.",
    "🔔 S'han acabat els avisos repetits que hi ha una versió nova.",
    "✨ El missatge de Novetats marca bé quina versió portes posada.",
    "💡 Per si de cas: el patrimoni d'Inici puja comptant fins a la teva xifra. És una animació — el número final sempre ha estat el correcte.",
   ]}},
  {v:"4.10.2", d:"25 jul 2026", t:"El canal de pruebas, esta vez de verdad", items:[
    "🚧 Lo de ayer era solo la mitad. Después del arreglo anterior, la app seguía diciéndote «✓ estás a la última» con la versión de prueba ahí publicada. El motivo de fondo: GitHub no deja que la app lea esos ficheros directamente desde la web, así que ahora los pide Android, que sí puede. Comprobado: la versión de prueba nunca se había llegado a descargar ni una sola vez.",
    "🔔 Y si el canal de pruebas falla, te lo dice. Antes, cualquier problema al mirar si había versión nueva se disfrazaba de «no hay nada nuevo» — que es justo lo que hizo que esto pasara desapercibido tanto tiempo. Ahora sale el error y queda anotado.",
    "🙈 Sigue afectando solo al canal de pruebas: si nunca lo has activado, no te ha faltado ninguna actualización.",
  ]},
  {v:"4.10.1", d:"25 jul 2026", t:"El canal de pruebas vuelve a funcionar", items:[
    "🚧 Si activabas el canal de pruebas, la app te decía «✓ estás a la última» aunque hubiera una versión de prueba esperándote. GitHub cambió el sitio de donde se bajan esos ficheros y la app tenía apuntado el antiguo, así que la descarga moría — y como hay una red de seguridad que en ese caso mira el canal normal, no se veía ningún error: simplemente te contestaba que no había nada nuevo. Corregido.",
    "🙈 Solo afecta al canal de pruebas: si nunca lo has activado, no te ha faltado ninguna actualización.",
  ]},
  {v:"4.10.0", d:"25 jul 2026", t:"El perfil ya se cierra a la primera, el oro de Revolut entra, y una pantalla de entrada de verdad", items:[
    "👤 El gesto del perfil, arreglado de verdad. Si habías bajado un poco dentro del perfil y luego tirabas para cerrarlo, la pantalla se ponía a parpadear entre el perfil y el resumen y no cerraba nunca. Ahora el dedo primero sube el contenido y, al llegar arriba, el panel empieza a encogerse desde donde está — sin saltos. Y ABRIRLO también: se quedó sin los dos arreglos que sí recibió el cierre, por eso seguía yendo a tirones y mezclando las dos pantallas.",
    "🥇 El CSV de Revolut ya no te dice «no he podido leer el CSV». Subiste el extracto de tu cuenta en euros —justo el que hace falta para saber cuánto ganas con el oro— y la app lo rechazaba, aunque lo había leído perfectamente. Ahora te lo confirma, se guarda los euros de tus conversiones y te dice qué fichero falta. Puedes soltarlos de uno en uno y en el orden que quieras: los va juntando.",
    "🚪 Pantalla de entrada nueva. Antes veías un emoji con «Cargando…» y, al entrar, el patrimonio viejo un segundo antes que el bueno. Ahora la app se presenta con su marca y espera a tener el dato bueno para dar paso — como mucho un instante, nunca se queda colgada.",
    "🏠 «Hogar y gastos compartidos» se muda al perfil (el avatar de Inicio, arriba del todo). Estaba enterrado al final de Cartera, que es donde no mira nadie.",
    "⇅ Cartera se ordena a tu gusto. «Tus cuentas» e «Inversiones» se suben y se bajan con el mismo «⇅ Ordenar secciones» que ya tenían Recibos, Deudas y Metas. Tu orden se guarda y viaja con tu cuenta.",
    "🔒 Y por detrás: el servidor solo acepta llamadas desde la app (antes desde cualquier web), freno a los intentos repetidos —para que tu banco no te bloquee la cuenta si algo se pone pesado— y los permisos de conectar un banco caducan a la media hora y solo valen una vez.",
  ]},
  {v:"4.9.2", d:"25 jul 2026", t:"Arreglado el APK roto: caracteres raros y la app que no se actualizaba", items:[
    "🔤 Los símbolos raros que salían en la tarjeta de Trade Republic (donde debía ir un ✓) eran texto que se estropeó al preparar la versión anterior. Corregido, y ahora hay una comprobación que no deja publicar con texto roto.",
    "⬇️ La app decía «vdev» y no se actualizaba nunca. El APK anterior se empaquetó sin ponerle el número de versión, y la app compara números para saber si hay algo nuevo: sin número, la respuesta era siempre «no hay nada». Por eso no te llegó ninguna de las mejoras del día. Arreglado, y el proceso de empaquetado ahora se para en seco si la versión no queda puesta.",
    "🙌 Con esto sí te llegan de verdad: los brókers que eliges tú, las tarjetas plegables, el oro de Revolut con su coste y el perfil que cierra limpio.",
  ]},
  {v:"4.9.1", d:"25 jul 2026", t:"Los brókers los eliges tú, y el perfil se cierra limpio", items:[
    "🧩 Ya no te salen los tres brókers a la fuerza. Antes la app te enseñaba el login de Trade Republic, MyInvestor y Revolut aunque no tuvieras cuenta en ninguno — raro y confuso. Ahora arriba eliges cuáles usas y solo aparecen esos. Si ya tenías posiciones de un bróker, sigue apareciendo solo: no tienes que tocar nada.",
    "🗂️ Las tarjetas de bróker también se pliegan, igual que los bancos: tocas la que quieras y se abre solo esa.",
    "👤 Cerrar el perfil deslizando ya no mezcla las dos pantallas. Al arrastrar hacia abajo se veían el perfil y el resumen a la vez, uno encima del otro, y parecía que la app se volvía loca. Ahora el panel se encoge hacia tu avatar, opaco y limpio, igual que al abrirlo pero al revés.",
  ]},
  {v:"4.9.0", d:"25 jul 2026", t:"Trade Republic deja de pedirte el código cada vez, y el oro por fin dice si ganas", items:[
    "🔐 Trade Republic ya NO se desconecta al cerrar la app. Llevaba meses pidiéndote el PIN y el código del móvil cada vez que la abrías. La causa: al guardar la sesión, de las dos copias que hay de la misma credencial nos quedábamos con la caducada, y encima la volvíamos a guardar en cada vuelta — una vez estropeada, ya no se recuperaba nunca. Por eso pasaba «siempre, dieras el tiempo que dieras». Probado cerrando la app y volviendo a entrar: entra sin pedir nada.",
    "🥇 El oro de Revolut ya te dice cuánto ganas o pierdes, sin teclear nada. Revolut parte cada compra en dos ficheros: las onzas en el extracto de Materias primas y los euros en el de la cuenta. Ahora la app cruza los dos sola y calcula el coste (incluso si vendiste una parte). Suelta los dos extractos juntos, en el orden que quieras.",
    "👤 Cerrar el perfil deslizando ya va suave. Al arrastrar hacia abajo, la app repintaba la pantalla entera hasta 120 veces por segundo y se atascaba. Abrir siempre fue fino; ahora cerrar también.",
    "🏦 «Mis bancos» deja de ser un muro de botones. Cada banco enseñaba sus tres botones a la vez (con tres bancos, nueve). Ahora tocas el banco y salen los suyos. El estado sigue siempre a la vista, y si vienes del aviso de «reconecta este banco», ese llega ya abierto.",
    "🔔 El aviso de «hay versión nueva» en el navegador no salía nunca (fallaba por dentro, en silencio). Arreglado.",
    "🛡️ Por dentro: la clave que usa el lector de notificaciones ya no viaja en la dirección web sino en una cabecera, que es donde no queda registrada. Y los fallos del servidor vuelven a quedar apuntados — llevaban dos semanas perdiéndose sin que nadie lo supiera.",
  ]},
  {v:"4.8.0", d:"24 jul 2026", t:"Ya no se ralentiza, y el histórico se explica solo", items:[
    "⚡ Se acabó lo de «cuanto más rato la uso, más lenta va». La app guardaba TODO el histórico de gastos en el móvil cada vez que volvías a ella (abrir la app, cambiar de app y volver…), y eso costaba más cada mes según se llenaba: con 2.000 gastos eran 477 KB por vuelta, con 8.000 casi 2 MB. Ahora el histórico solo se reescribe cuando cambia de verdad — 1 KB — y ese número ya NO crece con los años.",
    "📝 El histórico por fin dice DE QUÉ era cada movimiento (lo pedía mi padre): debajo del título sale el concepto del bizum o la descripción del banco, y se rellena también en los movimientos antiguos al sincronizar. Puedes escribirlo o corregirlo tú desde la ficha del gasto, y lo que escribas no te lo pisa el banco. El buscador también busca por concepto.",
    "🏦 Si al sincronizar hay un banco que se ha desconectado, ahora te enteras: salta una notificación de verdad y la app te lleva SOLA al sitio donde se reconecta, con ese banco resaltado. Antes salía un aviso de dos segundos que decía «reconéctate» sin decir dónde. Si no tienes ningún banco puesto, también te abre la pantalla para ponerlo.",
    "🧪 Modo pruebas y canal beta (para el que la desarrolla): probar cosas en el móvil con una copia de los datos, sin tocar la cartera real ni la de nadie más, y recibir las versiones antes que el resto de la familia. Y una pantalla para revisar la beta desde el propio móvil: sale la lista de lo que trae la versión, marcas qué va bien y qué falla, y hasta que no esté todo probado no se puede aprobar.",
    "🛡 Seguridad: la app ya no deja que se cargue código de sitios que no sean los suyos ni que se manden tus datos fuera (CSP). La clave de la captura automática de gastos ahora es de 256 bits de verdad — antes, en algunos navegadores, salía de un generador predecible.",
    "🐞 Arreglado: si dos móviles tocaban la cartera a la vez, el aviso de conflicto reventaba por dentro y no se resolvía nunca (fallaba en silencio). Y varios textos salían en clave («tb_removed», «fj_fixed») en vez de en castellano.",
  ]},
  {v:"4.7.1", d:"23 jul 2026", t:"Herramientas de inversión, más limpias", items:[
    "📈 Fuera el bloque «Orden de los brókers» de Herramientas de inversión: ensuciaba la pantalla sin aportar. Tus brókers salen en Cartera → Inversiones en el orden de siempre: Revolut, Trade Republic y MyInvestor."
  ]},
  {v:"4.7.0", d:"22 jul 2026", t:"Notis sin duplicados, roles de banco claros y deudas que hablan igual", items:[
    "🔔 Se acabaron las notis dobles: cuando un gasto es «tocho» ya solo sale esa noti (antes salía TAMBIÉN la de «✓ Gasto apuntado» con el mismo importe). Esta parte va en el APK 31 — la app te lo ofrecerá cuando esté publicado.",
    "🧾 El aviso de recibo de la víspera tampoco sale ya dos veces (una exacta del móvil y otra redondeada al abrir la app): ahora la app comprueba primero qué avisó ya el móvil. Y los avisos de recibos van SIEMPRE con el importe exacto: 89,54 €, no «90 €».",
    "🏦 En Cartera cada banco dice debajo lo que es, como Trade Republic: «Gasto diario», «Recibos», o las dos si hace ambas cosas — y fuera el carrito suelto al lado del nombre. Al editar, cada banco es UNA cosa: o Recibos, o Gasto diario, o Todo (ya no se queda «Recibos» clavado en verde).",
    "📈 Desplegar un bróker en Cartera va con la misma animación suave del resto de la app.",
    "💳 Deudas: todas hablan igual. La hipoteca y el préstamo dicen «acabas en febrero 2049» como las demás (fuera el «a este ritmo acabas ~») y también muestran «Quedan X/Y cuotas · Z €/mes», estimado con lo que amortizas cada mes.",
    "🛡 El logo de reCAPTCHA que se quedaba flotando abajo en TODA la app ya no sale. Y si el captcha de MyInvestor falla, el mensaje ahora dice QUÉ falló exactamente: si Google no quiso dar el token dentro de la app, o si MyInvestor lo rechazó — así sabemos si el atajo del site key tiene recorrido o toca pantalla nativa.",
  ]},
  {v:"4.6.4", d:"20 jul 2026", t:"MyInvestor: intento de resolver el captcha en la propia app", items:[
    "🔓 Nuevo intento para el captcha de MyInvestor SIN cambiar el APK: cuando salta el captcha, aparece un campo «avanzado» para pegar el «site key» de reCAPTCHA de MyInvestor. Con él, la app intenta resolver el captcha ella sola dentro de la app y reintenta el login. Cómo sacar el site key: en el PC, en la web de MyInvestor, F12 → Red → filtra «recaptcha» → copia el «render=6L…».",
    "ℹ️ Aviso honesto: puede que MyInvestor rechace el token por venir de un sitio distinto al suyo. Si es así, el único camino que queda es una pantalla nativa (otro APK) — pero esto se prueba en 1 minuto y si funciona, resuelto sin tocar nada más.",
  ]},
  {v:"4.6.3", d:"20 jul 2026", t:"El «Gasto diario» de siempre ahora admite varios bancos", items:[
    "🛒 Quitado el chip «En gasto diario» duplicado que añadí por error. Ahora el chip «Gasto diario» de toda la vida es el que deja marcar VARIOS bancos: el primero es tu cuenta principal (de la que sale el efectivo y el redondeo) y los demás solo suman sus compras al mismo presupuesto. Sin líos ni chips de más.",
  ]},
  {v:"4.6.2", d:"20 jul 2026", t:"Arreglos: tabs con letra pequeña + «gasto diario» en cada banco", items:[
    "📱 Con la letra en «Pequeña» la barra de abajo se quedaba flotando más arriba de la cuenta: ya vuelve a estar pegada abajo (y de paso queda perfecta también en Grande/Enorme).",
    "🛒 «Gasto diario» con varios bancos ahora está DONDE tiene que estar: en Cartera → editar cuentas, un botón «En gasto diario» en cada banco (con su iniciales), y puedes marcar los que quieras. Los marcados salen con un 🛒 en la lista. Ya no está escondido en una sección aparte.",
    "🔄 El widget vuelve a empujar sus datos cada vez que abres la app, no solo cuando cambian — para que MIUI/HyperOS no se quede con la cifra vieja. (Si aún así no se actualiza: quítalo del escritorio y vuelve a añadirlo.)",
  ]},
  {v:"4.6.1", d:"18 jul 2026", t:"Ajustes del lote: letra pequeña, Hogar fuera de Ajustes, animaciones con más chispa", items:[
    "🔡 En Accesibilidad ahora hay también «Pequeña» (además de Normal/Grande/Enorme).",
    "🏠 «Hogar y gastos compartidos» sale de Ajustes y vive en Cartera, abajo del todo — es una funcionalidad de la app, no un ajuste.",
    "🪙 Los «bancos de gasto diario» (marcar varios para el mismo presupuesto) se ven y se editan también en Cartera → editar cuentas, no solo en Ajustes → Dinero.",
    "✨ Las temáticas de temporada tienen ahora más vidilla estilo Revolut: 3 capas de profundidad (parallax), caída orgánica con giro y balanceo, un halo de color que respira arriba y el botón + con pulso. (Se apaga con «Reducir animaciones».)",
    "🔌 MyInvestor y el widget: el código nuevo ya está, pero el captcha necesita una pieza nativa que aún no puedo montar por actualización web, y el widget necesita que el APK que lo lleva esté bien instalado. Sigo con ello.",
  ]},
  {v:"4.6.0", d:"18 jul 2026", t:"Temáticas, accesibilidad, metas con teclado propio y más monedas", items:[
    "🎯 Al aportar a una meta ya no salta el teclado del móvil (que rompía la estética): ahora abre una hoja con teclado numérico propio, como el botón +, y eliges de qué banco lo aportas.",
    "🎉 Temáticas de temporada en Ajustes → Apariencia: Mundial (España), Halloween, Navidad, Verano, Invierno y Pascua. Cada una re-tinta el botón + y deja caer un detalle animado (nieve, hojas, balón…). Se apaga con «Reducir animaciones» o eligiendo «Ninguna».",
    "♿ Nueva sección Accesibilidad: tamaño de letra en 3 niveles (Normal/Grande/Enorme) que ahora escala TODA la app —incluidos los diálogos y hojas, que antes se quedaban pequeños y descuadrados—, «Reducir animaciones» y «Más contraste».",
    "💱 Muchas más monedas (yen, dólar canadiense/australiano, yuan, coronas, złoty, real, rupia…) y una comparativa rápida «1 € = …» con los tipos del BCE.",
    "🪙 Ahora puedes marcar VARIOS bancos como gasto diario (Ajustes → Dinero): si en un viaje usas Trade Republic y Revolut, las compras de ambos cuentan en el mismo presupuesto.",
    "📱 El widget de inicio ya no enseña solo lo gastado: añade «Puedes gastar X €» — lo que te puedes permitir sin pasarte ni quedarte en rojo. (Necesita el APK nuevo para que llegue al escritorio.)",
    "💼 En Cartera se guarda tu selección de patrimonio (líquido/inversiones/bienes) aunque cierres la app, y la zona de inversiones entra con una animación suave.",
    "🎛️ Ajustes abre siempre con todas las secciones encogidas y con un orden más lógico: Apariencia → Accesibilidad → Para empezar → Dinero → Conexiones → App → Avanzado.",
    "🧾 «Gestionar recibos» y «Herramientas de inversión» ahora combinan con la estética nueva (tarjetas, inputs y enlaces al mismo estilo que el resto).",
    "🌬️ Los ocultamientos (barra inferior, plegar tarjetas) son más suaves, sin cortes secos, tanto al esconder como al aparecer.",
    "🔌 MyInvestor: seguimos preparando el terreno para el captcha (el envío del token ya viaja en la petición). Resolverlo del todo necesita una pantalla nativa nueva; mientras tanto, el aviso sigue explicándolo en cristiano.",
  ]},
  {v:"4.5.1", d:"18 jul 2026", t:"Primera vez que abres Ajustes/perfil: ya se ve el contenido", items:[
    "✨ La primera vez que tiras despacio hacia Ajustes o el perfil ya no sale el panel negro vacío: el contenido se prepara en segundo plano y está listo al arrastrar.",
    "👆 Al bajar el perfil, Resumen se queda quieto (sin scroll a la vez) — eso quitaba fluidez cuando pelean los dos gestos.",
  ]},
  {v:"4.5.0", d:"18 jul 2026", t:"Histórico del banco: a Gastos, Recibos o Ingresos", items:[
    "🏦 Al importar histórico ya salen también los ingresos (nómina, bizums…). En cada movimiento eliges si va a Gastos, a Recibos (fijo mensual con su día) o a Ingresos — así no tienes que teclear la luz a mano si ya está en el banco.",
    "🛒 Al sincronizar un banco marcado en «También apuntar gastos de tarjeta», las compras con tarjeta del mes siguen entrando solas en Gastos (se ven en Todos y filtrando por ese banco) y cuentan para el presupuesto. El rol «gasto diario» sigue siendo uno (TR); el resto son bancos extra de tarjeta.",
  ]},
  {v:"4.4.3", d:"18 jul 2026", t:"Gesto fluido Y con Resumen visible detrás", items:[
    "✨ Al abrir Ajustes o el perfil ya se ve otra vez Inicio detrás (adiós al fondo negro cutre de la 4.4.2), sin volver a los tirones: el truco es no re-pintar el shell en cada milímetro, no ocultarlo.",
  ]},
  {v:"4.4.2", d:"18 jul 2026", t:"Gestos fluidos de verdad + sin cargos vacíos", items:[
    "✨ Al abrir Ajustes o el perfil tirando despacio, Resumen se «congela» un momento: ya no se re-pinta el gráfico en cada milímetro (el tirón de antes).",
    "🏠 Si no hay próximos cargos este mes, esa sección desaparece del todo en Inicio (antes quedaba el hueco vacío).",
  ]},
  {v:"4.4.1", d:"18 jul 2026", t:"Ajustes y perfil sin tirones al arrastrar lento", items:[
    "✨ Si abres Ajustes o el perfil tirando despacio con el dedo, ya no se pone a «cámara lenta» (antes el móvil re-pintaba toda la pantalla en cada milímetro).",
    "🧾 El velo del perfil sigue ahí; el desenfoque fino entra al soltar, que es cuando se nota y no cuesta frames.",
  ]},
  {v:"4.4.0", d:"18 jul 2026", t:"Reconectar un banco en UN toque y avisos con la app cerrada (APK 29)", items:[
    "🔓 Si un banco pierde el permiso, ahora te enteras DONDE miras el saldo: banner en Cartera con botón «Reconectar CaixaBank» que te lleva directo a autorizar — sin bucear por Ajustes. Y si Trade Republic se desconecta, su banner abre la pantalla de reconexión con el teléfono ya puesto (y te aclara que es AQUÍ, no en la app de TR 😉).",
    "🛎 Recibos con la app CERRADA: la app deja programado en Android el calendario del mes y el móvil avisa solo la víspera de cada recibo y cuota. Necesita el APK 4.4.0 (te lo ofrece sola al abrir; instálalo una vez).",
    "📊 Los avisos de presupuesto de los gastos que entran con la app cerrada (notis de TR) ahora también saltan al 50% y al 95% (antes solo al 80% y al pasarte). Esto va por servidor: funciona ya, sin APK nuevo.",
  ]},
  {v:"4.3.0", d:"18 jul 2026", t:"Avisos que valen dinero, deudas con fecha de fin y alegrías en Inicio", items:[
    "🔔 La app ahora te avisa sola: al cruzar el 50%, 80%, 95% y 100% del presupuesto del mes (una vez por umbral), y la VÍSPERA de cada recibo y cuota («mañana se cobran X €») — porque el banco no avisa. Los recibos gordos siguen avisando además con 2-3 días.",
    "📅 La hipoteca y los préstamos sin plazo ya no están «muertos»: ahora ponen «a este ritmo acabas ~febrero 2049» calculado con tu cuota. Amortiza y verás la fecha acercarse.",
    "🎉 Cuando a una financiación le queda LA ÚLTIMA cuota, te lo celebra en Inicio: «¡última cuota este mes! Después, X €/mes libres para ti».",
    "👇 El sheet «Más…» de períodos en Gastos (mes pasado, 3 meses, rango…) ya se cierra tirando hacia abajo y con el gesto atrás — era el único que no.",
    "📊 El informe ahora te dice DÓNDE queda: toast + notificación con el nombre del fichero (carpeta Descargas).",
    "⚙️ Las secciones de Ajustes se despliegan con animación suave (se acabó el corte seco).",
    "🔌 MyInvestor: el «Captcha required» ahora se explica en cristiano (es su anti-bot; esperar y reintentar desde casa) y la app se presenta con versión más nueva ante su API — la palanca documentada contra el captcha. Si con esto sigue, el siguiente paso es resolver el captcha de verdad (necesita trabajo nativo).",
  ]},
  {v:"4.2.0", d:"18 jul 2026", t:"Compras a plazos simuladas, banco en cada apunte y la ronda de arreglos que pediste", items:[
    "📅 «¿Me lo puedo permitir?» ahora también A PLAZOS: pones meses y entrada y te dice la cuota, cómo suben tus fijos, si te cabe cada mes con tu nómina… y con un botón creas la deuda directamente (aparece en Plan → Deudas y descuenta del líquido sola).",
    "🏦 Al apuntar un gasto a mano (el + o editando uno) puedes elegir de qué banco sale. Se recuerda hasta reinstalando la app.",
    "↻ El «Sincronizar» de Cartera ahora también actualiza Trade Republic y MyInvestor (si están conectados), no solo los bancos de Open Banking.",
    "🏠 Arreglado el error al crear un hogar («row-level security policy»): a la base de datos le faltaba un permiso. Hay que pegar la migración 0015 en Supabase (docs/HOGAR.md) — la app ahora además te lo dice en cristiano.",
    "⚙️ Entrar en Ajustes ya no hace ese efecto raro e incómodo: ahora es un deslizamiento limpio, sin desenfoques.",
    "🔀 «Ver más» y «Ver plan» desde Inicio te dejan al PRINCIPIO de Gastos/Metas (antes aterrizabas a mitad de pantalla).",
    "📅 El cartelito de «Mi ciclo» ya no choca con los filtros de abajo.",
    "🖊 Editar los Bienes en Cartera ya no parte los nombres palabra a palabra (la casilla del importe iba sin estilo).",
    "🧹 Textos de bancos en Ajustes a dieta: menos párrafos, mismo contenido.",
    "⚡ Menos micro-tirones usando la app: el guardado local ahora va en segundo plano (y se vuelca siempre al salir).",
  ]},
  {v:"4.1.0", d:"18 jul 2026", t:"Cartera a tu gusto, bancos que no caducan solos y Ajustes puestos al día", items:[
    "🏦 Los bancos ya NO se sincronizan solos al abrir la app (eso les olía a robot y te caducaban la conexión cada dos por tres). Ahora sincronizas tú con el botón «↻ Sincronizar bancos» en Cartera, cuando quieras.",
    "📊 El gráfico de Cartera es tuyo: toca Liquidez, Inversiones o Bienes en la leyenda para marcarlos/desmarcarlos y ver, por ejemplo, líquido + inversiones a secas. Todo marcado = tu patrimonio de siempre.",
    "✏️ Vuelve el editar de verdad en Cartera: nombre y rol (Recibos / Gasto diario / Todo) de cada cuenta — el rol se había quedado sin sitio con el rediseño —, los bienes otra vez editables, y en inversiones un «Editar a mano» pequeñito al pie.",
    "🔒 En las cuentas conectadas al banco solo editas el nombre: el saldo lo trae el banco solo (editarlo a mano era engañarse).",
    "🏠 Hogar y gastos compartidos han vuelto: estaban implementados pero el rediseño los dejó sin puerta. Ahora en Ajustes → Conexiones → «Hogar y gastos compartidos».",
    "🎯 Al scrollear las metas en Inicio ya no se te escapa la pestaña, y los dos «Ver plan ›» te llevan al sitio correcto (cargos → Recibos, metas → Metas).",
    "⬇️ La barra de abajo, al esconderse, deja ver el contenido (antes quedaba un bloque vacío) y anima con la misma curva que el resto.",
    "⚙️ Ajustes: botones a tamaño humano, animación suave por secciones, huella y cerrar sesión otra vez a mano, sugerencias con su propio botón, más monedas (£ y CHF), y fuera lo deprecado.",
    "📸 El informe del mes ya no «no hace nada»: si el menú de compartir falla, la imagen se descarga igualmente.",
  ]},
  {v:"4.0.15", d:"17 jul 2026", t:"Bancos que aguantan, oro con su %, barra que se esconde y Ajustes más guapos", items:[
    "🏦 Open Banking ya no se cae «cada dos por tres»: un fallo pasajero del banco (rate-limit, un 403/404 suelto) ya NO te desconecta ni te pide reconectar. Solo se marca «reconéctate» cuando el permiso caducó de verdad.",
    "🥇 Materias primas de Revolut: al importar el CSV puedes escribir lo que te costó en € y por fin ves si el oro/plata sube o baja (el precio ya se actualizaba solo; faltaba el coste, que Revolut no manda en ese extracto).",
    "⬇️ La barra de abajo se esconde al bajar y vuelve al subir o al cambiar de pestaña (como Revolut), con la misma animación suave de siempre.",
    "🔒 Privacidad: ahora se abre DENTRO de la app, con su botón de volver — se acabó la ventana que quedaba pegada arriba y de la que costaba salir.",
    "⚙️ Ajustes: repaso de arriba abajo, quitando restos antiguos y dejándolo más limpio.",
  ]},
  {v:"4.0.14", d:"17 jul 2026", t:"Editar gasto: categorías sin cambiar de pestaña", items:[
    "🧾 Al modificar un gasto, al deslizar las categorías ya no se mueve la app de detrás (igual que en el + y en los filtros de Gastos).",
  ]},
  {v:"4.0.13", d:"17 jul 2026", t:"Perfil se cierra tirando abajo + fondo al apuntar", items:[
    "👤 En el perfil, desliza de arriba hacia abajo y se encoge otra vez al avatar (la misma animación, hacia atrás).",
    "🧾 Al pulsar + o editar un gasto desde cualquier pestaña, se ve la pantalla de detrás (como ya pasaba en Resumen).",
  ]},
  {v:"4.0.12", d:"17 jul 2026", t:"MyInvestor sin captcha", items:[
    "🔌 Conectar MyInvestor ahora hace el login desde TU móvil (como la app oficial): el dichoso reCAPTCHA saltaba porque el login salía de un servidor de Amazon. Desde tu IP de casa casi nunca aparece.",
    "☁️ Todo lo demás sigue igual: la sesión se guarda cifrada en la nube y las posiciones se refrescan solas. Funciona ya con el APK que tienes (te llega por OTA).",
    "🧪 El gesto del perfil (abrir arrastrando hacia abajo, cerrar hacia arriba) queda cubierto por test automático."
  ]},
  {v:"4.0.11", d:"17 jul 2026", t:"El perfil baja como en Revolut + TR sin dramas", items:[
    "👤 El perfil ahora nace del avatar y crece hasta llenar la pantalla mientras el fondo se desenfoca — como en Revolut, también tirando hacia abajo desde Inicio con el dedo.",
    "🏦 Trade Republic: si la sesión caduca de verdad, la app te lleva directa a reconectar con el teléfono ya puesto (PIN + código y listo). Ya no hay que pulsar «Desconectar».",
    "📱 APK 4.0.11 (versionCode 28): la sesión de TR se guarda en más momentos (también al salir de la app) para que no «caduque» sola cada dos por tres."
  ]},
  {v:"4.0.10", d:"17 jul 2026", t:"La app nueva llega sola a todos", items:[
    "📱 Si hay APK nueva, al abrir Mi Cartera se lanza el instalador (tú, tu padre y tu pareja). Solo confirma «Instalar» en Android.",
    "🔔 La notificación de «app nueva» ya abre el instalador de verdad (antes se confundía con el update web)."
  ]},
  {v:"4.0.9", d:"17 jul 2026", t:"Verde más vivo + APK 4.0.9 alineado", items:[
    "🌿 El tema verde vuelve a verse más cálido (menos seco/oscuro). Las fichas llevan un velo verdoso suave, no negro.",
    "📱 APK 4.0.9 (versionCode 27): Trade Republic ya no se desconecta solo por un sync fallido al abrir. Instálalo una vez; el resto sigue por OTA."
  ]},
  {v:"4.0.8", d:"17 jul 2026", t:"Tutorial al avatar, fichas sin negro y bancos claros", items:[
    "🎓 El tutorial ahora encierra el círculo del avatar (antes medía a medias del swipe y el foco salía vacío).",
    "🧾 Al editar un gasto o pulsar +, se ve la app detrás de verdad: sin fondo negro ni scale raro.",
    "👤 Perfil: capa de atenuado aparte (sin achicar la app), botón ✕ y animación más suave.",
    "🏦 Brókers con tarjetas marcadas (TR / MI / CSV) y la versión abajo — así ves si ya tienes el update.",
    "🔌 Trade Republic ya no se sincroniza solo al abrir (eso te deslogueaba con el APK viejo). Sync a mano. El arreglo nativo sigue necesitando APK 4.0.7+."
  ]},
  {v:"4.0.7", d:"17 jul 2026", t:"Novedades suaves, perfil natural, Pádel y fichas sin negro", items:[
    "✨ Tras un update, Novedades entra con animación suave (sin el salto de antes).",
    "👤 Perfil: abrir y cerrar más naturales (cierra tirando hacia arriba, como entró); sin fondo negro raro.",
    "🧾 En editar gasto y en +, se ve la app detrás con un velo suave; al tirar abajo cierra más rápido.",
    "🎾 Nueva categoría Pádel (🎾): Playtomic y pádel ya no van a Ocio/cine. Un «restaurante de pádel» sigue en Bares.",
    "🏦 Brókers en tarjetas planas; Trade Republic no se marca desconectado por un sync fallido (hace falta el APK 4.0.7).",
    "🔌 MyInvestor: el captcha lo pone su anti-bot — espera un rato y reintenta; el device_id se reutiliza para pedirlo menos."
  ]},
  {v:"4.0.6", d:"17 jul 2026", t:"Perfil más fino, Gastos ordenados y bancos claros", items:[
    "👤 Perfil: tipografía compacta, animación más suave, tirar abajo para salir; casillas de editar al tamaño del texto guardado.",
    "🧾 En Gastos: nombre, debajo la categoría y abajo fecha · banco (como Mapfre).",
    "🏦 Bancos: brókers en tarjetas planas (sin acordeones) y sync suave de TR/MI al abrir sin pedir captcha a ciegas.",
    "🔌 MyInvestor reutiliza el device_id de la nube y prueba un sync suave si estaba «caducado»."
  ]},
  {v:"4.0.5", d:"17 jul 2026", t:"Perfil al tirar abajo, fichas sin velo y bancos que no se desconectan solos", items:[
    "👤 En Inicio, tira hacia abajo (o el avatar) y baja tu perfil al estilo Revolut: datos personales, patrimonio y perfil inversor, editables.",
    "🧾 Las fichas de gasto y Apuntar ya no ponen el fondo negro; al cerrarlas no hay el parpadeo de antes.",
    "🏦 Mis bancos más limpio, al estilo del resto de la app.",
    "🔌 Trade Republic y MyInvestor ya no se desconectan solos al abrir la app (ni MyInvestor te pide captcha por un 403 de anti-bot).",
    "📱 Para el arreglo nativo de Trade Republic hace falta el APK 4.0.5."
  ]},
  {v:"4.0.4", d:"17 jul 2026", t:"Tutorial nuevo, fichas más suaves y Plan compacto", items:[
    "🎓 Tutorial actualizado al rediseño: Inicio, Gastos, +, Plan, Cartera y Ajustes.",
    "👆 En Gastos, scrollear categorías/bancos ya no hace el amago de cambiar de pestaña.",
    "🧾 Tirar hacia abajo para cerrar (+ y editar gasto) es más suave, al estilo del swipe entre tabs; en editar gasto vale en toda la ficha.",
    "✨ Ficha de editar gasto más clara: importe grande, comercio, categoría y tipo gasto/ingreso.",
    "📅 En Plan, Pendiente y Ya pagado vuelven a mostrar 3 y «Ver más».",
    "💼 En Cartera, fuera el número verde al lado de inversiones y la tarjeta de redondeo."
  ]},
  {v:"4.0.3", d:"17 jul 2026", t:"Ajustes ordenados y aviso de update con la app cerrada", items:[
    "🔔 Si hay actualización, el móvil te avisa aunque no tengas la app abierta (hace falta instalar el APK nuevo una vez).",
    "👈 En Inicio, Ajustes se abre deslizando desde casi toda la pantalla (no solo el borde).",
    "⚙️ Ajustes agrupado por secciones (apariencia, dinero, conexiones…); Actividad (admin) al final y fuera el botón de Sentry.",
    "💶 En Gastos, céntimos y € del balance van en el mismo blanco que el entero.",
    "🧾 Ficha de gasto y Apuntar más compactos; tira hacia abajo desde cualquier sitio de la hoja.",
    "📅 En Plan, «Ya pagado» lista todo lo del mes (incluidos ingresos y transferencias ya hechos).",
    "💼 Herramientas de inversión sin brókers duplicados, sin editar a mano ni precios USD.",
    "👆 En Gastos, si las categorías están al inicio, deslizar cambia de pestaña; al volver, los chips vuelven al principio."
  ]},
  {v:"4.0.2", d:"17 jul 2026", t:"Ajustes con swipe, balance claro y más categorías", items:[
    "👈 Ajustes se abre de verdad deslizando de izquierda a derecha (el panel ya estaba listo para el gesto).",
    "💶 El balance de Gastos va en blanco, sin el menos, y con el € al lado.",
    "🧾 Al editar un gasto, las etiquetas de fecha/banco quedan centradas y el fondo ya no se mueve al pasar categorías.",
    "🍿 Nueva categoría Cine (Kinepolis…) y más palabras clave para salud, Claude, Google Play…",
    "💼 Inversiones con el mismo diseño que tus cuentas; el resto (precios, redondeo…) en «Herramientas de inversión».",
    "👆 Cambio entre pestañas más suave, al estilo Trade Republic.",
    "📱 Status bar y barra de abajo al color de la app (APK nuevo)."
  ]},
  {v:"4.0.1", d:"17 jul 2026", t:"Pulido del rediseño: gestos, fichas y números que cuadran", items:[
    "👈 Ajustes se abre deslizando desde el borde (como Revolut) y se cierra tirando a la izquierda; el avatar sigue valiendo.",
    "🏠 En Inicio, «Próximos cargos» ya no enseña recibos que ya pagaste este mes.",
    "💶 En Gastos, el resumen cuenta también los ingresos (y el ajuste de Ajustes vuelve a cambiar la vista).",
    "🧾 Fichas de gasto: fecha y banco con margen, fecha legible al editar, y tira hacia abajo para cerrar (también el +).",
    "📅 En Plan › Recibos, «Gestionar» abre fijos y herramientas; «Ya pagado» enseña 3 y el resto con Ver más.",
    "💼 Cartera más limpia: brókers desplegables sin botones ni auto-precios de más.",
    "📱 Status bar del móvil al color de la app (hace falta actualizar el APK nativo)."
  ]},
  {v:"4.0.0", d:"17 jul 2026", t:"Rediseño completo: más claro, más rápido, más tuyo", items:[
    "🏠 Nueva navegación: Inicio, Gastos, botón + para apuntar, Plan y Cartera.",
    "✨ Inicio responde «¿cómo voy?» con patrimonio, presupuesto en humano y próximos cargos.",
    "➕ El botón verde del centro abre el teclado para apuntar un gasto o ingreso al momento.",
    "📅 Plan junta recibos, deudas y metas con cards claras (lo pendiente, lo que debes, lo ahorrado).",
    "💼 Cartera muestra patrimonio, cuentas, redondeo e inversiones sin pantallas de más.",
    "🧾 En Gastos, toca un movimiento para editarlo en una ficha (categoría, tarjeta, borrar).",
    "💶 Toca el presupuesto en Inicio para cambiarlo con −/+ (pasos de 50 €).",
    "👋 Onboarding en 3 pasos: claim, demo de gastos y presupuesto con −/+.",
    "⚙️ Ajustes desde el avatar: perfil, temas en círculos, modo sencillo y conexiones."
  ]},
  {v:"3.113.3", d:"16 jul 2026", t:"Arranque más ligero y desliz entre pestañas más limpio", items:[
    "⚡ Al abrir la app (sobre todo tras vaciar recientes) se carga menos «por detrás» antes de pintar Resumen.",
    "👆 Al deslizar a Gastos el contenido se prepara mientras mueves el dedo, no al soltar.",
    "⚙️ El menú de Ajustes ya no se construye entero hasta que lo abres la primera vez.",
    "🎬 La pantalla de «Cargando…» se desvanece un pelín más suave al terminar de abrir."
  ]},
  {v:"3.113.2", d:"16 jul 2026", t:"Sin parpadeos al cambiar de pestaña y updates más ágiles", items:[
    "🏦 Al ir de Resumen a Gastos (y al revés) ya no «parpadean» los bancos ni el contenido.",
    "⚡ Arranque: Gastos no se monta en segundo plano a lo loco; solo cuando lo tocas.",
    "⬇️ Si hay versión nueva, el aviso sale antes (mientras descarga) y, si ya estaba lista, te avisa al abrir si aún no te había avisado.",
    "🛡️ El botón de «error de prueba» de Sentry en Ajustes solo lo ves tú (como Actividad); el resto de la casa no."
  ]},
  {v:"3.113.1", d:"16 jul 2026", t:"Más comercios reconocidos en Gastos", items:[
    "🏛️ Nueva categoría «Impuestos y multas» para cosas como Gencat, AEAT, DGT, ayuntamientos o sanciones.",
    "🧠 El detector de categorías reconoce más comercios reales sin llenar de botones el filtro: mejor diccionario, misma pantalla simple.",
    "✅ Se han añadido pruebas para que no se rompan casos raros como Zooplus, Booking o papelerías."
  ]},
  {v:"3.113.0", d:"16 jul 2026", t:"Arranque más suave, divisas y categorías inteligentes", items:[
    "⚡ Menos tirón al abrir la app y pasar a Gastos la primera vez (sobre todo tras vaciar las apps en Android).",
    "💱 Inversiones y cuentas en USD/GBP/CHF se pasan a € con tipos del BCE; si editas el coste invertido, queda anclado en euros.",
    "✨ En un gasto «Otros» puedes pedir sugerencia de categoría (palabras clave; IA opcional si está configurada en el servidor).",
    "🛡️ Sentry activo en la versión publicada: en Ajustes puedes enviar un error de prueba."
  ]},
  {v:"3.112.0", d:"16 jul 2026", t:"Tutorial claro y filtro por banco en Gastos", items:[
    "🎓 Tutorial y trucos de Gastos/Fijos/Patrimonio más claros: qué va en cada sitio, nómina/Bizum como Ingreso, y dónde marcar varios bancos.",
    "🏦 En Gastos puedes filtrar por banco (Caixa, Trade Republic, a mano…). Cada movimiento enseña de qué banco es.",
    "💡 Los trucos de esas pestañas vuelven a salir una vez para que no te los pierdas."
  ]},
  {v:"3.111.0", d:"16 jul 2026", t:"Varios bancos en Gastos y roles más claros", items:[
    "🛒 ¿Gastos o Fijos? Los trucos de cada pestaña y los roles en Patrimonio explican en cristiano: recibos/cuotas van a Fijos; supermercado y bares a Gastos.",
    "🏦 Varios bancos de gasto: en Ajustes → Bancos marcas «También apuntar gastos de tarjeta de…» (Caixa, Sabadell…). El presupuesto del día a día sigue en una sola cuenta.",
    "🔄 El banco se actualiza más a menudo (al volver a la app y cada ~hora y media), no solo cada muchas horas.",
    "✅ En Fijos, los cargos nuevos del banco se confirman con «Confirmar y apuntar» — menos tecleo.",
    "📱 App Android (alpha22): si Caixa/Sabadell te avisan con una noti, se piden los movimientos al banco (sin leer el importe de la noti)."
  ]},
  {v:"3.110.0", d:"16 jul 2026", t:"Fin de mes en paz, Hogar completo y tutorial arreglado", items:[
    "😌 Fin de mes en paz: en el Resumen ves cuánto puedes gastar al día y si vas demasiado rápido.",
    "📊 Presupuesto por categoría con barritas (Editar → super=200, ocio=80…).",
    "🏠 Hogar Fase 2: al publicar tu vista se suman gastos por categoría y fijos del hogar (solo lectura).",
    "🔔 Aviso de recibos gordos 1–3 días antes (app Android).",
    "🛟 Tutorial: ya no se queda pillado en los interrogantes «?»."
  ]},
  {v:"3.109.0", d:"15 jul 2026", t:"Hogar compartido e informe del mes", items:[
    "🏠 Hogar compartido (Fase 1): crea un hogar, invita con código de 6 letras y ve el patrimonio fusionado — cada uno publica SU vista, sin mezclar datos.",
    "📊 El día 1 de cada mes te ofrece el informe automático (imagen para WhatsApp). También en Ajustes → Personalización.",
    "⚡ Cambio de pestaña más fluido (pre-carga + animación optimizada)."
  ]},
  {v:"3.108.0", d:"15 jul 2026", t:"Más rápida, más sólida, lista para crecer", items:[
    "⚡ Arranque más fluido: las pestañas que no ves aún no cargan su contenido hasta que las visitas (menos tirones en móviles modestos).",
    "🧩 Código modular en src/ (13 módulos): más fácil de mantener y escalar sin partir el despliegue.",
    "🛡️ Sentry opcional para crashes en producción; Playwright E2E + tests de borrado de cuenta."
  ]},
  {v:"3.107.0", d:"15 jul 2026", t:"Actualizaciones que avisan solas", items:[
    "🔔 Cuando hay una versión nueva lista, te llega una notificación al móvil (tú y quien use la app en su cuenta).",
    "✨ El botón «Nueva versión · toca para actualizar» vuelve a aparecer en cuanto el bundle está descargado — también si cierras y abres la app.",
    "🔄 La app busca updates al arrancar, al volver a primer plano y cada 30 minutos con la app abierta."
  ]},
  {v:"3.106.0", d:"15 jul 2026", t:"Documentación y tests de lo que ya teníamos", items:[
    "👥 Multi-usuario en ingest: cada persona con su token en Ajustes → notificaciones TR (no hace falta JWT en el lector Android).",
    "🚗 Financiación coche: entrada + cuotas + pago final + asesor «¿Cuándo amortizar?» — ya estaba; ahora con tests automáticos.",
    "📋 Nueva tarjeta «Sin cotización automática» en Inversiones: guía para fondos MyInvestor y posiciones sin ticker en TR."
  ]},
  {v:"3.105.0", d:"15 jul 2026", t:"Dashboard de inversiones más completo", items:[
    "📈 El gráfico de evolución muestra valor y coste aportado (línea discontinua) y el cambio % del periodo.",
    "🔄 El histórico se actualiza al refrescar precios o editar posiciones, no solo al abrir la app.",
    "📊 La tarjeta de evolución aparece desde el primer día; al segundo ya ves la tendencia."
  ]},
  {v:"3.104.0", d:"15 jul 2026", t:"Onboarding completo para usuarios nuevos", items:[
    "👋 Si es tu primera vez, un asistente de 4 pasos te guía: presupuesto, cuentas y (opcional) una deuda o inversión. Empiezas con la cartera vacía, sin datos de ejemplo.",
    "📋 En el Resumen verás «Primeros pasos» hasta que lo cierres: un acceso rápido a Ajustes para conectar bancos o activar el apunte de Trade Republic.",
    "☁️ Si ya tenías cartera en la nube e inicias sesión en otro móvil, no te vuelve a pasar el asistente."
  ]},
  {v:"3.103.0", d:"15 jul 2026", t:"Deudas que bajan solas y más tests de fiabilidad", items:[
    "📉 Las cuotas de tus deudas (hipoteca, coche, préstamos…) ahora restan del líquido del banco automáticamente, igual que los gastos fijos. Si no pones día de cargo, se asume el día 1.",
    "📊 El saldo pendiente de cada deuda sigue bajando mes a mes sin que tengas que tocarlo a mano.",
    "🔐 Si acabas de activar el cifrado de tokens en Supabase, la próxima sincronización con MyInvestor re-cifra los enlaces antiguos sola.",
    "✅ Más tests automáticos: motor de deudas, conciliación con el banco y saldos de Open Banking."
  ]},
  {v:"3.102.0", d:"15 jul 2026", t:"Más seguridad y control de tu cuenta", items:[
    "🔐 Los tokens de sesión de MyInvestor y del banco se guardan cifrados en el servidor. Tus contraseñas nunca se almacenan — solo los tokens que devuelve el banco al conectar.",
    "👤 Puedes leer la política de privacidad y borrar tu cuenta desde Ajustes → Tu cuenta. El borrado pide tu contraseña y elimina todos tus datos de la nube.",
    "📱 Si editas en dos móviles a la vez, la app detecta el conflicto y recarga la versión más reciente de la nube en lugar de pisarla sin avisar."
  ]},
  {v:"3.101.0", d:"15 jul 2026", t:"Más fiabilidad por detrás: tests automáticos y datos más seguros", items:[
    "🛡️ El repositorio ya no lleva datos financieros personales: la semilla del código es sintética y solo sirve para migraciones técnicas. Tus datos reales siguen en tu cuenta y en tu móvil, como siempre.",
    "✅ Antes de cada despliegue se ejecutan tests automáticos: comprueban que el código no tiene errores de sintaxis y que los cálculos clave (round-up, importadores Revolut, clasificación de gastos TR) siguen cuadrando.",
    "🏷️ Las categorías de los gastos que entran por notificación de Trade Republic ahora coinciden mejor con las de la app (panadería, parking, peluquería… ya no se van a parar a sitios raros)."
  ]},
  {v:"3.100.0", d:"15 jul 2026", t:"Tu oro de Revolut ya entra, y se acabaron los cuadros grises de Android", items:[
    "🥇 ¡Revolut ya trae tu oro y tu plata! Nunca fue un fallo de lectura: Revolut los guarda en un extracto APARTE («Materias primas»), no en el de acciones, así que el importador ni los veía. Ahora puedes subir los dos extractos a la vez y se fusionan solos. Tu oro pasa a tener onzas de verdad y precio en vivo, en lugar de un número que mantenías a mano.",
    "🧭 Si te equivocas de fichero, ahora te digo cuál es: el «Extracto de Pérdidas y Ganancias» solo trae lo que YA vendiste, no lo que tienes (y ojo, que Revolut le pone un nombre engañoso a uno de ellos). Antes solo salía «no he podido leer el CSV» y a adivinar.",
    "💬 Los cuadros de «Amortizar», «Aportar a una meta» o «Vender parte» ya son de la app: mismos colores, misma letra y botones en español. Antes se asomaba el cuadro gris de Android con «CANCEL / OK» y desentonaba muchísimo. De regalo, ahora traen atajos (100 €, 250 €, «Todo») y te recuerdan cuánto llevas pendiente. ¡Gracias por el aviso! 💚"
  ]},
  {v:"3.99.0", d:"15 jul 2026", t:"Trade Republic ya aguanta en frío, brókers que se actualizan solos y menos avisos", items:[
    "🏆 ¡Arreglado el fallo de Trade Republic al abrir la app en frío! Llevaba meses pidiendo el 2FA una y otra vez. No era el control anti-bot como creíamos: Android se cargaba la sesión al cerrar la app del todo. Ahora se guarda a mano y sobrevive. (Si pasas varios días sin entrar, sí tendrás que reconectar: eso lo decide Trade Republic.)",
    "🔄 Trade Republic y MyInvestor se actualizan SOLOS al abrir la app, sin darle a «Sincronizar». Va en silencio y con cabeza: refresca lo que ya tienes mapeado y como mucho cada media hora. Lo nuevo lo sigues revisando tú en su tarjeta.",
    "🔕 Fuera dos avisos pesados: el del saldo del banco (que saltaba en cada apertura) y el de errores. El saldo ya lo ves en Patrimonio, y ahora solo te avisa si lo pides tú.",
    "🏦 «Gestionar mis bancos» a dieta: se queda con lo básico — actualizar saldo, reconectar y quitar. Clasificar un banco (recibos / gasto diario / todo) sigue estando en Patrimonio → Editar."
  ]},
  {v:"3.98.0", d:"13 jul 2026", t:"Revolut cuadrado: fuera duplicados y precios en vivo de verdad", items:[
    "🧹 Los duplicados fantasma de Revolut (esos «NVDA 0,00 € · −100%» al lado de tu NVIDIA de verdad) se van solos al abrir la app: eran restos del importador antiguo.",
    "💹 Al aplicar un extracto de Revolut, el valor de cada posición también se recalcula (antes solo se tocaban participaciones y coste, y el % salía disparatado: un Broadcom a −39% que en Revolut estaba a −6%). Y nada más aplicar, los precios se actualizan en vivo solos.",
    "📈 «Precios USD» ahora cotiza cualquier ticker de tu cartera (antes estaba clavado a 6 valores fijos) y también el oro (XAU).",
    "🗑️ Ya puedes borrar una posición a mano: «Editar a mano» → 🗑 Borrar. Antes los cadáveres se quedaban en la lista para siempre."
  ]},
  {v:"3.97.0", d:"13 jul 2026", t:"Importar Revolut arreglado, asesor de amortización y Ajustes con buscador", items:[
    "💹 El importador de Revolut ya lee bien los números: entiende importes con coma española («88,94 €»), ventas sin cantidad, y no resucita posiciones que ya vendiste. Además, por defecto NO crea posiciones nuevas — tú decides qué se toca, y cada posición enseña sus compras/ventas para poder cuadrarla con la app de Revolut.",
    "💡 Nuevo en Deudas: el asesor «¿Cuándo amortizar?». Ponle el interés a la deuda, di cuánto amortizarías y te dice cuántas cuotas te quitas, cuánto ahorras en intereses y si te compensa frente a tu efectivo remunerado.",
    "⚙️ Ajustes reorganizado: secciones plegadas y buscador arriba («tema», «banco», «copia»…). Se acabó el scroll kilométrico.",
    "🎓 Mini-tutoriales por pestaña: la primera vez que entras en cada una te cuenta sus trucos (p.ej. el lápiz ✎ para editar un gasto). Los relees cuando quieras con el botoncito «💡 ¿Cómo va esto?».",
    "📈 La sesión de MyInvestor ahora se mantiene viva sola (el servidor la renueva cada 10 minutos). Si aún así caduca, la app te lo canta y recuerda tu usuario — la contraseña nunca se guarda.",
    "💇 Categoría nueva: Peluquería (cortes, uñas y estética ya no caen en «Salud»)."
  ]},
  {v:"3.96.0", d:"12 jul 2026", t:"Conectar MyInvestor, importar Revolut y las vistas de Gastos con nombres claros", items:[
    "📈 Conectar MyInvestor (beta): en Ajustes → Gestionar mis bancos. Metes usuario y contraseña (puede pedir un SMS) y trae tus fondos indexados. Tu contraseña NO se guarda, solo la sesión.",
    "💹 Importar Revolut por CSV (beta): junto a Trade Republic, con un paso a paso para exportar el extracto desde la app de Revolut. Re-ancla tus acciones/ETF. Se procesa en tu móvil, no se sube nada.",
    "🧮 Las dos vistas del total de Gastos ahora se llaman «Gastos e ingresos» y «Balance» (antes «Desglosado» y «Lo que te queda»), comparten el mismo diseño y ninguna enseña ya el «−»."
  ]},
  {v:"3.95.1", d:"12 jul 2026", t:"Retoque: el «−» que se colaba en «Lo que te queda»", items:[
    "En la vista «Lo que te queda» de Gastos, cuando te pasabas de gasto seguía saliendo un «−» delante del número. Ya no: el color rojo o verde te dice solo si ahorras o te pasas, igual que en el resto de la app."
  ]},
  {v:"3.95.0", d:"12 jul 2026", t:"Novedades a la vista, sugerencias sin salir de la app y gastos sin «−»", items:[
    "🎉 Este popup: a partir de ahora, cada actualización te cuenta qué trae. Se abre solo una vez por versión.",
    "📜 Histórico en Ajustes → «✨ Novedades y sugerencias»: relee las novedades de cualquier versión cuando quieras.",
    "💬 Caja de sugerencias aquí mismo: apunta errores o ideas en el momento — quedan en «Tus apuntes» y le llegan a Juanjo con tu versión.",
    "Los gastos ya no llevan el signo «−» delante (quedaba feo); los ingresos conservan su «+».",
    "✨ En la app Android vuelve el botoncito de arriba «Nueva versión · toca para actualizar»: sale cuando la actualización está descargada y lista (antes se instalaba en silencio al reabrir la app)."
  ]},
  {v:"3.94.0", d:"11 jul 2026", t:"Ahorro editable, dos vistas de Gastos y secciones a tu gusto", items:[
    "La tarjeta «¿A dónde va tu ahorro?» del Resumen ya se puede editar: importes, nombres, banco, borrar y añadir aportaciones.",
    "El total de Gastos tiene dos vistas (Ajustes → Personalización): «Desglosado» o «Lo que te queda» (ingresos − gastos, un solo número verde/rojo).",
    "Botón «⇅ Ordenar secciones» al pie de Fijos, Patrimonio, Deudas, Inversiones y Metas: ordena las tarjetas como quieras.",
    "La pantalla «Actividad» (admin) ahora va aparte, con filtro de solo errores.",
    "Si un banco conectado no trae ninguna cuenta utilizable, ahora avisa con pasos claros (antes se quedaba mudo)."
  ]},
  {v:"3.93.0", d:"11 jul 2026", t:"Editar el saldo de una deuda ya no resetea las cuotas", items:[
    "Corregir el saldo pendiente de una deuda con plazo respetaba mal las cuotas: volvía a «Quedan 4/4» aunque llevaras 3 pagadas. Arreglado: el contador y el % amortizado se mantienen."
  ]},
  {v:"3.92.0", d:"11 jul 2026", t:"Deudas más completas", items:[
    "Añadir una deuda incompleta ahora avisa de qué falta (antes fallaba en silencio y parecía que el botón no iba).",
    "Botón «💸 Amortizar» en cada deuda: pagas anticipado, baja el pendiente y se acorta el plazo manteniendo la cuota.",
    "Campo «Cuotas ya pagadas» al crear una deuda que ya estaba empezada: el pendiente y el «Quedan n/tot» salen bien desde el primer día."
  ]},
  {v:"3.91.0", d:"11 jul 2026", t:"Total de Gastos legible, cuentas del banco con rol y filtro «Mi ciclo»", items:[
    "El total de Gastos con ingresos ya no engaña: gastos por un lado y «💰 +ingresos · Balance» por otro (verde si ahorras).",
    "Las cuentas conectadas por banco (Revolut, CaixaBank…) pueden tener rol — Recibos / Gasto diario / Todo — para domiciliarles gastos fijos.",
    "Filtro «Mi ciclo» en Gastos: de tu último cobro a hoy. El Balance de ese filtro es tu ahorro real del ciclo, aunque la nómina no caiga en día fijo.",
    "Categoría nueva 🥖 Panadería (los cruasanes ya no son «Bares»)."
  ]},
  {v:"3.90.0", d:"11 jul 2026", t:"Gastos de TR por persona, bancos que no se esfuman y más", items:[
    "Cada persona apunta sus gastos de Trade Republic en SU cuenta: interruptor «Apuntar aquí mis gastos de TR» en Ajustes → Notificaciones.",
    "Un banco con el permiso caducado ya no desaparece del Patrimonio: se queda con aviso «caducado» hasta que lo reconectes.",
    "Alta manual de Gastos con fecha (para apuntar cosas de hace días), filtro 💰 Ingreso, y las suscripciones detectadas ofrecen «pasar a Gastos fijos».",
    "«Buscar actualización» en Ajustes aplica la versión nueva al momento."
  ]}
];
/* Cinturón por si alguien sirve el módulo sin pasar por build-app (tests que evalúan fuente).
   En el bundle real el literal YA viene troceado: este slice no ahorra bytes allí. */
RELEASE_NOTES=RELEASE_NOTES.slice(0,RELEASE_NOTES_MAX);
/* Panel de Novedades. Se usa desde App (popup automático al estrenar versión) y desde
   Ajustes (histórico). Portal a body: sobrevive al transform del cajón de Ajustes. */
function WhatsNew({onClose, showToast, set, state}){
  useBackClose(true, onClose);
  const [openV,setOpenV]=useState(RELEASE_NOTES.length?RELEASE_NOTES[0].v:null);
  // (La caja de sugerencias se mudó a Ajustes → «Enviar sugerencia» el 2026-07-18: aquí
  // quedaba enterrada bajo el historial de versiones. Este popup es solo el historial.)
  const card=function(cur){ return {padding:"12px 14px",borderRadius:14,border:"1px solid "+(cur?"var(--mint)":"var(--line)"),background:"var(--surface)",marginBottom:10}; };
  return ReactDOM.createPortal(React.createElement("div",{className:"wn-panel"}, React.createElement("div",{className:"wn-inner"},
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 2px"}}, "✨ "+t("wn_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:14}}, t("wn_sub")),
    RELEASE_NOTES.map(function(r){
      /* En beta la versión que corre lleva sufijo de compilación (4.11.0.8) y las notas van por
         versión base (4.11.0), así que comparar a pelo no casaba NUNCA: ninguna entrada salía
         marcada como «tu versión» y arriba ponía «v4.11.0» estando en la .8 — «salía la 4.11 con
         las novedades, no salía con el .8» (2026-07-26). Se casa por base, como ya hacía la
         checklist de beta (`betaChecklist`), y se enseña el número REAL que lleva puesto. */
      const open=openV===r.v, cur=r.v===mcVerBase(CONFIG.APP_VERSION);
      return React.createElement("div",{key:r.v,style:card(cur)},
        React.createElement("button",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,width:"100%",background:"none",border:"none",color:"var(--text)",padding:0,cursor:"pointer",textAlign:"left"},onClick:function(){ setOpenV(open?null:r.v); }},
          React.createElement("span",{style:{fontWeight:800,fontSize:14}},"v"+(cur?CONFIG.APP_VERSION:r.v)+(cur?" · "+t("wn_current")+" ✓":"")),
          React.createElement("span",{style:{color:"var(--muted-2)",fontSize:11.5,flex:"0 0 auto"}},r.d+(open?" ▴":" ▾"))),
        React.createElement("div",{style:{fontWeight:700,fontSize:13,margin:"5px 0 "+(open?"7px":"0"),color:cur?"var(--mint)":"var(--muted)"}},rnT(r.t)),
        open && rnItems(r).map(function(it,j){ return React.createElement("div",{key:j,style:{fontSize:12.5,lineHeight:1.55,color:"var(--text)",margin:"0 0 7px",paddingLeft:14,textIndent:-14}},"• "+it); })
      );
    }),
    React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},onClick:onClose}, t("wn_close"))
  )), document.body);
}

/* Conversor de monedas: pantalla propia (mismo patrón que ActivityPanel/PrivacyPanel), NO un
   acordeón dentro de Ajustes → Dinero. Con 16 monedas la lista de chips (×2, origen y destino)
   hacía Ajustes interminable en el móvil — feedback 2026-08-05: «ponlo en una pantalla nueva,
   hay un montón de divisas». El buscador filtra por código o nombre (p.ej. «lira», «try», «corona»)
   y afecta a las DOS listas de chips a la vez, porque comparten el mismo catálogo. No inventa
   tipos: reutiliza toEurAmt/fromEurAmt y los `fxRates` que ya trae Ajustes → Dinero. */
function CurConverterPanel({state, onClose, refreshFx}){
  useBackClose(true, onClose);   // gesto atrás del móvil: cierra esta pantalla
  const [amt,setAmt]=useState("1");
  const [from,setFrom]=useState("EUR");
  const [to,setTo]=useState("TRY");
  const [q,setQ]=useState("");
  useEffect(function(){ if(refreshFx) refreshFx(); },[]);   // al entrar, tipos al día (igual que el acordeón antes)
  const normQ=function(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); };
  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const inp={width:"100%",padding:"10px 13px",borderRadius:12,border:"1px solid var(--line)",background:"var(--bg-2)",color:"var(--text)",fontSize:16,boxSizing:"border-box"};
  const segBtn=function(on){ return {padding:"7px 10px",borderRadius:20,fontSize:12.5,fontWeight:700,cursor:"pointer",background:on?"var(--mint)":"var(--surface-2)",color:on?"#06120C":"var(--text)",border:on?"none":"1px solid var(--line)"}; };
  const tbl=fxTableOf(state);
  const hasRates=CUR_LIST.some(function(c){ return c!=="EUR" && tbl[c]>0; });
  const nq=normQ(q).trim();
  const filtList=nq?CUR_LIST.filter(function(c){ return normQ(c+" "+t("cur_"+c.toLowerCase())).indexOf(nq)>=0; }):CUR_LIST;
  const chipRow=function(cur, setCur){
    if(nq && filtList.length===0){
      return React.createElement("div",{style:{fontSize:12.5,color:"var(--muted-2)",padding:"10px 2px"}}, t("st_cur_convert_search_none"));
    }
    return React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}},
      filtList.map(function(c){
        const ok=c==="EUR"||tbl[c]>0;
        return React.createElement("button",{key:c,type:"button",disabled:!ok,onClick:function(){ if(ok) setCur(c); },
          style:Object.assign({},segBtn(cur===c),{flex:"0 0 auto",opacity:ok?1:.4})},
          (CUR_SYM[c]||c)+" "+c);
      }));
  };
  const raw=parseFloat(String(amt).replace(",","."))||0;
  const needFrom=from!=="EUR" && !(tbl[from]>0);
  const needTo=to!=="EUR" && !(tbl[to]>0);
  const eurMid=(!needFrom && raw>0)?toEurAmt(raw, from, state):null;
  const out=(!needTo && eurMid!=null)?fromEurAmt(eurMid, to, state):null;
  const rateTxt=(function(){
    if(needFrom||needTo||!(raw>0)||out==null) return null;
    const one=fromEurAmt(toEurAmt(1, from, state), to, state);
    if(!(one>0)) return null;
    return "1 "+(CUR_SYM[from]||from)+" = "+NF.format(one)+" "+(CUR_SYM[to]||to);
  })();
  return React.createElement("div",{style:wrap}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("st_back_settings")),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 2px"}}, "🔁 "+t("st_cur_convert")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:12}}, t("st_cur_convert_hint")),
    !hasRates
      ? React.createElement("div",{style:{marginTop:4}},
          React.createElement("div",{style:{fontSize:13,color:"var(--muted)",lineHeight:1.45}}, t("st_cur_compare_empty")),
          refreshFx && React.createElement("button",{type:"button",className:"btn btn-ghost",style:{marginTop:10,width:"100%"},onClick:function(){ refreshFx(); }}, t("st_cur_compare_retry")))
      : React.createElement(React.Fragment,null,
          React.createElement("input",{style:inp,placeholder:t("st_cur_convert_search_ph"),value:q,onChange:function(e){ setQ(e.target.value); }}),
          React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",margin:"14px 0 4px"}}, t("st_cur_convert_from")),
          React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center"}},
            React.createElement("input",{type:"text",inputMode:"decimal",value:amt,
              onChange:function(e){ setAmt(e.target.value); },
              style:{flex:"1 1 40%",minWidth:0,padding:"10px 12px",borderRadius:12,border:"1px solid var(--line)",background:"var(--surface-2)",color:"var(--text)",fontSize:16,fontWeight:700,fontVariantNumeric:"tabular-nums"}}),
            React.createElement("span",{className:"num",style:{fontWeight:700,fontSize:15,flex:"0 0 auto"}}, CUR_SYM[from]||from)
          ),
          chipRow(from, setFrom),
          React.createElement("button",{type:"button",onClick:function(){ const a=from; setFrom(to); setTo(a); },
            style:{marginTop:14,width:"100%",padding:"10px 12px",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",background:"var(--surface-2)",color:"var(--text)",border:"1px solid var(--line)"}}, "⇅ "+t("st_cur_convert_swap")),
          React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",margin:"14px 0 4px"}}, t("st_cur_convert_to")),
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"10px 12px",borderRadius:12,border:"1px solid var(--line)",background:"var(--surface)"}},
            React.createElement("span",{className:"num",style:{fontWeight:800,fontSize:22,letterSpacing:"-.3px",
              color:(needFrom||needTo)?"var(--muted)":"var(--text)"}},
              out!=null?NF.format(out):"—"),
            React.createElement("span",{style:{fontWeight:700,fontSize:14}}, CUR_SYM[to]||to)
          ),
          chipRow(to, setTo),
          (needFrom||needTo) && React.createElement("div",{style:{fontSize:12,color:"var(--coral)",marginTop:8,lineHeight:1.4}}, t("fx_no_rate")),
          rateTxt && React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.5,marginTop:10}},
            rateTxt+(state.fxDate?(" · "+state.fxDate):""))
        )
  ));
}

/* Contenido del cajón de Ajustes (el cajón deslizante lo gestiona App). */
function SettingsPanel({state, set, onClose, showToast, uid, onBankSync, onTour, totals, fetchPrices, refreshFx, goBanks, goBanksFocus, goGastos}){
  const [expand,setExpand]=useState(null);   // fila-acordeón abierta: "lang" | "gview" | "tabs" | "cur" | null
  const [newsOpen,setNewsOpen]=useState(false);   // histórico de Novedades (WhatsNew reabierto a mano)
  const [privOpen,setPrivOpen]=useState(false);    // política de privacidad DENTRO de la app (no _blank)
  const [sharedOpen,setSharedOpen]=useState(false);// Hogar + gastos compartidos (sin tab propia en v4)
  const [fbOpen,setFbOpen]=useState(false);        // sugerencias (mudadas fuera de Novedades, 2026-07-18)
  const [bioOn,setBioOn]=useState(bio.enabled());  // candado con huella (volvió a Ajustes, 2026-07-18)
  const toggleBio=function(){
    if(bioOn){ bio.disable(); setBioOn(false); showToast(t("au_bio_dis")); return; }
    bio.enable(uid, meEmail).then(function(){ setBioOn(true); showToast(t("au_bio_en")); })
      .catch(function(e){ showToast("✕ "+((e&&e.message)||e)); });
  };
  const doSignOut=function(){
    askConfirm({ title:t("au_signout"), ok:t("au_signout"), danger:true }).then(function(yes){
      if(!yes) return;
      cloud.signOut().then(function(){ showToast(t("au_signedout")); onClose(); });
    });
  };
  // Telemetría: el panel «Actividad» SOLO existe para el admin (gate por email de la sesión;
  // la RLS de app_events lo re-valida en servidor — sin sesión de admin no devuelve filas).
  const [meEmail,setMeEmail]=useState(null);
  const [isAdmin,setIsAdmin]=useState(false);
  useEffect(function(){
    if(!cloud.enabled()){ return; }
    cloud.session().then(function(s){ setMeEmail((s&&s.user&&s.user.email)||null); }).catch(function(){});
    cloud.fetchProfile().then(function(p){ setIsAdmin(!!(p&&p.is_admin)); }).catch(function(){});
  },[uid]);
  // «Buscar actualización» a mano (feedback 2026-07-10: «no me sale ningún botón para actualizar
  // manualmente»): consulta apk.json (APK) y version.json (web) al momento, sin esperar al arranque.
  const checkUpdates=function(){
    const nat=natPlugin();
    if(!nat||!nat.appInfo){ showToast(t("apk_why_noapp")); return; }
    // «Estás a la última» a secas no distingue «no hay nada nuevo» de «he mirado donde no era»:
    // con la 35 publicada en la beta y el móvil leyendo el manifiesto de producción, la respuesta
    // era la misma frase de siempre (2026-07-26). Ahora el resumen dice qué canal se ha mirado,
    // qué APK ofrece y cuál llevas puesta, que es lo que hacía falta para no adivinar.
    Promise.resolve(window._mcCheckApkUpdate?window._mcCheckApkUpdate({manual:true, showToast:showToast}):false)
      .then(function(apkDone){
        if(apkDone) return;
        const cierre=function(){
          var por=window._mcApkWhy?" · "+window._mcApkWhy:"";
          showToast(t("st_up_ok")+" · web v"+CONFIG.APP_VERSION+por);
        };
        if(window._mcCheckOtaUpdates){
          return window._mcCheckOtaUpdates({manual:true, showToast:showToast}).then(function(otaDone){
            if(otaDone) return;
            cierre();
          });
        }
        cierre();
      });
  };
  const [events,setEvents]=useState(null);
  const [actOpen,setActOpen]=useState(false);   // pantalla «Actividad» (antes acordeón: crecía sin fin)
  const [betaOpen,setBetaOpen]=useState(false);  // pantalla «Revisar la beta» (solo en canal beta)
  const [hojaOpen,setHojaOpen]=useState(false);  // importar una hoja de gastos (Excel/CSV)
  const [histOpen,setHistOpen]=useState(false);  // importar histórico del banco (también desde «Mis bancos»)
  const [autoBackOpen,setAutoBackOpen]=useState(false);  // copias automáticas diarias (state_backups)
  const prodVer=useProdVersion();                // Pages ahora (cruda); null mientras pregunta
  // Misma regla que useYaEnProd, sin segundo fetch (compartimos prodVer con betaChecklist).
  const yaEnProd=(!prodVer||!/^\d+\.\d+\.\d+$/.test(mcVerBase(CONFIG.APP_VERSION)))
    ? null
    : (!mcIsNewer(mcVerBase(CONFIG.APP_VERSION), prodVer) ? prodVer : false);
  const loadEvents=function(){
    cloud.adminEvents(200).then(function(rows){
      setEvents(rows||[]);
      try{ localStorage.setItem("_evSeen", String(Date.now())); }catch(e){}   // el aviso de "errores nuevos" se resetea
      // feedback visible: sin esto, recargar con los mismos datos parecía "no hacer nada" (2026-07-11)
      const nErr=(rows||[]).filter(function(r){ return r.kind==="error"; }).length;
      showToast("↻ "+(rows||[]).length+" eventos · "+nErr+" error(es)");
    }).catch(function(e){ setEvents([]); showToast("⚠ "+((e&&e.message)||e)); });
  };
  // ¿El lector de gastos TR tiene acceso a notificaciones? (se pierde al reinstalar la app).
  // Se re-chequea al volver a la app (visibilitychange): al activar el permiso y volver, el aviso se quita solo.
  const [notifOk,setNotifOk]=useState(true);
  useEffect(function(){
    const check=function(){
      const nat=natPlugin();
      if(nat&&nat.notifAccess){ try{ nat.notifAccess().then(function(r){ setNotifOk(!(r&&r.granted===false)); }).catch(function(){}); }catch(e){} }
    };
    check();
    document.addEventListener("visibilitychange",check);
    return function(){ document.removeEventListener("visibilitychange",check); };
  },[]);
  // --- Banco (Open Banking) ---
  const [bankLinks,setBankLinks]=useState(null);   // null = cargando, [] = ninguno (resumen)
  const [bankBusy,setBankBusy]=useState(false);
  const [trConn,setTrConn]=useState(false);        // TR también cuenta como banco conectado (feedback 2026-07-10)
  const [trKnown,setTrKnown]=useState(false);      // tuvo TR alguna vez (mc_tr_phone) → puede estar «caído»
  // Versión nativa del APK (hueco 2026-07-26): sin esto Ajustes solo mostraba la OTA y no
  // sabías si el icono/splash nuevos estaban puestos o seguías en la 34.
  const [apkVer,setApkVer]=useState(null);
  useEffect(function(){
    const refreshTr=function(){
      const known=!!(typeof trPhoneSaved==="function"&&trPhoneSaved());
      setTrKnown(known);
      const b=trBridge(); if(!b||!b.status){ if(!known) setTrConn(false); return; }
      Promise.resolve(b.status()).then(function(r){ setTrConn(!!(r&&r.connected)); }).catch(function(){});
    };
    refreshTr();
    const onTr=function(e){
      if(e&&e.detail&&typeof e.detail.connected==="boolean"){
        setTrConn(!!e.detail.connected); setTrKnown(true);
        // Solo si la acción MANUAL acabó bien (detalle.ack). Status/poll no tosta — rechazo TR.
        if(e.detail.ack && e.detail.connected) showToast(t("tr_connected"));
        return;
      }
      refreshTr();
    };
    window.addEventListener("mc-tr-status", onTr);
    return function(){ window.removeEventListener("mc-tr-status", onTr); };
  },[uid]);
  useEffect(function(){
    const nat=natPlugin();
    if(!nat||!nat.appInfo) return;
    /* EL NÚMERO QUE HACE FALTA ES EL versionCode, NO EL versionName (feedback 2026-07-26, tercera
       vez que lo pide): «sale la versión web y la versión de la app pero no sale la interesante,
       la de la APK, no sé si está en 34 o 35 o vete tú a saber». Y tenía razón — `versionName` es
       "4.12.0", O SEA EXACTAMENTE LO MISMO que la versión web, así que la fila no le decía nada
       nuevo. Lo que distingue una APK de otra es el `versionCode` (34, 35…), que es además lo que
       compara `apk.json` para ofrecerle la instalación. Sin ese número no puede saber si un fallo
       nativo —el icono, por ejemplo— es un bug o es que no ha instalado la APK nueva. */
    Promise.resolve(nat.appInfo()).then(function(info){
      if(!info) return;
      var nombre=info.versionName?String(info.versionName):"";
      var codigo=info.versionCode!=null?String(info.versionCode):"";
      if(codigo) setApkVer(nombre?nombre+" ("+codigo+")":"("+codigo+")");
      else if(nombre) setApkVer(nombre);
    }).catch(function(){});
  },[]);
  const [manageBanks,setManageBanks]=useState(false);   // abre la sección "Mis bancos"
  useBackClose(manageBanks, function(){ setManageBanks(false); });   // gesto atrás: cierra "Mis bancos"
  // Banner «Reconectar TR» de Cartera (evento mc-open-banks → App abre Ajustes + goBanks):
  // aterriza DIRECTO en Mis bancos, donde el formulario de TR ya trae el teléfono puesto.
  useEffect(function(){ if(goBanks) setManageBanks(true); },[goBanks]);
  useEffect(function(){
    if(!cloud.enabled()){ setBankLinks([]); return; }
    cloud.bankLinks().then(function(rows){
      setBankLinks(rows||[]);
      if((rows||[]).some(function(r){ return r.status==='active'||r.status==='pending'; })){
        set(function(s){ return s.hasBankLink?s:Object.assign({},s,{hasBankLink:true}); });
      }
    }).catch(function(){ setBankLinks([]); });
  },[uid]);
  const connectBank=function(){
    setBankBusy(true); showToast(t("bank_connecting"));
    cloud.bankConnect("Banco de Sabadell").then(function(d){
      set(function(s){ return Object.assign({},s,{hasBankLink:true}); });
      location.href=d.url;   // → login del banco (SCA); vuelve a la app con ?bank=ok
    }).catch(function(e){ setBankBusy(false); showToast("⚠ "+t("bank_error")+": "+((e&&e.message)||e)); });
  };
  const refreshBank=function(){ if(!onBankSync) return; setBankBusy(true); Promise.resolve(onBankSync()).finally(function(){ setBankBusy(false); cloud.bankLinks().then(function(r){ setBankLinks(r||[]); }).catch(function(){}); }); };
  // Estilos de los pocos controles con input propio (presupuesto). Los demás usan el sistema
  // de filas .set-row/.swx. (lbl/btnGhost/link se quitaron en 2026-07-17: estaban muertos.)
  // Inputs se quedan en 16px (menos = zoom automático del móvil al enfocar); los botones sí
  // bajan de tamaño para no parecer listones (feedback 2026-07-18).
  const inp={width:"100%",padding:"10px 13px",borderRadius:"12px",border:"1px solid var(--line)",background:"var(--bg-2)",color:"var(--text)",fontSize:"16px",boxSizing:"border-box"};
  const btn={width:"100%",padding:"10px 12px",borderRadius:"12px",border:"none",background:"var(--mint)",color:"#06120C",fontWeight:700,fontSize:"14px",marginTop:"10px",cursor:"pointer"};
  /* Presupuesto mensual: se edita en Resumen (BudgetSheet). Bancos de gasto diario: en Cartera.
     Quitados de aquí el 2026-08-05 — eran duplicados muertos / confusos (feedback suyo). */
  /* `doExport`/`doImport` (copia manual a fichero JSON) retirados el 2026-08-04 a petición suya:
     la copia automática diaria en la nube ya cubre el caso y se restaura desde Ajustes → Copia de
     seguridad. El importar a mano además sobrescribía el estado ENTERO de golpe, que es la clase de
     botón que no quieres al lado de nada. El <input type=file> que lo disparaba también se fue. */
  // --- Rediseño Claude Design (2026-07-10): tarjetas con filas agrupadas (.set-card/.set-row),
  // valores a la derecha, acordeones para las opciones y switches iOS (.sw). El contenido y la
  // lógica son los mismos de siempre; solo cambia la presentación.
  const setS=function(patch){ set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,patch)}); }); };
  const toggleExp=function(k){ setExpand(expand===k?null:k); };
  const row=function(k,icon,label,value,onClick,right){
    return React.createElement("button",{key:k,className:"set-row",onClick:onClick},
      React.createElement("span",{className:"sr-ic"},icon),
      React.createElement("span",{className:"sr-lb"},label),
      value!=null && React.createElement("span",{className:"sr-val"},value),
      right!==undefined ? right : React.createElement("span",{className:"sr-chev"+(expand===k?" open":"")},"›")
    );
  };
  const sw=function(on){ return React.createElement("span",{className:"swx"+(on?" on":"")}); };
  const curLang=(state.settings&&state.settings.lang)||"es";
  const curTheme=(state.settings&&state.settings.theme)||"green";
  const curCur=(state.settings&&state.settings.currency)||"EUR";
  const curSeason=(state.settings&&state.settings.season)||"none";
  const curTextSize=textSizeOf(state);
  const simOn=!!(state.settings&&state.settings.simpleMode);
  // Conversor de monedas: pantalla propia (CurConverterPanel), no acordeón — ver su comentario.
  const [convOpen,setConvOpen]=useState(false);
  const segBtn=function(on){ return Object.assign({},btn,{flex:"1 1 30%",marginTop:0,background:on?"var(--mint)":"var(--surface-2)",color:on?"#06120C":"var(--text)",border:on?"none":"1px solid var(--line)"}); };
  // ── Secciones colapsables + buscador (feedback 2026-07-13: «Ajustes se está haciendo
  // kilométrico»). Cada tarjeta es ahora un grupo plegado (estado en localStorage); el
  // buscador filtra grupos por título y palabras clave y los abre de golpe. ──
  const [q,setQ]=useState("");
  const normQ=function(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); };
  const [grps,setGrps]=useState({});
  // Al abrir la app TODAS las secciones arrancan encogidas (petición 2026-07-18): ya no se
  // recuerda el estado abierto entre sesiones — solo dentro de la sesión actual (grps en memoria).
  const isOpen=function(id){ const v=grps[id]; return v!=null ? v : false; };
  const toggleGrp=function(id){ const v=!isOpen(id); setGrps(function(g){ const n=Object.assign({},g); n[id]=v; return n; }); };
  let grpMatches=0;   // cuántos grupos pasan el filtro del buscador (para el «sin resultados»)
  const grp=function(id,icon,title,keywords,val){
    const kids=Array.prototype.slice.call(arguments,5);
    const nq=normQ(q).trim();
    if(nq && normQ(title+" "+(keywords||"")).indexOf(nq)<0) return null;
    grpMatches++;
    const open=nq!==""?true:isOpen(id);
    // Despliegue ANIMADO con el patrón .collapsible (grid-rows): montar/desmontar en seco se
    // sentía «robótico» (feedback 2026-07-18). El contenido queda siempre montado (solo Ajustes,
    // coste asumible) y la altura transiciona suave en ambos sentidos.
    return React.createElement("div",{className:"set-card"},
      React.createElement("button",{className:"set-row",onClick:function(){ toggleGrp(id); }},
        React.createElement("span",{className:"sr-ic"},icon),
        React.createElement("span",{className:"sr-lb",style:{fontWeight:800}},title),
        val!=null && React.createElement("span",{className:"sr-val"},val),
        React.createElement("span",{className:"sr-chev"+(open?" open":"")},"›")),
      React.createElement("div",{className:"collapsible"+(open?" open":"")},
        React.createElement("div",null, React.createElement.apply(null,[React.Fragment,null].concat(kids)))
      )
    );
  };
  return React.createElement(React.Fragment,null,
    React.createElement("div",{className:"v4-set-profile"},
      React.createElement("div",{className:"v4-set-av"}, (meEmail||"MC").slice(0,2).toUpperCase()),
      React.createElement("div",{style:{minWidth:0,flex:1}},
        React.createElement("div",{style:{fontWeight:800,fontSize:16}}, meEmail?meEmail.split("@")[0]:"Mi Cartera"),
        React.createElement("div",{style:{fontSize:12.5,color:"var(--muted)",marginTop:2}}, meEmail||t("v4_set_profile_local")),
        React.createElement("div",{style:{fontSize:12,color:"var(--mint)",marginTop:4,fontWeight:700}}, uid?t("v4_set_profile_sync"):t("v4_set_profile_local"))
      )
    ),
    React.createElement("input",{style:Object.assign({},inp,{marginTop:12}),placeholder:t("st_search_ph"),value:q,onChange:function(e){ setQ(e.target.value); }}),

    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_appear")),
    grp("general","🎨",t("v4_set_appear"),"idioma language tema theme color temática temporada mundial halloween navidad verano invierno apariencia look",null,
      React.createElement("div",{className:"v4-theme-row","aria-label":t("theme")},
        THEMES.map(function(th){
          return React.createElement("button",{key:th[0],type:"button",title:t("th_"+th[0]),
            className:"v4-theme-sw"+(curTheme===th[0]?" on":""),
            style:{background:th[2]},
            onClick:function(){ applyTheme(th[0]); setS({theme:th[0]}); }});
        })
      ),
      // Temáticas de temporada (Mundial/Halloween/Navidad…): color de acento + animación ambiental.
      row("season","🎉",t("st_theme_season"),t("th_"+(curSeason==="none"?"none":curSeason)),function(){ toggleExp("season"); }),
      expand==="season" && React.createElement("div",{className:"set-exp"},
        React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}},
          SEASONS.map(function(se){
            return React.createElement("button",{key:se[0],onClick:function(){ applySeason(se[0]); setS({season:se[0]}); },style:segBtn(curSeason===se[0])}, se[1]+" "+t("th_"+se[0]));
          })),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.5,margin:"8px 2px 0"}}, t("st_theme_season_hint"))),
      row("lang","🌐",t("language"),(LANGS.find(function(L){return L[0]===curLang;})||LANGS[0])[1],function(){ toggleExp("lang"); }),
      expand==="lang" && React.createElement("div",{className:"set-exp"},
        React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}},
          LANGS.map(function(L){
            return React.createElement("button",{key:L[0],onClick:function(){ CURLANG=L[0]; setS({lang:L[0]}); },style:segBtn(curLang===L[0])}, L[1]);
          })))
    ),

    // ACCESIBILIDAD (justo debajo de Apariencia): tamaño de letra, reducir animaciones, contraste.
    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_a11y")),
    grp("a11y","♿",t("v4_set_a11y"),"accesibilidad letra grande tamaño texto contraste animaciones reduce motion accessibility",t("ts_"+curTextSize),
      React.createElement("div",{style:{padding:"6px 14px 4px"}},
        React.createElement("div",{style:{fontSize:13,fontWeight:700,marginBottom:6}}, t("st_textsize")),
        React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          [["small","ts_small"],["normal","ts_normal"],["big","ts_big"],["huge","ts_huge"]].map(function(ts){
            return React.createElement("button",{key:ts[0],onClick:function(){ applyTextSize(ts[0]); setS({textSize:ts[0]}); },style:Object.assign({},segBtn(curTextSize===ts[0]),{flex:"1 1 40%"})}, t(ts[1]));
          })),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.5,marginTop:6}}, t("st_textsize_hint"))
      ),
      (function(){ const on=!!(state.settings&&state.settings.reduceMotion);
        return React.createElement(React.Fragment,null,
          row("redmo",on?"🐢":"🎞️",t("st_reduce_motion"),null,function(){ applyReduceMotion(!on); setS({reduceMotion:!on}); }, sw(on)),
          React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 10px"}}, t("st_reduce_motion_hint"))); })(),
      (function(){ const on=!!(state.settings&&state.settings.hiContrast);
        return React.createElement(React.Fragment,null,
          row("hicon",on?"🌗":"🌓",t("st_contrast"),null,function(){ applyContrast(!on); setS({hiContrast:!on}); }, sw(on)),
          React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 10px"}}, t("st_contrast_hint"))); })()
    ),

    // «Para empezar» reubicado justo bajo Apariencia/Accesibilidad (petición 2026-07-18).
    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_easy")),
    grp("easy","🍃",t("v4_set_easy"),"modo sencillo simple mode tutorial tour empezar fácil easy start",null,
      row("simple","🍃",t("st_simple_lbl"),null,function(){
        const sim=!simOn;
        setS({simpleMode:sim, tabHidden: sim?ADVANCED_TABS.slice():[], dashHidden: sim?SIMPLE_DASH_HIDDEN.slice():[]});
      }, sw(simOn)),
      React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",padding:"0 14px 10px"}}, t("st_mode_hint")),
      onTour && row("tour","🎓",t("v4_set_tour"),null,onTour)
    ),

    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_money")),
    // Dinero: moneda de visualización (ahora SÍ convierte) + comparativa + cómo se ve el total
    // de gastos. Presupuesto y bancos de gasto diario viven en Resumen / Cartera (2026-08-05).
    grp("money","💱",t("v4_set_money"),"moneda divisa currency euro dolar lira try conversor convertir comparar",t("cur_"+curCur.toLowerCase()),
      row("cur","💱",t("currency"),t("cur_"+curCur.toLowerCase()),function(){ toggleExp("cur"); }),
      expand==="cur" && React.createElement("div",{className:"set-exp"},
        React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}},
          CUR_LIST.map(function(c){
            return React.createElement("button",{key:c,onClick:function(){
              // Sin tipo la app se quedaba en € en silencio. Pedimos FX y aplicamos con los
              // rates DEVUELTOS (no solo con state): el set() de refreshFx puede ir un tick
              // detrás y applyCur(s) vería todavía el estado viejo.
              const applyCur=function(s, rates){
                const tbl=rates?Object.assign({},fxTableOf(s),rates):fxTableOf(s);
                const r=c==="EUR"?1:tbl[c];
                if(c!=="EUR"&&!(r>0)) return null;
                const patch={settings:Object.assign({},s.settings,{currency:c})};
                if(rates){
                  patch.fxRates=Object.assign({},fxTableOf(s),rates);
                  if(rates.USD>0) patch.fx=+(rates.USD.toFixed(4));
                }
                return Object.assign({},s,patch);
              };
              if(applyCur(state)){
                set(function(s){ return applyCur(s)||s; });
                showToast(t("cur_"+c.toLowerCase()));
                return;
              }
              showToast(t("fx_waiting"));
              Promise.resolve(refreshFx&&refreshFx()).then(function(rates){
                set(function(s){
                  const next=applyCur(s, rates);
                  if(!next){ showToast(t("fx_no_rate")); return s; }
                  showToast(t("cur_"+c.toLowerCase()));
                  return next;
                });
              });
            },style:Object.assign({},segBtn(curCur===c),{flex:"1 1 44%"})}, t("cur_"+c.toLowerCase()));
          })),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.5,margin:"8px 2px 0"}}, t("currency_hint"))),
      // Conversor: pantalla propia (CurConverterPanel) — ya NO es un acordeón aquí dentro.
      // Con 16 monedas (×2 listas, origen y destino) Ajustes se hacía interminable en el móvil
      // (feedback 2026-08-05). La fila solo abre la pantalla; el buscador vive allí.
      row("curcmp","🔁",t("st_cur_convert"),null,function(){ setConvOpen(true); }),
      (function(){
        const gm=(state.settings&&state.settings.gTotalMode)||"split";
        return React.createElement(React.Fragment,null,
          row("gview","🧮",t("st_gview"),t(gm==="net"?"st_gview_net":"st_gview_split"),function(){ toggleExp("gview"); }),
          expand==="gview" && React.createElement("div",{className:"set-exp"},
            [["split","st_gview_split","st_gview_split_d"],["net","st_gview_net","st_gview_net_d"]].map(function(op){
              return React.createElement("div",{key:op[0],style:{marginTop:8}},
                React.createElement("button",{onClick:function(){ setS({gTotalMode:op[0]}); },style:segBtn(gm===op[0])}, (gm===op[0]?"✓ ":"")+t(op[1])),
                React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.5,margin:"5px 2px 0"}}, t(op[2]))
              );
            })
          )
        );
      })()
    ),

    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_conn")),
    cloud.enabled() && (function(){
      const links=bankLinks;
      // Issues de la última sync también cuentan: si no, el resumen decía «3 conectados» con
      // uno caído en Cartera (rechazo 4.12.0.18). TR desconectado (tuvo teléfono, no conectado)
      // entra en nDead por su propio camino — no es Open Banking.
      const issueAsp={};
      (state.bankIssues||[]).forEach(function(is){ if(is&&is.aspsp) issueAsp[String(is.aspsp).toLowerCase()]=1; });
      const nActive=(links||[]).filter(function(r){
        if(r.status!=='active') return false;
        return !issueAsp[String(r.aspsp_name||"").toLowerCase()];
      }).length + (trConn?1:0);
      const nDeadDb=(links||[]).filter(function(r){ return r.status==='expired'||r.status==='error'||issueAsp[String(r.aspsp_name||"").toLowerCase()]; }).length;
      const trDead=trKnown&&!trConn;
      const nDead=nDeadDb + (trDead?1:0);
      let summary = links===null ? "…"
        : nActive>0 ? (tf("bp_summary_n",{n:nActive}) + (nDead?" · "+tf("bp_summary_exp",{n:nDead}):""))
        : nDead>0 ? tf("bp_summary_exp",{n:nDead})
        : ((links||[]).some(function(r){return r.status==='pending';}) ? t("bank_pending") : t("bp_summary_none"));
      if(trDead && summary.indexOf("Trade Republic")<0) summary += (summary&&summary!=="…"?" · ":"") + t("bp_summary_tr_dead");
      return grp("banks","🏦",t("bank_section"),"banco bancos bank conectar caixabank revolut sabadell trade republic myinvestor broker open banking sincronizar",summary,
        row("banks","🏦",t("bp_manage"),null,function(){ setManageBanks(true); })
      );
    })(),
    manageBanks && ReactDOM.createPortal(React.createElement(BankPanel,{state:state,set:set,showToast:showToast,uid:uid,onBankSync:onBankSync,totals:totals,onLinks:setBankLinks,fetchPrices:fetchPrices,focusAspsp:goBanksFocus,onClose:function(){ setManageBanks(false); const b=trBridge(); if(b&&b.status){ Promise.resolve(b.status()).then(function(r){ setTrConn(!!(r&&r.connected)); }).catch(function(){}); } }}), document.body),
    // (Hogar y gastos compartidos se movió FUERA de Ajustes 2026-07-18: es una funcionalidad de
    //  la app, no un ajuste. Ahora se abre desde Cartera → «Hogar y gastos compartidos».)
    !notifOk && React.createElement("div",{className:"alarmbox",style:{marginTop:14}},
      t("na_body"),
      React.createElement("button",{style:Object.assign({},btn,{marginTop:10}),onClick:function(){ const nat=natPlugin(); if(nat&&nat.openNotifAccess){ try{ nat.openNotifAccess().catch(function(){}); }catch(e){} } }},t("na_fix")),
      React.createElement("div",{style:{fontSize:11.5,lineHeight:1.5,marginTop:10,opacity:.85}}, "🔓 "+t("na_restricted"))
    ),
    (function(){
      const nat=natPlugin();
      if(!nat || !nat.setNotifPrefs) return null;
      const on=!(state.settings&&state.settings.trNotifyConfirm===false);
      const bankSyncOn=!(state.settings&&state.settings.bankSyncOnNotif===false);
      const ingOn=!!(state.settings&&state.settings.trIngest);
      const toggleIng=function(){
        if(!ingOn){
          try{ if(nat.ensureNotifPerm) nat.ensureNotifPerm().catch(function(){}); }catch(e){}
          let tok=(state.settings&&state.settings.ingestToken);
          if(!tok){
            tok=mcRandomToken();
            if(!tok){ showToast(t("st_tring_nornd")); return; }
          }
          cloud.setIngestToken(tok).then(function(){
            const url=CONFIG.SUPABASE_URL+"/functions/v1/ingest?token="+encodeURIComponent(tok);
            try{ if(nat.setIngestUrl) return nat.setIngestUrl({url:url}); }catch(e){}
          }).then(function(){
            setS({trIngest:true, ingestToken:tok}); showToast(t("st_tring_on"));
          }).catch(function(e){ showToast("✕ "+((e&&e.message)||e)); });
        } else {
          try{ if(nat.setIngestUrl) nat.setIngestUrl({url:""}).catch(function(){}); }catch(e){}
          cloud.clearIngestToken();
          setS({trIngest:false}); showToast(t("st_tring_off"));
        }
      };
      const aiOn=!!(state.settings&&state.settings.aiCat);
      return grp("notifs","🔔",t("st_notifs"),"notificaciones notifications apunte automatico gastos trade republic avisos banco sync caixabank sabadell ia ai categoria",null,
        row("tring",ingOn?"🟢":"⚪",t("st_tring"),null,toggleIng, sw(ingOn)),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 12px"}}, t("st_tring_hint")),
        row("trnotif",on?"🔔":"🔕",t("st_trnotif"),null,function(){ setS({trNotifyConfirm:!on}); }, sw(on)),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 12px"}}, t("st_trnotif_hint")),
        row("banksync",bankSyncOn?"🏦":"🔕",t("st_banksync_notif"),null,function(){ setS({bankSyncOnNotif:!bankSyncOn}); }, sw(bankSyncOn)),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 12px"}}, t("st_banksync_notif_hint")),
        row("aicat",aiOn?"✨":"⚪",t("st_aicat"),null,function(){ setS({aiCat:!aiOn}); }, sw(aiOn)),
        React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 12px"}}, t("st_aicat_hint"))
      );
    })(),

    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_app")),
    grp("news","✨",t("st_news"),"novedades news version sugerencias feedback historial whatsnew","v"+CONFIG.APP_VERSION,
      row("news","✨",t("st_news_row"),null,function(){ setNewsOpen(true); }),
      row("fb","💬",t("st_feedback"),null,function(){ setFbOpen(true); })
    ),
    newsOpen && React.createElement(WhatsNew,{onClose:function(){ setNewsOpen(false); },showToast:showToast,set:set,state:state}),
    fbOpen && ReactDOM.createPortal(React.createElement(FeedbackPanel,{state:state,set:set,showToast:showToast,onClose:function(){ setFbOpen(false); }}), document.body),
    natPlugin() && grp("updates","⬇️",t("st_updates"),"actualizar update version apk buscar widget",
      apkVer ? tf("st_ver_both",{w:CONFIG.APP_VERSION,a:apkVer}) : tf("st_ver_web",{v:CONFIG.APP_VERSION}),
      row("upd","⬇️",t("st_update"),
        apkVer ? tf("st_ver_both",{w:CONFIG.APP_VERSION,a:apkVer}) : ("v"+CONFIG.APP_VERSION),
        checkUpdates),
      React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 12px"}}, t("st_widget_hint"))
    ),
    /* IMPORTACIONES, todas juntas (2026-08-04, petición suya). Antes estaban repartidas: la hoja de
       Excel dentro de «Copia de seguridad» —donde nadie la buscaría— y el histórico del banco
       escondido en «Mis bancos», al final de la lista. Son la misma tarea («traerme lo que ya tengo
       en otro sitio»), así que viven en el mismo sitio. El histórico sigue accesible también desde
       «Mis bancos», que es donde estaba y donde tiene sentido justo tras conectar un banco. */
    grp("import","📥",t("st_imports"),"importar import excel hoja csv gastos historico banco extracto",null,
      row("imphoja","📗",t("ih_title"),null,function(){ setHojaOpen(true); }),
      row("imphist","🏦",t("bp_hist_btn"),null,function(){ setHistOpen(true); })
    ),
    /* COPIA DE SEGURIDAD: solo la automática. El exportar/importar JSON a mano se retiró
       (2026-08-04, petición suya: «quítame lo de importar y exportar datos dado que ya hay el
       automático») — la copia diaria se guarda sola en la nube y se restaura desde aquí, así que el
       fichero manual era una vía paralela que además podía sobrescribir el estado entero de golpe. */
    cloud.enabled() && uid && grp("backup","🗄️",t("backup"),"copia seguridad backup restaurar automatica",null,
      row("autoback","🕐",t("bk_auto_title"),null,function(){ setAutoBackOpen(true); })
    ),
    cloud.enabled() && uid && grp("account","👤",t("st_account"),"cuenta privacidad borrar delete privacy huella biometria fingerprint cerrar sesion logout salir",null,
      meEmail && React.createElement("div",{style:{padding:"0 16px 10px",fontSize:12.5,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, meEmail),
      // Huella y cerrar sesión volvieron aquí (2026-07-18): con el rediseño solo existían
      // dentro del AuthPanel, al que ya no se llegaba estando logueado.
      bio.supported()
        ? row("biolock","🔐",(bioOn?t("au_bio_off"):t("au_bio_on")).replace(/^[^ ]+ /,""),null,toggleBio, sw(bioOn))
        : React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 10px"}}, t("au_nobio")),
      row("signout","🚪",t("au_signout"),null,doSignOut),
      row("priv","🔒",t("st_privacy"),null,function(){ setPrivOpen(true); }),
      row("delacc","🗑️",t("st_delete_acc"),null,function(){
        askConfirm({ title:t("st_delete_acc"), sub:t("st_delete_acc_sub"), ok:t("st_delete_acc_ok"), danger:true })
          .then(function(ok){
            if(!ok) return;
            askText({ title:t("st_delete_acc_pwd"), sub:t("st_delete_acc_pwd_sub"), ph:"••••••••", ok:t("st_delete_acc_ok"), secret:true })
              .then(function(pwd){
                if(pwd==null) return;
                cloud.deleteAccount(String(pwd)).then(function(){
                  showToast(t("st_delete_acc_done"));
                  onClose();
                }).catch(function(e){ showToast("✕ "+((e&&e.message)||e)); });
              });
          });
      })
    ),

    React.createElement("div",{className:"v4-set-sec"}, t("v4_set_adv")),
    grp("custom","🎛️",t("v4_set_adv"),"avanzado advanced pestañas tabs vista gastos bloques blocks informe report customise",null,
      // («Personalizar widgets del Resumen» se retiró el 2026-07-18: era del Dashboard v3.)
      row("tabs","✎",t("et_tabs").replace("✎ ",""),null,function(){ toggleExp("tabs"); }),
      expand==="tabs" && React.createElement("div",{className:"set-exp"},(function(){
        const order=tabOrderOf(state);
        const hidden=TABS.map(function(tb){return tb.id;}).filter(function(id){ return order.indexOf(id)<0; });
        const moveTab=function(id,dir){ set(function(s){ const o=tabOrderOf(s); const i=o.indexOf(id), j=i+dir; if(i<0||j<0||j>=o.length) return s; const n=o.slice(); n[i]=o[j]; n[j]=id; return Object.assign({},s,{settings:Object.assign({},s.settings,{tabOrder:n})}); }); };
        const hideTab=function(id){ if(id==="dash") return; set(function(s){ const hid=tabHiddenOf(s); const nh=hid.indexOf(id)<0?hid.concat([id]):hid; const ord=tabOrderOf(s).filter(function(x){return x!==id;}); return Object.assign({},s,{settings:Object.assign({},s.settings,{tabHidden:nh, tabOrder:ord})}); }); showToast(t("tb_removed")); };
        const showTab=function(id){ set(function(s){ const hid=tabHiddenOf(s).filter(function(x){return x!==id;}); const ord=tabOrderOf(s).concat([id]); return Object.assign({},s,{settings:Object.assign({},s.settings,{tabHidden:hid, tabOrder:ord})}); }); };
        const rowBtn={width:34,height:34,borderRadius:9,background:"var(--surface-2)",border:"1px solid var(--line)",color:"var(--muted)",fontSize:13,cursor:"pointer",flex:"0 0 auto"};
        return React.createElement("div",{style:{marginTop:8}},
          React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.5,marginBottom:10}}, t("et_intro")),
          order.map(function(id,i){
            const tb=TABS.find(function(x){return x.id===id;}); if(!tb) return null;
            const fixed=(id==="dash");
            return React.createElement("div",{key:id,style:{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",borderRadius:11,background:"var(--surface-2)",border:"1px solid var(--line)",marginBottom:7}},
              React.createElement("span",{style:{color:"var(--muted)",display:"flex"}}, React.createElement(tb.icon,{width:16,height:16})),
              React.createElement("span",{style:{flex:1,fontWeight:700,fontSize:14,color:"var(--text)"}}, t("tab_"+id)),
              React.createElement("button",{disabled:i===0,onClick:function(){ moveTab(id,-1); },style:Object.assign({},rowBtn,{opacity:i===0?0.35:1})}, "▲"),
              React.createElement("button",{disabled:i===order.length-1,onClick:function(){ moveTab(id,1); },style:Object.assign({},rowBtn,{opacity:i===order.length-1?0.35:1})}, "▼"),
              fixed
                ? React.createElement("span",{style:{fontSize:10.5,color:"var(--muted-2)",width:34,textAlign:"center",flex:"0 0 auto"}}, t("et_fixed"))
                : React.createElement("button",{onClick:function(){ hideTab(id); },style:Object.assign({},rowBtn,{color:"var(--coral)",borderColor:"var(--coral)"})}, "✕")
            );
          }),
          hidden.length>0 && React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",margin:"12px 2px 6px"}}, t("et_hidden")),
          hidden.map(function(id){
            const tb=TABS.find(function(x){return x.id===id;}); if(!tb) return null;
            return React.createElement("button",{key:id,onClick:function(){ showTab(id); },style:{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 11px",borderRadius:11,background:"var(--surface-2)",border:"1px dashed var(--line)",color:"var(--text)",fontWeight:700,fontSize:14,marginBottom:7,cursor:"pointer"}},
              React.createElement("span",{style:{color:"var(--mint)",fontSize:16,fontWeight:800}}, "+"),
              React.createElement("span",{style:{color:"var(--muted)",display:"flex"}}, React.createElement(tb.icon,{width:16,height:16})),
              React.createElement("span",null, t("tab_"+id)));
          })
        );
      })()),
      (function(){
        const on=!!(state.settings&&state.settings.blocksEdit);
        return row("blocks","🧩",t("st_blocks"),null,function(){ setS({blocksEdit:!on}); }, sw(on));
      })(),
      React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 10px"}}, t("st_blocks_hint")),
      totals && row("report","📸",t("rp_btn").replace(/^[^ ]+ /,""),null,function(){ shareMonthReport(state, totals, showToast); })
    ),

    // Admin al FINAL (fuera del flujo diario). Sentry de prueba quitado: no aporta en móvil.
    // Sin traducir a propósito: es la consola privada del dueño, como «Actividad».
    isAdmin && React.createElement(React.Fragment,null,
      React.createElement("div",{className:"v4-set-sec"}, "Dev"),
      React.createElement("div",{className:"set-card",style:{borderColor:"var(--blue)"}},
        React.createElement("div",{className:"sc-title"},"👁 Actividad"),
        row("act","📡","Quién usa la app y sus errores",events?String(events.length):null,function(){ setActOpen(true); if(events===null) loadEvents(); })
      ),
      /* ── ENTORNO DE PRUEBAS (petición 2026-07-24) ──────────────────────────────────────────
         Dos cosas distintas, a propósito:
           · Canal beta  → QUÉ versión recibe ESTE móvil. En beta te llegan las versiones antes de
             publicarlas en Pages, así puedes probarlas antes de que le lleguen a tu padre y a tu
             pareja (ellos siguen en estable, que sale de `main` y no se toca).
           · Banco de pruebas → CON QUÉ DATOS trabajas. Copia de tu cartera en otra clave local y
             cero escrituras en la nube: rompe lo que quieras, no sale de este móvil.
         Solo lo ve el dueño (profiles.is_admin), que es lo que pedía: «solamente para mí». */
      React.createElement("div",{className:"set-card",style:{borderColor:"var(--blue)"}},
        React.createElement("div",{className:"sc-title"},"🧪 Pruebas"),
        (function(){
          const beta=(typeof mcChannel==="function") && mcChannel()==="beta";
          return React.createElement(React.Fragment,null,
            row("chan", beta?"🚧":"📦", beta?"Canal: BETA (pruebas)":"Canal: estable", null, function(){
              askConfirm({
                title: beta?"¿Volver al canal estable?":"¿Pasar este móvil al canal beta?",
                sub: beta
                  ? "Dejarás de recibir las versiones de prueba. La próxima actualización será la publicada para todos."
                  : "Solo ESTE móvil recibirá las versiones de prueba (bundle.zip / apk.json de la release «beta»). Tu padre y tu pareja se quedan en la estable. Si aún no hay ninguna beta publicada, se sigue actualizando con la estable.",
                ok: beta?"Volver a estable":"Activar beta",
              }).then(function(yes){
                if(!yes) return;
                mcSetChannel(beta?"stable":"beta");
                showToast(beta?"📦 Canal estable":"🚧 Canal beta activado");
                setS({});   // repinta Ajustes para que la fila refleje el canal nuevo
                // Y se instala YA lo que toque en el canal nuevo, arriba o abajo: apagar la beta
                // tiene que devolver el móvil a lo que usa el resto (feedback 2026-07-26).
                if(window._mcApplyChannelBundle) window._mcApplyChannelBundle({showToast:showToast});
              });
            }, sw(beta)),
            React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 10px"}},
              // El canal SOLO manda en la app Android: en el navegador la versión la sirve Pages
              // (= main = producción) y el OTA de Capgo ni existe. Decirlo aquí evita quedarse
              // esperando una beta que no puede llegar (confusión real del 2026-07-24).
              (typeof _mcNative!=="undefined" && !_mcNative)
                ? "⚠ Estás en el navegador: aquí el canal no hace nada, la beta solo llega a la app Android."
                : (beta?"Este móvil recibe las versiones antes que nadie.":"Este móvil recibe lo mismo que el resto de la familia.")),
            // «Code review» pero probando la app: la checklist sale de las notas de esta versión.
            // Solo tiene sentido estando en beta — en estable no hay nada que aprobar.
            beta && (function(){
              const pack=betaChecklist(CONFIG.APP_VERSION, prodVer);
              const c=betaMarksCount(pack);
              // Con la versión ya subida a producción la fila deja de cantar «3/8» — ese contador
              // se leía como trabajo pendiente cada vez que abría Ajustes, y no lo era (2026-07-28).
              if(yaEnProd) return row("betarev","🔍","Revisar esta beta","✅ ya en producción", function(){ setBetaOpen(true); });
              return row("betarev","🔍","Revisar esta beta", c.tot?(c.n+"/"+c.tot):null, function(){ setBetaOpen(true); });
            })(),
            (function(){
              // La bandera CRUDA: Ajustes pinta el estado que tendrá la PRÓXIMA sesión, que es lo
              // que el interruptor cambia. El resto de la app usa mcSandbox() (fijado al arrancar).
              const sandbox=(typeof mcSandboxFlag==="function") && mcSandboxFlag();
              return React.createElement(React.Fragment,null,
                row("sbx", sandbox?"🧪":"🏦", sandbox?"Banco de pruebas: DENTRO":"Banco de pruebas", null, function(){
                  if(sandbox){
                    askConfirm({ title:"¿Salir del banco de pruebas?", sub:"Vuelves a tu cartera real. La de pruebas se queda guardada por si quieres seguir otro día.", ok:"Salir a mi cartera real" })
                      .then(function(yes){ if(!yes) return; mcExitSandbox(); location.reload(); });
                  }else{
                    askConfirm({ title:"¿Entrar al banco de pruebas?", sub:"Se copia tu cartera actual a un espacio aparte. Dentro NO se escribe nada en la nube: puedes trastear a gusto y tu cartera real (y la de tu padre y tu pareja) no se entera.", ok:"Entrar a probar" })
                      .then(function(yes){ if(!yes) return; mcEnterSandbox(state); location.reload(); });
                  }
                }, sw(sandbox)),
                sandbox && row("sbxr","♻️","Volver a copiar mi cartera real",null,function(){
                  askConfirm({ title:"¿Empezar las pruebas de cero?", sub:"Se tira la cartera de pruebas actual y se copia otra vez la real. Tu cartera real no se toca.", ok:"Copiar de nuevo", danger:true })
                    .then(function(yes){ if(!yes) return; mcExitSandbox(); mcResetSandbox(); location.reload(); });
                }),
                React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",lineHeight:1.45,padding:"0 14px 10px"}},
                  sandbox?"Estás en datos de prueba. Nada de lo que hagas aquí sale de este móvil.":"Copia tu cartera a un espacio aparte para probar sin miedo.")
              );
            })()
          );
        })()
      )
    ),
    betaOpen && ReactDOM.createPortal(React.createElement(BetaReviewPanel,{showToast:showToast,onClose:function(){ setBetaOpen(false); }}), document.body),
    hojaOpen && ReactDOM.createPortal(React.createElement(SheetImport,{state:state,set:set,showToast:showToast,goGastos:goGastos,onClose:function(){ setHojaOpen(false); }}), document.body),
    // Sin `linkEnts`: el propio panel cae a los bancos de gasto cuando no se le pasa lista (ver
    // `allowList` en BankHistoryImport). Desde «Mis bancos» sí se le pasan los enlaces vivos.
    histOpen && ReactDOM.createPortal(React.createElement(BankHistoryImport,{state:state,set:set,showToast:showToast,onClose:function(){ setHistOpen(false); }}), document.body),
    autoBackOpen && ReactDOM.createPortal(React.createElement(AutoBackupsPanel,{state:state,set:set,showToast:showToast,uid:uid,onClose:function(){ setAutoBackOpen(false); }}), document.body),
    actOpen && ReactDOM.createPortal(React.createElement(ActivityPanel,{events:events,onReload:loadEvents,onClose:function(){ setActOpen(false); }}), document.body),
    privOpen && ReactDOM.createPortal(React.createElement(PrivacyPanel,{onClose:function(){ setPrivOpen(false); }}), document.body),
    convOpen && ReactDOM.createPortal(React.createElement(CurConverterPanel,{state:state,refreshFx:refreshFx,onClose:function(){ setConvOpen(false); }}), document.body),

    (function(){ const nq=normQ(q).trim(); return (nq&&grpMatches===0)?React.createElement("div",{className:"hint",style:{marginTop:14,textAlign:"center"}},t("st_search_none")):null; })(),
    // El canal y las DOS versiones (OTA + APK) se cantan en el pie: si el icono no cambia,
    // aquí se ve al momento si sigues en una APK vieja aunque la web ya esté al día (2026-07-26).
    React.createElement("div",{style:{textAlign:"center",color:"#5E7468",fontSize:"12px",marginTop:"22px"}},
      "Mi Cartera · "+(apkVer
        ? tf("st_ver_both",{w:CONFIG.APP_VERSION,a:apkVer})
        : ("v"+CONFIG.APP_VERSION))+((typeof mcChannel==="function"&&mcChannel()==="beta")?" · 🚧 beta":""))
  );

}

/* ============================================================
   ONBOARDING — bienvenida para usuarios nuevos (arranque vacío)
   ============================================================ */
/* Onboarding v4 (SPEC §8): 3 pasos claros — claim, demo gastos, presupuesto con stepper.
   Saltar marca onboarded con presupuesto por defecto; cuentas/deudas se añaden luego en Cartera/Plan. */
function Onboarding({set, onCloud, onSignup}){
  const [step,setStep]=useState(0);
  const [budget,setBudget]=useState(700);
  const wrap={position:"fixed",inset:0,zIndex:90,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 20px) 22px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto",position:"relative"};
  const finish=function(b){
    const bud=Math.max(100, Math.round(b||budget)||700);
    // Base, no el sello con sufijo de compilación — mismo criterio que el popup de Novedades
    // (ver comentario en 11-app-main.js, bug 2026-08-05) para que un usuario que se da de alta
    // EN BETA no se lleve el popup de Novedades en la siguiente compilación sin haber nada nuevo.
    try{ localStorage.setItem("_seenVersion",mcVerBase(CONFIG.APP_VERSION)); }catch(e){}
    set(function(s){
      return Object.assign({},s,{
        budget:bud, monthStartNet:0, history:[0],
        onboarded:true, setupHint:true, tourSeen:false,
      });
    });
  };
  const skip=function(){ finish(budget); };
  const dots=React.createElement("div",{className:"v4-ob-dots"},
    [0,1,2].map(function(i){ return React.createElement("span",{key:i,className:i===step?"on":""}); }));
  const skipBtn=React.createElement("button",{type:"button",className:"v4-ob-skip",onClick:skip},t("v4_ob_skip"));
  const cta={width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(160deg,var(--mint-hi),var(--mint))",color:"var(--on-mint)",fontWeight:800,fontSize:"15.5px",cursor:"pointer",marginTop:22,boxShadow:"0 14px 28px -10px rgba(95,208,138,.45)"};

  if(step===0) return React.createElement("div",{style:wrap},React.createElement("div",{style:inner},
    skipBtn,
    React.createElement("div",{className:"v4-ob-logo"},React.createElement(I.logo,{width:36,height:36})),
    React.createElement("h1",{className:"serif v4-ob-title"},t("v4_ob_title1")),
    React.createElement("p",{className:"v4-ob-sub"},t("v4_ob_sub1")),
    onCloud && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:18},onClick:onCloud},t("ob_haveacc")),
    onSignup && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:onSignup},t("ob_signup")),
    React.createElement("button",{style:cta,onClick:function(){ setStep(1); }},t("ob2_go")+" →"),
    dots
  ));

  if(step===1) return React.createElement("div",{style:wrap},React.createElement("div",{style:inner},
    skipBtn,
    React.createElement("h1",{className:"serif v4-ob-title"},t("v4_ob_title2")),
    React.createElement("p",{className:"v4-ob-sub"},t("v4_ob_sub2")),
    React.createElement("div",{className:"v4-mov rise",style:{animationDelay:".12s",marginTop:22}},
      React.createElement("div",{className:"tile",style:{background:"rgba(95,208,138,.12)"}},"🛒"),
      React.createElement("div",{className:"nm"},React.createElement("div",null,t("v4_ob_demo1")),React.createElement("div",{className:"meta"},"Hoy")),
      React.createElement("div",{className:"am num"},"42,18 €")
    ),
    React.createElement("div",{className:"v4-mov rise",style:{animationDelay:".22s"}},
      React.createElement("div",{className:"tile",style:{background:"rgba(226,192,95,.12)"}},"☕"),
      React.createElement("div",{className:"nm"},React.createElement("div",null,t("v4_ob_demo2")),React.createElement("div",{className:"meta"},"Ayer")),
      React.createElement("div",{className:"am num"},"2,40 €")
    ),
    React.createElement("button",{style:cta,onClick:function(){ setStep(2); }},t("ob2_next")+" →"),
    dots
  ));

  return React.createElement("div",{style:wrap},React.createElement("div",{style:inner},
    skipBtn,
    React.createElement("h1",{className:"serif v4-ob-title",style:{fontSize:28}},t("ob2_budget_t")),
    React.createElement("p",{className:"v4-ob-sub"},t("ob2_budget_d")),
    React.createElement("div",{className:"v4-ob-stepper"},
      React.createElement("button",{type:"button","aria-label":"−",onClick:function(){ setBudget(function(b){ return Math.max(100,b-50); }); }},"−"),
      React.createElement("div",{className:"serif num"}, eur0(budget)),
      React.createElement("button",{type:"button","aria-label":"+",onClick:function(){ setBudget(function(b){ return b+50; }); }},"+")
    ),
    React.createElement("button",{style:cta,onClick:function(){ finish(budget); }},tf("v4_ob_start",{x:budget})),
    dots
  ));
}

/* ============================================================
   TAB: COMPARTIDO — gastos compartidos por grupos/eventos (crucero con la pareja).
   Quién paga, cómo se reparte, y quién debe a quién. Sirve de "sobre" del evento.
   ============================================================ */
// Balances de un grupo: neto por persona (+ le deben / − debe) y liquidación mínima (quién paga a quién).
function sharedBalances(g){
  const people=(g&&g.people)||[];
  const bal={}; people.forEach(function(p){ bal[p]=0; });
  ((g&&g.expenses)||[]).forEach(function(e){
    const amt=e.amount||0; if(!amt) return;
    const parts=(e.parts&&e.parts.length)?e.parts:people; if(!parts.length) return;
    const share=amt/parts.length;
    bal[e.payer]=(bal[e.payer]||0)+amt;
    parts.forEach(function(p){ bal[p]=(bal[p]||0)-share; });
  });
  Object.keys(bal).forEach(function(k){ bal[k]=+bal[k].toFixed(2); });
  const cred=[], deb=[];
  Object.keys(bal).forEach(function(k){ if(bal[k]>0.005)cred.push({name:k,amt:bal[k]}); else if(bal[k]<-0.005)deb.push({name:k,amt:-bal[k]}); });
  cred.sort(function(a,b){return b.amt-a.amt;}); deb.sort(function(a,b){return b.amt-a.amt;});
  const settle=[]; let i=0,j=0;
  while(i<deb.length&&j<cred.length){ const pay=Math.min(deb[i].amt,cred[j].amt); settle.push({from:deb[i].name,to:cred[j].name,amount:+pay.toFixed(2)}); deb[i].amt-=pay; cred[j].amt-=pay; if(deb[i].amt<0.005)i++; if(cred[j].amt<0.005)j++; }
  return {bal:bal, settle:settle, total:+(((g&&g.expenses)||[]).reduce(function(a,e){return a+(e.amount||0);},0)).toFixed(2)};
}

// uid:userId — renombrado al destructurar (2026-07-18): el prop (id del USUARIO) sombreaba al
// generador global uid() y crear un grupo/gasto compartido reventaba con «uid is not a function».
function Shared({state, set, uid:userId, totals, showToast, meEmail}){
  const groups=state.shared||[];
  const [openId,setOpenId]=useState(null);
  const [addingG,setAddingG]=useState(false);
  const [gForm,setGForm]=useState({name:"",emoji:"🧳",p1:"Yo",p2:""});
  const [addingE,setAddingE]=useState(false);
  const [eForm,setEForm]=useState({desc:"",amount:"",payer:"",parts:[]});
  const [newPerson,setNewPerson]=useState("");
  const SH_EMOJIS=["🧳","🛳️","🏖️","🏠","🎉","🍽️","🚗","⛷️","🎟️","👫"];

  const upd=function(id,fn){ set(function(s){ return Object.assign({},s,{shared:(s.shared||[]).map(function(g){ return g.id===id?fn(g):g; })}); }); };
  const addGroup=function(){
    const ppl=[gForm.p1||"Yo"]; if(gForm.p2&&gForm.p2.trim()) ppl.push(gForm.p2.trim());
    const g={id:uid(),name:gForm.name||t("sh_newdefault"),emoji:gForm.emoji||"🧳",people:ppl,expenses:[]};
    set(function(s){ return Object.assign({},s,{shared:(s.shared||[]).concat([g])}); });
    setGForm({name:"",emoji:"🧳",p1:"Yo",p2:""}); setAddingG(false); setOpenId(g.id);
  };
  const delGroup=function(id){
    askConfirm({ title:t("sh_delgroup_q"), ok:t("sh_delgroup"), danger:true }).then(function(yes){
      if(!yes) return;
      set(function(s){ return Object.assign({},s,{shared:(s.shared||[]).filter(function(g){return g.id!==id;})}); }); setOpenId(null);
    });
  };
  const addPerson=function(g){ const nm=(newPerson||"").trim(); if(!nm||g.people.indexOf(nm)>=0) return; upd(g.id,function(x){ return Object.assign({},x,{people:x.people.concat([nm])}); }); setNewPerson(""); };
  const startAddE=function(g){ setEForm({desc:"",amount:"",payer:g.people[0]||"",parts:g.people.slice()}); setAddingE(true); };
  const addExpense=function(g){
    const amt=parseFloat(String(eForm.amount).replace(',','.'))||0; if(amt<=0) return;
    const parts=(eForm.parts&&eForm.parts.length)?eForm.parts:g.people.slice();
    const ex={id:uid(),desc:eForm.desc||t("sh_exp"),amount:+amt.toFixed(2),payer:eForm.payer||g.people[0],parts:parts,date:new Date().toISOString()};
    upd(g.id,function(x){ return Object.assign({},x,{expenses:[ex].concat(x.expenses||[])}); });
    setAddingE(false);
  };
  const delExpense=function(g,eid){ upd(g.id,function(x){ return Object.assign({},x,{expenses:(x.expenses||[]).filter(function(e){return e.id!==eid;})}); }); };
  const toggleParts=function(p){ setEForm(function(f){ const has=f.parts.indexOf(p)>=0; return Object.assign({},f,{parts:has?f.parts.filter(function(x){return x!==p;}):f.parts.concat([p])}); }); };

  const open=groups.find(function(g){return g.id===openId;});

  if(open){
    const bb=sharedBalances(open);
    return React.createElement("div",null,
      React.createElement("button",{className:"sh-back",onClick:function(){ setOpenId(null); setAddingE(false); }},"‹ "+t("sh_back")),
      React.createElement("div",{className:"total-bar"},
        React.createElement("div",null,React.createElement("div",{className:"tl"}, open.emoji+" "+open.name),React.createElement("div",{className:"tn num"},eur(bb.total))),
        React.createElement("div",{className:"cnt"}, open.people.length+" "+t("sh_people"))
      ),
      // Balances / quién debe a quién
      React.createElement("div",{className:"card",style:{padding:"14px 16px"}},
        React.createElement("div",{className:"gm-sec-h"}, t("sh_balances")),
        bb.settle.length===0
          ? React.createElement("div",{className:"hint"}, t("sh_settled"))
          : bb.settle.map(function(st,i){ return React.createElement("div",{key:i,className:"sh-settle"},
              React.createElement("span",null, React.createElement("b",null,st.from), " → ", React.createElement("b",null,st.to)),
              React.createElement("span",{className:"num sh-owe"}, eur(st.amount))); })
      ),
      // Personas
      React.createElement("div",{className:"card",style:{padding:"14px 16px",marginTop:12}},
        React.createElement("div",{className:"gm-sec-h"}, t("sh_people_h")),
        React.createElement("div",{className:"sh-people"}, open.people.map(function(p){ return React.createElement("span",{key:p,className:"sh-chip"}, p+" · "+eur0(bb.bal[p]||0)); })),
        React.createElement("div",{className:"af-row",style:{marginTop:8}},
          React.createElement("input",{className:"af-in",placeholder:t("sh_addperson_ph"),value:newPerson,onChange:function(e){ setNewPerson(e.target.value); }}),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:"0 0 auto"},onClick:function(){ addPerson(open); }},"+"))
      ),
      // Gastos del grupo
      React.createElement("div",{className:"card",style:{padding:"14px 16px",marginTop:12}},
        React.createElement("div",{className:"gm-sec-h"}, t("sh_expenses")),
        (open.expenses||[]).length===0 && React.createElement("div",{className:"hint"}, t("sh_noexp")),
        (open.expenses||[]).map(function(e){ return React.createElement("div",{key:e.id,className:"sh-exp"},
          React.createElement("div",{className:"sh-exp-mid"},
            React.createElement("div",{className:"sh-exp-desc"}, e.desc),
            React.createElement("div",{className:"sh-exp-meta"}, tf("sh_paidby",{who:e.payer})+" · "+((e.parts&&e.parts.length)||open.people.length)+" "+t("sh_people"))),
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
            React.createElement("span",{className:"num",style:{fontWeight:700}}, eur(e.amount)),
            React.createElement("button",{className:"ex-del",onClick:function(){ delExpense(open,e.id); }},"✕"))
        ); }),
        addingE
          ? React.createElement("div",{className:"add-form",style:{marginTop:10}},
              React.createElement("input",{className:"af-in",placeholder:t("sh_exp_ph"),value:eForm.desc,onChange:function(e){ setEForm(Object.assign({},eForm,{desc:e.target.value})); }}),
              React.createElement("div",{className:"af-row"},
                React.createElement("input",{className:"af-in num",inputMode:"decimal",placeholder:"0,00 €",value:eForm.amount,onChange:function(e){ setEForm(Object.assign({},eForm,{amount:e.target.value})); }}),
                React.createElement("select",{className:"af-in",value:eForm.payer,onChange:function(e){ setEForm(Object.assign({},eForm,{payer:e.target.value})); }}, open.people.map(function(p){ return React.createElement("option",{key:p,value:p},p); }))),
              React.createElement("div",{className:"mlabel",style:{textAlign:"left",margin:"8px 0 4px"}}, t("sh_split")),
              React.createElement("div",{className:"sh-parts"}, open.people.map(function(p){ const on=eForm.parts.indexOf(p)>=0; return React.createElement("button",{key:p,type:"button",className:"sh-part"+(on?" on":""),onClick:function(){ toggleParts(p); }}, p); })),
              React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:10},onClick:function(){ addExpense(open); }}, t("sh_addexp")),
              React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setAddingE(false); }}, t("sh_cancel")))
          : React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:10},onClick:function(){ startAddE(open); }}, "+ "+t("sh_addexp"))
      ),
      React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:12,color:"#E2705F"},onClick:function(){ delGroup(open.id); }}, t("sh_delgroup"))
    );
  }

  // Vista de lista de grupos
  return React.createElement("div",null,
    React.createElement(HogarSection,{state:state,totals:totals,uid:userId,showToast:showToast,meEmail:meEmail}),
    React.createElement("div",{className:"gm-sec-h",style:{margin:"8px 0 10px"}}, t("sh_groups_title")),
    groups.length===0 && !addingG && React.createElement("div",{className:"empty"},
      React.createElement("div",{className:"ttl"}, t("sh_empty_t")), t("sh_empty_d")),
    groups.map(function(g){ const bb=sharedBalances(g); return React.createElement("div",{key:g.id,className:"card sh-card",onClick:function(){ setOpenId(g.id); }},
      React.createElement("span",{className:"sh-emoji"}, g.emoji||"🧳"),
      React.createElement("div",{style:{flex:1,minWidth:0}},
        React.createElement("div",{className:"sh-name"}, g.name),
        React.createElement("div",{className:"sh-sub"}, eur(bb.total)+" · "+g.people.length+" "+t("sh_people")+(bb.settle.length?(" · "+tf("sh_pending",{n:bb.settle.length})):" · "+t("sh_settled_short")))),
      React.createElement("span",{className:"sh-arrow"}, "›")
    ); }),
    addingG
      ? React.createElement("div",{className:"add-form",style:{marginTop:12}},
          React.createElement("input",{className:"af-in",placeholder:t("sh_name_ph"),value:gForm.name,onChange:function(e){ setGForm(Object.assign({},gForm,{name:e.target.value})); }}),
          React.createElement("div",{className:"emoji-pick",style:{marginTop:8}}, SH_EMOJIS.map(function(em){ return React.createElement("button",{key:em,type:"button",className:(gForm.emoji===em?"on":""),onClick:function(){ setGForm(Object.assign({},gForm,{emoji:em})); }}, em); })),
          React.createElement("div",{className:"af-row",style:{marginTop:8}},
            React.createElement("input",{className:"af-in",placeholder:t("sh_you"),value:gForm.p1,onChange:function(e){ setGForm(Object.assign({},gForm,{p1:e.target.value})); }}),
            React.createElement("input",{className:"af-in",placeholder:t("sh_other_ph"),value:gForm.p2,onChange:function(e){ setGForm(Object.assign({},gForm,{p2:e.target.value})); }})),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:10},onClick:addGroup}, t("sh_create")),
          React.createElement("button",{className:"btn btn-ghost btn-block",onClick:function(){ setAddingG(false); }}, t("sh_cancel")))
      : React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:12},onClick:function(){ setAddingG(true); }}, React.createElement(I.plus,{width:16,height:16}), t("sh_newgroup"))
  );
}

/* Airbag: si cualquier render revienta, en vez de pantalla en blanco muestra
   una pantalla de recuperación con BACKUP descargable (lee localStorage directo,
   independiente del estado roto) + recargar. Dinero real ⇒ nunca dejar al usuario tirado. */
class ErrorBoundary extends React.Component{
  constructor(props){ super(props); this.state={err:null}; }
  static getDerivedStateFromError(err){ return {err:err}; }
  componentDidCatch(err,info){
    try{ console.error("App crash:",err,info); }catch(e){}
    // telemetría solo-admin: el crash viaja a app_events para poder ayudar en remoto
    try{ cloud.logEvent('error','CRASH: '+((err&&err.message)||String(err)), ((err&&err.stack)||'')+(info&&info.componentStack?'\n'+info.componentStack.slice(0,600):'')); }catch(e){}
    mcCaptureError(err, {componentStack: info&&info.componentStack});
  }
  render(){
    if(!this.state.err) return this.props.children;
    const wrap={position:"fixed",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:13,padding:24,textAlign:"center",background:"#0B1410",color:"#E8F0EB",fontFamily:"Manrope,sans-serif",zIndex:9999};
    const btn={padding:"13px 22px",borderRadius:14,border:"none",background:"#5FD08A",color:"#06120C",fontWeight:800,fontSize:15,cursor:"pointer"};
    const btn2=Object.assign({},btn,{background:"transparent",border:"1px solid #2a3a31",color:"#E8F0EB"});
    const dl=function(){ try{ const data=JSON.stringify(mcLoadRaw(mcStateKey())||{},null,2); const url=URL.createObjectURL(new Blob([data],{type:"application/json"})); const a=document.createElement("a"); a.href=url; a.download="mi-cartera-backup-"+new Date().toISOString().slice(0,10)+".json"; a.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000); }catch(e){ alert("Export error: "+e); } };
    return React.createElement("div",{style:wrap},
      React.createElement("div",{style:{fontSize:46}},"🛟"),
      React.createElement("div",{style:{fontWeight:800,fontSize:21,fontFamily:"Fraunces,serif"}}, t("eb_title")),
      React.createElement("div",{style:{color:"#9fb3a8",fontSize:14,maxWidth:340,lineHeight:1.5}}, t("eb_msg")),
      React.createElement("button",{style:btn,onClick:dl}, t("eb_export")),
      React.createElement("button",{style:btn2,onClick:function(){ try{ location.reload(); }catch(e){} }}, t("eb_reload")),
      React.createElement("div",{style:{color:"#5a6b62",fontSize:11,maxWidth:340,marginTop:6,wordBreak:"break-word"}}, String((this.state.err&&this.state.err.message)||this.state.err||""))
    );
  }
}

