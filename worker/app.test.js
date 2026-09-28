const test = require("node:test");
const assert = require("node:assert/strict");

const ORIGIN = "https://1019666077-bit.github.io/wx-extract-mvp";

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
  const waffo = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const unlock = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const waffoJs = await import("./src/waffo.js");
  return {
    merchant,
    waffo,
    unlockPublic: unlock.publicKey,
    unlockPrivate: await exportB64(unlock.privateKey, "pkcs8"),
    waffoPublic: await exportB64(waffo.publicKey, "spki"),
    merchantPrivate: await exportB64(merchant.privateKey, "pkcs8"),
    signResponse: async (body) => waffoJs.signRsaSha256(waffo.privateKey, body),
    verifyRequest: async (body, signature) => waffoJs.verifyRsaSha256(merchant.publicKey, body, signature),
  };
}

function envFor(fixtures, kv) {
  return {
    WAFFO_API_KEY: "sandbox-api-key",
    WAFFO_MERCHANT_ID: "M000001",
    WAFFO_PRIVATE_KEY: fixtures.merchantPrivate,
    WAFFO_PUBLIC_KEY: fixtures.waffoPublic,
    UNLOCK_PRIVATE_KEY: fixtures.unlockPrivate,
    WAFFO_API_BASE: "https://api-sandbox.waffo.com",
    ALLOWED_ORIGIN: ORIGIN,
    ORDERS: kv,
  };
}

function request(url, { method = "GET", body, origin = ORIGIN, signature, ip } = {}) {
  const headers = new Headers();
  if (origin) {
    headers.set("Origin", origin);
  }
  if (body) {
    headers.set("Content-Type", "application/json");
  }
  if (signature) {
    headers.set("X-SIGNATURE", signature);
  }
  if (ip) {
    headers.set("CF-Connecting-IP", ip);
  }
  return new Request(url, { method, headers, body });
}

async function signedWebhook(fixtures, event) {
  const body = JSON.stringify(event);
  const signature = await fixtures.signResponse(body);
  return { body, signature };
}

