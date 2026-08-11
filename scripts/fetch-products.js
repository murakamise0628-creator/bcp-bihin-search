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

function affiliateRateValue(item) {
  const rate = Number(item.affiliateRate || 0);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function compareRankedProducts(a, b) {
  const aQuality = Number(a.relevance || 0) + Number(a.score || 0);
  const bQuality = Number(b.relevance || 0) + Number(b.score || 0);
  const qualityDifference = bQuality - aQuality;
  const aQualityBand = Math.round(aQuality / 10);
  const bQualityBand = Math.round(bQuality / 10);

  // Commission only breaks ties inside a stable quality band.
  if (aQualityBand !== bQualityBand) return bQualityBand - aQualityBand;
  const affiliateDifference = affiliateRateValue(b) - affiliateRateValue(a);
  return affiliateDifference || qualityDifference;
}

const pageRules = {
  'portable-power-kaigo': {
    boost: /ポータブル電源|蓄電|バッテリー|Wh|リン酸鉄|電源|停電/i,
    weak: /トイレ|非常食|保存食|水/,
    productTypes: ['power']
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
    weak: /非常食|保存水|電源/,
    productTypes: ['toilet']
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
    weak: /トイレ|非常食|保存水/,
    productTypes: ['power', 'mobile-power', 'lighting']
  },
  'water-food-stock': {
    boost: /保存水|非常食|アルファ米|備蓄|長期保存|5年|7年|会社|法人|企業/i,
    weak: /ペット|アウトドア|キャンプ/,
    productTypes: ['water', 'food']
  },
  'emergency-food-office': {
    boost: /非常食|保存食|アルファ米|備蓄食|長期保存|3日分|7年|50食|100食|会社|法人|企業/i,
    weak: /ペット|アウトドア|キャンプ|保存水|飲料水/,
    productTypes: ['food']
  },
  'bcp-stockpile-checklist': {
    boost: /防災セット|備蓄|保存水|非常食|簡易トイレ|ライト|帰宅困難|企業|法人|会社/i,
    weak: /ペット|アウトドア|キャンプ/
  }
};

const excludePattern = /中古|訳あり|ジャンク|ふるさと納税|レンタル|本体のみ|ケースのみ|カバーのみ|交換用|部品|アクセサリのみ|リュック単体|中身はない|バッグのみ|釣り|登山専用|ペット専用|犬用|猫用|光るおもちゃ|おもちゃ|玩具|景品|縁日|くじ引き|お祭り|リュック\s*(?:単品|のみ)|中身(?:は)?(?:ない|なし)|サブセット/i;
const hypePattern = /最強|絶対|完全|万能|奇跡|爆売れ|神|ランキング.{0,8}1位|ポイント\d+倍|セール|送料無料|最安|激安|受賞/i;
const homeyPattern = /家庭用|一人用|1人用|個人用|ソロ|キャンプ|アウトドア/i;

function isEmergencyFoodSetCandidate(product) {
  const title = String(product.titleRaw || product.name || '');
  if ((product.productType || detectProductType(title)) !== 'food') return false;
  if (/野菜ジュース|ジュース|飲料|ドリンク|スープ単品/.test(title) && !/(?:非常食セット|\d+食|\d+日分|\d+人用|一人用)/.test(title)) return false;
  if (/^(?:\u975e\u5e38\u98df|\u4fdd\u5b58\u98df)$/.test(productDisplayTitle(title, product.summary || ''))) return false;
  return /非常食セット|保存食セット|備蓄食セット|詰め合わせ|\d+\s*(?:食|個|袋|缶)(?:入り|セット|詰)?|\d+日分|\d+人(?:用|分)|一人用/.test(title);
}

function relevanceScore(product, row) {
  const rule = pageRules[row.slug] || {};
  const text = `${product.titleRaw || product.name || ''} ${product.summary || ''}`;
  let points = 0;
  if (rule.boost && rule.boost.test(text)) points += 90;
  if (rule.weak && rule.weak.test(text)) points -= 35;
  if (hypePattern.test(text)) points -= 12;
  if (homeyPattern.test(text) && !/保育園|子供|こども/.test(text)) points -= 18;
  if (row.slug === 'office-bichiku' && /(?:^|[^0-9])(?:1|2)人用|一人用|二人用/.test(text)) points -= 140;
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

function matchesPageType(product, row) {
  const allowedTypes = pageRules[row.slug]?.productTypes;
  const source = String(product.titleRaw || product.name || '');
  const productType = detectProductType(source);
  if (allowedTypes && !allowedTypes.includes(productType)) return false;
  if (row.slug === 'portable-power-kaigo' && /ソーラーパネル|太陽光パネル|ソーラーチャージャー/.test(source)) {
    const withoutCompatibility = source.replace(/\d{3,5}\s*Wh\s*(?:対応|用)/gi, '');
    if (!/\d{3,5}\s*Wh|蓄電池|バッテリー(?:容量)?/.test(withoutCompatibility)) return false;
  }
  return true;
}

function candidateTier(product, row) {
  if (isExcluded(product)) return 'exclude';
  if (!matchesPageType(product, row)) return 'exclude';
  if (row.slug === 'emergency-food-office' && !isEmergencyFoodSetCandidate(product)) return 'exclude';
  const source = String(product.titleRaw || product.name || '');
  const facts = decisionFacts(product);
  if (row.slug === 'toilet-office') {
    if (hasAmbiguousToiletQuantity(product) || !facts.toiletUses || facts.toiletUses < 30) return 'demoted';
    if (facts.toiletSupplyType === 'complete-kit') return 'preferred';
    return 'supplementary';
  }
  if (['portable-power-kaigo', 'blackout-power'].includes(row.slug)) {
    return facts.powerWh && facts.outputW ? 'preferred' : 'demoted';
  }
  if (row.slug === 'office-bichiku') {
    const household = /(?:^|[^0-9])(?:1|2)人用|一人用|二人用|個人用|家庭用|家族用|自宅用|ソロ/.test(source);
    const business = /法人|企業|会社|オフィス|事業所|施設|団体|自治体|帰宅困難|業務用|(?:[5-9]|[1-9]\d+)人用/.test(source)
      || /法人\d{2,}社|官公庁/.test(String(product.summary || ''));
    if (facts.productType !== 'disaster-set') return 'supplementary';
    if (household && !business) return 'demoted';
    if (!facts.peopleCapacity || !facts.stockDays) return 'supplementary';
  }
  return 'preferred';
}

function semanticProductKey(product) {
  return String(product.titleShort || titleShort(product.titleRaw || product.name || ''))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_/・,，.。()（）【】\[\]]+/g, '');
}

