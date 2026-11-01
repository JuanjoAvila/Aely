// Datos sintéticos; se ejercitan las transformaciones y el controlador reales del bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createLogicSandbox,extractPureLogicSource} from '../scripts/load-pure-logic.mjs';
const source=extractPureLogicSource(fs.readFileSync('public/index.html','utf8'));
const screens=fs.readFileSync('src/modules/14-v4-screens.js','utf8');
const initialTime=Date.parse('2026-10-18T10:00:00Z');
function fixture(){
  let now=initialTime;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const c=createLogicSandbox({Date:Clock});vm.runInNewContext(source,c);vm.runInNewContext(screens,c);
  const d={id:'d',name:'Deuda sintética',monthly:210,amort:270,months:30,value:6000,asOf:2026*12+9,day:20,account:'sabadell'};
  const b={id:'b',name:'Recibo sintético',amount:40,bankAmount:80,freq:'mes',day:20,account:'sabadell',reparto:[{id:'p',n:'Persona sintética',via:'debt',debtId:'d',amt:40}]};
  const s={debts:[d],fixed:[b],oneoffs:[],flows:[],accounts:[],expenses:[],settings:{}};
  const remove=(state=s,fixes=[{id:'d',paga:250,baja:290}])=>c.billUndoRemove(state,c.billUndoReview(state,'b'),fixes,now);
  return {c,s,d,b,remove,time:()=>now,advance:n=>{now+=n;}};
}
const plain=x=>JSON.parse(JSON.stringify(x));
const ticks=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('deshacer devuelve todos los campos reales y su presencia, saldo y plazo',()=>{
  const {c,s,d,remove,time}=fixture();const r=remove();
  assert.equal(r.state.fixed.length,0);assert.equal(r.state.debts[0].amort,290);
  assert.equal(Math.round(c.debtBalance(r.state.debts[0])*100),Math.round(c.debtBalance(d)*100));
  assert.ok(r.undo.debts[0].fields.some(f=>f.key==='descuentoOk'&&!f.had));
  const u=c.billUndoRestore(r.state,r.undo,time()+1);
  assert.deepEqual(plain(u.state.fixed),s.fixed);assert.deepEqual(plain(u.state.debts),s.debts);
  assert.equal(c.debtLeft(u.state.debts[0]),c.debtLeft(d));
  assert.ok(!Object.hasOwn(u.state.debts[0],'descuentoOk'));assert.ok(u.state.reciboBorradoAt.b>r.state.reciboBorradoAt.b);
});
test('aceptar y cancelar por deuda captura únicamente el delta real',()=>{
  const {c,s,d,b,remove,time}=fixture();s.debts.push({...d,id:'e',name:'Otra deuda'});b.amount=30;b.reparto.push({id:'q',n:'Otra persona',via:'debt',debtId:'e',amt:10});
  const preview=c.deudasTrasReparto(s,{...s,fixed:[]});assert.deepEqual(plain(c.descuentoDescuadre(s,preview).map(q=>q.id)),['d','e']);
  const r=remove();assert.equal(r.state.debts[1],s.debts[1]);assert.deepEqual(plain(r.undo.debts.map(x=>x.id)),['d']);
  assert.deepEqual(plain(c.billUndoRestore(r.state,r.undo,time()+1).state.debts),s.debts);
});
test('el ajuste automático también se revierte y se conserva null y metadatos anidados',()=>{
  const {c,s,d,remove,time}=fixture();d.amort=250;d.descuentoOk=null;d.extra={a:[null,{b:2}]};
  const r=remove(s,[]);assert.equal(r.state.debts[0].monthly,250);assert.ok(!Object.hasOwn(r.state.debts[0],'amort'));
  assert.deepEqual(plain(c.billUndoRestore(r.state,r.undo,time()+1).state.debts),s.debts);
  const nested={a:undefined,b:null,c:[{d:undefined}]},copy=c.billUndoCopy(nested);
  assert.ok(Object.hasOwn(copy,'a'));assert.ok(Object.hasOwn(copy.c[0],'d'));assert.equal(copy.b,null);
});
test('deuda concurrente intacta, otra elegible restaurada y un único indicador de aviso',()=>{
  const {c,s,d,b,remove,time}=fixture();s.debts.push({...d,id:'e'});b.amount=30;b.reparto.push({id:'q',n:'Otra persona',via:'debt',debtId:'e',amt:10});
  assert.deepEqual(plain(c.descuentoDescuadre(s,c.deudasTrasReparto(s,{...s,fixed:[]})).map(q=>q.id)),['d','e']);
  const r=remove(s,[{id:'d',paga:250,baja:290},{id:'e',paga:220,baja:300}]);
  const edited={...r.state.debts[0],note:'Edición posterior',amort:333};
  const current={...r.state,debts:[edited,r.state.debts[1]],accounts:[{id:'new',value:123.45}]};
  const u=c.billUndoRestore(current,r.undo,time()+1);assert.equal(u.skipped,true);assert.equal(u.state.debts[0],edited);
  assert.deepEqual(plain(u.state.debts[1]),s.debts[1]);assert.equal(u.state.accounts,current.accounts);
});
test('deudas borradas o duplicadas no se recrean ni se pisan',()=>{
  const {c,remove,time}=fixture();const r=remove();
  for(const debts of [[],[r.state.debts[0],{...r.state.debts[0]}]]){
    const s={...r.state,debts},u=c.billUndoRestore(s,r.undo,time()+1);assert.equal(u.skipped,true);assert.equal(u.state.debts,debts);
  }
});
test('recibo recreado, duplicado, puntual homónimo y lápida posterior bloquean toda reposición',()=>{
  const {c,b,remove,time}=fixture();const r=remove();
  for(const patch of [{fixed:[b]},{fixed:[b,b]},{oneoffs:[b]},{reciboBorradoAt:{b:r.undo.at+1}},{reciboBorrado:{b:{d:0,n:'otro'}}}]){
    const s={...r.state,...patch},u=c.billUndoRestore(s,r.undo,time()+1);assert.equal(u.state,s);assert.equal(u.error,true);
  }
  const once=c.billUndoRestore(r.state,r.undo,time()+1);assert.equal(c.billUndoRestore(once.state,r.undo,time()+2).state,once.state);
});
test('respuestas obsoletas se rechazan por otras contribuciones, elegibilidad y cambio de titular',()=>{
  const {c,s,d,b,time}=fixture();const review=c.billUndoReview(s,'b'),fixes=[{id:'d',paga:250,baja:290}];
  for(const patch of [{fixed:[b,{...b,id:'other'}]},{debts:[{...d,apr:4}]},{_historyOwner:'other'},{settings:{...s.settings,simpleMode:true}},{fixed:[{...b,name:'Editado'}]}]){
    const changed={...s,...patch};assert.equal(c.billUndoRemove(changed,review,fixes,time()).state,changed);
  }
});
test('orden de claves distinto no es una edición; los cambios ajenos se conservan',()=>{
  const {c,s,d,remove,time}=fixture();const r=remove();
  const same=Object.fromEntries(Object.entries(r.state.debts[0]).reverse()),current={...r.state,debts:[same],unrelated:{x:1}};
  const u=c.billUndoRestore(current,r.undo,time()+1);assert.equal(u.skipped,false);assert.deepEqual(plain(u.state.debts[0]),d);assert.equal(u.state.unrelated,current.unrelated);
  const review=c.billUndoReview(s,'b'),edited={...s,accounts:[{id:'new',value:91}]};
  assert.equal(c.billUndoRemove(edited,review,[],time()).state.accounts,edited.accounts);
});
test('cambio de día de cobro, mes o ciclo rechaza el cálculo viejo sin escrituras',()=>{
  for(const delta of [2*86400000,15*86400000]){
    const {c,s,remove,advance,time}=fixture();const review=c.billUndoReview(s,'b'),r=remove();advance(delta);
    assert.equal(c.billUndoRemove(s,review,[],time()).state,s);assert.equal(c.billUndoRestore(r.state,r.undo,time()).state,r.state);
  }
});
test('marcas de gasto vuelven por la transformación real y conservan etiquetas posteriores',()=>{
  const {c,s,remove,time}=fixture();s.expenses=[{id:'x',date:'2026-10-12',amount:80,merchant:'Fibra',ent:'sabadell',source:'ob',reciboId:'b',category:'servicios'}];
  s.accounts=[{id:'bank',ent:'sabadell',role:'gasto',value:1000}];
  const r=remove(),row={...r.state.expenses[0],category:'hogar',note:'nueva'};assert.ok(!Object.hasOwn(row,'reciboId'));
  const current={...r.state,expenses:[row]},u=c.billUndoRestore(current,r.undo,time()+1);
  assert.equal(u.state.expenses[0].reciboId,'b');assert.equal(u.state.expenses[0].category,'hogar');assert.equal(u.state.expenses[0].note,'nueva');assert.equal(u.subir.length,1);
  const shown=s=>c.saldoCuentaMostrada(s.accounts[0],c.insumosSaldoGasto(s));
  assert.equal(Math.round(shown(s)*100),Math.round(shown(r.state)*100));assert.equal(Math.round(shown(current)*100),Math.round(shown(u.state)*100));
});
test('cargo modificado, recreado, duplicado o vuelto a vincular se conserva entero',()=>{
  const {c,s,remove,time}=fixture();s.expenses=[{id:'x',date:'2026-10-12',amount:80,merchant:'Fibra',ent:'sabadell',source:'ob',reciboId:'b'}];const r=remove(),e=r.state.expenses[0];
  for(const expenses of [[{...e,amount:90}],[{...e,date:'2026-10-13'}],[{...e,merchant:'Otra'}],[e,{...e}],[{...e,reciboId:'other'}],[]]){
    const current={...r.state,expenses},u=c.billUndoRestore(current,r.undo,time()+1);assert.equal(u.skipped,true);assert.equal(u.state.expenses,expenses);assert.equal(u.subir.length,0);
  }
});
test('deuda ya cobrada: retirar y deshacer no mueven el saldo mostrado con cargo marcado',()=>{
  const {c,s,d,b,remove,time}=fixture();d.day=5;b.day=5;
  s.expenses=[{id:'x',date:'2026-10-05',amount:80,merchant:'Fibra',ent:'sabadell',source:'ob',reciboId:'b',category:'hogar'}];
  s.accounts=[{id:'bank',ent:'sabadell',role:'fijos',value:1000}];s.settings.expenseBanks=['sabadell'];
  const shown=state=>Math.round(c.saldoCuentaMostrada(state.accounts[0],c.insumosSaldoGasto(state))*100);
  const r=remove(),u=c.billUndoRestore(r.state,r.undo,time()+1);
  assert.equal(shown(r.state),shown(s),'Retirar conserva el saldo con el banco quieto');
  assert.equal(shown(u.state),shown(r.state),'Deshacer conserva el saldo con el banco quieto');
  assert.deepEqual(plain(u.state.debts),s.debts);
  const debtLater={...r.state.debts[0],monthly:333,note:'Posterior'},accountLater={...r.state.accounts[0],value:2222};
  const current={...r.state,debts:[debtLater],accounts:[accountLater]},partial=c.billUndoRestore(current,r.undo,time()+1);
  assert.equal(partial.skipped,true);assert.equal(partial.state.debts[0],debtLater);
  assert.equal(shown(partial.state),shown(current),'Compensa desde la cuenta vigente, sin pisar la deuda concurrente');
});
test('la cola mantiene retirar→reponer, separa titulares y propaga fallos',async()=>{
  const {c}=fixture(),cloud=vm.runInNewContext('cloud',c),events=[];let release,owner='owner-a';
  cloud.enabled=()=>true;cloud.session=async()=>({user:{id:owner}});c.mcSandbox=()=>false;
  cloud.setExpenseRecibo=async e=>{events.push(e.reciboId||'removed');if(!e.reciboId)await new Promise(r=>{release=r;});};
  const e={id:'x',date:'2026-10-12',amount:80,merchant:'Fibra',ent:'sabadell'};
  const first=c.billUndoSend([e],owner);await ticks();const second=c.billUndoSend([{...e,reciboId:'b'}],owner);await ticks();assert.deepEqual(events,['removed']);
  release();await Promise.all([first,second]);assert.deepEqual(events,['removed','b']);
  owner='owner-b';await assert.rejects(c.billUndoSend([e],'owner-a'),/bill-undo-owner/);
  cloud.setExpenseRecibo=async()=>{throw Error('synthetic-network');};await assert.rejects(c.billUndoSend([e],owner),/synthetic-network/);
});
function controller(f,{replay=false,discard=false,defer=false}={}){
  const {c}=f,hooks=[],transitions=[];let cursor=0,state=f.s,open=true,api,writes=0,removed=[],notices=[],answer,effects=[],batch=false,rendering=false,dirty=false;
  c.React.useRef=v=>{const i=cursor++;return hooks[i]||(hooks[i]={current:v});};
  c.React.useState=v=>{const i=cursor++,h=hooks[i]||(hooks[i]={value:v});return [h.value,value=>{h.value=value;dirty=true;if(!batch&&!rendering)render();}];};
  c.React.useLayoutEffect=(fn,deps)=>{const i=cursor++,old=hooks[i];if(!deps||!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(fn);hooks[i]={deps};};
  const transition=fn=>{batch=true;try{fn();}finally{batch=false;}if(dirty)render();};
  c.React.startTransition=fn=>{if(defer)transitions.push(fn);else transition(fn);};
  c.askText=()=>new Promise(r=>{answer=r;});
  const set=fn=>{writes++;if(replay)fn(state);const next=fn(state);if(!discard)state=next;dirty=true;if(!batch&&!rendering)render();};
  function render(){rendering=true;let n=0;do{if(++n>20)throw Error('hook render loop');dirty=false;cursor=0;effects=[];api=c.useBillUndo(state,set,open,x=>removed.push(x),x=>notices.push(x));effects.forEach(fn=>fn());}while(dirty);rendering=false;}
  render();return {flush:()=>{while(transitions.length)transition(transitions.shift());},api:()=>api,state:()=>state,writes:()=>writes,removed,notices,answer:async()=>{await ticks();answer('290');await ticks();},close:()=>{open=false;render();}};
}

test('controlador: un commit por acción, replay del updater y doble toque sin duplicar',async()=>{
  const f=fixture(),h=controller(f,{replay:true});h.api().remove('b');h.api().remove('b');assert.equal(h.removed.length,0);f.advance(6000);await h.answer();
  assert.equal(h.writes(),1);assert.equal(h.removed.length,1);assert.equal(h.removed[0].until,f.time()+5000);
  h.api().undo(h.removed[0]);h.api().undo(h.removed[0]);assert.equal(h.writes(),2);assert.deepEqual(plain(h.state().debts),f.s.debts);
  assert.ok(!JSON.stringify(h.state()).includes('operation'));
});
test('sin commit real no se ofrece Deshacer; caducidad y cierre invalidan el token',async()=>{
  const f=fixture(),discard=controller(f,{discard:true});discard.api().remove('b');await discard.answer();assert.equal(discard.removed.length,0);assert.equal(discard.notices.length,1);
  const exp=controller(f);exp.api().remove('b');await exp.answer();f.advance(5000);exp.api().undo(exp.removed[0]);assert.equal(exp.writes(),1);
  const close=controller(f);close.api().remove('b');close.close();await close.answer();assert.equal(close.writes(),0);assert.equal(close.removed.length,0);
});


test('la caducidad se comprueba de nuevo antes de escribir una intención encolada',async()=>{
  const f=fixture(),h=controller(f,{defer:true});h.api().remove('b');await h.answer();assert.equal(h.writes(),0);h.flush();assert.equal(h.writes(),1);
  f.advance(4999);h.api().undo(h.removed[0]);f.advance(1);h.flush();assert.equal(h.writes(),1);assert.equal(h.state().fixed.length,0);assert.equal(h.notices.length,0);
});
