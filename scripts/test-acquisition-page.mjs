import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const pagePath = path.join(root, 'dist', 'pages', 'bcp-stockpile-checklist.html');
const csvPath = path.join(root, 'dist', 'downloads', 'jigyousho-bousai-checklist.csv');
const homePath = path.join(root, 'dist', 'index.html');
const sitemapPath = path.join(root, 'dist', 'sitemap.xml');

assert.ok(fs.existsSync(pagePath), 'stockpile checklist page must be generated');
assert.ok(fs.existsSync(csvPath), 'stockpile checklist CSV must be generated');

const page = fs.readFileSync(pagePath, 'utf8');
const home = fs.readFileSync(homePath, 'utf8');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const csvBuffer = fs.readFileSync(csvPath);
const csv = csvBuffer.toString('utf8');

assert.match(page, /<h1>会社・事業所の防災備蓄チェックリスト<\/h1>/);
assert.match(page, /data-stockpile-tool/);
assert.match(page, /data-print-checklist/);
assert.match(page, /window\.print\(\)/);
assert.match(page, /data-download-checklist/);
assert.match(page, /"@type":"WebApplication"/);
assert.doesNotMatch(page, /"@type":"Product"/);
assert.equal((page.match(/type="checkbox" data-stockpile-check/g) || []).length, 34);
assert.match(page, /<link rel="canonical" href="https:\/\/jigyousho-bousai\.com\/pages\/bcp-stockpile-checklist\.html">/);
assert.match(page, /<meta property="og:title"/);
assert.match(page, /<meta name="twitter:card"/);

assert.deepEqual(Array.from(csvBuffer.subarray(0, 3)), [0xef, 0xbb, 0xbf], 'CSV must include a UTF-8 BOM');
assert.ok(csv.trim().split(/\r?\n/).length >= 35, 'CSV must include common and facility-specific rows');
assert.match(csv, /"担当","確認日","状態","メモ"/);

assert.match(home, /pages\/bcp-stockpile-checklist\.html/);
assert.match(home, /人数計算・印刷・CSV/);
assert.match(sitemap, /<loc>https:\/\/jigyousho-bousai\.com\/pages\/bcp-stockpile-checklist\.html<\/loc>/);
const sitemapDates = [...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map((match) => match[1]);
assert.ok(sitemapDates.length > 0, 'sitemap must include lastmod dates');
assert.ok(sitemapDates.every((date) => Date.parse(`${date}T00:00:00+09:00`) >= Date.parse('2026-08-03T00:00:00+09:00')), 'sitemap lastmod must include the editorial update');

console.log('acquisition page verified');