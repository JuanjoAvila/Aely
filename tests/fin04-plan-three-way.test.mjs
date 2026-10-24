import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
import {codeMask} from '../scripts/beta-source-code.mjs';
const copy=x=>JSON.parse(JSON.stringify(x)),owner='synthetic-owner';
const fixed=()=>[{id:'f',name:'Recibo',amount:42.37,bankAmount:null,account:'sabadell',freq:'mes',day:25,cat:'servicios',unknown:{keep:null}}];
const debts=()=>[{id:'d',name:'Deuda',note:'Inicial',value:1200.23,monthly:100.11,asOf:2026*12+9,day:28,account:'sabadell',unknown:{keep:null}}];
function logic(){
 const c=loadPureLogicFromFile(),storage=new Map();vm.createContext(c);
 c.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};c.window.localStorage=c.localStorage;
 let source=fs.readFileSync(new URL('../src/modules/00-core.js',import.meta.url),'utf8');
 const mutations={
  sum:['rows.push(goalSyncEqual(merged,left)?left:', 'if(kind==="fixed"&&old)merged.amount=left.amount+right.amount-old.amount;rows.push(goalSyncEqual(merged,left)?left:'],
  'orphan-drop':['return c.kind==="debts"||','return c.kind==="debts"?result.debts.some(function(d){return d.id===c.id;}):'],
  split:['const groups=[financial];','const groups=financial.map(function(k){return [k];});'],
  ack:['fixed:goalSyncCopy(sent.fixed||[]),debts:goalSyncCopy(sent.debts||[])','fixed:goalSyncCopy(prev.fixed||[]),debts:goalSyncCopy(prev.debts||[])']
 };
 const signature=/function mergePlanThreeWay\(base,\s*local,\s*remote,\s*kind,\s*deleted\)\s*\{/;
 const injections={
  'delete-left':'if(kind==="debts"&&(deleted||[]).some(function(d){return !(local||[]).some(function(row){return row.id===d.id;});}))deleted=[];',
  'delete-right':'if(kind==="debts"&&(deleted||[]).some(function(d){return !(remote||[]).some(function(row){return row.id===d.id;});}))deleted=[];',
  'delete-edited':'if(kind==="debts"){const gone=new Set((deleted||[]).map(function(d){return d.id;}));local=(local||[]).filter(function(d){return !gone.has(d.id);});remote=(remote||[]).filter(function(d){return !gone.has(d.id);});}',
  'offline-paid':'if(kind==="fixed")local=(local||[]).map(function(f){const n=Object.assign({},f);delete n.paidYm;return n;});',
  'offline-day':'if(kind==="fixed")local=(local||[]).map(function(f){const n=Object.assign({},f);delete n.paidDay;return n;});',
  'offline-wait':'if(kind==="fixed")local=(local||[]).map(function(f){const n=Object.assign({},f);delete n.wait;return n;});',
  'legacy-paid':'if(kind==="fixed"&&!Array.isArray(base))local=(local||[]).map(function(f){const n=Object.assign({},f);delete n.paidYm;delete n.paidDay;return n;});',
  'legacy-wait':'if(kind==="fixed"&&!Array.isArray(base))local=(local||[]).map(function(f){const n=Object.assign({},f);delete n.wait;return n;});'
 };
 const mutant=process.env.FIN04B_MUTANT;
 if(mutant==='recovery-no-restore-mark'){
  assert.ok(source.includes('function planSyncRecoverDebt('),'recovery mutation anchor');source=source.replace('function planSyncRecoverDebt(','function planSyncRecoverDebtOriginal(');
  source+='\nfunction planSyncRecoverDebt(s,record,next){const recovered=planSyncRecoverDebtOriginal(s,record,next);if(recovered===s)return s;return Object.assign({},recovered,{debts:recovered.debts.map(function(row){if(row.id!==record.id)return row;const n=Object.assign({},row);delete n.restoredAt;return n;})});}\n';
 }
 else if(injections[mutant]){assert.ok(signature.test(source),'mutant merge signature');source=source.replace(signature,function(head){return head+injections[mutant];});}
 else if(mutant&&mutations[mutant]){const [a,b]=mutations[mutant];assert.ok(source.includes(a),'mutant anchor '+mutant);source=source.replace(a,b);}
 else if(mutant&&mutant!=='invalid-plan-abort')throw Error('Unknown FIN04B_MUTANT '+mutant);
 const hogar=fs.readFileSync(new URL('../src/modules/13-hogar.js',import.meta.url),'utf8'),hs=hogar.indexOf('function buildHouseholdSnapshot('),he=hogar.indexOf('\nfunction mergeHouseholdSnapshots',hs);vm.runInContext(hogar.slice(hs,he),c);
 const motor=fs.readFileSync(new URL('../src/modules/08-motor-bank.js',import.meta.url),'utf8');
 for(const text of [source,motor]){
  const mask=codeMask(text);
  for(const m of text.matchAll(/^function (planSync\w+|mergePlanThreeWay|fixedPaymentDerivedDay)\(/gm)){const start=m.index,open=mask.indexOf('{',start);let end=open+1,n=1;for(;n;end++){if(mask[end]==='{')n++;else if(mask[end]==='}')n--;}vm.runInContext(text.slice(start,end),c);}
 }
 return c;
}
test('fixed disjoint fields, exact signs, null/absent/unknown and references',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base);l[0].name='Local';r[0].day=29;
 const m=c.mergePlanThreeWay(base,l,r,'fixed');assert.equal(m.rows[0].name,'Local');assert.equal(m.rows[0].day,29);assert.equal(m.conflicts.length,0);assert.equal(Math.round(m.rows[0].amount*100),4237);assert.deepEqual(copy(m.rows[0].unknown),{keep:null});assert.equal(m.rows[0].bankAmount,null);assert.ok(!Object.hasOwn(m.rows[0],'months'));
 assert.equal(c.mergePlanThreeWay(base,base,copy(base),'fixed').rows,base);
 base[0].amount=-42.37;assert.equal(c.mergePlanThreeWay(base,base,copy(base),'fixed').rows[0].amount,-42.37);
});
test('fixed finance is atomic, never summed; name/category merge independently',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base);l[0].amount=45.67;l[0].cat='ocio';r[0].day=29;r[0].name='Remoto';
 const m=c.mergePlanThreeWay(base,l,r,'fixed');assert.equal(Math.round(m.rows[0].amount*100),4237);assert.equal(m.rows[0].day,29);assert.equal(m.rows[0].cat,'ocio');assert.equal(m.rows[0].name,'Remoto');assert.equal(m.conflicts.length,1);assert.equal(Math.round(m.conflicts[0].local.amount*100),4567);
 assert.deepEqual(copy(m.conflicts[0].fields),['amount','bankAmount','account','freq','months','schedule','day','paymentProofs']);
});
test('debt financial fields stay together, independent name/note survive',()=>{
 const c=logic(),base=debts(),l=copy(base),r=copy(base);l[0].monthly=101.12;l[0].note='Local';r[0].value=1100.12;r[0].name='Remota';
 const m=c.mergePlanThreeWay(base,l,r,'debts');assert.equal(Math.round(m.rows[0].value*100),110012);assert.equal(Math.round(m.rows[0].monthly*100),10011);assert.equal(m.rows[0].name,'Remota');assert.equal(m.rows[0].note,'Local');assert.equal(m.conflicts.length,1);assert.equal(m.conflicts[0].local.monthly,101.12);
});
test('absence without a debt tombstone stays conservative, including partial arrays',()=>{
 const c=logic(),base=debts(),l=copy(base);l[0].value=1199.22;
 assert.equal(c.mergePlanThreeWay(base,l,[],'debts').rows,l);assert.deepEqual(copy(c.mergePlanThreeWay(base,[],l,'debts').rows),l);
 assert.deepEqual(copy(c.mergePlanThreeWay(base,base,[],'debts').rows),base);
 assert.deepEqual(copy(c.mergePlanThreeWay(base,undefined,base,'debts').rows),base);
});
test('receipt tombstones remove rows and conflicts through existing union',()=>{
 const c=logic(),prev={fixed:fixed(),debts:debts(),_historyOwner:owner};Object.assign(prev,c.planSyncPull(prev,copy(prev),owner,'r0',false));prev.fixed[0]={...prev.fixed[0],amount:45.67};
 const remote={fixed:fixed(),debts:debts(),reciboBorrado:{f:{d:1}},reciboBorradoAt:{f:1}};remote.fixed[0].day=29;
 const m=c.planSyncPull(prev,remote,owner,'r1',false),s=c.recibosBorradosUnion({...prev,...m},prev,remote);assert.equal(s.fixed.length,0);assert.equal(s._planSync.conflicts.length,0);
});
test('20 conflicts survive private storage, reload, replace by id, owner and sandbox isolation',()=>{
 const c=logic(),base=Array.from({length:20},(_,i)=>({...fixed()[0],id:'f'+i})),l=copy(base),r=copy(base);l.forEach(x=>x.amount=45.67);r.forEach(x=>x.day=29);
 const records=c.mergePlanThreeWay(base,l,r,'fixed').conflicts;assert.equal(records.length,20);const meta={owner,revision:'r1',base:{fixed:base,debts:[]},conflicts:records};
 c.mcSaveRaw('micartera_v3',{_historyOwner:owner,_planSync:meta,fixed:r,debts:[]});assert.equal(c.mcLoadRaw('micartera_v3')._planSync.conflicts.length,20);
 const main=JSON.parse(c.localStorage.getItem('micartera_v3'));assert.ok(!('conflicts' in main._planSync));assert.equal(JSON.parse(c.localStorage.getItem('micartera_v3_plan_conflicts')).records.length,20);
 c.planSyncStore('micartera_sandbox',{...meta,conflicts:records.slice(0,1)});assert.equal(c.mcLoadRaw('micartera_v3')._planSync.conflicts.length,20);
 const replaced=c.planSyncRecords(records.concat([{...records[0],local:{...records[0].local,amount:49.99}}]));assert.equal(replaced.length,20);assert.equal(replaced[0].local.amount,49.99);
 c.planSyncClear('micartera_v3',owner);c.mcSaveRaw('micartera_v3',{_historyOwner:owner,_planSync:meta});assert.equal(c.localStorage.getItem('micartera_v3_plan_conflicts'),null);
 const other=c.planSyncPull({_planSync:meta,fixed:l,debts:[]},{fixed:r,debts:[]},'other','r2',true);assert.equal(other._planSync.conflicts.length,0);assert.equal(other.fixed[0].amount,42.37);
});
test('ACK anchors sent snapshot while preserving an edit made in flight and references',()=>{
 const c=logic(),initial={fixed:fixed(),debts:debts()},prev={...copy(initial),_historyOwner:owner};Object.assign(prev,c.planSyncPull(prev,copy(initial),owner,'r0',false));
 const sent=copy(prev);prev.debts=[{...prev.debts[0],monthly:102.13}];const a=c.planSyncAck(prev,owner,sent,'r0','r1');assert.equal(a.debts,prev.debts);assert.equal(a.fixed,prev.fixed);assert.equal(a._planSync.base.debts[0].monthly,100.11);assert.equal(a.debts[0].monthly,102.13);
 assert.equal(c.planSyncAck(prev,'other',sent,'r0','r1'),prev);assert.equal(c.planSyncAck(prev,owner,sent,'stale','r1'),prev);assert.equal(c.goalSyncMetadataOnly(prev,a),true);
 const remote=copy(sent);remote.debts[0].name='Otro nombre';const m=c.planSyncPull(a,remote,owner,'r2',false);assert.equal(m.debts[0].monthly,102.13);assert.equal(m.debts[0].name,'Otro nombre');
});
for(const field of ['paidYm','paidDay','wait'])test('offline '+field+' survives three-way merge, ACK and reload without inventing evidence',()=>{
 const c=logic();c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-21T12:00:00+02:00']));}};
 const ym=2026*12+10,base=fixed(),l=copy(base),r=copy(base);
 if(field==='wait')l[0].wait=ym;else Object.assign(l[0],{paidYm:ym,paidDay:12});
 r[0].name='Nombre remoto';
 const prev={fixed:l,debts:debts(),accounts:[],expenses:[],bankTx:[],_historyOwner:owner,_planSync:{owner,revision:'r0',base:{fixed:base,debts:debts()},conflicts:[]}};
 const remote={fixed:r,debts:debts()},patch=c.planSyncPull(prev,remote,owner,'r1',false),next=c.planSyncDerived({...prev,...patch},prev);
 assert.equal(next.fixed[0][field],l[0][field]);assert.equal(next.fixed[0].name,'Nombre remoto');assert.equal(next._planSync.conflicts.length,0);
 assert.equal(Math.round(next.fixed[0].amount*100),4237);assert.ok(!Object.hasOwn(next.fixed[0],'paymentProofs'));assert.equal(next.accounts,prev.accounts);assert.equal(next.expenses,prev.expenses);
 const ack=c.planSyncAck(next,owner,copy(next),'r1','r2');c.mcSaveRaw('micartera_v3',ack);const reloaded=c.mcLoadRaw('micartera_v3');
 assert.equal(reloaded.fixed[0][field],l[0][field]);const again=c.planSyncPull(reloaded,copy(ack),owner,'r3',false),derived=c.planSyncDerived({...reloaded,...again},reloaded);assert.equal(derived.fixed[0][field],l[0][field]);
 if(field!=='wait'){assert.equal(derived.fixed[0].paidYm,ym);assert.equal(derived.fixed[0].paidDay,12);assert.equal(c.fixedPaymentState(derived,derived.fixed[0],2026,10,21).paid,true);}
 else assert.equal(derived.fixed[0].wait,ym);
 assert.equal(Math.round(derived.fixed[0].amount*100),4237);assert.ok(!Object.hasOwn(derived.fixed[0],'paymentProofs'));
});
test('BOOK proof identity survives rename/merge; derived date is recomputed without replay',()=>{
 const c=logic();c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-21T12:00:00+02:00']));}};
 const s={fixed:[{...fixed()[0],name:'Gas sintético',day:19}],accounts:[{id:'acc',ent:'sabadell',role:'fijos',value:500}],debts:debts(),expenses:[],oneoffs:[],bankTx:[{id:'book-identity',ent:'sabadell',date:'2026-10-20',amount:42.37,merchant:'Gas sintético',status:'BOOK'}]};
 const bound=c.reconcileFixedPaymentProofs(s,2026,10,21),proof=copy(bound.fixed[0].paymentProofs);assert.equal(proof[2026*12+10].kind,'book');
 const left=copy(bound.fixed);left[0].name='Nombre personal';const m=c.mergePlanThreeWay(bound.fixed,left,bound.fixed,'fixed');const combined={...bound,fixed:m.rows,bankTx:[]};
 const n=c.planSyncDerived(combined,combined);assert.equal(n.fixed[0].paidDay,20);assert.equal(n.fixed[0].paidYm,2026*12+10);assert.deepEqual(copy(n.fixed[0].paymentProofs),proof);assert.equal(n.accounts,s.accounts);assert.equal(n.debts,s.debts);assert.equal(n.expenses,s.expenses);assert.equal(Math.round(n.fixed[0].amount*100),4237);assert.equal(c.planSyncDerived(n,n).fixed,n.fixed);
 const invalid={...n,fixed:[{...n.fixed[0],amount:45.67}]},after=c.planSyncDerived(invalid,invalid);assert.ok(!after.fixed[0].paidDay);assert.deepEqual(copy(after.fixed[0].paymentProofs),proof,'invalid proof not silently rebound');
});
test('private metadata excluded from cloud and Hogar; review is a draft without payment replay',()=>{
 const c=logic(),s={fixed:fixed(),debts:debts(),accounts:[],expenses:[],_historyOwner:owner,_planSync:{owner,conflicts:[{kind:'fixed',id:'f',fields:['amount','paymentProofs'],local:{...fixed()[0],amount:45.67,paymentProofs:{secret:true}}}]}};
 assert.ok(!('_planSync' in c.slimForCloud(s)));assert.ok(!JSON.stringify(c.buildHouseholdSnapshot(s,{},'synthetic')).includes('secret'));
 const record=s._planSync.conflicts[0],draft=c.planReviewDraft(s.fixed[0],record);assert.equal(draft.amount,45.67);assert.ok(!draft.paymentProofs);assert.equal(s.fixed[0].amount,42.37);assert.equal(c.planSyncDiscard(s,record)._planSync.conflicts.length,0);assert.equal(c.planSyncDiscard(s,{...record,local:{}}),s);
});
test('duplicate identities block adoption; owner/type are never spliced across rows',()=>{
 const c=logic(),base=fixed(),duplicate=base.concat(copy(base));assert.equal(c.mergePlanThreeWay(base,base,duplicate,'fixed').invalid,true);
 assert.equal(c.planSyncPull({fixed:base,debts:[]},{fixed:duplicate,debts:[]},owner,'r1',false),null);assert.equal(c.planSyncPull({fixed:base},{fixed:duplicate},owner,'r1',true),null);
 const l=[{...debts()[0],owner:'one',type:'loan',name:'Local'}],r=[{...debts()[0],owner:'two',type:'mortgage',value:1000.34}];
 const m=c.mergePlanThreeWay(debts(),l,r,'debts');assert.deepEqual(copy(m.rows),r);assert.equal(m.conflicts.length,1);assert.equal(c.planReviewDraft(r[0],m.conflicts[0]).owner,'two');assert.equal(c.planReviewDraft(r[0],m.conflicts[0]).type,'mortgage');
});
test('daily and emergency backups omit private conflicts while preserving business data',async()=>{
 const c=logic(),state={fixed:fixed(),debts:debts(),expenses:[{id:'x',amount:-2.34}],_planSync:{owner,conflicts:[{local:{secret:'private'}}]}};
 function block(source,token){const mask=codeMask(source),start=mask.indexOf(token);assert.ok(start>=0);let end=mask.indexOf('{',start)+1,n=1;for(;n;end++){if(mask[end]==='{')n++;else if(mask[end]==='}')n--;}return source.slice(start,end);}
 const core=fs.readFileSync(new URL('../src/modules/00-core.js',import.meta.url),'utf8');let backup;
 const sb={from(){const q={async upsert(v){backup=v;return {error:null};},delete(){return q;},eq(){return q;},async lt(){return {};}};return q;}};
 const api=vm.runInContext('(function(sb){return {'+block(core,'async backupState(')+'};})',c)(sb);await api.backupState(owner,state);assert.ok(!backup.data._planSync);assert.deepEqual(copy(backup.data.expenses),state.expenses);assert.ok(state._planSync);
 const ui=fs.readFileSync(new URL('../src/modules/10-app-components.js',import.meta.url),'utf8');let exported;
 c.mcLoadRaw=()=>state;c.mcStateKey=()=> 'micartera_v3';c.URL={createObjectURL(){return 'blob:synthetic';},revokeObjectURL(){}};c.Blob=class{constructor(parts){exported=JSON.parse(parts[0]);}};c.document.createElement=()=>({click(){}});c.setTimeout=f=>{f();return 0;};
 vm.runInContext(block(ui,'const dl=function()')+';dl();',c);assert.ok(!exported._planSync);assert.deepEqual(exported.fixed,state.fixed);assert.ok(state._planSync);
});

