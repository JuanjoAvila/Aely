import assert from "node:assert/strict";
import { ibkrCheckXml, ibkrCode, ibkrFetchStatement, ibkrStatementUrl, ibkrTokenMuerto } from "./ibkr.ts";

/* IBKR Flex Web Service (fase 2). Respuestas SINTÉTICAS con la forma de la doc oficial
   (SendRequest / GetStatement, v3); ni un token ni una cuenta de nadie. */

const ok = (ref = "1234567890") =>
  `<FlexStatementResponse timestamp="x"><Status>Success</Status><ReferenceCode>${ref}</ReferenceCode><Url>https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url></FlexStatementResponse>`;
const fail = (code: string) => `<FlexStatementResponse timestamp="x"><Status>Fail</Status><ErrorCode>${code}</ErrorCode><ErrorMessage>texto del bróker</ErrorMessage></FlexStatementResponse>`;
const warn = (code: string) => `<FlexStatementResponse timestamp="x"><Status>Warn</Status><ErrorCode>${code}</ErrorCode><ErrorMessage>generando</ErrorMessage></FlexStatementResponse>`;
const XML = `<FlexQueryResponse queryName="Aely" type="AF"><FlexStatements count="1"><FlexStatement accountId="U0000000" fromDate="2026-11-18" toDate="2026-11-18" period="LastBusinessDay"><OpenPositions><OpenPosition accountId="U0000000" symbol="VWCE" isin="IE00BK5BQT80" position="10" markPrice="100" positionValue="1000" currency="EUR" assetCategory="STK" levelOfDetail="SUMMARY"/></OpenPositions></FlexStatement></FlexStatements></FlexQueryResponse>`;

function doble(respuestas: string[]) {
  const urls: string[] = [], heads: unknown[] = [], esperas: number[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    urls.push(url); heads.push(init?.headers);
    const r = respuestas.shift();
    if (r === undefined) throw new Error("petición de más");
    return new Response(r, { status: 200 });
  };
  return { fetchFn, urls, heads, esperas, sleep: async (ms: number) => { esperas.push(ms); } };
}

Deno.test("SendRequest + GetStatement, v=3 y User-Agent siempre", async () => {
  const d = doble([ok(), XML]);
  const r = await ibkrFetchStatement(d.fetchFn, "111222333", "987654", d.sleep);
  assert.deepEqual(r, { ok: true, xml: XML });
  assert.equal(d.urls[0], "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/SendRequest?t=111222333&q=987654&v=3");
  assert.equal(d.urls[1], "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?t=111222333&q=1234567890&v=3");
  for (const h of d.heads) assert.ok((h as Record<string, string>)["User-Agent"]);
});

Deno.test("1019 «generándose»: espera y reintenta; con el tope agotado, se rinde con 1019", async () => {
  const d = doble([ok(), warn("1019"), warn("1019"), XML]);
  const r = await ibkrFetchStatement(d.fetchFn, "t", "1", d.sleep);
  assert.equal(r.ok, true);
  assert.deepEqual(d.esperas, [2000, 3000]);
  const lento = doble([ok(), ...Array(20).fill(warn("1019"))]);
  const r2 = await ibkrFetchStatement(lento.fetchFn, "t", "1", lento.sleep, 30_000);
  assert.deepEqual(r2, { ok: false, code: "flex_1019" });
  assert.ok(lento.esperas.reduce((a, b) => a + b, 0) <= 30_000, "no pasa de ~30 s");
  assert.ok(lento.urls.length <= 10, "lejos del límite de 10 por minuto: " + lento.urls.length);
});

Deno.test("1012 caducado y 1015 inválido: token muerto; 1018 demasiadas: no lo es", async () => {
  for (const [c, muerto] of [["1012", true], ["1015", true], ["1018", false], ["1014", false], ["1013", false]] as const) {
    const d = doble([fail(c)]);
    const r = await ibkrFetchStatement(d.fetchFn, "t", "1", d.sleep);
    assert.deepEqual(r, { ok: false, code: "flex_" + c });
    assert.equal(ibkrTokenMuerto((r as { code: string }).code), muerto, c);
    assert.equal(d.urls.length, 1, "un fallo definitivo no se reintenta");
  }
  // El 1012 también puede llegar en GetStatement.
  const d = doble([ok(), fail("1012")]);
  assert.deepEqual(await ibkrFetchStatement(d.fetchFn, "t", "1", d.sleep), { ok: false, code: "flex_1012" });
});

Deno.test("temporales: un reintento en SendRequest; si sigue, código temporal", async () => {
  const d = doble([fail("1004"), ok(), XML]);
  assert.equal((await ibkrFetchStatement(d.fetchFn, "t", "1", d.sleep)).ok, true);
  const d2 = doble([fail("1009"), fail("1021")]);
  assert.deepEqual(await ibkrFetchStatement(d2.fetchFn, "t", "1", d2.sleep), { ok: false, code: "flex_temp" });
  assert.equal(ibkrCode("1025"), "flex_1025");
  assert.equal(ibkrCode("9999"), "flex_bad");
});

Deno.test("la URL de GetStatement solo se sigue si es de IBKR y HTTPS", () => {
  assert.equal(ibkrStatementUrl("https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement"),
    "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement");
  const def = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement";
  assert.equal(ibkrStatementUrl("https://evil.example/GetStatement"), def);
  assert.equal(ibkrStatementUrl("http://ndcdyn.interactivebrokers.com/x"), def);
  assert.equal(ibkrStatementUrl("https://interactivebrokers.com.evil.example/x"), def);
  // Sin el punto delante no es un subdominio de IBKR.
  assert.equal(ibkrStatementUrl("https://evilinteractivebrokers.com/GetStatement"), def);
  assert.equal(ibkrStatementUrl(null), def);
});

Deno.test("el XML tiene que ser una Activity con Open Positions (vacía vale, ausente no)", () => {
  assert.deepEqual(ibkrCheckXml(XML), { ok: true, accounts: 1, toDate: "2026-11-18" });
  assert.equal(ibkrCheckXml(XML.replace(/<OpenPositions>.*<\/OpenPositions>/, "<OpenPositions />")).ok, true);
  assert.deepEqual(ibkrCheckXml(XML.replace(/<OpenPositions>.*<\/OpenPositions>/, "<CashReport />")), { ok: false, code: "flex_no_positions" });
  assert.deepEqual(ibkrCheckXml("<html>no</html>"), { ok: false, code: "flex_bad" });
});
