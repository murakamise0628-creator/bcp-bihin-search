import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'data', 'kpi-config.json');
const headers = [
  '取得日時', '開始日', '終了日', 'アクティブユーザー', 'セッション', '自然検索セッション', 'PV',
  '楽天クリック', '数量計算', '備蓄チェック', 'CSVダウンロード', '有料導線クリック',
  '検索クリック', '検索表示回数', '検索CTR', '平均掲載順位', '自然検索前期比', '楽天クリック前期比', '注記',
  '上位検索語', '上位検索ページ', '楽天クリック上位ページ'
];

export function reportingPeriods(now, days = 28, delay = 3) {
  if (!Number.isInteger(days) || days < 1 || !Number.isInteger(delay) || delay < 0) throw new Error('Invalid reporting window.');
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(day);
  end.setUTCDate(end.getUTCDate() - delay);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  const iso = (value) => value.toISOString().slice(0, 10);
  return {
    current: { startDate: iso(start), endDate: iso(end) },
    previous: { startDate: iso(previousStart), endDate: iso(previousEnd) }
  };
}

export function parseServiceAccount(value) {
  if (!value) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required.');
  let account;
  try { account = JSON.parse(value); }
  catch {
    try { account = JSON.parse(Buffer.from(value, 'base64').toString('utf8')); }
    catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be JSON or base64 JSON.'); }
  }
  if (!account.client_email || !account.private_key || !account.token_uri) throw new Error('Service account fields are incomplete.');
  return account;
}

export async function accessToken(account, fetchImpl = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/spreadsheets',
    aud: account.token_uri,
    iat: now,
    exp: now + 3600
  })}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
  const response = await fetchImpl(account.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`Google OAuth failed (${response.status}).`);
  return body.access_token;
}

