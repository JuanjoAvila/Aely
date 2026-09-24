/* «TUS RECIBOS»: GESTIONAR DEJA DE SER LA APP VIEJA DENTRO DE UN CAJÓN (v4.1 §2, variante A).
 *
 * Antes, «Gestionar» abría un sheet que montaba `<Fijos>` entero: seis cartillas, formularios
 * abiertos, simulador y conciliación, todo dentro de `.v4-embed-legacy`. Lo que se veía al tocar
 * era la app de antes, y además era el punto lento de Plan. Ahora es una pantalla hija con cuatro
 * grupos en los que se ENTRA.
 *
 * Lo que vigilan estas pruebas es sobre todo lo que se podía PERDER al quitar `<Fijos>`:
 *   · la comparación con el banco (solo vivía ahí) → ahora en Ajustes › Mis bancos;
 *   · recibos con importe distinto por mes (`schedule`) y con meses concretos (`months`), y el
 *     «primer/último día hábil» (`when`) de lo que entra — tocar el nombre no puede aplanar nada;
 *   · el cargo de una sola vez, que va por mes y año, no por periodicidad;
 *   · las cuotas en modo sencillo, donde Deudas no existe y «se cambian en Deudas» no lleva a nada.
 *
 * Selectores: los del núcleo de Cursor (`487864ad`): `[data-bills-manage]`, `.v4-bills-*`. Los
 * grupos y las filas se buscan por su TEXTO dentro de su contenedor, que es lo que ve él. */
import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

const hoy = new Date();
const mesActual = hoy.getMonth() + 1;
const anoActual = hoy.getFullYear();
const ymHoy = `${anoActual}-${String(mesActual).padStart(2, "0")}`;

const accounts = [
  { id: "sab", ent: "sabadell", name: "Nómina y recibos", value: 2000, role: "fijos" },
  { id: "rev", ent: "revolut", name: "Tarjeta", value: 300, role: "diario" },
];
const fixed = [
  { id: "luz", name: "Luz", amount: 50, freq: "mes", account: "sabadell", day: 5 },
  // Importe distinto por mes: si la ficha lo aplana al tocar el nombre, se pierde el de julio.
  { id: "ibi", name: "IBI", amount: 80, freq: "año", account: "sabadell",
    schedule: [{ m: 1, amt: 80 }, { m: 7, amt: 120 }] },
  // Meses que NO son los de por defecto de «bimestral» (1-3-5…): el agua de febrero.
  { id: "agua", name: "Agua", amount: 30, freq: "bimestral", months: [2, 4, 6, 8, 10, 12], account: "sabadell" },
];
const debts = [
  { id: "coche", name: "Préstamo coche", monthly: 100, value: 2400, anchor: 2400, account: "sabadell", day: 10 },
];
// `when` solo existe en lo que entra/se mueve (`flowDay`, 07:858).
const flows = [
  { id: "nomina", name: "Nómina", amount: 1800, kind: "income", to: "sabadell", when: "last" },
];
const oneoffs = [
  { id: "itv", name: "ITV", amount: 45, month: mesActual, year: anoActual, account: "sabadell" },
];
const base = { accounts, fixed, debts, flows, oneoffs, budget: 1000 };

