/* ============================================================
   ICONOS
   ============================================================ */
const I = {
  // v4 nav: casa / lista / calendario / tendencia (stroke 2.1, ~22 px)
  home:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("path",{d:"M3 10.5L12 3l9 7.5"}),React.createElement("path",{d:"M5 10v10h14V10"}),React.createElement("path",{d:"M10 20v-6h4v6"})),
  calendar:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("rect",{x:3,y:5,width:18,height:16,rx:2}),React.createElement("path",{d:"M3 10h18M8 3v4M16 3v4"})),
  expense:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("path",{d:"M3 7h18M3 12h18M3 17h12"})),
  invest:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.1",width:22,height:22},p),React.createElement("path",{d:"M3 17l6-6 4 4 7-8M21 7v6M21 7h-6"})),
  sync:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.2"},p),React.createElement("path",{d:"M21 12a9 9 0 1 1-2.6-6.4M21 4v4h-4"})),
  plus:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.4"},p),React.createElement("path",{d:"M12 5v14M5 12h14"})),
  chev:(p)=>React.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2.4",width:"18",height:"18"},p),React.createElement("path",{d:"M6 9l6 6 6-6"})),
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
    // Tarjeta de patrimonio. El delta mensual se retiró: sin foto real del día 1 era engañoso.
    const py=Math.max(y+30, 1030);
    g.fillStyle=surface; round(72,py,W-144,190,28); g.fill(); g.strokeStyle=line; round(72,py,W-144,190,28); g.stroke();
    g.fillStyle=muted; g.font="700 27px Manrope, sans-serif"; g.fillText(t("rp_networth").toUpperCase(), 116, py+38);
    g.fillStyle=text;  g.font="700 64px Manrope, sans-serif"; g.fillText(eur0(tt.netWorth), 112, py+80);
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
  return React.createElement("div",{className:"card"},
    React.createElement("div",{className:"card-head",onClick:toggle},
      React.createElement("div",{className:"card-title"},
        dot && React.createElement("span",{className:"dot",style:{background:dot}}),
        React.createElement("div",null, title, sub && React.createElement("div",{className:"sub"},sub))
      ),
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
        help && React.createElement(HelpTip,{text:help}),
        right, React.createElement(I.chev,{className:"chev"+(open?" open":"")})
      )
    ),
    React.createElement("div",{className:"collapsible"+(open?" open":"")},
      React.createElement("div",null, React.createElement("div",{className:"card-body"},children))
    )
  );
}

function mcReduced(){
  try{ return document.documentElement.classList.contains("reduce-motion")||(window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches); }catch(e){ return false; }
}

/* Count-up compartido (B2). `ready` es la puerta: Inicio espera `mc-splash-gone`; Cartera espera
   el bus `mcOnCarteraActive`. Sin puerta, la animación se gasta con la pestaña premontada (o
   detrás del splash) y al llegar el número ya está puesto — peor que no animar. */
