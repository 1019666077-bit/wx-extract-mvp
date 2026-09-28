import { goodsInfoForOrder } from "./doc-choices.js";

const API_VERSION = "1.0.0";

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeKeyMaterial(text) {
  const stripped = String(text || "")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!stripped) {
    throw new Error("empty key");
  }
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function importRsaPrivateKey(material) {
  return crypto.subtle.importKey(
    "pkcs8",
    decodeKeyMaterial(material),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function importRsaPublicKey(material) {
  return crypto.subtle.importKey(
    "spki",
    decodeKeyMaterial(material),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export async function signRsaSha256(privateKey, body) {
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(body)
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyRsaSha256(publicKey, body, signatureB64) {
  if (!signatureB64 || typeof signatureB64 !== "string") {
    return false;
  }
  let signature;
  try {
    const binary = atob(signatureB64.replace(/\s+/g, ""));
    signature = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      signature[i] = binary.charCodeAt(i);
    }
  } catch (error) {
    return false;
  }
  try {
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      new TextEncoder().encode(body)
    );
  } catch (error) {
    return false;
  }
}

export const PLANS = {
  monthly: {
    amount: "5.99",
    days: 30,
    description: "Let's Learn English monthly access",
    goodsName: "Let's Learn English monthly",
  },
  quarterly: {
    amount: "13.99",
    days: 90,
    description: "Let's Learn English quarterly access",
    goodsName: "Let's Learn English quarterly",
  },
};

export function buildCreateOrderBody({
  plan,
  paymentRequestId,
  merchantOrderId,
  merchantId,
  notifyUrl,
  successRedirectUrl,
  failedRedirectUrl,
  cancelRedirectUrl,
  goodsUrl,
  requestedAt,
  userEmail,
}) {
  const spec = PLANS[plan];
  return {
    paymentRequestId,
    merchantOrderId,
    orderCurrency: "USD",
    orderAmount: spec.amount,
    orderDescription: spec.description,
    orderRequestedAt: requestedAt,
    notifyUrl,
    successRedirectUrl,
    failedRedirectUrl,
    cancelRedirectUrl,
    merchantInfo: { merchantId },
    userInfo: {
      userId: merchantOrderId,
      userEmail,
      userTerminal: "WEB",
    },
    paymentInfo: { productName: "ONE_TIME_PAYMENT" },
    goodsInfo: goodsInfoForOrder(spec.goodsName, goodsUrl),
  };
}

export function buildInquiryBody(paymentRequestId) {
  return { paymentRequestId };
}

export async function waffoPost(env, path, bodyObject, fetchImpl = fetch) {
  const body = JSON.stringify(bodyObject);
  const privateKey = await importRsaPrivateKey(env.WAFFO_PRIVATE_KEY);
  const signature = await signRsaSha256(privateKey, body);
  const base = String(env.WAFFO_API_BASE || "").replace(/\/$/, "");
  const response = await fetchImpl(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": env.WAFFO_API_KEY,
      "X-SIGNATURE": signature,
      "X-API-VERSION": API_VERSION,
    },
    body,
  });
  const raw = await response.text();
  const headerSig = response.headers.get("X-SIGNATURE");
  const publicKey = await importRsaPublicKey(env.WAFFO_PUBLIC_KEY);
  const verified = await verifyRsaSha256(publicKey, raw, headerSig);
  if (!verified) {
    const error = new Error("waffo response signature rejected");
    error.code = "bad_response_signature";
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const failure = new Error("waffo response was not json");
    failure.code = "bad_response";
    throw failure;
  }
  return { parsed, raw };
}

/**
 * Order inquiry. Callers must not issue an unlock credential from this result.
 * Only a verified PAYMENT_NOTIFICATION webhook issues a credential.
 */
export async function inquireOrder(env, paymentRequestId, fetchImpl = fetch) {
  const { parsed } = await waffoPost(env, "/api/v1/order/inquiry", buildInquiryBody(paymentRequestId), fetchImpl);
  return parsed;
}