function prioritizeProductVariety(products) {
  const unique = [];
  const repeated = [];
  const seenProducts = new Set();
  for (const product of products) {
    const key = semanticProductKey(product);
    if (key && seenProducts.has(key)) repeated.push(product);
    else {
      if (key) seenProducts.add(key);
      unique.push(product);
    }
  }

  const firstByType = [];
  const remaining = [];
  const seenTypes = new Set();
  const typeCounts = new Map();
  for (const product of unique) {
    const type = product.productType || detectProductType(product.titleRaw || product.name);
    if (type && type !== 'other' && !seenTypes.has(type)) {
      seenTypes.add(type);
      typeCounts.set(type, 1);
      firstByType.push(product);
    } else {
      remaining.push(product);
    }
  }
  const balanced = [];
  const overflow = [];
  for (const product of remaining) {
    const type = product.productType || detectProductType(product.titleRaw || product.name);
    const count = typeCounts.get(type) || 0;
    if (seenTypes.size > 1 && type !== 'other' && count >= 6) overflow.push(product);
    else {
      balanced.push(product);
      typeCounts.set(type, count + 1);
    }
  }
  return [...firstByType, ...balanced, ...overflow, ...repeated];
}

function fixedToiletPack(source) {
  const explicitPack = source.match(/(\d{1,4})\s*回分?\s*[×xX]\s*(\d{1,4})\s*(?:袋|個|パック|箱|セット)/);
  const bundledPack = source.match(/(\d{1,4})\s*回分\s+(\d{1,4})\s*(?:個|袋|パック)\s*セット/);
  const match = explicitPack || bundledPack;
  if (!match) return null;
  const perPack = Number(match[1]);
  const packCount = Number(match[2]);
  return { perPack, packCount, total: perPack * packCount };
}

