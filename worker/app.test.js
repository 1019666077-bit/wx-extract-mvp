const test = require("node:test");
const assert = require("node:assert/strict");

const ORIGIN = "https://1019666077-bit.github.io/wx-extract-mvp";
const MONTHLY_PRODUCT = "PROD_monthlytest";
const QUARTERLY_PRODUCT = "PROD_quarterlytest";

function memoryKv() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
    async delete(key) {
      map.delete(key);
    },
    dump() {
      return map;
    },
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function readDer(bytes, offset) {
  const tag = bytes[offset];
  let length = bytes[offset + 1];
  let start = offset + 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    length = 0;
    for (let i = 0; i < count; i += 1) {
      length = (length << 8) | bytes[start + i];
    }
    start += count;
  }
  return { tag, start, end: start + length };
}

function pkcs1FromPkcs8(bytes) {
  const outer = readDer(bytes, 0);
  const version = readDer(bytes, outer.start);
  const alg = readDer(bytes, version.end);
  const octet = readDer(bytes, alg.end);
  return bytes.slice(octet.start, octet.end);
}

async function exportB64(key, format) {
  const buffer = await crypto.subtle.exportKey(format, key);
  return bytesToBase64(new Uint8Array(buffer));
}

async function generateFixtures() {
  const merchant = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const webhook = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const unlock = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const waffoJs = await import("./src/waffo.js");
  return {
    merchant,
    webhook,
    unlockPublic: unlock.publicKey,
    unlockPrivate: await exportB64(unlock.privateKey, "pkcs8"),
    webhookPublic: await exportB64(webhook.publicKey, "spki"),
    merchantPrivate: await exportB64(merchant.privateKey, "pkcs8"),
    signWebhook: async (body) => waffoJs.signRsaSha256(webhook.privateKey, body),
    verifyRequest: async (body, signature) => waffoJs.verifyRsaSha256(merchant.publicKey, body, signature),
    waffoJs,
  };
}

function envFor(fixtures, kv) {
  return {
    WAFFO_PANCAKE_API_KEY: fixtures.merchantPrivate,
    WAFFO_PANCAKE_MERCHANT_ID: "MER_TESTMERCHANT01",
    WAFFO_WEBHOOK_PUBLIC_KEY: fixtures.webhookPublic,
    UNLOCK_PRIVATE_KEY: fixtures.unlockPrivate,
    WAFFO_API_BASE: "https://api.waffo.ai",
    PANCAKE_MODE: "test",
    PANCAKE_PRODUCT_MONTHLY: MONTHLY_PRODUCT,
    PANCAKE_PRODUCT_QUARTERLY: QUARTERLY_PRODUCT,
    ALLOWED_ORIGIN: ORIGIN,
    TERMS_VERSION: "2026-09-28-norefund",
    ORDERS: kv,
  };
}

function checkoutBody(fields) {
  return JSON.stringify({
    termsAccepted: true,
    termsVersion: "2026-09-28-norefund",
    ...fields,
  });
}

function request(url, { method = "GET", body, origin = ORIGIN, waffoSignature, ip } = {}) {
  const headers = new Headers();
  if (origin) {
    headers.set("Origin", origin);
  }
  if (body) {
    headers.set("Content-Type", "application/json");
  }
  if (waffoSignature) {
    headers.set("X-Waffo-Signature", waffoSignature);
  }
  if (ip) {
    headers.set("CF-Connecting-IP", ip);
  }
  return new Request(url, { method, headers, body });
}

async function signedWebhook(fixtures, event, now) {
  const body = JSON.stringify(event);
  const t = String(now.getTime());
  const signature = await fixtures.signWebhook(`${t}.${body}`);
  return { body, header: `t=${t},v1=${signature}` };
}

function pancakeEvent(eventType, eventId, data, mode = "test") {
  return {
    id: eventId,
    timestamp: "2026-09-28T00:05:00.000Z",
    eventType,
    eventId,
    mode,
    storeId: "STO_teststore",
    data,
  };
}

