import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
export const BASE_BETA="8dcc5ed39b6e212ba1e34a90b550685794ce0bd5";
export const BASE_MAIN="56c7e328ce801f0e2e2fe5ec1ebd36169f0ac89b";
export const debts=Array.from({length:16},(_,i)=>({id:"d"+i,name:"Préstamo sintético "+i,value:6000+i*900,
  monthly:180+i*12,apr:5.5,account:"e2e",start:"2024-01-15",anchor:8000+i*900}));
export const goals=Array.from({length:16},(_,i)=>({id:"g"+i,name:"Meta sintética "+i,target:3000+i*500,saved:400,emoji:"🎯",account:"e2e"}));
export const fixed=Array.from({length:24},(_,i)=>({id:"f"+i,name:"Recibo sintético "+i,amount:10+i,freq:"mes",day:28,account:"sabadell"}));

// Cada servidor nace en puerto libre y sólo sirve su archivo ensamblado: jamás reutiliza otro checkout.
export async function prepararFuentesPlan(){
  // beta-revisions sólo hace git show de referencias históricas. El archivo no incluye .git;
  // prestar la BD de objetos local para esas lecturas evita inventar identidades del bundle.
  const gitDir=execFileSync("git",["rev-parse","--absolute-git-dir"],{encoding:"utf8"}).trim();
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),"aely-plan-ab-")),servers=[];
  try{
    const sources={};
    for(const [label,sha] of [["beta",BASE_BETA],["candidate",execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()],["main",BASE_MAIN]]){
      const root=path.join(parent,label),archive=path.join(parent,label+".tar");fs.mkdirSync(root);
      execFileSync("git",["cat-file","-e",sha+"^{commit}"]);
      execFileSync("git",["archive","--format=tar","--output="+archive,sha]);execFileSync("tar",["-xf",archive,"-C",root]);
      execFileSync(process.execPath,["scripts/build-app.mjs"],{cwd:root,
        env:{...process.env,SENTRY_DSN:"",GIT_DIR:gitDir,GIT_WORK_TREE:root},stdio:"pipe"});
      const publicDir=path.join(root,"public"),htmlHash=crypto.createHash("sha256").update(fs.readFileSync(path.join(publicDir,"index.html"))).digest("hex");
      const server=http.createServer((req,res)=>{
        let pathname;try{pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);}catch{res.writeHead(400).end();return;}
        const file=path.resolve(publicDir,"."+(pathname==="/"?"/index.html":pathname));
        if(!file.startsWith(publicDir+path.sep)){res.writeHead(403).end();return;}
        const mime={".html":"text/html",".js":"application/javascript",".json":"application/json",".svg":"image/svg+xml",".css":"text/css",".woff2":"font/woff2",".png":"image/png"};
        try{const data=fs.readFileSync(file);res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store","X-Aely-Source":sha,"X-Aely-Html-Sha":htmlHash});res.end(data);}catch{res.writeHead(404).end();}
      });
      await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});servers.push(server);
      sources[label]={label,sha,htmlHash,url:"http://127.0.0.1:"+server.address().port};
    }
    return {sources,close:async()=>{await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));fs.rmSync(parent,{recursive:true,force:true});}};
  }catch(error){await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));fs.rmSync(parent,{recursive:true,force:true});throw error;}
}
export async function dedoPlan(cdp,{x=196,y=430,dy=-190,dx=0,steps=38,interval=32,end="touchEnd"}={}){
  try{await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
    for(let i=1;i<=steps;i++){
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*i/steps,y:y+dy*i/steps}]});
    await new Promise(resolve=>setTimeout(resolve,interval));
  }}finally{await cdp.send("Input.dispatchTouchEvent",{type:end,touchPoints:[]});}
}
export function resumenFramesPlan(frames,startTime,terminalTime){
  if(!Array.isArray(frames)||frames.length<2||!frames.every(Number.isFinite)||
    !Number.isFinite(startTime)||!Number.isFinite(terminalTime)||!(startTime<terminalTime)||
    !frames.every((t,i)=>!i||t>frames[i-1])||frames[0]>startTime||frames.at(-1)<terminalTime)
    throw new Error("frames/bordes nativos incompletos, duplicados o desordenados");
  const rows=frames.slice(1).map((t,i)=>({from:frames[i],to:t,delta:t-frames[i]}));
  const summary=values=>({count:values.length,over32:values.filter(r=>r.delta>32).length,maxMs:values.length?Math.max(...values.map(r=>r.delta)):null,intervals:values});
  return {touchIntersecting:summary(rows.filter(r=>r.from<terminalTime&&r.to>startTime)),duringTouch:summary(rows.filter(r=>r.from>=startTime&&r.to<=terminalTime)),afterNativeClose:summary(rows.filter(r=>r.from>=terminalTime)),
    beforeStart:summary(rows.filter(r=>r.to<=startTime)),crossingStart:rows.filter(r=>r.from<startTime&&r.to>startTime&&r.to<=terminalTime),
    crossingTerminal:rows.filter(r=>r.from>=startTime&&r.from<terminalTime&&r.to>terminalTime),
    crossingWholeGesture:rows.filter(r=>r.from<startTime&&r.to>terminalTime)};
}
export async function finanzasPlanFingerprint(page){
 const value=await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem("micartera_v3"));
  return JSON.stringify({state:s,expenses:localStorage.getItem("micartera_v3_exp")});
 });
 return crypto.createHash("sha256").update(value).digest("hex");
}
// Sólo lo llama el spec con contexto sintético fresco. Se conserva TODO, incluso campos
// desconocidos y _savedAt: diagnosticar una diferencia no permite rebajar el guardián.
export async function finanzasPlanSnapshot(page){
 const snapshot=await page.evaluate(()=>{
  const stateRaw=localStorage.getItem("micartera_v3"),expenses=localStorage.getItem("micartera_v3_exp");
  return {state:JSON.parse(stateRaw),expenses,stateRaw};
 });
 // JSON conserva null y sustitutos Unicode aislados; UTF8 directo puede colapsar cadenas distintas.
 snapshot.stateRawFingerprint=crypto.createHash("sha256").update(JSON.stringify(snapshot.stateRaw)).digest("hex");
 return {...snapshot,fingerprint:crypto.createHash("sha256").update(JSON.stringify({state:snapshot.state,expenses:snapshot.expenses})).digest("hex")};
}
export function deltasFinanzasPlan(before,after){
 const limits={paths:32,nodes:20_000,valueChars:2048},changes=[];let visited=0,truncated=false;
 const value=(exists,v)=>{
  const json=exists?JSON.stringify(v):undefined;
  return {exists,type:!exists?"missing":v===null?"null":Array.isArray(v)?"array":typeof v,
   json:json===undefined?null:json.slice(0,limits.valueChars),truncated:json!==undefined&&json.length>limits.valueChars};
 };
 const record=(pointer,a,b,aExists,bExists)=>{
  if(changes.length>=limits.paths){truncated=true;return;}
  changes.push({pointer,before:value(aExists,a),after:value(bExists,b)});
 };
 const walk=(a,b,pointer,aExists=true,bExists=true)=>{
  if(++visited>limits.nodes||changes.length>=limits.paths){truncated=true;return;}
  if(aExists===bExists&&Object.is(a,b))return;
  if(!aExists||!bExists||a===null||b===null||typeof a!=="object"||typeof b!=="object"||Array.isArray(a)!==Array.isArray(b)){
   record(pointer,a,b,aExists,bExists);return;
  }
  if(Array.isArray(a)&&a.length!==b.length)record(pointer+"/length",a.length,b.length,true,true);
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
   walk(a[key],b[key],pointer+"/"+key.replaceAll("~","~0").replaceAll("/","~1"),Object.hasOwn(a,key),Object.hasOwn(b,key));
   if(truncated)break;
  }
 };
 walk(before.state,after.state,"/state");
 // Se incluyen bytes además de los campos: un reordenamiento también cambia el hash original.
 if(before.stateRaw!==after.stateRaw)record("/stateRaw",before.stateRaw,after.stateRaw,true,true);
 if(before.expenses!==after.expenses){
  record("/expensesRaw",before.expenses,after.expenses,true,true);
  try{walk(JSON.parse(before.expenses),JSON.parse(after.expenses),"/expenses");}catch{ /* Los bytes de JSON no válido siguen registrados. */ }
 }
 return {limits,visited,truncated,changes};
}
