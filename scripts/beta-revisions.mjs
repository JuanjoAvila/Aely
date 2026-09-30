import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const registry = JSON.parse(fs.readFileSync(path.join(root, "scripts/beta-sources.json"), "utf8"));
// Falta de alcance es un error de preparación: nunca se traslada al móvil como siete pruebas nuevas.
export function betaRevision(id, read = f => fs.readFileSync(path.join(root, f), "utf8"), surfaces = ["web", "native", "edge"]) {
  const scope = registry[id];
  if(!scope || !Array.isArray(scope.web) || !scope.web.length) throw new Error("Tanda beta sin alcance: " + id);
  const result = {};
  for (const surface of surfaces) {
    if (!scope[surface]) continue;
    const hash = crypto.createHash("sha256");
    for (const source of scope[surface]) {
      const file = typeof source === "string" ? source : source.file;
      if (!/^(src\/|android\/|supabase\/|scripts\/)/.test(file) || file.includes("..")) throw new Error("Alcance beta inválido: " + file);
      let text = read(file).replace(/\r\n/g, "\n");
      if (typeof source !== "string") {
        const start = text.indexOf(source.from), end = source.to ? text.indexOf(source.to, start + source.from.length) : text.length;
        if (start < 0 || end < 0 || text.indexOf(source.from, start + source.from.length) >= 0) {
          const error = new Error("Bloque beta no inequívoco: " + file);
          error.code = start < 0 || end < 0 ? "BETA_SCOPE_ABSENT" : "BETA_SCOPE_AMBIGUOUS";
          throw error;
        }
        text = text.slice(start,end);
      }
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

export function betaNotes(notes) {
  // La migración parte de la producción acreditada 4.26.67. El histórico ya cerrado no
  // se convierte retroactivamente en pruebas pendientes porque no tuviera recibos modernos.
  return notes.map(n => ({ ...n, ...(n.tandas && betaModern(n.v) ? { tandas: n.tandas.map(g => ({ ...g, ...betaRevision(g.id) })) } : {}) }));
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
