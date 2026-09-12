/* ---------- Actualizaciones: OTA web bundle + APK nativo + aviso push/local ----------
   Este fichero es SOLO el transporte (descargas, service worker, notis): publica window._mc*
   y avisa con eventos mc-sw-update / mc-ota-ready / mc-apk-update. El estado de UI (pills,
   botones, chequeo manual) vive en useUpdates() — 10-app-components.js (mapa completo allí).
   La app nativa arranca del bundle LOCAL (instantáneo, offline) y este bloque baja el bundle
   nuevo de GitHub Pages en segundo plano. Bug fix 2026-07-15: si _otaPending ya coincidía con
   version.json, el chequeo salía sin enseñar el botón — ahora restauramos el bundle al arrancar.
   Notificación al móvil cuando hay update lista (pareja no depende de enterarse a mano). */
var _mcNative=false;
try{ _mcNative=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()); }catch(e){}
var _mcOtaBASE="https://juanjoavila.github.io/Aely/";
var _mcOtaChecking=false;

/* ---------- CANAL DE ACTUALIZACIONES: estable vs beta ----------
   Petición 2026-07-24: poder probar una versión EN EL MÓVIL antes de que le llegue al resto de la
   familia. GitHub Pages solo sirve una versión (la de `main`), así que la beta NO va por Pages:
   se publica como assets de una Release fija con la etiqueta `beta` (workflow .github/workflows/
   beta.yml). Así lo estable de Pages —lo que ven el padre y la pareja— no se toca jamás.

   El canal es LOCAL de cada móvil (localStorage): no viaja en el estado ni a la nube, para que
   activar la beta en un móvil no arrastre a los demás. Se enciende desde Ajustes y solo lo ve el
   dueño (profiles.is_admin). */
var _mcBetaBASE="https://github.com/JuanjoAvila/Aely/releases/download/beta/";
function mcChannel(){ try{ return localStorage.getItem("_mcChannel")==="beta" ? "beta" : "stable"; }catch(e){ return "stable"; } }
function mcSetChannel(c){
  try{
    if(c==="beta") localStorage.setItem("_mcChannel","beta");
    else localStorage.removeItem("_mcChannel");
    // Al cambiar de canal, olvida lo que había pendiente del canal anterior: si no, una beta a
    // medio descargar seguiría ofreciéndose después de volver a estable.
    localStorage.removeItem("_otaPending");
    localStorage.removeItem("_otaNotifVer");
    localStorage.removeItem("_apkNotifVer");
  }catch(e){}
}
function mcUpdBase(){ return mcChannel()==="beta" ? _mcBetaBASE : _mcOtaBASE; }
/* Los manifiestos de la beta viven en los assets de una Release de GitHub, y esos assets NO se
   pueden leer con `fetch` desde la app: `github.com/.../releases/download/…` responde un 302 a
   `release-assets.githubusercontent.com` y NINGUNO de los dos saltos manda cabeceras CORS
   (comprobado con curl el 2026-07-25). El origen de la WebView es `https://localhost`, así que el
   navegador tira la respuesta y `fetch` peta con un TypeError vacío — exactamente el mismo
   síntoma que daba la CSP, por eso arreglar la CSP (necesario) no destapó esto.
   La petición la hace ANDROID (CapacitorHttp), que no sabe ni de CORS ni de CSP — la misma vía
   que usa el login de MyInvestor (06-sync-brokers). En web se queda el `fetch` de siempre: el
   canal beta solo existe dentro del APK. */
function mcNativeHttp(){
  try{
    var cap=window.Capacitor;
    if(!(cap&&cap.isNativePlatform&&cap.isNativePlatform())) return null;
    var p=cap.Plugins&&cap.Plugins.CapacitorHttp;
    return (p&&typeof p.request==="function")?p:null;
  }catch(e){ return null; }
}
/* Devuelve algo con la forma mínima de una Response (ok/status/json), venga del fetch o del nativo. */
function mcGetJson(url){
  var nat=mcNativeHttp();
  if(!nat) return fetch(url,{cache:"no-store"});
  return nat.request({url:url, method:"GET", headers:{"Cache-Control":"no-cache"}}).then(function(r){
    var st=Number((r&&r.status)||0), body=r&&r.data;
    return { ok:st>=200&&st<300, status:st, json:function(){
      // GitHub sirve el asset como application/octet-stream, así que el cuerpo llega en crudo.
      return (body&&typeof body==="object")?body:JSON.parse(String(body||"null"));
    }};
  });
}
/* Baja un manifiesto (version.json / apk.json) del canal activo.
   La caída a estable es SOLO para «todavía no hay beta publicada» (404). Cualquier otro fallo se
   propaga: tragárselo es lo que dejó el canal beta roto en silencio: el móvil leía el manifiesto
   de PRODUCCIÓN y contestaba «✓ estás a la última» con la beta publicada delante. Un canal que no
   responde no es un canal sin novedades. */
