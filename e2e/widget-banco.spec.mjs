import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

test.use({ timezoneId: "Europe/Madrid" });

async function bridge(page) {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      MiCartera: new Proxy({ updateWidget: async data => { window.__widgetSnapshot = data; },
        addListener: async () => ({ remove() {} }) },
      { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
}
async function settings(page) {
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator(".v4-avatar").click();
  await page.getByRole("button", { name: /Ir a Ajustes/i }).click();
  const panel = page.locator(".settings-push.open");
  await panel.getByRole("button", { name: /Banco del widget/ }).click();
  return panel;
}

test("FIN-05: app y widget excluyen lápidas conservadas al reabrir después de un pago", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
  const expenses = [
    { id: "live", date: "2026-09-02T10:00:00Z", amount: 181, merchant: "Compra ficticia", category: "super", source: "macrodroid" },
    { id: "gone-out", date: "2026-09-03T10:00:00Z", amount: 3, merchant: "Borrado ficticio", category: "bares", source: "ob:trade_republic" },
    { id: "gone-in", date: "2026-09-04T10:00:00Z", amount: -15, merchant: "Ingreso borrado", category: "ingreso", source: "ob:trade_republic" },
  ];
  const deleted = expenses.slice(1).map(e => e.date.slice(0, 10) + "|" + e.amount + "|" + e.merchant);
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses, deleted,
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
    settings: { autoPrices: false, gTotalMode: "net" } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.budgetLeft)).toBe(819);
  await dismissNews(page);
  // page-live también monta Gastos como vecino: comprobar Inicio, no ambas listas juntas.
  const inicio = page.locator('.page').filter({ has: page.locator('.v4-inicio-head') });
  await expect(inicio.locator('.v4-mov').filter({ hasText: "Compra ficticia" })).toHaveCount(1);
  await expect(inicio.locator('.v4-mov').filter({ hasText: /Borrado ficticio|Ingreso borrado/ })).toHaveCount(0);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  const bar = page.locator('.v4-gastos-progress[role="progressbar"]');
  await expect(bar).toHaveAttribute("aria-valuenow", "181");
  await expect(page.locator('[data-expense-id="live"]')).toBeVisible();
  await expect(page.locator('[data-expense-id="gone-out"]')).toHaveCount(0);
  await expect(page.locator('[data-expense-id="gone-in"]')).toHaveCount(0);
  const beforeCash = await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash, safe: window.__widgetSnapshot.safeLiq }));
  // El pago entra con la app cerrada; las filas antiguas permanecen para probar la contabilidad.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("micartera_v3_exp"));
    rows.push({ id: "pay", date: "2026-09-27T10:00:00Z", amount: 5.45,
      merchant: "Pago ficticio", category: "super", source: "macrodroid" });
    localStorage.setItem("micartera_v3_exp", JSON.stringify(rows));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.budgetLeft)).toBe(813.55);
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await expect(bar).toHaveAttribute("aria-valuenow", "186.45");
  const afterCash = await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash, safe: window.__widgetSnapshot.safeLiq }));
  expect(afterCash.cash).toBeCloseTo(beforeCash.cash - 5.45, 2);
  expect(afterCash.safe).toBeCloseTo(beforeCash.safe - 5.45, 2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).deleted)).toEqual(deleted);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3_exp")).length)).toBe(4);
});

test("elegir otro banco actualiza el widget aunque tenga el mismo saldo y persiste", async ({ page }) => {
  const accounts = [
    { id: "caixa", ent: "caixabank", role: "diario", spendFrom: true, value: 500 },
    { id: "sabadell", ent: "sabadell", role: "fijos", value: 500 },
  ];
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 100, accounts,
    settings: { autoPrices: false, theme: "green", expenseBanks: ["caixabank"] } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("caixabank");
  const panel = await settings(page);
  await panel.getByRole("combobox", { name: "Banco del widget" }).selectOption("sabadell");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("sabadell");
  expect(await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash,
    left: window.__widgetSnapshot.budgetLeft, afford: window.__widgetSnapshot.afford })))
    .toEqual({ cash: 500, left: 100, afford: 100 });
  await expect(panel.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("sabadell");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.widgetBank)).toBe("sabadell");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).accounts)).toEqual(accounts);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("micartera_v3")).settings.expenseBanks)).toEqual(["caixabank"]);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("sabadell");
  const again = await settings(page);
  await again.getByRole("combobox", { name: "Banco del widget" }).selectOption("");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("caixabank");
});

