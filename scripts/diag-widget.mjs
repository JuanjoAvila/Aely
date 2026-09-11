#!/usr/bin/env node
/**
 * ¿POR QUÉ EL WIDGET DICE UN NÚMERO Y LA APP OTRO?
 *
 * Bug abierto desde el 2026-08-17: widget 907 €, app 709 € (Δ 198). Antes fue 891 vs 686 (Δ 205).
 * Cliente y servidor comparten fórmula —eso está probado en `presupuesto-servidor`—, así que la
 * diferencia solo puede venir de los DATOS DE ENTRADA. Este script lo comprueba con sus datos
 * REALES en vez de suponer: baja su `app_state` y sus `expenses` del mes y pasa LAS MISMAS filas
 * por las dos implementaciones.
 *
 *   · Si las dos dan lo mismo  → el cálculo está bien; lo que difiere es lo que cada lado VE
 *                                (el móvil tiene filas que la nube no, o al revés).
 *   · Si dan distinto          → hay divergencia de fórmula pese al test, y sale aquí.
 *
 * ⚠ LA SALIDA LLEVA DATOS SUYOS (nombres de comercio, importes, y en los bizums nombres de
 * personas). Es para mirarla y ya: no pegarla en el repo, ni en un issue, ni en un commit.
 *
 * Uso:  node scripts/diag-widget.mjs   (necesita SUPABASE_SERVICE_ROLE_KEY en .env.local)
 *
 * HALLAZGO DEL 2026-08-17 (corregido la misma noche: el «dos compras reales» era FALSO).
 *   · Las dos fórmulas dan EXACTAMENTE lo mismo con la misma entrada. No toques el cálculo.
 *   · El widget cuenta filas que la app ya descartó: lápidas en `state.deleted` que siguen
 *     vivas en la tabla (ingest no las miraba) + notis gemelas del MISMO cargo.
 *   · Caso medido: 230 € APOLLON a las 11:31 y 230 € a las 13:08, AMBAS `macrodroid`. El extracto
 *     de Trade Republic tiene UN 230 y UN 115. Wallet avisó a una hora y TR a otra (97 min, fuera
 *     de la ventana de 10). NO son dos compras. Meter la hora en la clave de fusión haría que la
 *     app también mintiera. Ingest ahora junta como la app (`filasComoLaApp`) y no inserta la 2ª.
 *
 * HALLAZGO DEL 2026-09-11 — y una MENTIRA de este mismo script, corregida aquí.
 *   · La línea «SERVIDOR (lo que va al widget)» llevaba meses siendo falsa: pasaba las filas
 *     CRUDAS a `statsDelMes` cuando `ingest` ya usaba `filasComoLaApp` desde 4.18.2. O sea que
 *     simulaba el ingest VIEJO y lo etiquetaba como el de hoy. De ahí salió un diagnóstico
 *     equivocado («faltan 81 € en la nube»). Ahora se pintan las dos, cada una con su nombre.
 *   · Lo que SÍ está roto: **un movimiento de Open Banking que vuelve con el signo cambiado
 *     entra otra vez**. El índice único es `(user_id, fecha, importe, comercio)` y `importe`
 *     lleva el signo; la clave del cliente (`keyOf`) también. Ninguno de los dos lo ve repetido.
 *     Medido en sus datos: 3 pares desde el 1/6, ≈1.097,72 € de ruido, y SOLO en el usuario con
 *     Open Banking (los otros dos: 0 y 0). Sus 248 lápidas de `state.deleted` son él borrando
 *     esta basura a mano desde julio. El bloque 6) de abajo lo caza.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
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
  const r = await fetch(`${BASE}/rest/v1/${p}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) { console.error(`HTTP ${r.status} en ${p}: ${await r.text()}`); process.exit(1); }
  return r.json();
};

// Las dos implementaciones, cargadas de verdad (no copiadas).
const ts = fs.readFileSync(path.join(root, "supabase/functions/_shared/presupuesto.ts"), "utf8");
const js = transformSync(ts, { loader: "ts", format: "esm" }).code;
const srv = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const cli = loadPureLogicFromFile();

const eur = (n) => (Math.round(n * 100) / 100).toFixed(2) + " €";

const estados = await api("app_state?select=user_id,data");
if (!estados.length) { console.error("No hay app_state"); process.exit(1); }

const ahora = new Date();
const desdeMs = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1);
const desde = new Date(desdeMs).toISOString();

for (const { user_id, data } of estados) {
  const filas = await api(
    `expenses?select=fecha,importe,cat,source,comercio,created_at&user_id=eq.${user_id}&fecha=gte.${desde}`,
  );
  console.log(`\n═══ usuario ${String(user_id).slice(0, 8)}… · ${filas.length} filas este mes ═══`);
  console.log(`presupuesto ${data?.budget ?? "—"} · modo ${data?.settings?.gTotalMode || "split"}` +
    ` · bancos de gasto: ${(srv.bancosDeGastoDiario(data) || []).join(", ") || "—"}`);

  /* 1) EL SERVIDOR. ⚠ 2026-09-11: esta línea decía «lo que va al widget» y era MENTIRA desde que
     `ingest` llama a `filasComoLaApp` (4.18.2). Pasaba las filas CRUDAS a `statsDelMes`, así que
     simulaba el ingest VIEJO — y de esa etiqueta falsa salió un diagnóstico equivocado (se creyó
     que faltaban 81 € en la nube cuando el desfase real era otro, y de otro sitio).
     Ahora se pintan LAS DOS: lo que manda hoy el widget, y lo que mandaba antes del arreglo. */
  const visibles = srv.filasComoLaApp(filas, data?.deleted);
  const s = srv.statsDelMes(visibles, data, desdeMs);
  const crudo = srv.statsDelMes(filas, data, desdeMs);
  console.log(`\n  SERVIDOR DE HOY (ingest → widget: filasComoLaApp + statsDelMes)`);
  console.log(`    gastado(shown) ${eur(s.shown)} · bruto ${eur(s.spent)} · ingresos ${eur(s.income)}`);
  console.log(`    presupuesto ${eur(s.budget)} · reservado ${eur(s.reserved)} · te quedan ${eur(Math.max(0, s.budget - s.against))}`);
  console.log(`  ingest VIEJO (filas crudas, sin lápidas ni fusión) — solo para comparar`);
  console.log(`    gastado(shown) ${eur(crudo.shown)}` +
    (Math.abs(crudo.shown - s.shown) < 0.02 ? `  (igual: aquí la basura no cambiaba nada)`
      : `  ⇒ el arreglo de 4.18.2 vale ${eur(Math.abs(crudo.shown - s.shown))} en sus datos de hoy`));

  // 2) EL CLIENTE, con LAS MISMAS filas traducidas a su formato. Si sale otro número con la misma
  //    entrada, la culpa es de la fórmula; si sale el mismo, la culpa es de qué filas ve cada uno.
  const comoCliente = filas.map((f) => ({
    date: f.fecha, amount: Number(f.importe) || 0, category: f.cat, source: f.source,
  }));
  const c = cli.monthBudgetStats(Object.assign({}, data, { expenses: comoCliente }));
  console.log(`\n  CLIENTE, con LAS MISMAS filas`);
  console.log(`    gastado(shown) ${eur(c.shown)} · bruto ${eur(c.spent)} · ingresos ${eur(c.income)}`);

  /* ⚠ Se compara contra `crudo`, NO contra `s`: esta prueba es «misma ENTRADA, ¿mismo número?».
     `s` ya ha pasado por `filasComoLaApp`, así que compararlo aquí acusaría de divergencia de
     fórmula a lo que en realidad es una diferencia de FILAS. */
  const iguales = Math.abs(c.shown - crudo.shown) < 0.02;
  console.log(`\n  ⇒ ${iguales
    ? "MISMA CIFRA con la misma entrada → la formula esta bien; lo que difiere es lo que ve cada lado"
    : "DISTINTA con la misma entrada → hay divergencia de FORMULA (" + eur(Math.abs(c.shown - crudo.shown)) + ")"}`);

  // 3) Desglose de lo que el servidor SÍ cuenta, para poder cotejarlo contra la pantalla del móvil.
  const ents = srv.bancosDeGastoDiario(data);
  const cuentan = filas.filter((f) => srv.cuentaParaPresupuesto(f, ents));
  console.log(`\n  cuentan ${cuentan.length} de ${filas.length} filas`);
  const porFuente = {};
  for (const f of cuentan) {
    const k = String(f.source || "?").split(":")[0];
    porFuente[k] = (porFuente[k] || 0) + (Number(f.importe) || 0);
  }
  for (const [k, v] of Object.entries(porFuente).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(12)} ${eur(v)}`);
  }
  console.log(`  las 8 mas gordas que cuentan:`);
  cuentan.slice().sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe)).slice(0, 8)
    .forEach((f) => console.log(`    ${String(f.fecha).slice(5, 10)}  ${eur(Number(f.importe)).padStart(11)}` +
      `  ${String(f.cat || "").padEnd(11)} ${String(f.source || "").padEnd(16)} ${String(f.comercio || "").slice(0, 18)}`));

  // 4) Gemelos: mismo importe y mismo dia por DOS caminos. Es la sospecha numero uno de que la
  //    nube tenga filas que el movil ya descarto (reconcileObDupes borra en local y puede fallar
  //    en la nube sin decir nada: `.catch(()=>{})`).
  const porClave = {};
  for (const f of cuentan) {
    const k = String(f.fecha).slice(0, 10) + "|" + (Number(f.importe) || 0).toFixed(2);
    (porClave[k] = porClave[k] || []).push(f);
  }
  const gemelos = Object.entries(porClave).filter(([, v]) => v.length > 1);
  if (gemelos.length) {
    const sobra = gemelos.reduce((a, [, v]) => a + (v.length - 1) * Math.abs(Number(v[0].importe) || 0), 0);
    console.log(`\n  ⚠ ${gemelos.length} grupo(s) de gemelos (mismo dia + mismo importe) que SI cuentan.`);
    console.log(`    si cada grupo deberia ser UNA sola fila, sobran ${eur(sobra)}`);
    gemelos.slice(0, 6).forEach(([k, v]) => console.log(
      `    ${k}  x${v.length}  [${v.map((x) => String(x.source || "?")).join(" + ")}]  ${String(v[0].comercio || "").slice(0, 16)}`));
  } else {
    console.log(`\n  sin gemelos exactos entre lo que cuenta`);
  }

  /* 5) LA PRUEBA DE FUEGO: reproducir lo que ve la APP.
     `syncCloudExpenses` fusiona con `keyOf = dia|importe|comercio` (SIN hora) y descarta lápidas.
     Si ingest no hace lo mismo, el widget suma de más. Horas distintas ≠ dos compras: el 13/8 los
     dos 230 de APOLLON eran Wallet y TR del mismo cargo (el banco solo tiene uno). */
  const claveApp = (f) => String(f.fecha).slice(0, 10) + "|" + (Number(f.importe) || 0) + "|" + (f.comercio || "");
  const lapidas = new Set(data?.deleted || []);
  const vistas = new Set();
  const comoLaApp = [];
  let tapadasPorLapida = 0, tapadasPorClave = 0, importeTapado = 0;
  for (const f of filas) {
    const k = claveApp(f);
    if (lapidas.has(k)) { tapadasPorLapida++; importeTapado += Number(f.importe) || 0; continue; }
    if (vistas.has(k)) { tapadasPorClave++; importeTapado += Number(f.importe) || 0; continue; }
    vistas.add(k);
    comoLaApp.push(f);
  }
  const cApp = cli.monthBudgetStats(Object.assign({}, data, {
    expenses: comoLaApp.map((f) => ({ date: f.fecha, amount: Number(f.importe) || 0, category: f.cat, source: f.source })),
  }));
  console.log(`\n  LO QUE VE LA APP (nube + fusion por dia|importe|comercio + lapidas)`);
  console.log(`    ${tapadasPorClave} fila(s) tapadas por la fusion · ${tapadasPorLapida} por lapida` +
    ` · ${eur(importeTapado)} en total`);
  console.log(`    gastado(shown) ${eur(cApp.shown)}   ← esto deberia ser lo que enseña la pantalla`);
  console.log(`    frente a ${eur(s.shown)} del widget  ⇒ desfase ${eur(s.shown - cApp.shown)}` +
    (Math.abs(s.shown - cApp.shown) < 0.02 ? `  (widget y pantalla de acuerdo)` : `  ⚠ AQUI ESTA EL BUG`));

  /* 6) EL MISMO MOVIMIENTO, METIDO DOS VECES CON EL SIGNO AL REVES (2026-09-11).
     El indice unico de la tabla es `(user_id, fecha, importe, comercio)` y `importe` LLEVA EL
     SIGNO; la clave de fusion del cliente (`keyOf`) tambien. Asi que si una sincronizacion de
     Open Banking devuelve el mismo movimiento con el signo cambiado, ni la BD ni la app lo
     reconocen como repetido: entra como fila nueva y el mes se descuadra por el DOBLE del
     importe. No lo tapa nada — `reconcileObDupes`, pese al nombre, devuelve siempre `borrar:[]`.
     Caso medido: el mismo movimiento de Revolut entro el 06/09 como +247,26 (cat `traspaso`) y
     el 10/09 como -247,26 (cat `ingreso`), con identica fecha, comercio, nota y `ob_name`. */
  const porFechaComercio = {};
  for (const f of filas) {
    const k = String(f.fecha) + "|" + (f.comercio || "") + "|" + Math.abs(Number(f.importe) || 0).toFixed(2);
    (porFechaComercio[k] = porFechaComercio[k] || []).push(f);
  }
  const volteados = Object.values(porFechaComercio).filter(
    (v) => v.length > 1 && v.some((x) => Number(x.importe) > 0) && v.some((x) => Number(x.importe) < 0),
  );
  if (volteados.length) {
    const ruido = volteados.reduce((a, v) => a + Math.abs(Number(v[0].importe) || 0) * 2, 0);
    console.log(`\n  ⚠ ${volteados.length} movimiento(s) metidos DOS VECES con el signo al reves` +
      ` — ${eur(ruido)} de ruido. El indice unico no los ve porque lleva el signo dentro.`);
    volteados.slice(0, 6).forEach((v) => console.log(
      `    ${String(v[0].fecha).slice(0, 16)}  ${eur(Math.abs(Number(v[0].importe)))}` +
      `  [${v.map((x) => x.source).join(" + ")}]  cats ${v.map((x) => x.cat).join("/")}` +
      `  creados ${v.map((x) => String(x.created_at || "?").slice(0, 10)).join(" y ")}`));
  } else {
    console.log(`\n  sin movimientos volteados de signo`);
  }

  // Horas de cada gemelo. ⚠ Horas de diferencia NO prueba dos compras: Wallet y TR del mismo
  // cargo pueden avisarte con más de una hora de margen (13/8: 11:31 vs 13:08, y el banco
  // solo tenía uno). La prueba de verdad es el extracto del banco, no el reloj de la noti.
  if (gemelos.length) {
    console.log(`\n  horas de cada gemelo (para saber si son la misma compra o dos):`);
    gemelos.slice(0, 6).forEach(([k, v]) => {
      const horas = v.map((x) => String(x.fecha).slice(11, 19)).join("  vs  ");
      console.log(`    ${k}  →  ${horas}`);
    });
  }
}