function hasAmbiguousToiletQuantity(product) {
  const source = String(product?.titleRaw || product?.name || product || '')
    .replace(/1回あたり[^／/\s]*/g, '');
  if (!/簡易トイレ|簡単トイレ|非常用トイレ|携帯トイレ|災害用トイレ|凝固剤/.test(source)) return false;
  if (/\d{1,3}\s*P.{0,20}\d{1,4}\s*個セット/i.test(source)) return true;
  if (/\d{1,4}\s*[\/／・]\s*\d{1,4}\s*回(?:分)?/.test(source)) return true;
  const counts = new Set([...source.matchAll(/(\d{1,4})\s*回(?:分)?/g)].map((match) => Number(match[1])));
  const fixedPack = fixedToiletPack(source);
  if (fixedPack) {
    const { perPack, packCount, total } = fixedPack;
    const allowedCounts = new Set([1, perPack, packCount, total]);
    if ([...counts].every((count) => allowedCounts.has(count))) return false;
  }
  if (counts.size === 2 && counts.has(1) && /1\s*回分ずつ(?:個包装|包装|小分け)/.test(source)) return false;
  if (counts.size > 1) return true;
  return counts.size === 1 && /選べる|選択式|各種|最大\s*\d{1,4}\s*回|\d+\s*サイズ/.test(source);
}

function toiletUseCount(product) {
  const source = String(product?.titleRaw || product?.name || product || '')
    .replace(/1回あたり[^／/\s]*/g, '');
  if (!/簡易トイレ|簡単トイレ|非常用トイレ|携帯トイレ|災害用トイレ|凝固剤|汚物処理袋|サニタクリーン/.test(source)) return null;
  const fixedPack = fixedToiletPack(source);
  if (fixedPack && !/\d{1,4}\s*[\/／・]\s*\d{1,4}\s*回(?:分)?/.test(source)) {
    const { perPack, packCount, total } = fixedPack;
    const statedCounts = [...source.matchAll(/(\d{1,4})\s*回(?:分)?/g)].map((match) => Number(match[1]));
    const allowedCounts = new Set([1, perPack, packCount, total]);
    if (statedCounts.every((count) => allowedCounts.has(count))) return total;
  }
  if (hasAmbiguousToiletQuantity(source)) return null;
  const count = source.match(/(\d{1,4})\s*回分?/);
  if (count) return Number(count[1]);
  const packedCount = source.match(/(\d{1,4})\s*(?:個|枚)(?:組|セット)/);
  return packedCount ? Number(packedCount[1]) : null;
}

function detectProductType(raw) {
  const source = String(raw || '');
  const setIndex = source.search(/防災(?:備蓄)?セット|避難セット|防災リュック/);
  const toiletIndex = source.search(/簡易トイレ|簡単トイレ|非常用トイレ|携帯トイレ|災害用トイレ|凝固剤/);
  const safetyIndex = source.search(/防災ヘルメット|ヘルメット|転倒防止|家具固定|飛散防止/);
  const leadingProductText = setIndex >= 0 ? source.slice(0, setIndex) : '';
  if (toiletIndex >= 0 && toiletIndex < setIndex && /\d{1,4}\s*回(?:分)?|凝固剤|汚物袋|排便袋|防臭袋|排泄/.test(leadingProductText)) {
    return 'toilet';
  }
  if (setIndex >= 0 && safetyIndex >= 0) {
    const safetyMention = source.slice(safetyIndex, setIndex);
    const isIncludedInSet = /付き|付属|同梱|入り/.test(safetyMention);
    return safetyIndex < setIndex && !isIncludedInSet ? 'safety' : 'disaster-set';
  }
  const candidates = [
    ['disaster-set', /防災(?:備蓄)?セット|避難セット|防災リュック/],
    ['water-container', /給水タンク|給水袋|ポリタンク|ウォータータンク|ウォーターバッグ/],
    ['toilet', /簡易トイレ|簡単トイレ|非常用トイレ|携帯トイレ|災害用トイレ|凝固剤/],
    ['mobile-power', /モバイルバッテリー|携帯充電器/],
    ['power', /ポータブル電源|蓄電池|非常用電源/],
    ['lighting', /LEDランタン|充電式ランタン|懐中電灯/],
    ['flood-control', /土のう|水のう|防水シート|止水板|吸水バッグ/],
    ['hygiene', /手指消毒|除菌|ウェットティッシュ|使い捨て手袋|衛生用品|ドライシャンプー/],
    ['safety', /防災ヘルメット|ヘルメット|転倒防止|家具固定|飛散防止/],
    ['communication', /防災ラジオ|手回しラジオ|非常用ラジオ/],
    ['water', /保存水|長期保存水|長期保存.{0,4}(?:天然水|飲料水)|保存用.{0,4}(?:天然水|飲料水)|(?:5年|7年|10年)保存.{0,4}(?:天然水|飲料水)/],
    ['food', /非常食|保存食|アルファ米|備蓄食/],
    ['blanket', /ブランケット|毛布|防寒シート/]
  ];
  return candidates
    .map(([type, pattern], priority) => ({ type, priority, index: source.search(pattern) }))
    .filter((candidate) => candidate.index >= 0)
    .sort((a, b) => a.index - b.index || a.priority - b.priority)[0]?.type || 'other';
}

