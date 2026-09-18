import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

async function openHelp(page,overrides={}){
  await seedLoggedInDashboard(page,overrides);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  // La sesión existe antes de montar la hoja: HelpHost calcula signedIn al abrirla.
  await page.evaluate(()=>{ window.__mcEmail="persona@example.invalid"; });
  const trigger=page.getByRole("button",{name:"Pregúntame"}).first();
  await trigger.click();
  const dialog=page.getByRole("dialog",{name:"Pregúntame"});
  await expect(dialog).toBeVisible();
  return {dialog,trigger};
}

async function ask(dialog,text){
  await dialog.getByLabel("¿En qué necesitas ayuda?").fill(text);
  await dialog.getByRole("button",{name:"Preguntar",exact:true}).click();
}

test("responde offline con la cifra local y no consulta ningún servicio",async({page})=>{
  const {dialog}=await openHelp(page,{budget:1000,expenses:[]});
  await page.evaluate(()=>{ window.__helpCalls=0; cloud.askHelp=async()=>{ window.__helpCalls++; throw Error("no debe llamarse"); }; });
  await page.context().setOffline(true);
  await ask(dialog,"¿Cuánto me queda este mes?");
  await expect(dialog.getByRole("status")).toContainText(/1000/);
  expect(await page.evaluate(()=>window.__helpCalls)).toBe(0);
});

test("cuenta todos los recibos pendientes y excluye nómina y traspasos",async({page})=>{
  const {dialog}=await openHelp(page,{
    fixed:[
      {id:"f1",name:"Luz",amount:40,freq:"mes",day:28,account:"sabadell"},
      {id:"f2",name:"Internet",amount:60,freq:"mes",day:29,account:"sabadell"},
    ],
    flows:[
      {id:"i1",kind:"income",name:"Nómina",amount:9999,to:"sabadell",day:30},
      {id:"t1",kind:"transfer",name:"Ahorro",amount:500,from:"sabadell",to:"trade_republic",day:30},
    ],
  });
  await ask(dialog,"¿Qué recibos me faltan?");
  await expect(dialog.getByRole("status")).toContainText(/2 recibos.*100/);
});

test("efectivo abre Apuntar con efectivo sin guardar ni duplicar dinero",async({page})=>{
  const {dialog}=await openHelp(page,{accounts:[{id:"cash",ent:"efectivo",value:80,role:"diario"},{id:"bank",ent:"sabadell",value:200,role:"diario"}],expenses:[]});
  const before=await page.evaluate(()=>localStorage.getItem("micartera_v3_exp"));
  await ask(dialog,"¿Cómo apunto una compra en efectivo?");
  await dialog.getByRole("button",{name:"Apuntar en efectivo",exact:true}).click();
  await expect(page.locator('[data-testid="ap-efectivo"]')).toHaveClass(/on/);
  expect(await page.evaluate(()=>localStorage.getItem("micartera_v3_exp"))).toBe(before);
});

for(const [topic,button,segment] of [["Ahorrar para una meta","Abrir Metas","Metas"],["Préstamos y cuotas","Abrir Deudas","Deudas"],["Recibos del mes","Abrir Recibos","Recibos"]]){
  test(topic+" abre su segmento real de Plan sin tocar gestos",async({page})=>{
    const {dialog}=await openHelp(page);
    const cdp=segment==="Metas"?await page.context().newCDPSession(page):null;
    if(cdp) await cdp.send("Emulation.setCPUThrottlingRate",{rate:6});
    await dialog.getByRole("button",{name:topic,exact:true}).click();
    await dialog.getByRole("button",{name:button,exact:true}).click();
    await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour","plan");
    await expect(page.locator('.page-live .v4-seg-btn.on')).toHaveText(segment);
    if(cdp) await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});
  });
}

test("el consentimiento solo envía pregunta e idioma y se recuerda",async({page})=>{
  const {dialog}=await openHelp(page,{settings:{helpAiOk:false,helpAiAsked:false},__cloudFns:{}});
  await page.evaluate(()=>{
    window.__helpPayloads=[];
    cloud.askHelp=async function(q,lang){ window.__helpPayloads.push({q,lang}); return {ok:true,topics:["cash"],cue:"help_cue_cash",intent:null,bank:null,confidence:"high"}; };
  });
  await ask(dialog,"Necesito resolver algo que no sé explicar");
  await dialog.getByRole("button",{name:"Probar con más ayuda"}).click();
  await expect(dialog).toContainText(/OpenAI.*solo la pregunta/i);
  await expect(dialog).toContainText(/Nunca envía saldos ni movimientos/i);
  await dialog.getByRole("button",{name:"Sí",exact:true}).click();
  await expect(dialog.getByRole("status")).toContainText("Sacar del cajero");
  expect(await page.evaluate(()=>window.__helpPayloads)).toEqual([{q:"Necesito resolver algo que no sé explicar",lang:"es"}]);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.helpAiOk)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.helpAiAsked)).toBe(true);
});

