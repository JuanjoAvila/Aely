import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

/* «X € más que el mes pasado» con el ciclo de nómina conocido (feedback 14/10, producción 4.26.126).
 * Con un patrimonio que SUBE dentro del mes (cuotas que son capital, bolsa) el mínimo de cada
 * ventana de 45 días no es la víspera del cobro: cae en el borde de la ventana, mezcla dos
 * nóminas con un solo mes de gastos y la cifra cambia de un día para otro sin moverse un euro.
 * Con el ciclo conocido se compara víspera del cobro actual contra víspera del anterior.
 * Datos sintéticos con la forma de esa serie: nada personal. */
const c = loadPureLogicFromFile();
const DAY = 864e5, ms = d => Date.parse(d + "T12:00:00Z"), iso = t => new Date(t).toISOString().slice(0, 10);
// Nómina a fin de mes que baila con el calendario laboral (28 a 31).
const PAYDAYS = ["2026-04-30", "2026-05-29", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-30", "2026-11-30"];
function serie({ drop } = {}) {
  const out = []; let v = 180000;
  for (let t = ms("2026-04-01"); t <= ms("2026-12-15"); t += DAY) {
    const day = iso(t), dd = Number(day.slice(8));
    v += 40;                                   // capital de la hipoteca y bolsa: sube cada día
    if (dd === 5) v -= 1500;                   // la tarjeta del mes
    if (dd === 30) v -= 200;                   // cuota de la hipoteca el 30: solo los intereses bajan
    if (PAYDAYS.includes(day)) v += 3333;      // nómina
    if (drop && day === drop.day) v -= drop.amount;
    out.push({ day, value: Math.round(v * 100) / 100 });
  }
  return out;
}
// El ciclo lo reconoce el mismo lector que la tarjeta del presupuesto: nómina por nombre.
const estado = {
  settings: { budgetCycle: true }, flows: [], deleted: [], accounts: [{ id: "a", ent: "sabadell", value: 1000, role: "diario", spendFrom: true }],
  expenses: PAYDAYS.map(d => ({ id: "pay-" + d, date: d + "T10:00:00Z", amount: -3333, ent: "sabadell", category: "ingreso", merchant: "Nómina sintética" }))
    .concat([{ id: "bizum", date: "2026-08-15T10:00:00Z", amount: -500, ent: "sabadell", category: "bizum", merchant: "Bizum sintético" }]),
};
const full = serie(), at = (s, day) => s.find(p => p.day === day).value;
const eve = day => iso(ms(day) - DAY);
const hoy = (m, s, day, id = "1m", pays = m.netWorthPaydays(estado, ms(day))) => m.netWorthCompare(s.filter(p => p.day <= day), id, day, 0, pays);

function comprobar(m) {
  // Lector de cobros: los del histórico, sin el Bizum, en orden y en día de Madrid.
  assert.deepEqual([...m.netWorthPaydays(estado, ms("2026-10-14"))], PAYDAYS.filter(d => d <= "2026-10-14"), "las nóminas encadenadas, el Bizum fuera");
  assert.equal(m.netWorthPaydays({ ...estado, expenses: [] }, ms("2026-10-14")), null, "sin nóminas no hay ciclo");

  // 60 días seguidos: la cifra solo cambia el día que entra una nómina (al cruzar su víspera).
  let antes = null, saltos = [];
  for (let t = ms("2026-09-01"); t <= ms("2026-10-31"); t += DAY) {
    const day = iso(t), k = hoy(m, full, day);
    assert.equal(k.basis, "payday", day + ": con ciclo compara vísperas");
    if (antes && k.delta !== antes.delta) saltos.push(day);
    antes = k;
  }
  assert.deepEqual(saltos, ["2026-09-30", "2026-10-30"], "solo salta al cobrar");

  // Víspera a víspera, al céntimo, contra la serie leída por otro camino.
  const k = hoy(m, full, "2026-10-14");
  assert.equal(k.delta, Math.round((at(full, eve("2026-09-30")) - at(full, eve("2026-08-31"))) * 100) / 100, "víspera del cobro actual menos víspera del anterior");
  assert.equal(k.days, 30); assert.equal(k.months, 1); assert.equal(k.verdict, "up");
  // 3M: el cobro más cercano a tres meses atrás (30/6); Todo: el primero con víspera en la serie.
  const k3 = hoy(m, full, "2026-10-14", "3m");
  assert.equal(k3.delta, Math.round((at(full, eve("2026-09-30")) - at(full, eve("2026-06-30"))) * 100) / 100, "3M víspera a víspera");
  assert.equal(k3.months, 3);
  const all = hoy(m, full, "2026-10-14", "all");
  assert.equal(all.delta, Math.round((at(full, eve("2026-09-30")) - at(full, eve("2026-04-30"))) * 100) / 100, "Todo: desde la primera víspera");
  assert.equal(all.months, 5);

  // Un gasto que deja hoy por debajo de la víspera se ve el mismo día, no al cobrar.
  const gasto = serie({ drop: { day: "2026-10-10", amount: 6000 } });
  const tras = hoy(m, gasto, "2026-10-10"), previo = hoy(m, gasto, "2026-10-09");
  assert.ok(tras.delta < previo.delta - 2000, "el gasto grande entra en la cifra el mismo día");
  assert.equal(tras.delta, Math.round((at(gasto, "2026-10-10") - at(gasto, eve("2026-08-31"))) * 100) / 100);

  // Sin ciclo manda la regla de siempre (mínimo de 45 días), calculada aquí a mano.
  const low = (s, end) => Math.min(...s.slice(end - 44, end + 1).map(p => p.value));
  const s14 = full.filter(p => p.day <= "2026-10-14"), n = s14.length;
  const viejo = m.netWorthCompare(s14, "1m", "2026-10-14", 0, null);
  assert.equal(viejo.basis, undefined, "sin ciclo no se presume la víspera");
  assert.equal(viejo.delta, Math.round((low(s14, n - 1) - low(s14, n - 46)) * 100) / 100, "regla vieja intacta");
  assert.equal(viejo.days, 45);
  // Un cobro que no casa con la distancia pedida no se fuerza: vuelve la regla vieja.
  assert.equal(m.netWorthCompare(s14, "1m", "2026-10-14", 0, ["2026-07-31", "2026-09-30"]).basis, undefined, "cobro a dos meses no vale para 1M");
  assert.equal(m.netWorthCompare(s14, "1m", "2026-10-14", 0, ["2026-09-30"]).basis, undefined, "con un solo cobro no hay con qué comparar");
  // La serie corta sigue sin veredicto aunque haya ciclo (45 días a cada lado).
  assert.equal(m.netWorthCompare(s14.slice(-89), "1m", "2026-10-14", 0, PAYDAYS), null);
}
comprobar(c);
// La regla vieja con esta serie salta sin moverse un euro: es justo el fallo que se arregla.
let saltosViejos = 0, antes = null;
for (let t = ms("2026-09-01"); t <= ms("2026-10-31"); t += DAY) {
  const day = iso(t), k = hoy(c, full, day, "1m", null);
  if (antes && k.delta !== antes.delta && !PAYDAYS.includes(day)) saltosViejos++;
  antes = k;
}
assert.ok(saltosViejos > 5, "la regla de 45 días cambiaba la cifra sin cobro de por medio");
console.log("inicio-vispera-cobro: víspera a víspera estable, exacta, gasto del día visible y sin ciclo regla vieja OK");

// Cada mutante devuelve el fallo o una de sus variantes y tiene que tumbar el test.
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const mutantes = [
  ["volver a la regla vieja", "const pay=netWorthPaydayCompare(series,back,paydays);", "const pay=null;"],
  ["hoy en vez de la víspera", "for(let i=at[cur];i<n;i++) if(series[i].value<now) now=series[i].value;", "now=series[n-1].value;"],
  ["sin mínimo desde la víspera", "for(let i=at[cur];i<n;i++) if(series[i].value<now) now=series[i].value;", "now=series[at[cur]].value;"],
  ["el cobro de hoy en vez de la víspera", "const eve=new Date(dayMs(day)-864e5).toISOString().slice(0,10);", "const eve=day;"],
  ["sin tolerancia de distancia", "if(off<=10*864e5 && off<best){ best=off; prev=eve; }", "if(off<best){ best=off; prev=eve; }"],
];
for (const [nombre, de, a] of mutantes) {
  assert.equal(html.split(de).length, 2, "mutante único real: " + nombre);
  assert.throws(() => comprobar(loadPureLogic(html.replace(de, a))), assert.AssertionError, "se mata el mutante: " + nombre);
}
console.log("inicio-vispera-cobro: " + mutantes.length + " mutaciones muertas");