function sessionResponse() {
  return {
    data: {
      sessionId: "cs_550e8400-e29b-41d4-a716-446655440000",
      checkoutUrl: "https://checkout.waffo.ai/my-store/checkout/cs_550e8400-e29b-41d4-a716-446655440000",
      expiresAt: "2026-09-28T00:45:00.000Z",
    },
  };
}

test("pkcs1 dashboard private key signs the same canonical request as pkcs8", async () => {
  const fixtures = await generateFixtures();
  const { decodeKeyMaterial, importRsaPrivateKey, signRsaSha256, canonicalRequest, sha256Base64 } = fixtures.waffoJs;
  const pkcs1 = pkcs1FromPkcs8(decodeKeyMaterial(fixtures.merchantPrivate));
  const pem = `-----BEGIN RSA PRIVATE KEY-----\n${bytesToBase64(pkcs1)}\n-----END RSA PRIVATE KEY-----`;
  const fromPem = await importRsaPrivateKey(pem);
  const body = JSON.stringify({ productId: MONTHLY_PRODUCT, currency: "USD" });
  const canonical = canonicalRequest("POST", "/v1/actions/checkout/create-session", "1711800000", await sha256Base64(body));
  const signed = await signRsaSha256(fromPem, canonical);
  assert.equal(await fixtures.verifyRequest(canonical, signed), true);
  assert.equal(canonical.split("\n")[0], "POST");
  assert.equal(canonical.split("\n")[1], "/v1/actions/checkout/create-session");
});