for(const direction of ['local','remote'])test('debt tombstone removes an unchanged row in '+direction+' direction and preserves unrelated exact cents',()=>{
 const c=logic(),base=debts(),keep={...copy(base[0]),id:'keep',value:9.87,monthly:0.33};base.push(keep);
 const local=direction==='local'?[copy(keep)]:copy(base),remote=direction==='remote'?[copy(keep)]:copy(base);
 const m=c.mergePlanThreeWay(base,local,remote,'debts',[copy(base[0])]);
 assert.deepEqual(copy(m.rows),[keep]);assert.equal(m.conflicts.length,0);assert.equal(Math.round(m.rows[0].value*100),987);assert.equal(Math.round(m.rows[0].monthly*100),33);
});

for(const direction of ['local','remote'])test('debt tombstone preserves a concurrent edit in '+direction+' direction',()=>{
 const c=logic(),base=debts(),edited=copy(base);Object.assign(edited[0],{name:'Edición concurrente',note:'Conservar',value:1199.22,monthly:101.12});
 const m=c.mergePlanThreeWay(base,direction==='local'?edited:[],direction==='remote'?edited:[],'debts',copy(base));
 assert.deepEqual(copy(m.rows),edited);assert.equal(Math.round(m.rows[0].value*100),119922);assert.equal(Math.round(m.rows[0].monthly*100),10112);assert.deepEqual(copy(m.rows[0].unknown),{keep:null});
});

