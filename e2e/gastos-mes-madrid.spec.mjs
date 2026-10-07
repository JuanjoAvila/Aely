import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Instantes absolutos elegidos fuera de Date local: los mismos apuntes deben aparecer en ambos
// navegadores. Los extremos incluyen fin/inicio de mes y CET↔CEST; nada sale al banco real.
const cases = [
  {name:"cambio de mes",now:"2026-09-30T22:30:00Z",from:"2026-09-30T22:00:00Z",to:"2026-10-31T23:00:00Z",last:"2026-08-31T22:00:00Z",three:"2026-07-31T22:00:00Z"},
  {name:"cambio de año",now:"2026-12-31T23:30:00Z",from:"2026-12-31T23:00:00Z",to:"2027-01-31T23:00:00Z",last:"2026-11-30T23:00:00Z",three:"2026-10-31T23:00:00Z"},
  {name:"horario verano",now:"2026-03-29T01:30:00Z",from:"2026-02-28T23:00:00Z",to:"2026-03-31T22:00:00Z",last:"2026-01-31T23:00:00Z",three:"2025-12-31T23:00:00Z"},
  {name:"horario invierno",now:"2026-10-25T01:30:00Z",from:"2026-09-30T22:00:00Z",to:"2026-10-31T23:00:00Z",last:"2026-08-31T22:00:00Z",three:"2026-07-31T22:00:00Z"},
];
const words={es:{month:"Este mes",last:"Mes pasado",more:"Más…",three:"Últimos 3 meses"},en:{month:"This month",last:"Last month",more:"More…",three:"Last 3 months"},ca:{month:"Aquest mes",last:"Mes passat",more:"Més…",three:"Últims 3 mesos"}};
const rows=p=>p.locator('.v4-gastos-list-body button.v4-mov');
const fmt=(ms,lang)=>new Date(ms).toLocaleDateString({es:"es-ES",en:"en-GB",ca:"ca-ES"}[lang],{day:"2-digit",month:"short",timeZone:"Europe/Madrid"});
async function check(page,lang,from,to,total,names,amounts){
  await expect.poll(async()=> (await page.locator('.v4-gastos-summary-amount').innerText()).replace(/\D/g,''),{message:'total sin depender del separador de miles'}).toBe(String(total*100));
  await expect(rows(page)).toHaveCount(names.length);
  for(const name of names)await expect(rows(page).filter({hasText:name})).toHaveCount(1);
  await expect(rows(page).filter({hasText:"Siguiente mes"})).toHaveCount(0);
  await expect(rows(page).filter({hasText:"Fuera tres meses"})).toHaveCount(0);
  await expect(page.locator('.v4-gastos-cat')).toHaveCount(Object.keys(amounts).length);
  for(const [cat,n]of Object.entries(amounts))await expect.poll(async()=> (await page.locator('.v4-gastos-cat[data-cat="'+cat+'"] .v4-gastos-cat-amt').innerText()).replace(/\D/g,'')).toBe(String(n));
  const marks=page.locator('.v4-gastos-progress-marks > span');
  await expect(marks.first()).toHaveText(fmt(from,lang));
  await expect(marks.last()).toHaveText(fmt(to-1,lang));
}
for(const tz of ["UTC","Europe/Madrid"])test.describe(tz,()=>{
  test.use({timezoneId:tz});
  for(const lang of ["es","en","ca"])for(const c of cases)test(c.name+" "+lang,async({page})=>{
    const from=Date.parse(c.from),to=Date.parse(c.to),last=Date.parse(c.last),three=Date.parse(c.three);
    const expense=(id,ms,amount,category)=>({id,date:new Date(ms).toISOString(),amount,category,merchant:id,ent:"sabadell",source:"manual"});
    await page.clock.install({time:new Date(c.now)});
    await seedLoggedInDashboard(page,{accounts:[{id:"daily",ent:"sabadell",role:"diario",spendFrom:true,value:8000}],budget:5000,
      expenses:[expense("Inicio mensual",from,1200,"super"),expense("Final mensual",to-1,1100,"super"),expense("Mes anterior",from-1,500,"compras"),expense("Inicio tres meses",three,100,"salud"),expense("Fuera tres meses",three-1,700,"ocio"),expense("Siguiente mes",to,900,"transporte")],
      settings:{lang,autoPrices:false,theme:"green",expenseBanks:["sabadell"],budgetCycle:false,gTotalMode:"split"}});
    await page.goto('/');await dismissNews(page);
    await page.locator('.botnav-tab[data-tour="gastos"]').click();
    const w=words[lang];
    await page.locator('.v4-periods').getByRole('button',{name:w.month,exact:true}).click();
    await check(page,lang,from,to,2300,["Inicio mensual","Final mensual"],{super:2300});
    await expect(page.locator('.v4-gastos-summary-label')).toContainText(new Date(c.now).toLocaleDateString({es:'es-ES',en:'en-GB',ca:'ca-ES'}[lang],{month:'long',timeZone:'Europe/Madrid'}));
    await expect(page.locator('.v4-gastos-progress')).toHaveAttribute('aria-valuenow','2300');
    for(const [name,a,b,total,names,cats] of [[w.last,last,from,500,["Mes anterior"],{compras:500}],[w.three,three,to,2900,["Inicio mensual","Final mensual","Mes anterior","Inicio tres meses"],{super:2300,compras:500,salud:100}]]){
      await page.locator('.v4-periods').getByRole('button',{name:w.more,exact:true}).click();
      await page.locator('.v4-sheet').getByRole('button',{name,exact:true}).click();
      await check(page,lang,a,b,total,names,cats);
      await expect(page.locator('.v4-gastos-summary-budget')).toHaveCount(0);
      await expect(page.locator('.v4-gastos-progress')).toHaveCount(0);
    }
  });
});

