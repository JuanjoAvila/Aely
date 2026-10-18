import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { betaRevision } from "../scripts/beta-revisions.mjs";
import { logicFunctions, logicData, mutateLogic, mutateData } from "../scripts/beta-source-code.mjs";

const source=fs.readFileSync(new URL("../src/modules/02-ui-shared.js",import.meta.url),"utf8");
const begin=source.indexOf("var _mcBackStack=[];"),end=source.indexOf("/* Pantallas hijas a página completa",begin);
assert.ok(begin>=0&&end>begin,"se carga el controlador y hook reales, sin otra implementación");

function platform(){
  const app="https://aely.test/",route="https://aely.test/previous";
  const entries=[{url:route,state:{route:"previous"}},{url:app,state:{route:"app",keep:[1,2]}}];
  let cursor=1,pushThrows=false,backThrows=false,replaceThrows=false;
  const micro=[],tasks=[],listeners=[],ops=[];
  const location={href:app};
  const history={
    get state(){return structuredClone(entries[cursor].state);},
    pushState(state,title,url){
      if(pushThrows) throw new Error("push blocked");
      entries.splice(cursor+1);entries.push({state:structuredClone(state),url:url?new URL(url,location.href).href:location.href});
      cursor++;location.href=entries[cursor].url;ops.push("push");
    },
    replaceState(state,title,url){
      if(replaceThrows) throw new Error("replace blocked");
      entries[cursor]={state:structuredClone(state),url:url?new URL(url,location.href).href:location.href};
      location.href=entries[cursor].url;ops.push("replace");
    },
    go(delta){
      const destination=cursor+delta;
      if(destination<0||destination>=entries.length) return;
      // El destino se decide al pedir el recorrido; pushState posterior no lo convierte en otro back.
      tasks.push(()=>{cursor=destination;location.href=entries[cursor].url;listeners.forEach(fn=>fn({state:history.state}));});
      ops.push(delta<0?"back":"forward");
    },
    back(){if(backThrows) throw new Error("back blocked");this.go(-1);},
  };
  const hooks=[],effects=[];let hookIndex=0;
  const ctx=vm.createContext({history,location,crypto:{randomUUID:()=>"test-document"},
    window:{addEventListener(name,fn){assert.equal(name,"popstate");listeners.push(fn);}},
    Promise:{resolve:()=>({then:fn=>micro.push(fn)})},
    useRef(initial){const i=hookIndex++;return hooks[i]||(hooks[i]={current:initial});},
    useEffect(setup,deps){const i=hookIndex++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){
      effects[i]={setup,deps,cleanup:old?.cleanup,changed:true};
    }},
  });
  vm.runInContext(source.slice(begin,end),ctx,{filename:"02-ui-shared.js/backclose"});
  const micros=()=>{let budget=100;while(micro.length){assert.ok(budget--,"microtask loop");micro.shift()();}};
  const task=()=>{assert.ok(tasks.length,"history traversal requested");tasks.shift()();micros();};
  const drain=()=>{micros();let budget=100;while(tasks.length){assert.ok(budget--,"history loop");task();}};
  const render=(open,close,key)=>{
    hookIndex=0;ctx.useBackClose(open,close,key);
    // React aplica todas las bajas del lote antes de sus altas; no ejecutamos microtasks entre ellas.
    effects.filter(e=>e?.changed).forEach(e=>e.cleanup?.());
    effects.filter(e=>e?.changed).forEach(e=>{e.cleanup=e.setup();e.changed=false;});
  };
  return {ctx,history,location,entries,ops,micros,task,drain,render,
    failPush:()=>{pushThrows=true;},failBack:()=>{backThrows=true;},failReplace:()=>{replaceThrows=true;},
    count:op=>ops.filter(x=>x===op).length,app,route,base:structuredClone(entries[1].state)};
}

let cases=0;
function check(name,run){run();cases++;console.log("OK "+name);}

