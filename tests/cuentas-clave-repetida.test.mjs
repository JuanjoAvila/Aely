import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* DOS CUENTAS CON LA MISMA CLAVE (revisión externa 15/11/2026, hallazgo B / R8). Dos cuentas
   manuales que comparten `accountOrderKeyOf` leían la MISMA lista de cierres: con 1.000 y 500 hoy y
   cierres de 1.000 guardados, la gráfica de patrimonio daba 2.000 en los días pasados en vez de
   1.500. Y desde la 233 `accountBalanceRows` no guarda cierres de una clave repetida, así que el
   error se quedaba congelado. Ahora: al cargar, cada una recibe su clave (`accountKeysUnicas`) y
   vuelve a tener su histórico desde hoy; y si aun así llega una serie con la clave mezclada, la
   gráfica no pinta una cifra inventada («—»). Datos inventados. */
const HOY="2026-11-10";
const plano=x=>JSON.parse(JSON.stringify(x));
const base=(accounts,extra)=>Object.assign({accounts,obAccounts:[],expenses:[],debts:[],fixed:[],flows:[],oneoffs:[],investments:[],assets:[],
  invHistory:[],settings:{},accountBalanceHistory:{"acc:dup":[{day:"2026-10-01",value:1000},{day:"2026-10-20",value:1000}],"acc:otra":[{day:"2026-10-01",value:200}]}},extra||{});
// Una tercera cuenta, sin choque y con cierres, hace que haya gráfica hacia atrás.
const dosConLaMisma=()=>base([{id:"dup",ent:"familia",name:"Hucha A",value:1000,role:"fijos"},{id:"dup",ent:"familia",name:"Hucha B",value:500,role:"fijos"},
  {id:"otra",ent:"familia",name:"Hucha C",value:200,role:"fijos"}]);
// Sin pasar por JSON: la cobertura es una propiedad del array y JSON la tira.
const serie=s=>c.netWorthSeries(s,{today:HOY});

test("reproducción: con la clave repetida la serie no suma dos veces el cierre mezclado en el pasado",()=>{
  const out=serie(dosConLaMisma());
  const pasado=out.filter(p=>p.day<HOY);
  assert.ok(!pasado.some(p=>Math.abs(p.value-2200)<0.005),"ningún día pasado a 2.200 (el cierre mezclado sumado dos veces)");
  // Sin saber de quién es cada cierre, el pasado no se sabe: sin serie y la cifra de hoy en «—».
  assert.ok(out.length<2,"sin gráfica");
  assert.ok((out.coverage||[]).some(g=>g.kind==="balance"&&g.unknown),"se marca como no fiable");
});

test("al cargar, cada cuenta recibe su clave y el pasado suma cada saldo una vez",()=>{
  const s=c.accountKeysUnicas(dosConLaMisma());
  const claves=s.accounts.map(a=>c.accountOrderKeyOf(a,"account"));
  assert.equal(new Set(claves).size,3,"claves distintas");
  assert.ok(!claves.includes("acc:dup"),"ninguna se queda con la mezclada");
  // Los cierres mezclados se quedan guardados tal cual: no se borran ni se reparten.
  assert.deepEqual(plano(s.accountBalanceHistory),plano(dosConLaMisma().accountBalanceHistory));
  const out=serie(s);
  assert.ok(out.length>1,"hay gráfica");
  assert.equal(out[0].day,"2026-10-01");
  for(const p of out) assert.equal(Math.round(p.value*100),170000,"día "+p.day+": 1.000 + 500 + 200");
  // Y vuelven a guardar su cierre de hoy, cada una el suyo.
  const filas=plano(c.accountBalanceRows(s,a=>a.value));
  assert.deepEqual(filas.map(f=>f.value).sort((a,b)=>a-b),[200,500,1000]);
  assert.deepEqual(filas.map(f=>f.key).sort(),["acc:otra"].concat(claves.slice(0,2)).sort());
});

