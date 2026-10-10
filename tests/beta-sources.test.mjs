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
function test(name,fn){ try{fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+"\n    "+e.message);} }
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
test("Inicio solo actual cubre renderer, llamada, animación, textos, CSS y moneda vigentes",()=>{
  const id="inc-0910-inicio-solo-actual",source=f=>read(f).replace(/\r\n/g,"\n"),scopes=JSON.parse(source("scripts/beta-sources.json")),scope=scopes[id],before=betaRevision(id,source);
  assert.equal(scope.unidades,true);
  for(const key of ["historial","auditoria","codigosCompatibles","compatibilidadGit","compatibilidadSha"])
    assert.equal(scope[key],undefined,"no hereda identidad anterior: "+key);
  assert.notEqual(before.codigo,"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0");
  for(const [file,from,to] of [
    ["src/modules/03-tab-dash.js",'const valid=typeof value==="number" && Number.isFinite(value);','const valid=true;'],
    ["src/modules/03-tab-dash.js",'p?p.sign+p.ent:"—"','p?p.sign+p.ent:"0"'],
    ["src/modules/03-tab-dash.js",'value:tt.netWorth, shown:shownNet','value:0, shown:shownNet'],
    ["src/modules/03-tab-dash.js",'const tt=totals;','const tt={netWorth:0};'],
    ["src/modules/03-tab-dash.js",'useCountUp(tt.netWorth||0, splashGone)','useCountUp(tt.netWorth||0, true)'],
    ["src/modules/03-tab-dash.js",'!!(window.__mcSplashGone)','false'],
    ["src/modules/02-ui-shared.js",'const t0=performance.now(), dur=950;','const t0=performance.now(), dur=1;'],
    ["src/modules/02-ui-shared.js",'if(mcReduced()){','if(false){'],
    ["src/modules/02-ui-shared.js",'document.documentElement.classList.contains("reduce-motion")','false'],
    ["src/modules/01-i18n.js",'Math.abs((n||0)*DISP.k)','Math.abs(n||0)'],
    ["src/modules/01-i18n.js",'sign:n<0?"-":""','sign:""'],
    ["src/modules/01-i18n.js",'v4_net_now:"Ahora"','v4_net_now:"Antes"'],
    ["src/modules/01-i18n.js",'v4_net_now:"Now"','v4_net_now:"Before"'],
    ["src/modules/01-i18n.js",'v4_net_now:"Ara"','v4_net_now:"Abans"'],
    ["src/modules/01-i18n.js",'v4_net_unknown:"El total actual no está disponible."','v4_net_unknown:"0"'],
    ["src/modules/01-i18n.js",'v4_net_unknown:"The current total is unavailable."','v4_net_unknown:"0"'],
    ["src/modules/01-i18n.js",'v4_net_unknown:"El total actual no està disponible."','v4_net_unknown:"0"'],
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
    ["src/shell.html",'.v4-net-current-head{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;}','.v4-net-current-head{display:flex;flex-wrap:nowrap;}'],
    ["src/shell.html",'.v4-net-now{font-size:12.5px;font-weight:700;color:var(--mint);}','.v4-net-now{display:none;}'],
    ["src/shell.html",'.v4-hero{text-align:center;padding:22px 0 8px;}','.v4-hero{display:none;}'],
    ["src/shell.html",'.v4-hero-amt{display:inline-block;','.v4-hero-amt{display:none;'],
    ["src/shell.html",'.v4-micro{font-size:12.5px;','.v4-micro{font-size:1px;'],
  ]){
    assert.ok(source(file).includes(from),"mutante sobre la fuente actual real: "+from);
    const changed=f=>f===file?source(f).replace(from,to):source(f);
    // Cambiar el propio literal delimitador debe abortar; el resto sí exige otro digest.
    const anchorMutants=[
      'const tt=totals;','useCountUp(tt.netWorth||0, splashGone)',
      'v4_money_total:"Tu dinero en total"','v4_money_total:"All your money"','v4_money_total:"Els teus diners en total"',
      'd_networth:"Patrimonio neto"','d_networth:"Net worth"','d_networth:"Patrimoni net"',
      'CURLANG = (state.settings&&state.settings.lang) || "es"'
    ];
    if(anchorMutants.includes(from)){
      assert.ok(scope.web.some(s=>s.file===file&&typeof s.from==="string"&&source(file).includes(s.from)&&!changed(file).includes(s.from)),"el caso literal debe alterar un delimitador real");
      assert.throws(()=>betaRevision(id,changed),{code:"BETA_SCOPE_ABSENT"},from+": delimitador cambiado falla cerrado");
    }else assert.notEqual(betaRevision(id,changed).web,before.web,from);
  }
  const functions=logicFunctions(source,["src/modules/00-core.js","src/modules/01-i18n.js","src/modules/02-ui-shared.js","src/modules/03-tab-dash.js"]);
  for(const name of ["NetWorthNow","useCountUp","mcReduced","eurParts","fxRateOf","fxTableOf"]){
    const fn=functions.get(name);assert.ok(fn,name+": función real localizada");
    assert.notEqual(betaRevision(id,f=>f===fn.file?mutateLogic(source(f),fn):source(f)).web,before.web,name);
  }
  const data=logicData(source);
  for(const name of ["NF","DISP","CUR_SYM","CURLANG","SIMPLEMODE"]){
    const value=data.get(name);assert.ok(value,name+": dato real localizado");
    assert.notEqual(betaRevision(id,f=>f===value.file?mutateData(source(f),value):source(f)).web,before.web,name);
  }
  const other='pt_trb_hint:"';
  assert.equal(betaRevision(id,f=>f==="src/modules/01-i18n.js"?source(f).replace(other,other+"· "):source(f)).web,before.web,"no absorbe ayuda financiera ajena");
});

