import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {logicFunctions,scopeDependencies,mutateLogic,logicCalls,benignCalls,logicData,logicReads,scopeText,scopeDataDependencies,mutateData,benignData,codeMask,objectMembers} from "../scripts/beta-source-code.mjs";
import { betaRevision, betaNotes, betaDelivery, betaHistorical, betaCompatible } from "../scripts/beta-revisions.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
// Los contratos retirados del panel se prueban con su catálogo publicado, contra el código actual.
const historicalNotes=JSON.parse(execFileSync("git",["show","4403b252933410741a877eea59b85d812b2fe543:src/data/release-notes.json"],{encoding:"utf8",maxBuffer:5e6}));
const empty=[{v:"4.26.67",tandas:[]}];
const boot="inc-2709-01-arranque-red";
const modern=[{v:"4.26.69",tandas:[{id:boot}]}];
let failed=0;
function test(name,fn){ try{fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+"\n    "+e.message);} }
console.log("beta-sources");

// La revisión debe invalidarse si vuelve la columna ajena o cambia el periodo o la cifra.
test("Gastos90 vigila columna, ancho, periodo y cifras",()=>{
  const id="inc-0310-gastos-sin-limite",source=f=>read(f).replace(/\r\n/g,"\n"),before=betaRevision(id,source).web;
  for(const [file,from,to] of [
    ["src/modules/04-tab-gastos.js",'monthSummary.budgetApplies && React.createElement("div",{className:"v4-gastos-summary-budget"}', 'true && React.createElement("div",{className:"v4-gastos-summary-budget"}'],
    ["src/modules/04-tab-gastos.js",'const budgetApplies=preset==="month"||preset==="cycle";', 'const budgetApplies=true;'],
    ["src/modules/04-tab-gastos.js",'monthSummary.remaining==null?"—":eur(monthSummary.remaining)', 'monthSummary.remaining==null?"—":eur(0)'],
    ["src/modules/04-tab-gastos.js",'monthSummary.against)/monthSummary.budget', '0)/monthSummary.budget'],
    ["src/shell.html",'.v4-gastos-summary-main{flex:1 1 auto;min-width:0;}', '.v4-gastos-summary-main{flex:0 1 50%;min-width:0;}'],
  ]){
    assert.ok(source(file).includes(from),"el mutante debe tocar la fuente real");
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f)).web,before,from);
  }
});
if(process.argv.includes("--gastos-summary-only")) process.exit(failed?1:0);

// El mensaje promete lo que el transporte y los lectores financieros aplicaron realmente.
test("brókers89 vigila resultados, errores, mapeo y textos de cada idioma",()=>{
  const id="inc-0310-broker-resultados",source=f=>read(f).replace(/\r\n/g,"\n"),before=betaRevision(id,source).web;
  for(const [file,from,to] of [
    ["src/modules/11-app-main.js",'updatedB.push("Trade Republic")','updatedB.push("MyInvestor")'],
    ["src/modules/11-app-main.js",'updatedB.forEach(function(bank)','[].forEach(function(bank)'],
    ["src/modules/00-core.js",'if(error) throw error;\n      return data||null;','if(error) return null;\n      return data||null;'],
    ["src/modules/05-dialogs-inv.js",'function brokerSuggest(pos, investments){','function brokerSuggest(pos, investments){ throw new Error("mutante");'],
  ]){
    assert.ok(source(file).includes(from),"el mutante debe tocar la fuente real");
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f)).web,before,from);
  }
  const file="src/modules/01-i18n.js";
  for(const phrase of ["📈 {b} al día","📈 {b} up to date","📈 {b} al dia"]){
    assert.ok(source(file).includes(phrase));
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(phrase,phrase+" · mutante"):source(f)).web,before,phrase);
  }
});

test("Gastos84 vigila la ventana elegida y los lectores reales del dinero",()=>{
  const id="inc-0210-03-gastos-periodo",before=betaRevision(id,read).web;
  for(const [file,from,to] of [
    ["src/modules/04-tab-gastos.js","cycle:preset===\"cycle\"?cycle:null","cycle:null"],
    ["src/modules/04-tab-gastos.js","bounds.to+1","bounds.to"],
    ["src/modules/08-motor-bank.js","selectedPeriod||budgetPeriodOf(state,nowMs)","budgetPeriodOf(state,nowMs)"],
    ["src/modules/08-motor-bank.js","const byCat={};","const byCat={super:999};"],
  ]){
    assert.ok(read(file).includes(from),"mutante debe tocar fuente real");
    assert.notEqual(betaRevision(id,f=>f===file?read(f).replace(from,to):read(f)).web,before,from);
  }
});

