/**
 * Guardián B09-A2 (2026-09-07): el useEffect de umbrales 50/80/95/100 (`_bn`) debe listar
 * `state.accounts` y `state.settings` en sus deps — dashboardBudgetStats → expenseBankEnts.
 * Sin eso, cambiar bancos de gasto diario no reevaluaba el % (espejo de B09-A en la cabecera).
 *
 * Guardián de FUENTE a propósito: el e2e del umbral sigue pendiente porque `page.clock`
 * deja el botnav/Editar inaccesibles. Borrar este test el día que exista e2e de verdad.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/modules/11-app-main.js"), "utf8");

const marker = main.indexOf('"_bn"+th');
assert.ok(marker >= 0, "no se encuentra el useEffect de umbrales (_bn)");

const after = main.slice(marker, marker + 800);
const depsMatch = after.match(/\},\[([^\]]+)\]\)/);
assert.ok(depsMatch, "no se encuentra el array de deps del useEffect _bn");
const deps = depsMatch[1];

assert.match(deps, /\bstate\.accounts\b/, "deps del useEffect _bn deben incluir state.accounts");
assert.match(deps, /\bstate\.settings\b/, "deps del useEffect _bn deben incluir state.settings");
assert.doesNotMatch(
  deps,
  /state\.settings\s*&&\s*state\.settings\.gTotalMode/,
  "no volver al dep estrecho gTotalMode (regresión B09-A2)"
);

console.log("ok: useEffect _bn depende de accounts + settings");

// Ejecutar el efecto real detecta un lector que vuelva al neto aunque conserve las deps.
const logic=loadPureLogicFromFile(), RealDate=logic.Date;
const effectStart=main.lastIndexOf("  useEffect(function(){",marker);
const effectEnd=main.indexOf("\n  // Snapshot diario",marker);
assert.ok(effectStart>=0&&effectEnd>effectStart);
const state={onboarded:true,budget:1000,settings:{gTotalMode:"net",budgetCycle:false},
  expenses:[{date:"2026-09-20T12:00:00Z",amount:1200,category:"super"},
    {date:"2026-09-26T12:00:00Z",amount:-2000,merchant:"Nómina",category:"ingreso"}]};
const flags=new Map(),toasts=[],notifications=[];
try{
  logic.Date=class extends RealDate { static now(){ return Date.parse("2026-09-28T12:00:00Z"); } };
  const effectCtx={state,locked:false,useEffect:fn=>fn(),
    dashboardBudgetStats:s=>logic.dashboardBudgetStats(s),monthBudgetStats:s=>logic.monthBudgetStats(s),
    localStorage:{getItem:k=>flags.get(k),setItem:(k,v)=>flags.set(k,v)},
    tf:(key,vars)=>({key,vars}),eur0:n=>n,showToast:msg=>toasts.push(msg),
    natPlugin:()=>({showNotification:msg=>{notifications.push(msg);return Promise.resolve();}}),
  };
  vm.runInNewContext(main.slice(effectStart,effectEnd),effectCtx);
  assert.equal(toasts.length,1); assert.equal(toasts[0].key,"bn_100");
  assert.equal(toasts[0].vars.x,1200); assert.equal(toasts[0].vars.b,1000);
  assert.equal(notifications.length,1);
  vm.runInNewContext(main.slice(effectStart,effectEnd),effectCtx);
  assert.equal(toasts.length,1,"volver a evaluar no repite el aviso ya emitido");
  flags.clear(); toasts.length=0; notifications.length=0;
  state.settings.budgetCycle=true;
  vm.runInNewContext(main.slice(effectStart,effectEnd),effectCtx);
  assert.equal(toasts.length,0,"la nómina abre un ciclo nuevo sin el gasto anterior");
}finally{logic.Date=RealDate;}
console.log("ok: los avisos usan el consumo de Inicio sin duplicarse y conservan el ciclo");
