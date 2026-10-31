#!/usr/bin/env node
// Se compila el listener entero: los fixtures sustituyen fronteras, nunca su decisión de admisión.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

// Política expresa 9727de55; revisión del diff y congelación del oráculo todavía pendientes.
const CLOCK_ROLLBACK_POLICY = "EXPIRE_AND_ADMIT";
const root = path.resolve(import.meta.dirname, "..");
const native = path.join(root, "android/app/src/main/java/com/micartera/app");
const base = "034fdb7b3b068408c2d113eb80382d13fdafa11e";
const parent = process.env.MC_NATIVE_DEBOUNCE_OUTPUT_DIR || os.tmpdir();
fs.mkdirSync(parent, { recursive: true });
const dir = fs.mkdtempSync(path.join(parent, "native-event-debounce-"));
const sources = path.join(dir, "sources"), classes = path.join(dir, "classes");
fs.mkdirSync(sources); fs.mkdirSync(classes);
const hash = value => createHash("sha256").update(value).digest("hex");
function durable(file, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
  const fd = fs.openSync(file, "wx");
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  assert.ok(fs.readFileSync(file).equals(bytes), "readback del artefacto");
  return { bytes: bytes.length, sha256: hash(bytes) };
}
const manifest = [], javaFiles = [];
function source(name, value) {
  const file = path.join(sources, name), bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  assert.ok(fs.readFileSync(file).equals(bytes), "copia byte exacta de " + name);
  manifest.push({ file: name, bytes: bytes.length, sha256: hash(bytes) });
  javaFiles.push(file);
}

const listener = fs.readFileSync(path.join(native, "TrExpenseListener.java"));
source("com/micartera/app/TrExpenseListener.java", listener);
const helper = path.join(native, "NativeEventDebounce.java");
if (fs.existsSync(helper)) source("com/micartera/app/NativeEventDebounce.java", fs.readFileSync(helper));
// La copia que javac recibe no cambia imports, reloj, métodos, hash ni ramas del listener.
// El tail se coteja aparte para conservar hash, transporte, cola, tickets y ACK sin repetir sus suites.
const baseline = spawnSync("git", ["show", base + ":android/app/src/main/java/com/micartera/app/TrExpenseListener.java"], { cwd: root, encoding: "utf8" });
assert.equal(baseline.status, 0, "lectura de la base contractual: " + baseline.stderr);
const tail = text => {
  const normalized = text.replaceAll("\r\n", "\n"), marker = "    /** Huella estable y opaca.";
  const start = normalized.indexOf(marker);
  assert.ok(start >= 0, "inicio del contrato estable");
  return normalized.slice(start);
};
assert.equal(tail(listener.toString("utf8")), tail(baseline.stdout), "hash/transporte/cola/ACK deben conservarse");

