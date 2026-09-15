import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* EL BANCO RECIÉN CONECTADO TIENE QUE SALIR SIN CERRAR Y ABRIR LA PANTALLA.
 *
 * Suyo, desde la app (12/9, 17:09): «si conectas un banco como acabo de hacer con la Caixa, desde
 * la zona de bancos, no te aparece hasta que no tires para atrás y vuelvas a entrar en la zona de
 * bancos».
 *
 * Causa: `BankPanel` carga sus links en un `useEffect(loadLinks, [uid])`, o sea UNA vez al montar.
 * Al volver de autorizar, la pantalla ya estaba montada y seguía enseñando la lista de antes.
 * `runBankSync` avisa ahora al terminar (`mc-bank-links-changed`) y el panel vuelve a leer.
 *
 * El doble cambia cuando se simula la conexión, no por número de consultas: Ajustes también
 * lee los bancos y la antigua espera de Novedades ocultaba esa carrera (15/9). Sin el evento
 * de refresco, el panel conserva la lista anterior aunque el servidor ya tenga Caixa.
 */

const SABADELL = {
  aspsp_name: "Sabadell", aspsp_country: "ES", iban: "ES11", status: "active",
  valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-09-12T09:00:00Z", accounts: [{ uid: "a1" }],
};
const CAIXA = {
  aspsp_name: "CaixaBank", aspsp_country: "ES", iban: "ES22", status: "active",
  valid_until: "2026-12-01T00:00:00Z", last_sync: "2026-09-12T17:00:00Z", accounts: [{ uid: "a2" }],
};

test("un banco conectado sale en la lista sin salir y volver a entrar", async ({ page }) => {
  await seedLoggedInDashboard(page, { __cloudRows: { bank_links: [SABADELL] }, hasBankLink: true });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);

  // La respuesta solo cambia al conectar; una consulta de Ajustes no adelanta el escenario.
  await page.evaluate(([sab, caixa]) => {
    window.__bankConnected = false;
    cloud.bankLinks = function () {
      return Promise.resolve(window.__bankConnected ? [sab, caixa] : [sab]);
    };
  }, [SABADELL, CAIXA]);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const filas = page.locator("[data-aspsp]");
  await expect(filas).toHaveCount(1, { timeout: 10_000 });
  await expect(filas.first()).toBeVisible({ timeout: 10_000 });

  // Lo que hace `runBankSync` al terminar. Sin el arreglo, el panel lo ignora y se queda en 1.
  await page.evaluate(() => {
    window.__bankConnected = true;
    window.dispatchEvent(new CustomEvent("mc-bank-links-changed"));
  });

  await expect(filas, "el banco recién conectado tiene que salir sin cerrar la pantalla").toHaveCount(2, { timeout: 10_000 });
});

/* ⚠ El `removeEventListener` del `useEffect` NO lleva test, y queda escrito por qué: para
   probarlo hay que CERRAR el panel, y en este repo no hay ninguna puerta e2e que lo cierre —
   ningún spec de bancos lo hace, y `Escape` no es el gesto (se cierra por `useBackClose`).
   Escribir un test que «cierra» sin cerrar de verdad sería un verde que miente, que es peor que
   no tenerlo. La limpieza es el `return` estándar del efecto; si algún día hay una puerta para
   cerrar el panel, este es el sitio. */
