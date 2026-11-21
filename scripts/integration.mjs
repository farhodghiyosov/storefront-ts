import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_API_URL ?? 'http://localhost:4000/api';
async function post(payload) {
  const response = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: await response.json() };
}
const catalog = await fetch(`${base}/products`);
assert.equal(catalog.status, 200);
const products = await catalog.json();
assert.ok(products.length >= 8);
const product = products.find((p) => p.stock >= 2);
assert.ok(product, 'Seed the test database before running this test');
const payload = {
  requestId: randomUUID(),
  customerName: 'Тестовый покупатель',
  email: 'test@example.com',
  phone: '+79990000000',
  address: 'Тестовый город, улица Тестовая, дом 1',
  items: [{ productId: product.id, quantity: 1 }],
};
const invalid = await post({
  ...payload,
  requestId: randomUUID(),
  items: [{ productId: product.id, quantity: -1 }],
});
assert.equal(invalid.status, 400);
const tampered = await post({ ...payload, total: 1 });
assert.equal(tampered.status, 400);
const missing = await post({
  ...payload,
  requestId: randomUUID(),
  items: [{ productId: randomUUID(), quantity: 1 }],
});
assert.equal(missing.status, 409);
const results = await Promise.all([post(payload), post(payload)]);
for (const result of results)
  assert.equal(result.status, 201, JSON.stringify(result.body));
assert.equal(
  results[0].body.id,
  results[1].body.id,
  'Concurrent retries return the same order',
);
assert.equal(
  results[0].body.total,
  product.price + (product.price >= 1_000_000 ? 0 : 39_000),
);
assert.equal(
  results[0].body.customerName,
  undefined,
  'Order response does not expose customer details',
);
const changedPayload = await post({
  ...payload,
  customerName: 'Другой покупатель',
});
assert.equal(changedPayload.status, 409);
const sequentialRetry = await post(payload);
assert.equal(sequentialRetry.body.id, results[0].body.id);
const updated = await (await fetch(`${base}/products/${product.slug}`)).json();
assert.equal(
  updated.stock,
  product.stock - 1,
  'Stock decremented exactly once',
);
const insufficient = await post({
  ...payload,
  requestId: randomUUID(),
  items: [
    { productId: product.id, quantity: 20 },
    { productId: product.id, quantity: 20 },
  ],
});
assert.equal(insufficient.status, 400);
const unchanged = await (
  await fetch(`${base}/products/${product.slug}`)
).json();
assert.equal(
  unchanged.stock,
  updated.stock,
  'Transaction rolls back all stock changes on failure',
);
console.log(
  'PASS: catalog, DTO validation, price tampering, missing products, concurrent idempotency, server totals, stock decrement, transaction rollback.',
);
console.log(
  'Integration test creates one test order and consumes one item. Use a dedicated database.',
);

// Isolated fixtures exercise a real rollback and the race for the final item.
const { Pool } = await import('pg');
const { config } = await import('dotenv');
config({ quiet: true });
assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL for fixture tests');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const readyId = `00000000-0000-4000-8000-${suffix}`;
const emptyId = `ffffffff-ffff-4fff-8fff-${suffix}`;
const fixtureRequestIds = [];
try {
  await pool.query(
    `INSERT INTO "Product" (id, slug, name, description, category, price, stock, image, color) VALUES ($1, $2, 'Fixture ready', 'Integration fixture', 'Тест', 50000, 1, '/products/form-vase.svg', '#eee'), ($3, $4, 'Fixture empty', 'Integration fixture', 'Тест', 50000, 0, '/products/form-vase.svg', '#eee')`,
    [readyId, `fixture-ready-${suffix}`, emptyId, `fixture-empty-${suffix}`],
  );
  const rollbackId = randomUUID();
  fixtureRequestIds.push(rollbackId);
  const rollback = await post({
    ...payload,
    requestId: rollbackId,
    items: [
      { productId: readyId, quantity: 1 },
      { productId: emptyId, quantity: 1 },
    ],
  });
  assert.equal(rollback.status, 409);
  const stockAfterRollback = await pool.query(
    'SELECT stock FROM "Product" WHERE id = $1',
    [readyId],
  );
  assert.equal(
    stockAfterRollback.rows[0].stock,
    1,
    'Earlier stock changes roll back when a later item is unavailable',
  );
  const contenders = [randomUUID(), randomUUID()];
  fixtureRequestIds.push(...contenders);
  const race = await Promise.all(
    contenders.map((requestId) =>
      post({
        ...payload,
        requestId,
        items: [{ productId: readyId, quantity: 1 }],
      }),
    ),
  );
  assert.deepEqual(
    race.map((r) => r.status).sort(),
    [201, 409],
    'Exactly one customer can buy the final item',
  );
  const finalStock = await pool.query(
    'SELECT stock FROM "Product" WHERE id = $1',
    [readyId],
  );
  assert.equal(finalStock.rows[0].stock, 0);
  const winner = race.find((r) => r.status === 201);
  const winnerIndex = race.findIndex((r) => r.status === 201);
  const retry = await post({
    ...payload,
    requestId: contenders[winnerIndex],
    items: [{ productId: readyId, quantity: 1 }],
  });
  assert.equal(retry.status, 201, 'Retry succeeds after stock reaches zero');
  assert.equal(retry.body.id, winner.body.id);
  console.log(
    'PASS: transaction rollback, concurrent final-item purchase, retry after stock exhaustion.',
  );
} finally {
  await pool.query('DELETE FROM "Order" WHERE "requestId" = ANY($1::text[])', [
    fixtureRequestIds,
  ]);
  await pool.query('DELETE FROM "Product" WHERE id = ANY($1::text[])', [
    [readyId, emptyId],
  ]);
  await pool.end();
}
