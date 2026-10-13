import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import {logicFunctions,scopeDependencies,mutateLogic,logicCalls,benignCalls,logicData,logicReads,scopeText,scopeDataDependencies,mutateData,benignData,codeMask,objectMembers} from "../scripts/beta-source-code.mjs";
import { betaRevision, betaNotes, betaDelivery, betaHistorical, betaCompatible, betaArchived, betaScopeSource } from "../scripts/beta-revisions.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
// Los contratos retirados del panel se prueban con su catálogo publicado, contra el código actual.
const historicalNotes=JSON.parse(execFileSync("git",["show","4403b252933410741a877eea59b85d812b2fe543:src/data/release-notes.json"],{encoding:"utf8",maxBuffer:5e6}));
// El alta110 pertenece al commit previo al retiro; los lectores y mutantes siguen usando read actual.
const delivered110Notes=JSON.parse(execFileSync("git",["show","c7593e86f6665d69fa20bd3f5f8f20c4710a5d9c:src/data/release-notes.json"],{encoding:"utf8",maxBuffer:5e6}));
const source112Cache=new Map();
const source112=f=>{if(!source112Cache.has(f))source112Cache.set(f,execFileSync("git",["show","74c5f075bf08e38e289992195ad97e3a71a8b031:"+f],{encoding:"utf8",maxBuffer:10e6}));return source112Cache.get(f);};
// Fuentes inmutables de la integración114: catálogo113 ya retirado (103f3bf1), beta113 servida
// (684a839d) y el arreglo del solape tal como se revisó (dd9619fa, que nace de esa beta).
const sourceAtCache=new Map();
const sourceAt=sha=>f=>{const k=sha+":"+f;if(!sourceAtCache.has(k))sourceAtCache.set(k,execFileSync("git",["show",k],{encoding:"utf8",maxBuffer:10e6}));return sourceAtCache.get(k);};
const source113=sourceAt("103f3bf101b14585e9cb2b87287f14591d23c624");
// Integración115: beta114 servida (8adba520) y el arreglo del widget tal como se revisó
// (844ce4b0, que nace de esa beta).
const source114=sourceAt("8adba5202a0444b386e3957a3c5ba499cf88e622");
// Integración116: beta115 servida (dfc02866), con el catálogo y el widget tal como se revisaron.
const source115=sourceAt("dfc028661935130acc66d416f26d95a09b758497");
// Integración117: la 116 integrada tal como se publicó en beta (f012fc05).
const source116=sourceAt("f012fc05b16fc5b24b13227ac168a3f7f24c246c");
// Integración118: la beta117 servida (c5f62d66), que es lo último que probó el móvil, y la
// producción117 (0a623768), que consolidó el catálogo con todas las tandas vacías.
const source117=sourceAt("c5f62d6603d016150afd9d0e20547b608b323045");
const sourceProd117=sourceAt("0a623768e014251ed6b37a6d75eaa95efde78bc0");
// Integración119: la beta118 servida (7e706174), que es lo último que probó el móvil.
const source118=sourceAt("7e706174255f1868d15099e11a503dd23d9aa774");
// Integración120: la beta119 servida (788432f4), que es lo último que probó el móvil.
const source119=sourceAt("788432f4682c199edd785f6973d9353330c0064a");
// Integración121: la 4.26.120 preparada (4e927e33), sobre la que se integra Inicio v4.2.
const source120=sourceAt("4e927e3346bb9f91aaeb048d8d55cbf2d02c57f2");
// Integración122: la 4.26.121 preparada (2de328d6), sobre la que se integra el cargo de recibo en Gastos.
const source121=sourceAt("2de328d63418f19f7d15a2cb86abfc263aa7bf6f");
// Integración123: la 4.26.122 preparada (e6e211a5), sobre la que se corrige la gráfica de Inicio con deudas heredadas.
const source122=sourceAt("e6e211a5d94e50b03597d5c91230c974d3e72232");
// Integración124: la beta123 servida (3625fa7e), sobre la que entra el scroll lento de Plan y se retiran las tres tandas aprobadas.
const source123=sourceAt("3625fa7ed5134cfbc5e364adc4f588bfdaf670c0");
// La122 añade un método a `cloud` (`setExpenseRecibo`) y los alcances que listan los métodos que
// leen lo ganan al final de su lista. Las comparaciones con descriptores anteriores lo descuentan;
// Catálogo122 fija en lista cerrada cuáles son.
const sinMetodo122=u=>u&&u.members?{...u,members:u.members.filter(m=>m!=="setExpenseRecibo")}:u;
const empty=[{v:"4.26.67",tandas:[]}];
const archiveRefs=JSON.parse(read("scripts/beta-archives.json"));
const archiveId="inc-0810-inicio-grafica-significado";
const archiveFiles=new Map();
const archiveHistory=(sha,file)=>{
  const key=sha+":"+file;
  if(!archiveFiles.has(key))archiveFiles.set(key,execFileSync("git",["show",key],{encoding:"utf8",maxBuffer:10e6,stdio:["ignore","pipe","ignore"]}));
  return archiveFiles.get(key);
};
function auditedScope(id,source){
  return betaScopeSource(id,source,JSON.parse(read("scripts/beta-sources.json")),archiveRefs,archiveHistory);
}
function auditedRevision(id,source){
  const ctx=auditedScope(id,source);return betaRevision(id,ctx.read,undefined,ctx.scope);
}
const boot="inc-2709-01-arranque-red";
const modern=[{v:"4.26.69",tandas:[{id:boot}]}];
let failed=0;
const inicioOnly=process.argv.includes("--inicio-v42-only");
function test(name,fn){ if(inicioOnly&&!name.startsWith("Inicio v4.2 ")&&!name.startsWith("Catálogo124 ")&&!name.startsWith("Retiro124 ")&&!name.startsWith("Catálogo123 ")&&!name.startsWith("Catálogo122 ")&&!name.startsWith("Catálogo121 ")&&!name.startsWith("Catálogo120 ")&&!name.startsWith("Catálogo114 ")&&!name.startsWith("Catálogo117 ")&&!name.startsWith("Retiro117 ")&&!name.startsWith("Catálogo118 ")&&!name.startsWith("Splash117 ")&&!name.startsWith("Catálogo119 ")&&!name.startsWith("Retiro119 "))return;try{fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+"\n    "+e.message);} }
console.log("beta-sources");

// La rayita comparte controlador y geometría con la barra: una aprobación de CSS aislada no
// vigilaría un cambio de clase, margen, cancelación o preferencia que la volviera a dejar sola.
test("Indicador107 vigila CSS, geometría y controladores sin reabrir dinero ajeno",()=>{
  const id="inc-0810-nav-indicator",source=f=>read(f).replace(/\r\n/g,"\n"),before=betaRevision(id,source).web;
  for(const [file,from,to] of [
    ["src/shell.html",'.botnav-hidden .botnav-ind{opacity:0;transition:none;}','.botnav-hidden .botnav-ind{opacity:1;transition:none;}'],
    ["src/shell.html",'.botnav-hidden .botnav-ind{opacity:0;transition:none;}','.botnav-hidden .botnav-ind{opacity:0;transition:opacity .2s;}'],
    ["src/shell.html",'.scroll-host-on.app-shell .botnav{transition:none;}','.scroll-host-on.app-shell .botnav{transition:all .1s;}'],
    ["src/shell.html",'.botnav-ind{position:absolute;top:-9px','.botnav-ind{position:absolute;top:-8px'],
    ["src/shell.html",'overflow:clip;overflow-clip-margin:30px;','overflow:clip;overflow-clip-margin:31px;'],
    ["src/shell.html",'.app-shell.scroll-host-on .botnav.botnav-hidden .botnav-fab{top:30px;}','.app-shell.scroll-host-on .botnav.botnav-hidden .botnav-fab{top:31px;}'],
    ["src/shell.html",'background:var(--bg-2);backdrop-filter:blur(16px)','background:transparent;backdrop-filter:blur(16px)'],
    ["src/shell.html",'animation:cybercurrent 7s','animation:cybercurrent 8s'],
    ["src/shell.html",'--safe-bottom:env(safe-area-inset-bottom,0px);','--safe-bottom:env(safe-area-inset-bottom,1px);'],
    ["src/modules/11-app-main.js",'navHiddenRef.current=true;','navHiddenRef.current=false;'],
    ["src/modules/11-app-main.js",'if(trackRef.current && e.currentTarget!==trackRef.current.children[tab]) return;','if(false) return;'],
    ["src/modules/11-app-main.js",'if(keepDomOnly) discardNavHideFlush();','if(false) discardNavHideFlush();'],
    ["src/modules/11-app-main.js",'((navHidden||navHiddenRef.current)&&!drawerOpen&&!profileOpen?','(false?'],
    ["src/modules/11-app-main.js",'tab<=1?tab*100:(tab+1)*100','tab<=1?tab*99:(tab+1)*100'],
    ["src/modules/10-app-components.js",'return ["dash","gastos","plan","cartera"];','return ["gastos","dash","plan","cartera"];'],
  ]){
    assert.ok(source(file).includes(from),"el mutante toca fuente real: "+from);
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f)).web,before,from);
  }
  const ajeno='rr_name_ph:"Nombre (opcional';
  assert.ok(source("src/modules/01-i18n.js").includes(ajeno));
  assert.equal(betaRevision(id,f=>f==="src/modules/01-i18n.js"?source(f).replace(ajeno,'rr_name_ph:"Otro (opcional'):source(f)).web,before,"un texto financiero ajeno no pertenece al indicador");
});
test("Indicador107 conserva las33 unidades previas y declara el cambio real de contorno",()=>{
  const cache=new Map(),base=f=>{if(!cache.has(f))cache.set(f,execFileSync("git",["show","8dcc5ed39b6e212ba1e34a90b550685794ce0bd5:"+f],{encoding:"utf8",maxBuffer:8e6}));return cache.get(f);};
  const cache107=new Map(),source107=f=>{if(!cache107.has(f))cache107.set(f,execFileSync("git",["show","70ffea58b515c333d76a33a34426f76d5476a6d9:"+f],{encoding:"utf8",maxBuffer:8e6}));return cache107.get(f);};
  const antes=JSON.parse(base("scripts/beta-sources.json")),actual=JSON.parse(source107("scripts/beta-sources.json"));
  assert.equal(Object.keys(antes).length,33);
  assert.deepEqual(Object.keys(actual).filter(id=>!antes[id]),["inc-0810-nav-indicator"]);
  assert.equal(actual["inc-0810-nav-indicator"].unidades,true,"helpers y datos transitivos reales forman la revisión");
  for(const [id,scope] of Object.entries(antes)){
    assert.deepEqual(actual[id],scope,id+": alcance y auditorías intactos");
    const previo=betaRevision(id,base,undefined,scope).web,vigente=betaRevision(id,source107,undefined,scope).web;
    if(id==="inc-2709-13-fab-contorno") assert.notEqual(vigente,previo,"el CSS reducido realmente cambia contorno");
    else assert.equal(vigente,previo,id+": identidad previa intacta");
  }
  const notas=JSON.parse(source107("src/data/release-notes.json"));
  assert.equal(notas[0].v,"4.26.107");
  assert.deepEqual(notas[0].tandas.map(g=>g.id),["inc-0810-nav-indicator"]);
  assert.deepEqual(notas.slice(1),JSON.parse(base("src/data/release-notes.json")),"notas y guiones anteriores intactos");
  for(const clave of ["historial","auditoria","codigosCompatibles","compatibilidadGit"]){
    assert.equal(actual["inc-0810-nav-indicator"][clave],undefined,"revisión independiente sin "+clave);
  }
});
if(process.argv.includes("--nav-indicator-only")) process.exit(failed?1:0);
// El contrato de la gráfica retirada sigue en su fuente inmutable: no se reescribe su
// identidad rechazada para que parezca la del renderer nuevo (2026-10-09).
test("Inicio109 histórico vigila ausencia de fechas, moneda, escala y dibujo en los tres idiomas",()=>{
  const cache=new Map(),source=f=>{if(!cache.has(f))cache.set(f,execFileSync("git",["show","f4ffb9340adfd0a13b631271e8158d2c630613c0:"+f],{encoding:"utf8",maxBuffer:10e6}).replace(/\r\n/g,"\n"));return cache.get(f);};
  const id="inc-0810-inicio-grafica-significado",scope=JSON.parse(source("scripts/beta-sources.json"))[id],before=betaRevision(id,source,undefined,scope).web;
  for(const [file,from,to] of [
    ["src/modules/03-tab-dash.js",'?t("v4_chart_line"):t("v4_hist_empty")','?t("v4_hist_empty"):t("v4_chart_line")'],
    ["src/modules/03-tab-dash.js",'data:state.history,current:tt.netWorth','data:state.history,current:0'],
    ["src/modules/02-ui-shared.js",'const rng=(max-min)||1;','const rng=max||1;'],
    ...[
      ["Solo se muestra el total actual", "Tu histórico empieza hoy"],
      ["Only the current total is shown", "Your history starts today"],
      ["Només es mostra el total actual", "El teu històric comença avui"],
      ["Cifras sin fecha en EUR", "Cifras sin fecha"],
      ["Undated figures in EUR", "Undated figures"],
      ["Xifres sense data en EUR", "Xifres sense data"],
      ["escala relativa del mínimo al máximo, no desde cero", "escala desde cero"],
      ["relative scale from minimum to maximum, not from zero", "scale from zero"],
      ["escala relativa del mínim al màxim, no des de zero", "escala des de zero"],
    ].map(([from,to])=>["src/modules/01-i18n.js",from,to]),
  ]){
    assert.ok(source(file).includes(from),"el mutante debe tocar la fuente real: "+from);
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scope).web,before,from);
  }
  const ajeno='pt_trb_hint:"';
  assert.equal(betaRevision(id,f=>f==="src/modules/01-i18n.js"?source(f).replace(ajeno,ajeno+"· "):source(f),undefined,scope).web,before,"una ayuda financiera ajena no cambia esta unidad");
  assert.equal(betaRevision(id,source,undefined,scope).codigo,"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0","el código histórico rechazado no se repina");
});

// La fuente actual necesita su propia unidad y todos los lectores reales de importe/divisa.
// Este guardián de identidad no acredita por sí solo DOM ni aceptación de la corrección.
test("Inicio v4.2 cubre flujos, ciclo, renderer, llamada, animación, textos, CSS y moneda vigentes",()=>{
  const id="inicio-patrimonio-flujos",source=f=>read(f).replace(/\r\n/g,"\n"),scopes=JSON.parse(source("scripts/beta-sources.json")),scope=scopes[id],before=betaRevision(id,source);
  // La base es la integración120 (apuntes iguales de Trade Republic): Inicio no puede retirar su alcance ni heredar su revisión.
  const integrated=JSON.parse(source120("scripts/beta-sources.json"));
  // Detrás de Inicio sólo ha entrado el alcance de la122 (el cargo de recibo en Gastos).
  assert.deepEqual(Object.keys(scopes),Object.keys(integrated).concat(id,"recibo-cargo-en-gastos","plan-scroll-lento"),"Inicio y las altas de la122 y la124, sin retirar historia120");
  for(const [key,value] of Object.entries(integrated))if(key!=="inicio-grafica-vuelve"){assert.deepEqual(scopes[key].native,value.native);assert.deepEqual(scopes[key].edge,value.edge);for(const part of value.web||[])assert.ok(scopes[key].web.some(s=>JSON.stringify(sinMetodo122(s))===JSON.stringify(part)),key+": no recortar descriptor ajeno120");}
  assert.equal(scope.unidades,true);
  for(const key of ["historial","auditoria","codigosCompatibles","compatibilidadGit","compatibilidadSha"])
    assert.equal(scope[key],undefined,"no hereda identidad anterior: "+key);
  assert.notEqual(before.codigo,"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0");
  for(const [file,from,to] of [
    ["src/modules/03-tab-dash.js",'series:series, splashGone:splashGone','series:[], splashGone:splashGone'],
    ["src/modules/03-tab-dash.js",'today:seriesToday,liquid:tt.liquid','today:"1900-01-01",liquid:tt.liquid'],
    ["src/modules/02-ui-shared.js",'Math.abs(mean)*.06','Math.abs(mean)*.6'],
    ["src/modules/02-ui-shared.js",'const debt=netWorthDebtPolicy(state,today,options.debtTotal);','const debt={current:0,first:null,value:function(){return 0;}};'],
    ["src/modules/02-ui-shared.js",'daily[day]=(daily[day]||0)-Math.round(e.amount*100)','daily[day]=(daily[day]||0)+Math.round(e.amount*100)'],
    ["src/modules/03-tab-dash.js",'const valid=typeof value==="number" && Number.isFinite(value)&&','const valid=true&&'],
    ["src/modules/03-tab-dash.js",'p?p.sign+p.ent:"—"','p?p.sign+p.ent:"0"'],
    ["src/modules/03-tab-dash.js",'const value=tt.netWorth, shown=useCountUp','const value=0, shown=useCountUp'],
    ["src/modules/03-tab-dash.js",'const tt=totals;','const tt={netWorth:0};'],
    ["src/modules/03-tab-dash.js",'useCountUp(tt.netWorth||0, splashGone)','useCountUp(tt.netWorth||0, true)'],
    ["src/modules/03-tab-dash.js",'!!(window.__mcSplashGone)','false'],
    ["src/modules/03-tab-dash.js",'Math.floor(remaining*DISP.k/days)','Math.ceil(remaining*DISP.k/days)'],
    ["src/modules/03-tab-dash.js",'const dailyMoney=budAmt>0?cycleDailyMoney(rem,timing.left):null;','const dailyMoney=cycleDailyMoney(1000,1);'],
    ["src/modules/03-tab-dash.js",'Math.min(1,rem/budAmt)','Math.min(1,spentAgainst/budAmt)'],
    ["src/modules/03-tab-dash.js",'Math.round((local-4)/312*(points.length-1))','0'],
    ["src/modules/02-ui-shared.js",'const t0=performance.now(), dur=950;','const t0=performance.now(), dur=1;'],
    ["src/modules/02-ui-shared.js",'if(mcReduced()){','if(false){'],
    ["src/modules/02-ui-shared.js",'document.documentElement.classList.contains("reduce-motion")','false'],
    ["src/modules/01-i18n.js",'Math.abs((n||0)*DISP.k)','Math.abs(n||0)'],
    ["src/modules/01-i18n.js",'sign:n<0?"-":""','sign:""'],
    ["src/modules/01-i18n.js",'v4_net_unknown:"El total actual no está disponible."','v4_net_unknown:"0"'],
    ["src/modules/01-i18n.js",'v4_net_unknown:"The current total is unavailable."','v4_net_unknown:"0"'],
    ["src/modules/01-i18n.js",'v4_net_unknown:"El total actual no està disponible."','v4_net_unknown:"0"'],
    ["src/modules/01-i18n.js",'v42_this_cycle:"Este ciclo"','v42_this_cycle:"Otro ciclo"'],
    ["src/modules/01-i18n.js",'v42_this_cycle:"This cycle"','v42_this_cycle:"Other cycle"'],
    ["src/modules/01-i18n.js",'v42_this_cycle:"Aquest cicle"','v42_this_cycle:"Altre cicle"'],
    ["src/modules/01-i18n.js",'v4_money_total:"Tu dinero en total"','v4_money_total:"Otro total"'],
    ["src/modules/01-i18n.js",'v4_money_total:"All your money"','v4_money_total:"Other total"'],
    ["src/modules/01-i18n.js",'v4_money_total:"Els teus diners en total"','v4_money_total:"Altre total"'],
    ["src/modules/01-i18n.js",'d_networth:"Patrimonio neto"','d_networth:"Otro total"'],
    ["src/modules/01-i18n.js",'d_networth:"Net worth"','d_networth:"Other total"'],
    ["src/modules/01-i18n.js",'d_networth:"Patrimoni net"','d_networth:"Altre total"'],
    ["src/modules/01-i18n.js",'const t = (k)=>{','const t = (k)=>{ /* cambio de selección */'],
    ["src/modules/00-core.js",'minimumFractionDigits:2,maximumFractionDigits:2','minimumFractionDigits:0,maximumFractionDigits:0'],
    ["src/modules/00-core.js",'let DISP = { sym:"€", k:1 };','let DISP = { sym:"€", k:2 };'],
    ["src/modules/00-core.js",'JPY:"¥"','JPY:"EUR"'],
    ["src/modules/00-core.js",'const tbl=Object.assign({},s&&s.fxRates||{});','const tbl={};'],
    ["src/modules/00-core.js",'return Number.isFinite(r)&&r>0?r:null;','return r||1;'],
    ["src/modules/11-app-main.js",'DISP.k=1/r;','DISP.k=r;'],
    ["src/modules/11-app-main.js",'DISP.sym="€"; DISP.k=1;','DISP.sym="USD"; DISP.k=1;'],
    ["src/modules/11-app-main.js",'CURLANG = (state.settings&&state.settings.lang) || "es"','CURLANG = "es"'],
    ["src/shell.html",'.v4-hero{text-align:center;padding:22px 0 8px;}','.v4-hero{display:none;}'],
    ["src/shell.html",'.v4-hero-amt{display:inline-block;','.v4-hero-amt{display:none;'],
    ["src/shell.html",'.v4-micro{font-size:12.5px;','.v4-micro{font-size:1px;'],
    ["src/shell.html",'.v4-budget{display:flex;gap:16px;align-items:center;}','.v4-budget{display:block;gap:16px;align-items:center;}'],
    ["src/shell.html",'.v4-budget-txt{flex:1;min-width:0;}','.v4-budget-txt{flex:0;min-width:0;}'],
    ["src/shell.html",'.v4-budget-txt .ph{font-size:14.5px;','.v4-budget-txt .ph{font-size:1px;'],
    ["src/shell.html",'.v42-net .v4-hero-amt{font-size:46px;','.v42-net .v4-hero-amt{font-size:1px;'],
    ["src/shell.html",'animation:v42-net-line 1.1s','animation:v42-net-line .1s'],
    ["src/shell.html",'.v42-net-line,.v42-net-fill,.v42-net-dot,.v42-cycle-draw{animation:none;}','.v42-net-line{animation:none;}'],
  ]){
    assert.ok(source(file).includes(from),"mutante sobre la fuente actual real: "+from);
    const changed=f=>f===file?source(f).replace(from,to):source(f);
    // Cambiar el propio literal delimitador debe abortar; el resto sí exige otro digest.
    const anchorMutants=[
      'const tt=totals;',
      'v4_money_total:"Tu dinero en total"','v4_money_total:"All your money"','v4_money_total:"Els teus diners en total"',
      'd_networth:"Patrimonio neto"','d_networth:"Net worth"','d_networth:"Patrimoni net"',
      'CURLANG = (state.settings&&state.settings.lang) || "es"'
    ];
    if(anchorMutants.includes(from)){
      assert.ok(scope.web.some(s=>s.file===file&&typeof s.from==="string"&&source(file).includes(s.from)&&!changed(file).includes(s.from)),"el caso literal debe alterar un delimitador real");
      assert.throws(()=>betaRevision(id,changed),{code:"BETA_SCOPE_ABSENT"},from+": delimitador cambiado falla cerrado");
    }else assert.notEqual(betaRevision(id,changed).web,before.web,from);
  }
  const files=["src/modules/00-core.js","src/modules/01-i18n.js","src/modules/02-ui-shared.js","src/modules/03-tab-dash.js","src/modules/08-motor-bank.js"],functions=logicFunctions(source,files);
  for(const name of ["NetWorthNow","netWorthSeries","netWorthDay","netWorthRanges","netWorthChartGeometry","netWorthDeltaMoney","netWorthDebtPolicy","recordAccountBalances","mcLoadRaw","mcSaveRaw","mcResetSandbox","cyclePaceState","cycleTiming","cycleMoney","cycleDailyMoney","mergeAccountBalanceHistory","recordAssetValues","slimForCloud","useCountUp","mcReduced","eurParts","fxRateOf","fxTableOf"]){
    const fn=functions.get(name);assert.ok(fn,name+": función real localizada");
    assert.notEqual(betaRevision(id,f=>f===fn.file?mutateLogic(source(f),fn):source(f)).web,before.web,name);
  }
  // La lista explícita de lectores monetarios no se sustituye por un hash del renderer.
  for(const fn of scopeDependencies(scope,source,functions))assert.ok(scope.web.some(s=>s.file===fn.file&&s.function===fn.name),"dependencia v4.2 vigilada: "+fn.name);
  const data=logicData(source,files);
  for(const name of ["NF","DISP","CUR_SYM","CURLANG","SIMPLEMODE","CYCLE_COMFORT_DIFF","CYCLE_GOOD_DIFF","CYCLE_TIGHT_DIFF"]){
    const value=data.get(name);assert.ok(value,name+": dato real localizado");
    assert.notEqual(betaRevision(id,f=>f===value.file?mutateData(source(f),value):source(f)).web,before.web,name);
  }
  const other='pt_trb_hint:"';
  assert.equal(betaRevision(id,f=>f==="src/modules/01-i18n.js"?source(f).replace(other,other+"· "):source(f)).web,before.web,"no absorbe ayuda financiera ajena");
});

test("La integración112 histórica no cambia las otras unidades ni repina el rechazo109",()=>{
  const cache=new Map(),base=f=>{if(!cache.has(f))cache.set(f,execFileSync("git",["show","23a7808f65ef6d28e8a906f7100ffdf229917abb:"+f],{encoding:"utf8",maxBuffer:10e6}));return cache.get(f);};
  const before=JSON.parse(base("scripts/beta-sources.json")),actual=JSON.parse(source112("scripts/beta-sources.json")),old="inc-0810-inicio-grafica-significado",current="inc-0910-inicio-solo-actual";
  assert.deepEqual(Object.keys(actual).filter(id=>!before[id]),[current]);
  for(const [id,scope] of Object.entries(before)){
    const expected=structuredClone(scope);
    if(id==="inc-0810-dashboard-recents-memo"){
      expected.web[0]={file:"src/modules/03-tab-dash.js",from:"  const recent=useMemo",to:",[state.expenses,state.deleted]);",includeTo:true};
      assert.equal(scopeText(scope.web[0],base),scopeText(expected.web[0],source112),"106 reanclada cubre exactamente la expresión completa anterior");
    }
    if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(id))
      expected.web.splice(expected.web.indexOf("scripts/beta-source-code.mjs")+1,0,"scripts/beta-archives.json",...[{"file":"src/modules/01-i18n.js","from":"    // Archivo109 es: una función retirada no acredita entrega vigente.","to":"    // Archivo109 es: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 en: una función retirada no acredita entrega vigente.","to":"    // Archivo109 en: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 ca: una función retirada no acredita entrega vigente.","to":"    // Archivo109 ca: fin de la referencia."}],...[{"file":"src/modules/10-app-components.js","function":"betaHistoricalDetails"},"scripts/listo-para-produccion.mjs"]);
    assert.deepEqual(actual[id],expected,id+": sólo los dos consumidores cubren el archivo explícito");
    if(id===old){
      assert.equal(betaRevision(id,base,undefined,scope).codigo,"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0");
      assert.notEqual(betaRevision(current,source112,undefined,actual[current]).web,betaRevision(id,base,undefined,scope).web,"el renderer nuevo no hereda el digest del dibujo antiguo");
    }else if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(id)){
      assert.notEqual(betaRevision(id,source112,undefined,actual[id]).web,betaRevision(id,base,undefined,scope).web,id+": archivo109 cambia la maquinaria cubierta y requiere revisión propia");
    }else assert.equal(betaRevision(id,source112,undefined,actual[id]).web,betaRevision(id,base,undefined,scope).web,id+": identidad ajena conservada");
  }
  const notes=JSON.parse(source112("src/data/release-notes.json")),oldNotes=JSON.parse(base("src/data/release-notes.json"));
  for(const note of oldNotes)assert.deepEqual(notes.find(n=>n.v===note.v),note,note.v+": notas y guiones históricos intactos");
});

// Este registro describe la integración cerrada109, no los cambios posteriores110.
// Su metadata se lee del commit inmutable; los contratos y mutantes runtime siguen en read.
test("Integración109 histórica conserva las tres revisiones y solo cambia dos identidades anteriores",()=>{
  const cache=new Map(),at=(sha,f)=>{const k=sha+":"+f;if(!cache.has(k))cache.set(k,execFileSync("git",["show",k],{encoding:"utf8",maxBuffer:10e6}));return cache.get(k);};
  const base=f=>at("8dcc5ed39b6e212ba1e34a90b550685794ce0bd5",f),integrated=f=>at("f4ffb9340adfd0a13b631271e8158d2c630613c0",f),before=JSON.parse(base("scripts/beta-sources.json")),actual=JSON.parse(integrated("scripts/beta-sources.json"));
  const leaves={"inc-0810-nav-indicator":"70ffea58b515c333d76a33a34426f76d5476a6d9","inc-0810-metas-editar-regla":"088229a9b8f96868ca774e98fa7343f986cb5056","inc-0810-inicio-grafica-significado":"24593dd252b02656f7fc0c2c4c70a54784114379"};
  assert.equal(Object.keys(actual).length,36);assert.deepEqual(Object.keys(actual).filter(id=>!before[id]).sort(),Object.keys(leaves).sort());
  for(const [id,sha] of Object.entries(leaves)){
    const leaf=f=>at(sha,f),scope=JSON.parse(leaf("scripts/beta-sources.json"))[id];
    assert.deepEqual(actual[id],scope,id+": cierre transitorio intacto");
    assert.equal(betaRevision(id,integrated,undefined,actual[id]).web,betaRevision(id,leaf,undefined,scope).web,id+": código idéntico al probado en109");
  }
  const changed=[];for(const [id,scope] of Object.entries(before)){
    if(id==="inc-0310-01-meta-regla"){
      const extra=[{file:"src/modules/08-motor-bank.js",function:"reservaRuleSame"},{file:"src/modules/08-motor-bank.js",function:"editReservaRule"}];
      assert.deepEqual(actual[id],{...scope,web:[...scope.web,...extra]},"alta conserva su alcance y suma sus dos lectores reales");
    }else assert.deepEqual(actual[id],scope,id+": descriptor y referencias anteriores intactos");
    if(betaRevision(id,base,undefined,scope).web!==betaRevision(id,integrated,undefined,actual[id]).web)changed.push(id);
  }
  assert.deepEqual(changed.sort(),["inc-0310-01-meta-regla","inc-2709-13-fab-contorno"]);
});

// El retiro es selectivo: se apoya en código publicado inmutable y conserva cada guion
// pendiente/rechazado. El gate HTTP/ZIP previo queda en el acta, no se infiere de este test.
test("Retiro109 elimina solo las cinco aprobadas entregadas y conserva todo el historial",()=>{
  const cache=new Map(),at=(sha,f)=>{const k=sha+":"+f;if(!cache.has(k))cache.set(k,execFileSync("git",["show",k],{encoding:"utf8",maxBuffer:10e6}));return cache.get(k);};
  const published=f=>at("b1ad23f34f2a94933e57246dfdf12c451f5360a1",f);
  const ids=["inc-0710-gastos-mes-madrid","inc-0710-appstate-listener-cleanup","inc-0710-banknotif-cleanup","inc-0710-auth-disposal","inc-0810-dashboard-recents-memo"];
  // El retiro ya entregado se contrasta con su fuente y alcance inmutables; un fix posterior
  // de Recibos no debe fingir que aquella entrega cambió (12/10/2026).
  const retired=f=>at("f4ffb9340adfd0a13b631271e8158d2c630613c0",f),scopes=JSON.parse(retired("scripts/beta-sources.json"));
  for(const id of ids)assert.equal(betaRevision(id,retired,undefined,scopes[id]).web,betaRevision(id,published,undefined,scopes[id]).web,id+": código idéntico al entregado");
  const before=JSON.parse(at("b1f871750469a5439ada6cea2284fc0ff407cd46","src/data/release-notes.json"));
  const expected=before.map(n=>Array.isArray(n.tandas)?{...n,tandas:n.tandas.filter(g=>!ids.includes(g.id))}:n);
  const actual=JSON.parse(at("f4ffb9340adfd0a13b631271e8158d2c630613c0","src/data/release-notes.json"));assert.deepEqual(actual,expected,"sólo se retiran esas cinco en109, sin borrar notas, pendientes ni rechazos");
  assert.equal(actual.length,226);assert.ok(!actual.some(n=>(n.tandas||[]).some(g=>ids.includes(g.id))));
});

test("Integración112 histórica conserva BackClose110 y Bienes111",()=>{
  const cache=new Map(),base=f=>{if(!cache.has(f))cache.set(f,execFileSync("git",["show","f4ffb9340adfd0a13b631271e8158d2c630613c0:"+f],{encoding:"utf8",maxBuffer:10e6}));return cache.get(f);};
  const before=JSON.parse(base("scripts/beta-sources.json")),actual=JSON.parse(source112("scripts/beta-sources.json")),id="inc-0810-backclose-handover";
  assert.equal(Object.keys(before).length,36);assert.equal(Object.keys(actual).length,39);
  assert.deepEqual(Object.keys(actual).filter(key=>!before[key]),["inc-2709-07-bienes-toque",id,"inc-0910-inicio-solo-actual"]);
  // El alta111 se contrasta con un descriptor literal independiente del registro que vigila.
  const scope111={"unidades":true,"web":[{"file":"src/modules/07-tab-patri-fijos.js","from":"      parte!==\"cuentas\" && (state.assets||[]).length>0 && React.createElement(React.Fragment,null,","to":"    );\n  }\n  return React.createElement(\"div\",null,"},{"file":"src/modules/07-tab-patri-fijos.js","from":"  const astEd=useEditable(state.assets,it=>set(s=>Object.assign({},s,{assets:it})));","to":"  const accSum=totals.liquid;"},{"file":"src/modules/02-ui-shared.js","function":"useEditable"},{"file":"src/modules/00-core.js","function":"eur0"},{"file":"src/modules/00-core.js","data":"NF0"},{"file":"src/modules/00-core.js","data":"DISP"},{"file":"src/shell.html","from":"  .v4-mov{display:flex","to":"  .v4-mov.v4-mov-skip"},{"file":"src/shell.html","from":"  button.v4-mov{","to":"  .set-card>.set-row:first-child"},{"file":"src/modules/11-app-main.js","from":"  // INC-0410 guardado: de aquí al límite está cuándo y qué estado se escribe en disco. Cambiarlo invalida las revisiones que prometen conservar algo al cerrar o recargar.","to":"  // INC-0410 guardado: límite."},{"file":"src/modules/00-core.js","function":"mcPersistCommit"},{"file":"src/modules/00-core.js","function":"mcSaveRaw"},{"file":"src/modules/00-core.js","function":"mcSkipPersist"},{"file":"src/modules/00-core.js","function":"mcStateKey"},{"file":"src/modules/00-core.js","function":"mcSandbox"},{"file":"src/modules/00-core.js","function":"mcSandboxFlag"},{"file":"src/modules/00-core.js","data":"EXP_SUFFIX"},{"file":"src/modules/00-core.js","data":"store"},{"file":"src/modules/00-core.js","data":"_mcSkipPersist"},{"file":"src/modules/00-core.js","data":"STATE_KEY_TEST"},{"file":"src/modules/00-core.js","data":"STATE_KEY_REAL"},{"file":"src/modules/00-core.js","data":"_mcSandboxPinned"},{"file":"src/modules/00-core.js","data":"_mem"}]};
  assert.equal(scope111.web.length,22);
  assert.deepEqual(actual["inc-2709-07-bienes-toque"],scope111,"111 declara exclusivamente sus22 dependencias reales, sin alias ni aprobación");
  assert.equal(actual[id].unidades,true);
  for(const key of ["historial","auditoria","codigosCompatibles","compatibilidadGit","compatibilidadSha"])assert.equal(actual[id][key],undefined,"sin referencia heredada: "+key);
  const changed=[];
  for(const [key,scope] of Object.entries(before)){
    if(key==="inc-0310-broker-resultados"){
      assert.deepEqual({...actual[key],web:scope.web},scope,"Brókers conserva auditorías/historial y amplía sólo web");
      assert.deepEqual(actual[key].web.filter(d=>scope.web.some(s=>JSON.stringify(s)===JSON.stringify(d))),scope.web,"ninguna dependencia antigua se retira ni reordena");
      assert.equal(actual[key].web.length,scope.web.length+15,"ocho helpers y siete datos transitivos reales");
    }else{
    const expected=structuredClone(scope);
    if(key==="inc-0810-dashboard-recents-memo"){
      expected.web[0]={file:"src/modules/03-tab-dash.js",from:"  const recent=useMemo",to:",[state.expenses,state.deleted]);",includeTo:true};
      assert.equal(scopeText(scope.web[0],base),scopeText(expected.web[0],source112),"106 reanclada cubre exactamente la expresión completa histórica");
    }
    if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(key))
      expected.web.splice(expected.web.indexOf("scripts/beta-source-code.mjs")+1,0,"scripts/beta-archives.json",...[{"file":"src/modules/01-i18n.js","from":"    // Archivo109 es: una función retirada no acredita entrega vigente.","to":"    // Archivo109 es: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 en: una función retirada no acredita entrega vigente.","to":"    // Archivo109 en: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 ca: una función retirada no acredita entrega vigente.","to":"    // Archivo109 ca: fin de la referencia."}],...[{"file":"src/modules/10-app-components.js","function":"betaHistoricalDetails"},"scripts/listo-para-produccion.mjs"]);
    assert.deepEqual(actual[key],expected,key+": sólo los dos consumidores cubren el archivo explícito");
    }
    const source=key===archiveId?base:source112;
    if(betaRevision(key,source,undefined,actual[key]).web!==betaRevision(key,base,undefined,scope).web)changed.push(key);
  }
  assert.deepEqual(changed.sort(),["beta-panel-veredictos","inc-0310-broker-resultados","inc-3009-nomina-anticipada","ops-0410-panel-cola"],"Brókers110/Nómina111 ya cambiaron;112 añade sólo los dos consumidores del archivo, con109 fijo en f4ff");
  const notes=delivered110Notes,old=JSON.parse(base("src/data/release-notes.json"));
  assert.equal(notes[0].v,"4.26.110");assert.deepEqual(notes[0].tandas.map(g=>g.id),[id]);
  assert.deepEqual(notes.slice(1),old,"las226 notas y guiones109 siguen exactos, incluidas pendientes/rechazadas");
  const retired=["inc-0710-gastos-mes-madrid","inc-0710-appstate-listener-cleanup","inc-0710-banknotif-cleanup","inc-0710-auth-disposal","inc-0810-dashboard-recents-memo"];
  assert.ok(!notes.some(n=>(n.tandas||[]).some(g=>retired.includes(g.id))),"no resucitar las cinco retiradas");
});