function useCountUp(target, ready, replay){
  const [shown,setShown]=useState(0);
  const rafRef=useRef(0);
  const shownRef=useRef(0);
  const primeraRef=useRef(true);
  useEffect(function(){
    /* Gestionar queda montado detrás de Plan. Si solo paramos el RAF al cerrarlo, conserva el
       total final y la siguiente entrada ya no tiene animación; `replay` devuelve el contador a
       cero mientras está oculto sin cambiar Inicio ni Cartera (feedback 2026-09-18). */
    if(!ready){
      if(replay){ shownRef.current=0; primeraRef.current=true; setShown(0); }
      return undefined;
    }
    const tgt=+(target||0);
    cancelAnimationFrame(rafRef.current);
    if(mcReduced()){
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
  },[target, ready, replay]);
  return shown;
}

function recordAccountBalances(hist, day, rows){
  var out=hist||{}, changed=false;
  (rows||[]).forEach(function(r){
    if(!r.key||typeof r.value!=="number"||!Number.isFinite(r.value)) return;
    const prev=out[r.key]||[], last=prev[prev.length-1];
    if(last&&last.day===day&&last.value===r.value) return;
    if(!changed){ out=Object.assign({},out); changed=true; }
    const list=prev.filter(function(p){ return p&&p.day&&typeof p.value==="number"&&Number.isFinite(p.value); }).slice(last&&last.day===day?-400:-399);
    if(list.length&&list[list.length-1].day===day) list[list.length-1]={day:day,value:r.value};
    else list.push({day:day,value:r.value});
    out[r.key]=list;
  });
  return out;
}
// Las fotos de bancos desacompasados inventaban pérdidas de traspasos. El total de hoy
// se recorre hacia atrás con flujos; sólo las cuentas manuales sin movimientos usan escalones.
function recordAssetValues(history, day, assets, previous, bornId){
  let out=history||{},changed=false;
  const by={};(assets||[]).forEach(function(a){if(a.id&&Number.isFinite(a.value))by[a.id]=a;});
  const ids=new Set(Object.keys(out));Object.keys(by).forEach(function(id){ids.add(id);});
  (previous||[]).forEach(function(a){if(a.id)ids.add(String(a.id));});
  ids.forEach(function(id){
    const list=out[id]||[],last=list[list.length-1],a=by[id],value=a?a.value:0;
    if(last&&last.value===value)return;
    // La llegada de una lista tras reinstalar no acredita una compra: sólo Guardar
    // en Bienes puede marcar el alta. El montaje tampoco inventa una revaloración.
    const born=!!a&&bornId!=null&&String(bornId)===id,prior=(previous||[]).find(function(p){return String(p.id)===id;});
    if(!last&&!born&&(!prior||prior.value===value))return;
    const point={day:day,value:value};if(born||(last&&last.day===day&&last.born))point.born=true;
    const kept=list.filter(function(p){return p&&p.day<day&&Number.isFinite(p.value);});
    // Revalorar un bien heredado sin escalones dejaba el valor nuevo como primer dato y la
    // gráfica de Inicio se reiniciaba ese día. El valor anterior sí se conoce al guardar:
    // queda anotado la víspera como `legacy` y se mantiene hacia atrás (revisión 13/10).
    if(!last&&!born&&prior&&Number.isFinite(prior.value))
      kept.push({day:new Date(Date.parse(day+"T12:00:00Z")-864e5).toISOString().slice(0,10),value:prior.value,legacy:true});
    const next=kept.slice(-399).concat(point);
    if(!changed){out=Object.assign({},out);changed=true;}out[id]=next;
  });
  return changed?out:history;
}
function netWorthDay(nowMs){
  // La serie etiqueta movimientos en Madrid; «hoy» no puede cerrarla un día antes en UTC.
  const p=madridYmdParts(nowMs==null?Date.now():nowMs);
  return p.ym+"-"+String(p.d).padStart(2,"0");
}
function netWorthDebtPolicy(state, today, current){
  const parts=today.split("-").map(Number), month=parts[0]*12+parts[1]-1;
  const debts=state.debts||[], notes=[];
  // Hacia atrás se deshace el cuadro de cuotas que debtBalance aplica hacia delante: saldo de
  // entonces = saldo de hoy + la amortización de cada cargo entre esa fecha y hoy, contado por
  // el día de cuota. Así el día de la cuota la gráfica solo baja los intereses y el último punto
  // es el saldo que pinta la app, también si el cargo de este mes aún no ha pasado.
  const rebuilt=function(d){ return d.months==null&&debtAmort(d)>0&&Number(d.value)>0.005&&!d.settledAt; };
  // El tipo se teclea a mano: «1,05» vale como 1,05 y un tipo cuyos intereses de un mes igualan o
  // superan la cuota (un 105 por 1,05) no se aplica: la deuda crecería hacia delante y la gráfica
  // inventaría 13.000 € de caída en un mes (revisión 14/10). La «i» lo dice.
  const aprOf=function(d){ const v=d.apr==null||d.apr===""?NaN:Number(String(d.apr).replace(",",".")); return Number.isFinite(v)?v:null; };
  const rateOf=function(d){
    const apr=aprOf(d);
    if(d.months!=null||d.amort!=null||!(apr>0)) return {rate:0,bad:false};
    const rate=apr/1200,today=Number(d.value)-debtAmort(d)*Math.max(0,month-(typeof d.asOf==="number"?d.asOf:month));
    return today*rate>=Number(d.monthly)?{rate:0,bad:true}:{rate:rate,bad:false};
  };
  const at=function(d,day){
    // Una fecha de referencia explícita no pone la deuda a cero antes: con una hipoteca sellada
    // al darla de alta inflaría el patrimonio anterior en todo su principal (revisión 13/10).
    // Antes de la fecha se mantiene el saldo (o su cuadro, como las demás).
    const p=day.split("-").map(Number), charge=debtChargeDay(d);
    const anchor=typeof d.asOf==="number"?d.asOf:month;
    const paidToday=(month-anchor)+(d.months!=null&&charge<=parts[2]?1:0);
    const between=(month+(charge<=parts[2]?1:0))-((p[0]*12+p[1]-1)+(charge<=p[2]?1:0));
    let n=paidToday-between;
    // Con plazo, el ancla es el inicio del préstamo: antes no debía más que el saldo ancla.
    // Sin plazo, la hipoteca o el préstamo existían ya; sin cuota o liquidada, se mantiene.
    if(d.months!=null||!rebuilt(d)) n=Math.max(0,n);
    let value=Number(d.value)-debtAmort(d)*n;
    // Con tipo de interés, no toda la cuota es capital: cada mes hacia atrás se deshace
    // «saldo × (1 + tipo/12) − cuota», así la gráfica resta los intereses (la hipoteca al 1 %
    // contaba sus 660,85 € enteros como capital, ~148 € de más al mes; revisión 14/10). Sólo
    // hipotecas y préstamos sin plazo, que son los que se reconstruyen hacia atrás; sin tipo
    // se queda la cuota entera y la «i» lo dice. Con un `amort` propio manda ese capital.
    const rate=rateOf(d).rate;
    if(rate&&n<paidToday){
      value=Number(d.value)-debtAmort(d)*paidToday;
      for(let k=n;k<paidToday;k++) value=(value+Number(d.monthly))/(1+rate);
    }
    if(d.balloon>0&&d.months!=null&&n>=d.months) value-=d.balloon;
    if(n<0&&d.original>0) value=Math.min(value,Math.max(Number(d.original),Number(d.value)));
    return Math.max(0,value);
  };
  debts.forEach(function(d){
    // El ancla mensual de una hipoteca o un préstamo dados de alta (o con el saldo corregido)
    // antes de esta versión no dice cuándo nació: antes recortaba la serie a hoy y dejaba Inicio
    // sin gráfica (13/10). Se reconstruye por cuotas y se declara en la «i».
    const estimated=debtAmort(d)>0&&Number(d.value)>0.005&&!d.settledAt;
    notes.push({kind:"debt",name:d.name,estimated:estimated,constant:!estimated,noRate:estimated&&rebuilt(d)&&d.amort==null&&aprOf(d)==null,badRate:estimated&&rebuilt(d)&&rateOf(d).bad});
  });
  const sum=function(day){ return debts.reduce(function(n,d){ return n+at(d,day); },0); };
  const value=current!=null?current:sum(today);
  return {current:value,notes:notes,timingUnknown:debts.some(function(d){return d.months==null&&!(dayOf(d)>0);}),at:function(day){ return day===today?value:sum(day); }};
}
function netWorthSeries(state, options){
  options=options||{};
  const today=options.today||netWorthDay();
  const deps=[today,options.liquid,options.invested,options.debtTotal,state.accounts,state.obAccounts,state.expenses,
    state.deleted,state.accountBalanceHistory,state.invHistory,state.investments,state.assets,state.assetValueHistory,state.debts,state.flows,
    state.fixed,state.oneoffs,state.bankTx,state.settings,state.fxRates,state.fx,state.aportaciones,
    options.balanceInputs&&options.balanceInputs.paidNetByBank,options.balanceInputs&&options.balanceInputs.spentByBank];
  const cache=netWorthSeries.cache||(netWorthSeries.cache=[]);
  const hit=cache.find(function(c){ return c.deps.every(function(v,i){ return v===deps[i]; }); });
  if(hit) return hit.series;
  const gaps=[], out=[];
  const done=function(){ out.coverage=gaps;out.fresh=!(state.expenses||[]).length&&!Object.values(state.accountBalanceHistory||{}).some(function(a){return a.length>1;})&&(state.invHistory||[]).length<2;cache.unshift({deps:deps,series:out});cache.length=Math.min(cache.length,4);return out; };
  const utcFmt=netWorthSeries.utcFmt||(netWorthSeries.utcFmt=new Intl.DateTimeFormat("en-CA",{timeZone:"UTC",year:"numeric",month:"2-digit",day:"2-digit"}));
  const fmt=netWorthSeries.fmt||(netWorthSeries.fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}));
  const clean=function(list,day,value){
    const by={};
    (list||[]).forEach(function(p){
      const d=p&&p[day],v=p&&p[value];
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d||"")||typeof v!=="number"||!Number.isFinite(v)||d>today) return;
      const ms=Date.parse(d+"T12:00:00Z");
      if(Number.isFinite(ms)&&utcFmt.format(ms)===d) by[d]=Object.assign({},p,{day:d,value:v});
    });
    return Object.keys(by).sort().map(function(d){ return by[d]; });
  };
  const rows=accountRowsInOrder(state), owned=Object.create(null), hist=state.accountBalanceHistory||{};
  const ins=options.balanceInputs?Object.assign({},options.balanceInputs,{roundup:options.balanceInputs.roundupThisMonth,monthlyInvest:options.balanceInputs.monthlyInvestThisMonth}):insumosSaldoGasto(state);
  rows.forEach(function(r){ if(r.item.ent) owned[r.item.ent]=true; });
  // Solo cuenta su parte de cada cuenta (`accountShareOf`): el saldo de hoy, sus cierres y sus
  // movimientos. Sin parte puesta el factor es 1 y la serie sale idéntica al céntimo.
  const shares=rows.map(function(r){ return accountShareOf(state,r.item,r.kind); });
  const values=rows.map(function(r,i){
    if(typeof r.item.value!=="number"||!Number.isFinite(r.item.value)) return null;
    const v=r.kind==="ob"?toEurAmt(r.item.value,r.item.cur||"EUR",state):saldoCuentaMostrada(r.item,ins);
    return typeof v==="number"&&shares[i]!==1?v*shares[i]:v;
  });
  if(values.some(function(v){ return typeof v!=="number"||!Number.isFinite(v); })){
    gaps.push({kind:"balance",unknown:true,name:rows.filter(function(r,i){ return values[i]==null; }).map(function(r){ return r.item.name||r.item.ent; }).join(", ")});return done();
  }
  /* De qué cuenta salió cada movimiento: los nuevos de Open Banking guardan la suya (`obAcc`). Los
     de antes no, y un banco con dos cuentas a partes distintas (la personal al 100 % y la conjunta
     al 50 % en Revolut) no deja saber a cuál aplicar: ahí cuentan enteros, como siempre, y la «i»
     lo dice. Repartirlos por saldo sería inventar (con las dos a cero ni siquiera hay saldo). Si
     todas las cuentas del banco tienen la misma parte, esa vale para todos sus movimientos. */
  const byBank={}, unsplit={}, decided={};
  rows.forEach(function(r,i){ if(r.item.ent) (byBank[r.item.ent]||(byBank[r.item.ent]=[])).push({r:r,s:shares[i]}); });
  /* Lo que él decidió para los movimientos viejos sin cuenta de ese banco (`accountLegacyFor`):
     «son de esta cuenta» les pone la parte de esa cuenta; «no son de esta» los deja entre las
     demás, y si todas ellas tienen la misma parte, esa. Solo hasta el día en que lo decidió: lo
     que entre después sin cuenta no lo ha visto. */
  const legacy=(state.settings||{}).accountShareLegacy||{};
  const factorOf=function(e,bank,day){
    let list=byBank[bank];
    if(e.obAcc){ const hit=list.find(function(x){ return accountOwnsMovement(x.r.item,x.r.kind,e.obAcc); }); if(hit) return hit.s; }
    const dec=!e.obAcc&&legacy[bank];
    if(dec&&day<=dec.day){
      const mine=function(x){ return accountShareKey(x.r.item,x.r.kind)===dec.key; };
      const hit=list.find(mine);
      if(hit) decided[bank]=true;
      if(hit&&!dec.no) return hit.s;
      if(hit&&list.length>1) list=list.filter(function(x){ return !mine(x); });
    }
    if(list.every(function(x){ return x.s===list[0].s; })) return list[0].s;
    // Un apunte a cero no mueve nada que haya que separar: no avisa.
    if(e.amount) unsplit[bank]=true; return 1;
  };
  const del=expenseDeletedSet(state), entries=[], byAmount={}, firstByBank={}, hours={};
  (state.expenses||[]).forEach(function(e){
    if(!e||e.possibleDup||expenseIsTombstoned(e,del)||typeof e.amount!=="number"||!Number.isFinite(e.amount)||
      (e.status&&String(e.status).toUpperCase()!=="BOOK")) return;
    const bank=expenseBankOf(e);if(!owned[bank]) return;
    const raw=String(e.date||"").trim(),ms=/^\d{4}-\d{2}-\d{2}/.test(raw)?Date.parse(raw):_pdMs(raw);
    if(!Number.isFinite(ms)) return;
    const hour=Math.floor(ms/3600000),bounds=hours[hour]||(hours[hour]=[fmt.format(hour*3600000),fmt.format(hour*3600000+3599999)]);
    const day=bounds[0]===bounds[1]?bounds[0]:fmt.format(ms);if(day>today) return;
    const row={expense:e,bank:bank,day:day,ms:ms,cents:Math.round(e.amount*100),f:factorOf(e,bank,day)};entries.push(row);
    if(!firstByBank[bank]||day<firstByBank[bank]) firstByBank[bank]=day;
    if(row.cents){const key=Math.abs(row.cents);(byAmount[key]||(byAmount[key]=[])).push(row);}
  });
  // La categoría sola no acredita un traspaso propio: dos patas únicas, opuestas,
  // en bancos presentes y cercanas. Repetir el importe meses después no vuelve ambiguo ese par.
  Object.keys(byAmount).forEach(function(key){
    const group=byAmount[key];if(!group.some(function(p){return p.cents<0;}))return;
    const hinted=group.filter(function(p){return p.expense.category==="traspaso";});if(!hinted.length)return;
    group.sort(function(a,b){return a.ms-b.ms;});const mates=new Map();
    hinted.forEach(function(a){
      // Son tres días civiles de Madrid: el cambio horario y la hora del apunte
      // no adelantan ni retrasan el límite de la contrapartida (14/10).
      const civil=Date.parse(a.day+"T12:00:00Z"),from=utcFmt.format(civil-3*864e5),to=utcFmt.format(civil+3*864e5);
      let low=0,high=group.length;
      while(low<high){const mid=(low+high)>>1;if(group[mid].day<from)low=mid+1;else high=mid;}
      for(let i=low;i<group.length&&group[i].day<=to;i++){
        const b=group[i],cat=b.expense.category;
        // Dentro del mismo banco solo hay par si las dos patas dicen su cuenta y son distintas (de
        // la personal a la conjunta): con la misma parte sigue neutro, como antes sin par.
        const sameAcc=a.bank===b.bank&&!(a.expense.obAcc&&b.expense.obAcc&&a.expense.obAcc!==b.expense.obAcc);
        if(sameAcc||a.cents!==-b.cents||(cat&&cat!=="traspaso"&&cat!=="otros"))continue;
        // Una entrada bancaria del mismo importe no acredita los billetes del cajero.
        if(a.cents>0&&isAtmWithdrawal(a.expense.merchant)&&!isEfectivoEnt(b.bank)||b.cents>0&&isAtmWithdrawal(b.expense.merchant)&&!isEfectivoEnt(a.bank))continue;
        const ar=a.expense.transferId,br=b.expense.transferId;if(ar&&br&&ar!==br)continue;
        if(!mates.has(a))mates.set(a,new Set());if(!mates.has(b))mates.set(b,new Set());
        mates.get(a).add(b);mates.get(b).add(a);
      }
    });
    mates.forEach(function(list,a){if(list.size!==1)return;const b=Array.from(list)[0];if(mates.get(b).size===1){a.ownTransfer=b.bank;b.ownTransfer=a.bank;a.mate=b;b.mate=a;}});
  });
  // Emparejados los traspasos con el importe entero, cada movimiento pesa ya su parte.
  entries.forEach(function(row){ if(row.f!==1) row.cents=Math.round(row.expense.amount*100*row.f); });
  const manual=[], flowBanks={}, later=[];
  let first="";
  rows.forEach(function(r,i){
    const bank=r.item.ent,points=clean(hist[r.key],"day","value"),cash=isEfectivoEnt(r.item);
    const tracked=r.kind==="ob"||r.item.bankIban||(!points.length&&firstByBank[bank])||accDaily(r.item);
    if(tracked){
      flowBanks[bank]=true;
      // Antes el banco con el histórico más corto recortaba la serie entera («cobertura de TODOS
      // los bancos»): con gastos desde junio, la gráfica empezaba en septiembre (13/10). Ahora
      // arranca en el primer movimiento y, antes del suyo, cada cuenta se queda con su saldo de
      // entonces (sin flujos no hay nada que deshacer); la «i» lo declara.
      if(firstByBank[bank]&&!cash) later.push({day:firstByBank[bank],kind:"bank",name:r.item.name||(ENT[bank]&&ENT[bank].label)||bank});
    }else{
      // Antes del primer cierre, la cuenta manual conserva ese primer saldo: es la misma
      // aproximación que ya se hace sin historial y que un bien heredado, y un sobre de
      // efectivo con un cierre de hace dos semanas recortaba toda la serie a esa fecha (13/10).
      // Los cierres guardan el saldo entero: pesan la misma parte que el de hoy.
      const part=shares[i]===1?points:points.map(function(p){ return Object.assign({},p,{value:p.value*shares[i]}); });
      manual.push({value:values[i],points:part,before:part.length?part[0].value:0});
      if(points.length) gaps.push({day:points[0].day,kind:"manual",name:r.item.name||bank,constant:true,prior:true});
    }
    if(points.length&&(!first||points[0].day<first)) first=points[0].day;
  });
  entries.forEach(function(e){if(!first||e.day<first)first=e.day;});
  const investments=clean(state.invHistory,"d","v"),hasInv=(state.investments||[]).length>0;
  if((state.investments||[]).some(function(i){ return invValueEur(i,state)==null; })){gaps.push({kind:"investment",unknown:true});return done();}
  const invested=options.invested!=null?options.invested:(state.investments||[]).reduce(function(n,i){ return n+(invValueEur(i,state)||0); },0)+(ins.roundup||0)+(ins.monthlyInvest||0);
  // Sin foto anterior, la inversión no recorta: se mantiene su primer valor conocido (la primera
  // foto, o el de hoy si no hay ninguna) menos las aportaciones propias entre medias, como un
  // bien heredado. Antes bastaba un bróker recién dado de alta para dejar Inicio sin gráfica.
  const invKnown=investments.length?investments[0]:(hasInv||invested!==0)?{day:today,value:invested}:null;
  // Fotos con las que se casa cada aportación: las del histórico y la de hoy (lo que pinta
  // Cartera). Lo que una foto sube sobre la anterior es el hueco que puede llenar lo aportado.
  const photos=investments.filter(function(p){ return p.day<today; }).concat(invKnown?[{day:today,value:invested}]:[]);
  const room=photos.map(function(p,i){ return i?Math.round((p.value-photos[i-1].value)*100):Infinity; });
  // Un bróker sin cuenta propia en la app con aportación periódica: la salida del banco por ese
  // importe, a nombre del titular, es esa aportación aunque el banco la llame «traspaso» u
  // «otros» (MyInvestor, 500 € a fin de mes, revisión 14/10). Si el bróker tiene su cuenta (aunque
  // sea manual), la llegada ya la recoge ese saldo: contarla aquí también la sumaba dos veces.
  const plans=(state.aportaciones||[]).filter(function(p){ return p&&p.amount>0&&!flowBanks[p.ent]&&!owned[p.ent]&&(state.investments||[]).some(function(i){ return i.ent===p.ent; }); });
  // «A nombre del titular»: el concepto lleva su nombre (dos palabras del perfil) o «yo mismo».
  // Una transferencia del mismo importe al casero no es una aportación.
  const holder=recNorm(state.settings&&state.settings.profile&&state.settings.profile.fullName).split(" ").filter(function(w){ return w.length>=3; });
  const toHolder=function(e){
    const text=" "+recNorm([e.merchant,e.note,e.concept].join(" "))+" ";
    return /\byo mismo\b|\bmismo titular\b|\bcuenta propia\b/.test(text)||holder.length>=2&&holder.filter(function(w){ return text.indexOf(" "+w+" ")>=0; }).length>=2;
  };
  const daily={},contribs=[],hasCash=rows.some(function(r){return isEfectivoEnt(r.item);});
  entries.forEach(function(row){
    const e=row.expense,day=row.day;
    // Un cierre manual ya recoge su pata: sólo dos cuentas reconstruidas por flujos
    // permiten neutralizar ambas sin perder el traspaso (revisión12/10).
    // Entre dos cuentas con distinta parte el traspaso sí mueve lo suyo: 1.000 € de su cuenta a la
    // conjunta al 50 % son 500 € que pasan a ser de la pareja. Cada pata cuenta con su parte.
    if(!flowBanks[row.bank]||(row.ownTransfer&&flowBanks[row.ownTransfer]&&row.f===row.mate.f)) return;
    // Con partes distintas no cuenta ninguna pata: solo la diferencia (salida × su parte − llegada ×
    // la suya), el día de la salida. Contar cada pata en su día pintaba un bache de −1.000 mientras
    // el dinero viajaba de la personal (día 10) a la conjunta (día 12), en vez de −500 (revisión 14/10).
    if(row.ownTransfer&&flowBanks[row.ownTransfer]){ if(e.amount>0) daily[day]=(daily[day]||0)-(row.cents+row.mate.cents); return; }
    // Sin bolsillo de efectivo la retirada sale del patrimonio registrado; la categoría
    // elegida en Gastos no acredita que otra cuenta haya recibido esos billetes (14/10).
    if(!row.ownTransfer&&e.amount>0&&isAtmWithdrawal(e.merchant)){
      if(!hasCash) daily[day]=(daily[day]||0)-row.cents;
      return;
    }
    const text=String(e.merchant||"").toLowerCase(),target=e.toBank||e.to||e.counterpartyBank;
    const plan=!!invKnown&&!row.ownTransfer&&e.amount>0&&(e.category==="traspaso"||e.category==="otros")&&
      /transferencia|traspaso|transfer/i.test([e.merchant,e.note,e.concept].join(" "))&&toHolder(e)&&plans.some(function(p){ return Math.abs(p.amount-e.amount)<0.005; });
    const linked=plan||!!invKnown&&e.amount!==0&&(state.investments||[]).some(function(i){
      const name=String(i.ent||"").replace(/_/g," ").toLowerCase();
      return (e.investmentId&&e.investmentId===i.id)||(target&&target===i.ent)||(name.length>=4&&text.includes(name));
    });
    // La categoría no prueba que el dinero siga en el patrimonio registrado: sin otra
    // pata propia, enlace a bróker o aportación periódica, es una salida (decisión 14/10).
    // Una salida de una sola pata hacia un bróker (traspaso con enlace, o la aportación
    // periódica) se decide abajo: si una foto de inversiones la recoge, es aportación. Sin
    // enlace no: medido con la cartera real, el vaivén diario de la bolsa «recogía» un seguro de
    // viaje de 247 € o un cambio de divisa de Revolut y movía 300 € la comparación (14/10).
    const transit=!row.ownTransfer&&e.amount>0&&((e.category==="traspaso"&&linked)||plan);
    if(transit||e.category==="inversion"||(e.category==="traspaso"&&linked)) contribs.push({row:row,day:day,cents:row.cents,transit:transit,plan:plan});
    else daily[day]=(daily[day]||0)-row.cents;
  });
  // El dinero que va a un bróker cuenta como inversión DESDE QUE SALE DEL BANCO y se queda ahí
  // hasta la primera foto que lo incluye, en diez días. Antes se daba por incluido en la foto del
  // mismo día: con fotos diarias y un bróker que tarda (30/9 → 6/10) salía un bache de −500 € en
  // tránsito, y el traspaso neutro dejaba todos los días anteriores 500 € más bajos (+1.452 «más
  // que el mes pasado» con +952 de verdad). Un traspaso enlazado por otra pista necesita una foto
  // que suba la mitad de lo aportado; la aportación periódica ya está identificada y basta con
  // una cuarta parte, así llega aunque la bolsa caiga ese día (+200 de 500 con −300 de bolsa).
  const WINDOW=10*864e5,todayMs=Date.parse(today+"T12:00:00Z");
  contribs.sort(function(x,y){ return x.row.ms-y.row.ms; }).forEach(function(c){
    c.absorb=null;
    if(c.cents>0) for(let i=0;i<photos.length;i++){
      if(photos[i].day<c.day||Date.parse(photos[i].day+"T12:00:00Z")-Date.parse(c.day+"T12:00:00Z")>WINDOW) continue;
      if(room[i]*(c.plan?4:2)>=c.cents){ room[i]-=c.cents; c.absorb=photos[i].day; break; }
    }
  });
  // Lo que ninguna foto recoge no se inventa. Una aportación periódica que aún puede llegar
  // (menos de diez días) sigue contando como inversión hasta ayer; hoy manda lo que dice Cartera,
  // que no sabe del dinero en camino. Pasados diez días sin foto, vuelve a ser una salida.
  // Un traspaso enlazado queda neutro, una transferencia «otros» es gasto, y una aportación
  // declarada se da por incluida el mismo día, como siempre.
  const kept=contribs.filter(function(c){
    if(c.absorb==null&&c.plan&&todayMs-Date.parse(c.day+"T12:00:00Z")<=WINDOW) c.absorb="9999-12-31";
    if(c.absorb==null&&c.transit){ if(c.plan||c.row.expense.category==="otros") daily[c.day]=(daily[c.day]||0)-c.cents; return false; }
    if(c.absorb==null) c.absorb=c.day;
    daily[c.day]=(daily[c.day]||0)-c.cents;return true;
  });
  const assetRows=[], assetHist=state.assetValueHistory||{};
  const assetIds=new Set(Object.keys(assetHist));(state.assets||[]).forEach(function(a){assetIds.add(String(a.id));});
  assetIds.forEach(function(id){
    // El valor anterior sólo vale como primer dato: tras unir dos dispositivos que revaloraron
    // el mismo bien, una segunda marca en medio pintaría una subida que nadie apuntó.
    const a=(state.assets||[]).find(function(x){return String(x.id)===id;}),points=clean(assetHist[id]||(a&&(a.valueHistory||a.history)),"day","value").filter(function(p,i){return !i||!p.legacy;});
    if(a&&(!Number.isFinite(a.value))){gaps.push({kind:"asset",name:a.name,unknown:true});return;}
    const value=a?a.value:0,legacy=points.length>0&&!!points[0].legacy;
    // Un bien con escalones propios tampoco recorta: antes del primero conserva ese primer valor.
    const stepped=!legacy&&points.length>0&&!points[0].born;
    assetRows.push({value:value,points:points,before:legacy||stepped?points[0].value:0});
    if(legacy||stepped)gaps.push({day:legacy&&points.length>1?points[1].day:legacy?today:points[0].day,kind:"asset",name:a&&a.name,constant:true,prior:true});
    else if(!points.length&&a)gaps.push({kind:"asset",name:a.name,constant:true});
  });
  if(gaps.some(function(g){return g.unknown;}))return done();
  const debt=netWorthDebtPolicy(state,today,options.debtTotal);
  if(!Number.isFinite(debt.current)){gaps.push({kind:"debt",unknown:true});return done();}
  if(debt.timingUnknown)gaps.push({kind:"debt",timingUnknown:true});
  debt.notes.forEach(function(n){gaps.push(n);});
  const start=first||today;
  rows.forEach(function(r,i){ if(shares[i]!==1) gaps.push({kind:"share",name:r.item.name||r.item.ent,pct:Math.round(shares[i]*10000)/100}); });
  const anyShared=shares.some(function(s){ return s!==1; });
  Object.keys(decided).forEach(function(b){ if(flowBanks[b]&&anyShared) gaps.push({kind:"share",legacy:true,name:(ENT[b]&&ENT[b].label)||b}); });
  Object.keys(unsplit).forEach(function(b){ if(flowBanks[b]) gaps.push({kind:"share",unsplit:true,name:(ENT[b]&&ENT[b].label)||b}); });
  // Lo que se mantiene constante antes de su primer dato se declara, en corto, en la «i»; un
  // «antes del» que cae fuera de la gráfica no cuenta nada y se calla.
  for(let i=gaps.length-1;i>=0;i--)if(gaps[i].prior&&gaps[i].day<=start)gaps.splice(i,1);
  if(invKnown&&invKnown.day>start)gaps.push({day:invKnown.day,kind:"investment",constant:true});
  later.forEach(function(l){if(l.day>start)gaps.push(Object.assign({later:true},l));});
  const liquid=options.liquid!=null?options.liquid:values.reduce(function(n,v){return n+v;},0);
  const assets=(state.assets||[]).reduce(function(n,a){return n+a.value;},0),manualNow=manual.reduce(function(n,m){return n+Math.round(m.value*100);},0);
  if(!Number.isFinite(liquid)||!Number.isFinite(invested)){gaps.push({kind:"balance"});return done();}
  let cash=Math.round((liquid+invested+assets-debt.current)*100)-Math.round(invested*100)-Math.round(assets*100)+Math.round(debt.current*100)-manualNow;
  const steps=manual.concat(assetRows),indices=steps.map(function(s){return s.points.length-1;});
  // Suma acumulada por día: lo aportado hasta ese día y lo que ya recoge la foto de ese día.
  const sumBy=function(key){
    const list=kept.slice().sort(function(x,y){ return x[key]<y[key]?-1:x[key]>y[key]?1:0; });let n=0;
    const acc=list.map(function(c){ n+=c.cents;return n; });
    return function(day){ let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>1;if(list[mid][key]<=day)lo=mid+1;else hi=mid;}return lo?acc[lo-1]:0; };
  };
  const happenedBy=sumBy("day"),includedBy=sumBy("absorb");
  let invIndex=investments.length-1;
  for(let ms=Date.parse(today+"T12:00:00Z"),from=Date.parse(start+"T12:00:00Z");ms>=from;ms-=864e5){
    const day=utcFmt.format(ms);
    while(invIndex>=0&&investments[invIndex].day>day)invIndex--;
    // Antes de la primera foto vale la primera foto menos lo aportado entre medias: así una
    // aportación al bróker de agosto no sale como pérdida, aunque la foto más antigua sea de
    // septiembre. Sin suelo en cero: si se aportó más de lo que dice la foto, el total queda
    // plano en vez de pintar la aportación como una caída (revisión 13/10).
    const photo=invIndex>=0?investments[invIndex]:invKnown;
    let inv=day===today?invested:photo?photo.value+(happenedBy(day)-includedBy(photo.day))/100:0;
    let value=cash+Math.round(inv*100)-Math.round(debt.at(day)*100);
    steps.forEach(function(s,i){
      while(indices[i]>=0&&s.points[indices[i]].day>day)indices[i]--;
      const v=day===today||!s.points.length?s.value:indices[i]>=0?s.points[indices[i]].value:s.before||0;
      value+=Math.round(v*100);
    });
    out.push({day:day,value:value/100});cash-=daily[day]||0;
  }
  out.reverse();return done();
}

