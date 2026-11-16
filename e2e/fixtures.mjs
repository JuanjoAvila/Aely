import { expect } from "@playwright/test";

/** Viewports móvil pedidos en la tanda de cobertura Hogar/Fijos. */
export const VIEWPORT_PIXEL = { width: 393, height: 851 };
export const VIEWPORT_COMPACT = { width: 360, height: 740 };

/** Estado mínimo onboarded + sesión Supabase simulada (sin red).
 *  `overrides` se mezcla sobre el estado base (p.ej. {investments:[...]}) para que cada test
 *  no tenga que repetir el objeto entero.
 *  `household` opcional: { household, members, snapshots } para el mock de Hogar en Supabase. */
export async function seedLoggedInDashboard(page, overrides = {}, household = null) {
  await page.addInitScript(
    ({ overrides, household }) => {
      const session = { user: { id: "e2e-user", email: "e2e@test.local" } };

      const db = {
        households: (household && household.household ? [household.household] : []).slice(),
        household_members: (household && household.members ? household.members.slice() : []),
        household_snapshots: (household && household.snapshots ? household.snapshots.slice() : []),
      };

      const mockClient = () => {
        const makeChain = (table, op) => {
          const ctx = { table, op, filters: [], limitN: null, insertRows: null, upsertRow: null, deleteMode: false };
          const finish = () => {
            if (ctx.op === "insert") {
              const rows = Array.isArray(ctx.insertRows) ? ctx.insertRows : [ctx.insertRows];
              if (table === "households") db.households.push(...rows);
              if (table === "household_members") db.household_members.push(...rows);
              if (table === "household_snapshots") db.household_snapshots.push(...rows);
              return { data: rows, error: null };
            }
            if (ctx.op === "upsert" && ctx.upsertRow) {
              const row = ctx.upsertRow;
              if (table === "household_snapshots") {
                const i = db.household_snapshots.findIndex(
                  (s) => s.household_id === row.household_id && s.user_id === row.user_id
                );
                if (i >= 0) db.household_snapshots[i] = Object.assign({}, db.household_snapshots[i], row);
                else db.household_snapshots.push(row);
              }
              return { data: [row], error: null };
            }
            if (ctx.deleteMode) {
              if (table === "household_snapshots") {
                db.household_snapshots = db.household_snapshots.filter((s) => {
                  return !ctx.filters.every((f) => String(s[f.col]) === String(f.val));
                });
              }
              if (table === "household_members") {
                db.household_members = db.household_members.filter((m) => {
                  return !ctx.filters.every((f) => String(m[f.col]) === String(f.val));
                });
              }
              return { data: null, error: null };
            }
            let rows = [];
            if (table === "household_members") rows = db.household_members.slice();
            else if (table === "households") rows = db.households.slice();
            else if (table === "household_snapshots") rows = db.household_snapshots.slice();
            else rows = [];

            ctx.filters.forEach((f) => {
              rows = rows.filter((r) => String(r[f.col]) === String(f.val));
            });
            if (ctx.limitN != null) rows = rows.slice(0, ctx.limitN);
            return { data: rows, error: null };
          };

          const chain = {
            select: () => chain,
            order: () => chain,
            limit: (n) => {
              ctx.limitN = n;
              return chain;
            },
            eq: (col, val) => {
              ctx.filters.push({ col, val });
              return chain;
            },
            lt: () => chain,
            update: () => chain,
            insert: (row) => {
              ctx.op = "insert";
              ctx.insertRows = row;
              return chain;
            },
            upsert: (row) => {
              ctx.op = "upsert";
              ctx.upsertRow = row;
              return chain;
            },
            delete: () => {
              ctx.deleteMode = true;
              return chain;
            },
            maybeSingle: async () => {
              const { data, error } = finish();
              return { data: data && data.length ? data[0] : null, error };
            },
            single: async () => {
              const { data, error } = finish();
              return { data: data && data.length ? data[0] : null, error };
            },
          };
          chain.then = (resolve) => resolve(finish());
          return chain;
        };

        return {
          auth: {
            getSession: async () => ({ data: { session } }),
            onAuthStateChange: (cb) => {
              setTimeout(() => cb("INITIAL_SESSION", session), 0);
              return { data: { subscription: { unsubscribe: () => {} } } };
            },
            signOut: async () => {},
          },
          from: (table) => makeChain(table),
          rpc: (name, args) => {
            if (name === "join_household_by_code") {
              const code = String((args && args.p_code) || "")
                .trim()
                .toUpperCase();
              const hh = db.households.find((h) => h.invite_code === code);
              if (!hh) return Promise.resolve({ data: null, error: { message: "invalid code" } });
              if (!db.household_members.some((m) => m.user_id === session.user.id)) {
                db.household_members.push({ household_id: hh.id, user_id: session.user.id, role: "member" });
              }
              return Promise.resolve({ data: hh, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          functions: { invoke: async () => ({ data: {}, error: null }) },
        };
      };

      let _sb = null;
      Object.defineProperty(window, "supabase", {
        configurable: true,
        enumerable: true,
        get() {
          return _sb;
        },
        set(lib) {
          if (lib && typeof lib.createClient === "function") {
            _sb = { createClient: () => mockClient() };
          } else {
            _sb = lib;
          }
        },
      });

      const base = {
        fx: 0.92,
        budget: 500,
        monthStartNet: 1000,
        history: [],
        accounts: [{ id: "e2e", ent: "sabadell", name: "Cuenta", value: 1000 }],
        investments: [],
        assets: [],
        debts: [],
        fixed: [],
        flows: [],
        oneoffs: [],
        aportaciones: [],
        expenses: [],
        goals: [],
        shared: [],
        catOverrides: {},
        obAccounts: [],
        obLabels: {},
        verNotes: [],
        streak: 0,
        tourSeen: true,
        setupHint: false,
        settings: { autoPrices: false, theme: "green" },
        lastSync: null,
        lastPriceSync: null,
        onboarded: true,
        _dataVer: 6,
        trAnchor: new Date().toISOString().slice(0, 7),
      };
      localStorage.setItem("micartera_v3", JSON.stringify(Object.assign(base, overrides)));
      localStorage.setItem("_seenVersion", "dev");
      try {
        ["dash", "metas", "gastos", "fijos", "inv"].forEach((id) =>
          localStorage.setItem("_coach_" + id, "1")
        );
        localStorage.setItem("col_f_serv", "true");
        localStorage.setItem("col_f_prox", "true");
      } catch (e) {}
    },
    { overrides, household }
  );
}

/** Cierra el popup de Novedades si sale (cambia de versión en cada release). Llamar tras el
 *  primer goto("/") en cualquier test que necesite interactuar con la pantalla. */
export async function dismissNews(page) {
  const btn = page.getByRole("button", { name: /Entendido|Got it|D'acord/i });
  if (await btn.count()) await btn.first().click();
}

export async function bootDashboard(page, overrides = {}, household = null) {
  await seedLoggedInDashboard(page, overrides, household);
  await page.goto("/");
  await expect(page.locator(".botnav")).toBeVisible({ timeout: 15_000 });
  await dismissNews(page);
}

export async function goPlan(page) {
  await page.locator('.botnav-tab[data-tour="plan"]').click();
  await expect(page.locator('.botnav-tab[data-tour="plan"]')).toHaveClass(/active/);
  await expect(
    page.getByRole("heading", { name: /Tu plan del mes|Your plan|El teu pla del mes/i })
  ).toBeVisible();
}

export async function openGestionarFijos(page) {
  await page.getByRole("button", { name: /^Gestionar$|^Manage$|^Gestionar$/i }).click();
  await expect(page.locator(".v4-sheet")).toBeVisible();
}

export async function openHogarPanel(page) {
  await page.locator('.botnav-tab[data-tour="cartera"]').click();
  const entry = page.getByRole("button", {
    name: /Hogar y gastos compartidos|Household & shared|Llar i despeses/i,
  });
  await entry.scrollIntoViewIfNeeded();
  await entry.click();
  await expect(
    page.locator("div.serif").filter({ hasText: /Hogar y gastos compartidos|Household & shared|Llar i despeses/i })
  ).toBeVisible({ timeout: 10_000 });
}

/** El guardado en `micartera_v3` va con debounce (~400 ms) en App. */
export async function waitStatePersisted(page) {
  await page.waitForTimeout(500);
}

/** Pantalla Plan visible (ignora pestañas precargadas ocultas). */
export function planScreen(page) {
  return page.locator(".v4-screen").filter({
    has: page.getByRole("heading", { name: /Tu plan del mes|Your plan|El teu pla del mes/i }),
  });
}

export function gestionarSheet(page) {
  return page.locator(".v4-sheet");
}

export function serviciosBlock(page) {
  return gestionarSheet(page).locator(".card").filter({
    hasText: /Servicios y suministros|Bills & utilities|Serveis i subministraments/i,
  });
}

export async function readFixedFromStorage(page) {
  await waitStatePersisted(page);
  return page.evaluate(() => {
    const raw = localStorage.getItem("micartera_v3");
    if (!raw) return [];
    try {
      return JSON.parse(raw).fixed || [];
    } catch (e) {
      return [];
    }
  });
}

export function householdBundleSeed({ name = "Casa e2e", code = "TEST42", snapshots = [] } = {}) {
  const hid = "hh-e2e-1";
  const household = { id: hid, name, invite_code: code, created_by: "e2e-user" };
  const members = [{ household_id: hid, user_id: "e2e-user", role: "owner" }];
  return { household, members, snapshots };
}