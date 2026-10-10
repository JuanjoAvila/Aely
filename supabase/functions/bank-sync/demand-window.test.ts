import { assertEquals } from "jsr:@std/assert@1";
import { currentDemandWindowStart, demandReadComplete, demandSyncFrom, ymdAddDays } from "./demand-window.ts";

const now = new Date("2026-10-10T12:00:00Z");
const windowStart = currentDemandWindowStart(now);

Deno.test("sin último éxito la ventana es la de siempre", () => {
  for (const last of [null, "", "pendiente", "2026/07/01"]) {
    const r = demandSyncFrom(now, last, true);
    assertEquals(r.from, windowStart);
    assertEquals(r.gap, false);
    assertEquals(r.gapBeyondCap, false);
  }
});

Deno.test("pide el más antiguo entre el margen y el último éxito menos 3 días", () => {
  const recent = demandSyncFrom(now, "2026-10-09T08:00:00Z", true);
  assertEquals(recent.from, windowStart);
  assertEquals(recent.gap, false);
  const last = "2026-08-15T21:00:00Z";
  const wide = demandSyncFrom(now, last, true);
  assertEquals(wide.from, ymdAddDays("2026-08-15", -3));
  assertEquals(wide.gap, true);
  assertEquals(wide.gapBeyondCap, false);
  assertEquals(wide.from < windowStart, true);
});

Deno.test("un hueco de más de 90 días se corta y se señala", () => {
  const r = demandSyncFrom(now, "2026-05-01T00:00:00Z", true);
  assertEquals(r.from, "2026-07-12");
  assertEquals(r.gapBeyondCap, true);
  assertEquals(r.gap, true);
});

Deno.test("el cliente que no recupera huecos no ensancha la petición", () => {
  const r = demandSyncFrom(now, "2026-05-01T00:00:00Z", false);
  assertEquals(r.from, windowStart);
  assertEquals(r.gapBeyondCap, false);
  assertEquals(r.gap, true);
});

Deno.test("R4 el solape de 3 días no es un hueco si el último éxito está en la ventana", () => {
  const inside = demandSyncFrom(now, "2026-09-25T09:00:00Z", false);
  assertEquals(inside.from, windowStart);
  assertEquals(inside.gap, false);
  assertEquals(inside.gapBeyondCap, false);
  const same = demandSyncFrom(now, "2026-09-25T09:00:00Z", true);
  assertEquals(same.from, windowStart);
  assertEquals(same.gap, false);
});

Deno.test("una lectura parcial o con 429 no cuenta como completa", () => {
  assertEquals(demandReadComplete([{ ok: true, truncated: false }]), true);
  assertEquals(demandReadComplete([{ ok: true, truncated: true }]), false);
  assertEquals(demandReadComplete([{ ok: true, transactionError: "timeout" }]), false);
  assertEquals(demandReadComplete([{ ok: false, error: "EB 429" }]), false);
  assertEquals(demandReadComplete([{ ok: true }, { ok: false, error: "EB 429" }]), false);
  assertEquals(demandReadComplete([]), false);
  assertEquals(demandReadComplete(null), false);
});
