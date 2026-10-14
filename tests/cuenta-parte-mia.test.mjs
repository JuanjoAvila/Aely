import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPureLogicFromFile, loadPureLogic } from "../scripts/load-pure-logic.mjs";

/* «Parte mía» de una cuenta (14/10/2026). Una conjunta con la pareja contaba entera en el
 * patrimonio y la gráfica de Inicio arrancaba alta con dinero que pusieron los dos. Con datos
 * sintéticos:
 *   · sin campo = idéntico al céntimo (un estado viejo no cambia);
 *   · 50 % y 0 % en una cuenta de Open Banking sola en su banco: saldo y movimientos a su parte;
 *   · cuenta manual con cierres: el de hoy y los anteriores pesan su parte;
 *   · banco con dos cuentas a partes distintas: el movimiento con su cuenta guardada pesa lo suyo;
 *     el que no la lleva cuenta entero y la «i» lo dice (no se reparte inventando);
 *   · un traspaso entre la personal y la conjunta mueve la mitad que pasa a ser de la pareja;
 *   · gastos, presupuesto y recibos no cambian ni un céntimo;
 *   · la sincronización guarda la cuenta de cada movimiento y la recupera en los ya apuntados. */
const c = loadPureLogicFromFile();
const today = "2026-10-14";
const plain = x => JSON.parse(JSON.stringify(x));
const JOINT = "ES00 SYNTH 0000 0000 0002", MINE = "ES00SYNTH0000000000000001";

function base(extra = {}) {
  return {
    accounts: [{ id: "sab", ent: "sabadell", name: "Nómina", value: 2000, role: "fijos" }],
    obAccounts: [], investments: [], assets: [], debts: [], fixed: [], flows: [], oneoffs: [], aportaciones: [],
    settings: {}, accountBalanceHistory: {}, ...extra,
    // Un apunte a cero el 1/10 abre la serie antes de los movimientos que se comprueban.
    expenses: [{ id: "alta", date: "2026-10-01T10:00:00.000Z", amount: 0, merchant: "Alta", category: "otros", source: "ob", ent: "revolut" }].concat(extra.expenses || []),
  };
}
const ob = (key, iban, value, name = "Titular Sintético") => ({ key, ent: "revolut", iban, name, value, cur: "EUR", aspsp: "Revolut" });
const mov = (id, day, amount, extra = {}) => ({ id, date: day + "T10:00:00.000Z", amount, merchant: "Comercio " + id, category: "otros", source: "ob", ent: "revolut", ...extra });

