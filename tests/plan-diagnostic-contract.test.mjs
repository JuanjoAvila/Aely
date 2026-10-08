#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import {test} from "node:test";
import {finanzasPlanSnapshot,deltasFinanzasPlan} from "../e2e/plan-ownership-candidate.mjs";

const original='{"saved":400,"_savedAt":123,"unknown":"a"}',expenses='[{"amount":5,"unknown":true}]';
async function snapshot(stateRaw=original,expensesRaw=expenses){
 // Ejecuta el callback real con almacenamiento inventado; nunca abre un navegador ni datos del dueño.
 return finanzasPlanSnapshot({evaluate:fn=>vm.runInNewContext("("+fn.toString()+")()",{
  localStorage:{getItem:key=>key==="micartera_v3"?stateRaw:expensesRaw},
 })});
}
for(const [name,changed] of [
 ["espacios",'{ "saved":400,"_savedAt":123,"unknown":"a"}'],
 ["escape",'{"saved":400,"_savedAt":123,"unknown":"\\u0061"}'],
 ["clave duplicada",'{"saved":0,"saved":400,"_savedAt":123,"unknown":"a"}'],
])test("hash crudo detecta "+name+" con estado parseado igual",async()=>{
 const before=await snapshot(),after=await snapshot(changed);
 assert.equal(JSON.stringify(before.state),JSON.stringify(after.state));
 assert.equal(before.fingerprint,after.fingerprint,"el hash original se conserva y muestra su límite");
 assert.notEqual(before.stateRawFingerprint,after.stateRawFingerprint);
 assert.ok(deltasFinanzasPlan(before,after).changes.some(row=>row.pointer==="/stateRaw"));
});
test("estado idéntico y null conservan ambos hashes; null difiere del string JSON null",async()=>{
 for(const raw of [original,null]){
  const a=await snapshot(raw),b=await snapshot(raw);
  assert.equal(a.fingerprint,b.fingerprint);assert.equal(a.stateRawFingerprint,b.stateRawFingerprint);
 }
 const absent=await snapshot(null),jsonNull=await snapshot("null");
 assert.equal(absent.fingerprint,jsonNull.fingerprint);
 assert.notEqual(absent.stateRawFingerprint,jsonNull.stateRawFingerprint);
});
test("hash original sigue incluyendo savedAt, campos desconocidos y bytes de gastos",async()=>{
 const before=await snapshot();
 for(const changed of [original.replace('123','124'),original.replace('"a"','"b"')]){
  assert.notEqual(before.fingerprint,(await snapshot(changed)).fingerprint);
 }
 assert.notEqual(before.fingerprint,(await snapshot(original,'[ {"amount":5,"unknown":true}]')).fingerprint);
 assert.equal(before.stateRawFingerprint,(await snapshot(original,'[]')).stateRawFingerprint);
});
test("hash crudo conserva sustitutos Unicode aislados que UTF8 directo colapsa",async()=>{
 const a='{"unknown":"'+String.fromCharCode(0xd800)+'"}',b='{"unknown":"'+String.fromCharCode(0xd801)+'"}';
 const utf8=s=>crypto.createHash("sha256").update(s).digest("hex");
 assert.equal(utf8(a),utf8(b),"control negativo de codificación UTF8 directa");
 assert.notEqual((await snapshot(a)).stateRawFingerprint,(await snapshot(b)).stateRawFingerprint);
});
test("runner real separa Plan y mediciones previas con workers1",()=>{
 const runner=fs.readFileSync(new URL("../scripts/run-tests.mjs",import.meta.url),"utf8");
 const predicate=runner.match(/const isPerf = ([^\n]+);/);assert.ok(predicate);
 const isPerf=vm.runInNewContext("("+predicate[1]+")");
 for(const name of ["plan-ownership-candidate","dashboard-memo-profile","rendimiento","rendimiento-tabs","rendimiento-sostenido"]){
  for(const prefix of ["e2e/","/repo/e2e/","C:\\repo\\e2e\\"]){
   assert.equal(isPerf(prefix+name+".spec.mjs"),true,prefix+name);
  }
 }
 for(const name of ["e2e/plan-ownership.spec.mjs","e2e/plan-ownership-candidate-copy.spec.mjs","e2e/listas-render.spec.mjs"]){assert.equal(isPerf(name),false,name);}
 const groups=runner.match(/const groups = (\[\["playwright-e2e"[\s\S]*?);\n/);assert.ok(groups);
 const specs=["e2e/listas-render.spec.mjs","e2e/plan-ownership-candidate.spec.mjs"];
 const actual=vm.runInNewContext(groups[1],{specs,isPerf});
 assert.equal(JSON.stringify(actual),JSON.stringify([["playwright-e2e",[specs[0]],[]],["playwright-perf",[specs[1]],["--workers=1"]]]));
});

test("guard real conserva aserción original y rechaza bytes nuevos con diagnóstico íntegro",async()=>{
 const source=fs.readFileSync(new URL("../e2e/plan-ownership-candidate.spec.mjs",import.meta.url),"utf8");
 const fn=source.match(/async function unchangedFinanzas\(page,before,source,label\)\{([\s\S]*?)\n\}\nasync function genericOwnershipCssControl/);assert.ok(fn);
 assert.ok(fn[0].includes(" expect(after.fingerprint).toBe(before.fingerprint);"));
 const before=await snapshot(),after=await snapshot('{ "saved":400,"_savedAt":123,"unknown":"a"}'),logs=[];
 const guard=vm.runInNewContext("(async function unchangedFinanzas(page,before,source,label){"+fn[1]+"\n})",{
  finanzasPlanSnapshot:async()=>after,deltasFinanzasPlan,
  expect:actual=>({toBe:expected=>assert.equal(actual,expected)}),console:{log:line=>logs.push(line)},
 });
 await assert.rejects(guard(null,before,{label:"synthetic",sha:"synthetic",htmlHash:"synthetic"},"raw-control"),{code:"ERR_ASSERTION"});
 assert.equal(logs.length,2);const full=JSON.parse(logs[0].slice(logs[0].indexOf(" ")+1));
 assert.equal(full.before.stateRaw,before.stateRaw);assert.equal(full.after.stateRaw,after.stateRaw);
 const delta=JSON.parse(logs[1].slice(logs[1].indexOf(" ")+1));
 assert.notEqual(delta.beforeStateRawFingerprint,delta.afterStateRawFingerprint);
 assert.ok(delta.changes.some(row=>row.pointer==="/stateRaw"));
});
