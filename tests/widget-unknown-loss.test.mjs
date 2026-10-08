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
    // Un journal retenido sobredimensionado sólo es pérdida si impide migrar otras identidades.
    for (boolean missing : new boolean[]{false,true}) {
      WidgetSnapshotArbiter.State over=base();
      String retainedHuge=new String(new char[262145]).replace('\\0','q');
      over.unknownJournal=retainedHuge+"\\tK\\n";
      if(missing) over.journal="missing\\tnot-a-number\\t10\\t10\\t1\\t1\\tmissingKey";
      over.journalFull=true; over.unknownPending=true; over=restart(over);
      if(missing) {
        SharedPreferences disk=new SharedPreferences(); write(disk.edit(),over);
        ok(!WidgetSnapshotArbiter.app(over,2,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""),"app no resetea si migración falla");
        writeBlocked(disk.edit(),over); over=read(disk);
        ok(over.journal.startsWith("missing\\t")&&!over.unknownLoss,"app fallida conserva las identidades originales");
      }
      ok(ing(over,WidgetSnapshotArbiter.begin(over),2,"later"),"rollover con retenido grande");
      over=restart(over); photo(over,2,"|"+retainedHuge+"|later|","","trade_republic");
      ok(over.unknownPending==missing&&over.unknownLoss==missing,"sólo migración fallida pierde identidad; retenido solo recupera");
    }
    // Datos irreconocibles del mismo alcance no se convierten en certeza al cambiar periodo.
    for (String broken : new String[]{"damaged-entry","\\t10\\t10\\t10\\t1\\t1\\tkey"}) {
      WidgetSnapshotArbiter.State corrupt=base(); corrupt.journal=broken;
      SharedPreferences disk=new SharedPreferences(); write(disk.edit(),corrupt); corrupt=read(disk);
      ok(!WidgetSnapshotArbiter.app(corrupt,1,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""),"journal corrupto falla");
      writeBlocked(disk.edit(),corrupt); corrupt=read(disk);
      ok(corrupt.unknownLoss,"identidad ilegible queda señalada");
      ok(ing(corrupt,WidgetSnapshotArbiter.begin(corrupt),2,"later"),"periodo nuevo");
      corrupt=restart(corrupt); photo(corrupt,2,"|later|","","trade_republic");
      ok(corrupt.unknownPending&&corrupt.unknownLoss,"corrupción no cubierta por ACK ajeno");
    }
    // Una cifra dañada aún conserva identidad: ACK del mismo periodo puede recuperarla.
    for (int rollover : new int[]{0,1,2}) {
      WidgetSnapshotArbiter.State numeric=base(); numeric.journal="known\\tnot-a-number\\t10\\t10\\t1\\t1\\tknownKey";
      SharedPreferences disk=new SharedPreferences(); write(disk.edit(),numeric); numeric=read(disk);
      ok(!WidgetSnapshotArbiter.app(numeric,1,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""),"cifra inválida falla");
      writeBlocked(disk.edit(),numeric); numeric=read(disk);
      ok(!numeric.unknownLoss,"identidad numérica conservada");
      if(rollover>0) {
        if(rollover==1) ok(ing(numeric,WidgetSnapshotArbiter.begin(numeric),2,"later"),"ingest conserva identidad bloqueada");
        else photo(numeric,2,"|later|","","trade_republic");
        numeric=restart(numeric); photo(numeric,2,"|later|","","trade_republic");
        ok(numeric.unknownPending&&!numeric.unknownLoss,"ACK ajeno deja la identidad conocida pendiente");
      }
      photo(numeric,rollover>0?2:1,"|known|later|","","trade_republic");
      ok(!numeric.unknownPending&&!numeric.unknownLoss,"ACK exacto recupera la cifra dañada");
    }
    WidgetSnapshotArbiter.State badUnknown=base(); badUnknown.unknownJournal="unparseable";
    ok(!WidgetSnapshotArbiter.app(badUnknown,1,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","",""),"journal desconocido ilegible");
    SharedPreferences badDisk=new SharedPreferences(); writeBlocked(badDisk.edit(),badUnknown);
    ok(read(badDisk).unknownLoss&&read(badDisk).unknownPending,"fallo ilegible persiste pérdida");
    // Una identidad que excede el límite no deja ninguna fila: una foto sin ACK no la cubre.
    WidgetSnapshotArbiter.State emptyLoss=base();
    String tooLarge=new String(new char[262145]).replace('\\0','z');
    ok(WidgetSnapshotArbiter.pendingUnknown(emptyLoss,tooLarge,"lostKey"),"pérdida sin fila");
    ok(emptyLoss.unknownJournal.isEmpty()&&emptyLoss.unknownLoss,"identidad no retenida");
    emptyLoss=restart(emptyLoss); photo(emptyLoss,1,"","","trade_republic");
    ok(emptyLoss.unknownPending&&emptyLoss.unknownLoss,"foto sin ACK no limpia pérdida");
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
    // saveApp fallido conserva sólo flags reales, nunca la foto/identidades parciales.
    WidgetSnapshotArbiter.State scope=base();
    scope.journal="old\\t10\\t10\\t10\\t1\\t1\\toldKey"; scope.events="|old|";
    scope.unknownJournal=huge+"\\tK\\n"; scope.unknownPending=true;
    SharedPreferences beforeScope=new SharedPreferences(); write(beforeScope.edit(),scope);
    WidgetSnapshotArbiter.State failed=read(beforeScope);
    ok(!WidgetSnapshotArbiter.invalidateScope(failed),"scope saturado falla");
    writeBlocked(beforeScope.edit(),failed); scope=read(beforeScope);
    ok(scope.unknownLoss&&scope.unknownPending,"flags fallidos persistidos");
    ok(scope.unknownJournal.equals(huge+"\\tK\\n"),"no guarda identidades parciales");
    ok(scope.journal.startsWith("old\\t"),"no pisa journal previo"); eq(scope.spent,40);
    ok(ing(scope,WidgetSnapshotArbiter.begin(scope),2,"newScope"),"respuesta nuevo periodo");
    scope=restart(scope); photo(scope,2,"|"+huge+"|newScope|","","trade_republic");
    ok(scope.unknownPending&&scope.unknownLoss,"ACK restante no cubre lo perdido al cambiar scope");
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