test("el límite usa la liquidez del banco elegido y suma sus cuentas sin duplicar opciones", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-26T10:00:00Z") });
  await seedLoggedInDashboard(page, { budget: 500,
    accounts: [
      { id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 900 },
      { id: "b", ent: "sabadell", role: "fijos", value: 120 },
      { id: "c", ent: "sabadell", role: "fijos", value: 80 },
      { id: "cash", ent: "efectivo", value: 60 },
      { id: "family", ent: "familia", value: 25 },
    ], fixed: [{ id: "f", name: "Recibo", amount: 75, freq: "mes", account: "sabadell", day: 28 }],
    settings: { autoPrices: false, widgetBank: "sabadell" } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cash)).toBe(200);
  expect(await page.evaluate(() => ({ bank: window.__widgetSnapshot.cashEnt,
    safe: window.__widgetSnapshot.safeLiq, afford: window.__widgetSnapshot.afford })))
    .toEqual({ bank: "sabadell", safe: 125, afford: 125 });
  const panel = await settings(page);
  await expect(panel.getByRole("option", { name: "Sabadell", exact: true })).toHaveCount(1);
  await expect(panel.getByRole("option", { name: /Efectivo|Familia/ })).toHaveCount(0);
});

for (const chosen of ["sabadell", "efectivo", "familia"]) {
test("banco ausente o no bancario vuelve a la cuenta diaria: " + chosen, async ({ page }) => {
  await seedLoggedInDashboard(page, { settings: { autoPrices: false, widgetBank: chosen },
    accounts: [{ id: "a", ent: "caixabank", role: "diario", spendFrom: true, value: 90 },
      { id: "cash", ent: "efectivo", value: 60 }, { id: "family", ent: "familia", value: 25 }] });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("caixabank");
  const panel = await settings(page);
  await expect(panel.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("");
});
}

// El filtro de la elección no puede quitar una cuenta diaria que ya alimentaba el widget.
test("automático conserva Efectivo como cuenta diaria incluso con una elección antigua inválida", async ({ page }) => {
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 500,
    accounts: [{ id: "cash", ent: "efectivo", role: "diario", spendFrom: true, value: 200 },
      { id: "bank", ent: "sabadell", role: "fijos", value: 900 }] });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("efectivo");
  expect(await page.evaluate(() => ({ cash: window.__widgetSnapshot.cash, safe: window.__widgetSnapshot.safeLiq })))
    .toEqual({ cash: 200, safe: 200 });
  const panel = await settings(page);
  await expect(panel.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("");
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("micartera_v3"));
    saved.settings.widgetBank = "efectivo";
    localStorage.setItem("micartera_v3", JSON.stringify(saved));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.cashEnt)).toBe("efectivo");
  const again = await settings(page);
  await expect(again.getByRole("combobox", { name: "Banco del widget" })).toHaveValue("");
  await expect(again.getByRole("option", { name: "Efectivo", exact: true })).toHaveCount(0);
});

/* APK51 comparte el contrato mensual de ingest activo: cambiarlo solo por OTA haría alternar
   cifras entre app abierta/cerrada. El bruto de Inicio se entrega solo con contrato nativo v2. */
const INICIO = [
  { lang: "es", spent: "Has gastado" },
  { lang: "en", spent: "You've spent" },
  { lang: "ca", spent: "Has gastat" },
];
const MES_CON_NOMINA = [
  { id: "nomina", date: "2026-09-05T10:00:00Z", amount: -2000, merchant: "Nómina ficticia", category: "ingreso", ent: "trade_republic" },
  { id: "super", date: "2026-09-06T10:00:00Z", amount: 600, merchant: "Súper ficticio", category: "super", ent: "trade_republic" },
];
for (const caso of INICIO) {
  test(`APK51 conserva su payload legado mensual en modo Balance (${caso.lang})`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
    await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: MES_CON_NOMINA,
      accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
      settings: { autoPrices: false, lang: caso.lang, gTotalMode: "net", budgetCycle: false } });
    await bridge(page);
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(1400);
    expect(await page.evaluate(() => window.__widgetSnapshot.budgetLeft)).toBe(2400);
    expect(await page.evaluate(() => window.__widgetSnapshot.contract)).toBeUndefined();
    expect(await page.evaluate(() => Object.keys(window.__widgetSnapshot).sort())).toEqual([
      "afford","budget","budgetLeft","cash","cashEnt","cashLabel","coveredEvents","deletedKeys","periodStart","safeLiq","spent"
    ]);
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await expect(page.locator(".v42-cycle-amount>.serif")).toHaveText("400 €");
    await expect(page.locator(".v4-budget .v4-ring")).toContainText("60%");
  });
}

