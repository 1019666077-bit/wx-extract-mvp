/**
 * Browser calls to the unlock Worker. An empty baseUrl returns without fetch.
 */

function configured(baseUrl) {
  return typeof baseUrl === "string" && /^https:\/\/\S+$/.test(baseUrl.trim());
}

function endpoint(baseUrl, path) {
  return `${baseUrl.trim().replace(/\/$/, "")}${path}`;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function startCheckout({ baseUrl, plan, script, email, termsAccepted, termsVersion, fetchImpl }) {
  if (!configured(baseUrl) || termsAccepted !== true || typeof termsVersion !== "string" || !termsVersion) {
    return null;
  }
  const fetchFn = fetchImpl || fetch;
  const response = await fetchFn(endpoint(baseUrl, "/api/checkout"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, script, email, termsAccepted: true, termsVersion }),
  });
  const body = await readJson(response);
  if (!response.ok || !body || typeof body.checkoutUrl !== "string") {
    const error = new Error("checkout_failed");
    error.status = response.status;
    throw error;
  }
  return { checkoutUrl: body.checkoutUrl, merchantOrderId: body.merchantOrderId || "" };
}

export async function claimOnce({ baseUrl, orderId, fetchImpl }) {
  if (!configured(baseUrl)) {
    return { status: "unconfigured" };
  }
  const fetchFn = fetchImpl || fetch;
  const response = await fetchFn(endpoint(baseUrl, `/api/claim?order=${encodeURIComponent(orderId)}`), {
    method: "GET",
  });
  const body = await readJson(response);
  if (response.status === 200 && body && typeof body.credential === "string") {
    return { status: "paid", credential: body.credential, plan: body.plan, expiresAt: body.expiresAt, orderId: body.orderId };
  }
  if (response.status === 202) {
    return { status: "pending" };
  }
  if (response.status === 409) {
    return { status: "claimed" };
  }
  if (response.status === 410) {
    return { status: "revoked" };
  }
  if (response.status === 404) {
    return { status: "unknown" };
  }
  return { status: "pending" };
}

export async function pollClaim({ baseUrl, orderId, fetchImpl, sleep, attempts = 20, intervalMs = 3000 }) {
  if (!configured(baseUrl)) {
    return { status: "unconfigured" };
  }
  const wait = sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await wait(intervalMs);
    }
    const result = await claimOnce({ baseUrl, orderId, fetchImpl });
    if (result.status !== "pending") {
      return result;
    }
  }
  return { status: "timeout" };
}

export async function recoverAccess({ baseUrl, orderId, email, fetchImpl }) {
  if (!configured(baseUrl)) {
    return { status: "unconfigured" };
  }
  const fetchFn = fetchImpl || fetch;
  const response = await fetchFn(endpoint(baseUrl, "/api/recover"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: orderId, email }),
  });
  const body = await readJson(response);
  if (response.status === 200 && body && typeof body.credential === "string") {
    return {
      status: "paid",
      credential: body.credential,
      plan: body.plan,
      expiresAt: body.expiresAt,
      orderId: body.orderId,
    };
  }
  if (response.status === 429) {
    return { status: "limited" };
  }
  return { status: "failed" };
}

export async function readStatus({ baseUrl, orderId, fetchImpl }) {
  if (!configured(baseUrl)) {
    return null;
  }
  const fetchFn = fetchImpl || fetch;
  const response = await fetchFn(endpoint(baseUrl, `/api/status?order=${encodeURIComponent(orderId)}`), {
    method: "GET",
  });
  const body = await readJson(response);
  if (!body || typeof body.state !== "string") {
    return null;
  }
  return body;
}

const api = { configured, startCheckout, claimOnce, pollClaim, readStatus, recoverAccess };

if (typeof window !== "undefined") {
  window.VOAPayment = api;
}
