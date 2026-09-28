const test = require("node:test");
const assert = require("node:assert/strict");

test("empty worker config makes no network calls", async () => {
  const { startCheckout, pollClaim, readStatus, recoverAccess } = await import("./payment-client.js");
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("network");
  };
  assert.equal(await startCheckout({ baseUrl: "", plan: "monthly", fetchImpl }), null);
  assert.equal(await startCheckout({ baseUrl: "   ", plan: "quarterly", fetchImpl }), null);
  assert.deepEqual(await pollClaim({ baseUrl: "", orderId: "m12345678", fetchImpl, attempts: 3 }), {
    status: "unconfigured",
  });
  assert.equal(await readStatus({ baseUrl: "", orderId: "m12345678", fetchImpl }), null);
  assert.deepEqual(await recoverAccess({ baseUrl: "", orderId: "m12345678", email: "buyer@example.com", fetchImpl }), {
    status: "unconfigured",
  });
  assert.equal(calls, 0);
});
