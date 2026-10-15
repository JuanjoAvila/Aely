import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard } from "./fixtures.mjs";

/* CERRAR ES ABRIR AL REVÉS, y la animación no se toca mientras va (petición 2026-07-25:
 * «es hacer exactamente lo mismo que cuando se abre pero al cerrarse… que si alguien le da por
 * mantener el dedo mientras se va con la animación, que no se vuelva loco»).
 *
 * Lo que había: abrir y cerrar usaban curvas distintas (÷0,55^0,85 vs ÷0,48^0,88) y umbrales que
 * se diferenciaban casi al doble, así que el mismo dedo daba dos sensaciones. Y un gesto nuevo
 * durante la transición ponía `.dragging` (= `transition:none`), cortando la animación en vuelo:
 * el panel saltaba de donde iba a donde dijera el dedo.
 */
test.use({ viewport: { width: 393, height: 851 }, hasTouch: true });

async function app(page) {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.locator("#mc-load").waitFor({ state: "detached", timeout: 15_000 });
  const dn = page.getByRole("button", { name: /Entendido|Got it/i });
  if (await dn.count()) await dn.first().click();
  return await page.context().newCDPSession(page);
}

const escala = (page) =>
  page.locator(".profile-pull").evaluate((el) => +getComputedStyle(el).transform.split("(")[1].split(",")[0]);

/* El panel se pinta dentro de un `requestAnimationFrame` (uno como mucho por frame, 4.10.0). Si se
   lee la escala nada más despachar el `touchMove`, a veces se lee el frame ANTERIOR y la
   comparación de curvas sale desplazada un paso: falso negativo intermitente que ya tumbó un
   `npm test` entero. Esperar dos frames deja el pintado hecho antes de medir. */
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function arrastrar(cdp, page, y0, pasos, dy) {
  const out = [];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 190, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 190, y: y0 + i * dy }] });
    await frame(page);
    out.push(await escala(page));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return out;
}

test("la curva de cerrar es la misma que la de abrir, en espejo", async ({ page }) => {
  const cdp = await app(page);
  const panel = page.locator(".profile-pull");

  // Abrir: la escala sube desde la miniatura del avatar.
  const abriendo = await arrastrar(cdp, page, 200, 8, 40);
  await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
  await expect(panel).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)", { timeout: 3_000 });
  await page.waitForTimeout(700);

  // Cerrar: el mismo recorrido de dedo tiene que dar el mismo camino, al revés.
  const cerrando = await arrastrar(cdp, page, 200, 8, 40);

  /* Abrir hace `s0 + (1−s0)·r` y cerrar `1 − (1−s0)·r`. Si la `r` (la curva) es la misma en los
     dos, la suma de cada par de pasos vale siempre `1 + s0`, sea cual sea el recorrido del dedo.
     Es la forma de comprobar que comparten curva sin tener que copiar aquí sus constantes. */
  const s0 = await panel.evaluate((el) => parseFloat(el.style.getPropertyValue("--pp-s0")));
  expect(s0).toBeGreaterThan(0);
  /* Solo los primeros pasos: más adelante el panel ya tiene scroll propio y el gesto de cerrar
     se re-ancla al dedo cuando lo detecta (4.10.0), así que a partir de ahí los dos recorridos
     dejan de ser comparables A PROPÓSITO. Con los primeros basta: cuando las curvas eran
     distintas, la diferencia salía ya en el paso 0 (abrir 0,233 · cerrar 0,891). */
  for (let i = 0; i < 4; i++) {
    const subida = abriendo[i];        // va de s0 → 1
    const bajada = cerrando[i];        // va de 1 → s0
    expect(Math.abs((subida + bajada) - (1 + s0)), `paso ${i}: abrir ${subida.toFixed(3)} · cerrar ${bajada.toFixed(3)} · s0 ${s0.toFixed(3)}`).toBeLessThan(0.02);
  }
  await expect(panel).not.toHaveClass(/open/, { timeout: 3_000 });
});

