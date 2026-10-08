import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {betaRevision} from "./beta-revisions.mjs";
import {scopeText} from "./beta-source-code.mjs";

// Gate específico de esta preparación: una beta entera o un scope recortado no acreditan las cinco unidades.
const base="56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b", beta="8dcc5ed39b6e212ba1e34a90b550685794ce0bd5";
const at=process.argv.find(a=>a.startsWith("--candidate="))?.slice(12);
const gitFiles=new Map();
const git=(ref,file)=>{const key=ref+":"+file;if(!gitFiles.has(key))gitFiles.set(key,execFileSync("git",["show",key],{encoding:"utf8",maxBuffer:8e6}));return gitFiles.get(key);};
const read=file=>at?git(at,file):fs.readFileSync(file,"utf8");
const old=file=>git(base,file),approved=file=>git(beta,file);
const ids=["inc-0710-gastos-mes-madrid","inc-0710-appstate-listener-cleanup","inc-0710-banknotif-cleanup","inc-0710-auth-disposal","inc-0810-dashboard-recents-memo"];
const expanded=["inc-0210-03-gastos-periodo","feature-0310-01-movilidad","inc-0310-gastos-sin-limite"];
const reg=JSON.parse(read("scripts/beta-sources.json")),priorReg=JSON.parse(old("scripts/beta-sources.json")),approvedReg=JSON.parse(approved("scripts/beta-sources.json"));
assert.equal(read("VERSION").trim(),"4.26.106");
for(const file of ["package.json","package-lock.json"]){const expected=JSON.parse(old(file));expected.version="4.26.106";if(expected.packages)expected.packages[""].version="4.26.106";assert.deepEqual(JSON.parse(read(file)),expected,"sin dependencias nuevas: "+file);}
const priorUnits=[];
for(const [id,scope]of Object.entries(priorReg)){
  const expected=structuredClone(scope);
  if(expanded.includes(id))expected.web.push({file:"src/modules/08-motor-bank.js",function:"madridYmdParts"},{file:"src/modules/08-motor-bank.js",data:"_mcMadridYmdFmt"});
  assert.deepEqual(reg[id],expected,id+": descriptor intacto salvo cierre Madrid original99");
  if(expanded.includes(id))assert.deepEqual(reg[id],approvedReg[id]);
  const before=betaRevision(id,old,undefined,scope),after=betaRevision(id,read,undefined,reg[id]);
  const betaUnit=betaRevision(id,approved,undefined,reg[id]),changed=before.codigo!==after.codigo;
  if(changed)assert.deepEqual(after,betaUnit,id+": dependencia compartida exacta a beta aprobada");
  const changedSources=scope.web.filter(source=>scopeText(source,old).replace(/\r\n/g,"\n")!==scopeText(source,read).replace(/\r\n/g,"\n")).map(source=>typeof source==="string"?{file:source}:{file:source.file,unit:source.function||source.data||source.from?.slice(0,120),members:source.members});
  priorUnits.push({id,before:before.codigo,after:after.codigo,approvedBeta:betaUnit.codigo,changed,expanded:expanded.includes(id),changedSources});
}
assert.deepEqual(Object.keys(reg).filter(id=>!priorReg[id]).sort(),ids.slice().sort());
const matrix=[];
for(const id of ids){
  assert.deepEqual(reg[id],approvedReg[id],id+": alcance original completo");
  let before;
  try{before=betaRevision(id,old,undefined,reg[id]);}catch(error){if(error.code!=="BETA_SCOPE_ABSENT")throw error;before={codigo:null,reason:error.code};}
  const expected=betaRevision(id,approved,undefined,reg[id]),actual=betaRevision(id,read,undefined,reg[id]);
  assert.deepEqual(actual,expected,id+": código exacto aprobado");assert.notEqual(before.codigo,actual.codigo,id+": delta real frente a main");
  matrix.push({id,before:before.codigo,beforeReason:before.reason,approved:expected.codigo,web:actual.web});
}
const changed=["src/modules/00-core.js","src/modules/03-tab-dash.js","src/modules/04-tab-gastos.js","src/modules/11-app-main.js"];
const normalize=s=>s.replace(/\r\n/g,"\n");
assert.equal(normalize(read("src/build-order.json")),normalize(old("src/build-order.json")),"orden de los17módulos intacto");
for(const file of JSON.parse(read("src/build-order.json"))){const f="src/modules/"+file;assert.equal(normalize(read(f)),normalize(changed.includes(f)?approved(f):old(f)),f);}
assert.equal(normalize(read("src/shell.html")),normalize(approved("src/shell.html")),"sólo encabezado compacto100 y CSS98 ya entregada");
// La compactación100 conserva literalmente todo desde los estilos; no introduce JS/CSS vecinos.
const shell=normalize(read("src/shell.html")),priorShell=normalize(old("src/shell.html"));
assert.ok(shell.indexOf("<style>")>=0&&priorShell.indexOf("<style>")>=0);
assert.equal(shell.slice(shell.indexOf("<style>")),priorShell.slice(priorShell.indexOf("<style>")));
const notes=JSON.parse(read("src/data/release-notes.json")),priorNotes=JSON.parse(old("src/data/release-notes.json")),sourceNotes=JSON.parse(approved("src/data/release-notes.json"));
assert.deepEqual(notes.slice(5),priorNotes,"historial main íntegro");
for(const n of notes.slice(0,5)){const original=sourceNotes.find(x=>x.v===n.v);assert.deepEqual(n,{...original,tandas:[]});}
for(const prefix of ["android/","supabase/","public/apk.json","public/sw.js",".github/workflows/"]){
  const files=execFileSync("git",["ls-tree","-r","--name-only",base,"--",prefix],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  const names=at?execFileSync("git",["ls-tree","-r","--name-only",at,"--",prefix],{encoding:"utf8"}).trim().split("\n").filter(Boolean):execFileSync("git",["ls-files","--cached","--others","--exclude-standard","--",prefix],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  assert.deepEqual(names.slice().sort(),files.slice().sort(),"inventario fuera de alcance: "+prefix);
  const excluded=execFileSync("git",["diff","--name-only",base,...(at?[at]:[]),"--",prefix],{encoding:"utf8"}).trim();
  assert.equal(excluded,"","blobs fuera de alcance intactos: "+prefix);
  for(const f of files)assert.equal(normalize(read(f)),normalize(old(f)),"fuera de alcance: "+f);
}
console.log(JSON.stringify({base,beta,candidate:at||"working-tree",version:"4.26.106",units:matrix,priorUnits,priorNotes:priorNotes.length,scope:"web-only",productionDelivered:false},null,2));
