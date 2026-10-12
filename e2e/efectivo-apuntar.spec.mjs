import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/**
 * Hotfix efectivo (13/9): en Apuntar hay que poder elegir «💶 Efectivo» y el gasto
 * baja el sobre (ent:"efectivo"), no el banco diario.
 */
test.use({ viewport: { width: 375, height: 812 } });

const finCashWords={es:{atm:"Saqué del cajero",create:"+ Efectivo"},en:{atm:"ATM withdrawal",create:"+ Cash"},ca:{atm:"He tret del caixer",create:"+ Efectiu"}};
async function finCashOpen(page,lang,overrides={}){
  await page.clock.install({time:new Date("2026-09-20T12:00:00Z")});
  await seedLoggedInDashboard(page,Object.assign({__seedOnce:true,trAnchor:"2026-09",
    accounts:[{id:"daily",ent:"trade_republic",name:"Diaria ficticia",value:1000,role:"diario",spendFrom:true,inject:0},{id:"cash",ent:"efectivo",name:"Sobre ficticio",value:100,role:"fijos"}],
    settings:{autoPrices:false,theme:"green",lang,expenseBanks:["trade_republic","efectivo"],dailyOnlyBanks:["efectivo"]}
  },overrides));
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  await expect(page.locator('.v4-card-list button[data-account-id]').first()).toBeVisible();
}
async function finCashBalances(page,expected){
  for(const [id,amount] of Object.entries(expected)){
    const formatted=await page.evaluate(value=>eur(value),amount);
    await expect(page.locator('.v4-card-list button[data-account-id="'+id+'"] .am')).toHaveText(formatted);
  }
}
for(const lang of ["es","en","ca"]){
  test("FIN01 "+lang+": cajero de diaria conserva patrimonio en DOM y al cerrar",async({page})=>{
    await finCashOpen(page,lang);
    await page.getByRole("button",{name:finCashWords[lang].atm,exact:true}).click();
    await page.locator(".askback").getByRole("button",{name:"Trade Republic",exact:true}).click();
    await page.locator(".askback button.btn-primary").click();
    await page.locator(".askback input").fill("50");
    await page.locator(".askback button.btn-primary").click();
    await finCashBalances(page,{daily:950,cash:150});
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem(mcStateKey()+"_exp")||"[]"));
    expect(before.filter(e=>e.category==="traspaso").map(e=>e.amount)).toEqual([50]);
    await page.clock.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    await page.reload();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await finCashBalances(page,{daily:950,cash:150});
    const closed=await page.evaluate(()=>JSON.parse(localStorage.getItem(mcStateKey())||"{}"));
    expect(closed.accounts.reduce((a,x)=>a+Math.round(x.value*100),0)).toBe(110000);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(mcStateKey()+"_exp")||"[]"))).toEqual(before);
  });
  test("FIN01 "+lang+": efectivo sin diaria arrastra el gasto al siguiente mes",async({page})=>{
    await finCashOpen(page,lang,{accounts:[{id:"cash",ent:"efectivo",name:"Sobre ficticio",value:100,role:"fijos"}],
      expenses:[{id:"cash-exp",ent:"efectivo",date:"2026-09-12",amount:20,merchant:"Compra ficticia",source:"manual",category:"super",noCard:true}]});
    await finCashBalances(page,{cash:80});
    await page.locator('.v4-card-list button[data-account-id="cash"]').click();
    const sheet=page.locator(".v4-sheet");
    await sheet.getByRole("button",{name:/Corregir saldo|Fix balance/i}).click();
    const erase=sheet.locator('.v4-keys button[aria-label="Borrar"]');
    for(const i of [0,1]){await erase.dispatchEvent("pointerdown",{button:0});await erase.dispatchEvent("pointerup");}
    for(const digit of ["1","2","0"]) await sheet.locator(".v4-keys").getByRole("button",{name:digit,exact:true}).click();
    await page.locator(".v4-sheet-back").click({position:{x:10,y:10}});
    await expect(sheet).toHaveCount(0);
    await finCashBalances(page,{cash:120});
    await page.clock.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    await page.reload();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await finCashBalances(page,{cash:120});
  });
  test("FIN01 "+lang+": alta a mitad de mes respeta saldo contado e historia anterior",async({page})=>{
    await finCashOpen(page,lang,{trAnchor:"2026-07",accounts:[{id:"daily",ent:"trade_republic",name:"Diaria ficticia",value:1000,role:"diario",spendFrom:true,inject:0}],
      expenses:[{id:"old-cash",ent:"efectivo",date:"2026-07-12",amount:40,merchant:"Anterior ficticio",source:"manual",category:"super",noCard:true},
        {id:"month-cash",ent:"efectivo",date:"2026-09-12",amount:20,merchant:"Compra ficticia",source:"manual",category:"super",noCard:true}]});
    await page.getByRole("button",{name:finCashWords[lang].create,exact:true}).click();
    await page.locator(".askback input").fill("100");
    await page.locator(".askback button.btn-primary").click();
    const row=page.locator('.v4-card-list button[data-account-key]').filter({hasText:/Efectivo|Cash|Efectiu/}).first();
    const cashId=await row.getAttribute("data-account-id");
    await finCashBalances(page,{[cashId]:100,daily:1000});
    await page.clock.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    await page.reload();
    await page.waitForFunction(()=>!document.getElementById("mc-load"));
    await page.locator('.botnav-tab[data-tour="cartera"]').click();
    await finCashBalances(page,{[cashId]:100,daily:1000});
  });
}