check("transferencia del mismo commit reutiliza sólo su entrada y restaura el estado anterior",()=>{
  const p=platform(),old=p.ctx._mcBackAdd(()=>assert.fail("UI no invoca callback"));p.drain();
  p.ctx._mcBackDrop(old);const next=p.ctx._mcBackAdd(()=>{});p.micros();
  assert.equal(p.count("back"),0);assert.equal(p.count("replace"),1);
  assert.equal(p.ctx._mcBackStack.length,1);assert.equal(p.history.state.mcBack.id,next.slot.id);
  assert.deepEqual(next.slot.before,p.base);
  p.ctx._mcBackDrop(next);p.drain();assert.deepEqual(p.history.state,p.base);
  p.history.back();p.drain();assert.equal(p.location.href,p.route);
});

check("un alta durante back pendiente se arma después del pop correspondiente",()=>{
  const p=platform(),old=p.ctx._mcBackAdd(()=>{});p.drain();p.ctx._mcBackDrop(old);p.micros();
  const next=p.ctx._mcBackAdd(()=>{});p.micros();assert.equal(next.slot,null);
  assert.equal(p.count("push"),1);assert.equal(p.ctx._mcIgnorePop,true);
  p.task();assert.equal(p.count("push"),2);assert.equal(p.history.state.mcBack.id,next.slot.id);
  p.ctx._mcBackDrop(next);p.drain();assert.deepEqual(p.history.state,p.base);
});

check("alta pendiente cancelada antes de armar no genera una entrada muerta",()=>{
  const p=platform(),old=p.ctx._mcBackAdd(()=>{});p.drain();p.ctx._mcBackDrop(old);p.micros();
  const next=p.ctx._mcBackAdd(()=>{});p.ctx._mcBackDrop(next);p.drain();
  assert.equal(p.count("push"),1);assert.deepEqual(p.history.state,p.base);
  assert.equal(p.ctx._mcBackStack.length,0);assert.equal(p.ctx._mcIgnorePop,false);
});

check("cierre de padre cubierto no consume al hijo y luego compacta ambos en un único cierre",()=>{
  const p=platform(),parent=p.ctx._mcBackAdd(()=>assert.fail("padre UI"));p.drain();
  const child=p.ctx._mcBackAdd(()=>assert.fail("hijo UI"));p.drain();
  p.ctx._mcBackDrop(parent);p.drain();assert.equal(p.count("back"),0);
  assert.equal(p.history.state.mcBack.id,child.slot.id);
  p.ctx._mcBackDrop(child);p.drain();assert.equal(p.count("back"),2);
  assert.deepEqual(p.history.state,p.base);assert.equal(p.ctx._mcBackStack.length,0);
  p.history.back();p.drain();assert.equal(p.location.href,p.route);
});

check("pop del hijo sobre padre retirado cierra sólo al hijo y salta la entrada muerta",()=>{
  const p=platform();let parentCalls=0,childCalls=0;
  const parent=p.ctx._mcBackAdd(()=>parentCalls++);p.drain();p.ctx._mcBackAdd(()=>childCalls++);p.drain();
  p.ctx._mcBackDrop(parent);p.drain();p.history.back();p.drain();
  assert.equal(parentCalls,0);assert.equal(childCalls,1);assert.deepEqual(p.history.state,p.base);
});

check("hijo y padre vivos reciben un callback cada uno con dos gestos reales",()=>{
  const p=platform();let parentCalls=0,childCalls=0;
  const parent=p.ctx._mcBackAdd(()=>parentCalls++);p.drain();p.ctx._mcBackAdd(()=>childCalls++);p.drain();
  p.history.back();p.drain();assert.equal(childCalls,1);assert.equal(parentCalls,0);
  assert.equal(p.history.state.mcBack.id,parent.slot.id);assert.equal(p.ctx._mcBackStack.length,1);
  p.history.back();p.drain();assert.equal(parentCalls,1);assert.deepEqual(p.history.state,p.base);
});

