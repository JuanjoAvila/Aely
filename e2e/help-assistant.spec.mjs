import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function open(page,overrides={}){
  await seedLoggedInDashboard(page,{...overrides});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.locator('.aely-help-entry:visible').first().click();
  return page.getByRole("dialog",{name:"Ayuda de Aely"});
}
test("efectivo offline abre el formulario correcto sin guardar ni duplicar dinero",async({page})=>{
  const panel=await open(page,{accounts:[{id:"cash",ent:"efectivo",value:80,role:"diario"},{id:"bank",ent:"sabadell",value:200,role:"diario"}],expenses:[]});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"));
  await page.context().setOffline(true);
  await panel.getByLabel("¿En qué necesitas ayuda?").fill("No sé cómo poner el gasto en efectivo");
  await panel.getByRole("button",{name:"Ver guía",exact:true}).click();
  await expect(panel.locator('[data-help-topic="cash"]')).toContainText("traspaso");
  await expect(panel.getByRole("button",{name:/IA requiere conexión/})).toBeDisabled();
  await panel.getByRole("button",{name:"Apuntar en efectivo",exact:true}).click();
  await expect(page.locator('[data-testid="ap-efectivo"]')).toHaveClass(/on/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]"))).toEqual(before);
});
for(const [topic,button,segment] of [["Ahorrar para una meta","Abrir Metas","Metas"],["Préstamos y cuotas","Abrir Deudas","Deudas"],["Recibos del mes","Abrir Recibos","Recibos"]]){
  test(topic+" abre su segmento real de Plan",async({page})=>{
    const panel=await open(page);
    await panel.getByRole("button",{name:topic,exact:true}).click();
    await panel.getByRole("button",{name:button,exact:true}).click();
    await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour","plan");
    await expect(page.locator('.v4-seg-btn.on')).toContainText(segment);
  });
}
test("modo sencillo dirige a Ajustes sin cambiar preferencias",async({page})=>{
  const panel=await open(page,{settings:{simpleMode:true,autoPrices:false,theme:"green"}});
  await panel.getByRole("button",{name:"Ahorrar para una meta",exact:true}).click();
  await panel.getByRole("button",{name:"Mostrar pantalla desde Ajustes"}).first().click();
  await expect(page.locator('.settings-push')).toHaveClass(/open/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.simpleMode)).toBe(true);
});
test("histórico abre su visor sin solicitar ni importar movimientos",async({page})=>{
  const panel=await open(page,{__cloudRows:{bank_links:[{aspsp_name:"Sabadell",aspsp_country:"ES",status:"active",accounts:[{uid:"synthetic"}]}]}});
  await page.evaluate(()=>{ window.__helpBankCalls=0; cloud.bankSync=async()=>{window.__helpBankCalls++;return {links:[]};}; });
  await panel.getByRole("button",{name:"Importar histórico",exact:true}).click();
  await panel.getByRole("button",{name:"Abrir Importar histórico",exact:true}).click();
  await expect(page.getByRole("button",{name:/Buscar movimientos/})).toBeVisible();
  expect(await page.evaluate(()=>window.__helpBankCalls)).toBe(0);
});
test("pregunta sin coincidencia: la IA elige una guía al pulsar y no ejecuta acciones",async({page})=>{
  const panel=await open(page,{__cloudFns:{"help-assistant":{data:{ok:true,topics:["cash"]},error:null}}});
  await panel.getByLabel("¿En qué necesitas ayuda?").fill("He pagado usando billetes y quiero anotarlo");
  await panel.getByRole("button",{name:"Ver guía",exact:true}).click();
  // Esta frase también puede encontrar una guía local; la consulta remota sigue siendo explícita.
  await expect(panel.getByText(/se envía tu última duda a OpenAI/)).toBeVisible();
  await panel.getByRole("button",{name:"Buscar guía con IA",exact:true}).click();
  await expect(panel.getByRole("status")).toContainText("La IA ha encontrado");
  await expect(panel.locator('[data-help-topic="cash"]')).toBeVisible();
  await expect(page.locator('.v4-sheet')).toHaveCount(0);
});
test("respuesta remota inválida mantiene la guía y permite cerrar con Escape",async({page})=>{
  const panel=await open(page,{__cloudFns:{"help-assistant":{data:{ok:true,topics:["delete_all"]},error:null}}});
  await panel.getByLabel("¿En qué necesitas ayuda?").fill("Cómo gasto efectivo");
  await panel.getByRole("button",{name:"Ver guía",exact:true}).click();
  await panel.getByRole("button",{name:"Buscar guía con IA",exact:true}).click();
  await expect(panel.locator('[data-help-topic="cash"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.aely-help-entry:visible').first()).toBeFocused();
});
for(const status of [404,503]){
  test("IA no disponible ("+status+") conserva la guía local y sus botones",async({page})=>{
    const panel=await open(page,{__cloudFns:{"help-assistant":{data:null,error:{context:{status},message:"synthetic unavailable"}}}});
    await panel.getByLabel("¿En qué necesitas ayuda?").fill("Cómo gasto efectivo");
    await panel.getByRole("button",{name:"Ver guía",exact:true}).click();
    await panel.getByRole("button",{name:"Buscar guía con IA",exact:true}).click();
    await expect(panel.getByRole("status")).toContainText("Puedes seguir usando las guías");
    await expect(panel.locator('[data-help-topic="cash"]')).toBeVisible();
    await expect(panel).not.toContainText("synthetic unavailable");
    await panel.getByRole("button",{name:"Abrir cuentas",exact:true}).click();
    await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour","cartera");
  });
}
