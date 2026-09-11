// Lógica pura de ingest (tests + edge function). Mantener alineado con KW en public/index.html.

// Mantener alineado con KW en src/modules/00-core.js (cliente). Orden importa
// (pan/cine antes que bares; padel DESPUÉS de bares; viajes antes que ocio; mascotas/energía antes que hogar).
//
// «bar» va SIN espacio detrás (2026-08-06). Con `"bar "` sólo picaban los nombres que siguen con
// algo («BAR PEPE»), y los que ACABAN en bar —«1331 BAR», «SNACK BAR», «LA BOMBETA BAR»— caían en
// «otros»; «SPORTS BAR» era aún peor, se iba a ocio por "sport". Es el bar de su padre. Sin
// espacio son 3 letras, así que entra por el camino de `hit()` con límite de palabra, que es
// justo el que evita que «Barcelona» acabe en bares (bug Kinepolis 2026-07-17).
export const CATEGORIAS: Record<string, string[]> = {
  pan:        ["panaderia","pasteleria","pastisseria","fleca","forn de pa","forn ","obrador","croissant","boulangerie","bakery","granier","santagloria","santa gloria","panificadora","brioche","horno de pan","horno artesano","panaria","el forn","viena ","entpan","panetteria"],
  cine:       ["cinema","cine","cinesa","yelmo","kinepolis","odeon","mk2","renoir","multicines","entradas.com","atrapalo","ticketmaster","imax","cinemes","filmotech"],
  heladeria:  ["heladeria","gelateria","ice cream","llaollao","llao llao","ocool","frosti","haagen","ben & jerry","ben and jerry","grom ","amorino"],
  bares:      ["restaurante","bar","cafe","cafeteria","mcdonald","burger","pizza","sushi","tapas","cerveceria","bodega","bocadillo","kebab","pollo","grill","braseria","taberna","comida","food","lunch","dinner","brunch","desayuno","telepizza","glovo","just eat","uber eats","kfc","five guys","fiveguys","goiko","tgb","taco bell","tacobell","domino","papa john","subway","starbucks","vips","foster","montadito","rodilla","pans &","pans ","wok ","ramen","poke","taco","churreria","churros","asador","brasa","marisqueria","mariscos","pub ","shawarma","doner","döner","nandos","popeyes","dunkin","donut","tim hortons","cien montaditos","la sureña","sureña","muerde la pasta","ginos","la tagliatella","tagliatella","udon","wagamama","honest greens","croqueteria","tortilleria","gastrobar","vermuteria","coctel","cocktail","vending","expendedor","deliveroo","too good to go","toogoodtogo","mcdonalds","burger king","hamburgues","cervecer","cerveseria","fosters hollywood","100 montaditos","comida a domicilio"],
  padel:      ["padel","pádel","playtomic","paddle","club de padel","club padel","pista padel","padel pro","world padel","premier padel","indoor padel"],
  super:      ["mercadona","lidl","aldi","carrefour","dia","bonpreu","bon preu","consum","eroski","spar","alcampo","simply","supermercado","market","fresco","verduleria","fruteria","hipercor","caprabo","condis","ahorramas","gadis","froiz","bm supermarket","family cash","supeco","costco","makro","amazon fresh","glovo market"],
  viajes:     ["booking","airbnb","hotel","hostal","hostel","apartament turistic","apartamento turistico","vueling","iberia","ryanair","easyjet","vuelos","vuelo ","aeropuerto","airport","expedia","trivago","kayak","edreams","rumbo","logitravel","civitatis","getyourguide","marriott","hilton","ibis ","nh hotel","melia","barcelo","ac hotel","travelodge","camping","ferry","balearia","crucero","cruise","turismo"],
  transporte: ["renfe","fgc","tmb","metro","autobus","bus ","taxi","cabify","uber","gasolina","repsol","cepsa","shell","bp ","galp","autopista","peaje","tram","bicing","blablacar","flixbus","moove","bolt","ouigo","iryo","avlo","rodalies","emt ","alsa","avanza","ok mobility","sixt","hertz","europcar","ballenoil","carburante","gasoleo","diesel","recarga electr","free now","freenow"],
  parking:    ["parking","parquimetro","parkimetro","parquímetro","aparcament","aparcamiento","saba","b:sm","bsm","empark","interparking","apk2","apk80","onepark","elparking","easypark","telpark","zona azul","zona verde","area verde","àrea verda","grua municipal","indigo parking"],
  energia:    ["endesa","iberdrola","naturgy","repsol luz","holaluz","octopus energy","octopus ","totalenergies","factor energia","lucera","pepeenergy","gas natural","canal de isabel","aigues de barcelona","aigües de barcelona","agbar","aqualia","sorea","factura luz","factura gas","factura agua","suministro electric"],
  tasas:      ["gencat","generalitat","atc ","agencia tributaria","aeat","ajuntament","ayuntamiento","diputacio","diputación","dgt","multa","multa transit","sancion","sanción","tribut","impost","impuesto","tax agency","taxes","ibi","ivtm","basura","residus","residuos","canon agua","canon de l'aigua","tasa","taxa","registro mercantil","registro civil","notaria","notaría","gestoria","gestoría","procurador","abogado","lexnet","catastro","seguretat social","seguridad social","tgss","recaudacion","recaudación","zona bajas emisiones","zbe","hacienda","hisenda"],
  educacion:  ["universidad","universitat","uab ","upc ","upf ","ub ","uoc ","uned","campus","matricula","matrícula","academia","curso ","cursos","formacion","formación","master ","máster","mba ","udemy","coursera","domestika","linkedin learning","skillshare","colegio","escola","guarderia","guardería","autoescuela","autoescola","british council","openenglish"],
  gaming:     ["steam","instant gaming","instantgaming","instant-gaming","g2a","eneba","cdkeys","humble bundle","epic games","battle.net","vs gamers","versus gamers","playstation store","xbox store","nintendo eshop","nintendo e-shop"],
  ia:         ["anthropic","claude","claude.ai","openai","chatgpt","chat gpt","gpt-","cursor","midjourney","perplexity","github copilot"],
  ocio:       ["spotify","netflix","hbo","disney","playstation","xbox","nintendo","fnac","museo","teatro","concierto","decathlon","gym","gimnasio","sport","bolera","google one","google play","icloud","apple.com","youtube premium","prime video","amazon prime","twitch","crunchyroll","dazn","filmin","movistar plus","audible","deezer","tidal","dropbox","notion","canva","duolingo","atraccion","atracción","parque tematico","zoologic","zoológico","aquarium","aquari","escape room","ocio","basic fit","synergym","crossfit","portaventura","tibidabo"],
  // Recibos DESPUÉS de ocio: «movistar plus» es streaming; el teléfono Movistar, no.
  recibos:    ["vodafone","yoigo","masmovil","mas movil","pepephone","jazztel","finetwork","simyo","lowi","parlem","digi espa","digi mobil","digi mov","movistar","orange es","orange espana","orange spain","orange fibra","orange movil","o2 es","o2 espa","telefonia","telefonica","fibra optica","factura movil","recibo movil","mapfre","allianz","axa ","axa.","pelayo","zurich","genesis seguro","direct seguros","mutua madrilena","linea directa","reale seguro","helvetia","alquiler","comunidad de prop","administracion de finca","adm fincas","cuota comunidad","prosegur","securitas direct"],
  compras:    ["zara","mango","primark","stradivarius","bershka","pull &","el corte","amazon","amzn","aliexpress","pccomponentes","mediamarkt","worten","nike","adidas","foot locker","alehop","tiger","flying tiger","normal ","tedi","action","muy mucho","sostrene","kiabi","lefties","springfield","cortefiel","jd sports","sprinter","shein","temu","massimo","oysho","calzedonia","intimissimi","clas ohlson","veritas","douglas perfum","cofidis","papeleria","papelería","copisteria","libreria","druni","primor","sephora","perfumeria","uniqlo","h&m","bimba y lola"],
  salud:      ["farmacia","fcia","clinica","medico","dentista","hospital","optica","fisio","masaje","sanitas","adeslas","asisa","dkv","mutua","quiron","vitaldent","promofarma","dosfarma","laboratorio","analisis","urgencias"],
  pelu:       ["peluqueria","perruqueria","barberia","barber","estilis","hair","salon de belleza","nails","manicura","pedicura","lash","cejas","estetica","belleza","depilacion"],
  mascotas:   ["zooplus","kivet","tiendanimal","miscota","animalis","kiwoko","pienso","veterinario","veterinari","clinica veterinaria","peluqueria canina","royal canin","purina","mascota"],
  hogar:      ["ikea","leroy","bricomart","bauhaus","ferreteria","muebles","sofa","lampara","tintoreria","tintorería","lavanderia","lavandería","mrw","seur","correos","amazon locker","bricodepot","aki "],
  regalos:    ["regalo","flores","floristeria","perfumeria","sephora","douglas","interflora"],
  joyeria:    ["joyeria","joyeros","tiffany","cartier","swarovski","tous ","pandora"],
  bizum:      ["bizum","bizum a ","bizum de ","envio bizum","envío bizum","pago bizum"],
};