// La revisión de dinero incluye lo que promete la confirmación: LANG es una excepción
// transitiva, así que estos textos necesitan alcance propio (NO-GO de META87, 3/10/2026).
for(const [lang,label] of [["es","Borrar regla"],["en","Delete rule"],["ca","Esborrar regla"]]){
  for(const key of ["rr_delete","rr_delete_q","rr_delete_sub"]){
    test("META87: texto "+key+" "+lang+" invalida su revisión",()=>{
      const file="src/modules/01-i18n.js",text=read(file),start=text.indexOf('  rr_delete:"'+label+'"');
      assert.ok(start>=0,"el mutante debe localizar el texto real "+lang);
      const end=text.indexOf("\n",start),line=text.slice(start,end);
      const changed=line.replace(new RegExp('('+key+':"[^"\\n]*)(")'),"$1 · mutante$2");
      assert.notEqual(changed,line,"el mutante debe cambiar el texto "+key);
      const before=betaRevision("inc-0310-01-meta-regla",read);
      assert.notEqual(betaRevision("inc-0310-01-meta-regla",f=>f===file?text.slice(0,start)+changed+text.slice(end):read(f)).web,before.web);
    });
  }
}
test("META87: tres rangos de diálogo no incluyen textos de creación",()=>{
  const scope=JSON.parse(read("scripts/beta-sources.json"))["inc-0310-01-meta-regla"];
  const ranges=scope.web.filter(x=>x.from&&x.from.includes("INC-0310-01"));
  assert.equal(ranges.length,3);
  for(const range of ranges){
    const text=read(range.file),block=scopeText(range,read),end=text.indexOf(range.to,text.indexOf(range.from));
    assert.ok(block.includes("rr_delete_sub:"));
    assert.ok(!block.includes("rr_name_ph:"));
    const start=text.indexOf("  rr_name_ph:",end),stop=text.indexOf("\n",start),line=text.slice(start,stop);
    const changed=line.replace(/(rr_name_ph:"[^"\n]*)(")/,"$1 · ajeno$2");
    assert.notEqual(changed,line);
    assert.equal(betaRevision("inc-0310-01-meta-regla",f=>f===range.file?text.slice(0,start)+changed+text.slice(stop):read(f)).web,betaRevision("inc-0310-01-meta-regla",read).web);
  }
});
if(process.argv.includes("--meta-dialog-only")) process.exit(failed?1:0);

// El alta de reglas (INC-0410): si vuelve a leerse mal el importe, se pierde un aviso o el
// editor deja de contar el estado del reparto, la revisión de la tanda tiene que moverse.
test("META91 vigila el lector de importes, los avisos, el estado y los céntimos",()=>{
  const id="inc-0310-01-meta-regla",source=f=>read(f).replace(/\r\n/g,"\n"),before=betaRevision(id,source).web;
  for(const [file,from,to] of [
    ["src/modules/08-motor-bank.js",'if(m[2] ? m[2].charAt(0)===mil : (seps.length===1 && mil===dec)) return null;','if(false) return null;'],
    ["src/modules/08-motor-bank.js",'if(reservaAlreadyApplied(state,income)) return { estado:"repartido", income:income };',''],
    ["src/modules/08-motor-bank.js",'if(!plan.plan.length) return { estado:"sinPlan", income:income };',''],
    ["src/modules/09-tab-debts-goals.js",'if(v==null || !(v>0)){ setErr("amount"); return; }','if(v==null) return;'],
    ["src/modules/09-tab-debts-goals.js",'if(form.kind==="pct" && v>100){ setErr("pct"); return; }',''],
    ["src/modules/09-tab-debts-goals.js",'return Math.round((n||0)*100)%100===0 ? eur0(n) : eur(n);','return eur0(n);'],
    ["src/modules/09-tab-debts-goals.js",'if(st.estado==="repartido") return tf("rr_st_applied",{d:d});','if(st.estado==="repartido") return "";'],
    ["src/modules/09-tab-debts-goals.js",'if(st.estado!=="pendiente") return null;','if(st.estado==="sinReglas") return null;'],
    ["src/modules/08-motor-bank.js",'if(cents>BigInt(Number.MAX_SAFE_INTEGER)) return null;',''],
    ["src/modules/08-motor-bank.js",'return Math.round(n*100)===Number(cents)?n:null;','return n;'],
    ["src/modules/08-motor-bank.js",'if(!rule || !reservaMetaActiva(state,rule.goalId)) return state;',''],
    ["src/modules/08-motor-bank.js",'return g && g.id===goalId && !g.done;','return g && g.id===goalId;'],
    ["src/modules/09-tab-debts-goals.js",'if(!reservaMetaActiva(state,form.goalId)){ setErr("goal"); return; }',''],
    ["src/modules/09-tab-debts-goals.js",'if(!reservaMetaActiva(state,sent.goalId)){ setSent(null); setForm(sent.form); setErr("goal"); setAdding(true); }',''],
    ["src/modules/09-tab-debts-goals.js",'setErr(""); setSent({id:r.id,goalId:r.goalId,form:form});','setErr(""); setForm(blank); setAdding(false);'],
    ["src/modules/09-tab-debts-goals.js",'if(sent&&sent.id===id) setSent(null); ',''],
    ["src/modules/09-tab-debts-goals.js",'if(!goals.length && !rules.length && !adding) return null;','if(!goals.length && !rules.length) return null;'],
    ["src/modules/09-tab-debts-goals.js",'(goals.length>0 || adding) && (adding','goals.length>0 && (adding'],
    ["src/modules/09-tab-debts-goals.js",'if(!sent.seen){ setSent(Object.assign({},sent,{seen:true}));','if(!sent.seen){ setSent(null);'],
    ["src/modules/00-core.js",'const eur  = (n)=> NF.format((n||0)*DISP.k)+" "+DISP.sym;','const eur  = (n)=> NF.format(0)+" "+DISP.sym;'],
    // Transporte mensual en App (revisión del coordinador, 4/10): aportar con el pull fallido,
    // saltarse el pull al volver, no repasar al volver o no asentar tras el pull del arranque.
    ["src/modules/11-app-main.js",'return pull.then(function(ok){ if(ok) set(function(s){ return applyReservaMensual(s); }); });','return pull.then(function(ok){ set(function(s){ return applyReservaMensual(s); }); });'],
    ["src/modules/11-app-main.js",'if(Math.abs(dy)<6 && y>8) return;','if(Math.abs(dy)<6) return;'],
    ["src/modules/11-app-main.js",'if(trackRef.current && e.currentTarget!==trackRef.current.children[tab]) return;',''],
    ["src/modules/11-app-main.js",'    syncFromCloud(sessionRef.current);\n    (pullOkRef.current||Promise.resolve(false)).then(fin,fin);','    set(function(s){ return applyReservaMensual(s); }); fin();'],
    ["src/modules/11-app-main.js",'    document.addEventListener("visibilitychange",reservaMensualAlVolver);\n',''],
    ["src/modules/11-app-main.js",'    reservaMensualAlDia(pullOkRef.current.then(mensualPuerta.vale));\n',''],
    // Nube con estado inválido: el pull «termina bien» tras rescatar lo local, y no debe asentar.
    // Y la validez es de cada pull: ni saltarse la lectura ni compartirla entre invocaciones.
    ["src/modules/11-app-main.js",'reservaMensualAlDia(pullOkRef.current.then(mensualPuerta.vale));','reservaMensualAlDia(pullOkRef.current);'],
    ["src/modules/11-app-main.js",'      mensualPuerta.lee(cloudPack);\n',''],
    ["src/modules/08-motor-bank.js",'return cloudPack.data===null || validCloudState(cloudPack.data);','return !cloudPack.data || validCloudState(cloudPack.data);'],
    ["src/modules/08-motor-bank.js",'return cloudPack.data===null || validCloudState(cloudPack.data);','return true;'],
    ["src/modules/08-motor-bank.js",'vale:function(ok){ return !!ok && leido; }','vale:function(ok){ return !!ok; }'],
    ["src/modules/08-motor-bank.js",'lee:function(cloudPack){ leido=reservaMensualNubeLeida(cloudPack); },','lee:function(cloudPack){ leido=true; },'],
    ["src/modules/11-app-main.js",'if(!disposed&&st&&st.isActive) reservaMensualAlVolver();','if(false) reservaMensualAlVolver();'],
    ["src/modules/11-app-main.js",'if(!reservaMensualPendiente(stateRef.current)) return;',''],
    ["src/modules/08-motor-bank.js",'function reservaMensualClave(nowMs){ return madridYmdParts(nowMs!=null?nowMs:Date.now()).ym; }','function reservaMensualClave(nowMs){ return "x"; }'],
    ["src/modules/08-motor-bank.js",'    if(hechos[id]) return;\n',''],
    ["src/modules/09-tab-debts-goals.js",'goalId:form.goalId,mensual:true};','goalId:form.goalId};'],
    ["src/modules/01-i18n.js",'rr_title:"Reservar dinero de tus ingresos"','rr_title:"Reservar dinero de tu nómina"'],
    ["src/modules/01-i18n.js",'rr_detect_t:"💰 Ingrés detectat: {x}"','rr_detect_t:"💰 Nòmina detectada: {x}"'],
    ["src/modules/01-i18n.js",'h_reserva:"Each rule sets its amount aside','h_reserva:"Each paycheck sets its amount aside'],
    ["src/modules/01-i18n.js",'rr_err_goal:"Elige una meta que siga activa."','rr_err_goal:"Elige una meta."'],
    ["src/modules/01-i18n.js",'rr_err_amount:"Escribe un importe','rr_err_amount:"Escribe algo'],
    ["src/modules/01-i18n.js",'rr_st_applied:"The income from {d} has already been split.','rr_st_applied:"The income from {d} is pending.'],
    ["src/modules/01-i18n.js",'rr_st_none:"Ara mateix no hi ha cap ingrés detectat','rr_st_none:"Hi ha un ingrés detectat'],
  ]){
    assert.ok(source(file).includes(from),"el mutante debe tocar la fuente real: "+from);
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f)).web,before,from);
  }
  // Y un texto de creación ajeno al alcance no la mueve.
  const ajeno='rr_name_ph:"Nombre (opcional';
  assert.ok(source("src/modules/01-i18n.js").includes(ajeno));
  assert.equal(betaRevision(id,f=>f==="src/modules/01-i18n.js"?source(f).replace(ajeno,'rr_name_ph:"Otro (opcional'):source(f)).web,before);
  // Tampoco el texto que vive pegado a la ayuda de la tarjeta, justo fuera de su rango.
  const lineas=source("src/modules/01-i18n.js").split("\n"),i=lineas.findIndex(l=>l.includes("INC-0410 es: límite de la ayuda del reparto."));
  assert.ok(i>0&&/^\s+[a-z_0-9]+:"/.test(lineas[i+1]),"no se encontró la clave siguiente a la ayuda");
  const vecina=lineas[i+1].slice(0,lineas[i+1].indexOf('"')+1);
  assert.equal(betaRevision(id,f=>f==="src/modules/01-i18n.js"?source(f).replace(vecina,vecina+"· "):source(f)).web,before,vecina);
});
// El guardado del estado (INC-0410): si vuelve a apuntarse dentro del updater, deja de colgar del
// commit o cambia cuándo se reescribe el histórico, tienen que moverse TODAS las revisiones cuyo
// código escribe estado (llama a `set`, directa o transitivamente). Los alcances de solo lectura,
// incluido el límite visual de metas de Inicio, no deben invalidarse por cambios de guardado.
test("PERSIST91: el guardado en el commit invalida toda tanda que escribe estado, y solo esas",()=>{
  const source=f=>read(f).replace(/\r\n/g,"\n"),registro=JSON.parse(read("scripts/beta-sources.json"));
  const marca="INC-0410 guardado: de aquí al límite";
  const dependientes=Object.keys(registro).filter(id=>registro[id].web.some(x=>x.from&&x.from.includes(marca)));
  const ajenas=Object.keys(registro).filter(id=>!dependientes.includes(id));
  assert.equal(dependientes.length,21);
  assert.ok(dependientes.includes("inc-0810-metas-editar-regla"),"editar una regla escribe con el set real y conserva el cierre de persistencia");
  assert.ok(dependientes.includes("inc-0710-gastos-mes-madrid"),"Gastos99 conserva la dependencia real de guardado de Expenses");
  assert.deepEqual(ajenas.slice().sort(),["beta-panel-veredictos","inc-0210-01-plan-cuota","inc-0410-inicio-tres-metas","inc-0710-appstate-listener-cleanup","inc-0710-banknotif-cleanup","inc-0810-dashboard-recents-memo","inc-2709-01-arranque-red","inc-2709-09-fechas-cache","inc-2709-12-cyber-fab","inc-2709-13-fab-contorno","inc-2709-14-preguntar","ops-0410-panel-cola","tr-descripcion-clasificacion"]);
  /* Quién depende del guardado lo decide el CÓDIGO, no la marca del registro (auditoría del
     coordinador, 4/10): se quita de cada alcance el bloque del guardado y se mira si lo que queda
     llama a `set` de App —las dependencias transitivas ya son unidades del alcance—. Tiene que
     coincidir, en los dos sentidos, con llevar el bloque. Se buscan LLAMADAS: la declaración del
     método `store.set(k,v){…}` no lo es, y contarla metió en el guardado al panel de revisión y
     a tres tandas que solo leen (clasificación, arranque, cuotas), reabriéndolas por un cambio
     ajeno. Cada tanda trajo además `store` y `_mem` con el bloque: van con él. */
  const delGuardado=x=>(x.from&&x.from.includes(marca))
    ||(x.file==="src/modules/00-core.js"&&(["mcPersistCommit","mcSaveRaw","mcSkipPersist","mcStateKey","mcSandbox","mcSandboxFlag"].includes(x.function)
      ||["EXP_SUFFIX","_mcSkipPersist","STATE_KEY_TEST","STATE_KEY_REAL","_mcSandboxPinned","store","_mem"].includes(x.data)));
  const escribe=id=>registro[id].web.some(x=>!delGuardado(x)&&/(^|[^\w.$])set\((?![\w\s,]*\)\s*\{)/.test(scopeText(x,source)));
  for(const id of Object.keys(registro)) assert.equal(escribe(id),dependientes.includes(id),
    id+(dependientes.includes(id)?" lleva el bloque del guardado sin llamar a set()":" llama a set() y debería depender del guardado"));
  for(const id of dependientes) for(const fn of ["mcPersistCommit","mcSaveRaw"])
    assert.ok(registro[id].web.some(x=>x.function===fn&&x.file==="src/modules/00-core.js"),id+" sin "+fn);
  const antes=Object.fromEntries(Object.keys(registro).map(id=>[id,betaRevision(id,source).web]));
  for(const [file,from,to] of [
    // Volver a apuntar el volcado dentro del updater: el fallo original.
    ["src/modules/11-app-main.js",'    return Object.assign({},next,{_savedAt:Date.now()});\n  }); },[]);','    const st=Object.assign({},next,{_savedAt:Date.now()}); persistRef.current.val=st; return st;\n  }); },[]);'],
    ["src/modules/11-app-main.js",'  useLayoutEffect(function(){\n    const prev=committedRef.current;','  useEffect(function(){\n    const prev=committedRef.current;'],
    ["src/modules/11-app-main.js",'    committedRef.current=state;\n',''],
    ["src/modules/11-app-main.js",'q.t=null; writeNow(q); },400);','q.t=null; writeNow(q); },0);'],
    ["src/modules/11-app-main.js",'if(typeof mcSkipPersist==="function" && mcSkipPersist()) return;',''],
    ["src/modules/11-app-main.js",'if(document.visibilityState==="hidden") flushPersist();',''],
    ["src/modules/00-core.js",'  if(prev===state) return false;\n',''],
    ["src/modules/00-core.js",'  if(prev.expenses!==state.expenses) p.exp=true;','  p.exp=true;'],
    ["src/modules/00-core.js",'  if(!p.t) p.t=schedule();','  p.t=schedule();'],
  ]){
    assert.ok(source(file).includes(from),"el mutante debe tocar la fuente real: "+from);
    const leer=f=>f===file?source(f).replace(from,to):source(f);
    for(const id of dependientes) assert.notEqual(betaRevision(id,leer).web,antes[id],id+" no se mueve con: "+from);
    for(const id of ajenas) assert.equal(betaRevision(id,leer).web,antes[id],id+" se mueve con: "+from);
  }
  // El panel sí depende de SU almacenamiento: cambiar `store.set` tiene que mover sus dos tandas.
  const almacen='  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ _mem[k]=v; } },';
  assert.ok(source("src/modules/00-core.js").includes(almacen),"el mutante debe tocar la fuente real: store.set");
  for(const id of ["beta-panel-veredictos","ops-0410-panel-cola"])
    assert.notEqual(betaRevision(id,f=>f==="src/modules/00-core.js"?source(f).replace(almacen,'  set(k,v){ _mem[k]=v; },'):source(f)).web,antes[id],id+" no se mueve al cambiar store.set");
});
if(process.argv.includes("--meta-alta-only")) process.exit(failed?1:0);


test("las tres correcciones UI vigilan también sus reglas y lectores",()=>{
  const cases=[
    ["inc-2709-12-cyber-fab","src/shell.html","position:relative;z-index:1;background:linear-gradient(160deg","position:relative;z-index:0;background:linear-gradient(160deg"],
    ["inc-2709-12-cyber-fab","src/shell.html","height:58px;border-radius:50%;margin-top:-26px","height:58px;border-radius:50%;margin-top:-10px"],
    ["inc-2709-14-preguntar","src/shell.html","padding-bottom:calc(52px + var(--safe-bottom));","padding-bottom:calc(60px + var(--safe-bottom));"],
    ["inc-2709-14-preguntar","src/shell.html",".v4-sheet.aely-help-sheet{",".aely-help-sheet{"],
    ["inc-2709-14-preguntar","src/modules/16-help-assistant.js","setKbPad(pad>24?Math.round(pad):0);","setKbPad(pad>240?Math.round(pad):0);"],
    ["inc-2709-10-perfil","src/modules/14-v4-screens.js","phone:p.phone||\"\"","phone:\"\""],
    ["inc-2709-10-perfil","src/modules/14-v4-screens.js","empty?\" pr-val-empty\":\"\"","empty?\" empty\":\"\""],
    ["inc-2709-10-perfil","src/shell.html",".profile-row .pr-val.pr-val-empty{",".profile-row .pr-val.empty{"],
    // El CSS vigilado no pinta nada si el elemento deja de llevar la clase: el vínculo está
    // en el render, y renombrarla ahí no movía el digest (NO-GO del revisor a 4c97b43d).
    ["inc-2709-12-cyber-fab","src/modules/11-app-main.js","{className:\"botnav-fab\",","{className:\"botnav-mas\","],
    ["inc-2709-14-preguntar","src/modules/16-help-assistant.js","{className:\"aely-help-composer\",","{className:\"aely-help-caja\","],
  ];
  for(const [id,file,from,to] of cases){
    assert.ok(read(file).includes(from),id+": mutante debe cambiar fuente real");
    const before=betaRevision(id,read);
    assert.notEqual(betaRevision(id,f=>f===file?read(f).replace(from,to):read(f)).web,before.web,id+": cambio UI sin vigilar");
  }
});

test("una tanda moderna sin alcance aborta; no reabre el legado",()=>{
  const missing=[{v:"4.26.99",tandas:[{id:"sin-alcance"}]}];
  assert.throws(()=>betaNotes(missing),/sin alcance/);
  assert.throws(()=>betaDelivery(missing),/sin alcance/);
  assert.equal(betaNotes([{v:"4.26.67",tandas:[{id:"legado"}]}])[0].tandas[0].codigo,undefined);
});
test("CRLF conserva la revisión UTF-8; cambiar la espera sí la invalida",()=>{
  const original=betaRevision(boot);
  assert.equal(betaRevision(boot,f=>read(f).replace(/\r?\n/g,"\r\n")).codigo,original.codigo);
  assert.notEqual(betaRevision(boot,f=>read(f).replace("const topeMs=2000;","const topeMs=2001;")).codigo,original.codigo);
});
test("el bootstrap omite código ausente sin fabricar recibos nativos o Edge",()=>{
  const receipt=betaDelivery(empty,f=>f.endsWith("10-app-components.js")?"sin panel ni selector":read(f));
  assert.equal(receipt.web["beta-panel-veredictos"],undefined);
  assert.equal(receipt.native,undefined);
  assert.equal(receipt.edge,undefined);
  assert.equal(receipt.web[boot],betaRevision(boot).web);
});
test("código activo ausente o alcance ambiguo abortan el build",()=>{
  assert.throws(()=>betaDelivery(modern,f=>f.endsWith("03-tab-dash.js")?"sin arranque":read(f)),/Bloque beta/);
  assert.throws(()=>betaDelivery(empty,f=>read(f)+(f.endsWith("03-tab-dash.js")?"\n  const [splashGone,setSplashGone]":"")),/Bloque beta/);
});
test("el recibo cambia con la fuente, nunca con un número de versión",()=>{
  assert.equal(betaDelivery(empty).web[boot],betaDelivery(modern).web[boot]);
  const changed=betaDelivery(empty,f=>read(f).replace("const topeMs=2000;","const topeMs=2001;"));
  assert.notEqual(changed.web[boot],betaDelivery(empty).web[boot]);
});

test("cada llamada de lógica, incluidas flechas y dependencias transitivas, mueve el digest",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),functions=logicFunctions(read);let total=0;
  for(const [id,scope] of Object.entries(scopes)){
    const before=betaRevision(id,read);
    for(const fn of scopeDependencies(scope,read,functions)){
      total++;
      const changed=betaRevision(id,f=>f===fn.file?mutateLogic(read(f),fn):read(f));
      assert.notEqual(changed.web,before.web,id+": dependencia sin vigilar "+fn.name);
    }
  }
  assert.ok(total>=561,"el inventario no puede desaparecer en silencio");
  console.log("    "+total+" dependencias mutadas, excepciones: "+Object.keys(benignCalls).join(","));
});

