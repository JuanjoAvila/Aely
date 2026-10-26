import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';

const root=new URL('../',import.meta.url),baseSHA='dca4c71c640e3ebbc26256f9e79572fdda94e39e';
const html=fs.readFileSync(process.env.FIN19_HTML||new URL('public/index.html',root),'utf8');
const baseHtml=execFileSync('git',['show',baseSHA+':public/index.html'],{cwd:root,encoding:'utf8',maxBuffer:8e6});
const base=loadPureLogic(baseHtml),c=loadPureLogic(html),plain=x=>JSON.parse(JSON.stringify(x));
const cents=rows=>rows.reduce((n,e)=>n+Math.round(Number(e.amount)*100),0);
const row=(id,extra={})=>({id,date:'2026-10-19T12:00:00.000Z',amount:3.20,merchant:'Compra sintetica R2',category:'otros',source:'ob',ent:'sabadell',...extra});
const wire=e=>({id:e.id,fecha:e.date,importe:e.amount,comercio:e.merchant,cat:e.category,source:e.source==='wallet'?'wallet':e.source==='macrodroid'?'macrodroid':'ob:'+e.ent+(e.extId?'#ref'+e.extId:'')+(e.obAcc?'#acc'+e.obAcc:''),nota:e.note,nota_edit:e.noteEdited,no_card:e.noCard});
function permutations(rows){return rows.length===1?[rows]:rows.flatMap((e,i)=>permutations(rows.filter((_,j)=>i!==j)).map(rest=>[e,...rest]));}
const sum=rows=>({count:rows.length,cents:cents(rows),rows:plain(rows)});
const merge=(api,kind,a,b)=>api[kind](a,b).list;
function deletion(api,source,rows,target){
 const disk=new Map();api.localStorage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,String(v)),removeItem:k=>disk.delete(k)};api.window.localStorage=api.localStorage;
 let state={expenses:plain(rows),deleted:[],deletedAt:{},gemelos:[],accounts:[]};
 const start=source.indexOf('  const delExpense=function(e){'),end=source.indexOf('  /* Posible repetido OB',start);assert.ok(start>=0&&end>start);
 const factory=vm.runInContext('(function(state,set,cloud){const keyOfE=keyOfExpense,undoTimerRef={current:null},undoDeleteRef={current:null};const setUndoDelete=function(){},setTimeout=function(){return 1;},clearTimeout=function(){};'+source.slice(start,end)+'return {del:delExpense,undo:undoLastDelete};})',api);
 const control=factory(state,fn=>{state=fn(state);},{enabled:()=>false});control.del(state.expenses.find(e=>e.id===target));
 const visible=s=>s.expenses.filter(e=>!api.expenseIsTombstoned(e,api.expenseDeletedSet(s)));
 const immediate=sum(visible(state)),remote=plain(state);
 api.mcSaveRaw('synthetic-fin19-r2',state);const saved=api.mcLoadRaw('synthetic-fin19-r2');
 assert.deepEqual(plain(saved.deleted),plain(state.deleted),'real split persistence retains tombstones');assert.ok(disk.has('synthetic-fin19-r2_exp'));
 state={...saved,...api.lapidasUnion(saved,remote)};
 const incoming=rows.map(e=>api.expenseFromRow(wire(e))).filter(e=>!api.expenseIsTombstoned(e,api.expenseDeletedSet(state)));
 state={...state,expenses:api.mergeExpensesFromCloud(state.expenses,incoming).list};const afterPull=sum(visible(state));
 control.undo();state={...state,...api.lapidasUnion(state,remote)};
 return {immediate,afterPull,undo:sum(visible(state)),deleted:saved.deleted,deletedAt:saved.deletedAt};
}
function matrix(api,source){
 const cases={wallet:[],noticeTwoAccounts:[],legacy:[],deletion:[]};
 const fixtures={
  wallet:[api.expenseFromRow(wire(row('wallet',{source:'wallet',ent:undefined}))),row('bank',{obAcc:'account-a'})],
  noticeTwoAccounts:[row('notice',{source:'macrodroid',ent:'trade_republic'}),row('account-a',{ent:'trade_republic',obAcc:'account-a',extId:'ref-a'}),row('account-b',{ent:'trade_republic',obAcc:'account-b',extId:'ref-b'})],
  legacy:[row('legacy'),row('cloud',{obAcc:'account-a'})],
 };
 for(const [name,rows] of Object.entries(fixtures))for(const ordered of permutations(rows))for(const kind of ['mergeExpenses','mergeExpensesFromCloud'])for(let split=0;split<=ordered.length;split++){
  const inputs=plain(ordered),out=merge(api,kind,ordered.slice(0,split),ordered.slice(split)),repeat=merge(api,kind,out,[...ordered].reverse());
  cases[name].push({kind,split,input:inputs,result:sum(out),repeat:sum(repeat),inputsUnchanged:JSON.stringify(plain(ordered))===JSON.stringify(inputs)});
 }
 const rows=[row('known-a',{obAcc:'account-a',note:'nota elegida',noteEdited:true,noCard:true,category:'deudas',debtId:'debt-synthetic'}),row('known-b',{ent:'caixabank',obAcc:'account-b',note:'otra nota',noteEdited:true,noCard:true})];
 for(const ent of ['caixabank','sabadell'])for(const ordered of permutations([rows[0],{...rows[1],ent}]))for(const target of rows.map(e=>e.id))cases.deletion.push({target,input:plain(ordered),...deletion(api,source,ordered,target)});
 return cases;
}
const old=matrix(base,baseHtml),current=matrix(c,html),evidence={baseSHA,base:old,current};
const evidenceAt=process.argv.indexOf('--evidence'),evidenceFile=evidenceAt>=0?process.argv[evidenceAt+1]:process.env.FIN19_EVIDENCE;if(evidenceFile)fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
for(const [name,expected] of [['wallet',320],['noticeTwoAccounts',640],['legacy',320]])test('FIN19 R2 '+name+': base/current cents, complete rows, all arrivals and repeats',()=>{
 for(let i=0;i<current[name].length;i++){
  const before=old[name][i],out=current[name][i];assert.equal(before.result.cents,expected,'base control '+name);
  assert.equal(out.result.cents,expected,name+' cents');assert.equal(out.repeat.cents,expected,name+' repeated cents');assert.equal(out.result.count,expected/320,name+' count');assert.ok(out.inputsUnchanged);
  if(name!=='noticeTwoAccounts')assert.deepEqual(out.result.rows,before.result.rows,'preserve complete base survivor '+name);
  else {
   // N ocupa UNA ranura; conserva el superviviente de base dentro de esa pareja.
   const group=e=>e.id==='account-b'?'b':'a',expected=[];
   for(const g of ['a','b'])expected.push(...merge(base,out.kind,out.input.slice(0,out.split).filter(e=>group(e)===g),out.input.slice(out.split).filter(e=>group(e)===g)));
   assert.deepEqual(out.result.rows.slice().sort((a,b)=>a.id.localeCompare(b.id)),plain(expected).sort((a,b)=>a.id.localeCompare(b.id)),'complete survivors, not A+B literal');
  }
  assert.equal(out.repeat.rows.length,out.result.rows.length,'repeat preserves cardinality');
  assert.deepEqual(out.repeat.rows.map(e=>e.id),out.result.rows.map(e=>e.id),'repeat preserves survivor UUIDs');
 }
});
test('FIN19 R2 deletion: actual UI delete, persisted filter, cloud pull and undo preserve other identity',()=>{
 for(let i=0;i<current.deletion.length;i++){
  const before=old.deletion[i],out=current.deletion[i];assert.equal(before.immediate.cents,0,'base bankless tombstone reproduces hidden survivor');
  assert.equal(out.immediate.cents,320,'delete only target');assert.equal(out.afterPull.cents,320,'persist/pull keeps survivor and no resurrection');assert.equal(out.undo.cents,640,'undo restores both');
  const other=out.input.find(e=>e.id!==out.target);assert.deepEqual(out.immediate.rows,[other]);assert.deepEqual(out.afterPull.rows,[other]);
  assert.deepEqual(out.undo.rows.slice().sort((a,b)=>a.id.localeCompare(b.id)),out.input.slice().sort((a,b)=>a.id.localeCompare(b.id)));
 }
});