test("con Mi ciclo activo el widget sigue en su mes natural, que es lo que dicen sus textos", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000,
    expenses: [{ id: "antes", date: "2026-09-02T10:00:00Z", amount: 250, merchant: "Compra anterior", category: "super", ent: "trade_republic" }]
      .concat(MES_CON_NOMINA.map((e) => Object.assign({}, e, { merchant: e.id === "nomina" ? "NOMINA EMPRESA" : e.merchant }))),
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
    settings: { autoPrices: false, gTotalMode: "net", budgetCycle: true, expenseBanks: ["trade_republic"] } });
  await bridge(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.spent)).toBe(1150);
  const snap = await page.evaluate(() => ({ start: window.__widgetSnapshot.periodStart, month: inicioDeMesMs(Date.now()) }));
  expect(snap.start).toBe(snap.month);
});

/* INC-2909-01: un widget que declara el contrato v2 recibe la ventana y la cifra de Inicio:
   el ciclo desde el cobro en neto (sin la nómina que lo abre) o el mes en bruto, y su idioma.
   La ventana en app_state prepara un contrato futuro; ingest activo sigue siendo legado. */
async function bridgeV2(page) {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => false, Plugins: {
      MiCartera: new Proxy({ updateWidget: async data => { window.__widgetSnapshot = data; (window.__widgetCalls||(window.__widgetCalls=[])).push(data); },
        widgetContract: async () => ({ v: 2 }),
        addListener: async () => ({ remove() {} }) },
      { get: (target, key) => target[key] || (() => Promise.resolve({})) }),
    } };
  });
}
const CICLO = [
  { id: "antes", date: "2026-09-02T10:00:00Z", amount: 250, merchant: "Compra anterior", category: "super", ent: "trade_republic" },
  { id: "nomina", date: "2026-09-05T10:00:00Z", amount: -2000, merchant: "NOMINA EMPRESA", category: "ingreso", ent: "trade_republic" },
  { id: "super", date: "2026-09-06T10:00:00Z", amount: 600, merchant: "Súper ficticio", category: "super", ent: "trade_republic" },
  { id: "bizum", date: "2026-09-07T10:00:00Z", amount: -100, merchant: "Bizum recibido", category: "ingreso", ent: "trade_republic" },
];

