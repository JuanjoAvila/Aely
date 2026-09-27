import { test, expect } from "@playwright/test";
import { backupCloud, backupDay, ids, expense, row, summary, stored, client, openBackups, restore, pull } from "./ops02-backup-cloud.mjs";

// Caracterización de OPS-02: estos resultados describen el contrato actual, incluidos sus
// límites. Cambiar la semántica exige revisar el brief, no convertir este ensayo en un borrado.
test("restaurar reemplaza ambas mitades; push, pull, reinicio y B no vuelven a la misma foto", async ({ page, browser }, testInfo) => {
  const server = backupCloud();
  const remote = [expense(0,{note:"nota posterior",category:"super"}), expense(1),
    expense(2,{possibleDup:true}), expense(4), expense(5)];
  server.db.expenses = remote.map(row);
  await client(page,server);
  const before = await stored(page);
  const backup = {...before, budget:333, accounts:[{...before.accounts[0],value:777}],
    deleted:["2026-09-20|50|OPS02 tienda 4"], bankTx:[{marker:"OPS02 copia"}],
    expenses:[expense(0,{note:"nota antigua"}), expense(1,{possibleDup:true,possibleDupOf:ids[0]}),
      expense(2), expense(3,{note:"nota humana",noteEdited:true,noCard:true,
        origAmount:40,origCur:"USD",obName:"OPS02 origen",extId:"OPS02-ext-4"})]};
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:backup}];
  await openBackups(page);
  const mark = server.calls.length;
  await restore(page);
  await expect.poll(async()=>summary((await stored(page)).expenses)).toEqual(summary(backup.expenses));
  const restored = await stored(page);
  expect(restored.deleted).toEqual(backup.deleted);
  expect(restored.accounts).toEqual(backup.accounts);
  expect(restored.bankTx).toEqual(backup.bankTx);
  const halves = await page.evaluate(()=>({base:JSON.parse(localStorage.getItem("micartera_v3")),
    expenses:JSON.parse(localStorage.getItem("micartera_v3_exp"))}));
  expect(halves.base.expenses).toBeUndefined();
  expect(summary(halves.expenses)).toEqual(summary(backup.expenses));
  expect(server.db.expenses).toEqual(remote.map(row));
  await expect.poll(()=>server.db.app_state[0]?.data.budget).toBe(333);
  expect(server.db.app_state[0].data.expenses).toBeUndefined();
  expect(server.db.app_state[0].data.bankTx).toBeUndefined();
  expect(server.db.app_state[0].data.deleted).toEqual(backup.deleted);
  expect(server.calls.slice(mark).filter(q=>q.table==="expenses" && q.op!=="read")).toEqual([]);
  await pull(page,server);
  const afterPull = await stored(page);
  expect(summary(afterPull.expenses).ids).toEqual([ids[0],ids[1],ids[2],ids[3],ids[5]].sort());
  expect(afterPull.expenses.find(e=>e.id===ids[0])).toMatchObject({note:"nota posterior",category:"super"});
  expect(afterPull.expenses.find(e=>e.id===ids[1]).possibleDup).toBeFalsy();
  expect(afterPull.expenses.find(e=>e.id===ids[1]).possibleDupOf).toBe(ids[0]);
  expect(afterPull.expenses.find(e=>e.id===ids[2]).possibleDup).toBe(true);
  await expect.poll(()=>server.db.expenses.map(r=>r.id)).toContain(ids[3]);
  // La lápida oculta una fila; no la elimina de la tabla. El backfill sí ha resucitado la ausente.
  expect(server.db.expenses.map(r=>r.id)).toContain(ids[4]);
  expect(server.calls.some(q=>q.table==="expenses" && q.op==="delete")).toBe(false);
  const snap = summary(afterPull.expenses);
  await page.reload();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  await expect.poll(async()=>summary((await stored(page)).expenses)).toEqual(snap);
  const contextB = await browser.newContext();
  const b = await contextB.newPage();
  await client(b,server,{__ops02FreshLogin:true});
  const second = await stored(b);
  expect(summary(second.expenses).ids).toEqual(snap.ids);
  expect(second.budget).toBe(333);
  expect(second.deleted).toEqual(backup.deleted);
  expect(second.expenses.find(e=>e.id===ids[1]).possibleDupOf).toBeUndefined();
  expect(second.expenses.find(e=>e.id===ids[3])).toMatchObject({note:"nota humana",noteEdited:true,
    noCard:true,origAmount:40,origCur:"USD",obName:"OPS02 origen"});
  expect(second.expenses.find(e=>e.id===ids[3]).extId).toBeUndefined();
  expect(summary(second.expenses).counted).toBe(snap.counted);
  expect(summary(second.expenses).fields).not.toEqual(snap.fields);
  await testInfo.attach("OPS02 etapas sintéticas",{body:JSON.stringify({backup:summary(backup.expenses),
    restored:summary(restored.expenses),pull:snap,second:summary(second.expenses)},null,2),contentType:"application/json"});
  await contextB.close();
});

