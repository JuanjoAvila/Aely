import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createLogicSandbox,extractPureLogicSource} from '../scripts/load-pure-logic.mjs';
export const owner='fixture-owner',id='550e8400-e29b-41d4-a716-446655440001',other='550e8400-e29b-41d4-a716-446655440002';
export const expense={id,source:'ob',ent:'trade_republic',possibleDup:true,category:'bares',date:'2026-10-12T10:00:00.000Z',amount:12,merchant:'Fixture'};
export function storage(){const data=new Map();return {data,get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
export function database(options={}){
 const rows=options.rows||[{id,user_id:owner,source:'ob:trade_republic#dup',cat:'bares',nota:null,nota_edit:false,no_card:false,fecha:expense.date,importe:12,comercio:'Fixture'}];
 const calls=[];let active=owner,updates=0,authCalls=0;
 const sb={auth:{async getSession(){authCalls++;if(options.auth)await options.auth(authCalls);return {data:{session:active?{user:{id:active}}:null}}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}},from(table){
  const filters=[];let patch=null,deleted=false,single=false,limit=Infinity;
  const q={select(){return this},update(v){patch=v;return this},delete(){deleted=true;return this},eq(k,v){filters.push([k,v]);return this},is(k,v){filters.push([k,v]);return this},limit(n){limit=n;return this},maybeSingle(){single=true;return this},then(resolve,reject){return Promise.resolve().then(async()=>{
   calls.push({table,filters:[...filters],patch,deleted});
   if(options.before)await options.before({rows,patch,deleted,calls});
   if(patch||deleted){updates++;if(options.beforeWrite)await options.beforeWrite(rows,updates);}
   if(options.error)throw Error('transport failed');
   const matches=r=>r.user_id===active&&filters.every(([k,v])=>k==='fecha'?Date.parse(r[k])===Date.parse(v):(r[k]??null)===v);
   if(!single&&!patch&&!deleted)return {data:rows.filter(matches).slice(0,limit).map(r=>({...r})),error:null};
   const index=rows.findIndex(matches);
   if(index<0||options.zeroAck&&(patch||deleted))return {data:null,error:null};
   let row={...rows[index]};
   if(patch&&options.unique){const next={...row,...patch};if(rows.some((r,i)=>i!==index&&['user_id','fecha','importe','comercio'].every(k=>r[k]===next[k])))return {data:null,error:{code:'23505'}};}
   if(patch){Object.assign(rows[index],patch);row={...rows[index]};}
   if(deleted)rows.splice(index,1);
   if(options.afterWrite&&(patch||deleted))await options.afterWrite(row);
   if(options.badAck&&(patch||deleted))row={...row,...options.badAck};
   return {data:row,error:null};
  }).then(resolve,reject)}};return q;
 }};
 return {sb,rows,calls,login(uid){active=uid},options};
}
export async function client(db=database(),saved=storage(),transform=s=>s){
 const c=createLogicSandbox();c.localStorage=saved;c.window.localStorage=saved;c.window.crypto=webcrypto;c.window.supabase={createClient:()=>db.sb};
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 vm.runInNewContext(transform(extractPureLogicSource(html))+'\nglobalThis.testCloud=cloud;',c);
 // En la app lo vincula el layout effect tras aceptar la sesión, nunca el transporte tardío.
 const session=c.testCloud.session.bind(c.testCloud);
 c.testCloud.session=async()=>c.mcExpenseSession(await session());
 await c.testCloud.session();
 return {c,cloud:c.testCloud,db,saved};
}
