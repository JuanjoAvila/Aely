// CON LA APP EN INGLÉS LAS CIFRAS VAN EN FORMATO INGLÉS (auditoría de Recibos, P2-10).
// Antes salía «1.234,56 €» junto a textos en inglés. Una sola fuente (`NF`/`NF0` en 00-core) decide
// miles y decimales para toda la app; el símbolo se queda detrás en los tres idiomas.
// Y la otra mitad, que es la que no se puede romper: en español y en catalán no cambia ni un
// carácter, y lo que se precarga en un campo o se teclea se sigue leyendo como el mismo número.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogic } from "../scripts/load-pure-logic.mjs";

const source=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const order=JSON.parse(source("src/build-order.json"));
const c=loadPureLogic(source("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>order.map(f=>source("src/modules/"+f)).join("\n")));
const en=(lang,expr)=>{ vm.runInContext("CURLANG="+JSON.stringify(lang),c); try{ return vm.runInContext(expr,c); } finally{ vm.runInContext('CURLANG="es"',c); } };
const plano=x=>JSON.parse(JSON.stringify(x));
let n=0;
function caso(nombre,fn){ fn(); n++; console.log("PASS "+nombre); }

caso("español y catalán: el formato de siempre, carácter a carácter",()=>{
  for(const lang of ["es","ca"]){
    assert.equal(en(lang,"eur(1234.56)"),"1.234,56 €",lang);
    assert.equal(en(lang,"eur(-1426.2)"),"-1.426,20 €",lang);
    assert.equal(en(lang,"eur(0)"),"0,00 €",lang);
    assert.equal(en(lang,"eur0(193993.44)"),"193.993 €",lang);
    assert.equal(en(lang,"eur0(1912)"),"1.912 €",lang);
    assert.equal(en(lang,"NF.format(4.5)"),"4,50",lang);
    assert.deepEqual(plano(en(lang,"eurParts(-1234.5)")),{sign:"-",ent:"1.234",dec:"50",sep:",",sym:"€"},lang);
    assert.equal(en(lang,"numDecSep()"),",",lang);
    assert.equal(en(lang,"numPadDecSep()"),",",lang);
  }
});
caso("inglés: miles con coma, decimales con punto y el símbolo detrás",()=>{
  assert.equal(en("en","eur(1234.56)"),"1,234.56 €");
  assert.equal(en("en","eur(-1426.2)"),"-1,426.20 €");
  assert.equal(en("en","eur(0)"),"0.00 €");
  assert.equal(en("en","eur0(193993.44)"),"193,993 €");
  assert.equal(en("en","eur0(1912)"),"1,912 €");
  assert.equal(en("en","NF.format(4.5)"),"4.50");
  assert.deepEqual(plano(en("en","eurParts(-1234.5)")),{sign:"-",ent:"1,234",dec:"50",sep:".",sym:"€"});
  assert.equal(en("en","numDecSep()"),".");
  assert.equal(en("en","numPadDecSep()"),".");
});
caso("la cifra partida vuelve a dar la entera en los tres idiomas",()=>{
  for(const lang of ["es","en","ca"]) for(const v of [0,0.05,7,999.99,1000,1234567.8,-42.1]){
    const p=en(lang,"eurParts("+v+")");
    assert.equal(p.sign+p.ent+p.sep+p.dec+" "+p.sym,en(lang,"eur("+v+")"),lang+" "+v);
  }
});
caso("con el ojo puesto no se escapa ninguna cifra, tampoco en inglés",()=>{
  for(const lang of ["es","en"]){
    assert.equal(en(lang,"DISP.oculto=true; try{ eur(1234.56)+'|'+eur0(9)+'|'+eurParts(5).ent; } finally{ DISP.oculto=false; }"),"•••• €|•••• €|••••",lang);
  }
});
caso("lo tecleado se lee igual con punto o con coma, en cualquier idioma",()=>{
  for(const lang of ["es","en","ca"]){
    assert.equal(en(lang,"parseNumPadRaw('12,5')"),12.5,lang);
    assert.equal(en(lang,"parseNumPadRaw('12.5')"),12.5,lang);
    // El teclado escribe el separador del idioma y no deja poner dos.
    const sep=en(lang,"numPadDecSep()");
    assert.equal(en(lang,"applyNumPadKey('12',numPadDecSep(),numPadDecSep())"),"12"+sep,lang);
    assert.equal(en(lang,"applyNumPadKey('12.5',',',numPadDecSep())"),"12.5",lang);
    assert.equal(en(lang,"parseNumPadRaw(applyNumPadKey(applyNumPadKey('12',numPadDecSep(),numPadDecSep()),'5',numPadDecSep()))"),12.5,lang);
    // Un importe precargado en un campo (editar un gasto) vuelve a ser el mismo número.
    assert.equal(en(lang,"parseFloat(String(1234.5).replace('.',numDecSep()).replace(',','.'))"),1234.5,lang);
    assert.equal(en(lang,"parseAccountShare(String(33.5).replace('.',numDecSep()))"),33.5,lang);
  }
});
console.log("cifras-por-idioma: "+n+" casos");