// Retirar el panel no permite borrar una nota familiar, otro guion o su metadata.
test("Retiro110 y altas111/112 conservan229notas sin duplicar ni reabrir tandas",()=>{
  const ids=["inc-0810-nav-indicator","inc-0810-metas-editar-regla","inc-0810-backclose-handover"],rejected="inc-0810-inicio-grafica-significado";
  assert.equal(delivered110Notes.length,227);
  for(const id of ids)assert.equal(delivered110Notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,id+": fixture previo exacto");
  // La nota111 se fija aquí por separado: el catálogo actual no fabrica su propio oráculo.
  const note111={"v":"4.26.111","d":"2026-10-09","t":{"es":"Tocar Bienes para editar","en":"Tap assets to edit","ca":"Toca els béns per editar"},"items":{"es":["Tocar un bien abre su editor. La opción Editar bienes sigue disponible."],"en":["Tap an asset to open its editor. Edit assets is still available."],"ca":["Toca un bé per obrir-ne l’editor. L’opció Edita els béns continua disponible."]},"tandas":[{"id":"inc-2709-07-bienes-toque","t":{"es":"Abrir el editor de Bienes","en":"Open the asset editor","ca":"Obre l’editor de béns"},"items":{"es":["1. En Cartera → Bienes, tocar una fila abre el editor. Arrastrar para bajar no lo abre. Abrir no cambia los valores; Guardar sin modificarlos los conserva. Editar bienes sigue disponible."],"en":["1. In Wallet → Property, tap a row to open the editor. Scrolling does not open it. Opening keeps values unchanged; saving without edits preserves them. Edit assets is still available."],"ca":["1. A Cartera → Béns, toca una fila per obrir l’editor. Arrossegar per baixar no l’obre. Obrir no canvia els valors; desar sense modificar-los els conserva. Edita els béns continua disponible."]}}]};
  const expected=[note111,...delivered110Notes.map(n=>Array.isArray(n.tandas)?{...n,tandas:n.tandas.filter(g=>!ids.includes(g.id))}:n)];
  //112 se antepone;111 y las227 notas previas siguen siendo un oráculo literal independiente.
  const newCopy={"t":{"es":"El total de ahora en Inicio","en":"Your current total on Home","ca":"El total d’ara a Inici"},"items":{"es":["Inicio muestra el patrimonio actual con la etiqueta «Ahora», sin una línea que pueda confundirse con una evolución. Si el total no está disponible, aparece «—» con una explicación."],"en":["Home shows your current net worth with a “Now” label, without a line that could be mistaken for a trend. If the total is unavailable, “—” appears with an explanation."],"ca":["Inici mostra el patrimoni actual amb l’etiqueta «Ara», sense una línia que es pugui confondre amb una evolució. Si el total no està disponible, apareix «—» amb una explicació."]},"tandas":[{"id":"inc-0910-inicio-solo-actual","t":{"es":"Inicio: total actual","en":"Home: current total","ca":"Inici: total actual"},"items":{"es":["1. Abre Inicio y comprueba el patrimonio: conserva el importe y la moneda, con la etiqueta «Ahora».","2. Comprueba que no aparece una línea de evolución, tanto sin cifras anteriores como con ellas.","3. Cambia entre el modo simple y el completo: cambia el título, pero se conserva el mismo total.","4. Cambia la moneda de presentación y vuelve a la anterior: los saldos guardados se conservan."],"en":["1. Open Home and check your net worth: the amount and currency are preserved, with the “Now” label.","2. Check that no trend line appears, both with and without earlier figures.","3. Switch between simple and full mode: the title changes, but the total stays the same.","4. Change the display currency and switch back: stored balances are preserved."],"ca":["1. Obre Inici i comprova el patrimoni: conserva l’import i la moneda, amb l’etiqueta «Ara».","2. Comprova que no apareix una línia d’evolució, tant sense xifres anteriors com amb elles.","3. Canvia entre el mode simple i el complet: canvia el títol, però es conserva el mateix total.","4. Canvia la moneda de presentació i torna a l’anterior: els saldos desats es conserven."]}}]};
  const verify=notes=>{
    assert.equal(notes.length,229);
    const first=notes[0];
    assert.equal(JSON.parse(source112("package.json")).version,"4.26.112");
    assert.match(first.d,/^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(first,{v:"4.26.112",d:first.d,...newCopy},"sólo la unidad112 con copia propia es/en/ca, sin alias");
    assert.deepEqual(notes.slice(1),expected,"111 literal y227notas completas, sin cambios a guiones/textos/metadata");
  };
  const actual=JSON.parse(source112("src/data/release-notes.json"));verify(actual);
  assert.deepEqual(actual.find(n=>n.v==="4.26.109"),delivered110Notes.find(n=>n.v==="4.26.109"),"109 rechazada íntegra");
  for(const id of ids){
    assert.equal(actual.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,0);
    const changed=structuredClone(actual),old=delivered110Notes.find(n=>(n.tandas||[]).some(g=>g.id===id));
    changed.find(n=>n.v===old.v).tandas.push(structuredClone(old.tandas.find(g=>g.id===id)));
    assert.throws(()=>verify(changed),id+": reponer una entregada debe fallar");
  }
  const withoutRejected=structuredClone(actual);
  withoutRejected.find(n=>n.v==="4.26.109").tandas=withoutRejected.find(n=>n.v==="4.26.109").tandas.filter(g=>g.id!==rejected);
  assert.throws(()=>verify(withoutRejected),"borrar109 debe fallar");
  const other=actual.slice(1).find(n=>n.v!=="4.26.111"&&(n.tandas||[]).some(g=>g.id!==rejected));assert.ok(other,"queda otro guion pendiente histórico");
  const otherId=other.tandas.find(g=>g.id!==rejected).id,withoutOther=structuredClone(actual);
  withoutOther.find(n=>n.v===other.v).tandas=withoutOther.find(n=>n.v===other.v).tandas.filter(g=>g.id!==otherId);
  assert.throws(()=>verify(withoutOther),"borrar otra pendiente debe fallar");
  const withoutNote=structuredClone(actual);withoutNote.pop();assert.throws(()=>verify(withoutNote),"borrar una nota debe fallar");
  const changedText=structuredClone(actual);changedText[0].items.es[0]+=" · mutante";assert.throws(()=>verify(changedText),"cambiar texto familiar debe fallar");
  const changedHistoricalText=structuredClone(actual);changedHistoricalText[2].items.es[0]+=" · mutante";assert.throws(()=>verify(changedHistoricalText),"cambiar texto familiar histórico debe fallar");
  const changedMetadata=structuredClone(actual);changedMetadata.find(n=>n.v===other.v).tandas.find(g=>g.id===otherId).rev=999;
  assert.throws(()=>verify(changedMetadata),"cambiar metadata pendiente debe fallar");
  const changedOldText=structuredClone(actual);changedOldText[1].items.es[0]+=" · mutante";assert.throws(()=>verify(changedOldText),"cambiar texto previo debe fallar");
  const duplicateCurrent=structuredClone(actual);duplicateCurrent[0].tandas.push(structuredClone(duplicateCurrent[0].tandas[0]));assert.throws(()=>verify(duplicateCurrent),"duplicar la unidad actual debe fallar");
  const inheritedCurrent=structuredClone(actual);inheritedCurrent[0].tandas[0].desde=rejected;assert.throws(()=>verify(inheritedCurrent),"heredar el rechazo109 debe fallar");
  const unreserved=structuredClone(actual);unreserved[0].v=expected[0].v;assert.throws(()=>verify(unreserved),"reutilizar la versión previa debe fallar");
});


// Los textos autorizados y los dos retiros se fijan independientemente: alterar una nota
// histórica o reciclar el OK de una puerta anterior tiene que dejar rojo el catálogo.
const expected113={v:'4.26.113',d:'2026-10-10',t:{es:'Bienes completos y vuelve la gráfica de Inicio',en:'Complete assets and the Home chart returns',ca:'Béns complets i torna la gràfica d’Inici'},items:{es:['En Cartera → Bienes ya puedes añadir un bien, editarlo y borrarlo, también cuando la lista está vacía.','Inicio recupera la gráfica del patrimonio.'],en:['In Wallet → Property, you can now add, edit and delete an asset, even when the list is empty.','Home brings back the net worth chart.'],ca:['A Cartera → Béns ja pots afegir un bé, editar-lo i esborrar-lo, també quan la llista és buida.','Inici recupera la gràfica del patrimoni.']},tandas:[{id:'bienes-completo',t:{es:'Bienes completos',en:'Complete assets',ca:'Béns complets'},items:{es:['1. En Cartera → Bienes, añade un bien con nombre y valor: aparece en la lista y sube el patrimonio.','2. Tócalo, cambia el valor y guarda. Ábrelo otra vez y pulsa Cancelar: no cambia nada.','3. Bórralo: pide confirmación. Al cancelar sigue ahí; al confirmar desaparece.'],en:['1. In Wallet → Property, add an asset with a name and value: it appears in the list and increases net worth.','2. Tap it, change the value and save. Open it again and press Cancel: nothing changes.','3. Delete it: confirmation is requested. Cancelling keeps it there; confirming removes it.'],ca:['1. A Cartera → Béns, afegeix un bé amb nom i valor: apareix a la llista i puja el patrimoni.','2. Toca’l, canvia el valor i desa. Obre’l una altra vegada i prem Cancel·la: no canvia res.','3. Esborra’l: demana confirmació. En cancel·lar continua allà; en confirmar desapareix.']}},{id:'inicio-grafica-vuelve',t:{es:'Vuelve la gráfica de Inicio',en:'The Home chart returns',ca:'Torna la gràfica d’Inici'},items:{es:['1. Abre Inicio: vuelve a verse la gráfica bajo el patrimonio y ya no aparece «Ahora».'],en:['1. Open Home: the chart is visible below net worth again and “Now” no longer appears.'],ca:['1. Obre Inici: torna a veure’s la gràfica sota el patrimoni i ja no apareix «Ara».']}}]};
// Catálogo cerrado: desde la114 se lee de su commit inmutable, igual que los contratos112.
test("Catálogo113 histórico sustituye sólo111/112 y conserva notas, pendientes y rechazo109",()=>{
  const read=source113;
  const before=JSON.parse(source112("src/data/release-notes.json"));
  const retired=["inc-2709-07-bienes-toque","inc-0910-inicio-solo-actual"];
  const expected=[{...expected113,tandas:[]},...before.map(n=>n.tandas?{...n,tandas:n.tandas.filter(g=>!retired.includes(g.id))}:n)];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.length,230);assert.equal(JSON.parse(read("package.json")).version,"4.26.113");
  for(const id of retired){
    const changed=structuredClone(notes),old=before.find(n=>(n.tandas||[]).some(g=>g.id===id));
    changed.find(n=>n.v===old.v).tandas.push(old.tandas.find(g=>g.id===id));
    assert.throws(()=>verify(changed),"no reabrir "+id);
  }
  for(const g of expected113.tandas){const changed=structuredClone(notes);changed[0].tandas.push(g);assert.throws(()=>verify(changed),"no resucitar "+g.id);}
  const changed=structuredClone(notes);delete changed[0].tandas;assert.throws(()=>verify(changed),"no fabricar una tanda todo");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source112("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(id=>!oldScopes[id]),["bienes-completo","inicio-grafica-vuelve"]);
  for(const [id,scope] of Object.entries(oldScopes))if(!retired.includes(id))assert.deepEqual(scopes[id],scope,id+": descriptor ajeno intacto");
  for(const id of retired)assert.equal(scopes[id],undefined,"no repinar "+id);
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source112("scripts/beta-archives.json")),"pin y juicio109 intactos");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes);
  for(const id of retired){assert.equal(receipt.web[id],undefined);assert.equal(receipt.pruebas[id],undefined);}
  for(const g of expected113.tandas){
    assert.equal(receipt.web[g.id],betaRevision(g.id,read,undefined,scopes[g.id]).web,"el producto sigue íntegro");
    assert.equal(receipt.pruebas[g.id],undefined,"el guion retirado no permanece marcado");
  }
});
// La114 añade UNA nota con UNA tanda y UN alcance. Texto, pasos y descriptor se fijan aquí
// aparte del catálogo que vigilan: tocar otra nota, otro alcance o la huella de otra tanda
// tiene que dejar esto en rojo.
const expected114={v:'4.26.114',d:'2026-10-11',t:{es:'Inicio sin solapes',en:'Home without overlaps',ca:'Inici sense solapaments'},items:{es:['Inicio ya no muestra por error la lista de categorías de Gastos encima de sus tarjetas.'],en:['Home no longer shows the Expenses category list on top of its cards by mistake.'],ca:['Inici ja no mostra per error la llista de categories de Despeses a sobre de les seves targetes.']},tandas:[{id:'inicio-solape-gastos',t:{es:'Inicio sin solapes',en:'Home without overlaps',ca:'Inici sense solapaments'},items:{es:['1. Activa una temática en Ajustes → Apariencia → Temática (cualquiera que no sea «Ninguna»).','2. Entra en Gastos y abre el desglose «Por categoría».','3. Vuelve a Inicio: no debe verse ninguna lista de categorías encima de las tarjetas.','4. Desde Inicio, apunta dos gastos seguidos con el botón + y cierra: Inicio debe seguir limpio.','5. Vuelve a Gastos: el desglose sigue ahí y se puede abrir y cerrar.'],en:['1. Turn on a theme in Settings → Look & feel → Theme (any except “None”).','2. Go to Spending and open the “By category” breakdown.','3. Go back to Home: no category list should appear on top of the cards.','4. From Home, log two expenses in a row with the + button and close: Home should stay clean.','5. Go back to Spending: the breakdown is still there and can be opened and closed.'],ca:['1. Activa una temàtica a Ajustos → Aparença → Temàtica (qualsevol que no sigui «Cap»).','2. Entra a Despeses i obre el desglossament «Per categoria».','3. Torna a Inici: no s’ha de veure cap llista de categories a sobre de les targetes.','4. Des d’Inici, apunta dues despeses seguides amb el botó + i tanca: Inici ha de seguir net.','5. Torna a Despeses: el desglossament continua allà i es pot obrir i tancar.']}}]};
// Catálogo cerrado: desde la115 se lee de su commit inmutable, igual que el113.
test("Catálogo114 histórico añade sólo la tanda del solape y conserva notas, alcances y huellas ajenas",()=>{
  const read=source114;
  const id="inicio-solape-gastos",before=JSON.parse(source113("src/data/release-notes.json"));
  const expected=[expected114,...before];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.length,231);assert.equal(JSON.parse(read("package.json")).version,"4.26.114");
  assert.deepEqual(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,"una sola vez en todo el catálogo");
  for(const g of expected113.tandas){const changed=structuredClone(notes);changed[1].tandas.push(g);assert.throws(()=>verify(changed),"no resucitar "+g.id);}
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde="inicio-grafica-vuelve";assert.throws(()=>verify(inherited),"no heredar una aprobación");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source113("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira");
  for(const [key,scope] of Object.entries(oldScopes))assert.deepEqual(scopes[key],scope,key+": descriptor ajeno intacto");
  assert.deepEqual(scopes[id],{unidades:true,web:[
    {file:"src/shell.html",from:"  .v4-gastos-cats-body.abierto{",to:"\n",includeTo:true},
    {file:"src/shell.html",from:"  .v4-filter-cats.abierto .v4-filter-cats-body{",to:"\n",includeTo:true}]},"dos reglas CSS, sin alias ni referencia heredada");
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source113("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // El arreglo sólo mueve SU identidad: beta113 servida frente al commit revisado del solape.
  const base=sourceAt("684a839d286f68d66c8855cf6e1a626b7220fd64"),fix=sourceAt("dd9619fabb74cd2977239268bd002b9ff7e783a8");
  for(const [key,scope] of Object.entries(oldScopes)){
    if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
    assert.equal(betaRevision(key,fix,undefined,scope).web,betaRevision(key,base,undefined,scope).web,key+": huella ajena intacta");
  }
  const source=f=>read(f).replace(/\r\n/g,"\n"),current=betaRevision(id,source,undefined,scopes[id]).web;
  assert.equal(current,betaRevision(id,fix,undefined,scopes[id]).web,"la fuente integrada lleva exactamente el CSS revisado");
  assert.notEqual(current,betaRevision(id,base,undefined,scopes[id]).web,"la beta anterior no acredita el arreglo");
  for(const from of ["  .v4-gastos-cats-body.abierto{grid-template-rows:1fr;opacity:1;visibility:inherit;","  .v4-filter-cats.abierto .v4-filter-cats-body{grid-template-rows:1fr;opacity:1;visibility:inherit;"]){
    assert.ok(source("src/shell.html").includes(from),"mutante sobre fuente real: "+from);
    const to=from.replace("visibility:inherit;","visibility:visible;");
    assert.notEqual(betaRevision(id,f=>f==="src/shell.html"?source(f).replace(from,to):source(f),undefined,scopes[id]).web,current,"volver a `visible` invalida: "+from);
  }
  const neighbour="  .v4-gastos-cats-inner{min-height:0;overflow:hidden;}";
  assert.ok(source("src/shell.html").includes(neighbour));
  assert.equal(betaRevision(id,f=>f==="src/shell.html"?source(f).replace(neighbour,neighbour.replace("0;","1px;")):source(f),undefined,scopes[id]).web,current,"una regla vecina no reabre la tanda");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0];
  assert.equal(group.web,current);assert.equal(receipt.web[id],current);
  assert.deepEqual(receipt.pruebas[id],{v:"4.26.114",contenido:JSON.stringify([id,expected114.tandas[0].t.es,expected114.tandas[0].items.es,1])});
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
  for(const g of expected113.tandas)assert.equal(receipt.pruebas[g.id],undefined,"el guion retirado no permanece marcado");
});
// La115 añade UNA nota con UNA tanda (web + APK53) y UN alcance. El arreglo toca la lectura de
// gastos y el envío al widget, que otras tandas ya entregadas también vigilan: aquí se fija, como
// oráculo literal, QUÉ huellas ajenas mueve y cuáles no. Una más o una menos deja esto en rojo.
const expected115={"v":"4.26.115","d":"2026-10-11","t":{"es":"Widget al día","en":"Widget up to date","ca":"Widget al dia"},"items":{"es":["El widget se actualiza al pagar con el móvil aunque la app esté cerrada, sin pedir que la abras. Hace falta instalar la versión nueva de la app."],"en":["The widget updates when you pay with your phone even if the app is closed, without asking you to open it. The new version of the app needs to be installed."],"ca":["El widget s'actualitza en pagar amb el mòbil encara que l'app estigui tancada, sense demanar que l'obris. Cal instal·lar la versió nova de l'app."]},"tandas":[{"id":"widget-pago-app-cerrada","t":{"es":"Widget: pago con la app cerrada","en":"Widget: payment with the app closed","ca":"Widget: pagament amb l'app tancada"},"items":{"es":["1. Instala la versión nueva de la app cuando la beta te la ofrezca y ábrela una vez con conexión, hasta que cargue Inicio.","2. Mira el widget: debe enseñar la misma cifra que «Mi ciclo» en Inicio, sin el aviso «Abre la app para actualizar».","3. Cierra la app del todo y paga algo pequeño con el móvil.","4. Cuando llegue la notificación del gasto, mira el widget: la cifra sube ese importe y no aparece el aviso.","5. Abre la app: Inicio y el widget coinciden, y el pago no está sumado dos veces."],"en":["1. Install the new version of the app when the beta offers it and open it once while online, until Home loads.","2. Look at the widget: it must show the same figure as “My cycle” on Home, without the “Open the app to update” notice.","3. Close the app completely and pay for something small with your phone.","4. When the expense notification arrives, look at the widget: the figure goes up by that amount and the notice does not appear.","5. Open the app: Home and the widget match, and the payment is not counted twice."],"ca":["1. Instal·la la versió nova de l'app quan la beta te l'ofereixi i obre-la una vegada amb connexió, fins que carregui Inici.","2. Mira el widget: ha de mostrar la mateixa xifra que «El meu cicle» a Inici, sense l'avís «Obre l'app per actualitzar».","3. Tanca l'app del tot i paga alguna cosa petita amb el mòbil.","4. Quan arribi la notificació de la despesa, mira el widget: la xifra puja aquest import i no apareix l'avís.","5. Obre l'app: Inici i el widget coincideixen, i el pagament no està sumat dues vegades."]},"apk":53}]};
// Catálogo cerrado: desde la116 se lee de su commit inmutable (la116 mueve la huella web de esta tanda).
test("Catálogo115 histórico añade sólo la tanda del widget y fija qué huellas ajenas mueve su lectura",()=>{
  const read=source115;
  const id="widget-pago-app-cerrada",before=JSON.parse(source114("src/data/release-notes.json"));
  const expected=[expected115,...before];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.length,232);assert.equal(JSON.parse(read("package.json")).version,"4.26.115");
  assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,"una sola vez en todo el catálogo");
  assert.deepEqual(notes[1].tandas.map(g=>g.id),["inicio-solape-gastos"],"la tanda114 sigue pendiente");
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde="widget-app-cerrada";assert.throws(()=>verify(inherited),"no heredar una aprobación");
  const noApk=structuredClone(notes);delete noApk[0].tandas[0].apk;assert.throws(()=>verify(noApk),"sin APK53 no hay nada que probar");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source114("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira");
  // `pullExpenses` cambia de firma: los cuatro alcances del widget ya entregado se reanclan a la
  // cabecera nueva de ESA MISMA unidad. Nada más de ningún descriptor ajeno se mueve.
  const anchorOld='"from":"    async pullExpenses(){"',anchorNew='"from":"    async pullExpenses(readProof){"';
  const reanchored=["fin05-widget-reentrada","fin05-pago-cerrada","widget-app-cerrada","inc-2909-01-widget-periodo"];
  for(const [key,scope] of Object.entries(oldScopes)){
    if(!reanchored.includes(key)){assert.deepEqual(scopes[key],scope,key+": descriptor ajeno intacto");continue;}
    const now=JSON.stringify(scopes[key]);
    assert.equal(now.split(anchorNew).length,2,key+": un solo ancla nueva");assert.equal(now.includes(anchorOld),false);
    assert.equal(now.replace(anchorNew,anchorOld),JSON.stringify(scope),key+": sólo cambia el ancla de pullExpenses");
  }
  const java=file=>"android/app/src/main/java/com/micartera/app/"+file;
  assert.deepEqual(Object.keys(scopes[id]),["web","native","unidades"],"sin Edge: esta beta no despliega ingest y el pago se aplica con la respuesta antigua");
  assert.equal(scopes[id].unidades,true);
  assert.deepEqual(scopes[id].native,["WidgetSnapshotArbiter.java","MiCarteraPlugin.java","TrExpenseListener.java","MiCarteraWidget.java","WidgetPeriod.java"].map(java));
  assert.deepEqual(scopes[id].web,scopes["inc-2909-01-widget-periodo"].web,"mismas162 unidades que ya vigilaban cifra, foto y lectura del widget");
  assert.equal(scopes[id].web.length,162);
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source114("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // Beta114 servida frente al commit revisado del widget: superficies que cambian, una a una.
  const base=source114,fix=sourceAt("844ce4b0e9877210d5333d626e7d7415283687c5"),moved={};
  for(const [key,scope] of Object.entries(oldScopes)){
    if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
    const a=betaRevision(key,base,undefined,scope),b=betaRevision(key,fix,undefined,scopes[key]);
    const surfaces=["web","native","edge"].filter(surface=>a[surface]!==b[surface]);
    if(surfaces.length)moved[key]=surfaces;
  }
  assert.deepEqual(moved,{
    "fin05-widget-reentrada":["web","native"],"fin05-pago-cerrada":["web","native","edge"],
    "tr-descripcion-clasificacion":["native"],"widget-banco":["web","native"],
    "widget-app-cerrada":["web","native","edge"],"inc-3009-nomina-anticipada":["web"],
    "inc-2909-03-retirada":["web"],"inc-2909-01-widget-periodo":["web","native"],
    "feature-0310-01-movilidad":["web"],"inc-0810-metas-editar-regla":["web"]},"sólo quien ya vigilaba la lectura de gastos, el envío al widget o su Java");
  // De las movidas, sólo dos conservan guion en el catálogo y ninguna cambia de texto ni de versión.
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id])).filter(([,key])=>moved[key]),[["4.26.79","inc-2909-03-retirada"],["4.26.78","inc-3009-nomina-anticipada"]]);
  const source=f=>read(f).replace(/\r\n/g,"\n"),current=betaRevision(id,source,undefined,scopes[id]);
  const reviewed=betaRevision(id,fix,undefined,scopes[id]);
  assert.equal(current.web,reviewed.web,"la web integrada es exactamente la revisada");
  assert.equal(current.native,reviewed.native,"el Java integrado es exactamente el revisado");
  assert.equal(current.edge,undefined);
  assert.throws(()=>betaRevision(id,base,undefined,scopes[id]),error=>error.code==="BETA_SCOPE_ABSENT","la beta anterior no acredita el arreglo");
  const main="src/modules/11-app-main.js";
  for(const [file,from,to,surface] of [
    [main,"function(){ done(null); },4000);","function(){ done(null); },9000);","web"],
    [main,"return !mcSandbox()&&native&&native.beginWidgetRead?","return native&&native.beginWidgetRead?","web"],
    [main,"wRead.current=readProof.valid && current","wRead.current=current","web"],
    ["src/modules/00-core.js",'if(await readSession()!==readUser) throw new Error("exp_pull_session_changed");',"","web"],
    [java("MiCarteraWidget.java"),'if (cycle && amount <= -200 && !neutral && !"bizum".equals(category)) return -1;','if (cycle && amount <= -200 && !neutral && !"bizum".equals(category)) return 0;',"native"],
    [java("TrExpenseListener.java"),"finally { MiCarteraWidget.finishIngest(this, widgetTicket); }","finally { }","native"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    for(const other of ["web","native"])assert.equal(changed[other]!==current[other],other===surface,surface+" y sólo "+surface+": "+from);
  }
  const neighbour="  const bankSyncing=useRef(false);";
  assert.equal(source(main).split(neighbour).length,2);
  assert.deepEqual(betaRevision(id,f=>f===main?source(f).replace(neighbour,neighbour.replace("false","true")):source(f),undefined,scopes[id]),current,"un estado vecino no reabre la tanda");
  assert.deepEqual(betaRevision(id,f=>f==="supabase/functions/ingest/widget.ts"?source(f)+"\n// mutante":source(f),undefined,scopes[id]),current,"la fuente de ingest sin desplegar no pertenece a esta tanda");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0];
  assert.equal(group.web,current.web);assert.equal(group.native,current.native);assert.equal(group.codigo,current.codigo);
  assert.equal(group.apk,53);assert.equal(receipt.web[id],current.web);
  assert.deepEqual(receipt.pruebas[id],{v:"4.26.115",contenido:JSON.stringify([id,expected115.tandas[0].t.es,expected115.tandas[0].items.es,1])});
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
  // El recibo web no acredita el binario: sólo la entrega de la APK puede dar su huella nativa.
  assert.equal(JSON.stringify(receipt).includes(current.native),false,"el recibo web no fabrica entrega nativa");
});
// La116 añade UNA nota con DOS tandas: los bancos (sólo web, sin Edge propia: bank-sync ya está
// desplegada) y el widget corregido (web + APK54, identidad nueva: la tanda115 fue rechazada y sale
// del panel sin alias) y DOS alcances. El cliente cambia el sync de bancos, que otras tandas ya entregadas vigilan: aquí se
// fija, como oráculo literal, QUÉ huellas ajenas mueve (la del widget115, aún sin aprobar, incluida).
const expected116={"v":"4.26.116","d":"2026-10-11","t":{"es":"Bancos sin huecos y widget arreglado","en":"Banks without gaps and widget fixed","ca":"Bancs sense forats i widget arreglat"},"items":{"es":["Si pasas días sin sincronizar, ya no se queda nada por el camino: lo que faltaba entra poco a poco cada vez que pulsas sincronizar bancos.","La fecha de «Saldo actualizado» es la de la última lectura real del banco.","Si llevas más de 90 días sin sincronizar un banco, la app te avisa de que el banco solo entrega los últimos 90 días.","El widget vuelve a mostrar tu cifra de «Mi ciclo» y se actualiza al pagar con el móvil aunque la app esté cerrada. Para el pago con la app cerrada hace falta instalar la versión nueva de la app."],"en":["If you go days without syncing, nothing is left behind anymore: what was missing comes in little by little each time you tap sync banks.","The “Balance updated” date is the time of the last real reading from the bank.","If you have gone more than 90 days without syncing a bank, the app tells you that the bank only provides the last 90 days.","The widget shows your “My cycle” figure again and updates when you pay with your phone even if the app is closed. Paying with the app closed needs the new version of the app to be installed."],"ca":["Si passes dies sense sincronitzar, ja no es queda res pel camí: el que faltava entra a poc a poc cada vegada que prems sincronitza bancs.","La data de «Saldo actualitzat» és la de l'última lectura real del banc.","Si portes més de 90 dies sense sincronitzar un banc, l'app t'avisa que el banc només lliura els últims 90 dies.","El widget torna a mostrar la xifra de «El meu cicle» i s'actualitza en pagar amb el mòbil encara que l'app estigui tancada. Per al pagament amb l'app tancada cal instal·lar la versió nova de l'app."]},"tandas":[{"id":"bancos-sin-hueco","t":{"es":"Bancos sin huecos","en":"Banks without gaps","ca":"Bancs sense forats"},"items":{"es":["1. En Cartera, dentro de «Tus cuentas», toca el icono «Sincronizar bancos» y espera a que termine.","2. Abre Gastos: los movimientos nuevos de tus bancos aparecen, cada uno una sola vez, sin repetidos.","3. Vuelve a Cartera y toca el icono «Conectar cuentas» para abrir «Mis bancos»: en cada banco, la línea «Saldo actualizado» marca la hora de ahora.","4. Toca «Sincronizar bancos» otra vez: no aparece ningún movimiento repetido en Gastos y «Saldo actualizado» pasa a la hora nueva."],"en":["1. In Portfolio, inside “Your accounts”, tap the “Sync banks” icon and wait for it to finish.","2. Open Spending: the new transactions from your banks appear, each one only once, with no repeats.","3. Go back to Portfolio and tap the “Connect accounts” icon to open “My banks”: on each bank, the “Balance updated” line shows the time right now.","4. Tap “Sync banks” again: no repeated transaction appears in Spending and “Balance updated” moves to the new time."],"ca":["1. A Cartera, dins de «Els teus comptes», toca la icona «Sincronitza els bancs» i espera que acabi.","2. Obre Despeses: els moviments nous dels teus bancs apareixen, cadascun una sola vegada, sense repetits.","3. Torna a Cartera i toca la icona «Connectar comptes» per obrir «Els meus bancs»: a cada banc, la línia «Saldo actualitzat» marca l'hora d'ara.","4. Toca «Sincronitza els bancs» una altra vegada: no apareix cap moviment repetit a Despeses i «Saldo actualitzat» passa a l'hora nova."]}},{"id":"widget-ciclo-puente","t":{"es":"Widget: cifra de Mi ciclo y pago con la app cerrada","en":"Widget: My cycle figure and payment with the app closed","ca":"Widget: xifra de El meu cicle i pagament amb l'app tancada"},"items":{"es":["1. Actualiza la app web (sin instalar nada todavía) y ábrela: el widget vuelve a mostrar la cifra de «Mi ciclo», sin el aviso «Abre la app para actualizar».","2. Instala la app nueva (54) y ábrela: la cifra del widget sigue igual.","3. Cierra la app del todo y paga algo pequeño con el móvil: cuando llegue la notificación del gasto, la cifra del widget sube ese importe y no sale el aviso.","4. Abre la app: la cifra coincide con la de «Mi ciclo» en Inicio y el pago no está sumado dos veces."],"en":["1. Update the web app (without installing anything yet) and open it: the widget shows the “My cycle” figure again, without the “Open the app to update” notice.","2. Install the new app (54) and open it: the widget figure stays the same.","3. Close the app completely and pay for something small with your phone: when the expense notification arrives, the widget figure goes up by that amount and the notice does not appear.","4. Open the app: the figure matches “My cycle” on Home and the payment is not counted twice."],"ca":["1. Actualitza l'app web (sense instal·lar res encara) i obre-la: el widget torna a mostrar la xifra de «El meu cicle», sense l'avís «Obre l'app per actualitzar».","2. Instal·la l'app nova (54) i obre-la: la xifra del widget continua igual.","3. Tanca l'app del tot i paga alguna cosa petita amb el mòbil: quan arribi la notificació de la despesa, la xifra del widget puja aquest import i no surt l'avís.","4. Obre l'app: la xifra coincideix amb la d'«El meu cicle» a Inici i el pagament no està sumat dues vegades."]},"apk":54}]};
test("Bancos116 conserva el descriptor vivo completo y vigila BankPanel",()=>{
  const id="bancos-sin-hueco",scopes=JSON.parse(read("scripts/beta-sources.json")),scope=scopes[id];
  const verify=current=>{
    assert.deepEqual(Object.keys(current),["web","unidades"]);assert.equal(current.unidades,true);
    assert.deepEqual(current.web.slice(0,7).map(u=>[u.file,u.function||u.data||u.from]),[
      ["src/modules/00-core.js","cloud"],["src/modules/08-motor-bank.js","flattenBankTx"],["src/modules/08-motor-bank.js","importObExpenses"],
      ["src/modules/08-motor-bank.js","reconcileBank"],["src/modules/10-app-components.js","BankPanel"],["src/modules/11-app-main.js","  const avisaSync=function(opts,m){"],
      ["src/modules/11-app-main.js","  // INC-0410 guardado: de aquí al límite está cuándo y qué estado se escribe en disco. Cambiarlo invalida las revisiones que prometen conservar algo al cerrar o recargar."]]);
    assert.ok(current.web[0].members.includes("bankSync"));
  };
  verify(scope);
  const missing=structuredClone(scope);missing.web=missing.web.filter(u=>u.function!=="BankPanel");
  assert.throws(()=>verify(missing),assert.AssertionError,"quitar BankPanel del descriptor vivo falla");
  const file="src/modules/10-app-components.js",fn=logicFunctions(read,[file]).get("BankPanel"),before=betaRevision(id,read,undefined,scope);
  assert.equal(fn.file,file);
  assert.notEqual(betaRevision(id,f=>f===file?mutateLogic(read(f),fn):read(f),undefined,scope).web,before.web,"un cambio real de BankPanel reabre la tanda vigente");
});
// Catálogo cerrado: desde la117 se lee de su commit inmutable (la117 añade nota y versión nuevas).
test("Catálogo116 histórico añade sólo la tanda de los bancos y fija qué huellas ajenas mueve su lectura",()=>{
  const read=source116;
  const id="bancos-sin-hueco",before=JSON.parse(source115("src/data/release-notes.json"));
  const expected=[expected116,{...before[0],tandas:[]},...before.slice(1)];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.length,233);assert.equal(JSON.parse(read("package.json")).version,"4.26.116");
  assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,"una sola vez en todo el catálogo");
  assert.deepEqual(notes[1].tandas,[],"la tanda115 rechazada sale del panel y su nota se conserva");
  assert.equal(notes[0].tandas.length,2);assert.deepEqual(notes[0].tandas.map(g=>[g.id,g.apk||0]),[[id,0],["widget-ciclo-puente",54]]);
  assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id==="widget-pago-app-cerrada").length,0,"la rechazada no sigue en el catálogo vivo");
  assert.deepEqual(notes[2].tandas.map(g=>g.id),["inicio-solape-gastos"],"la tanda114 sigue pendiente");
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde="tr-descripcion-clasificacion";assert.throws(()=>verify(inherited),"no heredar una aprobación");
  const alias=structuredClone(notes);alias[0].tandas[1].desde="widget-pago-app-cerrada";assert.throws(()=>verify(alias),"la corregida no hereda ni alias de la rechazada");
  const noApk=structuredClone(notes);delete noApk[0].tandas[1].apk;assert.throws(()=>verify(noApk),"sin APK54 no hay widget que probar");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=54;assert.throws(()=>verify(withApk),"no hay APK que probar");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source115("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id,"widget-ciclo-puente"]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira: el de la rechazada queda como historia");
  for(const [key,scope] of Object.entries(oldScopes))assert.deepEqual(scopes[key],scope,key+": descriptor ajeno intacto");
  assert.deepEqual(scopes["widget-ciclo-puente"],scopes["widget-pago-app-cerrada"],"la corregida vigila exactamente las mismas unidades web y los mismos cinco Java");
  assert.deepEqual(Object.keys(scopes[id]),["web","unidades"],"sin APK ni Edge: bank-sync ya está desplegada y el APK se queda en 53");
  assert.equal(scopes[id].unidades,true);
  // Las seis piezas (y el límite de guardado, porque el sync escribe estado) del cliente van primero; el resto son sus dependencias transitivas, que exigen las auditorías de lógica, datos y métodos de cloud.
  assert.equal(scopes[id].web.length,148);
  assert.deepEqual(scopes[id].web.slice(0,7).map(u=>[u.file,u.function||u.data||u.from]),[
    ["src/modules/00-core.js","cloud"],["src/modules/08-motor-bank.js","flattenBankTx"],["src/modules/08-motor-bank.js","importObExpenses"],
    ["src/modules/08-motor-bank.js","reconcileBank"],["src/modules/10-app-components.js","BankPanel"],["src/modules/11-app-main.js","  const avisaSync=function(opts,m){"],["src/modules/11-app-main.js","  // INC-0410 guardado: de aquí al límite está cuándo y qué estado se escribe en disco. Cambiarlo invalida las revisiones que prometen conservar algo al cerrar o recargar."]]);
  assert.ok(scopes[id].web[0].members.includes("bankSync"));
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source115("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // Beta115 servida frente a la fuente integrada: superficies que cambian, una a una.
  const base=source115,moved={};
  for(const [key,scope] of Object.entries(oldScopes)){
    if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
    const a=betaRevision(key,base,undefined,scope),b=betaRevision(key,read,undefined,scopes[key]);
    const surfaces=["web","native","edge"].filter(surface=>a[surface]!==b[surface]);
    if(surfaces.length)moved[key]=surfaces;
  }
  assert.deepEqual(moved,{
    "inc-3009-01-cargos":["web"],"fin05-widget-reentrada":["web","native"],"fin05-pago-cerrada":["web","native"],
    "tr-descripcion-clasificacion":["web","edge"],"widget-banco":["web","native"],"widget-app-cerrada":["web","native"],
    "inc-2909-02-inicio-natural":["web"],"inc-3009-nomina-anticipada":["web"],"inc-2909-01-widget-periodo":["web","native"],
    "inc-0810-metas-editar-regla":["web"],"widget-pago-app-cerrada":["web","native"]},"sólo quien ya vigilaba el sync de bancos o la importación de movimientos");
  // De las movidas, tres conservan guion en el catálogo (la del widget115 ya no: rechazada) y ninguna cambia de texto ni de versión.
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id])).filter(([,key])=>moved[key]),[["4.26.78","inc-3009-nomina-anticipada"],["4.26.74","inc-3009-01-cargos"],["4.26.73","inc-2909-02-inicio-natural"]]);
  const main="src/modules/11-app-main.js",motor="src/modules/08-motor-bank.js";
  const source=f=>read(f).replace(/\r\n/g,"\n"),current=betaRevision(id,source,undefined,scopes[id]);
  const wid="widget-ciclo-puente",widget=betaRevision(wid,source,undefined,scopes[wid]),java=file=>"android/app/src/main/java/com/micartera/app/"+file;
  assert.deepEqual(betaRevision("widget-pago-app-cerrada",source,undefined,scopes["widget-pago-app-cerrada"]),widget,"misma huella que la rechazada: lo que cambia es la identidad, no el alcance");
  assert.notEqual(widget.web,betaRevision("widget-pago-app-cerrada",source115,undefined,scopes["widget-pago-app-cerrada"]).web,"la web corregida no es la que se rechazó");
  assert.notEqual(widget.native,betaRevision("widget-pago-app-cerrada",source115,undefined,scopes["widget-pago-app-cerrada"]).native,"el Java corregido no es el que se rechazó");
  for(const [file,from,to,surface] of [
    [main,"periodStart:budW.periodStart+(wV2===53&&budW.cycle?.5:0)","periodStart:budW.periodStart","web"],
    [main,"return i&&i.versionCode||true;","return true;","web"],
    [java("MiCarteraPlugin.java"),"Number period = bridgeNumber(call, \"periodStart\");","Number period = null;","native"],
    [java("MiCarteraPlugin.java"),"return value instanceof Number ? (Number) value : null;","return null;","native"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(wid,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[wid]);
    for(const other of ["web","native"])assert.equal(changed[other]!==widget[other],other===surface,surface+" y sólo "+surface+": "+from);
  }
  assert.equal(current.native,undefined);assert.equal(current.edge,undefined);
  assert.notEqual(current.web,betaRevision("widget-pago-app-cerrada",source,undefined,scopes["widget-pago-app-cerrada"]).web);
  assert.notEqual(betaRevision(id,source115,undefined,scopes[id]).web,current.web,"la beta anterior no acredita el cliente");
  // Cada unidad vigilada reabre la tanda; la vecina no.
    for(const [file,from,to] of [
    ["src/modules/00-core.js","sb.functions.invoke('bank-sync',{ body })","sb.functions.invoke('bank-sync')"],
    [main,"cloud.bankSync({recoverGaps:true})","cloud.bankSync()"],
    [main,"if(l&&l.gapBeyondCap) avisaSync","if(l&&l.gapBeyondCapX) avisaSync"],
    [main,"importObExpenses(prev, txs, links)","importObExpenses(prev, txs)"],
    [main,"if(l&&l.balanceAt) balAt[l.aspsp]=l.balanceAt;","if(l&&l.balanceAt) balAt[l.aspsp]=null;"],
    [motor,"l.syncFrom<=tx.date","l.syncFrom<tx.date"],
    [motor,"new Date(y,m-1,-7).getDate() : 15;","new Date(y,m-1,-7).getDate() : 14;"],
    ["src/modules/10-app-components.js","const saldoAt=(state.obBalAt||{})[l.aspsp_name]||l.last_sync;","const saldoAt=l.last_sync;"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.web,current.web,"reabre la tanda: "+from);
  }
  const neighbour="  const bankSyncing=useRef(false);";
  assert.equal(source(main).split(neighbour).length,2);
  assert.deepEqual(betaRevision(id,f=>f===main?source(f).replace(neighbour,neighbour.replace("false","true")):source(f),undefined,scopes[id]),current,"un estado vecino no reabre la tanda");
  assert.deepEqual(betaRevision(id,f=>f==="supabase/functions/bank-sync/index.ts"?source(f)+"\n// mutante":source(f),undefined,scopes[id]),current,"la Edge ya desplegada no pertenece a esta tanda");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0],wgroup=built[0].tandas[1];
  assert.equal(group.web,current.web);assert.equal(group.native,undefined);assert.equal(group.edge,undefined);assert.equal(group.apk,undefined);
  assert.equal(wgroup.id,wid);assert.equal(wgroup.web,widget.web);assert.equal(wgroup.native,widget.native);assert.equal(wgroup.apk,54);assert.equal(wgroup.edge,undefined);
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","edge"])assert.equal(wgroup[key],undefined,"la corregida nace sin "+key);
  assert.equal(receipt.web[id],current.web);
  assert.deepEqual(receipt.pruebas[id],{v:"4.26.116",contenido:JSON.stringify([id,expected116.tandas[0].t.es,expected116.tandas[0].items.es,1])});
  assert.equal(receipt.pruebas["widget-pago-app-cerrada"],undefined,"el guion rechazado no permanece marcado");
  assert.deepEqual(receipt.pruebas[wid],{v:"4.26.116",contenido:JSON.stringify([wid,expected116.tandas[1].t.es,expected116.tandas[1].items.es,1])});
  assert.equal(JSON.stringify(receipt).includes(widget.native),false,"el recibo web no fabrica entrega nativa");
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});
// La117 añade UNA nota con UNA tanda (sólo web: el nativo no cambia, la APK sigue en la 54) y UN
// alcance: la pantalla de entrada nueva. Toca el CSS del splash, el script del <head> y un efecto de
// App, que ninguna otra tanda vigila (el bloque del mínimo de 520 ms de inc-2709-01-arranque-red
// queda intacto a propósito: ese alcance está auditado). Se fija como oráculo literal que NINGUNA
// huella ajena se mueve; si algún día se mueve una, este test la nombra en vez de reabrirla en silencio.
const expected117={"v":"4.26.117","d":"2026-10-12","t":{"es":"Nueva pantalla de entrada","en":"New opening screen","ca":"Nova pantalla d'entrada"},"items":{"es":["Nueva pantalla de entrada: el logo aparece con una luz suave mientras la app se prepara, y al entrar todo responde desde el primer gesto. En tema claro el nombre ya se lee bien."],"en":["New opening screen: the logo appears with a soft glow while the app gets ready, and everything responds from the very first swipe. The name is now easy to read in the light theme."],"ca":["Nova pantalla d'entrada: el logotip apareix amb una llum suau mentre l'app es prepara, i en entrar tot respon des del primer gest. Amb el tema clar el nom ja es llegeix bé."]},"tandas":[{"id":"splash-animado","t":{"es":"Nueva pantalla de entrada","en":"New opening screen","ca":"Nova pantalla d'entrada"},"items":{"es":["1. Actualiza la app y ciérrala del todo (quítala de recientes); el cambio se ve en la segunda apertura tras actualizar. Ábrela: debe verse la tarjeta con el logo, una luz verde suave que respira detrás y el nombre debajo, sin barras ni cortes.","2. Fíjate en el momento de entrar: primero desaparece el logo y después el fondo. En ningún instante debe verse el logo encima de la pantalla de Inicio.","3. Nada más entrar, desliza a Gastos, Plan y Cartera. Deben ir fluidas desde el primer deslizamiento.","4. En Ajustes pon el tema claro, cierra la app del todo y ábrela. No debe haber fogonazo ni salto brusco de color, y «Aely» debe leerse bien."],"en":["1. Update the app and close it completely (remove it from recent apps); the change shows on the second opening after updating. Open it: you should see the card with the logo, a soft green glow breathing behind it and the name below, with no bars or cuts.","2. Watch the moment you enter: first the logo disappears and then the background. At no point should the logo be visible on top of the Home screen.","3. Right after entering, swipe to Spending, Plan and Portfolio. They should be smooth from the very first swipe.","4. In Settings choose the light theme, close the app completely and open it. There should be no flash or abrupt colour jump, and “Aely” should be easy to read."],"ca":["1. Actualitza l'app i tanca-la del tot (treu-la de recents); el canvi es veu a la segona obertura després d'actualitzar. Obre-la: s'ha de veure la targeta amb el logotip, una llum verda suau que respira al darrere i el nom a sota, sense barres ni talls.","2. Fixa't en el moment d'entrar: primer desapareix el logotip i després el fons. En cap instant s'ha de veure el logotip damunt de la pantalla d'Inici.","3. Just en entrar, llisca a Despeses, Pla i Cartera. Han d'anar fluides des del primer lliscament.","4. A Ajustos posa el tema clar, tanca l'app del tot i obre-la. No hi ha d'haver cap fogonada ni salt brusc de color, i «Aely» s'ha de llegir bé."]}}]};
{
const read=sourceAt("c5f62d6603d016150afd9d0e20547b608b323045");
test("Catálogo117 añade sólo la tanda de la pantalla de entrada y no mueve ninguna huella ajena",()=>{
  const id="splash-animado",before=JSON.parse(source116("src/data/release-notes.json"));
  // Retiro117: bancos-sin-hueco, APROBADA en el móvil (12/10, 4 ok / 0 fallos sobre 4.26.116.1), sale del panel; su nota, su descriptor y todo el historial se quedan.
  const retired="bancos-sin-hueco";
  const expected=[expected117,{...before[0],tandas:before[0].tandas.filter(g=>g.id!==retired)},...before.slice(1)];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.length,234);assert.equal(JSON.parse(read("package.json")).version,"4.26.117");
  assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,"una sola vez en todo el catálogo");
  assert.deepEqual(notes[0].tandas.map(g=>[g.id,g.apk||0]),[[id,0]],"sin APK: el nativo no cambia");
  assert.deepEqual(notes[1].tandas.map(g=>[g.id,g.apk||0]),[["widget-ciclo-puente",54]],"el widget116 sigue pendiente de veredicto");
  assert.deepEqual(notes[3].tandas.map(g=>g.id),["inicio-solape-gastos"],"la tanda114 sigue pendiente");
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde="inc-2709-01-arranque-red";assert.throws(()=>verify(inherited),"no heredar una aprobación");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=54;assert.throws(()=>verify(withApk),"no hay APK que probar");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source116("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira");
  for(const [key,scope] of Object.entries(oldScopes))assert.deepEqual(scopes[key],scope,key+": descriptor ajeno intacto");
  assert.deepEqual(Object.keys(scopes[id]),["web"],"sin APK, Edge ni unidades: son trozos de shell.html y un efecto de App");
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source116("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // Beta116 publicada frente a la fuente integrada: ninguna huella ajena se mueve, ni la de arranque-red.
  const moved={};
  for(const [key,scope] of Object.entries(oldScopes)){
    if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
    const a=betaRevision(key,source116,undefined,scope),b=betaRevision(key,read,undefined,scopes[key]);
    const surfaces=["web","native","edge"].filter(surface=>a[surface]!==b[surface]);
    if(surfaces.length)moved[key]=surfaces;
  }
  assert.deepEqual(moved,{},"la pantalla de entrada no reabre ninguna tanda ajena");
  const shell="src/shell.html",main="src/modules/11-app-main.js";
  const source=f=>read(f).replace(/\r\n/g,"\n"),current=betaRevision(id,source,undefined,scopes[id]);
  assert.equal(current.native,undefined);assert.equal(current.edge,undefined);
  assert.throws(()=>betaRevision(id,source116,undefined,scopes[id]),/no inequívoco/,"la beta anterior ni siquiera contiene la pantalla nueva: no la acredita");
  // Cada pieza vigilada reabre la tanda.
  for(const [file,from,to] of [
    [shell,"var _s=JSON.parse(localStorage.getItem(_k));","var _s=JSON.parse(localStorage.getItem(_k+\"x\"));"],
    [shell,"animation:mclpop .5s cubic-bezier(.32,.72,0,1) backwards;}","animation:mclpop .5s cubic-bezier(.32,.72,0,1) both;}"],
    [shell,"html[data-mc-nativo] #mc-load::before{content:\"\";position:absolute;inset:0;background:#0A1310;","html[data-mc-nativo] #mc-load::before{content:\"\";position:absolute;inset:0;background:#0A1311;"],
    [shell,"html[data-theme=\"light\"] #mc-load .mcl-name{color:var(--text);}","html[data-theme=\"light\"] #mc-load .mcl-name{color:var(--brand-word);}"],
    [shell,"<div class=\"mcl-mark\" aria-hidden=\"true\">","<div class=\"mcl-mark\">"],
    [main,"if(state.onboarded===false||locked||window.__mcSplashGone||!document.getElementById(\"mc-load\")) return;","if(state.onboarded===false||locked||window.__mcSplashGone) return;"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.web,current.web,"reabre la tanda: "+from);
  }
  // El mínimo de 520 ms del vigilante (alcance auditado de inc-2709-01-arranque-red) no se toca: lo cubre moved={} de arriba.
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0];
  assert.equal(group.web,current.web);assert.equal(group.native,undefined);assert.equal(group.edge,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[id],current.web);
  assert.deepEqual(receipt.pruebas[id],{v:"4.26.117",contenido:JSON.stringify([id,expected117.tandas[0].t.es,expected117.tandas[0].items.es,1])});
  assert.deepEqual(receipt.pruebas["widget-ciclo-puente"].v,"4.26.116","la prueba116 sigue en el recibo");
  assert.equal(receipt.web[retired],betaRevision(retired,read,undefined,scopes[retired]).web,"el producto sigue íntegro");assert.equal(receipt.pruebas[retired],undefined,"el guion aprobado no permanece marcado");
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});
test("Retiro117 elimina solo bancos-sin-hueco y conserva todo el historial",()=>{
  const id="bancos-sin-hueco",before=JSON.parse(source116("src/data/release-notes.json")),notes=JSON.parse(read("src/data/release-notes.json"));
  assert.equal(before[0].tandas.some(g=>g.id===id),true,"la 116 publicada la llevaba");
  assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===id),false,"ya no está en ninguna nota");
  assert.deepEqual(notes.length,before.length+1,"ninguna nota se borra");
  // La nota116 conserva versión, fecha, título y textos; solo pierde esa tanda y conserva la del widget, sin veredicto, con su APK.
  assert.deepEqual(notes[1],{...before[0],tandas:before[0].tandas.filter(g=>g.id!==id)});
  assert.deepEqual(notes.slice(2),before.slice(1),"el resto del catálogo, intacto");
  const resurrected=structuredClone(notes);resurrected[1].tandas.unshift(before[0].tandas.find(g=>g.id===id));
  assert.notDeepEqual(resurrected,notes,"no resucitar la tanda aprobada");
  const scopes=JSON.parse(read("scripts/beta-sources.json")),old=JSON.parse(source116("scripts/beta-sources.json"));
  assert.deepEqual(scopes[id],old[id],"el descriptor queda como historia");
  const widget="widget-ciclo-puente";
  assert.deepEqual(scopes[widget],old[widget]);
  assert.deepEqual(betaRevision(widget,read,undefined,scopes[widget]),betaRevision(widget,source116,undefined,old[widget]),"la huella del widget sigue idéntica tras el retiro y el splash");
  const receipt=betaDelivery(betaNotes(notes,read,scopes),read,scopes);
  assert.equal(receipt.web[id],betaRevision(id,read,undefined,scopes[id]).web,"el producto sigue íntegro");assert.equal(receipt.pruebas[id],undefined,"el guion aprobado no permanece marcado");
  assert.equal(receipt.web[widget],betaRevision(widget,read,undefined,scopes[widget]).web);
});
}
test("Splash117 conserva descriptor vivo, mutantes y retirada del panel",()=>{
  const id="splash-animado",snapshot=source117,scopes=JSON.parse(read("scripts/beta-sources.json"));
  assert.deepEqual(scopes[id],JSON.parse(snapshot("scripts/beta-sources.json"))[id],"no recortar el descriptor vigente del splash");
  const source=f=>read(f).replace(/\r\n/g,"\n"),before=betaRevision(id,source,undefined,scopes[id]);
  for(const [file,from,to] of [
    ["src/shell.html",'var _s=JSON.parse(localStorage.getItem(_k));','var _s=JSON.parse(localStorage.getItem(_k+"x"));'],
    ["src/shell.html",'animation:mclpop .5s cubic-bezier(.32,.72,0,1) backwards;}','animation:mclpop .5s cubic-bezier(.32,.72,0,1) both;}'],
    ["src/shell.html",'html[data-mc-nativo] #mc-load::before{content:"";position:absolute;inset:0;background:#0A1310;','html[data-mc-nativo] #mc-load::before{content:"";position:absolute;inset:0;background:#0A1311;'],
    ["src/shell.html",'html[data-theme="light"] #mc-load .mcl-name{color:var(--text);}','html[data-theme="light"] #mc-load .mcl-name{color:var(--brand-word);}'],
    ["src/shell.html",'<div class="mcl-mark" aria-hidden="true">','<div class="mcl-mark">'],
    ["src/modules/11-app-main.js",'if(state.onboarded===false||locked||window.__mcSplashGone||!document.getElementById("mc-load")) return;','if(state.onboarded===false||locked||window.__mcSplashGone) return;']
  ]){
    assert.equal(source(file).split(from).length,2,"mutación de fuente actual: "+from);
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]).web,before.web,"reabre el splash vigente: "+from);
  }
  const notes=JSON.parse(read("src/data/release-notes.json")),receipt=betaDelivery(betaNotes(notes,read,scopes),read,scopes);
  assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id==="bancos-sin-hueco"),false,"no resucitar la tanda retirada en117");
  assert.equal(receipt.pruebas["bancos-sin-hueco"],undefined);
  assert.equal(receipt.web[id],before.web,"la tanda vigente usa la fuente actual");
});