function boundedCount(source, suffix, max) {
  const match = source.match(new RegExp(`(\\d{1,6})${suffix}`));
  if (!match) return '';
  const value = Number(match[1]);
  return value > 0 && value <= max ? match[0] : '';
}

function standaloneSpec(source, pattern) {
  const match = source.match(new RegExp(`(?:^|[^A-Za-z0-9])(${pattern})(?![A-Za-z])`, 'i'));
  return match?.[1] || '';
}

function powerOutputSpec(source) {
  const candidates = [
    ...source.matchAll(/定格(?:出力)?\s*(\d{2,5})\s*W(?!h)/gi),
    ...source.matchAll(/(\d{2,5})\s*W(?:出力|高出力)/gi),
    ...source.matchAll(/(?:高出力|出力)\s*(\d{2,5})\s*W(?!h)/gi)
  ].sort((a, b) => a.index - b.index);
  for (const match of candidates) {
    const context = source.slice(Math.max(0, match.index - 16), match.index);
    if (/(?:パネル|ソーラー|太陽光)(?:の)?[\s：:（）()・-]*(?:定格)?$/.test(context)) continue;
    return `${match[1]}W`;
  }
  if (/ソーラーパネル|太陽光パネル|ソーラーチャージャー/.test(source)) return '';
  return source.match(/\d+(?:\.\d+)?W(?!h)/i)?.[0] || '';
}

function decisionFacts(product) {
  const source = String(product?.titleRaw || product?.name || product || '').normalize('NFKC');
  const productType = product?.productType || detectProductType(source);
  const toiletUses = toiletUseCount(source);
  const verifiedCompleteKit = /(?:\bBOS\b.{0,48}(?:非常用|簡易)トイレセット|(?:非常用|簡易)トイレセット.{0,48}\bBOS\b|SAFETY\s*TOILET\s+BCP\s*\d+)/i.test(source);
  const hasCoagulant = /凝固剤|固形剤|吸水ポリマー/.test(source) || verifiedCompleteKit;
  const hasWasteBag = /汚物袋|排便袋|処理袋|防臭袋|消臭袋|臭わない袋|においバイバイ袋|BOS/.test(source) || verifiedCompleteKit;
  const hasDeodorizingBag = /防臭袋|消臭袋|臭わない袋|においバイバイ袋|BOS/.test(source) || verifiedCompleteKit;
  let toiletSupplyType = '';
  if (productType === 'toilet') {
    if (hasCoagulant && hasWasteBag) toiletSupplyType = 'complete-kit';
    else if (hasCoagulant) toiletSupplyType = 'coagulant-only';
    else if (hasWasteBag || /汚物処理袋/.test(source)) toiletSupplyType = 'bag-only';
    else toiletSupplyType = 'contents-unclear';
  }

  const people = source.match(/(\d{1,3})\s*人用/);
  const days = source.match(/(\d{1,2})\s*日分/);
  const wh = source.match(/(\d{3,5})\s*Wh/i);
  const output = powerOutputSpec(source).match(/(\d{2,5})\s*W/i);
  const includedCategories = [];
  if (/保存水|長期保存水|飲料水/.test(source)) includedCategories.push('water');
  if (/非常食|保存食|アルファ米|備蓄食/.test(source)) includedCategories.push('food');
  if (/簡易トイレ|非常用トイレ|携帯トイレ|凝固剤/.test(source)) includedCategories.push('toilet');
  if (/ライト|ランタン|懐中電灯/.test(source)) includedCategories.push('lighting');
  if (/ブランケット|毛布|防寒シート/.test(source)) includedCategories.push('blanket');

  return {
    productType,
    toiletUses,
    toiletSupplyType,
    hasCoagulant,
    hasWasteBag,
    hasDeodorizingBag,
    peopleCapacity: people ? Number(people[1]) : null,
    stockDays: days ? Number(days[1]) : null,
    powerWh: wh ? Number(wh[1]) : null,
    outputW: output ? Number(output[1]) : null,
    storageYears: Number(source.match(/(\d{1,2})\s*年保存/)?.[1] || 0) || null,
    includedCategories
  };
}

