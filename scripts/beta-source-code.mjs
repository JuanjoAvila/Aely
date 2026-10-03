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

// Conservador: se preservan espacios, comentarios y saltos dentro de cada unidad.
// Evita confundir ASI en JS o descendientes CSS; reanclar no cambia la unidad cubierta.
export function scopeIdentity(sources,read){
  const files=new Map();
  for(const source of sources){
    const file=typeof source==="string"?source:source.file,text=read(file).replace(/\r\n/g,"\n"),piece=scopeText(source,read);
    if(!files.has(file))files.set(file,{text,ranges:[],members:[]});
    const entry=files.get(file);
    if(source.members){entry.members.push(piece);continue;}
    const start=typeof source==="string"?0:source.function?logicFunctions(read,[file]).get(source.function).start:source.data?logicData(read,[file]).get(source.data).start:text.indexOf(source.from);
    let end=start+piece.length;
    if(typeof source!=="string"&&source.from&&/^(?:async )?function /.test(source.from)){
      const fn=[...logicFunctions(read,[file]).values()].find(fn=>fn.start===start);
      if(fn&&piece.startsWith(fn.text)&&!codeMask(piece.slice(fn.text.length)).trim())end=fn.end;
    }
    entry.ranges.push([start,end]);
  }
  return [...files].sort(([a],[b])=>a.localeCompare(b)).map(([file,entry])=>{
    const merged=[];for(const range of entry.ranges.sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
    const pieces=[];
    if(file.endsWith(".js")){
      const units=[...logicFunctions(read,[file]).values(),...logicData(read,[file]).values()].sort((a,b)=>a.start-b.start);
      for(const [a,b]of merged){
        let cursor=a;
        for(const unit of units){
          if(unit.start<cursor||unit.end>b)continue;
          const gap=entry.text.slice(cursor,unit.start);if(codeMask(gap).trim())pieces.push(gap);
          pieces.push(unit.text);cursor=unit.end;
        }
        const tail=entry.text.slice(cursor,b);if(codeMask(tail).trim())pieces.push(tail);
      }
    }else for(const [a,b]of merged)pieces.push(entry.text.slice(a,b));
    return [file,pieces,[...new Set(entry.members.map(x=>JSON.stringify(x)))].sort().map(x=>JSON.parse(x))];
  });
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
  if(source.exclude){
    let out=text;
    for(const block of source.exclude){
      const start=out.indexOf(block.from),end=out.indexOf(block.to,start+block.from.length);
      if(start<0||end<0||out.indexOf(block.from,start+block.from.length)>=0||out.indexOf(block.to,end+block.to.length)>=0){
        const error=new Error("Exclusión beta no inequívoca: "+file);error.code="BETA_SCOPE_ABSENT";throw error;
      }
      out=out.slice(0,start)+out.slice(end);
    }
    return out;
  }
  if(source.data){const data=logicData(read,[file]).get(source.data);if(!data){const error=new Error("Dato beta ausente: "+file+":"+source.data);error.code="BETA_SCOPE_ABSENT";throw error;}return source.members?objectMembers(data.text,source.members).text:data.text;}
  if(source.function){const fn=logicFunctions(read,[file]).get(source.function);if(!fn){const error=new Error("Bloque beta ausente: "+file+":"+source.function);error.code="BETA_SCOPE_ABSENT";throw error;}return fn.text;}
  const start=text.indexOf(source.from),end=source.to?text.indexOf(source.to,start+source.from.length):text.length;
  if(start<0||end<0||text.indexOf(source.from,start+source.from.length)>=0){const error=new Error("Bloque beta no inequívoco: "+file);error.code=start<0||end<0?"BETA_SCOPE_ABSENT":"BETA_SCOPE_AMBIGUOUS";throw error;}
  return text.slice(start,end+(source.includeTo?source.to.length:0));
}

// Una tanda que usa un método no depende de todas las operaciones de la nube.
// Se conserva la inicialización compartida. Getter/spread y capturas dinámicas abortan:
// no acreditan una lista de métodos puros delimitada, aunque el miembro parezca ajeno.
export function objectMembers(text,names){
  const clean=codeMask(text);let level=0,start=-1;
  for(let i=0;i<clean.length;i++){
    const match=level===1?/^return\s*\{/.exec(clean.slice(i)):null;
    if(match){if(start>=0)throw new Error("Objeto beta no inequívoco");start=clean.indexOf("{",i);}
    if(clean[i]==="{")level++;else if(clean[i]==="}")level--;
  }
  if(start<0)throw new Error("Objeto beta no delimitable");
  const pieces=new Map();let depth=1,at=start+1,end=-1;
  const add=stop=>{
    const piece=text.slice(at,stop),masked=codeMask(piece).trim();
    if(!masked)return;
    const key=/^(?:async\s+)?([\w$]+)\s*\(/.exec(masked);
    if(!key||pieces.has(key[1]))throw new Error("Miembro beta no inequívoco");
    new vm.Script("({"+piece+"})");pieces.set(key[1],piece);
  };
  for(let i=start+1;i<clean.length;i++){
    if(/[({\[]/.test(clean[i]))depth++;
    else if(/[)}\]]/.test(clean[i]))depth--;
    if(depth===1&&clean[i]===","){add(i);at=i+1;}
    if(depth===0){add(i);end=i;break;}
  }
  if(end<0)throw new Error("Objeto beta no delimitable");
  const selected=new Set(names),queue=[...names];
  const self=/^(?:const|let|var)\s+([\w$]+)\s*=/.exec(clean);
  const scanCalls=(piece,initializer=false)=>{
    const scan=codeMask(piece);
    // Con ejecución dinámica no sabemos qué método se leerá: conservar solo el
    // prefijo no acredita el objeto omitido. El cierre debe abortar, no heredar un OK.
    if(/\b(?:eval|Function)\b|\.\s*constructor\b/.test(scan))throw new Error("Evaluación beta dinámica sin alcance");
    for(const token of scan.matchAll(/[A-Za-z_$][\w$]*/g)){
      if(token[0]!=="this"&&(!self||token[0]!==self[1]))continue;
      if(initializer&&self&&token[0]===self[1]&&token.index===self[0].indexOf(self[1]))continue;
      const tail=scan.slice(token.index+token[0].length),member=/^\s*\.\s*([\w$]+)/.exec(tail);
      // Un alias/destructuring/callback u opcional escondería otro método alcanzado.
      // Las cachés this._evSent/_evN sí son accesos normales dentro del código elegido.
      if(!member)throw new Error("Miembro beta dinámico sin alcance");
      const name=member[1];
      if(!selected.has(name)&&(pieces.has(name)||tail.slice(member[0].length).trimStart().startsWith("("))){selected.add(name);queue.push(name);}
    }
  };
  for(;;){
    while(queue.length){
      const name=queue.shift(),piece=pieces.get(name);
      if(!piece){const error=new Error("Miembro beta ausente: "+name);error.code="BETA_SCOPE_ABSENT";throw error;}
      scanCalls(piece);
    }
    const methods=[...selected].sort().map(name=>pieces.get(name)).join(",");
    const initializer=memberInitializer(text.slice(0,start+1),methods+text.slice(end));
    // Un helper privado alcanzado puede volver a otro método del mismo objeto.
    scanCalls(initializer,true);
    if(!queue.length)return {text:initializer+methods+text.slice(end),pieces};
  }
}

// Las declaraciones privadas no ejecutan nada al crear cloud; solo se incluyen si
// las lee un método seleccionado, otro helper alcanzado o la inicialización común.
// El resto del initializer se conserva literal: sus efectos siguen invalidando.
export function memberInitializer(prefix,selected){
  const clean=codeMask(prefix),functions=new Map();let depth=0;
  for(let i=0;i<clean.length;i++){
    if(depth===1){
      const match=/^(?:async\s+)?function\s+([\w$]+)\s*\(/.exec(clean.slice(i));
      if(match){
        let body=i+match[0].length,params=1;
        for(;body<clean.length&&params;body++){if(clean[body]==="(")params++;else if(clean[body]===")")params--;}
        while(/\s/.test(clean[body]||"")&&body<clean.length)body++;
        if(params||clean[body]!=="{")throw new Error("Parámetros privados beta no delimitables");
        let end=body+1,balance=1;
        for(;end<clean.length&&balance;end++){if(clean[end]==="{")balance++;else if(clean[end]==="}")balance--;}
        if(body<0||balance)throw new Error("Helper privado beta no delimitable");
        const piece=prefix.slice(i,end);new vm.Script(piece);
        if(functions.has(match[1]))throw new Error("Helper privado beta duplicado");
        let a=i,b=end;
        const line=prefix.lastIndexOf("\n",i-1)+1;
        if(!prefix.slice(line,i).trim())a=line;
        const next=prefix.indexOf("\n",end);
        if(next>=0&&!prefix.slice(end,next).trim())b=next+1;
        functions.set(match[1],{a,b,piece});i=end-1;continue;
      }
    }
    if(clean[i]==="{")depth++;else if(clean[i]==="}")depth--;
  }
  if(!functions.size)return prefix;
  let initializer=prefix;
  for(const fn of [...functions.values()].sort((a,b)=>b.a-a.a))initializer=initializer.slice(0,fn.a)+initializer.slice(fn.b);
  const used=new Set(),queue=[initializer+selected];
  while(queue.length){
    const scan=codeMask(queue.shift());
    for(const token of scan.matchAll(/[\w$]+/g))if(functions.has(token[0])&&!used.has(token[0])){used.add(token[0]);queue.push(functions.get(token[0]).piece);}
  }
  const at=initializer.lastIndexOf("return");
  return initializer.slice(0,at)+[...used].sort().map(name=>functions.get(name).piece+"\n").join("")+initializer.slice(at);
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
  const arrow=/^(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s*)?(?:\([^;\n]*\)|[\w$]+)\s*=>/.exec(fn.text);
  let replacement;
  if(arrow){
    const head=arrow[0],body=fn.text.slice(head.length);
    if(body.trimStart().startsWith("{")){const at=body.indexOf("{")+1;replacement=head+body.slice(0,at)+' throw new Error("dependencia mutada"); '+body.slice(at);}
    else replacement=head+"(null&&("+body.replace(/;\s*$/,"")+"));";
  }else{
    const at=fn.text.lastIndexOf("}");if(at<0)throw new Error("Mutación no delimitada "+fn.name);
    replacement=fn.text.slice(0,at)+' throw new Error("dependencia mutada"); '+fn.text.slice(at);
  }
  new vm.Script(replacement);
  return text.slice(0,fn.start)+replacement+text.slice(fn.end);
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
  while(queue.length){const text=queue.shift();for(const name of logicCalls(text,functions)){if(seenFunctions.has(name)||Object.hasOwn(benignCalls,name))continue;seenFunctions.add(name);queue.push(functions.get(name).text);}for(const name of logicReads(text,data)){if(seenData.has(name)||Object.hasOwn(benignData,name))continue;seenData.add(name);const source=scope.web.find(s=>s.data===name&&s.members);queue.push(source?scopeText(source,read):data.get(name).text);}}
  return [...seenData].map(name=>data.get(name));
}
export function mutateData(text,data){text=text.replace(/\r\n/g,"\n");return text.slice(0,data.init)+"0||"+text.slice(data.init);}
