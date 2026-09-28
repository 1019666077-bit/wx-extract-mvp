const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { issueManualCredential, formatIssued } = require("../scripts/issue-credential.js");

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

test("manual credential verifies in the browser and the script has no default key", async () => {
  const { verifyCredential, base64UrlToBytes } = await import("./credential.js");
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const privateKey = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey)));
  const publicKey = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey)));
  const now = new Date("2026-09-28T00:00:00.000Z");
  const issued = await issueManualCredential({
    privateKey,
    orderId: "wechat-20240901",
    plan: "monthly",
    days: 30,
    now,
    origin: "https://lessons.example",
    note: "checked offline",
  });
  const verified = await verifyCredential(issued.token, publicKey, now);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.plan, "monthly");
  assert.equal(verified.payload.expiresAt, "2026-10-28T00:00:00.000Z");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(issued.token.split(".")[0])));
  assert.deepEqual(Object.keys(payload).sort(), ["expiresAt", "issuedAt", "orderId", "plan"]);
  assert.equal(payload.note, undefined);
  assert.equal(issued.url, `https://lessons.example/pricing.html?credential=${encodeURIComponent(issued.token)}`);
  const printed = formatIssued(issued);
  assert.match(printed, /https:\/\/lessons\.example\/pricing\.html\?credential=/);
  assert.equal(printed.includes(privateKey), false);

  await assert.rejects(
    () =>
      issueManualCredential({
        privateKey: "  ",
        orderId: "wechat-20240901",
        plan: "monthly",
        days: 30,
        now,
        origin: "https://lessons.example",
      }),
    /UNLOCK_PRIVATE_KEY is not set/
  );

  const source = fs.readFileSync(path.join(__dirname, "../scripts/issue-credential.js"), "utf8");
  assert.equal(source.includes("BEGIN PRIVATE"), false);
  assert.equal(/UNLOCK_PRIVATE_KEY\s*=\s*["'][A-Za-z0-9+/=]{20,}/.test(source), false);

  const env = { ...process.env, UNLOCK_PRIVATE_KEY: "" };
  const run = spawnSync(
    process.execPath,
    ["scripts/issue-credential.js", "--order", "wechat-20240901", "--plan", "monthly", "--days", "30"],
    { cwd: path.join(__dirname, ".."), env, encoding: "utf8" }
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /UNLOCK_PRIVATE_KEY is not set/);
  assert.equal(run.stdout, "");
});