test('debt deletion records the full snapshot once, preserves unknown/null and never deletes linked expenses',()=>{
 const c=logic(),initial={fixed:fixed(),debts:debts(),expenses:[],_historyOwner:owner};const original=copy(initial.debts[0]);
 const next=c.planSyncDeleteDebt(initial,'d');assert.equal(next.debts.length,0);assert.deepEqual(copy(next.debtDeleted),[original]);assert.deepEqual(copy(initial.debts),[original]);assert.ok(!Object.hasOwn(initial,'debtDeleted'));
 assert.equal(c.planSyncDeleteDebt(next,'d'),next);assert.equal(next.debtDeleted.length,1);
 const linked={...initial,expenses:[{id:'payment',debtId:'d',amount:100.11}]};assert.equal(c.planSyncDeleteDebt(linked,'d'),linked);assert.equal(linked.debts,initial.debts);assert.ok(!Object.hasOwn(linked,'debtDeleted'));
});

for(const edited of [false,true])for(const direction of ['local','remote'])test('debt delete '+(edited?'versus edit':'versus unchanged')+' converges across pull, ACK and reload · '+direction,()=>{
 const c=logic(),initial={fixed:fixed(),debts:debts(),expenses:[],accounts:[],_historyOwner:owner};
 Object.assign(initial,c.planSyncPull(initial,copy(initial),owner,'r0',false));
 const removed=c.planSyncDeleteDebt(copy(initial),'d'),survivor=copy(initial);
 if(edited)Object.assign(survivor.debts[0],{name:'Edición conservada',value:1199.22,monthly:101.12});
 let a=direction==='local'?removed:survivor,b=direction==='local'?survivor:removed;
 for(let turn=0;turn<3;turn++){
  const remote=c.slimForCloud(b),merged=c.planSyncPull(a,remote,owner,'r'+(turn+1),false);assert.ok(merged);
  a={...a,...merged};const sent=c.slimForCloud(a);a=c.planSyncAck(a,owner,sent,'r'+(turn+1),'ack'+turn);
  c.mcSaveRaw('micartera_v3',a);a=c.mcLoadRaw('micartera_v3');
  const reply=c.planSyncPull(b,c.slimForCloud(a),owner,'reply'+turn,false);assert.ok(reply);b={...b,...reply};
  assert.equal(a.debts.length,edited?1:0);assert.equal(b.debts.length,edited?1:0);
  assert.deepEqual(copy(a.debtDeleted),copy(initial.debts));assert.deepEqual(copy(b.debtDeleted),copy(initial.debts));
  if(edited){for(const s of [a,b]){assert.equal(Math.round(s.debts[0].value*100),119922);assert.equal(Math.round(s.debts[0].monthly*100),10112);assert.equal(s.debts[0].name,'Edición conservada');assert.deepEqual(copy(s.debts[0].unknown),{keep:null});}}
 }
});

