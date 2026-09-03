import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sources = {
  weatherMap: 'https://www.jma.go.jp/bosai/warning/data/r8/map.json',
  weatherTime: 'https://www.jma.go.jp/bosai/warning/data/r8/map_time.json',
  tsunami: 'https://www.jma.go.jp/bosai/tsunami/data/list.json',
  volcano: 'https://www.jma.go.jp/bosai/volcano/data/warning.json',
  eqvol: 'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml'
};

const weatherEmergencyNames = new Map([
  ['32', '暴風雪特別警報'],
  ['33', '大雨特別警報'],
  ['35', '暴風特別警報'],
  ['36', '大雪特別警報'],
  ['37', '波浪特別警報'],
  ['38', '高潮特別警報']
]);
const activeStatuses = new Set(['発表', '継続']);
const exactEmergencyPattern = /大雨特別警報|暴風特別警報|大雪特別警報|暴風雪特別警報|高潮特別警報|波浪特別警報|大津波警報|津波警報|噴火警報（居住地域）|居住地域危険|南海トラフ地震臨時情報/;

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function tag(entry, name) {
  return decodeXml(entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '').trim();
}

function link(entry) {
  return decodeXml(entry.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1] || '').trim();
}

function topicsFor(value) {
  const topics = [];
  if (/台風|大雨|暴風|高潮|波浪|大雪|暴風雪/.test(value)) topics.push('台風');
  if (/停電|雷/.test(value)) topics.push('停電');
  if (/地震|津波|南海トラフ|噴火|居住地域/.test(value)) topics.push('地震');
  return [...new Set(topics.length ? topics : ['防災'])];
}

function makeSignal(label, observedAt, sourceUrl, now) {
  return {
    id: `jma:${Buffer.from(`${label}|${observedAt}|${sourceUrl}`).toString('base64url').slice(0, 40)}`,
    status: 'verified',
    sourceVerified: true,
    kind: 'emergency_alert',
    label: label.slice(0, 80),
    topics: topicsFor(label),
    observedAt: new Date(observedAt).toISOString(),
    checkedAt: now.toISOString(),
    sourceUrl,
    weight: 0
  };
}

function dedupeSignals(signals) {
  return [...new Map(signals.map((item) => [item.id, item])).values()];
}

export function parseCurrentWeatherWarnings(reports, now = new Date()) {
  if (!Array.isArray(reports)) throw new Error('JMA weather state is not a JSON array.');
  const signals = [];
  for (const report of reports) {
    const observedAt = report?.reportDatetime || report?.controlDatetime;
    if (!Number.isFinite(Date.parse(observedAt))) continue;
    for (const items of Object.values(report?.warning || {})) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        for (const kind of item?.kinds || []) {
          const label = weatherEmergencyNames.get(String(kind?.code || ''));
          if (label && activeStatuses.has(kind?.status)) {
            signals.push(makeSignal(label, observedAt, sources.weatherMap, now));
          }
        }
      }
    }
  }
  return dedupeSignals(signals);
}

export function parseCurrentTsunamiWarnings(reports, now = new Date()) {
  if (!Array.isArray(reports)) throw new Error('JMA tsunami state is not a JSON array.');
  const signals = [];
  for (const report of reports) {
    const observedAt = report?.rdt || report?.reportDatetime;
    if (!Number.isFinite(Date.parse(observedAt))) continue;
    const labels = [
      report?.ttl,
      ...(Array.isArray(report?.kind) ? report.kind.map((item) => item?.kind || item?.name) : [])
    ].filter((value) => /^(大津波警報|津波警報)/.test(String(value || '')));
    for (const label of labels) signals.push(makeSignal(String(label), observedAt, sources.tsunami, now));
  }
  return dedupeSignals(signals);
}

export function parseCurrentVolcanoWarnings(reports, now = new Date()) {
  if (!Array.isArray(reports)) throw new Error('JMA volcano state is not a JSON array.');
  const signals = [];
  for (const report of reports) {
    const observedAt = report?.reportDatetime;
    if (!Number.isFinite(Date.parse(observedAt))) continue;
    for (const group of report?.volcanoInfos || []) {
      for (const item of group?.items || []) {
        const label = String(item?.name || '');
        const condition = String(item?.condition || '');
        if ((/噴火警報（居住地域）|居住地域危険/.test(label) || /避難/.test(label))
          && !/解除/.test(condition)) {
          signals.push(makeSignal(label, observedAt, sources.volcano, now));
        }
      }
    }
  }
  return dedupeSignals(signals);
}

