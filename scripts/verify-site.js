const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { detectProductType, titleShort, hasAmbiguousToiletQuantity } = require('./fetch-products');

const projectRoot = path.resolve(__dirname, '..');
const root = path.join(projectRoot, 'dist');
const paidProduct = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'paid-product.json'), 'utf8'));
const indexNow = JSON.parse(fs.readFileSync(path.join(projectRoot, 'data', 'indexnow.json'), 'utf8'));
const paidProductPreview = process.env.PAID_KIT_PREVIEW === '1';
const paidProductEnabled = paidProduct.published || paidProductPreview;
const paidProductCheckoutUrl = process.env.PAID_KIT_CHECKOUT_URL || paidProduct.checkoutUrl || '';
const paidProductAllowedHosts = (process.env.PAID_KIT_ALLOWED_HOSTS || '')
  .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
  .concat(Array.isArray(paidProduct.allowedCheckoutHosts) ? paidProduct.allowedCheckoutHosts.map((host) => String(host).toLowerCase()) : []);
const paidProductRelative = path.join('pages', `${paidProduct.slug}.html`);
const paidProductPath = path.join(root, paidProductRelative);
function isPlaceholderCheckoutHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return /(^|\.)(example(?:\.(?:com|net|org))?|localhost|invalid|test)$/.test(host) || net.isIP(host) !== 0;
}

function walkHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) return walkHtml(file);
    return file.endsWith('.html') ? [file] : [];
  });
}