test("el lector ignora comentarios/textos/regex y detecta las funciones flecha",()=>{
  const text='/*\nfunction ficticia(){ return saldo(9); }\n*/\nfunction saldo(x){ return helper(x); }\nconst helper=x=>x+1;\n';
  const functions=logicFunctions(()=>text,["fixture"]);
  assert.equal(functions.size,2);
  assert.deepEqual([...logicCalls('helper(1); /* saldo(0) */ "saldo(2)"; /saldo(3)/; const s="saldo(4)";',functions)],["helper"]);
  assert.ok(mutateLogic(text,functions.get("helper")).includes("=>(null&&("));
});

test("referencias ampliadas rechazan HEAD/sha ajeno y mantienen el original",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),notes=structuredClone(historicalNotes);
  for(const id of ["tr-descripcion-clasificacion","inc-2809-02-ayuda-ciclo",boot]){
    const g=notes.flatMap(n=>n.tandas||[]).find(x=>x.id===id&&x.codigoDesde),scope=scopes[id];
    const original=JSON.stringify(g),expanded=betaHistorical(g,scope);
    assert.equal(JSON.stringify(g),original,"no modifica referencias originales");
    assert.equal(expanded.referenciaAnterior.codigoDesde,g.codigoDesde);
    for(const sha of ["HEAD","f".repeat(40)]){
      const changed=JSON.parse(JSON.stringify(scope));changed.auditoria.ampliada.sha=sha;
      assert.throws(()=>betaHistorical(g,changed),/histórica beta inválida/);
    }
    const forged=JSON.parse(JSON.stringify(scope));forged.auditoria.ampliada.codigo="f".repeat(64);
    assert.throws(()=>betaHistorical(g,forged),/histórica beta inválida/);
  }
});

