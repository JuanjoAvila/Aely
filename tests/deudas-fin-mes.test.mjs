import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {createLogicSandbox} from '../scripts/load-pure-logic.mjs';
// Mes en el que dice que acaba una deuda (`endsLabel`, Plan › Deudas). Importes inventados.
const source=fs.readFileSync('src/modules/09-tab-debts-goals.js','utf8');
const order=JSON.parse(fs.readFileSync('src/build-order.json','utf8'));
const all=order.map(f=>fs.readFileSync('src/modules/'+f,'utf8')).join('\n');
const pure=all.slice(0,all.search(/\nclass ErrorBoundary\b/));
const ENDS=/const endsLabel=(function\(d\)\{[\s\S]*?\n  \};)/;
const endsSrc=source.match(ENDS)[1].slice(0,-1);
// El mutante es el cálculo de antes del arreglo: siempre mes actual + n, con la cuota de este mes pendiente o no.
const mutante=endsSrc.replace('li.n-(pendiente?1:0)','li.n');
assert.notEqual(mutante,endsSrc,'el mutante debe cambiar algo');
// Segundo mutante: sin la rama del ancla futura (compra a plazos sin empezar) sigue contando desde hoy.
const mutanteFutura=endsSrc.replace('futura?d.asOf+li.n-1-p.y*12:','');
assert.notEqual(mutanteFutura,endsSrc,'el mutante de ancla futura debe cambiar algo');

