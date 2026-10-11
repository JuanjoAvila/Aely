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
const transport=["postIngest","encolar","vaciarCola","leerCola","splitIngest","readAll"].map(name=>
  listener.match(new RegExp("^    (?:private |static )[^\\n]* "+name+"\\([^]*?^    }","m"))[0]
    .replaceAll("android.content.SharedPreferences","SharedPreferences").replaceAll("org.json.","")).join('\n');
const transportConstants=["OK","REINTENTAR","DESCARTAR","COLA_PREFS","COLA_MAX","COLA_TTL"].map(name=>
  listener.match(new RegExp("^    private static final (?:int|long|String) "+name+"[^\\n]*?;","m"))[0]).join('\n');
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
// Ejecutar también el constructor que manda la marca: observar sólo el ref no prueba el puente.
const photoStart=main.indexOf('    const data={');
const photoSource=main.slice(photoStart,main.indexOf('    if(widgetCash',photoStart));
const markedPhoto=new Function('budW','state','wC','wV2','CURLANG','wScope','widgetCoveredEvents','Date','wRead',photoSource+'\nreturn data;');
const proof={readGeneration:'synthetic-complete-read',nativeCut:'4'};
const sent=markedPhoto(cli.dashboardBudgetStats(state),state,{current:[]},true,'es',snapshots[1].scope,cli.widgetCoveredEvents,cli.Date,{current:proof});
assert.equal(sent.readGeneration,proof.readGeneration,'la foto web envía la generación de la lectura completa');
assert.equal(sent.nativeCut,proof.nativeCut,'la foto web envía el corte de esa misma lectura');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-notificacion-'));
try {
const legacy=spawnSync('git',['show','74c5f075:android/app/src/main/java/com/micartera/app/WidgetSnapshotArbiter.java'],{cwd:root,encoding:'utf8'});assert.equal(legacy.status,0);fs.writeFileSync(path.join(dir,'LegacyWidgetSnapshotArbiter.java'),legacy.stdout.replaceAll('WidgetSnapshotArbiter','LegacyWidgetSnapshotArbiter'));
const legacyWidget=spawnSync('git',['show','74c5f075:android/app/src/main/java/com/micartera/app/MiCarteraWidget.java'],{cwd:root,encoding:'utf8'});assert.equal(legacyWidget.status,0);
const legacyReadWrite=legacyWidget.stdout.slice(legacyWidget.stdout.indexOf('    private static WidgetSnapshotArbiter.State read('),legacyWidget.stdout.indexOf('    static synchronized long beginIngest(')).replaceAll('WidgetSnapshotArbiter','LegacyWidgetSnapshotArbiter');
fs.writeFileSync(path.join(dir,'WidgetNotificationTest.java'),`package com.micartera.app;
import java.util.*;
import java.text.NumberFormat;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
public class WidgetNotificationTest {
  static class SharedPreferences {
    final Map<String,Object> values=new HashMap<>();
    int commits;
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
      boolean commit(){p.commits++;return true;}
      void apply(){}
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
  static class LegacyPrefs {
${legacyReadWrite}
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
    static final Map<String,JSONArray> encoded=new HashMap<>();
    final List<Object> data=new ArrayList<>();
    JSONArray(){}
    JSONArray(String s){
      if(encoded.containsKey(s)){data.addAll(encoded.get(s).data);return;}
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
    JSONObject optJSONObject(int i){return i<data.size()&&data.get(i)instanceof JSONObject?(JSONObject)data.get(i):null;}
    void put(JSONObject value){data.add(value);}
    void remove(int i){data.remove(i);}
    public String toString(){String key="array"+encoded.size();encoded.put(key,this);return key;}
  }
  static class Notif {
    static int idFor(String s){return s.hashCode();}
    static void show(Context c,String title,String body,int id,String... extra){}
  }
  static class Listener extends Context {
${transportConstants}
    static String eur(double n){return String.valueOf(n);}
    static String eur0(double n){return String.valueOf(n);}
${response}
${transport}
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
  static void legacyApp(Context c,long period,double spent,double budget,Double left,Double safe,Double cash,
    String bank,String label,String covered,String deleted,int contract,String kind,String magnitude,String lang,String scope){
    MiCarteraWidget.saveApp(c,period,spent,budget,left,safe,cash,bank,label,covered,deleted,contract,kind,magnitude,lang,scope,null,null);
  }
  static String[] startRead(Listener c){
    final String[] mark=new String[2];
    MiCarteraWidget.beginAppRead(c,(generation,cut)->{mark[0]=generation;mark[1]=cut;});
    return mark;
  }
  static void photo(Listener c,long period,double spent,String covered,String[] mark){
    MiCarteraWidget.saveApp(c,period,spent,100,100-spent,200-spent,250-spent,"trade_republic","Cuenta",covered,"",
      2,"mes","gasto","es",monthlyScope(period),mark[0],mark[1]);render(c);
  }
  static void freshRecovery(){
    long m=WidgetPeriod.monthStart(System.currentTimeMillis());
    for(boolean included:new boolean[]{false,true}){
      Listener c=production52(m);c.prefs.edit().putBoolean("journalFull",true).putBoolean("identityLost",true).commit();
      String[] mark=startRead(c);ok(mark[0]!=null,"corte disponible antes de leer filas");
      long ticket=MiCarteraWidget.beginIngest(c);
      c.handleResponse(notification(m,false).toString(),ticket,"raw");MiCarteraWidget.finishIngest(c,ticket);
      int before=c.prefs.commits;
      photo(c,m,included?55:50,included?"|payment|":"",mark);
      ok(c.prefs.commits==before+1,"foto y pagos posteriores se guardan en un único commit");
      ok(c.prefs.getFloat("spent",0)==55&&!c.prefs.getBoolean("identityLost",true),"foto nueva limpia legado y pago durante lectura se suma una vez");
      ok(c.prefs.getFloat("budgetLeft",0)==45,"presupuesto conserva contribución posterior al corte");
      ok(c.prefs.getFloat("cash",0)==195,"pago incluido no resta efectivo otra vez");
      c.handleResponse(notification(m,false).toString(),ticket,"raw");render(c);
      ok(c.prefs.getFloat("spent",0)==55,"reentrega tras foto no duplica pago");
      c.prefs.edit().putBoolean("identityLost",true).putBoolean("unknownLoss",true).putBoolean("unknownPending",true).commit();
      photo(c,m,55,"|payment|",mark);
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"marca consumida no limpia pérdida posterior al reenviar");
      photo(c,m,55,"|payment|",startRead(c));
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"otra lectura terminada recupera nueva incertidumbre");
    }
    Listener c=production52(m);long active=MiCarteraWidget.beginIngest(c);String[] wait=startRead(c);
    ok(wait[0]==null,"ticket en vuelo no acredita corte de lectura");
    MiCarteraWidget.finishIngest(c,active);ok(wait[0]!=null&&wait[1].equals(Long.toString(active)),"terminar petición libera corte sin reloj");
    long later=MiCarteraWidget.beginIngest(c);photo(c,m,50,"",wait);
    c.handleResponse(notification(m,false).toString(),later,"raw");MiCarteraWidget.finishIngest(c,later);
    ok(c.prefs.getFloat("spent",0)==55,"respuesta después de foto aporta delta, nunca absoluto viejo");
    for(int field=0;field<5;field++)for(double invalid:new double[]{Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY}){
      Listener bad=production52(m);bad.prefs.edit().putBoolean("identityLost",true).putBoolean("unknownLoss",true).commit();
      String[] proof=startRead(bad);int commits=bad.prefs.commits;
      MiCarteraWidget.saveApp(bad,m,field==0?invalid:50,field==1?invalid:100,field==2?invalid:50.0,
        field==3?invalid:150.0,field==4?invalid:200.0,"trade_republic","Cuenta","","",
        2,"mes","gasto","es",monthlyScope(m),proof[0],proof[1]);render(bad);
      ok(bad.prefs.getBoolean("identityLost",false)&&bad.prefs.commits==commits,"GUARD cifra no finita campo "+field+" no limpia ni guarda");
      photo(bad,m,50,"",proof);ok(!bad.prefs.getBoolean("identityLost",true),"foto válida posterior conserva marca no consumida campo "+field);
    }
    for(int invalid=0;invalid<5;invalid++){
      Listener bad=production52(m);bad.prefs.edit().putBoolean("identityLost",true).putBoolean("unknownLoss",true).commit();
      String[] proof=startRead(bad);int commits=bad.prefs.commits;
      String scope=invalid==0?"{}":invalid==1?monthlyScope(m).replaceFirst("2,","1,"):
        invalid==2?monthlyScope(m).replace(Long.toString(m),Long.toString(m-86400000L)):
        invalid==3?monthlyScope(m).replace("mes","ciclo"):monthlyScope(m);
      MiCarteraWidget.saveApp(bad,m,50,100,50.0,150.0,200.0,"trade_republic","Cuenta","","",
        2,"mes",invalid==4?"neto":"gasto","es",scope,proof[0],proof[1]);render(bad);
      ok(bad.prefs.getBoolean("identityLost",false)&&bad.prefs.commits==commits,"GUARD alcance de foto con marca "+invalid+" no acredita pérdida");
      photo(bad,m,50,"",proof);ok(!bad.prefs.getBoolean("identityLost",true),"alcance válido reutiliza marca rechazada");
    }
    System.out.println("PASS causal: lectura nueva, corte sin peticiones previas, reenvío, pago durante/después, cobertura y cifras válidas");
  }
  static boolean networkFailed;
  static String networkResponse;
  static void cycleDuringRead(){
    long now=System.currentTimeMillis(),m=WidgetPeriod.monthStart(now),cycle=now-2*86400000L;
    for(String category:new String[]{"ingreso","bizum","inversion"}){
      Listener c=production52(m);String[] proof=startRead(c);long ticket=MiCarteraWidget.beginIngest(c);
      ok(MiCarteraWidget.saveLegacyPayment(c,ticket,now,"large-income","income-key",-200,category,true),"abono durante lectura admite ventana Mes anterior");
      MiCarteraWidget.finishIngest(c,ticket);
      MiCarteraWidget.saveApp(c,cycle,20,100,80.0,150.0,200.0,"trade_republic","Cuenta","","",
        2,"ciclo","neto","es",monthlyScope(cycle).replace("mes","ciclo"),proof[0],proof[1]);render(c);
      ok(c.prefs.getBoolean("unknownPending",false)==category.equals("ingreso"),"GUARD abono grande Mes a Ciclo pide ancla nueva sin afectar Bizum ni neutras");
      ok(!category.equals("ingreso")||MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"abono sin ancla no pinta cifra de ciclo confirmada");
    }
  }
  static class Connection extends HttpURLConnection {
    Connection(URL u){super(u);}
    public void connect(){} public void disconnect(){} public boolean usingProxy(){return false;}
    public OutputStream getOutputStream() throws IOException {
      if(networkFailed)throw new java.net.SocketTimeoutException("timeout sintético");
      return new ByteArrayOutputStream();
    }
    public int getResponseCode(){return 200;}
    public InputStream getInputStream(){return new ByteArrayInputStream(networkResponse.getBytes(StandardCharsets.UTF_8));}
    public InputStream getErrorStream(){return getInputStream();}
  }
  static void readRaces(){
    URL.setURLStreamHandlerFactory(protocol->new URLStreamHandler(){protected URLConnection openConnection(URL u){return new Connection(u);}});
    long m=WidgetPeriod.monthStart(System.currentTimeMillis());
    for(boolean alreadySaved:new boolean[]{false,true}) {
      Listener c=production52(m);c.prefs.edit().putBoolean("identityLost",true).putBoolean("unknownLoss",true).commit();
      String body=new JSONObject().put("evento","same-retry-event").toString();
      networkFailed=true;ok(c.postIngest("https://fixture.invalid",body)==1,"POST real previo falla por timeout");
      c.encolar("https://fixture.invalid",body);
      ok(Listener.leerCola(c.prefs).length()==1,"cola real conserva envío con error");
      String[] proof=startRead(c);ok(proof[0]!=null,"intento fallido termina sin acreditar un ACK del pago");
      photo(c,m,alreadySaved?55:50,alreadySaved?"|payment|":"",proof);
      ok(Listener.leerCola(c.prefs).length()==1,"foto nueva no borra cola pendiente de retry");
      networkFailed=false;networkResponse=notification(m,false).toString();c.vaciarCola();render(c);
      ok(Listener.leerCola(c.prefs).length()==0,"retry real completa la cola");
      ok(c.prefs.getFloat("spent",0)==55&&c.prefs.getFloat("cash",0)==195,"retry tras lectura suma sólo si pago no estaba en foto");
      ok(c.postIngest("https://fixture.invalid",body)==0&&c.prefs.getFloat("spent",0)==55,"retry repetido no duplica gasto");
    }
    for(boolean full:new boolean[]{false,true}) {
      Listener c=production52(m);if(full)c.prefs.edit().putBoolean("identityLost",true).putBoolean("unknownLoss",true).putBoolean("journalFull",true).commit();
      String[] first=startRead(c);long ticket=MiCarteraWidget.beginIngest(c);
      String[] second=startRead(c);ok(second[0]==null,"segunda lectura espera pago de primera en vuelo");
      c.handleResponse(notification(m,false).toString(),ticket,"raw");MiCarteraWidget.finishIngest(c,ticket);
      ok(second[0]!=null,"segunda lectura tiene generación distinta tras terminar pago");
      photo(c,m,50,"|old|",first);
      ok(full?c.prefs.getBoolean("unknownPending",false):c.prefs.getFloat("spent",0)==55,"lectura superada no borra pago ni pérdida al fallar segunda");
      // La lectura segunda falla: no se envía foto ni se inventa cobertura. La próxima
      // lectura completa trae el pago ya guardado y recupera tanto ledger como legado.
      photo(c,m,55,"|old|payment|",startRead(c));
      ok(c.prefs.getFloat("spent",0)==55&&!c.prefs.getBoolean("identityLost",true),"tercera lectura completa recupera una vez tras fallo de segunda");
    }
    System.out.println("PASS causal: timeout -> cola real -> foto -> retry; lecturas sustituidas con pago y fallo posterior");
  }
  static void moneyGuards(){
    long now=System.currentTimeMillis(),m=WidgetPeriod.monthStart(now),cycle=now-2*86400000L;
    Listener salary=production52(cycle);salary.prefs.edit().putString("periodKind","ciclo")
      .putString("scope",monthlyScope(cycle).replace("mes","ciclo")).commit();
    ok(!MiCarteraWidget.saveLegacyPayment(salary,2,now,"salary","salary-key",-200,"ingreso",true),"GUARD ingreso grande puede abrir ciclo y exige foto");
    Listener other=production52(m);other.prefs.edit().putString("scope",monthlyScope(m).replace("trade_republic","sabadell")).commit();
    ok(MiCarteraWidget.saveLegacyPayment(other,2,now,"other","other-key",5,"super",true),"pago de banco ajeno conserva identidad");
    ok(other.prefs.getFloat("spent",0)==50,"GUARD banco ajeno a gasto diario no aumenta gasto");
    Listener future=production52(m);
    ok(!MiCarteraWidget.saveLegacyPayment(future,2,now+86400000L,"future","future-key",5,"super",true),"GUARD fecha futura no acredita pago actual");
    Listener investment=production52(m);
    ok(MiCarteraWidget.saveLegacyPayment(investment,2,now,"investment","investment-key",5,"inversion",true),"inversión exacta conserva identidad");
    ok(investment.prefs.getFloat("spent",0)==50&&investment.prefs.getFloat("cash",0)==185,"GUARD inversión baja efectivo pero no gasto");
    Listener cents=production52(m);
    ok(!MiCarteraWidget.saveLegacyPayment(cents,2,now,"cents","cents-key",1.001,"super",true),"GUARD importe con fracción de céntimo no se redondea a ciegas");
    Listener refund=production52(m);
    ok(MiCarteraWidget.saveLegacyPayment(refund,2,now,"refund","refund-key",-5,"ingreso",true),"abono exacto conserva identidad");
    ok(refund.prefs.getFloat("spent",0)==50,"GUARD abono no resta gasto bruto de Mes");
    System.out.println("PASS: seis guardianes de reglas de dinero ejecutan saveLegacyPayment real");
  }
  static void pressure(){
    long month=WidgetPeriod.monthStart(System.currentTimeMillis());
    for(boolean tombstone:new boolean[]{false,true}){
      Listener c=production52(month); String huge=new String(new char[262140]).replace('\\0','x');
      c.prefs.edit().putString("unknownJournal",huge+"\\tK").putBoolean("unknownPending",true).commit();
      String scope=monthlyScope(month).replace(",\\\"trade_republic\\\"]",",\\\"sabadell\\\"]");
      legacyApp(c,month,50,100,50.0,150.0,200.0,"sabadell","Cuenta",
        tombstone?"":"|old|"+huge+"|",tombstone?"|oldKey|K|":"",2,"mes","gasto","es",scope); render(c);
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("50 €"),"cobertura completa libera presión al cambiar scope antes de migrar");
      ok(c.prefs.getString("unknownJournal","").isEmpty()&&!c.prefs.getBoolean("journalFull",false),"no guarda registros parciales ni bloqueo lleno");
    }
    Listener missing=production52(month);
    missing.prefs.edit().putBoolean("unknownLoss",true).putBoolean("identityLost",true).putBoolean("unknownPending",true).commit();
    legacyApp(missing,month,50,100,50.0,150.0,200.0,"sabadell","Cuenta",
      "|old|","",2,"mes","gasto","es",monthlyScope(month)+"changed"); render(missing);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"ACK de registro retenido no limpia identidad realmente perdida");
    System.out.println("PASS causal: saveApp concilia ACK/lápidas antes de migrar registros casi llenos al cambiar scope");
  }
  static LegacyWidgetSnapshotArbiter.State ambiguousOld(long m) {
    LegacyWidgetSnapshotArbiter.State s=new LegacyWidgetSnapshotArbiter.State();
    s.periodStart=m;s.issued=1;s.spent=50;s.budget=100;s.hasBudgetLeft=true;s.budgetLeft=50;
    s.hasSafeLiq=true;s.baseSafeLiq=150;s.hasCash=true;s.baseCash=200;s.cashEnt="trade_republic";s.cashLabel="Cuenta";
    s.journal="old\\t10\\t10\\t10\\t1\\t1\\toldKey";s.events="|old|";
    s.unknownJournal="known\\tknownKey\\n    ";s.unknownPending=true;return s;
  }
  static void identicalLegacyPrefs() {
    long m=WidgetPeriod.monthStart(System.currentTimeMillis());
    LegacyWidgetSnapshotArbiter.State format=ambiguousOld(m),loss=ambiguousOld(m);
    ok(!LegacyWidgetSnapshotArbiter.app(format,m,50,100,50.0,150.0,200.0,"trade_republic","Cuenta","|old|known|",""),"Java74 real bloquea indentación pequeña");
    String missing=new String(new char[262150]).replace('\\0','x');
    LegacyWidgetSnapshotArbiter.ingest(loss,1,m,m,100,missing,"lostKey",50,100,50,1,1,1,true,true);
    ok(loss.journalFull&&!loss.journal.contains(missing),"Java74 real omite ID que no cabe sobre registro pequeño");
    Listener a=production52(m),b=production52(m);
    for(int n=0;n<100;n++) { LegacyPrefs.write(a.prefs.edit(),format);LegacyPrefs.write(b.prefs.edit(),loss);if(a.prefs.values.equals(b.prefs.values))break; }
    ok(a.prefs.values.equals(b.prefs.values),"Java74 escribe preferencias idénticas con causa de formato o pérdida real");
    for(Listener c:new Listener[]{a,b}) {
      photo(c,m,50,"|old|known|",startRead(c));
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("50 €"),"foto nueva tras lectura completa recupera ambas causas sin ID nativo antiguo");
    }
    System.out.println("PASS causal: preferencias idénticas se recuperan sólo con lectura nueva terminada");
  }
  static void legacyOverflow() {
    for(boolean formatting:new boolean[]{false,true}) {
      long m=WidgetPeriod.monthStart(System.currentTimeMillis());
      LegacyWidgetSnapshotArbiter.State old=new LegacyWidgetSnapshotArbiter.State(); old.periodStart=m; old.cashEnt="trade_republic";
      StringBuilder journal=new StringBuilder(),events=new StringBuilder(); int i=0;
      while(true){ String id="retained"+(++i),line=id+"\\t1\\t1\\t1\\t1\\t1\\tkey"+i;
        if(journal.length()+line.length()+1>262144-8)break;
        if(journal.length()>0)journal.append('\\n');journal.append(line);events.append('|').append(id).append('|'); }
      old.journal=journal.toString();old.events=events.toString();
      old.unknownJournal=formatting?"known\\tknownKey\\n    ":"";
      old.unknownPending=formatting;
      String missing="lost-"+new String(new char[64]).replace('\\0','x');
      LegacyWidgetSnapshotArbiter.ingest(old,LegacyWidgetSnapshotArbiter.begin(old),m,m,100,missing,"lostKey",50,100,50,1,1,1,true,true);
      ok(old.journalFull&&!old.journal.contains(missing),"Java74 real pierde evento al desbordar");
      Listener migrated=production52(m); migrated.prefs.edit().putString("journal",old.journal).putString("events",old.events)
        .putBoolean("journalFull",old.journalFull).putBoolean("unknownPending",old.unknownPending).putString("unknownJournal",old.unknownJournal).commit();
      render(migrated);ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"estado antiguo bloqueado antes del ACK");
      legacyApp(migrated,m,50,100,50.0,150.0,200.0,"trade_republic","Cuenta",old.events+"|known|","",2,"mes","gasto","es",monthlyScope(m));render(migrated);
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"ACK sólo retenido NO demuestra evento perdido en APK52");
      render(migrated);
      ok(migrated.prefs.getBoolean("identityLost",false),"pérdida antigua sin marca queda durable tras relectura");
    }
      Listener ambiguous=production52(WidgetPeriod.monthStart(System.currentTimeMillis()));
      ambiguous.prefs.edit().putBoolean("journalFull",true).commit();
      legacyApp(ambiguous,WidgetPeriod.monthStart(System.currentTimeMillis()),50,100,50.0,150.0,200.0,"trade_republic","Cuenta","|old|","",2,"mes","gasto","es",monthlyScope(WidgetPeriod.monthStart(System.currentTimeMillis())));render(ambiguous);
      ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"registro antiguo pequeño sin causa de formato no demuestra pérdida ausente");
      System.out.println("PASS: overflow Java74 real, prefs sin marca, sólo ACK retenido mantiene pérdida bloqueada");
    }
  public static void main(String[] args){
    if(args.length>0&&args[0].equals("guards")){moneyGuards();return;}
    if(args.length>0&&args[0].equals("fresh")){freshRecovery();return;}
    if(args.length>0&&args[0].equals("races")){readRaces();return;}
    if(args.length>0&&args[0].equals("legacyoverflow")){legacyOverflow();return;}
    legacyOverflow();
    identicalLegacyPrefs();
    freshRecovery();moneyGuards();readRaces();cycleDuringRead();
    if(args.length>0&&args[0].equals("pressure")){pressure();return;}
    long now=System.currentTimeMillis(),month=WidgetPeriod.monthStart(now),cycle=${snapshots[1].periodStart}L;
    Listener persistedCycle=production52(cycle);
    persistedCycle.prefs.edit().putString("periodKind","ciclo").putString("magnitude","neto")
      .putString("scope",${JSON.stringify(snapshots[1].scope)}).putFloat("spent",${snapshots[1].spent}f).commit();
    render(persistedCycle);
    ok(MiCarteraWidget.last.text.get(R.id.w_title).equals("AELY · MI CICLO · GASTO NETO"),"cabecera exacta de foto ciclo persistida APK52");
    persistedCycle.handleResponse(notification(month,false).toString(),MiCarteraWidget.beginIngest(persistedCycle),"raw"); render(persistedCycle);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent+5)} €"),"pago cerrado legacy sobre foto ciclo persistida conserva cifra neta");
    ok(!MiCarteraWidget.last.text.get(R.id.w_sub).equals("Abre la app para actualizar"),"pago conocido no deja aviso bloqueado");
    JSONObject uncertainCycle=notification(month,false).put("ack","uncertain-cycle").put("fecha","2000-01-01T00:00:00.000Z");
    uncertainCycle.optJSONObject("month").put("eventKey","uncertain-cycle").put("expenseKey","uncertain-key");
    persistedCycle.handleResponse(uncertainCycle.toString(),MiCarteraWidget.beginIngest(persistedCycle),"raw"); render(persistedCycle);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—")&&MiCarteraWidget.last.text.get(R.id.w_sub).equals("Abre la app para actualizar"),"fecha realmente incierta mantiene aviso visible");
    legacyApp(persistedCycle,cycle,${snapshots[1].spent+5},100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"ciclo","neto","es",${JSON.stringify(snapshots[1].scope)}); render(persistedCycle);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"abrir sin cobertura del evento incierto no inventa ACK");
    legacyApp(persistedCycle,cycle,${snapshots[1].spent+5},100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|uncertain-cycle|","",2,"ciclo","neto","es",${JSON.stringify(snapshots[1].scope)}); render(persistedCycle);
    ok(MiCarteraWidget.last.text.get(R.id.w_title).equals("AELY · MI CICLO · GASTO NETO")&&MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent+5)} €"),"cobertura real recupera cifra y cabecera ciclo");
    System.out.println("PASS suplemento móvil: foto ciclo APK52 persistida, legacy cerrado, incertidumbre y recuperación sólo con cobertura exacta");
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
    for (boolean legacyFirst : new boolean[]{false,true}) {
    Listener crossed=production52(month);
    long early=MiCarteraWidget.beginIngest(crossed),late=MiCarteraWidget.beginIngest(crossed);
    crossed.handleResponse(notification(month,false).toString(),legacyFirst?early:late,"raw");
    JSONObject oldV2=notification(month,true).put("importe",2);
    oldV2.optJSONObject("month").put("eventKey","older").put("expenseKey","older-key")
      .put("spent",52).put("shownDelta",2).put("againstDelta",2);
    crossed.handleResponse(oldV2.toString(),legacyFirst?late:early,"raw"); render(crossed);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("57 €"),"absoluto en vuelo no deshace pago legacy: ticket primero="+legacyFirst);
    }
    if(args.length>0&&"crossed".equals(args[0])) return;
    Listener legacy=production52(month);
    legacy.handleResponse(notification(month,false).toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"legacy acredita pago conocido del periodo actual sin copiar total");
    ok(MiCarteraWidget.last.text.get(R.id.w_foot).contains("185 €"),"legacy mantiene saldo y precisión");
    legacy.handleResponse(notification(month,false).toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €")&&MiCarteraWidget.last.text.get(R.id.w_foot).contains("185 €"),"legacy idempotente");
    Listener changed=production52(month);
    changed.handleResponse(notification(month,false).put("widget",null).toString(),MiCarteraWidget.beginIngest(changed),"raw"); render(changed);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"servidor v2 sin scope acreditado no se disfraza de legacy");
    legacyApp(legacy,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"abrir app con ACK elimina aviso");
    // La preferencia de la app llega por saveApp; cambia título, ventana y cifra reales.
    legacyApp(legacy,cycle,${snapshots[1].spent},${snapshots[1].budget},120.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"ciclo","neto","es",${JSON.stringify(snapshots[1].scope)}); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_title).contains("MI CICLO"),"preferencia ciclo cambia periodo");
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent)} €"),"ciclo conserva neto con signo");
    JSONObject cyclePay=notification(month,false).put("ack","cycle-payment");
    cyclePay.optJSONObject("month").put("eventKey","cycle-payment").put("expenseKey","cycle-key");
    legacy.handleResponse(cyclePay.toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent+5)} €"),"legacy aplica importe conocido al neto firmado, no el total mensual55");
    JSONObject bizum=notification(month,false).put("ack","large-bizum").put("importe",-300).put("cat","bizum");
    bizum.optJSONObject("month").put("eventKey","large-bizum").put("expenseKey","bizum-key");
    legacy.handleResponse(bizum.toString(),MiCarteraWidget.beginIngest(legacy),"raw"); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[1].spent+5-300)} €"),
      "Bizum conocido no abre otra nómina aunque supere200, conserva signo del ciclo");
    legacyApp(legacy,${snapshots[0].periodStart}L,${snapshots[0].spent},${snapshots[0].budget},45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|cycle-payment|large-bizum|","",2,"mes","gasto","es",${JSON.stringify(snapshots[0].scope)}); render(legacy);
    ok(MiCarteraWidget.last.text.get(R.id.w_title).contains("ESTE MES")
      &&MiCarteraWidget.last.text.get(R.id.w_amount).equals("${Math.round(snapshots[0].spent)} €"),"preferencia mes restaura gasto bruto");
    Listener otherBank=production52(month);
    legacyApp(otherBank,month,50,100,50.0,150.0,200.0,"sabadell","Otra cuenta",
      "|old|","",2,"mes","gasto","es",${JSON.stringify(JSON.stringify([2,snapshots[0].periodStart,'mes','gasto','',100,['trade_republic'],'sabadell']))});
    otherBank.handleResponse(notification(month,false).toString(),MiCarteraWidget.beginIngest(otherBank),"raw"); render(otherBank);
    ok(otherBank.prefs.getFloat("cashDelta",-1)==0 && MiCarteraWidget.last.text.get(R.id.w_foot).contains("200 €"),
      "el pago TR no descuenta saldo/liquidez de otro banco elegido");
    Listener migrated=production52(month);
    migrated.prefs.edit().putBoolean("journalFull",true).putBoolean("unknownPending",true)
      .putString("unknownJournal","payment\\tpaymentKey\\n    ").commit();
    legacyApp(migrated,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(migrated);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"migración antigua sin causa no se acredita por ACK retenido");
    Listener modernFormatting=production52(month);
    WidgetSnapshotArbiter.State modernState=MiCarteraWidget.read(modernFormatting.prefs);
    modernState.journalFull=true; modernState.unknownPending=true;
    modernState.unknownJournal="payment\\tpaymentKey\\n    ";
    MiCarteraWidget.write(modernFormatting.prefs.edit(),modernState);
    legacyApp(modernFormatting,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(modernFormatting);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"formato moderno con marca de identidad conservada recupera");
    Listener uncertain=production52(month); JSONObject old=notification(month,false);
    old.put("fecha","2000-01-01T00:00:00.000Z");
    uncertain.handleResponse(old.toString(),MiCarteraWidget.beginIngest(uncertain),"raw"); render(uncertain);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("—"),"fecha fuera de ventana mantiene incertidumbre real");
    legacyApp(uncertain,month,55,100,45.0,135.0,185.0,"trade_republic","Cuenta",
      "|old|payment|","",2,"mes","gasto","es",monthlyScope(month)); render(uncertain);
    ok(MiCarteraWidget.last.text.get(R.id.w_amount).equals("55 €"),"ACK fresco limpia pago de periodo incierto");
    pressure();
    System.out.println("PASS: listener.handleResponse -> registro -> relectura -> build APK52; legacy/v2 cerrada, neto ciclo, idempotencia, periodo incierto y recuperación");
  }
}`);
const jdk=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'C:/Program Files/Android/Android Studio/jbr/bin';
const probe=process.argv.find(a=>a.startsWith('--probe='));
for(const [name,args] of [['javac',['-encoding','UTF-8','-d',dir,path.join(native,'WidgetSnapshotArbiter.java'),path.join(native,'WidgetPeriod.java'),path.join(dir,'WidgetNotificationTest.java'),path.join(dir,'LegacyWidgetSnapshotArbiter.java')]],['java',['-cp',dir,'com.micartera.app.WidgetNotificationTest',...(probe?[probe.slice(8)]:[])]]]) {
 const executable=path.join(jdk,name+(process.platform==='win32'?'.exe':''));
 const r=spawnSync(fs.existsSync(executable)?executable:name,args,{encoding:'utf8',cwd:root});
 assert.equal(r.status,0,String(r.error||r.stderr||r.stdout)); process.stdout.write(r.stdout);
}
}finally{fs.rmSync(dir,{recursive:true,force:true});}
