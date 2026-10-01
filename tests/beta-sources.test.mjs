import assert from "node:assert/strict";
import fs from "node:fs";
import {logicFunctions,scopeDependencies,mutateLogic,logicCalls,benignCalls,logicData,logicReads,scopeDataDependencies,mutateData,benignData} from "../scripts/beta-source-code.mjs";
import { betaRevision, betaNotes, betaDelivery, betaHistorical } from "../scripts/beta-revisions.mjs";

const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const empty=[{v:"4.26.67",tandas:[]}];
const boot="inc-2709-01-arranque-red";
const modern=[{v:"4.26.69",tandas:[{id:boot}]}];
let failed=0;
function test(name,fn){ try{fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+"\n    "+e.message);} }
console.log("beta-sources");

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
  assert.ok(mutateLogic(text,functions.get("helper")).includes("=> /* dependencia mutada */"));
});

test("referencias ampliadas rechazan HEAD/sha ajeno y mantienen el original",()=>{
  const scopes=JSON.parse(read("scripts/beta-sources.json")),notes=JSON.parse(read("src/data/release-notes.json"));
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
  const notes=JSON.parse(read("src/data/release-notes.json"));
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
  const notes=JSON.parse(read("src/data/release-notes.json")),scopes=JSON.parse(read("scripts/beta-sources.json")),id="tr-descripcion-clasificacion";
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
  const notes=JSON.parse(read("src/data/release-notes.json")),id="tr-descripcion-clasificacion",original=betaNotes(notes).flatMap(n=>n.tandas||[]).find(g=>g.id===id&&g.codigoDesde);
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
    assert.notEqual(betaRevision(id,f=>f.endsWith(file)?read(f).replaceAll(from,to):read(f)).codigo,original.codigo,from);
  }
  assert.equal(betaRevision(id,f=>f==="src/modules/10-app-components.js"?read(f)+"\n// texto ajeno":read(f)).codigo,original.codigo);
});
process.exitCode=failed?1:0;
