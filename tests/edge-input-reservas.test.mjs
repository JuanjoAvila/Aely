import assert from 'node:assert/strict';
import {edgeFixture} from './helpers/edge-handler-fixture.mjs';
import {input} from './helpers/edge-input.mjs';
const base='c5f62d6603d016150afd9d0e20547b608b323045';
const login={customerId:'CLIENTE-SINTETICO',password:'synthetic',deviceId:'device-synthetic'};
const payment={texto:'Has pagado 9,95 € en Supermercado sintético',titulo:'Trade Republic',fecha:'1791792000000'};
const cases=[
 ['otp numérico','myinvestor-connect',{...login,otpId:123,signatureRequestId:456,code:'123456'}],
 ['otp nulo vuelve al login','myinvestor-connect',{...login,otpId:123,signatureRequestId:null,code:'123456'}],
 ['caducidad nula','myinvestor-connect',{storeTokens:true,deviceId:'device-synthetic',accessToken:'synthetic',refreshExpiresIn:null}],
 ['idioma futuro','help-assistant',{question:'Cómo apuntar un gasto',language:'fr'}],
 ['idioma nulo','help-assistant',{question:'Cómo apuntar un gasto',language:null}],
 ['texto vacío','ingest',{texto:''}],
 ['fuente desconocida','ingest',{...payment,fuente:'futura'}],
 ['fecha numérica','ingest',{...payment,fecha:1791792000000}],
 ['evento nulo','ingest',{...payment,evento:null}],
 ['disparo no interpretable','ingest',{...payment,fecha:undefined,triggertime:'no-fecha'}],
 ['bancos nulos','bank-sync',{aspsps:[null,'Banco sintético']}],
 ['nombre vacío','bank-connect',{aspsp_name:''}],
 ['símbolos nulos y numéricos','prices',{symbols:[null,123,'NVDA']}],
 ['prices no JSON','prices','{incompleto'],
];
const request=body=>new Request('https://synthetic.invalid/',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),headers:{Authorization:'Bearer synthetic','x-ingest-token':'synthetic'}});
const snap=async r=>({status:r.status,body:await r.text(),location:r.headers.get('location')});
let failed=0;
for(const [label,name,body] of cases){
 const a=edgeFixture(name,{base}),b=edgeFixture(name);
 try{
  const old=await snap(await a.handler(request(body))),current=await snap(await b.handler(request(body)));
  assert(old.status<400,'la base debe aceptar el cuerpo concreto');
  assert.deepEqual(current,old);assert.deepEqual(b.effects,a.effects);
  console.log('PASS '+label);
 }catch(e){failed++;console.error('FAIL '+label+': '+e.message);}
}
for(const raw of ['null','[]','42','"texto"'])assert.equal((await input.readInput(request(raw),'ingest')).status,400);
assert.equal((await input.readInput(request(' '.repeat(49153)),'ingest')).status,413);
const denied=edgeFixture('ingest',{authorized:false});
const bad=new Request('https://synthetic.invalid/',{method:'POST',body:'{','headers':{'x-ingest-token':'incorrect'}});
assert.equal((await denied.handler(bad)).status,403);
assert.equal(denied.effects[0][0],'rpc');assert(!denied.effects.some(x=>x[0]==='expenses'));
console.log('PASS guardas ingest objeto/tamaño y autenticación/cuota previas');
const expired=()=>edgeFixture('bank-callback',{callbackIssuedAt:'2026-10-12T10:00:00Z'});
const callbackRequest=()=>new Request('https://synthetic.invalid/?state=synthetic&code=synthetic',{method:'POST',body:'{'});
assert.equal((await expired().handler(callbackRequest())).status,302,'state caducado precede a cuerpo inválido');
const malformedOld=edgeFixture('ingest',{base}),malformed=edgeFixture('ingest');
assert.equal((await malformedOld.handler(request('{incompleto'))).status,200);
const malformedResponse=await malformed.handler(request('{incompleto'));
assert.equal(malformedResponse.status,200,'formato no reconocido se omite sin interpretar un formulario nuevo');
assert.equal((await malformedResponse.json()).skipped,true);
assert(!malformed.effects.some(x=>x[0]==='expenses'));
assert(malformed.effects.some(x=>x[0]==='app_events'));
console.log('edge-input-reservas: '+(cases.length-failed)+'/'+cases.length+' PASS');
// El status ya era 400: registrar también el cambio de texto evita prometer paridad total.
for(const [name,error] of [['bank-disconnect','falta aspsp_name'],['delete-account','confirma con tu contraseña'],['categorize','merchant'],['myinvestor-connect','faltan datos']]){
 const old=await edgeFixture(name,{base}).handler(request({})),current=await edgeFixture(name).handler(request({}));
 assert.equal(old.status,400);assert.equal(current.status,400);
 assert.deepEqual(await old.json(),{ok:false,error});
 assert.deepEqual(await current.json(),{ok:false,error:'cuerpo inválido'});
}
console.log('PASS cuatro cambios de texto documentados con el mismo 400');
if(failed)process.exitCode=1;
