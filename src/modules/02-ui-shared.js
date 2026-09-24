/* ============================================================
   ICONOS
   ============================================================ */
const I = {
  // v4 nav: casa / lista / calendario / tendencia (stroke 2.1, ~22 px)
  home:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("path",{d:"M3 10.5L12 3l9 7.5"}),React.createElement("path",{d:"M5 10v10h14V10"}),React.createElement("path",{d:"M10 20v-6h4v6"})),
  calendar:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("rect",{x:3,y:5,width:18,height:16,rx:2}),React.createElement("path",{d:"M3 10h18M8 3v4M16 3v4"})),
  dash:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 17v4h8v-4z"})),
  expense:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("path",{d:"M3 7h18M3 12h18M3 17h12"})),
  invest:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("path",{d:"M3 17l6-6 4 4 7-8M21 7v6M21 7h-6"})),
  wealth:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M4 21h16M5 21V9l7-5 7 5v12M9 21v-6h6v6"})),
  debt:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("circle",{cx:"12",cy:"12",r:"9"}),React.createElement("path",{d:"M9 9.5a3 3 0 0 1 5.5 1.2c0 2-3 2.3-3 4M12 17h.01"})),
  fixed:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M17 2l4 4-4 4"}),React.createElement("path",{d:"M3 11V9a4 4 0 0 1 4-4h14"}),React.createElement("path",{d:"M7 22l-4-4 4-4"}),React.createElement("path",{d:"M21 13v2a4 4 0 0 1-4 4H3"})),
  sync:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4"})),
  plus:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.4"},p),React.createElement("path",{d:"M12 5v14M5 12h14"})),
  chev:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.4",width:"18",height:"18"},p),React.createElement("path",{d:"M6 9l6 6 6-6"})),
  up:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.6",width:"13",height:"13"},p),React.createElement("path",{d:"M12 19V5M5 12l7-7 7 7"})),
  down:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.6",width:"13",height:"13"},p),React.createElement("path",{d:"M12 5v14M5 12l7 7 7-7"})),
  /* A-DOT BADGE — el logo de Aely (brief), rehecho el 10/9 contra la referencia de verdad.
     La primera versión era una A de trazo fino nadando en un marco vacío y él la despachó en dos
     palabras: «esto es un mierdón, la foto original es la chula». Tenía razón, y la diferencia se
     ve en tres cosas concretas:
       · la A es MACIZA y llena el badge de arriba abajo — no un trazo de 4 px, dos patas anchas
         que se estrechan hacia el vértice;
       · el badge lleva borde FINO y brillante, no un marco gordo;
       · las dos cosas van con glow, que es lo que le da el aire premium de la referencia.
     Se dibuja con `path` relleno (no `stroke`) para poder engordar las patas sin que el vértice
     se redondee como una gota. El punto va entre las patas, más abajo del centro, donde estaría
     el travesaño de la A. */
  logo:(p)=>{
    const id="aelyGlow"+(I._n=(I._n||0)+1);
    return React.createElement("svg",Object.assign({viewBox:"0 0 64 64",fill:"none","aria-hidden":"true"},p),
      React.createElement("defs",null,
        React.createElement("filter",{id:id,x:"-30%",y:"-30%",width:"160%",height:"160%"},
          // Glow CONTENIDO: con 1,8 quedaba un neón borroso y el original lo tiene mucho más
          // ceñido al trazo. Comparado lado a lado contra `logo Aely.png`.
          React.createElement("feGaussianBlur",{stdDeviation:"0.7",result:"b"}),
          React.createElement("feMerge",null,
            React.createElement("feMergeNode",{in:"b"}),
            React.createElement("feMergeNode",{in:"SourceGraphic"})))),
      React.createElement("g",{filter:"url(#"+id+")"},
        /* El badge llega al BORDE del lienzo: «el logo debe acabar en las rayas exteriores
           verdes» (él, 10/9). Antes sobraba marco muerto alrededor y el icono se veía pequeño
           dentro de su propia caja. */
        React.createElement("rect",{x:0.8,y:0.8,width:62.4,height:62.4,rx:14.2,stroke:"currentColor",strokeWidth:1.6}),
        /* La A es HUECA — un contorno de Λ, no una cuña maciza.
           ⚠ Estas coordenadas NO están estimadas a ojo: están MEDIDAS sobre `logo Aely.png`, el
           original que él tenía en Pictures. Mis dos primeros intentos los dibujé mirando una
           captura y salieron «un mierdón» y «un horror», con razón las dos veces. Escala: el badge
           del original ocupa 473 px y aquí son 64 unidades (×0,1353).
           ⚠ El `stroke` va FINO a propósito: con 2,4 el propio trazo cerraba el hueco cerca del
           vértice y la A salía maciza — un triángulo con una muesca, no una A. Sirve solo para
           redondear vértice y bases, que en el original van romos. */
        React.createElement("path",{d:"M31.8 11.5 L55.9 54.1 L46.7 54.1 L31.8 25.3 L16.9 54.1 L7.7 54.1 Z",
          fill:"currentColor",stroke:"currentColor",strokeWidth:1.4,strokeLinejoin:"round",strokeLinecap:"round"}),
        // El punto vive DENTRO del hueco, donde iría el travesaño. Casi rozando las patas.
        React.createElement("circle",{cx:31.8,cy:43.7,r:5.1,fill:"currentColor"})));
  },
  cloud:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 9.2 4 4 0 0 0 6.5 19z"})),
  cloudOff:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M17.5 19a4.5 4.5 0 0 0 1.9-8.58M9 5.2A6 6 0 0 1 18 9.2M6.5 19a4 4 0 0 1-.3-7.8"}),React.createElement("path",{d:"M3 3l18 18"})),
  gear:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2"},p),React.createElement("circle",{cx:12,cy:12,r:3}),React.createElement("path",{d:"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.05a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.05a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"})),
  goal:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("circle",{cx:12,cy:12,r:9}),React.createElement("circle",{cx:12,cy:12,r:5}),React.createElement("circle",{cx:12,cy:12,r:1.5,fill:"currentColor"})),
  share:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("circle",{cx:18,cy:5,r:3}),React.createElement("circle",{cx:6,cy:12,r:3}),React.createElement("circle",{cx:18,cy:19,r:3}),React.createElement("path",{d:"M8.6 10.6l6.8-4M8.6 13.4l6.8 4"})),
  medal:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M8 3l3 6M16 3l-3 6"}),React.createElement("circle",{cx:12,cy:15,r:6})),
};

/* ============================================================
   COMPONENTES REUTILIZABLES
   ============================================================ */
/* LOGOS DE BANCO — el PNG OFICIAL recortado, no un dibujo (2026-09-11).
   Se intentaron dibujar CUATRO veces (iniciales, formas a ojo, trazos de una captura del
   launcher, y otra ronda) y su veredicto siempre fue el mismo: «no son los logos», «parecen
   logos de aliexpress». Y tenía razón: con `<text>` de la fuente del sistema y curvas a mano
   sale una imitación, nunca el logotipo. Ahora se recorta el isotipo del original de Enable
   Banking — la misma fuente por la que la app conecta con sus bancos y que ya se enseña en el
   selector. Los genera `scripts/logos-bancos.mjs` en `public/logos/`; van FUERA del bundle
   porque el gzip está al 99 % (326/330 KB).
   Si el PNG no carga (primer arranque sin red, banco nuevo), cae al monograma de siempre. */
const BANCOS_CON_LOGO={sabadell:1,revolut:1,trade_republic:1,myinvestor:1,caixabank:1};
/* EL EFECTIVO NO ES UN BANCO, así que no hay PNG oficial que recortar: se dibuja, igual que el
   lingote del oro. Suyo, 11/9: «ponerle un logo de un billete o algo que se te ocurra, porque lo
   del euro con la cartilla marrón bastante cutre, algo como lo que hiciste para el oro que molo
   muchísimo». Mismo criterio que allí: geometría plana y dos degradados, que a 38 px es lo único
   que se lee. Un billete con su moneda delante — distinto de un vistazo de cualquier logo de
   banco, que es de lo que se trata. */
