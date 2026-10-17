import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { amazonOfferFor, amazonClickParams } = require('./amazon-links.cjs');
const titleRaw = 'BOS 非常用トイレ Bセット 50回分';
const product = { itemCode: 'shop:50', titleRaw, summary: '処理袋・凝固剤入り', productType: 'toilet' };
const at = Date.parse('2026-10-15T12:00:00+09:00');
const entry = { itemCode: product.itemCode, asin: 'B088BKW851', title: titleRaw, productType: 'toilet',
  pages: ['toilet-office'], rawTitleSha256: createHash('sha256').update(titleRaw).digest('hex'),
  summarySha256: createHash('sha256').update(product.summary).digest('hex'),
  verifiedAt: '2026-10-15T00:00:00+09:00', expiresAt: '2026-11-14T00:00:00+09:00' };
const config = { enabled: true, tag: 'example-22', products: [entry] };

test('Amazon offer requires an exact verified product and separate merchant URL', () => {
  const offer = amazonOfferFor(product, 'toilet-office', config, at);
  assert.equal(offer.url, 'https://www.amazon.co.jp/dp/B088BKW851?tag=example-22');
  assert.equal(offer.title, titleRaw);
  for (const key of ['price', 'availability', 'reviewAverage', 'image']) assert.equal(offer[key], undefined);
  assert.equal(amazonOfferFor({ ...product, titleRaw: 'ＢＯＳ 非常用トイレ Bセット 50回分' }, 'toilet-office', config, at)?.asin, entry.asin);
});

test('disable, invalid tag, unknown page, unknown product and missing original title fail closed', () => {
  for (const value of [undefined, {}, { ...config, enabled: false }, { ...config, tag: 'bad?tag=1' }, { ...config, products: [] }]) {
    assert.equal(amazonOfferFor(product, 'toilet-office', value, at), null);
  }
  assert.equal(amazonOfferFor(product, 'portable-power-kaigo', config, at), null);
  assert.equal(amazonOfferFor({ ...product, itemCode: 'shop:other' }, 'toilet-office', config, at), null);
  assert.equal(amazonOfferFor({ ...product, titleRaw: undefined }, 'toilet-office', config, at), null);
  assert.equal(amazonOfferFor({ ...product, titleRaw: 123 }, 'toilet-office', config, at), null);
  assert.equal(amazonOfferFor({ ...product, productType: 'food' }, 'toilet-office', config, at), null);
  assert.equal(amazonOfferFor({ ...product, priceIsFromVariant: true }, 'toilet-office', config, at), null);
  assert.equal(amazonOfferFor({ ...product, summary: undefined }, 'toilet-office', config, at), null);
  assert.equal(amazonOfferFor({ ...product, summary: '凝固剤のみ' }, 'toilet-office', config, at), null);
});

test('changed size, refills, changed descriptions and invalid or stale verification never retain the link', () => {
  for (const changed of ['BOS 非常用トイレ Bセット 100回分', 'BOS 凝固剤のみ 50回分', titleRaw + ' 2箱セット']) {
    assert.equal(amazonOfferFor({ ...product, titleRaw: changed }, 'toilet-office', config, at), null);
  }
  for (const change of [{ asin: 'https://evil.invalid' }, { rawTitleSha256: '' }, { verifiedAt: 'bad' },
    { verifiedAt: '2026-10-16' }, { expiresAt: '2026-10-15T01:00:00+09:00' }, { expiresAt: '2027-01-01' }]) {
    assert.equal(amazonOfferFor(product, 'toilet-office', { ...config, products: [{ ...entry, ...change }] }, at), null);
  }
  assert.equal(amazonOfferFor(product, 'toilet-office', config, Date.parse(entry.expiresAt)), null);
});

function anchor(url = 'https://www.amazon.co.jp/dp/B088BKW851?tag=example-22') {
  return { href: url, dataset: { affiliateMerchant: 'amazon', amazonAsin: 'B088BKW851', productName: titleRaw,
    productPrice: '9999', ctaLocation: 'comparison_table' } };
}

test('Amazon click params exclude Rakuten price, review values and affiliate tag', () => {
  const params = amazonClickParams(anchor());
  assert.equal(params.product_id, 'B088BKW851');
  assert.equal(params.affiliate_merchant, 'amazon');
  assert.equal(params.destination, 'https://www.amazon.co.jp/dp/B088BKW851');
  assert.equal(params.cta_location, 'comparison_table');
  assert.doesNotMatch(JSON.stringify(params), /example-22|9999|price|review/);
});

