function isSupplementalCandy(product) {
  const title = String(product.titleRaw || product.name || product.titleShort || '');
  return product.productType === 'food' && /キャンディ|キャンデー|飴|あめ|ドロップ/.test(title) && !/米|パン|ご飯|粥|麺|主食|ミルク/.test(title);
}

function nurseryPurpose(product) {
  if (product.productType === 'food') return isSupplementalCandy(product) ? 'supplement' : 'food';
  if (product.productType === 'water') return 'water';
  return 'supplies';
}

function nurseryGroups(products) {
  return [
    { key: 'food', label: '非常食・保存食' },
    { key: 'water', label: '保存水' },
    { key: 'supplies', label: '持出し・衛生用品' },
    { key: 'supplement', label: '補助食品' }
  ].map(group => ({ ...group, products: products.filter(product => nurseryPurpose(product) === group.key) }))
    .filter(group => group.products.length > 0);
}

function nurseryPreparation(product) {
  if (product.productType !== 'food') return '';
  const text = `${product.titleRaw || product.name || product.titleShort || ''} ${product.summary || ''}`.normalize('NFKC');
  const unknown = '調理方法は販売ページで確認';
  // These are listing claims, not suitability or preparation guarantees for every item in a set.
  if (/一部|要加熱|要調理|不要(?:では|とは)|そのまま食べられ(?:ない|ません)|とは限ら|ではな[いく]|ではありません|もあります/.test(text)) return unknown;
  const waterNeeded = /(?:お湯か水|お湯または水|水またはお湯)を入れ/.test(text);
  const noHeatOrWater = /水や加熱が必要(?:なく|ない)|水・加熱不要/.test(text);
  const noCooking = /調理不要|そのまま食べられる/.test(text);
  const noWater = /水不要/.test(text);
  if (waterNeeded && (noHeatOrWater || noCooking || noWater)) return unknown;
  if (noHeatOrWater) return '水・加熱不要の表記';
  if (noCooking) return '調理不要の表記';
  if (waterNeeded) return '水またはお湯が必要の表記';
  if (noWater) return '水不要の表記（加熱の要否は確認）';
  return unknown;
}

module.exports = { isSupplementalCandy, nurseryPurpose, nurseryGroups, nurseryPreparation };
