#!/usr/bin/env node
/**
 * CONCEPTO de los movimientos (petición del padre, 2026-07-24): el mensaje del bizum / la
 * descripción del extracto, para no tener que abrir la app del banco a cada rato.
 *
 * Lo que se prueba aquí es la parte delicada: QUÉ se enseña y qué NO. Un concepto que repite el
 * título o que es una referencia interna del banco («REF 000123456789») es ruido, y en una app de
 * dinero el ruido cuesta más que el hueco.
 */
import assert from "node:assert/strict";
import { loadPureLogicFromFile,loadPureLogic } from "../scripts/load-pure-logic.mjs";
import fs from 'node:fs';
import {renameWitness} from './fin04-rename-witnesses.mjs';
import {queueWitness,durableQueueWitness} from './fin04-queue-witnesses.mjs';

const ctx = loadPureLogicFromFile();

// Acepta casos síncronos y async (los de la red de seguridad de `nota` devuelven promesa).
const pendientes = [];
function t(name, fn) {
  pendientes.push({name,fn});
}

console.log("expense-note");

t("cleanNote: deja pasar un concepto de verdad", () => {
  assert.equal(ctx.cleanNote("Cena del sábado", "Bizum a Pedro"), "Cena del sábado");
  assert.equal(ctx.cleanNote("  alquiler   julio  ", "María"), "alquiler julio");
});

t("cleanNote: no repite lo que ya se ve en el título", () => {
  // El banco manda «BIZUM DE MARIA» y el título ya es «Bizum de María»: pintarlo dos veces
  // ensucia la lista sin aportar nada.
  assert.equal(ctx.cleanNote("BIZUM DE MARIA", "Bizum de María"), "");
  assert.equal(ctx.cleanNote("mercadona", "Mercadona"), "");
});

t("cleanNote: tira las referencias internas del banco", () => {
  assert.equal(ctx.cleanNote("REF 000123456789", "Recibo luz"), "");
  assert.equal(ctx.cleanNote("Mandato: ES1234567890ABCD", "Endesa"), "");
});

t("cleanNote: aguanta vacíos y nulos sin romper", () => {
  assert.equal(ctx.cleanNote(null, "X"), "");
  assert.equal(ctx.cleanNote("", "X"), "");
  assert.equal(ctx.cleanNote("   ", "X"), "");
  assert.equal(ctx.cleanNote("algo", null), "algo");
});

t("cleanNote: recorta a 160 (la columna `nota` no es infinita)", () => {
  const largo = "x".repeat(300);
  assert.equal(ctx.cleanNote(largo, "Y").length, 160);
});

t("expenseNote: lo que se pinta en la fila", () => {
  assert.equal(ctx.expenseNote({ merchant: "Bizum a Ana", note: "Regalo de Luis" }), "Regalo de Luis");
  assert.equal(ctx.expenseNote({ merchant: "Ana", note: "Ana" }), "");
  assert.equal(ctx.expenseNote({ merchant: "Ana" }), "");
  assert.equal(ctx.expenseNote(null), "");
});

t("expenseFromRow: baja `nota` y respeta el editado a mano", () => {
  const e = ctx.expenseFromRow({
    id: "1", fecha: "2026-07-01T12:00:00.000Z", importe: 40, comercio: "Bizum a Pedro",
    cat: "otros", source: "macrodroid", nota: "Cena del sábado", nota_edit: true,
  });
  assert.equal(e.note, "Cena del sábado");
  assert.equal(e.noteEdited, true);

  const sinNota = ctx.expenseFromRow({ id: "2", fecha: "2026-07-01T12:00:00.000Z", importe: 5, comercio: "X", cat: "otros", source: "manual" });
  assert.equal(sinNota.note, undefined);
  assert.equal(sinNota.noteEdited, undefined);
});

