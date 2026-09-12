function App(){
  const [state,setStateRaw]=useState(loadState);
  const [tab,setTab]=useState(0);
  // Lazy mount: solo monta pestañas visitadas + vecinas (swipe) → menos trabajo en arranque.
  // mountNeighbors=false al cold start: NO montar Gastos/Fijos en el primer pintado (lag al
  // vaciar apps en Android — vídeo feedback 2026-07-16). Tras idle corto, vecinas OK.
  const [mountedTabs,setMountedTabs]=useState(function(){ return {}; });
  const [mountNeighbors,setMountNeighbors]=useState(false);
  const tabRef=useRef(tab); useEffect(function(){ tabRef.current=tab; });   // pestaña activa (la usa el gesto atrás nativo)
  const [tabOrderState,setTabOrderState]=useState(null);   // orden transitorio mientras arrastras una pestaña
  const tabDrag=useRef(null);
  // Nav inferior que se esconde al bajar y reaparece al subir (estilo Revolut, petición 2026-07-17).
  // navHiddenRef espeja el estado para no re-render en cada píxel de scroll; scrollTab evita que el
  // primer scroll tras cambiar de pestaña (scrollTop distinto) lo lea como un salto y esconda la barra.
  const [navHidden,setNavHidden]=useState(false);
  const navHiddenRef=useRef(false);
  const lastScrollY=useRef(0);
  const scrollTab=useRef(0);
  // Escondido RÁPIDO, sin la curva calmada de .55s (2026-08-03, bug 6 «rebote raro»). El .55s de
  // abajo es a propósito para el caso normal (bajar leyendo la lista) — «el ocultado de golpe se
  // sentía brusco» (feedback 2026-07-18) — pero ESE mismo calmado es justo el problema cuando el
  // motivo de esconder es «hemos llegado al final»: el rebote nativo (la "ola") empieza a la vez
  // que la barra, y tarda solo ~0,2-0,3 s en asentarse — mucho menos que los 0,55 s de la barra.
  // Resultado, tal y como lo describió («se queda atascado un momento y luego sí que hace la ola
  // pero es muy raro»): la barra sigue deslizándose/desvaneciéndose ENCIMA de la ola mientras esta
  // ya está en marcha, dos animaciones a ritmos distintos peleando por el mismo trozo de pantalla.
  // `botnav-hidden-fast` (ver shell.html) pone una transición corta SOLO para este caso; el
  // escondido normal al bajar sigue con su calma de siempre.
  const [navHiddenFast,setNavHiddenFast]=useState(false);
  // Botnav y ola nativa (5/8 noche + pulido 5/8 madrugada):
  // · Abajo LENTO: ok. Abajo RÁPIDO (flick): hide diferido ~450 ms tras scrollend.
  // · ARRIBA / swipe de tabs: NUNCA `botnav-ola-clear`. Ese clear↔unclear era el
  //   «aparece y desaparece todo el rato» al llegar al tope y al cambiar de pestaña
  //   (feedback 2026-08-05). La barra se queda; la ola sigue debajo.
  // · Pin breve al llegar al tope / al swipear tabs: ni hide ni clear en la racha.
  const navBotSync=useRef(0);
  const navHideArmed=useRef(false);
  const navHideFastRef=useRef(false);
  const topClearOn=useRef(false);
  const topClearTimer=useRef(0);
  const revealAfterTopClear=useRef(false);
  const navPinUntil=useRef(0);
  const navPinned=function(){ return Date.now()<navPinUntil.current; };
  const pinNavVisible=function(ms){
    navPinUntil.current=Date.now()+(ms||1200);
    if(navBotSync.current){ clearTimeout(navBotSync.current); navBotSync.current=0; }
    navHideArmed.current=false;
    revealAfterTopClear.current=false;
    if(topClearTimer.current){ clearTimeout(topClearTimer.current); topClearTimer.current=0; }
    topClearOn.current=false;
    try{
      const nav=document.querySelector(".botnav");
      if(nav) nav.classList.remove("botnav-hidden","botnav-hidden-fast","botnav-ola-clear");
    }catch(e){}
    if(navHiddenRef.current){ navHiddenRef.current=false; setNavHidden(false); setNavHiddenFast(false); }
  };
  // clear del tope: solo API residual (enterScrollHost / swipe). Ya no se ARMA en scroll ni
  // en touchmove — eso era el parpadeo.
  const beginTopClear=function(){ /* no-op: ver comentario botnav arriba */ };
  const endTopClearNow=function(doReveal){
    if(topClearTimer.current){ clearTimeout(topClearTimer.current); topClearTimer.current=0; }
    topClearOn.current=false;
    try{
      const nav=document.querySelector(".botnav");
      if(nav) nav.classList.remove("botnav-ola-clear");
    }catch(e){}
    if(doReveal && navHiddenRef.current){
      revealAfterTopClear.current=false;
      revealNav();
    } else {
      revealAfterTopClear.current=false;
    }
  };
  const scheduleEndTopClear=function(){
    if(!topClearOn.current) return;
    if(topClearTimer.current) clearTimeout(topClearTimer.current);
    topClearTimer.current=setTimeout(function(){
      topClearTimer.current=0;
      topClearOn.current=false;
      try{
        const nav=document.querySelector(".botnav");
        if(nav) nav.classList.remove("botnav-ola-clear");
      }catch(e){}
      if(revealAfterTopClear.current){
        revealAfterTopClear.current=false;
        revealNav();
      }
    }, 400);
  };
  const applyNavHide=function(){
    if(navPinned()) return;
    navBotSync.current=0;
    navHideArmed.current=false;
    navHiddenRef.current=true;
    const fast=!!navHideFastRef.current;
    try{
      const nav=document.querySelector(".botnav");
      if(nav){
        nav.classList.add("botnav-hidden");
        nav.classList.toggle("botnav-hidden-fast", fast);
      }
    }catch(e){}
    /* ⚠ CON EL DEDO PUESTO NO SE RE-RENDERIZA APP. Lo que ESCONDE la barra es la clase de arriba;
       el `setState` solo pone a React de acuerdo con el DOM, y hacerlo a mitad de gesto repinta la
       app entera — que es literalmente el rechazo 4.12.0.17 («si te mueves en Deudas/Metas y
       deslizas acto seguido, se laguea»).
       Antes esto no podía pasar porque `onPageScroll` se iba de vacío con cualquier dedo; al
       acotarlo al gesto de pestaña (11/9, para que la barra se escondiera bajando despacio) volvió
       a ser posible. Se ve en el guardián de rendimiento: aislado pasa, pero con la suite entera
       en paralelo se fue a 85 ms contra un tope de 80.
       Así que el estado se guarda y se vuelca en cuanto levanta el dedo (`onEnd`). Visualmente es
       idéntico: la clase ya está puesta. */
    if(dragging.current){ navFlush.current=true; return; }
    setNavHidden(true);
    setNavHiddenFast(fast);
  };
  const armNavHide=function(fast, inmediato){
    if(navPinned()) return;
    navHideFastRef.current=!!fast;
    if(navHideArmed.current || navHiddenRef.current){
      if(fast) navHideFastRef.current=true;
      return;
    }
    navHideArmed.current=true;
    if(navBotSync.current) clearTimeout(navBotSync.current);
    /* `inmediato` = esconderla YA, sin esperar (2026-09-11). Suyo: «la barra ocúltala antes, en
       cuanto baje, sin quitarme la animación suave». Las dos cosas a la vez sí se pueden: lo que
       da la suavidad es la TRANSICIÓN CSS de `.botnav`, no este retraso. El retraso solo servía
       para el caso de ABAJO DEL TODO, donde la ola nativa y la barra se peleaban por el mismo
       trozo de pantalla — ahí se queda tal cual. */
    if(inmediato){ applyNavHide(); return; }
    // Fallback si no hay scrollend: abajo más margen (ola del flick).
    navBotSync.current=setTimeout(applyNavHide, fast?800:550);
  };
  const revealNav=function(){
    if(navBotSync.current){ clearTimeout(navBotSync.current); navBotSync.current=0; }
    navHideArmed.current=false;
    revealAfterTopClear.current=false;
    if(topClearTimer.current){ clearTimeout(topClearTimer.current); topClearTimer.current=0; }
    topClearOn.current=false;
    try{
      const nav=document.querySelector(".botnav");
      if(nav) nav.classList.remove("botnav-hidden","botnav-hidden-fast","botnav-ola-clear");
    }catch(e){}
    if(!navHiddenRef.current) return;
    navHiddenRef.current=false;
    navHideFastRef.current=false;
    /* Misma regla que `applyNavHide` (4.19.69): con el dedo puesto solo se toca el DOM; el
       `setState` espera a soltar. Rechazo 12/9: *«si hago seguido, SUBIR en gastos… se laguea»*
       — el hide ya aplazaba, el reveal no, y al subir se repintaba App entera. */
    if(dragging.current){ navFlush.current=true; return; }
    setNavHidden(false);
    setNavHiddenFast(false);
  };
  // Marca de tiempo del último scroll REAL de una página. La usa `freezeShell` para no pagar el
  // congelado cuando no hace falta (ver allí). Se apunta antes de cualquier corte: durante el
  // gesto también interesa, porque justo eso es el momentum que se quiere detectar.
  const lastScrollAt=useRef(0);
  /* ¿Queda un `setState` de la barra pendiente de volcar al levantar el dedo? Ver `applyNavHide`. */
  const navFlush=useRef(false);
  /* PONE A REACT DE ACUERDO CON EL DOM, y hay que llamarlo desde TODOS los caminos por los que se
     suelta el dedo, no solo del limpio.
     ⚠ La primera versión (4.19.69) solo volcaba en `onEnd`, y lo cazó Cursor con el dato que lo
     cierra: **en su móvil 174 de 185 gestos acaban en `touchcancel`**, no en `touchend`. O sea que
     el volcado casi nunca habría corrido en su mano. Y lo que quedaba era peor que no aplazar
     nada: el DOM con la clase puesta, las refs en `true` y React creyendo que la barra está a la
     vista, así que **el siguiente re-render le quitaba la clase y la barra reaparecía sola**.
     Los e2e no lo ven: un gesto sintético siempre termina limpio. */
  const flushNavHide=function(){
    if(!navFlush.current) return;
    navFlush.current=false;
    setNavHidden(!!navHiddenRef.current);
    setNavHiddenFast(!!navHideFastRef.current);
  };
  /* Alto del contenido en el scroll anterior. Sirve para distinguir «ha bajado él» de «la
     pantalla se ha recolocado sola»: al tocar un chip de rol en Cartera la tarjeta estira o
     encoge, el navegador ajusta el `scrollTop` y dispara un `scroll` que NADIE ha pedido. Sin
     esto, la barra se iba en ese momento — y justo debajo del dedo que iba a tocar una pestaña.
     Se mira el ALTO y no si hay un dedo puesto, porque en su móvil tocar el chip también es un
     dedo: lo que de verdad separa los dos casos es que en uno cambia `scrollHeight` y en el otro
     no. */
  const ultimoScrollH=useRef(0);
  /* Ola nativa (`touch-action:pan-y` en `.page`) vs gestos de borde.
     Mapa: Gastos/Cartera = ola arriba y abajo (pan-y siempre). Resumen = ola solo abajo
     (arriba = perfil → `.mc-touch-own`). Plan = pan-y SIEMPRE en reposo: si lo poníamos en
     `mc-touch-own` al estar arriba, `touch-action:none` bloqueaba TAMBIÉN bajar a ver el
     contenido (feedback 5/8: «me has bloqueado incluso que pueda bajar»). El gesto de segmento
     pone/quita `mc-touch-own` solo DURANTE el tirón hacia abajo (14-v4-screens.js). */
  const syncPageTouchAction=function(pageEl, pageIdx){
    if(!pageEl||!pageEl.classList) return;
    const id=tabIds[pageIdx];
    const y=pageEl.scrollTop||0;
    const atTop=y<=2;
    // Solo Inicio arriba. Plan lo gestiona su propio listener al reclamar el segmento.
    const own=(id==="inicio" && atTop);
    pageEl.classList.toggle("mc-touch-own", !!own);
  };
  const onPageScroll=function(e){
    lastScrollAt.current=Date.now();
    /* Mientras el dedo CAMBIA DE PESTAÑA, el momentum del scroll vertical sigue disparando
       eventos. Cada uno podía llamar a setNavHidden y re-renderizar App entera a mitad del
       gesto — eso es el «si te mueves en Deudas/Metas y deslizas acto seguido, se laguea»
       (rechazo 4.12.0.17). El perfil ya congelaba el scroll; el swipe de pestañas no.

       ⚠ PERO ESTO DECÍA `if(dragging.current) return;` A SECAS, y `dragging` se pone en el
       `touchstart` de CUALQUIER gesto, no solo el de pestaña. O sea que TODOS los eventos de
       scroll con el dedo puesto se tiraban a la basura, y la barra solo podía esconderse con
       los del momentum de después de soltar: se escondía con un manotazo y NUNCA con un scroll
       lento y controlado. Eso es exactamente su «ya no lo hace apenas nunca» (11/9).
       Medido antes de tocar nada: arrastre de 369 px en Inicio → la barra no se movió; el mismo
       recorrido puesto por JS (`scrollTop=200`) → se escondió al instante. La máquina estaba
       bien; lo que no llegaba era el aviso del dedo. */
    if(dragging.current && gestureMode.current==="tab") return;
    const y=e.currentTarget.scrollTop;
    // touch-action de la página (ola vs gestos de borde): ver syncPageTouchAction.
    syncPageTouchAction(e.currentTarget, tab);
    // Cambió la pestaña (o es la primera lectura): sincroniza sin actuar. Cada .page tiene su propio
    // scrollTop y sin esto pasar de una tab scrolleada a otra escondería la barra de golpe.
    /* El pin era de 1000 ms y se comía el PRIMER gesto entero: entras en una pestaña, bajas, y la
       barra no puede esconderse hasta un segundo después — con lo que para cuando podía, el dedo
       ya había parado. 320 ms siguen cubriendo el asentamiento del cambio de pestaña, que es para
       lo que está (que no se esconda de golpe al llegar a la pestaña nueva). */
    if(scrollTab.current!==tab){ scrollTab.current=tab; lastScrollY.current=y; ultimoScrollH.current=e.currentTarget.scrollHeight; revealNav(); pinNavVisible(320); return; }
    /* Si el contenido ha cambiado de alto, este `scroll` no lo ha pedido él: es la pantalla
       recolocándose (ver `ultimoScrollH`). Se apunta la posición nueva y no se actúa. */
    const sh=e.currentTarget.scrollHeight;
    if(ultimoScrollH.current && sh!==ultimoScrollH.current){ ultimoScrollH.current=sh; lastScrollY.current=y; return; }
    ultimoScrollH.current=sh;
    const dy=y-lastScrollY.current;
    lastScrollY.current=y;
    if(y<=8){
      // Tope: barra QUIETA y visible. Sin ola-clear. Pin solo al aterrizar / al revelar,
      // no en cada frame del rubber-band (si no el pin no caduca nunca).
      if(navHiddenRef.current){
        revealNav();
        pinNavVisible(1000);
      } else {
        if(navBotSync.current){ clearTimeout(navBotSync.current); navBotSync.current=0; }
        navHideArmed.current=false;
        if(dy<-2) pinNavVisible(700);
      }
      return;
    }
    const max=e.currentTarget.scrollHeight-e.currentTarget.clientHeight;
    if(max>0 && y>=max-4){ armNavHide(true); return; }
    if(Math.abs(dy)<6) return;
    /* «En cuanto baje»: antes pedía haber bajado 56 px Y esperaba 550 ms más. Ahora basta con
       haber salido del tope y se esconde en el acto — la curva calmada de `.botnav` sigue
       poniendo la suavidad que él pide. */
    if(dy>0 && y>24){ armNavHide(false, true); }
    else if(dy<0){
      /* Cerca del fondo el rubber-band dispara `dy<0` con `y` aún alta. Revelar ahí pelea con
         el hide/ola: *«se queda a medias la barra intentando subir, luego acaba… y luego la ola»*
         (rechazo 4.19.69, 12/9). La barra solo vuelve al subir de verdad, lejos del borde. */
      if(max>0 && y>max-80) return;
      revealNav();
    }
  };
  const applyNavHideRef=useRef(applyNavHide);
  applyNavHideRef.current=applyNavHide;
  const scheduleEndTopClearRef=useRef(scheduleEndTopClear);
  scheduleEndTopClearRef.current=scheduleEndTopClear;
  useEffect(function(){
    const onScrollEnd=function(ev){
      const p=ev&&ev.target;
      const y=p&&p.scrollTop!=null?p.scrollTop:null;
      const max=p&&p.scrollHeight!=null?(p.scrollHeight-p.clientHeight):0;
      const atTop=y!=null && y<=8;
      const atBottom=max>0 && y!=null && y>=max-4;
      if(atTop){
        scheduleEndTopClearRef.current();
        // Nunca aplicar hide al llegar ARRIBA (antes el delay del borde escondía la barra en el tope).
        if(navBotSync.current){ clearTimeout(navBotSync.current); navBotSync.current=0; }
        navHideArmed.current=false;
        return;
      }
      if(!navHideArmed.current) return;
      if(navBotSync.current){ clearTimeout(navBotSync.current); navBotSync.current=0; }
      // Abajo: el stretch sigue tras scrollend — esperar antes del hide.
      const delay=(atBottom||navHideFastRef.current)?450:0;
      navBotSync.current=setTimeout(function(){ applyNavHideRef.current(); }, delay);
    };
    document.addEventListener("scrollend", onScrollEnd, true);
    return function(){ document.removeEventListener("scrollend", onScrollEnd, true); };
  },[]);
  const [trashHot,setTrashHot]=useState(false);            // papelera resaltada durante el arrastre
  const trashRef=useRef(null);
  const [addTab,setAddTab]=useState(false);                // hoja "añadir pestaña" (botón +)
  const [gotoExp,setGotoExp]=useState(null);               // punto 5: gasto a enfocar al tocar la noti ({amount,merchant,ts})
  const [gastosForceAll,setGastosForceAll]=useState(0);    // al importar una hoja, aterrizar en Gastos con el filtro en "Todo" (si no, "Este mes" tapa lo importado)
  const [planGoto,setPlanGoto]=useState(null);             // segmento de Plan a forzar desde «Ver plan» ({id,ts})
  const [tourOpen,setTourOpen]=useState(false);            // tour guiado (coach-marks)
  const [toast,setToast]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const [syncStatus,setSyncStatus]=useState({type:"idle",msg:""});

  // Persistencia DEBOUNCED (2026-07-18): antes cada set() serializaba TODO el estado a
  // localStorage en el hilo principal (varios cientos de KB) → los micro-tirones esporádicos
  // («a veces se ralentiza, cuando chuta va hiper fluida»). Ahora se escribe como mucho 1 vez
  // cada 400 ms con el último valor, y SIEMPRE se vuelca al esconder/cerrar la app (pagehide +
  // visibilitychange) para no perder nada si Android mata el proceso.
  //
  // Y desde 2026-07-24 el guardado va PARTIDO (ver mcSaveRaw en 00-core): el histórico de gastos
  // solo se reescribe cuando ha cambiado de verdad. El debounce por sí solo no bastaba, porque lo
  // que costaba caro era el TAMAÑO de cada escritura, y ese crecía cada día con el histórico: por
  // eso la app iba poniéndose más lenta cuanto más se usaba. `p.exp` recuerda si en la tanda
  // pendiente hubo algún cambio de gastos.
  const persistRef=useRef({t:null,val:null,exp:false});
  const writeNow=function(p){
    const v=p.val; const withExp=p.exp;
    p.val=null; p.exp=false;
    /* Sembrar la cartera de pruebas y recargar deja un volcado pendiente que `pagehide` fuerza
       justo después, con el estado de React de hace un momento: eso reescribía encima lo que se
       acababa de sembrar, y la cartera de pruebas volvía a estar llena. Ver `mcRecargarSinVolcar`
       en 00-core. Hallazgo de Cursor al revisar la tanda. */
    if(typeof mcSkipPersist==="function" && mcSkipPersist()) return;
    if(v!=null) mcSaveRaw(mcStateKey(), v, {expenses:withExp});
  };
  const flushPersist=useCallback(function(){
    const p=persistRef.current;
    if(p.t){ clearTimeout(p.t); p.t=null; }
    writeNow(p);
  },[]);
  const set=useCallback((updater)=>{ setStateRaw(prev=>{
    const next=typeof updater==="function"?updater(prev):updater;
    if(next===prev) return prev;
    const stamped=Object.assign({},next,{_savedAt:Date.now()});
    const p=persistRef.current;
    p.val=stamped;
    // Comparación por REFERENCIA: los updaters siempre construyen un array nuevo cuando tocan
    // gastos, así que basta con esto y cuesta cero.
    if(prev.expenses!==stamped.expenses) p.exp=true;
    if(!p.t) p.t=setTimeout(function(){ const q=persistRef.current; q.t=null; writeNow(q); },400);
    return stamped;
  }); },[]);
  useEffect(function(){
    const onVis=function(){ if(document.visibilityState==="hidden") flushPersist(); };
    document.addEventListener("visibilitychange",onVis);
    window.addEventListener("pagehide",flushPersist);
    return function(){
      flushPersist();
      document.removeEventListener("visibilitychange",onVis);
      window.removeEventListener("pagehide",flushPersist);
    };
  },[flushPersist]);
  const showToast=(m)=>{ setToast(m); setTimeout(()=>setToast(null),2200);
    // Telemetría: TODO error que ve el usuario en pantalla viaja a app_events. Antes solo se
    // subían los crashes/errores no capturados — los fallos "domados" (✕/⚠ en un toast, como el
    // permission denied del ingest) eran invisibles para el admin (bug 2026-07-11).
    try{ const s=String(m||""); if(/^[✕⚠✗]/.test(s)) cloud.logEvent('error','TOAST: '+s.slice(0,300)); }catch(e){}
  };
  // Moneda de visualización: convierte todos los importes (en €) a la moneda elegida en Ajustes.
  // GBP/CHF usan fxRates (XXX→EUR, del BCE) — si aún no ha llegado el FX, se queda en € antes
  // que enseñar un número inventado (regla de la casa: nunca inventar un tipo de cambio).
  (function(){
    const c=(state.settings&&state.settings.currency)||"EUR";
    const r=c==="EUR"?1:fxTableOf(state)[c];
    if(c!=="EUR" && r>0){ DISP.sym=CUR_SYM[c]||c; DISP.k=1/r; }
    else { DISP.sym="€"; DISP.k=1; }
  })();
  CURLANG = (state.settings&&state.settings.lang) || "es";   // idioma activo (i18n)
  SIMPLEMODE = !!(state.settings&&state.settings.simpleMode); // modo sencillo → etiquetas sin jerga

  /* ---------- Sincronización en la nube (Supabase) ---------- */
  const [session,setSession]=useState(null);
  const uid = session && session.user ? session.user.id : null;
  const stateRef=useRef(state); useEffect(function(){ stateRef.current=state; });
  const sessionRef=useRef(null);
  const cloudUpdatedAtRef=useRef(null);   // sello del servidor para sync sin pisar otro dispositivo
  const bankSyncing=useRef(false);          // evita syncs de banco solapados
  const bankJustConnected=useRef(false);    // marca la vuelta de ?bank=ok para sincronizar en cuanto haya sesión

  // Trae los gastos de la tabla y los mezcla en el estado (dedup).
  const syncCloudExpenses=function(){
    return cloud.pullExpenses().then(function(rows){
      // O: el SELECT lleva .limit(2000). Si llega lleno, hay más en la nube que no vemos — avisar.
      /* FIN-07: una descarga a medias NO es un borrado. Sin esta distinción, un pull corto
         descarta de la app todo lo de origen `supabase` que no haya llegado — que es exactamente
         cómo se le borraban los gastos viejos. Regla desde la contención 4.18.6: nunca se borra
         por ausencia. */
      const parcial=!!(rows&&rows._mcPullCapped);
      if(parcial) showToast("⚠ "+t("exp_pull_capped"));
      const delSet={}; (stateRef.current.deleted||[]).forEach(function(k){ delSet[k]=1; });
      const incoming=rows.map(expenseFromRow).filter(function(e){ return e.amount!==0 && !expenseIsTombstoned(e, delSet); });
      // La tabla `expenses` es la FUENTE DE VERDAD de los gastos de la nube: se reemplazan los
      // de origen "supabase" con lo que hay en la tabla (refresca categorías, importes y borrados).
      // Los manuales/sheet locales NO se tocan nunca (por eso esto es seguro y no borra datos).
      // Backfill: sube a la tabla TODO gasto local que aún no esté en ella (no solo los manuales).
      // Esto garantiza que la tabla sea la fuente de verdad COMPLETA antes de dejar de duplicar
      // los gastos en app_state (ver slimForCloud). Upsert idempotente (ignoreDuplicates).
      const tableKeys={}; incoming.forEach(function(e){ tableKeys[keyOfExpense(e)]=1; });
      (stateRef.current.expenses||[]).forEach(function(e){ if(e.amount!==0 && !tableKeys[keyOfExpense(e)]) subirGasto(e, "backfill"); });
      /* AQUÍ NO VA UN REPASO QUE RE-MARQUE LOS POSIBLES REPETIDOS VIEJOS (B09-D, 2026-09-08).
         Lo escribí y lo retiré: `addExpense` va con ignoreDuplicates y nunca cambia el `source` de
         una fila ya presente, así que los pendientes anteriores a esta versión siguen contando en
         el servidor hasta que él los resuelva. Tentaba arreglarlo subiendo la marca desde lo local.
         Reventaba por dos sitios (los reprodujo Codex ejecutando el bloque real):
           1. Si el móvil A ya resolvió «son distintos», la nube queda SIN marca. El móvil B, que
              aún la tiene puesta en local, no puede distinguir «fila vieja sin migrar» de
              «decisión ya tomada»: volvía a marcarla y DESHACÍA la decisión de A. Un pull no
              puede reabrir algo que él ya cerró.
           2. La fila remota puede tener otro uuid que la local (justo por ignoreDuplicates).
              `expenseCloudEq` filtra por id, el UPDATE afecta a cero filas y no da error: nos
              habríamos creído que estaba persistido.
         Para hacerlo bien hace falta decisión persistida con identidad fiable y un ACK — es el
         bloqueo de identidad de gastos, no un parche de esta ronda. */
      // "nuevo" = no lo teníamos en NINGÚN origen local (así, ya sincronizado → 0 → "Ya estás al día")
      const prevKeys={}; (stateRef.current.expenses||[]).forEach(function(e){ prevKeys[keyOfExpense(e)]=1; });
      let count=0; const seenC={};
      incoming.forEach(function(e){ const k=keyOfExpense(e); if(!seenC[k]){ seenC[k]=1; if(!prevKeys[k]) count++; } });
      set(function(prev){
        /* ANTES: `keep = filter(source!=="supabase")` + solo añadir claves nuevas. Muerto desde
           que `expenseFromRow` convierte `"supabase"`→`"manual"`: keep se quedaba con TODO lo
           local y una categoría cambiada en la nube NUNCA bajaba (Aigües viajes vs energia, 12/9).
           Ahora: `mergeExpensesFromCloud` refresca campo a campo y NUNCA borra por ausencia
           (parcial o no — la regla 4.18.6 se queda). */
        const merged=mergeExpensesFromCloud(prev.expenses, incoming);
        const next=merged.list;
        const igual=!merged.changed && next.length===(prev.expenses||[]).length
          && next.every(function(e,i){ return e===(prev.expenses||[])[i]; });
        // Call site 3/3 de fixMovInvasion (tras pull expenses). Contención 4.18.6: sin bloque (b).
        const base=Object.assign({},prev,{expenses: igual?prev.expenses:next, lastSync:Date.now()});
        const rec=reconcileObDupes(fixMovInvasion(base));
        // reconcileObDupes: solo recat (cashback); nunca DELETE automático por similitud.
        if(rec.recat.length){
          setTimeout(function(){
            rec.recat.forEach(function(r){ cloud.setExpenseCat(r.expense, r.cat).catch(function(){}); });
          },0);
        }
        return rec.state;
      });
      return { total:incoming.length, nuevos:count };
    });
  };

  // Al iniciar sesión: adopta el estado de la nube (o sube el local la 1ª vez) y trae gastos.
  const syncFromCloud=function(s, opts){
    if(!s || !s.user) return;
    const u=s.user.id;
    const freshLogin=!!(opts&&opts.freshLogin);   // acaba de INICIAR SESIÓN (no un reconecta del mismo user)
    cloud.pullState().then(function(cloudPack){
      const cloudState=cloudPack ? cloudPack.data : null;
      if(cloudPack && cloudPack.updated_at) cloudUpdatedAtRef.current=cloudPack.updated_at;
      if(cloudState && validCloudState(cloudState)){
        // LAST-WRITE-WINS: si lo LOCAL es más reciente (p.ej. cambios hechos sin conexión),
        // NO lo pisamos con la nube vieja; solo unimos los gastos (aditivo). Si la nube es más
        // nueva o igual, adoptamos su estado. Los gastos SIEMPRE se mezclan (nunca se pierden).
        // EXCEPCIÓN CLAVE (fresh login): al INICIAR SESIÓN (móvil nuevo / reinstalado) la nube es la
        // verdad SIEMPRE. Sin esto, una cartera vacía recién creada podía "ganar" y machacar la nube.
        set(function(prev){
          const merged=mergeExpenses(prev.expenses, cloudState.expenses||[]);
          const localNewer=!freshLogin && (prev._savedAt||0) > (cloudState._savedAt||0);
          const baseObj = localNewer ? Object.assign({},prev,{expenses:merged.list})
                                     : Object.assign({},prev,cloudState,{expenses:merged.list});
          // Usuario que ya tenía cartera en la nube: no repetir onboarding en otro dispositivo.
          if(freshLogin && (cloudState.accounts||[]).length) baseObj.onboarded=true;
          if(freshLogin && ((cloudState.accounts||[]).length || (cloudState.monthStartNet||0)>0)) baseObj.setupHint=false;
          // Call site 2/3 de fixMovInvasion (syncFromCloud). Contención dentro de la fn, no aquí.
          return seedFlows(fixMovInvasion(fixRevoDupes(fixInvAuto(fixInvSold(reconcileTR(baseObj))))));
        });
      } else if(cloudState){
        // llegó algo pero con forma inválida (corrupto/parcial) → NO machacar lo local; resube lo bueno
        showToast("⚠ Nube con formato inesperado: se conservan tus datos locales");
        return cloud.pushState(u, slimForCloud(stateRef.current), cloudUpdatedAtRef.current).then(function(r){
          if(r && r.updated_at) cloudUpdatedAtRef.current=r.updated_at;
        });
      } else { return cloud.pushState(u, slimForCloud(stateRef.current), cloudUpdatedAtRef.current).then(function(r){
          if(r && r.updated_at) cloudUpdatedAtRef.current=r.updated_at;
        }); }   // primera vez: sube lo que ya tienes
    }).then(function(){ return syncCloudExpenses(); })
      .catch(function(e){ if(navigator.onLine!==false) showToast("✕ Nube: "+((e&&e.message)||e)); })   // si estás sin conexión, ni avisamos (es normal)
      // Pase lo que pase, el splash se va: lo que se vea a partir de aquí ya es lo definitivo
      // (o lo mejor que hay). Ver el porqué en el script del final de shell.html.
      .then(mcBootReady, mcBootReady);
  };

  // CAPA 2 — Open Banking: lee el saldo del banco y re-ancla el motor (= editar el saldo a mano,
  // pero con el número real). opts.manual = avisa siempre (botón "Actualizar saldo").
  // (Los throttles de auto-sync BANK_SYNC_THROTTLE/BANK_FG_MIN se retiraron el 2026-07-18
  //  junto con el propio auto-sync: el banco solo se consulta a demanda.)
  const runBankSync=function(opts){
    opts=opts||{};
    if(!cloud.enabled() || !sessionRef.current || bankSyncing.current) return Promise.resolve();
    bankSyncing.current=true;
    /* Las filas de `bank_links` en crudo, EN PARALELO al sync. Hacen falta porque el sync no ve
       los enlaces `pending` (la Edge solo consulta active/expired/error), y un banco que se quedó
       a medio autorizar no salía por ningún lado: ni saldo, ni movimientos, ni aviso. Suyo, 11/9:
       «al sincronizar no sale ni un aviso ni nada, he tenido que venir aquí para ver qué pasaba».
       Va con `catch` a lista vacía: si esto falla, el sync sigue como siempre. */
    const pDb=Promise.resolve().then(function(){ return cloud.bankLinks(); }).catch(function(){ return []; });
    return Promise.all([cloud.bankSync(), pDb]).then(function(par){
      const res=par[0], dbLinks=par[1]||[];
      const links=(res&&res.links)||[];
      // Telemetría (caso CaixaBank 2026-07-11): banco que sincroniza «bien» (ok!==false) pero no
      // trae NINGUNA cuenta con saldo utilizable → invisible para el usuario (ni rol ni patrimonio).
      // Se canta a app_events con el detalle por cuenta para poder diagnosticarlo desde Actividad.
      try{
        links.forEach(function(l){
          if(!l || l.ok===false) return;
          const accs=Array.isArray(l.accounts)?l.accounts:[];
          const usable=accs.filter(function(a){ return a && a.ok!==false && pickBankBalance(a.balances)!=null; }).length;
          if(accs.length && !usable){
            cloud.logEvent('error','OB '+(l.aspsp||'?')+': sync ok pero sin cuentas con saldo utilizable',
              JSON.stringify(accs.slice(0,6).map(function(a){ return {ok:a&&a.ok, nbal:((a&&a.balances)||[]).length, types:((a&&a.balances)||[]).map(function(b){ return b&&b.type; })}; })));
          }
        });
      }catch(e){}
      const preview=applyBankBalances(stateRef.current, links);   // función pura: solo para decidir el aviso
      let obAdded=[];                                             // compras de tarjeta importadas (roles de cuenta)
      set(function(prev){
        const txs=flattenBankTx(links);
        // ORDEN anti-doble-conteo: primero entran las compras de tarjeta como gastos, y DESPUÉS
        // se re-ancla con el saldo real del banco (que ya incluye esas compras).
        const add=importObExpenses(prev, txs);
        // Aporte automático reconocido (categoría "inversion", ver importObExpenses): compra ya
        // mismo participaciones en el fondo enlazado, con el importe REAL del banco — mismo cálculo
        // que `reconcileTR` usaba a ciegas, ahora disparado por el dato de verdad (2026-08-03).
        let invState=prev;
        (add||[]).forEach(function(e){
          if(e.category!=="inversion") return;
          const ib=applyInvestBuy(invState, e.ent, e.amount);
          if(!ib) return;
          invState=ib.state;
          e.investInvId=ib.invId; e.investShares=ib.shares; e.investCInv=ib.cInv; e.investAmountEur=ib.amountEur;
        });
        obAdded=add||[];
        const baseExp=add? add.concat(invState.expenses||[]) : (invState.expenses||[]);
        // Rellena el CONCEPTO de lo que ya estaba apuntado con lo que acaba de traer el banco
        // (2026-07-24): si no, el histórico viejo —el que se consulta— seguiría sin explicar nada.
        const withNotes=enrichNotesFromBankTx(baseExp, txs);
        const withExp=(withNotes!==(invState.expenses||[])) ? Object.assign({},invState,{expenses:withNotes}) : invState;
        const r=applyBankBalances(withExp, links);
        return Object.assign({}, r.state, { lastBankSync:Date.now(), hasBankLink: links.length?true:prev.hasBankLink, bankTx: txs, bankIssues: bankIssuesOf(links, dbLinks) });
      });
      // sube las importadas a la tabla expenses (best-effort; el estado local ya las tiene)
      setTimeout(function(){ obAdded.forEach(function(e){ subirGasto(e, "ob-import"); }); }, 0);
      // En sync automática (la que dispara la noti del banco) se avisa solo de lo que ha entrado.
      // Si has pulsado tú «↻ Sincronizar bancos», esto se junta con el resultado de abajo: dos
      // avisos seguidos por una sola acción tuya eran ruido (feedback 2026-07-26).
      if(obAdded.length && !opts.manual) showToast(tf("ob_imported",{n:obAdded.length}));
      // Cajero / ATM: ofrecer la otra mitad al efectivo (nunca automático).
      (function offerAtmCash(){
        const atms=(obAdded||[]).filter(function(e){
          return e && e.category==="traspaso" && e.amount>0 && isAtmWithdrawal(e.merchant||e.obName||"");
        });
        if(!atms.length || typeof askConfirm!=="function") return;
        let i=0;
        const next=function(){
          if(i>=atms.length) return;
          const e=atms[i++];
          askConfirm({
            title:tf("ef_atm_offer_title",{x:eur(e.amount)}),
            sub:t("ef_atm_offer_sub"),
            ok:t("ef_atm_offer_yes"),
            cancel:t("ef_atm_offer_no")
          }).then(function(yes){
            if(yes){
              set(function(s){ return applyEntradaEfectivo(s, e.amount); });
              showToast(t("ef_in_done"));
            }
            next();
          });
        };
        setTimeout(next, 400);
      })();
      // Resultado por banco (servidor tolerante a fallos): aplica los que funcionaron y avisa SOLO
      // del que falló. ok===false explícito → fallo (respuestas antiguas sin 'ok' se tratan como ok).
      const bankLabelOf=function(l){ const e=entFromAspsp(l&&l.aspsp); return e?entOf(e).label:((l&&l.aspsp)||"🏦"); };
      const failed=links.filter(function(l){ return l&&l.ok===false; });
      // Saldo del banco: SOLO cuando lo pides tú (opts.manual). Antes también saltaba en cada sync
      // automático al abrir la app («el dinero de los bancos me sale, no me vale para nada»
      // — feedback 2026-07-15): el saldo ya se ve en Patrimonio, no hace falta interrumpir.
      // Resultado de pedirlo tú: UN solo mensaje que dice qué ha pasado. Antes era
      // «🏦 CaixaBank: 1.234,56 €» — un número suelto, del PRIMER banco nada más aunque hubieras
      // sincronizado tres, y con el aviso de los movimientos nuevos llegando por separado
      // («el mensaje al actualizar cuentas hay que cambiarlo a uno más claro y conciso»).
      //
      // DOS CORRECCIONES tras probarlo él en el móvil (rechazo de la 4.12.0.17): «me dice que
      // Sabadell perdió la conexión y luego sale una notificación de 4 bancos al día... los que
      // tengo son Sabadell, Caixa, Revolut y Trade Republic».
      //   1) `synced` trae una entrada por CUENTA, no por banco (mira `applyBankBalances`: el push
      //      va dentro del bucle de cuentas). Con dos cuentas en Caixa ya decía «2 bancos». Se
      //      cuentan entidades distintas.
      //   2) Y no se canta victoria con un banco caído: si hay alguno que reconectar, el aviso que
      //      manda es el ⚠ de abajo —que además abre el panel para arreglarlo—, no un «✓ al día»
      //      que dice lo contrario medio segundo después.
      const issues=bankIssuesOf(links, dbLinks);
      if(opts.manual && preview.synced.length && !issues.length){
        const ents={}; preview.synced.forEach(function(x){ if(x&&x.ent) ents[x.ent]=1; });
        const bancos=Object.keys(ents);
        let msg = bancos.length===1
          ? tf("bank_upd_one",{bank:entOf(bancos[0]).label, x:eur(preview.synced[0].bal)})
          : tf("bank_upd_n",{n:bancos.length});
        if(obAdded.length) msg += " · " + (obAdded.length===1 ? t("bank_upd_mov1") : tf("bank_upd_movn",{n:obAdded.length}));
        showToast(msg);
      }
      // ── BANCO SIN CONECTAR: avisar y dejar el banner de Cartera a la vista ─────────────────
      // Petición del padre (2026-07-24) + corrección 2026-07-26: la noti lleva a Cartera (donde
      // está el banner con el botón), NO abre sola Mis bancos ni la autorización del banco.
      // Abrir OAuth automáticamente con varios bancos caídos gastaba el permiso de un solo uso
      // (invalid_request) y dejaba al usuario dando vueltas aunque el banco dijera «OK».
      if(issues.length){
        const lbl=issues[0].ent?entOf(issues[0].ent).label:(issues[0].aspsp||"🏦");
        const claveNoti=issues[0].kind==="pending" ? "bk_notif_pending"
          : (issues[0].kind==="noacct" ? "bk_notif_noacct" : "bk_notif_one");
        const msg=issues.length>1
          ? tf("bk_notif_n",{n:issues.length})
          : tf(claveNoti,{bank:lbl});
        showToast("⚠ "+msg);
        if(opts.manual){
          const nat=natPlugin();
          if(nat&&nat.showNotification){
            try{ nat.showNotification({title:t("bk_notif_title"), body:msg, gotoTarget:"banks|"+(issues[0].aspsp||""), tag:"banks"}).catch(function(){}); }catch(e){}
          }
          // Deja Cartera delante para que el banner se vea sin buscar.
          const ci=tabOrderOf(stateRef.current).indexOf("cartera");
          if(ci>=0) setTab(ci);
        }
      }
      // Fallo NO caducado = hipo transitorio del banco (rate-limit PSD2, 5xx…): el enlace sigue
      // vivo (el servidor ya no lo marca 'expired' por un 403/404), así que no mandamos «reconéctate»
      // — solo un aviso suave y únicamente si lo pediste tú (feedback 2026-07-17: «se caen cada dos
      // por tres» era este falso positivo). En auto-sync nos callamos: se reintenta solo.
      else if(failed.length && opts.manual){ showToast("⚠ "+tf("bank_syncsoft",{bank:bankLabelOf(failed[0])})); }
      // Ni un solo banco enlazado: en vez del callejón sin salida («No tienes ningún banco
      // conectado») le abrimos el panel para que lo conecte ahí mismo.
      else if(!preview.synced.length && !links.length && opts.manual){
        showToast(t("bank_none"));
        setTimeout(function(){ try{ window.dispatchEvent(new CustomEvent("mc-open-banks",{detail:{focus:null}})); }catch(e){} }, 700);
      }
    }).catch(function(e){
      if(opts.manual || navigator.onLine!==false) showToast("⚠ "+t("bank_syncfail"));
    }).finally(function(){ bankSyncing.current=false; });
  };

  /* ── Auto-refresh de brókers al abrir (petición 2026-07-15: «que se actualicen solos») ──
     SILENCIOSO a propósito y CONSERVADOR: solo re-ancla las posiciones que YA están mapeadas
     (mismo ISIN/ticker). Nunca crea ni borra: lo nuevo se sigue revisando a mano en su tarjeta
     con su previsualización, que es donde tú decides. Sin toasts ni de éxito ni de fallo — si la
     sesión caducó o no hay red, se calla y te enteras al entrar en la tarjeta (que ya lo canta). */
  const BROKER_SYNC_THROTTLE=30*60*1000;   // 30 min: abrir la app 5 veces seguidas no machaca a TR/MI
  const brokerSyncing=useRef(false);

  // Re-ancla contra el bróker las posiciones reconocidas y sella la marca de tiempo.
  const applyBrokerPositions=function(positions, stampKey, cash){
    set(function(s){
      const keyOf=function(p){ return p.isin||p.ticker||p.name; };
      const m={};
      (positions||[]).forEach(function(po){ const sug=brokerSuggest(po, s.investments); if(sug) m[keyOf(po)]=sug; });
      const inv=(s.investments||[]).map(function(i){
        const po=(positions||[]).find(function(p){ return m[keyOf(p)]===i.id; });
        if(!po) return i;
        const patch={};
        if(po.shares!=null) patch.shares=po.shares;
        // el bróker da € (TR/MI); si la posición se muestra en $, se convierte con el cambio del BCE
        if(po.value!=null) patch.value = i.cur==="EUR" ? po.value : fromEurAmt(po.value, i.cur, s);
        if(po.cost!=null)  patch.cost  = i.cur==="EUR" ? po.cost  : fromEurAmt(po.cost,  i.cur, s);
        if(po.isin && !i.isin) patch.isin=po.isin;
        return Object.assign({},i,patch);
      });
      const stamp={}; stamp[stampKey]=Date.now();
      let next=Object.assign({},s,{investments:inv},stamp);
      // El sync general recibía `availableCash` de TR pero lo tiraba: solo la tarjeta de TR
      // re-anclaba el efectivo, así que ambos botones daban resultados distintos (2026-09-07).
      if(stampKey==="lastTrSync" && cash!=null) next=applyTrCash(next,cash,totals);
      return next;
    });
  };

  // opts.manual = botón «Sincronizar» de Cartera (2026-07-18): además de MyInvestor entra
  // Trade Republic (solo a demanda: el TR de arranque deslogueaba APKs viejos) y se salta el
  // throttle. En automático (al abrir) sigue siendo solo MI, silencioso y con throttle.
  // Aviso TR (2026-07-26): TR NO es Open Banking — va por otro camino y se quedaba mudo al
  // caducar. Ahora, si la sesión murió de verdad, hay toast + noti estable + evento para que
  // el banner de Cartera se entere, sin meterlo en bankIssuesOf.
  const signalTrDead=function(){
    try{ window.dispatchEvent(new CustomEvent("mc-tr-status",{detail:{connected:false}})); }catch(e){}
    try{
      if(localStorage.getItem("_trDeadNotif")==="1") return;
      localStorage.setItem("_trDeadNotif","1");
    }catch(e){}
    const nat=natPlugin();
    if(nat&&nat.showNotification){
      try{ nat.showNotification({title:t("bk_tr_notif_title"), body:t("bk_tr_notif_body"), gotoTarget:"tr|reconnect", tag:"tr"}).catch(function(){}); }catch(e){}
    }
  };
  /* «Sale conectado pero no te avisa ni nada que se ha conectado bien» — su rechazo de
     `4.19.0/tr-reactivo`, y el 10/9 dijo qué botón: **«sincronizar bancos el boton»**.
     El toast solo salía con `markTrConnected({ack:true})`, y eso pasaba en dos sitios: tras
     verificar el 2FA y con el «Sincronizar» de la tarjeta de TR. Sincronizar bancos dejaba TR
     conectado y se quedaba mudo, así que él no sabía si había funcionado.
     Ahora avisa, pero SOLO cuando hay algo que contar: lo pidió él (`manual`) Y TR estaba
     marcado como caído. Si ya estaba bien, sincronizar no tiene por qué felicitarse — un toast
     en cada sync es el ruido que hizo que se rechazaran los toasts del poll. */
  const signalTrAlive=function(opts){
    var revivido=false;
    try{ revivido=localStorage.getItem("_trDeadNotif")==="1"; }catch(e){}
    try{ localStorage.removeItem("_trDeadNotif"); }catch(e){}
    const ack=!!(opts&&opts.manual&&revivido);
    if(typeof markTrConnected==="function") markTrConnected(ack?{ack:true}:undefined);
    else try{ window.dispatchEvent(new CustomEvent("mc-tr-status",{detail:{connected:true, ack:ack}})); }catch(e){}
  };
  const runBrokerSync=function(opts){
    opts=opts||{};
    if(brokerSyncing.current) return Promise.resolve();
    brokerSyncing.current=true;
    const jobs=[];
    const st=stateRef.current||{};
    let touched=0; const expiredB=[];
    // Estado de TR: se consulta también en automático (solo status, sin sync) para que el
    // banner de Cartera no se quede mirando un "conectado" viejo tras matar la app.
    const bridge=(typeof trBridge==="function") ? trBridge() : null;
    if(bridge && bridge.status){
      jobs.push(Promise.resolve(bridge.status()).then(function(r){
        const hadPhone=typeof trPhoneSaved==="function"&&!!trPhoneSaved();
        if(!(r&&r.connected)){
          if(hadPhone){ expiredB.push("Trade Republic"); signalTrDead(); }
          return;
        }
        signalTrAlive({manual:opts.manual});
        if(!opts.manual || !bridge.sync) return;   // sync TR solo a demanda
        return Promise.resolve(bridge.sync()).then(function(res){
          if(res&&res.authExpired&&!res.softFail&&!res.wafBlocked){ expiredB.push("Trade Republic"); signalTrDead(); return; }
          if(!res||!res.ok||!Array.isArray(res.positions)) return;   // anti-bot/hipo: silencio, se reintenta luego
          applyBrokerPositions(res.positions, "lastTrSync", res.cash); touched++;
        });
      }).catch(function(){}));
    }
    // MyInvestor — Edge Function (funciona en web y en app)
    if(cloud.enabled() && sessionRef.current && (opts.manual || Date.now()-(st.lastMiSync||0) >= BROKER_SYNC_THROTTLE)){
      jobs.push(cloud.myinvestorStatus().then(function(r){
        if(!(r && r.status==="active")) return;               // caducada → se reconecta a mano
        return cloud.myinvestorSync().then(function(res){
          if(res&&res.authExpired){ expiredB.push("MyInvestor"); return; }
          if(!res || !res.ok || !Array.isArray(res.positions)) return;
          applyBrokerPositions(res.positions, "lastMiSync"); touched++;
        });
      }).catch(function(){}));
    }
    return Promise.all(jobs).catch(function(){}).then(function(){
      brokerSyncing.current=false;
      if(opts.manual){
        if(expiredB.length){
          showToast(tf("v4_sync_broker_exp",{b:expiredB[0]}));
          // TR: deja Cartera delante para que el banner se vea (mismo patrón que OB).
          if(expiredB[0]==="Trade Republic"){
            const ci=tabOrderOf(stateRef.current).indexOf("cartera");
            if(ci>=0) setTab(ci);
          }
        }
        else if(touched) showToast(t("v4_sync_brokers_ok"));
      }
    });
  };

  // Detecta sesión al cargar y escucha cambios (incluida la vuelta del magic link).
  useEffect(function(){
    if(!cloud.enabled()){ mcBootReady(); return; }   // sin nube no hay nada que esperar detrás del splash
    cloud.session().then(function(s){
      sessionRef.current=s; setSession(s);
      if(s) mcScheduleIdle(function(){ syncFromCloud(s); }); else mcBootReady();
    }, mcBootReady);
    cloud.onAuth(function(s, ev){
      const prev=sessionRef.current;
      const changed=(!prev&&s)||(prev&&!s)||(prev&&s&&prev.user.id!==s.user.id);
      sessionRef.current=s; setSession(s);
      // Vuelta del email de recuperación: abre el panel para poner contraseña nueva.
      if(ev==="PASSWORD_RECOVERY"){ setRecovery(true); setShowAuth(true); }
      // changed = pasó de sin-sesión a con-sesión (o cambió de usuario) → es un LOGIN → la nube manda.
      if(changed && s) syncFromCloud(s, {freshLogin:!prev});
    });
  },[]);

  // Empuja el estado a la nube (debounced) cuando cambie y haya sesión. Sin los gastos (ya en su tabla).
  // OJO con el nombre del timer: se llamaba `t` y TAPABA la función global de i18n `t()` — dentro
  // del callback `t("st_sync_conflict")` petaba («t is not a function»), el `.catch` se lo tragaba y
  // el conflicto de dos móviles NUNCA se resolvía (ni aviso ni re-sync). Bug encontrado 2026-07-24.
  useEffect(function(){
    if(!uid) return;
    const tmr=setTimeout(function(){
      cloud.pushState(uid, slimForCloud(state), cloudUpdatedAtRef.current).then(function(r){
        if(r && r.conflict){ showToast(t("st_sync_conflict")); syncFromCloud(sessionRef.current); return; }
        if(r && r.updated_at) cloudUpdatedAtRef.current=r.updated_at;
      }).catch(function(){});
    }, 1200);
    return function(){ clearTimeout(tmr); };
  },[state,uid]);

  // Auto-sincroniza los gastos al volver a primer plano (abrir la app o cambiar de app y volver).
  // THROTTLE: si acabas de sincronizar (<30s) no repetimos el pull+merge de red → evita el "lagazo"
  // al alternar apps rápido (el sync dispara una descarga y un re-render de toda la app).
  // Además: si hay bancos OB y ≥30 min desde lastBankSync → bankSync en idle (gastos de Caixa/etc.).
  const lastVisSync=useRef(0);
  useEffect(function(){
    if(!uid) return;
    const onVis=function(){
      if(document.visibilityState!=="visible") return;
      if(Date.now()-lastVisSync.current < 30000) return;   // ya sincronizado hace nada: no recargues
      lastVisSync.current=Date.now();
      syncCloudExpenses().catch(function(){});
      // (2026-07-18) Aquí había un bankSync automático al volver a primer plano. RETIRADO:
      // cada apertura disparaba una consulta PSD2 desatendida y los bancos (Caixa, Sabadell)
      // acababan tumbando el consentimiento por «uso robótico». Ahora el banco se sincroniza
      // SOLO cuando lo pides: botón «Sincronizar bancos» en Cartera, «Actualizar» en Mis
      // bancos, o la noti del banco (ajuste st_banksync_notif, que sí es un evento real).
      // APK: ping pendiente del listener de notis de banco (si la app estaba en frío).
      const nat=natPlugin();
      if(nat&&nat.consumeBankSyncPing){
        try{ nat.consumeBankSyncPing().then(function(r){
          if(r&&r.ping) mcScheduleIdle(function(){ runBankSync({}); });
        }).catch(function(){}); }catch(e){}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    // Capacitor: appStateChange (más fiable que visibility en algunos Android)
    const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    let sub=null;
    if(A&&A.addListener){
      try{ sub=A.addListener("appStateChange", function(st){ if(st&&st.isActive) onVis(); }); }catch(e){}
    }
    return function(){
      document.removeEventListener("visibilitychange", onVis);
      try{ if(sub&&sub.remove) sub.remove(); }catch(e){}
    };
  },[uid]);

  // APK alpha22: noti de Caixa/Sabadell/… → evento nativo bankNotif → sync OB (sin parsear importe).
  const lastBankNotifSync=useRef(0);
  useEffect(function(){
    if(!uid) return;
    const nat=natPlugin();
    if(!nat||!nat.addListener) return undefined;
    let h=null;
    const onPing=function(){
      if(!(stateRef.current||{}).hasBankLink) return;
      if(Date.now()-lastBankNotifSync.current < 120000) return;   // debounce web 2 min (nativo ya frena)
      lastBankNotifSync.current=Date.now();
      mcScheduleIdle(function(){ runBankSync({}); });
    };
    try{
      const p=nat.addListener("bankNotif", onPing);
      if(p&&p.then) p.then(function(handle){ h=handle; }).catch(function(){});
      else h=p;
    }catch(e){}
    return function(){ try{ if(h&&h.remove) h.remove(); }catch(e){} };
  },[uid]);

  // PUNTO 5 · Noti → ficha del gasto. Al tocar la notificación de un gasto, la parte nativa deja un
  // "goto" (token) que aquí consumimos: saltamos a la pestaña Gastos y abrimos la ficha del gasto.
  // Token: "exp|<importe>|<comercio>" (o "gastos" a secas). En frío se lee al arrancar; en caliente,
  // al volver a primer plano (visibilitychange). Solo hace algo en la app nativa (natPlugin+consumeGoto).
  const handleGoto=function(g){
    if(!g||typeof g!=="string") return;
    if(g.indexOf("bank|")===0){
      const parts=g.split("|");
      if(parts[1]==="ok"){
        showToast("✓ "+t("bank_connected"));
        set(function(s){ return s.hasBankLink?s:Object.assign({},s,{hasBankLink:true}); });
        runBankSync({manual:true});
      } else {
        const m=parts.slice(2).join("|");
        if(m.indexOf("nolink:")===0){ const nm=m.slice(7), en=entFromAspsp(nm), lbl=en?entOf(en).label:(nm||"🏦"); showToast("⚠ "+lbl+": "+t("bank_nolink")); }
        // invalid_request = permiso ya gastado o caducado (casi siempre por lanzar dos
        // autorizaciones a la vez). Mensaje propio, sin el error crudo de Enable Banking.
        else if(/invalid_request/i.test(m)) showToast("⚠ "+t("bank_error_invalid"));
        else showToast("⚠ "+t("bank_error")+(m?": "+m:""));
      }
      return;
    }
    // APK ANTES que el genérico update|: "update|apk".indexOf("update|")===0 y nunca
    // llegaba al instalador (feedback 2026-07-17 — padre/pareja tocaban la noti y no pasaba).
    if(g==="update|apk"){
      const nat=natPlugin();
      const run=function(url){
        // Igual que en el pill: una noti que al tocarla no hace nada ni dice nada es indistinguible
        // de una noti rota (2026-07-26).
        if(!nat){ showToast(t("apk_why_noapp")); return; }
        if(!nat.installApk){ showToast(t("apk_why_oldapk")); return; }
        if(!url){ showToast(window._mcApkWhy||t("st_up_ok")); return; }
        showToast(t("apk_downloading"));
        nat.installApk({url:url}).then(function(r){
          if(r&&r.needsPermission) showToast(t("apk_perm"));
        }).catch(function(e){ showToast("⚠ "+((e&&e.message)||e)); });
      };
      if(window._mcApkUpdate&&window._mcApkUpdate.url){
        run(window._mcApkUpdate.url);
        return;
      }
      // Frío: la noti abre la app antes de que el chequeo de apk.json acabe.
      if(window._mcCheckApkUpdate){
        window._mcCheckApkUpdate({manual:true, showToast:showToast}).catch(function(){});
      }
      return;
    }
    if(g==="update|ota"||g.indexOf("update|")===0){
      if(window.__mcApplyOta){ window.__mcApplyOta(); return; }
      if(window.__mcApplyUpdate){ window.__mcApplyUpdate(); return; }
      return;
    }
    // Noti «banco caído» / «TR desconectado» (2026-07-26): SOLO Cartera, con el banner a la vista.
    // Antes abría además Mis bancos (y a veces lanzaba la autorización), y con dos bancos caídos
    // se disparaban dos OAuth: la segunda volvía con invalid_request aunque el banco dijera OK.
    // El padre sigue viendo el aviso delante; el toque que reconecta es el del banner, no la noti.
    if(g==="banks" || g.indexOf("banks|")===0 || g==="tr" || g.indexOf("tr|")===0){
      const ci=tabOrderOf(stateRef.current).indexOf("cartera");
      if(ci>=0) setTab(ci);
      return;
    }
    if(g==="gastos" || g.indexOf("exp|")===0){
      const gi=tabOrderOf(stateRef.current).indexOf("gastos");
      if(gi>=0) setTab(gi);
      if(g.indexOf("exp|")===0){
        const parts=g.split("|");
        const amount=Math.abs(parseFloat(String(parts[1]||"").replace(',','.'))||0);
        const merchant=parts.slice(2).join("|").trim();   // el comercio podría llevar "|"
        syncCloudExpenses().catch(function(){});   // el gasto de la noti puede no haber bajado aún
        setGotoExp({amount:amount, merchant:merchant, ts:Date.now()});
      }
    }
  };
  useEffect(function(){
    const nat=natPlugin();
    if(!nat || !nat.consumeGoto) return;
    const pull=function(){ try{ nat.consumeGoto().then(function(r){ if(r&&r.goto) handleGoto(r.goto); }).catch(function(){}); }catch(e){} };
    pull();
    const onGoto=function(){ if(document.visibilityState==="visible") pull(); };
    document.addEventListener("visibilitychange", onGoto);
    return function(){ document.removeEventListener("visibilitychange", onGoto); };
  },[]);

  // Copia de seguridad diaria del estado completo en la nube (1×/día, tras asentarse el arranque).
  useEffect(function(){
    if(!uid) return;
    const today=new Date().toISOString().slice(0,10);
    if(state.lastBackup===today) return;
    const tm=setTimeout(function(){
      cloud.backupState(uid, stateRef.current)
        .then(function(){ set(function(s){ return Object.assign({},s,{lastBackup:today}); }); })
        .catch(function(){});   // tabla 0002 sin aplicar u offline → se reintenta otro día
    }, 4000);
    return function(){ clearTimeout(tm); };
  },[uid,state.lastBackup]);

  /* Activar el canal beta desde una URL: ?canal=beta (y ?canal=estable para volver).
     Sirve para arrancar el canal en un móvil cuya app todavía no tiene el interruptor de Ajustes.

     ⚠ EL CANAL SOLO SIRVE EN LA APP ANDROID. Las actualizaciones por canal viajan por el OTA de
     Capgo (`_mcCheckOtaUpdates`), que lo primero que hace es salirse si no existe
     `Capacitor.Plugins.CapacitorUpdater` — o sea, SIEMPRE en la web. En el navegador la versión la
     manda el Service Worker, que sirve lo que haya en GitHub Pages, o sea `main`, o sea
     producción. Por eso aquí se avisa en vez de callar: poner el canal en la web y quedarte
     esperando una beta que no puede llegar es justo la confusión que hubo el 2026-07-24.

     Sin riesgo de que te la cuelen por un enlace: la URL de la beta está fija en el código y
     apunta a la release de este mismo repo, así que lo peor que puede pasar es que recibas tu
     propia beta — y se ve en el pie de Ajustes y se desactiva en un toque. */
  useEffect(function(){
    let p=null; try{ p=new URLSearchParams(location.search); }catch(e){}
    const c=p && p.get("canal");
    if(!c || typeof mcSetChannel!=="function") return;
    try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){}
    const nativo=(typeof _mcNative!=="undefined") && _mcNative;
    if(c==="beta"){
      mcSetChannel("beta");
      showToast(nativo ? "🚧 Canal beta activado en este dispositivo"
                       : "🚧 Canal beta guardado · OJO: en el navegador NO llega la beta (solo en la app Android)");
    }
    else if(c==="estable"||c==="stable"){ mcSetChannel("stable"); showToast("📦 Canal estable"); }
    // Igual que el interruptor de Ajustes: el canal nuevo se instala en el acto, suba o baje.
    if(window._mcApplyChannelBundle) window._mcApplyChannelBundle({showToast:showToast});
  },[]);

  // CAPA 2 — vuelta del banco (?bank=ok / ?bank=error tras autorizar). Avisa y limpia la URL.
  useEffect(function(){
    if(!cloud.enabled()) return;
    let params=null; try{ params=new URLSearchParams(location.search); }catch(e){}
    const bankParam=params && params.get("bank");
    if(!bankParam) return;
    try{ history.replaceState(null, "", location.pathname + location.hash); }catch(e){}   // que no se repita al recargar
    if(bankParam==="ok"){ showToast("✓ "+t("bank_connected")); bankJustConnected.current=true; }
    else if(bankParam==="error"){
      const m=params.get("msg")||"";
      if(m.indexOf("nolink:")===0){   // autorizó pero la cuenta no está dada de alta (modo restringido EB) → mensaje accionable
        const nm=m.slice(7), e=entFromAspsp(nm), lbl=e?entOf(e).label:(nm||"🏦");
        showToast("⚠ "+lbl+": "+t("bank_nolink"));
      } else if(/invalid_request/i.test(m)){ showToast("⚠ "+t("bank_error_invalid")); }
      else { showToast("⚠ "+t("bank_error")+(m?": "+m:"")); }
    }
  },[]);

  // CAPA 2 — al abrir, el banco YA NO se sincroniza solo (2026-07-18): el sync desatendido en
  // cada apertura hacía que Caixa/Sabadell marcaran el consentimiento como uso robótico y lo
  // caducaran una y otra vez. Quedan solo dos syncs «con motivo»:
  //  · justo tras autorizar un banco (vuelta del ?bank=ok) — lo acabas de pedir tú;
  //  · la primera vez que hay banco sin movimientos capturados (bootstrap de conciliación).
  useEffect(function(){
    if(!uid) return;
    if(bankJustConnected.current){ bankJustConnected.current=false; runBankSync({manual:true}); return; }
    if(!state.hasBankLink) return;   // nadie ha conectado banco en esta cartera → no llamamos a la función
    if(typeof state.bankTx==="undefined"){ runBankSync({}); return; }   // bootstrap: solo 1 vez en la vida del enlace
  },[uid, state.hasBankLink]);

  // Y lo mismo para los brókers que SÍ sincronizan solos (TR nativo + MyInvestor): al abrir,
  // Brokers: sync suave al abrir (solo si ya conectados). Nunca crea posiciones nuevas.
  // TR/MI: authExpired/softFail/waf se callan — no piden OTP/captcha (feedback 2026-07-17).
  useEffect(function(){ if(uid) mcScheduleIdle(function(){ runBrokerSync(); }); },[uid]);

  const [showAuth,setShowAuth]=useState(false);
  const [recovery,setRecovery]=useState(false);
  const [drawerOpen,setDrawerOpen]=useState(false);
  // v4: Ajustes es push a pantalla completa (SPEC §9). drawerMounted = primera apertura.
  const [drawerMounted,setDrawerMounted]=useState(false);
  const [apuntarOpen,setApuntarOpen]=useState(false);
  // Perfil pull-down (Inicio): panel hermano al shell, como Ajustes (feedback 2026-07-17).
  const [profileOpen,setProfileOpen]=useState(false);
  const [profileMounted,setProfileMounted]=useState(false);
  const profileRef=useRef(null);
  const pDY=useRef(0), pT=useRef(0);
  useEffect(function(){ if(drawerOpen) setDrawerMounted(true); },[drawerOpen]);
  useEffect(function(){ if(profileOpen) setProfileMounted(true); },[profileOpen]);
  useBackClose(drawerOpen, function(){ setDrawerOpen(false); });
  useBackClose(profileOpen, function(){ setProfileOpen(false); });
  useEffect(function(){
    try{ window.__mcEmail=(session&&session.user&&session.user.email)||""; }catch(e){}
  },[session]);
  useBackClose(addTab, function(){ setAddTab(false); });           // gesto atrás: cierra la hoja "añadir pestaña"
  // APK Android: el gesto/botón "atrás". En navegador lo maneja la History API (useBackClose); en la
  // app nativa Capacitor NO enruta el gesto por el historial de la WebView (cierra la Activity y SALE),
  // así que lo capturamos con @capacitor/app: cerramos el overlay de arriba (_mcBackStack) o vamos al
  // Resumen; solo salimos si no hay nada que cerrar y ya estás en el Resumen.
  // (tabRef, sincronizado con la pestaña activa, se declara arriba junto a `tab`.)
  useEffect(function(){
    const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    if(!A||!A.addListener) return undefined;
    const h=A.addListener("backButton", function(){
      if(_mcBackStack.length){ const top=_mcBackStack.pop(); top._byPop=true; try{ top.close(); }catch(e){} return; }
      if(tabRef.current>0){ setTab(0); return; }
      try{ A.exitApp(); }catch(e){}
    });
    return function(){ try{ Promise.resolve(h).then(function(x){ x&&x.remove&&x.remove(); }); }catch(e){} };
  },[]);
  const [locked,setLocked]=useState(function(){ return bio.enabled(); });
  // Con el candado puesto o en pleno alta no hay ninguna cifra que pueda cambiar debajo, así que
  // el splash sobra: se retira ya en vez de robarle al usuario el segundo de espera de la nube.
  useEffect(function(){ if(locked || state.onboarded===false) mcBootReady(); },[locked, state.onboarded]);
  // Premonta Settings/Perfil en idle: la 1ª vez que arrastras salía el panel negro vacío
  // (contenido solo al soltar — feedback 2026-07-18). El shell cerrado no se ve.
  useEffect(function(){
    if(state.onboarded===false||locked) return undefined;
    var cancelled=false;
    mcScheduleIdle(function(){
      if(cancelled) return;
      setDrawerMounted(true);
      setProfileMounted(true);
    }, 1400);
    return function(){ cancelled=true; };
  },[state.onboarded, locked]);

  // Estado de conexión: la app es offline-first (todo en localStorage); esto solo informa y, al
  // reconectar, sube los cambios hechos sin red. Sin conexión NO se rompe ni se pierde nada.
  const [online,setOnline]=useState(typeof navigator==="undefined" || navigator.onLine!==false);
  const wasOnline=useRef(online);
  // Actualizaciones (SW web + OTA + APK): TODO el estado vive en useUpdates (10-app-components).
  // Antes eran tres efectos sueltos aquí — el «spaghetti» del feedback 2026-07-18.
  const upd=useUpdates();
  // («Personalizar widgets del Resumen» y su evento mc-dash-edit se retiraron el 2026-07-18:
  //  apuntaban al Dashboard v3, que ya no existe en la nav v4.)
  useEffect(function(){
    const h=function(){ setDrawerOpen(true); };
    window.addEventListener("mc-open-settings",h);
    return function(){ window.removeEventListener("mc-open-settings",h); };
  },[]);
  /* VOLVER AL PANEL DE PRUEBAS DONDE LO DEJÓ (2026-09-10).
     Probar un punto de la beta obliga a SALIR de la app —pagar, mirar el widget, abrir otra app— y
     Android le mata la WebView mientras tanto. Sin esto, cada vuelta aterriza en Inicio y hay que
     rehacer Ajustes → Revisar la beta → bajar hasta donde iba; con cinco puntos por tanda son
     cinco veces. `betaDebeReabrirse()` solo dice que sí si salió estando dentro y hace menos de
     2 h; cerrar el panel a propósito borra la marca.
     El evento va en un `setTimeout(0)` a posta: `setDrawerOpen(true)` todavía no ha montado
     Ajustes en este tick, y quien escucha `mc-open-beta-review` vive dentro. */
  useEffect(function(){
    if(typeof betaDebeReabrirse!=="function" || !betaDebeReabrirse()) return;
    setDrawerOpen(true);
    const id=setTimeout(function(){ window.dispatchEvent(new CustomEvent("mc-open-beta-review")); },0);
    return function(){ clearTimeout(id); };
  },[]);
  // «Reconectar Trade Republic» desde el banner de Cartera: abre Ajustes YA en Mis bancos
  // (con el teléfono precargado) — sin pasear al usuario por menús (UX padre 2026-07-18).
  const [banksGoto,setBanksGoto]=useState(0);
  const [banksFocus,setBanksFocus]=useState("");   // aspsp a resaltar al aterrizar en Mis bancos
  useEffect(function(){
    const h=function(e){
      setDrawerMounted(true); setDrawerOpen(true); setBanksGoto(Date.now());
      // `focus` lo manda el sync/la noti: el banco que hay que reconectar se resalta y se centra
      // en pantalla, para que no haya que buscarlo en la lista (petición 2026-07-24).
      setBanksFocus((e&&e.detail&&e.detail.focus)||"");
    };
    window.addEventListener("mc-open-banks",h);
    return function(){ window.removeEventListener("mc-open-banks",h); };
  },[]);
  /* RESYNC AUTOMÁTICO AL CAMBIAR EL ROL DE UN BANCO (2026-08-01, su rechazo de la tanda
     `bancos`: «cambiar el banco de gasto diario... sigue sin salir en gastos es absurdo»).
     `pickRole` (07-tab-patri-fijos.js) escribe el rol nuevo en `state.accounts`/`settings` al
     instante — y `expenseBankEnts` YA lo ve (se recalcula fresco cada vez, no hay caché) — pero
     eso solo decide qué banco CUENTA la próxima vez que se sincroniza. El banco nuevo puede
     llevar DÍAS sin sincronizar porque antes no era «suyo»: sus compras de esta semana existen
     en Enable Banking pero no en `state.expenses` hasta que algo pida `cloud.bankSync()`, y
     cambiar un rol no lo pedía. El usuario ve el cambio hecho en Patrimonio y espera ver sus
     compras en Gastos — no un tercer paso de «ahora sincroniza a mano». */
  useEffect(function(){
    // `runBankSync` lee `sessionRef`/`bankSyncing` (refs, siempre al día) y no cierra sobre
    // estado obsoleto, así que referenciarla aquí con deps vacías es seguro.
    const h=function(){ runBankSync(); };
    window.addEventListener("mc-bank-role-changed",h);
    return function(){ window.removeEventListener("mc-bank-role-changed",h); };
  },[]);
  // Hogar y gastos compartidos: sacado de Ajustes (2026-07-18: «es una funcionalidad de la app,
  // no un ajuste»). Se abre desde Cartera (dinero compartido) por evento, como Mis bancos.
  const [sharedOpen,setSharedOpen]=useState(false);   // SharedPanel gestiona su propio useBackClose
  useEffect(function(){
    const h=function(){ setSharedOpen(true); };
    window.addEventListener("mc-open-shared",h);
    return function(){ window.removeEventListener("mc-open-shared",h); };
  },[]);
  // Banner «Reconectar {banco}» de Cartera: el ÚNICO toque que lanza la autorización.
  // Candado compartido (bankConnectOnce): dos toques seguidos no gastan el permiso dos veces.
  const reconnectBank=function(aspsp){
    if(!cloud.enabled()||!sessionRef.current){ showToast(t("bp_need_login")); return; }
    showToast(t("bank_connecting"));
    bankConnectOnce(aspsp,"ES").then(function(d){ location.href=d.url; })
      .catch(function(e){
        if(e&&e.code==="busy"){ showToast("⚠ "+t("bank_error_busy")); return; }
        showToast("⚠ "+t("bank_error")+": "+((e&&e.message)||e));
      });
  };
  useEffect(function(){
    const on=function(){ setOnline(true); }; const off=function(){ setOnline(false); };
    window.addEventListener("online",on); window.addEventListener("offline",off);
    return function(){ window.removeEventListener("online",on); window.removeEventListener("offline",off); };
  },[]);
  useEffect(function(){
    if(online && !wasOnline.current && uid){ cloud.pushState(uid, slimForCloud(stateRef.current), cloudUpdatedAtRef.current).then(function(r){
      if(r && r.conflict){ showToast(t("st_sync_conflict")); syncFromCloud(sessionRef.current); return; }
      if(r && r.updated_at) cloudUpdatedAtRef.current=r.updated_at;
    }).catch(function(){}); }   // reconectó → sube lo de offline
    wasOnline.current=online;
  },[online,uid]);

  // Cajón de Ajustes tipo Revolut: panel full-bleed desde la izquierda; el app se emborrona debajo.
  // El SHELL del panel vive siempre montado (si no, el swipe de borde no tiene ref que mover —
  // feedback 2026-07-17). SettingsPanel (pesado) sí se monta lazy la 1ª vez.
  const drawerRef=useRef(null), appShellRef=useRef(null), gestureMode=useRef(null);
  const dW=function(){ return window.innerWidth||360; };
  const setSettingsProgress=function(p){
    const v=Math.min(1,Math.max(0,p));
    if(appShellRef.current){
      // Solo clase on/off — sin --set-p ni transform en el shell (feedback 2026-07-18).
      if(v>0.02) appShellRef.current.classList.add("settings-dim");
      else appShellRef.current.classList.remove("settings-dim");
    }
  };
  useEffect(function(){
    document.documentElement.classList.toggle("settings-open", !!drawerOpen);
    if(!dragging.current && gestureMode.current!=="drawer"){
      setSettingsProgress(drawerOpen?1:0);
      if(drawerRef.current){
        drawerRef.current.classList.toggle("open", !!drawerOpen);
        drawerRef.current.style.transform="";
      }
    }
    return function(){ document.documentElement.classList.remove("settings-open"); };
  },[drawerOpen]);
  const dimLayerRef=useRef(null);
  const setProfileProgress=function(p){
    const v=Math.min(1,Math.max(0,p));
    if(appShellRef.current){
      if(v>0.02) appShellRef.current.classList.add("profile-dim");
      else appShellRef.current.classList.remove("profile-dim");
    }
    const dim=dimLayerRef.current||document.querySelector(".profile-dim-layer");
    if(dim){
      // Opacidad fija al abrir/cerrar — NUNCA interpolar frame a frame (re-pintaba el fondo).
      dim.style.opacity=v>0.02?"1":"0";
      if(v>0.02) dim.classList.add("on"); else dim.classList.remove("on");
      if(v>0.5) dim.classList.add("blurred"); else dim.classList.remove("blurred");
    }
    try{
      const av=document.querySelector(".v4-avatar");
      if(av){ if(v>0.5) av.classList.add("pulling"); else av.classList.remove("pulling"); }
    }catch(e){}
  };
  const freezeShell=function(on, kind){
    if(!appShellRef.current) return;
    if(on){
      /* ⚠ `gesture-freeze` NO se pone al deslizar entre pestañas, y esto valía 28 ms por gesto.
         Lo único que hace esa clase es `pointer-events:none` sobre el shell… y `pointer-events`
         es una propiedad HEREDADA, así que tocarla en la raíz invalida el estilo del árbol
         ENTERO. Trazado con la CPU x6 en el escenario del rechazo: un solo `UpdateLayoutTree` de
         28,6 ms, el trozo más gordo de la tarea que rompía el frame. Tiene sentido en el perfil y
         en el cajón (se superponen y no quieres que un dedo toque lo de debajo), pero deslizando
         entre pestañas no protege de nada: un arrastre de más de 10 px ya no genera click. */
      appShellRef.current.classList.add("dragging");
      if(kind!=="tab") appShellRef.current.classList.add("gesture-freeze");
      if(kind==="profile") appShellRef.current.classList.add("profile-gesturing");
      // Bloquea el scroll de la página activa: si pelea con el gesto → lag.
      // · perfil (2026-07-18): pull-down vs scroll de Inicio.
      // · tab (2026-07-26): tras scrollear Deudas/Metas, el momentum vertical seguía vivo
      //   mientras el track se desplazaba en horizontal — rechazo 4.12.0.17.
      if((kind==="profile" || kind==="tab") && trackRef.current){
        const pageEl=trackRef.current.children[tabRef.current];
        if(pageEl){
          /* ⚠ `overflow:hidden` SOBRE UNA PÁGINA SCROLLEADA NO ES GRATIS, y era el «al entrar en
             Deudas, moverte, y luego deslizar va con muchísimo lag» (rechazos .17 → .23). El
             navegador colapsa el rango de scroll: tira el scrollTop a 0 y repinta la página
             entera, y al soltar se restaura y vuelve a repintar. Trazado con la CPU x6 en el
             escenario exacto: **321 `Paint`, 113 `UpdateLayoutTree` y 95 `Layerize` en un solo
             gesto** — no una tarea larga que salte a la vista, sino 126 ms en trocitos. Por eso
             SOLO pasaba si te habías movido dentro: sin scroll no hay nada que colapsar.

             Congelar hacía falta de verdad (el momentum vertical peleaba con el translateX del
             track), pero solo cuando hay momentum VIVO. Si scrolleaste, paraste y luego deslizas
             —que es el caso normal— no hay nada contra lo que pelear. Así que el candado caro se
             pone solo si hubo scroll en los últimos 200 ms.

             ⚠ AQUÍ VIVÍA `pageEl.style.touchAction="none"`, Y NO SERVÍA PARA NADA — salvo para
             dejar la app muerta. El navegador decide qué puede hacer con un gesto **en el
             `touchstart`**, mirando el `touch-action` de ese momento; cambiarlo con el dedo ya
             puesto no afecta al gesto en curso (así lo dice la especificación y así se comporta
             Chromium). O sea que como freno del momentum era decorativo. Lo que sí hacía era
             quedarse puesto: si el gesto no acababa en `touchend` —y no acaba casi nunca, ver
             `onCancel`—, la página se quedaba con `touch-action:none` y **el dedo dejaba de mover
             la lista** hasta el siguiente gesto que terminara bien. Medido en su móvil por CDP el
             2026-07-27: gesto cortado → dos deslizadas reales sin mover un píxel (scroll 473 →
             473 → 473) → un gesto limpio → vuelve a ir (473 → 820). Eso es el «tirón». */
          /* Abajo del todo NUNCA overflow:hidden: es el candado que deja la ola en nada aunque el
             eje ya sea vertical en el siguiente tirón (medido 5/8 + hot-patch). El translateX del
             track con momentum se aguanta con preventDefault del eje x; el candado caro solo
             aporta cuando hay scroll de verdad a mitad de lista. */
          const maxY=pageEl.scrollHeight-pageEl.clientHeight;
          const atBottom=(maxY>0 && (maxY-(pageEl.scrollTop||0))<=2);
          const conMomentum=!atBottom && (Date.now()-lastScrollAt.current)<200;
          if(conMomentum){
            pageEl.dataset.mcLockY=String(pageEl.scrollTop||0);
            pageEl.style.overflow="hidden";
          }
        }
      }
    } else {
      appShellRef.current.classList.remove("gesture-freeze","dragging","profile-gesturing");
      if(trackRef.current){
        /* Se sueltan TODAS las páginas, no solo la activa. Si el gesto cambió de pestaña,
           `tabRef` ya apunta a la nueva y la que se congeló se quedaba con el candado puesto
           para siempre. Son cuatro elementos: barato y no deja rincones. */
        const pgs=trackRef.current.children;
        for(let i=0;i<pgs.length;i++){
          const pageEl=pgs[i]; if(!pageEl||!pageEl.style) continue;
          if(pageEl.style.overflow) pageEl.style.overflow="";
          if(pageEl.style.touchAction) pageEl.style.touchAction="";   // limpia el de versiones viejas
          const y=parseFloat(pageEl.dataset.mcLockY);
          if(!isNaN(y)) try{ pageEl.scrollTop=y; }catch(e){}
          delete pageEl.dataset.mcLockY;
        }
      }
    }
  };
  // Ancla la animación del perfil al avatar REAL (vídeo Revolut 2026-07-17): transform-origin en
  // su centro y escala inicial = diámetro del avatar / ancho del panel. Se mide en cada apertura
  // (safe-area, fuente o rotación cambian el rect). offsetWidth/offsetLeft y NO getBoundingClientRect:
  // el panel puede estar ya escalado y el rect vendría transformado.
  const profSetOrigin=function(){
    const el=profileRef.current; if(!el) return;
    try{
      const av=document.querySelector(".v4-avatar"); if(!av) return;
      const a=av.getBoundingClientRect();
      const w=el.offsetWidth||window.innerWidth||360;
      const L=el.offsetLeft||0;   // panel fixed centrado (max-width 520): su borde izquierdo real
      el.style.setProperty("--pp-ox",Math.round(a.left+a.width/2-L)+"px");
      el.style.setProperty("--pp-oy",Math.round(a.top+a.height/2)+"px");
      el.style.setProperty("--pp-s0",String(Math.max(0.06,a.width/Math.max(1,w))));
    }catch(e){}
  };
  const profS0=function(){
    const el=profileRef.current;
    const v=el?parseFloat(el.style.getPropertyValue("--pp-s0")):NaN;
    return isNaN(v)?0.12:v;
  };
  /* CERRAR = ABRIR AL REVÉS (petición 2026-07-25: «es hacer exactamente lo mismo que cuando se
     abre pero al cerrarse»). Eso vale para la CURVA —lo que se siente mientras el dedo va— y por
     eso hay una sola: antes abrir dividía por 0,55 y elevaba a 0,85, y cerrar por 0,48 y a 0,88.

     ⚠ EL UMBRAL NO PUEDE SER EL MISMO, y unificarlo fue el error de la 4.11.0: cerrar pasó de
     pedir ~0,062 de la pantalla (52 px) a pedir 0,11 (94 px), **casi el doble**, y él lo cazó a la
     primera al probar la beta: «al mantener el dedo y deslizar, a la mínima vuelve a la posición
     inicial con la pantalla del perfil abierta» (veredicto de beta, 2026-07-26). El tirón de
     siempre dejó de llegar, así que el panel rebotaba a abierto una y otra vez.

     Los dos gestos no compiten contra lo mismo: ABRIR sale de Inicio, donde pelea con el scroll de
     la página y con el deslizamiento entre pestañas, así que tiene que ser deliberado; CERRAR pasa
     DENTRO del panel, donde lo único que compite es su propio scroll y eso ya se resuelve antes
     (`scrollTop`). Mismo tacto, distinto peaje — y quien venga detrás que no los vuelva a igualar. */
  const PROF_DIV=0.52, PROF_POW=0.86;
  const PROF_TH_OPEN=0.11, PROF_TH_CLOSE=0.062;
  const profResist=function(ddy){
    const h=window.innerHeight||700;
    return Math.pow(Math.min(1,Math.max(0,ddy/(h*PROF_DIV))),PROF_POW);
  };
  // ¿Ese tirón basta para cambiar de estado? Mismo criterio de velocidad, umbral por sentido.
  const profPasa=function(dist, dt, th){
    const h=window.innerHeight||700;
    return dist>h*th || ((dist/Math.max(1,dt))>0.35 && dist>28);
  };
  /* NO ACEPTAR UN GESTO NUEVO MIENTRAS EL PANEL SE ESTÁ YENDO (misma petición: «si alguien le da
     por mantener el dedo mientras se va con la animación, que no se vuelva loco»).
     La transición dura 0,48 s. Si en ese rato empieza otro gesto, lo primero que hace es poner
     `.dragging` —que es `transition:none`—, así que la animación en vuelo se corta en seco y el
     panel PEGA UN SALTO desde donde iba hasta donde diga el dedo. Con el velo y el avatar a
     medio camino, eso es exactamente «volverse loco».
     Afinado 2026-07-26 (rechazo «stopper»): el candado SE QUEDA, pero (1) se pone YA en el
     cierre real, no en el useEffect de después —si no, hay una ventana en la que un segundo
     dedo corta la animación—, (2) cerrar durante la apertura SÍ se deja (el usuario quiere
     salir; lo que se bloquea es abrir desde Inicio a mitad de transición), y (3) transitionend
     limpia el timeout y solo vale si es de la generación actual. */
  const profBusy=useRef(false), profBusyT=useRef(null), profBusyGen=useRef(0);
  const profClearBusy=function(){
    profBusy.current=false;
    if(profBusyT.current){ clearTimeout(profBusyT.current); profBusyT.current=null; }
  };
  const profMarkBusy=function(){
    const gen=++profBusyGen.current;
    profBusy.current=true;
    if(profBusyT.current) clearTimeout(profBusyT.current);
    // 500 ms = 480 de la CSS + margen pequeño. Antes 560 y se notaba «sordo» al cerrar rápido.
    profBusyT.current=setTimeout(function(){ if(profBusyGen.current===gen) profClearBusy(); }, 500);
  };
  useEffect(function(){
    const el=profileRef.current; if(!el) return undefined;
    const fin=function(e){
      if(e.target!==el || e.propertyName!=="transform") return;
      // Solo la generación en curso: un transitionend viejo no desbloquea una animación nueva.
      profClearBusy();
    };
    el.addEventListener("transitionend", fin);
    return function(){ el.removeEventListener("transitionend", fin); };
  },[]);
  useEffect(function(){
    document.documentElement.classList.toggle("profile-open", !!profileOpen);
    if(!dragging.current && gestureMode.current!=="profile"){
      // Apertura por tap / cierre programático (✕, Ajustes, atrás). El cierre por gesto ya
      // puso el candado en profileEnd; aquí cubrimos el resto.
      if(!profBusy.current) profMarkBusy();
      if(profileOpen) profSetOrigin();   // re-ancla al avatar ANTES de animar (apertura por tap)
      setProfileProgress(profileOpen?1:0);
      if(profileRef.current){
        profileRef.current.classList.toggle("open", !!profileOpen);
        profileRef.current.style.transform="";
        profileRef.current.style.opacity="";
        profileRef.current.style.borderRadius="";
      }
    }
    return function(){ document.documentElement.classList.remove("profile-open"); };
  },[profileOpen]);
  const dSX=useRef(0), dSY=useRef(0), dAx=useRef(null), dDrag=useRef(false), dDX=useRef(0), dT=useRef(0);
  const drawerStart=function(e){ const t=e.touches[0]; dSX.current=t.clientX; dSY.current=t.clientY; dAx.current=null; dDrag.current=true; dDX.current=0; dT.current=Date.now(); };
  const drawerMove=function(e){
    if(!dDrag.current) return;
    const t=e.touches[0], ddx=t.clientX-dSX.current, ddy=t.clientY-dSY.current;
    if(dAx.current===null){ if(Math.abs(ddx)<8 && Math.abs(ddy)<8) return; dAx.current=Math.abs(ddx)>Math.abs(ddy)?"x":"y"; if(dAx.current==="x"&&drawerRef.current){ drawerRef.current.classList.add("dragging"); freezeShell(true,"drawer"); } }
    if(dAx.current!=="x") return;
    // Solo cierra tirando a la izquierda (derecha→izquierda). Si tiras a la derecha, no pelea.
    if(ddx>0){ dDX.current=0; if(drawerRef.current) drawerRef.current.style.transform="translate3d(0,0,0)"; return; }
    dDX.current=ddx;
    const closeProg=Math.min(1,Math.max(0,(-ddx)/dW()));
    if(drawerRef.current) drawerRef.current.style.transform="translate3d("+(-closeProg*100)+"%,0,0)";
  };
  const drawerEnd=function(){
    if(!dDrag.current) return; dDrag.current=false;
    if(drawerRef.current) drawerRef.current.classList.remove("dragging");
    freezeShell(false);
    const dist=dDX.current;
    const dt=Math.max(1,Date.now()-dT.current);
    const vel=dist/dt;
    const closeProg=Math.min(1,Math.max(0,(-dist)/dW()));
    const flick=vel<-0.35 && dist<-24;
    if(drawerRef.current) drawerRef.current.style.transform="";
    setDrawerOpen(!(closeProg>0.35 || flick));
    setSettingsProgress(!(closeProg>0.35 || flick)?1:0);
    dAx.current=null;
  };
  // El navegador se lleva el gesto (ver `onCancel`): Ajustes se queda como estaba, sin decidir.
  const drawerCancel=function(){
    if(!dDrag.current) return; dDrag.current=false; dAx.current=null; dDX.current=0;
    if(drawerRef.current){ drawerRef.current.classList.remove("dragging"); drawerRef.current.style.transform=""; }
    freezeShell(false);
  };
  // Cerrar perfil tirando ABAJO (arriba→abajo): misma escala al avatar en reversa.
  // Abrir ya es pull-down desde Inicio; cerrar «tira hacia atrás» el mismo gesto (feedback 2026-07-17).
  const pSX=useRef(0), pSY=useRef(0), pAx=useRef(null), pDrag=useRef(false);
  /* RENDIMIENTO DEL GESTO DE CERRAR (feedback 2026-07-25: «la animación se vuelve loquísima y
     ralentiza la app»). Dos causas, las dos de libro, y la comparación con el drawer de Ajustes
     —que va fino— las canta:
       · El drawer escribe SOLO `transform: translate3d(...)`, que el compositor resuelve sin
         repintar. El perfil escribía además `borderRadius` EN CADA touchmove, y border-radius
         obliga a REPINTAR el panel entero: en un móvil de 120 Hz, hasta 120 repintados por
         segundo de una pantalla completa. La lección ya estaba escrita tres líneas más arriba
         para el velo («opacidad fija, nunca interpolar por frame») pero al radio no se le aplicó.
       · `touchmove` dispara más veces que frames pinta la pantalla, así que se hacían varias
         escrituras de estilo por frame; todas menos la última se tiran a la basura, pero cada
         una fuerza su recálculo.
     Arreglo: el radio se pone UNA vez al enganchar el gesto, y transform/opacity (las dos que sí
     son de compositor) se pintan dentro de un requestAnimationFrame, como mucho una vez por frame. */
  const pRaf=useRef(0), pNext=useRef(null);
  const profilePaint=function(){
    pRaf.current=0;
    const v=pNext.current, el=profileRef.current;
    if(!v||!el) return;
    el.style.transform="scale("+v.sc+")";
    el.style.opacity=String(v.op);
  };
  const profileQueue=function(sc,op){
    pNext.current={sc:sc,op:op};
    if(!pRaf.current) pRaf.current=requestAnimationFrame(profilePaint);
  };
  const profileCancelPaint=function(){
    if(pRaf.current){ cancelAnimationFrame(pRaf.current); pRaf.current=0; }
    pNext.current=null;
  };
  /* ENGANCHAR / SOLTAR el panel. Lo comparten los DOS gestos: la apertura (pull-down en Inicio,
     dentro de onMove) y el cierre (tirar abajo dentro del perfil, profileMove). Estaban escritos
     por duplicado y por eso la apertura se quedó sin los dos arreglos que sí recibió el cierre
     —el radio fijo de la 4.9.0 y el no-interpolar opacidad de la 4.9.1—: el usuario seguía viendo
     al ABRIR el perfil y el Resumen mezclados, y a tirones (vídeo 2026-07-25). Un solo sitio. */
  const profileGrab=function(){
    const el=profileRef.current; if(!el) return;
    profSetOrigin();                       // re-ancla al avatar REAL antes de mover nada
    el.classList.add("dragging");
    freezeShell(true,"profile");
    // Velo y radio FIJOS, una sola vez. Interpolarlos obliga a repintar la pantalla entera en
    // cada touchmove (hasta 120 veces por segundo en un móvil de 120 Hz).
    const dim=dimLayerRef.current;
    if(dim){ dim.style.opacity="1"; dim.classList.add("on"); dim.classList.remove("blurred"); }
    el.style.borderRadius="24px";
    // OPACO desde el primer píxel: el panel ocupa la pantalla entera, así que fundirlo deja ver
    // el perfil y el Resumen a la vez, los dos legibles. Lo que se mueve es la ESCALA, nunca el alfa.
    el.style.opacity="1";
    // Y el avatar se aparta: si sigue ahí mientras la tarjeta sale de él, se ven los dos.
    try{ const av=document.querySelector(".v4-avatar"); if(av) av.classList.add("pulling"); }catch(e){}
  };
  const profileRelease=function(){
    const el=profileRef.current; if(!el) return;
    profileCancelPaint();   // un frame en cola pintaría DESPUÉS de limpiar y dejaría el panel a medias
    el.classList.remove("dragging");
    el.style.transform=""; el.style.opacity=""; el.style.borderRadius="";
    freezeShell(false);
  };
  /* ¿DE QUIÉN ES ESTE DEDO: DEL CIERRE O DEL SCROLL? Se decide AL POSARLO, no en cada frame.
     Aquí estaba el fallo que sobrevivió a tres rondas de arreglos, y que ninguna prueba veía
     porque todas empezaban con el panel arriba del todo. Reproducido por fin el 2026-07-26 con el
     panel scrolleado (`scrollTop=220`, lo normal: su contenido mide ~1.680 px y él lo MIRA antes
     de cerrarlo): 132 px de arrastre hacia abajo no cerraban nada, solo scrolleaban, y al soltar
     el perfil seguía abierto. Eso es «al mantener el dedo y deslizar, a la mínima vuelve a la
     posición inicial con la pantalla del perfil abierta».
     Con la regla vieja —«mientras quede scroll, el dedo es del scroll»— para cerrar había que
     recoger los 220 px de scroll Y ADEMÁS arrastrar otros 53 en el mismo gesto: 273 px de un
     tirón en una pantalla de 851. Nadie hace eso. Ahora:
       · La FRANJA DE ARRIBA del panel es asa: un arrastre que empieza ahí cierra, esté como esté
         el scroll. Es donde vive la cabecera cuando el panel está arriba, y donde la mano va a
         buscarla igualmente cuando no lo está (la cabecera se va con el scroll: comprobado que
         apuntar a `.profile-pull-h` no sirve de nada estando abajo). Sin tocar el diseño.
       · Fuera de esa franja, manda dónde estaba el scroll al posar el dedo: arriba → cierra;
         más abajo → scrollea, y si el scroll llega al tope durante el MISMO gesto, el cierre
         toma el relevo re-anclando una vez (no en cada frame). Verificado: 220 px de scroll se
         recogen y el panel empieza a encoger sin soltar el dedo.
     Tirar hacia ARRIBA nunca es del cierre: eso siempre scrollea, se agarre donde se agarre. */
  const PROF_ASA=72;
  const pOwn=useRef(false);
  const profileStart=function(e){
    // Cerrar SÍ se deja aunque la apertura aún anime: el usuario quiere salir y el ✕ ya
    // funcionaba sin el candado. Lo que el candado debe impedir es un segundo gesto que
    // CORTE un cierre en vuelo (`.dragging` = transition:none → salto). Eso se cubre
    // poniendo el candado síncrono en profileEnd al cerrar de verdad, más pointer-events:none
    // del CSS mientras cierra. Bloquear aquí el arranque del cierre era el «stopper» de 560 ms.
    const t=e.touches[0]; pSX.current=t.clientX; pSY.current=t.clientY; pAx.current=null; pDrag.current=true; pDY.current=0; pT.current=Date.now();
    const el=profileRef.current;
    let asa=false;
    try{ asa=(t.clientY-el.getBoundingClientRect().top)<PROF_ASA; }catch(_){}
    pOwn.current = asa || !el || el.scrollTop<=0;
  };
  const profileMove=function(e){
    if(!pDrag.current) return;
    const t=e.touches[0];
    if(!pOwn.current){
      // El dedo es del scroll. Cuando llegue al tope, el cierre toma el relevo desde AQUÍ mismo:
      // re-anclar una sola vez evita el salto a miniatura que daba el re-anclaje por frame.
      if(profileRef.current && profileRef.current.scrollTop>0){
        pSX.current=t.clientX; pSY.current=t.clientY; pAx.current=null; pDY.current=0; pT.current=Date.now();
        return;
      }
      pOwn.current=true;
      pSX.current=t.clientX; pSY.current=t.clientY; pAx.current=null; pDY.current=0; pT.current=Date.now();
      return;
    }
    const ddx=t.clientX-pSX.current, ddy=t.clientY-pSY.current;
    /* ESTE preventDefault NO HACÍA NADA HASTA HOY. React registra `onTouchMove` como listener
       PASIVO, así que el navegador lo ignoraba y dejaba un aviso en consola que nadie miraba
       («Unable to preventDefault inside passive event listener invocation»). Resultado: el
       navegador se quedaba el gesto para scrollear y el cierre competía contra él y perdía. Por
       eso los listeners se registran ahora a mano con `{passive:false}` (ver el efecto de abajo).
       Solo se corta el gesto hacia ABAJO: hacia arriba el dedo es del scroll, siempre. */
    if(ddy>0 && e.cancelable) e.preventDefault();
    if(pAx.current===null){
      if(Math.abs(ddx)<8 && Math.abs(ddy)<8) return;
      pAx.current=Math.abs(ddy)>Math.abs(ddx)?"y":"x";
      if(pAx.current==="y") profileGrab();
    }
    if(pAx.current!=="y") return;
    if(ddy<=0){ pDY.current=0; profileQueue(1,1); return; }
    pDY.current=ddy;
    const s0c=profS0(), sc=1-(1-s0c)*profResist(ddy);   // misma curva que abrir, en reversa
    /* EL PANEL NO SE DESVANECE MIENTRAS ARRASTRAS (vídeo del usuario, 2026-07-25). Antes bajaba
       la opacidad hasta 0,2 (`1-resist*0.8`), y como el panel ocupa la pantalla entera el
       resultado era ver el PERFIL Y EL RESUMEN A LA VEZ, los dos legibles, superpuestos. Eso es
       lo que se veía «loquísimo»: no era solo el tirón, era la mezcla de dos pantallas.
       Lo mismo vale para ABRIR: se creyó que la apertura no interpolaba opacidad y sí lo hacía
       (`opacity: resist*3`), así que el primer tercio del tirón enseñaba las dos pantallas
       superpuestas. Los dos gestos van ahora por profileGrab(): opacos, escalando desde el
       avatar y con el velo oscureciendo el fondo. Un fundido de una capa a pantalla completa
       sobre contenido siempre da papilla, por muy suave que sea. */
    profileQueue(sc, 1);
  };
  const profileEnd=function(){
    if(!pDrag.current) return; pDrag.current=false;
    profileRelease();
    pOwn.current=false;
    if(pAx.current!=="y"){ pAx.current=null; return; }
    const dist=pDY.current;
    const dt=Math.max(1,Date.now()-pT.current);
    const stay=!profPasa(dist, dt, PROF_TH_CLOSE);
    /* EL CANDADO SOLO PARA LA ANIMACIÓN QUE CAMBIA DE ESTADO — la del panel yéndose.
       Se pone AQUÍ, síncrono, ANTES de setProfileOpen(false): si espera al useEffect, hay una
       ventana en la que un segundo touchstart todavía ve profBusy=false, engancha `.dragging`
       y corta la transición (el «vuelve loco» original). El rebote (stay=true) NO lo pone:
       bloquearlo dejaba la app sorda al segundo intento (veredicto beta 2026-07-26). */
    if(!stay) profMarkBusy();
    setProfileOpen(stay);
    setProfileProgress(stay?1:0);
    pAx.current=null; pDY.current=0;
  };

  /* LOS TOQUES DEL PERFIL SE REGISTRAN A MANO, NO POR PROPS DE REACT. React ata `onTouchStart` y
     `onTouchMove` al contenedor raíz **en modo pasivo**, y en un listener pasivo `preventDefault()`
     es papel mojado: el navegador se queda el gesto para scrollear y el cierre no tiene nada que
     hacer. Solo dejaba un aviso en consola («Unable to preventDefault inside passive event
     listener invocation») que no rompía ningún test. Con `{passive:false}` el gesto es nuestro.
     `touchcancel` cuenta como final: si el sistema se lleva el dedo (una noti, el borde de la
     pantalla) y no lo tratáramos, el panel se quedaría encogido a medias y con `.dragging` puesto,
     o sea sin transición, para siempre. */
  useEffect(function(){
    const el=profileRef.current;
    if(!el||!profileOpen) return undefined;
    el.addEventListener("touchstart", profileStart, {passive:true});
    el.addEventListener("touchmove", profileMove, {passive:false});
    el.addEventListener("touchend", profileEnd, {passive:true});
    el.addEventListener("touchcancel", profileEnd, {passive:true});
    return function(){
      el.removeEventListener("touchstart", profileStart);
      el.removeEventListener("touchmove", profileMove);
      el.removeEventListener("touchend", profileEnd);
      el.removeEventListener("touchcancel", profileEnd);
    };
  },[profileOpen]);

  const [authStart,setAuthStart]=useState("in");   // modo con el que se abre AuthPanel ("in"/"up")
  const onCloudClick=function(){
    if(!cloud.enabled()){ showToast("Nube no disponible"); return; }
    setAuthStart("in");
    setShowAuth(true);
  };
  const onSignupClick=function(){
    if(!cloud.enabled()){ showToast("Nube no disponible"); return; }
    setAuthStart("up");   // onboarding → "Crear cuenta" directo, sin pasar por el login (punto 5)
    setShowAuth(true);
  };
  const tabbarRef=useRef(null);

  const totals=useMemo(()=>{
    // Solo lo que sale de bancos de gasto diario (y a mano): si no, un cargo de Sabadell
    // «solo para ver» restaría del efectivo de TR (2026-08-05).
    // startOfMonth UNA vez: antes iba dentro del filter → N× Intl (regresión B09-B / CI tabs).
    const monthStart=startOfMonth();
    const thisMonthExp=(state.expenses||[]).filter(function(e){
      return parseDate(e.date)>=monthStart && expenseCountsCash(e, state);
    });
    const thisMonthSpent=thisMonthExp.reduce((a,e)=>a+e.amount,0);
    // Efectivo de TR = base del mes + nómina (si ya entró el último día laborable) − gasto del mes.
    // El round-up & saveback (#19) se aplican al CERRAR el mes (reconcileTR), persistidos, para que
    // todas las pestañas lean lo mismo. El mes en curso se muestra como informativo en Inversiones.
    const trAcc=state.accounts.find(a=>a.spendFrom);
    const injTR = (trAcc && nominaYaEntro()) ? accInject(trAcc) : 0;
    // si has puesto un importe a mano (roundupManual/savebackManual) manda ese; si no, se estima de los gastos
    const roundupThisMonth = trAcc ? ((trAcc.roundupManual!=null)?trAcc.roundupManual:roundupOf(thisMonthExp, trAcc.roundup||0)) : 0;
    const savebackThisMonth = trAcc ? ((trAcc.savebackManual!=null)?trAcc.savebackManual:(trAcc.saveback?savebackOf(thisMonthExp):0)) : 0;
    // Aporte periódico a inversión (plan de ahorro TR, p.ej. 50€/mes al FTSE): sale del efectivo
    // y compra participaciones. Igual que el round-up, se muestra restado en vivo y se persiste al cerrar mes.
    const monthlyInvestThisMonth = trAcc ? (trAcc.monthlyInvest||0) : 0;
    const trRewardsTotal = state.trRewardsTotal||0;
    const curMonth=new Date().getMonth()+1;
    const curYear=new Date().getFullYear();
    const today=new Date().getDate();                    // día de hoy (para separar pagado/pendiente)
    // SALDO DINÁMICO: cada banco = base (inicio de mes) + movimientos YA ocurridos este mes
    // (ingresos/nómina/bizums − fijos − cuotas − puntuales − transfers). El de gasto (TR) usa su inyección.
    // La diaria resta SOLO lo suyo (`spentByBank[ent]`), no thisMonthSpent entero: si no, un
    // cargo de Revolut se come TR (257 € el 2026-08-18). thisMonthSpent se queda para Hogar / fallback.
    const paidNetByBank={};
    state.accounts.forEach(function(a){ if(accFixed(a)) paidNetByBank[a.ent]=(paidNetByBank[a.ent]||0)+monthNetForAccount(state,a.ent,curYear,curMonth,today); });
    const dailyEnt=trAcc&&trAcc.ent;
    const spentByBank=gastoDelMesPorBanco(thisMonthExp, dailyEnt);
    // el round-up y el aporte periódico del mes ya salieron del efectivo de gasto (TR) hacia la inversión (en tránsito)
    const dynBal=function(a){
      return saldoCuentaMostrada(a, {
        injTR:injTR, spentByBank:spentByBank, paidNetByBank:paidNetByBank,
        roundup:roundupThisMonth, monthlyInvest:monthlyInvestThisMonth
      });
    };
    // cuentas extra de Open Banking (2ª cuenta de un banco, compartidas…): saldo puro, suma al líquido
    const obLiquid=(state.obAccounts||[]).reduce((a,o)=> a + toEurAmt(o.value||0, o.cur||"EUR", state), 0);
    const liquid=state.accounts.reduce((a,i)=> a + dynBal(i), 0) + obLiquid;
    const investedBase=state.investments.reduce((a,i)=>a+invValueEur(i, state),0);
    const investedCost=state.investments.reduce((a,i)=>a+invCostEur(i, state),0);
    const invested=investedBase + roundupThisMonth + savebackThisMonth + monthlyInvestThisMonth;
    const assetsTotal=state.assets.reduce((a,i)=>a+i.value,0);
    const debtTotal=state.debts.reduce((a,d)=>a+debtBalance(d),0);   // saldo proyectado (baja solo cada mes)
    const activos=liquid+invested+assetsTotal;
    const netWorth=activos-debtTotal;
    const delta=netWorth-state.monthStartNet;
    const deltaPct=state.monthStartNet?delta/state.monthStartNet*100:0;
    const fijosVar=state.fixed.reduce((a,e)=>a+e.amount*(FREQ_M[e.freq]||1),0);
    const cuotas=state.debts.reduce((a,d)=>a+(debtActive(d)?(d.monthly||0):0),0);
    const fijosMensual=fijosVar+cuotas;
    const ahorroMensual=state.aportaciones.reduce((a,x)=>a+x.amount,0);
    // --- MOTOR DINÁMICO: cargos de fijos que tocan ESTE mes, por banco ---
    const fijosEsteMes=state.fixed.reduce((a,e)=> occursIn(e,curMonth) ? a+occAmountIn(e,curMonth) : a, 0);
    const cargosMes=fijosEsteMes+cuotas;                 // fijos del mes + cuotas de deuda (todos los bancos)
    // saldo disponible por banco (la cuenta de gasto descuenta el gasto del mes)
    const bankBal={};
    state.accounts.forEach(a=>{ bankBal[a.ent]=(bankBal[a.ent]||0)+dynBal(a); });
    // cargos del mes por banco, separando lo YA PAGADO (día ya pasado) de lo PENDIENTE.
    // El saldo del banco ya refleja lo pagado; para "lo que te queda" solo cuenta lo pendiente.
    const chargesByBank={}, pendingByBank={};
    let paidThisMonth=0, pendingThisMonth=0;
    const acc=(amt,bank,paid)=>{ chargesByBank[bank]=(chargesByBank[bank]||0)+amt;
      if(paid){ paidThisMonth+=amt; }
      else { pendingThisMonth+=amt; pendingByBank[bank]=(pendingByBank[bank]||0)+amt; } };
    state.fixed.forEach(e=>{ if(occursIn(e,curMonth)) acc(occAmountIn(e,curMonth),accOf(e),isPaidIn(e,curMonth,today)); });
    state.debts.forEach(d=>{ if(debtActive(d)) acc((d.monthly||0)+debtBalloonIn(d,curYear,curMonth),d.account||"sabadell",isDebtPaidThisMonth(d,today)); });
    (state.oneoffs||[]).forEach(o=>{ if(oneoffOccurs(o,curYear,curMonth) && (o.amount||0)!==0) acc(o.amount,o.account||"sabadell",isPaidThisMonth(o,today)); });
    // --- CASH-FLOW: ingresos (nómina) y transferencias recurrentes PENDIENTES este mes ---
    // El saldo del banco ya refleja lo que ya ocurrió (día pasado); solo proyectamos lo pendiente.
    const incomeInByBank={}, transferOutByBank={};
    let pendingIncome=0, pendingTransferOut=0;
    (state.flows||[]).forEach(f=>{
      if(!flowOccursIn(f,curMonth,curYear) || flowPaid(f,curYear,curMonth,today)) return;
      const amt=f.amount||0;
      if(f.kind==="income"){ const b=f.to||"sabadell"; incomeInByBank[b]=(incomeInByBank[b]||0)+amt; pendingIncome+=amt; }
      else if(f.kind==="transfer"){ const b=f.from||"sabadell"; transferOutByBank[b]=(transferOutByBank[b]||0)+amt; pendingTransferOut+=amt; }
    });
    // disponible proyectado a fin de mes por banco = saldo + ingresos pend − transfers pend − fijos pend
    const allBanks={}; [bankBal,incomeInByBank,transferOutByBank,pendingByBank].forEach(o=>Object.keys(o).forEach(b=>allBanks[b]=1));
    const projectedByBank={};
    Object.keys(allBanks).forEach(b=>{ projectedByBank[b]=(bankBal[b]||0)+(incomeInByBank[b]||0)-(transferOutByBank[b]||0)-(pendingByBank[b]||0); });
    // --- SIMULACIÓN INTRA-MES: recorre el resto del mes por día y busca el saldo MÍNIMO.
    // Importa el ORDEN: si los fijos se cobran antes de que entre la nómina, puedes quedarte
    // en negativo a mitad de mes aunque a fin de mes cuadres. Sin día: cargos al principio
    // (día 0, peor caso) e ingresos al final (día 99). ---
    const evsByBank={};
    const pushEv=(bank,day,amt)=>{ (evsByBank[bank]=evsByBank[bank]||[]).push({day:day,amt:amt}); };
    state.fixed.forEach(e=>{ if(occursIn(e,curMonth)&&!isPaidIn(e,curMonth,today)) pushEv(accOf(e), dayIn(e,curMonth)||0, -occAmountIn(e,curMonth)); });
    state.debts.forEach(d=>{ if(debtActive(d)&&!isDebtPaidThisMonth(d,today)){ pushEv(d.account||"sabadell", debtChargeDay(d), -d.monthly); const bl=debtBalloonIn(d,curYear,curMonth); if(bl>0) pushEv(d.account||"sabadell", debtChargeDay(d), -bl); } });
    (state.oneoffs||[]).forEach(o=>{ if(oneoffOccurs(o,curYear,curMonth)&&(o.amount||0)!==0&&!isPaidThisMonth(o,today)) pushEv(o.account||"sabadell", o.day||0, -o.amount); });
    (state.flows||[]).forEach(f=>{ if(!flowOccursIn(f,curMonth,curYear)||flowPaid(f,curYear,curMonth,today))return; const dd=flowDay(f,curYear,curMonth); if(f.kind==="income") pushEv(f.to||"sabadell", dd||99, f.amount); else if(f.kind==="transfer") pushEv(f.from||"sabadell", dd||0, -f.amount); });
    const minByBank={}, minDayByBank={};
    Object.keys(allBanks).forEach(b=>{ const evs=(evsByBank[b]||[]).slice().sort((x,y)=>x.day-y.day); let run=bankBal[b]||0, mn=run, md=0; evs.forEach(ev=>{ run+=ev.amt; if(run<mn-0.005){ mn=run; md=ev.day; } }); minByBank[b]=mn; minDayByBank[b]=md; });
    // foco en el banco principal de gastos fijos (Sabadell)
    const mainBank="sabadell";
    const mainBal=bankBal[mainBank]||0;
    const mainCharges=chargesByBank[mainBank]||0;
    const mainPending=pendingByBank[mainBank]||0;
    const mainIncome=incomeInByBank[mainBank]||0;
    const mainTransferOut=transferOutByBank[mainBank]||0;
    const liquidTrasFijos=mainBal-mainPending;           // lo que quedaría tras los fijos PENDIENTES (sin contar nómina/transfers)
    const mainProjected=projectedByBank[mainBank]||0;    // disponible proyectado a fin de mes (con cash-flow)
    const mainMin=minByBank[mainBank]!=null?minByBank[mainBank]:mainBal;   // saldo mínimo del mes (peor momento)
    const mainMinDay=minDayByBank[mainBank]||0;
    // alarma: el saldo mínimo del mes se va a negativo (cubre tanto el bajón intra-mes como no llegar a fin de mes)
    const bankAlerts=Object.keys(minByBank).filter(b=> minByBank[b] < -0.005);
    const sinProgramar=state.fixed.filter(needsMonth).length; // anuales sin mes asignado (nudge)
    /* DEPENDENCIAS: ojo al tocar este bloque — la lista de abajo tiene que incluir TODO
       `state.loQueSea` que se lea aquí dentro (incluidos los que leen las funciones auxiliares:
       monthNetForAccount → fixed/debts/oneoffs/flows; toEurAmt/invValueEur → fx y fxRates). */
    return {liquid,invested,investedCost,assetsTotal,debtTotal,activos,netWorth,delta,deltaPct,thisMonthSpent,spentByBank,injTR,fijosMensual,ahorroMensual,cargosMes,fijosEsteMes,liquidTrasFijos,curMonth,curYear,today,sinProgramar,bankBal,chargesByBank,pendingByBank,paidThisMonth,pendingThisMonth,mainBank,mainBal,mainCharges,mainPending,bankAlerts,incomeInByBank,transferOutByBank,pendingIncome,pendingTransferOut,projectedByBank,mainIncome,mainTransferOut,mainProjected,minByBank,minDayByBank,mainMin,mainMinDay,roundupThisMonth,savebackThisMonth,monthlyInvestThisMonth,trRewardsTotal,paidNetByBank};
  // Antes esto dependía de `[state]` entero. Como `set()` sella `_savedAt` en CADA cambio, el
  // objeto de estado es nuevo siempre → el memo NUNCA acertaba y este cálculo (que recorre gastos,
  // fijos, deudas, flujos y simula el mes día a día) se rehacía al abrir una ficha, al escribir en
  // el buscador, al salir un toast… Con las porciones reales solo se recalcula cuando cambia el
  // dinero de verdad (parte gorda del «se ralentiza cuanto más la uso» — 2026-07-24).
  },[state.accounts,state.expenses,state.investments,state.assets,state.debts,state.fixed,
     state.flows,state.oneoffs,state.aportaciones,state.obAccounts,state.monthStartNet,
     state.trRewardsTotal,state.fx,state.fxRates]);

  const [pricing,setPricing]=useState(false);
  // Tipos BCE vía frankfurter (gratis, sin key). URL canónica: api.frankfurter.dev.
  // ⚠ 2026-08-05: api.frankfurter.app hace 301 → .dev; la CSP solo tenía .app, así que en el
  // WebView el fetch moría en el redirect (mismo patrón que release-assets de GitHub). El dólar
  // «funcionaba» por el state.fx legacy; lira/libra/… daban «Sin tipo de cambio».
  // La lista sale de CUR_LIST para no desfasar selector y BCE.
  const refreshFx=function(){
    const to=CUR_LIST.filter(function(c){ return c!=="EUR"; }).join(",");
    const url="https://api.frankfurter.dev/v1/latest?from=EUR&to="+encodeURIComponent(to);
    return fetch(url).then(function(r){ if(!r||!r.ok) return null; return r.json(); }).then(function(d){
      const rates=d&&d.rates;
      if(!rates) return null;
      const fxRates={};
      for(const c in rates){ if(rates[c]>0) fxRates[c]=+(1/rates[c]).toFixed(6); }   // XXX→EUR
      const usd=fxRates.USD;
      const fxDate=d.date||null;
      set(function(s){
        const prev=fxTableOf(s);
        let changed=false;
        for(const k in fxRates){ if(Math.abs((prev[k]||0)-fxRates[k])>=0.000001){ changed=true; break; } }
        if(!changed && (usd==null || Math.abs((s.fx||0)-(usd||0))<0.0001) && s.fxDate===fxDate) return s;
        const patch={fxRates:fxRates};
        if(usd>0) patch.fx=+(usd.toFixed(4));
        if(fxDate) patch.fxDate=fxDate;
        return Object.assign({},s,patch);
      });
      return fxRates;
    }).catch(function(){ return null; });
  };
  useEffect(function(){ mcScheduleIdle(refreshFx, 4000); },[]);   // FX tras primer pintado
  useEffect(function(){ applyTheme(state.settings&&state.settings.theme); },[state.settings&&state.settings.theme]);  // tema de color
  // Accesibilidad + temática de temporada: tamaño de letra, reducir animaciones, contraste, estación.
  useEffect(function(){ applyTextSize(textSizeOf(state)); },[state.settings&&state.settings.textSize, state.settings&&state.settings.bigText]);
  useEffect(function(){ applyReduceMotion(!!(state.settings&&state.settings.reduceMotion)); },[state.settings&&state.settings.reduceMotion]);
  useEffect(function(){ applyContrast(!!(state.settings&&state.settings.hiContrast)); },[state.settings&&state.settings.hiContrast]);
  useEffect(function(){ applySeason(state.settings&&state.settings.season); },[state.settings&&state.settings.season]);
  // App Android: pide el permiso de notificaciones (Android 13+) una sola vez al arrancar.
  useEffect(function(){
    const nat=natPlugin();
    if(nat && nat.ensureNotifPerm){ try{ nat.ensureNotifPerm().catch(function(){}); }catch(e){} }
    // Aviso si el lector de gastos TR perdió el acceso a notificaciones (se pierde al
    // desinstalar/reinstalar y el gasto NO llega — bug Consum 2026-07-06). Arreglo en Ajustes.
    if(nat && nat.notifAccess){ try{ nat.notifAccess().then(function(r){ if(r&&r.granted===false) showToast(t("na_toast")); }).catch(function(){}); }catch(e){} }
  },[]);
  // Telemetría solo-admin: errores no capturados de CUALQUIER usuario → app_events (RLS: solo
  // los lee el admin) + ping 1×/día para saber quién usa la app. Cero datos financieros.
  useEffect(function(){
    const onErr=function(ev){ try{ cloud.logEvent('error', ev.message||'error', ((ev.error&&ev.error.stack)||String(ev.filename||'')+':'+(ev.lineno||'')) ); }catch(e){} };
    const onRej=function(ev){ try{ const r=ev.reason; cloud.logEvent('error', 'Promise: '+(((r&&r.message)||String(r))).slice(0,300), r&&r.stack); }catch(e){} };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return function(){ window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  },[]);
  useEffect(function(){
    if(!uid) return;
    const today=new Date().toISOString().slice(0,10);
    try{
      if(localStorage.getItem("_evPing")===today) return;
      localStorage.setItem("_evPing", today);
    }catch(e){}
    cloud.logEvent('ping','app abierta');
  },[uid]);
  // (Antes aquí saltaba un toast «🐞 N errores nuevos» en CADA apertura. Era telemetría de admin
  // interrumpiendo al usuario por algo que no puede accionar en ese momento — y como el admin usa
  // la app a diario, saltaba constantemente. RETIRADO 2026-07-15: los errores se siguen guardando y
  // se consultan cuando TÚ quieras en Ajustes → Actividad, que ya lleva su contador.)
  // Propaga al lector nativo si debe confirmar cada gasto con una noti (ajuste st_trnotif)
  // y si una noti de banco debe disparar bankSync (alpha22). Se re-envía al arrancar.
  useEffect(function(){
    const nat=natPlugin();
    if(!nat || !nat.setNotifPrefs) return;
    try{ nat.setNotifPrefs({
      expenseConfirm:!(state.settings&&state.settings.trNotifyConfirm===false),
      bankSyncOnNotif:!(state.settings&&state.settings.bankSyncOnNotif===false)
    }).catch(function(){}); }catch(e){}
  },[state.settings&&state.settings.trNotifyConfirm, state.settings&&state.settings.bankSyncOnNotif]);
  // Re-propaga al lector nativo la URL de ingest con el token del usuario (apuntado multiusuario
  // de TR, 0008). Se re-envía al arrancar y al cambiar: una reinstalación pierde las prefs nativas.
  useEffect(function(){
    const nat=natPlugin();
    if(!nat || !nat.setIngestUrl) return;
    const on=!!(state.settings&&state.settings.trIngest);
    const tok=state.settings&&state.settings.ingestToken;
    if(!on || !tok) return;
    const url=CONFIG.SUPABASE_URL+"/functions/v1/ingest?token="+encodeURIComponent(tok);
    try{ nat.setIngestUrl({url:url}).catch(function(){}); }catch(e){}
  },[state.settings&&state.settings.trIngest, state.settings&&state.settings.ingestToken]);
  // App Android: alimenta el widget de pantalla de inicio (gasto del mes + saldo de la cuenta diaria).
  // Misma cifra que Gastos/Resumen (`monthBudgetStats`), no `thisMonthSpent` (neutras/ingresos).
  const budW=monthBudgetStats(state);
  const trAccW=state.accounts.find(function(a){ return a.spendFrom; });
  const widgetCash=trAccW ? Math.round((totals.bankBal[trAccW.ent]||0)*100)/100 : null;
  // «Lo que te puedes permitir» (petición 2026-07-18): lo que puedes gastar SIN pasarte ni quedarte
  // en rojo = mínimo entre lo que te deja el presupuesto y la liquidez segura de la cuenta de gasto
  // (su peor saldo del mes; no puedes gastar lo que no tienes). Nunca negativo.
  //
  // Se mandan las DOS PIEZAS por separado, sin combinar (2026-08-17). Antes se empujaba el mínimo
  // ya hecho y el widget lo guardaba tal cual; con la app cerrada, una noti de TR/Wallet
  // actualizaba el gasto pero NO esto, así que el widget acababa diciendo «te quedan 109» y
  // «puedes gastar 324» a la vez. Ahora la resta la hace el widget con las piezas frescas:
  // `budgetLeft` se lo recalcula el servidor en cada noti, y `safeLiq` lo baja él restando el
  // importe. Aquí se sigue calculando igual — esta es la referencia de la que copia el nativo.
  const widgetBudgetLeft=(function(){
    const bl = budW.remaining!=null ? Math.max(0, budW.remaining)
      : ((state.budget>0) ? Math.max(0, state.budget - (totals.thisMonthSpent||0)) : null);
    return bl!=null ? Math.round(bl*100)/100 : null;
  })();
  const widgetSafeLiq=(function(){
    const dailyEnt = trAccW && trAccW.ent;
    if(dailyEnt==null) return null;
    const sl = Math.max(0, (totals.minByBank && totals.minByBank[dailyEnt]!=null) ? totals.minByBank[dailyEnt] : (totals.bankBal[dailyEnt]||0));
    return Math.round(sl*100)/100;
  })();
  useEffect(function(){
    const nat=natPlugin();
    if(!nat || !nat.updateWidget) return;
    const data={
      spent:Math.round((budW.shown||0)*100)/100,
      budget:budW.budget!=null?budW.budget:(state.budget||0)
    };
    if(widgetCash!=null){ data.cash=widgetCash; data.cashLabel=entOf(trAccW.ent).label; }
    if(widgetBudgetLeft!=null) data.budgetLeft=widgetBudgetLeft;
    if(widgetSafeLiq!=null) data.safeLiq=widgetSafeLiq;
    // APK 41 (la de producción) todavía lee `afford` y si no llega BORRA «Puedes gastar».
    // Las piezas nuevas son para la APK 42. Mandar las dos: 41 usa afford, 42 usa las piezas.
    const widgetAfford=widgetBudgetLeft!=null && widgetSafeLiq!=null
      ? Math.round(Math.min(widgetBudgetLeft, widgetSafeLiq)*100)/100
      : (widgetBudgetLeft!=null ? widgetBudgetLeft : widgetSafeLiq);
    if(widgetAfford!=null) data.afford=widgetAfford;
    const push=function(){ try{ nat.updateWidget(data).catch(function(){}); }catch(e){} };
    push();
    // Re-empuja al VOLVER a primer plano (feedback 2026-07-20: el widget de MIUI/HyperOS no
    // siempre coge el dato nuevo con la app cerrada). Reenvía lo último bueno para forzar el
    // re-pintado del widget aunque el estado no haya cambiado.
    const onVis=function(){ if(document.visibilityState==="visible") push(); };
    document.addEventListener("visibilitychange", onVis);
    // Android puede volver sin visibilitychange. Si ingest pisó el widget mientras estaba
    // cerrada y las cifras locales no cambian, las deps tampoco fuerzan otro push (B09-D).
    const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    let sub=null, disposed=false;
    if(A&&A.addListener){
      try{
        sub=Promise.resolve(A.addListener("appStateChange", function(st){ if(!disposed&&st&&st.isActive) push(); }));
        sub.catch(function(){});
      }catch(e){}
    }
    return function(){
      disposed=true;
      document.removeEventListener("visibilitychange", onVis);
      // addListener puede resolver después del cleanup: liberar también ese handle tardío.
      if(sub) sub.then(function(h){ if(h&&h.remove) return h.remove(); }).catch(function(){});
    };
  },[budW.shown,budW.budget,state.budget,widgetCash,widgetBudgetLeft,widgetSafeLiq]);
  // Tour de bienvenida: 1ª vez tras el onboarding (tourSeen=false), con la app ya pintada
  useEffect(function(){
    // No arrancar el tour encima del login (showAuth) ni con el cajón abierto: causaba el caos
    // "tutorial + iniciar sesión a la vez" del primer arranque.
    if(state.tourSeen===false && state.onboarded!==false && !locked && !tourOpen && !showAuth && !drawerOpen){
      const tm=setTimeout(function(){ setTourOpen(true); },700);
      return function(){ clearTimeout(tm); };
    }
  },[state.tourSeen,state.onboarded,locked,showAuth,drawerOpen]);
  const endTour=function(){
    setTourOpen(false);
    if(stateRef.current.tourSeen===false) set(function(s){ return Object.assign({},s,{tourSeen:true}); });
  };
  const openTour=function(){ setDrawerOpen(false); setProfileOpen(false); setTab(0); setTourOpen(true); };
  // ✨ Novedades: al estrenar una versión nueva, popup UNA vez (petición 2026-07-12: la pareja
  // no se entera de qué trae cada update). No en el primer arranque de un usuario nuevo (sella
  // silencioso tras el onboarding), ni encima del login/candado/tour.
  const [whatsNew,setWhatsNew]=useState(false);
  const newsTimer=useRef(null); const newsDone=useRef(false);
  // NOTAS-BUNDLE: el index ya no lleva el histórico; se pide en cuanto la app está usable
  // para que el panel de beta y Novedades no salgan vacíos el primer frame.
  const [,setRnTick]=useState(0);
  useEffect(function(){
    if(typeof ensureReleaseNotes!=="function") return;
    ensureReleaseNotes().then(function(){ setRnTick(function(n){ return n+1; }); });
  },[]);
  useEffect(function(){
    if(newsDone.current) return;
    // Espera a que la app esté lista (no encima del onboarding/candado/login/tour).
    if(state.onboarded===false || locked || showAuth || tourOpen) return;
    var seen=null; try{ seen=localStorage.getItem("_seenVersion"); }catch(e){}
    /* SE COMPARA POR VERSIÓN BASE, NO por el sello exacto (bug 2026-08-05: «me sale en beta
       todo el rato para actualizar, no sé porqué»). En beta el sello lleva sufijo de compilación
       (4.15.0.4) que sube en CADA push aunque la versión de cara al usuario (VERSION, las notas)
       sea la misma — hoy mismo salieron 4-5 compilaciones de la 4.15.0. Comparando el sello a
       pelo, el popup de Novedades volvía a saltar en cada una de ellas con las MISMAS notas: no
       hay nada nuevo que contar y aun así interrumpe. `betaChecklist`/`WhatsNew` ya casan por
       base (`mcVerBase`) para saber qué versión estás viendo; a esta puerta le faltaba el mismo
       criterio. En estable la base y el sello son el mismo string, así que no cambia nada para
       el resto de la familia. */
    if(seen===mcVerBase(CONFIG.APP_VERSION)){ newsDone.current=true; return; }   // ya vista esta versión
    if(newsTimer.current) return;                                     // ya programado: no reprogramar ni cancelar
    // OJO: NO sellamos aquí ni devolvemos cleanup que mate el timer — un re-render que cambie las
    // deps cancelaría el popup y, al re-entrar ya sellado, no volvería a disparar (bug 2026-07-12).
    // Sellamos al DISPARAR. Los usuarios nuevos ya vienen sellados por el onboarding (finish).
    newsTimer.current=setTimeout(function(){
      newsDone.current=true;
      try{ localStorage.setItem("_seenVersion",mcVerBase(CONFIG.APP_VERSION)); }catch(e){}
      setWhatsNew(true);
    },420);
  },[state.onboarded,locked,showAuth,tourOpen]);
  // Calendario de cargos del mes (fijos + cuotas) para el intercambio con el nativo: lo usan
  // el efecto de avisos de la víspera Y el push al AlertCheckWorker — misma lista en ambos.
  const alertCalendarOf=function(){
    const cm=totals.curMonth, cy=totals.curYear;
    const ym=cy+"-"+String(cm).padStart(2,"0");
    const charges=[];
    (state.fixed||[]).forEach(function(e){
      if(!occursIn(e,cm)) return;
      const d=dayIn(e,cm); const amt=occAmountIn(e,cm)||0;
      if(d==null||!(amt>0)) return;
      charges.push({id:String(e.id),name:e.name||"Recibo",amount:+amt.toFixed(2),day:d});
    });
    (state.debts||[]).forEach(function(d){
      if(!debtActive(d)||!(d.monthly>0)) return;
      charges.push({id:"debt_"+d.id,name:d.name||"Cuota",amount:+d.monthly.toFixed(2),day:debtChargeDay(d)});
    });
    const fired=[];
    charges.forEach(function(c){ try{ if(localStorage.getItem("_rc1_"+c.id+"_"+ym)==="1") fired.push(c.id); }catch(e){} });
    return {ym:ym,charges:charges,fired:fired};
  };
  // Recordatorio de recibos: TODOS avisan LA VÍSPERA (petición 2026-07-18: «el banco no te
  // avisa, la app podría»); los gordos además con 2–3 días de antelación como hasta ahora.
  // Incluye también las cuotas de deuda. Una noti por cargo y mes. Importes con eur() EXACTO:
  // redondear aquí hizo que «la luz» saliera como 90 € cuando el cargo real era 89,54 (2026-07-21).
  useEffect(function(){
    if(state.onboarded===false||locked||showAuth) return;
    const nat=natPlugin();
    if(!nat||!nat.showNotification) return;
    const today=totals.today||new Date().getDate();
    const cm=totals.curMonth;
    const minAmt=Math.max(80, (totals.fijosMensual||0)*0.12);
    const cal=alertCalendarOf();
    const ym=cal.ym;
    const notify=function(key,title,body){
      try{ if(localStorage.getItem(key)==="1") return; localStorage.setItem(key,"1"); }catch(err){}
      try{ nat.showNotification({title:title,body:body}).catch(function(){}); }catch(err){}
    };
    const run=function(){
      (state.fixed||[]).forEach(function(e){
        if(!occursIn(e,cm)) return;
        const d=dayIn(e,cm); if(d==null) return;
        if(isPaidIn(e,cm,today)) return;
        const amt=occAmountIn(e,cm)||0;
        if(!(amt>0)) return;
        const daysLeft=d-today;
        if(daysLeft===1){
          notify("_rc1_"+e.id+"_"+ym, t("rc_title_tmrw"), tf("rc_body_tmrw",{name:e.name||"?",x:eur(amt)}));
        } else if(amt>=minAmt && daysLeft>=2 && daysLeft<=3){
          notify("_rc_"+e.id+"_"+ym+"_"+d, t("rc_title"), tf("rc_body",{name:e.name||"?",x:eur(amt),d:String(d)}));
        }
      });
      // cuotas de deuda (hipoteca, financiaciones…): también avisan la víspera
      (state.debts||[]).forEach(function(d){
        if(!debtActive(d) || !(d.monthly>0)) return;
        if(isDebtPaidThisMonth(d,today)) return;
        if(debtChargeDay(d)-today!==1) return;
        notify("_rc1_debt_"+d.id+"_"+ym, t("rc_title_tmrw"), tf("rc_body_tmrw",{name:d.name||"?",x:eur(d.monthly)}));
      });
    };
    // ANTES de avisar, sella lo que el NATIVO ya avisó. Este efecto corría en paralelo al
    // intercambio de sellos (asíncrono) y ganaba la carrera: el worker había avisado la víspera
    // con el importe exacto y al abrir la app salía una SEGUNDA noti redondeada (bug 2026-07-21).
    if(nat.setAlertData){
      try{
        nat.setAlertData(cal).then(function(r){
          ((r&&r.fired)||[]).forEach(function(id){ try{ localStorage.setItem("_rc1_"+id+"_"+ym,"1"); }catch(e){} });
          run();
        }).catch(run);
      }catch(e){ run(); }
    } else run();
  },[state.onboarded,locked,showAuth,state.fixed,state.debts,totals.today,totals.curMonth]);

  // Empuja el calendario de recibos del mes al NATIVO (APK ≥29): AlertCheckWorker avisa la
  // víspera aunque la app esté CERRADA. Intercambio de sellos para no avisar dos veces:
  // mandamos lo que la web ya avisó (_rc1_*) y sellamos lo que avisó el nativo. Se mantiene
  // aparte del efecto de arriba para que el calendario llegue al worker TAMBIÉN con la app
  // bloqueada o a medio onboarding (el de arriba sale temprano en esos casos).
  useEffect(function(){
    const nat=natPlugin();
    if(!nat||!nat.setAlertData) return;
    const cal=alertCalendarOf();
    try{
      nat.setAlertData(cal).then(function(r){
        ((r&&r.fired)||[]).forEach(function(id){ try{ localStorage.setItem("_rc1_"+id+"_"+cal.ym,"1"); }catch(e){} });
      }).catch(function(){});
    }catch(e){}
  },[state.fixed,state.debts,totals.curMonth]);

  // Avisos de presupuesto al cruzar 50/80/95/100% (petición 2026-07-18). Una noti por umbral
  // y mes; si al abrir ya vas por el 97%, solo suena el umbral MÁS ALTO (los demás se sellan
  // en silencio para no disparar tres de golpe). Suena también como toast en la app.
  // Misma cifra que Resumen/Gastos (`monthBudgetStats`): sin neutras ni reservas, no
  // `thisMonthSpent` (feedback «el presupuesto no cuadra» — 2026-08-05).
  // accounts + settings enteros en deps: monthBudgetStats → expenseBankEnts (B09-A2 /
  // 2026-09-07). Sin ellos, quitar/añadir un banco de gasto diario no reevaluaba el % y
  // podía dejar selladas (o sin disparar) las banderas _bn* del mes.
  // settings entero también re-corre al cambiar expenseOrder (arrastre 4.19.0): inofensivo
  // porque _bn* son idempotentes y `seen` impide repetir el toast/noti.
  useEffect(function(){
    if(state.onboarded===false||locked) return;
    const bs=monthBudgetStats(state);
    const bud=bs.budget!=null?bs.budget:0; if(!(bud>0)) return;
    const spent=Math.max(0, bs.against||0);
    const pct=spent/bud*100;
    const ym=new Date().toISOString().slice(0,7);
    let fired=false;
    [100,95,80,50].forEach(function(th){
      if(pct<th) return;
      const k="_bn"+th+"_"+ym;
      let seen=true;
      try{ seen=localStorage.getItem(k)==="1"; localStorage.setItem(k,"1"); }catch(e){}
      if(seen||fired) return;
      fired=true;
      const msg=tf("bn_"+th,{x:eur0(spent),b:eur0(bud),p:Math.round(pct)});
      showToast(msg);
      const nat=natPlugin();
      if(nat&&nat.showNotification){ try{ nat.showNotification({title:"Aely",body:msg}).catch(function(){}); }catch(e){} }
    });
  },[state.onboarded,locked,state.expenses,state.budget,state.reservaLog,state.accounts,state.settings]);
  // Snapshot diario del total invertido (€) para el gráfico de evolución (#6). Se actualiza si cambia valor/coste hoy.
  const invSnapRef=useRef("");
  useEffect(function(){
    if(!(totals.invested>0)) return;
    const today=new Date().toISOString().slice(0,10);
    const v=+totals.invested.toFixed(2);
    const c=+(totals.investedCost||0).toFixed(2);
    const key=today+"|"+v+"|"+c;
    if(invSnapRef.current===key) return;
    invSnapRef.current=key;
    set(function(s){
      const h=recordInvSnapshot(s.invHistory, today, v, c);
      return Object.assign({},s,{invHistory:h});
    });
  },[totals.invested, totals.investedCost]);

  // GAMIFICACIÓN: detecta logros nuevos y subidas de nivel → toast/confeti (1ª vez siembra sin avisar).
  useEffect(function(){
    const g=gamifOf(state, totals);
    const stored=state.badges||[];
    const nowUnlocked=g.badges.filter(function(b){return b.unlocked;}).map(function(b){return b.id;});
    const fresh=nowUnlocked.filter(function(id){ return stored.indexOf(id)<0; });
    const seeded=state.gmLevel!=null;
    const levelUp=seeded && g.lvl>state.gmLevel;
    if(!fresh.length && !levelUp && seeded) return;
    set(function(s){ return Object.assign({},s,{badges:Array.from(new Set((s.badges||[]).concat(nowUnlocked))),gmLevel:g.lvl}); });
    if(levelUp){ showToast(tf("gm_levelup",{n:g.lvl+1})); }   // rediseño 1c: subir de nivel = aviso tranquilo, sin confeti (el confeti se reserva a metas)
    else if(fresh.length && seeded){ showToast(tf("gm_badge_new",{x:t("gm_b_"+fresh[0])})); }
  },[state.expenses,state.goals,state.budget,state.trRewardsTotal]);
  const fetchPrices=function(silent){
    refreshFx();   // y también al pulsar "Precios USD"
    const withTicker=state.investments.filter(function(i){ return i.ticker; });
    if(withTicker.length===0){ if(!silent) showToast("No hay tickers configurados"); return Promise.resolve(); }
    if(!(cloud.enabled() && uid)){ if(!silent) showToast("Inicia sesión para actualizar precios"); return Promise.resolve(); }
    if(!silent){ setPricing(true); showToast("Actualizando precios…"); }
    const symbols=Array.from(new Set(withTicker.map(function(i){ return String(i.ticker).toUpperCase(); })));
    return Promise.resolve(cloud.prices(symbols)).then(function(data){
      if(data && data.ok===false) throw new Error(data.error||"el servidor devolvió un error");
      const prices = data && (data.prices||data.quotes||data); // admite {prices:{...}} o {...}
      // si el servidor responde OK pero sin cotizaciones, no es "sin cambios": es un fallo de Finnhub
      if(!prices || Object.keys(prices).length===0){
        if(!silent) showToast("✕ Finnhub no devolvió cotizaciones");
        return;
      }
      // cuántos tickers nuestros llegan con precio válido (se calcula desde el estado actual,
      // no dentro del updater de set() que corre en diferido y dejaría el conteo en 0)
      const matched=state.investments.filter(function(i){
        return i.ticker && i.shares && prices[i.ticker]!=null && parseFloat(prices[i.ticker])>0;
      });
      set(function(prev){
        const inv=prev.investments.map(function(i){
          if(i.ticker && prices[i.ticker]!=null){
            const price=parseFloat(prices[i.ticker]);
            if(price>0 && i.shares){ return Object.assign({},i,{value:+(i.shares*price).toFixed(2)}); }
          }
          return i;
        });
        return Object.assign({},prev,{investments:inv,lastPriceSync:Date.now()});
      });
      if(!silent) showToast(matched.length>0?("✓ "+matched.length+" precios actualizados"):"Sin cambios");
    }).catch(function(err){
      if(!silent) showToast("✕ "+((err&&err.message)?err.message:"No se pudieron traer precios"));
    }).then(function(){ if(!silent) setPricing(false); });
  };

  const onSync=function(){
    if(!(cloud.enabled() && uid)){ setSyncStatus({type:"err",msg:"Inicia sesión para sincronizar"}); showToast("Inicia sesión para sincronizar"); return; }
    setSyncing(true); setSyncStatus({type:"idle",msg:"Conectando con Supabase…"});
    syncCloudExpenses().then(function(r){
      if(r.nuevos>0){ const m="✓ "+r.nuevos+(r.nuevos===1?" gasto nuevo":" gastos nuevos"); setSyncStatus({type:"",msg:m}); showToast(m); }
      else { setSyncStatus({type:"",msg:"Ya estás al día · "+r.total+" gastos en la nube"}); showToast("✓ Ya estás al día"); }
    }).catch(function(e){ setSyncStatus({type:"err",msg:"No se pudo conectar con Supabase: "+((e&&e.message)||e)}); showToast("✕ Error al sincronizar"); }).then(function(){ setSyncing(false); });
  };

  const tabIds = tabOrderState || tabOrderOf(state);
  const prepMountTab=function(i){
    var id=tabIds[i]; if(!id) return;
    setMountedTabs(function(m){ return m[id]? m : Object.assign({},m,{[id]:true}); });
  };
  const prepMountId=function(id){
    if(!id) return;
    setMountedTabs(function(m){ return m[id]? m : Object.assign({},m,{[id]:true}); });
  };
  // startTransition: la animación del track va primero; React monta la pestaña en segundo plano.
  const goTab=function(i){
    // `tabRef` y no `tab`: este cierre viaja dentro de las páginas memoizadas (ver `contenidos`
    // más abajo), que a propósito NO se rehacen al cambiar de pestaña. Leyendo `tab` se quedaría
    // con el de cuando se construyó la página y, si coincidiera con el destino, este `return`
    // temprano se tragaría el salto: «Ver más → Gastos» sin hacer nada.
    if(i<0||i>=tabIds.length||i===tabRef.current) return;
    /* TODO EN LA MISMA TRANSICIÓN, Y ESTO ERA EL LAG QUE ÉL SEGUÍA NOTANDO (2026-07-27).
       `revealNav()` y los `prepMount*` son `setState` URGENTES, mientras que el cambio de pestaña
       iba en `startTransition`: React los atiende en carriles distintos, así que al soltar el dedo
       se renderizaba App DOS VECES —una urgente y otra de transición— justo encima de la animación
       del carrusel. Su repro lo dejó ver: el caso lento no era «Gastos arriba», era que **la barra
       inferior estaba escondida y tenía que reaparecer**, y reaparecer es precisamente lo que
       dispara el render urgente. Medido con frames (que es lo que se nota, no las tareas largas):
         Gastos arriba + barra escondida (su caso lento)   peor frame 100-117 ms
         Gastos arriba + barra ya visible                  peor frame  83 ms
         Gastos bajado (su caso fluido)                    peor frame  83 ms
       Ocultar TODO el contenido de arriba de Gastos no cambiaba nada (100 ms), así que no era lo
       que se pintaba: era el render de más. Con todo en la misma transición, una sola pasada. */
    React.startTransition(function(){
      revealNav();   // cambiar de pestaña siempre muestra la barra (petición 2026-07-17)
      prepMountTab(i);
      if(i>0) prepMountId(tabIds[i-1]);
      if(i<tabIds.length-1) prepMountId(tabIds[i+1]);
      setTab(i);
    });
  };
  // «Ver más» desde Resumen: la pestaña destino conserva su scroll y aterrizabas a mitad de
  // Metas/Gastos (feedback 2026-07-18) → estos enlaces resetean el scroll de la página destino.
  const goTabTop=function(i){
    if(i<0) return;
    goTab(i);
    const pg=trackRef.current&&trackRef.current.children&&trackRef.current.children[i];
    if(pg){ pg.scrollTop=0; syncPageTouchAction(pg, i); }
  };

  /* swipe — distingue eje vertical/horizontal, menos sensible */
  const startX=useRef(0), startY=useRef(0), startT=useRef(0), dx=useRef(0), axis=useRef(null), dragging=useRef(false), trackRef=useRef(null);
  /* PINTAR UNA VEZ POR FRAME, NO UNA POR `touchmove` (2026-09-10, medido en su OnePlus).
     Su queja, con sus palabras: «si desplazas fluido no se nota apenas, es ir LENTO y ahí se nota
     el tirón, no va super smooth». Y tenía razón otra vez: arrastrando despacio, el avance del
     carrusel frame a frame salía así —

         -0,24  -0,25  -0,25  0  -0,25  0  -0,24  0  -0,25  0  -0,25  0 …

     un frame sí y otro no. La pantalla va a 120 Hz y el táctil manda ~2,7 eventos por frame (696
     `touchmove` para 253 frames, muchos con la MISMA marca de tiempo: llegan en ráfaga). Escribir
     `transform` dentro de cada `touchmove` no hace que se pinte más veces —el navegador pinta como
     mucho una vez por frame— pero sí desalinea CUÁNDO se escribe respecto a cuándo se pinta: hay
     frames que se llevan dos escrituras y frames que se quedan sin ninguna.
     Deslizando rápido eso no se ve, porque cada frame avanza varios píxeles y un frame repetido se
     pierde entre los demás. Deslizando despacio el avance es de 0,25 px por frame: la mitad de los
     frames quietos se nota como un temblorcillo. De ahí que solo lo notara yendo lento.

     Arreglo: `touchmove` solo APUNTA a dónde va el dedo; el `transform` se escribe en un
     `requestAnimationFrame`, o sea exactamente una vez por frame pintado y pegado al reloj de la
     pantalla. Es el patrón de siempre para arrastres, y aquí además cuesta menos trabajo que antes.
     ⚠ La animación de soltar (`animarA`) NO pasa por aquí: escribe su propio transform y hay que
     cancelar el rAF del arrastre antes, o se pelean por el mismo elemento. */
  const dragRaf=useRef(0), dragOff=useRef(null);
  const pintarArrastre=function(){
    dragRaf.current=0;
    const el=trackRef.current, off=dragOff.current;
    /* `axis` también, no solo `dragging` (lo caza Cursor en la review): si el dedo se va en
       vertical a mitad del gesto, el arrastre de pestañas deja de mandar pero el rAF seguía vivo
       reescribiendo el último `off` hasta que el dedo se levantaba. No se ve —el valor es el
       mismo— pero es un bucle por frame haciendo trabajo para nada, y justo en el momento en que
       el usuario está scrolleando y hace falta cada milisegundo. */
    if(!el || off==null || !dragging.current || axis.current!=="x") return;
    el.style.transform="translate3d("+off+"px,0,0)";
    dragRaf.current=requestAnimationFrame(pintarArrastre);
  };
  const pedirPintado=function(px){
    dragOff.current=px;
    if(!dragRaf.current) dragRaf.current=requestAnimationFrame(pintarArrastre);
  };
  const pararPintado=function(){
    if(dragRaf.current){ cancelAnimationFrame(dragRaf.current); dragRaf.current=0; }
    dragOff.current=null;
  };
  /* ⚠ DÓNDE EMPIEZA A MOVERSE EL CARRUSEL — el tironcillo que él lleva viendo desde el 10/9.
     MEDIDO en su móvil (OnePlus 13, toques reales por `adb input swipe`, no sintéticos):
       lento  → el dedo se mueve 721 ms sin que la pantalla responda, y entonces salta 36,1 px.
       rápido → el mismo hueco de ~30 px, pero solo 173 ms, y salta 37,1 px.
     Mismo salto, cuatro veces menos silencio. Por eso decía «si desplazas fluido no se nota
     apenas, es ir lento y ahí se nota»: lo que se ve no es el salto, es el TIEMPO callado antes.

     El hueco viene de la guarda de arriba, que no suelta el eje horizontal hasta `|ddx|>36` para
     que el carrusel no le robe el scroll vertical. Esa guarda se queda: quitarla es volver al bug
     de la deriva lateral. Lo que NO tiene por qué pasar es que, al soltarse, pinte los 36 px
     acumulados DE GOLPE. Con el ancla, el carrusel arranca en 0 y sigue al dedo 1:1 desde ahí.

     ⚠ El ancla es SOLO para lo que se ve. `dx.current` sigue siendo el recorrido crudo, porque de
     él dependen el umbral de cambio de pestaña, el flick y el premontado de la vecina; restarle 36
     también a eso pediría 108 px para cambiar de pestaña y el gesto se volvería pesado. */
  const ancla=useRef(0);
  const trackW=useRef(0);   // ancho del carrusel, medido al empezar el gesto (ver onMove)
  const prepped=useRef(0);    // qué vecina se ha premontado ya EN ESTE gesto (ver onMove)
  /* EL CARRUSEL SE MUEVE EN PÍXELES, NO EN PORCENTAJES — y esto valía la mitad del lag.
     Iba con `translateX(-100%)`, y un porcentaje en un `transform` se resuelve contra el ancho
     del propio elemento, o sea que **hay que consultar el layout para saber a cuántos píxeles
     equivale**. En un valor fijo eso se hace una vez; escrito en cada `touchmove` durante un
     arrastre, se paga por frame y saca el gesto del compositor. Medido en el escenario del
     rechazo (scroll en Deudas → deslizar, CPU x12): **146 → 76 ms** de tareas largas solo por
     este cambio. Con `translate3d(px,0,0)` no hay nada que resolver y además el `,0,0` pide capa
     propia explícitamente.
     Se usa en TODAS las escrituras del track, no solo en la del arrastre: si unas fueran en `%` y
     otras en píxeles, la transición al soltar interpolaría entre dos listas de funciones
     distintas y el navegador caería a interpolar matrices. */
  /* LA BARRA DE ABAJO DESENFOCA LO QUE PASA POR DETRÁS, Y ESO SE PAGA EN CADA FRAME (2026-07-27).
     Su repro, que es el que lo destapó: «cuando en Gastos estás ARRIBA DEL TODO… vas a Deudas, te
     mueves, y vuelves a Gastos: hay lag. Si en Gastos estabas abajo, no hay nada de lag, va ultra
     fluido». La diferencia entre los dos casos es que al bajar en una lista **la barra inferior se
     esconde**, y una barra escondida no tiene nada que desenfocar.

     `.botnav` lleva `backdrop-filter: blur(16px)`: el navegador tiene que recalcular el desenfoque
     cada vez que cambia lo que hay detrás — y al deslizar entre pestañas, detrás se mueve la app
     entera. Medido: la barra se repinta 47 veces en un solo gesto. Y acotado con el tope teórico:

       barra visible, con desenfoque (como estaba)   181 ms
       barra visible, SIN desenfoque                 145 ms
       barra fuera del pintado (tope teórico)        141 ms

     O sea que el coste de la barra durante un desliz es CASI TODO su desenfoque, y quitarlo se
     lleva prácticamente el máximo posible. Como el diseño no se toca (petición suya), se apaga
     solo mientras hay movimiento y vuelve al terminar: exactamente lo que ya se hace con el velo
     del perfil, que tampoco desenfoca durante el arrastre. A 0,42 s de transición nadie ve la
     diferencia; lo que sí se nota es el tirón. */
  const navBlurT=useRef(0);
  const navSinBlur=function(off){
    if(navBlurT.current){ clearTimeout(navBlurT.current); navBlurT.current=0; }
    if(!appShellRef.current) return;
    appShellRef.current.classList.toggle("nav-sin-blur", !!off);
  };
  const navSinBlurTrasTransicion=function(){
    // Respaldo por tiempo: si el asentamiento rAF se cancela a mitad, el desenfoque no se queda.
    if(navBlurT.current) clearTimeout(navBlurT.current);
    navBlurT.current=setTimeout(function(){
      navBlurT.current=0;
      if(appShellRef.current) appShellRef.current.classList.remove("nav-sin-blur");
    }, 480);
  };
  useEffect(function(){ return function(){ if(navBlurT.current) clearTimeout(navBlurT.current); }; },[]);
  const trackAnchoAhora=function(){ return (trackRef.current&&trackRef.current.offsetWidth)||window.innerWidth||360; };
  const trackX=function(i){ return "translate3d("+(-i*(trackW.current||trackAnchoAhora()))+"px,0,0)"; };
  /* Host de scroll nativo (ola = stretch de Android como Ajustes). En reposo la pestaña activa
     pasa a `position:fixed` (`.page-scroll-host`) y el track aparca con `left` SIN transform —
     un ancestro con transform mata el overscroll nativo (medido 5/8 en su Oppo). Al deslizar
     tabs se sale del modo y vuelve el translate3d.

     ⚠ Las clases van también en el `className` de React (`hostTab`). Si solo se ponían por
     `classList`, el primer `setNavHidden` del fling re-renderizaba App y React pisaba el
     atributo a `"page"` / `"track"` → se perdía el fixed a mitad del momentum y la ola del
     flick no salía (el tirón con el dedo ya abajo sí, porque no había setState en ese momento). */
  const scrollHostOn=useRef(false);
  const [hostTab,setHostTab]=useState(0);
  const hostTabRef=useRef(0);
  const leaveScrollHost=function(){
    const el=trackRef.current; if(!el) return;
    const w=trackW.current||trackAnchoAhora();
    let i=tabRef.current;
    // Si estábamos aparcados con left, recuperar transform antes de arrastrar
    if(scrollHostOn.current){
      const leftPx=parseFloat(el.style.left);
      if(!isNaN(leftPx)) i=Math.round(-leftPx/w);
      el.style.left="";
      el.classList.remove("scroll-host-park");
      el.style.transform="translate3d("+(-(i*(trackW.current||w)))+"px,0,0)";
    }
    const pgs=el.children;
    for(let k=0;k<pgs.length;k++){
      if(pgs[k]&&pgs[k].classList) pgs[k].classList.remove("page-scroll-host");
    }
    scrollHostOn.current=false;
    if(hostTabRef.current!==-1){ hostTabRef.current=-1; setHostTab(-1); }
    try{ if(viewportRef.current) viewportRef.current.classList.remove("scroll-host-open"); }catch(e){}
    try{ if(appShellRef.current) appShellRef.current.classList.remove("scroll-host-on"); }catch(e){}
  };
  const enterScrollHost=function(i){
    const el=trackRef.current; if(!el) return;
    // Solo bloquear si el carrusel se está ARRASTRANDO ahora. Antes: `if(dragging) return`
    // y si el asentamiento (rAF) acababa con un dedo nuevo puesto, NUNCA se re-entraba —
    // estado random «como sin parches» + tabs/ola muertos hasta ir a Resumen (5/8).
    if(dragging.current && gestureMode.current==="tab") return;
    const w=trackW.current||trackAnchoAhora();
    const toX=-(i*w);
    el.classList.remove("dragging");
    el.classList.add("scroll-host-park");
    el.style.transform="none";
    el.style.left=toX+"px";
    const pgs=el.children;
    for(let k=0;k<pgs.length;k++){
      if(!pgs[k]||!pgs[k].classList) continue;
      pgs[k].classList.toggle("page-scroll-host", k===i);
    }
    scrollHostOn.current=true;
    if(hostTabRef.current!==i){ hostTabRef.current=i; setHostTab(i); }
    try{ if(viewportRef.current) viewportRef.current.classList.add("scroll-host-open"); }catch(e){}
    try{ if(appShellRef.current) appShellRef.current.classList.add("scroll-host-on"); }catch(e){}
    endTopClearNow(false);
    try{
      const nav=document.querySelector(".botnav");
      if(nav) nav.classList.remove("botnav-ola-clear");
    }catch(e){}
    if(pgs[i]) syncPageTouchAction(pgs[i], i);
  };
  // Red de seguridad: si el host se perdió (gesto cancelado / settle a medias), recuperarlo.
  const ensureScrollHost=function(){
    if(settleRaf.current) return;                         // el asentamiento ya lo pondrá
    if(dragging.current && gestureMode.current==="tab") return;
    if(scrollHostOn.current && hostTabRef.current===tabRef.current) return;
    enterScrollHost(tabRef.current);
  };
  /* ASENTAR EL CARRUSEL CON rAF, NO CON transition CSS — 2026-07-27, medido en SU móvil.
     La transition de 0,42 s producía exactamente este ritmo al soltar el dedo:
       25 8 25 8 25 8 … (trece veces) → 60 Hz a trompicones durante todo el asentamiento.
     El arrastre con el dedo iba a 8,3 ms clavados (120 Hz). WAAPI igual de malo; acortar la
     transition a 0,18 s dejaba 6 saltos (proporcional). Con rAF escribiendo transform: **0
     saltos**, cuatro veces seguidas. Herramienta: tools/movil/ab-waapi.mjs / huecos.mjs.
     Curva = la misma cubic-bezier(.32,.72,0,1) que tenía el CSS (feedback 2026-07-17). */
  const settleRaf=useRef(0);
  const settleGen=useRef(0);
  const settleTo=useRef(-1);
  const trackPxAhora=function(){
    const el=trackRef.current; if(!el) return 0;
    const cur=getComputedStyle(el).transform;
    if(!cur||cur==="none") return 0;
    const m=cur.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[\d.]+)/);
    return m?parseFloat(m[1]):0;
  };
  const easeTrack=function(x){
    // Resuelve Y de cubic-bezier(.32,.72,0,1) para progreso X ∈ [0,1].
    var lo=0, hi=1, t=x, i, u, bx;
    for(i=0;i<10;i++){
      t=(lo+hi)/2; u=1-t;
      bx=3*u*u*t*0.32 + 3*u*t*t*0 + t*t*t;
      if(bx<x) lo=t; else hi=t;
    }
    u=1-t;
    return 3*u*u*t*0.72 + 3*u*t*t*1 + t*t*t;
  };
  const asentarTrack=function(i){
    const el=trackRef.current; if(!el) return;
    if(settleRaf.current && settleTo.current===i) return;   // ya vamos ahí: no reiniciar
    if(settleRaf.current){ cancelAnimationFrame(settleRaf.current); settleRaf.current=0; }
    const gen=++settleGen.current;
    settleTo.current=i;
    leaveScrollHost();   // animar con transform, no con left
    el.classList.remove("dragging");
    const toX=-(i*(trackW.current||trackAnchoAhora()));
    if(document.documentElement.classList.contains("reduce-motion")){
      el.style.transform="translate3d("+toX+"px,0,0)";
      settleTo.current=-1;
      navSinBlur(false);
      enterScrollHost(i);
      return;
    }
    const fromX=trackPxAhora();
    if(Math.abs(fromX-toX)<0.5){
      el.style.transform="translate3d("+toX+"px,0,0)";
      settleTo.current=-1;
      navSinBlurTrasTransicion();
      enterScrollHost(i);
      return;
    }
    const t0=performance.now();
    const dur=420;
    const step=function(now){
      if(gen!==settleGen.current) return;
      const p=Math.min(1,(now-t0)/dur);
      const x=fromX+(toX-fromX)*easeTrack(p);
      el.style.transform="translate3d("+x+"px,0,0)";
      if(p<1){ settleRaf.current=requestAnimationFrame(step); }
      else {
        settleRaf.current=0; settleTo.current=-1;
        el.style.transform="translate3d("+toX+"px,0,0)";
        navSinBlur(false);
        enterScrollHost(i);
      }
    };
    settleRaf.current=requestAnimationFrame(step);
  };
  useEffect(function(){
    return function(){ if(settleRaf.current) cancelAnimationFrame(settleRaf.current); };
  },[]);
  /* Aquí vivían revealDots()/hideDotsSoon(), que encendían y apagaban el indicador de puntitos
     del swipe. Ese indicador se lo llevó por delante el rediseño v4: `.app.v4 .dots` está oculto
     con `display:none !important` y ningún módulo crea ya el elemento (comprobado buscando
     `showDots` y `className:"dots"` en todo `src/`: no aparece en un solo render). Lo que
     sobrevivió fue su maquinaria de estado, y cobraba peaje —`setShowDots(true)` al declararse el
     gesto horizontal y `setShowDots(false)` 1,1 s después—: DOS re-renders completos de App por
     cada pasada de dedo entre pestañas, para no pintar absolutamente nada. Retirado 2026-07-26. */
  const drawerW=function(){ return window.innerWidth||360; };
  const onStart=(e)=>{
    if(e.touches&&e.touches.length>1) return;
    if(drawerOpen||profileOpen) return;
    // Sheets portaleados desde una tab (editar gasto): el DOM está en body pero el árbol
    // React burbujea hasta aquí — sin esto, scroll de chips mueve las tabs (2026-07-17).
    if(document.documentElement.classList.contains("sheet-open")) return;
    /* ZONAS QUE NO SON NUESTRAS. Los toques se escuchan a mano (ver el efecto de más abajo), y un
       listener nativo en `.viewport` se dispara ANTES que los de React, así que el
       `stopPropagation` de `stopSwipe` ya no llegaría a tiempo: hay que mirarlo aquí.
         · `[data-noswipe]`: buscador y rango de fechas de Gastos, que lo piden explícitamente.
         · cualquier cosa con scroll horizontal propio (las filas de chips): el dedo es del
           navegador, no nuestro. Antes esto «funcionaba» de rebote —el navegador se quedaba el
           gesto porque no podíamos impedírselo— y ahora que sí podemos hay que ser explícitos. */
    const t=e.target;
    if(t&&t.closest&&t.closest("[data-noswipe]")) return;
    for(let el=t; el&&el!==document.body; el=el.parentElement){
      if(el.classList&&el.classList.contains("page")) break;
      if(el.scrollWidth>el.clientWidth+4){
        const ox=getComputedStyle(el).overflowX;
        if(ox==="auto"||ox==="scroll") return;
      }
    }
    /* RED DE SEGURIDAD. `touchcancel` cubre el caso conocido, pero un gesto también puede morirse
       sin avisar de ninguna manera: si la app se va a segundo plano con el dedo puesto, no llega
       ni `touchend` ni `touchcancel` y el candado se queda. Soltar siempre antes de empezar no
       cuesta nada (son cuatro `style.x=""` y quitar clases) y garantiza que NINGÚN dedo se
       encuentre la app bloqueada por el gesto anterior. Si algún día vuelve a haber una fuga,
       aquí se cura sola. */
    if(dragging.current) onCancel();
    // Si un gesto anterior dejó el host/freeze/barra a medias, recuperar ANTES del nuevo dedo.
    try{
      if(appShellRef.current && appShellRef.current.classList.contains("gesture-freeze")) freezeShell(false);
    }catch(e){}
    ensureScrollHost();
    /* ⛔ NO PROMOVER AQUÍ LA CAPA DEL TRACK — PROBADO Y REVERTIDO EL 2026-08-18.
       Se intentó `trackRef.current.style.willChange="transform"` en el touchstart, para que el
       compositor creara la capa del carrusel con el dedo aún quieto en vez de a mitad del gesto.
       Resultado medido en su OnePlus 13: el parpadeo **siguió igual** Y además apareció un fallo
       nuevo que él vio al instante — «se baja todo un poco hacia abajo al scrollear».
       La causa está escrita 200 líneas más abajo, en `ensureScrollHost`: «el track aparca con
       `left` SIN transform — un ancestro con transform mata el overscroll nativo». **`will-change:
       transform` crea el MISMO containing block que `transform`**, así que el `position:fixed` de
       `.page-scroll-host` deja de referirse a la pantalla y pasa a referirse al track: todo el
       contenido se desplaza al scrollear.
       Regla que deja esto: en este carrusel, NADA de `transform`/`will-change:transform`/`filter`/
       `perspective` en el track ni en ningún ancestro del host mientras el host sea `fixed`. */
    dragging.current=true; axis.current=null; dx.current=0; ancla.current=0; startT.current=Date.now(); gestureMode.current=null;
    // El ancho del track, UNA vez y aquí: el layout todavía está limpio (no se ha congelado nada
    // ni añadido clases), así que esta lectura no fuerza reflow. Ver el porqué largo en `onMove`.
    trackW.current=(trackRef.current&&trackRef.current.offsetWidth)||window.innerWidth||360;
    prepped.current=0;
    pDY.current=0; pT.current=Date.now();
    startX.current=e.touches?e.touches[0].clientX:e.clientX;
    startY.current=e.touches?e.touches[0].clientY:e.clientY;
    // Ajustes SOLO desde Resumen (feedback 2026-07-27): el borde en el resto de pestañas
    // pillaba gestos normales. No montar Settings/Perfil en touchstart (vídeo 2026-07-18).
  };
  const onMove=(e)=>{
    if(!dragging.current||drawerOpen||profileOpen) return;
    if(document.documentElement.classList.contains("sheet-open")) return;
    const x=e.touches?e.touches[0].clientX:e.clientX;
    const y=e.touches?e.touches[0].clientY:e.clientY;
    const ddx=x-startX.current, ddy=y-startY.current;
    // (antes: beginTopClear en tirón al tope → barra off/on en cada swipe y en la ola)
    // Inicio arriba: cortar overscroll/rebote ANTES de fijar eje (vídeo 2026-07-18).
    if(axis.current===null && tab===0 && ddy>0 && Math.abs(ddy)>=Math.abs(ddx)){
      const pages=trackRef.current&&trackRef.current.children;
      const pageEl=pages&&pages[tab];
      if((!pageEl||pageEl.scrollTop<=2) && e.cancelable) e.preventDefault();
    }
    if(axis.current===null){
      // Mismo criterio que el gesto vertical de Plan, y a propósito el MISMO código
      // (`gestureAxis` en 00-core.js): que cada uno decidiera el eje por su cuenta sobre el mismo
      // dedo es lo que hacía que una bajada con deriva lateral acabara cambiando de pestaña.
      const eje=gestureAxis(ddx,ddy);
      if(!eje) return;
      /* A MITAD, ABAJO o ARRIBA: el arco del pulgar gana `x` pronto → preventDefault +
         leaveScrollHost + freezeShell matan scroll/ola. Abajo ya estaba guardado; ARRIBA
         faltaba — por eso la ola de arriba iba «a veces» (gesto limpio vertical OK; con deriva
         lateral el carrusel robaba el dedo). Si `x` no está claro, NO fijar eje. */
      if(eje==="x"){
        const pages0=trackRef.current&&trackRef.current.children;
        const pg0=pages0&&pages0[tab];
        if(pg0){
          const st0=pg0.scrollTop||0, max0=pg0.scrollHeight-pg0.clientHeight;
          const atTop=st0<=2;
          const mid0=st0>2 && max0-st0>2;
          const atBottom=max0>0 && (max0-st0)<=2;
          if((atTop||mid0||atBottom) && !(Math.abs(ddy)<16 && Math.abs(ddx)>36)){
            return;
          }
        }
      }
      axis.current=eje;
      // Desde AQUÍ cuenta el movimiento visible: lo recorrido hasta reclamar el eje no se pinta.
      if(eje==="x") ancla.current=ddx;
      if(axis.current==="x"){
        /* AJUSTES SOLO DESDE RESUMEN (feedback 2026-07-27). El borde (`EDGE_OPEN`) en el resto
           de pestañas pillaba gestos normales y era un coñazo. Y el candado de 450 ms tras
           cambiar de pestaña («encadenando») era el stopper al llegar a Resumen y querer abrir
           Ajustes al momento: el primer desliz no contaba y hacía falta el segundo. Ahora:
           Resumen + desliz a la derecha = Ajustes, sin espera; en cualquier otra pestaña ese
           gesto es solo cambio de tab (o nada). */
        const openSettings = ddx>0 && tab===0;
        if(openSettings){
          gestureMode.current="drawer";
          setDrawerMounted(true);   // por si el idle aún no ha premontado (1ª vez sin negro)
          if(drawerRef.current) drawerRef.current.classList.add("dragging");
          freezeShell(true,"drawer");
        } else {
          gestureMode.current="tab";
          pinNavVisible(1400);   // barra fija durante el swipe y el asiento
          leaveScrollHost();   // salir del fixed: el carrusel vuelve a translate3d
          if(trackRef.current) trackRef.current.classList.add("dragging");
          navSinBlur(true);   // ver `navSinBlur`: el desenfoque de la barra se paga POR FRAME
          // Congela el scroll de la página: sin esto, el momentum vertical de Deudas/Metas
          // pelea con el translateX del track (mismo patrón que el perfil, 2026-07-18).
          freezeShell(true,"tab");
        }
      } else if(axis.current==="y" && tab===0 && ddy>0){
        const pages=trackRef.current&&trackRef.current.children;
        const pageEl=pages&&pages[tab];
        const atTop=!pageEl||pageEl.scrollTop<=2;
        const fromAv=!!(e.target&&e.target.closest&&e.target.closest(".v4-avatar"));
        /* ABRIR el perfil ignora el candado si el panel ya está cerrado (feedback 2026-07-27).
           El candado evita cortar una animación EN VUELO con `.dragging` (= salto). Tras cerrar,
           `profMarkBusy` aguantaba 500 ms y el tercer gesto (abrir otra vez) se tragaba. Cerrar
           en caliente ya se dejaba; reabrir con el panel cerrado también — y si la CSS del cierre
           aún corre, se cancela limpia ANTES de enganchar (sin saltar a medias). */
        if((atTop||fromAv) && (!profBusy.current || !profileOpen)){
          if(profBusy.current && profileRef.current){
            const el=profileRef.current;
            el.classList.remove("dragging");
            el.style.transform=""; el.style.opacity=""; el.style.borderRadius="";
            profClearBusy();
          }
          gestureMode.current="profile";
          setProfileMounted(true);
          profileGrab();   // mismo enganche que el cierre: velo y radio fijos, panel opaco
        }
      }
    }
    if(axis.current==="y" && gestureMode.current==="profile"){
      pDY.current=ddy;
      const s0o=profS0(), so=s0o+(1-s0o)*profResist(ddy);   // misma curva que cerrar
      // Por rAF, como el cierre: touchmove dispara más veces que frames pinta la pantalla, y
      // todas las escrituras menos la última se tiran a la basura habiendo forzado su recálculo.
      profileQueue(so, 1);
      if(e.cancelable) e.preventDefault();
      return;
    }
    /* ⚠ AQUÍ HABÍA UN REBOTE CASERO, Y SE QUITÓ ENTERO (2026-08-01, tercer intento, por fin con
       la descripción exacta: «cuando bajas hasta abajo del todo y tiras más, se ve como un
       efecto OLA de todas las cosas que hay en pantalla — eso es lo que quiero, lo mismo que
       Ajustes y el perfil»).
       Y Ajustes/el perfil (`.settings-push`/`.settings-slide`) NUNCA tuvieron un rebote nuestro:
       ese "efecto ola" que él ve ahí es el rebote NATIVO de Chromium/Android — el navegador
       estira TODO el contenido de la pantalla como una goma cuando llegas al final y sigues
       tirando. `.page` (las cuatro pestañas) es la ÚNICA zona con `overscroll-behavior-y:none`
       en toda la app, puesto a propósito el 28/7 para que un rebote JS propio no se pisara con
       el nativo. Ese rebote propio es justo lo que él llevaba tres rondas rechazando por no
       parecerse — porque es OTRO efecto, con otra física, por diseño.
       La solución no era afinar la curva una cuarta vez: era dejar que el navegador haga aquí
       LO MISMO que ya hace en Ajustes y en el perfil. Sin JS, sin `reb`, sin `REB_MAX` — el
       `overscroll-behavior-y:none` de `.page` también se ha quitado (ver shell.html), así que
       las cuatro pestañas se comportan exactamente como los otros dos sitios que él pone como
       referencia, porque ahora es LITERALMENTE el mismo mecanismo. */
    if(axis.current!=="x") return;
    dx.current=ddx;
    if(gestureMode.current==="drawer"){
      const prog=Math.min(1,Math.max(0,ddx/drawerW()));
      if(drawerRef.current) drawerRef.current.style.transform="translate3d("+(-100+prog*100)+"%,0,0)";
      if(e.cancelable) e.preventDefault();
      return;
    }
    /* EL ANCHO SE MIDE UNA VEZ, AL EMPEZAR EL GESTO — aquí estaba el lag de verdad (rechazos
       .17 → .23: «al entrar en Deudas, moverte, y luego deslizar va con muchísimo lag»).
       Esto leía `trackRef.current.offsetWidth` EN CADA `touchmove`, y leer `offsetWidth` obliga al
       navegador a recalcular el layout de forma SÍNCRONA. Con la página sin scrollear el layout
       está limpio y la lectura sale gratis; pero congelar el scroll le pone `overflow:hidden`, eso
       ensucia el layout, y entonces cada lectura se convierte en un reflow COMPLETO del documento.
       Por eso solo se notaba «si te movías dentro»: hacían falta las dos cosas a la vez, y por
       separado ninguna cantaba. Trazado con la CPU x6: 113 `UpdateLayoutTree` y 322 `Paint` en un
       solo gesto — no una tarea larga que salte a la vista, sino 126 ms en trocitos.
       Es layout-thrashing de manual, y la cura es la de manual: leer una vez, fuera del bucle. El
       ancho del track no cambia mientras el dedo está en la pantalla. */
    const w=trackW.current||360;
    // Lo que se PINTA arranca en 0 desde que el gesto es nuestro (ver `ancla`); lo que se DECIDE
    // sigue usando el recorrido crudo.
    const dxVis=dx.current-ancla.current;
    let off=-tab*100+(dxVis/w)*100;
    // Sin rubber-band a la derecha en Inicio (ese gesto es Ajustes) — evitaba el rebote raro.
    if(tab===tabIds.length-1&&dxVis<0) off=-tab*100+(dxVis/w)*100*0.28;
    else if(tab===0&&dxVis>0) off=-tab*100;
    else if(tab===0&&dx.current>0) off=-tab*100;
    // Solo se APUNTA a dónde va; lo escribe el rAF, una vez por frame pintado (ver `pedirPintado`).
    pedirPintado(off*w/100);
    /* ESTE `preventDefault` ES EL QUE FALTABA, Y ES TODO EL PROBLEMA (2026-07-27).
       Sin él, el navegador considera que el gesto es SUYO en cuanto huele scroll: se lo lleva,
       manda `touchcancel` y el arrastre de pestañas se queda a medias. Medido en su móvil:
       **174 de 185 gestos suyos acabaron cancelados**, y **6 de cada 18 arrastres del carrusel
       volvían a la pestaña de la que salieron** — o sea, deslizaba y no pasaba nada. Eso es su
       «hay un stopper» y su «se pierde la fluidez de golpe»: no es que fuera lento, es que un
       tercio de sus deslizadas no contaban.
       Con el eje ya declarado horizontal, el gesto es nuestro y hay que decirlo. Ojo: solo
       funciona porque los listeners se registran a mano con `{passive:false}` (ver el efecto de
       abajo) — exactamente el mismo agujero que se arregló en el perfil el 18/7 y que aquí se
       quedó sin arreglar. */
    if(e.cancelable) e.preventDefault();
    /* Y ESTO SE PEDÍA EN CADA `touchmove`. `prepMountTab` acaba en un `setMountedTabs` que
       devuelve el MISMO objeto si la pestaña ya estaba montada, así que React se ahorra el
       re-render… pero no se ahorra la llamada, ni la comprobación, ni el trabajo de programar la
       actualización: en un arrastre son ~35 veces para no cambiar nada. Con una marca por gesto
       basta, porque montar es idempotente y la dirección no cambia a mitad de arrastre. */
    if(dx.current<-24 && tab<tabIds.length-1 && prepped.current!==1){ prepped.current=1; prepMountTab(tab+1); }
    else if(dx.current>24 && tab>0 && prepped.current!==-1){ prepped.current=-1; prepMountTab(tab-1); }
  };
  const onEnd=()=>{
    if(!dragging.current) return; dragging.current=false;
    flushNavHide();   // el setState aplazado de la barra (ver applyNavHide)
    // El rAF del arrastre se para AQUÍ: a partir de ahora manda `animarA`, y si los dos escriben
    // el mismo `transform` se pisan y el soltar daría un tirón peor que el que veníamos a quitar.
    pararPintado();
    scheduleEndTopClear();
    if(axis.current==="y" && gestureMode.current==="profile"){
      profileRelease();
      const dist=pDY.current;
      const dt=Math.max(1,Date.now()-startT.current);
      // El candado lo pone el efecto cuando el estado cambia de verdad; el rebote no lo necesita
      // y bloquearlo deja la app sorda al segundo intento (ver profileEnd).
      /* UMBRAL DE ABRIR. Antes pedía 0,16 de la pantalla —unos 136 px en su móvil— y en el vídeo
         se ve el panel asomar en miniatura y volverse a cerrar una y otra vez: el tirón no
         llegaba, y desde fuera parece que la app parpadea sola. 0,11 (~95 px) sigue muy por encima
         de un roce sin querer, y aquí SÍ hace falta ser exigente: este gesto compite con el scroll
         de Inicio y con el cambio de pestaña. Cerrar va por su propio umbral, ver PROF_TH_CLOSE. */
      const open=profPasa(dist, dt, PROF_TH_OPEN);
      setProfileOpen(open);
      setProfileProgress(open?1:0);
      pDY.current=0;
    } else if(axis.current==="x"){
      if(gestureMode.current==="drawer"){
        if(drawerRef.current) drawerRef.current.classList.remove("dragging");
        freezeShell(false);
        const dw=drawerW(), dist=dx.current, dt=Math.max(1,Date.now()-startT.current);
        const open = dist > dw*0.35 || ((dist/dt)>0.4 && dist>28);
        if(drawerRef.current) drawerRef.current.style.transform="";
        setDrawerOpen(open);
        setSettingsProgress(open?1:0);
      } else {
        // El desenfoque NO vuelve al soltar: el carrusel sigue moviéndose 0,42 s, y ahí es
        // donde más se nota. `asentarTrack` lo apaga al terminar; el timer es el respaldo.
        navSinBlurTrasTransicion();
        freezeShell(false);   // suelta el scroll que congelamos al fijar el eje horizontal
        const w=trackRef.current?trackRef.current.offsetWidth:360;
        const dist=dx.current;
        const dt=Math.max(1,Date.now()-startT.current);
        const vel=dist/dt;
        const distTh=Math.max(50, w*0.20);
        const flick=Math.abs(vel)>0.45 && Math.abs(dist)>32;
        let nt=tab;
        if((dist<-distTh || (flick&&dist<0)) && tab<tabIds.length-1) nt=tab+1;
        else if((dist>distTh || (flick&&dist>0)) && tab>0) nt=tab-1;
        // Limpiar modo ANTES de asentar: si no, enterScrollHost puede creer que seguimos en tab-drag.
        gestureMode.current=null;
        axis.current=null;
        endTopClearNow(true);
        if(nt!==tab) goTab(nt);
        asentarTrack(nt);
        return;
      }
    } else {
      // Scroll vertical normal: por si un leaveScrollHost quedó a medias, recuperar.
      ensureScrollHost();
      endTopClearNow(false);
    }
    gestureMode.current=null;
    axis.current=null;
  };
  /* EL GESTO QUE NO ACABA EN `touchend` — y aquí estaba el «tirón» de verdad, cuatro rechazos.
     Cuando el navegador decide que un gesto es SUYO (lo normal: cualquier arrastre que acabe
     scrolleando la lista) se lleva el dedo y avisa con `touchcancel`. **`touchend` ya no llega
     nunca.** Y `.viewport` solo tenía `onTouchStart/onTouchMove/onTouchEnd`, así que en ese
     camino no se ejecutaba NADA de lo que suelta el gesto: ni `freezeShell(false)`, ni quitar
     `.dragging` del track, ni devolver el carrusel a su sitio, ni encender otra vez el
     desenfoque de la barra. Con el dedo real pasa constantemente — en su móvil, **174 de 185
     gestos terminaron cancelados** (medido por CDP el 2026-07-27).

     Lo que se sentía: la app se quedaba con la página bloqueada y el carrusel plantado a medio
     camino. Deslizas y no se mueve nada; insistes; en cuanto un gesto termina bien, se suelta
     todo de golpe y la pantalla PEGA EL SALTO. Es exactamente su «hay un stopper», su «no se
     mueve y luego va a trompicones» y su «a veces sí y a veces no» — y explica por qué un día
     entero de medir rendimiento no lo encontró: **la app no iba lenta, iba bloqueada**. Ningún
     banco de pruebas lo reprodujo porque un gesto sintético siempre termina con un `touchend`
     limpio; solo un dedo de verdad hace que el navegador se lleve el gesto.

     El perfil, la tabbar y las fichas ya escuchaban `touchcancel`; las pestañas y Ajustes, no. */
  const onCancel=function(){
    if(!dragging.current) return;
    flushNavHide();   // ANTES del early-return del perfil: en su móvil casi todos los gestos pasan por aquí
    scheduleEndTopClear();
    if(gestureMode.current==="profile"){
      profileRelease();
      setProfileProgress(profileOpen?1:0);   // el gesto no cuenta: se queda como estaba
      pDY.current=0;
      dragging.current=false; axis.current=null; gestureMode.current=null;
      pararPintado();
      freezeShell(false);
      return;
    }
    // El desenfoque vuelve YA (no como al soltar): aquí no hay transición del carrusel que proteger.
    navSinBlur(false);
    cancelSwipe();
  };
  /* LOS TOQUES DE LAS PESTAÑAS, A MANO Y CON `{passive:false}` — el mismo arreglo que necesitó el
     perfil el 18/7 y que aquí nunca se aplicó. React ata `onTouchMove` al contenedor raíz en modo
     PASIVO, y en un listener pasivo `preventDefault()` no hace nada: solo deja un aviso en consola
     que ningún test mira. Resultado, medido en su móvil: el navegador se quedaba uno de cada tres
     arrastres para scrollear, mandaba `touchcancel`, y la deslizada no cambiaba de pestaña.
     Con el listener a mano el gesto es nuestro de verdad. `touchcancel` sigue atado (`onCancel`)
     porque el sistema —una noti, el borde de la pantalla— también puede llevárselo. */
  const viewportRef=useRef(null);
  /* LA RAYITA SALTA POR ENCIMA DEL + (petición suya 2026-07-28). Solo cuando el cambio de
     pestaña CRUZA el hueco del FAB —slots: 0 Inicio · 1 Gastos · 2 el + · 3 Plan · 4 Cartera—,
     que es el único caso en que el indicador le pasa por la cara. Entre contiguas se desliza
     como siempre.
     Sin `useState` A PROPÓSITO: esto corre en cada cambio de pestaña, y un estado aquí son dos
     repintados de la app entera por gesto — exactamente el tipo de trabajo atado al momento en
     que el usuario toca que costó siete vueltas sacar del carrusel (ver CHANGELOG 4.12.0). La
     clase se pone y se quita sobre el nodo y React ni se entera. */
  /* AQUÍ VIVÍA EL REBOTE CASERO DE LAS PESTAÑAS, Y SE QUITÓ ENTERO EL 2026-08-01 — leer el
     comentario en `onMove` (más arriba, donde estaba la rama que lo dibujaba) para el porqué:
     la premisa de origen («la WebView no hace rubber-band, solo un fogonazo de borde») era la
     causa de que tres rondas de retoques nunca se pareciesen a Ajustes/el perfil — esos dos
     sitios NUNCA tuvieron rebote nuestro, corren con el `overscroll-behavior` por defecto del
     navegador, y ESE es el efecto que él pedía copiar. `.page` ya no lo bloquea (shell.html). */
  const indRef=useRef(null);
  const tabPrevRef=useRef(tab);
  /* ⚠ `useLayoutEffect` Y NO `useEffect`, y esta vez importa de verdad (2026-08-01).
     La clase `rodea` es la que acompasa los dos ejes del salto: le cambia al CONTENEDOR la
     duración y la curva para que casen con las del span (ver `.botnav-ind.rodea` en el shell).
     Con `useEffect` la clase llega DESPUÉS de pintar, o sea después de que React haya escrito el
     `translateX` nuevo — y para entonces el navegador ya ha arrancado la transición horizontal
     con el muelle de .32s. Cambiar `transition` a una transición ya en marcha no la re-negocia:
     sigue con lo que empezó. Resultado: el arreglo del acompasado no se aplicaría NUNCA en el
     único movimiento para el que existe. `useLayoutEffect` corre antes del pintado, así que la
     clase y el `translateX` entran en el mismo frame y la transición nace ya acompasada. */
  useLayoutEffect(function(){
    const antes=tabPrevRef.current; tabPrevRef.current=tab;
    const el=indRef.current;
    if(!el || antes===tab) return undefined;
    const cruza=(antes<=1)!==(tab<=1);
    const span=el.firstElementChild;
    /* Si el arco iba a mitad y llega OTRO cambio de pestaña, reiniciar `rodea` dejaba la rayita
       a medias (Y ya subida, X a mitad) y el nuevo translate la atravesaba por el + — feedback
       2026-08-05 «si lo hago muy rápido se corta y atraviesa». Arreglo: SNAP al destino (sin
       transición ni animación) y NO relanzar el arco en esa interrupción. El siguiente cruce
       limpio (sin `rodea` colgada) vuelve a saltar por encima. */
    const snapInd=function(){
      el.classList.remove("rodea");
      el.style.transition="none";
      if(span){ span.style.animation="none"; span.style.transform="none"; }
      void el.offsetWidth;
      el.style.transition="";
      if(span){ span.style.animation=""; span.style.transform=""; }
    };
    if(!cruza){
      if(el.classList.contains("rodea")) snapInd();
      return undefined;
    }
    if(el.classList.contains("rodea")){
      snapInd();
      return undefined;
    }
    el.classList.add("rodea");
    const id=setTimeout(function(){ el.classList.remove("rodea"); }, 460);
    return function(){ clearTimeout(id); };
  },[tab]);
  /* AQUÍ HABÍA UNA RACHA DE TEMPORADA EN CADA CAMBIO DE PESTAÑA, Y LA QUITÓ ÉL.
     Se puso el 28/7 leyendo «alguna animación chula si deslizas», y la rechazó dos veces seguidas
     con las palabras más claras que se pueden dar: «que al cambiar de tab no sigan cayendo» y «va
     bien pero no quiero eso. Solo quiero que pase al principio». Queda escrito para que a nadie
     le parezca una buena idea reponerlo: la caída es del ARRANQUE y de nada más. La temática se
     nota el resto del tiempo en la ambientación fija (anillo del + y halos), que es lo que sí le
     gusta — «como hiciste con el botón + que está chulo». */
  /* Métricas de uso: qué pestañas se usan de verdad. Una etiqueta cerrada y nada más — ni qué hay
     dentro, ni cuánto dinero, ni cuándo. El dedupe de `logEvent` hace que cada pestaña cuente una
     vez por sesión, que es la medida que sirve para decidir qué sobra. Ver `USO_OK` en 00-core. */
  useEffect(function(){
    try{ cloud.logUso("tab_"+(tabIds[tab]||"inicio")); }catch(e){}
  },[tab, tabIds]);
  const gestRef=useRef({});
  gestRef.current={ s:onStart, m:onMove, e:onEnd, c:onCancel };
  useEffect(function(){
    const el=viewportRef.current; if(!el) return undefined;
    const s=function(e){ gestRef.current.s(e); };
    const m=function(e){ gestRef.current.m(e); };
    const t=function(e){ gestRef.current.e(e); };
    const c=function(e){ gestRef.current.c(e); };
    el.addEventListener("touchstart", s, {passive:true});
    el.addEventListener("touchmove", m, {passive:false});
    el.addEventListener("touchend", t, {passive:true});
    el.addEventListener("touchcancel", c, {passive:true});
    return function(){
      el.removeEventListener("touchstart", s);
      el.removeEventListener("touchmove", m);
      el.removeEventListener("touchend", t);
      el.removeEventListener("touchcancel", c);
    };
  /* ⚠ LAS DEPS NO SON DECORACIÓN (bug encontrado y reproducido el 2026-08-18).
     `App` sale por `return` ANTES del `.viewport` en dos casos —candado (`locked`) y onboarding
     (`state.onboarded===false`)—, así que en esos arranques `viewportRef.current` es `null`, este
     efecto se rinde en el `if(!el)` y, con `[]`, NO SE VOLVÍA A EJECUTAR NUNCA. Al desbloquear o
     al terminar el onboarding la app se pintaba entera pero **sin un solo listener de gestos**:
     medido con CDP, `.viewport` con 0 listeners, y los toques llegaban al documento sin que nadie
     los recogiera. Los gestos de pestañas no volvían hasta cerrar y reabrir la app.
     A quien mordía: cualquiera que ESTRENA la app (su padre y su pareja, su primer día).
     El efecto de la tabbar de aquí al lado ya llevaba estas mismas deps por este mismo motivo
     —«si la app arranca en el candado o el onboarding, la tabbar aún no existe»—; aquí faltaban. */
  },[locked, state.onboarded]);
  // Toque en la barra inferior (y cualquier setTab que no venga del gesto): mismo asentamiento
  // por rAF. Si el gesto ya lo arrancó hacia este índice, asentarTrack no reinicia.
  // Mismo apagado de desenfoque que ya tiene el swipe, aquí también (2026-08-03, bug 1 «la rayita
  // atraviesa el + a velocidad alta»). Un toque directo en la barra TAMBIÉN mueve el carrusel por
  // detrás (`asentarTrack`), y `.botnav` con `backdrop-filter` recalcula el desenfoque en cada
  // frame en que cambia lo de detrás — el mismo coste ya medido en el swipe (181→145 ms sin él).
  // A velocidad alta (varios toques seguidos, sin dejar asentar el anterior) ese coste se acumula
  // justo en la ventana de ~220 ms en la que tiene que pintarse el pico del arco de la rayita:
  // menos trabajo de sobra en el hilo principal ahí es menos probable perderse ese frame. Llamarlo
  // también cuando el asentamiento viene de un swipe (que ya lo gestiona en `onEnd`) es inofensivo:
  // `navSinBlur`/`navSinBlurTrasTransicion` solo tocan una clase y un timer, sin efectos duplicados.
  useEffect(function(){
    if(dragging.current) return;
    navSinBlur(true);
    asentarTrack(tab);
    navSinBlurTrasTransicion();
  },[tab]);
  // Contrapartida de medir en píxeles: un porcentaje se re-resolvía solo al girar el móvil, y un
  // píxel no. Si cambia el ancho (rotación, teclado, barra del navegador), se tira la medida
  // cacheada y se vuelve a colocar el carrusel. Fuera del gesto, para no medir con el dedo puesto.
  useEffect(function(){
    const alRedimensionar=function(){
      trackW.current=0;
      if(trackRef.current&&!dragging.current){
        // Snap sin animar: el ancho nuevo cambia el destino en px; animar desde el viejo salta.
        if(settleRaf.current){ cancelAnimationFrame(settleRaf.current); settleRaf.current=0; }
        settleTo.current=-1;
        leaveScrollHost();
        trackW.current=trackAnchoAhora();
        trackRef.current.style.transform=trackX(tab);
        enterScrollHost(tab);
      }
    };
    window.addEventListener("resize",alRedimensionar);
    window.addEventListener("orientationchange",alRedimensionar);
    return function(){ window.removeEventListener("resize",alRedimensionar); window.removeEventListener("orientationchange",alRedimensionar); };
  },[tab]);
  /* auto-scroll del tab bar para que la pestaña activa siempre se vea */
  useEffect(()=>{
    const bar=tabbarRef.current; if(!bar) return;
    const btn=bar.children[tab]; if(!btn) return;
    const left = btn.offsetLeft - (bar.clientWidth/2) + (btn.clientWidth/2);
    try{ bar.scrollTo({left:Math.max(0,left),behavior:"smooth"}); }catch(e){ bar.scrollLeft=Math.max(0,left); }
  },[tab]);
  /* ARRASTRE de pestañas por mantener pulsado, RESTAURADO a petición del usuario (2026-07-10;
     se quitó en 3.83 y lo echaba de menos). Convive con Ajustes › «Editar pestañas»: los dos
     escriben settings.tabOrder/tabHidden. Suelta sobre la papelera para ocultar (+ para recuperar). */
  useEffect(function(){
    const bar=tabbarRef.current; if(!bar) return;
    const onTS=function(e){
      const btn=e.target.closest && e.target.closest('[data-ti]'); if(!btn) return;
      const tch=e.touches[0];
      const order=tabOrderOf(stateRef.current);
      // se arrastra la pestaña que TOCAS (no la activa): más natural
      const ti=parseInt(btn.getAttribute('data-ti'),10);
      const d={startX:tch.clientX,startY:tch.clientY,active:false,order:order,activeId:order[ti]||order[tabRef.current],timer:null,overTrash:false};
      d.timer=setTimeout(function(){ d.active=true; bar.classList.add('reordering'); setTab(order.indexOf(d.activeId)); setTabOrderState(d.order.slice()); try{navigator.vibrate&&navigator.vibrate(15);}catch(_){} },380);
      tabDrag.current=d;
    };
    const onTM=function(e){
      const d=tabDrag.current; if(!d) return; const tch=e.touches[0];
      if(!d.active){ if(Math.abs(tch.clientX-d.startX)>10||Math.abs(tch.clientY-d.startY)>10){ clearTimeout(d.timer); tabDrag.current=null; } return; }
      e.preventDefault();
      // ¿está el dedo sobre la papelera? → resáltala y no reordenes
      const tr=trashRef.current;
      if(tr){
        const r=tr.getBoundingClientRect();
        const over = tch.clientX>=r.left-10 && tch.clientX<=r.right+10 && tch.clientY>=r.top-10 && tch.clientY<=r.bottom+10;
        if(over!==d.overTrash){ d.overTrash=over; setTrashHot(over); try{ if(over&&navigator.vibrate) navigator.vibrate(10); }catch(_){} }
        if(over) return;
      }
      const kids=Array.prototype.slice.call(bar.querySelectorAll('[data-ti]'));
      let target=-1,best=1e9;
      kids.forEach(function(k,idx){ const r=k.getBoundingClientRect(); const c=r.left+r.width/2; const dist=Math.abs(c-tch.clientX); if(dist<best){best=dist;target=idx;} });
      if(target<0) return;
      const cur=d.order.indexOf(d.activeId);
      if(target!==cur){ const o=d.order.slice(); o.splice(cur,1); o.splice(target,0,d.activeId); d.order=o; setTabOrderState(o.slice()); setTab(target); }
    };
    const onTE=function(){
      const d=tabDrag.current; if(!d) return; clearTimeout(d.timer);
      if(d.active){
        bar.classList.remove('reordering'); setTrashHot(false);
        if(d.overTrash && d.activeId!=="dash"){
          // soltada en la papelera → se oculta (se recupera cuando quieras con el botón +)
          const id=d.activeId; const fin=d.order.filter(function(x){ return x!==id; });
          set(function(s){
            const hid=tabHiddenOf(s); const nh=hid.indexOf(id)<0?hid.concat([id]):hid;
            return Object.assign({},s,{settings:Object.assign({},s.settings,{tabHidden:nh, tabOrder:fin})});
          });
          setTab(Math.max(0, Math.min(d.order.indexOf(id), fin.length-1)));
          setTabOrderState(null);
          showToast(t("tb_removed"));
        } else {
          if(d.overTrash) showToast(t("tb_nodel"));   // el Resumen es fijo
          const fin=d.order.slice();
          set(function(s){ return Object.assign({},s,{settings:Object.assign({},s.settings,{tabOrder:fin})}); });
          setTab(fin.indexOf(d.activeId)); setTabOrderState(null);
        }
      }
      tabDrag.current=null;
    };
    bar.addEventListener('touchstart',onTS,{passive:true});
    bar.addEventListener('touchmove',onTM,{passive:false});
    bar.addEventListener('touchend',onTE,{passive:true});
    bar.addEventListener('touchcancel',onTE,{passive:true});
    return function(){ bar.removeEventListener('touchstart',onTS); bar.removeEventListener('touchmove',onTM); bar.removeEventListener('touchend',onTE); bar.removeEventListener('touchcancel',onTE); };
    // deps: si la app arranca en el candado o el onboarding, la tabbar aún no existe en el
    // primer montaje y los listeners no se instalarían nunca; al desbloquear se re-ejecuta.
  },[locked, state.onboarded]);
  // `data-noswipe` además del stopPropagation: los toques de las pestañas van por listener nativo
  // y ese se dispara antes que los de React (ver `onStart`).
  const stopSwipe={ "data-noswipe":"1", onTouchStart:(e)=>e.stopPropagation(), onTouchMove:(e)=>e.stopPropagation() };
  // Cancela el gesto de tabs/ajustes a mitad (chips de Gastos: scroll interno sin cambiar de pestaña).
  const cancelSwipe=function(){
    if(!dragging.current) return;
    flushNavHide();   // el navegador nos quita el gesto: el estado de la barra se vuelca igual
    dragging.current=false; axis.current=null; gestureMode.current=null; dx.current=0; ancla.current=0;
    pararPintado();   // touchcancel: el navegador nos quita el gesto, hay que soltar el rAF igual
    endTopClearNow(true);
    // `tabRef` por lo mismo que en `goTab`: con el `tab` de cuando se construyó la página, cancelar
    // el gesto devolvería el carrusel a la pestaña equivocada. Asentar por rAF (no snap a pelo):
    // si no, el dedo ve un salto seco cuando el navegador se lleva el gesto.
    asentarTrack(tabRef.current);
    if(drawerRef.current){ drawerRef.current.classList.remove("dragging"); drawerRef.current.style.transform=""; }
    freezeShell(false);
    setSettingsProgress(drawerOpen?1:0);
  };

  useEffect(function(){
    var id=tabIds[tab];
    if(!id) return;
    setMountedTabs(function(m){ return m[id]? m : Object.assign({},m,{[id]:true}); });
  },[tab, tabIds.join("|")]);
  // Tras el primer pintado: NO montar vecinas en auto. Montar ±1 al toque/swipe (prepMountTab)
  // evitaba un segundo hitch a ~900 ms junto con WhatsNew (feedback 2026-07-16).
  //
  // PERO montarlas al TOCAR significa montarlas DENTRO del gesto (feedback 2026-07-26: «las
  // primeras veces que deslizas entre pestañas va a tirones, luego se suaviza»). Medido con la
  // CPU estrangulada x6: 1ª deslizada 218+149+69+65 ms de tareas largas, 2ª 97 ms, 3ª y 4ª
  // limpias — exactamente lo que él describió. El coste de montar no se puede evitar, pero sí
  // ELEGIR CUÁNDO se paga: aquí se paga en huecos libres, una pestaña por hueco, antes de que
  // nadie toque la pantalla. Se mantienen los 3,2 s del primer hueco (mover eso reabre el hitch
  // de los 900 ms) y el `prepMountTab` del toque, que sigue haciendo de red por si el usuario
  // desliza antes de que dé tiempo a todo.
  useEffect(function(){
    if(state.onboarded===false||locked) return;
    var cancelled=false;
    mcScheduleIdle(function(){
      if(cancelled) return;
      setMountNeighbors(true);
      var pend=tabIds.slice();
      var siguiente=function(){
        if(cancelled) return;
        var id=pend.shift();
        if(!id){
          // Y el PERFIL, con la misma lógica: montarlo cuesta lo que cuesta (es la pantalla más
          // larga de la app, ~1.680 px), y hasta ahora se pagaba dentro del propio toque, porque
          // `onOpenProfile` hacía `setProfileMounted(true)` y a los dos frames abría. Medido con
          // la CPU x12: abrir la primera vez costaba el doble que las siguientes. Montado ya en
          // un hueco libre, la primera vez cuesta lo mismo que la quinta (2026-07-26).
          setProfileMounted(true);
          return;
        }
        setMountedTabs(function(m){ return m[id]? m : Object.assign({},m,{[id]:true}); });
        mcScheduleIdle(siguiente, 900);
      };
      mcScheduleIdle(siguiente, 900);
    }, 3200);
    return function(){ cancelled=true; };
  },[state.onboarded, locked, tabIds.join("|")]);
  useEffect(function(){ if(tab>tabIds.length-1) setTab(0); },[tabIds.length]);   // modo simple reduce pestañas → no dejar un índice fuera de rango
  // Ocultar bloques por pestaña: publica el estado para CollapsibleCard (que no recibe props
  // de App) y escucha el toggle. settings.cardHidden se sincroniza con la nube como todo.
  window.__mcBlocksEdit = !!(state.settings && state.settings.blocksEdit);
  window.__mcCardHidden = (state.settings && state.settings.cardHidden) || [];
  useEffect(function(){
    const h=function(e){
      const k=e&&e.detail; if(!k) return;
      set(function(s){
        const cur=(s.settings&&s.settings.cardHidden)||[];
        const n=cur.indexOf(k)>=0?cur.filter(function(x){return x!==k;}):cur.concat([k]);
        return Object.assign({},s,{settings:Object.assign({},s.settings,{cardHidden:n})});
      });
    };
    window.addEventListener("mc-card-toggle",h);
    return function(){ window.removeEventListener("mc-card-toggle",h); };
  },[]);
  const TABBYID={}; TABS.forEach(function(tt){ TABBYID[tt.id]=tt; });
  const hiddenTabIds = TABS.map(function(tt){return tt.id;}).filter(function(id){ return tabIds.indexOf(id)<0; });
  const pageFor=function(id){
    const simple=!!(state.settings&&state.settings.simpleMode);
    if(id==="dash") return React.createElement(Dashboard,{state:state,totals:totals,set:set,showToast:showToast,
      onOpenSettings:function(){ setDrawerOpen(true); },
      onOpenProfile:function(){
        // Montar cerrado un frame y luego abrir: si montas ya con .open no hay animación de entrada.
        setProfileMounted(true);
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ profSetOrigin(); setProfileOpen(true); }); });
      },
      onGoGastos:function(){ const i=tabIds.indexOf("gastos"); if(i>=0) goTabTop(i); },
      onGoPlan:function(seg){ if(seg) setPlanGoto({id:seg,ts:Date.now()}); const i=tabIds.indexOf("plan"); if(i>=0) goTabTop(i); }});
    // Sin prop `active`: ver `mcOnGastosActive` — si viaja por props, entrar en Gastos
    // reconstruye el árbol entero encima del gesto (asimetría Deudas→Gastos vs →Cartera).
    if(id==="gastos") return React.createElement(Expenses,{state:state,set:set,onSync:onSync,syncing:syncing,syncStatus:syncStatus,showToast:showToast,stopSwipe:stopSwipe,cancelSwipe:cancelSwipe,focusExp:gotoExp,clearFocus:function(){ setGotoExp(null); },forceAllTs:gastosForceAll});
    if(id==="plan") return React.createElement(PlanTab,{state:state,set:set,totals:totals,showToast:showToast,simple:simple,gotoSeg:planGoto,clearGoto:function(){ setPlanGoto(null); }});
    // El «Sincronizar» de Cartera actualiza TODO lo conectado: Open Banking + TR + MyInvestor
    // (petición 2026-07-18: «que también sincronice Trade Republic y MyInvestor»).
    if(id==="cartera") return React.createElement(CarteraTab,{state:state,set:set,totals:totals,fetchPrices:fetchPrices,pricing:pricing,simple:simple,showToast:showToast,onBankSync:function(){ return Promise.all([runBankSync({manual:true}), runBrokerSync({manual:true})]); },onReconnectBank:reconnectBank});
    return null;
  };

  /* LAS CUATRO PESTAÑAS NO SE VUELVEN A PINTAR POR ABRIR EL PERFIL (medido 2026-07-26).
     Aquí estaba el coste real de «abrir el perfil sigue yendo lento», y no era la animación:
     con la CPU x12, el toque costaba ~195 ms de hilo bloqueado **incluso quitando el panel
     entero del DOM**, y con TODAS las transiciones apagadas seguía costando lo mismo. Lo que se
     paga es el re-render de App: las cuatro páginas se construyen aquí dentro, así que cualquier
     estado de App —`profileOpen`, el velo, el toast, la barra que se esconde al hacer scroll—
     re-renderizaba Inicio + Gastos + Plan + Cartera enteras. En reposo la traza lo confirma:
     0 ms de tareas largas sin tocar nada, ~195 ms en cuanto cambia un estado de App.
     Las hipótesis «bonitas» (el panel de 1.680 px que se re-rasteriza, el velo, la sombra, el
     radio animado) se midieron una por una y NO son: mueven el rasterizado, que va en otro hilo
     y no bloquea. Están anotadas en el CHANGELOG con su número para no repetirlas.
     ⚠ Las dependencias son TODO lo que leen estas páginas y los cierres que les pasamos, no solo
     lo que se ve en las props: si añades una prop que dependa de otro estado de App, añádelo aquí
     o la pestaña se quedará con un valor viejo. Fuera quedan a propósito los estados de las capas
     de encima (perfil, cajón, toast, barra inferior, pills de update), que es justo el ahorro.

     Y `tab` TAMPOCO ES DEPENDENCIA — segunda vuelta, 2026-07-27. Con `tab` dentro, cambiar de
     pestaña seguía reconstruyendo las cuatro páginas, y eso es exactamente lo que él siguió
     notando: «vas a deudas, te mueves dentro de deudas y luego deslizas a otra tab, es horrible».
     Medido a x12: entrar en Deudas 172 ms, moverse dentro 0 ms (eso ya estaba), **deslizar fuera
     219 ms**. Al quedar fuera, cambiar de pestaña solo re-renderiza los cuatro `div` de arriba
     (que sí necesitan `tab` para la clase `page-live`); React ve el MISMO elemento hijo por
     referencia y se salta el subárbol entero. De ahí que el mapa de abajo ya no vaya memoizado:
     cuatro `createElement` de un `div` no cuestan nada, y lo caro es lo que cuelga de ellos.
     El precio de sacar `tab` son los cierres que lo leían (`goTab`, `cancelSwipe`): ahora leen
     `tabRef`, con el porqué escrito en cada uno. */
  const contenidos=useMemo(function(){
    var out={};
    tabIds.forEach(function(id){ if(id!=="gastos") out[id]=pageFor(id); });
    return out;
    // eslint-disable-next-line
  },[state, totals, tabIds.join("|"), syncing, syncStatus, gotoExp, planGoto, pricing, uid, drawerOpen, locked]);
  /* Gastos iba en memo aparte POR la prop `active` — y esa prop era el lag. Ahora se entera
     por bus (`mcSetGastosActive` abajo) y comparte deps con las otras: entrar/salir de Gastos
     ya NO reconstruye Expenses. Se deja el memo propio por si mañana vuelve a necesitar algo
     que las otras no (focusExp sigue aquí). */
  const contenidoGastos=useMemo(function(){
    return tabIds.indexOf("gastos")>=0 ? pageFor("gastos") : null;
    // eslint-disable-next-line
  },[state, totals, tabIds.join("|"), syncing, syncStatus, gotoExp, planGoto, pricing, uid, drawerOpen, locked, gastosForceAll]);
  // Aviso barato a Expenses: sin setState en App que no haga falta, y sin re-render de Gastos.
  useEffect(function(){ mcSetGastosActive(tabIds[tab]==="gastos"); },[tab, tabIds]);
  useEffect(function(){ mcSetCarteraActive(tabIds[tab]==="cartera"); },[tab, tabIds]);
  // Al cambiar de pestaña (o del orden), recalcular qué páginas necesitan `mc-touch-own`.
  // Sin esto, Inicio se quedaba en pan-y tras volver desde Gastos scrolleado, o Plan perdía el
  // gesto de segmento al aterrizar ya arriba del todo sin haber disparado onScroll.
  // También tras CUALQUIER re-render: React pisa className y se lleva el `mc-touch-own` que
  // solo vivía en classList (mismo agujero que page-scroll-host).
  useLayoutEffect(function(){
    const pages=trackRef.current&&trackRef.current.children;
    if(!pages) return;
    for(let i=0;i<pages.length;i++) syncPageTouchAction(pages[i], i);
  });
  useEffect(function(){
    const pages=trackRef.current&&trackRef.current.children;
    if(!pages) return;
    for(let i=0;i<pages.length;i++) syncPageTouchAction(pages[i], i);
  },[tab, tabIds.join("|")]);
  // Build .22: portal en `#root` z-0; `.app`/`.page` transparentes; lavado en `.season-glow`.
  const season=(state.settings&&state.settings.season)||"";
  const reduceMo=!!(state.settings&&state.settings.reduceMotion);
  // El destello va SIEMPRE que haya temática: el portal lleva el fondo sólido + lavado; reduce-motion
  // solo quita las partículas, no el degradado quieto.
  const seasonOn=!!(season && season!=="none");
  const seasonPool=(seasonOn && !reduceMo) ? SEASON_AMB[season] : null;
  // useMemo: mismos spans entre re-renders → la animación CSS no se reinicia al cambiar de tab.
  const seasonLayers=useMemo(function(){
    if(!seasonOn) return null;
    const N=10, out=[];
    for(let i=0;seasonPool&&i<N;i++){
      const em=seasonPool[i%seasonPool.length];
      const rnd=function(seed){ const x=Math.sin((i+1)*seed)*10000; return x-Math.floor(x); };
      const left=Math.round(rnd(12.9898)*96);
      const sz=14+Math.round(rnd(4.1)*8);
      const dur=16+rnd(7.7)*8;
      const delay=-(rnd(3.3)*dur);
      const sway=(4+Math.round(rnd(5.5)*14))*(rnd(9.1)>0.5?1:-1);
      const spin=(rnd(2.2)>0.5?1:-1)*(60+Math.round(rnd(6.6)*100));
      const op=0.14+rnd(1.7)*0.14;
      out.push(React.createElement("span",{key:i,
        style:{left:left+"vw",fontSize:sz+"px",animationDuration:dur+"s",animationDelay:delay+"s",
          "--sway":sway+"px","--spin":spin+"deg","--op":op}}, em));
    }
    // En `#root`, no en body: body z-1 bajo `#root` z-2 nunca se ve en el swipe (build .21).
    var portalRoot=document.getElementById("root")||document.body;
    return ReactDOM.createPortal(
      React.createElement("div",{className:"season-portal","aria-hidden":"true"},
        React.createElement("div",{className:"season-glow","data-season":season,"aria-hidden":"true"}),
        seasonPool ? React.createElement("div",{className:"season-amb","data-season":season,"aria-hidden":"true"}, out) : null
      ),
      portalRoot
    );
  }, [seasonOn, seasonPool, season]);
  const paginas=tabIds.map(function(id,i){
    var live=mountNeighbors ? Math.abs(tab-i)<=1 : (i===tab);
    var show=live||!!mountedTabs[id];
    var isHost=hostTab===i;
    // `page-scroll-host` EN el className de React (no solo classList): si no, cualquier
    // setState de App (botnav al bajar) lo borra y el fling pierde la ola nativa.
    return React.createElement("div",{className:"page"+(show?" page-live":"")+(isHost?" page-scroll-host":""),key:id,onScroll:onPageScroll},
      show ? (id==="gastos"?contenidoGastos:contenidos[id]) : null
    );
  });

  if(locked) return React.createElement(LockScreen,{onUnlock:function(){ setLocked(false); }});
  if(state.onboarded===false) return React.createElement(React.Fragment,null,
    React.createElement(Onboarding,{set:set, onCloud:(cloud.enabled()?onCloudClick:null), onSignup:(cloud.enabled()?onSignupClick:null)}),
    showAuth && React.createElement(AuthPanel,{session:session,onClose:function(){ setShowAuth(false); setRecovery(false); },showToast:showToast,recovery:recovery,startMode:authStart}),
    toast && React.createElement("div",{className:"toast"},toast)
  );

  return React.createElement("div",{className:"app v4"+(mcSandbox()?" sandbox":"")},
    // seasonLayers → portal en document.body (ver useMemo arriba)
    seasonLayers,
    // Banda de MODO PRUEBAS, siempre visible (2026-07-24). Sin ella es cuestión de tiempo apuntar
    // un gasto de verdad en la cartera de mentira y volverse loco buscándolo. Tocarla te saca.
    mcSandbox() && React.createElement("button",{type:"button",className:"sandbox-bar",
      onClick:function(){ mcExitSandbox(); location.reload(); }},
      "🧪 MODO PRUEBAS · los datos no son reales · toca para salir"),
    React.createElement("div",{className:"app-shell",ref:appShellRef},
      React.createElement("div",{className:"viewport",ref:viewportRef},
        React.createElement("div",{className:"track"+(hostTab>=0?" scroll-host-park":""),ref:trackRef}, paginas)
      ),
      React.createElement("nav",{className:"botnav"+(navHidden&&!drawerOpen&&!profileOpen?" botnav-hidden"+(navHiddenFast?" botnav-hidden-fast":""):""),"aria-label":"Navegación"},
        React.createElement("div",{className:"botnav-row"},
          React.createElement("div",{className:"botnav-ind"+(drawerOpen||profileOpen?" hide":""),ref:indRef,
            style:{transform:"translateX("+(tab<=1?tab*100:(tab+1)*100)+"%)"}},
            React.createElement("span",null)
          ),
          React.createElement("button",{className:"botnav-tab"+(tab===0&&!drawerOpen&&!profileOpen?" active":""),"data-tour":"inicio",onTouchStart:function(){ prepMountTab(0); },onClick:function(){ setDrawerOpen(false); setProfileOpen(false); goTab(0); }},
            React.createElement(I.home,null), t("tab_dash")),
          React.createElement("button",{className:"botnav-tab"+(tab===1&&!drawerOpen&&!profileOpen?" active":""),"data-tour":"gastos",onTouchStart:function(){ prepMountTab(1); },onClick:function(){ setDrawerOpen(false); setProfileOpen(false); goTab(1); }},
            React.createElement(I.expense,null), t("tab_gastos")),
          React.createElement("div",{className:"botnav-fab-slot"},
            React.createElement("button",{className:"botnav-fab","aria-label":t("v4_apuntar"),"data-tour":"apuntar",onClick:function(){ setApuntarOpen(true); }},
              React.createElement(I.plus,{width:26,height:26,stroke:"currentColor"}))
          ),
          React.createElement("button",{className:"botnav-tab"+(tab===2&&!drawerOpen&&!profileOpen?" active":""),"data-tour":"plan",onTouchStart:function(){ prepMountTab(2); },onClick:function(){ setDrawerOpen(false); setProfileOpen(false); goTab(2); }},
            React.createElement(I.calendar,null), t("tab_plan")),
          React.createElement("button",{className:"botnav-tab"+(tab===3&&!drawerOpen&&!profileOpen?" active":""),"data-tour":"cartera",onTouchStart:function(){ prepMountTab(3); },onClick:function(){ setDrawerOpen(false); setProfileOpen(false); goTab(3); }},
            React.createElement(I.invest,null), t("tab_cartera"))
        )
      )
    ),
    React.createElement(AskHost,null),
    cloud.enabled() && sharedOpen && React.createElement(SharedPanel,{state:state,set:set,uid:uid,totals:totals,showToast:showToast,
      meEmail:(session&&session.user&&session.user.email)||null,onClose:function(){ setSharedOpen(false); }}),
    React.createElement(ApuntarSheet,{open:apuntarOpen,onClose:function(){ setApuntarOpen(false); },state:state,set:set,showToast:showToast,
      goGastos:function(){ const i=tabIds.indexOf("gastos"); if(i>=0) goTabTop(i); }}),
    tourOpen && React.createElement(Tour,{onDone:endTour, goTab:goTab, tabIds:tabIds}),
    whatsNew && React.createElement(WhatsNew,{onClose:function(){ setWhatsNew(false); },showToast:showToast,set:set,state:state}),
    (upd.updateReady||upd.otaReady) && React.createElement("button",{className:"update-pill",onClick:function(){ upd.applyUpdate(showToast); }},
      (upd.otaReady&&!upd.otaDownloaded)?t("upd_downloading"):t("upd_ready")),
    upd.apkUpd && React.createElement("button",{className:"update-pill",onClick:function(){ upd.installApk(showToast); }}, tf("apk_ready",{v:upd.apkUpd.versionName})),
    !online && React.createElement("div",{className:"offline-pill"}, t("off_pill")),
    toast && React.createElement("div",{className:"toast"},toast),
    showAuth && React.createElement(AuthPanel,{session:session,onClose:function(){ setShowAuth(false); setRecovery(false); },showToast:showToast,recovery:recovery,startMode:authStart}),
    React.createElement("div",{
      className:"settings-push"+(drawerOpen?" open":""),
      ref:drawerRef,
      onTouchStart:drawerOpen?drawerStart:undefined,
      onTouchMove:drawerOpen?drawerMove:undefined,
      onTouchEnd:drawerOpen?drawerEnd:undefined,
      // Mismo agujero que en las pestañas (ver `onCancel`): si el navegador se lleva el gesto,
      // `touchend` no llega y Ajustes se quedaba con el candado y a medio arrastrar.
      onTouchCancel:drawerOpen?drawerCancel:undefined
    },
      React.createElement("div",{className:"settings-push-h"},
        React.createElement("button",{className:"back","aria-label":t("v4_back"),onClick:function(){ setDrawerOpen(false); }},"‹"),
        React.createElement("h1",null, t("settings"))
      ),
      /* «Sincronizar bancos» de Ajustes ahora sincroniza TAMBIÉN Trade Republic, como ya hacía el
         de Cartera. Antes solo lanzaba `runBankSync` (Open Banking), así que el botón que él usa
         para arreglar TR ni siquiera lo tocaba: para él TR es un banco más —lo tiene en el widget—
         y esperar que adivine que va por otro camino es cosa nuestra, no suya. */
      drawerMounted && React.createElement(SettingsPanel,{state:state,set:set,onClose:function(){ setDrawerOpen(false); },showToast:showToast,uid:uid,onBankSync:function(){ return Promise.all([runBankSync({manual:true}), runBrokerSync({manual:true})]); },onTour:openTour,totals:totals,fetchPrices:fetchPrices,refreshFx:refreshFx,goBanks:banksGoto,goBanksFocus:banksFocus,
        goGastos:function(){ setDrawerOpen(false); setGastosForceAll(Date.now()); const i=tabIds.indexOf("gastos"); if(i>=0) goTabTop(i); }})
    ),
    React.createElement("div",{className:"profile-dim-layer"+(profileOpen?" on":""),ref:dimLayerRef,style:profileOpen?{opacity:"1"}:undefined,"aria-hidden":"true"}),
    /* Los gestos NO van por props de React (ver el efecto `profileOpen` de arriba): React registra
       `onTouchMove` como pasivo y ahí `preventDefault()` no hace nada. */
    React.createElement("div",{
      className:"profile-pull"+(profileOpen?" open":""),
      ref:profileRef
    },
      profileMounted && React.createElement(ProfilePanel,{state:state,set:set,
        onClose:function(){ setProfileOpen(false); },
        onOpenSettings:function(){ setProfileOpen(false); setDrawerOpen(true); }})
    )
  );
}

