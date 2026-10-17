import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ackLinkKey, ackToken } from "../bank-sync/demand-window.ts";
import { encryptSessionId, decryptSessionId } from "../_shared/token_store.ts";

// Los handlers y supabase-js son reales. fetch reproduce REST y PSD2 y rechaza cualquier
// salida distinta: ningún consentimiento, cuenta ni proyecto real se consulta.
type Row = Record<string, unknown>;
type Control = { release: () => void; started: Promise<void>; mode: string; onRead?: () => Promise<void>; beforePatch?: (patch: Row) => Promise<void>; fresh?: string };
type Handler = (request: Request) => Response | Promise<Response>;
const handlers: Record<string, Handler> = {};
const originalGet = Deno.env.get;
const originalServe = Deno.serve;
const config: Record<string, string> = {
  SUPABASE_URL: "https://db.invalid", SUPABASE_ANON_KEY: "synthetic-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", APP_URL: "https://app.invalid/",
  EB_APP_ID: "synthetic-app",
};
const toB64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
config.TOKEN_ENCRYPTION_KEY = toB64(crypto.getRandomValues(new Uint8Array(32)));
const signing = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
config.EB_PRIVATE_KEY = toB64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", signing.privateKey)));
let importing = "";
try {
  Deno.env.get = (name) => config[name];
  Deno.serve = ((handler: Handler) => { handlers[importing] = handler; return {}; }) as unknown as typeof Deno.serve;
  importing = "disconnect"; await import("./index.ts");
  importing = "sync"; await import("../bank-sync/index.ts");
  importing = "callback"; await import("../bank-callback/index.ts");
  importing = "connect"; await import("../bank-connect/index.ts");
} finally { Deno.env.get = originalGet; Deno.serve = originalServe; }