function mcFetchManifest(name){
  // `from` dice de qué canal salió el manifiesto REALMENTE. Sin ese dato la caída a estable es
  // invisible, y una caída invisible fue exactamente el fallo del 2026-07-26 con la APK: el móvil
  // en beta leía el apk.json de PRODUCCIÓN sin decirlo, comparaba 34 contra 34 y se callaba.
  var marca=function(r,from){ if(r) r.from=from; return r; };
  var estable=function(){ return mcGetJson(_mcOtaBASE+name+"?ts="+Date.now()).then(function(r){ return marca(r,"stable"); }); };
  if(mcChannel()!=="beta"){
    return estable().then(function(r){ if(!r.ok) throw new Error(name+": "+r.status); return r; });
  }
  return mcGetJson(_mcBetaBASE+name+"?ts="+Date.now()).then(function(r){
    if(r.ok) return marca(r,"beta");
    if(r.status===404) return estable();   // la release `beta` no existe o aún no tiene ese asset
    throw new Error("beta/"+name+": HTTP "+r.status);
  }, function(e){
    throw new Error("beta/"+name+": "+((e&&e.message)||e));
  });
}

/* QUÉ VERSIÓN SIRVE PRODUCCIÓN AHORA MISMO (2026-07-28).
   Siempre desde Pages (`_mcOtaBASE`), pase lo que pase con el canal: producción ES `main`, y el
   móvil en beta también tiene derecho a saber por dónde va el resto de la familia.

   Existe por una petición suya: «cuando suba algo a prod, la beta no haya nada para aprobar
   porque lógicamente ya lo hice para que subiera prod». El panel de revisión no tenía forma de
   saberlo —solo miraba la versión que lleva puesta— así que seguía pidiendo que aprobara una
   beta que él mismo había promocionado horas antes. Con esto, el panel compara y se calla.

   Se cachea en memoria (no en localStorage) para no pedirlo en cada apertura del panel; una
   sesión de app es un intervalo perfectamente razonable para este dato. Falla en silencio a
   `null` = «no se sabe», que la UI trata como «sigue preguntando»: quedarse callado por un fallo
   de red sería peor que preguntar de más. */
var _mcProdVerCache=null;
window._mcProdVersion=function(){
  if(_mcProdVerCache) return _mcProdVerCache;
  _mcProdVerCache=mcGetJson(_mcOtaBASE+"version.json?ts="+Date.now())
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(v){ return (v&&v.version)?String(v.version):null; })
    .catch(function(){ return null; });
  return _mcProdVerCache;
};

/* CAMBIAR DE CANAL NO ES «ACTUALIZAR»: ES INSTALAR LO QUE TOCA EN EL CANAL NUEVO.
   El OTA solo va hacia ADELANTE (`_mcNewerVer`), así que apagar la beta dejaba el móvil con el
   bundle de pruebas puesto para siempre: la única salida era esperar a que producción pasara ese
   número. Feedback 2026-07-26: «si quito el canal beta no vuelve a la versión inferior, se queda
   con la actual». Aquí se instala la versión del canal destino EN LA DIRECCIÓN QUE SEA — que es lo
   que uno espera al apagar el interruptor: volver a lo que tiene el resto de la familia. */
