import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPureLogicFromFile } from "../scripts/load-pure-logic.mjs";

const notesPath = new URL("../src/data/release-notes.json", import.meta.url);
const read = fs.readFileSync;
let reads = 0, fixture = null;
fs.readFileSync = function(file, ...args) {
  if (String(file).replaceAll("\\", "/").endsWith("/src/data/release-notes.json")) { reads++; if(fixture!==null)return fixture; }
  return read.call(fs, file, ...args);
};
try {
  const cli = loadPureLogicFromFile();
  assert.equal(reads, 0, "cargar la lógica no calcula el histórico ajeno a la prueba");
  const stats = cli.monthBudgetStats({budget:1000,expenses:[],banks:[],settings:{}}, new Date("2026-10-04T10:00:00Z"));
  assert.equal(stats.budget, 1000);
  assert.equal(reads, 0, "el cálculo financiero no carga notas");
  const actual = cli.RELEASE_NOTES;
  const raw = JSON.parse(read(notesPath, "utf8"));
  assert.equal(actual.length, raw.length);
  assert.equal(actual[0].v, raw[0].v);
  assert.equal(actual.flatMap(n=>n.tandas||[]).length,raw.flatMap(n=>n.tandas||[]).length,"no inventa ni pierde tandas");
  assert.ok(actual.flatMap(n=>n.tandas||[]).every(g=>g.codigo), "toda revisión materializa su identidad completa");
  assert.equal(reads, 1);
  assert.equal(cli.RELEASE_NOTES, actual);
  assert.equal(vm.runInNewContext("RELEASE_NOTES", cli), actual, "los globales del monolito ven el mismo histórico");
  assert.equal(reads, 1, "consultar de nuevo no repite la auditoría");
  for (const value of [[], null, [{v:"9.9.1",tandas:[]}]]) {
    cli.RELEASE_NOTES = value;
    assert.equal(cli.RELEASE_NOTES, value);
    assert.equal(reads, 1, "un fixture vacío o null conserva su significado");
  }
  const override = loadPureLogicFromFile();
  override.RELEASE_NOTES = [];
  assert.equal(override.RELEASE_NOTES.length, 0);
  assert.equal(reads, 1, "un fixture propio no calcula un histórico que va a sustituir");
  // La promoción vacía tandas; una ronda publicada sigue exigiendo la auditoría real del loader.
  fixture=execFileSync("git",["show","c5f62d6603d016150afd9d0e20547b608b323045:src/data/release-notes.json"],{encoding:"utf8",maxBuffer:5e6});
  const historical=loadPureLogicFromFile();
  assert.equal(reads,1,"el segundo loader tampoco lee hasta consultar");
  assert.ok(historical.RELEASE_NOTES.flatMap(n=>n.tandas||[]).some(g=>g.codigo),"la revisión histórica materializa identidades completas");
  assert.equal(reads,2,"una sola auditoría por loader");
  console.log("pure-logic-notes: PASS · cálculo sin histórico, auditoría íntegra al consultar, caché y fixtures");
} finally { fs.readFileSync = read; }