test('debt tombstones stay owner-scoped, deduplicate structurally, and reject malformed snapshots',()=>{
 const c=logic(),initial={fixed:fixed(),debts:debts(),expenses:[],_historyOwner:owner,debtDeleted:debts()},remote={fixed:fixed(),debts:debts(),debtDeleted:copy(initial.debtDeleted)};
 const same=c.planSyncPull(initial,remote,owner,'r1',false);assert.equal(same.debts.length,0);assert.equal(same.debtDeleted.length,1);
 const foreign=c.planSyncPull(initial,{fixed:fixed(),debts:debts()},'another-owner','r2',true);assert.equal(foreign.debts.length,1);assert.deepEqual(copy(foreign.debtDeleted),[]);
 for(const malformed of [{bad:true},[null],[{name:'Missing identity'}]])assert.equal(c.planSyncPull(initial,{fixed:fixed(),debts:debts(),debtDeleted:malformed},owner,'r-bad',false),null);
});

test('offline paid month/day is atomic while wait and name merge independently',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base);Object.assign(l[0],{paidYm:2026*12+10,paidDay:12});Object.assign(r[0],{paidYm:2026*12+9,paidDay:30,wait:2026*12+10,name:'Remoto'});
 const m=c.mergePlanThreeWay(base,l,r,'fixed');assert.equal(m.rows[0].paidYm,2026*12+9);assert.equal(m.rows[0].paidDay,30);assert.equal(m.rows[0].wait,2026*12+10);assert.equal(m.rows[0].name,'Remoto');assert.equal(m.conflicts.length,1);assert.deepEqual(copy(m.conflicts[0].fields),['paidYm','paidDay']);assert.equal(Math.round(m.rows[0].amount*100),4237);
});

