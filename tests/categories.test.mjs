#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const ctx = loadPureLogicFromFile();

function t(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
}

console.log("categories");

t("Gencat cae en impuestos y multas", () => {
  assert.equal(ctx.autoCategory("Gencat multa transit"), "tasas");
});

t("AEAT cae en impuestos y multas", () => {
  assert.equal(ctx.autoCategory("AEAT recaudacion"), "tasas");
});

t("Booking cae en viajes (no ocio)", () => {
  assert.equal(ctx.autoCategory("Booking.com"), "viajes");
});

t("Vueling cae en viajes", () => {
  assert.equal(ctx.autoCategory("Vueling Airlines"), "viajes");
});

t("Papelería cae en compras", () => {
  assert.equal(ctx.autoCategory("Papeleria Norma"), "compras");
});

t("Zooplus cae en mascotas (no hogar)", () => {
  assert.equal(ctx.autoCategory("Zooplus"), "mascotas");
});

t("Endesa cae en energía", () => {
  assert.equal(ctx.autoCategory("Endesa Factura"), "energia");
});

t("Udemy cae en educación", () => {
  assert.equal(ctx.autoCategory("Udemy.com"), "educacion");
});

t("Kinepolis cae en cine", () => {
  assert.equal(ctx.autoCategory("Kinepolis Barcelona"), "cine");
});

t("Consulta médica cae en salud", () => {
  assert.equal(ctx.autoCategory("Consulta medico Dr Lopez"), "salud");
});

t("Heladería ya no cae en bares", () => {
  assert.equal(ctx.autoCategory("Heladeria Llao Llao"), "heladeria");
  assert.equal(ctx.autoCategory("Amorino Gelato"), "heladeria");
});

t("Steam / Instant Gaming caen en videojuegos (no ocio)", () => {
  assert.equal(ctx.autoCategory("Steam Purchase"), "gaming");
  assert.equal(ctx.autoCategory("Instant Gaming"), "gaming");
});

t("Joyería tiene categoría propia", () => {
  assert.equal(ctx.autoCategory("Joyeria Tous"), "joyeria");
  assert.equal(ctx.autoCategory("Pandora Store"), "joyeria");
});

t("Teléfono / seguro / alquiler caen en Recibos, no en otros", () => {
  assert.equal(ctx.autoCategory("Vodafone España"), "recibos");
  assert.equal(ctx.autoCategory("Mapfre Seguros"), "recibos");
  assert.equal(ctx.autoCategory("Alquiler piso"), "recibos");
  assert.equal(ctx.autoCategory("MOVISTAR ES"), "recibos");
});

t("Movistar Plus se queda en ocio (no Recibos)", () => {
  assert.equal(ctx.autoCategory("Movistar Plus"), "ocio");
});

t("Endesa sigue en energía, no Recibos", () => {
  assert.equal(ctx.autoCategory("Endesa Factura"), "energia");
});

t("ChatGPT / Claude / Cursor tienen categoría propia de IA", () => {
  assert.equal(ctx.autoCategory("OPENAI CHATGPT SUBSCRIPTION"), "ia");
  assert.equal(ctx.autoCategory("Claude Anthropic"), "ia");
  assert.equal(ctx.autoCategory("Cursor AI"), "ia");
  assert.equal(ctx.autoCategory("Perplexity"), "ia");
});

t("Google Play se queda en ocio", () => {
  assert.equal(ctx.autoCategory("Google Play"), "ocio");
});

t("Playtomic / pádel caen en padel (no ocio)", () => {
  assert.equal(ctx.autoCategory("Playtomic"), "padel");
  assert.equal(ctx.autoCategory("Club de padel Norte"), "padel");
});

t("Restaurante de pádel sigue en bares", () => {
  assert.equal(ctx.autoCategory("Restaurante de padel"), "bares");
});

/* El bar del padre (2026-08-06): con la keyword `"bar "` sólo picaban los nombres que SIGUEN con
   algo. Los que acaban en «bar» —que son legión— se iban a «otros», y «SPORTS BAR» a ocio. */
for (const nombre of ["1331 BAR", "SNACK BAR", "EL RACO BAR", "LA BOMBETA BAR", "SPORTS BAR", "BAR"]) {
  t(`«${nombre}» cae en bares aunque acabe en «bar»`, () => {
    assert.equal(ctx.autoCategory(nombre), "bares");
  });
}

