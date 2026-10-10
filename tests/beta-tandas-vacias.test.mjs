#!/usr/bin/env node
/**
 * APROBAR UNA TANDA TIENE QUE QUITARLA DEL PANEL PARA SIEMPRE.
 *
 * Bug suyo, 2026-09-08: «todo lo que probé y marqué como aprobado me salta otra vez».
 * Por la mañana aprobó cinco tandas y por la tarde le volvieron a salir sin aprobar.
 *
 * Causa: al aprobar una tanda se QUITA del array `tandas` de su versión. Al quitar la última
 * se borró también la propiedad entera, y `betaTandas()` trataba «sin tandas» como «versión
 * antigua que nunca las declaró» → devolvía UNA tanda con todo dentro. La versión resucitaba
 * en el panel como `4.19.5/todo`, un id que no casaba con el veredicto que él ya había dado.
 *
 * O sea: `tandas:[]` y «sin `tandas`» NO son lo mismo y este test lo clava.
 *   · propiedad AUSENTE → una tanda «todo» (las ~70 versiones del histórico siguen igual).
 *   · array VACÍO       → cero tandas, no vuelve nada.
 *
 * No comprueba una constante: carga el bundle de verdad y le pregunta al panel qué pintaría.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {execFileSync} from "node:child_process";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const cli = loadPureLogicFromFile();
/* La version que corre, leida del fichero VERSION (la canonica del repo, no package.json). */
const VERSION_ACTUAL = fs.readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();
/* ¿Hay ronda viva? Justo después de promocionar (4.19.106, 13/9) NO la hay: todo lo de beta subió
   a producción y todas las notas llevan `tandas:[]`. Un panel a 0 entonces es lo CORRECTO, así que
   las comprobaciones de «queda algo por probar» solo aplican cuando alguna nota tiene tandas. */
const HAY_RONDA = JSON.parse(fs.readFileSync(new URL("../src/data/release-notes.json", import.meta.url), "utf8"))
  .some((n) => Array.isArray(n.tandas) && n.tandas.length > 0);
// Las siete pendientes de septiembre siguen protegidas después de su entrega real.
const historicalNotes=JSON.parse(execFileSync("git",["show","4403b252933410741a877eea59b85d812b2fe543:src/data/release-notes.json"],{encoding:"utf8",maxBuffer:5e6}));
function conHistoria(fn){const current=cli.RELEASE_NOTES;try{cli.RELEASE_NOTES=historicalNotes;return fn();}finally{cli.RELEASE_NOTES=current;}}
let failed = 0;
function t(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}

console.log("beta-tandas-vacias");

function entregasHasta(version, apk) {
  cli.window._mcProdEntregas={web:{},edge:{}};
  cli.window._mcProdApkRevisiones={};
  for(const n of cli.RELEASE_NOTES) if(!cli.mcIsNewer(n.v,version)) for(const g of n.tandas||[]) {
    if(g.referenciaHistorica) continue; // no simular una entrega del código retirado
    cli.window._mcProdEntregas.web[g.id]=g.web;
    // Edge tiene recibo propio: ligarlo a la APK dejaba una entrega sin nativo siempre
    // pendiente incluso al simular «todo entregado» (CI movilidad88, 3/10).
    if(g.edge) cli.window._mcProdEntregas.edge[g.id]=g.edge;
    if(apk>=g.apk) cli.window._mcProdApkRevisiones[g.id]=g.native;
  }
}