for(const changed of ['amount','account'])test('offline marks cannot be spliced onto a remote '+changed+' change',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base);Object.assign(l[0],{paidYm:2026*12+10,paidDay:12,wait:2026*12+10});r[0][changed]=changed==='amount'?49.99:'caixabank';
 const m=c.mergePlanThreeWay(base,l,r,'fixed');assert.equal(m.rows[0][changed],r[0][changed]);for(const k of ['paidYm','paidDay','wait'])assert.ok(!Object.hasOwn(m.rows[0],k),k+' belongs to the previous money/account');assert.ok(!Object.hasOwn(m.rows[0],'paymentProofs'));assert.equal(Math.round(m.rows[0].amount*100),changed==='amount'?4999:4237);
});

for(const field of ['paidYm','paidDay','wait'])test('legacy first pull without Plan metadata preserves offline '+field+' for identical money and account',()=>{
 const c=logic();c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-21T12:00:00+02:00']));}};
 const ym=2026*12+10,local=fixed(),remote=fixed();if(field==='wait')local[0].wait=ym;else Object.assign(local[0],{paidYm:ym,paidDay:12});
 remote[0].name='Nombre remoto sin marca';
 const prev={fixed:local,debts:debts(),accounts:[],expenses:[],bankTx:[],_historyOwner:owner};assert.ok(!Object.hasOwn(prev,'_planSync'));
 const merged=c.planSyncPull(prev,{fixed:remote,debts:debts()},owner,'r-legacy',false);assert.ok(merged);
 const next=c.planSyncDerived({...prev,...merged},prev);assert.equal(next.fixed[0][field],local[0][field]);assert.equal(next.fixed[0].name,'Nombre remoto sin marca');
 if(field!=='wait'){assert.equal(next.fixed[0].paidYm,ym);assert.equal(next.fixed[0].paidDay,12);assert.equal(c.fixedPaymentState(next,next.fixed[0],2026,10,21).paid,true);}
 const sent=c.slimForCloud(next),acked=c.planSyncAck(next,owner,sent,'r-legacy','r-legacy-ack');c.mcSaveRaw('micartera_v3',acked);const loaded=c.mcLoadRaw('micartera_v3');assert.equal(loaded.fixed[0][field],local[0][field]);
 assert.equal(Math.round(loaded.fixed[0].amount*100),4237);assert.equal(loaded.fixed[0].account,'sabadell');assert.ok(!Object.hasOwn(loaded.fixed[0],'paymentProofs'));
});

