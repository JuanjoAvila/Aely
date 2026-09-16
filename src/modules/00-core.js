/* ============================================================
   AELY v3 — fuente JSX (se compila con runtime clásico)
   ============================================================ */
const { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useDeferredValue } = React;

/* ---------- CONFIG ---------- */
const CONFIG = {
  PAGE_SIZE: 12,
  TR_INJECTION: 1500,          // €/mes que entran al efectivo de TR con la nómina (1000 caprichos + 500 colchón). Los 50 del FTSE van aparte (manual).
  // --- Supabase (Fase 1). La anon key es pública por diseño (va protegida con RLS). ---
  SUPABASE_URL: "https://sfyfjagbnhbplrljpbvh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmeWZqYWdibmhicGxybGpwYnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzYyODAsImV4cCI6MjA5NzM1MjI4MH0.umMHOZanC4aRSBqiNAjsegyXxcZ-Q-g2oTQtS1JXzZk",
  APP_VERSION: "dev",          // lo sella el CI en cada deploy (scripts/stamp-version.mjs)
  SENTRY_DSN: "",              // opcional: inyectar SENTRY_DSN en CI (scripts/build-app.mjs)
};

/* ---------- Rendimiento: trabajo no urgente tras el primer pintado ---------- */
function mcScheduleIdle(fn, timeoutMs){
  timeoutMs=timeoutMs||2500;
  try{
    if(typeof requestIdleCallback==="function"){ requestIdleCallback(fn,{timeout:timeoutMs}); return; }
  }catch(e){}
  setTimeout(fn, 16);
}

/* Gastos necesita saber si es la pestaña activa (para heavyOk y reset de chips), pero eso NO
   puede viajar como prop: cada cambio de `active` reconstruía Expenses entero justo al aterrizar
   el gesto, y eso era la asimetría «Deudas→Gastos lag / Deudas→Cartera fluido» (el destino
   Cartera no toca Gastos; el destino Gastos sí, vía `gastosActiva` en el memo). Bus + ref: el
   árbol de Gastos se queda quieto; solo corren efectos baratos si hace falta. */
var _mcGastosActive=false;
var _mcGastosActiveCbs=[];
function mcSetGastosActive(on){
  on=!!on;
  if(_mcGastosActive===on) return;
  _mcGastosActive=on;
  for(var i=0;i<_mcGastosActiveCbs.length;i++){
    try{ _mcGastosActiveCbs[i](on); }catch(e){}
  }
}
function mcOnGastosActive(cb){
  if(typeof cb!=="function") return function(){};
  _mcGastosActiveCbs.push(cb);
  try{ cb(_mcGastosActive); }catch(e){}
  return function(){
    var i=_mcGastosActiveCbs.indexOf(cb);
    if(i>=0) _mcGastosActiveCbs.splice(i,1);
  };
}

/* B2 — Cartera necesita el mismo aviso «eres la activa» que Gastos, y por el MISMO motivo: si
   viaja como prop, entrar en Cartera reconstruye el árbol encima del gesto. El count-up no puede
   engancharse al montaje (las pestañas vecinas se premontan) ni a IntersectionObserver (los
   paneles desplazados salen «visibles»). El bus ya existía para Gastos; aquí se replica. No toca
   el carrusel ni los gestos — solo el mismo useEffect de tab que ya llama a mcSetGastosActive. */
var _mcCarteraActive=false;
var _mcCarteraActiveCbs=[];
function mcSetCarteraActive(on){
  on=!!on;
  if(_mcCarteraActive===on) return;
  _mcCarteraActive=on;
  for(var i=0;i<_mcCarteraActiveCbs.length;i++){
    try{ _mcCarteraActiveCbs[i](on); }catch(e){}
  }
}
function mcOnCarteraActive(cb){
  if(typeof cb!=="function") return function(){};
  _mcCarteraActiveCbs.push(cb);
  try{ cb(_mcCarteraActive); }catch(e){}
  return function(){
    var i=_mcCarteraActiveCbs.indexOf(cb);
    if(i>=0) _mcCarteraActiveCbs.splice(i,1);
  };
}

/* Le dice al SPLASH de entrada que ya puede irse: lo que se vea a partir de ahora es lo bueno.
   El vigilante vive al final de shell.html y no depende de esto para retirarse (tiene un tope de
   1,8 s), así que llamar de más es gratis y no llamar nunca solo devuelve el comportamiento viejo.
   Idempotente a propósito: lo llaman varios caminos (sin nube, sin sesión, candado, alta, y el
   final del primer pull de la nube) y ninguno sabe de los demás.
   Emite `mc-boot-ready` para que Inicio pueda quitar los esqueletos (B4) sin sondear. */
function mcBootReady(){
  try{
    if(window.__mcBootReady) return;
    window.__mcBootReady=true;
    window.dispatchEvent(new Event("mc-boot-ready"));
  }catch(e){}
}

/* EJE DE UN GESTO: "x", "y" o null (todavía no está claro).
   Lo comparten el swipe horizontal entre pestañas (11-app-main.js) y el vertical de Plan
   (14-v4-screens.js). Vive AQUÍ y no duplicado en cada uno porque tenerlo por duplicado es
   exactamente lo que se rompió: dos gestos decidiendo por su cuenta sobre el mismo dedo.

   Antes se decidía por proporción (|ddx| > |ddy|·1,25) en cuanto el dedo pasaba de 10 px. Pero el
   pulgar de una mano que agarra el móvil sale primero de lado y baja después: a los 10 px, un
   tirón hacia abajo lleva 4 px de lado y 1 hacia abajo, así que se declaraba HORIZONTAL para
   siempre. Medido el 4/8 a mitad de una lista de Deudas, bajando 190 px: con 80 px de deriva la
   app se iba a la pestaña de Gastos («al ir hacia abajo se vuelve loco y cambia también de tabs»)
   y con 40-60 px el scroll se quedaba muerto sin más («hay un stopper... como un muro invisible»).

   Ahora un eje tiene que sacarle VENTAJA CLARA al otro en píxeles, no en proporción. Un desliz
   horizontal de verdad la saca a los ~12 px —igual de rápido que antes—, y una bajada con deriva
   ya no gana por haber salido de lado. Si el dedo va en diagonal exacta no gana nadie y se queda
   el scroll del navegador, que es lo que el usuario espera. */
const GEST_LEAD=12;   // px de ventaja de un eje sobre el otro para reclamarlo
const GEST_MAX=64;    // sin ventaja clara a esta distancia, decide el mayor (no dejar el gesto colgado)
function gestureAxis(ddx,ddy){
  const ax=Math.abs(ddx), ay=Math.abs(ddy);
  if(ax-ay>=GEST_LEAD) return "x";
  if(ay-ax>=GEST_LEAD) return "y";
  if(Math.max(ax,ay)>=GEST_MAX) return ax>ay?"x":"y";
  return null;
}

var _mcSentryReady=false;
var _mcSentryQueue=[];
function mcInitSentry(){
  if(!CONFIG.SENTRY_DSN || typeof Sentry==="undefined") return;
  try{
    Sentry.init({
      dsn: CONFIG.SENTRY_DSN,
      release: "mi-cartera@"+CONFIG.APP_VERSION,
      environment: (typeof _mcNative!=="undefined"&&_mcNative) ? "android" : "web",
      tracesSampleRate: 0.05,
      // No mandar cuerpos/URL con posibles cifras de la cartera (privacidad).
      beforeSend: function(ev){
        try{
          if(ev&&ev.request){ delete ev.request.data; delete ev.request.cookies; if(ev.request.headers){ delete ev.request.headers.Authorization; delete ev.request.headers.authorization; } }
          if(ev&&ev.extra){ ["state","expenses","accounts","investments","budget"].forEach(function(k){ delete ev.extra[k]; }); }
        }catch(e){}
        return ev;
      }
    });
    _mcSentryReady=true;
    while(_mcSentryQueue.length){
      var q=_mcSentryQueue.shift();
      try{ Sentry.captureException(q.err, q.ctx?{extra:q.ctx}:undefined); }catch(e){}
    }
  }catch(e){}
}
// Sentry (~340 KB) NO se parsea en el cold start: se inyecta tras el primer pintado (feedback 2026-07-16).
function mcLoadSentryDeferred(){
  if(!CONFIG.SENTRY_DSN) return;
  if(typeof Sentry!=="undefined"){ mcInitSentry(); return; }
  if(document.querySelector('script[data-mc-sentry]')) return;
  var s=document.createElement("script");
  s.src="vendor/sentry.bundle.min.js";
  s.async=true;
  s.setAttribute("data-mc-sentry","1");
  s.onload=function(){ mcInitSentry(); };
  s.onerror=function(){};
  (document.head||document.documentElement).appendChild(s);
}

function mcCaptureError(err, ctx){
  try{
    if(!CONFIG.SENTRY_DSN) return;
    if(typeof Sentry!=="undefined"&&_mcSentryReady){ Sentry.captureException(err, ctx?{extra:ctx}:undefined); return; }
    // Cola corta: un error justo al abrir no se pierde si Sentry aún está bajando.
    if(_mcSentryQueue.length<8) _mcSentryQueue.push({err:err,ctx:ctx});
  }catch(e){}
}

/* ---------- Categorías de gasto variable ---------- */
const CATEGORIES = [
  { id:"super",      name:"Supermercado",        color:"#5FD08A", icon:"🛒" },
  { id:"pan",        name:"Panadería",           color:"#E0B080", icon:"🥖" },
  { id:"bares",      name:"Bares y restaurantes", color:"#E6C36A", icon:"🍽️" },
  { id:"cine",       name:"Cine",                color:"#E8A0C8", icon:"🍿" },
  { id:"padel",      name:"Pádel",               color:"#6BCB77", icon:"🎾" },
  { id:"heladeria",  name:"Heladería",           color:"#F5A3C7", icon:"🍦" },
  { id:"ia",         name:"Inteligencia artificial",color:"#C9A0E0", icon:"🤖" },
  { id:"ocio",       name:"Ocio",                color:"#9BD0E0", icon:"🎭" },
  { id:"gaming",     name:"Videojuegos",         color:"#7B8CDE", icon:"🎮" },
  { id:"viajes",     name:"Viajes",              color:"#5B8DEF", icon:"✈️" },
  { id:"transporte", name:"Transporte",          color:"#7FB5E8", icon:"🚇" },
  { id:"parking",    name:"Parking",             color:"#8AA0B8", icon:"🅿️" },
  /* AGUA, LUZ Y GAS POR SEPARADO (2026-09-12). Antes era una sola, «Luz, gas y agua», con un ⚡
     de icono. Suyo: *«sale un símbolo de rayito en Aigües de Barcelona que no encaja para nada…
     Agua por un lado con su símbolo, luz por otro y gas por otro»*. Tenía razón: el recibo del
     agua con un rayo al lado. Se midió antes de partirla: solo había **2 filas** en `energia` en
     toda la familia y **ningún límite por categoría** puesto, así que no hay nada que reasignar.
     ⚠ `energia` ya NO existe como id. Las filas viejas se curan por `resolveCategory` (que cae a
     `autoCategory` si la categoría guardada no está en `CAT`) y por el remapeo en `seedFlows`
     (migrate NO corre en estados actuales — `_dataVer>=6`). */
  { id:"agua",       name:"Agua",                color:"#6FC3E8", icon:"💧" },
  { id:"luz",        name:"Luz",                 color:"#E8C547", icon:"💡" },
  { id:"gas",        name:"Gas",                 color:"#E8945F", icon:"🔥" },
  { id:"tasas",      name:"Impuestos y multas",  color:"#C97D5F", icon:"🏛️" },
  { id:"recibos",    name:"Recibos",             color:"#8FB8C9", icon:"🧾" },
  { id:"compras",    name:"Compras",             color:"#C9A0E0", icon:"🛍️" },
  { id:"educacion",  name:"Educación",           color:"#6A9FD8", icon:"📚" },
  { id:"salud",      name:"Salud",               color:"#6FD6C9", icon:"💊" },
  { id:"pelu",       name:"Peluquería",          color:"#D8A3C8", icon:"💇" },
  { id:"mascotas",   name:"Mascotas",            color:"#C4A574", icon:"🐾" },
  { id:"hogar",      name:"Hogar",               color:"#B7C98A", icon:"🏠" },
  { id:"regalos",    name:"Regalos",             color:"#E89CB0", icon:"🎁" },
  { id:"joyeria",    name:"Joyería",             color:"#D4AF37", icon:"💍" },
  /* Bizum ANTES de otros (feedback 10/9): manda y recibe a menudo; quiere verlo aparte
     en el desglose y en el límite por categoría, no mezclado en «Otros». */
  { id:"bizum",      name:"Bizum",               color:"#5B9FE8", icon:"📲" },
  { id:"otros",      name:"Otros",               color:"#8FA89A", icon:"📦" },
];
const CAT = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));
const INGRESO_CAT = { id:"ingreso", name:"Ingreso", color:"#5FD08A", icon:"💰" };
// Ni gasto ni ingreso: dinero que sale del efectivo pero va a un fondo (round-up/cashback/aporte
// automático de un bróker). Ver `applyInvestBuy` en 08-motor-bank.js y `reconcileTR` en este fichero.
const INVERSION_CAT = { id:"inversion", name:"Inversión", color:"#D4AF37", icon:"📈" };
// Dinero TUYO que cambia de cuenta (la nómina que te traspasas de un banco a otro para el mes).
// Se apunta —«Mi ciclo» se ancla a él, ver `lastPaydayOf`— pero no es dinero nuevo: no suma a los
// ingresos del mes, o al conectar también el banco de origen se contaría dos veces (2026-08-04).
const TRASPASO_CAT = { id:"traspaso", name:"Traspaso", color:"#8AA0B8", icon:"🔄" };
/* LA CUOTA DE UNA DEUDA QUE MANDA EL BANCO (4.21.0, idea suya del 12/9: «categorías automáticas
   por las deudas… y así se pudieran filtrar»). Antes `importObExpenses` la TIRABA para no contarla
   dos veces: ya resta en el Plan. Ahora entra, con `debtId`, pero neutra: se ve y se filtra, y no
   suma al gastado del mes. El saldo de gasto SÍ la sigue contando, a propósito (ver
   `expenseCountsCash`). La pone `marcarCuotasDeDeuda`: no sale en el selector de categorías. */
const DEUDA_CAT = { id:"deudas", name:"Deudas", color:"#C98A7A", icon:"💳" };
// Categorías que NO son gasto ni ingreso: mueven dinero, no lo crean ni lo consumen.
const CAT_NEUTRAS = { inversion:1, traspaso:1, deudas:1 };
const catOf = (id)=> id==="ingreso" ? INGRESO_CAT : (id==="inversion" ? INVERSION_CAT : (id==="traspaso" ? TRASPASO_CAT : (id==="deudas" ? DEUDA_CAT : (CAT[id] || CAT.otros))));
const catName = (id)=> t("cat_"+(catOf(id).id));   // nombre traducido de la categoría
const freqLabel = (f)=> t("freq_"+f);              // frecuencia traducida

