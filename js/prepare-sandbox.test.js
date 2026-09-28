const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepareSandbox } = require("../scripts/prepare-sandbox-deploy.js");

const root = path.join(__dirname, "..");

test("sandbox prepare keeps the production Worker binding and origin", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-prep-"));
  fs.mkdirSync(path.join(dir, "worker"));
  fs.copyFileSync(path.join(root, "site.config.json"), path.join(dir, "site.config.json"));
  fs.copyFileSync(path.join(root, "worker/wrangler.toml"), path.join(dir, "worker/wrangler.toml"));
  prepareSandbox(dir, {
    workerBaseUrl: "https://voa-lle-unlock-sandbox.example-sub.workers.dev",
    unlockPublicKey: "A".repeat(44),
    monthlyProductId: "PROD_monthlytest",
    quarterlyProductId: "PROD_quarterlytest",
  });
  const config = JSON.parse(fs.readFileSync(path.join(dir, "site.config.json"), "utf8"));
  assert.equal(config.origin, "https://sandbox.eachsound.pages.dev");
  assert.equal(config.payment.worker.baseUrl, "https://voa-lle-unlock-sandbox.example-sub.workers.dev");
  assert.equal(config.payment.pancake.monthlyProductId, "PROD_monthlytest");
  const wrangler = fs.readFileSync(path.join(dir, "worker/wrangler.toml"), "utf8");
  assert.match(wrangler, /id = "84110c8900934ac6abe4841117e9d8a3"/);
  assert.match(wrangler, /ALLOWED_ORIGIN = "https:\/\/1019666077-bit.github.io\/wx-extract-mvp"/);
  const sandbox = wrangler.slice(wrangler.indexOf("[env.sandbox.vars]"));
  assert.match(sandbox, /PANCAKE_PRODUCT_MONTHLY = "PROD_monthlytest"/);
  assert.match(sandbox, /PANCAKE_PRODUCT_QUARTERLY = "PROD_quarterlytest"/);
  assert.match(sandbox, /ALLOWED_ORIGIN = "https:\/\/sandbox.eachsound.pages.dev"/);
  assert.match(sandbox, /id = "49aac2630d6b4030bbbd739bcbe707eb"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("sandbox prepare CLI refuses without SANDBOX_DEPLOY", () => {
  const result = spawnSync("node", ["scripts/prepare-sandbox-deploy.js"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SANDBOX_DEPLOY=1/);
});
