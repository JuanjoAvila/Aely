import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { instrumentDashboard, installDashboardProfile, RECENT, DASH, SYNC } from "../e2e/dashboard-profile-instrument.mjs";

const html=fs.readFileSync("public/index.html","utf8"),instrumented=instrumentDashboard(html);
assert.equal(instrumented.anchors,3);
for(const anchor of [RECENT,DASH,SYNC]){
  assert.throws(()=>instrumentDashboard(html.replace(anchor,"")),/ausente\/duplicada/);
  assert.throws(()=>instrumentDashboard(html+anchor),/ausente\/duplicada/);
}
const withoutComments=instrumented.html.replace(/<!--[\s\S]*?-->/g,"");
let parsedScripts=0;
for(const script of withoutComments.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){new vm.Script(script[1]);if(script[1].trim())parsedScripts++;}
assert.ok(parsedScripts>=2,"No parser verde con selector vacío");
const s=loadPureLogic(html);
s.performance=performance;s.requestAnimationFrame=()=>1;s.cancelAnimationFrame=()=>{};
s.PerformanceObserver=class{observe(){}disconnect(){}};s.Storage=class{setItem(){}};
vm.createContext(s);vm.runInContext("("+installDashboardProfile.toString()+")()",s);
vm.runInContext(`
  var probe=window.__dashProfile;
  var a={id:"a",date:"2026-09-26",amount:2,merchant:"Uno",source:"manual"};
  var b={id:"b",date:"2026-09-26",amount:2,merchant:"Uno",source:"manual"};
  var c={id:"c",date:"2026-09-25",amount:-3,merchant:"Dos",source:"ob"};
  probe.state={expenses:[a,b,c],deleted:[],budget:500,accounts:[]};probe.totals={netWorth:1000};
  var predicate=function(e){return !expenseIsTombstoned(e,expenseDeletedSet(probe.state));};
  var compare=function(a,b){return String(b.date).localeCompare(String(a.date));};
`,s);
const p=s.window.__dashProfile,derive=()=>p.derive(p.state,s.predicate,s.compare);
const initial=JSON.stringify(p.state),first=derive();
assert.equal(first[0],s.a);assert.equal(first[1],s.b);assert.equal(first[2],s.c);
assert.equal(JSON.stringify(p.state),initial);p.verify();
p.mode="virtual-cache";assert.equal(derive(),first);assert.equal(p.metrics.hits,1);
p.state={...p.state,settings:{synthetic:true}};assert.equal(derive(),first);assert.equal(p.metrics.hits,2);
p.state={...p.state,expenses:p.state.expenses.map(e=>e===s.a?{...e,amount:4}:e)};
const edited=derive();assert.notEqual(edited,first);assert.equal(edited[0],p.state.expenses[0]);assert.equal(edited[0].amount,4);p.verify();
// Lápida exacta y legacy se validan con helpers REALES del producto, no un filtro recreado.
p.state={...p.state,deleted:[s.keyOfExpense(p.state.expenses[0])]};
derive();assert.equal(p.rows[0],s.b);p.verify();
p.state={...p.state,deleted:[s.keyOfExpenseLegacy(s.b)]};
derive();assert.equal(p.rows[0].id,"a");assert.equal(p.rows[1],s.c);p.verify();
p.state={...p.state,deleted:[s.keyOfExpenseLegacy(p.state.expenses[0]),s.keyOfExpenseLegacy(s.b)]};
derive();assert.equal(p.rows.length,1);assert.equal(p.rows[0],s.c);p.verify();
p.mode="baseline";assert.throws(()=>p.derive(p.state,()=>{throw new Error("predicate");},s.compare),/predicate/);
p.state={...p.state,deleted:[]};assert.throws(()=>p.derive(p.state,s.predicate,()=>{throw new Error("compare");}),/compare/);
for(const size of [3000,5200]){
  const expenses=Array.from({length:size},(_,i)=>({id:"synthetic-"+i,date:"2026-09-"+String(26-Math.floor(i/400)).padStart(2,"0"),amount:i%9+1,merchant:"Sintético "+i,source:"manual"}));
  const deleted=expenses.slice(-100).map(e=>s.keyOfExpense(e));
  p.state={expenses,deleted,budget:500,accounts:[]};p.begin("baseline");
  const prior=JSON.stringify(expenses);for(let i=0;i<8;i++)derive();
  assert.equal(p.metrics.computes,8);assert.equal(p.metrics.rows,8*size);p.verify();
  p.begin("virtual-cache");for(let i=0;i<8;i++)derive();
  assert.equal(p.metrics.computes,1);assert.equal(p.metrics.hits,7);assert.equal(p.metrics.rows,size);
  assert.equal(JSON.stringify(expenses),prior);p.verify();
}
p.dispose();
console.log("Dashboard profile: 3 anclas failclosed; parser; filas===/empates/edición/exacta/legacy/cache/excepciones OK; 0 DOM ejecutados");
