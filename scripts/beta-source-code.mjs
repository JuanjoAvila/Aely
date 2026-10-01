import vm from "node:vm";

// El guardián recorre llamadas, no palabras dentro de comentarios, textos o regex.
export function codeMask(text) {
  const out=text.split(""); let prev="",word="";
  const blank=(a,b)=>{for(let k=a;k<b;k++) if(out[k]!=="\n") out[k]=" ";};
  for(let i=0;i<text.length;){
    const c=text[i],n=text[i+1];
    if(c==="/"&&(n==="/"||n==="*")){
      let j=n==="/"?text.indexOf("\n",i+2):text.indexOf("*/",i+2);
      if(j<0) j=text.length; else if(n==="*") j+=2;
      blank(i,j);i=j;continue;
    }
    if(c==='"'||c==="'"||c.charCodeAt(0)===96){
      let j=i+1; for(;j<text.length;j++){if(text[j]==="\\"){j++;continue;}if(text[j]===c){j++;break;}}
      // Las plantillas con interpolación se rechazan para no esconder llamadas de dinero.
      if(c.charCodeAt(0)===96&&text.slice(i,j).includes("${")) throw new Error("Interpolación requiere cobertura explícita del guardián");
      blank(i,j);i=j;prev="literal";word="";continue;
    }
    if(c==="/"&&(!prev||/[=(:,!&|?;{}\[]/.test(prev)||/^(return|throw|case|delete|void|typeof|yield|await)$/.test(word))){
      let j=i+1,cls=false;for(;j<text.length;j++){if(text[j]==="\\"){j++;continue;}if(text[j]==="[")cls=true;else if(text[j]==="]")cls=false;else if(text[j]==="/"&&!cls){j++;while(/[a-z]/i.test(text[j]||"")&&j<text.length)j++;break;}}
      blank(i,j);i=j;prev="literal";word="";continue;
    }
    if(/[\w$]/.test(c)){let j=i+1;while(j<text.length&&/[\w$]/.test(text[j]))j++;word=text.slice(i,j);prev="word";i=j;continue;}
    if(!/\s/.test(c)){prev=c;word="";}i++;
  }
  return out.join("");
}

const parsedFiles=new Map();
export function logicFunctions(read, files=["src/modules/00-core.js","src/modules/01-i18n.js","src/modules/08-motor-bank.js"]) {
  const result=new Map();
  for(const file of files){
    const text=read(file).replace(/\r\n/g,"\n");
    const cached=parsedFiles.get(file+"\0"+text);
    if(cached){for(const [name,fn] of cached)result.set(name,fn);continue;}
    const own=new Map();
    const re=/^(?:(?:async )?function\s+([\w$]+)\s*\(|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:(?:async\s*)?function\b|(?:\([^;\n]*\)|[\w$]+)\s*=>))/gm;
    const scan=codeMask(text);
    let m;while((m=re.exec(scan))){
      const name=m[1]||m[2],start=m.index;
      const endings=/[;}](?=[ \t]*(?:\/\/[^\n]*)?(?:\n|$))/g;endings.lastIndex=start+m[0].length;let end;
      while((end=endings.exec(text))){const piece=text.slice(start,end.index+1);try{new vm.Script(piece);if(result.has(name))throw new Error("Función duplicada "+name);const fn={name,file,start,end:end.index+1,text:piece};result.set(name,fn);own.set(name,fn);break;}catch(error){if(error.message.startsWith("Función duplicada"))throw error;}}
      if(!end)throw new Error("Función no delimitada "+file+":"+name);
    }
    parsedFiles.set(file+"\0"+text,own);if(parsedFiles.size>32)parsedFiles.delete(parsedFiles.keys().next().value);
  }
  return result;
}

export function scopeText(source,read){
  const file=typeof source==="string"?source:source.file;
  const text=read(file).replace(/\r\n/g,"\n");
  if(typeof source==="string")return text;
  if(source.data){const data=logicData(read,[file]).get(source.data);if(!data){const error=new Error("Dato beta ausente: "+file+":"+source.data);error.code="BETA_SCOPE_ABSENT";throw error;}return data.text;}
  if(source.function){const fn=logicFunctions(read,[file]).get(source.function);if(!fn){const error=new Error("Bloque beta ausente: "+file+":"+source.function);error.code="BETA_SCOPE_ABSENT";throw error;}return fn.text;}
  const start=text.indexOf(source.from),end=source.to?text.indexOf(source.to,start+source.from.length):text.length;
  if(start<0||end<0||text.indexOf(source.from,start+source.from.length)>=0){const error=new Error("Bloque beta no inequívoco: "+file);error.code=start<0||end<0?"BETA_SCOPE_ABSENT":"BETA_SCOPE_AMBIGUOUS";throw error;}
  return text.slice(start,end);
}

export function logicCalls(text,functions){
  const clean=codeMask(text),calls=new Set(),re=/\b([\w$]+)\s*\(/g;let m;
  while((m=re.exec(clean))){if(functions.has(m[1])&&clean.slice(0,m.index).trimEnd().slice(-1)!==".")calls.add(m[1]);}
  return calls;
}

// Transporte/i18n/telemetría no decide elegibilidad ni importes; una traducción ajena
// no debe volver a pedir una compra. Cada excepción futura exige motivo y revisión.
export const benignCalls={
  t:"traducción por clave",tf:"interpolación de una traducción",
  natPlugin:"acceso al puente nativo, no cálculo financiero",mcLogText:"sanitización de telemetría",
  mcLogCode:"código sanitizado de error",mcScheduleIdle:"programación sin cálculo de importes"
};

export function scopeDependencies(scope,read,functions=logicFunctions(read)){
  const seen=new Set(),queue=[];
  for(const source of scope.web)for(const name of logicCalls(scopeText(source,read),functions))queue.push(name);
  while(queue.length){const name=queue.shift();if(seen.has(name)||benignCalls[name])continue;seen.add(name);for(const next of logicCalls(functions.get(name).text,functions))queue.push(next);}
  return [...seen].map(name=>functions.get(name));
}
export function mutateLogic(text,fn){
  text=text.replace(/\r\n/g,"\n");
  // Dentro de la declaración: añadir al final quedaría fuera de un bloque ya cubierto.
  const arrow=fn.text.indexOf("=>"),brace=fn.text.lastIndexOf("}");
  const at=brace>=0?brace:arrow>=0?arrow+2:-1;
  if(at<0)throw new Error("Mutación no delimitada "+fn.name);
  return text.slice(0,fn.start+at)+" /* dependencia mutada */ "+text.slice(fn.start+at);
}

const parsedData=new Map();
export function logicData(read,files=["src/modules/00-core.js","src/modules/01-i18n.js","src/modules/08-motor-bank.js"]){
  const result=new Map(),functions=logicFunctions(read,files);
  for(const file of files){
    const text=read(file).replace(/\r\n/g,"\n"),key=file+"\0"+text;
    if(parsedData.has(key)){for(const [name,data] of parsedData.get(key))result.set(name,data);continue;}
    const scan=codeMask(text),own=new Map(),re=/^(?:const|let|var)\s+([\w$]+)\s*=/gm;let m;
    while((m=re.exec(scan))){
      if(functions.has(m[1]))continue;
      const start=m.index,endings=/[;}](?=[ \t]*(?:\/\/[^\n]*)?(?:\n|$))/g;endings.lastIndex=start+m[0].length;let end,piece;
      while((end=endings.exec(text))){piece=text.slice(start,end.index+1);try{new vm.Script(piece);break;}catch{}}
      if(!end)throw new Error("Dato no delimitado "+file+":"+m[1]);
      const clean=codeMask(piece),depths=[];let depth=0;
      for(let i=0;i<clean.length;i++){depths[i]=depth;if(/[({\[]/.test(clean[i]))depth++;else if(/[)}\]]/.test(clean[i]))depth--;}
      // Una declaración puede inicializar varias cachés: todas deben quedar vigiladas.
      const names=/(?:^(?:const|let|var)\s+|,\s*)([\w$]+)\s*=\s*/g;let item;
      while((item=names.exec(clean))){if(depths[item.index]!==0)continue;const name=item[1];if(result.has(name))throw new Error("Dato duplicado "+name);let init=piece.indexOf("=",item.index)+1;while(/\s/.test(piece[init]||"")&&init<piece.length)init++;const data={name,file,start,end:end.index+1,init:start+init,text:piece};result.set(name,data);own.set(name,data);}
      re.lastIndex=end.index+1;
    }
    parsedData.set(key,own);if(parsedData.size>32)parsedData.delete(parsedData.keys().next().value);
  }
  return result;
}

// Solo se excluyen textos/idiomas: formato numérico, divisa, retos y fechas sí se cubren.
export const benignData={
  LANG:"diccionario de textos, no decide importes",LANGS:"selector de idiomas",
  CURLANG:"idioma elegido",LOCALE:"locale de presentación",MON_I18N:"nombres de meses",
  LANG_SIMPLE:"variantes de texto simple",SIMPLEMODE:"selección de variante de texto",
  _langPackLoads:"caché de carga de traducciones"
};
export function logicReads(text,data){
  const clean=codeMask(text),reads=new Set(),re=/[\w$]+/g;let m;
  while((m=re.exec(clean))){if(!data.has(m[0]))continue;const before=clean.slice(0,m.index).trimEnd(),after=clean.slice(m.index+m[0].length).trimStart();if(before.endsWith(".")||(after.startsWith(":")&&/[{,]$/.test(before)))continue;reads.add(m[0]);}
  return reads;
}
export function scopeDataDependencies(scope,read,functions=logicFunctions(read),data=logicData(read)){
  const seenFunctions=new Set(),seenData=new Set(),queue=scope.web.map(source=>scopeText(source,read));
  while(queue.length){const text=queue.shift();for(const name of logicCalls(text,functions)){if(seenFunctions.has(name)||Object.hasOwn(benignCalls,name))continue;seenFunctions.add(name);queue.push(functions.get(name).text);}for(const name of logicReads(text,data)){if(seenData.has(name)||Object.hasOwn(benignData,name))continue;seenData.add(name);queue.push(data.get(name).text);}}
  return [...seenData].map(name=>data.get(name));
}
export function mutateData(text,data){text=text.replace(/\r\n/g,"\n");return text.slice(0,data.init)+"0||"+text.slice(data.init);}