test("cancelación conserva estado y no consulta la copia", async ({page}) => {
  const server = backupCloud(); await client(page,server);
  const before = await stored(page);
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:{...before,budget:333}}];
  await openBackups(page);
  const mark = server.calls.length;
  await restore(page,false);
  expect(await stored(page)).toEqual(before);
  expect(server.calls.slice(mark).filter(q=>q.table==="state_backups")).toEqual([]);
});

test("copia sin accounts se rechaza sin sustituir el estado", async ({page}) => {
  const server = backupCloud(); await client(page,server);
  const before = await stored(page);
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:{expenses:"corrupta"}}];
  await openBackups(page); await restore(page);
  await expect(page.getByText(/no parece un backup válido/)).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test("copia con accounts pero expenses corruptos atraviesa el guardia actual", async ({page}) => {
  const server = backupCloud(); await client(page,server);
  const before = await stored(page);
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:{...before,expenses:"OPS02 corrupta"}}];
  await openBackups(page); await restore(page);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("micartera_v3_exp")))).toBe("OPS02 corrupta");
  await expect(page.getByRole("button",{name:/Recargar/})).toBeVisible();
});

test("sin red al obtener copia no hay restauración; offline posterior conserva foto hasta reconectar", async ({page}) => {
  const server = backupCloud(); server.db.expenses = [row(expense(5))];
  await client(page,server);
  const before = await stored(page);
  const backup = {...before,budget:333,expenses:[expense(0)]};
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:backup}];
  await openBackups(page); server.setOffline(true); await restore(page);
  await expect(page.getByText(/OPS02 sin red sintética/)).toBeVisible();
  expect(await stored(page)).toEqual(before);
  server.setOffline(false); await restore(page);
  await expect.poll(async()=>summary((await stored(page)).expenses)).toEqual(summary(backup.expenses));
  server.setOffline(true); await pull(page,server);
  expect(summary((await stored(page)).expenses)).toEqual(summary(backup.expenses));
  await page.reload();
  await page.waitForFunction(()=>!document.getElementById("mc-load"));
  expect(summary((await stored(page)).expenses)).toEqual(summary(backup.expenses));
  server.setOffline(false); await pull(page,server);
  await expect.poll(async()=>summary((await stored(page)).expenses).ids).toEqual([ids[0],ids[5]].sort());
});

test("mismo total no demuestra mismos UUID ni campos", () => {
  const a = summary([expense(0)]), b = summary([expense(7,{amount:10,note:"otra fila"})]);
  expect(a.sum).toBe(b.sum); expect(a.ids).not.toEqual(b.ids); expect(a.fields).not.toEqual(b.fields);
});