test("un helper cambiado invalida TR frente al commit histórico ampliado",()=>{
  const notes=structuredClone(historicalNotes);
  const original=betaNotes(notes).flatMap(n=>n.tandas||[]).find(g=>g.id==="tr-descripcion-clasificacion"&&g.codigoDesde);
  const fn=logicFunctions(read).get("esTraspasoPropio");
  const changed=betaNotes(notes,f=>f===fn.file?mutateLogic(read(f),fn):read(f)).flatMap(n=>n.tandas||[]).find(g=>g.id===original.id&&g.codigoDesde);
  assert.notEqual(changed.codigo,changed.codigoDesde);
  assert.equal(changed.codigoDesde,original.codigoDesde,"la referencia no se repina al helper nuevo");
  assert.equal(changed.referenciaAnterior.codigoDesde,original.referenciaAnterior.codigoDesde);
  const raw=notes.flatMap(n=>n.tandas||[]).find(g=>g.id===original.id&&g.codigoDesde);
  const scope=JSON.parse(read("scripts/beta-sources.json"))[original.id];
  assert.throws(()=>betaHistorical({...raw,codigoDesde:changed.codigo,revisionesDesde:{web:changed.web,native:changed.native,edge:changed.edge}},scope),/histórica beta inválida/,"no permite pinchar la referencia original al helper de HEAD");
  assert.throws(()=>betaRevision(original.id,f=>f===fn.file?"sin función histórica":read(f)),/Bloque beta/);
});
test("los umbrales de categorías, notas y cuotas también invalidan la clasificación",()=>{
  const id="tr-descripcion-clasificacion",before=betaRevision(id,read);
  for(const marker of ["const CAT_NEUTRAS =", "const NOTE_MAX=", "const CUOTA_DIAS=", "const CUOTA_MESES="]){
    const after=betaRevision(id,f=>read(f).replace(marker,marker+" /* umbral mutado */"));
    assert.notEqual(after.web,before.web,marker);
  }
});
test("rechaza el repin coherente a HEAD aunque conserve el SHA histórico permitido",()=>{
  const notes=structuredClone(historicalNotes),scopes=JSON.parse(read("scripts/beta-sources.json")),id="tr-descripcion-clasificacion";
  const fn=logicFunctions(read).get("esTraspasoPropio"),changedRead=f=>f===fn.file?read(f).replace(/\r\n/g,"\n").replace(fn.text,fn.text.replace("{","{ return false;")):read(f);
  const revision=betaRevision(id,changedRead);
  const baseline=scopes[id].auditoria.ampliada;
  baseline.codigo=revision.codigo;baseline.revisiones=Object.fromEntries(Object.entries(revision).filter(([k])=>["web","native","edge"].includes(k)));
  assert.equal(baseline.sha,"17aeacc03f595412c044d276c900707cbbd008c8");
  assert.throws(()=>betaNotes(notes,changedRead,scopes),/no coincide con Git/);
  const unavailable=JSON.parse(read("scripts/beta-sources.json"));
  unavailable[id].auditoria.ampliada.scope.web=["src/modules/historico-ausente.js"];
  assert.throws(()=>betaNotes(notes,read,unavailable),/Fuente histórica beta no disponible/);
  const raw=notes.flatMap(n=>n.tandas||[]).find(g=>g.id===id&&g.codigoDesde);
  assert.throws(()=>betaHistorical(raw,JSON.parse(read("scripts/beta-sources.json"))[id],()=>{throw new Error("historia ausente");}),/historia ausente/);
});