/* PALABRAS QUE SOLO VALEN ENTERAS. Espejo EXACTO de `KW_PALABRA` en `src/modules/00-core.js`;
   el guardián `categorias-dual` exige que las dos digan lo mismo. «barcelo» es la cadena de
   hoteles Barceló y casaba dentro de BARCELONA: «Aigües de Barcelona» salía como viaje, y él vive
   ahí. Medido con sus gastos reales de septiembre (2026-09-11). */
const KW_PALABRA: Record<string, number> = {
  "barcelo": 1,   // la cadena Barceló ⊂ BARCELONA
  "saba": 1,      // SABA aparcamientos ⊂ SABADELL — «Transferencia a banco Sabadell» → parking
  "zara": 1,      // Zara ⊂ ZARAGOZA
  "hospital": 1,  // hospital ⊂ HOSPITALET
};

export function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Dónde EMPIEZA el nombre del comercio dentro del texto de la noti: justo detrás del « en » de la
 * frase («Has gastado 12,50 € en Mercadona»). Con `\b` delante para que no lo dispare el final de
 * OTRA palabra — sin él, «Orden ejecutada en Apple» partía por el «en» de «ordEN» y el comercio
 * salía siendo «ejecutada en Apple».
 */
const TRAS_EN = /\ben\s+(.+)$/i;

