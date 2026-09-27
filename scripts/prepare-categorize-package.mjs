#!/usr/bin/env node
/** Cierre congelado: main comparte lógica con ingest que no debe viajar con categorize. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = path.join(root, "supabase/packages/ops01-categorize");
export const manifest = JSON.parse(fs.readFileSync(path.join(pkg, "manifest.json"), "utf8"));
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function replaceOnce(src, before, after) {
  if (src.split(before).length !== 2) throw new Error("El baseline cambió; revisar antes de preparar");
  return src.replace(before, after);
}

export function packageSources(mode = "candidate") {
  if (!["candidate", "rollback"].includes(mode)) throw new Error("Modo no válido");
  const files = {};
  for (const [name, hashes] of Object.entries(manifest.files)) {
    let src = fs.readFileSync(path.join(pkg, "baseline", name), "utf8");
    if (sha256(src) !== hashes.baselineSha256) throw new Error("Baseline alterado: " + name);
    if (mode === "candidate" && name === "categorize/index.ts") {
      src = replaceOnce(src, '"joyeria", "bizum", "otros"', '"joyeria", "otros"');
      src = replaceOnce(src, 'joyeria=joyas; bizum=Bizum enviado a personas; otros=', 'joyeria=joyas; otros=');
    }
    if (mode === "candidate" && name === "_shared/ingest_logic.ts") {
      src = replaceOnce(src, '  bizum:      ["bizum","bizum a ","bizum de ","envio bizum","envío bizum","pago bizum"],\n', "");
    }
    if (sha256(src) !== hashes[mode === "candidate" ? "candidateSha256" : "baselineSha256"]) {
      throw new Error("Candidato alterado: " + name);
    }
    files[name] = src;
  }
  return files;
}

export function writePackage(mode = "candidate", output) {
  const files = packageSources(mode);
  // No se pisa un árbol previo: podría contener otra función o trabajo sin guardar.
  const dest = output ? path.resolve(output) : fs.mkdtempSync(path.join(os.tmpdir(), "categorize-" + mode + "-"));
  if (fs.existsSync(dest) && fs.readdirSync(dest).length) throw new Error("La salida debe estar vacía");
  for (const [name, src] of Object.entries(files)) {
    const f = path.join(dest, "supabase/functions", name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, src);
  }
  // Conserva la versión del SDK resuelta en el paquete activo; @2 es un alias mutable.
  fs.writeFileSync(path.join(dest, "supabase/functions/categorize/import_map.json"),
    JSON.stringify({ imports: { "https://esm.sh/@supabase/supabase-js@2": manifest.dependency } }, null, 2) + "\n");
  fs.writeFileSync(path.join(dest, "supabase/config.toml"),
    'project_id = "ops01-categorize"\n[functions.categorize]\nverify_jwt = true\nimport_map = "./functions/categorize/import_map.json"\n');
  return dest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args.shift() || "candidate";
  if (args.length && (args.length !== 2 || args[0] !== "--out")) throw new Error("Uso: candidate|rollback [--out carpeta-vacía]");
  console.log(writePackage(mode, args[1]));
}
