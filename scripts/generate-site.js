const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://jigyousho-bousai.com').replace(/\/$/, '');
const dataPath = path.join(root, 'data', 'products.json');

const data = fs.existsSync(dataPath)
  ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  : { generatedAt: new Date().toISOString(), pages: [] };

const pageNotes = {
  'portable-power-kaigo': {
    audience: '介護施設・小規模福祉施設',
    problem: '停電時にスマホ、照明、通信機器、見守り機器の電源を最低限確保したい施設向けです。',
    checks: ['容量はWh表記で見る', '出力W数が使う機器に足りるか確認', '保管場所で持ち運べる重量か見る', '長期保管時の充電管理がしやすいものを選ぶ'],
    avoid: 'キャンプ用の雰囲気だけで選ばず、停電時に何時間使えるかを先に見ます。'
  },
  'office-bichiku': {
    audience: '小規模オフィス・士業事務所・店舗事務所',
    problem: '従業員が数時間から一晩待機する前提で、水、食料、ライト、トイレをまとめて確認したい事業所向けです。',
    checks: ['人数と待機時間から数量を決める', '水とトイレを食料より先に見る', '保管棚に収まるサイズか確認', '賞味期限の管理がしやすいセットを選ぶ'],
    avoid: '「防災セット一式」だけで安心せず、人数分に足りるかを確認します。'
  },
  'kitaku-konnansha': {
    audience: '駅近オフィス・商業施設・学習塾',
    problem: '災害時にすぐ帰れない従業員・来訪者が出る場所で、待機用品を揃えるための比較ページです。',
    checks: ['滞在人数の最大値を決める', '水・簡易トイレ・防寒を優先', '配布しやすい個包装か見る', '棚卸ししやすい単位で選ぶ'],
    avoid: '帰宅支援グッズだけに寄せすぎず、施設内で待つ前提の備蓄を入れます。'
  },
  'restaurant-dansui': {
    audience: '飲食店・小規模厨房・テイクアウト店',
    problem: '断水時の営業判断、衛生確保、トイレ対応に必要な用品を切り分けて考えるページです。',
    checks: ['飲料水と衛生用水を分ける', '手指衛生用品を先に確保', '簡易トイレと消臭袋を見る', '営業継続ではなく安全確保を基準にする'],
    avoid: '飲料水だけを買って終わらせず、手洗い・トイレ・片付けまで見ます。'
  },
  'hoikuen-bousai': {
    audience: '保育園・小規模園・一時預かり施設',
    problem: '子どもを一定時間安全に待機させるため、水、食料、衛生、防寒を確認するページです。',
    checks: ['園児数と職員数を分けて計算', 'アレルギー表示を確認', '衛生用品と防寒用品を厚めに見る', '持ち出し用と備蓄用を分ける'],
    avoid: '大人用のセットをそのまま流用せず、子ども向けの食べやすさと衛生を見ます。'
  },
  'toilet-office': {
    audience: '事業所・店舗・施設管理者',
    problem: '断水や排水不可のときに、最低限のトイレ環境を維持するための比較ページです。',
    checks: ['回数表記で必要量を見る', '凝固剤と袋のセット内容を確認', '保管年数と箱サイズを見る', '消臭袋や目隠し用品も合わせて考える'],
    avoid: '人数分ではなく回数分で計算します。水や食料より不足が表面化しやすい用品です。'
  }
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

function yen(value) {
  return Number(value || 0).toLocaleString('ja-JP') + '円';
}

function layout(title, body, description, canonical) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | 事業所防災ナビ</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <style>
    :root{color-scheme:light;--ink:#18231f;--muted:#5d6b64;--line:#d9e1dc;--soft:#f3f6f2;--paper:#fff;--main:#17634d;--accent:#b31942}
    *{box-sizing:border-box}body{margin:0;background:var(--soft);color:var(--ink);font-family:system-ui,-apple-system,"Yu Gothic","Meiryo",sans-serif;line-height:1.8}
    a{color:var(--main)}main{max-width:1120px;margin:0 auto;padding:28px 18px 56px}.site-head{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:20px}
    .brand{font-weight:900;font-size:20px;text-decoration:none;color:var(--ink)}.nav{display:flex;gap:12px;flex-wrap:wrap}.nav a{font-size:14px;text-decoration:none;color:var(--muted)}
    .hero{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:34px;box-shadow:0 8px 24px rgba(24,35,31,.06)}
    .eyebrow{font-size:13px;font-weight:800;color:var(--main);margin:0 0 8px}h1{font-size:clamp(30px,5vw,50px);line-height:1.25;margin:0 0 14px;letter-spacing:0}h2{font-size:24px;line-height:1.35;margin:0 0 12px}h3{font-size:18px;margin:0 0 8px}.lead{font-size:18px;max-width:780px}.muted{color:var(--muted)}.section{margin-top:28px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:22px}.card h2 a,.card h3 a{text-decoration:none;color:var(--ink)}.card h2 a:hover,.card h3 a:hover{text-decoration:underline}
    .checklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0 0;padding:0;list-style:none}.checklist li{background:#eef4f0;border:1px solid #d6e3dc;border-radius:8px;padding:12px 14px}
    .pill{display:inline-block;background:#e8f2ed;color:#145641;border:1px solid #cde0d6;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800}.button{display:inline-block;margin-top:12px;padding:11px 18px;background:var(--main);color:white;border-radius:7px;text-decoration:none;font-weight:900}.button.secondary{background:#fff;color:var(--main);border:1px solid var(--main)}
    .product{display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:start}.product-img{width:120px;height:120px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px}.price{font-size:22px;font-weight:900;color:var(--accent);margin:8px 0}.notice{font-size:13px;color:var(--muted)}.empty{border:1px dashed #b8c8bf;background:#fbfcfb}
    .two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}@media(max-width:760px){main{padding:18px 14px 44px}.site-head{align-items:flex-start;flex-direction:column}.hero{padding:24px}.lead{font-size:16px}.product{grid-template-columns:1fr}.product-img{width:100%;max-width:180px}.two{grid-template-columns:1fr}}
  </style>
</head>
<body><main><header class="site-head"><a class="brand" href="${siteUrl}/">事業所防災ナビ</a><nav class="nav"><a href="${siteUrl}/#categories">用途別に探す</a><a href="${siteUrl}/#method">選び方</a><a href="${siteUrl}/sitemap.xml">サイトマップ</a></nav></header>${body}</main></body>
</html>`;
}

function productJsonLd(products) {
  const graph = products.slice(0, 3).map((product) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'JPY',
      price: product.price || undefined,
      url: product.url
    },
    aggregateRating: product.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: product.reviewAverage,
      reviewCount: product.reviewCount
    } : undefined
  }));
  return graph.length ? `<script type="application/ld+json">${JSON.stringify(graph)}</script>` : '';
}

function productCards(products) {
  if (!products.length) {
    return `<article class="card empty"><h2>商品データを更新中です</h2><p>楽天API接続後、この欄に価格・レビュー・ショップ情報を反映します。いまは先に、事業所向けの選び方と必要数の考え方を確認できます。</p></article>`;
  }
  return products.map((product, index) => `<article class="card product">
    ${product.image ? `<img class="product-img" src="${esc(product.image)}" alt="">` : '<div class="product-img" aria-hidden="true"></div>'}
    <div>
      <p class="pill">候補 ${index + 1}</p>
      <h2>${esc(product.name)}</h2>
      <p class="price">${yen(product.price)}</p>
      <p class="muted">レビュー ${esc(product.reviewAverage)} / 件数 ${esc(product.reviewCount)} / ${esc(product.shopName)}</p>
      <a class="button" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener">楽天で詳細を見る</a>
    </div>
  </article>`).join('');
}

function pageHtml(page) {
  const note = pageNotes[page.slug] || {
    audience: '事業所',
    problem: `${page.keyword}を比較したい方向けです。`,
    checks: ['必要数を見る', '保管場所を見る', '期限管理を見る', '購入前に最新価格を見る'],
    avoid: '商品名だけで選ばず、用途に合うかを確認します。'
  };
  const products = page.products || [];
  const checks = note.checks.map((item) => `<li>${esc(item)}</li>`).join('');
  const body = `<section class="hero">
    <p class="eyebrow">${esc(note.audience)}向け</p>
    <h1>${esc(page.title)}</h1>
    <p class="lead">${esc(note.problem)}</p>
  </section>
  <section class="section two">
    <article class="card"><h2>選ぶ前に見るポイント</h2><ul class="checklist">${checks}</ul></article>
    <article class="card"><h2>失敗しやすい点</h2><p>${esc(note.avoid)}</p></article>
  </section>
  <section class="section"><h2>比較候補</h2><div class="grid">${productCards(products)}</div></section>
  <p class="notice">価格・在庫・レビューは変動します。購入前に楽天市場の商品ページで最新情報を確認してください。</p>
  ${productJsonLd(products)}`;
  return layout(page.title, body, `${page.title}。${note.problem}`, `${siteUrl}/pages/${page.slug}.html`);
}

const categoryCards = data.pages.map((page) => {
  const note = pageNotes[page.slug] || {};
  return `<article class="card">
    <p class="pill">${esc(note.audience || '事業所向け')}</p>
    <h2><a href="pages/${esc(page.slug)}.html">${esc(page.title)}</a></h2>
    <p>${esc(note.problem || page.keyword)}</p>
  </article>`;
}).join('');

const indexBody = `<section class="hero">
  <p class="eyebrow">会社・店舗・施設の防災備蓄を、用途から選ぶ</p>
  <h1>事業所の防災用品を、必要な場面ごとに比較する</h1>
  <p class="lead">水や食料だけでなく、停電、断水、帰宅困難、トイレ不足まで分けて考えるための比較サイトです。小規模オフィス、店舗、介護施設、保育園など、担当者が購入前に確認すべき観点を整理します。</p>
</section>
<section class="section two" id="method">
  <article class="card"><h2>まず決めること</h2><ul class="checklist"><li>何人分を想定するか</li><li>何時間から何日待機するか</li><li>水・トイレ・電源の優先順位</li><li>保管場所と更新管理の方法</li></ul></article>
  <article class="card"><h2>このサイトの使い方</h2><p>用途別ページで必要な観点を確認し、商品候補の価格・レビュー・ショップ情報を比較します。楽天API接続後は商品データを自動で更新します。</p><a class="button secondary" href="#categories">用途別に見る</a></article>
</section>
<section class="section" id="categories"><h2>用途別に探す</h2><div class="grid">${categoryCards}</div></section>
<section class="section card"><h2>対象にしている備え</h2><p>事業所防災ナビでは、見た目の防災セットではなく、実際に困りやすい「電源」「水」「トイレ」「待機」「衛生」「期限管理」を中心に扱います。</p></section>`;

fs.writeFileSync(path.join(dist, 'index.html'), layout('事業所の防災用品比較', indexBody, '会社・店舗・施設向けに、防災備蓄、停電、断水、帰宅困難、簡易トイレ用品を用途別に比較します。', `${siteUrl}/`));
fs.writeFileSync(path.join(dist, 'CNAME'), 'jigyousho-bousai.com\n');
fs.mkdirSync(path.join(dist, 'pages'), { recursive: true });
for (const page of data.pages) {
  fs.writeFileSync(path.join(dist, 'pages', page.slug + '.html'), pageHtml(page));
}
const urls = [`${siteUrl}/`, ...data.pages.map((page) => `${siteUrl}/pages/${page.slug}.html`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
console.log('built', dist);