test("cada dato leído transitivamente, incluidas cachés compartidas, mueve el digest",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),functions=logicFunctions(read),data=logicData(read);let total=0;
  for(const [id,scope] of Object.entries(scopes)){
    const before=betaRevision(id,read);
    for(const value of scopeDataDependencies(scope,read,functions,data)){
      total++;let changed;try{changed=betaRevision(id,f=>f===value.file?mutateData(read(f),value):read(f));}catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code),error.message);changed={web:"build abortado por ancla mutada"};}
      assert.notEqual(changed.web,before.web,id+": dato sin vigilar "+value.name);
    }
  }
  assert.ok(total>=160,"el inventario de datos no puede desaparecer");
  console.log("    "+total+" datos mutados, excepciones: "+Object.keys(benignData).join(","));
});
test("datos distingue propiedades, comentarios y textos; recoge múltiples inicializadores",()=>{
  const text='const A={n:1};\nvar CACHE=null, OTHER={};\nconst arrow=x=>x;\n';
  const data=logicData(()=>text,["fixture"]);
  assert.deepEqual([...data.keys()],["A","CACHE","OTHER"]);
  assert.deepEqual([...logicReads('A.n; obj.CACHE; {OTHER:2}; "CACHE"; /* OTHER */ CACHE;',data)],["A","CACHE"]);
  assert.ok(mutateData(text,data.get("OTHER")).includes("OTHER=0||{}"));
  assert.deepEqual([...logicReads("flag ? A : CACHE;",data)],["A","CACHE"]);
  const literal='const Z="Europe/Madrid";\n',strings=logicData(()=>literal,["strings"]);assert.ok(mutateData(literal,strings.get("Z")).includes('Z=0||"Europe/Madrid"'));
  assert.ok(!Object.hasOwn(benignData,"MC_TZ"));assert.ok(!Object.hasOwn(benignData,"DISP"));
});
test("zona horaria y días de gracia nuevos invalidan dinero sin repinar historia",()=>{
  const notes=structuredClone(historicalNotes),id="tr-descripcion-clasificacion",original=betaNotes(notes).flatMap(n=>n.tandas||[]).find(g=>g.id===id&&g.codigoDesde);
  const changed=betaNotes(notes,f=>read(f).replace('const MC_TZ="Europe/Madrid";','const MC_TZ="UTC";')).flatMap(n=>n.tandas||[]).find(g=>g.id===id&&g.codigoDesde);
  assert.notEqual(changed.codigo,original.codigo);assert.equal(changed.codigoDesde,original.codigoDesde);
  const before=betaRevision("inc-3009-01-cargos",read),after=betaRevision("inc-3009-01-cargos",f=>read(f).replace("const REC_GRACE=3;","const REC_GRACE=4;"));assert.notEqual(before.web,after.web);
});
test("la revisión de nómina incluye guardia, fecha, identidad, saldo y lectores reales",()=>{
  const id="inc-3009-nomina-anticipada", original=betaRevision(id);
  for(const [file,from,to] of [
    ["08-motor-bank.js",'function pickBankBalanceInfo(','function pickBankBalanceInfo( /* prioridad saldo */'],
    ["08-motor-bank.js",'function entFromAspsp(','function entFromAspsp( /* identidad banco */'],
    ["00-core.js",'const NOTE_MAX=','const NOTE_MAX= /* regla nota */'],
    ["00-core.js",'const CAT_NEUTRAS =','const CAT_NEUTRAS = /* gasto neutro */'],
    ["08-motor-bank.js",'const CUOTA_DIAS=','const CUOTA_DIAS= /* ventana cuota */'],
    ["08-motor-bank.js",'const CUOTA_MESES=','const CUOTA_MESES= /* ventana histórico */'],
    ["00-core.js",'const dayKey=','const dayKey= /* fecha */'],
    ["00-core.js",'const INGRESO_CAT =','const INGRESO_CAT = /* categoría */'],
    ["08-motor-bank.js",'if(status && status!=="BOOK") return;','if(false) return;'],
    ["08-motor-bank.js",'date>todayKey','false'],
    ["08-motor-bank.js",'timeZone:"Europe/Madrid"','timeZone:"UTC"'],
    ["08-motor-bank.js",'if(tx.id) e.extId=tx.id;','if(false) e.extId=tx.id;'],
    ["08-motor-bank.js",'function applyBankBalances(s, links){','function applyBankBalances(s, links){ /* cambio saldo */'],
    ["04-tab-gastos.js",'function lastPaydayOf(','function lastPaydayOf( /* cambio ancla */'],
    ["01-i18n.js",'function insumosSaldoGasto(','function insumosSaldoGasto( /* cambio saldo */'],
    ["11-app-main.js",'const add=importObExpenses(prev, txs);','const add=null;'],
    ["11-app-main.js",'  const totals=useMemo(()=>{','  const totals=useMemo(()=>{ /* lector saldo */'],
    ["07-tab-patri-fijos.js",'function Wealth(','function Wealth( /* cuentas visibles */'],
    ["04-tab-gastos.js",'const MovRow=React.memo(','const MovRow=React.memo( /* fila visible */'],
  ]){
    assert.ok(read("src/modules/"+file).includes(from),from+" existe");
    let changed=read("src/modules/"+file);
    if(to.includes("/*")){
      const fns=logicFunctions(read,["src/modules/"+file]),fn=[...fns.values()].find(x=>x.text.startsWith(from));
      const values=logicData(read,["src/modules/"+file]),value=[...values.values()].find(x=>x.text.includes(from));
      changed=fn?mutateLogic(changed,fn):value?mutateData(changed,value):changed.replace(from,from+(from.endsWith("{")?'throw new Error("mutante");':"null||"));
    }else changed=changed.replaceAll(from,to);
    assert.notEqual(betaRevision(id,f=>f.endsWith(file)?changed:read(f)).codigo,original.codigo,from);
  }
  assert.equal(betaRevision(id,f=>f==="src/modules/10-app-components.js"?read(f)+"\n// texto ajeno":read(f)).codigo,original.codigo);
});
test("Widget80 exige helpers v2 y vigila ACK, alcance y ventana",()=>{
  const id="inc-2909-01-widget-periodo",functions=logicFunctions(read,["src/modules/00-core.js","src/modules/01-i18n.js","src/modules/08-motor-bank.js","src/modules/04-tab-gastos.js"]),before=betaRevision(id,read);
  for(const name of ["widgetCoveredEvents","widgetScopeOf","dashboardBudgetStats","budgetPaydayOf","dateMs","inicioDeMesMs","expenseBankEnts"]){
    const fn=functions.get(name);assert.ok(fn,"helper vigente "+name);
    const after=betaRevision(id,f=>f===fn.file?mutateLogic(read(f),fn):read(f));
    assert.notEqual(after.web,before.web,name);
  }
  assert.throws(()=>betaRevision(id,f=>read(f).replace("function widgetCoveredEvents(","function coberturaAusente(")),/Bloque beta/);
});
test("Widget80 vigila datos de dinero y todos sus cinco archivos Java",()=>{
  const id="inc-2909-01-widget-periodo",scope=JSON.parse(read("scripts/beta-sources.json"))[id],before=betaRevision(id,read),data=logicData(read);
  assert.equal(scope.native.length,5);
  for(const file of scope.native){
    const after=betaRevision(id,f=>f===file?read(f).replace("package com.micartera.app;","package com.micartera.fixture;"):read(f));
    assert.notEqual(after.native,before.native,file);
  }
  for(const name of ["MC_TZ","CAT_NEUTRAS","REC_GRACE","ENT"]){
    const value=data.get(name);assert.ok(value,name);
    const after=betaRevision(id,f=>f===value.file?mutateData(read(f),value):read(f));
    assert.notEqual(after.web,before.web,name);
  }
  const period=scope.native.find(f=>f.endsWith("WidgetPeriod.java"));
  assert.notEqual(betaRevision(id,f=>f===period?read(f).replace("CONTRACT = 2","CONTRACT = 1"):read(f)).native,before.native);
});
test("Widget80 nuevo no repina historia ni fabrica entrega nativa",()=>{
  const id="inc-2909-01-widget-periodo",scopes=JSON.parse(read("scripts/beta-sources.json")),notes=structuredClone(historicalNotes);
  assert.equal(scopes[id].auditoria,undefined);
  const raw=notes.flatMap(n=>n.tandas||[]).find(g=>g.id===id);
  assert.equal(raw.codigoDesde,undefined);assert.equal(raw.desde,undefined);
  const built=betaNotes(notes).flatMap(n=>n.tandas||[]).find(g=>g.id===id);
  assert.ok(built.web&&built.native);assert.equal(built.edge,undefined);
  const delivery=betaDelivery(notes);
  assert.equal(delivery.web[id],built.web);assert.equal(delivery.native,undefined);assert.equal(delivery.edge,undefined);
  assert.throws(()=>betaNotes(notes,f=>f.endsWith("WidgetPeriod.java")?(()=>{throw new Error("Java ausente");})():read(f)),/Java ausente/);
  assert.equal(scopes["tr-descripcion-clasificacion"].auditoria.ampliada.sha,"17aeacc03f595412c044d276c900707cbbd008c8");
});