function decisionSummary(product, row = {}) {
  const facts = decisionFacts(product);
  if (facts.productType === 'toilet') {
    const quantity = facts.toiletUses ? `${facts.toiletUses}回分` : '回数は販売ページで確認';
    if (facts.toiletSupplyType === 'complete-kit') {
      if (facts.hasDeodorizingBag) {
        return `${quantity}。凝固剤・処理袋・防臭袋の同梱表記があります。`;
      }
      return `${quantity}。凝固剤と処理袋の同梱表記があります。防臭袋の有無も確認してください。`;
    }
    if (facts.toiletSupplyType === 'coagulant-only') {
      return `${quantity}の凝固剤です。処理袋・防臭袋は別途必要か確認してください。`;
    }
    if (facts.toiletSupplyType === 'bag-only') {
      return `${quantity}相当の袋用品です。凝固剤が別途必要か確認してください。`;
    }
    return `${quantity}。凝固剤・処理袋・防臭袋の内訳を確認してください。`;
  }
  if (facts.productType === 'power') {
    const capacity = facts.powerWh ? `${facts.powerWh}Wh` : '容量Whは要確認';
    const output = facts.outputW ? `定格出力${facts.outputW}W` : '定格出力Wは要確認';
    return `${capacity}・${output}。使用機器の定格消費電力と起動電力を販売ページで確認してください。`;
  }
  if (facts.productType === 'disaster-set') {
    const audience = facts.peopleCapacity ? `${facts.peopleCapacity}人用表記` : '対象人数は要確認';
    const duration = facts.stockDays ? `${facts.stockDays}日分表記` : '備蓄日数は要確認';
    const categories = facts.includedCategories.map((type) => ({
      water: '保存水',
      food: '非常食',
      toilet: '簡易トイレ',
      lighting: 'ライト',
      blanket: '防寒用品'
    }[type])).filter(Boolean);
    const included = categories.length ? `${categories.join('・')}を含む表記` : 'セット内訳は要確認';
    return `${audience}・${duration}。${included}です。人数と待機日数に対する数量を確認してください。`;
  }
  if (row.slug === 'office-bichiku') {
    return '防災セットの補充候補です。必要数量と、セット本体に含まれている数を照合してください。';
  }
  return '容量・数量・保存年数と、事業所での使用条件を販売ページで確認してください。';
}

