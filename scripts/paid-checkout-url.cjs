function isApprovedBaseProductUrl(value) {
  let checkout;
  try { checkout = value instanceof URL ? value : new URL(String(value || '').trim()); }
  catch { return false; }
  const host = String(checkout.hostname || '').toLowerCase();
  return checkout.protocol === 'https:'
    && host.endsWith('.base.shop')
    && !checkout.port
    && !checkout.username
    && !checkout.password
    && !checkout.search
    && !checkout.hash
    && /^\/items\/\d+\/?$/.test(checkout.pathname);
}

module.exports = { isApprovedBaseProductUrl };
