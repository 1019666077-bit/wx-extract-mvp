const CREATE_PATH = "/v1/actions/checkout/create-session";
const RSA_OID = Uint8Array.from([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
]);

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function derLength(length) {
  if (length < 128) {
    return Uint8Array.of(length);
  }
  if (length < 256) {
    return Uint8Array.of(0x81, length);
  }
  return Uint8Array.of(0x82, (length >> 8) & 0xff, length & 0xff);
}

function derTag(tag, content) {
  const len = derLength(content.length);
  const out = new Uint8Array(1 + len.length + content.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(content, 1 + len.length);
  return out;
}

function readDer(bytes, offset) {
  if (offset >= bytes.length) {
    throw new Error("truncated rsa key");
  }
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

function wrapPkcs1(pkcs1) {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const octet = derTag(0x04, pkcs1);
  return derTag(0x30, concatBytes([version, RSA_OID, octet]));
}

/**
 * Dashboard "Create API Key" downloads a PKCS#1 PEM (`BEGIN RSA PRIVATE KEY`).
 * WebCrypto only imports PKCS#8. A PKCS#8 key's second field is a SEQUENCE;
 * a PKCS#1 key's second field is the modulus INTEGER.
 */
export function normalizeRsaPrivateKey(bytes) {
  const outer = readDer(bytes, 0);
  if (outer.tag !== 0x30) {
    throw new Error("bad rsa private key");
  }
  const version = readDer(bytes, outer.start);
  if (version.tag !== 0x02) {
    throw new Error("bad rsa private key");
  }
  const next = bytes[version.end];
  if (next === 0x30) {
    return bytes;
  }
  if (next === 0x02) {
    return wrapPkcs1(bytes);
  }
  throw new Error("bad rsa private key");
}

export function decodeKeyMaterial(text) {
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
    normalizeRsaPrivateKey(decodeKeyMaterial(material)),
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

export async function sha256Base64(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToBase64(new Uint8Array(digest));
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

export function parseWaffoSignature(header) {
  const parts = {};
  for (const pair of String(header || "").split(",")) {
    const eq = pair.indexOf("=");
    if (eq < 0) {
      continue;
    }
    parts[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return { t: parts.t || "", v1: parts.v1 || "" };
}

export function signatureFresh(t, nowMs) {
  if (!/^\d+$/.test(String(t || ""))) {
    return false;
  }
  const stamp = Number(t);
  return Math.abs(nowMs - stamp) <= 45 * 60 * 1000;
}

export const PLANS = {
  monthly: { amount: "5.99", days: 30 },
  quarterly: { amount: "13.99", days: 90 },
};

export const CREATE_SESSION_PATH = CREATE_PATH;

export function buildCheckoutBody({ productId, buyerEmail, language, successUrl, orderMerchantExternalId }) {
  return {
    productId,
    currency: "USD",
    buyerEmail,
    language,
    successUrl,
    orderMerchantExternalId,
  };
}

export function canonicalRequest(method, path, timestamp, body) {
  return `${method}\n${path}\n${timestamp}\n${body}`;
}

export async function createCheckoutSession(env, bodyObject, now, fetchImpl = fetch) {
  const body = JSON.stringify(bodyObject);
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const bodyHash = await sha256Base64(body);
  const privateKey = await importRsaPrivateKey(env.WAFFO_PANCAKE_API_KEY);
  const signature = await signRsaSha256(
    privateKey,
    canonicalRequest("POST", CREATE_PATH, timestamp, bodyHash)
  );
  const base = String(env.WAFFO_API_BASE || "").replace(/\/$/, "");
  const response = await fetchImpl(`${base}${CREATE_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Merchant-Id": env.WAFFO_PANCAKE_MERCHANT_ID,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body,
  });
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    parsed = null;
  }
  return { ok: response.ok, status: response.status, parsed };
}