for(const changed of ['amount','account'])test('legacy first pull cannot carry offline marks onto changed remote '+changed,()=>{
 const c=logic(),local=fixed(),remote=fixed();Object.assign(local[0],{paidYm:2026*12+10,paidDay:12,wait:2026*12+10});remote[0][changed]=changed==='amount'?49.99:'caixabank';
 const prev={fixed:local,debts:debts(),accounts:[],expenses:[],bankTx:[],_historyOwner:owner};assert.ok(!Object.hasOwn(prev,'_planSync'));
 const merged=c.planSyncPull(prev,{fixed:remote,debts:debts()},owner,'r-legacy-money',false);assert.ok(merged);assert.equal(merged.fixed[0][changed],remote[0][changed]);
 for(const field of ['paidYm','paidDay','wait'])assert.ok(!Object.hasOwn(merged.fixed[0],field),field+' cannot migrate to another financial row');
 assert.equal(Math.round(merged.fixed[0].amount*100),changed==='amount'?4999:4237);assert.ok(!Object.hasOwn(merged.fixed[0],'paymentProofs'));
});

test('a remote debt tombstone preserves a distinct private conflict draft without applying its money',()=>{
 const c=logic(),current=debts(),draft=copy(current[0]);Object.assign(draft,{monthly:101.12,note:'Borrador privado conservado'});
 const record={kind:'debts',id:'d',fields:['monthly','note'],local:draft};
 const prev={fixed:fixed(),debts:current,expenses:[],_historyOwner:owner,_planSync:{owner,revision:'r-before-delete',base:{fixed:fixed(),debts:copy(current)},conflicts:[record]}};
 const remote={fixed:fixed(),debts:[],debtDeleted:copy(current)},patch=c.planSyncPull(prev,remote,owner,'r-deleted',false);assert.ok(patch);
 assert.equal(patch.debts.length,0,'keeping a private draft must not restore deleted product data');assert.equal(patch._planSync.conflicts.length,1);assert.deepEqual(copy(patch._planSync.conflicts[0]),record);
 assert.equal(Math.round(patch._planSync.conflicts[0].local.monthly*100),10112);assert.deepEqual(copy(patch.debtDeleted),current);
 const state={...prev,...patch},sent=c.slimForCloud(state);assert.ok(!Object.hasOwn(sent,'_planSync'));assert.equal(sent.debts.length,0);
 const acked=c.planSyncAck(state,owner,sent,'r-deleted','r-deleted-ack');c.mcSaveRaw('micartera_v3',acked);const loaded=c.mcLoadRaw('micartera_v3');assert.equal(loaded.debts.length,0);assert.deepEqual(copy(loaded._planSync.conflicts),[record]);
 const repeat=c.planSyncPull(loaded,remote,owner,'r-deleted-repeat',false);assert.equal(repeat.debts.length,0);assert.deepEqual(copy(repeat._planSync.conflicts),[record]);
 const noDraft={...prev,_planSync:{...prev._planSync,conflicts:[]}},plain=c.planSyncPull(noDraft,remote,owner,'r-deleted-plain',false);assert.equal(plain.debts.length,0);assert.equal(plain._planSync.conflicts.length,0);
});

