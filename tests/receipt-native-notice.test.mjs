import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createLogicSandbox} from "../scripts/load-pure-logic.mjs";

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("src/modules/11-app-main.js"),c=createLogicSandbox();
vm.runInNewContext(fs.readdirSync(path.join(root,"src/modules")).filter(f=>/^0\d-/.test(f)).sort().map(f=>read("src/modules/"+f)).join("\n"),c);
vm.runInContext(app.slice(0,app.indexOf("function App(){")),c);
const target={id:"target",name:"Luz sintética",amount:89.54,account:"sabadell",day:27,freq:"mes"};
const s={accounts:[{id:"sb",ent:"sabadell",value:100,role:"fijos"}],fixed:[target],debts:[],oneoffs:[],flows:[],expenses:[],bankTx:[],deleted:[],settings:{}};
const totals={curYear:2026,curMonth:9,today:26,bankBal:{sabadell:100}};
const capture=app.slice(app.indexOf("  const alertCalendarOf=function(){"),app.indexOf("  // Recordatorio de recibos:")).replace("const alertCalendarOf=","var capturedCalendar=");
let calculations=0;const original=c.receiptAlertBalance,flags=new Map();
c.receiptAlertBalance=(...args)=>{calculations++;return original(...args);};
Object.assign(c,{state:s,totals,mcSandbox:()=>false,localStorage:{getItem:k=>flags.get(k)}});
vm.runInContext(capture,c);
for(const lang of ["es","en","ca"]){
  vm.runInContext('CURLANG="'+lang+'";',c);
  const n=c.capturedCalendar().charges[0].balanceNotice;
  assert.equal(n.lang,lang);assert.equal(n.state,"enough");assert.equal(n.remainingCents,1046);
  assert.equal(n.calculatedOn,"2026-09-26");assert.equal(n.dueOn,"2026-09-27");
}
c.totals={...totals,bankBal:{sabadell:20}};
assert.equal(c.capturedCalendar().charges[0].balanceNotice.shortfallCents,6954);
c.state={...s,fixed:[{...target,account:undefined}]};
assert.equal(c.capturedCalendar().charges[0].balanceNotice.state,"unknown");
c.state={...s,fixed:[],debts:[{id:"loan",name:"Cuota",monthly:60,value:1000,account:"sabadell",day:27,asOf:2026*12+8}]};
assert.equal(c.capturedCalendar().charges[0].id,"debt_loan");
assert.equal(c.capturedCalendar().charges[0].balanceNotice.shortfallCents,4000);
c.state=s;flags.set("_rc1_target_2026-09","1");calculations=0;
assert.equal(c.capturedCalendar().charges[0].balanceNotice,undefined);assert.equal(calculations,0);
c.mcSandbox=()=>true;assert.equal(c.capturedCalendar().charges.length,0);assert.equal(calculations,0);
console.log("receipt-native-notice: productor, idiomas, céntimos, desconocido, deuda, sello y sandbox OK");

const jdk=process.env.JAVA_HOME&&path.join(process.env.JAVA_HOME,"bin");
const androidJdk="C:/Program Files/Android/Android Studio/jbr/bin";
const javac=jdk&&fs.existsSync(path.join(jdk,process.platform==="win32"?"javac.exe":"javac"))?path.join(jdk,"javac"):
  fs.existsSync(path.join(androidJdk,"javac.exe"))?path.join(androidJdk,"javac.exe"):"javac";
