#!/usr/bin/env node
// Una misma tabla prueba la selección web y la vigencia Java: ningún oráculo copia la otra regla.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadPureLogicFromFile} from '../scripts/load-pure-logic.mjs';
const root=path.resolve(import.meta.dirname,'..');
const fixture=path.join(root,'tests/fixtures/widget-ciclo.tsv');
const rows=fs.readFileSync(fixture,'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split('\t'));
// Solo se evalúan las dos funciones del módulo fuente, sin build ni artefacto generado.
const source=fs.readFileSync(path.join(root,'src/modules/04-tab-gastos.js'),'utf8');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aely-widget-ciclo-'));
const oldTZ=process.env.TZ;
function madridMs(s){
  if(s==='-')return 0;
  if(s.endsWith('Z'))return Date.parse(s);
  const utc=Date.parse(s+'Z');let ms=utc;
  for(let i=0;i<2;i++){
    const offset=new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',timeZoneName:'longOffset'}).formatToParts(ms).find(p=>p.type==='timeZoneName').value;
    const [,sign,h,m]=offset.match(/GMT([+-])(\d+):(\d+)/);
    ms=utc-(sign==='+'?1:-1)*(+h*60+ +m)*60000;
  }
  return ms;
}
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
  static long ms(String s){return s.equals("-")?0:s.endsWith("Z")?Instant.parse(s).toEpochMilli():LocalDateTime.parse(s).atZone(ZoneId.of("Europe/Madrid")).toInstant().toEpochMilli();}
  static void eq(boolean actual,boolean expected,String why){if(actual!=expected)throw new AssertionError(why+": "+actual+" != "+expected);}
  public static void main(String[] args)throws Exception{
    int count=0;
    for(String line:Files.readAllLines(Paths.get(args[0])).subList(1,Files.readAllLines(Paths.get(args[0])).size())){
      String[] c=line.split("\\t");
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
  for(const zone of ['UTC','Europe/Madrid','Atlantic/Canary','America/Santiago','Africa/Cairo']){
    process.env.TZ=zone;
    // La caché de fechas de la app pertenece a un dispositivo: no heredar parses de otra zona.
    const cli=loadPureLogicFromFile();
    vm.runInNewContext(source.slice(source.indexOf('function lastPaydayOf('),source.indexOf('/* Límites del período')),cli);
    let count=0;
    for(const [id,z,pay,newPay,now,kind,start,valid] of rows){
      const expenses=[pay,newPay].filter(d=>d!=='-').map((date,i)=>({id:'salary-'+i,date:new Date(madridMs(date)).toISOString(),amount:-1800,merchant:'NOMINA SINTETICA',category:'ingreso',ent:'trade_republic'}));
      const s={expenses,deleted:[],flows:[],accounts:[{ent:'trade_republic',role:'diario'}],settings:{budgetCycle:kind==='ciclo'}};
      const actual=cli.budgetPaydayOf(s,madridMs(now));
      assert.equal(!!actual,valid==='true',zone+' '+id+' selección');
      if(actual)assert.equal(actual.start.getTime(),madridMs(start),zone+' '+id+' medianoche Madrid');
      cli.Date=class extends Date {static now(){return madridMs(now);}};
      const period=cli.budgetPeriodOf(s);
      assert.equal(!!period.cycle,kind==='ciclo'&&valid==='true',zone+' '+id+' periodo presupuesto');
      if(kind==='mes'||valid!=='true')assert.equal(period.startMs,cli.inicioDeMesMs(madridMs(now)),zone+' '+id+' mes natural');
      cli.Date=Date; count++;
    }
    console.log('PASS web '+zone+': '+count+' filas compartidas');
    run('java',['-Duser.timezone='+zone,'-cp',dir,'com.micartera.app.WidgetCycleTest',fixture,zone]);
  }
  // La decisión Madrid no debe mover cifras de quien ya tenía el dispositivo en Madrid.
  process.env.TZ='Europe/Madrid';
  // Un rebase retira ese commit de las refs remotas: CI no debe depender de objetos locales.
  const previous=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/widget-payday-b1d3.json'),'utf8'));
  assert.equal(previous.sourceSHA,'b1d3c8e88efb72488caf68c305ee737286360a62');
  assert.equal(crypto.createHash('sha256').update(previous.source).digest('hex'),previous.sha256);
  const before=loadPureLogicFromFile(),after=loadPureLogicFromFile();
  vm.runInNewContext(previous.source,before);
  vm.runInNewContext(source.slice(source.indexOf('function lastPaydayOf('),source.indexOf('/* Límites del período')),after);
  let swept=0;
  for(const date of ['2026-03-01','2026-08-20','2026-10-01']) for(const payHour of [0,12,23])
    for(const day of [0,44,45,46]) for(let hour=0;hour<24;hour++){
      const pay=new Date(date+'T00:00:00');pay.setHours(payHour);
      const clock=new Date(date+'T00:00:00');clock.setDate(clock.getDate()+day);clock.setHours(hour,59,59,999);
      const s={budget:1000,accounts:[{ent:'trade_republic',role:'diario'}],settings:{budgetCycle:true},expenses:[
        {date:pay.toISOString(),amount:-1800,merchant:'NOMINA SINTETICA',category:'ingreso',ent:'trade_republic'},
        {date:new Date(pay.getTime()+86400000).toISOString(),amount:140,category:'super',ent:'trade_republic'}]};
      for(const cli of [before,after])cli.Date=class extends Date {static now(){return clock.getTime();}};
      const values=cli=>{const b=cli.dashboardBudgetStats(s);return [b.periodStart,!!b.cycle,b.spent,b.against,b.remaining];};
      assert.deepEqual(values(after),values(before),date+' cobro'+payHour+' día'+day+' hora'+hour);swept++;
    }
  console.log('PASS A/B Madrid: '+swept+' casos con ventana y cifras iguales a b1d3c8e8');
} finally {
  if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;
  fs.rmSync(dir,{recursive:true,force:true});
}