test('FIN19 R2 existing notice keeps UUID and manual choices while absorbing one of two accounts',()=>{
 const n=row('notice',{source:'macrodroid',ent:'trade_republic',category:'deudas',debtId:'debt-local',note:'nota humana',noteEdited:true,noCard:true});
 for(const extId of [undefined,'ref'])for(const kind of ['mergeExpenses','mergeExpensesFromCloud'])for(const reverse of [false,true]){
  const banks=[row('bank-a',{ent:'trade_republic',obAcc:'account-a',extId}),row('bank-b',{ent:'trade_republic',obAcc:'account-b',extId})];if(reverse)banks.reverse();
  const out=merge(c,kind,[n],banks),notice=out.find(e=>e.id===n.id);assert.equal(cents(out),640);assert.equal(out.length,2);assert.ok(notice);
  for(const key of ['id','note','noteEdited','category','debtId','noCard'])assert.equal(notice[key],n[key],key);
  assert.equal(notice.ent,n.ent,'no invented bank');if(kind==='mergeExpenses')assert.equal(notice.obAcc,undefined,'no account written by grouping');
  const again=merge(c,kind,out,[...banks].reverse());assert.deepEqual(plain(again),plain(out),'stable complete repeated rows');
 }
});

test('FIN19 R2 new known tombstone differs by account, old ambiguous tombstone remains readable',()=>{
 const a=row('a',{obAcc:'account-a'}),b=row('b',{obAcc:'account-b'});
 const state=c.lapidaPon({},c.expenseDeletionKey(a),1),del=c.expenseDeletedSet(state);
 assert.equal(c.expenseIsTombstoned(a,del),true);assert.equal(c.expenseIsTombstoned(b,del),false);
 const legacy={[c.keyOfExpense(a)]:1};assert.equal(c.expenseIsTombstoned(a,legacy),true);assert.equal(c.expenseIsTombstoned(b,legacy),true);
 assert.equal(c.expenseIsTombstoned({...a,obAcc:undefined},del),true,'legacy row without account does not resurrect the deleted content');
 assert.deepEqual(plain(c.lapidasUnion(state,JSON.parse(JSON.stringify(state)))),plain(state));
});