function comprobar(m) {
  const S = st => { const r = m.netWorthSeries(st, { today }), out = plain(r); out.coverage = plain(r.coverage); return out; };
  const at = (s, d) => s.find(p => p.day === d).value;
  const share = (st, item, kind, pct) => m.setAccountShare(st, item, kind, pct);

  // Utilidades: lo que se teclea en la ficha.
  assert.equal(m.parseAccountShare("50"), 50);
  assert.equal(m.parseAccountShare("50,5"), 50.5);
  assert.equal(m.parseAccountShare(" 33.33 %"), 33.33);
  assert.equal(m.parseAccountShare("0"), 0);
  assert.equal(m.parseAccountShare("100"), 100);
  for (const bad of ["101", "-1", "abc", "", "5,5,5"]) assert.equal(m.parseAccountShare(bad), null, "no vale: " + bad);
  assert.ok(m.accountLooksJoint("ANA SINTÉTICA PÉREZ & LUIS SINTÉTICO GIL"));
  assert.ok(m.accountLooksJoint("Ana y Luis"));
  assert.ok(!m.accountLooksJoint("LUIS SINTÉTICO GIL"));
  assert.ok(!m.accountLooksJoint("Cuenta y ahorro"));

  // Una conjunta sola en su banco: 1.000 € hoy; el 10/10 salió un crucero de 400 €.
  const joint = ob("u-joint", JOINT, 1000, "ANA SINTÉTICA & LUIS SINTÉTICO");
  const st = base({ obAccounts: [joint], expenses: [mov("c", "2026-10-10", 400)] });
  const viejo = S(st);
  assert.deepEqual([at(viejo, "2026-10-09"), at(viejo, today)], [3400, 3000], "sin parte: entera, como siempre");
  // Sin campo = idéntico: un mapa vacío, o poner 100, deja el estado y la serie como estaban.
  assert.deepEqual(plain(share(st, joint, "ob", 100).settings), {}, "100 % borra la entrada");
  assert.deepEqual(S(share(share(st, joint, "ob", 50), joint, "ob", 100)), viejo, "poner y quitar: idéntico al céntimo");
  assert.equal(m.accountShareOf(st, joint, "ob"), 1);
  const mitad = share(st, joint, "ob", 50);
  assert.equal(mitad.settings.accountShare["iban:ES00SYNTH000000000002"], 50, "la clave es el IBAN sin espacios");
  const s50 = S(mitad);
  assert.deepEqual([at(s50, "2026-10-09"), at(s50, today)], [2700, 2500], "50 %: hoy 2.000 + 500; antes del crucero 2.000 + 700");
  const s0 = S(share(st, joint, "ob", 0));
  assert.deepEqual([...new Set(s0.map(p => p.value))], [2000], "0 %: la conjunta no cuenta nada, tampoco sus movimientos");
  // La parte sobrevive a reconectar el banco (uid nuevo, mismo IBAN) y a darle rol a la cuenta.
  assert.equal(m.accountShareOf(mitad, { ...joint, key: "u-otro" }, "ob"), 0.5, "reconectar: mismo IBAN");
  assert.equal(m.accountShareOf(mitad, { id: "p", ent: "revolut", bankIban: JOINT, accountOrderKey: "ob:u-joint" }, "account"), 0.5, "promocionada con rol");
  assert.equal(s50.coverage.filter(g => g.kind === "share" && !g.unsplit).length, 1, "la «i» sabe que hay una cuenta a medias");
  assert.ok(!s50.coverage.some(g => g.unsplit), "banco de una sola cuenta: nada que no se pueda separar");

  // Cuenta manual (sin banco) con cierres guardados: hoy 800 €, el 1/10 tenía 600 €.
  const hucha = { id: "h", ent: "efectivo", name: "Hucha compartida", value: 800, role: "fijos" };
  const manual = base({ accounts: [base().accounts[0], hucha], accountBalanceHistory: { "acc:h": [{ day: "2026-10-01", value: 600 }, { day: "2026-10-05", value: 800 }] }, expenses: [mov("x", "2026-09-20", 0, { ent: "sabadell" })] });
  const m0 = S(manual), m50 = S(share(manual, hucha, "account", 50));
  assert.deepEqual([at(m0, "2026-10-02"), at(m0, today)], [2600, 2800]);
  assert.deepEqual([at(m50, "2026-09-25"), at(m50, "2026-10-02"), at(m50, today)], [2300, 2300, 2400], "manual al 50 %: su cierre de entonces y el de hoy, a la mitad");

  // Banco con DOS cuentas: la personal (100 %) y la conjunta (50 %), las dos a 1.000 € hoy.
  const mine = ob("u-mine", MINE, 1000);
  const dos = (expenses) => share(base({ obAccounts: [mine, joint], expenses }), joint, "ob", 50);
  const conCuenta = S(dos([mov("a", "2026-10-10", 400, { obAcc: JOINT }), mov("b", "2026-10-11", 100, { obAcc: MINE })]));
  assert.deepEqual([at(conCuenta, "2026-10-09"), at(conCuenta, "2026-10-10"), at(conCuenta, today)], [3800, 3600, 3500],
    "con su cuenta guardada: el crucero de la conjunta pesa 200, el café de la personal 100");
  assert.ok(!conCuenta.coverage.some(g => g.unsplit), "todo separado: la «i» no avisa de nada");
  // Por uid, si el banco no dio IBAN.
  const porUid = S(dos([mov("a", "2026-10-10", 400, { obAcc: "u-joint" })]));
  assert.equal(at(porUid, "2026-10-09"), 3700, "por uid de la cuenta");
  const sinCuenta = S(dos([mov("a", "2026-10-10", 400)]));
  assert.equal(at(sinCuenta, "2026-10-09"), 3900, "sin cuenta guardada: entero (no se inventa a cuál pertenece)");
  assert.deepEqual(sinCuenta.coverage.filter(g => g.unsplit).map(g => g.name), ["Revolut"], "y la «i» lo dice");
  const alReves = S(share(base({ obAccounts: [joint, mine], expenses: [mov("a", "2026-10-10", 400)] }), joint, "ob", 50));
  assert.equal(at(alReves, "2026-10-09"), 3900, "da igual el orden de las cuentas: entero");
  // Él decide de qué cuenta son los viejos sin cuenta (`accountShareLegacy`), sin tocar los gastos.
  const viejos = dos([mov("a", "2026-10-10", 400), mov("b", "2026-10-12", 0)]);
  assert.equal(m.accountLegacyCount(viejos, "revolut"), 1, "cuenta solo los de banco sin cuenta y con importe");
  const decide = (st, item, no, day = today) => m.setAccountLegacy(st, "revolut", { key: m.accountShareKey(item, "ob"), no, day });
  const si = S(decide(viejos, joint, false));
  assert.equal(at(si, "2026-10-09"), 3700, "«son de la conjunta»: pesan su 50 %");
  assert.deepEqual(si.coverage.filter(g => g.kind === "share" && (g.legacy || g.unsplit)).map(g => g.legacy ? "legacy" : "unsplit"), ["legacy"], "la «i» dice que manda su decisión");
  const no = S(decide(viejos, joint, true));
  assert.equal(at(no, "2026-10-09"), 3900, "«no son de la conjunta»: de la personal, enteros");
  assert.ok(!no.coverage.some(g => g.unsplit), "y ya no hay nada sin separar");
  assert.equal(at(S(decide(viejos, mine, false)), "2026-10-09"), 3900, "«son de la personal»: enteros");
  const antes = S(decide(viejos, joint, false, "2026-10-05"));
  assert.equal(at(antes, "2026-10-09"), 3900, "lo que entró después de decidir no lo cubre la decisión");
  assert.ok(antes.coverage.some(g => g.unsplit), "y sigue avisando");
  assert.deepEqual(plain(m.setAccountLegacy(decide(viejos, joint, false), "revolut", null).settings), plain(viejos.settings), "deshacer deja el estado como estaba");
  assert.equal(decide(viejos, joint, false).expenses, viejos.expenses, "decidir no reescribe los gastos");
  // Volver a poner la conjunta al 100 % tras decidir: ya no hay nada a medias y la «i» calla.
  const vuelta = S(share(decide(viejos, joint, false), joint, "ob", 100));
  assert.ok(!vuelta.coverage.some(g => g.kind === "share"), "sin cuentas a medias, la «i» no habla de cuentas compartidas");
  // Una principal re-anclada SIN IBAN (en `accounts`): el banco deja su uid y sus movimientos pesan su parte.
  const principal = { id: "p", ent: "revolut", name: "Principal", value: 1000, role: "fijos", bankUid: "u-p" };
  const conUid = share(base({ obAccounts: [mine], accounts: [base().accounts[0], principal], expenses: [mov("a", "2026-10-10", 400, { obAcc: "u-p" })] }), principal, "account", 50);
  const sUid = S(conUid);
  assert.equal(at(sUid, "2026-10-09"), 3700, "principal sin IBAN al 50 %: 200, no 400");
  assert.ok(!sUid.coverage.some(g => g.unsplit), "y la «i» no lo llama antiguo");
  const reanclada = m.applyBankBalances(base({ accounts: [{ id: "p", ent: "revolut", name: "Principal", value: 1000, role: "fijos" }] }),
    [{ aspsp: "Revolut", ok: true, accounts: [{ uid: "u-p", iban: null, ok: true, balances: [{ type: "ITAV", amount: "1000", currency: "EUR" }] }] }]).state;
  assert.equal(reanclada.accounts[0].bankUid, "u-p", "al re-anclar sin IBAN, la principal guarda el uid del banco");
  // Las dos cuentas con la misma parte: da igual de cuál saliera.
  const iguales = S(share(dos([mov("a", "2026-10-10", 400)]), mine, "ob", 50));
  assert.equal(at(iguales, "2026-10-09"), 3200, "misma parte en todas: se aplica sin saber la cuenta");
  // Traspaso de 1.000 € de la personal a la conjunta: 500 pasan a ser de la pareja.
  const traspaso = S(dos([mov("t1", "2026-10-10", 1000, { obAcc: MINE, category: "traspaso" }), mov("t2", "2026-10-10", -1000, { obAcc: JOINT, category: "traspaso", ent: "revolut" })]));
  assert.equal(at(traspaso, "2026-10-09") - at(traspaso, "2026-10-10"), 500, "personal → conjunta al 50 %: −500 suyos");
  // Patas en días distintos (sale el 13/9 de la personal, llega el 15/9 a la conjunta): sin bache
  // de −1.000 mientras viaja; solo los −500 el día de la salida. El 14/9 es justo el «mismo día del
  // mes pasado» de la comparación de 1M, y cae en el hueco.
  const viaje = S(dos([mov("abre", "2026-08-20", 0, { obAcc: MINE }), mov("s1", "2026-09-13", 1000, { obAcc: MINE, category: "traspaso" }), mov("s2", "2026-09-15", -1000, { obAcc: JOINT, category: "traspaso" })]));
  assert.deepEqual(["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16"].map(d => at(viaje, d)), [4000, 3500, 3500, 3500, 3500], "solo la diferencia, el día de la salida");
  assert.equal(m.netWorthCompare(viaje, "1m", today, 0).delta, 0, "1M compara con el 14/9, en el hueco: sin la caída inventada");
  // Entre dos bancos al 100 % el traspaso sigue neutro, como siempre.
  const neutro = S(base({ accounts: [{ ...base().accounts[0], bankIban: "ES00SYNTH0000000000000009" }], obAccounts: [mine],
    expenses: [mov("n1", "2026-10-10", 300, { ent: "sabadell", category: "traspaso" }), mov("n2", "2026-10-10", -300, { obAcc: MINE, category: "traspaso" })] }));
  assert.deepEqual([...new Set(neutro.map(p => p.value))], [3000], "traspaso propio entre cuentas enteras: neutro");

  // La «i»: una fila corta, y la coletilla solo si algo cuenta entero sin poder separarlo.
  const fmt = new Intl.DateTimeFormat("es", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });
  const fila = s => m.netWorthInfoRows(m.netWorthSeries(s, { today }), fmt, null).find(r => r.k === "Cuentas compartidas");
  assert.equal(fila(mitad).v, "solo tu parte del saldo y de sus movimientos");
  assert.equal(fila(dos([mov("a", "2026-10-10", 400)])).v, "solo tu parte del saldo y de sus movimientos; los movimientos antiguos de Revolut no dicen de qué cuenta salieron y cuentan enteros");
  assert.equal(fila(st), undefined, "sin cuentas compartidas, sin fila");
  assert.equal(fila(m.setAccountLegacy(dos([mov("a", "2026-10-10", 400)]), "revolut", { key: m.accountShareKey(joint, "ob"), no: false, day: today })).v,
    "solo tu parte del saldo y de sus movimientos; los antiguos de Revolut, como dijiste en la ficha de la cuenta");

  // Gastos, presupuesto y recibos: idénticos al céntimo con la conjunta al 50 %.
  const NOW = Date.parse("2026-10-14T10:00:00Z");
  const conGastos = base({ obAccounts: [mine, joint], budget: 900, settings: { expenseBanks: ["revolut"] },
    fixed: [{ id: "f", name: "Luz sintética", amount: 50, freq: "monthly", day: 3, account: "revolut" }],
    expenses: [mov("g1", "2026-10-03", 50, { merchant: "Luz sintética", obAcc: JOINT }), mov("g2", "2026-10-08", 30, { category: "super", obAcc: JOINT }), mov("g3", "2026-10-09", 12, { category: "ocio", obAcc: MINE })] });
  const conParte = share(conGastos, joint, "ob", 50);
  const igual = st => JSON.stringify([m.monthBudgetStats(st, NOW), m.dashboardBudgetStats(st), m.insumosSaldoGasto(st).spentByBank, m.insumosSaldoGasto(st).paidNetByBank, st.expenses.map(e => !!m.cargoDeRecibo(e, st))]);
  assert.equal(igual(conParte), igual(conGastos), "gastos, presupuesto y recibos no miran la parte");

  // La sincronización guarda la cuenta de cada movimiento…
  const links = [{ aspsp: "Revolut", ok: true, accounts: [
    { uid: "u-joint", iban: JOINT, ok: true, transactions: [{ ext_id: "e1", date: "2026-10-12", amount: 25, merchant: "Cena", status: "BOOK" }] },
    { uid: "u-sin", iban: null, ok: true, transactions: [{ ext_id: "e2", date: "2026-10-12", amount: 9, merchant: "Taxi", status: "BOOK" }] }] }];
  const txs = m.flattenBankTx(links, []);
  assert.deepEqual(plain(txs.map(x => [x.id, x.acc])).sort(), [["e1", JOINT], ["e2", "u-sin"]], "cada movimiento con su cuenta (IBAN, o uid sin IBAN)");
  const nuevos = m.importObExpenses(base({ obAccounts: [mine, joint] }), txs, links);
  assert.deepEqual(plain(nuevos.map(e => [e.extId, e.obAcc])).sort(), [["e1", JOINT], ["e2", "u-sin"]], "y el apunte nuevo la guarda");
  // …y la recupera en lo ya apuntado cuando el banco lo repite (por id o por día+importe+nombre).
  const yaEstaban = [mov("v1", "2026-10-12", 25, { extId: "e1", merchant: "Cena", date: "2026-10-12T10:00:00.000Z" }),
    mov("v2", "2026-10-12", 9, { merchant: "Taxi", date: new Date("2026-10-12T12:00:00").toISOString() }),
    mov("v3", "2026-10-12", 7, { merchant: "Otro" }), { id: "man", date: "2026-10-12T10:00:00Z", amount: 9, merchant: "Taxi", source: "manual", ent: "revolut" }];
  // Renombrado por él: la clave usa lo que dijo el banco (`obName`), no el nombre de pantalla.
  yaEstaban.push(mov("ren", "2026-10-12", 25, { merchant: "Cena con Ana", obName: "Cena", date: "2026-10-12T10:00:00.000Z" }));
  const tagged = m.tagObAccountsFromBankTx(yaEstaban, txs);
  assert.deepEqual(plain(tagged.map(e => e.obAcc || null)), [JOINT, "u-sin", null, null, JOINT], "recupera por id y por clave (también renombrado); no toca lo que no casa ni lo manual");
  assert.equal(m.tagObAccountsFromBankTx(tagged, txs), tagged, "sin nada que añadir, el MISMO array (no reescribe el histórico)");
  // Un apunte igual en las dos cuentas el mismo día no dice de cuál es: se queda sin cuenta.
  const ambiguo = m.flattenBankTx([{ aspsp: "Revolut", ok: true, accounts: [
    { uid: "u-joint", iban: JOINT, ok: true, transactions: [{ date: "2026-10-12", amount: 9, merchant: "Taxi", status: "BOOK" }] },
    { uid: "u-mine", iban: MINE, ok: true, transactions: [{ date: "2026-10-12", amount: 9, merchant: "Taxi", status: "BOOK" }] }] }], []);
  assert.equal(m.tagObAccountsFromBankTx([yaEstaban[1]], ambiguo)[0].obAcc, undefined, "ambiguo: sin cuenta");
}
comprobar(c);
console.log("cuenta-parte-mia: sin campo idéntico, 50 %, 0 %, manual, dos cuentas con y sin cuenta guardada, traspaso, «i», gastos intactos y cuenta de cada movimiento OK");

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const mutantes = [
  ["el saldo de hoy entero", "return typeof v===\"number\"&&shares[i]!==1?v*shares[i]:v;", "return v;"],
  ["los movimientos enteros", "if(row.f!==1) row.cents=Math.round(row.expense.amount*100*row.f);", ""],
  ["sin mirar la cuenta del movimiento", "if(e.obAcc){ const hit=", "if(false){ const hit="],
  ["mezcla sin saber la cuenta: aplica la primera parte", "unsplit[bank]=true; return 1;", "unsplit[bank]=true; return list[0].s;"],
  ["sin par dentro del mismo banco", "const sameAcc=a.bank===b.bank&&!(a.expense.obAcc&&b.expense.obAcc&&a.expense.obAcc!==b.expense.obAcc);", "const sameAcc=a.bank===b.bank;"],
  ["traspaso siempre neutro", "flowBanks[row.ownTransfer]&&row.f===row.mate.f)", "flowBanks[row.ownTransfer])"],
  ["cierres manuales enteros", "const part=shares[i]===1?points:", "const part=true?points:"],
  ["la sincronización pierde la cuenta", "...(accs[i]?{acc:String(accs[i])}:{})", ""],
  ["el apunte nuevo no la guarda", "    if(tx.acc) e.obAcc=tx.acc;\n    e.obName=e.merchant;", "    e.obName=e.merchant;"],
  ["100 % no borra la entrada", "if(pct==null||pct===100) delete next[key];", "if(pct==null) delete next[key];"],
  ["más de 100 vale", "return n>=0&&n<=100?n:null;", "return n>=0?n:null;"],
  ["recuperar cuenta con ambigüedad", "byKey[k]=(k in byKey && byKey[k]!==tx.acc) ? \"\" : tx.acc;", "byKey[k]=tx.acc;"],
  ["la decisión sin fecha tope", "if(dec&&day<=dec.day){", "if(dec){"],
  ["«no son de esta» como «sí»", "if(hit&&!dec.no) return hit.s;", "if(hit) return hit.s;"],
  ["sin mirar su decisión", "const dec=!e.obAcc&&legacy[bank];", "const dec=false;"],
  ["deshacer no borra", "if(decision) next[ent]=decision; else delete next[ent];", "if(decision) next[ent]=decision;"],
  ["traspaso con partes distintas: cada pata en su día", "if(row.ownTransfer&&flowBanks[row.ownTransfer]){ if(e.amount>0) daily[day]=(daily[day]||0)-(row.cents+row.mate.cents); return; }", ""],
  ["la principal sin IBAN no se reconoce", "item&&item.bankUid?String(item.bankUid):", ""],
  ["re-anclar no guarda el uid", "const uidCambia = !ac.iban && ac.uid!=null && a.bankUid!==String(ac.uid);", "const uidCambia = false;"],
  ["«como dijiste» sin cuentas a medias", "if(flowBanks[b]&&anyShared) gaps.push", "if(flowBanks[b]) gaps.push"],
  ["renombrado: clave por el nombre de pantalla", "e.obName!=null?e.obName:e.merchant)];", "e.merchant)];"],
  ["la «i» calla lo que cuenta entero", "Object.keys(unsplit).forEach(function(b){ if(flowBanks[b]) gaps.push", "Object.keys(unsplit).forEach(function(b){ if(false) gaps.push"],
];
for (const [nombre, de, a] of mutantes) {
  assert.equal(html.split(de).length, 2, "mutante único real: " + nombre);
  assert.throws(() => comprobar(loadPureLogic(html.replace(de, a))), assert.AssertionError, "se mata el mutante: " + nombre);
}
console.log("cuenta-parte-mia: " + mutantes.length + " mutaciones muertas");