async function appLista(page, overrides = {}) {
  await seedLoggedInDashboard(page, Object.assign({}, base, overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);
}

const hub = (page) => page.locator("[data-bills-manage]");
// Las hijas permanecen encima del hub para que el gesto enseñe su destino; la última es la activa.
const titulo = (page) => hub(page).locator(".settings-push-h h1").last();
const ficha = (page) => page.locator('.v4-sheet[data-sheet="bill"]');
const alta = (page) => page.locator('.v4-sheet[data-sheet="bill-add"]');
const tituloHoja = (sheet) => sheet.locator(".settings-push-h h1");
const grupo = (page, texto) => hub(page).locator(".v4-bills-group").filter({ hasText: texto });
const fila = (page, texto) => hub(page).locator(".v4-bills-row").filter({ hasText: texto });

async function abreTusRecibos(page) {
  const simple = await page.evaluate(() => {
    try { return !!(JSON.parse(localStorage.getItem("micartera_v3") || "{}").settings || {}).simpleMode; } catch (e) { return false; }
  });
  if (simple) {
    // §5bis.2: sin link en Plan — puerta Ajustes › Dinero → Plan + BillsManage vivo
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
    const billsBtn = page.getByRole("button", { name: /Cambiar mis recibos|Change my bills|Canviar els meus rebuts/i });
    await expect(billsBtn).toBeVisible({ timeout: 15_000 });
    await billsBtn.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await billsBtn.evaluate((el) => el.click());
  } else {
    await page.locator('.botnav-tab[data-tour="plan"]').click();
    const nombre = await page.evaluate(() => t("v4_gestionar"));
    await page.locator('.v4-screen > [data-seg="recibos"]').getByRole("button", { name: nombre, exact: true }).click();
  }
  await expect(hub(page)).toBeVisible();
}

const estado = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3") || "{}"));

test("la comparación con el banco sigue viva: ahora está en Mis bancos", async ({ page }) => {
  await appLista(page, {
    hasBankLink: true,
    bankTx: [{ id: "tx1", ent: "sabadell", date: `${ymHoy}-05`, amount: 50, merchant: "ENDESA" }],
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  const rec = page.locator("[data-bank-reconcile]");
  await expect(rec).toContainText("¿Cuadran tus recibos con el banco?");
  await expect(rec).not.toContainText(/concilia|modela|Fijos/i);
});

test("Gestionar abre «Tus recibos», sin la app vieja y sin segunda puerta al banco", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await expect(titulo(page)).toHaveText("Tus recibos");
  await expect(hub(page).locator(".v4-embed-legacy")).toHaveCount(0);
  // Piezas que solo pinta `<Fijos>`: su resumen y su «el que más pesa».
  await expect(page.locator(".liqbox, .culpa")).toHaveCount(0);
  await expect(hub(page).locator(".v4-bills-afford")).toContainText("¿Me lo puedo permitir?");
  // La comparación con el banco vive en Mis bancos: aquí no se duplica.
  await expect(hub(page).locator(".v4-bills-recon")).toHaveCount(0);
  // Precondiciones de la ola nativa de Android: el push es el scroller físico, sin textura
  // transformada ni overscroll bloqueado. Chromium no dibuja la ola; el móvil valida el efecto.
  const scrollCss = await hub(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { overflowY: cs.overflowY, overscrollY: cs.overscrollBehaviorY,
      transform: cs.transform, touchAction: cs.touchAction,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  });
  expect(scrollCss.overflowY).toBe("auto");
  expect(scrollCss.overscrollY).toBe("auto");
  expect(scrollCss.transform).toBe("none");
  expect(scrollCss.touchAction).toBe("auto");
  expect(scrollCss.scrollHeight).toBeGreaterThan(scrollCss.clientHeight);
});

test("cuatro grupos con su cuenta, y el de una sola vez no dice «al mes»", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await expect(hub(page).locator(".v4-bills-group")).toHaveCount(4);
  await expect(grupo(page, "Servicios y suministros")).toContainText("3 recibos");
  await expect(grupo(page, "Cuotas de deuda")).toContainText(/1 cuota/);
  await expect(grupo(page, "Lo que entra y lo que mueves")).toBeVisible();
  const once = grupo(page, "Cargos de una sola vez");
  await expect(once).toContainText("este mes");
  await expect(once).not.toContainText("al mes");
  await expect(hub(page).locator(".v4-bills-hero-amt")).toHaveText(/\d/);
  // La ola solo reparte la cifra que sale cada mes: servicios y cuotas, no ingresos ni puntuales.
  await expect(hub(page).locator(".v4-bills-hero-bar i")).toHaveCount(2);
});

test("cada recibo lleva un icono de lo que es, no el logo del banco", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await expect(fila(page, "Luz").locator('[data-bill-icon="⚡"]')).toHaveCount(1);
  await expect(fila(page, "Agua").locator('[data-bill-icon="💧"]')).toHaveCount(1);
  await expect(hub(page).locator(".v4-bills-row .mono-logo img")).toHaveCount(0);
});

