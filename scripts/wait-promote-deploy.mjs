#!/usr/bin/env node
// El deploy repite toda la suite: el 25/9/2026 seguía probando cuando el promote agotó
// sus diez minutos y marcó rojo una publicación que acabó bien 48 segundos después.
import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const sleep = ms => new Promise(done => setTimeout(done, ms));
const INTERVAL = 15000;

export function freshRun(runs, sha, before) {
  const matches = runs.filter(run => run.event === "workflow_dispatch" && run.head_sha === sha
    && run.head_branch === "main" && !before.has(run.id));
  if (matches.length > 1) throw new Error("Hay varios deploys nuevos para este SHA; no se puede atribuir uno al promote.");
  return matches[0];
}

export function pageMatches(versionJson, sw, version, sha) {
  if (versionJson?.version !== version) return false;
  const stamp = sw.match(/const VERSION = "([^"]+)";/)?.[1] || "";
  return stamp.startsWith(version + "-") && stamp.split("-").at(-1).startsWith(sha.slice(0, 7));
}

export async function waitPromotedDeploy({ sha, version, listRuns, dispatch, getRun, getPage,
  now = Date.now, pause = sleep, log = console.log, interval = INTERVAL }) {
  const before = new Set((await listRuns()).map(run => run.id));
  await dispatch();
  const discoveryDeadline = now() + 120000;
  let run;
  while (!run && now() < discoveryDeadline) {
    run = freshRun(await listRuns(), sha, before);
    if (!run) await pause(interval);
  }
  if (!run) throw new Error(`GitHub no creó el deploy de ${sha} dentro de dos minutos.`);
  log(`Deploy correspondiente: ${run.html_url}`);

  // Un rojo del Action es un fallo real; una suite de diez minutos aún en curso no lo es.
  const runDeadline = now() + 45 * 60000;
  while (now() < runDeadline) {
    run = await getRun(run.id);
    if (run.status === "completed") {
      if (run.conclusion !== "success") {
        throw new Error(`Deploy ${run.html_url} terminó con ${run.conclusion || "conclusión desconocida"}.`);
      }
      break;
    }
    await pause(interval);
  }
  if (run.status !== "completed") throw new Error(`Deploy ${run.html_url} sigue sin terminar tras 45 minutos.`);

  const pagesDeadline = now() + 5 * 60000;
  while (now() < pagesDeadline) {
    try {
      const { manifest, sw } = await getPage();
      if (pageMatches(manifest, sw, version, sha)) return run;
    } catch (error) {
      log(`Pages aún no responde: ${error.message}`);
    }
    await pause(interval);
  }
  throw new Error(`Deploy ${run.html_url} terminó verde, pero Pages no sirve ${version} con sello ${sha.slice(0, 7)}.`);
}

async function command(file, args) {
  const { stdout } = await exec(file, args, { maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "")) throw new Error("Falta GITHUB_REPOSITORY válido.");
  const sha = await command("git", ["rev-parse", "main"]);
  const version = await command("git", ["show", "main:VERSION"]);
  const endpoint = `repos/${repo}/actions/workflows/deploy.yml/runs?event=workflow_dispatch&head_sha=${sha}&per_page=100`;
  const api = async path => JSON.parse(await command("gh", ["api", path]));
  const getText = async url => {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.text();
  };
  const run = await waitPromotedDeploy({
    sha, version,
    listRuns: async () => (await api(endpoint)).workflow_runs,
    dispatch: () => command("gh", ["workflow", "run", "deploy.yml", "--ref", "main"]),
    getRun: id => api(`repos/${repo}/actions/runs/${id}`),
    getPage: async () => {
      const base = `https://${repo.split("/")[0].toLowerCase()}.github.io/${repo.split("/")[1]}/`;
      const nonce = `?promote=${sha}`;
      const [manifest, sw] = await Promise.all([
        getText(base + "version.json" + nonce).then(JSON.parse),
        getText(base + "sw.js" + nonce),
      ]);
      return { manifest, sw };
    },
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `\n✅ [Deploy de ${sha.slice(0, 8)}](${run.html_url}) verde; Pages sirve ${version} y su sello.\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`::error::${error.message}`); process.exitCode = 1; });
}
