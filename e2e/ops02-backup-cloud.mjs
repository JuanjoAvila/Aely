import { expect } from "@playwright/test";
import { seedLoggedInDashboard, dismissNews } from "./fixtures.mjs";

// Doble compartido y mutable: el fixture habitual devuelve respuestas fijas y no permite
// demostrar qué escribe A ni qué acaba leyendo B. No simula RLS ni transacciones SQL.
export function backupCloud() {
  const db = { app_state: [], expenses: [], state_backups: [] };
  const calls = [];
  let offline = false;
  const clone = x => JSON.parse(JSON.stringify(x));
  return { db, calls, setOffline: value => { offline = value; },
    async query(q) {
      calls.push(clone(q));
      if (offline) return { data:null, error:{ message:"OPS02 sin red sintética" } };
      const rows = db[q.table] || (db[q.table] = []);
      const matches = r => q.filters.every(([op,k,v]) => op === "eq" ? r[k] === v : op === "in" ? v.includes(r[k]) : r[k] < v);
      let data;
      if (q.op === "read") data = rows.filter(matches);
      else if (q.op === "delete") {
        data = rows.filter(matches); db[q.table] = rows.filter(r => !matches(r));
      } else if (q.op === "update") {
        data = rows.filter(matches); data.forEach(r => Object.assign(r, clone(q.payload)));
      } else {
        data = [];
        for (const value of Array.isArray(q.payload) ? q.payload : [q.payload]) {
          const keys = (q.options?.onConflict || "id").split(",");
          const previous = rows.find(r => keys.every(k => r[k] === value[k]));
          if(!previous && value.id && rows.some(r=>r.id===value.id)) return {data:null,error:{code:"23505",message:"OPS02 conflicto de clave primaria"}};
          if (previous && q.options?.ignoreDuplicates) continue;
          if (previous) { Object.assign(previous, clone(value)); data.push(previous); }
          else { const added = clone(value); rows.push(added); data.push(added); }
        }
      }
      q.orders.slice().reverse().forEach(([k,opts]) => data.sort((a,b) =>
        (a[k]<b[k]?-1:a[k]>b[k]?1:0)*(opts?.ascending===false?-1:1)));
      data = data.slice(0,q.limit || data.length);
      return { data:clone(q.single ? data[0] || null : data), error:null };
    }
  };
}

export const backupDay = "2026-09-20";
export const ids = Array.from({length:8}, (_,i) => "550e8400-e29b-41d4-a716-44665544000"+(i+1));
export function expense(i, extra = {}) {
  return { id:ids[i], date:"2026-09-20T12:00:00.000Z", merchant:"OPS02 tienda "+i,
    amount:(i+1)*10, category:"otros", source:"ob", ent:"sabadell", ...extra };
}
export function row(e) {
  return { id:e.id, user_id:"e2e-user", fecha:e.date, importe:e.amount, comercio:e.merchant,
    cat:e.category, source:"ob:sabadell"+(e.possibleDup?"#dup":""), nota:e.note || null,
    nota_edit:!!e.noteEdited, no_card:!!e.noCard, ob_name:e.obName || null,
    importe_orig:e.origAmount ?? null, divisa:e.origCur || null };
}
export function summary(expenses) {
  return { ids:expenses.map(e=>e.id).sort(), fields:expenses.map(e=>({id:e.id, amount:e.amount,
    date:e.date, merchant:e.merchant, source:e.source, ent:e.ent ?? null,
    category:e.category, note:e.note ?? null, noteEdited:!!e.noteEdited, noCard:!!e.noCard,
    origAmount:e.origAmount ?? null, origCur:e.origCur ?? null, obName:e.obName ?? null,
    extId:e.extId ?? null, debtId:e.debtId ?? null, possibleDup:!!e.possibleDup,
    possibleDupOf:e.possibleDupOf ?? null})).sort((a,b)=>a.id.localeCompare(b.id)),
    sum:expenses.reduce((n,e)=>n+e.amount,0), counted:expenses.filter(e=>!e.possibleDup).reduce((n,e)=>n+e.amount,0) };
}
export async function stored(page) {
  return page.evaluate(() => mcLoadRaw(mcStateKey()));
}

