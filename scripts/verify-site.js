const fs = require('fs');
const path = require('path');
const { detectProductType, titleShort } = require('./fetch-products');

const projectRoot = path.resolve(__dirname, '..');
const root = path.join(projectRoot, 'dist');

function walkHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) return walkHtml(file);
    return file.endsWith('.html') ? [file] : [];
  });
}

const files = [
  path.join(root, 'index.html'),
  ...walkHtml(path.join(root, 'pages')),
  ...walkHtml(path.join(root, 'topics'))
];
const knownFiles = new Set(files.map((file) => path.resolve(file)));
const forbidden = /編集方針|参考サイトから反映|反映した入口|TOPの上部|商品取得を改善|取得条件|プロンプト|作業メモ|AI臭|UI上|次工程/;
const issues = [];

const productTitleFixtures = [
  ['防災セット 2人用 保存水 簡易トイレ 防災リュック', 'disaster-set', '防災セット'],
  ['折りたたみ ウォータータンク 15L 給水袋 保存水', 'water-container', '給水用品'],
  ['簡易トイレ 100回分 15年保存 防災セット', 'toilet', '非常用トイレ'],
  ['モバイルバッテリー 60000mAh Max27W 電気毛布用', 'mobile-power', 'モバイルバッテリー'],
  ['保存水 2L 6本 5年保存', 'water', '保存水']
];
for (const [raw, expectedType, expectedLabel] of productTitleFixtures) {
  const actualType = detectProductType(raw);
  const actualTitle = titleShort(raw);
  if (actualType !== expectedType || !actualTitle.includes(expectedLabel)) {
    issues.push(`product title classification failed: ${raw}`);
  }
}
const powerTitle = titleShort('Jackery ポータブル電源 1070Wh 定格1500W');
if (!powerTitle.includes('1070Wh') || !powerTitle.includes('1500W') || powerTitle.includes('1070W ')) {
  issues.push('product title classification failed: Wh must not be duplicated as W');
}
const modelTitle = titleShort('簡単トイレ OKT02L 100回分');
if (modelTitle.includes('2L') || !modelTitle.includes('非常用トイレ')) {
  issues.push('product title classification failed: model number must not become capacity');
}
if (detectProductType('長期保存天然水 500ml') !== 'water') {
  issues.push('product title classification failed: long-life natural water');
}

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) issues.push(`${relative}: H1 must appear once`);
  if (!html.includes('G-LN824MSD7X')) issues.push(`${relative}: GA4 tag missing`);
  if (!html.includes("trackEvent('rakuten_click'")) issues.push(`${relative}: Rakuten click tracking missing`);
  if (!html.includes("trackEvent('select_item'")) issues.push(`${relative}: GA4 select_item tracking missing`);
  if (!html.includes("trackEvent('view_item_list'")) issues.push(`${relative}: GA4 item-list tracking missing`);
  if (!/<title>[^<]+<\/title>/.test(html)) issues.push(`${relative}: title missing`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) issues.push(`${relative}: description missing`);
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1] || '';
  if (description.length < 70) issues.push(`${relative}: description is too short for a useful summary`);
  if (!/<link rel="canonical" href="[^"]+">/.test(html)) issues.push(`${relative}: canonical missing`);
  if (!/<meta property="og:title" content="[^"]+">/.test(html)) issues.push(`${relative}: OGP title missing`);
  if (!/<meta property="og:description" content="[^"]+">/.test(html)) issues.push(`${relative}: OGP description missing`);
  if (!/<meta property="og:url" content="[^"]+">/.test(html)) issues.push(`${relative}: OGP URL missing`);
  if (!/<meta name="twitter:card" content="[^"]+">/.test(html)) issues.push(`${relative}: Twitter Card missing`);
  if (forbidden.test(html)) issues.push(`${relative}: production-side wording found`);
  if (/<<<<<<<|=======|>>>>>>>/.test(html)) issues.push(`${relative}: conflict marker found`);
  if (!html.includes('source-references')) issues.push(`${relative}: public source section missing`);
  if (!html.includes('www.bousai.go.jp')) issues.push(`${relative}: Cabinet Office citation missing`);
  if (!html.includes('"citation":[')) issues.push(`${relative}: WebPage citation metadata missing`);

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(match[1]);
      const nodes = data['@graph'] || [data];
      for (const node of nodes) {
        if (node['@type'] === 'Product' && node.offers && !node.offers.availability) {
          issues.push(`${relative}: Product offer availability missing`);
        }
      }
    } catch { issues.push(`${relative}: invalid JSON-LD`); }
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    try {
      const url = new URL(match[1], `https://jigyousho-bousai.com/${relative.replaceAll('\\', '/')}`);
      if (url.hostname !== 'jigyousho-bousai.com' || !url.pathname.endsWith('.html')) continue;
      const linkedFile = path.resolve(root, url.pathname.replace(/^\//, ''));
      if (!knownFiles.has(linkedFile)) issues.push(`${relative}: broken internal link ${url.pathname}`);
    } catch { issues.push(`${relative}: invalid link ${match[1]}`); }
  }
}

const data = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'products.json'), 'utf8'));
const expectedTypes = {
  'toilet-office': new Set(['toilet']),
  'water-food-stock': new Set(['water', 'food']),
  'blackout-power': new Set(['power', 'mobile-power', 'lighting'])
};
function validateProductRecord(pageSlug, product) {
  const recordIssues = [];
  const required = ['productType', 'genreId', 'fetchedAt', 'sourceKeyword'];
  for (const field of required) {
    if (!product[field]) recordIssues.push(`missing ${field}`);
  }
  if (!Object.prototype.hasOwnProperty.call(product, 'affiliateRate')) recordIssues.push('missing affiliateRate');
  const inferredType = detectProductType(product.titleRaw || product.name);
  if (product.productType !== inferredType) recordIssues.push(`stored type ${product.productType} differs from ${inferredType}`);
  const allowed = expectedTypes[pageSlug];
  if (allowed && !allowed.has(inferredType)) recordIssues.push(`mismatched type ${inferredType}`);
  return recordIssues;
}

const validSchemaFixture = {
  productType: 'water', genreId: '100316', fetchedAt: '2026-07-23T00:00:00.000Z',
  sourceKeyword: '長期保存水 事業所', affiliateRate: 4, titleRaw: '5年保存 天然水 2L'
};
const invalidSchemaFixture = { ...validSchemaFixture, productType: 'water', titleRaw: '給水タンク 10L' };
if (validateProductRecord('water-food-stock', validSchemaFixture).length) {
  issues.push('schemaVersion 2 validator rejected a valid fixture');
}
if (!validateProductRecord('water-food-stock', invalidSchemaFixture).some((item) => item.includes('mismatched type'))) {
  issues.push('schemaVersion 2 validator accepted an invalid fixture');
}
for (const page of data.pages || []) {
  if ((page.products || []).length < 8) issues.push(`${page.slug}: fewer than 8 products`);
  if (Number(data.schemaVersion || 0) >= 2) {
    for (const product of page.products || []) {
      for (const issue of validateProductRecord(page.slug, product)) {
        issues.push(`${page.slug}: ${product.itemCode || product.name} ${issue}`);
      }
    }
  }
}

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!/User-agent: OAI-SearchBot\s+Allow: \//.test(robots)) issues.push('robots.txt: OAI-SearchBot is not explicitly allowed');
if (!robots.includes(`Sitemap: https://jigyousho-bousai.com/sitemap.xml`)) issues.push('robots.txt: sitemap declaration missing');

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`Site verification passed: ${files.length} HTML files`);
