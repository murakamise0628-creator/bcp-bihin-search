const fs = require('fs');
const path = require('path');

const appId = String(process.env.RAKUTEN_APP_ID || '').trim();
const accessKey = String(process.env.RAKUTEN_ACCESS_KEY || '').trim();
const affiliateId = String(process.env.RAKUTEN_AFFILIATE_ID || '').trim();
const siteUrl = String(process.env.SITE_URL || 'https://jigyousho-bousai.com/').trim();
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
  const reviewScore = reviewCount ? Math.min(reviewCount, 900) * 0.45 : -20;
  const ratingScore = reviewAverage ? reviewAverage * 22 : -10;
  return reviewScore + ratingScore + priceScore;
}

const pageRules = {
  'portable-power-kaigo': {
    boost: /ポータブル電源|蓄電|バッテリー|Wh|リン酸鉄|電源|停電/i,
    weak: /トイレ|非常食|保存食|水/
  },
  'office-bichiku': {
    boost: /防災セット|備蓄|保存水|非常食|ライト|企業|法人|オフィス|10人|5人/i,
    weak: /ペット|アウトドア|キャンプ/
  },
  'kitaku-konnansha': {
    boost: /帰宅困難|備蓄|保存水|非常食|ブランケット|防寒|ライト|充電/i,
    weak: /ペット|キャンプ/
  },
  'restaurant-dansui': {
    boost: /給水|断水|保存水|水|消毒|手袋|衛生|簡易トイレ|トイレ|タンク/i,
    weak: /キャンプ|登山/
  },
  'hoikuen-bousai': {
    boost: /保育園|幼稚園|子供|こども|非常食|保存水|防災セット|衛生/i,
    weak: /ペット|登山/
  },
  'toilet-office': {
    boost: /簡易トイレ|非常用トイレ|携帯トイレ|災害用トイレ|凝固|汚物|排泄|防臭/i,
    weak: /非常食|保存水|電源/
  },
  'earthquake-office': {
    boost: /地震|防災セット|備蓄|保存水|非常食|簡易トイレ|ライト|帰宅困難/i,
    weak: /ペット|アウトドア|キャンプ/
  },
  'typhoon-office': {
    boost: /台風|大雨|停電|防水|土のう|ライト|ポータブル電源|給水|備蓄/i,
    weak: /ペット|釣り|登山/
  },
  'blackout-power': {
    boost: /停電|ポータブル電源|蓄電|バッテリー|Wh|リン酸鉄|LED|ランタン|充電/i,
    weak: /トイレ|非常食|保存水/
  },
  'water-food-stock': {
    boost: /保存水|非常食|アルファ米|備蓄|長期保存|5年|7年|会社|法人|企業/i,
    weak: /ペット|アウトドア|キャンプ/
  },
  'bcp-stockpile-checklist': {
    boost: /防災セット|備蓄|保存水|非常食|簡易トイレ|ライト|帰宅困難|企業|法人|会社/i,
    weak: /ペット|アウトドア|キャンプ/
  }
};

const excludePattern = /中古|訳あり|ジャンク|ふるさと納税|レンタル|本体のみ|ケースのみ|カバーのみ|交換用|部品|アクセサリのみ|釣り|登山専用|ペット専用|犬用|猫用/i;
const hypePattern = /最強|絶対|完全|万能|奇跡|爆売れ|神|ランキング.{0,8}1位|ポイント\d+倍|セール|送料無料|最安|激安|受賞/i;
const homeyPattern = /家庭用|一人用|1人用|個人用|ソロ|キャンプ|アウトドア/i;

function relevanceScore(product, row) {
  const rule = pageRules[row.slug] || {};
  const text = `${product.titleRaw || product.name || ''} ${product.summary || ''}`;
  let points = 0;
  if (rule.boost && rule.boost.test(text)) points += 90;
  if (rule.weak && rule.weak.test(text)) points -= 35;
  if (hypePattern.test(text)) points -= 12;
  if (homeyPattern.test(text) && !/保育園|子供|こども/.test(text)) points -= 18;
  if (Number(product.reviewCount || 0) < 3) points -= 18;
  if (!product.summary || product.summary.length < 20) points -= 8;
  for (const keyword of keywordsForRow(row)) {
    for (const part of keyword.split(/\s+/).filter((value) => value.length >= 2)) {
      if (text.includes(part)) points += 8;
    }
  }
  return points;
}

function isExcluded(product) {
  const text = `${product.titleRaw || product.name || ''} ${product.summary || ''}`;
  return excludePattern.test(text);
}

function normalizeImageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.replace(/^http:\/\//, 'https://').replace(/\?_ex=\d+x\d+$/, '');
  }
  if (typeof value.imageUrl === 'string') return normalizeImageUrl(value.imageUrl);
  if (typeof value.url === 'string') return normalizeImageUrl(value.url);
  return '';
}

function firstImage(item) {
  const groups = [
    item.mediumImageUrls,
    item.smallImageUrls,
    item.itemImageUrls,
    item.images
  ];

  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const entry of group) {
      const url = normalizeImageUrl(entry);
      if (url) return url;
    }
  }

  return normalizeImageUrl(
    item.imageUrl ||
    item.itemImageUrl ||
    item.mediumImageUrl ||
    item.smallImageUrl ||
    item.thumbnailUrl
  );
}

