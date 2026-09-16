/* El rebote de abajo es el rubber-band NATIVO de Android. La barra de la app no debe intentar
 * ayudar: si estaba visible sigue visible; si se ocultó leyendo, sigue oculta. Solo una subida
 * real de contenido puede enseñarla. El WebView necesita además touch-action/overscroll en auto. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

function historico(n) {
  const out = [];
  const ahora = Date.now();
  for (let i = 0; i < n; i++) {
    out.push({ id: "x" + i, date: new Date(ahora - i * 3600_000 * 5).toISOString(),
      amount: (i % 7) + 1.5, merchant: ["Mercadona", "Bar Paco", "Repsol", "Amazon", "Bizum a Ana"][i % 5],
      category: ["super", "bares", "transporte", "compras", "otros"][i % 5], source: "manual" });
  }
  return out;
}

async function appLista(page) {
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

async function scrollear(page, scrollTop) {
  await page.evaluate((st) => {
    const idx = Array.from(document.querySelectorAll(".botnav-tab")).findIndex((b) => b.classList.contains("active"));
    const live = document.querySelector(".page.page-scroll-host") || document.querySelectorAll(".page")[idx];
    live.scrollTop = st;
    live.dispatchEvent(new Event("scroll", { bubbles: true }));
    live.dispatchEvent(new Event("scrollend", { bubbles: true }));
  }, scrollTop);
}

const alturaMax = (page) => page.evaluate(() => {
  const idx = Array.from(document.querySelectorAll(".botnav-tab")).findIndex((b) => b.classList.contains("active"));
  const live = document.querySelector(".page.page-scroll-host") || document.querySelectorAll(".page")[idx];
  return live.scrollHeight - live.clientHeight;
});

async function irAlFondo(page) {
  for (let i = 0; i < 12; i++) {
    await scrollear(page, await alturaMax(page));
    await page.waitForTimeout(100);
    const queda = await page.evaluate(() => {
      const h = document.querySelector(".page.page-scroll-host");
      return h ? (h.scrollHeight - h.clientHeight - h.scrollTop) : 9999;
    });
    if (queda <= 2) return;
  }
  throw new Error("la lista incremental no llegó a su fondo real");
}

async function estado(page) {
  return page.evaluate(() => {
    const nav = document.querySelector(".botnav");
    const idx = Array.from(document.querySelectorAll(".botnav-tab")).findIndex((b) => b.classList.contains("active"));
    const live = document.querySelector(".page.page-scroll-host") || document.querySelectorAll(".page")[idx];
    const css = getComputedStyle(live);
    return { hidden: nav.classList.contains("botnav-hidden"), host: live.classList.contains("page-scroll-host"),
      touchAction: css.touchAction, overscrollY: css.overscrollBehaviorY };
  });
}

async function irAGastosConTodo(page) {
  await page.evaluate(() => document.querySelector('.botnav-tab[data-tour="gastos"]').click());
  await expect.poll(() => page.evaluate(() => document.querySelector(".botnav-tab.active")?.getAttribute("data-tour"))).toBe("gastos");
  await page.evaluate(() => {
    const mas = Array.from(document.querySelectorAll(".v4-period-btn")).find((b) => /más|more|més/i.test(b.textContent || ""));
    if (mas) mas.click();
  });
  await page.evaluate(() => {
    const todo = Array.from(document.querySelectorAll(".v4-sheet-row")).find((b) => /^todo$|^all$|^tot$/i.test((b.textContent || "").trim()));
    if (todo) todo.click();
  });
  await expect(page.locator("button.v4-mov").first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => alturaMax(page), { timeout: 15_000 }).toBeGreaterThan(300);
}

test("llegar abajo con la barra visible no la cambia y deja libre la ola nativa", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(200) });
  await page.goto("/");
  await appLista(page);
  await irAGastosConTodo(page);
  await scrollear(page, 0);
  await page.waitForTimeout(400);

  await irAlFondo(page);
  await irAlFondo(page);
  const s = await estado(page);
  const barra = await page.evaluate(() => {
    const nav = document.querySelector(".botnav");
    const fab = document.querySelector(".botnav-fab");
    return { alto:nav.getBoundingClientRect().height, overflow:getComputedStyle(nav).overflow,
      fabAlto:fab.getBoundingClientRect().height };
  });
  expect(s.hidden, "tirar hacia abajo en el borde no puede esconder la barra").toBe(false);
  expect(["auto", "pan-y"], "Android necesita pan-y/auto para dibujar el rubber-band").toContain(s.touchAction);
  expect(s.overscrollY, "contain/none mata la ola nativa").toBe("auto");
  expect(barra.alto, "la zona segura no puede aplastar la barra visible").toBeGreaterThan(68);
  expect(barra.overflow, "el FAB visible debe poder sobresalir por arriba").toBe("visible");
  expect(barra.fabAlto, "el FAB debe conservar su tamaño completo").toBeGreaterThan(50);
});

test("seguir tirando abajo no revela la barra oculta; subir contenido sí", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(200) });
  await page.goto("/");
  await appLista(page);
  await irAGastosConTodo(page);
  await scrollear(page, 0);
  await page.waitForTimeout(1100);

  let max = await alturaMax(page);
  await scrollear(page, Math.round(max * 0.45));
  await expect.poll(async () => (await estado(page)).hidden).toBe(true);

  await irAlFondo(page);
  max = await alturaMax(page);
  await scrollear(page, max - 40); // oscilación típica del rubber-band de Android
  await scrollear(page, max);
  expect((await estado(page)).hidden, "el rebote de abajo no es una subida de contenido").toBe(true);

  /* Una subida REAL necesita dirección de dedo, no solo fabricar un scrollTop menor: justo esa
     diferencia es la que separa la intención de la devolución elástica de Android. */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 187, y: 260 }] });
  for (let i = 1; i <= 14; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 187, y: 260 + i * 18 }] });
    await page.waitForTimeout(12);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await estado(page)).hidden, {
    message: "al subir de verdad, la barra sí vuelve",
  }).toBe(false);
});

