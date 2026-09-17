/* ============================================================
   SINCRONIZACIÓN MYINVESTOR (beta) — API no oficial.
   ============================================================
   v4.0.12: el LOGIN se hace DESDE EL MÓVIL cuando se puede (CapacitorHttp, petición nativa
   sin CORS) — el reCAPTCHA condicional (SECURITY_001) salta casi siempre desde la IP de
   datacenter de Supabase y casi nunca desde la IP residencial del usuario, que es la misma
   vía que la app oficial. Los tokens resultantes se suben a la Edge (que los VALIDA contra
   la API antes de guardar) y sync/keepalive siguen en la nube como siempre. En web (sin
   nativo) o con APK viejo sin CapacitorHttp se cae a la vía Edge de antes. La contraseña
   NUNCA se guarda en ningún caso. Trae fondos indexados / fondos / acciones. */
function miNativeHttp(){
  try{
    const cap=window.Capacitor;
    if(!(cap&&cap.isNativePlatform&&cap.isNativePlatform())) return null;
    const p=cap.Plugins&&cap.Plugins.CapacitorHttp;
    return (p&&typeof p.request==="function")?p:null;
  }catch(e){ return null; }
}
// --- reCAPTCHA de MyInvestor resuelto EN LA WEBVIEW (intento OTA) -----------------------------
// Cuando MI responde SECURITY_001 (captcha), la app oficial genera un token de reCAPTCHA v3 en la
// web de MyInvestor y lo manda en la cabecera X-Recaptcha-Token. Aquí intentamos lo mismo desde la
// WebView de la app: cargamos el script de Google reCAPTCHA con EL SITE KEY DE MYINVESTOR (que el
// usuario pega — no es accesible de otra forma) y ejecutamos la acción. EXCEPCIÓN consciente a la
// regla de cero-CDN: solo se carga bajo demanda al conectar MI (nunca en el arranque; la app sigue
// funcionando offline para todo lo demás). Puede que MI valide el dominio del token y lo rechace
// (entonces haría falta WebView nativa); esto es el intento barato antes de tocar APK.
function miRecaptchaKey(){ try{ return (localStorage.getItem("_miRcKey")||"").trim(); }catch(e){ return ""; } }
function miLoadRecaptcha(key){
  return new Promise(function(resolve){
    try{
      const gre=window.grecaptcha && (window.grecaptcha.enterprise||window.grecaptcha);
      if(gre && gre.execute){ resolve(gre); return; }
      if(document.getElementById("mi-rc-js")){
        let n=0; const iv=setInterval(function(){
          const g=window.grecaptcha && (window.grecaptcha.enterprise||window.grecaptcha);
          if(g&&g.execute){ clearInterval(iv); resolve(g); } else if(++n>20){ clearInterval(iv); resolve(null); }
        },200);
        return;
      }
      const s=document.createElement("script"); s.id="mi-rc-js"; s.async=true; s.defer=true;
      // enterprise.js cubre las dos variantes (grecaptcha.enterprise); si la clave fuera v3 normal,
      // grecaptcha (sin enterprise) también queda expuesto por este mismo script.
      s.src="https://www.google.com/recaptcha/enterprise.js?render="+encodeURIComponent(key);
      s.onload=function(){
        let n=0; const iv=setInterval(function(){
          const g=window.grecaptcha && (window.grecaptcha.enterprise||window.grecaptcha);
          if(g&&g.execute){ clearInterval(iv); resolve(g); } else if(++n>20){ clearInterval(iv); resolve(null); }
        },200);
      };
      s.onerror=function(){ resolve(null); };
      (document.head||document.documentElement).appendChild(s);
    }catch(e){ resolve(null); }
  });
}
function miSolveCaptcha(action){
  return new Promise(function(resolve){
    const key=miRecaptchaKey(); if(!key){ resolve(null); return; }
    miLoadRecaptcha(key).then(function(gre){
      if(!gre||!gre.execute){ resolve(null); return; }
      try{
        const go=function(){ gre.execute(key,{action:action||"login"}).then(function(tok){ resolve(tok||null); }).catch(function(){ resolve(null); }); };
        if(gre.ready) gre.ready(go); else go();
      }catch(e){ resolve(null); }
    });
  });
}
function miDeviceLogin(http, loginBody, devId, captchaToken){
  // Mismas cabeceras que _shared/myinvestor.ts (la API valida x-device-id y x-myinvestor-app).
  // Origin/Referer aquí SÍ se pueden fijar: la petición sale en nativo, no la limita el navegador.
  const headers={ "Content-Type":"application/json", "Accept":"application/json",
    "Referer":"https://api.myinvestor.es", "Origin":"https://api.myinvestor.es",
    // 3.150.0 (2026-07-18): el captcha salía TAMBIÉN desde el móvil («Captcha required», foto).
    // Subir la versión declarada es la primera palanca documentada: el anti-bot de MI puntúa
    // peor a clientes con versión vieja. Mantener SIEMPRE igual que _shared/myinvestor.ts.
    "x-device-id":devId, "x-myinvestor-app":"version=3.150.0,platform=web" };
  // Cuando podamos resolver el reCAPTCHA en una WebView nativa, el token viaja en estas cabeceras
  // (mismo contrato que el cliente `finanze`): X-Recaptcha-Token + acción SECURITY_CHECK. Hoy es
  // opcional y casi siempre va vacío — el plumbing queda listo para cuando exista el site key.
  if(captchaToken){ headers["X-Recaptcha-Token"]=captchaToken; headers["X-Recaptcha-Action"]="SECURITY_CHECK"; }
  return Promise.resolve(http.request({
    url:"https://api.myinvestor.es/login/api/v2/auth/token",
    method:"POST",
    headers:headers,
    data:loginBody
  })).then(function(res){
    const st=res?res.status:0; let j=res?res.data:null;
    if(typeof j==="string"){ try{ j=JSON.parse(j); }catch(e){ j={}; } }
    j=j||{};
    const d=(j.payload&&j.payload.data)||{};
    if(st===202) return { ok:true, otp:true, otpId:d.otpId||null, signatureRequestId:d.signatureRequestId||null };
    if(st===403&&j.status&&j.status.code==="SECURITY_001") return { ok:false, recaptcha:true, error:(j.status.message||"") };
    if(st===200||st===201){
      if(!d.accessToken) return { ok:false, error:"login sin token" };
      return { ok:true, tokens:{ accessToken:d.accessToken, refreshToken:d.refreshToken||null, refreshExpiresIn:Number(d.refreshExpiresIn||0) } };
    }
    return { ok:false, status:st, error:(j.status&&j.status.message)||d.message||("login HTTP "+st) };
  });
}
function MyInvestorSync({state, set, open, onToggle}){
  const [step,setStep]=useState("idle");     // idle | otp | connected | preview
  // usuario recordado (NUNCA la contraseña): reconectar tras una caducidad = solo contraseña+OTP
  const [cid,setCid]=useState(function(){ try{ return localStorage.getItem("_miCid")||""; }catch(e){ return ""; } });
  const [expired,setExpired]=useState(false);
  const [pass,setPass]=useState("");
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [otpInfo,setOtpInfo]=useState(null);
  const [positions,setPositions]=useState(null);
  const [map,setMap]=useState({});
  const [doneN,setDoneN]=useState(null);
  const [noSession,setNoSession]=useState(false);
  // Site key de reCAPTCHA de MyInvestor (lo pega el usuario): habilita el intento de resolver el
  // captcha en la WebView. Se guarda en localStorage para no volver a pedirlo.
  const [rcKey,setRcKey]=useState(function(){ try{ return localStorage.getItem("_miRcKey")||""; }catch(e){ return ""; } });
  const devRef=useRef(null);
  const deviceId=function(){
    // Mismo deviceId siempre (antes UUID nuevo → MyInvestor veía «otro móvil» y pedía captcha).
    if(devRef.current) return devRef.current;
    try{
      let d=localStorage.getItem("_miDeviceId");
      if(!d){ d=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():("mi-"+Date.now()+"-"+Math.random().toString(36).slice(2)); localStorage.setItem("_miDeviceId",d); }
      devRef.current=d; return d;
    }catch(e){ devRef.current="mi-"+Date.now(); return devRef.current; }
  };
  const adoptDeviceId=function(id){
    if(!id) return;
    try{ localStorage.setItem("_miDeviceId", String(id)); }catch(e){}
    devRef.current=String(id);
  };
  useEffect(function(){
    if(!cloud.enabled()){ setNoSession(true); return; }
    cloud.session().then(function(se){
      if(!se){ setNoSession(true); return; }
      cloud.myinvestorStatus().then(function(r){
        if(r&&r.device_id) adoptDeviceId(r.device_id);
        if(r&&r.status==="active"){ setStep("connected"); return; }
        // «expired» a veces era un falso positivo (403 anti-bot). Probamos sync suave:
        // si el token sigue vivo, reactivamos sin login ni captcha (feedback 2026-07-17).
        if(r&&r.status==="expired"){
          setExpired(true);
          cloud.myinvestorSync().then(function(res){
            if(res&&res.ok){ setExpired(false); setStep("connected"); }
          }).catch(function(){});
          return;
        }
      }).catch(function(){});
    }).catch(function(){ setNoSession(true); });
  },[]);
  const fail=function(r){ setBusy(false); const m=(r&&(r.error||r.message))||t("mi_err"); setErr(m); try{ cloud.logEvent('error','MI: '+m); }catch(e){} };
  // Éxito del login en el móvil → subir tokens (la Edge los valida contra la API antes de guardar).
  const storeTokens=function(tk){
    return cloud.myinvestorStore({ deviceId:deviceId(), accessToken:tk.accessToken, refreshToken:tk.refreshToken, refreshExpiresIn:tk.refreshExpiresIn }).then(function(r){
      setBusy(false);
      if(r&&r.connected){ try{ localStorage.setItem("_miCid",cid.trim()); }catch(e){} setExpired(false); setPass(""); setCode(""); setStep("connected"); doSync(); return; }
      fail(r);
    }).catch(fail);
  };
  const connectViaEdge=function(){
    cloud.myinvestorConnect({ customerId:cid.trim(), password:pass, deviceId:deviceId() }).then(function(r){
      setBusy(false);
      if(!r){ fail(r); return; }
      if(r.recaptcha){
        // No hay WebView para resolver captcha: pedir paciencia y NO spamear reintentos.
        // Telemetría con la VÍA usada (2026-07-18): si esto sale en Actividad, el login fue por
        // la Edge (IP datacenter) — o estás en web, o el APK no tiene CapacitorHttp. La vía
        // móvil casi nunca ve captcha; saber cuál falló es la mitad del diagnóstico.
        // El texto crudo de la API («Captcha required») no le dice nada al usuario → mensaje propio.
        setErr(t("mi_recaptcha"));
        try{ cloud.logEvent('error','MI: recaptcha vía Edge'+(miNativeHttp()?' (con nativo disponible)':' (web/APK sin CapacitorHttp)')); }catch(e){}
        return;
      }
      if(r.otp){ setOtpInfo({otpId:r.otpId, signatureRequestId:r.signatureRequestId}); setStep("otp"); return; }
      if(r.connected){ try{ localStorage.setItem("_miCid",cid.trim()); }catch(e){} setExpired(false); setStep("connected"); doSync(); return; }
      fail(r);
    }).catch(fail);
  };
  const doConnect=function(){
    if(!cid.trim()||!pass) return; setBusy(true); setErr("");
    const http=miNativeHttp();
    if(http){
      // Reintenta el login del móvil; si sale captcha y hay site key, lo resuelve en la WebView y
      // reintenta UNA vez con el token (retried evita bucle si MI lo rechaza por dominio).
      const attempt=function(captchaToken, retried){
        miDeviceLogin(http,{ customerId:cid.trim(), password:pass },deviceId(),captchaToken).then(function(r){
          if(r&&r.tokens){ storeTokens(r.tokens); return; }
          if(r&&r.otp){ setBusy(false); setOtpInfo({otpId:r.otpId, signatureRequestId:r.signatureRequestId}); setStep("otp"); return; }
          if(r&&r.recaptcha){
            if(!retried && miRecaptchaKey()){
              setErr(t("mi_solving_captcha"));
              miSolveCaptcha("login").then(function(tok){
                if(tok){ attempt(tok, true); }
                // Mensajes distintos por causa (2026-07-21: con el genérico era imposible saber si
                // falló Google o MyInvestor): sin token = Google no lo da fuera de su dominio.
                else { setBusy(false); setErr(t("mi_rc_fail_gen")); try{ cloud.logEvent('error','MI: no se pudo generar token reCAPTCHA en la WebView (¿dominio del site key?)'); }catch(e){} }
              });
              return;
            }
            setBusy(false);
            // retried = hubo token y aun así MI dijo captcha → lo rechazó él, no Google.
            setErr(retried?t("mi_rc_rejected"):t("mi_recaptcha"));
            try{ cloud.logEvent('error','MI: recaptcha'+(retried?' (token rechazado por MI — ¿dominio?)':(miRecaptchaKey()?'':' sin site key'))); }catch(e){}
            return;
          }
          setBusy(false); fail(r);
        }).catch(function(e){
          // CapacitorHttp peta → vía Edge de siempre, dejando rastro: sin esto era imposible saber
          // desde Actividad por qué un móvil con APK nuevo seguía viendo captcha (2026-07-18).
          try{ cloud.logEvent('error','MI: login nativo falló, caigo a Edge: '+((e&&e.message)||e)); }catch(_){}
          connectViaEdge();
        });
      };
      attempt(null, false);
      return;
    }
    connectViaEdge();
  };
  const otpViaEdge=function(){
    cloud.myinvestorConnect({ customerId:cid.trim(), password:pass, deviceId:deviceId(), otpId:otpInfo.otpId, signatureRequestId:otpInfo.signatureRequestId, code:code.trim() }).then(function(r){
      setBusy(false);
      if(r&&r.connected){ try{ localStorage.setItem("_miCid",cid.trim()); }catch(e){} setExpired(false); setPass(""); setCode(""); setStep("connected"); doSync(); return; }
      fail(r);
    }).catch(fail);
  };
  const doOtp=function(){
    if(code.trim().length<4||!otpInfo) return; setBusy(true); setErr("");
    const http=miNativeHttp();
    if(http){
      // El OTP debe validarse por la MISMA vía que pidió el login (mismo x-device-id e IP).
      miDeviceLogin(http,{ customerId:cid.trim(), password:pass, otpId:otpInfo.otpId, signatureRequestId:otpInfo.signatureRequestId, code:code.trim() },deviceId()).then(function(r){
        if(r&&r.tokens){ storeTokens(r.tokens); return; }
        setBusy(false); fail(r);
      }).catch(function(){ otpViaEdge(); });
      return;
    }
    otpViaEdge();
  };
  const doSync=function(){
    setBusy(true); setErr(""); setDoneN(null);
    cloud.myinvestorSync().then(function(r){
      setBusy(false);
      // softFail = anti-bot/403: sesión sigue; no pedir OTP/captcha (feedback 2026-07-17).
      if(r&&r.softFail){ fail(r); return; }
      if(r&&r.authExpired){ setStep("idle"); setExpired(true); fail(r); return; }
      if(!r||!r.ok||!Array.isArray(r.positions)){ fail(r); return; }
      const m={};
      r.positions.forEach(function(po){ const k=po.isin||po.name; const sug=brokerSuggest({isin:po.isin,name:po.name}, state.investments); m[k]=sug||"__new"; });
      setPositions(r.positions); setMap(m); setStep("preview");
    }).catch(fail);
  };
  const keyOf=function(p){ return p.isin||p.name; };
  const mappedN=positions?positions.filter(function(p){ return map[keyOf(p)]; }).length:0;
  const apply=function(){
    const pos=positions;
    set(function(s){
      let inv=(s.investments||[]).map(function(i){
        const po=pos.find(function(p){ return map[keyOf(p)]===i.id; });
        if(!po) return i;
        const patch={ shares:po.shares };
        if(po.cost!=null) patch.cost=po.cost;
        if(po.value!=null) patch.value=po.value;      // MI da valor en la divisa del fondo (normalmente €)
        if(po.isin&&!i.isin) patch.isin=po.isin;
        return Object.assign({},i,patch);
      });
      const created=pos.filter(function(p){ return map[keyOf(p)]==="__new"; }).map(function(po){
        return { id:uid(), ent:"myinvestor", name:po.name, isin:po.isin||null, shares:po.shares, value:po.value!=null?po.value:0, cost:po.cost!=null?po.cost:(po.value||0), cur:po.cur||"EUR" };
      });
      if(created.length) inv=inv.concat(created);
      return Object.assign({},s,{investments:inv});
    });
    setDoneN(mappedN); setPositions(null); setStep("connected");
  };
  const disconnect=function(){ cloud.myinvestorDisconnect(); try{ localStorage.removeItem("_miCid"); }catch(e){} setExpired(false); setStep("idle"); setPositions(null); setCid(""); setPass(""); setOtpInfo(null); };
  const inpStyle={marginTop:8};
  // UI plana v4 (sin CollapsibleCard pesada) — feedback 2026-07-17 redesing bancos.
  const body=noSession
    ? React.createElement("div",{className:"alarmbox",style:{marginTop:0}},t("mi_need_login"))
    : React.createElement(React.Fragment,null,
        step==="idle" && React.createElement(React.Fragment,null,
          expired && React.createElement("div",{className:"alarmbox",style:{marginTop:0}},t("mi_expired")),
          React.createElement("input",{className:"af-in",style:inpStyle,placeholder:t("mi_user_ph"),autoComplete:"off",value:cid,onChange:function(e){ setCid(e.target.value); }}),
          React.createElement("input",{className:"af-in",style:inpStyle,type:"password",placeholder:t("mi_pass_ph"),autoComplete:"off",value:pass,onChange:function(e){ setPass(e.target.value); }}),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:busy||!cid.trim()||!pass,onClick:doConnect}, busy?t("mi_connecting"):t("mi_connect")),
          // Campo avanzado del site key de reCAPTCHA: aparece al saltar el captcha (o si ya hay uno
          // guardado). Con él la app intenta resolver el captcha sola en la WebView (2026-07-20).
          (err===t("mi_recaptcha") || err===t("mi_rc_fail_gen") || err===t("mi_rc_rejected") || rcKey) && React.createElement("div",{style:{marginTop:12,paddingTop:10,borderTop:"1px solid var(--line-soft)"}},
            React.createElement("div",{style:{fontSize:12,color:"var(--muted)",lineHeight:1.5,marginBottom:6}}, t("mi_rc_key_hint")),
            React.createElement("input",{className:"af-in",style:Object.assign({},inpStyle,{fontFamily:"monospace",fontSize:13}),placeholder:"6L…",autoComplete:"off",value:rcKey,onChange:function(e){ const v=e.target.value.trim(); setRcKey(v); try{ if(v) localStorage.setItem("_miRcKey",v); else localStorage.removeItem("_miRcKey"); }catch(_){} }}),
            rcKey && React.createElement("div",{style:{fontSize:11.5,color:"var(--mint)",marginTop:6}}, t("mi_rc_key_saved")),
            // Atribución obligatoria: el badge flotante de Google se oculta por CSS (salía FIJO en
            // toda la app, no solo aquí — feedback 2026-07-21) y sus términos piden citarlo en el flujo.
            rcKey && React.createElement("div",{style:{fontSize:10.5,color:"var(--muted-2)",marginTop:4}}, t("mi_rc_badge_note")))
        ),
        step==="otp" && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"hint",style:{marginTop:0}},t("mi_otp_intro")),
          React.createElement("input",{className:"af-in num",style:Object.assign({},inpStyle,{letterSpacing:"0.3em",textAlign:"center",fontSize:20}),type:"tel",inputMode:"numeric",maxLength:8,placeholder:t("mi_otp_ph"),value:code,onChange:function(e){ setCode(e.target.value.replace(/[^0-9]/g,"")); }}),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:busy||code.trim().length<4,onClick:doOtp}, busy?t("mi_verifying"):t("mi_verify"))
        ),
        step==="connected" && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"hint",style:{marginTop:0,color:"var(--mint)",fontWeight:700}},t("mi_connected")),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:10},disabled:busy,onClick:doSync}, busy?t("mi_syncing"):t("mi_sync")),
          React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:disconnect},t("mi_disconnect"))
        ),
        step==="preview" && positions && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"hint",style:{marginTop:6}}, tf("mi_preview",{n:positions.length})),
          positions.map(function(po){
            return React.createElement("div",{key:keyOf(po),className:"row",style:{alignItems:"flex-start",flexDirection:"column",gap:6}},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",width:"100%",gap:10}},
                React.createElement("div",{style:{minWidth:0}},
                  React.createElement("div",{className:"rname"},po.name),
                  React.createElement("div",{className:"rsub"},(po.isin||"")+(po.cur&&po.cur!=="EUR"?(" · "+po.cur):""))),
                React.createElement("div",{className:"rval num"}, (po.shares!=null?po.shares:"")+" "+t("bi_shares"),
                  React.createElement("div",{className:"rsub"},eur(po.value!=null?po.value:0)))),
              React.createElement("select",{className:"af-in",value:map[keyOf(po)]||"",onChange:function(e){ const v=e.target.value; setMap(function(m){ const n=Object.assign({},m); n[keyOf(po)]=v; return n; }); }},
                React.createElement("option",{value:""},t("bi_notouch")),
                React.createElement("option",{value:"__new"},t("tr_createnew")),
                (state.investments||[]).map(function(i){ return React.createElement("option",{key:i.id,value:i.id}, i.name+(i.cur==="USD"?" ($)":"")); })
              )
            );
          }),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:mappedN===0,onClick:apply},tf("mi_apply",{n:mappedN})),
          React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:function(){ setStep("connected"); setPositions(null); }},t("fj_cancel"))
        ),
        doneN!=null && step==="connected" && React.createElement("div",{className:"hint",style:{color:"var(--mint)",fontWeight:700,marginTop:8}},tf("mi_done",{n:doneN})),
        err && React.createElement("div",{className:"alarmbox",style:{marginTop:10}}, err)
      );
  return React.createElement("div",{className:"bk-card bk-mi"},
    bkBrand({logo:"MI", logoStyle:{background:"#C9A0E022",color:"#C9A0E0"}, title:t("mi_title"), sub:t("mi_sub"),
             badge:step==="connected"?"✓":null, open:open, onToggle:onToggle}),
    open && React.createElement("div",{className:"hint",style:{marginTop:0,marginBottom:8}},t("mi_hint")),
    open && body
  );
}

