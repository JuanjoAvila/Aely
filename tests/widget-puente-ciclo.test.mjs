#!/usr/bin/env node
/* EL WIDGET SE QUEDÓ EN «ABRE LA APP PARA ACTUALIZAR» CON MI CICLO (rechazo de la beta 115 + APK 53,
   feedback 2026-10-11). Todos los tests anteriores llamaban a `saveApp` con un `long` ya hecho;
   ninguno pasaba el TEXTO JSON que llega del puente por `MiCarteraPlugin.updateWidget`, y ahí
   estaba el fallo: un timestamp en milisegundos llega como `Long` y `PluginCall.getDouble` de
   Capacitor solo admite Double, Float o Integer. Devolvía null y el nativo guardaba el día 1 del
   mes en vez del inicio real del ciclo.

   Aquí viaja el contrato entero, con el Java de producción de TRES APK a la vez:
     payload que construye la web (código real de 11-app-main.js) → texto JSON → lectura con los
     getters REALES de Capacitor (node_modules) → `updateWidget` → `MiCarteraWidget` → lo pintado.
   APK 52 = 22396f9a · APK 53 = dfc02866 · APK 54 = el árbol de trabajo.
   Solo preferencias, RemoteViews y org.json son dobles. El doble de org.json tipa los números con
   la regla de `JSONTokener.readLiteral` de Android: entero que cabe en int → Integer, entero mayor
   → Long, con punto → Double. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
const root=path.resolve(import.meta.dirname,'..');
const nativeDir='android/app/src/main/java/com/micartera/app/';
const REFS={52:'22396f9a',53:'dfc02866',54:null};
const show=(ref,file)=>{
  if(!ref) return fs.readFileSync(path.join(root,file),'utf8');
  const r=spawnSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  assert.equal(r.status,0,'git show '+ref+':'+file+' → '+r.stderr); return r.stdout;
};

// ── WEB: el constructor real del payload, el de hoy y el de la web 115 que él rechazó ──────────
const photoOf=src=>{
  const a=src.indexOf('    const data={'), end='if(widgetAfford!=null) data.afford=widgetAfford;';
  const b=src.indexOf(end,a); assert.ok(a>0&&b>a,'no encuentro el constructor del payload del widget');
  return new Function('budW','state','wC','wV2','CURLANG','wScope','widgetCoveredEvents','Date','wRead',
    'widgetCash','trAccW','entOf','widgetBudgetLeft','widgetSafeLiq',src.slice(a,b+end.length)+'\nreturn data;');
};
const mainNow=show(null,'src/modules/11-app-main.js');
const WEB={w111:photoOf(show("b2dfd2c01d7ec6a9a30b74ae71d473054932c42f","src/modules/11-app-main.js")),nueva:photoOf(mainNow),w115:photoOf(show(REFS[53],'src/modules/11-app-main.js'))};
const cli=loadPureLogicFromFile(), nowMs=Date.now(), RealDate=cli.Date;
cli.Date=class extends RealDate {static now(){return nowMs;}};
const iso=ms=>new Date(ms).toISOString();
const PAGOS=[{n:1,importe:5},{n:2,importe:7},{n:3,importe:3}];
// El cobro no puede caer en día 1: con el ciclo empezando el día 1 el fallo no se ve.
const mes=cli.inicioDeMesMs(nowMs);
const estado=(dias,hasta,cycle)=>({budget:500,accounts:[{ent:'trade_republic',role:'diario'}],reservaLog:[],deleted:[],
  settings:{expenseBanks:['trade_republic'],budgetCycle:cycle,gTotalMode:'net'},expenses:[
    {date:iso(nowMs-(dias+3)*86400000),amount:300,category:'super',source:'macrodroid'},
    {date:iso(nowMs-dias*86400000),amount:-1800,category:'ingreso',source:'ob:trade_republic',merchant:'NOMINA EMPRESA'},
    {date:iso(nowMs-2*86400000),amount:120,category:'bares',source:'macrodroid'}]
    .concat(PAGOS.slice(0,hasta).map(p=>({date:iso(nowMs-1000*(10-p.n)),amount:p.importe,category:'super',source:'macrodroid'})))});
const dias=[5,6,7,8].find(d=>cli.budgetPaydayOf(estado(d,0,true),nowMs).start.getTime()!==mes);
const ciclo=cli.budgetPaydayOf(estado(dias,0,true),nowMs).start.getTime();
assert.ok(Number.isInteger(ciclo)&&ciclo!==mes&&ciclo<nowMs,'el ciclo de la prueba no empieza el día 1');
const filas=hasta=>PAGOS.slice(0,hasta).map(p=>({id:'fila-'+p.n,fecha:iso(nowMs-1000*(10-p.n)),ingest_event_id:'evento-'+p.n,source:'macrodroid'}));
const MARCA={current:{readGeneration:'@GEN@',nativeCut:'@CUT@'}};
// `wV2` es lo que deja la negociación: la web 115 solo sabía «sí»; la nueva guarda qué APK es.
const foto=(web,wV2,hasta,marca,cycle=true)=>{
  const st=estado(dias,hasta,cycle), bud=cli.dashboardBudgetStats(st);
  const ancla=cycle?cli.keyOfExpense(cli.budgetPaydayOf(st,nowMs).inc):'';
  const pagado=PAGOS.slice(0,hasta).reduce((a,p)=>a+p.importe,0);
  const data=WEB[web](bud,st,{current:filas(hasta)},wV2,'es',cli.widgetScopeOf(st,bud,ancla,'trade_republic'),
    cli.widgetCoveredEvents,cli.Date,marca?MARCA:{current:null},800-pagado,{ent:'trade_republic'},()=>({label:'Cuenta'}),
    Math.round(Math.max(0,bud.remaining)*100)/100,800-pagado);
  return {data,bud};
};
const base=foto('nueva',54,0,false);
const alcance=base.data.scope, neto=h=>foto('nueva',54,h,false).data.spent;
assert.equal(base.bud.periodStart,ciclo); assert.equal(base.data.periodKind,'ciclo'); assert.equal(neto(0),120);
assert.equal(JSON.parse(alcance)[1],ciclo,'el alcance lleva el inicio real del ciclo');

// Lo que deja `wV2` la negociación real con cada APK (efecto extraído de 11-app-main.js).
const negA=mainNow.indexOf('    if(!nat || !nat.widgetContract){ setWV2(false); return; }');
const negB=mainNow.indexOf('    return function(){ vivo=false; clearTimeout(tm); };',negA);
assert.ok(negA>0&&negB>negA,'no encuentro la negociación del contrato del widget');
const negociar=new Function('nat','setWV2','setTimeout','clearTimeout',mainNow.slice(negA,negB));
const negociado=async nat=>{ let v; negociar(nat,x=>{v=x;},()=>0,()=>{}); await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r)); return v; };
const apk=(code,v=2)=>({widgetContract:async()=>({v}),widgetWaiting:async()=>{},appInfo:async()=>({versionName:'x',versionCode:code})});
const W={};
for(const code of [52,53,54]) W[code]=await negociado(apk(code));

// ── SERVIDOR: lo que devuelve `ingest` por un pago con la app cerrada ─────────────────────────
// `legacy` es el activo (mes natural, sin `widget`); `v2` el que ya calcula la ventana de Inicio.
const respuesta=(p,v2)=>{
  const month={periodStart:mes,readAt:nowMs,eventKey:'evento-'+p.n,expenseKey:'clave-'+p.n,spent:420+p.importe,budget:500,
    budgetLeft:80-p.importe,shownDelta:p.importe,againstDelta:p.importe,counts:1,cashCounts:1};
  const r={ok:true,tipo:'gasto',importe:p.importe,fecha:iso(nowMs-1000*(10-p.n)),cat:'super',comercio:'Compra sintética',ack:'fila-'+p.n,month};
  if(v2) r.widget=Object.assign({},month,{contract:2,periodKind:'ciclo',scope:alcance,periodStart:ciclo,spent:neto(p.n),budgetLeft:500-neto(p.n)});
  return JSON.stringify(r);
};
const datos={ciclo,mes,alcance,neto:[0,1,2,3].map(neto),fotos:{},pagos:{}};
// Así sale del WebView: `JSON.stringify` del mensaje entero, con el payload en `options`.
const puente=data=>JSON.stringify({type:'message',callbackId:'1',pluginId:'MiCartera',methodName:'updateWidget',options:data});
for(const [web,codes] of [['w111',{52:true,53:true,54:true}],['w115',{52:true,53:true,54:true}],['nueva',W]]) for(const code of [52,53,54]) for(const h of [0,1,2,3])
  for(const marca of [false,true]) datos.fotos[[web,code,h,marca?'marca':'sin'].join('/')]=puente(foto(web,codes[code],h,marca).data);
datos.fotos['nueva/54/mes']=puente(foto('nueva',W[54],0,true,false).data);
for(const p of PAGOS) for(const v2 of [false,true]) datos.pagos[(v2?'v2':'legacy')+'/'+p.n]=respuesta(p,v2);
cli.Date=RealDate;

// ── NATIVO: el Java de producción de cada APK en su propio paquete, sobre los mismos dobles ────
const capacitor=fs.readFileSync(path.join(root,'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/PluginCall.java'),'utf8');
const getters=['String getString','Integer getInt','Double getDouble'].map(sig=>{
  const found=capacitor.match(new RegExp('^    public '+sig+'\\(String name[^]*?^    }','gm'));
  assert.equal(found&&found.length,2,'Capacitor ya no declara '+sig+' como se esperaba'); return found.join('\n');
}).join('\n').replaceAll('@Nullable ','');
const metodo=(src,firma)=>{ const m=src.match(new RegExp('^    '+firma+'[^]*?^    }','m')); return m?m[0]:''; };
const arnes=code=>{
  const ref=REFS[code], widget=show(ref,nativeDir+'MiCarteraWidget.java'), listener=show(ref,nativeDir+'TrExpenseListener.java'), plugin=show(ref,nativeDir+'MiCarteraPlugin.java');
  const methods=widget.slice(widget.indexOf('    private static WidgetSnapshotArbiter.State read('),widget.lastIndexOf('\n}')).replaceAll('org.json.','');
  const update=metodo(plugin,'public void updateWidget\\(PluginCall call\\)'); assert.ok(update,'APK '+code+' sin updateWidget');
  const read=metodo(plugin,'public void beginWidgetRead\\(PluginCall call\\)');
  // Cualquier ayudante estático del plugin que lea del puente entra tal cual (APK 54).
  const helpers=(plugin.match(/^    (?:private )?static [A-Za-z]+ bridge[A-Za-z]*\(PluginCall call[^]*?^    }/gm)||[]).join('\n');
  return `package v${code};
import fx.Fx.*;
import java.util.*;
import java.text.NumberFormat;
public class Harness implements Apk {
  static class MiCarteraWidget {
    static final String PREFS="micartera_widget";
    static final int MINT=1,CORAL=2,MUTED=3;
    static RemoteViews last;
    static void refreshAll(Context ctx){last=build(ctx);}
    static long monthStart(long when){return WidgetPeriod.monthStart(when);}
${methods}
  }
  static class Listener extends Context {
    static String eur(double n){return String.valueOf(n);}
    static String eur0(double n){return String.valueOf(n);}
${metodo(listener,'private void handleResponse\\(')}
  }
  static class Plugin {
    Context ctx;
    Context getContext(){return ctx;}
${helpers}
${update}
${read}
  }
  final Listener l=new Listener();
  final Plugin plugin=new Plugin();
  public Harness(){plugin.ctx=l;}
  public SharedPreferences prefs(){return l.prefs;}
  public String[] beginRead(){
    ${read?'PluginCall call=new PluginCall(new JSObject());plugin.beginWidgetRead(call);if(call.resolved==null)return null;return new String[]{call.resolved.optString("readGeneration",""),call.resolved.optString("nativeCut","")};':'return null;'}
  }
  public void updateWidget(PluginCall call){plugin.updateWidget(call);}
  public void pay(String response){
    long ticket=MiCarteraWidget.beginIngest(l);
    l.handleResponse(response,ticket,"raw");
    ${widget.includes('void finishIngest(')?'MiCarteraWidget.finishIngest(l,ticket);':''}
  }
  public String text(int id){MiCarteraWidget.refreshAll(l);return MiCarteraWidget.last.text.get(id);}
}
`;
};
const FX=`package fx;
import java.util.*;
public class Fx {
  public static class SharedPreferences {
    public final Map<String,Object> values=new HashMap<>();
    public int commits;
    public boolean contains(String k){return values.containsKey(k);}
    public long getLong(String k,long d){return contains(k)?(Long)values.get(k):d;}
    public int getInt(String k,int d){return contains(k)?(Integer)values.get(k):d;}
    public float getFloat(String k,float d){return contains(k)?(Float)values.get(k):d;}
    public boolean getBoolean(String k,boolean d){return contains(k)?(Boolean)values.get(k):d;}
    public String getString(String k,String d){return contains(k)?(String)values.get(k):d;}
    public Editor edit(){return new Editor(this);}
    public static class Editor {
      final SharedPreferences p; Editor(SharedPreferences p){this.p=p;}
      public Editor putLong(String k,long v){p.values.put(k,v);return this;}
      public Editor putInt(String k,int v){p.values.put(k,v);return this;}
      public Editor putFloat(String k,float v){p.values.put(k,v);return this;}
      public Editor putBoolean(String k,boolean v){p.values.put(k,v);return this;}
      public Editor putString(String k,String v){p.values.put(k,v);return this;}
      public Editor remove(String k){p.values.remove(k);return this;}
      public boolean commit(){p.commits++;return true;}
      public void apply(){}
    }
  }
  public static class Context {
    public static final int MODE_PRIVATE=0;
    public final SharedPreferences prefs=new SharedPreferences();
    public SharedPreferences getSharedPreferences(String name,int mode){return prefs;}
    public String getPackageName(){return "fixture";}
  }
  public static class RemoteViews {
    public final Map<Integer,String> text=new HashMap<>();
    public RemoteViews(String p,int layout){}
    public void setTextViewText(int id,String value){text.put(id,value);}
    public void setTextColor(int id,int color){}
    public void setViewVisibility(int id,int value){}
    public void setProgressBar(int id,int max,int current,boolean indeterminate){}
    public void setOnClickPendingIntent(int id,PendingIntent p){}
  }
  public static class View {public static final int VISIBLE=0,GONE=8;}
  public static class Intent {public Intent(Context c,Class<?> cls){}}
  public static class MainActivity {}
  public static class PendingIntent {
    public static final int FLAG_UPDATE_CURRENT=1,FLAG_IMMUTABLE=2;
    public static PendingIntent getActivity(Context c,int id,Intent i,int flags){return new PendingIntent();}
  }
  public static class R {
    public static class layout {public static final int widget_micartera=0;}
    public static class id {public static final int w_title=1,w_amount=2,w_afford=3,w_sub=4,w_bar=5,w_foot=6,w_root=7;}
  }
  public static class Notif {
    public static int idFor(String s){return s.hashCode();}
    public static void show(Context c,String title,String body,int id,String... extra){}
  }
  /** Lector JSON mínimo con los tipos numéricos de Android (JSONTokener.readLiteral). */
  static final class Parser {
    final String s; int i;
    Parser(String s){this.s=s;}
    void blancos(){while(i<s.length()&&Character.isWhitespace(s.charAt(i)))i++;}
    Object valor(){
      blancos(); if(i>=s.length())throw new IllegalArgumentException("fin");
      char c=s.charAt(i);
      if(c=='{'){ i++; JSONObject o=new JSONObject(); blancos();
        if(s.charAt(i)=='}'){i++;return o;}
        while(true){ blancos(); String k=cadena(); blancos(); if(s.charAt(i++)!=':')throw new IllegalArgumentException(":");
          o.data.put(k,valor()); blancos(); char d=s.charAt(i++); if(d=='}')return o; if(d!=',')throw new IllegalArgumentException(","); } }
      if(c=='['){ i++; JSONArray a=new JSONArray(); blancos();
        if(s.charAt(i)==']'){i++;return a;}
        while(true){ a.data.add(valor()); blancos(); char d=s.charAt(i++); if(d==']')return a; if(d!=',')throw new IllegalArgumentException(","); } }
      if(c=='"')return cadena();
      int from=i; while(i<s.length()&&",]}".indexOf(s.charAt(i))<0&&!Character.isWhitespace(s.charAt(i)))i++;
      String lit=s.substring(from,i);
      if(lit.equals("null"))return null; if(lit.equals("true"))return Boolean.TRUE; if(lit.equals("false"))return Boolean.FALSE;
      if(lit.indexOf('.')==-1){
        try{ long n=Long.parseLong(lit); if(n<=Integer.MAX_VALUE&&n>=Integer.MIN_VALUE)return (int)n; return n; }
        catch(NumberFormatException e){}
      }
      return Double.valueOf(lit);
    }
    String cadena(){
      if(s.charAt(i++)!='"')throw new IllegalArgumentException("comilla");
      StringBuilder b=new StringBuilder();
      while(true){ char c=s.charAt(i++); if(c=='"')return b.toString();
        if(c!='\\\\'){b.append(c);continue;}
        char e=s.charAt(i++);
        switch(e){ case 'n':b.append('\\n');break; case 't':b.append('\\t');break; case 'r':b.append('\\r');break;
          case 'b':b.append('\\b');break; case 'f':b.append('\\f');break;
          case 'u':b.append((char)Integer.parseInt(s.substring(i,i+4),16));i+=4;break; default:b.append(e); } }
    }
    Object todo(){Object v=valor();blancos();if(i!=s.length())throw new IllegalArgumentException("resto");return v;}
  }
  public static class JSONObject {
    final Map<String,Object> data=new LinkedHashMap<>();
    public JSONObject(){}
    public JSONObject(String s){Object v=new Parser(s).todo();if(!(v instanceof JSONObject))throw new IllegalArgumentException("no es objeto");data.putAll(((JSONObject)v).data);}
    public JSONObject put(String k,Object v){data.put(k,v);return this;}
    public Object opt(String k){return data.get(k);}
    public boolean has(String k){return data.containsKey(k);}
    public boolean optBoolean(String k,boolean d){return data.get(k) instanceof Boolean?(Boolean)data.get(k):d;}
    public String optString(String k,String d){return data.get(k)!=null?String.valueOf(data.get(k)):d;}
    public int optInt(String k,int d){return data.get(k) instanceof Number?((Number)data.get(k)).intValue():d;}
    public long optLong(String k,long d){return data.get(k) instanceof Number?((Number)data.get(k)).longValue():d;}
    public double optDouble(String k,double d){return data.get(k) instanceof Number?((Number)data.get(k)).doubleValue():d;}
    public JSONObject optJSONObject(String k){return data.get(k) instanceof JSONObject?(JSONObject)data.get(k):null;}
    public JSONArray optJSONArray(String k){return data.get(k) instanceof JSONArray?(JSONArray)data.get(k):null;}
  }
  public static class JSONArray {
    final List<Object> data=new ArrayList<>();
    JSONArray(){}
    public JSONArray(String s){Object v=new Parser(s).todo();if(!(v instanceof JSONArray))throw new IllegalArgumentException("no es lista");data.addAll(((JSONArray)v).data);}
    public int length(){return data.size();}
    public int optInt(int i,int d){return i<data.size()&&data.get(i) instanceof Number?((Number)data.get(i)).intValue():d;}
    public long optLong(int i,long d){return i<data.size()&&data.get(i) instanceof Number?((Number)data.get(i)).longValue():d;}
    public String optString(int i,String d){return i<data.size()&&data.get(i)!=null?String.valueOf(data.get(i)):d;}
    public JSONArray optJSONArray(int i){return i<data.size()&&data.get(i) instanceof JSONArray?(JSONArray)data.get(i):null;}
  }
  public static class JSObject extends JSONObject {
    public JSObject(){}
    JSObject(JSONObject from){data.putAll(from.data);}
  }
  /** Los getters son el código de Capacitor 6 tal cual está en node_modules. */
  public static class PluginCall {
    final JSObject data;
    public JSObject resolved;
    public PluginCall(JSObject data){this.data=data;}
    public JSObject getData(){return data;}
${getters}
    public void resolve(){}
    public void resolve(JSObject r){resolved=r;}
  }
  /** El camino de MessageHandler: texto del mensaje → JSObject → sus «options». */
  public static PluginCall bridge(String message){
    return new PluginCall(new JSObject(new JSONObject(message).optJSONObject("options")));
  }
  public interface Apk {
    SharedPreferences prefs();
    String[] beginRead();
    void updateWidget(PluginCall call);
    void pay(String response);
    String text(int id);
  }
}
`;
const DRIVER=`import fx.Fx;
import fx.Fx.*;
import java.nio.file.*;
public class Driver {
  static JSONObject datos,fotos,pagos;
  static long ciclo,mes;
  static final String AVISO="Abre la app para actualizar";
  static void ok(boolean value,String why){if(!value)throw new AssertionError(why);}
  static Apk apk(int code){return code==52?new v52.Harness():code==53?new v53.Harness():new v54.Harness();}
  static String cifra(Apk a){return a.text(R.id.w_amount);}
  static String pie(Apk a){return a.text(R.id.w_sub);}
  static String neto(int pagos){return Math.round(datos.optJSONArray("neto").optInt(pagos,0))+" €";}
  /** Abrir la app: lectura nueva (si la APK sabe), pull con \`hasta\` pagos ya guardados y foto. */
  static void abrir(Apk a,String web,int code,int hasta,boolean conMarca){
    String[] mark=conMarca?a.beginRead():null;
    String foto=fotos.optString(web+"/"+code+"/"+hasta+"/"+(mark!=null?"marca":"sin"),null);
    ok(foto!=null,"falta la foto "+web+"/"+code+"/"+hasta);
    if(mark!=null)foto=foto.replace("@GEN@",mark[0]).replace("@CUT@",mark[1]);
    a.updateWidget(Fx.bridge(foto));
  }
  static void pagar(Apk a,int n,boolean v2){a.pay(pagos.optString((v2?"v2":"legacy")+"/"+n,null));}
  static void heredar(Apk de,Apk a){a.prefs().values.putAll(de.prefs().values);}
  /** Lo que tiene hoy el móvil del dueño: foto de la APK 52, actualiza a la 53, paga dos veces
      con la app cerrada y la web 115 ya no consigue escribir al abrir. */
  static Apk atascado53(boolean servidorV2){
    Apk v52=apk(52); abrir(v52,"w115",52,0,false);
    ok(cifra(v52).equals(neto(0)),"APK 52 + web 115 pintaba la cifra al abrir: "+cifra(v52));
    ok(v52.prefs().getLong("periodStart",0)==mes&&mes!=ciclo,"APK 52 guardaba el día 1 del mes, no el inicio del ciclo (fallo latente)");
    Apk v53=apk(53); heredar(v52,v53);
    pagar(v53,1,servidorV2); ok(pie(v53).equals(AVISO),"APK 53: el primer pago con la app cerrada deja el aviso");
    pagar(v53,2,servidorV2);
    int antes=v53.prefs().commits;
    abrir(v53,"w115",53,2,true);
    ok(v53.prefs().commits==antes&&pie(v53).equals(AVISO),"REPRODUCIDO: APK 53 + web 115 descarta la foto en mudo y el aviso se queda");
    return v53;
  }
  static void diagnostico(){
    PluginCall entero=Fx.bridge(fotos.optString("w115/53/0/sin",null));
    ok(entero.getData().opt("periodStart") instanceof Long,"el inicio de ciclo llega del puente como Long");
    ok(entero.getDouble("periodStart")==null,"Capacitor getDouble devuelve null para un Long: esa es la raíz");
    ok(entero.getDouble("spent")!=null&&entero.getInt("contract")==2,"las cifras pequeñas sí llegan");
    atascado53(false);
    System.out.println("PASS diagnóstico: periodStart llega Long, getDouble da null, la 52 guardaba el día 1 y la 53 descarta en mudo");
  }
  /** El contrato de la APK 54 con el JSON real: instalación limpia, ciclo que no empieza el día 1. */
  static void contrato54(){
    Apk a=apk(54); abrir(a,"nueva",54,0,true);
    ok(a.prefs().getLong("periodStart",0)==ciclo,"APK 54 guarda el inicio REAL del ciclo, no el día 1: "+a.prefs().getLong("periodStart",0)+" frente a "+ciclo);
    ok(cifra(a).equals(neto(0))&&!pie(a).equals(AVISO),"APK 54 escribe la cifra de Mi ciclo: "+cifra(a));
    ok(a.text(R.id.w_title).equals("AELY · MI CICLO · GASTO NETO"),"cabecera de ciclo");
    Apk m=apk(54); m.updateWidget(Fx.bridge(fotos.optString("nueva/54/mes",null).replace("@GEN@","x").replace("@CUT@","0")));
    ok(m.prefs().getLong("periodStart",0)==mes&&m.text(R.id.w_title).contains("ESTE MES"),"el mes natural sigue guardando el día 1");
    System.out.println("PASS contrato APK 54: payload web → JSON del puente → plugin → widget escribe ciclo y mes");
  }
  /** La secuencia del dueño con la web nueva sobre cada APK. */
  static void secuencia(int code,boolean servidorV2){
    Apk a;
    if(code==52){
      a=apk(52); abrir(a,"w111",52,0,false); pagar(a,1,servidorV2); pagar(a,2,servidorV2);
      ok(pie(a).equals(AVISO),"APK 52: pagar con la app cerrada deja el aviso (ya era así)");
    } else { a=apk(code); heredar(atascado53(servidorV2),a); ok(pie(a).equals(AVISO),"estado heredado con el aviso puesto"); }
    abrir(a,"nueva",code,2,true);
    ok(cifra(a).equals(neto(2))&&!pie(a).equals(AVISO),"APK "+code+": abrir la app restaura la cifra: "+cifra(a)+" / "+pie(a));
    pagar(a,3,servidorV2);
    if(code==52) ok(pie(a).equals(AVISO),"APK 52 no cambia: el pago con la app cerrada sigue pidiendo abrirla");
    else {
      ok(cifra(a).equals(neto(3))&&!pie(a).equals(AVISO),"APK "+code+": el pago con la app cerrada sube la cifra sin aviso: "+cifra(a)+" / "+pie(a));
      ok(a.prefs().getLong("periodStart",0)==ciclo,"APK "+code+" guarda la ventana real del ciclo");
      pagar(a,3,servidorV2); ok(cifra(a).equals(neto(3)),"la reentrega del mismo pago no suma dos veces");
    }
    for(int vez=0;vez<2;vez++){
      abrir(a,"nueva",code,3,true);
      ok(cifra(a).equals(neto(3))&&!pie(a).equals(AVISO),"APK "+code+": al abrir coincide con la app, sin doble suma: "+cifra(a));
    }
    String saldo=a.text(R.id.w_foot);
    ok(saldo!=null&&saldo.contains("785 €"),"el saldo de la cuenta descuenta cada pago una sola vez: "+saldo);
  }
  /** Un móvil que YA arrastra pérdida marcada (registro lleno) solo sale con una lectura nueva. */
  static void heredadoLleno(){
    for(int code:new int[]{53,54}){
      Apk a=apk(code); heredar(atascado53(false),a);
      a.prefs().edit().putBoolean("journalFull",true).putBoolean("unknownLoss",true).putBoolean("identityLost",true)
        .putBoolean("unknownPending",true).putBoolean("negotiating",true).commit();
      abrir(a,"nueva",code,2,false);
      ok(cifra(a).equals("—"),"APK "+code+": sin lectura nueva acreditada la pérdida heredada no se borra");
      abrir(a,"nueva",code,2,true);
      ok(cifra(a).equals(neto(2))&&!pie(a).equals(AVISO),"APK "+code+": la lectura nueva recupera también el registro lleno: "+cifra(a));
    }
    // La alternativa descartada para la 53 (quitarle la marca): vuelve la 52, pero esto no lo cura.
    Apk sinMarca=apk(53); heredar(atascado53(false),sinMarca);
    sinMarca.prefs().edit().putBoolean("journalFull",true).putBoolean("unknownLoss",true).putBoolean("identityLost",true).commit();
    abrir(sinMarca,"w115",53,2,false);
    ok(cifra(sinMarca).equals("—"),"sin marca la APK 53 no puede retirar una pérdida heredada");
    pagar(sinMarca,3,false);
    ok(pie(sinMarca).equals(AVISO),"y sin marca el pago con la app cerrada seguiría dejando el aviso");
    // El corte de lectura puede no llegar a tiempo: la foto sin marca concilia igual lo ya cubierto.
    Apk tarde=apk(53); heredar(atascado53(false),tarde); abrir(tarde,"nueva",53,2,false);
    ok(cifra(tarde).equals(neto(2))&&tarde.prefs().getLong("periodStart",0)==ciclo,"APK 53 sin marca: la foto cubre los pagos y deja la ventana real: "+cifra(tarde));
    System.out.println("PASS heredado: registro lleno + aviso se recuperan con lectura nueva en APK 53 (web nueva) y APK 54");
  }
  public static void main(String[] args) throws Exception {
    datos=new JSONObject(new String(Files.readAllBytes(Paths.get(args[0])),"UTF-8"));
    fotos=datos.optJSONObject("fotos"); pagos=datos.optJSONObject("pagos");
    ciclo=datos.optLong("ciclo",0); mes=datos.optLong("mes",0);
    diagnostico();
    contrato54();
    for(int code:new int[]{52,53,54}) for(boolean v2:new boolean[]{false,true}) secuencia(code,v2);
    System.out.println("PASS secuencia del dueño (aviso → abrir → pagar cerrada → abrir) en APK 52, 53 y 54 con servidor legacy y v2");
    heredadoLleno();
  }
}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-puente-'));
try {
  const fuentes=[];
  const escribir=(rel,texto)=>{ const f=path.join(dir,rel); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,texto); fuentes.push(f); };
  escribir('fx/Fx.java',FX); escribir('Driver.java',DRIVER);
  for(const code of [52,53,54]) {
    escribir('v'+code+'/Harness.java',arnes(code));
    for(const pure of ['WidgetSnapshotArbiter.java','WidgetPeriod.java'])
      escribir('v'+code+'/'+pure,show(REFS[code],nativeDir+pure).replace('package com.micartera.app;','package v'+code+';'));
  }
  fs.writeFileSync(path.join(dir,'datos.json'),JSON.stringify(datos));
  const jdk=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'C:/Program Files/Android/Android Studio/jbr/bin';
  for(const [name,args] of [['javac',['-encoding','UTF-8','-nowarn','-d',path.join(dir,'out'),...fuentes]],
      ['java',['-Dfile.encoding=UTF-8','-Dstdout.encoding=UTF-8','-cp',path.join(dir,'out'),'Driver',path.join(dir,'datos.json')]]]) {
    const executable=path.join(jdk,name+(process.platform==='win32'?'.exe':''));
    const r=spawnSync(fs.existsSync(executable)?executable:name,args,{encoding:'utf8',cwd:root});
    process.stdout.write(r.stdout||'');
    assert.equal(r.status,0,String(r.error||r.stderr||r.stdout));
  }
} finally { fs.rmSync(dir,{recursive:true,force:true}); }

