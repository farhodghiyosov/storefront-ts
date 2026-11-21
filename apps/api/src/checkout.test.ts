import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals } from './checkout';
test('calculates integer amounts and delivery below threshold', () => {
  assert.deepEqual(
    calculateTotals([
      { price: 199_000, quantity: 2 },
      { price: 89_000, quantity: 1 },
    ]),
    { subtotal: 487_000, shipping: 39_000, total: 526_000 },
  );
});
test('delivery is free exactly at the threshold', () => {
  assert.deepEqual(calculateTotals([{ price: 500_000, quantity: 2 }]), {
    subtotal: 1_000_000,
    shipping: 0,
    total: 1_000_000,
  });
});
