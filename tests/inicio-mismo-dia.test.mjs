import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

/* «X € más que el mes pasado» = hoy frente al mismo día de hace un mes (3M: tres meses; Todo:
 * el primer punto), los dos extremos que se ven en la gráfica (decisión del dueño, 14/10). Antes
 * comparaba mínimos de dos ventanas de 45 días y con un patrimonio que sube dentro del mes
 * mezclaba dos nóminas con un mes de gastos (+3.769 € con +1.452 de verdad). Datos sintéticos. */
const c = loadPureLogicFromFile();
const DAY = 864e5, iso = t => new Date(t).toISOString().slice(0, 10);
// Cada día un valor distinto, que sube dentro del mes y con un bache a mitad: así un extremo
// mal elegido, o un mínimo de ventana, nunca da la misma cifra por casualidad.
function serie(from, to) {
  const out = [];
  for (let t = Date.parse(from + "T12:00:00Z"), i = 0; t <= Date.parse(to + "T12:00:00Z"); t += DAY, i++) {
    const day = iso(t), dd = Number(day.slice(8));
    out.push({ day, value: Math.round((100000 + i * 41.37 + (dd === 15 ? -900 : 0) + (i * 7919 % 13) * 1.01) * 100) / 100 });
  }
  return out;
}
const at = (s, day) => s.find(p => p.day === day).value;
const plain = x => JSON.parse(JSON.stringify(x));

function comprobar(m) {
  // Dos extremos exactos, al céntimo, en un mes de 31 días.
  const s = serie("2026-04-01", "2026-10-31");
  const k = m.netWorthCompare(s, "1m", "2026-10-31", 0);
  assert.equal(k.delta, Math.round((at(s, "2026-10-31") - at(s, "2026-09-30")) * 100) / 100, "31/10 frente al 30/9: el 31 no existe en septiembre");
  assert.deepEqual([k.days, k.months], [31, 1]);
  const k3 = m.netWorthCompare(s, "3m", "2026-10-31", 0);
  assert.equal(k3.delta, Math.round((at(s, "2026-10-31") - at(s, "2026-07-31")) * 100) / 100, "3M: 31/10 frente al 31/7");
  assert.equal(k3.months, 3);
  const all = m.netWorthCompare(s, "all", "2026-10-31", 0);
  assert.equal(all.delta, Math.round((at(s, "2026-10-31") - at(s, "2026-04-01")) * 100) / 100, "Todo: frente al primer punto");
  // Mismo día corriente: 14/10 frente a 14/9, y se mueve cada día.
  const s14 = s.filter(p => p.day <= "2026-10-14"), s13 = s.filter(p => p.day <= "2026-10-13");
  assert.equal(m.netWorthCompare(s14, "1m", "2026-10-14", 0).delta, Math.round((at(s, "2026-10-14") - at(s, "2026-09-14")) * 100) / 100, "14/10 frente al 14/9");
  assert.equal(m.netWorthCompare(s13, "1m", "2026-10-13", 0).delta, Math.round((at(s, "2026-10-13") - at(s, "2026-09-13")) * 100) / 100, "13/10 frente al 13/9");

  // Febrero: 31/3 cae en el 28/2 (2027) y en el 29/2 (2028, bisiesto); 29/3/2028 en el 29/2.
  for (const [hoy, desde] of [["2027-03-31", "2027-02-28"], ["2027-03-29", "2027-02-28"], ["2028-03-31", "2028-02-29"], ["2028-03-29", "2028-02-29"], ["2028-02-29", "2028-01-29"]]) {
    const f = serie("2026-12-01", hoy);
    assert.equal(m.netWorthCompare(f, "1m", hoy, 0).delta, Math.round((at(f, hoy) - at(f, desde)) * 100) / 100, hoy + " frente al " + desde);
  }

  // Calendario de Madrid, no UTC: a las 23:30 de Madrid sigue siendo 13/10 y a las 00:30 ya es 14/10,
  // aunque en UTC sean 21:30 y 22:30 del 13. Lo mismo en invierno (UTC+1) a fin de febrero.
  for (const [utc, madrid, desde] of [["2026-10-13T21:30:00Z", "2026-10-13", "2026-09-13"], ["2026-10-13T22:30:00Z", "2026-10-14", "2026-09-14"],
    ["2027-02-28T22:30:00Z", "2027-02-28", "2027-01-28"], ["2027-02-28T23:30:00Z", "2027-03-01", "2027-02-01"]]) {
    const hoy = m.netWorthDay(Date.parse(utc));
    assert.equal(hoy, madrid, utc + " es " + madrid + " en Madrid");
    const f = serie("2026-06-01", hoy);
    assert.equal(m.netWorthCompare(f, "1m", hoy, 0).delta, Math.round((at(f, hoy) - at(f, desde)) * 100) / 100, utc + ": frente al " + desde);
  }

  // Se conserva: menos de 45 días de serie → sin frase; un periodo que no cabe → sin frase.
  assert.equal(m.netWorthCompare(s.slice(-45), "all", "2026-10-31", 0), null);
  assert.ok(m.netWorthCompare(s.slice(-46), "1m", "2026-10-31", 0));
  assert.equal(m.netWorthCompare(s.slice(-80), "3m", "2026-10-31", 0), null, "3M sin tres meses de serie no se inventa");
  // Y el margen solo decide el color.
  const flat = s.map(p => ({ ...p, value: 1000 })); flat[flat.length - 1] = { ...flat.at(-1), value: 1005 };
  assert.deepEqual(plain(m.netWorthCompare(flat, "1m", "2026-10-31", 0)), { delta: 5, days: 31, months: 1, verdict: "flat", margin: 10 });
  assert.equal(m.netWorthCompare(flat, "1m", "2026-10-31", 1e6).margin, 300);
}
comprobar(c);
console.log("inicio-mismo-dia: extremos exactos, meses de 31 días, febrero, Madrid frente a UTC y mínimos conservados OK");

// Volver a los mínimos de 45 días (la regla que daba +3.769) o a otro extremo tumba el test.
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const mutantes = [
  ["mínimo de 45 días", "const delta=Math.round((last.value-from.value)*100)/100;",
    "const low=function(end){ let v=Infinity; for(let i=Math.max(0,end-44);i<=end;i++) if(series[i].value<v) v=series[i].value; return v; };\n  const delta=Math.round((low(series.length-1)-low(series.indexOf(from)))*100)/100;"],
  ["primer punto siempre", "from=series.find(function(p){ return p.day>=start; });", "from=series[0];"],
  ["30 días fijos", "const start=netWorthMonthsBack(last.day,months);", "const start=new Date(Date.parse(last.day+\"T12:00:00Z\")-months*30*864e5).toISOString().slice(0,10);"],
  ["sin recortar al fin de mes", "d.setUTCDate(Math.min(max,end.getUTCDate()));", "d.setUTCDate(end.getUTCDate());"],
];
for (const [nombre, de, a] of mutantes) {
  assert.equal(html.split(de).length, 2, "mutante único real: " + nombre);
  assert.throws(() => comprobar(loadPureLogic(html.replace(de, a))), assert.AssertionError, "se mata el mutante: " + nombre);
}
console.log("inicio-mismo-dia: " + mutantes.length + " mutaciones muertas");
