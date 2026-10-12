function displayProductName(product, base, maxLength = 58) {
  // Apply only when rendering; acquisition and variety keys keep their existing names.
  const brand = String(product.titleRaw || '').match(/アイリスオーヤマ|サンワサプライ|尾西食品|尾西|アルファー食品|安心米|アルファ米|石井食品|グリーンケミー/)?.[0];
  const result = brand && !base.includes(brand) ? `${brand} ${base}` : base;
  return result.length > maxLength ? result.slice(0, maxLength - 1) + '…' : result;
}

module.exports = { displayProductName };
