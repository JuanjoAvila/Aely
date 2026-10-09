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
let source = fs.readFileSync(new URL(cliUrl),"utf8");
if (sourceArg >= 0) {
  source = execFileSync("git",["show",process.argv[sourceArg+1]+":scripts/listo-para-produccion.mjs"],{cwd:root,encoding:"utf8"});
}
source = source.replace('from "./load-pure-logic.mjs"', 'from '+JSON.stringify(new URL("../scripts/load-pure-logic.mjs",import.meta.url).href))
  .replace("fileURLToPath(import.meta.url)", "fileURLToPath("+JSON.stringify(cliUrl)+")");
const part = (actor, verdict, hour=9) => ({user_id:actor,kind:"beta",created_at:`2026-10-01T${String(hour).padStart(2,"0")}:00:00Z`,
  detail:{tanda:g.id,huella:g.huella,verdict}});
const profile = {user_id:owner,is_admin:true};
function run(rows, options={}) {
  let target=source;
  // Un .env.local de otra sesión no debe sustituir la clave ficticia del transporte.
  const fsImport='import fs from "node:fs";';
  assert.ok(target.includes(fsImport),"la fixture necesita aislar la lectura de credenciales");
  target=target.replace(fsImport,'import fixtureFs from "node:fs";\nconst fs={...fixtureFs,existsSync:f=>String(f).endsWith(".env.local")?false:fixtureFs.existsSync(f)};');
  if(options.text){
    // La rama y las tandas del doble fijan cada condición del informe; actor, huella,
    // historial y entrega siguen usando las reglas reales, sin red ni refs de otras sesiones.
    const gitImport='import { execFileSync } from "node:child_process";';
    assert.ok(target.includes(gitImport),"la fixture necesita el transporte Git del CLI");
    target=target.replace(gitImport,'const execFileSync=()=>'+JSON.stringify((options.branches||[]).join("\n"))+';');
    const logicImport='import { loadPureLogicFromFile } from '+JSON.stringify(new URL("../scripts/load-pure-logic.mjs",import.meta.url).href)+';';
    assert.ok(target.includes(logicImport),"la fixture necesita las reglas reales del CLI");
    target=target.replace(logicImport,'import { loadPureLogicFromFile as fixtureLogic } from '+JSON.stringify(new URL("../scripts/load-pure-logic.mjs",import.meta.url).href)+';\n'+
      'function loadPureLogicFromFile(){const c=fixtureLogic();c.betaChecklist=()=>({tandas:'+JSON.stringify(options.tandas)+'});return c;}');
  }
  const script = `
    import assert from 'node:assert/strict';
    process.argv=[process.execPath,...${JSON.stringify(options.text?["fixture"]:["fixture","--json"])}];
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
    await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(target).toString('base64'))});`;
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

const corto=g.id.split("/").slice(1).join("/");
const web=Object.assign({},g,{native:false,edge:false});
function informe(options={},rows=[part(owner,"approved")]){
  const r=run(rows,{text:true,tandas:[web],...options});
  assert.equal(r.status,0,r.stderr);
  assert.doesNotMatch(r.stdout,/PUEDES SUBIR YA|se puede subir sola|NO QUEDA NADA PENDIENTE|NO SE PUEDEN TROCEAR|deja «tandas» vacío|confirmar SUBIR/,
    "el listado no autoriza una publicación ni descarta un porte");
  assert.ok(!r.stdout.includes(owner)&&!r.stdout.includes(other),"no volcar identidades");
  return r.stdout;
}
t("texto: aprobada con rama es candidata y conserva entrega pendiente",()=>{
  const out=informe({branches:[corto]});
  assert.ok(out.includes("rama candidata: tanda/"+corto));
  assert.ok(out.includes("revisar diff, dependencias, pruebas y entrega"));
  assert.ok(out.includes("pendientes de revisión técnica y entrega acreditada"));
  assert.ok(out.includes("aprobada, pendiente de entrega exacta web"));
});
t("texto: aprobada sin rama permite comprobar un porte previo o preparar uno",()=>{
  const out=informe();
  assert.ok(out.includes("sin rama propia: comprobar si existe un porte entregado"));
  assert.ok(out.includes("Si falta entrega, preparar un porte aislado"));
  assert.doesNotMatch(out,/Suben cuando suba la ronda entera/);
});
t("texto: toda la lista aprobada no acredita el diff completo ni su entrega",()=>{
  const out=informe({branches:[corto]});
  assert.ok(out.includes("Todas las tandas de esta lista tienen aprobación"));
  assert.ok(out.includes("no acredita aprobación del diff completo ni entrega de todas sus superficies"));
  assert.doesNotMatch(out,/la ronda entera está aprobada/);
});
for(const [name,native,edge] of [["APK",true,false],["Edge",false,true],["APK y Edge",true,true]])
t("texto: "+name+" pendientes no se entregan por tener rama web",()=>{
  const out=informe({branches:[corto],tandas:[Object.assign({},g,{native,edge})]});
  assert.ok(out.includes("requiere entrega acreditada de "+name));
  assert.ok(out.includes("aprobada, pendiente de entrega exacta: "+name.replace(" y "," + ")));
  assert.ok(out.includes("Veredictos pendientes: 0"));
  assert.ok(out.includes("La entrega web, APK y Edge se acredita por separado"));
  assert.doesNotMatch(out,/rama candidata:|CANDIDATAS CON RAMA:|Todas las tandas de esta lista tienen aprobación/);
});
t("texto: rechazo propio y OK ajeno conservan el veredicto pendiente",()=>{
  const out=informe({branches:[corto]},[part(other,"approved",10),part(owner,"rejected")]);
  assert.ok(out.includes("Veredictos pendientes: 1: "+corto));
  assert.doesNotMatch(out,/rama candidata:|Todas las tandas de esta lista tienen aprobación/);
});
t("texto: identidad ambigua sigue indeterminada sin evaluar candidatas",()=>{
  const r=run([part(owner,"approved")],{text:true,tandas:[web],branches:[corto],profiles:[profile,{user_id:other,is_admin:true}],count:"0-1/2"});
  assert.equal(r.status,2);
  assert.match(r.stderr,/Identidad autorizada indeterminada/);
  assert.equal(r.stdout,"");
});
t("texto: lista vacía exige contrastar cualquier promoción",()=>{
  const out=informe({tandas:[]});
  assert.ok(out.includes("Esta lista no contiene tandas pendientes"));
  assert.ok(out.includes("comprobar el alcance y los artefactos de cualquier promoción"));
});
if(failed){console.error(`\nlisto-actor: ${failed} fallo(s)`);process.exit(1);}
console.log("\nlisto-actor: OK");
