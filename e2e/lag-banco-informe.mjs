const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

// SVG sin dependencias: sólo dibuja observaciones válidas, nunca ceros inventados para huecos.
export function curvasSVG(report){
  const panels=[['domNodes','Nodos DOM',1],['listeners','Listeners CDP',1],['timeouts','Timeouts vivos',1],
    ['intervals','Intervalos vivos',1],['heapAfterGC','Heap tras GC (MiB)',1/1048576],
    ['slowFramesPerMinute','Frames >32ms / min medido',1],['storageBytes','Bytes UTF-16 / ciclo',1]];
  const phases=[['normal','Base','#0072b2'],['leak','Fuga conocida','#d55e00'],['recovered','Recuperación','#009e73']];
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1050" viewBox="0 0 1200 1050"><rect width="1200" height="1050" fill="white"/><g font-family="sans-serif" fill="#222">';
  svg+='<text x="25" y="30" font-size="20">Banco de uso prolongado · '+xml(report.size)+' gastos sintéticos</text>';
  svg+='<text x="25" y="53" font-size="13">'+xml(report.full?'Campaña prolongada':'SMOKE: no acredita 20–30 minutos')+' · CPU×6 · '+xml(report.sourceSHA||'sin SHA')+'</text>';
  svg+='<text x="25" y="75" font-size="13">'+xml(report.phase==='complete'?'Serie terminada; no acredita móvil':'INCOMPLETO: no emitir conclusión')+'</text>';
  phases.forEach(([,label,color],i)=>{svg+='<line x1="'+(25+i*250)+'" x2="'+(50+i*250)+'" y1="100" y2="100" stroke="'+color+'" stroke-width="3"/><text x="'+(58+i*250)+'" y="105" font-size="13">'+label+'</text>';});
  panels.forEach(([key,label,scale],index)=>{
    const left=30+(index%3)*390,top=140+Math.floor(index/3)*280,w=330,h=200;
    const series=phases.map(([phase,,color])=>({color,points:(report[phase]||[]).filter(s=>s.valid&&Number.isFinite(s.measuredMinute)&&Number.isFinite(s[key]))
      .map(s=>[s.measuredMinute,s[key]*scale])}));
    const points=series.flatMap(s=>s.points),maxX=Math.max(1,...points.map(p=>p[0]));
    let minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    if(!points.length){minY=0;maxY=1;}else if(maxY===minY){minY-=.5;maxY+=.5;}
    const pos=([x,y])=>[left+45+x/maxX*(w-50),top+35+(maxY-y)/(maxY-minY)*(h-40)];
    svg+='<text x="'+left+'" y="'+(top+15)+'" font-size="15">'+xml(label)+'</text>';
    svg+='<path d="M'+(left+45)+' '+(top+35)+'v'+(h-40)+'h'+(w-50)+'" stroke="#aaa" fill="none"/>';
    svg+='<text x="'+left+'" y="'+(top+45)+'" font-size="11">'+maxY.toFixed(1)+'</text><text x="'+left+'" y="'+(top+h)+'" font-size="11">'+minY.toFixed(1)+'</text>';
    svg+='<text x="'+(left+65)+'" y="'+(top+h+22)+'" font-size="11">0 → '+maxX.toFixed(2)+' minutos reales de cada fase</text>';
    for(const s of series)if(s.points.length){svg+='<polyline points="'+s.points.map(p=>pos(p).join(',')).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2"/>';
      for(const p of s.points){const [x,y]=pos(p);svg+='<circle cx="'+x+'" cy="'+y+'" r="2.5" fill="'+s.color+'"/>';}}
    if(!points.length)svg+='<text x="'+(left+100)+'" y="'+(top+110)+'" font-size="13">Sin observaciones</text>';
  });
  svg+='<text x="25" y="1010" font-size="12">GC fuera de las ventanas RAF; cliente y visibilidad simulados. La fuga se añade sólo al control.</text>';
  return svg+'</g></svg>';
}
