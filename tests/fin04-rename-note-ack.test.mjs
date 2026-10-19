import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {test as nodeTest} from "node:test";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";

const root=new URL("../",import.meta.url),read=p=>fs.readFileSync(new URL(p,root),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const source=extractPureLogicSource(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const expense={id,date:"2026-10-19T10:00:00.000Z",amount:12.34,merchant:"Compra",category:"super",source:"manual",ent:"sabadell",note:"Anterior",noteEdited:true};
const row={id,user_id:"owner",fecha:expense.date,importe:12.34,comercio:"Compra",cat:"super",source:"manual:sabadell",nota:"Nota del otro móvil",nota_edit:true,no_card:false};
const copy=x=>JSON.parse(JSON.stringify(x));
let stopped=false;
const test=(name,fn)=>nodeTest(name,async t=>{if(stopped){t.skip("fallo previo; detener tanda");return;}try{await fn();}catch(e){stopped=true;throw e;}});
function client(options={}){
  const rows=copy(options.rows||[row]),writes=[],state={session:{user:{id:"owner"},expires_at:9e9},authCalls:0};
  const sb={auth:{getSession:async()=>{
    state.authCalls++;if(options.switchAt===state.authCalls)state.session={user:{id:"other"}};
    return {data:{session:options.noSession?null:state.session},error:options.authError?{message:"auth"}:null};
  },onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},from(table){
    const filters=[];let patch=null,selected=false;
    const q={select(){selected=true;return q;},update(p){patch=p;return q;},eq(k,v){filters.push([k,v]);return q;},
      then(ok,no){return Promise.resolve().then(()=>{
        if(table!=="expenses")return {data:[],error:null};
        const hit=rows.filter(r=>filters.every(([k,v])=>r[k]===v));
        if(patch){writes.push(copy({filters,patch}));if(options.error)return {data:null,error:{message:"network"}};hit.forEach(r=>Object.assign(r,patch));}
        let data=selected?copy(hit):null;
        if(patch&&options.ack)data=options.ack(copy(data));
        return {data,error:null};
      }).then(ok,no);}};return q;
  }};
  const ctx=createLogicSandbox();ctx.window.supabase={createClient:()=>sb};
  if(options.sandbox){ctx.window.localStorage.getItem=k=>k==="_mcSandbox"?"1":null;ctx.localStorage=ctx.window.localStorage;}
  vm.runInNewContext(source,ctx);const cloud=vm.runInContext("cloud",ctx);
  return {ctx,cloud,rows,writes,state};
}

test("renombrar conserva nota humana, categoría, céntimos, signo y todos los sufijos",async()=>{
  for(const source of ["manual:sabadell","ob:sabadell~recibo.r#dup#refR#prevrefP#pdng#accA#n2","ob:sabadell~deuda.d#refD#accA#n2"]){
    const unrelated={...row,id:other,importe:-8.97,cat:"ingresos",source:"ob:sabadell~deuda.otra#refOTRA#accA#n2",nota:"Intocable"};
    const c=client({rows:[{...row,source},unrelated]}),before=copy(c.rows[0]);
    const ack=await c.cloud.renameExpense(expense,"Nuevo");
    assert.equal(ack.nota,before.nota);assert.equal(c.rows.length,2);
    assert.deepEqual(c.rows[1],unrelated,"ningún campo de otra identidad cambia");
    for(const key of ["id","user_id","importe","cat","source","no_card","nota","nota_edit","fecha"])assert.deepEqual(c.rows[0][key],before[key],key);
    assert.deepEqual(Object.keys(c.writes[0].patch).sort(),source.startsWith("ob:")?["comercio","ob_name"]:["comercio"]);
    assert.equal(c.rows[0].comercio,"Nuevo");assert.equal(Math.round(c.rows[0].importe*100),1234);
  }
});
test("rename rechaza cero filas, identidad monetaria cambiada, error y ACK inconsistente",async()=>{
  for(const o of [{rows:[]},{rows:[{...row,importe:-12.34}]},{error:true},{ack:a=>[{...a[0],id:other}]},{ack:()=>[]}]){
    const c=client(o);await assert.rejects(c.cloud.renameExpense(expense,"Nuevo"));
  }
});
test("nota: ACK exacto, borrado explícito, cero filas, error, sesión y respuesta falsa",async()=>{
  const good=client();assert.equal((await good.cloud.setExpenseNote(expense,"Nueva")).nota,"Nueva");
  assert.equal((await good.cloud.setExpenseNote(expense,"")).nota,null);
  for(const o of [{rows:[]},{noSession:true},{authError:true},{error:true},{ack:()=>null},{ack:()=>[]},{ack:a=>[a[0],a[0]]},{ack:a=>[{...a[0],id:other}]},{ack:a=>[{...a[0],nota:"otra"}]},{ack:a=>[{...a[0],nota_edit:false}]},{ack:a=>[{...a[0],user_id:"other"}]}]){
    const c=client(o);await assert.rejects(c.cloud.setExpenseNote(expense,"Nueva"));
  }
  const c=client({ack:a=>{c.state.session={user:{id:"other"}};return a;}});await assert.rejects(c.cloud.setExpenseNote(expense,"Nueva"));
});
test("identidad legacy exacta conserva ACK sin buscar por parecido; falta identidad no escribe",async()=>{
  const c=client();assert.equal((await c.cloud.setExpenseNote({...expense,id:"legacy"},"Nota")).id,id);
  await assert.rejects(c.cloud.setExpenseNote({id:"legacy"},"Nota"));assert.equal(c.writes.length,1);
});
test("modo pruebas bloquea nota y nuevo escritor rename antes de la tabla",async()=>{
  const c=client({sandbox:true});await c.cloud.setExpenseNote(expense,"No");await c.cloud.renameExpense(expense,"No");
  assert.equal(c.writes.length,0);assert.deepEqual(c.rows,[row]);
});
test("UUID repetido: conserva la edición y la nota más recientes, sin fusionar identidades distintas",()=>{
  const c=client(),a={...expense,expenseEditAt:10,noteEditAt:30,note:"Más reciente",notePending:true},b={...expense,merchant:"Nuevo",expenseEditAt:20,noteEditAt:5};
  for(const list of [[a,b],[b,a]]){
    const out=c.ctx.uniqueExpenseUuids(list);assert.equal(out.length,1);assert.equal(out[0].merchant,"Nuevo");assert.equal(out[0].note,"Más reciente");assert.equal(out[0].notePending,true);assert.equal(out[0].amount,12.34);
  }
  const distinct=[a,{...a,id:other}],out=c.ctx.uniqueExpenseUuids(distinct);assert.equal(out,distinct);
  const merged=c.ctx.mergeExpensesFromCloud([a], [{...a,merchant:"Nuevo",note:"Vieja"}],40);
  assert.equal(merged.list.length,1);assert.equal(merged.list[0].merchant,"Nuevo");assert.equal(merged.list[0].note,"Más reciente");
  const banks=[{...a,source:"ob",extId:"ref-A"},{...a,id:other,source:"ob",extId:"ref-B"}];
  assert.equal(c.ctx.mergeExpensesFromCloud([],banks,40).list.length,2);
});
