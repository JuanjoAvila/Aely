import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {createLogicSandbox,extractPureLogicSource} from '../scripts/load-pure-logic.mjs';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const bank=read('src/modules/08-motor-bank.js'),main=read('src/modules/11-app-main.js');
// La cualificación privada puede cargar los dos blobs de la base exacta. El guardián
// normal contrasta además con el recorrido completo del mismo motor financiero.
const oracleBank=process.env.GEMELOS_BASE_BANK?fs.readFileSync(process.env.GEMELOS_BASE_BANK,'utf8'):bank.replace('const incremental=!prior&&gemeloTrabajo(s,prev,baseExpenses);','const incremental=null;');
const oracleMain=process.env.GEMELOS_BASE_MAIN?fs.readFileSync(process.env.GEMELOS_BASE_MAIN,'utf8'):main;
const now=Date.parse('2026-10-30T12:00:00Z'),plain=x=>JSON.parse(JSON.stringify(x));
function load(b=bank,m=main){
  const order=JSON.parse(read('src/build-order.json'));
  const script=order.map(p=>p==='08-motor-bank.js'?b:read('src/modules/'+p)).join('\n');
  const shell=read('src/shell.html').split('<!--MC_APP_SCRIPT-->');assert.equal(shell.length,2);
  const c=createLogicSandbox({Date:class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}});
  let serial=0;c.window.crypto={randomUUID:()=> '00000000-0000-4000-8000-'+String(++serial).padStart(12,'0')};
  c.__work=0;vm.createContext(c);
  const source=extractPureLogicSource(shell[0]+script+shell[1]).replace('function gemeloAsignar(bancos,avisos,ventana){','function gemeloAsignar(bancos,avisos,ventana){globalThis.__work+=bancos.length+avisos.length;');
  vm.runInContext(source,c);vm.runInContext('USER_OVERRIDES={};USER_CAT_RULES={};',c);
  const start=m.lastIndexOf('      set(function(prev){',m.indexOf('const add=importObExpenses'));
  // Se ejecuta el updater REAL, incluida la marca de inversión/deuda y sus lectores.
  const end=m.indexOf('      // sube las importadas',start);assert.ok(start>=0&&end>start);
  c.sync=vm.runInContext('(function(seed,links){var result,obAdded=[],dbLinks=[],at=Date.now();var set=function(fn){result=fn(seed);};'+m.slice(start,end)+'return {state:result,add:obAdded};})',c);
  c.resetIds=()=>{serial=0;};return c;
}
function state(expenses=[]){return {accounts:[{id:'tr',ent:'trade_republic',role:'diario',spendFrom:true,value:1000}],settings:{expenseBanks:['trade_republic','sabadell']},expenses,gemelos:[],deleted:[],fixed:[],debts:[],oneoffs:[],flows:[],goals:[],investments:[],bankTx:[],reservaLog:[],budget:1000};}
function notice(id,amount=12,extra={}){return {id,date:'2026-10-28T08:00:00Z',amount,merchant:'Compra '+id,category:amount<0?'ingreso':'otros',source:'macrodroid',ent:'trade_republic',...extra};}
function row(id,amount=12,extra={}){return notice(id,amount,{source:'ob',merchant:'Movimiento',obName:'Movimiento',gemeloNuevo:true,...extra});}
const tx=(amount=12,extra={})=>({date:'2026-10-28',amount,merchant:'Movimiento',ent:'trade_republic',status:'BOOK',...extra});
const links=transactions=>[{aspsp:'Trade Republic',ok:true,syncFrom:'2026-01-01',transactions}];
const large=n=>state(Array.from({length:n},(_,i)=>i%2?notice('a'+i,1+Math.floor(i/2)/100):row('b'+i,1+Math.floor(i/2)/100)));
function pair(){return [load(oracleBank,oracleMain),load()];}
function equal(a,b,message){assert.equal(JSON.stringify(b),JSON.stringify(a),message);}
function frozen(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(frozen);Object.freeze(x);}return x;}

