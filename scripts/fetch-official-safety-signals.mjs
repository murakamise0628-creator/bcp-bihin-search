import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const feedUrl = 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml';
const exactEmergencyPattern = /大雨特別警報|暴風特別警報|大雪特別警報|暴風雪特別警報|高潮特別警報|波浪特別警報|大津波警報|津波警報|噴火警報（居住地域）|南海トラフ地震臨時情報/;

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
  if (/台風|大雨|暴風|高潮|波浪/.test(value)) topics.push('台風');
  if (/停電|雷/.test(value)) topics.push('停電');
  if (/地震|津波|南海トラフ|噴火/.test(value)) topics.push('地震');
  if (/猛暑|熱中症/.test(value)) topics.push('猛暑');
  return [...new Set(topics.length ? topics : ['防災'])];
}

export function parseJmaFeedCandidates(xml, now = new Date(), maxAgeHours = 24) {
  const lower = now.getTime() - maxAgeHours * 3600000;
  const upper = now.getTime() + 5 * 60000;
  const entries = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => {
    const title = tag(entry, 'title');
    const content = tag(entry, 'content');
    const observedAt = tag(entry, 'updated');
    const sourceUrl = link(entry) || tag(entry, 'id');
    return { title, content, observedAt, sourceUrl };
  }).filter((item) => {
    const observed = Date.parse(item.observedAt);
    const relevantType = /津波|南海トラフ|噴火/.test(item.title) || exactEmergencyPattern.test(item.content);
    return relevantType
      && Number.isFinite(observed) && observed >= lower && observed <= upper
      && /^https:\/\/www\.data\.jma\.go\.jp\/developer\/xml\/data\/[A-Za-z0-9_]+\.xml$/.test(item.sourceUrl);
  });
}

export function verifyJmaEmergencyBulletin(xml, candidate, now = new Date()) {
  const body = String(xml || '');
  if (!/<Report\b/i.test(body) || !/<Control>/i.test(body) || !/<Head\b/i.test(body)) return null;
  const status = tag(body, 'Status');
  const infoType = tag(body, 'InfoType');
  if (status !== '通常' || !['発表', '更新'].includes(infoType)) return null;
  const names = [...body.matchAll(/<Kind>[\s\S]*?<Name>([\s\S]*?)<\/Name>[\s\S]*?<\/Kind>/gi)]
    .map((match) => decodeXml(match[1]).trim());
  const fallback = [tag(body, 'Title'), tag(body, 'Text')];
  const emergencyName = [...names, ...fallback].find((value) => exactEmergencyPattern.test(value));
  if (!emergencyName) return null;
  return {
    id: `jma:${Buffer.from(`${emergencyName}|${candidate.observedAt}|${candidate.sourceUrl}`).toString('base64url').slice(0, 40)}`,
    status: 'verified',
    sourceVerified: true,
    kind: 'emergency_alert',
    label: emergencyName.slice(0, 80),
    topics: topicsFor(emergencyName),
    observedAt: new Date(candidate.observedAt).toISOString(),
    checkedAt: now.toISOString(),
    sourceUrl: candidate.sourceUrl,
    weight: 0
  };
}

export async function fetchOfficialSafetySignals(outputPath, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || new Date();
  const response = await fetchImpl(feedUrl, { headers: { 'user-agent': 'Jigyousho-Bousai-Navi/1.0' } });
  if (!response.ok) throw new Error(`JMA safety feed failed (${response.status}).`);
  const xml = await response.text();
  if (!/<feed\b/i.test(xml) || !/<entry\b/i.test(xml)) throw new Error('JMA safety feed is not valid Atom XML.');
  const candidates = parseJmaFeedCandidates(xml, now);
  const signals = [];
  for (const candidate of candidates) {
    const detail = await fetchImpl(candidate.sourceUrl, { headers: { 'user-agent': 'Jigyousho-Bousai-Navi/1.0' } });
    if (!detail.ok) throw new Error(`JMA bulletin failed (${detail.status}).`);
    const signal = verifyJmaEmergencyBulletin(await detail.text(), candidate, now);
    if (signal) signals.push(signal);
  }
  const result = {
    schemaVersion: 1,
    fetchStatus: 'ok',
    checkedAt: now.toISOString(),
    sourceUrl: feedUrl,
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
      .then((result) => console.log(`Official safety check completed: ${result.candidateCount} candidate(s), ${result.signals.length} verified emergency signal(s).`))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