// El archivo109 conserva su identidad y decisión; nunca cuenta como tarea activa.
const ARCHIVE109_ID="inc-0810-inicio-grafica-significado";
const archive109=JSON.parse(fs.readFileSync(new URL("../scripts/beta-archives.json",import.meta.url),"utf8")).refs[ARCHIVE109_ID];
const EXPECTED109={
  sha:"f4ffb9340adfd0a13b631271e8158d2c630613c0",version:"4.26.109",
  codigo:"b90e6223cd45ef64e8689d4c772560c31c7db47939694211a892316030a283f0",
  web:"d05bb0d4d86dce14c5ba4794a0be2a265e52f3a167cf8eadce87aa198e5cd38d",estado:"ausente"
};
function activeWithExactArchive(pack){
  const archived=Array.from(pack.tandas).filter(g=>g.referenciaHistorica);
  assert.deepEqual(archived.map(g=>String(g.id)),["4.26.109/"+ARCHIVE109_ID],
    "queda exactamente el archivo109: ni perdido ni mezclado con otra tanda");
  const g=archived[0];
  assert.deepEqual(JSON.parse(JSON.stringify(g.referenciaHistorica)),EXPECTED109);
  assert.equal(g.codigo,EXPECTED109.codigo);assert.equal(g.web,EXPECTED109.web);
  assert.equal(g.t,"v4.26.109 · "+archive109.guion.t.es);
  assert.deepEqual(Array.from(g.items),archive109.guion.items.es);
  assert.equal(g.huella,cli.betaHuella(ARCHIVE109_ID,archive109.guion.t.es,archive109.guion.items.es,1,EXPECTED109.codigo));
  assert.equal(g.native,undefined);assert.equal(g.edge,undefined);assert.equal(g.apk,0);
  assert.deepEqual(Array.from(g.desde),[]);assert.deepEqual(Array.from(g.huellasCompatibles),[]);
  assert.deepEqual(JSON.parse(JSON.stringify(g.entrega)),{web:"historical-absent"});
  assert.deepEqual(JSON.parse(JSON.stringify(cli.betaEstadoPrueba(g,9999,VERSION_ACTUAL,VERSION_ACTUAL))),{web:"historical-absent"});
  assert.equal(cli.betaVerdictFor(g,[]),null,"el archivo no fabrica una aprobación");
  assert.deepEqual(Array.from(pack.items),Array.from(pack.tandas).flatMap(x=>Array.from(x.items)),
    "los índices históricos permanecen junto a los activos");
  return Array.from(pack.tandas).filter(x=>!x.referenciaHistorica);
}
function latestSurfaceIds(predicate){
  const seen=new Set(),ids=[];
  for(const n of cli.RELEASE_NOTES) if(!cli.mcIsNewer(n.v,VERSION_ACTUAL)) for(const g of n.tandas||[]){
    if(seen.has(g.id))continue;
    seen.add(g.id);
    if(!g.referenciaHistorica&&predicate(g))ids.push(n.v+"/"+g.id);
  }
  return ids.sort();
}
function onlyArchive109(pack){
  assert.deepEqual(activeWithExactArchive(pack),[],"cero pendientes activos, sin fallback antiguo");
  assert.deepEqual(JSON.parse(JSON.stringify(cli.betaMarksCount(pack))),{n:0,tot:0},
    "el archivo no se suma al progreso activo");
}

t("array VACÍO → cero tandas (la aprobada no vuelve)", () => {
  const notas = { v: "9.9.9", t: { es: "X" }, tandas: [], items: { es: ["punto suelto"] } };
  assert.deepEqual(cli.betaTandas(notas), []);
});

t("propiedad AUSENTE → una tanda «todo» (las versiones antiguas siguen funcionando)", () => {
  const notas = { v: "9.9.8", t: { es: "X" }, items: { es: ["punto suelto"] } };
  const out = cli.betaTandas(notas);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "todo");
  assert.deepEqual(out[0].items, ["punto suelto"]);
});

t("con tandas declaradas, salen esas y ninguna «todo»", () => {
  const notas = {
    v: "9.9.7", t: { es: "X" },
    tandas: [{ id: "una", t: { es: "Una" }, items: { es: ["a", "b"] } }],
    items: { es: ["resumen que NO debe salir como tanda"] },
  };
  const out = cli.betaTandas(notas);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "una");
});

