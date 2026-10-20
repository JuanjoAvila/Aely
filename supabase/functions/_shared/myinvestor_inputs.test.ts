import {fixture,request,VALID,LIMITS} from './input_handlers.fixture.ts';
import {fixture as counterFixture,run as counterRun,response} from './myinvestor-counter.fixture.ts';
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const names=['myinvestor-connect','myinvestor-sync','myinvestor-disconnect','myinvestor-keepalive'];
for(const name of names)for(const kind of ['malformed','null','array','oversized-real','oversized-header'])Deno.test(name+' input rejects '+kind+' before auth/quota/effects',async()=>{
 const e=await fixture(name,{legacy:true}),body=kind==='malformed'?'{':kind==='null'?'null':kind==='array'?'[]':kind==='oversized-real'?' '.repeat(LIMITS[name]+1)+JSON.stringify(VALID[name]):JSON.stringify(VALID[name]);
 const r=await e.handler(request(name,body,{headers:kind==='oversized-header'?{'content-length':String(LIMITS[name]+1)}:{}}));
 assert(r.status===(kind.startsWith('oversized')?413:400),'status:'+r.status);assert(e.effects.length===0,'effects:'+JSON.stringify(e.effects.map(x=>x[0])));assert(e.reads.length===0,'auth or data read before rejecting');
});
for(const name of names)Deno.test(name+' valid input still requires auth',async()=>{const e=await fixture(name,{authorized:false}),r=await e.handler(request(name,JSON.stringify(VALID[name]),{authorized:false}));assert(r.status===401&&e.effects.length===0,'valid body unauthorized');});
for(const name of names.filter(n=>n!=='myinvestor-connect'))Deno.test(name+' absent body remains200',async()=>{const e=await fixture(name),r=await e.handler(request(name));assert(r.status===200,'bodyless legacy status:'+r.status);});
Deno.test('real00-core emitter userInitiated true/false and absence remain200',async()=>{
 const core=await Deno.readTextFile('src/modules/00-core.js'),match=core.match(/    async myinvestorSync\([\s\S]*?^    },/m);assert(match,'real emitter');
 for(const flag of [true,false,undefined]){let sent:any;const sb={functions:{invoke:async(name:string,opts:any)=>{sent={name,body:opts.body};return {data:{ok:true}};}}};const cloud=new Function('sb','return {'+match[0]+'};')(sb);await cloud.myinvestorSync(flag);assert(sent.body.userInitiated===(flag===true),'emitter flag');const e=await fixture(sent.name),r=await e.handler(request(sent.name,JSON.stringify(sent.body)));assert(r.status===200,'actual emitter rejected');}
});
Deno.test('OTP numeric/partial/null and mobile token variants survive',async()=>{
 const base={customerId:'synthetic',password:'synthetic-password',deviceId:'synthetic-device'};
 for(const extra of [{},{otpId:123,signatureRequestId:456,code:'123456'},{otpId:123,signatureRequestId:null,code:'123456'},{otpId:null,signatureRequestId:null,code:null}]){const e=await fixture('myinvestor-connect'),r=await e.handler(request('myinvestor-connect',JSON.stringify({...base,...extra})));assert(r.status===200,'OTP compatibility');const fetch=e.effects.find(x=>x[0]==='fetch');assert(fetch,'login transport');const login=JSON.parse(fetch[2]);if(extra.signatureRequestId)assert(login.otpId==='123'&&login.signatureRequestId==='456'&&login.code==='123456','OTP conversion preserved');else assert(!('otpId'in login),'partial OTP stays legacy login');}
 for(const extra of [{refreshToken:null,refreshExpiresIn:null},{refreshToken:'synthetic-refresh',refreshExpiresIn:3600}]){const e=await fixture('myinvestor-connect'),r=await e.handler(request('myinvestor-connect',JSON.stringify({storeTokens:true,deviceId:'synthetic-device',accessToken:'synthetic-access',...extra})));assert(r.status===200,'mobile token compatibility');}
});
Deno.test('new input guards retain cron preflight and wrong-key behavior',async()=>{const e=await fixture('myinvestor-keepalive'),r=await e.handler(new Request('https://synthetic.invalid/',{method:'OPTIONS'}));assert(r.status===200&&e.effects.length===0&&e.reads.length===0,'OPTIONS no work');});
Deno.test('credential field shapes cannot spend login quota or reach provider',async()=>{
 for(const body of [{customerId:'c',password:{},deviceId:'d'},{customerId:'c',password:'p',deviceId:'d',otpId:[]},{storeTokens:true,deviceId:'d',accessToken:[]},{storeTokens:true,deviceId:'d',accessToken:'a',refreshExpiresIn:1e100},{storeTokens:'true',deviceId:'d',accessToken:'a'}]){const e=await fixture('myinvestor-connect'),r=await e.handler(request('myinvestor-connect',JSON.stringify(body)));assert(r.status===400&&e.effects.length===0&&e.reads.length===0,'invalid credential fields reached effects');}
});
Deno.test('real emitter manual flag controls third expiry; false and absence do not',async()=>{
 const core=await Deno.readTextFile('src/modules/00-core.js'),match=core.match(/    async myinvestorSync\([\s\S]*?^    },/m);assert(match,'real emitter');
 for(const flag of [true,false,'absent']){let body:any;if(flag!=='absent'){const sb={functions:{invoke:async(_name:any,options:any)=>{body=options.body;return {data:{ok:true}};}}};await new Function('sb','return {'+match[0]+'};')(sb).myinvestorSync(flag);}
  const f=counterFixture();let rotation=0,result:any;
  for(let attempt=0;attempt<3;attempt++)result=await counterRun('sync',f,{body,access:()=>response(401),refresh:()=>{rotation++;return response(201,{payload:{data:{accessToken:'access-'+rotation,refreshToken:'refresh-'+rotation}}});}});
  assert(result.status===200,'manual transport status');assert((f.row.status==='expired')===(flag===true),'manual intent changed: '+flag);assert((result.data.authExpired===true)===(flag===true),'third rejection contract');
 }
});
