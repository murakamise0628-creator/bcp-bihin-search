import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOfficialSafetySignals, parseJmaEmergencyFeed } from './fetch-official-safety-signals.mjs';

const feed = (entries) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`;
const entry = ({ title, updated, href }) => `<entry><title>${title}</title><updated>${updated}</updated><link href="${href}"/></entry>`;

test('keeps only recent emergency-class JMA entries', () => {
  const xml = feed([
    entry({ title: '大津波警報', updated: '2026-09-03T00:00:00Z', href: 'https://www.data.jma.go.jp/developer/xml/data/test.xml' }),
    entry({ title: '気象警報・注意報', updated: '2026-09-03T00:00:00Z', href: 'https://www.data.jma.go.jp/developer/xml/data/normal.xml' }),
    entry({ title: '特別警報', updated: '2026-08-01T00:00:00Z', href: 'https://www.data.jma.go.jp/developer/xml/data/old.xml' })
  ]);
  const signals = parseJmaEmergencyFeed(xml, new Date('2026-09-03T01:00:00Z'));
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, 'emergency_alert');
  assert.equal(signals[0].sourceVerified, true);
  assert.deepEqual(signals[0].topics, ['地震']);
});

test('rejects lookalike non-JMA links', () => {
  const xml = feed([entry({
    title: '特別警報',
    updated: '2026-09-03T00:00:00Z',
    href: 'https://data.jma.go.jp.example.com/fake'
  })]);
  assert.equal(parseJmaEmergencyFeed(xml, new Date('2026-09-03T01:00:00Z')).length, 0);
});

test('fails closed when official feed cannot be fetched', async () => {
  await assert.rejects(
    fetchOfficialSafetySignals('unused.json', { fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /failed/
  );
});