check("llegar desde ruta externa a una entrada propia no cierra al propietario",()=>{
  const p=platform();let calls=0;const e=p.ctx._mcBackAdd(()=>calls++);p.drain();
  p.history.pushState({external:"kept"},"","/external");p.history.back();p.drain();
  assert.equal(calls,0);assert.equal(p.history.state.mcBack.id,e.slot.id);
  p.ctx._mcBackDrop(e);p.drain();assert.deepEqual(p.history.state,p.base);
});

check("replace externo/null no autoriza un back de cleanup",()=>{
  const p=platform(),e=p.ctx._mcBackAdd(()=>{});p.drain();
  p.history.replaceState(null,"","/external");p.ctx._mcBackDrop(e);p.drain();
  assert.equal(p.count("back"),0);assert.equal(p.history.state,null);assert.equal(p.location.href,"https://aely.test/external");
});

check("pushState fallido nunca solicita back",()=>{
  const p=platform();p.failPush();const e=p.ctx._mcBackAdd(()=>{});p.drain();p.ctx._mcBackDrop(e);p.drain();
  assert.equal(p.count("back"),0);assert.deepEqual(p.history.state,p.base);
});

check("replaceState fallido consume la antigua sin inventar propiedad para la nueva",()=>{
  const p=platform(),e=p.ctx._mcBackAdd(()=>{});p.drain();p.failReplace();p.ctx._mcBackDrop(e);
  const next=p.ctx._mcBackAdd(()=>{});p.drain();assert.equal(next.failed,true);assert.equal(next.slot,null);
  assert.deepEqual(p.history.state,p.base);p.ctx._mcBackDrop(next);p.drain();assert.equal(p.count("back"),1);
});

check("back fallido libera señal y no entra en bucle ni consume otro propietario",()=>{
  const p=platform(),e=p.ctx._mcBackAdd(()=>{});p.drain();p.failBack();p.ctx._mcBackDrop(e);p.drain();
  assert.equal(p.ctx._mcIgnorePop,false);assert.equal(p.ctx._mcBackPending,null);
  assert.equal(p.history.state.mcBack.id,e.slot.id);
});

check("nativo cierra exactamente una vez y consume su entrada web sin cerrar al padre",()=>{
  const p=platform();let childCalls=0,parentCalls=0;
  const parent=p.ctx._mcBackAdd(()=>parentCalls++);p.drain();const child=p.ctx._mcBackAdd(()=>childCalls++);p.drain();
  assert.equal(p.ctx._mcBackCloseNative(),true);assert.equal(child._byPop,false);p.drain();
  assert.equal(childCalls,1);assert.equal(parentCalls,0);assert.equal(p.history.state.mcBack.id,parent.slot.id);
  assert.equal(p.ctx._mcBackCloseNative(),true);p.drain();assert.equal(parentCalls,1);
  assert.equal(p.ctx._mcBackCloseNative(),false);assert.deepEqual(p.history.state,p.base);
});

check("go(-2) cierra sólo arriba y rearma el padre vivo saltado",()=>{
  const p=platform();let parentCalls=0,childCalls=0;
  const parent=p.ctx._mcBackAdd(()=>parentCalls++);p.drain();p.ctx._mcBackAdd(()=>childCalls++);p.drain();
  p.history.go(-2);p.drain();assert.equal(childCalls,1);assert.equal(parentCalls,0);
  assert.equal(p.history.state.mcBack.id,parent.slot.id);assert.deepEqual(parent.slot.before,p.base);
  p.history.back();p.drain();assert.equal(parentCalls,1);assert.deepEqual(p.history.state,p.base);
});

check("forward a una entrada cerrada no resucita callback ni exige doble atrás",()=>{
  const p=platform();let calls=0;p.ctx._mcBackAdd(()=>calls++);p.drain();p.history.back();p.drain();
  p.history.go(1);p.drain();assert.equal(calls,1);assert.deepEqual(p.history.state,p.base);
  p.history.back();p.drain();assert.equal(p.location.href,p.route);
});

