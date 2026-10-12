#!/usr/bin/env node
// Una misma tabla prueba la selección web y la vigencia Java: ningún oráculo copia la otra regla.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
const root=path.resolve(import.meta.dirname,'..');
const fixture=path.join(root,'tests/fixtures/widget-ciclo.tsv');
const rows=fs.readFileSync(fixture,'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split('\t'));
// Solo se evalúan las dos funciones del módulo fuente, sin build ni artefacto generado.
const source=fs.readFileSync(path.join(root,'src/modules/04-tab-gastos.js'),'utf8');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-ciclo-'));
const oldTZ=process.env.TZ;
const jdk=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin'):'C:/Program Files/Android/Android Studio/jbr/bin';
function run(name,args){
  const exe=path.join(jdk,name+(process.platform==='win32'?'.exe':''));
  const r=spawnSync(fs.existsSync(exe)?exe:name,args,{cwd:root,encoding:'utf8'});
  process.stdout.write(r.stdout||''); assert.equal(r.status,0,String(r.error||r.stderr||r.stdout));
}
try {
  const java=path.join(dir,'WidgetCycleTest.java');
  fs.writeFileSync(java,`package com.micartera.app;
import java.nio.file.*;
import java.time.*;
public class WidgetCycleTest {
  static long ms(String s){return s.equals("-")?0:s.endsWith("Z")?Instant.parse(s).toEpochMilli():LocalDateTime.parse(s).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();}
  static void eq(boolean actual,boolean expected,String why){if(actual!=expected)throw new AssertionError(why+": "+actual+" != "+expected);}
  public static void main(String[] args)throws Exception{
    int count=0;
    for(String line:Files.readAllLines(Paths.get(args[0])).subList(1,Files.readAllLines(Paths.get(args[0])).size())){
      String[] c=line.split("\\t"); if(!c[1].equals("*")&&!c[1].equals(args[1]))continue;
      long now=ms(c[4]),start=ms(c[6]); boolean valid=c[7].equals("true");
      eq(WidgetPeriod.cycleValid(start,now),valid,c[0]+" vigencia");
      eq(WidgetPeriod.acceptApp(2,"ciclo",start,now),valid,c[0]+" foto app");
      if(start>0)eq(WidgetPeriod.stale(2,"ciclo",start,now),!valid,c[0]+" cifra vencida");
      if(c[5].equals("mes"))eq(WidgetPeriod.acceptApp(2,"mes",WidgetPeriod.monthStart(now),now),true,c[0]+" mes natural");
      if(valid){
        eq(WidgetPeriod.current(2,"ciclo",start,now)==start,true,c[0]+" conserva ventana");
        eq(WidgetPeriod.acceptServer(2,"ciclo",start,2,"ciclo",start,now),true,c[0]+" misma ventana");
        eq(WidgetPeriod.acceptServer(2,"ciclo",start,2,"ciclo",start-86400000L,now),false,c[0]+" otra ventana");
      }
      count++;
    }
    System.out.println("PASS JVM "+args[1]+": "+count+" filas compartidas");
  }
}`);
  run('javac',['-encoding','UTF-8','-d',dir,path.join(root,'android/app/src/main/java/com/micartera/app/WidgetPeriod.java'),java]);
  for(const zone of ['UTC','Europe/Madrid']){
    process.env.TZ=zone;
    // La caché de fechas de la app pertenece a un dispositivo: no heredar parses de otra zona.
    const cli=loadPureLogicFromFile();
    vm.runInNewContext(source.slice(source.indexOf('function lastPaydayOf('),source.indexOf('/* Límites del período')),cli);
    let count=0;
    for(const [id,z,pay,newPay,now,kind,start,valid] of rows){
      if(z!=='*'&&z!==zone)continue;
      const expenses=[pay,newPay].filter(d=>d!=='-').map((date,i)=>({id:'salary-'+i,date,amount:-1800,merchant:'NOMINA SINTETICA',category:'ingreso',ent:'trade_republic'}));
      const s={expenses,deleted:[],flows:[],accounts:[{ent:'trade_republic',role:'diario'}],settings:{budgetCycle:kind==='ciclo'}};
      const actual=cli.budgetPaydayOf(s,Date.parse(now));
      assert.equal(!!actual,valid==='true',zone+' '+id+' selección');
      if(actual)assert.equal(actual.start.getTime(),Date.parse(start),zone+' '+id+' medianoche local');
      cli.Date=class extends Date {static now(){return Date.parse(now);}};
      const period=cli.budgetPeriodOf(s);
      assert.equal(!!period.cycle,kind==='ciclo'&&valid==='true',zone+' '+id+' periodo presupuesto');
      if(kind==='mes'||valid!=='true')assert.equal(period.startMs,cli.inicioDeMesMs(Date.parse(now)),zone+' '+id+' mes natural');
      cli.Date=Date; count++;
    }
    console.log('PASS web '+zone+': '+count+' filas compartidas');
    run('java',['-Duser.timezone='+zone,'-cp',dir,'com.micartera.app.WidgetCycleTest',fixture,zone]);
  }
} finally {
  if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;
  fs.rmSync(dir,{recursive:true,force:true});
}