const ENTS_DIBUJADAS={efectivo:"efectivo.svg"};
function Mono({ent, size, logo}){
  const e=entOf(ent); size=size||40;
  const id=String(ent||"");
  const [roto,setRoto]=React.useState(false);
  /* `logo:false` = el monograma de colores de siempre.
     LA REGLA, que me costó dos rondas (11/9): **si la fila es un BANCO, el logo del banco; si es
     una EMPRESA, `LogoInv`**. La primera vez puse el logo a todo y las posiciones de un bróker
     salían todas con el mismo icono de banco («te cargaste los iconos de las inversiones de las
     empresas»); al arreglarlo me pasé de frenada y lo apagué también en las filas que agrupan POR
     BRÓKER, que sí son bancos — y lo cazó: «no puede ser que salgan bien los logos de las cuentas,
     que salgan los de las empresas, pero no los bancos donde están las inversiones».
     Hoy `logo:false` no lo usa nadie; se deja porque una fila puede no ser ninguna de las dos.
     Va DESPUÉS del useState a propósito: un hook no puede quedarse detrás de un return. */
  if(logo===false) return React.createElement("div",{className:"mono",style:{width:size,height:size,background:e.color+"22",color:e.color,borderColor:e.color+"44"}}, e.mono);
  if((BANCOS_CON_LOGO[id]||ENTS_DIBUJADAS[id]) && !roto){
    const dib=ENTS_DIBUJADAS[id];
    /* El dibujado se enseña más pequeño dentro del cuadro (0,66), como los de Inversiones: un
       PNG recortado ya trae su propio aire y un SVG dibujado no, así que a tamaño completo se
       veía gigante. Ese 0,66 está medido, no puesto a ojo ([[logos-bancos-recortar-no-dibujar]]). */
    const lado=dib?Math.round(size*0.66):size;
    return React.createElement("div",{className:"mono mono-logo",title:e.label,"aria-label":e.label,
      style:{width:size,height:size,background:"#fff",display:"grid",placeItems:"center",
        borderRadius:Math.round(size*0.275),flex:"0 0 auto",border:"1px solid transparent",overflow:"hidden"}},
      React.createElement("img",{src:"logos/"+(dib||(id+".png")),alt:"",width:lado,height:lado,loading:"lazy",
        decoding:"async",onError:function(){ setRoto(true); },
        style:{width:lado,height:lado,objectFit:"contain",display:"block"}}));
  }
  return React.createElement("div",{className:"mono",style:{width:size,height:size,background:e.color+"22",color:e.color,borderColor:e.color+"44"}}, e.mono);
}

/* LOGO DE UNA INVERSIÓN — la EMPRESA, no el banco que la custodia (2026-09-11).
   Pidió ver NVIDIA, Alphabet, Broadcom, Meta… con su logo, como los ve en Revolut y en Trade
   Republic. Eligió la opción C: los que se puedan, guardados en la app; el resto con su
   monograma y el color de la marca — un monograma correcto es mejor que un logo equivocado.
   Quién es quién lo decide `marcaDeInversion` (00-core.js), que es la ÚNICA copia de esa regla:
   `scripts/logos-inversiones.mjs` la carga de ahí para generar los SVG y para su guardián.
   Si el SVG no carga, cae al monograma de siempre. */
function LogoInv({nombre, ent, size, kind}){
  size=size||38;
  /* El hook va SIEMPRE y ANTES de cualquier return: no puede quedarse detrás de una condición. */
  const [roto,setRoto]=React.useState(false);
  const slug=(typeof marcaDeInversion==="function") ? marcaDeInversion(nombre, kind) : null;
  if(slug && !roto){
    return React.createElement("div",{className:"mono mono-logo",title:nombre||"","aria-label":nombre||"",
      style:{width:size,height:size,background:"#fff",display:"grid",placeItems:"center",
        borderRadius:Math.round(size*0.275),flex:"0 0 auto",border:"1px solid transparent",overflow:"hidden"}},
      React.createElement("img",{src:"logos/inv/"+slug+".svg",alt:"",width:size,height:size,
        loading:"lazy",decoding:"async",onError:function(){ setRoto(true); },
        style:{width:Math.round(size*0.62),height:Math.round(size*0.62),objectFit:"contain",display:"block"}}));
  }
  /* Sin icono: las iniciales DEL ACTIVO, no la insignia del bróker. Antes caía a `Mono`, así que
     TSM, MU, el oro y los dos fondos salían TODOS como «Rv», «TR» o «MI» — cinco filas distintas
     con la misma marca del custodio, que es justo lo que él llamó cutre (11/9). La fila es un
     activo: enseña lo que ES, no dónde está guardado. */
  const trozos=String(nombre||"").replace(/[^\p{L}\p{N} ]+/gu," ").trim().split(/\s+/).filter(Boolean);
  /* Una sola palabra = un ticker («TSM», «MU»): se enseña ENTERO, que es como lo llama el bróker.
     Con la primera letra de cada palabra salían «T» y «M», que no dicen nada. */
  const ini=(trozos.length===1
    ? trozos[0].slice(0,4)
    : trozos.slice(0,2).map(function(w){ return w[0]; }).join("")).toUpperCase() || "··";
  return React.createElement("div",{className:"mono",title:nombre||"","aria-label":nombre||"",
    style:{width:size,height:size,borderRadius:Math.round(size*0.275),flex:"0 0 auto",
      display:"grid",placeItems:"center",background:"var(--sur2)",color:"var(--muted)",
      border:"1px solid var(--line-soft)",fontWeight:800,
      fontSize:Math.max(10,Math.round(size*0.32)),letterSpacing:"-0.02em"}}, ini);
}
/* Ayuda contextual: un «?» discreto que explica la tarjeta en cristiano (para no-técnicos). */
function HelpTip({text}){
  const [open,setOpen]=useState(false);
  // El overlay va en un PORTAL a <body>: dentro del track de páginas hay un transform
  // permanente (translateX) que convierte al track en el contenedor de position:fixed,
  // así que sin portal la tarjeta de ayuda aparecía encima de OTRA pestaña (Resumen).
  return React.createElement(React.Fragment,null,
    React.createElement("button",{className:"helpq",onClick:function(e){ e.stopPropagation(); setOpen(true); },"aria-label":"?"},"?"),
    open && ReactDOM.createPortal(
      React.createElement("div",{className:"helpover",onClick:function(e){ e.stopPropagation(); setOpen(false); }},
        React.createElement("div",{className:"helpcard",onClick:function(e){ e.stopPropagation(); }},
          React.createElement("div",{style:{fontSize:14,lineHeight:1.55}},text),
          React.createElement("button",{className:"btn btn-primary btn-block",style:{marginTop:14},onClick:function(){ setOpen(false); }},t("h_ok"))
        )
      ), document.body)
  );
}

/* ============================================================
   INFORME DEL MES — imagen 1080×1350 (para compartir por WhatsApp/IG) con los
   colores del tema activo. Todo en el dispositivo (canvas → share/descarga).
   ============================================================ */