function deletedDebtDraft(){
 const original=debts()[0],draft={...copy(original),name:'Nombre local recuperable',note:'Borrador privado',monthly:101.12};
 const record={kind:'debts',id:original.id,fields:['name','note','monthly'],local:draft};
 const state={fixed:fixed(),debts:[],debtDeleted:[copy(original)],expenses:[],_historyOwner:owner,_planSync:{owner,revision:'r-deleted',base:{fixed:fixed(),debts:[]},conflicts:[record]}};
 return {original,draft,record,state,next:{...copy(draft),restoredAt:'2026-10-25T00:05:00.000Z'}};
}

test('explicit debt recovery applies only on validated save, retains id/cents/unknown and atomically clears the current draft',()=>{
 const c=logic(),b=deletedDebtDraft(),before=copy(b.state),preview=c.planReviewDraft(b.draft,b.record);assert.equal(preview.name,b.draft.name);assert.deepEqual(copy(b.state),before);assert.equal(b.state.debts.length,0);
 const recovered=c.planSyncRecoverDebt(b.state,b.record,b.next);assert.notEqual(recovered,b.state);assert.equal(recovered.debts.length,1);assert.deepEqual(copy(recovered.debts[0]),b.next);assert.equal(recovered.debts[0].id,b.record.id);assert.equal(recovered.debts[0].restoredAt,b.next.restoredAt);
 assert.equal(Math.round(recovered.debts[0].value*100),120023);assert.equal(Math.round(recovered.debts[0].monthly*100),10112);assert.deepEqual(copy(recovered.debts[0].unknown),{keep:null});assert.equal(recovered._planSync.conflicts.length,0);assert.deepEqual(copy(recovered.debtDeleted),before.debtDeleted);assert.deepEqual(copy(b.state),before);
});

test('debt recovery rejects stale drafts, wrong identities, existing rows and absent explicit recovery marks',()=>{
 const c=logic(),b=deletedDebtDraft();
 assert.equal(c.planSyncRecoverDebt(b.state,{...b.record,local:{...b.record.local,name:'Borrador anterior'}},b.next),b.state);
 assert.equal(c.planSyncRecoverDebt({...b.state,_planSync:{...b.state._planSync,conflicts:[]}},b.record,b.next).debts.length,0);
 assert.equal(c.planSyncRecoverDebt(b.state,b.record,{...b.next,id:'another-debt'}),b.state);
 const occupied={...b.state,debts:[copy(b.original)]};assert.equal(c.planSyncRecoverDebt(occupied,b.record,b.next),occupied);
 const foreign={...b.state,_historyOwner:'another-owner'};assert.equal(c.planSyncRecoverDebt(foreign,b.record,b.next),foreign);
 for(const restoredAt of [undefined,null,'',17]){const next={...b.next,restoredAt};if(restoredAt===undefined)delete next.restoredAt;assert.equal(c.planSyncRecoverDebt(b.state,b.record,next),b.state);}
});

test('explicit recovery survives the old tombstone even with identical money, and a subsequent deletion still converges',()=>{
 const c=logic(),b=deletedDebtDraft(),next={...copy(b.original),restoredAt:'2026-10-25T00:06:00.000Z'},recovered=c.planSyncRecoverDebt(b.state,b.record,next);
 assert.equal(recovered.debts.length,1);assert.equal(recovered._planSync.conflicts.length,0);const pulled=c.planSyncPull(recovered,{fixed:fixed(),debts:[],debtDeleted:[copy(b.original)]},owner,'r-after-recovery',false);assert.ok(pulled);assert.deepEqual(copy(pulled.debts),[next]);
 const state={...recovered,...pulled},sent=c.slimForCloud(state),acked=c.planSyncAck(state,owner,sent,'r-after-recovery','r-recovery-ack');c.mcSaveRaw('micartera_v3',acked);const loaded=c.mcLoadRaw('micartera_v3');assert.deepEqual(copy(loaded.debts),[next]);
 const removed=c.planSyncDeleteDebt(loaded,b.record.id);assert.equal(removed.debts.length,0);assert.ok(removed.debtDeleted.some(row=>row.restoredAt===next.restoredAt));
 const stale=c.planSyncPull(loaded,c.slimForCloud(removed),owner,'r-after-second-delete',false);assert.ok(stale);assert.equal(stale.debts.length,0);assert.equal(stale._planSync.conflicts.length,0);
});

