import { test, expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

/* ALTA DE REGLAS DE METAS (INC-0410, rechazo de la 4.26.87).
   El importe se leía con `parseFloat(texto.replace(',','.'))`: «1.200» se guardaba como 1,2 y la
   fila decía «1 € fijos». Un alta que no valía se quedaba muda, y con el ingreso ya repartido el
   editor no contaba que la regla nueva entra en el siguiente. Datos sintéticos; los textos
   esperados están escritos aquí a mano, no salen de la app. */
const textos={
  es:{metas:"Metas",title:"Reservar dinero de tus ingresos",add:"+ Añadir regla",save:"Guardar regla",cancel:"Cancelar",
    miles:"1.200",mixto:"1.200,50",filaMiles:/1200\s€ cada mes/,filaMixto:/1200,50\s€ cada mes/,ambiguo:"1,200",
    errImporte:"Escribe un importe mayor que 0, por ejemplo 1200 o 1200,50.",errPct:"El porcentaje tiene que ser mayor que 0 y como máximo 100.",
    repartido:/^El ingreso del \d{1,2}\/\d{1,2} ya se repartió\. Las reglas que añadas ahora no cambian ese reparto: entran en el siguiente que se detecte\.$/,
    errMeta:"Elige una meta que siga activa.",sinPlan:"Con estas reglas no hay ningún importe que repartir. Revisa las reglas y sus metas.",
    borrar:"Borrar regla",guardarMetas:"Guardar cambios",editar:"Editar metas",eliminar:"Eliminar meta",aviso:/Ingreso detectado: 2100\s€/,pctTipo:"% del presupuesto mensual",mesOk:(x)=>new RegExp("^Este mes: "+x+"\\s€ descontados del presupuesto y aportados a la meta\\.$"),
    sinIngreso:"Ahora mismo no hay ningún ingreso detectado para repartir. Las reglas esperan al siguiente.",
    pendiente:/^Hay un ingreso del \d{1,2}\/\d{1,2} pendiente de repartir: confírmalo en el aviso de arriba\.$/,apply:"Aplicar reparto"},
  en:{metas:"Goals",title:"Reserve money from your income",add:"+ Add rule",save:"Save rule",cancel:"Cancel",
    miles:"1,200",mixto:"1,200.50",filaMiles:/1200\s€ every month/,filaMixto:/1200,50\s€ every month/,ambiguo:"1.200",
    errImporte:"Enter an amount above 0, for example 1200 or 1200.50.",errPct:"The percentage must be above 0 and no more than 100.",
    repartido:/^The income from \d{1,2}\/\d{1,2} has already been split\. Rules you add now don't change that split: they apply to the next one detected\.$/,
    errMeta:"Choose a goal that is still active.",sinPlan:"These rules have no amount to split. Check the rules and their goals.",
    borrar:"Delete rule",guardarMetas:"Save changes",editar:"Edit goals",eliminar:"Delete goal",aviso:/Income detected: 2100\s€/,pctTipo:"% of monthly budget",mesOk:(x)=>new RegExp("^This month: "+x+"\\s€ deducted from the budget and added to the goal\\.$"),
    sinIngreso:"There's no detected income to split right now. Your rules are waiting for the next one.",
    pendiente:/^There's income from \d{1,2}\/\d{1,2} waiting to be split: confirm it in the notice above\.$/,apply:"Apply split"},
  ca:{metas:"Metes",title:"Reservar diners dels teus ingressos",add:"+ Afegir regla",save:"Desar regla",cancel:"Cancel·la",
    miles:"1.200",mixto:"1.200,50",filaMiles:/1200\s€ cada mes/,filaMixto:/1200,50\s€ cada mes/,ambiguo:"1,200",
    errImporte:"Escriu un import més gran que 0, per exemple 1200 o 1200,50.",errPct:"El percentatge ha de ser més gran que 0 i com a màxim 100.",
    repartido:/^L'ingrés del \d{1,2}\/\d{1,2} ja es va repartir\. Les regles que afegeixis ara no canvien aquest repartiment: entren en el següent que es detecti\.$/,
    errMeta:"Tria un objectiu que encara estigui actiu.",sinPlan:"Amb aquestes regles no hi ha cap import per repartir. Revisa les regles i els seus objectius.",
    borrar:"Esborrar regla",guardarMetas:"Desa els canvis",editar:"Edita objectius",eliminar:"Elimina objectiu",aviso:/Ingrés detectat: 2100\s€/,pctTipo:"% del pressupost mensual",mesOk:(x)=>new RegExp("^Aquest mes: "+x+"\\s€ descomptats del pressupost i aportats a l'objectiu\\.$"),
    sinIngreso:"Ara mateix no hi ha cap ingrés detectat per repartir. Les regles esperen el següent.",
    pendiente:/^Hi ha un ingrés del \d{1,2}\/\d{1,2} pendent de repartir: confirma'l a l'avís de dalt\.$/,apply:"Aplicar repartiment"},
};
const goals=[{id:"g1",name:"Reserva A",emoji:"🎯",target:9000,saved:325},{id:"g2",name:"Reserva B",emoji:"🎯",target:9000,saved:50}];
const salary={id:"salary",date:"2026-09-25T12:00:00Z",amount:-2000,merchant:"INGRESO SINTETICO",category:"ingreso",ent:"sabadell",source:"ob:sabadell",status:"BOOK"};
const claveDe=(e)=>e.date.slice(0,10)+"|"+e.amount+"|"+e.merchant;
// Estado de partida: una regla y el ingreso del periodo YA repartido con ella.
function estado(lang,extra){
  return Object.assign({__seedOnce:true,goals,budget:1000,
    expenses:[salary,{id:"purchase",date:"2026-09-26T10:00:00Z",amount:100,merchant:"Compra sintetica",category:"super",ent:"sabadell"}],
    accounts:[{id:"bank",ent:"sabadell",name:"Diaria",value:3000,role:"diario",spendFrom:true}],
    settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],
      reservaRules:[{id:"rA",name:"Regla A",kind:"fixed",value:200,goalId:"g1"}]},
    reservaLog:[{id:"l1",ruleId:"rA",goalId:"g1",name:"Regla A",amount:200,date:salary.date,incomeKey:claveDe(salary)}]},extra||{});
}
test.beforeEach(async({page})=>{
  await page.clock.install({time:new Date("2026-09-28T12:00:00Z")});
});
async function abrirMetas(page,t){
  await expect(page.locator(".botnav")).toBeVisible({timeout:30_000});
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await dismissNews(page);
  await page.locator(".page").evaluateAll(pages=>pages.forEach(el=>{el.scrollTop=0;}));
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await page.getByRole("tab",{name:t.metas,exact:true}).click();
  if(!await page.getByRole("button",{name:t.add,exact:true}).isVisible()) await page.getByText(t.title,{exact:true}).click();
}
async function boot(page,lang,extra){
  await seedLoggedInDashboard(page,estado(lang,extra));
  await page.goto("/");
  await abrirMetas(page,textos[lang]);
  return textos[lang];
}
// Rellena el formulario y pulsa Guardar. Con `noVale` se espera un aviso y el formulario sigue.
async function alta(page,t,name,value,kind,noVale){
  if(!await page.locator(".add-form").count()) await page.getByRole("button",{name:t.add,exact:true}).click();
  const form=page.locator(".add-form").filter({has:page.getByRole("button",{name:t.save,exact:true})});
  await form.locator("input").first().fill(name);
  await form.locator("select").first().selectOption(kind||"fixed");
  await form.locator("input").last().fill(String(value));
  await form.locator("select").last().selectOption("g2");
  await form.getByRole("button",{name:t.save,exact:true}).click();
  // El formulario se cierra cuando la regla aparece en el estado, no en el toque: se espera a eso.
  if(!noVale) await expect(page.locator(".add-form")).toHaveCount(0);
  return form;
}
const disco=(page)=>page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem("micartera_v3"));
  return {reglas:s.settings.reservaRules.map(r=>[r.name,r.kind,r.value,r.goalId]),log:s.reservaLog,goals:s.goals.map(g=>[g.id,g.saved]),
    exp:JSON.parse(localStorage.getItem("micartera_v3_exp")||"[]").map(e=>[e.id,e.amount])};
});
const fila=(page,name)=>page.locator("[data-reserva-rule]").filter({hasText:name});
// En «Editar metas» el nombre de la meta es un campo, no texto: la tarjeta se ancla a su valor.
const tarjetaEditable=(page,nombre)=>page.locator(".v4-goal-card").filter({has:page.locator('input[value="'+nombre+'"]')});
async function eliminarMeta(page,t,nombre){
  const card=tarjetaEditable(page,nombre);
  await expect(card.locator("input").first()).toHaveValue(nombre);
  await card.getByRole("button",{name:t.eliminar,exact:true}).click();
  await expect(tarjetaEditable(page,nombre)).toHaveCount(0);
}