test("Bienes113 vigila la puerta vacía, ficha, cancelación, borrado y textos",()=>{
  const source=f=>read(f).replace(/\r\n/g,"\n"),id="bienes-completo",before=betaRevision(id,source).web;
  for(const [file,from,to] of [
    ["src/modules/14-v4-screens.js",'{ id:"bienes", label:t("pt_goods")','(state.assets||[]).length>0 && { id:"bienes", label:t("pt_goods")'],
    ["src/modules/07-tab-patri-fijos.js",'setSheetAsset({});','setSheetAsset(null);'],
    ["src/modules/07-tab-patri-fijos.js",'if(!valid) return;','if(false) return;'],
    ["src/modules/07-tab-patri-fijos.js",'if(!ok) return;','if(false) return;'],
    ["src/modules/07-tab-patri-fijos.js",'onClick:onClose},t("fj_cancel")','onClick:save},t("fj_cancel")'],
    ["src/modules/01-i18n.js",'goods_delete_sub:"Dejará de contar','goods_delete_sub:"Texto cambiado'],
    ["src/modules/01-i18n.js",'goods_delete_sub:"It will no longer count','goods_delete_sub:"Changed text'],
    ["src/modules/01-i18n.js",'goods_delete_sub:"Deixarà de comptar','goods_delete_sub:"Text canviat'],
  ]){
    assert.ok(source(file).includes(from),"mutante sobre fuente real: "+from);
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(from,to):source(f)).web,before,from);
  }
});


test("Promoción117 muestra una nota y el historial de producción sin perder contratos",()=>{
  // Contrato de la producción117 tal como se fusionó (0a623768): la118 añade encima nota,
  // tanda y producto, y este oráculo no debe pasar a describir una entrega posterior.
  const read=sourceProd117,scopes=JSON.parse(read("scripts/beta-sources.json"));
  const source=sourceAt("b2dfd2c01d7ec6a9a30b74ae71d473054932c42f"),beta=source117;
  const notes=JSON.parse(read("src/data/release-notes.json")),production=JSON.parse(source("src/data/release-notes.json"));
  assert.equal(notes[0].v,"4.26.117");assert.equal(notes.length,227);
  assert.deepEqual(notes.slice(1),production.map(n=>({...n,tandas:[]})),"historial visible de main íntegro, una fecha y un título por versión");
  assert.equal(new Set(notes.map(n=>n.v)).size,notes.length);
  for(const n of notes)assert.deepEqual(n.tandas,[],n.v+": nunca resucitar /todo");
  for(const v of ["4.26.109","4.26.112"])assert.equal(notes.some(n=>n.v===v),false,v+": nota intermedia ausente de Novedades");
  for(const lang of ["es","en","ca"]){assert.ok(notes[0].t[lang]);assert.equal(notes[0].items[lang].length,4);}
  assert.deepEqual(notes[0].items,{"es":["La pantalla de entrada se renueva y prepara las pestañas para que estén listas al entrar.","Los bancos recuperan movimientos pendientes y muestran cuándo se actualizó cada saldo.","Al actualizar la app, el widget se pone al día cuando pagas con el móvil, aunque la app esté cerrada.","Inicio ya no muestra encima el desglose de Gastos."],"en":["The new welcome screen prepares the tabs so they are ready when you enter.","Banks recover pending transactions and show when each balance was updated.","After updating the app, the widget updates when you pay with your phone, even while the app is closed.","Home no longer shows the Expenses breakdown over it."],"ca":["La pantalla d’entrada es renova i prepara les pestanyes perquè estiguin a punt en entrar.","Els bancs recuperen moviments pendents i mostren quan s’ha actualitzat cada saldo.","En actualitzar l’app, el giny es posa al dia quan pagues amb el mòbil, encara que l’app estigui tancada.","Inici ja no mostra al damunt el desglossament de Despeses."]});
  assert.deepEqual(JSON.parse(read("scripts/beta-sources.json")),JSON.parse(beta("scripts/beta-sources.json")),"ningún descriptor se recorta");
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(beta("scripts/beta-archives.json")),"archivo y rechazo109 no se repinan");
  for(const file of JSON.parse(read("src/build-order.json")).map(f=>"src/modules/"+f).concat("src/shell.html"))assert.equal(read(file).replace(/\r\n/g,"\n"),beta(file).replace(/\r\n/g,"\n"),file+": producto117 aprobado idéntico");
  const receipt=betaDelivery(betaNotes(notes,read,scopes),read,scopes);
  assert.deepEqual(receipt.pruebas,{});assert.equal(receipt.referenciasHistoricas[archiveId].estado,"ausente");
  for(const id of ["splash-animado","widget-ciclo-puente","inicio-solape-gastos"])assert.equal(receipt.web[id],betaRevision(id,read,undefined,scopes[id]).web,id+": entrega web independiente del catálogo visible");
});

// 4.26.118 (12/10/2026): la primera beta tras la promoción117 lleva una sola tanda, la de los
// recibos, sobre un catálogo de producción sin tandas. El arreglo cambia el motor que decide si
// un recibo está pagado, que diez tandas ya entregadas o retiradas vigilaban: aquí se fija, como
// lista cerrada, qué descriptores crecen, qué huellas se mueven y por qué. Ninguna vuelve al panel.
const expected118={"v":"4.26.118","d":"2026-10-12","t":{"es":"Recibos: cada cobro, en su recibo","en":"Bills: each charge on its own bill","ca":"Rebuts: cada cobrament, al seu rebut"},"items":{"es":["Un mismo cobro del banco ya no marca como pagados dos recibos a la vez, y un recibo con el mismo nombre en otro banco no da por pagado el que no es.","Un recibo se reconoce como pagado también cuando el pago salió de otro banco, si coinciden el nombre y el importe exacto.","Cambiar el día de un recibo que el banco ya cobró no vuelve a descontarlo del saldo previsto."],"en":["A single bank charge no longer marks two bills as paid at once, and a bill with the same name at another bank no longer counts as payment for the wrong one.","A bill is also recognised as paid when the payment came out of another bank, as long as the name and the exact amount match.","Changing the day of a bill the bank has already charged no longer takes it off your expected balance again."],"ca":["Un mateix cobrament del banc ja no marca com a pagats dos rebuts alhora, i un rebut amb el mateix nom en un altre banc no dona per pagat el que no és.","Un rebut també es reconeix com a pagat quan el pagament ha sortit d'un altre banc, si coincideixen el nom i l'import exacte.","Canviar el dia d'un rebut que el banc ja ha cobrat no el torna a descomptar del saldo previst."]},"tandas":[{"id":"recibos-cargo-unico","t":{"es":"Recibos: cada cargo paga un solo recibo","en":"Bills: each charge pays a single bill","ca":"Rebuts: cada càrrec paga un sol rebut"},"items":{"es":["1. Abre Plan → Recibos y despliega «Ya has pagado»: no falta ninguno de los recibos que el banco ya cobró este mes, ninguno sale repetido y cada uno conserva el día en que se cobró.","2. En Gastos, busca un cargo de este mes que haya entrado solo (del banco o por el aviso del móvil, no apuntado a mano) y que todavía no tenga recibo; por ejemplo, una suscripción. En Plan → Recibos → «Gestionar» → «+ Añadir un recibo», crea uno con el nombre del comercio (basta su palabra principal, de cuatro letras o más: «Netflix»), el importe exacto y la cuenta de la que salió. Debe aparecer en «Ya has pagado» con el día real del cargo y no debe salir en «Próximos cargos» de Inicio.","3. Añade un segundo recibo idéntico (mismo nombre, importe y cuenta): los dos pasan a pendientes, porque un cargo no puede pagar dos recibos. Entra en el duplicado y pulsa «Quitar este recibo»: el primero vuelve a «Ya has pagado».","4. Elige uno de tus recibos de siempre que el banco ya haya cobrado este mes, ábrelo desde «Gestionar» y cambia el día a uno posterior a hoy. Debe seguir una sola vez en «Ya has pagado» con el día en que se cobró, y ni «Queda por pagar» ni el saldo más bajo previsto de arriba deben cambiar. Después devuélvele su día.","5. Quita el recibo de prueba con «Quitar este recibo»: Plan e Inicio quedan como antes de empezar."],"en":["1. Open Plan → Bills and unfold “You already paid”: none of the bills the bank has already charged this month is missing, none appears twice and each one keeps the day it was charged.","2. In Spending, find a charge from this month that came in by itself (from the bank or from the phone notification, not entered by hand) and that has no bill yet; a subscription, for example. In Plan → Bills → “Manage” → “+ Add a bill”, create one with the merchant's name (its main word is enough, four letters or more: “Netflix”), the exact amount and the account it came out of. It should appear under “You already paid” with the real day of the charge, and it should not show in “Upcoming” on Home.","3. Add a second identical bill (same name, amount and account): both go back to pending, because one charge cannot pay two bills. Open the duplicate and tap “Remove this bill”: the first one returns to “You already paid”.","4. Pick one of your usual bills that the bank has already charged this month, open it from “Manage” and change the day to one later than today. It should stay only once under “You already paid” with the day it was charged, and neither “Still to pay” nor the lowest expected balance at the top should change. Then set its day back.","5. Remove the test bill with “Remove this bill”: Plan and Home are left as they were before you started."],"ca":["1. Obre Pla → Rebuts i desplega «Ja has pagat»: no hi falta cap dels rebuts que el banc ja ha cobrat aquest mes, cap surt repetit i cadascun conserva el dia en què es va cobrar.","2. A Despeses, busca un càrrec d'aquest mes que hagi entrat sol (del banc o per l'avís del mòbil, no apuntat a mà) i que encara no tingui rebut; per exemple, una subscripció. A Pla → Rebuts → «Gestionar» → «+ Afegir un rebut», crea'n un amb el nom del comerç (n'hi ha prou amb la paraula principal, de quatre lletres o més: «Netflix»), l'import exacte i el compte d'on va sortir. Ha d'aparèixer a «Ja has pagat» amb el dia real del càrrec i no ha de sortir a «Pròxims càrrecs» d'Inici.","3. Afegeix un segon rebut idèntic (mateix nom, import i compte): tots dos passen a pendents, perquè un càrrec no pot pagar dos rebuts. Entra al duplicat i prem «Treu aquest rebut»: el primer torna a «Ja has pagat».","4. Tria un dels teus rebuts de sempre que el banc ja hagi cobrat aquest mes, obre'l des de «Gestionar» i canvia el dia a un de posterior a avui. Ha de continuar una sola vegada a «Ja has pagat» amb el dia en què es va cobrar, i ni «Queda per pagar» ni el saldo més baix previst de dalt han de canviar. Després torna-li el seu dia.","5. Treu el rebut de prova amb «Treu aquest rebut»: Pla i Inici queden com abans de començar."]}}]};
// Catálogo cerrado: desde la119 se lee de su commit inmutable (la119 añade nota, tanda y alcance nuevos).
test("Catálogo118 histórico añade sólo la tanda de los recibos y declara cada huella ajena que mueve",()=>{
  const read=source118;
  const id="recibos-cargo-unico",production=JSON.parse(sourceProd117("src/data/release-notes.json"));
  const expected=[expected118,...production];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,"una sola vez en todo el catálogo");
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[[notes[0].v,id,0]],"el panel sólo puede enseñar la tanda nueva, sin APK: el nativo no cambia");
  for(const n of notes.slice(1))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,3,lang+": tres puntos familiares");
    assert.equal(notes[0].tandas[0].items[lang].length,5,lang+": cinco pasos");
    notes[0].tandas[0].items[lang].forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)));
  }
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde="inc-3009-01-cargos";assert.throws(()=>verify(inherited),"no heredar la aprobación de la tanda de cargos");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verify(withApk),"no hay APK que probar");
  const resurrected=structuredClone(notes);resurrected[1].tandas=JSON.parse(source117("src/data/release-notes.json"))[0].tandas;assert.throws(()=>verify(resurrected),"no resucitar la tanda del splash, ya promocionada");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source117("scripts/beta-sources.json"));
  assert.deepEqual(JSON.parse(sourceProd117("scripts/beta-sources.json")),oldScopes,"la promoción no tocó ningún descriptor: beta117 y producción117 parten del mismo catálogo");
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira");
  // Las diez tandas que ya leían `fixedPaymentState` ganan sus helpers nuevos: lo exigen las
  // auditorías de dependencias. Sólo se AÑADEN unidades del motor; nada se recorta ni se reordena.
  const helpers=["fixedPaymentUnique","fixedPaymentAutoOwner","fixedPaymentExpenses","fixedPaymentExpenseRows","fixedPaymentExpenseChoice","DUP_DIAS_MS"];
  // El motivo es el mismo para las diez y se comprueba: su alcance ya incluía la decisión
  // «¿está pagado este recibo?». El valor dice si la beta117 servida aún la pedía en el panel.
  const consumers={
    "inc-3009-01-cargos":true,"inc-2909-02-inicio-natural":true,"inc-3009-nomina-anticipada":true,
    "inc-2909-03-retirada":true,"inc-0210-01-plan-cuota":true,"inc-0210-03-gastos-periodo":true,
    "feature-0310-01-movilidad":false,"inc-0310-gastos-sin-limite":false,"inc-0710-gastos-mes-madrid":false,"bancos-sin-hueco":false};
  const reads=scope=>scope.web.some(u=>u.function==="fixedPaymentState");
  assert.deepEqual(Object.keys(oldScopes).filter(key=>reads(oldScopes[key])),Object.keys(consumers),"quién leía ya el pago de recibos");
  const panel117=JSON.parse(source117("src/data/release-notes.json")).flatMap(n=>(n.tandas||[]).map(g=>g.id));
  for(const [key,live] of Object.entries(consumers))assert.equal(panel117.includes(key),live,key+": seis seguían en el panel de beta117 y cuatro ya estaban retiradas");
  const grown=[];
  for(const [key,scope] of Object.entries(oldScopes)){
    if(JSON.stringify(scopes[key])===JSON.stringify(scope))continue;
    grown.push(key);
    const {web,...rest}=scopes[key],{web:oldWeb,...oldRest}=scope;
    assert.deepEqual(rest,oldRest,key+": sólo cambia la lista web");
    const kept=web.filter(u=>oldWeb.some(o=>JSON.stringify(o)===JSON.stringify(u))),added=web.filter(u=>!kept.includes(u));
    assert.deepEqual(kept,oldWeb,key+": ninguna unidad anterior se pierde ni cambia de orden");
    assert.ok(added.length>0&&added.every(u=>u.file==="src/modules/08-motor-bank.js"&&helpers.includes(u.function||u.data)&&Object.keys(u).length===2),key+": sólo helpers del motor de recibos");
  }
  assert.deepEqual(grown,Object.keys(consumers),"descriptores que crecen: lista cerrada");
  assert.deepEqual(Object.keys(scopes[id]),["web","unidades"],"sin APK ni Edge: es sólo web");
  assert.equal(scopes[id].unidades,true);
  assert.deepEqual(scopes[id].web,scopes["inc-3009-01-cargos"].web,"mismas unidades que ya vigilaban Plan, Inicio, la ficha del gasto y el guardado");
  assert.equal(scopes[id].historial,undefined,"identidad nueva: no hereda el historial de cargos");
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source117("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // Lista cerrada de huellas: una que se mueva sin declarar, o una declarada que no se mueva, es rojo.
  const movedFrom=base=>{
    const moved={};
    for(const [key,scope] of Object.entries(oldScopes)){
      if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
      const a=betaRevision(key,base,undefined,scope),b=betaRevision(key,read,undefined,scopes[key]);
      const surfaces=["web","native","edge"].filter(surface=>a[surface]!==b[surface]);
      if(surfaces.length)moved[key]=surfaces;
    }
    return moved;
  };
  const declared=Object.fromEntries(Object.keys(consumers).map(key=>[key,["web"]]));
  assert.deepEqual(movedFrom(sourceProd117),declared,"frente a producción117, esta entrega mueve sólo las diez que leen el pago de recibos");
  // Frente a la beta117 servida se suman dos del propio panel: vigilan
  // scripts/listo-para-produccion.mjs, que cambió la promoción117 y no esta entrega.
  const promotion={"beta-panel-veredictos":["web"],"ops-0410-panel-cola":["web"]};
  const fromBeta=movedFrom(source117);
  assert.deepEqual(Object.keys(fromBeta).sort(),Object.keys({...declared,...promotion}).sort());
  for(const key of Object.keys(fromBeta))assert.deepEqual(fromBeta[key],["web"],key+": sólo web");
  for(const key of Object.keys(promotion)){
    assert.deepEqual(scopes[key],oldScopes[key],key+": su descriptor no cambia");
    assert.equal(betaRevision(key,sourceProd117,undefined,oldScopes[key]).web,betaRevision(key,read,undefined,scopes[key]).web,key+": idéntica a producción117");
  }
  const motor="src/modules/08-motor-bank.js";
  const source=f=>read(f).replace(/\r\n/g,"\n"),current=betaRevision(id,source,undefined,scopes[id]);
  assert.equal(current.native,undefined);assert.equal(current.edge,undefined);
  assert.notEqual(betaRevision(id,source117,undefined,oldScopes["inc-3009-01-cargos"]).web,current.web,"la beta anterior no acredita el arreglo");
  // Cada regla nueva reabre la tanda.
  for(const [from,to] of [
    ["return !!e.id&&(s.fixed||[]).filter(function(f){ return f.id===e.id; }).length===1;","return !!e.id;"],
    ["return winners.length===1&&winners[0].kind===\"fixed\"&&winners[0].id===e.id;","return winners.length>=1&&winners[0].kind===\"fixed\"&&winners[0].id===e.id;"],
    ["if(f.bank!==bank||!recNameMatch(f.name,merchant)||!recAmtClose(f.amount,amount)) return;","if(!recNameMatch(f.name,merchant)||!recAmtClose(f.amount,amount)) return;"],
    ["if(rows.length!==2) return null;","if(rows.length<2) return null;"],
    ["if(Math.round(Number(x.amount)*100)!==Math.round(Number(target)*100)) return false;","if(!recAmtClose(Number(x.amount),Number(target))) return false;"],
    ["if(expenseBankOf(x)!==bank&&e.category&&x.category&&x.category!==\"otros\"&&x.category!==e.category) return false;","if(expenseBankOf(x)!==bank&&x.category&&x.category!==\"otros\"&&x.category!==e.category) return false;"],
    ["var paid=!!proof||!!persisted||!!tx||!!expense;","var paid=!!proof||!!persisted||!!tx;"],
    ["const pd=status.bankTx?recDay(status.bankTx.date):proof&&(proof.kind===\"book\"||bankExpense)&&recDay(proof.date);","const pd=status.paid&&status.day;"]]){
    assert.equal(source(motor).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===motor?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.web,current.web,"reabre la tanda: "+from);
  }
  assert.deepEqual(betaRevision(id,f=>f==="supabase/functions/bank-sync/index.ts"?source(f)+"\n// mutante":source(f),undefined,scopes[id]),current,"ninguna Edge pertenece a esta tanda");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[id],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.native,undefined);assert.equal(group.edge,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[id],current.web);
  assert.deepEqual(receipt.pruebas,{[id]:{v:notes[0].v,contenido:JSON.stringify([id,expected118.tandas[0].t.es,expected118.tandas[0].items.es,1])}},"un único guion por probar");
  for(const key of Object.keys(consumers))assert.equal(receipt.pruebas[key],undefined,key+": su huella cambia, pero no vuelve a pedirse");
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});

