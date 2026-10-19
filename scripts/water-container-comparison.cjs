const { hasVariablePrice } = require('./fetch-products');

const groups = [
  {key:'water',label:'給水タンク・給水袋'},
  {key:'hygiene',label:'衛生用品'},
  {key:'toilet',label:'簡易トイレ'},
  {key:'flood',label:'浸水対策（水のう）'},
  {key:'other',label:'その他の候補'}
];

function restaurantPurpose(product) {
  return {'water-container':'water',hygiene:'hygiene',toilet:'toilet','flood-control':'flood'}[product.productType] || 'other';
}

function restaurantGroups(products) {
  return groups.map(group => ({...group,products:products.filter(product => restaurantPurpose(product) === group.key)})).filter(group => group.products.length);
}

function containerFacts(product) {
  const unknown = {liters:null,containers:null,totalLiters:null};
  if (product.productType !== 'water-container') return unknown;
  const source = String(product.titleRaw || product.name || '').normalize('NFKC');
  if (/交換用|コックのみ|キャップのみ|蓋のみ|合計|総容量|総量/.test(source)) return unknown;
  const capacities = [...new Set([...source.matchAll(/(\d+(?:\.\d+)?)\s*(ml|l|リットル)(?![a-z])/gi)].map(match => Number(match[1]) * (match[2].toLowerCase() === 'ml' ? 0.001 : 1)))];
  if (capacities.length !== 1 || /\d+(?:\.\d+)?\s*(?:ml|l|リットル)?\s*[~〜～－–-]\s*\d+(?:\.\d+)?\s*(?:ml|l|リットル)|(?:約|最大)\s*\d+(?:\.\d+)?\s*(?:ml|l|リットル)/i.test(source)) return unknown;
  const liters = capacities[0];
  if (!(liters > 0 && liters <= 200)) return unknown;
  // Only the title's fixed container count is a sale unit; summary links often advertise other packs.
  const counts = [...new Set([...source.matchAll(/(\d+)\s*個/g)].map(match => Number(match[1])))];
  const containers = counts.length === 1 && counts[0] > 0 && counts[0] <= 100 && !hasVariablePrice(product) && !/選べる|選択|まで|おまけ|プレゼント|ごと|最大/.test(source) ? counts[0] : null;
  return {liters,containers,totalLiters:containers ? Math.round(liters * containers * 1000) / 1000 : null};
}

module.exports = {restaurantPurpose,restaurantGroups,containerFacts};
