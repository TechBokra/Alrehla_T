import test from "node:test";
import assert from "node:assert/strict";
import {
  canCancelOrder,
  canDeliverOrder,
  canMarkElectronicOrderSent,
  canShipOrder,
  canStartOrderPreparation,
  canTransitionOrder,
} from "../src/features/orders/order-policy.ts";

test("fulfillment transitions allow only the intended previous states", () => {
  assert.equal(canStartOrderPreparation("paid"), true);
  assert.equal(canStartOrderPreparation("pending"), false);
  assert.equal(canShipOrder("paid"), true);
  assert.equal(canShipOrder("preparing"), true);
  assert.equal(canShipOrder("pending"), false);
  assert.equal(canDeliverOrder("shipped"), true);
  assert.equal(canDeliverOrder("paid"), false);
  assert.equal(canCancelOrder("preparing"), true);
  assert.equal(canCancelOrder("delivered"), false);
  assert.equal(canTransitionOrder("refunded", "preparing"), false);
});

test("electronic delivery requires an eligible non-box order and electronic item", () => {
  const eligible = {
    status: "paid",
    deliveryEmail: "buyer@example.com",
    itemFormats: ["printed", "electronic"],
  };
  assert.equal(canMarkElectronicOrderSent(eligible), true);
  assert.equal(canMarkElectronicOrderSent({ ...eligible, boxPlanId: "box-1" }), false);
  assert.equal(canMarkElectronicOrderSent({ ...eligible, deliveryEmail: " " }), false);
  assert.equal(canMarkElectronicOrderSent({ ...eligible, electronicSentAt: "2026-11-02T00:00:00Z" }), false);
  assert.equal(canMarkElectronicOrderSent({ ...eligible, itemFormats: ["printed"] }), false);
  assert.equal(canMarkElectronicOrderSent({ ...eligible, status: "pending" }), false);
});
