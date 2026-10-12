#!/usr/bin/env node
// R20: el lector real debe distinguir indentación recuperable de una identidad perdida.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Permite el mismo oráculo contra una fuente base archivada, sin editar sus métodos.
const sourceArg=process.argv.find(a=>a.startsWith('--native-dir='));
const native=sourceArg?path.resolve(sourceArg.slice('--native-dir='.length)):path.join(root,'android/app/src/main/java/com/micartera/app');
const widget=fs.readFileSync(path.join(native,'MiCarteraWidget.java'),'utf8');
const start=widget.indexOf('    private static WidgetSnapshotArbiter.State read('),end=widget.indexOf('    static synchronized long beginIngest(');
assert.ok(start>=0&&end>start,'lectura/escritura reales delimitadas');
const readWrite=widget.slice(start,end);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-unknown-journal-'));
try {
  const src=path.join(dir,'WidgetUnknownJournalTest.java');
  fs.writeFileSync(src,`package com.micartera.app;
import java.util.*;
public class WidgetUnknownJournalTest {
  static class SharedPreferences {
    final Map<String,Object> values=new HashMap<>();
    boolean contains(String k){return values.containsKey(k);}
    long getLong(String k,long d){return contains(k)?(Long)values.get(k):d;}
    float getFloat(String k,float d){return contains(k)?(Float)values.get(k):d;}
    boolean getBoolean(String k,boolean d){return contains(k)?(Boolean)values.get(k):d;}
    String getString(String k,String d){return contains(k)?(String)values.get(k):d;}
    Editor edit(){return new Editor(this);}
    static class Editor {
      final SharedPreferences p; Editor(SharedPreferences p){this.p=p;}
      Editor putLong(String k,long v){p.values.put(k,v);return this;}
      Editor putFloat(String k,float v){p.values.put(k,v);return this;}
      Editor putBoolean(String k,boolean v){p.values.put(k,v);return this;}
      Editor putString(String k,String v){p.values.put(k,v);return this;}
      Editor remove(String k){p.values.remove(k);return this;}
    }
  }
${readWrite}
  static void ok(boolean v,String why){if(!v)throw new AssertionError(why);}
  static boolean photo(WidgetSnapshotArbiter.State s,String ack,String deleted){
    return WidgetSnapshotArbiter.app(s,1,40,100,60.0,150.0,200.0,"trade_republic","Cuenta",ack,deleted);
  }
  static void lossProbe(){
    SharedPreferences disk=new SharedPreferences();
    WidgetSnapshotArbiter.State s=new WidgetSnapshotArbiter.State(); ok(photo(s,"",""),"foto inicial pérdida");
    String retained=new String(new char[262140]).replace('\\0','r');
    s.unknownJournal=retained+"\\tK\\n"; s.unknownPending=true;
    ok(WidgetSnapshotArbiter.pendingUnknown(s,"lost","lostKey"),"pago nuevo fuera del límite");
    ok(!s.unknownJournal.contains("lost"),"identidad realmente no retenida");
    write(disk.edit(),s); s=read(disk);
    ok(photo(s,"|"+retained+"|",""),"ACK sólo de identidad retenida");
    ok(s.unknownJournal.isEmpty(),"identidad retenida cubierta");
    ok(s.unknownPending,"pérdida de identidad no cubierta por ACK retenido");
    write(disk.edit(),s); s=read(disk);
    ok(s.unknownPending&&disk.getBoolean("unknownLoss",false),"pérdida durable después de read/write");
    System.out.println("  PASS: perder una identidad no se concilia con ACK sólo del registro retenido");
  }
  public static void main(String[] args){
    if(args.length>0&&args[0].equals("loss")){lossProbe();return;}
    SharedPreferences disk=new SharedPreferences();
    WidgetSnapshotArbiter.State s=new WidgetSnapshotArbiter.State();
    ok(photo(s,"",""),"foto sintética inicial");
    s.unknownJournal="    tr:fixture:known\\t\\n    "; s.unknownPending=true;
    write(disk.edit(),s); disk.edit().putBoolean("unknownLoss",false); s=read(disk);
    // La representación con espacios se inyecta: no se pretende ejecutar el serializador Android.
    ok(photo(s,"",""),"R20: indentación de unknownJournal no es corrupción");
    ok(s.unknownPending&&!s.journalFull,"sin ACK conserva pendiente recuperable");
    ok(s.spent==40,"foto previa sin delta inventado");
    ok(s.unknownJournal.equals("tr:fixture:known\\t"),"identidad normalizada y TAB de clave vacía conservado");
    write(disk.edit(),s); s=read(disk);
    ok(!disk.getBoolean("unknownLoss",false)&&s.unknownPending,"read/write/reinicio no inventa pérdida");
    String once=s.unknownJournal; WidgetSnapshotArbiter.pendingUnknown(s,"tr:fixture:known","");
    ok(once.equals(s.unknownJournal),"última entrada compacta no se duplica");
    ok(photo(s,"|known|",""),"ACK crudo acepta foto pero no acredita identidad");
    write(disk.edit(),s); s=read(disk); ok(s.unknownPending,"crudo no desbloquea tras reinicio");
    ok(photo(s,"|tr:fixture:known|",""),"ACK canónico acredita entrada retenida");
    write(disk.edit(),s); s=read(disk);
    ok(!s.unknownPending&&!s.journalFull&&s.unknownJournal.isEmpty(),"cobertura exacta libera tras reinicio");
    ok(!disk.getBoolean("unknownLoss",false),"formato recuperable nunca se vuelve pérdida durable");
    s=new WidgetSnapshotArbiter.State(); ok(photo(s,"",""),"segunda foto sintética");
    s.unknownJournal="    second\\t  key  \\n    "; s.unknownPending=true;
    write(disk.edit(),s); s=read(disk);
    ok(photo(s,"",""),"sólo se normaliza el exterior de la identidad");
    ok(s.unknownJournal.equals("second\\t  key  "),"el segundo campo conserva sus bytes");
    ok(photo(s,"","|key|")&&s.unknownPending,"lápida sin espacios no cubre otra clave");
    write(disk.edit(),s); s=read(disk);
    ok(photo(s,"","|  key  |")&&!s.unknownPending,"lápida exacta de la clave retenida");
    for(String malformed:new String[]{"   \\tkey","\\t","unparseable"}){
      SharedPreferences brokenDisk=new SharedPreferences();
      WidgetSnapshotArbiter.State broken=new WidgetSnapshotArbiter.State();
      ok(photo(broken,"",""),"foto limpia propia de cada entrada dañada");
      write(brokenDisk.edit(),broken); broken=read(brokenDisk);
      ok(!broken.journalFull&&!broken.unknownPending&&!brokenDisk.getBoolean("unknownLoss",true)
          &&broken.unknownJournal.isEmpty(),"cada caso comienza sin bloqueo ni pérdida heredados");
      broken.unknownJournal=malformed;
      ok(!photo(broken,"","|key|"),"identidad ilegible no es indentación aunque haya lápida");
      // write completo aísla el reinicio del harness; el writeBlocked de saveApp se prueba
      // con su método real en widget-unknown-loss, no con este guard de formato.
      write(brokenDisk.edit(),broken); broken=read(brokenDisk);
      ok(broken.journalFull&&broken.unknownPending&&brokenDisk.getBoolean("unknownLoss",false),"daño real conserva pérdida durable");
    }
    System.out.println("  PASS R20: reader/writer reales, formato unknown recuperable, TAB vacío, ACK y pérdida real separados");
  }
}`);
  const jdk=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'C:/Program Files/Android/Android Studio/jbr/bin';
  for(const [name,args] of [['javac',['-encoding','UTF-8','-d',dir,path.join(native,'WidgetSnapshotArbiter.java'),src]],['java',['-cp',dir,'com.micartera.app.WidgetUnknownJournalTest',process.argv.includes('--loss-probe')?'loss':'format']]]){
    const bin=fs.existsSync(path.join(jdk,name+'.exe'))?path.join(jdk,name+'.exe'):name;
    const r=spawnSync(bin,args,{cwd:root,encoding:'utf8'});
    assert.equal(r.status,0,String(r.error||r.stderr||r.stdout));
    if(r.stdout)process.stdout.write(r.stdout);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
