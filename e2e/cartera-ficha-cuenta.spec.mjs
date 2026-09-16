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
const diasAtras = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d.toISOString();
};
const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const historialReal = () => Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13-i));
  return { day:diaLocal(d), value:1000 + i*7 };
});

test.use({ viewport: { width: 375, height: 812 } });

async function abrirCartera(page, overrides = {}) {
  await seedLoggedInDashboard(page, Object.assign({
    accounts, hasBankLink: true,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut", "efectivo"], dailyOnlyBanks: ["efectivo"] },
  }, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".v4-card-list button.v4-mov").first()).toBeVisible();
}

async function abrirCarteraConCaixaNueva(page) {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "rv", ent: "revolut", name: "Del día a día", value: 80, role: "diario", spendFrom: true }],
    obAccounts: [{ key: "caixa-1", ent: "caixabank", aspsp: "CaixaBank", iban: "ES001", name: "Cuenta corriente", value: 321.45, cur: "EUR" }],
    obLabels: {}, hasBankLink: true,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["revolut"] },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('button.v4-mov[data-ob-key="caixa-1"]')).toBeVisible();
}

const fila = (page, nombre) => page.locator(".v4-card-list button.v4-mov").filter({ hasText: nombre }).first();
const ficha = (page) => page.locator(".v4-sheet");

test("el Efectivo enseña «Gasto diario», no «Recibos»", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Efectivo").click();
  await expect(ficha(page)).toBeVisible();
  // Hotfix 13/9: solo una opción, y es gasto diario (no recibos domiciliados).
  await expect(ficha(page).locator(".v4-ficha-op")).toHaveCount(1);
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/día a día|day to day|dia a dia/i);
  await expect(ficha(page)).not.toContainText(/^Recibos$|^Bills$|^Rebuts$/m);
});

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

test("la cabecera piensa primero en el nombre y permite renombrar al vuelo", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-account-title")).toHaveText("Del día a día");
  await expect(ficha(page).locator(".v4-account-sub")).toContainText(/Revolut/);

  await ficha(page).getByRole("button", { name: /Renombrar|Rename|Reanomenar/i }).click();
  await ficha(page).locator(".v4-account-name").fill("Compras y ocio");
  await expect(ficha(page).locator(".v4-account-title")).toHaveText("Compras y ocio");
  await expect.poll(() => page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
    return (s.accounts||[]).find((a)=>a.id==="rv")?.name;
  })).toBe("Compras y ocio");
});

test("el saldo enseña fin de mes y no inventa gráfico sin movimientos", async ({ page }) => {
  await abrirCartera(page, { expenses: [] });
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-account-balance")).toContainText(/a fin de mes:|end of month:|a final de mes:/i);
  await expect(ficha(page).locator(".v4-account-spark")).toHaveCount(0);
  await expect(ficha(page).locator(".v4-account-spark-new")).toContainText(/histórico empieza hoy|history starts today|històric comença avui/i);
});

test("no atribuye la previsión conjunta a una cuenta si el banco tiene dos", async ({ page }) => {
  await abrirCartera(page, { accounts:accounts.concat([
    { id:"rv2", ent:"revolut", name:"Ahorro Revolut", value:900, role:"fijos", bankIban:"ES02" },
  ]) });
  await fila(page, "Del día a día").click();
  await expect(ficha(page).locator(".v4-account-balance")).not.toContainText(/a fin de mes:|end of month:|a final de mes:/i);
});

test("solo enseña variación mensual cuando existe un cierre real del día uno", async ({ page }) => {
  const first=new Date(); first.setDate(1);
  const today=new Date();
  await abrirCartera(page, { accountBalanceHistory:{ "acc:rv":[
    { day:diaLocal(first), value:10 }, { day:diaLocal(today), value:26.46 },
  ] } });
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-account-delta")).toContainText(/16,46|16\.46/);
});

test("una cuenta conectada avisa si su saldo lleva más de 48 horas sin actualizarse", async ({ page }) => {
  await abrirCartera(page, { accounts:accounts.map((a)=>a.id==="rv"
    ? Object.assign({},a,{lastSync:diasAtras(3)}) : a) });
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-account-stale")).toBeVisible();
  await expect(ficha(page).locator(".v4-account-stale")).not.toBeEmpty();
});