test("una entrega ajena no cambia funciones, métodos ni ficheros vecinos de una tanda",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),panel="beta-panel-veredictos",nomina="inc-3009-nomina-anticipada",inicio="inc-2909-02-inicio-natural";
  const unrelated=f=>read(f).replace("function categorySpentByMonth(","function ajenaBeta(){ return 27; }\nfunction categorySpentByMonth(")
    .replace("    enabled(){ return !!sb; },","    ajenaBeta(){ return 27; },\n    enabled(){ return !!sb; },")
    .replace("name:sp.name, amount:useAmt","name:sp.name, amount:useAmt+1");
  for(const id of [panel,nomina,inicio])assert.equal(betaRevision(id,unrelated).codigo,betaRevision(id).codigo,id);
  const scope=structuredClone(scopes[inicio]);
  const fn=scope.web.find(s=>s.function==="reservedSince");
  scope.web.push({...fn});
  Object.assign(fn,{from:"function reservedSince(",to:"function widgetCoveredEvents("});delete fn.function;
  assert.equal(betaRevision(inicio,read,undefined,scope).codigo,betaRevision(inicio).codigo,"reanclar y duplicar cobertura no crea revisión");
});
test("los métodos realmente leídos quedan dentro del alcance y sus cambios lo invalidan",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json"));
  for(const [id,scope]of Object.entries(scopes)){
    const cloud=scope.web.find(s=>s.data==="cloud"&&s.members);if(!cloud)continue;
    const texts=scope.web.filter(s=>s!==cloud).map(s=>scopeText(s,read)).concat(scopeDependencies(scope,read).map(fn=>fn.text));
    const used=new Set(texts.flatMap(text=>[...codeMask(text).matchAll(/\bcloud\.([\w$]+)/g)].map(m=>m[1])));
    for(const name of used)assert.ok(cloud.members.includes(name),id+": método no vigilado "+name);
    for(const name of cloud.members){
      const from=new RegExp("(\\b(?:async\\s+)?"+name+"\\([^)]*\\)\\s*\\{)");
      const changed=betaRevision(id,f=>f===cloud.file?read(f).replace(from,'$1 throw new Error("método mutado"); '):read(f));
      assert.notEqual(changed.web,betaRevision(id).web,id+": "+name);
    }
  }
});
test("la identidad conserva ASI, literales y descendientes CSS",()=>{
  for(const [file,a,b]of [["src/modules/fixture.js","function f(){ return 1; }","function f(){ return 2; }"],["src/modules/fixture.js","async function f(){}","async\nfunction f(){}"],["src/modules/fixture.js","a\n++b","a++\nb"],["src/modules/fixture.js","function f(){ return 1; }","function f(){ return\n1; }"],["src/shell.html",".profile-row .pr-val{color:red}",".profile-row.pr-val{color:red}"]]){
    const scope={web:[file],unidades:true};
    assert.notEqual(betaRevision("fixture",()=>a,undefined,scope).web,betaRevision("fixture",()=>b,undefined,scope).web);
  }
});
test("la compatibilidad requiere la misma fuente histórica y no acepta aliases escritos a mano",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),notes=structuredClone(historicalNotes),id="tr-descripcion-clasificacion",g=notes.flatMap(n=>n.tandas||[]).find(g=>g.id===id);
  // La integración cambia estos lectores reales; el id no acredita una aprobación anterior.
  for(const changedId of ["fin05-pago-cerrada","fin05-widget-reentrada","inc-2909-01-widget-periodo","inc-2909-02-inicio-natural","inc-2909-03-retirada","inc-3009-01-cargos","inc-3009-nomina-anticipada","widget-app-cerrada","widget-banco","tr-descripcion-clasificacion"]){
    const item=notes.flatMap(n=>n.tandas||[]).find(x=>x.id===changedId);
    assert.deepEqual(betaCompatible(item,betaRevision(changedId),scopes[changedId]),{},changedId+": contrato cambiado");
  }
  // Gasolina cambia TR: el positivo usa su fuente fija anterior, mientras los diez lectores
  // actuales de arriba deben rechazar la aprobación histórica. No se repina el catálogo.
  const sha="955765a9ec0ad96d20140a8f12da00c9fa04985c",history=(ref,file)=>execFileSync("git",["show",ref+":"+file],{encoding:"utf8",maxBuffer:8*1024*1024});
  const fixedRead=file=>history(sha,file),fixedScope=JSON.parse(history("8587e4b6b80f6d7010f8154b9f1877fb2f0563c1","scripts/beta-sources.json"))[id];
  const current=betaRevision(id,fixedRead,["web","native","edge"],fixedScope),compatible=betaCompatible(g,current,fixedScope);
  assert.ok(compatible.codigosCompatibles.length>=1);assert.equal(compatible.compatibilidadGit[0].sha,sha);
  const saved=structuredClone(compatible);compatible.codigosCompatibles[0]="f".repeat(64);
  assert.deepEqual(betaCompatible(g,current,fixedScope),saved,"la caché no comparte metadata mutable");
  assert.throws(()=>betaCompatible(g,current,fixedScope,()=>{throw new Error("historia de prueba ausente");}),/historia de prueba ausente/,"un lector personalizado nunca usa la caché Git");
  const native="android/app/src/main/java/com/micartera/app/TrExpenseListener.java";
  assert.ok(fixedRead(native).includes("package com.micartera.app;"));
  const changed=betaRevision(id,f=>f===native?fixedRead(f).replace("package com.micartera.app;","package com.micartera.fixture;"):fixedRead(f),["web","native","edge"],fixedScope);
  assert.notEqual(changed.codigo,current.codigo,"el mutante cambia fuente realmente vigilada");
  assert.deepEqual(betaCompatible(g,changed,fixedScope),{});
  const injected=[{v:"4.26.99",tandas:[{...g,items:{es:["guion cambiado"]},codigosCompatibles:[current.codigo],compatibilidadSha:"f".repeat(40)}]}];
  assert.equal(betaNotes(injected)[0].tandas[0].codigosCompatibles,undefined);
});

