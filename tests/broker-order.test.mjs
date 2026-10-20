import {test} from "node:test";
import assert from "node:assert/strict";
import {loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";

test("ordenar brókers conserva ternas, objetos financieros y preferencias de cuentas",()=>{
  const c=loadPureLogicFromFile(),groups=[["revolut","Revolut","USD"],["trade_republic","Trade Republic","ETF"],["otro","Otro","Importado"]];
  const s={investments:[{id:"a",ent:"revolut",value:123.45,cost:100,account:"cash"},{id:"b",ent:"otro",value:null,cost:8}],accounts:[{id:"cash",value:321.09}],expenses:[],settings:{accountListOrder:["acc:cash"],secOrder:{cartera:["inv","accounts"]}}};
  const raw=JSON.stringify(s),out=c.moveSectionInList(s,"inv",groups.map(g=>g[0]),"revolut","otro");
  assert.equal(JSON.stringify(s),raw,"no muta la entrada");
  for(const k of ["investments","accounts","expenses"])assert.equal(out[k],s[k],k+" conserva referencia y contenido");
  assert.equal(out.settings.accountListOrder,s.settings.accountListOrder);
  assert.equal(out.settings.secOrder.cartera,s.settings.secOrder.cartera);
  const ordered=c.brokerGroupsInOrder(out,groups);
  assert.deepEqual(Array.from(ordered,g=>g[0]),["trade_republic","otro","revolut"]);
  [groups[1],groups[2],groups[0]].forEach((g,i)=>assert.equal(ordered[i],g,"la terna original, no un id"));
  assert.equal(c.moveSectionInList(out,"inv",groups.map(g=>g[0]),"absent","otro"),out);
  assert.equal(c.moveSectionInList(out,"inv",groups.map(g=>g[0]),"otro","otro"),out);
  assert.deepEqual(c.slimForCloud(out).settings,out.settings,"usa el payload de sincronización existente");
});
test("orden antiguo incompleto, repetido o inválido no duplica ni pierde brókers",()=>{
  const c=loadPureLogicFromFile(),groups=[["revolut","Revolut","USD"],["myinvestor","MyInvestor","Fondos"],["nuevo","Nuevo","Importado"]];
  for(const saved of [["gone","myinvestor","myinvestor"],"myinvestor",null]){
    const out=c.brokerGroupsInOrder({settings:{secOrder:{inv:saved}}},groups);
    assert.equal(out.length,3);assert.equal(new Set(out).size,3);
    for(const g of groups)assert.ok(out.includes(g));
    if(Array.isArray(saved))assert.deepEqual(Array.from(out,g=>g[0]),["myinvestor","revolut","nuevo"]);
  }
});