/**
 * Deja el texto de la noti en condiciones de guardarse (2026-08-06).
 *
 * El nombre que manda la red de tarjetas sale del datáfono y NO siempre es texto limpio: llega
 * con basura de codificación en medio. En una compra real de Splau el comercio venía como
 * «10638 CORNELLAÂ▯ SPLAU SC» — una «Â» y un carácter invisible donde iba la «à» de Cornellà.
 * Eso ensucia el histórico, y si el carácter que cuela es un NUL (`\u0000`) **Postgres rechaza el
 * INSERT entero**: el gasto no se apunta y lo único que queda es un error en el panel de admin.
 *
 * Fuera, pues: controles C0/C1, marcas de dirección y anchos-cero, y los espacios repetidos que
 * dejan al quitarlos.
 */
export function limpiarTexto(s: string): string {
  // MOJIBAKE (bytes reales de su móvil, `dumpsys notification --noredact`, 2026-08-06): el título
  // era `10638 CORNELLA` + U+00C2 + U+009F + ` SPLAU SC`. Es UTF-8 (C2 9F) leído como Latin-1, o
  // sea UN carácter partido en dos. Quitando solo el control quedaba «CORNELLAÂ SPLAU SC», con la
  // Â huérfana en mitad del nombre y para siempre en el histórico: la pareja se sustituye ENTERA
  // por UN ESPACIO, no por nada: cuando lo partido era un espacio duro (C2 A0) quitarlo del todo
  // pegaba las palabras («CAFEÂ CENTRAL» → «CAFECENTRAL»). Rango 0x80-0xA0 = lo que deja C2 xx.
  return String(s || "")
    .replace(/Â./g, (m) => { const c = m.codePointAt(1) || 0; return c >= 0x80 && c <= 0xa0 ? " " : m; })
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAtmWithdrawal(comercio: string): boolean {
  const c = norm(comercio);
  if (!c) return false;
  if (c.includes("cajero")) return true;
  if (c.includes("cash withdrawal") || c.includes("cashwithdrawal")) return true;
  if (c.includes("retirada de efectivo")) return true;
  if (c.includes("reintegro")) return true;
  if (c.includes("retrait") && c.includes("espece")) return true;
  if (/\batm\b/.test(c)) return true;
  return false;
}
export function categorizar(comercio: string): string {
  const c = norm(comercio);
  if (isAtmWithdrawal(comercio)) return "traspaso";
  // Keywords cortas con límite de palabra (mismo criterio que el cliente: «bar» ≠ Barcelona).
  // Y las de KW_PALABRA, que pasan por el mismo camino aunque sean largas: «barcelo» es la cadena
  // de hoteles Barceló y casaba dentro de BARCELONA, así que «Aigües de Barcelona» salía como
  // viaje. Medido con sus gastos de septiembre. ⚠ La lista es la MISMA que en `00-core.js`, y el
  // guardián `categorias-dual` exige que digan lo mismo.
  const hit = (hay: string, needle: string) => {
    if (needle.length >= 4 && !KW_PALABRA[needle]) return hay.includes(needle);
    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      const before = i === 0 || /[^a-z0-9]/.test(hay.charAt(i - 1));
      const after = i + needle.length >= hay.length || /[^a-z0-9]/.test(hay.charAt(i + needle.length));
      if (before && after) return true;
      i++;
    }
    return false;
  };
  for (const [cat, kws] of Object.entries(CATEGORIAS)) {
    for (const kw of kws) if (hit(c, kw)) return cat;
  }
  return "otros";
}