test("checkout uses the dashboard product, webhook signature, claim once, refund and ignored subscription", async () => {
  const fixtures = await generateFixtures();
  const { handleRequest } = await import("./src/app.js");
  const { verifyCredential } = await import("../js/credential.js");
  const { canonicalRequest, sha256Base64 } = fixtures.waffoJs;
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  const now = new Date("2026-09-28T00:00:00.000Z");
  let createBody = null;

  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://api.waffo.ai/v1/actions/checkout/create-session");
    assert.equal(init.headers["X-Merchant-Id"], "MER_TESTMERCHANT01");
    assert.equal(init.headers["X-API-KEY"], undefined);
    assert.equal("X-Environment" in init.headers, false);
    const bodyHash = await sha256Base64(init.body);
    const canonical = canonicalRequest("POST", "/v1/actions/checkout/create-session", init.headers["X-Timestamp"], bodyHash);
    assert.equal(await fixtures.verifyRequest(canonical, init.headers["X-Signature"]), true);
    createBody = JSON.parse(init.body);
    return new Response(JSON.stringify(sessionResponse()), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const checkout = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: checkoutBody({
        plan: "monthly",
        amount: "0.01",
        productId: "PROD_attacker",
        priceSnapshot: { amount: "0.01" },
        script: "zh-Hans",
        email: "buyer@example.com",
      }),
    }),
    env,
    { fetch: fetchImpl, now: () => now }
  );
  assert.equal(checkout.status, 200);
  const checkoutJson = await checkout.json();
  assert.equal(checkoutJson.checkoutUrl, sessionResponse().data.checkoutUrl);
  assert.equal(createBody.productId, MONTHLY_PRODUCT);
  assert.equal(createBody.currency, "USD");
  assert.equal(createBody.buyerEmail, "buyer@example.com");
  assert.equal(createBody.language, "zh-Hans");
  assert.equal(createBody.orderMerchantExternalId, checkoutJson.merchantOrderId);
  assert.equal("priceSnapshot" in createBody, false);
  assert.equal("amount" in createBody, false);
  assert.match(createBody.successUrl, /\/pricing-return\.html\?order=/);
  const pending = JSON.parse(kv.dump().get(`order:${checkoutJson.merchantOrderId}`));
  assert.equal(pending.termsVersion, "2026-09-28-norefund");
  assert.equal(pending.termsAcceptedAt, now.toISOString());
  const orderId = checkoutJson.merchantOrderId;
  const storedCheckout = JSON.parse(kv.dump().get(`order:${orderId}`));
  assert.equal(storedCheckout.emailSource, "checkout");
  assert.equal(storedCheckout.amount, "5.99");
  assert.equal(JSON.stringify(storedCheckout).includes("buyer@example.com"), false);

  const bad = await signedWebhook(
    fixtures,
    pancakeEvent("order.completed", `PAY_${orderId}`, {
      orderId: `ORD_${orderId.slice(1)}`,
      buyerEmail: "payer@example.com",
      currency: "USD",
      chargedAmount: "6.47",
      orderMerchantExternalId: orderId,
    }),
    now
  );
  const rejected = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: bad.body,
      waffoSignature: "t=1,v1=not-a-signature",
    }),
    env,
    { now: () => now }
  );
  assert.equal(rejected.status, 401);
  assert.equal(await rejected.text(), "Invalid signature");
  assert.equal(JSON.parse(kv.dump().get(`order:${orderId}`)).credential, null);

  const staleNow = new Date(now.getTime() - 45 * 60 * 1000 - 1);
  const stale = await signedWebhook(
    fixtures,
    pancakeEvent("order.completed", `PAY_stale_${orderId.slice(0, 12)}`, {
      orderId: `ORD_${orderId.slice(1)}`,
      buyerEmail: "payer@example.com",
      currency: "USD",
      orderMerchantExternalId: orderId,
    }),
    staleNow
  );
  const staleResponse = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: stale.body,
      waffoSignature: stale.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(staleResponse.status, 401);

  const wrongMode = await signedWebhook(
    fixtures,
    pancakeEvent(
      "order.completed",
      `PAY_mode_${orderId.slice(0, 12)}`,
      {
        orderId: `ORD_${orderId.slice(1)}`,
        buyerEmail: "payer@example.com",
        currency: "USD",
        chargedAmount: "5.99",
        orderMerchantExternalId: orderId,
      },
      "prod"
    ),
    now
  );
  const ignoredMode = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: wrongMode.body,
      waffoSignature: wrongMode.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(ignoredMode.status, 200);
  assert.equal(JSON.parse(kv.dump().get(`order:${orderId}`)).credential, null);

  const taxed = await signedWebhook(
    fixtures,
    pancakeEvent("order.completed", `PAY_${orderId}`, {
      orderId: `ORD_${orderId.slice(1)}`,
      orderStatus: "completed",
      buyerEmail: "payer@example.com",
      currency: "USD",
      chargedAmount: "6.47",
      listPrice: { total: "6.47", subtotal: "5.99", taxAmount: "0.48" },
      orderMerchantExternalId: orderId,
      productName: "30 day access",
    }),
    now
  );
  const first = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: taxed.body,
      waffoSignature: taxed.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(first.status, 200);
  assert.equal(await first.text(), "OK");
  const issuedRecord = JSON.parse(kv.dump().get(`order:${orderId}`));
  assert.equal(typeof issuedRecord.credential, "string");
  assert.equal(issuedRecord.emailSource, "notification");
  assert.equal(JSON.stringify(issuedRecord).includes("payer@example.com"), false);
  const verified = await verifyCredential(issuedRecord.credential, await exportB64(fixtures.unlockPublic, "spki"), now);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.expiresAt, "2026-10-28T00:05:00.000Z");

  const second = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: taxed.body,
      waffoSignature: taxed.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(second.status, 200);
  assert.equal(JSON.parse(kv.dump().get(`order:${orderId}`)).credential, issuedRecord.credential);

  const claim = await handleRequest(request(`https://voa-lle-unlock.example/api/claim?order=${orderId}`), env, {
    now: () => now,
  });
  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).credential, issuedRecord.credential);
  const again = await handleRequest(request(`https://voa-lle-unlock.example/api/claim?order=${orderId}`), env, {
    now: () => now,
  });
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error, "claimed");

  const failedRefund = await signedWebhook(
    fixtures,
    pancakeEvent("refund.failed", `REF_fail_${orderId}`, {
      orderId: issuedRecord.pancakeOrderId,
      refundStatus: "failed",
      buyerEmail: "payer@example.com",
      currency: "USD",
      amount: "6.47",
      orderMerchantExternalId: orderId,
    }),
    now
  );
  const failed = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: failedRefund.body,
      waffoSignature: failedRefund.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(failed.status, 200);
  assert.equal(JSON.parse(kv.dump().get(`order:${orderId}`)).status, "claimed");

  const refundBody = await signedWebhook(
    fixtures,
    pancakeEvent("refund.succeeded", `REF_${orderId}`, {
      orderId: issuedRecord.pancakeOrderId,
      refundStatus: "succeeded",
      buyerEmail: "payer@example.com",
      currency: "USD",
      refundedAmount: "6.47",
      amount: "6.47",
      orderMerchantExternalId: orderId,
    }),
    now
  );
  const refund = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: refundBody.body,
      waffoSignature: refundBody.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(refund.status, 200);
  const status = await handleRequest(request(`https://voa-lle-unlock.example/api/status?order=${orderId}`), env, {
    now: () => now,
  });
  const statusJson = await status.json();
  assert.equal(status.status, 200);
  assert.equal(statusJson.state, "revoked");
  assert.equal("credential" in statusJson, false);

  const quarterly = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: checkoutBody({ plan: "quarterly", script: "zh-Hant", email: "buyer@example.com" }),
    }),
    env,
    {
      fetch: async (_url, init) => {
        const parsed = JSON.parse(init.body);
        assert.equal(parsed.productId, QUARTERLY_PRODUCT);
        assert.equal(parsed.language, "zh-Hant-TW");
        assert.equal("priceSnapshot" in parsed, false);
        assert.match(parsed.successUrl, /\/zh-hant\/pricing-return\.html\?order=/);
        return new Response(JSON.stringify(sessionResponse()), { status: 200 });
      },
      now: () => now,
    }
  );
  const quarterlyJson = await quarterly.json();
  assert.equal(quarterlyJson.checkoutUrl, sessionResponse().data.checkoutUrl);
  const qid = quarterlyJson.merchantOrderId;
  const paid = await signedWebhook(
    fixtures,
    pancakeEvent("order.completed", `PAY_${qid}`, {
      orderId: `ORD_${qid.slice(1)}`,
      buyerEmail: "buyer@example.com",
      currency: "USD",
      chargedAmount: "13.99",
      orderMerchantExternalId: qid,
    }),
    now
  );
  await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: paid.body,
      waffoSignature: paid.header,
    }),
    env,
    { now: () => now }
  );
  const beforeRenewal = JSON.parse(kv.dump().get(`order:${qid}`));
  const renewal = await signedWebhook(
    fixtures,
    pancakeEvent("subscription.renewed", `SUB_${qid}`, {
      orderId: beforeRenewal.pancakeOrderId,
      buyerEmail: "buyer@example.com",
      currency: "USD",
      orderStatus: "active",
      currentPeriodEnd: "2027-09-28",
      orderMerchantExternalId: qid,
    }),
    now
  );
  const renewed = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: renewal.body,
      waffoSignature: renewal.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(renewed.status, 200);
  const afterRenewal = JSON.parse(kv.dump().get(`order:${qid}`));
  assert.equal(afterRenewal.expiresAt, beforeRenewal.expiresAt);
  assert.equal(afterRenewal.status, "paid");
  assert.equal(afterRenewal.credential, beforeRenewal.credential);
});