test("el rebote grande con el dedo aún empujando abajo no revela la barra", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(200) });
  await page.goto("/");
  await appLista(page);
  await irAGastosConTodo(page);
  await scrollear(page, 0);
  await page.waitForTimeout(500);

  let max = await alturaMax(page);
  await scrollear(page, Math.round(max * 0.45));
  await expect.poll(async () => (await estado(page)).hidden).toBe(true);
  await irAlFondo(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 187, y: 600 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 187, y: 550 }] });
  /* Android llega a devolver más de 160 px de scrollTop durante el stretch. Sin mirar la
     dirección del dedo, ese dy negativo se confundía con subir y sacaba la barra. */
  await page.evaluate(() => {
    const h = document.querySelector(".page.page-scroll-host");
    const m = h.scrollHeight - h.clientHeight;
    h.scrollTop = Math.max(0, m - 220);
    h.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  expect((await estado(page)).hidden, "el stretch no es una orden de mostrar navegación").toBe(true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
});

test("una deriva lateral del pulgar en el borde sigue siendo ola y no abre la barra", async ({ page }) => {
  await seedLoggedInDashboard(page, { expenses: historico(200) });
  await page.goto("/");
  await appLista(page);
  await irAGastosConTodo(page);
  await scrollear(page, 0);
  await page.waitForTimeout(500);

  let max = await alturaMax(page);
  await scrollear(page, Math.round(max * 0.45));
  await expect.poll(async () => (await estado(page)).hidden).toBe(true);
  await irAlFondo(page);

  /* Un pulgar real no baja en una vertical perfecta. Este primer tramo era suficientemente
     horizontal para que el carrusel robara el gesto, llamara a `pinNavVisible` y desmontara el
     host: justo el segundo tirón del vídeo del Oppo. En el borde manda siempre el WebView. */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y: 600 }] });
  expect((await estado(page)).hidden, "apoyar el dedo en el fondo no muestra la barra").toBe(true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 245, y: 590 }] });
  expect((await estado(page)).hidden, "la primera deriva lateral no pertenece al carrusel").toBe(true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 245, y: 540 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  const s = await estado(page);
  expect(s.hidden, "el arco del pulgar no puede resucitar la barra en el fondo").toBe(true);
  expect(s.host, "el arco del pulgar no puede desmontar el host de la ola").toBe(true);
  expect(await page.evaluate(() => document.querySelector(".botnav-tab.active")?.getAttribute("data-tour"))).toBe("gastos");
});