/* Autodetección de categoría por comercio (mismas keywords que el GAS, ampliadas) */
/* Overrides personales: comercios concretos que mapeas a tu manera (substring en minúsculas) */
// (vacío desde v3.73: los overrides personales viven en state.catOverrides de cada usuario;
//  el "mapfre→bares" del creador se siembra solo en su cartera demo en seedFlows)
const MERCHANT_OVERRIDES = {};
// Overrides PERSONALES del usuario (comercio→categoría), que aprende al recategorizar a mano.
// Se puebla desde state.catOverrides al cargar. Tiene prioridad sobre las keywords.
let USER_OVERRIDES = {};
function catKey(merchant){ return (merchant||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim(); }
/* EL VOCABULARIO CERRADO DE LAS MÉTRICAS DE USO (ver `cloud.logUso`, más abajo).
   Todo lo que se puede medir está en esta lista y en ningún otro sitio. Es a propósito: con una
   etiqueta libre, el primer `logUso("gasto en "+comercio)` que alguien escriba con buena
   intención se lleva el nombre de una tienda a una tabla de la nube, y esto es una app de
   finanzas de una familia (AGENTS §9). Añadir una métrica es añadir una línea AQUÍ, donde se ve
   en el diff y se puede discutir antes de que viaje nada. */
const USO_OK=[
  // Pantallas: cuáles se usan de verdad y cuáles sobran.
  "tab_inicio","tab_gastos","tab_plan","tab_cartera",
  "abre_perfil","abre_ajustes","abre_hogar","abre_novedades",
  // Acciones: qué hace la gente, no con qué.
  "apunta_gasto","apunta_ingreso","crea_meta","crea_deuda","amortiza","edita_presupuesto",
  "sync_bancos","sync_brokers","import_hoja","import_csv","export_backup","informe_mes",
];
/* Orden del objeto = prioridad al clasificar. Cosas finas ANTES que el cajón (pan/cine
   antes que bares; padel DESPUÉS de bares —«restaurante de pádel» es comida; viajes antes
   que ocio; mascotas/energía antes que hogar; recibos DESPUÉS de ocio —«movistar plus» es
   streaming, el teléfono Movistar no). Alineado con ingest_logic.ts.

   «bar» va SIN espacio detrás (2026-08-06): con `"bar "` sólo picaban los nombres que siguen con
   algo («BAR PEPE»), y los que ACABAN en bar —«1331 BAR», «SNACK BAR»— caían en «otros». Sin
   espacio son 3 letras y entra por el `hit()` de abajo, con límite de palabra: el mismo que evita
   que «Barcelona» acabe en bares. */
const KW = {
  pan:["panaderia","pasteleria","pastisseria","fleca","forn de pa","forn ","obrador","croissant","boulangerie","bakery","granier","santagloria","santa gloria","panificadora","brioche","horno de pan","horno artesano","panaria","el forn","viena ","entpan","panetteria"],
  cine:["cinema","cine","cinesa","yelmo","kinepolis","odeon","mk2","renoir","multicines","entradas.com","atrapalo","ticketmaster","imax","cinemes","filmotech"],
  // Heladería ANTES que bares: si no, «heladería X» caía en restaurantes.
  heladeria:["heladeria","gelateria","ice cream","llaollao","llao llao","ocool","frosti","haagen","ben & jerry","ben and jerry","grom ","amorino"],
  bares:["restaurante","bar","cafe","cafeteria","mcdonald","burger","pizza","sushi","tapas","cerveceria","bodega","bocadillo","kebab","pollo","grill","braseria","taberna","comida","food","lunch","dinner","brunch","desayuno","telepizza","glovo","just eat","uber eats","kfc","five guys","fiveguys","goiko","tgb","taco bell","tacobell","domino","papa john","subway","starbucks","vips","foster","montadito","rodilla","pans &","pans ","wok ","ramen","poke","taco","churreria","churros","asador","brasa","marisqueria","mariscos","pub ","shawarma","doner","döner","nandos","popeyes","dunkin","donut","tim hortons","cien montaditos","la sureña","sureña","muerde la pasta","ginos","la tagliatella","tagliatella","udon","wagamama","honest greens","croqueteria","tortilleria","gastrobar","vermuteria","coctel","cocktail","vending","expendedor","deliveroo","too good to go","toogoodtogo","mcdonalds","mcdonald's","burger king","hamburgues","cervecer","cerveseria","fosters hollywood","ladydiana","100 montaditos","comida a domicilio"],
  // Pádel DESPUÉS de bares: «restaurante de pádel» debe ser comida (feedback histórico).
  padel:["padel","pádel","playtomic","paddle","club de padel","club padel","pista padel","padel pro","world padel","premier padel","indoor padel"],
  super:["mercadona","lidl","aldi","carrefour","dia","bonpreu","bon preu","consum","eroski","spar","alcampo","simply","supermercado","market","fresco","verduleria","fruteria","hipercor","caprabo","condis","ahorramas","ahorramás","gadis","froiz","bm supermarket","family cash","supeco","costco","makro","amazon fresh","glovo market","compra online mercadona"],
  // Viajes ANTES que ocio/transporte: booking/vueling no son «ocio» ni solo «metro».
  viajes:["booking","airbnb","hotel","hostal","hostel","apartament turistic","apartamento turistico","vueling","iberia","ryanair","easyjet","vuelos","vuelo ","aeropuerto","airport","expedia","trivago","kayak","edreams","rumbo","logitravel","civitatis","getyourguide","amadeus","renfe ave","hotelbeds","marriott","hilton","ibis ","nh hotel","melia","meliá","barcelo","barceló","ac hotel","travelodge","pension ","pensión ","camping","ferry","balearia","grimaldi","cruise","crucero","tourist","turismo"],
  transporte:["transport","renfe","fgc","tmb","metro","autobus","bus ","taxi","cabify","uber","gasolina","repsol","cepsa","shell","bp ","galp","autopista","peaje","tram","bicing","blablacar","flixbus","moove","bolt","ouigo","iryo","avlo","rodalies","emt ","alsa","avanza","ok mobility","sixt","hertz","europcar","petrocat","ballenoil","plenergy","carrefour gas","gasoleo","gasóleo","diesel","diésel","carburante","recarga electr","electrolinera","tesla supercharger","free now","freenow","taxi barcelona","ambitus"],
  parking:["parking","parquimetro","parkimetro","parquímetro","aparcament","aparcamiento","saba","b:sm","bsm","empark","interparking","apk2","apk80","onepark","elparking","easypark","telpark","zona azul","zona verde","area verde","àrea verda","grua municipal","indigo parking","secure parking"],
  // Energía ANTES que hogar (luz/gas no es «muebles»).
  /* AGUA / LUZ / GAS: tres listas donde antes había una (2026-09-12).
     ⚠ EL ORDEN IMPORTA, y aquí más que en ningún sitio: `agua` va PRIMERA a propósito. Las
     comercializadoras de luz venden también gas y agua a veces, y si `luz` fuese antes, un
     «AIGUES DE BARCELONA» con la palabra «energia» en el concepto caería en luz. Con `agua`
     delante, lo específico gana a lo genérico.
     ⚠ Y las AMBIGUAS —Naturgy, Endesa, Iberdrola, TotalEnergies— venden luz Y gas, y por el
     nombre del comercio **no se puede saber cuál es**. Van a `luz`, que es la factura más común,
     y si él le cambia la categoría a mano el override se lo aprende para siempre. Decidido con
     Cursor (voto A, 12/9). Leer la `nota` del banco —que SÍ lo dice: su recibo literal es
     «AGUA AIGUES DE BARCELONA SUBMINISTRAMENT D»— es otra tanda: cambia la firma de
     `autoCategory` y habría que moverla en los DOS lados del espejo a la vez.
     ⚠ Esto es un REPARTO de la lista que ya había, no una ampliación: las palabras son las
     mismas de `energia`, cada una en su sitio. La única nueva es `nedgia` (la distribuidora de
     gas de Cataluña), y entra porque sin ella no hay forma de que él PRUEBE la categoría Gas.
     Traía media docena más —emasesa, hidraqua, butano, electricidad…— y las quité: ninguna tenía
     un movimiento suyo detrás, y el presupuesto de gzip estaba a 0,1 KB del tope. */
  agua:["aigues de barcelona","aigües de barcelona","agbar","aqualia","sorea","canal de isabel","factura agua","factura aigua"],
  luz:["endesa","iberdrola","naturgy","repsol luz","holaluz","octopus energy","octopus ","totalenergies","total energies","factor energia","factor energía","lucera","pepeenergy","pepe energy","energia ","energía ","suministro electric","suministro eléctric","factura luz","tarifas luz","potencia contratada"],
  gas:["gas natural","factura gas","nedgia"],
  tasas:["gencat","generalitat","atc ","agencia tributaria","aeat","ajuntament","ayuntamiento","diputacio","diputación","dgt","multa","multa transit","sancion","sanción","tribut","impost","impuesto","tax agency","taxes","ibi","ivtm","basura","residus","residuos","canon agua","canon de l'aigua","tasa","taxa","registro mercantil","registro civil","notaria","notaría","gestoria","gestoría","procurador","abogado","lexnet","catastro","seguretat social","seguridad social","tgss","recaudacion","recaudación","zona bajas emisiones","zbe","hacienda","hisenda","modelo 100","modelo 303","autoliquidacion","autoliquidación","plusvalia","plusvalía","impuesto circulacion"],
  educacion:["universidad","universitat","uab ","upc ","upf ","ub ","uoc ","uned","campus","matricula","matrícula","academia","academía","curso ","cursos","formacion","formación","master ","máster","mba ","udemy","coursera","domestika","linkedin learning","skillshare","colegio","escola","guarderia","guardería","escuela infantil","libro de texto","libreria universitaria","openenglish","open english","british council","oxford house","academia de ingles","academia d'angles","autoescuela","autoescola","dgt examen","permiso conducir"],
  // Videojuegos ANTES que ocio/compras: Steam e Instant Gaming no son «Netflix» ni «Amazon».
  gaming:["steam","instant gaming","instantgaming","instant-gaming","g2a","eneba","cdkeys","humble bundle","epic games","battle.net","vs gamers","versus gamers","playstation store","xbox store","nintendo eshop","nintendo e-shop"],
  // Suscripciones de IA separadas de Ocio (feedback 2026-09-07): son herramientas de trabajo
  // distintas de Netflix/Spotify y el presupuesto tiene que poder enseñarlas por separado.
  ia:["anthropic","claude","claude.ai","openai","chatgpt","chat gpt","gpt-","cursor","midjourney","perplexity","github copilot"],
  ocio:["spotify","netflix","hbo","disney","playstation","xbox","nintendo","fnac","museo","teatro","concierto","decathlon","gym","gimnasio","sport","bolera","google one","google play","googleplay","play store","playstore","icloud","apple.com","apple servic","youtube premium","youtube music","prime video","amazon prime","twitch","crunchyroll","dazn","filmin","movistar plus","rakuten","audible","deezer","tidal","dropbox","notion","canva","duolingo","atraccion","atracción","parque tematico","zoologic","zoológico","aquarium","aquari","escape room","ocio","basic fit","basic-fit","dir ","metropolitan","synergym","fitness park","puregym","mcfit","crossfit","bowling","karaoke","laser tag","minigolf","parque de atracciones","portaventura","ferrari land","tibidabo"],
  // Recibos DESPUÉS de ocio: «movistar plus» es streaming; el teléfono Movistar, no.
  // Impuestos en tasas; Sanitas/Adeslas en salud (luz/agua/gas ya van por su lista).
  recibos:["vodafone","yoigo","masmovil","mas movil","pepephone","jazztel","finetwork","simyo","lowi","parlem","digi espa","digi mobil","digi mov","movistar","orange es","orange espana","orange spain","orange fibra","orange movil","o2 es","o2 espa","telefonia","telefonica","fibra optica","factura movil","recibo movil","mapfre","allianz","axa ","axa.","pelayo","zurich","genesis seguro","direct seguros","mutua madrilena","linea directa","reale seguro","helvetia","alquiler","comunidad de prop","administracion de finca","adm fincas","cuota comunidad","prosegur","securitas direct"],
  compras:["zara","mango","primark","stradivarius","bershka","pull &","pull&","el corte","amazon","amzn","aliexpress","pccomponentes","mediamarkt","worten","nike","adidas","foot locker","alehop","ale hop","ale-hop","tiger","flying tiger","normal ","tedi","action","casa ","muy mucho","sostrene","søstrene","kiabi","lefties","springfield","cortefiel","jd sports","sprinter","shein","temu","massimo","oysho","cyrillus","calzedonia","intimissimi","clas ohlson","veritas","douglas perfum","cofidis","papeleria","papelería","copisteria","copistería","liberia","libreria","druni","primor","sephora","perfumeria","fnac ","game ","app store","apple store","samsung store","xiaomi store","coolmod","uniqlo","h&m","hm ","pull and bear","bimba y lola","swatch"],
  salud:["farmacia","fcia","clinica","clínica","medico","médico","doctor","dra.","dr.","consulta","ambulatorio","urgencias","hospital","optica","óptica","fisio","fisioterapia","masaje","podologo","podólogo","psicologo","psicólogo","psiquiatra","sanitas","adeslas","asisa","dkv","mutua","quiron","quirón","cima","cap ","centro medico","centro médico","laboratorio","analisis","análisis","radiologia","radiología","dentista","dental","ortodoncia","oculista","oftalmo","cruz verde","procare","vitaldent","vital dent","donte","dental company","general optic","multiopticas","multioptics","promofarma","dosfarma","atida","pocoyofarma"],
  pelu:["peluqueria","perruqueria","barberia","barber","estilis","hair","salon de belleza","nails","manicura","pedicura","lash","cejas","estetica","belleza","depilacion","depilación","corte de pelo","tinte pelo","balayage"],
  // Mascotas ANTES que hogar.
  mascotas:["zooplus","kivet","tiendanimal","miscota","animalis","kiwoko","pienso","veterinario","veterinari","clinica veterinaria","clínica veterinaria","peluqueria canina","peluquería canina","petsia","dogfy","affinity pet","royal canin","hills pet","purina","advance dog","advance cat","gos ","gat ","perro","gato","mascota"],
  hogar:["ikea","leroy","bricomart","bauhaus","ferreteria","muebles","sofa","sofá","lampara","lámpara","tintoreria","tintorería","lavanderia","lavandería","mrw","seur","correos","amazon locker","bricodepot","bricodépôt","aki ","aki.","ferretería","manitas","limpieza hogar","limpiapro","blink ","dyson","rowenta","bosch electro","balay","teka"],
  regalos:["regalo","flores","floristeria","floristería","perfumeria","perfumería","interflora","teleflorist","rosas ","ramo ","douglas"],
  joyeria:["joyeria","joyeros","tiffany","cartier","swarovski","tous ","pandora"],
  /* Bizum al final del vocabulario de gasto (antes de caer en otros). Los BIZUM RECIBIDOS
     suelen entrar como ingreso por el signo; esto pilla los enviados / el comercio «BIZUM …». */
  bizum:["bizum","bizum a ","bizum de ","envio bizum","envío bizum","pago bizum","bizum movistar","bizum bbva","bizum caixa","bizum sabadell","bizum santander"],
};
/* ¿QUÉ DÍA ES ESTO? EN HORA LOCAL, COMO LO QUE SE LEE EN PANTALLA (2026-09-11/12).
   `dayKey` era `d.toISOString().slice(0,10)` —**UTC**— mientras la etiqueta de la cabecera sale de
   `toLocaleDateString`, que es la hora del móvil. En España cualquier gasto entre las 00:00 y las
   02:00 cae en el día UTC ANTERIOR, así que un día se partía en dos grupos y la misma fecha salía
   DOS VECES seguidas como cabecera. Se ve en su captura del 11/9: «DOMINGO, 6 SEPT» y justo debajo
   otra vez «DOMINGO, 6 SEPT». Medido en Europe/Madrid antes de tocar nada:
     06/09 01:00 local → clave 2026-09-05, etiqueta «domingo, 6 sept»   ← el que parte el día
     06/09 12:00 local → clave 2026-09-06, etiqueta «domingo, 6 sept»
     07/09 00:30 local → clave 2026-09-06, etiqueta «lunes, 7 sept»     ← y este se cuela en el 6
   Afectaba igual a «Hoy» y «Ayer», que salen de comparar esta misma clave: de madrugada, lo de hoy
   se etiquetaba como ayer. Mismo fallo que ya se arregló para el mes (`inicioDeMesMs`, B09-B): la
   app vive en la hora del móvil, no en UTC.

   ⚠ Y VIVE AQUÍ, EN CORE, NO EN i18n: no es traducción, es la regla de qué día es cada cosa, y la
   usan DOS sitios que tienen que decir lo mismo — las cabeceras de Gastos y el orden a mano
   (`sortExpensesForDisplay` / `moveExpenseWithinDay`). Aquellos partían el día con el prefijo ISO
   del string guardado, o sea otra vez UTC: un gasto de madrugada se veía bajo su día local pero su
   clave de orden era la del día anterior, así que **arrastrarlo no hacía nada** — `moveExpenseWithinDay`
   comparaba los dos días, no coincidían y devolvía el estado sin tocar. Dos reglas para la misma
   pregunta es el patrón que ya costó caro ([[misma-regla-en-dos-sitios]]). */
const dayKey=(d)=> String(d.getFullYear())+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
/* El día de un GASTO, que guarda la fecha como texto. Pasa por `dateMs` (que ya sabe de los
   formatos raros del histórico) y de ahí a la clave local. */
function diaDeGasto(e){ return dayKey(new Date(dateMs(e&&e.date))); }

/* PALABRAS QUE SOLO VALEN ENTERAS (2026-09-11). El emparejador va por substring en cuanto una
   palabra tiene 4 letras o más, y eso muerde cuando una MARCA es el principio de una palabra
   corriente. Medido con sus gastos reales de septiembre:

     «AIGUES DE BARCELONA»       → viajes   (debería ser energía)
     «SQ *PASTABAR BARCELONA S.» → viajes   (pasa a «otros»: ver abajo)
     «Taxi Barcelona»            → viajes   (debería ser transporte)

   Culpa de **«barcelo»**, que está en viajes por la cadena de hoteles Barceló y casa dentro de
   BARCELONA. Él vive en Barcelona: le afecta a todo lo que lleve la ciudad en el nombre y no lo
   haya pillado antes una regla anterior.

   Con esta lista, el término pasa por el mismo camino de límite de palabra que ya usaban «bar» o
   «bus»: «Hotel Barceló Sants» sigue casando, «Aigües de Barcelona» ya no.

   `PASTABAR` se queda en **«otros»**, y es lo correcto: «bar» pide límite de palabra y PASTABAR no
   lo tiene, así que nunca fue un bar por mérito propio — caía en viajes de rebote por Barceló.
   Meterle «pastabar» a la lista sería hacerle un traje a un comercio.
   ⚠ La MISMA lista vive en `supabase/functions/_shared/ingest_logic.ts`, y el guardián
   `categorias-dual` exige que digan lo mismo. */
const KW_PALABRA={
  "barcelo":1,    // la cadena Barceló ⊂ BARCELONA — «Aigües de Barcelona» salía como viaje
  /* Las tres de abajo las encontró Cursor buscando la misma forma, y las MIDIÓ antes de
     proponerlas. La de `saba` es la más fea de esta casa, porque es a la vez el aparcamiento SABA
     y el banco de su familia: «Transferencia a banco Sabadell» salía como **Parking**. */
  "saba":1,       // SABA aparcamientos ⊂ SABADELL
  "zara":1,       // Zara ⊂ ZARAGOZA
  "hospital":1,   // hospital ⊂ HOSPITALET
  "mango":1,      // la tienda Mango ⊂ MANGOpay, la pasarela de pago de Vinted (2026-09-12)
};
/* PALABRAS QUE TIENEN QUE EMPEZAR PALABRA (2026-09-12). Hermana de `KW_PALABRA`, pero NO la misma,
   y la diferencia es la que hace que funcione:

     · `KW_PALABRA` son PREFIJOS de una palabra más larga (BARCELOna, SABAdell). Necesitan límite
       por los DOS lados, porque el fallo está en lo que viene detrás.
     · `KW_INICIO` son SUFIJOS o infijos (aPOLLOn, tranSPORTe). Les basta con límite por DELANTE.

   Si a estas les pidiera los dos lados, dejarían de reconocer los PLURALES: «POLLOS ASADOS» ya no
   sería un bar. Por eso son dos listas y no una.

   Salieron de barrer sus 237 comercios distintos, y cada una lleva detrás un movimiento SUYO de
   verdad — aquí no se meten palabras por sospecha:

     «Transporte publico»      → ocio     por  sport  ⊂ tranSPORTe      (el peor: ese nombre se repite)
     «BRESSOLGRAMENET S.A.»    → bares    por  ramen  ⊂ bressolgRAMENet
     «APOLLON GALLERY»         → bares    por  pollo  ⊂ aPOLLOn

   ⚠ `mango` ⊂ MANGOpay parecía de esta familia y NO lo es: mango EMPIEZA la palabra, así que
   exigirle límite por delante no lo arregla. Es un prefijo, o sea `KW_PALABRA`. Lo pilló el test.
   ⚠ Probada y DESCARTADA la regla general «límite por delante para TODO término de ≥4 letras»:
   rompe KIWIBURGER y TELEPIZZA, que hoy aciertan de rebote. Medido, no supuesto.
   ⚠ La MISMA lista vive en `supabase/functions/_shared/ingest_logic.ts`, y el guardián
   `categorias-dual` exige que digan lo mismo. */
const KW_INICIO={
  "sport":1,      // ⊂ tranSPORTe
  "ramen":1,      // ⊂ bressolgRAMENet (Santa Coloma de Gramenet)
  "pollo":1,      // ⊂ aPOLLOn
};
/* Retirada de cajero / ATM → traspaso (neutro). Mismas claves en ingest_logic.ts. */
/* Categoría al ALTA de un movimiento nuevo (OB/import/ingest). ATM → traspaso.
   NUNCA meter esto en autoCategory: migrate recategoriza «otros» en cada carga y
   cambiaría totales de meses ya cerrados (bloqueo Claude 2026-09-08, misma regla que IA). */
/* QUÉ CATEGORÍA SUGERIR MIENTRAS ESCRIBES EL CONCEPTO EN APUNTAR (13/9, brief
   `docs/briefs/brief-ia-al-escribir-concepto.md`, opción A elegida por él).
   Función pura: la pantalla le pasa lo que hay y ella dice qué hacer. Tres reglas:
   1. Lo que TÚ tocas manda: si ya elegiste un chip a mano, nada lo mueve (`kwCat` null).
   2. Palabras clave primero (gratis): si saben, se aplica sola esa categoría y NO se pregunta a la IA.
   3. La IA solo si las palabras clave dicen «otros», está encendida y hay nube; su respuesta se
      OFRECE como chip (no se aplica) y solo si es para el texto que hay AHORA (una vieja se tira).
   o = { concepto, tocadaAMano, iaOn, nube, iaPara, iaCat } */
function sugerenciaApuntar(o){
  o=o||{};
  const texto=String(o.concepto||"").trim();
  const nada={ kwCat:null, pedirIA:false, chipIA:null };
  if(texto.length<3) return nada;
  const kw=categoryOfNewMerchant(texto);
  if(kw && kw!=="otros" && CAT[kw]){
    return { kwCat: o.tocadaAMano ? null : kw, pedirIA:false, chipIA:null };
  }
  const iaVigente = o.iaPara===texto && o.iaCat && o.iaCat!=="otros" && CAT[o.iaCat] ? o.iaCat : null;
  return {
    kwCat:null,
    pedirIA: !!(o.iaOn && o.nube && o.iaPara!==texto),
    chipIA: iaVigente
  };
}
function categoryOfNewMerchant(merchant){
  if(isAtmWithdrawal(merchant)) return "traspaso";
  return autoCategory(merchant||"");
}
function isAtmWithdrawal(merchant){
  const c=(merchant||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(!c) return false;
  if(c.indexOf("cajero")!==-1) return true;
  if(c.indexOf("cash withdrawal")!==-1 || c.indexOf("cashwithdrawal")!==-1) return true;
  if(c.indexOf("retirada de efectivo")!==-1) return true;
  if(c.indexOf("reintegro")!==-1) return true;
  if(c.indexOf("retrait")!==-1 && c.indexOf("espece")!==-1) return true;
  if(/\batm\b/.test(c)) return true;
  return false;
}
function autoCategory(merchant){
  const c=(merchant||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const key=c.trim();
  // "Inversi\u00f3n" NUNCA se adivina por comercio (2026-08-04). Es una categor\u00eda de DESTINO del dinero,
  // no un tipo de tienda: solo la pone el aporte autom\u00e1tico reconocido por importe exacto
  // (`importObExpenses`) o el usuario a mano. Sin este blindaje, un override envenenado \u2014el que
  // dej\u00f3 el bug de "Movimiento", ver `fixMovInvasion`\u2014 convierte en Inversi\u00f3n CUALQUIER gasto que
  // pase por aqu\u00ed: fue lo que volvi\u00f3 a marcar solo un parking de zona azul de 9,50 \u20ac cada vez que
  // abr\u00eda la app, porque `migrate` re-categoriza todo lo que est\u00e9 en "otros" y no sea manual.
  if(USER_OVERRIDES[key] && !CAT_NEUTRAS[USER_OVERRIDES[key]]) return USER_OVERRIDES[key];   // lo que T\u00da has aprendido a mano
  for(const k in MERCHANT_OVERRIDES){ if(c.indexOf(k)!==-1) return MERCHANT_OVERRIDES[k]; }  // overrides de ejemplo
  // Keywords cortas (bar, bus…) con límite de palabra: si no, "Barcelona" caía en bares
  // por el substring «bar» (bug Kinepolis 2026-07-17).
  const hit=function(hay, needle){
    if(needle.length>=4 && !KW_PALABRA[needle] && !KW_INICIO[needle]) return hay.indexOf(needle)!==-1;
    const soloInicio=!!KW_INICIO[needle];   // le basta con EMPEZAR palabra: así «pollos» sigue casando
    let i=0;
    while((i=hay.indexOf(needle,i))!==-1){
      const before=i===0 || /[^a-z0-9]/.test(hay.charAt(i-1));
      const after=i+needle.length>=hay.length || /[^a-z0-9]/.test(hay.charAt(i+needle.length));
      if(before && (soloInicio || after)) return true;
      i++;
    }
    return false;
  };
  for(const cat in KW){ if(KW[cat].some(function(k){ return hit(c,k); })) return cat; }
  return "otros";
}
function resolveCategory(sheetCat, merchant){
  // "ambas": usa la del Sheet; si falta o es "otros", autodetecta por comercio
  // Las especiales están fuera de CAT. Reinterpretarlas al bajar la nube convertía inversión
  // y traspaso en gasto ordinario, aunque el servidor los excluyera (B09-D, 2026-09-08).
  if(sheetCat==="ingreso"||sheetCat==="inversion"||sheetCat==="traspaso"||sheetCat==="deudas") return sheetCat;
  if(sheetCat && sheetCat!=="otros" && CAT[sheetCat]) return sheetCat;
  return autoCategory(merchant);
}

/* ---------- Entidades (bancos/brókers) ---------- */
const ENT = {
  sabadell:       { label:"Sabadell",       mono:"Sb", color:"#4A9FE8" },
  revolut:        { label:"Revolut",        mono:"Rv", color:"#5FD08A" },
  trade_republic: { label:"Trade Republic", mono:"TR", color:"#E6C36A" },
  myinvestor:     { label:"MyInvestor",     mono:"MI", color:"#C9A0E0" },
  caixabank:      { label:"CaixaBank",      mono:"Cx", color:"#3FA9E0" },
  bbva:           { label:"BBVA",           mono:"BB", color:"#4B7FD6" },
  santander:      { label:"Santander",      mono:"Sa", color:"#E2705F" },
  ing:            { label:"ING",            mono:"IN", color:"#E2A05F" },
  openbank:       { label:"Openbank",       mono:"Ob", color:"#E2705F" },
  bankinter:      { label:"Bankinter",      mono:"Bk", color:"#E2A05F" },
  n26:            { label:"N26",            mono:"N2", color:"#3FB8A0" },
  kutxabank:      { label:"Kutxabank",      mono:"Ku", color:"#5FB0D0" },
  abanca:         { label:"Abanca",         mono:"Ab", color:"#5F90D0" },
  unicaja:        { label:"Unicaja",        mono:"Un", color:"#5FA0C0" },
  cajamar:        { label:"Cajamar",        mono:"Cj", color:"#6FB08A" },
  imagin:         { label:"imagin",         mono:"im", color:"#3FC0A8" },
  familia:        { label:"Familia",        mono:"Fa", color:"#E2705F" },
  // Sobre de billetes (tanda 6): nunca Open Banking, no es gasto diario.
  efectivo:       { label:"Efectivo",       mono:"€",  color:"#8FA89A" },
};
const entOf = (id)=> ENT[id] || { label:id, mono:"··", color:"#8FA89A" };
function isEfectivoEnt(aOrEnt){
  const e=(aOrEnt&&typeof aOrEnt==="object")?aOrEnt.ent:aOrEnt;
  return e==="efectivo";
}

function fxTableOf(s){
  const t=s&&s.fxRates;
  if(t&&typeof t==="object") return t;
  const usd=(s&&s.fx)>0?s.fx:0.92;
  return { USD:usd };
}
/** Importe en `cur` → EUR. fxRates guarda XXX→EUR (1 USD = r EUR). */
function toEurAmt(amount, cur, s){
  const n=Number(amount)||0;
  const c=String(cur||"EUR").toUpperCase();
  if(!c||c==="EUR") return n;
  const r=fxTableOf(s)[c];
  if(r>0) return n*r;
  if(c==="USD"&&s&&s.fx>0) return n*s.fx;
  return n; // divisa desconocida: no inventar tipo
}
function fromEurAmt(amountEur, cur, s){
  const n=Number(amountEur)||0;
  const c=String(cur||"EUR").toUpperCase();
  if(!c||c==="EUR") return n;
  const r=fxTableOf(s)[c];
  if(r>0) return n/r;
  if(c==="USD"&&s&&s.fx>0) return n/s.fx;
  return n;
}
/** Coste en € anclado (costEur) o conversión spot del cost nativo. */
function invCostEur(i, s){
  if(!i) return 0;
  if(typeof i.costEur==="number"&&isFinite(i.costEur)) return i.costEur;
  return toEurAmt(i.cost||0, i.cur||"EUR", s);
}
function invValueEur(i, s){
  return toEurAmt(i&&i.value, i&&i.cur||"EUR", s);
}

/* ---------- Storage (localStorage con fallback) ---------- */
const _mem = {};
const store = {
  get(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v);}catch(e){ return (k in _mem)?_mem[k]:null; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ _mem[k]=v; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){ delete _mem[k]; } },
};

/* ---------- Guardado PARTIDO del estado (2026-07-24) ----------
   ESTA es la causa gorda del «cuanto más tiempo la uso, más se ralentiza, hasta ir lagueadísima».

   Cada `set()` programaba un guardado que serializaba y escribía el estado ENTERO —el histórico de
   gastos incluido— en localStorage. Y `set()` se llama por todo: abrir una ficha, un toast, un
   sync, el snapshot diario de inversiones… Mientras tanto, el histórico crece cada día con lo que
   entra del banco y del lector de notificaciones. Medido en este entorno (un portátil):

       500 gastos →  64 KB →  0,6 ms        5.000 gastos →  637 KB →  5,1 ms
     2.000 gastos → 254 KB →  2,7 ms       20.000 gastos → 2561 KB → 19,5 ms

   En la WebView de un móvil eso es fácilmente 10-20× más, o sea CENTENARES de milisegundos de hilo
   principal bloqueado, una y otra vez, mientras tocas la pantalla. Y empeora solo con el tiempo:
   exactamente el síntoma descrito.

   Arreglo: los gastos van a SU PROPIA clave y solo se reescriben cuando los gastos han cambiado de
   verdad. Como la inmensa mayoría de los `set()` no los tocan, el guardado frecuente pasa a ser de
   unos pocos KB y deja de crecer con el histórico.

   Compatibilidad: los estados de antes lo llevan todo en la clave principal; al cargar se detecta
   y se parte solo. Si algún día se vuelve a una versión anterior, esa versión no vería los gastos
   en local — pero los recupera del primer sync, porque la tabla `expenses` de la nube es la fuente
   de verdad. */
const EXP_SUFFIX="_exp";
function mcLoadRaw(key){
  const base=store.get(key);
  if(!base) return null;
  const exp=store.get(key+EXP_SUFFIX);
  if(Array.isArray(exp)) base.expenses=exp;      // formato nuevo (partido)
  else if(!Array.isArray(base.expenses)) base.expenses=[];
  return base;
}
/* opts.expenses===false → guarda solo la parte ligera (lo normal).

   OJO con la primera vez tras actualizar: el estado viejo lleva los gastos DENTRO de la clave
   principal y todavía no existe la clave `_exp`. Si en ese primer guardado se hiciera caso a
   `expenses:false`, se reescribiría la clave principal ya SIN gastos y la de gastos no se
   crearía nunca → histórico perdido en el móvil hasta el siguiente sync. Por eso, mientras no
   exista la clave partida, los gastos se escriben SIEMPRE. */
function mcSaveRaw(key, s, opts){
  if(!s) return;
  const rest=Object.assign({},s);
  delete rest.expenses;
  const yaPartido=(function(){ try{ return localStorage.getItem(key+EXP_SUFFIX)!=null; }catch(e){ return false; } })();
  const skipExp = yaPartido && opts && opts.expenses===false;
  if(!skipExp) store.set(key+EXP_SUFFIX, s.expenses||[]);   // primero los gastos: si algo peta a
  store.set(key, rest);                                      // medias, nunca queda un estado sin ellos
}

/* ---------- BANCO DE PRUEBAS (modo sandbox) ----------
   Petición 2026-07-24: «un entorno de pruebas solamente para mí dentro de mi móvil, para probar
   las cosas antes de que se suban a prod para el resto» (su padre y su pareja).

   Cómo funciona: el estado de pruebas vive en OTRA clave de localStorage y, mientras estás
   dentro, la app NO ESCRIBE NADA en la nube. Así puedes borrar cuentas, trastear con deudas o
   importar movimientos a lo bestia sin que nada de eso llegue a Supabase ni a los móviles de tu
   padre y tu pareja. Al salir, tu cartera real está exactamente como la dejaste.

   Se ENTRA copiando los datos reales (probar con una cartera vacía no vale para nada), y la copia
   se queda guardada entre sesiones para poder seguir donde lo dejaste. */
const STATE_KEY_REAL = "micartera_v3";
const STATE_KEY_TEST = "micartera_sandbox";

/* La bandera CRUDA de localStorage. Solo la miran Ajustes (para pintar el interruptor) y las
   funciones de entrar/salir. Para todo lo demás se usa `mcSandbox()`. */
function mcSandboxFlag(){ try{ return localStorage.getItem("_mcSandbox")==="1"; }catch(e){ return false; } }

/* En qué modo se está EJECUTANDO esta sesión. Se fija en la primera consulta y ya no cambia
   aunque cambie la bandera, y eso es justo lo que arregla un bug feo que pilló el e2e
   `modo-pruebas.spec.mjs` (2026-07-24):

     salir del modo pruebas hacía `mcExitSandbox()` y luego `location.reload()`. Entre las dos
     cosas saltaba el volcado pendiente del estado (el `flushPersist` de `pagehide`), que
     preguntaba «¿en qué clave guardo?» — y como la bandera ya estaba quitada, escribía el estado
     DE PRUEBAS encima de la CARTERA REAL. Es decir: el modo pruebas se cargaba los datos de
     verdad justo al salir, que es exactamente lo contrario de lo que promete.

   Con el valor fijado, una sesión que arrancó en pruebas guarda en la clave de pruebas hasta que
   se cierra, pase lo que pase con la bandera. Entrar y salir siempre recargan, así que la sesión
   siguiente ya arranca con el modo nuevo. */
var _mcSandboxPinned=null;
function mcSandbox(){
  if(_mcSandboxPinned===null) _mcSandboxPinned=mcSandboxFlag();
  return _mcSandboxPinned;
}
function mcStateKey(){ return mcSandbox()? STATE_KEY_TEST : STATE_KEY_REAL; }

/* ⚠ MODO INICIAL ≠ BANCO DE PRUEBAS (11/9, SEGUNDO rechazo suyo: «sigue sin funcionar»).
   El banco de pruebas normal SIGUE LEYENDO de la nube a propósito —«probar con datos de verdad es
   justo la gracia»—, y eso es correcto para él. Pero es incompatible con «ver la app como recién
   instalada»: siembras la cartera vacía, la app recarga, `syncFromCloud` trae su estado real y,
   como la cartera recién sembrada no tiene `_savedAt`, la nube GANA el last-write-wins y se la
   vuelve a llenar entera. Por eso se veía «entra sin más al banco de pruebas» y «no resetea nada».

   Yo lo di por arreglado el 10/9 probándolo en un navegador SIN sesión de nube: con el doble de
   Supabase devolviendo vacío, el fallo no existe. Su móvil sí tiene sesión. Es el caso de siempre:
   si él lo ve y mi medida sale limpia, la medida está mal hecha.

   Así que el modo inicial lleva bandera propia y, mientras está puesta, la nube tampoco ENTRA. */
var _mcVacioPinned=null;
function mcSandboxVacioFlag(){ try{ return localStorage.getItem("_mcSandboxVacio")==="1"; }catch(e){ return false; } }
function mcSandboxVacio(){
  if(_mcVacioPinned===null) _mcVacioPinned=mcSandboxVacioFlag();
  return _mcVacioPinned;
}
/* Entra al banco de pruebas sembrándolo con una copia de lo real (si aún no había copia). Recarga
   la app para que TODO (incluido el arranque) lea ya la clave de pruebas. */
/* ⚠ SIEMPRE por `mcLoadRaw`/`mcSaveRaw`, NUNCA por `store` a pelo (2026-09-10, rechazo suyo de
   `4.19.21/modo-inicial`). El estado está PARTIDO: lo ligero en la clave y los gastos en
   `<clave>_exp`. Escribir la clave a pelo deja la mitad de los gastos viva, y como al arrancar se
   lee por `mcLoadRaw`, esa mitad vuelve. Aquí además había un segundo fallo del mismo origen:
   `store.get(STATE_KEY_REAL)` devuelve la mitad LIGERA, así que entrar al banco de pruebas te
   copiaba la cartera sin un solo gasto. */
function mcEnterSandbox(seedFrom){
  try{
    if(!store.get(STATE_KEY_TEST)) mcSaveRaw(STATE_KEY_TEST, seedFrom||mcLoadRaw(STATE_KEY_REAL)||{});
    localStorage.setItem("_mcSandbox","1");
  }catch(e){}
}
/* Entrar y salir NO cambian el modo de la sesión en curso a propósito (ver mcSandbox): quien las
   llama recarga inmediatamente después, y así lo que quede por volcar se guarda en la clave
   correcta, la de la sesión que se está cerrando. */
function mcExitSandbox(){ try{ localStorage.removeItem("_mcSandbox"); localStorage.removeItem("_mcSandboxVacio"); }catch(e){} }
/* MODO INICIAL (peticion suya, 9/9/2026): el banco de pruebas COPIA la cartera real, asi que no
   habia forma de ver la app como la ve alguien que acaba de instalarla — y justo eso es lo que hay
   que probar del pulido v4 (hero sin grafico, tarjetas vacias, racha a cero). Sus palabras: «si no,
   te marcare el 50% de las pruebas que no puedo reproducirlo».
   Siembra la cartera de PRUEBAS vacia. Nunca toca la real: escribe en STATE_KEY_TEST y punto.
   ⚠ `onboarded:false` (10/9 noche, rechazo suyo): la fila dice «como recién instalada» y él
   esperaba el onboarding. Antes iba a `true` a propósito para mirar la tarjeta vacía de
   presupuesto sin pasar por el stepper — pero eso mentía en el copy y «tampoco furula» el reset
   a cero. Quien quiera saltarse el onboarding en pruebas toca «Saltar» (deja budget 0 si no
   cambia el stepper… en realidad finish pone el budget del stepper; al saltar con default 700).
   Para pantallas vacías tras onboarding: salta y no añadas cuentas. */
/* ⚠ RECHAZADA LA PRIMERA VERSIÓN (10/9): «no funciona, entra sin más al banco de pruebas» y
   «tampoco pasa nada, solamente sigue en el banco de pruebas como estaba, no resetea nada».
   Tenía toda la razón y la causa era esta línea: `store.set(STATE_KEY_TEST, {...expenses:[]})`
   escribía los gastos vacíos DENTRO de la clave principal, pero la app no los lee de ahí — los
   lee de `micartera_sandbox_exp` (estado partido, ver `mcLoadRaw`). Como él ya había entrado
   antes al banco de pruebas, esa clave existía con sus gastos dentro y volvían todos al recargar.
   Vaciaba cuentas y presupuesto, y dejaba los gastos: la cartera de pruebas parecía la de siempre.

   El test que lo tapaba leía `localStorage.getItem("micartera_sandbox")` a pelo, o sea la mitad
   que sí se vaciaba, y salía verde mientras en su móvil no funcionaba nada. Ahora se comprueba
   por donde lo lee la app. Es el mismo patrón de siempre: la regla escrita en dos sitios y un
   test que solo mira uno. */
function mcSeedSandboxVacio(){
  try{ localStorage.setItem("_mcSandboxVacio","1"); }catch(e){}
  mcSaveRaw(STATE_KEY_TEST, {
    _dataVer:6, onboarded:false, tourSeen:false, setupHint:false,
    budget:0, monthStartNet:0, history:[], streak:0,
    accounts:[], investments:[], assets:[], debts:[], fixed:[], flows:[], oneoffs:[], goals:[],
    expenses:[], settings:{}
  });
}
/* ⚠ NO VUELQUES EL ESTADO VIEJO ENCIMA DE LO QUE ACABO DE SEMBRAR (hallazgo de Cursor al revisar,
   10/9). El guardado va con 400 ms de retraso, y `pagehide` lo fuerza justo antes de recargar.
   Secuencia mala, y es EXACTAMENTE la queja que estamos arreglando: estás dentro del banco de
   pruebas, tocas «Vaciar la cartera de pruebas» → se siembra vacía → `location.reload()` →
   `pagehide` vuelca el estado de React de hace un momento, que todavía lleva TODO, y como la
   sesión está fijada en pruebas lo escribe en la clave de pruebas. Vuelve a estar llena.
   Con esto el volcado pendiente se descarta: lo que acabamos de escribir a mano es la verdad.
   Solo se levanta justo antes de una recarga, así que no apaga el guardado de nada vivo. */
var _mcSkipPersist=false;
function mcSkipPersist(){ return _mcSkipPersist; }
/* Separadas a propósito: `mcMarcarNoVolcar` es lo que se puede comprobar en un test —recargar de
   verdad se lleva por delante la propia página y no deja mirar nada—, y `mcRecargarSinVolcar` es
   lo que llama la UI. No es un atajo para las pruebas: son dos cosas distintas de verdad. */
function mcMarcarNoVolcar(){ _mcSkipPersist=true; }
function mcRecargarSinVolcar(){
  mcMarcarNoVolcar();
  location.reload();
}
/* Tira la cartera de pruebas y empieza otra desde cero copiando la real otra vez.
   Las DOS mitades: borrar solo la ligera dejaba `micartera_sandbox_exp` huérfana, y la siguiente
   entrada al banco de pruebas se encontraba los gastos de la sesión anterior mezclados con la
   copia nueva de la cartera real. */
function mcResetSandbox(){ store.del(STATE_KEY_TEST); store.del(STATE_KEY_TEST+EXP_SUFFIX); try{ localStorage.removeItem("_mcSandboxVacio"); }catch(e){} }

/* ---------- Supabase: sincronización en la nube (Fase 1) ----------
   Offline-first: si no hay librería/red o no hay sesión, la app funciona igual con localStorage.
   Al iniciar sesión (magic link) se sincroniza el estado entre dispositivos.
   - app_state (JSONB): todo el estado de la app (cuentas, inversiones, gastos…).
   - tabla expenses: buzón donde MacroDroid (y la app) escriben gastos; la app los lee al sincronizar. */
/* ---------- Red de seguridad: la columna `nota` puede no existir todavía ----------
   `deploy.yml` (la web) y `supabase.yml` (la base de datos) corren EN PARALELO en el mismo push,
   y el paso de migraciones lleva `continue-on-error: true` — a este repo ya le pasó que una
   migración se quedó sin aplicar y el job salió verde igual (la 0015 del Hogar).

   Sin esto, el cliente nuevo mandaría `nota`/`nota_edit` a una tabla que aún no las tiene,
   PostgREST devolvería «column does not exist» y el upsert fallaría ENTERO: los gastos dejarían
   de subir a la nube. Y como los llamantes hacen `.catch(function(){})`, fallaría en silencio —
   que es la peor forma de fallar en una app de dinero.

   Así que si la columna no está, se reintenta sin ella: se pierde el concepto (una comodidad),
   nunca el gasto (el dato). La bandera vive solo en memoria: al reabrir la app se vuelve a
   intentar, de modo que en cuanto la migración se aplique esto se cura solo. */
var _mcNotaCols=true;
function _isMissingNotaCol(err){
  const m=String((err&&err.message)||err||"").toLowerCase();
  return m.indexOf("nota")>=0 && (m.indexOf("column")>=0 || m.indexOf("does not exist")>=0 || m.indexOf("schema cache")>=0);
}
/* Lo mismo para la divisa original (`importe_orig`/`divisa`, migración 0020, 2026-08-06). Mismo
   razonamiento y misma prioridad: en un viaje, perder «eran 1.520 ₺» es una lástima; perder el
   gasto entero porque la migración va un rato por detrás del bundle es inaceptable. */
var _mcDivisaCols=true;
function _isMissingDivisaCol(err){
  const m=String((err&&err.message)||err||"").toLowerCase();
  return (m.indexOf("importe_orig")>=0 || m.indexOf("divisa")>=0) &&
         (m.indexOf("column")>=0 || m.indexOf("does not exist")>=0 || m.indexOf("schema cache")>=0);
}
/* Y lo mismo para `ob_name` (migración 0021, 2026-08-17): cómo llamaba el banco al movimiento
   antes de que él lo renombrara. Sin ella el renombrado sigue funcionando a la vista; lo que se
   pierde es la protección contra que el siguiente sync recree el gasto. Molesto, no grave: nunca
   vale la pena tirar el apunte por esto. */
var _mcObNameCol=true;
function _isMissingObNameCol(err){
  const m=String((err&&err.message)||err||"").toLowerCase();
  return m.indexOf("ob_name")>=0 &&
         (m.indexOf("column")>=0 || m.indexOf("does not exist")>=0 || m.indexOf("schema cache")>=0);
}
async function withNotaFallback(run){
  let r=await run(_mcNotaCols, _mcDivisaCols, _mcObNameCol);
  if(r && r.error && _mcNotaCols && _isMissingNotaCol(r.error)){
    _mcNotaCols=false;                       // esta sesión ya no lo intenta más
    r=await run(false, _mcDivisaCols, _mcObNameCol);
  }
  if(r && r.error && _mcDivisaCols && _isMissingDivisaCol(r.error)){
    _mcDivisaCols=false;
    r=await run(_mcNotaCols, false, _mcObNameCol);
  }
  if(r && r.error && _mcObNameCol && _isMissingObNameCol(r.error)){
    _mcObNameCol=false;
    r=await run(_mcNotaCols, _mcDivisaCols, false);
  }
  if(r && r.error) throw r.error;
  return r;
}

/* FIN-07 — EL HISTÓRICO ENTERO. Aquí había un `.limit(2000)` sin paginar, y `syncCloudExpenses`
   REEMPLAZA los gastos de origen "supabase" por lo que acaba de llegar: con más de 2.000 en la nube
   —lo normal tras importar el histórico de un banco— cada sincronización BORRABA los más viejos.
   Se pagina por CLAVE (keyset), no por desplazamiento: un gasto que entre a mitad de la descarga
   corre la lista y te hace saltarte una fila o repetirla. El `id` en el orden no es decorativo —
   sin un segundo criterio ÚNICO, dos gastos del MISMO día pueden salir en distinto orden entre
   páginas y entonces uno se repite y otro se pierde.
   (Paginación por keyset: de Cursor. Tope de seguridad y guarda de la mezcla: de esta tanda.) */
async function mcPullExpensesPaged(fetchPage, pageSize, maxPages){
  const all=[];
  let cursor=null;
  for(let p=0;p<maxPages;p++){
    const chunk=await fetchPage(cursor);
    if(!chunk || !chunk.length) return { rows:all, capped:false };
    for(let i=0;i<chunk.length;i++) all.push(chunk[i]);
    if(chunk.length<pageSize) return { rows:all, capped:false };
    const last=chunk[chunk.length-1];
    cursor={ fecha:last.fecha, id:last.id };
  }
  return { rows:all, capped:true };
}


const cloud = (function(){
  let sb = null;
  try {
    if (window.supabase && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    }
  } catch(e){ sb = null; }
  return {
    enabled(){ return !!sb; },
    async session(){ if(!sb) return null; const {data}=await sb.auth.getSession(); return data.session; },
    onAuth(cb){ if(sb) sb.auth.onAuthStateChange(function(ev,session){ cb(session, ev); }); },
    async signIn(email){
      if(!sb) throw new Error("nube no disponible");
      const {error}=await sb.auth.signInWithOtp({ email:email, options:{ emailRedirectTo: location.href.split('#')[0] } });
      if(error) throw error;
    },
    async signOut(){ if(sb) await sb.auth.signOut(); },
    async signInPassword(email,password){ if(!sb) throw new Error("nube no disponible"); const {error}=await sb.auth.signInWithPassword({email:email,password:password}); if(error) throw error; },
    async signUpPassword(email,password){ if(!sb) throw new Error("nube no disponible"); const {data,error}=await sb.auth.signUp({email:email,password:password}); if(error) throw error; return data; },
    async resetPassword(email){ if(!sb) throw new Error("nube no disponible"); const {error}=await sb.auth.resetPasswordForEmail((email||"").trim(), { redirectTo: location.href.split('#')[0] }); if(error) throw error; },
    async updatePassword(newPass){ if(!sb) throw new Error("nube no disponible"); const {error}=await sb.auth.updateUser({ password:newPass }); if(error) throw error; },
    async pullState(){
      if(!sb) return null;
      const {data,error}=await sb.from('app_state').select('data,updated_at').maybeSingle();
      if(error) throw error;
      return data ? { data:data.data, updated_at:data.updated_at } : null;
    },
    async pushState(uid, data, lastKnownUpdatedAt){
      if(!sb || !uid) return null;
      const now=new Date().toISOString();
      if(lastKnownUpdatedAt){
        const {data:rows,error}=await sb.from('app_state')
          .update({ user_id:uid, data:data, updated_at:now })
          .eq('user_id', uid).eq('updated_at', lastKnownUpdatedAt)
          .select('updated_at');
        if(error) throw error;
        if(!rows || !rows.length) return { conflict:true };
        return { updated_at:rows[0].updated_at };
      }
      const {data:rows,error}=await sb.from('app_state')
        .upsert({ user_id:uid, data:data, updated_at:now }, { onConflict:'user_id' })
        .select('updated_at');
      if(error) throw error;
      return { updated_at: rows && rows[0] && rows[0].updated_at };
    },
    async pullExpenses(){
      if(!sb) return [];
      const PAGE=1000;
      const MAX_PAGES=50;   // 50.000 filas: red de seguridad contra un bucle, no un techo de producto.
      const fetchPage=async function(cursor){
        let q=sb.from('expenses').select('*')
          .order('fecha',{ascending:false})
          .order('id',{ascending:false})
          .limit(PAGE);
        if(cursor){
          const f=String(cursor.fecha), id=String(cursor.id);
          q=q.or('fecha.lt.'+f+',and(fecha.eq.'+f+',id.lt.'+id+')');
        }
        const {data,error}=await q;
        if(error) throw error;
        return data||[];
      };
      const pulled=await mcPullExpensesPaged(fetchPage, PAGE, MAX_PAGES);
      const rows=pulled.rows;
      if(pulled.capped) rows._mcPullCapped=true;
      return rows;
    },
    async addExpense(e){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      // source lleva el banco embebido (ob:caixa…) para filtrar en Gastos tras reinstalación
      // sin columna nueva en Supabase (feedback 2026-07-16).
      const base={ user_id:session.user.id, fecha:e.date, importe:e.amount, comercio:e.merchant, cat:e.category, source:expenseSourceForCloud(e), no_card:!!e.noCard };
      // Id local = id de fila cuando es uuid (2026-09-07). Sin esto la tabla genera otro uuid
      // y las escrituras por id no casarían hasta el siguiente pull.
      if(isExpenseUuid(e&&e.id)) base.id=e.id;
      const nota={ nota:(e.note?String(e.note).slice(0,160):null), nota_edit:!!e.noteEdited };
      // Lo que tecleó de verdad, cuando no fue en euros (migración 0020). El `importe` sigue siendo
      // el euro convertido —la app cuenta en euros— pero sin esto, en cuanto el gasto daba la
      // vuelta por la nube ya no constaba que fueran liras: un viaje entero en € pelados.
      const divisa={ importe_orig:(e.origCur?Math.abs(Number(e.origAmount)||0):null), divisa:(e.origCur||null) };
      // Cómo lo llamaba el banco (migración 0021). Sin esto, renombrar el «Movimiento» de Trade
      // Republic hacía que el siguiente sync no reconociera la fila y metiera el gasto otra vez.
      const obn={ ob_name:(e.obName!=null?String(e.obName).slice(0,160):null) };
      await withNotaFallback(
        function(conNota, conDivisa, conObName){
          let fila=base;
          if(conNota) fila=Object.assign({},fila,nota);
          if(conDivisa) fila=Object.assign({},fila,divisa);
          if(conObName) fila=Object.assign({},fila,obn);
          // ignoreDuplicates + onConflict user_id,fecha,importe,comercio: si ya hay fila, NO
          // inserta (el id mandado se ignora). Local puede quedar con uuid distinto al de la
          // nube hasta el pull — igual que antes de mandar id. El pull adopta r.id.
          return sb.from('expenses').upsert(
            fila,
            { onConflict:'user_id,fecha,importe,comercio', ignoreDuplicates:true }
          );
        }
      );
    },
    /* IMPORT HISTÓRICO — batch con RETURNING id (tanda 3, agujero A).
       ignoreDuplicates + onConflict terna: Postgres NO devuelve las filas que chocaron.
       Solo los ids ACK son borrables después. NO toca addExpense (camino paralelo). */
    async addExpensesBatch(expenses){
      if(!sb) return { cloudIds:[], offline:true };
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return { cloudIds:[], offline:true };
      const list=(expenses||[]).filter(Boolean);
      if(!list.length) return { cloudIds:[], offline:false };
      const uid=session.user.id;
      const r=await withNotaFallback(function(conNota, conDivisa, conObName){
        const filas=list.map(function(e){
          const base={ user_id:uid, fecha:e.date, importe:e.amount, comercio:e.merchant, cat:e.category, source:expenseSourceForCloud(e), no_card:!!e.noCard };
          if(isExpenseUuid(e&&e.id)) base.id=e.id;
          let fila=base;
          if(conNota) fila=Object.assign({},fila,{ nota:(e.note?String(e.note).slice(0,160):null), nota_edit:!!e.noteEdited });
          if(conDivisa) fila=Object.assign({},fila,{ importe_orig:(e.origCur?Math.abs(Number(e.origAmount)||0):null), divisa:(e.origCur||null) });
          if(conObName) fila=Object.assign({},fila,{ ob_name:(e.obName!=null?String(e.obName).slice(0,160):null) });
          return fila;
        });
        return sb.from('expenses').upsert(
          filas,
          { onConflict:'user_id,fecha,importe,comercio', ignoreDuplicates:true }
        ).select('id');
      });
      const rows=(r&&r.data)||[];
      return { cloudIds:rows.map(function(row){ return row.id; }).filter(Boolean), offline:false };
    },
    /* Borrado SOLO por id (uuid). Camino del undo del histórico: nunca por terna.
       No sustituye a deleteExpense (gastos viejos sin uuid siguen el fallback de atributos). */
    async deleteExpensesByIds(ids){
      if(!sb) throw new Error("cloud unavailable");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("session unavailable");
      const uuids=(ids||[]).filter(isExpenseUuid);
      if(!uuids.length) return;
      const {error}=await sb.from('expenses').delete().eq('user_id', session.user.id).in('id', uuids);
      if(error) throw error;
    },
    // Persiste el BANCO elegido de un gasto (va embebido en source: manual:caixabank…) para
    // que sobreviva a reinstalaciones — mismo truco que ob: (2026-07-18).
    async setExpenseBank(e, ent){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const src=expenseSourceForCloud(Object.assign({},e,{ent:ent||undefined}));
      const {error}=await expenseCloudEq(sb.from('expenses').update({ source:src }), session.user.id, e);
      if(error) throw error;
    },
    // Persiste la DECISIÓN sobre un posible repetido (B09-D, 2026-09-08). Sin esto, «son
    // distintos» solo quitaba la marca en el móvil: la fila seguía siendo `ob:ent#dup` en la nube,
    // el servidor la seguía descontando del presupuesto y el siguiente pull volvía a apagarla.
    // Tocar solo el estado local no arregla nada; la fila vuelve de la nube.
    async setExpenseDup(e, isDup){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const src=expenseSourceForCloud(Object.assign({},e,{possibleDup:!!isDup}));
      const {error}=await expenseCloudEq(sb.from('expenses').update({ source:src }), session.user.id, e);
      if(error) throw error;
    },
    // Persiste el flag 💳/🔄 en la tabla (si no, el siguiente pull lo pisaría en gastos de la nube).
    async setExpenseNoCard(e, noCard){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {error}=await expenseCloudEq(sb.from('expenses').update({ no_card:!!noCard }), session.user.id, e);
      if(error) throw error;
    },
    // Concepto escrito a mano (o corregido) por el usuario. `nota_edit` lo blinda: el siguiente
    // sync del banco no lo pisa con la descripción cruda del extracto (2026-07-24).
    async setExpenseNote(e, note){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      // Si la migración 0017 aún no está aplicada, esto no puede hacer nada útil: se avisa al
      // llamante en vez de fallar mudo (aquí el concepto ES el dato que el usuario quiere guardar).
      const {error}=await expenseCloudEq(sb.from('expenses').update({ nota:String(note||"").slice(0,160)||null, nota_edit:true }), session.user.id, e);
      if(error){ if(_isMissingNotaCol(error)) _mcNotaCols=false; throw error; }
    },
    // CATEGORÍA en la tabla. Sin esto, `syncCloudExpenses` —que reemplaza los gastos de origen
    // "supabase" con lo que hay en la tabla— pisaba en el siguiente pull cualquier recategorización
    // hecha en el móvil, incluida la que aparta un cashback a «Inversión» (2026-08-04).
    async setExpenseCat(e, cat){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const upd={ cat:String(cat||"otros") };
      // Sacar una cuota de «Deudas» a mano le quita también la marca en la nube; si no, el
      // siguiente pull le devolvería el `debtId` (4.21.0).
      if(e&&e.debtId&&cat!=="deudas") upd.source=expenseSourceForCloud(Object.assign({},e,{debtId:undefined}));
      const {error}=await expenseCloudEq(sb.from('expenses').update(upd), session.user.id, e);
      if(error) throw error;
    },
    // Cuota de deuda marcada por `marcarCuotasDeDeuda` (4.21.0): categoría y, si es de Open
    // Banking, la marca en `source`. La de la noti (`macrodroid`) conserva su source: un
    // `macrodroid~…` lo leería el servidor como «a mano» y lo SUMARÍA; ahí basta `cat:deudas`.
    async setExpenseDeuda(e){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {error}=await expenseCloudEq(sb.from('expenses').update({ cat:"deudas", source:expenseSourceForCloud(e) }), session.user.id, e);
      if(error) throw error;
    },
    async deleteExpense(e){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {error}=await expenseCloudEq(sb.from('expenses').delete(), session.user.id, e);
      if(error) throw error;
    },
    async prices(symbols){
      if(!sb) throw new Error("nube no disponible");
      // manda los tickers reales de la cartera: la función ya no está clavada a 6 símbolos
      const opts=(symbols&&symbols.length)?{body:{symbols:symbols}}:undefined;
      const {data,error}=await sb.functions.invoke('prices',opts);
      if(error) throw error;
      return data;
    },
    // IA / KW: sugiere categoría de gasto (Edge Function `categorize`). Sin OPENAI_API_KEY
    // en Supabase cae a keywords; si hay key, solo se usa cuando KW dice «otros».
    async suggestCategory(merchant){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke("categorize",{ body:{ merchant:String(merchant||"").slice(0,120) } });
      if(error) throw error;
      return data;
    },
    // Copia de seguridad diaria del estado COMPLETO (idempotente por día) + poda a 30 días.
    // Best-effort: si la tabla aún no existe (migración 0002 sin aplicar), simplemente falla y se ignora.
    async backupState(uid, data){
      if(!sb || !uid) return;
      const today=new Date().toISOString().slice(0,10);
      const {error}=await sb.from('state_backups').upsert(
        { user_id:uid, day:today, data:data },
        { onConflict:'user_id,day' }
      );
      if(error) throw error;
      const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
      try{ await sb.from('state_backups').delete().eq('user_id',uid).lt('day',cutoff); }catch(e){}
    },
    // Días con copia automática disponible (más reciente primero). Solo lectura: la copia ya
    // se escribe sola cada día (backupState); esto es lo que faltaba para poder MIRARLAS y
    // restaurar una, en vez de que vivan escritas pero invisibles (2026-07-31).
    async listBackupDays(uid){
      if(!sb || !uid) return [];
      const {data,error}=await sb.from('state_backups').select('day').eq('user_id',uid).order('day',{ascending:false}).limit(30);
      if(error) throw error;
      return (data||[]).map(function(r){ return r.day; });
    },
    async getBackup(uid, day){
      if(!sb || !uid || !day) return null;
      const {data,error}=await sb.from('state_backups').select('data').eq('user_id',uid).eq('day',day).maybeSingle();
      if(error) throw error;
      return data ? data.data : null;
    },
    // ---- Open Banking (Enable Banking) · Capa 2 ----
    // Genera el enlace de login del banco (la Edge Function guarda el 'pending').
    async bankConnect(aspsp_name, country){
      if(!sb) throw new Error("nube no disponible");
      // platform:"app" → bank-callback devuelve la página puente micartera:// (vuelve a la APP,
      // no al navegador — bloqueante 3 del feedback pareja). En web, redirect normal con ?bank=.
      const native=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
      const {data,error}=await sb.functions.invoke('bank-connect',{ body:{ aspsp_name:aspsp_name||"Banco de Sabadell", country:(country||"ES"), platform:(native?"app":"web") } });
      if(error) throw error;
      if(!data || !data.ok) throw new Error((data&&data.error)||"no se pudo conectar");
      return data;   // { ok, url }
    },
    // Lista de bancos soportados por Enable Banking para el selector (con logo).
    async bankAspsps(country){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('bank-aspsps',{ body:{ country:(country||"ES") } });
      if(error) throw error;
      if(!data || !data.ok) throw new Error((data&&data.error)||"no se pudieron listar los bancos");
      return data.aspsps||[];
    },
    // Trae saldo (+ movimientos, que en Capa 2 ignoramos) de los bancos enlazados.
    async bankSync(){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('bank-sync');
      if(error) throw error;
      if(!data || !data.ok) throw new Error((data&&data.error)||"sync falló");
      return data;   // { ok, dryRun, links:[{aspsp, iban, balances, transactions}] }
    },
    // IMPORTAR HISTÓRICO: trae movimientos desde dateFrom (YYYY-MM-DD, tope PSD2 ~90 días).
    // Modo lectura pura del servidor (no toca saldos). Devuelve { links:[{aspsp, accounts:[{transactions}]}] }.
    async bankSyncHistory(dateFrom, aspsps){
      if(!sb) throw new Error("nube no disponible");
      const body={ dateFrom:dateFrom };
      if(Array.isArray(aspsps)) body.aspsps=aspsps;
      const {data,error}=await sb.functions.invoke('bank-sync',{ body:body });
      if(error) throw error;
      if(!data || !data.ok) throw new Error((data&&data.error)||"histórico falló");
      return data;
    },
    // Quita un banco enlazado (revoca en Enable Banking + borra la fila). Reversible: reconectar.
    async bankDisconnect(aspsp_name){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('bank-disconnect',{ body:{ aspsp_name } });
      if(error) throw error;
      if(!data || !data.ok) throw new Error((data&&data.error)||"no se pudo quitar el banco");
      return data;   // { ok }
    },
    // Estado de los enlaces para pintar "conectado ✓" / caducidad (RLS: solo lo del usuario).
    async bankLinks(){
      if(!sb) return [];
      const {data,error}=await sb.from('bank_links').select('aspsp_name,aspsp_country,iban,status,valid_until,last_sync,accounts');
      if(error) throw error;
      return data||[];
    },
    // --- MyInvestor (API no oficial, fondos indexados) — mismo patrón que Trade Republic pero
    // por Edge Function (funciona en web y app; MyInvestor no lleva WAF en frío como TR). La
    // contraseña viaja SOLO en connect y NUNCA se guarda: se persisten solo los tokens.
    async myinvestorConnect(payload){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('myinvestor-connect',{ body:payload });
      if(error) throw error;
      return data;
    },
    // Login hecho EN EL MÓVIL (IP residencial → sin reCAPTCHA, patrón TR): aquí solo se suben
    // los tokens resultantes; la Edge los VALIDA contra la API antes de guardarlos.
    async myinvestorStore(payload){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('myinvestor-connect',{ body:Object.assign({storeTokens:true},payload||{}) });
      if(error) throw error;
      return data;
    },
    async myinvestorSync(){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('myinvestor-sync');
      if(error) throw error;
      return data;
    },
    async myinvestorDisconnect(){
      if(!sb) return;
      try{ await sb.functions.invoke('myinvestor-disconnect'); }catch(e){}
    },
    async myinvestorStatus(){
      if(!sb) return null;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return null;
      // Solo columnas NO sensibles (grant a nivel de columna; los tokens no se exponen).
      // device_id: para reutilizar el mismo móvil al reconectar (menos captchas).
      const {data,error}=await sb.from('myinvestor_links').select('status,last_sync,updated_at,device_id').eq('user_id',session.user.id).maybeSingle();
      if(error) return null;
      return data||null;
    },
    // --- ingest MULTIUSUARIO (0008_ingest_tokens): cada persona apunta SUS gastos de TR en SU
    // cuenta. Guarda/actualiza el token del usuario (upsert por user_id, RLS: solo el suyo).
    async setIngestToken(token){
      if(!sb) throw new Error("nube no disponible");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("sin sesión");
      const {error}=await sb.from('ingest_tokens').upsert(
        { token:token, user_id:session.user.id },
        { onConflict:'user_id' }
      );
      if(error) throw error;
    },
    async clearIngestToken(){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      try{ await sb.from('ingest_tokens').delete().eq('user_id',session.user.id); }catch(e){}
    },
    // --- Telemetría solo-admin (0006_app_events): errores y pings de quien usa la app.
    // best-effort SIEMPRE (nunca rompe nada); máx 20 por sesión y dedupe del mismo mensaje.
    async logEvent(kind, message, detail){
      try{
        if(!sb) return;
        this._evSent=this._evSent||{}; this._evN=this._evN||0;
        const key=kind+"|"+String(message).slice(0,120);
        if(this._evSent[key] || this._evN>=20) return;
        this._evSent[key]=1; this._evN++;
        const {data:{session}}=await sb.auth.getSession();
        if(!session) return;
        await sb.from('app_events').insert({
          user_id:session.user.id,
          email:session.user.email||null,
          kind:kind||'error',
          message:String(message||"").slice(0,500),
          detail:detail?String(detail).slice(0,2000):null,
          app_version:CONFIG.APP_VERSION,
          platform:(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())?'android':'web'
        });
      }catch(e){}
    },
    /* MÉTRICAS DE USO — qué pantallas se usan, NUNCA quién ni con cuánto dinero.
       Pendiente desde la review del 2026-07-25 y hecho ahora por el motivo que ya estaba escrito
       en el ROADMAP: «el histórico de uso no se recupera hacia atrás». Con tres usuarios parece
       que no urge, y es justo al revés — el día que haya treinta, los seis meses anteriores no
       se pueden reconstruir.

       LO QUE SE MANDA es una etiqueta de un vocabulario CERRADO (`USO_OK`) y nada más. Ni el
       importe, ni el comercio, ni el banco, ni el texto que haya escrito. Si mañana alguien
       quiere medir algo nuevo, tiene que añadir su etiqueta aquí — que es exactamente la puerta
       que se quiere: se ve en el diff y se puede discutir. Un `logEvent('use', loQueSea)` libre
       acabaría llevándose el nombre de un comercio a la primera de cambio.

       Comparte el tope de 20/sesión y el dedupe de `logEvent`, así que una pantalla cuenta UNA
       vez por sesión: se mide cuántas sesiones tocan cada cosa, no cuántas veces se toca. Para lo
       que sirve esto —saber qué sobra y qué falta— es la medida buena, y además es la barata. */
    logUso(que){
      if(USO_OK.indexOf(que)<0) return;   // vocabulario cerrado: lo que no está, no viaja
      return this.logEvent('use', que);
    },
    /* Cuánto tardan las cosas que Supabase NO puede ver porque pasan en el móvil: una
       sincronización, un import. Las duraciones de las Edge Functions y el SQL caro ya los da su
       panel (Logs + Query Performance) y rehacerlos sería trabajo tirado — esto es solo el hueco
       que queda. Se redondea a medio segundo: la diferencia entre 3,1 s y 3,4 s no cambia
       ninguna decisión, y menos precisión es menos huella. */
    logPerf(que, ms){
      if(USO_OK.indexOf(que)<0) return;
      const s=Math.round(Number(ms||0)/500)/2;
      if(!isFinite(s)||s<0) return;
      return this.logEvent('perf', que+" "+s.toFixed(1)+"s");
    },
    // Sugerencias/errores del popup de Novedades → app_events con kind 'feedback'.
    // A diferencia de logEvent, NO comparte el tope de 20/sesión ni el dedupe (un feedback
    // no puede perderse en silencio) y FALLA visible (el caller avisa si no se pudo enviar).
    async feedback(text){
      if(!sb) throw new Error("sin nube");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("sin sesión");
      const s=String(text||"");
      const {error}=await sb.from('app_events').insert({
        user_id:session.user.id,
        email:session.user.email||null,
        kind:'feedback',
        message:s.slice(0,500),
        detail:s.length>500?s.slice(0,2000):null,
        app_version:CONFIG.APP_VERSION,
        platform:(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())?'android':'web'
      });
      if(error) throw error;
    },
    // Veredicto de una beta probada EN EL MÓVIL (2026-07-24): «esto lo he probado y va / esto
    // falla». Va a app_events (kind 'beta'), que ya existe con RLS solo-admin — cero infraestructura
    // nueva para algo que solo usa el dueño. Como `feedback`, sin dedupe y fallando visible: un
    // «no subas esto, que está roto» no se puede perder en silencio.
    async betaReport(payload){
      if(!sb) throw new Error("sin nube");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("sin sesión");
      const p=payload||{};
      const {error}=await sb.from('app_events').insert({
        user_id:session.user.id,
        email:session.user.email||null,
        kind:'beta',
        message:String(p.summary||"").slice(0,500),
        detail:JSON.stringify(p).slice(0,2000),
        app_version:CONFIG.APP_VERSION,
        platform:(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())?'android':'web'
      });
      if(error) throw error;
    },
    // Panel del admin: últimos eventos de TODOS los usuarios (RLS deja leer solo al admin).
    async adminEvents(limit){
      if(!sb) return [];
      const {data,error}=await sb.from('app_events')
        .select('email,kind,message,detail,app_version,platform,created_at')
        .order('created_at',{ascending:false}).limit(limit||60);
      if(error) throw error;
      return data||[];
    },
    async fetchProfile(){
      if(!sb) return null;
      const {data,error}=await sb.from('profiles').select('is_admin').maybeSingle();
      if(error) throw error;
      return data;
    },
    async deleteAccount(password){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('delete-account',{ body:{ password:password } });
      if(error) throw error;
      if(!data || !data.ok) throw new Error((data&&data.error)||"no se pudo borrar la cuenta");
      await sb.auth.signOut();
      return data;
    },
    // ---- Hogar compartido (snapshots Fase 1) ----
    async createHousehold(name, inviteCode){
      if(!sb) throw new Error("nube no disponible");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("sin sesión");
      // 12 y no 8 (13/9): los códigos nuevos son de 10; con 8 se truncaban al crear y nadie podía unirse.
      const code=String(inviteCode||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12);
      if(code.length<4) throw new Error("código inválido");
      // id generado AQUÍ y sin .select(): el RETURNING del insert pasa por la policy de SELECT
      // y el creador aún no es miembro → 0 filas y el alta petaba (error real 2026-07-18:
      // «new row violates row-level security policy for table households» = además faltaba
      // la policy de INSERT en la BD → migración 0015).
      const hid=(window.crypto&&crypto.randomUUID)?crypto.randomUUID()
        :"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){ const r=Math.random()*16|0; return (c==="x"?r:(r&0x3|0x8)).toString(16); });
      const hh={ id:hid, name:String(name||"Mi hogar").slice(0,80), invite_code:code, created_by:session.user.id };
      const {error}=await sb.from("households").insert(hh);
      if(error) throw error;
      const {error:e2}=await sb.from("household_members").insert({
        household_id:hid, user_id:session.user.id, role:"owner",
      });
      if(e2) throw e2;
      return hh;
    },
    async joinHousehold(code){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.rpc("join_household_by_code",{ p_code:String(code||"").trim() });
      if(error) throw error;
      return data;
    },
    async fetchHouseholdBundle(){
      if(!sb) return { household:null, snapshots:[] };
      const {data:mem,error:e1}=await sb.from("household_members").select("household_id,role").limit(1);
      if(e1) throw e1;
      if(!mem||!mem.length) return { household:null, snapshots:[] };
      const hid=mem[0].household_id;
      const {data:hh,error:e2}=await sb.from("households").select("*").eq("id",hid).maybeSingle();
      if(e2) throw e2;
      if(!hh) return { household:null, snapshots:[] };
      const {data:snaps,error:e3}=await sb.from("household_snapshots")
        .select("user_id,payload,published_at").eq("household_id",hid);
      if(e3) throw e3;
      return { household:hh, snapshots:snaps||[], myRole:mem[0].role };
    },
    async publishHouseholdSnapshot(householdId, payload){
      if(!sb) throw new Error("nube no disponible");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("sin sesión");
      const {error}=await sb.from("household_snapshots").upsert({
        household_id:householdId,
        user_id:session.user.id,
        payload:payload,
        published_at:new Date().toISOString(),
      }, { onConflict:"household_id,user_id" });
      if(error) throw error;
    },
    async leaveHousehold(householdId){
      if(!sb) throw new Error("nube no disponible");
      const {data:{session}}=await sb.auth.getSession();
      if(!session) throw new Error("sin sesión");
      await sb.from("household_snapshots").delete().eq("household_id",householdId).eq("user_id",session.user.id);
      const {error}=await sb.from("household_members").delete().eq("household_id",householdId).eq("user_id",session.user.id);
      if(error) throw error;
    },
  };
})();

/* Escritura de gastos a la nube CON rastro (2026-09-11). Antes cada sitio hacia
   `.catch(function(){})` y la fila se quedaba solo en el movil -> widget != app
   (512 sin abrir / 497 en pantalla). Un helper, un log; la proxima escritura no nace muda.
   Portado a mano desde `tanda/catch-addExpense-log` (4.18.24): mergearla entera arrastraba
   media rama vieja de `main` y dejaba 7 tests en conflicto. */
/* Clave de dedup / lápida. 2026-09-11 Paso 0 (Bizums): un apunte MANUAL no se fusiona con
   nada — si lo tecleó él, existe. Antes `día|importe|comercio` se comía los Bizums de 14,90 €
   que apuntaba a mano tras perderlos en OB. Comercio específico (APOLLON) sigue igual. */
function isManualExpenseSource(source){
  const s=String(source||"");
  return !s || s==="manual" || s.indexOf("manual:")===0 || s==="supabase";
}
function keyOfExpenseLegacy(e){
  return String(e&&e.date).slice(0,10)+"|"+(e&&e.amount)+"|"+((e&&e.merchant)||"");
}
function keyOfExpense(e){
  const base=keyOfExpenseLegacy(e);
  if(isManualExpenseSource(e&&e.source)) return base+"|"+String((e&&e.id)||"");
  return base;
}
/* Lápidas anteriores al Paso 0 guardaban la clave sin id: siguen ocultando ese manual. */
function expenseIsTombstoned(e, delSet){
  if(!delSet) return false;
  const k=keyOfExpense(e);
  if(delSet[k]) return true;
  if(isManualExpenseSource(e&&e.source) && delSet[keyOfExpenseLegacy(e)]) return true;
  return false;
}
function _errCloudMsg(err){
  return String((err&&(err.message||err.code||err.error_description))||err||"?").slice(0,300);
}
function subirGasto(e, donde){
  if(!cloud.enabled()) return Promise.resolve();
  return cloud.addExpense(e).catch(function(err){
    cloud.logEvent("error","addExpense "+(donde||"?")+": "+keyOfExpense(e), _errCloudMsg(err));
  });
}
function borrarGastoNube(e, donde){
  if(!cloud.enabled()) return Promise.resolve();
  return cloud.deleteExpense(e).catch(function(err){
    cloud.logEvent("error","deleteExpense "+(donde||"?")+": "+keyOfExpense(e), _errCloudMsg(err));
  });
}

/* ---------- Blindaje del banco de pruebas ----------
   Mientras estás en modo pruebas, TODA operación que ESCRIBA en la nube se anula. Es la garantía
   que hace que el modo pruebas sirva para algo: puedes romper lo que quieras y no llega nada a
   Supabase, así que ni tu padre ni tu pareja ven un solo cambio.

   Se hace envolviendo `cloud` por fuera (no método a método) para que no se pueda escapar ninguna
   por despiste. Las LECTURAS (pullState, bankSync, prices…) siguen funcionando: probar con datos
   de verdad es justo la gracia. `bankConnect` y compañía también se cortan: mandan al banco a
   autorizar de verdad, y eso sí toca producción.

   Si añades un método a `cloud` que ESCRIBA algo, añádelo a esta lista. */
const CLOUD_WRITES=[
  "pushState","addExpense","addExpensesBatch","setExpenseBank","setExpenseDup","setExpenseNoCard","setExpenseNote","setExpenseCat","setExpenseDeuda","deleteExpense","deleteExpensesByIds",
  "backupState","bankConnect","bankDisconnect","myinvestorConnect","myinvestorStore",
  "myinvestorDisconnect","setIngestToken","clearIngestToken","logEvent","logUso","logPerf","feedback","betaReport",
  "deleteAccount","createHousehold","joinHousehold","publishHouseholdSnapshot","leaveHousehold",
];

/* Lecturas que METEN DATOS en la cartera. Solo se cortan en MODO INICIAL (mcSandboxVacio), nunca
   en el banco de pruebas normal. Sin esto, la cartera vacía dura lo que tarda el primer pull.
   `prices`, `suggestCategory` y las de sesión se quedan fuera a propósito: no traen movimientos
   ni saldos, y cortarlas haría que la app pareciera rota en vez de recién instalada. */
const CLOUD_READS_QUE_LLENAN=[
  "pullState","pullExpenses","bankSync","bankSyncHistory","bankLinks","bankAspsps",
  "myinvestorSync","myinvestorStatus","listBackupDays","getBackup","fetchHouseholdBundle",
];
(function(){
  CLOUD_WRITES.forEach(function(name){
    const real=cloud[name];
    if(typeof real!=="function") return;   // método renombrado: mejor enterarse en los tests que fallar mudo
    cloud[name]=function(){
      if(mcSandbox()) return Promise.resolve(null);   // modo pruebas: no sale nada de este móvil
      return real.apply(cloud, arguments);
    };
  });
  CLOUD_READS_QUE_LLENAN.forEach(function(name){
    const real=cloud[name];
    if(typeof real!=="function") return;   // método renombrado: mejor enterarse en los tests que fallar mudo
    cloud[name]=function(){
      // Solo el MODO INICIAL. El banco de pruebas normal sigue leyendo de la nube, como debe.
      if(mcSandboxVacio()) return Promise.resolve(name==="pullExpenses" ? [] : null);
      return real.apply(cloud, arguments);
    };
  });
})();

/* LA CUOTA DE DEUDA VIAJA EN `source` COMO `ob:<ent>~deuda.<debtId>` (4.21.0).
   Sin migración, igual que el banco y el `#dup`. ⚠ `~` y NO `#`: el servidor desplegado hace
   `split("#")[0]`, así que `ob:sabadell#deuda.x` lo leería como Sabadell y SUMARÍA la cuota al
   widget. Con `~` cualquier servidor sin esta regla —y cualquier app vieja de la familia— lee un
   banco raro («sabadell~deuda.x») que no está en la lista de gasto diario y la deja fuera: el
   lado seguro. Espejo en `_shared/presupuesto.ts` (`esCuotaDeDeuda`). */
function deudaSufijo(debtId){
  const id=String(debtId||"").replace(/[^A-Za-z0-9_-]/g,"");
  return id ? "~deuda."+id : "";
}
/* Parte el tramo de banco de un `source` OB: «sabadell~deuda.x» → {ent:"sabadell", debtId:"x"}. */
function partirEntDeuda(tramo){
  const s=String(tramo||""), i=s.indexOf("~deuda.");
  if(i<0) return { ent:s||null, debtId:null };
  return { ent:s.slice(0,i)||null, debtId:s.slice(i+7)||null };
}
/* Codifica el banco en `source` de la tabla (sin migración SQL): ob:caixa, ob-hist:sabadell,
   macrodroid (= Trade Republic). Así el filtro por banco sobrevive a reinstalaciones. */
function expenseSourceForCloud(e){
  const ent=e&&e.ent; const s=(e&&e.source)||"manual";
  // POSIBLE REPETIDO PENDIENTE (B09-D, 2026-09-08): la decisión tiene que VIAJAR. Hasta hoy
  // `possibleDup` solo existía en el móvil: la app lo excluía del total del mes y el servidor
  // —que solo lee fecha/importe/comercio/cat/source— lo sumaba. De ahí que el widget dijera más
  // que Inicio. Se codifica dentro de `source`, igual que el banco: cero migración en el
  // Supabase compartido y viaja por OTA.
  //
  // POR QUÉ SUFIJO `#dup` Y NO UN PREFIJO `ob-dup:` (voto de Codex, y tiene razón): un prefijo
  // nuevo es una cara desconocida para el servidor VIEJO, que lo leería como «sin banco» → «a
  // mano» → CUENTA. Un gasto de un banco que hoy queda fuera del presupuesto empezaría a sumar
  // en cuanto saliera el OTA, aunque el ingest no se hubiera desplegado. Con el sufijo, el
  // servidor viejo ve el banco "trade_republic#dup", no lo encuentra en la lista de bancos de
  // gasto diario y lo EXCLUYE: exactamente lo que queremos. El fallo degrada al lado seguro y
  // el arreglo no depende de desplegar el Supabase compartido.
  //
  // Lo que NO viaja es `possibleDupOf` (el gemelo): tras reinstalar, «es el mismo» sigue
  // borrando la fila OB pero ya no puede traspasarle el extId al gemelo.
  if(ent&&(s==="ob"||String(s).indexOf("ob:")===0)) return "ob:"+ent+deudaSufijo(e&&e.debtId)+((e&&e.possibleDup)?"#dup":"");
  if(ent&&(s==="ob-hist"||String(s).indexOf("ob-hist:")===0)) return "ob-hist:"+ent;
  if(s==="macrodroid"||s==="tr") return "macrodroid";
  if(s==="supabase") return "manual";
  // Manual CON banco elegido (2026-07-18): mismo truco que ob: — el banco viaja en source
  // y sobrevive a reinstalaciones sin migración SQL.
  if(ent&&(s==="manual"||String(s).indexOf("manual:")===0)) return "manual:"+ent;
  return s||"manual";
}
/* ---------- Token aleatorio de VERDAD (256 bits) ----------
   Lo usa el token de ingest, que es lo ÚNICO que protege la función que apunta gastos en tu
   cuenta: quien lo adivine puede meterte movimientos falsos. Antes se generaba con
   `crypto.randomUUID()` (bien) pero, si no existía, caía a `Date.now()+Math.random()` — que es
   PREDECIBLE: Math.random no es criptográfico y el instante se puede acotar. Encima se le pegaba
   otro `Math.random()` que no añadía entropía real, solo daba sensación de token largo.

   Ahora: 32 bytes de crypto.getRandomValues en hexadecimal. Si el navegador no tiene un generador
   seguro devolvemos null y la función que llama AVISA en vez de generar un token flojo — más vale
   no activar la captura automática que activarla con un token adivinable (2026-07-24). */
function mcRandomToken(){
  try{
    const c=window.crypto||window.msCrypto;
    if(c&&c.getRandomValues){
      const b=new Uint8Array(32); c.getRandomValues(b);
      let s=""; for(let i=0;i<b.length;i++) s+=("0"+b[i].toString(16)).slice(-2);
      return s;
    }
    if(c&&c.randomUUID) return String(c.randomUUID()).replace(/-/g,"");
  }catch(e){}
  return null;
}
/* UUID de fila de gasto (2026-09-07). La tabla `expenses.id` es uuid PK; el id corto de
   `uid()` no casaba con la nube y las escrituras iban por fecha|importe|comercio (tocaban
   gemelos). Nuevos gastos nacen con uuid; los viejos (8 chars) siguen el fallback por atributos. */
function isExpenseUuid(id){
  return typeof id==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
function mcExpenseId(){
  try{
    const c=typeof window!=="undefined"?(window.crypto||window.msCrypto):null;
    if(c&&c.randomUUID) return c.randomUUID();
    if(c&&c.getRandomValues){
      const b=new Uint8Array(16); c.getRandomValues(b);
      b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
      const h=[]; for(let i=0;i<16;i++) h.push(("0"+b[i].toString(16)).slice(-2));
      return h[0]+h[1]+h[2]+h[3]+"-"+h[4]+h[5]+"-"+h[6]+h[7]+"-"+h[8]+h[9]+"-"+h[10]+h[11]+h[12]+h[13]+h[14]+h[15];
    }
  }catch(e){}
  // Sin crypto (tests Node): mismo fallback que createHousehold — isExpenseUuid lo acepta.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(ch){
    const r=Math.random()*16|0; return (ch==="x"?r:(r&0x3|0x8)).toString(16);
  });
}
/* Clave de escritura en la tabla: uuid si lo hay; si no, atributos (gastos viejos del móvil).
   Sin fecha o importe NO se escribe: un .eq solo por user_id borraría (o tocaría) TODOS los
   gastos del usuario — agujero viejo que el botón «es el mismo» pisa a diario (2026-09-07). */