function shareMonthReport(state, tt, showToast, opt){
  try{
    opt=opt||{};
    // Paleta FIJA por tema (mismos hex que el CSS). No se lee getComputedStyle: en algunos
    // móviles el "modo oscuro automático" del navegador reescribe/oscurece las variables CSS
    // y el informe salía con textos negros ilegibles. Así los colores son deterministas.
    const PAL={
      green:{ bg:"#0B1410", surface:"#122319", line:"#1f3a2c", text:"#E8F0EA", muted:"#8FA89A", mint:"#5FD08A", coral:"#E2705F" },
      dark: { bg:"#0A0A0C", surface:"#17171B", line:"#2B2B32", text:"#ECECEF", muted:"#9A9AA4", mint:"#5FD08A", coral:"#E2705F" },
      light:{ bg:"#F3F6F3", surface:"#FFFFFF", line:"#DCE4DD", text:"#15201A", muted:"#566A5E", mint:"#2FA866", coral:"#D2563F" },
      blue: { bg:"#0A1320", surface:"#13243B", line:"#213D5C", text:"#E6EEF8", muted:"#93A8C2", mint:"#5FD08A", coral:"#E2705F" },
      cyber:{ bg:"#0A0612", surface:"#150D26", line:"#33235A", text:"#F4F0FF", muted:"#B9ACDC", mint:"#39F5A0", coral:"#FF4D7D" }
    };
    const P=PAL[(state.settings&&state.settings.theme)||"green"]||PAL.green;
    const mint=P.mint, text=P.text, muted=P.muted, surface=P.surface, line=P.line, coral=P.coral, bg=P.bg;
    const W=1080,H=1350;
    const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
    const g=cv.getContext("2d");
    const round=function(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
    g.fillStyle=bg; g.fillRect(0,0,W,H);
    const grad=g.createLinearGradient(0,0,0,H*0.5); grad.addColorStop(0,"rgba(95,208,138,.14)"); grad.addColorStop(1,"rgba(0,0,0,0)");
    g.fillStyle=grad; g.fillRect(0,0,W,H*0.5);
    g.textBaseline="top";
    // Mes del informe: opt (mes cerrado) o el mes en curso. Nombre de fichero igual.
    const winStart=opt.startMs!=null?opt.startMs:inicioDeMesMs(opt.nowMs!=null?opt.nowMs:Date.now());
    const winEnd=opt.endMs!=null?opt.endMs:null;
    const labelParts=typeof madridYmdParts==="function"?madridYmdParts(winStart+5*864e5):null;
    const mesRaw=opt.ym
      ? (monthLong((labelParts?labelParts.m:1)-1)+" "+(labelParts?labelParts.y:""))
      : (monthLong(new Date().getMonth())+" "+new Date().getFullYear());
    const mes=String(mesRaw).replace(/\s+$/,"");
    const ymFile=opt.ym||(labelParts&&labelParts.ym)||new Date().toISOString().slice(0,7);
    g.fillStyle=mint;  g.font="800 44px Manrope, sans-serif"; g.fillText("💼 Aely", 72, 70);
    g.fillStyle=muted; g.font="600 34px Manrope, sans-serif"; g.fillText(mes.charAt(0).toUpperCase()+mes.slice(1), 72, 130);
    // tarjeta: gastado este mes + barra de presupuesto
    g.fillStyle=surface; round(72,210,W-144,330,28); g.fill(); g.strokeStyle=line; g.lineWidth=2; round(72,210,W-144,330,28); g.stroke();
    g.fillStyle=muted; g.font="700 27px Manrope, sans-serif"; g.fillText(t("rp_spent").toUpperCase(), 116, 252);
    // Misma cifra que Resumen/Gastos (`monthBudgetStats`), no thisMonthSpent.
    const bs=monthBudgetStats(state, winStart+12*864e5, winEnd!=null?winEnd:undefined);
    const spentShown=bs.shown!=null?bs.shown:Math.max(0,bs.against||0);
    g.fillStyle=text;  g.font="700 96px Manrope, sans-serif"; g.fillText(eur0(spentShown), 112, 300);
    const bud=bs.budget!=null?bs.budget:0;
    if(bud>0){
      const ratio=Math.min(1, Math.max(0, bs.against||0)/bud);
      g.fillStyle="rgba(128,128,128,.18)"; round(116,432,W-232,26,13); g.fill();
      g.fillStyle=ratio<1?mint:coral; round(116,432,Math.max(20,(W-232)*ratio),26,13); g.fill();
      g.fillStyle=muted; g.font="600 28px Manrope, sans-serif"; g.fillText(tf("rp_of_budget",{b:eur0(bud),p:Math.round(ratio*100)}), 116, 480);
    }
    // top 3 categorías del mes (misma ventana que bs)
    const byCat={};
    const endCap=winEnd!=null?winEnd:Infinity;
    (state.expenses||[]).forEach(function(e){
      const ms=dateMs(e.date);
      if(ms<winStart||ms>=endCap) return;
      if(!(e.amount>0) || CAT_NEUTRAS[e.category]) return;
      if(typeof expenseCountsBudget==="function" && !expenseCountsBudget(e, state)) return;
      byCat[e.category||"otros"]=(byCat[e.category||"otros"]||0)+e.amount;
    });
    const top=Object.keys(byCat).map(function(k){ return [k,byCat[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,3);
    let y=610;
    g.fillStyle=text; g.font="800 36px Manrope, sans-serif"; g.fillText(t("rp_top"), 72, y); y+=70;
    const maxV=top.length?top[0][1]:1;
    top.forEach(function(c){
      const cat=catOf(c[0]);
      g.font="600 44px Manrope, sans-serif"; g.fillStyle=text; g.fillText(cat.icon, 72, y-4);
      g.font="700 34px Manrope, sans-serif"; g.fillText(catName(c[0]), 150, y);
      g.textAlign="right"; g.fillText(eur0(c[1]), W-72, y); g.textAlign="left";
      g.fillStyle="rgba(128,128,128,.18)"; round(150,y+48,W-222-72,16,8); g.fill();
      g.fillStyle=cat.color||mint; round(150,y+48,Math.max(14,(W-222-72)*(c[1]/maxV)),16,8); g.fill();
      y+=112;
    });
    if(!top.length){ g.fillStyle=muted; g.font="600 30px Manrope, sans-serif"; g.fillText("—", 72, y); y+=80; }
    // tarjeta: patrimonio + delta del mes
    const py=Math.max(y+30, 1030);
    g.fillStyle=surface; round(72,py,W-144,190,28); g.fill(); g.strokeStyle=line; round(72,py,W-144,190,28); g.stroke();
    g.fillStyle=muted; g.font="700 27px Manrope, sans-serif"; g.fillText(t("rp_networth").toUpperCase(), 116, py+38);
    g.fillStyle=text;  g.font="700 64px Manrope, sans-serif"; g.fillText(eur0(tt.netWorth), 112, py+80);
    const dl=(tt.delta>=0?"+":"")+eur0(tt.delta);
    g.textAlign="right"; g.fillStyle=tt.delta>=0?mint:coral; g.font="700 34px Manrope, sans-serif";
    g.fillText(tf("rp_delta",{x:dl}), W-108, py+95); g.textAlign="left";
    g.fillStyle=muted; g.font="600 26px Manrope, sans-serif"; g.fillText(t("rp_footer")+" · v"+CONFIG.APP_VERSION, 72, H-72);
    cv.toBlob(function(b){
      if(!b){ if(showToast) showToast("✕ Informe: canvas vacío"); return; }
      const fname="mi-cartera-"+ymFile+".png";
      const dl=function(){
        const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=fname; a.click();
        setTimeout(function(){ URL.revokeObjectURL(u); },1000);
      };
      // Al descargar, decir DÓNDE queda (toast + notificación con el nombre del fichero): antes
      // solo «descargado» y el usuario no sabía ni dónde buscarlo (feedback 2026-07-18).
      const saidSaved=function(){
        if(showToast) showToast(t("rp_saved"));
        const nat=natPlugin();
        if(nat&&nat.showNotification){ try{ nat.showNotification({title:"Aely", body:tf("rp_saved_notif",{f:fname})}).catch(function(){}); }catch(e){} }
      };
      const file=new File([b], fname, {type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        // El share de la WebView puede rechazar en silencio («el informe no hace nada»,
        // feedback 2026-07-18): si falla, descargamos la imagen igualmente y lo decimos.
        navigator.share({files:[file], title:"Aely"}).catch(function(err){
          const aborted=err && (err.name==="AbortError");   // canceló el usuario: no insistir
          if(aborted) return;
          dl();
          saidSaved();
        });
      } else {
        dl();
        saidSaved();
      }
    },"image/png");
  }catch(e){ if(showToast) showToast("✕ Informe: "+((e&&e.message)||e)); }
}

/* ============================================================
   TOUR GUIADO (coach-marks) — para estrenarse sin saber de apps.
   Ilumina elementos REALES de la pantalla con un foco y una frase llana.
   Sale solo la primera vez (state.tourSeen=false) y desde Ajustes → Ver tutorial.
   ============================================================ */
function Tour({onDone, goTab, tabIds}){
  // Tour v4. Portal a `document.body` + compensación del `zoom` de la letra (small/big/huge).
  // Causa real del descuadre en su Oppo (medido por CDP 4/8): con `html.smalltext body{zoom:0.92}`
  // `getBoundingClientRect` viene en px de pantalla, pero `position:fixed` left/top se interpretan
  // en el espacio PRE-zoom del body → el foco se pintaba al 92% (Gastos ~57 px arriba). Playwright
  // en Pixel 5 no aplica smalltext, por eso el e2e salía verde y el móvil no.
  const bodyZoom=function(){
    const z=parseFloat(getComputedStyle(document.body).zoom);
    return (z&&isFinite(z)&&z>0)?z:1;
  };
  // Convierte coords de pantalla (getBoundingClientRect / innerWidth) al espacio del zoom.
  const zPx=function(v){ return v/bodyZoom(); };
  const pickVisible=function(sel){
    const nodes=document.querySelectorAll(sel);
    const W=window.innerWidth||400, H=window.innerHeight||700;
    let best=null, bestArea=0;
    for(let n=0;n<nodes.length;n++){
      const r=nodes[n].getBoundingClientRect();
      if(r.width<8||r.height<8) continue;
      const visL=Math.max(0,r.left), visR=Math.min(W,r.right);
      const visT=Math.max(0,r.top), visB=Math.min(H,r.bottom);
      const area=Math.max(0,visR-visL)*Math.max(0,visB-visT);
      if(area>bestArea && r.left>=-4 && r.left<W-20){ bestArea=area; best=nodes[n]; }
    }
    return best||null;
  };
  // Caja del texto real (incluye el span de decimales/€). Solo en la cifra: en botones el
  // Range se queda en el icono/label y el foco salía más estrecho que el tab (e2e paso Gastos).
  const boxOf=function(el){
    if(el&&el.classList&&el.classList.contains("v4-hero-amt")){
      try{
        const rg=document.createRange();
        rg.selectNodeContents(el);
        const r=rg.getBoundingClientRect();
        if(r.width>=8&&r.height>=8) return r;
      }catch(_){}
    }
    return el.getBoundingClientRect();
  };
  const steps=[
    // Solo la cifra; pad holgado para envolver € (Range + margen; no a ojo del número grande).
    {k:"tour_1", tab:"dash", pad:18, sel:function(){ return pickVisible(".page .v4-hero-amt, [data-tour='hero-amt']"); }},
    // Sin recorte: el gesto abre Ajustes en cualquier sitio. Sigue el velo oscuro del tutorial.
    {k:"tour_settings", tab:"dash", tipOnly:true},
    {k:"tour_2", tab:"gastos", sel:function(){ return document.querySelector('.botnav-tab[data-tour="gastos"]'); }},
    {k:"tour_3", tab:null, round:true, sel:function(){ return document.querySelector(".botnav-fab"); }},
    {k:"tour_4", tab:"plan", sel:function(){ return document.querySelector('.botnav-tab[data-tour="plan"]'); }},
    {k:"tour_planswipe", tab:"plan", sel:function(){ return pickVisible(".page .v4-seg, .v4-seg"); }},
    {k:"tour_5", tab:"cartera", sel:function(){ return document.querySelector('.botnav-tab[data-tour="cartera"]'); }},
    {k:"tour_6", tab:"dash", round:true, sel:function(){ return pickVisible(".page .v4-avatar, [data-tour='avatar']"); }},
    // Sin foco: el tirón abre el perfil en cualquier sitio de Inicio, no solo «arriba del todo».
    {k:"tour_pulldown", tab:"dash", tipOnly:true},
    {k:"tour_7", tab:null, sel:function(){ return document.querySelector(".botnav-row"); }},
  ];
  const [i,setI]=useState(0);
  const [shown,setShown]=useState(null);
  const spotRef=useRef(null);
  const tipRef=useRef(null);
  const padOf=function(st, round){
    if(st&&st.pad!=null) return st.pad;
    return round?8:10;
  };
  const tipPos=function(r, tipH, tipOnly){
    // Todo en px de pantalla; `pintar` lo pasa a espacio zoom al escribir estilos.
    const H=window.innerHeight||700;
    const need=Math.max(120, tipH||156);
    if(tipOnly||!r||r.tipOnly) return {top:Math.max(24, Math.round(H*0.28)), bottom:""};
    const p=padOf(null, r.round), gap=16;
    const spotTop=r.y-p, spotBot=r.y+r.h+p;
    if(spotTop>H*0.62) return {top:Math.max(12, Math.round(H*0.10)), bottom:""};
    const belowTop=spotBot+gap;
    if(belowTop+need<=H-10) return {top:belowTop, bottom:""};
    const aboveBottom=H-spotTop+gap;
    if(spotTop-gap-need>=10) return {top:"", bottom:aboveBottom};
    if((H-spotBot)>=spotTop) return {top:Math.min(belowTop, H-need-10), bottom:""};
    return {top:"", bottom:Math.min(Math.max(10, aboveBottom), H-need-10)};
  };
  const pintar=function(r){
    const st=steps[r.step!=null?r.step:i];
    const tipOnly=!!(r.tipOnly||(st&&st.tipOnly));
    const p=padOf(st, r.round);
    const n=spotRef.current;
    if(n){
      if(tipOnly){
        // Velo a pantalla completa (mismo tono que el box-shadow del foco). Antes opacity:0
        // quitaba el oscurecido y parecía que el tutorial había terminado (feedback 4/8).
        n.style.opacity="1";
        n.style.left="0"; n.style.top="0";
        n.style.width=zPx(window.innerWidth||360)+"px";
        n.style.height=zPx(window.innerHeight||700)+"px";
        n.style.borderRadius="0";
      } else {
        n.style.opacity="1";
        n.style.borderRadius="";
        n.style.left=zPx(r.x-p)+"px"; n.style.top=zPx(r.y-p)+"px";
        n.style.width=zPx(r.w+p*2)+"px"; n.style.height=zPx(r.h+p*2)+"px";
      }
    }
    const tip=tipRef.current;
    if(tip){
      // offsetHeight del tip ya está en px de pantalla (post-zoom); tipPos trabaja en pantalla.
      const box=tipPos(r, tip.getBoundingClientRect().height||156, tipOnly);
      tip.style.top=box.top===""?"":(zPx(box.top)+"px");
      tip.style.bottom=box.bottom===""?"":(zPx(box.bottom)+"px");
      tip.style.left=zPx(16)+"px"; tip.style.right=zPx(16)+"px";
    }
  };
  const showNav=function(){
    // Durante el tour la barra NO puede estar escondida: si lo está, medimos su sitio «fuera»
    // y el foco cae en el aire (fotos Gastos/Plan/Cartera).
    const nav=document.querySelector(".botnav");
    if(nav){ nav.classList.remove("botnav-hidden"); }
  };
  const inViewport=function(r){
    const H=window.innerHeight||700, W=window.innerWidth||400;
    return r.width>0 && r.height>0 && r.top<H-24 && r.bottom>24 && r.left>=-2 && r.left<W-8 && r.right>8;
  };
  const bringIntoView=function(el){
    try{
      const page=el.closest&&el.closest(".page");
      if(page){
        const pr=page.getBoundingClientRect(), er=el.getBoundingClientRect();
        if(er.top<pr.top+40 || er.bottom>pr.bottom-40){
          page.scrollTop += (er.top - pr.top) - Math.min(120, pr.height*0.25);
        }
      } else if(typeof el.scrollIntoView==="function"){
        el.scrollIntoView({block:"center", inline:"nearest", behavior:"instant"});
      }
    }catch(_){}
  };
  const ensureTab=function(tabId){
    if(!tabId||!goTab||!tabIds) return;
    const idx=tabIds.indexOf(tabId);
    if(idx>=0) try{ goTab(idx); }catch(e){}
  };
  const cajaDe=function(st){
    if(!st) return null;
    if(st.tipOnly) return {x:0,y:0,w:0,h:0,tipOnly:true,round:false};
    const el=st.sel&&st.sel();
    if(!el) return null;
    const r=boxOf(el);
    return {x:r.left,y:r.top,w:r.width,h:r.height,round:!!st.round,el:el};
  };
  const measure=function(idx){
    for(let j=idx;j<steps.length;j++){
      ensureTab(steps[j].tab);
      showNav();
      const c=cajaDe(steps[j]);
      if(!c) continue;
      if(c.tipOnly) return {j:j, r:{x:0,y:0,w:0,h:0,tipOnly:true}, round:false, tipOnly:true};
      if(c.el) bringIntoView(c.el);
      const r=c.el?boxOf(c.el):{left:c.x,top:c.y,width:c.w,height:c.h,bottom:c.y+c.h,right:c.x+c.w};
      if(inViewport(r)){
        return {j:j, r:{x:r.left,y:r.top,w:r.width,h:r.height}, round:!!steps[j].round, el:c.el||null};
      }
    }
    return null;
  };
  useEffect(function(){
    let cancelled=false, raf=0, esperas=0, quieto=0, vueltas=0, ultima="", traido=null, nodo=null, redondo=false, enganchado=false, tipOnly=false;
    ensureTab(steps[i]&&steps[i].tab);
    showNav();
    const seguir=function(){
      if(cancelled) return;
      showNav();
      let caja;
      if(tipOnly){
        caja={x:0,y:0,w:0,h:0,tipOnly:true,round:false,step:i};
      } else {
        const r=boxOf(nodo);
        if(r.width<8||r.height<8){ traido=null; esperas=0; enganchado=false; raf=requestAnimationFrame(buscar); return; }
        caja={x:r.left,y:r.top,w:r.width,h:r.height,round:redondo,step:i};
      }
      const clave=Math.round(caja.x)+","+Math.round(caja.y)+","+Math.round(caja.w)+","+Math.round(caja.h)+","+(caja.tipOnly?1:0);
      if(clave===ultima) quieto++; else { quieto=0; ultima=clave; }
      const fin=tipOnly || quieto>=6 || ++vueltas>180;
      if(!enganchado){
        enganchado=true; setShown({i:i, rect:caja, pegado:true, tipOnly:tipOnly});
      } else if(fin){
        setShown({i:i, rect:caja, pegado:false, tipOnly:tipOnly});
      } else {
        pintar(caja);
      }
      if(!fin) raf=requestAnimationFrame(seguir);
    };
    const buscar=function(){
      if(cancelled) return;
      const st=steps[i];
      if(st&&st.tipOnly){ tipOnly=true; redondo=false; nodo=null; seguir(); return; }
      tipOnly=false;
      const el=st&&st.sel&&st.sel();
      if(el){
        if(el!==traido){ traido=el; bringIntoView(el); }
        const r=boxOf(el);
        if(inViewport(r)){ nodo=el; redondo=!!st.round; seguir(); return; }
      }
      if(++esperas<90){ raf=requestAnimationFrame(buscar); return; }
      const alt=measure(i);
      if(!alt){ onDone(); return; }
      if(alt.j!==i){ setI(alt.j); return; }
      if(alt.tipOnly){ tipOnly=true; redondo=false; nodo=null; seguir(); return; }
      nodo=alt.el||(steps[i].sel&&steps[i].sel());
      if(!nodo){ onDone(); return; }
      redondo=!!alt.round; tipOnly=false; seguir();
    };
    raf=requestAnimationFrame(buscar);
    const onR=function(){
      quieto=0; vueltas=0; cancelAnimationFrame(raf);
      raf=requestAnimationFrame(tipOnly||nodo?seguir:buscar);
    };
    window.addEventListener("resize",onR);
    if(window.visualViewport) window.visualViewport.addEventListener("resize",onR);
    if(window.visualViewport) window.visualViewport.addEventListener("scroll",onR);
    return function(){
      cancelled=true; cancelAnimationFrame(raf);
      window.removeEventListener("resize",onR);
      if(window.visualViewport) window.visualViewport.removeEventListener("resize",onR);
      if(window.visualViewport) window.visualViewport.removeEventListener("scroll",onR);
    };
  },[i]);
  useEffect(function(){
    const onKey=function(e){ if(e.key==="Escape") onDone(); };
    window.addEventListener("keydown",onKey);
    return function(){ window.removeEventListener("keydown",onKey); };
  },[onDone]);
  useLayoutEffect(function(){ if(shown) pintar(shown.rect); },[shown]);

  const ui=function(){
    if(!shown) return React.createElement("div",{className:"tour-wrap"},
      React.createElement("div",{className:"tour-tip",style:{bottom:80,left:16,right:16}},
        React.createElement("div",{className:"tour-txt"}, t("tour_skip")),
        React.createElement("button",{className:"btn btn-primary btn-block",onClick:onDone}, t("tour_done"))
      )
    );
    const rect=shown.rect;
    const last=i===steps.length-1;
    const tipOnly=!!shown.tipOnly;
    const spotStyle=rect.round?{borderRadius:"50%"}:null;
    return React.createElement("div",{className:"tour-wrap"},
      React.createElement("div",{className:"tour-spot"+(shown.pegado?" pegado":"")+(tipOnly?" tiponly":""),style:spotStyle,ref:spotRef}),
      React.createElement("div",{className:"tour-tip"+(shown.pegado?" pegado":""),ref:tipRef},
        React.createElement("div",{className:"tour-txt"},tf(steps[shown.i].k,{
          gastos:t("tab_gastos"), plan:t("tab_plan"), cartera:t("tab_cartera"), inicio:t("tab_dash")
        })),
        React.createElement("div",{className:"tour-dots"}, steps.map(function(_,d){ return React.createElement("span",{key:d,className:"td"+(d===shown.i?" on":"")}); })),
        React.createElement("div",{className:"tour-btns"},
          React.createElement("button",{className:"tour-skip",onClick:onDone},t("tour_skip")),
          React.createElement("button",{className:"btn btn-primary",style:{padding:"9px 20px"},onClick:function(){ if(last) onDone(); else setI(i+1); }}, last?t("tour_done"):t("tour_next"))
        )
      )
    );
  };
  return ReactDOM.createPortal(ui(), document.body);
}

function CollapsibleCard({title, sub, dot, defaultOpen, right, children, storageKey, help}){
  const [open,setOpen]=useState(()=>{
    if(storageKey){ const s=store.get("col_"+storageKey); if(s!=null) return s; }
    return defaultOpen!==false;
  });
  const toggle=()=>{ const n=!open; setOpen(n); if(storageKey) store.set("col_"+storageKey,n); };
  // Ocultar bloques en CUALQUIER pestaña (petición 2026-07-10, como los widgets del Resumen).
  // App publica en cada render __mcBlocksEdit (modo edición, se activa en Ajustes) y
  // __mcCardHidden (settings.cardHidden); el toggle viaja por evento porque esta tarjeta
  // no recibe set(). Oculta y fuera de edición → no se pinta; en edición → atenuada + botón.
  const blocksEdit=!!window.__mcBlocksEdit;
  const cardHidden=(storageKey && Array.isArray(window.__mcCardHidden) && window.__mcCardHidden.indexOf(storageKey)>=0);
  if(cardHidden && !blocksEdit) return null;
  const hideBtn=(blocksEdit && storageKey) ? React.createElement("button",{
    onClick:function(e){ e.stopPropagation(); try{ window.dispatchEvent(new CustomEvent("mc-card-toggle",{detail:storageKey})); }catch(_){} },
    style:{fontSize:11.5,fontWeight:700,padding:"4px 9px",borderRadius:9,cursor:"pointer",
      background:cardHidden?"var(--mint)":"var(--surface-2)",color:cardHidden?"#06120C":"var(--coral)",
      border:cardHidden?"none":"1px solid var(--coral)"}
  }, cardHidden?t("cc_show"):t("cc_hide")) : null;
  return React.createElement("div",{className:"card",style:cardHidden?{opacity:.45,borderStyle:"dashed"}:null},
    React.createElement("div",{className:"card-head",onClick:toggle},
      React.createElement("div",{className:"card-title"},
        dot && React.createElement("span",{className:"dot",style:{background:dot}}),
        React.createElement("div",null, title, sub && React.createElement("div",{className:"sub"},sub))
      ),
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
        hideBtn,
        help && React.createElement(HelpTip,{text:help}),
        right, React.createElement(I.chev,{className:"chev"+(open?" open":"")})
      )
    ),
    React.createElement("div",{className:"collapsible"+(open?" open":"")},
      React.createElement("div",null, React.createElement("div",{className:"card-body"},children))
    )
  );
}

/* Count-up compartido (B2). `ready` es la puerta: Inicio espera `mc-splash-gone`; Cartera espera
   el bus `mcOnCarteraActive`. Sin puerta, la animación se gasta con la pestaña premontada (o
   detrás del splash) y al llegar el número ya está puesto — peor que no animar. */
function useCountUp(target, ready){
  const [shown,setShown]=useState(0);
  const rafRef=useRef(0);
  const shownRef=useRef(0);
  const primeraRef=useRef(true);
  useEffect(function(){
    if(!ready) return undefined;
    const tgt=+(target||0);
    cancelAnimationFrame(rafRef.current);
    const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    if(reduce){
      shownRef.current=tgt; setShown(tgt); primeraRef.current=false;
      return undefined;
    }
    let cancelado=false;
    const start=primeraRef.current?0:shownRef.current;
    primeraRef.current=false;
    const t0=performance.now(), dur=950;
    const ease=function(x){ return 1-Math.pow(1-x,3); };
    const step=function(now){
      if(cancelado) return;
      const p=Math.min(1,(now-t0)/dur);
      const v=start+(tgt-start)*ease(p);
      shownRef.current=v;
      setShown(v);
      if(p<1) rafRef.current=requestAnimationFrame(step);
    };
    rafRef.current=requestAnimationFrame(step);
    return function(){ cancelado=true; cancelAnimationFrame(rafRef.current); };
  },[target, ready]);
  return shown;
}

function Sparkline({data, current}){
  const pts = data.concat(current!=null?[current]:[]);
  // Con 0 o 1 puntos esto pintaba una recta de lado a lado con su puntito final: parece un grafico
  // de verdad que dice cero, y es lo primero que ve alguien que acaba de instalar la app. Sin
  // datos no hay grafico (P1). Quien lo llama reserva el hueco para que no salte el layout.
  if(pts.length<2) return null;
  const w=320, h=70, pad=4;
  const min=Math.min.apply(null,pts), max=Math.max.apply(null,pts);
  const rng=(max-min)||1;
  const xs=(i)=> pad + (pts.length>1 ? i*(w-2*pad)/(pts.length-1) : 0);
  const ys=(v)=> pad + (1-(v-min)/rng)*(h-2*pad);
  let d="M"+xs(0)+" "+ys(pts[0]);
  for(let i=1;i<pts.length;i++) d+=" L"+xs(i)+" "+ys(pts[i]);
  const area=d+" L"+xs(pts.length-1)+" "+h+" L"+xs(0)+" "+h+" Z";
  const lastX=xs(pts.length-1), lastY=ys(pts[pts.length-1]);
  return React.createElement("svg",{className:"spark",viewBox:"0 0 "+w+" "+h,preserveAspectRatio:"none"},
    React.createElement("defs",null,
      React.createElement("linearGradient",{id:"sparkfill",x1:"0",y1:"0",x2:"0",y2:"1"},
        React.createElement("stop",{offset:"0",stopColor:"#5FD08A",stopOpacity:"0.28"}),
        React.createElement("stop",{offset:"1",stopColor:"#5FD08A",stopOpacity:"0"})
      )
    ),
    React.createElement("path",{d:area,fill:"url(#sparkfill)"}),
    React.createElement("path",{d:d,fill:"none",stroke:"#5FD08A",strokeWidth:"2.4",strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke"}),
    React.createElement("circle",{cx:lastX,cy:lastY,r:"3.5",fill:"#7DE8A8"})
  );
}

// Snapshot diario del total invertido (valor + coste opcional). Idempotente por día.
function recordInvSnapshot(hist, today, value, cost){
  const h=(hist||[]).slice();
  const pt={d:today,v:+value.toFixed(2)};
  if(cost!=null && cost>=0) pt.c=+cost.toFixed(2);
  if(h.length && h[h.length-1].d===today) h[h.length-1]=pt;
  else h.push(pt);
  if(h.length>400) h.splice(0,h.length-400);
  return h;
}
function invPeriodChange(hist){
  if(!hist || hist.length<2) return null;
  const a=hist[0], b=hist[hist.length-1];
  if(!(a.v>0)) return null;
  return {pct:(b.v-a.v)/a.v*100, abs:b.v-a.v, days:hist.length};
}

// Gráfico de evolución: valor (sólido) + coste aportado (discontinuo) si hay datos.
function SparklineInv({hist}){
  if(!hist || !hist.length) return null;
  const vals=hist.map(function(h){ return h.v; });
  const costPts=hist.map(function(h){ return h.c; });
  const hasCost=costPts.some(function(c){ return c!=null && c>0; });
  const w=320, h=82, pad=8;
  const all=hasCost ? vals.concat(costPts.filter(function(c){ return c!=null; })) : vals.slice();
  const min=Math.min.apply(null,all), max=Math.max.apply(null,all);
  const rng=(max-min)||1;
  const n=vals.length;
  const xs=function(i){ return pad + (n>1 ? i*(w-2*pad)/(n-1) : (w-2*pad)/2); };
  const ys=function(v){ return pad + (1-(v-min)/rng)*(h-2*pad); };
  let dVal="M"+xs(0)+" "+ys(vals[0]);
  for(let i=1;i<n;i++) dVal+=" L"+xs(i)+" "+ys(vals[i]);
  const area=dVal+" L"+xs(n-1)+" "+h+" L"+xs(0)+" "+h+" Z";
  let dCost=null;
  if(hasCost){
    let started=false;
    for(let i=0;i<n;i++){
      if(costPts[i]==null) continue;
      const seg=(started?" L":"M")+xs(i)+" "+ys(costPts[i]);
      dCost=(dCost||"")+seg; started=true;
    }
  }
  const lastX=xs(n-1), lastY=ys(vals[n-1]);
  return React.createElement("svg",{className:"spark",viewBox:"0 0 "+w+" "+h,preserveAspectRatio:"none",style:{height:82}},
    React.createElement("defs",null,
      React.createElement("linearGradient",{id:"invsparkfill",x1:"0",y1:"0",x2:"0",y2:"1"},
        React.createElement("stop",{offset:"0",stopColor:"#5FD08A",stopOpacity:"0.22"}),
        React.createElement("stop",{offset:"1",stopColor:"#5FD08A",stopOpacity:"0"})
      )
    ),
    React.createElement("path",{d:area,fill:"url(#invsparkfill)"}),
    dCost && React.createElement("path",{d:dCost,fill:"none",stroke:"#7FB5E8",strokeWidth:"1.8",strokeDasharray:"5 4",strokeLinecap:"round",vectorEffect:"non-scaling-stroke",opacity:0.85}),
    React.createElement("path",{d:dVal,fill:"none",stroke:"#5FD08A",strokeWidth:"2.4",strokeLinecap:"round",strokeLinejoin:"round",vectorEffect:"non-scaling-stroke"}),
    React.createElement("circle",{cx:lastX,cy:lastY,r:"3.5",fill:"#7DE8A8"})
  );
}

function StackedBar({segments}){
  const total=segments.reduce((a,s)=>a+s.value,0)||1;
  return React.createElement("div",null,
    React.createElement("div",{className:"stack"},
      segments.map((s,i)=>React.createElement("span",{key:i,style:{width:Math.max(2,(s.value/total)*100)+"%",background:s.color}}))
    ),
    React.createElement("div",{className:"stack-legend"},
      segments.map((s,i)=>React.createElement("div",{key:i,className:"sl-item"},
        React.createElement("span",{className:"sw",style:{background:s.color}}),
        React.createElement("span",{className:"nm"},s.label),
        React.createElement("span",{className:"vl num"},eur0(s.value))
      ))
    )
  );
}

function Ring({ratio, spent, budget}){
  const r=54, c=2*Math.PI*r, clamped=Math.min(ratio,1);
  const col = ratio>1 ? "#E2705F" : ratio>=0.7 ? "#E6C36A" : "#5FD08A";
  return React.createElement("div",{className:"ring-wrap"},
    React.createElement("div",{className:"ring"},
      React.createElement("svg",{width:"124",height:"124",viewBox:"0 0 124 124"},
        React.createElement("circle",{cx:"62",cy:"62",r:r,fill:"none",stroke:"#16291E",strokeWidth:"11"}),
        React.createElement("circle",{cx:"62",cy:"62",r:r,fill:"none",stroke:col,strokeWidth:"11",strokeLinecap:"round",strokeDasharray:c,strokeDashoffset:c*(1-clamped),style:{transition:"stroke-dashoffset .6s ease"}})
      ),
      React.createElement("div",{className:"ring-center"},
        React.createElement("div",{className:"big num",style:{color:col}},Math.round(ratio*100)+"%"),
        React.createElement("div",{className:"small"},"del límite")
      )
    ),
    React.createElement("div",{className:"ring-foot"},
      React.createElement("span",{className:"num",style:{fontWeight:700}},eur0(spent)),
      React.createElement("span",{className:"muted num"},"de "+eur0(budget))
    )
  );
}

function MiniPie({slices}){
  const total=slices.reduce((a,s)=>a+s.value,0)||1;
  let acc=0; const r=42,cx=48,cy=48;
  const arcs=slices.map((s,i)=>{
    const frac=s.value/total, a0=acc*2*Math.PI-Math.PI/2; acc+=frac; const a1=acc*2*Math.PI-Math.PI/2;
    const large=frac>0.5?1:0;
    const x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    return React.createElement("path",{key:i,d:"M"+cx+" "+cy+" L"+x0+" "+y0+" A"+r+" "+r+" 0 "+large+" 1 "+x1+" "+y1+" Z",fill:s.color,stroke:"#0E1A14",strokeWidth:"1.5"});
  });
  return React.createElement("svg",{width:"96",height:"96",viewBox:"0 0 96 96"},arcs,React.createElement("circle",{cx:cx,cy:cy,r:"20",fill:"#0E1A14"}));
}

/* ---- Cierre de overlays con el gesto/botón "atrás" del móvil (History API) ----
   Sin esto, el gesto de retroceso hace history.back() y, al no haber una entrada
   propia, SALE de la PWA. Metemos una entrada de historial por cada overlay abierto
   y, al retroceder, cerramos SOLO el de arriba (pila LIFO), no todos a la vez. */
var _mcBackStack=[];        // overlays abiertos, en orden de apertura
var _mcIgnorePop=false;     // true mientras consumimos nuestra propia entrada (cierre por UI)
var _mcBackInit=false;
function _mcBackInitOnce(){
  if(_mcBackInit) return; _mcBackInit=true;
  window.addEventListener("popstate", function(){
    if(_mcIgnorePop){ _mcIgnorePop=false; return; }   // fue nuestro history.back() de cierre por UI
    var top=_mcBackStack.pop();
    if(top){ top._byPop=true; top.close(); }           // cierra el overlay superior
  });
}
function useBackClose(open, onClose){
  const entry=useRef(null);
  useEffect(function(){
    _mcBackInitOnce();
    if(!open) return undefined;
    const e={ close:onClose, _byPop:false };
    entry.current=e;
    _mcBackStack.push(e);
    try{ history.pushState({mcOverlay:true}, ""); }catch(err){}
    return function(){
      const i=_mcBackStack.indexOf(e);
      if(i>=0) _mcBackStack.splice(i,1);
      if(!e._byPop){                                    // cerrado por UI (botón/swipe), no por gesto atrás:
        _mcIgnorePop=true;                              // consumimos nuestra entrada sin cerrar otro overlay
        try{ history.back(); }catch(err){ _mcIgnorePop=false; }
      }
    };
  },[open]);
}

/* Sheet bottom: swipe hacia abajo para cerrar en TODA la ficha (no solo el asa).
   Si el contenido está scrolleado, primero sube; al llegar arriba, tira cierra. */
function useSheetSwipe(open, onClose, opts){
  opts=opts||{};
  const sheetRef=useRef(null);
  const closeTimer=useRef(null);
  const startY=useRef(0), startX=useRef(0), dy=useRef(0), dragging=useRef(false), armed=useRef(false), axis=useRef(null), closing=useRef(false);
  useEffect(function(){
    if(!open) return undefined;
    closing.current=false;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    document.documentElement.classList.add("sheet-open");
    const block=function(e){
      const sheet=sheetRef.current;
      if(sheet && sheet.contains(e.target)) return;
      if(e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", block, {passive:false, capture:true});
    return function(){
      if(closeTimer.current){ clearTimeout(closeTimer.current); closeTimer.current=null; }
      document.body.style.overflow=prev;
      document.documentElement.classList.remove("sheet-open");
      document.removeEventListener("touchmove", block, {capture:true});
    };
  },[open]);
  const onTouchStart=function(e){
    // Portal a body pero el árbol React sigue bajo la tab: sin esto el swipe de tabs
    // del viewport se come el scroll horizontal de chips (editar gasto ≠ Apuntar — 2026-07-17).
    if(e&&e.stopPropagation) e.stopPropagation();
    if(closing.current) return;
    if(!(e.touches&&e.touches[0])) return;
    armed.current=true;
    dragging.current=true; dy.current=0; axis.current=null;
    startY.current=e.touches[0].clientY; startX.current=e.touches[0].clientX;
  };
  const onTouchMove=function(e){
    if(e&&e.stopPropagation) e.stopPropagation();
    if(!dragging.current||!armed.current||closing.current) return;
    const el=sheetRef.current;
    const t=e.touches[0], ddy=t.clientY-startY.current, ddx=t.clientX-startX.current;
    if(axis.current===null){
      if(Math.abs(ddx)<8 && Math.abs(ddy)<8) return;
      if(Math.abs(ddx)>Math.abs(ddy)*1.1){
        dragging.current=false; armed.current=false; return;
      }
      axis.current="y";
    }
    if(el && el.scrollTop>0){
      dy.current=0; el.classList.remove("dragging"); el.style.transform="";
      return;
    }
    if(ddy<=0){ dy.current=0; if(el) el.style.transform=""; return; }
    // Resistencia tipo sheet (no 1:1): se siente más natural al tirar.
    const resist=Math.min(ddy*0.92, ddy);
    dy.current=resist;
    if(el){
      el.classList.add("dragging");
      el.style.transform="translate3d(0,"+resist+"px,0)";
    }
    if(e.cancelable) e.preventDefault();
  };
  const closeAnimated=function(done){
    if(closing.current) return;
    const finish=typeof done==="function"?done:onClose;
    const el=sheetRef.current;
    const reduce=(window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches)
      ||document.documentElement.classList.contains("reduce-motion");
    if(!el||reduce){ finish(); return; }
    closing.current=true;
    el.classList.remove("dragging");
    // El fondo se libera al empezar la salida, no al desmontar: esperar esos 200–320 ms
    // recupera el tirón que ya se había eliminado en producción (revisión 2026-09-24).
    document.documentElement.classList.remove("sheet-open");
    document.body.style.overflow="";
    const ms=opts.closeMs||200;
    el.style.transition="transform "+ms+"ms "+(opts.closeEase||"cubic-bezier(.32,.72,0,1)");
    el.style.transform="translate3d(0,110%,0)";
    closeTimer.current=setTimeout(function(){
      closeTimer.current=null;
      closing.current=false;
      finish();
    },ms);
  };
  const onTouchEnd=function(e){
    if(e&&e.stopPropagation) e.stopPropagation();
    if(closing.current) return;
    if(!dragging.current && dy.current<=0){ armed.current=false; axis.current=null; return; }
    dragging.current=false; armed.current=false; axis.current=null;
    const dist=dy.current; dy.current=0;
    const el=sheetRef.current;
    if(!el){ if(dist>80) onClose(); return; }
    el.classList.remove("dragging");
    if(dist>80){
      closeAnimated();
    } else {
      const snapMs=opts.snapMs||220;
      el.style.transition="transform "+snapMs+"ms "+(opts.snapEase||"cubic-bezier(.32,.72,0,1)");
      el.style.transform="translate3d(0,0,0)";
      setTimeout(function(){ try{ el.style.transition=""; el.style.transform=""; }catch(err){} },snapMs);
    }
  };
  return { sheetRef:sheetRef, close:closeAnimated, sheetTouch:{ onTouchStart:onTouchStart, onTouchMove:onTouchMove, onTouchEnd:onTouchEnd, onTouchCancel:onTouchEnd } };
}

/* lista editable genérica; valFmt recibe el item entero */
function useEditable(items, onChange, opts){
  opts = opts || {};
  const disp     = opts.display  || (i=>i.value);                  // qué número se muestra al editar
  const toStored = opts.toStored || ((i,typed)=>typed);            // cómo se guarda lo tecleado
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState({});
  const start=()=>{ const d={}; items.forEach(i=>d[i.id]=disp(i)); setDraft(d); setEditing(true); };
  // un item SIN borrador (añadido en pleno modo edición, p.ej. cuenta OB promocionada) se deja
  // tal cual: antes parseFloat(undefined)→0 machacaba su valor al pulsar Guardar.
  const save=()=>{ onChange(items.map(i=>{ if(draft[i.id]==null) return i; const typed=parseFloat(String(draft[i.id]).replace(',','.'))||0; const extra=opts.extra?opts.extra(i,typed):null; return Object.assign({},i,{value: toStored(i,typed) }, extra||{}); })); setEditing(false); };
  return { editing, start, save, draft, setDraft };
}

/* Secciones ordenables por pestaña (petición 2026-07-11): como el orden de widgets del Resumen,
   pero para las tarjetas de Fijos/Patrimonio/Deudas/Inversiones/Metas. El orden se guarda en
   settings.secOrder[tab]; onMove opcional para pestañas cuyo orden vive en los propios datos
   (deudas, metas → se reordena el array del estado y sincroniza igual que todo lo demás). */
function secOrderOf(s, tab, allIds){
  const saved=((((s&&s.settings)||{}).secOrder||{})[tab]||[]).filter(function(id){ return allIds.indexOf(id)>=0; });
  return saved.concat(allIds.filter(function(id){ return saved.indexOf(id)<0; }));
}
function OrderableSections({tab, state, set, items, onMove}){
  const [ordering,setOrdering]=useState(false);
  const real=(items||[]).filter(function(i){ return i && i.el; });
  const allIds=real.map(function(i){ return i.id; });
  const order=onMove?allIds:secOrderOf(state,tab,allIds);
  const map={}; real.forEach(function(i){ map[i.id]=i; });
  const move=function(id,dir){
    if(onMove) return onMove(id,dir);
    set(function(s){
      const o=secOrderOf(s,tab,allIds); const i=o.indexOf(id), j=i+dir;
      if(i<0||j<0||j>=o.length) return s;
      const n=o.slice(); n[i]=o[j]; n[j]=id;
      return Object.assign({},s,{settings:Object.assign({},s.settings,{secOrder:Object.assign({},((s.settings||{}).secOrder)||{},{[tab]:n})})});
    });
  };
  return React.createElement(React.Fragment,null,
    order.map(function(id,idx){
      const it=map[id]; if(!it) return null;
      if(!ordering) return React.createElement(React.Fragment,{key:id},it.el);
      return React.createElement("div",{key:id,className:"wedit"},
        React.createElement("div",{className:"wedit-bar"},
          React.createElement("span",{className:"wedit-lbl"},it.label),
          React.createElement("div",{className:"wedit-btns"},
            React.createElement("button",{disabled:idx===0,onClick:function(){ move(id,-1); }},"↑"),
            React.createElement("button",{disabled:idx===order.length-1,onClick:function(){ move(id,1); }},"↓"))),
        React.createElement("div",{className:"wedit-body"},it.el)
      );
    }),
    real.length>1 && React.createElement("button",{
      className:"btn btn-ghost btn-block",
      style:ordering?{marginTop:10}:{marginTop:10,fontSize:12.5,color:"var(--muted-2)",border:"none",background:"none"},
      onClick:function(){ setOrdering(!ordering); }
    }, ordering?("✓ "+t("done")):t("sec_order"))
  );
}

/* Cabecera de una tarjeta de bróker (TR / MyInvestor / CSV de Revolut), pulsable para plegar.
   Compartida porque las tres eran el MISMO bloque copiado tres veces, y con el acordeón habría
   habido que mantenerlo por triplicado (feedback 2026-07-25: «el colapsable de los brókers
   tampoco está»). Sin `onToggle` se comporta como antes —cabecera fija, no pulsable— para que
   ningún otro sitio herede un plegado que no espera. */
function bkBrand({logo, logoStyle, title, sub, badge, open, onToggle}){
  const props={className:"bk-brand"};
  if(onToggle){
    props.role="button"; props.tabIndex=0; props["aria-expanded"]=open?"true":"false";
    props.style={cursor:"pointer"};
    props.onClick=onToggle;
    props.onKeyDown=function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); onToggle(); } };
  }
  return React.createElement("div",props,
    React.createElement("div",{className:"bk-logo",style:logoStyle}, logo),
    React.createElement("div",{style:{flex:1,minWidth:0}},
      React.createElement("div",{className:"ttl",style:{fontWeight:800,fontSize:16}}, title),
      React.createElement("div",{className:"sub",style:{fontSize:12.5,color:"var(--muted)",fontWeight:600}}, sub)
    ),
    badge?React.createElement("span",{style:{fontSize:11,fontWeight:800,color:"var(--mint)"}}, badge):null,
    onToggle?React.createElement("span",{"aria-hidden":"true",style:{marginLeft:6,color:"var(--muted)",fontSize:12,transition:"transform .18s ease",transform:open?"rotate(180deg)":"none"}}, "▾"):null
  );
}

/* Calendario de la casa (2026-08-17). El `input type="date"` abre el picker nativo de Android
   (gris, en inglés, tipografía ajena) — el mismo rechazo que se llevó a prompt/confirm en la
   v3.100.0. Aquí se elige el día con la misma pinta que el resto de sheets. Fecha LOCAL, no
   UTC: `toISOString().slice(0,10)` a las 23h en España ya es el día siguiente. */
function isoLocal(d){
  d=d||new Date();
  const y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  return y+"-"+(m<10?"0":"")+m+"-"+(day<10?"0":"")+day;
}
function fmtIsoCorto(iso){
  if(!iso) return "—";
  const d=parseDate(String(iso).slice(0,10));
  if(!d||isNaN(d.getTime())) return String(iso).slice(0,10);
  return d.toLocaleDateString(loc(),{weekday:"short",day:"numeric",month:"short"});
}
function McCal({value, onPick}){
  const hoy=isoLocal();
  const sel=String(value||hoy).slice(0,10);
  const [view,setView]=useState(function(){
    const p=sel.split("-");
    return {y:+p[0]||new Date().getFullYear(), m:(+(p[1]||1))-1};
  });
  const first=new Date(view.y, view.m, 1);
  const startDow=(first.getDay()+6)%7;   // lunes = 0
  const daysIn=new Date(view.y, view.m+1, 0).getDate();
  const cells=[];
  for(let i=0;i<startDow;i++) cells.push(null);
  for(let d=1;d<=daysIn;d++) cells.push(d);
  const wd=[];
  for(let i=0;i<7;i++){
    wd.push(new Date(2023,0,2+i).toLocaleDateString(loc(),{weekday:"short"}).replace(/\./g,"").slice(0,2));
  }
  const isoOf=function(d){
    const m=view.m+1;
    return view.y+"-"+(m<10?"0":"")+m+"-"+(d<10?"0":"")+d;
  };
  return React.createElement("div",{className:"mc-cal","data-testid":"mc-cal"},
    React.createElement("div",{className:"mc-cal-nav"},
      React.createElement("button",{type:"button","aria-label":t("cal_prev"),onClick:function(){
        setView(function(v){ const m=v.m-1; return m<0?{y:v.y-1,m:11}:{y:v.y,m:m}; });
      }},"‹"),
      React.createElement("div",{className:"mc-cal-title"}, first.toLocaleDateString(loc(),{month:"long",year:"numeric"})),
      React.createElement("button",{type:"button","aria-label":t("cal_next"),onClick:function(){
        setView(function(v){ const m=v.m+1; return m>11?{y:v.y+1,m:0}:{y:v.y,m:m}; });
      }},"›")
    ),
    React.createElement("div",{className:"mc-cal-grid mc-cal-wd"},
      wd.map(function(w,i){ return React.createElement("div",{key:i}, w); })
    ),
    React.createElement("div",{className:"mc-cal-grid"},
      cells.map(function(d,i){
        if(!d) return React.createElement("div",{key:"e"+i});
        const iso=isoOf(d);
        return React.createElement("button",{key:iso,type:"button",
          className:"mc-cal-day"+(iso===sel?" on":"")+(iso===hoy?" hoy":""),
          onClick:function(){ onPick(iso); }}, d);
      })
    ),
    React.createElement("button",{type:"button",className:"v4-chip"+(sel===hoy?" on":""),style:{marginTop:8},
      onClick:function(){ onPick(hoy); }}, t("cal_today"))
  );
}

/* Teclado numérico propio (Apuntar + Aportar a meta). Estaba copiado en dos sitios y cada
   arreglo se hacía dos veces. Extraerlo es el único refactor que pide el pulido v4 (P9/P10):
   mismo markup y mismas clases, para no tocar el CSS que afina P8. */
function applyNumPadKey(raw, ch, sep){
  raw=String(raw||"");
  if(ch==="⌫") return raw.slice(0,-1);
  if(ch===sep || ch==="," || ch==="."){
    if(raw.indexOf(",")>=0 || raw.indexOf(".")>=0) return raw;
    return (raw||"0")+sep;
  }
  if(raw.replace(/[.,]/g,"").length>=7) return raw;
  return raw==="0"?ch:(raw+ch);
}
function numPadDecSep(){
  // El teclado tenía la coma clavada. En inglés (en-GB) el decimal es punto; el parseo
  // de abajo tolera los dos, esto es etiqueta + lo que se escribe (P10).
  try{
    const ch=(1.1).toLocaleString(loc()).charAt(1);
    return (ch==="."||ch===",")?ch:",";
  }catch(e){ return ","; }
}
function parseNumPadRaw(raw){
  // Un solo separador decimal (el teclado no pone miles). Coma o punto → float.
  return parseFloat(String(raw||"").replace(",","."))||0;
}
function NumPad({value, onChange}){
  const sep=numPadDecSep();
  const holdRef=useRef(null);
  const stopHold=function(){
    const h=holdRef.current;
    if(!h) return;
    if(h.t) clearTimeout(h.t);
    if(h.i) clearInterval(h.i);
    holdRef.current=null;
  };
  // El sheet se DESMONTA (ApuntarSheet vuelve `null` al cerrar). Si el timer sobrevive, el
  // setState del padre —que sigue montado— se come el importe del siguiente apunte (P9).
  useEffect(function(){ return stopHold; },[]);
  const tap=function(ch){
    onChange(function(r){ return applyNumPadKey(r, ch, sep); });
  };
  const delOnce=function(){
    onChange(function(r){ return String(r||"").slice(0,-1); });
  };
  const startHold=function(e){
    if(e.button!=null && e.button!==0) return;
    e.preventDefault();
    e.stopPropagation();
    stopHold();
    delOnce();
    try{ if(navigator.vibrate) navigator.vibrate(4); }catch(err){}
    const t=setTimeout(function(){
      const i=setInterval(delOnce, 70);
      if(holdRef.current) holdRef.current.i=i;
    }, 400);
    holdRef.current={ t:t, i:null };
  };
  const keys=["1","2","3","4","5","6","7","8","9",sep,"0","⌫"];
  return React.createElement("div",{className:"v4-keys"},
    keys.map(function(k){
      const isDel=k==="⌫";
      return React.createElement("button",{
        key:k, type:"button",
        "aria-label":isDel?"Borrar":k,
        onClick:isDel?undefined:function(){ tap(k); },
        onPointerDown:isDel?startHold:undefined,
        onPointerUp:isDel?stopHold:undefined,
        onPointerCancel:isDel?stopHold:undefined,
        onPointerLeave:isDel?stopHold:undefined
      }, k);
    })
  );
}