/* ============================================================
   SINCRONIZACIÓN TRADE REPUBLIC (beta) — un botón, sin exportar nada.
   La conexión REAL la implementa la capa NATIVA de Android (necesita un
   navegador de verdad para el token de AWS WAF del login de TR; una función
   de servidor "pelada" recibe 403). En la web pura el puente no existe y la
   tarjeta muestra el aviso "solo en la app". El re-anclaje reutiliza el
   mapeo por ISIN del importador CSV (brokerSuggest).

   CONTRATO que la capa nativa DEBE cumplir (todo devuelve Promises):
     trBridge().status()                 -> { connected:bool }
     trBridge().login({phone,pin})       -> { ok:bool, processId?, error? }   (dispara el 2FA)
     trBridge().verify({processId,code}) -> { ok:bool, error? }               (guarda la sesión EN EL DISPOSITIVO)
     trBridge().sync()                   -> { ok:bool, positions:[{isin,name,shares,value,cost?}], cash?:number, error? }
     trBridge().logout()                 -> { ok:bool }
   `value`/`cost` en EUR (TR liquida en €). NADA de esto toca la nube de Aely:
   credenciales y sesión viven solo en el móvil.
   ============================================================ */
function trBridge(){
  try{
    if(typeof window==="undefined") return null;
    const cap=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.TradeRepublic;
    if(cap) return cap;
    if(window.MiCarteraTR) return window.MiCarteraTR;
  }catch(e){}
  return null;
}
// Teléfono del último login OK (solo el teléfono, NUNCA el PIN): tras un 401 real el formulario
// sale ya rellenado y reconectar queda en PIN + código (feedback 2026-07-17).
function trPhoneSaved(){ try{ return localStorage.getItem("mc_tr_phone")||""; }catch(e){ return ""; } }
/* Un `status().connected=false` solo dice que el puente no tiene su flag local (APK vieja,
   reinstalación o arranque frío); NO demuestra que TR haya rechazado el refresh. Guardamos una
   marca distinta únicamente cuando un sync devuelve `authExpired` de forma explícita. */
