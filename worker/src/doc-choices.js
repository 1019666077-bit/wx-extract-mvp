/**
 * Choices for Pancake fields the public docs leave to the merchant.
 * Protocol names below are copied from the docs, not invented.
 *
 * 1. API Key auth, not Store Slug. Store Slug silently drops
 *    orderMerchantExternalId, so a webhook could not be tied to the pending
 *    order. The price is the dashboard product price: the body does not
 *    include priceSnapshot.
 * 2. successUrl is where the buyer goes after clicking Done on the cashier.
 *    Pancake does not redirect automatically, and it has no cancelUrl.
 *    A declined or abandoned checkout sends no webhook.
 * 3. order.completed is the only event that issues a credential. Tax can
 *    make chargedAmount differ from the product price, so a paid USD order
 *    is not rejected for the charged total. Currency must still be USD.
 * 4. refund.succeeded means funds were returned and revokes access.
 *    refund.failed means no money moved and does not revoke. There is no
 *    refund.processing webhook; tickets in review are invisible until they
 *    settle.
 * 5. Pancake has no chargeback webhook. Chargebacks arrive by email to the
 *    merchant, who replies to chargebacks@waffo.ai. This Worker does not
 *    revoke on an invented chargeback event.
 * 6. subscription.* is acknowledged and ignored. One-time 30/90 day access
 *    is the live mode. Enabling subscriptions later would extend the
 *    credential on renewal and would need a decision for cancel and past_due.
 * 7. Recovery prefers data.buyerEmail from the event. Checkout still asks
 *    for an email because the cashier can change the prefilled address.
 *    KV stores only the SHA-256 of the normalized address.
 * 8. Webhook signatures use the Settings → Webhooks public key over
 *    `${t}.${rawBody}`. t may be up to 45 minutes old because retries keep
 *    the original timestamp. Duplicate protection is the payload event id.
 * 9. The second /api/claim is always refused, including the same browser.
 *    /api/recover re-signs the same issuedAt and expiresAt.
 */

export function paymentInstant(event, now) {
  const raw = event && event.timestamp;
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return now;
}

export function shouldIssuePayment(eventType) {
  return eventType === "order.completed";
}

export function refundShouldRevoke(eventType) {
  return eventType === "refund.succeeded";
}

export function isSubscriptionEvent(eventType) {
  return typeof eventType === "string" && eventType.startsWith("subscription.");
}
