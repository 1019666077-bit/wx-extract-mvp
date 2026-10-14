#!/usr/bin/env node
// Rewrites the working tree for a sandbox Pages build and the wrangler
// sandbox environment. Refuses to run unless SANDBOX_DEPLOY=1. Never commit
// the result: product ids and the sandbox origin must stay out of git.
const fs = require("node:fs");
const path = require("node:path");

const SANDBOX_ORIGIN = "https://sandbox.eachsound.pages.dev";

function replaceInSection(text, header, key, value) {
  const start = text.indexOf(header);
  if (start < 0) {
    throw new Error(`worker/wrangler.toml is missing ${header}`);
  }
  const rest = text.slice(start + header.length);
  const next = rest.search(/\n\[/);
  const end = next < 0 ? text.length : start + header.length + next;
  const section = text.slice(start, end);
  const pattern = new RegExp(`^${key} = ".*"$`, "m");
  if (!pattern.test(section)) {
    throw new Error(`worker/wrangler.toml sandbox section is missing ${key}`);
  }
  if (/["\n\r]/.test(value)) {
    throw new Error(`sandbox ${key} contains a character that cannot go in wrangler.toml`);
  }
  const updated = section.replace(pattern, `${key} = "${value}"`);
  return text.slice(0, start) + updated + text.slice(end);
}

function prepareSandbox(root, options) {
  const origin = options.origin || SANDBOX_ORIGIN;
  if (origin !== SANDBOX_ORIGIN) {
    throw new Error("sandbox origin must stay https://sandbox.eachsound.pages.dev");
  }
  const workerBase = String(options.workerBaseUrl || "").replace(/\/+$/, "");
  if (!/^https:\/\/voa-lle-unlock-sandbox\.[a-z0-9-]+\.workers\.dev$/.test(workerBase)) {
    throw new Error("sandbox worker URL is not the voa-lle-unlock-sandbox workers.dev host");
  }
  const publicKey = String(options.unlockPublicKey || "");
  if (!/^[A-Za-z0-9+/=]+$/.test(publicKey) || publicKey.length < 40 || publicKey.length > 200) {
    throw new Error("sandbox unlock public key is not one-line SPKI base64");
  }
  for (const [label, value] of [
    ["monthly", options.monthlyProductId],
    ["quarterly", options.quarterlyProductId],
  ]) {
    if (!/^PROD_[A-Za-z0-9]+$/.test(String(value || ""))) {
      throw new Error(`sandbox ${label} product id is not a PROD_ id`);
    }
  }

  const configPath = path.join(root, "site.config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.origin = origin;
  config.payment.worker.baseUrl = workerBase;
  config.payment.worker.unlockPublicKey = publicKey;
  config.payment.pancake.monthlyProductId = options.monthlyProductId;
  config.payment.pancake.quarterlyProductId = options.quarterlyProductId;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const wranglerPath = path.join(root, "worker", "wrangler.toml");
  let wrangler = fs.readFileSync(wranglerPath, "utf8");
  wrangler = replaceInSection(wrangler, "[env.sandbox.vars]", "PANCAKE_PRODUCT_MONTHLY", options.monthlyProductId);
  wrangler = replaceInSection(wrangler, "[env.sandbox.vars]", "PANCAKE_PRODUCT_QUARTERLY", options.quarterlyProductId);
  wrangler = replaceInSection(wrangler, "[env.sandbox.vars]", "ALLOWED_ORIGIN", origin);
  fs.writeFileSync(wranglerPath, wrangler);
  return { origin, workerBase };
}

if (require.main === module) {
  if (process.env.SANDBOX_DEPLOY !== "1") {
    console.error("Refusing to rewrite the site. Set SANDBOX_DEPLOY=1 only in the sandbox workflow.");
    process.exit(1);
  }
  prepareSandbox(path.resolve(__dirname, ".."), {
    workerBaseUrl: process.env.SANDBOX_WORKER_BASE,
    unlockPublicKey: process.env.SANDBOX_PUBLIC_KEY,
    monthlyProductId: process.env.SANDBOX_PRODUCT_30,
    quarterlyProductId: process.env.SANDBOX_PRODUCT_90,
  });
  console.log("prepared sandbox build inputs");
}

module.exports = { prepareSandbox, SANDBOX_ORIGIN };