function compactText(value, maxLength = 130) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function uniqParts(parts) {
  const seen = new Set();
  return parts.filter((part) => {
    const key = part.replace(/\s+/g, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleShort(raw, maxLength = 58) {
  const source = String(raw || '')
    .replace(/[【】\[\]■◆★☆◎〇○●◇<>＜＞]/g, ' ')
    .replace(/送料無料|ポイント\d+倍|ランキング.{0,10}|セール|最安|激安|お買い物マラソン|スーパーSALE|クーポン|あす楽/g, ' ')
    .replace(/防災グッズ|災害対策|非常時|備蓄用品/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = [];
  const brand = source.match(/\b(Anker|EcoFlow|Jackery|BLUETTI|BOS|アイリスオーヤマ|サンワサプライ|尾西|アルファ米)\b/i);
  if (brand) parts.push(brand[1]);

  const specs = [
    source.match(/\d{2,5}Wh/i)?.[0],
    source.match(/\d{2,5}W/i)?.[0],
    source.match(/\d{1,4}回分/)?.[0],
    source.match(/\d{1,3}人用/)?.[0],
    source.match(/\d{1,2}年保存/)?.[0],
    source.match(/\d+(?:\.\d+)?L/)?.[0],
    source.match(/\d+食/)?.[0],
    source.match(/\d+枚/)?.[0],
    source.match(/\d+個/)?.[0]
  ].filter(Boolean);
  parts.push(...specs);

  if (/ポータブル電源|蓄電池|非常用電源/.test(source)) parts.push('ポータブル電源');
  else if (/簡易トイレ|非常用トイレ|携帯トイレ|災害用トイレ/.test(source)) parts.push('非常用トイレ');
  else if (/保存水|長期保存水|水/.test(source)) parts.push('保存水');
  else if (/非常食|保存食|アルファ米|パン/.test(source)) parts.push('非常食');
  else if (/給水タンク|給水袋|ポリタンク/.test(source)) parts.push('給水用品');
  else if (/ブランケット|毛布|防寒/.test(source)) parts.push('防寒用品');
  else if (/防災セット|防災リュック/.test(source)) parts.push('防災セット');

  const meaningful = uniqParts(parts);
  const fallback = source.split(/\s+/).slice(0, 5).join(' ');
  const result = meaningful.length ? meaningful.join(' ') : fallback;
  return result.length > maxLength ? result.slice(0, maxLength - 1) + '…' : result;
}

function keywordsForRow(row) {
  const values = [row.keyword, row.keywords]
    .flatMap((value) => String(value || '').split('|'))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function normalizeProducts(items) {
  return (items || [])
    .map((entry) => entry.Item || entry.item || entry)
    .map((item) => ({
      name: titleShort(item.itemName),
      titleShort: titleShort(item.itemName),
      titleRaw: item.itemName,
      price: item.itemPrice,
      image: firstImage(item),
      summary: compactText(item.catchcopy || item.itemCaption || ''),
      url: item.affiliateUrl || item.itemUrl,
      reviewCount: item.reviewCount || 0,
      reviewAverage: item.reviewAverage || 0,
      shopName: item.shopName || '',
      itemCode: item.itemCode || '',
      score: score(item)
    }));
}

async function requestKeyword(keyword) {
  const url = new URL('https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701');
  const referer = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';
  url.searchParams.set('format', 'json');
  url.searchParams.set('applicationId', appId);
  url.searchParams.set('accessKey', accessKey);
  url.searchParams.set('affiliateId', affiliateId);
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('hits', '30');
  url.searchParams.set('formatVersion', '2');
  url.searchParams.set('sort', '-reviewCount');
  url.searchParams.set('availability', '1');

  const res = await fetch(url, {
    headers: {
      accessKey,
      Referer: referer,
      Referrer: referer,
      Origin: referer.replace(/\/$/, '')
    }
  });
  if (!res.ok) throw new Error('Rakuten API failed: ' + res.status + ' ' + await res.text());
  const json = await res.json();
  return normalizeProducts(json.Items || json.items || []);
}

async function fetchForKeyword(row) {
  const searchedKeywords = keywordsForRow(row);
  if (!appId || !accessKey || !affiliateId) {
    return { ...row, searchedKeywords, products: sampleProducts(row) };
  }

  const products = [];
  const errors = [];
  for (const keyword of searchedKeywords) {
    try {
      products.push(...await requestKeyword(keyword));
    } catch (err) {
      errors.push(`${keyword}: ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const seen = new Set();
  const deduped = products
    .filter((product) => !isExcluded(product))
    .filter((product) => {
      const key = product.itemCode || product.url || product.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((product) => ({ ...product, relevance: relevanceScore(product, row) }))
    .sort((a, b) => (b.relevance + b.score) - (a.relevance + a.score))
    .slice(0, 12);

  return { ...row, searchedKeywords, products: deduped, error: deduped.length ? undefined : errors.join(' / ') };
}

function sampleProducts(row) {
  return [];
}

async function main() {
  const rows = parseCsv(fs.readFileSync(keywordsPath, 'utf8'));
  const results = [];
  for (const row of rows) {
    console.log('fetch:', keywordsForRow(row).join(' | '));
    try {
      results.push(await fetchForKeyword(row));
    } catch (err) {
      console.warn('skip:', row.keyword, err.message);
      results.push({ ...row, products: [], error: err.message });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), pages: results }, null, 2));
  console.log('wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