export type Tipo = "gasto" | "gasto_nocard" | "ingreso" | "ignorado";

/**
 * De qué app venía la notificación. Cambia DÓNDE se puede buscar, no solo cómo se parsea.
 *
 * · "tr"     → Trade Republic. El título es siempre «Trade Republic» y todo va en la frase
 *              («Has gastado 12,50 € en Mercadona»).
 * · "wallet" → Google Wallet. **El título ES el nombre del comercio** y el importe va en el texto
 *              («10638 CORNELLA SPLAU SC» / «76,08 € con Trade Republic Visa Card ••9116»).
 */
export type Fuente = "tr" | "wallet";

export function clasificar(texto: string, titulo: string, fuente: Fuente = "tr"): Tipo {
  /* EN WALLET EL TÍTULO NO SE ESCANEA (2026-08-06).
     El 6/8 se arregló que el ruido de TR no se buscara en el nombre del comercio, porque «BAR STOP»
     picaba en "stop" y el gasto se tiraba en silencio. Ese arreglo saca el comercio del TEXTO, de
     detrás del « en ». Pero en Wallet el comercio va en el TÍTULO, así que el mismo bug volvería
     entero por la otra puerta: un «BAR STOP» o un «CÓDIGO BCN» en el título de Wallet se
     descartaría como ruido. Con `wallet` el título se deja fuera de las dos búsquedas. */
  const escaneable = fuente === "wallet" ? "" : titulo;
  const t = norm(escaneable + " " + texto);
  const IGNORAR = [
    "interes", "dividendo", "rendimiento", "rentabilidad",
    "saveback", "redondeo", "round up", "roundup", "round-up",
    "plan de inversion", "inversion programada", "aporte periodico", "savings plan", "saving plan",
    "has invertido", "hemos invertido", "se ha invertido", "invertido",
    "orden de compra", "orden de venta", "orden ejecutada", "ejecutado", "ejecutada", "limit", "stop",
    "deposito", "has anadido", "anadido dinero", "ingresado en tu cuenta", "recarga", "top up", "top-up",
    "alerta de precio", "precio objetivo", "cotizacion",
    "inicio de sesion", "codigo", "seguridad", "dispositivo",
    "confirma", "confirmar", "autoriza", "autorizacion", "aprueba", "aprobacion",
    "verifica el pago", "verificacion", "3d secure", "3ds", "pendiente de confirmacion",
  ];
  /* EL RUIDO SE BUSCA EN LA FRASE, NUNCA EN EL NOMBRE DEL COMERCIO (bug 2026-08-06).
     Antes esta lista se pasaba por el texto ENTERO con `includes`, sin límite de palabra, así que
     cualquier tienda que llevara una de estas palabras dentro se tiraba a la basura EN SILENCIO:
     un «BAR STOP» pica en "stop", «EL LÍMITE» en "limit", «BAR EL DEPÓSITO» en "deposito",
     «CÓDIGO BCN» en "codigo"… Es el gasto del bar que a su padre no le entraba NUNCA, y sin
     rastro que seguir: un `ignorado` ni se guarda, ni avisa, ni deja error en el panel.
     Poner límite de palabra no arregla nada —"stop" en «BAR STOP» ya es palabra entera—: lo que
     falla es DÓNDE se mira. Lo que TR describe (intereses, dividendo, round-up, 3DS, orden
     ejecutada…) va SIEMPRE en la frase; el nombre del comercio es dato del datáfono, no
     descripción. Así que se mira la frase y se deja fuera lo que va detrás del « en ». */
  const frase = norm(escaneable + " " + limpiarTexto(texto).replace(TRAS_EN, "en"));
  if (IGNORAR.some((k) => frase.includes(k))) return "ignorado";
  const esBizum  = t.includes("bizum");
  const recibido = /(has recibido|recibido|recibiste|te ha enviado|te envio|te ha hecho|has rebut|t'ha enviat|received|sent you)/.test(t);
  const enviado  = /(has enviado|enviaste|le has enviado|has hecho un bizum|has fet un bizum|you sent|enviado a)/.test(t);
  if (esBizum) {
    if (enviado) return "gasto_nocard";
    if (recibido) return "ingreso";
    return "ignorado";
  }
  if (recibido || t.includes("transferencia")) return "ignorado";
  return "gasto";
}

export function extraerImporte(texto: string): number {
  const m1 = (texto || "").match(/(\d+(?:\.\d{3})*[.,]\d+)\s*€/);
  if (m1) return parseFloat(m1[1].replace(/\.(?=\d{3})/g, "").replace(",", "."));
  const m2 = (texto || "").match(/(\d+[.,]\d+)/);
  if (m2) return parseFloat(m2[1].replace(",", "."));
  return 0;
}

export function extraerComercio(texto: string, titulo: string): string {
  const m = limpiarTexto(texto).match(TRAS_EN);
  // `limpiarTexto` también en el título: es el otro sitio de donde sale el nombre del comercio,
  // y viene igual de sucio (es el mismo dato del datáfono).
  return (m ? limpiarTexto(m[1]) : limpiarTexto(titulo)) || "Desconocido";
}

export function extraerPersona(texto: string, prep: "de" | "a"): string {
  const re = new RegExp("\\b" + prep + "\\s+([^.\\d€]+?)\\s*(?:por\\s+bizum)?\\s*[.!]?$", "i");
  const m = limpiarTexto(texto).match(re);
  return m ? limpiarTexto(m[1]) : "";
}

/**
 * CONCEPTO del movimiento a partir del texto de la notificación (petición 2026-07-24).
 *
 * En el histórico solo se veía «Bizum de María» y había que abrir la app del banco para saber de
 * qué era. El mensaje del bizum SÍ viaja en la noti — normalmente entre comillas o tras un
 * «concepto:» / «motivo:» — pero se descartaba junto con el resto del texto.
 *
 * Devuelve "" cuando no hay nada que valga la pena enseñar (mejor un hueco que ruido: regla de la
 * casa — si no lo sabes, no te lo inventes).
 */
export function extraerConcepto(texto: string, titulo = ""): string {
  const raw = limpiarTexto(texto);
  if (!raw) return "";

  // 1) «concepto: X» / «motivo: X» / «mensaje: X» — lo más explícito, gana siempre.
  const etiqueta = raw.match(/\b(?:concepto|motivo|mensaje|asunto|descripci[oó]n)\s*:\s*(.+?)\s*$/i);
  if (etiqueta) return limpiarConcepto(etiqueta[1]);

  // 2) Entrecomillado: «cena del sábado», "alquiler julio", 'gasolina'.
  const comillas = raw.match(/[«"“']([^»"”']{2,120})[»"”']/);
  if (comillas) return limpiarConcepto(comillas[1]);

  // 3) Bizum sin marca explícita: lo que va detrás de «por» al final de la frase
  //    («Has recibido 20 € de María por la cena»). Ojo: «por Bizum» NO es un concepto.
  const porAlFinal = raw.match(/\bpor\s+(?!bizum\b)([^.!?]{3,120})[.!?]?\s*$/i);
  if (porAlFinal) return limpiarConcepto(porAlFinal[1]);

  return "";
}

function limpiarConcepto(s: string): string {
  const out = limpiarTexto(s)
    .replace(/^[\s:,;.\-–—]+|[\s:,;.\-–—]+$/g, "")
    .trim();
  // Coletillas que no aportan nada (son el «cómo», no el «qué»).
  if (/^(bizum|transferencia|tarjeta|movimiento)$/i.test(out)) return "";
  return out.slice(0, 160);
}