// Mismo día de hace `months` meses en el calendario de la serie (días de Madrid). Si ese día
// no existe (31 → 30 de septiembre, 29/2 en año no bisiesto) cae en el último día del mes.
function netWorthMonthsBack(day, months){
  const end=new Date(day+"T12:00:00Z");
  const d=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-months,1,12));
  const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(max,end.getUTCDate()));
  return d.toISOString().slice(0,10);
}
const NW_MONTHS={"1m":1,"3m":3,"6m":6,"1y":12};
function netWorthRanges(series, today){
  if(!series||series.length<2) return [];
  const first=series[0].day, last=series[series.length-1].day;
  const out=[];
  ["1m","3m","6m","1y"].forEach(function(id){
    // Los meses del selector se comparan con hoy, no con una foto bancaria atrasada.
    if(today&&last!==today) return;
    const start=netWorthMonthsBack(last,NW_MONTHS[id]);
    if(first<=start) out.push({id:id,points:series.filter(function(p){ return p.day>=start; })});
  });
  out.push({id:"all",points:series}); return out;
}
// «X más que el mes pasado» compara los dos extremos que se ven en la gráfica: hoy frente al
// mismo día de hace 1, 3, 6 o 12 meses, y «Todo» frente al primer punto. Se mueve cada día,
// como la gráfica (decisión del dueño, 14/10). Antes comparaba el mínimo de dos ventanas de
// 45 días suponiendo que era la víspera del cobro; con un patrimonio que sube dentro del mes
// (cuotas que son capital, bolsa) el mínimo caía en el borde de la ventana y mezclaba dos
// nóminas con un mes de gastos: decía +3.769 € con +1.452 de verdad, y cambiaba de un día a
// otro sin moverse un euro. Con menos de 45 días de serie no hay frase (lo que no se sabe no
// se inventa, AGENTS §1); el periodo además tiene que caber entero en la serie, que es justo
// cuando el selector lo ofrece, así la cifra siempre casa con la gráfica que se ve.
const NW_WINDOW=45;
function netWorthCompare(series, rangeId, today, invested){
  if(!series||series.length<NW_WINDOW+1) return null;
  const last=series[series.length-1], months=NW_MONTHS[rangeId];
  let from=series[0];
  if(months){
    const start=netWorthMonthsBack(last.day,months);
    if(start<from.day) return null;
    from=series.find(function(p){ return p.day>=start; });
  }
  const delta=Math.round((last.value-from.value)*100)/100;
  const days=Math.round((Date.parse(last.day+"T12:00:00Z")-Date.parse(from.day+"T12:00:00Z"))/864e5);
  // El margen solo decide el color: 2 % de lo invertido (el vaivén de un día de bolsa) entre
  // 10 € y 300 €; sin tope, 150.000 € invertidos escondían un gasto extra de 2.500 € dos meses.
  const margin=Math.min(300,Math.max(10,Math.abs(invested||0)*.02));
  return {delta:delta,days:days,months:months||Math.max(1,Math.round(days/30.44)),verdict:delta>margin?"up":delta<-margin?"down":"flat",margin:margin};
}
function netWorthChartGeometry(points){
  if(!points||points.length<2) return null;
  const values=points.map(function(p){ return p.value; }), min=Math.min.apply(null,values), max=Math.max.apply(null,values);
  const mean=values.reduce(function(a,b){ return a+b; },0)/values.length;
  const span=Math.max(max-min,Math.abs(mean)*.06,1);
  // Una media sesgada puede dejar el extremo fuera del SVG. Se desplaza lo mínimo el
  // centro para conservar el margen y mostrar todos los valores, nunca recortar un pico.
  const mid=Math.max(max-span/2,Math.min(min+span/2,mean));
  const xy=values.map(function(v,i){ return {x:4+i/(values.length-1)*312,y:40-(v-mid)/span*64}; });
  const path=xy.map(function(p,i){ return (i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2); }).join(" ");
  return {xy:xy,path:path,fill:path+" L316 80 L4 80 Z",span:span};
}
function netWorthDeltaMoney(value){
  return String(Math.round(Math.abs(value)*DISP.k)).replace(/\B(?=(\d{3})+(?!\d))/g,".")+" "+DISP.sym;
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

/* ---- Cierre de overlays con el gesto/botón "atrás" del móvil (History API) ----
   Sin esto, el gesto de retroceso hace history.back() y, al no haber una entrada
   propia, SALE de la PWA. Metemos una entrada de historial por cada overlay abierto
   y, al retroceder, cerramos SOLO el de arriba (pila LIFO), no todos a la vez. */
var _mcBackStack=[];        // overlays abiertos, en orden de apertura
var _mcIgnorePop=false;     // Ayuda consulta esta señal; la propiedad la decide el token, no el booleano
var _mcBackInit=false;
var _mcBackHistory=[], _mcBackPending=null, _mcBackAt=null;
var _mcBackScheduled=false, _mcBackTurn=0, _mcBackNext=0;
var _mcBackOwner=typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+String(typeof performance!=="undefined"&&performance.now?performance.now():0);
function _mcBackSlot(state){
  var tag=state&&state.mcBack;
  if(!tag||tag.owner!==_mcBackOwner) return null;
  return _mcBackHistory.find(function(s){ return s.id===tag.id; })||null;
}
function _mcBackSame(a,b){
  var seen=[];
  var same=function(x,y){
    if(Object.is(x,y)) return true;
    if(!x||!y||typeof x!=="object"||typeof y!=="object") return false;
    var kind=Object.prototype.toString.call(x);
    if(kind!==Object.prototype.toString.call(y)) return false;
    var pair=seen.find(function(p){ return p[0]===x; });
    if(pair) return pair[1]===y;
    seen.push([x,y]);
    if(kind==="[object Date]") return Object.is(x.getTime(),y.getTime());
    if(kind==="[object RegExp]") return x.source===y.source&&x.flags===y.flags;
    if(kind==="[object Map]"||kind==="[object Set]") return x.size===y.size&&same(Array.from(x),Array.from(y));
    if(kind==="[object ArrayBuffer]"||ArrayBuffer.isView(x)){
      var xb=new Uint8Array(x.buffer||x,x.byteOffset||0,x.byteLength),yb=new Uint8Array(y.buffer||y,y.byteOffset||0,y.byteLength);
      return xb.length===yb.length&&xb.every(function(v,i){ return v===yb[i]; });
    }
    if(kind!=="[object Object]"&&kind!=="[object Array]") return false;
    if(kind==="[object Array]"&&x.length!==y.length) return false;
    var keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(function(k){ return Object.hasOwn(y,k)&&same(x[k],y[k]); });
  };
  // History acepta clones con ciclos/Map/Date. JSON los pierde y podría atribuir un pop ajeno.
  return same(a,b);
}
function _mcBackSchedule(){
  if(_mcBackScheduled) return;
  _mcBackScheduled=true;
  // React limpia todos los efectos antes de montar los nuevos. El lote permite transferir
  // Perfil→Ajustes sin que un back pendiente se lleve la entrada nueva (8/10/2026).
  Promise.resolve().then(function(){ _mcBackScheduled=false; _mcBackFlush(); });
}
function _mcBackAdd(close){
  _mcBackInitOnce();
  var e={close:close,active:true,slot:null,_byPop:false,failed:false,url:location.href};
  _mcBackStack.push(e); _mcBackSchedule();
  return e;
}
function _mcBackDrop(e){
  if(!e||!e.active) return;
  e.active=false;
  var i=_mcBackStack.indexOf(e); if(i>=0) _mcBackStack.splice(i,1);
  if(e.slot) e.slot.retired=_mcBackTurn;
  _mcBackSchedule();
}
function _mcBackArm(e,replace){
  var s={id:++_mcBackNext,entry:e,before:replace?replace.before:history.state,
    beforeUrl:replace?replace.beforeUrl:location.href,retired:null,blocked:false,present:true};
  var state={mcOverlay:true,mcBack:{owner:_mcBackOwner,id:s.id}};
  try{
    if(replace) history.replaceState(state,""); else history.pushState(state,"");
  }catch(err){ e.failed=true; return false; }
  if(replace){ var i=_mcBackHistory.indexOf(replace); if(i>=0) _mcBackHistory.splice(i,1); }
  else _mcBackHistory=_mcBackHistory.filter(function(old){ return old.present; });
  e.slot=s; _mcBackHistory.push(s); _mcBackAt=s;
  return true;
}
function _mcBackConsume(s){
  if(_mcBackPending||s.blocked||_mcBackSlot(history.state)!==s) return;
  // Una entrada ajena o un push fallido nunca autorizan a salir de la ruta por un cierre UI.
  _mcBackPending={from:s,state:s.before,url:s.beforeUrl}; _mcIgnorePop=true;
  try{ history.back(); }catch(err){ s.blocked=true; _mcBackPending=null; _mcIgnorePop=false; }
}
function _mcBackFlush(){
  var turn=_mcBackTurn++;
  if(_mcBackPending) return;
  var current=_mcBackSlot(history.state);
  var waiting=_mcBackStack.filter(function(e){ return !e.slot&&!e.failed&&e.url===location.href; });
  if(current&&!current.entry.active&&current.retired===turn&&waiting.length){
    // Sólo se sustituye la entrada propia superior retirada en ESTE lote; su padre se conserva.
    if(_mcBackArm(waiting[0],current)){ waiting.shift(); current=_mcBackAt; }
  }
  if(current&&!current.entry.active){ _mcBackConsume(current); return; }
  waiting.forEach(function(e){ if(!e.failed) _mcBackArm(e,null); });
}
function _mcBackCloseNative(){
  var e=_mcBackStack[_mcBackStack.length-1];
  if(!e) return false;
  // Capacitor avisa sin recorrer History: el consumo pertenece al controlador, no a _byPop.
  _mcBackDrop(e); try{ e.close(); }catch(err){}
  return true;
}
function _mcBackInitOnce(){
  if(_mcBackInit) return; _mcBackInit=true;
  window.addEventListener("popstate", function(ev){
    var current=_mcBackSlot(ev.state), previous=_mcBackAt, pending=_mcBackPending;
    _mcBackAt=current;
    if(pending){
      _mcBackPending=null; _mcIgnorePop=false;
      if(location.href===pending.url&&_mcBackSame(ev.state,pending.state)){
        pending.from.present=false;
      }
      _mcBackSchedule(); return;
    }
    // Llegar desde otra ruta a nuestra entrada no equivale a haber salido de ella.
    var left=[], s=previous;
    while(s&&s!==current){
      left.push(s);
      if(location.href===s.beforeUrl&&_mcBackSame(ev.state,s.before)) break;
      s=_mcBackSlot(s.before);
    }
    if(left.length&&s&&s!==current&&location.href===s.beforeUrl&&_mcBackSame(ev.state,s.before)){
      // Un go(-n) puede saltar más de una entrada. Sólo cierra la superior; los padres vivos
      // saltados recuperan protección sin recibir un callback de cierre ajeno.
      left.forEach(function(slot){ slot.present=false; if(slot!==previous&&slot.entry.active) slot.entry.slot=null; });
      var e=previous.entry;
      if(e.active){ _mcBackDrop(e); e._byPop=true; try{ e.close(); }finally{ _mcBackSchedule(); } }
    }
    _mcBackSchedule();
  });
}
function useBackClose(open, onClose, identity){
  const close=useRef(null);
  // Conserva la closure de apertura y las refs financieras existentes. Sólo los propietarios
  // que cambian de paso/diálogo solicitan explícitamente otro registro con identity.
  useEffect(function(){ close.current=open?onClose:null; },[open]);
  useEffect(function(){
    _mcBackInitOnce();
    if(!open) return undefined;
    const e=_mcBackAdd(close.current);
    return function(){ _mcBackDrop(e); };
  },[open,identity]);
}

/* Pantallas hijas a página completa: dentro de la WebView se puede volver desde cualquier punto,
   como en Inversiones; en Android 14+ el borde pertenece al sistema y llega por su progreso
   predictivo. La hija acompaña al dedo y solo se desmonta después de cerrar. */
function useEdgePageClose(open,onClose,on,ref){
  const tm=useRef(null), busy=useRef(false);
  const cb=useRef(onClose); cb.current=onClose;
  const dr=useRef(null);
  useEffect(function(){
    // Una misma pantalla puede montar varias hijas seguidas sin cerrar el push padre. Cada vez
    // que esta capa vuelve a ser la activa necesita recuperar el gesto (review Claude 24/9).
    if(open&&on) busy.current=false;
    return function(){ if(tm.current) clearTimeout(tm.current); };
  },[open,on]);
  const close=function(){
    if(busy.current) return;
    const el=ref.current;
    if(!el||mcReduced()){ cb.current&&cb.current(); return; }
    busy.current=true;
    el.classList.remove("mc-page-dragging");
    el.style.transition="transform .42s cubic-bezier(.32,.72,0,1), opacity .34s ease";
    el.style.setProperty("transform","translate3d(104%,0,0) rotateY(-1.2deg)","important");
    el.style.opacity=".78";
    tm.current=setTimeout(function(){
      tm.current=null;
      cb.current&&cb.current();
    },420);
  };
  const reset=function(){
    const el=ref.current; if(!el) return;
    el.classList.remove("mc-page-dragging");
    if(mcReduced()){
      el.style.transition=""; el.style.transform=""; el.style.opacity="";
      return;
    }
    el.style.transition="transform .24s cubic-bezier(.32,.72,0,1), opacity .2s ease";
    el.style.setProperty("transform","translate3d(0,0,0)","important");
    el.style.opacity="1";
  };
  const move=function(x,p){
    const el=ref.current; if(!el||busy.current||mcReduced()) return;
    el.classList.add("mc-page-dragging");
    // Gestionar conserva `transform:none!important` para que Android pinte su ola nativa; el
    // compositor debe ganar solo mientras el gesto está vivo y no puede fiarlo a una clase.
    el.style.setProperty("transition","none","important");
    el.style.setProperty("transform","translate3d("+x+"px,0,0) rotateY("+(-1.2*p)+"deg)","important");
    el.style.opacity=String(1-p*.22);
  };
  useEffect(function(){
    if(!open||!on) return undefined;
    const nat=natPlugin(), tog=function(v){
      if(nat&&nat.setEdgeBackEnabled){ try{ nat.setEdgeBackEnabled({enabled:v}).catch(function(){}); }catch(e){} }
    };
    const back=function(e){
      const ph=e.phase;
      // Un AskHost vive por encima de la página. Con el callback OVERLAY, Android ya no llega al
      // back general de Capacitor: primero cerramos ese diálogo y nunca movemos el fondo debajo.
      if(document.documentElement.classList.contains("ask-open")){
        if(ph==="cancel") reset();
        if(ph==="invoke"){
          reset();
          try{ if(typeof window.__mcCloseTopAsk==="function") window.__mcCloseTopAsk(); }catch(err){}
        }
        return;
      }
      if(ph==="invoke"){ close(); return; }
      if(ph==="cancel"){ reset(); return; }
      if(ph!=="start"&&ph!=="progress") return;
      const p=Math.max(0,Math.min(1,Number(e.progress)||0));
      move(p*(window.innerWidth||360),p);
    };
    window.addEventListener("mcNativeEdgeBack",back);
    window.__mcNativeEdgeBackActive=true;
    tog(true);
    const el=ref.current;
    const ev=[["touchstart",start,true],["touchmove",motion,false],["touchend",end,true],["touchcancel",cancel,true]];
    if(el){
      // React registra touchmove pasivo en esta WebView. El listener manual permite que, una vez
      // decidido el eje horizontal, el navegador no cancele el gesto antes de llegar al cierre.
      ev.forEach(function(x){ el.addEventListener(x[0],x[1],{passive:x[2]}); });
    }
    return function(){
      window.__mcNativeEdgeBackActive=false;
      window.removeEventListener("mcNativeEdgeBack",back);
      tog(false);
      if(el) ev.forEach(function(x){ el.removeEventListener(x[0],x[1]); });
    };
  },[open,on]);
  const start=function(e){
    if(!open||!on||busy.current||!(e.touches&&e.touches[0])) return;
    const target=e.target;
    if(target&&target.closest&&target.closest("input,textarea,select,[data-noswipe]")) return;
    const t=e.touches[0];
    dr.current={x:t.clientX,y:t.clientY,d:0,t:Date.now(),axis:null};
  };
  const motion=function(e){
    if(!dr.current||busy.current||!(e.touches&&e.touches[0])) return;
    const t=e.touches[0], dx=t.clientX-dr.current.x, dy=t.clientY-dr.current.y;
    if(dr.current.axis===null){
      dr.current.axis=gestureAxis(dx,dy);
      if(!dr.current.axis) return;
      if(dr.current.axis!=="x"){ dr.current=null; return; }
    }
    if(dx<=0) return;
    dr.current.d=dx;
    move(dx,Math.min(1,dx/(window.innerWidth||360)));
    if(e.cancelable) e.preventDefault();
    if(e.stopPropagation) e.stopPropagation();
  };
  const fin=function(no){
    const d=dr.current; dr.current=null;
    if(!d) return;
    const w=(ref.current&&ref.current.clientWidth)||window.innerWidth||360;
    if(!no&&(d.d>w*.28||(d.d/Math.max(1,Date.now()-d.t)>.45&&d.d>52))){ close(); return; }
    reset();
  };
  const end=function(){ fin(false); }, cancel=function(){ fin(true); };
  return {close:close};
}

let _mcSheetLocks=0, _mcSheetPrevOverflow="";
function mcSheetLock(){
  if(_mcSheetLocks===0){
    _mcSheetPrevOverflow=document.body.style.overflow;
    document.documentElement.classList.add("sheet-open");
  }
  _mcSheetLocks++;
  document.body.style.overflow="hidden";
}
function mcSheetUnlock(){
  _mcSheetLocks=Math.max(0,_mcSheetLocks-1);
  if(_mcSheetLocks===0){
    document.body.style.overflow=_mcSheetPrevOverflow;
    document.documentElement.classList.remove("sheet-open");
  }
}
/* Sheet bottom: swipe hacia abajo para cerrar en TODA la ficha (no solo el asa).
   Un gesto que empezó desplazando contenido le pertenece entero al scroller; solo una bajada
   NUEVA, ya desde el borde superior, mueve la hoja. Transferirlo a mitad era el salto del vídeo. */
function useSheetSwipe(open, onClose, opts){
  opts=opts||{};
  const sheetRef=useRef(null);
  const closeTimer=useRef(null);
  const lockHeld=useRef(false);
  const startY=useRef(0), startX=useRef(0), dy=useRef(0), dragging=useRef(false), armed=useRef(false), axis=useRef(null), closing=useRef(false), scrollHost=useRef(null);
  /* El candado entra antes del primer paint de la hoja. Con useEffect había un fotograma en que
     el fondo aún podía desplazarse y el siguiente recalculaba todo al bloquearlo: en el vídeo
     real la ficha parecía recolocarse justo después de abrir (feedback 2026-09-17). */
  useLayoutEffect(function(){
    if(!open) return undefined;
    closing.current=false;
    mcSheetLock(); lockHeld.current=true;
    const block=function(e){
      const sheet=sheetRef.current;
      /* Las hojas hijas son portales hermanos en body, no descendientes del `sheetRef` padre.
         Dejar pasar cualquier `.v4-sheet` evita que el candado del padre mate el scroll táctil
         de «Todas las categorías» mientras mantiene bloqueado todo lo que queda detrás. */
      const inSheet=e.target&&e.target.closest&&e.target.closest(".v4-sheet");
      if((sheet && sheet.contains(e.target))||inSheet) return;
      if(e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", block, {passive:false, capture:true});
    return function(){
      document.removeEventListener("touchmove", block, {capture:true});
      /* Hay hojas anidadas (Modificar > Todas las categorías). Solo la última devuelve el
         scroll: si la hija lo soltaba, la lista se movía detrás durante su salida animada. */
      if(closeTimer.current){ clearTimeout(closeTimer.current); closeTimer.current=null; }
      if(lockHeld.current){ lockHeld.current=false; mcSheetUnlock(); }
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
    /* En Apuntar/Modificar scrollea `.v4-sheet-body`, no la hoja exterior (esta lleva
       overflow:hidden para fijar la CTA). Mirar siempre `sheet.scrollTop` daba cero y convertía
       un scroll normal hacia arriba en un tirón de cierre de toda la ficha. */
    const target=e.target&&e.target.closest?e.target.closest(".v4-sheet-body"):null;
    scrollHost.current=target&&sheetRef.current&&sheetRef.current.contains(target)?target:sheetRef.current;
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
    const scroller=scrollHost.current;
    if(scroller && scroller.scrollTop>0){
      dy.current=0; if(el){ el.classList.remove("dragging"); el.style.transform=""; }
      // Este gesto ya pertenece al scroll. Si alcanza el borde a mitad, no saltamos de golpe a
      // mover la hoja con todo el recorrido acumulado; un tirón nuevo sí podrá cerrarla.
      dragging.current=false; armed.current=false;
      return;
    }
    if(ddy<=0){
      dy.current=0; if(el) el.style.transform="";
      // Dedo hacia arriba = bajar por el contenido. Queda en manos del scroller hasta soltar.
      dragging.current=false; armed.current=false;
      return;
    }
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
    if(!el||mcReduced()){ finish(); return; }
    closing.current=true;
    // El transform arranca antes del setState/guardado que pueda ejecutar quien cierra: al vivir
    // en el compositor sigue avanzando aunque React tenga que recalcular la lista de Gastos.
    el.classList.remove("dragging");
    const ms=opts.closeMs||300;
    // El fondo se libera al empezar la salida, no al desmontar: esperar esos 200–320 ms
    // recupera el tirón que ya se había eliminado (revisión independiente 2026-09-24).
    if(lockHeld.current){ lockHeld.current=false; mcSheetUnlock(); }
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
    if(!dragging.current && dy.current<=0){ armed.current=false; axis.current=null; scrollHost.current=null; return; }
    dragging.current=false; armed.current=false; axis.current=null;
    const dist=dy.current; dy.current=0; scrollHost.current=null;
    const el=sheetRef.current;
    if(!el){ if(dist>80) onClose(); return; }
    el.classList.remove("dragging");
    if(dist>80){
      closeAnimated();
    } else if(mcReduced()){
      el.style.transition=""; el.style.transform="";
    } else {
      const snapMs=opts.snapMs||280;
      el.style.transition="transform "+snapMs+"ms "+(opts.snapEase||"cubic-bezier(.32,.72,0,1)");
      el.style.transform="translate3d(0,0,0)";
      setTimeout(function(){ try{ el.style.transition=""; el.style.transform=""; }catch(err){} },snapMs);
    }
  };
  const onTouchCancel=function(e){
    if(e&&e.stopPropagation) e.stopPropagation();
    // Android puede cancelar un toque al entregar el scroll al WebView. No es un `touchend`:
    // confirmar aquí el cierre hacía que una ficha desapareciera o rebotara sin que él la soltara.
    dragging.current=false; armed.current=false; axis.current=null; dy.current=0; scrollHost.current=null;
    const el=sheetRef.current;
    if(el){ el.classList.remove("dragging"); el.style.transition=""; el.style.transform=""; }
  };
  return { sheetRef:sheetRef, close:closeAnimated,
    sheetTouch:{ onTouchStart:onTouchStart, onTouchMove:onTouchMove, onTouchEnd:onTouchEnd, onTouchCancel:onTouchCancel } };
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
   pero para los bloques de Cartera (las fichas de las demás pestañas se retiraron). El orden se guarda en
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

/* Anatomía común de Apuntar y Modificar (rediseño v4.1). Si cada ficha compone por su cuenta
   cabecera, importe, metadatos y categorías, vuelven a separarse en cuanto se toca una de ellas;
   por eso estas piezas viven en el módulo compartido y ambos modos pasan exactamente por aquí. */
function expenseTopCategoryRanking(expenses, catalog){
  const all=(catalog||CATEGORIES).slice();
  const valid={}; all.forEach(function(c){ valid[c.id]=c; });
  const counts={}; const since=Date.now()-90*86400000;
  (expenses||[]).forEach(function(e){
    const ms=e&&dateMs(e.date);
    if(!e || e.amount<0 || !valid[e.category] || !isFinite(ms) || ms<since) return;
    counts[e.category]=(counts[e.category]||0)+1;
  });
  const order={}; all.forEach(function(c,i){ order[c.id]=i; });
  return all.slice().sort(function(a,b){
    return (counts[b.id]||0)-(counts[a.id]||0) || order[a.id]-order[b.id];
  }).slice(0,8);
}
function expenseTopCategoryPick(ranked, currentId, catalog){
  const all=(catalog||CATEGORIES), valid={};
  all.forEach(function(c){ valid[c.id]=c; });
  const top=(ranked||[]).slice();
  if(currentId && valid[currentId] && !top.some(function(c){ return c.id===currentId; })){
    if(top.length>=8) top[top.length-1]=valid[currentId]; else top.push(valid[currentId]);
  }
  return top;
}
function ExpenseCategoryGrid({items, selected, selectedMany, onPick, testPrefix}){
  return React.createElement("div",{className:"v4-ficha-cats","data-testid":testPrefix||"expense-cats"},
    (items||[]).map(function(c){
      const on=selectedMany ? selectedMany.indexOf(c.id)!==-1 : selected===c.id;
      return React.createElement("button",{key:c.id,type:"button",className:"v4-ficha-cat"+(on?" on":""),
        "data-testid":(testPrefix||"expense-cat")+"-"+c.id,"aria-pressed":on,onClick:function(){ onPick(c.id); }},
        React.createElement("span",{className:"v4-ficha-cat-icon","aria-hidden":"true"},c.icon),
        React.createElement("span",null,(c.label||catName(c.id))+(c.suggested?" ✨":"")));
    })
  );
}
function ExpenseCategorySheet({open, onClose, items, selected, onPick}){
  const swipe=useSheetSwipe(!!open,onClose);
  useBackClose(!!open,swipe.close);
  if(!open) return null;
  return ReactDOM.createPortal(
    React.createElement("div",{className:"v4-sheet-back v4-ficha-cat-back",onClick:swipe.close},
      React.createElement("div",Object.assign({className:"v4-sheet v4-ficha-cat-sheet",ref:swipe.sheetRef,
        onClick:function(e){ e.stopPropagation(); }},swipe.sheetTouch),
        React.createElement("div",{className:"v4-sheet-handle"}),
        React.createElement("div",{className:"v4-section-h"},
          React.createElement("span",{className:"serif",style:{fontSize:22,fontWeight:600}},t("f_cat_all_title")),
          React.createElement("button",{type:"button",className:"link","aria-label":t("au_close"),onClick:swipe.close},"✕")),
        React.createElement(ExpenseCategoryGrid,{items:items,selected:selected,testPrefix:"expense-all-cat",onPick:function(id){ onPick(id); swipe.close(); }})
      )
    ),document.body);
}
function ExpenseFichaLayout({kind, onKind, dateLabel, onDate, amount, amountEmpty, currency,
  onCurrency, locked, onLocked, focused, concept, onConcept, onConceptBlur, fxHint, meta,
  afterMeta, categoryItems, allCategoryItems, category, onCategory, onAllCategories,
  adjustments, numpad, footer, testPrefix}){
  const isIn=kind==="ingreso";
  return React.createElement(React.Fragment,null,
    React.createElement("div",{className:"v4-sheet-body v4-ficha-body","data-testid":testPrefix||"expense-ficha"},
      React.createElement("div",{className:"v4-ficha-head"},
        React.createElement("div",{className:"v4-seg v4-ficha-seg"},
          React.createElement("button",{type:"button",className:"v4-seg-btn"+(!isIn?" on":""),onClick:function(){ onKind("gasto"); }},t("v4_gasto")),
          React.createElement("button",{type:"button",className:"v4-seg-btn"+(isIn?" on":""),onClick:function(){ onKind("ingreso"); }},t("v4_ingreso"))),
        React.createElement("button",{type:"button",className:"v4-ficha-date",onClick:onDate},dateLabel)),
      React.createElement("div",{className:"v4-ficha-amount-row"},
        React.createElement("button",{type:"button",className:"v4-ficha-amount v4-apuntar-amt serif num"+(amountEmpty?" empty":""),
          "aria-label":t("f_amount_aria"),onClick:locked?onLocked:undefined},amount),
        React.createElement("button",{type:"button",className:"v4-ficha-currency"+(locked?" locked":""),
          onClick:locked?onLocked:onCurrency},currency+(locked?"":" ▾"))),
      React.createElement("div",{className:"v4-ficha-focus"+(focused?" on":"")}),
      fxHint && React.createElement("div",{className:"v4-ficha-fx"},fxHint),
      React.createElement("input",{className:"v4-input v4-exp-name v4-ficha-concept",value:concept||"",placeholder:t("f_concept_ph"),
        onChange:function(e){ onConcept(e.target.value); },onBlur:onConceptBlur}),
      React.createElement("div",{className:"v4-ficha-meta"},(meta||[]).map(function(m){
        return React.createElement("button",{key:m.id,type:"button",disabled:!!m.disabled,
          className:"v4-ficha-meta-pill"+(m.on?" on":"")+(m.locked?" locked":"")+(m.disabled?" disabled":""),
          "data-testid":m.testId,onClick:m.disabled?undefined:(m.locked?onLocked:m.onClick)},m.lead||null,
          React.createElement("span",null,m.label));
      })),
      afterMeta||null,
      !isIn && React.createElement(React.Fragment,null,
        React.createElement("div",{className:"v4-ficha-cat-title"},
          React.createElement("span",null,t("f_cat")),
          React.createElement("button",{type:"button",onClick:onAllCategories},tf("f_cat_all",{n:(allCategoryItems||[]).length}))),
        React.createElement(ExpenseCategoryGrid,{items:categoryItems,selected:category,onPick:onCategory,testPrefix:(testPrefix||"expense")+"-cat"})),
      adjustments||null,
      numpad||null
    ),
    footer||null
  );
}

