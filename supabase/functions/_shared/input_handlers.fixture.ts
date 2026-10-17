// Ejecuta los handlers TypeScript actuales. Solo SDK, proveedor y cifrado son dobles.
// Sin allow-net/allow-env: cualquier escape del arnés es un fallo de permisos, nunca tráfico.
import path from 'node:path';
const contexts = new Map<string, any>();
(globalThis as any).__sec01Contexts = contexts;
let serial=0;
export const LIMITS: Record<string,number> = {
 'bank-aspsps':16384,'bank-connect':16384,'bank-disconnect':16384,'bank-sync':32768,
 'bank-callback':1024,'categorize':8192,'delete-account':65536,
};
export const VALID: Record<string,unknown> = {
 'bank-aspsps':{country:'ES'},'bank-connect':{aspsp_name:'Synthetic',country:'ES'},
 'bank-disconnect':{aspsp_name:'Synthetic'},'bank-sync':{},'bank-callback':{},
 categorize:{merchant:'zqxv synthetic'},'delete-account':{password:'synthetic-password'},
};
export async function fixture(name:string,{authorized=true,expiredState=false,mutate=null,denyIP=false,denyUser=false}:any={}) {
 const snapshot={sha:'current-working-tree'};
 const effects:any[]=[],reads:any[]=[],logs:any[]=[];let handler:any;
 const env:Record<string,string>={APP_URL:'https://synthetic.invalid/',SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',OPENAI_API_KEY:'synthetic',AELY_HELP_AI_ENABLED:'true'};
 const bankLink={id:'synthetic-link',user_id:'synthetic',aspsp_name:'Synthetic',session_id:'synthetic-session',state_issued_at:new Date(Date.now()-(expiredState?3600000:1000)).toISOString(),status:'active',accounts:[]};
 const db:any={auth:{getUser:async()=>{reads.push('auth');return {data:{user:authorized?{id:'synthetic',email:'synthetic@example.invalid'}:null},error:null};},signInWithPassword:async()=>{effects.push(['reauth']);return {error:null};},admin:{deleteUser:async()=>{effects.push(['deleteUser']);return {error:null};}}},rpc:async(n:string,p:any)=>{effects.push(['rpc',p.p_bucket]);return {data:!(denyIP&&p.p_bucket.startsWith('bank-callback-ip:')||denyUser&&!p.p_bucket.startsWith('bank-callback-ip:')),error:null};},from(table:string){
  let operation='select',payload:any;
  const q:any={select(){return q;},eq(){return q;},in(){return q;},is(){return q;},gte(){return q;},lte(){return q;},lt(){return q;},limit(){return q;},range(){return q;},order(){return q;},insert(p:any){operation='insert';payload=p;return q;},upsert(p:any){operation='upsert';payload=p;return q;},update(p:any){operation='update';payload=p;return q;},delete(){operation='delete';return q;},maybeSingle(){return execute(true);},single(){return execute(true);},then(ok:any,fail:any){return execute(false).then(ok,fail);}};
  async function execute(single:boolean){
   if(operation!=='select'){effects.push([table,operation,payload]);return {data:single?{user_id:'synthetic'}:[{id:'synthetic-link'}],error:null};}
   reads.push(table);
   if(table==='bank_links')return {data:name==='bank-callback'||name==='bank-disconnect'?bankLink:[],error:null};
   return {data:single?null:[],error:null,count:0};
  }return q;
 }};
 const json=(body:any)=>new Response(JSON.stringify(body),{status:200});
 const fakeFetch=async(url:any,init:any)=>{effects.push(['fetch',String(url)]);
  if(String(url).startsWith('https://api.openai.com/'))return json({choices:[{message:{content:'{"category":"otros"}'}}]});
  throw Error('Unexpected mocked fetch');
 };
 const eb:any={jsonResp:(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}),ebConfig:()=>({}),makeJWT:async()=>'synthetic-jwt',ebFailure:()=>({status:0,code:'SIN_CODIGO'}),ebSessionVerdict:()=>({}),mapTransaction:(x:any)=>x,fetchBankTransactions:async()=>{effects.push(['ebTransactions']);return {transactions:[],complete:true};},ebApi:async(_:any,route:string)=>{effects.push(['ebApi',route]);if(route==='/auth')return {url:'https://bank.invalid/synthetic'};if(route.startsWith('/aspsps'))return {aspsps:[{name:'Synthetic',country:'ES'}]};if(route==='/sessions')return {session_id:'synthetic-session',accounts:[{uid:'synthetic-account'}]};return {};}};
 const tokenStore:any={encryptSessionId:async()=>'synthetic-encrypted',decryptSessionId:async()=>'synthetic-session'};
 const id=String(++serial),context={db,eb,tokenStore,fetch:fakeFetch,console:{error:(...x:any[])=>logs.push(x),log:(...x:any[])=>logs.push(x)},deno:{env:{get:(k:string)=>env[k]},serve:(f:any)=>{handler=f;}}};contexts.set(id,context);
 const prelude=`const ctx=(globalThis as any).__sec01Contexts.get('${id}'); const Deno=ctx.deno, fetch=ctx.fetch, console=ctx.console;\n`;
 const cache=new Map<string,string>();
 function load(file:string):string {
  if(cache.has(file))return cache.get(file)!;
  let source:string;
  if(file==='sdk')source='export const createClient=(..._args:any[])=>ctx.db;';
  else if(file.endsWith('/token_store.ts'))source=Object.keys(tokenStore).map(k=>`export const ${k}=ctx.tokenStore.${k};`).join('\n');
  else if(file.endsWith('/enablebanking.ts'))source=Object.keys(eb).map(k=>`export const ${k}=ctx.eb.${k};`).join('\n');
  else {
   source=Deno.readTextFileSync(file);if(mutate)source=mutate(file,source);
   source=source.replace(/\bfrom\s+(["'])([^"']+)\1/g,(_all:string,_q:string,ref:string)=>{
    const next=ref.startsWith('https://esm.sh/@supabase/supabase-js')?'sdk':ref.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)):null;
    if(!next)throw Error('Unexpected import '+ref);
    return 'from "'+load(next)+'"';
   });
  }
  const url='data:application/typescript;base64,'+btoa(unescape(encodeURIComponent(prelude+source)));cache.set(file,url);return url;
 }
 await import(load('supabase/functions/'+name+'/index.ts'));
 if(!handler)throw Error('Handler not registered');
 return {handler,effects,reads,logs,sha:snapshot.sha};
}
export function request(name:string,raw?:string|Uint8Array,options:any={}){
 const headers:any={Authorization:'Bearer synthetic','x-cron-key':options.authorized===false?'wrong':'synthetic',...options.headers};
 return new Request('https://synthetic.invalid/?code=synthetic&state=synthetic',{method:options.method||'POST',headers,...(raw===undefined?{}:{body:typeof raw==='string'?raw:new Uint8Array(raw).buffer})});
}
