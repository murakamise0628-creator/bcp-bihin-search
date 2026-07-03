const fs = require('fs');
const path = require('path');

const appId = String(process.env.RAKUTEN_APP_ID || '').replace(/\D/g, '');
const affiliateId = String(process.env.RAKUTEN_AFFILIATE_ID || '').trim();
const root = path.resolve(__dirname, '..');
const keywordsPath = path.join(root, 'data', 'keywords.csv');
const outPath = path.join(root, 'data', 'products.json');

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] || '']));
  });
}

function score(item) {
  const reviewCount = Number(item.reviewCount || 0);
  const reviewAverage = Number(item.reviewAverage || 0);
  const price = Number(item.itemPrice || 0);
  const priceScore = price >= 3000 && price <= 200000 ? 30 : 5;
  return reviewCount * 0.5 + reviewAverage * 20 + priceScore;
}

async function fetchForKeyword(row) {
  if (!appId || !affiliateId) {
    return { ...row, products: sampleProducts(row) };
  }

  const url = new URL('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706');
  url.searchParams.set('format', 'json');
  url.searchParams.set('applicationId', appId);
  url.searchParams.set('affiliateId', affiliateId);
  url.searchParams.set('keyword', row.keyword);
  url.searchParams.set('hits', '10');
  url.searchParams.set('sort', '-reviewCount');
  url.searchParams.set('availability', '1');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Rakuten API failed: ' + res.status + ' ' + await res.text());
  const json = await res.json();
  const products = (json.Items || [])
    .map((entry) => entry.Item)
    .map((item) => ({
      name: item.itemName,
      price: item.itemPrice,
      image: item.mediumImageUrls?.[0]?.imageUrl || item.smallImageUrls?.[0]?.imageUrl || '',
      url: item.affiliateUrl || item.itemUrl,
      reviewCount: item.reviewCount || 0,
      reviewAverage: item.reviewAverage || 0,
      shopName: item.shopName || '',
      score: score(item)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { ...row, products };
}

function sampleProducts(row) {
  return [];
}

async function main() {
  const rows = parseCsv(fs.readFileSync(keywordsPath, 'utf8'));
  const results = [];
  for (const row of rows) {
    console.log('fetch:', row.keyword);
    try {
      results.push(await fetchForKeyword(row));
    } catch (err) {
      console.warn('skip:', row.keyword, err.message);
      results.push({ ...row, products: [], error: err.message });
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), pages: results }, null, 2));
  console.log('wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
