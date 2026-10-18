import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadPureLogic} from '../scripts/load-pure-logic.mjs';
import {paymentFixture} from './fixtures/payment-ui.mjs';
const root=new URL('../',import.meta.url),source=f=>fs.readFileSync(new URL(f,root),'utf8');
const order=JSON.parse(source('src/build-order.json'));
const mutation=process.env.PRESENTATION_MUTANT?JSON.parse(fs.readFileSync(process.env.PRESENTATION_MUTANT,'utf8')):null;
let mutated=false;
const code=file=>{let s=source(file);if(mutation&&file===mutation.file){assert(s.includes(mutation.from));s=s.replace(mutation.from,mutation.to);mutated=true;}return s;};
const modules=new Map(order.map(f=>[f,code('src/modules/'+f)]));
const c=loadPureLogic(source('src/shell.html').replace('<!--MC_APP_SCRIPT-->',()=>[...modules.values()].join('\n')));
vm.runInNewContext(modules.get('14-v4-screens.js'),c);
if(mutation)assert(mutated);
c.Date=class extends Date{constructor(...a){super(...(a.length?a:['2026-10-18T12:00:00+02:00']));}};
c.React.createElement=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)});
const text=n=>n==null||typeof n==='boolean'?'':typeof n==='object'?(n.children||[]).map(text).join(' '):String(n);
const nodes=n=>n&&typeof n==='object'?[n,...(n.children||[]).flatMap(nodes)]:[];
const find=(n,id)=>nodes(n).find(x=>x.props['data-testid']===id);
const totals={curMonth:10,curYear:2026,today:18,mainBank:'sabadell',bankBal:{sabadell:800},minByBank:{sabadell:758},minDayByBank:{sabadell:25}};
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
for(const kind of ['debt','receipt'])check('R1 explicit '+kind+' mismatched, missing, absent and validated',()=>{
  const s=paymentFixture(kind==='debt'?'linked-debt':'receipt'),e=s.expenses[0],field=kind==='debt'?'debtId':'reciboId',name=kind==='debt'?s.debts[0].name:s.fixed[0].name,k=kind==='debt'?'debt':'fixed';
  const valid=c.expensePaymentRelationUI(s,e);assert.equal(c.expensePaymentLabelUI(s,e,k,valid),name);
  if(kind==='receipt')e.reciboId=s.fixed[0].id;
  e.amount=kind==='debt'?197.50:30.49;
  assert.equal(c.expensePaymentRelationUI(s,e),null);
  const before=JSON.stringify(s);assert.equal(c.expensePaymentLabelUI(s,e,k,null),name+' · sin confirmar');assert.equal(JSON.stringify(s),before);
  e[field]='missing';assert.equal(c.expensePaymentLabelUI(s,e,k,null),'—');
  delete e[field];assert.equal(c.expensePaymentLabelUI(s,e,k,null),'No');
});
for(const lang of ['es','en','ca']){
  vm.runInNewContext('CURLANG='+JSON.stringify(lang),c);
  const txt={es:['Se suma a lo que queda por pagar.','No se suma a lo que queda por pagar.','Por confirmar · 1','Todo pagado, salvo 1 cargo por confirmar.','Todo pagado, salvo 2 cargos por confirmar.'],en:['Included in the amount left to pay.','Not included in the amount left to pay.','To confirm · 1','Everything paid, except 1 charge awaiting confirmation.','Everything paid, except 2 charges awaiting confirmation.'],ca:['Se suma al que queda per pagar.','No se suma al que queda per pagar.','Per confirmar · 1','Tot pagat, excepte 1 càrrec per confirmar.','Tot pagat, excepte 2 càrrecs per confirmar.']}[lang];
  check('R2 distinct scopes, bank and separate count '+lang,()=>{
    const s=paymentFixture('debt');s.flows=[{id:'transfer',kind:'transfer',name:'Transferencia prevista',from:'sabadell',to:'revolut',amount:100,day:25}];
    const before=JSON.stringify(s),pack=JSON.stringify(c.planChargesMonth(s,10,2026,18));
    const tree=c.PlanBills({state:s,totals,simple:false}),pending=find(tree,'plan-due'),unconfirmed=find(tree,'plan-unconfirmed');
    assert(text(pending).includes(txt[0]));assert(text(unconfirmed).includes(txt[1]));assert(text(unconfirmed).includes(txt[2]));
    assert(!text(pending).includes('Transferencia prevista'));assert(text(find(tree,'plan-transfers')).includes('Transferencia prevista'));
    const row=nodes(unconfirmed).find(n=>n.props.className==='v4-charge');
    assert.equal(text(nodes(row).find(n=>n.props.className==='sub')),'Sabadell');
    assert.equal(JSON.stringify(c.planChargesMonth(s,10,2026,18)),pack);assert.equal(JSON.stringify(s),before);
  });
  for(const count of [1,2])check('R3 complete singular/plural '+lang+' '+count,()=>{
    const s=paymentFixture('debt');s.fixed=[];if(count===2)s.debts.push({...s.debts[0],id:'second',name:'Segunda'});
    const tree=c.PlanTab({state:s,totals,simple:true});assert(text(tree).includes(txt[count===1?3:4]));
  });
  check('R3 actual unpaid and fully paid remain distinct '+lang,()=>{
    const unpaid=paymentFixture('debt');const a=text(c.PlanTab({state:unpaid,totals,simple:true}));assert(!a.includes(txt[3]));
    const paid=paymentFixture('linked-debt');paid.fixed=[];const b=text(c.PlanTab({state:paid,totals,simple:true}));assert(!b.includes(txt[3]));
    assert(b.includes(vm.runInNewContext('tf("v4_plan_state_all_paid",{x:eur0(800),bank:"Sabadell"})',c)));
  });
}
console.log(checks+' presentation checks passed');