async function googleJson(url, token, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Google API failed (${response.status}): ${body.error?.message || 'unknown error'}`);
  return body;
}

function metric(report, name) {
  const index = (report.metricHeaders || []).findIndex((item) => item.name === name);
  return index >= 0 ? Number(report.rows?.[0]?.metricValues?.[index]?.value || 0) : 0;
}

export function eventCounts(report) {
  return Object.fromEntries((report.rows || []).map((row) => [row.dimensionValues?.[0]?.value, Number(row.metricValues?.[0]?.value || 0)]));
}

async function ga(propertyId, token, request, fetchImpl) {
  return googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, token, {
    method: 'POST', body: JSON.stringify(request)
  }, fetchImpl);
}

async function gaPeriod(propertyId, token, period, events, fetchImpl) {
  const dateRanges = [period];
  const [summary, organic, eventReport, landing, pageViewsByPage, eventPages] = await Promise.all([
    ga(propertyId, token, { dateRanges, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] }, fetchImpl),
    ga(propertyId, token, {
      dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }],
      dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } }
    }, fetchImpl),
    ga(propertyId, token, {
      dateRanges, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], limit: 100,
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: events, caseSensitive: true } } }
    }, fetchImpl),
    ga(propertyId, token, {
      dateRanges, dimensions: [{ name: 'landingPagePlusQueryString' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 100
    }, fetchImpl),
    ga(propertyId, token, {
      dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 100
    }, fetchImpl),
    ga(propertyId, token, {
      dateRanges, dimensions: [{ name: 'eventName' }, { name: 'pagePath' }], metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: events, caseSensitive: true } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 100
    }, fetchImpl)
  ]);
  return {
    activeUsers: metric(summary, 'activeUsers'), sessions: metric(summary, 'sessions'), pageViews: metric(summary, 'screenPageViews'),
    organicSessions: metric(organic, 'sessions'), events: eventCounts(eventReport),
    landingPages: (landing.rows || []).map((row) => ({ path: row.dimensionValues?.[0]?.value || '', sessions: Number(row.metricValues?.[0]?.value || 0), activeUsers: Number(row.metricValues?.[1]?.value || 0) })),
    pageViewsByPage: (pageViewsByPage.rows || []).map((row) => ({ path: row.dimensionValues?.[0]?.value || '', pageViews: Number(row.metricValues?.[0]?.value || 0), activeUsers: Number(row.metricValues?.[1]?.value || 0) })),
    eventPages: (eventPages.rows || []).map((row) => ({ eventName: row.dimensionValues?.[0]?.value || '', path: row.dimensionValues?.[1]?.value || '', count: Number(row.metricValues?.[0]?.value || 0) }))
  };
}

async function searchQuery(site, token, body, fetchImpl) {
  return googleJson(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, token, {
    method: 'POST', body: JSON.stringify(body)
  }, fetchImpl);
}

async function searchPeriod(site, token, period, fetchImpl) {
  const base = { ...period, type: 'web', dataState: 'final' };
  const [total, queries, pages] = await Promise.all([
    searchQuery(site, token, base, fetchImpl),
    searchQuery(site, token, { ...base, dimensions: ['query'], rowLimit: 50 }, fetchImpl),
    searchQuery(site, token, { ...base, dimensions: ['page'], rowLimit: 50 }, fetchImpl)
  ]);
  const normalize = (rows) => (rows || []).map((row) => ({ key: row.keys?.[0] || '', clicks: Number(row.clicks || 0), impressions: Number(row.impressions || 0), ctr: Number(row.ctr || 0), position: Number(row.position || 0) }));
  const row = total.rows?.[0] || {};
  return { clicks: Number(row.clicks || 0), impressions: Number(row.impressions || 0), ctr: Number(row.ctr || 0), position: Number(row.position || 0), queries: normalize(queries.rows), pages: normalize(pages.rows) };
}

export function comparison(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number.isFinite(previous) ? (current - previous) / previous : null;
}

export function normalizePagePath(value, siteUrl = 'https://jigyousho-bousai.com') {
  if (!value) return '/';
  try {
    const url = new URL(value, siteUrl);
    const pathName = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '');
    return pathName || '/';
  } catch {
    const pathName = String(value).split(/[?#]/)[0].replace(/\/{2,}/g, '/').replace(/\/$/, '');
    return pathName || '/';
  }
}

export function classifyPageOpportunity(row, thresholds = {}) {
  const limits = {
    minImpressions: Number(thresholds.minImpressions ?? 20),
    lowVisibilityImpressions: Number(thresholds.lowVisibilityImpressions ?? 10),
    minPageViews: Number(thresholds.minPageViews ?? thresholds.minSessions ?? 5),
    lowCtr: Number(thresholds.lowCtr ?? 0.03),
    topResultPosition: Number(thresholds.topResultPosition ?? 10),
    opportunityPosition: Number(thresholds.opportunityPosition ?? 20)
  };
  const signals = [];
  if (row.pageViews >= limits.minPageViews && row.rakutenClicks === 0) signals.push('conversion_gap');
  if (row.impressions >= limits.minImpressions && row.position > 0 && row.position <= limits.topResultPosition && row.ctr < limits.lowCtr) signals.push('snippet_gap');
  if (row.impressions >= limits.minImpressions && row.position > limits.topResultPosition && row.position <= limits.opportunityPosition) signals.push('ranking_opportunity');
  if (row.impressions < limits.lowVisibilityImpressions) signals.push('visibility_gap');
  if (row.rakutenClicks > 0) signals.push('winner');
  if (!signals.length) signals.push('monitor');

  const order = ['conversion_gap', 'snippet_gap', 'ranking_opportunity', 'visibility_gap', 'winner', 'monitor'];
  const primary = order.find((value) => signals.includes(value));
  const actions = {
    conversion_gap: '商品比較・価格確認CTA・商品との一致を見直す',
    snippet_gap: '検索意図に合わせてtitleとdescriptionを改善する',
    ranking_opportunity: '本文の不足回答と関連ページからの内部リンクを補強する',
    visibility_gap: '検索需要とインデックス状況を確認し、対象クエリを絞る',
    winner: '流入クエリと楽天クリック導線を維持し、近いページへ展開する',
    monitor: '急いで変更せず、次回データまで推移を確認する'
  };
  const weights = { conversion_gap: 100, snippet_gap: 90, ranking_opportunity: 80, visibility_gap: 50, winner: 20, monitor: 0 };
  return {
    primary,
    signals,
    action: actions[primary],
    priorityScore: Math.round((weights[primary] || 0) + Math.min(row.impressions, 1000) / 100 + Math.min(row.pageViews, 100) / 10)
  };
}

export function buildPagePriorities(report, thresholds = {}) {
  const siteUrl = report.siteUrl || 'https://jigyousho-bousai.com';
  const pages = new Map();
  const ensure = (value) => {
    const pagePath = normalizePagePath(value, siteUrl);
    if (!pages.has(pagePath)) pages.set(pagePath, {
      path: pagePath, impressions: 0, searchClicks: 0, ctr: 0, position: 0,
      sessions: 0, activeUsers: 0, pageViews: 0, rakutenClicks: 0
    });
    return pages.get(pagePath);
  };

  for (const row of report.search?.current?.pages || []) {
    Object.assign(ensure(row.key), {
      impressions: Number(row.impressions || 0),
      searchClicks: Number(row.clicks || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0)
    });
  }
  for (const row of report.ga?.current?.landingPages || []) {
    const page = ensure(row.path);
    page.sessions += Number(row.sessions || 0);
    page.activeUsers += Number(row.activeUsers || 0);
  }
  for (const row of report.ga?.current?.pageViewsByPage || []) {
    const page = ensure(row.path);
    page.pageViews += Number(row.pageViews || 0);
    page.activeUsers = Math.max(page.activeUsers, Number(row.activeUsers || 0));
  }
  for (const row of report.ga?.current?.eventPages || []) {
    if (row.eventName !== 'rakuten_click') continue;
    ensure(row.path).rakutenClicks += Number(row.count || 0);
  }

  return [...pages.values()].map((page) => {
    const rakutenClickRate = page.pageViews > 0 ? page.rakutenClicks / page.pageViews : null;
    return { ...page, rakutenClickRate, ...classifyPageOpportunity({ ...page, rakutenClickRate }, thresholds) };
  }).sort((a, b) => b.priorityScore - a.priorityScore || b.impressions - a.impressions || b.sessions - a.sessions);
}

export function priorityMarkdown(report, limit = 10) {
  const esc = (value) => String(value ?? '').replace(/\|/g, '\\|');
  const percent = (value) => value === null || value === undefined ? '-' : `${(value * 100).toFixed(1)}%`;
  const rows = (report.pagePriorities || []).slice(0, limit).map((row) =>
    `| ${esc(row.path)} | ${row.impressions} | ${row.searchClicks} | ${percent(row.ctr)} | ${row.position ? row.position.toFixed(1) : '-'} | ${row.pageViews} | ${row.sessions} | ${row.rakutenClicks} | ${percent(row.rakutenClickRate)} | ${row.primary} | ${esc(row.action)} |`
  );
  return [
    '# 週次ページ改善優先度',
    '',
    `対象期間: ${report.periods.current.startDate} - ${report.periods.current.endDate}`,
    '',
    '| ページ | 表示 | 検索クリック | CTR | 順位 | PV | ランディングセッション | 楽天クリック | 楽天クリック率 | 判定 | 次の作業 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|',
    ...(rows.length ? rows : ['| データなし | 0 | 0 | - | - | 0 | 0 | 0 | - | monitor | 計測設定を確認する |']),
    '',
    '判定は優先順位付けの補助です。楽天の注文・確定報酬は楽天公式レポートで別途確認してください。',
    ''
  ].join('\n');
}

export function summarizeTopRows(rows, formatter, limit = 5) {
  return (rows || []).filter(Boolean).slice(0, limit).map(formatter).filter(Boolean).join(' | ');
}
export function sheetRow(report) {
  const events = report.ga.current.events;
  const querySummary = summarizeTopRows(report.search.current.queries, (row) => `${row.key} (${row.clicks}クリック/${row.impressions}表示)`);
  const searchPageSummary = summarizeTopRows(report.search.current.pages, (row) => `${row.key} (${row.clicks}クリック)`);
  const rakutenPageSummary = summarizeTopRows((report.ga.current.eventPages || []).filter((row) => row.eventName === 'rakuten_click'), (row) => `${row.path} (${row.count})`);
  return [report.collectedAt, report.periods.current.startDate, report.periods.current.endDate, report.ga.current.activeUsers,
    report.ga.current.sessions, report.ga.current.organicSessions, report.ga.current.pageViews, events.rakuten_click || 0,
    events.quantity_calculator_use || 0, events.stockpile_check_use || 0, events.stockpile_csv_download || 0,
    events.paid_kit_checkout_click || 0, report.search.current.clicks, report.search.current.impressions, report.search.current.ctr,
    report.search.current.position, comparison(report.ga.current.organicSessions, report.ga.previous.organicSessions),
    comparison(events.rakuten_click || 0, report.ga.previous.events.rakuten_click || 0), '楽天の注文・確定報酬は公式CSVで別途照合',
    querySummary, searchPageSummary, rakutenPageSummary];
}

async function appendSheet(id, token, row, fetchImpl) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values`;
  const current = await googleJson(`${base}/${encodeURIComponent('A1:V1')}`, token, {}, fetchImpl);
  if (!current.values?.length || current.values[0].length !== headers.length) await googleJson(`${base}/${encodeURIComponent('A1:V1')}?valueInputOption=RAW`, token, { method: 'PUT', body: JSON.stringify({ values: [headers] }) }, fetchImpl);
  await googleJson(`${base}/${encodeURIComponent('A:V')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, token, { method: 'POST', body: JSON.stringify({ values: [row] }) }, fetchImpl);
}

export async function collectGrowthKpis(options = {}) {
  const config = JSON.parse(fs.readFileSync(options.configPath || configPath, 'utf8'));
  const propertyId = options.propertyId || process.env.GA4_PROPERTY_ID;
  const sheetId = options.sheetId || process.env.GOOGLE_KPI_SHEET_ID;
  if (!/^\d+$/.test(propertyId || '')) throw new Error('GA4_PROPERTY_ID must contain digits only.');
  const fetchImpl = options.fetchImpl || fetch;
  const token = await accessToken(parseServiceAccount(options.serviceAccount || process.env.GOOGLE_SERVICE_ACCOUNT_JSON), fetchImpl);
  const periods = reportingPeriods(options.now || new Date(), config.reportDays, config.dataDelayDays);
  const site = process.env.SEARCH_CONSOLE_SITE_URL || config.searchConsoleSiteUrl;
  const [gaCurrent, gaPrevious, searchCurrent, searchPrevious] = await Promise.all([
    gaPeriod(propertyId, token, periods.current, config.events, fetchImpl), gaPeriod(propertyId, token, periods.previous, config.events, fetchImpl),
    searchPeriod(site, token, periods.current, fetchImpl), searchPeriod(site, token, periods.previous, fetchImpl)
  ]);
  const report = { schemaVersion: 2, collectedAt: new Date().toISOString(), siteUrl: config.siteUrl, periods, ga: { current: gaCurrent, previous: gaPrevious }, search: { current: searchCurrent, previous: searchPrevious } };
  report.pagePriorities = buildPagePriorities(report, config.decisionThresholds);
  if (sheetId) await appendSheet(sheetId, token, sheetRow(report), fetchImpl);
  if (process.env.KPI_OUTPUT_PATH) {
    fs.mkdirSync(path.dirname(path.resolve(process.env.KPI_OUTPUT_PATH)), { recursive: true });
    fs.writeFileSync(process.env.KPI_OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (process.env.KPI_SUMMARY_PATH) {
    fs.mkdirSync(path.dirname(path.resolve(process.env.KPI_SUMMARY_PATH)), { recursive: true });
    fs.writeFileSync(process.env.KPI_SUMMARY_PATH, priorityMarkdown(report));
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collectGrowthKpis().then((report) => console.log(`Weekly KPI appended for ${report.periods.current.startDate} to ${report.periods.current.endDate}.`)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

