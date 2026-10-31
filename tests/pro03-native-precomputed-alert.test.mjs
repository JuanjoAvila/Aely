#!/usr/bin/env node
// Ejecuta el worker real en JVM; los dobles no acreditan Android, su parser ni el dispositivo.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = "android/app/src/main/java/com/micartera/app/AlertCheckWorker.java";
const allowed = new Set(["phase", "source-ref", "jdk-home", "output-dir"]), options = {};
for (const arg of process.argv.slice(2)) {
  const equal = arg.indexOf("=");
  assert.ok(arg.startsWith("--") && equal > 2, "opción con valor obligatorio");
  const name = arg.slice(2, equal);
  assert.ok(allowed.has(name) && !Object.hasOwn(options, name), "opción desconocida o repetida");
  options[name] = arg.slice(equal + 1);
}
const phase = options.phase || "candidate";
assert.ok(["baseline", "candidate", "causal"].includes(phase), "fase desconocida");
assert.equal(!!options["source-ref"], phase === "baseline", "solo baseline lee la base exacta");
if (options["source-ref"]) assert.equal(options["source-ref"], "656f17a69acdb59a4bfd14ea51a50196157b5807");
const javaName = process.platform === "win32" ? "java.exe" : "java";
const javacName = process.platform === "win32" ? "javac.exe" : "javac";
function jdkAt(bin) {
  const java = path.join(bin, javaName), javac = path.join(bin, javacName);
  return fs.existsSync(java) && fs.statSync(java).isFile() && fs.existsSync(javac) && fs.statSync(javac).isFile() ? { java, javac } : null;
}
// El runner puede invocarlo sin opciones: localizar archivos no ejecuta ni instala un JDK.
let jdk;
if (options["jdk-home"]) {
  jdk = jdkAt(path.join(options["jdk-home"], "bin"));
} else {
  if (process.env.JAVA_HOME) jdk = jdkAt(path.join(process.env.JAVA_HOME, "bin"));
  if (!jdk) for (const entry of (process.env.PATH || process.env.Path || "").split(path.delimiter)) {
    if (!entry) continue;
    jdk = jdkAt(entry.replace(/^"|"$/g, ""));
    if (jdk) break;
  }
}
if (!jdk) {
  console.log("SKIP pro03-native-precomputed-alert: falta JDK (java y javac); indicar --jdk-home, JAVA_HOME o PATH");
  process.exit(0);
}
const { java, javac } = jdk;
let runtimeParent, runtime, runtimeIdentity, dir;
const keepEvidence = !!options["output-dir"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function durable(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const fd = fs.openSync(file, "wx");
  try { fs.writeFileSync(fd, b); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  assert.ok(fs.readFileSync(file).equals(b), "readback exacto de " + file);
  return { path: file, bytes: b.length, sha256: hash(b), fileFsync: true, readbackExact: true, directoryDurabilityClaimed: false };
}
const json = (file, value) => durable(file, JSON.stringify(value, null, 2) + "\n");
function assertRuntime() {
  assert.equal(path.resolve(runtime), runtime, "runtime absoluto propio");
  assert.equal(path.dirname(runtime), runtimeParent, "solo el hijo mkdtemp propio, nunca su padre");
  assert.equal(fs.realpathSync(runtimeParent), runtimeParent, "padre real sin redirección");
  const current = fs.lstatSync(runtime);
  assert.ok(current.isDirectory() && !current.isSymbolicLink(), "root propio no sustituido por enlace");
  assert.equal(current.dev, runtimeIdentity.dev, "dispositivo del root propio");
  assert.equal(current.ino, runtimeIdentity.ino, "identidad del root propio");
  assert.equal(fs.realpathSync(runtime), runtime, "root real sin redirección");
}
function cleanupRuntime() {
  assertRuntime();
  function remove(entry) {
    assertRuntime();
    const relative = path.relative(runtime, entry);
    assert.ok(!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep), "cleanup dentro del runtime propio");
    assert.equal(fs.realpathSync(path.dirname(entry)), path.dirname(entry), "no atravesar padres enlazados");
    const stat = fs.lstatSync(entry);
    // lstat distingue junctions/enlaces: se quita el enlace, nunca se visita su destino.
    if (stat.isSymbolicLink()) fs.unlinkSync(entry);
    else if (stat.isDirectory()) {
      assert.equal(fs.realpathSync(entry), entry, "directorio real dentro del runtime");
      for (const name of fs.readdirSync(entry)) remove(path.join(entry, name));
      fs.rmdirSync(entry);
    } else fs.unlinkSync(entry);
  }
  for (const name of fs.readdirSync(runtime)) remove(path.join(runtime, name));
  assertRuntime();
  fs.rmdirSync(runtime);
}
let attempt = 0;
const processes = [];
function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: root, maxBuffer: 8 * 1024 * 1024, timeout: 120000 });
  const stdoutBytes = result.stdout || Buffer.alloc(0), stderrBytes = result.stderr || Buffer.alloc(0);
  const prefix = path.join(dir, String(++attempt).padStart(2, "0") + "-" + label);
  const stdout = durable(prefix + ".stdout", stdoutBytes);
  const stderr = durable(prefix + ".stderr", stderrBytes);
  const record = { command, args, status: result.status, signal: result.signal, error: result.error?.message || null, stdout, stderr };
  json(prefix + ".json", record); processes.push(record);
  process.stdout.write(stdoutBytes); process.stderr.write(stderrBytes);
  assert.equal(record.error, null, "fallo de herramienta, no resultado de producto");
  // Solo los marcadores ASCII se interpretan; la evidencia anterior conserva los bytes originales.
  return { ...result, stdout: stdoutBytes.toString("utf8"), stderr: stderrBytes.toString("utf8") };
}

