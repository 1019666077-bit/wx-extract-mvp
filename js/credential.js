/**
 * Unlock credential: base64url(JSON).base64url(Ed25519 signature).
 * The signature covers the UTF-8 bytes of the first segment (the base64url
 * text), so verification uses those exact bytes and does not re-serialize JSON.
 * Payload fields are only orderId, plan, issuedAt, and expiresAt.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return base64ToBytes(padded + pad);
}

export function decodeKeyMaterial(text) {
  const stripped = String(text || "")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!stripped) {
    throw new Error("empty key");
  }
  return base64ToBytes(stripped);
}

export async function importUnlockPrivateKey(material) {
  if (material && typeof material === "object" && material.type === "private") {
    return material;
  }
  return crypto.subtle.importKey("pkcs8", decodeKeyMaterial(material), { name: "Ed25519" }, false, ["sign"]);
}

export async function importUnlockPublicKey(material) {
  if (material && typeof material === "object" && material.type === "public") {
    return material;
  }
  return crypto.subtle.importKey("spki", decodeKeyMaterial(material), { name: "Ed25519" }, false, ["verify"]);
}

function canonicalPayload(payload) {
  return JSON.stringify({
    orderId: payload.orderId,
    plan: payload.plan,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}

export async function signCredential(privateKeyMaterial, payload) {
  const key = await importUnlockPrivateKey(privateKeyMaterial);
  const payloadPart = bytesToBase64Url(textEncoder.encode(canonicalPayload(payload)));
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, textEncoder.encode(payloadPart));
  return `${payloadPart}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyCredential(token, publicKeyMaterial, now = new Date()) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed" };
  }
  let signatureOk = false;
  try {
    const key = await importUnlockPublicKey(publicKeyMaterial);
    signatureOk = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64UrlToBytes(parts[1]),
      textEncoder.encode(parts[0])
    );
  } catch (error) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!signatureOk) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload;
  try {
    payload = JSON.parse(textDecoder.decode(base64UrlToBytes(parts[0])));
  } catch (error) {
    return { ok: false, reason: "malformed" };
  }
  if (!payload || typeof payload.orderId !== "string" || !payload.orderId) {
    return { ok: false, reason: "malformed" };
  }
  if (payload.plan !== "monthly" && payload.plan !== "quarterly") {
    return { ok: false, reason: "malformed" };
  }
  const issued = new Date(payload.issuedAt);
  const expires = new Date(payload.expiresAt);
  if (Number.isNaN(issued.getTime()) || Number.isNaN(expires.getTime()) || expires.getTime() <= issued.getTime()) {
    return { ok: false, reason: "malformed" };
  }
  if (now.getTime() > expires.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return {
    ok: true,
    payload: {
      orderId: payload.orderId,
      plan: payload.plan,
      issuedAt: issued.toISOString(),
      expiresAt: expires.toISOString(),
    },
  };
}

const api = { signCredential, verifyCredential, importUnlockPrivateKey, importUnlockPublicKey };

if (typeof window !== "undefined") {
  window.VOACredential = api;
}