/* Los DOS fallos con los que rechazó la beta 4.11.0 (veredicto en app_events, 2026-07-26):
 * «al mantener el dedo y deslizar, a la mínima vuelve a la posición inicial con la pantalla del
 * perfil abierta». Eran dos cosas distintas con el mismo síntoma, y ninguna de las dos pruebas de
 * arriba las veía porque las dos arrastran 240-320 px de golpe: mucho más de lo que hace un pulgar
 * y lo bastante rápido como para colar por velocidad. Se prueba DESPACIO y CORTO a propósito. */
async function arrastrarDespacio(cdp, page, y0, pasos, dy, ms) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 190, y: y0 }] });
  for (let i = 1; i <= pasos; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 190, y: y0 + i * dy }] });
    await page.waitForTimeout(ms);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("cerrar despacio 70 px CIERRA (unificar el umbral lo dejó pidiendo casi el doble)", async ({ page }) => {
  const cdp = await app(page);
  const panel = page.locator(".profile-pull");
  await page.locator(".v4-avatar").click();
  await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
  await page.waitForTimeout(700);

  /* 70 px en ~350 ms: por debajo del umbral de VELOCIDAD (0,35 px/ms), así que lo único que
     decide es el recorrido. Con el umbral de cerrar de siempre (0,062 · 851 = 53 px) cierra; con
     el que trajo la 4.11.0 al igualarlo al de abrir (0,11 · 851 = 94 px) rebota a abierto, que es
     justo lo que él veía. */
  await arrastrarDespacio(cdp, page, 200, 7, 10, 50);
  await expect(panel, "70 px de arrastre lento tienen que cerrar el perfil").not.toHaveClass(/open/, { timeout: 3_000 });
});

test("tiro, no llega, y vuelvo a tirar: el segundo intento NO se ignora", async ({ page }) => {
  const cdp = await app(page);
  const panel = page.locator(".profile-pull");
  await page.locator(".v4-avatar").click();
  await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
  await page.waitForTimeout(700);

  /* Un tirón corto que no llega al umbral: el panel rebota a abierto. La 4.11.0 echaba el candado
     también para ese rebote, así que durante 560 ms la app se quedaba sorda — y el segundo intento,
     que es lo que uno hace INMEDIATAMENTE, no llegaba ni a empezar. Cortar un rebote es inofensivo
     (el panel vuelve a donde ya estaba); lo que hay que proteger es el cierre, y de eso se sigue
     encargando el efecto. */
  await arrastrarDespacio(cdp, page, 200, 3, 10, 40);
  await expect(panel, "30 px no deben cerrar").toHaveClass(/open/);

  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel, "el segundo intento, justo después, tiene que cerrar").not.toHaveClass(/open/, { timeout: 3_000 });
});

/* EL CASO QUE NINGUNA PRUEBA MIRABA: el panel SCROLLEADO. Todas empezaban con el perfil arriba
 * del todo, que es justo la situación en la que el gesto siempre funcionó. Con `scrollTop=220` —lo
 * normal, porque el contenido mide ~1.680 px y uno MIRA el perfil antes de cerrarlo— el arrastre
 * hacia abajo solo scrolleaba y al soltar el perfil seguía abierto. Tres rondas de arreglos
 * pasaron por encima de esto (2026-07-26). */
