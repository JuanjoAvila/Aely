import fs from "node:fs";
import {execFileSync} from "node:child_process";
import { scopeText, scopeIdentity } from "./beta-source-code.mjs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const registry = JSON.parse(fs.readFileSync(path.join(root, "scripts/beta-sources.json"), "utf8"));
// Falta de alcance es un error de preparación: nunca se traslada al móvil como siete pruebas nuevas.
export function betaRevision(id, read = f => fs.readFileSync(path.join(root, f), "utf8"), surfaces = ["web", "native", "edge"], scope = registry[id]) {
  const files=new Map();
  const reader=f=>{if(!files.has(f))files.set(f,read(f).replace(/\r\n/g,"\n"));return files.get(f);};
  if(!scope || !Array.isArray(scope.web) || !scope.web.length) throw new Error("Tanda beta sin alcance: " + id);
  const result = {};
  for (const surface of surfaces) {
    if (!scope[surface]) continue;
    const hash = crypto.createHash("sha256");
    for (const source of scope[surface]) {
      const file = typeof source === "string" ? source : source.file;
      if (!/^(src\/|android\/|supabase\/|scripts\/)/.test(file) || file.includes("..")) throw new Error("Alcance beta inválido: " + file);
      const text=scopeText(source,reader);
      if(!scope.unidades||surface!=="web")hash.update(JSON.stringify(source) + "\0" + text + "\0");
    }
    if(scope.unidades&&surface==="web")hash.update(JSON.stringify(scopeIdentity(scope[surface],reader)));
    result[surface] = hash.digest("hex");
  }
  result.codigo = crypto.createHash("sha256").update(JSON.stringify(result)).digest("hex");
  if(scope.historial) result.historial=scope.historial;
  return result;
}

export function betaModern(v) {
  const parts = String(v).split(".").map(Number), floor = [4,26,68];
  for(let i=0;i<3;i++) if(parts[i]!==floor[i]) return parts[i]>floor[i];
  return true;
}

