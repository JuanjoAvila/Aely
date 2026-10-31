import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {environment,plain,owner,uuid,cents,now} from './helpers/fin19-r4-fixture.mjs';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const script=JSON.parse(read('src/build-order.json')).map(p=>read('src/modules/'+p)).map(s=>s.endsWith('\n')?s:s+'\n').join('');
const parts=read('src/shell.html').split('<!--MC_APP_SCRIPT-->');
assert.equal(parts.length,2,'un solo marcador del ensamblador');
const html=parts[0]+script.trimEnd()+parts[1],cases=[];
const wire=(n=1,extra={})=>({id:uuid(n),user_id:owner,fecha:'2026-10-19T10:00:00.001Z',importe:3.2,comercio:'BAR SL',ob_name:'BAR SL',cat:'otros',source:'ob:sabadell#refref-'+n+'#accaccount-a#n2',...extra});
function renamed(){
 const raw=wire(),env=environment(html,[raw]),orig=env.stateRef.current.expenses[0];
 env.set(s=>env.c.expenseRenameAck(s,orig,{merchant:'Mi bar',at:now},{...raw,comercio:'Mi bar'}));
 assert.equal(env.stateRef.current.expenses[0].merchant,'Mi bar');
 assert.ok(env.stateRef.current.deleted.includes(env.c.expenseRenameKey(orig)),'alias original activo');
 assert.equal(env.remote[0].comercio,'BAR SL','la versión remota anterior todavía existe');
 return env;
}
function record(name,env){
 cases.push({name,uploads:plain(env.uploads),rows:plain(env.stateRef.current.expenses),remote:plain(env.remote),deleted:plain(env.stateRef.current.deleted)});
}
after(()=>{
 if(!process.env.FIN29_30_BACKFILL_EVIDENCE)return;
 const fd=fs.openSync(process.env.FIN29_30_BACKFILL_EVIDENCE,'wx');
 try{fs.writeFileSync(fd,JSON.stringify({schema:1,node:process.version,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,htmlSHA256:crypto.createHash('sha256').update(html).digest('hex'),cases},null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
});
test('FIN29/30 alias activo no provoca subidas espurias en pulls repetidos',async()=>{
 const env=renamed(),expected=plain(env.stateRef.current.expenses);
 await env.pull();env.persist();await env.pull();await env.flush();
 record('zero-spurious-uploads',env);
 assert.equal(env.uploads.length,0);
 assert.deepEqual(plain(env.stateRef.current.expenses),expected,'la versión local completa permanece');
 assert.equal(cents(env.stateRef.current.expenses),320);
});
test('FIN29/30 gasto realmente ausente sí se sube aunque otra fila tenga alias activo',async()=>{
 const env=renamed(),missing=env.c.expenseFromRow(wire(3,{comercio:'Ausente local',ob_name:'Ausente local'}));
 env.set(s=>({...s,expenses:s.expenses.concat([missing])}));
 assert.equal(env.remote.length,1,'hay una fila remota real, no un control vacío');
 assert.ok(!env.remote.some(r=>r.id===missing.id));
 await env.pull();await env.flush();
 record('missing-local-with-other-active-alias',env);
 assert.deepEqual(plain(env.uploads),[plain(missing)],'solo se sube el gasto de verdad ausente');
 assert.equal(cents(env.stateRef.current.expenses),640);
 assert.ok(env.remote.some(r=>r.id===missing.id),'el backfill real sigue operativo');
});
for(const variant of ['foreign-owner','different-uuid','invalid-read-proof','different-account','different-time'])test('FIN29/30 alias no presta cobertura: '+variant,async()=>{
 const env=renamed();
 if(variant==='foreign-owner')env.remote[0].user_id='synthetic-other-owner';
 if(variant==='different-uuid')env.remote[0].id=uuid(99);
 if(variant==='different-account')env.remote[0].source='ob:sabadell#refref-1#accaccount-b#n2';
 if(variant==='different-time')env.remote[0].fecha='2026-10-19T10:00:00.002Z';
 if(variant==='invalid-read-proof')env.cloud.pullExpenses=proof=>{proof.valid=false;proof.userId=owner;return Promise.resolve(env.remote);};
 await env.pull();await env.flush();record(variant,env);
 assert.equal(env.uploads.length,1,'una coincidencia incompleta no suprime el backfill');
 assert.equal(env.uploads[0].id,uuid(1));
});