test("la candidata actual no cambia las otras unidades ni repina el rechazo109",()=>{
  const cache=new Map(),base=f=>{if(!cache.has(f))cache.set(f,execFileSync("git",["show","23a7808f65ef6d28e8a906f7100ffdf229917abb:"+f],{encoding:"utf8",maxBuffer:10e6}));return cache.get(f);};
  const before=JSON.parse(base("scripts/beta-sources.json")),actual=JSON.parse(read("scripts/beta-sources.json")),old="inc-0810-inicio-grafica-significado",current="inc-0910-inicio-solo-actual";
  assert.deepEqual(Object.keys(actual).filter(id=>!before[id]),[current]);
  for(const [id,scope] of Object.entries(before)){
    const expected=structuredClone(scope);
    if(id==="inc-0810-dashboard-recents-memo"){
      expected.web[0]={file:"src/modules/03-tab-dash.js",from:"  const recent=useMemo",to:",[state.expenses,state.deleted]);",includeTo:true};
      assert.equal(scopeText(scope.web[0],base),scopeText(expected.web[0],read),"106 reanclada cubre exactamente la expresión completa anterior");
    }
    if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(id))
      expected.web.splice(expected.web.indexOf("scripts/beta-source-code.mjs")+1,0,"scripts/beta-archives.json",...[{"file":"src/modules/01-i18n.js","from":"    // Archivo109 es: una función retirada no acredita entrega vigente.","to":"    // Archivo109 es: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 en: una función retirada no acredita entrega vigente.","to":"    // Archivo109 en: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 ca: una función retirada no acredita entrega vigente.","to":"    // Archivo109 ca: fin de la referencia."}],...[{"file":"src/modules/10-app-components.js","function":"betaHistoricalDetails"},"scripts/listo-para-produccion.mjs"]);
    assert.deepEqual(actual[id],expected,id+": sólo los dos consumidores cubren el archivo explícito");
    if(id===old){
      assert.equal(betaRevision(id,base,undefined,scope).codigo,"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0");
      assert.notEqual(betaRevision(current,read).web,betaRevision(id,base,undefined,scope).web,"el renderer nuevo no hereda el digest del dibujo antiguo");
    }else if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(id)){
      assert.notEqual(betaRevision(id,read,undefined,actual[id]).web,betaRevision(id,base,undefined,scope).web,id+": archivo109 cambia la maquinaria cubierta y requiere revisión propia");
    }else assert.equal(betaRevision(id,read,undefined,actual[id]).web,betaRevision(id,base,undefined,scope).web,id+": identidad ajena conservada");
  }
  const notes=JSON.parse(read("src/data/release-notes.json")),oldNotes=JSON.parse(base("src/data/release-notes.json"));
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
  for(const id of ids)assert.equal(betaRevision(id,read).web,betaRevision(id,published).web,id+": código idéntico al entregado");
  const before=JSON.parse(at("b1f871750469a5439ada6cea2284fc0ff407cd46","src/data/release-notes.json"));
  const expected=before.map(n=>Array.isArray(n.tandas)?{...n,tandas:n.tandas.filter(g=>!ids.includes(g.id))}:n);
  const actual=JSON.parse(at("f4ffb9340adfd0a13b631271e8158d2c630613c0","src/data/release-notes.json"));assert.deepEqual(actual,expected,"sólo se retiran esas cinco en109, sin borrar notas, pendientes ni rechazos");
  assert.equal(actual.length,226);assert.ok(!actual.some(n=>(n.tandas||[]).some(g=>ids.includes(g.id))));
});