const java=javac==="javac"?"java":javac.replace(/javac(\.exe)?$/,"java$1");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"aely-receipt-native-"));
const sources={
  "android/content/Context.java":`package android.content; public class Context { public static int MODE_PRIVATE=0; public SharedPreferences prefs=new SharedPreferences(); public SharedPreferences getSharedPreferences(String n,int m){return prefs;} }`,
  "android/content/SharedPreferences.java":`package android.content; import java.util.*; public class SharedPreferences { public Map<String,Object> values=new HashMap<>(); public String getString(String k,String d){return (String)values.getOrDefault(k,d);} public boolean getBoolean(String k,boolean d){return (Boolean)values.getOrDefault(k,d);} public SharedPreferences edit(){return this;} public SharedPreferences putBoolean(String k,boolean v){values.put(k,v);return this;} public void apply(){} }`,
  "android/util/Log.java":`package android.util; public class Log {public static int w(String t,String m){throw new AssertionError(m);} }`,
  "androidx/annotation/NonNull.java":`package androidx.annotation; public @interface NonNull {}`,
  "androidx/work/WorkerParameters.java":`package androidx.work; public class WorkerParameters {}`,
  "androidx/work/Worker.java":`package androidx.work; import android.content.Context; public class Worker { Context c; public Worker(Context c,WorkerParameters p){this.c=c;} public Context getApplicationContext(){return c;} public Result doWork(){return null;} public static class Result {public static Result success(){return new Result();}} }`,
  "org/json/JSONObject.java":`package org.json; import java.util.*; public class JSONObject {public static JSONObject current; Map<String,Object> m=new HashMap<>(); public JSONObject(){} public JSONObject(String raw){m=current.m;} public JSONObject put(String k,Object v){m.put(k,v);return this;} public Object opt(String k){return m.get(k);} public Iterator<String> keys(){return m.keySet().iterator();} public String optString(String k,String d){Object v=m.get(k);return v instanceof String?(String)v:d;} public int optInt(String k,int d){Object v=m.get(k);return v instanceof Number?((Number)v).intValue():d;} public double optDouble(String k,double d){Object v=m.get(k);return v instanceof Number?((Number)v).doubleValue():d;} public JSONObject optJSONObject(String k){Object v=m.get(k);return v instanceof JSONObject?(JSONObject)v:null;} public JSONArray optJSONArray(String k){Object v=m.get(k);return v instanceof JSONArray?(JSONArray)v:null;} }`,
  "org/json/JSONArray.java":`package org.json; import java.util.*; public class JSONArray {List<JSONObject> a=new ArrayList<>(); public JSONArray put(JSONObject o){a.add(o);return this;} public int length(){return a.size();} public JSONObject optJSONObject(int i){return a.get(i);} }`,
  "com/micartera/app/Notif.java":`package com.micartera.app; import android.content.Context; import java.util.*; class Notif {static List<String> titles=new ArrayList<>(),bodies=new ArrayList<>(); static List<Integer> ids=new ArrayList<>(); static void show(Context c,String t,String b,int id){titles.add(t);bodies.add(b);ids.add(id);} }`,
  "com/micartera/app/ReceiptNativeTest.java":`package com.micartera.app;
import java.util.*; import android.content.Context; import org.json.*;
public class ReceiptNativeTest {
 static int cases=0; static void ok(boolean v){cases++;if(!v)throw new AssertionError("caso "+cases);}
 static Map<String,Object> notice(){Map<String,Object> n=new HashMap<>();n.put("v",1);n.put("lang","es");n.put("state","enough");n.put("bankLabel","Sabadell");n.put("remainingCents",1046);n.put("calculatedOn","2026-09-26");n.put("dueOn","2026-09-27");return n;}
 static String[] render(Map<String,Object> n){return ReceiptBalanceNotice.render(n,"2026-09-26","2026-09-27","2026-09",27,"Luz",89.54);}
 static void invalid(String key,Object value){Map<String,Object> n=notice();n.put(key,value);ok(render(n)==null);}
 public static void main(String[] args){
  ok(render(null)==null);
  for(String lang:new String[]{"es","en","ca"}){
   Map<String,Object> n=notice();n.put("lang",lang);String[] yes=render(n);ok(yes[1].contains("10,46 €"));ok(yes[1].contains("89,54 €"));
   n.put("state","short");n.remove("remainingCents");n.put("shortfallCents",6954);String[] no=render(n);ok(no[1].contains("69,54 €"));
   ok(no[1].contains(lang.equals("es")?"faltarían":lang.equals("en")?"short":"faltarien"));
  }
  Map<String,Object> optional=notice();optional.remove("remainingCents");ok(render(optional)!=null);ok(!render(optional)[1].contains("quedarían"));
  for(Object n:new Object[]{null,"1046",-1,1.5,Double.NaN,Double.POSITIVE_INFINITY,9007199254740992d})invalid("remainingCents",n);
  for(Object n:new Object[]{null,"1",2,1.1})invalid("v",n);
  for(Object n:new Object[]{null,"",123})invalid("bankLabel",n);
  invalid("lang","fr");invalid("state","unknown");invalid("state","other");
  invalid("calculatedOn","2026-09-25");invalid("calculatedOn","2026-9-26");invalid("dueOn","2026-09-28");invalid("dueOn","2026-09-31");
  for(Object value:new Object[]{null,0,-1,1.1,"12"}){Map<String,Object> n=notice();n.put("state","short");n.remove("remainingCents");n.put("shortfallCents",value);ok(render(n)==null);}
  invalid("shortfallCents",12);
  // Ejecuta el worker real: los stubs sustituyen solo Android/JSON, no la decisión ni el texto.
  Calendar now=Calendar.getInstance(),tom=(Calendar)now.clone();tom.add(Calendar.DAY_OF_MONTH,1);
  String today=String.format(Locale.ROOT,"%04d-%02d-%02d",now.get(Calendar.YEAR),now.get(Calendar.MONTH)+1,now.get(Calendar.DAY_OF_MONTH));
  String due=String.format(Locale.ROOT,"%04d-%02d-%02d",tom.get(Calendar.YEAR),tom.get(Calendar.MONTH)+1,tom.get(Calendar.DAY_OF_MONTH));
  String ym=due.substring(0,7);int day=tom.get(Calendar.DAY_OF_MONTH);
  JSONObject data=new JSONObject();for(Map.Entry<String,Object> e:notice().entrySet())data.put(e.getKey(),e.getValue());data.put("calculatedOn",today).put("dueOn",due);
  JSONArray charges=new JSONArray().put(new JSONObject().put("id","bill").put("name","Luz").put("amount",89.54).put("day",day).put("balanceNotice",data))
   .put(new JSONObject().put("id","debt_loan").put("name","Cuota").put("amount",60).put("day",day))
   .put(new JSONObject().put("id","later").put("name","Futuro").put("amount",80).put("day",day+1));
  JSONObject.current=new JSONObject().put("ym",ym).put("charges",charges);
  Context ctx=new Context();ctx.prefs.values.put("cal","synthetic");AlertCheckWorker.check(ctx);
  ok(Notif.bodies.size()==2);ok(Notif.bodies.get(0).contains("quedarían 10,46 €"));
  ok(Notif.bodies.get(1).equals("Cuota: mañana se cobran 60,00 €. Si algo no cuadra, aún estás a tiempo."));
  ok(Notif.ids.get(0)==72000+Math.abs("bill".hashCode())%900);ok(Notif.ids.get(1)==72000+Math.abs("debt_loan".hashCode())%900);
  AlertCheckWorker.check(ctx);ok(Notif.bodies.size()==2);
  data.put("calculatedOn","2000-01-01");ctx.prefs.values.remove("rc_bill_"+ym);AlertCheckWorker.check(ctx);
  ok(Notif.bodies.size()==3);ok(Notif.bodies.get(2).equals("Luz: mañana se cobran 89,54 €. Si algo no cuadra, aún estás a tiempo."));
  System.out.println("receipt-native-notice: JVM "+cases+" PASS (worker y contrato reales)");
 }
}`,
};
try {
  const files=[];
  for(const [name,source] of Object.entries(sources)){const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);files.push(file);}
  const main=path.join(root,"android/app/src/main/java/com/micartera/app");
  for(const [command,args] of [[javac,["-encoding","UTF-8","-d",dir,...files,path.join(main,"ReceiptBalanceNotice.java"),path.join(main,"AlertCheckWorker.java")]],[java,["-cp",dir,"com.micartera.app.ReceiptNativeTest"]]]){
    const result=spawnSync(command,args,{encoding:"utf8"});assert.equal(result.status,0,result.error||result.stderr||result.stdout);process.stdout.write(result.stdout);
  }
} finally {
  // mkdtemp es propio y siempre hijo directo del temporal del sistema.
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true,force:true});
}
