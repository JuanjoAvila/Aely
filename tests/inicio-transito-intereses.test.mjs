import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

/* Dos inflados de la gráfica de Inicio medidos con la cartera real (revisión 14/10), con datos
 * sintéticos:
 * (a) Dinero en tránsito a un bróker sin pata: la salida del banco es aportación desde ese día
 *     y se queda en inversiones hasta la primera foto que la recoge. Antes el traspaso quedaba
 *     neutro (todos los días anteriores, 500 € más bajos) o la foto del mismo día lo daba por
 *     recibido (bache de −500 € mientras viajaba).
 * (b) Intereses de la deuda: con tipo, cada mes hacia atrás se deshace «saldo × (1 + tipo/12) −
 *     cuota»; sin tipo, la cuota entera es capital y la «i» lo dice. */
const c = loadPureLogicFromFile();
const today = "2026-10-14", DAY = 864e5, iso = t => new Date(t).toISOString().slice(0, 10);
const days = (from, to) => { const out = []; for (let t = Date.parse(from + "T12:00:00Z"); t <= Date.parse(to + "T12:00:00Z"); t += DAY) out.push(iso(t)); return out; };
const values = s => [...new Set(s.map(p => p.value))];
const plain = x => JSON.parse(JSON.stringify(x));

function cartera({ category = "traspaso", plan = true, photos, invested = 5500, note = "TRANSFERENCIA A Yo mismo" }) {
  return {
    accounts: [{ id: "a", ent: "sabadell", name: "Banco", value: 1000, role: "fijos", bankIban: "synthetic-a" }],
    investments: [{ id: "mi", ent: "myinvestor", name: "Fondo sintético", value: invested }],
    aportaciones: plan ? [{ id: "p", ent: "myinvestor", name: "Fondo sintético", amount: 500 }] : [],
    invHistory: photos, assets: [], debts: [],
    expenses: [{ id: "alta", date: "2026-09-01T12:00:00Z", amount: 0, ent: "sabadell", category: "super" },
      { id: "t", date: "2026-09-30T10:00:00Z", amount: 500, ent: "sabadell", category, merchant: "Yo mismo", note }],
  };
}
const diarias = (llega = "2026-10-06") => days("2026-09-01", today).map(d => ({ d, v: d < llega ? 5000 : 5500 }));
const semanales = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"].map(d => ({ d, v: d < "2026-10-06" ? 5000 : 5500 }));

