import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* IMPORTAR HISTÓRICO — el filtro de banco tiene que filtrar de VERDAD.
 *
 * Bug real reportado (3/8): «seleccioné Trade Republic y salían también movimientos de Banco
 * Sabadell». La causa (ver BankHistoryImport, 10-app-components.js): esta pantalla nunca tuvo
 * filtro de banco — se buscaba e importaba SIEMPRE de todos los bancos conectados a la vez, sin
 * forma de acotar a uno. Es justo el tipo de regresión que AGENTS §7 obliga a cubrir con e2e:
 * esconder o filtrar filas de una lista es algo que `npm test` (lógica pura) no ve, solo el DOM
 * real — y aquí además hay que comprobar que el filtro no es solo cosmético: lo que queda oculto
 * tiene que desaparecer también del contador de "Importar N", que es el propio bug reportado.
 *
 * Puerta (tanda 4 / plan K): SOLO Ajustes → Importaciones. Se quitó el botón de Mis bancos.
 */

const bankLinks = [
  { aspsp_name: "Trade Republic", aspsp_country: "ES", status: "active",
    valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-07-25T09:00:00Z", accounts: [{ uid: "a1" }] },
  { aspsp_name: "Sabadell", aspsp_country: "ES", status: "active",
    valid_until: "2026-10-01T00:00:00Z", last_sync: "2026-07-25T09:00:00Z", accounts: [{ uid: "a2" }] },
];

test("deshacer usa el estado actual y conserva el reintento mientras la nube responde", async ({ page }) => {
  await seedLoggedInDashboard(page);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.evaluate(() => {
    const imported = { id: "550e8400-e29b-41d4-a716-446655440000", importBatchId: "audit", amount: 9 };
    window.__undoToasts = [];
    askConfirm = () => new Promise(resolve => { window.__confirmUndo = resolve; });
    cloud.deleteExpensesByIds = () => new Promise((resolve, reject) => { window.__deleteUndo = { resolve, reject }; });
    function Harness() {
      const [s, set] = React.useState({ expenses: [imported], accounts: [], budget: 100,
        lastHistImport: { batchId: "audit", localIds: [imported.id], cloudIds: [imported.id] } });
      window.__undoState = s;
      window.__setUndoState = set;
      return React.createElement(BankHistoryImport, { state:s, set, onClose:()=>{}, showToast:m=>window.__undoToasts.push(m) });
    }
    const host = document.createElement("div"); document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(Harness));
  });
  const undo = page.locator(".hist-import").getByRole("button", { name: /Deshacer/i });
  await undo.click();
  await page.evaluate(() => window.__setUndoState(s => ({ ...s, budget:777,
    expenses:s.expenses.concat([{ id:"nuevo-ajeno", amount:15 }]) })));
  await page.evaluate(() => window.__confirmUndo(true));
  await expect.poll(() => page.evaluate(() => window.__undoState.budget)).toBe(777);
  await expect.poll(() => page.evaluate(() => window.__undoState.expenses.map(e=>e.id))).toEqual(["nuevo-ajeno"]);
  await expect.poll(() => page.evaluate(() => window.__undoState.lastHistImport?.cloudPending)).toBe(true);
  await page.evaluate(() => window.__deleteUndo.reject(new Error("offline")));
  await expect(undo).toBeEnabled();
  await undo.click();
  await page.evaluate(() => window.__confirmUndo(true));
  await page.evaluate(() => window.__deleteUndo.resolve());
  await expect.poll(() => page.evaluate(() => window.__undoState.lastHistImport)).toBeNull();
  expect(await page.evaluate(() => window.__undoState.budget)).toBe(777);
});

const histLinks = [
  { aspsp: "Trade Republic", accounts: [{ transactions: [
    { date: "2026-07-20", amount: 12.5, merchant: "Cafe TR", card: true, ext_id: "tr1" },
  ] }] },
  { aspsp: "Sabadell", accounts: [{ transactions: [
    { date: "2026-07-18", amount: 45, merchant: "Super Sabadell", card: true, ext_id: "sb1" },
  ] }] },
];