source("android/content/SharedPreferences.java", `package android.content;
import java.util.Map;
public interface SharedPreferences {
  Map<String,?> getAll();
  String getString(String key,String fallback);
  int getInt(String key,int fallback);
  long getLong(String key,long fallback);
  boolean getBoolean(String key,boolean fallback);
  Editor edit();
  interface Editor {
    Editor putString(String key,String value); Editor putInt(String key,int value);
    Editor putLong(String key,long value); Editor putBoolean(String key,boolean value);
    Editor remove(String key); void apply();
  }
}
`);
source("android/content/Intent.java", `package android.content;
public class Intent { public Intent(String action){} public Intent setPackage(String value){return this;} }
`);
source("android/os/Build.java", `package android.os;
public final class Build { public static final class VERSION {public static final int SDK_INT=35;}
  public static final class VERSION_CODES {public static final int O=26;} }
`);
source("android/os/Bundle.java", `package android.os;
import java.util.HashMap;
public class Bundle extends HashMap<String,CharSequence> {
  public CharSequence getCharSequence(String key){return get(key);}
}
`);
source("android/app/Notification.java", `package android.app;
public class Notification {
  public final android.os.Bundle extras=new android.os.Bundle();
  private final String channel;
  public Notification(String title,String text,String channel){extras.put("android.title",title);extras.put("android.text",text);this.channel=channel;}
  public String getChannelId(){return channel;}
}
`);
source("android/service/notification/StatusBarNotification.java", `package android.service.notification;
public class StatusBarNotification {
  private final String pkg,key,tag; private final int id; private final long postedAt;
  private final android.app.Notification notification;
  public StatusBarNotification(String pkg,String key,long postedAt,int id,String tag,String title,String text){
    this.pkg=pkg;this.key=key;this.postedAt=postedAt;this.id=id;this.tag=tag;
    notification=new android.app.Notification(title,text,"tapandpay.transactions.low");
  }
  public String getPackageName(){return pkg;} public String getKey(){return key;}
  public int getId(){return id;} public String getTag(){return tag;}
  public long getPostTime(){return postedAt;} public android.app.Notification getNotification(){return notification;}
}
`);
source("android/service/notification/NotificationListenerService.java", `package android.service.notification;
import android.content.SharedPreferences;
import java.util.*;
public class NotificationListenerService {
  public static final int MODE_PRIVATE=0;
  private static final Map<String,MemoryPreferences> preferences=new HashMap<>();
  public static synchronized void resetPreferences(){preferences.clear();}
  public synchronized SharedPreferences getSharedPreferences(String name,int mode){
    synchronized(preferences){return preferences.computeIfAbsent(name,key->new MemoryPreferences(key));}
  }
  public String getPackageName(){return "fixture.listener";}
  public void sendBroadcast(android.content.Intent intent){}
  public void onNotificationPosted(StatusBarNotification notification){}
  public void onListenerConnected(){}
  private static final class MemoryPreferences implements SharedPreferences {
    private final String name;
    private final Map<String,Object> values=new HashMap<>();
    MemoryPreferences(String name){this.name=name;}
    public Map<String,?> getAll(){
      Map<String,Object> snapshot;
      synchronized(this){snapshot=new HashMap<>(values);}
      // La pausa ocurre DESPUÉS del snapshot, fuera del monitor que protege preferencias.
      PreferenceReadGate.afterSnapshot(name);
      return snapshot;
    }
    public synchronized String getString(String k,String d){Object v=values.get(k);return v instanceof String?(String)v:d;}
    public synchronized int getInt(String k,int d){Object v=values.get(k);return v instanceof Number?((Number)v).intValue():d;}
    public synchronized long getLong(String k,long d){Object v=values.get(k);return v instanceof Number?((Number)v).longValue():d;}
    public synchronized boolean getBoolean(String k,boolean d){Object v=values.get(k);return v instanceof Boolean?(Boolean)v:d;}
    public Editor edit(){return new MemoryEditor();}
    private final class MemoryEditor implements Editor {
      private final Map<String,Object> changes=new HashMap<>(); private final Set<String> removed=new HashSet<>();
      public Editor putString(String k,String v){changes.put(k,v);return this;}
      public Editor putInt(String k,int v){changes.put(k,v);return this;}
      public Editor putLong(String k,long v){changes.put(k,v);return this;}
      public Editor putBoolean(String k,boolean v){changes.put(k,v);return this;}
      public Editor remove(String k){removed.add(k);return this;}
      public void apply(){synchronized(MemoryPreferences.this){for(String k:removed)values.remove(k);values.putAll(changes);}PreferenceReadGate.afterWrite(name);}
    }
  }
}
`);
source("android/service/notification/PreferenceReadGate.java", `package android.service.notification;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
public final class PreferenceReadGate {
  private static volatile boolean armed;
  private static CountDownLatch read1,read2,release;
  private static AtomicInteger snapshots;
  private static volatile long reader1;
  private static final List<String> trace=Collections.synchronizedList(new ArrayList<>());
  public static void arm(){read1=new CountDownLatch(1);read2=new CountDownLatch(1);release=new CountDownLatch(1);snapshots=new AtomicInteger();reader1=0;trace.clear();armed=true;}
  private static boolean applies(String name){return armed && name.equals("micartera_ingest_dedupe");}
  public static void afterSnapshot(String name){
    if(!applies(name))return;
    int ordinal=snapshots.incrementAndGet();trace.add("READ"+ordinal+"_SNAPSHOT:"+java.lang.Thread.currentThread().getId());
    if(ordinal==1){reader1=java.lang.Thread.currentThread().getId();read1.countDown();}if(ordinal==2)read2.countDown();
    // No se mantiene ningún monitor del fixture mientras se espera.
    try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("read gate deadline");}
    catch(InterruptedException e){java.lang.Thread.currentThread().interrupt();throw new AssertionError(e);}
  }
  public static void afterWrite(String name){if(applies(name)){long thread=java.lang.Thread.currentThread().getId();trace.add((thread==reader1?"WRITE1:":"WRITE2:")+thread);}}
  public static boolean awaitRead1() throws InterruptedException {return read1.await(5,TimeUnit.SECONDS);}
  public static boolean hasRead2(){return read2.getCount()==0;}
  public static void mark(String signal){trace.add(signal);}
  public static void release(){release.countDown();}
  public static void disarm(){armed=false;release.countDown();}
  public static String trace(){synchronized(trace){return trace.toString();}}
}
`);