// ── WEB: qué manda a cada APK ─────────────────────────────────────────────────────────────────
const opciones=clave=>JSON.parse(datos.fotos[clave]).options;
assert.equal(await negociado({}),false,'sin widgetContract (APK 51) sigue el payload mensual histórico');
assert.equal(await negociado(apk(53,1)),false,'un contrato anterior al 2 no se trata como v2');
assert.deepEqual([W[52],W[53],W[54]],[52,53,54],'la negociación guarda qué APK es, y sigue siendo «sí» para el contrato');
const sinVersion=apk(53); sinVersion.appInfo=async()=>{ throw new Error('sin PackageManager'); };
assert.equal(await negociado(sinVersion),true,'si la APK no dice su versión se manda el contrato completo, no se degrada a legacy');
sinVersion.appInfo=async()=>undefined;
assert.equal(await negociado(sinVersion),true,'una respuesta vacía de la APK tampoco degrada el contrato');
for(const h of [0,2,3]) for(const m of ['sin','marca'])
  assert.deepEqual(opciones('nueva/52/'+h+'/'+m),opciones('w115/52/'+h+'/'+m),'APK 52: ni un campo cambia respecto a la web 115');
for(const h of [0,2,3]) assert.deepEqual(opciones('nueva/52/'+h+'/sin'),opciones('w111/52/'+h+'/sin'),'APK52: payload igual a producción111, sin beginWidgetRead en ese nativo');
const p53=opciones('nueva/53/2/marca'), p54=opciones('nueva/54/2/marca');
assert.equal(p53.periodStart,ciclo+0.5,'APK 53 en ciclo: el inicio viaja con medio milisegundo para llegar como Double');
assert.match(datos.fotos['nueva/53/2/marca'],new RegExp('"periodStart":'+ciclo+'\\.5[,}]'),'y así sale en el texto JSON del puente');
assert.equal(Math.trunc(p53.periodStart),ciclo,'que el nativo trunca al milisegundo exacto del ciclo');
assert.deepEqual(Object.assign({},p53,{periodStart:ciclo}),p54,'APK 53: el resto del contrato es el completo, marca incluida');
assert.equal(p54.periodStart,ciclo,'APK 54: entero exacto'); assert.equal(p54.readGeneration,'@GEN@'); assert.equal(p54.nativeCut,'@CUT@');
cli.Date=class extends RealDate {static now(){return nowMs;}};
const mes53=foto('nueva',W[53],0,true,false).data;
cli.Date=RealDate;
assert.equal(mes53.periodKind,'mes'); assert.ok(Number.isInteger(mes53.periodStart),'APK 53 en mes natural no cambia: ya funcionaba con el día 1');
console.log('PASS web: negociación 51/52/53/54 y payload por APK (52 intacta, 53 con inicio Double, 54 contrato completo)');