async function paidOrder(fixtures, env, now, email, dataExtra = {}) {
  const { handleRequest } = await import("./src/app.js");
  let orderId = "";
  const checkout = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: checkoutBody({ plan: "monthly", email }),
    }),
    env,
    {
      fetch: async (_url, init) => {
        orderId = JSON.parse(init.body).orderMerchantExternalId;
        return new Response(JSON.stringify(sessionResponse()), { status: 200 });
      },
      now: () => now,
    }
  );
  assert.equal(checkout.status, 200);
  const data = {
    orderId: `ORD_${orderId.slice(1)}`,
    orderStatus: "completed",
    buyerEmail: email,
    currency: "USD",
    chargedAmount: "5.99",
    orderMerchantExternalId: orderId,
    ...dataExtra,
  };
  const event = pancakeEvent("order.completed", `PAY_${orderId}`, data);
  const signed = await signedWebhook(fixtures, event, now);
  const webhook = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: signed.body,
      waffoSignature: signed.header,
    }),
    env,
    { now: () => now }
  );
  assert.equal(webhook.status, 200);
  return orderId;
}

async function postRecover(env, body, now, ip) {
  const { handleRequest } = await import("./src/app.js");
  const response = await handleRequest(
    request("https://voa-lle-unlock.example/api/recover", {
      method: "POST",
      body: JSON.stringify(body),
      ip,
    }),
    env,
    { now: () => now }
  );
  return { status: response.status, json: await response.json() };
}

