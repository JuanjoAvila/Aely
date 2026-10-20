import assert from 'node:assert/strict';import vm from 'node:vm';
import {expense} from './fin04-legacy-witnesses.mjs';
export async function renameWitness(c){
  const orig={...expense,note:'Humana',noteEdited:true},s={expenses:[orig],fixed:[],oneoffs:[],deleted:[]};
  const draft=c.expenseRenameDraft(s,orig,'Pendiente',10);
  assert.equal(draft.expenses[0].merchant,'Nuevo','sin ACK no hay nombre confirmado');
  assert.equal(draft.expenses[0].renamePending.merchant,'Pendiente');
  c.mcSaveRaw('micartera_v3',draft);assert.equal(c.mcLoadRaw('micartera_v3').expenses[0].renamePending.merchant,'Pendiente','cola en partición durable');
  const ack={id:orig.id,fecha:orig.date,importe:20,comercio:'Pendiente',nota:'Humana',nota_edit:true};
  assert.equal(c.expenseRenameAck(draft,orig,{merchant:'Pendiente',at:10},{...ack,comercio:'Otro'}),draft,'ACK no corresponde al nombre solicitado');
  const next=c.expenseRenameDraft(draft,orig,'Más reciente',11);
  const late=c.expenseRenameAck(next,orig,{merchant:'Pendiente',at:10},ack);
  assert.ok(late.expenses[0].renamePending,'ACK tardío conserva la intención más nueva');
  assert.equal(late.expenses[0].renamePending.merchant,'Más reciente','ACK tardío no borra otra intención');
  assert.equal(late.expenses[0].merchant,'Pendiente');assert.equal(late.expenses[0].amount,20);
  const final=c.expenseRenameAck(late,late.expenses[0],{merchant:'Más reciente',at:11},{...ack,comercio:'Más reciente'});
  assert.equal(final.expenses[0].renamePending,undefined);assert.equal(final.expenses[0].merchant,'Más reciente');assert.equal(final.expenses[0].note,'Humana');
  let connected=false,calls=0,acked=0;
  c.renameMock=async()=>{calls++;if(!connected)throw Error('offline');return ack;};
  vm.runInContext('cloud.enabled=()=>true;cloud.renameExpense=renameMock;',c);
  const job={rename:{merchant:'Pendiente',at:10},current:()=>orig,ack:()=>acked++},queue={pend:[job],fin:Promise.resolve()};
  await c.subeEdicionesDeGasto(queue);assert.equal(queue.pend.length,1,'fallo de red conserva el trabajo');assert.equal(acked,0);
  connected=true;await c.subeEdicionesDeGasto(queue);assert.equal(calls,2);assert.equal(queue.pend.length,0);assert.equal(acked,1,'solo ACK positivo consume cola');
}
