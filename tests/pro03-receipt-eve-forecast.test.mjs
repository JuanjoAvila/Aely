import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";
import { codeMask } from "../scripts/beta-source-code.mjs";

const arg=name=>process.argv.find(a=>a.startsWith("--"+name+"="))?.slice(name.length+3);
const ref=arg("source-ref"), group=arg("group")||"all", selected=arg("case");
const root=new URL("../",import.meta.url), cents=n=>Math.round(n*100)||0;
const source=file=>{
  if(!ref) return fs.readFileSync(new URL(file,root),"utf8").replaceAll("\r\n","\n");
  assert.match(ref,/^[a-f0-9]{40}$/,"referencia completa de fuente");
  const r=spawnSync("git",["show",ref+":"+file],{cwd:root,encoding:"utf8",maxBuffer:32e6});
  assert.equal(r.status,0,"fuente git disponible: "+file);
  return r.stdout.replaceAll("\r\n","\n");
};
const baseMain=source("src/modules/11-app-main.js");
const screens=source("src/modules/14-v4-screens.js");
const order=JSON.parse(source("src/build-order.json"));
const pureHTML=source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>source("src/modules/"+f)).join("\n"));
function balanced(src,start,open,close){
  const mask=codeMask(src), begin=mask.indexOf(open,start);
  assert(begin>=start,"inicio del bloque real");
  let depth=1,end=begin+1;
  for(;depth&&end<mask.length;end++){ if(mask[end]===open) depth++; else if(mask[end]===close) depth--; }
  assert.equal(depth,0,"bloque real completo");
  return end;
}
function fn(src,name){
  const start=src.indexOf("function "+name+"(");
  assert(start>=0,"función real "+name);
  return src.slice(start,balanced(src,start,"{","}"));
}
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(){
  return {onboarded:true,accounts:[{id:"a",ent:"sabadell",role:"fijos",value:100,saldoLeidoAt:"2026-10-18T08:00:00Z"}],
    fixed:[{id:"r",name:"Recibo sintético",amount:42.37,freq:"mes",day:19,account:"sabadell"}],
    expenses:[],bankTx:[],debts:[],oneoffs:[],flows:[],deleted:[],investments:[],assets:[],aportaciones:[],obAccounts:[],settings:{}};
}
function harness(main=baseMain){
  const c=loadPureLogic(pureHTML);
  let clock=new Date(2026,9,18,12).getTime();
  c.Date=class extends Date { constructor(...args){ super(...(args.length?args:[clock])); } static now(){ return clock; } };
  c.localStorage={getItem:()=>null,setItem:()=>{}};
  vm.runInNewContext(fn(screens,"planRecibosBancos"),c);
  if(main.includes("function receiptEveProducer(")) vm.runInNewContext(fn(main,"receiptEveProducer"),c);
  const start=main.indexOf("const totals=useMemo(()=>{"), end=main.indexOf("\n\n  const budgetMonth=",start);
  assert(start>=0&&end>start,"callback real de totals");
  const totalsOf=vm.runInNewContext("(function(state,calendarDay){"+main.slice(start,end)+";return totals;})",c);
  let calendarSource;
  const memoStart=main.indexOf("const alertCalendar=useMemo(function(){");
  if(memoStart>=0){
    const memoEnd=main.indexOf("const alertCalendarOf=",memoStart);
    assert(memoEnd>memoStart);
    calendarSource=main.slice(memoStart,memoEnd)+"return alertCalendar;";
  } else {
    const old=main.indexOf("const alertCalendarOf=function(){");
    assert(old>=0,"calendario real de base");
    calendarSource=main.slice(old,balanced(main,old,"{","}"))+";return alertCalendarOf();";
  }
  const calendarFactory=vm.runInNewContext("(function(state,totals,calendarDay,localStorage,useMemo){"+calendarSource+"})",c);
  const reminderStart=main.indexOf("useEffect(function(){",main.indexOf("// Recordatorio de recibos:"));
  const nativeStart=main.indexOf("useEffect(function(){",main.indexOf("// Empuja el calendario de recibos del mes"));
  function effect(start,s,totals,cal,nat,storage,locked=false,auth=false){
    assert(start>=0,"efecto real");
    const text=main.slice(start,balanced(main,start,"(",")"))+";";
    const make=vm.runInNewContext("(function(state,locked,showAuth,totals,alertCalendar,alertCalendarOf,natPlugin,localStorage,useEffect){"+text+"})",c);
    let result;
    make(s,locked,auth,totals,cal,()=>cal,()=>nat,storage,(run,deps)=>{ result={run,deps}; });
    return result;
  }
  let memoValue,memoDeps;
  const h={c,main,clock:(y,m,d,hour=12)=>{clock=new Date(y,m-1,d,hour).getTime();},
    language:lang=>vm.runInNewContext("CURLANG="+JSON.stringify(lang),c),
    sandbox:on=>vm.runInNewContext("_mcSandboxPinned="+JSON.stringify(on),c),
    totals:s=>totalsOf(s,"2026-10-18"),
    calendar:(s,totals,storage={getItem:()=>null,setItem:()=>{}})=>calendarFactory(s,totals,"2026-10-18",storage,(f,deps)=>{
      if(!memoDeps||deps.some((d,i)=>d!==memoDeps[i])){ memoValue=f();memoDeps=deps; }
      return memoValue;
    }),
    memoDeps:()=>memoDeps,
    reminder:(...args)=>effect(reminderStart,...args),native:(...args)=>effect(nativeStart,...args),
    banks:(s,t)=>vm.runInNewContext("planRecibosBancos",c)(t,c.planChargesMonth(s,t.curMonth,t.curYear,t.today),null)};
  return h;
}
function evaluate(s=fixture(),main=baseMain){
  const h=harness(main), before=JSON.stringify(s),totals=h.totals(s),cal=h.calendar(s,totals);
  assert.equal(JSON.stringify(s),before,"lectura no muta estado");
  return {h,s,totals,cal,row:cal.charges.find(c=>c.id==="r")};
}
function expectForecast(s,min,coverage,main=baseMain){
  const r=evaluate(s,main);
  assert(r.row?.eve,"el calendario contiene el mensaje compartido");
  const bank=s.fixed[0].account,b=r.h.banks(s,r.totals).find(b=>b.bank===bank);
  assert(b?.known,"oráculo real Te llega conocido");
  assert.equal(cents(b.min),min,"oráculo independiente en céntimos");
  assert.equal(r.row.eve.coverage,coverage);
  assert(r.row.eve.body.includes(vm.runInNewContext("eur",r.h.c)(min/100)),"misma cifra exacta");
  assert.deepEqual([r.row.eve.v,r.row.eve.calculatedOn,r.row.eve.dueOn],[1,"2026-10-18","2026-10-19"]);
  return r;
}
function expectUnknown(s,main=baseMain){
  const r=evaluate(s,main);
  assert(r.row?.eve,"mensaje neutral explícito");
  assert.equal(r.row.eve.coverage,"unknown");
  assert.equal(r.row.eve.body,"Recibo sintético: mañana se cobran 42,37 €. Si algo no cuadra, aún estás a tiempo.");
  return r;
}
const cases=[];
function test(id,name,run,kind="forecast"){ cases.push({id,name,run,kind}); }
test("M01","cifra compartida, un solo descuento",()=>expectForecast(fixture(),5763,"enough"));
test("M02","falta un céntimo",()=>{const s=fixture();s.accounts[0].value=42.36;expectForecast(s,-1,"short");});
test("M03","cero exacto llega",()=>{const s=fixture();s.accounts[0].value=42.37;expectForecast(s,0,"enough");});
test("M04","banco del recibo, no principal",()=>{const s=fixture();s.accounts[0].value=10000;s.accounts.push({...s.accounts[0],id:"b",ent:"ing",value:100});s.fixed[0].account="ing";s.fixed[0].amount=150;expectForecast(s,-5000,"short");});
function income(s,day,amount=100){s.flows.push({id:"in",kind:"income",name:"Entrada sintética",to:"sabadell",day,amount});}
test("M05","nómina posterior no tapa mínimo negativo",()=>{const s=fixture();s.fixed[0].amount=150;income(s,25);const r=expectForecast(s,-5000,"short");assert.equal(cents(r.totals.mainProjected),5000);});
test("M06","mismo día sale antes de entrar",()=>{const s=fixture();s.fixed[0].amount=150;income(s,19);expectForecast(s,-5000,"short");});
function timeline(day){const s=fixture();s.fixed.push({id:"later",name:"Otro recibo",amount:120,freq:"mes",day:21,account:"sabadell"});income(s,day);return s;}
test("M07","entrada antes del segundo cargo",()=>expectForecast(timeline(20),3763,"enough"));
test("M08","entrada después del segundo cargo",()=>expectForecast(timeline(22),-6237,"short"));
test("M09","cuota sin día usa planCoverState",()=>{
  const s=fixture();
  // value es saldo BASE: el motor ya resta 10 por el día 1 legado de la cuota.
  // Para que «Tienes hoy» sea 100, la base es 110; no se cambia el recorrido real.
  s.accounts[0].value=110;
  s.debts=[{id:"d",name:"Deuda sintética",monthly:10,value:100,account:"sabadell"}];
  const r=expectForecast(s,4763,"enough");
  assert.equal(cents(r.totals.paidNetByBank.sabadell),-1000);
  assert.equal(cents(r.totals.bankBal.sabadell),10000);
  assert.equal(cents(r.totals.minByBank.sabadell),5763);
  assert.equal(11000-1000-4237-1000,4763,"base - pagado legado - recibo - ajuste compartido");
});
test("M10","saldo tecleado y movimientos no prueban lectura",()=>{for(const extra of [{},{bankTx:[{id:"b",ent:"sabadell",date:"2026-10-17",amount:1,status:"BOOK"}]},{lastBankSync:"2026-10-18T09:00:00Z"}]){const s=fixture();delete s.accounts[0].saldoLeidoAt;Object.assign(s,extra);expectUnknown(s);}});
test("M11","banco o cifra ausentes no se inventan",()=>{
  const s=fixture();delete s.fixed[0].account;expectUnknown(s);
  const absent=fixture();absent.accounts=[];expectUnknown(absent);
  for(const change of [t=>{delete t.bankBal.sabadell;},t=>{t.minByBank.sabadell=NaN;},t=>{t.minByBank.sabadell=Infinity;}]){
    const h=harness(),s=fixture(),t=h.totals(s);change(t);assert.equal(h.calendar(s,t).charges[0].eve.coverage,"unknown");
  }
});
test("M12","otra cuenta sin lectura invalida el banco",()=>{const s=fixture();s.accounts.push({id:"unread",ent:"sabadell",value:20,role:"fijos"});expectUnknown(s);});
test("M13","incidencias y cuentas rancias",()=>{
  expectForecast(fixture(),5763,"enough");
  for(const mutate of [s=>s.accounts[0].balanceStale=true,s=>s.bankIssues=[{ent:"sabadell"}],s=>s.obAccounts=[{ent:"sabadell",value:0,stale:true}]]){const s=fixture();mutate(s);expectUnknown(s);}
});
test("M14","lecturas reales OB, TR y cuenta adoptada",()=>{
  const adopted=fixture();delete adopted.accounts[0].saldoLeidoAt;adopted.accounts[0].balanceAt="2026-10-18T08:00:00Z";expectForecast(adopted,5763,"enough");
  const ob=fixture();delete ob.accounts[0].saldoLeidoAt;ob.accounts[0].bankUid="synthetic";ob.obBalAt={sabadell:"2026-10-18T08:00:00Z"};expectForecast(ob,5763,"enough");
  const tr=fixture();tr.fixed[0].account="trade_republic";tr.accounts[0].ent="trade_republic";delete tr.accounts[0].saldoLeidoAt;tr.lastTrSync="2026-10-18T08:00:00Z";tr.settings.brokersOn=["trade_republic"];expectForecast(tr,5763,"enough");
});
test("M15","pagado se omite sin escribir paidYm",()=>{
  const s=fixture();s.fixed[0].paidYm=2026*12+10;s.fixed[0].paidDay=18;
  const r=evaluate(s);assert.equal(r.row,undefined);assert.equal(s.fixed[0].paidYm,2026*12+10);
  const p=fixture();p.fixed.push({...p.fixed[0],id:"paid",day:17,paidYm:2026*12+10,paidDay:17});const before=JSON.stringify(p);evaluate(p);assert.equal(JSON.stringify(p),before);
});
test("M16","pausa, ocurrencia, fecha e importe",()=>{
  const paused=fixture();paused.fixed[0].pausedFrom=2026*12+10;paused.fixed[0].pausedUntil=2026*12+11;
  assert.equal(evaluate(paused).row,undefined);
  for(const mutate of [f=>f.day=null,f=>f.amount=0,f=>f.amount=-1,f=>{f.freq="anual";f.months=[11];}]){const s=fixture();mutate(s.fixed[0]);assert.equal(evaluate(s).row,undefined);}
});
test("M17","cuota de deuda comparte aviso",()=>{
  const s=fixture();s.fixed=[];s.debts=[{id:"d",name:"Cuota sintética",value:1000,monthly:42.37,day:19,account:"sabadell"}];
  const r=evaluate(s),row=r.cal.charges.find(c=>c.id==="debt_d");assert(row?.eve);assert.equal(row.eve.coverage,"enough");assert(row.eve.body.includes("57,63 €"));
  s.expenses=[{id:"paid",debtId:"d",category:"deudas",source:"ob",ent:"sabadell",date:"2026-10-18",amount:42.37}];assert.equal(evaluate(s).cal.charges.length,0);
});
test("M18","importe variable exacto de la ocurrencia",()=>{
  const s=fixture();s.accounts[0].value=200;s.fixed[0].schedule=[{m:10,day:19,amt:89.54},{m:11,day:19,amt:90.01}];
  const r=evaluate(s);assert.equal(cents(r.row.amount),8954);assert(r.row.eve.body.includes("89,54 €"));assert(r.row.eve.body.includes("110,46 €"));
});
const texts={
  es:{enough:"Recibo sintético: mañana se cobran 42,37 €. Saldo previsto: 57,63 €; te llega.",short:"Recibo sintético: mañana se cobran 42,37 €. Saldo previsto: -0,01 €; no te llega.",unknown:"Recibo sintético: mañana se cobran 42,37 €. Si algo no cuadra, aún estás a tiempo."},
  en:{enough:"Recibo sintético: 42,37 € will be charged tomorrow. Projected balance: 57,63 €; enough to cover it.",short:"Recibo sintético: 42,37 € will be charged tomorrow. Projected balance: -0,01 €; not enough to cover it.",unknown:"Recibo sintético: 42,37 € will be charged tomorrow. If something's off, there's still time."},
  ca:{enough:"Recibo sintético: demà es cobren 42,37 €. Saldo previst: 57,63 €; és suficient.",short:"Recibo sintético: demà es cobren 42,37 €. Saldo previst: -0,01 €; és insuficient.",unknown:"Recibo sintético: demà es cobren 42,37 €. Si alguna cosa no quadra, encara ets a temps."}
};
test("M19","nueve textos exactos, una línea",()=>{
  for(const lang of ["es","en","ca"])for(const coverage of ["enough","short","unknown"]){
    const h=harness(),s=fixture();h.language(lang);if(coverage==="short")s.accounts[0].value=42.36;if(coverage==="unknown")delete s.accounts[0].saldoLeidoAt;
    const row=h.calendar(s,h.totals(s)).charges[0];assert.equal(row.eve.coverage,coverage);assert.equal(row.eve.body,texts[lang][coverage]);assert(!/[\r\n\u2028\u2029]/.test(row.eve.body));
  }
});
function storage(){const items=new Map();return {getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v),items};}
async function flush(){await Promise.resolve();await Promise.resolve();}
test("M20","sellos nativos antes del aviso web, sin duplicados",async()=>{
  const {h,s,totals}=evaluate(),st=storage(),cal=h.calendar(s,totals,st),sent=[];
  let answer;const nat={showNotification:n=>{sent.push(n);return Promise.resolve();},setAlertData:()=>new Promise(r=>answer=r)};
  h.reminder(s,totals,cal,nat,st).run();assert.equal(sent.length,0);answer({fired:["r"]});await flush();assert.equal(sent.length,0);assert.equal(st.getItem("_rc1_r_2026-10"),"1");
  h.reminder(s,totals,cal,{showNotification:n=>{sent.push(n);return Promise.resolve();}},st).run();assert.equal(sent.length,0);
});
test("M21","mismo mensaje y fallback del puente, avisos previos intactos",async()=>{
  for(const mode of ["absent","reject","throw","resolve"]){
    const {h,s,totals}=evaluate(),st=storage(),cal=h.calendar(s,totals,st),sent=[],pushed=[];
    const nat={showNotification:n=>{sent.push(n);return Promise.resolve();}};
    if(mode!=="absent")nat.setAlertData=x=>{pushed.push(x);if(mode==="throw")throw Error("synthetic");return mode==="reject"?Promise.reject(Error("synthetic")):Promise.resolve({fired:[]});};
    h.reminder(s,totals,cal,nat,st).run();await flush();assert.equal(sent.length,1);assert.deepEqual(plain(sent[0]),{title:cal.charges[0].eve.title,body:cal.charges[0].eve.body});if(pushed.length)assert.equal(pushed[0],cal);
    if(nat.setAlertData){h.native(s,totals,cal,nat,st,true,true).run();await flush();assert.equal(pushed.at(-1),cal);}
  }
  const h=harness(),s=fixture();s.fixed[0].day=20;s.fixed[0].amount=100;const totals=h.totals(s),cal=h.calendar(s,totals),sent=[];
  h.reminder(s,totals,cal,{showNotification:n=>{sent.push(n);return Promise.resolve();}},storage()).run();assert.equal(sent[0].body,"Recibo sintético: 100,00 € el día 20");
});
test("M22","dependencias reales refrescan ambos efectos",()=>{
  for(const change of [s=>s.obBalAt={sabadell:"2026-10-18T09:00:00Z"},s=>s.lastTrSync="2026-10-18T09:00:00Z",s=>s.bankIssues=[{ent:"sabadell"}],s=>s.flows=[{id:"in",kind:"income",amount:50,to:"sabadell",day:19}],s=>s.oneoffs=[{id:"o",amount:10,account:"sabadell",day:19,month:10,year:2026}],s=>s.reciboNo=["synthetic-veto"],s=>s.deleted=["synthetic-deleted"]]){
    const h=harness(),s=fixture(),t=h.totals(s),first=h.calendar(s,t);change(s);const next=h.calendar(s,t);assert.notEqual(next,first,"nuevo contexto invalida memo real");
    assert(h.reminder(s,t,next,{},storage()).deps.includes(next));assert(h.native(s,t,next,{},storage()).deps.includes(next));
  }
  const h=harness(),s=fixture(),t=h.totals(s),first=h.calendar(s,t);h.language("en");assert.notEqual(h.calendar(s,t),first);
});
test("M23","mes y año no heredan previsión",()=>{
  const h=harness(),s=fixture();h.clock(2026,10,31);s.fixed[0].day=1;s.fixed[0].wait=2026*12+10;
  const t=h.totals(s),cal=h.calendar(s,t);assert.equal(cal.ym,"2026-10");assert(cal.charges.every(c=>c.eve.coverage==="unknown"));
  h.clock(2026,12,31);s.fixed=[{...s.fixed[0],wait:2026*12+12}];const dec=h.calendar(s,h.totals(s));assert.equal(dec.ym,"2026-12");assert(dec.charges.every(c=>c.eve.coverage==="unknown"));
});
test("M24","sandbox y cleanup no transportan ni mutan",async()=>{
  const {h,s,totals}=evaluate(),before=JSON.stringify(s),cal=h.calendar(s,totals),st=storage();let calls=0;
  const nat={showNotification:()=>{calls++;return Promise.resolve();},setAlertData:()=>{calls++;return Promise.resolve({});}};
  h.sandbox(true);h.reminder(s,totals,cal,nat,st).run();h.native(s,totals,cal,nat,st).run();assert.equal(calls,0);
  h.sandbox(false);let answer;nat.setAlertData=()=>new Promise(r=>answer=r);const cleanup=h.reminder(s,totals,cal,nat,st).run();cleanup();answer({});await flush();assert.equal(calls,0);assert.equal(JSON.stringify(s),before);
});
test("D01","fecha real coincide con el cálculo",()=>expectForecast(fixture(),5763,"enough"),"context");
test("D02","no se sella de hoy un totals antiguo",()=>{
  const h=harness(),s=fixture(),t=h.totals(s);t.today=17;const cal=h.calendar(s,t);assert.equal(cal.charges[0].eve.coverage,"unknown");
},"context");
test("D03","cargo posterior solo lleva texto neutral",()=>{const s=fixture();s.fixed[0].day=20;expectUnknown(s);},"context");
test("D04","contexto de año y mes se comprueba",()=>{
  for(const mutate of [t=>t.curYear=2025,t=>t.curMonth=9]){const h=harness(),s=fixture(),t=h.totals(s);mutate(t);const cal=h.calendar(s,t);assert(cal.charges.every(c=>c.eve.coverage==="unknown"));}
},"context");
test("D05","día imposible nunca autoriza suficiencia",()=>{const s=fixture();s.fixed[0].day=32;const r=evaluate(s);assert.equal(r.row.eve.coverage,"unknown");assert.equal(r.row.eve.dueOn,"");},"context");
test("D06","día local real, también con entorno UTC",()=>{
  const h=harness(),s=fixture();h.clock(2026,10,18,23);const t=h.totals(s),cal=h.calendar(s,t);assert.equal(cal.charges[0].eve.calculatedOn,"2026-10-18");assert.equal(cal.charges[0].eve.dueOn,"2026-10-19");
},"context");
test("D07","mañana de calendario al cambiar horario",()=>{
  const h=harness(),s=fixture();h.clock(2026,10,24,23);s.fixed[0].day=25;const r=h.calendar(s,h.totals(s));assert.equal(r.charges[0].eve.dueOn,"2026-10-25");assert.equal(r.charges[0].eve.coverage,"enough");
},"context");
test("D08","anterior fecha de cálculo pasa a neutral",()=>{
  const h=harness(),s=fixture(),t=h.totals(s);h.clock(2026,10,19);const r=h.calendar(s,t);assert.equal(r.charges[0].eve.calculatedOn,"2026-10-19");assert.equal(r.charges[0].eve.coverage,"unknown");
},"context");
test("D09","nombres con salto no rompen una línea",()=>{const s=fixture();s.fixed[0].name="Recibo\nsintético";const r=evaluate(s);assert(!/[\r\n\u2028\u2029]/.test(r.row.eve.body));assert.equal(r.row.name,"Recibo\nsintético");},"context");
test("D10","relectura no renueva el sello de aviso",async()=>{
  const h=harness(),s=fixture(),st=storage(),sent=[];const nat={showNotification:n=>{sent.push(n);return Promise.resolve();}};
  let t=h.totals(s);h.reminder(s,t,h.calendar(s,t,st),nat,st).run();s.accounts=[{...s.accounts[0],value:20}];t=h.totals(s);h.reminder(s,t,h.calendar(s,t,st),nat,st).run();assert.equal(sent.length,1);
},"context");
test("D11","respuesta del puente después de medianoche",async()=>{
  const {h,s,totals}=evaluate(),cal=h.calendar(s,totals),st=storage(),sent=[];let answer;
  const nat={showNotification:n=>{sent.push(n);return Promise.resolve();},setAlertData:()=>new Promise(r=>answer=r)};
  h.reminder(s,totals,cal,nat,st).run();h.clock(2026,10,19);answer({fired:[]});await flush();
  assert.equal(sent.length,0);assert.equal(st.getItem("_rc1_r_2026-10"),null);
},"context");
const mutants=[
  ["C01","banco principal",s=>s.replace("eveOf(c,e.account)",'eveOf(c,"sabadell")'),m=>{const s=fixture();s.accounts[0].value=10000;s.accounts.push({...s.accounts[0],id:"b",ent:"ing",value:100});s.fixed[0].account="ing";s.fixed[0].amount=150;expectForecast(s,-5000,"short",m);}],
  ["C02","doble descuento",s=>s.replace("min=cover.min;","min=cover.min-charge.amount;"),m=>expectForecast(fixture(),5763,"enough",m)],
  ["C03","saldo final",s=>s.replace("planCoverState(totals,bank,0,pending)","({min:totals.projectedByBank[bank]})"),m=>{const s=fixture();s.fixed[0].amount=150;income(s,25);expectForecast(s,-5000,"short",m);}],
  ["C04","sin lectura",s=>s.replace("&&saldoLeidoDelBanco(state,bank)>0",""),m=>{const s=fixture();delete s.accounts[0].saldoLeidoAt;expectUnknown(s,m);}],
  ["C05","sin cuota no fechada",s=>s.replace("planCoverState(totals,bank,0,pending)","planCoverState(totals,bank,0,[])"),m=>{const s=fixture();s.accounts[0].value=110;s.debts=[{id:"d",monthly:10,value:100,account:"sabadell"}];const r=expectForecast(s,4763,"enough",m);assert.equal(cents(r.totals.paidNetByBank.sabadell),-1000);assert.equal(cents(r.totals.bankBal.sabadell),10000);assert.equal(cents(r.totals.minByBank.sabadell),5763);assert.equal(11000-1000-4237-1000,4763);}],
  ["C06","calendario sin mensaje",s=>s.replace("c.eve=eveOf(c,e.account);","c.eve=undefined;"),m=>expectForecast(fixture(),5763,"enough",m)],
  ["DC01","fecha de cálculo ignorada",s=>s.replace(/const current=[^;]+;/,"const current=true;"),m=>{const h=harness(m),s=fixture(),t=h.totals(s);t.today=17;assert.equal(h.calendar(s,t).charges[0].eve.coverage,"unknown");}]
];
for(const [id,name,mutate,oracle] of mutants)test(id,"mata mutante "+name,()=>{
  const changed=mutate(baseMain);assert.notEqual(changed,baseMain,"mutación aplicada");let caught;
  try{oracle(changed);}catch(e){caught=e;}
  assert(caught instanceof assert.AssertionError,"mutante muerto por oráculo, no por fallo de arnés: "+(caught?.stack||"sobrevive"));
},"causal");
assert(["all","forecast","context","causal"].includes(group),"grupo conocido");
let count=0;
for(const t of cases){
  if(group!=="all"&&group!==t.kind||selected&&selected!==t.id)continue;
  await t.run();count++;console.log("PASS "+t.id+" "+t.name);
}
assert(count>0,"selección vacía");
console.log(JSON.stringify({suite:"pro03-receipt-eve-forecast",source:ref||"candidate",group,count,TZ:process.env.TZ||"system",retries:0}));