const ticks=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function pullBank(){
 const c=logic(),updates=[],writes=[],notices=[],reads=[];
 let app=fs.readFileSync(new URL('../src/modules/11-app-main.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
 if(process.env.FIN04B_MUTANT==='invalid-plan-abort'){assert.ok(app.includes('read.commit(false);'),'invalid Plan abort mutation anchor');app=app.replace('read.commit(false);','void 0;');}
 function block(token){const mask=codeMask(app),start=mask.indexOf(token);assert.ok(start>=0,token);let end=mask.indexOf('{',start)+1,n=1;for(;n;end++){if(mask[end]==='{')n++;else if(mask[end]==='}')n--;}return app.slice(start,end)+';';}
 const initial={budget:100,accounts:[],investments:[],debts:debts(),fixed:fixed(),expenses:[],goals:[],settings:{},_savedAt:100,_historyOwner:owner};
 Object.assign(c,{state:initial,stateRef:{current:initial},cloudReadRef:{current:null},cloudPullRef:{current:null},cloudUpdatedAtRef:{current:null},cloudMergeKey:{current:Symbol('merge')},pullOkRef:{current:null},sessionRef:{current:{user:{id:owner}}},obAbsorbedWriteBlocked:{current:false},
  cloud:{pullState:()=>new Promise((resolve,reject)=>reads.push({resolve,reject})),pushState:async(u,s,revision)=>{writes.push({u,s,revision});return {updated_at:'r-ack'};}},
  set:f=>updates.push(f),setStateRaw:f=>updates.push(f),syncCloudExpenses:()=>Promise.resolve(),reservaMensualAlDia:()=>{},showToast:m=>notices.push(m),mcBootReady:()=>{},navigator:{onLine:true},setTimeout,clearTimeout});
 const names=['state','stateRef','cloudReadRef','cloudPullRef','cloudUpdatedAtRef','cloudMergeKey','pullOkRef','sessionRef','obAbsorbedWriteBlocked','cloud','set','setStateRaw','syncCloudExpenses','reservaMensualAlDia','showToast','mcBootReady','navigator','setTimeout','clearTimeout'];
 const factory=vm.runInContext('(function('+names.join(',')+'){'+block('const pushAppState=function(')+block('const syncFromCloud=function(')+block('const commitCloudRead=function(')+'return {send:pushAppState,sync:syncFromCloud,commit:function(next){state=next;commitCloudRead();}};})',c);
 Object.assign(c,factory(...names.map(k=>c[k])));
 return {c,reads,writes,notices,start:()=>c.sync(c.sessionRef.current),evaluate:()=>updates.map(f=>f(c.state)),flush(){for(const f of updates.splice(0))c.state=f(c.state);c.stateRef.current=c.state;c.commit(c.state);},initial};
}

test('invalid Plan pull settles after commit, warns, and allows the next valid pull and CAS',async()=>{
 const b=pullBank(),local=b.c.state,first=b.start();let settled=false;first.then(()=>{settled=true;},()=>{settled=true;});
 assert.equal(b.reads.length,1);const bad={...copy(local),fixed:fixed().concat(fixed()),_savedAt:200};b.reads[0].resolve({data:bad,updated_at:'r-invalid'});await ticks();
 const count=b.notices.length;b.evaluate();b.evaluate();assert.equal(b.notices.length,count,'discarded render cannot emit notices');assert.equal(b.writes.length,0);assert.equal(b.c.cloudReadRef.current,null);
 b.flush();await ticks();assert.equal(settled,true,'invalid Plan must resolve or reject its flight');assert.equal(b.c.cloudPullRef.current,null,'invalid Plan cannot retain the pull lock');assert.equal(await b.c.pullOkRef.current,false);assert.ok(b.notices.length>count,'invalid Plan warning must be visible after commit');
 assert.equal(b.c.state.fixed,local.fixed);assert.equal(b.c.state.debts,local.debts);assert.equal(b.writes.length,0);
 const second=b.start();assert.equal(b.reads.length,2,'fresh retry must issue a new GET');const good={...copy(local),fixed:[{...fixed()[0],day:29}],_savedAt:200};b.reads[1].resolve({data:good,updated_at:'r-valid'});await ticks();b.flush();await second;
 assert.equal(b.c.cloudPullRef.current,null);assert.equal(b.c.cloudReadRef.current.ready,true);assert.equal(b.c.cloudReadRef.current.valid,true);assert.equal(b.c.cloudUpdatedAtRef.current,'r-valid');assert.equal(b.c.state.fixed[0].day,29);
 const edit={...b.c.state,budget:101};await b.c.send(owner,edit);b.flush();assert.equal(b.writes.length,1);assert.equal(b.writes[0].revision,'r-valid');assert.equal(b.writes[0].s.budget,101);assert.equal(Math.round(b.writes[0].s.fixed[0].amount*100),4237);assert.equal(Math.round(b.writes[0].s.debts[0].value*100),120023);
});
