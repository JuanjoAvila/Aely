import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* «Mis bancos» sin muro de botones (feedback 2026-07-25: «todo apilotonado con 198349123 funciones»;
 * desde D1, 19/11, la ficha de cada banco es una hoja).
 *
 * Va con e2e por la lección de la 4.7.1 (AGENTS §7): esconder o mover elementos de una lista es
 * exactamente el tipo de cambio que `npm test` no ve —la sintaxis y la lógica siguen perfectas—
 * y que hace desaparecer botones sin que se entere nadie. Aquí lo que hay que blindar es que
 * plegar NO deja al usuario sin forma de reconectar un banco caído, que sería cambiar un coñazo
 * por un callejón sin salida.
 */

const links = [
  { aspsp_name: "Sabadell", aspsp_country: "ES", iban: "ES11", status: "active",
    valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-07-25T09:00:00Z", accounts: [{ uid: "a1" }] },
  { aspsp_name: "CaixaBank", aspsp_country: "ES", iban: "ES22", status: "expired",
    valid_until: "2026-07-01T00:00:00Z", last_sync: "2026-07-01T09:00:00Z", accounts: [{ uid: "a2" }] },
  { aspsp_name: "Revolut", aspsp_country: "ES", iban: "ES33", status: "active",
    valid_until: "2026-11-01T00:00:00Z", last_sync: "2026-07-24T09:00:00Z", accounts: [{ uid: "a3" }] },
];

async function abrirMisBancos(page) {
  await seedLoggedInDashboard(page, { __cloudRows: { bank_links: links }, hasBankLink: true });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  // Misma puerta que usa la app de verdad para llevarte a «Mis bancos» (el banner de Cartera y
  // la noti de banco caído disparan este evento). Con focus:null, que es el caso normal — con un
  // banco enfocado el acordeón lo abre a propósito, y eso se prueba aparte.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator("[data-aspsp]")).toHaveCount(links.length, { timeout: 10_000 });
  // Y que el panel esté PINTADO, no solo montado: existir en el DOM y ocupar pantalla son dos
  // estados distintos, y con la máquina cargada se separan. Cada test daba por hecho el segundo.
  await expect(page.locator("[data-aspsp]").first()).toBeVisible({ timeout: 10_000 });
}

test("Mis bancos: los tres bancos salen, pero SIN el muro de botones", async ({ page }) => {
  await abrirMisBancos(page);

  // Los tres bancos siguen ahí: plegar no puede hacer desaparecer una lista (bug 4.7.1).
  // El nombre se busca DENTRO de su fila, no suelto por la pantalla: `getByText("Sabadell")` a
  // pelo casa también con las pestañas que la app premonta en un hueco libre a los 3,2 s
  // (Cartera: la cuenta sembrada es `ent:"sabadell"`; Plan: «te quedarán 1000 € en Sabadell»),
  // y esas copias están OCULTAS y van ANTES en el DOM. Con la máquina cargada el premontaje
  // llegaba antes que esta línea, `.first()` pasaba a ser la copia escondida y el test caía
  // por mucho timeout que le dieras: no era lentitud, era el elemento equivocado (2026-08-17).
  await expect(page.locator("[data-aspsp]")).toHaveCount(3);
  await expect(page.locator('[data-aspsp="Sabadell"]').getByText("Sabadell", { exact: false }).first())
    .toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-aspsp="CaixaBank"]').getByText("CaixaBank", { exact: false }).first())
    .toBeVisible({ timeout: 10_000 });

  // Antes se pintaban 3 botones por banco (9 en total) de salida. Ahora solo «Renovar» en el caído.
  await expect(page.locator("[data-aspsp] button")).toHaveCount(1);

  // El ESTADO sigue visible con todo plegado: es lo que avisa de que un banco está caído,
  // y esconderlo sería cambiar ruido por ceguera.
  const caixa = page.locator('[data-aspsp="CaixaBank"]');
  await expect(caixa).toContainText(/caduc|renov|permiso/i);
});

/* Desde D1 (19/11) las acciones no se despliegan en la lista: tocar un banco abre SU ficha en una
   hoja, de una en una. Lo que no se puede perder sigue siendo lo mismo: la salida para arreglar un
   banco caído, que ahora está en su propia fila, a un toque. */
test("Mis bancos: tocar un banco abre SU ficha, y solo una a la vez", async ({ page }) => {
  await abrirMisBancos(page);
  await page.locator('[data-aspsp="Sabadell"] .bk-nm').click();
  await expect(page.locator('.bk-ficha[data-bk-ficha="Sabadell"]')).toBeVisible();
  await expect(page.locator(".bk-ficha")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".bk-ficha")).toHaveCount(0);
  await page.locator('[data-aspsp="CaixaBank"] .bk-nm').click();
  await expect(page.locator('.bk-ficha[data-bk-ficha="CaixaBank"]')).toBeVisible();
  await expect(page.locator(".bk-ficha")).toHaveCount(1);
});

test("Mis bancos: el banco caído sigue teniendo su botón de renovar a un toque", async ({ page }) => {
  await abrirMisBancos(page);
  const caixa = page.locator('[data-aspsp="CaixaBank"]');
  // En la propia fila, sin abrir nada: la salida para arreglar el banco.
  await expect(caixa.locator('[data-act="bk-renovar"]')).toHaveCount(1);
  await expect(caixa.locator('[data-act="bk-renovar"]')).toBeVisible();
  // Los que están bien no llevan botón.
  await expect(page.locator('[data-aspsp="Sabadell"] [data-act="bk-renovar"]')).toHaveCount(0);
});
