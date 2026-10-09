import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {revisionReader,scopeText,scopeIdentity,logicFunctions,logicData,scopeDependencies,scopeDataDependencies} from "../scripts/beta-source-code.mjs";
import {betaRevision} from "../scripts/beta-revisions.mjs";

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),read=file=>fs.readFileSync(path.join(root,file),"utf8");
const registry=JSON.parse(read("scripts/beta-sources.json"));
// El oráculo procede de Git inmutable: copiar aquí el parser nuevo solo probaría dos
// veces el mismo error. No se acepta HEAD ni se actualiza la referencia para obtener verde.
const referenceSha="f4ffb9340adfd0a13b631271e8158d2c630613c0";
const at=(sha,file)=>execFileSync("git",["show",sha+":"+file],{cwd:root,encoding:"utf8",maxBuffer:10e6});
const legacy=await import("data:text/javascript;base64,"+Buffer.from(at(referenceSha,"scripts/beta-source-code.mjs")).toString("base64"));
const revisionText=at(referenceSha,"scripts/beta-revisions.mjs"),start=revisionText.indexOf("export function betaRevision("),end=revisionText.indexOf("\nexport function betaModern(",start);
assert.ok(start>=0&&end>start,"la revisión de referencia debe conservar sus límites reales");
const referenceRevision=new vm.Script("("+revisionText.slice(start,end).trim().replace(/^export /,"")+")").runInNewContext({fs,path,root,registry,crypto,scopeText:legacy.scopeText,scopeIdentity:legacy.scopeIdentity});
const snapshot=read=>{const files=new Map();return file=>{if(!files.has(file))files.set(file,read(file).replace(/\r\n/g,"\n"));return files.get(file);};};
const sameRevision=(id,source,scope)=>assert.equal(JSON.stringify(betaRevision(id,source,undefined,scope)),JSON.stringify(referenceRevision(id,source,undefined,scope)),id+": todas las superficies, código e historial deben coincidir");
function test(name,fn){fn();console.log("  ✓ "+name);}
console.log("beta-source-context");

test("todas las unidades actuales conservan identidad, revisión e inventario causal",()=>{
  const source=snapshot(read),functions=legacy.logicFunctions(source),data=legacy.logicData(source);
  for(const [id,scope] of Object.entries(registry)){
    const current=revisionReader(source),plain=snapshot(source);
    assert.deepEqual(scopeIdentity(scope.web,current),legacy.scopeIdentity(scope.web,plain),id+": identidad literal");
    sameRevision(id,source,scope);
    assert.deepEqual(scopeDependencies(scope,current,logicFunctions(current)),legacy.scopeDependencies(scope,plain,functions),id+": funciones causales");
    assert.deepEqual(scopeDataDependencies(scope,current,logicFunctions(current),logicData(current)),legacy.scopeDataDependencies(scope,plain,functions,data),id+": datos causales");
  }
});

const file="src/modules/context-fixture.js";
const original='const amount=1, reserve=2;\nfunction main(){ return amount; }\nconst cloud=(function(){\n  function hidden(){ return 3; }\n  return { primary(){ return hidden()+this.other(); }, other(){ return amount; } };\n})();\n';
const scope={web:[{file,function:"main"},{file,data:"amount"},{file,data:"reserve"},{file,data:"cloud",members:["primary"]}],unidades:true,historial:{codigo:"referencia sintética intacta"}};

test("una revisión lee una copia y otra ve cambios con el mismo lector y longitud",()=>{
  let text=original,reads=0;const source=()=>{reads++;return text;},current=revisionReader(source);
  const before=scopeIdentity(scope.web,current);text=original.replace("amount=1","amount=9");
  assert.equal(text.length,original.length);
  assert.deepEqual(scopeIdentity(scope.web,current),before,"la revisión conserva su copia inicial");
  assert.equal(reads,1,"ni funciones, datos ni miembros releen el fichero dentro de la revisión");
  assert.notDeepEqual(scopeIdentity(scope.web,revisionReader(source)),before,"el contexto nuevo no hereda la copia anterior");
  const first=betaRevision("fixture",()=>original,undefined,scope);
  assert.notEqual(betaRevision("fixture",source,undefined,scope).codigo,first.codigo);
  sameRevision("fixture",source,scope);
});

