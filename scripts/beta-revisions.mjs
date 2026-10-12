import fs from "node:fs";
import {execFileSync} from "node:child_process";
import { scopeText, scopeIdentity } from "./beta-source-code.mjs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const registry = JSON.parse(fs.readFileSync(path.join(root, "scripts/beta-sources.json"), "utf8"));
const archiveRegistry = JSON.parse(fs.readFileSync(path.join(root, "scripts/beta-archives.json"), "utf8"));
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

// Sólo109 puede dejar de describir HEAD: su dibujo fue rechazado y ya no existe.
// La referencia fija conserva aquel juicio; jamás acredita código entregado hoy.
const archived109={
  id:"inc-0810-inicio-grafica-significado",sha:"f4ffb9340adfd0a13b631271e8158d2c630613c0",version:"4.26.109",
  codigo:"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0",
  web:"d05bb0d4d86dce14c5ba4794a0be2a265e52f3a167cf8eadce87aa198e5cd38d"
};
const currentOnlyId="inc-0910-inicio-solo-actual";
function assertArchives(archives){
  if(!archives||JSON.stringify(Object.keys(archives))!==JSON.stringify(["schema","refs"])||archives.schema!==1
    ||!archives.refs||JSON.stringify(Object.keys(archives.refs))!==JSON.stringify([archived109.id]))
    throw new Error("Archivo beta no autorizado");
  const ref=archives.refs[archived109.id];
  if(!ref||JSON.stringify(Object.keys(ref))!==JSON.stringify(["sha","version","codigo","revisiones","descriptor","guion"])
    ||ref.sha!==archived109.sha||ref.version!==archived109.version||ref.codigo!==archived109.codigo
    ||JSON.stringify(ref.revisiones)!==JSON.stringify({web:archived109.web}))
    throw new Error("Pin histórico109 inválido");
  return ref;
}
function archiveRawGroup(g){
  const raw={...g};
  for(const field of ["codigo","web","native","edge","referenciaHistorica"])delete raw[field];
  return raw;
}
export function betaArchived(g,scope,archives=archiveRegistry,history=historicalSource){
  const ref=assertArchives(archives);
  if(g.id!==archived109.id)return null;
  if(JSON.stringify(scope)!==JSON.stringify(ref.descriptor)||JSON.stringify(archiveRawGroup(g))!==JSON.stringify(ref.guion))
    throw new Error("Descriptor o guion histórico109 cambiado");
  if((g.codigo!==undefined&&g.codigo!==ref.codigo)||(g.web!==undefined&&g.web!==ref.revisiones.web)||g.native!==undefined||g.edge!==undefined)
    throw new Error("Código histórico109 forjado");
  const oldScopes=JSON.parse(history(ref.sha,"scripts/beta-sources.json"));
  const oldNotes=JSON.parse(history(ref.sha,"src/data/release-notes.json"));
  const original=oldNotes.filter(n=>n.v===ref.version).flatMap(n=>n.tandas||[]).filter(x=>x.id===g.id);
  if(JSON.stringify(oldScopes[g.id])!==JSON.stringify(ref.descriptor)||original.length!==1||JSON.stringify(original[0])!==JSON.stringify(ref.guion))
    throw new Error("Referencia histórica109 no coincide con Git");
  const revision=betaRevision(g.id,f=>history(ref.sha,f),["web","native","edge"],ref.descriptor);
  if(revision.codigo!==ref.codigo||JSON.stringify(Object.fromEntries(Object.entries(revision).filter(([s])=>["web","native","edge"].includes(s))))!==JSON.stringify(ref.revisiones))
    throw new Error("Digest histórico109 no coincide con Git");
  const reference={sha:ref.sha,version:ref.version,codigo:ref.codigo,web:ref.revisiones.web,estado:"ausente"};
  if(g.referenciaHistorica!==undefined&&JSON.stringify(g.referenciaHistorica)!==JSON.stringify(reference))
    throw new Error("Metadata histórica109 forjada");
  return {...ref.guion,...revision,referenciaHistorica:reference};
}
export function betaScopeSource(id,read=f=>fs.readFileSync(path.join(root,f),"utf8"),scopes=registry,archives=archiveRegistry,history=historicalSource){
  const ref=assertArchives(archives);
  if(id!==archived109.id)return {read,scope:scopes[id],archived:false};
  betaArchived(ref.guion,scopes[id],archives,history);
  return {read:f=>history(ref.sha,f),scope:ref.descriptor,archived:true};
}
function assertCurrentOnly(g){
  if(g.id===currentOnlyId&&["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica"].some(k=>Object.hasOwn(g,k)))
    throw new Error("La unidad actual no hereda identidad ni aprobación");
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
  if(g.id===currentOnlyId)return {};
  // Estos dos consumidores estrenan la política de archivo y un fichero que no existía
  // en los commits compatibles. No se hereda su OK sin una auditoría nueva y explícita.
  if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(g.id)&&scope.web.includes("scripts/beta-archives.json"))return {};
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
export function betaNotes(notes,read,scopes=registry,archives=archiveRegistry,history=historicalSource) {
  assertArchives(archives);
  // Una referencia retirada se verifica antes de mirar HEAD y conserva el guion original.
  return notes.map(n=>({...n,...(n.tandas&&betaModern(n.v)?{tandas:n.tandas.map(raw=>{
    assertCurrentOnly(raw);
    const archived=betaArchived(raw,scopes[raw.id],archives,history);
    if(archived){
      if(n.v!==archived.referenciaHistorica.version)throw new Error("Unidad histórica109 presentada como activa");
      return archived;
    }
    const {codigosCompatibles,compatibilidadGit,compatibilidadSha,...g}=raw;
    const current=betaRevision(g.id,read,["web","native","edge"],scopes[g.id]);
    return {...g,...current,...betaHistorical(g,scopes[g.id],history),...betaCompatible(g,current,scopes[g.id],history)};
  })}:{})}));
}

