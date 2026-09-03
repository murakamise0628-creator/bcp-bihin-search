import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accessToken, parseServiceAccount } from './collect-growth-kpis.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const disclosure = '【PR】リンク先にはアフィリエイト広告を含みます。';
const unsafePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /(?:api|access|affiliate|secret)[_-]?(?:key|id)?\s*[:=]\s*[^\s]+/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /絶対安心|必ず使える|これだけで大丈夫|最強|完全対応|今すぐ買|買わないと危険|手遅れ/i
];

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function normalizeVerifiedSignals(signals, now = new Date(), maxAgeDays = 21, trustedDomains = []) {
  const limit = now.getTime() - maxAgeDays * 86400000;
  const trusted = (value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return trustedDomains.length === 0 || trustedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  };
  return (signals || []).filter((signal) => {
    const observed = Date.parse(signal.observedAt || '');
    return signal.status === 'verified'
      && signal.kind !== 'emergency_alert'
      && Number.isFinite(observed)
      && observed >= limit
      && /^https:\/\//.test(signal.sourceUrl || '')
      && trusted(signal.sourceUrl)
      && Array.isArray(signal.topics)
      && signal.topics.length > 0;
  }).map((signal) => ({
    id: String(signal.id || hash(JSON.stringify(signal))),
    kind: String(signal.kind || 'official_guidance'),
    label: String(signal.label || '検証済み需要シグナル').slice(0, 80),
    topics: signal.topics.map(String),
    observedAt: new Date(signal.observedAt).toISOString(),
    sourceUrl: signal.sourceUrl,
    weight: Math.max(0, Math.min(Number(signal.weight || 20), 50))
  })).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

export function containsUnsafeContent(value) {
  return unsafePatterns.some((pattern) => pattern.test(String(value || '')));
}

function pageSignals(page, signals) {
  return signals.filter((signal) => page.topics.some((topic) => signal.topics.includes(topic)));
}

function improvement(primary, page) {
  const actions = {
    conversion_gap: `${page.title}の冒頭比較と価格確認CTAを、訪問者が確認する順番に合わせて点検する。`,
    snippet_gap: `${page.title}のtitleとdescriptionを、検索者の購入前質問に直接答える表現へ点検する。`,
    ranking_opportunity: `${page.title}で不足している選び方・数量・注意点を補い、関連ページから内部リンクを追加する。`,
    winner: `${page.title}の流入意図と楽天クリック導線を維持し、同じ判断軸を近い比較ページへ展開する。`,
    visibility_gap: `${page.title}の需要シグナルとインデックス状況を確認し、検索意図が一致する場合だけ内容を補う。`
  };
  return actions[primary] || `${page.title}は変更せず、次の計測期間まで推移を確認する。`;
}

export function buildThreadsDrafts(page) {
  const url = `https://jigyousho-bousai.com${page.path}`;
  return [
    `${disclosure}\n${page.audience}の備蓄は、セット名より「${page.problem}」から確認すると不足を見つけやすくなります。見る項目は${page.checks.join('、')}。比較表はこちら：${url}`,
    `${disclosure}\n${page.title}を選ぶ前に、${page.checks.slice(0, 3).join('、')}を分けて確認してください。${page.caution} 条件別に候補を比較できます：${url}`,
    `${disclosure}\n${page.quantityBasis}。人数だけでなく、来客・利用者と待機日数も含めて見積もるのがポイントです。${page.title}の比較：${url}`
  ];
}

export function planDemandOperation(report, config, rawSignals = [], history = [], now = new Date()) {
  const periods = report.periods || {};
  const maxAgeDays = config.signalMaxAgeDays || 21;
  const trustedDomains = config.trustedDomains || [];
  const recentLimit = now.getTime() - maxAgeDays * 86400000;
  const isTrustedUrl = (value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return trustedDomains.length === 0 || trustedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  };
  const activeEmergency = (rawSignals || []).some((signal) => {
    const observed = Date.parse(signal.observedAt || '');
    return signal.status === 'verified' && signal.kind === 'emergency_alert'
      && Number.isFinite(observed) && observed >= recentLimit
      && /^https:\/\//.test(signal.sourceUrl || '') && isTrustedUrl(signal.sourceUrl);
  });
  if (activeEmergency) {
    return {
      status: 'NO_ACTION',
      reasonCode: 'ACTIVE_EMERGENCY',
      reason: '緊急情報が有効なため商品訴求の下書きを生成しません。',
      generatedAt: now.toISOString(),
      periods,
      fingerprint: hash(`ACTIVE_EMERGENCY|${periods.current?.endDate || now.toISOString().slice(0, 10)}`)
    };
  }
  const signals = normalizeVerifiedSignals(rawSignals, now, maxAgeDays, trustedDomains);
  const cooldownLimit = now.getTime() - Number(config.cooldownDays || 60) * 86400000;
  const activeHistory = history.filter((item) => {
    if (typeof item === 'string' || !item?.createdAt) return true;
    const created = Date.parse(item.createdAt);
    return Number.isFinite(created) && created >= cooldownLimit;
  });
  const historyFingerprints = new Set(activeHistory.map((item) => typeof item === 'string' ? item : item.fingerprint).filter(Boolean));
  const latestAction = activeHistory.filter((item) => typeof item !== 'string' && item.status === 'ACTION' && item.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const candidates = [];

  for (const row of report.pagePriorities || []) {
    const page = (config.pages || []).find((item) => item.path === row.path);
    if (!page) continue;
    const matchedSignals = pageSignals(page, signals);
    const measuredDemand = Number(row.impressions || 0) >= Number(config.minImpressions || 20)
      || Number(row.sessions || 0) >= Number(config.minSessions || 5)
      || Number(row.rakutenClicks || 0) > 0;
    if (!measuredDemand && matchedSignals.length === 0) continue;
    if (row.primary === 'monitor') continue;
    if (row.primary === 'visibility_gap' && matchedSignals.length === 0) continue;
    if (latestAction?.path === row.path) continue;

    const fingerprint = hash([
      row.path,
      row.primary,
      matchedSignals.map((item) => item.id).join(','),
      page.checks.join(','),
      config.templateVersion || 1
    ].join('|'));
    if (historyFingerprints.has(fingerprint)) continue;
    const score = Number(row.priorityScore || 0)
      + Math.min(Number(row.impressions || 0), 1000) / 20
      + Math.min(Number(row.sessions || 0), 100)
      + Math.min(Number(row.rakutenClicks || 0), 20) * 10
      + matchedSignals.reduce((sum, item) => sum + item.weight, 0);
    candidates.push({ row, page, matchedSignals, fingerprint, score: Math.round(score * 10) / 10 });
  }

  candidates.sort((a, b) => b.score - a.score || a.page.path.localeCompare(b.page.path));
  const selected = candidates[0];
  if (!selected) {
    return {
      status: 'NO_ACTION',
      reasonCode: 'NO_ELIGIBLE_DEMAND',
      reason: '需要または計測根拠を満たす未処理候補がありません。',
      generatedAt: now.toISOString(),
      periods,
      fingerprint: hash(`NO_ACTION|${periods.current?.endDate || now.toISOString().slice(0, 10)}`)
    };
  }

  const drafts = buildThreadsDrafts(selected.page);
  const publicPayload = JSON.stringify({
    path: selected.page.path,
    primary: selected.row.primary,
    instruction: improvement(selected.row.primary, selected.page),
    drafts
  });
  if (containsUnsafeContent(publicPayload) || drafts.some((draft) => draft.length > 500 || !draft.includes(disclosure))) {
    return {
      status: 'NO_ACTION',
      reasonCode: 'SAFETY_GATE_FAILED',
      reason: '安全チェックに合格しなかったため下書きを生成しません。',
      generatedAt: now.toISOString(),
      periods,
      fingerprint: hash(`BLOCKED|${selected.fingerprint}`)
    };
  }

  return {
    status: 'ACTION',
    generatedAt: now.toISOString(),
    periods,
    page: selected.page.path,
    pageTitle: selected.page.title,
    primary: selected.row.primary,
    score: selected.score,
    trigger: selected.matchedSignals[0]?.label || 'Search Console・GA4・楽天クリックの実測',
    evidence: {
      impressions: Number(selected.row.impressions || 0),
      searchClicks: Number(selected.row.searchClicks || 0),
      sessions: Number(selected.row.sessions || 0),
      pageViews: Number(selected.row.pageViews || 0),
      rakutenClicks: Number(selected.row.rakutenClicks || 0),
      signalIds: selected.matchedSignals.map((item) => item.id)
    },
    improvementInstruction: improvement(selected.row.primary, selected.page),
    drafts,
    fingerprint: selected.fingerprint
  };
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

const sheetTitle = 'Demand Actions';
const sheetHeaders = [
  '取得日時', '開始日', '終了日', 'ページ', '判定', '優先度', '需要トリガー',
  'ページ改善指示', 'Threads下書き1', 'Threads下書き2', 'Threads下書き3', 'fingerprint', '状態'
];

async function ensureDemandSheet(id, token, fetchImpl) {
  const spreadsheet = await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets.properties`,
    token, {}, fetchImpl
  );
  if (!(spreadsheet.sheets || []).some((sheet) => sheet.properties?.title === sheetTitle)) {
    await googleJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}:batchUpdate`,
      token,
      { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetTitle } } }] }) },
      fetchImpl
    );
  }
}

