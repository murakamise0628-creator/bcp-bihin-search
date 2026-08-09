import test from 'node:test';
import assert from 'node:assert/strict';

import { auditRefreshData } from './verify-refresh.mjs';

const now = Date.parse('2026-07-25T00:00:00.000Z');

function products(count, fetchedAt = '2026-07-24T23:30:00.000Z') {
  return Array.from({ length: count }, (_, index) => ({
    itemCode: `item-${index + 1}`,
    fetchedAt
  }));
}

test('accepts a complete fresh page', () => {
  const data = {
    schemaVersion: 2,
    pages: [{ slug: 'office-bichiku', products: products(8) }]
  };
  assert.deepEqual(auditRefreshData(data, { now, maxAgeHours: 12 }), []);
});

test('requires 12 fresh emergency food sets in a full refresh audit', () => {
  const foodProducts = products(12).map((product, index) => ({
    ...product,
    productType: 'food',
    titleRaw: `法人向け非常食セット ${index + 1} 3日分 9食`
  }));
  const data = { schemaVersion: 2, pages: [{ slug: 'water-food-stock', products: foodProducts }] };
  assert.deepEqual(auditRefreshData(data, { now, maxAgeHours: 12, requireDerivedPages: true }), []);
});

test('rejects fallback data even when product count is sufficient', () => {
  const data = {
    schemaVersion: 2,
    pages: [{
      slug: 'office-bichiku',
      staleReason: 'API unavailable',
      products: products(8)
    }]
  };
  assert.match(auditRefreshData(data, { now })[0], /fresh API data was not available/);
});

test('rejects old product data', () => {
  const data = {
    schemaVersion: 2,
    pages: [{
      slug: 'office-bichiku',
      products: products(8, '2026-07-23T00:00:00.000Z')
    }]
  };
  assert.ok(auditRefreshData(data, { now, maxAgeHours: 12 }).some((issue) => issue.includes('older than')));
});

test('rejects insufficient and duplicate candidates', () => {
  const candidates = products(7);
  candidates[1].itemCode = candidates[0].itemCode;
  const data = {
    schemaVersion: 2,
    pages: [{ slug: 'office-bichiku', products: candidates }]
  };
  const issues = auditRefreshData(data, { now });
  assert.ok(issues.some((issue) => issue.includes('8 required')));
  assert.ok(issues.some((issue) => issue.includes('duplicate itemCode')));
});
