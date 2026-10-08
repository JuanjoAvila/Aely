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
  const callback="const last=useMemo(()=>window.__dashProfile.derive";
  assert.equal(p.html.includes(callback),variant==="memo");
}
assert.ok(MEMO.endsWith("[state.expenses,state.deleted]);"),"Invalidación exacta de ambas referencias");
console.log("Dashboard memo instrumento: anclas failclosed/parser/callback real y baseline distintos; 0 DOM local");