export function parseJmaFeedCandidates(xml, now = new Date(), maxAgeHours = 24 * 14) {
  const lower = now.getTime() - maxAgeHours * 3600000;
  const upper = now.getTime() + 5 * 60000;
  const entries = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => ({
    title: tag(entry, 'title'),
    content: tag(entry, 'content'),
    observedAt: tag(entry, 'updated'),
    sourceUrl: link(entry) || tag(entry, 'id')
  })).filter((item) => {
    const observed = Date.parse(item.observedAt);
    const nankai = /南海トラフ地震臨時情報/.test(`${item.title} ${item.content}`);
    return nankai
      && Number.isFinite(observed) && observed >= lower && observed <= upper
      && /^https:\/\/www\.data\.jma\.go\.jp\/developer\/xml\/data\/[A-Za-z0-9_]+\.xml$/.test(item.sourceUrl);
  });
}

export function verifyJmaEmergencyBulletin(xml, candidate, now = new Date()) {
  const body = String(xml || '');
  if (!/<Report\b/i.test(body) || !/<Control>/i.test(body) || !/<Head\b/i.test(body)) return null;
  if (tag(body, 'Status') !== '通常' || !['発表', '更新'].includes(tag(body, 'InfoType'))) return null;

  const activeNames = [...body.matchAll(/<Kind>([\s\S]*?)<\/Kind>/gi)]
    .map((match) => {
      const block = match[1];
      return { name: tag(block, 'Name'), status: tag(block, 'Status') };
    })
    .filter((item) => exactEmergencyPattern.test(item.name)
      && (!item.status || activeStatuses.has(item.status)))
    .map((item) => item.name);

  const emergencyName = activeNames[0];
  if (!emergencyName) return null;
  return makeSignal(emergencyName, candidate.observedAt, candidate.sourceUrl, now);
}

async function fetchJson(fetchImpl, url, label) {
  const response = await fetchImpl(url, { headers: { 'user-agent': 'Jigyousho-Bousai-Navi/1.0' } });
  if (!response.ok) throw new Error(`JMA ${label} failed (${response.status}).`);
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new Error(`JMA ${label} is not valid JSON.`);
  }
}

export async function fetchOfficialSafetySignals(outputPath, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || new Date();
  const [weather, weatherTime, tsunami, volcano, eqvolResponse] = await Promise.all([
    fetchJson(fetchImpl, sources.weatherMap, 'weather state'),
    fetchJson(fetchImpl, sources.weatherTime, 'weather timestamp'),
    fetchJson(fetchImpl, sources.tsunami, 'tsunami state'),
    fetchJson(fetchImpl, sources.volcano, 'volcano state'),
    fetchImpl(sources.eqvol, { headers: { 'user-agent': 'Jigyousho-Bousai-Navi/1.0' } })
  ]);
  if (!eqvolResponse.ok) throw new Error(`JMA earthquake/volcano feed failed (${eqvolResponse.status}).`);
  const eqvolXml = await eqvolResponse.text();
  if (!/<feed\b/i.test(eqvolXml)) throw new Error('JMA earthquake/volcano feed is not valid Atom XML.');
  if (!Number.isFinite(Date.parse(weatherTime?.latestControlDatetime))) {
    throw new Error('JMA weather timestamp is invalid.');
  }

  const candidates = parseJmaFeedCandidates(eqvolXml, now);
  const detailedSignals = [];
  for (const candidate of candidates) {
    const detail = await fetchImpl(candidate.sourceUrl, { headers: { 'user-agent': 'Jigyousho-Bousai-Navi/1.0' } });
    if (!detail.ok) throw new Error(`JMA bulletin failed (${detail.status}).`);
    const signal = verifyJmaEmergencyBulletin(await detail.text(), candidate, now);
    if (signal) detailedSignals.push(signal);
  }

  const signals = dedupeSignals([
    ...parseCurrentWeatherWarnings(weather, now),
    ...parseCurrentTsunamiWarnings(tsunami, now),
    ...parseCurrentVolcanoWarnings(volcano, now),
    ...detailedSignals
  ]);
  const result = {
    schemaVersion: 2,
    fetchStatus: 'ok',
    checkedAt: now.toISOString(),
    sourceUrls: Object.values(sources),
    candidateCount: candidates.length,
    signals
  };
  const target = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2] || process.env.OFFICIAL_SIGNAL_PATH;
  if (!outputPath) {
    console.error('OFFICIAL_SIGNAL_PATH is required.');
    process.exitCode = 1;
  } else {
    fetchOfficialSafetySignals(outputPath)
      .then((result) => console.log(`Official safety check completed: ${result.candidateCount} detailed candidate(s), ${result.signals.length} active emergency signal(s).`))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
