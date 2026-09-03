import assert from 'node:assert/strict';
import test from 'node:test';
import { buildThreadsDrafts, containsUnsafeContent, normalizeVerifiedSignals, planDemandOperation } from './plan-demand-operation.mjs';

const config = {
  minImpressions: 20,
  minSessions: 5,
  signalMaxAgeDays: 21,
  pages: [
    {
      path: '/pages/toilet-office.html',
      title: '事業所向け簡易トイレ比較',
      audience: '会社や施設',
      problem: '断水時に必要な回数が足りるか',
      checks: ['回数', '保存年数', '凝固剤と袋の構成'],
      caution: '便器への適合や保管場所も販売ページで確認してください。',
      quantityBasis: '簡易トイレは1人1日5回を一つの目安として考えます',
      topics: ['断水', '簡易トイレ']
    },
    {
      path: '/pages/blackout-power.html',
      title: '停電対策用品比較',
      audience: '事業所',
      problem: '停電時に止められない機器は何か',
      checks: ['Wh数', '定格出力', '充電方法'],
      caution: '接続する機器との適合はメーカーへ確認してください。',
      quantityBasis: '必要なWh数は、使う機器の消費電力と使用時間から考えます',
      topics: ['停電', '猛暑']
    }
  ]
};

const page = (path, primary, overrides = {}) => ({
  path, primary, priorityScore: 50, impressions: 50, searchClicks: 2, sessions: 6,
  pageViews: 10, rakutenClicks: 0, ...overrides
});

test('returns NO_ACTION without measured or verified demand', () => {
  const result = planDemandOperation({ pagePriorities: [page('/pages/toilet-office.html', 'monitor', { impressions: 0, sessions: 0 })] }, config, [], [], new Date('2026-09-03T00:00:00Z'));
  assert.equal(result.status, 'NO_ACTION');
});

test('selects exactly one highest-impact page deterministically', () => {
  const report = { periods: { current: { endDate: '2026-08-31' } }, pagePriorities: [
    page('/pages/toilet-office.html', 'ranking_opportunity', { priorityScore: 80 }),
    page('/pages/blackout-power.html', 'conversion_gap', { priorityScore: 110 })
  ] };
  const first = planDemandOperation(report, config, [], [], new Date('2026-09-03T00:00:00Z'));
  const second = planDemandOperation(report, config, [], [], new Date('2026-09-03T00:00:00Z'));
  assert.equal(first.status, 'ACTION');
  assert.equal(first.page, '/pages/blackout-power.html');
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.drafts.length, 3);
});

test('supports ranking, conversion and winner evidence', () => {
  for (const primary of ['ranking_opportunity', 'conversion_gap', 'winner']) {
    const result = planDemandOperation({ pagePriorities: [page('/pages/toilet-office.html', primary)] }, config, [], [], new Date('2026-09-03T00:00:00Z'));
    assert.equal(result.primary, primary);
  }
});

test('does not repeat an existing fingerprint', () => {
  const report = { pagePriorities: [page('/pages/toilet-office.html', 'conversion_gap')] };
  const first = planDemandOperation(report, config, [], [], new Date('2026-09-03T00:00:00Z'));
  const second = planDemandOperation(report, config, [], [{ fingerprint: first.fingerprint }], new Date('2026-09-03T00:00:00Z'));
  assert.equal(second.status, 'NO_ACTION');
});

test('accepts recent verified official signals and rejects emergency alerts', () => {
  const signals = [
    { id: 'guide', status: 'verified', kind: 'official_guidance', label: '公式資料更新', topics: ['停電'], observedAt: '2026-09-01T00:00:00Z', sourceUrl: 'https://www.jma.go.jp/guide', weight: 30 }
  ];
  const normalized = normalizeVerifiedSignals(signals, new Date('2026-09-03T00:00:00Z'), 21);
  assert.deepEqual(normalized.map((item) => item.id), ['guide']);
  const result = planDemandOperation({ pagePriorities: [page('/pages/blackout-power.html', 'visibility_gap', { impressions: 0, sessions: 0 })] }, config, signals, [], new Date('2026-09-03T00:00:00Z'));
  assert.equal(result.status, 'ACTION');
  assert.equal(result.trigger, '公式資料更新');
});

