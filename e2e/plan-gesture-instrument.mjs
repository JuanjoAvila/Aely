// Acotar la traza evita atribuir al dedo el layout que sucede después del cierre nativo.
// Las duraciones inclusivas de eventos anidados se solapan: nunca son tiempo exclusivo.
export function resumirTrazaGesto(events,{styleProbe=null}={}) {
  const renderer=new Set(events.filter(e=>e.ph==="M"&&e.name==="thread_name"&&e.args?.name==="CrRendererMain")
    .map(e=>e.pid+"/"+e.tid));
  if(!renderer.size)throw new Error("identidad del hilo renderer no encontrada");
  const marks=events.filter(e=>e.name==="TimeStamp"&&
    typeof e.args?.data?.message==="string"&&e.args.data.message.startsWith("plan-causal/"))
    .sort((a,b)=>a.ts-b.ts);
  const markedThreads=new Set(marks.map(e=>e.pid+"/"+e.tid));
  if(markedThreads.size!==1||!renderer.has([...markedThreads][0]))
    throw new Error("marcas de gesto en hilos ambiguos o ajenos al renderer");
  const gestureThread=[...markedThreads][0];
  for(const name of ["start","input-end","end"]){
    if(marks.filter(e=>e.args.data.message==="plan-causal/"+name).length!==1)
      throw new Error("marcas de gesto duplicadas o ausentes");
  }
  const time=name=>marks.find(e=>e.args.data.message==="plan-causal/"+name)?.ts;
  const start=time("start"),inputEnd=time("input-end"),end=time("end");
  const terminal=marks.find(e=>["plan-causal/touchend","plan-causal/touchcancel"].includes(e.args.data.message));
  if(![start,inputEnd,end,terminal?.ts].every(Number.isFinite)||
    !(start<=terminal.ts&&terminal.ts<=inputEnd&&inputEnd<=end))throw new Error("marcas de gesto incompletas o desordenadas");
  const windows={duringTouch:[start,terminal.ts],afterNativeClose:[terminal.ts,end],afterInputEnd:[inputEnd,end]};
  const probeStart=marks.filter(e=>e.args.data.message==="plan-causal/style-probe-start");
  const probeEnd=marks.filter(e=>e.args.data.message==="plan-causal/style-probe-end");
  if(styleProbe===true){
    if(probeStart.length!==1||probeEnd.length!==1||!Number.isFinite(probeStart[0].ts)||
      !Number.isFinite(probeEnd[0].ts)||!(start<probeStart[0].ts&&probeStart[0].ts<probeEnd[0].ts&&
      probeEnd[0].ts<terminal.ts))throw new Error("marcas de sonda de estilo incompletas o desordenadas");
    windows.styleProbe=[probeStart[0].ts,probeEnd[0].ts];
  }else if(probeStart.length||probeEnd.length){
    throw new Error("marcas de sonda de estilo inesperadas sin lectura");
  }
  const totals=Object.fromEntries(Object.keys(windows).map(k=>[k,{}]));
  for(const e of events){
    if(e.ph!=="X"||e.pid+"/"+e.tid!==gestureThread||!Number.isFinite(e.dur)||e.dur<0||
      !["EventDispatch","Layout","UpdateLayoutTree","Paint","RunTask"].includes(e.name))continue;
    for(const [key,[lo,hi]] of Object.entries(windows)){
      const overlap=Math.max(0,Math.min(e.ts+e.dur,hi)-Math.max(e.ts,lo));
      if(!overlap)continue;
      const row=totals[key][e.name]||(totals[key][e.name]={count:0,totalUs:0,maxOverlapUs:0});
      row.count++;row.totalUs+=overlap;row.maxOverlapUs=Math.max(row.maxOverlapUs,overlap);
    }
  }
  return {gestureThread,terminal:terminal.args.data.message.slice("plan-causal/".length),
    durationUs:Object.fromEntries(Object.entries(windows).map(([k,[lo,hi]])=>[k,hi-lo])),totals,
    scope:"complete renderer X events clipped to marked windows; nested durations overlap; afterInputEnd is a subset of afterNativeClose"};
}
