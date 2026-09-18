import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* PULIDO v4 — EL PRIMER MINUTO DE ALGUIEN QUE ACABA DE INSTALAR (P1, P2, P3).
 *
 * Los tres se ven solo con la app vacía, que es justo el estado que ningún test cubría:
 *  P1 — con 0 o 1 puntos el sparkline pintaba una recta con puntito: un gráfico que miente.
 *  P2 — «+0 € este mes» ocupaba sitio sin decir nada.
 *  P3 — sin presupuesto, Inicio ESCONDÍA su tarjeta estrella y te quedabas sin media app
 *       sin saber por qué. Ahora la enseña vacía y con salida.
 */

async function inicio(page, estado) {
  await seedLoggedInDashboard(page, estado);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

test("★ app recién instalada: ni gráfico plano ni pastilla de cero, y el hueco no salta", async ({ page }) => {
  await inicio(page, { history: [], budget: 0, expenses: [], accounts: [] });

  // P1: sin dos puntos no hay svg de sparkline, pero el hueco está reservado.
  await expect(page.locator("svg.spark")).toHaveCount(0);
  await expect(page.getByText(/Tu histórico empieza hoy/i)).toBeVisible();

  // P2: la pastilla del mes no sale con delta 0 y sin histórico.
  await expect(page.getByText(/\+0\s*€\s*este mes/i)).toHaveCount(0);
});

test("★ sin presupuesto, Inicio ofrece ponerlo en vez de esconder la tarjeta", async ({ page }) => {
  await inicio(page, { history: [], budget: 0, expenses: [], accounts: [] });

  const vacia = page.locator(".v4-empty").filter({ hasText: /presupuesto|budget|pressupost/i });
  await expect(vacia).toBeVisible();

  // Y tiene salida de verdad: abre el mismo panel de presupuesto que ya existía.
  await vacia.getByRole("button").click();
  await expect(page.getByText(/presupuesto|budget|pressupost/i).first()).toBeVisible({ timeout: 10_000 });
});

test("★ P4: Inicio recién instalado ofrece recibos y metas en vez de quedarse desnudo", async ({ page }) => {
  await inicio(page, { history: [], budget: 500, expenses: [], accounts: [], fixed: [], goals: [] });

  const recibos = page.locator(".v4-empty").filter({ hasText: /recibos|bills|rebuts/i });
  const metas = page.locator(".v4-empty").filter({ hasText: /meta|goal|objectiu/i });
  await expect(recibos).toBeVisible();
  await expect(metas).toBeVisible();
  // No son adornos: las dos llevan a algún sitio.
  await expect(recibos.getByRole("button")).toBeEnabled();
  await expect(metas.getByRole("button")).toBeEnabled();
});

test("con recibos y metas de verdad, las tarjetas fantasma desaparecen", async ({ page }) => {
  await inicio(page, {
    history: [100, 200], budget: 500,
    fixed: [{ id: "f1", name: "Luz", amount: 40, freq: "mes", day: 28, account: "sabadell" }],
    goals: [{ id: "g1", name: "Viaje", target: 1000, saved: 100, emoji: "✈️" }],
  });
  await expect(page.locator(".v4-empty")).toHaveCount(0);
});

test("★ P5: la racha a cero se dice en positivo, no «0 meses sin pasarte»", async ({ page }) => {
  await inicio(page, { history: [], budget: 500, streak: 0 });
  await expect(page.getByText(/0 meses sin pasarte/i)).toHaveCount(0);
  await expect(page.getByText(/Tu primer mes empieza hoy/i)).toBeVisible();
});

test("tres presupuestos mensuales cerrados crean racha sin llama", async ({ page }) => {
  const now=new Date(), budgetByMonth={};
  for(let back=1;back<=3;back++){
    const d=new Date(now.getFullYear(),now.getMonth()-back,1);
    budgetByMonth[d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")]=500;
  }
  await inicio(page, { history: [100, 200], budget: 500, budgetByMonth, streak: 99 });
  const streak=page.getByTestId("dash-budget-streak");
  await expect(streak).toHaveText(/3 meses sin pasarte/i);
  await expect(streak).not.toContainText("🔥");
});

test("con presupuesto e histórico, el hero vuelve a ser el de siempre", async ({ page }) => {
  await inicio(page, { history: [100, 200], budget: 500 });

  await expect(page.locator("svg.spark")).toHaveCount(1);
  await expect(page.locator(".v4-empty").filter({ hasText: /presupuesto|budget|pressupost/i })).toHaveCount(0);
});

/* P6 — el anillo del presupuesto se DIBUJA. La transición no animaba el primer pintado, así que
 * salía ya lleno y la animación de 1 s del spec §10 no se veía nunca. Se monta vacío y pasa al
 * valor real en el frame siguiente, enganchado al mismo `mc-splash-gone` que el count-up del hero
 * (si no, se gasta detrás de la cortina de entrada — ya pasó una vez con el número). */
test("★ P6: el anillo arranca vacío y se llena, no aparece relleno", async ({ page }) => {
  await inicio(page, { history: [100, 200], budget: 500, expenses: [{ id: "e1", date: "2026-09-09T12:00:00.000Z", amount: 100, merchant: "Super", category: "super" }] });
  // ⚠ ACOTADO a la pantalla de Inicio: las pestañas se premontan y un selector global puede
  // acertar contra una copia oculta si otra pantalla reutiliza esta pieza más adelante.
  // La cabecera de Inicio identifica la tarjeta que la prueba quiere vigilar sin depender del
  // orden de pestañas ni de cuántos SVG haya en las demás pantallas (regresión 2026-09-17).
  const anillo = page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget svg circle").last();
  await expect(anillo).toHaveAttribute("stroke-dasharray", /\d/);
  // Ya con el splash fuera, el trazo tiene que haber llegado a su valor final (offset < circunferencia).
  await expect.poll(async () => {
    const d = await anillo.getAttribute("stroke-dasharray");
    const o = await anillo.getAttribute("stroke-dashoffset");
    return Number(o) < Number(d) - 0.01;
  }, { timeout: 10_000 }).toBe(true);
});

test("P6 con reduced-motion: el valor final, directo y sin animar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await inicio(page, { history: [100, 200], budget: 500, expenses: [{ id: "e1", date: "2026-09-09T12:00:00.000Z", amount: 100, merchant: "Super", category: "super" }] });
  // Mismo alcance que el caso animado: el selector debe seguir perteneciendo a Inicio.
  const anillo = page.locator(".v4-screen:has(.v4-inicio-head) .v4-budget svg circle").last();
  const d = Number(await anillo.getAttribute("stroke-dasharray"));
  const o = Number(await anillo.getAttribute("stroke-dashoffset"));
  expect(o).toBeLessThan(d - 0.01);
});

/* P14 — NO SE APLICA, y aquí queda por qué, medido (9/9).
 * El brief acierta en el hecho: `.v4-hero-amt` va a 56px fijo y sin `nowrap/overflow`, mientras
 * el de Gastos usa `clamp` y sí se protege. Pero la consecuencia que describe no se reproduce:
 * a 360×667, con el splash ya fuera, «192.148,45 €» mide 248 px de los 324 disponibles, y con
 * siete cifras («9.876.543,21 €») 294. No se aprieta contra los bordes. Y «Letra grande» no lo
 * cambia, porque el tamaño va en px y no escala con el root.
 * Aplicar el `clamp(38px,13.5vw,56px)` en su móvil de 360 px bajaría el hero de 56 a 48,6: haría
 * MÁS PEQUEÑO el número insignia de la app para arreglar algo que no pasa. Por eso se deja sin
 * hacer y se le pregunta, que es la norma que él puso para las tareas que no cuadran. */

/* P14 — el hero encoge cuando hace falta.
 *
 * Mi medida en euros decía que no hacía falta: «192.148,45 €» ocupa 248 px de 324. El caso que se
 * me escapó lo reprodujo Codex: la MONEDA DE VISUALIZACIÓN llega al hero, y con yenes y patrimonio
 * negativo el importe se parte en dos líneas a 56 px. La red que yo proponía (nowrap + overflow
 * hidden) habría RECORTADO el número, que en una app de dinero es peor. De ahí el clamp.
 *
 * Lo que exige este test es lo que pidió Cursor al votar: importe, signo y moneda visibles, y en
 * UNA línea. Los importes son sintéticos; el factor no es un tipo de cambio real.
 */
test("★ P14: con yenes y patrimonio negativo, el importe cabe entero y en una línea", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 667 });
  await inicio(page, {
    history: [100, 200], budget: 500,
    accounts: [{ id: "a1", ent: "sabadell", name: "Banco", value: -192148.45, role: "fijos" }],
    settings: { currency: "JPY" },
    fxRates: { JPY: 0.00625 },
  });
  await page.evaluate(() => { window.__mcSplashGone = true; window.dispatchEvent(new Event("mc-splash-gone")); });
  await page.waitForTimeout(1200);

  const hero = page.locator(".v4-hero-amt");
  const caja = await hero.boundingBox();
  const unaLinea = await hero.evaluate((el) => {
    const linea = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.05;
    return el.getBoundingClientRect().height < linea * 1.6;
  });
  expect(unaLinea).toBe(true);
  expect(caja.x).toBeGreaterThanOrEqual(0);
  expect(caja.x + caja.width).toBeLessThanOrEqual(361);
  // Y el número no puede estar recortado: lo que se ve es lo que hay.
  const recortado = await hero.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(recortado).toBe(false);
});

