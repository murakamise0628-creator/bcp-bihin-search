import assert from 'node:assert/strict';
import test from 'node:test';
import productTools from './fetch-products.js';

const {
  candidateTier,
  compareRankedProducts,
  createProductDataset,
  detectProductType,
  decisionFacts,
  decisionSummary,
  isEmergencyFoodSetCandidate,
  isExcluded,
  sanitizeProductDataset,
  titleShort,
  productDisplayTitle,
  toiletUseCount
} = productTools;

test('detectProductType distinguishes a helmet multipack from a disaster set containing a helmet', () => {
  const helmetMultipack = '【2個セット】防災ヘルメット 保護帽 安全帽 防災用品 防災セット';
  assert.equal(
    detectProductType(helmetMultipack),
    'safety'
  );
  assert.equal(titleShort(helmetMultipack), '2個 防災ヘルメット');
  assert.equal(
    detectProductType('【ヘルメット付き】防災セット 1人用 保存水 非常食'),
    'disaster-set'
  );
});

test('toiletUseCount reads fixed business packs and avoids variant prices', () => {
  assert.equal(toiletUseCount('サニタクリーン 簡単トイレ 組織用セット 200回分'), 200);
  assert.equal(toiletUseCount('携帯トイレ 120個セット 男女兼用'), 120);
  assert.equal(toiletUseCount('携帯トイレ 2P 120個セット 男女兼用'), null);
  assert.equal(toiletUseCount('汚物処理袋 業務用 240枚組 サニタクリーン'), 240);
  assert.equal(toiletUseCount('簡易トイレ 20回／50回／100回から選べる'), null);
});

test('decisionFacts distinguishes complete toilet kits from replenishment items', () => {
  const full = decisionFacts({
    titleRaw: 'BOS 非常用トイレセット 50回分 凝固剤 汚物袋 防臭袋'
  });
  const coagulant = decisionFacts({
    titleRaw: 'トイレ凝固剤 100回分 10年保存 個包装'
  });
  const bags = decisionFacts({
    titleRaw: '汚物処理袋 サニタクリーンワンズケア 業務用 240枚組 非常用トイレ'
  });

  assert.equal(full.toiletUses, 50);
  assert.equal(full.toiletSupplyType, 'complete-kit');
  assert.equal(coagulant.toiletSupplyType, 'coagulant-only');
  assert.equal(bags.toiletSupplyType, 'bag-only');
});

test('candidateTier prioritizes readable business quantities', () => {
  assert.equal(candidateTier({
    titleRaw: 'BOS 非常用トイレセット 50回分 凝固剤 汚物袋 防臭袋'
  }, { slug: 'toilet-office' }), 'preferred');

  assert.equal(candidateTier({
    titleRaw: '非常用トイレ 1回分'
  }, { slug: 'toilet-office' }), 'demoted');

  assert.equal(candidateTier({
    titleRaw: 'トイレ凝固剤 100回分 10年保存'
  }, { slug: 'toilet-office' }), 'supplementary');

  assert.equal(candidateTier({
    titleRaw: '防災セット 二人用 家族用'
  }, { slug: 'office-bichiku' }), 'demoted');

  assert.equal(candidateTier({
    titleRaw: '防災セット 1人用 法人・企業向け'
  }, { slug: 'office-bichiku' }), 'supplementary');

  assert.equal(candidateTier({
    titleRaw: '法人向け 防災備蓄セット 10人用 3日分 保存水 非常食 簡易トイレ'
  }, { slug: 'office-bichiku' }), 'preferred');
});

test('decisionFacts extracts office set and portable power decision data', () => {
  const office = decisionFacts({
    titleRaw: '法人向け 防災備蓄セット 10人用 3日分 保存水 非常食 簡易トイレ'
  });
  const power = decisionFacts({
    titleRaw: 'EcoFlow ポータブル電源 1024Wh 定格1500W リン酸鉄'
  });

  assert.equal(office.peopleCapacity, 10);
  assert.equal(office.stockDays, 3);
  assert.deepEqual(office.includedCategories, ['water', 'food', 'toilet']);
  assert.equal(power.powerWh, 1024);
  assert.equal(power.outputW, 1500);

  const panelBundle = decisionFacts({
    titleRaw: 'Jackery 1070Wh ポータブル電源 ソーラーパネルセット パネル定格出力100W'
  });
  assert.equal(panelBundle.powerWh, 1070);
  assert.equal(panelBundle.outputW, null);
});

