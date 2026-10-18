#!/usr/bin/env node
/**
 * Invariantes de seguridad que NO se ven leyendo un diff, y que si se rompen lo hacen en silencio.
 *
 * Cada comprobación está aquí porque su fallo tendría consecuencias reales:
 *   1. Un método de `cloud` que escriba y no esté en CLOUD_WRITES → el modo pruebas dejaría de ser
 *      un modo pruebas y ensuciaría la cartera de verdad (y la del padre y la pareja).
 *   2. Un token de credencial generado con Math.random() → adivinable; quien lo saque puede meter
 *      gastos falsos en la cuenta de cualquiera.
 *   3. Una CSP sin las directivas que de verdad cortan una exfiltración.
 *   4. La anon key de Supabase es pública por diseño; la service_role NO puede aparecer JAMÁS.
 */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let failed = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const bad = (name, detail) => { failed++; console.log(`  ✗ ${name}`); if (detail) console.log("      " + detail); };

console.log("security");

/* ---- 1. El blindaje del banco de pruebas cubre TODAS las escrituras ---- */
{
  const core = read("src/modules/00-core.js");
  const cloudStart = core.indexOf("const cloud = (function(){");
  const cloudEnd = core.indexOf("\n})();", cloudStart);
  const cloudBody = core.slice(cloudStart, cloudEnd);
  const methods = [...cloudBody.matchAll(/^ {4}(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]);

  const listMatch = core.match(/const CLOUD_WRITES=\[([\s\S]*?)\];/);
  if (!listMatch) {
    bad("CLOUD_WRITES existe", "no se encontró la lista en 00-core.js");
  } else {
    const guarded = new Set([...listMatch[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1]));

    // Heurística: un método ESCRIBE si su cuerpo hace insert/update/upsert/delete, o si invoca una
    // Edge Function que no sea de solo lectura.
    const READ_ONLY_FNS = new Set(["prices", "categorize", "help-assistant", "bank-sync", "bank-aspsps", "myinvestor-sync", "myinvestor-status"]);
    const writers = [];
    for (const name of methods) {
      if (name === "if" || name === "enabled") continue;
      const re = new RegExp(`^ {4}(?:async\\s+)?${name}\\s*\\([\\s\\S]*?\\n {4}\\},`, "m");
      const m = cloudBody.match(re);
      if (!m) continue;
      const body = m[0];
      const mutates = /\.(insert|update|upsert|delete)\(/.test(body);
      const fnCall = body.match(/functions\.invoke\(\s*['"]([a-z-]+)['"]/);
      const invokesWriter = fnCall && !READ_ONLY_FNS.has(fnCall[1]);
      if (mutates || invokesWriter) writers.push(name);
    }

    const unguarded = writers.filter((w) => !guarded.has(w));
    if (unguarded.length) {
      bad(
        "toda escritura de cloud está blindada en modo pruebas",
        `sin blindar: ${unguarded.join(", ")} — añádelos a CLOUD_WRITES en 00-core.js o el modo pruebas escribirá en producción`,
      );
    } else {
      ok(`las ${writers.length} escrituras de cloud pasan por el blindaje del modo pruebas`);
    }

    // Y al revés: una entrada que ya no exista es un despiste que deja un hueco silencioso.
    const stale = [...guarded].filter((g) => !methods.includes(g));
    if (stale.length) bad("CLOUD_WRITES sin entradas fantasma", `ya no existen en cloud: ${stale.join(", ")}`);
    else ok("CLOUD_WRITES no tiene entradas fantasma");
  }
}

/* INC171001: ejecuta la envoltura REAL para todos los escritores; no basta reconocer su lista. */
{
  const core=read('src/modules/00-core.js').replace(/\r\n/g,'\n');
  const names=[...core.match(/const CLOUD_WRITES=\[([\s\S]*?)\];/)[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map(m=>m[1]);
  const writes=[],events=[];let sandbox=false;
  const ctx=vm.createContext({Promise,window:{dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type){this.type=type;}},
    cloud:Object.fromEntries(names.map(n=>[n,(payload)=>{writes.push({name:n,payload});return Promise.resolve('writer-enabled');}])),mcSandbox:()=>sandbox,CLOUD_WRITES:names,CLOUD_READS_QUE_LLENAN:[]});
  const start=core.indexOf('var _mcSandboxTransition=false;'),stop=core.indexOf('function mcSandbox(){',start);
  vm.runInContext(core.slice(start,stop),ctx);
  const guard=core.indexOf('(function(){\n  CLOUD_WRITES.forEach'),end=core.indexOf('\n})();',guard)+7;
  vm.runInContext(core.slice(guard,end),ctx);
  ctx.mcSandboxTransition(true);ctx.mcSandboxTransition(true);
  let rejected=true;
  for(const n of names)if(await ctx.cloud[n]({seed:'INC171001_SEED_ONLY'})!==null)rejected=false;
  if(!rejected||writes.length||events.length!==1)bad('transición bloquea TODOS los escritores aun pinned real','escapó un writer o la transición no es idempotente');
  else ok('transición bloquea todos los escritores con la semilla marcada y pinned real');
  ctx.mcSandboxTransition(false);
  for(const n of names)await ctx.cloud[n]({real:'pending-edit'});
  if(writes.length!==names.length)bad('cancelar transición restaura escritores reales','no reanudó la misma envoltura');
  else ok('cancelar transición restaura escritores reales sin cambiar CLOUD_WRITES');
  const before=writes.length;sandbox=true;
  for(const n of names)await ctx.cloud[n]({seed:'INC171001_SEED_ONLY'});
  if(writes.length!==before)bad('modo destino sandbox sigue bloqueado','se perdió la guarda existente');else ok('el modo destino sandbox conserva el blindaje');
}

// Ejecuta también el efecto de App: cortar una llamada en la guarda no prueba que se
// haya cancelado el debounce. Abrir la guarda NO es una autorización de escritura local:
// el búfer existente se conserva hasta el pagehide o su temporizador normal.
{
  const app=read('src/modules/11-app-main.js').replace(/\r\n/g,'\n'),begin=app.indexOf('// Empuja el estado a la nube (debounced)'),end=app.indexOf('// Al volver, los gastos',begin);
  const timers=new Map(),listeners=new Map(),uploads=[],durable=[],acks=[];let next=0,blocked=false;
  const state={budget:501.23,settings:{pending:'real-edit'},_savedAt:12345};
  const cloudUpdatedAtRef={current:'base-stamp'};
  const ctx=vm.createContext({state,uid:'synthetic-user',cloudUpdatedAtRef,sessionRef:{current:{user:{id:'synthetic-user'}}},
    useRef:value=>({current:value}),goalSyncMetadataOnly:()=>false,
    setStateRaw:fn=>fn(state),goalSyncAck:(prev,uid,sent,expected,updated)=>{acks.push({prev,uid,sent,expected,updated});return prev;},
    useEffect:fn=>fn(),setTimeout:fn=>{const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    mcSandboxTransition:()=>blocked,flushPersist:()=>durable.push(structuredClone(state)),slimForCloud:x=>x,
    cloud:{pushState:(uid,data,expected)=>{uploads.push({uid,data,expected});return Promise.resolve({updated_at:'next-stamp'});}},
    window:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:()=>{}},showToast:()=>{},syncFromCloud:()=>{},t:x=>x});
  // Ejecuta también el uploader de beta141; el temporizador no puede saltarse su ACK/CAS.
  const pushBegin=app.indexOf('  const pushAppState=function('),pushEnd=app.indexOf('  const notifyGoalConflicts=',pushBegin);
  vm.runInContext(app.slice(pushBegin,pushEnd)+app.slice(begin,end),ctx);
  const armed=timers.size===1;blocked=true;listeners.get('mc-sandbox-transition')();
  if(!armed||timers.size||uploads.length||durable.length)bad('transición cancela debounce sin forzar escrituras locales','timer activo o escritura local inducida');
  else ok('transición cancela debounce sin forzar escrituras locales');
  blocked=false;listeners.get('mc-sandbox-transition')();
  if(timers.size!==1)bad('acuse fallido rearma el push normal','sin timer de recuperación');
  else{const callback=[...timers.values()][0];callback();if(uploads.length!==1||uploads[0].data.settings.pending!=='real-edit')bad('acuse fallido rearma el push normal','payload incorrecto');else ok('acuse fallido rearma el push normal con la edición real');}
  await Promise.resolve();await Promise.resolve();
  if(uploads[0]?.expected!=='base-stamp'||cloudUpdatedAtRef.current!=='next-stamp'||acks.length!==1||acks[0].sent!==state||acks[0].expected!=='base-stamp')bad('rearmado conserva uploader y ACK de beta141','se perdió el contrato del envío confirmado');
  else ok('rearmado conserva uploader y ACK de beta141');
}

/* ---- 1 bis. `bankSync` es una LECTURA que puede mover el cursor del servidor ----
   No está en CLOUD_WRITES a propósito (en pruebas se sigue leyendo del banco), pero desde el
   acuse (12/10/2026) su cuerpo lleva `acks`, y un acuse aceptado ESCRIBE `bank_links.last_sync`.
   Lo que impide que el banco de pruebas mueva el cursor real es que el acuse ni se lee ni se
   guarda allí, y que no hay otra fuente de `acks` que esa. El comportamiento, con el handler
   real, lo prueba `bank-sync-acuse` (H2); aquí se fija que la puerta no se abra por otro lado. */
{
  const core = read("src/modules/00-core.js").replace(/\r\n/g, "\n");
  const src = fs.readdirSync(path.join(root, "src/modules")).filter((f) => f.endsWith(".js")).map((f) => [f, read("src/modules/" + f)]);
  const cuerpo = (name) => (core.match(new RegExp("\\nfunction " + name + "\\([^)]*\\)\\{\\n([\\s\\S]*?)\\n\\}")) || [])[1] || "";
  const sinPuerta = ["obAckLoad", "obAckSave"].filter((n) => !/^\s*if\(mcSandbox\(\)\) return /.test(cuerpo(n)));
  if (sinPuerta.length) bad("el acuse de bancos no se lee ni se guarda en modo pruebas", `sin \`if(mcSandbox()) return\` al entrar: ${sinPuerta.join(", ")}`);
  else ok("el acuse de bancos no se lee ni se guarda en modo pruebas");

  const envios = src.flatMap(([f, text]) => [...text.matchAll(/acks\s*:\s*([^,}]+)/g)].map((m) => f + ": acks:" + m[1].trim()));
  const ajenos = envios.filter((e) => !/acks:obAckLoad\(\)$/.test(e));
  if (envios.length !== 1 || ajenos.length) bad("`acks` solo sale de obAckLoad()", envios.join(" · ") || "no se encontró el envío");
  else ok("`acks` solo sale de obAckLoad()");

  // La clave del acuse es local: si alguien la lee o la escribe fuera de sus tres funciones
  // (para subirla, copiarla al banco de pruebas o meterla en el estado) deja de serlo.
  const usos = src.flatMap(([f, text]) => [...text.matchAll(/OB_ACK_KEY/g)].map(() => f));
  const enEstado = src.filter(([, text]) => /\bobAck\s*:/.test(text)).map(([f]) => f);
  if (usos.length !== 4 || usos.some((f) => f !== "00-core.js") || enEstado.length) {
    bad("el acuse de bancos vive en su clave local, fuera del estado que sube a la nube", `usos de OB_ACK_KEY: ${usos.join(", ")}; obAck en el estado: ${enEstado.join(", ") || "no"}`);
  } else ok("el acuse de bancos vive en su clave local, fuera del estado que sube a la nube");
}

/* ---- 2. Nada de Math.random() para generar credenciales ---- */
{
  let hits = [];
  for (const f of fs.readdirSync(path.join(root, "src", "modules"))) {
    if (!f.endsWith(".js")) continue;
    // Se vacían los comentarios ANTES de mirar (conservando los saltos de línea para no perder la
    // numeración). Este repo documenta el porqué de cada decisión en prosa larga, así que un
    // comentario que explique justo esta regla se delataría a sí mismo.
    const src = read(path.join("src", "modules", f))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:'"])\/\/.*$/gm, "$1");
    src.split("\n").forEach((line, i) => {
      const code = line.trim();
      if (!/Math\.random\(\)/.test(code)) return;
      if (/token|secret|clave|key|password|nonce/i.test(code)) hits.push(`${f}:${i + 1}  ${code.slice(0, 100)}`);
    });
  }
  if (hits.length) bad("ninguna credencial sale de Math.random()", hits.join("\n      "));
  else ok("ninguna credencial sale de Math.random()");

  const core = read("src/modules/00-core.js");
  if (/function mcRandomToken\(\)[\s\S]{0,400}getRandomValues/.test(core)) ok("mcRandomToken usa getRandomValues");
  else bad("mcRandomToken usa getRandomValues");
}

/* ---- 3. La CSP mantiene las directivas que importan ---- */
{
  const shell = read("src/shell.html");
  const m = shell.match(/http-equiv="Content-Security-Policy"\s+content="([\s\S]*?)"/);
  if (!m) {
    bad("shell.html lleva CSP");
  } else {
    const csp = m[1].replace(/\s+/g, " ");
    const must = ["object-src 'none'", "base-uri 'none'", "form-action 'self'", "default-src 'self'"];
    const missing = must.filter((d) => !csp.includes(d));
    if (missing.length) bad("la CSP conserva las directivas clave", "faltan: " + missing.join(" · "));
    else ok("la CSP conserva las directivas clave");

    const connect = csp.match(/connect-src ([^;]*)/);
    if (!connect) bad("la CSP declara connect-src");
    else if (/\*/.test(connect[1])) bad("connect-src sin comodines", "un comodín deja salir los datos a cualquier sitio");
    else ok("connect-src es una lista cerrada");

    /* Y que la lista cerrada deje pasar lo que la app SÍ tiene que descargar. Una CSP demasiado
       estrecha no da error visible: `fetch` rechaza y el `catch` de turno se lo traga.
       Caso real 2026-07-25: los assets de las releases de GitHub redirigen a
       `release-assets.githubusercontent.com` (antes `objects.githubusercontent.com`) y ese
       dominio no estaba en la lista. La descarga del canal beta moría, caía al manifiesto de
       producción por su fallback, y el móvil contestaba «✓ estás a la última». El canal beta
       llevaba roto en silencio desde que GitHub cambió de dominio. */
    if (connect) {
      const hosts = connect[1];
      const necesarios = [
        ["https://sfyfjagbnhbplrljpbvh.supabase.co", "la nube: estado, gastos y Edge Functions"],
        ["https://api.frankfurter.dev", "tipos de cambio (canónico; .app redirige aquí)"],
        ["https://github.com", "manifiestos y assets de las releases (canal beta, APK)"],
        ["https://release-assets.githubusercontent.com", "a donde REDIRIGE github.com al bajar un asset"],
      ];
      const faltan = necesarios.filter(([h]) => !hosts.includes(h));
      if (faltan.length) {
        bad("connect-src deja pasar lo que la app descarga",
          faltan.map(([h, p]) => `${h} (${p})`).join(" · ") + " — sin esto el fetch muere y el catch se lo traga");
      } else ok("connect-src deja pasar lo que la app descarga");
    }
  }
}

/* ---- 4. Ni rastro de la service_role en lo que se publica ---- */
{
  const targets = ["src/shell.html", "public/index.html"];
  let leak = false;
  for (const f of targets) {
    if (!fs.existsSync(path.join(root, f))) continue;
    const src = read(f);
    // El JWT de Supabase lleva el rol en el payload: se detecta decodificando, no por el nombre.
    for (const tok of src.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
      try {
        const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64").toString("utf8"));
        if (payload.role && payload.role !== "anon") { bad("sin service_role en el cliente", `${f}: rol «${payload.role}» en un JWT`); leak = true; }
      } catch { /* no era un JWT */ }
    }
    if (/SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+["']/.test(src)) { bad("sin service_role en el cliente", `${f}: literal de service role`); leak = true; }
  }
  if (!leak) ok("no se publica ninguna clave de servicio (solo la anon, que es pública por diseño)");
}

/* ---- 5. El ingest compara el token en tiempo constante ---- */
{
  const ingest = read("supabase/functions/ingest/index.ts");
  if (/timingSafeEqual\(token, legacyToken\)/.test(ingest)) ok("el ingest compara el token en tiempo constante");
  else bad("el ingest compara el token en tiempo constante", "`token === legacyToken` filtra por tiempo cuántos bytes has acertado");
  if (/token\.slice\(0,\s*\d+\)/.test(ingest)) bad("el ingest no apunta trozos del token en la telemetría");
  else ok("el ingest no apunta trozos del token en la telemetría");
}

/* ---- 6. La telemetría financiera no guarda movimientos ni payloads del proveedor ---- */
{
  const bankSync = read("supabase/functions/bank-sync/index.ts");
  const inserts = [...bankSync.matchAll(/admin\.from\("app_events"\)\.insert\(\{([\s\S]*?)\}\);/g)]
    .map((m) => m[1]);
  const sinks = [...bankSync.matchAll(/\.from\(["']app_events["']\)/g)].length;
  const camposMovimiento = /\b(?:transactions?|transaction_amount|remittance_information|creditor|debtor|entry_reference|sospechosos|payload\s+CRUDO)\b/i;
  const leaks = inserts.filter((body) => camposMovimiento.test(body));
  if (sinks !== inserts.length) {
    bad("el guardián cubre todos los app_events de bank-sync",
      `${sinks} destino(s), pero solo ${inserts.length} insert(s) con forma auditada`);
  } else ok(`el guardián cubre los ${sinks} app_events de bank-sync`);
  if (leaks.length || /logObAmbiguous|payload\s+CRUDO/i.test(bankSync)) {
    bad("app_events no guarda payloads ni movimientos bancarios",
      "bank-sync solo puede registrar códigos cerrados y recuentos; nunca importes, comercios, fechas, referencias o titulares");
  } else ok("app_events no guarda payloads ni movimientos bancarios");

  const callback = read("supabase/functions/bank-callback/index.ts");
  if (/JSON\.stringify\(session\.access\)|accessTxt|rawQuery|url\.search\s*\|\|/.test(callback))
    bad("bank-callback no serializa access ni la query OAuth", "access puede contener IBAN y la query lleva code/state");
  else ok("bank-callback solo registra la forma agregada de access y la query OAuth");

  const enableBanking = read("supabase/functions/_shared/enablebanking.ts");
  if (/EB \$\{res\.status\}:[^\n]*(?:JSON\.stringify\(data\)|\btext\b)/.test(enableBanking))
    bad("los errores de Enable Banking no incluyen el cuerpo del proveedor");
  else ok("los errores de Enable Banking conservan solo estado y código corto");

  const ingest = read("supabase/functions/ingest/index.ts");
  const beforeLoggers = ingest.slice(0, ingest.indexOf("async function logIngestError"));
  const rawDetail = /logIngestError\([\s\S]{0,260}(?:comercio\s*\+|importe(?:Orig)?\s*\+|\btexto\b|\btitulo\b)/.test(beforeLoggers);
  const skipLengths = /logIngestSkip\(supabase, userId, motivo, fuente, texto\.length, titulo\.length\)/.test(ingest);
  if (rawDetail || !skipLengths)
    bad("ingest registra motivos y longitudes, no el movimiento ni la notificación");
  else ok("ingest registra motivos y longitudes, no el movimiento ni la notificación");
}

console.log(failed ? "\nsecurity: FALLA" : "\nsecurity: OK");
process.exit(failed ? 1 : 0);
