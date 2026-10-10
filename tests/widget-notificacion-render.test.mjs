#!/usr/bin/env node
// Métodos Java de producción sin Android: sólo preferencias, JSON y RemoteViews son dobles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
const root=path.resolve(import.meta.dirname,'..');
const arg=process.argv.find(a=>a.startsWith('--native-dir='));
const native=arg?path.resolve(arg.slice(13)):path.join(root,'android/app/src/main/java/com/micartera/app');
const widget=fs.readFileSync(path.join(native,'MiCarteraWidget.java'),'utf8');
const listener=fs.readFileSync(path.join(native,'TrExpenseListener.java'),'utf8');
const methods=widget.slice(widget.indexOf('    private static WidgetSnapshotArbiter.State read('),widget.lastIndexOf('\n}')).replaceAll('org.json.','');
const response=listener.match(/^    private void handleResponse\([^]*?^    }/m)[0];
const cli=loadPureLogicFromFile(), nowMs=Date.now();
const RealDate=cli.Date;
cli.Date=class extends RealDate {static now(){return nowMs;}};
const state={budget:100,accounts:[{ent:'trade_republic',role:'diario'}],reservaLog:[],deleted:[],
  settings:{expenseBanks:['trade_republic'],budgetCycle:false,gTotalMode:'net'},expenses:[
    {date:new Date(nowMs-6*86400000).toISOString(),amount:300,category:'super',source:'macrodroid'},
    {date:new Date(nowMs-5*86400000).toISOString(),amount:-1800,category:'ingreso',source:'ob:trade_republic',merchant:'NOMINA EMPRESA'},
    {date:new Date(nowMs-2*86400000).toISOString(),amount:120,category:'bares',source:'macrodroid'},
    {date:new Date(nowMs-86400000).toISOString(),amount:-140,category:'ingreso',source:'macrodroid',merchant:'ABONO SINTETICO'}]};
