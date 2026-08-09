import assert from 'node:assert/strict';
import test from 'node:test';
import { comparison, eventCounts, parseServiceAccount, reportingPeriods, sheetRow } from './collect-growth-kpis.mjs';

test('uses complete delayed 28-day windows', () => {
  assert.deepEqual(reportingPeriods(new Date('2026-08-10T00:00:00Z'), 28, 3), {
    current: { startDate: '2026-07-11', endDate: '2026-08-07' }, previous: { startDate: '2026-06-13', endDate: '2026-07-10' }
  });
});

test('accepts raw and base64 service account JSON', () => {
  const value = JSON.stringify({ client_email: 'service@example.test', private_key: 'private', token_uri: 'https://oauth2.googleapis.com/token' });
  assert.equal(parseServiceAccount(value).client_email, 'service@example.test');
  assert.equal(parseServiceAccount(Buffer.from(value).toString('base64')).private_key, 'private');
  assert.throws(() => parseServiceAccount('{}'), /incomplete/);
});

test('normalizes GA event rows', () => {
  const report = { rows: [{ dimensionValues: [{ value: 'rakuten_click' }], metricValues: [{ value: '7' }] }] };
  assert.deepEqual(eventCounts(report), { rakuten_click: 7 });
});

test('handles comparisons with a zero baseline', () => {
  assert.equal(comparison(12, 8), 0.5);
  assert.equal(comparison(0, 0), 0);
  assert.equal(comparison(2, 0), null);
});

test('creates a credential-free KPI sheet row', () => {
  const report = { collectedAt: '2026-08-10T00:00:00.000Z', periods: { current: { startDate: '2026-07-11', endDate: '2026-08-07' } }, ga: { current: { activeUsers: 10, sessions: 12, organicSessions: 5, pageViews: 20, events: { rakuten_click: 4 } }, previous: { organicSessions: 4, events: { rakuten_click: 2 } } }, search: { current: { clicks: 2, impressions: 30, ctr: 0.0667, position: 9.1 } } };
  const row = sheetRow(report);
  assert.equal(row.length, 19);
  assert.equal(row[7], 4);
  assert.equal(row[16], 0.25);
  assert.equal(JSON.stringify(row).includes('private_key'), false);
});

