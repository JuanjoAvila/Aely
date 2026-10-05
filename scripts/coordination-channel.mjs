#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export const CHANNEL_BRANCH = "codex/coordinacion";
const prefix = "coordination";
const actors = ["codex", "claude", "grok"];
export const RELAY_OBJECTIVE = "Coordinar Aely y entregar el siguiente relevo verificado";
export const RELAY_SCOPE = ["coordination/tasks", "coordination/messages"];
const relayPrefix = "coordinator-relay-";
export function relayTaskId(generation) {
  if (!Number.isInteger(generation) || generation < 1 || generation > 999999) throw new Error("Generación de relevo no válida");
  return relayPrefix + String(generation).padStart(6, "0");
}
function relayGeneration(id) {
  if (typeof id !== "string" || !/^coordinator-relay-\d{6}$/.test(id) || Number(id.slice(-6)) === 0) throw new Error("Identidad de relevo no válida");
  return Number(id.slice(-6));
}
function exactKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new Error("Campos de relevo desconocidos");
}
export function validateRelayCheckpoint(cwd, sha, checkpoint) {
  exactKeys(checkpoint, ["schema", "channelSHA", "lastGrokComment", "pendingTasks", "inputState", "nextAction"]);
  if (JSON.stringify(checkpoint).length > 4000) throw new Error("Checkpoint demasiado grande");
  if (checkpoint.schema !== 1 || !/^[a-f0-9]{40}$/.test(checkpoint.channelSHA || "") || !/^(0|[1-9][0-9]{0,19})$/.test(checkpoint.lastGrokComment || "")) throw new Error("Checkpoint incompleto");
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", checkpoint.channelSHA, sha], { cwd, encoding: "utf8" });
  if (ancestor.error || ancestor.status !== 0 || git(cwd, ["cat-file", "-t", checkpoint.channelSHA]) !== "commit") throw new Error("SHA de checkpoint inexistente o ajeno al canal");
  if (!["reconcile", "review", "dispatch", "idle", "blocked-inputs"].includes(checkpoint.nextAction)) throw new Error("Siguiente acción no válida");
  exactKeys(checkpoint.inputState, ["suggestions", "errors", "beta"]);
  if (["suggestions", "errors", "beta"].some(k => !["blocked", "read", "unknown"].includes(checkpoint.inputState[k]))) throw new Error("Inputs de checkpoint no válidos");
  if (!Array.isArray(checkpoint.pendingTasks) || new Set(checkpoint.pendingTasks).size !== checkpoint.pendingTasks.length) throw new Error("Pendientes no válidos");
  // No se admite texto libre: el resumen público solo referencia encargos que ya existen.
  for (const id of checkpoint.pendingTasks) {
    validId(id);
    if (id.startsWith(relayPrefix) || !state(cwd, sha, id).task) throw new Error("Pendiente inexistente o de coordinación");
  }
  publicData(checkpoint);
  return checkpoint;
}
function validateRelayTask(task, generation) {
  if (!task || task.id !== relayTaskId(generation) || task.kind !== "coordinator-relay" || task.to !== "codex" || task.from !== "codex" || task.schema !== 1 ||
      task.previousTaskId !== (generation === 1 ? null : relayTaskId(generation - 1)) || task.objective !== RELAY_OBJECTIVE || JSON.stringify(task.scope) !== JSON.stringify(RELAY_SCOPE)) throw new Error("Cadena de coordinación inválida");
}
export function relayHead(cwd, sha) {
  const files = git(cwd, ["ls-tree", "-r", "--name-only", sha, "--", prefix + "/tasks"]).split("\n");
  const relayFiles = files.filter(f => f.startsWith(prefix + "/tasks/" + relayPrefix));
  if (relayFiles.some(f => !/^coordination\/tasks\/coordinator-relay-\d{6}\/(task|claim|result)\.json$/.test(f))) throw new Error("Fichero de relevo no válido");
  const values = relayFiles.length ? readMany(cwd, sha, relayFiles) : new Map();
  const ids = relayFiles.map(f => f.split("/")[2]);
  const generations = [...new Set(ids)].map(relayGeneration).sort((a, b) => a - b);
  const usedSessions = [];
  let previous = null;
  for (let i = 0; i < generations.length; i++) {
    const generation = generations[i];
    if (generation !== i + 1) throw new Error("Salto de generaciones");
    const current = Object.fromEntries(["task", "claim", "result"].map(name => [name, values.get(taskPath(relayTaskId(generation), name)) || null]));
    validateRelayTask(current.task, generation);
    // El cierre es la única autorización para crear otra generación; un corte no cede una reserva.
    if (previous && !previous.result) throw new Error("Predecesor sin cerrar");
    if (current.claim && (current.claim.schema !== 1 || current.claim.actor !== "codex" || current.claim.taskId !== current.task.id || current.claim.baseSHA !== current.task.baseSHA || !/^relay-run-[a-z0-9]{8,24}$/.test(current.claim.sessionId))) throw new Error("Reserva de relevo inválida");
    if (current.claim) {
      if (usedSessions.includes(current.claim.sessionId)) throw new Error("Nonce de relevo reutilizado");
      usedSessions.push(current.claim.sessionId);
    }
    if (current.result && (!current.claim || current.result.schema !== 1 || current.result.status !== "done" || current.result.released !== true || current.result.actor !== "codex" || current.result.sessionId !== current.claim.sessionId || current.result.taskId !== current.task.id)) throw new Error("Cierre de relevo inválido");
    if (current.result) validateRelayCheckpoint(cwd, sha, current.result.checkpoint);
    previous = current;
  }
  return previous ? { generation: generations.at(-1), ...previous, usedSessions } : { generation: 0, task: null, claim: null, result: null, usedSessions };
}
function validateRelayOperation(cwd, sha, operation) {
  if (!operation.taskId?.startsWith(relayPrefix)) {
    if (operation.payload?.kind === "coordinator-relay") throw new Error("Relevo fuera de su espacio de nombres");
    if (operation.actor === "codex" && operation.sessionId?.startsWith("relay-run-")) {
      const head = relayHead(cwd, sha);
      if (!/^relay-run-[a-z0-9]{8,24}$/.test(operation.sessionId) || head.result || !head.claim || head.claim.sessionId !== operation.sessionId) throw new Error("Coordinador sin relevo activo propio");
    }
    return;
  }
  const generation = relayGeneration(operation.taskId);
  const { type, actor, sessionId, payload = {} } = operation;
  if (actor !== "codex" || !/^relay-run-[a-z0-9]{8,24}$/.test(sessionId)) throw new Error("Actor o nonce público de relevo inválido");
  const head = relayHead(cwd, sha);
  if (type === "task") {
    exactKeys(payload, ["kind", "to", "baseSHA", "objective", "scope", "previousTaskId", "checkpoint"]);
    if (!Object.hasOwn(payload, "previousTaskId") || payload.previousTaskId !== (generation === 1 ? null : relayTaskId(generation - 1))) throw new Error("Predecesor obligatorio o distinto");
    validateRelayTask({ ...payload, id: operation.taskId, from: actor, schema: 1 }, generation);
    if (!state(cwd, sha, operation.taskId).task && (generation !== head.generation + 1 || (head.generation && !head.result))) throw new Error("Generación siguiente bloqueada");
    if (generation > 1 && payload.checkpoint) throw new Error("El checkpoint siguiente procede del cierre anterior");
    if (payload.checkpoint) validateRelayCheckpoint(cwd, sha, payload.checkpoint);
  } else if (type === "claim") {
    if (Object.keys(payload).length) throw new Error("Reserva sin payload");
    if (generation > 1 && state(cwd, sha, relayTaskId(generation - 1)).result?.released !== true) throw new Error("Predecesor no liberado");
    if (!state(cwd, sha, operation.taskId).claim && head.usedSessions.includes(sessionId)) throw new Error("Nonce de relevo reutilizado");
  } else if (type === "result") {
    exactKeys(payload, ["status", "tests", "summary", "checkpoint"]);
    if (payload.status !== "done" || payload.summary !== "Relevo verificado" || !Array.isArray(payload.tests) || payload.tests.length !== 0) throw new Error("Cierre de coordinación incompleto");
    validateRelayCheckpoint(cwd, sha, payload.checkpoint);
  } else throw new Error("Operación no válida para relevo");
}
function validId(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(value)) throw new Error("Identidad no válida");
  return value;
}
function publicData(value) {
  const text = JSON.stringify(value);
  if (text.length > 24000) throw new Error("Payload demasiado grande");
  // El canal es público: el filtro corta los secretos y rutas más habituales, no acredita anonimización.
  if (/(?:ghp_|github_pat_|sk-ant-|Bearer\s|-----BEGIN .*PRIVATE KEY|[A-Z]:[\\/]|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(text)) throw new Error("Payload privado o credencial: no publicar");
}
function git(cwd, args, options = {}) {
  const p = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 4e6, ...options });
  if (p.error || p.status !== 0) throw new Error("Git falló: " + args[0]);
  return p.stdout.trim();
}
function read(cwd, sha, file) {
  const exists = git(cwd, ["ls-tree", "--name-only", sha, "--", file]);
  return exists ? JSON.parse(git(cwd, ["show", sha + ":" + file])) : null;
}
function readMany(cwd, sha, files) {
  const p = spawnSync("git", ["cat-file", "--batch"], { cwd, input: files.map(f => sha + ":" + f).join("\n") + "\n", maxBuffer: 4e6 });
  if (p.error || p.status !== 0) throw new Error("Lectura de cadena falló");
  const values = new Map();
  let offset = 0;
  for (const file of files) {
    const end = p.stdout.indexOf(10, offset);
    if (end < 0) throw new Error("Respuesta Git incompleta");
    const header = p.stdout.subarray(offset, end).toString("utf8");
    offset = end + 1;
    if (header.endsWith(" missing")) throw new Error("Fichero de cadena ausente");
    const size = Number(header.split(" ").at(-1));
    if (!Number.isSafeInteger(size) || size < 0 || offset + size >= p.stdout.length) throw new Error("Respuesta Git inválida");
    values.set(file, JSON.parse(p.stdout.subarray(offset, offset + size).toString("utf8")));
    offset += size + 1;
  }
  return values;
}
function latest(cwd, ref) {
  git(cwd, ["fetch", "--quiet", "--no-tags", "origin", "refs/heads/" + CHANNEL_BRANCH + ":" + ref]);
  return git(cwd, ["rev-parse", ref]);
}
function taskPath(id, name) { return prefix + "/tasks/" + validId(id) + "/" + name + ".json"; }
function state(cwd, sha, id) {
  return { task: read(cwd, sha, taskPath(id, "task")), claim: read(cwd, sha, taskPath(id, "claim")), result: read(cwd, sha, taskPath(id, "result")) };
}
export function listPending(cwd, actor) {
  if (!actors.includes(actor)) throw new Error("Agente desconocido");
  const ref = "refs/aely-channel/" + randomUUID();
  try {
    const sha = latest(cwd, ref);
    const files = git(cwd, ["ls-tree", "-r", "--name-only", sha, "--", prefix + "/tasks"]).split("\n");
    return files.filter(f => f.endsWith("/task.json")).map(f => read(cwd, sha, f))
      .filter(t => t.to === actor).map(t => state(cwd, sha, t.id))
      .filter(s => !s.claim && !s.result).map(s => s.task);
  } finally { git(cwd, ["update-ref", "-d", ref]); }
}
export function prepareOperation(cwd, sha, operation) {
  const { type, actor, sessionId, taskId, payload = {} } = operation;
  if (!actors.includes(actor)) throw new Error("Agente desconocido");
  validId(sessionId);
  publicData(operation);
  validateRelayOperation(cwd, sha, operation);
  let file, value;
  const current = taskId ? state(cwd, sha, taskId) : null;
  if (type === "task") {
    if (actor !== "codex") throw new Error("Solo el coordinador crea encargos");
    if (current.task) return { status: "exists", task: current.task };
    if (!actors.includes(payload.to) || !/^[a-f0-9]{40}$/.test(payload.baseSHA || "") || typeof payload.objective !== "string" || !payload.objective.trim() || !Array.isArray(payload.scope)) throw new Error("Encargo incompleto");
    file = taskPath(taskId, "task");
    value = { schema: 1, id: taskId, from: actor, coordinatorSession: sessionId, createdAt: new Date().toISOString(), ...payload };
    // El encargo no puede sustituir su identidad ni autor mediante campos del payload.
    if (value.id !== taskId || value.from !== actor || value.schema !== 1) throw new Error("Payload cambia identidad");
  } else if (type === "claim") {
    if (!current.task || current.task.to !== actor) throw new Error("Encargo inexistente o de otro agente");
    if (current.result) return { status: "closed", result: current.result };
    if (current.claim) return { status: current.claim.sessionId === sessionId ? "owned" : "busy", claim: current.claim };
    file = taskPath(taskId, "claim");
    value = { schema: 1, taskId, actor, sessionId, createdAt: new Date().toISOString(), baseSHA: current.task.baseSHA };
  } else if (type === "result") {
    if (!current.claim || current.claim.actor !== actor || current.claim.sessionId !== sessionId) throw new Error("La sesión no tiene la reserva");
    if (current.result) return { status: "closed", result: current.result };
    if (!["done", "blocked", "cancelled"].includes(payload.status) || !Array.isArray(payload.tests) || typeof payload.summary !== "string") throw new Error("Resultado incompleto");
    file = taskPath(taskId, "result");
    value = { ...payload, schema: 1, taskId, actor, sessionId, createdAt: new Date().toISOString(), released: true };
  } else if (type === "message") {
    validId(payload.id);
    if (!actors.includes(payload.to) || typeof payload.body !== "string") throw new Error("Mensaje incompleto");
    file = prefix + "/messages/" + actor + "/" + payload.id + ".json";
    const existing = read(cwd, sha, file);
    if (existing) return { status: "exists", message: existing };
    value = { ...payload, schema: 1, from: actor, sessionId, createdAt: new Date().toISOString() };
  } else throw new Error("Operación desconocida");
  publicData(value);
  return { status: "prepared", file, value };
}
export function publishOperation(cwd, operation) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aely-channel-"));
  const ref = "refs/aely-channel/" + randomUUID();
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, "index") };
  try {
    // Cada intento parte del remoto y vuelve a comprobar la reserva; nunca se rebasea una reclamación ciega.
    for (let attempt = 0; attempt < 2; attempt++) {
      const base = latest(cwd, ref);
      const prepared = prepareOperation(cwd, base, operation);
      if (prepared.status !== "prepared") return prepared;
      git(cwd, ["read-tree", base], { env });
      const body = JSON.stringify(prepared.value, null, 2) + "\n";
      const blob = git(cwd, ["hash-object", "-w", "--stdin"], { input: body });
      git(cwd, ["update-index", "--add", "--cacheinfo", "100644," + blob + "," + prepared.file], { env });
      const tree = git(cwd, ["write-tree"], { env });
      const commit = git(cwd, ["-c", "user.name=Aely coordination", "-c", "user.email=coordination@users.noreply.github.com", "commit-tree", tree, "-p", base, "-m", "coord: " + operation.type + " " + (operation.taskId || prepared.value.id)], { env });
      const pushed = spawnSync("git", ["push", "--quiet", "origin", commit + ":refs/heads/" + CHANNEL_BRANCH], { cwd, encoding: "utf8" });
      const head = latest(cwd, ref);
      const confirmed = read(cwd, head, prepared.file);
      if (JSON.stringify(confirmed) === JSON.stringify(prepared.value)) return { status: "published", commit, head, file: prepared.file, value: confirmed };
      if (head === base || (pushed.status === 0 && !confirmed)) throw new Error("Publicación no confirmada; revisar acceso/red antes de reintentar");
    }
    throw new Error("Dos avances simultáneos del canal: reintento agotado");
  } finally {
    git(cwd, ["update-ref", "-d", ref]);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    const result = command === "pending" ? listPending(process.cwd(), process.argv[3]) :
      command === "publish" ? publishOperation(process.cwd(), JSON.parse(fs.readFileSync(process.argv[3], "utf8"))) :
      (() => { throw new Error("Uso: coordination-channel.mjs pending <agente> | publish <operación.json>"); })();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