async function abrirHistorico(page, opts={}) {
  const historyLinks=opts.links||histLinks;
  const usedBankLinks=opts.bankLinks||bankLinks;
  const expenseBanks=opts.expenseBanks||usedBankLinks.map((l)=>l.aspsp_name.toLowerCase().includes("trade")?"trade_republic":l.aspsp_name.toLowerCase().includes("sabadell")?"sabadell":l.aspsp_name.toLowerCase().includes("caixa")?"caixabank":"revolut");
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    settings:{autoPrices:false,theme:"green",expenseBanks},
    expenses:opts.expenses||[],
    __cloudRows: { bank_links: usedBankLinks },
    /* La misma Edge sirve sync diario e histórico. El doble base queda vacío para que abrir
       Ajustes no importe antes la fila que precisamente queremos comprobar en el histórico. */
    __cloudFns: { "bank-sync": { data: { ok: true, links: [] }, error: null } },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  // Ajustes → Importaciones (única puerta desde tanda 4).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".set-card").first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Importaciones/i }).click();
  await page.locator("button.set-row").filter({ hasText: /Importar histórico/i }).click();
  const overlay = page.locator(".hist-import");
  await expect(overlay).toBeVisible();
  await page.evaluate(({links,error}) => {
    cloud.bankSyncHistory = () => error
      ? Promise.reject(new Error(error.message || "sin red"))
      : Promise.resolve({ ok:true, links });
  }, { links:historyLinks, error:opts.error||null });
  if(opts.selectOnly){
    for(const l of usedBankLinks){
      const chip=overlay.getByRole("button",{name:l.aspsp_name,exact:true});
      if(!(await chip.count())) continue;
      const on=((await chip.getAttribute("class"))||"").split(/\s+/).includes("on");
      const wanted=l.aspsp_name===opts.selectOnly;
      if(on!==wanted) await chip.click();
    }
  }
  await overlay.getByRole("button", { name: /Buscar movimientos/i }).click();
  if(!opts.custom){
    if(opts.selectOnly!=="Sabadell") await expect(overlay.getByText("Cafe TR")).toBeVisible({ timeout: 10_000 });
    if(opts.selectOnly!=="Trade Republic") await expect(overlay.getByText("Super Sabadell")).toBeVisible({ timeout: 10_000 });
  }
  return overlay;
}

test("Mis bancos ya no ofrece Importar histórico (solo Importaciones)", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    hasBankLink: true,
    __cloudRows: { bank_links: bankLinks },
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mc-open-banks", { detail: { focus: null } })));
  await expect(page.locator("[data-aspsp]")).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator("button").filter({ hasText: /^Importar histórico$/ })).toHaveCount(0);
});

test("Importar histórico: de entrada consulta solo los bancos marcados para gasto diario", async ({ page }) => {
  const overlay = await abrirHistorico(page,{expenseBanks:["trade_republic"],selectOnly:"Trade Republic"});
  await expect(overlay.getByText("Cafe TR")).toBeVisible();
  await expect(overlay.getByText("Super Sabadell")).toHaveCount(0);
  await expect(overlay.getByRole("button", { name: /Importar 1/ })).toBeVisible();
});

test("Importar histórico: filtrar a un banco esconde los del resto Y los saca del botón de importar (el bug reportado)", async ({ page }) => {
  const overlay = await abrirHistorico(page,{selectOnly:"Trade Republic"});

  // Lo que reportó: Sabadell no puede seguir apareciendo si solo se pidió Trade Republic.
  await expect(overlay.getByText("Super Sabadell")).toHaveCount(0);
  await expect(overlay.getByText("Cafe TR")).toBeVisible();

  // Y no basta con esconderlo: el botón de importar tiene que contar solo lo que se ve — si no,
  // el bug seguiría de facto (Sabadell se importaría igual, solo que con la fila oculta debajo).
  await expect(overlay.getByRole("button", { name: /Importar 1/ })).toBeVisible();
});

test("Importar histórico: volver a «Todos los bancos» recupera la vista completa", async ({ page }) => {
  const overlay = await abrirHistorico(page);
  await overlay.locator("button.v4-chip").filter({hasText:/^Sabadell$/}).click();
  await expect(overlay.getByText("Super Sabadell")).toHaveCount(0);

  await overlay.getByRole("button", { name: "Todos los bancos" }).click();
  await expect(overlay.getByText("Super Sabadell")).toBeVisible();
  await expect(overlay.getByRole("button", { name: /Importar 2/ })).toBeVisible();
});

test("CaixaBank fallido se explica y permite importar lo recibido de Sabadell", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,
    bankLinks:[{aspsp_name:"CaixaBank",status:"active"},bankLinks[1]],
    links:[{aspsp:"CaixaBank",accounts:[{ok:false,error:"privado",transactions:[]}]},histLinks[1]]});
  await expect(overlay.locator(".bank-read-warning")).toContainText("CaixaBank: no se han podido leer");
  await expect(overlay.getByText("Super Sabadell")).toBeVisible();
  await expect(overlay.getByRole("button",{name:/Importar 1/})).toBeVisible();
  await expect(overlay).not.toContainText("privado");
});

test("CaixaBank con histórico pinta su importe y permite importarlo", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,
    bankLinks:[{aspsp_name:"CaixaBank",status:"active"}],
    links:[{aspsp:"CaixaBank",ok:true,accounts:[{ok:true,count:1,transactions:[
      {date:"2026-09-02",amount:37.42,merchant:"Compra Caixa",card:true,ext_id:"cx-hist-1"}
    ]}]}]});
  await expect(overlay.getByText("Compra Caixa")).toBeVisible();
  await expect(overlay).toContainText("37,42");
  await expect(overlay.getByRole("button",{name:/Importar 1/})).toBeVisible();
});