// 4.26.119 (12/10/2026): bancos, acuse del cursor y reconexión. Es la primera tanda de esta ronda
// con superficie de servidor (`bank-sync` y `bank-callback` cambian), y va como identidad NUEVA:
// `bancos-sin-hueco` fue aprobada el 12/10 y retirada del panel, así que no se le cuelga producto.
// La de los recibos118 fue APROBADA en el móvil (12/10, 18:25) y sale del panel: queda esta sola. Lista cerrada frente a la beta118:
// qué descriptores crecen, qué huellas se mueven y por qué. Ninguna juzgada vuelve.
const expected119={"v":"4.26.119","d":"2026-10-12","t":{"es":"Bancos: ningún movimiento por el camino","en":"Banks: no transaction left behind","ca":"Bancs: cap moviment pel camí"},"items":{"es":["Si la conexión falla mientras se sincronizan los bancos, los movimientos de esos días ya no se pierden: entran la próxima vez que sincronices.","Volver a conectar un banco ya no deja días sin traer: la app sigue desde donde lo había dejado."],"en":["If the connection fails while your banks are syncing, the transactions from those days are no longer lost: they come in the next time you sync.","Reconnecting a bank no longer leaves days missing: the app carries on from where it left off."],"ca":["Si la connexió falla mentre se sincronitzen els bancs, els moviments d'aquells dies ja no es perden: entren la pròxima vegada que sincronitzis.","Tornar a connectar un banc ja no deixa dies sense portar: l'app continua des d'on ho havia deixat."]},"tandas":[{"id":"bancos-acuse-reconexion","t":{"es":"Bancos: nada se pierde si falla la conexión o al reconectar","en":"Banks: nothing is lost if the connection fails or on reconnecting","ca":"Bancs: no es perd res si falla la connexió o en reconnectar"},"items":{"es":["1. En Cartera, dentro de «Tus cuentas», toca el icono «Sincronizar bancos» y espera a que termine. Abre Gastos: los movimientos nuevos de tus bancos aparecen, cada uno una sola vez, sin repetidos.","2. Vuelve a Cartera y toca «Sincronizar bancos» otra vez: en Gastos no aparece ningún movimiento repetido. Toca el icono «Conectar cuentas» para abrir «Mis bancos»: en cada banco, la línea «Saldo actualizado» marca la hora de ahora.","3. Abre Aely con tu cuenta en otro dispositivo o en el navegador del ordenador y sincroniza los bancos allí. Vuelve al móvil y sincroniza: no falta ningún movimiento y ninguno sale repetido. Si no tienes otro dispositivo a mano, deja este paso sin probar.","4. Para probar la reconexión (ahora, o cuando un banco te caduque): en «Mis bancos», toca un banco, pulsa «Reconectar» y autoriza la misma cuenta de siempre. Al volver a la app, toca «Sincronizar bancos»: en Gastos no falta ningún día entre la última vez y hoy, y no hay movimientos repetidos. Si no reconectas ningún banco, deja este paso sin probar."],"en":["1. In Portfolio, inside “Your accounts”, tap the “Sync banks” icon and wait for it to finish. Open Spending: the new transactions from your banks appear, each one only once, with no repeats.","2. Go back to Portfolio and tap “Sync banks” again: no repeated transaction appears in Spending. Tap the “Connect accounts” icon to open “My banks”: on each bank, the “Balance updated” line shows the time right now.","3. Open Aely with your account on another device or in your computer's browser and sync your banks there. Go back to your phone and sync: no transaction is missing and none appears twice. If you have no other device at hand, leave this step untested.","4. To try reconnecting (now, or when a bank expires): in “My banks”, tap a bank, press “Reconnect” and authorise the same account as always. Back in the app, tap “Sync banks”: in Spending no day is missing between the last time and today, and there are no repeated transactions. If you do not reconnect any bank, leave this step untested."],"ca":["1. A Cartera, dins de «Els teus comptes», toca la icona «Sincronitza els bancs» i espera que acabi. Obre Despeses: els moviments nous dels teus bancs apareixen, cadascun una sola vegada, sense repetits.","2. Torna a Cartera i toca «Sincronitza els bancs» una altra vegada: a Despeses no apareix cap moviment repetit. Toca la icona «Connectar comptes» per obrir «Els meus bancs»: a cada banc, la línia «Saldo actualitzat» marca l'hora d'ara.","3. Obre Aely amb el teu compte en un altre dispositiu o al navegador de l'ordinador i sincronitza els bancs allà. Torna al mòbil i sincronitza: no hi falta cap moviment i cap surt repetit. Si no tens cap altre dispositiu a mà, deixa aquest pas sense provar.","4. Per provar la reconnexió (ara, o quan un banc et caduqui): a «Els meus bancs», toca un banc, prem «Reconnecta» i autoritza el mateix compte de sempre. En tornar a l'app, toca «Sincronitza els bancs»: a Despeses no falta cap dia entre l'última vegada i avui, i no hi ha moviments repetits. Si no reconnectes cap banc, deixa aquest pas sense provar."]}}]};
// Catálogo cerrado: desde la120 se lee de su commit inmutable (la120 añade nota, tanda y alcance nuevos).
test("Catálogo119 histórico añade sólo la tanda del acuse de bancos y declara cada huella ajena que mueve",()=>{
  const read=source119;
  const id="bancos-acuse-reconexion",recibos="recibos-cargo-unico",before=JSON.parse(source118("src/data/release-notes.json"));
  // Retiro119: recibos-cargo-unico, APROBADA en el móvil (12/10, 18:25, 5 ok / 0 fallos sobre 4.26.118.1), sale del panel; su nota, su descriptor y todo el historial se quedan.
  const expected=[expected119,{...before[0],tandas:before[0].tandas.filter(g=>g.id!==recibos)},...before.slice(1)];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,"una sola vez en todo el catálogo");
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[["4.26.119",id,0]],"el panel sólo puede enseñar la tanda nueva, sin APK");
  for(const n of notes.slice(1))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,2,lang+": dos puntos familiares");
    assert.equal(notes[0].tandas[0].items[lang].length,4,lang+": cuatro pasos");
    notes[0].tandas[0].items[lang].forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)));
  }
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde="bancos-sin-hueco";assert.throws(()=>verify(inherited),"no heredar la aprobación de bancos-sin-hueco");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verify(withApk),"no hay APK que probar");
  const approved=JSON.parse(source116("src/data/release-notes.json"))[0].tandas.find(g=>g.id==="bancos-sin-hueco");
  assert.ok(approved,"la tanda aprobada tal como se publicó en la 116");
  const resurrected=structuredClone(notes);resurrected[0].tandas.push(approved);assert.throws(()=>verify(resurrected),"no resucitar la tanda aprobada de los bancos");
  const back=structuredClone(notes);back[1].tandas=before[0].tandas;assert.throws(()=>verify(back),"no resucitar la tanda aprobada de los recibos");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source118("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira");
  const core="src/modules/00-core.js",main="src/modules/11-app-main.js",panel="src/modules/10-app-components.js";
  // Descriptores que crecen, lista cerrada. Las dos tandas ya vigilaban el sync de bancos de App
  // (y la de los bancos, además, BankPanel), que ahora llama al acuse local: las auditorías de
  // dependencias exigen esas unidades. Se añaden al final, sin tocar ni reordenar las demás.
  const grownExpected={
    "inc-3009-nomina-anticipada":["obAckLoad","obAckSave","OB_ACK_KEY"],
    "bancos-sin-hueco":["obAckLoad","obAckSave","obAckDrop","OB_ACK_KEY"]};
  const functions=logicFunctions(read),data=logicData(read),grown={};
  const web=(key,reader,scope)=>{
    try{return betaRevision(key,reader,undefined,scope).web;}
    catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code),error.message);return "build abortado por ancla mutada";}
  };
  for(const [key,scope] of Object.entries(oldScopes)){
    if(JSON.stringify(scopes[key])===JSON.stringify(scope))continue;
    const {web:nowWeb,...rest}=scopes[key],{web:oldWeb,...oldRest}=scope;
    assert.deepEqual(rest,oldRest,key+": sólo cambia la lista web");
    assert.deepEqual(nowWeb.slice(0,oldWeb.length),oldWeb,key+": ninguna unidad anterior se pierde ni cambia de orden");
    const added=nowWeb.slice(oldWeb.length);
    assert.ok(added.length>0&&added.every(u=>u.file===core&&Object.keys(u).length===2&&(u.function||u.data)),key+": sólo unidades sueltas de 00-core");
    grown[key]=added.map(u=>u.function||u.data);
    // El motivo se comprueba: con el descriptor de la118 cada unidad añadida ya era una dependencia
    // real de lo vigilado y cambiarla no movía la huella; con el de ahora, sí.
    const deps=scopeDependencies(scope,read,functions),values=scopeDataDependencies(scope,read,functions,data);
    for(const unit of added){
      const name=unit.function||unit.data,dep=(unit.function?deps:values).find(d=>d.name===name&&d.file===core);
      assert.ok(dep,key+": "+name+" es dependencia real de lo que ya vigilaba");
      const mutant=f=>f===core?(unit.function?mutateLogic(read(f),dep):mutateData(read(f),dep)):read(f);
      assert.equal(web(key,mutant,scope),web(key,read,scope),key+": el descriptor118 no vigilaba "+name);
      assert.notEqual(web(key,mutant,scopes[key]),web(key,read,scopes[key]),key+": el descriptor119 vigila "+name);
    }
  }
  assert.deepEqual(grown,grownExpected,"descriptores que crecen: lista cerrada");
  assert.deepEqual(Object.keys(scopes[id]),["web","edge","unidades"],"web y servidor, sin APK: el nativo no cambia");
  assert.equal(scopes[id].unidades,true);
  assert.deepEqual(scopes[id].web,scopes["bancos-sin-hueco"].web,"las unidades del sync de bancos, con el acuse local y su limpieza al quitar el banco");
  assert.deepEqual(scopes[id].web.slice(-4).map(u=>[u.file,u.function||u.data]),[[core,"obAckLoad"],[core,"obAckSave"],[core,"obAckDrop"],[core,"OB_ACK_KEY"]]);
  const edgeFiles=["supabase/functions/bank-sync/index.ts","supabase/functions/bank-sync/demand-window.ts","supabase/functions/bank-callback/index.ts","supabase/functions/bank-callback/reconnect.ts","supabase/functions/bank-connect/index.ts","supabase/functions/_shared/enablebanking.ts"];
  assert.deepEqual(scopes[id].edge,edgeFiles,"las dos funciones que hay que desplegar, la que renueva la autorización y su cliente del banco");
  for(const key of ["historial","auditoria","native"])assert.equal(scopes[id][key],undefined,"identidad nueva sin "+key);
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source118("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // Lista cerrada de huellas frente a la beta118 servida: una que se mueva sin declarar, o una
  // declarada que no se mueva, es rojo. Cada una lleva la unidad exacta que la mueve.
  const source=f=>read(f).replace(/\r\n/g,"\n"),old=f=>source118(f).replace(/\r\n/g,"\n");
  const moved={},why={};
  for(const [key,scope] of Object.entries(oldScopes)){
    if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
    const a=betaRevision(key,source118,undefined,scope),b=betaRevision(key,read,undefined,scopes[key]);
    const surfaces=["web","native","edge"].filter(surface=>a[surface]!==b[surface]);
    if(!surfaces.length)continue;
    moved[key]=surfaces;
    why[key]=["web","edge"].flatMap(surface=>(scope[surface]||[]).filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>typeof u==="string"?u:(u.function||u.data||u.from)));
  }
  assert.deepEqual(moved,{"tr-descripcion-clasificacion":["edge"],"inc-3009-nomina-anticipada":["web"],"bancos-sin-hueco":["web"]},"frente a la beta118, esta entrega mueve sólo a quien ya vigilaba el sync de bancos");
  assert.deepEqual(why,{
    // Vigila bank-sync entera por la descripción de Trade Republic: la función cambia (acuse y suelo).
    "tr-descripcion-clasificacion":["supabase/functions/bank-sync/index.ts"],
    // Su bloque de App contiene la pulsación de sincronizar, que ahora manda y guarda el acuse.
    "inc-3009-nomina-anticipada":["  const runBankSync=function("],
    // Quitar un banco borra su acuse (BankPanel) y el bloque del sync de App lo manda y lo guarda.
    "bancos-sin-hueco":["BankPanel","  const avisaSync=function(opts,m){"]});
  for(const key of Object.keys(moved))assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),false,key+": su huella cambia, pero no vuelve al panel");
  assert.deepEqual(scopes[recibos],oldScopes[recibos],"el descriptor de los recibos no cambia");
  assert.deepEqual(betaRevision(recibos,read,undefined,scopes[recibos]),betaRevision(recibos,source118,undefined,oldScopes[recibos]),"la tanda de los recibos conserva su huella: lo que se aprobó es lo que sigue en el producto");
  const current=betaRevision(id,source,undefined,scopes[id]);
  assert.ok(current.web&&current.edge);assert.equal(current.native,undefined);
  assert.throws(()=>betaRevision(id,source118,undefined,scopes[id]),error=>error.code==="BETA_SCOPE_ABSENT","la beta anterior no acredita el cliente: no tiene el acuse local");
  // Cada regla nueva del cliente reabre la tanda por la web y sólo por la web.
  for(const [file,from,to] of [
    [main,"cloud.bankSync({recoverGaps:true,acks:obAckLoad()})","cloud.bankSync({recoverGaps:true})"],
    [main,"if(l&&l.ack) ack[l.aspsp]=l.ack;","if(l&&l.ack) ack[l.aspsp]=null;"],
    [main,"lastBankSync:at,","lastBankSync:Date.now(),"],
    [main,"if(!p || state.lastBankSync!==p.at) return;","if(!p) return;"],
    [main,"    flushPersist();\n    obAckSave(","    obAckSave("],
    [core,"if(mcSandbox()) return {};","if(false) return {};"],
    [core,"if(!disk || disk.lastBankSync!==at) return false;","if(!disk) return false;"],
    [core,"const OB_ACK_KEY=\"micartera_v3_oback\";","const OB_ACK_KEY=\"micartera_v3\";"],
    [panel,"obAckDrop(name);",""]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.web,current.web,"reabre la tanda: "+from);
    assert.equal(changed.edge,current.edge,"sin mover el servidor: "+from);
  }
  // Y cada regla del servidor, por la superficie Edge y sólo por ella.
  for(const [file,from,to] of [
    ["supabase/functions/bank-sync/index.ts","...(toNow && !acks ? { last_sync: nowIso } : {})","...(toNow ? { last_sync: nowIso } : {})"],
    ["supabase/functions/bank-sync/demand-window.ts","export const OB_DEMAND_SKEW_DAYS = 3;","export const OB_DEMAND_SKEW_DAYS = 0;"],
    ["supabase/functions/bank-callback/index.ts","...(keep ? {} : { last_sync: null }),","last_sync: null,"],
    ["supabase/functions/bank-callback/reconnect.ts","if (p.hash && n.hash) return p.hash === n.hash;","if (p.hash && n.hash) return true;"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.edge,current.edge,"reabre la tanda: "+from);
    assert.equal(changed.web,current.web,"sin mover la web: "+from);
  }
  for(const file of edgeFiles)assert.notEqual(betaRevision(id,f=>f===file?source(f)+"\n// mutante":source(f),undefined,scopes[id]).edge,current.edge,file+" pertenece a la tanda");
  const neighbour="  const bankSyncing=useRef(false);";
  assert.equal(source(main).split(neighbour).length,2);
  assert.deepEqual(betaRevision(id,f=>f===main?source(f).replace(neighbour,neighbour.replace("false","true")):source(f),undefined,scopes[id]),current,"un estado vecino no reabre la tanda");
  assert.deepEqual(betaRevision(id,f=>f==="supabase/functions/ingest/index.ts"?source(f)+"\n// mutante":source(f),undefined,scopes[id]),current,"una función ajena no pertenece a esta tanda");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[id],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.edge,current.edge,"el panel la marca con servidor por confirmar");assert.equal(group.native,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[id],current.web);
  // Edge en Git no acredita la función activa: el recibo web no fabrica entrega de servidor.
  assert.equal(receipt.edge,undefined);assert.equal(JSON.stringify(receipt).includes(current.edge),false,"el recibo web no fabrica entrega de servidor");
  assert.deepEqual(receipt.pruebas,{[id]:{v:"4.26.119",contenido:JSON.stringify([id,expected119.tandas[0].t.es,expected119.tandas[0].items.es,1])}},"un único guion por probar");
  assert.equal(receipt.web[recibos],betaRevision(recibos,read,undefined,scopes[recibos]).web,"el producto de los recibos sigue íntegro en el recibo");
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});
test("Retiro119 histórico elimina solo recibos-cargo-unico y conserva todo el historial",()=>{
  const read=source119;
  const id="recibos-cargo-unico",before=JSON.parse(source118("src/data/release-notes.json")),notes=JSON.parse(read("src/data/release-notes.json"));
  assert.equal(before[0].tandas.some(g=>g.id===id),true,"la 118 publicada la llevaba");
  assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===id),false,"ya no está en ninguna nota");
  assert.deepEqual(notes.length,before.length+1,"ninguna nota se borra");
  // La nota118 conserva versión, fecha, título y textos; solo pierde su tanda, con `tandas:[]` (sin la propiedad resucitaría como /todo).
  assert.deepEqual(notes[1],{...before[0],tandas:[]});
  assert.deepEqual(notes.slice(2),before.slice(1),"el resto del catálogo, intacto");
  const resurrected=structuredClone(notes);resurrected[1].tandas.unshift(before[0].tandas.find(g=>g.id===id));
  assert.notDeepEqual(resurrected,notes,"no resucitar la tanda aprobada");
  const scopes=JSON.parse(read("scripts/beta-sources.json")),old=JSON.parse(source118("scripts/beta-sources.json"));
  assert.deepEqual(scopes[id],old[id],"el descriptor queda como historia");
  assert.deepEqual(betaRevision(id,read,undefined,scopes[id]),betaRevision(id,source118,undefined,old[id]),"la huella aprobada es la del producto que sigue en la 119");
  const receipt=betaDelivery(betaNotes(notes,read,scopes),read,scopes);
  assert.equal(receipt.web[id],betaRevision(id,read,undefined,scopes[id]).web,"el producto sigue íntegro");assert.equal(receipt.pruebas[id],undefined,"el guion aprobado no permanece marcado");
});