test("checkout uses the server amount, webhook signature, claim once, refund and chargeback", async () => {
  const fixtures = await generateFixtures();
  const { handleRequest } = await import("./src/app.js");
  const { verifyCredential } = await import("../js/credential.js");
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  const now = new Date("2026-09-28T00:00:00.000Z");
  let createBody = null;

  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://api-sandbox.waffo.com/api/v1/order/create");
    assert.equal(init.headers["X-API-VERSION"], "1.0.0");
    assert.equal(init.headers["X-API-KEY"], "sandbox-api-key");
    assert.equal(await fixtures.verifyRequest(init.body, init.headers["X-SIGNATURE"]), true);
    createBody = JSON.parse(init.body);
    const data = {
      code: "0",
      msg: "Success",
      data: {
        paymentRequestId: createBody.paymentRequestId,
        merchantOrderId: createBody.merchantOrderId,
        acquiringOrderId: "A202609280001",
        orderStatus: "PAY_IN_PROGRESS",
        orderAction: JSON.stringify({
          actionType: "WEB",
          webUrl: "https://checkout.sandbox.example/pay",
        }),
      },
    };
    const raw = JSON.stringify(data);
    return new Response(raw, {
      status: 200,
      headers: { "X-SIGNATURE": await fixtures.signResponse(raw), "Content-Type": "application/json" },
    });
  };

  const checkout = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "monthly", amount: "0.01", script: "zh-Hans", email: "buyer@example.com" }),
    }),
    env,
    { fetch: fetchImpl, now: () => now }
  );
  assert.equal(checkout.status, 200);
  const checkoutJson = await checkout.json();
  assert.equal(checkoutJson.checkoutUrl, "https://checkout.sandbox.example/pay");
  assert.equal(createBody.userInfo.userEmail, "buyer@example.com");
  assert.equal(createBody.orderAmount, "5.99");
  assert.equal(createBody.orderCurrency, "USD");
  assert.equal(createBody.paymentInfo.productName, "ONE_TIME_PAYMENT");
  assert.equal(createBody.goodsInfo.goodsName, "Let's Learn English monthly");
  assert.equal("appName" in createBody.goodsInfo, false);
  assert.match(createBody.successRedirectUrl, /\?order=/);
  const orderId = checkoutJson.merchantOrderId;
  const storedCheckout = JSON.parse(kv.dump().get(`order:${orderId}`));
  assert.equal(storedCheckout.emailSource, "checkout");
  assert.equal(JSON.stringify(storedCheckout).includes("buyer@example.com"), false);

  const bad = await signedWebhook(fixtures, {
    eventType: "PAYMENT_NOTIFICATION",
    result: {
      merchantOrderId: orderId,
      acquiringOrderId: "A202609280001",
      orderStatus: "PAY_SUCCESS",
      orderAmount: "5.99",
      orderCurrency: "USD",
      orderCompletedAt: "2026-09-28T00:05:00.000Z",
    },
  });
  const rejected = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: bad.body,
      signature: "not-a-signature",
    }),
    env,
    { now: () => now }
  );
  assert.equal(rejected.status, 200);
  assert.deepEqual(await rejected.json(), { message: "failed" });
  assert.equal(JSON.parse(kv.dump().get(`order:${orderId}`)).credential, null);

  const good = await signedWebhook(fixtures, {
    eventType: "PAYMENT_NOTIFICATION",
    result: {
      merchantOrderId: orderId,
      acquiringOrderId: "A202609280001",
      orderStatus: "PAY_SUCCESS",
      orderAmount: "5.99",
      orderCurrency: "USD",
      orderCompletedAt: "2026-09-28T00:05:00.000Z",
    },
  });
  const first = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: good.body,
      signature: good.signature,
    }),
    env,
    { now: () => now }
  );
  assert.deepEqual(await first.json(), { message: "success" });
  const issued = JSON.parse(kv.dump().get(`order:${orderId}`)).credential;
  assert.equal(typeof issued, "string");
  const verified = await verifyCredential(issued, await exportB64(fixtures.unlockPublic, "spki"), now);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.expiresAt, "2026-10-28T00:05:00.000Z");

  const second = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: good.body,
      signature: good.signature,
    }),
    env,
    { now: () => now }
  );
  assert.deepEqual(await second.json(), { message: "success" });
  assert.equal(JSON.parse(kv.dump().get(`order:${orderId}`)).credential, issued);

  const claim = await handleRequest(
    request(`https://voa-lle-unlock.example/api/claim?order=${orderId}`),
    env,
    { now: () => now }
  );
  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).credential, issued);
  const again = await handleRequest(
    request(`https://voa-lle-unlock.example/api/claim?order=${orderId}`),
    env,
    { now: () => now }
  );
  assert.equal(again.status, 409);
  assert.equal((await again.json()).error, "claimed");

  const refundBody = await signedWebhook(fixtures, {
    eventType: "REFUND_NOTIFICATION",
    result: {
      acquiringOrderId: "A202609280001",
      refundStatus: "ORDER_FULLY_REFUNDED",
    },
  });
  const refund = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: refundBody.body,
      signature: refundBody.signature,
    }),
    env,
    { now: () => now }
  );
  assert.deepEqual(await refund.json(), { message: "success" });
  const status = await handleRequest(
    request(`https://voa-lle-unlock.example/api/status?order=${orderId}`),
    env,
    { now: () => now }
  );
  const statusJson = await status.json();
  assert.equal(status.status, 200);
  assert.equal(statusJson.state, "revoked");
  assert.equal("credential" in statusJson, false);

  const quarterly = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "quarterly", email: "buyer@example.com" }),
    }),
    env,
    {
      fetch: async (url, init) => {
        const parsed = JSON.parse(init.body);
        assert.equal(parsed.orderAmount, "13.99");
        const data = {
          code: "0",
          msg: "Success",
          data: {
            paymentRequestId: parsed.paymentRequestId,
            merchantOrderId: parsed.merchantOrderId,
            acquiringOrderId: "A202609280002",
            orderStatus: "AUTHORIZATION_REQUIRED",
            orderAction: JSON.stringify({ actionType: "DEEPLINK", deeplinkUrl: "https://checkout.sandbox.example/deep" }),
          },
        };
        const raw = JSON.stringify(data);
        return new Response(raw, { status: 200, headers: { "X-SIGNATURE": await fixtures.signResponse(raw) } });
      },
      now: () => now,
    }
  );
  const quarterlyJson = await quarterly.json();
  assert.equal(quarterlyJson.checkoutUrl, "https://checkout.sandbox.example/deep");
  const qid = quarterlyJson.merchantOrderId;
  const paid = await signedWebhook(fixtures, {
    eventType: "PAYMENT_NOTIFICATION",
    result: {
      merchantOrderId: qid,
      acquiringOrderId: "A202609280002",
      orderStatus: "PAY_SUCCESS",
      orderAmount: "13.99",
      orderCurrency: "USD",
      orderCompletedAt: "2026-09-28T00:05:00.000Z",
    },
  });
  await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: paid.body,
      signature: paid.signature,
    }),
    env,
    { now: () => now }
  );
  const won = await signedWebhook(fixtures, {
    eventType: "CHARGEBACK_NOTIFICATION",
    result: { merchantOrderId: qid, chargebackStatus: "CASE_WON" },
  });
  await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: won.body,
      signature: won.signature,
    }),
    env,
    { now: () => now }
  );
  const stillPaid = await handleRequest(request(`https://voa-lle-unlock.example/api/status?order=${qid}`), env, {
    now: () => now,
  });
  assert.equal((await stillPaid.json()).state, "paid");
  const chargeback = await signedWebhook(fixtures, {
    eventType: "CHARGEBACK_NOTIFICATION",
    result: { merchantOrderId: qid, chargebackStatus: "ACTION_REQUIRED" },
  });
  await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: chargeback.body,
      signature: chargeback.signature,
    }),
    env,
    { now: () => now }
  );
  const revoked = await handleRequest(request(`https://voa-lle-unlock.example/api/status?order=${qid}`), env, {
    now: () => now,
  });
  assert.equal((await revoked.json()).state, "revoked");
});

