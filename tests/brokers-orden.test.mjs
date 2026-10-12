import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli=loadPureLogicFromFile();
vm.runInNewContext(fs.readFileSync("src/modules/06-sync-brokers.js","utf8"),cli);
const tuples=[["revolut","Revolut","USD"],["trade_republic","Trade Republic","ETF"],["myinvestor","MyInvestor","Fondos"]];
const state={investments:[{id:"a",ent:"revolut",value:90,cost:70},{id:"b",ent:"trade_republic",value:150,cost:120},{id:"c",ent:"myinvestor",value:null,cost:180}],expenses:[{id:"e",amount:8}],accounts:[],debts:[],fixed:[],settings:{currency:"EUR",expenseBanks:["revolut"]}};

test("ordenar conserva las ternas completas y añade brókers nuevos sin fantasmas ni repetidos",()=>{
  const s={settings:{invBrokerOrder:["myinvestor","ya-vendido","myinvestor","revolut"]}};
  const ordered=cli.brokerGroupsInOrder(s,tuples);
  assert.deepEqual(Array.from(ordered,g=>g[0]),["myinvestor","revolut","trade_republic"]);
  assert.equal(ordered[0],tuples[2]); assert.equal(ordered[1],tuples[0]); assert.equal(ordered[2],tuples[1]);
  for(const saved of [undefined,null,{},"revolut"]){ assert.equal(cli.brokerGroupsInOrder({settings:{invBrokerOrder:saved}},tuples),tuples); }
  assert.deepEqual(Array.from(cli.brokerGroupsInOrder(s,tuples.slice(0,2)),g=>g[0]),["revolut","trade_republic"]);
});

test("mover solo cambia settings: referencias financieras, importes y preferencias se conservan",()=>{
  const next=cli.moveBrokerInList(state,"revolut","myinvestor");
  assert.deepEqual(Array.from(next.settings.invBrokerOrder),["trade_republic","myinvestor","revolut"]);
  for(const k of ["investments","expenses","accounts","debts","fixed"]) assert.equal(next[k],state[k]);
  assert.equal(next.settings.expenseBanks,state.settings.expenseBanks);
  assert.equal(next.settings.currency,"EUR"); assert.equal(state.settings.invBrokerOrder,undefined);
  for(const [from,to] of [["x","revolut"],["revolut","x"],["revolut","revolut"]]) assert.equal(cli.moveBrokerInList(state,from,to),state);
});

test("estado antiguo sin preferencia mantiene el orden por defecto y acepta un bróker importado",()=>{
  assert.equal(cli.brokerGroupsInOrder(state,tuples),tuples);
  const s={...state,investments:state.investments.concat({id:"d",ent:"custom",value:12})};
  const moved=cli.moveBrokerInList(s,"custom","revolut");
  assert.deepEqual(Array.from(moved.settings.invBrokerOrder),["custom","revolut","trade_republic","myinvestor"]);
  assert.equal(moved.investments,s.investments);
});

test("preferencia viaja en el contrato actual de nube y el guardado partido sin reescribir gastos",()=>{
  const next=cli.moveBrokerInList(state,"myinvestor","revolut");
  const cloud=JSON.parse(JSON.stringify(cli.slimForCloud(next)));
  assert.equal(cli.validCloudState(cloud),true); assert.equal(cloud.expenses,undefined);
  assert.deepEqual(cloud.settings.invBrokerOrder,["myinvestor","revolut","trade_republic"]);
  const writes=[], values=new Map([["test_exp",JSON.stringify(state.expenses)]]);
  cli.localStorage={getItem:k=>values.get(k)||null};
  vm.runInNewContext("store.set=function(k,v){ __write(k,v); };",Object.assign(cli,{__write:(k,v)=>{writes.push(k); values.set(k,JSON.stringify(v));}}));
  cli.mcSaveRaw("test",next,{expenses:false});
  assert.deepEqual(writes,["test"]); assert.deepEqual(JSON.parse(values.get("test_exp")),state.expenses);
  const restored=JSON.parse(values.get("test"));
  assert.deepEqual(restored.settings.invBrokerOrder,cloud.settings.invBrokerOrder);
  assert.deepEqual(Array.from(cli.brokerGroupsInOrder(restored,tuples),g=>g[0]),cloud.settings.invBrokerOrder);
});
