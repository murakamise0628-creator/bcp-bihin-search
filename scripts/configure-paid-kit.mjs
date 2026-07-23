import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isApprovedBaseProductUrl } = require('./paid-checkout-url.cjs');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const configPath = path.join(root, 'data', 'paid-product.json');

export function configuredPaidProduct(current, checkoutUrl, now = new Date()) {
  let checkout;
  try {
    checkout = new URL(String(checkoutUrl || '').trim());
  } catch {
    throw new Error('決済URLが正しくありません。BASEの商品ページURLをそのまま指定してください。');
  }
  if (checkout.protocol !== 'https:') throw new Error('決済URLは https:// で始まる必要があります。');
  if (!isApprovedBaseProductUrl(checkout)) {
    throw new Error('BASEの商品ページURL（https://ショップ名.base.shop/items/商品ID）を指定してください。');
  }
  return {
    ...current,
    published: true,
    checkoutUrl: checkout.toString(),
    allowedCheckoutHosts: [checkout.hostname.toLowerCase()],
    updatedAt: now.toISOString().slice(0, 10)
  };
}

export function unpublishedPaidProduct(current, now = new Date()) {
  return {
    ...current,
    published: false,
    updatedAt: now.toISOString().slice(0, 10)
  };
}

function main() {
  const current = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const argument = process.argv[2] || '';
  const updated = argument === '--unpublish'
    ? unpublishedPaidProduct(current)
    : configuredPaidProduct(current, argument);
  fs.writeFileSync(configPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  console.log(updated.published
    ? `Paid kit enabled: ${updated.checkoutUrl}`
    : 'Paid kit disabled. Checkout URL was retained for recovery.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
