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
    React.createElement("div",{style:{fontWeight:700,fontSize:"22px",fontFamily:"Fraunces, serif"}},"Aely"),
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
function BankHistoryImport({state, set, showToast, onClose, linkEnts, bankLinks}){
  const expEnts=expenseBankEnts(state);
  const allowList=(linkEnts&&linkEnts.length)? linkEnts : expEnts;
  const allow={}; allowList.forEach(function(e){ allow[e]=1; });
  const banksLbl=allowList.map(function(e){ return entOf(e).label; }).join(", ");
  const [months,setMonths]=useState(3);
  const [loading,setLoading]=useState(false);
  const [cands,setCands]=useState(null);
  const [sel,setSel]=useState({});       // índice -> bool
  const [dest,setDest]=useState({});     // índice -> "gasto"|"recibo"|"ingreso"
  const [classRows,setClassRows]=useState([]);  // salida de histClassifyCandidates
  const [signSuspect,setSignSuspect]=useState({});
  const [truncWarn,setTruncWarn]=useState(false);
  const [readWarnings,setReadWarnings]=useState([]);
  const [readFailed,setReadFailed]=useState(false);
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
  // Tope de DOM (§7 bis / plan P): con 3 meses el lote puede ser cientos; pintarlas todas
  // tiran WebView. Se muestran las primeras y el resto a demanda.
  const HIST_RENDER_CAP=60;
  const [renderCap,setRenderCap]=useState(HIST_RENDER_CAP);
  useBackClose(true, onClose);
  const kOf=function(dt,am,mc){ return String(dt).slice(0,10)+"|"+am+"|"+(mc||""); };
  // Fallback si aún no hay clasificación (híbrido C: NUNCA recibo a ciegas).
  const defDest=function(x){ return x.kind==="in" ? "ingreso" : "gasto"; };
  const search=function(){
    if(!allowList.length){ showToast(t("bp_hist_nodaily")); return; }
    setLoading(true); setCands(null); setReadWarnings([]); setReadFailed(false);
    setBankFilter([]); setTipoFilter("all"); setMesFilter("all"); setRevelado(0);
    setRenderCap(HIST_RENDER_CAP); setTruncWarn(false); setSignSuspect({}); setClassRows([]);
    const d=new Date(); d.setMonth(d.getMonth()-months); const dateFrom=d.toISOString().slice(0,10);
    cloud.bankSyncHistory(dateFrom).then(function(res){
      if(!res || !Array.isArray(res.links)) throw new Error("bank_read_failed");
      setReadWarnings(bankReadWarnings(res.links, bankLinks));
      // Flatten compartido con la sonda (Codex 10/9): un solo pipeline, con card/entKey/merchant.
      const flat=histFlattenHistoryLinks(res, state.expenses, allow, {
        merchantIn:t("cat_ingreso"), merchantOut:"Compra"
      });
      const out=flat.out;
      // Truncado del servidor o del banco: avisamos en preview (agujero F).
      // Nota Codex: minDate>dateFrom NO prueba truncado (puede no haber movs el día 1).
      const trunc=!!(res&&(res.truncated||res.truncatedAt));
      setTruncWarn(trunc);
      // Clasificador puro (tanda 1): dups 1:1, modeled por mes, cats traspaso/inversion, signo.
      const classified=histClassifyCandidates(out, state);
      setClassRows(classified.rows||[]);
      setSignSuspect(classified.signSuspect||{});
      setCands(out);
      const s0={}, d0={};
      out.forEach(function(x,i){
        const c=classified.rows&&classified.rows[i];
        d0[i]=(c&&c.defDest)||defDest(x);
        // Híbrido C: recibo NUNCA es default — solo si el usuario lo marca a mano.
        if(d0[i]==="recibo") d0[i]="gasto";
        /* «puede que ya lo tengas» sale DESMARCADO igual que el repetido exacto: la fecha del
           banco baila ±1 dia en las compras con tarjeta y sin comercio no hay mas pistas, asi que
           lo que se le ofrece es una sospecha, no un veredicto. Marcarlo el es un clic. */
        s0[i]=!(c&&(c.status==="dup"||c.status==="maybe"));
      });
      setSel(s0); setDest(d0);
      // Sonda (c): contadores sobre out+classRows REALES (no reclasificar otro conjunto).
      try{
        const probe=histDupProbe({
          out:out, classRows:classified.rows||[], expenses:state.expenses||[],
          stats:flat.stats, res:res, dateFrom:dateFrom
        });
        if(typeof window!=="undefined") window.__histDupProbe=probe;
        showToast(tf("bp_hist_probe",{
          bank:probe.bankReported,
          llegan:probe.llegan,
          nuevos:probe.nuevos,
          ya:probe.coincideDayAmt
        }));
        /* Y LA SONDA TAMBIEN VIAJA (2026-09-12). Hasta hoy solo salia en un aviso de pantalla y
           en `window.__histDupProbe`, asi que para saber que le pasa habia que pedirle a el que
           leyera el aviso a tiempo y lo copiara. Su rechazo del 12/9 —«los que salen que no son
           repetidos si que lo son»— es exactamente lo que mide `coincideDayAmt`: candidatos
           marcados NUEVOS que ya tenian una fila con el mismo dia e importe. Sin el numero real
           de SU movil solo se puede adivinar, y aqui adivinar sale caro.
           ⚠ Lo que viaja son CONTADORES mas las dos fechas del rango pedido (`dateFrom` y la
           mas antigua que llego), que hacen falta para distinguir «el banco no lo mando» de «el
           banco lo truncó». NI UN comercio, NI UN importe, NI UN banco. Es la misma linea que
           separa `logUso` de un `logEvent` libre, y se respeta. */
        try{ cloud.logEvent("hist", "sonda "+probe.llegan+" llegan / "+probe.nuevos+" nuevos / "+probe.coincideDayAmt+" coinciden dia+importe",
          JSON.stringify(probe)); }catch(_e2){}
      }catch(_e){ /* sonda no tumba el import */ }
    }).catch(function(){ setReadFailed(true); setCands([]); }).finally(function(){ setLoading(false); });
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
  /* El «puede que ya lo tengas» cuenta con los repetidos, no con los nuevos: `nuevosCount` sale
     de restar, y lo que tiene que decir es CUANTAS se van a importar si no toca nada. Meterlas en
     nuevos le daria otra vez el susto del «92 nuevos» estando ya apuntadas. La diferencia entre
     «lo tienes» y «puede que lo tengas» la dice la etiqueta de cada fila, que es donde decide. */
  const repCount=visible.filter(function(o){ const c=classRows[o.i]; return c&&(c.status==="dup"||c.status==="maybe"); }).length;
  const nuevosCount=visible.length-repCount;
  const signBanks=Object.keys(signSuspect||{}).filter(function(ent){
    return signSuspect[ent] && visible.some(function(o){ return o.x.ent===ent; });
  });
  // Nunca pintar el slug aspsp:… (entOf cae a label=id). Prioriza entLabel del banco.
  const histBankLabel=function(xOrEnt){
    if(xOrEnt && typeof xOrEnt==="object"){
      if(xOrEnt.entLabel) return xOrEnt.entLabel;
      const id=xOrEnt.ent;
      if(id && typeof ENT!=="undefined" && ENT[id]) return ENT[id].label;
      return t("bp_hist_bank_unknown");
    }
    const id=xOrEnt;
    if(id && typeof ENT!=="undefined" && ENT[id]) return ENT[id].label;
    const hit=(visible||[]).find(function(o){ return o.x.ent===id; });
    if(hit&&hit.x.entLabel) return hit.x.entLabel;
    return t("bp_hist_bank_unknown");
  };
  const visibleShown=visible.slice(0, renderCap);
  /* Las filas entran de una en una — mismo efecto que el import de Excel (petición 2026-07-28).
     El tope (24) evita una espera eterna con lotes grandes: al llegar, el RESTO debe llevar
     `dentro` de golpe. Sin eso, `.hist-fila` se queda en `opacity:0` para siempre (feedback
     10/9: «a mitad está todo negro» y «ver 35 más, le doy y no pasa nada»). El «Ver más» solo
     sube `renderCap`; si `revelado` ya pasó el tope, las filas nuevas nacen visibles. */
  const HIST_ANIM_TOPE=24;
  useEffect(function(){
    if(!cands) return undefined;
    const tope=Math.min(HIST_ANIM_TOPE, Math.min(renderCap, cands.length));
    if(revelado>=tope) return undefined;
    const tm=setTimeout(function(){ setRevelado(function(n){ return n+1; }); }, revelado===0?90:34);
    return function(){ clearTimeout(tm); };
  },[cands,revelado,renderCap]);
  const runImport=function(){
    if(!cands || !selCount) return;
    setImporting(true);
    const expAdds=[], reciboIdx=[];
    const batchId="hist-"+(typeof mcExpenseId==="function"?mcExpenseId():String(Date.now()));
    visible.forEach(function(o){
      const i=o.i, x=o.x;
      if(!sel[i]) return;
      const d=dest[i]||defDest(x);
      const c=classRows[i];
      // Los «Recibo» se apuntan y se agrupan DESPUÉS (FIN-02): tres meses del mismo recibo
      // marcados a la vez tienen que crear UN Fijo, no tres. Ver `histFijosFromSelection`.
      if(d==="recibo"){ reciboIdx.push(i); return; }
      if(d==="ingreso"){
        const cat=(c&&c.defDest==="ingreso"&&c.category)?c.category:"ingreso";
        const e={ id:mcExpenseId(), date:new Date(x.date+"T12:00:00").toISOString(), merchant:x.merchant, amount:-Math.abs(x.amount), category:cat, source:"ob-hist", ent:x.ent, noCard:true, income:true, importBatchId:batchId };
        if(x.id) e.extId=x.id;
        const nti=cleanNote(x.note, e.merchant); if(nti) e.note=nti;
        expAdds.push(e); return;
      }
      // Gasto: categoria del clasificador (incl. inversion) — nunca applyInvestBuy aqui.
      // `categoryOfNewMerchant` y no `autoCategory`: el cajero solo se detecta en ALTAS
      // NUEVAS, nunca desde la migracion que recategoriza el historico (tanda 6).
      const cat=(c&&c.category)||categoryOfNewMerchant(x.merchant||"");
      const e={ id:mcExpenseId(), date:new Date(x.date+"T12:00:00").toISOString(), merchant:x.merchant, amount:Math.abs(x.amount), category:cat, source:"ob-hist", ent:x.ent, importBatchId:batchId };
      if(x.id) e.extId=x.id;
      const nt=cleanNote(x.note, e.merchant); if(nt) e.note=nt;
      expAdds.push(e);
    });
    const fixAdds=histFijosFromSelection(cands, reciboIdx, { mkId:uid, name:t("bp_hist_recibo"), dayOf:recDay });
    // Tanda 3: batch + RETURNING id. Solo lo ACK queda en local; sin ids → aviso claro.
    Promise.resolve(cloud.addExpensesBatch ? cloud.addExpensesBatch(expAdds) : { cloudIds:[], offline:true })
      .catch(function(){ return { cloudIds:[], offline:false, failed:true }; })
      .then(function(res){
        const offline=!!(res&&res.offline);
        const failed=!!(res&&res.failed);
        const ack=histApplyBatchAck(expAdds, (res&&res.cloudIds)||[], { offline:offline });
        // Servidor llamado y 0 ids con candidatos: no persistimos en local (sin ACK).
        const keepLocal=offline ? ack.kept : (failed ? [] : ack.kept);
        set(function(s){
          const next=Object.assign({},s);
          if(keepLocal.length) next.expenses=keepLocal.concat(s.expenses||[]);
          if(fixAdds.length) next.fixed=(s.fixed||[]).concat(fixAdds);
          if(keepLocal.length){
            next.lastHistImport={ batchId:batchId, localIds:keepLocal.map(function(e){ return e.id; }), cloudIds:offline?[]:ack.cloudIds, at:Date.now() };
          }
          return next;
        });
        const parts=[];
        if(keepLocal.filter(function(e){ return e.amount>0; }).length) parts.push(tf("bp_hist_done_g",{n:keepLocal.filter(function(e){ return e.amount>0; }).length}));
        if(keepLocal.filter(function(e){ return e.amount<0; }).length) parts.push(tf("bp_hist_done_i",{n:keepLocal.filter(function(e){ return e.amount<0; }).length}));
        if(fixAdds.length) parts.push(tf("bp_hist_done_r",{n:fixAdds.length}));
        if(failed || (!offline && expAdds.length && !ack.cloudIds.length)){
          showToast("⚠ "+t("bp_hist_no_ack"));
        }else if(!offline && ack.skipped.length){
          showToast((parts.length?parts.join(" · ")+" · ":"")+tf("bp_hist_skip_dup",{n:ack.skipped.length}));
        }else if(offline && expAdds.length){
          showToast((parts.length?parts.join(" · ")+" · ":"")+t("bp_hist_offline"));
        }else{
          showToast(parts.length?parts.join(" · "):tf("bp_hist_done",{n:keepLocal.length+fixAdds.length}));
        }
        setImporting(false); onClose();
      });
  };
  const doUndoLast=function(){
    const last=state&&state.lastHistImport;
    if(!last||!last.batchId){ showToast("⚠ "+t("bp_hist_undo_empty")); return; }
    askConfirm({ title:t("bp_hist_undo_title"), sub:t("bp_hist_undo_sub"), ok:t("bp_hist_undo_ok"), danger:true })
      .then(function(yes){
        if(!yes) return;
        const ids=(last.cloudIds||[]).slice();
        // Confirmar puede tardar: un pull o una notificación ya habrán cambiado el estado.
        // Guardar el reintento ANTES de la red permite recuperarlo incluso si Android nos mata.
        set(function(s){
          const r=histUndoBatch(s,last);
          return Object.assign({}, r.nextState, { lastHistImport:s.lastHistImport&&s.lastHistImport.batchId===last.batchId
            ? (ids.length?Object.assign({},last,{cloudPending:true}):null) : s.lastHistImport });
        });
        if(!ids.length){
          if((last.localIds||[]).length) showToast("⚠ "+t("bp_hist_undo_local_only"));
          else showToast(t("bp_hist_undo_done"));
          return;
        }
        /* EL BORRADO EN LA NUBE HAY QUE ESPERARLO (review de Cursor, 8/9). Iba a fuego y olvido
           con un `.catch` vacío y el toast de «hecho» salía igual. Y como el undo NO escribe
           lápidas —a propósito, agujero B— lo ÚNICO que impide que esas filas vuelvan es que la
           nube las haya borrado de verdad: si el DELETE fallaba, el siguiente pull se las
           devolvía y él veía reaparecer lo que acababa de deshacer, con un ✓ en la pantalla.
           Decirle «si vuelve, avísame» es pasarle a él un defecto nuestro. */
        if(!cloud.deleteExpensesByIds){ showToast("⚠ "+t("bp_hist_undo_cloud_fail")); return; }
        Promise.resolve().then(function(){ return cloud.deleteExpensesByIds(ids); })
          .then(function(){
            set(function(s){
              // Un pull durante el DELETE puede haber devuelto las filas: quitar solo esos ids.
              const r=histUndoBatch(s,last);
              return Object.assign({},r.nextState,{lastHistImport:s.lastHistImport&&s.lastHistImport.batchId===last.batchId?null:s.lastHistImport});
            });
            showToast(t("bp_hist_undo_done"));
          })
          .catch(function(){
            // El lote sigue guardado con cloudPending; no pisar una importación posterior.
            showToast("⚠ "+t("bp_hist_undo_cloud_fail"));
          });
      });
  };
  const doImport=function(){
    if(!cands || !selCount) return;
    // Cuenta los Fijos que se van a crear DE VERDAD, ya agrupados (FIN-02): marcar tres meses del
    // mismo recibo crea UNO, así que el diálogo no puede seguir diciendo «¿Crear 3 recibos fijos?».
    const reciboSel=visible.filter(function(o){ return sel[o.i] && (dest[o.i]||defDest(o.x))==="recibo"; }).map(function(o){ return o.i; });
    const nRecibo=histFijosFromSelection(cands, reciboSel, { mkId:uid, name:t("bp_hist_recibo"), dayOf:recDay }).length;
    if(nRecibo>0){
      askConfirm({
        title:tf("bp_hist_confirm_fijos",{n:nRecibo}),
        sub:t("bp_hist_confirm_fijos_sub"),
        ok:t("bp_hist_confirm_fijos_ok"),
        danger:true
      }).then(function(yes){ if(yes) runImport(); });
      return;
    }
    runImport();
  };
  const canUndo=histCanUndo(state);
  const wrap={position:"fixed",inset:0,zIndex:97,overflowY:"auto",background:"var(--bg)",color:"var(--text)",padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};
  const chip=function(n){ const on=months===n; return React.createElement("button",{key:n,onClick:function(){ setMonths(n); },style:{flex:1,padding:"9px 0",borderRadius:10,border:"1px solid "+(on?"var(--mint)":"var(--line)"),background:on?"var(--mint)":"var(--surface)",color:on?"#06120C":"var(--text)",fontWeight:800,fontSize:13,cursor:"pointer"}}, tf("bp_hist_m",{n:n})); };
  const bigBtn={width:"100%",padding:"14px",borderRadius:14,border:"none",background:"var(--mint)",color:"#06120C",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:12};
  const destChip=function(i,id,label,hint){
    const on=(dest[i]||"")==id;
    // `data-dest`/`data-cand`: las filas se pintan con estilos en linea y sin clase, asi que un
    // e2e solo podia apuntar por posicion. Con esto se marca la fila EXACTA (mismo patron que
    // `data-ent` en Mis bancos). Sin coste de render.
    return React.createElement("button",{key:id,type:"button",onClick:function(e){ e.stopPropagation(); setDestI(i,id); },
      title:hint||"", "data-dest":id, "data-cand":(cands&&cands[i]&&cands[i].id)||String(i),
      style:{padding:"4px 9px",borderRadius:999,border:"1px solid "+(on?"var(--mint)":"var(--line)"),background:on?"rgba(95,208,138,.18)":"transparent",color:on?"var(--mint)":"var(--muted)",fontWeight:800,fontSize:11,cursor:"pointer"}}, label);
  };
  const dupHint=function(c){
    if(c&&c.status==="maybe") return "🗐 "+t("bp_hist_dupmaybe");
    if(!c||c.status!=="dup") return null;
    if(c.reason==="modeled") return "🗐 "+t("bp_hist_dupmodel");
    return "🗐 "+t("bp_hist_dupexist");
  };
  return React.createElement("div",{style:wrap,className:"hist-import"}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("bp_close")),
    React.createElement("div",{className:"serif",style:{fontSize:24,margin:"4px 0 4px"}}, t("bp_hist_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:14}},
      allowList.length? tf("bp_hist_sub",{banks:banksLbl}) : t("bp_hist_nodaily")),
    canUndo && React.createElement("button",{type:"button",onClick:doUndoLast,
      style:{width:"100%",padding:"11px",borderRadius:12,border:"1px solid var(--coral)",background:"transparent",color:"var(--coral)",fontWeight:800,fontSize:13,cursor:"pointer",marginBottom:12}},
      t("bp_hist_undo_btn")),
    allowList.length>0 && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{display:"flex",gap:8,marginBottom:12}}, [1,2,3].map(chip)),
      React.createElement("button",{style:{width:"100%",padding:"12px",borderRadius:12,border:"1px solid var(--line)",background:"var(--surface)",color:"var(--text)",fontWeight:800,fontSize:14,cursor:"pointer"},disabled:loading,onClick:search}, loading?t("bp_hist_searching"):t("bp_hist_search")),
      !loading && readWarnings.map(function(w,i){ return React.createElement("div",{key:i,role:"status",className:"hint bank-read-warning",style:{marginTop:12}}, "⚠ "+tf(w.key,{bank:w.bank})); }),
      !loading && readFailed && React.createElement("div",{role:"status",className:"hint bank-read-warning",style:{marginTop:12}},t("bank_read_retry")),
      cands!==null && cands.length===0 && !loading && !readFailed && !readWarnings.length && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"20px 0"}}, t("bp_hist_none")),
      cands!==null && cands.length>0 && React.createElement("div",{style:{marginTop:14}},
        React.createElement("div",{style:{fontSize:12,color:"var(--muted-2)",marginBottom:8}}, tf("bp_hist_found",{n:visible.length})),
        truncWarn && React.createElement("div",{style:{fontSize:12,lineHeight:1.45,color:"var(--warn, #E6A23C)",background:"rgba(230,162,60,.12)",borderRadius:10,padding:"8px 10px",marginBottom:8}}, t("bp_hist_trunc")),
        signBanks.length>0 && React.createElement("div",{style:{fontSize:12,lineHeight:1.45,color:"var(--warn, #E6A23C)",background:"rgba(230,162,60,.12)",borderRadius:10,padding:"8px 10px",marginBottom:8}},
          tf("bp_hist_sign",{banks:signBanks.map(function(e){ return histBankLabel(e); }).join(", ")})),
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
          visibleShown.map(function(o,vi){
          const i=o.i, x=o.x;
          const on=!!sel[i];
          const isIn=x.kind==="in";
          const c=classRows[i];
          const isDup=!!(c&&(c.status==="dup"||c.status==="maybe"));
          const suggestRec=!!(c&&c.suggestRecibo&&!isDup);
          // Pasado el tope de animación, TODAS las pintadas (incluidas las de «Ver más») llevan
          // `dentro`. Si solo se mirara `vi<revelado`, la 25ª y siguientes quedarían invisibles.
          const animTope=Math.min(HIST_ANIM_TOPE, visibleShown.length);
          const dentro=revelado>=animTope || vi<revelado;
          return React.createElement("div",{key:i,className:"hist-fila"+(dentro?" dentro":""),style:{border:"1px solid "+(on?"var(--mint)":"var(--line)"),background:on?"var(--mint)14":"var(--surface)",borderRadius:12,marginBottom:7,padding:"10px 12px"}},
            React.createElement("button",{type:"button",onClick:function(){ toggle(i); },style:{display:"flex",alignItems:"center",gap:11,width:"100%",background:"none",border:"none",color:"inherit",cursor:"pointer",textAlign:"left",padding:0}},
              React.createElement("span",{style:{width:20,height:20,borderRadius:6,border:"2px solid "+(on?"var(--mint)":"var(--muted-2)"),background:on?"var(--mint)":"transparent",color:"#06120C",fontWeight:900,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}, on?"✓":""),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("div",{style:{fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textDecoration:(!on&&isDup)?"line-through":"none",color:(!on&&isDup)?"var(--muted-2)":undefined}}, x.merchant),
                React.createElement("div",{style:{fontSize:11,color:"var(--muted-2)",marginTop:1}}, x.date, " · ", histBankLabel(x), isIn?"":(x.card?"":" · "+t("bp_hist_notcard")), suggestRec&&!on?"":""),
                suggestRec && on ? React.createElement("div",{style:{fontSize:11,color:"var(--muted)",marginTop:1}}, t("bp_hist_suggest_recibo")) : null,
                dupHint(c) ? React.createElement("div",{style:{fontSize:11,color:"var(--muted-2)",marginTop:1}}, dupHint(c)) : null),
              React.createElement("span",{style:{fontWeight:800,fontSize:14,flexShrink:0,color:isIn?"var(--mint)":"var(--text)"}}, (isIn?"+":"")+eur(x.amount))
            ),
            on && React.createElement("div",{style:{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",paddingLeft:31}},
              !isIn && destChip(i,"gasto",t("bp_hist_as_gasto")),
              !isIn && destChip(i,"recibo",t("bp_hist_as_recibo"),t("bp_hist_confirm_fijos_sub")),
              destChip(i,"ingreso",t("bp_hist_as_ingreso"))
            )
          );
        }),
        visible.length>renderCap && React.createElement("button",{type:"button","data-hist-more":"1",onClick:function(){ setRenderCap(function(n){ return n+HIST_RENDER_CAP; }); },
          style:{width:"100%",padding:"10px",borderRadius:12,border:"1px solid var(--line)",background:"var(--surface)",color:"var(--text)",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:8}},
          tf("bp_hist_more",{n:visible.length-renderCap})),
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
  /* Y CADA VEZ QUE LA LISTA PUEDE HABER CAMBIADO (2026-09-12, suyo desde la app: «si conectas un
     banco… no te aparece hasta que no tires para atrás y vuelvas a entrar en la zona de bancos»).
     El `useEffect` de arriba corre UNA vez por `uid`: si esta pantalla ya estaba montada cuando
     vuelves de autorizar el banco, se queda con la lista de antes y la fila nueva no sale hasta
     que la cierras y la abres. `runBankSync` avisa al terminar (`mc-bank-links-changed`) y aquí
     se vuelve a leer. `loadLinks` es idempotente y ya trae su propio `catch`. */
  useEffect(function(){
    var alRefrescar=function(){ loadLinks(); };
    window.addEventListener("mc-bank-links-changed", alRefrescar);
    return function(){ window.removeEventListener("mc-bank-links-changed", alRefrescar); };
  },[uid]);
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
  /* QUITAR UN BANCO PREGUNTA QUÉ HACER CON SUS MOVIMIENTOS (decisión suya, 10/9: «opción c»).
     Su rechazo del 10/9, con sus palabras: «quité TRADE republic y se mantienen todos los gastos,
     todos los filtros y todo igual no ha cambiado nada ni ningún movimiento». Tenía razón y el
     motivo era este: quitar un banco purgaba `obAccounts` —los saldos— y NADA MÁS. Su `ent` se
     quedaba en `settings.expenseBanks`, así que sus compras seguían contando para el presupuesto
     y saliendo en los filtros. No es que no pasara nada: pasaba la mitad, y la mitad que pasaba
     no se veía por ningún sitio.
     Se le pregunta en vez de decidir por él porque las dos respuestas son razonables y la
     diferencia se mide en euros suyos:
       · «que dejen de contar» recalcula el gasto del mes —y los meses ya cerrados, porque la cifra
         se recalcula siempre desde los gastos—, así que se le dice EN EL PROPIO BOTÓN.
       · «que sigan contando» es lo de hoy: solo se corta la conexión.
     Lo que NO se ofrece, ni aquí ni en ningún sitio: borrar sus movimientos. Un banco que quitas
     no es un historial que quieras perder, y por borrados automáticos ya perdió movimientos una
     vez ([[tr-duplicados-saga]]). */
  const remove=function(name){
    const ent=entFromAspsp(name);
    /* ⚠ SI ES SU BANCO DE GASTO DIARIO, «que dejen de contar» NO SE PUEDE CUMPLIR, y ofrecerlo
       sería mentirle. `expenseBankEnts` añade SIEMPRE el `ent` de la cuenta diaria, quitarlo de
       `expenseBanks` o no: la cuenta diaria es su cartera, y sus compras cuentan por definición.
       Lo cazó el e2e —yo lo había dado por hecho— así que en ese caso se ofrece solo lo que sí
       es verdad, y se le dice dónde se cambia el banco del día a día. */
    const esDiario=!!(state.accounts||[]).find(function(a){ return accDaily(a) && a.ent===ent; });
    askChoice({
      title:tf("bp_rm_title",{bank:bankLabel(name)}),
      sub:esDiario ? t("bp_rm_sub_diario") : t("bp_rm_sub"),
      options: esDiario
        ? [{v:"keep", label:t("bp_rm_keep"), sub:t("bp_rm_keep_diario_sub")}]
        : [{v:"keep", label:t("bp_rm_keep"), sub:t("bp_rm_keep_sub")},
           {v:"stop", label:t("bp_rm_stop"), sub:t("bp_rm_stop_sub")}]
    }).then(function(elige){
      if(!elige) return;
      setBusy(name);
      cloud.bankDisconnect(name).then(function(){
        setConfirming("");
        // Si el banco tenía una cuenta con rol en Cartera, se le dice qué pasa con ella: SALE de
        // Cartera, y sus movimientos se quedan enteros en Gastos (ver el `set` de abajo).
        const teniaCuenta=!!(state.accounts||[]).find(function(a){ return a && a.ent===ent && a.bankIban; });
        showToast(tf(teniaCuenta?"bp_removed_acc":"bp_removed",{bank:bankLabel(name)}));
        set(function(s){
          const ob=(s.obAccounts||[]).filter(function(o){ return String(o.aspsp||"").toLowerCase()!==String(name||"").toLowerCase(); });
          var next=s;
          if(ob.length!==(s.obAccounts||[]).length) next=Object.assign({},next,{obAccounts:ob});
          /* ⚠ Y LAS CUENTAS PROMOCIONADAS. Esto solo purgaba `obAccounts`, pero una cuenta que se
             promocionó para darle un rol (`promoteObAccount`) vive en `state.accounts` con su
             `bankIban`. Al quitar el banco se quedaba en Cartera → Tus cuentas tan pancha, con la
             chapita «del banco» y el último saldo congelado. Él lo vio con CaixaBank: «se me
             ocurre ir a cartera para ver si ya no estaba el banco quitado y adivina, estaba».

             La primera versión de esto (4.19.63) le quitaba solo el `bankIban` y dejaba la cuenta,
             por no borrar nada automáticamente. Se lo enseñé y decidió lo contrario, que es lo que
             hay ahora: **«si quito un banco, se va fuera, y ya con las decisiones lógicamente que
             me dejaste»**. Tiene sentido: si quitas el banco, esa cuenta ya no es tuya en la app.

             LO QUE SIGUE SIN BORRARSE, Y NO SE NEGOCIA: sus MOVIMIENTOS. Se quedan enteros en
             `expenses` con su banco, así que reconectar lo deja como estaba y el histórico no se
             pierde. Por borrados automáticos ya perdió movimientos una vez ([[tr-duplicados-saga]]).
             Qué hacen esos movimientos con el presupuesto es justo lo que se le acaba de preguntar
             arriba (`keep` / `stop`). */
          if(ent){
            const accs=(next.accounts||[]);
            const quedan=accs.filter(function(a){ return !(a && a.ent===ent && a.bankIban); });
            if(quedan.length!==accs.length) next=Object.assign({},next,{accounts:quedan});
          }
          /* Solo si lo ha pedido, y solo sacándolo de la lista de gasto diario: los gastos siguen
             enteros en `expenses` con su banco, así que volver a conectarlo lo deja como estaba. */
          if(elige==="stop" && ent){
            const eb=(((next.settings||{}).expenseBanks)||[]).filter(function(e){ return e!==ent; });
            next=Object.assign({},next,{settings:Object.assign({},next.settings||{},{expenseBanks:eb})});
          }
          /* El disconnect ya borró la fila en la nube; sin esto el banner de Cartera (y el
             silencio del «✓ al día») siguen con el `pending` viejo hasta el próximo sync. */
          const bi=dropBankIssue(next.bankIssues, name);
          if(bi!==next.bankIssues) next=Object.assign({},next,{bankIssues:bi});
          return next;
        });
        loadLinks();
      }).catch(function(e){ showToast("⚠ "+((e&&e.message)||e)); }).finally(function(){ setBusy(""); });
    });
  };

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
              /* «Actualizar TODOS», no «Actualizar saldo» (2026-09-12, reportado por él desde la
                 app: «si actualizo saldo de un banco… de manera individual, por ejemplo Trade
                 Republic, no me dice nada que se ha actualizado correctamente»). El botón vive
                 dentro de la ficha de UN banco, así que prometía sincronizar ese; por dentro
                 llama a `refresh()` → `onBankSync()`, que los sincroniza TODOS y no sabe filtrar.
                 Se cambia el texto, que es lo honesto y lo barato; sincronizar de uno en uno
                 pide cambiar `runBankSync` entero y no es lo que él pidió.
                 ⚠ Lo que le faltaba —el «✓ al día»— NO se arregla aquí: se calla mientras quede
                 un banco con la conexión a medias (`bankIssuesOf` mira las filas `pending`), y
                 eso vive en la tanda del banco que se quedó pendiente. */
              React.createElement("button",{style:Object.assign({},mb,{opacity:busy?0.6:1}),disabled:!!busy,onClick:refresh}, busy==="__sync"?t("bp_syncing"):t("bank_refresh")),
              React.createElement("button",{style:Object.assign({},mb,{opacity:busy?0.6:1}),disabled:!!busy,onClick:function(){ connect(l.aspsp_name, l.aspsp_country||"ES"); }}, noAcct?t("bp_retry_link"):t("bank_reconnect")),
              React.createElement("button",{style:Object.assign({},mb,{opacity:busy?0.6:1,color:"var(--muted)",flex:"0 0 auto"}),disabled:!!busy,onClick:function(){ setConfirming(l.aspsp_name); }}, t("bp_remove"))))
      );
    }),
    React.createElement("button",{style:bigBtn,onClick:openPicker}, "+ "+t("bp_add")),
    /* «También apuntar gastos de tarjeta» fuera de aquí (2026-09-11): Conectar cuentas es solo
       bancos. El rol Recibos / Gasto diario / Todo vive en Cartera → editar cuenta, y
       `pickRole` ya escribe `expenseBanks`. Dejar los chips aquí era una segunda puerta del
       mismo ajuste (su «lo de bancos que sea solo para bancos»). */
    /* Histórico del banco: solo Ajustes → Importaciones (tanda 4 / plan K). Aquí ensuciaba
       «Mis bancos» y duplicaba la puerta. */
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
    // bp_foot fuera 2026-09-11: decía que TR no está en OB y ya sí puede; sobraba.
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
  /* UNA VERSION SIN NADA QUE PROBAR NO PUEDE VACIARLE EL PANEL (2026-09-12).
     Sin `prodVersion` (aun preguntando, o sin red) la ronda es UNA sola version. El dia que la
     que corre es fontaneria —guardianes, un arreglo de despliegue— declara `tandas:[]` a
     proposito. Si se coge `n.v===base` a pelo, `betaTandas` devuelve CERO y el panel se queda
     vacio con media ronda sin juzgar detras (medido en review de 4.19.86: checklist(V,null)→0).
     Se prefiere la entrada de esa base SOLO si tiene algo que probar; si no, la mas nueva que
     SI tenga. El fallback final (`RELEASE_NOTES[0]`) solo cubre el caso extremo de que no quede
     ninguna con puntos — entonces el vacio es honesto.
     ⚠ `tandas:[]` (lista vacia) y «sin `tandas`» siguen siendo cosas distintas: la segunda
     resucita la version entera como una tanda «todo», y eso lo vigila `beta-tandas-vacias`. */
  var conAlgoQueProbar=function(n){ return !!n && (!n.tandas || n.tandas.length>0); };
  if(!conProd){
    var one=RELEASE_NOTES.filter(function(n){ return n.v===base && conAlgoQueProbar(n); })[0]
      || RELEASE_NOTES.filter(conAlgoQueProbar)[0]
      || RELEASE_NOTES.filter(function(n){ return n.v===base; })[0]
      || RELEASE_NOTES[0];
    round=one?[one]:[];
  }else{
    var prod=mcVerBase(prodVersion);
    round=RELEASE_NOTES.filter(function(n){
      return n&&n.v && mcIsNewer(n.v, prod) && !mcIsNewer(n.v, base);
    });
  }
  if(!round.length){
    var fb=RELEASE_NOTES.filter(function(n){ return n.v===base && conAlgoQueProbar(n); })[0]
      || RELEASE_NOTES.filter(conAlgoQueProbar)[0]
      || RELEASE_NOTES.filter(function(n){ return n.v===base; })[0]
      || RELEASE_NOTES[0];
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
/* ⚠ `tandas:[]` (lista VACÍA) y «sin `tandas`» NO son lo mismo, y confundirlos le resucitó a él
   tres tandas ya aprobadas (bug suyo 2026-09-08: «todo lo que probé y marqué como aprobado me
   salta otra vez»). Al aprobar una tanda se QUITA del array; si al quitar la última se borraba
   también la propiedad, esta función caía al `todo` de abajo y la versión entera volvía al panel
   como una tanda nueva sin aprobar, con otro id (`4.19.5/todo`), así que su veredicto ya no
   casaba con nada.
     · propiedad AUSENTE  → versión antigua que nunca declaró tandas (las ~70 del histórico):
       se devuelve una sola con todo dentro, como siempre.
     · array VACÍO        → declaró tandas y ya no queda ninguna por probar: CERO tandas.
   Lo vigila `tests/beta-tandas-vacias.test.mjs`. */
function betaTandas(notes){
  if(notes && notes.tandas){
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
function betaSavedVerdicts(pack, storeKey){
  const sent={};
  const marks=store.get("_betaReviewOk")||{};
  // Recuperar el último parte por tanda entre compilaciones. Solo heredar una aprobación
  // si TODOS sus textos siguen marcados: cambiar el guion exige una revisión nueva.
  const keys=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(/^_betaReview_\d+(?:\.\d+){2,3}_v$/.test(k)) keys.push(k);
    }
  }catch(e){}
  keys.sort(function(a,b){ return mcIsNewer(a.slice(12,-2),b.slice(12,-2))?1:mcIsNewer(b.slice(12,-2),a.slice(12,-2))?-1:0; });
  keys.forEach(function(k){
    const old=store.get(k)||{};
    (pack.tandas||[]).forEach(function(g){
      const id=g.id.indexOf("/")>=0?g.id:pack.v+"/"+g.id;
      if(Object.prototype.hasOwnProperty.call(old,id)) sent[g.id]=old[id];
    });
  });
  (pack.tandas||[]).forEach(function(g){
    if(sent[g.id]!=="approved" || !g.items.length || !g.items.every(function(it){ return marks[it]==="ok"||marks[it]==="na"; })) delete sent[g.id];
  });
  return Object.assign(sent,store.get(storeKey+"_v")||{});
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
/* VOLVER AL MISMO SITIO DESPUÉS DE PROBAR (2026-09-10 → 15/9).
   La otra mitad de su queja, y la que no se ve leyendo el panel: para probar un punto TIENE que
   salir de la app. Android le mata la WebView mientras paga, mira el widget o toca otra app, y al
   volver aterriza en Inicio — con Ajustes cerrado, el panel cerrado y la lista arriba del todo.
   Cinco puntos por tanda son cinco viajes de vuelta rehaciendo Ajustes → Revisar la beta → bajar.
   Con esto, si salió estando en el panel, vuelve al panel y a la misma altura.
   La marca lleva la HORA y caduca a las 2 h: salir a probar y volver es cosa de minutos; si la
   abre mañana por la mañana quiere entrar en su app, no en el panel de pruebas. Y cerrar a
   propósito (‹ Ajustes o el gesto atrás) la borra: eso SÍ es «he terminado».

   Rechazo 4.24.2 (15/9): «se abre todo el rato Ajustes». El panel, AL MONTAR, reescribía
   Date.now() → cada reapertura automática renovaba las 2 h para siempre. Ahora: (a) montar por
   reapertura NO toca la marca; (b) solo interacción real la pone/renueva; (c) como mucho UNA
   reapertura automática por marca (`_betaPanelReabierto`); (d) cerrar Ajustes o el panel, o
   enviar el último veredicto, olvida. */
const BETA_ABIERTO_KEY="_betaPanelAbierto";
const BETA_SCROLL_KEY="_betaPanelScroll";
const BETA_REABIERTO_KEY="_betaPanelReabierto";
const BETA_VUELTA_MS=2*60*60*1000;
function betaDebeReabrirse(){
  try{
    var t=parseInt(localStorage.getItem(BETA_ABIERTO_KEY)||"",10);
    if(!t || (Date.now()-t) >= BETA_VUELTA_MS) return false;
    // Una sola reapertura automática por marca: si ya se usó esta hora, aterriza en Inicio.
    if(localStorage.getItem(BETA_REABIERTO_KEY)===String(t)) return false;
    return true;
  }catch(e){ return false; }
}
function betaMarcarReabierto(){
  try{
    var t=localStorage.getItem(BETA_ABIERTO_KEY);
    if(t) localStorage.setItem(BETA_REABIERTO_KEY, t);
  }catch(e){}
}
function betaMarcarAbierto(){
  try{
    var ahora=String(Date.now());
    localStorage.setItem(BETA_ABIERTO_KEY, ahora);
    // Marca nueva → otra oportunidad de reapertura (si sale a probar de verdad).
    localStorage.removeItem(BETA_REABIERTO_KEY);
  }catch(e){}
}
function betaOlvidarVuelta(){
  try{
    localStorage.removeItem(BETA_ABIERTO_KEY);
    localStorage.removeItem(BETA_SCROLL_KEY);
    localStorage.removeItem(BETA_REABIERTO_KEY);
  }catch(e){}
}
function BetaReviewPanel({onClose, showToast}){
  /* Cerrar A PROPÓSITO borra la marca; que la app se muera por detrás, no. Esa es toda la
     diferencia entre «he terminado» y «he salido a probar». */
  const cerrarDeVerdad=function(){ betaOlvidarVuelta(); if(onClose) onClose(); };
  useBackClose(true, cerrarDeVerdad);
  const wrapRef=useRef(null);
  const scrollPuesto=useRef(false);
  // 15/9: NO setItem al montar — la reapertura automática no debe renovar las 2 h.
  /* ⚠ Y EL SCROLL SOLO NO ES INTERACCIÓN (review 16/9). Devolverlo a la misma altura hace
     `scrollTop=y`, y eso dispara `scroll` igual que si hubiera arrastrado el dedo. Con el
     `betaMarcarAbierto()` colgado del scroll a secas, CADA reapertura automática renovaba la
     marca y borraba `_betaPanelReabierto` — el mismo bucle de su rechazo de 4.24.2, solo que por
     la otra puerta. Verificado con `beta-panel-reopen`: la marca cambiaba sola al restaurar.
     Ahora la renueva el DEDO (`pointerdown`); el scroll posterior (inercia) la mantiene viva
     mientras lee, pero un scroll sin gesto previo no cuenta. */
  const gestoReal=useRef(false);
  const tocar=function(){ gestoReal.current=true; betaMarcarAbierto(); };
  const recordarScroll=function(){
    const el=wrapRef.current; if(!el) return;
    try{ localStorage.setItem(BETA_SCROLL_KEY, String(el.scrollTop)); }catch(e){}
    if(gestoReal.current) betaMarcarAbierto();
  };
  const prod=useProdVersion();
  const [notesReady,setNotesReady]=useState(!!(RELEASE_NOTES&&RELEASE_NOTES.length));
  useEffect(function(){
    var alive=true;
    ensureReleaseNotes().then(function(){ if(alive) setNotesReady(true); });
    return function(){ alive=false; };
  },[]);
  const pack=notesReady?betaChecklist(CONFIG.APP_VERSION, prod):{ v:mcVerBase(CONFIG.APP_VERSION), t:"", items:[], tandas:[] };
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
  const [sent,setSent]=useState(function(){ return betaSavedVerdicts(pack,storeKey); });
  // Lo aprobado ocupa solo su cabecera; abrirlo para consultar nunca cambia el veredicto.
  const [expanded,setExpanded]=useState({});
  /* UNO A UNO DENTRO DE LA TANDA (petición suya 2026-09-10, y no era una petición de estilo:
     «si estoy haciendo pruebas en 1, no quiero tener que bajar hasta abajo del todo para dar la
     siguiente y así sucesivamente porque si tiene 5 para probar en 1 tanda y tengo que estar
     leyendo porque no me lo aprendo todo de memoria, te lo juro que me muero»).
     El punto marcado se ENCOGE a una línea y el siguiente sin marcar se trae solo a la vista, así
     que la lista mengua según prueba y el botón de aprobar sube hacia él en vez de huir.
     ⚠ Un ✗ NUNCA se encoge: debajo tiene el «¿qué pasa exactamente?», y esconderlo sería tragarse
     lo único que hace útil un rechazo. `itemOpen` guarda solo lo que él abre A MANO para repasar,
     que manda sobre la regla automática. */
  const [itemOpen,setItemOpen]=useState({});
  const itemRefs=useRef({});
  // Pages responde después de montar el panel. Al llegar las tandas antiguas, recuperar
  // también sus marcas y partes; el primer useState solo conocía la versión más reciente.
  useEffect(function(){
    setMarks(Object.assign(heredarOk(),store.get(storeKey)||{}));
    setNotes(Object.assign(heredarNotas(),store.get(storeKey+"_n")||{}));
    setSent(betaSavedVerdicts(pack,storeKey));
  },[JSON.stringify(pack.tandas)]);
  /* Devolverlo a la MISMA altura, y solo una vez. Va atado a que las tandas estén pintadas y no
     al montaje: las notas viejas llegan de Pages después, y restaurar antes deja el scroll a
     media página o a cero porque todavía no hay contenido que recorrer. */
  useEffect(function(){
    if(scrollPuesto.current || !wrapRef.current || !pack.items.length) return;
    var y=0;
    try{ y=parseInt(localStorage.getItem(BETA_SCROLL_KEY)||"0",10)||0; }catch(e){}
    scrollPuesto.current=true;
    if(y>0) requestAnimationFrame(function(){ if(wrapRef.current) wrapRef.current.scrollTop=y; });
  },[JSON.stringify(pack.tandas), pack.items.length]);
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
  /* Traer el siguiente punto sin probar a la vista. Se hace por `ref` y no por id de DOM porque
     el panel se remonta al llegar las tandas viejas de Pages y los ids se repetirían.
     `block:"center"` a propósito: con `start` el punto queda pegado al borde de arriba y en el
     móvil se lo come la barra de estado. Si ya no queda ninguno sin probar, se lleva al botón de
     veredicto de esa tanda — que es justo el momento en que él quiere llegar abajo. */
  const traerALaVista=function(el){
    if(!el||!el.scrollIntoView) return;
    try{ el.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){ try{ el.scrollIntoView(); }catch(e2){} }
  };
  const mark=function(i,v,g){
    betaMarcarAbierto();   // tocar un punto = interacción real (15/9)
    setMarks(function(p){ const m=Object.assign({},p); if(m[i]===v) delete m[i]; else m[i]=v; save(m,null); recordarOk(m);
      // Quitar el ✗ se lleva su comentario: si ya no falla, la nota es ruido en el parte siguiente.
      if(m[i]!=="ko") recordarNota(i,"");
      /* Solo se avanza cuando el punto queda RESUELTO y encogido (✓ o «no lo puedo probar»).
         Con un ✗ se queda donde está: tiene que escribir qué falla. Y al DESmarcar tampoco se
         mueve nada, porque desmarcar es volver atrás a mirar algo. */
      if(g && (m[i]==="ok"||m[i]==="na")){
        var sig=null;
        for(var k=0;k<g.idx.length;k++){ var j=g.idx[k]; if(j!==i && !m[j]){ sig=j; break; } }
        var clave=sig!==null ? sig : "fin-"+g.id;
        // El ref se lee DENTRO del timeout: antes de repintar, el nodo del punto que se encoge
        // todavía ocupa su altura vieja y el scroll caería en el sitio equivocado.
        setTimeout(function(){ traerALaVista(itemRefs.current[clave]); },90);
      }
      return m; });
  };
  const setNote=function(i,txt){
    betaMarcarAbierto();   // escribir nota = interacción real (15/9)
    setNotes(function(p){ const n=Object.assign({},p); n[i]=txt; store.set(storeKey+"_n",n); recordarNota(i,txt); return n; });
  };

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
          /* 15/9: si ya no quedan tandas sin veredicto en esta compilación, no reabrir Ajustes. */
          var ids=grupos.length ? grupos.map(function(x){ return x.id; }) : ["todo"];
          var todas=ids.every(function(id){ return n[id]==="approved"||n[id]==="rejected"; });
          if(todas) betaOlvidarVuelta();
          return n;
        });
        // Encoger SIEMPRE al enviar, apruebe o rechace. Dejar la rechazada abierta era lo que le
        // obligaba a bajar por encima de una tanda ya juzgada para llegar a la siguiente.
        setExpanded(function(p){ return Object.assign({},p,{[g.id]:false}); });
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

  return React.createElement("div",{style:wrap,className:"beta-review",ref:wrapRef,onScroll:recordarScroll,onPointerDown:tocar},
    React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:cerrarDeVerdad}, "‹ Ajustes"),
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

    /* Dos casos distintos con la lista vacía, y decir el que no es despista (review de Cursor,
       8/9): si la versión declara `tandas` es que las aprobó TODAS —el caso normal a partir de
       ahora—; si no declara ninguna es una versión suelta sin checklist. */
    pack.items.length===0 && React.createElement("div",{style:{fontSize:13,color:"var(--muted)"}},
      pack.tandas.length===0 && (RELEASE_NOTES||[]).some(function(n){ return n && n.tandas; })
        ? "✅ No queda nada por probar: has aprobado todas las tandas de esta ronda."
        : "Esta versión no trae notas, así que no hay checklist. Prueba lo que hayas tocado."),

    /* UNA SECCIÓN POR TANDA, cada una con su veredicto (petición suya 2026-07-29).
       El punto de todo esto: que una tanda lista pueda subir HOY sin esperar a la que todavía
       tiene un fallo. Antes el botón era uno solo para la beta entera, así que un punto rojo en
       cualquier sitio bloqueaba lo demás — que es justo lo que le pasa en el trabajo cuando una
       rama se queda atrás y arrastra a las otras. */
    grupos.map(function(g){
      const c=cuenta(g.idx);
      const v=sent[g.id];
      const listo=c.pend===0 && c.ko===0;
      /* Con veredicto —APROBADA O RECHAZADA— la tanda se encoge a su cabecera. Antes solo se
         encogían las aprobadas y él lo dijo con todas las letras (2026-09-10): «las que se
         aprueban se encogen, las que se rechazan también se deberían poder encoger». Tenía razón
         y el motivo es el mismo en los dos casos: una tanda ya juzgada solo estorba entre las que
         le faltan por probar. Se sigue pudiendo abrir para repasar lo que escribió. */
      const open=expanded[g.id]!==undefined ? expanded[g.id] : !v;
      return React.createElement("div",{key:g.id,className:"beta-tanda"},
        React.createElement("button",{type:"button",className:"beta-tanda-h beta-tanda-toggle",
          "aria-expanded":open,"aria-controls":"beta-body-"+g.id,
          onClick:function(){ setExpanded(function(p){ return Object.assign({},p,{[g.id]:!open}); }); }},
          React.createElement("span",{className:"beta-tanda-t"}, g.t||t("beta_group")),
          React.createElement("span",{className:"beta-tanda-n"+(v==="approved"?" ok":v==="rejected"?" ko":"")},
            v==="approved" ? "✅ aprobada" : v==="rejected" ? "⛔ rechazada" : (c.ok+c.ko+c.na)+"/"+g.idx.length),
          React.createElement("span",{className:"beta-tanda-fold"},(open?"▾ ":"▸ ")+t(open?"beta_collapse":"beta_expand"))),
        React.createElement("div",{id:"beta-body-"+g.id,hidden:!open},
        g.idx.map(function(i,j){
          const it=g.items[j], m=marks[i];
          const borde=m==="ko"?"var(--coral)":m==="ok"?"var(--mint)":m==="na"?"var(--muted-2)":"var(--line-soft)";
          /* Resuelto = encogido. Abierto queda lo que le falta por probar y lo que falla (que
             lleva debajo el comentario), más lo que él abra a mano para repasar. */
          const resuelto=(m==="ok"||m==="na");
          const abierto=itemOpen[i]!==undefined ? itemOpen[i] : !resuelto;
          if(!abierto){
            return React.createElement("button",{key:i,type:"button",className:"beta-item beta-item-done",
              ref:function(el){ itemRefs.current[i]=el; },
              onClick:function(){ setItemOpen(function(p){ return Object.assign({},p,{[i]:true}); }); },
              style:{display:"flex",gap:9,alignItems:"center",width:"100%",textAlign:"left",cursor:"pointer",
                border:"1px solid "+borde,borderRadius:14,padding:"9px 12px",marginBottom:8,
                background:"var(--sur)",color:"var(--text)",opacity:m==="na"?0.6:0.78}},
              React.createElement("span",{style:{fontSize:13,flexShrink:0}}, m==="ok"?"✓":"—"),
              React.createElement("span",{style:{fontSize:12.5,lineHeight:1.4,flex:1,overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap"}}, it),
              React.createElement("span",{style:{fontSize:11,color:"var(--muted-2)",flexShrink:0}}, "▸"));
          }
          return React.createElement("div",{key:i,className:"beta-item",
            ref:function(el){ itemRefs.current[i]=el; },
            style:{border:"1px solid "+borde,
            borderRadius:16,padding:"12px 14px",marginBottom:10,background:"var(--sur)",opacity:m==="na"?0.72:1}},
            React.createElement("div",{style:{fontSize:13.5,lineHeight:1.5,marginBottom:10}}, it),
            // Una cruz que viene de la compilación anterior se dice, para que no parezca que la
            // acaba de poner él ni que el panel se inventa fallos. El comentario sigue debajo.
            m==="ko" && heredadas.current.ko[i] && React.createElement("div",{style:{fontSize:11.5,color:"var(--muted-2)",marginTop:-4,marginBottom:9}},
              "↩ lo marcaste en la compilación anterior · compruébalo y ponlo en ✓ si ya va"),
            React.createElement("div",{style:{display:"flex",gap:8}},
              React.createElement("button",{type:"button",style:btn(m==="ok","var(--mint)"),onClick:function(){ mark(i,"ok",g); }}, "✓ Va bien"),
              React.createElement("button",{type:"button",style:btn(m==="ko","var(--coral)"),onClick:function(){ mark(i,"ko",g); }}, "✗ Falla")),
            React.createElement("button",{type:"button",style:Object.assign({},btn(m==="na","var(--muted-2)"),{marginTop:8,width:"100%"}),
              onClick:function(){ mark(i,"na",g); }}, "— No lo puedo probar"),
            m==="ko" && React.createElement("input",{className:"v4-exp-note-in",style:{marginTop:10},
              placeholder:"¿Qué pasa exactamente?",value:notes[i]||"",
              onChange:function(e){ setNote(i,e.target.value); }}),
            /* Si lo ha abierto A MANO para repasar algo que ya dio por bueno, hace falta una
               salida: sin esto se le queda desplegado para siempre y vuelve el problema de la
               lista larga. Solo sale en ese caso, no en un punto que aún no ha probado. */
            resuelto && itemOpen[i] && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",
              style:{marginTop:10,fontSize:12.5},
              onClick:function(){ setItemOpen(function(p){ const n=Object.assign({},p); delete n[i]; return n; }); }},
              "▴ Volver a encogerlo")
          );
        }),
        // El veredicto de ESTA tanda. Con la versión ya en producción no se pide ninguno.
        // El `ref` es el destino del último ✓: probado el último punto, lo que se le trae a la
        // vista es el botón de aprobar, no un hueco.
        React.createElement("div",{ref:function(el){ itemRefs.current["fin-"+g.id]=el; }},
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
              onClick:function(){ setSent(function(p){ const n=Object.assign({},p); n[g.id]=null; store.set(storeKey+"_v",n); return n; }); }},
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
          )))
      );
    }),

    React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:14},
      onClick:function(){
        const reset={}; grupos.forEach(function(g){ reset[g.id]=null; });
        store.del(storeKey); store.del(storeKey+"_n"); store.set(storeKey+"_v",reset);
        recordarOk({}); pack.items.forEach(function(_,i){ recordarNota(i,""); });
        setMarks({}); setNotes({}); setSent(reset); setExpanded({}); setItemOpen({});
      }},
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

   TOPE EN EL BUNDLE (2026-09-09, NOTAS-BUNDLE): el histórico vive en
   `src/data/release-notes.json` y se sirve como `release-notes.json`. El index ya no lo
   arrastra. `RELEASE_NOTES_MAX` solo limita cuántas enseña Novedades de entrada — bajarlo
   NO puede vaciar el panel de beta. Subir N es cosmético; el peso lo marca el JSON. */
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
/* Cuántas versiones enseña Novedades DE ENTRADA. Ya NO recorta el panel de beta:
   las tandas viven en release-notes.json completo. Bajar este número no puede vaciarle
   la lista de cosas por probar. El test fija el valor esperado. */
