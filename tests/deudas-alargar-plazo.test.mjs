import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createLogicSandbox,extractPureLogicSource} from '../scripts/load-pure-logic.mjs';
let time=Date.parse('2026-10-19T12:00:00Z');class Clock extends Date{constructor(...a){super(...(a.length?a:[time]));}static now(){return time;}}
const htmlArg=process.argv.indexOf('--html'),c=createLogicSandbox({Date:Clock});vm.runInNewContext(extractPureLogicSource(fs.readFileSync(htmlArg<0?'public/index.html':process.argv[htmlArg+1],'utf8')),c);
const original={id:'extend',name:'Deuda sintética',value:2000,monthly:200,months:10,day:25,asOf:2026*12+5,original:2000,apr:0,paidYm:[24320],unknown:{keep:7}};
const plain=x=>JSON.parse(JSON.stringify(x)),cents=x=>Math.round(x*100);let count=0;
function check(name,fn){time=Date.parse('2026-10-19T12:00:00Z');fn();count++;console.log('PASS '+name);}
function extension(d,changes){const form={...c.debtEditDraft(d),...changes},before=JSON.stringify(d),draft=JSON.stringify(form),a=c.debtEditExtension(d,form);assert.equal(JSON.stringify(d),before);assert.equal(JSON.stringify(form),draft);return {form,a};}
for(const [name,extra,payment,months,last]of [
 ['zero',{},'100',16,10000],['legacy-null',{apr:null},'100',16,10000],['explicit-amort',{amort:200},'100',16,10000],
 ['cent-below',{},'99,99',17,12],['cent-above',{},'100.01',16,9989],['partial',{},'110',15,10000],
 ['balloon',{value:2300,balloon:300},'100',16,40000],['explicit-apr',{amort:200,apr:12},'100',16,10000]])check(name,()=>{
 const d={...original,...extra},{form,a}=extension(d,{monthly:payment});assert.equal(c.debtEditResult(d,form).error,'db_err_term_quota');assert.deepEqual(plain(a),{months});
 const next=c.debtEditResult(d,{...form,months:String(a.months)}).item;assert.ok(next);assert.equal(next.monthly,Number(payment.replace(',','.')));assert.equal(next.months,months);assert.equal(c.debtPaidCount(next),4);assert.equal(cents(c.debtBalance(next)),cents(c.debtBalance(d)));
 for(const k of ['id','day','asOf','original','apr','paidYm','unknown','balloon'])assert.deepEqual(next[k],d[k]);
 let previous=cents(c.debtBalance(next)),total=0,drop=0;for(let i=0;i<months-4;i++){time=Date.UTC(2026,9+i,25,12);const pending=cents(c.debtBalance(next));drop=previous-pending;total+=drop;previous=pending;assert.ok(drop>0);}assert.equal(previous,0);assert.equal(drop,last);assert.equal(total,cents(form.balance));
});
for(const [name,extra,changes]of [
 ['raise',{}, {monthly:'210'}],['same',{}, {monthly:'200'}],['zero-payment',{}, {monthly:'0'}],['rounds-to-zero',{}, {monthly:'0.001'}],
 ['invalid',{}, {monthly:'bad'}],['term-edited',{}, {monthly:'100',months:'11'}],['different-amort',{amort:150},{monthly:'100'}],['no-term',{months:null},{monthly:'100'}],
 ['finished',{value:800,asOf:2026*12+5,months:4},{monthly:'100'}]])check(name,()=>assert.equal(extension({...original,...extra},changes).a,null));
for(const apr of [0.01,1.05,12])check('unknown amort APR '+apr,()=>assert.deepEqual(plain(extension({...original,apr},{monthly:'100'}).a),{error:'db_extend_unknown'}));
check('positive draft APR',()=>assert.deepEqual(plain(extension(original,{monthly:'100',apr:'1.05'}).a),{error:'db_extend_unknown'}));
check('safe integer only',()=>assert.equal(extension({...original,value:90071992547409.92,asOf:2026*12+9},{monthly:'0.01'}).a,null));
console.log(count+' exact extension contracts passed');
