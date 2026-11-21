import assert from "node:assert/strict";
import fs from "node:fs";
import {loadPureLogic} from "../scripts/load-pure-logic.mjs";
const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8");
const js=JSON.parse(read("src/build-order.json")).map(f=>read("src/modules/"+f)).join("\n");
const c=loadPureLogic(read("src/shell.html").replace("<!--MC_APP_SCRIPT-->",()=>js));

/* RED VIVA: navigator.onLine miente con VPN (Tailscale). El aviso «sin conexión» solo vale si una
   petición real falla. Datos sintéticos. */
let total=0,fallos=0;
async function test(name,fn){ try{ await fn();total++;console.log("✓ "+name); }catch(e){ fallos++;console.log("✗ "+name+"\n  "+String(e.message).split("\n")[0]); } }
const vivo=()=>Promise.resolve({ok:true});
const caido=()=>Promise.reject(new TypeError("Failed to fetch"));
const colgado=()=>new Promise(()=>{});

await test("red real caída: redViva es false", async()=>{ assert.equal(await c.redViva({fetch:caido}),false); });
await test("red viva con el flag falso: redViva es true", async()=>{ c.navigator.onLine=false; assert.equal(await c.redViva({fetch:vivo}),true); });
await test("timeout: una petición colgada cuenta como caída", async()=>{
  const t0=Date.now(); assert.equal(await c.redViva({fetch:colgado,timeoutMs:60}),false); assert.ok(Date.now()-t0<2000);
});
await test("basta con que responda una de las dos pruebas", async()=>{
  let n=0; const f=()=>(n++===0?caido():vivo()); assert.equal(await c.redViva({fetch:f}),true);
});
await test("vuelta de la red: tras caída, el siguiente intento responde", async()=>{
  assert.equal(await c.redViva({fetch:caido}),false); assert.equal(await c.redViva({fetch:vivo}),true);
});
await test("mcSiRedViva ejecuta con flag bueno sin sondear", async()=>{
  c.navigator.onLine=true; let k=0; c.mcSiRedViva(()=>k++); assert.equal(k,1);
});
await test("mcSiRedViva con flag falso y red caída NO ejecuta; con red viva sí", async()=>{
  c.navigator.onLine=false; let k=0;
  c.fetch=caido; await c.mcSiRedViva(()=>k++); assert.equal(k,0);
  c.fetch=vivo; await c.mcSiRedViva(()=>k++); assert.equal(k,1);
});
await test("mcSinRed: flag falso sin prueba reciente = sin red; con prueba viva = no", async()=>{
  c.navigator.onLine=false; assert.equal(c.mcSinRed(),false); // la prueba anterior ya demostró red viva
  c.navigator.onLine=true; assert.equal(c.mcSinRed(),false);
});
await test("renameFalloDeRed: error de servidor no se toma por red con flag falso y red viva", async()=>{
  c.navigator.onLine=false; assert.equal(c.renameFalloDeRed(new Error("duplicate key 23505")),false);
  assert.equal(c.renameFalloDeRed(new TypeError("Failed to fetch")),true);
});
console.log(fallos?`\n${fallos} FALLOS de ${total+fallos}`:`\n${total} OK`);
process.exit(fallos?1:0);