// El ACK local de retirada79 debe sobrevivir al pull que empezó en ese mismo instante.
// Si se pierde readStartedAt al injertar el widget, vuelve «otros» y el gasto salta de100 a180.
for(const lang of ["es","en","ca"]) test(`Widget80: pull antiguo no suma una retirada confirmada (${lang})`,async({page})=>{
  const now=Date.parse("2026-09-27T10:00:00Z"),date=new Date(now).toISOString();
  await page.clock.install({time:new Date(now)});
  // Date fijo prueba el límite ACK==inicio del pull; los temporizadores siguen avanzando.
  await page.clock.setFixedTime(new Date(now));
  const atm="550e8400-e29b-41d4-a716-446655440080",buy="550e8400-e29b-41d4-a716-446655440100";
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,
    accounts:[{id:"caixa",ent:"caixabank",bankIban:"fixture",role:"diario",value:920}],
    settings:{lang,autoPrices:false,budgetCycle:false,gTotalMode:"net",expenseBanks:["caixabank"],widgetBank:"caixabank"},
    expenses:[{id:atm,date,amount:80,merchant:"Disposición ficticia",category:"traspaso",source:"ob",ent:"caixabank",withdrawalConfirmedAt:now},
      {id:buy,date,amount:100,merchant:"Compra ficticia",category:"super",source:"ob",ent:"caixabank"}],
    __cloudRows:{expenses:[{id:atm,fecha:date,importe:80,comercio:"Disposición ficticia",cat:"otros",source:"ob:caixabank"},
      {id:buy,fecha:date,importe:100,comercio:"Compra ficticia",cat:"super",source:"ob:caixabank"}]}});
  await bridgeV2(page);await page.goto("/");
  await expect.poll(()=>page.evaluate(()=>window.__widgetSnapshot?.spent)).toBe(100);
  const snap=await page.evaluate(()=>window.__widgetSnapshot);
  expect(snap.contract).toBe(2);expect(snap.lang).toBe(lang);expect(snap.budgetLeft).toBe(900);
  expect(snap.coveredEvents).not.toContain(atm); // La foto de banco no inventa un ACK de ingest.
  expect(await page.evaluate(()=>window.__widgetCalls.every(x=>x.spent===100))).toBe(true);
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem("micartera_v3_exp")).find(x=>x.id===id)?.category,atm)).toBe("traspaso");
  // Tras medir la frontera, el splash necesita que Date avance para quitar su cortina.
  await page.clock.setSystemTime(new Date(now+2000));
  await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await expect(page.locator(".v42-cycle-amount>.serif")).toHaveText("900 €");
  await expect(page.locator(".v4-budget .v4-ring")).toContainText("10%");
  expect(await page.evaluate(()=>window.__widgetCalls.every(x=>x.spent===100))).toBe(true);
});
for (const caso of [{ lang: "es" }, { lang: "en" }, { lang: "ca" }]) {
  test(`E2: widget v2 con Mi ciclo recibe la ventana y el neto de Inicio (${caso.lang})`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
    await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: CICLO,
      accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
      settings: { autoPrices: false, lang: caso.lang, gTotalMode: "net", budgetCycle: true, expenseBanks: ["trade_republic"] } });
    await bridgeV2(page);
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.periodKind)).toBe("ciclo");
    const snap = await page.evaluate(() => window.__widgetSnapshot);
    expect(snap.contract).toBe(2);
    expect(snap.magnitude).toBe("neto");
    expect(snap.lang).toBe(caso.lang);
    expect(await page.evaluate(() => window.__widgetCalls.every(x=>x.contract===2))).toBe(true);
    expect(snap.spent).toBe(500);            // 600 − 100; la nómina abre el ciclo y la compra del día 2 es del anterior
    expect(snap.budgetLeft).toBe(500);
    expect(snap.scope).toBeTruthy();
    expect(snap.periodStart).toBe(await page.evaluate(() => new Date(2026, 8, 5).getTime()));
    // `ingest` seguirá esta ventana con la app cerrada, sin sumar la nómina.
    await expect.poll(() => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("micartera_v3") || "{}");
      return s.widgetPeriod && s.widgetPeriod.kind + "|" + s.widgetPeriod.anchor;
    // Este fixture es manual (sin source bancario): su UUID distingue nóminas iguales.
    })).toBe("ciclo|2026-09-05|-2000|NOMINA EMPRESA|nomina");
    await page.waitForFunction(() => !document.getElementById("mc-load"));
    await dismissNews(page);
    await expect(page.locator(".v4-budget .ph")).toContainText("500");
  });
}

test("v2 sin Mi ciclo recibe el mes en bruto", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-27T10:00:00Z") });
  await seedLoggedInDashboard(page, { __seedOnce: true, budget: 1000, expenses: CICLO,
    accounts: [{ id: "tr", ent: "trade_republic", role: "diario", spendFrom: true, value: 2000 }],
    settings: { autoPrices: false, gTotalMode: "net", budgetCycle: false, expenseBanks: ["trade_republic"] } });
  await bridgeV2(page);
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__widgetSnapshot?.contract)).toBe(2);
  const snap = await page.evaluate(() => window.__widgetSnapshot);
  expect(snap.periodKind).toBe("mes");
  expect(snap.magnitude).toBe("gasto");
  expect(snap.spent).toBe(850);
  expect(snap.periodStart).toBe(await page.evaluate(() => inicioDeMesMs(Date.now())));
});