// 4.26.120 (13/10/2026): Trade Republic, apuntes iguales con ordinal. Tanda NUEVA con superficie de
// servidor (`_shared/presupuesto.ts`, que solo importa `ingest`). La del acuse de bancos fue
// RECHAZADA en el panel de la 119 por la redacción de su paso 2: prometía «ningún repetido» y el
// dueño vio las preguntas pendientes de Trade Republic, que no venían de esa tanda. Vuelve con el
// MISMO id en la nota 120 y el guion corregido: el veredicto va por huella (guion + código), así
// que el rechazo anterior no la veta, y el panel solo enseña la más nueva de un id. La nota 119 se
// queda con `tandas:[]`. Lista cerrada frente a la beta119: qué descriptores crecen, qué huellas
// se mueven y por qué. Ninguna juzgada y retirada vuelve.
const expected120={"v":"4.26.120","d":"2026-10-13","t":{"es":"Movimientos iguales, todos a la vista","en":"Identical transactions, all in view","ca":"Moviments iguals, tots a la vista"},"items":{"es":["Si tu banco no distingue dos movimientos iguales del mismo día (dos bizums idénticos, dos cafés), ahora salen los dos en Gastos en vez de uno solo.","Lo que ya marcaste como repetido no vuelve a aparecer al importar el histórico."],"en":["If your bank does not tell apart two identical transactions on the same day (two identical transfers, two coffees), both now show in Spending instead of just one.","What you already marked as a repeat no longer comes back when you import your history."],"ca":["Si el teu banc no distingeix dos moviments iguals del mateix dia (dos bizums idèntics, dos cafès), ara surten tots dos a Despeses en comptes d'un de sol.","El que ja vas marcar com a repetit no torna a aparèixer en importar l'històric."]},"tandas":[{"id":"tr-iguales-ordinal","t":{"es":"Trade Republic: los movimientos iguales ya no se funden","en":"Trade Republic: identical transactions are no longer merged","ca":"Trade Republic: els moviments iguals ja no es fonen"},"items":{"es":["1. Abre Gastos y apunta lo gastado del mes que marca la cabecera. En Cartera, dentro de «Tus cuentas», toca el icono «Sincronizar bancos» y espera a que termine. Pueden entrar unos cuantos movimientos de Trade Republic que antes faltaban, y alguno puede venir con la pregunta «¿Es el mismo movimiento?»: en esta primera sincronización es lo esperado. Compara dos o tres de los que han entrado con la app de Trade Republic: tienen que ser cargos reales, con el mismo día e importe. Está mal si entra alguno que Trade Republic no tiene.","2. Toca «Sincronizar bancos» otra vez: no entra nada nuevo y lo gastado del mes no cambia.","3. Si entre dos movimientos iguales hay uno que de verdad sobra, bórralo y vuelve a sincronizar: no vuelve a entrar. Si los dos son cargos reales, no borres ninguno y deja este paso sin probar.","4. Mira el widget de Aely en el móvil y la cabecera de Gastos: los dos marcan lo mismo."],"en":["1. Open Spending and note down the amount spent this month shown in the header. In Portfolio, inside “Your accounts”, tap the “Sync banks” icon and wait for it to finish. A few Trade Republic transactions that were missing before may come in, and some may arrive with the question “Is this the same movement?”: on this first sync that is expected. Check two or three of the ones that came in against the Trade Republic app: they must be real charges, with the same day and amount. It is wrong if one comes in that Trade Republic does not have.","2. Tap “Sync banks” again: nothing new comes in and the amount spent this month does not change.","3. If one of two identical transactions is really one too many, delete it and sync again: it does not come back. If both are real charges, do not delete either and leave this step untested.","4. Look at the Aely widget on your phone and at the Spending header: both show the same."],"ca":["1. Obre Despeses i apunta el que has gastat aquest mes segons la capçalera. A Cartera, dins de «Els teus comptes», toca la icona «Sincronitza els bancs» i espera que acabi. Poden entrar uns quants moviments de Trade Republic que abans faltaven, i algun pot venir amb la pregunta «És el mateix moviment?»: en aquesta primera sincronització és el que s'espera. Compara'n dos o tres dels que han entrat amb l'app de Trade Republic: han de ser càrrecs reals, amb el mateix dia i import. Està malament si n'entra algun que Trade Republic no té.","2. Toca «Sincronitza els bancs» una altra vegada: no entra res de nou i el que has gastat aquest mes no canvia.","3. Si entre dos moviments iguals n'hi ha un que realment sobra, esborra'l i torna a sincronitzar: no torna a entrar. Si tots dos són càrrecs reals, no n'esborris cap i deixa aquest pas sense provar.","4. Mira el widget d'Aely al mòbil i la capçalera de Despeses: tots dos marquen el mateix."]}},{"id":"bancos-acuse-reconexion","t":{"es":"Bancos: nada se pierde si falla la conexión o al reconectar","en":"Banks: nothing is lost if the connection fails or on reconnecting","ca":"Bancs: no es perd res si falla la connexió o en reconnectar"},"items":{"es":["1. Haz antes la tanda de Trade Republic de arriba: su primera sincronización es la que puede traer movimientos y preguntas. Después, en Cartera, dentro de «Tus cuentas», toca el icono «Sincronizar bancos» y espera a que termine. Abre Gastos: están los movimientos recientes de tus bancos. Las preguntas «¿Es el mismo movimiento?» que tuvieras de antes siguen ahí hasta que las contestes, y no cuentan como fallo.","2. Sincroniza otra vez seguido: no entra ningún movimiento nuevo ni ninguna pregunta nueva. Las preguntas que ya tenías pendientes siguen ahí. Toca el icono «Conectar cuentas» para abrir «Mis bancos»: en cada banco, la línea «Saldo actualizado» marca la hora de ahora.","3. Abre Aely con tu cuenta en otro dispositivo o en el navegador del ordenador y sincroniza los bancos allí. Vuelve al móvil y sincroniza: no falta ningún movimiento y no entra ninguno dos veces. Si no tienes otro dispositivo a mano, deja este paso sin probar.","4. Para probar la reconexión (ahora, o cuando un banco te caduque): en «Mis bancos», toca un banco, pulsa «Reconectar» y autoriza la misma cuenta de siempre. Al volver a la app, toca «Sincronizar bancos»: en Gastos no falta ningún día entre la última vez y hoy, y no entra ningún movimiento dos veces. Si no reconectas ningún banco, deja este paso sin probar."],"en":["1. Do the Trade Republic round above first: its first sync is the one that may bring transactions and questions. Then, in Portfolio, inside “Your accounts”, tap the “Sync banks” icon and wait for it to finish. Open Spending: the recent transactions from your banks are there. Any “Is this the same movement?” questions you already had stay there until you answer them, and they do not count as a failure.","2. Sync again straight away: no new transaction and no new question comes in. The questions you already had pending stay there. Tap the “Connect accounts” icon to open “My banks”: on each bank, the “Balance updated” line shows the time right now.","3. Open Aely with your account on another device or in your computer's browser and sync your banks there. Go back to your phone and sync: no transaction is missing and none comes in twice. If you have no other device at hand, leave this step untested.","4. To try reconnecting (now, or when a bank expires): in “My banks”, tap a bank, press “Reconnect” and authorise the same account as always. Back in the app, tap “Sync banks”: in Spending no day is missing between the last time and today, and no transaction comes in twice. If you do not reconnect any bank, leave this step untested."],"ca":["1. Fes abans la tanda de Trade Republic de dalt: la seva primera sincronització és la que pot portar moviments i preguntes. Després, a Cartera, dins de «Els teus comptes», toca la icona «Sincronitza els bancs» i espera que acabi. Obre Despeses: hi ha els moviments recents dels teus bancs. Les preguntes «És el mateix moviment?» que tinguessis d'abans continuen allà fins que les contestis, i no compten com a error.","2. Sincronitza una altra vegada tot seguit: no entra cap moviment nou ni cap pregunta nova. Les preguntes que ja tenies pendents continuen allà. Toca la icona «Connectar comptes» per obrir «Els meus bancs»: a cada banc, la línia «Saldo actualitzat» marca l'hora d'ara.","3. Obre Aely amb el teu compte en un altre dispositiu o al navegador de l'ordinador i sincronitza els bancs allà. Torna al mòbil i sincronitza: no hi falta cap moviment i cap entra dues vegades. Si no tens cap altre dispositiu a mà, deixa aquest pas sense provar.","4. Per provar la reconnexió (ara, o quan un banc et caduqui): a «Els meus bancs», toca un banc, prem «Reconnecta» i autoritza el mateix compte de sempre. En tornar a l'app, toca «Sincronitza els bancs»: a Despeses no falta cap dia entre l'última vegada i avui, i no entra cap moviment dues vegades. Si no reconnectes cap banc, deixa aquest pas sense provar."]}}]};
// Catálogo cerrado: desde la121 se lee de su commit inmutable (la121 añade nota, tanda y alcance nuevos).
test("Catálogo120 histórico añade la tanda de los iguales de Trade Republic, devuelve la del acuse con el guion corregido y declara cada huella que mueve",()=>{
  const read=source120;
  const id="tr-iguales-ordinal",bancos="bancos-acuse-reconexion",before=JSON.parse(source119("src/data/release-notes.json"));
  const expected=[expected120,{...before[0],tandas:[]},...before.slice(1)];
  const verify=notes=>assert.deepEqual(notes,expected);
  const notes=JSON.parse(read("src/data/release-notes.json"));verify(notes);
  for(const key of [id,bancos])assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===key).length,1,key+": una sola vez en todo el catálogo");
  // El orden importa: la primera sincronización de la tanda de Trade Republic trae movimientos y
  // preguntas; la del acuse se prueba después, cuando «sincroniza otra vez» ya no trae nada.
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[["4.26.120",id,0],["4.26.120",bancos,0]],"el panel sólo puede enseñar las dos tandas de la 120, sin APK");
  for(const n of notes.slice(1))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  const rejected=before[0].tandas[0];
  assert.equal(rejected.id,bancos,"la 119 publicada llevaba la tanda del acuse");
  assert.deepEqual(Object.keys(notes[0].tandas[1]),["id","t","items"],"mismo id, sin alias ni revisión heredada");
  assert.deepEqual(notes[0].tandas[1].t,rejected.t,"mismo título: es la misma entrega");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,2,lang+": dos puntos familiares");
    for(const group of notes[0].tandas){
      assert.equal(group.items[lang].length,4,lang+": cuatro pasos en "+group.id);
      group.items[lang].forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)+" de "+group.id));
    }
    assert.notDeepEqual(notes[0].tandas[1].items[lang],rejected.items[lang],lang+": el guion rechazado no vuelve tal cual");
    // El motivo del rechazo: ningún paso promete «sin repetidos». La primera sincronización de la
    // 120 trae preguntas de «¿es el mismo?» y eso es lo correcto.
    for(const group of notes[0].tandas)for(const step of group.items[lang])assert.equal(/repetid|repeat|repetit/i.test(step),false,lang+": "+group.id+" no promete ausencia de repetidos");
  }
  assert.ok(notes[0].tandas[1].items.es[1].startsWith("2. Sincroniza otra vez seguido: no entra ningún movimiento nuevo ni ninguna pregunta nueva. Las preguntas que ya tenías pendientes siguen ahí."),"el paso corregido, literal");
  assert.ok(notes[0].tandas[1].items.es[0].startsWith("1. Haz antes la tanda de Trade Republic de arriba"),"la del acuse se prueba después de la primera sincronización");
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verify(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[1].desde=["4.26.119/"+bancos];assert.throws(()=>verify(inherited),"no heredar el veredicto de la 119");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verify(withApk),"no hay APK que probar");
  const back=structuredClone(notes);back[1].tandas=before[0].tandas;assert.throws(()=>verify(back),"el guion rechazado no se queda en la 119");
  const swapped=structuredClone(notes);swapped[0].tandas.reverse();assert.throws(()=>verify(swapped),"el orden de las dos tandas es parte del guion");
  const missing=structuredClone(notes);missing.pop();assert.throws(()=>verify(missing));
  const text=structuredClone(notes);text[1].items.es[0]+="mutante";assert.throws(()=>verify(text));
  const scopes=JSON.parse(read("scripts/beta-sources.json")),oldScopes=JSON.parse(source119("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes).filter(key=>!oldScopes[key]),[id]);
  assert.deepEqual(Object.keys(oldScopes).filter(key=>!scopes[key]),[],"ningún alcance se retira");
  const core="src/modules/00-core.js",motor="src/modules/08-motor-bank.js",main="src/modules/11-app-main.js",panel="src/modules/10-app-components.js",gastos="src/modules/04-tab-gastos.js";
  // Descriptores que crecen, lista cerrada. Veinticinco tandas ya vigilaban la identidad de un
  // gasto (`keyOfExpense`), su viaje a la nube o el importador, que ahora llaman a la regla del
  // ordinal y a los vínculos aviso↔apunte: las auditorías de dependencias exigen esas unidades.
  // Se añaden al final, sin tocar ni reordenar las demás. Todas son de 00-core salvo
  // `histCandLapidas`, del motor.
  const grownExpected={
    "inc-3009-01-cargos":["obOrdinalSufijo","ordinalSufijoCloud","obOrdinalOf"],
    "fin05-widget-reentrada":["obOrdinalSufijo","ordinalDeTramos","ordinalSufijoCloud","obOrdinalOf"],
    "fin05-pago-cerrada":["obOrdinalSufijo","ordinalDeTramos","ordinalSufijoCloud","obOrdinalOf"],
    "tr-descripcion-clasificacion":["obOrdinalSufijo","ordinalDeTramos","avisosEmparejados","avisoYaEmparejado","fechaConOrdinal","histCandLapidas","obOrdinalOf","gemeloAvisoKey"],
    "widget-banco":["obOrdinalSufijo","ordinalDeTramos","obOrdinalOf"],
    "widget-app-cerrada":["obOrdinalSufijo","ordinalDeTramos","ordinalSufijoCloud","obOrdinalOf"],
    "inc-2909-02-inicio-natural":["obOrdinalSufijo","ordinalDeTramos","obOrdinalOf"],
    "inc-3009-nomina-anticipada":["obOrdinalSufijo","ordinalDeTramos","avisosEmparejados","avisoYaEmparejado","fechaConOrdinal","pushGemelos","gemeloDe","quitarGemeloDe","ordinalSufijoCloud","fusionarGemelos","gemelosDeImportacion","obOrdinalOf","gemeloAvisoKey","GEMELOS_MAX"],
    "inc-2909-03-retirada":["ordinalSufijoCloud","obOrdinalSufijo","obOrdinalOf"],
    "inc-2909-01-widget-periodo":["obOrdinalSufijo","ordinalDeTramos","ordinalSufijoCloud","obOrdinalOf"],
    "inc-0210-01-plan-cuota":["obOrdinalSufijo","obOrdinalOf"],
    "inc-0210-03-gastos-periodo":["pushGemelos","gemeloDe","quitarGemeloDe","obOrdinalSufijo","ordinalSufijoCloud","gemeloAvisoKey","obOrdinalOf","GEMELOS_MAX"],
    "feature-0210-01-gasolina-taxi":["obOrdinalSufijo","ordinalSufijoCloud","obOrdinalOf"],
    "inc-0210-02-categoria-elegida":["obOrdinalSufijo","ordinalSufijoCloud","obOrdinalOf"],
    "inc-0310-01-meta-regla":["obOrdinalSufijo","obOrdinalOf"],
    "feature-0310-01-movilidad":["obOrdinalSufijo","ordinalSufijoCloud","pushGemelos","gemeloDe","quitarGemeloDe","obOrdinalOf","gemeloAvisoKey","GEMELOS_MAX"],
    "inc-0310-gastos-sin-limite":["pushGemelos","gemeloDe","quitarGemeloDe","obOrdinalSufijo","ordinalSufijoCloud","gemeloAvisoKey","obOrdinalOf","GEMELOS_MAX"],
    "inc-0710-gastos-mes-madrid":["pushGemelos","gemeloDe","quitarGemeloDe","obOrdinalSufijo","ordinalSufijoCloud","gemeloAvisoKey","obOrdinalOf","GEMELOS_MAX"],
    "inc-0810-dashboard-recents-memo":["obOrdinalSufijo","obOrdinalOf"],
    "inc-0810-metas-editar-regla":["obOrdinalSufijo","ordinalSufijoCloud","obOrdinalOf"],
    "widget-pago-app-cerrada":["obOrdinalSufijo","ordinalDeTramos","ordinalSufijoCloud","obOrdinalOf"],
    "bancos-sin-hueco":["obOrdinalSufijo","avisosEmparejados","avisoYaEmparejado","fechaConOrdinal","gemelosDeImportacion","pushGemelos","ordinalSufijoCloud","obOrdinalOf","gemeloAvisoKey","gemeloDe","GEMELOS_MAX"],
    "widget-ciclo-puente":["obOrdinalSufijo","ordinalDeTramos","ordinalSufijoCloud","obOrdinalOf"],
    "recibos-cargo-unico":["obOrdinalSufijo","ordinalSufijoCloud","obOrdinalOf"],
    "bancos-acuse-reconexion":["obOrdinalSufijo","avisosEmparejados","avisoYaEmparejado","fechaConOrdinal","gemelosDeImportacion","pushGemelos","ordinalSufijoCloud","obOrdinalOf","gemeloAvisoKey","gemeloDe","GEMELOS_MAX"]};
  const functions=logicFunctions(read),data=logicData(read),grown={};
  const web=(key,reader,scope)=>{
    try{return betaRevision(key,reader,undefined,scope).web;}
    catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code),error.message);return "build abortado por ancla mutada";}
  };
  for(const [key,scope] of Object.entries(oldScopes)){
    if(JSON.stringify(scopes[key])===JSON.stringify(scope))continue;
    const {web:nowWeb,...rest}=scopes[key],{web:oldWeb,...oldRest}=scope;
    assert.deepEqual(rest,oldRest,key+": sólo cambia la lista web");
    assert.deepEqual(nowWeb.slice(0,oldWeb.length),oldWeb,key+": ninguna unidad anterior se pierde ni cambia de orden");
    const added=nowWeb.slice(oldWeb.length);
    assert.ok(added.length>0&&added.every(u=>Object.keys(u).length===2&&(u.function||u.data)&&(u.file===core||(u.file===motor&&u.function==="histCandLapidas"))),key+": sólo unidades sueltas del ordinal y de los vínculos");
    grown[key]=added.map(u=>u.function||u.data);
    // El motivo se comprueba: con el descriptor de la119 cada unidad añadida ya era una dependencia
    // real de lo vigilado y cambiarla no movía la huella; con el de ahora, sí.
    const deps=scopeDependencies(scope,read,functions),values=scopeDataDependencies(scope,read,functions,data);
    for(const unit of added){
      const name=unit.function||unit.data,dep=(unit.function?deps:values).find(d=>d.name===name&&d.file===unit.file);
      assert.ok(dep,key+": "+name+" es dependencia real de lo que ya vigilaba");
      const mutant=f=>f===unit.file?(unit.function?mutateLogic(read(f),dep):mutateData(read(f),dep)):read(f);
      assert.equal(web(key,mutant,scope),web(key,read,scope),key+": el descriptor119 no vigilaba "+name);
      assert.notEqual(web(key,mutant,scopes[key]),web(key,read,scopes[key]),key+": el descriptor120 vigila "+name);
    }
  }
  assert.deepEqual(grown,grownExpected,"descriptores que crecen: lista cerrada");
  assert.deepEqual(Object.keys(scopes[id]),["web","edge","unidades"],"web y servidor, sin APK: el nativo no cambia");
  assert.equal(scopes[id].unidades,true);
  // Semilla del alcance: todo lo que la entrega toca (ordinal, viaje, vínculos, importador,
  // histórico, borrado a mano, mezcla con la nube, sync de bancos) y el guardado. Detrás van sus
  // dependencias transitivas, que exigen las auditorías.
  const persist=scopes[bancos].web.find(u=>u.from&&u.from.includes("INC-0410 guardado: de aquí al límite"));
  assert.ok(persist,"el bloque del guardado, el mismo que vigila la tanda del acuse");
  const seed=[
    ...["obOrdinalOf","obOrdinalSufijo","fechaConOrdinal","keyOfExpense","partirEntDeuda","ordinalSufijoCloud","ordinalDeTramos","expenseSourceForCloud","expenseFromRow","expenseBankOf","resolvePossibleDup","gemeloAvisoKey","gemeloDe","pushGemelos","quitarGemeloDe","fusionarGemelos","avisosEmparejados","avisoYaEmparejado","gemelosDeImportacion"].map(name=>({file:core,function:name})),
    {file:core,data:"GEMELOS_MAX"},
    ...["importObExpenses","reservaKeyOf","histCandCercanos","histCandLapidas","histClassifyCandidates","enrichNotesFromBankTx"].map(name=>({file:motor,function:name})),
    {file:panel,function:"BankHistoryImport"},
    {file:gastos,from:"  const delExpense=function(e){",to:"  const undoLastDelete=function(){"},
    {file:main,from:"  const syncCloudExpenses=function(){",to:"  const syncFromCloud=function(s, opts){"},
    {file:main,from:"  const syncFromCloud=function(",to:"  // CAPA 2 — Open Banking:"},
    {file:main,from:"  const avisaSync=function(opts,m){",to:"  const BROKER_SYNC_THROTTLE"},
    persist];
  assert.deepEqual(scopes[id].web.slice(0,seed.length),seed);
  assert.equal(scopes[id].web.length,234,"semilla más dependencias transitivas");
  assert.ok(scopes[id].web.slice(seed.length).every(u=>Object.keys(u).length===2&&(u.function||u.data)),"detrás de la semilla, sólo dependencias sueltas");
  // Toda función o dato que la entrega añade o cambia en la lógica está en la semilla.
  const oldFunctions=logicFunctions(source119),oldData=logicData(source119),touched=[];
  for(const [key,fn] of functions)if(!oldFunctions.has(key)||oldFunctions.get(key).text.replace(/\r\n/g,"\n")!==fn.text.replace(/\r\n/g,"\n"))touched.push(fn.name);
  for(const [key,value] of data)if(!oldData.has(key)||oldData.get(key).text.replace(/\r\n/g,"\n")!==value.text.replace(/\r\n/g,"\n"))touched.push(value.name);
  assert.deepEqual(touched.slice().sort(),seed.filter(u=>u.file===core||u.file===motor).map(u=>u.function||u.data).sort(),"lo que cambia en la lógica es exactamente la semilla de 00-core y del motor");
  const edgeFiles=["supabase/functions/_shared/presupuesto.ts","supabase/functions/ingest/index.ts","supabase/functions/ingest/widget.ts"];
  assert.deepEqual(scopes[id].edge,edgeFiles,"la regla compartida que cambia y la única función que la importa, que hay que desplegar antes que la web");
  for(const key of ["historial","auditoria","native"])assert.equal(scopes[id][key],undefined,"identidad nueva sin "+key);
  assert.deepEqual(JSON.parse(read("scripts/beta-archives.json")),JSON.parse(source119("scripts/beta-archives.json")),"pin y juicio109 intactos");
  // Lista cerrada de huellas frente a la beta119 servida: una que se mueva sin declarar, o una
  // declarada que no se mueva, es rojo. Cada una lleva las unidades exactas que la mueven.
  const source=f=>read(f).replace(/\r\n/g,"\n"),old=f=>source119(f).replace(/\r\n/g,"\n");
  const moved={},why={};
  for(const [key,scope] of Object.entries(oldScopes)){
    if(key===archiveId)continue; // 109 es referencia fija, nunca código vigente.
    const a=betaRevision(key,source119,undefined,scope),b=betaRevision(key,read,undefined,scopes[key]);
    const surfaces=["web","native","edge"].filter(surface=>a[surface]!==b[surface]);
    if(!surfaces.length)continue;
    moved[key]=surfaces;
    why[key]=["web","edge"].flatMap(surface=>(scope[surface]||[]).filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>typeof u==="string"?u:(u.function||u.data||u.from)));
  }
  // Sólo por la web: ninguna tanda anterior vigilaba `_shared/presupuesto.ts` ni `ingest/widget.ts`,
  // e `ingest/index.ts` no cambia.
  assert.deepEqual(moved,Object.fromEntries(Object.keys(grownExpected).map(key=>[key,["web"]])),"frente a la beta119, esta entrega mueve sólo a quien ya vigilaba la identidad, el viaje o el importador de un gasto: las mismas veinticinco que crecen");
  // Qué mueve a cada una. `keyOfExpense` lleva el ordinal; `partirEntDeuda` y `expenseBankOf` leen
  // el `source` con sus tramos nuevos; `expenseSourceForCloud` y `expenseFromRow` son el viaje;
  // `importObExpenses` reparte las ranuras; `resolvePossibleDup`, `Expenses` (borrado a mano) y los
  // bloques de App guardan o unen los vínculos; el histórico mira lápidas y vínculos.
  assert.deepEqual(why,{
    "inc-3009-01-cargos":["keyOfExpense","expenseBankOf","partirEntDeuda","expenseSourceForCloud"],
    "fin05-widget-reentrada":["keyOfExpense","expenseBankOf","expenseFromRow","  const wR=useRef(false)","partirEntDeuda","expenseSourceForCloud"],
    "fin05-pago-cerrada":["keyOfExpense","expenseBankOf","expenseFromRow","  const wR=useRef(false)","partirEntDeuda","expenseSourceForCloud"],
    "tr-descripcion-clasificacion":["keyOfExpense","expenseBankOf","expenseFromRow","importObExpenses","histCandCercanos","histClassifyCandidates","enrichNotesFromBankTx","partirEntDeuda"],
    "widget-banco":["keyOfExpense","expenseBankOf","expenseFromRow","partirEntDeuda"],
    "widget-app-cerrada":["keyOfExpense","expenseBankOf","expenseFromRow","  const wR=useRef(false)","partirEntDeuda","expenseSourceForCloud"],
    "inc-2909-02-inicio-natural":["keyOfExpense","expenseBankOf","expenseFromRow","partirEntDeuda"],
    "inc-3009-nomina-anticipada":["keyOfExpense","expenseBankOf","expenseFromRow","importObExpenses","histCandCercanos","partirEntDeuda","resolvePossibleDup","enrichNotesFromBankTx","expenseSourceForCloud","  const syncFromCloud=function(","  const runBankSync=function(","      // FIN-07: el paginador solo resuelve"],
    "inc-2909-03-retirada":["expenseSourceForCloud","  const syncCloudExpenses=function(){","expenseBankOf","keyOfExpense","partirEntDeuda"],
    "inc-2909-01-widget-periodo":["keyOfExpense","expenseBankOf","expenseFromRow","  const wR=useRef(false)","partirEntDeuda","expenseSourceForCloud"],
    "inc-0210-01-plan-cuota":["expenseBankOf","partirEntDeuda","keyOfExpense"],
    "inc-0210-03-gastos-periodo":["Expenses","resolvePossibleDup","keyOfExpense","expenseSourceForCloud","expenseBankOf","partirEntDeuda"],
    "feature-0210-01-gasolina-taxi":["keyOfExpense","expenseBankOf","partirEntDeuda","expenseSourceForCloud"],
    "inc-0210-02-categoria-elegida":["keyOfExpense","expenseSourceForCloud","expenseBankOf","partirEntDeuda"],
    "inc-0310-01-meta-regla":["reservaKeyOf","keyOfExpense","expenseBankOf","partirEntDeuda"],
    "feature-0310-01-movilidad":["keyOfExpense","expenseBankOf","partirEntDeuda","expenseSourceForCloud","Expenses","  const syncCloudExpenses=function(){","resolvePossibleDup"],
    "inc-0310-gastos-sin-limite":["Expenses","resolvePossibleDup","keyOfExpense","expenseSourceForCloud","expenseBankOf","partirEntDeuda"],
    "inc-0710-gastos-mes-madrid":["Expenses","resolvePossibleDup","keyOfExpense","expenseSourceForCloud","expenseBankOf","partirEntDeuda"],
    "inc-0810-dashboard-recents-memo":["keyOfExpense"],
    "inc-0810-metas-editar-regla":["reservaKeyOf","expenseSourceForCloud","expenseBankOf","keyOfExpense","partirEntDeuda"],
    "widget-pago-app-cerrada":["keyOfExpense","expenseBankOf","expenseFromRow","  const wR=useRef(false)","partirEntDeuda","expenseSourceForCloud"],
    "bancos-sin-hueco":["importObExpenses","  const avisaSync=function(opts,m){","expenseBankOf","enrichNotesFromBankTx","partirEntDeuda","keyOfExpense","expenseSourceForCloud"],
    "widget-ciclo-puente":["keyOfExpense","expenseBankOf","expenseFromRow","  const wR=useRef(false)","partirEntDeuda","expenseSourceForCloud"],
    "recibos-cargo-unico":["keyOfExpense","expenseBankOf","partirEntDeuda","expenseSourceForCloud"],
    "bancos-acuse-reconexion":["importObExpenses","  const avisaSync=function(opts,m){","expenseBankOf","enrichNotesFromBankTx","partirEntDeuda","keyOfExpense","expenseSourceForCloud"]});
  // De las veinticinco sólo la del acuse está en el panel, y porque vuelve con guion nuevo.
  for(const key of Object.keys(moved))assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),key===bancos,key+(key===bancos?": vuelve al panel con su huella nueva":": su huella cambia, pero no vuelve al panel"));
  assert.deepEqual(scopes[bancos].edge,oldScopes[bancos].edge);
  assert.equal(betaRevision(bancos,read,undefined,scopes[bancos]).edge,betaRevision(bancos,source119,undefined,oldScopes[bancos]).edge,"el servidor de la tanda del acuse no cambia en esta entrega");
  const current=betaRevision(id,source,undefined,scopes[id]);
  assert.ok(current.web&&current.edge);assert.equal(current.native,undefined);
  assert.throws(()=>betaRevision(id,source119,undefined,scopes[id]),error=>error.code==="BETA_SCOPE_ABSENT","la beta anterior no acredita el cliente: no tiene el ordinal");
  // Cada regla nueva del cliente reabre la tanda por la web y sólo por la web.
  for(const [file,from,to] of [
    [core,"return n>1 ? \"|#\"+n : \"\";","return \"\";"],
    [core,"return (typeof n===\"number\" && n>1 && Math.floor(n)===n) ? n : 1;","return 1;"],
    [core,"return isFinite(ms) ? new Date(ms+(n-1)).toISOString() : iso;","return iso;"],
    [core,"return pushGemelos(Array.isArray(local) ? local : [], nube);","return local;"],
    [motor,"if(claves[k]) out[i]=true;",""],
    [motor,"g.miembros=firmes.concat(pendientes.slice(firmes.length));","g.miembros=g.miembros;"],
    [main,"&& !expenseIsTombstoned(e, delSet)) subirGasto(e, \"backfill\");",") subirGasto(e, \"backfill\");"],
    [main,"const gem=fusionarGemelos(prev.gemelos, cloudState.gemelos);","const gem=prev.gemelos;"],
    [main,"const vinculos=gemelosDeImportacion(add, invState.expenses);","const vinculos=[];"],
    [gastos,"if(e.source===\"ob\"||e.source===\"ob-hist\") next.gemelos=pushGemelos(s.gemelos,[{aviso:\"\",banco:key}]);",""],
    [panel,"const vinculos=gemelosDeImportacion(keepLocal, s.expenses);","const vinculos=[];"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.web,current.web,"reabre la tanda: "+from);
    assert.equal(changed.edge,current.edge,"sin mover el servidor: "+from);
  }
  // Y cada regla del servidor, por la superficie Edge y sólo por ella.
  for(const [file,from,to] of [
    [edgeFiles[0],"return ord > 1 ? base + \"|#\" + ord : base;","return base;"],
    [edgeFiles[0],"if (s.indexOf(\"ob-hist:\") === 0) return s.slice(8).split(\"#\")[0].split(\"~\")[0] || null;","if (s.indexOf(\"ob-hist:\") === 0) return s.slice(8) || null;"]]){
    assert.equal(source(file).split(from).length,2,"mutante sobre fuente real: "+from);
    const changed=betaRevision(id,f=>f===file?source(f).replace(from,to):source(f),undefined,scopes[id]);
    assert.notEqual(changed.edge,current.edge,"reabre la tanda: "+from);
    assert.equal(changed.web,current.web,"sin mover la web: "+from);
  }
  for(const file of edgeFiles)assert.notEqual(betaRevision(id,f=>f===file?source(f)+"\n// mutante":source(f),undefined,scopes[id]).edge,current.edge,file+" pertenece a la tanda");
  const neighbour="  const bankSyncing=useRef(false);";
  assert.equal(source(main).split(neighbour).length,2);
  assert.deepEqual(betaRevision(id,f=>f===main?source(f).replace(neighbour,neighbour.replace("false","true")):source(f),undefined,scopes[id]),current,"un estado vecino no reabre la tanda");
  assert.deepEqual(betaRevision(id,f=>f==="supabase/functions/bank-sync/index.ts"?source(f)+"\n// mutante":source(f),undefined,scopes[id]),current,"una función ajena no pertenece a esta tanda");
  const built=betaNotes(notes,read,scopes),receipt=betaDelivery(built,read,scopes),group=built[0].tandas[0],again=built[0].tandas[1];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[id,bancos],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.edge,current.edge,"el panel la marca con servidor por confirmar");assert.equal(group.native,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[id],current.web);
  const acuse=betaRevision(bancos,source,undefined,scopes[bancos]);
  assert.equal(again.web,acuse.web);assert.equal(again.edge,acuse.edge);assert.equal(receipt.web[bancos],acuse.web);
  // Edge en Git no acredita la función activa: el recibo web no fabrica entrega de servidor.
  assert.equal(receipt.edge,undefined);assert.equal(JSON.stringify(receipt).includes(current.edge),false,"el recibo web no fabrica entrega de servidor");
  assert.deepEqual(receipt.pruebas,{
    [id]:{v:"4.26.120",contenido:JSON.stringify([id,expected120.tandas[0].t.es,expected120.tandas[0].items.es,1])},
    [bancos]:{v:"4.26.120",contenido:JSON.stringify([bancos,expected120.tandas[1].t.es,expected120.tandas[1].items.es,1])}},"dos guiones por probar, y el del acuse es el corregido");
  for(const g of [group,again])for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native"])assert.equal(g[key],undefined,g.id+" sin "+key);
});

// 4.26.121 (13/10/2026): Inicio v4.2, patrimonio por flujos. Tanda NUEVA, sólo web, sobre la
// integración 4.26.120 (4e927e33), que no llegó a publicarse sola: sus dos tandas siguen en su
// nota, sin tocar, y el panel enseña las tres. Lista cerrada frente a la120: qué descriptores
// crecen, qué huellas se mueven y por qué. Ninguna juzgada y retirada vuelve.
const expected121={"v":"4.26.121","d":"2026-10-13","t":{"es":"Inicio: cómo ha ido tu patrimonio","en":"Home: how your net worth has moved","ca":"Inici: com ha anat el teu patrimoni"},"items":{"es":["Inicio estrena una gráfica de cómo ha ido tu patrimonio: cuentas, inversiones, bienes y deudas, todo junto. Pasa el dedo por encima para ver la cifra de cada día.","Una frase te dice cuánto ha subido o bajado en el periodo que elijas: un mes, seis meses, un año o todo.","La tarjeta del mes vuelve a decir cuánto puedes gastar al día con lo que te queda.","Si de algún día falta un dato, la gráfica no se lo inventa: te dice desde cuándo hay datos."],"en":["Home has a new chart of how your net worth has moved: accounts, investments, property and debts, all together. Slide your finger over it to see the figure for each day.","A sentence tells you how much it has gone up or down over the period you pick: one month, six months, one year or everything.","The month card once again tells you how much you can spend per day with what you have left.","If a figure is missing for some day, the chart does not make it up: it tells you since when there is data."],"ca":["Inici estrena una gràfica de com ha anat el teu patrimoni: comptes, inversions, béns i deutes, tot junt. Passa-hi el dit per sobre per veure la xifra de cada dia.","Una frase et diu quant ha pujat o baixat en el període que triïs: un mes, sis mesos, un any o tot.","La targeta del mes torna a dir quant pots gastar al dia amb el que et queda.","Si d'algun dia falta una dada, la gràfica no se la inventa: et diu des de quan hi ha dades."]},"tandas":[{"id":"inicio-patrimonio-flujos","t":{"es":"Inicio: la gráfica de tu patrimonio y cuánto puedes gastar al día","en":"Home: your net worth chart and how much you can spend per day","ca":"Inici: la gràfica del teu patrimoni i quant pots gastar al dia"},"items":{"es":["1. Abre Inicio y apunta la cifra grande de arriba, con sus céntimos. Ve a Cartera: su cifra grande, con todos los bloques activados (cuentas, inversiones y bienes, menos deudas), es la misma al céntimo. Está mal si difieren, aunque sea en un céntimo.","2. Vuelve a Inicio y mira la gráfica que hay bajo la cifra: la línea viene de días o meses atrás, no empieza hoy. Entre la cifra y la gráfica hay una línea de texto por cada bien que tienes dado de alta, del estilo «Coche: valor propio desde…» con la fecha de hoy, seguida de «antes se mantiene el valor actual». Si una cuenta tiene datos solo desde cierto día, otra línea lo dice con su nombre y esa fecha. Está mal si no sale la gráfica, si empieza hoy o si falta la línea de alguno de tus bienes.","3. Mantén el dedo sobre la gráfica y muévelo a los lados: encima de la cifra aparece una fecha y la cifra pasa a ser la de ese día. Al soltar, vuelve la de hoy. Ahora desliza hacia abajo empezando con el dedo sobre la gráfica: la pantalla se mueve y la cifra no cambia.","4. Mira la tarjeta «Este mes» (o «Este ciclo»): «Te quedan X de Y» coincide con lo que marca Gastos. Debajo dice cuánto puedes gastar al día y durante cuántos días, contando hoy. Si ya te has pasado del presupuesto, esa línea no sale y no cuenta como fallo.","5. Bajo la gráfica, toca uno a uno los periodos (1M, 6M, 1A, Todo): la frase de color cambia con cada uno («… más que hace un mes», «… menos que hace 6 meses») y la gráfica se vuelve a dibujar. Solo salen los periodos para los que hay datos: si falta alguno, es lo esperado."],"en":["1. Open Home and note down the big figure at the top, cents included. Go to Portfolio: its big figure, with every block switched on (accounts, investments and property, minus debts), is the same to the cent. It is wrong if they differ, even by one cent.","2. Go back to Home and look at the chart under the figure: the line comes from days or months back, it does not start today. Between the figure and the chart there is one line of text for each property item you have, along the lines of “Car: own value from…” with today's date, followed by “earlier dates keep the current value”. If an account only has data from a certain day, another line says so with its name and that date. It is wrong if the chart does not show, if it starts today or if the line for one of your property items is missing.","3. Keep your finger on the chart and move it sideways: a date appears above the figure and the figure becomes the one for that day. When you let go, today's figure comes back. Now swipe down starting with your finger on the chart: the screen scrolls and the figure does not change.","4. Look at the “This month” (or “This cycle”) card: “Left to spend X of Y” matches what Spending shows. Below, it says how much you can spend per day and for how many days, counting today. If you are already over budget, that line does not show and it does not count as a failure.","5. Under the chart, tap the periods one by one (1M, 6M, 1Y, All): the coloured sentence changes with each one (“… more than a month ago”, “… less than 6 months ago”) and the chart is drawn again. Only the periods that have data are offered: if one is missing, that is expected."],"ca":["1. Obre Inici i apunta la xifra gran de dalt, amb els cèntims. Ves a Cartera: la seva xifra gran, amb tots els blocs activats (comptes, inversions i béns, menys deutes), és la mateixa al cèntim. Està malament si són diferents, encara que sigui d'un cèntim.","2. Torna a Inici i mira la gràfica que hi ha sota la xifra: la línia ve de dies o mesos enrere, no comença avui. Entre la xifra i la gràfica hi ha una línia de text per cada bé que tens donat d'alta, de l'estil «Cotxe: valor propi des de…» amb la data d'avui, seguida de «abans es manté el valor actual». Si un compte només té dades des d'un dia concret, una altra línia ho diu amb el seu nom i aquesta data. Està malament si no surt la gràfica, si comença avui o si falta la línia d'algun dels teus béns.","3. Mantén el dit sobre la gràfica i mou-lo cap als costats: damunt de la xifra apareix una data i la xifra passa a ser la d'aquell dia. En deixar anar, torna la d'avui. Ara llisca cap avall començant amb el dit sobre la gràfica: la pantalla es mou i la xifra no canvia.","4. Mira la targeta «Aquest mes» (o «Aquest cicle»): «Et queden X de Y» coincideix amb el que marca Despeses. A sota diu quant pots gastar al dia i durant quants dies, comptant avui. Si ja t'has passat del pressupost, aquesta línia no surt i no compta com a error.","5. Sota la gràfica, toca un a un els períodes (1M, 6M, 1A, Tot): la frase de color canvia amb cadascun («… més que fa un mes», «… menys que fa 6 mesos») i la gràfica es torna a dibuixar. Només surten els períodes per als quals hi ha dades: si en falta algun, és el que s'espera."]}}]};
// Catálogo cerrado: desde la122 se lee de su commit inmutable (la122 añade nota, tanda y alcance nuevos).
test("Catálogo121 histórico añade la tanda de Inicio v4.2 sobre la120 y declara cada descriptor que crece y cada huella que mueve",()=>{
  const read=source121;
  const id="inicio-patrimonio-flujos",tr="tr-iguales-ordinal",bancos="bancos-acuse-reconexion",bienes="bienes-completo",grafica="inicio-grafica-vuelve";
  const integrated=JSON.parse(source120("scripts/beta-sources.json")),before=JSON.parse(source120("src/data/release-notes.json"));
  const expectedNotes=[expected121,...before];
  const source=f=>read(f).replace(/\r\n/g,"\n"),old=f=>source120(f).replace(/\r\n/g,"\n");
  const notes=JSON.parse(source("src/data/release-notes.json"));
  assert.deepEqual(notes,expectedNotes,"la nota 121 literal delante del catálogo120 intacto");
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[["4.26.121",id,0],["4.26.120",tr,0],["4.26.120",bancos,0]],"el panel enseña la tanda de Inicio y las dos de la 120, sin APK");
  for(const n of notes.slice(2))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  for(const key of [id,tr,bancos])assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===key).length,1,key+": una sola vez en todo el catálogo");
  assert.deepEqual(Object.keys(notes[0].tandas[0]),["id","t","items"],"identidad nueva, sin alias ni revisión heredada");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,4,lang+": cuatro puntos familiares");
    assert.equal(notes[0].tandas[0].items[lang].length,5,lang+": cinco pasos");
    notes[0].tandas[0].items[lang].forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)));
    // La racha se retira sin anunciarlo, y ningún paso pide esperar a mañana ni revalorar un bien.
    for(const text of notes[0].items[lang].concat(notes[0].tandas[0].items[lang]))assert.equal(/racha|streak|ratxa|mañana|tomorrow|demà/i.test(text),false,lang+": sólo lo comprobable hoy");
  }
  const verifyNotes=list=>assert.deepEqual(list,expectedNotes);
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verifyNotes(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde=["4.26.113/"+grafica];assert.throws(()=>verifyNotes(inherited),"no heredar el veredicto de la gráfica113");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verifyNotes(withApk),"no hay APK que probar");
  const gone=structuredClone(notes);gone[1].tandas=[];assert.throws(()=>verifyNotes(gone),"las dos tandas de la 120 siguen en su nota");
  const text=structuredClone(notes);text[1].tandas[1].items.es[1]+="mutante";assert.throws(()=>verifyNotes(text),"el guion de la 120 no se toca");
  const scopes=JSON.parse(source("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes),Object.keys(integrated).concat(id),"una sola alta y ningún alcance retirado");
  assert.deepEqual(JSON.parse(source("scripts/beta-archives.json")),archiveRefs,"sin repinar el rechazo109");
  const core="src/modules/00-core.js",shared="src/modules/02-ui-shared.js",motor="src/modules/08-motor-bank.js",main="src/modules/11-app-main.js",dash="src/modules/03-tab-dash.js";
  // Descriptores que crecen, lista cerrada. Veintisiete alcances ya vigilaban el guardado partido
  // o la subida a la nube (`mcSaveRaw`, `mcLoadRaw`, `slimForCloud`), que ahora unen el historial
  // de cuentas y bienes con `mergeAccountBalanceHistory`: la auditoría de dependencias exige esa
  // unidad. El de Bienes gana además lo que su Guardar llama desde esta entrega (acta de Inicio,
  // ronda 3): `recordAssetValues` y `netWorthDay`, y detrás `madridYmdParts` con su caché.
  // Todas se añaden al final, sin tocar ni reordenar las anteriores.
  const union=["mergeAccountBalanceHistory"];
  const grownExpected=Object.fromEntries(["inc-3009-01-cargos","fin05-widget-reentrada","fin05-pago-cerrada","widget-banco","widget-app-cerrada","inc-2809-02-ayuda-ciclo","inc-2909-02-inicio-natural","inc-2709-10-perfil","inc-3009-nomina-anticipada","inc-2909-03-retirada","inc-2909-01-widget-periodo","inc-0210-03-gastos-periodo","feature-0210-01-gasolina-taxi","inc-0210-02-categoria-elegida","inc-0310-01-meta-regla","feature-0310-01-movilidad","inc-0310-broker-resultados","inc-0310-gastos-sin-limite","inc-0710-gastos-mes-madrid","inc-0710-auth-disposal","inc-0810-metas-editar-regla",bienes,"widget-pago-app-cerrada","bancos-sin-hueco","widget-ciclo-puente","recibos-cargo-unico",bancos,tr].map(key=>[key,key===bienes?union.concat("recordAssetValues","netWorthDay","madridYmdParts","_mcMadridYmdFmt"):union]));
  const files=[core,"src/modules/01-i18n.js",shared,dash,motor],functions=logicFunctions(source),allFunctions=logicFunctions(source,files),data=logicData(source),grown={};
  const web=(key,reader,scope)=>{
    try{return betaRevision(key,reader,undefined,scope).web;}
    catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code),error.message);return "build abortado por ancla mutada";}
  };
  for(const [key,scope] of Object.entries(integrated)){
    if(key===grafica||JSON.stringify(scopes[key])===JSON.stringify(scope))continue;
    const {web:nowWeb,...rest}=scopes[key],{web:oldWeb,...oldRest}=scope;
    assert.deepEqual(rest,oldRest,key+": sólo cambia la lista web");
    assert.deepEqual(nowWeb.slice(0,oldWeb.length),oldWeb,key+": ninguna unidad anterior se pierde ni cambia de orden");
    const added=nowWeb.slice(oldWeb.length);
    assert.ok(added.length>0&&added.every(u=>Object.keys(u).length===2&&(u.function||u.data)&&[core,shared,motor].includes(u.file)),key+": sólo unidades sueltas");
    grown[key]=added.map(u=>u.function||u.data);
    // El motivo se comprueba: con el descriptor de la120 cambiar la unidad añadida no movía la
    // huella; con el de ahora, sí. Las de 00-core y del motor son además dependencias reales
    // para la auditoría; las de 02-ui-shared, que la auditoría no recorre, se acreditan abajo.
    const deps=scopeDependencies(scope,source,functions);
    for(const unit of added){
      const name=unit.function||unit.data,target=unit.function?allFunctions.get(name):data.get(name);
      assert.ok(target&&target.file===unit.file,key+": "+name+" existe en "+unit.file);
      if(unit.function&&unit.file===core)assert.ok(deps.find(d=>d.name===name&&d.file===unit.file),key+": "+name+" es dependencia real de lo que ya vigilaba");
      const mutant=f=>f===unit.file?(unit.function?mutateLogic(source(f),target):mutateData(source(f),target)):source(f);
      assert.equal(web(key,mutant,scope),web(key,source,scope),key+": el descriptor120 no vigilaba "+name);
      assert.notEqual(web(key,mutant,scopes[key]),web(key,source,scopes[key]),key+": el descriptor121 vigila "+name);
    }
  }
  assert.deepEqual(grown,grownExpected,"descriptores que crecen: lista cerrada");
  // Bienes: el Guardar de la ficha es quien llama al registrador y al día de Madrid.
  const sheet=scopeText({file:"src/modules/07-tab-patri-fijos.js",function:"AssetSheet"},source);
  assert.ok(scopes[bienes].web.some(u=>u.function==="AssetSheet"),"Bienes vigila su ficha");
  for(const call of ["recordAssetValues(","netWorthDay("])assert.equal(sheet.split(call).length,2,"Guardar de Bienes llama a "+call);
  assert.ok(allFunctions.get("netWorthDay").text.includes("madridYmdParts("),"el día de Madrid sale de madridYmdParts");
  assert.ok(allFunctions.get("madridYmdParts").text.includes("_mcMadridYmdFmt"),"y madridYmdParts lee su caché de formato");
  // La gráfica113, aprobada y retirada, cambia de descriptor: Inicio v4.2 sustituye su renderer.
  // Pierde sólo las cinco unidades que ya no existen en la fuente y conserva las demás en su orden.
  const lost=integrated[grafica].web.filter(u=>!scopes[grafica].web.some(s=>JSON.stringify(s)===JSON.stringify(u)));
  assert.deepEqual(lost.map(u=>u.function||u.from),["  const shownNet=useCountUp(tt.netWorth||0, splashGone);","Sparkline","    v4_hist_empty:\"Tu histórico empieza hoy\"","    v4_hist_empty:\"Your history starts today\"","    v4_hist_empty:\"El teu històric comença avui\""]);
  for(const unit of lost.slice(0,2))assert.throws(()=>scopeText(unit,source),error=>error.code==="BETA_SCOPE_ABSENT",(unit.function||unit.from)+": ya no existe en la fuente");
  // Las tres líneas de «Tu histórico empieza hoy» siguen en la fuente y siguen vigiladas: ahora
  // dentro del bloque de textos del patrimonio de cada idioma, que ya era parte del descriptor.
  lost.slice(2).forEach((unit,i)=>{
    const block=scopes[grafica].web.find(u=>u.from==="    // INC-0810 "+["es","en","ca"][i]+": patrimonio de ahora.");
    assert.ok(block&&scopeText(block,source).includes(scopeText(unit,source)),unit.from+": cubierta por el bloque de su idioma");
  });
  const kept=integrated[grafica].web.filter(u=>!lost.includes(u));
  assert.deepEqual(scopes[grafica].web.slice(0,kept.length),kept,"el resto del descriptor113 sigue entero y en su orden");
  const {web:graficaWeb,...graficaRest}=scopes[grafica],{web:graficaOld,...graficaOldRest}=integrated[grafica];
  assert.deepEqual(graficaRest,graficaOldRest);assert.equal(graficaWeb.length,170);
  for(const unit of graficaWeb.slice(kept.length))assert.ok(scopes[id].web.some(s=>JSON.stringify(s)===JSON.stringify(unit)),"lo que la gráfica113 gana es parte del alcance nuevo");
  // El alcance nuevo: el de la rama (184 unidades) más la regla del ordinal de la 120, que la
  // auditoría exige porque Inicio lee las lápidas con `keyOfExpense`.
  assert.deepEqual(Object.keys(scopes[id]),["web","unidades"],"sólo web: ni APK ni servidor");
  assert.equal(scopes[id].unidades,true);assert.equal(scopes[id].web.length,186);
  assert.deepEqual(scopes[id].web.slice(-2),[{file:core,function:"obOrdinalSufijo"},{file:core,function:"obOrdinalOf"}]);
  for(const key of ["historial","auditoria","native","edge","codigosCompatibles","compatibilidadGit","compatibilidadSha"])assert.equal(scopes[id][key],undefined,"identidad nueva sin "+key);
  // Lista cerrada de huellas frente a la120: una que se mueva sin declarar, o una declarada que no
  // se mueva, es rojo. Cada una lleva las unidades exactas de su descriptor120 que la mueven.
  // Casi todas se mueven por el guardado partido (`mcSaveRaw` ya no relee las claves grandes y
  // parte el historial de cuentas); la cifra, el guion y la APK del widget no cambian.
  const escritor=["mcSaveRaw"];
  const expectedMoves=Object.fromEntries(Object.keys(grownExpected).concat("inc-2709-01-arranque-red",grafica).map(key=>[key,escritor]));
  Object.assign(expectedMoves,{
    "inc-2709-01-arranque-red":["  const [splashGone,setSplashGone]"],
    "inc-2909-02-inicio-natural":["  const bud=dashboardBudgetStats(state);","  const ringPct=","    !showSkel && !(state.budget>0)","mcSaveRaw"],
    "inc-3009-nomina-anticipada":["Wealth","  const bud=dashboardBudgetStats(state);","  const ringPct=","    !showSkel && !(state.budget>0)","slimForCloud","  const syncFromCloud=function(","mcSaveRaw"],
    "inc-0310-01-meta-regla":["slimForCloud","mcSaveRaw"],
    [bienes]:["mcSaveRaw","AssetSheet"],
    [tr]:["  const syncFromCloud=function(","slimForCloud","mcSaveRaw"],
    [grafica]:"renderer sustituido"});
  const previous=new Map();
  const measure=reader=>{
    const now=JSON.parse(reader("scripts/beta-sources.json")),moved={};
    for(const [key,scope] of Object.entries(integrated)){
      // El rechazo109 usa su pin histórico, nunca un bloque retirado del renderer actual.
      if(key===archiveId){assert.deepEqual(auditedRevision(key,reader),auditedRevision(key,source120));continue;}
      if(!previous.has(key))previous.set(key,betaRevision(key,source120,undefined,scope));
      const a=previous.get(key),b=betaRevision(key,reader,undefined,now[key]);
      const surfaces=["web","native","edge"].filter(s=>a[s]!==b[s]);
      if(surfaces.length)moved[key]=surfaces;
    }
    return moved;
  };
  const verify=(reader,expected=expectedMoves)=>assert.deepEqual(measure(reader),Object.fromEntries(Object.keys(expected).map(key=>[key,["web"]])),"lista cerrada: ni una huella extra ni una declarada que no cambie");
  verify(source);
  const why={};
  for(const key of Object.keys(expectedMoves)){
    if(key===grafica)continue; // su descriptor120 nombra unidades que ya no existen: comprobado arriba.
    why[key]=(integrated[key].web||[]).filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>u.function||u.data||u.from);
  }
  const {[grafica]:_,...whyExpected}=expectedMoves;
  assert.deepEqual(why,whyExpected,"qué unidad mueve cada huella");
  // De las treinta sólo las dos de la 120 están en el panel, y ya lo estaban.
  for(const key of Object.keys(expectedMoves))assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),key===tr||key===bancos,key+(key===tr||key===bancos?": sigue en el panel con su huella nueva":": su huella cambia, pero no vuelve al panel"));
  // Una dependencia ajena que cambia debe fallar aunque el catálogo conserve sus textos.
  const shell="src/shell.html",from='animation:mclpop .5s cubic-bezier(.32,.72,0,1) backwards;}';
  assert.equal(source(shell).split(from).length,2,"mutante sobre el splash actual real");
  const changed=f=>f===shell?source(f).replace(from,from.replace(".5s",".6s")):source(f);
  assert.throws(()=>verify(changed),/lista cerrada/,"el splash no está declarado: no puede moverse por arrastre");
  assert.throws(()=>verify(source,{...expectedMoves,"splash-animado":"mutante: declarada sin cambio real"}),/lista cerrada/,"añadir una declaración vacía no permite heredar identidad");
  // Deshacer el escritor demuestra la otra dirección con una mutación real de fuente.
  const widget="widget-ciclo-puente",writer=scopeText({file:core,function:"mcSaveRaw"},source),priorWriter=scopeText({file:core,function:"mcSaveRaw"},old);
  const reverted=f=>f===core?source(f).replace(writer,priorWriter):source(f);
  assert.notEqual(betaRevision(widget,reverted,undefined,scopes[widget]).web,betaRevision(widget,source,undefined,scopes[widget]).web,"revertir el escritor cambia la huella real");
  const missing={...expectedMoves};delete missing[widget];assert.throws(()=>verify(source,missing),/lista cerrada/,"una huella real no declarada pone rojo");
  const splash="splash-animado";
  assert.deepEqual(betaRevision(splash,source,undefined,scopes[splash]),betaRevision(splash,source120,undefined,integrated[splash]),"el OK del splash no se reinicia por arrastre");
  const now=betaRevision(widget,source,undefined,scopes[widget]),then=betaRevision(widget,source120,undefined,integrated[widget]);
  assert.notEqual(now.web,then.web,"el escritor nuevo exige revisar la web pendiente del widget");
  assert.equal(now.native,then.native,"ningún cambio de APK por esta revisión");
  // Las dos tandas de la 120 conservan su servidor: Inicio no toca ninguna función Edge.
  for(const key of [tr,bancos]){
    assert.deepEqual(scopes[key].edge,integrated[key].edge);
    assert.equal(betaRevision(key,source,undefined,scopes[key]).edge,betaRevision(key,source120,undefined,integrated[key]).edge,key+": el servidor no cambia en esta entrega");
  }
  const current=betaRevision(id,source,undefined,scopes[id]);
  assert.ok(current.web);assert.equal(current.native,undefined);assert.equal(current.edge,undefined);
  assert.throws(()=>betaRevision(id,source120,undefined,scopes[id]),error=>error.code==="BETA_SCOPE_ABSENT","la 120 no acredita el cliente: no tiene la serie por flujos");
  // Las reglas de la integración (la unión del pull junto a la de los vínculos de la 120) reabren la tanda.
  for(const [file,a,b] of [
    [main,"baseObj.accountBalanceHistory=sameOwner?mergeAccountBalanceHistory(prev.accountBalanceHistory,baseObj.accountBalanceHistory):cloudState.accountBalanceHistory||{};","baseObj.accountBalanceHistory=cloudState.accountBalanceHistory||{};"],
    [shared,"kept.push({day:new Date(Date.parse(day+\"T12:00:00Z\")-864e5).toISOString().slice(0,10),value:prior.value,legacy:true});","kept.push({day:day,value:prior.value});"]]){
    assert.equal(source(file).split(a).length,2,"mutante sobre fuente real: "+a);
    assert.notEqual(betaRevision(id,f=>f===file?source(f).replace(a,b):source(f),undefined,scopes[id]).web,current.web,"reabre la tanda: "+a);
  }
  const gemelos="const gem=fusionarGemelos(prev.gemelos, cloudState.gemelos);";
  assert.equal(source(main).split(gemelos).length,2,"la unión de vínculos de la 120 sigue en el pull junto a la del historial");
  const built=betaNotes(notes,source,scopes),receipt=betaDelivery(built,source,scopes),group=built[0].tandas[0];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[id,tr,bancos],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.edge,undefined);assert.equal(group.native,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[id],current.web);assert.equal(receipt.edge,undefined);
  const original=betaDelivery(betaNotes(before,source120,integrated),source120,integrated);
  assert.deepEqual(receipt.pruebas,{
    [id]:{v:"4.26.121",contenido:JSON.stringify([id,expected121.tandas[0].t.es,expected121.tandas[0].items.es,1])},
    [tr]:original.pruebas[tr],[bancos]:original.pruebas[bancos]},"tres guiones por probar; los dos de la 120, tal cual");
  for(const key of [grafica,"bancos-sin-hueco","recibos-cargo-unico"]){
    assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),false,key+": retirada no resucita");
    assert.equal(receipt.pruebas[key],undefined,key+": no se vuelve a pedir al dueño");
  }
  assert.equal(receipt.web[widget],now.web,"el producto pendiente del widget sigue en el recibo");
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});

