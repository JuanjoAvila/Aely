#!/usr/bin/env node
/**
 * Tests de clasificación del ingest (Edge Function supabase/functions/ingest).
 *
 * Antes este fichero llevaba una COPIA de `clasificar()` «duplicada a propósito». Salió cara: la
 * copia se quedó con 12 palabras de ruido mientras la de verdad crecía hasta 50, así que los tests
 * daban verde sobre una lógica que ya no era la que corría en el servidor — y el bug del bar del
 * padre (2026-08-06) vivía justo en las palabras que la copia no tenía. Ahora se carga el fichero
 * REAL: no hay Deno en esta máquina, pero esbuild —que ya es dependencia del repo— quita los tipos
 * y Node importa el resultado. Si `ingest_logic.ts` cambia, estos tests lo ven.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/ingest_logic.ts"), "utf8");
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const { clasificar, extraerComercio, categorizar, limpiarTexto } =
  await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

// Los caracteres sucios se construyen, no se escriben: si se pegan tal cual, el propio fichero de
// test se vuelve binario para git y el diff deja de leerse.
const NUL = String.fromCharCode(0);          // tumba el INSERT en Postgres
const CTRL = String.fromCharCode(0x9f);      // el control REAL de la noti de Splau, leído del móvil
const MOJI = String.fromCharCode(0xc2);      // la «Â» que deja el UTF-8 leído como Latin-1
const NBSP = String.fromCharCode(0xa0);      // espacio duro: la otra mitad del mismo destrozo
const ZWSP = String.fromCharCode(0x200b);    // espacio de ancho cero

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("ingest-classify");

t("compra tarjeta clásica → gasto", () => {
  assert.equal(clasificar("Has gastado 12,50 € en Mercadona", "Trade Republic"), "gasto");
});

t("bizum recibido → ingreso (bug 2026-07-05)", () => {
  assert.equal(clasificar("Has recibido 20 € de María por Bizum", ""), "ingreso");
});

t("bizum enviado → gasto_nocard", () => {
  assert.equal(clasificar("Has enviado 15 € a Pedro por Bizum", ""), "gasto_nocard");
});

t("intereses → ignorado", () => {
  assert.equal(clasificar("Has recibido 2,03 € de intereses", ""), "ignorado");
});

t("confirmación 3DS → ignorado (bug cobro doble 2026-07-10)", () => {
  assert.equal(clasificar("Confirma el pago de 50 € en DGT", ""), "ignorado");
});

t("transferencia recibida → ignorado (inject manual)", () => {
  assert.equal(clasificar("Has recibido una transferencia de 1500 €", ""), "ignorado");
});

/* ── El bar del padre (2026-08-06) ────────────────────────────────────────────────────────────
   Un gasto en un comercio cuyo NOMBRE contiene una palabra de la lista de ruido se perdía sin
   dejar rastro: ni fila, ni aviso, ni error en el panel. Estos nombres son de comercios que
   existen de verdad en España; si mañana alguien mete otra palabra corta en IGNORAR, salta aquí. */
const COMERCIOS_TRAMPA = [
  ["BAR STOP", "stop"],
  ["AUTOESCUELA STOP", "stop"],
  ["RESTAURANT EL LIMITE", "limit"],
  ["BAR EL DEPOSITO", "deposito"],
  ["CAFE RECARGA", "recarga"],
  ["CODIGO BCN", "codigo"],
  ["SEGURIDAD 24H SL", "seguridad"],
  ["CONFIRMA SL", "confirma"],
  ["10638 CORNELLA SPLAU SC", "el de Splau"],
];
for (const [comercio, palabra] of COMERCIOS_TRAMPA) {
  t(`«${comercio}» → gasto, no se lo come «${palabra}»`, () => {
    const texto = `Has gastado 9,90 € en ${comercio}`;
    assert.equal(clasificar(texto, "Trade Republic"), "gasto");
    assert.equal(extraerComercio(texto, "Trade Republic"), comercio);
  });
}

/* …y el ruido de verdad se sigue tirando, que es de lo que iba la lista. Son notificaciones reales
   de TR: lo que las delata va en la FRASE, nunca en el nombre del comercio. */
const RUIDO = [
  ["Has recibido 2,03 € de intereses", ""],
  ["Se ha invertido tu redondeo de 0,42 € en iShares Core MSCI World", ""],
  ["Saveback: 1,25 € invertidos en tu plan", ""],
  ["Tu plan de inversión ha ejecutado 50,00 € en Vanguard FTSE All-World", ""],
  ["Orden ejecutada: compra de 3 acciones de Apple por 512,30 €", ""],
  ["Has recibido un dividendo de 3,10 € de Realty Income", ""],
  ["Confirma el pago de 76,08 € en 10638 CORNELLA SPLAU SC", "Autoriza el pago"],
  ["Nuevo inicio de sesión en tu cuenta desde un dispositivo nuevo", ""],
  ["Has añadido 200,00 € a tu cuenta", ""],
];
for (const [texto, titulo] of RUIDO) {
  t(`ruido → ignorado: «${texto.slice(0, 44)}…»`, () => {
    assert.equal(clasificar(texto, titulo), "ignorado");
  });
}