test('Amazon click params reject spoofed host, userinfo, ports, unrelated ASIN and missing tags', () => {
  for (const url of ['https://www.amazon.co.jp.evil.invalid/dp/B088BKW851?tag=example-22',
    'https://user@www.amazon.co.jp/dp/B088BKW851?tag=example-22',
    'https://www.amazon.co.jp:8443/dp/B088BKW851?tag=example-22',
    'http://www.amazon.co.jp/dp/B088BKW851?tag=example-22',
    'https://www.amazon.co.jp/dp/B000000000?tag=example-22',
    'https://www.amazon.co.jp/dp/B088BKW851', 'javascript:alert(1)']) {
    assert.equal(amazonClickParams(anchor(url)), null);
  }
  assert.equal(amazonClickParams({ ...anchor(), dataset: {} }), null);
});

test('verified expansion config keeps each model and bundle distinct', () => {
  const liveConfig = JSON.parse(fs.readFileSync(new URL('../data/amazon-links.json', import.meta.url), 'utf8'));
  const expected = {
    'hashbaby:10005832': ['B088BKW851', ['toilet-office']],
    'jackery-japan:10000025': ['B0D3HJM175', ['portable-power-kaigo', 'typhoon-office', 'blackout-power']],
    'jackery-japan:10000033': ['B0D3HLP1NM', ['portable-power-kaigo', 'typhoon-office', 'blackout-power']],
    'jackery-japan:10000004': ['B0CZ7145K1', ['typhoon-office', 'blackout-power']],
    'jackery-japan:10000120': ['B0D2HXKBF1', ['typhoon-office', 'blackout-power']]
  };
  assert.deepEqual(Object.fromEntries(liveConfig.products.map(item => [item.itemCode, [item.asin, item.pages]])), expected);
  for (const item of liveConfig.products) {
    assert.equal(item.amazonSource, `https://www.amazon.co.jp/dp/${item.asin}`);
    assert.match(item.manufacturerSource, /^https:\/\/(?:www\.jackery\.jp|bos-bos\.com)\//);
    assert.ok(Date.parse(item.expiresAt) - Date.parse(item.verifiedAt) <= 31 * 86400000);
  }
});

test('build renders only exact verified Amazon mappings, without Amazon offers in JSON-LD', () => {
  const root = new URL('../', import.meta.url);
  const input = JSON.parse(fs.readFileSync(new URL('data/products.json', root), 'utf8'));
  const liveConfig = JSON.parse(fs.readFileSync(new URL('data/amazon-links.json', root), 'utf8'));
  const policy = fs.readFileSync(new URL('dist/site-policy.html', root), 'utf8');
  assert.match(policy, /Amazonのアソシエイトとして/);
  for (const dir of ['pages', 'topics']) {
    for (const name of fs.readdirSync(new URL(`dist/${dir}/`, root)).filter(name => name.endsWith('.html'))) {
      const html = fs.readFileSync(new URL(`dist/${dir}/${name}`, root), 'utf8');
      const slug = name.replace(/\.html$/, '');
      const page = dir === 'pages' ? input.pages.find(item => item.slug === slug) : undefined;
      const offers = (page?.products || []).map(candidate => ({ candidate, offer: amazonOfferFor(candidate, slug, liveConfig) })).filter(item => item.offer);
      const cards = html.match(/<section[^>]*id="products"[\s\S]*?<\/section>/)?.[0] || '';
      const quickPicks = html.match(/<section[^>]*class="section quick-picks"[\s\S]*?<\/section>/)?.[0] || '';
      const expectedAsins = offers.flatMap(({ candidate, offer }) => Array(1 + Number(cards.includes(`data-product-key="${candidate.itemCode}"`)) + Number(quickPicks.includes(`data-product-key="${candidate.itemCode}"`))).fill(offer.asin)).sort();
      const links = [...html.matchAll(/<a[^>]+data-affiliate-merchant="amazon"[^>]*>/g)].map(match => match[0]);
      assert.deepEqual(links.map(link => link.match(/data-amazon-asin="([^"]+)"/)[1]).sort(), expectedAsins, `${dir}/${name}: exact mapping coverage`);
      for (const link of links) {
        assert.match(link, /rel="nofollow sponsored noopener"/);
        assert.doesNotMatch(link, /data-product-price/);
        const asin = link.match(/data-amazon-asin="([^"]+)"/)[1];
        const url = new URL(link.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'));
        assert.equal(url.origin, 'https://www.amazon.co.jp');
        assert.equal(url.pathname, `/dp/${asin}`);
        assert.equal(url.searchParams.get('tag'), liveConfig.tag);
      }
      for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        assert.doesNotMatch(JSON.stringify(JSON.parse(match[1])), /amazon\.co\.jp/);
      }
      if (links.length) {
        assert.match(html, /Amazonのアソシエイトとして、事業所防災ナビは適格販売により収入を得ています。/);
        assert.match(html, /楽天市場の価格・レビュー/);
      }
      assert.equal(html.includes("trackEvent('amazon_click'"), links.length > 0);
      assert.ok(html.includes("trackEvent('rakuten_click'"));
    }
  }
});
