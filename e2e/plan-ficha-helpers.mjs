import { expect } from "@playwright/test";

/* Los datos de una deuda (cuota, día, cuotas que quedan…) ya no van en la tarjeta de la lista sino en
   «Datos» de su ficha. Abre la ficha de la fila, despliega Datos, devuelve su texto y cierra. */
export async function datosDeuda(page, row) {
  await row.click();
  const ficha = page.getByTestId("plan-deuda-ficha");
  await expect(ficha).toBeVisible();
  const puerta = ficha.locator(".rpt-door.dat");
  if (await puerta.count()) await puerta.click();
  const texto = await ficha.innerText();
  await ficha.locator(".rpt-sx").click();
  await expect(ficha).toHaveCount(0);
  return texto;
}
