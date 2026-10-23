const { comparisonUnit } = require('./comparison-unit');
const { decisionFacts, isToiletPurchaseCandidate } = require('./fetch-products');

function procurementCandidates(products, kind, limit = 2) {
  if (!['water', 'food', 'toilet'].includes(kind)) return [];
  const seen = new Set();
  const candidates = [];
  for (const product of products) {
    if (!product.itemCode || seen.has(product.itemCode) || product.productType !== kind) continue;
    const unit = kind === 'toilet'
      ? isToiletPurchaseCandidate(product) ? { quantity: decisionFacts(product).toiletUses, unit: '回分' } : {}
      : comparisonUnit(product);
    if (!(unit.quantity > 0) || !Number.isSafeInteger(product.price) || product.price <= 0) continue;
    seen.add(product.itemCode);
    candidates.push({ product, quantity: unit.quantity, unit: unit.unit });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

module.exports = { procurementCandidates };