function titleShort(raw, maxLength = 58) {
  const source = String(raw || '')
    .replace(/[【】\[\]■◆★☆◎〇○●◇<>＜＞]/g, ' ')
    .replace(/送料無料|ポイント\d+倍|ランキング(?:総合)?(?:第?\s*\d+\s*位|入賞|受賞)?(?:獲得)?|セール|最安|激安|お買い物マラソン|スーパーSALE|クーポン|あす楽/g, ' ')
    .replace(/防災グッズ|災害対策|非常時|備蓄用品/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = [];
  const brand = source.match(/\b(Anker|EcoFlow|Jackery|BLUETTI|BOS|アイリスオーヤマ|サンワサプライ|尾西|アルファ米)\b/i);
  if (brand) parts.push(brand[1]);

  const productType = detectProductType(source);
  const variableQuantity = hasAmbiguousToiletQuantity(source);
  const toiletCount = toiletUseCount(source);
  const specs = [
    source.match(/\d{2,5}Wh/i)?.[0],
    powerOutputSpec(source),
    source.match(/\d{4,6}mAh/i)?.[0],
    toiletCount ? `${toiletCount}回分` : '',
    source.match(/\d{1,3}人用/)?.[0],
    source.match(/\d{1,3}人\s*[×xX]\s*\d{1,2}日分/)?.[0]?.replace(/\s+/g, ''),
    productType === 'food' ? source.match(/\d{1,3}人\s*\d{1,2}日分/)?.[0]?.replace(/\s+/g, '') : '',
    source.match(/\d{1,2}年保存/)?.[0],
    standaloneSpec(source, '\\d+(?:\\.\\d+)?L'),
    boundedCount(source, '食', 1000),
    productType === 'food' ? source.match(/\d{1,3}種類?/)?.[0] : '',
    productType === 'food' ? boundedCount(source, '点', 1000) : '',
    boundedCount(source, '枚', 1000),
    toiletCount ? '' : boundedCount(source, '個', 1000)
  ].filter(Boolean);
  parts.push(...specs);
  if (/ソーラーパネル.{0,12}(?:セット|付)|(?:セット|付).{0,12}ソーラーパネル/.test(source)) parts.push('ソーラーパネルセット');
  if (productType === 'food' && /アレルギー|アレルゲン|特定原材料/.test(source)) parts.push('アレルギー配慮');
  if (productType === 'food' && /調理不要/.test(source) && /水不要/.test(source)) parts.push('調理・水不要');
  if (variableQuantity) parts.push('回数選択式');

  const typeLabels = {
    'disaster-set': '防災セット',
    'water-container': '給水用品',
    toilet: '非常用トイレ',
    'mobile-power': 'モバイルバッテリー',
    power: 'ポータブル電源',
    lighting: '非常用ライト',
    'flood-control': '浸水対策用品',
    hygiene: '衛生用品',
    safety: '安全対策用品',
    communication: '防災ラジオ',
    water: '保存水',
    food: '非常食',
    blanket: '防寒用品'
  };
  let productLabel = typeLabels[productType];
  const facts = decisionFacts({ titleRaw: source, productType });
  if (productType === 'toilet' && facts.toiletSupplyType === 'coagulant-only') {
    productLabel = 'トイレ用凝固剤';
  } else if (productType === 'toilet' && facts.toiletSupplyType === 'bag-only') {
    productLabel = 'トイレ用袋';
  } else if (productType === 'hygiene') {
    if (/ウェットティッシュ/.test(source)) productLabel = '除菌ウェットティッシュ';
    else if (/手指消毒|消毒液/.test(source)) productLabel = '手指消毒用品';
    else if (/手袋/.test(source)) productLabel = '使い捨て手袋';
  } else if (productType === 'flood-control') {
    if (/吸水バッグ/.test(source)) productLabel = '吸水バッグ';
    else if (/土のう|水のう/.test(source)) productLabel = '土のう・水のう';
    else if (/止水板/.test(source)) productLabel = '止水板';
  } else if (productType === 'safety' && /ヘルメット/.test(source)) {
    productLabel = '防災ヘルメット';
  }
  if (productLabel) parts.push(productLabel);

  const meaningful = uniqParts(parts);
  const fallback = source.split(/\s+/).slice(0, 5).join(' ');
  const result = meaningful.length ? meaningful.join(' ') : fallback;
  return result.length > maxLength ? result.slice(0, maxLength - 1) + '…' : result;
}

const genericProductLabels = new Set([
  '\u9632\u707d\u30bb\u30c3\u30c8', '\u975e\u5e38\u98df', '\u4fdd\u5b58\u98df', '\u4fdd\u5b58\u6c34',
  '\u975e\u5e38\u7528\u30c8\u30a4\u30ec', '\u30c8\u30a4\u30ec\u7528\u888b', '\u30c8\u30a4\u30ec\u7528\u51dd\u56fa\u5264',
  '\u7d66\u6c34\u7528\u54c1', '\u885b\u751f\u7528\u54c1', '\u5b89\u5168\u5bfe\u7b56\u7528\u54c1', '\u975e\u5e38\u7528\u30e9\u30a4\u30c8',
  '\u9632\u707d\u30e9\u30b8\u30aa', '\u30dd\u30fc\u30bf\u30d6\u30eb\u96fb\u6e90', '\u9632\u5bd2\u7528\u54c1', '\u6d78\u6c34\u5bfe\u7b56\u7528\u54c1'
]);
function productDisplayTitle(raw, summary = '', maxLength = 58) {
  const base = titleShort(raw, maxLength);
  if (!genericProductLabels.has(base)) return base;
  const enriched = titleShort(`${raw || ''} ${summary || ''}`, maxLength);
  if (!genericProductLabels.has(enriched)) return enriched;
  const descriptor = String(raw || '')
    .replace(/\u975e\u5e38\u98df(?:\u30bb\u30c3\u30c8)?|\u4fdd\u5b58\u98df(?:\u30bb\u30c3\u30c8)?|\u9632\u707d\u98df(?:\u30bb\u30c3\u30c8)?|\u5099\u84c4\u98df|\u9632\u707d\u30b0\u30c3\u30ba|\u9632\u707d\u30bb\u30c3\u30c8|\u4fdd\u5b58\u6c34|\u975e\u5e38\u7528\u30c8\u30a4\u30ec|\u30c8\u30a4\u30ec\u7528(?:\u888b|\u51dd\u56fa\u5264)|\u7d66\u6c34\u7528\u54c1|\u885b\u751f\u7528\u54c1|\u5b89\u5168\u5bfe\u7b56\u7528\u54c1|\u975e\u5e38\u7528\u30e9\u30a4\u30c8|\u9632\u707d\u30e9\u30b8\u30aa|\u30dd\u30fc\u30bf\u30d6\u30eb\u96fb\u6e90|\u9632\u5bd2\u7528\u54c1|\u6d78\u6c34\u5bfe\u7b56\u7528\u54c1|\u707d\u5bb3\u5bfe\u7b56|\u5099\u84c4\u54c1|\u9577\u671f\u4fdd\u5b58|\u8a70\u3081\u5408\u308f\u305b|\u30bb\u30c3\u30c8|\u975e\u5e38\u7528|\u9632\u707d|\u707d\u5bb3|\u7528\u54c1|\u5099\u84c4/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((part) => part.length > 1)
    .slice(0, 3)
    .join(' ');
  const result = descriptor ? `${descriptor} ${base}` : base;
  return result.length > maxLength ? result.slice(0, maxLength - 1) + '\u2026' : result;
}
function keywordsForRow(row) {
  const values = [row.keyword, row.keywords]
    .flatMap((value) => String(value || '').split('|'))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function normalizeProducts(items, sourceKeyword = '') {
  const fetchedAt = new Date().toISOString();
  return (items || [])
    .map((entry) => entry.Item || entry.item || entry)
    .map((item) => {
      const summary = compactText(item.catchcopy || item.itemCaption || '');
      const displayTitle = productDisplayTitle(item.itemName, summary);
      const product = {
        name: displayTitle,
        titleShort: displayTitle,
        titleRaw: item.itemName,
        price: item.itemPrice,
        image: firstImage(item),
        summary,
        url: item.affiliateUrl || item.itemUrl,
        reviewCount: item.reviewCount || 0,
        reviewAverage: item.reviewAverage || 0,
        shopName: item.shopName || '',
        itemCode: item.itemCode || '',
        productType: detectProductType(item.itemName),
        genreId: item.genreId || '',
        saleStartAt: item.startTime || '',
        saleEndAt: item.endTime || '',
        fetchedAt,
        sourceKeyword,
        availability: item.availability === 0 ? 0 : 1,
        priceIsFromVariant: hasAmbiguousToiletQuantity(item.itemName),
        score: score(item),
        affiliateRate: affiliateRateValue(item)
      };
      return {
        ...product,
        decisionFacts: decisionFacts(product),
        decisionSummary: decisionSummary(product)
      };
    });
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
  return normalizeProducts(json.Items || json.items || [], keyword);
}

async function fetchForKeyword(row) {
  const searchedKeywords = keywordsForRow(row);
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
  const ranked = products
    .filter((product) => !isExcluded(product))
    .filter((product) => matchesPageType(product, row))
    .filter((product) => {
      const key = product.itemCode || product.url || product.name;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((product) => ({ ...product, relevance: relevanceScore(product, row) }))
    .sort(compareRankedProducts);
  const preferred = ranked.filter((product) => candidateTier(product, row) === 'preferred');
  const supplementary = ranked.filter((product) => candidateTier(product, row) === 'supplementary');
  const demoted = ranked.filter((product) => candidateTier(product, row) === 'demoted');
  const deduped = prioritizeProductVariety([...preferred, ...supplementary, ...demoted]).slice(0, 12);

  return {
    ...row,
    searchedKeywords,
    products: deduped,
    fetchErrors: errors.length ? errors : undefined,
    error: deduped.length ? undefined : errors.join(' / ')
  };
}

async function main() {
  if (!appId || !accessKey || !affiliateId) {
    throw new Error('Rakuten API credentials are required; existing product data was not changed');
  }
  const rows = parseCsv(fs.readFileSync(keywordsPath, 'utf8'));
  const previous = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : { pages: [] };
  const previousBySlug = new Map((previous.pages || []).map((page) => [page.slug, page]));
  const minimumFreshCount = (row) => ['toilet-office', 'blackout-power', 'water-food-stock', 'emergency-food-office'].includes(row.slug) ? 12 : 8;
  const usableFallback = (row) => {
    const fallback = previousBySlug.get(row.slug);
    const products = (fallback?.products || []).filter((product) => matchesPageType(product, row));
    const hasMetadata = products.every((product) =>
      product.productType && product.genreId && product.fetchedAt && product.sourceKeyword &&
      product.productType === detectProductType(product.titleRaw || product.name)
    );
    return products.length >= minimumFreshCount(row) && hasMetadata ? { ...fallback, products } : null;
  };
  const results = [];
  for (const row of rows) {
    console.log('fetch:', keywordsForRow(row).join(' | '));
    try {
      const fetched = await fetchForKeyword(row);
      const minimumCount = minimumFreshCount(row);
      if ((fetched.products || []).length < minimumCount) {
        const fallback = usableFallback(row);
        if (fallback) {
          console.warn(`retain previous data: ${row.slug} (${fetched.products.length} fresh products)`);
          results.push({ ...fallback, staleReason: `fresh candidates: ${fetched.products.length}` });
        } else {
          throw new Error(`${row.slug}: fewer than ${minimumCount} relevant products`);
        }
      } else {
        results.push(fetched);
      }
    } catch (err) {
      console.warn('skip:', row.keyword, err.message);
      const fallback = usableFallback(row);
      if (!fallback) throw err;
      results.push({ ...fallback, staleReason: err.message });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const tempPath = `${outPath}.tmp`;
  const next = createProductDataset(previous, results);
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (current === serialized) {
    console.log('product data unchanged');
  } else {
    fs.writeFileSync(tempPath, serialized);
    fs.renameSync(tempPath, outPath);
    console.log('wrote', outPath);
  }
}

function sanitizeProductDataset(data) {
  const privateKeys = new Set([
    'affiliateRate',
    'affiliate_rate',
    'estimatedCommission',
    'estimatedCommissionBeforeCaps',
    'estimated_commission',
    'estimated_commission_before_caps'
  ]);
  return JSON.parse(JSON.stringify(data, (key, value) => privateKeys.has(key) ? undefined : value));
}

function createProductDataset(previous, results, now = new Date()) {
  const comparable = (value) => JSON.stringify(
    sanitizeProductDataset(value),
    (key, item) => key === 'fetchedAt' ? undefined : item
  );
  const unchanged = comparable(previous.pages || []) === comparable(results);
  return sanitizeProductDataset({
    schemaVersion: 2,
    generatedAt: unchanged && previous.generatedAt ? previous.generatedAt : now.toISOString(),
    pages: unchanged ? previous.pages : results
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  detectProductType,
  titleShort,
  productDisplayTitle,
  hasAmbiguousToiletQuantity,
  toiletUseCount,
  matchesPageType,
  candidateTier,
  compareRankedProducts,
  prioritizeProductVariety,
  decisionFacts,
  decisionSummary,
  isEmergencyFoodSetCandidate,
  isExcluded,
  sanitizeProductDataset,
  createProductDataset
};
