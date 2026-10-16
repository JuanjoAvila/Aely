import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createLogicSandbox,extractPureLogicSource} from "../scripts/load-pure-logic.mjs";

const option=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];},html=fs.readFileSync(option("--html")||"public/index.html","utf8");
let source=extractPureLogicSource(html);const mutation=option("--mutant");
const mutations={
 finishedNoBalance:{find:"&&debtBalance(d)<=0.005",replace:"",witness:"R2-residual-centimo-editable"},
 remaining:{find:"remaining<=0||",replace:"",witness:"R2-restantes-cero-con-balloon"},
 phantom:{find:"principal<=(remaining-1)*perMonth||",replace:"",witness:"fantasma-20"},
 residual:{find:"||principal>remaining*perMonth",replace:"",witness:"residual-8"},
 monthly:{find:"remaining=next.months-paid,perMonth=Math.round(am*100),principal=",replace:"remaining=next.months-paid,perMonth=Math.round(next.monthly*100),principal=",witness:"amort-explicita-rechaza-fantasma"},
 // Vuelve al fallo de beta 4.26.138.1: con solo la cuota cambiada no se validaba nada.
 soloCuota:{find:"if((termChanged||quotaChanged&&quotaIsAmort)&&next.months!=null){",replace:"if(termChanged&&next.months!=null){",witness:"panel-cuota-baja-rechazada"},
 // Revisión d139: cuota y amort ligadas se mueven juntas; distintas, la cuota no toca el calendario.
 amortQuieta:{find:"if(quotaIsAmort&&d.amort!=null) next.amort=next.monthly;",replace:"",witness:"alta-1000-3-cuota-340-ok"},
 todoLigado:{find:"const quotaIsAmort=d.amort==null||Math.abs(d.amort-(d.monthly||0))<=0.005;",replace:"const quotaIsAmort=true;",witness:"prestamo-familiar-cuota-200-ok"},
 nadaLigado:{find:"const quotaIsAmort=d.amort==null||Math.abs(d.amort-(d.monthly||0))<=0.005;",replace:"const quotaIsAmort=false;",witness:"alta-1000-3-cuota-100-rechazada"},
 balloon:{find:"principal=Math.round(balance*100)-Math.round((next.balloon||0)*100)",replace:"principal=Math.round(balance*100)",witness:"balloon-rechaza-fantasma"}
};
if(mutation){assert.ok(mutations[mutation],"Mutante conocido");const m=mutations[mutation];assert.equal(source.split(m.find).length-1,1,"Mutación aplicada exactamente una vez");source=source.replace(m.find,m.replace);}
const cents=x=>Math.round(x*100),plain=x=>JSON.parse(JSON.stringify(x)),anchor=2026*12+9-4,KEY="db_err_term_quota";
const debt=extra=>({id:"plazo-debt",name:"Deuda sintética",value:2000,monthly:200,months:10,day:15,asOf:anchor,original:2000,unknown:{keep:7},...extra});
function runtime(){let time=Date.parse("2026-10-14T12:00:00Z");class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}const c=createLogicSandbox({Date:Clock});vm.runInNewContext(source,c);return{c,at:(month,day)=>{time=Date.UTC(2026,month,day,12);},observed:null};}
function result(r,d,changes){const form={...r.c.debtEditDraft(d),...changes},before=JSON.stringify(d),draft=JSON.stringify(form),answer=r.c.debtEditResult(d,form);r.observed={error:answer.error??null,months:answer.item?.months,day:answer.item?.day,value:answer.item?.value,asOf:answer.item?.asOf,balanceCents:answer.item?cents(r.c.debtBalance(answer.item)):null,left:answer.item?r.c.debtLeft(answer.item):null,paid:answer.item?r.c.debtPaidCount(answer.item):null};assert.equal(JSON.stringify(d),before,"La deuda de entrada no se muta");assert.equal(JSON.stringify(form),draft,"El borrador no se muta");return answer;}
function reject(r,d,changes){const answer=result(r,d,changes);assert.equal(answer.error,KEY,"Debe rechazar la combinación incoherente con el error de la hoja");assert.equal(answer.item,undefined,"No hay estado para guardar al rechazar");}
function accept(r,d,changes,balance,left,total,last){const answer=result(r,d,changes);assert.equal(answer.error,undefined,"La combinación coherente debe guardarse");const n=answer.item;assert.equal(n.id,d.id);assert.deepEqual(plain(n.unknown),d.unknown);assert.equal(n.original,d.original);assert.equal(n.amort,d.amort);assert.equal(n.balloon,d.balloon);assert.equal(n.months,total);assert.equal(cents(r.c.debtBalance(n)),balance);assert.equal(r.c.debtLeft(n),left);let previous=balance,sum=0,drop=0;for(let i=0;i<left;i++){r.at(9+(n.day<=14?1:0)+i,n.day);const pending=cents(r.c.debtBalance(n));drop=previous-pending;assert.ok(drop>0,"Cada cuota restante amortiza principal real");sum+=drop;previous=pending;}assert.equal(previous,0,"No queda saldo sin pagar");assert.equal(sum,balance,"El calendario cancela exactamente el pendiente");assert.equal(drop,last,"La última cuota parcial y el pago final se conservan");}
const cases=[
 ["R2-residual-centimo-editable",r=>{const d=debt({value:1000,original:1000,monthly:333.33,amort:333.33,months:3,asOf:2026*12+9-3});assert.equal(r.c.debtPaidCount(d),3);assert.equal(cents(r.c.debtBalance(d)),1);const answer=result(r,d,{balance:"0"});assert.equal(answer.error,undefined,"Un céntimo pendiente sigue editable y puede corregirse a cero");assert.equal(r.c.debtEditFinished(d),false);assert.equal(answer.item.value,999.99);assert.equal(cents(r.c.debtBalance(answer.item)),0);assert.equal(answer.item.months,3);assert.equal(r.c.debtLeft(answer.item),0);for(const key of ["monthly","amort","asOf","day","original","unknown"])assert.deepEqual(plain(answer.item[key]),d[key]);}],
 ["R2-legado-pendiente-editable",r=>{const d=debt({value:2500,original:2500,asOf:2026*12+9-10});assert.equal(r.c.debtPaidCount(d),10);assert.equal(cents(r.c.debtBalance(d)),50000);reject(r,d,{monthly:"100"});accept(r,d,{monthly:"100",months:"15"},50000,5,15,10000);assert.equal(r.observed.asOf,d.asOf);}],
 // Paso del panel (beta 4.26.138.1): con plazo, una cuota que no encaja con lo pendiente en el
 // plazo de la hoja se rechaza; ni se guarda ni se alarga el plazo por debajo.
 ["panel-cuota-baja-rechazada",r=>reject(r,debt(),{monthly:"100"})],
 // Alta de la app 1000/3: amort 333,33 = cuota (3×333,33 = 999,99 por redondeo). Subir la cuota a
 // 340 la liga a la amortización y cuadra en 3 meses; bajarla a 100 no cabe y se rechaza.
 ["alta-1000-3-cuota-340-ok",r=>{const d=debt({value:1000,original:1000,monthly:333.33,amort:333.33,months:3,asOf:2026*12+9});const a=result(r,d,{monthly:"340"});assert.equal(a.error,undefined);const n=a.item;assert.equal(n.monthly,340);assert.equal(n.amort,340);assert.equal(n.months,3);assert.equal(cents(r.c.debtBalance(n)),100000);assert.equal(r.c.debtLeft(n),3);r.at(10,15);assert.equal(cents(r.c.debtBalance(n)),32000);r.at(11,15);assert.equal(cents(r.c.debtBalance(n)),0);}],
 ["alta-1000-3-cuota-100-rechazada",r=>reject(r,debt({value:1000,original:1000,monthly:333.33,amort:333.33,months:3,asOf:2026*12+9}),{monthly:"100"})],
 // Préstamo familiar: paga 197, amortiza 250. La cuota es solo lo que se paga: ni amort ni plazo.
 ["prestamo-familiar-cuota-200-ok",r=>{const d=debt({value:6100,original:6100,monthly:197,amort:250,months:24,asOf:2026*12+9});const a=result(r,d,{monthly:"200"});assert.equal(a.error,undefined);assert.equal(a.item.monthly,200);assert.equal(a.item.amort,250);assert.equal(a.item.months,24);assert.equal(cents(r.c.debtBalance(a.item)),cents(r.c.debtBalance(d)));}],
 // Hipoteca del fixture e2e (cuota 660,85 con intereses, amortiza 450,15): revisar la cuota no toca el plazo.
 ["hipoteca-fixture-cuota-700-ok",r=>{const d={id:"debt",name:"Préstamo sintético",value:176714.8,original:180000,monthly:660.85,amort:450.15,months:309,asOf:2026*12+9-40,day:1,apr:1.05};const a=result(r,d,{monthly:"700"});assert.equal(a.error,undefined);assert.equal(a.item.monthly,700);assert.equal(a.item.amort,450.15);assert.equal(a.item.months,309);assert.equal(cents(r.c.debtBalance(a.item)),cents(r.c.debtBalance(d)));}],
 ["solo-cuota-alta-rechazada",r=>reject(r,debt(),{monthly:"500"})],
 ["solo-cuota-limite-exacto-rechazada",r=>reject(r,debt(),{monthly:"240"})],
 ["cuota-saldo-rechazada",r=>reject(r,debt(),{monthly:"100",balance:"1100"})],
 ["cuota-dia-rechazada",r=>reject(r,debt(),{monthly:"100",day:"1"})],
 ["balloon-solo-cuota-rechazada",r=>reject(r,debt({value:2400.11,balloon:400.11}),{monthly:"100"})],
 ["solo-cuota-coherente-mismo-plazo",r=>accept(r,debt(),{monthly:"210"},120000,6,10,15000)],
 ["amort-explicita-solo-cuota-gobierna-amort",r=>accept(r,debt({monthly:300,amort:200}),{monthly:"100"},120000,6,10,20000)],
 ["R2-terminada-real-bloqueada",r=>{const d=debt({asOf:2026*12+9-10});assert.equal(cents(r.c.debtBalance(d)),0);assert.equal(r.c.debtEditFinished(d),true);const answer=result(r,d,{balance:"1"});assert.equal(answer.error,"db_finished_edit_hint");assert.equal(answer.item,undefined);}],
 ["R2-restantes-cero-con-balloon",r=>reject(r,debt({value:2100,balloon:100}),{months:"4",balance:"0"})],
 ["R2-restantes-negativas-con-balloon",r=>reject(r,debt({value:2300,balloon:300}),{months:"3",balance:"0"})],
 ["R2-restante-uno-coherente",r=>accept(r,debt({value:2100,balloon:100}),{months:"5",balance:"200"},20000,1,5,20000)],
 ["R2-saldo-cero-plazo-incoherente",r=>reject(r,debt(),{months:"5",balance:"0"})],
 ["R2-cuota-cero-plazo-incoherente",r=>reject(r,debt(),{months:"5",monthly:"0"})],
 ["fantasma-20",r=>reject(r,debt(),{months:"20",monthly:"100"})],
 ["fantasma-limite-17",r=>reject(r,debt(),{months:"17",monthly:"100"})],
 ["residual-8",r=>reject(r,debt(),{months:"8",monthly:"100"})],
 ["residual-un-centimo",r=>reject(r,debt({value:2000.01}),{months:"16",monthly:"100"})],
 ["coherente-16",r=>accept(r,debt(),{months:"16",monthly:"100"},120000,12,16,10000)],
 ["ultima-parcial-25-centimos",r=>accept(r,debt({value:2000.25}),{months:"17",monthly:"100"},120025,13,17,25)],
 ["ultima-parcial-bajo-limite",r=>accept(r,debt({value:1999.99}),{months:"16",monthly:"100"},119999,12,16,9999)],
 ["dia-propuesto-coherente",r=>accept(r,debt(),{months:"17",monthly:"100",day:"1"},120000,12,17,10000)],
 ["dia-propuesto-rechaza-residual",r=>reject(r,debt(),{months:"16",monthly:"100",day:"1"})],
 ["amort-explicita-rechaza-fantasma",r=>reject(r,debt({monthly:300,amort:200}),{months:"16",monthly:"100"})],
 ["amort-explicita-coherente",r=>accept(r,debt({value:1800,monthly:300,amort:200}),{months:"9",monthly:"100"},100000,5,9,20000)],
 ["balloon-rechaza-fantasma",r=>reject(r,debt({value:2400,balloon:400}),{months:"20",monthly:"100"})],
 ["balloon-coherente-con-centimos",r=>accept(r,debt({value:2400.11,balloon:400.11}),{months:"16",monthly:"100"},160011,12,16,50011)],
 ["restantes-cero-rechazado",r=>reject(r,debt(),{months:"4",monthly:"100"})],
 ...[[15,1,20],[1,15,20],[1,15,9]].map(([oldDay,newDay,age])=>["terminada-dia-"+oldDay+"-a-"+newDay+"-edad-"+age,r=>{const d=debt({asOf:2026*12+9-age,day:oldDay});assert.equal(cents(r.c.debtBalance(d)),0);const answer=result(r,d,{day:String(newDay)});assert.equal(answer.error,"db_finished_edit_hint");assert.equal(answer.item,undefined);assert.equal(r.c.debtLeft(d),0);assert.equal(r.c.debtActive(d),false);}]),
 ...["12","7",""].map(months=>["terminada-plazo-bloqueado-"+months,r=>{const d=debt({asOf:2026*12+9-9,day:1});const answer=result(r,d,{months});assert.equal(answer.error,"db_finished_edit_hint");assert.equal(answer.item,undefined);}]),
 ["terminada-nombre-editable",r=>{const d=debt({asOf:2026*12+9-9,day:1});const answer=result(r,d,{name:"Nombre corregido"});assert.equal(answer.error,undefined);assert.deepEqual(plain(answer.item),{...d,name:"Nombre corregido"});assert.equal(cents(r.c.debtBalance(answer.item)),0);assert.equal(r.c.debtLeft(answer.item),0);}],
 ...[["saldo",{balance:"100"}],["cuota",{monthly:"100"}],["TAE",{apr:"1,05"}]].map(([kind,changes])=>["terminada-bloquea-"+kind,r=>{const d=debt({asOf:2026*12+9-9,day:1});const answer=result(r,d,changes);assert.equal(answer.error,"db_finished_edit_hint");assert.equal(answer.item,undefined);assert.equal(cents(r.c.debtBalance(d)),0);assert.equal(r.c.debtLeft(d),0);}]),
 ["solo-plazo-fantasma-20",r=>reject(r,debt(),{months:"20"})],
 ["solo-plazo-residual-7",r=>reject(r,debt(),{months:"7"})],
 ["plazo-dia-fantasma",r=>reject(r,debt(),{months:"20",day:"1"})],
 ["plazo-dia-residual",r=>reject(r,debt(),{months:"7",day:"1"})],
 ["plazo-saldo-fantasma",r=>reject(r,debt(),{months:"20",balance:"1300,25"})],
 ["plazo-saldo-residual",r=>reject(r,debt(),{months:"7",balance:"1300,25"})],
 ["solo-plazo-coherente",r=>accept(r,debt({months:12}),{months:"10"},120000,6,10,20000)],
 ["plazo-dia-coherente",r=>accept(r,debt(),{months:"11",day:"1"},120000,6,11,20000)],
 ["plazo-saldo-parcial-coherente",r=>accept(r,debt(),{months:"11",balance:"1300,25"},130025,7,11,10025)],
 ["terminada-balloon-value-intacto",r=>{const d=debt({value:2400.11,balloon:400.11,asOf:2026*12+9-20});assert.equal(cents(r.c.debtBalance(d)),0);const answer=result(r,d,{day:"1"});assert.equal(answer.error,"db_finished_edit_hint");assert.equal(answer.item,undefined);assert.equal(r.c.debtLeft(d),0);}]

];
const selected=option("--case"),group=option("--group"),results=cases.filter(([id])=>(!selected||id===selected)&&(!group||group==="revision2"&&id.startsWith("R2-"))).map(([id,run])=>{const r=runtime();try{run(r);return{id,passed:true,observed:r.observed};}catch(e){return{id,passed:false,error:e.message,code:e.code,observed:r.observed};}});assert.ok(results.length,"Selección no vacía");const report={runtime:"Node con lógica financiera real y reloj fijo; datos sintéticos",mutation:mutation||null,requiredWitness:mutation?mutations[mutation].witness:null,results,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,browserExecuted:false};
if(process.env.OWN_PLAZO_EVIDENCE)fs.writeFileSync(process.env.OWN_PLAZO_EVIDENCE,JSON.stringify(report,null,2)+"\n");for(const r of results)console.log((r.passed?"PASS ":"FAIL ")+r.id+(r.error?"\n"+r.error:""));console.log(JSON.stringify({passed:report.passed,failed:report.failed,mutation:report.mutation,browserExecuted:false}));process.exitCode=report.failed?1:0;
