import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { procurementEstimate, selectPurchasePlan } = require('./procurement-estimate.js');

test('purchase example compares multiple small packs against a larger single pack', () => {
  const small = { quantity: 100, price: 4000 };
  const large = { quantity: 1000, price: 50000 };
  const result = selectPurchasePlan(750, [large, small]);
  assert.equal(result.candidate, small);
  assert.equal(result.packages, 8);
  assert.equal(result.supplied, 800);
  assert.equal(result.cost, 32000);
});

test('total price, rather than unit price or number of packs, selects a purchase example', () => {
  const small = { quantity: 50, price: 2000 };
  const bulk = { quantity: 200, price: 7000 };
  assert.equal(selectPurchasePlan(100, [bulk, small]).cost, 4000);
  assert.equal(selectPurchasePlan(750, [small, bulk]).cost, 28000);
});

test('equal totals prefer less surplus, then fewer packs', () => {
  const exact = { quantity: 150, price: 6000 };
  const surplus = { quantity: 200, price: 6000 };
  const fifty = { quantity: 50, price: 2000 };
  assert.equal(selectPurchasePlan(150, [surplus, exact]).candidate, exact);
  assert.equal(selectPurchasePlan(150, [fifty, exact]).candidate, exact);
});

test('invalid and unknown prices never become free purchase examples', () => {
  for (const required of [0, -1, 1.5, NaN, Infinity, '750', 100000001]) {
    assert.equal(selectPurchasePlan(required, [{ quantity: 100, price: 4000 }]), null);
  }
  assert.equal(selectPurchasePlan(750, []), null);
  for (const candidate of [null, {}, { quantity: 100, price: 0 }, { quantity: 100, price: -1 },
    { quantity: 100, price: '' }, { quantity: 1.5, price: 4000 }, { quantity: 0, price: 4000 },
    { quantity: Infinity, price: 4000 }, { quantity: 100, price: 1.5 }]) {
    assert.equal(selectPurchasePlan(750, [candidate]), null);
  }
});

test('deduct stock, round packages up, and price whole packages', () => {
  assert.deepEqual(procurementEstimate(270, '30', '12', '1800'),
    { missing: 240, packages: 20, cost: 36000, error: '' });
  assert.equal(procurementEstimate(270, '20', '12', '1800').packages, 21);
});
test('sufficient stock needs no purchase even without a candidate', () => {
  assert.deepEqual(procurementEstimate(90, '100', '', ''),
    { missing: 0, packages: 0, cost: 0, error: '' });
});
test('unknown package and price never become zero-cost estimates', () => {
  assert.equal(procurementEstimate(90, '0', '', '').packages, null);
  assert.equal(procurementEstimate(90, '0', '12', '').cost, null);
  assert.equal(procurementEstimate(90, '', '12', '100').missing, null);
});
test('reject negative, fractional discrete, nonfinite and oversized values', () => {
  for (const stock of ['-1', 'Infinity', 'no', '1e15']) {
    assert.equal(procurementEstimate(90, stock, '12', '100').missing, null);
  }
  assert.equal(procurementEstimate(90, '0', '0', '100').packages, null);
  assert.equal(procurementEstimate(90, '0', '-1', '100').packages, null);
  assert.equal(procurementEstimate(90, '0', '12', '-100').cost, null);
  assert.equal(procurementEstimate(90, '0.5', '12', '100', true).missing, null);
  assert.equal(procurementEstimate(90, '0', '1.5', '100', true).packages, null);
});
test('water decimals do not add a spurious package', () => {
  assert.equal(procurementEstimate(3, '0.9', '0.3', '100').packages, 7);
  assert.equal(procurementEstimate(0.001, '0', '100000000', '100').packages, 1);
});
