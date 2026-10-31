import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { planFromFiles } from "../scripts/relevant-tests.mjs";

// Login de TR que pasó a v2 (31/10/2026): «login HTTP 400 · jar[…] snap[…] edad=0min restore=sí(7)»
// salía tal cual en la tarjeta y TR no llegaba a pedir el código. Aquí se vigila el contrato
// web↔puente y lo que pinta/manda la tarjeta; el HTTP real contra TR no se puede probar sin su cuenta.
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8").replace(/\r\n/g,"\n");
const web=read("src/modules/06-sync-brokers.js"),core=read("src/modules/00-core.js");
const java=read("android/app/src/main/java/com/micartera/app/TradeRepublicPlugin.java");
let failed=0;
async function t(name,fn){try{await fn();console.log("  ✓ "+name);}catch(e){failed++;console.log("  ✗ "+name+": "+e.message);}}

const helpers=web.slice(web.indexOf("function trLogFailure("),web.indexOf("function TRSync("));
function mount(bridge){
  const events=[],sets={},c=vm.createContext({cloud:{logEvent:(k,m,d)=>{events.push(JSON.parse(d));}},localStorage:{setItem(){},getItem(){return null;},removeItem(){}}});
  vm.runInContext(helpers,c);
  let hook=0;
  // Orden de useState de TRSync: step, phone, pin, code, … El setter guarda el último valor por índice.
  const init={1:"612345678",2:"1234",3:"5678"};
  Object.assign(c,{trBridge:()=>bridge,trPhoneSaved:()=>"",useEffect(){},markTrAuthExpired(){},markTrConnected(){},brokerSuggest:()=>null,t:k=>k,
    useState:initial=>{const i=hook++;return [i in init?init[i]:initial,v=>{sets[i]=v;}];}});
  const s=web.indexOf("function TRSync("),e=web.indexOf("  const mappedN=",s);
  vm.runInContext(web.slice(s,e)+"return {doLogin,doVerify,doSync};}\nglobalThis.card=TRSync({state:{investments:[]}});",c);
  return {card:c.card,events,sets,c};
}
const tick=()=>new Promise(r=>setImmediate(r));
const sanitize=Function("USO_OK",core.slice(core.indexOf("function mcLogCode("),core.indexOf("var _mcSentryReady"))+"return mcLogEvent;")([]);