test("la cifra y la ola vuelven a empezar cada vez que se abre Gestionar", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  const amount=hub(page).locator(".v4-bills-hero-amt");
  const wave=hub(page).locator(".v4-bills-hero-bar i").first();
  await expect(wave).toHaveCSS("animation-name","v4bar");
  await wave.evaluate((el) => { window.__billsWaveNode=el; });
  await expect.poll(async()=>Number((await amount.innerText()).replace(/[^0-9]/g,""))).toBeGreaterThan(0);
  await page.waitForTimeout(1100);
  const finalText=await amount.innerText();
  await hub(page).locator(".settings-push-h .back").click();
  await expect(hub(page)).toHaveCount(0);

  await abreTusRecibos(page);
  const first=Number((await hub(page).locator(".v4-bills-hero-amt").innerText()).replace(/[^0-9]/g,""));
  const target=Number(finalText.replace(/[^0-9]/g,""));
  expect(first).toBeLessThan(target);
  expect(await hub(page).locator(".v4-bills-hero-bar i").first().evaluate((el) => el!==window.__billsWaveNode)).toBe(true);
  await expect.poll(async()=>await hub(page).locator(".v4-bills-hero-amt").innerText(),{timeout:2500}).toBe(finalText);
});

test("los importes mensuales largos caben y siguen sin subrayado", async ({ page }) => {
  await page.setViewportSize({width:360,height:740});
  await appLista(page,{settings:{season:"otono"},fixed:[{id:"alto",name:"Recibo extraordinario",amount:1234567.89,freq:"mes",account:"sabadell"}],debts:[],flows:[],oneoffs:[]});
  await abreTusRecibos(page);
  const amount=grupo(page,"Servicios y suministros").locator(".v4-bills-group-amt");
  await expect(amount).toContainText(/1[.\s]234[.\s]567/);
  const fit=await amount.evaluate((el)=>{
    const box=el.getBoundingClientRect(), parent=el.parentElement.getBoundingClientRect(), cs=getComputedStyle(el);
    return {left:box.left,right:box.right,parentLeft:parent.left,parentRight:parent.right,
      scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,decoration:cs.textDecorationLine};
  });
  expect(fit.left).toBeGreaterThanOrEqual(fit.parentLeft-1);
  expect(fit.right).toBeLessThanOrEqual(fit.parentRight+1);
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth+1);
  expect(fit.decoration).toBe("none");
});

for (const lang of ["es", "en", "ca"]) {
  test(`ninguna palabra de contable ni castellano colado (${lang})`, async ({ page }) => {
    await appLista(page, { settings: { lang } });
    await abreTusRecibos(page);
    const txt = await hub(page).innerText();
    expect(txt).not.toMatch(/fij[oa]s?\b|flujo|concilia|modelad|traspaso|\bfixed\b|reconcil|\bfixes\b|\bflux\b|traspàs/i);
    if (lang !== "es") expect(txt).not.toMatch(/Tus recibos|Servicios y suministros|Cargos de una sola vez/);
    // La ficha de «lo que entra» también ofrece el tipo de día: antes reaparecía «Un día fijo»
    // al profundizar aunque el hub estuviera limpio (revisión cruzada Cursor 2026-09-17).
    await hub(page).locator(".v4-bills-group").nth(2).click();
    await hub(page).locator(".v4-bills-row").first().click();
    const detailTxt = await ficha(page).innerText();
    expect(detailTxt).not.toMatch(/fij[oa]s?\b|flujo|concilia|modelad|traspaso|\bfixed\b|reconcil|\bfixes\b|\bflux\b|traspàs/i);
  });
}

test("atrás de Android quita UNA pantalla cada vez", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await expect(titulo(page)).toHaveText("Servicios y suministros");

  await page.goBack();
  await expect(titulo(page)).toHaveText("Tus recibos");

  await page.goBack();
  await expect(hub(page)).toHaveCount(0);
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
});

