/* UX08: cadena real de scroll y posición al volver. La ola dibujada por Android
   se acepta en el dispositivo; estos oráculos solo establecen sus condiciones web. */
import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {seedLoggedInDashboard,installFixtureClock,dismissNews} from './fixtures.mjs';
const hub='[data-bills-manage]', child=hub+' > .settings-push', plan='.page.page-scroll-host';
const raw=page=>page.evaluate(()=>({main:localStorage.getItem('micartera_v3'),expenses:localStorage.getItem('micartera_v3_exp')}));
async function snap(page){return page.evaluate(({hub,child,plan})=>{
  const metric=el=>{if(!el)return null;const c=getComputedStyle(el),r=el.getBoundingClientRect();return {tag:el.tagName,cls:el.className,top:r.top,left:r.left,width:r.width,height:r.height,scroll:el.scrollTop,max:el.scrollHeight-el.clientHeight,overflow:c.overflow,overscroll:c.overscrollBehaviorY,touch:c.touchAction,transform:c.transform,willChange:c.willChange};};
  return {plan:metric(document.querySelector(plan)),anchor:metric(document.querySelector('.v4-screen > [data-seg="recibos"]')),hub:metric(document.querySelector(hub)),child:metric(document.querySelector(child)),sheet:metric(document.querySelector('[data-sheet="bill"],[data-sheet="bill-add"]')),root:metric(document.scrollingElement),body:metric(document.body),app:metric(document.querySelector('.app')),htmlClasses:document.documentElement.className};
},{hub,child,plan});}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>{let last='',same=0,n=0;function tick(){const els=[document.scrollingElement,...document.querySelectorAll('.page-scroll-host,[data-bills-manage],.v4-bills-push,.v4-sheet')];const now=els.map(e=>e.scrollTop+':'+e.getBoundingClientRect().y).join(',');same=now===last?same+1:0;last=now;if(same>=12||++n>180)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));}
async function swipe(page,x,y,dx,dy,end='touchEnd'){
  const c=await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=12;i++){await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/12,y:y+dy*i/12}]});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
  await c.send('Input.dispatchTouchEvent',{type:end,touchPoints:[]});await c.detach();await settle(page);
}
async function begin(page,info,many=false){
  const origin=new URL(info.project.use.baseURL).origin;
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  await installFixtureClock(page);
  await seedLoggedInDashboard(page,{accounts:[{id:'sab',ent:'sabadell',name:'Cuenta sintética',value:2000,role:'fijos'}],fixed:Array.from({length:32},(_,i)=>({id:'wave-'+i,name:'Recibo sintético '+String(i+1).padStart(2,'0'),amount:(1234+i)/100,freq:'mes',account:'sabadell',day:27})),debts:Array.from({length:many?14:1},(_,i)=>({id:'debt-'+i,name:'Cuota sintética '+i,monthly:50,value:1000,anchor:1000,account:'sabadell',day:27})),flows:Array.from({length:many?14:1},(_,i)=>({id:'income-'+i,name:'Ingreso sintético '+i,amount:1800,kind:'income',to:'sabadell',when:'last'})),oneoffs:Array.from({length:many?14:1},(_,i)=>({id:'once-'+i,name:'Puntual sintético '+i,amount:25,month:9,year:2026,account:'sabadell'})),settings:{autoPrices:false,theme:'green',lang:'es'}});
  const response=await page.goto('/'),htmlSHA=crypto.createHash('sha256').update(await response.body()).digest('hex');
  if(process.env.WAVE_EXPECTED_HTML)expect(htmlSHA).toBe(process.env.WAVE_EXPECTED_HTML);
  await info.attach('served.json',{body:JSON.stringify({htmlSHA,CPU6:false,trace:false}),contentType:'application/json'});
  await page.waitForFunction(()=>!document.getElementById('mc-load')&&document.querySelector('.botnav'));
  await dismissNews(page);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('micartera_v3')||'{}').lastBackup==='2026-09-26',null,{timeout:15000});
  await page.locator('.botnav-tab[data-tour="plan"]').tap();await expect(page.locator(plan)).toBeVisible();await settle(page);
  await page.evaluate(()=>{window.__waveEvents=[];for(const type of ['scroll','touchstart','touchmove','touchend','touchcancel','focusin'])document.addEventListener(type,e=>{const el=e.target;queueMicrotask(()=>window.__waveEvents.push({type,target:el.className||el.tagName,scroll:el.scrollTop,prevented:e.defaultPrevented,t:performance.now()}));},{capture:true,passive:true});});
}
async function record(page,info,run){const before=await raw(page);const phases=[];const capture=async name=>{const s=await snap(page);phases.push({name,...s});return s;};try{await run(capture);}finally{const after=await raw(page);await info.attach('observations.json',{body:JSON.stringify({phases,events:await page.evaluate(()=>window.__waveEvents),before,after,financialExact:JSON.stringify(before)===JSON.stringify(after)},null,2),contentType:'application/json'});expect(after).toEqual(before);}}
async function manage(page){await page.locator('.v4-screen > [data-seg="recibos"] button.link').filter({hasText:/^Gestionar$/}).tap();await expect(page.locator(hub)).toBeVisible();await settle(page);}

