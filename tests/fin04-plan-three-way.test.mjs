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
 const mutations={sum:['let source=right;\n      if(old && same(right,old))','let source=right;if(kind==="fixed"&&group[0]==="amount"&&old)source={...right,amount:left.amount+right.amount-old.amount};\n      if(old && same(right,old))'],split:['const groups=[financial];','const groups=financial.map(function(k){return [k];});'],ack:['fixed:goalSyncCopy(sent.fixed||[]),debts:goalSyncCopy(sent.debts||[])','fixed:goalSyncCopy(prev.fixed||[]),debts:goalSyncCopy(prev.debts||[])']};
 if(process.env.FIN04B_MUTANT){const [a,b]=mutations[process.env.FIN04B_MUTANT]||[];assert.ok(a&&source.includes(a),'mutant anchor');source=source.replace(a,b);}
 const hogar=fs.readFileSync(new URL('../src/modules/13-hogar.js',import.meta.url),'utf8'),hs=hogar.indexOf('function buildHouseholdSnapshot('),he=hogar.indexOf('\nfunction mergeHouseholdSnapshots',hs);vm.runInContext(hogar.slice(hs,he),c);
 const mask=codeMask(source);
 for(const m of source.matchAll(/^function (planSync\w+|mergePlanThreeWay)\(/gm)){const start=m.index,open=mask.indexOf('{',start);let end=open+1,n=1;for(;n;end++){if(mask[end]==='{')n++;else if(mask[end]==='}')n--;}vm.runInContext(source.slice(start,end),c);}
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
test('missing debt and partial arrays preserve edited and unchanged rows',()=>{
 const c=logic(),base=debts(),l=copy(base);l[0].value=1199.22;
 assert.equal(c.mergePlanThreeWay(base,l,[],'debts').rows,l);assert.deepEqual(copy(c.mergePlanThreeWay(base,[],l,'debts').rows),l);
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
test('derived payment fields never conflict and do not fabricate proofs or money',()=>{
 const c=logic(),base=fixed(),l=copy(base),r=copy(base);l[0].paidYm=2026*12+10;l[0].paidDay=12;r[0].wait=2026*12+10;
 const m=c.mergePlanThreeWay(base,l,r,'fixed');assert.equal(m.conflicts.length,0);const prev={fixed:l,debts:debts(),accounts:[],expenses:[],bankTx:[]};const next=c.planSyncDerived({...prev,fixed:m.rows},prev);assert.equal(Math.round(next.fixed[0].amount*100),4237);for(const k of ['paidYm','paidDay','wait','paymentProofs'])assert.ok(!Object.hasOwn(next.fixed[0],k));
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