/* ── El gasto de Splau (2026-08-06) ───────────────────────────────────────────────────────────
   El nombre llegó del datáfono con basura de codificación. Un invisible en medio ensucia el
   histórico; un NUL tumba el INSERT en Postgres y el gasto no se apunta en ningún sitio.

   Los bytes de aquí abajo NO son un ejemplo: son los que llevaba la notificación de verdad, leídos
   de su móvil con `adb shell dumpsys notification --noredact`. El título era
   `10638 CORNELLA` + U+00C2 + U+009F + ` SPLAU SC`, o sea UTF-8 (C2 9F) leído como Latin-1: un
   carácter partido en dos. Antes se quitaba solo el control y quedaba «CORNELLAÂ SPLAU SC», con la
   Â huérfana metida en el histórico para siempre; ahora se va la pareja entera.

   (Y de paso: U+009F no es un NUL, así que Postgres lo habría aceptado. Esta fila no se perdió por
   la codificación — se perdió porque la noti era de Google Wallet y el lector no la escuchaba.) */
t("comercio con basura de codificación → se limpia, no se pierde", () => {
  const texto = "Has gastado 76,08 € en 10638 CORNELLA" + MOJI + CTRL + " SPLAU SC";
  assert.equal(clasificar(texto, "Trade Republic"), "gasto");
  assert.equal(extraerComercio(texto, "Trade Republic"), "10638 CORNELLA SPLAU SC");
});

t("una Â de verdad no se toca", () => {
  assert.equal(limpiarTexto("MÂCON VINS"), "MÂCON VINS");
  assert.equal(limpiarTexto("CORNELLÀ SPLAU"), "CORNELLÀ SPLAU");
});

t("el espacio duro partido separa, no pega las palabras", () => {
  // C2 A0 mal descodificado: si se quitara entero saldría «CAFECENTRAL».
  assert.equal(limpiarTexto("CAFE" + MOJI + NBSP + "CENTRAL"), "CAFE CENTRAL");
});

t("un NUL en el nombre no llega nunca a la base de datos", () => {
  const comercio = extraerComercio("Has gastado 76,08 € en CORNELLA" + NUL + " SPLAU", "");
  assert.equal(comercio.includes(NUL), false);
  assert.equal(comercio, "CORNELLA SPLAU");
});

t("limpiarTexto: invisibles fuera, texto normal intacto", () => {
  assert.equal(limpiarTexto("Mercadona"), "Mercadona");
  assert.equal(limpiarTexto("  BAR   PEPE " + ZWSP + " "), "BAR PEPE");
  assert.equal(limpiarTexto("Cafè de l'Avi"), "Cafè de l'Avi");   // acentos y apóstrofes, intactos
  assert.equal(limpiarTexto(null), "");
});

/* El bar del padre, segunda parte (2026-08-06): entraba como gasto, pero la categoría salía
   «otros» porque la keyword era `"bar "` con espacio y este nombre ACABA en bar. */
t("«1331 BAR» cae en bares, no en otros", () => {
  assert.equal(categorizar("1331 BAR"), "bares");
  assert.equal(categorizar("SNACK BAR"), "bares");
  assert.equal(categorizar("SPORTS BAR"), "bares");      // antes se iba a ocio por "sport"
  assert.notEqual(categorizar("Parking Barcelona Centro"), "bares");   // y «Barcelona» sigue fuera
});

t("el comercio limpio sigue categorizando igual", () => {
  assert.equal(categorizar(extraerComercio("Has gastado 3,20 € en BAR STOP", "")), "bares");
  assert.equal(categorizar(extraerComercio("Has gastado 3,20 € en PANADERIA" + CTRL + " LA ESQUINA", "")), "pan");
});

t("Steam / Instant Gaming caen en videojuegos", () => {
  assert.equal(categorizar("Steam Purchase"), "gaming");
  assert.equal(categorizar("Instant Gaming"), "gaming");
});

t("ChatGPT / Claude / Cursor caen en IA también en el ingest", () => {
  assert.equal(categorizar("OPENAI CHATGPT SUBSCRIPTION"), "ia");
  assert.equal(categorizar("Claude Anthropic"), "ia");
  assert.equal(categorizar("Cursor AI"), "ia");
});

t("teléfono / seguro caen en Recibos; Movistar Plus sigue en ocio", () => {
  assert.equal(categorizar("Vodafone España"), "recibos");
  assert.equal(categorizar("Mapfre Seguros"), "recibos");
  assert.equal(categorizar("MOVISTAR ES"), "recibos");
  assert.equal(categorizar("Movistar Plus"), "ocio");
});

console.log("\ningest-classify: OK");
