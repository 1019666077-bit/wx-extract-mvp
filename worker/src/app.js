import { signCredential } from "../../js/credential.js";
import { buyerEmailFromEvent, hashesEqual, normalizeEmail, sha256Hex } from "./email.js";
import { isSubscriptionEvent, paymentInstant, refundShouldRevoke, shouldIssuePayment } from "./doc-choices.js";
import {
  buildCheckoutBody,
  createCheckoutSession,
  importRsaPublicKey,
  parseWaffoSignature,
  PLANS,
  signatureFresh,
  verifyRsaSha256,
} from "./waffo.js";

const CHECKOUT_LIMIT = 8;
const READ_LIMIT = 120;
const RECOVER_IP_LIMIT = 8;
const RECOVER_ORDER_WINDOW = 3;
const RECOVER_ORDER_TOTAL = 5;
const RECOVER_TOTAL_TTL = 90 * 24 * 60 * 60;
const EVENT_TTL = 90 * 24 * 60 * 60;
const WINDOW_MS = 10 * 60 * 1000;
const ORDER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const EVENT_ID = /^[A-Za-z0-9_.-]{1,128}$/;
const PRODUCT_ID = /^PROD_[A-Za-z0-9]+$/;
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

function webhookResponse(status, text) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
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

function productId(env, plan) {
  const value = plan === "monthly" ? env.PANCAKE_PRODUCT_MONTHLY : env.PANCAKE_PRODUCT_QUARTERLY;
  return typeof value === "string" && PRODUCT_ID.test(value) ? value : "";
}