test('decisionSummary states purchase checks instead of promotional copy', () => {
  const summary = decisionSummary({
    titleRaw: 'ランキング1位 送料無料 BOS 非常用トイレセット 50回分 凝固剤 汚物袋 防臭袋'
  }, { slug: 'toilet-office' });

  assert.match(summary, /50回分/);
  assert.match(summary, /凝固剤/);
  assert.doesNotMatch(summary, /ランキング|送料無料/);
});

test('BOS toilet sets stay classified as complete toilet kits in public copy', () => {
  const titleRaw = '50回分 防災グッズ BOS非常用 トイレセット Bセット 凝固剤付き 汚物袋 おむつが臭わない袋 断水 非常時 備蓄 施設 病院 法人';

  assert.equal(titleShort(titleRaw), 'BOS 50回分 非常用トイレ');
  assert.match(decisionSummary({ titleRaw }, { slug: 'toilet-office' }), /凝固剤・処理袋・防臭袋の同梱表記/);
});

test('known complete toilet sets do not become replenishment-only products when titles omit one component', () => {
  const bosBundle = 'クリロン化成 BOS 非常用トイレセット 15回分 × 3箱 まとめ買い';
  const safetyBcp = 'SAFETYTOILET BCP 500 簡易トイレ 500回分 日本製 抗菌凝固剤 15年保存 大型消臭袋 便座カバー 法人向け大容量セット';

  assert.equal(decisionFacts({ titleRaw: bosBundle }).toiletSupplyType, 'complete-kit');
  assert.equal(titleShort(bosBundle), 'BOS 45回分 非常用トイレ');
  assert.match(decisionSummary({ titleRaw: bosBundle }, { slug: 'toilet-office' }), /凝固剤・処理袋・防臭袋の同梱表記/);

  assert.equal(decisionFacts({ titleRaw: safetyBcp }).toiletSupplyType, 'complete-kit');
  assert.equal(titleShort(safetyBcp), '500回分 15年保存 非常用トイレ');
  assert.match(decisionSummary({ titleRaw: safetyBcp }, { slug: 'toilet-office' }), /凝固剤・処理袋・防臭袋の同梱表記/);
});

test('public product data strips internal affiliate value fields', () => {
  const sanitized = sanitizeProductDataset({
    schemaVersion: 2,
    pages: [{
      slug: 'office-bichiku',
      products: [{
        itemCode: 'shop:item',
        affiliateRate: 4,
        affiliate_rate: 4,
        estimatedCommission: 120,
        estimated_commission_before_caps: 120
      }]
    }]
  });

  assert.deepEqual(sanitized.pages[0].products[0], { itemCode: 'shop:item' });
});

test('internal affiliate values do not create a false dataset change', () => {
  const previous = {
    schemaVersion: 2,
    generatedAt: '2026-08-10T00:00:00.000Z',
    pages: [{ slug: 'office-bichiku', products: [{ itemCode: 'shop:item', fetchedAt: 'old' }] }]
  };
  const results = [{
    slug: 'office-bichiku',
    products: [{ itemCode: 'shop:item', fetchedAt: 'new', affiliateRate: 8 }]
  }];

  const next = createProductDataset(previous, results, new Date('2026-08-10T12:00:00.000Z'));

  assert.equal(next.generatedAt, previous.generatedAt);
  assert.deepEqual(next.pages, previous.pages);
});

test('affiliate rate only breaks close product-quality calls', () => {
  const strongFit = { relevance: 90, score: 80, affiliateRate: 2 };
  const weakFitHighRate = { relevance: 20, score: 80, affiliateRate: 20 };
  const closeLowRate = { relevance: 90, score: 80, affiliateRate: 2 };
  const closeHighRate = { relevance: 88, score: 80, affiliateRate: 8 };

  assert.deepEqual(
    [weakFitHighRate, strongFit].sort(compareRankedProducts),
    [strongFit, weakFitHighRate],
    'a high commission must not outrank a materially better product fit'
  );
  assert.deepEqual(
    [closeLowRate, closeHighRate].sort(compareRankedProducts),
    [closeHighRate, closeLowRate],
    'commission may break a close quality call'
  );
});