test("con cierres diarios reales pinta 14 días y solo los tres últimos movimientos de esa cuenta", async ({ page }) => {
  const expenses = [
    { id:"r1", ent:"revolut", date:diasAtras(0), merchant:"Café", amount:3.2, category:"bares", source:"ob:revolut" },
    { id:"r2", ent:"revolut", date:diasAtras(1), merchant:"Nómina extra", amount:-120, category:"ingreso", source:"ob:revolut" },
    { id:"r3", ent:"revolut", date:diasAtras(3), merchant:"Supermercado", amount:42, category:"super", source:"ob:revolut" },
    { id:"r4", ent:"revolut", date:diasAtras(8), merchant:"Gasolina", amount:55, category:"transporte", source:"ob:revolut" },
    { id:"s1", ent:"sabadell", date:diasAtras(0), merchant:"Alquiler ajeno", amount:700, category:"casa", source:"ob:sabadell" },
  ];
  await abrirCartera(page, { expenses, accountBalanceHistory:{ "acc:rv":historialReal() } });
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-account-spark i")).toHaveCount(14);
  await expect(ficha(page).locator(".v4-account-mov")).toHaveCount(3);
  await expect(ficha(page).locator(".v4-account-latest")).toContainText("Café");
  await expect(ficha(page).locator(".v4-account-latest")).toContainText("Nómina extra");
  await expect(ficha(page).locator(".v4-account-latest")).not.toContainText("Gasolina");

  await ficha(page).getByRole("button", { name: /Ver todo|See all|Veure-ho tot/i }).click();
  await expect(page.locator('.botnav-tab.active[data-tour="gastos"]')).toBeVisible();
  await expect(page.locator('[data-expense-id="r4"]')).toBeVisible();
  await expect(page.locator('[data-expense-id="s1"]')).toHaveCount(0);
});

test("un banco con permiso caducado ofrece reconectar dentro de su ficha", async ({ page }) => {
  await abrirCartera(page, { bankIssues:[{ aspsp:"Revolut", ent:"revolut", kind:"expired" }] });
  await fila(page, "Revolut").click();
  await expect(ficha(page).getByRole("button", { name: /Reconectar|Reconnect/i })).toBeVisible();
});

test("una cuenta CONECTADA enseña el saldo del banco, y no deja escribirlo", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Revolut").click();
  await expect(ficha(page)).toBeVisible();

  await expect(ficha(page).locator("input.num"), "el saldo de una cuenta del banco no se teclea").toHaveCount(0);
  await expect(ficha(page), "y se dice de quién es el número").toContainText(/lo pone el banco|set by the bank|ho posa el banc/i);
  await expect(ficha(page).getByRole("button", { name: /Sincronizar ahora|Sync now|Sincronitzar ara/i })).toBeVisible();
});

test("una CaixaBank recién conectada abre la misma ficha, se renombra y solo toma rol al elegirlo", async ({ page }) => {
  await abrirCarteraConCaixaNueva(page);
  const caixa = page.locator('button.v4-mov[data-ob-key="caixa-1"]');
  await caixa.click();
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page)).toContainText(/CaixaBank/);
  await expect(ficha(page)).toContainText("321,45");
  await expect(ficha(page).locator("input.num"), "el saldo puro del banco no se edita").toHaveCount(0);
  await expect(ficha(page).locator(".v4-ficha-op.on"), "no se inventa un rol al conectar").toHaveCount(0);
  await expect(ficha(page).locator(".v4-ficha-quitar"), "se desconecta desde Bancos, no borrando la fila").toHaveCount(0);

  await ficha(page).getByRole("button", { name: /Renombrar|Rename|Reanomenar/i }).click();
  const nombre = ficha(page).locator("input.v4-account-name");
  await nombre.fill("Cuenta Caixa");
  await expect.poll(() => page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
    return s.obLabels&&s.obLabels["caixa-1"];
  })).toBe("Cuenta Caixa");

  await ficha(page).locator(".v4-ficha-op").filter({ hasText: /recibos|bills|rebuts/i }).first().click();
  await expect.poll(() => page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
    const a=(s.accounts||[]).find((x)=>x.ent==="caixabank");
    return { role:a&&a.role, orderKey:a&&a.accountOrderKey, ob:(s.obAccounts||[]).length };
  })).toEqual({ role:"fijos", orderKey:"ob:caixa-1", ob:0 });
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/recibos|bills|rebuts/i);
});

