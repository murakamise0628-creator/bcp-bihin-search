const { decisionFacts, hasVariablePrice } = require('./fetch-products');

function comparisonUnit(product) {
  const source = String(product.titleRaw || product.name || '').normalize('NFKC');
  const facts = decisionFacts(product);
  const price = Number(product.price);
  const unknown = { quantity: null, unit: '', unitPrice: null };
  if (!Number.isFinite(price) || price <= 0 || hasVariablePrice(product)) return unknown;
  if ([...source.matchAll(/(\d+)\s*(?:箱|ケース|セット)/g)].some(match => Number(match[1]) > 1) || /(?:約|最大)\s*\d+\s*(?:食|本|[mM]?[lL])/.test(source)) return unknown;
  // A range, bonus, multiplier or per-day count is not the sale unit.
  if (/\d\s*(?:食|本|袋|個|ケース|箱|[mM]?[lL])?\s*[~〜～－–-]\s*\d|増量|おまけ|プレゼント/i.test(source)) return unknown;
  let quantity;
  let unit;
  if (facts.productType === 'food') {
    if (facts.includedCategories.includes('water') || /1日\s*\d+\s*食|\d+\s*食\s*(?:あたり|当たり|当り|分|[×x])|[×x]\s*\d+\s*食/.test(source)) return unknown;
    const counts = [...new Set([...source.matchAll(/(\d+)\s*食(?!品)/g)].map(match => Number(match[1])))];
    if (counts.length !== 1) return unknown;
    quantity = counts[0]; unit = '食';
  } else if (facts.productType === 'water') {
    const capacities = [...new Set([...source.matchAll(/(\d+(?:\.\d+)?)\s*(ml|l)(?![a-z])/gi)].map(match => Number(match[1]) * (match[2].toLowerCase() === 'ml' ? 0.001 : 1)))];
    const bottles = [...new Set([...source.matchAll(/(\d+)\s*本/g)].map(match => Number(match[1])))];
    const cases = [...source.matchAll(/(\d+)\s*(?:ケース|箱)/g)].map(match => Number(match[1]));
    if (capacities.length !== 1 || bottles.length !== 1 || cases.some(count => count !== 1)) return unknown;
    quantity = Math.round(capacities[0] * bottles[0] * 1000) / 1000; unit = 'L';
  } else return unknown;
  if (!Number.isFinite(quantity) || quantity <= 0) return unknown;
  return { quantity, unit, unitPrice: Math.ceil(price / quantity) };
}

module.exports = { comparisonUnit };