t("★ producción al día → cero activos y exactamente109 histórica sin entrega", () => {
  entregasHasta(VERSION_ACTUAL,9999);
  const pack = cli.betaChecklist(VERSION_ACTUAL, VERSION_ACTUAL, 9999);
  onlyArchive109(pack);
  assert.equal(pack.items.length,archive109.guion.items.es.length);
  const before=JSON.stringify(pack),receipt={web:{},edge:{}};
  const proof=cli.betaPruebasEntrega(receipt,cli.RELEASE_NOTES,VERSION_ACTUAL);
  assert.equal(Object.hasOwn(proof.pruebas,ARCHIVE109_ID),false,"un guion archivado no acredita entrega");
  assert.equal(JSON.stringify(receipt),JSON.stringify({web:{},edge:{}}),"el recibo de entrada no se modifica");
  assert.equal(JSON.stringify(pack),before,"no se cambia la identidad ni se reinicia el archivo");
});

// 30/9: la web al día no entrega lo nativo; solo quedan las tandas con `apk` sin APK estable.
t("★ web al día con APK estable atrasada → solo quedan las tandas nativas", () => {
  entregasHasta(VERSION_ACTUAL,48);
  const pack = cli.betaChecklist(VERSION_ACTUAL, VERSION_ACTUAL, 48);
  const active=activeWithExactArchive(pack),expected=latestSurfaceIds(g=>g.apk>48);
  assert.deepEqual(active.map(g=>String(g.id)).sort(),expected,"exactamente las tandas nativas, sin ocultar extras");
  active.forEach(g=>{
    assert.ok(g.apk>48);
    assert.deepEqual(Object.keys(g.entrega),["native"],"el recibo web/Edge no entrega una APK atrasada");
    assert.ok(["pending","unknown"].includes(g.entrega.native));
  });
});

t("★ entregar web y APK no sustituye el recibo Edge de ninguna tanda real", () => {
  entregasHasta(VERSION_ACTUAL,9999);
  const edgeIds=Array.from(new Set(cli.RELEASE_NOTES.flatMap((n)=>
    !cli.mcIsNewer(n.v,VERSION_ACTUAL)?(n.tandas||[]).filter((g)=>g.edge).map((g)=>g.id):[])));
  edgeIds.forEach((id)=>{ delete cli.window._mcProdEntregas.edge[id]; });
  const pending=cli.betaChecklist(VERSION_ACTUAL,VERSION_ACTUAL,9999);
  const active=activeWithExactArchive(pending),expected=latestSurfaceIds(g=>!!g.edge);
  assert.deepEqual(active.map(g=>String(g.id)).sort(),expected,"exactamente las tandas sin recibo Edge");
  active.forEach(g=>{
    assert.deepEqual(Object.keys(g.entrega),["edge"],"web/APK entregadas no ocultan la falta de Edge");
    assert.ok(["pending","unknown"].includes(g.entrega.edge));
  });
  entregasHasta(VERSION_ACTUAL,9999);
  onlyArchive109(cli.betaChecklist(VERSION_ACTUAL,VERSION_ACTUAL,9999));
});

t("★ al subir solo Deudas, el panel conserva las siete pruebas pendientes", () => conHistoria(() => {
  cli.window._mcProdEntregas=null; cli.window._mcProdApkRevisiones=null;
  const pack = cli.betaChecklist("4.26.70.2", "4.26.67",48);
  const ids = Array.from(pack.tandas, (g) => String(g.id).split("/").at(-1));
  assert.deepEqual(ids.sort(), [
    "inc-2709-01-arranque-red", "inc-2809-02-ayuda-ciclo", "fin05-widget-reentrada",
    "fin05-pago-cerrada", "tr-descripcion-clasificacion", "widget-banco", "widget-app-cerrada",
  ].sort());
  assert.equal(ids.includes("inc-2709-02-deudas-archivo"), false);
}));

t("★ guion rechazado de gas71 trasladado a74 conserva las siete anteriores", () => conHistoria(() => {
  cli.window._mcProdEntregas=null; cli.window._mcProdApkRevisiones=null;
  const pack=cli.betaChecklist("4.26.71.1", "4.26.67",48);
  const ids=Array.from(pack.tandas,(g)=>String(g.id).split("/").at(-1));
  assert.deepEqual(ids.sort(),[
    "inc-2709-01-arranque-red", "inc-2809-02-ayuda-ciclo", "fin05-widget-reentrada",
    "fin05-pago-cerrada", "tr-descripcion-clasificacion", "widget-banco", "widget-app-cerrada",
  ].sort());
}));

