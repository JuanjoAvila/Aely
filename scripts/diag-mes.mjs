#!/usr/bin/env node
/**
 * ¿POR QUÉ EL GASTO DEL MES NO CUADRA CON LO QUE ÉL SUMA A MANO?
 *
 * 11/9/2026. Él cogió la calculadora, sumó los gastos que SÍ deberían contar y le salieron
 * **175,37 €**. La app dice **781,45 €**. Sus palabras: «aquí hay algo que se me escapa».
 *
 * Este script no calcula nada por su cuenta: coge sus filas REALES de la nube, las pasa por la
 * MISMA lógica que pinta la app (`load-pure-logic`, no una copia), y luego desmenuza el resultado
 * para que se vea DE DÓNDE sale cada euro. Tres cortes, por orden de sospecha:
 *
 *   1. Qué entra y qué no, con el motivo (no es del día a día / no es un gasto / posible repetido).
 *   2. Los que SÍ cuentan, ordenados de mayor a menor: así se ve si el total lo hacen cuatro
 *      cargos gordos o mil pequeños.
 *   3. Parejas sospechosas: mismo importe y fechas cercanas. Es el patrón de los duplicados que
 *      arrastra desde julio — el mismo movimiento entrando por dos puertas (la integración propia
 *      de Trade Republic y Open Banking), uno con nombre y otro como «Movimiento».
 *
 * ⚠ LA SALIDA LLEVA DATOS SUYOS: comercios, importes y nombres de personas en los bizums. Es para
 * mirarla y ya. No pegarla en el repo, ni en un commit, ni en un issue. El repo es PÚBLICO.
 *
 * Uso:  node scripts/diag-mes.mjs [AAAA-MM]     (por defecto, el mes en curso)
 *       Necesita SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "./load-pure-logic.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJECT_REF = "sfyfjagbnhbplrljpbvh";
const BASE = `https://${PROJECT_REF}.supabase.co`;

function loadEnvLocal() {
  const f = path.join(root, ".env.local");
  if (!fs.existsSync(f)) return {};
  const out = {};
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const KEY = { ...loadEnvLocal(), ...process.env }.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }

const api = async (p) => {
  const r = await fetch(`${BASE}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) { console.error(`HTTP ${r.status} en ${p}: ${await r.text()}`); process.exit(1); }
  return r.json();
};

const cli = loadPureLogicFromFile();
const eur = (n) => (Math.round(n * 100) / 100).toFixed(2).padStart(9) + " €";
const dia = (f) => String(f).slice(0, 10);

const arg = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a));
const hoy = new Date();
const anio = arg ? +arg.slice(0, 4) : hoy.getFullYear();
const mes = arg ? +arg.slice(5, 7) : hoy.getMonth() + 1;
const desde = new Date(Date.UTC(anio, mes - 1, 1)).toISOString();
const hasta = new Date(Date.UTC(anio, mes, 1)).toISOString();

const estados = await api("app_state?select=user_id,data");
if (!estados.length) { console.error("No hay app_state"); process.exit(1); }

for (const { user_id, data } of estados) {
  const filas = await api(
    `expenses?select=id,fecha,importe,cat,source,comercio,ob_name,no_card&user_id=eq.${user_id}` +
    `&fecha=gte.${desde}&fecha=lt.${hasta}&order=fecha.desc`,
  );
  if (!filas.length) continue;

  /* Al formato del cliente, que es el que entienden sus funciones. `ent` no viaja en columna
     propia: la app lo saca del estado, así que aquí se mira lo que hay y se avisa si falta. */
  const gastos = filas.map((f) => ({
    id: f.id, date: f.fecha, amount: Number(f.importe) || 0, category: f.cat,
    source: f.source, merchant: f.comercio || "", obName: f.ob_name || "", noCard: !!f.no_card,
  }));
  const estado = Object.assign({}, data, { expenses: gastos });
  const st = cli.monthBudgetStats(estado);

  console.log(`\n═══════ usuario ${String(user_id).slice(0, 8)}… · ${anio}-${String(mes).padStart(2, "0")} · ${filas.length} filas ═══════`);
  console.log(`  LO QUE DICE LA APP: gastado ${eur(st.shown != null ? st.shown : st.spent)} · ingresos ${eur(st.income || 0)} · presupuesto ${eur(st.budget || 0)}`);

  /* ---- 1. Qué entra y qué no ---- */
  const cuenta = [], fuera = [];
  for (const g of gastos) {
    const razon = typeof cli.motivoNoCuenta === "function" ? cli.motivoNoCuenta(g, estado) : null;
    if (g.amount < 0 || (g.category === "ingreso")) { fuera.push([g, "ingreso"]); continue; }
    if (razon) { fuera.push([g, razon]); continue; }
    cuenta.push(g);
  }
  const suma = (a) => a.reduce((x, g) => x + Math.abs(g.amount), 0);

  console.log(`\n  ── LO QUE CUENTA ──  ${cuenta.length} movimientos · ${eur(suma(cuenta))}`);
  cuenta.slice().sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).forEach((g) => {
    console.log(`    ${eur(Math.abs(g.amount))}  ${dia(g.date)}  ${(g.merchant || g.obName || "—").slice(0, 42)}`);
  });

  const porMotivo = {};
  fuera.forEach(([g, r]) => { (porMotivo[r] = porMotivo[r] || []).push(g); });
  console.log(`\n  ── LO QUE NO CUENTA ──  ${fuera.length} movimientos`);
  Object.keys(porMotivo).forEach((r) => {
    console.log(`    · ${r}: ${porMotivo[r].length} · ${eur(suma(porMotivo[r]))}`);
  });

  /* ---- 2. Parejas sospechosas: mismo importe, fechas cercanas ---- */
  const porImporte = {};
  gastos.forEach((g) => {
    const k = Math.abs(g.amount).toFixed(2);
    (porImporte[k] = porImporte[k] || []).push(g);
  });
  const sospechosas = Object.entries(porImporte)
    .filter(([, v]) => v.length > 1)
    .map(([k, v]) => [k, v.slice().sort((a, b) => new Date(a.date) - new Date(b.date))])
    .filter(([, v]) => {
      for (let i = 1; i < v.length; i++) {
        const d = Math.abs(new Date(v[i].date) - new Date(v[i - 1].date)) / 86400000;
        if (d <= 3) return true;
      }
      return false;
    })
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  console.log(`\n  ── MISMO IMPORTE Y MENOS DE 3 DÍAS DE DIFERENCIA ──  ${sospechosas.length} importes`);
  let ruido = 0;
  sospechosas.forEach(([k, v]) => {
    console.log(`    ${String(k).padStart(9)} €  ×${v.length}`);
    v.forEach((g) => {
      console.log(`        ${dia(g.date)}  [${(g.source || "?").padEnd(10)}]  ${(g.merchant || g.obName || "—").slice(0, 44)}`);
    });
    // Lo que sobraría si de cada grupo solo fuera real el primero.
    ruido += Number(k) * (v.length - 1);
  });
  console.log(`\n  Si de cada grupo de arriba solo fuera real UNO: sobrarían ${eur(ruido)}`);
  console.log(`  (esto NO es un veredicto: es dónde mirar. Dos cafés iguales el mismo día existen.)`);
}