// 4.26.122 (13/10/2026): todo cargo del banco sale en Gastos. Tanda NUEVA, web y servidor
// (`_shared/presupuesto.ts`, que usa `ingest`), sobre la integración 4.26.121 (2de328d6), que
// tampoco llegó a publicarse sola: la tanda de Inicio y las dos de la 120 siguen en sus notas, sin
// tocar, y el panel enseña las cuatro. Lista cerrada frente a la121: qué descriptores crecen, qué
// huellas se mueven y por qué. Ninguna juzgada y retirada vuelve.
const expected122={"v":"4.26.122","d":"2026-10-13","t":{"es":"Los recibos del banco, también en Gastos","en":"Bank bill charges, now in Spending too","ca":"Els rebuts del banc, també a Despeses"},"items":{"es":["Los cargos del banco que pagan un recibo de tu Plan ahora también se ven en Gastos, marcados con el nombre del recibo. No se cuentan dos veces: lo gastado y los saldos siguen igual.","Si la app se equivoca de recibo, abre el movimiento y pulsa «No es este recibo»: pasará a contar como un gasto más. Y si te arrepientes, se puede deshacer desde el mismo movimiento."],"en":["Bank charges that pay a bill in your Plan now also show in Spending, labelled with the bill's name. They are not counted twice: your spending and balances stay the same.","If the app picks the wrong bill, open the transaction and tap “Not this bill”: it will count as regular spending. And if you change your mind, you can undo it from the same transaction."],"ca":["Els càrrecs del banc que paguen un rebut del teu Pla ara també es veuen a Despeses, marcats amb el nom del rebut. No es compten dues vegades: el que has gastat i els saldos continuen igual.","Si l'app s'equivoca de rebut, obre el moviment i prem «No és aquest rebut»: passarà a comptar com una despesa més. I si te'n penedeixes, es pot desfer des del mateix moviment."]},"tandas":[{"id":"recibo-cargo-en-gastos","t":{"es":"Recibos: el cargo del banco se ve en Gastos sin contar dos veces","en":"Bills: the bank charge shows in Spending without counting twice","ca":"Rebuts: el càrrec del banc es veu a Despeses sense comptar dues vegades"},"items":{"es":["1. Antes de sincronizar, apunta tres cifras: lo gastado del mes (cabecera de Gastos), el saldo de cada cuenta en Cartera y la cifra del widget de Aely. Después, en Cartera, dentro de «Tus cuentas», toca el icono «Sincronizar bancos» y espera a que termine. Las tres cifras son las mismas de antes, salvo por lo que sumen los movimientos nuevos que entren como un gasto normal (de Trade Republic pueden entrar varios que faltaban: es la tanda de más abajo). Está mal si lo gastado sube, o un saldo baja, justo por el importe de un recibo que ya tenías en Plan.","2. Abre Gastos: los adeudos de este mes que pagan un recibo de tu Plan salen atenuados y con el rótulo «Recibo: » y su nombre, o con interrogación («¿Recibo: Agua?») si solo se parece. Si tus recibos se cobran en una cuenta que no es de gasto diario, toca el botón de filtros (🎛️), elige «Todos los bancos» y pulsa «Listo» para verlos. Lo que ya salía en Gastos como un gasto normal sigue igual. Está mal si no sale ninguno aunque el banco ya haya cobrado recibos este mes.","3. Abre uno de esos movimientos (mejor uno que diga «Recibo: …», sin interrogación, y que tenga ya varios días) y pulsa «No es este recibo». El saldo de la cuenta no se mueve y, en Plan → Recibos, ese recibo vuelve a estar pendiente. Si la cuenta es de gasto diario, lo gastado del mes y el widget suben justo ese importe; si no lo es, no cambian y el movimiento pasa a decir «no es del día a día».","4. En esa misma ficha, toca «Paga un recibo», elige el mismo recibo y pulsa «Confirmar pago completo»: el movimiento vuelve a decir «Recibo: …», lo gastado y el widget vuelven a la cifra que tenían antes de pulsar «No es este recibo» y el recibo vuelve a salir pagado en Plan.","5. Abre Plan → Recibos y despliega «Ya has pagado»: están los recibos que el banco ha cobrado este mes, cada uno una sola vez."],"en":["1. Before syncing, note down three figures: the amount spent this month (Spending header), the balance of each account in Portfolio and the figure on the Aely widget. Then, in Portfolio, inside “Your accounts”, tap the “Sync banks” icon and wait for it to finish. The three figures are the same as before, except for whatever new transactions add when they come in as regular spending (several missing ones may come in from Trade Republic: that is the round further down). It is wrong if the amount spent goes up, or a balance goes down, by exactly the amount of a bill you already had in Plan.","2. Open Spending: this month's bank charges that pay a bill in your Plan show dimmed and labelled “Bill: ” plus its name, or with a question mark (“Bill: Water?”) if it only looks like it. If your bills are charged to an account that is not for daily spending, tap the filters button (🎛️), choose “All banks” and press “Done” to see them. Anything that already showed in Spending as regular spending stays the same. It is wrong if none shows although the bank has already charged bills this month.","3. Open one of those transactions (best one that says “Bill: …”, with no question mark, and that is already a few days old) and tap “Not this bill”. The account balance does not move and, in Plan → Bills, that bill goes back to pending. If the account is for daily spending, the amount spent this month and the widget go up by exactly that amount; if it is not, they do not change and the transaction now says “not day-to-day”.","4. On that same transaction, tap “Pays a bill”, choose the same bill and press “Confirm full payment”: the transaction says “Bill: …” again, the amount spent and the widget go back to the figure they had before you tapped “Not this bill”, and the bill shows as paid again in Plan.","5. Open Plan → Bills and unfold “You already paid”: the bills the bank has charged this month are there, each one only once."],"ca":["1. Abans de sincronitzar, apunta tres xifres: el que has gastat aquest mes (capçalera de Despeses), el saldo de cada compte a Cartera i la xifra del widget d'Aely. Després, a Cartera, dins de «Els teus comptes», toca la icona «Sincronitza els bancs» i espera que acabi. Les tres xifres són les mateixes d'abans, tret del que sumin els moviments nous que entrin com una despesa normal (de Trade Republic en poden entrar uns quants que faltaven: és la tanda de més avall). Està malament si el que has gastat puja, o un saldo baixa, just per l'import d'un rebut que ja tenies al Pla.","2. Obre Despeses: els càrrecs d'aquest mes que paguen un rebut del teu Pla surten atenuats i amb el rètol «Rebut: » i el seu nom, o amb interrogant («Rebut: Aigua?») si només s'hi assembla. Si els teus rebuts es cobren en un compte que no és de despesa diària, toca el botó de filtres (🎛️), tria «Tots els bancs» i prem «Fet» per veure'ls. El que ja sortia a Despeses com una despesa normal continua igual. Està malament si no en surt cap tot i que el banc ja ha cobrat rebuts aquest mes.","3. Obre un d'aquests moviments (millor un que digui «Rebut: …», sense interrogant, i que ja tingui uns quants dies) i prem «No és aquest rebut». El saldo del compte no es mou i, a Pla → Rebuts, aquest rebut torna a estar pendent. Si el compte és de despesa diària, el que has gastat aquest mes i el widget pugen just aquest import; si no ho és, no canvien i el moviment passa a dir «no és del dia a dia».","4. En aquesta mateixa fitxa, toca «Paga un rebut», tria el mateix rebut i prem «Confirmar pagament complet»: el moviment torna a dir «Rebut: …», el que has gastat i el widget tornen a la xifra que tenien abans de prémer «No és aquest rebut» i el rebut torna a sortir pagat al Pla.","5. Obre Pla → Rebuts i desplega «Ja has pagat»: hi ha els rebuts que el banc ha cobrat aquest mes, cadascun una sola vegada."]}}]};
// Catálogo cerrado: desde la123 se lee de su commit inmutable (la123 añade nota y vuelve a presentar la tanda de Inicio).
test("Catálogo122 histórico añade la tanda del cargo de recibo en Gastos sobre la121 y declara cada descriptor que crece y cada huella que mueve",()=>{
  const read=source122;
  const id="recibo-cargo-en-gastos",inicio="inicio-patrimonio-flujos",tr="tr-iguales-ordinal",bancos="bancos-acuse-reconexion";
  const integrated=JSON.parse(source121("scripts/beta-sources.json")),before=JSON.parse(source121("src/data/release-notes.json"));
  const expectedNotes=[expected122,...before];
  const source=f=>read(f).replace(/\r\n/g,"\n"),old=f=>source121(f).replace(/\r\n/g,"\n");
  const notes=JSON.parse(source("src/data/release-notes.json"));
  assert.deepEqual(notes,expectedNotes,"la nota 122 literal delante del catálogo121 intacto");
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[["4.26.122",id,0],["4.26.121",inicio,0],["4.26.120",tr,0],["4.26.120",bancos,0]],"el panel enseña la tanda del cargo de recibo, la de Inicio y las dos de la 120, sin APK");
  for(const n of notes.slice(3))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  for(const key of [id,inicio,tr,bancos])assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===key).length,1,key+": una sola vez en todo el catálogo");
  assert.deepEqual(Object.keys(notes[0].tandas[0]),["id","t","items"],"identidad nueva, sin alias ni revisión heredada");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,2,lang+": dos puntos familiares");
    assert.equal(notes[0].tandas[0].items[lang].length,5,lang+": cinco pasos");
    notes[0].tandas[0].items[lang].forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)));
    // Sólo lo comprobable hoy y sin perder datos: ningún paso pide borrar un recibo ni esperar a mañana.
    for(const text of notes[0].tandas[0].items[lang])assert.equal(/borra|quita este|delete|remove|esborra|treu aquest|mañana|tomorrow|demà/i.test(text),false,lang+": ningún paso borra un recibo ni espera a otro día");
  }
  // Cada rótulo que cita el guion es el texto real del botón o de la fila, en su idioma.
  const literal={
    es:["«Recibo: »","«¿Recibo: Agua?»","«Todos los bancos»","«Listo»","«No es este recibo»","«no es del día a día»","«Paga un recibo»","«Confirmar pago completo»","«Sincronizar bancos»","«Ya has pagado»"],
    en:["“Bill: ”","“Bill: Water?”","“All banks”","“Done”","“Not this bill”","“not day-to-day”","“Pays a bill”","“Confirm full payment”","“Sync banks”","“You already paid”"],
    ca:["«Rebut: »","«Rebut: Aigua?»","«Tots els bancs»","«Fet»","«No és aquest rebut»","«no és del dia a dia»","«Paga un rebut»","«Confirmar pagament complet»","«Sincronitza els bancs»","«Ja has pagat»"]};
  const textos=source("src/modules/01-i18n.js");
  const enFuente={
    es:['g_recibo_de:"Recibo: {name}"','g_recibo_quiza:"¿Recibo: {name}?"','g_allbanks:"Todos los bancos"','g_filters_done:"Listo"','f_recibo_no:"No es este recibo"','g_skip_otrobanco:"no es del día a día"','f_receipt_row:"Paga un recibo"','f_receipt_yes:"Confirmar pago completo"','v4_sync_banks:"Sincronizar bancos"','v4_paid_fold:"Ya has pagado {n} recibos'],
    en:['g_recibo_de:"Bill: {name}"','g_recibo_quiza:"Bill: {name}?"','g_allbanks:"All banks"','g_filters_done:"Done"','f_recibo_no:"Not this bill"','g_skip_otrobanco:"not day-to-day"','f_receipt_row:"Pays a bill"','f_receipt_yes:"Confirm full payment"','v4_sync_banks:"Sync banks"','v4_paid_fold:"You already paid {n} bills'],
    ca:['g_recibo_de:"Rebut: {name}"','g_recibo_quiza:"Rebut: {name}?"','g_allbanks:"Tots els bancs"','g_filters_done:"Fet"','f_recibo_no:"No és aquest rebut"','g_skip_otrobanco:"no és del dia a dia"','f_receipt_row:"Paga un rebut"','f_receipt_yes:"Confirmar pagament complet"','v4_sync_banks:"Sincronitza els bancs"','v4_paid_fold:"Ja has pagat {n} rebuts']};
  for(const lang of ["es","en","ca"]){
    const guion=notes[0].tandas[0].items[lang].join("\n");
    literal[lang].forEach((rotulo,i)=>{
      assert.ok(guion.includes(rotulo),lang+": el guion cita "+rotulo);
      assert.ok(textos.includes(enFuente[lang][i]),lang+": "+rotulo+" es el texto de la app ("+enFuente[lang][i]+")");
    });
  }
  const verifyNotes=list=>assert.deepEqual(list,expectedNotes);
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verifyNotes(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde=["4.26.118/recibos-cargo-unico"];assert.throws(()=>verifyNotes(inherited),"no heredar el veredicto de los recibos de la 118");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verifyNotes(withApk),"no hay APK que probar");
  const gone=structuredClone(notes);gone[1].tandas=[];assert.throws(()=>verifyNotes(gone),"la tanda de Inicio sigue en su nota");
  const text=structuredClone(notes);text[2].tandas[1].items.es[1]+="mutante";assert.throws(()=>verifyNotes(text),"el guion de la 120 no se toca");
  const scopes=JSON.parse(source("scripts/beta-sources.json"));
  assert.deepEqual(Object.keys(scopes),Object.keys(integrated).concat(id),"una sola alta y ningún alcance retirado");
  assert.deepEqual(JSON.parse(source("scripts/beta-archives.json")),archiveRefs,"sin repinar el rechazo109");
  const core="src/modules/00-core.js",i18n="src/modules/01-i18n.js",motor="src/modules/08-motor-bank.js",main="src/modules/11-app-main.js",gastos="src/modules/04-tab-gastos.js";
  // Descriptores que crecen, lista cerrada. Veintiocho alcances ya vigilaban qué cuenta un gasto
  // (`expenseCountsCash`), el pago de un recibo (`fixedPaymentState`), el viaje a la nube o el
  // importador, que ahora preguntan por la marca de recibo y por sus vetos: las auditorías de
  // dependencias exigen esas unidades. Se añaden al final, sin tocar ni reordenar las anteriores.
  const grownExpected={
    "inc-3009-01-cargos":["recFrase","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reponerCargoDeRecibo","reciboNoDe","admiteMarcaDe","reciboSufijo","cargoDeReciboFirmeCalc","reciboNoPon","reciboPagadoCon","conSaldoMostrado","reciboNombreCasa","reciboNoTope","saldoCuentaMostrada","saldoCuentaGasto","RECIBO_NO_MAX"],
    "fin05-widget-reentrada":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboSufijo","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "fin05-pago-cerrada":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboSufijo","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "tr-descripcion-clasificacion":["reciboParaCargo","cargoDeReciboFirme","reciboNombreCasa","cargoDeRecibo","cargoDeReciboFirmeCalc","recFrase","reciboVetado","reciboNoIdentidad","reciboPagadoCon","fixedPaymentState","fixedPaymentIdentity","fixedPaymentProof","accFixed","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentFeedClear","fixedPaymentExpenses","expenseDeletedSet","fixedExpenseKey","expenseDeletedSets"],
    "widget-banco":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "widget-app-cerrada":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboSufijo","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "inc-2909-02-inicio-natural":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","recFrase","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon"],
    "inc-3009-nomina-anticipada":["reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboParaCargo","recFrase","reciboSufijo","reciboNoUnion","esFilaDeBanco","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboNoTope","reciboPagadoCon","RECIBO_NO_MAX"],
    "inc-2909-03-retirada":["reciboSufijo","cargoDeRecibo","esFilaDeBanco","reponerCargoDeRecibo","reciboNoDe","reciboNoIdentidad","admiteMarcaDe","reciboVetado","recFrase","reciboNoPon","reciboPagadoCon","conSaldoMostrado","reciboNoTope","RECIBO_NO_MAX"],
    "inc-2909-01-widget-periodo":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboSufijo","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "inc-0210-01-plan-cuota":["reciboVetado","reciboNoIdentidad","recFrase"],
    "inc-0210-03-gastos-periodo":["cargoDeRecibo","quitarCargoDeRecibo","reponerCargoDeRecibo","reciboNoDe","reciboNoIdentidad","admiteMarcaDe","reciboEtiqueta","reciboSufijo","reciboVetado","recFrase","reciboNoPon","reciboNoClaves","conSaldoMostrado","reciboPagadoCon","cargoDeReciboFirme","reciboNoTope","insumosSaldoGasto","saldoCuentaMostrada","cargoDeReciboFirmeCalc","nominaYaEntro","accInject","roundupOf","gastoDelMesPorBanco","saldoCuentaGasto","isEfectivoEnt","reciboNombreCasa","lastWorkingDay","isCardSpend","spareOf","RECIBO_NO_MAX"],
    "feature-0210-01-gasolina-taxi":["cargoDeRecibo","reciboSufijo","reciboVetado","reciboNoIdentidad","fixedPaymentIdentity"],
    "inc-0210-02-categoria-elegida":["reciboSufijo","cargoDeRecibo","esFilaDeBanco","reciboVetado","reciboNoIdentidad"],
    "inc-0310-01-meta-regla":["cargoDeRecibo","reciboVetado","reciboNoIdentidad","fixedPaymentIdentity"],
    "feature-0310-01-movilidad":["cargoDeRecibo","reciboSufijo","quitarCargoDeRecibo","reponerCargoDeRecibo","reciboNoDe","reciboNoIdentidad","admiteMarcaDe","reciboEtiqueta","cargoDeReciboFirme","reciboVetado","esFilaDeBanco","recFrase","reciboNoPon","reciboNoClaves","conSaldoMostrado","reciboPagadoCon","cargoDeReciboFirmeCalc","reciboNoTope","insumosSaldoGasto","saldoCuentaMostrada","reciboNombreCasa","nominaYaEntro","accInject","roundupOf","gastoDelMesPorBanco","saldoCuentaGasto","lastWorkingDay","isCardSpend","spareOf","RECIBO_NO_MAX"],
    "inc-0310-gastos-sin-limite":["cargoDeRecibo","quitarCargoDeRecibo","reponerCargoDeRecibo","reciboNoDe","reciboNoIdentidad","admiteMarcaDe","reciboEtiqueta","reciboSufijo","reciboVetado","recFrase","reciboNoPon","reciboNoClaves","conSaldoMostrado","reciboPagadoCon","cargoDeReciboFirme","reciboNoTope","insumosSaldoGasto","saldoCuentaMostrada","cargoDeReciboFirmeCalc","nominaYaEntro","accInject","roundupOf","gastoDelMesPorBanco","saldoCuentaGasto","isEfectivoEnt","reciboNombreCasa","lastWorkingDay","isCardSpend","spareOf","RECIBO_NO_MAX"],
    "inc-0710-gastos-mes-madrid":["cargoDeRecibo","quitarCargoDeRecibo","reponerCargoDeRecibo","reciboNoDe","reciboNoIdentidad","admiteMarcaDe","reciboEtiqueta","reciboSufijo","reciboVetado","recFrase","reciboNoPon","reciboNoClaves","conSaldoMostrado","reciboPagadoCon","cargoDeReciboFirme","reciboNoTope","insumosSaldoGasto","saldoCuentaMostrada","cargoDeReciboFirmeCalc","nominaYaEntro","accInject","roundupOf","gastoDelMesPorBanco","saldoCuentaGasto","isEfectivoEnt","reciboNombreCasa","lastWorkingDay","isCardSpend","spareOf","RECIBO_NO_MAX"],
    "inc-0810-dashboard-recents-memo":["reciboEtiqueta","cargoDeRecibo","cargoDeReciboFirme","dateMs","reciboVetado","reciboNoIdentidad","cargoDeReciboFirmeCalc","_pdMs","fixedPaymentIdentity","expenseBankOf","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","partirEntDeuda","recNorm","recFrase","recDay","recNameMatch","recAmtClose","fixedPaymentProof","accFixed","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","recTokens","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentFeedClear","fixedPaymentExpenses","accRole","fixedExpenseKey","_pdCache","CAT_NEUTRAS","DUP_DIAS_MS"],
    "inc-0810-metas-editar-regla":["reciboSufijo","cargoDeRecibo","dateMs","reciboVetado","reciboNoIdentidad","_pdMs","_pdCache"],
    "inicio-grafica-vuelve":["cargoDeRecibo","reciboVetado","reciboNoIdentidad","fixedPaymentIdentity"],
    "widget-pago-app-cerrada":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboSufijo","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "bancos-sin-hueco":["reciboParaCargo","cargoDeRecibo","reciboVetado","reciboNoIdentidad","recFrase","reciboSufijo","cargoDeReciboFirme","reciboNombreCasa","cargoDeReciboFirmeCalc","reciboPagadoCon"],
    "widget-ciclo-puente":["esFilaDeBanco","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reciboSufijo","cargoDeReciboFirmeCalc","reciboNombreCasa","reciboPagadoCon","fixedPaymentState","recFrase","fixedPaymentProof","fixedPaymentAutoOwner","fixedPaymentExpenseRows","fixedExpenseEligible","fixedPaymentContenders","fixedPaymentExpenseChoice","fixedPaymentUnique","fixedPaymentModel","fixedPaymentDate","fixedPaymentExpenses","fixedExpenseKey","DUP_DIAS_MS"],
    "recibos-cargo-unico":["recFrase","reciboVetado","reciboNoIdentidad","cargoDeReciboFirme","reponerCargoDeRecibo","reciboNoDe","admiteMarcaDe","reciboSufijo","cargoDeReciboFirmeCalc","reciboNoPon","reciboPagadoCon","conSaldoMostrado","reciboNombreCasa","reciboNoTope","saldoCuentaMostrada","saldoCuentaGasto","RECIBO_NO_MAX"],
    "bancos-acuse-reconexion":["reciboParaCargo","cargoDeRecibo","reciboVetado","reciboNoIdentidad","recFrase","reciboSufijo","cargoDeReciboFirme","reciboNombreCasa","cargoDeReciboFirmeCalc","reciboPagadoCon"],
    "tr-iguales-ordinal":["reciboSufijo","reciboParaCargo","cargoDeReciboFirme","histFilaGasto","reciboNoUnion","esFilaDeBanco","cargoDeRecibo","reciboVetado","reciboNoIdentidad","recFrase","reciboNombreCasa","cargoDeReciboFirmeCalc","reciboNoTope","reciboPagadoCon","RECIBO_NO_MAX"],
    "inicio-patrimonio-flujos":["cargoDeRecibo","reciboVetado","reciboNoIdentidad","fixedPaymentIdentity"]};
  // Dieciocho de ellos llevan además la lista de métodos de `cloud` que leen: ganan el único
  // método nuevo, `setExpenseRecibo`, al final de esa lista (lo llaman `subirGasto` o la ficha).
  const membersExpected=["inc-3009-01-cargos","fin05-widget-reentrada","fin05-pago-cerrada","widget-app-cerrada","inc-3009-nomina-anticipada","inc-2909-03-retirada","inc-2909-01-widget-periodo","inc-0210-03-gastos-periodo","feature-0210-01-gasolina-taxi","inc-0210-02-categoria-elegida","feature-0310-01-movilidad","inc-0310-gastos-sin-limite","inc-0710-gastos-mes-madrid","widget-pago-app-cerrada","bancos-sin-hueco","widget-ciclo-puente","recibos-cargo-unico","bancos-acuse-reconexion"];
  const functions=logicFunctions(source),data=logicData(source),grown={},members=[];
  for(const [key,scope] of Object.entries(integrated)){
    if(JSON.stringify(scopes[key])===JSON.stringify(scope))continue;
    const {web:nowWeb,...rest}=scopes[key],{web:oldWeb,...oldRest}=scope;
    assert.deepEqual(rest,oldRest,key+": sólo cambia la lista web");
    const head=nowWeb.slice(0,oldWeb.length),at=oldWeb.findIndex(u=>u.data==="cloud"&&u.members);
    if(at>=0&&JSON.stringify(head[at])!==JSON.stringify(oldWeb[at])){
      assert.deepEqual(head[at],{...oldWeb[at],members:oldWeb[at].members.concat("setExpenseRecibo")},key+": la lista de métodos sólo gana setExpenseRecibo, al final");
      members.push(key);head[at]=oldWeb[at];
    }
    assert.deepEqual(head,oldWeb,key+": ninguna unidad anterior se pierde ni cambia de orden");
    const added=nowWeb.slice(oldWeb.length);
    assert.ok(added.length>0&&added.every(u=>Object.keys(u).length===2&&(u.function||u.data)&&[core,i18n,motor].includes(u.file)),key+": sólo unidades sueltas de la lógica");
    grown[key]=added.map(u=>u.function||u.data);
    // El motivo se comprueba: cada unidad añadida es hoy una dependencia real de lo que el
    // descriptor de la121 ya vigilaba, y ese descriptor no la nombraba. Que el de ahora la vigila
    // lo acreditan, unidad a unidad, las dos auditorías generales de dependencias de más abajo.
    const deps=scopeDependencies(scope,source,functions),values=scopeDataDependencies(scope,source,functions,data);
    for(const unit of added){
      const name=unit.function||unit.data;
      assert.ok((unit.function?deps:values).find(d=>d.name===name&&d.file===unit.file),key+": "+name+" es dependencia real de lo que ya vigilaba");
      assert.equal(oldWeb.some(u=>typeof u!=="string"&&u.file===unit.file&&(u.function||u.data)===name),false,key+": el descriptor121 no nombraba "+name);
    }
  }
  assert.deepEqual(grown,grownExpected,"descriptores que crecen: lista cerrada");
  assert.deepEqual(members,membersExpected,"listas de métodos de cloud que crecen: lista cerrada");
  // El alcance nuevo. Semilla: todo lo que la entrega añade o cambia en la lógica (00-core, textos
  // y cajones de 01-i18n, motor), sus textos en los tres idiomas, las pantallas que lo pintan o lo
  // escriben y el guardado. Detrás van sus dependencias transitivas, que exigen las auditorías.
  assert.deepEqual(Object.keys(scopes[id]),["web","edge","unidades"],"web y servidor, sin APK: el nativo no cambia");
  assert.equal(scopes[id].unidades,true);
  const persist=scopes[bancos].web.find(u=>u.from&&u.from.includes("INC-0410 guardado: de aquí al límite"));
  assert.ok(persist,"el bloque del guardado, el mismo que vigila la tanda del acuse");
  const seedLogic=[
    {"file":"src/modules/00-core.js","function":"subirGasto"},
    {"file":"src/modules/00-core.js","function":"reciboSufijo"},
    {"file":"src/modules/00-core.js","function":"expenseSourceForCloud"},
    {"file":"src/modules/00-core.js","function":"expenseBankOf"},
    {"file":"src/modules/00-core.js","function":"canRecognizeWithdrawal"},
    {"file":"src/modules/00-core.js","function":"expenseFromRow"},
    {"file":"src/modules/00-core.js","function":"refreshExpenseFromCloud"},
    {"file":"src/modules/00-core.js","function":"esFilaDeBanco"},
    {"file":"src/modules/00-core.js","function":"mergeExpensesFromCloud"},
    {"file":"src/modules/01-i18n.js","function":"expenseCountsCash"},
    {"file":"src/modules/01-i18n.js","function":"expenseBucket"},
    {"file":"src/modules/01-i18n.js","function":"cargoDeRecibo"},
    {"file":"src/modules/01-i18n.js","function":"reciboEtiqueta"},
    {"file":"src/modules/01-i18n.js","function":"recompensasDelMes"},
    {"file":"src/modules/01-i18n.js","function":"reconcileTR"},
    {"file":"src/modules/01-i18n.js","function":"detectSubscriptions"},
    {"file":"src/modules/08-motor-bank.js","function":"fixedPaymentAutoOwner"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboVetado"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNoClaves"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNoIdentidad"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNoDe"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNoPon"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNoTope"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNoUnion"},
    {"file":"src/modules/08-motor-bank.js","function":"fixedPaymentProof"},
    {"file":"src/modules/08-motor-bank.js","function":"fixedPaymentState"},
    {"file":"src/modules/08-motor-bank.js","function":"applyBankBalances"},
    {"file":"src/modules/08-motor-bank.js","function":"recFrase"},
    {"file":"src/modules/08-motor-bank.js","function":"importObExpenses"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboNombreCasa"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboParaCargo"},
    {"file":"src/modules/08-motor-bank.js","function":"cargoDeReciboFirme"},
    {"file":"src/modules/08-motor-bank.js","function":"cargoDeReciboFirmeCalc"},
    {"file":"src/modules/08-motor-bank.js","function":"reciboPagadoCon"},
    {"file":"src/modules/08-motor-bank.js","function":"conSaldoMostrado"},
    {"file":"src/modules/08-motor-bank.js","function":"quitarCargoDeRecibo"},
    {"file":"src/modules/08-motor-bank.js","function":"admiteMarcaDe"},
    {"file":"src/modules/08-motor-bank.js","function":"reponerCargoDeRecibo"},
    {"file":"src/modules/08-motor-bank.js","function":"sinCargoDelPlan"},
    {"file":"src/modules/08-motor-bank.js","function":"quitarDelPlan"},
    {"file":"src/modules/08-motor-bank.js","function":"cuotasDeDeudaPorMarcar"},
    {"file":"src/modules/08-motor-bank.js","function":"marcarCuotaAMano"},
    {"file":"src/modules/08-motor-bank.js","function":"histMatchesModeled"},
    {"file":"src/modules/08-motor-bank.js","function":"histFilaGasto"},
    {"file":"src/modules/08-motor-bank.js","function":"histClassifyCandidates"},
    {"file":"src/modules/08-motor-bank.js","function":"removeFixedById"},
    {"file":"src/modules/08-motor-bank.js","function":"removeOneoffById"},
    {"file":"src/modules/08-motor-bank.js","function":"Fijos"},
    {"file":"src/modules/00-core.js","data":"cloud"},
    {"file":"src/modules/00-core.js","data":"CLOUD_WRITES"},
    {"file":"src/modules/08-motor-bank.js","data":"RECIBO_NO_MAX"}];
  const line=from=>({file:i18n,from,to:"\n",includeTo:true});
  const seed=[
    ...seedLogic,
    line('    f_recibo_marca:"Es el cargo'),line('    f_recibo_marca:"This is the charge'),line('    f_recibo_marca:"És el càrrec'),
    {file:i18n,from:' g_recibo_de:"Recibo: {name}"',to:', g_filters_debts:'},{file:i18n,from:' g_recibo_de:"Bill: {name}"',to:', g_filters_debts:'},{file:i18n,from:' g_recibo_de:"Rebut: {name}"',to:', g_filters_debts:'},
    line('  bp_hist_esrecibo:"es tu recibo'),line('  bp_hist_quizarecibo:"parece tu recibo'),
    line('  bp_hist_esrecibo:"this is your bill'),line('  bp_hist_quizarecibo:"this looks like your bill'),
    line('  bp_hist_esrecibo:"és el teu rebut'),line('  bp_hist_quizarecibo:"sembla el teu rebut'),
    {file:gastos,function:"Expenses"},
    {file:gastos,from:"const MovRow=React.memo(function MovRow(",to:"/* Sheet de filtros (2026-08-05):"},
    {file:gastos,function:"ExpenseDetailSheet"},
    {file:"src/modules/03-tab-dash.js",from:"        recent.length===0",to:"\n  );\n}"},
    {file:"src/modules/06-sync-brokers.js",function:"InvestmentRewards"},
    {file:"src/modules/10-app-components.js",function:"BankHistoryImport"},
    {file:"src/modules/13-hogar.js",function:"buildHouseholdSnapshot"},
    {file:main,from:"  const syncCloudExpenses=function(){",to:"  const syncFromCloud=function(s, opts){"},
    {file:main,from:"  const syncFromCloud=function(",to:"  // CAPA 2 — Open Banking:"},
    {file:main,from:"  },[state.accounts,state.expenses,state.bankTx,state.investments",to:"  const budgetMonth="},
    persist];
  assert.deepEqual(scopes[id].web.slice(0,seed.length),seed);
  assert.equal(scopes[id].web.length,311,"semilla más dependencias transitivas");
  assert.ok(scopes[id].web.slice(seed.length).every(u=>Object.keys(u).length===2&&(u.function||u.data)),"detrás de la semilla, sólo dependencias sueltas");
  // Toda función o dato que la entrega añade o cambia en la lógica está en la semilla. `LANG`, el
  // diccionario entero, cambia por los textos nuevos: se vigilan sus líneas, no el objeto.
  const oldFunctions=logicFunctions(old),oldData=logicData(old),touched=[];
  for(const [key,fn] of functions)if(!oldFunctions.has(key)||oldFunctions.get(key).text!==fn.text)touched.push(fn.file+":"+fn.name);
  for(const [key,value] of data)if(!oldData.has(key)||oldData.get(key).text!==value.text)touched.push(value.file+":"+value.name);
  for(const [key,fn] of oldFunctions)assert.ok(functions.has(key),fn.name+": la entrega no retira ninguna función de la lógica");
  assert.deepEqual(touched.slice().sort(),seedLogic.map(u=>u.file+":"+(u.function||u.data)).concat(i18n+":LANG").sort(),"lo que cambia en la lógica es exactamente la semilla, más los textos");
  // Y cada texto y cada pantalla de la semilla cambia de verdad frente a la121 (el guardado no: va
  // porque Gastos y el histórico escriben con el set real).
  for(const unit of seed.slice(seedLogic.length)){
    if(unit===persist)continue;
    let prior=null;try{prior=scopeText(unit,old);}catch(error){assert.equal(error.code,"BETA_SCOPE_ABSENT");}
    assert.notEqual(prior,scopeText(unit,source),(unit.function||unit.from)+": cambia en esta entrega");
  }
  const edgeFiles=["supabase/functions/_shared/presupuesto.ts","supabase/functions/ingest/index.ts","supabase/functions/ingest/widget.ts"];
  assert.deepEqual(scopes[id].edge,edgeFiles,"la regla compartida que cambia y la única función que la importa, que hay que desplegar antes que la web");
  for(const key of ["historial","auditoria","native","codigosCompatibles","compatibilidadGit","compatibilidadSha"])assert.equal(scopes[id][key],undefined,"identidad nueva sin "+key);
  // Lista cerrada de huellas frente a la121: una que se mueva sin declarar, o una declarada que no
  // se mueva, es rojo. Cada una lleva las unidades exactas de su descriptor121 que la mueven. Todas
  // por la web; `tr-iguales-ordinal` además por el servidor, porque vigila `_shared/presupuesto.ts`,
  // que ahora excluye el cargo de recibo (`esCargoDeRecibo`).
  const whyExpected={
    "inc-3009-01-cargos":["fixedPaymentAutoOwner","fixedPaymentProof","fixedPaymentState","expenseBankOf","var _pdCache=new Map();","reconcileTR","  const setReceipt=function(","  const receiptDate=","subirGasto","cloud","expenseSourceForCloud"],
    "fin05-widget-reentrada":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments","  const wR=useRef(false)","subirGasto","cloud","expenseSourceForCloud"],
    "fin05-pago-cerrada":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments","  const wR=useRef(false)","subirGasto","cloud","expenseSourceForCloud"],
    "tr-descripcion-clasificacion":["expenseBankOf","expenseFromRow","importObExpenses","histMatchesModeled","histClassifyCandidates"],
    "widget-banco":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments"],
    "widget-app-cerrada":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments","  const wR=useRef(false)","subirGasto","cloud","expenseSourceForCloud"],
    "inc-2909-02-inicio-natural":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","fixedPaymentState","fixedPaymentProof","fixedPaymentAutoOwner"],
    "inc-3009-nomina-anticipada":["expenseBankOf","expenseFromRow","var _pdCache=new Map();","reconcileTR","MovRow","applyBankBalances","importObExpenses","  },[state.accounts,state.expenses,state.bankTx,state.investments","subirGasto","marcarCuotaAMano","detectSubscriptions","fixedPaymentProof","fixedPaymentState","cuotasDeDeudaPorMarcar","fixedPaymentAutoOwner","cloud","expenseSourceForCloud","  const filtered=useMemo(","  const monthSummary=useMemo(","  const syncFromCloud=function(","refreshExpenseFromCloud","mergeExpensesFromCloud","      // FIN-07: el paginador solo resuelve"],
    "inc-2909-03-retirada":["expenseSourceForCloud","canRecognizeWithdrawal","refreshExpenseFromCloud","mergeExpensesFromCloud","expenseCountsCash","applyBankBalances","  const withdrawalPending=useRef({});","      setCat:setCat, setCuota:setCuota,","function ExpenseDetailSheet(","    canRecognizeWithdrawal(exp) &&","  const syncCloudExpenses=function(){","  const setReceipt=function(","expenseBankOf","subirGasto","fixedPaymentState","fixedPaymentProof","fixedPaymentAutoOwner","cloud"],
    "inc-2909-01-widget-periodo":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments","  const wR=useRef(false)","subirGasto","cloud","expenseSourceForCloud"],
    "inc-0210-01-plan-cuota":["  },[state.accounts,state.expenses,state.bankTx,state.investments","expenseBankOf","fixedPaymentState","fixedPaymentProof","fixedPaymentAutoOwner"],
    "inc-0210-03-gastos-periodo":["Expenses","subirGasto","canRecognizeWithdrawal","expenseSourceForCloud","marcarCuotaAMano","expenseBankOf","expenseBucket","detectSubscriptions","fixedPaymentState","fixedPaymentProof","expenseCountsCash","fixedPaymentAutoOwner","cloud"],
    "feature-0210-01-gasolina-taxi":["subirGasto","expenseCountsCash","expenseBankOf","cloud","expenseSourceForCloud"],
    "inc-0210-02-categoria-elegida":["        const kept=keepCategoryChoices(prev.expenses, incoming, readStartedAt);","expenseSourceForCloud","canRecognizeWithdrawal","mergeExpensesFromCloud","expenseBankOf","refreshExpenseFromCloud"],
    "inc-0310-01-meta-regla":["expenseCountsCash","expenseBankOf"],
    "feature-0310-01-movilidad":["subirGasto","expenseCountsCash","expenseBankOf","cloud","expenseSourceForCloud","Expenses","ExpenseDetailSheet","  const syncCloudExpenses=function(){","canRecognizeWithdrawal","marcarCuotaAMano","expenseBucket","detectSubscriptions","fixedPaymentState","mergeExpensesFromCloud","fixedPaymentProof","fixedPaymentAutoOwner","refreshExpenseFromCloud"],
    "inc-0310-gastos-sin-limite":["Expenses","subirGasto","canRecognizeWithdrawal","expenseSourceForCloud","marcarCuotaAMano","expenseBankOf","expenseBucket","detectSubscriptions","fixedPaymentState","fixedPaymentProof","expenseCountsCash","fixedPaymentAutoOwner","cloud"],
    "inc-0710-gastos-mes-madrid":["Expenses","subirGasto","canRecognizeWithdrawal","expenseSourceForCloud","marcarCuotaAMano","expenseBankOf","expenseBucket","detectSubscriptions","fixedPaymentState","fixedPaymentProof","expenseCountsCash","fixedPaymentAutoOwner","cloud"],
    "inc-0810-dashboard-recents-memo":["        recent.length===0"],
    "inc-0810-metas-editar-regla":["cloud","expenseSourceForCloud","canRecognizeWithdrawal","expenseBankOf"],
    "inicio-grafica-vuelve":["expenseBankOf","expenseCountsCash"],
    "widget-pago-app-cerrada":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments","  const wR=useRef(false)","subirGasto","cloud","expenseSourceForCloud"],
    "bancos-sin-hueco":["cloud","importObExpenses","expenseBankOf","applyBankBalances","cuotasDeDeudaPorMarcar","subirGasto","fixedPaymentProof","fixedPaymentState","fixedPaymentAutoOwner","expenseCountsCash","expenseSourceForCloud"],
    "widget-ciclo-puente":["expenseBankOf","expenseFromRow","refreshExpenseFromCloud","mergeExpensesFromCloud","var _pdCache=new Map();","reconcileTR","  },[state.accounts,state.expenses,state.bankTx,state.investments","  const wR=useRef(false)","subirGasto","cloud","expenseSourceForCloud"],
    "recibos-cargo-unico":["fixedPaymentAutoOwner","fixedPaymentProof","fixedPaymentState","expenseBankOf","var _pdCache=new Map();","reconcileTR","  const setReceipt=function(","  const receiptDate=","subirGasto","cloud","expenseSourceForCloud"],
    "bancos-acuse-reconexion":["cloud","importObExpenses","expenseBankOf","applyBankBalances","cuotasDeDeudaPorMarcar","subirGasto","fixedPaymentProof","fixedPaymentState","fixedPaymentAutoOwner","expenseCountsCash","expenseSourceForCloud"],
    "tr-iguales-ordinal":["expenseSourceForCloud","expenseFromRow","expenseBankOf","importObExpenses","histClassifyCandidates","BankHistoryImport","  const syncCloudExpenses=function(){","  const syncFromCloud=function(","histMatchesModeled","subirGasto","mergeExpensesFromCloud","reconcileTR","applyBankBalances","cuotasDeDeudaPorMarcar","refreshExpenseFromCloud","expenseCountsCash","fixedPaymentProof","fixedPaymentState","fixedPaymentAutoOwner","cloud","canRecognizeWithdrawal","supabase/functions/_shared/presupuesto.ts"],
    "inicio-patrimonio-flujos":["expenseBankOf","expenseCountsCash"]};
  const expectedMoves=Object.fromEntries(Object.keys(whyExpected).map(key=>[key,key===tr?["web","edge"]:["web"]]));
  assert.deepEqual(Object.keys(whyExpected),Object.keys(grownExpected),"se mueven las mismas veintiocho que crecen");
  const previous=new Map();
  const measure=reader=>{
    const now=JSON.parse(reader("scripts/beta-sources.json")),moved={};
    for(const [key,scope] of Object.entries(integrated)){
      // El rechazo109 usa su pin histórico, nunca un bloque retirado del renderer actual.
      if(key===archiveId){assert.deepEqual(auditedRevision(key,reader),auditedRevision(key,source121));continue;}
      if(!previous.has(key))previous.set(key,betaRevision(key,source121,undefined,scope));
      const a=previous.get(key),b=betaRevision(key,reader,undefined,now[key]);
      const surfaces=["web","native","edge"].filter(s=>a[s]!==b[s]);
      if(surfaces.length)moved[key]=surfaces;
    }
    return moved;
  };
  const verify=(reader,expected=expectedMoves)=>assert.deepEqual(measure(reader),expected,"lista cerrada: ni una huella extra ni una declarada que no cambie");
  verify(source);
  const why={};
  for(const key of Object.keys(expectedMoves))why[key]=["web","edge"].flatMap(surface=>(integrated[key][surface]||[]).filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>typeof u==="string"?u:(u.function||u.data||u.from)));
  assert.deepEqual(why,whyExpected,"qué unidad mueve cada huella");
  // De las veintiocho sólo la de Inicio y las dos de la 120 están en el panel, y ya lo estaban.
  const enPanel=[inicio,tr,bancos];
  for(const key of Object.keys(expectedMoves))assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),enPanel.includes(key),key+(enPanel.includes(key)?": sigue en el panel con su huella nueva":": su huella cambia, pero no vuelve al panel"));
  // Una dependencia ajena que cambia debe fallar aunque el catálogo conserve sus textos.
  const shell="src/shell.html",from='animation:mclpop .5s cubic-bezier(.32,.72,0,1) backwards;}';
  assert.equal(source(shell).split(from).length,2,"mutante sobre el splash actual real");
  const changed=f=>f===shell?source(f).replace(from,from.replace(".5s",".6s")):source(f);
  assert.throws(()=>verify(changed),/lista cerrada/,"el splash no está declarado: no puede moverse por arrastre");
  assert.throws(()=>verify(source,{...expectedMoves,"splash-animado":["web"]}),/lista cerrada/,"añadir una declaración vacía no permite heredar identidad");
  const missing={...expectedMoves};delete missing["widget-ciclo-puente"];assert.throws(()=>verify(source,missing),/lista cerrada/,"una huella real no declarada pone rojo");
  const splash="splash-animado";
  assert.deepEqual(betaRevision(splash,source,undefined,scopes[splash]),betaRevision(splash,source121,undefined,integrated[splash]),"el OK del splash no se reinicia por arrastre");
  // El servidor: la tanda del acuse (bank-sync y bank-callback) no cambia; la de Trade Republic sí.
  assert.deepEqual(scopes[bancos].edge,integrated[bancos].edge);assert.deepEqual(scopes[tr].edge,integrated[tr].edge);
  assert.equal(betaRevision(bancos,source,undefined,scopes[bancos]).edge,betaRevision(bancos,source121,undefined,integrated[bancos]).edge,"el servidor de la tanda del acuse no cambia en esta entrega");
  assert.notEqual(betaRevision(tr,source,undefined,scopes[tr]).edge,betaRevision(tr,source121,undefined,integrated[tr]).edge,"el ingest de la tanda de Trade Republic es el de esta entrega: se despliega una vez, antes que la web");
  const current=betaRevision(id,source,undefined,scopes[id]);
  assert.ok(current.web&&current.edge);assert.equal(current.native,undefined);
  assert.equal(current.edge,betaRevision(tr,source,undefined,scopes[tr]).edge,"las dos tandas con servidor esperan el mismo despliegue de ingest");
  assert.throws(()=>betaRevision(id,source121,undefined,scopes[id]),error=>error.code==="BETA_SCOPE_ABSENT","la 121 no acredita el cliente: no tiene la marca de recibo");
  // Cada regla nueva del cliente reabre la tanda por la web y sólo por la web.
  for(const [file,a,b] of [
    [i18n,"if(cargoDeRecibo(e, s)) return false;",""],
    [i18n,"return reciboVetado(s, id, reciboNoIdentidad(e), e.id) ? null : f;","return f;"],
    [core,"return id ? \"~recibo.\"+id : \"\";","return \"\";"],
    [motor,"if(a===b?na.indexOf(k)>=0||nb.indexOf(k)>=0:(a>b?na:nb).indexOf(k)>=0) no.push(k);","no.push(k);"],
    [motor,"if(dateMs(e.date)<desde) return e;",""],
    [gastos,"if(fixedId==null && cargoDeRecibo(ex,state)){ quitarRecibo(ex); return; }",""],
    [main,"if(prev.reciboNo||cloudState.reciboNo) Object.assign(baseObj, reciboNoUnion(prev, cloudState));",""],
    [main,"if(merged.sinMarca.length) setTimeout(function(){ merged.sinMarca.forEach(function(e){ cloud.setExpenseRecibo(e).catch(function(){}); }); },0);",""]]){
    assert.equal(source(file).split(a).length,2,"mutante sobre fuente real: "+a);
    const mutated=betaRevision(id,f=>f===file?source(f).replace(a,b):source(f),undefined,scopes[id]);
    assert.notEqual(mutated.web,current.web,"reabre la tanda: "+a);
    assert.equal(mutated.edge,current.edge,"sin mover el servidor: "+a);
  }
  // Y la regla del servidor, por la superficie Edge y sólo por ella.
  const servidor="if (esCuotaDeDeuda(fila.source) || esCargoDeRecibo(fila.source)) return false;";
  assert.equal(source(edgeFiles[0]).split(servidor).length,2,"mutante sobre fuente real: "+servidor);
  const sinRegla=betaRevision(id,f=>f===edgeFiles[0]?source(f).replace(servidor,"if (esCuotaDeDeuda(fila.source)) return false;"):source(f),undefined,scopes[id]);
  assert.notEqual(sinRegla.edge,current.edge,"reabre la tanda por el servidor");assert.equal(sinRegla.web,current.web,"sin mover la web");
  assert.deepEqual(betaRevision(id,f=>f==="supabase/functions/bank-sync/index.ts"?source(f)+"\n// mutante":source(f),undefined,scopes[id]),current,"una función ajena no pertenece a esta tanda");
  // Las tres uniones del pull de estado conviven: vínculos (120), historial (121) y vetos (122).
  for(const union of ["const gem=fusionarGemelos(prev.gemelos, cloudState.gemelos);","baseObj.accountBalanceHistory=sameOwner?mergeAccountBalanceHistory(prev.accountBalanceHistory,baseObj.accountBalanceHistory):cloudState.accountBalanceHistory||{};","Object.assign(baseObj, reciboNoUnion(prev, cloudState));"])
    assert.equal(source(main).split(union).length,2,"sigue en el pull: "+union);
  const built=betaNotes(notes,source,scopes),receipt=betaDelivery(built,source,scopes),group=built[0].tandas[0];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[id,inicio,tr,bancos],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.edge,current.edge,"el panel la marca con servidor por confirmar");assert.equal(group.native,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[id],current.web);
  // Edge en Git no acredita la función activa: el recibo web no fabrica entrega de servidor.
  assert.equal(receipt.edge,undefined);assert.equal(JSON.stringify(receipt).includes(current.edge),false,"el recibo web no fabrica entrega de servidor");
  const original=betaDelivery(betaNotes(before,source121,integrated),source121,integrated);
  assert.deepEqual(receipt.pruebas,{
    [id]:{v:"4.26.122",contenido:JSON.stringify([id,expected122.tandas[0].t.es,expected122.tandas[0].items.es,1])},
    [inicio]:original.pruebas[inicio],[tr]:original.pruebas[tr],[bancos]:original.pruebas[bancos]},"cuatro guiones por probar; los tres anteriores, tal cual");
  for(const key of ["inicio-grafica-vuelve","bancos-sin-hueco","recibos-cargo-unico"]){
    assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),false,key+": retirada no resucita");
    assert.equal(receipt.pruebas[key],undefined,key+": no se vuelve a pedir al dueño");
  }
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});

