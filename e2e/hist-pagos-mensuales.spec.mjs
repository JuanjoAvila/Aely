import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* IMPORTAR HISTÓRICO — TRES MESES DEL MISMO RECIBO SON TRES PAGOS (FIN-02).
 *
 * Lo que fallaba: `histClassifyCandidates` pasaba todos los candidatos por `dedupeHistRecibos`,
 * que compara comercio + importe + banco SIN FECHA. Tres recibos de luz de junio, julio y agosto
 * eran "el mismo": entraba uno y los otros dos se pintaban desmarcados, en verde, como repetidos.
 * Dos meses de pagos reales perdidos.
 *
 * Y la otra mitad, que es la que obliga a un e2e y no a un unitario: la pantalla NO usa
 * `histBuildCommit` — `runImport` crea un Fijo por fila marcada. Quitar el descarte sin agrupar
 * habría creado TRES Fijos idénticos, y un Fijo se cobra todos los meses para siempre. El
 * cableado entre lo que se marca en pantalla y `histFijosFromSelection` solo se comprueba aquí.
 */

const bankLinks = [
  { aspsp_name: "Sabadell", aspsp_country: "ES", status: "active",
    valid_until: "2026-12-01T00:00:00Z", last_sync: "2026-09-01T09:00:00Z", accounts: [{ uid: "a1" }] },
];

// Tres cargos idénticos en tres meses + uno distinto, todos SIN tarjeta (los que admiten «Recibo»).
const histLinks = [
  { aspsp: "Sabadell", accounts: [{ transactions: [
    { date: "2026-08-12", amount: 12, merchant: "Iberdrola", card: false, ext_id: "ib3" },
    { date: "2026-07-12", amount: 12, merchant: "IBERDROLA", card: false, ext_id: "ib2" },
    { date: "2026-06-12", amount: 12, merchant: "iberdrola", card: false, ext_id: "ib1" },
    { date: "2026-08-03", amount: 13, merchant: "Netflix", card: false, ext_id: "nf1" },
  ] }] },
];

async function abrirHistorico(page) {
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    settings:{autoPrices:false,theme:"green",expenseBanks:["sabadell"]},
    __cloudRows: { bank_links: bankLinks },
    __cloudFns: { "bank-sync": { data: { ok: true, links: histLinks }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  const overlay = page.locator(".hist-import");
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: /Buscar movimientos/i }).click();
  await expect(overlay.getByText("Netflix")).toBeVisible({ timeout: 10_000 });
  return overlay;
}

test("★ los tres meses del mismo recibo salen los tres, marcados y sin avisos de repetido", async ({ page }) => {
  const overlay = await abrirHistorico(page);

  // Cuatro movimientos, los cuatro contando para importar: ninguno descartado por «lote».
  await expect(overlay.getByRole("button", { name: /Importar 4/ })).toBeVisible();

  // Y ninguno puede llevar la etiqueta de repetido mensual, que era la que los tumbaba.
  await expect(overlay.getByText(/ya detectado como recibo mensual/i)).toHaveCount(0);
});

test("★ marcar los tres meses como «Recibo» crea UN recibo fijo, no tres", async ({ page }) => {
  const overlay = await abrirHistorico(page);

  // Marcar como «Recibo» los TRES meses de Iberdrola, por su id de movimiento y no por posición
  // (las filas se pintan con estilos en línea; `data-cand` existe justo para poder apuntarlas).
  await expect(overlay.locator('[data-dest="recibo"]')).toHaveCount(4);
  for (const id of ["ib3", "ib2", "ib1"]) {
    await overlay.locator('[data-cand="' + id + '"][data-dest="recibo"]').click();
  }

  // El diálogo tiene que anunciar UNO, no tres: es lo que se va a crear de verdad.
  await overlay.getByRole("button", { name: /Importar \d/ }).click();
  await expect(page.getByText(/¿Crear 1 recibo\(s\) fijo\(s\)\?/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Crear recibos fijos/i }).click();

  // Y donde de verdad se ve: en Plan solo puede haber UN recibo de Iberdrola, no tres.
  // (El aviso final no sirve de prueba: en pruebas la nube no confirma el lote y el toast pasa a
  // ser el de "sin confirmación", que es correcto pero no dice nada de los Fijos.)
  await expect(page.locator(".hist-import")).toHaveCount(0, { timeout: 10_000 });
  // El guardado no es inmediato, así que se sondea en vez de leer una vez.
  await expect.poll(() => page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem(mcStateKey()) || "{}");
    return (raw.fixed || []).filter((f) => /iberdrola/i.test(f.name)).map((f) => f.name + "|" + f.amount + "|" + f.account);
  }), { timeout: 15_000 }).toEqual(["Iberdrola|12|sabadell"]);
});
