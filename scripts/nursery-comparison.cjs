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

module.exports = { isSupplementalCandy, nurseryPurpose, nurseryGroups };