t("enrichNotesFromBankTx: rellena el histórico viejo con lo que trae el banco", () => {
  const expenses = [
    { id: "a", extId: "tx1", date: "2026-07-10T12:00:00.000Z", amount: 40, merchant: "Bizum a Pedro" },
    { id: "b", date: "2026-07-11T12:00:00.000Z", amount: 12.5, merchant: "Mercadona" },
  ];
  const txs = [
    { id: "tx1", date: "2026-07-10", amount: 40, merchant: "Bizum a Pedro", note: "Cena del sábado" },
    { id: "tx9", date: "2026-07-11", amount: 12.5, merchant: "Mercadona", note: "Compra semanal" },
  ];
  const out = ctx.enrichNotesFromBankTx(expenses, txs);
  assert.equal(out[0].note, "Cena del sábado");   // casado por ext_id
  assert.equal(out[1].note, "Compra semanal");    // casado por fecha|importe|comercio
});

t("enrichNotesFromBankTx: NUNCA pisa lo que escribió el usuario", () => {
  const expenses = [
    { id: "a", extId: "tx1", date: "2026-07-10T12:00:00.000Z", amount: 40, merchant: "Bizum a Pedro", note: "Lo mío", noteEdited: true },
    { id: "b", extId: "tx2", date: "2026-07-10T12:00:00.000Z", amount: 20, merchant: "Otro", note: "ya tenía" },
  ];
  const txs = [
    { id: "tx1", date: "2026-07-10", amount: 40, merchant: "Bizum a Pedro", note: "Lo del banco" },
    { id: "tx2", date: "2026-07-10", amount: 20, merchant: "Otro", note: "Lo del banco" },
  ];
  const out = ctx.enrichNotesFromBankTx(expenses, txs);
  assert.equal(out[0].note, "Lo mío");     // editado a mano: intocable
  assert.equal(out[1].note, "ya tenía");   // ya había concepto: solo se rellenan huecos
});

t("enrichNotesFromBankTx: sin nada que cambiar devuelve el MISMO array (cero renders de más)", () => {
  const expenses = [{ id: "a", date: "2026-07-10T12:00:00.000Z", amount: 40, merchant: "X" }];
  assert.equal(ctx.enrichNotesFromBankTx(expenses, [{ id: "z", date: "2026-01-01", amount: 1, merchant: "Y", note: "n" }]), expenses);
  assert.equal(ctx.enrichNotesFromBankTx(expenses, []), expenses);
  assert.equal(ctx.enrichNotesFromBankTx([], [{ id: "z", date: "2026-01-01", amount: 1, merchant: "Y", note: "n" }]).length, 0);
});

t("pushDeleted: las lápidas no crecen sin fin", () => {
  let list = [];
  for (let i = 0; i < 600; i++) list = ctx.pushDeleted(list, "k" + i);
  assert.equal(list.length, 500);
  assert.equal(list[list.length - 1], "k599");   // se conservan las MÁS RECIENTES
  assert.equal(list[0], "k100");
});

t("bankIssuesOf: caducados y sin-cuentas sí; hipos pasajeros no", () => {
  const links = [
    { aspsp: "Sabadell", ok: true },
    { aspsp: "CaixaBank", ok: false, expired: true },
    { aspsp: "BBVA", ok: false, noacct: true },
    { aspsp: "Santander", ok: false, error: "429 rate limit" },   // pasajero: se reintenta solo
  ];
  const out = ctx.bankIssuesOf(links);
  assert.equal(out.length, 2);
  assert.equal(out[0].aspsp, "CaixaBank");
  assert.equal(out[0].kind, "expired");
  assert.equal(out[1].aspsp, "BBVA");
  assert.equal(out[1].kind, "noacct");
});

/* RED DE SEGURIDAD de la migración 0017 (2026-07-24).
   `deploy.yml` y `supabase.yml` corren en paralelo, y el paso de migraciones lleva
   continue-on-error. Si el cliente nuevo llega antes que la columna, el upsert de gastos fallaría
   ENTERO y los gastos dejarían de subir a la nube — en silencio, porque los llamantes hacen
   .catch(){}. Con la red de seguridad se pierde el concepto (comodidad), nunca el gasto (dato). */