test("order inquiry verifies the response and does not write a credential", async () => {
  const fixtures = await generateFixtures();
  const { inquireOrder } = await import("./src/waffo.js");
  const kv = memoryKv();
  const data = { code: "0", msg: "Success", data: { orderStatus: "PAY_SUCCESS", paymentRequestId: "abc" } };
  const raw = JSON.stringify(data);
  await inquireOrder(envFor(fixtures, kv), "abc", async (url, init) => {
    assert.equal(url, "https://api-sandbox.waffo.com/api/v1/order/inquiry");
    assert.equal(JSON.parse(init.body).paymentRequestId, "abc");
    return new Response(raw, { status: 200, headers: { "X-SIGNATURE": await fixtures.signResponse(raw) } });
  });
  assert.equal([...kv.dump().keys()].some((key) => String(key).startsWith("order:")), false);
});

async function paidOrder(fixtures, env, now, email, webhookExtra) {
  const { handleRequest } = await import("./src/app.js");
  let orderId = "";
  const checkout = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "monthly", email }),
    }),
    env,
    {
      fetch: async (_url, init) => {
        const parsed = JSON.parse(init.body);
        orderId = parsed.merchantOrderId;
        const data = {
          code: "0",
          msg: "Success",
          data: {
            paymentRequestId: parsed.paymentRequestId,
            merchantOrderId: parsed.merchantOrderId,
            acquiringOrderId: "A-recover",
            orderStatus: "PAY_IN_PROGRESS",
            orderAction: JSON.stringify({ webUrl: "https://checkout.sandbox.example/pay" }),
          },
        };
        const raw = JSON.stringify(data);
        return new Response(raw, { status: 200, headers: { "X-SIGNATURE": await fixtures.signResponse(raw) } });
      },
      now: () => now,
    }
  );
  assert.equal(checkout.status, 200);
  const event = {
    eventType: "PAYMENT_NOTIFICATION",
    result: {
      merchantOrderId: orderId,
      acquiringOrderId: "A-recover",
      orderStatus: "PAY_SUCCESS",
      orderAmount: "5.99",
      orderCurrency: "USD",
      orderCompletedAt: "2026-09-28T00:05:00.000Z",
      ...webhookExtra,
    },
  };
  const body = JSON.stringify(event);
  const signature = await fixtures.signResponse(body);
  const webhook = await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", { method: "POST", origin: "", body, signature }),
    env,
    { now: () => now }
  );
  assert.deepEqual(await webhook.json(), { message: "success" });
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
  assert.equal(stored.emailSource, "checkout");
  assert.equal(JSON.stringify(stored).includes("buyer@example.com"), false);

  const ok = await postRecover(env, { order: orderId, email: "buyer@example.com" }, now, "203.0.113.10");
  assert.equal(ok.status, 200);
  assert.equal(ok.json.orderId, orderId);
  assert.equal(ok.json.plan, "monthly");
  assert.equal(ok.json.expiresAt, "2026-10-28T00:05:00.000Z");
  const verified = await verifyCredential(ok.json.credential, await exportB64(fixtures.unlockPublic, "spki"), now);
  assert.equal(verified.ok, true);
  assert.equal(verified.payload.orderId, orderId);

  const wrongEmail = await postRecover(env, { order: orderId, email: "other@example.com" }, now, "203.0.113.11");
  const wrongOrder = await postRecover(env, { order: "m1234567890abcdef", email: "buyer@example.com" }, now, "203.0.113.12");
  assert.equal(wrongEmail.status, 400);
  assert.deepEqual(wrongEmail.json, wrongOrder.json);
  assert.deepEqual(wrongEmail.json, { error: "recover_failed" });

  const { handleRequest } = await import("./src/app.js");
  const unpaid = await handleRequest(
    request("https://voa-lle-unlock.example/api/checkout", {
      method: "POST",
      body: JSON.stringify({ plan: "monthly", email: "waiting@example.com" }),
    }),
    env,
    {
      fetch: async (_url, init) => {
        const parsed = JSON.parse(init.body);
        const data = {
          code: "0",
          msg: "Success",
          data: {
            paymentRequestId: parsed.paymentRequestId,
            merchantOrderId: parsed.merchantOrderId,
            acquiringOrderId: "A-wait",
            orderAction: JSON.stringify({ webUrl: "https://checkout.sandbox.example/pay" }),
          },
        };
        const raw = JSON.stringify(data);
        return new Response(raw, { status: 200, headers: { "X-SIGNATURE": await fixtures.signResponse(raw) } });
      },
      now: () => now,
    }
  );
  const unpaidId = (await unpaid.json()).merchantOrderId;
  const pending = await postRecover(env, { order: unpaidId, email: "waiting@example.com" }, now, "203.0.113.13");
  assert.deepEqual(pending, { status: 400, json: { error: "recover_failed" } });

  const refundBody = JSON.stringify({
    eventType: "REFUND_NOTIFICATION",
    result: { merchantOrderId: orderId, refundStatus: "ORDER_FULLY_REFUNDED" },
  });
  await handleRequest(
    request("https://voa-lle-unlock.example/api/waffo/webhook", {
      method: "POST",
      origin: "",
      body: refundBody,
      signature: await fixtures.signResponse(refundBody),
    }),
    env,
    { now: () => now }
  );
  const revoked = await postRecover(env, { order: orderId, email: "buyer@example.com" }, now, "203.0.113.14");
  assert.deepEqual(revoked.json, wrongEmail.json);
  assert.equal(revoked.status, wrongEmail.status);
});