test("una decisión posterior de mismo pago borrada por UUID se revierte por backfill de la copia", async ({page}) => {
  await page.clock.install({time:new Date("2026-09-27T12:00:00Z")});
  const server = backupCloud();
  const twin = expense(0), pending = expense(1,{possibleDup:true,possibleDupOf:ids[0]});
  server.db.expenses = [row(twin),row(pending)];
  await client(page,server,{expenses:[twin,pending],lastBackup:"2026-09-27",
    settings:{autoPrices:false,theme:"green",expenseBanks:["sabadell"]}});
  const before = await stored(page);
  const backup = {...before,expenses:[twin,pending]};
  await page.locator('.botnav-tab[data-tour="gastos"]').click();
  await page.locator("button.v4-mov").filter({hasText:pending.merchant}).click();
  await page.getByRole("button",{name:"Es el mismo",exact:true}).click();
  await expect.poll(async()=>(await stored(page)).expenses.map(e=>e.id)).toEqual([ids[0]]);
  expect((await stored(page)).deleted).toContain("2026-09-20|20|OPS02 tienda 1");
  await expect.poll(()=>server.db.expenses.map(r=>r.id)).toEqual([ids[0]]);
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:backup}];
  await openBackups(page); await restore(page);
  await expect.poll(async()=>summary((await stored(page)).expenses)).toEqual(summary(backup.expenses));
  await pull(page,server);
  await expect.poll(()=>server.db.expenses.map(r=>r.id)).toContain(ids[1]);
  expect(server.db.expenses.find(r=>r.id===ids[1]).source).toBe("ob:sabadell#dup");
});

test("importe posterior cambia la clave OB aunque conserve UUID; una nota humana sigue local", async ({page},testInfo) => {
  const server = backupCloud();
  const newer = expense(0,{amount:11,note:"nota posterior"});
  server.db.expenses = [row(newer)];
  await client(page,server);
  const before = await stored(page);
  const backup = {...before,expenses:[expense(0,{note:"nota humana",noteEdited:true})]};
  server.db.state_backups = [{user_id:"e2e-user",day:backupDay,data:backup}];
  await openBackups(page); await restore(page);
  await expect.poll(async()=>summary((await stored(page)).expenses)).toEqual(summary(backup.expenses));
  await pull(page,server);
  const after = (await stored(page)).expenses;
  expect(after.map(e=>e.id)).toEqual([ids[0],ids[0]]);
  expect(after.map(e=>e.amount)).toEqual([10,11]);
  expect(after[0]).toMatchObject({note:"nota humana",noteEdited:true});
  expect(server.db.expenses).toEqual([row(newer)]);
  await testInfo.attach("OPS02 UUID repetido tras cambio de importe",{body:JSON.stringify(summary(after),null,2),contentType:"application/json"});
});

test("backupState guarda copia completa, reemplaza el mismo día y poda solo copias antiguas", async ({page}) => {
  const server = backupCloud(); await client(page,server);
  const state = {...await stored(page),expenses:[expense(0,{possibleDup:true,possibleDupOf:ids[1]})],
    deleted:["OPS02 lápida"],bankTx:[{marker:"OPS02 banco"}]};
  server.db.state_backups = [{user_id:"e2e-user",day:"2000-01-01",data:{marker:"OPS02 antigua"}}];
  await page.evaluate(state=>cloud.backupState("e2e-user",state),state);
  expect(server.db.state_backups).toHaveLength(1);
  expect(server.db.state_backups[0].data).toEqual(state);
  const edited = {...state,budget:334};
  await page.evaluate(state=>cloud.backupState("e2e-user",state),edited);
  expect(server.db.state_backups).toHaveLength(1);
  expect(server.db.state_backups[0].data).toEqual(edited);
  expect(server.db.expenses).toEqual([]);
});

test("sin red al listar copias no hay botón de restauración ni sustitución", async ({page}) => {
  const server = backupCloud(); await client(page,server);
  const before = await stored(page);
  server.setOffline(true);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("mc-open-settings")));
  await page.getByRole("button",{name:/Copia de seguridad/}).click();
  await page.getByRole("button",{name:/Copias automáticas/}).click();
  await expect(page.getByText(/OPS02 sin red sintética/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Restaurar",exact:true})).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
});
