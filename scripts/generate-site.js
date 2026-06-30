const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://jigyousho-bousai.com').replace(/\/$/, '');
const dataPath = path.join(root, 'data', 'products.json');

const fallback = { generatedAt: new Date().toISOString(), pages: [] };
const data = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : fallback;
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
    body{margin:0;background:#f6f7f4;color:#1f2a24;font-family:system-ui,-apple-system,"Yu Gothic",sans-serif;line-height:1.8}
    main{max-width:1080px;margin:0 auto;padding:40px 20px}
    a{color:#135f47}.hero,.card{background:#fff;border:1px solid #d8ded8;border-radius:14px;padding:28px;box-shadow:0 10px 28px rgba(0,0,0,.06)}
    h1{font-size:clamp(30px,5vw,48px);line-height:1.2;margin:0 0 14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-top:24px}
    .price{font-size:22px;font-weight:800;color:#c01835}.button{display:inline-block;margin-top:12px;padding:11px 18px;background:#1d6b50;color:white;border-radius:8px;text-decoration:none;font-weight:800}
    .muted{color:#627166}.product-img{max-width:180px;max-height:180px;object-fit:contain;background:#fff}.notice{font-size:13px;color:#627166;margin-top:28px}
  </style>
</head>
<body><main>${body}</main></body>
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
  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
}

function pageHtml(page) {
  const products = page.products || [];
  const cards = products.map((product, index) => `<article class="card">
    <h2>${index + 1}. ${esc(product.name)}</h2>
    ${product.image ? `<img class="product-img" src="${esc(product.image)}" alt="">` : ''}
    <p class="price">${yen(product.price)}</p>
    <p class="muted">レビュー ${esc(product.reviewAverage)} / 件数 ${esc(product.reviewCount)} / ${esc(product.shopName)}</p>
    <a class="button" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener">楽天で見る</a>
  </article>`).join('');
  const body = `<section class="hero">
    <p class="muted">会社・店舗・施設向け防災用品</p>
    <h1>${esc(page.title)}</h1>
    <p>${esc(page.keyword)}で探している人向けに、価格・レビュー・用途を比較します。</p>
  </section>
  <section class="grid">${cards}</section>
  <p class="notice">価格や在庫は楽天市場側で変更される場合があります。購入前にリンク先で最新情報を確認してください。</p>
  ${productJsonLd(products)}`;
  return layout(page.title, body, `${page.title}。会社・店舗・施設向けに防災用品を比較します。`, `${siteUrl}/pages/${page.slug}.html`);
}

const indexCards = data.pages.map((page) => `<article class="card"><h2><a href="pages/${esc(page.slug)}.html">${esc(page.title)}</a></h2><p class="muted">${esc(page.keyword)}</p></article>`).join('');
const indexBody = `<section class="hero"><h1>事業所防災ナビ</h1><p>会社・店舗・施設向けに、防災備蓄、停電対策、断水対策、帰宅困難者対策に使える用品を比較します。</p></section><section class="grid">${indexCards}</section>`;
fs.writeFileSync(path.join(dist, 'index.html'), layout('事業所防災ナビ', indexBody, '会社・店舗・施設向けの防災用品比較サイトです。', `${siteUrl}/`));
fs.writeFileSync(path.join(dist, 'CNAME'), 'jigyousho-bousai.com\n');
fs.mkdirSync(path.join(dist, 'pages'), { recursive: true });
for (const page of data.pages) {
  fs.writeFileSync(path.join(dist, 'pages', page.slug + '.html'), pageHtml(page));
}
const urls = [`${siteUrl}/`, ...data.pages.map((page) => `${siteUrl}/pages/${page.slug}.html`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
console.log('built', dist);
