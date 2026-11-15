import assert from "node:assert/strict";
import fs from "node:fs";
import {test} from "node:test";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* QUÉ CIERRES DE SALDO SE GUARDAN HOY (`accountBalanceRows`, 14/11/2026). El e2e
   `saldos-sin-bucle` vigila el bucle; aquí va cada regla por separado, porque en el e2e las dos
   cuentas sin clave ya chocan entre sí y tapan la regla de «sin identificador». */
const shown=a=>a.value;
const filas=state=>JSON.parse(JSON.stringify(c.accountBalanceRows(state,shown)));
const DIA="2026-10-13";

test("claves únicas: las mismas claves y saldos que se guardaban antes",()=>{
  const state={
    accounts:[{id:"a1",value:100.004},{id:"a2",value:-5.5,accountOrderKey:"ob:promo"}],
    obAccounts:[{key:"k1",value:20.25,cur:"EUR"},{key:"k2",value:0,cur:"EUR"}]};
  assert.deepEqual(filas(state),[
    {key:"acc:a1",value:100},{key:"ob:promo",value:-5.5},{key:"ob:k1",value:20.25},{key:"ob:k2",value:0}]);
});

test("una sola cuenta sin identificador no deja cierre",()=>{
  assert.deepEqual(filas({accounts:[],obAccounts:[{value:50,cur:"EUR"}]}),[]);
  assert.deepEqual(filas({accounts:[{value:50}],obAccounts:[]}),[]);
});

test("identificador 0 o vacío es «sin identificador», como en la clave con la que se lee",()=>{
  for(const vacio of [0,"",null,undefined]){
    assert.deepEqual(filas({accounts:[{id:vacio,value:10},{id:"ok",value:1}],obAccounts:[{key:vacio,value:10,cur:"EUR"}]}),
      [{key:"acc:ok",value:1}],"identificador "+JSON.stringify(vacio));
  }
});

test("un saldo que no se sabe no se apunta como cero",()=>{
  const state={accounts:[{id:"a",value:7}],obAccounts:[
    {key:"sin-valor",cur:"EUR"},{key:"nulo",value:null,cur:"EUR"},{key:"texto",value:"12.5",cur:"EUR"},
    {key:"nan",value:NaN,cur:"EUR"},{key:"sin-cambio",value:10,cur:"ZZZ"},{key:"cero",value:0,cur:"EUR"}]};
  assert.equal(c.toEurAmt(10,"ZZZ",state),null);
  // El cero REAL del banco sí es un cierre.
  assert.deepEqual(filas(state),[{key:"acc:a",value:7},{key:"ob:cero",value:0}]);
  assert.deepEqual(filas({accounts:[{id:"x",value:NaN}],obAccounts:[]}),[]);
});

test("dos cuentas en la misma clave: ninguna deja cierre y lo guardado queda intacto",()=>{
  const state={
    accounts:[{id:"a",value:1},{id:"p",value:300,accountOrderKey:"ob:rep"},{id:"d",value:5},{id:"d",value:6}],
    obAccounts:[{key:"rep",value:900,cur:"EUR"},{key:"libre",value:40,cur:"EUR"}]};
  const rows=c.accountBalanceRows(state,shown);
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),[{key:"acc:a",value:1},{key:"ob:libre",value:40}]);
  const previo={"ob:rep":[{day:"2026-10-01",value:700}],"acc:d":[{day:"2026-10-01",value:5}]};
  const copia=JSON.parse(JSON.stringify(previo));
  const out=c.recordAccountBalances(previo,DIA,rows);
  assert.deepEqual(previo,copia);
  assert.equal(out["ob:rep"],previo["ob:rep"]);
  assert.equal(out["acc:d"],previo["acc:d"]);
  assert.deepEqual(JSON.parse(JSON.stringify(out["ob:libre"])),[{day:DIA,value:40}]);
});

test("una fila con saldo desconocido también cuenta como choque",()=>{
  // Si la segunda no se sabe, la primera no puede quedarse la clave de las dos.
  assert.deepEqual(filas({accounts:[],obAccounts:[{key:"rep",value:900,cur:"EUR"},{key:"rep",cur:"EUR"}]}),[]);
});

test("guardado el cierre de hoy, repetir no vuelve a escribir (no hay bucle)",()=>{
  const state={accounts:[{id:"a",value:1}],obAccounts:[{key:"k",value:2,cur:"EUR"},{value:3,cur:"EUR"},{value:4,cur:"EUR"}]};
  const una=c.recordAccountBalances({},DIA,c.accountBalanceRows(state,shown));
  assert.deepEqual(Object.keys(una).sort(),["acc:a","ob:k"]);
  assert.equal(c.recordAccountBalances(una,DIA,c.accountBalanceRows(state,shown)),una);
});