const historicalShas={
  "tr-descripcion-clasificacion":"17aeacc03f595412c044d276c900707cbbd008c8",
  "inc-2809-02-ayuda-ciclo":"17aeacc03f595412c044d276c900707cbbd008c8",
  "inc-2709-01-arranque-red":"26972970d216f272b0d555d7d8548bb99afd6ba5"
};
const historicalFiles=new Map();
function historicalSource(sha,file){
  const key=sha+":"+file;
  if(!historicalFiles.has(key)){
    try { historicalFiles.set(key,execFileSync("git",["show",key],{cwd:root,encoding:"utf8",maxBuffer:5*1024*1024,stdio:["ignore","pipe","ignore"]})); }
    catch { throw new Error("Fuente histórica beta no disponible: "+key); }
  }
  return historicalFiles.get(key);
}
function digestCode(revisions){ return crypto.createHash("sha256").update(JSON.stringify(revisions)).digest("hex"); }
export function betaHistorical(g,scope,history=historicalSource){
  const audit=scope&&scope.auditoria,expanded=audit&&audit.ampliada;
  if(!expanded)return {};
  // Esta ampliación procede del commit aprobado, nunca de HEAD. La referencia vieja
  // permanece visible en el artefacto y en src; solo cambia el alcance que se compara.
  if(!historicalShas[g.id]||audit.sha!==historicalShas[g.id]||expanded.sha!==audit.sha||
    g.codigoDesde!==digestCode(audit.revisiones)||JSON.stringify(g.revisionesDesde)!==JSON.stringify(audit.revisiones)||
    expanded.codigo!==digestCode(expanded.revisiones)||expanded.huella!==g.huella)
    throw new Error("Referencia histórica beta inválida: "+g.id);
  if(!expanded.scope)throw new Error("Alcance histórico beta ausente: "+g.id);
  const verified=betaRevision(g.id,f=>history(expanded.sha,f),["web","native","edge"],expanded.scope);
  const revisions=Object.fromEntries(Object.entries(verified).filter(([k])=>["web","native","edge"].includes(k)));
  if(verified.codigo!==expanded.codigo||JSON.stringify(revisions)!==JSON.stringify(expanded.revisiones))
    throw new Error("Referencia histórica beta no coincide con Git: "+g.id);
  return {referenciaAnterior:{sha:audit.sha,huella:g.huella,codigoDesde:g.codigoDesde,revisionesDesde:g.revisionesDesde},
    codigoDesde:expanded.codigo,revisionesDesde:expanded.revisiones};
}
const compatibilityShas=[
  "955765a9ec0ad96d20140a8f12da00c9fa04985c",
  "d45fb8b17cda1a1d628d34bbe9ea660ec7f38a18",
  "eaf55e4af38d2277a50baa5e736a93cd09b3a627",
  "6468ac051c1020151c40e90145dcc9f514790b60",
  "1624fd19f11b18a1675c2255e8ffd6fde5ea3dc2",
  "ca7b97d438e01f60091a3818fdca734740ec8a9e"
];
const compatibleCache=new Map();
export function betaCompatible(g,current,scope,history=historicalSource){
  // No se hereda por id: cada identidad vieja se recalcula en su fuente fija de Git
  // y solo casa si todas las unidades actuales, guion y superficies siguen idénticas.
  if(!scope.unidades)return {};
  // Las notas repiten tandas: el mismo alcance/código/guion contra SHAs inmutables
  // no necesita releer y recorrer seis fuentes. Lectores de prueba no usan esta caché.
  const key=history===historicalSource?JSON.stringify([g.id,g.t,g.items,g.rev||1,current.codigo,scope]):null;
  if(key&&compatibleCache.has(key))return structuredClone(compatibleCache.get(key));
  const codes=[],evidence=[];
  for(const sha of compatibilityShas){
    const oldScopes=JSON.parse(history(sha,"scripts/beta-sources.json"));
    const oldNotes=JSON.parse(history(sha,"src/data/release-notes.json"));
    const original=oldNotes.flatMap(n=>n.tandas||[]).find(x=>x.id===g.id&&
      JSON.stringify([x.t,x.items,x.rev||1])===JSON.stringify([g.t,g.items,g.rev||1]));
    if(!original||!oldScopes[g.id])continue;
    let baseline;
    try{baseline=betaRevision(g.id,f=>history(sha,f),["web","native","edge"],scope);}
    catch(error){if(error.code==="BETA_SCOPE_ABSENT")continue;throw error;}
    if(baseline.codigo!==current.codigo)continue;
    const old=betaRevision(g.id,f=>history(sha,f),["web","native","edge"],oldScopes[g.id]);
    if(!codes.includes(old.codigo)){codes.push(old.codigo);evidence.push({sha:sha,codigo:old.codigo,...Object.fromEntries(Object.entries(old).filter(([k])=>["web","native","edge"].includes(k)))});}
  }
  const result=codes.length?{codigosCompatibles:codes,compatibilidadGit:evidence}:{};
  if(key){compatibleCache.set(key,result);if(compatibleCache.size>256)compatibleCache.delete(compatibleCache.keys().next().value);}
  return structuredClone(result);
}
export function betaNotes(notes,read,scopes=registry) {
  // Hasta67 conserva el histórico cerrado. La comparación ampliada de aprobaciones
  // añade metadata auditada sin reescribir sus referencias originales en src.
  return notes.map(n=>({...n,...(n.tandas&&betaModern(n.v)?{tandas:n.tandas.map(({codigosCompatibles,compatibilidadGit,compatibilidadSha,...g})=>({...g,
    ...betaRevision(g.id,read,["web","native","edge"],scopes[g.id]),...betaHistorical(g,scopes[g.id]),
    ...betaCompatible(g,betaRevision(g.id,read,["web","native","edge"],scopes[g.id]),scopes[g.id])}))}:{})}));
}

export function betaDelivery(notes, read) {
  const active = new Set(notes.filter(n=>betaModern(n.v)).flatMap(n => (n.tandas||[]).map(g=>g.id)));
  // Esto acredita solo código web ensamblado. Java en Git no acredita el binario instalado;
  // Edge en Git no acredita la función activa. Sus recibos deben proceder de entregas propias.
  const web = {};
  for(const id of active) if(!registry[id]) betaRevision(id,read);
  for(const id of Object.keys(registry).sort()) {
    try { web[id] = betaRevision(id,read,["web"]).web; }
    catch(error) {
      // El bootstrap en main acredita solo lo que existe allí. Una tanda activa o un
      // bloque ambiguo siempre abortan; una función todavía ausente no acredita entrega.
      if(active.has(id) || error.code!=="BETA_SCOPE_ABSENT") throw error;
    }
  }
  const pruebas={};
  for(const n of notes)for(const g of n.tandas||[])if(!pruebas[g.id]){
    const title=typeof g.t==="string"?g.t:(g.t&&g.t.es)||"", items=Array.isArray(g.items)?g.items:(g.items&&g.items.es)||[];
    pruebas[g.id]={v:n.v,contenido:JSON.stringify([String(g.id),title,items,g.rev||1])};
  }
  return { sourceSha:/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA||"")?process.env.GITHUB_SHA:null, web, pruebas };
}
