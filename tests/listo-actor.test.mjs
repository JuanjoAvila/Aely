#!/usr/bin/env node
/* La service_role no convierte los partes de otra cuenta en decisiones del dueño.
   Ejecutamos el CLI real sin red y dejamos que el transporte devuelva también filas ajenas. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const root = new URL("..", import.meta.url);
const cliUrl = new URL("../scripts/listo-para-produccion.mjs", import.meta.url).href;
const version = fs.readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim()+".1";
const cli = loadPureLogicFromFile();
const g = cli.betaChecklist(version,"4.26.67",48).tandas.find(x=>x.id.endsWith("/inc-3009-01-cargos"));
assert.ok(g,"la fixture necesita una tanda real con huella");
const sourceArg = process.argv.indexOf("--source-ref");
let source;
if (sourceArg >= 0) {
  source = execFileSync("git",["show",process.argv[sourceArg+1]+":scripts/listo-para-produccion.mjs"],{cwd:root,encoding:"utf8"});
  source = source.replace('from "./load-pure-logic.mjs"', 'from '+JSON.stringify(new URL("../scripts/load-pure-logic.mjs",import.meta.url).href))
    .replace("fileURLToPath(import.meta.url)", "fileURLToPath("+JSON.stringify(cliUrl)+")");
}
const part = (actor, verdict, hour=9) => ({user_id:actor,kind:"beta",created_at:`2026-10-01T${String(hour).padStart(2,"0")}:00:00Z`,
  detail:{tanda:g.id,huella:g.huella,verdict}});
const profile = {user_id:owner,is_admin:true};
function run(rows, options={}) {
  const script = `
    import assert from 'node:assert/strict';
    process.argv=[process.execPath,'fixture','--json'];
    globalThis.fetch=async (url,init)=>{
      const u=new URL(String(url));
      if(u.pathname.endsWith('/profiles')){
        assert.equal(u.searchParams.get('select'),'user_id,is_admin');
        assert.equal(u.searchParams.get('is_admin'),'eq.true');
        assert.equal(u.searchParams.get('limit'),'2');
        assert.equal(init.headers.Prefer,'count=exact');
        ${options.offline ? "throw new Error('offline sintético');" : ""}
        ${options.badJson ? "return {ok:true,json:async()=>{throw new Error('JSON sintético inválido');}};" : ""}
        return Response.json(${JSON.stringify(options.profiles===undefined?[profile]:options.profiles)},
          {status:${options.status||200},headers:${JSON.stringify(options.count===null?{}:{"content-range":options.count||"0-0/1"})}});
      }
      if(u.pathname.endsWith('/app_events')){
        assert.ok(u.searchParams.get('select').split(',').includes('user_id'),'el CLI debe leer el actor');
        assert.equal(u.searchParams.get('user_id'),'eq.${owner}','el filtro remoto debe preceder al límite de eventos');
        return Response.json(${JSON.stringify(rows)});
      }
      if(u.pathname.endsWith('/beta-delivery.json')) return new Response('',{status:404});
      if(u.pathname.endsWith('/apk.json')) return Response.json({versionCode:48});
      if(u.pathname.endsWith('/version.json')) return Response.json({version:u.pathname.includes('/beta/')?${JSON.stringify(version)}:'4.26.67'});
      throw new Error('la fixture bloquea toda red no prevista');
    };
    await import(${JSON.stringify(source?'data:text/javascript;base64,'+Buffer.from(source).toString('base64'):cliUrl)});`;
  return spawnSync(process.execPath,["--input-type=module","-e",script],{
    cwd:root,encoding:"utf8",env:{...process.env,SUPABASE_SERVICE_ROLE_KEY:"synthetic-test-key"},maxBuffer:2e6
  });
}
let failed=0;
function t(name,fn){try{fn();console.log("  ✓ "+name);}catch(e){failed++;console.error("  ✗ "+name+"\n      "+e.message);}}
function estado(rows){const r=run(rows);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout).tandas.find(x=>x.id===g.id);}

console.log("listo-actor");
t("rechazo propietario 09:00 + OK ajeno 10:00 no aprueba",()=>{
  assert.equal(estado([part(other,"approved",10),part(owner,"rejected")]).estado,"rejected");
});
t("OK propietario 09:00 + rechazo ajeno 10:00 no revoca",()=>{
  const r=estado([part(other,"rejected",10),part(owner,"approved")]);
  assert.equal(r.estado,"approved");
  assert.equal(r.rechazoAnterior,null,"un rechazo ajeno tampoco se presenta como historia propia");
  assert.equal(r.entregaPendiente,true,"el actor autorizado no acredita entrega");
});
t("retirada propia posterior veta el OK propio aunque haya otro OK ajeno",()=>{
  assert.equal(estado([part(other,"approved",11),part(owner,"revoked",10),part(owner,"approved")]).estado,"sin probar");
});
t("null explícito propio 10:00 retira el OK propio 09:00",()=>{
  assert.equal(estado([part(owner,null,10),part(owner,"approved")]).estado,"sin probar");
});
t("null ajeno no retira el OK propio",()=>{
  assert.equal(estado([part(other,null,10),part(owner,"approved")]).estado,"approved");
});
t("decisión ausente o inválida no se interpreta como null explícito",()=>{
  const absent=part(owner,"approved",11); delete absent.detail.verdict;
  assert.equal(estado([absent,...["",false,0,"inventado",{}].map(value=>part(owner,value,10)),part(owner,"approved")]).estado,"approved");
});
t("solo partes ajenos o sin autor no constituyen aprobación",()=>{
  assert.equal(estado([part(other,"approved",10),part(null,"approved")]).estado,"sin probar");
});
for(const [name,options] of [
  ["sin perfil",{profiles:[],count:"*/0"}],
  ["varios administradores",{profiles:[profile,{user_id:other,is_admin:true}],count:"0-1/2"}],
  ["respuesta recortada con varios administradores",{count:"0-0/2"}],
  ["total desconocido",{count:null}],
  ["UUID inválido",{profiles:[{user_id:"identidad-no-valida",is_admin:true}]}],
  ["rol ausente",{profiles:[{user_id:owner}]}],
  ["respuesta no es una lista",{profiles:{user_id:owner,is_admin:true}}],
  ["consulta denegada",{status:403}],
  ["JSON inválido",{badJson:true}],
  ["sin red",{offline:true}],
]) t(name+": indeterminado y salida no exitosa",()=>{
  const r=run([part(other,"approved",10),part(owner,"approved")],options);
  assert.equal(r.status,2,r.stderr);
  const data=JSON.parse(r.stdout);
  assert.equal(data.veredictos,"indeterminado");
  assert.deepEqual(data.tandas,[]);
  assert.ok(!r.stdout.includes(owner)&&!r.stdout.includes(other),"no volcar identidades");
});
if(failed){console.error(`\nlisto-actor: ${failed} fallo(s)`);process.exit(1);}
console.log("\nlisto-actor: OK");