// 4.26.123 (13/10/2026): la gráfica de Inicio aparece desde el primer día, también con hipoteca o
// préstamos dados de alta de antes. La 121 se vio en un móvil real SIN gráfica: nadie la había
// probado con deudas heredadas. Sin alcance nuevo: el registro no cambia y sólo se mueven dos
// huellas (Inicio y la gráfica113), por el cuadro de deudas hacia atrás, la cuenta manual mantenida
// y la «i». La tanda de Inicio sale de la nota 121 y se vuelve a presentar aquí con el paso 2
// corregido. Lista cerrada frente a la122.
const expected123={"v":"4.26.123","d":"2026-10-13","t":{"es":"Inicio: la gráfica, desde el primer día","en":"Home: the chart, from day one","ca":"Inici: la gràfica, des del primer dia"},"items":{"es":["La gráfica de Inicio ya aparece desde el primer día, también con hipoteca o préstamos dados de alta de antes, y los avisos van recogidos en la «i».","Bajo la gráfica, una sola línea dice desde qué fecha se dibuja. El detalle de cada cuenta, bien y deuda (desde cuándo hay datos y qué valores se mantienen) está en la «i» junto a «Patrimonio neto»."],"en":["The Home chart now shows from day one, also with a mortgage or loans added before, and the notices are gathered in the “i”.","Under the chart, a single line says from which date it is drawn. The detail for each account, property item and debt (from when there is data and which values are kept) is in the “i” next to “Net worth”."],"ca":["La gràfica d'Inici ja apareix des del primer dia, també amb hipoteca o préstecs donats d'alta d'abans, i els avisos van recollits a la «i».","Sota la gràfica, una sola línia diu des de quina data es dibuixa. El detall de cada compte, bé i deute (des de quan hi ha dades i quins valors es mantenen) és a la «i» al costat de «Patrimoni net»."]},"tandas":[{"id":"inicio-patrimonio-flujos","t":{"es":"Inicio: la gráfica de tu patrimonio y cuánto puedes gastar al día","en":"Home: your net worth chart and how much you can spend per day","ca":"Inici: la gràfica del teu patrimoni i quant pots gastar al dia"},"items":{"es":["1. Abre Inicio y apunta la cifra grande de arriba, con sus céntimos. Ve a Cartera: su cifra grande, con todos los bloques activados (cuentas, inversiones y bienes, menos deudas), es la misma al céntimo. Está mal si difieren, aunque sea en un céntimo.","2. Vuelve a Inicio: la gráfica aparece bajo la cifra y arranca hace unos días o semanas, no hoy. Entre la cifra y la gráfica no hay ningún texto; bajo los periodos hay, como mucho, una línea del estilo «Gráfica desde…». Toca la «i» que hay junto a «Patrimonio neto»: sale desde cuándo hay datos de cada cosa (tus cuentas, tus bienes, tus deudas, tus inversiones) y qué valores se mantienen. Está mal si no sale la gráfica, si empieza hoy, si dice «Todavía no hay gráfica» o si hay texto entre la cifra y la gráfica.","3. Mantén el dedo sobre la gráfica y muévelo a los lados: encima de la cifra aparece una fecha y la cifra pasa a ser la de ese día. Al soltar, vuelve la de hoy. Ahora desliza hacia abajo empezando con el dedo sobre la gráfica: la pantalla se mueve y la cifra no cambia.","4. Mira la tarjeta «Este mes» (o «Este ciclo»): «Te quedan X de Y» coincide con lo que marca Gastos. Debajo dice cuánto puedes gastar al día y durante cuántos días, contando hoy. Si ya te has pasado del presupuesto, esa línea no sale y no cuenta como fallo.","5. Bajo la gráfica, toca uno a uno los periodos (1M, 6M, 1A, Todo): la frase de color cambia con cada uno («… más que hace un mes», «… menos que hace 6 meses») y la gráfica se vuelve a dibujar. Solo salen los periodos para los que hay datos: si falta alguno, es lo esperado."],"en":["1. Open Home and note down the big figure at the top, cents included. Go to Portfolio: its big figure, with every block switched on (accounts, investments and property, minus debts), is the same to the cent. It is wrong if they differ, even by one cent.","2. Go back to Home: the chart appears under the figure and starts a few days or weeks back, not today. There is no text between the figure and the chart; under the periods there is, at most, one line along the lines of “Chart from…”. Tap the “i” next to “Net worth”: it says from when there is data for each thing (your accounts, property, debts, investments) and which values are kept. It is wrong if the chart does not show, if it starts today, if it says “No chart yet” or if there is text between the figure and the chart.","3. Keep your finger on the chart and move it sideways: a date appears above the figure and the figure becomes the one for that day. When you let go, today's figure comes back. Now swipe down starting with your finger on the chart: the screen scrolls and the figure does not change.","4. Look at the “This month” (or “This cycle”) card: “Left to spend X of Y” matches what Spending shows. Below, it says how much you can spend per day and for how many days, counting today. If you are already over budget, that line does not show and it does not count as a failure.","5. Under the chart, tap the periods one by one (1M, 6M, 1Y, All): the coloured sentence changes with each one (“… more than a month ago”, “… less than 6 months ago”) and the chart is drawn again. Only the periods that have data are offered: if one is missing, that is expected."],"ca":["1. Obre Inici i apunta la xifra gran de dalt, amb els cèntims. Ves a Cartera: la seva xifra gran, amb tots els blocs activats (comptes, inversions i béns, menys deutes), és la mateixa al cèntim. Està malament si són diferents, encara que sigui d'un cèntim.","2. Torna a Inici: la gràfica apareix sota la xifra i comença fa uns dies o setmanes, no avui. Entre la xifra i la gràfica no hi ha cap text; sota els períodes hi ha, com a molt, una línia de l'estil «Gràfica des de…». Toca la «i» que hi ha al costat de «Patrimoni net»: surt des de quan hi ha dades de cada cosa (els teus comptes, béns, deutes, inversions) i quins valors es mantenen. Està malament si no surt la gràfica, si comença avui, si diu «Encara no hi ha gràfica» o si hi ha text entre la xifra i la gràfica.","3. Mantén el dit sobre la gràfica i mou-lo cap als costats: damunt de la xifra apareix una data i la xifra passa a ser la d'aquell dia. En deixar anar, torna la d'avui. Ara llisca cap avall començant amb el dit sobre la gràfica: la pantalla es mou i la xifra no canvia.","4. Mira la targeta «Aquest mes» (o «Aquest cicle»): «Et queden X de Y» coincideix amb el que marca Despeses. A sota diu quant pots gastar al dia i durant quants dies, comptant avui. Si ja t'has passat del pressupost, aquesta línia no surt i no compta com a error.","5. Sota la gràfica, toca un a un els períodes (1M, 6M, 1A, Tot): la frase de color canvia amb cadascun («… més que fa un mes», «… menys que fa 6 mesos») i la gràfica es torna a dibuixar. Només surten els períodes per als quals hi ha dades: si en falta algun, és el que s'espera."]}}]};
// Catálogo cerrado: desde la124 se lee de su commit inmutable (la124 añade nota y tanda, y retira las tres aprobadas).
test("Catálogo123 histórico vuelve a presentar la tanda de Inicio sobre la122 sin alcance nuevo y declara las dos huellas que mueve",()=>{
  const read=source123;
  const inicio="inicio-patrimonio-flujos",recibo="recibo-cargo-en-gastos",tr="tr-iguales-ordinal",bancos="bancos-acuse-reconexion",grafica="inicio-grafica-vuelve";
  const integrated=JSON.parse(source122("scripts/beta-sources.json")),before=JSON.parse(source122("src/data/release-notes.json"));
  assert.equal(before[1].v,"4.26.121");assert.deepEqual(before[1].tandas.map(g=>g.id),[inicio]);
  const expectedNotes=[expected123,before[0],{...before[1],tandas:[]},...before.slice(2)];
  const source=f=>read(f).replace(/\r\n/g,"\n"),old=f=>source122(f).replace(/\r\n/g,"\n");
  const notes=JSON.parse(source("src/data/release-notes.json"));
  assert.deepEqual(notes,expectedNotes,"la nota 123 literal delante, la 121 sin su tanda y el resto del catálogo122 intacto");
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[["4.26.123",inicio,0],["4.26.122",recibo,0],["4.26.120",tr,0],["4.26.120",bancos,0]],"el panel enseña la tanda de Inicio con la 123, la del cargo de recibo y las dos de la 120, sin APK");
  for(const n of notes.slice(4))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  for(const key of [inicio,recibo,tr,bancos])assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===key).length,1,key+": una sola vez en todo el catálogo");
  assert.deepEqual(Object.keys(notes[0].tandas[0]),["id","t","items"],"la misma identidad, sin alias ni revisión heredada");
  // La tanda es la de la 121 con el paso 2 corregido, en los tres idiomas: ya no pide una línea
  // por bien entre la cifra y la gráfica, sino la gráfica bajo la cifra y el detalle en la «i».
  const prior=before[1].tandas[0];
  assert.deepEqual(notes[0].tandas[0].t,prior.t,"mismo título");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,2,lang+": dos puntos familiares");
    const steps=notes[0].tandas[0].items[lang];assert.equal(steps.length,5,lang+": cinco pasos");
    steps.forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)));
    assert.deepEqual(steps.filter((_,i)=>i!==1),prior.items[lang].filter((_,i)=>i!==1),lang+": sólo cambia el paso 2");
    assert.notEqual(steps[1],prior.items[lang][1],lang+": el paso 2 cambia");
    assert.equal(/valor propio desde|own value from|valor propi des de/.test(steps[1]),false,lang+": el paso 2 ya no pide una línea por bien entre la cifra y la gráfica");
    for(const text of steps)assert.equal(/borra|quita este|delete|remove|esborra|treu aquest|mañana|tomorrow|demà/i.test(text),false,lang+": ningún paso borra nada ni espera a otro día");
  }
  // Cada rótulo que cita el paso 2 es el texto real de la app, en su idioma.
  const literal={es:["«Gráfica desde…»","«Patrimonio neto»","«Todavía no hay gráfica»"],en:["“Chart from…”","“Net worth”","“No chart yet”"],ca:["«Gràfica des de…»","«Patrimoni net»","«Encara no hi ha gràfica»"]};
  const enFuente={es:['v42_net_since:"Gráfica desde {day}"','d_networth:"Patrimonio neto"','v42_net_missing:"Todavía no hay gráfica:'],en:['v42_net_since:"Chart from {day}"','d_networth:"Net worth"','v42_net_missing:"No chart yet:'],ca:['v42_net_since:"Gràfica des de {day}"','d_networth:"Patrimoni net"','v42_net_missing:"Encara no hi ha gràfica:']};
  const textos=source("src/modules/01-i18n.js");
  for(const lang of ["es","en","ca"])literal[lang].forEach((rotulo,i)=>{
    assert.ok(notes[0].tandas[0].items[lang][1].includes(rotulo),lang+": el paso 2 cita "+rotulo);
    assert.ok(textos.includes(enFuente[lang][i]),lang+": "+rotulo+" es el texto de la app ("+enFuente[lang][i]+")");
  });
  const verifyNotes=list=>assert.deepEqual(list,expectedNotes);
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verifyNotes(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde=["4.26.121/"+inicio];assert.throws(()=>verifyNotes(inherited),"no heredar el veredicto de la 121");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verifyNotes(withApk),"no hay APK que probar");
  const both=structuredClone(notes);both[2].tandas=structuredClone(before[1].tandas);assert.throws(()=>verifyNotes(both),"la tanda no se queda también en la 121");
  const text=structuredClone(notes);text[1].tandas[0].items.es[1]+="mutante";assert.throws(()=>verifyNotes(text),"el guion de la 122 no se toca");
  // Sin alcance nuevo: el registro es el de la 122, unidad a unidad.
  const scopes=JSON.parse(source("scripts/beta-sources.json"));
  assert.deepEqual(scopes,integrated,"ningún alcance nuevo, ninguno retirado y ningún descriptor que crezca");
  assert.deepEqual(JSON.parse(source("scripts/beta-archives.json")),archiveRefs,"sin repinar el rechazo109");
  // Huellas que se mueven, lista cerrada: Inicio y la gráfica113, las dos por la web y por las mismas
  // seis unidades (la tarjeta, la serie, la política de deudas y las tres líneas de textos).
  const expectedMoves={[inicio]:["web"],[grafica]:["web"]};
  const previous=new Map();
  const measure=reader=>{
    const now=JSON.parse(reader("scripts/beta-sources.json")),moved={};
    for(const [key,scope] of Object.entries(integrated)){
      if(key===archiveId){assert.deepEqual(auditedRevision(key,reader),auditedRevision(key,source122));continue;}
      if(!previous.has(key))previous.set(key,betaRevision(key,source122,undefined,scope));
      const a=previous.get(key),b=betaRevision(key,reader,undefined,now[key]);
      const surfaces=["web","native","edge"].filter(s=>a[s]!==b[s]);
      if(surfaces.length)moved[key]=surfaces;
    }
    return moved;
  };
  const verify=(reader,expected=expectedMoves)=>assert.deepEqual(measure(reader),expected,"lista cerrada: ni una huella extra ni una declarada que no cambie");
  verify(source);
  const units=["NetWorthNow","    // INC-0810 es: patrimonio de ahora.","    // INC-0810 en: patrimonio de ahora.","    // INC-0810 ca: patrimonio de ahora.","netWorthSeries","netWorthDebtPolicy"];
  const why={};
  for(const key of Object.keys(expectedMoves))why[key]=["web","edge"].flatMap(surface=>(integrated[key][surface]||[]).filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>typeof u==="string"?u:(u.function||u.data||u.from)));
  assert.deepEqual(why,{[inicio]:units,[grafica]:units},"qué unidad mueve cada huella");
  assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===grafica),false,grafica+": su huella cambia, pero no vuelve al panel");
  const shell="src/shell.html",from='animation:mclpop .5s cubic-bezier(.32,.72,0,1) backwards;}';
  assert.equal(source(shell).split(from).length,2,"mutante sobre el splash actual real");
  assert.throws(()=>verify(f=>f===shell?source(f).replace(from,from.replace(".5s",".6s")):source(f)),/lista cerrada/,"el splash no está declarado: no puede moverse por arrastre");
  const missing={...expectedMoves};delete missing[grafica];assert.throws(()=>verify(source,missing),/lista cerrada/,"una huella real no declarada pone rojo");
  // Cada regla de dinero nueva reabre la tanda de Inicio, y sólo por la web.
  const current=betaRevision(inicio,source,undefined,scopes[inicio]);
  assert.ok(current.web);assert.equal(current.native,undefined);assert.equal(current.edge,undefined);
  const shared="src/modules/02-ui-shared.js",dash="src/modules/03-tab-dash.js";
  for(const [file,a,b] of [
    [shared,"if(d.months!=null||!rebuilt(d)) n=Math.max(0,n);","n=Math.max(0,n);"],
    [shared,"const between=(month+(charge<=parts[2]?1:0))-((p[0]*12+p[1]-1)+(charge<=p[2]?1:0));","const between=0;"],
    [shared,"before:points.length?points[0].value:0","before:0"],
    [shared,"if(gaps[i].day&&!gaps[i].constant&&gaps[i].day!==start)gaps.splice(i,1);","if(false)gaps.splice(i,1);"],
    [dash,'tf("v42_net_since",{day:','tf("v42_net_kept",{day:'],
    [dash,'coverageLabels.map(function(label,i){return React.createElement("div",{key:i,"data-testid":"inicio-net-detail"},label);})','null']]){
    assert.equal(source(file).split(a).length,2,"mutante sobre fuente real: "+a);
    assert.notEqual(betaRevision(inicio,f=>f===file?source(f).replace(a,b):source(f),undefined,scopes[inicio]).web,current.web,"reabre la tanda: "+a);
  }
  // Lo que el build entrega al panel.
  const built=betaNotes(notes,source,scopes),receipt=betaDelivery(built,source,scopes),group=built[0].tandas[0];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[inicio,recibo,tr,bancos],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.native,undefined);assert.equal(group.edge,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[inicio],current.web);
  const original=betaDelivery(betaNotes(before,source122,integrated),source122,integrated);
  assert.notEqual(receipt.web[inicio],original.web[inicio],"la huella de Inicio es la de esta entrega, no la rechazada de la 121");
  assert.deepEqual(receipt.pruebas,{
    [inicio]:{v:"4.26.123",contenido:JSON.stringify([inicio,expected123.tandas[0].t.es,expected123.tandas[0].items.es,1])},
    [recibo]:original.pruebas[recibo],[tr]:original.pruebas[tr],[bancos]:original.pruebas[bancos]},"cuatro guiones por probar: el de Inicio con la 123 y los otros tres tal cual");
  for(const key of ["inicio-grafica-vuelve","bancos-sin-hueco","recibos-cargo-unico"]){
    assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),false,key+": retirada no resucita");
    assert.equal(receipt.pruebas[key],undefined,key+": no se vuelve a pedir al dueño");
  }
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad sin "+key);
});