const plain = "synthetic-consent /?%#";
const account = { uid: "old-account", iban: "ES0000000000000000000000", currency: "EUR", hash: "synthetic-stable" };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
function filtered(rows: Row[], url: URL): Row[] {
  return rows.filter((row) => Array.from(url.searchParams).every(([column, expr]) => {
    if (column === "select") return true;
    if (expr === "is.null") return row[column] == null;
    if (expr.startsWith("eq.")) return row[column] != null && String(row[column]) === expr.slice(3);
    if (/^in\.\([^()]*\)$/.test(expr)) return expr.slice(4, -1).split(",").includes(String(row[column]));
    if (expr.startsWith("lt.")) return row[column] != null && Date.parse(String(row[column])) < Date.parse(expr.slice(3));
    throw new Error("Filtro no modelado: no darlo por válido");
  }));
}
async function fixture(run: (rows: Row[], events: Row[], calls: { path: string; method: string }[], control: Control) => Promise<void>) {
  const savedFetch = globalThis.fetch, savedInterval = globalThis.setInterval;
  const timers: ReturnType<typeof setInterval>[] = [];
  Deno.env.get = (name) => config[name];
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => { const id = savedInterval(...args); timers.push(id); return id; }) as typeof setInterval;
  const now = Date.now();
  const rows: Row[] = [{ id: "L1", user_id: "synthetic", aspsp_name: "CaixaBank", status: "active", session_id: await encryptSessionId(plain), state_issued_at: new Date(now - 2000).toISOString(), last_sync: new Date(now - 86400000).toISOString(), accounts: [account] }];
  const events: Row[] = [], calls: { path: string; method: string }[] = [];
  let release!: () => void, enter!: () => void;
  const gate = new Promise<void>((r) => release = r), started = new Promise<void>((r) => enter = r);
  const control: Control = { release, started, mode: "normal" };
  let transactionCalls = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url), method = request.method;
    if (url.origin === "https://db.invalid") {
      if (url.pathname === "/auth/v1/user") return response({ id: "synthetic", aud: "authenticated", role: "authenticated" });
      if (url.pathname === "/rest/v1/app_events" && method === "POST") { events.push(await request.json()); return response([]); }
      if (url.pathname !== "/rest/v1/bank_links") throw new Error("Tabla inesperada");
      if(method==="POST"){ const value=await request.json();const current=rows.find(row=>row.user_id===value.user_id&&row.aspsp_name===value.aspsp_name);if(current)Object.assign(current,value);else rows.push({id:"new-link",...value});return response([]); }
      const matches = filtered(rows, url);
      // Una lectura JSON está separada de la fila viva, como en PostgREST.
      if (method === "GET") { const detached = JSON.parse(JSON.stringify(matches)); if (control.onRead) { const action=control.onRead; control.onRead=undefined; await action(); } return response(detached); }
      if (method === "PATCH") { const patch = await request.json(); if(control.beforePatch)await control.beforePatch(patch); const hit = filtered(rows,url); hit.forEach((row) => Object.assign(row, patch)); return response(request.headers.get("prefer")?.includes("return=representation") ? hit.map(row => ({ id: row.id })) : []); }
      if (method === "DELETE") { const data=matches.map(row=>({id:row.id}));matches.forEach((row) => rows.splice(rows.indexOf(row), 1)); return response(data); }
      throw new Error("Mutación no modelada");
    }
    if (url.origin !== "https://api.enablebanking.com") throw new Error("Salida externa prohibida");
    calls.push({ path: url.pathname + url.search, method });
    if (method === "DELETE") { if(control.mode==="revoke-hang")await gate; if(control.mode==="disconnect-race")await reconnect(rows,control); return control.mode === "revoke-fail" ? response({ error: "ASPSP_ERROR", message: plain, token: "synthetic-private" }, 503) : response({}); }
    if(url.pathname==="/auth"&&method==="POST")return response({url:"https://bank.invalid/login"});
    if (url.pathname === "/sessions" && method === "POST") return response({ session_id: "synthetic-new-session", accounts: [{ uid: "new-account", account_id: { iban: account.iban }, currency: "EUR", identification_hash: account.hash }] });
    if (url.pathname.endsWith("/balances")) {
      if (control.mode.startsWith("race")) { enter(); await gate; }
      return control.mode === "race-success"||control.mode.startsWith("gap")||control.mode==="ack-race" ? response({ balances: [{ balance_type: "ITAV", balance_amount: { amount: "100", currency: "EUR" } }] }) : response({ error: "EXPIRED_SESSION" }, 401);
    }
    if (url.pathname.endsWith("/transactions")) { transactionCalls++;if(control.mode==="gap-partial"&&transactionCalls>2)return response({error:"ASPSP_ERROR"},503);return response({ transactions: [] }); }
    throw new Error("Petición PSD2 no modelada");
  };
  try { await run(rows, events, calls, control); }
  finally {
    release(); await Promise.resolve();
    timers.forEach((id) => clearInterval(id));
    globalThis.fetch = savedFetch; globalThis.setInterval = savedInterval; Deno.env.get = originalGet;
  }
}
async function reconnect(rows: Row[], control: Control) {
  Object.assign(rows[0], { status:"pending", state:"synthetic-fresh-state", state_issued_at:new Date(Date.now()-1000).toISOString() });
  const result=await handlers.callback(new Request("https://edge.invalid?code=synthetic&state=synthetic-fresh-state"));
  assertEquals(result.status,302);assert(result.headers.get("location")!.includes("bank=ok"));
  assertEquals(await decryptSessionId(rows[0].session_id as string),"synthetic-new-session");
  control.fresh=JSON.stringify(rows);
}