function expenseCloudKeys(e){
  if(isExpenseUuid(e&&e.id)) return {by:"id", id:e.id};
  const fecha=e&&e.date;
  const importe=e&&e.amount;
  if(fecha==null || fecha==="" || importe==null || importe==="") return {by:"abort"};
  return {by:"attrs", fecha:fecha, importe:importe, comercio:(e&&e.merchant)||""};
}
function expenseCloudEq(q, userId, e){
  const k=expenseCloudKeys(e);
  // Abort silencioso: el llamante hace `const {error}=await …` y no revienta; cero queries.
  if(k.by==="abort") return { data:null, error:null };
  q=q.eq("user_id", userId);
  if(k.by==="id") return q.eq("id", k.id);
  return q.eq("fecha",k.fecha).eq("importe",k.importe).eq("comercio",k.comercio);
}

/* ---------- Lápidas de gastos borrados ----------
   `state.deleted` guarda claves de `keyOfExpense` para que el siguiente pull no resucite un
   gasto borrado. Manuales llevan id en la clave (Paso 0); las lápidas viejas sin id siguen
   casando vía `expenseIsTombstoned`. Tope 500 (2026-07-24). */
const DELETED_MAX=500;
function pushDeleted(list, key){
  const out=(list||[]).concat([key]);
  return out.length>DELETED_MAX ? out.slice(out.length-DELETED_MAX) : out;
}