check("nuevos push descartan los slots forward truncados sin acumular historial retirado",()=>{
  const p=platform();for(let i=0;i<40;i++){const e=p.ctx._mcBackAdd(()=>{});p.drain();
    p.ctx._mcBackDrop(e);p.drain();assert.equal(p.ctx._mcBackHistory.length,1);}
  assert.equal(p.ctx._mcBackStack.length,0);assert.deepEqual(p.history.state,p.base);
});

check("hook conserva closure inicial y rearma sólo al cambiar identity explícita",()=>{
  const p=platform();let initial=0,later=0;
  p.render(true,()=>initial++,"step2");p.drain();p.render(true,()=>later++,"step2");p.drain();
  p.history.back();p.drain();assert.equal(initial,1);assert.equal(later,0);
  p.render(true,()=>later++,"step1");p.drain();assert.equal(p.ctx._mcBackStack.length,1);
  p.history.back();p.drain();assert.equal(initial,2);assert.equal(later,0);
  p.render(false,()=>later++,null);p.drain();assert.equal(p.count("back"),2);
  p.render(true,()=>later++,"new-open");p.drain();p.history.back();p.drain();assert.equal(later,1);
});

check("diálogo reemplazado usa callback con ref actual y una sola entrada",()=>{
  const p=platform(),ref={current:null};let first=0,second=0;
  ref.current=()=>first++;p.render(true,()=>ref.current(),"first");p.drain();
  ref.current=()=>second++;p.render(true,()=>assert.fail("closure nueva"),"second");p.drain();
  assert.equal(p.count("back"),0);assert.equal(p.count("replace"),1);
  p.history.back();p.drain();assert.equal(first,0);assert.equal(second,1);
  p.render(false,()=>{},null);p.drain();assert.deepEqual(p.history.state,p.base);
});

check("un pop ajeno mientras hay consumo pendiente no cierra otro overlay ni pisotea su estado",()=>{
  const p=platform();let parentCalls=0;const parent=p.ctx._mcBackAdd(()=>parentCalls++);p.drain();
  const child=p.ctx._mcBackAdd(()=>assert.fail("el cleanup UI no invoca cierre"));p.drain();
  // Otra navegación ya pedida llega antes que nuestro recorrido y no coincide con su destino.
  p.history.go(-3);p.ctx._mcBackDrop(child);p.micros();
  assert.equal(p.ctx._mcIgnorePop,true);p.task();
  assert.equal(p.location.href,p.route);assert.deepEqual(p.history.state,{route:"previous"});
  assert.equal(p.ctx._mcBackPending,null);assert.equal(p.ctx._mcIgnorePop,false);assert.equal(parentCalls,0);
  // El recorrido propio aún encolado llega al padre; tampoco le atribuye un cierre al aterrizar.
  p.task();assert.equal(parentCalls,0);assert.equal(p.history.state.mcBack.id,parent.slot.id);
  assert.equal(p.ctx._mcIgnorePop,false);
});

function keyboard(p,props={},viewport={}){
  let blurs=0;
  const vv=Object.assign({height:544,offsetTop:0,scale:1},viewport);
  const el=Object.assign({tagName:"INPUT",type:"text",blur(){blurs++;vv.height=844;}},props);
  p.ctx.document={activeElement:el};p.ctx.window.innerHeight=844;p.ctx.window.visualViewport=vv;
  return {el,vv,blurs:()=>blurs};
}

