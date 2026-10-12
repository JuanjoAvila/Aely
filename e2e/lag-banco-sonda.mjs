// Se instala antes de la app; no guarda callbacks ni nodos del DOM como referencias fuertes.
export function instalaSonda(sourceMap=[]) {
  const native={add:EventTarget.prototype.addEventListener,remove:EventTarget.prototype.removeEventListener,
    timeout:window.setTimeout,clearTimeout:window.clearTimeout,interval:window.setInterval,
    clearInterval:window.clearInterval,put:Storage.prototype.setItem,raf:window.requestAnimationFrame,
    cancelRaf:window.cancelAnimationFrame,visibility:Object.getOwnPropertyDescriptor(document,'visibilityState'),
    hidden:Object.getOwnPropertyDescriptor(document,'hidden')};
  const listeners=new Map(),timers=new Map(),ids=new WeakMap();
  const sources=new Map(sourceMap.map(s=>[s.startLine,s.file+':'+s.sourceLine]));
  let seq=0;
  const p=window.__lagBanco={active:false,previous:null,elapsedStart:0,frames:0,slowFrames:0,maxFrame:0,
    storageBytes:0,writes:0,expensesWrites:0,visibility:'visible',onceNotAttributed:0,
    timers,listeners,leaks:[],transport:{},bankSync:0,stopped:false,rafId:null};
  const source=function(fn){
    if(fn&&/^(?:e2e|src)\/[\w./-]+:\d+$/.test(fn.__lagSource||'')) return fn.__lagSource;
    const stack=String(new Error().stack||'').split('\n');
    for(const frame of stack){
      const match=frame.match(/https?:\/\/[^\s)]+?\/(?:index\.html)?:(\d+):(\d+)/);
      if(!match) continue;
      const origin=sources.get(Number(match[1]));
      if(origin) return origin;
    }
    return 'unmapped';
  };
  const capture=options=>typeof options==='boolean'?options:!!(options&&options.capture);
  const key=function(target,type,fn,options){
    if((target!==window&&target!==document)||(!fn||typeof fn!=='object'&&typeof fn!=='function')) return null;
    if(!ids.has(fn)) ids.set(fn,++seq);
    return (target===window?'window':'document')+'|'+type+'|'+capture(options)+'|'+ids.get(fn);
  };
  EventTarget.prototype.addEventListener=function(type,fn,options){
    const k=key(this,type,fn,options);
    if(k&&!listeners.has(k)){
      // Los once se retiran sin removeEventListener; CDP los cuenta, el mapa no los atribuye.
      if(options&&options.once) p.onceNotAttributed++;
      else listeners.set(k,{source:source(fn),callback:new WeakRef(fn)});
    }
    return native.add.call(this,type,fn,options);
  };
  EventTarget.prototype.removeEventListener=function(type,fn,options){
    const k=key(this,type,fn,options);if(k) listeners.delete(k);
    return native.remove.call(this,type,fn,options);
  };
  window.setTimeout=function(fn,ms,...args){
    if(typeof fn!=='function') return native.timeout.call(this,fn,ms,...args);
    const origin=source(fn);let id;
    id=native.timeout.call(this,function(...values){timers.delete(id);return fn.apply(this,values);},ms,...args);
    timers.set(id,{kind:'timeout',source:origin});return id;
  };
  window.setInterval=function(fn,ms,...args){
    const id=native.interval.call(this,fn,ms,...args);timers.set(id,{kind:'interval',source:source(fn)});return id;
  };
  window.clearTimeout=function(id){timers.delete(id);return native.clearTimeout.call(this,id);};
  window.clearInterval=function(id){timers.delete(id);return native.clearInterval.call(this,id);};
  Storage.prototype.setItem=function(k,v){
    p.writes++;p.storageBytes+=String(v).length*2;if(k==='micartera_v3_exp')p.expensesWrites++;
    return native.put.call(this,k,v);
  };
  function frame(t){
    if(p.stopped)return;
    if(p.active&&p.previous!==null){const delta=t-p.previous;p.frames++;if(delta>32)p.slowFrames++;p.maxFrame=Math.max(p.maxFrame,delta);}
    p.previous=p.active?t:null;p.rafId=native.raf.call(window,frame);
  }
  p.rafId=native.raf.call(window,frame);
  p.begin=function(){p.previous=null;p.frames=0;p.slowFrames=0;p.maxFrame=0;p.elapsedStart=performance.now();p.active=true;};
  p.end=function(){p.active=false;return {elapsedMs:performance.now()-p.elapsedStart,frames:p.frames,slowFrames:p.slowFrames,maxFrame:p.maxFrame};};
  p.snapshot=function(){
    const counts=new Map();
    for(const [k,r]of listeners){if(!r.callback.deref()){listeners.delete(k);continue;}counts.set(r.source,(counts.get(r.source)||0)+1);}
    for(const r of timers.values())counts.set(r.source,(counts.get(r.source)||0)+1);
    return {timeouts:[...timers.values()].filter(r=>r.kind==='timeout').length,
      intervals:[...timers.values()].filter(r=>r.kind==='interval').length,
      retainedSources:[...counts].map(([source,count])=>({source,count})),
      writes:p.writes,storageBytes:p.storageBytes,expensesWrites:p.expensesWrites,
      onceNotAttributed:p.onceNotAttributed};
  };
  p.restore=function(){
    p.active=false;p.stopped=true;native.cancelRaf.call(window,p.rafId);
    EventTarget.prototype.addEventListener=native.add;EventTarget.prototype.removeEventListener=native.remove;
    window.setTimeout=native.timeout;window.setInterval=native.interval;window.clearTimeout=native.clearTimeout;
    window.clearInterval=native.clearInterval;Storage.prototype.setItem=native.put;
    for(const [name,descriptor]of [['visibilityState',native.visibility],['hidden',native.hidden]]){
      if(descriptor)Object.defineProperty(document,name,descriptor);else delete document[name];
    }
  };
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>p.visibility});
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>p.visibility==='hidden'});
}

// Control de la fuga ya conocida de lifecycle: cada vuelta deja otro callback con datos vivos.
export function inyectaFuga(source) {
  const p=window.__lagBanco;
  for(let i=0;i<4;i++){
    const retained=new Array(16384).fill(i+1);
    const listener=function(){
      window.__lagBancoSink=(window.__lagBancoSink||0)^retained[0];
      const end=performance.now()+1;while(performance.now()<end){}
    };
    listener.__lagSource=source;window.addEventListener('visibilitychange',listener);p.leaks.push(listener);
  }
}

export function retiraFuga() {
  const p=window.__lagBanco;
  for(const listener of p.leaks)window.removeEventListener('visibilitychange',listener);
  p.leaks=[];
}