window._mcApplyChannelBundle=function(opts){
  var toast=opts&&opts.showToast;
  var up=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorUpdater;
  if(!up||!up.download) return Promise.resolve(false);
  return mcFetchManifest("version.json")
    .then(function(r){ return r.json(); })
    .then(function(v){
      if(!v||!v.version||v.version===CONFIG.APP_VERSION) return false;
      if(toast) toast(tf("st_up_applying",{v:v.version}));
      return up.download({url:(v.url||mcUpdBase()+"bundle.zip"), version:v.version})
        .then(function(b){
          try{ localStorage.setItem("_otaPending", v.version); }catch(e){}
          return up.set({id:b.id}).then(function(){ return true; });
        });
    }).catch(function(e){
      var m=(e&&e.message)||String(e);
      if(toast) toast("⚠ "+m);
      try{ cloud.logEvent('error','canal '+mcChannel()+': '+m.slice(0,200)); }catch(_){}
      return false;
    });
};

window._mcNewerVer=function(a,b){
  a=String(a).split("."); b=String(b).split(".");
  for(var i=0;i<Math.max(a.length,b.length);i++){
    var x=parseInt(a[i]||0,10), y=parseInt(b[i]||0,10);
    if(x!==y) return x>y;
  }
  return false;
};

window._mcNotifyUpdate=function(version, kind){
  var title="Aely";
  var body=kind==="apk"&&version?tf("upd_notif_apk",{v:version}):(version?tf("upd_notif",{v:version}):t("upd_notif_web"));
  try{
    var nat=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.MiCartera;
    if(nat&&nat.showNotification){
      // `tag` para que el nativo use un id ESTABLE y el aviso se sustituya en vez de apilarse
      // («las notis se duplican», 2026-07-26). Con APK vieja se ignora sin romper nada.
      var opts={title:title, body:body, tag:"update|"+(kind==="apk"?"apk":"ota")};
      if(_mcNative) opts.gotoTarget=kind==="apk"?"update|apk":"update|ota";
      nat.showNotification(opts).catch(function(){});
      // Marca en nativo para que el worker no vuelva a avisar la misma versión.
      try{
        if(nat.syncOtaState){
          var patch={version:CONFIG.APP_VERSION};
          if(kind==="apk") patch.markNotifiedApk=version;
          else if(version) patch.markNotifiedVer=version;
          nat.syncOtaState(patch).catch(function(){});
        }
      }catch(e){}
      return;
    }
  }catch(e){}
  /* Camino WEB (sin plugin nativo). `new Notification(...)` NO vale en una página controlada por
     un Service Worker: Chrome —y por tanto Android entero— lanza «Illegal constructor. Use
     ServiceWorkerRegistration.showNotification() instead». Esta app SIEMPRE tiene SW, así que ese
     camino estaba roto desde el principio; se veía en la telemetría (app_events 24/07, canal beta)
     como promesa sin capturar, porque el `new Notification` de dentro del `.then` escapaba del
     try/catch de fuera — un try SÍNCRONO no atrapa lo que peta dentro de una promesa.
     Ahora se pide la notificación al registro del SW, con el constructor como último recurso
     (navegadores de escritorio antiguos sin SW). Detectado 2026-07-25. */
  var tag="mc-update-"+(version||"web");
  var pintar=function(){
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.ready){
        navigator.serviceWorker.ready.then(function(reg){
          if(reg && reg.showNotification) reg.showNotification(title,{body:body, tag:tag});
          else new Notification(title,{body:body, tag:tag});
        }).catch(function(){});
        return;
      }
      new Notification(title,{body:body, tag:tag});
    }catch(e){}
  };
  try{
    if(typeof Notification!=="undefined"){
      if(Notification.permission==="granted"){
        pintar();
      }else if(Notification.permission==="default"){
        // .catch además del .then: si el usuario deniega o el navegador rechaza la promesa,
        // antes quedaba otra promesa sin capturar que ensuciaba la telemetría de errores.
        Notification.requestPermission().then(function(p){
          if(p==="granted") pintar();
        }).catch(function(){});
      }
    }
  }catch(e){}
};

/* Al arrancar: enseña al worker qué versión web hay (tras OTA ≠ versionName del APK) y
   si el nativo YA avisó en background, no repetimos la noti al abrir. */
