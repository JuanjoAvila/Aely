#!/usr/bin/env node
// INC-0210-04: transporte/cola reales con HTTP y preferencias en memoria, sin banco ni APK.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root=path.resolve(import.meta.dirname,"..");
const javaDir=path.join(root,"android/app/src/main/java/com/micartera/app");
const listener=fs.readFileSync(path.join(javaDir,"TrExpenseListener.java"),"utf8");
const constants=["OK","REINTENTAR","DESCARTAR","COLA_PREFS","COLA_MAX","COLA_TTL"].map(name=>{
  const m=listener.match(new RegExp("^    private static final (?:int|long|String) "+name+"[^\\n]*?;","m"));
  assert.ok(m,"falta la constante real "+name);
  return m[0];
}).join("\n");
const methods=["postIngest","encolar","vaciarCola","leerCola","splitIngest","readAll","stableEventId"].map(name=>{
  const m=listener.match(new RegExp("^    (?:private |static )[^\\n]* "+name+"\\([^]*?^    }","m"));
  assert.ok(m,"falta el método real "+name);
  return m[0].replaceAll("android.content.SharedPreferences","Prefs").replaceAll("org.json.","");
}).join("\n");
assert.match(listener,/if \(postIngest\(INGEST_URL, body\) == REINTENTAR\) encolar\(INGEST_URL, body\)/);
assert.match(listener,/new Thread\(this::vaciarCola\)\.start\(\)/);
const jdk=process.env.JAVA_HOME;
const bin=jdk?path.join(jdk,"bin"):"C:/Program Files/Android/Android Studio/jbr/bin";
const javac=fs.existsSync(path.join(bin,"javac.exe"))?path.join(bin,"javac.exe"):"javac";
const java=javac==="javac"?"java":path.join(bin,"java.exe");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aely-widget-offline-"));
try {
  const src=path.join(dir,"ListenerOfflineTest.java");
  fs.writeFileSync(src,`package com.micartera.app;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
public class ListenerOfflineTest {
  static final int MODE_PRIVATE=0;
  ${constants}
  static final Prefs prefs=new Prefs();
  static final WidgetSnapshotArbiter.State state=new WidgetSnapshotArbiter.State();
  static int code, sent, received; static boolean offline; static String response, lastBody, lastEvent;
  static class Prefs {
    String value="[]";
    String getString(String k,String fallback){return value;}
    Prefs edit(){return this;}
    Prefs putString(String k,String v){value=v;return this;}
    Prefs remove(String k){value="[]";return this;}
    void apply(){}
  }
  // Solo la representación JSON se sustituye: los métodos de POST, cola y hash son la fuente.
  static final Map<String,Object> json=new HashMap<>();
  static String encode(Object o){String k="fixture"+json.size();json.put(k,o);return k;}
  static class JSONObject {
    Map<String,Object> data=new HashMap<>();
    JSONObject(){}
    JSONObject(String s){if(!json.containsKey(s)) throw new IllegalArgumentException(); data=new HashMap<>(((JSONObject)json.get(s)).data);}
    JSONObject put(String k,Object v){data.put(k,v);return this;}
    String optString(String k,String fallback){return String.valueOf(data.getOrDefault(k,fallback));}
    long optLong(String k,long fallback){return ((Number)data.getOrDefault(k,fallback)).longValue();}
    public String toString(){return encode(this);}
  }
  static class JSONArray {
    List<JSONObject> data=new ArrayList<>();
    JSONArray(){}
    JSONArray(String s){if(!s.equals("[]")) data=new ArrayList<>(((JSONArray)json.get(s)).data);}
    int length(){return data.size();}
    void put(JSONObject o){data.add(o);}
    void remove(int i){data.remove(i);}
    JSONObject optJSONObject(int i){return data.get(i);}
    public String toString(){return encode(this);}
  }
  static class MiCarteraWidget {
    static long beginIngest(Object ctx){return WidgetSnapshotArbiter.begin(state);}
    static long monthStart(long t){return WidgetPeriod.monthStart(t);}
  }
  Prefs getSharedPreferences(String key,int mode){return prefs;}
  void handleResponse(String resp,long ticket,String event){received++;lastEvent=event;}
  ${methods}
  static void ok(boolean b){if(!b)throw new AssertionError("transición incorrecta");}
  static class Connection extends HttpURLConnection {
    final ByteArrayOutputStream body=new ByteArrayOutputStream();
    Connection(URL u){super(u);}
    public void connect(){} public void disconnect(){} public boolean usingProxy(){return false;}
    public OutputStream getOutputStream() throws IOException {sent++;if(offline)throw new IOException("offline sintético");return body;}
    public int getResponseCode(){lastBody=body.toString(StandardCharsets.UTF_8);return code;}
    public InputStream getInputStream(){return new ByteArrayInputStream(response.getBytes(StandardCharsets.UTF_8));}
    public InputStream getErrorStream(){return getInputStream();}
  }
  public static void main(String[] args) throws Exception {
    URL.setURLStreamHandlerFactory(protocol->new URLStreamHandler(){protected URLConnection openConnection(URL u){return new Connection(u);}});
    ListenerOfflineTest app=new ListenerOfflineTest();
    long period=WidgetPeriod.monthStart(System.currentTimeMillis());
    WidgetSnapshotArbiter.app(state,period,40,100,60.0,150.0,200.0,"trade_republic","Cuenta","","");
    String id=stableEventId("tr","fixture.package","fixture.key",12345);
    ok(id.equals(stableEventId("tr","fixture.package","fixture.key",12345)));
    ok(!id.equals(stableEventId("tr","fixture.package","fixture.key",12346)));
    String body=new JSONObject().put("evento",id).toString();
    offline=true; response="respuesta sintética";
    ok(app.postIngest("https://fixture.invalid",body)==REINTENTAR);
    app.encolar("https://fixture.invalid",body);
    ok(state.spent==40 && !state.unknownPending && !state.journalFull);
    // La caída de red por sí sola no causa el guion en esta ruta: todavía no hubo respuesta.
    ListenerOfflineTest reboot=new ListenerOfflineTest(); reboot.vaciarCola();
    ok(leerCola(prefs).length()==1 && received==0);
    offline=false; code=503; reboot.vaciarCola(); ok(leerCola(prefs).length()==1);
    code=200; reboot.vaciarCola();
    ok(leerCola(prefs).length()==0 && received==1 && lastEvent.equals(id) && lastBody.equals(body));
    reboot.vaciarCola(); ok(received==1); // una cola vacía no reenvía el pago
    code=429; ok(reboot.postIngest("https://fixture.invalid",body)==REINTENTAR);
    code=401; ok(reboot.postIngest("https://fixture.invalid",body)==DESCARTAR);
    System.out.println("  PASS: sin red, listener recreado, retry 503/429, recuperación 200 e identidad estable; sin mutación financiera por transporte");
  }
}`);
  for(const [cmd,args] of [[javac,["-encoding","UTF-8","-d",dir,path.join(javaDir,"WidgetSnapshotArbiter.java"),path.join(javaDir,"WidgetPeriod.java"),src]],[java,["-cp",dir,"com.micartera.app.ListenerOfflineTest"]]]){
    const r=spawnSync(cmd,args,{cwd:root,encoding:"utf8"});
    assert.equal(r.status,0,String(r.error||r.stderr||r.stdout));
    if(r.stdout) process.stdout.write(r.stdout);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
