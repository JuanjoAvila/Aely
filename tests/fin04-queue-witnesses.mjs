import assert from 'node:assert/strict';import vm from 'node:vm';
import {expense} from './fin04-legacy-witnesses.mjs';
export async function queueWitness(c){
  const orig={...expense,renamePending:{merchant:'Pendiente',at:10}};let failures=0,later=0,notices=0;
  c.renameMock=async()=>{failures++;throw Error('permanent synthetic refusal');};
  c.later=()=>{later++;};
  vm.runInContext('cloud.enabled=()=>true;cloud.renameExpense=renameMock;borrarGastoNube=async()=>true;subirGasto=async()=>later();',c);
  const job={rename:orig.renamePending,current:()=>orig,ack:()=>assert.fail('failure cannot ACK'),fail:(_e,_n,blocked)=>{if(blocked)notices++;}},queue={pend:[job,{orig:{...expense,id:'later'},upd:{...expense,id:'later'}}],fin:Promise.resolve()};
  for(let i=0;i<3;i++)await c.subeEdicionesDeGasto(queue);
  assert.equal(later,1,'tres fallos no bloquean la edición independiente posterior');
  assert.equal(failures,3,'límite finito de intentos');assert.equal(notices,1,'un solo aviso al apartar');assert.equal(queue.pend.length,0);
  for(let i=0;i<5;i++)await c.subeEdicionesDeGasto(queue);
  assert.equal(failures,3,'la cola no resucita el trabajo apartado');assert.equal(notices,1);
}
// Rojo de la beta 4.26.153: sin red, los tres intentos se gastaban en ~9 ms y el nombre se apartaba.
export async function networkQueueWitness(c){
  const orig={...expense,renamePending:{merchant:'Pendiente',at:10}};let state={expenses:[orig],fixed:[],oneoffs:[],deleted:[]};
  let connected=false,calls=0,acked=0;const fails=[];
  c.renameMock=async()=>{calls++;if(!connected)throw {message:'TypeError: Failed to fetch',code:''};return {id:orig.id};};
  vm.runInContext('cloud.enabled=()=>true;cloud.renameExpense=renameMock;',c);
  const job={rename:orig.renamePending,current:()=>state.expenses[0],ack:()=>acked++,fail:(e,n,blocked,red)=>{fails.push({n,blocked,red});if(!red)state=c.expenseRenameFailure(state,e,e.renamePending,n);}},queue={pend:[job],fin:Promise.resolve()};
  for(let i=0;i<5;i++)await c.subeEdicionesDeGasto(queue);
  assert.equal(calls,5);assert.deepEqual(fails.map(f=>[f.n,f.blocked,f.red]),Array(5).fill([null,false,true]),'caída de red ni cuenta ni aparta');
  assert.equal(queue.pend.length,1,'sigue en la cola');assert.deepEqual(state.expenses[0].renamePending,{merchant:'Pendiente',at:10},'pendiente y sin contador');
  assert.equal(state.expenses[0].merchant,orig.merchant,'el comercio no cambia antes del ACK');
  job.waitUntil=Date.now()+60000;connected=true;await c.subeEdicionesDeGasto(queue);assert.equal(calls,5,'la espera no se adelanta por una llamada encadenada');
  job.waitUntil=0;await c.subeEdicionesDeGasto(queue);assert.equal(acked,1,'al volver la red se confirma');assert.equal(queue.pend.length,0);
}
export async function durableQueueWitness(c){
  const orig={...expense,note:'Humana',noCard:true,renamePending:{merchant:'Pendiente',at:10}};
  let state={expenses:[orig],fixed:[],oneoffs:[],deleted:[]},calls=0,notices=0;
  c.renameMock=async()=>{calls++;throw Error('permanent');};vm.runInContext('cloud.enabled=()=>true;cloud.renameExpense=renameMock;',c);
  const job=()=>({rename:state.expenses[0].renamePending,current:()=>state.expenses[0],ack:()=>assert.fail('no ACK'),fail:(e,n,blocked)=>{state=c.expenseRenameFailure(state,e,e.renamePending,n);if(blocked)notices++;}});
  let queue={pend:[job()],fin:Promise.resolve()};await c.subeEdicionesDeGasto(queue);await c.subeEdicionesDeGasto(queue);
  assert.equal(state.expenses[0].renamePending.failures,2);assert.equal(notices,0,'sin aviso repetido antes del límite');
  c.mcSaveRaw('micartera_v3',state);state=c.mcLoadRaw('micartera_v3');queue={pend:[job()],fin:Promise.resolve()};await c.subeEdicionesDeGasto(queue);
  assert.equal(calls,3,'recarga no reinicia el contador');assert.equal(state.expenses[0].renamePending.quarantined,true);assert.equal(notices,1);assert.equal(state.expenses[0].merchant,orig.merchant);assert.equal(state.expenses[0].note,'Humana');assert.equal(state.expenses[0].amount,20);assert.equal(state.expenses[0].noCard,true);
  const newer=c.expenseRenameDraft(state,state.expenses[0],'Más reciente',11);
  assert.equal(newer.expenses[0].renamePending.quarantined,undefined,'nueva intención rearma');assert.equal(newer.expenses[0].renamePending.failures,undefined);
  assert.equal(c.expenseRenameFailure(newer,orig,orig.renamePending,3),newer,'fallo viejo no aparta intención nueva');
  const late=c.expenseRenameAck(newer,orig,orig.renamePending,{id:orig.id,fecha:orig.date,importe:20,comercio:'Pendiente'});
  assert.equal(late.expenses[0].renamePending.at,11,'ACK viejo no consume reintento nuevo');
}
