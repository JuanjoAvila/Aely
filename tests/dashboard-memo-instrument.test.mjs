import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {instrumentDashboard, MEMO, DASH, SYNC} from "../e2e/dashboard-memo-instrument.mjs";

const DEPS_FIN="state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,state.reciboBorrado]);";
const html=fs.readFileSync("public/index.html","utf8").replace(/\r\n/g,"\n");
for(const variant of ["baseline","memo"]){
  const p=instrumentDashboard(html,variant);
  assert.equal(p.anchors,3);
  for(const anchor of [MEMO,DASH,SYNC]){
    assert.throws(()=>instrumentDashboard(html.replace(anchor,""),variant),/ausente/);
    assert.throws(()=>instrumentDashboard(html+anchor,variant),/duplicad/);
  }
  let count=0;
  for(const m of p.html.replace(/<!--[\s\S]*?-->/g,"").matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    new vm.Script(m[1]);if(m[1].trim())count++;
  }
  assert.ok(count>=2,"No parser vacío");
  assert.ok(p.html.includes("window.__dashProfile.metrics.renders++"));
  const callback="const recent=useMemo(function(){ return window.__dashProfile.portada(state); },";
  assert.equal(p.html.includes(callback),variant==="memo");
  assert.equal(p.html.includes("const recent=window.__dashProfile.portada(state);"),variant==="baseline");
  if(variant==="memo"){
    const instrumented=p.html.slice(p.html.indexOf(callback)).split(']);')[0]+']);';
    assert.ok(instrumented.endsWith(DEPS_FIN),"El callback instrumentado conserva todas las dependencias reales");
  }
}
assert.ok(MEMO.endsWith(DEPS_FIN),"Invalidación exacta: gastos, borrados, absorciones, titular, cuentas, ajustes, recibos, puntuales y recibos descartados");
assert.ok(MEMO.includes("gastosDePortada(state,3)"),"El memo mide la lista real de Gastos");
console.log("Dashboard memo instrumento: anclas failclosed/parser/callback real y baseline distintos; 0 DOM local");

// El alias por defecto conserva la captura real: create() se invoca sin argumentos.
const shell=fs.readFileSync("src/shell.html","utf8");
assert.ok(shell.includes('version="18.3.1"'),"React fijado real");
assert.match(shell,/useMemo:function\(a,b\)\{var c=Fa\(\);b=void 0===b\?null:b;a=a\(\);/);
assert.match(shell,/function Yh\(a,b\)\{var c=sa\(\);[\s\S]*?a=a\(\);c\.memoizedState=\[a,b\];return a\}/);
assert.ok(instrumentDashboard(html,"memo").html.includes("return window.__dashProfile.portada(state); }"),"instrumento conserva la clausura sobre el state del render dentro del callback");
for(const expenses of [undefined,null,[],[{date:"2026-09-28"},{date:"2026-09-27"}], [{date:Symbol("synthetic")},{date:null},{date:0}]]){
 const state={expenses,deleted:[],obAbsorbedPending:[],obAbsorbedConfirmed:[],_historyOwner:"synthetic-owner",accounts:[],settings:{},fixed:[],oneoffs:[],reciboNo:[],reciboBorrado:[]};let args=null;
 const ctx={state,gastosDePortada:(s,n)=>{assert.equal(s,state);assert.equal(n,3);return ["fila"];},useMemo:(create,deps)=>{args=deps;return create();}};
 const real=vm.runInNewContext(MEMO+"recent",{...ctx});
 const medido=vm.runInNewContext(instrumentDashboard(html,"memo").html.match(/const recent=useMemo\(function\(\)\{ return window\.__dashProfile\.portada[\s\S]*?\]\);/)[0]+"recent",{...ctx,window:{__dashProfile:{portada:s=>ctx.gastosDePortada(s,3)}}});
 assert.deepEqual([...medido],[...real]);
 assert.deepEqual([...args],[state.expenses,state.deleted,state.obAbsorbedPending,state.obAbsorbedConfirmed,state._historyOwner,state.accounts,state.settings,state.fixed,state.oneoffs,state.reciboNo,state.reciboBorrado]);
}
console.log("Dashboard memo alias: React fijado mount/update create() sinargs; deps y resultado del memo medido iguales al real");
