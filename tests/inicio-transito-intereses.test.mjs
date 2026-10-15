import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

/* Dos inflados de la gráfica de Inicio medidos con la cartera real (revisión 14/10), con datos
 * sintéticos:
 * (a) Dinero en tránsito a un bróker: la salida del banco es aportación desde ese día y se queda
 *     en inversiones hasta la primera foto que la recoge. Antes el traspaso quedaba neutro (todos
 *     los días anteriores, 500 € más bajos) o la foto del mismo día lo daba por recibido (bache
 *     de −500 € mientras viajaba). La aportación periódica a nombre del titular basta con que la
 *     foto suba una cuarta parte; si el bróker tiene cuenta propia en la app, no se cuenta dos veces.
 * (b) Intereses de la deuda: con tipo, cada mes hacia atrás se deshace «saldo × (1 + tipo/12) −
 *     cuota»; sin tipo, la cuota entera es capital; un tipo que no cuadra con la cuota se ignora.
 *     La «i» dice las dos cosas. */
const c = loadPureLogicFromFile();
const today = "2026-10-14", DAY = 864e5, iso = t => new Date(t).toISOString().slice(0, 10);
const days = (from, to) => { const out = []; for (let t = Date.parse(from + "T12:00:00Z"); t <= Date.parse(to + "T12:00:00Z"); t += DAY) out.push(iso(t)); return out; };
const values = s => [...new Set(s.map(p => p.value))];
const plain = x => JSON.parse(JSON.stringify(x));
const at = (s, day) => s.find(p => p.day === day).value;

function cartera({ category = "traspaso", plan = true, photos, invested = 5500, note = "TRANSFERENCIA A Yo mismo", merchant = "Yo mismo", date = "2026-09-30", extra = {} }) {
  return {
    accounts: [{ id: "a", ent: "sabadell", name: "Banco", value: 1000, role: "fijos", bankIban: "synthetic-a" }],
    investments: [{ id: "mi", ent: "myinvestor", name: "Fondo sintético", value: invested }],
    aportaciones: plan ? [{ id: "p", ent: "myinvestor", name: "Fondo sintético", amount: 500 }] : [],
    invHistory: photos, assets: [], debts: [],
    expenses: [{ id: "alta", date: "2026-09-01T12:00:00Z", amount: 0, ent: "sabadell", category: "super" },
      { id: "t", date: date + "T10:00:00Z", amount: 500, ent: "sabadell", category, merchant, note, ...extra }],
  };
}
const fotos = (cambios) => days("2026-09-01", today).map(d => ({ d, v: cambios.reduce((v, [desde, x]) => d >= desde ? x : v, 5000) }));
const diarias = (llega = "2026-10-06") => fotos([[llega, 5500]]);
const semanales = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"].map(d => ({ d, v: d < "2026-10-06" ? 5000 : 5500 }));