test('entrada fría repetida: JSON completo, parejas antiguas y grupos afectados por altas',()=>{
  const cs=pair(),ss=cs.map(()=>frozen(large(4000))),first=[],second=[];
  for(let pass=0;pass<2;pass++){
    const out=cs.map((c,i)=>{c.__work=0;const before=JSON.stringify(ss[i]);const add=[row('new',1)];const result=c.reconcileGemelosAutomaticos({...ss[i],expenses:add.concat(ss[i].expenses)},ss[i]);assert.equal(JSON.stringify(ss[i]),before);(pass?second:first).push(c.__work);return result;});
    equal(...out,'hasta los emparejados antiguos se conservan');assert.ok(out[1].expenses.filter(e=>e.autoGemelo).length>1000);
  }
  assert.ok(second[1]<first[1]/20,'el segundo frío no vuelve a asignar los grupos intactos');
  assert.ok(second[1]<second[0]/20,'el guardián distingue el recorrido completo');
});

test('altas sucesivas: importador y updater reales frente al oráculo, sin mutar entradas',()=>{
  const cs=pair();let ss=cs.map(()=>state([notice('a'),notice('neg',-5),notice('manual',8,{source:'manual'}),notice('goal',20,{goalId:'g'})]));
  for(const txs of [[tx(),tx(8)],[tx(),tx(),tx(-5)],[tx(20),tx(6,{id:'ref',acc:'account-a'})]]){
    const outputs=cs.map((c,i)=>{const before=JSON.stringify(ss[i]);const out=c.sync(ss[i],links(plain(txs)));assert.equal(JSON.stringify(ss[i]),before,'el updater no muta el estado de partida');return out;});
    equal(...outputs,'JSON entero del updater, incluidas altas y vínculos');ss=outputs.map(o=>o.state);
  }
});

test('invalidaciones: decisiones legacy/crossbank, multiplicidad, cambios y borrados',()=>{
  for(let variant=0;variant<9;variant++){
    const cs=pair(),ss=cs.map(c=>{
      const a=notice('a'),b=row('b'),other=notice('other',12,{ent:'sabadell',merchant:a.merchant,date:a.date});
      const s=state([a,b,other]);
      if(variant===0)s.gemelos=[{aviso:c.gemeloAvisoKey(a),banco:c.keyOfExpense(b),ent:'trade_republic'}];
      if(variant===1)s.gemelos=[{avisoId:'other',aviso:c.gemeloAvisoKey(other),banco:c.keyOfExpense(b),ent:'trade_republic',separado:true}];
      if(variant===2)s.expenses.push({...a,amount:15});
      if(variant===3)s.deleted=[c.keyOfExpense(b)];
      return s;
    });
    for(let pass=0;pass<2;pass++){
      const outputs=cs.map((c,i)=>{
        let s=ss[i];
        if(pass&&variant===4)s={...s,expenses:s.expenses.slice(1)};
        if(pass&&variant===5)s={...s,expenses:s.expenses.map(e=>e.id==='a'?{...e,amount:13}:e)};
        if(pass&&variant===6)s={...s,expenses:s.expenses.slice().reverse()};
        if(pass&&variant===7)s={...s,gemelos:[{...c.gemeloDe(s.expenses[0],s.expenses[1]),separado:true}]};
        if(pass&&variant===8)s={...s,obAbsorbedPending:[],obAbsorbedConfirmed:[],_historyOwner:'changed'};
        const before=JSON.stringify(s),out=c.reconcileGemelosAutomaticos({...s,expenses:[row('add',7)].concat(s.expenses)},s);assert.equal(JSON.stringify(s),before);return out;
      });equal(...outputs,'variante '+variant+' pasada '+pass);
    }
  }
});