test("recover reissues only when the order and email match", async () => {
  const fixtures = await generateFixtures();
  const { verifyCredential } = await import("../js/credential.js");
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  const now = new Date("2026-09-28T01:00:00.000Z");
  const orderId = await paidOrder(fixtures, env, now, "Buyer@Example.com");
  const stored = JSON.parse(kv.dump().get(`order:${orderId}`));
  assert.equal(stored.emailSource, "notification");
  assert.equal(JSON.stringify(stored).includes("buyer@example.com"), false);

  const ok = await postRecover(env, { order: orderId, email: "buyer@example.com" }, now, "203.0.113.10");
  assert.equal(ok.status, 200);
  assert.equal(ok.json.orderId, orderId);
  assert.equal(ok.json.plan, "monthly");
  assert.equal(ok.json.expiresAt, "2026-10-28T00:05:00.000Z");
  const verified = await verifyCredential(ok.json.credential, await exportB64(fixtures.unlockPublic, "spki"), now);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.orderId, orderId);

  const byPancake = await postRecover(
    env,
    { order: stored.pancakeOrderId, email: "buyer@example.com" },
    new Date(now.getTime() + 11 * 60 * 1000),
    "203.0.113.15"
  );
  assert.equal(byPancake.status, 200);
  assert.equal(byPancake.json.expiresAt, ok.json.expiresAt);

  const wrongEmail = await postRecover(env, { order: orderId, email: "other@example.com" }, now, "203.0.113.11");
  const wrongOrder = await postRecover(env, { order: "m1234567890abcdef", email: "buyer@example.com" }, now, "203.0.113.12");
  assert.equal(wrongEmail.status, 400);
  assert.deepEqual(wrongEmail.json, wrongOrder.json);
  assert.deepEqual(wrongEmail.json, { error: "recover_failed" });

  const { handleRequest } = await import("./src/app.js");
  const unpaid = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: checkoutBody({ plan: "monthly", email: "waiting@example.com" }),
    }),
    env,
    {
      fetch: async () => new Response(JSON.stringify(sessionResponse()), { status: 200 }),
      now: () => now,
    }
  );
  const unpaidId = (await unpaid.json()).merchantOrderId;
  const pending = await postRecover(env, { order: unpaidId, email: "waiting@example.com" }, now, "203.0.113.13");
  assert.deepEqual(pending, { status: 400, json: { error: "recover_failed" } });

  const refundEvent = pancakeEvent("refund.succeeded", `REF_${orderId}`, {
    orderId: stored.pancakeOrderId,
    refundStatus: "succeeded",
    buyerEmail: "buyer@example.com",
    currency: "USD",
    orderMerchantExternalId: orderId,
  });
  const refundSigned = await signedWebhook(fixtures, refundEvent, now);
  await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: refundSigned.body,
      waffoSignature: refundSigned.header,
    }),
    env,
    { now: () => now }
  );
  const revoked = await postRecover(env, { order: orderId, email: "buyer@example.com" }, now, "203.0.113.14");
  assert.deepEqual(revoked.json, wrongEmail.json);
  assert.equal(revoked.status, wrongEmail.status);
});

