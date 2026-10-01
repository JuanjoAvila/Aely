import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createHash, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";

// Marcadores inventados: nunca consulta tablas, Sentry ni bancos reales.
const sourceRef=process.argv[process.argv.indexOf("--source-ref")+1];
const fromRef=process.argv.includes("--source-ref");
const read=p=>fromRef?execFileSync("git",["show",sourceRef+":"+p],{cwd:new URL("../",import.meta.url),encoding:"utf8"}):fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const core=read("src/modules/00-core.js");
const markers=["ES9121000418450200051332","sec03@example.invalid","+34 612 345 678","sec03_secret_credential","SEC03_NOTA_BANCARIA","9876.54"];
const sensitive=markers.join(" ");
const clean=(x,allowed=[])=>{const s=JSON.stringify(x);for(const m of markers.filter((_,i)=>!allowed.includes(i)))assert.ok(!s.includes(m),"marcador sintético filtrado: "+markers.indexOf(m));};
const error=()=>Object.assign(new Error("EB 503 "+sensitive),{code:"23505",stack:"Error "+sensitive+"\n at https://app.invalid/index.html?token=sec03_secret_credential:40:2"});
function client(){
  const rows=[],captures=[],logs=[];let options;
  const db={auth:{getSession:async()=>({data:{session:{user:{id:"synthetic-user",email:markers[1]}}}})},from:()=>({insert:async row=>{rows.push(row);return {};}})};
  const c=vm.createContext({CONFIG:{SENTRY_DSN:"synthetic",APP_VERSION:"4.26.52",SUPABASE_URL:"synthetic",SUPABASE_ANON_KEY:"synthetic"},window:{supabase:{createClient:()=>db}},console:{error:(...a)=>logs.push(a)},Sentry:{init:o=>{options=o;},captureException:(...a)=>captures.push(a)},React:{Component:class{}},mcSandbox:()=>false});
  vm.runInContext(core.slice(core.indexOf("var _mcSentryReady"),core.indexOf("/* ---------- Categorías")),c);
  // Los helpers de privacidad se insertan junto al transporte, no se prueban copias del código.
  if(core.includes("function mcLogCode"))vm.runInContext(core.slice(core.indexOf("function mcLogCode"),core.indexOf("var _mcSentryReady")),c);
  vm.runInContext(core.slice(core.indexOf("const USO_OK="),core.indexOf("/* Orden del objeto")),c);
  vm.runInContext(core.slice(core.indexOf("const cloud = (function()"),core.indexOf("/* Escritura de gastos"))+";globalThis.cloud=cloud;",c);
  return {c,db,rows,captures,logs,options:()=>options};
}
const ts=(text)=>transformSync(text.replace(/^import .*?;\r?\n/gm,""),{loader:"ts",format:"esm"}).code.replace(/^export /gm,"");
let failed=0;
async function t(name,fn){try{await fn();console.log("  ✓ "+name);}catch(e){failed++;console.log("  ✗ "+name+": "+e.message);}}
await t("errores libres y detail no salen; ruta y SQLSTATE permanecen",async()=>{
 const x=client();await x.c.cloud.logEvent("error","addExpense apuntar: "+sensitive,error().message);
 clean(x.rows);assert.equal(x.rows.length,1);assert.match(x.rows[0].message,/addExpense/);
 await x.c.cloud.logEvent("error",sensitive,sensitive);clean(x.rows);
});
await t("fallo real de subirGasto/borrarGasto no envía identidad financiera",async()=>{
 const x=client();x.c.keyOfExpense=()=>sensitive;x.c.cloud.addExpense=async()=>{throw error();};x.c.cloud.deleteExpense=async()=>{throw error();};
 const start=core.indexOf("function _errCloudMsg");vm.runInContext(core.slice(start,core.indexOf("/* ---------- Blindaje",start)),x.c);
 const e={amount:9876.54,merchant:markers[4],date:"2026-09-27",id:"synthetic"};await x.c.subirGasto(e,"apuntar");await x.c.borrarGastoNube(e,"gastos");await new Promise(resolve=>setImmediate(resolve));clean(x.rows);assert.equal(x.rows.length,2);assert.match(JSON.stringify(x.rows),/23505/);
});
await t("uso/perf/ping conservan vocabulario cerrado y no envían correo",async()=>{
 const x=client();await x.c.cloud.logUso("tab_inicio");await x.c.cloud.logPerf("sync_bancos",1250);await x.c.cloud.logEvent("ping","app abierta");await x.c.cloud.logUso(sensitive);await x.c.cloud.logEvent("use",sensitive);clean(x.rows);assert.equal(x.rows.length,3);assert.equal(x.rows[0].email,null);assert.equal(x.rows[1].message,"sync_bancos 1.5s");
});
await t("feedback explícito redacta patrones sensibles antes del insert y no oculta el fallo",async()=>{
 const x=client();await x.c.cloud.feedback("No abre Plan; IBAN "+markers[0]+" correo "+markers[1]+" teléfono "+markers[2]+" token=sec03_secret_credential nota=SEC03_NOTA_BANCARIA importe 9876.54 EUR");clean(x.rows,[4,5]);assert.match(x.rows[0].message,/No abre Plan/);
});
await t("beta conserva veredicto/tanda; elimina campos extra y redacta notas",async()=>{
 const x=client();await x.c.cloud.betaReport({verdict:"rejected",version:"4.26.52",tanda:"sec03",probados:2,fallos:1,sinProbar:3,noProbable:1,heredados:2,summary:"RECHAZADA token=sec03_secret_credential",detalle:[{item:"Abrir Plan",nota:"nota=SEC03_NOTA_BANCARIA importe 9876.54 EUR"}],credentials:sensitive,bank:{note:sensitive}});clean(x.rows,[4,5]);const d=JSON.parse(x.rows[0].detail);assert.equal(d.verdict,"rejected");assert.equal(d.tanda,"sec03");assert.equal(d.credentials,undefined);assert.equal(d.bank,undefined);assert.equal(d.heredados,2);assert.equal(d.probados,2);assert.equal(d.fallos,1);assert.equal(d.sinProbar,3);assert.equal(d.noProbable,1);
});
await t("Sentry beforeSend descarta todos los contenedores libres y conserva posición/código",()=>{
 const x=client();x.c.mcInitSentry();const o=x.options();const ev={event_id:"a".repeat(32),release:"mi-cartera@4.26.52",environment:"web",message:sensitive,user:{email:sensitive},request:{url:"https://app.invalid/?token="+sensitive,headers:{Authorization:sensitive}},extra:{note:sensitive},contexts:{bank:sensitive},tags:{name:sensitive},breadcrumbs:[{message:sensitive}],exception:{values:[{type:"TypeError",value:"23505 "+sensitive,stacktrace:{frames:[{filename:"https://app.invalid/index.html?token="+sensitive,function:sensitive,lineno:40,colno:2,vars:{note:sensitive},pre_context:[sensitive]}]}}]}};
 const out=o.beforeSend(ev);clean(out);assert.equal(out.exception.values[0].type,"TypeError");assert.equal(out.exception.values[0].stacktrace.frames[0].lineno,40);assert.equal(o.beforeBreadcrumb({message:sensitive}),null);assert.equal(o.beforeSendTransaction(ev),null);assert.equal(o.tracesSampleRate,0);assert.equal(o.sendDefaultPii,false);
});
await t("cola y captura inmediata sanitizan antes de entregar al SDK",()=>{
 const x=client();x.c.mcCaptureError(error(),{componentStack:sensitive,note:sensitive});clean(x.c._mcSentryQueue);x.c.mcInitSentry();x.c.mcCaptureError(error(),{note:sensitive});clean(x.captures.map(([e,ctx])=>({name:e.name,message:e.message,stack:e.stack,ctx})));assert.equal(x.captures.length,2);
});
await t("ErrorBoundary no escribe error/info crudos en consola",()=>{
 const x=client();const s=read("src/modules/10-app-components.js");const a=s.indexOf("  componentDidCatch(err,info){");const b=s.indexOf("  render(){",a);vm.runInContext("function caught(err,info){"+s.slice(a,b).replace(/^  componentDidCatch\(err,info\)\{/,"").replace(/\}\s*$/,"")+"}",x.c);x.c.caught(error(),{componentStack:sensitive});clean(x.logs);assert.equal(x.logs.length,1);
});
await t("limitador Edge: error y excepción no envían message/bucket",async()=>{
 const logs=[];const run=new Function("console",ts(read("supabase/functions/_shared/ratelimit.ts"))+";return rateLimit;");const rate=run({error:(...a)=>logs.push(a)});
 for(const rpc of [async()=>({error:error()}),async()=>{throw error();}])assert.deepEqual(await rate({rpc},sensitive,2,60),{ok:true,checked:false});clean(logs);assert.equal(logs.length,2);assert.match(JSON.stringify(logs),/23505/);
});
await t("callback Edge: query hostil y fallo BD no salen a consola/app_events",async()=>{
 const entrada=ts(read("supabase/functions/_shared/entrada.ts"));const src=ts(read("supabase/functions/bank-callback/index.ts"));
 for(const query of ["?error=sec03_secret_credential&error_description="+encodeURIComponent(sensitive),"?code=synthetic&state=synthetic"]){
  const logs=[],rows=[];let handler;const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:"synthetic",user_id:"synthetic-user"}})})}),update:()=>({eq:async()=>{throw error();}}),insert:async x=>{rows.push(x);}})};
  new Function("Deno","createClient","console","encryptSessionId","ebApi","ebConfig","makeJWT",entrada+src)({env:{get:()=>"https://app.invalid/"},serve:f=>{handler=f;}},()=>db,{error:(...a)=>logs.push(a)},async()=>"encrypted",async()=>({}),()=>({}),async()=>"jwt");
  const res=await handler(new Request("https://edge.invalid/"+query));assert.equal(res.status,302);clean(logs);clean(rows);assert.equal(logs.length,1);
 }
});
await t("bank-sync Edge: loggers no envían banco libre; conservan clase y recuentos",async()=>{
 const rows=[];const src=read("supabase/functions/bank-sync/index.ts");const f=new Function(ts(src.slice(0,src.indexOf("Deno.serve")))+";return {logObReadFailure,logObHistoryResult};")();const db={from:()=>({insert:async x=>{rows.push(x);}})};
 await f.logObReadFailure(db,"synthetic-user",sensitive,error());await f.logObHistoryResult(db,"synthetic-user",sensitive,"2026-09-01",[{count:2,transactions:[{note:sensitive}],ok:true}],100);clean(rows);assert.equal(JSON.parse(rows[0].detail).code,"eb_503");assert.equal(JSON.parse(rows[1].detail).count,2);
});
await t("ingest Edge: code DB arbitrario y currency/source no salen a app_events",async()=>{
 const rows=[];const src=read("supabase/functions/ingest/index.ts");const f=new Function("Deno",ts(src.slice(src.indexOf("async function logIngestError")))+";return {logIngestError,logIngestSkip};")({env:{get:()=>null}});const db={from:()=>({insert:async x=>{rows.push(x);}})};
 await f.logIngestError(db,"synthetic-user","no se pudo guardar el gasto",{code:sensitive,source:"wallet"});await f.logIngestError(db,"synthetic-user","sin tipo de cambio para "+sensitive+": el gasto NO se ha apuntado",{currency:sensitive});await f.logIngestSkip(db,"synthetic-user","sin importe","wallet",12,2);clean(rows);assert.equal(rows.length,3);
});