// Cada caso fija «hoy» (mediodía UTC: el mismo día en Madrid y en UTC) y una deuda que queda a `quedan` cuotas.
const ym=(y,m)=>y*12+(m-1);
function deuda(hoy,day,quedan,extra={}){
  // asOf tal que, contando la cuota de este mes solo si su día ya pasó, queden exactamente `quedan`.
  const [y,m,d]=hoy.split('-').map(Number), months=12;
  const dia=Math.min(day,new Date(y,m,0).getDate()), pagadaEsteMes=dia<=d?1:0;
  const pagadas=months-quedan, asOf=ym(y,m)-(pagadas-pagadaEsteMes);
  return {id:'x',name:'Financiación inventada',value:1200,monthly:100,months,day,asOf,...extra};
}
const casos=[
  {n:'cuota pendiente hoy+8 (29, hoy 21), queda 1: acaba este mes',hoy:'2026-11-21',day:29,quedan:1,esperado:'noviembre 2026'},
  {n:'cuota pendiente hoy+8, quedan 3: mes actual + 2',hoy:'2026-11-21',day:29,quedan:3,esperado:'enero 2027'},
  {n:'cuota ya pasada (día 3), queda 1: mes que viene',hoy:'2026-11-21',day:3,quedan:1,esperado:'diciembre 2026'},
  {n:'cuota ya pasada (día 1), quedan 4',hoy:'2026-11-21',day:1,quedan:4,esperado:'marzo 2027'},
  {n:'cuota justo hoy: ya cuenta como cobrada, queda 1',hoy:'2026-11-21',day:21,quedan:1,esperado:'diciembre 2026'},
  {n:'cambio de año: cuota pendiente en diciembre, quedan 2',hoy:'2026-12-21',day:29,quedan:2,esperado:'enero 2027'},
  {n:'cambio de año: cuota pendiente en diciembre, queda 1',hoy:'2026-12-21',day:29,quedan:1,esperado:'diciembre 2026'},
  {n:'día 31 en mes de 30, hoy 29: el cobro cae el 30, aún pendiente',hoy:'2026-11-29',day:31,quedan:1,esperado:'noviembre 2026'},
  {n:'día 31 en mes de 30, hoy 30: el cobro del 30 ya cuenta',hoy:'2026-11-30',day:31,quedan:1,esperado:'diciembre 2026'},
  {n:'ancla futura el mes que viene (dic 2026), 12 cuotas: ancla + 11',hoy:'2026-11-21',day:5,ancla:[2026,12],esperado:'noviembre 2027'},
  {n:'ancla futura en 2 meses (ene 2027, cambio de año), 12 cuotas',hoy:'2026-11-21',day:5,ancla:[2027,1],esperado:'diciembre 2027'},
  {n:'ancla futura, cuota pendiente el día 29: tampoco depende de hoy',hoy:'2026-11-21',day:29,ancla:[2027,2],esperado:'enero 2028'},
  {n:'ancla futura con día 31 hacia mes corto (feb 2027)',hoy:'2026-11-21',day:31,ancla:[2027,2],esperado:'enero 2028'},
  {n:'sin plazo, cuota pendiente: no cambia (saldo 1000, 100/mes = 10 cuotas)',hoy:'2026-11-21',day:29,sinPlazo:true,esperado:'septiembre 2027'},
  {n:'sin plazo, cuota pasada: misma fecha',hoy:'2026-11-21',day:3,sinPlazo:true,esperado:'septiembre 2027'}
];
function etiquetas(endsFn){
  return casos.map(c=>{
    const epoch=Date.parse(c.hoy+'T12:00:00Z');
    class Clock extends Date{constructor(...a){super(...(a.length?a:[epoch]));}static now(){return epoch;}}
    const ctx=createLogicSandbox({Date:Clock});vm.createContext(ctx);vm.runInContext(pure,ctx);
    vm.runInContext('CURLANG="es";globalThis.leftInfo=debtLeftInfo;globalThis.subject='+endsFn,ctx);
    const [y,m]=c.hoy.split('-').map(Number);
    const d=c.ancla?{id:'x',name:'Compra a plazos inventada',value:1200,monthly:100,months:12,day:c.day,asOf:ym(c.ancla[0],c.ancla[1])}:c.sinPlazo?{id:'x',name:'Préstamo inventado',value:1000,monthly:100,day:c.day,asOf:ym(y,m)}:deuda(c.hoy,c.day,c.quedan);
    const antes=vm.runInContext('(function(d){return [debtLeft(d),debtBalance(d),debtCuotaIn(d)]})',ctx)(d);
    const txt=ctx.subject(d);
    // Solo cambia el texto de la fecha: contador, saldo y cuota salen igual.
    assert.deepEqual(vm.runInContext('(function(d){return [debtLeft(d),debtBalance(d),debtCuotaIn(d)]})',ctx)(d),antes);
    if(c.ancla) assert.equal(antes[0],12,c.n+': nada pagado aún');
    else if(!c.sinPlazo) assert.equal(antes[0],c.quedan,c.n+': el contador de cuotas es el esperado');
    return txt;
  });
}
for(const tz of [undefined,'UTC','America/Los_Angeles','Asia/Tokyo'])test('fecha de fin de deuda con plazo, TZ '+(tz||'local'),()=>{
  const previous=process.env.TZ;if(tz)process.env.TZ=tz;
  try{
    const out=etiquetas(endsSrc);
    casos.forEach((c,i)=>assert.equal(out[i],'acabas en '+c.esperado,c.n));
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('el mutante (mes actual + n siempre) lo caza el test',()=>{
  const out=etiquetas(mutante);
  const fallan=casos.filter((c,i)=>out[i]!=='acabas en '+c.esperado).map(c=>c.n);
  assert.ok(fallan.length>=3,'el mutante tiene que romper los casos de cuota pendiente: '+fallan.length);
  assert.ok(fallan.every(n=>!/ya pasada|justo hoy|sin plazo|ya cuenta|ancla futura/.test(n)),'solo rompe los de cuota pendiente: '+fallan.join(' | '));
});
test('el mutante de ancla futura (contar desde hoy) lo caza el test',()=>{
  const out=etiquetas(mutanteFutura);
  const fallan=casos.filter((c,i)=>out[i]!=='acabas en '+c.esperado).map(c=>c.n);
  assert.equal(fallan.length,3,'rompe las tres anclas a 2+ meses: '+fallan.join(' | '));
  assert.ok(fallan.every(n=>/ancla futura/.test(n)));
});