test('rejects stale, unverified and non-HTTPS signals', () => {
  const signals = [
    { id: 'old', status: 'verified', topics: ['停電'], observedAt: '2026-01-01T00:00:00Z', sourceUrl: 'https://www.jma.go.jp/old' },
    { id: 'guess', status: 'unverified', topics: ['停電'], observedAt: '2026-09-02T00:00:00Z', sourceUrl: 'https://www.jma.go.jp/guess' },
    { id: 'http', status: 'verified', topics: ['停電'], observedAt: '2026-09-02T00:00:00Z', sourceUrl: 'http://example.go.jp/http' }
  ];
  assert.equal(normalizeVerifiedSignals(signals, new Date('2026-09-03T00:00:00Z'), 21).length, 0);
});

test('drafts include disclosure, a site URL and stay within Threads length', () => {
  const drafts = buildThreadsDrafts(config.pages[0]);
  assert.equal(drafts.length, 3);
  for (const draft of drafts) {
    assert.match(draft, /^【PR】/);
    assert.match(draft, /jigyousho-bousai\.com/);
    assert.ok(draft.length <= 500);
  }
});

test('detects secrets, email addresses and prohibited claims', () => {
  assert.equal(containsUnsafeContent('GOOGLE_API_KEY=secret-value'), true);
  assert.equal(containsUnsafeContent('person@example.com'), true);
  assert.equal(containsUnsafeContent('これだけで大丈夫'), true);
  assert.equal(containsUnsafeContent('回数と保存年数を確認する'), false);
});

test('does not treat visibility alone as demand', () => {
  const result = planDemandOperation({
    pagePriorities: [page('/pages/blackout-power.html', 'visibility_gap', { impressions: 25, sessions: 6 })]
  }, config, [], [], new Date('2026-09-03T00:00:00Z'));
  assert.equal(result.status, 'NO_ACTION');
});

test('blocks all commercial drafts during a verified active emergency', () => {
  const signals = [{
    id: 'active-alert', status: 'verified', kind: 'emergency_alert', label: '緊急警報',
    topics: ['台風'], observedAt: '2026-09-03T00:00:00Z',
    sourceUrl: 'https://www.jma.go.jp/alert', weight: 50
  }];
  const result = planDemandOperation({
    pagePriorities: [page('/pages/blackout-power.html', 'conversion_gap', { impressions: 200, sessions: 20 })]
  }, { ...config, trustedDomains: ['jma.go.jp'] }, signals, [], new Date('2026-09-03T01:00:00Z'));
  assert.equal(result.status, 'NO_ACTION');
  assert.equal(result.reasonCode, 'ACTIVE_EMERGENCY');
  assert.equal(result.drafts, undefined);
});

test('rejects non-official signal domains when a trust list is configured', () => {
  const signals = [{
    id: 'unknown', status: 'verified', kind: 'official_guidance', label: '不明な情報',
    topics: ['停電'], observedAt: '2026-09-02T00:00:00Z',
    sourceUrl: 'https://example.com/guide', weight: 50
  }];
  const result = planDemandOperation({
    pagePriorities: [page('/pages/blackout-power.html', 'visibility_gap', { impressions: 0, sessions: 0 })]
  }, { ...config, trustedDomains: ['jma.go.jp'] }, signals, [], new Date('2026-09-03T00:00:00Z'));
  assert.equal(result.status, 'NO_ACTION');
});

test('skips the page used by the latest action', () => {
  const report = { pagePriorities: [
    page('/pages/toilet-office.html', 'conversion_gap', { priorityScore: 100 }),
    page('/pages/blackout-power.html', 'ranking_opportunity', { priorityScore: 80 })
  ] };
  const history = [{
    createdAt: '2026-09-02T00:00:00Z', path: '/pages/toilet-office.html',
    primary: 'conversion_gap', fingerprint: 'old-key', status: 'ACTION'
  }];
  const result = planDemandOperation(report, { ...config, cooldownDays: 60 }, [], history, new Date('2026-09-03T00:00:00Z'));
  assert.equal(result.page, '/pages/blackout-power.html');
});
