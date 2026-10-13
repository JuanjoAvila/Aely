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

test("las filas de ambas pantallas usan la clase viva del contrato de movimiento reducido",()=>{
  const src=fs.readFileSync("src/modules/06-sync-brokers.js","utf8").replace(/\r\n/g,"\n");
  const css=fs.readFileSync("src/shell.html","utf8").replace(/\r\n/g,"\n");
  // Ejecutar el cuerpo real de la hija evita que el pase de InvRows tape una clase rota allí.
  // Es un adaptador Node de elementos/props; el estilo computado y los frames siguen en e2e.
  const start=src.indexOf("                  const v=invValueEur(it,state)",src.indexOf("  if(fullMode){"));
  const end=src.indexOf("\n                }),",start);
  assert.ok(start>=0&&end>start,"ancla de las posiciones de la hija");
  vm.runInNewContext("function brokerChildRow(it,idx){"+src.slice(start,end)+"}",cli);
  const oldCreate=cli.React.createElement;
  cli.React.createElement=(type,props,...children)=>({type,props,children});
  const items=Array.from({length:12},(_,idx)=>({id:"p"+idx,name:"Activo "+idx,ticker:"X",ent:"revolut",cur:"EUR",value:10,cost:null}));
  Object.assign(cli,{state,f2:String,manualLabel:()=>"manual"});
  try{
    for(const rows of [cli.InvRows({items,st:state,stagger:true}),items.map(cli.brokerChildRow)]){
      assert.equal(rows.length,12);
      rows.forEach((row,idx)=>{
        assert.ok(row.props.className.split(" ").includes("v4-inv-drop"),"la clase compartida está en la fila viva");
        assert.equal(row.props["data-inv-position"],items[idx].id);
        assert.equal(row.props.style.animationDelay,Math.min(idx,8)*24+"ms");
      });
    }
    const reduced=css.match(/\.rise,\.v4-sheet[^{}]+\{([^}]+)\}/);
    assert.ok(reduced&&reduced[0].includes(".v4-inv-drop,")&&reduced[0].includes(".botnav-ind,"),"misma regla compartida de movimiento reducido");
    assert.match(reduced[1],/animation:none !important;transition:none !important;/);
    assert.match(css,/html\.reduce-motion \.v4-inv-drop\{animation:none !important;\}/);
  }finally{ cli.React.createElement=oldCreate; }
});