test("el gesto Atrás nativo acompaña al dedo, cancela y cierra Tus recibos", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  const pantalla=hub(page);
  await expect.poll(() => page.evaluate(() => window.__mcNativeEdgeBackActive)).toBe(true);

  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="start"; e.progress=0; window.dispatchEvent(e); });
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="progress"; e.progress=.4; window.dispatchEvent(e); });
  const moved=await pantalla.evaluate((el)=>({x:new DOMMatrix(getComputedStyle(el).transform).m41,w:innerWidth}));
  expect(moved.x).toBeGreaterThan(moved.w*.35);
  expect(moved.x).toBeLessThan(moved.w*.45);

  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="cancel"; e.progress=0; window.dispatchEvent(e); });
  await expect.poll(() => pantalla.evaluate((el)=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBeLessThan(1);
  await expect(pantalla).toBeVisible();

  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="start"; e.progress=0; window.dispatchEvent(e); });
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="progress"; e.progress=.65; window.dispatchEvent(e); });
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="invoke"; e.progress=1; window.dispatchEvent(e); });
  await expect(pantalla).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__mcNativeEdgeBackActive)).toBe(false);
});

test("Gestionar también vuelve arrastrando desde el centro de toda la pantalla", async ({ page, browserName }) => {
  test.skip(browserName!=="chromium", "El gesto táctil real usa CDP");
  await appLista(page);
  await abreTusRecibos(page);
  const pantalla=hub(page);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:150,y:250}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:340,y:250}]});
  const moved=await pantalla.evaluate((el)=>new DOMMatrix(getComputedStyle(el).transform).m41);
  expect(moved).toBeGreaterThan(180);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(pantalla).toHaveCount(0,{timeout:1600});
});

test("Servicios acompaña el atrás nativo y deja Tus recibos debajo", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  const hija=hub(page).locator(":scope > .v4-bills-push");
  await expect(hija).toBeVisible();
  await expect(hub(page).locator(':scope > [data-screen="bills-home"]')).toHaveAttribute("inert","");
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="progress"; e.progress=.45; window.dispatchEvent(e); });
  const pos=await hija.evaluate((el)=>({x:new DOMMatrix(getComputedStyle(el).transform).m41,w:innerWidth}));
  expect(pos.x).toBeGreaterThan(pos.w*.4);
  expect(pos.x).toBeLessThan(pos.w*.5);
  await expect(hub(page).locator('[data-screen="bills-home"]')).toBeVisible();
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="invoke"; e.progress=1; window.dispatchEvent(e); });
  await expect(hija).toHaveCount(0,{timeout:1600});
  await expect(titulo(page)).toHaveText("Tus recibos");

  // El hook vive mientras Gestionar siga abierto: volver a entrar tiene que rearmar busy.
  await grupo(page, "Servicios y suministros").click();
  await hub(page).locator(".settings-push-h .back").last().evaluate((el)=>el.click());
  await expect(titulo(page)).toHaveText("Tus recibos");
});

test("¿Me lo puedo permitir? vuelve arrastrando desde el centro", async ({ page, browserName }) => {
  test.skip(browserName!=="chromium", "El gesto táctil real usa CDP");
  await appLista(page);
  await abreTusRecibos(page);
  await hub(page).locator(".v4-bills-afford").click();
  const hija=hub(page).locator(":scope > .v4-bills-push");
  await expect(hija).toBeVisible();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:150,y:250}]});
  await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:340,y:250}]});
  expect(await hija.evaluate((el)=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBeGreaterThan(180);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await expect(hija).toHaveCount(0,{timeout:1600});
  await expect(titulo(page)).toHaveText("Tus recibos");

  await hub(page).locator(".v4-bills-afford").click();
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="progress"; e.progress=.55; window.dispatchEvent(e); });
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="invoke"; e.progress=1; window.dispatchEvent(e); });
  await expect(titulo(page)).toHaveText("Tus recibos");
});

