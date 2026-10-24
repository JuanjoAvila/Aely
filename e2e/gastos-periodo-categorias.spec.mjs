import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosRoot, gastosCifra, gastosEstado, gastosPeriodo, gastosBajaAlMes } from "./fixtures.mjs";

/* Gastos v5 (20/10/2026): el periodo se elige en Filtros (Meses · Mi ciclo · Rango · Todo) y el
   desglose sigue al periodo elegido, igual que antes. «Mes pasado» ya no es un periodo: es bajar al
   mes anterior en la lista, donde la cifra es su total y «cerrado», sin límite. «Últimos 3 meses»
   sale por diseño (SPEC §7). Lo que se protege sigue siendo lo mismo: lista, cifra y categorías
   cuentan lo mismo para el periodo, y fuera del mes/ciclo en curso no hay margen contra el límite. */

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
  es:{cycle:"Mi ciclo",cats1:"1 categoría · octubre",cerrado:"septiembre · cerrado"},
  en:{cycle:"My cycle",cats1:"1 category · October",cerrado:"September · closed"},
  ca:{cycle:"El meu cicle",cats1:"1 categoria · octubre",cerrado:"setembre · tancat"},
};
const SIN_MARGEN=/por debajo|por encima|under|over|per sota|per sobre/;
const rows = page => gastosRoot(page).locator(".v4-gastos-list-body button.v4-mov");
const cats = page => gastosRoot(page).locator(".v4-gastos-cat");
async function check(page, expected, spent){
  await expect(cats(page)).toHaveCount(Object.keys(expected).length);
  for(const [id,amount] of Object.entries(expected)) await expect(gastosRoot(page).locator('.v4-gastos-cat[data-cat="'+id+'"] .v4-gastos-cat-amt')).toHaveText(amount+" €");
  await expect(gastosCifra(page)).toHaveText(spent+",00 €");
}
async function checkBudgetAbsent(page){
  await expect(gastosEstado(page)).not.toContainText(SIN_MARGEN);
}
for(const lang of ["es","en","ca"]){
  test("Gastos periodo único: ciclo, meses, mes cerrado, rango y todo en "+lang, async ({page})=>{
    const w=words[lang];
    await page.clock.install({time:now});
    await seedLoggedInDashboard(page,{accounts,expenses,budget:1000,categoryBudgets:{super:200},
      settings:{autoPrices:false,lang,theme:"green",expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"split"}});
    await page.goto("/"); await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await expect(gastosRoot(page)).toHaveAttribute("data-periodo","cycle");
    await check(page,{bares:40,super:25},60);
    await expect(gastosEstado(page)).toContainText(/940 €/);

    await gastosPeriodo(page,"months");
    await check(page,{super:25},25);
    await gastosRoot(page).locator('.v4-gastos-cats-h').click();
    await expect(gastosRoot(page).locator('.v4-gastos-cats-t')).toHaveText(w.cats1);
    await gastosRoot(page).locator('.v4-gastos-cats-h').click();
    await expect(gastosEstado(page)).toContainText(/975 €/);
    await expect(gastosRoot(page).locator('.v4-gastos-cat[data-cat="super"] [role="progressbar"]')).toHaveAttribute("aria-valuenow","25");
    // El mes anterior, bajando: su total (compras 70 + café 40) y «cerrado», sin margen.
    await expect(gastosRoot(page).locator('.gx-dia[data-gx-ym="2026-09"] button.v4-mov')).toHaveCount(3);
    await gastosBajaAlMes(page,"2026-09");
    await expect(gastosCifra(page)).toHaveText("110,00 €");
    await expect(gastosEstado(page)).toHaveText(w.cerrado);
    await page.evaluate(()=>document.querySelector(".page-scroll-host").scrollTo(0,0));

    await gastosPeriodo(page,"custom");
    await gastosRoot(page).locator(".range button").first().click();
    await page.locator(".mc-cal-nav button").first().click(); await page.locator(".mc-cal-nav button").first().click();
    await page.locator(".mc-cal-day").getByText("10",{exact:true}).click();
    await gastosRoot(page).locator(".range button").last().click();
    await page.locator(".mc-cal-nav button").first().click(); await page.locator(".mc-cal-nav button").first().click();
    await page.locator(".mc-cal-day").getByText("20",{exact:true}).click();
    await check(page,{salud:23,transporte:11},34);
    await expect(rows(page)).toHaveCount(2);
    await checkBudgetAbsent(page);
    await expect(cats(page).locator('[role="progressbar"]')).toHaveCount(0);

    await gastosPeriodo(page,"all");
    await check(page,{compras:70,bares:40,super:25,salud:23,transporte:11,ocio:9},178);
    await checkBudgetAbsent(page);
    await gastosPeriodo(page,"cycle");
    await check(page,{bares:40,super:25},60);
    // Tras explorar todo el histórico, el ciclo debe recuperar su margen contra el límite.
    await expect(gastosEstado(page)).toContainText(/940 €/);
    await gastosRoot(page).locator('.v4-gastos-cats-h').click();
    await expect(gastosRoot(page).locator('.v4-gastos-cats-t')).toContainText(w.cycle);
    await gastosRoot(page).locator('input.searchbar-in[type="search"]').first().fill("Octubre compra");
    await expect(rows(page)).toHaveCount(1);
    await expect(gastosCifra(page)).toHaveText("60,00 €");
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


test("búsqueda, categoría y banco exploran sin cambiar las cifras del mes",async({page})=>{
  await page.clock.install({time:now});
  const other=Object.assign(expense("Septiembre otro banco","2026-09-10",90,"salud"),{ent:"revolut"});
  await seedLoggedInDashboard(page,{accounts:accounts.concat({id:"other",ent:"revolut",name:"Otra",role:"fijos",value:100}),expenses:expenses.concat(other),budget:1000,
    settings:{autoPrices:false,lang:"es",theme:"green",expenseBanks:["sabadell"],budgetCycle:true,gTotalMode:"split"}});
  await page.goto("/"); await dismissNews(page);
  await page.locator('.botnav-tab[data-tour="gastos"]').click(); await gastosPeriodo(page,"months");
  await check(page,{super:25},25);
  await gastosRoot(page).locator('.filters button[title="Filtros"]').click();
  await page.locator('.v4-filter-cats-toggle').click(); await page.getByTestId('gastos-filter-cat-compras').click();
  await page.locator('.v4-gastos-filter-sheet .btn-primary').click();
  await expect(rows(page)).toHaveCount(1); await check(page,{super:25},25);
  await gastosRoot(page).locator('.filters button[title="Filtros"]').click();
  await page.locator('.v4-gastos-filter-sheet .btn-ghost').click();
  // «Limpiar» también vuelve al periodo de entrada (Mi ciclo): se elige otra vez Meses.
  await page.locator('.v4-gastos-filter-sheet [data-periodo="months"]').click();
  await page.locator('.v4-gastos-filter-sheet').getByRole('button',{name:'Sabadell',exact:true}).click();
  await page.locator('.v4-gastos-filter-sheet').getByRole('button',{name:'Revolut',exact:true}).click();
  await page.locator('.v4-gastos-filter-sheet .btn-primary').click();
  await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText('Septiembre otro banco');
  await check(page,{super:25},25);
  await gastosRoot(page).locator('input.searchbar-in[type="search"]').first().fill('no existe');
  await expect(rows(page)).toHaveCount(0); await check(page,{super:25},25);
});
