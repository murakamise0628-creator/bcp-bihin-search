import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { configuredPaidProduct, unpublishedPaidProduct } from './configure-paid-kit.mjs';

const require = createRequire(import.meta.url);
const { isApprovedBaseProductUrl } = require('./paid-checkout-url.cjs');

const base = {
  published: false,
  slug: 'stockpile-management-kit',
  name: '事業所防災 備蓄算定・稟議キット',
  price: 9800,
  checkoutUrl: '',
  allowedCheckoutHosts: []
};
const now = new Date('2026-07-23T00:00:00Z');
const configured = configuredPaidProduct(base, 'https://sample-shop.base.shop/items/123', now);
assert.equal(configured.published, true);
assert.equal(configured.checkoutUrl, 'https://sample-shop.base.shop/items/123');
assert.deepEqual(configured.allowedCheckoutHosts, ['sample-shop.base.shop']);
assert.equal(configured.updatedAt, '2026-07-23');
assert.equal(unpublishedPaidProduct(configured, now).published, false);
assert.throws(() => configuredPaidProduct(base, ''), /正しくありません/);
assert.throws(() => configuredPaidProduct(base, 'http://sample-shop.base.shop/items/123'), /https/);
assert.throws(() => configuredPaidProduct(base, 'https://jigyousho-bousai.com/checkout'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://localhost/checkout'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://evil.example.net/pay'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://github.com/not-a-checkout'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://base.shop/'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://sample-shop.base.shop/'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://sample-shop.base.shop:444/items/123'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://user:pass@sample-shop.base.shop/items/123'), /BASEの商品ページURL/);
assert.throws(() => configuredPaidProduct(base, 'https://sample-shop.base.shop/items/123?redirect=evil'), /BASEの商品ページURL/);
assert.equal(isApprovedBaseProductUrl('https://sample-shop.base.shop/items/123'), true);
assert.equal(isApprovedBaseProductUrl('https://evil.example.net/items/123'), false);

console.log('Paid kit configuration tests: PASS');
