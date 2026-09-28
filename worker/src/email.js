/**
 * Recovery identity.
 * PAYMENT_NOTIFICATION result matches Order Inquiry, which includes
 * result.userInfo.userEmail (the merchant user email; the public schema has
 * no separate payer-email field). A missing value, or the documented
 * userId@examples.com fallback, is not a payer address. Checkout then asks
 * the buyer, and that address is what we hash if the notification has none.
 * KV stores only the SHA-256 of the normalized address so a dump of the
 * order record does not contain the mailbox.
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

export function isPlaceholderEmail(email) {
  return email.endsWith("@examples.com");
}

function userInfoOf(result) {
  let info = result && result.userInfo;
  if (typeof info === "string") {
    try {
      info = JSON.parse(info);
    } catch (error) {
      return null;
    }
  }
  if (!info || typeof info !== "object") {
    return null;
  }
  return info;
}

export function payerEmailFromResult(result) {
  const info = userInfoOf(result);
  const email = normalizeEmail(info && info.userEmail);
  if (!email || isPlaceholderEmail(email)) {
    return "";
  }
  return email;
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