window._mcSyncOtaNative=function(){
  try{
    var nat=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.MiCartera;
    if(!nat||!nat.syncOtaState) return;
    nat.syncOtaState({version:CONFIG.APP_VERSION, channel:mcChannel()}).then(function(r){
      try{
        /* Estas marcas dicen «de esta versión YA se avisó». Antes se copiaba lo que dijera el
           nativo tal cual, así que una marca VIEJA del worker de fondo pisaba la buena y el aviso
           volvía a salir — sumándose al que ya había puesto la app. Ese era el «las notis se
           duplican» que se ve desde la web (2026-07-26). Una marca solo puede ir hacia adelante. */
        var mayor=function(k, v){
          if(!v) return;
          var cur=localStorage.getItem(k);
          if(!cur || window._mcNewerVer(v, cur)) localStorage.setItem(k, v);
        };
        if(r) mayor("_otaNotifVer", r.bgNotifiedVer);
        if(r) mayor("_apkNotifVer", r.bgNotifiedApk);
      }catch(e){}
    }).catch(function(){});
  }catch(e){}
};

window._mcSignalOtaPending=function(version){
  if(!version) return;
  try{ localStorage.setItem("_otaPending", version); }catch(e){}
  try{ window.dispatchEvent(new CustomEvent("mc-ota-ready")); }catch(e){}
};

window._mcSignalOtaReady=function(id, version, opts){
  if(!id||!version) return;
  var silent=opts&&opts.silent;
  var up=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorUpdater;
  window._mcOtaReady={id:id, version:version};
  window.__mcApplyOta=function(){ try{ if(up) up.set({id:id}); }catch(e){} };
  try{ localStorage.setItem("_otaPending", version); }catch(e){}
  try{ window.dispatchEvent(new CustomEvent("mc-ota-ready")); }catch(e){}
  var lastN=null; try{ lastN=localStorage.getItem("_otaNotifVer"); }catch(e){}
  if(!silent&&lastN!==version){
    try{ localStorage.setItem("_otaNotifVer", version); }catch(e){}
    window._mcNotifyUpdate(version, "ota");
  }
};

window._mcRestoreOtaPending=function(){
  try{
    var pend=localStorage.getItem("_otaPending");
    if(!pend||!window._mcNewerVer(pend, CONFIG.APP_VERSION)) return;
    if(window._mcOtaReady&&window._mcOtaReady.id) return;
    var up=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorUpdater;
    if(!up||!up.getNext) return;
    up.getNext().then(function(next){
      // silent:false → si aún no se notificó esta versión, avisa al abrir (antes no avisaba
      // al restaurar y parecía que «solo notifica cuando entro», feedback 2026-07-16).
      if(next&&next.id) window._mcSignalOtaReady(next.id, next.version||pend, {silent:false});
    }).catch(function(){});
  }catch(e){}
};

window._mcDownloadOta=function(up, v, opts){
  var manual=opts&&opts.manual;
  var toast=opts&&opts.showToast;
  // Pill YA mientras descarga (antes solo al terminar → «tarda un montón», 2026-07-16).
  if(!manual) window._mcSignalOtaPending(v.version);
  if(manual&&toast) toast(tf("st_up_applying",{v:v.version}));
  return up.download({url:(v.url||mcUpdBase()+"bundle.zip"), version:v.version})
    .then(function(b){
      if(manual){
        try{ localStorage.setItem("_otaPending", v.version); }catch(e){}
        return up.set({id:b.id}).then(function(){ return true; });
      }
      return up.next({id:b.id}).then(function(){
        window._mcSignalOtaReady(b.id, v.version, {silent:false});
      }).then(function(){ try{ localStorage.setItem("_otaPending", v.version); }catch(e){} return true; });
    });
};