test('native wave: categoría conserva un solo dueño del scroll en ambos bordes',async({page},info)=>{
  await begin(page,info);await record(page,info,async capture=>{
    await capture('restPlan');await manage(page);await capture('manage');
    await swipe(page,220,580,0,-380);await capture('hub-scrolled');
    await page.locator(hub+' button[data-group="serv"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);
    const opened=await capture('category-open');
    for(let i=0;i<7;i++)await swipe(page,220,600,0,-450);
    const bottom=await capture('category-bottom');
    await swipe(page,220,600,0,-450);const beyond=await capture('category-beyond-bottom');
    expect(bottom.child.scroll).toBeGreaterThan(0);expect(beyond.child.scroll).toBeCloseTo(beyond.child.max,0);
    expect(beyond.hub.scroll,'el gesto al fondo no debe mover la pantalla que queda detrás').toBe(opened.hub.scroll);
    expect(beyond.root.scroll).toBe(0);expect(beyond.child.overscroll).toBe('auto');
    for(let i=0;i<7;i++)await swipe(page,220,180,0,450);
    await swipe(page,220,180,0,450);const top=await capture('category-beyond-top');
    expect(top.child.scroll).toBe(0);expect(top.hub.scroll,'el borde superior pertenece a la hija, sin desplazar el hub').toBe(opened.hub.scroll);
  });
});
test('close jump: volver conserva scroll y anclas de Plan desde Gestionar desplazado',async({page},info)=>{
  await begin(page,info);await record(page,info,async capture=>{
    // Desplazamiento pequeño: Gestionar sigue visible y el tap no necesita scrollIntoView.
    await swipe(page,220,500,0,-80);const before=await capture('plan-before-open');
    await manage(page);await swipe(page,220,580,0,-380);await capture('manage-scrolled');
    await page.evaluate(()=>{window.__closeFrames=[];window.__closeRecording=true;function frame(){const p=document.querySelector('.page-scroll-host'),a=document.querySelector('.v4-screen > [data-seg="recibos"]');window.__closeFrames.push({t:performance.now(),scroll:p?.scrollTop,y:a?.getBoundingClientRect().y,root:document.scrollingElement.scrollTop});if(window.__closeRecording)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    await page.keyboard.press('Escape');await expect(page.locator(hub)).toHaveCount(0);await settle(page);
    const after=await capture('plan-after-close');const frames=await page.evaluate(()=>{window.__closeRecording=false;return window.__closeFrames;});await info.attach('close-frames.json',{body:JSON.stringify(frames),contentType:'application/json'});
    expect(before.plan.scroll).toBeGreaterThan(0);expect(after.plan.scroll).toBe(before.plan.scroll);expect(after.anchor.top).toBeCloseTo(before.anchor.top,0);
    expect(frames.every(f=>Math.abs(f.scroll-before.plan.scroll)<1&&Math.abs(f.y-before.anchor.top)<1)).toBe(true);
  });
});
test('native wave: ficha permite el gesto vertical en el borde superior del contenido',async({page},info)=>{
  await begin(page,info);await record(page,info,async capture=>{
    await manage(page);await page.locator(hub+' button[data-group="serv"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);
    await page.locator(child+' .v4-bills-row').first().tap();await expect(page.locator('[data-sheet="bill"]')).toBeVisible();await settle(page);await capture('sheet-open');
    await swipe(page,300,400,0,100,'touchCancel');await capture('sheet-after-cancel');
    const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:400}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:300,y:450}]});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
    const during=await capture('sheet-top-edge-during');await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await c.detach();await settle(page);
    expect(during.sheet.scroll).toBe(0);expect(during.sheet.transform,'el contenido al borde debe dejar el movimiento vertical al navegador').toBe('none');
    // El candado compartido usa pan-x pan-y: permite scroll nativo en ambos ejes.
    expect(during.sheet.willChange).toBe('auto');expect(during.sheet.overscroll).toBe('auto');expect(during.sheet.touch).toMatch(/auto|pan-y/);
    for(let i=0;i<3;i++)await swipe(page,300,600,0,-350);
    const bottom=await capture('sheet-bottom');expect(bottom.sheet.scroll).toBe(bottom.sheet.max);
    for(let i=0;i<3;i++)await swipe(page,300,250,0,350);
    const top=await capture('sheet-top');expect(top.sheet.scroll).toBe(0);expect(top.sheet.transform).toBe('none');
    const handle=await page.locator('[data-sheet="bill"] .v4-sheet-handle').boundingBox();
    await swipe(page,handle.x+handle.width/2,handle.y+handle.height/2,0,130);
    await expect(page.locator('[data-sheet="bill"]')).toHaveCount(0);
  });
});
test('close jump: ficha desplazada vuelve a la misma categoría y Plan',async({page},info)=>{
  await begin(page,info);await record(page,info,async capture=>{
    await manage(page);await swipe(page,220,580,0,-380);await page.locator(hub+' button[data-group="serv"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);
    await swipe(page,220,600,0,-400);const before=await capture('category-before-detail');
    // Elegir una fila realmente visible sin desplazamiento de Playwright al enfocarla.
    const idx=await page.locator(child+' .v4-bills-row').evaluateAll(els=>els.findIndex(e=>{const r=e.getBoundingClientRect();return r.top>180&&r.bottom<600;}));expect(idx).toBeGreaterThanOrEqual(0);
    await page.locator(child+' .v4-bills-row').nth(idx).tap();await expect(page.locator('[data-sheet="bill"]')).toBeVisible();await settle(page);
    await swipe(page,300,600,0,-350);const scrolled=await capture('detail-scrolled');expect(scrolled.sheet.scroll).toBeGreaterThan(0);
    await page.keyboard.press('Escape');await expect(page.locator('[data-sheet="bill"]')).toHaveCount(0);await settle(page);const after=await capture('category-return');
    expect(after.child.scroll).toBe(before.child.scroll);expect(after.hub.scroll).toBe(before.hub.scroll);expect(after.plan.scroll).toBe(before.plan.scroll);expect(after.anchor.top).toBeCloseTo(before.anchor.top,0);
  });
});
test('close jump: cancelar un segundo toque no devuelve la ficha que ya está saliendo',async({page},info)=>{
  await begin(page,info);await record(page,info,async capture=>{
    await manage(page);await page.locator(hub+' button[data-group="serv"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);
    await page.locator(child+' .v4-bills-row').first().tap();await expect(page.locator('[data-sheet="bill"]')).toBeVisible();await settle(page);
    await swipe(page,300,600,0,-350);const before=await capture('scrolled-before-close');expect(before.sheet.scroll).toBeGreaterThan(0);
    await page.evaluate(()=>{window.__exitFrames=[];function frame(){const s=document.querySelector('[data-sheet="bill"]'),p=document.querySelector('.page-scroll-host'),a=document.querySelector('.v4-screen > [data-seg="recibos"]');window.__exitFrames.push({t:performance.now(),y:s?.getBoundingClientRect().y,scroll:s?.scrollTop,transform:s?.style.transform,plan:p.scrollTop,anchor:a.getBoundingClientRect().y});if(s)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    const c=await page.context().newCDPSession(page);await page.touchscreen.tap(200,30);
    await page.waitForFunction(top=>document.querySelector('[data-sheet="bill"]').getBoundingClientRect().top>top+25,before.sheet.top);
    const exiting=await capture('exiting-before-cancel');
    const y=700;
    await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:220,y}]});
    await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await c.detach();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const after=await capture('exiting-after-cancel');
    await expect(page.locator('[data-sheet="bill"]')).toHaveCount(0);await settle(page);const final=await capture('closed');
    const frames=await page.evaluate(()=>window.__exitFrames);await info.attach('exit-frames.json',{body:JSON.stringify(frames),contentType:'application/json'});
    expect(frames.every((f,i)=>!i||f.y===undefined||f.y>=frames[i-1].y-1),'la ficha no debe retroceder en ningún frame de salida').toBe(true);
    expect(frames.every(f=>f.plan===before.plan.scroll&&Math.abs(f.anchor-before.anchor.top)<1)).toBe(true);
    expect(after.sheet?.top??740,'cancelar un toque nuevo no debe invertir la salida que ya comenzó').toBeGreaterThanOrEqual(exiting.sheet.top-1);
    expect(final.plan.scroll).toBe(before.plan.scroll);expect(final.anchor.top).toBeCloseTo(before.anchor.top,0);
  });
});
test('native wave: alta desplazable conserva el formulario, los bordes y el regreso',async({page},info)=>{
  await page.setViewportSize({width:393,height:500});await begin(page,info);await record(page,info,async capture=>{
    await manage(page);await page.locator(hub+' button[data-group="serv"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);
    const before=await capture('category-before-add');await page.locator(child+' [data-act="bill-add"]').tap();
    const add=page.locator('[data-sheet="bill-add"]');await expect(add).toBeVisible();await add.locator('input').fill('Borrador sintético');await add.locator('[data-act="next"]').tap();await expect(add).toHaveAttribute('data-step','amount');await settle(page);
    const opened=await capture('add-amount');expect(opened.sheet.max).toBeGreaterThan(0);
    await swipe(page,360,450,0,-250);await swipe(page,360,450,0,-250);const bottom=await capture('add-bottom');expect(bottom.sheet.scroll).toBe(bottom.sheet.max);
    await swipe(page,360,160,0,250);await swipe(page,360,160,0,250);const top=await capture('add-top');expect(top.sheet.scroll).toBe(0);expect(top.sheet.transform).toBe('none');expect(top.sheet.willChange).toBe('auto');
    const c=await page.context().newCDPSession(page);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:360,y:200}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:360,y:240}]});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));const edge=await capture('add-top-edge');await c.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await c.detach();expect(edge.sheet.transform).toBe('none');
    await page.goBack();await expect(add).toHaveAttribute('data-step','what');await expect(add.locator('input')).toHaveValue('Borrador sintético');await page.goBack();await expect(add).toHaveCount(0);await settle(page);const returned=await capture('add-return');
    expect(returned.child.scroll).toBe(before.child.scroll);expect(returned.plan.scroll).toBe(before.plan.scroll);
    await page.goBack();await expect(page.locator(child)).toHaveCount(0);await page.goBack();await expect(page.locator(hub)).toHaveCount(0);
  });
});
for(const group of ['debt','in','once'])test('native wave: inventario y regreso del grupo '+group,async({page},info)=>{
  await page.setViewportSize({width:393,height:500});await begin(page,info,true);await record(page,info,async capture=>{
    await manage(page);await swipe(page,220,430,0,-250);const before=await capture('hub-before-group');await page.locator(hub+' button[data-group="'+group+'"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);
    const opened=await capture('group-open');expect(opened.child.overflow).toBe('auto');expect(opened.child.overscroll).toBe('auto');expect(opened.child.touch).toBe('auto');expect(opened.child.transform).toBe('none');expect(opened.child.top).toBe(0);
    expect(opened.child.max).toBeGreaterThan(200);
    for(let i=0;i<6;i++)await swipe(page,300,440,0,-320);const bottom=await capture('group-bottom');expect(bottom.child.scroll).toBe(bottom.child.max);
    for(let i=0;i<6;i++)await swipe(page,300,130,0,320);const top=await capture('group-top');expect(top.child.scroll).toBe(0);
    await page.goBack();await expect(page.locator(child)).toHaveCount(0);await settle(page);const after=await capture('group-return');expect(after.hub.scroll).toBe(before.hub.scroll);expect(after.plan.scroll).toBe(before.plan.scroll);
  });
});
test('native wave: cancelar Atrás lateral de la ficha limpia la capa al reposar',async({page},info)=>{
  await begin(page,info);await record(page,info,async capture=>{
    await manage(page);await page.locator(hub+' button[data-group="serv"]').tap();await expect(page.locator(child)).toBeVisible();await settle(page);await page.locator(child+' .v4-bills-row').first().tap();await expect(page.locator('[data-sheet="bill"]')).toBeVisible();await settle(page);
    const back=page.locator('.v4-sheet-back').filter({has:page.locator('[data-sheet="bill"]')});
    await swipe(page,160,400,65,0,'touchCancel');
    await expect.poll(()=>back.evaluate(e=>getComputedStyle(e).transform)).toBe('none');await capture('lateral-cancel-rest');
    await swipe(page,140,400,210,0);await expect(page.locator('[data-sheet="bill"]')).toHaveCount(0);await expect(page.locator(child)).toBeVisible();
  });
});
test('native wave: simulador conserva geometría y vuelve un nivel',async({page},info)=>{
  await page.setViewportSize({width:393,height:500});await begin(page,info);await record(page,info,async capture=>{
    await manage(page);await page.locator(hub+' .v4-bills-afford').tap();await expect(page.locator(child)).toBeVisible();await settle(page);const before=await capture('afford-open');
    await swipe(page,365,440,0,-270);const bottom=await capture('afford-scrolled');expect(bottom.child.scroll).toBeGreaterThan(0);expect(bottom.child.overscroll).toBe('auto');expect(bottom.child.transform).toBe('none');
    await swipe(page,365,130,0,270,'touchCancel');await page.goBack();await expect(page.locator(child)).toHaveCount(0);await settle(page);const after=await capture('afford-return');expect(after.plan.scroll).toBe(before.plan.scroll);expect(after.hub.scroll).toBe(before.hub.scroll);
  });
});
