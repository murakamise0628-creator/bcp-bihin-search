import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const feedUrl = 'https://www.data.jma.go.jp/developer/xml/feed/extra.xml';
const emergencyPattern = /特別警報|大津波警報|津波警報|南海トラフ地震臨時情報|噴火警報/;

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

function topicsFor(title) {
  const topics = [];
  if (/台風|大雨|特別警報/.test(title)) topics.push('台風');
  if (/停電|雷/.test(title)) topics.push('停電');
  if (/地震|津波|南海トラフ/.test(title)) topics.push('地震');
  if (/猛暑|熱中症/.test(title)) topics.push('猛暑');
  if (/噴火/.test(title)) topics.push('地震');
  return [...new Set(topics.length ? topics : ['防災'])];
}

export function parseJmaEmergencyFeed(xml, now = new Date(), maxAgeHours = 24) {
  const lower = now.getTime() - maxAgeHours * 3600000;
  const upper = now.getTime() + 5 * 60000;
  const entries = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => {
    const title = tag(entry, 'title');
    const observedAt = tag(entry, 'updated');
    const sourceUrl = link(entry) || tag(entry, 'id');
    return { title, observedAt, sourceUrl };
  }).filter((item) => {
    const observed = Date.parse(item.observedAt);
    return emergencyPattern.test(item.title)
      && Number.isFinite(observed) && observed >= lower && observed <= upper
      && /^https:\/\/(?:www\.)?data\.jma\.go\.jp\//.test(item.sourceUrl);
  }).map((item) => ({
    id: `jma:${Buffer.from(`${item.title}|${item.observedAt}|${item.sourceUrl}`).toString('base64url').slice(0, 40)}`,
    status: 'verified',
    sourceVerified: true,
    kind: 'emergency_alert',
    label: item.title.slice(0, 80),
    topics: topicsFor(item.title),
    observedAt: new Date(item.observedAt).toISOString(),
    checkedAt: now.toISOString(),
    sourceUrl: item.sourceUrl,
    weight: 0
  }));
}

export async function fetchOfficialSafetySignals(outputPath, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || new Date();
  const response = await fetchImpl(feedUrl, { headers: { 'user-agent': 'Jigyousho-Bousai-Navi/1.0' } });
  if (!response.ok) throw new Error(`JMA safety feed failed (${response.status}).`);
  const xml = await response.text();
  if (!/<feed\b/i.test(xml)) throw new Error('JMA safety feed is not valid Atom XML.');
  const result = {
    schemaVersion: 1,
    fetchStatus: 'ok',
    checkedAt: now.toISOString(),
    sourceUrl: feedUrl,
    signals: parseJmaEmergencyFeed(xml, now)
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
      .then((result) => console.log(`Official safety check completed: ${result.signals.length} active emergency signal(s).`))
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