// JSON es una frontera de representación en memoria; no clasifica notificaciones ni calcula identidades.
source("org/json/JSONObject.java", `package org.json;
import java.util.*;
public class JSONObject {
  final Map<String,Object> data;
  public JSONObject(){data=new HashMap<>();}
  @SuppressWarnings("unchecked") public JSONObject(String value){Object found=Registry.get(value);if(!(found instanceof Map))throw new IllegalArgumentException("JSON fixture");data=new HashMap<>((Map<String,Object>)found);}
  public JSONObject put(String k,Object v){data.put(k,v);return this;}
  public String optString(String k,String d){Object v=data.get(k);return v==null?d:String.valueOf(v);}
  public long optLong(String k,long d){Object v=data.get(k);try{return v instanceof Number?((Number)v).longValue():Long.parseLong(String.valueOf(v));}catch(Exception e){return d;}}
  public int optInt(String k,int d){return (int)optLong(k,d);}
  public double optDouble(String k,double d){Object v=data.get(k);try{return v instanceof Number?((Number)v).doubleValue():Double.parseDouble(String.valueOf(v));}catch(Exception e){return d;}}
  public boolean optBoolean(String k,boolean d){Object v=data.get(k);return v instanceof Boolean?(Boolean)v:d;}
  public boolean has(String k){return data.containsKey(k);}
  public JSONObject optJSONObject(String k){Object v=data.get(k);return v instanceof JSONObject?(JSONObject)v:null;}
  public Map<String,Object> snapshot(){return new HashMap<>(data);}
  public String toString(){return Registry.put(new HashMap<>(data));}
}
final class Registry {
  private static final Map<String,Object> values=new HashMap<>(); private static long next;
  static synchronized String put(Object value){String key="fixture-json-"+(next++);values.put(key,value);return key;}
  static synchronized Object get(String value){return values.get(value);}
}
`);
source("org/json/JSONArray.java", `package org.json;
import java.util.*;
public class JSONArray {
  private List<JSONObject> data=new ArrayList<>();
  public JSONArray(){}
  @SuppressWarnings("unchecked") public JSONArray(String value){if(!"[]".equals(value))data=new ArrayList<>((List<JSONObject>)Registry.get(value));}
  public int length(){return data.size();} public void put(JSONObject value){data.add(value);}
  public void remove(int i){data.remove(i);} public JSONObject optJSONObject(int i){return data.get(i);}
  public String toString(){return Registry.put(new ArrayList<>(data));}
}
`);