test('el índice del sync no introduce prev ni omite altas mutadas antes de reconciliar',()=>{
  const cs=pair(),ss=cs.map(()=>state([notice('a'),row('old',15),notice('old-a',15)]));
  for(let pass=0;pass<2;pass++){
    const out=cs.map((c,i)=>{
      const add=c.importObExpenses(ss[i],[tx()],[{aspsp:'Trade Republic',syncFrom:'2026-01-01'}]);
      add[0].debtId='debt';add[0].category='deuda';
      const seed={...ss[i],expenses:add.concat(ss[i].expenses)};
      return c.reconcileGemelosAutomaticos(seed,undefined,ss[i].expenses);
    });equal(...out,'la mutación del alta se observa en ambos recorridos');
  }
});

test('una edición en sitio conserva notas, campos desconocidos y marcas del input frío',()=>{
  for(const edit of [b=>{b.note='nota nueva';b.extra={custom:7};},b=>{b.goalId='goal';},b=>{b.category='ingreso';},b=>{delete b.merchant;b.merchant='renombrado';}]){
    const cs=pair(),ss=cs.map(()=>state([notice('a'),row('b'),notice('other',30)]));
    cs.forEach((c,i)=>c.reconcileGemelosAutomaticos({...ss[i],expenses:[row('new',500)].concat(ss[i].expenses)},ss[i]));
    ss.forEach(s=>edit(s.expenses[1]));
    const out=cs.map((c,i)=>c.reconcileGemelosAutomaticos({...ss[i],expenses:[row('next',500)].concat(ss[i].expenses)},ss[i]));
    equal(...out,'la respuesta antigua no puede pisar una edición de la fila');
  }
  const unsafe=bank.replace(/if\(entry&&entry\.rows\.length===rows\.length&&rows\.every\(function\(e,i\)\{[\s\S]*?\}\)\)return entry;/,'if(entry&&entry.rows.length===rows.length&&rows.every(function(e,i){return e===entry.rows[i];}))return entry;');
  assert.notEqual(unsafe,bank,'mutante sin snapshots');
  const edited=c=>{const s=state([notice('a'),row('b')]);c.reconcileGemelosAutomaticos({...s,expenses:[row('new',500)].concat(s.expenses)},s);s.expenses[1].note='no perder';return c.reconcileGemelosAutomaticos({...s,expenses:[row('next',500)].concat(s.expenses)},s);};
  assert.notEqual(JSON.stringify(edited(load(unsafe))),JSON.stringify(edited(load(oracleBank,oracleMain))),'el guardián detecta el fallo anterior a la corrección');
});

test('sync real con 20k filas: JSON completo frío y tres altas sucesivas aplicadas',()=>{
  const cs=pair();let ss=cs.map(()=>large(20000));const timings=[[],[]];
  for(let step=0;step<4;step++){
    const txs=Array.from({length:step+1},(_,j)=>tx(1+j/100));
    const out=cs.map((c,i)=>{const before=JSON.stringify(ss[i]),start=performance.now();const result=c.sync(ss[i],links(plain(txs)));timings[i].push(performance.now()-start);assert.equal(JSON.stringify(ss[i]),before);return result;});
    equal(...out,'sync completo de 20k paso '+step);ss=out.map(o=>o.state);
  }
  console.log(JSON.stringify({gemelosSyncAB:{rows:20000,base:timings[0],candidate:timings[1]}}));
});

test('el seed del sync usa las filas actuales después de una edición de metadatos con prev',()=>{
  const cs=pair();
  const out=cs.map(c=>{
    const s=c.reconcileGemelosAutomaticos(state([notice('a'),row('b')]));
    const edited=c.reconcileGemelosAutomaticos({...s,expenses:[row('new',500)].concat(s.expenses.map(e=>e.id==='b'?{...e,note:'edición conservada',custom:'extra'}:e))},s);
    return c.reconcileGemelosAutomaticos({...edited,expenses:[row('next',600)].concat(edited.expenses)},undefined,edited.expenses);
  });equal(...out,'el índice del marcador antiguo no puede restaurar una fila anterior');
});