function missingConfig(env) {
  const keys = [
    "WAFFO_PANCAKE_API_KEY",
    "WAFFO_PANCAKE_MERCHANT_ID",
    "WAFFO_WEBHOOK_PUBLIC_KEY",
    "UNLOCK_PRIVATE_KEY",
    "WAFFO_API_BASE",
    "ALLOWED_ORIGIN",
  ];
  for (const key of keys) {
    if (!env[key]) {
      return key;
    }
  }
  if (env.PANCAKE_MODE !== "test" && env.PANCAKE_MODE !== "prod") {
    return "PANCAKE_MODE";
  }
  if (!productId(env, "monthly") || !productId(env, "quarterly")) {
    return "PANCAKE_PRODUCT";
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

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

async function readOrder(kv, id) {
  if (!id || !ORDER_ID.test(id)) {
    return null;
  }
  let raw = await kv.get(`order:${id}`);
  if (!raw) {
    const alias = await kv.get(`alias:${id}`);
    if (typeof alias === "string" && ORDER_ID.test(alias)) {
      raw = await kv.get(`order:${alias}`);
    }
  }
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
  if (record.pancakeOrderId && ORDER_ID.test(record.pancakeOrderId)) {
    await kv.put(`alias:${record.pancakeOrderId}`, record.merchantOrderId);
  }
}

function pagePath(script, name) {
  return script === "zh-Hant" ? `/zh-hant/${name}` : `/${name}`;
}

function cashierLanguage(script) {
  return script === "zh-Hant" ? "zh-Hant-TW" : "zh-Hans";
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
  const merchantOrderId = `m${randomHex(16)}`;
  const requestedAt = now.toISOString();
  const record = {
    merchantOrderId,
    plan,
    amount: PLANS[plan].amount,
    currency: "USD",
    productId: productId(env, plan),
    status: "pending",
    credential: null,
    claimed: false,
    emailHash: await sha256Hex(email),
    emailSource: "checkout",
    pancakeOrderId: "",
    sessionId: "",
    createdAt: requestedAt,
    issuedAt: "",
    expiresAt: "",
  };
  await writeOrder(env.ORDERS, record);
  const orderBody = buildCheckoutBody({
    productId: record.productId,
    buyerEmail: email,
    language: cashierLanguage(script),
    successUrl: `${origin}${pagePath(script, "pricing-return.html")}?order=${encodeURIComponent(merchantOrderId)}`,
    orderMerchantExternalId: merchantOrderId,
  });
  let posted;
  try {
    posted = await createCheckoutSession(env, orderBody, now, deps.fetch);
  } catch (error) {
    record.status = "closed";
    await writeOrder(env.ORDERS, record);
    return json({ error: "checkout_failed" }, 502, headers);
  }
  const data = posted.parsed && posted.parsed.data;
  const checkoutUrl = httpsUrl(data && data.checkoutUrl);
  if (!posted.ok || !checkoutUrl) {
    record.status = "closed";
    await writeOrder(env.ORDERS, record);
    return json({ error: "checkout_failed" }, 502, headers);
  }
  if (typeof data.sessionId === "string") {
    record.sessionId = data.sessionId;
  }
  await writeOrder(env.ORDERS, record);
  return json({ checkoutUrl, merchantOrderId }, 200, headers);
}

async function issueCredential(record, event, env, now) {
  const data = event.data || {};
  if (data.currency !== record.currency) {
    return false;
  }
  const paidAt = paymentInstant(event, now);
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
  if (typeof data.orderId === "string" && data.orderId) {
    record.pancakeOrderId = data.orderId;
  }
  return true;
}

async function rememberEvent(kv, eventId, eventType) {
  if (!eventId || !EVENT_ID.test(eventId)) {
    return;
  }
  await kv.put(`event:${eventId}`, eventType || "seen", { expirationTtl: EVENT_TTL });
}

async function handleWebhook(request, env, deps) {
  if (missingConfig(env)) {
    return webhookResponse(500, "unconfigured");
  }
  const raw = await request.text();
  if (raw.length > 65536) {
    return webhookResponse(401, "Invalid signature");
  }
  const parsedHeader = parseWaffoSignature(request.headers.get("X-Waffo-Signature"));
  const now = deps.now();
  if (!signatureFresh(parsedHeader.t, now.getTime())) {
    return webhookResponse(401, "Invalid signature");
  }
  let verified = false;
  try {
    const publicKey = await importRsaPublicKey(env.WAFFO_WEBHOOK_PUBLIC_KEY);
    verified = await verifyRsaSha256(publicKey, `${parsedHeader.t}.${raw}`, parsedHeader.v1);
  } catch (error) {
    verified = false;
  }
  if (!verified) {
    return webhookResponse(401, "Invalid signature");
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch (error) {
    return webhookResponse(200, "OK");
  }
  const eventType = event && event.eventType;
  const data = event && event.data;
  if (!eventType || !data || typeof data !== "object") {
    return webhookResponse(200, "OK");
  }
  if (event.mode !== env.PANCAKE_MODE) {
    return webhookResponse(200, "OK");
  }
  const eventId = typeof event.eventId === "string" ? event.eventId : "";
  if (eventId && EVENT_ID.test(eventId)) {
    const seen = await env.ORDERS.get(`event:${eventId}`);
    if (seen) {
      return webhookResponse(200, "OK");
    }
  }
  if (isSubscriptionEvent(eventType)) {
    await rememberEvent(env.ORDERS, eventId, eventType);
    return webhookResponse(200, "OK");
  }
  const externalId = typeof data.orderMerchantExternalId === "string" ? data.orderMerchantExternalId : "";
  const pancakeOrderId = typeof data.orderId === "string" ? data.orderId : "";
  const record = (await readOrder(env.ORDERS, externalId)) || (await readOrder(env.ORDERS, pancakeOrderId));
  if (!record) {
    if (shouldIssuePayment(eventType) && externalId) {
      return webhookResponse(500, "order missing");
    }
    await rememberEvent(env.ORDERS, eventId, eventType);
    return webhookResponse(200, "OK");
  }
  if (shouldIssuePayment(eventType)) {
    if (record.status !== "revoked" && !record.credential) {
      const issued = await issueCredential(record, event, env, now);
      if (!issued) {
        return webhookResponse(200, "OK");
      }
    }
    const payerEmail = buyerEmailFromEvent(event);
    if (payerEmail && record.status !== "revoked") {
      record.emailHash = await sha256Hex(payerEmail);
      record.emailSource = "notification";
    }
    if (pancakeOrderId && !record.pancakeOrderId) {
      record.pancakeOrderId = pancakeOrderId;
    }
    await writeOrder(env.ORDERS, record);
    await rememberEvent(env.ORDERS, eventId, eventType);
    return webhookResponse(200, "OK");
  }
  if (refundShouldRevoke(eventType)) {
    record.status = "revoked";
    record.credential = null;
    record.revokedAt = now.toISOString();
    await writeOrder(env.ORDERS, record);
    await rememberEvent(env.ORDERS, eventId, eventType);
    return webhookResponse(200, "OK");
  }
  await rememberEvent(env.ORDERS, eventId, eventType);
  return webhookResponse(200, "OK");
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
    let limitId = order;
    if (ORDER_ID.test(order)) {
      const alias = await env.ORDERS.get(`alias:${order}`);
      if (typeof alias === "string" && ORDER_ID.test(alias)) {
        limitId = alias;
      }
    }
    if (!limitedKind && ORDER_ID.test(limitId)) {
      const winKey = `rl:recover:win:${limitId}:${bucket}`;
      if ((await readCount(env.ORDERS, winKey)) >= RECOVER_ORDER_WINDOW) {
        limitedKind = "window";
      } else {
        await bumpCount(env.ORDERS, winKey, 700);
        const totalKey = `rl:recover:total:${limitId}`;
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
