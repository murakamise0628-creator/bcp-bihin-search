import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as kpi from './collect-growth-kpis.mjs';
import { inspectPriorityUrls, appendIndexSheet, indexHeaders, indexPaths } from './collect-growth-kpis.mjs';

test('index inspection is bounded and retains only safe diagnostic fields', async () => {
  const calls = [];
  const rows = await inspectPriorityUrls('https://jigyousho-bousai.com/', 'test-token', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', googleCanonical: 'https://jigyousho-bousai.com/pages/water-food-stock.html', userCanonical: 'https://example.org/?private=data', referringUrls: ['private-data'], sitemap: ['private-sitemap'] } } }) };
  }, '2026-09-23T00:00:00Z');
  assert.equal(calls.length, 5);
  assert.deepEqual(rows.map(row => row[1]), indexPaths);
  assert.ok(calls.every(call => call.url === 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect'));
  assert.ok(rows.every(row => row.length === indexHeaders.length && row[2] === 'OK' && row[3] === 'PASS'));
  assert.equal(rows[0][10], 'OTHER_URL');
  assert.doesNotMatch(JSON.stringify(rows), /private-data|private-sitemap|test-token/);
});

test('index failures and missing results remain unknown without leaking errors', async () => {
  let call = 0;
  const rows = await inspectPriorityUrls('sc-domain:jigyousho-bousai.com', 'token', async () => {
    call++;
    if (call === 1) return { ok: false, status: 403 };
    if (call === 2) throw new Error('secret error');
    return { ok: true, json: async () => ({}) };
  });
  assert.deepEqual(rows.slice(0, 3).map(row => row[2]), ['HTTP_403', 'REQUEST_FAILED', 'MISSING_RESULT']);
  assert.ok(rows.every(row => row[3] === 'UNKNOWN'));
  assert.doesNotMatch(JSON.stringify(rows), /secret/);
  await assert.rejects(inspectPriorityUrls('https://example.com/', 'token'), /Unexpected inspection property/);
});

test('index sheet appends RAW values and rejects an unexpected existing header', async () => {
  const writes = [];
  const response = (body) => ({ ok: true, text: async () => JSON.stringify(body) });
  const mock = async (url, options) => {
    if (url.includes('?fields=')) return response({ sheets: [{ properties: { title: 'Index Status' } }] });
    if (!options.method) return response({ values: [indexHeaders] });
    writes.push({ url, body: JSON.parse(options.body) });
    return response({});
  };
  await appendIndexSheet('test-sheet', 'token', [['=unsafe']], mock);
  assert.equal(writes.length, 1);
  assert.match(writes[0].url, /valueInputOption=RAW/);
  assert.deepEqual(writes[0].body.values, [['=unsafe']]);
  await assert.rejects(appendIndexSheet('test-sheet', 'token', [['row']], async (url) => response(url.includes('?fields=') ? { sheets: [{ properties: { title: 'Index Status' } }] } : { values: [['unexpected']] })), /append cancelled/);
});
import { buildPagePriorities, classifyPageOpportunity, comparison, eventCounts, headersMatch, normalizePagePath, pagePrioritySheetRows, parseServiceAccount, priorityMarkdown, reportingPeriods, sheetRow } from './collect-growth-kpis.mjs';

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

test('creates a secret-free KPI sheet row', () => {
  const report = { collectedAt: '2026-08-10T00:00:00.000Z', periods: { current: { startDate: '2026-07-11', endDate: '2026-08-07' } }, ga: { current: { activeUsers: 10, sessions: 12, organicSessions: 5, pageViews: 20, events: { rakuten_click: 4 }, eventPages: [{ eventName: 'rakuten_click', path: '/pages/toilet-office.html', count: 3 }] }, previous: { organicSessions: 4, events: { rakuten_click: 2 } } }, search: { current: { clicks: 2, impressions: 30, ctr: 0.0667, position: 9.1, queries: [{ key: '会社 簡易トイレ', clicks: 2, impressions: 12 }], pages: [{ key: 'https://jigyousho-bousai.com/pages/toilet-office.html', clicks: 2 }] } } };
  const row = sheetRow(report);
  assert.equal(row.length, 22);
  assert.equal(row[7], 4);
  assert.equal(row[16], 0.25);
  assert.equal(row[19], '');
  assert.equal(JSON.stringify(row).includes('会社 簡易トイレ'), false);
  assert.match(row[21], /toilet-office/);
  assert.equal(JSON.stringify(row).includes('private_key'), false);
});



test('normalizes full URLs and GA paths to the same page', () => {
  assert.equal(normalizePagePath('https://jigyousho-bousai.com/pages/toilet-office.html?utm_source=test'), '/pages/toilet-office.html');
  assert.equal(normalizePagePath('/pages/toilet-office.html/'), '/pages/toilet-office.html');
  assert.equal(normalizePagePath('/index.html'), '/');
  assert.equal(normalizePagePath('(not set)'), null);
  assert.equal(normalizePagePath('https://example.com/pages/toilet-office.html'), null);
});

test('classifies actionable page gaps without inventing conversions', () => {
  assert.equal(classifyPageOpportunity({ sessions: 8, pageViews: 25, rakutenClicks: 0, impressions: 20, position: 5, ctr: 0.2 }).primary, 'conversion_gap');
  assert.equal(classifyPageOpportunity({ sessions: 2, pageViews: 3, rakutenClicks: 0, impressions: 100, position: 6, ctr: 0.01 }).primary, 'snippet_gap');
  assert.equal(classifyPageOpportunity({ sessions: 2, pageViews: 3, rakutenClicks: 0, impressions: 100, position: 14, ctr: 0.02 }).primary, 'ranking_opportunity');
  assert.equal(classifyPageOpportunity({ sessions: 2, pageViews: 3, rakutenClicks: 1, impressions: 100, position: 4, ctr: 0.08 }).primary, 'winner');
});

test('joins GSC pages, GA landing sessions and Rakuten clicks by path', () => {
  const report = {
    siteUrl: 'https://jigyousho-bousai.com',
    search: { current: { pages: [
      { key: 'https://jigyousho-bousai.com/pages/toilet-office.html', clicks: 3, impressions: 120, ctr: 0.025, position: 8.2 },
      { key: 'https://jigyousho-bousai.com/pages/blackout-power.html', clicks: 1, impressions: 60, ctr: 0.0167, position: 14 }
    ] } },
    ga: { current: {
      landingPages: [
        { path: '/pages/toilet-office.html?source=google', sessions: 12, activeUsers: 10 },
        { path: '/pages/blackout-power.html', sessions: 7, activeUsers: 6 }
      ],
      pageViewsByPage: [
        { path: '/pages/toilet-office.html', pageViews: 20, activeUsers: 11 },
        { path: '/pages/blackout-power.html', pageViews: 25, activeUsers: 7 }
      ],
      eventPages: [{ eventName: 'rakuten_click', path: '/pages/toilet-office.html', count: 2 }]
    } }
  };
  const pages = buildPagePriorities(report);
  const toilet = pages.find((row) => row.path === '/pages/toilet-office.html');
  const blackout = pages.find((row) => row.path === '/pages/blackout-power.html');
  assert.equal(toilet.rakutenClicks, 2);
  assert.equal(toilet.rakutenClickRate, 2 / 20);
  assert.equal(toilet.primary, 'snippet_gap');
  assert.equal(blackout.primary, 'conversion_gap');
  assert.equal(pages[0].path, '/pages/blackout-power.html');
  assert.ok(classifyPageOpportunity({ sessions: 2, pageViews: 2, rakutenClicks: 0, impressions: 1000, position: 14, ctr: 0.01 }).priorityScore > classifyPageOpportunity({ sessions: 20, pageViews: 20, rakutenClicks: 0, impressions: 20, position: 5, ctr: 0.2 }).priorityScore);
});

test('creates a readable private priority summary', () => {
  const markdown = priorityMarkdown({
    periods: { current: { startDate: '2026-07-11', endDate: '2026-08-07' } },
    pagePriorities: [{
      path: '/pages/toilet-office.html', impressions: 120, searchClicks: 3, ctr: 0.025,
      position: 8.2, pageViews: 20, sessions: 12, rakutenClicks: 2, rakutenClickRate: 2 / 20,
      primary: 'snippet_gap', action: 'titleを改善する'
    }]
  });
  assert.match(markdown, /週次ページ改善優先度/);
  assert.match(markdown, /toilet-office/);
  assert.match(markdown, /0\.100/);
  assert.doesNotMatch(markdown, /private_key/);
});

test('event counts per PV are not presented as a conversion percentage', () => {
  const markdown = priorityMarkdown({
    periods: { current: { startDate: '2026-08-29', endDate: '2026-09-25' } },
    pagePriorities: [{
      path: '/pages/water-food-stock.html', impressions: 5, searchClicks: 0, ctr: 0,
      position: 8, pageViews: 5, sessions: 5, rakutenClicks: 7, rakutenClickRate: 1.4,
      primary: 'monitor', action: '確認'
    }]
  });
  assert.match(markdown, /楽天クリックイベント\/PV/);
  assert.match(markdown, /1\.400/);
  assert.match(markdown, /購入率・ユニーク利用者のクリック率ではありません/);
  assert.doesNotMatch(markdown, /140\.0%|楽天クリック率/);
});


test('creates private Sheet rows without credentials or personal data', () => {
  const rows = pagePrioritySheetRows({
    collectedAt: '2026-09-03T00:00:00.000Z',
    periods: { current: { startDate: '2026-08-03', endDate: '2026-08-30' } },
    pagePriorities: [{
      path: '/pages/toilet-office.html', impressions: 120, searchClicks: 3, ctr: 0.025,
      position: 8.2, pageViews: 20, sessions: 12, rakutenClicks: 2, rakutenClickRate: 0.1,
      primary: 'snippet_gap', action: 'titleとdescriptionを改善する'
    }]
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 14);
  assert.equal(rows[0][3], '/pages/toilet-office.html');
  assert.equal(rows[0][10], 2);
  assert.equal(rows[0][12], 'snippet_gap');
  assert.equal(/private_key|client_email|村上|誠治/i.test(JSON.stringify(rows)), false);
});


test('requires exact Sheet headers before appending', () => {
  assert.equal(headersMatch(['A', 'B'], ['A', 'B']), true);
  assert.equal(headersMatch(['A', 'C'], ['A', 'B']), false);
  assert.equal(headersMatch(['A'], ['A', 'B']), false);
});

const testAccount = JSON.stringify({
  client_email: 'reader@example.test',
  private_key: crypto.generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
  token_uri: 'https://oauth2.googleapis.com/token'
});

function fakeGoogle(calls, queryRows = [{ keys: ['test-purchase-query'], clicks: 2, impressions: 7, ctr: 2 / 7, position: 9 }]) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    let body = {};
    if (url === 'https://oauth2.googleapis.com/token') body = { access_token: 'test-token' };
    else if (url.includes('/searchAnalytics/query')) {
      const request = JSON.parse(options.body);
      body = { rows: request.dimensions?.includes('query') ? queryRows : [{ keys: request.dimensions?.includes('page') ? ['https://jigyousho-bousai.com/pages/hoikuen-bousai.html'] : undefined, clicks: 3, impressions: 34, ctr: 3 / 34, position: 10 }] };
    } else if (url.includes('?fields=sheets.properties')) {
      body = { sheets: ['Page Priorities', 'Index Status'].map(title => ({ properties: { title } })) };
    }
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

function requestedScope(call) {
  const assertion = new URLSearchParams(call.options.body).get('assertion');
  return JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString()).scope;
}

test('read-only KPI collection ignores configured Sheet and output destinations', async () => {
  const calls = [];
  const output = path.join(os.tmpdir(), `kpi-no-write-${crypto.randomUUID()}.json`);
  const previousOutput = process.env.KPI_OUTPUT_PATH;
  const previousSummary = process.env.KPI_SUMMARY_PATH;
  process.env.KPI_OUTPUT_PATH = output;
  process.env.KPI_SUMMARY_PATH = output + '.md';
  try {
    const report = await kpi.collectGrowthKpis({ readOnly: true, propertyId: '123', sheetId: 'test-sheet', serviceAccount: testAccount, fetchImpl: fakeGoogle(calls), now: new Date('2026-10-06T02:00:00Z') });
    assert.ok(calls.every(call => !/sheets.googleapis.com|urlInspection/.test(call.url)));
    assert.doesNotMatch(requestedScope(calls[0]), /spreadsheets/);
    assert.match(requestedScope(calls[0]), /analytics.readonly/);
    assert.deepEqual(report.periods.current, { startDate: '2026-09-06', endDate: '2026-10-03' });
    assert.equal(fs.existsSync(output), false);
    assert.equal(fs.existsSync(output + '.md'), false);
  } finally {
    if (previousOutput === undefined) delete process.env.KPI_OUTPUT_PATH; else process.env.KPI_OUTPUT_PATH = previousOutput;
    if (previousSummary === undefined) delete process.env.KPI_SUMMARY_PATH; else process.env.KPI_SUMMARY_PATH = previousSummary;
  }
});

test('normal KPI collection retains existing Sheet append behavior', async () => {
  const calls = [];
  await kpi.collectGrowthKpis({ propertyId: '123', sheetId: 'test-sheet', serviceAccount: testAccount, fetchImpl: fakeGoogle(calls) });
  assert.match(requestedScope(calls[0]), /spreadsheets/);
  assert.equal(calls.filter(call => call.url.includes(':append?')).length, 3);
  assert.equal(calls.filter(call => call.url.includes('urlInspection')).length, 5);
});

test('page query reading uses exact page filter, final periods and search-only scope', async () => {
  const calls = [];
  const report = await kpi.readPageSearchQueries({ pagePath: '/pages/hoikuen-bousai.html', serviceAccount: testAccount, fetchImpl: fakeGoogle(calls), now: new Date('2026-10-06T02:00:00Z') });
  assert.equal(requestedScope(calls[0]), 'https://www.googleapis.com/auth/webmasters.readonly');
  const reads = calls.slice(1);
  assert.equal(reads.length, 4);
  assert.ok(reads.every(call => call.url.includes('/searchAnalytics/query')));
  assert.ok(reads.every(call => {
    const body = JSON.parse(call.options.body);
    return body.dataState === 'final' && body.aggregationType === 'auto' && body.dimensionFilterGroups[0].filters[0].expression === 'https://jigyousho-bousai.com/pages/hoikuen-bousai.html';
  }));
  assert.equal(report.search.current.totals.impressions, 34);
  assert.equal(report.search.current.queries[0].query, 'test-purchase-query');
  assert.equal(report.search.current.returnedQueryImpressions, 7);
  assert.equal(report.search.current.allQueriesAvailable, false);
  assert.deepEqual(report.periods.previous, { startDate: '2026-08-09', endDate: '2026-09-05' });
});

test('unreturned queries are not represented as zero demand', async () => {
  const report = await kpi.readPageSearchQueries({ pagePath: '/pages/hoikuen-bousai.html', serviceAccount: testAccount, fetchImpl: fakeGoogle([], []) });
  assert.equal(report.search.current.totals.impressions, 34);
  assert.deepEqual(report.search.current.queries, []);
  assert.equal(report.search.current.queryVisibility, 'not_returned');
  assert.equal(report.search.current.allQueriesAvailable, false);
});

test('missing page totals stay unknown and query result limits are explicit', async () => {
  const response = body => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });
  const report = await kpi.readPageSearchQueries({ pagePath: '/pages/toilet-office.html', serviceAccount: testAccount, fetchImpl: async url => response(url.includes('oauth2') ? { access_token: 'token' } : {}) });
  assert.equal(report.search.current.totals, null);
  assert.equal(report.search.current.allQueriesAvailable, false);
  const limited = await kpi.readPageSearchQueries({ pagePath: '/pages/toilet-office.html', serviceAccount: testAccount, fetchImpl: fakeGoogle([], Array.from({ length: 500 }, () => ({ keys: ['test'], clicks: 0, impressions: 1 }))) });
  assert.equal(limited.search.current.possiblyTruncated, true);
});