test("dos cuentas Caixa con el mismo cargo conservan dos filas y dos identidades al importar", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,
    bankLinks:[{aspsp_name:"CaixaBank",status:"active"}],
    links:[{aspsp:"CaixaBank",ok:true,accounts:[
      {uid:"cx-corriente",ok:true,count:1,transactions:[
        {date:"2026-09-02",amount:37.42,merchant:"Compra repetida",card:true}
      ]},
      {uid:"cx-ahorro",ok:true,count:1,transactions:[
        {date:"2026-09-02",amount:37.42,merchant:"Compra repetida",card:true}
      ]},
    ]}]});
  await expect(overlay.getByText("Compra repetida")).toHaveCount(2);
  const importar=overlay.getByRole("button",{name:/Importar 2/});
  await expect(importar).toBeVisible();
  await page.evaluate(() => {
    window.__histSaved=null;
    cloud.addExpensesBatch=async rows => {
      window.__histSaved=rows;
      return {cloudIds:rows.map(x=>x.id),offline:false};
    };
  });
  await importar.click();
  await expect.poll(() => page.evaluate(() => window.__histSaved)).toHaveLength(2);
  const dates=await page.evaluate(() => window.__histSaved.map(x=>x.date));
  expect(new Set(dates).size).toBe(2);
  expect(dates.every(d=>d.slice(0,10)==="2026-09-02")).toBe(true);
});

test("CaixaBank a cero se nombra: no se disfraza de histórico ya apuntado", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,
    bankLinks:[{aspsp_name:"CaixaBank",status:"active"}],
    links:[{aspsp:"CaixaBank",ok:true,accounts:[{ok:true,count:0,transactions:[]}]}]});
  await expect(overlay.locator(".bank-read-warning")).toContainText("CaixaBank: el banco ha devuelto 0 movimientos");
  await expect(overlay).not.toContainText("No hay movimientos nuevos");
});

test("CaixaBank explica cuántas cuentas compartió cuando todo ya estaba apuntado", async ({page}) => {
  const expenses=[
    {id:"cx-old-1",date:"2026-09-02T12:00:00.000Z",amount:37.42,merchant:"Compra uno",category:"otros",source:"ob",ent:"caixabank",extId:"cx-hist-1"},
    {id:"cx-old-2",date:"2026-09-03T12:00:00.000Z",amount:18.75,merchant:"Compra dos",category:"otros",source:"ob",ent:"caixabank",extId:"cx-hist-2"},
  ];
  const overlay=await abrirHistorico(page,{custom:true,expenses,
    bankLinks:[{aspsp_name:"CaixaBank",status:"active"}],
    links:[{aspsp:"CaixaBank",ok:true,accounts:[{uid:"cx-unica",ok:true,count:2,transactions:[
      {date:"2026-09-02",amount:37.42,merchant:"Compra uno",card:true,ext_id:"cx-hist-1"},
      {date:"2026-09-03",amount:18.75,merchant:"Compra dos",card:true,ext_id:"cx-hist-2"},
    ]}]}]});
  await expect(overlay).toContainText("Cuentas compartidas por CaixaBank: 1");
  await expect(overlay).toContainText("Movimientos entregados: 2, todos ya apuntados");
  await expect(overlay).toContainText("si aun así no aparece");
});

test("histórico pendiente omitido por Edge antiguo no se presenta como sin movimientos", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,
    bankLinks:[{aspsp_name:"CaixaBank",status:"pending"}],links:[]});
  await expect(overlay.locator(".bank-read-warning")).toContainText("CaixaBank: falta completar la conexión");
  await expect(overlay).not.toContainText("No hay movimientos nuevos");
});

test("histórico parcial conserva filas y mantiene el aviso aunque no haya candidatos nuevos", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,bankLinks:[bankLinks[1]],
    links:[{aspsp:"Sabadell",accounts:[{ok:true,truncated:true,transactions:[]}]}]});
  await expect(overlay.locator(".bank-read-warning")).toContainText("Sabadell: la descarga está incompleta");
  await expect(overlay).not.toContainText("No hay movimientos nuevos");
});

test("fallo de la consulta no afirma que no existen movimientos", async ({page}) => {
  const overlay=await abrirHistorico(page,{custom:true,error:{message:"sin red"}});
  await expect(overlay.locator(".bank-read-warning")).toHaveCount(2);
  await expect(overlay.locator(".bank-read-warning").first()).toContainText("no se han podido leer");
  await expect(overlay).not.toContainText("No hay movimientos nuevos");
});
