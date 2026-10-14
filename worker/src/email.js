/**
 * Recovery identity.
 * Pancake webhook data.buyerEmail is always present on documented events
 * and is the buyer address collected by the Merchant of Record cashier.
 * Checkout still stores a hash of the address the buyer typed, because the
 * cashier can change the prefilled value. A later event with buyerEmail
 * replaces that hash. KV stores only the SHA-256 of the normalized address.
 */

export function normalizeEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text.length < 6 || text.length > 64) {
    return "";
  }
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(text)) {
    return "";
  }
  return text;
}

export function buyerEmailFromEvent(event) {
  const data = event && event.data;
  return normalizeEmail(data && data.buyerEmail);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function hashesEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length || left.length === 0) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}
