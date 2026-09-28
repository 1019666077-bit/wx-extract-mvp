import { signCredential } from "../../js/credential.js";
import {
  chargebackShouldRevoke,
  checkoutUrlFromOrderAction,
  paymentInstant,
  refundShouldRevoke,
  shouldIssuePayment,
} from "./doc-choices.js";
import { hashesEqual, normalizeEmail, payerEmailFromResult, sha256Hex } from "./email.js";
import { buildCreateOrderBody, importRsaPublicKey, PLANS, verifyRsaSha256, waffoPost } from "./waffo.js";

const CHECKOUT_LIMIT = 8;
const READ_LIMIT = 120;
const RECOVER_IP_LIMIT = 8;
const RECOVER_ORDER_WINDOW = 3;
const RECOVER_ORDER_TOTAL = 5;
const RECOVER_TOTAL_TTL = 90 * 24 * 60 * 60;
const WINDOW_MS = 10 * 60 * 1000;
const ORDER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const RECOVER_FAILED = { error: "recover_failed" };

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function waffoAck(message) {
  return new Response(JSON.stringify({ message }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== env.ALLOWED_ORIGIN) {
    return null;
  }
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function clientIp(request) {
  const raw = request.headers.get("CF-Connecting-IP") || "0";
  const cleaned = raw.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 64);
  return cleaned || "0";
}

function missingConfig(env) {
  const keys = [
    "WAFFO_API_KEY",
    "WAFFO_MERCHANT_ID",
    "WAFFO_PRIVATE_KEY",
    "WAFFO_PUBLIC_KEY",
    "UNLOCK_PRIVATE_KEY",
    "WAFFO_API_BASE",
    "ALLOWED_ORIGIN",
  ];
  for (const key of keys) {
    if (!env[key]) {
      return key;
    }
  }
  if (!env.ORDERS) {
    return "ORDERS";
  }
  return "";
}

async function limited(kv, bucketKey, limit) {
  try {
    const raw = await kv.get(bucketKey);
    const current = raw ? Number(raw) : 0;
    if (!Number.isFinite(current) || current >= limit) {
      return true;
    }
    await kv.put(bucketKey, String(current + 1), { expirationTtl: 700 });
    return false;
  } catch (error) {
    return true;
  }
}

async function readCount(kv, key) {
  const raw = await kv.get(key);
  const current = raw ? Number(raw) : 0;
  return Number.isFinite(current) && current >= 0 ? current : 0;
}

async function bumpCount(kv, key, ttl) {
  const next = (await readCount(kv, key)) + 1;
  await kv.put(key, String(next), { expirationTtl: ttl });
  return next;
}

function randomHex(bytes) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function moneyMatches(actual, expected) {
  if (typeof actual !== "string" || !/^\d+(\.\d+)?$/.test(actual)) {
    return false;
  }
  return Number(actual).toFixed(2) === Number(expected).toFixed(2);
}

async function readOrder(kv, merchantOrderId) {
  if (!merchantOrderId || !ORDER_ID.test(merchantOrderId)) {
    return null;
  }
  const raw = await kv.get(`order:${merchantOrderId}`);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function writeOrder(kv, record) {
  await kv.put(`order:${record.merchantOrderId}`, JSON.stringify(record));
  if (record.acquiringOrderId) {
    await kv.put(`acq:${record.acquiringOrderId}`, record.merchantOrderId);
  }
  if (record.paymentRequestId) {
    await kv.put(`payreq:${record.paymentRequestId}`, record.merchantOrderId);
  }
}

async function resolveMerchantOrderId(kv, result) {
  if (!result || typeof result !== "object") {
    return "";
  }
  if (typeof result.merchantOrderId === "string" && result.merchantOrderId) {
    return result.merchantOrderId;
  }
  const keys = [];
  if (result.acquiringOrderId) {
    keys.push(`acq:${result.acquiringOrderId}`);
  }
  if (result.originalOrderId) {
    keys.push(`acq:${result.originalOrderId}`);
  }
  if (result.origPaymentRequestId) {
    keys.push(`payreq:${result.origPaymentRequestId}`);
  }
  if (result.originalPaymentRequestId) {
    keys.push(`payreq:${result.originalPaymentRequestId}`);
  }
  if (result.paymentRequestId) {
    keys.push(`payreq:${result.paymentRequestId}`);
  }
  for (const key of keys) {
    const id = await kv.get(key);
    if (typeof id === "string" && id) {
      return id;
    }
  }
  return "";
}

function pagePath(script, name) {
  return script === "zh-Hant" ? `/zh-hant/${name}` : `/${name}`;
}

async function handleCheckout(request, env, deps) {
  const headers = corsHeaders(request, env);
  if (!headers) {
    return json({ error: "origin" }, 403);
  }
  if (missingConfig(env)) {
    return json({ error: "unconfigured" }, 500, headers);
  }
  const now = deps.now();
  const bucket = Math.floor(now.getTime() / WINDOW_MS);
  const blocked = await limited(env.ORDERS, `rl:checkout:${clientIp(request)}:${bucket}`, CHECKOUT_LIMIT);
  if (blocked) {
    return json({ error: "rate_limited" }, 429, { ...headers, "Retry-After": "60" });
  }
  const text = await request.text();
  if (text.length > 2048) {
    return json({ error: "invalid" }, 400, headers);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    return json({ error: "invalid" }, 400, headers);
  }
  const plan = body && body.plan;
  if (plan !== "monthly" && plan !== "quarterly") {
    return json({ error: "invalid_plan" }, 400, headers);
  }
  const email = normalizeEmail(body.email);
  if (!email || email.endsWith("@examples.com")) {
    return json({ error: "invalid_email" }, 400, headers);
  }
  const script = body.script === "zh-Hant" ? "zh-Hant" : "zh-Hans";
  const origin = env.ALLOWED_ORIGIN.replace(/\/$/, "");
  const paymentRequestId = randomHex(16);
  const merchantOrderId = `m${randomHex(16)}`;
  const requestedAt = now.toISOString();
  const workerOrigin = new URL(request.url).origin;
  const record = {
    merchantOrderId,
    paymentRequestId,
    plan,
    amount: PLANS[plan].amount,
    currency: "USD",
    status: "pending",
    credential: null,
    claimed: false,
    emailHash: await sha256Hex(email),
    emailSource: "checkout",
    acquiringOrderId: "",
    createdAt: requestedAt,
    issuedAt: "",
    expiresAt: "",
  };
  await writeOrder(env.ORDERS, record);
  const orderBody = buildCreateOrderBody({
    plan,
    paymentRequestId,
    merchantOrderId,
    merchantId: env.WAFFO_MERCHANT_ID,
    notifyUrl: `${workerOrigin}/api/waffo/webhook`,
    successRedirectUrl: `${origin}${pagePath(script, "pricing-return.html")}?order=${encodeURIComponent(merchantOrderId)}`,
    failedRedirectUrl: `${origin}${pagePath(script, "pricing.html")}`,
    cancelRedirectUrl: `${origin}${pagePath(script, "pricing.html")}`,
    goodsUrl: `${origin}/pricing.html`,
    requestedAt,
    userEmail: email,
  });
  let parsed;
  try {
    const posted = await waffoPost(env, "/api/v1/order/create", orderBody, deps.fetch);
    parsed = posted.parsed;
  } catch (error) {
    record.status = "closed";
    await writeOrder(env.ORDERS, record);
    return json({ error: "checkout_failed" }, 502, headers);
  }
  if (!parsed || String(parsed.code) !== "0" || !parsed.data) {
    record.status = "closed";
    await writeOrder(env.ORDERS, record);
    return json({ error: "checkout_failed" }, 502, headers);
  }
  const data = parsed.data;
  if (typeof data.acquiringOrderId === "string") {
    record.acquiringOrderId = data.acquiringOrderId;
  }
  const checkoutUrl = checkoutUrlFromOrderAction(data.orderAction);
  if (!checkoutUrl) {
    record.status = "closed";
    await writeOrder(env.ORDERS, record);
    return json({ error: "checkout_failed" }, 502, headers);
  }
  await writeOrder(env.ORDERS, record);
  return json({ checkoutUrl, merchantOrderId }, 200, headers);
}

async function issueCredential(record, result, env, now) {
  if (!moneyMatches(result.orderAmount, record.amount) || result.orderCurrency !== record.currency) {
    return false;
  }
  const paidAt = paymentInstant(result, now);
  const expires = addUtcDays(paidAt, PLANS[record.plan].days);
  const token = await signCredential(env.UNLOCK_PRIVATE_KEY, {
    orderId: record.merchantOrderId,
    plan: record.plan,
    issuedAt: paidAt.toISOString(),
    expiresAt: expires.toISOString(),
  });
  record.credential = token;
  record.status = "paid";
  record.issuedAt = paidAt.toISOString();
  record.expiresAt = expires.toISOString();
  if (typeof result.acquiringOrderId === "string" && result.acquiringOrderId) {
    record.acquiringOrderId = result.acquiringOrderId;
  }
  return true;
}

async function handleWebhook(request, env, deps) {
  if (missingConfig(env)) {
    return waffoAck("failed");
  }
  const raw = await request.text();
  if (raw.length > 65536) {
    return waffoAck("failed");
  }
  const signature = request.headers.get("X-SIGNATURE");
  let verified = false;
  try {
    const publicKey = await importRsaPublicKey(env.WAFFO_PUBLIC_KEY);
    verified = await verifyRsaSha256(publicKey, raw, signature);
  } catch (error) {
    verified = false;
  }
  if (!verified) {
    return waffoAck("failed");
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch (error) {
    return waffoAck("failed");
  }
  const eventType = event && event.eventType;
  const result = event && event.result;
  if (!eventType || !result || typeof result !== "object") {
    return waffoAck("failed");
  }
  const merchantOrderId = await resolveMerchantOrderId(env.ORDERS, result);
  const record = await readOrder(env.ORDERS, merchantOrderId);
  if (!record) {
    return waffoAck("failed");
  }
  const now = deps.now();
  if (shouldIssuePayment(eventType, result)) {
    if (record.status === "revoked") {
      return waffoAck("success");
    }
    if (!record.credential) {
      const issued = await issueCredential(record, result, env, now);
      if (!issued) {
        return waffoAck("failed");
      }
    }
    const payerEmail = payerEmailFromResult(result);
    if (payerEmail) {
      record.emailHash = await sha256Hex(payerEmail);
      record.emailSource = "notification";
    }
    await writeOrder(env.ORDERS, record);
    return waffoAck("success");
  }
  if (eventType === "PAYMENT_NOTIFICATION" && result.orderStatus === "ORDER_CLOSE") {
    if (record.status === "pending") {
      record.status = "closed";
      await writeOrder(env.ORDERS, record);
    }
    return waffoAck("success");
  }
  if (eventType === "PAYMENT_NOTIFICATION") {
    return waffoAck("unknown");
  }
  if (eventType === "REFUND_NOTIFICATION" && refundShouldRevoke(result)) {
    record.status = "revoked";
    record.credential = null;
    record.revokedAt = now.toISOString();
    await writeOrder(env.ORDERS, record);
    return waffoAck("success");
  }
  if (eventType === "CHARGEBACK_NOTIFICATION" && chargebackShouldRevoke(result)) {
    record.status = "revoked";
    record.credential = null;
    record.revokedAt = now.toISOString();
    await writeOrder(env.ORDERS, record);
    return waffoAck("success");
  }
  if (
    eventType === "REFUND_NOTIFICATION" ||
    eventType === "CHARGEBACK_NOTIFICATION" ||
    eventType === "TOKENIZATION_NOTIFICATION" ||
    eventType === "SUBSCRIPTION_STATUS_NOTIFICATION" ||
    eventType === "SUBSCRIPTION_PERIOD_CHANGED_NOTIFICATION" ||
    eventType === "SUBSCRIPTION_CHANGE_NOTIFICATION"
  ) {
    return waffoAck("success");
  }
  return waffoAck("unknown");
}

async function orderParam(request) {
  const url = new URL(request.url);
  let order = url.searchParams.get("order") || "";
  if (!order && request.method === "POST") {
    const text = await request.text();
    if (text.length > 2048) {
      return "";
    }
    try {
      const body = JSON.parse(text);
      if (body && typeof body.order === "string") {
        order = body.order;
      }
    } catch (error) {
      return "";
    }
  }
  return order;
}

async function handleClaim(request, env, deps) {
  const headers = corsHeaders(request, env);
  if (!headers) {
    return json({ error: "origin" }, 403);
  }
  if (missingConfig(env)) {
    return json({ error: "unconfigured" }, 500, headers);
  }
  const now = deps.now();
  const bucket = Math.floor(now.getTime() / WINDOW_MS);
  const blocked = await limited(env.ORDERS, `rl:read:${clientIp(request)}:${bucket}`, READ_LIMIT);
  if (blocked) {
    return json({ error: "rate_limited" }, 429, { ...headers, "Retry-After": "60" });
  }
  const order = await orderParam(request);
  const record = await readOrder(env.ORDERS, order);
  if (!record) {
    return json({ state: "unknown" }, 404, headers);
  }
  if (record.status === "revoked") {
    return json({ state: "revoked", orderId: record.merchantOrderId }, 410, headers);
  }
  if (record.status === "closed") {
    return json({ state: "closed", orderId: record.merchantOrderId }, 410, headers);
  }
  if (record.claimed || record.status === "claimed") {
    return json({ error: "claimed", state: "claimed" }, 409, headers);
  }
  if (record.status !== "paid" || !record.credential) {
    return json({ state: "pending" }, 202, headers);
  }
  const credential = record.credential;
  record.claimed = true;
  record.status = "claimed";
  record.claimedAt = now.toISOString();
  await writeOrder(env.ORDERS, record);
  return json(
    {
      credential,
      plan: record.plan,
      expiresAt: record.expiresAt,
      orderId: record.merchantOrderId,
    },
    200,
    headers
  );
}

function recoverable(record, now) {
  if (!record || record.status === "revoked" || record.status === "pending" || record.status === "closed") {
    return false;
  }
  if (record.status !== "paid" && record.status !== "claimed") {
    return false;
  }
  if (!record.emailHash || !record.issuedAt || !record.expiresAt || !record.plan) {
    return false;
  }
  const expires = new Date(record.expiresAt);
  if (Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

async function handleRecover(request, env, deps) {
  const headers = corsHeaders(request, env);
  if (!headers) {
    return json({ error: "origin" }, 403);
  }
  if (missingConfig(env)) {
    return json({ error: "unconfigured" }, 500, headers);
  }
  const now = deps.now();
  const text = await request.text();
  if (text.length > 2048) {
    return json(RECOVER_FAILED, 400, headers);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    return json(RECOVER_FAILED, 400, headers);
  }
  const order = body && typeof body.order === "string" ? body.order : "";
  const email = normalizeEmail(body && body.email);
  let limitedKind = "";
  try {
    const bucket = Math.floor(now.getTime() / WINDOW_MS);
    const ipKey = `rl:recover:ip:${clientIp(request)}:${bucket}`;
    if ((await readCount(env.ORDERS, ipKey)) >= RECOVER_IP_LIMIT) {
      limitedKind = "ip";
    } else {
      await bumpCount(env.ORDERS, ipKey, 700);
    }
    if (!limitedKind && ORDER_ID.test(order)) {
      const winKey = `rl:recover:win:${order}:${bucket}`;
      if ((await readCount(env.ORDERS, winKey)) >= RECOVER_ORDER_WINDOW) {
        limitedKind = "window";
      } else {
        await bumpCount(env.ORDERS, winKey, 700);
        const totalKey = `rl:recover:total:${order}`;
        if ((await readCount(env.ORDERS, totalKey)) >= RECOVER_ORDER_TOTAL) {
          limitedKind = "total";
        } else {
          await bumpCount(env.ORDERS, totalKey, RECOVER_TOTAL_TTL);
        }
      }
    }
  } catch (error) {
    limitedKind = "ip";
  }
  if (limitedKind) {
    return json({ error: "recover_limited" }, 429, { ...headers, "Retry-After": "60" });
  }
  if (!email) {
    return json(RECOVER_FAILED, 400, headers);
  }
  const record = await readOrder(env.ORDERS, order);
  const actual = await sha256Hex(email);
  const expected = record && typeof record.emailHash === "string" ? record.emailHash : "";
  if (!recoverable(record, now) || !hashesEqual(expected, actual)) {
    return json(RECOVER_FAILED, 400, headers);
  }
  const token = await signCredential(env.UNLOCK_PRIVATE_KEY, {
    orderId: record.merchantOrderId,
    plan: record.plan,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
  record.credential = token;
  await writeOrder(env.ORDERS, record);
  return json(
    {
      credential: token,
      plan: record.plan,
      expiresAt: record.expiresAt,
      orderId: record.merchantOrderId,
    },
    200,
    headers
  );
}

async function handleStatus(request, env, deps) {
  const headers = corsHeaders(request, env);
  if (!headers) {
    return json({ error: "origin" }, 403);
  }
  if (missingConfig(env)) {
    return json({ error: "unconfigured" }, 500, headers);
  }
  const now = deps.now();
  const bucket = Math.floor(now.getTime() / WINDOW_MS);
  const blocked = await limited(env.ORDERS, `rl:read:${clientIp(request)}:${bucket}`, READ_LIMIT);
  if (blocked) {
    return json({ error: "rate_limited" }, 429, { ...headers, "Retry-After": "60" });
  }
  const order = await orderParam(request);
  const record = await readOrder(env.ORDERS, order);
  if (!record) {
    return json({ state: "unknown" }, 404, headers);
  }
  return json(
    {
      orderId: record.merchantOrderId,
      state: record.status,
      plan: record.plan,
      expiresAt: record.expiresAt || null,
    },
    200,
    headers
  );
}

export async function handleRequest(request, env, deps = {}) {
  const runtime = {
    fetch: deps.fetch || fetch,
    now: deps.now || (() => new Date()),
  };
  const url = new URL(request.url);
  if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    const headers = corsHeaders(request, env);
    if (!headers) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers });
  }
  if (url.pathname === "/api/checkout" && request.method === "POST") {
    return handleCheckout(request, env, runtime);
  }
  if (url.pathname === "/api/waffo/webhook" && request.method === "POST") {
    return handleWebhook(request, env, runtime);
  }
  if (url.pathname === "/api/claim" && (request.method === "GET" || request.method === "POST")) {
    return handleClaim(request, env, runtime);
  }
  if (url.pathname === "/api/recover" && request.method === "POST") {
    return handleRecover(request, env, runtime);
  }
  if (url.pathname === "/api/status" && (request.method === "GET" || request.method === "POST")) {
    return handleStatus(request, env, runtime);
  }
  return json({ error: "not_found" }, 404);
}
