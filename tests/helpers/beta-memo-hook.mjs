// Hook de carga SOLO para tests/beta-sources.test.mjs (se registra desde ahí).
//
// Por qué existe: ese fichero llegó a 2,4 h en la CI de beta (2026-10-20; ~64 min en local). Cada catálogo
// histórico recalcula el cierre de lectores de ~95 descriptores y «cada dato leído» muta 3.414 datos, y cada
// llamada a scripts/beta-source-code.mjs pagaba, sobre el monolito entero (~medio MB por fichero):
//   1. normalizar CRLF y componer la clave «fichero\0texto» (otra copia que aplanar y hashear);
//   2. buscarla en un Map: V8 hashea las cadenas largas (>16.383 caracteres) SOLO por su longitud, así que los
//      mutantes de un mismo fichero (misma longitud ±3) colisionan todos y cada get compara bytes contra varios
//      (~28 µs × 850.000 llamadas = 24 s por cada doce descriptores);
//   3. recompilar con new vm.Script cada trozo, aunque el 99 % fuera idéntico al texto sin mutar (~2 s por mutante).
//
// Por qué un hook y no editar el módulo: beta-source-code.mjs es parte del alcance de dos descriptores
// (beta-panel-veredictos, ops-0410-panel-cola). Tocarlo movería sus huellas y obligaría a reabrir la lista
// cerrada de cada catálogo. Aquí el fichero queda byte a byte igual y el cambio vive solo en memoria, dentro
// de la corrida del test. Si alguien reescribe esas líneas, el hook ABORTA en vez de seguir sin parchear.
//
// Qué cambia: nada observable. Las cachés siguen indexadas por el CONTENIDO del texto (un mutante o un fichero
// distinto es otro texto y se analiza de cero) y la validez de sintaxis por el digest del trozo (compilar es una
// función pura de sus bytes; el error también se conserva). BETA_SOURCES_NO_MEMO=1 desactiva el parche para
// poder comparar con el comportamiento original.
const CAMBIOS=[
  [
    'import vm from "node:vm";\n',
    `import vm from "node:vm";
import crypto from "node:crypto";
// Mapa por contenido con acceso por identidad primero: lo reciente se encuentra con un === de puntero (O(1)) y
// solo cae a comparar bytes cuando el objeto es otro (una vez por lectura, y entonces se rebautiza la clave).
class TextMap{
  constructor(max){this.max=max;this.items=[];}
  get(text){
    const a=this.items;
    for(let i=0;i<a.length;i++){const e=a[i];if(e[0]===text){e[0]=text;if(i>0){a.splice(i,1);a.unshift(e);}return e[1];}}
    return undefined;
  }
  set(text,value){this.items.unshift([text,value]);if(this.items.length>this.max)this.items.pop();return value;}
}
const normCache=new TextMap(96);
function norm(raw){const hit=normCache.get(raw);return hit!==undefined?hit:normCache.set(raw,raw.replace(/\\r\\n/g,"\\n"));}
function perFile(cache,text){return cache.get(text)||cache.set(text,new Map());}
const scriptCache=new Map();
function validScript(piece){
  const key=crypto.createHash("sha256").update(piece).digest("base64"),hit=scriptCache.get(key);
  if(hit===true)return;if(hit)throw hit.error;
  try{new vm.Script(piece);scriptCache.set(key,true);}
  catch(error){scriptCache.set(key,{error});throw error;}
  if(scriptCache.size>200000)scriptCache.delete(scriptCache.keys().next().value);
}
`
  ],
  ['const parsedFiles=new Map();','const parsedFiles=new TextMap(96);'],
  ['const parsedData=new Map();','const parsedData=new TextMap(96);'],
  ['text=read(file).replace(/\\r\\n/g,"\\n"),piece=scopeText(source,read);','text=norm(read(file)),piece=scopeText(source,read);'],
  [
    'const text=read(file).replace(/\\r\\n/g,"\\n");\n    const cached=parsedFiles.get(file+"\\0"+text);',
    'const text=norm(read(file));\n    const cached=parsedFiles.get(text)?.get(file);'
  ],
  [
    'parsedFiles.set(file+"\\0"+text,own);if(parsedFiles.size>32)parsedFiles.delete(parsedFiles.keys().next().value);',
    'perFile(parsedFiles,text).set(file,own);'
  ],
  [
    'const text=read(file).replace(/\\r\\n/g,"\\n");\n  if(typeof source==="string")return text;',
    'const text=norm(read(file));\n  if(typeof source==="string")return text;'
  ],
  [
    'const text=read(file).replace(/\\r\\n/g,"\\n"),key=file+"\\0"+text;\n    if(parsedData.has(key)){for(const [name,data] of parsedData.get(key))result.set(name,data);continue;}',
    'const text=norm(read(file)),cached=parsedData.get(text)?.get(file);\n    if(cached){for(const [name,data] of cached)result.set(name,data);continue;}'
  ],
  [
    'parsedData.set(key,own);if(parsedData.size>32)parsedData.delete(parsedData.keys().next().value);',
    'perFile(parsedData,text).set(file,own);'
  ]
];

export async function load(url,context,nextLoad){
  const result=await nextLoad(url,context);
  if(process.env.BETA_SOURCES_NO_MEMO==="1"||!url.endsWith("/scripts/beta-source-code.mjs"))return result;
  let source=String(result.source).replace(/\r\n/g,"\n");
  // Va ANTES de inyectar la caché, que a su vez contiene el único new vm.Script que debe quedar.
  const compilaciones=source.split("new vm.Script(");
  if(compilaciones.length!==6)throw new Error("beta-memo-hook: se esperaban 5 compilaciones y hay "+(compilaciones.length-1)+". Actualiza tests/helpers/beta-memo-hook.mjs");
  source=compilaciones.join("validScript(");
  for(const [antes,despues] of CAMBIOS){
    if(source.split(antes).length!==2)throw new Error("beta-memo-hook: el módulo cambió y el parche ya no encaja ("+antes.slice(0,60)+"…). Actualiza tests/helpers/beta-memo-hook.mjs");
    source=source.replace(antes,()=>despues);
  }
  return {...result,source};
}