test.describe("con el panel scrolleado", () => {
  /* El perfil ya no mide ~1.680 px (14/10: solo quedan nombre y apodo y apenas hay nada que
     scrollear), pero el gesto sobre un panel scrolleado sigue siendo código vivo. Se le da altura
     con un separador de prueba para que el escenario exista igual que antes. */
  const scrollear = (page, y) => page.locator(".profile-pull").evaluate((el, v) => {
    if (el.scrollHeight < el.clientHeight + v + 400) {
      const s = document.createElement("div"); s.style.height = "1500px"; s.setAttribute("data-test-spacer", "1");
      el.appendChild(s);
    }
    el.scrollTop = v;
  }, y);

  test("arrastrar largo desde el medio: el scroll llega al tope y el cierre toma el relevo", async ({ page }) => {
    const cdp = await app(page);
    const panel = page.locator(".profile-pull");
    await page.locator(".v4-avatar").click();
    await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
    await page.waitForTimeout(700);
    await scrollear(page, 220);

    await arrastrarDespacio(cdp, page, 200, 24, 14, 25);
    await expect(panel, "recogido el scroll, el mismo gesto tiene que seguir cerrando").not.toHaveClass(/open/, { timeout: 3_000 });
  });

  test("agarrar por la franja de arriba cierra aunque quede scroll por recoger", async ({ page }) => {
    const cdp = await app(page);
    const panel = page.locator(".profile-pull");
    await page.locator(".v4-avatar").click();
    await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
    await page.waitForTimeout(700);
    await scrollear(page, 220);

    // La cabecera se va con el scroll, así que el asa es la franja (72 px), no el elemento.
    await arrastrarDespacio(cdp, page, 24, 8, 14, 25);
    await expect(panel, "la franja de arriba es asa: cierra esté como esté el scroll").not.toHaveClass(/open/, { timeout: 3_000 });
  });

  test("un arrastre corto en mitad del panel SCROLLEA, no cierra", async ({ page }) => {
    const cdp = await app(page);
    const panel = page.locator(".profile-pull");
    await page.locator(".v4-avatar").click();
    await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
    await page.waitForTimeout(700);
    await scrollear(page, 220);

    await arrastrarDespacio(cdp, page, 300, 6, 12, 25);
    await expect(panel, "con scroll pendiente, un gesto corto es del scroll").toHaveClass(/open/);
    expect(await panel.evaluate((el) => el.scrollTop), "y tiene que haber scrolleado").toBeLessThan(220);
  });
});

test("reabrir el perfil mientras aún cierra: abre limpio, sin salto a medias", async ({ page }) => {
  // Antes el candado de 500 ms ignoraba el tercer gesto (stopper). Ahora reabrir con el panel
  // ya cerrado cancela la CSS del cierre y engancha de limpio — sin `.dragging` encima de la
  // transition a medias (que era el «vuelve loco» original).
  const cdp = await app(page);
  const panel = page.locator(".profile-pull");

  await page.locator(".v4-avatar").click();
  await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
  await page.waitForTimeout(700);

  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel).not.toHaveClass(/open/, { timeout: 3_000 });
  // SIN esperar al candado: reabrir al momento.
  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel, "reabrir durante/tras el cierre tiene que funcionar").toHaveClass(/open/, { timeout: 3_000 });
  await expect(panel).not.toHaveClass(/dragging/);
});

test("abrir y cerrar al momento: el candado NO deja sorda la app medio segundo", async ({ page }) => {
  // El «stopper» de 560 ms (4.11.0) arreglaba el corte a medias, pero bloqueaba también el
  // cierre justo después de abrir. Ahora el candado se afina: cerrar en caliente SÍ se deja;
  // lo que se sigue bloqueando es un gesto que corte un cierre en vuelo.
  const cdp = await app(page);
  const panel = page.locator(".profile-pull");

  await page.locator(".v4-avatar").click();
  await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
  // Un frame para que React enganche los listeners del panel (useEffect). Muy por debajo
  // de los 500–560 ms del candado viejo — si volviera el stopper, este test falla.
  await page.waitForTimeout(80);
  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel, "cerrar en caliente tras abrir tiene que funcionar").not.toHaveClass(/open/, { timeout: 3_000 });
  await expect(panel).toHaveCSS("visibility", "hidden", { timeout: 3_000 });
});

/* Abrir → cerrar → abrir OTRA VEZ al momento (feedback 4.12.1). El cierre ponía profBusy 500 ms
 * y el tercer gesto se tragaba: hacía falta el segundo swipe. Abrir con el panel ya cerrado
 * ignora el candado. */
test("abrir, cerrar y volver a abrir al momento: sin stopper", async ({ page }) => {
  const cdp = await app(page);
  const panel = page.locator(".profile-pull");

  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel).toHaveClass(/open/, { timeout: 3_000 });
  await page.waitForTimeout(80);
  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel).not.toHaveClass(/open/, { timeout: 3_000 });
  // SIN esperar a que acabe el candado de 500 ms.
  await arrastrar(cdp, page, 200, 6, 45);
  await expect(panel, "el tercer gesto tiene que abrir otra vez").toHaveClass(/open/, { timeout: 3_000 });
});