function trAuthExpiredSaved(){ try{ return localStorage.getItem("_trAuthExpired")==="1"; }catch(e){ return false; } }
function markTrAuthExpired(){
  try{ localStorage.setItem("_trAuthExpired","1"); }catch(e){}
  trSignalStatus(false,{authExpired:true});
}
// La tarjeta y sus consumidores (resumen de Ajustes + banner de Cartera) viven en componentes
// distintos. Cambiar solo el useState local dejaba «1 caído» hasta reiniciar aunque el login o
// el sync acabasen bien — feedback 2026-09-07. Este evento mantiene una única verdad visible.
// `ack:true` = la acción MANUAL acabó bien (conectar / sync). El consumidor pinta toast UNA vez.
 // Las consultas de status (arranque, visibility) NO llevan ack — rechazo 4.19.0/tr-reactivo.
function trSignalStatus(connected, opts){
  opts=opts||{};
  try{ window.dispatchEvent(new CustomEvent("mc-tr-status",{detail:{connected:!!connected, ack:!!opts.ack, authExpired:!!opts.authExpired}})); }catch(e){}
}
function markTrConnected(opts){ try{ localStorage.removeItem("_trAuthExpired"); }catch(e){} trSignalStatus(true, opts||{}); }
function TRSync({state, set, totals, open, onToggle}){
  const bridge=trBridge();
  const [step,setStep]=useState("idle");      // idle | code | preview | done
  const [phone,setPhone]=useState(trPhoneSaved());
  const [pin,setPin]=useState("");
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [expired,setExpired]=useState(false);   // 401 REAL: enseña el formulario con aviso propio
  const [err,setErr]=useState(false);
  const [errMsg,setErrMsg]=useState("");   // mensaje REAL que devuelve TR (para no depurar a ciegas)
  const [processId,setProcessId]=useState(null);
  const [connected,setConnected]=useState(false);
  const [positions,setPositions]=useState(null);
  const [cash,setCash]=useState(null);
  const [map,setMap]=useState({});
  const [doneN,setDoneN]=useState(null);
  useEffect(function(){
    if(!bridge||!bridge.status) return;
    Promise.resolve(bridge.status()).then(function(r){ if(r&&r.connected) setConnected(true); }).catch(function(){});
  },[]);
  // fail(e): muestra el error REAL de TR si lo hay (r.error), o el genérico. También viaja a
  // app_events: la saga del TR-en-frío se depuraba a ciegas sin ver el error del móvil del otro.
  const fail=function(e){ setBusy(false); setErr(true); const m=(e&&(e.error||e.message))||(typeof e==="string"?e:""); setErrMsg(m);
    try{ cloud.logEvent('error','TR sync: '+(m||'error desconocido')); }catch(x){} };
  // Normaliza el teléfono a formato internacional (TR exige +CC…). Sin prefijo → asume España (+34).
  const normPhone=function(p){
    let s=(p||"").replace(/[\s().-]/g,"");
    if(s.indexOf("+")===0) return s;
    if(s.indexOf("00")===0) return "+"+s.slice(2);
    if(s.length===9) return "+34"+s;            // móvil español típico
    return s.indexOf("+")===0?s:"+"+s;
  };
  const doSync=function(opts){
    opts=opts||{};
    setBusy(true); setErr(false); setErrMsg(""); setStep("idle"); setDoneN(null);
    return Promise.resolve(bridge.sync()).then(function(r){
      setBusy(false);
      if(r&&r.authExpired && !r.softFail && !r.wafBlocked){
        // 401 REAL (no anti-bot): al formulario directamente, con el teléfono ya puesto. Antes se
        // pedía pulsar «Desconectar» — que además borra el snapshot bueno (feedback 2026-07-17).
        setConnected(false); markTrAuthExpired(); setExpired(true); setStep("idle");
        try{ cloud.logEvent('error','TR sync: sesión caducada de verdad (401 real)'); }catch(x){}
        return;
      }
      if(r&&(r.softFail||r.wafBlocked)){ fail(r); return; }   // anti-bot: sesión sigue, no pedir 2FA
      if(!r||!r.ok||!Array.isArray(r.positions)){ fail(r); return; }
      // Tras verify el acuse ya salió; el botón Sync pide ack propio. Fallo → fail(), sin ack.
      markTrConnected(opts.ack?{ack:true}:undefined);
      const m={};
      r.positions.forEach(function(po){
        const sug=brokerSuggest(po, state.investments);
        // Sin cartera previa (usuario nuevo, p.ej. la pareja) el mapeo por defecto es CREAR la
        // posición: antes todo quedaba en "no tocar" y el botón se moría en "Aplicar a 0".
        if(sug) m[po.isin]=sug;
        else if(state.investments.length===0) m[po.isin]="__new";
      });
      setMap(m); setPositions(r.positions); setCash(r.cash!=null?r.cash:null); setStep("preview");
    }).catch(fail);
  };
  const doLogin=function(){
    if(!phone.trim()||!pin.trim()) return;
    setBusy(true); setErr(false); setErrMsg("");
    Promise.resolve(bridge.login({phone:normPhone(phone),pin:pin.trim()})).then(function(r){
      setBusy(false);
      if(!r||!r.ok){ fail(r); return; }
      try{ localStorage.setItem("mc_tr_phone", normPhone(phone)); }catch(e){}
      setProcessId(r.processId||null); setStep("code");
    }).catch(fail);
  };
  const doVerify=function(){
    if(code.trim().length<4) return;
    setBusy(true); setErr(false); setErrMsg("");
    Promise.resolve(bridge.verify({processId:processId,code:code.trim()})).then(function(r){
      if(!r||!r.ok){ fail(r); return; }
      // Acuse visible al completar el 2FA (rechazo 4.19.0/tr-reactivo). doSync sin ack otra vez.
      setConnected(true); markTrConnected({ack:true}); setExpired(false); setCode(""); doSync();
    }).catch(fail);
  };
  const mappedN=positions?positions.filter(function(p){ return map[p.isin]; }).length:0;
  const apply=function(){
    const pos=positions, trCash=cash;
    set(function(s){
      const next=Object.assign({},s,{investments:s.investments.map(function(i){
        const po=pos.find(function(p){ return map[p.isin]===i.id; });
        if(!po) return i;
        const patch={shares:po.shares, isin:po.isin};
        // dato EN VIVO de TR (€). Si la posición se muestra en $, se convierte con el cambio del BCE.
        if(po.value!=null) patch.value = i.cur==="EUR" ? po.value : fromEurAmt(po.value, i.cur, state);
        if(po.cost!=null)  patch.cost  = i.cur==="EUR" ? po.cost  : fromEurAmt(po.cost,  i.cur, state);
        return Object.assign({},i,patch);
      })});
      // Posiciones mapeadas a "__new" → se CREAN en Inversiones (usuario sin cartera previa).
      const created=pos.filter(function(p){ return map[p.isin]==="__new"; }).map(function(po){
        return { id:uid(), ent:"trade_republic", name:po.name||po.isin, isin:po.isin,
                 shares:po.shares, value:po.value!=null?po.value:0,
                 cost:po.cost!=null?po.cost:(po.value!=null?po.value:0), cur:"EUR" };
      });
      if(created.length) next.investments=next.investments.concat(created);
      // EFECTIVO de TR (availableCash) → re-ancla la cuenta TR para que HOY muestre exactamente
      // ese saldo (misma fórmula que la edición manual de Patrimonio: se despeja la base del mes).
      // Si no existe cuenta TR (usuario nuevo), se crea con ese saldo.
      if(trCash!=null && totals){
        const hasTR=s.accounts.some(function(a){ return a.ent==="trade_republic"; });
        next.accounts = hasTR
          ? s.accounts.map(function(a){
              if(a.ent!=="trade_republic") return a;
              const pn=(totals.paidNetByBank&&totals.paidNetByBank[a.ent])||0;
              const spentOwn=(totals.spentByBank&&totals.spentByBank[a.ent])||0;
              const stored = accDaily(a)
                ? valueDesdeSaldo({shown:trCash, injTR:totals.injTR||0, spentOwn:spentOwn, roundup:totals.roundupThisMonth||0, monthlyInvest:totals.monthlyInvestThisMonth||0, ambos:accRole(a)==="ambos", paidNet:pn})
                : trCash-pn;
              return Object.assign({},a,{value:+stored.toFixed(2)});
            })
          : s.accounts.concat([{ id:uid(), ent:"trade_republic", name:"Trade Republic", value:+trCash.toFixed(2), note:"" }]);
      }
      return next;
    });
    setDoneN(mappedN); setPositions(null); setStep("done");
  };
  const disconnect=function(){
    if(bridge&&bridge.logout){ Promise.resolve(bridge.logout()).catch(function(){}); }
    try{ localStorage.removeItem("mc_tr_phone"); localStorage.removeItem("_trAuthExpired"); }catch(e){}
    setConnected(false); trSignalStatus(false); setStep("idle"); setPositions(null); setPhone(""); setPin("");
  };
  const inpStyle={marginTop:8};
  const body=!bridge
    ? React.createElement("div",{className:"alarmbox",style:{marginTop:0}},t("tr_web_only"))
    : React.createElement(React.Fragment,null,
        // (El párrafo tr_tos se fusionó en tr_hint el 2026-07-18: tres textos apilados en la
        //  tarjeta «quedaban raros» — feedback del rediseño de bancos.)
        !connected && step!=="code" && React.createElement(React.Fragment,null,
          expired && React.createElement("div",{className:"alarmbox",style:{marginTop:0,marginBottom:10}},t("tr_expired_re")),
          React.createElement("input",{className:"af-in",style:inpStyle,type:"tel",inputMode:"tel",placeholder:t("tr_phone_ph"),value:phone,onChange:function(e){ setPhone(e.target.value); }}),
          React.createElement("input",{className:"af-in",style:inpStyle,type:"password",inputMode:"numeric",placeholder:t("tr_pin_ph"),value:pin,onChange:function(e){ setPin(e.target.value); }}),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:busy||!phone.trim()||!pin.trim(),onClick:doLogin}, busy?t("tr_connecting"):t("tr_connect"))
        ),
        step==="code" && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"hint",style:{marginTop:0}},t("tr_code_intro")),
          React.createElement("input",{className:"af-in num",style:Object.assign({},inpStyle,{letterSpacing:"0.3em",textAlign:"center",fontSize:20}),type:"tel",inputMode:"numeric",maxLength:6,placeholder:t("tr_code_ph"),value:code,onChange:function(e){ setCode(e.target.value.replace(/[^0-9]/g,"")); }}),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:busy||code.trim().length<4,onClick:doVerify}, busy?t("tr_verifying"):t("tr_verify"))
        ),
        connected && step!=="preview" && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"hint",style:{marginTop:0,color:"var(--mint)",fontWeight:700}},t("tr_connected")),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:10},disabled:busy,onClick:function(){ doSync({ack:true}); }}, busy?t("tr_syncing"):t("tr_sync")),
          React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:disconnect},t("tr_disconnect"))
        ),
        step==="preview" && positions && React.createElement(React.Fragment,null,
          React.createElement("div",{className:"hint",style:{marginTop:6}}, tf("tr_preview",{n:positions.length})),
          cash!=null && React.createElement("div",{className:"hint"}, tf("tr_cash",{x:eur(cash)})),
          positions.map(function(po){
            return React.createElement("div",{key:po.isin,className:"row",style:{alignItems:"flex-start",flexDirection:"column",gap:6}},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",width:"100%",gap:10}},
                React.createElement("div",{style:{minWidth:0}},
                  React.createElement("div",{className:"rname"},po.name),
                  React.createElement("div",{className:"rsub"},po.isin)
                ),
                React.createElement("div",{className:"rval num"},
                  po.shares+" "+t("bi_shares"),
                  React.createElement("div",{className:"rsub"},eur(po.value!=null?po.value:0))
                )
              ),
              React.createElement("select",{className:"af-in",value:map[po.isin]||"",onChange:function(e){ const v=e.target.value; setMap(function(m){ const n=Object.assign({},m); n[po.isin]=v; return n; }); }},
                React.createElement("option",{value:""},t("bi_notouch")),
                React.createElement("option",{value:"__new"},t("tr_createnew")),
                state.investments.map(function(i){ return React.createElement("option",{key:i.id,value:i.id}, i.name+(i.cur==="USD"?" ($)":"")); })
              )
            );
          }),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:12},disabled:mappedN===0,onClick:apply},tf("tr_apply",{n:mappedN})),
          React.createElement("div",{className:"hint"},t("tr_apply_hint"))
        ),
        doneN!=null && React.createElement("div",{className:"hint",style:{color:"var(--mint)",fontWeight:700}},tf("tr_done",{n:doneN})),
        err && React.createElement("div",{className:"alarmbox",style:{marginTop:10}}, errMsg? (t("tr_err")+" ("+errMsg+")") : t("tr_err"))
      );
  return React.createElement("div",{className:"bk-card bk-tr"},
    bkBrand({logo:"TR", logoStyle:{background:"#111",color:"#fff"}, title:t("tr_title"), sub:t("tr_sub"),
             badge:connected?"✓":null, open:open, onToggle:onToggle}),
    open && React.createElement("div",{className:"hint",style:{marginTop:0,marginBottom:8}},t("tr_hint")),
    open && body
  );
}

