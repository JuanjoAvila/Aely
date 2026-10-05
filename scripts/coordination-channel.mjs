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