check("UX13 distingue editor con teclado de foco físico, zoom y controles no editables",()=>{
  for(const [name,props,viewport,visible] of [
    ["texto",{},{},true],["decimal",{type:"number"},{},true],
    ["textarea",{tagName:"TEXTAREA"},{},true],["editable",{tagName:"DIV",isContentEditable:true},{},true],
    ["físico",{},{height:844},false],["barra",{},{height:790},false],
    ["zoom",{},{scale:2},false],["desplazado",{},{offsetTop:300},false],
    ["readonly",{readOnly:true},{},false],["desactivado",{disabled:true},{},false],
    ["sin teclado",{inputMode:"none"},{},false],["checkbox",{type:"checkbox"},{},false],
  ]){
    const p=platform(),k=keyboard(p,props,viewport);
    assert.equal(p.ctx._mcBackCloseNative("peek")===k.el,visible,name+": señal");
    assert.equal(k.blurs(),0,name+": consultar no oculta");
    assert.equal(p.ctx._mcBackCloseNative(),visible,name+": antes de salir sin capas");
    assert.equal(k.blurs(),visible?1:0,name+": cierre teclado");
    assert.equal(p.ctx._mcBackStack.length,0,name+": sin capa ficticia");
  }
});

check("UX13 browser back oculta teclado, rearma hijo y conserva padres e historial real",()=>{
  const p=platform();let parent=0,child=0;
  p.ctx._mcBackAdd(()=>parent++);p.drain();p.ctx._mcBackAdd(()=>child++);p.drain();
  const k=keyboard(p);p.history.back();p.drain();
  assert.equal(k.blurs(),1);assert.equal(parent,0);assert.equal(child,0);
  assert.equal(p.ctx._mcBackStack.length,2);assert.equal(p.location.href,p.app);
  p.history.back();p.drain();assert.equal(child,1);assert.equal(parent,0);
  p.history.back();p.drain();assert.equal(parent,1);assert.deepEqual(p.history.state,p.base);
  p.history.back();p.drain();assert.equal(p.location.href,p.route);
});

check("UX13 go(-2) con teclado recupera las dos capas y no absorbe otro atrás",()=>{
  const p=platform();let parent=0,child=0;
  p.ctx._mcBackAdd(()=>parent++);p.drain();p.ctx._mcBackAdd(()=>child++);p.drain();
  keyboard(p);p.history.go(-2);p.drain();
  assert.equal(parent+child,0);assert.equal(p.ctx._mcBackStack.length,2);
  p.history.back();p.drain();assert.equal(child,1);assert.equal(parent,0);
  p.history.back();p.drain();assert.equal(parent,1);assert.deepEqual(p.history.state,p.base);
  p.history.back();p.drain();assert.equal(p.location.href,p.route);
});

check("todos los helpers/datos del controlador alcanzables por Brókers invalidan su revisión",()=>{
  const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8"),file="src/modules/02-ui-shared.js";
  const scope=JSON.parse(read("scripts/beta-sources.json"))["inc-0310-broker-resultados"];
  const functions=logicFunctions(read,[file]),data=logicData(read,[file]);
  const normalized=source.replace(/\r\n/g,"\n"),start=normalized.indexOf("var _mcBackStack=[];"),stop=normalized.indexOf("/* Pantallas hijas a página completa",start);
  const before=betaRevision("inc-0310-broker-resultados",read);let mutants=0;
  for(const [kind,all] of [["function",functions],["data",data]]){
    const selected=[...all.values()].filter(item=>item.start>=start&&item.start<stop&&item.name!=="_mcBackCloseNative");
    for(const item of selected){
      assert.ok(scope.web.some(s=>s.file===file&&s[kind]===item.name),"dependencia de controlador ausente: "+item.name);
      let changed;try{changed=betaRevision("inc-0310-broker-resultados",f=>f===file?
        (kind==="function"?mutateLogic(read(f),item):mutateData(read(f),item)):read(f));}
      catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code),error.message);changed={web:"abortado"};}
      assert.notEqual(changed.web,before.web,"dependencia sin vigilar: "+item.name);mutants++;
    }
  }
  assert.ok(mutants>=20,"no perder helpers/datos del controlador");
  console.log("  "+mutants+" mutantes UI registrados; no sustituyen los financieros/persistencia de beta-sources");
});

