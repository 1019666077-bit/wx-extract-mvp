#!/usr/bin/env node
// Deploys the sandbox Worker and a non-production Pages branch.
// Secrets come from the environment. This script does not print them.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepareSandbox, SANDBOX_ORIGIN } = require("./prepare-sandbox-deploy.js");

const root = path.resolve(__dirname, "..");
const WORKER_NAME = "voa-lle-unlock-sandbox";
const WEBHOOK_EVENTS = ["order.completed", "refund.succeeded", "refund.failed"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    fail(`missing ${name}`);
  }
  return value;
}

function safeText(text) {
  return String(text)
    .replace(/[A-Za-z0-9+/=_-]{24,}/g, "[redacted]")
    .slice(0, 400);
}

function normalizePem(text) {
  let value = String(text || "").trim();
  if (value.includes("\\n") && value.includes("BEGIN")) {
    value = value.replace(/\\n/g, "\n");
  }
  return `${value}\n`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: process.env,
    encoding: "utf8",
    input: options.input,
    stdio: options.input == null ? "inherit" : ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    if (options.input != null) {
      console.error(safeText(result.stdout || ""));
      console.error(safeText(result.stderr || ""));
    }
    fail(`${command} ${args.join(" ")} failed`);
  }
  return result;
}

function workersSubdomain(token, accountId) {
  const result = spawnSync(
    "curl",
    [
      "-sS",
      "-H",
      `Authorization: Bearer ${token}`,
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    console.error(safeText(result.stderr || ""));
    fail("could not read the workers.dev subdomain");
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail("workers.dev subdomain response was not JSON");
  }
  const subdomain = parsed && parsed.result && parsed.result.subdomain;
  if (!parsed.success || !/^[a-z0-9-]+$/.test(subdomain || "")) {
    fail("workers.dev subdomain was not available");
  }
  return subdomain;
}

function generateUnlockKey() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "unlock-"));
  const pem = path.join(dir, "private.pem");
  const pubPem = path.join(dir, "public.pem");
  run("openssl", ["genpkey", "-algorithm", "ED25519", "-out", pem]);
  const pubOut = spawnSync("openssl", ["pkey", "-in", pem, "-pubout"], { encoding: "utf8" });
  if (pubOut.status !== 0) {
    fail("could not derive the unlock public key");
  }
  fs.writeFileSync(pubPem, pubOut.stdout);
  const priv = spawnSync(
    "openssl",
    ["pkcs8", "-topk8", "-inform", "PEM", "-outform", "DER", "-nocrypt", "-in", pem],
    { encoding: "buffer" }
  );
  const pub = spawnSync("openssl", ["pkey", "-pubin", "-in", pubPem, "-outform", "DER"], { encoding: "buffer" });
  fs.rmSync(dir, { recursive: true, force: true });
  if (priv.status !== 0 || pub.status !== 0) {
    fail("could not encode the unlock key");
  }
  return {
    privateKey: priv.stdout.toString("base64"),
    publicKey: pub.stdout.toString("base64"),
  };
}

function wranglerArgs(args) {
  return ["--yes", "wrangler@3", ...args];
}

function putSecret(name, value) {
  const result = spawnSync(
    "npx",
    wranglerArgs(["secret", "put", name, "--env", "sandbox"]),
    {
      cwd: path.join(root, "worker"),
      env: process.env,
      encoding: "utf8",
      input: value.endsWith("\n") ? value : `${value}\n`,
    }
  );
  if (result.status !== 0) {
    console.error(safeText(result.stderr || result.stdout || ""));
    fail(`could not set Worker secret ${name}`);
  }
  console.log(`set Worker secret ${name}`);
}

