import assert from "node:assert/strict";
import {
  krakenCheckKeyInfo, krakenErrorCode, krakenHoldings, krakenPairsFor, krakenPositions, krakenSign, krakenSnapshot,
} from "./kraken.ts";

/* Kraken, solo lectura (fase 3). Respuestas SINTÉTICAS con la forma de la doc oficial: ni una clave
   ni un saldo de nadie. La firma se prueba contra el ejemplo publicado en la propia doc
   (docs.kraken.com → Spot REST → Authentication), que es la única prueba que no se inventa. */

Deno.test("firma: el ejemplo oficial de la documentación de Kraken", async () => {
  const sign = await krakenSign(
    "/0/private/AddOrder",
    "1616492376594",
    "nonce=1616492376594&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25",
    "kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSUXNsu3eow76sz84Q18fWxnyRzBHCd3pd5nE9qa99HAZtuZuj6F1huXg==",
  );
  assert.equal(sign, "4/dpxb3iT4tp/ZCVEwSnEsLxx0bqyhLpdfOpc6fn7OR8+UClSV5n9E6aSS8MPtnRfp32bAb0nmbRn6H8ndwLUQ==");
});

Deno.test("permisos: solo «Consultar fondos» entra; cualquiera que mueva dinero se rechaza", () => {
  assert.deepEqual(krakenCheckKeyInfo({ permissions: ["query-funds"], ip_allowlist: [], valid_until: "0" }),
    { ok: true, meta: { perms: ["query-funds"], expiresAt: null } });
  // También con el coste opcional (operaciones cerradas): sigue sin poder mover nada.
  assert.equal(krakenCheckKeyInfo({ permissions: ["query-funds", "query-closed-trades", "query-ledger"] }).ok, true);
  for (const p of ["withdraw-funds", "modify-trades", "close-trades", "add-funds", "earn-funds", "add-withdraw-address", "update-withdraw-address"]) {
    assert.deepEqual(krakenCheckKeyInfo({ permissions: ["query-funds", p] }), { ok: false, code: "kraken_perm", perm: p }, p);
  }
  // El ejemplo de la doc (camelCase): puede retirar y operar → fuera.
  assert.equal((krakenCheckKeyInfo({ permissions: ["query-funds", "withdraw-funds", "query-open-trades", "modify-trades"], ipAllowlist: [] }) as { code: string }).code, "kraken_perm");
  assert.deepEqual(krakenCheckKeyInfo({ permissions: ["query-open-trades"] }), { ok: false, code: "kraken_no_funds" });
  assert.deepEqual(krakenCheckKeyInfo({ permissions: ["query-funds"], ipAllowlist: ["192.0.2.1"] }), { ok: false, code: "kraken_ip" });
  // Lista PERMITIDA: un permiso nuevo que Kraken añada mañana se rechaza, y sin repetir su nombre.
  assert.deepEqual(krakenCheckKeyInfo({ permissions: ["query-funds", "transfer-everything-new"] }), { ok: false, code: "kraken_perm", perm: undefined });
  assert.equal(krakenCheckKeyInfo({ permissions: ["query-funds", "query-open-trades", "query-closed-trades", "query-ledger", "export-data", "create-ws-token"] }).ok, true);
  // Lo que no se puede verificar no se acepta.
  assert.deepEqual(krakenCheckKeyInfo({}), { ok: false, code: "kraken_bad" });
  assert.deepEqual(krakenCheckKeyInfo(null), { ok: false, code: "kraken_bad" });
});

Deno.test("errores de Kraken → códigos cerrados", () => {
  assert.equal(krakenErrorCode([]), null);
  assert.equal(krakenErrorCode(["EAPI:Invalid nonce"]), "kraken_nonce");
  assert.equal(krakenErrorCode(["EAPI:Invalid key"]), "kraken_key");
  assert.equal(krakenErrorCode(["EAPI:Invalid signature"]), "kraken_key");
  assert.equal(krakenErrorCode(["EAPI:Rate limit exceeded"]), "kraken_rate");
  assert.equal(krakenErrorCode(["EService:Unavailable"]), "kraken_temp");
  assert.equal(krakenErrorCode(["EGeneral:Invalid arguments:otp"]), "kraken_otp");
  // Un error desconocido nunca vuelve con su texto: código cerrado genérico.
  const raro = "EFoo:llama al 600 000 000 <b>ya</b>";
  assert.equal(krakenErrorCode([raro]), "kraken_bad");
});

