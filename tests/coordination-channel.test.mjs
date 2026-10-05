import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { CHANNEL_BRANCH, publishOperation, prepareOperation, listPending } from "../scripts/coordination-channel.mjs";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "aely-channel-test-"));
const bare = path.join(root, "remote.git");
const one = path.join(root, "one"), two = path.join(root, "two");
function git(cwd, ...args) {
  const p = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(p.status, 0, "Git " + args[0] + " falló");
  return p.stdout.trim();
}
const sha = "a".repeat(40);
const task = id => ({ type: "task", actor: "codex", sessionId: "codex-cloud-test", taskId: id, payload: { to: "claude", objective: "Prueba pública sintética", scope: [], baseSHA: sha } });
const claim = (id, session) => ({ type: "claim", actor: "claude", sessionId: session, taskId: id });
const finish = (id, session) => ({ type: "result", actor: "claude", sessionId: session, taskId: id, payload: { status: "done", summary: "Prueba sintética", tests: [] } });
function pushPrepared(cwd, base, prepared) {
  git(cwd, "read-tree", base);
  const p = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd, encoding: "utf8", input: JSON.stringify(prepared.value) });
  assert.equal(p.status, 0);
  git(cwd, "update-index", "--add", "--cacheinfo", "100644," + p.stdout.trim() + "," + prepared.file);
  const tree = git(cwd, "write-tree");
  const commit = git(cwd, "commit-tree", tree, "-p", base, "-m", "synthetic claim race");
  return spawnSync("git", ["push", "origin", commit + ":refs/heads/" + CHANNEL_BRANCH], { cwd, encoding: "utf8" }).status;
}
function concurrentMessage(cwd, id) {
  const source = new URL("../scripts/coordination-channel.mjs", import.meta.url).href;
  const op = { type: "message", actor: "claude", sessionId: "claude-cloud-" + id, payload: { id, to: "codex", body: "Mensaje sintético" } };
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--input-type=module", "-e", `import {publishOperation} from ${JSON.stringify(source)}; console.log(JSON.stringify(publishOperation(process.cwd(), ${JSON.stringify(op)})));`], { cwd });
    let output = "";
    p.stdout.on("data", b => { output += b; });
    p.on("error", reject);
    p.on("close", code => { try { assert.equal(code, 0); resolve(JSON.parse(output)); } catch (e) { reject(e); } });
  });
}
try {
  fs.mkdirSync(one); fs.mkdirSync(two);
  git(root, "init", "--bare", bare);
  git(one, "init");
  git(one, "config", "user.name", "Synthetic"); git(one, "config", "user.email", "synthetic@users.noreply.github.com");
  fs.writeFileSync(path.join(one, "README.md"), "Datos sintéticos\n");
  git(one, "add", "README.md"); git(one, "commit", "-m", "base");
  git(one, "remote", "add", "origin", bare);
  git(one, "push", "origin", "HEAD:refs/heads/" + CHANNEL_BRANCH);
  git(two, "init"); git(two, "remote", "add", "origin", bare);
  git(two, "config", "user.name", "Synthetic"); git(two, "config", "user.email", "synthetic@users.noreply.github.com");
  assert.equal(publishOperation(one, task("same-task")).status, "published");
  assert.equal(listPending(two, "claude").length, 1);
  git(one, "fetch", "origin", "refs/heads/" + CHANNEL_BRANCH);
  git(two, "fetch", "origin", "refs/heads/" + CHANNEL_BRANCH);
  const base = git(one, "rev-parse", "FETCH_HEAD");
  const a = prepareOperation(one, base, claim("same-task", "claude-cloud-a"));
  const b = prepareOperation(two, base, claim("same-task", "claude-cloud-b"));
  assert.equal(pushPrepared(one, base, a), 0);
  assert.notEqual(pushPrepared(two, base, b), 0);
  assert.equal(publishOperation(two, claim("same-task", "claude-cloud-b")).status, "busy");
  assert.equal(listPending(two, "claude").length, 0);
  assert.throws(() => publishOperation(two, finish("same-task", "claude-cloud-b")), /no tiene la reserva/);
  assert.equal(publishOperation(one, finish("same-task", "claude-cloud-a")).status, "published");
  const closedHead = git(bare, "rev-parse", "refs/heads/" + CHANNEL_BRANCH);
  assert.equal(publishOperation(one, finish("same-task", "claude-cloud-a")).status, "closed");
  assert.equal(publishOperation(two, claim("same-task", "claude-cloud-b")).status, "closed");
  assert.equal(git(bare, "rev-parse", "refs/heads/" + CHANNEL_BRANCH), closedHead);
  const messages = await Promise.all([concurrentMessage(one, "message-a"), concurrentMessage(two, "message-b")]);
  assert.ok(messages.every(m => m.status === "published"));
  const files = git(bare, "ls-tree", "-r", "--name-only", "refs/heads/" + CHANNEL_BRANCH);
  assert.ok(files.includes("messages/claude/message-a.json"));
  assert.ok(files.includes("messages/claude/message-b.json"));
  // El helper debe conservar el WIP y el HEAD de quien lo llama, aun al publicar mensajes.
  fs.writeFileSync(path.join(one, "README.md"), "WIP ajeno\n");
  git(one, "add", "README.md");
  const beforeHead = git(one, "rev-parse", "HEAD"), beforeIndex = git(one, "write-tree");
  publishOperation(one, { type: "message", actor: "codex", sessionId: "codex-cloud-test", payload: { id: "wip-safe", to: "claude", body: "Público" } });
  assert.equal(git(one, "rev-parse", "HEAD"), beforeHead);
  assert.equal(git(one, "write-tree"), beforeIndex);
  const final = git(bare, "rev-parse", "refs/heads/" + CHANNEL_BRANCH);
  assert.equal(git(bare, "show", final + ":README.md"), "Datos sintéticos");
  assert.throws(() => publishOperation(one, { ...task("private-task"), payload: { ...task("private-task").payload, objective: "No publicar ghp_synthetic" } }), /privado/);
  assert.throws(() => publishOperation(one, task("../escape")), /no válida/);
  assert.throws(() => publishOperation(one, { ...task("bad-actor"), actor: "claude" }), /coordinador/);
  assert.throws(() => publishOperation(one, { ...task("missing-sha"), payload: { ...task("missing-sha").payload, baseSHA: "beta" } }), /incompleto/);
  console.log("PASS coordination-channel: una reserva, dos mensajes conservados, cierre idempotente, WIP intacto y filtros");
} finally {
  // Solo el temporal recién creado para esta prueba; nunca un checkout del usuario.
  assert.ok(path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith("aely-channel-test-"));
  fs.rmSync(root, { recursive: true, force: true });
}