test("funciones, datos, miembros y efectos mutados conservan el mismo oráculo",()=>{
  const first=betaRevision("fixture",()=>original,undefined,scope);
  for(const [from,to] of [["return amount;","return reserve;"],["amount=1","amount=9"],["return 3;","return 4;"],["return hidden()+this.other();","return this.other();"],["return { primary()","void amount; return { primary()"]]){
    const changed=original.replace(from,to);assert.notEqual(changed,original,from);
    sameRevision("fixture",()=>changed,scope);
    assert.notEqual(betaRevision("fixture",()=>changed,undefined,scope).codigo,first.codigo,from);
  }
  sameRevision("fixture",()=>original.replace(/\n/g,"\r\n"),scope);
  assert.equal(betaRevision("fixture",()=>original.replace(/\n/g,"\r\n"),undefined,scope).codigo,first.codigo,"solo CRLF se normaliza");
});

test("un descriptor mutable distingue miembros, rangos, exclusiones y fichero",()=>{
  const current=revisionReader(()=>original),plain=snapshot(()=>original),descriptor={file,data:"cloud",members:["primary"]};
  assert.equal(scopeText(descriptor,current),legacy.scopeText(descriptor,plain));
  descriptor.members[0]="other";
  assert.equal(scopeText(descriptor,current),legacy.scopeText(descriptor,plain));
  const range={file,from:"function main()",to:"const cloud",includeTo:false};
  assert.equal(scopeText(range,current),legacy.scopeText(range,plain));range.includeTo=true;
  assert.equal(scopeText(range,current),legacy.scopeText(range,plain));
  const excluded={file,exclude:[{from:"function main()",to:"const cloud"}]};
  assert.equal(scopeText(excluded,current),legacy.scopeText(excluded,plain));
  excluded.exclude[0].from="const amount";
  assert.equal(scopeText(excluded,current),legacy.scopeText(excluded,plain));
  const second="src/modules/context-second.js",different=revisionReader(name=>name===file?original:original.replace("return 3;","return 4;"));
  assert.notEqual(scopeText({file,data:"cloud",members:["primary"]},different),scopeText({file:second,data:"cloud",members:["primary"]},different));
});

test("contextos independientes rechazan ausencia, ambigüedad y miembros dinámicos",()=>{
  const errorOf=(fn)=>{try{fn();}catch(error){return [error.code,error.message];}assert.fail("el parser debía abortar");};
  for(const [text,source] of [[original.replace("function main()","function otherMain()"),{file,function:"main"}],[original+"\nfunction main(){ return 0; }\n",{file,function:"main"}],[original,{file,data:"absent"}],[original,{file,data:"cloud",members:["absent"]}],[original.replace("this.other()","this[key]()"),{file,data:"cloud",members:["primary"]}],[original,{file,from:"return amount;",to:"}"}]]){
    const current=revisionReader(()=>text),plain=snapshot(()=>text);
    assert.deepEqual(errorOf(()=>scopeText(source,current)),errorOf(()=>legacy.scopeText(source,plain)));
    assert.deepEqual(errorOf(()=>scopeText(source,current)),errorOf(()=>legacy.scopeText(source,plain)),"el intento siguiente tampoco fabrica un resultado");
  }
});

test("referencias Git separadas conservan su revisión fría y después de mutar current",()=>{
  const id="inc-2709-09-fechas-cache",sha="8dcc5ed39b6e212ba1e34a90b550685794ce0bd5",history=snapshot(file=>at(sha,file));
  const historicScope=JSON.parse(history("scripts/beta-sources.json"))[id];assert.ok(historicScope);
  sameRevision(id,history,historicScope);const before=betaRevision(id,history,undefined,historicScope);
  const changed=file=>history(file).replace("function _pdMs(","function _pdMsChanged(");
  assert.throws(()=>betaRevision(id,changed,undefined,historicScope));
  assert.deepEqual(betaRevision(id,history,undefined,historicScope),before,"current fallido no contamina el histórico");
  sameRevision(id,history,historicScope);
});

