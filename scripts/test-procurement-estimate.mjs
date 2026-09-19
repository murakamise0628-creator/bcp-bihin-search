import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { procurementEstimate } = require('./procurement-estimate.js');

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
