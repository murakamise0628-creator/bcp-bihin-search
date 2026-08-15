import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPagePriorities, classifyPageOpportunity, comparison, eventCounts, normalizePagePath, parseServiceAccount, priorityMarkdown, reportingPeriods, sheetRow } from './collect-growth-kpis.mjs';

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
  assert.match(row[19], /会社 簡易トイレ/);
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
  assert.equal(classifyPageOpportunity({ sessions: 8, pageViews: 25, rakutenClicks: 0, impressions: 5, position: 0, ctr: 0 }).primary, 'conversion_gap');
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
  assert.match(markdown, /10\.0%/);
  assert.doesNotMatch(markdown, /private_key/);
});