window._mcCheckOtaUpdates=function(opts){
  if(_mcOtaChecking) return Promise.resolve(false);
  var up=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorUpdater;
  if(!up) return Promise.resolve(false);
  _mcOtaChecking=true;
  var manual=opts&&opts.manual;
  // En beta, si el manifiesto no está (aún no hay ninguna beta publicada, o la release se borró),
  // se cae a estable en vez de dejar el móvil sin actualizaciones.
  return mcFetchManifest("version.json")
    .then(function(r){ return r.json(); })
    .then(function(v){
      if(!v||!v.version) return false;
      if(v.version===CONFIG.APP_VERSION){
        try{ localStorage.removeItem("_otaPending"); localStorage.removeItem("_otaNotifVer"); }catch(e){}
        return false;
      }
      if(!window._mcNewerVer(v.version, CONFIG.APP_VERSION)) return false;
      var pend=null; try{ pend=localStorage.getItem("_otaPending"); }catch(e){}
      if(pend===v.version){
        if(window._mcOtaReady&&window._mcOtaReady.id){
          if(manual&&window.__mcApplyOta) window.__mcApplyOta();
          return true;
        }
        if(up.getNext){
          return up.getNext().then(function(next){
            if(next&&next.id){
              window._mcSignalOtaReady(next.id, v.version, {silent:!manual});
              if(manual&&window.__mcApplyOta) window.__mcApplyOta();
              return true;
            }
            return window._mcDownloadOta(up, v, opts);
          });
        }
      }
      return window._mcDownloadOta(up, v, opts);
    }).catch(function(e){
      var m=(e&&e.message)||String(e);
      if(opts&&opts.showToast) opts.showToast("⚠ "+m);
      // A la telemetría también: el chequeo automático no tiene toast, y sin rastro un canal que
      // no contesta es indistinguible de «no hay nada nuevo» (así se perdieron semanas de beta).
      try{ cloud.logEvent('error','OTA '+mcChannel()+': '+m.slice(0,200)); }catch(_){}
      return false;
    }).finally(function(){ _mcOtaChecking=false; });
};

window._mcSignalApkUpdate=function(info, silent){
  window._mcApkUpdate=info;
  try{ window.dispatchEvent(new CustomEvent("mc-apk-update")); }catch(e){}
  var lastN=null; try{ lastN=localStorage.getItem("_apkNotifVer"); }catch(e){}
  if(!silent&&lastN!==info.versionName){
    try{ localStorage.setItem("_apkNotifVer", info.versionName); }catch(e){}
    window._mcNotifyUpdate(info.versionName, "apk");
  }
};

/* NINGÚN CAMINO DE LA APK SE PUEDE CALLAR (2026-07-26).
   «apk.json anuncia la 35, estoy en la 34, y al intentarlo no pasa nada»: esta función tenía
   CUATRO `return false` mudos y el de arriba del todo ni siquiera llegaba a mirar nada. El que
   contestaba era el de comparar números —el móvil leía el manifiesto de producción, que decía 34,
   y 34 no es mayor que 34—, así que la app se quedaba tan tranquila y él sin saber por qué.
   `_mcApkWhy` guarda SIEMPRE en una línea qué se ha mirado y qué ha salido (qué canal, qué número
   ofrece y cuál llevas puesto), y Ajustes lo pega al «estás a la última». Un motivo escrito vale
   más que otra ronda de suposiciones. */
window._mcApkWhy=null;
window._mcCheckApkUpdate=function(opts){
  var manual=opts&&opts.manual;
  var toast=opts&&opts.showToast;
  var autoInstall=opts&&opts.autoInstall!==false;   // al detectar APK nueva, abre el instalador sola
  var porque=function(m){ window._mcApkWhy=m; return false; };
  var mc=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.MiCartera;
  if(!mc||!mc.appInfo) return Promise.resolve(porque(t("apk_why_noapp")));
  if(!mc.installApk) return Promise.resolve(porque(t("apk_why_oldapk")));
  return mcFetchManifest("apk.json")
    .then(function(r){ var from=r.from; return Promise.resolve(r.json()).then(function(a){ return {a:a, from:from}; }); })
    .then(function(m){
      var a=m.a, canal=t(m.from==="beta"?"apk_ch_beta":"apk_ch_stable");
      if(!a||!a.versionCode||!a.url) return porque(tf("apk_why_manifest",{ch:canal}));
      return mc.appInfo().then(function(info){
        var mia=info&&info.versionCode!=null?Number(info.versionCode):null;
        if(mia==null) return porque(t("apk_why_noinfo"));
        window._mcApkWhy=tf("apk_why_state",{ch:canal, want:String(a.versionCode), have:String(mia)});
        if(Number(a.versionCode)<=mia) return false;
        var payload={url:a.url, versionName:a.versionName||("v"+a.versionCode)};
        window._mcSignalApkUpdate(payload, !!manual);
        var startInstall=function(){
          if(toast) toast(tf("st_up_apk",{v:payload.versionName}));
          return mc.installApk({url:payload.url}).then(function(r){
            if(r&&r.needsPermission&&toast) toast(t("apk_perm"));
            return true;
          });
        };
        // Manual (Ajustes / deep-link noti) o auto al abrir: mismo camino — Android exige
        // un «Instalar» del sistema, pero ya no hace falta encontrar el pill (familia 2026-07-17).
        if(manual || autoInstall){
          if(manual) return startInstall();
          return new Promise(function(resolve){
            setTimeout(function(){
              startInstall().then(resolve).catch(function(){ resolve(true); });
            }, 900);
          });
        }
        return true;
      });
    }).catch(function(e){
      var m=(e&&e.message)||String(e);
      window._mcApkWhy="⚠ "+m;
      if(toast&&manual) toast("⚠ "+m);
      try{ cloud.logEvent('error','APK '+mcChannel()+': '+m.slice(0,200)); }catch(_){}
      return false;
    });
};

