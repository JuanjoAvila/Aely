import {fixture,request,VALID,LIMITS} from './input_handlers.fixture.ts';
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const names=['bank-aspsps','bank-connect','bank-disconnect','bank-sync','bank-callback','categorize','delete-account'];
function effectsWithoutIP(e:Awaited<ReturnType<typeof fixture>>){return e.effects.filter(x=>!(x[0]==='rpc'&&String(x[1]).startsWith('bank-callback-ip:')));}
function callbackRequest(raw?:string|Uint8Array,app=false,options:any={}){
 const req=request('bank-callback',raw,options),url=new URL(req.url);if(app)url.searchParams.set('state','synthetic.app');return new Request(url,req);
}
async function closedCallback(r:Response,e:Awaited<ReturnType<typeof fixture>>,app=false){
 assert(r.status===302,'callback closed redirect:'+r.status);
 assert(r.headers.get('location')===(app?'https://synthetic.invalid/back.html?msg=error':'https://synthetic.invalid/?bank=error&msg=error'),'closed web/APK destination');
 assert(await r.text()==='','callback must not expose input/error JSON');
 assert(e.reads.length===0&&e.effects.length===1&&effectsWithoutIP(e).length===0,'only prelookup IP quota, no state/user/provider effects');
 assert(e.logs.length===0,'invalid input must not echo diagnostic/body');
}
for(const name of names)for(const kind of ['malformed','null','array','oversized-real','oversized-header'])Deno.test(name+' rejects '+kind+' before effects',async()=>{
 const e=await fixture(name),body=kind==='malformed'?'{':kind==='null'?'null':kind==='array'?'[]':kind==='oversized-real'?' '.repeat(LIMITS[name]+1)+JSON.stringify(VALID[name]):JSON.stringify(VALID[name]);
 const r=await e.handler(request(name,body,{headers:kind==='oversized-header'?{'content-length':String(LIMITS[name]+1)}:{}}));
 if(name==='bank-callback')await closedCallback(r,e);else assert(r.status===(kind.startsWith('oversized')?413:400),`status:${r.status}`);
 assert(effectsWithoutIP(e).length===0,'unexpected effects:'+JSON.stringify(e.effects));assert(e.reads.length===0,'read/auth before invalid-body rejection:'+JSON.stringify(e.reads));
 if(name==='bank-callback')assert(e.effects.length===1,'exactly one prelookup IP quota');
});
for(const kind of ['malformed','null','array','oversized-real','oversized-header'])Deno.test('callback APK rejects '+kind+' with closed302 before lookup',async()=>{
 const e=await fixture('bank-callback'),body=kind==='malformed'?'{':kind==='null'?'null':kind==='array'?'[]':kind==='oversized-real'?' '.repeat(LIMITS['bank-callback']+1)+'{}':'{}';
 await closedCallback(await e.handler(callbackRequest(body,true,{headers:kind==='oversized-header'?{'content-length':'1025'}:{}})),e,true);
});
Deno.test('callback invalid UTF8 uses closed web/APK302',async()=>{
 for(const app of [false,true]){const e=await fixture('bank-callback');await closedCallback(await e.handler(callbackRequest(new Uint8Array([0xff]),app)),e,app);}
});
Deno.test('callback oversized stream cancels before lookup and keeps closed web/APK302',async()=>{
 for(const app of [false,true]){
  const e=await fixture('bank-callback');let delivered=0,cancelled=false;
  const stream=new ReadableStream<Uint8Array>({pull(c){delivered+=256;c.enqueue(new Uint8Array(256).fill(32));},cancel(){cancelled=true;}});
  const req=new Request('https://synthetic.invalid/?code=synthetic&state=synthetic'+(app?'.app':''),{method:'POST',body:stream});
  await closedCallback(await e.handler(req),e,app);assert(cancelled&&delivered<=1536,'stream cancel/bound:'+JSON.stringify({cancelled,delivered}));
 }
});
Deno.test('callback exact byte limit and GET retain web/APK success',async()=>{
 for(const app of [false,true])for(const raw of [undefined,' '.repeat(1022)+'{}']){
  const e=await fixture('bank-callback'),r=await e.handler(callbackRequest(raw,app,raw===undefined?{method:'GET'}:{}));
  assert(r.status===302&&r.headers.get('location')===(app?'https://synthetic.invalid/back.html?ok=1':'https://synthetic.invalid/?bank=ok'),'valid callback redirect');
  assert(e.effects.some(x=>x[0]==='ebApi')&&e.effects.filter(x=>x[0]==='rpc').length===2,'valid route retains user quota and exchange');
 }
});
for(const name of names)Deno.test(name+' valid body preserves existing route',async()=>{
 const e=await fixture(name),r=await e.handler(request(name,JSON.stringify(VALID[name])));assert(r.status===(name==='bank-callback'?302:200),'valid body:'+r.status);
 assert(e.effects.length>0,'control must reach provider/quota/product');
});
for(const name of names.filter(n=>!['bank-aspsps','bank-callback'].includes(n)))Deno.test(name+' valid body unauthenticated remains401',async()=>{const e=await fixture(name,{authorized:false}),r=await e.handler(request(name,JSON.stringify(VALID[name])));assert(r.status===401&&e.effects.length===0,'auth must block effects');});
Deno.test('callback GET and valid expired state retain302',async()=>{
 for(const expiredState of [false,true]){const e=await fixture('bank-callback',{expiredState}),r=await e.handler(request('bank-callback',undefined,{method:'GET'}));assert(r.status===302,'OAuth302');if(expiredState){assert(!e.effects.some(x=>x[0]==='ebApi'||x[0]==='bank_links'),'expired state no exchange');assert(e.effects.filter(x=>x[0]==='rpc').length===1,'expired state no user quota');}}
});
Deno.test('callback IP rejection happens before parsing/lookup, same302',async()=>{const e=await fixture('bank-callback',{denyIP:true}),r=await e.handler(request('bank-callback','{'));assert(r.status===302,'IP denial302');assert(e.reads.length===0&&e.effects.length===1,'IP prelookup only');});
Deno.test('callback user rejection retains state and302',async()=>{const e=await fixture('bank-callback',{denyUser:true}),r=await e.handler(request('bank-callback','{}'));assert(r.status===302,'user denial302');assert(e.effects.length===2&&e.effects.every(x=>x[0]==='rpc'),'no state consume on user denial');});
Deno.test('byte cap counts UTF8 and cancels streaming before provider',async()=>{
 const raw=JSON.stringify({aspsp_name:'Synthetic',country:'ES',padding:'漢'.repeat(6000)}),e=await fixture('bank-connect');assert((await e.handler(request('bank-connect',raw))).status===413,'UTF8 cap');assert(e.effects.length===0,'UTF8 no effects');
 let delivered=0,cancelled=false;const bytes=new TextEncoder().encode(' '.repeat(131072)+JSON.stringify(VALID['bank-connect']));
 const stream=new ReadableStream<Uint8Array>({pull(c){if(delivered>=bytes.length){c.close();return;}const end=Math.min(delivered+4096,bytes.length);c.enqueue(bytes.slice(delivered,end));delivered=end;},cancel(){cancelled=true;}}),f=await fixture('bank-connect');
 const r=await f.handler(new Request('https://synthetic.invalid/',{method:'POST',body:stream}));assert(r.status===413&&cancelled&&delivered<=24576&&f.effects.length===0,'stream must stop:'+JSON.stringify({status:r.status,delivered,cancelled}));
});
Deno.test('config declares delete-account JWT explicitly',async()=>{const config=await Deno.readTextFile('supabase/config.toml');assert(/\[functions\.delete-account\]\s*verify_jwt\s*=\s*true/.test(config),'explicit JWT config missing');});