for (const lang of ["es", "en", "ca"]) {
  test(`v2 conserva neto negativo, reservas e ingresos de otro banco (${lang})`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-10-01T00:30:00+02:00") });
    await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,
      accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:2000}],
      settings:{autoPrices:false,lang,gTotalMode:"split",budgetCycle:true,expenseBanks:["trade_republic"]},
      reservaLog:[{date:"2026-09-26T10:00:00Z",amount:100},{date:"2026-10-02T10:00:00Z",amount:50}],
      expenses:[
        {id:"salary",date:"2026-09-26T10:00:00Z",amount:-2000,merchant:"NOMINA FICTICIA",category:"ingreso",ent:"trade_republic"},
        {id:"pay",date:"2026-09-27T10:00:00Z",amount:120,merchant:"Compra ficticia",category:"super",ent:"trade_republic"},
        {id:"income",date:"2026-09-28T10:00:00Z",amount:-300,merchant:"Devolución ficticia",category:"ingreso",ent:"sabadell"},
        {id:"neutral",date:"2026-09-28T10:01:00Z",amount:-500,merchant:"Traspaso ficticio",category:"traspaso",ent:"sabadell"},
        {id:"dup",date:"2026-09-28T10:02:00Z",amount:-80,merchant:"Repetido ficticio",category:"ingreso",ent:"sabadell",possibleDup:true},
        {id:"future",date:"2026-10-02T10:00:00Z",amount:70,merchant:"Futuro ficticio",category:"super",ent:"trade_republic"}
      ]});
    await bridgeV2(page);await page.goto("/");
    await expect.poll(()=>page.evaluate(()=>window.__widgetSnapshot?.spent)).toBe(-180);
    const snap=await page.evaluate(()=>window.__widgetSnapshot);
    expect(snap.budget).toBe(900);expect(snap.budgetLeft).toBe(1080);
    expect(snap.periodKind).toBe("ciclo");expect(snap.magnitude).toBe("neto");expect(snap.lang).toBe(lang);
    expect(snap.periodStart).toBe(Date.parse("2026-09-26T00:00:00+02:00"));
    await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    await expect(page.locator(".v42-cycle-amount>.serif")).toHaveText("1080 €");
    await expect(page.locator(".v4-budget .v4-ring")).toContainText("0%");
  });
}

test("v2 no envía snapshot legacy durante la negociación y no inventa saldo sin cuenta",async({page})=>{
  await page.clock.install({time:new Date("2026-09-27T10:00:00Z")});
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,accounts:[],expenses:[],settings:{autoPrices:false,budgetCycle:false}});
  await bridgeV2(page);
  await page.addInitScript(()=>{
    window.Capacitor.Plugins.MiCartera.widgetContract=()=>new Promise(resolve=>{window.__finishWidgetContract=()=>resolve({v:2});});
  });
  await page.goto("/");
  await expect.poll(()=>page.evaluate(()=>typeof window.__finishWidgetContract)).toBe("function");
  expect(await page.evaluate(()=>window.__widgetCalls||[])).toEqual([]);
  await page.evaluate(()=>window.__finishWidgetContract());
  await expect.poll(()=>page.evaluate(()=>window.__widgetSnapshot?.contract)).toBe(2);
  expect(await page.evaluate(()=>({cash:window.__widgetSnapshot.cash,safe:window.__widgetSnapshot.safeLiq}))).toEqual({cash:undefined,safe:undefined});
});

test("v2 reintenta un puente colgado sin enviar legacy",async({page})=>{
  await page.clock.install({time:new Date("2026-10-02T12:00:00Z")});
  await seedLoggedInDashboard(page,{__seedOnce:true,settings:{autoPrices:false}});await bridgeV2(page);
  await page.addInitScript(()=>{
    let calls=0;
    window.Capacitor.Plugins.MiCartera.widgetContract=()=>++calls===1?new Promise(()=>{}):Promise.resolve({v:2});
    window.Capacitor.Plugins.MiCartera.widgetWaiting=async()=>{window.__widgetWaiting=true;};
  });
  await page.goto("/");await page.clock.runFor(3500);
  expect(await page.evaluate(()=>window.__widgetWaiting)).toBe(true);
  expect(await page.evaluate(()=>window.__widgetCalls||[])).toEqual([]);
  await page.clock.runFor(3500);
  await expect.poll(()=>page.evaluate(()=>window.__widgetSnapshot?.contract)).toBe(2);
  expect(await page.evaluate(()=>window.__widgetCalls.every(x=>x.contract===2))).toBe(true);
});