// El JSON se construye en memoria: no se suplanta ninguna regla financiera ni del worker.
const doubles = {
  "android/content/Context.java": String.raw`package android.content;
public class Context {
 public static final int MODE_PRIVATE=0;
 public final SharedPreferences prefs=new SharedPreferences();
 public SharedPreferences getSharedPreferences(String name,int mode){return prefs;}
}`,
  "android/content/SharedPreferences.java": String.raw`package android.content;
import java.util.*;
public class SharedPreferences {
 public final Map<String,Object> values=new HashMap<>();
 public String getString(String key,String fallback){Object v=values.get(key);return v instanceof String?(String)v:fallback;}
 public boolean getBoolean(String key,boolean fallback){Object v=values.get(key);return v instanceof Boolean?(Boolean)v:fallback;}
 public Editor edit(){return new Editor();}
 public class Editor {
  private final Map<String,Object> pending=new HashMap<>();
  public Editor putBoolean(String key,boolean value){pending.put(key,value);return this;}
  public void apply(){values.putAll(pending);}
 }
}`,
  "android/util/Log.java": String.raw`package android.util;
public class Log {public static int w(String tag,String message){System.err.println("WORKER_LOG|"+message);return 0;}}`,
  "androidx/annotation/NonNull.java": "package androidx.annotation; public @interface NonNull {}",
  "androidx/work/WorkerParameters.java": "package androidx.work; public class WorkerParameters {}",
  "androidx/work/Worker.java": String.raw`package androidx.work;
import android.content.Context;
public class Worker {
 private final Context context;
 public Worker(Context c,WorkerParameters p){context=c;}
 public Context getApplicationContext(){return context;}
 public Result doWork(){return null;}
 public static class Result {public static Result success(){return new Result();}}
}`,
  "org/json/JSONObject.java": String.raw`package org.json;
import java.util.*;
public class JSONObject {
 public static final Object NULL=new Object();
 public static JSONObject current;
 private final Map<String,Object> values;
 public JSONObject(){values=new HashMap<>();}
 public JSONObject(String raw){if(!"fixture-calendar".equals(raw)||current==null)throw new IllegalArgumentException("JSON boundary");values=current.values;}
 public JSONObject put(String key,Object value){values.put(key,value);return this;}
 public Object opt(String key){return values.get(key);}
 public String optString(String key,String fallback){Object v=opt(key);return v==null||v==NULL?fallback:String.valueOf(v);}
 public int optInt(String key,int fallback){Object v=opt(key);if(v instanceof Number)return ((Number)v).intValue();try{return Integer.parseInt(String.valueOf(v));}catch(Exception e){return fallback;}}
 public double optDouble(String key,double fallback){Object v=opt(key);if(v instanceof Number)return ((Number)v).doubleValue();try{return Double.parseDouble(String.valueOf(v));}catch(Exception e){return fallback;}}
 public JSONArray optJSONArray(String key){Object v=opt(key);return v instanceof JSONArray?(JSONArray)v:null;}
}`,
  "org/json/JSONArray.java": String.raw`package org.json;
import java.util.*;
public class JSONArray {
 private final List<Object> values=new ArrayList<>();
 public JSONArray put(Object value){values.add(value);return this;}
 public int length(){return values.size();}
 public JSONObject optJSONObject(int i){Object v=values.get(i);return v instanceof JSONObject?(JSONObject)v:null;}
}`,
  "com/micartera/app/Notif.java": String.raw`package com.micartera.app;
import android.content.Context;
import java.util.*;
class Notif {
 static final List<String> titles=new ArrayList<>(),bodies=new ArrayList<>();
 static final List<Integer> ids=new ArrayList<>();
 static final List<Map<String,Object>> prefsAtShow=new ArrayList<>();
 static void reset(){titles.clear();bodies.clear();ids.clear();prefsAtShow.clear();}
 static void show(Context c,String title,String body,int id){titles.add(title);bodies.add(body);ids.add(id);prefsAtShow.add(new HashMap<>(c.prefs.values));}
}`,
  "com/micartera/app/ReceiptNativeFixture.java": String.raw`package com.micartera.app;
import android.content.Context;
import org.json.*;
import java.math.BigDecimal;
import java.util.*;
public class ReceiptNativeFixture {
 private static Calendar clock;
 private static String filter="all",currentCase="setup";
 private static int cases=0;
 interface Scenario {void run();}
 public static Calendar now(){return (Calendar)clock.clone();}
 private static void at(String zone,int y,int m,int d,int h,int min){
  clock=Calendar.getInstance(TimeZone.getTimeZone(zone),Locale.ROOT);clock.clear();clock.setLenient(false);clock.set(y,m-1,d,h,min,0);clock.getTimeInMillis();
 }
 private static void standard(){at("Europe/Madrid",2026,10,12,12,30);}
 private static void eq(Object expected,Object actual,String field){if(!Objects.equals(expected,actual))throw new AssertionError(currentCase+" "+field+" expected=["+expected+"] actual=["+actual+"]");}
 private static void scenario(String name,Scenario action){if(!filter.equals("all")&&!filter.equals(name))return;currentCase=name;standard();action.run();cases++;System.out.println("PASS|"+name);}
 private static JSONObject eve(String title,String body,String coverage){return new JSONObject().put("v",1).put("title",title).put("body",body).put("coverage",coverage).put("calculatedOn","2026-10-12").put("dueOn","2026-10-13");}
 private static JSONObject normal(){return eve("Mañana toca recibo","Recibo: mañana se cobran 12,34 €. El saldo previsto llega.","enough");}
 private static JSONObject row(String id,Object optional){return new JSONObject().put("id",id).put("name","Recibo").put("amount",12.34).put("day",13).put("eve",optional);}
 private static Context context(String ym,JSONArray rows){Notif.reset();JSONObject.current=new JSONObject().put("ym",ym).put("charges",rows);Context ctx=new Context();ctx.prefs.values.put("cal","fixture-calendar");return ctx;}
 private static String legacy(){return "Recibo: mañana se cobran 12,34 €. Si algo no cuadra, aún estás a tiempo.";}
 private static void one(JSONObject data,String title,String body){Context c=context("2026-10",new JSONArray().put(row("bill",data)));AlertCheckWorker.check(c);eq(1,Notif.bodies.size(),"count");eq(title,Notif.titles.get(0),"title");eq(body,Notif.bodies.get(0),"body");}
 private static void fallback(Object data){Context c=context("2026-10",new JSONArray().put(row("bill",data)));AlertCheckWorker.check(c);eq(1,Notif.bodies.size(),"legacy count");eq("Mañana toca recibo",Notif.titles.get(0),"legacy title");eq(legacy(),Notif.bodies.get(0),"legacy cents/body");}
 private static void invalid(String label,String field,Object value){scenario(label,()->fallback(normal().put(field,value)));}
 private static void clocks(String name,String zone,int y,int m,int d,int h,int min,String ym,int dueDay,String today,String due,boolean shows){
  scenario(name,()->{at(zone,y,m,d,h,min);JSONObject n=normal().put("calculatedOn",today).put("dueOn",due);Context c=context(ym,new JSONArray().put(row("bill",n).put("day",dueDay)));AlertCheckWorker.check(c);eq(shows?1:0,Notif.bodies.size(),"calendar count");if(shows)eq("Recibo: mañana se cobran 12,34 €. El saldo previsto llega.",Notif.bodies.get(0),"calendar body");});
 }
 private static void suite(){
  String[] langs={"es","en","ca"},coverages={"enough","short","unknown"};
  String[] titles={"Mañana toca recibo","Bill due tomorrow","Demà toca rebut"};
  String[][] bodies={
   {"Recibo: mañana se cobran 12,34 €. El saldo previsto llega.","Recibo: mañana se cobran 12,34 €. El saldo previsto no llega.","Recibo: mañana se cobran 12,34 €. Si algo no cuadra, aún estás a tiempo."},
   {"Bill: 12,34 € will be charged tomorrow. Projected balance covers it.","Bill: 12,34 € will be charged tomorrow. Projected balance does not cover it.","Bill: 12,34 € will be charged tomorrow. There is still time to check it."},
   {"Rebut: demà es cobren 12,34 €. El saldo previst arriba.","Rebut: demà es cobren 12,34 €. El saldo previst no arriba.","Rebut: demà es cobren 12,34 €. Encara hi ha temps de revisar-ho."}
  };
  for(int l=0;l<3;l++)for(int k=0;k<3;k++){final int language=l,coverage=k;scenario("S-"+langs[l]+"-"+coverages[k],()->one(eve(titles[language],bodies[language][coverage],coverages[coverage]),titles[language],bodies[language][coverage]));}
  scenario("S-literal",()->{String title="  Demà: Àé 🙂  ",body="  Previsió literal: 12,34 €; 中文 🙂  ";one(eve(title,body,"short"),title,body);});
  scenario("V-number-long",()->one(normal().put("v",1L),"Mañana toca recibo","Recibo: mañana se cobran 12,34 €. El saldo previsto llega."));
  scenario("V-number-decimal",()->one(normal().put("v",new BigDecimal("1.000")),"Mañana toca recibo","Recibo: mañana se cobran 12,34 €. El saldo previsto llega."));
  Object[] badVersions={null,JSONObject.NULL,"1",true,0,2,1.1,Double.NaN,Double.POSITIVE_INFINITY,new BigDecimal("1.0000000000000000001")};
  for(int i=0;i<badVersions.length;i++)invalid("V-invalid-"+i,"v",badVersions[i]);
  Object[] badOptional={null,JSONObject.NULL,12,true,"eve",new JSONArray(),new JSONObject()};
  for(int i=0;i<badOptional.length;i++){final Object value=badOptional[i];scenario("O-invalid-"+i,()->fallback(value));}
  scenario("O-absent",()->{JSONObject r=new JSONObject().put("id","bill").put("name","Recibo").put("amount",12.34).put("day",13);Context c=context("2026-10",new JSONArray().put(r));AlertCheckWorker.check(c);eq(1,Notif.bodies.size(),"count");eq(legacy(),Notif.bodies.get(0),"legacy absent");});
  Object[] badText={null,JSONObject.NULL,12,true,new JSONObject(),new JSONArray(),""," \t",String.valueOf((char)0xa0)+(char)0x2007+(char)0x202f,"before\nafter","before\rafter","before"+(char)0xb+"after","before"+(char)0xc+"after","before"+(char)0x85+"after","before"+(char)0x2028+"after","before"+(char)0x2029+"after"};
  for(String field:new String[]{"title","body"})for(int i=0;i<badText.length;i++)invalid("T-"+field+"-"+i,field,badText[i]);
  Object[] badCoverage={null,JSONObject.NULL,12,true,new JSONObject(),new JSONArray(),"","ENOUGH","other"};
  for(int i=0;i<badCoverage.length;i++)invalid("E-invalid-"+i,"coverage",badCoverage[i]);
  invalid("F-yesterday","calculatedOn","2026-10-11");invalid("F-future","calculatedOn","2026-10-13");
  Object[] badDates={null,JSONObject.NULL,20261012,true,new JSONObject(),new JSONArray(),"","2026-10-32","2026-1-12","2026-10-12 ","2025-10-12"};
  for(int i=0;i<badDates.length;i++)invalid("F-calculated-"+i,"calculatedOn",badDates[i]);
  Object[] badDue={null,JSONObject.NULL,20261013,true,new JSONObject(),new JSONArray(),"","2026-10-12","2026-10-14","2026-11-13","2027-10-13","2026-02-30","2026-10-013"};
  for(int i=0;i<badDue.length;i++)invalid("F-due-"+i,"dueOn",badDue[i]);
  scenario("R-continue",()->{
   JSONObject broken=new JSONObject(){@Override public Object opt(String key){if("eve".equals(key))throw new IllegalArgumentException("optional boundary failure");return super.opt(key);}};
   broken.put("id","broken").put("name","Recibo").put("amount",12.34).put("day",13);
   Context c=context("2026-10",new JSONArray().put(broken).put(row("next",normal())));AlertCheckWorker.check(c);
   eq(2,Notif.bodies.size(),"malformed first must not suppress later");eq(legacy(),Notif.bodies.get(0),"malformed fallback");eq("Recibo: mañana se cobran 12,34 €. El saldo previsto llega.",Notif.bodies.get(1),"later accepted body");
  });
  scenario("R-malformed-then-valid",()->{Context c=context("2026-10",new JSONArray().put(row("bad",new JSONArray())).put(row("next",normal())));AlertCheckWorker.check(c);eq(2,Notif.bodies.size(),"two count");eq(legacy(),Notif.bodies.get(0),"malformed fallback");eq("Recibo: mañana se cobran 12,34 €. El saldo previsto llega.",Notif.bodies.get(1),"later accepted");});
  scenario("D-stamps-ids",()->{
   Context c=context("2026-10",new JSONArray().put(row("bill",normal())).put(row("debt_loan",null)));AlertCheckWorker.check(c);eq(2,Notif.bodies.size(),"first count");
   eq(72000+Math.abs("bill".hashCode())%900,Notif.ids.get(0),"bill id");eq(72000+Math.abs("debt_loan".hashCode())%900,Notif.ids.get(1),"debt id");
   eq(true,Notif.prefsAtShow.get(0).get("rc_bill_2026-10"),"bill stamp before show");eq(true,Notif.prefsAtShow.get(1).get("rc_debt_loan_2026-10"),"debt stamp before show");
   AlertCheckWorker.check(c);eq(2,Notif.bodies.size(),"dedupe second check");eq(legacy(),Notif.bodies.get(1),"legacy exact cents");
  });
  scenario("D-preexisting-stamp",()->{Context c=context("2026-10",new JSONArray().put(row("bill",normal())));c.prefs.values.put("rc_bill_2026-10",true);AlertCheckWorker.check(c);eq(0,Notif.bodies.size(),"preexisting fired");});
  scenario("D-day-and-empty-id",()->{Context c=context("2026-10",new JSONArray().put(row("later",normal()).put("day",14)).put(row("",normal())).put(JSONObject.NULL).put(row("bill",normal())));AlertCheckWorker.check(c);eq(1,Notif.bodies.size(),"only valid due charge");});
  for(String zone:new String[]{"UTC","Europe/Madrid"}){
   clocks("C-midnight-before-"+zone,zone,2026,10,12,23,59,"2026-10",13,"2026-10-12","2026-10-13",true);
   clocks("C-midnight-after-"+zone,zone,2026,10,13,0,0,"2026-10",14,"2026-10-13","2026-10-14",true);
   clocks("C-month-gap-"+zone,zone,2026,10,31,23,59,"2026-10",1,"2026-10-31","2026-11-01",false);
   clocks("C-year-gap-"+zone,zone,2026,12,31,23,59,"2026-12",1,"2026-12-31","2027-01-01",false);
   clocks("C-leap-"+zone,zone,2028,2,28,23,59,"2028-02",29,"2028-02-28","2028-02-29",true);
   clocks("C-DST-start-eve-"+zone,zone,2026,3,28,23,30,"2026-03",29,"2026-03-28","2026-03-29",true);
   clocks("C-DST-start-day-"+zone,zone,2026,3,29,0,30,"2026-03",30,"2026-03-29","2026-03-30",true);
   clocks("C-DST-end-eve-"+zone,zone,2026,10,24,23,30,"2026-10",25,"2026-10-24","2026-10-25",true);
   clocks("C-DST-end-day-"+zone,zone,2026,10,25,0,30,"2026-10",26,"2026-10-25","2026-10-26",true);
  }
 }
 public static void main(String[] args){
  filter=args.length==0?"all":args[0];
  try{suite();if(cases==0)throw new IllegalStateException("unknown scenario");System.out.println("FIXTURE_PASS|"+cases);}
  catch(AssertionError failure){System.err.println(failure.getMessage());System.out.println("FIXTURE_FAIL|"+currentCase);System.exit(9);}
 }
}`
};