source("com/micartera/app/NativeEventDebounceTest.java", `package com.micartera.app;
import android.service.notification.*;
import java.io.*;
import java.net.*;
import java.lang.reflect.*;
import java.lang.management.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.JSONObject;

public class NativeEventDebounceTest {
  static final long BASE=1700000000000L;
  static final String TR="de.traderepublic.app", WALLET="com.google.android.apps.walletnfcrel";
  static final String TITLE="Fixture Cafe", TEXT="12,34 €";
  static final String CLOCK_POLICY=${JSON.stringify(CLOCK_ROLLBACK_POLICY)};
  static final List<Sent> sent=new ArrayList<>();
  static final Method HANDLE;
  static {try{HANDLE=TrExpenseListener.class.getDeclaredMethod("handleNotiGasto",StatusBarNotification.class,String.class);HANDLE.setAccessible(true);}catch(Exception e){throw new ExceptionInInitializerError(e);}}
  interface Checked {void run() throws Exception;}
  static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
  static void equal(Object expected,Object actual,String message){check(Objects.equals(expected,actual),message+": expected="+expected+" actual="+actual);}
  static void run(String name,Checked body) throws Exception {body.run();java.lang.System.out.println("PASS "+name);}
  static TrExpenseListener reset(){
    NotificationListenerService.resetPreferences();Thread.clear();sent.clear();System.now=BASE;MiCarteraWidget.issued=0;MiCarteraWidget.finished=0;
    TrExpenseListener listener=new TrExpenseListener();
    listener.getSharedPreferences("micartera_ingest",0).edit().putString("url","https://fixture.invalid/ingest?token=fixture%2Btoken&mode=fixture").apply();
    return listener;
  }
  static StatusBarNotification noti(String pkg,String key,long posted,int id,String tag,String title,String text){return new StatusBarNotification(pkg,key,posted,id,tag,title,text);}
  static StatusBarNotification noti(String key,long posted){return noti(TR,key,posted,1,"tag",TITLE,TEXT);}
  static void call(TrExpenseListener listener,StatusBarNotification notification,String source) throws Exception {
    try{HANDLE.invoke(listener,notification,source);}catch(InvocationTargetException e){Throwable cause=e.getCause();if(cause instanceof Exception)throw (Exception)cause;throw (Error)cause;}
  }
  static void admissions(int expected,String message){equal(expected,Thread.size(),message);}
  static void parallel(Checked first,Checked second) throws Exception {
    CountDownLatch ready=new CountDownLatch(2),go=new CountDownLatch(1);AtomicReference<Throwable> failure=new AtomicReference<>();
    java.lang.Thread[] pair=new java.lang.Thread[2];Checked[] callbacks={first,second};
    for(int i=0;i<2;i++){final Checked callback=callbacks[i];pair[i]=new java.lang.Thread(()->{ready.countDown();try{if(!go.await(5,TimeUnit.SECONDS))throw new AssertionError("concurrent gate");callback.run();}catch(Throwable e){failure.compareAndSet(null,e);}});pair[i].setDaemon(true);pair[i].start();}
    check(ready.await(5,TimeUnit.SECONDS),"concurrent ready");go.countDown();
    for(java.lang.Thread thread:pair){thread.join(5000);check(!thread.isAlive(),"concurrent completion");}
    if(failure.get()!=null)throw new AssertionError("concurrent callback",failure.get());
  }
  static void atomicInterleaving() throws Exception {
    TrExpenseListener listener=reset();StatusBarNotification a=noti("atomic-interleaving",BASE);
    AtomicReference<Throwable> failure=new AtomicReference<>();
    Runnable callback=()->{try{listener.onNotificationPosted(a);}catch(Throwable e){failure.compareAndSet(null,e);}};
    java.lang.Thread first=new java.lang.Thread(callback,"callback-1"),second=new java.lang.Thread(callback,"callback-2");
    first.setDaemon(true);second.setDaemon(true);
    Class<?> helper=Class.forName("com.micartera.app.NativeEventDebounce");
    ThreadMXBean threads=ManagementFactory.getThreadMXBean();boolean observed=false;
    PreferenceReadGate.arm();
    try{
      first.start();check(PreferenceReadGate.awaitRead1(),"first snapshot deadline");
      PreferenceReadGate.mark("START2");second.start();
      long deadline=java.lang.System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
      while(java.lang.System.nanoTime()<deadline){
        if(PreferenceReadGate.hasRead2()){PreferenceReadGate.mark("OBSERVED_READ2_SNAPSHOT");observed=true;break;}
        ThreadInfo info=threads.getThreadInfo(second.getId());LockInfo lock=info==null?null:info.getLockInfo();
        if(info!=null && info.getThreadState()==java.lang.Thread.State.BLOCKED && info.getLockOwnerId()==first.getId()
            && lock!=null && lock.getClassName().equals("java.lang.Class") && lock.getIdentityHashCode()==java.lang.System.identityHashCode(helper)){
          PreferenceReadGate.mark("OBSERVED_HELPER_MONITOR_BLOCKED_BY_1");observed=true;break;
        }
        java.lang.Thread.yield();
      }
    }finally{
      PreferenceReadGate.release();
      if(first.getState()!=java.lang.Thread.State.NEW)first.join(5000);
      if(second.getState()!=java.lang.Thread.State.NEW)second.join(5000);
      PreferenceReadGate.mark("RELEASED_AND_JOINED");
      java.lang.System.out.println("TRACE atomic "+PreferenceReadGate.trace());PreferenceReadGate.disarm();
    }
    check(observed,"neither read2 nor exact helper monitor observed before deadline");
    check(!first.isAlive() && !second.isAlive(),"atomic callback join deadline");
    if(failure.get()!=null)throw new AssertionError("atomic callback",failure.get());
    admissions(1,"check and record must be atomic with controlled snapshots");
  }
  static final class Sent {
    final URL url; final String token; final Map<String,Object> payload;
    Sent(URL url,String token,Map<String,Object> payload){this.url=url;this.token=token;this.payload=payload;}
  }
  static final class Connection extends HttpURLConnection {
    final ByteArrayOutputStream output=new ByteArrayOutputStream();
    Connection(URL url){super(url);}
    public void connect(){} public void disconnect(){} public boolean usingProxy(){return false;}
    public OutputStream getOutputStream(){return output;}
    public int getResponseCode(){sent.add(new Sent(url,getRequestProperty("x-ingest-token"),new JSONObject(output.toString(StandardCharsets.UTF_8)).snapshot()));return 200;}
    public InputStream getInputStream(){return new ByteArrayInputStream(new byte[0]);}
    public InputStream getErrorStream(){return getInputStream();}
  }
  static void emptyIdentity() throws Exception {
    // Se invoca el helper de producción; el proxy sólo observa acceso al almacén.
    Class<?> helper=Class.forName("com.micartera.app.NativeEventDebounce");
    Class<?> store=Class.forName("com.micartera.app.NativeEventDebounce$Store");
    AtomicInteger writes=new AtomicInteger();
    Object backing=java.lang.reflect.Proxy.newProxyInstance(store.getClassLoader(),new Class<?>[]{store},(proxy,method,args)->{
      if(method.getName().equals("read"))return Collections.emptyMap();
      if(method.getName().equals("write")){writes.incrementAndGet();return null;}
      throw new IllegalStateException("unexpected Store method "+method.getName());
    });
    Method admit=helper.getDeclaredMethod("admit",String.class,long.class,store);admit.setAccessible(true);
    equal(true,admit.invoke(null,"",BASE,backing),"empty identity fail-open");
    equal(true,admit.invoke(null,null,BASE,backing),"null identity fail-open");
    equal(0,writes.get(),"empty identity must not become a stored dedupe key");
  }
  static void rollback() throws Exception {
    if(!CLOCK_POLICY.equals("EXPIRE_AND_ADMIT"))throw new IllegalStateException("CLOCK_POLICY_PENDING: resolver y congelar el arnes antes de RED/GREEN");
    TrExpenseListener listener=reset();StatusBarNotification a=noti("clock",BASE);
    listener.onNotificationPosted(a);System.now=BASE-1;listener.onNotificationPosted(a);
    admissions(2,"approved rollback expires future accepted timestamp");
  }
  public static void main(String[] args) throws Exception {
    URL.setURLStreamHandlerFactory(protocol->new URLStreamHandler(){protected URLConnection openConnection(URL url){return new Connection(url);}});
    // Primero el fallo causal: la base debe compilar y fallar aquí por UNA admisión, no por setup.
    run("causal equal content distinct key",()->{
      TrExpenseListener listener=reset();listener.onNotificationPosted(noti("purchase-a",BASE));
      System.now=BASE+1;listener.onNotificationPosted(noti("purchase-b",BASE+1));
      admissions(2,"causal: two distinct event admissions below180s");
    });
    run("same key distinct positive postTime",()->{
      TrExpenseListener listener=reset();listener.onNotificationPosted(noti("same-key",BASE));
      System.now++;listener.onNotificationPosted(noti("same-key",BASE+1));admissions(2,"postTime separates events");
    });
    run("same identity changed content",()->{
      TrExpenseListener listener=reset();listener.onNotificationPosted(noti("update",BASE));System.now++;
      listener.onNotificationPosted(noti(TR,"update",BASE,1,"tag","Updated title","12,34 € updated"));admissions(1,"updated content retains identity");
    });
    run("interleaved A B A",()->{
      TrExpenseListener listener=reset();StatusBarNotification a=noti("a",BASE);
      listener.onNotificationPosted(a);System.now++;
      listener.onNotificationPosted(noti(TR,"b",BASE+1,2,"b","Other title","56,78 €"));System.now++;
      listener.onNotificationPosted(a);admissions(2,"A retained across B");
    });
    run("source and package separate identities",()->{
      TrExpenseListener listener=reset();StatusBarNotification a=noti("source",BASE);
      call(listener,a,"tr");call(listener,a,"wallet");admissions(2,"source separation");
      listener=reset();listener.onNotificationPosted(noti(WALLET,"package",BASE,1,"tag",TITLE,TEXT));
      listener.onNotificationPosted(noti("com.google.android.apps.wallet","package",BASE,1,"tag",TITLE,TEXT));admissions(2,"package separation");
    });
    run("null and empty key use existing id tag fallback",()->{
      TrExpenseListener listener=reset();listener.onNotificationPosted(noti(TR,null,BASE,1,null,TITLE,TEXT));
      listener.onNotificationPosted(noti(TR,"",BASE,1,null,TITLE,TEXT));admissions(1,"null and empty keys share fallback");
      listener.onNotificationPosted(noti(TR,null,BASE,2,null,TITLE,TEXT));
      listener.onNotificationPosted(noti(TR,null,BASE,1,"different-tag",TITLE,TEXT));admissions(3,"fallback id and tag separate events");
      Thread.drain();
      String expected=TrExpenseListener.stableEventId("tr",TR,TR+"|1|null",BASE);
      equal(expected,sent.get(0).payload.get("evento"),"real null-key fallback event bytes");
      equal(TrExpenseListener.stableEventId("tr",TR,TR+"|2|null",BASE),sent.get(1).payload.get("evento"),"real fallback id bytes");
      equal(TrExpenseListener.stableEventId("tr",TR,TR+"|1|different-tag",BASE),sent.get(2).payload.get("evento"),"real fallback tag bytes");
      listener=reset();listener.onNotificationPosted(noti(TR,"",BASE,1,null,TITLE,TEXT));
      listener.onNotificationPosted(noti(TR,null,BASE,1,null,TITLE,TEXT));admissions(1,"empty-first fallback shares null identity");Thread.drain();
      equal(expected,sent.get(0).payload.get("evento"),"real empty-key fallback event bytes");
    });
    run("179999 180000 and no timestamp refresh",()->{
      TrExpenseListener listener=reset();StatusBarNotification a=noti("boundary",BASE);listener.onNotificationPosted(a);
      System.now=BASE+179999;listener.onNotificationPosted(a);admissions(1,"179999 suppresses");
      System.now=BASE+180000;listener.onNotificationPosted(a);admissions(2,"180000 admits without refresh from suppressed callback");
    });
    run("service recreation keeps A after B",()->{
      TrExpenseListener listener=reset();StatusBarNotification a=noti("persistent-a",BASE);listener.onNotificationPosted(a);
      System.now++;listener.onNotificationPosted(noti(TR,"persistent-b",BASE+1,2,"tag",TITLE,"56,78 €"));System.now++;
      new TrExpenseListener().onNotificationPosted(a);admissions(2,"preferences survive listener instance recreation");
    });
    run("bounded concurrent callbacks",()->{
      TrExpenseListener listener=reset();StatusBarNotification a=noti("concurrent",BASE);
      parallel(()->listener.onNotificationPosted(a),()->new TrExpenseListener().onNotificationPosted(a));admissions(1,"concurrent same identity");
      TrExpenseListener distinct=reset();parallel(()->distinct.onNotificationPosted(noti("concurrent-a",BASE)),()->new TrExpenseListener().onNotificationPosted(noti("concurrent-b",BASE)));admissions(2,"concurrent distinct identities");
    });
    run("deterministic check record interleaving",NativeEventDebounceTest::atomicInterleaving);
    run("invalid postTime keeps current now fallback",()->{
      TrExpenseListener listener=reset();listener.onNotificationPosted(noti("no-time",0));System.now++;
      listener.onNotificationPosted(noti("no-time",-1));admissions(2,"no promise of stable replay for invalid postTime");Thread.drain();
      equal(String.valueOf(BASE),sent.get(0).payload.get("fecha"),"zero postTime fallback");
      equal(String.valueOf(BASE+1),sent.get(1).payload.get("fecha"),"negative postTime fallback");
    });
    run("literal v1 and real payload token boundary",()->{
      equal("v1_591323eb8c7c74d060a22b58e0bd852bcd055d49d2f1a941ee396144283abae7",TrExpenseListener.stableEventId("tr","fixture.package","fixture.key",12345),"fixed v1 vector");
      TrExpenseListener listener=reset();listener.onNotificationPosted(noti("payload",BASE));Thread.drain();equal(1,sent.size(),"one transport");
      Sent record=sent.get(0);equal(TITLE,record.payload.get("titulo"),"title preserved");equal(TEXT,record.payload.get("texto"),"text/cent representation preserved");
      equal("tr",record.payload.get("fuente"),"source preserved");equal(String.valueOf(BASE),record.payload.get("fecha"),"postTime preserved");
      equal(TrExpenseListener.stableEventId("tr",TR,"payload",BASE),record.payload.get("evento"),"actual identity forwarded");
      equal("fixture+token",record.token,"token decoded into header");equal("mode=fixture",record.url.getQuery(),"token absent from URL");
      equal(MiCarteraWidget.issued,MiCarteraWidget.finished,"tickets finish");
    });
    run("empty identity fail-open",NativeEventDebounceTest::emptyIdentity);
    run("approved rollback policy",NativeEventDebounceTest::rollback);
    java.lang.System.out.println("PASS native debounce: real listener/helper; offline boundaries only; no APK/device acceptance");
  }
}

// Reloj y despacho son fronteras controladas; ninguna contiene claves ni ventanas de dedupe.
final class System {
  static volatile long now; static long currentTimeMillis(){return now;}
}
final class Thread {
  private static final List<Runnable> pending=new ArrayList<>(); private final Runnable work;
  Thread(Runnable work){this.work=work;}
  void start(){synchronized(pending){pending.add(work);}}
  static int size(){synchronized(pending){return pending.size();}}
  static void clear(){synchronized(pending){pending.clear();}}
  static void drain(){while(true){Runnable next;synchronized(pending){if(pending.isEmpty())return;next=pending.remove(0);}next.run();}}
}
final class BuildConfig {static final boolean DEBUG=false;static final String INGEST_URL="";}
final class WidgetPeriod {static final int CONTRACT=2;}
final class MiCarteraWidget {
  static long issued,finished;static long beginIngest(Object context){return ++issued;}
  static void finishIngest(Object context,long ticket){finished++;}
  static long monthStart(long time){return 0;}
  static boolean saveLegacyPayment(Object...args){return false;}
  static void saveMonth(Object...args){}
}
final class Notif {static int idFor(String key){return 1;}static void show(Object...args){} }
`);

