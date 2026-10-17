function procurementEstimate(required, stock, pack, price, discrete = false) {
  const result = { missing: null, packages: null, cost: null, error: '' };
  const read = (raw, integer = false) => {
    if (String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 100000000 &&
      (!integer || Number.isInteger(value)) ? value : null;
  };
  const need = read(required);
  const available = read(stock, discrete);
  if (need === null || available === null) {
    return { ...result, error: '必要量と使用できる在庫数を確認してください。' };
  }
  result.missing = Math.max(0, Math.round((need - available) * 1e6) / 1e6);
  if (result.missing === 0) return { ...result, packages: 0, cost: 0 };
  const quantity = read(pack, discrete);
  if (quantity === null || quantity === 0) {
    return { ...result, error: '販売単位の内容量を入力してください。' };
  }
  result.packages = Math.max(1, Math.ceil(Math.round(result.missing / quantity * 1e9) / 1e9));
  const unitPrice = read(price, true);
  if (unitPrice === null || !Number.isSafeInteger(result.packages * unitPrice)) {
    return { ...result, error: '販売単位の税込価格を確認してください。' };
  }
  result.cost = result.packages * unitPrice;
  return result;
}

function selectPurchasePlan(required, candidates) {
  if (!Number.isSafeInteger(required) || required <= 0 || required > 100000000) return null;
  let best = null;
  for (const candidate of candidates) {
    if (!candidate || !Number.isSafeInteger(candidate.quantity) || candidate.quantity <= 0
      || !Number.isSafeInteger(candidate.price) || candidate.price <= 0) continue;
    const estimate = procurementEstimate(required, 0, candidate.quantity, candidate.price, true);
    if (estimate.error || estimate.packages === null || estimate.cost === null) continue;
    const plan = { candidate, packages: estimate.packages, supplied: candidate.quantity * estimate.packages, cost: estimate.cost };
    if (!best || plan.cost < best.cost
      || (plan.cost === best.cost && (plan.supplied < best.supplied
        || (plan.supplied === best.supplied && plan.packages < best.packages)))) best = plan;
  }
  return best;
}

module.exports = { procurementEstimate, selectPurchasePlan };