const request = (body: unknown) => new Request("https://edge.invalid", { method: "POST", headers: { Authorization: "Bearer synthetic" }, body: JSON.stringify(body) });
for (const legacy of [false, true]) Deno.test("bank-disconnect real: descifra/legacy y codifica el DELETE (legacy=" + legacy + ")", () => fixture(async (rows, _events, calls) => {
  if (legacy) rows[0].session_id = plain;
  const result = await handlers.disconnect(request({ aspsp_name: "CaixaBank" }));
  assertEquals(result.status, 200); assertEquals(await result.json(), { ok: true }); assertEquals(rows.length, 0);
  assertEquals(calls, [{ path: "/sessions/" + encodeURIComponent(plain), method: "DELETE" }]);
}));
Deno.test("bank-disconnect real: revocación503 saneada y borrado local independiente", () => fixture(async (rows, events, _calls, control) => {
  const stored = rows[0].session_id as string; control.mode = "revoke-fail";
  const result = await handlers.disconnect(request({ aspsp_name: "CaixaBank" }));
  assertEquals(result.status, 200); assertEquals(rows.length, 0); assertEquals(events.length, 1);
  const logged = JSON.stringify([await result.json(), events]);
  assert(!logged.includes(plain)); assert(!logged.includes(stored)); assert(!logged.includes("synthetic-private")); assert(logged.includes("503"));
}));
for (const success of [false, true]) Deno.test("callback real gana a la escritura final vieja (success=" + success + ")", () => fixture(async (rows, _events, _calls, control) => {
  const cursor = rows[0].last_sync; control.mode = success ? "race-success" : "race-ended";
  const pending = Promise.resolve(handlers.sync(request(success ? {} : { acks: {} })));
  await Promise.race([control.started, pending.then((result) => { throw new Error("El sync terminó antes de llegar al banco: HTTP " + result.status); })]);
  try {
    Object.assign(rows[0], { status: "pending", state: "synthetic-fresh-state", state_issued_at: new Date(Date.now() - 1000).toISOString() });
    const callback = await handlers.callback(new Request("https://edge.invalid?code=synthetic&state=synthetic-fresh-state"));
    assertEquals(callback.status, 302); assert(callback.headers.get("location")!.includes("bank=ok"));
    assertEquals(await decryptSessionId(rows[0].session_id as string), "synthetic-new-session");
    assertEquals(rows[0].status, "active"); assertEquals(rows[0].last_sync, cursor);
    const fresh = JSON.stringify(rows[0]); control.release(); assertEquals((await pending).status, 200);
    assertEquals(JSON.stringify(rows[0]), fresh);
  } finally { control.release(); await pending; }
}));
Deno.test("bank-sync real: NULL legacy sin carrera sigue pudiendo escribir", () => fixture(async (rows) => {
  rows[0].session_id = null; rows[0].state_issued_at = null;
  const result = await handlers.sync(request({ acks: {} }));
  assertEquals(result.status, 200); assertEquals(rows[0].status, "expired");
}));