test("BackClose110 y Bienes111 siguen LIVE con sólo las dependencias de Inicio112",()=>{
  const cache=new Map(),base=f=>{if(!cache.has(f))cache.set(f,execFileSync("git",["show","f4ffb9340adfd0a13b631271e8158d2c630613c0:"+f],{encoding:"utf8",maxBuffer:10e6}));return cache.get(f);};
  const before=JSON.parse(base("scripts/beta-sources.json")),actual=JSON.parse(read("scripts/beta-sources.json")),id="inc-0810-backclose-handover";
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
      assert.equal(scopeText(scope.web[0],base),scopeText(expected.web[0],read),"106 reanclada cubre exactamente la expresión completa histórica");
    }
    if(["beta-panel-veredictos","ops-0410-panel-cola"].includes(key))
      expected.web.splice(expected.web.indexOf("scripts/beta-source-code.mjs")+1,0,"scripts/beta-archives.json",...[{"file":"src/modules/01-i18n.js","from":"    // Archivo109 es: una función retirada no acredita entrega vigente.","to":"    // Archivo109 es: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 en: una función retirada no acredita entrega vigente.","to":"    // Archivo109 en: fin de la referencia."},{"file":"src/modules/01-i18n.js","from":"    // Archivo109 ca: una función retirada no acredita entrega vigente.","to":"    // Archivo109 ca: fin de la referencia."}],...[{"file":"src/modules/10-app-components.js","function":"betaHistoricalDetails"},"scripts/listo-para-produccion.mjs"]);
    assert.deepEqual(actual[key],expected,key+": sólo los dos consumidores cubren el archivo explícito");
    }
    const source=key===archiveId?base:read;
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
    assert.equal(JSON.parse(read("package.json")).version,"4.26.112");
    assert.match(first.d,/^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(first,{v:"4.26.112",d:first.d,...newCopy},"sólo la unidad112 con copia propia es/en/ca, sin alias");
    assert.deepEqual(notes.slice(1),expected,"111 literal y227notas completas, sin cambios a guiones/textos/metadata");
  };
  const actual=JSON.parse(read("src/data/release-notes.json"));verify(actual);
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
  assert.equal(dependientes.length,22);
  assert.ok(dependientes.includes("inc-0810-metas-editar-regla"),"editar una regla escribe con el set real y conserva el cierre de persistencia");
  assert.ok(dependientes.includes("inc-0710-gastos-mes-madrid"),"Gastos99 conserva la dependencia real de guardado de Expenses");
  assert.deepEqual(ajenas.slice().sort(),["beta-panel-veredictos","inc-0210-01-plan-cuota","inc-0410-inicio-tres-metas","inc-0710-appstate-listener-cleanup","inc-0710-banknotif-cleanup","inc-0810-backclose-handover","inc-0810-dashboard-recents-memo","inc-0810-inicio-grafica-significado","inc-0810-nav-indicator","inc-0910-inicio-solo-actual","inc-2709-01-arranque-red","inc-2709-09-fechas-cache","inc-2709-12-cyber-fab","inc-2709-13-fab-contorno","inc-2709-14-preguntar","ops-0410-panel-cola","tr-descripcion-clasificacion"]);
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
  assert.equal(receipt.web["inc-0910-inicio-solo-actual"],betaRevision("inc-0910-inicio-solo-actual").web);
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
  assert.deepEqual(betaCompatible(g,betaRevision(id),JSON.parse(read("scripts/beta-sources.json"))[id]),{});
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
    assert.equal(betaRevision("inc-0910-inicio-solo-actual",changed).web,betaRevision("inc-0910-inicio-solo-actual",source).web,"no repina la propuesta de patrimonio actual");
  }
});

test("Recientes106 reanclada conserva expresión, identidad y recibo completos",()=>{
  const id="inc-0810-dashboard-recents-memo",file="src/modules/03-tab-dash.js";
  const actual=JSON.parse(read("scripts/beta-sources.json"))[id];
  const anchor={file,from:"  const recent=useMemo",to:",[state.expenses,state.deleted]);",includeTo:true};
  assert.deepEqual(actual.web[0],anchor);
  const currentText=scopeText(anchor,read),current=betaRevision(id,read);
  const cache=new Map(),at=(sha,f)=>{const k=sha+":"+f;if(!cache.has(k))cache.set(k,execFileSync("git",["show",k],{encoding:"utf8",maxBuffer:10e6}));return cache.get(k);};
  for(const sha of ["23a7808f65ef6d28e8a906f7100ffdf229917abb","f4ffb9340adfd0a13b631271e8158d2c630613c0","b1ad23f34f2a94933e57246dfdf12c451f5360a1"]){
    const before=JSON.parse(at(sha,"scripts/beta-sources.json"))[id],source=f=>at(sha,f);
    assert.ok(before,"el baseline debe contener la unidad106 real");
    assert.deepEqual({...actual,web:before.web},before,"ningún descriptor ajeno ni metadata106 cambia");
    assert.deepEqual(actual.web.slice(1),before.web.slice(1),"todas las dependencias reales siguen presentes");
    assert.equal(currentText,scopeText(before.web[0],source),"reanclaje no recorta ni amplía el contenido");
    assert.equal(scopeText(anchor,source),scopeText(before.web[0],source),"el cierre también funciona en lectores históricos");
    assert.equal(current.web,betaRevision(id,source,undefined,before).web,"identidad recalculada, sin copiar huella anterior");
    assert.equal(current.web,betaRevision(id,source,undefined,actual).web,"no absorbe constp del renderer histórico");
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
  const scopes=JSON.parse(read("scripts/beta-sources.json"));
  assert.equal(betaRevision("inc-3009-nomina-anticipada",read).web,betaRevision("inc-3009-nomina-anticipada",old,undefined,scopes["inc-3009-nomina-anticipada"]).web,"Nómina111 conserva identidad real");
});

process.exitCode=failed?1:0;