// La app queda abierta cuando Madrid ya está en el nuevo mes pero UTC aún no ha cambiado de día.
// Plegar/desplegar categorías sólo cambia una preferencia: no reemplaza los movimientos. El memo
// de límites debe avanzar por el día de Madrid para que no conserve el mes anterior.
for(const tz of ["UTC","Europe/Madrid"])test.describe("memo "+tz,()=>{
  test.use({timezoneId:tz});
  for(const lang of ["es","en","ca"])for(const c of cases.slice(0,2))test("mes abierto "+c.name+" "+lang,async({page})=>{
    const from=Date.parse(c.from),to=Date.parse(c.to);
    const expense=(id,ms,amount,category)=>({id,date:new Date(ms).toISOString(),amount,category,merchant:id,ent:"sabadell",source:"manual"});
    await page.clock.install({time:new Date(from-60000)});
    await seedLoggedInDashboard(page,{accounts:[{id:"daily",ent:"sabadell",role:"diario",spendFrom:true,value:8000}],budget:5000,
      expenses:[expense("Mes anterior",from-1,500,"compras"),expense("Inicio mensual",from,1200,"super"),expense("Final mensual",to-1,1100,"super"),expense("Siguiente mes",to,900,"transporte")],
      settings:{lang,autoPrices:false,theme:"green",expenseBanks:["sabadell"],budgetCycle:false,gTotalMode:"split"}});
    await page.goto('/');await dismissNews(page);await page.locator('.botnav-tab[data-tour="gastos"]').click();
    await page.locator('.v4-periods').getByRole('button',{name:words[lang].month,exact:true}).click();
    await expect.poll(async()=> (await page.locator('.v4-gastos-summary-amount').innerText()).replace(/\D/g,'')).toBe('50000');
    await expect(rows(page)).toHaveCount(1);
    // Materializar la partición mediante una preferencia real antes de tomar la foto: el fixture
    // arranca con el formato antiguo y montar por sí solo no debe escribirlo.
    await page.locator('.v4-gastos-cats-h').click();await page.locator('.v4-gastos-cats-h').click();
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('micartera_v3_exp'))).not.toBeNull();
    const saved=await page.evaluate(()=>localStorage.getItem('micartera_v3_exp'));
    await page.clock.setFixedTime(new Date(from+60000));
    await page.locator('.v4-gastos-cats-h').click();await page.locator('.v4-gastos-cats-h').click();
    await check(page,lang,from,to,2300,["Inicio mensual","Final mensual"],{super:2300});
    await expect(rows(page).filter({hasText:"Mes anterior"})).toHaveCount(0);
    await expect(page.locator('.v4-gastos-summary-label')).toContainText(new Date(from).toLocaleDateString({es:'es-ES',en:'en-GB',ca:'ca-ES'}[lang],{month:'long',timeZone:'Europe/Madrid'}));
    expect(await page.evaluate(()=>localStorage.getItem('micartera_v3_exp'))).toBe(saved);
  });
});