(function(){
  try{
    var up=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.CapacitorUpdater;
    if(!up) return;
    up.notifyAppReady().catch(function(){});
    window._mcSyncOtaNative();
    window._mcRestoreOtaPending();
    setTimeout(function(){
      window._mcCheckOtaUpdates();
      window._mcCheckApkUpdate();
    }, 120);
  }catch(e){}
})();

if('serviceWorker' in navigator && location.protocol.indexOf('http')===0 && !_mcNative){
  // El SW es stale-while-revalidate: arranque INSTANTÁNEO desde caché y la versión fresca
  // se descarga por detrás. NO forzamos skipWaiting solos (eso causaba el "se abre y se
  // recarga sola"). En su lugar, cuando hay una versión nueva ESPERANDO, avisamos con un
  // botón "Actualizar": SOLO al pulsarlo activamos el SW nuevo y recargamos (control del
  // usuario, sin sorpresas). Si no pulsa, la versión nueva entra sola al siguiente arranque.
  var _mcWaiting=null, _mcReloading=false, _mcUserInitiated=false;
  function _mcSignalUpdate(w){ _mcWaiting=w; try{ window.dispatchEvent(new CustomEvent('mc-sw-update')); }catch(e){} }
  window.__mcApplyUpdate=function(){
    if(!_mcWaiting){ location.reload(); return; }
    _mcUserInitiated=true;
    _mcWaiting.postMessage('skipWaiting');       // el SW en espera hace skipWaiting → controllerchange
  };
  // SOLO recargamos si la actualización la pidió el usuario con el botón. Sin este guard,
  // la PRIMERA instalación del SW (clients.claim) dispara controllerchange y recargaría sola
  // — el viejo bug "se abre y se recarga" (v3.20) que no queremos de vuelta.
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(!_mcUserInitiated || _mcReloading) return; _mcReloading=true; location.reload();
  });
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){
      if(reg.waiting && navigator.serviceWorker.controller) _mcSignalUpdate(reg.waiting);  // ya había una esperando
      reg.addEventListener('updatefound', function(){
        var nw=reg.installing; if(!nw) return;
        nw.addEventListener('statechange', function(){
          // "installed" + ya hay controller = actualización (no es la primera instalación)
          if(nw.state==='installed' && navigator.serviceWorker.controller) _mcSignalUpdate(reg.waiting||nw);
        });
      });
    }).catch(function(){});
  });
}
/* PINTAR EL SPLASH ANTES DE MONTAR LA APP. `render()` aquí mismo encadena con el parseo del
   bundle sin soltar el hilo, así que el navegador no llegaba a pintar NADA hasta tener el árbol
   de React entero: pantalla negra y splash invisible (vídeo del usuario, 2026-07-25). Dos rAF
   sueltan el hilo el tiempo justo para que se pinte lo que ya está en el DOM —el splash— antes
   de empezar. No retrasa nada perceptible: son dos frames. */
(function(){
  var montar=function(){
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(ErrorBoundary,null,React.createElement(App)));
  };
  if(typeof requestAnimationFrame!=="function"){ montar(); return; }
  requestAnimationFrame(function(){ requestAnimationFrame(montar); });
})();
// Tras pintar Resumen: carga Sentry sin pelearse con el arranque (antes bloqueaba ~340 KB).
mcScheduleIdle(function(){ mcLoadSentryDeferred(); }, 1800);
