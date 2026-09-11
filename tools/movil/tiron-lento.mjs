#!/usr/bin/env node
/**
 * MEDIR EL TIRONCILLO CON EL DEDO LENTO, EN SU MÓVIL Y CON TOQUES DE VERDAD.
 *
 * Por qué otro instrumento más: las veces anteriores medí los DELTAS DE FOTOGRAMA con rAF y salían
 * 120 Hz clavados mientras él seguía viéndolo. Un fotograma puede llegar puntual y aun así pintar
 * la MISMA posición que el anterior — o el doble de avance —, y eso se ve como un tirón. O sea que
 * el número que hay que mirar no es cuándo llega el fotograma, sino CUÁNTO se ha movido en él.
 *
 * Y los toques van por `adb shell input swipe`, que inyecta MotionEvents reales por el sistema:
 * los sintéticos del navegador no reproducen el muestreo del digitalizador ni su desfase con la
 * pantalla, que es justo donde sospecho que está el problema.
 *
 * Uso: node tools/movil/tiron-lento.mjs [ms]      (por defecto 1600 ms = lento)
 */
const MS = Number(process.argv[2] || 1600);
const PUERTO = 9333;

const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
const page = lista.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
if (!page) { console.error("no hay página con CDP; ¿está abierta la app .debug?"); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pend = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
});
await new Promise((r) => ws.addEventListener("open", r));
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => {
  const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r && r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
  return r?.result?.value;
};

console.log("· conectado a", page.url);

const sitio = await js(`(()=>{ const t=document.querySelector(".track"); if(!t) return null;
  const r=t.getBoundingClientRect(); return {w:innerWidth,h:innerHeight,track:{x:r.x,y:r.y,w:r.width,h:r.height}}; })()`);
if (!sitio) { console.error("no encuentro .track — ¿está la app en una pestaña?"); process.exit(1); }
console.log("· pantalla", sitio.w + "x" + sitio.h);

// Grabador: por fotograma, la POSICIÓN pintada; y aparte, cada touchmove con su hora.
await js(`(()=>{
  window.__rec={frames:[],toques:[],on:true};
  const tr=document.querySelector(".track");
  const leer=()=>{ const m=new DOMMatrixReadOnly(getComputedStyle(tr).transform); return m.m41; };
  const bucle=()=>{ if(!window.__rec.on) return; window.__rec.frames.push([performance.now(), leer()]); requestAnimationFrame(bucle); };
  requestAnimationFrame(bucle);
  window.__onTM=(e)=>{ const t=e.touches[0]; if(t) window.__rec.toques.push([performance.now(), t.clientX]); };
  addEventListener("touchmove", window.__onTM, {capture:true, passive:true});
  return true; })()`);

const { execSync } = await import("node:child_process");
const ADB = "C:/Users/juanj/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const y = Math.round(sitio.h * 0.55);
const x1 = Math.round(sitio.w * 0.85), x2 = Math.round(sitio.w * 0.15);
console.log(`· deslizo LENTO: ${x1}→${x2} en ${MS} ms  (${((x1 - x2) / (MS / 1000)).toFixed(0)} px/s)`);
execSync(`"${ADB}" shell input swipe ${x1} ${y} ${x2} ${y} ${MS}`, { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 400));

const rec = await js(`(()=>{ window.__rec.on=false; removeEventListener("touchmove", window.__onTM, {capture:true});
  return {frames:window.__rec.frames, toques:window.__rec.toques}; })()`);

const f = rec.frames.filter((_, i) => i > 0);
const movidos = [];
for (let i = 1; i < rec.frames.length; i++) {
  const dt = rec.frames[i][0] - rec.frames[i - 1][0];
  const dx = rec.frames[i][1] - rec.frames[i - 1][1];
  if (Math.abs(dx) > 0.001 || movidos.length) movidos.push({ dt, dx });
}
// Recorta a la parte en la que de verdad se está arrastrando.
const act = movidos.filter((m) => Math.abs(m.dx) > 0.001);
const i0 = movidos.findIndex((m) => Math.abs(m.dx) > 0.001);
const iN = movidos.length - 1 - [...movidos].reverse().findIndex((m) => Math.abs(m.dx) > 0.001);
const tramo = movidos.slice(i0, iN + 1);

const dts = tramo.map((m) => m.dt), dxs = tramo.map((m) => Math.abs(m.dx));
const med = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const mediaDx = med(dxs), mediaDt = med(dts);
const quietos = dxs.filter((v) => v < 0.05).length;
const dobles = dxs.filter((v) => v > mediaDx * 1.8).length;
const largos = dts.filter((v) => v > mediaDt * 1.8).length;