test("una cuenta TUYA corrige el saldo con el teclado de la app", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Efectivo").click();
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page).locator("input.num")).toHaveCount(0);
  await ficha(page).getByRole("button", { name: /Corregir saldo|Fix balance/i }).click();
  await expect(ficha(page).locator(".v4-keys")).toBeVisible();
});

test("Corregir saldo empieza limpio aunque el saldo guardado tenga un float largo", async ({ page }) => {
  await abrirCartera(page, { expenses:[], accounts:accounts.map((a)=>a.id==="ef"
    ? Object.assign({},a,{value:5585.049999999999}) : a) });
  await fila(page, "Efectivo").click();
  await ficha(page).getByRole("button", { name: /Corregir saldo|Fix balance/i }).click();
  await expect(ficha(page).locator(".v4-account-correct-amount")).toHaveText("—");
  for(const n of ["1","2","3","4"]){
    await ficha(page).locator(".v4-keys button").filter({ hasText:new RegExp("^"+n+"$") }).click();
  }
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await fila(page, "Efectivo").click();
  await expect(ficha(page).locator(".v4-account-amount")).toContainText(/1234[.,]00/);
});

/* Rechazo 4.19.67 paso 5 (2026-09-12): *«si solo pones un número… y lo quitas… no se guarda;
   solo si le das a la flechita del teclado»*. El commit colgaba del blur; al cerrar la ficha
   ahora se vuelca el saldo (ver `cerrar` en AccountSheet). Flujo: teclear, tocar fuera SIN
   pasar al nombre, reabrir — tiene que seguir el número nuevo. */
test("el saldo negativo del Efectivo se guarda al cerrar la ficha desde NumPad", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Efectivo").click();
  await expect(ficha(page)).toBeVisible();

  await ficha(page).getByRole("button", { name: /Corregir saldo|Fix balance/i }).click();
  const borrar=ficha(page).locator('.v4-keys button[aria-label="Borrar"]');
  await borrar.dispatchEvent("pointerdown", { button: 0 }); await borrar.dispatchEvent("pointerup");
  await borrar.dispatchEvent("pointerdown", { button: 0 }); await borrar.dispatchEvent("pointerup");
  await ficha(page).getByRole("button", { name: /Cambiar signo|Change sign|Canviar el signe/i }).click();
  await ficha(page).locator('.v4-keys button').filter({ hasText: /^8$/ }).click();
  await ficha(page).locator('.v4-keys button').filter({ hasText: /^8$/ }).click();
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(ficha(page)).toHaveCount(0);

  await fila(page, "Efectivo").click();
  await expect(ficha(page).locator(".v4-account-amount")).toContainText("-88");
  await expect.poll(() => page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem("micartera_v3")||"{}");
    return (s.accounts||[]).find((a)=>a.id==="ef")?.value;
  })).toBe(-88);
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
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/día a día|day to day|dia a dia/i);
});

test("cambiar el rol desde la ficha se guarda solo, sin botón de guardar", async ({ page }) => {
  await abrirCartera(page);
  await fila(page, "Revolut").click();
  await expect(ficha(page)).toBeVisible();

  await ficha(page).locator(".v4-ficha-op").filter({ hasText: /Las dos cosas|Both|Les dues coses/i }).click();
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/Las dos cosas|Both|Les dues coses/i);

  // Cerrar tocando fuera y volver a abrir: el rol nuevo tiene que seguir puesto.
  await page.locator(".v4-sheet-back").click({ position: { x: 10, y: 10 } });
  await expect(ficha(page)).toHaveCount(0);
  await fila(page, "Revolut").click();
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText(/Las dos cosas|Both|Les dues coses/i);
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
