import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {instrumentDashboard, MEMO, DASH, SYNC} from "../e2e/dashboard-memo-instrument.mjs";

const html=fs.readFileSync("public/index.html","utf8");
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
  const callback="const recent=useMemo((s=state)=>window.__dashProfile.derive";
  assert.equal(p.html.includes(callback),variant==="memo");
}
assert.ok(MEMO.endsWith("[state.expenses,state.deleted]);"),"Invalidación exacta de ambas referencias");
console.log("Dashboard memo instrumento: anclas failclosed/parser/callback real y baseline distintos; 0 DOM local");

// El alias por defecto conserva la captura real: create() se invoca sin argumentos.
const shell=fs.readFileSync("src/shell.html","utf8");
assert.ok(shell.includes('version="18.3.1"'),"React fijado real");
assert.match(shell,/useMemo:function\(a,b\)\{var c=Fa\(\);b=void 0===b\?null:b;a=a\(\);/);
assert.match(shell,/function Yh\(a,b\)\{var c=sa\(\);[\s\S]*?a=a\(\);c\.memoizedState=\[a,b\];return a\}/);
assert.ok(instrumentDashboard(html,"memo").html.includes('derive(s,function(e){ return !expenseIsTombstoned(e,expenseDeletedSet(s)); }'),"instrumento conserva el alias dentro del callback");
for(const expenses of [undefined,null,[],[{date:"2026-09-28"},{date:"2026-09-27"}], [{date:Symbol("synthetic")},{date:null},{date:0}]]){
 const state={expenses,deleted:[]};let args=null;
 const ctx={state,expenseDeletedSet:s=>{assert.equal(s,state);return null;},expenseIsTombstoned:()=>false,useMemo:(create,deps)=>{args=deps;return create();}};
 const aliased=vm.runInNewContext(MEMO+'recent',{...ctx});
 const original=vm.runInNewContext(MEMO.replace('(s=state)=>(s.expenses','()=>(state.expenses').replace('expenseDeletedSet(s)','expenseDeletedSet(state)')+'recent',{...ctx});
 assert.deepEqual([...aliased],[...original]);assert.deepEqual([...args],[state.expenses,state.deleted]);
}
console.log("Dashboard memo alias: React fijado mount/update create() sinargs; captura/deps/fallback/String/Symbol equivalentes");
