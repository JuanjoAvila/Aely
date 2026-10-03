import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Mes y ciclo se solapan sin ser iguales; el rango contiene categorías que no existen en ambos.
const now = new Date("2026-10-02T12:00:00Z");
const accounts = [{ id:"daily", ent:"sabadell", name:"Diaria", role:"diario", value:1500, spendFrom:true }];
const expense = (id, date, amount, category) => ({ id, date:date+"T12:00:00Z", amount, category, merchant:id, ent:"sabadell", source:"manual" });
const expenses = [
  expense("Agosto fuera", "2026-08-01", 9, "ocio"),
  expense("Agosto salud", "2026-08-10", 23, "salud"),
  expense("Agosto transporte", "2026-08-20", 11, "transporte"),
  expense("Septiembre compras", "2026-09-05", 70, "compras"),
  expense("Nómina", "2026-09-26", -2000, "ingreso"),
  expense("Septiembre café", "2026-09-27", 40, "bares"),
  expense("Octubre compra", "2026-10-01", 25, "super"),
  expense("Octubre devolución", "2026-10-01", -5, "ingreso"),
];
const words = {
  es:{more:"Más…",last:"Mes pasado",month:"Este mes",cycle:"Mi ciclo",custom:"Rango…",all:"Todo",three:"Últimos 3 meses",prev:"Mes anterior",unknown:/no tiene un presupuesto registrado/},
  en:{more:"More…",last:"Last month",month:"This month",cycle:"My cycle",custom:"Range…",all:"All",three:"Last 3 months",prev:"Previous month",unknown:/no budget is recorded/},
  ca:{more:"Més…",last:"Mes passat",month:"Aquest mes",cycle:"El meu cicle",custom:"Rang…",all:"Tot",three:"Últims 3 mesos",prev:"Mes anterior",unknown:/no té un pressupost registrat/},
};
const rows = page => page.locator(".v4-gastos-list-body button.v4-mov");
const cats = page => page.locator(".v4-gastos-cat");
async function choose(page,w,name){
  await page.locator(".v4-periods").getByRole("button",{name:w.more,exact:true}).click();
  await page.locator(".v4-sheet").getByRole("button",{name,exact:true}).click();
}
async function check(page, expected, spent){
  await expect(cats(page)).toHaveCount(Object.keys(expected).length);
  for(const [id,amount] of Object.entries(expected)) await expect(page.locator('.v4-gastos-cat[data-cat="'+id+'"] .v4-gastos-cat-amt')).toHaveText(amount+" €");
  await expect(page.locator(".v4-gastos-summary-amount")).toContainText(spent+",00");
}
async function checkBudgetAbsent(page,w){
  await expect(page.locator(".v4-gastos-summary-budget")).toHaveCount(0);
  await expect(page.locator(".v4-gastos-summary-left")).toHaveCount(0);
  await expect(page.locator(".v4-gastos-summary")).not.toContainText(w.unknown);
  const widths=await page.locator(".v4-gastos-summary-top").evaluate(el=>({top:el.getBoundingClientRect().width,main:el.querySelector(".v4-gastos-summary-main").getBoundingClientRect().width}));
  expect(Math.abs(widths.main-widths.top)).toBeLessThanOrEqual(1);
}
for(const lang of ["es","en","ca"]){
  test("Gastos periodo único: mes, ciclo, rango y todos en "+lang, async ({page})=>{
    const w=words[lang];
    await page.clock.install({time:now});
    await seedLoggedInDashboard(page,{accounts,expenses,budget:1000,categoryBudgets:{super:200},
      settings:{autoPrices:false,lang,theme:"green",expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"split"}});
    await page.goto("/"); await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await check(page,{bares:40,super:25},60);
    await expect(page.locator(".v4-gastos-summary-budget")).toHaveCount(1);
    await expect(page.locator('.v4-gastos-progress')).toHaveAttribute("aria-valuenow","60");
    await expect(page.locator('.v4-gastos-summary-left')).toContainText("940,00");

    await choose(page,w,w.last);
    await check(page,{compras:70,bares:40},110);
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).filter({hasText:"Octubre compra"})).toHaveCount(0);
    await checkBudgetAbsent(page,w);
    await expect(cats(page).locator('[role="progressbar"]')).toHaveCount(0);
    await expect(page.locator(".v4-gastos-progress")).toHaveCount(0);

    await page.locator(".v4-periods").getByRole("button",{name:w.month,exact:true}).click();
    await check(page,{super:25},25);
    await page.locator('.v4-gastos-cats-h').click();
    await expect(page.locator('.v4-gastos-cats-t')).toHaveText({es:"1 categoría · Este mes",en:"1 category · This month",ca:"1 categoria · Aquest mes"}[lang]);
    await page.locator('.v4-gastos-cats-h').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('.v4-gastos-summary-left')).toContainText("975,00");
    await expect(page.locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]')).toHaveAttribute("aria-valuenow","25");

    await choose(page,w,w.custom);
    await page.locator(".range button").first().click();
    await page.locator(".mc-cal-nav button").first().click(); await page.locator(".mc-cal-nav button").first().click();
    await page.locator(".mc-cal-day").getByText("10",{exact:true}).click();
    await page.locator(".range button").last().click();
    await page.locator(".mc-cal-nav button").first().click(); await page.locator(".mc-cal-nav button").first().click();
    await page.locator(".mc-cal-day").getByText("20",{exact:true}).click();
    await check(page,{salud:23,transporte:11},34);
    await expect(rows(page)).toHaveCount(2);
    await checkBudgetAbsent(page,w);

    await choose(page,w,w.three);
    await check(page,{compras:70,bares:40,super:25,salud:23,transporte:11,ocio:9},178);
    await checkBudgetAbsent(page,w);
    await choose(page,w,w.all);
    await check(page,{compras:70,bares:40,super:25,salud:23,transporte:11,ocio:9},178);
    await checkBudgetAbsent(page,w);
    await page.locator(".v4-periods").getByRole("button",{name:w.cycle,exact:true}).click();
    await check(page,{bares:40,super:25},60);
    // Tras explorar todo el histórico, el ciclo debe recuperar su límite y su progreso.
    await expect(page.locator(".v4-gastos-summary-budget")).toHaveCount(1);
    await expect(page.locator('.v4-gastos-summary-budget > div').first()).toContainText("1000,00");
    await expect(page.locator('.v4-gastos-summary-left')).toContainText("940,00");
    await expect(page.locator('.v4-gastos-progress')).toHaveAttribute("aria-valuemax","1000");
    await expect(page.locator('.v4-gastos-progress')).toHaveAttribute("aria-valuenow","60");
    await page.locator('.v4-gastos-cats-h').click();
    await expect(page.locator('.v4-gastos-cats-t')).toContainText(w.cycle);
    await page.locator('input.searchbar-in[type="search"]').first().fill("Octubre compra");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.v4-gastos-summary-amount')).toContainText("60,00");
  });
}