for(const v2 of [false,true]) test(`cobertura tras el día1, contrato v2=${v2}`,async({page})=>{
  await page.clock.install({time:new Date("2026-10-02T12:00:00Z")});
  const rows=[{id:"row29",fecha:"2026-09-29T10:00:00Z",importe:30,cat:"super",comercio:"Pago ficticio",source:"macrodroid",ingest_event_id:"tr:ev29"},
    {id:"old",fecha:"2026-09-20T10:00:00Z",importe:20,cat:"super",comercio:"Anterior ficticio",source:"macrodroid",ingest_event_id:"tr:old"},
    {id:"future",fecha:"2026-10-03T10:00:00Z",importe:50,cat:"super",comercio:"Futuro ficticio",source:"macrodroid",ingest_event_id:"tr:future"}];
  await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:2000}],
    settings:{autoPrices:false,budgetCycle:true,expenseBanks:["trade_republic"]},
    __cloudRows:{expenses:rows},expenses:[
      {id:"salary",date:"2026-09-26T10:00:00Z",amount:-2000,merchant:"NOMINA FICTICIA",category:"ingreso",ent:"trade_republic"},
      {id:"purchase",date:"2026-09-27T10:00:00Z",amount:100,merchant:"Compra ficticia",category:"super",ent:"trade_republic"}]});
  if(v2)await bridgeV2(page);else await bridge(page);
  // El legado mensual conserva su límite superior histórico: incluye la fila futura de 50.
  await page.goto("/");await expect.poll(()=>page.evaluate(()=>window.__widgetSnapshot?.spent)).toBe(v2?130:50);
  const ack=await page.evaluate(()=>window.__widgetSnapshot.coveredEvents);
  if(v2){expect(ack).toContain("tr:ev29");expect(ack).toContain("tr:old");}else{expect(ack).not.toContain("tr:ev29");}
  if(v2)expect(ack).not.toContain("tr:future");else expect(ack).toContain("tr:future"); // legado exacto
  await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
  await expect(page.locator(".v42-cycle-amount>.serif")).toHaveText("870 €");
  await expect(page.locator(".v4-budget .v4-ring")).toContainText("13%");
});

for (const lang of ["es","en","ca"]) for (const mode of ["net","split"]) for (const cycle of [false,true]) {
  test(`v2 identifica consumo con compras500 e ingreso1500, ${mode}, ciclo${cycle} (${lang})`,async({page})=>{
    await page.clock.install({time:new Date("2026-09-27T10:00:00Z")});
    await seedLoggedInDashboard(page,{__seedOnce:true,budget:1000,flows:[],
      accounts:[{id:"tr",ent:"trade_republic",role:"diario",spendFrom:true,value:3000}],
      settings:{autoPrices:false,lang,gTotalMode:mode,budgetCycle:cycle,expenseBanks:["trade_republic"]},
      expenses:[
        {id:"salary",date:"2026-09-25T10:00:00Z",amount:-2000,merchant:"NOMINA FICTICIA",category:"ingreso",ent:"trade_republic"},
        {id:"pay",date:"2026-09-26T10:00:00Z",amount:500,merchant:"Compra ficticia",category:"super",ent:"trade_republic"},
        {id:"income",date:"2026-09-26T11:00:00Z",amount:-1500,merchant:"Devolución ficticia",category:"ingreso",ent:"trade_republic"}
      ]});
    await bridgeV2(page);await page.goto("/");
    await expect.poll(()=>page.evaluate(()=>window.__widgetSnapshot?.contract)).toBe(2);
    const snap=await page.evaluate(()=>window.__widgetSnapshot);
    expect(snap.spent).toBe(cycle?-1000:500);expect(snap.budgetLeft).toBe(cycle?2000:500);
    expect(snap.magnitude).toBe(cycle?"neto":"gasto");expect(snap.periodKind).toBe(cycle?"ciclo":"mes");
    await page.waitForFunction(()=>!document.getElementById("mc-load"));await dismissNews(page);
    await expect(page.locator(".v4-budget .ph")).toContainText(cycle?/1[.,\s]?000/:"500");
  });
}