function comprobar(m) {
  const S = (state, invested = 5500) => plain(m.netWorthSeries(state, { today, liquid: 1000, invested, debtTotal: 0 }));
  // (a) El dinero solo cambia de sitio: 6.500 € todos los días, con fotos diarias y semanales,
  // tanto si el banco lo llama «traspaso» como «otros» con concepto de transferencia.
  assert.deepEqual(values(S(cartera({ photos: diarias() }))), [6500], "foto diaria: sin bache en tránsito ni días anteriores más bajos");
  assert.deepEqual(values(S(cartera({ photos: semanales }))), [6500], "foto semanal: igual");
  assert.deepEqual(values(S(cartera({ category: "otros", photos: diarias() }))), [6500], "«otros» con concepto de transferencia y aportación periódica");
  assert.deepEqual(values(S(cartera({ photos: diarias("2026-09-30") }))), [6500], "foto del mismo día");
  // Llega con la bolsa cayendo 300 ese día (la foto sube 200): la aportación periódica casa igual
  // y el mes dice −300, lo que de verdad pasó.
  const caida = S(cartera({ category: "otros", photos: fotos([["2026-10-06", 5200]]), invested: 5200 }), 5200);
  assert.equal(at(caida, "2026-10-05"), 6500); assert.equal(at(caida, "2026-10-06"), 6200, "llega con caída: −300 de bolsa, no −800");
  assert.equal(at(caida, today) - at(caida, "2026-09-14"), -300, "hoy frente al 14/9: −300");
  // En camino hoy (salió hace seis días): cuenta como inversión hasta ayer; hoy manda Cartera.
  const camino = S(cartera({ category: "otros", date: "2026-10-08", photos: fotos([]), invested: 5000 }), 5000);
  assert.deepEqual([at(camino, "2026-10-07"), at(camino, "2026-10-08"), at(camino, "2026-10-13"), at(camino, today)], [6500, 6500, 6500, 6000], "en tránsito: sin −500 cada día que viaja");
  // Diez días sin foto que la recoja: vuelve a ser una salida (aquí, 14 días).
  const perdida = S(cartera({ photos: fotos([]), invested: 5000 }), 5000);
  assert.deepEqual([at(perdida, "2026-09-29"), at(perdida, "2026-09-30"), at(perdida, today)], [6500, 6000, 6000], "más de diez días sin llegar: salida");
  // Un traspaso enlazado por otra pista (sin aportación periódica) y sin foto sigue neutro.
  assert.deepEqual(values(S(cartera({ plan: false, photos: fotos([]), invested: 5000, extra: { investmentId: "mi" } }), 5000)), [6000], "traspaso enlazado sin foto posterior: neutro");
  const otros = S(cartera({ category: "otros", plan: false, photos: fotos([]), invested: 5000 }), 5000);
  assert.equal(at(otros, "2026-09-29"), 6500); assert.equal(at(otros, "2026-09-30"), 6000, "«otros» sin enlace: gasto, como antes");
  // Una foto que llega más de diez días después no lo recoge (sería bolsa, no la aportación).
  assert.ok(values(S(cartera({ photos: diarias("2026-10-12") }))).length > 1, "doce días después ya no casa");
  // Sin aportación periódica ni otra pista, un traspaso de una pata sigue neutro: el vaivén de la
  // bolsa no puede convertir cualquier transferencia en inversión.
  const suelto = S(cartera({ plan: false, photos: diarias() }));
  assert.equal(at(suelto, "2026-09-29"), 6000); assert.equal(suelto.at(-1).value, 6500, "sin enlace: neutro");
  // Otro importe, o el mismo importe a otra persona (el alquiler al casero), no es la aportación.
  assert.equal(at(S({ ...cartera({ photos: diarias() }), aportaciones: [{ id: "p", ent: "myinvestor", amount: 300 }] }), "2026-09-29"), 6000);
  const casero = S(cartera({ category: "otros", note: "TRANSFERENCIA A Casero", merchant: "Casero", photos: fotos([["2026-10-03", 5300]]), invested: 5300 }), 5300);
  assert.deepEqual([at(casero, "2026-09-29"), at(casero, "2026-09-30"), at(casero, "2026-10-03")], [6500, 6000, 6300], "el alquiler es gasto aunque la bolsa suba ese día");
  // A nombre del titular también vale con su nombre del perfil, no solo con «yo mismo».
  const conNombre = { ...cartera({ category: "otros", note: "TRANSFERENCIA A Ana María Sintética", merchant: "Ana María Sintética", photos: diarias() }), settings: { profile: { fullName: "Ana María Sintética" } } };
  assert.deepEqual(values(S(conNombre)), [6500], "concepto con el nombre del titular");
  // El bróker tiene cuenta propia (manual, con histórico desde el 1/10, después de la salida): la
  // llegada la recoge ese saldo y la aportación periódica no se suma otra vez (6/10: −801 con la cartera real).
  const propia = { ...cartera({ photos: diarias() }),
    accounts: [{ id: "a", ent: "sabadell", name: "Banco", value: 1000, role: "fijos", bankIban: "synthetic-a" }, { id: "mic", ent: "myinvestor", name: "Efectivo", value: 20, role: "fijos" }],
    accountBalanceHistory: { "acc:mic": days("2026-10-01", today).map(d => ({ day: d, value: d < "2026-10-06" ? 520 : 20 })) } };
  assert.deepEqual(values(plain(m.netWorthSeries(propia, { today, liquid: 1020, invested: 5500, debtTotal: 0 }))), [6520], "bróker con cuenta propia: sin doble conteo");

  // (b) Intereses. Hipoteca al 1,2 % (0,1 % al mes), 600 € de cuota el día 1, saldo de hoy 100.000.
  const month = 2026 * 12 + 9;
  const hipo = (extra = {}) => ({ debts: [{ id: "h", name: "Hipoteca sintética", value: 100000, monthly: 600, day: 1, asOf: month, ...extra }] });
  const atras = (n, r) => { let v = 100000; for (let i = 0; i < n; i++) v = (v + 600) / (1 + r); return v; };
  const con = m.netWorthDebtPolicy(hipo({ apr: 1.2 }), today, undefined);
  assert.equal(con.at(today), 100000, "hoy, el saldo que pinta la app");
  assert.ok(Math.abs(con.at("2026-09-15") - atras(1, 0.001)) < 1e-6, "un mes atrás: (100.000 + 600) / 1,001");
  assert.ok(Math.abs(con.at("2026-08-15") - atras(2, 0.001)) < 1e-6, "dos meses atrás");
  assert.ok(Math.abs((con.at("2026-09-15") - con.at(today)) - (600 - atras(1, 0.001) * 0.001)) < 1e-6, "capital = cuota − saldo × tipo/12");
  assert.equal(m.netWorthDebtPolicy(hipo({ apr: "1,2" }), today, undefined).at("2026-08-15"), con.at("2026-08-15"), "«1,2» escrito con coma vale como 1,2");
  const sin = m.netWorthDebtPolicy(hipo(), today, undefined), cero = m.netWorthDebtPolicy(hipo({ apr: 0 }), today, undefined);
  assert.equal(sin.at("2026-08-15"), 101200, "sin tipo: la cuota entera es capital");
  assert.equal(cero.at("2026-08-15"), 101200, "tipo 0: no cambia nada");
  assert.equal(m.netWorthDebtPolicy(hipo({ apr: 1.2, amort: 450 }), today, undefined).at("2026-08-15"), 100900, "con un capital propio manda ese capital");
  // Un 120 tecleado por 1,20: 10.000 € de intereses al mes con 600 de cuota. No se aplica.
  const mal = m.netWorthDebtPolicy(hipo({ apr: 120 }), today, undefined);
  assert.equal(mal.at("2026-08-15"), 101200, "tipo imposible: se ignora");
  assert.equal(m.netWorthDebtPolicy(hipo({ apr: 7.2 }), today, undefined).notes[0].badRate, true, "justo en la cuota (600 de intereses) ya no cuadra");
  assert.deepEqual([sin, cero, con, mal].map(p => [p.notes[0].noRate, p.notes[0].badRate]), [[true, false], [false, false], [false, false], [false, true]]);
  // La «i» lo dice en la fila de deudas.
  const fmt = new Intl.DateTimeFormat("es", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
  const filas = st => m.netWorthInfoRows(m.netWorthSeries({ accounts: [{ id: "a", ent: "efectivo", name: "Hucha", value: 500, role: "fijos" }], accountBalanceHistory: { "acc:a": [{ day: "2026-09-20", value: 500 }, { day: today, value: 500 }] }, investments: [], assets: [], expenses: [], ...st }, { today, liquid: 500, invested: 0, debtTotal: 100000 }), fmt, null).find(r => r.k === "Deudas");
  assert.equal(filas(hipo()).v, "según sus cuotas; las cuotas sin tipo de interés se cuentan enteras como capital");
  assert.equal(filas(hipo({ apr: 1.2 })).v, "según sus cuotas");
  assert.equal(filas(hipo({ apr: 120 })).v, "según sus cuotas; un tipo de interés que no cuadra con su cuota se ignora");
}
comprobar(c);
console.log("inicio-transito-intereses: tránsito a bróker (foto diaria, semanal, con caída, en camino, sin foto, sin enlace, casero, cuenta propia) e intereses (con tipo, coma, sin tipo, tipo 0, imposible) OK");

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const mutantes = [
  ["la foto del mismo día lo recoge", "if(room[i]*(c.plan?4:2)>=c.cents){ room[i]-=c.cents; c.absorb=photos[i].day; break; }", "{ c.absorb=c.day; break; }"],
  ["la aportación periódica exige la mitad", "room[i]*(c.plan?4:2)>=c.cents", "room[i]*2>=c.cents"],
  ["sin enlace por aportación periódica", "const plan=!!invKnown&&", "const plan=false&&"],
  ["bróker con cuenta propia en el plan", "!flowBanks[p.ent]&&!owned[p.ent]&&", "!flowBanks[p.ent]&&"],
  ["cualquier destinatario", "&&toHolder(e)&&", "&&"],
  ["en camino no cuenta", "if(c.absorb==null&&c.plan&&todayMs-Date.parse(c.day+\"T12:00:00Z\")<=WINDOW) c.absorb=\"9999-12-31\";", ""],
  ["traspaso sin foto ya no neutro", "if(c.absorb==null&&c.transit){", "if(false){"],
  ["ventana de diez días", "const WINDOW=10*864e5,", "const WINDOW=100*864e5,"],
  ["intereses fuera", "value=(value+Number(d.monthly))/(1+rate);", "value=value+Number(d.monthly);"],
  ["tipo anual, no mensual", "const rate=apr/1200,", "const rate=apr/100,"],
  ["sin cota del tipo", "return today*rate>=Number(d.monthly)?{rate:0,bad:true}:{rate:rate,bad:false};", "return {rate:rate,bad:false};"],
  ["coma decimal", "Number(String(d.apr).replace(\",\",\".\"))", "Number(d.apr)"],
  ["sin aviso de cuotas sin tipo", "noRate:estimated&&rebuilt(d)&&", "noRate:false&&"],
];
for (const [nombre, de, a] of mutantes) {
  assert.equal(html.split(de).length, 2, "mutante único real: " + nombre);
  assert.throws(() => comprobar(loadPureLogic(html.replace(de, a))), assert.AssertionError, "se mata el mutante: " + nombre);
}
console.log("inicio-transito-intereses: " + mutantes.length + " mutaciones muertas");