console.log("");
console.log("── FOTOGRAMAS DEL ARRASTRE ──");
console.log(`  fotogramas con el dedo puesto : ${tramo.length}`);
console.log(`  toques recibidos              : ${rec.toques.length}`);
console.log(`  ms por fotograma (media)      : ${mediaDt.toFixed(2)}`);
console.log(`  px por fotograma (media)      : ${mediaDx.toFixed(2)}`);
console.log("");
console.log("── DONDE SE VE EL TIRÓN ──");
console.log(`  fotogramas QUIETOS (no avanza): ${quietos}   ${quietos ? "← se repite la posición" : "✓"}`);
console.log(`  fotogramas que SALTAN (>1,8x) : ${dobles}   ${dobles ? "← recupera de golpe" : "✓"}`);
console.log(`  fotogramas LARGOS (>1,8x ms)  : ${largos}   ${largos ? "← el frame llegó tarde" : "✓"}`);
console.log("");
/* LA PREGUNTA QUE DE VERDAD IMPORTA: ¿se paró el DEDO o nos paramos NOSOTROS?
   Para cada fotograma se mira cuánto se movió el dedo en esa misma ventana de tiempo (según los
   touchmove reales) y se compara con lo que pintamos. Si el dedo avanzó y nosotros no, el tirón
   es nuestro. Si el dedo tampoco avanzó, es muestreo del digitalizador y no hay nada que arreglar
   en el código. */
const toques = rec.toques;
const dedoEntre = (t0, t1) => {
  const dentro = toques.filter((p) => p[0] > t0 && p[0] <= t1);
  if (!dentro.length) return 0;
  const antes = toques.filter((p) => p[0] <= t0).pop() || dentro[0];
  return Math.abs(dentro[dentro.length - 1][1] - antes[1]);
};
let nuestros = 0, delDedo = 0;
const base = rec.frames.slice(i0 + 1, iN + 2);
for (let k = 1; k < base.length; k++) {
  const pintado = Math.abs(base[k][1] - base[k - 1][1]);
  if (pintado >= 0.05) continue;
  (dedoEntre(base[k - 1][0], base[k][0]) >= 0.4 ? nuestros++ : delDedo++);
}
console.log("── ¿DE QUIÉN ES LA PARADA? ──");
console.log(`  el dedo avanzó y NOSOTROS no pintamos : ${nuestros}   ${nuestros ? "← esto SÍ es del código" : "✓"}`);
console.log(`  el dedo tampoco avanzó               : ${delDedo}   (muestreo del táctil, no es nuestro)`);
console.log("");
console.log("  px por fotograma, todo el arrastre (cada número = un fotograma):");
for (let k = 0; k < dxs.length; k += 20)
  console.log("  " + dxs.slice(k, k + 20).map((v) => v.toFixed(1).padStart(5)).join(""));
console.log("");
console.log(`  arranque: el primer fotograma pintado salta ${dxs[0].toFixed(1)} px de golpe`);
/* ¿Ese salto es NUESTRO o del inyector? Si el PRIMER touchmove ya llega lejos del origen, el
   salto lo trae el `adb input swipe` y con un dedo de verdad sería el umbral del gesto (12 px).
   Hay que saberlo ANTES de arreglar nada: si no, acabo arreglando un número que no existe. */
if (toques.length > 2) {
  const x0 = toques[0][1];
  const saltos = toques.slice(0, 6).map((p) => Math.abs(p[1] - x0).toFixed(1));
  console.log(`  primeros touchmove, distancia al origen : ${saltos.join(" · ")}`);
  console.log(`  umbral del gesto en el código (GEST_LEAD): 12 px`);
  console.log(`  → si el primer touchmove ya pasa de 12, el salto medido lo infla el inyector`);

  /* CUÁNTO TIEMPO SE QUEDA QUIETO EL CARRUSEL. Esto es lo que se ve: no el salto en sí, sino que
     antes del salto la pantalla NO responde al dedo. A poca velocidad ese silencio dura mucho más
     en tiempo, y por eso él dice que «yendo lento se nota y yendo rápido no». */
  const primerPintado = rec.frames.find((f, k) => k > 0 && Math.abs(f[1] - rec.frames[k - 1][1]) > 0.05);
  if (primerPintado) {
    const t0 = toques[0][0];
    const congelado = primerPintado[0] - t0;
    const dedoEnEseRato = toques.filter((p) => p[0] <= primerPintado[0]).pop();
    console.log("");
    console.log("── EL CONGELADO DEL ARRANQUE (esto es lo que se ve) ──");
    console.log(`  el dedo se mueve durante      : ${congelado.toFixed(0)} ms sin que la pantalla responda`);
    console.log(`  y ha recorrido en ese rato    : ${Math.abs(dedoEnEseRato[1] - toques[0][1]).toFixed(1)} px`);
    console.log(`  entonces la pantalla salta    : ${dxs[0].toFixed(1)} px de una vez`);
  }
}
ws.close();