// 4.26.124 (13/10/2026): bajar despacio desde el tope de Plan ya no hace saltar el contenido. Tanda
// NUEVA, solo web. Con ella salen del panel las tres que se aprobaron en el móvil sobre la
// 4.26.122.1 (13/10, 08:00-08:01): recibo-cargo-en-gastos (5 ok / 0 fallos), tr-iguales-ordinal
// (4 ok / 0 fallos) y bancos-acuse-reconexion (4 ok / 0 fallos). La de Inicio (123) sigue sin
// veredicto y se queda. Lista cerrada frente a la beta123: un descriptor nuevo, qué huellas se
// mueven y por qué. Ninguna superficie de servidor ni nativa cambia.
const expected124={"v":"4.26.124","d":"2026-10-13","t":{"es":"Plan: bajar despacio sin saltos","en":"Plan: scroll down slowly, no jumps","ca":"Pla: baixar a poc a poc sense salts"},"items":{"es":["En Plan, al bajar despacio desde arriba del todo la pantalla ya no da un salto: sigue al dedo desde el principio."],"en":["In Plan, scrolling down slowly from the very top no longer makes the screen jump: it follows your finger from the start."],"ca":["A Pla, en baixar a poc a poc des de dalt de tot la pantalla ja no fa un salt: segueix el dit des del principi."]},"tandas":[{"id":"plan-scroll-lento","t":{"es":"Plan: bajar despacio ya no hace saltar la pantalla","en":"Plan: scrolling down slowly no longer makes the screen jump","ca":"Pla: baixar a poc a poc ja no fa saltar la pantalla"},"items":{"es":["1. Abre Plan y toca «Deudas». Con la pantalla arriba del todo, pon el dedo a media pantalla y arrástralo MUY despacio hacia arriba, unos centímetros y sin soltar: el contenido acompaña al dedo desde el primer milímetro, de forma continua. Está mal si pega un brinco al empezar a moverse o se adelanta al dedo. Si en «Deudas» no hay lista suficiente para bajar, hazlo directamente en el paso 2.","2. Repite lo mismo en «Recibos» (si te sale «Ver más», tócalo antes para desplegar la lista y vuelve arriba del todo) y en «Metas». Después baja un buen trozo, vuelve arriba del todo y repítelo otra vez: en todos los casos el contenido sigue al dedo sin saltos.","3. Lo de siempre sigue igual: arriba del todo, tirar hacia abajo con un gesto normal cambia de sección (Recibos → Deudas → Metas); deslizar de lado cambia de pestaña; y al bajar la barra de abajo se esconde y al subir vuelve."],"en":["1. Open Plan and tap “Debts”. With the screen at the very top, put your finger mid-screen and drag it VERY slowly upwards, a few centimetres and without lifting: the content follows your finger from the first millimetre, smoothly. It is wrong if it jumps when it starts moving or gets ahead of your finger. If “Debts” has too short a list to scroll, do it directly in step 2.","2. Do the same in “Bills” (if you see “See more”, tap it first to unfold the list and go back to the very top) and in “Goals”. Then scroll down a good way, go back to the very top and do it again: in every case the content follows your finger with no jumps.","3. Everything else works as before: at the very top, pulling down with a normal gesture switches section (Bills → Debts → Goals); swiping sideways switches tab; and scrolling down hides the bottom bar, which comes back when you scroll up."],"ca":["1. Obre Pla i toca «Deutes». Amb la pantalla a dalt de tot, posa el dit a mitja pantalla i arrossega'l MOLT a poc a poc cap amunt, uns centímetres i sense deixar-lo anar: el contingut acompanya el dit des del primer mil·límetre, de manera contínua. Està malament si fa un bot en començar a moure's o s'avança al dit. Si a «Deutes» no hi ha prou llista per baixar, fes-ho directament al pas 2.","2. Repeteix el mateix a «Rebuts» (si et surt «Veure més», toca'l abans per desplegar la llista i torna a dalt de tot) i a «Metes». Després baixa un bon tros, torna a dalt de tot i repeteix-ho un altre cop: en tots els casos el contingut segueix el dit sense salts.","3. El de sempre continua igual: a dalt de tot, estirar cap avall amb un gest normal canvia de secció (Rebuts → Deutes → Metes); lliscar de costat canvia de pestanya; i en baixar la barra de baix s'amaga i en pujar torna."]}}]};
const scope124={"web":[{"file":"src/modules/14-v4-screens.js","from":"  /* DESLIZAR VERTICAL PARA CAMBIAR DE SEGMENTO","to":"  // Entrada sutil SOLO cuando el segmento cambia"},{"file":"src/modules/11-app-main.js","from":"  /* Ola nativa (`touch-action:pan-y` en `.page`) vs gestos de borde.","to":"  const onPageScroll=function(e){"},{"file":"src/shell.html","from":"  .page{flex:0 0 100%;min-width:100%;height:100%;overflow-y:auto;","to":"  .page.page-live{"},{"file":"src/modules/00-core.js","function":"gestureAxis"},{"file":"src/modules/00-core.js","data":"GEST_LEAD"},{"file":"src/modules/00-core.js","data":"GEST_MAX"},{"file":"src/modules/02-ui-shared.js","function":"mcReduced"}],"unidades":true};
test("Catálogo124 añade la tanda del scroll lento de Plan sobre la123, solo web, y declara cada huella que mueve",()=>{
  const plan="plan-scroll-lento",inicio="inicio-patrimonio-flujos",recibo="recibo-cargo-en-gastos",tr="tr-iguales-ordinal",bancos="bancos-acuse-reconexion";
  const integrated=JSON.parse(source123("scripts/beta-sources.json")),before=JSON.parse(source123("src/data/release-notes.json"));
  assert.deepEqual(before.slice(0,4).map(n=>[n.v,(n.tandas||[]).map(g=>g.id)]),[["4.26.123",[inicio]],["4.26.122",[recibo]],["4.26.121",[]],["4.26.120",[tr,bancos]]],"el panel de la 123 publicada");
  const expectedNotes=[expected124,before[0],{...before[1],tandas:[]},before[2],{...before[3],tandas:[]},...before.slice(4)];
  const source=f=>read(f).replace(/\r\n/g,"\n"),old=f=>source123(f).replace(/\r\n/g,"\n");
  const notes=JSON.parse(source("src/data/release-notes.json"));
  assert.deepEqual(notes,expectedNotes,"la nota 124 literal delante, la 123 con su tanda, la 122 y la 120 sin las suyas y el resto del catálogo123 intacto");
  assert.deepEqual(notes.flatMap(n=>(n.tandas||[]).map(g=>[n.v,g.id,g.apk||0])),[["4.26.124",plan,0],["4.26.123",inicio,0]],"el panel enseña la tanda de Plan y la de Inicio, sin APK");
  for(const n of notes.slice(2))assert.deepEqual(n.tandas,[],n.v+": ni resucita /todo ni vuelve una tanda juzgada o entregada");
  for(const key of [plan,inicio])assert.equal(notes.flatMap(n=>n.tandas||[]).filter(g=>g.id===key).length,1,key+": una sola vez en todo el catálogo");
  assert.deepEqual(Object.keys(notes[0].tandas[0]),["id","t","items"],"identidad nueva, sin alias ni revisión heredada");
  for(const lang of ["es","en","ca"]){
    assert.equal(notes[0].items[lang].length,1,lang+": un punto familiar");
    const steps=notes[0].tandas[0].items[lang];assert.equal(steps.length,3,lang+": tres pasos");
    steps.forEach((step,i)=>assert.ok(step.startsWith((i+1)+". "),lang+": paso numerado "+(i+1)));
    for(const text of steps)assert.equal(/borra|quita este|delete|remove|esborra|treu aquest|mañana|tomorrow|demà/i.test(text),false,lang+": ningún paso borra nada ni espera a otro día");
  }
  // Cada rótulo que cita el guion es el texto real de la app, en su idioma.
  const literal={es:["«Deudas»","«Recibos»","«Metas»","«Ver más»"],en:["“Debts”","“Bills”","“Goals”","“See more”"],ca:["«Deutes»","«Rebuts»","«Metes»","«Veure més»"]};
  const enFuente={es:['plan_deudas:"Deudas"','plan_recibos:"Recibos"','plan_metas:"Metas"','v4_ver_mas:"Ver más · {n}"'],en:['plan_deudas:"Debts"','plan_recibos:"Bills"','plan_metas:"Goals"','v4_ver_mas:"See more · {n}"'],ca:['plan_deudas:"Deutes"','plan_recibos:"Rebuts"','plan_metas:"Metes"','v4_ver_mas:"Veure més · {n}"']};
  const textos=source("src/modules/01-i18n.js");
  for(const lang of ["es","en","ca"])literal[lang].forEach((rotulo,i)=>{
    assert.ok(notes[0].tandas[0].items[lang].join(" ").includes(rotulo),lang+": el guion cita "+rotulo);
    assert.ok(textos.includes(enFuente[lang][i]),lang+": "+rotulo+" es el texto de la app ("+enFuente[lang][i]+")");
  });
  const verifyNotes=list=>assert.deepEqual(list,expectedNotes);
  const twice=structuredClone(notes);twice[0].tandas.push(structuredClone(twice[0].tandas[0]));assert.throws(()=>verifyNotes(twice),"no duplicar la tanda");
  const inherited=structuredClone(notes);inherited[0].tandas[0].desde=["4.26.123/"+inicio];assert.throws(()=>verifyNotes(inherited),"no heredar un veredicto ajeno");
  const withApk=structuredClone(notes);withApk[0].tandas[0].apk=55;assert.throws(()=>verifyNotes(withApk),"no hay APK que probar");
  const sinInicio=structuredClone(notes);sinInicio[1].tandas=[];assert.throws(()=>verifyNotes(sinInicio),"la tanda de Inicio no tiene veredicto: no se retira");
  const text=structuredClone(notes);text[1].tandas[0].items.es[1]+="mutante";assert.throws(()=>verifyNotes(text),"el guion de la 123 no se toca");
  // Un único descriptor nuevo, al final y solo web; los demás, unidad a unidad, son los de la 123.
  const scopes=JSON.parse(source("scripts/beta-sources.json")),{[plan]:added,...rest}=scopes;
  assert.deepEqual(rest,integrated,"ningún descriptor retirado ni que crezca");
  assert.equal(integrated[plan],undefined,"identidad que no existía");assert.equal(Object.keys(scopes).at(-1),plan);
  assert.deepEqual(added,scope124,"el descriptor nuevo, literal");
  assert.deepEqual(Object.keys(added),["web","unidades"],"solo web: sin superficie de servidor ni nativa");
  for(const u of added.web)assert.ok(scopeText(u,source).length>0,"la unidad existe en la fuente: "+JSON.stringify(u));
  assert.deepEqual(added.web.filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>u.file),["src/modules/14-v4-screens.js","src/modules/11-app-main.js"],"lo que la entrega cambia dentro de su alcance: el gesto de Plan y el reparto de touch-action");
  assert.deepEqual(JSON.parse(source("scripts/beta-archives.json")),archiveRefs,"sin repinar el rechazo109");
  assert.equal(source("public/apk.json"),old("public/apk.json"),"sin APK nueva: apk.json no se toca");
  // Huellas que se mueven, lista cerrada.
  const expectedMoves={"inc-0810-nav-indicator":["web"]};
  const previous=new Map();
  const measure=reader=>{
    const now=JSON.parse(reader("scripts/beta-sources.json")),moved={};
    for(const [key,scope] of Object.entries(integrated)){
      if(key===archiveId){assert.deepEqual(auditedRevision(key,reader),auditedRevision(key,source123));continue;}
      if(!previous.has(key))previous.set(key,betaRevision(key,source123,undefined,scope));
      const a=previous.get(key),b=betaRevision(key,reader,undefined,now[key]);
      const surfaces=["web","native","edge"].filter(s=>a[s]!==b[s]);
      if(surfaces.length)moved[key]=surfaces;
    }
    return moved;
  };
  const verify=(reader,expected=expectedMoves)=>assert.deepEqual(measure(reader),expected,"lista cerrada: ni una huella extra ni una declarada que no cambie");
  verify(source);
  for(const surfaces of Object.values(expectedMoves))assert.deepEqual(surfaces,["web"],"ninguna huella de servidor ni nativa se mueve");
  const why={};
  for(const key of Object.keys(expectedMoves))why[key]=["web","edge"].flatMap(surface=>(integrated[key][surface]||[]).filter(u=>scopeText(u,old)!==scopeText(u,source)).map(u=>typeof u==="string"?u:(u.function||u.data||u.from)));
  // El tramo de la barra que vigila el indicador107 incluye `syncPageTouchAction`: de 11-app-main
  // solo cambia su comentario (Plan ya no pone `mc-touch-own`), y el tramo se huella con comentarios.
  assert.deepEqual(why,{"inc-0810-nav-indicator":["  const [navHidden,setNavHidden]"]},"qué unidad mueve cada huella");
  const sinComentarios=text=>codeMask(text).replace(/\s+/g," ");
  assert.equal(sinComentarios(source("src/modules/11-app-main.js")),sinComentarios(old("src/modules/11-app-main.js")),"en 11-app-main solo cambia un comentario");
  for(const key of Object.keys(expectedMoves))assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===key),false,key+": su huella cambia, pero no vuelve al panel");
  const shell="src/shell.html",from='animation:mclpop .5s cubic-bezier(.32,.72,0,1) backwards;}';
  assert.equal(source(shell).split(from).length,2,"mutante sobre el splash actual real");
  assert.throws(()=>verify(f=>f===shell?source(f).replace(from,from.replace(".5s",".6s")):source(f)),/lista cerrada/,"el splash no está declarado: no puede moverse por arrastre");
  assert.throws(()=>verify(source,{...expectedMoves,[recibo]:["web"]}),/lista cerrada/,"una huella declarada que no cambia pone rojo");
  // Cada pieza del gesto reabre la tanda de Plan, y solo por la web.
  const current=betaRevision(plan,source,undefined,scopes[plan]);
  assert.ok(current.web);assert.equal(current.native,undefined);assert.equal(current.edge,undefined);
  const v4="src/modules/14-v4-screens.js",main="src/modules/11-app-main.js";
  for(const [file,a,b] of [
    [v4,'else { mode="scroll"; }','else { mode="scroll"; pageEl.scrollTop=sy-tt.clientY; }'],
    [v4,'if(ddy>0 && startAtTop && atTopOf(pageEl)){ dir=1; mode="seg"; }','if(ddy>0){ dir=1; mode="seg"; }'],
    [v4,"const atTopOf=function(pg){ return !pg || (pg.scrollTop||0)<=2; };","const atTopOf=function(pg){ return !pg || (pg.scrollTop||0)<=20; };"],
    [main,'const own=(id==="inicio" && atTop);','const own=atTop;'],
    [shell,"-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:6px 18px","-webkit-overflow-scrolling:touch;touch-action:none;padding:6px 18px"]]){
    assert.equal(source(file).split(a).length,2,"mutante sobre fuente real: "+a);
    assert.notEqual(betaRevision(plan,f=>f===file?source(f).replace(a,b):source(f),undefined,scopes[plan]).web,current.web,"reabre la tanda: "+a);
  }
  // Lo que el build entrega al panel.
  const built=betaNotes(notes,source,scopes),receipt=betaDelivery(built,source,scopes),group=built[0].tandas[0];
  assert.deepEqual(built.flatMap(n=>(n.tandas||[]).map(g=>g.id)),[plan,inicio],"lo que el build entrega al panel");
  assert.equal(group.web,current.web);assert.equal(group.native,undefined);assert.equal(group.edge,undefined);assert.equal(group.apk,undefined);
  assert.equal(receipt.web[plan],current.web);
  const original=betaDelivery(betaNotes(before,source123,integrated),source123,integrated);
  assert.equal(receipt.web[inicio],original.web[inicio],"la tanda de Inicio sigue siendo, huella a huella, la que está en revisión");
  assert.deepEqual(receipt.pruebas,{
    [plan]:{v:"4.26.124",contenido:JSON.stringify([plan,expected124.tandas[0].t.es,expected124.tandas[0].items.es,1])},
    [inicio]:original.pruebas[inicio]},"dos guiones por probar: el de Plan con la 124 y el de Inicio tal cual");
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica","native","edge"])assert.equal(group[key],undefined,"identidad nueva sin "+key);
});
test("Retiro124 elimina solo las tres tandas aprobadas en la 4.26.122.1 y conserva notas, descriptores y huellas",()=>{
  const ids=["recibo-cargo-en-gastos","tr-iguales-ordinal","bancos-acuse-reconexion"],inicio="inicio-patrimonio-flujos";
  const before=JSON.parse(source123("src/data/release-notes.json")),notes=JSON.parse(read("src/data/release-notes.json"));
  for(const id of ids){
    assert.equal(before.flatMap(n=>n.tandas||[]).filter(g=>g.id===id).length,1,id+": la 123 publicada la llevaba");
    assert.equal(notes.flatMap(n=>n.tandas||[]).some(g=>g.id===id),false,id+": ya no está en ninguna nota");
  }
  assert.equal(notes.length,before.length+1,"ninguna nota se borra");
  // Las notas 122 y 120 conservan versión, fecha, título y textos; solo pierden sus tandas, con
  // `tandas:[]` (sin la propiedad resucitarían como /todo). La de Inicio no tiene veredicto: se queda.
  assert.deepEqual(notes[1],before[0],"la nota 123 y su tanda de Inicio, intactas");
  assert.deepEqual(notes[1].tandas.map(g=>g.id),[inicio]);
  assert.deepEqual(notes[2],{...before[1],tandas:[]});assert.deepEqual(notes[4],{...before[3],tandas:[]});
  assert.deepEqual(notes[3],before[2]);assert.deepEqual(notes.slice(5),before.slice(4),"el resto del catálogo, intacto");
  const resurrected=structuredClone(notes);resurrected[2].tandas.unshift(before[1].tandas[0]);
  assert.notDeepEqual(resurrected,notes,"no resucitar una tanda aprobada");
  const scopes=JSON.parse(read("scripts/beta-sources.json")),old=JSON.parse(source123("scripts/beta-sources.json")),approved=JSON.parse(source122("scripts/beta-sources.json"));
  const receipt=betaDelivery(betaNotes(notes,read,scopes),read,scopes);
  for(const id of ids){
    assert.deepEqual(scopes[id],old[id],id+": el descriptor queda como historia");
    const now=betaRevision(id,read,undefined,scopes[id]);
    assert.deepEqual(now,betaRevision(id,source123,undefined,old[id]),id+": la huella es la del producto que sigue en la 124");
    assert.deepEqual(now,betaRevision(id,source122,undefined,approved[id]),id+": y es la que se aprobó sobre la 122, sin revisión nueva que juzgar");
    assert.equal(receipt.web[id],now.web,id+": el producto sigue íntegro");assert.equal(receipt.pruebas[id],undefined,id+": el guion aprobado no permanece en el panel");
  }
});

test("Inicio v4.2 conserva el catálogo120 y los retiros anteriores en la fuente actual",()=>{
  // Desde la124 la nota del scroll lento de Plan va delante con su tanda; la 123 sigue literal con la de Inicio, y la 122, la 121 y la 120 se quedan sin tanda (las tres suyas, aprobadas).
  const n120=JSON.parse(source120("src/data/release-notes.json"));
  const source=f=>read(f).replace(/\r\n/g,"\n"),expected=[expected124,expected123,{...expected122,tandas:[]},{...expected121,tandas:[]},{...n120[0],tandas:[]},...n120.slice(1)];
  const verify=notes=>assert.deepEqual(notes,expected,"catálogo vigente exacto, sin resucitar lo aprobado ni heredar identidad");
  const notes=JSON.parse(source("src/data/release-notes.json"));verify(notes);
  const resurrected=structuredClone(notes);resurrected[5].tandas.push(JSON.parse(source118("src/data/release-notes.json"))[0].tandas[0]);
  assert.throws(()=>verify(resurrected),assert.AssertionError);
  for(const lang of ["es","en","ca"])for(const n of [0,1]){const changed=structuredClone(notes);changed[n].tandas[0].items[lang][0]+=" mutante";assert.throws(()=>verify(changed),assert.AssertionError);}
  const scopes=JSON.parse(source("scripts/beta-sources.json")),prior=JSON.parse(source120("scripts/beta-sources.json"));
  for(const id of ["tr-iguales-ordinal","bancos-acuse-reconexion","recibos-cargo-unico"]){
    for(const part of prior[id].web)assert.ok(scopes[id].web.some(p=>JSON.stringify(sinMetodo122(p))===JSON.stringify(part)),id+": ninguna unidad120 retirada");
    assert.deepEqual(scopes[id].native,prior[id].native);assert.deepEqual(scopes[id].edge,prior[id].edge);
  }
  const receipt=betaDelivery(betaNotes(notes,source,scopes),source,scopes);
  assert.equal(receipt.pruebas["recibos-cargo-unico"],undefined,"el cargo único aprobado sigue fuera del panel");
  assert.equal(receipt.pruebas["inicio-grafica-vuelve"],undefined,"Inicio nuevo no resucita la unidad aprobada");
  assert.equal(receipt.pruebas["inicio-patrimonio-flujos"].v,"4.26.123","la tanda de Inicio vuelve al panel con la nota 123");
  assert.equal(receipt.pruebas["plan-scroll-lento"].v,"4.26.124","la tanda de Plan entra en el panel con la nota 124");
  for(const id of ["tr-iguales-ordinal","bancos-acuse-reconexion","recibo-cargo-en-gastos"]){
    assert.equal(receipt.web[id],betaRevision(id,source,undefined,scopes[id]).web);
    assert.equal(receipt.pruebas[id],undefined,id+": aprobada, fuera del panel");
  }
});

if(inicioOnly)process.exit(failed?1:0);
if(process.argv.includes("--integration-only")) process.exit(failed?1:0);

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
  assert.equal(dependientes.length,30);
  assert.ok(dependientes.includes("recibo-cargo-en-gastos"),"«No es este recibo», su vuelta atrás y el histórico escriben la marca con el set real");
  assert.ok(dependientes.includes("tr-iguales-ordinal"),"el sync, el borrado a mano y el histórico guardan vínculos y filas con el set real");
  assert.ok(dependientes.includes("inicio-patrimonio-flujos"),"las fotos de bienes e inversión de la unidad nueva escriben con el set real");
  assert.ok(dependientes.includes("bancos-acuse-reconexion"),"el acuse se guarda detrás de las filas que escribe el set real");
  assert.ok(dependientes.includes("recibos-cargo-unico"),"mover el día de un recibo o vincular su cargo escribe con el set real");
  assert.ok(dependientes.includes("widget-ciclo-puente"),"el widget corregido lee gastos con el set real");
  assert.ok(dependientes.includes("bancos-sin-hueco"),"el sync de bancos escribe estado con el set real");
  assert.ok(dependientes.includes("widget-pago-app-cerrada"),"la lectura que acredita el widget mezcla gastos con el set real");
  assert.ok(dependientes.includes("inc-0810-metas-editar-regla"),"editar una regla escribe con el set real y conserva el cierre de persistencia");
  assert.ok(dependientes.includes("inc-0710-gastos-mes-madrid"),"Gastos99 conserva la dependencia real de guardado de Expenses");
  assert.deepEqual(ajenas.slice().sort(),["beta-panel-veredictos","inc-0210-01-plan-cuota","inc-0410-inicio-tres-metas","inc-0710-appstate-listener-cleanup","inc-0710-banknotif-cleanup","inc-0810-backclose-handover","inc-0810-dashboard-recents-memo","inc-0810-inicio-grafica-significado","inc-0810-nav-indicator","inc-2709-01-arranque-red","inc-2709-09-fechas-cache","inc-2709-12-cyber-fab","inc-2709-13-fab-contorno","inc-2709-14-preguntar","inicio-grafica-vuelve","inicio-solape-gastos","ops-0410-panel-cola","plan-scroll-lento","splash-animado","tr-descripcion-clasificacion"]);
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
  const escribe=id=>registro[id].web.some(x=>!delGuardado(x)&&/(^|[^\w.$])set\((?![\w\s,]*\)\s*\{)/.test(scopeText(x,auditedScope(id,source).read)));
  for(const id of Object.keys(registro)) assert.equal(escribe(id),dependientes.includes(id),
    id+(dependientes.includes(id)?" lleva el bloque del guardado sin llamar a set()":" llama a set() y debería depender del guardado"));
  for(const id of dependientes) for(const fn of ["mcPersistCommit","mcSaveRaw"])
    assert.ok(registro[id].web.some(x=>x.function===fn&&x.file==="src/modules/00-core.js"),id+" sin "+fn);
  const antes=Object.fromEntries(Object.keys(registro).map(id=>[id,auditedRevision(id,source).web]));
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
    for(const id of ajenas) assert.equal(auditedRevision(id,leer).web,antes[id],id+" se mueve con: "+from);
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
    const ctx=auditedScope(id,read),source=ctx.read,currentFunctions=ctx.archived?logicFunctions(source):functions;
    const before=betaRevision(id,source,undefined,ctx.scope);
    for(const fn of scopeDependencies(ctx.scope,source,currentFunctions)){
      total++;
      const changed=betaRevision(id,f=>f===fn.file?mutateLogic(source(f),fn):source(f),undefined,ctx.scope);
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
    const ctx=auditedScope(id,read),source=ctx.read,currentFunctions=ctx.archived?logicFunctions(source):functions,currentData=ctx.archived?logicData(source):data;
    const before=betaRevision(id,source,undefined,ctx.scope);
    for(const value of scopeDataDependencies(ctx.scope,source,currentFunctions,currentData)){
      total++;let changed;try{changed=betaRevision(id,f=>f===value.file?mutateData(source(f),value):source(f),undefined,ctx.scope);}catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code),error.message);changed={web:"build abortado por ancla mutada"};}
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
    ["08-motor-bank.js",'if(status && status!=="BOOK") return null;','if(false) return null;'],
    ["08-motor-bank.js",'date>todayKey','false'],
    ["08-motor-bank.js",'timeZone:"Europe/Madrid"','timeZone:"UTC"'],
    ["08-motor-bank.js",'if(tx.id) e.extId=tx.id;','if(false) e.extId=tx.id;'],
    ["08-motor-bank.js",'function applyBankBalances(s, links){','function applyBankBalances(s, links){ /* cambio saldo */'],
    ["04-tab-gastos.js",'function lastPaydayOf(','function lastPaydayOf( /* cambio ancla */'],
    ["01-i18n.js",'function insumosSaldoGasto(','function insumosSaldoGasto( /* cambio saldo */'],
    ["11-app-main.js",'const add=importObExpenses(prev, txs, links);','const add=null;'],
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
    const ctx=auditedScope(id,read),source=ctx.read;
    const cloud=ctx.scope.web.find(s=>s.data==="cloud"&&s.members);if(!cloud)continue;
    const texts=ctx.scope.web.filter(s=>s!==cloud).map(s=>scopeText(s,source)).concat(scopeDependencies(ctx.scope,source).map(fn=>fn.text));
    const used=new Set(texts.flatMap(text=>[...codeMask(text).matchAll(/\bcloud\.([\w$]+)/g)].map(m=>m[1])));
    for(const name of used)assert.ok(cloud.members.includes(name),id+": método no vigilado "+name);
    for(const name of cloud.members){
      const from=new RegExp("(\\b(?:async\\s+)?"+name+"\\([^)]*\\)\\s*\\{)");
      const changed=betaRevision(id,f=>f===cloud.file?source(f).replace(from,'$1 throw new Error("método mutado"); '):source(f),undefined,ctx.scope);
      assert.notEqual(changed.web,betaRevision(id,source,undefined,ctx.scope).web,id+": "+name);
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

test("archivo109 conserva descriptor, guion y B90 contra f4ff, nunca entrega vigente",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),ref=archiveRefs.refs[archiveId];
  const reference=betaArchived(ref.guion,scopes[archiveId],archiveRefs,archiveHistory);
  assert.equal(reference.codigo,ref.codigo);assert.equal(reference.web,ref.revisiones.web);
  assert.deepEqual(reference.referenciaHistorica,{sha:ref.sha,version:ref.version,codigo:ref.codigo,web:ref.revisiones.web,estado:"ausente"});
  const notes=[{v:ref.version,tandas:[ref.guion]}];
  const forbidden=f=>{if(["src/modules/03-tab-dash.js","src/modules/02-ui-shared.js","src/modules/01-i18n.js"].includes(f))throw new Error("HEAD retirado no debe leerse");return read(f);};
  assert.equal(betaNotes(notes,forbidden,scopes,archiveRefs,archiveHistory)[0].tandas[0].codigo,ref.codigo);
  const built=betaNotes(JSON.parse(read("src/data/release-notes.json")),read,scopes,archiveRefs,archiveHistory);
  const receipt=betaDelivery(built,read,scopes,archiveRefs,archiveHistory);
  assert.equal(Object.hasOwn(receipt.web,archiveId),false);assert.equal(Object.hasOwn(receipt.pruebas,archiveId),false);
  assert.equal(receipt.referenciasHistoricas[archiveId].estado,"ausente");
  assert.equal(receipt.web["inicio-grafica-vuelve"],betaRevision("inicio-grafica-vuelve").web);
});
test("archivo109 aborta ante SHA ausente, pin/code forjado y descriptor o guion cambiado",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),ref=archiveRefs.refs[archiveId];
  const check=(a=archiveRefs,s=scopes[archiveId],g=ref.guion,h=archiveHistory)=>betaArchived(g,s,a,h);
  assert.throws(()=>check(archiveRefs,scopes[archiveId],ref.guion,()=>{throw new Error("SHA_HISTORICO_AUSENTE");}),/SHA_HISTORICO_AUSENTE/);
  for(const [key,value] of [["sha","0".repeat(40)],["codigo","0".repeat(64)],["version","9.9.9"]]){
    const changed=structuredClone(archiveRefs);changed.refs[archiveId][key]=value;
    assert.throws(()=>check(changed),/Pin histórico109 inválido/,key);
  }
  const digest=structuredClone(archiveRefs);digest.refs[archiveId].revisiones.web="0".repeat(64);
  assert.throws(()=>check(digest),/Pin histórico109 inválido/);
  assert.throws(()=>check(archiveRefs,scopes[archiveId],{...ref.guion,codigo:"0".repeat(64)}),/Código histórico109 forjado/);
  const descriptor=structuredClone(scopes[archiveId]);descriptor.web[1].function="NetWorthNow";
  assert.throws(()=>check(archiveRefs,descriptor),/Descriptor o guion histórico109 cambiado/);
  const changedBoth=structuredClone(archiveRefs);changedBoth.refs[archiveId].descriptor=descriptor;
  assert.throws(()=>check(changedBoth,descriptor),/no coincide con Git/);
  const changedGuion=structuredClone(ref.guion);changedGuion.items.en[0]+=" changed";
  assert.throws(()=>check(archiveRefs,scopes[archiveId],changedGuion),/Descriptor o guion histórico109 cambiado/);
  const oldText=archiveHistory(ref.sha,"src/modules/02-ui-shared.js"),marker="function Sparkline(";
  assert.ok(oldText.includes(marker));
  assert.throws(()=>check(archiveRefs,scopes[archiveId],ref.guion,(sha,f)=>f==="src/modules/02-ui-shared.js"?oldText.replace(marker,"function SparklineMutada("):archiveHistory(sha,f)),/Bloque beta/);
  const foreign=structuredClone(archiveRefs);foreign.refs["otra-unidad"]=foreign.refs[archiveId];
  assert.throws(()=>check(foreign),/Archivo beta no autorizado/);
  assert.throws(()=>betaNotes([{v:"9.9.9",tandas:[ref.guion]}],read,scopes,archiveRefs,archiveHistory),/presentada como activa/);
});
test("la unidad actual no admite alias ni compatibilidad heredada de109",()=>{
  const id="inc-0910-inicio-solo-actual",g={id,t:{es:"Caso sintético"},items:{es:["1. Comprobar total actual"]}};
  for(const key of ["desde","codigoDesde","revisionesDesde","huella","historial","codigosCompatibles","compatibilidadGit","compatibilidadSha","referenciaAnterior","referenciaHistorica"])
    assert.throws(()=>betaNotes([{v:"9.9.9",tandas:[{...g,[key]:[]}]}]),/no hereda identidad ni aprobación/,key);
  const scope=JSON.parse(source112("scripts/beta-sources.json"))[id];
  assert.deepEqual(betaCompatible(g,betaRevision(id,source112,undefined,scope),scope),{});
});

test("los dos consumidores del archivo cambian identidad y no heredan compatibilidad vieja",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json"));
  for(const id of ["beta-panel-veredictos","ops-0410-panel-cola"]){
    assert.ok(scopes[id].web.includes("scripts/beta-archives.json"));
    const current=betaRevision(id,read);
    assert.deepEqual(betaCompatible({id,t:{es:"Caso sintético"},items:{es:["1. Archivo"]}},current,scopes[id]),{});
    const changed=betaRevision(id,f=>f==="scripts/beta-archives.json"?read(f).replace('"schema": 1','"schema": 2'):read(f));
    assert.notEqual(changed.web,current.web,id+": metadata de archivo vigilada");
  }
});

test("la referencia histórica visible vigila el texto completo en los tres idiomas",()=>{
  const source=f=>read(f).replace(/\r\n/g,"\n");
  for(const lang of ["es","en","ca"]){
    const marker="    // Archivo109 "+lang+": una función retirada no acredita entrega vigente.";
    const text=source("src/modules/01-i18n.js"),start=text.indexOf(marker),end=text.indexOf("    // Archivo109 "+lang+": fin de la referencia.",start);
    assert.ok(start>=0&&end>start);
    const block=text.slice(start,end),mutant=block.replace('beta_historical_absent:"','beta_historical_absent:"Texto mutado · ');
    assert.notEqual(block,mutant);
    const changed=f=>f==="src/modules/01-i18n.js"?text.replace(block,mutant):source(f);
    for(const id of ["beta-panel-veredictos","ops-0410-panel-cola"])
      assert.notEqual(betaRevision(id,changed).web,betaRevision(id,source).web,id+": "+lang);
    assert.equal(betaRevision("inicio-grafica-vuelve",changed).web,betaRevision("inicio-grafica-vuelve",source).web,"no repina la propuesta de patrimonio actual");
  }
});

test("Recientes106 reanclada conserva expresión, identidad y recibo completos",()=>{
  const id="inc-0810-dashboard-recents-memo",file="src/modules/03-tab-dash.js";
  const actual=JSON.parse(read("scripts/beta-sources.json"))[id];
  const anchor={file,from:"  const recent=useMemo",to:",[state.expenses,state.deleted]);",includeTo:true};
  assert.deepEqual(actual.web[0],anchor);
  const currentText=scopeText(anchor,read),current=betaRevision(id,read);
  // Desde la120 `keyOfExpense` lleva el ordinal de los apuntes iguales, y Recientes lee las lápidas
  // por esa clave: es dependencia real y mueve su huella (declarado en Catálogo120, que fija las
  // dos unidades que el descriptor gana). La igualdad con los commits históricos se sigue
  // comprobando, pero contra la beta119 (788432f4), la última con la clave de entonces.
  const actual119=JSON.parse(source119("scripts/beta-sources.json"))[id],current119=betaRevision(id,source119,undefined,actual119);
  assert.deepEqual(actual.web.slice(0,actual119.web.length),actual119.web,"el descriptor119 sigue entero y en su orden");
  assert.deepEqual(actual.web.slice(actual119.web.length,actual119.web.length+2).map(u=>[u.file,u.function]),[["src/modules/00-core.js","obOrdinalSufijo"],["src/modules/00-core.js","obOrdinalOf"]],"en la120 sólo gana la regla del ordinal");
  // Desde la122 la fila de Recientes dice de qué recibo es el cargo (`reciboEtiqueta`): el descriptor
  // gana detrás esa función y lo que lee, que Catálogo122 fija unidad a unidad. La expresión del
  // memo, que es lo que esta prueba ancla, sigue igual.
  const actual121=JSON.parse(source121("scripts/beta-sources.json"))[id];
  assert.deepEqual(actual121.web,actual.web.slice(0,actual119.web.length+2),"el descriptor de la121 era el de la119 más el ordinal");
  assert.ok(actual.web.slice(actual121.web.length).some(u=>u.function==="reciboEtiqueta"),"en la122 gana la etiqueta de recibo y sus dependencias");
  assert.equal(currentText,scopeText(anchor,source119),"la expresión de Recientes no cambia en la120 ni en la122");
  assert.notEqual(current.web,current119.web,"la clave con ordinal mueve la identidad: no se conserva la de la119");
  const cache=new Map(),at=(sha,f)=>{const k=sha+":"+f;if(!cache.has(k))cache.set(k,execFileSync("git",["show",k],{encoding:"utf8",maxBuffer:10e6}));return cache.get(k);};
  for(const sha of ["23a7808f65ef6d28e8a906f7100ffdf229917abb","f4ffb9340adfd0a13b631271e8158d2c630613c0","b1ad23f34f2a94933e57246dfdf12c451f5360a1"]){
    const before=JSON.parse(at(sha,"scripts/beta-sources.json"))[id],source=f=>at(sha,f);
    assert.ok(before,"el baseline debe contener la unidad106 real");
    assert.deepEqual({...actual,web:before.web},before,"ningún descriptor ajeno ni metadata106 cambia");
    assert.deepEqual(actual119.web.slice(1),before.web.slice(1),"todas las dependencias reales siguen presentes");
    assert.equal(currentText,scopeText(before.web[0],source),"reanclaje no recorta ni amplía el contenido");
    assert.equal(scopeText(anchor,source),scopeText(before.web[0],source),"el cierre también funciona en lectores históricos");
    assert.equal(current119.web,betaRevision(id,source,undefined,before).web,"identidad recalculada, sin copiar huella anterior");
    assert.equal(current119.web,betaRevision(id,source,undefined,actual119).web,"no absorbe constp del renderer histórico");
  }
  for(const [from,to] of [
    ["recent=useMemo","recent=useState"],
    ["[state.expenses,state.deleted]","[state.expenses]"],
    ["!expenseIsTombstoned(e,expenseDeletedSet(s))","expenseIsTombstoned(e,expenseDeletedSet(s))"],
    ["expenseDeletedSet(s)","expenseDeletedSet({})"],
    [".slice(0,3)",".slice(0,2)"]
  ]){
    assert.ok(currentText.includes(from),"mutante debe tocar la expresión real");
    const changed=f=>f===file?read(f).replace(currentText,currentText.replace(from,to)):read(f);
    let after;
    try{after=betaRevision(id,changed);}
    catch(error){assert.equal(error.code,"BETA_SCOPE_ABSENT","un cambio de ancla falla cerrado");continue;}
    assert.notEqual(after.web,current.web,"hook/deps/tombstones/selección siguen vigilados");
  }
  const notes=betaNotes(JSON.parse(read("src/data/release-notes.json")));
  const receipt=betaDelivery(notes,read);
  assert.equal(receipt.web[id],current.web,"106 no desaparece silenciosamente del recibo");
  const old=f=>at("23a7808f65ef6d28e8a906f7100ffdf229917abb",f);
  assert.equal(logicFunctions(read,["src/modules/01-i18n.js"]).get("seedFlows").text,logicFunctions(old,["src/modules/01-i18n.js"]).get("seedFlows").text,"seedFlows entero conserva los bytes111, incluido el incidente fechado");
  // Wealth pertenece al alcance de Nómina: el editor de Bienes113 cambia esa dependencia
  // real. Recortarla para conservar el OK111 ocultaría producto modificado (10/10).
  // Wealth113 se compara con su alcance de entonces: los helpers de Recibos añadidos
  // después no existen en111. Los mutantes de Recientes de arriba siguen sobre read vivo.
  const scope113=JSON.parse(source113("scripts/beta-sources.json"))["inc-3009-nomina-anticipada"];
  assert.notEqual(betaRevision("inc-3009-nomina-anticipada",source113,undefined,scope113).web,betaRevision("inc-3009-nomina-anticipada",old,undefined,scope113).web,"Bienes113 cambia Wealth compartida con Nómina; no conservar la identidad111");
});

process.exitCode=failed?1:0;
