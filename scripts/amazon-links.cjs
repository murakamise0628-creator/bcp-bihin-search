const { createHash } = require('node:crypto');

function amazonOfferFor(product, pageSlug, config, now = Date.now()) {
  if (config?.enabled !== true || !/^[a-z0-9-]{1,60}-22$/.test(config.tag || '') || !Array.isArray(config.products)) return null;
  const entry = config.products.find(item => item?.itemCode === product?.itemCode && Array.isArray(item.pages) && item.pages.includes(pageSlug));
  if (!entry || !/^B[A-Z0-9]{9}$/.test(entry.asin || '') || typeof entry.title !== 'string' || !entry.title ||
      typeof product?.titleRaw !== 'string' || !product.titleRaw || typeof product.summary !== 'string' ||
      product.priceIsFromVariant === true || entry.productType !== product.productType) return null;
  const verified = Date.parse(entry.verifiedAt);
  const expires = Date.parse(entry.expiresAt);
  if (![verified, expires, now].every(Number.isFinite) || verified > now || expires <= now || expires <= verified || expires - verified > 31 * 86400000) return null;
  const normalized = product.titleRaw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (createHash('sha256').update(normalized).digest('hex') !== entry.rawTitleSha256) return null;
  const summary = product.summary.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (createHash('sha256').update(summary).digest('hex') !== entry.summarySha256) return null;
  const url = new URL(`https://www.amazon.co.jp/dp/${entry.asin}`);
  url.searchParams.set('tag', config.tag);
  return { asin: entry.asin, title: entry.title, url: url.toString() };
}

// Kept self-contained so the same validation runs in the generated client script.
function amazonClickParams(anchor) {
  const data = anchor?.dataset || {};
  if (data.affiliateMerchant !== 'amazon' || !/^B[A-Z0-9]{9}$/.test(data.amazonAsin || '')) return null;
  let url;
  try { url = new URL(anchor.href); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.amazon.co.jp' || url.port || url.username || url.password ||
      url.pathname !== `/dp/${data.amazonAsin}` || !/^[a-z0-9-]{1,60}-22$/.test(url.searchParams.get('tag') || '')) return null;
  return {
    product_id: data.amazonAsin,
    product_name: String(data.productName || '').slice(0, 120),
    affiliate_merchant: 'amazon',
    cta_location: data.ctaLocation || 'affiliate_link',
    destination: `${url.origin}${url.pathname}`
  };
}

module.exports = { amazonOfferFor, amazonClickParams };