Deno.test("selección real de usuario: una fila ajena delante jamás se revoca",()=>fixture(async(rows,events,calls)=>{
  const mine=rows[0],foreign={...mine,id:"foreign",user_id:"other",session_id:await encryptSessionId("synthetic-foreign")};
  rows.unshift(foreign);
  assertEquals((await handlers.disconnect(request({aspsp_name:"CaixaBank"}))).status,200);
  assertEquals(rows.length,1);assertEquals(rows[0].id,"foreign");assertEquals(events.length,0);
  assertEquals(calls,[{path:"/sessions/"+encodeURIComponent(plain),method:"DELETE"}]);
}));
Deno.test("registro real de fallo: dueño, tipo, mensaje y claves cerradas",()=>fixture(async(rows,events,_calls,control)=>{
  control.mode="revoke-fail";const result=await handlers.disconnect(request({aspsp_name:"CaixaBank"}));assertEquals(result.status,200);
  assertEquals(events[0].user_id,"synthetic");assertEquals(events[0].kind,"error");assertEquals(events[0].message,"OB desconexión: revocación no completada");assertEquals(events[0].email,null);
  assertEquals(Object.keys(JSON.parse(events[0].detail as string)).sort(),["code","status","step"]);
}));
Deno.test("snapshot activo sin cuentas no caduca el callback que acaba de completar",()=>fixture(async(rows,_events,_calls,control)=>{
  rows[0].accounts=[];control.onRead=()=>reconnect(rows,control);
  assertEquals((await handlers.sync(request({acks:{}}))).status,200);
  assertEquals(JSON.stringify(rows),control.fresh);
}));
for(const mode of ["gap-complete","gap-partial","ack-race"])Deno.test("cliente legacy: callback gana al cursor de "+mode,()=>fixture(async(rows,_events,_calls,control)=>{
  rows[0].last_sync=new Date(Date.now()-45*86400000).toISOString();control.mode=mode;
  const token=ackToken(new Date(Date.now()-86400000).toISOString(),ackLinkKey(rows[0].id as string,rows[0].state_issued_at as string));
  control.beforePatch=async patch=>{if(patch.last_sync&&!patch.session_id){control.beforePatch=undefined;await reconnect(rows,control);}};
  const body=mode==="ack-race"?{recoverGaps:true,acks:{CaixaBank:token}}:{recoverGaps:true};
  assertEquals((await handlers.sync(request(body))).status,200);
  assert(control.fresh,"el caso debe llegar a su escritura");assertEquals(JSON.stringify(rows),control.fresh);
}));
Deno.test("ancla119 null no toca el connect real mientras acaba el sync viejo",()=>fixture(async(rows,_events,_calls,control)=>{
  rows[0].last_sync=null;control.mode="race-success";const pending=Promise.resolve(handlers.sync(request({recoverGaps:true,acks:{}})));
  await Promise.race([control.started,pending.then(()=>{throw Error("No llegó al banco");})]);
  try{assertEquals((await handlers.connect(request({aspsp_name:"CaixaBank"}))).status,200);assertEquals(rows[0].status,"pending");control.fresh=JSON.stringify(rows);control.release();assertEquals((await pending).status,200);assertEquals(JSON.stringify(rows),control.fresh);}finally{control.release();await pending;}
}));
Deno.test("desconexión vieja no borra la sesión nueva de un callback real",()=>fixture(async(rows,_events,calls,control)=>{
  control.mode="disconnect-race";const result=await handlers.disconnect(request({aspsp_name:"CaixaBank"}));
  assertEquals(result.status,409);assertEquals(JSON.stringify(rows),control.fresh);
  assertEquals(calls.filter(c=>c.method==="DELETE"),[{path:"/sessions/"+encodeURIComponent(plain),method:"DELETE"}]);
}));
Deno.test("sin snapshot no borra una conexión insertada después de leer",()=>fixture(async(rows,_events,calls,control)=>{
  const fresh={...rows[0]};rows.splice(0);control.onRead=async()=>{rows.push(fresh);control.fresh=JSON.stringify(rows);};
  assertEquals((await handlers.disconnect(request({aspsp_name:"CaixaBank"}))).status,200);
  assertEquals(JSON.stringify(rows),control.fresh);assertEquals(calls.length,0);
}));
Deno.test("proveedor colgado: tope real8s y borrado local sin esperar su respuesta",()=>fixture(async(rows,events,_calls,control)=>{
  control.mode="revoke-hang";const at=performance.now(),pending=Promise.resolve(handlers.disconnect(request({aspsp_name:"CaixaBank"})));
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
    const result=await Promise.race([pending,new Promise<Response>((_resolve,reject)=>{timeout=setTimeout(()=>reject(Error("La revocación no estuvo acotada")),9100);})]);
    assertEquals(result.status,200);assertEquals(rows.length,0);assertEquals(events.length,1);
    const elapsed=performance.now()-at;assert(elapsed>=7500&&elapsed<9100,"el tope probado es el real8s");
  }finally{clearTimeout(timeout);control.release();await pending;}
}));
