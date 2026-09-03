import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  fetchOfficialSafetySignals,
  parseCurrentTsunamiWarnings,
  parseCurrentVolcanoWarnings,
  parseCurrentWeatherWarnings,
  parseJmaFeedCandidates,
  verifyJmaEmergencyBulletin
} from './fetch-official-safety-signals.mjs';

const feed = (entries) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`;
const entry = ({ title, content, updated, href }) => `<entry><title>${title}</title><updated>${updated}</updated><link href="${href}"/><content type="text">${content}</content></entry>`;
const kind = (name, status = '発表') => `<Kind><Name>${name}</Name><Status>${status}</Status></Kind>`;
const bulletin = ({ kinds = [kind('南海トラフ地震臨時情報')], status = '通常', infoType = '発表' } = {}) =>
  `<Report><Control><Title>南海トラフ地震臨時情報</Title><Status>${status}</Status></Control><Head><InfoType>${infoType}</InfoType></Head><Body>${kinds.join('')}</Body></Report>`;

test('detects an ongoing weather emergency even when its report is older', () => {
  const reports = [{
    reportDatetime: '2026-09-01T00:00:00+09:00',
    warning: { class10Items: [{ areaCode: '130000', kinds: [{ code: '33', status: '継続' }] }] }
  }];
  const signals = parseCurrentWeatherWarnings(reports, new Date('2026-09-03T01:00:00Z'));
  assert.equal(signals.length, 1);
  assert.equal(signals[0].label, '大雨特別警報');
});

test('ignores released weather warnings and keeps only active kinds', () => {
  const reports = [{
    reportDatetime: '2026-09-03T00:00:00+09:00',
    warning: {
      class10Items: [{
        kinds: [
          { code: '33', status: '解除' },
          { code: '35', status: '発表' },
          { code: '10', status: '発表' }
        ]
      }]
    }
  }];
  const signals = parseCurrentWeatherWarnings(reports);
  assert.deepEqual(signals.map((item) => item.label), ['暴風特別警報']);
});

test('reads active tsunami warning state and ignores forecasts without warnings', () => {
  const reports = [
    { rdt: '2026-09-03T00:00:00+09:00', ttl: '津波警報・津波注意報・津波予報', kind: [{ kind: '津波警報' }] },
    { rdt: '2026-09-03T00:01:00+09:00', ttl: '津波予報', kind: [{ kind: '津波予報（若干の海面変動）' }] }
  ];
  assert.deepEqual(parseCurrentTsunamiWarnings(reports).map((item) => item.label), ['津波警報・津波注意報・津波予報', '津波警報']);
});

test('reads only residential-area volcano emergencies', () => {
  const reports = [{
    reportDatetime: '2026-09-01T00:00:00+09:00',
    volcanoInfos: [{ items: [
      { name: '火口周辺危険', condition: '継続' },
      { name: '居住地域危険', condition: '継続' },
      { name: '噴火警報（居住地域）', condition: '解除' }
    ] }]
  }];
  assert.deepEqual(parseCurrentVolcanoWarnings(reports).map((item) => item.label), ['居住地域危険']);
});

test('selects recent Nankai candidates from the earthquake and volcano feed', () => {
  const xml = feed([
    entry({
      title: '南海トラフ地震臨時情報',
      content: '南海トラフ地震臨時情報（巨大地震注意）',
      updated: '2026-09-01T00:00:00Z',
      href: 'https://www.data.jma.go.jp/developer/xml/data/nankai_0.xml'
    }),
    entry({
      title: '震源・震度に関する情報',
      content: '震度1',
      updated: '2026-09-03T00:00:00Z',
      href: 'https://www.data.jma.go.jp/developer/xml/data/quake_0.xml'
    })
  ]);
  assert.equal(parseJmaFeedCandidates(xml, new Date('2026-09-03T01:00:00Z')).length, 1);
});

test('rejects a released Kind and retains an active Kind in the same bulletin', () => {
  const candidate = {
    observedAt: '2026-09-03T00:00:00Z',
    sourceUrl: 'https://www.data.jma.go.jp/developer/xml/data/nankai_0.xml'
  };
  const released = verifyJmaEmergencyBulletin(
    bulletin({ kinds: [kind('南海トラフ地震臨時情報', '解除')] }),
    candidate
  );
  assert.equal(released, null);

  const mixed = verifyJmaEmergencyBulletin(
    bulletin({ kinds: [
      kind('南海トラフ地震臨時情報', '解除'),
      kind('津波警報', '継続')
    ] }),
    candidate
  );
  assert.equal(mixed.label, '津波警報');
});

test('rejects cancelled and malformed detailed bulletins', () => {
  const candidate = {
    observedAt: '2026-09-03T00:00:00Z',
    sourceUrl: 'https://www.data.jma.go.jp/developer/xml/data/nankai_0.xml'
  };
  assert.equal(verifyJmaEmergencyBulletin(bulletin({ status: '取消' }), candidate), null);
  assert.equal(verifyJmaEmergencyBulletin(bulletin({ infoType: '取消' }), candidate), null);
  assert.equal(verifyJmaEmergencyBulletin('<feed/>', candidate), null);
});

test('rejects lookalike non-JMA links', () => {
  const xml = feed([entry({
    title: '南海トラフ地震臨時情報',
    content: '南海トラフ地震臨時情報',
    updated: '2026-09-03T00:00:00Z',
    href: 'https://www.data.jma.go.jp.example.com/fake.xml'
  })]);
  assert.equal(parseJmaFeedCandidates(xml, new Date('2026-09-03T01:00:00Z')).length, 0);
});

test('fetches every current-state source and verifies detailed candidates', async () => {
  const eqvolXml = feed([entry({
    title: '南海トラフ地震臨時情報',
    content: '南海トラフ地震臨時情報（調査中）',
    updated: '2026-09-03T00:00:00Z',
    href: 'https://www.data.jma.go.jp/developer/xml/data/nankai_0.xml'
  })]);
  const payloads = new Map([
    ['https://www.jma.go.jp/bosai/warning/data/r8/map.json', []],
    ['https://www.jma.go.jp/bosai/warning/data/r8/map_time.json', { latestControlDatetime: '2026-09-03T00:30:00Z' }],
    ['https://www.jma.go.jp/bosai/tsunami/data/list.json', []],
    ['https://www.jma.go.jp/bosai/volcano/data/warning.json', []],
    ['https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml', eqvolXml],
    ['https://www.data.jma.go.jp/developer/xml/data/nankai_0.xml', bulletin()]
  ]);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const value = payloads.get(url);
    return {
      ok: value !== undefined,
      status: value === undefined ? 404 : 200,
      text: async () => typeof value === 'string' ? value : JSON.stringify(value)
    };
  };
  const output = path.join(os.tmpdir(), `jma-safety-${Date.now()}.json`);
  const result = await fetchOfficialSafetySignals(output, {
    fetchImpl,
    now: new Date('2026-09-03T01:00:00Z')
  });
  assert.equal(result.candidateCount, 1);
  assert.equal(result.signals.length, 1);
  assert.equal(calls.length, 6);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).schemaVersion, 2);
  fs.rmSync(output, { force: true });
});

test('fails closed when an official current-state source cannot be fetched', async () => {
  await assert.rejects(
    fetchOfficialSafetySignals('unused.json', {
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' })
    }),
    /failed/
  );
});
