// GUARDIÁN: toda escritura del `value` de una cuenta pasa por `conValor`/`ponValor` (07), o está en esta lista
// con su porqué (revisión de 240-dinero, P2). La marca de anclaje (`anclaReglas`) solo vale mientras su `v`
// coincide con `value`: un escritor que desplaza `value` sin renovarla la invalida sin avisar, y la cuenta
// pierde la corrección de H3 (1.000 → 970 con una nómina adelantada, `keepShownAcrossFlows`) y su cierre
// cae a la regla vieja. Pasó con cuatro escritores a la vez; esto es para que no haya un quinto.
// Es un lector de texto, no un analizador: caza `Object.assign({}, <cuenta>, {… value: …})` y
// `<cuenta>.value =` con los nombres que usa el código para una cuenta. Si añades un escritor con otro
// nombre, el guardián no lo ve: usa `conValor` igualmente.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const dir=new URL("../src/modules/",import.meta.url);
const V="(?:a|acc|a2|cuenta|account|acct|item|x|n|c|ac|b)";
const PATRONES=[
  new RegExp(String.raw`Object\.assign\(\s*\{\}\s*,\s*`+V+String.raw`\s*,\s*\{[^{}]*\bvalue\s*:`,"g"),
  new RegExp(String.raw`\b`+V+String.raw`\.value\s*(?:=(?!=)|\+=|-=)`,"g"),
];
// fichero|función → cuántas escrituras y por qué no llevan `conValor`.
const PERMITIDAS={
  "07-tab-patri-fijos.js|conValor":[1,"es el propio ayudante"],
  "07-tab-patri-fijos.js|ponValor":[1,"es el propio ayudante, en su sitio"],
  "08-motor-bank.js|applyBankBalances":[2,"la lectura del banco: pone la marca nueva ella misma (`selloAncla`)"],
  "01-i18n.js|reconcileTR":[6,"muta la cuenta durante el cierre y renueva la marca al final (`conMarca`)"],
  // Lecturas nuevas, no de Open Banking: anclan con la regla de la 240 (`insumosSaldoGasto`).
  "00-core.js|applyTrCash":[1,"puente nativo de TR: ancla y pone la marca sin hora (`selloAncla(v,null)`)"],
  "06-sync-brokers.js|TRSync":[1,"puente nativo de TR (la tarjeta): ancla y pone la marca sin hora"],
  "00-core.js|manualBalanceWrite":[1,"saldo tecleado: solo cuentas sin IBAN, uid ni `_obKey`, que no llevan marca ni `balSaldo` (cierran con la regla nueva)"],
  // Las restauraciones NO van aquí: reponen un `value` en una cuenta que puede llevar marca y usan `conValor`
  // (`fixedPausa`, `reponerBases`). La lista justificaba la de Plan › Recibos con «la marca vuelve a valer
  // sola», y no era verdad: el saldo bajaba de 1.000 a 970 (revisión de 240-dinero, segunda vuelta).
  "07-tab-patri-fijos.js|AssetSheet":[1,"un bien (piso, coche), no una cuenta"],
  "08-motor-bank.js|patchDebtFields":[1,"una deuda, no una cuenta"],
  "09-tab-debts-goals.js|deudaAmortizada":[1,"una deuda, no una cuenta"],
};

test("toda escritura del `value` de una cuenta pasa por `conValor` o está justificada",()=>{
  const vistas={}, fuera=[];
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".js"))){
    const s=fs.readFileSync(new URL(f,dir),"utf8");
    for(const re of PATRONES){
      re.lastIndex=0; let m;
      while((m=re.exec(s))){
        const antes=s.slice(0,m.index), fn=[...antes.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].pop();
        const k=f+"|"+(fn?fn[1]:"?");
        vistas[k]=(vistas[k]||0)+1;
        if(!PERMITIDAS[k]) fuera.push(k+":"+antes.split("\n").length+" → "+s.slice(m.index,m.index+70).replace(/\s+/g," "));
      }
    }
  }
  assert.deepEqual(fuera,[],"escrituras de `value` sin `conValor` (usa `conValor`/`ponValor` o justifícala aquí)");
  // La lista no puede quedarse rancia: si un permitido cambia de número, se revisa a mano.
  for(const [k,[n]] of Object.entries(PERMITIDAS)) assert.equal(vistas[k]||0,n,"permitida que cambió: "+k);
});

test("el guardián ve lo que tiene que ver",()=>{
  const prueba="function nueva(s){ return s.accounts.map(function(a){ return Object.assign({},a,{value:1}); }); }\nfunction otra(acc){ acc.value=2; }";
  const n=PATRONES.reduce((t,re)=>{ re.lastIndex=0; return t+[...prueba.matchAll(re)].length; },0);
  assert.equal(n,2);
});
