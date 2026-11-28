import {test,expect} from '@playwright/test';
import {seedLoggedInDashboard,dismissNews} from './fixtures.mjs';
test.use({timezoneId:'Europe/Madrid'});
// MI CICLO NO DA MÁS MARGEN QUE EL LÍMITE (producción, 28/11/2026, en catalán): una entrada grande que
// no era la nómina dejaba el neto en −567 € e Inicio decía «0 %» y 1.217 € «lliures de 650 €» cuando
// se había pasado. Importes y nombres inventados.
const fila=(id,date,amount,merchant,category)=>({id,date:date+'T12:00:00Z',amount,merchant,category,ent:'sabadell'});
const estado={__seedOnce:true,budget:650,settings:{autoPrices:false,theme:'green',lang:'ca',gTotalMode:'net',budgetCycle:true,expenseBanks:['sabadell']},
 accounts:[{id:'g-daily',ent:'sabadell',name:'Compte sintètic',value:900,role:'diario',spendFrom:true}],fixed:[],flows:[],debts:[],oneoffs:[],reservaLog:[],expenses:[
 fila('g-nom','2026-10-30',-1400,'NOMINA EJEMPLO SL','ingreso'),
 fila('g-llega','2026-11-02',-1400,'Movimiento','ingreso'),
 fila('g1','2026-11-05',400,'Super sintètic','super'),
 fila('g2','2026-11-15',300,'Roba sintètica','ropa'),
 fila('g3','2026-11-25',133,'Sopar sintètic','restaurantes')]};
test('Mi ciclo: una entrada que no es la nómina no deja el anillo a 0 % ni libre por encima del límite (ca)',async({page})=>{
 const host=new URL(test.info().project.use.baseURL).hostname;
 await page.route('**/*',route=>new URL(route.request().url()).hostname===host?route.continue():route.abort());
 await page.clock.install({time:new Date('2026-11-28T12:00:00Z')});
 await seedLoggedInDashboard(page,estado);await page.goto('/');
 await expect(page.locator('.botnav')).toBeVisible();await page.waitForFunction(()=>!document.getElementById('mc-load'));await dismissNews(page);
 const d=page.locator('.v4-budget');
 const st=await page.evaluate(()=>dashboardBudgetStats(mcLoadRaw('micartera_v3')));
 expect(st.cycle).toBe(true);
 expect(Math.round(st.against*100)).toBe(83300);
 // 833 de 650: el anillo dice lo usado (128 %) y la cifra es el exceso, no «1.217 € lliures».
 await expect(d.locator('.v4-ring .num')).toHaveText('128%');
 await expect(d.locator('.v42-cycle-amount>.serif')).toHaveText(/^183(,00)?\s€$/);
 await expect(d).toContainText('de més');
 await expect(d).not.toContainText('lliures de');
});