test("buyerEmail replaces the checkout hash, a missing buyer email does not", async () => {
  const fixtures = await generateFixtures();
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  const now = new Date("2026-09-28T01:00:00.000Z");
  const orderId = await paidOrder(fixtures, env, now, "typed@example.com", { buyerEmail: "Payer@Example.com" });
  const stored = JSON.parse(kv.dump().get(`order:${orderId}`));
  assert.equal(stored.emailSource, "notification");
  assert.equal(JSON.stringify(stored).includes("payer@example.com"), false);
  const typed = await postRecover(env, { order: orderId, email: "typed@example.com" }, now, "203.0.113.20");
  const payer = await postRecover(env, { order: orderId, email: "payer@example.com" }, now, "203.0.113.21");
  assert.deepEqual(typed.json, { error: "recover_failed" });
  assert.equal(payer.status, 200);

  const keptId = await paidOrder(fixtures, env, now, "kept@example.com", { buyerEmail: "" });
  const keptRecord = JSON.parse(kv.dump().get(`order:${keptId}`));
  assert.equal(keptRecord.emailSource, "checkout");
  const kept = await postRecover(env, { order: keptId, email: "kept@example.com" }, now, "203.0.113.22");
  assert.equal(kept.status, 200);
});

test("recover is limited per IP, per order window, and five times per order", async () => {
  const fixtures = await generateFixtures();
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  const now = new Date("2026-09-28T01:00:00.000Z");
  const later = new Date(now.getTime() + 11 * 60 * 1000);
  const orderId = await paidOrder(fixtures, env, now, "buyer@example.com");

  for (let i = 0; i < 3; i += 1) {
    const attempt = await postRecover(env, { order: orderId, email: "wrong@example.com" }, now, "203.0.113.30");
    assert.equal(attempt.status, 400, `window attempt ${i}`);
  }
  const windowBlocked = await postRecover(env, { order: orderId, email: "buyer@example.com" }, now, "203.0.113.31");
  assert.equal(windowBlocked.status, 429);
  assert.deepEqual(windowBlocked.json, { error: "recover_limited" });

  for (let i = 0; i < 2; i += 1) {
    const attempt = await postRecover(env, { order: orderId, email: "wrong@example.com" }, later, `203.0.113.4${i}`);
    assert.equal(attempt.status, 400);
  }
  const totalBlocked = await postRecover(env, { order: orderId, email: "buyer@example.com" }, later, "203.0.113.49");
  assert.equal(totalBlocked.status, 429);
  assert.deepEqual(totalBlocked.json, { error: "recover_limited" });

  for (let i = 0; i < 8; i += 1) {
    const attempt = await postRecover(env, { order: `missing${i}xxxx`, email: "buyer@example.com" }, now, "198.51.100.8");
    assert.equal(attempt.status, 400);
  }
  const ipBlocked = await postRecover(env, { order: "missing9xxxx", email: "buyer@example.com" }, now, "198.51.100.8");
  assert.equal(ipBlocked.status, 429);
  assert.deepEqual(ipBlocked.json, { error: "recover_limited" });
});

test("checkout without terms consent does not call Waffo or store an order", async () => {
  const fixtures = await generateFixtures();
  const { handleRequest } = await import("./src/app.js");
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  let called = false;
  const bodies = [
    { plan: "monthly", email: "buyer@example.com" },
    { plan: "monthly", email: "buyer@example.com", termsAccepted: false, termsVersion: "2026-09-28-norefund" },
    { plan: "monthly", email: "buyer@example.com", termsAccepted: true, termsVersion: "other-version" },
  ];
  for (const body of bodies) {
    const response = await handleRequest(
      request("https://voa-lle-unlock.example/api/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      env,
      {
        fetch: async () => {
          called = true;
          return new Response("{}", { status: 200 });
        },
        now: () => new Date("2026-09-28T00:00:00.000Z"),
      }
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "terms_required" });
  }
  assert.equal(called, false);
  assert.equal([...kv.dump().keys()].some((key) => String(key).startsWith("order:")), false);
});

test("empty product ids keep checkout closed", async () => {
  const fixtures = await generateFixtures();
  const { handleRequest } = await import("./src/app.js");
  const env = envFor(fixtures, memoryKv());
  env.PANCAKE_PRODUCT_MONTHLY = "";
  let called = false;
  const response = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "monthly", email: "buyer@example.com" }),
    }),
    env,
    {
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
      now: () => new Date("2026-09-28T00:00:00.000Z"),
    }
  );
  assert.equal(response.status, 500);
  assert.equal(called, false);
});
