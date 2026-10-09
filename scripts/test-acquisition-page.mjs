import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nurseryComparison from './nursery-comparison.cjs';

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

const power = fs.readFileSync(path.join(root, 'dist', 'pages', 'portable-power-kaigo.html'), 'utf8');
assert.doesNotMatch(power, /doops:10035046|doops%2Fzzt4260015d41d|doops%2Fi%2F10035046/, 'standalone vehicle charger must not be offered as a power station, including cached-data builds');

const toilet = fs.readFileSync(path.join(root, 'dist', 'pages', 'toilet-office.html'), 'utf8');
const graphs = [...toilet.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
const toiletFaq = graphs.find(graph => graph['@type'] === 'FAQPage')?.mainEntity;
const purchaseQuestions = [
  '会社の簡易トイレは何回分備蓄すればよいですか？',
  '100回分の簡易トイレは、何人・何日分ですか？',
  '凝固剤だけの商品とトイレセットはどう違いますか？',
  '10人・3日分なら100回分の商品を何箱買いますか？',
  '防臭袋も使用回数と同じ枚数が必要ですか？'
];
assert.deepEqual(toiletFaq?.map(item => item.name), purchaseQuestions, 'toilet FAQ must answer purchase decisions instead of generic disaster questions');
for (const item of toiletFaq) {
  assert.ok(toilet.includes(`<summary>${item.name}</summary>`), 'FAQ questions must be visible');
  assert.ok(toilet.includes(`<p>${item.acceptedAnswer.text}</p>`), 'FAQ answers must match their visible text');
}
assert.match(toilet, /100回分入りなら2箱で200回分/);
assert.match(toilet, /不足する袋や凝固剤は別に補充/);

const nursery = fs.readFileSync(path.join(root, 'dist', 'pages', 'hoikuen-bousai.html'), 'utf8');
assert.match(nursery, /id="nursery-children"/);
assert.match(nursery, /id="nursery-servings"/);
assert.match(nursery, /id="nursery-meal-total"/);
assert.match(nursery, /id="nursery-meal-comparison" href="#comparison"/);
assert.match(nursery, /1袋が園児1人の1食分とは限りません/);
assert.match(nursery, /data-nursery-meal-script/);
assert.match(nursery, /id="planSummary"/);
assert.match(nursery, /職員・成人の備蓄目安/);
assert.match(nursery, /https:\/\/www\.bousai\.go\.jp\/jishin\/kitakukonnan\/pdf\/kitakukonnan_guideline\.pdf/);
assert.match(nursery, /園児の食数や飲水量の基準ではありません/);
assert.match(nursery, /食料（年齢・原材料を確認）/);
assert.match(nursery, /持出しセット（内容・重さを確認）/);
assert.match(nursery, /園児用と職員用で内容・重さ・配布人数を確認/);
assert.match(nursery, /園児の食数は年齢・食べ方別に確認/);
assert.match(nursery, /対象年齢・原材料・食べ方・調理用の水を確認/);
assert.match(nursery, /https:\/\/www\.caa\.go\.jp\/policies\/policy\/consumer_safety\/caution\/caution_015\//);
assert.doesNotMatch(nursery, /<span>向いている施設<\/span>/, 'unverified nursery suitability must not be asserted');
const nurseryData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8')).pages.find(item => item.slug === 'hoikuen-bousai');
const candies = nurseryData.products.filter(product => product.productType === 'food' && /キャンディ|キャンデー|飴|あめ|ドロップ/.test(product.titleRaw || product.name || '') && !/米|パン|ご飯|粥|麺|主食|ミルク/.test(product.titleRaw || product.name || ''));
const nurseryQuickPicks = nursery.match(/<section class="section quick-picks"[\s\S]*?<\/section>/)?.[0] || '';
for (const product of candies) {
  assert.ok(!nurseryQuickPicks.includes(`data-product-key="${product.itemCode}"`), 'standalone candy must not be a first food candidate');
  const row = [...nursery.matchAll(/<tr data-product-fit[\s\S]*?<\/tr>/g)].map(match => match[0]).find(html => html.includes(`data-product-key="${product.itemCode}"`));
  assert.ok(row, 'supplementary candy remains in the full comparison, while detail cards retain their six-item limit');
  assert.match(row, /補助食品（食事用とは別）/);
  assert.match(row, /のどに詰まるおそれ/);
}

const nurseryMeals = nurseryData.products.filter(product => product.productType === 'food' && !candies.includes(product));
const nurseryWater = nurseryData.products.filter(product => product.productType === 'water');
const nurserySupplies = nurseryData.products.filter(product => !['food', 'water'].includes(product.productType));
const nurseryPurposes = { food: nurseryMeals, water: nurseryWater, supplies: nurserySupplies, supplement: candies };
const nurseryLinks = nursery.match(/<nav class="chip-row" aria-label="備蓄品の用途"[\s\S]*?<\/nav>/)?.[0] || '';
for (const [purpose, products] of Object.entries(nurseryPurposes)) {
  if (!products.length) {
    assert.ok(!nurseryLinks.includes(`href="#nursery-purpose-${purpose}"`), 'empty purpose must not have a link');
    continue;
  }
  assert.match(nurseryLinks, new RegExp(`href="#nursery-purpose-${purpose}"[^>]*>[^<]*${products.length}件`));
  assert.ok(nursery.includes(`id="nursery-purpose-${purpose}"`), 'purpose must have a comparison target');
}
const nurseryRows = [...nursery.matchAll(/<tr [^>]*data-product-fit[\s\S]*?<\/tr>/g)].map(match => match[0]);
const nurseryCards = nursery.match(/<section class="section" id="products">[\s\S]*?<\/section>/)?.[0] || '';
for (const product of nurseryMeals.slice(0, 6)) {
  assert.ok(nurseryCards.includes(`data-product-key="${product.itemCode}"`), 'first food candidates need detailed cards, not only a table row');
}
assert.ok(nurseryRows.slice(0, nurseryMeals.length).every(row => row.includes('data-nursery-purpose="food"')), 'food must precede unrelated supplies');
assert.match(nursery, /href="#quantity">園児の食数を数える<\/a>/);
assert.match(nursery, /https:\/\/www\.pref\.osaka\.lg\.jp\/documents\/22910\/guid\.pdf/);

const { nurseryGroups, nurseryPurpose } = nurseryComparison;
const purposeFixture = [
  { itemCode: 'fixture:bag', productType: 'disaster-set', titleRaw: '防災セット' },
  { itemCode: 'fixture:candy', productType: 'food', titleRaw: '保存用キャンディ' },
  { itemCode: 'fixture:water', productType: 'water', titleRaw: '保存水' },
  { itemCode: 'fixture:meal', productType: 'food', titleRaw: '非常食 アルファ米' }
];
const originalPurposeOrder = purposeFixture.map(product => product.itemCode);
assert.deepEqual(nurseryGroups([]), []);
assert.equal(nurseryPurpose({ productType: 'unknown', titleRaw: '用途不明' }), 'supplies');
assert.deepEqual(nurseryGroups(purposeFixture).map(group => group.key), ['food', 'water', 'supplies', 'supplement']);
assert.deepEqual(nurseryGroups(purposeFixture).flatMap(group => group.products).map(product => product.itemCode), ['fixture:meal', 'fixture:water', 'fixture:bag', 'fixture:candy']);
assert.deepEqual(purposeFixture.map(product => product.itemCode), originalPurposeOrder, 'ordering must not mutate API data');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bcp-nursery-purpose-'));
try {
  fs.cpSync(path.join(root, 'scripts'), path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'data'));
  for (const name of ['keywords.csv', 'paid-product.json', 'indexnow.json']) {
    fs.copyFileSync(path.join(root, 'data', name), path.join(fixtureRoot, 'data', name));
  }
  const input = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8'));
  const sample = { ...nurseryMeals[0], productType: 'food', titleRaw: '非常食 アルファ米 5年保存 9食', name: '非常食 アルファ米 5年保存 9食' };
  for (const count of [0, 1, 9]) {
    const products = Array.from({ length: count }, (_, index) => ({ ...sample, itemCode: `fixture:meal-${index}`, url: `https://example.invalid/meal-${index}` }));
    const fixtureData = { ...input, pages: input.pages.map(page => ({ ...page, products: page.slug === 'hoikuen-bousai' ? products : [] })) };
    fs.writeFileSync(path.join(fixtureRoot, 'data', 'products.json'), JSON.stringify(fixtureData));
    execFileSync(process.execPath, [path.join(fixtureRoot, 'scripts', 'generate-site.js')], { stdio: 'pipe' });
    const html = fs.readFileSync(path.join(fixtureRoot, 'dist', 'pages', 'hoikuen-bousai.html'), 'utf8');
    const links = html.match(/<nav class="chip-row" aria-label="備蓄品の用途"[\s\S]*?<\/nav>/)?.[0] || '';
    const table = html.match(/<section class="section" id="comparison">[\s\S]*?<\/section>/)?.[0] || '';
    const cards = html.match(/<section class="section" id="products">[\s\S]*?<\/section>/)?.[0] || '';
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.equal((table.match(/data-nursery-purpose="food"/g) || []).length, count);
    assert.equal((cards.match(/data-nursery-purpose="food"/g) || []).length, Math.min(count, 6));
    if (!count) {
      assert.equal(links, '', 'zero candidates must not produce dead purpose links');
    } else {
      assert.match(links, new RegExp(`非常食・保存食（${count}件）`));
      assert.equal((html.match(/id="nursery-purpose-food"/g) || []).length, 1);
      assert.doesNotMatch(links, /nursery-purpose-(?:water|supplies|supplement)/);
    }
  }
} finally {
  const relative = path.relative(os.tmpdir(), fixtureRoot);
  assert.ok(relative.startsWith('bcp-nursery-purpose-') && !relative.includes(path.sep));
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('acquisition page verified');