test('invalid page and nonboolean read-only flags fail before requests', async () => {
  let count = 0;
  const fetchImpl = async () => { count++; throw new Error('must not request'); };
  for (const pagePath of ['https://example.com/page', '/pages/hoikuen-bousai.html?private=1', '/pages/../private.html', '/unknown']) {
    await assert.rejects(kpi.readPageSearchQueries({ pagePath, fetchImpl }), /Invalid diagnostic page/);
  }
  await assert.rejects(kpi.collectGrowthKpis({ readOnly: 'false', fetchImpl }), /readOnly must be boolean/);
  assert.equal(count, 0);
});

test('CLI requires explicit read-only selection for page queries and rejects unknown flags', () => {
  assert.deepEqual(kpi.parseKpiArgs([]), { readOnly: false });
  assert.deepEqual(kpi.parseKpiArgs(['--read-only']), { readOnly: true });
  assert.deepEqual(kpi.parseKpiArgs(['--read-only', '--page=/pages/hoikuen-bousai.html']), { readOnly: true, pagePath: '/pages/hoikuen-bousai.html' });
  for (const args of [['--page=/pages/hoikuen-bousai.html'], ['--read-onyl'], ['--read-only=false'], ['--read-only', '--page='], ['--read-only', '--read-only']]) {
    assert.throws(() => kpi.parseKpiArgs(args), /Invalid KPI arguments/);
  }
});

test('API failures do not leak search text or raw API errors', async () => {
  await assert.rejects(kpi.readPageSearchQueries({ pagePath: '/pages/hoikuen-bousai.html', serviceAccount: testAccount, fetchImpl: async url => url.includes('oauth2')
    ? { ok: true, json: async () => ({ access_token: 'token' }) }
    : { ok: false, status: 403, text: async () => JSON.stringify({ error: { message: 'test-private-query test-token' } }) } }), error => error.message === 'Search Console page query read failed (403).');
});