test("rechazar el consentimiento no llama a OpenAI y guarda la decisión",async({page})=>{
  const {dialog}=await openHelp(page,{settings:{helpAiOk:false,helpAiAsked:false},__cloudFns:{}});
  await page.evaluate(()=>{ window.__helpCalls=0; cloud.askHelp=async()=>{ window.__helpCalls++; return {}; }; });
  await ask(dialog,"No sé explicar esta duda");
  await dialog.getByRole("button",{name:"Probar con más ayuda"}).click();
  await expect(dialog).toContainText(/OpenAI.*solo la pregunta/i);
  await dialog.getByRole("button",{name:"No, gracias",exact:true}).click();
  expect(await page.evaluate(()=>window.__helpCalls)).toBe(0);
  await expect(dialog.getByRole("button",{name:"Probar con más ayuda"})).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.helpAiOk)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.helpAiAsked)).toBe(true);
});

test("Ajustes revoca OpenAI y volver a activarlo exige consentimiento informado",async({page})=>{
  await seedLoggedInDashboard(page,{settings:{helpAiOk:true,helpAiAsked:true},__cloudFns:{}});
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await expect(page.locator(".settings-push.open")).toBeVisible();
  await page.getByRole("button",{name:/Tu cuenta/i}).click();
  const toggle=page.locator("button.set-row").filter({hasText:/Más ayuda con OpenAI|OpenAI/i});
  await expect(toggle).toBeVisible();
  await expect(page.getByText(/No cambia las respuestas normales/i)).toBeVisible();
  await toggle.click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.helpAiOk)).toBe(false);
  await toggle.click();
  await expect(page.getByText("¿Usar OpenAI para entender esta pregunta?")).toBeVisible();
  await expect(page.getByText(/Nunca envía saldos ni movimientos.*quitar este permiso/i)).toBeVisible();
  await page.getByRole("button",{name:"No, gracias",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3")).settings.helpAiOk)).toBe(false);
});

test("404, 429, 503, timeout y flag OFF avisan sin borrar la ayuda local",async({page})=>{
  const {dialog}=await openHelp(page,{settings:{helpAiOk:true,helpAiAsked:true},__cloudFns:{}});
  await page.evaluate(()=>{
    window.__helpFailure="";
    cloud.askHelp=async function(){
      if(window.__helpFailure==="429") return {ok:false,error:"limited"};
      if(window.__helpFailure==="flag OFF") return {ok:false,error:"unavailable"};
      throw new Error(window.__helpFailure);
    };
  });
  for(const kind of ["404","429","503","timeout","flag OFF"]){
    await page.evaluate(k=>{ window.__helpFailure=k; },kind);
    await ask(dialog,"No sé explicar esta duda");
    await dialog.getByRole("button",{name:"Probar otra vez",exact:true}).click();
    await expect(dialog.getByRole("alert")).toContainText(kind==="429"?/límite temporal/i:/ayuda local sigue disponible/i);
    await expect(dialog.getByRole("button",{name:"Gastar en efectivo",exact:true})).toBeVisible();
  }
});

test("IBAN, tarjeta y claves se frenan antes de la consulta remota",async({page})=>{
  const {dialog}=await openHelp(page,{settings:{helpAiOk:true,helpAiAsked:true},__cloudFns:{}});
  await page.evaluate(()=>{ window.__helpCalls=0; window.__mcEmail="persona@example.invalid"; cloud.askHelp=async()=>{ window.__helpCalls++; return {}; }; });
  for(const secret of ["DE89 3704 0044 0532 0130 00","4111-1111-1111-1111","mi PIN es 1234"]){
    await ask(dialog,secret);
    await expect(dialog.getByRole("status")).toContainText("No escribas números de cuenta ni claves");
  }
  expect(await page.evaluate(()=>window.__helpCalls)).toBe(0);
});

