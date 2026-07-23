import assert from 'node:assert/strict';
import test from 'node:test';
import productTools from './fetch-products.js';

const {
  candidateTier,
  decisionFacts,
  decisionSummary,
  toiletUseCount
} = productTools;

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