const sourceManifest = [], results = [];
function compileAndRun(worker, label, selectedCase) {
  const sandbox = path.join(runtime, label), sourceDir = path.join(sandbox, "sources"), classes = path.join(sandbox, "classes");
  fs.mkdirSync(classes, { recursive: true });
  const files = [];
  for (const [name, text] of Object.entries({ ...doubles, "com/micartera/app/AlertCheckWorker.java": worker })) {
    const file = path.join(sourceDir, name);
    const record = durable(file, text); sourceManifest.push({ label, transient: true, ...record }); files.push(file);
  }
  const compiled = run(javac, ["-J-XX:ActiveProcessorCount=1", "-J-XX:+UseSerialGC", "-encoding", "UTF-8", "-d", classes, ...files], label + "-javac");
  assert.equal(compiled.status, 0, "compilación debe pasar; no cuenta como mutante detectado");
  return run(java, ["-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-Dfile.encoding=UTF-8", "-cp", classes, "com.micartera.app.ReceiptNativeFixture", selectedCase], label + "-java");
}
let original, failure = null, cleanupError = null, runtimeRemoved = false;
try {
  runtimeParent = fs.realpathSync(os.tmpdir());
  runtime = fs.mkdtempSync(path.join(runtimeParent, "aely-pro03-native-runtime-"));
  runtimeIdentity = fs.lstatSync(runtime);
  assertRuntime();
  if (keepEvidence) {
    const output = path.resolve(options["output-dir"]);
    fs.mkdirSync(output, { recursive: true });
    const realOutput = fs.realpathSync(output), relative = path.relative(runtime, realOutput);
    assert.ok(relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative), "evidencia fuera del runtime que se recoge");
    dir = fs.mkdtempSync(path.join(realOutput, phase + "-"));
  } else dir = runtime;
  if (phase === "baseline") {
    const read = run("git", ["show", options["source-ref"] + ":" + sourcePath], "baseline-source");
    assert.equal(read.status, 0, "lectura exacta de base"); original = read.stdout;
  } else original = fs.readFileSync(path.join(root, sourcePath), "utf8");
  const originalProof = durable(path.join(dir, "worker-original.java"), original);
  // ÚNICA transformación de producción: frontera del reloj; todo el worker restante se compila literal.
  const needle = "Calendar.getInstance()", replacement = "ReceiptNativeFixture.now()";
  assert.equal(original.split(needle).length - 1, 1, "una única frontera de reloj esperada");
  const transformed = original.replace(needle, replacement);
  const transformedProof = durable(path.join(dir, "worker-clock-boundary.java"), transformed);
  json(path.join(dir, "clock-transformation.json"), { originalProof, transformedProof, needle, replacement, replacements: 1, allOtherWorkerTextUnchanged: true });
  if (phase !== "causal") {
    const execution = compileAndRun(transformed, "real-worker", "all");
    results.push({ label: phase, javaExit: execution.status });
    // Baseline falla por la primera expectativa nueva: el mismo worker/harness debe mostrar el texto precomputado.
    assert.equal(execution.status, 0, "worker real no satisface el oráculo conductual; conservar salida RED");
  } else {
    const mutations = [
      { id: "M01-always-fallback", killer: "S-es-enough", before: "private static String[] eveText(JSONObject charge, String today, String dueOn) {", after: "private static String[] eveText(JSONObject charge, String today, String dueOn) { if (charge != null) return null;" },
      { id: "M02-accepts-yesterday", killer: "F-yesterday", before: "if (!today.equals(calculatedOn) || !dueOn.equals(chargeDueOn)) return null;", after: "if (!dueOn.equals(chargeDueOn)) return null;" },
      { id: "M03-body-trim", killer: "S-literal", before: "return new String[]{(String) title, (String) body};", after: "return new String[]{(String) title, ((String) body).trim()};" },
      { id: "M04-aborts-later-charge", killer: "R-continue", before: "// Un campo opcional defectuoso no debe impedir los avisos de los demás cargos.\n            return null;", after: "// Un campo opcional defectuoso no debe impedir los avisos de los demás cargos.\n            throw new IllegalStateException(\"mutant optional failure\");" }
    ];
    for (const mutation of mutations) {
      // Igualar solo finales de línea conserva el texto; hashes de cada copia y mutación quedan en el manifest.
      const normalized = transformed.replaceAll("\r\n", "\n");
      assert.equal(normalized.split(mutation.before).length - 1, 1, "mutación precisa y única");
      const mutant = normalized.replace(mutation.before, mutation.after);
      json(path.join(dir, mutation.id + "-mutation.json"), { ...mutation, originalSHA256: hash(normalized), mutantSHA256: hash(mutant) });
      const execution = compileAndRun(mutant, mutation.id, mutation.killer);
      assert.equal(execution.status, 9, "mutante debe morir por una aserción del fixture, no por infraestructura");
      assert.equal(execution.stdout.trim().split(/\r?\n/).at(-1), "FIXTURE_FAIL|" + mutation.killer, "oráculo conductual exacto detecta mutante");
      results.push({ mutation: mutation.id, killer: mutation.killer, detectedByBehavior: true, javaExit: execution.status });
    }
  }
} catch (error) {
  failure = String(error);
  console.error(error); process.exitCode = 1;
} finally {
  if (runtime) {
    try { cleanupRuntime(); runtimeRemoved = true; }
    catch (error) { cleanupError = String(error); console.error("Cleanup: " + cleanupError); process.exitCode = 1; }
  }
  const report = {
    phase, status: failure || cleanupError ? "FAIL" : "PASS", error: failure, cleanupError,
    runtimePath: runtime || null, runtimeRemoved, sourceManifest, processes, results,
    javaWorkerExecuted: processes.some(p => p.command === java && p.error === null),
    androidParserFrameworkDeviceValidated: false
  };
  // Solo --output-dir conserva pruebas: la ejecución normal no deja fuentes, clases ni logs TEMP.
  if (keepEvidence && dir) {
    try { json(path.join(dir, "RESULT.json"), report); }
    catch (error) { report.status = "FAIL"; console.error(error); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ ...report, output: keepEvidence && dir ? dir : null, evidenceRetained: keepEvidence && !!dir }));
}