test('PDNG/BOOK, cuentas, signos y marcas financieras conservan el resultado entero',()=>{
  const cs=pair();let ss=cs.map(()=>state([notice('a'),notice('refund',-12),notice('manual',9,{source:'manual',category:'ingreso'}),notice('fixed',7,{reciboId:'f'}),notice('debt',6,{debtId:'d'}),notice('goal',5,{goalId:'g'})]));
  const batches=[
    [tx(12,{id:'pending',acc:'account-a',status:'PDNG'})],
    [tx(12,{id:'booked',acc:'account-a',status:'BOOK'}),tx(-12,{id:'refund',acc:'account-a'})],
    [tx(12,{id:'booked',acc:'account-a'}),tx(12,{id:'second',acc:'account-b'}),tx(9),tx(7),tx(6),tx(5)]
  ];
  for(const batch of batches){const out=cs.map((c,i)=>c.sync(ss[i],links(plain(batch))));equal(...out);ss=out.map(o=>o.state);}
});

test('mutantes: saltar respuestas antiguas o declarar resuelto el input rompe el diferencial',()=>{
  const exercise=c=>{const s=large(300);c.reconcileGemelosAutomaticos({...s,expenses:[row('add',500)].concat(s.expenses)},s);return c.reconcileGemelosAutomaticos({...s,expenses:[row('add2',1)].concat(s.expenses)},s);};
  const expected=JSON.stringify(exercise(load(oracleBank,oracleMain)));
  assert.equal(JSON.stringify(exercise(load())),expected);
  const mutants=[
    ['sin-respuestas','if(incremental&&incremental.reused.size){','if(false){'],
    ['altas-no-sucias','if(!added.has(k)&&original===group&&(saved||settled))','if(original&&(saved||settled))']
  ];
  for(const [id,from,to]of mutants){assert.ok(bank.includes(from));assert.notEqual(JSON.stringify(exercise(load(bank.replace(from,to)))),expected,id);}
  const marker=bank.replace('if(!unique)return null;','if(!unique)return null;gemeloCache.set(anchor,Object.assign(gemeloContexto(s),{index:entry.index}));');
  const wrong=load(marker),control=load(oracleBank,oracleMain),inputs=[large(300),large(300)];
  wrong.reconcileGemelosAutomaticos({...inputs[0],expenses:[row('x',500)].concat(inputs[0].expenses)},inputs[0]);
  assert.notEqual(JSON.stringify(wrong.reconcileGemelosAutomaticos(inputs[0])),JSON.stringify(control.reconcileGemelosAutomaticos(inputs[1])),'un índice crudo no es un estado reconciliado');
});

test('A/B intercalado: 20k filas, frío y reutilización del mismo estado sin aplicar altas',()=>{
  const cs=pair(),samples=[[],[]],cold=[[],[]];
  for(let pass=0;pass<5;pass++)for(const i of pass%2?[1,0]:[0,1]){
    const c=cs[i],s=state(Array.from({length:20000},(_,j)=>{
      const date=new Date(now-((j%400)+3)*86400000).toISOString();
      return j%3===0?notice('a'+j,1+j%50,{date}):row('b'+j,1+j%53,{date,gemeloNuevo:undefined});
    }));c.resetIds();
    const txs=Array.from({length:150},(_,j)=>tx(1+j/100));
    const measure=()=>{const start=performance.now();const out=c.importObExpenses(s,txs,[{aspsp:'Trade Republic',syncFrom:'2026-01-01'}]);return {ms:performance.now()-start,out:JSON.stringify(out)};};
    cold[i].push(measure());samples[i].push(measure());
  }
  for(let k=0;k<5;k++){assert.equal(cold[0][k].out,cold[1][k].out);assert.equal(samples[0][k].out,samples[1][k].out);}
  const median=a=>a.map(x=>x.ms).sort((a,b)=>a-b)[2],a=median(samples[0]),b=median(samples[1]),ac=median(cold[0]),bc=median(cold[1]);
  console.log(JSON.stringify({gemelosAB:{rows:20000,samples:5,cold:{base:ac,candidate:bc},reuse:{base:a,candidate:b}}}));
  assert.ok(b<Math.max(a*1.5,a+15),'se conserva el umbral de rendimiento');
});