test('FIN19 R2 mutation: unknown bucket restores all three overcounts in both real merges',()=>{
 const before='||bankContents.get(bank+"|"+key)||contents.get(key)||"";',after='||JSON.stringify([expenseBankOf(e)||"",String(e.obAcc||"")]);';
 assert.ok(html.includes(before),'mutation applies');const mutant=loadPureLogic(html.replace(before,after));
 const bad=matrix(mutant,html);
 for(const [name,expected] of [['wallet',320],['noticeTwoAccounts',640],['legacy',320]])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const witness=bad[name].find(x=>x.kind===kind&&x.result.cents>expected);assert.ok(witness,'killed unknown bucket '+name+' '+kind);
 }
});

test('FIN19 R2 mutation: bankless UI tombstone hides both; omitted scoped reader resurrects on pull',()=>{
 const rows=[row('known-a',{obAcc:'account-a'}),row('known-b',{obAcc:'account-b'})];
 const writer='const key=expenseDeletionKey(e), list=',reader='delSet[expenseDeletionKey(e)]||';
 assert.ok(html.includes(writer)&&html.includes(reader));
 const badWriter=html.replace(writer,'const key=keyOfE(e), list='),badReader=html.replace(reader,'');
 assert.equal(deletion(loadPureLogic(badWriter),badWriter,rows,'known-a').immediate.cents,0);
 assert.equal(deletion(loadPureLogic(badReader),badReader,rows,'known-a').afterPull.cents,640);
});

test('FIN19 R2 PR286 shared UUID does not erase a different known account',()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-000000000001',a=row(id,{obAcc:'a',extId:'shared'}),b=row(id,{obAcc:'b',extId:'shared'});
 for(const rows of [[a,b],[b,a]]){const out=c.mergeExpensesFromCloud(rows,rows,0,{});assert.equal(out.list.length,2);assert.equal(cents(out.list),640);assert.deepEqual(plain(out.list),plain(rows));}
});

test('FIN19 R2 partial bank identities preserve base reference and ordinal semantics',()=>{
 for(const obAcc of [undefined,'account-a'])for(const reverse of [false,true])for(const kind of ['mergeExpenses','mergeExpensesFromCloud']){
  const rows=[row('a',{extId:'ref-a',obAcc}),row('b',{ent:'caixabank',extId:'ref-b'})];if(reverse)rows.reverse();
  const before=merge(base,kind,[rows[0]],[rows[1]]),out=merge(c,kind,[rows[0]],[rows[1]]);
  assert.equal(cents(out),320);assert.deepEqual(plain(out),plain(before),'no account means base grouping, including bank references');
 }
});

test('FIN19 R2 scoped tombstone references survive diary and history without hiding another account',()=>{
 const gone=row('gone',{obAcc:'account-a',extId:'shared-ref'}),key=c.expenseDeletionKey(gone);
 const state={accounts:[{id:'daily',ent:'sabadell',role:'diario',spendFrom:true,value:1000}],expenses:[],settings:{expenseBanks:['sabadell']},fixed:[],debts:[],oneoffs:[],flows:[],investments:[],goals:[],assets:[],bankTx:[],obAccounts:[],deleted:[key],gemelos:c.pushGemelos([],[c.bankDeletionLink(gone)])};
 const tx=acc=>({id:gone.extId,ent:gone.ent,date:gone.date.slice(0,10),amount:gone.amount,merchant:gone.merchant,status:'BOOK',acc});
 assert.equal((c.importObExpenses(state,[tx('account-a')],[{aspsp:'Sabadell',syncFrom:'2026-10-01'}])||[]).length,0);
 const other=c.importObExpenses(state,[tx('account-b')],[{aspsp:'Sabadell',syncFrom:'2026-10-01'}])||[];assert.equal(cents(other),320);assert.equal(other[0].obAcc,'account-b');
 const deleted=c.histDeletedBookRefs(state),candidate={id:gone.extId,ent:gone.ent,amount:gone.amount,kind:'out',obAcc:'account-a'};
 assert.equal(c.histDeletedRefHit(deleted,candidate),true);assert.equal(c.histDeletedRefHit(deleted,{...candidate,obAcc:'account-b'}),false);
});