check("estado externo con ciclo/Map/Date conserva contenido y permite reconocer su retorno",()=>{
  const p=platform(),state={route:"app",map:new Map([["id",3]]),date:new Date("2026-10-08T00:00:00Z"),bytes:new Uint8Array([1,2])};
  state.self=state;p.history.replaceState(state,"");let calls=0;p.ctx._mcBackAdd(()=>calls++);p.drain();
  p.history.back();p.drain();assert.equal(calls,1);assert.deepEqual(p.history.state,state);
  assert.equal(p.ctx._mcBackSame({map:new Map([["id",3]])},{map:new Map([["id",4]])}),false);
});

check("unidad110 vigila controlador completo y sus entradas reales de App, Ask y Recibos",()=>{
  const read=f=>fs.readFileSync(new URL("../"+f,import.meta.url),"utf8"),file="src/modules/02-ui-shared.js",id="inc-0810-backclose-handover";
  const scope=JSON.parse(read("scripts/beta-sources.json"))[id],before=betaRevision(id,read).web;
  const normalized=source.replace(/\r\n/g,"\n"),start=normalized.indexOf("var _mcBackStack=[];"),stop=normalized.indexOf("/* Pantallas hijas a página completa",start);
  let mutants=0;
  for(const [kind,all] of [["function",logicFunctions(read,[file])],["data",logicData(read,[file])]])for(const item of all.values()){
    if(item.start<start||item.start>=stop)continue;
    assert.ok(scope.web.some(s=>s.file===file&&s[kind]===item.name),"dependencia110 ausente: "+item.name);
    const changed=betaRevision(id,f=>f===file?(kind==="function"?mutateLogic(read(f),item):mutateData(read(f),item)):read(f)).web;
    assert.notEqual(changed,before,item.name);mutants++;
  }
  assert.equal(mutants,21,"incluye el helper nativo y todos los datos de propiedad");
  for(const [target,from,to] of [
    ["src/modules/11-app-main.js","useBackClose(drawerOpen, function(){ setDrawerOpen(false); });","useBackClose(drawerOpen, function(){ setDrawerOpen(true); });"],
    ["src/modules/11-app-main.js","useBackClose(profileOpen, function(){ setProfileOpen(false); });","useBackClose(profileOpen, function(){ setProfileOpen(true); });"],
    ["src/modules/11-app-main.js","if(_mcBackCloseNative()) return;","if(false) return;"],
    ["src/modules/11-app-main.js","onOpenSettings:function(){ setProfileOpen(false); setDrawerOpen(true); }})","onOpenSettings:function(){ setProfileOpen(false); setDrawerOpen(false); }})"],
    ["src/modules/05-dialogs-inv.js","useBackClose(!!cur,function(){ if(cancelRef.current) cancelRef.current(); },cur);","useBackClose(!!cur,function(){ if(cancelRef.current) cancelRef.current(); });"],
    ["src/modules/14-v4-screens.js","useBackClose(true,function(){ stepBackRef.current(); },step);","useBackClose(true,function(){ stepBackRef.current(); });"],
  ]){
    assert.ok(read(target).includes(from),"mutante de entrada real: "+from);
    let changed;try{changed=betaRevision(id,f=>f===target?read(f).replace(from,to):read(f)).web;}
    catch(error){assert.ok(["BETA_SCOPE_ABSENT","BETA_SCOPE_AMBIGUOUS"].includes(error.code));changed="abortado";}
    assert.notEqual(changed,before,from);mutants++;
  }
  console.log("  "+mutants+" mutantes110 de UI/entradas; guardianes financieros actuales independientes");
});

const askSource=fs.readFileSync(new URL('../src/modules/05-dialogs-inv.js',import.meta.url),'utf8');
function askDone(p,entry,terminal=true){
  const body=askSource.match(/const done=(function\(r\)\{[\s\S]*?\n  \});/);
  assert.ok(body,'se ejecuta done real de AskHost');
  const results=[],cur={terminal,resolve:r=>results.push(r)};
  const transitions=[];
  const ctx=vm.createContext({cur,back:{current:entry},setCur:()=>{},setVal:()=>{},_mcBackDrop:p.ctx._mcBackDrop,mcSandboxTransition:v=>transitions.push(v)});
  return {done:vm.runInContext('('+body[1]+')',ctx),results,transitions};
}

