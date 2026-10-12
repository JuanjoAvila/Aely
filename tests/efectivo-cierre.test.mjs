#!/usr/bin/env node
/**
 * FIN-01 — EL CIERRE DE MES REPARTE EL GASTO POR BANCO.
 *
 * Fallo que cubre (auditoría 2026-09-09, contrastado en código): `reconcileTR` sumaba TODOS los
 * gastos del mes cerrado y se los restaba a la cuenta de gasto diario, sin mirar `e.ent`. Una
 * compra pagada del sobre de efectivo bajaba Trade Republic y dejaba el sobre intacto — y el
 * sobre no arrastraba nada, porque `monthNetForAccount` recorre fijos/deudas/puntuales/flujos y
 * NO mira `s.expenses`.
 *
 * Lo malo es que el patrimonio TOTAL seguía cuadrando: los dos saldos por separado mentían y
 * nadie lo notaba. Durante el mes `saldoCuentaMostrada` sí reparte bien, así que el saldo del
 * sobre bajaba durante el mes y REBOTABA hacia arriba el día 1.
 *
 * La regla de reparto es la misma de `gastoDelMesPorBanco` (00-core), a propósito: si el cierre
 * usa un criterio y el saldo mostrado otro, vuelve el bug de «la app y el widget no dicen lo
 * mismo» por otra puerta.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

let ctx = loadPureLogicFromFile();
const guards=[];

let failed = 0;
function t(name, fn) {
  if(name.startsWith("FIN01")) guards.push({name,fn});
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { failed++; console.error("  ✗ " + name + "\n      " + e.message); }
}

// Mes anterior al reloj real, sin depender de en qué día se ejecute la suite.
function mesAtras(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  // `mk`/`mkOf` no salen del cargador de lógica pura; misma fórmula que 01-i18n.js:2288.
  const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  return { key: key, y: d.getFullYear(), m: d.getMonth() + 1 };
}
function diaDe(mes, dia) {
  return new Date(mes.y + "-" + String(mes.m).padStart(2, "0") + "-" + String(dia).padStart(2, "0") + "T12:00:00").toISOString();
}

function estado(o) {
  o = o || {};
  return {
    accounts: [
      { id: "tr1", ent: "trade_republic", name: "Trade Republic", value: o.tr != null ? o.tr : 1000, role: "diario", spendFrom: true, inject: 0 },
      { id: "ef1", ent: "efectivo", name: "Efectivo", value: o.cash != null ? o.cash : 100, role: "fijos" },
    ],
    expenses: o.expenses || [],
    fixed: [], debts: [], oneoffs: [], flows: [], investments: [],
    settings: { expenseBanks: ["efectivo"] },
    trAnchor: o.anchor,
  };
}
const cuenta = (s, ent) => s.accounts.find((a) => a.ent === ent);

console.log("efectivo-cierre");

const prev = mesAtras(1);

t("★ una compra en efectivo del mes cerrado baja el SOBRE, no Trade Republic", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(prev, 12) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 1000, "TR no debe moverse: esa compra no salió de TR");
  assert.equal(cuenta(ns, "efectivo").value, 80, "el sobre tiene que arrastrar sus propias compras");
});

t("el patrimonio total no cambia con el arreglo (lo que cambia es de quién sale)", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(prev, 12) }],
  });
  const ns = ctx.reconcileTR(s);
  const total = ns.accounts.reduce((a, x) => a + x.value, 0);
  assert.equal(total, 1080, "1100 − 20; el fallo antiguo también daba 1080 con los dos saldos torcidos");
});

t("las compras de la cuenta diaria se le siguen restando a ella", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 30, ent: "trade_republic", source: "macrodroid", category: "super", date: diaDe(prev, 5) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 970);
  assert.equal(cuenta(ns, "efectivo").value, 100);
});

t("un gasto SIN banco sigue cayendo en la cuenta de gasto diario (no cambia el comportamiento)", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 15, source: "manual", category: "otros", date: diaDe(prev, 8) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 985);
  assert.equal(cuenta(ns, "efectivo").value, 100);
});

t("gasto de un banco que NO es de gasto diario no toca ni TR ni el sobre", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 40, ent: "sabadell", source: "ob:sabadell", category: "recibos", date: diaDe(prev, 9) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 1000, "un recibo de Sabadell no sale del efectivo de TR");
  assert.equal(cuenta(ns, "efectivo").value, 100);
});

t("entra dinero en el sobre (importe negativo): el sobre SUBE al cerrar", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: -25, ent: "efectivo", source: "manual", category: "ingreso", date: diaDe(prev, 3) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 125);
  assert.equal(cuenta(ns, "trade_republic").value, 1000);
});

t("saque de cajero: neutro para el patrimonio, no descuadra ninguna de las dos", () => {
  // `applySaqueCajero` ya movió el dinero (TR −50 / sobre +50) y dejó un traspaso con ent del BANCO.
  // Al cerrar el mes ese apunte NO puede volver a restarse del sobre.
  const s = estado({
    tr: 950, cash: 150, anchor: prev.key,
    expenses: [{ id: "e1", amount: 50, ent: "trade_republic", source: "manual", category: "traspaso", noCard: true, merchant: "Cajero", date: diaDe(prev, 4) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 150, "el sobre ya recibió el dinero: no se le resta nada");
  assert.equal(cuenta(ns, "trade_republic").value, 900, "TR arrastra su propio apunte de cajero");
});

t("dos meses sin abrir la app: cada mes va a su banco", () => {
  const p1 = mesAtras(1), p2 = mesAtras(2);
  const s = estado({
    anchor: p2.key,
    expenses: [
      { id: "e1", amount: 10, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p2, 10) },
      { id: "e2", amount: 30, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p1, 10) },
      { id: "e3", amount: 5, ent: "trade_republic", source: "macrodroid", category: "super", date: diaDe(p1, 11) },
    ],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 60, "100 − 10 − 30");
  assert.equal(cuenta(ns, "trade_republic").value, 995, "1000 − 5");
});

t("sobre creado a mitad de camino: solo arrastra los gastos del mes que se cierra", () => {
  const p1 = mesAtras(1), p2 = mesAtras(2);
  const s = estado({
    anchor: p1.key,   // el ancla empieza en el mes pasado: el de hace dos NO se recorre
    expenses: [
      { id: "e1", amount: 40, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p2, 10) },
      { id: "e2", amount: 15, ent: "efectivo", source: "manual", category: "bares", date: diaDe(p1, 10) },
    ],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 85, "100 − 15; el mes anterior al ancla no se toca");
});

t("el mes EN CURSO no se cierra (lo pinta saldoCuentaMostrada, no reconcileTR)", () => {
  const hoy = mesAtras(0);
  const s = estado({
    anchor: hoy.key,
    expenses: [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(hoy, 1) }],
  });
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "efectivo").value, 100, "restarlo aquí Y en el saldo mostrado sería contarlo dos veces");
  assert.equal(cuenta(ns, "trade_republic").value, 1000);
});

t("cierre y saldo mostrado coinciden: el sobre no rebota el día 1", () => {
  // Durante el mes el sobre se pinta con `saldoCuentaMostrada`; al cerrarlo, `reconcileTR` deja
  // ese mismo número en `value`. Si los dos no coinciden, el saldo pega un salto el día 1.
  const gastos = [{ id: "e1", amount: 20, ent: "efectivo", source: "manual", category: "bares", date: diaDe(prev, 12) }];
  const spentByBank = ctx.gastoDelMesPorBanco(gastos, "trade_republic");
  const durante = ctx.saldoCuentaMostrada({ id: "ef1", ent: "efectivo", value: 100, role: "fijos" }, { spentByBank: spentByBank, paidNetByBank: {} });
  const ns = ctx.reconcileTR(estado({ anchor: prev.key, expenses: gastos }));
  assert.equal(durante, 80);
  assert.equal(cuenta(ns, "efectivo").value, durante, "el cierre tiene que dejar el saldo que ya se estaba pintando");
});

t("el round-up del cierre mira los mismos gastos que el de la pantalla", () => {
  // Durante el mes, `11-app-main.js:1483` estima el round-up sobre gastos ya filtrados por
  // `expenseCountsCash`. Al cerrar se calculaba sobre el mes ENTERO: una compra con tarjeta de un
  // banco que NO es de gasto diario inflaba el round-up y el saldo de TR pegaba un salto el día 1.
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 10.5, ent: "sabadell", source: "ob:sabadell", category: "super", date: diaDe(prev, 7) }],
  });
  s.accounts[0].roundup = 1;   // multiplicador x1
  const ns = ctx.reconcileTR(s);
  assert.equal(cuenta(ns, "trade_republic").value, 1000, "ni el gasto ni su calderilla salen de TR");
});

t("y sí cuenta la calderilla de las compras que la pantalla sí suma", () => {
  const s = estado({
    anchor: prev.key,
    expenses: [{ id: "e1", amount: 10.5, ent: "trade_republic", source: "macrodroid", category: "super", date: diaDe(prev, 7) }],
  });
  s.accounts[0].roundup = 1;
  const ns = ctx.reconcileTR(s);
  // 1000 − 10,50 de la compra − 0,50 de round-up
  assert.equal(cuenta(ns, "trade_republic").value, 989, "la compra de TR sí redondea");
});

// El cierre se contrasta con un libro en céntimos, sin reutilizar su reparto ni su fórmula.
// Un total correcto ocultaba saldos torcidos; también se comparan cierres mensuales y de golpe.
const realDate = Date;
function conReloj(iso, fn) {
  const previous = ctx.Date;
  ctx.Date = class extends realDate {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return realDate.parse(iso); }
  };
  try { return fn(); } finally { ctx.Date = previous; }
}
function fotoCuentas(s) {
  return Object.fromEntries(s.accounts.map(a => [a.ent, Math.round(a.value * 100)]));
}
function matrizCierre(diaria) {
  const s = {
    accounts: [{ id:"sb", ent:"sabadell", value:600, role:"fijos" }, { id:"cash", ent:"efectivo", value:100, role:"fijos" }],
    expenses: [], fixed:[{id:"luz",name:"Luz ficticia",amount:40,account:"sabadell",freq:"mes",day:8}],
    flows:[{id:"in",kind:"income",amount:200,to:"sabadell",freq:"mes",day:2}],
    debts:[],oneoffs:[],investments:[],settings:{expenseBanks:["efectivo","trade_republic"]},trAnchor:"2026-07"
  };
  if(diaria) s.accounts.unshift({id:"daily",ent:"trade_republic",value:1000,role:"diario",spendFrom:true,inject:100});
  [7,8,9].forEach((m,i) => {
    const date="2026-"+String(m).padStart(2,"0")+"-12T12:00:00.000Z";
    s.expenses.push({id:"cash"+m,ent:"efectivo",amount:20+i*10,date,source:"manual",category:"super",noCard:true});
    s.expenses.push({id:"receipt"+m,ent:"sabadell",amount:40,date,source:"ob",category:"recibos",noCard:true});
    if(diaria) s.expenses.push({id:"daily"+m,ent:"trade_republic",amount:10+i*10,date,source:"manual",category:"super",noCard:true});
  });
  s.expenses.push({id:"refund",ent:"efectivo",amount:-5,date:"2026-08-14",source:"manual",category:"super",noCard:true});
  s.expenses.push({id:"income",ent:"efectivo",amount:-25,date:"2026-09-14",source:"manual",category:"ingreso",noCard:true});
  return s;
}
for(const diaria of [false,true]) t("FIN01 libro independiente y tres cierres, "+(diaria?"con":"sin")+" diaria", () => {
  const initial=matrizCierre(diaria), batch=JSON.parse(JSON.stringify(initial)), steps=JSON.parse(JSON.stringify(initial));
  const ledger={sabadell:[60000,20000,-4000,20000,-4000,20000,-4000],efectivo:[10000,-2000,-3000,500,-4000,2500]};
  if(diaria) ledger.trade_republic=[100000,10000,-1000,10000,-2000,10000,-3000];
  const expected=Object.fromEntries(Object.entries(ledger).map(([bank,moves])=>[bank,moves.reduce((a,b)=>a+b,0)]));
  conReloj("2026-10-15T12:00:00Z",()=>ctx.reconcileTR(batch));
  for(const month of [8,9,10]) conReloj("2026-"+String(month).padStart(2,"0")+"-01T12:00:00Z",()=>ctx.reconcileTR(steps));
  assert.deepEqual(fotoCuentas(batch),expected,"saldo por cuenta frente al libro de movimientos");
  assert.deepEqual(fotoCuentas(steps),expected,"el acumulado mensual debe coincidir con el libro");
  assert.equal(Object.values(fotoCuentas(batch)).reduce((a,b)=>a+b,0),Object.values(expected).reduce((a,b)=>a+b,0),"patrimonio");
  const closed=JSON.stringify(batch);
  conReloj("2026-10-15T12:00:00Z",()=>ctx.reconcileTR(batch));
  assert.equal(JSON.stringify(batch),closed,"segunda apertura idempotente");
  assert.deepEqual(batch.expenses,initial.expenses,"el cierre nunca reescribe el histórico");
});
t("FIN01 cajero real desde diaria: patrimonio y saldo antes y después del cierre",()=> {
  const initial=estado({anchor:"2026-09"});
  const s=conReloj("2026-09-12T12:00:00Z",()=>ctx.applySaqueCajero(initial,"trade_republic",50));
  const spent=ctx.gastoDelMesPorBanco(s.expenses,"trade_republic");
  const shown=Object.fromEntries(s.accounts.map(a=>[a.ent,ctx.saldoCuentaMostrada(a,{spentByBank:spent})]));
  assert.deepEqual(shown,{trade_republic:950,efectivo:150},"retirada de 50, no de 100");
  assert.equal(Object.values(shown).reduce((a,b)=>a+b,0),1100,"traspaso neutro");
  conReloj("2026-10-15T12:00:00Z",()=>ctx.reconcileTR(s));
  assert.deepEqual(fotoCuentas(s),{trade_republic:95000,efectivo:15000},"libro: banco -50, sobre +50");
  assert.equal(s.expenses.filter(e=>ctx.expenseCountsBudget(e,s)).length,0,"no es gasto presupuestario");
});
t("FIN01 crear el sobre a mitad de mes no vuelve a cobrar gastos anteriores al saldo contado",()=> {
  const initial=estado({anchor:"2026-07"});
  initial.accounts=initial.accounts.filter(a=>a.ent!=="efectivo");
  initial.expenses=[
    {id:"older-cash",amount:40,ent:"efectivo",date:"2026-07-12",category:"super",source:"manual",noCard:true},
    {id:"current-cash",amount:20,ent:"efectivo",date:"2026-09-12",category:"super",source:"manual",noCard:true}
  ];
  const s=conReloj("2026-09-20T12:00:00Z",()=>ctx.ensureEfectivoAccount(initial,100));
  const cash=s.accounts.find(a=>a.ent==="efectivo");
  assert.equal(ctx.saldoCuentaMostrada(cash,{spentByBank:{efectivo:20}}),100,"se han contado 100 billetes hoy, no al inicio del mes");
  conReloj("2026-10-15T12:00:00Z",()=>ctx.reconcileTR(s));
  assert.deepEqual(fotoCuentas(s),{trade_republic:100000,efectivo:10000},"el saldo contado no incluye meses previos a crear el sobre");
});
const built=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
for(const [name,from,to,guard] of [
  ["sin diaria no cierra", "// El sobre y los recibos también arrastran meses", "if(!acc) return s;\n  // El sobre y los recibos también arrastran meses", "FIN01 libro independiente y tres cierres, sin diaria"],
  ["cajero descuenta base diaria", "&& !accDaily(a)", "", "FIN01 cajero real desde diaria: patrimonio y saldo antes y después del cierre"],
  ["efectivo no arrastra compras", 'if(isEfectivoEnt(a2)) v -= (gastoPorBanco["efectivo"]||0);', "", "FIN01 libro independiente y tres cierres, con diaria"],
  ["recibo del otro banco no arrastra", '(a2.value||0) + monthNetForAccount(s, a2.ent, ay, am+1, null)', '(a2.value||0)', "FIN01 libro independiente y tres cierres, con diaria"],
  ["alta de efectivo sin reanclar", 'accounts[accounts.length-1].value=+(v+(ins.spentByBank.efectivo||0)-(ins.paidNetByBank.efectivo||0)).toFixed(2);', "", "FIN01 crear el sobre a mitad de mes no vuelve a cobrar gastos anteriores al saldo contado"],
  ["alta de efectivo arrastra meses anteriores", 'if(isEfectivoEnt(a2)&&a2.cashAnchor&&key<a2.cashAnchor) return;', "", "FIN01 crear el sobre a mitad de mes no vuelve a cobrar gastos anteriores al saldo contado"],
]) t("mutación causal: "+name,()=> {
  assert.equal(built.split(from).length,2,"mutación única y anclada al código real");
  const original=ctx;
  ctx=loadPureLogic(built.replace(from,to));
  try { assert.throws(()=>guards.find(g=>g.name===guard).fn(),assert.AssertionError,"el guardián debe tumbar este defecto"); }
  finally { ctx=original; }
});

if (failed) { console.error("\nefectivo-cierre: " + failed + " fallo(s)"); process.exit(1); }
console.log("efectivo-cierre: OK");