await t("el puente nativo cae a v2 cuando v1 contesta 400/405/426, no en 401/429",()=>{
  assert.ok(java.includes("/api/v2/auth/web/login"));
  assert.match(java,/\[400,404,405,410,426\]\.indexOf\(v1\)<0/);
  for(const h of ["X-TR-Device-Info","X-TR-App-Version","X-TR-Platform"]) assert.ok(java.includes("'"+h+"'"),h);
  assert.ok(java.includes("/authenticator-verification"));
});
await t("el texto de error nativo ya no lleva el jar pegado",()=>{
  assert.ok(!/\+ " · " \+ jarDiag\(\)/.test(java));
  assert.ok(!/restore=|edad=|snap\[/.test(java.replace(/\/\/.*$/gm,"")));
});
await t("el reintento tras «Failed to fetch» de un login vuelve a caducar la sesión muerta",()=>{
  assert.match(java,/reloadThen\(\(\) -> \{ if \(isLogin\) dropDeadSession\(\); run\(id, body\); \}\)/);
  assert.match(java,/loginIds\.add\(id\)/);
});
await t("caducidad del sync: la telemetría lleva el diag cerrado (tarjeta y sync general)",async()=>{
  const {card,events}=mount({sync:async()=>({ok:false,authExpired:true,error:"x",diag:{api:"v1",http:401,snapAgeMin:90,restore:"yes",jar:"tr_device"}})});
  await card.doSync();await tick();
  const row=sanitize("error","tr_sync",JSON.stringify(events[0]));
  assert.deepEqual(JSON.parse(row.detail),{schema:1,code:"auth_expired",origin:"tr_card_sync",snapshotAge:"h1_lt_24h",api:"v1",http:"401",restore:"yes"});
  assert.ok(read("src/modules/11-app-main.js").includes('trLogFailure("broker_manual_sync","auth_expired",res.diag)'));
});
await t("beta corre este guardián al tocar la tarjeta, el sanitizador o el puente",()=>{
  const runner=read("scripts/run-tests.mjs");
  assert.ok(runner.includes('["tr-login-v2", ["node", "tests/tr-login-v2.test.mjs"]]'));
  for(const f of ["src/modules/06-sync-brokers.js","src/modules/00-core.js","src/modules/11-app-main.js","android/app/src/main/java/com/micartera/app/TradeRepublicPlugin.java"]){
    const steps=planFromFiles([f]).steps;
    assert.ok(steps==="all"||steps.includes("tr-login-v2"),f+" → "+JSON.stringify(steps));
  }
});
await t("versión y plataforma por defecto: web y nativo dicen lo mismo",()=>{
  const w=web.match(/TR_V2_CLIENT=\{appVersion:"([^"]+)", platform:"([^"]+)"\}/);
  assert.ok(w);
  assert.ok(java.includes('TR_V2_APP_VERSION = "'+w[1]+'"'));
  assert.ok(java.includes('TR_V2_PLATFORM = "'+w[2]+'"'));
});
await t("APK 62: el 400 del login sale en una línea y sin cookies",async()=>{
  const {card,events,sets}=mount({login:async()=>({ok:false,status:400,error:"login HTTP 400 · jar[tr_preferred_color_mode,tr_device] snap[tr_device,tr_refresh] edad=0min restore=sí(7)"})});
  card.doLogin();await tick();await tick();
  assert.equal(sets[7],"tr_err_update");
  assert.deepEqual(events,[{schema:1,code:"login_failed",origin:"tr_card_login",snapshotAge:"unknown"}]);
});
await t("APK nueva: el diag viaja a telemetría solo como enums",async()=>{
  const diag={api:"v2",http:400,trCode:"MISSING_REQUIRED_HEADER",v1http:400,jar:"tr_device,tr_refresh",snap:"tr_device",snapAgeMin:3,restore:"yes",restoreN:7};
  const {card,events,sets}=mount({login:async()=>({ok:false,status:400,error:"login v2 HTTP 400",diag})});
  card.doLogin();await tick();await tick();
  // Con el puente nuevo ya está en la última APK: «actualiza la app» no le serviría (se arregla por OTA).
  assert.equal(sets[7],"tr_err");
  const row=sanitize("error","tr_sync",JSON.stringify(events[0]));
  assert.deepEqual(JSON.parse(row.detail),{schema:1,code:"login_failed",origin:"tr_card_login",snapshotAge:"lt_5m",api:"v2",http:"400",trCode:"MISSING_REQUIRED_HEADER",restore:"yes"});
});
await t("el sanitizador tira lo que podría llevar teléfono, PIN o correo",()=>{
  for(const bad of ["+34612345678","PIN1234","a@b.es","missing_header","X"]){
    const row=sanitize("error","tr_sync",JSON.stringify({schema:1,code:"login_failed",origin:"tr_card_login",snapshotAge:"unknown",trCode:bad,http:"612345678",api:"v9",restore:"sí(7)"}));
    assert.deepEqual(JSON.parse(row.detail),{schema:1,code:"login_failed",origin:"tr_card_login",snapshotAge:"unknown"},bad);
  }
});
await t("v2 con aviso: tras el login se espera la aprobación sin pedir código",async()=>{
  const calls=[];
  const {card,sets}=mount({login:async o=>{calls.push(["login",o]);return {ok:true,api:"v2",flow:"push",processId:"p-1"};},verify:async o=>{calls.push(["verify",o]);return {ok:false,pending:true,diag:{api:"v2",trCode:"PENDING"}};}});
  card.doLogin();for(let i=0;i<4;i++)await tick();
  assert.equal(calls[0][1].appVersion,"2.2631.13");assert.equal(calls[0][1].platform,"web-pro");
  assert.equal(calls[1][0],"verify");
  assert.deepEqual({p:calls[1][1].processId,c:calls[1][1].code,f:calls[1][1].flow,a:calls[1][1].api},{p:"p-1",c:"",f:"push",a:"v2"});
  assert.equal(sets[7],"tr_push_pending");
});
await t("v1 (APK 62) sigue pidiendo el código y no verifica solo",async()=>{
  const calls=[];
  const {card,sets}=mount({login:async()=>({ok:true,processId:"p-2"}),verify:async o=>{calls.push(o);return {ok:true};}});
  card.doLogin();for(let i=0;i<4;i++)await tick();
  assert.equal(calls.length,0);assert.equal(sets[0],"code");
});

// El JS que inyecta el puente es una concatenación de strings Java: un typo ahí solo se veía al
// pulsar Conectar en el móvil. Se reconstruye desde la fuente y se ejecuta contra un fetch falso.
const javaConst=name=>{
  const a=java.indexOf("private static final String "+name+" ="),b=java.indexOf("\n\n",a);
  return java.slice(a,b).replace("private static final String "+name+" =","").replace(/^\s*\/\/.*$/gm,"").replace(/\+[ \t]*\/\/[^\n]*/g,"+").replace(/;[ \t]*(\/\/[^\n]*)?\s*$/,"");
};
const runArg=(from,to,end)=>{const s=java.slice(java.indexOf(from),java.indexOf(to));const a=s.indexOf("run(id, WFETCH + V2JS +")+"run(id, ".length;return s.slice(a,s.indexOf(end,a)).replace(/^\s*\/\/.*$/gm,"");};
const V2_LOGIN=eval(javaConst("V2_LOGIN")),WFETCH=eval(javaConst("WFETCH")),V2JS=eval(javaConst("V2JS"));
const jsStr=s=>JSON.stringify(s),av="2.2631.13",pf="web-pro",phone="+34600000000",pin="0000";
const body="JSON.stringify({phoneNumber:"+jsStr(phone)+",pin:"+jsStr(pin)+"})";
const loginJs=eval(runArg("public void login(","public void verify(","\n        ); });"));
const verifyExpr=runArg("public void verify(","public void sync(","\n            ));\n            return;");
const verifyJs=(flow,code,processId)=>eval(verifyExpr.replace('"authenticator".equals(flow)',JSON.stringify(flow==="authenticator")));
async function inject(js,routes){
  const calls=[],store=new Map();
  const g={window:{},navigator:{userAgent:"Mozilla/5.0 (Linux; Android 16; wv) AppleWebKit/537.36 Chrome/150.0.0.0 Mobile Safari/537.36",language:"es-ES",languages:["es-ES","es"],hardwareConcurrency:8},
    screen:{width:1440,height:3168,colorDepth:24},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)},crypto:globalThis.crypto,btoa:globalThis.btoa,
    fetch:async(url,opts)=>{calls.push({url,headers:opts.headers,body:opts.body});const r=routes(url,calls.length);return {status:r[0],text:async()=>JSON.stringify(r[1]||{})};},setTimeout:f=>setTimeout(f,0)};
  const out=await new Function(...Object.keys(g),"return (async()=>{"+js+"})();")(...Object.values(g));
  return {out:JSON.parse(out),calls};
}
await t("puente: v1 400 → v2 con cabeceras de navegador y aprobación por aviso",async()=>{
  const r=await inject(loginJs,url=>url.endsWith("/v1/auth/web/login")?[400,{errors:[{errorCode:"BAD_REQUEST"}]}]:url.endsWith("/v2/auth/web/login")?[200,{processId:"p-1"}]:url.includes("/processes/p-1")?[200,{status:"PENDING"}]:[404]);
  assert.deepEqual(r.out,{ok:true,api:"v2",flow:"push",processId:"p-1",countdown:120});
  const h=r.calls[1].headers,info=JSON.parse(atob(h["X-TR-Device-Info"]));
  assert.equal(h["X-TR-App-Version"],av);assert.equal(h["X-TR-Platform"],pf);
  assert.equal(info.stableDeviceId.length,128);assert.equal(info.browserVersion,"150.0.0.0");assert.equal(info.os,"Android");
  assert.ok(!JSON.stringify(info).includes(phone));
});
await t("puente: 401 de v1 no gasta otro intento en v2; v1 bueno sigue con código",async()=>{
  let r=await inject(loginJs,()=>[401,{errors:[{errorCode:"AUTHENTICATION_ERROR",errorMessage:"x"}]}]);
  assert.equal(r.calls.length,1);assert.deepEqual(r.out.diag,{api:"v1",http:401,trCode:"AUTHENTICATION_ERROR"});
  r=await inject(loginJs,()=>[200,{processId:"p-v1",countdownInSeconds:30}]);
  assert.deepEqual(r.out,{ok:true,api:"v1",flow:"code",processId:"p-v1",countdown:30});
});
await t("puente: v2 rechazado devuelve diag de las dos APIs",async()=>{
  const r=await inject(loginJs,url=>url.endsWith("/v1/auth/web/login")?[426,{errors:[{errorCode:"CLIENT_VERSION_OUTDATED"}]}]:[400,{errors:[{errorCode:"MISSING_REQUIRED_HEADER"}]}]);
  assert.equal(r.out.ok,false);assert.deepEqual(r.out.diag,{api:"v2",http:400,trCode:"MISSING_REQUIRED_HEADER",v1http:426,v1Code:"CLIENT_VERSION_OUTDATED"});
});
await t("puente: verify v2 sondea hasta CONFIRMED, manda el código del autenticador y canta el proceso caducado",async()=>{
  let r=await inject(verifyJs("push","","p-1"),(url,n)=>[200,{status:n<3?"PENDING":"CONFIRMED"}]);
  assert.deepEqual(r.out,{ok:true});assert.equal(r.calls.length,3);
  r=await inject(verifyJs("authenticator","123456","p-2"),url=>url.endsWith("/authenticator-verification")?[200,{}]:[200,{status:"COMPLETED"}]);
  assert.deepEqual(r.out,{ok:true});assert.ok(r.calls[0].url.endsWith("/processes/p-2/authenticator-verification"));assert.equal(JSON.parse(r.calls[0].body).code,"123456");
  r=await inject(verifyJs("push","","p-3"),()=>[410,{errors:[{errorCode:"PROCESS_GONE"}]}]);
  assert.equal(r.out.ok,false);assert.equal(r.out.diag.trCode,"PROCESS_GONE");
});

console.log("tr-login-v2: "+(failed?failed+" FAIL":"PASS"));
if(failed)process.exit(1);