check('INC171001 aceptar terminal espera el pop exacto del Ask y conserva padre vivo',()=>{
  const p=platform(),parent=p.ctx._mcBackAdd(()=>assert.fail('no cierra padre'));p.drain();
  const child=p.ctx._mcBackAdd(()=>{});p.drain();const a=askDone(p,child);
  a.done(true);p.micros();assert.deepEqual(a.results,[],'solicitar back no es acuse');
  assert.deepEqual(a.transitions,[true],'bloquea nube antes de esperar historial');
  assert.equal(p.count('back'),1);p.task();assert.deepEqual(a.results,[true]);
  assert.equal(p.history.state.mcBack.id,parent.slot.id);assert.equal(p.ctx._mcBackStack.length,1);
  p.ctx._mcBackDrop(child);p.drain();assert.deepEqual(a.results,[true],'cleanup repetido no repite transición');
});

check('INC171001 cancelar terminal y Ask normal conservan resolución inmediata',()=>{
  for(const [terminal,result] of [[true,false],[false,true],[false,'texto']]){
    const p=platform(),e=p.ctx._mcBackAdd(()=>{});p.drain();const a=askDone(p,e,terminal);
    a.done(result);assert.deepEqual(a.results,[result]);assert.equal(p.count('back'),0);
    assert.deepEqual(a.transitions,[],'cancelar y Ask normal no abren transición');
    p.ctx._mcBackDrop(e);p.drain();assert.deepEqual(p.history.state,p.base);
  }
});

check('INC171001 entrada ajena no autoriza transición ni consumo de su historial',()=>{
  for(const method of ['pushState','replaceState']){
    const p=platform(),e=p.ctx._mcBackAdd(()=>{});p.drain();p.history[method]({foreign:true},'','/foreign');
    const a=askDone(p,e);a.done(true);p.ctx._mcBackDrop(e);p.drain();
    assert.deepEqual(a.results,[false]);assert.equal(p.count('back'),0);assert.deepEqual(p.history.state,{foreign:true});
    assert.deepEqual(a.transitions,[true,false],'un acuse inválido libera el bloqueo');
  }
});

check('INC171001 pop ajeno durante consumo no da acuse ni lo rescata el pop posterior',()=>{
  const p=platform();p.ctx._mcBackAdd(()=>{});p.drain();const e=p.ctx._mcBackAdd(()=>{});p.drain();
  p.history.go(-3);const a=askDone(p,e);a.done(true);p.micros();p.task();
  assert.deepEqual(a.results,[false]);p.task();assert.deepEqual(a.results,[false]);
});

check('INC171001 fallos de push/back no confirman una transición terminal',()=>{
  for(const fail of ['failPush','failBack']){
    const p=platform();if(fail==='failPush')p.failPush();const e=p.ctx._mcBackAdd(()=>{});p.drain();
    if(fail==='failBack')p.failBack();const a=askDone(p,e);a.done(true);p.drain();
    assert.deepEqual(a.results,[false]);assert.equal(p.ctx._mcBackPending,null);assert.equal(p.ctx._mcIgnorePop,false);
  }
});

check('INC171001 otra alta no sustituye una entrada terminal pendiente de acuse',()=>{
  const p=platform(),e=p.ctx._mcBackAdd(()=>{});p.drain();const a=askDone(p,e);a.done(true);
  const next=p.ctx._mcBackAdd(()=>{});p.micros();assert.equal(p.count('replace'),0);assert.deepEqual(a.results,[]);
  p.task();assert.deepEqual(a.results,[true]);assert.equal(p.history.state.mcBack.id,next.slot.id);
});

console.log(`${cases} contratos del controlador/hook reales preparados y verificados`);