t("★ el snapshot80 conserva trece tandas y81 traslada el panel sin perder historia", () => {
  cli.window._mcProdEntregas=null; cli.window._mcProdApkRevisiones=null;
  const current=cli.RELEASE_NOTES;
  try{
    // La historia se prueba con su fuente fija: el traslado81 no debe reescribir el fixture77.
    cli.RELEASE_NOTES=JSON.parse(execFileSync("git",["show","955765a9ec0ad96d20140a8f12da00c9fa04985c:src/data/release-notes.json"],{encoding:"utf8",maxBuffer:5e6}));
    const prior=cli.betaChecklist("4.26.77.1","4.26.67",48),next=cli.betaChecklist("4.26.78.1","4.26.67",48);
    const ids=pack=>Array.from(pack.tandas,g=>String(g.id).split("/").at(-1));
    assert.equal(prior.tandas.length,13);
    assert.deepEqual(ids(next).sort(),ids(prior).concat(["inc-3009-nomina-anticipada"]).sort());
    assert.equal(next.tandas.filter(g=>String(g.id).endsWith("/inc-3009-nomina-anticipada")).length,1);
  }finally{cli.RELEASE_NOTES=current;}
  const panels=cli.betaChecklist(VERSION_ACTUAL,"4.26.67",48).tandas.filter(g=>String(g.id).endsWith("/beta-panel-veredictos"));
  assert.equal(panels.length,1);
  assert.ok(panels[0].historial.includes("4.26.76/beta-panel-veredictos"));
  assert.ok(panels[0].historial.includes("4.26.81/beta-panel-veredictos"));
  assert.deepEqual(Array.from(cli.RELEASE_NOTES.find(n=>n.v==="4.26.81").tandas),[]);
  assert.deepEqual(Array.from(cli.RELEASE_NOTES.find(n=>n.v==="4.26.76").tandas),[]);
});

t("★ una tanda corregida varias veces solo aparece en su versión más nueva", () => {
  const prev = cli.RELEASE_NOTES;
  try {
    cli.RELEASE_NOTES = [
      { v: "9.9.2", t: { es: "Nueva" }, tandas: [
        { id: "misma-prueba", t: { es: "Nueva" }, items: { es: ["1. Prueba nueva"] } },
      ] },
      { v: "9.9.1", t: { es: "Vieja" }, tandas: [
        { id: "misma-prueba", t: { es: "Vieja" }, items: { es: ["1. Prueba vieja"] } },
      ] },
    ];
    const pack = cli.betaChecklist("9.9.2.4", "9.9.0");
    assert.deepEqual(Array.from(pack.tandas, (g) => String(g.id)), ["9.9.2/misma-prueba"]);
    assert.deepEqual(Array.from(pack.items, String), ["1. Prueba nueva"]);
  } finally {
    cli.RELEASE_NOTES = prev;
  }
});

/* Fontanería en el tip (`tandas:[]`) no puede vaciarle el panel mientras aún pregunta prod /
   sin red — bug medido en review de 4.19.86: checklist(V,null) devolvía 0. */
t("★ tip con tandas:[] sin prodVersion → salta a la más nueva con algo que probar", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, null);
  if (!HAY_RONDA) { assert.equal(pack.tandas.length, 0, "sin ronda viva el panel tiene que quedar a 0"); return; }
  assert.ok(pack.tandas.length > 0,
    "sin prod, con tip fontanería, el panel no puede quedar a 0 (tiene media ronda detrás)");
  assert.equal(pack.tandas.some((g) => String(g.id).endsWith("/todo") || g.id === "todo"), false,
    "no resucitar como «todo» al saltar el tip vacío");
});

