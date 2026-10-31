import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* El resumen que lee Jarvis (`npm run jarvis-resumen`) con un estado INVENTADO y sin red: formato
   v1 cerrado, cifras por dos vías (lo esperado a mano y las funciones de la app directamente) y
   nada de identificadores ni IBAN en la salida. El reloj se fija al 15/10/2026 para que la ventana
   del mes y los 30 días de cobros no dependan de cuándo corra el CI. */
const NativeDate = Date, EPOCH = NativeDate.parse("2026-10-15T10:00:00Z");
globalThis.Date = class extends NativeDate {
  constructor(...a) { super(...(a.length ? a : [EPOCH])); }
  static now() { return EPOCH; }
};
// Si algo del resumen intentara salir a la red, el test cae aquí.
globalThis.fetch = () => { throw new Error("el resumen no debe usar la red"); };

const { loadPureLogicFromFile } = await import("../scripts/load-pure-logic.mjs");
const { estadoComoApp, resumenDeEstado, escribirResumen, rutaResumen } = await import("../scripts/jarvis-resumen.mjs");

const UID = "0b7e4c1a-1111-4222-8333-944455556666";
const IBAN = "ES9121000418450200051332";
const fila = (n, fecha, importe, comercio, cat) => ({
  id: "00000000-0000-4000-8000-0000000000" + String(n).padStart(2, "0"), user_id: UID,
  fecha, importe, comercio, cat, source: "manual:sabadell",
});
const rows = [
  fila(1, "2026-10-02T09:00:00Z", 40.10, "Mercadona", "super"),
  fila(2, "2026-10-10T20:00:00Z", 25.25, "Bar Pepe", "bares"),
  fila(3, "2026-10-12T11:00:00Z", 9.65, "Lidl", "super"),
  fila(4, "2026-10-01T08:00:00Z", -1200, "Nómina", "ingreso"),     // ingreso: no es gasto
  fila(5, "2026-10-05T08:00:00Z", 300, "A ahorro", "traspaso"),     // neutra: no cuenta
  fila(6, "2026-09-28T08:00:00Z", 99, "Mercadona", "super"),        // mes pasado
];
const ym = 2026 * 12 + 10;
const cloudState = {
  _dataVer: 6, onboarded: true, budget: 800,
  settings: { expenseBanks: ["sabadell"], gTotalMode: "net", profile: { handle: "x", email: "no@debe.salir" } },
  accounts: [
    { id: "a1", ent: "sabadell", name: "Cuenta del día a día", role: "diario", spendFrom: true, value: 1000, bankIban: IBAN, saldoLeidoAt: "2026-10-14T08:00:00.000Z" },
    { id: "a2", ent: "caixa", name: "Recibos", role: "fijos", value: 500 },
  ],
  fixed: [
    { id: "f1", name: "Gimnasio", amount: 30, freq: "mes", day: 20, account: "caixa" },
    { id: "f2", name: "Seguro", amount: 50, freq: "mes", day: 5, account: "caixa" },          // octubre vencido; noviembre dentro de 30 días
    { id: "f3", name: "Revista", amount: 9, freq: "mes", day: 25, account: "caixa", pausedFrom: ym, pausedUntil: ym + 2 }, // pausado
    { id: "f4", name: "Luz", amount: 60, freq: "mes", day: 18, account: "caixa", paidYm: ym, paidDay: 14 },               // ya pagado; noviembre fuera
  ],
  debts: [{ id: "d1", name: "Préstamo coche", monthly: 120, day: 28, value: 3000, account: "caixa" }],
};

const ctx = loadPureLogicFromFile();
const state = estadoComoApp(ctx, JSON.parse(JSON.stringify(cloudState)), rows, UID);
const r = resumenDeEstado(ctx, state);