test("los resultados públicos de funciones/datos no contaminan ninguna revisión",()=>{
  const source=()=>original,expectedFunctions=structuredClone(logicFunctions(source,[file])),expectedData=structuredClone(logicData(source,[file]));
  const before=betaRevision("fixture",source,undefined,scope);
  const poison=units=>{
    for(const unit of units.values())for(const key of Object.keys(unit))unit[key]=typeof unit[key]==="number"?-99:"contaminación sintética";
    units.clear();units.set("ghost",{name:"ghost",file,text:"no es una unidad real"});
  };
  for(const reader of [source,revisionReader(source)]){
    const functions=logicFunctions(reader,[file]),data=logicData(reader,[file]);
    assert.doesNotThrow(()=>{poison(functions);poison(data);},"el resultado sigue siendo una copia editable");
    assert.deepEqual(logicFunctions(reader,[file]),expectedFunctions,"otro acceso del mismo lector no hereda metadatos ni claves falsas");
    assert.deepEqual(logicData(reader,[file]),expectedData);
    assert.deepEqual(logicFunctions(revisionReader(source),[file]),expectedFunctions,"otro contexto no comparte registros públicos mutables");
    assert.deepEqual(logicData(revisionReader(source),[file]),expectedData);
    assert.deepEqual(betaRevision("fixture",source,undefined,scope),before,"la identidad no hereda la contaminación del llamador");
  }
  sameRevision("fixture",source,scope);
});

test("índices puros reutilizan contenido exacto entre contextos sin heredar cambios",()=>{
  let text=original+"// caché compartida: fixture independiente\n";
  const source=()=>text,OriginalScript=vm.Script;let compilations=0;
  vm.Script=class extends OriginalScript{constructor(...args){compilations++;super(...args);}};
  try{
    const cold=revisionReader(source),functions=logicFunctions(cold,[file]),data=logicData(cold,[file]),first=compilations;
    assert.ok(first>0,"el primer texto realmente se analiza en frío");
    const warm=revisionReader(source);
    assert.deepEqual(logicFunctions(warm,[file]),functions);assert.deepEqual(logicData(warm,[file]),data);
    assert.equal(compilations,first,"un contexto nuevo no recompila el módulo intacto");
    assert.notStrictEqual(logicFunctions(warm,[file]).get("main"),functions.get("main"),"se comparten índices privados, no registros públicos");
    text=text.replace("amount=1","amount=9");
    const changed=revisionReader(source),changedData=logicData(changed,[file]);
    assert.equal(changed(file).length,cold(file).length,"el cambio real conserva longitud");
    assert.notDeepEqual(changedData,data,"nombre de fichero/lector y longitud no identifican la fuente");
    assert.ok(compilations>first,"un texto distinto se analiza, no reutiliza el índice anterior");
    assert.deepEqual(logicData(cold,[file]),data,"la revisión anterior mantiene su copia");
    assert.deepEqual(logicFunctions(cold,[file]),functions);
  }finally{vm.Script=OriginalScript;}
});

test("la cota global expulsa variantes sin contaminar un contexto todavía vivo",()=>{
  const text=original+"// presión de caché: fixture independiente\n",source=()=>text,held=revisionReader(source);
  const functions=logicFunctions(held,[file]),data=logicData(held,[file]);
  for(let amount=10;amount<50;amount++){
    const reader=revisionReader(()=>text.replace("amount=1","amount="+amount));
    logicFunctions(reader,[file]);logicData(reader,[file]);
  }
  const OriginalScript=vm.Script;let compilations=0;
  vm.Script=class extends OriginalScript{constructor(...args){compilations++;super(...args);}};
  try{
    assert.deepEqual(logicFunctions(held,[file]),functions);assert.deepEqual(logicData(held,[file]),data);
    assert.equal(compilations,0,"la expulsión global no modifica el índice del contexto vivo");
    const fresh=revisionReader(source);
    assert.deepEqual(logicFunctions(fresh,[file]),functions);assert.deepEqual(logicData(fresh,[file]),data);
    assert.ok(compilations>0,"cuarenta variantes deben haber expulsado el índice global inicial de32");
  }finally{vm.Script=OriginalScript;}
  sameRevision("fixture",source,scope);
});
