/* ============================================================
   IMPORTAR UNA HOJA DE CÁLCULO CON GASTOS (Excel o CSV)
   ============================================================

   POR QUÉ EXISTE (petición suya 2026-07-28): «poder importar ya excels formados con gastos,
   recibos y demás, porque mi madre tiene un Excel y amigos míos igual y me preguntaron si habría
   alguna opción para importarlo de una manera que lo pillara guay».

   Son hojas HECHAS A MANO, no extractos de banco: cada una tiene sus columnas, en su orden, con
   sus nombres y en el idioma que sea. Así que aquí no hay un formato que reconocer — hay que
   ADIVINAR y dejar que la persona corrija. Ese es todo el diseño: proponemos el mapeo, se ve una
   previsualización con datos de verdad, y no se toca nada hasta que dice que sí (AGENTS §9: los
   importadores nunca pisan a ciegas).

   .XLSX SIN NINGUNA LIBRERÍA. La regla de la casa es cero dependencias y cero CDNs, y un .xlsx
   es un ZIP con XML dentro, así que se abre a mano: se lee el directorio central del ZIP, se
   descomprime con `DecompressionStream("deflate-raw")` —que es una API del navegador, no un
   paquete— y el XML lo parsea el `DOMParser` que ya trae. Cuesta ~120 líneas y evita meter 400 KB
   de SheetJS en un bundle que va justo de presupuesto.

   Y TODO PASA EN EL MÓVIL. El fichero no se sube a ningún sitio, igual que los CSV de Revolut. */

/* ---------- ZIP: lo mínimo para sacar ficheros de un .xlsx ---------- */

/** Lee el directorio central y devuelve {nombre: Uint8Array} de las entradas que pidas.
 *  Solo se descomprime lo que hace falta (una hoja y las cadenas), no el ZIP entero: un Excel
 *  con años de gastos trae miniaturas, estilos y temas que aquí no pintan nada. */