await t("errores por todas las familias de productor se cierran en el transporte",async()=>{
 const x=client();const prefixes=["setExpenseDup gastos-dup: ","setExpenseDeuda: ","MI: ","TR sync: ","bankConnect ","OB ","bankSync sin pull ","CRASH: ","TOAST: ","Promise: ","canal ","OTA ","APK ","import hoja: ",""];
 for(const prefix of prefixes)await x.c.cloud.logEvent("error",prefix+sensitive,sensitive);
 clean(x.rows);assert.equal(x.rows.length,prefixes.length);
});
await t("hist solo permite recuentos/booleanos/fechas; OB no deja pasar tipos libres",async()=>{
 const x=client();await x.c.cloud.logEvent("hist",sensitive,JSON.stringify({llegan:4,nuevos:2,dateFrom:"2026-09-01",minDate:"2026-09-02",expensesN:8,bankPayload:sensitive,notes:sensitive,truncExplicit:false}));await x.c.cloud.logEvent("error","OB "+sensitive,JSON.stringify([{types:[sensitive],nbal:2}]));clean(x.rows);const hist=JSON.parse(x.rows[0].detail);assert.equal(hist.llegan,4);assert.equal(hist.dateFrom,"2026-09-01");assert.equal(hist.notes,undefined);
});
await t("feedback/beta fallan explícitamente si el insert falla; sin sesión no escriben",async()=>{
 const x=client();x.db.from=()=>({insert:async()=>({error:new Error("synthetic failure")})});await assert.rejects(x.c.cloud.feedback("No abre Plan"));await assert.rejects(x.c.cloud.betaReport({verdict:"rejected"}));x.db.auth.getSession=async()=>({data:{session:null}});await x.c.cloud.logEvent("error",sensitive);await assert.rejects(x.c.cloud.feedback("No abre Plan"));assert.equal(x.rows.length,0);
});
await t("SDK Sentry instalado: sobre final capturado con transporte en memoria",async()=>{
 const S=await import("@sentry/browser");const x=client();x.c.mcInitSentry();const envelopes=[];
 S.init({...x.options(),dsn:"https://synthetic@telemetry.invalid/1",transport:()=>({send:async envelope=>{envelopes.push(envelope);return {};},flush:async()=>true})});
 S.setUser({email:markers[1],id:sensitive,segment:sensitive});S.getCurrentScope().setTransactionName(sensitive);S.setContext("bank",{note:sensitive});S.setExtra("note",sensitive);S.setTag("token",sensitive);S.addBreadcrumb({message:sensitive});S.captureException(error());await S.flush(2000);assert.equal(envelopes.length,1);clean(envelopes);const ev=envelopes[0][1].find(([header])=>header.type==="event")[1];assert.ok(ev.exception.values.length);assert.equal(ev.user,undefined);await S.close(2000);
});
await t("inventario de destinos completo: toda nueva ruta obliga a actualizar la matriz",()=>{
 const inventory={"src/modules/00-core.js":[4,2,0],"src/modules/01-i18n.js":[0,0,1],"src/modules/10-app-components.js":[0,0,2],"supabase/functions/bank-sync/index.ts":[2,0,0],"supabase/functions/bank-callback/index.ts":[1,0,1],"supabase/functions/ingest/index.ts":[2,0,0],"supabase/functions/_shared/ratelimit.ts":[0,0,2]};
 const found={};for(const dir of ["src/modules","supabase/functions"]){for(const file of fs.readdirSync(new URL("../"+dir,import.meta.url),{recursive:true})){if(!/\.(?:js|ts)$/.test(file)||file.endsWith(".test.ts"))continue;const path=dir+"/"+file.replaceAll("\\","/");const src=read(path);const counts=[(src.match(/\.from\(["']app_events["']\)/g)||[]).length,(src.match(/Sentry\.captureException\(/g)||[]).length,(src.match(/console\.(?:log|warn|error|info)\(/g)||[]).length];if(counts.some(Boolean))found[path]=counts;}}
 assert.deepEqual(found,inventory);
});


await t("consola de idiomas/notas: errores de lectura no muestran contenidos",async()=>{
 const x=client();const logs=[];x.c.console.warn=(...a)=>logs.push(a);x.c.fetch=async()=>{throw error();};x.c._langPackLoads={};x.c.langPackReady=()=>false;x.c.langPackUrl=()=>"synthetic";x.c.LANG={};
 const lang=read("src/modules/01-i18n.js");vm.runInContext(lang.slice(lang.indexOf("function ensureLangPack("),lang.indexOf("/** Idioma guardado")),x.c);assert.equal(await x.c.ensureLangPack("en"),"es");
 const notes=read("src/modules/10-app-components.js"),a=notes.indexOf("var RELEASE_NOTES_MAX="),b=notes.indexOf("/* Panel de Novedades.",a),versions=notes.indexOf("function mcVerBase("),versionsEnd=notes.indexOf("/* IDENTIDAD DE UNA TANDA",versions);
 assert.ok(a>=0&&b>a&&versions>=0&&versionsEnd>versions,"bloques reales de notas y versiones delimitados");
 // Extraer solo ensureReleaseNotes dejaba su verificador fuera y la petición rechazada sin catch.
 // WebCrypto real y un catálogo con digest conocido impiden que la fixture acepte todo a ciegas.
 const cache=new Map();Object.assign(x.c,{crypto:webcrypto,TextEncoder,URL,document:{querySelector:()=>null,baseURI:"https://app.invalid/"},location:{href:"https://app.invalid/"},
  localStorage:{get length(){return cache.size;},key:i=>[...cache.keys()][i],getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)}});
 vm.runInContext(notes.slice(versions,versionsEnd)+notes.slice(a,b),x.c);
 assert.equal((await x.c.ensureReleaseNotes()).length,0);clean(logs);assert.equal(logs.length,2);
 const exact=[{v:"4.26.52",t:sensitive,items:[sensitive],tandas:[]}];x.c._rnSha=createHash("sha256").update(JSON.stringify(exact)).digest("hex");
 x.c.fetch=async()=>({ok:true,json:async()=>exact});assert.equal(await x.c.ensureReleaseNotes(),exact);clean(logs);assert.equal(logs.length,2);
 x.c.RELEASE_NOTES=[];x.c._rnLoad=null;x.c.fetch=async()=>({ok:true,json:async()=>{throw error();}});
 assert.equal((await x.c.ensureReleaseNotes()).length,0);clean(logs);assert.equal(logs.length,3);
 x.c.fetch=async()=>({ok:true,json:async()=>[{...exact[0],t:sensitive+" catálogo distinto"}]});
 assert.equal((await x.c.ensureReleaseNotes()).length,0);clean(logs);assert.equal(logs.length,4);
});
await t("feedback conserva importes deliberados y redacta IBAN/credenciales",async()=>{
 const x=client();for(const text of ["Importe 9876.54 €","Importe €9876.54","IBAN ES91 2100 0418 4502 0005 1332","Bearer sec03_secret_credential","token: sec03_secret_credential"]){await x.c.cloud.feedback(text);}
 clean(x.rows,[5]);assert.ok(!JSON.stringify(x.rows).includes("1332"));assert.match(x.rows[0].message,/9876.54 €/);assert.match(x.rows[1].message,/€9876.54/);
});


await t("SDK Sentry auto-hospedado: sobre real sin contenido sensible",async()=>{
 const x=client();x.c.mcInitSentry();const options=x.options(),envelopes=[];
 Object.assign(x.c,{setTimeout,clearTimeout,setInterval,clearInterval,performance,URL,URLSearchParams,TextEncoder});
 vm.runInContext(read("public/vendor/sentry.bundle.min.js"),x.c);const S=x.c.Sentry;
 assert.equal(S.SDK_VERSION,"9.47.1");
 S.init({...options,dsn:"https://synthetic@telemetry.invalid/1",transport:()=>({send:async envelope=>{envelopes.push(envelope);return {};},flush:async()=>true})});
 S.setUser({email:markers[1],id:sensitive,segment:sensitive});S.getCurrentScope().setTransactionName(sensitive);S.setContext("bank",{note:sensitive});S.setExtra("token",sensitive);S.addBreadcrumb({message:sensitive});S.captureException(error());await S.flush(2000);assert.equal(envelopes.length,1);clean(envelopes);await S.close(2000);
});


await t("contexto explícito de soporte conserva fecha, hora, importe, SHA y nota",async()=>{
 const x=client();const sha="a1b2c3d4".repeat(5);const text="falla desde 2026-09-27 10:30; Gastado subió 5,45 € al pagar; SHA "+sha+"; nota=SEC03_NOTA_BANCARIA; token=sec03_secret_credential";
 await x.c.cloud.feedback(text);await x.c.cloud.betaReport({verdict:"rejected",version:"4.26.57",tanda:"sec03",summary:text,detalle:[{item:"Abrir Plan",nota:text}]});clean(x.rows,[4]);
 for(const row of x.rows){assert.match(row.message,/2026-09-27 10:30/);assert.match(row.message,/5,45 €/);assert.ok(row.message.includes(sha));assert.ok(row.message.includes("SEC03_NOTA_BANCARIA"));}
});

console.log("logs-privacidad: "+(failed?failed+" fallo(s)":"OK"));process.exitCode=failed?1:0;