t("Barcelona no cae en bares por el substring «bar»", () => {
  assert.notEqual(ctx.autoCategory("Parking Barcelona Centro"), "bares");
});

t("Bizum cae en bizum (no otros)", () => {
  assert.equal(ctx.autoCategory("BIZUM A MARIA"), "bizum");
  assert.equal(ctx.autoCategory("Bizum de Pedro"), "bizum");
  assert.equal(ctx.autoCategory("Envio Bizum Ana"), "bizum");
});

t("la IA (categorize) conoce todas las categorías del cliente", () => {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const core = fs.readFileSync(path.join(root, "src/modules/00-core.js"), "utf8");
  const block = core.match(/const CATEGORIES = \[([\s\S]*?)\];/);
  assert.ok(block, "CATEGORIES en 00-core.js");
  const ids = [...block[1].matchAll(/id:"([a-z]+)"/g)].map(function(m){ return m[1]; });
  assert.ok(ids.indexOf("recibos")>=0, "CATEGORIES tiene Recibos");
  const src = fs.readFileSync(path.join(root, "supabase/functions/categorize/index.ts"), "utf8");
  ids.forEach(function(id){
    assert.ok(src.indexOf('"'+id+'"')>=0, "categorize ALLOWED falta "+id);
  });
});

/* KW_INICIO (2026-09-12). Cuatro marcas que casaban DENTRO de otra palabra, todas sacadas de
   comercios REALES suyos al barrer sus 237 nombres distintos. El caso que manda es el primero:
   «Transporte publico» caía en Ocio porque `sport` vive dentro de tranSPORTe.

   ⚠ Este test se comprobó EN ROJO antes de darlo por bueno: quitando `KW_INICIO` entero de
   `00-core.js`, los cuatro casos de conducta fallan. No mira la lista, mira la CONDUCTA. */
t("«Transporte publico» es transporte, no ocio (sport ⊂ tranSPORTe)", () => {
  assert.equal(ctx.autoCategory("Transporte publico"), "transporte");
  assert.equal(ctx.autoCategory("Transporte público"), "transporte");
});

t("«BRESSOLGRAMENET S.A.» no es un bar (ramen ⊂ bressolgRAMENet)", () => {
  assert.notEqual(ctx.autoCategory("BRESSOLGRAMENET S.A."), "bares");
});

t("«APOLLON GALLERY» no es un bar (pollo ⊂ aPOLLOn)", () => {
  assert.notEqual(ctx.autoCategory("APOLLON GALLERY"), "bares");
});

/* `mango` ⊂ MANGOpay parecía de la misma familia y NO lo es: mango EMPIEZA la palabra, así que
   pedirle límite por delante no cambia nada. Es un PREFIJO, o sea `KW_PALABRA`. Lo cazó este test
   estando yo convencido de lo contrario, y por eso está escrito aparte. */
t("«Mangopay (vinted)» no son compras (mango es prefijo: va en KW_PALABRA)", () => {
  assert.notEqual(ctx.autoCategory("Mangopay (vinted)"), "compras");
});

/* La otra mitad de KW_INICIO: exigir límite SOLO por delante es lo que salva los plurales.
   Si alguien mueve estas cuatro a `KW_PALABRA` (que pide los dos lados), esto se pone rojo. */
t("los plurales siguen casando: «POLLOS ASADOS» sigue siendo un bar", () => {
  assert.equal(ctx.autoCategory("POLLOS ASADOS CASA PEPE"), "bares");
});

t("y las marcas de verdad no se rompen", () => {
  assert.equal(ctx.autoCategory("Ramen Ya Barcelona"), "bares");
  assert.equal(ctx.autoCategory("Pollo Campero"), "bares");
  assert.equal(ctx.autoCategory("MANGO STORE GRACIA"), "compras");
  assert.equal(ctx.autoCategory("Decathlon Sport"), "ocio");
});

/* Y los compuestos que aciertan DE REBOTE y que la regla general habría roto. Están aquí para
   que nadie «simplifique» KW_INICIO a «límite por delante para todo término de ≥4 letras». */
t("los compuestos que ya acertaban siguen acertando", () => {
  assert.equal(ctx.autoCategory("KIWIBURGER"), "bares");
  assert.equal(ctx.autoCategory("TELEPIZZA ST.BOI"), "bares");
  assert.equal(ctx.autoCategory("HAMBURGUESERIA BLACK AND"), "bares");
});

console.log("\ncategories: OK");