export function betaDelivery(notes, read,scopes=registry,archives=archiveRegistry,history=historicalSource) {
  const ref=assertArchives(archives);
  betaArchived(ref.guion,scopes[archived109.id],archives,history);
  for(const n of notes)for(const g of n.tandas||[]){
    assertCurrentOnly(g);
    if(g.id===archived109.id){
      betaArchived(g,scopes[g.id],archives,history);
      if(n.v!==ref.version)throw new Error("Unidad histórica109 presentada como activa");
    }
  }
  const active = new Set(notes.filter(n=>betaModern(n.v)).flatMap(n => (n.tandas||[]).map(g=>g.id)));
  // Esto acredita solo código web ensamblado. Java en Git no acredita el binario instalado;
  // Edge en Git no acredita la función activa. Sus recibos deben proceder de entregas propias.
  const web = {};
  for(const id of active) if(!scopes[id]) betaRevision(id,read,["web"],scopes[id]);
  for(const id of Object.keys(scopes).sort()) {
    if(id===archived109.id)continue; // Ya verificada arriba: referencia, nunca recibo activo.
    try { web[id] = betaRevision(id,read,["web"],scopes[id]).web; }
    catch(error) {
      // El bootstrap en main acredita solo lo que existe allí. Una tanda activa o un
      // bloque ambiguo siempre abortan; una función todavía ausente no acredita entrega.
      if(active.has(id) || error.code!=="BETA_SCOPE_ABSENT") throw error;
    }
  }
  const pruebas={};
  for(const n of notes)for(const g of n.tandas||[])if(g.id!==archived109.id&&!pruebas[g.id]){
    const title=typeof g.t==="string"?g.t:(g.t&&g.t.es)||"", items=Array.isArray(g.items)?g.items:(g.items&&g.items.es)||[];
    pruebas[g.id]={v:n.v,contenido:JSON.stringify([String(g.id),title,items,g.rev||1])};
  }
  return { sourceSha:/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA||"")?process.env.GITHUB_SHA:null, web, pruebas, referenciasHistoricas:{[archived109.id]:{sha:ref.sha,version:ref.version,codigo:ref.codigo,web:ref.revisiones.web,estado:"ausente"}} };
}
