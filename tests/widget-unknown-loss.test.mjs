#!/usr/bin/env node
// Ejecuta Java real y los métodos reales de preferencias: perder identidad no es un ACK.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const native=path.join(root,'android/app/src/main/java/com/micartera/app');
const widget=fs.readFileSync(path.join(native,'MiCarteraWidget.java'),'utf8');
const readWrite=widget.slice(widget.indexOf('    private static WidgetSnapshotArbiter.State read('),widget.indexOf('    static synchronized long beginIngest('));
assert.ok(readWrite.includes('unknownLoss'));
assert.match(widget,/boolean sinDato = p.getBoolean\("unknownLoss", false\)/,'el render no puede mostrar cifras tras pérdida');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-loss-'));
try {
const src=path.join(dir,'WidgetUnknownLossTest.java');
fs.writeFileSync(src,`package com.micartera.app;
import java.util.*;
public class WidgetUnknownLossTest {
  static class SharedPreferences {
    final Map<String,Object> values = new HashMap<>();
    boolean contains(String k) { return values.containsKey(k); }
    long getLong(String k,long d) { return contains(k)?(Long)values.get(k):d; }
    float getFloat(String k,float d) { return contains(k)?(Float)values.get(k):d; }
    boolean getBoolean(String k,boolean d) { return contains(k)?(Boolean)values.get(k):d; }
    String getString(String k,String d) { return contains(k)?(String)values.get(k):d; }
    Editor edit() { return new Editor(this); }
    static class Editor {
      final SharedPreferences p;
      Editor(SharedPreferences p) { this.p=p; }
      Editor putLong(String k,long v) { p.values.put(k,v); return this; }
      Editor putFloat(String k,float v) { p.values.put(k,v); return this; }
      Editor putBoolean(String k,boolean v) { p.values.put(k,v); return this; }
      Editor putString(String k,String v) { p.values.put(k,v); return this; }
      Editor remove(String k) { p.values.remove(k); return this; }
    }
  }
${readWrite}
  static void ok(boolean v,String why) { if(!v) throw new AssertionError(why); }
  static void eq(double a,double b) { ok(Math.abs(a-b)<.001,a+" != "+b); }
  static WidgetSnapshotArbiter.State restart(WidgetSnapshotArbiter.State s) {
    SharedPreferences disk=new SharedPreferences(); write(disk.edit(),s); return read(disk);
  }
  static void photo(WidgetSnapshotArbiter.State s,long period,String ack,String deleted,String bank) {
    ok(WidgetSnapshotArbiter.app(s,period,40,100,60.0,150.0,200.0,bank,"Cuenta",ack,deleted),"foto válida");
  }
  static WidgetSnapshotArbiter.State base() {
    WidgetSnapshotArbiter.State s=new WidgetSnapshotArbiter.State(); photo(s,1,"","","trade_republic"); return s;
  }
  static boolean ing(WidgetSnapshotArbiter.State s,long ticket,long period,String id) {
    return WidgetSnapshotArbiter.ingest(s,ticket,period,period,200,id,id+"Key",50,100,50,10,10,10,true,true);
  }
  public static void main(String[] args) {
    // El journal lleno de identidades válidas no deja sitio al pago incompatible nuevo.
    WidgetSnapshotArbiter.State s=base();
    String huge=new String(new char[262140]).replace('\\0','x');
    s.unknownJournal=huge+"\\tK\\n";
    ok(WidgetSnapshotArbiter.pendingUnknown(s,"lost","lostKey"),"registrar incertidumbre");
    ok(!s.unknownJournal.contains("lost"),"identidad perdida realmente");
    ok(s.journalFull&&s.unknownPending&&s.unknownLoss,"saturación distingue pérdida");
    s=restart(s); photo(s,1,"|"+huge+"|","","trade_republic");
    ok(s.unknownJournal.isEmpty(),"ACK completo de las identidades retenidas");
    ok(!s.journalFull&&s.unknownPending&&s.unknownLoss,"el ACK retenido no cubre lo perdido");
    s=restart(s); photo(s,1,"|foreign|lost|","|lostKey|","sabadell");
    ok(s.unknownPending&&s.unknownLoss,"sin identidad propia ni ACK aparente permite certeza");
    eq(s.spent,40); eq(s.cash(),200); // No inventar importe ni restar dos veces.
    photo(s,2,"","","trade_republic");
    ok(s.unknownPending,"mes/banco nuevos no concilian el saldo");
    long ticket=WidgetSnapshotArbiter.begin(s); ok(ing(s,ticket,3,"new"),"nuevo periodo ingest");
    ok(s.unknownPending&&s.unknownLoss,"ingest tampoco limpia pérdida");
    s=restart(s); photo(s,3,"|new|","","trade_republic");
    ok(s.unknownPending,"fence y ACK de otro evento no limpian pérdida");
    // El límite permite la identidad exacta; una unidad más no se admite ni simula cobertura.
    WidgetSnapshotArbiter.State limit=base();
    String exact=new String(new char[262140]).replace('\\0','e');
    ok(WidgetSnapshotArbiter.pendingUnknown(limit,exact,"K"),"identidad en límite");
    ok(!limit.unknownLoss&&limit.unknownJournal.length()==262143,"presupuesto acotado");
    ok(WidgetSnapshotArbiter.pendingUnknown(limit,"overflow","K"),"identidad fuera de límite");
    ok(limit.unknownLoss&&limit.unknownJournal.length()==262143,"sin crecimiento ilimitado");
    // Desbordar el journal de deltas permite recuperar con identidad compacta y ACK exacto.
    WidgetSnapshotArbiter.State compact=base();
    compact.journal=new String(new char[262144]).replace('\\0','x');
    ok(ing(compact,WidgetSnapshotArbiter.begin(compact),1,"compact"),"desborde compatible");
    ok(compact.journalFull&&compact.unknownPending&&!compact.unknownLoss,"identidad compacta conservada");
    compact.journal=""; compact=restart(compact);
    photo(compact,1,"|foreign|","","trade_republic"); ok(compact.unknownPending,"ACK ajeno");
    photo(compact,1,"|compact|","","trade_republic"); ok(!compact.unknownPending,"ACK exacto recupera");
    // El journal ya bloqueado debe retener cada pago que llegue después, sin deltas ficticios.
    WidgetSnapshotArbiter.State blocked=base(); blocked.journalFull=true;
    ok(ing(blocked,WidgetSnapshotArbiter.begin(blocked),1,"after"),"nuevo pago mientras bloqueado");
    photo(blocked,1,"","","trade_republic"); ok(blocked.unknownPending,"foto vacía");
    blocked=restart(blocked); photo(blocked,1,"","|afterKey|","trade_republic");
    ok(!blocked.unknownPending,"lápida exacta recupera identidad retenida");
    // Un ACK parcial deja la segunda identidad pendiente y sobrevive al reinicio.
    WidgetSnapshotArbiter.State partial=base();
    WidgetSnapshotArbiter.pendingUnknown(partial,"one","oneKey");
    WidgetSnapshotArbiter.pendingUnknown(partial,"two","twoKey");
    photo(partial,1,"|one|","","trade_republic"); partial=restart(partial);
    ok(partial.unknownPending&&!partial.unknownLoss,"ACK parcial");
    photo(partial,1,"","|twoKey|","trade_republic"); ok(!partial.unknownPending,"cobertura restante");
    // Formato XML recuperable sigue siendo recuperable en una preferencia del esquema nuevo.
    WidgetSnapshotArbiter.State formatting=base(); formatting.journalFull=true;
    formatting.journal="event\\t10\\t10\\t10\\t1\\t1\\tkey\\n    ";
    formatting=restart(formatting); photo(formatting,1,"|event|","","trade_republic");
    ok(!formatting.journalFull&&!formatting.unknownPending&&!formatting.unknownLoss,"normalización recuperable");
    SharedPreferences legacy=new SharedPreferences(); legacy.edit().putBoolean("journalFull",true);
    ok(read(legacy).unknownLoss&&read(legacy).unknownPending,"migración antigua no demuestra identidad intacta");
    SharedPreferences clean=new SharedPreferences(); ok(!read(clean).unknownLoss,"instalación limpia");
    System.out.println("  ✓ Java real: pérdida durable, reinicio, ACK parcial/ajeno, cambio de periodo, fence y migración");
  }
}`);
const jdk=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'';
for(const [name,args] of [['javac',['-encoding','UTF-8','-d',dir,path.join(native,'WidgetSnapshotArbiter.java'),src]],['java',['-cp',dir,'com.micartera.app.WidgetUnknownLossTest']]]) {
 const bin=jdk&&fs.existsSync(path.join(jdk,name))?path.join(jdk,name):name;
 const result=spawnSync(bin,args,{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.error||result.stderr||result.stdout);
 process.stdout.write(result.stdout);
}
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
