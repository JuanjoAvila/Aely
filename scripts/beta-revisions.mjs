import fs from "node:fs";
import {execFileSync} from "node:child_process";
import { scopeText } from "./beta-source-code.mjs";
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
      hash.update(JSON.stringify(source) + "\0" + text + "\0");
    }
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
export function betaNotes(notes,read,scopes=registry) {
  // Hasta67 conserva el histórico cerrado. La comparación ampliada de aprobaciones
  // añade metadata auditada sin reescribir sus referencias originales en src.
  return notes.map(n=>({...n,...(n.tandas&&betaModern(n.v)?{tandas:n.tandas.map(g=>({...g,
    ...betaRevision(g.id,read,["web","native","edge"],scopes[g.id]),...betaHistorical(g,scopes[g.id])}))}:{})}));
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
  return { sourceSha:/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA||"")?process.env.GITHUB_SHA:null, web };
}