test("idempotente y sin tocar nada cuando no hay choque",()=>{
  const una=c.accountKeysUnicas(dosConLaMisma()),dos=c.accountKeysUnicas(una);
  assert.equal(dos,una,"la segunda pasada devuelve el mismo objeto");
  const limpio=base([{id:"a",ent:"familia",value:1},{id:"b",ent:"familia",value:2,accountOrderKey:"ob:k1"}]);
  assert.equal(c.accountKeysUnicas(limpio),limpio);
  // Sin identificador (233): ni se le inventa clave ni cuenta como choque que arreglar.
  const sinId=base([{ent:"familia",value:1},{ent:"familia",value:2}]);
  assert.equal(c.accountKeysUnicas(sinId),sinId);
});

test("respeta lo que él puso: el orden de la lista, la parte de cada una y el enlace con su banco",()=>{
  const s0=base([{id:"x",ent:"sabadell",name:"Otra",value:10},
    {id:"p1",ent:"sabadell",name:"Promovida",value:100,accountOrderKey:"ob:K"},{id:"p2",ent:"sabadell",name:"Copia",value:50,accountOrderKey:"ob:K",bankUid:"OTRO"}],
    {settings:{accountListOrder:["ob:K","acc:x"],accountShare:{"ob:K":50}},accountBalanceHistory:{}});
  const s=c.accountKeysUnicas(s0);
  const [x,p1,p2]=s.accounts;
  assert.equal(x,s0.accounts[0],"la que no choca no se toca");
  assert.notEqual(c.accountOrderKeyOf(p1,"account"),c.accountOrderKeyOf(p2,"account"));
  // El orden: las dos donde estaba la clave vieja, y la otra detrás, como antes.
  assert.deepEqual(plano(s.settings.accountListOrder),[c.accountOrderKeyOf(p1,"account"),c.accountOrderKeyOf(p2,"account"),"acc:x"]);
  // La parte (50 %) sigue valiendo para las dos.
  assert.equal(c.accountShareOf(s,p1,"account"),0.5);assert.equal(c.accountShareOf(s,p2,"account"),0.5);
  // Los movimientos del banco siguen siendo de la promovida (su uid salía de la clave vieja); la otra conserva el suyo.
  assert.equal(c.accountOwnsMovement(p1,"account","K"),true);
  assert.equal(p2.bankUid,"OTRO");
  assert.equal(c.accountKeysUnicas(s),s);
});

test("dos móviles con las cuentas en distinto orden llegan a las mismas claves (revisión 234, H-B2)",()=>{
  const s1=Object.assign(dosConLaMisma(),{settings:{accountListOrder:["acc:otra","acc:dup"]}});
  const s2=Object.assign(dosConLaMisma(),{settings:{accountListOrder:["acc:otra","acc:dup"]}});
  s2.accounts=s2.accounts.slice().reverse();
  const porNombre=s=>Object.fromEntries(c.accountKeysUnicas(s).accounts.map(a=>[a.name,c.accountOrderKeyOf(a,"account")]));
  assert.deepEqual(porNombre(s1),porNombre(s2));
  assert.deepEqual(plano(c.accountKeysUnicas(s1).settings.accountListOrder),plano(c.accountKeysUnicas(s2).settings.accountListOrder));
  // Y sigue siendo idempotente.
  const una=c.accountKeysUnicas(s2); assert.equal(c.accountKeysUnicas(una),una);
});

test("una cuenta que choca con una de banco aún sin rol: la de banco conserva su clave",()=>{
  const s0=base([{id:"m",ent:"familia",value:20,accountOrderKey:"ob:K"}],{obAccounts:[{key:"K",ent:"sabadell",value:5,cur:"EUR"}],accountBalanceHistory:{}});
  const s=c.accountKeysUnicas(s0);
  assert.equal(s.obAccounts,s0.obAccounts);
  assert.notEqual(c.accountOrderKeyOf(s.accounts[0],"account"),"ob:K");
});