function zipAbrir(buf, quiere){
  const d=new DataView(buf), u8=new Uint8Array(buf);
  // El fin del directorio central (EOCD, firma 0x06054b50) vive al final, detrás de un comentario
  // de hasta 64 KB. Se busca hacia atrás, que es como está pensado el formato.
  let eocd=-1;
  for(let i=u8.length-22; i>=0 && i>u8.length-66000; i--){
    if(d.getUint32(i,true)===0x06054b50){ eocd=i; break; }
  }
  if(eocd<0) return Promise.reject(new Error("no-zip"));
  const nEnt=d.getUint16(eocd+10,true);
  let p=d.getUint32(eocd+16,true);
  const tareas=[];
  for(let i=0;i<nEnt && p+46<=u8.length;i++){
    if(d.getUint32(p,true)!==0x02014b50) break;
    const metodo=d.getUint16(p+10,true);
    const compLen=d.getUint32(p+20,true);
    const nomLen=d.getUint16(p+28,true), extLen=d.getUint16(p+30,true), comLen=d.getUint16(p+32,true);
    const local=d.getUint32(p+42,true);
    const nombre=new TextDecoder().decode(u8.subarray(p+46,p+46+nomLen));
    p+=46+nomLen+extLen+comLen;
    if(!quiere(nombre)) continue;
    // La cabecera LOCAL repite nombre y extra con longitudes propias: las del directorio central
    // NO sirven para saltar hasta los datos (el campo extra suele diferir).
    const lNom=d.getUint16(local+26,true), lExt=d.getUint16(local+28,true);
    const ini=local+30+lNom+lExt;
    const datos=u8.subarray(ini, ini+compLen);
    tareas.push(zipInflar(datos, metodo).then(function(txt){ return [nombre, txt]; }));
  }
  return Promise.all(tareas).then(function(pares){
    const out={};
    pares.forEach(function(par){ out[par[0]]=par[1]; });
    return out;
  });
}
/** metodo 0 = guardado tal cual · 8 = deflate crudo (el que usa siempre Excel). */
function zipInflar(datos, metodo){
  if(metodo===0) return Promise.resolve(new TextDecoder().decode(datos));
  if(typeof DecompressionStream==="undefined") return Promise.reject(new Error("sin-inflate"));
  // `slice` y no `subarray`: el stream se queda con el búfer y una vista sobre el ZIP entero le
  // daría de más.
  const blob=new Blob([datos.slice()]);
  return new Response(blob.stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
}

/* ---------- XLSX: de XML a una tabla de texto ---------- */

/** "BC12" → 54 (índice de columna, base 0). */
function xlsxCol(ref){
  let n=0;
  for(let i=0;i<ref.length;i++){
    const c=ref.charCodeAt(i);
    if(c<65||c>90) break;
    n=n*26+(c-64);
  }
  return n-1;
}
/** Serial de Excel → ISO. El origen es 1899-12-30 y NO 1900-01-01: Excel arrastra desde Lotus el
 *  bug de creerse que 1900 fue bisiesto, y restar dos días es la forma estándar de compensarlo. */
function xlsxFecha(n){
  const ms=Date.UTC(1899,11,30)+Math.round(n*86400000);
  const d=new Date(ms);
  return isNaN(d.getTime())?null:d;
}
/** Saca las filas de la primera hoja con datos. Devuelve {filas:[[celda,…],…], hoja:"Nombre"}.
 *  Las celdas salen como TEXTO menos las fechas, que salen ya como Date: el formato de fecha solo
 *  se sabe aquí (en la hoja es un número suelto) y perderlo obligaría a adivinarlo después. */
function xlsxTabla(sheetXml, compartidas, fechaCols){
  const doc=new DOMParser().parseFromString(sheetXml,"application/xml");
  const filas=[];
  const nodos=doc.getElementsByTagName("row");
  for(let i=0;i<nodos.length;i++){
    const fila=[], celdas=nodos[i].getElementsByTagName("c");
    for(let j=0;j<celdas.length;j++){
      const c=celdas[j];
      const ref=c.getAttribute("r")||"", tipo=c.getAttribute("t")||"", estilo=c.getAttribute("s");
      const col=ref?xlsxCol(ref):j;
      let v=null;
      if(tipo==="inlineStr"){
        const is=c.getElementsByTagName("t");
        v=is.length?is[0].textContent:"";
      } else {
        const vs=c.getElementsByTagName("v");
        const crudo=vs.length?vs[0].textContent:"";
        if(tipo==="s") v=compartidas[parseInt(crudo,10)]||"";
        else if(tipo==="b") v=crudo==="1"?"1":"0";
        else if(crudo===""){ v=""; }
        else if(fechaCols[estilo]) v=xlsxFecha(parseFloat(crudo));
        else v=crudo;
      }
      fila[col]=v==null?"":v;
    }
    // Se conservan las filas vacías intermedias fuera: una hoja de casa tiene huecos de sobra y
    // colarlos como gastos en blanco es ruido en la previsualización.
    if(fila.some(function(x){ return x instanceof Date || String(x||"").trim()!==""; })) filas.push(fila);
  }
  return filas;
}
/** Qué estilos son fechas. `numFmtId` 14-22 y 45-47 son los formatos de fecha/hora de fábrica; los
 *  personalizados se reconocen porque su código lleva d/m/y (o el "aaaa" español). */
function xlsxEstilosFecha(stylesXml){
  const marcados={};
  if(!stylesXml) return marcados;
  const doc=new DOMParser().parseFromString(stylesXml,"application/xml");
  const fmtFecha={};
  const fmts=doc.getElementsByTagName("numFmt");
  for(let i=0;i<fmts.length;i++){
    const id=fmts[i].getAttribute("numFmtId"), code=(fmts[i].getAttribute("formatCode")||"").toLowerCase();
    if(/[dmya]/.test(code) && !/^[#0.,\s%]*$/.test(code)) fmtFecha[id]=true;
  }
  const xfs=doc.getElementsByTagName("cellXfs")[0];
  if(!xfs) return marcados;
  const hijos=xfs.getElementsByTagName("xf");
  for(let i=0;i<hijos.length;i++){
    const id=hijos[i].getAttribute("numFmtId")||"0";
    const n=parseInt(id,10);
    if((n>=14&&n<=22)||(n>=45&&n<=47)||fmtFecha[id]) marcados[String(i)]=true;
  }
  return marcados;
}
/** Nombre de verdad de cada hoja ("Año 2026", no "Hoja 19"): cruza `workbook.xml` (orden +
 *  nombre + r:id) con `_rels/workbook.xml.rels` (r:id → sheetN.xml). Sin alguno de los dos
 *  ficheros (o si algo no casa) devuelve {} y el llamador cae a "Hoja N". */
function xlsxNombresHojas(workbookXml, relsXml){
  if(!workbookXml||!relsXml) return {};
  try{
    const wb=new DOMParser().parseFromString(workbookXml,"application/xml");
    const rels=new DOMParser().parseFromString(relsXml,"application/xml");
    const ridDestino={};
    const rs=rels.getElementsByTagName("Relationship");
    for(let i=0;i<rs.length;i++){
      const id=rs[i].getAttribute("Id"), target=rs[i].getAttribute("Target")||"";
      if(id && /worksheets\/sheet\d+\.xml$/.test(target)) ridDestino[id]="xl/"+target.replace(/^\/?/,"");
    }
    const out={};
    const hojas=wb.getElementsByTagName("sheet");
    for(let i=0;i<hojas.length;i++){
      const nombre=hojas[i].getAttribute("name");
      // r:id lleva prefijo de espacio de nombres; getAttribute con el nombre completo es lo único
      // fiable entre navegadores para un atributo con prefijo dentro de DOMParser.
      const rid=hojas[i].getAttribute("r:id")||hojas[i].getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
      const ruta=rid&&ridDestino[rid];
      if(ruta&&nombre) out[ruta]=nombre;
    }
    return out;
  }catch(e){ return {}; }
}
function xlsxCompartidas(xml){
  if(!xml) return [];
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  const sis=doc.getElementsByTagName("si"), out=[];
  for(let i=0;i<sis.length;i++){
    // Un `si` puede venir troceado en varios `t` (trozos con formatos distintos dentro de la
    // misma celda): se pegan, que es lo que se ve en Excel.
    const ts=sis[i].getElementsByTagName("t");
    let s="";
    for(let j=0;j<ts.length;j++) s+=ts[j].textContent;
    out.push(s);
  }
  return out;
}

/* ---------- DOCX: mismo ZIP, otro XML (petición suya 2026-08-03: «un Word con gastos, recibos e
   ingresos que la gente escribe a mano») ----------

   Un .docx es la MISMA estructura que un .xlsx: un ZIP con XML dentro, solo que el fichero que
   importa se llama `word/document.xml` en vez de una hoja. Así que se reutiliza `zipAbrir` entero
   y solo cambia el parseo: en vez de celdas de una hoja, aquí hay párrafos (`w:p`) y, si alguien
   apuntó "fecha · concepto · importe" en una tabla de Word (lo más probable), filas y columnas de
   verdad (`w:tbl`/`w:tr`/`w:tc`). Con tabla se lee como una hoja; sin tabla, cada párrafo es una
   fila que se reparte por tabulador o por dos espacios seguidos — igual que una hoja sin
   cabeceras. */

/** Todo el texto visible de un nodo, EN ORDEN: pega los `w:t` que cuelguen de él (una celda o un
 *  párrafo pueden traer el texto troceado en varias «runs» con formato distinto) y convierte un
 *  `w:tab` en un tabulador de verdad — es un elemento vacío sin texto dentro, así que si no se
 *  traduce aquí el tabulador que puso quien escribió el párrafo desaparece sin dejar rastro (y con
 *  él, la columna que separaba). `getElementsByTagName("*")` los da todos en orden de documento. */
function docxTexto(nodo){
  const els=nodo.getElementsByTagName("*"), partes=[];
  for(let i=0;i<els.length;i++){
    const tag=els[i].tagName;
    if(tag==="w:t") partes.push(els[i].textContent);
    else if(tag==="w:tab") partes.push("\t");
    else if(tag==="w:br"||tag==="w:cr") partes.push("\n");
  }
  return partes.join("");
}
/** De varias tablas del documento, la más larga con datos: la primera de un Word para currar suele
 *  ser una portada o una tabla suelta de una fila, no la de gastos. Separado de `docxTabla` para
 *  poder probarlo sin `DOMParser` (que no existe en Node). */
function docxMejorTabla(tablas){
  let mejor=[];
  tablas.forEach(function(t){ if(t.length>mejor.length) mejor=t; });
  return mejor;
}
/** Un párrafo (o una línea de PDF sin columnas reconocibles) a fila: por el tabulador que puso
 *  quien escribió (más fiable) o, si no hay, por dos o más espacios seguidos — el mismo criterio
 *  que una hoja sin cabeceras bien cuadrada. Compartida entre el DOCX (párrafo suelto) y el PDF
 *  (línea sin posiciones de columna). */
function filaDeTexto(linea){
  return linea.split(/\t|\s{2,}/).map(function(s){ return s.trim(); }).filter(function(s){ return s!==""; });
}
/** `word/document.xml` → filas de texto. Con tabla, la mejor tabla del documento; sin ninguna, un
 *  párrafo por fila repartido con `filaDeTexto`. */
function docxTabla(xml){
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  const tbls=doc.getElementsByTagName("w:tbl");
  if(tbls.length){
    const tablas=[];
    for(let k=0;k<tbls.length;k++){
      const filas=[], trs=tbls[k].getElementsByTagName("w:tr");
      for(let i=0;i<trs.length;i++){
        const fila=[], tcs=trs[i].getElementsByTagName("w:tc");
        for(let j=0;j<tcs.length;j++) fila.push(docxTexto(tcs[j]).trim());
        if(fila.some(function(c){ return c!==""; })) filas.push(fila);
      }
      tablas.push(filas);
    }
    return docxMejorTabla(tablas);
  }
  const ps=doc.getElementsByTagName("w:p"), filas=[];
  for(let i=0;i<ps.length;i++){
    const linea=docxTexto(ps[i]).trim();
    if(linea) filas.push(filaDeTexto(linea));
  }
  return filas;
}

/* ---------- CSV ---------- */

/** CSV/TSV con comillas y saltos de línea dentro de celda. Separador: el que más aparezca en la
 *  primera línea, entre `;` `,` y tabulador — un Excel español exporta con `;` y uno inglés con
 *  `,`, y acertar solo con uno de los dos es medio importador. */
function csvTabla(txt){
  txt=String(txt||"").replace(/^﻿/,"");
  const prim=(txt.split(/\r?\n/)[0]||"");
  const cand=[";",",","\t"];
  let sep=";", mejor=-1;
  cand.forEach(function(s){ const n=prim.split(s).length; if(n>mejor){ mejor=n; sep=s; } });
  const filas=[]; let fila=[], cel="", enComillas=false;
  for(let i=0;i<txt.length;i++){
    const ch=txt[i];
    if(enComillas){
      if(ch==='"'){ if(txt[i+1]==='"'){ cel+='"'; i++; } else enComillas=false; }
      else cel+=ch;
    } else if(ch==='"') enComillas=true;
    else if(ch===sep){ fila.push(cel); cel=""; }
    else if(ch==="\n"){ fila.push(cel); cel=""; filas.push(fila); fila=[]; }
    else if(ch!=="\r") cel+=ch;
  }
  if(cel!==""||fila.length){ fila.push(cel); filas.push(fila); }
  return filas.filter(function(f){ return f.some(function(x){ return String(x||"").trim()!==""; }); });
}

/* ---------- PDF: mejor esfuerzo sin librería ----------

   Un PDF no es un ZIP: es texto con bloques binarios sueltos. La mitad barata (y la que cubre casi
   todo lo que sale de Word/Excel/Google Docs, que no es una foto escaneada) es que el texto vive en
   operadores `Tj`/`TJ` dentro de streams de contenido, casi siempre comprimidos con el MISMO
   deflate que un ZIP (filtro `FlateDecode`) — se descomprime con `DecompressionStream("deflate")`,
   la variante CON cabecera zlib (la de un ZIP es "deflate-raw", sin ella).

   NO se parsea la estructura del PDF (tabla xref, objetos, diccionarios): se buscan a pelo los
   bloques `stream…endstream` sueltos por todo el fichero y se intenta inflar cada uno; el que no
   sea flate (una imagen con otro filtro, o ya venga sin comprimir) se prueba tal cual, y si no trae
   ningún operador de texto simplemente no aporta filas — no hace falta saber POR QUÉ un bloque no
   es texto, basta con que los que sí lo son aparezcan.

   Si al final no hay ni una fila de texto, es una foto escaneada (o un filtro que no reconocemos) y
   se avisa claro en vez de intentar OCR. Si hay texto pero ninguna fila parece fecha+importe,
   también se avisa claro: mejor decir «este PDF en concreto no lo sé leer» que inventarse filas
   (AGENTS §9: los importadores nunca pisan a ciegas, y menos aún inventan). */

/** Bloques `stream…endstream` del PDF, en bruto (aún sin inflar) y COMO BYTES: un stream deflate
 *  es binario, y `TextDecoder("latin1")` no es la ISO-8859-1 de verdad — la etiqueta "latin1" la
 *  trata como windows-1252 (así lo pide el estándar WHATWG, por compatibilidad web), que para los
 *  bytes 0x80-0x9F NO hace una vuelta byte↔carácter fiel. Pasar el comprimido por ahí y volver a
 *  bytes rompía el deflate en silencio (probado con un PDF sintético: bytes 0x9C/0x8C volvían
 *  como otra cosa). Por eso aquí se busca `stream`/`endstream` byte a byte, sin tocar texto. */
function pdfBloques(buf){
  const u8=new Uint8Array(buf);
  const M_STREAM=[115,116,114,101,97,109], M_END=[101,110,100,115,116,114,101,97,109]; // "stream","endstream"
  const buscar=function(desde,pat){
    busca: for(let i=desde;i<=u8.length-pat.length;i++){
      for(let j=0;j<pat.length;j++) if(u8[i+j]!==pat[j]) continue busca;
      return i;
    }
    return -1;
  };
  const bloques=[]; let p=0;
  while(true){
    const i=buscar(p,M_STREAM);
    if(i<0) break;
    let ini=i+M_STREAM.length;
    if(u8[ini]===13) ini++;   // \r
    if(u8[ini]===10) ini++;   // \n
    const f=buscar(ini,M_END);
    if(f<0) break;
    // El EOL de cierre («…datos\nendstream») no es parte de los datos: si se cuela, el deflate
    // acaba con un byte de más y no infla. Se recorta el mismo \r?\n que se saltó al entrar.
    let fin=f;
    if(u8[fin-1]===10) fin--;
    if(u8[fin-1]===13) fin--;
    bloques.push(u8.subarray(ini,fin));
    p=f+M_END.length;
  }
  return bloques;
}
/** Infla un bloque si es FlateDecode; si no lo es (otro filtro, o venía sin comprimir), se
 *  decodifica tal cual — un bloque que no era texto no va a traer `Tj`/`TJ` y `pdfLineas` no
 *  sacará nada útil de él, así que no hace falta saber de antemano qué filtro trae cada uno.
 *  Aquí SÍ se pasa a texto con `TextDecoder("latin1")` (=windows-1252): ya no hay que volver a
 *  bytes después, y de hecho es la codificación de fábrica de un PDF simple (`WinAnsiEncoding`). */
function pdfInflar(u8){
  if(typeof DecompressionStream==="undefined") return Promise.resolve(new TextDecoder("latin1").decode(u8));
  return new Response(new Blob([u8.slice()]).stream().pipeThrough(new DecompressionStream("deflate")))
    .arrayBuffer().then(function(ab){ return new TextDecoder("latin1").decode(ab); })
    .catch(function(){ return new TextDecoder("latin1").decode(u8); });
}
/** Desescapa un string literal `(...)` de un content stream: `\n \r \t \( \) \\` y octales `\ddd`. */
function pdfEscStr(s){
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g,function(_,g){
    if(g==="n") return "\n"; if(g==="r") return "\r"; if(g==="t") return "\t";
    if(g==="("||g===")"||g==="\\") return g;
    if(g==="b"||g==="f") return "";
    return String.fromCharCode(parseInt(g,8)&0xff);
  });
}
/** Un string hexadecimal `<...>` de un content stream, byte a byte (una tabla hecha a mano no trae
 *  fuentes con codificación de 2 bytes por carácter, así que basta con esto). */
function pdfHexStr(h){
  h=h.replace(/\s+/g,"");
  let out=""; for(let i=0;i+1<h.length;i+=2) out+=String.fromCharCode(parseInt(h.substr(i,2),16));
  return out;
}
/** Un content stream ya inflado → filas de texto. Cada `Td`/`TD` con desplazamiento vertical de
 *  verdad es un salto de línea; uno solo horizontal (`ty≈0`) es la siguiente celda de la MISMA
 *  fila — así se reconstruye una tabla sin tener que entender fuentes ni tamaños. `T*` siempre
 *  salta de línea. Si una fila se queda en una sola columna (el documento escribió la línea entera
 *  de un tirón, con espacios para alinear en vez de con posiciones), se reparte con `filaDeTexto`,
 *  la misma heurística que un párrafo suelto de Word. */
function pdfLineas(cs){
  const re=/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(?:Td|TD)\b|T\*|\(((?:\\.|[^\\()])*)\)\s*Tj|<([0-9A-Fa-f\s]*)>\s*Tj|\[((?:\\.|[^\[\]])*)\]\s*TJ/g;
  const lineas=[]; let fila=[""], m;
  const cierra=function(){
    let f=fila;
    if(f.length===1){ const partido=filaDeTexto(f[0]); if(partido.length>1) f=partido; }
    if(f.some(function(x){ return x.trim()!==""; })) lineas.push(f);
    fila=[""];
  };
  while((m=re.exec(cs))){
    if(m[1]!==undefined){
      const tx=parseFloat(m[1]), ty=parseFloat(m[2]);
      if(Math.abs(ty)>1) cierra();
      // Solo cuenta como «celda nueva» si ya se escribió algo en la actual — si no, el primer
      // Td de una línea (el que solo reposiciona el arranque del renglón) dejaría una columna
      // vacía colgando delante de la primera de verdad.
      else if(Math.abs(tx)>0.5 && fila[fila.length-1]!=="") fila.push("");
    } else if(m[0]==="T*"){
      cierra();
    } else if(m[3]!==undefined){
      fila[fila.length-1]+=pdfEscStr(m[3]);
    } else if(m[4]!==undefined){
      fila[fila.length-1]+=pdfHexStr(m[4]);
    } else if(m[5]!==undefined){
      const trozos=m[5].match(/\(((?:\\.|[^\\()])*)\)/g)||[];
      trozos.forEach(function(t){ fila[fila.length-1]+=pdfEscStr(t.slice(1,-1)); });
    }
  }
  cierra();
  return lineas;
}
/** Lee un PDF entero: infla lo que se pueda, saca líneas de texto de cada bloque y decide si hay
 *  algo reconocible ANTES de dejar pasar al mapeo de columnas — con un PDF no hay cabeceras de
 *  verdad que mapear a mano, así que si `hojaAdivinar` no encuentra ni fecha ni importe es mejor
 *  avisar aquí que soltar al usuario delante de una previsualización ilegible. */
function pdfLeer(file){
  return file.arrayBuffer().then(function(buf){
    return Promise.all(pdfBloques(buf).map(pdfInflar));
  }).then(function(streams){
    let lineas=[];
    streams.forEach(function(cs){ lineas=lineas.concat(pdfLineas(cs)); });
    if(!lineas.length) throw new Error("pdf-imagen");
    const map=hojaAdivinar(lineas);
    if(map.fecha<0||map.importe<0) throw new Error("pdf-sin-filas");
    return { filas:lineas, tipo:"pdf" };
  });
}

/* ---------- Leer el fichero que sea ---------- */

/** Devuelve {filas, tipo}. Acepta .xlsx/.xlsm, .csv/.tsv/.txt, .docx y .pdf. Los .xls/.doc VIEJOS
 *  (formato binario de Office 97) no: son otro formato completamente distinto, y decirlo claro
 *  vale más que fallar con «no he podido leerlo» — el arreglo es «Guardar como → .xlsx/.docx»,
 *  que se hace en dos toques. */
function hojaLeer(file){
  const nom=(file&&file.name||"").toLowerCase();
  if(/\.xls$/.test(nom)||/\.doc$/.test(nom)) return Promise.reject(new Error("xls-viejo"));
  if(/\.docx$/.test(nom)){
    return file.arrayBuffer().then(function(buf){
      return zipAbrir(buf,function(n){ return n==="word/document.xml"; });
    }).then(function(fich){
      if(!fich["word/document.xml"]) throw new Error("sin-hojas");
      return { filas:docxTabla(fich["word/document.xml"]), tipo:"docx" };
    });
  }
  if(/\.pdf$/.test(nom)) return pdfLeer(file);
  if(/\.xlsx$/.test(nom)||/\.xlsm$/.test(nom)){
    return file.arrayBuffer().then(function(buf){
      return zipAbrir(buf,function(n){
        return n==="xl/sharedStrings.xml" || n==="xl/styles.xml" || n==="xl/workbook.xml"
          || n==="xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n);
      });
    }).then(function(fich){
      const rutasHojas=Object.keys(fich).filter(function(n){ return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); }).sort();
      if(!rutasHojas.length) throw new Error("sin-hojas");
      const compartidas=xlsxCompartidas(fich["xl/sharedStrings.xml"]);
      const fechaCols=xlsxEstilosFecha(fich["xl/styles.xml"]);
      const nombres=xlsxNombresHojas(fich["xl/workbook.xml"], fich["xl/_rels/workbook.xml.rels"]);
      // Cada hoja con datos, con su nombre de verdad si se pudo resolver (si no, "Hoja N").
      const candidatas=rutasHojas.map(function(ruta){
        const n=(ruta.match(/sheet(\d+)\.xml$/)||[])[1];
        return { ruta:ruta, nombre:nombres[ruta]||("Hoja "+n), filas:xlsxTabla(fich[ruta], compartidas, fechaCols) };
      }).filter(function(h){ return h.filas.length>0; });
      if(!candidatas.length) return { filas:[], tipo:"xlsx" };
      // UNA sola hoja con datos: como siempre, directa. VARIAS (petición 2026-08-03: un Excel de
      // 16 años con 33 hojas —una por año— que antes se leía en silencio "la que tenga más filas",
      // así que el año en curso —el que de verdad quería— podía perderse sin que nadie se enterase.
      // Ahora, con más de una candidata, se pregunta en vez de adivinar.
      if(candidatas.length===1) return { filas:candidatas[0].filas, tipo:"xlsx" };
      candidatas.sort(function(a,b){ return b.filas.length-a.filas.length; });
      return { filas:null, tipo:"xlsx", hojas:candidatas.map(function(h){ return {nombre:h.nombre, filas:h.filas}; }) };
    });
  }
  return file.text().then(function(txt){ return { filas:csvTabla(txt), tipo:"csv" }; });
}

/* ---------- Adivinar qué es cada columna ---------- */

/* Los nombres que se ven de verdad en hojas de gastos caseras, en los tres idiomas de la app y
   en inglés (medio mundo pone las cabeceras en inglés aunque escriba en español). Sin tildes: se
   comparan normalizados. */
const HOJA_PISTAS={
  fecha:   ["fecha","data","date","dia","día","fec","when","fecha operacion","fecha valor"],
  concepto:["concepto","descripcion","descripción","descripcio","description","detalle","comercio","establecimiento","merchant","gasto","que","qué","nombre","name","memo","referencia","texto"],
  importe: ["importe","cantidad","cuantia","cuantía","total","amount","precio","euros","eur","€","coste","gasto","valor","cargo","monto"],
  categoria:["categoria","categoría","categories","category","tipo","type","grupo","clase","concepto2"],
  banco:   ["banco","cuenta","account","bank","tarjeta","medio","forma de pago","metodo","método","pago"],
};
function hojaNorm(s){
  return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
}
/** ¿La primera fila son cabeceras? Lo es si casi ninguna celda parece un número o una fecha.
 *  Sin esto, una hoja sin cabeceras pierde su primera línea de gastos sin decir nada. */
function hojaTieneCabecera(filas){
  if(!filas.length) return false;
  const f=filas[0];
  let datos=0, con=0;
  f.forEach(function(c){
    const s=String(c==null?"":c).trim();
    if(!s) return;
    con++;
    if(c instanceof Date || revoAmt(s)!=null || !isNaN(Date.parse(s))) datos++;
  });
  return con>0 && datos<=con/2;
}
/** Propone {fecha,concepto,importe,categoria,banco} → índice de columna (o -1).
 *  Primero por el nombre de la cabecera; lo que quede sin casar, por lo que CONTIENEN las
 *  columnas. Una hoja sin cabeceras se resuelve entera por contenido. */
function hojaAdivinar(filas){
  const map={fecha:-1,concepto:-1,importe:-1,categoria:-1,banco:-1};
  if(!filas.length) return map;
  const hayCab=hojaTieneCabecera(filas);
  const nCols=filas.reduce(function(m,f){ return Math.max(m,f.length); },0);
  const usada={};
  if(hayCab){
    const cab=filas[0];
    Object.keys(HOJA_PISTAS).forEach(function(campo){
      for(let c=0;c<nCols;c++){
        if(usada[c]) continue;
        const h=hojaNorm(cab[c]);
        if(!h) continue;
        const pega=HOJA_PISTAS[campo].some(function(p){ return h===p || h.indexOf(p)===0; });
        if(pega){ map[campo]=c; usada[c]=true; return; }
      }
    });
  }
  const cuerpo=filas.slice(hayCab?1:0, (hayCab?1:0)+40);
  const puntua=function(test){
    let mejor=-1, mejorN=0;
    for(let c=0;c<nCols;c++){
      if(usada[c]) continue;
      let n=0, con=0;
      cuerpo.forEach(function(f){
        const v=f[c];
        if(v==null||String(v).trim()==="") return;
        con++; if(test(v)) n++;
      });
      if(con>=2 && n>=con*0.7 && n>mejorN){ mejorN=n; mejor=c; }
    }
    return mejor;
  };
  if(map.fecha<0){
    map.fecha=puntua(function(v){ return v instanceof Date || (typeof v==="string" && /\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/.test(v)); });
    if(map.fecha>=0) usada[map.fecha]=true;
  }
  if(map.importe<0){
    map.importe=puntua(function(v){ return !(v instanceof Date) && revoAmt(String(v))!=null; });
    if(map.importe>=0) usada[map.importe]=true;
  }
  if(map.concepto<0){
    // El concepto es la columna de texto más «hablada»: la que tiene celdas más largas.
    let mejor=-1, mejorLen=0;
    for(let c=0;c<nCols;c++){
      if(usada[c]) continue;
      let suma=0, con=0;
      cuerpo.forEach(function(f){
        const v=f[c];
        if(v instanceof Date || v==null || String(v).trim()==="") return;
        if(revoAmt(String(v))!=null && String(v).trim().length<12) return;   // eso es un número
        con++; suma+=String(v).trim().length;
      });
      const media=con?suma/con:0;
      if(con>=2 && media>mejorLen){ mejorLen=media; mejor=c; }
    }
    map.concepto=mejor;
    if(mejor>=0) usada[mejor]=true;
  }
  return map;
}

/* ---------- De la tabla a gastos ---------- */

/** Fecha desde una celda. Un .xlsx ya la trae como Date; un CSV la trae escrita y ahí manda el
 *  formato de aquí: 3/4 es el 3 de abril, no el 4 de marzo. `Date.parse` haría lo contrario. */
function hojaFecha(v){
  if(v instanceof Date) return v;
  const s=String(v==null?"":v).trim();
  if(!s) return null;
  const m=s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
  if(m){
    let a=parseInt(m[1],10), b=parseInt(m[2],10), c=parseInt(m[3],10);
    let dia,mes,anio;
    if(m[1].length===4){ anio=a; mes=b; dia=c; }                 // ISO 2026-07-28
    else { dia=a; mes=b; anio=c; if(anio<100) anio+=anio<70?2000:1900; }
    const d=new Date(anio,mes-1,dia,12,0,0);                     // mediodía: sin sustos de huso
    return isNaN(d.getTime())?null:d;
  }
  const p=Date.parse(s);
  return isNaN(p)?null:new Date(p);
}
/** Filas + mapeo → gastos listos para el estado. `signo` dice cómo leer los importes de la hoja:
 *    "auto"    = el signo que traiga (negativo = ingreso, como dentro de la app)
 *    "gastos"  = todo son gastos, aunque venga sin signo (el caso de la hoja de su madre)
 *  El resultado NO se guarda: va a la previsualización. */
function hojaAGastos(filas, map, opts){
  opts=opts||{};
  const desde=hojaTieneCabecera(filas)?1:0;
  const out=[], malas=[];
  for(let i=desde;i<filas.length;i++){
    const f=filas[i];
    const fecha=map.fecha>=0?hojaFecha(f[map.fecha]):null;
    const impCel=map.importe>=0?f[map.importe]:null;
    const imp=impCel instanceof Date?null:revoAmt(String(impCel==null?"":impCel));
    const concepto=map.concepto>=0?String(f[map.concepto]==null?"":f[map.concepto]).trim():"";
    if(imp==null||!isFinite(imp)||imp===0){ malas.push({fila:i+1, por:"importe"}); continue; }
    if(!fecha){ malas.push({fila:i+1, por:"fecha"}); continue; }
    // Dentro de la app un gasto es POSITIVO y un ingreso NEGATIVO (al revés que un extracto).
    const monto=opts.signo==="gastos" ? Math.abs(imp) : (opts.invertir? -imp : imp);
    const catHoja=map.categoria>=0?hojaNorm(f[map.categoria]):"";
    const merchant=concepto||(monto<0?"Ingreso":"Gasto");
    out.push({
      id:mcExpenseId(),
      date:fecha.toISOString(),
      merchant:merchant,
      amount:monto,
      category: monto<0 ? "ingreso" : hojaCategoria(catHoja, merchant),
      bank: map.banco>=0 ? String(f[map.banco]==null?"":f[map.banco]).trim() : "",
      source:"hoja",
    });
  }
  return {gastos:out, malas:malas};
}
/** La categoría escrita en la hoja, si se parece a una de las nuestras; si no, la de siempre por
 *  comercio. No se inventa ninguna: las categorías son las que hay en CAT. */
function hojaCategoria(cruda, merchant){
  if(cruda){
    for(const k in CAT){
      if(hojaNorm(k)===cruda) return k;
      const lab=hojaNorm(typeof t==="function"?t("cat_"+k):"");
      if(lab && lab===cruda) return k;
    }
  }
  return autoCategory(merchant);
}

/* ---------- Duplicados ---------- */

/** Dos apuntes son el mismo si coinciden DÍA, IMPORTE al céntimo y el comercio normalizado.
 *  Ni más fino ni más grueso, y las dos cosas se probaron mentalmente contra hojas de verdad:
 *    · sin el comercio, dos cafés de 1,20 € el mismo día se comerían el uno al otro;
 *    · con la hora, no casaría nada (una hoja de casa no lleva hora y el banco sí).
 *  El comercio se compara sin tildes, sin mayúsculas y sin dobles espacios porque la misma tienda
 *  se escribe de tres maneras entre la hoja y lo que manda el banco. */
function hojaClave(g){
  const d=parseDate(g.date);
  const dia=isNaN(d.getTime())?String(g.date).slice(0,10):
    d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const com=hojaNorm(g.merchant).replace(/\s+/g," ");
  return dia+"|"+Math.round(Math.abs(g.amount)*100)+"|"+com;
}
/** Separa lo que entra de lo que ya estaba. Mira contra el histórico Y contra el propio fichero
 *  (una hoja de casa repite filas: se copian y se pegan meses enteros). */
function hojaDuplicados(nuevos, existentes){
  const vistos={};
  (existentes||[]).forEach(function(g){ vistos[hojaClave(g)]=g; });
  const altas=[], dupes=[];
  nuevos.forEach(function(g){
    const k=hojaClave(g);
    if(vistos[k]) dupes.push({gasto:g, contra:vistos[k]});
    else { vistos[k]=g; altas.push(g); }
  });
  return {altas:altas, dupes:dupes};
}

/* ---------- La pantalla ---------- */

/* Cuatro pasos, y ninguno se puede saltar: elegir fichero → decir qué es cada columna → ver el
   reparto entre lo que entra y lo que ya tenías → guardar. El paso 3 es el que él pidió con
   nombre y apellidos: «que si pillara alguna cosa duplicada que dijera de forma guapa con alguna
   animación o algo el descarte y lo que se queda». */
function SheetImport({state, set, onClose, showToast, goGastos}){
  useBackClose(true, onClose);
  const [paso,setPaso]=useState(0);          // 0 fichero · 1 columnas · 2 reparto · 3 hecho
  const [hojasDisp,setHojasDisp]=useState(null); // varias hojas con datos: hay que elegir antes de seguir
  const [filas,setFilas]=useState(null);
  const [map,setMap]=useState({fecha:-1,concepto:-1,importe:-1,categoria:-1,banco:-1});
  const [signo,setSigno]=useState("gastos"); // hoja de casa: todo son gastos aunque no lleven signo
  const [err,setErr]=useState("");
  const [leyendo,setLeyendo]=useState(false);
  const [reparto,setReparto]=useState(null); // {altas, dupes, malas}
  const [revelado,setRevelado]=useState(0);  // cuántas tarjetas del reparto han entrado ya
  const fileRef=useRef(null);
  const t0Ref=useRef(0);   // cuándo empezó el import, para medir lo que tarda en un móvil de verdad

  const nCols=(filas||[]).reduce(function(m,f){ return Math.max(m,f.length); },0);
  const hayCab=filas?hojaTieneCabecera(filas):false;
  const cabDe=function(c){
    const h=hayCab?String(filas[0][c]==null?"":filas[0][c]).trim():"";
    return h||("Columna "+(c+1));
  };
  const ejemploDe=function(c){
    const cuerpo=(filas||[]).slice(hayCab?1:0);
    for(let i=0;i<cuerpo.length;i++){
      const v=cuerpo[i][c];
      if(v instanceof Date) return v.toLocaleDateString(loc());
      const s=String(v==null?"":v).trim();
      if(s) return s.length>22?s.slice(0,22)+"…":s;
    }
    return "—";
  };

  const usarFilas=function(filasElegidas){
    setFilas(filasElegidas);
    setMap(hojaAdivinar(filasElegidas));
    setHojasDisp(null);
    setPaso(1);
  };
  const cargar=function(file){
    if(!file) return;
    setErr(""); setLeyendo(true); setHojasDisp(null); t0Ref.current=Date.now();
    hojaLeer(file).then(function(r){
      if(r.hojas){ setHojasDisp(r.hojas); return; }    // varias hojas con datos: que elija
      if(!r.filas.length) throw new Error("vacio");
      usarFilas(r.filas);
    }).catch(function(e){
      const m=(e&&e.message)||String(e);
      setErr(m==="xls-viejo"?t("ih_err_xls"):m==="no-zip"?t("ih_err_zip"):
        m==="pdf-imagen"?t("ih_err_pdf_imagen"):m==="pdf-sin-filas"?t("ih_err_pdf_filas"):
        m==="vacio"?t("ih_err_vacio"):t("ih_err_leer"));
      try{ cloud.logEvent("error","import hoja: "+m.slice(0,120)); }catch(_){}
    }).finally(function(){ setLeyendo(false); });
  };

  const calcular=function(){
    const r=hojaAGastos(filas, map, {signo:signo});
    const d=hojaDuplicados(r.gastos, state.expenses||[]);
    setReparto({altas:d.altas, dupes:d.dupes, malas:r.malas});
    setRevelado(0);
    setPaso(2);
  };
  /* El reparto entra CONTANDO, no de golpe: cada tarjeta aparece con un pelín de retraso sobre
     la anterior. Es lo que convierte «se descartan 34» en algo que se entiende de un vistazo —y
     es literalmente lo que pidió. Se corta a las 14: pasado eso ya no informa, solo hace esperar. */
  useEffect(function(){
    if(paso!==2||!reparto) return undefined;
    const tot=Math.min(14, reparto.altas.length+reparto.dupes.length);
    if(revelado>=tot) return undefined;
    const id=setTimeout(function(){ setRevelado(function(n){ return n+1; }); }, revelado===0?90:52);
    return function(){ clearTimeout(id); };
  },[paso,reparto,revelado]);

  const guardar=function(){
    if(!reparto||!reparto.altas.length){ onClose(); return; }
    const limpios=reparto.altas.map(function(g){
      // `bank` de la hoja es texto libre («Visa», «la de mi madre»): se queda en el concepto como
      // apunte y NO se convierte en un banco de la app, que tiene entidades cerradas.
      const o={id:g.id,date:g.date,merchant:g.merchant,amount:g.amount,category:g.category,source:"hoja"};
      if(g.bank) o.note=g.bank;
      return o;
    });
    set(function(s){
      return Object.assign({},s,{expenses:(s.expenses||[]).concat(limpios)});
    });
    setPaso(3);
    showToast(tf("ih_ok",{n:limpios.length}));
    // Cuántas veces se usa el importador y cuánto tarda de verdad en un móvil: lo que Supabase no
    // puede ver porque pasa aquí. Sin el fichero, sin las filas y sin los importes.
    try{ cloud.logUso("import_hoja"); cloud.logPerf("import_hoja", Date.now()-t0Ref.current); }catch(e){}
  };

  const wrap={position:"fixed",inset:0,zIndex:96,overflowY:"auto",background:"var(--bg)",color:"var(--text)",
    padding:"calc(var(--safe-top) + 18px) 18px calc(var(--safe-bottom) + 28px)",fontFamily:"'Manrope',sans-serif"};
  const inner={maxWidth:480,margin:"0 auto"};
  const back={background:"none",border:"none",color:"var(--blue)",fontSize:15,fontWeight:700,cursor:"pointer",padding:"6px 0",marginBottom:6};

  return React.createElement("div",{style:wrap,className:"hoja-import"}, React.createElement("div",{style:inner},
    React.createElement("button",{style:back,onClick:onClose}, "‹ "+t("v4_back")),
    React.createElement("div",{className:"serif",style:{fontSize:25,margin:"2px 0 6px"}}, t("ih_title")),

    paso===0 && !hojasDisp && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{color:"var(--muted)",fontSize:13.5,lineHeight:1.55,marginBottom:16}}, t("ih_intro")),
      React.createElement("ol",{className:"hoja-pasos"},
        t("ih_steps").map(function(s,i){ return React.createElement("li",{key:i}, s); })),
      err && React.createElement("div",{className:"hoja-err"}, err),
      React.createElement("button",{type:"button",className:"v4-cta",disabled:leyendo,
        onClick:function(){ if(fileRef.current) fileRef.current.click(); }},
        leyendo?t("ih_leyendo"):t("ih_pick")),
      React.createElement("input",{ref:fileRef,type:"file",style:{display:"none"},
        accept:".xlsx,.xlsm,.csv,.tsv,.txt,.docx,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",
        onChange:function(e){ cargar(e.target.files&&e.target.files[0]); e.target.value=""; }}),
      React.createElement("div",{className:"hint",style:{marginTop:12}}, t("ih_privacidad"))
    ),

    // VARIAS hojas con datos (un Excel de varios años, una por hoja): se pregunta en vez de coger
    // a ciegas la que más filas tenga — esa nunca tiene por qué ser la que quieres traer.
    paso===0 && hojasDisp && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{color:"var(--muted)",fontSize:13.5,lineHeight:1.55,marginBottom:14}}, tf("ih_hojas_intro",{n:hojasDisp.length})),
      hojasDisp.map(function(h,i){
        return React.createElement("button",{key:i,type:"button",className:"hoja-sel",style:{textAlign:"left",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"},
          onClick:function(){ usarFilas(h.filas); }},
          React.createElement("span",null, h.nombre),
          React.createElement("span",{className:"hint",style:{margin:0}}, tf("ih_hojas_filas",{n:h.filas.length})));
      }),
      React.createElement("button",{className:"btn btn-ghost btn-block",style:{marginTop:8},onClick:function(){ setHojasDisp(null); }}, t("ih_volver"))
    ),

    paso===1 && filas && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{color:"var(--muted)",fontSize:13,lineHeight:1.55,marginBottom:14}},
        tf("ih_leidas",{n:filas.length-(hayCab?1:0)})),
      ["fecha","concepto","importe","categoria","banco"].map(function(campo){
        return React.createElement("div",{key:campo,className:"hoja-map"},
          React.createElement("div",{className:"hoja-map-lbl"},
            t("ih_c_"+campo),
            (campo==="fecha"||campo==="concepto"||campo==="importe")
              ? React.createElement("span",{className:"hoja-req"}," *") : null),
          React.createElement("select",{className:"hoja-sel",value:String(map[campo]),
            onChange:function(e){ const v=parseInt(e.target.value,10); setMap(function(m){ return Object.assign({},m,{[campo]:v}); }); }},
            React.createElement("option",{value:"-1"}, t("ih_sin")),
            (function(){ const o=[]; for(let c=0;c<nCols;c++) o.push(React.createElement("option",{key:c,value:String(c)}, cabDe(c)+" · "+ejemploDe(c))); return o; })()
          ));
      }),
      React.createElement("div",{className:"hoja-map"},
        React.createElement("div",{className:"hoja-map-lbl"}, t("ih_signo")),
        React.createElement("div",{style:{display:"flex",gap:8}},
          [["gastos",t("ih_signo_gastos")],["auto",t("ih_signo_auto")]].map(function(o){
            const on=signo===o[0];
            return React.createElement("button",{key:o[0],type:"button",className:"chip"+(on?" on":""),
              onClick:function(){ setSigno(o[0]); }}, o[1]);
          }))),
      React.createElement("div",{className:"hint",style:{margin:"4px 0 14px"}}, t("ih_signo_hint")),
      (map.fecha<0||map.concepto<0||map.importe<0)
        ? React.createElement("div",{className:"hoja-err"}, t("ih_faltan"))
        : null,
      React.createElement("button",{type:"button",className:"v4-cta",
        disabled:map.fecha<0||map.concepto<0||map.importe<0, onClick:calcular}, t("ih_ver"))
    ),

    paso===2 && reparto && React.createElement(React.Fragment,null,
      React.createElement("div",{className:"hoja-marc"},
        React.createElement("div",{className:"hoja-marc-c hoja-marc-ok"},
          React.createElement("b",null, String(reparto.altas.length)),
          React.createElement("span",null, t("ih_entran"))),
        React.createElement("div",{className:"hoja-marc-c hoja-marc-dup"},
          React.createElement("b",null, String(reparto.dupes.length)),
          React.createElement("span",null, t("ih_repes")))),
      reparto.malas.length>0 && React.createElement("div",{className:"hint",style:{marginBottom:10}},
        tf("ih_malas",{n:reparto.malas.length})),
      React.createElement("div",{style:{marginTop:6}},
        reparto.altas.slice(0,8).map(function(g,i){
          return React.createElement("div",{key:"a"+g.id,
            className:"hoja-fila hoja-fila-ok"+(i<revelado?" dentro":"")},
            React.createElement("span",{className:"hoja-fila-ic"},"✓"),
            React.createElement("span",{className:"hoja-fila-tx"}, g.merchant),
            React.createElement("span",{className:"hoja-fila-eu"}, eur(Math.abs(g.amount))));
        }),
        reparto.altas.length>8 && React.createElement("div",{className:"hint",style:{margin:"2px 0 10px"}},
          tf("ih_y_mas",{n:reparto.altas.length-8})),
        reparto.dupes.slice(0,6).map(function(d,i){
          return React.createElement("div",{key:"d"+d.gasto.id,
            className:"hoja-fila hoja-fila-dup"+((i+reparto.altas.slice(0,8).length)<revelado?" dentro":"")},
            React.createElement("span",{className:"hoja-fila-ic"},"↺"),
            React.createElement("span",{className:"hoja-fila-tx"}, d.gasto.merchant),
            React.createElement("span",{className:"hoja-fila-eu"}, eur(Math.abs(d.gasto.amount))));
        }),
        reparto.dupes.length>6 && React.createElement("div",{className:"hint",style:{margin:"2px 0 10px"}},
          tf("ih_y_mas_dup",{n:reparto.dupes.length-6}))),
      React.createElement("div",{className:"hint",style:{margin:"10px 0 14px"}}, t("ih_dup_hint")),
      React.createElement("button",{type:"button",className:"v4-cta",disabled:!reparto.altas.length,onClick:guardar},
        reparto.altas.length?tf("ih_guardar",{n:reparto.altas.length}):t("ih_nada")),
      React.createElement("button",{type:"button",className:"btn btn-ghost btn-block",style:{marginTop:10},
        onClick:function(){ setPaso(1); }}, t("ih_volver"))
    ),

    paso===3 && React.createElement("div",{className:"hoja-fin"},
      React.createElement("div",{className:"hoja-fin-ic"},"🎉"),
      React.createElement("div",{className:"serif",style:{fontSize:21,marginBottom:6}}, t("ih_fin_t")),
      React.createElement("div",{style:{color:"var(--muted)",fontSize:13.5,lineHeight:1.55,marginBottom:16}},
        tf("ih_fin_s",{n:reparto?reparto.altas.length:0})),
      // Ir directo a Gastos con el filtro en "Todo": lo importado suele traer fechas de fuera
      // del mes en curso, y "Este mes" (el filtro por defecto) las tapaba en silencio — parecía
      // que el import no había hecho nada (feedback 2026-08-01).
      React.createElement("button",{type:"button",className:"v4-cta",onClick:function(){ onClose(); if(goGastos) goGastos(); }}, t("ih_fin_ok")))
  ));
}
