// Las tasas usan tiempo medido: adelantar la fecha del fixture no crea minutos de RAF.
export function recta(points) {
  const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(valid.length<3) return {samples:valid.length,slope:null,delta:null};
  const x=valid.reduce((n,p)=>n+p.x,0)/valid.length;
  const y=valid.reduce((n,p)=>n+p.y,0)/valid.length;
  const den=valid.reduce((n,p)=>n+(p.x-x)**2,0);
  return {samples:valid.length,slope:den?valid.reduce((n,p)=>n+(p.x-x)*(p.y-y),0)/den:null,
    delta:valid.at(-1).y-valid[0].y};
}

export function resumen(samples) {
  const valid=samples.filter(s=>s.valid);
  const elapsed=valid.reduce((n,s)=>n+s.elapsedMs,0);
  const slow=valid.reduce((n,s)=>n+s.slowFrames,0);
  const bytes=valid.reduce((n,s)=>n+s.storageBytes,0);
  const metrics=['domNodes','listeners','timeouts','intervals','heapAfterGC','slowFramesPerMinute','storageBytes'];
  return {cycles:valid.length,rejected:samples.length-valid.length,measuredMs:elapsed,
    slowFramesPerMinute:elapsed>0?slow*60000/elapsed:null,storageBytes:bytes,
    curves:Object.fromEntries(metrics.map(key=>[key,valid.map(s=>({minute:s.measuredMinute,value:s[key]}))])),
    trends:Object.fromEntries(metrics.map(key=>[key,recta(valid.map(s=>({x:s.measuredMinute,y:s[key]})))]))};
}

// Una pendiente positiva aislada no demuestra fuga: el control debe crecer y recuperarse.
export function discrimina(normal,leak,recovered) {
  const a=resumen(normal),b=resumen(leak),c=resumen(recovered);
  const listenerGrowth=b.trends.listeners.delta;
  const retainedGrowth=b.trends.heapAfterGC.delta;
  return {passed:a.rejected===0&&b.rejected===0&&c.rejected===0
      && b.cycles>=3&&c.cycles>=3&&listenerGrowth>=12&&retainedGrowth>0
      && c.trends.listeners.delta<=b.trends.listeners.delta/4
      && c.trends.heapAfterGC.delta<retainedGrowth,
    listenerGrowth,retainedGrowth,normal:a,leak:b,recovered:c};
}

export function atribuciones(samples) {
  const first=samples.find(s=>s.valid),last=samples.findLast(s=>s.valid);
  if(!first||!last) return [];
  const prior=new Map((first.retainedSources||[]).map(s=>[s.source,s.count]));
  return (last.retainedSources||[]).map(s=>({source:s.source,delta:s.count-(prior.get(s.source)||0)}))
    .filter(s=>s.delta>0).sort((a,b)=>b.delta-a.delta||a.source.localeCompare(b.source));
}
