/**
 * Choices for places where Waffo's public docs disagree or stay silent.
 * Everything that is not a direct copy of a documented field lives here.
 *
 * 1. orderAction. The create-order schema says to redirect only when
 *    orderStatus is AUTHORIZATION_REQUIRED. Checkout steps say to redirect
 *    to webUrl or deeplinkUrl after create. We redirect whenever the JSON
 *    has webUrl or deeplinkUrl, including PAY_IN_PROGRESS. actionType
 *    DEEPLINK uses deeplinkUrl; every other actionType uses webUrl first.
 * 2. goodsInfo. OpenAPI required lists appName AND goodsName AND goodsUrl.
 *    The field text says goodsUrl or appName, and the official quickstart
 *    sends only goodsName + goodsUrl. We follow the quickstart.
 * 3. Expiry start. Use result.orderCompletedAt when it parses as a date.
 *    Otherwise use the Worker clock at the moment the webhook is processed.
 * 4. Chargeback CASE_WON, CANCELED, and SETTLED do not revoke access.
 *    They also do not restore access that was already revoked. A later
 *    CASE_WON leaves a revoked credential revoked.
 * 5. The second /api/claim is always refused, including the same browser.
 *    The return page must store the credential as soon as the first 200
 *    arrives. A lost first response cannot be fetched again.
 */

const REFUND_REVOKE = new Set(["ORDER_FULLY_REFUNDED", "ORDER_PARTIALLY_REFUNDED"]);

const CHARGEBACK_REVOKE = new Set([
  "ACTION_REQUIRED",
  "UNDER_REVIEW",
  "SECOND_CYCLE_RESPONSE_REQUIRED",
  "ESCALATE_TO_2ND_CYCLE",
  "CASE_LOST",
  "ACCEPTED",
  "EXPIRED",
]);

export function checkoutUrlFromOrderAction(orderAction) {
  let action = orderAction;
  if (typeof action === "string") {
    try {
      action = JSON.parse(action);
    } catch (error) {
      return "";
    }
  }
  if (!action || typeof action !== "object") {
    return "";
  }
  if (action.actionType === "DEEPLINK" && typeof action.deeplinkUrl === "string" && action.deeplinkUrl) {
    return action.deeplinkUrl;
  }
  if (typeof action.webUrl === "string" && action.webUrl) {
    return action.webUrl;
  }
  if (typeof action.deeplinkUrl === "string" && action.deeplinkUrl) {
    return action.deeplinkUrl;
  }
  return "";
}

export function goodsInfoForOrder(goodsName, goodsUrl) {
  return { goodsName, goodsUrl };
}

export function paymentInstant(result, now) {
  const raw = result && result.orderCompletedAt;
  if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return now;
}

export function refundShouldRevoke(result) {
  return Boolean(result && REFUND_REVOKE.has(result.refundStatus));
}

export function chargebackShouldRevoke(result) {
  return Boolean(result && CHARGEBACK_REVOKE.has(result.chargebackStatus));
}

export function shouldIssuePayment(eventType, result) {
  return eventType === "PAYMENT_NOTIFICATION" && Boolean(result) && result.orderStatus === "PAY_SUCCESS";
}
