/* ============================================================
   MI CARTERA v3 — fuente JSX (se compila con runtime clásico)
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

/* Le dice al SPLASH de entrada que ya puede irse: lo que se vea a partir de ahora es lo bueno.
   El vigilante vive al final de shell.html y no depende de esto para retirarse (tiene un tope de
   1,8 s), así que llamar de más es gratis y no llamar nunca solo devuelve el comportamiento viejo.
   Idempotente a propósito: lo llaman varios caminos (sin nube, sin sesión, candado, alta, y el
   final del primer pull de la nube) y ninguno sabe de los demás. */
function mcBootReady(){ try{ window.__mcBootReady=true; }catch(e){} }

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
  { id:"ocio",       name:"Ocio",                color:"#9BD0E0", icon:"🎭" },
  { id:"gaming",     name:"Videojuegos",         color:"#7B8CDE", icon:"🎮" },
  { id:"viajes",     name:"Viajes",              color:"#5B8DEF", icon:"✈️" },
  { id:"transporte", name:"Transporte",          color:"#7FB5E8", icon:"🚇" },
  { id:"parking",    name:"Parking",             color:"#8AA0B8", icon:"🅿️" },
  { id:"energia",    name:"Luz, gas y agua",     color:"#E8C547", icon:"⚡" },
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
// Categorías que NO son gasto ni ingreso: mueven dinero, no lo crean ni lo consumen.
const CAT_NEUTRAS = { inversion:1, traspaso:1 };
const catOf = (id)=> id==="ingreso" ? INGRESO_CAT : (id==="inversion" ? INVERSION_CAT : (id==="traspaso" ? TRASPASO_CAT : (CAT[id] || CAT.otros)));
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
  super:["mercadona","lidl","aldi","carrefour","dia ","bonpreu","bon preu","consum","eroski","spar","alcampo","simply","supermercado","market","fresco","verduleria","fruteria","hipercor","caprabo","condis","ahorramas","ahorramás","gadis","froiz","bm supermarket","family cash","supeco","costco","makro","amazon fresh","glovo market","compra online mercadona"],
  // Viajes ANTES que ocio/transporte: booking/vueling no son «ocio» ni solo «metro».
  viajes:["booking","airbnb","hotel","hostal","hostel","apartament turistic","apartamento turistico","vueling","iberia","ryanair","easyjet","vuelos","vuelo ","aeropuerto","airport","expedia","trivago","kayak","edreams","rumbo","logitravel","civitatis","getyourguide","amadeus","renfe ave","hotelbeds","marriott","hilton","ibis ","nh hotel","melia","meliá","barcelo","barceló","ac hotel","travelodge","pension ","pensión ","camping","ferry","balearia","grimaldi","cruise","crucero","tourist","turismo"],
  transporte:["renfe","fgc","tmb","metro","autobus","bus ","taxi","cabify","uber","gasolina","repsol","cepsa","shell","bp ","galp","autopista","peaje","tram","bicing","blablacar","flixbus","moove","bolt","ouigo","iryo","avlo","rodalies","emt ","alsa","avanza","ok mobility","sixt","hertz","europcar","petrocat","ballenoil","plenergy","carrefour gas","gasoleo","gasóleo","diesel","diésel","carburante","recarga electr","electrolinera","tesla supercharger","free now","freenow","taxi barcelona","ambitus"],
  parking:["parking","parquimetro","parkimetro","parquímetro","aparcament","aparcamiento","saba","b:sm","bsm","empark","interparking","apk2","apk80","onepark","elparking","easypark","telpark","zona azul","zona verde","area verde","àrea verda","grua municipal","indigo parking","secure parking"],
  // Energía ANTES que hogar (luz/gas no es «muebles»).
  energia:["endesa","iberdrola","naturgy","repsol luz","holaluz","octopus energy","octopus ","totalenergies","total energies","factor energia","factor energía","lucera","pepeenergy","pepe energy","energia ","energía ","gas natural","canal de isabel","aigues de barcelona","aigües de barcelona","agbar","aqualia","sorea","suministro electric","suministro eléctric","factura luz","factura gas","factura agua","factura aigua","tarifas luz","potencia contratada"],
  tasas:["gencat","generalitat","atc ","agencia tributaria","aeat","ajuntament","ayuntamiento","diputacio","diputación","dgt","multa","multa transit","sancion","sanción","tribut","impost","impuesto","tax agency","taxes","ibi","ivtm","basura","residus","residuos","canon agua","canon de l'aigua","tasa","taxa","registro mercantil","registro civil","notaria","notaría","gestoria","gestoría","procurador","abogado","lexnet","catastro","seguretat social","seguridad social","tgss","recaudacion","recaudación","zona bajas emisiones","zbe","hacienda","hisenda","modelo 100","modelo 303","autoliquidacion","autoliquidación","plusvalia","plusvalía","impuesto circulacion"],
  educacion:["universidad","universitat","uab ","upc ","upf ","ub ","uoc ","uned","campus","matricula","matrícula","academia","academía","curso ","cursos","formacion","formación","master ","máster","mba ","udemy","coursera","domestika","linkedin learning","skillshare","colegio","escola","guarderia","guardería","escuela infantil","libro de texto","libreria universitaria","openenglish","open english","british council","oxford house","academia de ingles","academia d'angles","autoescuela","autoescola","dgt examen","permiso conducir"],
  // Videojuegos ANTES que ocio/compras: Steam e Instant Gaming no son «Netflix» ni «Amazon».
  gaming:["steam","instant gaming","instantgaming","instant-gaming","g2a","eneba","cdkeys","humble bundle","epic games","battle.net","vs gamers","versus gamers","playstation store","xbox store","nintendo eshop","nintendo e-shop"],
  ocio:["spotify","netflix","hbo","disney","playstation","xbox","nintendo","fnac","museo","teatro","concierto","decathlon","gym","gimnasio","sport","bolera","anthropic","claude","claude.ai","openai","chatgpt","gpt-","google one","google play","googleplay","play store","playstore","icloud","apple.com","apple servic","youtube premium","youtube music","prime video","amazon prime","twitch","crunchyroll","dazn","filmin","movistar plus","rakuten","audible","deezer","tidal","dropbox","notion","canva","duolingo","cursor","midjourney","perplexity","atraccion","atracción","parque tematico","zoologic","zoológico","aquarium","aquari","escape room","ocio","basic fit","basic-fit","dir ","metropolitan","synergym","fitness park","puregym","mcfit","crossfit","bowling","karaoke","laser tag","minigolf","parque de atracciones","portaventura","ferrari land","tibidabo"],
  // Recibos DESPUÉS de ocio: «movistar plus» es streaming; el teléfono Movistar, no.
  // Luz/gas/agua se quedan en energia; impuestos en tasas; Sanitas/Adeslas en salud.
  recibos:["vodafone","yoigo","masmovil","mas movil","pepephone","jazztel","finetwork","simyo","lowi","parlem","digi espa","digi mobil","digi mov","movistar","orange es","orange espana","orange spain","orange fibra","orange movil","o2 es","o2 espa","telefonia","telefonica","fibra optica","factura movil","recibo movil","mapfre","allianz","axa ","axa.","pelayo","zurich","genesis seguro","direct seguros","mutua madrilena","linea directa","reale seguro","helvetia","alquiler","comunidad de prop","administracion de finca","adm fincas","cuota comunidad","prosegur","securitas direct"],
  compras:["zara","mango","primark","stradivarius","bershka","pull &","pull&","el corte","amazon","amzn","aliexpress","pccomponentes","mediamarkt","worten","nike","adidas","foot locker","alehop","ale hop","ale-hop","tiger","flying tiger","normal ","tedi","action","casa ","muy mucho","sostrene","søstrene","kiabi","lefties","springfield","cortefiel","jd sports","sprinter","shein","temu","massimo","oysho","cyrillus","calzedonia","intimissimi","clas ohlson","veritas","douglas perfum","cofidis","papeleria","papelería","copisteria","copistería","liberia","libreria","druni","primor","sephora","perfumeria","fnac ","game ","app store","apple store","samsung store","xiaomi store","coolmod","uniqlo","h&m","hm ","pull and bear","bimba y lola","swatch"],
  salud:["farmacia","clinica","clínica","medico","médico","doctor","dra.","dr.","consulta","ambulatorio","urgencias","hospital","optica","óptica","fisio","fisioterapia","masaje","podologo","podólogo","psicologo","psicólogo","psiquiatra","sanitas","adeslas","asisa","dkv","mutua","quiron","quirón","cima","cap ","centro medico","centro médico","laboratorio","analisis","análisis","radiologia","radiología","dentista","dental","ortodoncia","oculista","oftalmo","cruz verde","procare","vitaldent","vital dent","donte","dental company","general optic","multiopticas","multioptics","promofarma","dosfarma","atida","pocoyofarma"],
  pelu:["peluqueria","perruqueria","barberia","barber","estilis","hair","salon de belleza","nails","manicura","pedicura","lash","cejas","estetica","belleza","depilacion","depilación","corte de pelo","tinte pelo","balayage"],
  // Mascotas ANTES que hogar.
  mascotas:["zooplus","kivet","tiendanimal","miscota","animalis","kiwoko","pienso","veterinario","veterinari","clinica veterinaria","clínica veterinaria","peluqueria canina","peluquería canina","petsia","dogfy","affinity pet","royal canin","hills pet","purina","advance dog","advance cat","gos ","gat ","perro","gato","mascota"],
  hogar:["ikea","leroy","bricomart","bauhaus","ferreteria","muebles","sofa","sofá","lampara","lámpara","tintoreria","tintorería","lavanderia","lavandería","mrw","seur","correos","amazon locker","bricodepot","bricodépôt","aki ","aki.","ferretería","manitas","limpieza hogar","limpiapro","blink ","dyson","rowenta","bosch electro","balay","teka"],
  regalos:["regalo","flores","floristeria","floristería","perfumeria","perfumería","interflora","teleflorist","rosas ","ramo "],
  joyeria:["joyeria","joyeros","tiffany","cartier","swarovski","tous ","pandora"],
};
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
    if(needle.length>=4) return hay.indexOf(needle)!==-1;
    let i=0;
    while((i=hay.indexOf(needle,i))!==-1){
      const before=i===0 || /[^a-z0-9]/.test(hay.charAt(i-1));
      const after=i+needle.length>=hay.length || /[^a-z0-9]/.test(hay.charAt(i+needle.length));
      if(before && after) return true;
      i++;
    }
    return false;
  };
  for(const cat in KW){ if(KW[cat].some(function(k){ return hit(c,k); })) return cat; }
  return "otros";
}
function resolveCategory(sheetCat, merchant){
  // "ambas": usa la del Sheet; si falta o es "otros", autodetecta por comercio
  if(sheetCat==="ingreso") return "ingreso";   // no está en CAT (es especial) pero debe respetarse
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
};
const entOf = (id)=> ENT[id] || { label:id, mono:"··", color:"#8FA89A" };

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
/* Entra al banco de pruebas sembrándolo con una copia de lo real (si aún no había copia). Recarga
   la app para que TODO (incluido el arranque) lea ya la clave de pruebas. */