Deno.test("saldos: XXBT es BTC, el staking se suma al base y el dinero va aparte", () => {
  const h = krakenHoldings({
    XXBT: { balance: "0.5000000000", hold_trade: "0" }, "XBT.M": { balance: "0.0100000000" },
    "DOT.S": { balance: "10" }, DOT: { balance: "2" }, "ETH2.S": { balance: "1" }, XETH: { balance: "0.25" },
    ZEUR: { balance: "120.50" }, "EUR.HOLD": { balance: "10" }, ADA: { balance: "0" },
  });
  const by = Object.fromEntries(h.crypto.map((c) => [c.sym, c]));
  assert.equal(by.BTC.qty, 0.51); assert.equal(by.BTC.base, "XBT"); assert.equal(by.BTC.staked, true);
  assert.equal(by.DOT.qty, 12); assert.equal(by.ETH.qty, 1.25); assert.equal(by.ETH.base, "ETH");
  assert.equal(by.ADA, undefined, "saldo 0 no es una posición");
  assert.deepEqual(h.fiat, [{ cur: "EUR", amt: 130.5 }]);
  // «.T» (tokenizado) no es staking: no se avisa como tal.
  assert.equal(krakenHoldings({ "SOL.T": { balance: "1" } }).crypto[0].staked, false);
});

Deno.test("precio: par en EUR primero, USD si no hay; sin par no entra y se avisa", () => {
  const pairs = krakenPairsFor(["XBT", "DOT", "FOO", "BAR"], {
    XXBTZEUR: { base: "XXBT", quote: "ZEUR" }, XXBTZUSD: { base: "XXBT", quote: "ZUSD" },
    "XXBTZEUR.d": { base: "XXBT", quote: "ZEUR" }, DOTUSD: { base: "DOT", quote: "ZUSD" }, FOOEUR: { base: "FOO", quote: "ZEUR" },
  });
  assert.deepEqual(pairs, { XBT: { pair: "XXBTZEUR", cur: "EUR" }, FOO: { pair: "FOOEUR", cur: "EUR" }, DOT: { pair: "DOTUSD", cur: "USD" } });
  const out = krakenPositions(
    { crypto: [{ base: "XBT", sym: "BTC", qty: 0.5, staked: false }, { base: "DOT", sym: "DOT", qty: 12, staked: true }, { base: "BAR", sym: "BAR", qty: 3, staked: false }], fiat: [] },
    pairs, { XXBTZEUR: { c: ["60000.0", "0.1"] }, DOTUSD: { c: ["5.5", "1"] } },
  );
  assert.equal(out.positions.length, 2);
  const btc = out.positions[0];
  assert.deepEqual([btc.key, btc.cur, btc.valueHint, btc.cost, btc.costEur, btc.kind], ["BTC", "EUR", 30000, null, null, "crypto"]);
  // Dos vías: el valor es cantidad × último precio, y el coste es «—», no 0.
  assert.equal(btc.valueHint, +(btc.shares * btc.price).toFixed(2));
  assert.equal(out.positions[1].cur, "USD"); assert.equal(out.positions[1].valueHint, 66);
  assert.deepEqual(out.present, ["BAR"]);
  assert.deepEqual(out.warnings, [{ k: "staked", name: "DOT" }, { k: "noprice", name: "BAR" }]);
});

Deno.test("snapshot entero con fetch simulado: firma, nonce creciente y nada de red real", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fake = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = url.endsWith("/BalanceEx") ? { error: [], result: { XXBT: { balance: "0.1" }, ZEUR: { balance: "5" } } }
      : url.includes("/AssetPairs") ? { error: [], result: { XXBTZEUR: { base: "XXBT", quote: "ZEUR" } } }
      : url.includes("/Ticker") ? { error: [], result: { XXBTZEUR: { c: ["50000", "1"] } } } : { error: ["EGeneral:Unknown"] };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  let n = 100n;
  const snap = await krakenSnapshot(fake, "PUBLICKEY", btoa("secreto-sintetico-de-64-bytes".padEnd(64, "x")), async () => ++n);
  assert.equal(snap.ok, true);
  if (!snap.ok) return;
  assert.equal(snap.positions[0].valueHint, 5000);
  assert.deepEqual(snap.cash, [{ cur: "EUR", amt: 5 }]);
  const priv = calls[0];
  assert.equal(priv.url, "https://api.kraken.com/0/private/BalanceEx");
  assert.equal(priv.init?.body, "nonce=101");
  const h = priv.init?.headers as Record<string, string>;
  assert.equal(h["API-Key"], "PUBLICKEY");
  assert.match(h["API-Sign"], /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(calls.every((c) => c.url.startsWith("https://api.kraken.com/0/")));
  // Un error de Kraken en mitad del sync no da posiciones parciales.
  const roto = await krakenSnapshot(async () => new Response(JSON.stringify({ error: ["EAPI:Invalid nonce"] })), "K", btoa("s"), async () => 1);
  assert.deepEqual(roto, { ok: false, code: "kraken_nonce" });
});
