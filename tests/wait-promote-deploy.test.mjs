import assert from "node:assert/strict";
import { freshRun, pageMatches, waitPromotedDeploy } from "../scripts/wait-promote-deploy.mjs";

const sha = "54b21925eb53fe50dbc32048151bd57a9834391a";
const url = "https://github.com/JuanjoAvila/Aely/actions/runs/36174101720";
const oldRun = { id: 4, event: "workflow_dispatch", head_sha: sha, head_branch: "main" };
const target = { id: 5, event: "workflow_dispatch", head_sha: sha, head_branch: "main", html_url: url };

assert.equal(freshRun([oldRun, target], sha, new Set([4])), target);
assert.equal(freshRun([{ ...target, head_sha: "otro" }], sha, new Set()), undefined);
assert.throws(() => freshRun([target, { ...target, id: 6 }], sha, new Set()), /varios deploys/);
assert.equal(pageMatches({ version: "4.26.47" },
  'const VERSION = "4.26.47-2026-09-25-54b21925";', "4.26.47", sha), true);
assert.equal(pageMatches({ version: "4.26.47" },
  'const VERSION = "4.26.47-2026-09-25-otro";', "4.26.47", sha), false);

// Reproduce el 25/9: a los diez minutos la suite sigue viva; el deploy verde llega después.
let elapsed = 0, dispatched = false, pagesReads = 0;
const dependencies = {
  sha, version: "4.26.47", now: () => elapsed, pause: async ms => { elapsed += ms; },
  listRuns: async () => dispatched ? [oldRun, target] : [oldRun],
  dispatch: async () => { dispatched = true; },
  getRun: async () => elapsed < 11 * 60000
    ? { ...target, status: "in_progress", conclusion: null }
    : { ...target, status: "completed", conclusion: "success" },
  getPage: async () => {
    pagesReads++;
    return { manifest: { version: "4.26.47" },
      sw: pagesReads === 1 ? 'const VERSION = "4.26.47-2026-09-25-viejo";'
        : 'const VERSION = "4.26.47-2026-09-25-54b21925";' };
  },
  log: () => {},
};
assert.equal((await waitPromotedDeploy(dependencies)).id, target.id);
assert.ok(elapsed > 10 * 60000);
assert.equal(pagesReads, 2);

elapsed = 0; dispatched = false;
await assert.rejects(waitPromotedDeploy({ ...dependencies,
  getRun: async () => ({ ...target, status: "completed", conclusion: "failure" }),
  getPage: async () => { throw new Error("No debe consultar Pages tras un deploy rojo"); },
}), /terminó con failure/);

console.log("✅ wait-promote-deploy: suite lenta, deploy fallido y sello de Pages");