test("Mi ciclo: un apunte futuro queda fuera de lista y categorías",async({page})=>{
  await page.clock.install({time:now});
  await seedLoggedInDashboard(page,{accounts,expenses:expenses.concat(expense("Compra futura","2026-10-03",900,"ocio")),budget:1000,
    settings:{autoPrices:false,lang:"es",theme:"green",expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"split"}});
  await page.goto("/"); await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await check(page,{bares:40,super:25},60);
  await expect(rows(page).filter({hasText:"Compra futura"})).toHaveCount(0);
  await expect(cats(page).filter({hasText:"900"})).toHaveCount(0);
});


test("Mes pasado: búsqueda, categoría y banco exploran sin cambiar sus cifras",async({page})=>{
  await page.clock.install({time:now});
  const other=Object.assign(expense("Septiembre otro banco","2026-09-10",90,"salud"),{ent:"revolut"});
  await seedLoggedInDashboard(page,{accounts:accounts.concat({id:"other",ent:"revolut",name:"Otra",role:"fijos",value:100}),expenses:expenses.concat(other),budget:1000,
    settings:{autoPrices:false,lang:"es",theme:"green",expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"split"}});
  await page.goto("/"); await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click(); await choose(page,words.es,words.es.last);
  await check(page,{compras:70,bares:40},110);
  await page.locator('.filters button[title="Filtros"]').click();
  await page.locator('.v4-filter-cats-toggle').click(); await page.getByTestId('gastos-filter-cat-compras').click();
  await page.locator('.v4-gastos-filter-sheet .btn-primary').click();
  await expect(rows(page)).toHaveCount(1); await check(page,{compras:70,bares:40},110);
  await page.locator('.filters button[title="Filtros"]').click();
  await page.locator('.v4-gastos-filter-sheet .btn-ghost').click();
  await page.locator('.v4-gastos-filter-sheet').getByRole('button',{name:'Sabadell',exact:true}).click();
  await page.locator('.v4-gastos-filter-sheet').getByRole('button',{name:'Revolut',exact:true}).click();
  await page.locator('.v4-gastos-filter-sheet .btn-primary').click();
  await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Septiembre otro banco');
  await check(page,{compras:70,bares:40},110);
  await page.locator('input.searchbar-in[type="search"]').first().fill('no existe');
  await expect(rows(page)).toHaveCount(0); await check(page,{compras:70,bares:40},110);
});