async function planAndAppend(report, config, signals, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const sheetId = options.sheetId || process.env.GOOGLE_KPI_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_KPI_SHEET_ID is required.');
  const account = parseServiceAccount(options.serviceAccount || process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = options.token || await accessToken(account, fetchImpl);
  await ensureDemandSheet(sheetId, token, fetchImpl);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values`;
  const headerRange = `'${sheetTitle}'!A1:M1`;
  const current = await googleJson(`${base}/${encodeURIComponent(headerRange)}`, token, {}, fetchImpl);
  if (!current.values?.length) {
    await googleJson(
      `${base}/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
      token, { method: 'PUT', body: JSON.stringify({ values: [sheetHeaders] }) }, fetchImpl
    );
  } else if (JSON.stringify(current.values[0]) !== JSON.stringify(sheetHeaders)) {
    throw new Error('Unexpected Demand Actions headers; append cancelled.');
  }
  const prior = await googleJson(`${base}/${encodeURIComponent(`'${sheetTitle}'!A2:M5000`)}`, token, {}, fetchImpl);
  const history = (prior.values || []).map((row) => ({ createdAt: row[0], path: row[3], primary: row[4], fingerprint: row[11], status: row[12] }));
  const operation = planDemandOperation(report, config, signals, history, options.now || new Date());
  const period = report.periods?.current || {};
  const row = operation.status === 'ACTION'
    ? [operation.generatedAt, period.startDate || '', period.endDate || '', operation.page, operation.primary, operation.score,
      operation.trigger, operation.improvementInstruction, ...operation.drafts, operation.fingerprint, operation.status]
    : [operation.generatedAt, period.startDate || '', period.endDate || '', '', '', '', operation.reason, '', '', '', '',
      operation.fingerprint, operation.status];
  await googleJson(
    `${base}/${encodeURIComponent(`'${sheetTitle}'!A:M`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token, { method: 'POST', body: JSON.stringify({ values: [row] }) }, fetchImpl
  );
  return operation;
}

export async function runDemandPlanner(reportPath, options = {}) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const config = JSON.parse(fs.readFileSync(options.configPath || path.join(root, 'data', 'demand-operation.json'), 'utf8'));
  const signals = JSON.parse(fs.readFileSync(options.signalsPath || path.join(root, 'data', 'demand-signals.json'), 'utf8')).signals || [];
  const operation = await planAndAppend(report, config, signals, options);
  if (process.env.DEMAND_OUTPUT_PATH) {
    const output = path.resolve(process.env.DEMAND_OUTPUT_PATH);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(operation, null, 2)}\n`);
  }
  return operation;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportPath = process.argv[2] || process.env.KPI_OUTPUT_PATH;
  if (!reportPath) {
    console.error('KPI report path is required.');
    process.exitCode = 1;
  } else {
    runDemandPlanner(path.resolve(reportPath))
      .then((operation) => console.log(`Demand operation: ${operation.status}${operation.page ? ` ${operation.page}` : ''} (${operation.fingerprint})`))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