for(const lang of Object.keys(textos)){
  test(`el importe se guarda como se escribe, con miles y céntimos (${lang})`,async({page})=>{
    const t=await boot(page,lang);
    await alta(page,t,"Miles",t.miles);
    await expect(fila(page,"Miles")).toContainText(t.filaMiles);
    await alta(page,t,"Mixto",t.mixto);
    await expect(fila(page,"Mixto")).toContainText(t.filaMixto);
    await alta(page,t,"Porcentaje","12,5".replace(",",lang==="en"?".":","),"pct");
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(4);
    await expect.poll(async()=> (await disco(page)).reglas).toEqual([
      ["Regla A","fixed",200,"g1"],["Miles","fixed",1200,"g2"],["Mixto","fixed",1200.5,"g2"],["Porcentaje","pct",12.5,"g2"]]);
  });

  test(`un alta que no vale no guarda nada y lo dice (${lang})`,async({page})=>{
    const t=await boot(page,lang);
    for(const [value,kind,mensaje] of [["0","fixed",t.errImporte],["","fixed",t.errImporte],["abc","fixed",t.errImporte],["-10","fixed",t.errImporte],
      [t.ambiguo,"fixed",t.errImporte],["1.2.3","fixed",t.errImporte],["150","pct",t.errPct],
      // Céntimos que no caben exactos en un número: antes que guardarlo «aproximado», no se guarda.
      [lang==="en"?"90071992547409.93":"90071992547409,93","fixed",t.errImporte]]){
      const form=await alta(page,t,"No vale",value,kind,true);
      await expect(form.getByRole("alert"),`«${value}» (${kind})`).toHaveText(mensaje);
      await expect(page.locator("[data-reserva-rule]")).toHaveCount(1);
    }
    // Corregir el campo retira el aviso, y un importe válido se guarda.
    const form=page.locator(".add-form");
    await form.locator("select").first().selectOption("fixed");
    await form.locator("input").last().fill("75");
    await expect(form.getByRole("alert")).toHaveCount(0);
    await form.getByRole("button",{name:t.save,exact:true}).click();
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(2);
    await expect.poll(async()=> (await disco(page)).reglas).toEqual([["Regla A","fixed",200,"g1"],["No vale","fixed",75,"g2"]]);
  });

  /* Contrato mensual (decisión del dueño, 4/10): guardar la regla descuenta del presupuesto del
     periodo y aporta a la meta en esa misma escritura, sin ingreso ni confirmación. La regla por
     ingreso que ya había (Regla A) conserva su reparto y su frase. */
  test(`una regla nueva descuenta y aporta al guardarla, una sola vez, y sobrevive a la recarga (${lang})`,async({page})=>{
    const t=await boot(page,lang);
    const antes=await disco(page);
    const linea=page.locator("[data-reserva-estado]");
    await expect(linea).toHaveAttribute("data-reserva-estado","repartido");
    await expect(linea).toHaveText(t.repartido);
    await alta(page,t,"Regla B","100");
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(2);
    // No pide confirmar nada ni toca el ingreso ya repartido; la fila dice lo que se asentó.
    await expect(page.getByRole("button",{name:t.apply,exact:true})).toHaveCount(0);
    await expect(linea).toHaveText(t.repartido);
    const mes=fila(page,"Regla B").locator("[data-reserva-mensual]");
    await expect(mes).toHaveText(t.mesOk("100"));
    await expect(page.locator("[data-reserva-mensual]")).toHaveCount(1);
    const asentado=async()=>{
      const d=await disco(page);
      expect(d.reglas).toEqual([["Regla A","fixed",200,"g1"],["Regla B","fixed",100,"g2"]]);
      expect(d.log.length).toBe(2);
      expect(d.log[0]).toEqual(antes.log[0]);
      // Reloj fijado al 28/9: el mes de Madrid es septiembre.
      expect([d.log[1].amount,d.log[1].goalId,d.log[1].mensual,d.log[1].id===d.log[1].incomeKey,/^mensual\|.+\|2026-09$/.test(d.log[1].id)]).toEqual([100,"g2","2026-09",true,true]);
      expect(d.goals).toEqual([["g1",325],["g2",150]]);
      expect(d.exp).toEqual(antes.exp);
    };
    await expect.poll(async()=> (await disco(page)).log.length).toBe(2);
    await asentado();
    await page.reload();
    await abrirMetas(page,t);
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(2);
    await expect(linea).toHaveText(t.repartido);
    await expect(fila(page,"Regla B").locator("[data-reserva-mensual]")).toHaveText(t.mesOk("100"));
    // Recargar (y el repaso al volver a primer plano) no aporta otra vez.
    await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(700);
    await asentado();
  });

  test(`sin ningún ingreso detectado el editor lo dice (${lang})`,async({page})=>{
    const sinIngreso=await boot(page,lang,{expenses:[],reservaLog:[]});
    await expect(page.locator("[data-reserva-estado]")).toHaveAttribute("data-reserva-estado","sinCobro");
    await expect(page.locator("[data-reserva-estado]")).toHaveText(sinIngreso.sinIngreso);
  });
  test(`un ingreso nuevo reparte solo las reglas por ingreso; la mensual ya aportó al guardarse, con céntimos (${lang})`,async({page})=>{
    const nuevo={id:"salary2",date:"2026-09-27T12:00:00Z",amount:-2100,merchant:"INGRESO SINTETICO",category:"ingreso",ent:"sabadell",source:"ob:sabadell",status:"BOOK"};
    const t=await boot(page,lang,{expenses:[salary,nuevo]});
    await expect(page.locator("[data-reserva-estado]")).toHaveAttribute("data-reserva-estado","pendiente");
    await expect(page.locator("[data-reserva-estado]")).toHaveText(t.pendiente);
    // La tarjeta y el aviso hablan de ingreso: lo detectado no se certifica como nómina.
    await expect(page.locator(".v4-card").filter({has:page.getByRole("button",{name:t.apply,exact:true})})).toContainText(t.aviso);
    await alta(page,t,"Con centimos",t.mixto);
    const aviso=page.locator(".v4-card").filter({has:page.getByRole("button",{name:t.apply,exact:true})});
    await expect(aviso).toContainText("Regla A");
    // La mensual no entra en el reparto del ingreso: cobrarla aquí sería descontarla dos veces.
    await expect(aviso).not.toContainText("Con centimos");
    // El dinero se pinta con formato español en los tres idiomas (así es la app hoy).
    await expect(fila(page,"Con centimos").locator("[data-reserva-mensual]")).toHaveText(t.mesOk("1200,50"));
    await page.getByRole("button",{name:t.apply,exact:true}).click();
    await expect(page.getByRole("button",{name:t.apply,exact:true})).toHaveCount(0);
    await expect(page.locator("[data-reserva-estado]")).toHaveAttribute("data-reserva-estado","repartido");
    await expect.poll(async()=> ((await disco(page)).log||[]).length).toBe(3);
    const d=await disco(page);
    expect(d.log.map(x=>[x.ruleId==="rA"?"rA":"nueva",x.amount,x.ruleId==="rA"?x.incomeKey:x.mensual])).toEqual([
      ["rA",200,claveDe(salary)],["nueva",1200.5,"2026-09"],["rA",200,claveDe(nuevo)]]);
    expect(d.goals).toEqual([["g1",525],["g2",1250.5]]);
    expect(d.exp).toEqual([["salary",-2000],["salary2",-2100]]);
  });

  test(`una meta que deja de valer con el formulario abierto no se guarda, y cancelar lo conserva todo (${lang})`,async({page})=>{
    const t=await boot(page,lang);
    const antes=await disco(page);
    await page.getByRole("button",{name:t.add,exact:true}).click();
    const form=page.locator(".add-form").filter({has:page.getByRole("button",{name:t.save,exact:true})});
    await expect(form.locator("select").first().locator("option").nth(1)).toHaveText(t.pctTipo);
    await form.locator("input").first().fill("Obsoleta");
    await form.locator("input").last().fill("100");
    await form.locator("select").last().selectOption("g2");
    // Con el formulario abierto, la meta elegida se elimina desde la propia pantalla.
    await page.getByRole("button",{name:t.editar,exact:true}).click();
    await eliminarMeta(page,t,"Reserva B");
    await form.getByRole("button",{name:t.save,exact:true}).click();
    await expect(form.getByRole("alert")).toHaveText(t.errMeta);
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(1);
    await form.getByRole("button",{name:t.cancel,exact:true}).click();
    await expect(page.locator(".add-form")).toHaveCount(0);
    await page.waitForTimeout(1500);   // margen del guardado diferido: no debe haber escrito ninguna regla
    const d=await disco(page);
    expect(d.reglas).toEqual(antes.reglas);
    expect(d.log).toEqual(antes.log);
    expect(d.exp).toEqual(antes.exp);
    expect(d.goals).toEqual([["g1",325]]);
  });

  test(`si la meta deja de valer entre el toque y la escritura, el formulario no se cierra callado (${lang})`,async({page})=>{
    // Cada volcado real del estado, en orden: qué reglas y metas se escribieron en disco.
    await page.addInitScript(()=>{
      window.__volcados=[]; const orig=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){
        if(k==="micartera_v3"){ try{ const e=JSON.parse(v); window.__volcados.push({reglas:((e.settings&&e.settings.reservaRules)||[]).map(r=>r.name),metas:(e.goals||[]).map(g=>g.id)}); }catch(err){} }
        return orig.apply(this,arguments);
      };
    });
    const t=await boot(page,lang);
    const antes=await disco(page);
    await page.getByRole("button",{name:t.add,exact:true}).click();
    const form=page.locator(".add-form").filter({has:page.getByRole("button",{name:t.save,exact:true})});
    await form.locator("input").first().fill("Carrera");
    await form.locator("input").last().fill("100");
    await form.locator("select").last().selectOption("g2");
    await page.getByRole("button",{name:t.editar,exact:true}).click();
    /* La eliminación de la meta se encola FUERA de un evento (así React no la pinta todavía) y,
       en la misma tarea, se pulsa Guardar: el toque valida contra la pantalla que aún enseña la
       meta, y la escritura llega cuando ya no existe. Es el hueco entre leer y escribir. */
    const orden=await page.evaluate(([eliminar,guardar])=>{
      window.__volcados.length=0;
      const boton=(txt)=>[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===txt);
      const tarjeta=[...document.querySelectorAll(".v4-goal-card")].find(c=>[...c.querySelectorAll("input")].some(i=>i.value==="Reserva B"));
      const del=[...tarjeta.querySelectorAll("button")].find(b=>b.textContent.trim()===eliminar);
      const props=Object.keys(del).find(k=>k.startsWith("__reactProps$"));
      del[props].onClick();
      const sigueEnPantalla=[...document.querySelectorAll(".v4-goal-card input")].some(i=>i.value==="Reserva B");
      boton(guardar).click();
      return {sigueEnPantalla};
    },[t.eliminar,t.save]);
    expect(orden.sigueEnPantalla,"la meta debía seguir pintada al pulsar Guardar").toBe(true);
    await expect(form.getByRole("alert")).toHaveText(t.errMeta);
    await expect(form.locator("input").first()).toHaveValue("Carrera");
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(1);
    await expect(tarjetaEditable(page,"Reserva A")).toHaveCount(1);
    await page.waitForTimeout(1500);   // margen del guardado diferido
    await expect(form.getByRole("alert")).toHaveText(t.errMeta);
    await form.getByRole("button",{name:t.cancel,exact:true}).click();
    await expect(page.locator(".add-form")).toHaveCount(0);
    // DISCO = PANTALLA. Antes aquí quedaba guardada la regla «Carrera», que la app no tenía:
    // el volcado se apuntaba dentro del updater y se quedaba con un estado que React abandonó.
    const volcados=await page.evaluate(()=>window.__volcados);
    expect(volcados.length,"la eliminación de la meta tenía que guardarse").toBeGreaterThan(0);
    expect(volcados.filter(v=>v.reglas.includes("Carrera")),"ningún volcado puede llevar la regla rechazada").toEqual([]);
    expect(volcados[volcados.length-1]).toEqual({reglas:["Regla A"],metas:["g1"]});
    const d=await disco(page);
    expect(d.reglas).toEqual(antes.reglas);
    expect(d.log).toEqual(antes.log);
    expect(d.exp).toEqual(antes.exp);
    expect(d.goals).toEqual([["g1",325]]);
    // Y tras recargar sin resiembra, lo mismo que se veía: una regla, una meta.
    await page.reload();
    await abrirMetas(page,t);
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(1);
    await expect(fila(page,"Carrera")).toHaveCount(0);
    await expect(page.locator(".v4-goal-card")).toHaveCount(1);
    expect((await disco(page)).reglas).toEqual(antes.reglas);
  });

  /* La misma carrera, pero con la escritura anterior RETENIDA más de un segundo: React pinta la
     regla sobre el estado viejo y la retira cuando por fin aplica la eliminación de la meta. Un
     «ya la vi, la doy por buena» con plazo volvía a dejar la retirada sin avisar. La retención es
     artificial —se sujeta el canal por el que React programa el trabajo no urgente— y no
     sustituye a un móvil. Tampoco es del todo determinista: según lo que React tuviera en
     vuelo, aplica las dos escrituras juntas (sin regla transitoria) o pinta primero la regla.
     Las dos son conductas reales y las dos tienen que acabar igual; el test anota cuál tocó y
     comprueba el estado transitorio solo cuando se da. */
  test(`una regla pintada y luego retirada, por tarde que sea, recupera el borrador con su aviso (${lang})`,async({page})=>{
    await page.addInitScript(()=>{
      const Real=window.MessageChannel; window.__hold=false; window.__held=[];
      window.MessageChannel=function(){
        const ch=new Real(), post=ch.port2.postMessage.bind(ch.port2);
        ch.port2.postMessage=function(m){ if(window.__hold) window.__held.push(function(){ post(m); }); else post(m); };
        return ch;
      };
      window.__release=function(){ window.__hold=false; const q=window.__held; window.__held=[]; q.forEach(function(f){ f(); }); };
    });
    const t=await boot(page,lang);
    const antes=await disco(page);
    await page.getByRole("button",{name:t.add,exact:true}).click();
    const form=page.locator(".add-form").filter({has:page.getByRole("button",{name:t.save,exact:true})});
    await form.locator("input").first().fill("Transitoria");
    await form.locator("input").last().fill("100");
    await form.locator("select").last().selectOption("g2");
    await page.getByRole("button",{name:t.editar,exact:true}).click();
    await page.evaluate(([eliminar,guardar])=>{
      const tarjeta=[...document.querySelectorAll(".v4-goal-card")].find(c=>[...c.querySelectorAll("input")].some(i=>i.value==="Reserva B"));
      const del=[...tarjeta.querySelectorAll("button")].find(b=>b.textContent.trim()===eliminar);
      window.__hold=true;
      del[Object.keys(del).find(k=>k.startsWith("__reactProps$"))].onClick();
      [...document.querySelectorAll("button")].find(b=>b.textContent.trim()===guardar).click();
    },[t.eliminar,t.save]);
    await page.waitForTimeout(300);
    const transitoria=await fila(page,"Transitoria").count();
    test.info().annotations.push({type:"regla-transitoria",description:lang+": "+(transitoria?"sí":"no")});
    console.log("REGLA_TRANSITORIA "+lang+" "+(transitoria?"si":"no"));
    if(transitoria){
      // La regla se ve, el formulario ya se cerró (en el commit) y la meta sigue pintada.
      await expect(page.locator(".add-form")).toHaveCount(0);
      await expect(tarjetaEditable(page,"Reserva B")).toHaveCount(1);
    }
    await page.waitForTimeout(1600);   // bastante más que cualquier plazo «razonable» de confirmación
    if(transitoria){
      await expect(fila(page,"Transitoria")).toHaveCount(1);
      expect(await page.evaluate(()=>window.__held.length),"la escritura anterior debía seguir retenida").toBeGreaterThan(0);
    }
    await page.evaluate(()=>window.__release());
    await expect(tarjetaEditable(page,"Reserva B")).toHaveCount(0);
    await expect(fila(page,"Transitoria")).toHaveCount(0);
    await expect(form.getByRole("alert")).toHaveText(t.errMeta);
    await expect(form.locator("input").first()).toHaveValue("Transitoria");
    await expect(form.locator("input").last()).toHaveValue("100");
    await expect.poll(async()=> (await disco(page)).goals).toEqual([["g1",325]]);
    const d=await disco(page);
    expect(d.reglas).toEqual(antes.reglas);
    expect(d.log).toEqual(antes.log);
    expect(d.exp).toEqual(antes.exp);
  });

  test(`borrar la regla recién creada o cancelar un formulario nuevo no deshace ni reabre nada (${lang})`,async({page})=>{
    const t=await boot(page,lang);
    await alta(page,t,"Queda","100");
    await alta(page,t,"Propia","50");
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(3);
    // Cancelar un formulario nuevo no es deshacer: la regla «Propia», la última creada, sigue.
    await page.getByRole("button",{name:t.add,exact:true}).click();
    await page.locator(".add-form").getByRole("button",{name:t.cancel,exact:true}).click();
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(3);
    await alta(page,t,"Borrada","25");
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(4);
    // Se borra a propósito la última alta y después su meta: no debe reaparecer su borrador.
    await fila(page,"Borrada").getByRole("button",{name:t.borrar,exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:t.borrar,exact:true}).click();
    await expect(page.locator("[data-reserva-rule]")).toHaveCount(3);
    await page.getByRole("button",{name:t.editar,exact:true}).click();
    await eliminarMeta(page,t,"Reserva B");
    await page.waitForTimeout(600);
    await expect(page.locator(".add-form")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect.poll(async()=> (await disco(page)).reglas).toEqual([["Regla A","fixed",200,"g1"],["Queda","fixed",100,"g2"],["Propia","fixed",50,"g2"]]);
  });

  test(`una regla antigua a 0 no reparte y el editor no inventa el motivo (${lang})`,async({page})=>{
    const t=await boot(page,lang,{reservaLog:[],settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],
      reservaRules:[{id:"z",name:"Antigua",kind:"fixed",value:0,goalId:"g1"}]}});
    await expect(page.locator("[data-reserva-estado]")).toHaveAttribute("data-reserva-estado","sinPlan");
    await expect(page.locator("[data-reserva-estado]")).toHaveText(t.sinPlan);
    await expect(page.getByRole("button",{name:t.apply,exact:true})).toHaveCount(0);
    expect((await disco(page)).reglas).toEqual([["Antigua","fixed",0,"g1"]]);
  });

  /* LA ÚLTIMA META. Si se elimina o se cumple con el formulario abierto, ya no queda ninguna
     activa: la tarjeta escondía el formulario y el aviso, y otra vez una regla que no se guarda
     sin que nadie lo diga. No se elige ni se crea otra meta por el usuario. */
  for(const modo of ["eliminada","cumplida"]) for(const conRegla of [false,true]){
    test(`última meta ${modo} con el formulario abierto, ${conRegla?"con":"sin"} regla previa: aviso y borrador a la vista (${lang})`,async({page})=>{
      const previas=conRegla?[{id:"rB",name:"Regla previa",kind:"fixed",value:10,goalId:"g2"}]:[];
      const t=await boot(page,lang,{goals:[goals[1]],expenses:[],reservaLog:[],
        settings:{autoPrices:false,theme:"green",lang,gTotalMode:"split",expenseBanks:["sabadell"],reservaRules:previas}});
      await page.getByRole("button",{name:t.add,exact:true}).click();
      const form=page.locator(".add-form").filter({has:page.getByRole("button",{name:t.save,exact:true})});
      await form.locator("input").first().fill("Ultima");
      await form.locator("input").last().fill("100");
      await form.locator("select").last().selectOption("g2");
      await page.getByRole("button",{name:t.editar,exact:true}).click();
      if(modo==="eliminada") await eliminarMeta(page,t,"Reserva B");
      else{
        const card=tarjetaEditable(page,"Reserva B");
        await card.locator("input.num").first().fill("9000");   // lo ahorrado alcanza el objetivo
        await page.getByRole("button",{name:t.guardarMetas,exact:true}).click();
        await expect.poll(async()=> (await disco(page)).goals).toEqual([["g2",9000]]);
      }
      // El formulario sigue ahí con lo escrito, aunque ya no haya ninguna meta activa.
      await expect(form).toHaveCount(1);
      await expect(form.locator("input").first()).toHaveValue("Ultima");
      await form.getByRole("button",{name:t.save,exact:true}).click();
      await expect(form.getByRole("alert")).toHaveText(t.errMeta);
      await expect(form.locator("input").last()).toHaveValue("100");
      await expect(page.locator("[data-reserva-rule]")).toHaveCount(previas.length);
      await form.getByRole("button",{name:t.cancel,exact:true}).click();
      await expect(page.locator(".add-form")).toHaveCount(0);
      // Sin metas activas ni reglas ya no hay nada que configurar; con una regla previa, la tarjeta sigue.
      await expect(page.locator(".card").filter({hasText:t.title})).toHaveCount(conRegla?1:0);
      if(conRegla) await expect(fila(page,"Regla previa")).toHaveCount(1);
      await page.waitForTimeout(700);   // margen del guardado diferido
      const d=await disco(page);
      expect(d.reglas).toEqual(previas.map(r=>[r.name,r.kind,r.value,r.goalId]));
      expect(d.goals).toEqual(modo==="eliminada"?[]:[["g2",9000]]);
      expect(d.log||[]).toEqual([]);
      expect(d.exp).toEqual([]);
    });
  }
}
