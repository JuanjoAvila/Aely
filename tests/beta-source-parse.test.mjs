import assert from "node:assert/strict";
import { logicFunctions } from "../scripts/beta-source-code.mjs";

// Delimitadores dentro de parámetros, comentarios, regex y textos no son el final.
// Se clavan textos/rangos, porque cambiar el corte cambia una identidad ya aprobada.
const defs=[
  ["defaults",'function defaults({item={a:1}}={}){\n  var re=/[}];/g, text="}";\n  // } cierre falso\n  return {nested:function(){return item;}};\n}'],
  ["semicolon",'function semicolon(){return 1;};'],
  ["commented",'function commented(){return "á";}'],
  ["pending",'async function pending(x){\n  return await Promise.resolve(x);\n}'],
  ["expr",'var expr=function(){\n  return {value:"}"};\n};'],
  ["arrow",'const arrow=(x)=>({value:x});'],
  ["template",'function template(){\n  return `texto }\\n otro`;\n}'],
];
const src=defs.map(([name,text])=>text+(name==="commented"?" // } comentario":"")).join("\n\n");
const result=logicFunctions(()=>src,["fixture-delimitadores.js"]);
assert.equal(result.size,defs.length);
for(const [name,text]of defs){
  const fn=result.get(name);
  assert.equal(fn.text,text,name+" conserva el texto exacto");
  assert.equal(fn.start,src.indexOf(text));
  assert.equal(fn.end,fn.start+text.length);
}
for(const text of ['function broken(){return 1;','function invalid(){let x=;}'])
  assert.throws(()=>logicFunctions(()=>text,["fixture-invalid-"+text.length+".js"]),/no delimitada/);
assert.throws(()=>logicFunctions(()=> 'function interpolated(x){return `${x}`;}',["fixture-template.js"]),/Interpolación/);
console.log("beta-source-parse: PASS · parámetros, regex, comentarios, textos, async, expresiones, rangos y fallo cerrado");
