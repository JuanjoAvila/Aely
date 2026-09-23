#!/usr/bin/env node
/* Los bloqueos siguen funcionando, pero el dueño pidió retirar la iconografía de candado de
   toda la interfaz (feedback 18/9). Este guardián evita que un texto o una pantalla lo reintroduzca
   al copiar un patrón viejo; busca solo glifos visibles, no nombres internos como `locked`. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files=fs.readdirSync(path.join(root,"src","modules")).filter((f)=>f.endsWith(".js"))
  .map((f)=>path.join(root,"src","modules",f)).concat([path.join(root,"src","shell.html")]);
const hits=[];
for(const file of files){
  const txt=fs.readFileSync(file,"utf8");
  if(/[🔒🔓🔐]/u.test(txt)) hits.push(path.relative(root,file));
}
/* Los textos de huella ya no empiezan por emoji: recortar «hasta el primer espacio» se comería
   «Activar»/«Desactivar» y la fila diría «desbloqueo con huella» sin verbo. */
const settings=fs.readFileSync(path.join(root,"src","modules","10-app-components.js"),"utf8");
if(settings.includes('t("au_bio_on")).replace(')) hits.push("10-app-components.js (recorte del texto de huella)");
if(hits.length){
  console.error("no-lock-icons: reaparecieron candados visibles en "+hits.join(", "));
  process.exit(1);
}
console.log("no-lock-icons: OK");
