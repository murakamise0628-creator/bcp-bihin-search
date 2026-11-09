import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nurseryComparison from './nursery-comparison.cjs';
import waterContainerTools from './water-container-comparison.cjs';
import productTools from './fetch-products.js';
import comparisonTools from './comparison-unit.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDir, '..');
const pagePath = path.join(root, 'dist', 'pages', 'bcp-stockpile-checklist.html');
const csvPath = path.join(root, 'dist', 'downloads', 'jigyousho-bousai-checklist.csv');
const homePath = path.join(root, 'dist', 'index.html');
const sitemapPath = path.join(root, 'dist', 'sitemap.xml');

assert.ok(fs.existsSync(pagePath), 'stockpile checklist page must be generated');
assert.ok(fs.existsSync(csvPath), 'stockpile checklist CSV must be generated');

const page = fs.readFileSync(pagePath, 'utf8');
const home = fs.readFileSync(homePath, 'utf8');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const csvBuffer = fs.readFileSync(csvPath);
const csv = csvBuffer.toString('utf8');

assert.match(page, /<h1>会社・事業所の防災備蓄チェックリスト<\/h1>/);
assert.match(page, /data-stockpile-tool/);
assert.match(page, /data-print-checklist/);
assert.match(page, /window\.print\(\)/);
assert.match(page, /data-download-checklist/);
const checklistQuantity = page.match(/<section[^>]*id="quantity"[\s\S]*?<\/section>/)?.[0] || '';
assert.match(checklistQuantity, /aria-label="不足品を比較"/, 'comparison entry must follow the quantity result, before the long checklist');
assert.match(checklistQuantity, /data-stock-plan="procurement"/);
assert.match(checklistQuantity, /data-plan-path="https:\/\/jigyousho-bousai\.com\/pages\/office-stockpile-quantity\.html#procurement"/);
assert.match(checklistQuantity, /href="https:\/\/jigyousho-bousai\.com\/pages\/office-stockpile-quantity\.html\?staff=10&amp;days=3&amp;visitors=0#procurement"/);
assert.ok(checklistQuantity.indexOf('data-stock-plan="procurement"') < checklistQuantity.indexOf('aria-label="不足品を比較"'), 'stock deduction must be reachable before choosing a product category');
assert.match(page, /target\.hash=target\.hash \|\| 'comparison'/, 'explicit purchase-calculator anchor must survive input changes');
for (const [type, slug, label] of [
  ['water_food', 'water-food-stock', 'waterFoodPlanLabel'],
  ['food', 'emergency-food-office', 'foodPlanLabel'],
  ['toilet', 'toilet-office', 'toiletPlanLabel']
]) {
  assert.ok(checklistQuantity.includes(`data-stock-plan="${type}"`));
  assert.ok(checklistQuantity.includes(`data-plan-path="https://jigyousho-bousai.com/pages/${slug}.html"`));
  assert.ok(checklistQuantity.includes(`id="${label}"`));
  assert.ok(checklistQuantity.includes(`href="https://jigyousho-bousai.com/pages/${slug}.html?staff=10&amp;days=3&amp;visitors=0#comparison"`));
}
assert.doesNotMatch(checklistQuantity, /hb\.afl\.rakuten/, 'checklist must offer comparison, not a blind affiliate jump');
assert.match(page, /"@type":"WebApplication"/);
assert.doesNotMatch(page, /"@type":"Product"/);
assert.equal((page.match(/type="checkbox" data-stockpile-check/g) || []).length, 34);
assert.match(page, /<link rel="canonical" href="https:\/\/jigyousho-bousai\.com\/pages\/bcp-stockpile-checklist\.html">/);
assert.match(page, /<meta property="og:title"/);
assert.match(page, /<meta name="twitter:card"/);

assert.deepEqual(Array.from(csvBuffer.subarray(0, 3)), [0xef, 0xbb, 0xbf], 'CSV must include a UTF-8 BOM');
assert.ok(csv.trim().split(/\r?\n/).length >= 35, 'CSV must include common and facility-specific rows');
assert.match(csv, /"担当","確認日","状態","メモ"/);

assert.match(home, /pages\/bcp-stockpile-checklist\.html/);
assert.match(home, /人数計算・印刷・CSV/);
assert.match(sitemap, /<loc>https:\/\/jigyousho-bousai\.com\/pages\/bcp-stockpile-checklist\.html<\/loc>/);
const sitemapDates = [...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)].map((match) => match[1]);
assert.ok(sitemapDates.length > 0, 'sitemap must include lastmod dates');
assert.ok(sitemapDates.every((date) => Date.parse(`${date}T00:00:00+09:00`) >= Date.parse('2026-08-03T00:00:00+09:00')), 'sitemap lastmod must include the editorial update');