var RELEASE_NOTES_MAX=20;
/* Histórico en src/data/release-notes.json (build → public/release-notes.json).
   El build deja este array vacío a propósito (gzip del index). ensureReleaseNotes()
   lo rellena desde el JSON. NO pegues el histórico entero en este módulo. */
var RELEASE_NOTES=[];
var _rnLoad=null;
function releaseNotesUrl(){
  try{
    var base=document.querySelector('base');
    if(base&&base.href) return new URL("release-notes.json", base.href).href;
  }catch(e){}
  try{ return new URL("release-notes.json", document.baseURI||location.href).href; }catch(e2){}
  return "release-notes.json";
}
/* Carga el histórico completo. Idempotente. El panel de beta y Novedades esperan a esto:
   si no, bajar RELEASE_NOTES_MAX volvería a vaciarle la checklist en silencio. */
function ensureReleaseNotes(){
  if(RELEASE_NOTES && RELEASE_NOTES.length) return Promise.resolve(RELEASE_NOTES);
  if(_rnLoad) return _rnLoad;
  _rnLoad=fetch(releaseNotesUrl(),{credentials:"same-origin"})
    .then(function(r){ if(!r||!r.ok) throw new Error("release-notes HTTP "+(r&&r.status)); return r.json(); })
    .then(function(arr){
      if(!Array.isArray(arr)||!arr.length) throw new Error("release-notes vacío");
      RELEASE_NOTES=arr;
      /* Solo la cabeza de ESTA versión (15/9): si el SW falla en avión, el panel no se queda
         vacío. No guardamos el histórico entero — cuota de localStorage. */
      try{
        var base=mcVerBase(CONFIG.APP_VERSION);
        var head=arr.filter(function(n){ return n&&n.v===base; })[0]||arr[0];
        if(head&&head.v) localStorage.setItem("_rnHead_"+base, JSON.stringify(head));
      }catch(e){}
      return RELEASE_NOTES;
    })
    .catch(function(e){
      _rnLoad=null;
      try{ console.warn("release-notes", e&&e.message||e); }catch(err){}
      try{
        var base=mcVerBase(CONFIG.APP_VERSION);
        var raw=localStorage.getItem("_rnHead_"+base);
        if(raw){
          var one=JSON.parse(raw);
          if(one&&one.v){ RELEASE_NOTES=[one]; return RELEASE_NOTES; }
        }
      }catch(err2){}
      return RELEASE_NOTES||[];
    });
  return _rnLoad;
}