/* ---------- CONCEPTO de un movimiento (mensaje del bizum, descripción del banco) ----------
   Petición del padre (2026-07-24): «solo salía el título y tenía que ir al banco todo el rato
   para saber lo que era». El dato SÍ venía — Enable Banking manda `remittance_information` y la
   noti de TR trae el texto entero — pero se tiraba a la basura al mapear el movimiento.

   `note` es texto libre del banco/la noti; `noteEdited` marca los que ha escrito el usuario a mano
   para que un re-sync del banco no le pise lo que él escribió. */
const NOTE_MAX=160;
/* Limpia el concepto: recorta, quita ruido y NO repite lo que ya se ve en el título del
   movimiento (si el banco manda «BIZUM DE MARIA» y el título ya es «Bizum de María», no
   pintamos la misma frase dos veces debajo). */
function cleanNote(raw, merchant){
  let s=String(raw==null?"":raw).replace(/\s+/g," ").trim();
  if(!s) return "";
  // Referencias internas que no le dicen nada a nadie: "REF 000123456789", "MANDATO ...".
  s=s.replace(/\b(?:ref(?:erencia)?|mandato|mandate|id)\.?\s*:?\s*[A-Z0-9]{8,}\b/gi,"").replace(/\s+/g," ").trim();
  if(!s) return "";
  const norm=function(x){ return String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); };
  const nm=norm(merchant), ns=norm(s);
  if(!ns) return "";
  if(nm && (ns===nm || (nm.length>3 && ns.indexOf(nm)===0 && ns.length-nm.length<3))) return "";
  return s.slice(0,NOTE_MAX);
}
/* Concepto que se PINTA de un gasto (string vacío = no hay nada que enseñar). */
function expenseNote(e){
  if(!e) return "";
  return cleanNote(e.note, e.merchant);
}
/* Banco de un gasto (ent) o null si es a mano / desconocido. */
function expenseBankOf(e){
  if(!e) return null;
  if(e.ent) return e.ent;
  const s=String(e.source||"");
  if(s==="macrodroid"||s==="tr") return "trade_republic";
  if(s.indexOf("ob:")===0) return partirEntDeuda(s.slice(3).split("#")[0]).ent;   // «#dup» = posible repetido (B09-D); «~deuda.» = cuota
  if(s.indexOf("ob-hist:")===0) return s.slice(8)||null;
  if(s.indexOf("manual:")===0) return s.slice(7)||null;
  return null;
}
/* Gasto del mes partido por banco de origen. A mano (sin banco) → cuenta diaria.
   Por qué: dynBal restaba thisMonthSpent ENTERO al principal cuando expenseBanks tiene
   varios — un cargo de Revolut se comía Trade Republic (257,17 € el 2026-08-18). */
