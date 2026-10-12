import assert from 'node:assert/strict';
import fs from 'node:fs';
import {edgeFixture} from './helpers/edge-handler-fixture.mjs';
const post=(body,headers={},query='?state=synthetic&code=synthetic')=>new Request('https://synthetic.invalid/'+query,{method:'POST',body,headers:{Authorization:'Bearer synthetic',...headers}});
const inputBlock=(source,name)=>{
 const start=source.indexOf('    const input = await readInput(req, "'+name+'");');
 const end=source.indexOf('\n\n',start);assert(start>=0&&end>start);return source.slice(start,end+2);
};
const checks=[
 ['cron antes del cuerpo','myinvestor-keepalive',source=>{
   const block=inputBlock(source,'myinvestor-keepalive');return source.replace(block,'').replace('  try {','  try {\n'+block);
 },async make=>{assert.equal((await make().handler(post('{',{'x-cron-key':'incorrect'}))).status,401)}],
 ['state antes del cuerpo','bank-callback',source=>{
   const block=inputBlock(source,'bank-callback');return source.replace(block,'').replace('  try {','  try {\n'+block);
 },async make=>{assert.equal((await make({authorized:false}).handler(post('{'))).status,302)}],
 ['caducidad antes del cuerpo','bank-callback',source=>{
   const block=inputBlock(source,'bank-callback');return source.replace(block,'').replace('    const issued =',block+'    const issued =');
 },async make=>{assert.equal((await make({callbackIssuedAt:'2026-10-12T10:00:00Z'}).handler(post('{'))).status,302)}],
 ['país query','bank-aspsps',source=>source.replace('!validInput("bank-aspsps", { country: url.searchParams.get("country") })','false'),async make=>{
   assert.equal((await make().handler(new Request('https://synthetic.invalid/?country=ESP'))).status,400);
 }],
 ['dateFrom','bank-sync',source=>source.replace(/case "bank-sync": return optional\(b, "dateFrom",[\s\S]*?(?=\n      && optional\(b, "recoverGaps")/,'case "bank-sync": return true'),async make=>{
   assert.equal((await make().handler(post('{"dateFrom":"2026-02-30"}'))).status,400);
   const r=await make().handler(post('{"dateFrom":"2026-02-28T12:00:00.000Z","aspsps":[null]}'));
   assert.equal(r.status,200);const body=await r.json();assert.equal(body.dateFrom,'2026-02-28');assert.equal(body.history,true);
 }],
 ['acks y claves futuras','bank-sync',source=>source.replace('switch (name) {','if (name === "bank-sync" && Object.keys(b).some(k => !["dateFrom","recoverGaps","aspsps"].includes(k))) return false;\n  switch (name) {'),async make=>{
   assert.equal((await make().handler(post('{"recoverGaps":true,"acks":{},"campoFuturo":{"version":2}}'))).status,200);
 }],
];
for(const [label,name,change,check] of checks){
 await check(options=>edgeFixture(name,options));
 let applied=false,killed=false;
 try{
  await check(options=>edgeFixture(name,{...options,mutate(file,source){
   const target=['dateFrom','acks y claves futuras'].includes(label)?'_shared/request_body.ts':name+'/index.ts';
   if(!file.endsWith(target))return source;
   const after=change(source.replaceAll('\r\n','\n'));assert.notEqual(after,source.replaceAll('\r\n','\n'));applied=true;return after;
  }}));
 }catch(e){if(e.name!=='AssertionError')throw e;killed=true;}
 assert(applied&&killed,'mutación no detectada: '+label);console.log('KILLED '+label);
}
const config=fs.readFileSync('supabase/config.toml','utf8');
const jwtGuard=text=>assert.match(text,/\[functions\.delete-account\]\s*verify_jwt\s*=\s*true\b/);
jwtGuard(config);const mutant=config.replace(/(\[functions\.delete-account\]\s*verify_jwt\s*=\s*)true/,'$1false');
assert.notEqual(mutant,config);assert.throws(()=>jwtGuard(mutant),assert.AssertionError);
console.log('KILLED verify_jwt delete-account');
console.log('edge-input-reservas-mutations: 7/7 KILLED; topes literales además en edge-input-mutations');