// Formato v1, cerrado: ni una clave de más.
assert.deepEqual(Object.keys(r), ["version", "generadoEn", "mes", "proximosCobros", "cuentas"]);
assert.equal(r.version, 1);
assert.equal(r.generadoEn, "2026-10-15T10:00:00.000Z");
assert.deepEqual(Object.keys(r.mes), ["gastado", "porCategoria"]);
r.mes.porCategoria.forEach((c) => assert.deepEqual(Object.keys(c), ["cat", "importe"]));
r.proximosCobros.forEach((c) => {
  assert.deepEqual(Object.keys(c), ["nombre", "importe", "fecha", "tipo"]);
  assert.ok(c.fecha === null || /^\d{4}-\d{2}-\d{2}$/.test(c.fecha));
  assert.ok(["recibo", "suscripcion", "deuda"].includes(c.tipo));
});
r.cuentas.forEach((c) => assert.deepEqual(Object.keys(c), ["nombre", "saldo", "leidoEn"]));

// Gastado, vía 1: a mano. Solo los tres gastos de octubre del banco de gasto diario.
assert.equal(r.mes.gastado, 75);
assert.deepEqual(r.mes.porCategoria, [{ cat: "Supermercado", importe: 49.75 }, { cat: "Bares y restaurantes", importe: 25.25 }]);
// Vía 2: la app directamente, con la ventana por defecto de Inicio y del widget.
assert.equal(Math.round(ctx.monthBudgetStats(state, Date.now()).spent * 100) / 100, r.mes.gastado);
assert.equal(Math.round(r.mes.porCategoria.reduce((a, c) => a + c.importe, 0) * 100) / 100, r.mes.gastado, "categorías = cabecera");

// Cobros: Gimnasio (20/10) y la cuota (28/10) de este mes; el Seguro del 5/11. Fuera el Seguro
// vencido de octubre, la Revista en pausa, la Luz pagada y lo que cae después del 14/11.
assert.deepEqual(r.proximosCobros, [
  { nombre: "Gimnasio", importe: 30, fecha: "2026-10-20", tipo: "recibo" },
  { nombre: "Préstamo coche", importe: 120, fecha: "2026-10-28", tipo: "deuda" },
  { nombre: "Seguro", importe: 50, fecha: "2026-11-05", tipo: "recibo" },
]);
// Vía 2: lo que Plan › Recibos da por pendiente este mes contiene los dos de octubre.
const pend = ctx.planChargesMonth(state, 10, 2026, 15).pendingBills.map((x) => x.name);
assert.ok(pend.includes("Gimnasio") && pend.includes("Préstamo coche") && !pend.includes("Revista") && !pend.includes("Luz"));

// Saldos: la de recibos sin nada cobrado aún es su valor; la diaria, la fórmula de Cartera.
assert.equal(r.cuentas.length, 2);
assert.equal(r.cuentas[0].nombre, "Cuenta del día a día");
assert.equal(r.cuentas[0].leidoEn, "2026-10-14T08:00:00.000Z");
const ins = ctx.insumosSaldoGasto(state);
assert.equal(r.cuentas[0].saldo, Math.round(ctx.saldoCuentaMostrada(state.accounts[0], ins) * 100) / 100);
// A mano: en la diaria el efectivo se mueve con TODO lo del mes (gastos, nómina y traspaso).
assert.equal(r.cuentas[0].saldo, 1000 - (75 - 1200 + 300), "diaria: valor − el neto del mes");
assert.deepEqual(r.cuentas[1], { nombre: "Recibos", saldo: 500, leidoEn: null });

// Nada que identifique: ni IBAN, ni ids, ni correos.
const txt = JSON.stringify(r);
assert.ok(!txt.includes(IBAN) && !txt.includes(UID) && !txt.includes("@") && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(txt) && !txt.includes("\"a1\""));

// Escritura atómica: ni el temporal se queda ni el fichero sale a medias; la carpeta se crea.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-"));
const out = rutaResumen({ LOCALAPPDATA: dir });
assert.equal(out, path.join(dir, "Aely", "jarvis-resumen.json"));
escribirResumen(out, r);
escribirResumen(out, r);
assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), r);
assert.deepEqual(fs.readdirSync(path.dirname(out)), ["jarvis-resumen.json"]);
fs.rmSync(dir, { recursive: true, force: true });

console.log("✓ jarvis-resumen: formato v1, gastado y cobros como la app, sin datos identificativos");