function InvRows({items, st, fmt, editing, showCost, draft, setF, onSell, onDelete}){
  const eurVal=(it)=> invValueEur(it, st);
  const show=fmt||eur;   // moneda local de la tab (fallback a €)
  return items.map(function(it){
    return React.createElement("div",{className:"row",key:it.id,"data-inv-position":it.id},
      React.createElement("div",{className:"rl"},
        React.createElement(LogoInv,{nombre:it.name,ent:it.ent,kind:it.kind,size:38}),
        React.createElement("div",null,
          React.createElement("div",{className:"rname"},it.name),
          React.createElement("div",{className:"rsub"}, entOf(it.ent).label + (it.cur==="USD"?" \u00b7 USD":"")),
          editing && React.createElement("button",{type:"button",className:"inv-row-action",style:{color:"#9BD0E0"},onClick:function(){ onSell(it); }},t("inv_sold_part")),
          editing && React.createElement("button",{type:"button",className:"inv-row-action",style:{color:"var(--coral)",marginLeft:12},onClick:function(){ onDelete(it); }},"🗑 "+t("inv_delete"))
        )
      ),
      editing
        ? React.createElement("div",{className:"editpair"},
            React.createElement("label",null, React.createElement("span",null, t("inv_value")+(it.cur==="USD"?" $":" \u20ac")),
              React.createElement("input",{className:"num",value:(draft[it.id]||{}).value,inputMode:"decimal",onFocus:e=>e.target.select(),onChange:e=>setF(it.id,"value",e.target.value)})),
            showCost && React.createElement("label",null, React.createElement("span",null,t("inv_invested")),
              React.createElement("input",{className:"num",value:(draft[it.id]||{}).cost,inputMode:"decimal",onFocus:e=>e.target.select(),onChange:e=>setF(it.id,"cost",e.target.value)}))
          )
        : React.createElement("div",{className:"rval num"}, show(eurVal(it)),
            (function(){ if(it.cost==null||it.cost<=0) return null; const pl=(it.value-it.cost)/it.cost*100; return React.createElement("div",{className:"rvsub"+(pl<0?" neg":"")}, (pl>=0?"+":"")+pl.toFixed(2)+"%"); })())
    );
  });
}

/* Calculadora de proyección estilo TR/Revolut: slider de aporte + banda de rango. */
function Projection({invested, defMonthly}){
  const [monthly,setMonthly]=useState(Math.max(0,Math.min(3000,Math.round((defMonthly||500)/50)*50)));
  const [rate,setRate]=useState("7");
  const [years,setYears]=useState("20");
  const calc=useMemo(function(){
    const P=monthly;
    const ann=parseFloat(String(rate).replace(',','.'))||0;
    const Y=Math.max(1,Math.min(50,parseInt(years)||1));
    const init=invested||0;
    const serie=function(a){ const r=a/100/12, out=[]; for(let yy=0;yy<=Y;yy++){ const m=yy*12; out.push(init*Math.pow(1+r,m)+(r>0?P*((Math.pow(1+r,m)-1)/r):P*m)); } return out; };
    const mid=serie(ann), opt=serie(ann+2), pes=serie(Math.max(0,ann-2)), ap=[];
    for(let yy=0;yy<=Y;yy++) ap.push(init+P*12*yy);
    return {Y:Y, mid:mid, opt:opt, pes:pes, ap:ap, fv:mid[mid.length-1], aportado:ap[ap.length-1]};
  },[monthly,rate,years,invested]);

  const W=340,H=176, mL=4,mR=46,mT=10,mB=22, N=calc.mid.length, pw=W-mL-mR, ph=H-mT-mB;
  const max=calc.opt[calc.opt.length-1]||1;
  const X=function(i){ return mL+(i/(N-1))*pw; };
  const Yc=function(v){ return mT+ph-(v/max)*ph; };
  const poly=function(arr){ return arr.map(function(v,i){ return X(i)+","+Yc(v); }).join(" "); };
  let bandTop=calc.opt.map(function(v,i){ return X(i)+","+Yc(v); }).join(" L ");
  let bandBot=[]; for(let i=N-1;i>=0;i--) bandBot.push(X(i)+","+Yc(calc.pes[i]));
  const band="M "+bandTop+" L "+bandBot.join(" L ")+" Z";
  const startYear=new Date().getFullYear();
  const kfmt=function(v){ return v>=1000?(Math.round(v/1000)+"K €"):(Math.round(v)+" €"); };
  const ticks=[]; for(let i=1;i<=5;i++) ticks.push(max*i/5);
  const xl=[]; const st=4; for(let i=0;i<=st;i++){ const yi=Math.round(calc.Y/st*i); xl.push({i:yi,t:String(startYear+yi)}); }
  const inp={width:"100%",padding:"9px 8px",borderRadius:"10px",border:"1px solid var(--line-soft)",background:"var(--bg)",color:"var(--text)",fontSize:"15px",boxSizing:"border-box",textAlign:"center"};
  const lbl={fontSize:11,color:"var(--muted-2)",fontWeight:700,marginBottom:3,textAlign:"center"};
  const dot=function(c){ return React.createElement("span",{style:{width:9,height:9,borderRadius:2,background:c,display:"inline-block",marginRight:5}}); };

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",gap:20,marginBottom:10}},
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:12,color:"var(--muted)"}}, dot("var(--mint)"),t("pj_projvalue")),
        React.createElement("div",{className:"serif num",style:{fontSize:22}}, eur0(calc.fv))),
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:12,color:"var(--muted)"}}, dot("#2f6b4a"),t("pj_contrib")),
        React.createElement("div",{className:"serif num",style:{fontSize:22,color:"var(--muted)"}}, eur0(calc.aportado)))
    ),
    React.createElement("svg",{viewBox:"0 0 "+W+" "+H,style:{width:"100%",height:"auto",display:"block"}},
      ticks.map(function(t,i){ return React.createElement("g",{key:i},
        React.createElement("line",{x1:mL,y1:Yc(t),x2:mL+pw,y2:Yc(t),stroke:"var(--line-soft)",strokeWidth:"1"}),
        React.createElement("text",{x:mL+pw+5,y:Yc(t)+3,fontSize:"9",fill:"var(--muted-2)"}, kfmt(t))); }),
      React.createElement("path",{d:band,fill:"rgba(95,208,138,.13)"}),
      React.createElement("polyline",{points:poly(calc.ap),fill:"none",stroke:"#2f6b4a",strokeWidth:"2"}),
      React.createElement("polyline",{points:poly(calc.mid),fill:"none",stroke:"var(--mint)",strokeWidth:"2.6"}),
      React.createElement("circle",{cx:X(N-1),cy:Yc(calc.fv),r:"3.6",fill:"var(--mint)"}),
      React.createElement("circle",{cx:X(N-1),cy:Yc(calc.aportado),r:"3.6",fill:"#2f6b4a"}),
      xl.map(function(o,i){ return React.createElement("text",{key:i,x:X(o.i),y:H-6,fontSize:"9",fill:"var(--muted-2)",textAnchor:i===0?"start":(i===xl.length-1?"end":"middle")}, o.t); })
    ),
    React.createElement("div",{style:{marginTop:14}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}},
        React.createElement("span",{style:{fontSize:13,color:"var(--muted)",fontWeight:600}},t("pj_monthly")),
        React.createElement("span",{className:"num",style:{fontWeight:700,fontSize:17}}, monthly+" €")),
      React.createElement("input",{type:"range",min:"0",max:"3000",step:"50",value:monthly,onChange:function(e){ setMonthly(parseInt(e.target.value)); },onTouchStart:function(e){e.stopPropagation();},onTouchMove:function(e){e.stopPropagation();},style:{width:"100%",accentColor:"#5FD08A"}})
    ),
    React.createElement("div",{style:{display:"flex",gap:8,marginTop:12}},
      React.createElement("div",{style:{flex:1}},React.createElement("div",{style:lbl},t("pj_rate")),React.createElement("input",{style:inp,inputMode:"decimal",value:rate,onChange:function(e){setRate(e.target.value);}})),
      React.createElement("div",{style:{flex:1}},React.createElement("div",{style:lbl},t("pj_years")),React.createElement("input",{style:inp,inputMode:"numeric",value:years,onChange:function(e){setYears(e.target.value);}}))
    ),
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginTop:12}},
      React.createElement("span",{style:{fontSize:12,color:"var(--muted)"}},tf("pj_gain",{y:calc.Y})),
      React.createElement("span",{style:{fontSize:14,color:"var(--mint)",fontWeight:700}},"+"+eur0(calc.fv-calc.aportado))),
    React.createElement("div",{className:"hint",style:{marginTop:8}},tf("pj_hint",{x:eur0(invested||0)}))
  );
}

