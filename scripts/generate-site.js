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
    :root{color-scheme:light;--ink:#15201b;--muted:#596862;--line:#d9e2dc;--soft:#f5f7f3;--paper:#fff;--main:#12614b;--main2:#0f4f72;--accent:#b31942;--warn:#8a5a00}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--soft);color:var(--ink);font-family:system-ui,-apple-system,"Yu Gothic","Meiryo",sans-serif;line-height:1.75}
    a{color:var(--main)}main{max-width:1160px;margin:0 auto;padding:24px 18px 56px}.site-head{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:18px}
    .brand{font-weight:900;font-size:21px;text-decoration:none;color:var(--ink)}.nav{display:flex;gap:14px;flex-wrap:wrap}.nav a{font-size:14px;text-decoration:none;color:var(--muted)}
    .hero{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:34px;box-shadow:0 10px 28px rgba(21,32,27,.07)}
    .eyebrow{font-size:13px;font-weight:800;color:var(--main);margin:0 0 8px}h1{font-size:clamp(30px,5vw,48px);line-height:1.25;margin:0 0 14px;letter-spacing:0}h2{font-size:24px;line-height:1.35;margin:0 0 12px}h3{font-size:18px;line-height:1.45;margin:0 0 8px}.lead{font-size:18px;max-width:850px}.muted{color:var(--muted)}.section{margin-top:28px}.section-title{display:flex;justify-content:space-between;gap:14px;align-items:end;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:22px}.card h2 a,.card h3 a{text-decoration:none;color:var(--ink)}.card h2 a:hover,.card h3 a:hover{text-decoration:underline}
    .checklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0 0;padding:0;list-style:none}.checklist li{background:#eef5f1;border:1px solid #d6e3dc;border-radius:8px;padding:12px 14px}
    .pill{display:inline-block;background:#e8f2ed;color:#145641;border:1px solid #cde0d6;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800}.pill.blue{background:#e8f1f6;color:#0f4f72;border-color:#c7dce8}.button{display:inline-block;margin-top:12px;padding:11px 18px;background:var(--main);color:white;border-radius:7px;text-decoration:none;font-weight:900}.button.secondary{background:#fff;color:var(--main);border:1px solid var(--main)}
    .product-list{display:grid;gap:14px}.product{display:grid;grid-template-columns:156px 1fr;gap:18px;align-items:start}.product-img{width:156px;height:156px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px}.product-img.placeholder{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px}.product h2{font-size:20px;overflow-wrap:anywhere}.summary{margin:8px 0;color:#33423b}.price{font-size:23px;font-weight:900;color:var(--accent);margin:8px 0}.facts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.fact{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:13px;background:#fbfcfb;color:#33423b}.notice{font-size:13px;color:var(--muted)}.empty{border:1px dashed #b8c8bf;background:#fbfcfb}.ad-note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
    .two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.steps{counter-reset:step;display:grid;gap:10px;margin:0;padding:0;list-style:none}.steps li{counter-increment:step;padding:12px 14px;border-left:4px solid var(--main);background:#fbfcfb}.steps li:before{content:counter(step) ". ";font-weight:900;color:var(--main)}
    @media(max-width:760px){main{padding:18px 14px 44px}.site-head{align-items:flex-start;flex-direction:column}.hero{padding:24px}.lead{font-size:16px}.section-title{display:block}.product{grid-template-columns:104px 1fr;gap:12px}.product-img{width:104px;height:104px}.product h2{font-size:17px}.two{grid-template-columns:1fr}.nav{gap:10px}}
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
    return `<article class="card empty"><h2>商品データを更新中です</h2><p>この用途は楽天の商品候補を絞り込み中です。まず下の選び方を確認し、必要数と保管場所を決めてください。</p></article>`;
  }
  return products.map((product, index) => `<article class="card product">
    ${product.image ? `<img class="product-img" src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">` : '<div class="product-img placeholder" aria-hidden="true">商品画像<br>取得待ち</div>'}
    <div>
      <p class="pill blue">比較候補 ${index + 1}</p>
      <h2>${esc(product.name)}</h2>
      ${product.summary ? `<p class="summary">${esc(product.summary)}</p>` : ''}
      <p class="price">${yen(product.price)}</p>
      <div class="facts">
        <span class="fact">レビュー ${esc(product.reviewAverage || '-')}</span>
        <span class="fact">件数 ${esc(product.reviewCount || 0)}</span>
        <span class="fact">${esc(product.shopName || '楽天市場')}</span>
      </div>
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
  const updated = data.generatedAt ? new Date(data.generatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '';
  const body = `<section class="hero">
    <p class="eyebrow">${esc(note.audience)}向け</p>
    <h1>${esc(page.title)}</h1>
    <p class="lead">${esc(note.problem)}</p>
    <p class="notice">商品候補は楽天市場の公開データをもとに自動更新しています。${updated ? `最終更新: ${esc(updated)}` : ''}</p>
  </section>
  <section class="section two">
    <article class="card"><h2>選ぶ前に見るポイント</h2><ul class="checklist">${checks}</ul></article>
    <article class="card"><h2>先に決めること</h2><ol class="steps"><li>対象人数を決める</li><li>待機時間を決める</li><li>置き場所と期限管理を決める</li></ol><p class="muted">${esc(note.avoid)}</p></article>
  </section>
  <section class="section">
    <div class="section-title"><h2>比較候補</h2><p class="notice">価格・在庫・レビューは変動します</p></div>
    <div class="product-list">${productCards(products)}</div>
  </section>
  <section class="section card">
    <h2>このページの見方</h2>
    <p>レビュー件数が多い商品は購入判断の材料が集まりやすい一方で、事業所用途では「人数分に足りるか」「保管できるか」「期限管理できるか」が重要です。購入前に楽天の商品ページでセット内容、個数、保存年数、送料を確認してください。</p>
    <p class="ad-note">このサイトは楽天アフィリエイトを利用しています。リンク先で購入された場合、サイト運営者に成果報酬が発生することがあります。</p>
  </section>
  ${productJsonLd(products)}`;
  return layout(page.title, body, `${page.title}。${note.problem}`, `${siteUrl}/pages/${page.slug}.html`);
}

const categoryCards = data.pages.map((page) => {
  const note = pageNotes[page.slug] || {};
  const count = (page.products || []).length;
  return `<article class="card">
    <p class="pill">${esc(note.audience || '事業所向け')}</p>
    <h2><a href="pages/${esc(page.slug)}.html">${esc(page.title)}</a></h2>
    <p>${esc(note.problem || page.keyword)}</p>
    <p class="notice">現在の比較候補: ${count}件</p>
  </article>`;
}).join('');

const indexBody = `<section class="hero">
  <p class="eyebrow">小規模事業所・店舗・施設向け</p>
  <h1>防災備蓄を、場面別に選びやすくする</h1>
  <p class="lead">停電、断水、帰宅困難、トイレ不足。災害時に実際に困る場面ごとに、事業所向けの備蓄用品を整理します。まず必要数と優先順位を決めて、楽天市場の商品候補を比較できます。</p>
</section>
<section class="section two" id="method">
  <article class="card"><h2>最初に決める順番</h2><ol class="steps"><li>従業員・利用者・来客の最大人数</li><li>施設内で待機する時間</li><li>トイレ、水、電源、防寒の優先順位</li><li>保管棚に入るサイズと期限管理</li></ol></article>
  <article class="card"><h2>商品を見る前の注意</h2><p>防災セットは「一式」と書かれていても、人数や回数が足りないことがあります。特に簡易トイレ、水、停電時の電源は、商品名ではなく容量・回数・保存年数で確認します。</p><a class="button secondary" href="#categories">用途別に見る</a></article>
</section>
<section class="section" id="categories"><h2>用途別に探す</h2><div class="grid">${categoryCards}</div></section>
<section class="section card"><h2>このサイトで扱うもの</h2><p>事業所防災ナビでは、見た目の安心感よりも、停電時に動かす機器、断水時の衛生、帰宅困難者の待機、簡易トイレの回数など、現場で不足しやすいものを優先して扱います。</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。価格・在庫・レビューは変動するため、購入前にリンク先で最新情報を確認してください。</p></section>`;

fs.writeFileSync(path.join(dist, 'index.html'), layout('事業所の防災用品比較', indexBody, '会社・店舗・施設向けに、防災備蓄、停電、断水、帰宅困難、簡易トイレ用品を用途別に比較します。', `${siteUrl}/`));
fs.writeFileSync(path.join(dist, 'CNAME'), 'jigyousho-bousai.com\n');
fs.mkdirSync(path.join(dist, 'pages'), { recursive: true });
for (const page of data.pages) {
  fs.writeFileSync(path.join(dist, 'pages', page.slug + '.html'), pageHtml(page));
}
const urls = [`${siteUrl}/`, ...data.pages.map((page) => `${siteUrl}/pages/${page.slug}.html`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
console.log('built', dist);
