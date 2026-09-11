/* LA FICHA DE UNA CUENTA EN CARTERA (2026-09-11).
 *
 * Rediseño que pidió y aprobó viendo la maqueta: *«hazme un diseño más bonito para editar los
 * bancos en la zona de cartera, porque es muy cutrón que se despliegue abajo para editar y es
 * bastante feo»* → *«me gusta que se pudiera apretar en un banco y se despliegue una ficha como si
 * apuntara un gasto, es limpio y está chulo»*.
 *
 * Lo que este fichero ata, que son las tres decisiones suyas:
 *  · Tocar la fila ENTERA abre la ficha (y **sin flecha** al lado del importe: «pero sin la flecha
 *    esa que sale al lado del dinero que tienes»).
 *  · En una cuenta CONECTADA el saldo no se escribe: lo manda el banco, y se dice con su candado.
 *    En una cuenta suya, ahí sí hay casilla. Editarlo en una conectada sería mentirse.
 *  · El rol deja de ser tres chips sueltos con la explicación en letra pequeña al final de la
 *    tarjeta: cada opción lleva SU frase de qué hace.
 */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const accounts = [
  { id: "sb", ent: "sabadell", name: "Nómina", value: 198.56, role: "fijos", bankIban: "ES00" },
  { id: "rv", ent: "revolut", name: "Del día a día", value: 26.46, role: "diario", spendFrom: true, bankIban: "ES01" },
  { id: "ef", ent: "efectivo", name: "El sobre", value: 50, role: "fijos" },
];

test.use({ viewport: { width: 375, height: 812 } });

async function abrirCartera(page) {
  await seedLoggedInDashboard(page, {
    accounts, hasBankLink: true,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut"] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".v4-card-list button.v4-mov").first()).toBeVisible();
}

const fila = (page, nombre) => page.locator(".v4-card-list button.v4-mov").filter({ hasText: nombre }).first();
const ficha = (page) => page.locator(".v4-sheet");

test("tocar una cuenta abre su ficha, y la fila no lleva flecha", async ({ page }) => {
  await abrirCartera(page);

  /* Su petición literal: nada de chevron al lado del número. Si toda la tarjeta se toca, la flecha
     solo mete ruido justo donde va a leer el importe. */
  const flechas = await page.locator(".v4-card-list button.v4-mov").evaluateAll(
    (bs) => bs.filter((b) => /[›>❯]/.test(b.textContent || "")).length,
  );
  expect(flechas, "las filas de cuenta no pueden llevar flecha").toBe(0);

  await fila(page, "Revolut").click();
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page)).toContainText("Revolut");
  await expect(ficha(page)).toContainText("26,46");
});

test("una cuenta CONECTADA enseña el saldo del banco, y no deja escribirlo", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Revolut").click();
  await expect(ficha(page)).toBeVisible();

  await expect(ficha(page).locator("input.num"), "el saldo de una cuenta del banco no se teclea").toHaveCount(0);
  await expect(ficha(page), "y se dice de quién es el número").toContainText(/lo pone el banco|set by the bank|ho posa el banc/i);
});

test("una cuenta TUYA sí deja escribir el saldo", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Efectivo").click();
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page).locator("input.num")).toHaveCount(1);
});

test("cada rol lleva su frase, y sale marcado el que tiene", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Revolut").click();
  await expect(ficha(page)).toBeVisible();

  const ops = ficha(page).locator(".v4-ficha-op");
  await expect(ops).toHaveCount(3);
  /* Lo que se venía haciendo mal: tres chips y la explicación en un `hint` al final de la tarjeta,
     así que había que bajar a buscarla. Cada opción tiene que explicarse sola. */
  for (let i = 0; i < 3; i++) {
    await expect(ops.nth(i).locator(".v4-ficha-od")).not.toBeEmpty();
  }
  await expect(ficha(page).locator(".v4-ficha-op.on")).toHaveCount(1);
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/Gasto diario|Daily spending|Despesa/i);
});

test("cambiar el rol desde la ficha se guarda solo, sin botón de guardar", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Revolut").click();
  await expect(ficha(page)).toBeVisible();

  await ficha(page).locator(".v4-ficha-op").filter({ hasText: /Todo|Everything|Tot/ }).click();
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/Todo|Everything|Tot/);

  // Cerrar tocando fuera y volver a abrir: el rol nuevo tiene que seguir puesto.
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(ficha(page)).toHaveCount(0);
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/Todo|Everything|Tot/);
});

test("quitar la cuenta pregunta antes, y se puede cancelar", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Efectivo").click();
  await expect(ficha(page)).toBeVisible();

  await ficha(page).locator(".v4-ficha-quitar").click();
  await expect(ficha(page)).toContainText(/¿Quitar|Remove this account from|Treure aquest compte del/i);

  // Cancelar la deja donde estaba: nada de borrar por tocar un botón sin querer.
  await ficha(page).getByRole("button", { name: /Cancelar|Cancel·la|Cancel/i }).click();
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(fila(page, "Efectivo")).toHaveCount(1);
});