export async function client(page, server, overrides = {}) {
  const freshLogin = !!overrides.__ops02FreshLogin;
  delete overrides.__ops02FreshLogin;
  const readsBefore = server.calls.filter(q=>q.table==="expenses" && q.op==="read").length;
  const writesBefore = server.calls.filter(q=>q.table==="app_state" && q.op!=="read").length;
  await seedLoggedInDashboard(page, { __seedOnce:true, _savedAt:1, lastBackup:new Date().toISOString().slice(0,10), ...overrides });
  await page.exposeFunction("__ops02Query", q => server.query(q));
  // Toda petición externa queda bloqueada, incluido cualquier transporte que el doble no
  // contemplase. El cliente ficticio nunca recibe credenciales ni una sesión real.
  await page.route("**/*", route => {
    const u = new URL(route.request().url());
    return ["127.0.0.1","localhost"].includes(u.hostname) ? route.continue() : route.abort();
  });
  await page.addInitScript(freshLogin => {
    const session = { user:{id:"e2e-user",email:"ops02@example.invalid"} };
    const chain = table => {
      const q = {table,op:"read",filters:[],orders:[],limit:null,single:false};
      const c = {
        select:()=>c, order:(k,o)=>{q.orders.push([k,o]);return c;},
        eq:(k,v)=>{q.filters.push(["eq",k,v]);return c;}, lt:(k,v)=>{q.filters.push(["lt",k,v]);return c;},
        in:(k,v)=>{q.filters.push(["in",k,v]);return c;},
        limit:n=>{q.limit=n;return c;},
        update:p=>{q.op="update";q.payload=p;return c;},
        upsert:(p,o)=>{q.op="upsert";q.payload=p;q.options=o;return c;},
        insert:p=>{q.op="insert";q.payload=p;return c;}, delete:()=>{q.op="delete";return c;},
        maybeSingle:()=>{q.single=true;return window.__ops02Query(q);},
        single:()=>{q.single=true;return window.__ops02Query(q);},
        then:(ok,fail)=>window.__ops02Query(q).then(ok,fail),
      }; return c;
    };
    let activeSession = freshLogin ? null : session;
    const sb = {auth:{getSession:async()=>({data:{session:activeSession}}),
      onAuthStateChange:cb=>{setTimeout(()=>{activeSession=session;cb(freshLogin?"SIGNED_IN":"INITIAL_SESSION",session);},freshLogin?50:0);return {data:{subscription:{unsubscribe(){}}}};},
      signOut:async()=>{}}, from:chain, functions:{invoke:async()=>({data:{},error:null})}};
    Object.defineProperty(window,"supabase",{configurable:true,get:()=>({createClient:()=>sb}),set:()=>{}});
  }, freshLogin);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible();
  await dismissNews(page);
  await page.waitForFunction(() => !document.getElementById("mc-load"));
  await expect.poll(()=>server.calls.filter(q=>q.table==="expenses" && q.op==="read").length).toBeGreaterThan(readsBefore);
  await expect.poll(()=>page.evaluate(()=>!!mcLoadRaw(mcStateKey())?.lastSync)).toBe(true);
  await expect.poll(()=>server.calls.filter(q=>q.table==="app_state" && q.op!=="read").length).toBeGreaterThan(writesBefore);
}
export async function openBackups(page) {
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await page.getByRole("button",{name:"🗄️ "+await page.evaluate(()=>t("backup"))+" ›",exact:true}).click();
  await page.getByRole("button",{name:await page.evaluate(()=>t("bk_auto_title"))}).click();
  await expect(page.getByRole("button",{name:await page.evaluate(()=>t("bk_view")),exact:true})).toBeVisible();
}
export async function viewCopy(page) {
  await page.getByRole("button",{name:await page.evaluate(()=>t("bk_view")),exact:true}).click();
  await expect(page.locator(".bk-preview")).toBeVisible();
}
export async function pull(page, server) {
  const before = server.calls.filter(q=>q.table==="expenses" && q.op==="read").length;
  await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(()=>server.calls.filter(q=>q.table==="expenses" && q.op==="read").length).toBeGreaterThan(before);
  await page.waitForTimeout(600);
}