const power = fs.readFileSync(path.join(root, 'dist', 'pages', 'portable-power-kaigo.html'), 'utf8');
assert.match(power, /data-power-load-tool/);
assert.equal((power.match(/data-load-watts type=/g) || []).length, 3);
assert.equal((power.match(/data-load-count type=/g) || []).length, 3);
assert.match(power, /id="powerLoadApply" disabled/);
assert.match(power, /医療機器への適合を判断する計算ではありません/);
assert.match(power, /機器ごとの消費電力と台数から合計W/);
const powerFaq = [...power.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(match => JSON.parse(match[1])).find(graph => graph['@type'] === 'FAQPage')?.mainEntity;
assert.ok(powerFaq?.some(item => item.name === '機器を複数台使う場合、消費電力はどう計算しますか？'));
const quantityGuide = fs.readFileSync(path.join(root, 'dist', 'pages', 'office-stockpile-quantity.html'), 'utf8');
const waterChoiceHtml=quantityGuide.match(/<select id="waterCandidate"[\s\S]*?<\/select>/)?.[0] || '';
const waterChoices=[...waterChoiceHtml.matchAll(/<option value="([^"]+)" data-candidate-pack="([^"]+)" data-candidate-price="([^"]+)">([^<]+)<\/option>/g)];
assert.ok(waterChoices.length>0);
assert.equal((quantityGuide.match(/data-water-unit-price/g)||[]).length,waterChoices.length);
for(const [,id,pack,price,label] of waterChoices){
  const unitLabel=`1Lあたり約${Math.ceil(Number(price)/Number(pack)).toLocaleString('ja-JP')}円`;
  assert.ok(label.includes(unitLabel), 'water choice must expose comparable per-liter price: '+id);
  const card=[...quantityGuide.matchAll(/<article class="procurement-candidate"[\s\S]*?<\/article>/g)].map(m=>m[0]).find(html=>html.includes(`data-procurement-candidate="${id}"`));
  assert.ok(card?.includes(`<span data-water-unit-price>${unitLabel}（送料別）</span>`));
}
assert.match(quantityGuide,/単価は掲載価格÷総容量の目安（1円未満切り上げ・送料別）/);
assert.doesNotMatch(quantityGuide, /data-power-load-tool/);
for (const kind of ['water','food','toilet']) {
  assert.match(quantityGuide,new RegExp(`id="${kind}Candidate"[^>]*data-procurement-select`),'quantity calculator needs a bounded product choice');
  assert.match(quantityGuide,new RegExp(`id="${kind}Candidates"`));
}
assert.ok(quantityGuide.indexOf('id="procurement"') < quantityGuide.indexOf('id="quantity-table"'));
const quantityResultSection = quantityGuide.match(/<section[^>]*id="quantity"[\s\S]*?<\/section>/)?.[0] || '';
assert.match(quantityResultSection, /data-procurement-entry[^>]*href="#procurement"/, 'calculation result must lead to the purchase-unit calculator on the same page');
assert.ok(quantityResultSection.indexOf('data-procurement-entry') < quantityResultSection.indexOf('class="stock-plan-actions"'), 'local purchase calculation must precede links to other comparison pages');
assert.match(quantityGuide,/内容量・掲載価格を計算に使う/);
assert.match(quantityGuide,/data-procurement-candidate/);
assert.ok(!/<option[^>]+\sdata-(?:pack|price)=/.test(quantityGuide), 'candidate metadata must not shadow calculator inputs');
assert.match(quantityGuide,/手入力した内容量・価格/);
assert.match(quantityGuide,/procurement_candidate/);
const method = quantityGuide.match(/<section[^>]*id="calculation-method"[\s\S]*?<\/section>/)?.[0] || '';
assert.match(method, /会社の防災備蓄量の計算方法/, 'calculation method must be visible, not only inside noscript');
assert.doesNotMatch(method, /<noscript/);
assert.doesNotMatch(method, /下の入力欄/, 'moved explanation must not point to inputs below it');
for (const formula of ['対象人数 × 日数 × 3L', '対象人数 × 日数 × 3食', '対象人数 × 日数 × 5回', '対象人数 × 1枚']) {
  assert.ok(method.includes(formula), `missing visible formula: ${formula}`);
}
assert.match(method, /来客・利用者/);
assert.match(method, /二重/);
assert.match(method, /園児/);
assert.match(method, /270L/);
assert.match(method, /450回/);
assert.match(method, /href="#quantity"/);
assert.ok(quantityGuide.indexOf('id="quantity"') < quantityGuide.indexOf('id="procurement"'), 'calculate requirements before subtracting stock');
assert.ok(quantityGuide.indexOf('id="procurement"') < quantityGuide.indexOf('id="calculation-method"'), 'purchase calculation must precede the long explanation');
for (const kind of ['water','food','toilet','blankets']) {
  assert.match(quantityResultSection, new RegExp(`data-procurement-kind="${kind}"[^>]*href="#procurement-${kind}"`), 'each quantity result must link directly to its purchase calculation');
  assert.match(quantityGuide, new RegExp(`id="procurement-${kind}"[^>]*data-procurement="${kind}"`), 'each purchase link needs the matching stock-input target');
}
const quantityFaq = [...quantityGuide.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(match => JSON.parse(match[1])).find(graph => graph['@type'] === 'FAQPage')?.mainEntity;
assert.equal(quantityFaq.length, 5);
assert.equal(quantityFaq[0].name, '会社の防災備蓄量はどう計算しますか？');
for (const item of quantityFaq) {
  assert.ok(quantityGuide.includes(`<summary>${item.name}</summary>`));
  assert.ok(quantityGuide.includes(`<p>${item.acceptedAnswer.text}</p>`));
}
assert.doesNotMatch(power, /doops:10035046|doops%2Fzzt4260015d41d|doops%2Fi%2F10035046/, 'standalone vehicle charger must not be offered as a power station, including cached-data builds');

const toilet = fs.readFileSync(path.join(root, 'dist', 'pages', 'toilet-office.html'), 'utf8');
const graphs = [...toilet.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
const toiletFaq = graphs.find(graph => graph['@type'] === 'FAQPage')?.mainEntity;
const purchaseQuestions = [
  '会社の簡易トイレは何回分備蓄すればよいですか？',
  '100回分の簡易トイレは、何人・何日分ですか？',
  '凝固剤だけの商品とトイレセットはどう違いますか？',
  '10人・3日分なら100回分の商品を何箱買いますか？',
  '防臭袋も使用回数と同じ枚数が必要ですか？'
];
assert.deepEqual(toiletFaq?.map(item => item.name), purchaseQuestions, 'toilet FAQ must answer purchase decisions instead of generic disaster questions');
for (const item of toiletFaq) {
  assert.ok(toilet.includes(`<summary>${item.name}</summary>`), 'FAQ questions must be visible');
  assert.ok(toilet.includes(`<p>${item.acceptedAnswer.text}</p>`), 'FAQ answers must match their visible text');
}
assert.match(toilet, /100回分入りなら2箱で200回分/);
assert.match(toilet, /不足する袋や凝固剤は別に補充/);
const toiletData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8')).pages.find(item => item.slug === 'toilet-office');
const purchaseCards = [...toilet.matchAll(/<article class="card procurement-card"([^>]*)>([\s\S]*?)<\/article>/g)];
assert.equal(purchaseCards.length, 3);
assert.ok(toilet.indexOf('id="quantity"') < toilet.indexOf('id="purchase-units"'));
assert.ok(toilet.indexOf('id="purchase-units"') < toilet.indexOf('<h2>選び方</h2>'), 'purchase examples must precede long buying explanations');
assert.equal((toilet.match(/id="quantity"/g) || []).length, 1);
assert.equal((toilet.match(/id="purchase-units"/g) || []).length, 1);
assert.match(toilet, /href="#purchase-units">人数別の購入例を見る/);
assert.doesNotMatch(toilet,/下の目安計算で必要量を出す/,'moved calculator must not leave the old direction');
for (const [index, match] of purchaseCards.entries()) {
  const attr = name => match[1].match(new RegExp(`data-${name}="([^"]+)"`))?.[1];
  const need = [150, 450, 750][index];
  const candidate = toiletData.products.find(product => product.itemCode === attr('purchase-product'));
  assert.ok(candidate && productTools.isToiletPurchaseCandidate(candidate));
  const count = Number(attr('purchase-packages'));
  const supplied = Number(attr('supplied-uses'));
  assert.equal(Number(attr('required-uses')), need);
  assert.equal(supplied, productTools.decisionFacts(candidate).toiletUses * count);
  assert.ok(supplied >= need);
  const costs = toiletData.products.filter(productTools.isToiletPurchaseCandidate).map(product =>
    Math.ceil(need / productTools.decisionFacts(product).toiletUses) * Number(product.price));
  assert.equal(Number(attr('purchase-cost')), Math.min(...costs));
  assert.equal(Number(attr('purchase-cost')), Number(candidate.price) * count);
  if (candidate.image) assert.ok(match[2].includes(`src="${candidate.image.replaceAll('&', '&amp;')}"`));
  assert.ok(match[2].includes(`1点あたり${productTools.decisionFacts(candidate).toiletUses}回分`));
  assert.ok(match[2].includes(`1点の掲載価格 ${Number(candidate.price).toLocaleString('ja-JP')}円`));
  if (/受注生産/.test(candidate.titleRaw || candidate.name || '')) assert.match(match[2], /受注生産の表記があります/);
  assert.ok(match[2].includes(`${count}点分の内容を楽天で確認`));
  assert.match(match[2], /送料、購入上限、価格、在庫/);
}

const restaurant = fs.readFileSync(path.join(root, 'dist', 'pages', 'restaurant-dansui.html'), 'utf8');
assert.match(restaurant, /<h1>飲食店の断水対策・給水タンク比較<\/h1>/);
assert.match(restaurant, /<title>給水タンク10L・20Lと断水対策用品比較｜飲食店の備え/);
assert.ok(restaurant.indexOf('id="comparison"') < restaurant.indexOf('id="quantity"'));
assert.equal((restaurant.match(/id="comparison"/g) || []).length, 1);
assert.match(restaurant, /給水タンクは10Lと20L、どちらを選ぶ/);
assert.match(restaurant, /1個あたりの容量/);
assert.match(restaurant, /飲用可否/);
assert.match(restaurant, /営業できるとは限りません/);
const restaurantData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8')).pages.find(item => item.slug === 'restaurant-dansui');
const waterOffers = restaurant.match(/<section[^>]*id="products"[^>]*data-water-products[\s\S]*?<\/section>/)?.[0] || '';
assert.ok(waterOffers, 'water products need readable capacity, price and purchase actions before the wide table');
assert.ok(restaurant.indexOf('id="products"') < restaurant.indexOf('data-water-comparison'));
assert.equal((restaurant.match(/id="products"/g) || []).length, 1);
const expectedOffers = waterContainerTools.restaurantGroups(restaurantData.products).flatMap(group => group.products).slice(0,6);
const offerCards = [...waterOffers.matchAll(/<article class="card product"[^>]*data-product-key="([^"]+)"[\s\S]*?<\/article>/g)];
assert.deepEqual(offerCards.map(card=>card[1]), expectedOffers.map(product=>product.itemCode));
for (const [index, card] of offerCards.entries()) {
  const product=expectedOffers[index];
  const facts=waterContainerTools.containerFacts(product);
  assert.ok(card[0].includes(`data-product-id="${product.itemCode}"`));
  assert.ok(card[0].includes(`href="${product.url.replaceAll('&','&amp;')}"`));
  assert.ok(card[0].includes(`1個あたり: <strong>${facts.liters ? facts.liters+'L' : '容量を選択・確認'}</strong>`));
  assert.ok(card[0].includes(`販売個数: <strong>${facts.containers ? facts.containers+'個' : '販売ページで確認'}</strong>`));
  assert.ok(card[0].includes(`販売単位の合計: ${facts.totalLiters ? facts.totalLiters+'L' : '要確認'}`));
}
const restaurantRows = [...restaurant.matchAll(/<tr [^>]*data-restaurant-purpose[\s\S]*?<\/tr>/g)].map(match => match[0]);
assert.equal(restaurantRows.length, restaurantData.products.length);
for (const group of waterContainerTools.restaurantGroups(restaurantData.products)) {
  assert.ok(restaurant.includes(`href="#restaurant-purpose-${group.key}"`));
  assert.equal((restaurant.match(new RegExp(`id="restaurant-purpose-${group.key}"`, 'g')) || []).length, 1);
  for (const product of group.products) {
    const row = restaurantRows.find(row => row.includes(`data-product-key="${product.itemCode}"`));
    assert.ok(row.includes(`data-restaurant-purpose="${group.key}"`));
    const firstCell = row.match(/<td class="table-product">[\s\S]*?<\/td>/)?.[0] || '';
    assert.ok(firstCell.includes(`data-product-id="${product.itemCode}"`) && firstCell.includes('data-product-price='));
    if (product.image) assert.ok(firstCell.includes(`src="${product.image.replaceAll('&', '&amp;')}"`));
    if (group.key === 'flood') assert.ok(row.includes('飲用の給水容器とは分ける'));
  }
}
const restaurantFaq = [...restaurant.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1])).find(graph=>graph['@type']==='FAQPage');
assert.equal(restaurantFaq.mainEntity.length,5);
for(const item of restaurantFaq.mainEntity) {
  assert.ok(restaurant.includes(`<summary>${item.name}</summary>`));
  assert.ok(restaurant.includes(`<p>${item.acceptedAnswer.text}</p>`));
}
const waterTopic = fs.readFileSync(path.join(root, 'dist', 'topics', 'water-outage.html'), 'utf8');
assert.match(waterTopic, /pages\/restaurant-dansui\.html#comparison">給水タンクを比較する/);
const waterChecks=waterTopic.match(/<section[^>]*id="water-outage-checks"[\s\S]*?<\/section>/)?.[0] || '';
assert.ok(waterChecks,'water outage entry needs purpose-specific purchase checks, not only the shared calculator');
assert.ok(waterTopic.indexOf('id="water-outage-checks"')<waterTopic.indexOf('id="quantity"'));
for(const phrase of ['飲用・簡単な調理','手洗い・清掃','使えないトイレ','給水所からの運搬','厨房の洗浄や清掃用水']) assert.ok(waterChecks.includes(phrase));
for(const target of ['water-food-stock','restaurant-dansui','toilet-office']) assert.ok(waterChecks.includes(`pages/${target}.html`));
const waterFaq=[...waterTopic.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(g=>g['@type']==='FAQPage');
assert.equal(waterFaq.mainEntity.length,5,'keep the four water-specific FAQs and the existing shared quantity question');
for(const question of ['会社の断水対策は、1人1日3Lの水で足りますか？','給水タンクがあれば保存水は不要ですか？','給水タンクは10Lと20L、どちらを選びますか？','断水時は衛生用品を買えば飲食店の営業を続けられますか？']) assert.ok(waterFaq.mainEntity.some(item=>item.name===question));
for(const item of waterFaq.mainEntity){assert.ok(waterTopic.includes(`<summary>${item.name}</summary>`));assert.ok(waterTopic.includes(`<p>${item.acceptedAnswer.text}</p>`));}
const foodEntry=fs.readFileSync(path.join(root,'dist/pages/emergency-food-office.html'),'utf8');
assert.ok(foodEntry.indexOf('id="quantity"')<foodEntry.indexOf('id="comparison"'));
assert.ok(foodEntry.indexOf('id="comparison"')<foodEntry.indexOf('id="purchase-checks"'),'food comparison must precede long purchase guidance');
for(const id of ['quantity','comparison','quick-picks-title']) assert.equal((foodEntry.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
assert.doesNotMatch(foodEntry,/下の目安計算で必要量を出す/);
const foodRows=[...foodEntry.matchAll(/<tr [^>]*data-product-key="([^"]+)"[\s\S]*?<\/tr>/g)];
assert.ok(foodRows.length>0);
for(const row of foodRows){
 const first=row[0].match(/<td class="table-product">[\s\S]*?<\/td>/)?.[0]||'';
 assert.match(first,/<img /,'food comparison must show actual product photos in the first mobile-visible cell');
 assert.ok(first.includes(`data-product-id="${row[1]}"`));
 assert.match(first,/食数・価格を楽天で確認/);
 assert.equal((row[0].match(/data-product-id=/g)||[]).length,1,'one purchase action per comparison row');
}
const waterFoodEntry=fs.readFileSync(path.join(root,'dist/pages/water-food-stock.html'),'utf8');
const waterFoodData=JSON.parse(fs.readFileSync(path.join(root,'data/products.json'),'utf8')).pages.find(item=>item.slug==='water-food-stock');
const waterFoodRows=[...waterFoodEntry.matchAll(/<tr [^>]*data-product-key="([^"]+)"[\s\S]*?<\/tr>/g)];
assert.ok(waterFoodRows.length>0);
for(const row of waterFoodRows){
 const first=row[0].match(/<td class="table-product">[\s\S]*?<\/td>/)?.[0]||'';
 assert.match(first,/<img /,'water and food comparison must show real product photos before horizontal scrolling');
 assert.ok(first.includes(`data-product-id="${row[1]}"`),'water and food purchase action must be in the first column');
 assert.match(first.replace(/<[^>]*>/g,''),/内容量・価格を楽天で確認/);
 assert.equal((row[0].match(/data-product-id=/g)||[]).length,1,'one purchase action per water and food comparison row');
 const product=waterFoodData.products.find(item=>item.itemCode===row[1]);
 if(productTools.decisionFacts(product).productType==='water'){
  assert.match(row[0],/販売個数・到着時の保存期限・保管条件を確認/,'water needs water-specific purchase checks');
  assert.doesNotMatch(row[0],/アレルギー/);
 }
}

const nursery = fs.readFileSync(path.join(root, 'dist', 'pages', 'hoikuen-bousai.html'), 'utf8');
for(const slug of ['water-food-stock','emergency-food-office']){
 const html=fs.readFileSync(path.join(root,'dist/pages',slug+'.html'),'utf8');
 const pages=JSON.parse(fs.readFileSync(path.join(root,'data/products.json'),'utf8')).pages;
 const products=[...pages.find(item=>item.slug===slug).products,...pages.flatMap(item=>item.products)];
 const rows=[...html.matchAll(/<tr [^>]*data-product-key="([^"]+)"[\s\S]*?<\/tr>/g)];
 for(const row of rows){
  const product=products.find(item=>item.itemCode===row[1]);
  assert.ok(product,'comparison rows must have a source product, including related candidates');
  const label=row[0].match(/<strong data-fit-result>([^<]*)<\/strong>/)?.[1];
  assert.ok(label,'water and food rows need a visible comparison caveat');
  if(!comparisonTools.comparisonUnit(product).quantity){
   assert.equal(label,'販売単位・単価を販売ページで要確認','unknown sale units must not be presented as clear candidates');
  }else{
   assert.notEqual(label,'販売単位・単価を販売ページで要確認','confirmed sale units must keep their existing fit label');
  }
 }
}
assert.match(nursery, /<h1>保育園の防災備蓄リストと非常食比較<\/h1>/);
assert.match(nursery, /<title>保育園の防災備蓄リストと非常食比較/);
assert.match(nursery, /<meta name="description" content="保育園の防災備蓄リストを/);
const nurseryStockList = nursery.match(/<section[^>]*id="nursery-stock-list"[\s\S]*?<\/section>/)?.[0] || '';
assert.equal((nurseryStockList.match(/class="nursery-stock-row"/g) || []).length, 6);
assert.ok(nursery.indexOf('id="nursery-stock-list"') < nursery.indexOf('id="comparison"'), 'list-intent visitors need item categories before product comparisons');
for (const phrase of ['園児の食料・ミルク', '飲用・調理用の水', 'おむつ・トイレ用品', '食器・衛生用品', '灯り・防寒・持出し用品', '職員用の水・食料', '園児1人の1食分とは限りません']) {
  assert.ok(nurseryStockList.includes(phrase), `nursery stock list missing: ${phrase}`);
}
assert.match(nurseryStockList, /pref\.osaka\.lg\.jp\/documents\/22910\/guid\.pdf/);
assert.match(nursery, /href="#nursery-stock-list">備蓄リストを確認する<\/a>/);
assert.ok(nursery.indexOf('id="comparison"') < nursery.indexOf('id="quantity"'), 'buyers must reach actual food comparisons before the two long calculators');
assert.equal((nursery.match(/id="comparison"/g) || []).length, 1);
assert.match(nursery, /href="#comparison">非常食の候補を比較する<\/a>/);
assert.match(home, /保育園の非常食/);
assert.doesNotMatch(home, />保育園・介護施設(?:の備蓄)?</, 'nursery entry must not promise care-facility comparisons');
assert.match(nursery, /id="nursery-children"/);
assert.match(nursery, /id="nursery-servings"/);
assert.match(nursery, /id="nursery-meal-total"/);
assert.match(nursery, /id="nursery-meal-comparison" href="#comparison"/);
assert.match(nursery, /1袋が園児1人の1食分とは限りません/);
assert.match(nursery, /data-nursery-meal-script/);
assert.match(nursery, /id="planSummary"/);
assert.match(nursery, /職員・成人の備蓄目安/);
assert.match(nursery, /https:\/\/www\.bousai\.go\.jp\/jishin\/kitakukonnan\/pdf\/kitakukonnan_guideline\.pdf/);
assert.match(nursery, /園児の食数や飲水量の基準ではありません/);
assert.match(nursery, /食料（年齢・原材料を確認）/);
assert.match(nursery, /持出しセット（内容・重さを確認）/);
assert.match(nursery, /園児用と職員用で内容・重さ・配布人数を確認/);
assert.match(nursery, /園児の食数は年齢・食べ方別に確認/);
assert.match(nursery, /対象年齢・原材料・食べ方・調理用の水を確認/);
assert.match(nursery, /https:\/\/www\.caa\.go\.jp\/policies\/policy\/consumer_safety\/caution\/caution_015\//);
assert.doesNotMatch(nursery, /<span>向いている施設<\/span>/, 'unverified nursery suitability must not be asserted');
const nurseryData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8')).pages.find(item => item.slug === 'hoikuen-bousai');
const candies = nurseryData.products.filter(product => product.productType === 'food' && /キャンディ|キャンデー|飴|あめ|ドロップ/.test(product.titleRaw || product.name || '') && !/米|パン|ご飯|粥|麺|主食|ミルク/.test(product.titleRaw || product.name || ''));
const nurseryQuickPicks = nursery.match(/<section class="section quick-picks"[\s\S]*?<\/section>/)?.[0] || '';
for (const product of candies) {
  assert.ok(!nurseryQuickPicks.includes(`data-product-key="${product.itemCode}"`), 'standalone candy must not be a first food candidate');
  const row = [...nursery.matchAll(/<tr data-product-fit[\s\S]*?<\/tr>/g)].map(match => match[0]).find(html => html.includes(`data-product-key="${product.itemCode}"`));
  assert.ok(row, 'supplementary candy remains in the full comparison, while detail cards retain their six-item limit');
  assert.match(row, /補助食品（食事用とは別）/);
  assert.match(row, /のどに詰まるおそれ/);
}

const nurseryMeals = nurseryData.products.filter(product => product.productType === 'food' && !candies.includes(product));
const nurseryWater = nurseryData.products.filter(product => product.productType === 'water');
const nurserySupplies = nurseryData.products.filter(product => !['food', 'water'].includes(product.productType));
const nurseryPurposes = { food: nurseryMeals, water: nurseryWater, supplies: nurserySupplies, supplement: candies };
const nurseryLinks = nursery.match(/<nav class="chip-row" aria-label="備蓄品の用途"[\s\S]*?<\/nav>/)?.[0] || '';
for (const [purpose, products] of Object.entries(nurseryPurposes)) {
  if (!products.length) {
    assert.ok(!nurseryLinks.includes(`href="#nursery-purpose-${purpose}"`), 'empty purpose must not have a link');
    continue;
  }
  assert.match(nurseryLinks, new RegExp(`href="#nursery-purpose-${purpose}"[^>]*>[^<]*${products.length}件`));
  assert.ok(nursery.includes(`id="nursery-purpose-${purpose}"`), 'purpose must have a comparison target');
}
const nurseryRows = [...nursery.matchAll(/<tr [^>]*data-product-fit[\s\S]*?<\/tr>/g)].map(match => match[0]);
const nurseryCards = nursery.match(/<section class="section" id="products">[\s\S]*?<\/section>/)?.[0] || '';
const nurseryDetailIds = nurseryRows.slice(0,6).map(row=>row.match(/data-product-key="([^"]+)"/)[1]);
const nurseryCardIds = [...nurseryCards.matchAll(/<article class="card product"[^>]*data-product-key="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(nurseryCardIds,nurseryDetailIds,'detail cards must match the first six displayed comparison rows, including their order');
for (const product of nurseryMeals.filter(product=>nurseryDetailIds.includes(product.itemCode))) {
  assert.ok(nurseryCards.includes(`data-product-key="${product.itemCode}"`), 'first food candidates need detailed cards, not only a table row');
  const kind = nurseryComparison.nurseryFoodKind(product);
  const card = [...nurseryCards.matchAll(/<article class="card product"[^>]*>[\s\S]*?<\/article>/g)]
    .map(match => match[0]).find(html => html.includes(`data-product-key="${product.itemCode}"`));
  if (kind) assert.ok(card.includes(`食品の種類（商品名表記）: ${kind}`), 'food cards must retain explicit food kinds');
}
assert.ok(nurseryRows.slice(0, nurseryMeals.length).every(row => row.includes('data-nursery-purpose="food"')), 'food must precede unrelated supplies');
assert.match(nursery, /href="#quantity">園児の食数を数える<\/a>/);
assert.match(nursery, /https:\/\/www\.pref\.osaka\.lg\.jp\/documents\/22910\/guid\.pdf/);

const { nurseryGroups, nurseryPurpose, nurseryPreparation } = nurseryComparison;
for (const [titleRaw, summary, expected] of [
  ['非常食', '水や加熱が必要なく、そのまま食べられる食品', '水・加熱不要の表記'],
  ['調理不要 水不要 非常食セット', '', '調理不要の表記'],
  ['非常食', 'お湯か水を入れるだけで食べられる', '水またはお湯が必要の表記'],
  ['非常食 水不要', '', '水不要の表記（加熱の要否は確認）'],
  ['非常食 米粉パン 7年保存', '', '調理方法は販売ページで確認'],
  ['レトルト おかゆ 20個', '簡単調理', '調理方法は販売ページで確認'],
  ['調理不要ではない 非常食', '', '調理方法は販売ページで確認'],
  ['非常食 水不要ではありません', '', '調理方法は販売ページで確認'],
  ['調理不要ではございません', '', '調理方法は販売ページで確認'],
  ['非常食 水不要 要調理', '', '調理方法は販売ページで確認'],
  ['そのまま食べられるとは限らない食品', '', '調理方法は販売ページで確認'],
  ['調理不要セット', 'お湯か水を入れる食品を含む', '調理方法は販売ページで確認'],
  ['調理不要セット 一部要加熱', '', '調理方法は販売ページで確認'],
  ['食品', '水や加熱が必要なく食べられる商品もあります', '調理方法は販売ページで確認'],
  ['', '', '調理方法は販売ページで確認']
]) {
  assert.equal(nurseryPreparation({ productType: 'food', titleRaw, summary }), expected, titleRaw || summary);
}
assert.equal(nurseryPreparation({ productType: 'water', titleRaw: '水不要' }), '');
for (const product of nurseryMeals) {
  const row = nurseryRows.find(row => row.includes(`data-product-key="${product.itemCode}"`));
  assert.ok(row.includes(nurseryPreparation(product)), 'food preparation must be visible beside each actual product');
  const purchaseCell = row.match(/<td class="table-product">[\s\S]*?<\/td>/)?.[0] || '';
  const kind = nurseryComparison.nurseryFoodKind(product);
  if (kind) assert.ok(purchaseCell.includes(`食品の種類（商品名表記）: ${kind}`), 'food kind must accompany the title and purchase link');
  else assert.ok(!purchaseCell.includes('data-nursery-food-kind'), 'unknown food kinds must not become invented descriptions');
  assert.ok(purchaseCell.includes(`data-product-id="${product.itemCode}"`) && purchaseCell.includes('data-product-price=') && purchaseCell.includes('楽天で確認'), 'price, product and purchase link must share the first mobile-visible cell');
  if (product.image) assert.ok(row.includes(`src="${product.image.replaceAll('&', '&amp;')}"`), 'food comparison must show actual product images');
}
const purposeFixture = [
  { itemCode: 'fixture:bag', productType: 'disaster-set', titleRaw: '防災セット' },
  { itemCode: 'fixture:candy', productType: 'food', titleRaw: '保存用キャンディ' },
  { itemCode: 'fixture:water', productType: 'water', titleRaw: '保存水' },
  { itemCode: 'fixture:meal', productType: 'food', titleRaw: '非常食 アルファ米' }
];
const originalPurposeOrder = purposeFixture.map(product => product.itemCode);
assert.deepEqual(nurseryGroups([]), []);
assert.equal(nurseryPurpose({ productType: 'unknown', titleRaw: '用途不明' }), 'supplies');
assert.deepEqual(nurseryGroups(purposeFixture).map(group => group.key), ['food', 'water', 'supplies', 'supplement']);
assert.deepEqual(nurseryGroups(purposeFixture).flatMap(group => group.products).map(product => product.itemCode), ['fixture:meal', 'fixture:water', 'fixture:bag', 'fixture:candy']);
assert.deepEqual(purposeFixture.map(product => product.itemCode), originalPurposeOrder, 'ordering must not mutate API data');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bcp-nursery-purpose-'));
try {
  fs.cpSync(path.join(root, 'scripts'), path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'data'));
  for (const name of ['keywords.csv', 'paid-product.json', 'indexnow.json']) {
    fs.copyFileSync(path.join(root, 'data', name), path.join(fixtureRoot, 'data', name));
  }
  const input = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf8'));
  const sample = { ...nurseryMeals[0], productType: 'food', titleRaw: '非常食 アルファ米 5年保存 9食', name: '非常食 アルファ米 5年保存 9食' };
  for (const count of [0, 1, 9]) {
    const products = Array.from({ length: count }, (_, index) => ({ ...sample, itemCode: `fixture:meal-${index}`, url: `https://example.invalid/meal-${index}`, titleShort: `非常食セット${index===1?0:index}` }));
    const fixtureData = { ...input, pages: input.pages.map(page => ({ ...page, products: page.slug === 'hoikuen-bousai' ? products : [] })) };
    fs.writeFileSync(path.join(fixtureRoot, 'data', 'products.json'), JSON.stringify(fixtureData));
    execFileSync(process.execPath, [path.join(fixtureRoot, 'scripts', 'generate-site.js')], { stdio: 'pipe' });
    const emptyQuantity = fs.readFileSync(path.join(fixtureRoot,'dist','pages','office-stockpile-quantity.html'),'utf8');
    assert.ok(!emptyQuantity.includes('id="waterCandidate"')&&!emptyQuantity.includes('id="toiletCandidate"'),'empty water/toilet pools must not create dead selectors');
    if(count===0) assert.ok(!/<select[^>]*data-procurement-select/.test(emptyQuantity),'empty safe pools must retain manual inputs, not dead selectors');
    assert.ok(emptyQuantity.includes('id="waterPack"')&&emptyQuantity.includes('id="waterPrice"'));
    const html = fs.readFileSync(path.join(fixtureRoot, 'dist', 'pages', 'hoikuen-bousai.html'), 'utf8');
    const links = html.match(/<nav class="chip-row" aria-label="備蓄品の用途"[\s\S]*?<\/nav>/)?.[0] || '';
    const table = html.match(/<section class="section" id="comparison">[\s\S]*?<\/section>/)?.[0] || '';
    const cards = html.match(/<section class="section" id="products">[\s\S]*?<\/section>/)?.[0] || '';
    const stockList = html.match(/<section[^>]*id="nursery-stock-list"[\s\S]*?<\/section>/)?.[0] || '';
    for (const [,target] of stockList.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(html.includes(`id="${target}"`), `nursery stock list has dead anchor: ${target}`);
    }
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.equal((table.match(/data-nursery-purpose="food"/g) || []).length, count);
    assert.equal((cards.match(/data-nursery-purpose="food"/g) || []).length, Math.min(count, 6));
    const tableIds=[...table.matchAll(/<tr [^>]*data-product-key="([^"]+)"/g)].map(match=>match[1]);
    const cardIds=[...cards.matchAll(/<article class="card product"[^>]*data-product-key="([^"]+)"/g)].map(match=>match[1]);
    assert.deepEqual([...tableIds].sort(),products.map(product=>product.itemCode).sort(),'every source candidate must remain in the comparison');
    assert.deepEqual(cardIds,tableIds.slice(0,6),'cards must follow displayed comparison order');
    if(count===9){
      assert.deepEqual(cardIds,['fixture:meal-0','fixture:meal-2','fixture:meal-3','fixture:meal-4','fixture:meal-5','fixture:meal-6']);
      assert.notDeepEqual(cardIds,products.slice(0,6).map(product=>product.itemCode),'fixture must reproduce a raw-order difference');
    }
    if (!count) {
      assert.equal(links, '', 'zero candidates must not produce dead purpose links');
    } else {
      assert.match(links, new RegExp(`非常食・保存食（${count}件）`));
      assert.equal((html.match(/id="nursery-purpose-food"/g) || []).length, 1);
      assert.doesNotMatch(links, /nursery-purpose-(?:water|supplies|supplement)/);
    }
  }
} finally {
  const relative = path.relative(os.tmpdir(), fixtureRoot);
  assert.ok(relative.startsWith('bcp-nursery-purpose-') && !relative.includes(path.sep));
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('acquisition page verified');
