import assert from "node:assert/strict";
import vm from "node:vm";
import { E, SYNC, main, baseDatos, enlace, haceDias, FakeDate, day, MS, DAY, reloj, read, ts } from "./banco-sintetico.mjs";
import { loadPureLogicFromFile } from "../../scripts/load-pure-logic.mjs";

// Se comparte la respuesta del handler, no una imitación de sus flags para el DOM.
export const ctx=loadPureLogicFromFile();
const moduleUrl=code=>"data:text/javascript;base64,"+Buffer.from(ts(code)).toString("base64");
const cryptoUrl=moduleUrl(read("supabase/functions/_shared/crypto.ts"));
const token=await import(moduleUrl(read("supabase/functions/_shared/token_store.ts").replace('"./crypto.ts"',JSON.stringify(cryptoUrl))));
const tx=(id="new")=>({entry_reference:id,booking_date:day(-1),transaction_amount:{amount:"12.50"},credit_debit_indicator:"DBIT",status:"BOOK"});
export async function sync(reply,{acks=true,balanceError=null,ageDays=5,rows=null,acksValue={}}={}){
  const row=rows?rows[0]:enlace(haceDias(ageDays)),before=row.last_sync,events=[];let handler,calls=0;
  const db=baseDatos(rows||[row]),from=db.from;
  db.from=name=>name==="app_events"?{insert:async event=>{events.push(event);return {};}}:from(name);
  const api=async(jwt,path,init)=>{
    if(path.endsWith("/balances")){if(balanceError)throw Error(balanceError);return {balances:[{balance_type:"ITAV",balance_amount:{amount:"100",currency:"EUR"}}]};}
    calls++;return reply(new URL(path,"https://bank.invalid"),calls,init);
  };
  new Function("Deno","createClient","ebApi","ebConfig","jsonResp","makeJWT","mapTransaction","withCors","fetchBankTransactions","Date","ebFailure","ebSessionVerdict","decryptSessionId",SYNC)(
    {serve:fn=>handler=fn,env:{get:()=>"synthetic"}},()=>db,api,()=>({}),
    (body,status=200)=>new Response(JSON.stringify(body),{status}),async()=>"synthetic",E.mapTransaction,fn=>fn,E.fetchBankTransactions,FakeDate,E.ebFailure,E.ebSessionVerdict,token.decryptSessionId
  );
  const response=await handler(new Request("https://app.invalid",{method:"POST",body:JSON.stringify(acks?{recoverGaps:true,acks:acksValue}:{})}));
  assert.equal(response.status,200);
  return {data:await response.json(),row,before,events,calls};
}
export const old={ent:"caixabank",id:"old",date:day(-2),amount:7,merchant:"Antes",status:"BOOK",extra:"conservar"};
export function updater(source,links,overrides={},logic=ctx,commit=false){
  const start=source.indexOf("      set(function(prev){",source.indexOf("obAckPend.current=")),end=source.indexOf("      // sube las importadas",start);
  assert.ok(start>=0&&end>start);
  const names=["flattenBankTx","importObExpenses","applyInvestBuy","cuotasDeDeudaPorMarcar","gemelosDeImportacion","pushGemelos","reconcileGemelosAutomaticos","enrichNotesFromBankTx","tagObAccountsFromBankTx","reconcileFixedPaymentProofs","reconcileEarlyIncomeAnchors","applyBankBalances","bankIssuesOf"];
  const proof=[];
  let state={accounts:[{id:"cx",ent:"caixabank",value:100,role:"diario"}],investments:[],fixed:[],oneoffs:[],flows:[],debts:[],goals:[],assets:[],obAccounts:[],settings:{expenseBanks:["caixabank"]},bankTx:[old],deleted:["lapida-sintetica"],gemelos:[{id:"gemelo-previo",status:"kept"}],expenses:[{id:"guardado",extId:"old",source:"ob",ent:"caixabank",date:day(-2),amount:7,merchant:"Antes",category:"otros",reciboId:"marca-previa"}]};
  state=Object.assign(state,overrides);
  let set=fn=>state=fn(state);
  if(commit){
    // El commit real vuelve a reconciliar con prev: omitirlo escondía cambios de estado
    // que la app sí persiste, aunque el updater del banco ya hubiera terminado.
    const a=source.indexOf('  const set=useCallback((updater)=>'),b=source.indexOf('  // En el propio commit',a);
    assert.ok(a>=0&&b>a);
    set=new Function('useCallback','setStateRaw','reconcileGemelosAutomaticos','Date',source.slice(a,b)+'return set;')(
      fn=>fn,fn=>state=fn(state),logic.reconcileGemelosAutomaticos,FakeDate);
  }
  const args=names.map(name=>name==="reconcileFixedPaymentProofs"?(s,...a)=>{proof.push(s.bankTx);return logic[name](s,...a);}:logic[name]);
  new Function("set","links","dbLinks","DEUDA_CAT","Date","at",...names,"let obAdded=[];"+source.slice(start,end))(
    set,links,[{aspsp_name:"CaixaBank",status:"active"}],vm.runInContext("DEUDA_CAT",logic),FakeDate,FakeDate.now(),...args
  );
  return {state,proof};
}