const allHtmlFiles = walkHtml(root);
const files = allHtmlFiles.filter((file) => !path.basename(file).startsWith('google'));
const knownFiles = new Set(allHtmlFiles.map((file) => path.resolve(file)));
const forbidden = /編集方針|参考サイトから反映|反映した入口|TOPの上部|商品取得を改善|取得条件|プロンプト|作業メモ|AI臭|UI上|次工程/;
const issues = [];
if (!/^[A-Za-z0-9-]{8,128}$/.test(indexNow.key || '')) issues.push('indexnow.json: key format is invalid');
if (indexNow.host !== 'jigyousho-bousai.com') issues.push('indexnow.json: host is invalid');
if (indexNow.endpoint !== 'https://api.indexnow.org/indexnow') issues.push('indexnow.json: endpoint is invalid');
if (typeof paidProduct.published !== 'boolean') issues.push('paid-product.json: published must be a boolean');
if (typeof paidProduct.name !== 'string' || !paidProduct.name.trim()) issues.push('paid-product.json: name is required');
if (!Number.isInteger(paidProduct.price) || paidProduct.price <= 0) issues.push('paid-product.json: price must be a positive integer');
for (const host of ['example.com', 'example.test', 'localhost', '127.0.0.1', '::1']) {
  if (!isPlaceholderCheckoutHost(host)) issues.push(`checkout host guard failed: ${host}`);
}

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
if (!hasAmbiguousToiletQuantity('簡易トイレ 20回分 60回分 120回分')) {
  issues.push('product variant detection failed: multiple toilet quantities');
}
if (!hasAmbiguousToiletQuantity('簡易トイレ 10/100回分')) {
  issues.push('product variant detection failed: slash-separated toilet quantities');
}
if (hasAmbiguousToiletQuantity('携帯トイレ 4回分×3袋セット')) {
  issues.push('product variant detection failed: fixed pack quantity must remain eligible');
}
if (hasAmbiguousToiletQuantity('簡易トイレ 100回分（1回分×100袋）')) {
  issues.push('product variant detection failed: fixed 100-pack must remain eligible');
}
if (hasAmbiguousToiletQuantity('簡易トイレ 100回分 1回分ずつ個包装')) {
  issues.push('product variant detection failed: fixed individually wrapped pack must remain eligible');
}
if (!hasAmbiguousToiletQuantity('選べる3サイズ 最大120回分 簡易トイレ')) {
  issues.push('product variant detection failed: selectable maximum quantity');
}
if (!hasAmbiguousToiletQuantity('防災セット 選べる3サイズ 最大120回分 簡易トイレ')) {
  issues.push('product variant detection failed: toilet variant must not depend on product-type order');
}
if (!titleShort('トイレ凝固剤 100回分 10年保存').includes('トイレ用凝固剤')) {
  issues.push('product title classification failed: coagulant-only product label');
}

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) issues.push(`${relative}: H1 must appear once`);
  if (!html.includes('G-LN824MSD7X')) issues.push(`${relative}: GA4 tag missing`);
  if (!html.includes("trackEvent('rakuten_click'")) issues.push(`${relative}: Rakuten click tracking missing`);
  if (!html.includes("trackEvent('select_item'")) issues.push(`${relative}: GA4 select_item tracking missing`);
  if (!html.includes("trackEvent('view_item_list'")) issues.push(`${relative}: GA4 item-list tracking missing`);
  if (!html.includes("trackEvent('stock_plan_compare_click'")) issues.push(`${relative}: stock-plan comparison tracking missing`);
  if (!html.includes("trackEvent('stock_plan_view'")) issues.push(`${relative}: stock-plan landing tracking missing`);
  if (!html.includes('index: params.product_position ? params.product_position - 1')) issues.push(`${relative}: GA4 item index must be zero-based`);
  const rakutenAnchors = [...html.matchAll(/<a\b[^>]*href="[^"]*hb\.afl\.rakuten\.co\.jp[^"]*"[^>]*>/g)].map((match) => match[0]);
  for (const anchor of rakutenAnchors) {
    if (!/data-variable-price="(?:true|false)"/.test(anchor)) {
      issues.push(`${relative}: Rakuten link missing variable-price disclosure marker`);
    }
  }
  for (const anchor of rakutenAnchors) {
    const position = Number(anchor.match(/data-product-position="(\d+)"/)?.[1] || 0);
    if (!position) issues.push(`${relative}: Rakuten link missing a positive product position`);
    if (/\/pages\//.test(relative.replace(/\\/g, '/')) && !/data-product-category="[^"]+"/.test(anchor)) {
      issues.push(`${relative}: Rakuten link has an empty product category`);
    }
  }
  if (rakutenAnchors.length) {
    const disclosureIndex = html.indexOf('このサイトにはアフィリエイト広告を含みます。');
    const firstRakutenIndex = html.indexOf(rakutenAnchors[0]);
    if (disclosureIndex < 0 || disclosureIndex > firstRakutenIndex) issues.push(`${relative}: affiliate disclosure missing before product links`);
  }
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
  if (relative !== 'site-policy.html') {
    if (!html.includes('source-references')) issues.push(`${relative}: public source section missing`);
    if (!html.includes('www.bousai.go.jp')) issues.push(`${relative}: Cabinet Office citation missing`);
    if (!html.includes('"citation":[')) issues.push(`${relative}: WebPage citation metadata missing`);
  }

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
  const requiredCount = ['toilet-office', 'blackout-power', 'water-food-stock'].includes(page.slug) ? 12 : 8;
  if ((page.products || []).length < requiredCount) issues.push(`${page.slug}: fewer than ${requiredCount} products`);
  const pageFile = path.join(root, 'pages', `${page.slug}.html`);
  const pageHtml = fs.existsSync(pageFile) ? fs.readFileSync(pageFile, 'utf8') : '';
  if (!pageHtml.includes('data-stock-plan="toilet"') || !pageHtml.includes('data-stock-plan="water_food"')) {
    issues.push(`${page.slug}: stock-plan comparison links missing`);
  }
  if (!pageHtml.includes('id="planSummary"') || !pageHtml.includes("target.searchParams.set('staff'")) {
    issues.push(`${page.slug}: stock-plan URL restoration missing`);
  }
  if (!pageHtml.includes("var minimum=item[0]==='days' ? 1 : 0")) {
    issues.push(`${page.slug}: stock-plan day validation missing`);
  }
  const displayedIds = new Set([...pageHtml.matchAll(/data-product-id="([^"]+)"/g)].map((match) => match[1]));
  if (displayedIds.size < requiredCount) issues.push(`${page.slug}: fewer than ${requiredCount} displayed product candidates`);
  for (const product of page.products || []) {
    if (hasAmbiguousToiletQuantity(product) && displayedIds.has(product.itemCode)) {
      const marker = `data-product-id="${product.itemCode}"`;
      const start = pageHtml.indexOf(marker);
      const end = start >= 0 ? pageHtml.indexOf('>', start) : -1;
      const attrs = start >= 0 && end >= 0 ? pageHtml.slice(start, end) : '';
      if (!attrs.includes('data-variable-price="true"')) {
        issues.push(`${page.slug}: ambiguous toilet quantity lacks variable-price marker (${product.itemCode})`);
      }
    }
  }
  if (Number(data.schemaVersion || 0) >= 2) {
    for (const product of page.products || []) {
      for (const issue of validateProductRecord(page.slug, product)) {
        issues.push(`${page.slug}: ${product.itemCode || product.name} ${issue}`);
      }
    }
  }
}

