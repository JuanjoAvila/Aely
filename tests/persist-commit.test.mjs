#!/usr/bin/env node
/**
 * SE GUARDA LO QUE SE HA PINTADO (INC-0410, 4/10/2026).
 *
 * `set()` apuntaba el volcado pendiente dentro del updater. React puede ejecutar un updater sobre
 * un estado que luego abandona y reutilizar después un resultado ya calculado: el volcado se
 * quedaba con el estado abandonado. Visto en el alta de reglas de Metas —en pantalla la regla no
 * existía y en disco sí— y reproducido en el DOM (`e2e/metas-alta-regla.spec.mjs`, la carrera).
 *
 * Esto fija el contrato de `mcPersistCommit`, que solo corre tras un commit: qué apunta, cuándo
 * arma el temporizador y cuándo marca el histórico de gastos. El orden real de React y el disco
 * de verdad los prueba el e2e; aquí no hay React.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();
let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${String(e.message).split("\n").join("\n      ")}`); }
}
console.log("persist-commit");

const nuevo = () => ({ t: null, val: null, exp: false });
const gastos = [{ id: "e1" }];
const s0 = { expenses: gastos, a: 0 };

t("al montar no hay nada que guardar", () => {
  const p = nuevo(); let armados = 0;
  assert.equal(ctx.mcPersistCommit(p, s0, s0, () => { armados++; return 1; }), false);
  assert.deepEqual([p.val, p.exp, p.t, armados], [null, false, null, 0]);
});

t("un commit apunta ESE estado y arma un solo temporizador", () => {
  const p = nuevo(); let armados = 0;
  const s1 = { expenses: gastos, a: 1 }, s2 = { expenses: gastos, a: 2 };
  assert.equal(ctx.mcPersistCommit(p, s0, s1, () => { armados++; return 7; }), true);
  assert.strictEqual(p.val, s1);
  assert.deepEqual([p.exp, p.t, armados], [false, 7, 1]);
  // Otro commit con el temporizador en marcha: se queda con el último, sin armar otro.
  ctx.mcPersistCommit(p, s1, s2, () => { armados++; return 8; });
  assert.strictEqual(p.val, s2);
  assert.deepEqual([p.exp, p.t, armados], [false, 7, 1]);
});

t("el histórico solo se marca si cambia la referencia de gastos, y la marca no se pierde", () => {
  const p = nuevo();
  const s1 = { expenses: gastos, a: 1 };                       // misma referencia: no se reescribe
  ctx.mcPersistCommit(p, s0, s1, () => 1);
  assert.equal(p.exp, false);
  const s2 = { expenses: gastos.concat([{ id: "e2" }]), a: 2 };
  ctx.mcPersistCommit(p, s1, s2, () => 1);
  assert.equal(p.exp, true);
  const s3 = { expenses: s2.expenses, a: 3 };                  // un commit posterior no la borra
  ctx.mcPersistCommit(p, s2, s3, () => 1);
  assert.equal(p.exp, true);
  assert.strictEqual(p.val, s3);
});

t("un estado calculado y abandonado nunca llega al volcado", () => {
  // Lo que pasaba: el updater corría sobre el estado viejo (T), React lo abandonaba y comprometía
  // otro (S1). Con el volcado en el commit, T no existe para la persistencia.
  const p = nuevo();
  const abandonado = { expenses: gastos, regla: "transitoria" };
  const s1 = { expenses: gastos, regla: null };
  ctx.mcPersistCommit(p, s0, s1, () => 1);
  assert.strictEqual(p.val, s1);
  assert.notStrictEqual(p.val, abandonado);
});

t("set() ya no apunta ni arma nada: solo calcula", () => {
  const src = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const ini = src.indexOf("const set=useCallback((updater,edited=true)=>{ setStateRaw(prev=>{"), fin = src.indexOf("}); },[]);", ini);
  assert.ok(ini > 0 && fin > ini, "no se encontró set() en 11-app-main.js");
  const cuerpo = src.slice(ini, fin);
  for (const prohibido of ["persistRef", "setTimeout", "writeNow", "mcSaveRaw", "localStorage"]) {
    assert.ok(!cuerpo.includes(prohibido), "el updater de set() vuelve a tocar " + prohibido);
  }
  assert.ok(src.includes("useLayoutEffect(function(){\n    const prev=committedRef.current;"), "el volcado ya no cuelga del commit");
});

t("mantenimiento conserva el sello y las referencias; editar sigue sellando y persistiendo", () => {
  const src = fs.readFileSync(new URL("../src/modules/11-app-main.js", import.meta.url), "utf8");
  const a=src.indexOf("const set=useCallback("), b=src.indexOf("// En el propio commit",a);
  assert.ok(a>=0&&b>a);
  let state={expenses:gastos,_savedAt:7,unknown:{keep:true},budget:500}, clock=100;
  const set=new Function("useCallback","setStateRaw","reconcileGemelosAutomaticos","Date",src.slice(a,b)+"return set;")(
    f=>f,f=>{state=f(state);},x=>x,{now:()=>clock});
  const first=state, p=nuevo();
  set(s=>Object.assign({},s,{gmLevel:1}),false);
  assert.equal(state._savedAt,7);
  assert.strictEqual(state.expenses,gastos);
  assert.strictEqual(state.unknown,first.unknown);
  ctx.mcPersistCommit(p,first,state,()=>1);
  assert.strictEqual(p.val,state);
  assert.equal(p.exp,false);
  const before=state;
  set(s=>Object.assign({},s,{budget:42.37}));
  assert.equal(state._savedAt,100);
  assert.equal(Math.round(state.budget*100),4237);
  ctx.mcPersistCommit(p,before,state,()=>2);
  assert.strictEqual(p.val,state);
  const edit=state;clock=200;
  set(s=>s);
  assert.strictEqual(state,edit);
  set(s=>Object.assign({},s,{lastBackup:"2026-10-24"}),false);
  assert.equal(state._savedAt,100);
  // Una lectura adopta el sello remoto elegido por LWW; no lo reemplaza por el reloj local.
  set(s=>Object.assign({},s,{_savedAt:90,remoteUnknown:{keep:17}}),false);
  assert.equal(state._savedAt,90);
  assert.equal(state.remoteUnknown.keep,17);
});

console.log(failed ? "\npersist-commit: FALLA" : "\npersist-commit: OK");
process.exit(failed ? 1 : 0);