test("notification userEmail replaces the checkout hash, placeholders do not", async () => {
  const fixtures = await generateFixtures();
  const kv = memoryKv();
  const env = envFor(fixtures, kv);
  const now = new Date("2026-09-28T01:00:00.000Z");
  const orderId = await paidOrder(fixtures, env, now, "typed@example.com", {
    userInfo: { userId: "u1", userEmail: "Payer@Example.com", userTerminal: "WEB" },
  });
  const stored = JSON.parse(kv.dump().get(`order:${orderId}`));
  assert.equal(stored.emailSource, "notification");
  assert.equal(JSON.stringify(stored).includes("payer@example.com"), false);
  const typed = await postRecover(env, { order: orderId, email: "typed@example.com" }, now, "203.0.113.20");
  const payer = await postRecover(env, { order: orderId, email: "payer@example.com" }, now, "203.0.113.21");
  assert.deepEqual(typed.json, { error: "recover_failed" });
  assert.equal(payer.status, 200);

  const placeholderId = await paidOrder(fixtures, env, now, "kept@example.com", {
    userInfo: JSON.stringify({ userEmail: "mignored@examples.com" }),
  });
  const placeholder = JSON.parse(kv.dump().get(`order:${placeholderId}`));
  assert.equal(placeholder.emailSource, "checkout");
  const kept = await postRecover(env, { order: placeholderId, email: "kept@example.com" }, now, "203.0.113.22");
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
    const attempt = await postRecover(
      env,
      { order: `missing${i}xxxx`, email: "buyer@example.com" },
      now,
      "198.51.100.8"
    );
    assert.equal(attempt.status, 400);
  }
  const ipBlocked = await postRecover(env, { order: "missing9xxxx", email: "buyer@example.com" }, now, "198.51.100.8");
  assert.equal(ipBlocked.status, 429);
  assert.deepEqual(ipBlocked.json, { error: "recover_limited" });
});
