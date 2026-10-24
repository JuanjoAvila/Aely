import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, installFixtureClock, gastosSeccion } from "./fixtures.mjs";

const names = ["Servicio sintético de contenidos familiares con nombre muy largo", "SuscripcionSinteticaSinEspaciosConNombreExtraordinariamenteLargo"];
const expenses = names.flatMap((merchant, i) => [7, 8, 9].map(month => ({
  id: "sub-" + i + "-" + month, date: "2026-0" + month + "-15T12:00:00Z",
  merchant, amount: i ? 19.99 : 12345.67, category: "otros", source: "manual", ent: "sabadell",
})));

// Medir el DOM pintado: visible para Playwright no basta cuando otro control tapa el botón.
// `cajas`: lo que se mide (tarjetas de la bandeja o la ficha); dentro, nombre, importe y botones.
async function geometry(cajas) {
  return cajas.evaluateAll(els => els.map(row => {
    const rect = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
    const rr = rect(row), amount = rect(row.querySelector(".gx-sub-am"));
    const issues = [];
    if (rr.left < 0 || rr.right > innerWidth + 1) issues.push("caja fuera del viewport");
    const nm = rect(row.querySelector(".gx-sub-nm,.gx-subf-nm"));
    if (nm.right > amount.left + 1) issues.push("el nombre pisa el importe");
    if (amount.right > rr.right + 1) issues.push("importe recortado");
    const buttons = [...row.querySelectorAll("button")].map(button => {
      const r = rect(button), issues = [];
      if (r.left < rr.left - 1 || r.right > rr.right + 1 || r.left < 0 || r.right > innerWidth) issues.push("fuera de fila/viewport");
      if (r.left < amount.right && r.right > amount.left && r.top < amount.bottom && r.bottom > amount.top) issues.push("solapa importe");
      for (let parent = button.parentElement; parent; parent = parent.parentElement) {
        const s = getComputedStyle(parent), p = rect(parent);
        if (/(hidden|clip|auto|scroll)/.test(s.overflowX) && (r.left < p.left - 1 || r.right > p.right + 1)) issues.push("recorte horizontal");
        if (/(hidden|clip|auto|scroll)/.test(s.overflowY) && (r.top < p.top - 1 || r.bottom > p.bottom + 1)) issues.push("recorte vertical");
      }
      const range = document.createRange(); range.selectNodeContents(button);
      const text = range.getBoundingClientRect();
      if (text.left < r.left - 1 || text.right > r.right + 1 || text.top < r.top - 1 || text.bottom > r.bottom + 1) issues.push("texto fuera de boton");
      const hit = document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
      if (!hit || !button.contains(hit)) issues.push("centro tapado");
      return {text:button.textContent,rect:r,issues};
    });
    return {name:row.querySelector(".gx-sub-nm,.gx-subf-nm").textContent,row:rr,amount,issues,buttons};
  }));
}

for (const [width, lang] of [[320,"es"],[360,"en"],[390,"ca"],[414,"es"]]) {
  test("suscripciones completas y acciones conservadas " + width + " " + lang, async ({page}, info) => {
    await page.setViewportSize({width,height:1100});
    await installFixtureClock(page);
    await page.route(/https?:\/\//, route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await seedLoggedInDashboard(page,{expenses,settings:{autoPrices:false,theme:"green",lang}});
    await page.goto("/");
    await expect(page.locator(".botnav")).toBeVisible();
    await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    // Gastos v5 (tanda 4): la bandeja enseña una tarjeta por suscripción y las acciones van en su ficha.
    await gastosSeccion(page, "subs");
    const rows = page.locator(".gx-sub");
    await expect(rows).toHaveCount(2);
    await rows.first().scrollIntoViewIfNeeded();
    const measured = await geometry(rows);
    const ficha = page.locator('[data-sheet="sub-ficha"]');
    await rows.first().click();
    await expect(ficha).toBeVisible();
    await page.waitForTimeout(400);   // la hoja sube con animación: medir con ella quieta
    const medidaFicha = await geometry(ficha);
    await info.attach("geometria",{body:JSON.stringify({width,lang,measured,medidaFicha},null,2),contentType:"application/json"});
    await page.screenshot({path:info.outputPath("suscripciones.png")});
    expect(measured.flatMap(r => r.issues), "tarjetas sin recorte ni solapamiento").toEqual([]);
    expect(medidaFicha.flatMap(r => r.issues.concat(r.buttons.flatMap(b => b.issues))), "ficha: botones sin recorte ni solapamiento").toEqual([]);
    expect(medidaFicha[0].buttons.length, "las tres acciones").toBe(3);

    // Ejercitar las acciones y comprobar lo guardado, incluido el importe editado.
    await ficha.getByTestId("sub-importe").fill("123,45");
    await ficha.locator('[data-sub-accion="recibos"]').click();
    await expect(rows).toHaveCount(1);
    await expect(ficha).toHaveCount(0);
    await rows.first().click();
    await ficha.locator('[data-sub-accion="no"]').click();
    await page.locator(".askback .btn-primary").click();
    await expect(rows).toHaveCount(0);
    // El guardado está diferido: la desaparición de la fila confirma React, aún no el disco.
    await expect.poll(() => page.evaluate(() => {
      const s = mcLoadRaw(mcStateKey()); return [s.fixed.length,(s.subsDismissed||[]).length];
    })).toEqual([1,1]);
    const saved = await page.evaluate(() => mcLoadRaw(mcStateKey()));
    expect(saved.fixed).toHaveLength(1);
    expect(saved.fixed[0]).toMatchObject({name:names[0],amount:123.45,freq:"mes",account:"sabadell",day:15});
    expect(saved.subsDismissed).toHaveLength(1);
    expect(saved.expenses).toHaveLength(6);
  });
}
