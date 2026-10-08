import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

// El mes de Gastos es el de Madrid vengan de la zona que vengan el móvil o el CI: la misma
// batería se ejecuta con TZ distintos en procesos aparte (el TZ se lee al arrancar Node).
const ZONAS=["UTC","Europe/Madrid","America/Los_Angeles","Pacific/Auckland"];
if(!process.env.MC_TZ_CASO){
  for(const tz of ZONAS){
    const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,TZ:tz,MC_TZ_CASO:"1"},stdio:"inherit"});
    assert.equal(r.status,0,"falla con TZ="+tz);
  }
  console.log("✓ fronteras de mes de Madrid en "+ZONAS.length+" zonas horarias");
  process.exit(0);
}

const ctx=loadPureLogicFromFile(), NativeDate=ctx.Date;
let epoch=0;
ctx.Date=class extends NativeDate {
  constructor(...args){ super(...(args.length?args:[epoch])); }
  static now(){ return epoch; }
};
const Z=(s)=>Date.parse(s);
const fin=(s)=>Z(s)-1;
// [ahora, mes, mes pasado, 3 meses] con inicio/fin exactos en UTC, cubriendo cambio de mes,
// de año y de horario (CET↔CEST).
const casos=[
  ["2026-10-15T10:00:00Z",["2026-09-30T22:00:00Z","2026-10-31T23:00:00Z"],["2026-08-31T22:00:00Z","2026-09-30T22:00:00Z"],["2026-07-31T22:00:00Z","2026-10-31T23:00:00Z"]],
  ["2026-09-30T22:30:00Z",["2026-09-30T22:00:00Z","2026-10-31T23:00:00Z"],["2026-08-31T22:00:00Z","2026-09-30T22:00:00Z"],["2026-07-31T22:00:00Z","2026-10-31T23:00:00Z"]],
  ["2027-01-15T10:00:00Z",["2026-12-31T23:00:00Z","2027-01-31T23:00:00Z"],["2026-11-30T23:00:00Z","2026-12-31T23:00:00Z"],["2026-10-31T23:00:00Z","2027-01-31T23:00:00Z"]],
  ["2026-03-31T12:00:00Z",["2026-02-28T23:00:00Z","2026-03-31T22:00:00Z"],["2026-01-31T23:00:00Z","2026-02-28T23:00:00Z"],["2025-12-31T23:00:00Z","2026-03-31T22:00:00Z"]],
];
for(const [ahora,mes,pasado,tres] of casos){
  epoch=Z(ahora);
  for(const [preset,[d,h]] of [["month",mes],["last",pasado],["3m",tres]]){
    const b=ctx.presetBoundsMs(preset,{});
    assert.equal(b.from,Z(d),preset+" desde "+ahora);
    assert.equal(b.to,fin(h),preset+" hasta "+ahora);
    assert.equal(ctx.inBounds(b.to,b),true,"último milisegundo incluido "+preset);
    assert.equal(ctx.inBounds(b.to+1,b),false,"primer milisegundo del mes siguiente excluido "+preset);
  }
}
// Un apunte del 1/oct 00:01 en Madrid (30/9 22:01Z) es de octubre, no de septiembre.
epoch=Z("2026-10-15T10:00:00Z");
const state={budget:1000,settings:{expenseBanks:["sabadell"]},accounts:[{ent:"sabadell",role:"diario",spendFrom:true}],
  expenses:[{id:"a",date:"2026-09-30T22:01:00Z",amount:23,category:"super",ent:"sabadell",merchant:"a"},
    {id:"b",date:"2026-09-30T21:59:00Z",amount:500,category:"super",ent:"sabadell",merchant:"b"},
    {id:"c",date:"2026-10-31T22:59:00Z",amount:7,category:"super",ent:"sabadell",merchant:"c"}]};
const bounds=ctx.presetBoundsMs("month",{});
const period=ctx.gastosPeriodOf("month",bounds,null);
assert.equal(ctx.monthBudgetStats(state,null,null,null,period).spent,30,"el del 1/oct 00:01 y el último minuto de octubre en Madrid; no el de las 23:59 del 30/9");
assert.equal(ctx.inBounds(Z("2026-09-30T22:01:00Z"),bounds),true);
assert.equal(ctx.inBounds(Z("2026-10-31T22:59:59Z"),bounds),true);
assert.equal(ctx.inBounds(Z("2026-09-30T21:59:59Z"),bounds),false);
console.log("✓ "+process.env.TZ);