t("withNotaFallback: sin la columna, reintenta sin ella y NO pierde el gasto", async () => {
  const ctx=loadPureLogicFromFile();
  const errCol = { message: 'column "nota" of relation "expenses" does not exist' };
  const intentos = [];
  const r = await ctx.withNotaFallback(function (conNota) {
    intentos.push(conNota);
    return Promise.resolve(conNota ? { error: errCol } : { data: [{ id: 1 }], error: null });
  });
  assert.deepEqual(intentos, [true, false]);   // lo intenta con nota y reintenta sin ella
  assert.equal(r.error, null);
});

t("withNotaFallback: con la columna puesta, va a la primera", async () => {
  const ctx=loadPureLogicFromFile();
  const intentos = [];
  const r = await ctx.withNotaFallback(function (conNota) {
    intentos.push(conNota);
    return Promise.resolve({ data: [{ id: 1 }], error: null });
  });
  assert.deepEqual(intentos, [true]);
  assert.equal(r.error, null);
});

t("withNotaFallback: un error que NO es de la columna se propaga (no se traga)", async () => {
  const ctx=loadPureLogicFromFile();
  const otro = { message: "permission denied for table expenses" };
  await assert.rejects(
    ctx.withNotaFallback(function () { return Promise.resolve({ error: otro }); }),
    (e) => e.message === otro.message,
  );
});

t('FIN04 R2 renombrado pendiente, ACK exacto, tardío y reintento',()=>renameWitness(loadPureLogicFromFile()));
t('FIN04 R3 fallo permanente libera cola con aviso único',()=>queueWitness(loadPureLogicFromFile()));
t('FIN04 R3 contador durable e intención más reciente',()=>durableQueueWitness(loadPureLogicFromFile()));
for(const [name,from,to,witness] of [
  ['nunca apartar','const quarantined=failures>=3;','const quarantined=false;',queueWitness],
  ['avisar cada fallo','p.fail(orig,failures,quarantined)','p.fail(orig,failures,true)',queueWitness],
  ['no avanzar cola','if(quarantined)return paso();','if(quarantined)return;',queueWitness],
  ['recarga reinicia contador','orig.renamePending&&orig.renamePending.failures||0','0',durableQueueWitness],
  ['fallo viejo aparta nueva intención','||e.renamePending.at!==intent.at)return e;',' )return e;',durableQueueWitness]
])t('FIN04 R3 mutante cazado: '+name,async()=>{
  const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(html.includes(from),'mutante aplica');const mutated=loadPureLogic(html.replace(from,to));await assert.rejects(witness(mutated),{name:'AssertionError'});
});
for(const [name,from,to] of [
  ['nombre falsamente confirmado','{renamePending:{merchant:merchant,at:at}}','{merchant:merchant,renamePending:{merchant:merchant,at:at}}'],
  ['ACK viejo consume intención nueva','after.renamePending&&after.renamePending.at===intent.at','after.renamePending'],
  ['ACK de otro nombre','if(!ack||ack.comercio!==intent.merchant||Number(ack.importe)','if(!ack||Number(ack.importe)'],
  ['red caída pierde cola','if(quarantined)cola.pend.shift();','if(true)cola.pend.shift();']
])t('FIN04 R2 mutante cazado: '+name,async()=>{
  const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(html.includes(from),'mutante aplica');
  const mutated=loadPureLogic(html.replace(from,to));await assert.rejects(renameWitness(mutated),{name:'AssertionError'});
});
for(const {name,fn} of pendientes){
  try{await fn();console.log(`  ✓ ${name}`);}
  catch(e){console.error(`  ✗ ${name}`);throw e;}
}
console.log("\nexpense-note: OK");
