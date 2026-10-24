import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews, gastosRoot, gastosCifra, gastosEstado, gastosBajaAlMes } from "./fixtures.mjs";

/* Gastos v5 (20/10/2026): ya no hay botones «Este mes / Mes pasado / Últimos 3 meses». La lista es
   el histórico entero, mes a mes, y cada día lleva el mes de MADRID en `data-gx-ym`: lo que antes
   se comprobaba con la ventana de cada botón se comprueba ahora con el mes en que cae cada fila.
   La cifra de arriba es el mes en curso; bajando al mes anterior, su total y «cerrado». «Últimos 3
   meses» desaparece por diseño (SPEC §7: Meses · Mi ciclo · Rango · Todo). */

// Instantes absolutos elegidos fuera de Date local: los mismos apuntes deben aparecer en ambos
// navegadores. Los extremos incluyen fin/inicio de mes y CET↔CEST; nada sale al banco real.
const cases = [
  {name:"cambio de mes",now:"2026-09-30T22:30:00Z",from:"2026-09-30T22:00:00Z",to:"2026-10-31T23:00:00Z",last:"2026-08-31T22:00:00Z",three:"2026-07-31T22:00:00Z"},
  {name:"cambio de año",now:"2026-12-31T23:30:00Z",from:"2026-12-31T23:00:00Z",to:"2027-01-31T23:00:00Z",last:"2026-11-30T23:00:00Z",three:"2026-10-31T23:00:00Z"},
  {name:"horario verano",now:"2026-03-29T01:30:00Z",from:"2026-02-28T23:00:00Z",to:"2026-03-31T22:00:00Z",last:"2026-01-31T23:00:00Z",three:"2025-12-31T23:00:00Z"},
  {name:"horario invierno",now:"2026-10-25T01:30:00Z",from:"2026-09-30T22:00:00Z",to:"2026-10-31T23:00:00Z",last:"2026-08-31T22:00:00Z",three:"2026-07-31T22:00:00Z"},
];
// Mes de Madrid (aaaa-mm) de un instante, el mismo que la app pone a cada día de la lista.
const ymMadrid=(ms)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit"}).format(new Date(ms));
const rows=(p,ym)=>gastosRoot(p).locator('.gx-dia[data-gx-ym="'+ym+'"] button.v4-mov');
const cifra=async(page)=>(await gastosCifra(page).textContent()).replace(/\D/g,'');
async function check(page,ym,total,names,amounts){
  await expect.poll(()=>cifra(page),{message:'total sin depender del separador de miles'}).toBe(String(total*100));
  await expect(rows(page,ym)).toHaveCount(names.length);
  for(const name of names)await expect(rows(page,ym).filter({hasText:name})).toHaveCount(1);
  await expect(rows(page,ym).filter({hasText:"Siguiente mes"})).toHaveCount(0);
  await expect(rows(page,ym).filter({hasText:"Fuera tres meses"})).toHaveCount(0);
  if(!amounts) return;
  await expect(gastosRoot(page).locator('.v4-gastos-cat')).toHaveCount(Object.keys(amounts).length);
  for(const [cat,n]of Object.entries(amounts))await expect.poll(async()=> (await gastosRoot(page).locator('.v4-gastos-cat[data-cat="'+cat+'"] .v4-gastos-cat-amt').innerText()).replace(/\D/g,'')).toBe(String(n));
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
    await expect(gastosRoot(page)).toHaveAttribute("data-periodo","months");
    const mes=ymMadrid(from), anterior=ymMadrid(last), mesNombre=new Date(c.now).toLocaleDateString({es:'es-ES',en:'en-GB',ca:'ca-ES'}[lang],{month:'long',timeZone:'Europe/Madrid'});
    await check(page,mes,2300,["Inicio mensual","Final mensual"],{super:2300});
    await expect(gastosEstado(page)).toContainText(mesNombre);
    // El apunte del mes que viene va a SU mes, no al de arriba.
    await expect(rows(page,ymMadrid(to)).filter({hasText:"Siguiente mes"})).toHaveCount(1);
    // El mes anterior, bajando: su total, cerrado y sin margen contra el límite de hoy.
    await gastosBajaAlMes(page,anterior);
    await check(page,anterior,500,["Mes anterior"]);
    await expect(gastosEstado(page)).toContainText({es:"cerrado",en:"closed",ca:"tancat"}[lang]);
    await expect(gastosEstado(page)).not.toContainText(/por debajo|por encima|under|over|per sota|per sobre/);
    // Lo de «tres meses» cae en el suyo, y lo de antes, en el anterior.
    await expect(rows(page,ymMadrid(three)).filter({hasText:"Inicio tres meses"})).toHaveCount(1);
    await expect(rows(page,ymMadrid(three-1)).filter({hasText:"Fuera tres meses"})).toHaveCount(1);
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
    await expect.poll(()=>cifra(page)).toBe('50000');
    await expect(rows(page,ymMadrid(from-1))).toHaveCount(1);
    // Materializar la partición mediante una preferencia real antes de tomar la foto: el fixture
    // arranca con el formato antiguo y montar por sí solo no debe escribirlo.
    await gastosRoot(page).locator('.v4-gastos-cats-h').click();await gastosRoot(page).locator('.v4-gastos-cats-h').click();
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('micartera_v3_exp'))).not.toBeNull();
    const saved=await page.evaluate(()=>localStorage.getItem('micartera_v3_exp'));
    await page.clock.setFixedTime(new Date(from+60000));
    await gastosRoot(page).locator('.v4-gastos-cats-h').click();await gastosRoot(page).locator('.v4-gastos-cats-h').click();
    await check(page,ymMadrid(from),2300,["Inicio mensual","Final mensual"],{super:2300});
    await expect(rows(page,ymMadrid(from)).filter({hasText:"Mes anterior"})).toHaveCount(0);
    await expect(gastosEstado(page)).toContainText(new Date(from).toLocaleDateString({es:'es-ES',en:'en-GB',ca:'ca-ES'}[lang],{month:'long',timeZone:'Europe/Madrid'}));
    expect(await page.evaluate(()=>localStorage.getItem('micartera_v3_exp'))).toBe(saved);
  });
});