test("Apuntar deja elegir Efectivo y el gasto lleva ent efectivo", async ({ page }) => {
  await seedLoggedInDashboard(page, {
    accounts: [
      { id: "rv", ent: "revolut", name: "Del día", value: 200, role: "diario", spendFrom: true },
      { id: "ef", ent: "efectivo", name: "El sobre", value: 80, role: "fijos" },
    ],
    settings: {
      autoPrices: false, theme: "green",
      expenseBanks: ["revolut", "efectivo"],
      dailyOnlyBanks: ["efectivo"],
    },
    expenses: [],
  });
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !document.getElementById("mc-load"), null, { timeout: 30_000 });
  await dismissNews(page);

  await page.locator(".botnav-fab").click();
  const sheet = page.locator(".v4-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);

  // Chip DIRECTO al lado de 📅/🏦 (no dentro de la lista del banco).
  const cashChip = sheet.locator('[data-testid="ap-efectivo"]');
  await expect(cashChip).toBeVisible();
  await cashChip.click();
  await expect(cashChip).toHaveClass(/on/);

  // 12 € con el teclado propio (mismo patrón que apuntar-sheet: dígitos enteros, no céntimos)
  for (const d of ["1", "2"]) {
    await sheet.locator(".v4-keys").getByRole("button", { name: d, exact: true }).click();
  }
  await sheet.locator(".v4-input").fill("Sobre e2e");
  await sheet.locator(".v4-cta").click();
  await expect(sheet).toHaveCount(0, { timeout: 5_000 });

  const row = page.locator(".page.page-scroll-host .v4-gastos-list-body button[data-expense-id]")
    .filter({ has: page.getByText("Sobre e2e", { exact: true }) });
  async function assertSavedExpense(timeout = 5_000) {
    // Inicio monta el mismo concepto oculto; el sobre debe verse en la fila de Gastos activa.
    await expect(page.locator('.botnav-tab[data-tour="gastos"]')).toHaveClass(/active/, { timeout });

    await expect(row).toHaveCount(1, { timeout });
    await expect(row.locator(".nm-title")).toHaveText("Sobre e2e", { timeout });
    await expect(row).toBeVisible({ timeout });
    await expect(row.locator(".am")).toHaveText("12,00 €", { timeout });
    await expect(row.locator(".am")).toBeVisible({ timeout });
    // Persistencia debounced ~400 ms: exigir un único gasto con importe y entidad exactos.
    await expect.poll(() => page.evaluate(() => {
      const exps = JSON.parse(localStorage.getItem("micartera_v3_exp") || "[]");
      return exps.filter((e) => e && e.merchant === "Sobre e2e").map((e) => ({
        amount: e.amount, ent: e.ent ?? null, source: e.source,
        origAmount: e.origAmount ?? null, origCur: e.origCur ?? null,
      }));
    }), { timeout }).toEqual([
      { amount: 12, ent: "efectivo", source: "manual", origAmount: null, origCur: null },
    ]);
  }
  await assertSavedExpense();

  // El control altera el DOM real y llama al MISMO oráculo: texto oculto no acredita entrega.
  const rowStyle = await row.getAttribute("style");
  await test.step("oráculo rechaza concepto presente pero fila oculta", async () => {
    try {
      await row.evaluate((el) => { el.style.visibility = "hidden"; });
      await expect(row).toHaveCount(1);
      await expect(row.locator(".nm-title")).toHaveText("Sobre e2e");
      await expect(assertSavedExpense(200)).rejects.toThrow(/toBeVisible/);
    } finally {
      await row.evaluate((el, style) => {
        if (style === null) el.removeAttribute("style"); else el.setAttribute("style", style);
      }, rowStyle);
    }
  });
  // Corrupciones sintéticas SOLO del almacenamiento de este caso; no cambian la fuente.
  const saved = await page.evaluate(() => localStorage.getItem("micartera_v3_exp"));
  for (const fault of ["sin guardar", "importe incorrecto", "entidad incorrecta", "duplicado", "divisa incorrecta"]) {
    await test.step("oráculo rechaza " + fault, async () => {
      try {
        await page.evaluate(({ saved, fault }) => {
          let exps = JSON.parse(saved);
          const exp = exps.find((e) => e && e.merchant === "Sobre e2e");
          if (fault === "sin guardar") exps = exps.filter((e) => e !== exp);
          if (fault === "importe incorrecto") exp.amount = 1200;
          if (fault === "entidad incorrecta") exp.ent = "sabadell";
          if (fault === "duplicado") exps.push({ ...exp });
          if (fault === "divisa incorrecta") exp.origCur = "USD";
          localStorage.setItem("micartera_v3_exp", JSON.stringify(exps));
        }, { saved, fault });
        await expect(assertSavedExpense(200)).rejects.toThrow(/toEqual/);
      } finally {
        await page.evaluate((saved) => localStorage.setItem("micartera_v3_exp", saved), saved);
      }
    });
  }
  await assertSavedExpense();
});