function gastoDelMesPorBanco(gastosDelMes, dailyEnt){
  const map={};
  (gastosDelMes||[]).forEach(function(e){
    const b=expenseBankOf(e)||dailyEnt||null;
    if(!b) return;
    map[b]=(map[b]||0)+(e.amount||0);
  });
  return map;
}
/* ============================================================
   ¿QUÉ MARCA ES ESTA INVERSIÓN? (2026-09-11)
   Pidió ver el logo de cada empresa en Inversiones, como los ve en Revolut y Trade Republic.
   Los brókers mandan `{isin, name}` y NADA de imagen —comprobado en `miPositionsFrom` y en
   `TradeRepublicPlugin`— así que hay que reconocer la marca por el NOMBRE.

   Vive AQUÍ y no en el script que genera los SVG a propósito: si la regla estuviera en los dos
   sitios sería la séptima copia de la misma lógica, y hoy eso nos ha mordido tres veces
   (`misma-regla-en-dos-sitios`). `scripts/logos-inversiones.mjs` la carga de aquí con
   `load-pure-logic.mjs` y comprueba que hay un fichero para cada marca que esto puede devolver.

   Se compara POR PALABRAS y no con expresiones regulares: al pasar este fichero por el shell se
   perdieron DOS veces las barras invertidas, y sin ellas «amd» casa dentro de cualquier palabra
   — sin dar un solo error. Aquí un fallo callado es ponerle a una empresa la cara de otra.
   Ante la duda, SIN logo: el monograma correcto es mejor que el logotipo equivocado.
   ============================================================ */