t("★ su bug: ninguna versión de la ronda resucita como «/todo»", () => {
  /* La ronda real que ve su móvil: todo lo publicado por encima de producción. Si alguna
     versión de estas vuelve como «todo» es que a alguien se le fue la propiedad al retirar
     una tanda aprobada, y él se la va a encontrar otra vez sin aprobar. */
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const resucitadas = pack.tandas.filter((g) => String(g.id).endsWith("/todo")).map((g) => g.id);
  assert.equal(resucitadas.length, 0,
    "vuelven enteras al panel: " + resucitadas.join(", ") + " — ponles `tandas:[]` en vez de quitar la propiedad");
});

/* NINGUNA TANDA CON VEREDICTO SUYO PUEDE VOLVER AL PANEL.
   La lista de abajo son ids que él YA juzgó —aprobados el 8/9 y el 10/9, y rechazados—, leídos
   de sus propios veredictos con `node scripts/errores.mjs --kind=beta`. Enseñarle otra vez algo
   que ya dictaminó es exactamente lo que pidió quitar el 11/9 por la noche: «no me sirve cosas
   que ya te he dicho por aquí». Un RECHAZO tampoco vuelve tal cual: el arreglo se le devuelve
   como paso dentro de la tanda que de verdad lo arregla (tr-reactivo → quitar-banco de 4.19.28,
   avisos-presupuesto → la tanda de 4.19.55), no re-probando la versión que ya rechazó. */
t("★ nada con veredicto suyo vuelve al panel", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const ids = pack.tandas.map((g) => String(g.id));
  const juzgadas = [
    /* aprobadas 8/9 */ "notas-20", "arranque-suelto", "panel-ronda", "multicuenta", "posible-repetido",
    /* aprobadas 10/9 */ "categoria-ia", "orden-gastos", "acabado-v4", "pulido-b245", "revision-plegable",
    "informe-mes", "presupuesto-categoria",
    /* rechazadas (su arreglo va dentro de otra tanda) */ "tr-reactivo", "avisos-presupuesto",
    "ventana-mes", "pulido-cierre", "modo-inicial",
    /* 13/9, panel limpio: aprobadas del 11 al 13/9 */ "id-fila", "efectivo", "repetido-widget",
    "pulsacion-larga", "cats-plegable", "bizum-categoria", "aely", "banco-de-pruebas",
    "manual-no-fusiona", "donde-se-elige-el-gasto", "saldo-por-banco", "logos-inversiones",
    "gastos-todas-las-cuentas", "cartera-cabecera-iconos", "categorias-que-empiezan",
    "botnav-subir-sin-lag", "ficha-efectivo-guarda", "editar-solo-ob", "longpress-cuentas",
    "sync-refresca", "agua-luz-gas", "repo-aely", "ultima-cuota-descartar", "banco-pending-banner",
    "volver-a-estable", "ola-nativa", "bancos-lista-fresca", "swipe-sin-corte",
    /* rechazadas y sustituidas por una tanda viva */ "banco-pendiente-y-quitar", "rol-sin-salto",
    "rol-sin-salto-2", "guardar-cta", "guardar-pie", "historico-la-lista", "historico-madrugada",
    "historico-fecha-cercana", "historico-bancos-completos", "hist-cashback-par",
  ];
  juzgadas.forEach((id) => {
    assert.equal(ids.some((x) => x.endsWith("/" + id) || x === id), false,
      `«${id}» ya tiene veredicto suyo y ha vuelto al panel`);
  });
});

t("y lo que nunca ha probado sigue ahí (no nos hemos pasado de frenada)", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const ids = pack.tandas.map((g) => String(g.id));
  /* ⚠ Son ids de tandas VIVAS, y las tandas se funden entre sí cuando dos piden la misma prueba
     («quitar-banco» acabó dentro de «banco-pendiente-y-quitar» el 11/9). Si al fundir una te sale
     rojo esto, cambia el id por el que sobrevive — no quites la comprobación, que es la que evita
     pasarse de frenada al limpiar el panel. */
  /* 13/9: las cinco de antes las aprobó (id-fila, cats-plegable, pulsacion-larga,
     logos-inversiones) o las tapó otra aprobada (banco-pendiente-y-quitar). Panel limpio a
     petición suya: quedan estas, sin juzgar. */
  /* 13/9 tarde: las cinco subieron a producción en 4.19.106. Cuando haya ronda nueva, sus ids van aquí. */
  ([]).forEach((id) => {
    assert.equal(ids.some((x) => x.endsWith("/" + id)), true, `falta «${id}», que sigue pendiente`);
  });
});

