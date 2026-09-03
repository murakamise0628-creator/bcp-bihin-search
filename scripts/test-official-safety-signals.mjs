import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fetchOfficialSafetySignals, parseJmaFeedCandidates, verifyJmaEmergencyBulletin } from './fetch-official-safety-signals.mjs';

const feed = (entries) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`;
const entry = ({ title, content, updated, href }) => `<entry><title>${title}</title><updated>${updated}</updated><link href="${href}"/><content type="text">${content}</content></entry>`;
const bulletin = ({ name = '大雨特別警報', status = '通常', infoType = '発表' } = {}) =>
  `<Report><Control><Title>気象特別警報・警報・注意報</Title><Status>${status}</Status></Control><Head><InfoType>${infoType}</InfoType><Headline><Text>${name}を発表しました。</Text></Headline></Head><Body><Kind><Name>${name}</Name></Kind></Body></Report>`;

test('does not mistake a bulletin type title for an active emergency', () => {
  const xml = feed([entry({
    title: '気象特別警報・警報・注意報',
    content: '大雨注意報を発表しています。',
    updated: '2026-09-03T00:00:00Z',
    href: 'https://www.data.jma.go.jp/developer/xml/data/normal_0.xml'
  })]);
  assert.equal(parseJmaFeedCandidates(xml, new Date('2026-09-03T01:00:00Z')).length, 0);
});

test('selects likely emergency entries then verifies their individual XML', () => {
  const candidate = {
    title: '気象特別警報・警報・注意報',
    content: '大雨特別警報を発表しました。',
    observedAt: '2026-09-03T00:00:00Z',
    sourceUrl: 'https://www.data.jma.go.jp/developer/xml/data/special_0.xml'
  };
  const xml = feed([entry({
    title: candidate.title, content: candidate.content, updated: candidate.observedAt, href: candidate.sourceUrl
  })]);
  const candidates = parseJmaFeedCandidates(xml, new Date('2026-09-03T01:00:00Z'));
  assert.equal(candidates.length, 1);
  const signal = verifyJmaEmergencyBulletin(bulletin(), candidates[0], new Date('2026-09-03T01:00:00Z'));
  assert.equal(signal.kind, 'emergency_alert');
  assert.equal(signal.sourceVerified, true);
  assert.deepEqual(signal.topics, ['台風']);
});

test('rejects cancelled, cleared and malformed bulletins', () => {
  const candidate = { observedAt: '2026-09-03T00:00:00Z', sourceUrl: 'https://www.data.jma.go.jp/developer/xml/data/special_0.xml' };
  assert.equal(verifyJmaEmergencyBulletin(bulletin({ status: '取消' }), candidate), null);
  assert.equal(verifyJmaEmergencyBulletin(bulletin({ infoType: '取消' }), candidate), null);
  assert.equal(verifyJmaEmergencyBulletin(bulletin({ name: '大雨注意報' }), candidate), null);
  assert.equal(verifyJmaEmergencyBulletin('<feed/>', candidate), null);
});

test('rejects lookalike non-JMA links', () => {
  const xml = feed([entry({
    title: '津波警報・注意報・予報',
    content: '津波警報を発表しました。',
    updated: '2026-09-03T00:00:00Z',
    href: 'https://data.jma.go.jp.example.com/fake.xml'
  })]);
  assert.equal(parseJmaFeedCandidates(xml, new Date('2026-09-03T01:00:00Z')).length, 0);
});

test('fetches and verifies individual candidate bulletins', async () => {
  const feedXml = feed([entry({
    title: '気象特別警報・警報・注意報',
    content: '大雨特別警報を発表しました。',
    updated: '2026-09-03T00:00:00Z',
    href: 'https://www.data.jma.go.jp/developer/xml/data/special_0.xml'
  })]);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => url.endsWith('extra.xml') ? feedXml : bulletin() };
  };
  const output = path.join(os.tmpdir(), `jma-safety-${Date.now()}.json`);
  const result = await fetchOfficialSafetySignals(output, { fetchImpl, now: new Date('2026-09-03T01:00:00Z') });
  assert.equal(result.candidateCount, 1);
  assert.equal(result.signals.length, 1);
  assert.equal(calls.length, 2);
  fs.rmSync(output, { force: true });
});

test('fails closed when official feed cannot be fetched', async () => {
  await assert.rejects(
    fetchOfficialSafetySignals('unused.json', { fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /failed/
  );
});
