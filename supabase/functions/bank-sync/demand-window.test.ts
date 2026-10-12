import { assertEquals } from "jsr:@std/assert@1";
import { ackCursor, ackToken, chunkCursor, currentDemandWindowStart, demandFloor, demandPlan, demandReadComplete, nextChunkDays, ymdAddDays, ymdSpan } from "./demand-window.ts";

const now = new Date("2026-10-10T12:00:00Z");
const windowStart = currentDemandWindowStart(now);

Deno.test("sin último éxito la ventana es la de siempre", () => {
  for (const last of [null, "", "pendiente", "2026/07/01"]) {
    const r = demandPlan(now, last, true);
    assertEquals(r.windowStart, windowStart);
    assertEquals(r.gap, false);
    assertEquals(r.gapBeyondCap, false);
  }
});

Deno.test("el tramo va del día del último éxito a la víspera de la ventana, con 3 días de cortesía", () => {
  const recent = demandPlan(now, "2026-10-09T08:00:00Z", true);
  assertEquals(recent.gap, false);
  const wide = demandPlan(now, "2026-08-15T21:00:00Z", true);
  assertEquals(wide.gap, true);
  assertEquals(wide.from, "2026-08-15");
  assertEquals(wide.to, ymdAddDays(windowStart, -1));
  assertEquals(wide.overlapFrom, "2026-08-12");
  assertEquals(wide.gapBeyondCap, false);
});

Deno.test("un trozo sellado se reanuda en el día siguiente y sin solape", () => {
  const r = demandPlan(now, chunkCursor("2026-08-20"), true);
  assertEquals(r.from, "2026-08-21");
  assertEquals(r.overlapFrom, null);
  assertEquals(r.gap, true);
  // PostgREST devuelve el mismo instante con otro formato.
  assertEquals(demandPlan(now, "2026-08-20T23:59:59.999+00:00", true).from, "2026-08-21");
  assertEquals(demandPlan(now, "2026-08-21T01:59:59.999+02:00", true).from, "2026-08-21");
  // La víspera de la ventana sellada ya no deja tramo.
  assertEquals(demandPlan(now, chunkCursor(ymdAddDays(windowStart, -1)), true).gap, false);
});

Deno.test("solo un hueco REAL de más de 90 días se corta y se señala", () => {
  const far = demandPlan(now, "2026-05-01T00:00:00Z", true);
  assertEquals(far.from, "2026-07-12");
  assertEquals(far.overlapFrom, null);
  assertEquals(far.gapBeyondCap, true);
  assertEquals(far.gap, true);
  // 90 días justos: el día del último éxito todavía lo entrega el banco.
  const edge = demandPlan(now, "2026-07-12T12:00:00Z", true);
  assertEquals(edge.from, "2026-07-12");
  assertEquals(edge.gapBeyondCap, false);
  assertEquals(edge.overlapFrom, null);
  // 89 días: antes saltaba por el solape de 3. El solape se recorta al tope, sin aviso.
  const near = demandPlan(now, "2026-07-13T12:00:00Z", true);
  assertEquals(near.gapBeyondCap, false);
  assertEquals(near.overlapFrom, "2026-07-12");
  assertEquals(demandPlan(now, "2026-07-11T12:00:00Z", true).gapBeyondCap, true);
});

Deno.test("el cliente que no recupera huecos no recibe aviso de tope", () => {
  const r = demandPlan(now, "2026-05-01T00:00:00Z", false);
  assertEquals(r.gapBeyondCap, false);
  assertEquals(r.gap, true);
});

Deno.test("R4 el último éxito dentro de la ventana no es un hueco", () => {
  for (const recover of [false, true]) {
    const r = demandPlan(now, "2026-09-25T09:00:00Z", recover);
    assertEquals(r.gap, false);
    assertEquals(r.gapBeyondCap, false);
  }
  assertEquals(demandPlan(now, windowStart + "T00:00:00Z", true).gap, false);
  assertEquals(demandPlan(now, ymdAddDays(windowStart, -1) + "T10:00:00Z", true).gap, true);
});

Deno.test("el trozo crece al doble mientras quepa y se reduce a la mitad hasta un día", () => {
  assertEquals(nextChunkDays(1, 1, 1, 7), 2);
  assertEquals(nextChunkDays(4, 3, 7, 5), 8);
  assertEquals(nextChunkDays(8, 5, 15, 3), 8);
  assertEquals(nextChunkDays(8, 7, 23, 1), 2);
  assertEquals(nextChunkDays(16, 12, 4, 2), 1);
  assertEquals(nextChunkDays(4, 3, 7, 0), 1);
  assertEquals(ymdSpan("2026-08-30", "2026-09-02"), 4);
});

Deno.test("el suelo del cliente va tres días por debajo del primer día pedido", () => {
  assertEquals(demandFloor("2026-09-23"), "2026-09-20");
  assertEquals(demandFloor("2026-03-02"), "2026-02-27");
});

Deno.test("el acuse solo mueve el cursor si es de este enlace, no es futuro y va por delante", () => {
  const sealed = ackToken(chunkCursor("2026-08-20"), "L1");
  assertEquals(sealed, "2026-08-20T23:59:59.999Z|L1");
  assertEquals(ackCursor(sealed, "L1", "2026-08-15T21:00:00Z", now), "2026-08-20T23:59:59.999Z");
  // El acuse aceptado se lee como un día sellado: el tramo sigue en el siguiente.
  assertEquals(demandPlan(now, ackCursor(sealed, "L1", null, now), true).from, "2026-08-21");
  assertEquals(ackCursor(sealed, "L1", null, now), "2026-08-20T23:59:59.999Z");
  assertEquals(ackCursor(sealed, "L2", null, now), null);
  assertEquals(ackCursor(sealed, "L1", "2026-08-20T23:59:59.999+00:00", now), null);
  assertEquals(ackCursor(sealed, "L1", "2026-09-01T10:00:00Z", now), null);
  assertEquals(ackCursor(ackToken(now.toISOString(), "L1"), "L1", "2026-09-01T10:00:00Z", now), now.toISOString());
  assertEquals(ackCursor(ackToken("2026-10-10T12:00:00.001Z", "L1"), "L1", null, now), null);
  for (const raw of [null, 7, {}, "", "2026-08-20|L1", "2026-08-20T23:59:59.999Z", "2026-08-20T23:59:59Z|L1", "2026-13-45T00:00:00.000Z|L1"]) {
    assertEquals(ackCursor(raw, "L1", null, now), null);
  }
});

Deno.test("una lectura parcial o con una cuenta caída no cuenta como entera", () => {
  assertEquals(demandReadComplete([{ ok: true, truncated: false }]), true);
  assertEquals(demandReadComplete([{ ok: true, truncated: true }]), false);
  assertEquals(demandReadComplete([{ ok: true, transactionError: "timeout" }]), false);
  assertEquals(demandReadComplete([{ ok: false }]), false);
  assertEquals(demandReadComplete([{ ok: true }, { ok: false }]), false);
  assertEquals(demandReadComplete([]), false);
  assertEquals(demandReadComplete(null), false);
});