test("la ficha de un recibo vuelve de lado sin mover su lista", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await fila(page, "Luz").click();
  const fondo=page.locator(".v4-sheet-back").filter({has:ficha(page)});
  await expect(fondo).toBeVisible();
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="progress"; e.progress=.5; window.dispatchEvent(e); });
  const pos=await fondo.evaluate((el)=>({x:new DOMMatrix(getComputedStyle(el).transform).m41,w:innerWidth}));
  expect(pos.x).toBeGreaterThan(pos.w*.45);
  expect(pos.x).toBeLessThan(pos.w*.55);
  await expect(hub(page).locator(":scope > .v4-bills-push")).toBeVisible();
  await page.evaluate(() => { const e=new Event("mcNativeEdgeBack"); e.phase="invoke"; e.progress=1; window.dispatchEvent(e); });
  await expect(ficha(page)).toHaveCount(0,{timeout:1600});
  await expect(titulo(page)).toHaveText("Servicios y suministros");
});

test("el atrás nativo anima la salida de Tus recibos antes de desmontarla", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  const pantalla=hub(page);
  await page.evaluate(()=>history.back());
  await expect.poll(()=>pantalla.evaluate((el)=>getComputedStyle(el).transform!=="none")).toBe(true);
  await expect(pantalla).toHaveCount(1);
  await expect(pantalla).toHaveCount(0,{timeout:1600});
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
});

test("renombrar no aplana el importe por mes, los meses ni el día hábil", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);

  await grupo(page, "Servicios y suministros").click();
  await fila(page, "IBI").click();
  await expect(ficha(page)).toContainText("cambia de importe según el mes");
  await ficha(page).locator("input.v4-bills-search").first().fill("IBI casa");
  await ficha(page).locator(".settings-push-h .back").evaluate((el)=>el.click());
  await expect(ficha(page)).toHaveCount(0);

  await fila(page, "Agua").click();
  await ficha(page).locator("input.v4-bills-search").first().fill("Agua del pueblo");
  await ficha(page).locator(".settings-push-h .back").evaluate((el)=>el.click());
  await expect(ficha(page)).toHaveCount(0);
  await hub(page).locator(".settings-push-h .back").last().evaluate((el)=>el.click());
  await expect(titulo(page)).toHaveText("Tus recibos");

  await grupo(page, "Lo que entra y lo que mueves").click();
  await fila(page, "Nómina").click();
  await expect(ficha(page).locator(".v4-ficha-op.on")).toContainText("Último día hábil");
  await ficha(page).locator("input.v4-bills-search").first().fill("Nómina de papá");

  await expect.poll(async () => {
    const s = await estado(page);
    const by = (list, id) => (s[list] || []).find((x) => x.id === id) || {};
    return {
      ibi: [by("fixed", "ibi").name, JSON.stringify(by("fixed", "ibi").schedule)],
      agua: [by("fixed", "agua").name, JSON.stringify(by("fixed", "agua").months), by("fixed", "agua").freq],
      nomina: [by("flows", "nomina").name, by("flows", "nomina").when],
    };
  }).toEqual({
    ibi: ["IBI casa", JSON.stringify([{ m: 1, amt: 80 }, { m: 7, amt: 120 }])],
    agua: ["Agua del pueblo", JSON.stringify([2, 4, 6, 8, 10, 12]), "bimestral"],
    nomina: ["Nómina de papá", "last"],
  });
});

test("Listo confirma a la vista, guarda una sola vez y después cierra", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await fila(page, "Luz").click();

  const hoja=ficha(page);
  for(const k of ["1","2","3"]) await hoja.getByRole("button",{name:k,exact:true}).click();
  const guardar=hoja.locator(".v4-account-correct .v4-bills-add");
  await expect(guardar).toHaveAttribute("aria-live","polite");
  // Dos toques rápidos reproducen el caso real: solo el primero puede escribir y programar cierre.
  await guardar.evaluate((el)=>{ el.click(); el.click(); });

  await expect(guardar).toBeDisabled();
  await expect(guardar).toContainText(/✓.*(Guardado|Saved|Desat)/i);
  // La confirmación debe poder leerse antes de que empiece la salida.
  await page.waitForTimeout(350);
  await expect(hoja).toHaveCount(1);
  await expect(hoja).toContainText(/Guardado|Saved|Desat/i);
  // El compositor termina la salida y solo después se desmonta la ficha.
  await expect.poll(async()=>hoja.first().evaluate((n)=>getComputedStyle(n).transform!=="none")).toBe(true);
  await expect(hoja).toHaveCount(0,{timeout:1500});
  await expect.poll(async()=>{
    const luz=((await estado(page)).fixed||[]).find((x)=>x.id==="luz");
    return luz&&luz.amount;
  }).toBe(123);
});