/* Panel de Novedades. Se usa desde App (popup automático al estrenar versión) y desde
   Ajustes (histórico). Portal a body: sobrevive al transform del cajón de Ajustes. */
function WhatsNew({onClose, showToast, set, state}){
  useBackClose(true, onClose);
  const [notes,setNotes]=useState(function(){ return (RELEASE_NOTES||[]).slice(); });
  const [openV,setOpenV]=useState(null);
  useEffect(function(){
    var alive=true;
    ensureReleaseNotes().then(function(arr){
      if(!alive) return;
      setNotes(arr.slice());
      if(!openV && arr.length) setOpenV(arr[0].v);
    });
    return function(){ alive=false; };
  },[]);
  // (La caja de sugerencias se mudó a Ajustes → «Enviar sugerencia» el 2026-07-18: aquí
  // quedaba enterrada bajo el historial de versiones. Este popup es solo el historial.)
  const card=function(cur){ return {padding:"12px 14px",borderRadius:14,border:"1px solid "+(cur?"var(--mint)":"var(--line)"),background:"var(--surface)",marginBottom:10}; };
  const shown=notes.slice(0, RELEASE_NOTES_MAX);
  const older=notes.length>RELEASE_NOTES_MAX ? notes.slice(RELEASE_NOTES_MAX) : [];
  const [showOlder,setShowOlder]=useState(false);
  const list=showOlder ? notes : shown;
  return ReactDOM.createPortal(React.createElement("div",{className:"wn-panel"}, React.createElement("div",{className:"wn-inner"},
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 2px"}}, "✨ "+t("wn_title")),
    React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.5,marginBottom:14}}, t("wn_sub")),
    !notes.length && React.createElement("div",{style:{color:"var(--muted)",fontSize:13,marginBottom:12}}, "…"),
    list.map(function(r){
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
    older.length>0 && !showOlder && React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:4},onClick:function(){ setShowOlder(true); }},
      tf("wn_older",{n:older.length})),
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
  const adminCacheKey="_mcAdminProfile";
  const adminCached=function(id){
    if(!id) return false;
    try{
      const x=JSON.parse(localStorage.getItem(adminCacheKey)||"null");
      return !!(x&&x.uid===id&&x.isAdmin===true);
    }catch(e){ return false; }
  };
  const saveAdminCached=function(id,on){
    try{
      if(id&&on) localStorage.setItem(adminCacheKey,JSON.stringify({uid:id,isAdmin:true}));
      else localStorage.removeItem(adminCacheKey);
    }catch(e){}
  };
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
      cloud.signOut().then(function(){ saveAdminCached(null,false); showToast(t("au_signedout")); onClose(); });
    });
  };
  // Telemetría: el panel «Actividad» SOLO existe para el admin (gate por email de la sesión;
  // la RLS de app_events lo re-valida en servidor — sin sesión de admin no devuelve filas).
  // El último sí se guarda por UID: offline no se puede consultar profiles, pero tampoco debe
  // desaparecer toda la zona Dev. Es una puerta visual, no un permiso de servidor.
  const [meEmail,setMeEmail]=useState(null);
  const [isAdmin,setIsAdmin]=useState(function(){ return adminCached(uid); });
  useEffect(function(){
    const cached=adminCached(uid);
    setIsAdmin(cached);
    if(!cloud.enabled()||!uid){ return; }
    cloud.session().then(function(s){ setMeEmail((s&&s.user&&s.user.email)||null); }).catch(function(){});
    cloud.fetchProfile().then(function(p){
      const on=!!(p&&p.is_admin);
      saveAdminCached(uid,on);
      setIsAdmin(on);
    }).catch(function(){ setIsAdmin(cached); });
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
  /* El arranque pide reabrir el panel cuando salió de la app para probar un punto y Android le
     mató la WebView (ver BETA_ABIERTO_KEY). Se hace por evento y no por prop porque Ajustes se
     monta al abrir el cajón, así que quien arranca no puede pasarle nada todavía. */
  useEffect(function(){
    const h=function(){ setBetaOpen(true); };
    window.addEventListener("mc-open-beta-review",h);
    return function(){ window.removeEventListener("mc-open-beta-review",h); };
  },[]);
  const [hojaOpen,setHojaOpen]=useState(false);  // importar una hoja de gastos (Excel/CSV)
  const [histOpen,setHistOpen]=useState(false);  // importar histórico del banco (Ajustes → Importaciones)
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
        React.createElement("div",{style:{fontWeight:800,fontSize:16}}, meEmail?meEmail.split("@")[0]:"Aely"),
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
            return React.createElement("button",{key:L[0],onClick:function(){
              var lg=L[0];
              // en/ca pueden no estar en el bundle: carga el JSON antes de cambiar CURLANG
              // para no pintar un frame a medias en español (A/B idiomas, 4.19.103).
              var go=function(){ CURLANG=lg; setS({lang:lg}); };
              if(typeof ensureLangPack==="function") ensureLangPack(lg).then(go, go); else go();
            },style:segBtn(curLang===L[0])}, L[1]);
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
      // ⚠ En el banco de pruebas NO cuentes el TR nativo del móvil (11/9). La sesión de TR vive
      // en el aparato (plugin + mc_tr_phone), fuera de la cartera de pruebas. Con modo vacío
      // bankLinks ya viene cortado, pero trConn seguía sumando +1 → «1 conectado» con Mis bancos
      // vacío. En producción se sigue contando (feedback 2026-07-10).
      const enPruebas=typeof mcSandbox==="function" && mcSandbox();
      const nActive=(links||[]).filter(function(r){
        if(r.status!=='active') return false;
        return !issueAsp[String(r.aspsp_name||"").toLowerCase()];
      }).length + (!enPruebas && trConn?1:0);
      const nDeadDb=(links||[]).filter(function(r){ return r.status==='expired'||r.status==='error'||issueAsp[String(r.aspsp_name||"").toLowerCase()]; }).length;
      const trDead=!enPruebas && trKnown&&!trConn;
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
    /* IMPORTACIONES, todas juntas (2026-08-04). Desde tanda 4 el histórico vive SOLO aquí: se
       quitó el botón duplicado de «Mis bancos» (plan puertas + K). */
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
              if(yaEnProd) return row("betarev","🔍","Revisar esta beta","✅ ya en producción", function(){ betaMarcarAbierto(); setBetaOpen(true); });
              return row("betarev","🔍","Revisar esta beta", c.tot?(c.n+"/"+c.tot):null, function(){ betaMarcarAbierto(); setBetaOpen(true); });
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
                // MODO INICIAL: la app como recien instalada, dentro del banco de pruebas. Sin esto
                // no habia manera de mirar las pantallas vacias sin vaciarse la cartera de verdad.
                !sandbox && row("sbx0","🌱","Probar con la app vacía",null,function(){
                  askConfirm({ title:"¿Ver la app como recién instalada?", sub:"Entras al banco de pruebas con una cartera VACÍA y el onboarding de la primera vez. Tu cartera real no se toca y sigue esperándote al salir.", ok:"Entrar vacío" })
                    .then(function(yes){ if(!yes) return; mcSeedSandboxVacio(); mcEnterSandbox(); mcRecargarSinVolcar(); });
                }),
                sandbox && row("sbx0d","🌱","Vaciar la cartera de pruebas",null,function(){
                  askConfirm({ title:"¿Dejarla como recién instalada?", sub:"La cartera de pruebas se queda vacía y vuelve el onboarding. Tu cartera real no se toca.", ok:"Vaciar", danger:true })
                    .then(function(yes){ if(!yes) return; mcSeedSandboxVacio(); mcRecargarSinVolcar(); });
                }),
                sandbox && row("sbxr","♻️","Volver a copiar mi cartera real",null,function(){
                  askConfirm({ title:"¿Empezar las pruebas de cero?", sub:"Se tira la cartera de pruebas actual y se copia otra vez la real. Tu cartera real no se toca.", ok:"Copiar de nuevo", danger:true })
                    .then(function(yes){ if(!yes) return; mcExitSandbox(); mcResetSandbox(); mcRecargarSinVolcar(); });
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
    // Allow-list = bancos OB conectados (misma regla que antes desde Mis bancos).
    histOpen && ReactDOM.createPortal(React.createElement(BankHistoryImport,{
      state:state,set:set,showToast:showToast,onClose:function(){ setHistOpen(false); },
      bankLinks:bankLinks,
      linkEnts:(function(){
        const ents=[];
        (bankLinks||[]).forEach(function(l){
          if(!l) return;
          const e=entFromAspsp(l.aspsp_name||l.aspsp); if(e&&ents.indexOf(e)<0) ents.push(e);
        });
        return ents.length?ents:null;
      })()
    }), document.body),
    autoBackOpen && ReactDOM.createPortal(React.createElement(AutoBackupsPanel,{state:state,set:set,showToast:showToast,uid:uid,onClose:function(){ setAutoBackOpen(false); }}), document.body),
    actOpen && ReactDOM.createPortal(React.createElement(ActivityPanel,{events:events,onReload:loadEvents,onClose:function(){ setActOpen(false); }}), document.body),
    privOpen && ReactDOM.createPortal(React.createElement(PrivacyPanel,{onClose:function(){ setPrivOpen(false); }}), document.body),
    convOpen && ReactDOM.createPortal(React.createElement(CurConverterPanel,{state:state,refreshFx:refreshFx,onClose:function(){ setConvOpen(false); }}), document.body),

    (function(){ const nq=normQ(q).trim(); return (nq&&grpMatches===0)?React.createElement("div",{className:"hint",style:{marginTop:14,textAlign:"center"}},t("st_search_none")):null; })(),
    // El canal y las DOS versiones (OTA + APK) se cantan en el pie: si el icono no cambia,
    // aquí se ve al momento si sigues en una APK vieja aunque la web ya esté al día (2026-07-26).
    React.createElement("div",{style:{textAlign:"center",color:"#5E7468",fontSize:"12px",marginTop:"22px"}},
      "Aely · "+(apkVer
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
        /* LETRA PEQUEÑA DE SALIDA, Y SOLO EN INSTALACIONES NUEVAS (11/9, suyo: «pon la letra en
           pequeño para comenzar, en normal es terriblemente gigantesca»). Se pone AQUÍ, en el
           onboarding, y no como valor por defecto global: cambiarlo globalmente le reescribiría
           el tamaño a su padre y a su pareja, que ya tienen la app y no han pedido nada. Quien la
           quiera más grande la sube en Ajustes, y eso manda sobre esto. */
        settings: Object.assign({}, s.settings, { textSize:"small" }),
      });
    });
  };
  const skip=function(){ finish(budget); };
  const dots=React.createElement("div",{className:"v4-ob-dots"},
    [0,1,2].map(function(i){ return React.createElement("span",{key:i,className:i===step?"on":""}); }));
  const skipBtn=React.createElement("div",{className:"v4-ob-top"},React.createElement("button",{type:"button",className:"v4-ob-skip",onClick:skip},t("v4_ob_skip")));
  const cta={width:"100%",padding:"16px",borderRadius:"16px",border:"none",background:"linear-gradient(160deg,var(--mint-hi),var(--mint))",color:"var(--on-mint)",fontWeight:800,fontSize:"15.5px",cursor:"pointer",marginTop:22,boxShadow:"0 14px 28px -10px rgba(95,208,138,.45)"};

  if(step===0) return React.createElement("div",{style:wrap},React.createElement("div",{style:inner},
    skipBtn,
    React.createElement("div",{className:"v4-ob-lockup","aria-label":"Aely"},
      React.createElement("div",{className:"v4-ob-lockup-badge"},React.createElement(I.logo,{width:40,height:40})),
      React.createElement("div",{className:"v4-ob-word"},"Aely")
    ),
    React.createElement("h1",{className:"serif v4-ob-title"},t("v4_ob_title1")),
    React.createElement("p",{className:"v4-ob-sub"},t("v4_ob_sub1")),
    /* Las tres tarjetas del brief. Existen para decir QUÉ ES la app antes de pedirle nada, porque
       el brief es explícito en el posicionamiento: esto no es «una app de control de gastos», es
       el mapa entero del dinero. Textos literales del brief; en inglés y catalán traducida la VOZ
       y no las palabras — el brief prohíbe el copy de agencia, y el castellano copiado en en/ca ya
       es un agujero conocido (OPS-03). */
    React.createElement("div",{className:"v4-ob-cards"},
      [["c1","🗺"],["c2","⚡"],["c3","🧭"]].map(function(c){
        return React.createElement("div",{key:c[0],className:"v4-ob-card"},
          React.createElement("span",{className:"v4-ob-card-ic","aria-hidden":"true"},c[1]),
          React.createElement("div",{className:"v4-ob-card-tx"},
            React.createElement("div",{className:"v4-ob-card-t"},t("v4_ob_"+c[0]+"t")),
            React.createElement("div",{className:"v4-ob-card-s"},t("v4_ob_"+c[0]+"s"))));
      })),
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