export async function scenario(mode,{now=MS}={}){
  const original=reloj.ms;reloj.ms=now;
  const date=n=>new Date(now+n*DAY).toISOString().slice(0,10);
  const item=(i,extra={})=>Object.assign({entry_reference:"id"+i,booking_date:date(-1),transaction_amount:{amount:(1+i/100).toFixed(2)},credit_debit_indicator:"DBIT",status:"BOOK",creditor:{name:"Compra sintética "+i}},extra);
  const rows=[enlace(new Date(now-(mode==="pending"||mode==="pending_saturated"||mode==="sealed_prefix"?45:5)*DAY).toISOString())];
  const reply=(url,n)=>{
    if(mode==="provider_error"&&n>1)throw Error("EB 503 synthetic-private");
    if(mode==="time_limit")throw Error("transactions_timeout");
    if(mode==="sealed_prefix"&&n>2)throw Error("EB 503 synthetic-private");
    if(mode==="pending_saturated"){
      if(n===1)return {transactions:[item(n)]};
      const from=url.searchParams.get("date_from"), oldFrom=rows[0].last_sync.slice(0,10);
      const parts=String(url.searchParams.get("continuation_key")||(from===oldFrom?"4:0":from<oldFrom?"1:0":"6:0")).split(":").map(Number);
      return {transactions:[item(n,{entry_reference:null,booking_date:from})],...(parts[1]+1<parts[0]?{continuation_key:parts[0]+":"+(parts[1]+1)}:{})};
    }
    if(mode==="pending"||mode==="sealed_prefix"){
      const at=Number(url.searchParams.get("continuation_key")||0);
      return {transactions:[item(n,{entry_reference:n>1?null:"recent",booking_date:n>1?url.searchParams.get("date_from"):date(-1)})],...(mode==="pending"&&n>1&&at<2?{continuation_key:String(at+1)}:{})};
    }
    if(mode==="complete100")return {transactions:Array.from({length:100},(_,i)=>item(i))};
    if(mode==="row_limit")return {transactions:Array.from({length:2001},(_,i)=>item(i,{entry_reference:null}))};
    if(mode==="page_limit"){
      const start=Number(url.searchParams.get("continuation_key")||0),list=Array.from({length:84},(_,i)=>item(i,{entry_reference:null}));
      return {transactions:list.slice(start,start+5),...(start+5<list.length?{continuation_key:String(start+5)}:{})};
    }
    return {transactions:[item(n)],continuation_key:mode==="repeated_cursor"?"loop":String(n)};
  };
  try{return Object.assign(await sync(reply,{rows}),{clock:now,reply,rows});}finally{reloj.ms=original;}
}