test("el cierre pendiente de un guardado no cierra la ficha siguiente", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await fila(page, "Luz").click();
  const hoja=ficha(page);
  await hoja.getByRole("button",{name:"1",exact:true}).click();
  await hoja.locator(".v4-account-correct .v4-bills-add").click();
  await hoja.locator(".settings-push-h .back").click();
  await expect(hoja).toHaveCount(0,{timeout:1000});
  await fila(page, "Agua").click();
  await page.waitForTimeout(700);
  await expect(ficha(page)).toBeVisible();
  await expect(ficha(page).locator("h1")).toHaveText("Agua");
});

test("Reducir animaciones cierra la ficha sin esperar la transición", async ({ page }) => {
  await appLista(page, { settings: { reduceMotion: true } });
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await fila(page, "Luz").click();
  const hoja=ficha(page);
  await hoja.locator(".settings-push-h .back").click();
  await expect(hoja).toHaveCount(0,{timeout:250});
});

test("alta por pasos: cada dos meses pregunta EN QUÉ meses y el teclado empieza vacío", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await hub(page).locator(".v4-bills-add").first().click();

  await expect(tituloHoja(alta(page))).toHaveText("¿Qué es?");
  await alta(page).locator("input.v4-bills-search").fill("Basuras");
  await alta(page).locator(".v4-cta").click();

  await expect(tituloHoja(alta(page))).toHaveText("¿Cuánto?");
  const importe = alta(page).locator(".v4-account-correct-amount");
  await expect(importe).toHaveText("—");
  for (const k of ["3", "5"]) await alta(page).getByRole("button", { name: k, exact: true }).click();
  await expect(importe).toContainText("35");
  await alta(page).locator(".v4-cta").click();

  await expect(tituloHoja(alta(page))).toHaveText("¿Cada cuánto?");
  await alta(page).locator(".v4-ficha-op").filter({ hasText: "Cada dos meses" }).click();
  await alta(page).locator(".v4-cta").click();
  await expect(alta(page)).toContainText("¿En qué meses?");
  await alta(page).locator(".mchip").filter({ hasText: /^feb/i }).click();
  await expect(alta(page)).toContainText(/al mes repartidos/);

  // Atrás de Android dentro del alta vuelve al paso anterior, sin tirar lo tecleado.
  await alta(page).locator(".v4-cta").click();
  await page.goBack();
  await expect(tituloHoja(alta(page))).toHaveText("¿En qué meses?");
  await alta(page).locator(".v4-cta").click();

  // Un recibo no tiene «último día hábil» (`when` es solo de lo que entra): no se ofrece.
  await expect(alta(page).locator(".v4-ficha-op").filter({ hasText: "Último día hábil" })).toHaveCount(0);
  const hojaAlta=alta(page);
  // Dos toques dentro del mismo frame no pueden crear dos recibos mientras la hoja sale.
  await hojaAlta.locator(".v4-cta").evaluate((el)=>{ el.click(); el.click(); });
  await expect(hojaAlta).toHaveCount(1);
  await expect.poll(async()=>hojaAlta.first().evaluate((n)=>getComputedStyle(n).transform!=="none")).toBe(true);
  await expect(hojaAlta).toHaveCount(0,{timeout:1500});

  await expect.poll(async () => {
    const rows=((await estado(page)).fixed || []).filter((x) => x.name === "Basuras");
    const f=rows[0];
    return f ? { count:rows.length, amount: f.amount, freq: f.freq, feb: (f.months || []).includes(2), ene: (f.months || []).includes(1) } : null;
  }).toEqual({ count:1, amount: 35, freq: "bimestral", feb: true, ene: false });
});