async function signedPost(env, requestPath, bodyObject) {
  const { canonicalRequest, importRsaPrivateKey, sha256Base64, signRsaSha256 } = await import(
    "../worker/src/waffo.js"
  );
  const body = JSON.stringify(bodyObject);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const privateKey = await importRsaPrivateKey(env.apiKey);
  const signature = await signRsaSha256(
    privateKey,
    canonicalRequest("POST", requestPath, timestamp, await sha256Base64(body))
  );
  const response = await fetch(`https://api.waffo.ai${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Merchant-Id": env.merchantId,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body,
  });
  const raw = await response.text();
  return { status: response.status, raw };
}

async function registerWebhook(env, webhookUrl) {
  const posted = await signedPost(env, "/v1/actions/store/add-webhook", {
    storeId: env.storeId,
    channel: "http",
    url: webhookUrl,
    events: WEBHOOK_EVENTS,
    testMode: true,
  });
  console.log(`add-webhook status ${posted.status}`);
  if (posted.status >= 200 && posted.status < 300) {
    console.log(`registered test webhook ${webhookUrl}`);
    return;
  }
  console.error(safeText(posted.raw));
  fail("could not register the test webhook");
}

async function main() {
  const token = required("CLOUDFLARE_API_TOKEN");
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const merchantId = required("PANCAKE_MERCHANT_ID");
  const apiKey = required("PANCAKE_TEST_API_KEY");
  const webhookKey = required("PANCAKE_TEST_WEBHOOK_PUBLIC_KEY");
  const product30 = required("PANCAKE_TEST_PRODUCT_30_ID");
  const product90 = required("PANCAKE_TEST_PRODUCT_90_ID");
  const storeId = required("PANCAKE_TEST_STORE_ID");
  if (!/^MER_[A-Za-z0-9]+$/.test(merchantId)) {
    fail("PANCAKE_MERCHANT_ID is not a MER_ id");
  }
  if (!/^STO_[A-Za-z0-9]+$/.test(storeId)) {
    fail("PANCAKE_TEST_STORE_ID is not a STO_ id");
  }
  if (!/^PROD_[A-Za-z0-9]+$/.test(product30) || !/^PROD_[A-Za-z0-9]+$/.test(product90)) {
    fail("a Pancake test product id is not a PROD_ id");
  }
  console.log(
    `sandbox secret shapes ok apiKeyLength=${apiKey.length} webhookKeyLength=${webhookKey.length} apiKeyPem=${apiKey.includes("BEGIN")}`
  );

  const subdomain = workersSubdomain(token, accountId);
  const workerBase = `https://${WORKER_NAME}.${subdomain}.workers.dev`;
  const keys = generateUnlockKey();
  process.env.SANDBOX_DEPLOY = "1";
  prepareSandbox(root, {
    workerBaseUrl: workerBase,
    unlockPublicKey: keys.publicKey,
    monthlyProductId: product30,
    quarterlyProductId: product90,
  });
  run("node", ["scripts/build-pages.js"]);
  run("node", ["scripts/stage-pages.js"]);
  run("npx", wranglerArgs(["deploy", "--env", "sandbox"]), { cwd: path.join(root, "worker") });
  putSecret("WAFFO_PANCAKE_API_KEY", normalizePem(apiKey));
  putSecret("WAFFO_PANCAKE_MERCHANT_ID", merchantId);
  putSecret("WAFFO_WEBHOOK_PUBLIC_KEY", normalizePem(webhookKey));
  putSecret("UNLOCK_PRIVATE_KEY", keys.privateKey);
  const webhookUrl = `${workerBase}/api/waffo/webhook`;
  await registerWebhook({ apiKey: normalizePem(apiKey).trim(), merchantId, storeId }, webhookUrl);
  run("npx", wranglerArgs([
    "pages",
    "deploy",
    "dist",
    "--project-name=eachsound",
    "--branch=sandbox",
    "--commit-dirty=true",
  ]));
  console.log(`sandbox worker ${workerBase}`);
  console.log(`sandbox webhook ${webhookUrl}`);
  console.log(`sandbox pages ${SANDBOX_ORIGIN}`);
}

main().catch((error) => {
  console.error(safeText(error && error.message ? error.message : error));
  process.exit(1);
});