test('generic product labels retain quantities or model names', () => {
  assert.equal(
    productDisplayTitle('\u975e\u5e38\u7528\u30c8\u30a4\u30ec\u30bb\u30c3\u30c8 4\u4eba\u00d73\u65e5\u5206 A4\u30b5\u30a4\u30ba', ''),
    '4\u4eba\u00d73\u65e5\u5206 \u975e\u5e38\u7528\u30c8\u30a4\u30ec'
  );
  assert.match(
    productDisplayTitle('\u30b5\u30f3\u30a8\u30a4 \u9632\u707d\u30de\u30eb\u30c1\u30e9\u30a4\u30c8 A\u30bf\u30a4\u30d7 BMR-1', ''),
    /BMR-1|\u30b5\u30f3\u30a8\u30a4/
  );
});

test('ranking copy removal does not erase the product type', () => {
  const raw = '\u3010\u697d\u5929\u30e9\u30f3\u30ad\u30f3\u30b01\u4f4d\u3011\u9632\u707d\u30bb\u30c3\u30c8 2\u4eba\u7528 68\u70b9 \u30c8\u30a4\u30ec \u6c34 \u98df\u54c1 \u61d0\u4e2d\u96fb\u706f \u30e9\u30f3\u30bf\u30f3';
  assert.equal(titleShort(raw), '2\u4eba\u7528 \u9632\u707d\u30bb\u30c3\u30c8');
  assert.equal(productDisplayTitle(raw, '3\u4eba\u7528\u3082\u9078\u3079\u308b\u30e9\u30a4\u30c8\u4ed8\u304d'), '2\u4eba\u7528 \u9632\u707d\u30bb\u30c3\u30c8');
});
test('toy lights and incomplete bags are excluded from disaster comparisons', () => {
  assert.equal(isExcluded({ titleRaw: '\u5149\u308b\u304a\u3082\u3061\u3083 \u30af\u30ea\u30b9\u30bf\u30eb\u30e9\u30a4\u30c8 \u4fdd\u80b2\u5712 \u666f\u54c1' }), true);
  assert.equal(isExcluded({ titleRaw: '\u9632\u707d\u30ea\u30e5\u30c3\u30af \u5358\u54c1 \u4e2d\u8eab\u306a\u3057' }), true);
  assert.equal(isExcluded({ titleRaw: '\u30b5\u30f3\u30a8\u30a4 \u9632\u707d\u30de\u30eb\u30c1\u30e9\u30a4\u30c8 BMR-1' }), false);
});
test('generic emergency-food names inherit decision quantities from the summary', () => {
  const raw = '\u30ec\u30b9\u30ad\u30e5\u30fc\u30d5\u30fc\u30ba \u975e\u5e38\u98df \u4fdd\u5b58\u98df';
  const summary = '3\u98df\u3092\u30b3\u30f3\u30d1\u30af\u30c8\u306b\u307e\u3068\u3081\u305f\u30bb\u30c3\u30c8';
  assert.equal(productDisplayTitle(raw, summary), '3\u98df \u975e\u5e38\u98df');
  assert.equal(productDisplayTitle(raw, ''), '\u30ec\u30b9\u30ad\u30e5\u30fc\u30d5\u30fc\u30ba \u975e\u5e38\u98df');
  assert.equal(isEmergencyFoodSetCandidate({
    productType: 'food',
    titleRaw: '\u975e\u5e38\u98df\u30bb\u30c3\u30c8 \u8a70\u3081\u5408\u308f\u305b',
    summary: ''
  }), false);
});
test('emergency food set filtering rejects drinks and keeps distinguishable set titles', () => {
  assert.equal(isEmergencyFoodSetCandidate({
    productType: 'food',
    titleRaw: '非常食 カゴメ 野菜ジュース 190g×1本 保存食セット',
    summary: '1缶に野菜1日分'
  }), false);
  assert.equal(isEmergencyFoodSetCandidate({
    productType: 'food',
    titleRaw: '非常食 保存食セット 1人 3日分 11種'
  }), true);
  const standard = titleShort('非常食 保存食セット 1人 3日分 11種 長期保存 アレルギー配慮');
  const noCook = titleShort('非常食 保存食セット 1人 3日分 11種類 16点 5年保存 調理不要 水不要');
  assert.notEqual(standard, noCook);
  assert.match(standard, /11種/);
  assert.match(noCook, /16点/);
});