function InvestmentRewards({state,set}){
  const trAcc=state.accounts.find(function(a){ return a.spendFrom; });
  const monthStartMs=+startOfMonth();
  // Cartera permanece montada aunque no sea la pestaña visible. Antes este cálculo solo vivía
  // dentro de Herramientas; al traerlo a la portada no podemos recorrer todo el histórico en cada
  // render. La referencia de expenses solo cambia cuando de verdad cambia el historial.
  const rewardsAuto=useMemo(function(){
    if(!trAcc) return {ru:0,sb:0};
    const monthExp=(state.expenses||[]).filter(function(e){ return dateMs(e.date)>=monthStartMs; });
    return {ru:roundupOf(monthExp,trAcc.roundup||0),sb:trAcc.saveback?savebackOf(monthExp):0};
  },[state.expenses,monthStartMs,trAcc&&trAcc.roundup,trAcc&&trAcc.saveback]);
  if(!trAcc) return null;
  const setTr=function(patch){ set(function(s){ return Object.assign({},s,{accounts:s.accounts.map(function(a){ return a.spendFrom?Object.assign({},a,patch):a; })}); }); };
  const setTot=function(v){ set(function(s){ return Object.assign({},s,{trRewardsTotal:v}); }); };
  const numOrNull=function(v){ v=String(v).trim(); return v===""?null:(parseFloat(v.replace(',','.'))||0); };
  const mult=trAcc.roundup||0;
  const ruAuto=rewardsAuto.ru, sbAuto=rewardsAuto.sb;
  const ru=(trAcc.roundupManual!=null)?trAcc.roundupManual:ruAuto, sb=(trAcc.savebackManual!=null)?trAcc.savebackManual:sbAuto, tot=state.trRewardsTotal||0;
  const iv=state.investments.find(function(i){ return i.id===trAcc.rewardInv; });
  const invName=iv?iv.name:t("ru_pick");
  return React.createElement(CollapsibleCard,{title:SIMPLEMODE?t("ru_title_simple"):t("ru_title"),sub:SIMPLEMODE?t("ru_sub_simple"):(mult>0?tf("ru_sub_on",{m:mult}):t("ru_sub_off")),dot:"#E6C36A",defaultOpen:false,storageKey:"inv_ru",help:t("h_ru")},
    React.createElement("div",{className:"mlabel",style:{textAlign:"left",marginBottom:6}},t("ru_mult")),
    React.createElement("div",{className:"curtoggle",style:{flexWrap:"wrap",justifyContent:"flex-start"}},
      RU_MULTS.map(function(m){ return React.createElement("button",{key:m,type:"button",className:"curbtn inv-tap"+(mult===m?" on":""),onClick:function(){ setTr({roundup:m}); }}, m===0?t("ru_off"):"×"+m); })),
    React.createElement("div",{className:"mlabel",style:{textAlign:"left",margin:"12px 0 6px"}},t("ru_dest")),
    React.createElement("select",{className:"af-in",value:trAcc.rewardInv||"",onChange:function(e){ setTr({rewardInv:e.target.value}); }},
      React.createElement("option",{value:""},t("ru_pick")),
      state.investments.map(function(i){ return React.createElement("option",{key:i.id,value:i.id}, i.name); })),
    React.createElement("button",{type:"button",className:"costtoggle",style:{marginTop:12},role:"switch","aria-checked":!!trAcc.saveback,onClick:function(){ setTr({saveback:!trAcc.saveback}); }},
      React.createElement("span",{className:"cbx"+(trAcc.saveback?" on":"")}, trAcc.saveback?"✓":""),
      React.createElement("span",null,t("ru_saveback"))),
    // Estos campos modelan el efectivo de TR; se conservan juntos para que el resumen y el
    // cierre mensual sigan leyendo exactamente las mismas preferencias.
    React.createElement("div",{className:"mlabel",style:{textAlign:"left",margin:"14px 0 6px"}},t("ru_plan")),
    React.createElement("div",{className:"ru-edit"},
      React.createElement("span",{className:"muted"},t("ru_plan_amt")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",placeholder:"0",value:trAcc.monthlyInvest!=null?trAcc.monthlyInvest:"",onChange:function(e){ setTr({monthlyInvest:numOrNull(e.target.value)}); }})),
    (trAcc.monthlyInvest>0) && React.createElement("div",{className:"hint",style:{marginTop:6}}, tf("ru_plan_hint",{x:eur0(trAcc.monthlyInvest),inv:invName})),
    React.createElement("div",{className:"ru-edit",style:{marginTop:12}},
      React.createElement("span",{className:"muted"},t("ru_interest")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",placeholder:"0",value:trAcc.interestApr!=null?trAcc.interestApr:"",onChange:function(e){ setTr({interestApr:numOrNull(e.target.value)}); }})),
    (trAcc.interestApr>0) && React.createElement("div",{className:"hint",style:{marginTop:6}}, tf("ru_interest_hint",{p:trAcc.interestApr})),
    React.createElement("div",{className:"ru-edit",style:{marginTop:12}},
      React.createElement("span",{className:"muted"},t("ru_month_ru")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",placeholder:eur0(ruAuto),value:trAcc.roundupManual!=null?trAcc.roundupManual:"",onChange:function(e){ setTr({roundupManual:numOrNull(e.target.value)}); }})),
    trAcc.saveback && React.createElement("div",{className:"ru-edit"},
      React.createElement("span",{className:"muted"},t("ru_month_sb")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",placeholder:eur0(sbAuto),value:trAcc.savebackManual!=null?trAcc.savebackManual:"",onChange:function(e){ setTr({savebackManual:numOrNull(e.target.value)}); }})),
    React.createElement("div",{className:"ru-edit"},
      React.createElement("span",{className:"muted"},t("ru_total")),
      React.createElement("input",{className:"af-in num",style:{width:96,textAlign:"right",padding:"7px 9px"},inputMode:"decimal",placeholder:"0",value:tot||"",onChange:function(e){ setTot(parseFloat(String(e.target.value).replace(',','.'))||0); }})),
    React.createElement("div",{className:"hint",style:{marginTop:8}}, SIMPLEMODE?t("ru_hint_simple"):((mult>0||trAcc.saveback?tf("ru_hint",{inv:invName}):t("ru_hint_off"))+" "+t("ru_manual_hint")))
  );
}

function Investments({state, set, fetchPrices, pricing, v4Embed, toolsMode, fullMode, showToast}){
  const fx=state.fx;   // USD→EUR (legacy + display toggle); GBP/CHF van en state.fxRates
  const [editing,setEditing]=useState(false);
  const [showCost,setShowCost]=useState(false);
  const [draft,setDraft]=useState({});
  const [brokerOpen,setBrokerOpen]=useState({});   // qué bróker tiene las posiciones desplegadas (solo v4Embed)
  const [editBroker,setEditBroker]=useState(null);
  const [manualAdd,setManualAdd]=useState(null);
  const manualAddRef=useRef(null);
  const manualNameRef=useRef(null);
  const manualTriggerRef=useRef(null);
  const manualOriginRef=useRef(null);
  const [refreshError,setRefreshError]=useState(false);
  const lastPriceRef=useRef(state.lastPriceSync||null);
  const refreshBefore=useRef(null);
  const refreshCheckRef=useRef(0);
  const didAuto=useRef(false);
  const hasTickers=state.investments.some(function(i){ return i.ticker; });
  const autoOn=state.settings && state.settings.autoPrices;
  // Herramientas: sin lista de brókers duplicada, sin editar a mano / USD / auto-precios / líquido vendido
  // (feedback 2026-07-17). Las acciones solo entran por integración.
  const toolsOnly=!!toolsMode;
  useEffect(function(){
    if(autoOn && hasTickers && !didAuto.current && !toolsOnly && !v4Embed && !fullMode){ didAuto.current=true; fetchPrices(true); }
  },[]);
  const toggleAuto=()=> set(s=>Object.assign({},s,{settings:Object.assign({},s.settings,{autoPrices:!(s.settings&&s.settings.autoPrices)})}));
  // El selector ofrece los tres brókers soportados y cualquier bróker que YA exista en la
  // cartera. No toma cuentas bancarias ni inventa entidades: una posición importada con otro
  // id debe seguir siendo editable, pero no aparentamos que Aely conecte un cuarto bróker.
  const brokerOptions=[["revolut","Revolut","Trading activo (USD)"],["trade_republic","Trade Republic","ETF + acciones"],["myinvestor","MyInvestor","Indexado largo plazo"]];
  state.investments.forEach(function(i){
    if(i.ent&&!brokerOptions.some(function(g){ return g[0]===i.ent; })) brokerOptions.push([i.ent,entOf(i.ent).label,""]);
  });
  // Solo los brókers donde el usuario TIENE posiciones se pintan como tarjetas (antes salían
  // tres bloques vacíos y parecían conexiones activas — feedback pareja 2026-07-10).
  const groupsBase=brokerOptions.filter(function(g){ return state.investments.some(function(i){ return i.ent===g[0]; }); });
  // Orden fijo de los brókers (2026-07-23: se borró la UI de ordenación en Herramientas;
  // mantengo el orden por defecto de groupsBase). OJO: `groups` son las TERNAS
  // [id, nombre, subtítulo] — abajo se leen g[0]/g[1]/g[2]. No mapear a solo el id.
  const groups=groupsBase;
  const start=()=>{ const d={}; state.investments.forEach(i=>d[i.id]={value:i.value,cost:i.cost}); setDraft(d); setEditing(true); };
  const cancel=()=>{ setEditing(false); setShowCost(false); };
  const save=()=>{
    const editedAt=new Date().toISOString();
    set(s=>Object.assign({},s,{investments:s.investments.map(i=>{
      const dd=draft[i.id]||{};
      const value=(dd.value!=null&&dd.value!=="")?(parseFloat(String(dd.value).replace(',','.'))||0):i.value;
      const cost=(showCost&&dd.cost!=null&&dd.cost!=="")?(parseFloat(String(dd.cost).replace(',','.'))||i.cost):i.cost;
      const patch={value:value,cost:cost};
      if(value!==i.value || cost!==i.cost) patch.manualUpdatedAt=editedAt;
      // Al editar el coste, anclamos el € contable al tipo de hoy (no se recalcula al cambiar FX).
      if(showCost&&dd.cost!=null&&dd.cost!==""){
        const newCost=parseFloat(String(dd.cost).replace(',','.'));
        if(isFinite(newCost)&&newCost!==i.cost) patch.costEur=toEurAmt(newCost, i.cur||"EUR", s);
      }
      return Object.assign({},i,patch);
    })}));
    setEditing(false); setShowCost(false);
  };
  const setF=(id,field,v)=> setDraft(d=>Object.assign({},d,{[id]:Object.assign({},d[id],{[field]:v})}));
  // Borrar una posición del todo (duplicados de un import, valores liquidados…). Antes NO se
  // podía desde la UI y los cadáveres se quedaban para siempre (feedback 2026-07-13).
  const onDelete=function(it){
    askConfirm({ title:tf("inv_delete_confirm",{name:it.name}), sub:t("inv_delete_sub"),
      ok:t("inv_delete"), danger:true }).then(function(yes){
      if(!yes) return;
      set(function(s){ return Object.assign({},s,{investments:s.investments.filter(function(i){ return i.id!==it.id; })}); });
    });
  };
  // Venta parcial: reduce valor, coste y participaciones proporcionalmente y registra el líquido vendido.
  const onSell=function(it){
    askText({ title:tf("inv_sell_prompt",{name:it.name}), sub:t("inv_sell_sub"), ph:"%",
      chips:[25,50,75,100].map(function(v){ return {v:v,label:v+" %"}; })
    }).then(function(pStr){ if(pStr!=null) sellPct(it, parseFloat(String(pStr).replace(',','.'))); });
  };
  const sellPct=function(it,pct){
    if(!(pct>0 && pct<=100)){ return; }
    const f=pct/100;
    const realizado=invValueEur(it, state)*f;   // líquido sacado, en €
    set(function(s){
      return Object.assign({},s,{
        investments:s.investments.map(function(i){
          if(i.id!==it.id) return i;
          const o=Object.assign({},i,{ value:+(i.value*(1-f)).toFixed(2), cost:(i.cost!=null?+(i.cost*(1-f)).toFixed(2):i.cost) });
          if(i.shares) o.shares=+(i.shares*(1-f)).toFixed(6);
          if(typeof i.costEur==="number") o.costEur=+(i.costEur*(1-f)).toFixed(2);
          return o;
        }),
        soldCash:+(((s.soldCash||0)+realizado)).toFixed(2)
      });
    });
  };
  const total=state.investments.reduce((a,i)=>a+invValueEur(i, state),0);
  const costTotal=state.investments.reduce((a,i)=>a+invCostEur(i, state),0);
  const costKnown=function(i){
    // En el histórico antiguo `cost:0` significaba tanto «sin dato» como un coste real cero.
    // Sin una migración con procedencia no se pueden separar: lo tratamos como desconocido para
    // no inventar rentabilidad, aunque eso oculte el caso excepcional de una posición regalada.
    return (typeof i.costEur==="number"&&isFinite(i.costEur)&&i.costEur>0)
      || (typeof i.cost==="number"&&isFinite(i.cost)&&i.cost>0);
  };
  const completeCost=state.investments.length>0&&state.investments.every(costKnown);
  const missingCost=state.investments.find(function(i){ return !costKnown(i); });
  const plTotal=costTotal>0?(total-costTotal)/costTotal*100:0;
  // Moneda LOCAL de la pestaña Inversiones (no toca el resto de la app). Todo se calcula en €
  // internamente y se convierte a la moneda elegida para mostrar (€ ↔ $ con el cambio del BCE).
  const [invCur,setInvCur]=useState(function(){ return (state.settings&&state.settings.currency)||"EUR"; });
  const dk = invCur==="USD" ? (fx>0?1/fx:1) : 1;
  const dsym = invCur==="USD" ? "$" : "€";
  const f2  = (eurVal)=> NF.format((eurVal||0)*dk)+" "+dsym;
  const f0  = (eurVal)=> NF0.format(Math.round((eurVal||0)*dk))+" "+dsym;
  // valor y coste por bróker (en €) para el desglose de contribuciones
  const byBroker={};
  state.investments.forEach(function(i){ const v=invValueEur(i, state); const c=invCostEur(i, state); const o=byBroker[i.ent]||(byBroker[i.ent]={c:0,v:0}); o.c+=c; o.v+=v; });
  // rendimiento por posición (en €), ordenado de mejor a peor
  const posList=state.investments.map(function(i){ const v=invValueEur(i, state); const c=invCostEur(i, state); return {id:i.id,name:i.name,ent:i.ent,v:v,c:c,gain:v-c,pl:c>0?(v-c)/c*100:0}; }).sort(function(a,b){ return b.gain-a.gain; });
  const maxAbsGain=Math.max.apply(null,posList.map(function(p){return Math.abs(p.gain);}).concat([1]));
  const best=posList[0], worst=posList[posList.length-1];
  const invHist=(state.invHistory||[]);
  const evoChg=invPeriodChange(invHist);
  // Desglose por tipo de activo (clasificación por id conocido, con respaldo por nombre)
  const TYPE_BY_ID={ "0mrszi5":"materias", "7zjaw0y":"etf", "0itlr5k":"fondo" };
  const invType=function(it){ if(TYPE_BY_ID[it.id]) return TYPE_BY_ID[it.id]; if(/oro|xau|materia|plata/i.test(it.name)) return "materias"; if(/etf|all.?world|s&p|amundi/i.test(it.name)) return "etf"; if(/fondo|indexad|fidelity|msci world/i.test(it.name)) return "fondo"; return "acciones"; };
  const byType={acciones:0,etf:0,fondo:0,materias:0};
  state.investments.forEach(function(i){ byType[invType(i)]+=invValueEur(i, state); });
  const typeMeta=[["acciones","var(--mint)"],["etf","var(--blue)"],["fondo","#C9A0E0"],["materias","#E6C36A"]];
  const typeSegs=typeMeta.filter(function(ty){ return byType[ty[0]]>0; }).map(function(ty){ return {label:t("type_"+ty[0])+" · "+(total>0?Math.round(byType[ty[0]]/total*100):0)+"%", value:byType[ty[0]], color:ty[1]}; });

  // La pantalla hija solo cambia la presentación. Los importes siguen saliendo de los mismos
  // conversores contables de arriba; duplicarlos aquí volvería a abrir la puerta a descuadres.
  const shownTotal=useCountUp(total,!!fullMode);
  const gainTotal=total-costTotal;
  const lastPriceMs=(function(){ const n=new Date(state.lastPriceSync||0).getTime(); return isFinite(n)&&n>0?n:0; })();
  const stale=!!lastPriceMs && Date.now()-lastPriceMs>48*60*60*1000;
  useEffect(function(){
    const next=state.lastPriceSync||null;
    if(refreshBefore.current!==null && next && next!==refreshBefore.current){
      clearTimeout(refreshCheckRef.current);
      refreshBefore.current=null;
      setRefreshError(false);
      if(showToast){
        const time=new Date(next).toLocaleTimeString(loc(),{hour:"2-digit",minute:"2-digit"});
        showToast(tf("iv_refresh_ok",{time:time}));
      }
    }
    lastPriceRef.current=next;
  },[state.lastPriceSync]);
  useEffect(function(){ return function(){ clearTimeout(refreshCheckRef.current); }; },[]);
  const refreshPrices=function(){
    if(pricing||!hasTickers) return;
    const before=lastPriceRef.current;
    refreshBefore.current=before;
    setRefreshError(false);
    // fetchPrices conserva su contrato actual y sus avisos. Como no devuelve un resultado
    // estructurado, solo damos por buena la lectura cuando cambia su sello real.
    Promise.resolve().then(function(){ return fetchPrices(false); }).then(function(){
      clearTimeout(refreshCheckRef.current);
      refreshCheckRef.current=setTimeout(function(){
        if(refreshBefore.current!==null&&lastPriceRef.current===before) setRefreshError(true);
      },700);
    }).catch(function(){ setRefreshError(true); });
  };
  const restoreManualFocus=function(preferredEnt){
    const target=manualTriggerRef.current;
    const origin=manualOriginRef.current;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      if(target&&target.isConnected){ target.focus(); return; }
      let fallback=origin?document.querySelector('[data-inv-add-origin="'+origin+'"]'):null;
      if(!fallback&&preferredEnt){
        const card=Array.from(document.querySelectorAll("[data-inv-broker]")).find(function(el){ return el.getAttribute("data-inv-broker")===preferredEnt; });
        fallback=card&&card.querySelector('[data-act="inv-add"]');
      }
      if(!fallback) fallback=document.querySelector("[data-inv-screen] h1");
      if(fallback) fallback.focus();
    }); });
  };
  const openManualAdd=function(ent,trigger){
    manualTriggerRef.current=trigger||document.activeElement;
    manualOriginRef.current=trigger&&trigger.getAttribute("data-inv-add-origin");
    setManualAdd({ent:ent||"trade_republic",name:"",value:"",cost:"",cur:"EUR"});
  };
  const closeManualAdd=function(){ setManualAdd(null); restoreManualFocus(); };
  useEffect(function(){
    if(!manualAdd) return undefined;
    const id=requestAnimationFrame(function(){
      if(manualAddRef.current) manualAddRef.current.scrollIntoView({block:"nearest",behavior:"auto"});
      requestAnimationFrame(function(){ if(manualNameRef.current) manualNameRef.current.focus(); });
    });
    return function(){ cancelAnimationFrame(id); };
  },[!!manualAdd]);
  const setManualField=function(k,v){ setManualAdd(function(x){ return Object.assign({},x,{[k]:v}); }); };
  const manualValue=manualAdd&&parseFloat(String(manualAdd.value).replace(',','.'));
  const manualCostRaw=manualAdd?String(manualAdd.cost).trim():"";
  const manualCost=manualCostRaw===""?null:parseFloat(manualCostRaw.replace(',','.'));
  const manualReady=!!(manualAdd&&manualAdd.name.trim()&&isFinite(manualValue)&&manualValue>=0
    && (manualCost===null||(isFinite(manualCost)&&manualCost>=0)));
  const saveManualAdd=function(){
    if(!manualReady) return;
    const now=new Date().toISOString();
    const item={id:uid(),ent:manualAdd.ent,name:manualAdd.name.trim(),value:+manualValue.toFixed(2),cost:manualCost===null?null:+manualCost.toFixed(2),cur:manualAdd.cur,manualUpdatedAt:now};
    set(function(s){ return Object.assign({},s,{investments:s.investments.concat([item])}); });
    setBrokerOpen(function(o){ return Object.assign({},o,{[item.ent]:true}); });
    setManualAdd(null);
    restoreManualFocus(item.ent);
    if(showToast) showToast(t("iv_added"));
  };
  const manualLabel=function(it){
    const ms=new Date(it.manualUpdatedAt||0).getTime();
    return ms>0?tf("iv_manual_on",{date:new Date(ms).toLocaleDateString(loc(),{day:"2-digit",month:"short"})}):t("iv_manual");
  };
  const beginBrokerEdit=function(gid){
    start();
    setShowCost(true);
    setEditBroker(gid);
    setBrokerOpen(function(o){ return Object.assign({},o,{[gid]:true}); });
  };
  const cancelBrokerEdit=function(){ cancel(); setEditBroker(null); };
  const saveBrokerEdit=function(){ save(); setEditBroker(null); };

  if(fullMode){
    const lastTime=lastPriceMs?new Date(lastPriceMs).toLocaleTimeString(loc(),{hour:"2-digit",minute:"2-digit"}):t("iv_never");
    const staleDay=lastPriceMs?new Date(lastPriceMs).toLocaleDateString(loc(),{weekday:"long"}):"—";
    const heroBase=completeCost?Math.max(0,Math.min(costTotal,total)):Math.max(total,1);
    const heroGain=completeCost?Math.max(0,gainTotal):0;
    const heroSum=Math.max(1,heroBase+heroGain);
    return React.createElement("div",{className:"v4-investments-full"},
      React.createElement("section",{className:"v4-card v4-card-hero rise","data-inv-hero":"1",style:{padding:20}},
        React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}},
          React.createElement("div",null,
            React.createElement("div",{className:"v4-micro"},t("iv_now")),
            React.createElement("div",{className:"serif num",style:{fontSize:40,fontWeight:550,letterSpacing:"-1px",lineHeight:1.05,marginTop:6}},f2(shownTotal))),
          React.createElement("div",{className:"curtoggle","aria-label":t("iv_currency")},
            React.createElement("button",{type:"button",className:"curbtn"+(invCur==="EUR"?" on":""),"aria-pressed":invCur==="EUR",onClick:function(){ setInvCur("EUR"); }},"€"),
            React.createElement("button",{type:"button",className:"curbtn"+(invCur==="USD"?" on":""),"aria-pressed":invCur==="USD",onClick:function(){ setInvCur("USD"); }},"$"))),
        stale && React.createElement("div",{className:"chip",style:{display:"inline-flex",marginTop:12}},tf("st_stale",{day:staleDay})),
        React.createElement("div",{className:"v4-stackbar","aria-hidden":"true",style:{marginTop:16}},
          React.createElement("i",{style:{flex:Math.max(.02,heroBase/heroSum*100),background:completeCost?"var(--cream)":"var(--mint)"}}),
          heroGain>0 && React.createElement("i",{style:{flex:Math.max(.02,heroGain/heroSum*100),background:"var(--mint)"}})),
        completeCost
          ? React.createElement(React.Fragment,null,
              React.createElement("div",{className:"v4-legend"},
                React.createElement("span",null,React.createElement("b",{style:{background:"var(--cream)"}}),tf("iv_put",{amount:f2(costTotal)})),
                React.createElement("span",null,React.createElement("b",{style:{background:gainTotal>=0?"var(--mint)":"var(--coral)"}}),tf(gainTotal>=0?"iv_gained":"iv_lost",{amount:f2(Math.abs(gainTotal))}))),
              React.createElement("div",{style:{fontSize:13,fontWeight:750,color:gainTotal>=0?"var(--mint)":"var(--coral)",marginTop:10}},
                tf("iv_percent",{pct:(plTotal>=0?"+":"")+plTotal.toFixed(2),time:lastTime})))
          : React.createElement("div",{className:"hint",style:{marginTop:12}},
              state.investments.length>0 && React.createElement("div",{className:"v4-legend"},React.createElement("span",null,React.createElement("b",{style:{background:"var(--muted-2)"}}),t("iv_gain_unknown"))),
              React.createElement("div",null,costTotal>0?t("iv_missing_cost"):t("iv_no_put")),
              state.investments.length>0 && React.createElement("div",{style:{marginTop:6}},tf("iv_updated",{time:lastTime})),
              state.investments.length>0 && React.createElement("button",{type:"button",className:"v4-link-mini","data-act":"inv-edit",style:{marginTop:8},onClick:function(){ beginBrokerEdit(missingCost&&missingCost.ent); }},t("iv_no_put_cta"))),
        React.createElement("div",{className:"hint",style:{marginTop:10}},tf("iv_fx_note",{fx:fx>0?fx.toFixed(4):"—"}))),

      React.createElement("div",{className:"v4-sec-h",style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:22}},
        React.createElement("span",null,t("iv_where")),
        React.createElement("button",{type:"button",className:"v4-link-mini","data-act":"inv-refresh",disabled:pricing||!hasTickers,"aria-busy":pricing?"true":"false",onClick:refreshPrices},pricing?t("iv_refreshing"):t("iv_refresh"))),
      pricing && React.createElement("div",{role:"status",className:"hint",style:{margin:"-2px 2px 10px"}},t("iv_refreshing")),
      refreshError && React.createElement("div",{role:"alert",className:"v4-card",style:{padding:14,border:"1px solid rgba(226,112,95,.45)",background:"rgba(226,112,95,.08)",marginBottom:12}},
        React.createElement("div",{style:{fontWeight:800}},t("iv_refresh_fail")),
        React.createElement("div",{className:"hint",style:{marginTop:4}},tf("iv_refresh_fail_sub",{time:lastTime})),
        React.createElement("button",{type:"button",className:"v4-link-mini",style:{marginTop:8},onClick:refreshPrices},t("iv_retry"))),

      manualAdd && React.createElement("section",{className:"v4-card","data-inv-manual-add":"1",ref:manualAddRef,style:{padding:16}},
        React.createElement("div",{className:"v4-sec-h",style:{marginBottom:12}},t("iv_add_manual")),
        React.createElement("label",{className:"v4-field-label"},t("iv_broker"),
          React.createElement("select",{className:"af-in",value:manualAdd.ent,onChange:function(e){ setManualField("ent",e.target.value); }},
            brokerOptions.map(function(g){ return React.createElement("option",{key:g[0],value:g[0]},g[1]); }))),
        React.createElement("label",{className:"v4-field-label"},t("iv_name"),
          React.createElement("input",{className:"af-in","data-field":"inv-name",ref:manualNameRef,value:manualAdd.name,onChange:function(e){ setManualField("name",e.target.value); }})),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
          React.createElement("label",{className:"v4-field-label"},t("iv_value_field"),
            React.createElement("input",{className:"af-in",inputMode:"decimal","data-field":"inv-value",value:manualAdd.value,onChange:function(e){ setManualField("value",e.target.value); }})),
          React.createElement("label",{className:"v4-field-label"},t("iv_cost_field"),
            React.createElement("input",{className:"af-in",inputMode:"decimal","data-field":"inv-cost",value:manualAdd.cost,onChange:function(e){ setManualField("cost",e.target.value); }}))),
        React.createElement("div",{className:"curtoggle",style:{marginTop:12},"aria-label":t("iv_currency")},
          React.createElement("button",{type:"button",className:"curbtn"+(manualAdd.cur==="EUR"?" on":""),"aria-pressed":manualAdd.cur==="EUR",onClick:function(){ setManualField("cur","EUR"); }},"€"),
          React.createElement("button",{type:"button",className:"curbtn"+(manualAdd.cur==="USD"?" on":""),"aria-pressed":manualAdd.cur==="USD",onClick:function(){ setManualField("cur","USD"); }},"$")),
        React.createElement("div",{style:{display:"flex",gap:8,marginTop:14}},
          React.createElement("button",{type:"button",className:"btn btn-primary",style:{minHeight:44,flex:1},disabled:!manualReady,onClick:saveManualAdd},t("inv_save")),
          React.createElement("button",{type:"button",className:"btn btn-ghost",style:{minHeight:44,flex:1},onClick:closeManualAdd},t("inv_cancel")))),

      state.investments.length===0 && !manualAdd && React.createElement("div",{"data-inv-empty":"1",className:"v4-empty v4-card",style:{padding:20,textAlign:"center",borderStyle:"dashed"}},
        React.createElement("div",{className:"em"},"📈"),
        React.createElement("div",{className:"ti"},t("iv_empty")),
        React.createElement("div",{className:"ph"},t("iv_empty_sub")),
        React.createElement("button",{type:"button",className:"v4-cta cta","data-act":"inv-add","data-inv-add-origin":"empty",onClick:function(e){ openManualAdd(null,e.currentTarget); }},t("iv_add"))),

      groups.map(function(g){
        const gid=g[0];
        const items=state.investments.filter(function(i){ return i.ent===gid; });
        const o=byBroker[gid]||{c:0,v:0};
        const delta=o.v-o.c;
        const brokerCostComplete=items.length>0&&items.every(costKnown);
        const open=!!brokerOpen[gid];
        const isEditing=editing&&editBroker===gid;
        const panelId="iv_broker_"+gid;
        return React.createElement("div",{key:gid,className:"v4-card","data-inv-broker":gid,style:{padding:0,overflow:"hidden",borderColor:open?"var(--mint-deep)":"var(--line-soft)"}},
          React.createElement("button",{type:"button",className:"v4-mov",style:{margin:0,border:0,background:"transparent"},"aria-expanded":open,"aria-controls":panelId,
            onClick:function(){ setBrokerOpen(function(v){ return Object.assign({},v,{[gid]:!v[gid]}); }); }},
            React.createElement("div",{className:"tile",style:{background:"transparent",border:"none",padding:0}},React.createElement(Mono,{ent:gid,size:44})),
            React.createElement("div",{className:"nm"},
              React.createElement("div",null,g[1]),
              React.createElement("div",{className:"meta"},tf("iv_positions",{n:items.length}))),
            React.createElement("div",{style:{textAlign:"right",flex:"0 0 auto"}},
              React.createElement("div",{className:"am num"},f0(o.v)),
              brokerCostComplete && React.createElement("div",{style:{fontSize:11,fontWeight:750,color:delta>=0?"var(--mint)":"var(--coral)"}},(delta>=0?"+":"")+f0(delta))),
            React.createElement(I.chev,{className:"chev"+(open?" open":"")})),
          open && React.createElement("div",{id:panelId,className:"v4-inv-drop",style:{padding:"0 14px 14px"}},
            isEditing
              ? React.createElement(InvRows,{items:items,st:state,fmt:f2,editing:true,showCost:true,draft:draft,setF:setF,onSell:onSell,onDelete:onDelete})
              : items.map(function(it){
                  const v=invValueEur(it,state), c=invCostEur(it,state), d=v-c;
                  return React.createElement("div",{className:"row",key:it.id,"data-inv-position":it.id},
                    React.createElement("div",{className:"rl"},
                      React.createElement(LogoInv,{nombre:it.name,ent:it.ent,kind:it.kind,size:38}),
                      React.createElement("div",null,
                        React.createElement("div",{className:"rname"},it.name),
                        React.createElement("div",{className:"rsub"},it.ticker?(it.ticker+(it.shares!=null?" · "+tf("iv_shares",{n:it.shares}):"")):manualLabel(it)))),
                    React.createElement("div",{className:"rval num"},f2(v),
                      it.ticker&&c>0 && React.createElement("div",{className:"rvsub"+(d<0?" neg":"")},(d>=0?"+":"")+(d/c*100).toFixed(2)+"%")));
                }),
            React.createElement("div",{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}},
              isEditing
                ? React.createElement(React.Fragment,null,
                    React.createElement("button",{type:"button",className:"btn btn-primary",style:{minHeight:44,flex:1},onClick:saveBrokerEdit},t("inv_save")),
                    React.createElement("button",{type:"button",className:"btn btn-ghost",style:{minHeight:44,flex:1},onClick:cancelBrokerEdit},t("inv_cancel")))
                : React.createElement("button",{type:"button",className:"btn btn-ghost","data-act":"inv-edit",style:{minHeight:44,flex:1},onClick:function(){ beginBrokerEdit(gid); }},t("iv_edit")),
              !isEditing && React.createElement("button",{type:"button",className:"btn btn-ghost","data-act":"inv-add",style:{minHeight:44,flex:1},onClick:function(e){ openManualAdd(gid,e.currentTarget); }},t("iv_add_position")))));
      }),

      state.investments.length>0 && !manualAdd && React.createElement("button",{type:"button",className:"v4-card","data-act":"inv-add","data-inv-add-origin":"global",style:{width:"100%",minHeight:52,borderStyle:"dashed",background:"transparent",color:"var(--mint)",fontWeight:800},onClick:function(e){ openManualAdd(null,e.currentTarget); }},t("iv_add")),
      state.soldCash>0 && React.createElement("div",{className:"v4-card",style:{display:"flex",justifyContent:"space-between",padding:15}},
        React.createElement("span",null,t("iv_cash")),React.createElement("strong",{className:"num",style:{color:"var(--mint)"}},f0(state.soldCash))),
      typeSegs.length>0 && React.createElement("section",{className:"v4-card","data-inv-type":"1",style:{padding:16}},
        React.createElement("div",{style:{fontWeight:800,marginBottom:12}},t("iv_by_type")),
        React.createElement(StackedBar,{segments:typeSegs}))
    );
  }

  return React.createElement("div",null,
    !v4Embed && !toolsOnly && React.createElement("div",{className:"total-bar"},
      React.createElement("div",null,
        React.createElement("div",{className:"tl"},t("inv_total")),
        React.createElement("div",{className:"tn num"},f2(total)),
        React.createElement("div",{style:{fontSize:12,fontWeight:700,marginTop:2,color:plTotal>=0?"var(--mint)":"var(--coral)"}},(plTotal>=0?"+":"")+plTotal.toFixed(2)+"% global"),
        React.createElement("div",{className:"curtoggle",style:{marginTop:8}},
          React.createElement("button",{type:"button",className:"curbtn"+(invCur==="EUR"?" on":""),onClick:()=>setInvCur("EUR")},"€"),
          React.createElement("button",{type:"button",className:"curbtn"+(invCur==="USD"?" on":""),onClick:()=>setInvCur("USD")},"$")
        ),
        React.createElement("div",{className:"hint",style:{marginTop:8,maxWidth:260}}, t("fx_multi_hint"))
      ),
      editing
        ? React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6}},
            React.createElement("button",{className:"btn btn-primary",onClick:save},t("inv_save")),
            React.createElement("button",{className:"btn btn-ghost",style:{padding:"8px 12px"},onClick:cancel},t("inv_cancel"))
          )
        : React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6}},
            hasTickers && React.createElement("button",{className:"btn btn-primary",onClick:()=>fetchPrices(false),disabled:pricing}, pricing?React.createElement(React.Fragment,null,React.createElement("span",{className:"spin"}),t("inv_pricing")):React.createElement(React.Fragment,null,React.createElement(I.sync,{width:15,height:15}),t("inv_prices"))),
            React.createElement("button",{className:"btn btn-ghost",style:{padding:"8px 12px"},onClick:start},t("inv_editmanual"))
          )
    ),
    // (El hint «toca un bróker…» se retiró el 2026-07-18: ya estaba anticuado y ocupaba sitio.)
    !editing && hasTickers && !v4Embed && !toolsOnly && React.createElement("div",{className:"costtoggle",onClick:toggleAuto},
      React.createElement("span",{className:"cbx"+(autoOn?" on":"")}, autoOn?"✓":""),
      React.createElement("span",null,t("inv_autoprices")+(state.lastPriceSync?tf("inv_lastprice",{d:new Date(state.lastPriceSync).toLocaleString(loc(),{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}):""))
    ),
    editing && !toolsOnly && React.createElement("div",{className:"costtoggle",onClick:()=>setShowCost(!showCost)},
      React.createElement("span",{className:"cbx"+(showCost?" on":"")}, showCost?"\u2713":""),
      React.createElement("span",null,t("inv_alsoinvested"))
    ),
    // En Cartera (v4Embed): mismas fichas que «Tus cuentas» (v4-mov). El resumen completo
    // vive en su pantalla hija para no montar dos veces toda la herramienta antigua.
    v4Embed && React.createElement(React.Fragment,null,
      React.createElement("div",{className:"v4-card-list"},
        groups.map(function(g){
        const items=state.investments.filter(function(i){ return i.ent===g[0]; });
        if(items.length===0) return null;
        const sub=items.reduce(function(a,i){ return a+invValueEur(i,state); },0);
        // Editando: todos los brókers desplegados con sus inputs (si no, había que ir uno a uno).
        const open=editing||!!brokerOpen[g[0]];
        return React.createElement(React.Fragment,{key:g[0]},
          React.createElement("button",{type:"button",className:"v4-mov",
            onClick:function(){ if(!editing) setBrokerOpen(function(o){ return Object.assign({},o,{[g[0]]:!o[g[0]]}); }); }},
            React.createElement("div",{className:"tile",style:{background:"transparent",border:"none",padding:0}},React.createElement(Mono,{ent:g[0],size:44})),
            React.createElement("div",{className:"nm"},
              React.createElement("div",null,g[1]),
              React.createElement("div",{className:"meta"}, tf("v4_inv_positions",{n:items.length}))
            ),
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
              React.createElement("div",{className:"am num"}, f0(sub)),
              React.createElement(I.chev,{className:"chev"+(open?" open":"")})
            )
          ),
          // .v4-inv-drop: el mismo «rise» suave del resto de la app — antes las posiciones
          // aparecían de golpe al desplegar el bróker (feedback 2026-07-21).
          open && React.createElement("div",{className:"v4-inv-drop",style:{padding:"0 2px 8px"}},
            React.createElement(InvRows,{items:items,st:state,fmt:f2,editing:editing,showCost:editing&&showCost,draft:draft,setF:setF,onSell:onSell,onDelete:onDelete}))
        );
        }),
        // Editar a mano en discreto, al pie de la lista (feedback 2026-07-18): normalmente los
        // números entran solos por los brókers; esto es el plan B para cuadrar algo puntual.
        state.investments.length>0 && React.createElement("div",{style:{display:"flex",gap:8,margin:"8px 4px 0"}},
          React.createElement("button",{type:"button",className:"edit-link"+(editing?" save":""),onClick:function(){ editing?save():start(); }}, editing?t("inv_save"):("✎ "+t("inv_editmanual"))),
          editing && React.createElement("button",{type:"button",className:"edit-link",style:{background:"transparent",color:"var(--muted)"},onClick:cancel}, t("inv_cancel"))
        )
      ),
      React.createElement("div",{style:{marginTop:12}},React.createElement(InvestmentRewards,{state:state,set:set}))
    ),
    !v4Embed && React.createElement(OrderableSections,{tab:"inv",state:state,set:set,items:[
      {id:"ru",label:SIMPLEMODE?t("ru_title_simple"):t("ru_title"),el:React.createElement(InvestmentRewards,{state:state,set:set})},
      {id:"cvg",label:t("inv_cvg"),el:
    React.createElement(CollapsibleCard,{title:t("inv_cvg"),sub:(plTotal>=0?"+":"")+plTotal.toFixed(1)+"%",dot:"#5FD08A",defaultOpen:false,storageKey:"inv_cvg",help:t("h_cvg")},
      // desglose por bróker, para poder comparar cada uno con su app (p.ej. Revolut en $)
      groups.map(function(g){ const o=byBroker[g[0]]; if(!o||o.v===0) return null; const gain=o.v-o.c; const pl=o.c>0?gain/o.c*100:0;
        return React.createElement("div",{className:"row",key:g[0]},
          React.createElement("div",{className:"rl"},React.createElement(Mono,{ent:g[0],size:34}),
            React.createElement("div",null,React.createElement("div",{className:"rname"},g[1]),React.createElement("div",{className:"rsub"},tf("inv_invested_lbl",{x:f0(o.c)})))),
          React.createElement("div",{className:"rval num"}, f0(o.v),
            React.createElement("div",{className:"rvsub"+(gain<0?" neg":""),style:{color:gain>=0?"var(--mint)":"var(--coral)"}}, (gain>=0?"+":"")+f0(gain)+" ("+(pl>=0?"+":"")+pl.toFixed(1)+"%)")));
      }),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("inv_invested_tot")),React.createElement("span",{className:"num"},f0(costTotal))),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("inv_value_tot")),React.createElement("span",{className:"num",style:{fontWeight:700}},f0(total))),
      React.createElement("div",{className:"subtotal"},React.createElement("span",{className:"muted"},t("inv_gain_lat")),React.createElement("span",{className:"num",style:{fontWeight:700,color:(total-costTotal)>=0?"var(--mint)":"var(--coral)"}},((total-costTotal)>=0?"+":"")+f0(total-costTotal))),
      React.createElement("div",{style:{marginTop:10}}, React.createElement(StackedBar,{segments:[{label:t("inv_contributed"),value:costTotal,color:"#2f6b4a"},{label:t("inv_gain"),value:Math.max(0,total-costTotal),color:"var(--mint)"}]})),
      React.createElement("div",{className:"hint",style:{fontSize:11,marginTop:8}},t("inv_cvg_hint"))
    )},
      {id:"bytype",label:t("inv_bytype"),el:
    React.createElement(CollapsibleCard,{title:t("inv_bytype"),sub:f0(total),dot:"#7FB5E8",defaultOpen:false,storageKey:"inv_tipo",help:t("h_bytype")},
      React.createElement(StackedBar,{segments:typeSegs})
    )},
      {id:"rend",label:t("inv_rend"),el:
    posList.length>0 && React.createElement(CollapsibleCard,{title:t("inv_rend"),sub:best&&worst?tf("inv_best_worst",{best:best.name,worst:worst.name}):"",dot:"#5FD08A",defaultOpen:false,storageKey:"inv_rend",help:t("h_rend")},
      posList.map(function(p){
        const pos=p.gain>=0; const wpct=Math.min(100,Math.abs(p.gain)/maxAbsGain*100);
        return React.createElement("div",{key:p.id,style:{padding:"8px 2px",borderBottom:"1px solid var(--line-soft)"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:5}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:9,minWidth:0}},React.createElement(LogoInv,{nombre:p.name,ent:p.ent,kind:p.kind,size:30}),React.createElement("div",{className:"rname",style:{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},p.name)),
            React.createElement("div",{className:"num",style:{textAlign:"right",flex:"0 0 auto"}},
              React.createElement("div",{style:{fontWeight:700,color:pos?"var(--mint)":"var(--coral)"}},(pos?"+":"")+f2(p.gain)),
              React.createElement("div",{style:{fontSize:11,color:"var(--muted-2)"}},(p.pl>=0?"+":"")+p.pl.toFixed(1)+"%"))),
          React.createElement("div",{className:"rendbar"},React.createElement("i",{style:{width:wpct+"%",background:pos?"var(--mint)":"var(--coral)"}}))
        );
      })
    )},
      {id:"evo",label:t("inv_evo"),el:React.createElement(React.Fragment,null,
    invHist.length>=1 && total>0 && React.createElement(CollapsibleCard,{title:t("inv_evo"),sub:evoChg?tf("inv_evo_period",{sign:evoChg.pct>=0?"+":"",pct:Math.abs(evoChg.pct).toFixed(1),days:evoChg.days,x:f2(Math.abs(evoChg.abs))}):t("inv_evo_sub"),dot:"#7FB5E8",defaultOpen:false,storageKey:"inv_evo",help:t("h_evo")},
      invHist.length>=2 ? React.createElement(SparklineInv,{hist:invHist}) : React.createElement("div",{className:"hint",style:{marginBottom:8}},t("inv_evo_today")),
      invHist.length>=2 && React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginTop:6}},
        React.createElement("span",null,new Date(invHist[0].d).toLocaleDateString(loc(),{day:'2-digit',month:'short'})),
        React.createElement("span",{className:"num"}, f2(total))),
      invHist.some(function(h){ return h.c>0; }) && React.createElement("div",{className:"hint",style:{fontSize:11,marginTop:6}},t("inv_evo_cost"))
    ),
    invHist.length<1 && total>0 && React.createElement("div",{className:"hint",style:{padding:"0 4px 6px"}},t("inv_evo_hint"))
    )},
      {id:"brokers",label:t("pt_byBroker"),el:React.createElement(React.Fragment,null,
    groups.map(function(g){
      const items=state.investments.filter(i=>i.ent===g[0]);
      if(items.length===0) return null;
      const sub=items.reduce((a,i)=>a+invValueEur(i, state),0);
      return React.createElement(CollapsibleCard,{key:g[0],title:g[1],sub:f0(sub),dot:entOf(g[0]).color,storageKey:"inv_"+g[0]},
        React.createElement(InvRows,{items:items,st:state,fmt:f2,editing:editing,showCost:showCost,draft:draft,setF:setF,onSell:onSell,onDelete:onDelete})
      );
    }),
    (state.soldCash>0) && React.createElement("div",{className:"costtoggle",style:{justifyContent:"space-between"}},
      React.createElement("span",null,t("inv_sold")),
      React.createElement("span",{className:"num",style:{fontWeight:700,color:"var(--mint)"}}, f0(state.soldCash))
    )
    )},
      {id:"proj",label:t("inv_proj"),el:
    React.createElement(CollapsibleCard,{title:t("inv_proj"),sub:t("inv_proj_sub"),dot:"#5FD08A",defaultOpen:false,storageKey:"inv_proj",help:t("h_proj")},
      React.createElement(Projection,{invested:total, defMonthly: state.aportaciones.reduce(function(a,x){ return a+x.amount; },0)})
    )},
      {id:"manual",label:t("inv_manual_t"),el:
    !editing && React.createElement(CollapsibleCard,{title:t("inv_manual_t"),sub:t("inv_manual_sub"),dot:"#C9A0E0",defaultOpen:false,storageKey:"inv_manual"},
      React.createElement("div",{className:"hint",style:{lineHeight:1.55}},t("inv_manual_body"))
    )}
    ].filter(function(it){
      // Herramientas: sin brókers duplicados ni «editar a mano» (feedback 2026-07-17).
      if(!toolsOnly) return true;
      return it.id!=="brokers" && it.id!=="manual";
    })}),
    !toolsOnly && React.createElement("div",{className:"hint",style:{padding:"0 4px"}}, editing
      ? t("inv_hint_edit")
      : tf("inv_hint_view",{fx:fx}))
  );
}

