const test = require("node:test");
const assert = require("node:assert/strict");

async function keysAndApi() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const api = await import("./credential.js");
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const bytes = new Uint8Array(spki);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { privateKey: pair.privateKey, publicKey: btoa(binary), ...api };
}

const payload = {
  orderId: "m1234567890abcdef1234567890abcd",
  plan: "monthly",
  issuedAt: "2026-09-04T02:00:00.000Z",
  expiresAt: "2026-10-04T02:00:00.000Z",
};

test("front-end verifier accepts a signed credential and rejects tampering or expiry", async () => {
  const { privateKey, publicKey, signCredential, verifyCredential } = await keysAndApi();
  const token = await signCredential(privateKey, payload);
  const ok = await verifyCredential(token, publicKey, new Date("2026-09-10T00:00:00.000Z"));
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.plan, "monthly");
  assert.equal(ok.payload.orderId, payload.orderId);

  const tampered = `${token.slice(0, -2)}aa`;
  const bad = await verifyCredential(tampered, publicKey, new Date("2026-09-10T00:00:00.000Z"));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "bad_signature");

  const expired = await verifyCredential(token, publicKey, new Date("2026-10-04T02:00:00.001Z"));
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, "expired");
});