test("un helper privado ajeno no reabre; closure y efectos de inicialización sí",()=>{
  const id="beta-panel-veredictos",base=betaRevision(id),prefix="const cloud = (function(){";
  const unused=f=>read(f).replace(prefix,prefix+'\n  function _betaUnusedCloudHelper(){ return 123; }');
  assert.equal(betaRevision(id,unused).web,base.web);
  assert.equal(betaRevision(id,f=>unused(f).replace("return 123;","return {n:123};")).web,base.web);
  assert.equal(betaRevision(id,f=>unused(f).replace("_betaUnusedCloudHelper()","_betaUnusedCloudHelper({n=2}={})")).web,base.web);
  const used=f=>unused(f).replace("async betaReport(payload){","async betaReport(payload){ _betaUnusedCloudHelper();");
  assert.notEqual(betaRevision(id,used).web,base.web);
  const first=betaRevision(id,used);
  assert.notEqual(betaRevision(id,f=>used(f).replace("return 123;","return 456;")).web,first.web);
  assert.notEqual(betaRevision(id,f=>unused(f).replace("  let sb = null;","  let sb = null; _betaUnusedCloudHelper();")).web,base.web);
  assert.notEqual(betaRevision(id,f=>read(f).replace("  let sb = null;","  let sb = 7;")).web,base.web);
  const calls=f=>used(f).replace("return 123;","return this.enabled();");
  assert.notEqual(betaRevision(id,f=>calls(f).replace("enabled(){ return !!sb; }","enabled(){ return false; }")).web,betaRevision(id,calls).web);

});

