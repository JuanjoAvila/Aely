#!/usr/bin/env node
/* FIN-05: ejecuta el árbitro Java real y compara las mismas filas con app e ingest. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const javaDir = path.join(root, "android/app/src/main/java/com/micartera/app");
const jdk = process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, "bin");
const androidJdk = "C:/Program Files/Android/Android Studio/jbr/bin";
const javac = fs.existsSync(path.join(jdk || "", process.platform === "win32" ? "javac.exe" : "javac"))
  ? path.join(jdk, "javac") : fs.existsSync(path.join(androidJdk, "javac.exe"))
    ? path.join(androidJdk, "javac.exe") : "javac";
const java = javac.endsWith("javac.exe") ? javac.replace(/javac\.exe$/, "java.exe")
  : javac.endsWith("javac") && javac !== "javac" ? javac.replace(/javac$/, "java") : "java";
// Las cifras que recibe Java proceden de ambas implementaciones, con lápidas conservadas.
const finApp = loadPureLogicFromFile();
const finTs = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const finServer = await import("data:text/javascript;base64," + Buffer.from(transformSync(finTs, { loader: "ts", format: "esm" }).code).toString("base64"));
const finNow = Date.parse("2026-09-27T12:00:00Z"), finPeriod = finServer.inicioDeMesMs(finNow);
const finRows = [
  { id: "live", fecha: "2026-09-02T10:00:00Z", importe: 181, cat: "super", source: "macrodroid", comercio: "Compra ficticia" },
  { id: "gone-out", fecha: "2026-09-03T10:00:00Z", importe: 3, cat: "bares", source: "ob:trade_republic", comercio: "Borrado ficticio" },
  { id: "gone-in", fecha: "2026-09-04T10:00:00Z", importe: -15, cat: "ingreso", source: "ob:trade_republic", comercio: "Ingreso borrado" },
];
const finState = { budget: 1000, accounts: [{ ent: "trade_republic", role: "diario" }],
  settings: { gTotalMode: "net" }, reservaLog: [], expenses: finRows.map(finApp.expenseFromRow) };
finState.deleted = finState.expenses.slice(1).map(finApp.keyOfExpense);
const finBefore = finApp.monthBudgetStats(finState, finNow);
const finPay = { id: "pay", fecha: "2026-09-27T10:00:00Z", importe: 5.45, cat: "super", source: "macrodroid", comercio: "Pago ficticio" };
const finAfterApp = finApp.monthBudgetStats({ ...finState, expenses: finState.expenses.concat(finApp.expenseFromRow(finPay)) }, finNow);
const finAfterServer = finServer.statsDelMes(finServer.filasComoLaApp(finRows.concat(finPay), finState.deleted), finState, finPeriod);
assert.equal(finBefore.shown, 181);
assert.equal(finAfterApp.shown, finAfterServer.shown);
assert.equal(finAfterApp.remaining, 813.55);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aely-widget-arbitraje-"));
try {
  const src = path.join(dir, "WidgetSnapshotArbiterTest.java");
  fs.writeFileSync(src, `package com.micartera.app;
public class WidgetSnapshotArbiterTest {
  static void eq(double a, double b) { if (Math.abs(a-b)>0.001) throw new AssertionError(a+" != "+b); }
  static void ok(boolean x) { if (!x) throw new AssertionError("condición falsa"); }
  static WidgetSnapshotArbiter.State base(long period, String bank) {
    WidgetSnapshotArbiter.State s = new WidgetSnapshotArbiter.State();
    WidgetSnapshotArbiter.app(s,period,40,100,60.0,150.0,200.0,bank,"Cuenta","","");
    return s;
  }
  static boolean ing(WidgetSnapshotArbiter.State s,long ticket,long current,long period,long read,
      String event,double spent,double budget,double left,double amount,boolean counts,boolean cashCounts) {
    return WidgetSnapshotArbiter.ingest(s,ticket,current,period,read,event,event+"Key",spent,budget,left,
        counts?amount:0,counts?amount:0,amount,counts,cashCounts);
  }
  public static void main(String[] args) {
    long sep=1788213600000L, oct=1790805600000L;
    WidgetSnapshotArbiter.State s=base(sep,"trade_republic");
    long a=WidgetSnapshotArbiter.begin(s), b=WidgetSnapshotArbiter.begin(s);
    ok(ing(s,b,sep,sep,200,"B",70,100,30,20,true,true));
    ok(ing(s,a,sep,sep,100,"A",50,100,50,10,true,true));
    eq(s.spent,70); eq(s.budgetLeft,30); eq(s.safeLiq(),120); eq(s.cash(),170); eq(s.afford(),30);
    ok(!ing(s,a,sep,sep,100,"A",50,100,50,10,true,true));
    eq(s.cash(),170);
    WidgetSnapshotArbiter.State reverse=base(sep,"trade_republic");
    a=WidgetSnapshotArbiter.begin(reverse); b=WidgetSnapshotArbiter.begin(reverse);
    ing(reverse,a,sep,sep,100,"A",50,100,50,10,true,true);
    ing(reverse,b,sep,sep,200,"B",70,100,30,20,true,true);
    eq(reverse.spent,s.spent); eq(reverse.safeLiq(),s.safeLiq()); eq(reverse.cash(),s.cash());
    // Un día nuevo dentro del mismo mes no reinicia el acumulado.
    long sameMonth=WidgetSnapshotArbiter.begin(s);
    ok(ing(s,sameMonth,sep,sep,300,"C",75,100,25,5,true,true));
    eq(s.spent,75); eq(s.cash(),165); eq(s.afford(),25);
    // Reentrada tras el pull: la app ya contiene los tres eventos.
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    long pending=WidgetSnapshotArbiter.begin(s);
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    ok(!ing(s,pending,sep,sep,300,"A",50,100,50,10,true,true));
    eq(s.spent,75); eq(s.cash(),165); eq(s.safeLiq(),115);
    long flight=WidgetSnapshotArbiter.begin(s);
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    ok(ing(s,flight,sep,sep,350,"D",80,100,20,5,true,true));
    eq(s.spent,80); eq(s.budgetLeft,20); eq(s.cash(),160); eq(s.safeLiq(),110);
    ok(WidgetSnapshotArbiter.app(s,sep,75,100,25.0,115.0,165.0,"trade_republic","Cuenta","|A|B|C|",""));
    eq(s.spent,80); eq(s.cash(),160); eq(s.safeLiq(),110);
    ok(WidgetSnapshotArbiter.app(s,sep,80,100,20.0,110.0,160.0,"trade_republic","Cuenta","|A|B|C|D|",""));
    eq(s.spent,80); eq(s.cash(),160); // al cubrir D, el overlay desaparece sin duplicarse
    long deleted=WidgetSnapshotArbiter.begin(s);
    ing(s,deleted,sep,sep,370,"E",85,100,15,5,true,true);
    ok(WidgetSnapshotArbiter.app(s,sep,80,100,20.0,110.0,160.0,"trade_republic","Cuenta","|A|B|C|D|","|EKey|"));
    eq(s.spent,80); eq(s.cash(),160); // lápida: el gasto retirado no vuelve por el journal
    WidgetSnapshotArbiter.State saturated=base(sep,"trade_republic");
    long satTicket=WidgetSnapshotArbiter.begin(saturated);
    WidgetSnapshotArbiter.app(saturated,sep,80,100,20.0,150.0,200.0,"trade_republic","Cuenta","","");
    ok(ing(saturated,satTicket,sep,sep,360,"late",90,80,0,10,true,true));
    eq(saturated.budgetLeft,10); // el servidor estaba en 0, pero la app tenía 20 antes del gasto
    long next=WidgetSnapshotArbiter.begin(s);
    ok(!ing(s,next,oct,sep,400,"viejo",80,100,20,10,true,true));
    ok(WidgetSnapshotArbiter.app(s,oct,0,100,100.0,130.0,180.0,"trade_republic","Cuenta","",""));
    long first=WidgetSnapshotArbiter.begin(s);
    ok(ing(s,first,oct,oct,500,"nuevo",5,100,95,5,true,true));
    eq(s.spent,5); eq(s.cash(),175); eq(s.safeLiq(),125);
    WidgetSnapshotArbiter.State other=base(sep,"sabadell");
    long tr=WidgetSnapshotArbiter.begin(other);
    ing(other,tr,sep,sep,100,"tr",50,100,50,10,true,true);
    eq(other.spent,50); eq(other.cash(),200); eq(other.safeLiq(),150);
    // Cambiar de banco con una notificación sin cubrir rehace solo sus deltas de saldo.
    ok(WidgetSnapshotArbiter.app(other,sep,40,100,60.0,150.0,200.0,"trade_republic","TR","",""));
    eq(other.cash(),190); eq(other.safeLiq(),140); eq(other.budgetLeft,50);
    ok(WidgetSnapshotArbiter.app(other,sep,40,100,60.0,150.0,200.0,"sabadell","Sabadell","",""));
    eq(other.cash(),200); eq(other.safeLiq(),150); eq(other.budgetLeft,50);
    WidgetSnapshotArbiter.State neutral=base(sep,"trade_republic");
    long inv=WidgetSnapshotArbiter.begin(neutral);
    ing(neutral,inv,sep,sep,100,"inversion",40,100,60,20,false,true);
    eq(neutral.spent,40); eq(neutral.cash(),180); eq(neutral.safeLiq(),150);
    WidgetSnapshotArbiter.State near=base(sep,"trade_republic"); near.baseCash=155;
    long nearTicket=WidgetSnapshotArbiter.begin(near);
    ing(near,nearTicket,sep,sep,100,"inversion",40,100,60,20,false,true);
    eq(near.cash(),135); eq(near.safeLiq(),135);
    WidgetSnapshotArbiter.State oldEdge=base(sep,"trade_republic");
    long oldTicket=WidgetSnapshotArbiter.begin(oldEdge);
    WidgetSnapshotArbiter.app(oldEdge,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","","");
    WidgetSnapshotArbiter.ingest(oldEdge,oldTicket,sep,sep,100,"ROWID","legacyKey",50,100,50,
        Double.NaN,Double.NaN,10,true,true);
    ok(oldEdge.unknownPending); // contrato viejo: el delta no se inventa tras un push cruzado
    WidgetSnapshotArbiter.app(oldEdge,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta",
        "|tr:trade_republic:EVT|ROWID|","");
    ok(!oldEdge.unknownPending); eq(oldEdge.spent,50); eq(oldEdge.cash(),190);
    WidgetSnapshotArbiter.State dup=base(sep,"trade_republic");
    long uncertain=WidgetSnapshotArbiter.begin(dup);
    ing(dup,uncertain,sep,sep,100,"possibleDup",40,100,60,10,false,false);
    eq(dup.cash(),200); eq(dup.spent,40);
    WidgetSnapshotArbiter.State fin=new WidgetSnapshotArbiter.State();
    WidgetSnapshotArbiter.app(fin,${finPeriod}L,${finBefore.shown},1000,${finBefore.remaining.toFixed(2)},900.0,2000.0,"trade_republic","Cuenta","","");
    long purchase=WidgetSnapshotArbiter.begin(fin);
    ing(fin,purchase,${finPeriod}L,${finPeriod}L,700,"pay",${finAfterServer.shown},1000,${1000-finAfterServer.against},5.45,true,true);
    eq(fin.spent,${finAfterApp.shown}); eq(fin.budgetLeft,${finAfterApp.remaining});
    eq(fin.cash(),1994.55); eq(fin.safeLiq(),894.55); eq(fin.afford(),813.55);
    // Reentrada antes y después del ACK: conserva el pago una sola vez.
    WidgetSnapshotArbiter.app(fin,${finPeriod}L,${finBefore.shown},1000,${finBefore.remaining.toFixed(2)},900.0,2000.0,"trade_republic","Cuenta","","");
    eq(fin.spent,${finAfterApp.shown}); eq(fin.cash(),1994.55);
    WidgetSnapshotArbiter.app(fin,${finPeriod}L,${finAfterApp.shown},1000,${finAfterApp.remaining},894.55,1994.55,"trade_republic","Cuenta","|pay|","");
    eq(fin.spent,${finAfterApp.shown}); eq(fin.cash(),1994.55); eq(fin.safeLiq(),894.55);
    // Al releer XML Android puede añadir indentación tras el salto final del journal.
    WidgetSnapshotArbiter.State persisted=base(sep,"trade_republic");
    persisted.journal="evt\\t10\\t10\\t10\\t1\\t1\\tkey\\n    ";
    persisted.journalFull=true;
    ok(WidgetSnapshotArbiter.app(persisted,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(!persisted.journalFull); eq(persisted.spent,50); eq(persisted.cash(),190);
    ok(!persisted.journal.endsWith("\\n"));
    persisted.journal="    "+persisted.journal;
    ok(WidgetSnapshotArbiter.app(persisted,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|evt|",""));
    ok(persisted.journal.isEmpty()); eq(persisted.spent,50); eq(persisted.cash(),190);
    WidgetSnapshotArbiter.State corrupt=base(sep,"trade_republic");
    corrupt.journal="no-es-un-evento"; corrupt.journalFull=true;
    ok(!WidgetSnapshotArbiter.app(corrupt,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|evt|",""));
    ok(corrupt.journalFull); ok(corrupt.journal.equals("no-es-un-evento")); eq(corrupt.spent,40);
    WidgetSnapshotArbiter.State unknown=base(sep,"trade_republic");
    unknown.journal="old\\tNaN\\tNaN\\t10\\t1\\t1\\tkey\\n    ";
    ok(WidgetSnapshotArbiter.app(unknown,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(unknown.unknownPending); ok(!unknown.journalFull); eq(unknown.cash(),190);
    ok(WidgetSnapshotArbiter.app(unknown,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|old|",""));
    ok(!unknown.unknownPending); eq(unknown.cash(),190);
    WidgetSnapshotArbiter.State stored=base(sep,"trade_republic");
    ing(stored,WidgetSnapshotArbiter.begin(stored),sep,sep,800,"new",50,100,50,10,true,true);
    ok(!stored.journal.endsWith("\\n"));
    WidgetSnapshotArbiter.State crossed=base(sep,"trade_republic");
    ing(crossed,WidgetSnapshotArbiter.begin(crossed),sep,sep,900,"first",50,100,50,10,true,true);
    crossed.journal += "\\n    ";
    ing(crossed,WidgetSnapshotArbiter.begin(crossed),sep,sep,901,"second",55,100,45,5,true,true);
    ok(WidgetSnapshotArbiter.app(crossed,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|first|",""));
    eq(crossed.spent,55); eq(crossed.cash(),185); ok(!crossed.journalFull);
    ok(crossed.journal.startsWith("second\\t"));
    WidgetSnapshotArbiter.State oversized=base(sep,"trade_republic");
    String largeEvent=new String(new char[262145]).replace('\\0','x');
    oversized.journal=largeEvent+"\\t10\\t10\\t10\\t1\\t1\\tkey";
    oversized.journalFull=true;
    ok(!WidgetSnapshotArbiter.app(oversized,sep,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""));
    ok(oversized.journalFull); eq(oversized.spent,40);
    ok(WidgetSnapshotArbiter.app(oversized,sep,50,100,50.0,140.0,190.0,"trade_republic","Cuenta","|"+largeEvent+"|",""));
    ok(!oversized.journalFull); ok(oversized.journal.isEmpty()); eq(oversized.cash(),190);
    System.out.println("  ✓ persistencia con espacios, recuperación segura, entrada dañada y delta desconocido conservados");
    System.out.println("  ✓ orden inverso, reentrada, día/mes, banco, possibleDup y pago con lápidas");
  }
}`);
  for (const [cmd, args] of [
    [javac, ["-d", dir, path.join(javaDir, "WidgetSnapshotArbiter.java"), src]],
    [java, ["-cp", dir, "com.micartera.app.WidgetSnapshotArbiterTest"]],
  ]) {
    const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${cmd}: ${r.error || r.stderr || r.stdout}`);
    if (r.stdout) process.stdout.write(r.stdout);
  }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

const ts = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const js = transformSync(ts, { loader: "ts", format: "esm" }).code;
const server = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const app = loadPureLogicFromFile();
const now = Date.parse("2026-09-25T12:00:00Z");
const rows = [
  { id: "a", fecha: "2026-09-25T09:00:00Z", importe: 40, comercio: "Compra", cat: "otros", source: "macrodroid" },
  { id: "b", fecha: "2026-09-25T10:00:00Z", importe: 10, comercio: "Otra", cat: "otros", source: "macrodroid" },
  { id: "c", fecha: "2026-09-25T11:00:00Z", importe: 20, comercio: "Tercera", cat: "otros", source: "macrodroid" },
  { id: "d", fecha: "2026-09-25T11:30:00Z", importe: 30, comercio: "Candidato", cat: "otros", source: "ob:trade_republic#dup" },
];
const state = { budget: 100, accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true }],
  settings: { expenseBanks: ["trade_republic"] }, fixed: [], debts: [], oneoffs: [], reservaLog: [],
  expenses: rows.map(r => ({ id: r.id, date: r.fecha, amount: r.importe, merchant: r.comercio,
    category: r.cat, source: r.source, possibleDup: r.id === "d" })) };
const actualRows = server.filasComoLaApp(rows, []);
assert.deepEqual(actualRows.map(r => r.id), rows.map(r => r.id), "ninguna fila se pierde");
const s = server.statsDelMes(actualRows, state, server.inicioDeMesMs(now));
const c = app.monthBudgetStats(state, now);
assert.equal(s.shown, c.shown);
assert.equal(s.shown, 70);
assert.equal(s.budget - s.against, c.remaining);
console.log("  ✓ mismas cuatro filas: presupuesto app/servidor 70, candidato conservado fuera de cifras");
