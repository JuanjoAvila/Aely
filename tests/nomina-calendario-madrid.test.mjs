import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {loadPureLogicFromFile} from "../scripts/load-pure-logic.mjs";

// Son fechas civiles de Madrid: las 23/25 horas no se sustituyen por un día de 86400000 ms.
const boundaries=[
  ["2024-02-29","2024-02-28T23:00:00Z","2024-02-29T23:00:00Z"],
  ["2026-03-01","2026-02-28T23:00:00Z","2026-03-01T23:00:00Z"],
  ["2026-03-29","2026-03-28T23:00:00Z","2026-03-29T22:00:00Z"],
  ["2026-03-30","2026-03-29T22:00:00Z","2026-03-30T22:00:00Z"],
  ["2026-10-01","2026-09-30T22:00:00Z","2026-10-01T22:00:00Z"],
  ["2026-10-25","2026-10-24T22:00:00Z","2026-10-25T23:00:00Z"],
  ["2026-10-26","2026-10-25T23:00:00Z","2026-10-26T23:00:00Z"],
  ["2027-01-01","2026-12-31T23:00:00Z","2027-01-01T23:00:00Z"]
];
if(!process.argv.includes("--zone-case")){
  let failed=0;
  for(const zone of ["UTC","Europe/Madrid","Atlantic/Canary"]){
    const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),"--zone-case"],{env:{...process.env,TZ:zone},encoding:"utf8"});
    process.stdout.write(result.stdout);process.stderr.write(result.stderr);
    console.log("nomina-calendario-madrid: "+zone+" EXIT "+result.status);
    if(result.status!==0)failed++;
  }
  assert.equal(failed,0,"las tres zonas comparten calendario y cifras");
}else{
  const c=loadPureLogicFromFile(), NativeDate=c.Date, results=[], failures=[];
  // Se ejecutan los bytes del escritor real; una fórmula copiada no vigilaría el puente.
  const app=fs.readFileSync(new URL("../src/modules/11-app-main.js",import.meta.url),"utf8");
  const piece=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a,"anclajes del escritor del widget");return app.slice(a,b);};
  const writer=piece("    const data={","    push();")+"    push();";
  const setup=piece("  let budW=wV2?","  const trAccW=")+piece("  const widgetBudgetLeft=","  const widgetSafeLiq=");
  const payload=(state)=>{
    let captured;c.__calendarState=state;c.__calendarCapture=data=>{captured=data;};
    vm.runInContext('(function(){const state=__calendarState,wV2=56,totals={},widgetSafeLiq=null,widgetCash=null,trAccW=null,wScope="synthetic",wC={current:[]},wRead={current:null};const nat={updateWidget(data){__calendarCapture(data);return Promise.resolve();}};'+setup+writer+'})()',c);
    delete c.__calendarState;delete c.__calendarCapture;assert.ok(captured,"updateWidget recibió la foto");return captured;
  };
  const check=(fn,label)=>{try{fn();}catch(error){failures.push({label,message:error.message});}};
  const seed=()=>({budget:500,settings:{budgetCycle:true,gTotalMode:"net",expenseBanks:["sabadell"]},
    accounts:[{id:"daily",ent:"sabadell",role:"diario",spendFrom:true,value:400}],expenses:[],fixed:[],debts:[],oneoffs:[],flows:[]});
  for(const [day,startText,endText]of boundaries){
    const start=Date.parse(startText),end=Date.parse(endText),salary={id:"salary",ent:"sabadell",date:day,amount:-1800,merchant:"NOMINA SINTETICA",status:"BOOK"};
    for(const offset of [-60000,60000]){
      const now=start+offset;
      c.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
      const state=seed();state.expenses=c.importObExpenses(state,[salary])||[];
      const payday=c.budgetPaydayOf(state),period=c.budgetPeriodOf(state);
      check(()=>assert.equal(!!payday,offset>0),day+" futura/contabilizada");
      if(offset<0){check(()=>assert.equal(state.expenses.length,0),day+" el futuro no entra");continue;}
      const purchase={id:"purchase",ent:"sabadell",date:day,amount:12.34,merchant:"COMPRA SINTETICA",status:"BOOK"};
      state.expenses=c.importObExpenses(seed(),[salary,purchase])||[];
      const dash=c.dashboardBudgetStats(state),bounds=c.presetBoundsMs("cycle",{},payday.start);
      const gastos=c.monthBudgetStats(state,null,null,null,c.gastosPeriodOf("cycle",bounds,c.budgetPaydayOf(state))),widget=payload(state);
      check(()=>assert.equal(payday.start.getTime(),start),day+" anclaMadrid");
      check(()=>assert.equal(period.todayEndMs,end),day+" finMadrid");
      check(()=>assert.equal(bounds.to+1,end),day+" listaMadrid");
      check(()=>assert.ok(state.expenses.every(e=>c.inBounds(c.dateMs(e.date),bounds))),day+" BOOK visibles");
      check(()=>assert.equal(dash.spent,12.34),day+" gasto real del día");
      check(()=>assert.equal(dash.remaining,487.66),day+" margen");
      check(()=>assert.equal(gastos.remaining,487.66),day+" Gastos mismo margen");
      check(()=>assert.equal(gastos.spent,dash.spent),day+" cabecera Gastos = Inicio");
      check(()=>assert.equal(widget.spent,dash.spent),day+" payload widget = Inicio");
      check(()=>assert.equal(widget.budgetLeft,dash.remaining),day+" widget mismo margen");
      results.push({day,start:payday.start.getTime(),end:period.todayEndMs,listEnd:bounds.to+1,spent:dash.spent,remaining:dash.remaining,gastosRemaining:gastos.remaining,gastosSpent:gastos.spent,widgetSpent:widget.spent,widgetRemaining:widget.budgetLeft});
      for(const status of ["PDNG","UNKNOWN"]){
        const pending=seed();pending.expenses=c.importObExpenses(pending,[{...salary,status}])||[];
        check(()=>assert.equal(c.budgetPaydayOf(pending),null),day+" veto "+status);
      }
      const repeated={...state,expenses:state.expenses.map(e=>({...e,possibleDup:true}))};
      check(()=>assert.equal(c.budgetPaydayOf(repeated),null),day+" veto duplicado");
    }
  }
  if(process.env.MC_MADRID_REPORT_DIR){fs.mkdirSync(process.env.MC_MADRID_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.MC_MADRID_REPORT_DIR,"calendar-"+process.env.TZ.replaceAll("/","_")+".json"),JSON.stringify({zone:process.env.TZ,results,failures},null,2));}
  console.log("nomina-calendario-madrid: "+process.env.TZ+" ocho fronteras, antes/después, BOOK/PDNG/UNKNOWN/duplicada; "+failures.length+" fallos");
  assert.deepEqual(failures,[],"ninguna frontera depende de la zona del navegador");
}