test("TR separa el ACK de widget y conserva ingestión y elegibilidad",()=>{
  const id="tr-descripcion-clasificacion",widget="inc-2909-01-widget-periodo",before=betaRevision(id),other=betaRevision(widget);
  const changed=f=>read(f).replace('month.optInt("contract", 0)','month.optInt("contract", 7)');
  assert.equal(betaRevision(id,changed).native,before.native);
  assert.notEqual(betaRevision(widget,changed).native,other.native);
  const native="android/app/src/main/java/com/micartera/app/TrExpenseListener.java";
  assert.ok(JSON.parse(read("scripts/beta-sources.json"))[widget].native.includes(native),"el ACK excluido en TR sigue cubierto por el widget entero");
  assert.notEqual(betaRevision(id,f=>f===native?read(f).replace('package com.micartera.app;','package com.micartera.fixture;'):read(f)).native,before.native);
  for(const [from,to]of [['if (text.isEmpty()) return;','if (true) return;'],['.put("titulo", title)','.put("titulo", "")'],['.put("evento", evento)','.put("evento", "")']]){
    assert.ok(read(native).includes(from));
    assert.notEqual(betaRevision(id,f=>f===native?read(f).replace(from,to):read(f)).native,before.native,from);
  }
  assert.throws(()=>betaRevision(id,f=>f===native?read(f).replace('JSONObject month = r.optJSONObject("month");','JSONObject noMonth = r.optJSONObject("month");'):read(f)),/Exclusión beta/);
});

test("miembros dinámicos abortan sin ocultar aliases, opcionales ni sintaxis no delimitable",()=>{
  const fixture=body=>'const fixture=(function(){ return { principal(){ '+body+' }, otro(){ return 1; } }; })();';
  for(const owner of ["this","fixture"])for(const body of ['const self='+owner+'; return self.otro();','const {otro}='+owner+'; return otro();','return '+owner+'?.otro();','return '+owner+'[key]();','return callback('+owner+');']){
    assert.throws(()=>objectMembers(fixture(body),["principal"]),/dinámico sin alcance/,body);
  }
  for(const owner of ["this","fixture"]){
    const before=objectMembers(fixture('return '+owner+'.otro();'),["principal"]).text;
    assert.notEqual(objectMembers(fixture('return '+owner+'.otro();').replace('return 1;','return 2;'),["principal"]).text,before);
  }
  assert.ok(objectMembers(fixture('this._evSent=this._evSent||{}; this._evN=this._evN||0;'),["principal"]).text);
  for(const extra of ['get extra(){return 3;},','...extra,'])assert.throws(()=>objectMembers(fixture('return 7;').replace('principal(){',extra+'principal(){'),["principal"]),/Miembro beta no inequívoco/);
  for(const body of ['return eval("this.otro()");','return Function("return this.otro()");','const run=Function; return run("return fixture.otro()");','return (()=>0).constructor("return fixture.otro()");'])assert.throws(()=>objectMembers(fixture(body),["principal"]),/Evaluación beta dinámica/,body);
  const privateEval=fixture('return hidden();').replace('return { principal(){','function hidden(){ return eval("fixture.otro()"); } return { principal(){');
  assert.throws(()=>objectMembers(privateEval,["principal"]),/Evaluación beta dinámica/);
  assert.throws(()=>objectMembers(fixture('return 7;').replace('return { principal(){','eval("fixture.otro()"); return { principal(){'),["principal"]),/Evaluación beta dinámica/);

});
test("Cuota83 vigila prueba, identidad, lápidas, feed y ventana del mes",()=>{
  const id="inc-0210-01-plan-cuota",before=betaRevision(id,read),functions=logicFunctions(read),data=logicData(read);
  for(const name of ["debtPaymentState","expenseDeletedSet","expenseIsTombstoned","fixedPaymentIdentity","fixedPaymentFeedClear","cuotaCargoCercano"]){
    const fn=functions.get(name);assert.ok(fn,name);
    assert.notEqual(betaRevision(id,f=>f===fn.file?mutateLogic(read(f),fn):read(f)).web,before.web,name);
  }
  for(const name of ["CUOTA_ALIAS_DIAS","expenseDeletedSets","_pdCache"]){
    const value=data.get(name);assert.ok(value,name);
    assert.notEqual(betaRevision(id,f=>f===value.file?mutateData(read(f),value):read(f)).web,before.web,name);
  }
});
process.exitCode=failed?1:0;
