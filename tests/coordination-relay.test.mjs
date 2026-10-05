import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { prepareOperation, publishOperation, relayHead, relayTaskId, RELAY_OBJECTIVE, RELAY_SCOPE } from "../scripts/coordination-channel.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const temporary = fs.mkdtempSync(path.join(directory, "relay-test-"));
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }
function same(actual, expected) { assert.deepEqual(actual, expected); assertions++; }
function rejects(operation, pattern) { assert.throws(() => prepareOperation(repo, head(), operation), pattern); assertions++; }
function git(cwd, args, input) {
  const p = spawnSync("git", args, { cwd, input, encoding: "utf8", maxBuffer: 4e6 });
  if (p.status !== 0) throw new Error(args[0] + ": " + p.stderr);
  return p.stdout.trim();
}
const remote = path.join(temporary, "remote.git");
const repo = path.join(temporary, "repo");
const runA = "relay-run-aaaaaaaa";
const runB = "relay-run-bbbbbbbb";
const runC = "relay-run-cccccccc";
const runD = "relay-run-dddddddd";
const runE = "relay-run-eeeeeeee";
const runF = "relay-run-ffffffff";
const head = () => git(repo, ["rev-parse", "refs/remotes/origin/codex/coordinacion"]);
const operation = (type, generation, sessionId, payload = {}) => ({ type, actor: "codex", sessionId, taskId: relayTaskId(generation), payload });
const task = (generation, sessionId) => operation("task", generation, sessionId, { kind: "coordinator-relay", previousTaskId: generation === 1 ? null : relayTaskId(generation - 1), to: "codex", baseSHA: head(), scope: RELAY_SCOPE, objective: RELAY_OBJECTIVE });
const checkpoint = () => ({ schema: 1, channelSHA: head(), lastGrokComment: "123456", pendingTasks: ["worker-example"], inputState: { suggestions: "blocked", errors: "blocked", beta: "unknown" }, nextAction: "reconcile" });
const result = (generation, sessionId) => operation("result", generation, sessionId, { status: "done", summary: "Relevo verificado", tests: [], checkpoint: checkpoint() });
function publish(op) { const value = publishOperation(repo, op); git(repo, ["fetch", "origin", "codex/coordinacion"]); return value; }
// El conector debe preparar contra el mismo padre y no mezclar el parche viejo sobre un padre nuevo.
function connectorCommit(prepared, base, label) {
  const index = path.join(temporary, "index-" + label);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  function local(args, input) {
    const p = spawnSync("git", args, { cwd: repo, env, input, encoding: "utf8" });
    if (p.status !== 0) throw new Error(p.stderr);
    return p.stdout.trim();
  }
  local(["read-tree", base]);
  const blob = local(["hash-object", "-w", "--stdin"], JSON.stringify(prepared.value) + "\n");
  local(["update-index", "--add", "--cacheinfo", "100644," + blob + "," + prepared.file]);
  return local(["commit-tree", local(["write-tree"]), "-p", base, "-m", label]);
}
try {
  fs.mkdirSync(repo);
  git(temporary, ["init", "--bare", remote]);
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "Synthetic relay test"]);
  git(repo, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(repo, "README.md"), "Synthetic fixture\n");
  git(repo, ["add", "README.md"]);
  git(repo, ["commit", "-m", "fixture"]);
  git(repo, ["remote", "add", "origin", remote]);
  git(repo, ["push", "origin", "HEAD:refs/heads/codex/coordinacion"]);
  git(repo, ["fetch", "origin", "codex/coordinacion"]);
  const worker = { type: "task", actor: "codex", sessionId: "worker-owner", taskId: "worker-example", payload: { to: "claude", baseSHA: head(), objective: "Synthetic worker", scope: ["scripts"] } };
  same(publish(worker).status, "published");
  const workerClaim = { type: "claim", actor: "claude", sessionId: "claude-example", taskId: "worker-example" };
  same(publish(workerClaim).status, "published");
  same(relayHead(repo, head()).generation, 0);
  rejects({ ...worker, sessionId: runA, taskId: "worker-before-relay" }, /relevo activo/);
  const first = task(1, runA);
  const noPrevious = structuredClone(first); delete noPrevious.payload.previousTaskId;
  rejects(noPrevious, /Predecesor/);
  const privateSession = structuredClone(first); privateSession.sessionId = "01a10c5a-0bab-711f-8fb6-e886e9743061";
  rejects(privateSession, /nonce/);
  rejects(task(2, runB), /bloqueada/);
  same(publish(first).status, "published");
  same(publish(task(1, runB)).status, "exists");
  same(publish(operation("claim", 1, runA)).status, "published");
  same(publish(operation("claim", 1, runA)).status, "owned");
  same(publish(operation("claim", 1, runB)).status, "busy");
  rejects(task(2, runB), /bloqueada/);
  rejects(task(2, runA), /bloqueada/);
  rejects(operation("claim", 2, runB), /no liberado/);
  rejects(task(3, runA), /bloqueada/);
  const branch = task(2, runA); branch.payload.previousTaskId = null;
  rejects(branch, /Predecesor/);
  const privateCheckpoint = result(1, runA); privateCheckpoint.payload.checkpoint.chatId = "private-example";
  rejects(privateCheckpoint, /Campos/);
  const money = result(1, runA); money.payload.checkpoint.nextAction = "saldo 12 EUR";
  rejects(money, /acción/);
  const tooLarge = result(1, runA); tooLarge.payload.checkpoint.pendingTasks = Array.from({ length: 100 }, (_, i) => "worker-" + i + "a".repeat(50));
  rejects(tooLarge, /demasiado grande/);
  const nonexistent = result(1, runA); nonexistent.payload.checkpoint.pendingTasks = ["private-fake-task"];
  rejects(nonexistent, /inexistente/);
  const wrongOwner = result(1, runB);
  rejects(wrongOwner, /reserva/);
  const falseRelease = result(1, runA); falseRelease.payload.released = false;
  rejects(falseRelease, /Campos/);
  const nonexistentSHA = result(1, runA); nonexistentSHA.payload.checkpoint.channelSHA = "f".repeat(40);
  rejects(nonexistentSHA, /SHA de checkpoint/);
  const unrelatedCommit = git(repo, ["commit-tree", git(repo, ["rev-parse", "HEAD^{tree}"]), "-m", "unrelated"]);
  const unrelatedSHA = result(1, runA); unrelatedSHA.payload.checkpoint.channelSHA = unrelatedCommit;
  rejects(unrelatedSHA, /SHA de checkpoint/);
  const relayWorker = { ...worker, sessionId: runA, taskId: "worker-relay" };
  same(publish(relayWorker).status, "published");
  const codexWorker = { ...relayWorker, taskId: "worker-codex", payload: { ...relayWorker.payload, to: "codex" } };
  same(publish(codexWorker).status, "published");
  const codexClaim = { type: "claim", actor: "codex", sessionId: runA, taskId: codexWorker.taskId };
  same(publish(codexClaim).status, "published");
  const codexResult = { type: "result", actor: "codex", sessionId: runA, taskId: codexWorker.taskId, payload: { status: "done", tests: [], summary: "Synthetic result" } };
  same(publish(codexResult).status, "published");
  const relayMessage = { type: "message", actor: "codex", sessionId: runA, payload: { id: "relay-worker-msg", to: "grok", body: "Synthetic instruction" } };
  same(publish(relayMessage).status, "published");
  const firstClose = result(1, runA);
  same(publish({ ...relayMessage, payload: { ...relayMessage.payload, id: "unrelated-advance" } }).status, "published");
  same(publish(firstClose).status, "published");
  same(publish(operation("claim", 1, runA)).status, "closed");
  same(publish(result(1, runA)).status, "closed");
  rejects({ ...relayWorker, taskId: "worker-after-close" }, /relevo activo/);
  rejects({ ...relayMessage, payload: { ...relayMessage.payload, id: "after-close-msg" } }, /relevo activo/);
  rejects(codexClaim, /relevo activo/);
  rejects(codexResult, /relevo activo/);
  same(publish(task(2, runB)).status, "published");
  rejects(operation("claim", 2, runA), /Nonce.*reutilizado/);
  same(publish(operation("claim", 2, runB)).status, "published");
  rejects(task(3, runB), /bloqueada/);
  rejects({ ...relayWorker, taskId: "worker-stale-nonce" }, /relevo activo/);
  same(publish(result(2, runB)).status, "published");
  same(publish(task(3, runC)).status, "published");
  const base = head();
  const aspirantA = prepareOperation(repo, base, operation("claim", 3, runD));
  const aspirantC = prepareOperation(repo, base, operation("claim", 3, runC));
  same(aspirantA.status, "prepared"); same(aspirantC.status, "prepared");
  const commitA = connectorCommit(aspirantA, base, "aspirant-a");
  const commitC = connectorCommit(aspirantC, base, "aspirant-c");
  git(repo, ["push", "origin", commitA + ":refs/heads/codex/coordinacion"]);
  const conflict = spawnSync("git", ["push", "origin", commitC + ":refs/heads/codex/coordinacion"], { cwd: repo, encoding: "utf8" });
  check(conflict.status !== 0, "Solo un aspirante puede avanzar el remoto");
  git(repo, ["fetch", "origin", "codex/coordinacion"]);
  same(prepareOperation(repo, head(), operation("claim", 3, runC)).status, "busy");
  same(publish(operation("claim", 3, runD)).status, "owned");
  same(publish(result(3, runD)).status, "published");
  // Corte entre cierre y creación siguiente: reconstruir desde Git basta, sin artefacto privado previo.
  const recovered = relayHead(repo, head());
  same(recovered.generation, 3); same(recovered.result.released, true);
  same(recovered.result.checkpoint.pendingTasks, ["worker-example"]);
  same(publish(task(recovered.generation + 1, runC)).status, "published");
  const RealDate = globalThis.Date;
  try {
    globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ["1970-01-01T00:00:00Z"])); } };
    same(publish(operation("claim", 4, runC)).status, "published");
  } finally { globalThis.Date = RealDate; }
  rejects(task(5, runC), /bloqueada/);
  // Cortar después de reservar no convierte el reloj en permiso para ocupar el siguiente relevo.
  rejects(operation("claim", 5, runA), /no liberado/);
  same(publish(operation("claim", 4, runA)).status, "busy");
  same(publish(workerClaim).status, "owned");
  same(git(repo, ["show", head() + ":coordination/tasks/worker-example/claim.json"]).includes("claude-example"), true);
  check(relayHead(repo, head()).task.id === relayTaskId(4), "No existe sucesor antes de liberar");
  rejects(task(7, runC), /bloqueada/);
  const badPrefix = task(6, runC); badPrefix.taskId = "coordinator-relay-fork";
  rejects(badPrefix, /Identidad/);
  same(publish(result(4, runC)).status, "published");
  same(publish(task(5, runB)).status, "published");
  const retryBase = head();
  const winner = prepareOperation(repo, retryBase, operation("claim", 5, runE));
  const winnerCommit = connectorCommit(winner, retryBase, "winner-before-push");
  git(repo, ["push", "origin", winnerCommit + ":refs/test-race/winner"]);
  const hook = path.join(repo, ".git", "hooks", "pre-push");
  const marker = path.join(temporary, "race-fired").replaceAll("\\", "/");
  const barePath = remote.replaceAll("\\", "/");
  fs.writeFileSync(hook, '#!/bin/sh\nif [ ! -f "' + marker + '" ]; then\n  : > "' + marker + '"\n  git --git-dir="' + barePath + '" update-ref refs/heads/codex/coordinacion ' + winnerCommit + ' ' + retryBase + '\nfi\n', { mode: 0o755 });
  try {
    // El primer push pierde; el segundo intento vuelve a validar y devuelve busy, nunca sobreescribe.
    same(publish(operation("claim", 5, runF)).status, "busy");
    check(fs.existsSync(marker), "Se inyectó una carrera real en el primer push");
  } finally { fs.rmSync(hook, { force: true }); }
  same(relayHead(repo, head()).claim.sessionId, runE);
  const corrupt = prepareOperation(repo, head(), result(5, runE));
  corrupt.value.released = false;
  const corruptCommit = connectorCommit(corrupt, head(), "corrupt-fixture");
  git(repo, ["push", "origin", corruptCommit + ":refs/heads/codex/coordinacion"]);
  git(repo, ["fetch", "origin", "codex/coordinacion"]);
  assert.throws(() => relayHead(repo, head()), /Cierre de relevo inválido/); assertions++;
  console.log(JSON.stringify({ status: "passed", assertions, coverage: ["predecessor", "no-skips", "release-before-successor", "two-aspirants-CAS", "publisher-race-revalidation", "owned-retry", "closed-immutable", "recovery-after-release", "no-clock-takeover", "checkpoint-ancestor", "checkpoint-survives-unrelated-advance", "coordinator-worker-fence-all-types", "unique-run-nonce", "worker-claim-preserved", "corrupt-close-fails-closed"] }));
} finally {
  const resolved = path.resolve(temporary);
  if (!resolved.startsWith(path.resolve(directory) + path.sep)) throw new Error("Temporal fuera de tests");
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
