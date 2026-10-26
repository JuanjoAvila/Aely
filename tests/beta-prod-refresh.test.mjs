import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const boot=fs.readFileSync(new URL("../src/modules/12-boot.js",import.meta.url),"utf8");
const helper=fs.readFileSync(new URL("../src/modules/10-app-components.js",import.meta.url),"utf8").match(/function betaPruebasEntrega[\s\S]*?\n\}/)[0];
const transport=boot.slice(boot.indexOf("var _mcProdVerCache=null;"),boot.indexOf("/* CAMBIAR DE CANAL NO ES"));

function fixture(){
  const saved=new Map(),network={offline:false,version:"9.9.2",waiting:[],requests:0,writes:0};
  const context={window:{},Date,Promise,_mcOtaBASE:"https://example.invalid/",
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>{network.writes++;saved.set(k,v);}},
    mcGetJson:url=>{
      network.requests++;
      if(network.offline)return new Promise(resolve=>network.waiting.push(()=>resolve({ok:false})));
      const asset=new URL(url).pathname.slice(1),old=network.version==="9.9.2";
      // El recibo viene completo: su guion tiene guardianes propios. Aquí se ejecutan
      // el transporte y betaPruebasEntrega reales, con respuestas HTTP sintéticas.
      const data=asset==="version.json"?{version:network.version}:asset==="apk.json"?{versionCode:48}:
        {sourceSha:(old?"a":"b").repeat(40),web:old?{entregada:"prod-web"}:{entregada:"prod-web",nueva:"nueva-web"},pruebas:{}};
      return Promise.resolve({ok:true,json:()=>Promise.resolve(data)});
    }};
  vm.createContext(context);vm.runInContext(helper+"\n"+transport,context);
  return {context,network,request:context.window._mcProdVersion,finish:()=>network.waiting.splice(0).forEach(done=>done())};
}

let failed=0;
async function test(name,fn){try{await fn();console.log("  ✓ "+name);}catch(error){failed++;console.error("  ✗ "+name+"\n    "+error.message);}}

await test("el transporte comparte el vuelo offline; una lista anterior no acredita su fin",async()=>{
  const f=fixture();await f.request({refresh:true});
  f.network.offline=true;const offline=f.request({refresh:true});
  assert.equal(f.context._mcProdVerPending,true);
  f.network.offline=false;f.network.version="9.9.3";
  const online=f.request({refresh:true});assert.equal(online,offline);
  assert.equal(f.network.requests,6);f.finish();
  assert.equal(await online,"9.9.2");
  assert.equal(f.context.window._mcProdEntregas.web.nueva,undefined);
  assert.equal(f.context._mcProdVerPending,false);
});

await test("esperar el vuelo offline antes de volver acredita la entrega nueva",async()=>{
  const f=fixture();await f.request({refresh:true});
  f.network.offline=true;const offline=f.request({refresh:true});f.finish();
  assert.equal(await offline,"9.9.2");assert.equal(f.context._mcProdVerPending,false);
  f.network.offline=false;f.network.version="9.9.3";
  assert.equal(await f.request({refresh:true}),"9.9.3");
  assert.equal(f.context.window._mcProdEntregas.web.nueva,"nueva-web");
  assert.equal(f.network.requests,9);
});

await test("refrescar un recibo idéntico no lo reescribe",async()=>{
  const f=fixture();await f.request({refresh:true});assert.equal(f.network.writes,1);
  assert.equal(await f.request({refresh:true}),"9.9.2");assert.equal(f.network.writes,1);
});

console.log(failed?"beta-prod-refresh: "+failed+" fallo(s)":"beta-prod-refresh: OK");
process.exitCode=failed?1:0;