test("el saldo de Sabadell coincide con la fila de Cartera",async({page})=>{
  const accounts=[
    {id:"sb",ent:"sabadell",name:"Sabadell",value:2000,role:"fijos"},
    {id:"rv",ent:"revolut",name:"Revolut",value:50,role:"fijos"},
  ];
  const {dialog}=await openHelp(page,{accounts,expenses:[]});
  await ask(dialog,"¿Cuánto tengo en Sabadell?");
  const phrase=await dialog.getByRole("status").innerText();
  expect(phrase).toMatch(/Sabadell/i);
  expect(phrase).toMatch(/2000|2\.000/);
  await dialog.getByRole("button",{name:"Abrir cuentas",exact:true}).click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour","cartera");
  const wealth=page.locator(".v4-card-list").first();
  await expect(wealth).toContainText("Sabadell");
  const cartera=await page.locator('button.v4-mov[data-account-id="sb"]').innerText();
  expect(cartera).toMatch(/2000|2\.000/);
});

test("los recibos pendientes cuadran con la cifra de Plan → Recibos",async({page})=>{
  const {dialog}=await openHelp(page,{
    accounts:[{id:"sb",ent:"sabadell",name:"Sabadell",value:1000,role:"fijos"}],
    fixed:[
      {id:"f1",name:"Luz",amount:40,freq:"mes",day:28,account:"sabadell"},
      {id:"f2",name:"Internet",amount:60,freq:"mes",day:29,account:"sabadell"},
    ],
    expenses:[],
  });
  await ask(dialog,"¿Qué recibos me faltan?");
  await expect(dialog.getByRole("status")).toContainText(/2 recibos.*100/);
  await dialog.getByRole("button",{name:"Abrir Recibos",exact:true}).click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour","plan");
  await expect(page.locator('.page-live .v4-seg-btn.on')).toHaveText("Recibos");
  await expect(page.locator(".v4-card-hero").filter({hasText:"Queda por pagar"}).last()).toContainText(/100/);
});

test("Escape cierra el diálogo y devuelve el foco al botón",async({page})=>{
  const {dialog,trigger}=await openHelp(page);
  await expect(dialog).toHaveAttribute("aria-modal","true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("añadir efectivo abre Cuentas pero apuntar compras sigue en Apuntar",async({page})=>{
  const {dialog}=await openHelp(page,{accounts:[
    {id:"cash",ent:"efectivo",value:80,role:"diario"},
    {id:"bank",ent:"sabadell",value:200,role:"diario"},
  ],expenses:[]});
  for(const question of ["¿dónde apunto un gasto en efectivo?","where do I record a cash purchase"]){
    await ask(dialog,question);
    await expect(dialog.getByTestId("help-cta")).toHaveText("Apuntar en efectivo");
  }
  for(const question of ["¿dónde puedo añadir efectivo?","on puc afegir efectiu?"]){
    await ask(dialog,question);
    await expect(dialog.getByRole("status")).toContainText(/Cartera/i);
    await expect(dialog.getByTestId("help-cta")).toHaveText("Abrir cuentas");
  }
  await expect(dialog.locator(".aely-help-phrase")).not.toHaveClass(/serif/);
  await dialog.getByTestId("help-cta").click();
  await expect(page.locator('.botnav-tab.active')).toHaveAttribute("data-tour","cartera");
  await expect(page.locator('[data-testid="ap-efectivo"]')).toHaveCount(0);
});

test("el composer queda visible cuando aparece el teclado",async({page})=>{
  const {dialog}=await openHelp(page);
  const input=dialog.getByLabel("¿En qué necesitas ayuda?");
  await expect(input).toBeVisible();
  await expect.poll(()=>input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.evaluate(()=>{
    const vv=window.visualViewport;
    Object.defineProperty(vv,"height",{configurable:true,value:window.innerHeight-260});
    Object.defineProperty(vv,"offsetTop",{configurable:true,value:0});
    vv.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".aely-help-back")).toHaveAttribute("data-help-kb","1");
  await expect(dialog).toHaveCSS("margin-bottom","260px");
  await expect(dialog.locator(".aely-help-composer")).toBeVisible();
});

test("el cierre anima la hoja mientras todavía sigue montada",async({page})=>{
  const {dialog}=await openHelp(page);
  const sawExit=page.waitForFunction(()=>{
    const el=document.querySelector('.v4-sheet[data-sheet="help"]');
    return !!el && (el.style.transform||"").includes("110%");
  },null,{timeout:3000});
  await dialog.locator('[data-act="back"]').click();
  await sawExit;
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveCount(0);
});

test("OpenAI activo explica que no sustituye la guía local",async({page})=>{
  const {dialog}=await openHelp(page,{settings:{helpAiOk:true,helpAiAsked:true}});
  await expect(dialog.getByTestId("help-remote-status")).toContainText(/no cambia/i);
});