function mcEnterSandbox(seedFrom){
  try{
    if(!store.get(STATE_KEY_TEST)) store.set(STATE_KEY_TEST, seedFrom||store.get(STATE_KEY_REAL)||{});
    localStorage.setItem("_mcSandbox","1");
  }catch(e){}
}
/* Entrar y salir NO cambian el modo de la sesión en curso a propósito (ver mcSandbox): quien las
   llama recarga inmediatamente después, y así lo que quede por volcar se guarda en la clave
   correcta, la de la sesión que se está cerrando. */
function mcExitSandbox(){ try{ localStorage.removeItem("_mcSandbox"); }catch(e){} }
/* Tira la cartera de pruebas y empieza otra desde cero copiando la real otra vez. */
function mcResetSandbox(){ store.del(STATE_KEY_TEST); }

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
      const {data,error}=await sb.from('expenses').select('*').order('fecha',{ascending:false}).limit(2000);
      if(error) throw error;
      return data || [];
    },
    async addExpense(e){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      // source lleva el banco embebido (ob:caixa…) para filtrar en Gastos tras reinstalación
      // sin columna nueva en Supabase (feedback 2026-07-16).
      const base={ user_id:session.user.id, fecha:e.date, importe:e.amount, comercio:e.merchant, cat:e.category, source:expenseSourceForCloud(e), no_card:!!e.noCard };
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
          return sb.from('expenses').upsert(
            fila,
            { onConflict:'user_id,fecha,importe,comercio', ignoreDuplicates:true }
          );
        }
      );
    },
    // Persiste el BANCO elegido de un gasto (va embebido en source: manual:caixabank…) para
    // que sobreviva a reinstalaciones — mismo truco que ob: (2026-07-18).
    async setExpenseBank(e, ent){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const src=expenseSourceForCloud(Object.assign({},e,{ent:ent||undefined}));
      const {error}=await sb.from('expenses').update({ source:src })
        .eq('user_id',session.user.id).eq('fecha',e.date).eq('importe',e.amount).eq('comercio',e.merchant||"");
      if(error) throw error;
    },
    // Persiste el flag 💳/🔄 en la tabla (si no, el siguiente pull lo pisaría en gastos de la nube).
    async setExpenseNoCard(e, noCard){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {error}=await sb.from('expenses').update({ no_card:!!noCard })
        .eq('user_id',session.user.id).eq('fecha',e.date).eq('importe',e.amount).eq('comercio',e.merchant||"");
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
      const {error}=await sb.from('expenses').update({ nota:String(note||"").slice(0,160)||null, nota_edit:true })
        .eq('user_id',session.user.id).eq('fecha',e.date).eq('importe',e.amount).eq('comercio',e.merchant||"");
      if(error){ if(_isMissingNotaCol(error)) _mcNotaCols=false; throw error; }
    },
    // CATEGORÍA en la tabla. Sin esto, `syncCloudExpenses` —que reemplaza los gastos de origen
    // "supabase" con lo que hay en la tabla— pisaba en el siguiente pull cualquier recategorización
    // hecha en el móvil, incluida la que aparta un cashback a «Inversión» (2026-08-04).
    async setExpenseCat(e, cat){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {error}=await sb.from('expenses').update({ cat:String(cat||"otros") })
        .eq('user_id',session.user.id).eq('fecha',e.date).eq('importe',e.amount).eq('comercio',e.merchant||"");
      if(error) throw error;
    },
    async deleteExpense(e){
      if(!sb) return;
      const {data:{session}}=await sb.auth.getSession();
      if(!session) return;
      const {error}=await sb.from('expenses').delete()
        .eq('user_id',session.user.id).eq('fecha',e.date).eq('importe',e.amount).eq('comercio',e.merchant||"");
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
    async bankSyncHistory(dateFrom){
      if(!sb) throw new Error("nube no disponible");
      const {data,error}=await sb.functions.invoke('bank-sync',{ body:{ dateFrom:dateFrom } });
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
      const code=String(inviteCode||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
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
  "pushState","addExpense","setExpenseBank","setExpenseNoCard","setExpenseNote","setExpenseCat","deleteExpense",
  "backupState","bankConnect","bankDisconnect","myinvestorConnect","myinvestorStore",
  "myinvestorDisconnect","setIngestToken","clearIngestToken","logEvent","logUso","logPerf","feedback","betaReport",
  "deleteAccount","createHousehold","joinHousehold","publishHouseholdSnapshot","leaveHousehold",
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
})();

/* Codifica el banco en `source` de la tabla (sin migración SQL): ob:caixa, ob-hist:sabadell,
   macrodroid (= Trade Republic). Así el filtro por banco sobrevive a reinstalaciones. */
function expenseSourceForCloud(e){
  const ent=e&&e.ent; const s=(e&&e.source)||"manual";
  if(ent&&(s==="ob"||String(s).indexOf("ob:")===0)) return "ob:"+ent;
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

/* ---------- Lápidas de gastos borrados ----------
   `state.deleted` guarda claves «fecha|importe|comercio» para que el siguiente pull de la nube no
   resucite un gasto que has borrado. Crecía SIN TOPE y, como `slimForCloud` no lo quita, viajaba
   ENTERO a Supabase en cada guardado (debounce de 1,2 s): con los meses, cada cambio de estado
   subía un array cada vez más gordo. Parte del «cuanto más la uso, más lenta va» (2026-07-24).

   Tope de 500: el borrado de verdad ya se hace también en la tabla (`cloud.deleteExpense`), esto
   es solo la red de seguridad para lo borrado sin conexión, y 500 cubre de sobra la ventana entre
   dos sincronizaciones. */
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
  if(s.indexOf("ob:")===0) return s.slice(3)||null;
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
/* Convierte una fila de la tabla `expenses` al formato interno de la app. */
function expenseFromRow(r){
  const raw=String(r.source||"manual");
  let ent=null, source=raw;
  if(raw==="macrodroid"||raw==="tr"){ ent="trade_republic"; source="macrodroid"; }
  else if(raw.indexOf("ob:")===0){ ent=raw.slice(3)||null; source="ob"; }
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
  };
}

/* Une gastos en la lista local con dedup por clave (fecha|importe|comercio).
   ADITIVO: nunca borra los que ya tenías; solo añade los nuevos. Esto evita perder
   datos durante la migración (la tabla de la nube puede estar aún vacía). */
function mergeExpenses(prevList, incoming){
  const keyOf=function(e){ return String(e.date).slice(0,10)+"|"+e.amount+"|"+(e.merchant||""); };
  const seen={}; const list=[];
  (prevList||[]).forEach(function(e){ const k=keyOf(e); if(!seen[k]){ seen[k]=1; list.push(e); } });
  let nuevos=0;
  (incoming||[]).forEach(function(e){ const k=keyOf(e); if(!seen[k]){ seen[k]=1; list.push(e); nuevos++; } });
  return { list:list, nuevos:nuevos };
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
      rp:{ id: location.hostname, name:"Mi Cartera" },
      user:{ id: new TextEncoder().encode(String(uid||email||"user")), name: email||"usuario", displayName: email||"Mi Cartera" },
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