/* Y que los pasos se puedan seguir sin adivinar: él los lee en el móvil, uno a uno. */
t("cada punto del panel dice qué hacer, no solo qué debería pasar", () => {
  const pack = cli.betaChecklist(VERSION_ACTUAL, "4.18.7");
  const flojos = [];
  pack.tandas.forEach((g) => {
    (g.items || []).forEach((it) => {
      const txt = String(it || "");
      if (!/^\s*\d+\./.test(txt)) flojos.push(g.id + " → " + txt.slice(0, 60));
    });
  });
  assert.equal(flojos.length, 0,
    "estos puntos no van numerados como pasos:\n      " + flojos.join("\n      "));
});

// Una entrega selectiva acredita código, aunque su nota siga en una versión posterior.
t("entrega exacta retira una tanda moderna aunque producción tenga un número menor", () => {
  const c=loadPureLogicFromFile(), g={id:"entregada",t:"Entrega",items:{es:["1. Probar"]},codigo:"c".repeat(64),web:"a".repeat(64)};
  c.RELEASE_NOTES=[{v:"4.26.75",tandas:[g]}];
  c.window._mcProdEntregas={web:{entregada:g.web}};
  assert.equal(c.betaSinEntregar(g,48),false);
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",48).tandas.length,0);
});
t("la última revisión entregada no resucita otra antigua del mismo id", () => {
  const c=loadPureLogicFromFile(), g={id:"entregada",t:"Entrega",items:{es:["1. Probar"]},codigo:"c".repeat(64),web:"a".repeat(64)};
  c.RELEASE_NOTES=[{v:"4.26.75",tandas:[g]},{v:"4.26.68",tandas:[Object.assign({},g,{web:"b".repeat(64)})]}];
  c.window._mcProdEntregas={web:{entregada:g.web}};
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",48).tandas.length,0);
  c.RELEASE_NOTES.reverse(); c.RELEASE_NOTES[0].v="4.26.75";c.RELEASE_NOTES[1].v="4.26.68";
  const out=c.betaChecklist("4.26.75.1","4.26.67",48).tandas;
  assert.equal(out.length,1);assert.equal(out[0].web,"b".repeat(64));
});
t("404, APK antigua o Edge sin acreditar conservan la tanda moderna; legacy sigue por versión", () => {
  const c=loadPureLogicFromFile(), g={id:"entregada",t:"Entrega",items:{es:["1. Probar"]},codigo:"c".repeat(64),web:"a".repeat(64),native:"b".repeat(64),edge:"d".repeat(64),apk:51};
  c.RELEASE_NOTES=[{v:"4.26.75",tandas:[g]}];
  c.window._mcProdEntregas=null;
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",48).tandas.length,1);
  c.window._mcProdEntregas={web:{entregada:g.web},edge:{entregada:g.edge}};c.window._mcProdApkRevisiones={entregada:g.native};
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",48).tandas.length,1);
  c.window._mcProdEntregas.edge={};
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",51).tandas.length,1);
  c.window._mcProdEntregas.edge.entregada=g.edge;
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",51).tandas.length,0);
  c.RELEASE_NOTES=[{v:"4.26.75",tandas:[{id:"legacy",t:"Antigua",items:{es:["1. Probar"]}}]}];
  assert.equal(c.betaChecklist("4.26.75.1","4.26.67",48).tandas.length,1);
  assert.equal(c.betaChecklist("4.26.75.1","4.26.75",48).tandas.length,0);
});

console.log(failed ? `\n${failed} fallo(s)` : "\nbeta-tandas-vacias: OK");
process.exit(failed ? 1 : 0);