function palabrasDeNombre(nombre){
  return String(nombre||"").toLowerCase().normalize("NFD")
    .replace(/[^a-z0-9]+/g," ").trim().split(" ").filter(Boolean);
}
/* Un FONDO que lleve dentro el nombre de una empresa NO es esa empresa: un «AMD Ryzen Fondo
   Tecnológico» o un «iShares Metaverse UCITS» no llevan logo. Se mira ANTES que las marcas. */
const PALABRAS_DE_FONDO=["fondo","fund","etf","ucits","index","indexado","sicav",
  "vanguard","ishares","amundi","msci","lyxor","xtrackers",
  // índices: un «FTSE All-World» no lleva ninguna de las de arriba y es un fondo igual
  "ftse","stoxx","nasdaq"];
/* ⚠ REVOLUT LOS LLAMA POR EL TICKER, no por el nombre (su captura del 11/9: `NVDA`, `GOOG`,
   `AVGO`, `TSM`, `MU`), mientras que Trade Republic manda «Meta Platforms» y Revolut manda «AMD».
   Por eso en la primera versión solo salían AMD y Meta: las otras cinco llegaban como ticker.
   El ticker solo vale si el nombre ENTERO es ese ticker: buscarlo dentro de un nombre largo haría
   que un «MU» o un «TSM» sueltos se llevaran un logo que no les toca. */