// Se evalúa el constructor REAL del payload web después de cambiar la preferencia real.
const main=fs.readFileSync(path.join(root,'src/modules/11-app-main.js'),'utf8');
const payload=main.match(/    const data=\{[^]*?    if\(wV2\)\{ data.contract=2;[^\n]+/)[0];
const make=new Function('budW','state','wC','wV2','CURLANG','wScope','widgetCoveredEvents','Date',payload+'\nreturn data;');
const snapshots=[false,true].map(cycle=>{
  state.settings.budgetCycle=cycle;
  const bud=cli.dashboardBudgetStats(state);
  const anchor=cycle?cli.keyOfExpense(cli.budgetPaydayOf(state,nowMs).inc):'';
  return make(bud,state,{current:[]},true,'es',cli.widgetScopeOf(state,bud,anchor,'trade_republic'),cli.widgetCoveredEvents,cli.Date);
});
cli.Date=RealDate;
assert.equal(snapshots[0].periodKind,'mes'); assert.equal(snapshots[1].periodKind,'ciclo');
assert.notEqual(snapshots[0].periodStart,snapshots[1].periodStart);
assert.notEqual(snapshots[0].spent,snapshots[1].spent);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-notificacion-'));
try {
fs.writeFileSync(path.join(dir,'WidgetNotificationTest.java'),`package com.micartera.app;
import java.util.*;
import java.text.NumberFormat;
public class WidgetNotificationTest {
  static class SharedPreferences {
    final Map<String,Object> values=new HashMap<>();
    boolean contains(String k){return values.containsKey(k);}
    long getLong(String k,long d){return contains(k)?(Long)values.get(k):d;}
    int getInt(String k,int d){return contains(k)?(Integer)values.get(k):d;}
    float getFloat(String k,float d){return contains(k)?(Float)values.get(k):d;}
    boolean getBoolean(String k,boolean d){return contains(k)?(Boolean)values.get(k):d;}
    String getString(String k,String d){return contains(k)?(String)values.get(k):d;}
    Editor edit(){return new Editor(this);}
    static class Editor {
      final SharedPreferences p; Editor(SharedPreferences p){this.p=p;}
      Editor putLong(String k,long v){p.values.put(k,v);return this;}
      Editor putInt(String k,int v){p.values.put(k,v);return this;}
      Editor putFloat(String k,float v){p.values.put(k,v);return this;}
      Editor putBoolean(String k,boolean v){p.values.put(k,v);return this;}
      Editor putString(String k,String v){p.values.put(k,v);return this;}
      Editor remove(String k){p.values.remove(k);return this;}
      boolean commit(){return true;}
    }
  }
  static class Context {
    static final int MODE_PRIVATE=0;
    final SharedPreferences prefs=new SharedPreferences();
    SharedPreferences getSharedPreferences(String name,int mode){return prefs;}
    String getPackageName(){return "fixture";}
  }
  static class RemoteViews {
    final Map<Integer,String> text=new HashMap<>();
    final Map<Integer,Integer> visibility=new HashMap<>();
    RemoteViews(String p,int layout){}
    void setTextViewText(int id,String value){text.put(id,value);}
    void setTextColor(int id,int color){}
    void setViewVisibility(int id,int value){visibility.put(id,value);}
    void setProgressBar(int id,int max,int current,boolean indeterminate){}
    void setOnClickPendingIntent(int id,PendingIntent p){}
  }
  static class View {static final int VISIBLE=0,GONE=8;}
  static class Intent {Intent(Context c,Class<?> cls){}}
  static class MainActivity {}
  static class PendingIntent {
    static final int FLAG_UPDATE_CURRENT=1,FLAG_IMMUTABLE=2;
    static PendingIntent getActivity(Context c,int id,Intent i,int flags){return new PendingIntent();}
  }
  static class R {
    static class layout {static final int widget_micartera=0;}
    static class id {static final int w_title=1,w_amount=2,w_afford=3,w_sub=4,w_bar=5,w_foot=6,w_root=7;}
  }
  static class MiCarteraWidget {
    static final String PREFS="micartera_widget";
    static final int MINT=1,CORAL=2,MUTED=3;
    static RemoteViews last;
    static void refreshAll(Context ctx){last=build(ctx);}
    static long monthStart(long when){return WidgetPeriod.monthStart(when);}
${methods}
  }
  static class JSONObject {
    static final Map<String,JSONObject> encoded=new HashMap<>();
    final Map<String,Object> data=new HashMap<>();
    JSONObject(){}
    JSONObject(String s){data.putAll(encoded.get(s).data);}
    JSONObject put(String k,Object v){data.put(k,v);return this;}
    boolean has(String k){return data.containsKey(k);}
    boolean optBoolean(String k,boolean d){return has(k)?(Boolean)data.get(k):d;}
    String optString(String k,String d){return has(k)?String.valueOf(data.get(k)):d;}
    int optInt(String k,int d){return has(k)?((Number)data.get(k)).intValue():d;}
    long optLong(String k,long d){return has(k)?((Number)data.get(k)).longValue():d;}
    double optDouble(String k,double d){return has(k)?((Number)data.get(k)).doubleValue():d;}
    JSONObject optJSONObject(String k){return (JSONObject)data.get(k);}
    public String toString(){String id="json"+encoded.size();encoded.put(id,this);return id;}
  }
  static class JSONArray {
    final List<Object> data=new ArrayList<>();
    JSONArray(String s){
      if(!s.startsWith("[")||!s.endsWith("]"))throw new IllegalArgumentException();
      int depth=0,start=1; boolean quote=false;
      for(int i=1;i<s.length();i++){
        char c=s.charAt(i); if(c=='"'&&(i==0||s.charAt(i-1)!='\\\\'))quote=!quote;
        if(!quote){if(c=='[')depth++; if(c==']')depth--;}
        if(!quote&&((c==','&&depth==0)||(i==s.length()-1))){
          String piece=s.substring(start,i).trim();
          if(!piece.isEmpty())data.add(piece.startsWith("[")?new JSONArray(piece):piece.startsWith("\\\"")?piece.substring(1,piece.length()-1):Double.valueOf(piece));
          start=i+1;
        }
      }
    }
    int length(){return data.size();}
    int optInt(int i,int d){return i<data.size()&&data.get(i)instanceof Number?((Number)data.get(i)).intValue():d;}
    long optLong(int i,long d){return i<data.size()&&data.get(i)instanceof Number?((Number)data.get(i)).longValue():d;}
    String optString(int i,String d){return i<data.size()?String.valueOf(data.get(i)):d;}
    JSONArray optJSONArray(int i){return i<data.size()&&data.get(i)instanceof JSONArray?(JSONArray)data.get(i):null;}
  }
  static class Notif {
    static int idFor(String s){return s.hashCode();}
    static void show(Context c,String title,String body,int id,String... extra){}
  }
  static class Listener extends Context {
    static String eur(double n){return String.valueOf(n);}
    static String eur0(double n){return String.valueOf(n);}
${response}
  }
  static void ok(boolean value,String why){if(!value)throw new AssertionError(why);}
  static String monthlyScope(long period){return "[2,"+period+",\\\"mes\\\",\\\"gasto\\\",\\\"\\\",100,[\\\"trade_republic\\\"],\\\"trade_republic\\\"]";}
  static Listener production52(long period){
    // Foto ya persistida por APK52, con un pago superpuesto y salto XML de su journal.
    // No se usa saveApp para crear un estado limpio que ocultaría la migración.
    Listener c=new Listener(); c.prefs.edit().putInt("contract",2).putString("periodKind","mes")
      .putString("scope",monthlyScope(period)).putString("magnitude","gasto").putString("lang","es")
      .putLong("periodStart",period).putLong("issued",1).putLong("updated",System.currentTimeMillis())
      .putFloat("spent",50).putFloat("budget",100).putFloat("budgetLeft",50).putFloat("safeLiq",140)
      .putFloat("baseSafeLiq",150).putFloat("cash",190).putFloat("baseCash",200)
      .putFloat("spendDelta",10).putFloat("cashDelta",10).putString("cashEnt","trade_republic")
      .putString("cashLabel","Cuenta").putString("events","|old|")
      .putString("journal","old\\t10\\t10\\t10\\t1\\t1\\toldKey\\n    ").commit();
    return c;
  }
  static JSONObject notification(long period,boolean v2){
    JSONObject month=new JSONObject().put("periodStart",period).put("readAt",100L)
      .put("eventKey","payment").put("expenseKey","paymentKey").put("spent",55)
      .put("budget",100).put("budgetLeft",45).put("shownDelta",5).put("againstDelta",5)
      .put("counts",1).put("cashCounts",1);
    if(v2)month.put("contract",2).put("periodKind","mes").put("scope",monthlyScope(period));
    return new JSONObject().put("ok",true).put("tipo","gasto").put("importe",5)
      .put("fecha",new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT){{setTimeZone(TimeZone.getTimeZone("UTC"));}}.format(new Date()))
      .put("cat","super")
      .put("comercio","Compra sintética").put("ack","payment").put("month",month);
  }
  static void render(Listener c){MiCarteraWidget.refreshAll(c);}
  static void pressure(){
    long month=WidgetPeriod.monthStart(System.currentTimeMillis());
    for(boolean tombstone:new boolean[]{false,true}){
      Listener c=production52(month); String huge=new String(new char[262140]).replace('\\0','x');
      c.prefs.edit().putString("unknownJournal",huge+"\\tK").putBoolean("unknownPending",true).commit();
      String scope=monthlyScope(month).replace(",\\\"trade_republic\\\"]",",\\\"sabadell\\\"]");
      MiCarteraWidget.saveApp(c,month,50,100,50.0,150.0,200.0,"sabadell","Cuenta",
        tombstone?"":"|old|"+huge+"|",tombstone?"|oldKey|K|":"",2,"mes","gasto","es",scope); render(c);
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("50 €"),"cobertura completa libera presión al cambiar scope antes de migrar");
      ok(c.prefs.getString("unknownJournal","").isEmpty()&&!c.prefs.getBoolean("journalFull",false),"no guarda registros parciales ni bloqueo lleno");
    }
    Listener missing=production52(month);
    missing.prefs.edit().putBoolean("unknownLoss",true).putBoolean("identityLost",true).putBoolean("unknownPending",true).commit();
    MiCarteraWidget.saveApp(missing,month,50,100,50.0,150.0,200.0,"sabadell","Cuenta",
      "|old|","",2,"mes","gasto","es",monthlyScope(month)+"changed"); render(missing);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"ACK de registro retenido no limpia identidad realmente perdida");
    System.out.println("PASS causal: saveApp concilia ACK/lápidas antes de migrar registros casi llenos al cambiar scope");
  }
  public static void main(String[] args){
    if(args.length>0&&args[0].equals("pressure")){pressure();return;}
    long now=System.currentTimeMillis(),month=WidgetPeriod.monthStart(now),cycle=${snapshots[1].periodStart}L;
    Listener c=production52(month); render(c);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("50 €"),"foto APK52 inicial");
    long ticket=MiCarteraWidget.beginIngest(c);
    JSONObject dual=notification(month,true); dual.put("widget",dual.optJSONObject("month"));
    dual.put("month",new JSONObject().put("periodStart",month).put("spent",999));
    c.handleResponse(dual.toString(),ticket,"raw");
    // Recrear el lector y el pintado usa la preferencia escrita, no el State en memoria.
    render(c);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"notificación compatible actualiza gasto cerrado");
    ok(MiCarteraWidget.last.text.get(R.id.w_foot).contains("185 €"),"pago resta saldo una sola vez");
    c.handleResponse(notification(month,true).toString(),ticket,"raw"); render(c);
    ok(MiCarteraWidget.last.text.get(R.id.w_foot).contains("185 €"),"reentrega no duplica");
    Listener crossed=production52(month);
    long early=MiCarteraWidget.beginIngest(crossed),late=MiCarteraWidget.beginIngest(crossed);
    crossed.handleResponse(notification(month,false).toString(),late,"raw");
    JSONObject oldV2=notification(month,true).put("importe",2);
    oldV2.optJSONObject("month").put("eventKey","older").put("expenseKey","older-key")
      .put("spent",52).put("shownDelta",2).put("againstDelta",2);
    crossed.handleResponse(oldV2.toString(),early,"raw"); render(crossed);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("57 €"),"absoluto v2 previo no deshace pago legacy nuevo");
    Listener legacy=production52(month);
    legacy.handleResponse(notification(month,false).toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"legacy acredita pago conocido del periodo actual sin copiar total");
    ok(MiCarteraWidget.last.text.get(R.id.w_foot).contains("185 €"),"legacy mantiene saldo y precisión");
    legacy.handleResponse(notification(month,false).toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €")&&MiCarteraWidget.last.text.get(R.id.w_foot).contains("185 €"),"legacy idempotente");
    Listener changed=production52(month);
    changed.handleResponse(notification(month,false).put("widget",null).toString(),MiCarteraWidget.beginIngest(changed),"raw"); render(changed);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"servidor v2 sin scope acreditado no se disfraza de legacy");
    MiCarteraWidget.saveApp(legacy,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"abrir app con ACK elimina aviso");
    // La preferencia de la app llega por saveApp; cambia título, ventana y cifra reales.
    MiCarteraWidget.saveApp(legacy,cycle,${snapshots[1].spent},${snapshots[1].budget},120.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"ciclo","neto","es",${JSON.stringify(snapshots[1].scope)}); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_title).contains("MI CICLO"),"preferencia ciclo cambia periodo");
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent)} €"),"ciclo conserva neto con signo");
    JSONObject cyclePay=notification(month,false).put("ack","cycle-payment");
    cyclePay.optJSONObject("month").put("eventKey","cycle-payment").put("expenseKey","cycle-key");
    legacy.handleResponse(cyclePay.toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent+5)} €"),"legacy aplica importe conocido al neto firmado, no el total mensual55");
    MiCarteraWidget.saveApp(legacy,${snapshots[0].periodStart}L,${snapshots[0].spent},${snapshots[0].budget},45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|cycle-payment|","",2,"mes","gasto","es",${JSON.stringify(snapshots[0].scope)}); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_title).contains("ESTE MES")
      &&MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[0].spent)} €"),"preferencia mes restaura gasto bruto");
    Listener migrated=production52(month);
    migrated.prefs.edit().putBoolean("journalFull",true).putBoolean("unknownPending",true)
      .putString("unknownJournal","payment\\tpaymentKey\\n    ").commit();
    MiCarteraWidget.saveApp(migrated,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(migrated);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"migración real saveApp/read/build recupera");
    Listener uncertain=production52(month); JSONObject old=notification(month,false);
    old.put("fecha","2000-01-01T00:00:00.000Z");
    uncertain.handleResponse(old.toString(),MiCarteraWidget.beginIngest(uncertain),"raw"); render(uncertain);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"fecha fuera de ventana mantiene incertidumbre real");
    MiCarteraWidget.saveApp(uncertain,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(uncertain);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"ACK fresco limpia pago de periodo incierto");
    pressure();
    System.out.println("PASS: listener.handleResponse -> registro -> relectura -> build APK52; legacy/v2 cerrada, neto ciclo, idempotencia, periodo incierto y recuperación");
  }
}`);
const jdk=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'C:/Program Files/Android/Android Studio/jbr/bin';
const probe=process.argv.find(a=>a.startsWith('--probe='));
for(const [name,args] of [['javac',['-encoding','UTF-8','-d',dir,path.join(native,'WidgetSnapshotArbiter.java'),path.join(native,'WidgetPeriod.java'),path.join(dir,'WidgetNotificationTest.java')]],['java',['-cp',dir,'com.micartera.app.WidgetNotificationTest',...(probe?[probe.slice(8)]:[])]]]) {
 const executable=path.join(jdk,name+(process.platform==='win32'?'.exe':''));
 const r=spawnSync(fs.existsSync(executable)?executable:name,args,{encoding:'utf8',cwd:root});
 assert.equal(r.status,0,String(r.error||r.stderr||r.stdout)); process.stdout.write(r.stdout);
}
}finally{fs.rmSync(dir,{recursive:true,force:true});}