const bin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin") : "C:/Program Files/Android/Android Studio/jbr/bin";
const javac = fs.existsSync(path.join(bin, "javac.exe")) ? path.join(bin, "javac.exe") : "javac";
const java = javac === "javac" ? "java" : path.join(bin, "java.exe");
durable(path.join(dir, "manifest.json"), {
  schema: 1, harnessSHA256: hash(fs.readFileSync(import.meta.filename)), base,
  listenerSHA256: hash(listener), helperPresent: fs.existsSync(helper),
  clockRollbackPolicy: CLOCK_ROLLBACK_POLICY, sources: manifest,
  limits: "one compiler then one JVM, ActiveProcessorCount=1/SerialGC; bounded two callback threads, zero retries",
  boundaries: "Android/prefs memory, JSON representation, URL transport, deterministic clock and queued dispatch; no Android OS/crash/E2E claim"
});
let step = 0, failed = false;
try {
  for (const [command, args] of [
    [javac, ["-J-XX:ActiveProcessorCount=1", "-J-XX:+UseSerialGC", "-encoding", "UTF-8", "-d", classes, ...javaFiles]],
    [java, ["-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-cp", classes, "com.micartera.app.NativeEventDebounceTest"]]
  ]) {
    step++;
    durable(path.join(dir, "step-" + step + "-ENTER.json"), { atUTC: new Date().toISOString(), command, args, attempt: 1, retries: 0 });
    const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const proof = { atUTC: new Date().toISOString(), exitCode: result.status, signal: result.signal, error: result.error?.message || null, stdout: result.stdout || "", stderr: result.stderr || "" };
    durable(path.join(dir, "step-" + step + "-EXIT.json"), proof);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      failed = true;
      durable(path.join(dir, "report.json"), { status: "FAIL", stage: step === 1 ? "compile-setup" : "java-oracle", exitCode: result.status, retries: 0, harnessSHA256: hash(fs.readFileSync(import.meta.filename)) });
      process.exitCode = 1;
      break;
    }
  }
  if (!failed) durable(path.join(dir, "report.json"), { status: "PASS", steps: step, retries: 0, harnessSHA256: hash(fs.readFileSync(import.meta.filename)) });
} finally {
  // El runner propietario conserva admisión/censo/RETURN; estos artefactos no otorgan un lease.
  process.stdout.write("native-event-debounce artifacts: " + dir + "\n");
}
