import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const sourcePath="android/app/src/main/java/com/micartera/app/WidgetSnapshotArbiter.java";
const source=fs.readFileSync(sourcePath),fixture="tests/fixtures/WidgetUnknownJournalTest.java";
const blob=bytes=>createHash("sha1").update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex");
assert.equal(blob(source),"9ddb3941760e23375c147d267d3677953a6c8c03","candidata exacta PR105; revisión nueva si cambia");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aely-widget-journal-"));
function run(cmd,args,options={}){
  const r=spawnSync(cmd,args,{encoding:"utf8",...options});
  assert.equal(r.status,0,cmd+": "+(r.error||r.stderr||r.stdout));
  return r.stdout;
}
try{
  const javac=spawnSync("javac",["-version"],{encoding:"utf8"});
  const compiler=javac.status===0?{cmd:"javac",args:[]}:{cmd:"java",args:["-m","jdk.compiler/com.sun.tools.javac.Main"]};
  // La contraprueba invierte únicamente el diff congelado. El hash prueba que son los
  // bytes del árbitro base real8e4, no una implementación alternativa del journal.
  const baselineDir=path.join(dir,"baseline"),baselineFile=path.join(baselineDir,sourcePath);
  fs.mkdirSync(path.dirname(baselineFile),{recursive:true});fs.writeFileSync(baselineFile,source);
  run("git",["apply","--reverse","-"],{cwd:baselineDir,input:fs.readFileSync("tests/fixtures/widget-unknown-journal.patch","utf8")});
  assert.equal(blob(fs.readFileSync(baselineFile)),"8e4d634f238464720a87cec5a9a1d141362d0902","base real preservada");
  for(const [label,file,extra] of [["baseline",baselineFile,["baseline"]],["candidate",sourcePath,[]]]){
    const classes=path.join(dir,label+"-classes");fs.mkdirSync(classes);
    run(compiler.cmd,[...compiler.args,"-encoding","UTF-8","-d",classes,file,fixture]);
    if(label==="baseline"){
      const old=spawnSync("java",["-cp",classes,"com.micartera.app.WidgetUnknownJournalTest"],{encoding:"utf8"});
      assert.equal(old.status,1,"el mismo contrato corregido debe ser rojo sobre la fuente anterior");
      assert.match(old.stderr,/ACK exacto recupera/);
      console.log("OLD_RED_EXIT=1; mismo caso ACK indentado, sin cambiar esperados");
    }
    const out=run("java",["-cp",classes,"com.micartera.app.WidgetUnknownJournalTest",...extra]);
    assert.match(out,label==="baseline"?/OLD_RED_CONFIRMED/:/CANDIDATE_PASS/);
    process.stdout.write(out);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