function comprobar(m) {
  const S = (state, invested = 5500) => plain(m.netWorthSeries(state, { today, liquid: 1000, invested, debtTotal: 0 }));
  // (a) El dinero solo cambia de sitio: 6.500 € todos los días, con fotos diarias y semanales,
  // tanto si el banco lo llama «traspaso» como «otros» con concepto de transferencia.
  assert.deepEqual(values(S(cartera({ photos: diarias() }))), [6500], "foto diaria: sin bache en tránsito ni días anteriores más bajos");
  assert.deepEqual(values(S(cartera({ photos: semanales }))), [6500], "foto semanal: igual");
  assert.deepEqual(values(S(cartera({ category: "otros", photos: diarias() }))), [6500], "«otros» con concepto de transferencia y aportación periódica");
  // Llega el mismo día (bróker al instante): tampoco cambia nada.
  assert.deepEqual(values(S(cartera({ photos: diarias("2026-09-30") }))), [6500], "foto del mismo día");
  // Sin foto posterior que lo recoja no se inventa: el traspaso sigue neutro (plano en lo que
  // dice hoy Cartera) y una transferencia «otros», gasto.
  assert.deepEqual(values(S(cartera({ photos: diarias("2099-01-01"), invested: 5000 }), 5000)), [6000], "traspaso sin foto posterior: neutro");
  const otros = S(cartera({ category: "otros", photos: diarias("2099-01-01"), invested: 5000 }), 5000);
  assert.equal(otros.find(p => p.day === "2026-09-29").value, 6500); assert.equal(otros.find(p => p.day === "2026-09-30").value, 6000, "«otros» sin foto: gasto, como antes");
  // Una foto que llega más de diez días después no lo recoge (sería bolsa, no la aportación).
  assert.deepEqual(values(S(cartera({ photos: diarias("2026-10-12") }))).length > 1, true, "doce días después ya no casa");
  // Sin aportación periódica ni otra pista, un traspaso de una pata sigue neutro (como antes):
  // el vaivén de la bolsa no puede convertir cualquier transferencia en inversión.
  const suelto = S(cartera({ plan: false, photos: diarias() }));
  assert.equal(suelto.find(p => p.day === "2026-09-29").value, 6000); assert.equal(suelto.at(-1).value, 6500, "sin enlace: neutro");
  // Un importe que no es el de la aportación tampoco casa.
  assert.equal(S({ ...cartera({ photos: diarias() }), aportaciones: [{ id: "p", ent: "myinvestor", amount: 300 }] }).find(p => p.day === "2026-09-29").value, 6000);

  // (b) Intereses. Hipoteca al 1,2 % (0,1 % al mes), 600 € de cuota el día 1, saldo de hoy 100.000.
  const month = 2026 * 12 + 9;
  const hipo = (extra = {}) => ({ debts: [{ id: "h", name: "Hipoteca sintética", value: 100000, monthly: 600, day: 1, asOf: month, ...extra }] });
  const atras = (n, r) => { let v = 100000; for (let i = 0; i < n; i++) v = (v + 600) / (1 + r); return v; };
  const con = m.netWorthDebtPolicy(hipo({ apr: 1.2 }), today, undefined);
  assert.equal(con.at(today), 100000, "hoy, el saldo que pinta la app");
  assert.ok(Math.abs(con.at("2026-09-15") - atras(1, 0.001)) < 1e-6, "un mes atrás: (100.000 + 600) / 1,001");
  assert.ok(Math.abs(con.at("2026-08-15") - atras(2, 0.001)) < 1e-6, "dos meses atrás");
  assert.ok(Math.abs((con.at("2026-09-15") - con.at(today)) - (600 - atras(1, 0.001) * 0.001)) < 1e-6, "capital = cuota − saldo × tipo/12");
  const sin = m.netWorthDebtPolicy(hipo(), today, undefined), cero = m.netWorthDebtPolicy(hipo({ apr: 0 }), today, undefined);
  assert.equal(sin.at("2026-08-15"), 101200, "sin tipo: la cuota entera es capital");
  assert.equal(cero.at("2026-08-15"), 101200, "tipo 0: no cambia nada");
  assert.equal(m.netWorthDebtPolicy(hipo({ apr: 1.2, amort: 450 }), today, undefined).at("2026-08-15"), 100900, "con un capital propio manda ese capital");
  assert.deepEqual([sin, cero, con].map(p => p.notes[0].noRate), [true, false, false], "solo la deuda SIN tipo se declara");
  // La «i» lo dice en la fila de deudas.
  const fmt = new Intl.DateTimeFormat("es", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
  const filas = st => m.netWorthInfoRows(m.netWorthSeries({ accounts: [{ id: "a", ent: "efectivo", name: "Hucha", value: 500, role: "fijos" }], accountBalanceHistory: { "acc:a": [{ day: "2026-09-20", value: 500 }, { day: today, value: 500 }] }, investments: [], assets: [], expenses: [], ...st }, { today, liquid: 500, invested: 0, debtTotal: 100000 }), fmt, null).find(r => r.k === "Deudas");
  assert.equal(filas(hipo()).v, "según sus cuotas; las cuotas sin tipo de interés se cuentan enteras como capital");
  assert.equal(filas(hipo({ apr: 1.2 })).v, "según sus cuotas");
}
comprobar(c);
console.log("inicio-transito-intereses: tránsito a bróker (foto diaria, semanal, sin foto, sin enlace) e intereses (con tipo, sin tipo, tipo 0) OK");

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const mutantes = [
  ["la foto del mismo día lo recoge", "if(room[i]*2>=c.cents){ room[i]-=c.cents; c.absorb=photos[i].day; break; }", "{ c.absorb=c.day; break; }"],
  ["sin enlace por aportación periódica", "const plan=!!invKnown&&", "const plan=false&&"],
  ["traspaso sin foto ya no neutro", "if(c.absorb==null&&c.transit){", "if(false){"],
  ["ventana de diez días", "Date.parse(c.day+\"T12:00:00Z\")>10*864e5) continue;", "Date.parse(c.day+\"T12:00:00Z\")>100*864e5) continue;"],
  ["intereses fuera", "value=(value+Number(d.monthly))/(1+rate);", "value=value+Number(d.monthly);"],
  ["tipo anual, no mensual", "Number(d.apr)/1200:0;", "Number(d.apr)/100:0;"],
  ["sin aviso de cuotas sin tipo", "noRate:estimated&&rebuilt(d)&&", "noRate:false&&"],
];
for (const [nombre, de, a] of mutantes) {
  assert.equal(html.split(de).length, 2, "mutante único real: " + nombre);
  assert.throws(() => comprobar(loadPureLogic(html.replace(de, a))), assert.AssertionError, "se mata el mutante: " + nombre);
}
console.log("inicio-transito-intereses: " + mutantes.length + " mutaciones muertas");