if (paidProductEnabled) {
  if (!fs.existsSync(paidProductPath)) {
    issues.push(`${paidProductRelative}: enabled paid-kit page was not generated`);
  } else {
    const html = fs.readFileSync(paidProductPath, 'utf8');
    const requiredMarkers = [
      'data-paid-kit-page',
      "trackEvent('paid_kit_offer_view'",
      "trackEvent('paid_kit_qualified_view'",
      "trackEvent('paid_kit_checkout_click'",
      'data-paid-kit-section="paid-kit-screens"',
      'data-paid-kit-section="paid-kit-conditions"',
      "document.visibilityState!=='visible'",
      'assets/paid-kit/basic-input.png',
      'assets/paid-kit/inventory-gap.png',
      'kit-example',
      '55,000円',
      'Microsoft Excel 2021',
      '動作保証外',
      '返品・不具合時の対応',
      `${Number(paidProduct.price || 0).toLocaleString('ja-JP')}円`
    ];
    for (const marker of requiredMarkers) {
      if (!html.includes(marker)) issues.push(`${paidProductRelative}: missing ${marker}`);
    }
    if (!/data-paid-kit-checkout="true"[^>]+href=|href="[^"]+"[^>]+data-paid-kit-checkout="true"/.test(html)) {
      issues.push(`${paidProductRelative}: checkout CTA missing`);
    }
    try {
      const checkout = new URL(paidProductCheckoutUrl);
      if (checkout.protocol !== 'https:') issues.push(`${paidProductRelative}: checkout URL must use HTTPS`);
      if (!paidProductAllowedHosts.includes(checkout.hostname.toLowerCase())) issues.push(`${paidProductRelative}: checkout host is not allowed`);
      if (paidProduct.published && isPlaceholderCheckoutHost(checkout.hostname)) {
        issues.push(`${paidProductRelative}: published checkout URL uses a placeholder host`);
      }
    } catch { issues.push(`${paidProductRelative}: checkout URL is invalid`); }
    if (paidProduct.published && /<meta name="robots" content="noindex/.test(html)) {
      issues.push(`${paidProductRelative}: published page must be indexable`);
    }
    if (!paidProduct.published && !/<meta name="robots" content="noindex,nofollow">/.test(html)) {
      issues.push(`${paidProductRelative}: preview page must be noindex`);
    }
  }
} else if (fs.existsSync(paidProductPath)) {
  issues.push(`${paidProductRelative}: unpublished paid-kit page must not be generated`);
}

for (const name of ['basic-input.png', 'inventory-gap.png']) {
  const asset = path.join(root, 'assets', 'paid-kit', name);
  if (!fs.existsSync(asset) || fs.statSync(asset).size < 10000) issues.push(`assets/paid-kit/${name}: missing or unexpectedly small`);
}
const homeHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeHasPaidKit = homeHtml.includes('data-paid-kit-offer="true"');
if (paidProduct.published && !homeHasPaidKit) issues.push('index.html: published paid-kit link missing');
if (!paidProduct.published && homeHasPaidKit) issues.push('index.html: unpublished paid-kit link must be absent');

const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
if (!/User-agent: OAI-SearchBot\s+Allow: \//.test(robots)) issues.push('robots.txt: OAI-SearchBot is not explicitly allowed');
if (!/User-agent: ChatGPT-User\s+Allow: \//.test(robots)) issues.push('robots.txt: ChatGPT-User is not explicitly allowed');
if (!robots.includes(`Sitemap: https://jigyousho-bousai.com/sitemap.xml`)) issues.push('robots.txt: sitemap declaration missing');
const indexNowKeyPath = path.join(root, `${indexNow.key}.txt`);
if (!fs.existsSync(indexNowKeyPath) || fs.readFileSync(indexNowKeyPath, 'utf8').trim() !== indexNow.key) {
  issues.push('IndexNow key file is missing or invalid');
}
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const deployStatusPath = path.join(root, 'deploy-status.json');
if (!fs.existsSync(deployStatusPath)) {
  issues.push('deploy-status.json: missing');
} else {
  const deployStatus = JSON.parse(fs.readFileSync(deployStatusPath, 'utf8'));
  const expectedSitemapHash = crypto.createHash('sha256').update(sitemap).digest('hex');
  const generatedFiles = [];
  function collectGeneratedFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) collectGeneratedFiles(absolutePath);
      else if (entry.name !== 'deploy-status.json') generatedFiles.push(absolutePath);
    }
  }
  collectGeneratedFiles(root);
  const contentHash = crypto.createHash('sha256');
  for (const file of generatedFiles.sort()) {
    contentHash.update(path.relative(root, file).split(path.sep).join('/'));
    contentHash.update('\0');
    contentHash.update(fs.readFileSync(file));
    contentHash.update('\0');
  }
  if (deployStatus.buildId !== contentHash.digest('hex')) issues.push('deploy-status.json: buildId does not match generated files');
  if (deployStatus.sitemapSha256 !== expectedSitemapHash) issues.push('deploy-status.json: sitemap hash mismatch');
}
const paidProductCanonical = `https://jigyousho-bousai.com/pages/${paidProduct.slug}.html`;
if (paidProduct.published && !sitemap.includes(paidProductCanonical)) issues.push('sitemap.xml: published paid-kit page missing');
if (!paidProduct.published && sitemap.includes(paidProductCanonical)) issues.push('sitemap.xml: unpublished paid-kit page must be absent');
const llmsPath = path.join(root, 'llms.txt');
if (!fs.existsSync(llmsPath)) {
  issues.push('llms.txt: missing');
} else {
  const llms = fs.readFileSync(llmsPath, 'utf8');
  if (!llms.startsWith('# 事業所防災ナビ\n')) issues.push('llms.txt: title or format is invalid');
  if (/<\?xml|<urlset/i.test(llms)) issues.push('llms.txt: must not contain sitemap XML');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const url of sitemapUrls) {
    if (!llms.includes(url)) issues.push(`llms.txt: missing ${url}`);
  }
  if (!llms.includes('価格、在庫、レビュー、商品仕様は変動します')) issues.push('llms.txt: product information caution missing');
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`Site verification passed: ${files.length} HTML files`);