test("un cargo de una sola vez se apunta por mes y año, no por periodicidad", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Cargos de una sola vez").click();
  await hub(page).locator(".v4-bills-add").last().click();

  await alta(page).locator("input.v4-bills-search").fill("Dentista");
  await alta(page).locator(".v4-cta").click();
  for (const k of ["9", "0"]) await alta(page).getByRole("button", { name: k, exact: true }).click();
  await alta(page).locator(".v4-cta").click();
  await expect(alta(page)).not.toContainText("¿Cada cuánto?");
  await alta(page).locator(".v4-cta").click();
  await alta(page).locator(".v4-cta").click();

  await expect.poll(async () => {
    const o = ((await estado(page)).oneoffs || []).find((x) => x.name === "Dentista");
    return o ? { amount: o.amount, hasMonth: Number.isInteger(o.month), hasYear: Number.isInteger(o.year) } : null;
  }).toEqual({ amount: 90, hasMonth: true, hasYear: true });
});

test("en modo sencillo las cuotas se cambian aquí: Deudas no existe", async ({ page }) => {
  await appLista(page, { settings: { simpleMode: true } });
  await abreTusRecibos(page);
  await expect(grupo(page, "Cuotas de deuda")).not.toContainText("Deudas");
  await grupo(page, "Cuotas de deuda").click();
  await fila(page, "Préstamo coche").click();
  await expect(ficha(page)).not.toContainText(/en Deudas/);
  await expect(ficha(page).locator(".v4-keys, .v4-numpad, input").first()).toBeVisible();
});

test("fuera del modo sencillo las cuotas dicen dónde se cambian", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Cuotas de deuda").click();
  await expect(fila(page, "Préstamo coche")).toContainText(/en Deudas/);
});

test("quitar un recibo tiene Deshacer y vuelve con el MISMO id", async ({ page }) => {
  await appLista(page);
  await abreTusRecibos(page);
  await grupo(page, "Servicios y suministros").click();
  await fila(page, "Luz").click();
  await ficha(page).locator(".v4-ficha-quitar").click();

  const undo = page.locator(".v4-undo-toast");
  await expect(undo).toBeVisible();
  await expect(fila(page, "Luz")).toHaveCount(0);
  await page.waitForTimeout(2500);
  await expect(undo).toBeVisible();
  await undo.getByRole("button", { name: "Deshacer" }).click();
  await expect(fila(page, "Luz")).toHaveCount(1);
  await expect.poll(async () => ((await estado(page)).fixed || []).filter((f) => f.id === "luz").length).toBe(1);
});

test("sin nada apuntado: una tarjeta que explica", async ({ page }) => {
  await appLista(page, { fixed: [], debts: [], flows: [], oneoffs: [] });
  await abreTusRecibos(page);
  const empty=hub(page).locator(".v4-empty[data-bills-empty]");
  await expect(empty).toContainText("Aún no hay recibos");
  await expect(empty).toContainText("Conecta tu banco y los detecto solos.");
  await empty.getByRole("button",{name:/Añadir un recibo/}).click();
  await expect(alta(page)).toHaveAttribute("data-step","what");
});

test("buscar algo que no existe lo dice, y un nombre larguísimo no rompe el ancho", async ({ page }) => {
  const largo = "Seguro del hogar de la casa del pueblo con ampliación de contenido y responsabilidad civil";
  await appLista(page, { fixed: fixed.concat([{ id: "largo", name: largo, amount: 22, freq: "mes", account: "sabadell" }]) });
  await abreTusRecibos(page);

  const buscar = hub(page).locator("input.v4-bills-search").first();
  await buscar.fill("zzzz");
  await expect(hub(page).locator(".v4-bills-empty")).toContainText("No hay ningún recibo con ese nombre.");
  await buscar.fill("");

  await grupo(page, "Servicios y suministros").click();
  const f = fila(page, "Seguro del hogar");
  await expect(f).toBeVisible();
  const box = await f.boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