const TICKERS_INVERSION={ nvda:"nvidia", goog:"alphabet", googl:"alphabet", avgo:"broadcom",
  amd:"amd", meta:"meta", tsm:"tsmc", mu:"micron" };
/* `clave` = palabras que TODAS tienen que estar en el nombre. */
const MARCAS_INVERSION=[
  {slug:"nvidia",   clave:["nvidia"]},
  {slug:"amd",      clave:["advanced","micro"]},
  {slug:"amd",      clave:["amd"]},
  {slug:"meta",     clave:["meta","platforms"]},
  {slug:"alphabet", clave:["alphabet"]},
  {slug:"broadcom", clave:["broadcom"]},
  {slug:"tsmc",     clave:["taiwan","semiconductor"]},
  {slug:"micron",   clave:["micron"]},
];
/* CATEGORÍAS, para lo que no es una empresa con logotipo (2026-09-11, petición suya: «para el oro
   métele un lingote, y para el FTSE All-World y el MSCI World algo distintivo, al final uno es un
   ETF y otro un fondo indexado»). Aquí SÍ se dibuja, y es legítimo: no hay marca que copiar, es
   iconografía de categoría — al revés que con los logos de banco, donde dibujar salió mal cuatro
   veces seguidas. */
function categoriaDeInversion(nombre, kind){
  const p=palabrasDeNombre(nombre);
  if(!p.length) return null;
  // Oro y metales: el lingote.
  if(p.indexOf("oro")>=0 || p.indexOf("xau")>=0 || p.indexOf("gold")>=0) return "oro";
  const esFondo=(function(){
    for(let i=0;i<PALABRAS_DE_FONDO.length;i++) if(p.indexOf(PALABRAS_DE_FONDO[i])>=0) return true;
    return false;
  })();
  if(!esFondo) return null;
  /* ETF o fondo indexado. `kind` lo manda MyInvestor (`indexed`/`fund`); Trade Republic no manda
     nada, así que ahí se mira el nombre. No es perfecto y no lo puede ser con un nombre suelto:
     ante la duda cae a fondo, que es lo más común en su cartera. */
  if(kind==="indexed") return "fondo-indice";
  if(p.indexOf("etf")>=0 || p.indexOf("ucits")>=0) return "etf-mundo";
  if(kind==="fund") return "fondo-indice";
  // «FTSE All-World» de Trade Republic llega sin `kind` y sin la palabra ETF, pero lo es.
  if(p.indexOf("ftse")>=0 || (p.indexOf("all")>=0 && p.indexOf("world")>=0)) return "etf-mundo";
  return "fondo-indice";
}
function marcaDeInversion(nombre, kind){
  const p=palabrasDeNombre(nombre);
  if(!p.length) return null;
  // Categoría primero: el oro y los fondos nunca son una empresa.
  const cat=categoriaDeInversion(nombre, kind);
  if(cat) return cat;
  for(let i=0;i<PALABRAS_DE_FONDO.length;i++) if(p.indexOf(PALABRAS_DE_FONDO[i])>=0) return null;
  // Ticker: solo si el nombre es EXACTAMENTE eso y nada más.
  if(p.length===1 && TICKERS_INVERSION[p[0]]) return TICKERS_INVERSION[p[0]];
  for(let i=0;i<MARCAS_INVERSION.length;i++){
    const m=MARCAS_INVERSION[i];
    let todas=true;
    for(let j=0;j<m.clave.length;j++) if(p.indexOf(m.clave[j])<0){ todas=false; break; }
    if(todas) return m.slug;
  }
  return null;
}
/* Saldo mostrado de la cuenta de gasto diario, y su inversa al editar / sincronizar.
   Vivían copiadas en cinco sitios; si se cambia dynBal y no las inversas, teclear el
   saldo guarda un número torcido — peor que el bug (brief 2026-08-18). */
function saldoCuentaGasto(o){
  o=o||{};
  var v=(o.value||0)+(o.injTR||0)-(o.spentOwn||0)-(o.roundup||0)-(o.monthlyInvest||0);
  if(o.ambos) v+=(o.paidNet||0);
  return v;
}
function valueDesdeSaldo(o){
  o=o||{};
  var v=(o.shown||0)-(o.injTR||0)+(o.spentOwn||0)+(o.roundup||0)+(o.monthlyInvest||0);
  if(o.ambos) v-=(o.paidNet||0);
  return +v.toFixed(2);
}
/* Saldo que se PINTA de una cuenta. Diaria → fórmula TR. Efectivo → value − gastos propios
   (nadie re-ancla el sobre). Resto → value + paidNet, SIN restar gastos: las manuales sin OB
   las ajusta él a mano (decisión pendiente del dueño; NO ensanchar a «sin bankIban»). */
function saldoCuentaMostrada(a, o){
  o=o||{};
  if(!a) return 0;
  const spentMap=o.spentByBank||{};
  const paidMap=o.paidNetByBank||{};
  const pn=paidMap[a.ent]||0;
  if(typeof accDaily==="function" ? accDaily(a) : (a.role==="diario"||a.role==="ambos"||a.spendFrom)){
    return saldoCuentaGasto({
      value:a.value, injTR:o.injTR||0, spentOwn:spentMap[a.ent]||0,
      roundup:o.roundup||0, monthlyInvest:o.monthlyInvest||0,
      ambos:(typeof accRole==="function"?accRole(a)==="ambos":a.role==="ambos"), paidNet:pn
    });
  }
  var v=(a.value||0)+pn;
  if(isEfectivoEnt(a)) v-=(spentMap[a.ent]||0);
  return v;
}
/* Crea el sobre si no existe. Valor inicial opcional. Lo mete en expenseBanks (presupuesto sí). */
function ensureEfectivoAccount(state, initialValue){
  if(!state) return state;
  const accounts=(state.accounts||[]).slice();
  if(accounts.some(isEfectivoEnt)) return state;
  const v=(initialValue!=null && isFinite(Number(initialValue))) ? +Number(initialValue).toFixed(2) : 0;
  accounts.push({ id:(typeof uid==="function"?uid():("ef-"+Date.now())), ent:"efectivo", name:"Efectivo", value:v, role:"fijos" });
  const settings=Object.assign({}, state.settings||{});
  const eb=(settings.expenseBanks||[]).slice();
  if(eb.indexOf("efectivo")<0) eb.push("efectivo");
  settings.expenseBanks=eb;
  /* ⚠ Y SOLO GASTO DIARIO (13/9, hotfix suyo y de su padre: «el efectivo te lo crea de gasto
     diario y recibo… al editarlo no te da a elegir que solo sea para gasto diario»). Sin
     `dailyOnlyBanks` el sobre salía como «Gasto diario · Recibos»: en expenseBanks cuenta para el
     día a día y, con rol `fijos`, también para recibos. El efectivo no tiene recibos domiciliados. */
  const d0=(settings.dailyOnlyBanks||[]).slice();
  if(d0.indexOf("efectivo")<0) d0.push("efectivo");
  settings.dailyOnlyBanks=d0;
  return Object.assign({}, state, { accounts:accounts, settings:settings });
}
/* Borrar el sobre: no toca los gastos (siguen con ent efectivo); saca efectivo de expenseBanks. */
function removeEfectivoAccount(state, id){
  if(!state) return state;
  const accounts=(state.accounts||[]).filter(function(a){
    if(id && a.id===id) return false;
    if(!id && isEfectivoEnt(a)) return false;
    return true;
  });
  const settings=Object.assign({}, state.settings||{});
  settings.expenseBanks=(settings.expenseBanks||[]).filter(function(e){ return e!=="efectivo"; });
  settings.dailyOnlyBanks=(settings.dailyOnlyBanks||[]).filter(function(e){ return e!=="efectivo"; });
  return Object.assign({}, state, { accounts:accounts, settings:settings });
}
/* Saqué del cajero: traspaso neutro en el banco + sube el sobre.
   Si el banco NO está anclado por IBAN, también baja su value (si no, el banco ya trae el −€). */
function applySaqueCajero(state, fromEnt, amount){
  if(!state || !fromEnt) return state;
  const amt=Math.abs(Number(amount)||0);
  if(!(amt>0)) return state;
  let st=ensureEfectivoAccount(state, 0);
  const accounts=(st.accounts||[]).map(function(a){
    if(isEfectivoEnt(a)) return Object.assign({}, a, { value:+((a.value||0)+amt).toFixed(2) });
    if(a.ent===fromEnt && !a.bankIban) return Object.assign({}, a, { value:+((a.value||0)-amt).toFixed(2) });
    return a;
  });
  const e={
    id:(typeof mcExpenseId==="function"?mcExpenseId():(typeof uid==="function"?uid():("cajero-"+Date.now()))),
    date:new Date().toISOString(),
    merchant:"Cajero",
    amount:amt,
    category:"traspaso",
    source:"manual",
    ent:fromEnt,
    noCard:true
  };
  return Object.assign({}, st, { accounts:accounts, expenses:[e].concat(st.expenses||[]) });
}
/* Entró efectivo (propina, te devuelven…): solo sube el sobre. */
function applyEntradaEfectivo(state, amount){
  if(!state) return state;
  const amt=Math.abs(Number(amount)||0);
  if(!(amt>0)) return state;
  let st=ensureEfectivoAccount(state, 0);
  const accounts=(st.accounts||[]).map(function(a){
    if(!isEfectivoEnt(a)) return a;
    return Object.assign({}, a, { value:+((a.value||0)+amt).toFixed(2) });
  });
  return Object.assign({}, st, { accounts:accounts });
}
/* EFECTIVO REAL DE TRADE REPUBLIC (availableCash) → base guardada de su cuenta.
   Lo usan los DOS botones que hablan con el puente nativo: la tarjeta de TR y el sincronizador
   general. Antes cada uno tenía un contrato distinto: la tarjeta aplicaba `cash` y el general lo
   tiraba, así que el saldo solo cuadraba al volver a sincronizar por Open Banking. */
function applyTrCash(state, cash, totals){
  if(!state || cash==null || !isFinite(Number(cash)) || !totals) return state;
  const shown=Number(cash);
  const accounts=state.accounts||[];
  const hasTR=accounts.some(function(a){ return a.ent==="trade_republic"; });
  const next=hasTR ? accounts.map(function(a){
    if(a.ent!=="trade_republic") return a;
    const pn=(totals.paidNetByBank&&totals.paidNetByBank[a.ent])||0;
    const spentOwn=(totals.spentByBank&&totals.spentByBank[a.ent])||0;
    const stored=accDaily(a)
      ? valueDesdeSaldo({shown:shown,injTR:totals.injTR||0,spentOwn:spentOwn,roundup:totals.roundupThisMonth||0,monthlyInvest:totals.monthlyInvestThisMonth||0,ambos:accRole(a)==="ambos",paidNet:pn})
      : shown-pn;
    return Object.assign({},a,{value:+stored.toFixed(2)});
  }) : accounts.concat([{id:uid(),ent:"trade_republic",name:"Trade Republic",value:+shown.toFixed(2),note:""}]);
  return Object.assign({},state,{accounts:next});
}

/* Orden visual de Gastos. El banco muchas veces solo trae DÍA, no hora: inventar una hora para
   ordenar sería mentir. Se conserva el día y el usuario decide el orden dentro de ese día; los
   ids viven en settings para que viajen con la cuenta aunque `expenses` se guarde por separado. */
function sortExpensesForDisplay(expenses, state){
  const saved=((state&&state.settings)||{}).expenseOrder||{};
  const cache={};
  const pos=function(day,id){
    const list=saved[day];
    if(!Array.isArray(list)||!list.length) return null;
    if(!cache[day]){ const m={}; list.forEach(function(x,i){ m[x]=i; }); cache[day]=m; }
    return cache[day][id]!=null?cache[day][id]:Infinity;
  };
  /* EL DÍA DE CADA GASTO, UNA SOLA VEZ. `diaDeGasto` construye un `Date`, y un `sort` llama al
     comparador ~n·log n veces: Cursor lo midió con 5.000 gastos y salía **127 ms contra 7 ms** del
     `slice` de string que había antes — 18×. En un mes normal no se nota porque el sort va sobre la
     lista YA filtrada, pero con el filtro en «Todo» y su histórico entero sí rozaría.
     Con esto se calcula n veces en vez de n·log n y el coste vuelve a ser el de comparar strings. */
  const diaDe={};
  const dia=function(e){
    const k=e&&e.id;
    if(k==null) return diaDeGasto(e);
    if(diaDe[k]===undefined) diaDe[k]=diaDeGasto(e);
    return diaDe[k];
  };
  return (expenses||[]).slice().sort(function(a,b){
    const da=dia(a), db=dia(b);
    if(da!==db) return db.localeCompare(da);
    const pa=pos(da,a.id), pb=pos(db,b.id);
    if(pa!=null||pb!=null){ if(pa!==pb) return (pa==null?Infinity:pa)-(pb==null?Infinity:pb); }
    return dateMs(b.date)-dateMs(a.date);
  });
}
function moveExpenseWithinDay(state, fromId, toId){
  if(!state || !fromId || !toId || fromId===toId) return state;
  const byId={}; (state.expenses||[]).forEach(function(e){ if(e&&e.id) byId[e.id]=e; });
  const from=byId[fromId], to=byId[toId];
  /* El MISMO día que enseña la cabecera (local, `diaDeGasto`). Antes era el prefijo ISO del string
     guardado —UTC— así que un gasto de madrugada tenía una clave distinta de la de sus vecinos en
     pantalla: los dos `day` no coincidían, esta función devolvía el estado sin tocar y **arrastrarlo
     no hacía nada**. ⚠ El orden guardado (`settings.expenseOrder`) va indexado por esa clave: los
     días que él ya hubiera ordenado a mano Y tuvieran algo de madrugada pierden ese orden a mano y
     vuelven a salir por hora. Es una vez, y a cambio se puede reordenar. */
  const day=from&&diaDeGasto(from);
  if(!from||!to||day!==diaDeGasto(to)) return state;
  const ids=sortExpensesForDisplay((state.expenses||[]).filter(function(e){ return diaDeGasto(e)===day; }),state).map(function(e){ return e.id; });
  const i=ids.indexOf(fromId), j=ids.indexOf(toId); if(i<0||j<0) return state;
  ids.splice(i,1); ids.splice(j,0,fromId);
  const settings=Object.assign({},state.settings,{expenseOrder:Object.assign({},((state.settings||{}).expenseOrder)||{},{[day]:ids})});
  return Object.assign({},state,{settings:settings});
}
/* Cartera → Tus cuentas: una cuenta recién conectada vive en `obAccounts` hasta que el usuario
   elige su rol. No se puede meter en `accounts` solo para ordenarla: eso inventaría si paga recibos
   o gasto diario y podría mover presupuesto/saldos. El orden visual mezcla ambas listas mediante
   una clave estable, sin tocar el modelo financiero (rechazo real CaixaBank 2026-09-16). */