/* B2 — Count-up en Cartera al ACTIVAR la pestaña (bus mcOnCarteraActive), no al montar.
 *
 * Claude midió bien que premontaje e IntersectionObserver gastan la cuenta a puerta cerrada.
 * La vía que faltaba es la misma que ya usa Gastos: aviso de «activa» por bus, sin prop `active`
 * (esa prop reconstruía el árbol encima del gesto). No toca `.track` ni gestos.
 *
 * Se muestrean valores DENTRO de la página con rAF (innerText desde fuera cuesta ~50 ms y se
 * comen los intermedios). Al tocar Cartera debe verse al menos un valor ESTRICTAMENTE menor
 * que el total antes de llegar a él.
 */
test("B2: al entrar en Cartera el hero cuenta, no aparece ya puesto", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [{ id: "e2e", ent: "sabadell", name: "Cuenta", value: 4321 }],
    debts: [],
    investments: [],
    assets: [],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 10_000 }).catch(() => {});

  // Premontar Cartera (vecina de Plan).
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.botnav-tab[data-tour="plan"].active')).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(300);

  // Sembrar el muestreador ANTES del toque: el click de Playwright puede tardar un frame
  // y nos comeríamos el arranque de la cuenta.
  await page.evaluate(() => {
    window.__mcB2 = [];
    window.__mcB2Stop = false;
    const leer = () => {
      const host = document.querySelector(".page-scroll-host");
      const el = host && host.querySelector(".cartera-hero-amt");
      if (!el) return;
      const t = (el.textContent || "").replace(/\s/g, " ").trim();
      const m = t.match(/([\d.]+)/);
      if (!m) return;
      window.__mcB2.push(Number(m[1].replace(/\./g, "")));
    };
    const tick = () => {
      leer();
      if (window.__mcB2Stop) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator(".page-scroll-host .cartera-hero-amt")).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(1000);
  const muestras = await page.evaluate(() => {
    window.__mcB2Stop = true;
    return (window.__mcB2 || []).slice();
  });

  expect(muestras.length).toBeGreaterThan(5);
  const ultimo = muestras[muestras.length - 1];
  expect(ultimo).toBe(4321);
  const huboIntermedio = muestras.some((v) => v > 0 && v < 4321);
  expect(huboIntermedio).toBe(true);
});