function accountOrderKeyOf(item, kind){
  if(kind==="ob") return "ob:"+String(item&&item.key||"");
  return String((item&&item.accountOrderKey)||("acc:"+String(item&&item.id||"")));
}
function accountRowsInOrder(state){
  const rows=(state&&state.accounts||[]).map(function(a){
    return {key:accountOrderKeyOf(a,"account"),kind:"account",item:a};
  }).concat((state&&state.obAccounts||[]).map(function(o){
    return {key:accountOrderKeyOf(o,"ob"),kind:"ob",item:o};
  }));
  const order=((state&&state.settings||{}).accountListOrder)||[];
  if(!Array.isArray(order)||!order.length) return rows;
  const byKey={}; rows.forEach(function(r){ byKey[r.key]=r; });
  const seen={}, out=[];
  order.forEach(function(k){ if(byKey[k]&&!seen[k]){ seen[k]=true; out.push(byKey[k]); } });
  rows.forEach(function(r){ if(!seen[r.key]) out.push(r); });
  return out;
}
function moveAccountInList(state, fromId, toId){
  if(!state||!fromId||!toId||fromId===toId) return state;
  const rows=accountRowsInOrder(state);
  const keyOf=function(raw){
    const direct=rows.find(function(r){ return r.key===raw; });
    if(direct) return direct.key;
    const legacy=rows.find(function(r){ return r.kind==="account"&&r.item&&r.item.id===raw; });
    return legacy&&legacy.key;
  };
  const from=keyOf(fromId), to=keyOf(toId);
  if(!from||!to||from===to) return state;

  /* Compatibilidad: si solo hay cuentas con rol y aún no existe orden mixto, conserva el contrato
     histórico (el array `accounts` ya guarda el orden de todos los móviles publicados). */
  const saved=((state.settings||{}).accountListOrder)||[];
  if(!(state.obAccounts||[]).length && (!Array.isArray(saved)||!saved.length)){
    const acc=(state.accounts||[]).slice();
    const i=acc.findIndex(function(a){ return accountOrderKeyOf(a,"account")===from; });
    const j=acc.findIndex(function(a){ return accountOrderKeyOf(a,"account")===to; });
    if(i<0||j<0||i===j) return state;
    const item=acc.splice(i,1)[0]; acc.splice(j,0,item);
    return Object.assign({},state,{accounts:acc});
  }

  const keys=rows.map(function(r){ return r.key; });
  const i=keys.indexOf(from), j=keys.indexOf(to);
  if(i<0||j<0||i===j) return state;
  const item=keys.splice(i,1)[0]; keys.splice(j,0,item);
  const next={settings:Object.assign({},state.settings,{accountListOrder:keys})};
  /* Cuando ya no queda ninguna cuenta pendiente, `accounts` vuelve a ser la lista completa. Se
     alinea también su orden para que los lectores anteriores al orden mixto no vean otra cosa;
     las claves guardadas se regeneran desde `rows`, así desaparecen las de bancos desconectados. */
  if(!(state.obAccounts||[]).length){
    const byKey={}; (state.accounts||[]).forEach(function(a){ byKey[accountOrderKeyOf(a,"account")]=a; });
    next.accounts=keys.map(function(k){ return byKey[k]; }).filter(Boolean);
  }
  return Object.assign({},state,next);
}
/* Resuelve un OB marcado como posible repetido (2026-09-07).
   same=true  → se queda el gemelo con nombre (noti/manual) y se borra la fila OB.
   same=false → son dos cargos reales: se quita la marca y la fila OB ya cuenta. */
function resolvePossibleDup(state, expenseId, same){
  if(!state || !expenseId) return state;
  const ex=(state.expenses||[]).find(function(e){ return e && e.id===expenseId; });
  if(!ex || !ex.possibleDup) return state;
  if(same){
    const twinId=ex.possibleDupOf;
    const twin=twinId && (state.expenses||[]).find(function(e){ return e && e.id===twinId; });
    let expenses=(state.expenses||[]).filter(function(e){ return e && e.id!==expenseId; });
    // Si el gemelo no tenía extId del banco, se lo pasa la fila OB al fundirse.
    if(twin && ex.extId && !twin.extId){
      expenses=expenses.map(function(e){
        return e.id===twin.id ? Object.assign({},e,{extId:ex.extId}) : e;
      });
    }
    return Object.assign({},state,{expenses:expenses});
  }
  return Object.assign({},state,{expenses:(state.expenses||[]).map(function(e){
    if(e.id!==expenseId) return e;
    const u=Object.assign({},e);
    delete u.possibleDup; delete u.possibleDupOf;
    return u;
  })});
}
/* Convierte una fila de la tabla `expenses` al formato interno de la app. */
function expenseFromRow(r){
  const raw=String(r.source||"manual");
  let ent=null, source=raw, dup=false, debtId=null;
  if(raw==="macrodroid"||raw==="tr"){ ent="trade_republic"; source="macrodroid"; }
  // «ob:ent#dup» = posible repetido que sigue pendiente de su decisión (B09-D): vuelve marcado,
  // así que la app lo sigue dejando fuera del total tras un pull, un reinicio o un segundo móvil.
  // «ob:ent~deuda.id» = cuota de esa deuda (4.21.0): vuelve con su `debtId` para el filtro.
  else if(raw.indexOf("ob:")===0){ const p=raw.slice(3).split("#"); const pe=partirEntDeuda(p[0]); ent=pe.ent; debtId=pe.debtId; source="ob"; dup=p[1]==="dup"; }
  else if(raw.indexOf("ob-hist:")===0){ ent=raw.slice(8)||null; source="ob-hist"; }
  else if(raw.indexOf("manual:")===0){ ent=raw.slice(7)||null; source="manual"; }   // manual con banco elegido
  else if(raw==="supabase"){ source="manual"; }   // legado: antes el pull marcaba todo como supabase
  return {
    id: r.id,
    date: new Date(r.fecha).toISOString(),
    merchant: r.comercio || "Gasto",
    amount: Number(r.importe) || 0,
    // misma autodetección que el path del Sheet: si la cat es genérica, la deduce por comercio
    category: resolveCategory(r.cat, r.comercio || ""),
    source: source,
    ent: ent||undefined,
    noCard: r.no_card ? true : undefined,   // bizum/transfer: fuera del round-up (columna 0005)
    note: r.nota || undefined,              // concepto del banco / mensaje del bizum (columna 0017)
    noteEdited: r.nota_edit ? true : undefined,
    // La divisa de verdad del apunte (columna 0020). Sin leerla de vuelta, el rastro se perdía en
    // el primer pull: se escribía al subir y nadie lo bajaba.
    origAmount: r.importe_orig!=null ? Number(r.importe_orig) : undefined,
    origCur: r.divisa || undefined,
    // Cómo lo llamaba el banco antes de que él lo renombrara (columna 0021). Se lee de vuelta a
    // propósito: es EXACTAMENTE lo que le pasó a la divisa —se escribía al subir y nadie lo
    // bajaba—, y aquí perderlo significa que el siguiente sync duplica el gasto renombrado.
    obName: r.ob_name!=null ? String(r.ob_name) : undefined,
    possibleDup: dup ? true : undefined,
    debtId: debtId || undefined,
  };
}

/* Une gastos en la lista local con dedup. ADITIVO: nunca borra los que ya tenías.
   Manuales: clave con id (Paso 0, 2026-09-11) — no se comen entre sí ni con el banco. */
function mergeExpenses(prevList, incoming){
  const seen={}; const list=[];
  (prevList||[]).forEach(function(e){ const k=keyOfExpense(e); if(!seen[k]){ seen[k]=1; list.push(e); } });
  let nuevos=0;
  (incoming||[]).forEach(function(e){ const k=keyOfExpense(e); if(!seen[k]){ seen[k]=1; list.push(e); nuevos++; } });
  return { list:list, nuevos:nuevos };
}
/* Refresca una fila LOCAL con lo que manda la nube SIN sustituir el array entero (12/9).
   El pull filtraba `source!=="supabase"`, pero `expenseFromRow` ya no emite nunca `"supabase"`
   (lo convierte a `"manual"`). Resultado: keep se quedaba con TODAS las filas locales y solo
   añadía claves nuevas — categoría/importe/nota de una fila ya vista nunca se actualizaban.
   Caso medido: Aigües en nube=`energia` y el móvil seguía en `viajes` tras «Ya estás al día».
   Reglas: no pisar `cat` de un apunte manual; no pisar `note` si él la editó; nunca borrar. */
function refreshExpenseFromCloud(local, incoming){
  if(!local||!incoming) return local||incoming;
  const manual=isManualExpenseSource(local.source);
  let out=local;
  const put=function(k,v){
    const a=local[k], b=v;
    if(a===b) return;
    if(a==null && (b==null||b===undefined||b==="")) return;
    if(out===local) out=Object.assign({},local);
    if(b===undefined||b===false||b===""){ if(a!=null){ out[k]=undefined; delete out[k]; } return; }
    out[k]=b;
  };
  // Una cuota ya marcada no vuelve a «otros» porque la nube aún no se haya enterado (4.21.0): la
  // subida puede ir por detrás del pull, y la fila de la noti ni siquiera lleva la marca en `source`.
  const cuotaLocal=local.debtId && local.category==="deudas";
  if(!manual && !cuotaLocal && incoming.category!=null && incoming.category!=="") put("category", incoming.category);
  if(incoming.amount!=null && isFinite(incoming.amount)) put("amount", incoming.amount);
  if(incoming.merchant!=null && incoming.merchant!=="") put("merchant", incoming.merchant);
  if(Object.prototype.hasOwnProperty.call(incoming,"noCard")) put("noCard", incoming.noCard||undefined);
  if(Object.prototype.hasOwnProperty.call(incoming,"obName")) put("obName", incoming.obName);
  if(Object.prototype.hasOwnProperty.call(incoming,"origAmount")) put("origAmount", incoming.origAmount);
  if(Object.prototype.hasOwnProperty.call(incoming,"origCur")) put("origCur", incoming.origCur);
  /* `possibleDup` SÍ viaja (sufijo #dup del source). `possibleDupOf` NO: expenseFromRow no lo
     declara, y un put(undefined) borraba el gemelo local en CADA pull (ámbar Claude 12/9). */
  if(incoming.possibleDup) put("possibleDup", true);
  else if(incoming.possibleDup===false || incoming.possibleDup==null){
    /* Solo apagar la marca si la nube dice que ya no es dup (source sin #dup → possibleDup falsy
       y la propiedad existe en el literal de expenseFromRow). No tocar possibleDupOf. */
    if(Object.prototype.hasOwnProperty.call(incoming,"possibleDup") && !incoming.possibleDup){
      put("possibleDup", undefined);
    }
  }
  if(incoming.possibleDupOf!=null) put("possibleDupOf", incoming.possibleDupOf);
  /* Cuota de deuda (4.21.0): la marca que baja se adopta; una fila de la nube SIN marca no borra
     la local — el upsert con ignoreDuplicates puede dejar la fila vieja de la nube sin el sufijo. */
  if(incoming.debtId) put("debtId", incoming.debtId);
  if(!local.noteEdited && Object.prototype.hasOwnProperty.call(incoming,"note")) put("note", incoming.note);
  /* NO realinear `id` aquí: settings.expenseOrder indexa por id local, y en OB el uuid de la
     nube suele diferir (ignoreDuplicates). Cambiarlo huérfana el orden a mano (4.19.74). Tanda
     propia con remap de expenseOrder + possibleDupOf si hace falta para los PATCH. */
  return out;
}
/* Mezcla el pull con lo local: refresca campos de claves ya vistas y solo AÑADE las nuevas.
   Nunca elimina una clave que solo exista en local (contención 4.18.6 / FIN-07). */
function mergeExpensesFromCloud(prevList, incoming){
  const byKey={}; const order=[];
  (prevList||[]).forEach(function(e){
    const k=keyOfExpense(e);
    if(!byKey[k]){ byKey[k]=e; order.push(k); }
  });
  let changed=false; let nuevos=0; const seen={};
  (incoming||[]).forEach(function(inc){
    const k=keyOfExpense(inc);
    if(seen[k]) return;
    seen[k]=1;
    const loc=byKey[k];
    if(!loc){ byKey[k]=inc; order.push(k); changed=true; nuevos++; return; }
    const merged=refreshExpenseFromCloud(loc, inc);
    if(merged!==loc){ byKey[k]=merged; changed=true; }
  });
  const list=order.map(function(k){ return byKey[k]; });
  return { list:list, changed:changed, nuevos:nuevos };
}

/* ¿El estado bajado de la nube tiene forma válida? Evita machacar lo local con algo corrupto/parcial.
   (Los arrays pueden estar vacíos —usuario nuevo— pero deben EXISTIR y ser arrays.) */
function validCloudState(s){
  if(!s || typeof s!=="object") return false;
  return ["accounts","investments","debts","fixed"].every(function(k){ return Array.isArray(s[k]); });
}

/* Para el push FRECUENTE a la nube (cada ~1,2s): los gastos viven en su tabla `expenses`
   (fuente de verdad), así que NO los duplicamos en el JSONB de app_state → se mantiene ligero
   aunque haya miles de gastos. El backup diario sí guarda el estado completo. */
function slimForCloud(s){ const c=Object.assign({},s); delete c.expenses; delete c.bankTx; return c; }

/* ---------- Desbloqueo biométrico (huella / Face ID vía WebAuthn) ----------
   Candado LOCAL por dispositivo: tras iniciar sesión una vez, la app pide huella al abrir.
   No verifica en servidor (suficiente para uso personal); es una capa de UX tipo app de banco. */
function bufToB64(buf){ const b=new Uint8Array(buf); let s=""; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
function b64ToBuf(b64){ const s=atob(b64); const a=new Uint8Array(s.length); for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i); return a.buffer; }
/* Plugin nativo de la app Android (biometría, widget, notificaciones). null en web pura. */
function natPlugin(){
  try{ return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.MiCartera) || null; }catch(e){ return null; }
}
const bio = {
  // En la app Android la WebView NO expone WebAuthn → usa el plugin nativo (BiometricPrompt).
  supported(){ if(natPlugin()) return true; return !!(window.PublicKeyCredential && navigator.credentials && location.protocol==="https:"); },
  enabled(){ return !!store.get("bio_cred"); },
  async enable(uid, email){
    const nat=natPlugin();
    if(nat){
      const r=await nat.bioAvailable();
      if(!r || !r.available) throw new Error("Configura primero la huella o el bloqueo de pantalla del móvil");
      await nat.bioVerify();                       // pide la huella YA, como el create() de WebAuthn
      store.set("bio_cred", { native:true });
      return true;
    }
    if(!this.supported()) throw new Error("Este dispositivo/navegador no soporta huella");
    const cred = await navigator.credentials.create({ publicKey:{
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp:{ id: location.hostname, name:"Aely" },
      user:{ id: new TextEncoder().encode(String(uid||email||"user")), name: email||"usuario", displayName: email||"Aely" },
      pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
      authenticatorSelection:{ authenticatorAttachment:"platform", userVerification:"required", residentKey:"preferred" },
      timeout:60000,
    }});
    store.set("bio_cred", { id: bufToB64(cred.rawId) });
    return true;
  },
  disable(){ try{ localStorage.removeItem("bio_cred"); }catch(e){} store.set("bio_cred", null); },
  async unlock(){
    const c = store.get("bio_cred"); if(!c) return true;
    if(c.native){
      const nat=natPlugin();
      if(!nat) return true;   // candado nativo pero sin plugin (no debería pasar): no dejar la app inaccesible
      await nat.bioVerify();
      return true;
    }
    await navigator.credentials.get({ publicKey:{
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials:[{ type:"public-key", id: b64ToBuf(c.id) }],
      userVerification:"required",
      timeout:60000,
    }});
    return true;  // si no lanza, la huella se verificó
  },
};

/* UNA SOLA AUTORIZACIÓN BANCARIA A LA VEZ (2026-07-26).
   El permiso de Enable Banking caduca a los 30 min y es de un solo uso. Si dos toques (noti +
   banner, o dos bancos a la vez) lanzan bankConnect, la segunda vuelve con error=invalid_request
   aunque el banco diga «Operación realizada correctamente». Un candado compartido por Cartera y
   Mis bancos evita gastar el permiso dos veces. */
var _bankConnectBusy=null;
/* TRADE REPUBLIC POR OPEN BANKING: CONVIVE, NO SE BLOQUEA (2026-08-01).
   El 31/7 esto se cerró a cal y canto —`bankConnectBlocked`— tras el susto de «todos los gastos
   del mes contados como ingresos» al conectar TR desde el buscador de bancos. Pero bloquear no era
   arreglar, y él lo dijo con razón: «en vez de mirar qué hacer, porque quizás pueden convivir
   ambas integraciones... no me dio opción».

   Y conviven. Repasado el código entero, el susto tenía dos causas SEPARADAS:
   · La de verdad era `mapTransaction`: faltaba un `Math.abs()` antes de aplicar el signo del
     `credit_debit_indicator`, así que un ASPSP que manda el importe YA firmado doblaba el signo.
     Eso está arreglado en `enablebanking.ts` y no dependía de este bloqueo para nada.
   · La otra es real pero pequeña y tiene dueño claro: el SALDO. El puente nativo re-ancla la
     cuenta TR con `availableCash`; Open Banking re-anclaría la misma cuenta con su propio saldo y
     otra fórmula → bailaría según cuál sincronizara la última.

   Reparto: el puente nativo manda en el saldo y las posiciones (`saldoLoMandaPuenteNativo`, en
   08-motor-bank.js), y Open Banking aporta los MOVIMIENTOS — que es lo que se ganaba y nadie
   estaba mirando: las compras con la tarjeta de TR entrando solas en Gastos en vez de a mano.
   Los movimientos van deduplicados por `ext_id`, así que no hay doble conteo posible. */
function bankConnectOnce(aspsp_name, country){
  if(_bankConnectBusy){
    const err=new Error("busy");
    err.code="busy";
    return Promise.reject(err);
  }
  _bankConnectBusy=Promise.resolve(cloud.bankConnect(aspsp_name, country))
    .finally(function(){ _bankConnectBusy=null; });
  return _bankConnectBusy;
}

/* ---------- Helpers ---------- */
const NF  = new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
const NF0 = new Intl.NumberFormat('es-ES',{maximumFractionDigits:0});
// Moneda de visualización. Todos los importes de la app están en € (base); DISP los convierte
// a la moneda elegida (k = factor sobre €, sym = símbolo). Se fija en App según ajustes + fx.
let DISP = { sym:"€", k:1 };
// Símbolos de las monedas de visualización (Ajustes → Dinero). Todas contra € vía fxRates (BCE).
// TRY (lira turca) añadida 2026-08-05: crucero — sin ella el selector no ofrecía la divisa real
// del viaje y la «moneda de visualización» parecía no hacer nada al no haber tipo.
const CUR_SYM = { EUR:"€", USD:"$", GBP:"£", CHF:"CHF", JPY:"¥", CAD:"C$", AUD:"A$", CNY:"CN¥", MXN:"MX$", SEK:"kr", NOK:"kr", DKK:"kr", PLN:"zł", BRL:"R$", INR:"₹", TRY:"₺" };
// Monedas ofrecidas en el selector y la comparativa (deben venir en el fetch del BCE / frankfurter).
const CUR_LIST = ["EUR","USD","GBP","CHF","TRY","JPY","CAD","AUD","CNY","MXN","SEK","NOK","DKK","PLN","BRL","INR"];
const eur  = (n)=> NF.format((n||0)*DISP.k)+" "+DISP.sym;
const eur0 = (n)=> NF0.format(Math.round((n||0)*DISP.k))+" "+DISP.sym;
