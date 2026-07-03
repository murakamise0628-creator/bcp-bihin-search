const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://jigyousho-bousai.com').replace(/\/$/, '');
const dataPath = path.join(root, 'data', 'products.json');

const data = fs.existsSync(dataPath)
  ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  : { generatedAt: new Date().toISOString(), pages: [] };

const pageNotes = {
  'portable-power-kaigo': {
    audience: '介護施設・小規模福祉施設',
    disasters: ['停電', '台風', '地震'],
    conclusion: '介護施設の停電対策は、照明・通信・見守り機器を短時間でも動かせる電源を先に確認します。',
    mustHave: ['ポータブル電源', '充電ケーブル', 'LEDライト', '延長コード'],
    problem: '停電時にスマホ、照明、通信機器、見守り機器の電源を最低限確保したい施設向けです。',
    checks: ['容量はWh表記で見る', '出力W数が使う機器に足りるか確認', '保管場所で持ち運べる重量か見る', '長期保管時の充電管理がしやすいものを選ぶ'],
    avoid: '医療機器や生命維持に関わる機器への利用可否は、必ずメーカーや専門業者に確認してください。',
    related: ['office-bichiku', 'hoikuen-bousai', 'kitaku-konnansha'],
    faq: [
      ['何Whあれば安心ですか？', '使う機器の消費電力と使いたい時間で変わります。まずはスマホ、照明、通信機器など、止めたくないものをリスト化するのが現実的です。'],
      ['介護施設では何を優先しますか？', '照明、連絡手段、見守り機器、冷暖房補助を優先し、電源以外に水・トイレ・防寒も合わせて確認します。']
    ]
  },
  'office-bichiku': {
    audience: '小規模オフィス・士業事務所・店舗事務所',
    disasters: ['地震', '台風', '帰宅困難者'],
    conclusion: '小規模オフィスは、防災セット一式よりも水・食料・簡易トイレ・ライトを人数分で確認するのが先です。',
    mustHave: ['保存水', '非常食', '簡易トイレ', 'ライト', '衛生用品'],
    problem: '従業員が数時間から一晩待機する前提で、水、食料、ライト、トイレをまとめて確認したい事業所向けです。',
    checks: ['人数と待機時間から数量を決める', '水とトイレを食料より先に見る', '保管棚に収まるサイズか確認', '賞味期限の管理がしやすいセットを選ぶ'],
    avoid: '「防災セット一式」だけで安心せず、人数分に足りるかを確認します。',
    related: ['toilet-office', 'kitaku-konnansha', 'hoikuen-bousai'],
    faq: [
      ['何人分から用意すればいいですか？', '常時いる従業員数に加え、来客や一時滞在者を少し見込むと不足しにくくなります。'],
      ['最初に買うなら何ですか？', '水、簡易トイレ、ライト、非常食の順に確認すると、災害時の困りごとを減らしやすいです。']
    ]
  },
  'kitaku-konnansha': {
    audience: '駅近オフィス・商業施設・学習塾',
    disasters: ['地震', '帰宅困難者', '台風'],
    conclusion: '帰宅困難者対策は、移動用グッズよりも施設内で安全に待つための水・トイレ・防寒を優先します。',
    mustHave: ['保存水', '簡易トイレ', 'アルミブランケット', '非常食', 'ライト'],
    problem: '災害時にすぐ帰れない従業員・来訪者が出る場所で、待機用品を揃えるための比較ページです。',
    checks: ['滞在人数の最大値を決める', '水・簡易トイレ・防寒を優先', '配布しやすい個包装か見る', '棚卸ししやすい単位で選ぶ'],
    avoid: '帰宅支援グッズだけに寄せすぎず、施設内で待つ前提の備蓄を入れます。',
    related: ['office-bichiku', 'toilet-office', 'portable-power-kaigo'],
    faq: [
      ['帰宅困難者対策で不足しやすいものは？', '簡易トイレ、防寒用品、スマホ充電、飲料水が不足しやすいです。'],
      ['来客分も必要ですか？', '店舗や教室など来客がある場所では、従業員分だけでなく最大滞在人数を目安に考えると安全です。']
    ]
  },
  'restaurant-dansui': {
    audience: '飲食店・小規模厨房・テイクアウト店',
    disasters: ['断水', '台風', '地震'],
    conclusion: '飲食店の断水対策は、営業継続より先に手指衛生・トイレ・片付け用水を分けて考えるのが現実的です。',
    mustHave: ['保存水', '給水タンク', '手指消毒用品', '簡易トイレ', '使い捨て手袋'],
    problem: '断水時の営業判断、衛生確保、トイレ対応に必要な用品を切り分けて考えるページです。',
    checks: ['飲料水と衛生用水を分ける', '手指衛生用品を先に確保', '簡易トイレと消臭袋を見る', '営業継続ではなく安全確保を基準にする'],
    avoid: '飲料水だけを買って終わらせず、手洗い・トイレ・片付けまで見ます。',
    related: ['toilet-office', 'office-bichiku', 'kitaku-konnansha'],
    faq: [
      ['飲食店は断水時も営業できますか？', '衛生管理や自治体の案内に従う必要があります。備蓄は営業継続だけでなく、安全確保と片付けにも使う前提で考えます。'],
      ['飲料水以外に必要なものは？', '手指消毒、使い捨て手袋、簡易トイレ、給水タンク、清掃用品を分けて確認すると漏れが減ります。']
    ]
  },
  'hoikuen-bousai': {
    audience: '保育園・小規模園・一時預かり施設',
    disasters: ['地震', '台風', '停電'],
    conclusion: '保育園では、園児用と職員用を分けて、水・食料・衛生・防寒を確認するのが重要です。',
    mustHave: ['保存水', '子ども向け非常食', '衛生用品', '防寒用品', '簡易トイレ'],
    problem: '子どもを一定時間安全に待機させるため、水、食料、衛生、防寒を確認するページです。',
    checks: ['園児数と職員数を分けて計算', 'アレルギー表示を確認', '衛生用品と防寒用品を厚めに見る', '持ち出し用と備蓄用を分ける'],
    avoid: '大人用のセットをそのまま流用せず、子ども向けの食べやすさと衛生を見ます。',
    related: ['office-bichiku', 'toilet-office', 'portable-power-kaigo'],
    faq: [
      ['保育園では食料をどう選びますか？', '食べやすさ、アレルギー表示、保存年数、配布しやすさを確認します。'],
      ['大人用セットで代用できますか？', '一部は使えますが、園児向けの食べやすさや衛生用品は別で確認した方が安心です。']
    ]
  },
  'toilet-office': {
    audience: '事業所・店舗・施設管理者',
    disasters: ['断水', '地震', '台風'],
    conclusion: '簡易トイレは人数分ではなく回数分で見るのが基本です。1人1日5回を目安に不足しないか確認します。',
    mustHave: ['凝固剤', '汚物袋', '防臭袋', '手袋', '目隠し用品'],
    problem: '断水や排水不可のときに、最低限のトイレ環境を維持するための比較ページです。',
    checks: ['回数表記で必要量を見る', '凝固剤と袋のセット内容を確認', '保管年数と箱サイズを見る', '消臭袋や目隠し用品も合わせて考える'],
    avoid: '人数分ではなく回数分で計算します。水や食料より不足が表面化しやすい用品です。',
    related: ['office-bichiku', 'restaurant-dansui', 'kitaku-konnansha'],
    faq: [
      ['簡易トイレは何回分必要ですか？', '目安として1人1日5回で計算します。利用者数や待機日数が増える場合は余裕を見ます。'],
      ['防臭袋は必要ですか？', '保管や一時置きが発生する場合、防臭袋や消臭用品があると負担を減らしやすいです。']
    ]
  }
};

const categoryDefinitions = [
  ['小規模オフィス向け防災備蓄', 'office-bichiku', '地震・台風で従業員が待機する前提の基本備蓄。', ['地震', '台風']],
  ['事業所向け簡易トイレ', 'toilet-office', '断水や排水不可に備える回数ベースの比較。', ['断水', '地震']],
  ['台風・大雨対策', 'portable-power-kaigo', '停電・浸水前に確認したい電源と待機用品。', ['台風', '停電']],
  ['地震対策', 'office-bichiku', '水・トイレ・食料・防寒を優先する備蓄導線。', ['地震']],
  ['停電対策', 'portable-power-kaigo', 'スマホ、照明、通信機器の電源確保。', ['停電', '台風']],
  ['飲食店向け断水対策', 'restaurant-dansui', '衛生、トイレ、片付け用水を分けて確認。', ['断水']],
  ['保育園向け防災備蓄', 'hoikuen-bousai', '園児と職員を分けて考える備蓄。', ['地震', '台風']],
  ['介護施設向けポータブル電源', 'portable-power-kaigo', '見守り、通信、照明の停電対策。', ['停電']],
  ['帰宅困難者対策', 'kitaku-konnansha', '施設内待機に必要な水・トイレ・防寒。', ['帰宅困難者', '地震']],
  ['保存水・非常食', 'office-bichiku', '人数と日数で不足を防ぐ基本備蓄。', ['地震', '台風']],
  ['衛生用品・感染対策', 'restaurant-dansui', '断水時の手指衛生と片付け用品。', ['断水']],
  ['防寒・睡眠用品', 'kitaku-konnansha', '待機時の体温維持と休息用品。', ['帰宅困難者']]
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

function yen(value) {
  const price = Number(value || 0);
  return price ? price.toLocaleString('ja-JP') + '円' : '価格確認';
}

function pageBySlug(slug) {
  return data.pages.find((page) => page.slug === slug);
}

function updatedDate() {
  return data.generatedAt ? new Date(data.generatedAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '更新日確認中';
}

function shortName(name, maxLength = 54) {
  const compact = String(name || '').replace(/[【】■◆＼／]/g, '').replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? compact.slice(0, maxLength - 1) + '…' : compact;
}

function extractSpec(product) {
  const name = String(product.name || '');
  const years = name.match(/(\d{1,2})年保存/);
  const toiletCount = name.match(/(\d{1,4})回分/);
  const wh = name.match(/(\d{3,5})Wh/i);
  const liters = name.match(/(\d+(?:\.\d+)?)L/);
  if (toiletCount) return `${toiletCount[1]}回分`;
  if (wh) return `${wh[1]}Wh`;
  if (liters) return `${liters[1]}L`;
  if (years) return `${years[1]}年保存`;
  return '商品ページで確認';
}

function storageYears(product) {
  const match = String(product.name || '').match(/(\d{1,2})年保存/);
  return match ? `${match[1]}年` : '要確認';
}

function recommendedType(product, note) {
  const name = String(product.name || '');
  if (/トイレ|凝固|汚物|排泄|便/.test(name)) return 'トイレ重視';
  if (/電源|Wh|バッテリー|蓄電/.test(name)) return '停電対策';
  if (/水|ウォーター|給水/.test(name)) return '水の備蓄';
  if (/食|パン|ご飯|保存食|非常食/.test(name)) return '食料備蓄';
  if (/ブランケット|寝袋|防寒|毛布/.test(name)) return '防寒・待機';
  if (/衛生|消毒|手袋/.test(name)) return '衛生用品';
  return note.disasters?.includes('停電') ? '停電対策' : '基本備蓄';
}

function suitedFacility(product, note) {
  const name = String(product.name || '');
  if (/法人|企業|事業所|業務用/.test(name)) return '事業所・施設';
  if (/保育園|子供|園児|幼稚園/.test(name)) return '保育園・学校';
  if (/介護|高齢者/.test(name)) return '介護施設';
  if (/トイレ|断水/.test(name)) return '店舗・オフィス';
  return note.audience;
}

function cautionForProduct(product) {
  const name = String(product.name || '');
  if (!Number(product.reviewCount || 0)) return 'レビューが少ないため仕様確認';
  if (/送料別途|外直送|見積り/.test(name)) return '送料・納期を確認';
  if (/トイレ|凝固/.test(name)) return '袋・凝固剤の数を確認';
  if (/電源|Wh|バッテリー/.test(name)) return '出力W数と充電管理を確認';
  if (/食|パン|ご飯|保存食/.test(name)) return 'アレルギーと期限を確認';
  return '購入前に最新条件を確認';
}

function quantityEstimateSection() {
  return `<section class="section card calc-card" id="quantity">
    <div class="section-title"><div><p class="eyebrow">必要数量の目安</p><h2>人数と日数から、まず必要量をざっくり確認</h2></div><p class="notice">目安です。施設条件に合わせて調整してください。</p></div>
    <div class="calc-grid">
      <label>従業員・職員数<input class="calc-input" id="staffCount" type="number" min="0" value="10"></label>
      <label>待機日数<input class="calc-input" id="daysCount" type="number" min="1" value="1"></label>
      <label>来客・利用者数<input class="calc-input" id="visitorCount" type="number" min="0" value="0"></label>
    </div>
    <div class="estimate-grid" aria-live="polite">
      <div><span>水</span><strong id="waterEstimate">30L</strong><small>1人1日3Lの目安</small></div>
      <div><span>食料</span><strong id="foodEstimate">30食</strong><small>1人1日3食の目安</small></div>
      <div><span>簡易トイレ</span><strong id="toiletEstimate">50回分</strong><small>1人1日5回の目安</small></div>
      <div><span>保温シート・毛布</span><strong id="blanketEstimate">10枚</strong><small>1人1枚の目安</small></div>
    </div>
  </section>`;
}

function disasterChips(items, active = '') {
  return items.map((item) => `<a class="chip ${item === active ? 'active' : ''}" href="${siteUrl}/#${encodeURIComponent(item)}">${esc(item)}</a>`).join('');
}

function layout(title, body, description, canonical, options = {}) {
  const crumbs = options.crumbs || [];
  const breadcrumb = crumbs.length ? `<nav class="breadcrumb" aria-label="パンくず"><a href="${siteUrl}/">ホーム</a>${crumbs.map((item) => `<span>/</span><span>${esc(item)}</span>`).join('')}</nav>` : '';
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | 事業所防災ナビ</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)} | 事業所防災ナビ">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta name="twitter:card" content="summary">
  <style>
    :root{color-scheme:light;--ink:#17212b;--muted:#5c6874;--line:#dbe4e4;--soft:#f7f2e8;--paper:#fff;--main:#103f4a;--main2:#0d6258;--accent:#e47b24;--accent-soft:#fff1e3;--ok:#187060;--warn:#a45d08}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--soft);color:var(--ink);font-family:system-ui,-apple-system,"Yu Gothic","Meiryo",sans-serif;font-size:16px;line-height:1.75;letter-spacing:0}
    a{color:var(--main2)}main{max-width:1180px;margin:0 auto;padding:22px 18px 56px}.site-head{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:14px}.brand{font-weight:900;font-size:22px;text-decoration:none;color:var(--main)}.nav{display:flex;gap:10px;flex-wrap:wrap}.nav a{font-size:14px;text-decoration:none;color:var(--muted);padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.65)}
    .breadcrumb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 14px;color:var(--muted);font-size:13px}.breadcrumb a{text-decoration:none;color:var(--muted)}
    .hero{background:linear-gradient(135deg,#fff 0%,#fff7ed 100%);border:1px solid #eadfce;border-radius:8px;padding:34px;box-shadow:0 14px 34px rgba(31,35,30,.09)}.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    .eyebrow{font-size:13px;font-weight:900;color:var(--main2);margin:0 0 8px}h1{font-size:clamp(30px,5vw,48px);line-height:1.25;margin:0 0 14px;letter-spacing:0}h2{font-size:24px;line-height:1.35;margin:0 0 12px}h3{font-size:18px;line-height:1.45;margin:0 0 8px}.lead{font-size:18px;max-width:890px}.muted{color:var(--muted)}.section{margin-top:28px}.section-title{display:flex;justify-content:space-between;gap:14px;align-items:end;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:22px;box-shadow:0 10px 24px rgba(29,38,34,.06)}.card h2 a,.card h3 a{text-decoration:none;color:var(--ink)}.card h2 a:hover,.card h3 a:hover{text-decoration:underline}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;background:var(--main2);color:white;border-radius:8px;text-decoration:none;font-weight:900;box-shadow:0 8px 16px rgba(13,98,88,.18)}.button.orange{background:var(--accent);box-shadow:0 8px 16px rgba(228,123,36,.18)}.button.secondary{background:#fff;color:var(--main2);border:1px solid var(--main2);box-shadow:none}.button.block{width:100%}
    .chip-row{display:flex;gap:9px;flex-wrap:wrap}.chip,.pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:900;text-decoration:none}.chip{background:#fff;color:var(--main);border:1px solid var(--line)}.chip.active,.pill.orange{background:var(--accent-soft);border:1px solid #f4c497;color:#9b4d08}.pill{background:#e9f3f1;color:var(--main2);border:1px solid #cfe2de}.pill.navy{background:#e9eef2;color:var(--main);border-color:#cbd8de}
    .search-box{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}.search-box input{min-height:48px;border:1px solid var(--line);border-radius:8px;padding:0 14px;font-size:16px;background:#fff}.mini-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.mini-stats div,.estimate-grid div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.mini-stats strong,.estimate-grid strong{display:block;font-size:24px;color:var(--main)}
    .checklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0 0;padding:0;list-style:none}.checklist li{background:#f6faf8;border:1px solid #d9e7e3;border-radius:8px;padding:12px 14px}.steps{counter-reset:step;display:grid;gap:10px;margin:0;padding:0;list-style:none}.steps li{counter-increment:step;padding:12px 14px;border-left:4px solid var(--accent);background:#fffaf4;border-radius:0 8px 8px 0}.steps li:before{content:counter(step) ". ";font-weight:900;color:var(--accent)}
    .two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.category-card{display:flex;flex-direction:column;gap:10px}.category-card .count{margin-top:auto;color:var(--muted);font-size:13px}.popular-card{border-top:5px solid var(--accent)}
    .compare-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:#fff}.compare-table{width:100%;min-width:980px;border-collapse:collapse}.compare-table th,.compare-table td{padding:12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.compare-table th{background:#f2f6f5;color:var(--main);font-size:13px}.compare-table tr:last-child td{border-bottom:0}.table-product{font-weight:900;max-width:260px;overflow-wrap:anywhere}.small-button{display:inline-flex;min-height:36px;align-items:center;padding:7px 10px;border-radius:7px;background:var(--main2);color:white;text-decoration:none;font-weight:900;white-space:nowrap}
    .product-list{display:grid;gap:14px}.product{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:start}.product-img{width:150px;height:150px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px}.product-img.placeholder{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px;background:#f6f6f2}.product h2{font-size:20px;overflow-wrap:anywhere}.summary{margin:8px 0;color:#33423b}.price{font-size:24px;font-weight:900;color:var(--main);margin:8px 0}.facts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.fact{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:13px;background:#fbfcfb;color:#33423b}.spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}.spec-grid div{background:#f8faf8;border:1px solid var(--line);border-radius:8px;padding:8px}.spec-grid span{display:block;font-size:12px;color:var(--muted)}.spec-grid strong{display:block;color:var(--ink)}.notice{font-size:13px;color:var(--muted)}.empty{border:1px dashed #d6b681;background:#fffaf4}.ad-note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}.calc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.calc-grid label{display:grid;gap:6px;font-weight:900}.calc-input{min-height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-size:16px}.estimate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:14px}.estimate-grid span,.estimate-grid small{display:block;color:var(--muted)}.faq details{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.faq details+details{margin-top:10px}.faq summary{font-weight:900;cursor:pointer}.link-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.link-list a{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px;text-decoration:none;font-weight:900;color:var(--main)}
    @media(max-width:760px){main{padding:16px 12px 44px}.site-head{align-items:flex-start;flex-direction:column}.hero{padding:24px}.lead{font-size:16px}.section-title{display:block}.two,.three{grid-template-columns:1fr}.search-box{grid-template-columns:1fr}.product{grid-template-columns:104px 1fr;gap:12px}.product-img{width:104px;height:104px}.product h2{font-size:17px}.nav{gap:8px}.hero-actions .button{width:100%}.card{padding:18px}}
  </style>
</head>
<body><main><header class="site-head"><a class="brand" href="${siteUrl}/">事業所防災ナビ</a><nav class="nav"><a href="${siteUrl}/#disasters">災害別</a><a href="${siteUrl}/#categories">カテゴリ</a><a href="${siteUrl}/#quantity">人数別目安</a><a href="${siteUrl}/#popular">人気比較</a></nav></header>${breadcrumb}${body}${clientScript()}</main></body>
</html>`;
}

function clientScript() {
  return `<script>
    (function(){
      function numberValue(id, fallback){ var el=document.getElementById(id); var value=el ? Number(el.value) : fallback; return Number.isFinite(value) && value >= 0 ? value : fallback; }
      function updateEstimate(){
        var staff=numberValue('staffCount',10);
        var days=Math.max(1, numberValue('daysCount',1));
        var visitors=numberValue('visitorCount',0);
        var people=staff+visitors;
        var water=document.getElementById('waterEstimate');
        var food=document.getElementById('foodEstimate');
        var toilet=document.getElementById('toiletEstimate');
        var blanket=document.getElementById('blanketEstimate');
        if(water) water.textContent=(people*days*3).toLocaleString('ja-JP')+'L';
        if(food) food.textContent=(people*days*3).toLocaleString('ja-JP')+'食';
        if(toilet) toilet.textContent=(people*days*5).toLocaleString('ja-JP')+'回分';
        if(blanket) blanket.textContent=people.toLocaleString('ja-JP')+'枚';
      }
      ['staffCount','daysCount','visitorCount'].forEach(function(id){ var el=document.getElementById(id); if(el) el.addEventListener('input', updateEstimate); });
      updateEstimate();
      var search=document.getElementById('siteSearch');
      if(search){
        search.addEventListener('input', function(){
          var term=search.value.trim().toLowerCase();
          document.querySelectorAll('[data-search-card]').forEach(function(card){
            card.style.display = !term || card.textContent.toLowerCase().indexOf(term) !== -1 ? '' : 'none';
          });
        });
      }
    })();
  </script>`;
}

function productJsonLd(products) {
  const graph = products.filter((product) => product.name && product.url).slice(0, 3).map((product) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'JPY',
      price: product.price || undefined,
      url: product.url
    },
    aggregateRating: product.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: product.reviewAverage,
      reviewCount: product.reviewCount
    } : undefined
  }));
  return graph.length ? `<script type="application/ld+json">${JSON.stringify(graph)}</script>` : '';
}

function comparisonRows(products, note) {
  if (!products.length) {
    return `<tr><td colspan="10"><strong>商品候補の取得改善が必要です。</strong><br>このページは選び方・必要数量・確認ポイントを先に掲載し、次の段階で複数キーワード取得により比較候補を増やします。</td></tr>`;
  }
  return products.map((product) => `<tr>
    <td class="table-product">${esc(shortName(product.name, 46))}</td>
    <td>${esc(recommendedType(product, note))}</td>
    <td>${esc(yen(product.price))}</td>
    <td>${esc(product.reviewAverage || '-')}</td>
    <td>${esc(product.reviewCount || 0)}</td>
    <td>${esc(storageYears(product))}</td>
    <td>${esc(extractSpec(product))}</td>
    <td>人数入力で確認</td>
    <td>${esc(suitedFacility(product, note))}</td>
    <td>${esc(cautionForProduct(product))}<br><a class="small-button" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener">詳細</a></td>
  </tr>`).join('');
}

function comparisonTable(products, note) {
  return `<section class="section" id="comparison">
    <div class="section-title"><div><p class="eyebrow">比較表</p><h2>価格・レビュー・用途を横並びで確認</h2></div><p class="notice">スマホでは横にスクロールできます</p></div>
    <div class="compare-scroll">
      <table class="compare-table">
        <thead><tr><th>商品</th><th>おすすめ分類</th><th>価格</th><th>レビュー点数</th><th>レビュー件数</th><th>保存年数</th><th>容量または回数</th><th>対象人数の目安</th><th>向いている施設</th><th>注意点 / 詳細</th></tr></thead>
        <tbody>${comparisonRows(products, note)}</tbody>
      </table>
    </div>
  </section>`;
}

function productCards(products, note) {
  if (!products.length) {
    return `<article class="card empty"><p class="pill orange">次に商品取得を改善</p><h2>比較候補を増やす必要があります</h2><p>このページは現時点で商品候補が不足しています。UI上では選び方・必要数量・FAQを表示し、次工程で検索キーワードを増やして商品候補を補強します。</p></article>`;
  }
  return products.map((product, index) => `<article class="card product">
    ${product.image ? `<img class="product-img" src="${esc(product.image)}" alt="${esc(shortName(product.name))}" loading="lazy">` : '<div class="product-img placeholder" aria-hidden="true">商品画像<br>取得待ち</div>'}
    <div>
      <p class="pill navy">比較候補 ${index + 1} / ${esc(recommendedType(product, note))}</p>
      <h2>${esc(shortName(product.name))}</h2>
      ${product.summary ? `<p class="summary">${esc(product.summary)}</p>` : ''}
      <p class="price">${yen(product.price)}</p>
      <div class="facts">
        <span class="fact">レビュー ${esc(product.reviewAverage || '-')}</span>
        <span class="fact">件数 ${esc(product.reviewCount || 0)}</span>
        <span class="fact">${esc(product.shopName || '楽天市場')}</span>
      </div>
      <div class="spec-grid">
        <div><span>主要スペック</span><strong>${esc(extractSpec(product))}</strong></div>
        <div><span>おすすめポイント</span><strong>${esc(recommendedType(product, note))}</strong></div>
        <div><span>注意点</span><strong>${esc(cautionForProduct(product))}</strong></div>
        <div><span>向いている施設</span><strong>${esc(suitedFacility(product, note))}</strong></div>
      </div>
      <a class="button orange" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener">楽天で価格・在庫を確認する</a>
    </div>
  </article>`).join('');
}

function faqSection(note) {
  const items = (note.faq || []).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  return `<section class="section faq"><h2>FAQ</h2>${items}</section>`;
}

function relatedLinks(slugs) {
  const links = (slugs || []).map((slug) => {
    const page = pageBySlug(slug);
    return page ? `<a href="${siteUrl}/pages/${esc(slug)}.html">${esc(page.title)}</a>` : '';
  }).filter(Boolean).join('');
  return `<section class="section"><div class="section-title"><h2>関連ページ</h2><p class="notice">災害別・施設別に続けて確認</p></div><div class="link-list">${links}</div></section>`;
}

function pageHtml(page) {
  const note = pageNotes[page.slug] || {
    audience: '事業所',
    disasters: ['地震', '台風'],
    conclusion: `${page.title}は、用途と人数を先に決めてから商品候補を比較します。`,
    mustHave: ['水', '食料', '簡易トイレ', '衛生用品'],
    problem: `${page.keyword}を比較したい方向けです。`,
    checks: ['必要数を見る', '保管場所を見る', '期限管理を見る', '購入前に最新価格を見る'],
    avoid: '商品名だけで選ばず、用途に合うかを確認します。',
    related: ['office-bichiku']
  };
  const products = page.products || [];
  const checks = note.checks.map((item) => `<li>${esc(item)}</li>`).join('');
  const mustHave = note.mustHave.map((item) => `<span class="pill orange">${esc(item)}</span>`).join('');
  const body = `<section class="hero">
    <p class="eyebrow">${esc(note.audience)}向け比較</p>
    <h1>${esc(page.title)}</h1>
    <p class="lead">${esc(note.problem)}</p>
    <div class="hero-meta">
      <span class="pill navy">対象施設: ${esc(note.audience)}</span>
      <span class="pill navy">想定災害: ${esc(note.disasters.join('・'))}</span>
      <span class="pill orange">比較候補数: ${products.length}件</span>
      <span class="pill">最終更新: ${esc(updatedDate())}</span>
    </div>
  </section>
  <section class="section two">
    <article class="card"><p class="eyebrow">このページの結論</p><h2>${esc(note.conclusion)}</h2><p>${esc(note.avoid)}</p></article>
    <article class="card"><p class="eyebrow">まず揃えるべきもの</p><div class="chip-row">${mustHave}</div></article>
  </section>
  <section class="section two">
    <article class="card"><h2>選び方</h2><ul class="checklist">${checks}</ul></article>
    <article class="card"><h2>おすすめ分類</h2><ol class="steps"><li>レビュー件数があるもの</li><li>必要量が読み取りやすいもの</li><li>保管期限・容量・回数が明記されているもの</li></ol></article>
  </section>
  ${quantityEstimateSection()}
  ${comparisonTable(products, note)}
  <section class="section"><div class="section-title"><div><p class="eyebrow">商品カード</p><h2>候補ごとの向き・注意点を見る</h2></div><p class="notice">価格・在庫・レビューは変動します</p></div><div class="product-list">${productCards(products, note)}</div></section>
  <section class="section card"><h2>注意点</h2><p>このページの数量計算は目安です。実際には建物の規模、滞在人数、地域リスク、保管場所、自治体や業界ルールに合わせて調整してください。購入前に楽天の商品ページでセット内容、個数、保存年数、送料、納期を確認してください。</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。リンク先で購入された場合、サイト運営者に成果報酬が発生することがあります。</p></section>
  ${faqSection(note)}
  ${relatedLinks(note.related)}
  ${productJsonLd(products)}`;
  return layout(page.title, body, `${page.title}。${note.problem}`, `${siteUrl}/pages/${page.slug}.html`, { crumbs: [page.title] });
}

const totalProducts = data.pages.reduce((sum, page) => sum + (page.products || []).length, 0);
const weakPages = data.pages.filter((page) => (page.products || []).length < 2).length;

const categoryCards = categoryDefinitions.map(([title, slug, desc, chips]) => {
  const page = pageBySlug(slug);
  const count = page ? (page.products || []).length : 0;
  return `<article class="card category-card" data-search-card>
    <div class="chip-row">${chips.map((chip) => `<span class="chip">${esc(chip)}</span>`).join('')}</div>
    <h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(title)}</a></h3>
    <p>${esc(desc)}</p>
    <p class="count">比較候補: ${count}件</p>
  </article>`;
}).join('');

const popularCards = [
  ['まず見るべき比較', '小規模オフィス向け防災備蓄', 'office-bichiku'],
  ['トイレ不足を防ぐ', '事業所向け簡易トイレ', 'toilet-office'],
  ['停電に備える', '介護施設向けポータブル電源', 'portable-power-kaigo']
].map(([label, title, slug]) => `<article class="card popular-card"><p class="pill orange">${esc(label)}</p><h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(title)}</a></h3><p class="notice">比較候補: ${esc((pageBySlug(slug)?.products || []).length)}件</p></article>`).join('');

const indexBody = `<section class="hero">
  <p class="eyebrow">会社・店舗・施設向けの防災備蓄比較</p>
  <h1>地震・台風・停電・断水に備える 事業所防災用品比較</h1>
  <p class="lead">会社、店舗、保育園、介護施設、飲食店向けに、防災備蓄品を人数・用途・災害別に比較できます。</p>
  <div class="hero-actions">
    <a class="button orange" href="#地震">地震対策を見る</a>
    <a class="button" href="#台風">台風・停電対策を見る</a>
    <a class="button secondary" href="${siteUrl}/pages/toilet-office.html">簡易トイレを比較する</a>
    <a class="button secondary" href="#quantity">人数別の備蓄目安を見る</a>
  </div>
  <div class="hero-meta">
    <span class="pill navy">比較ページ: ${data.pages.length}件</span>
    <span class="pill orange">商品候補: ${totalProducts}件</span>
    <span class="pill">改善対象ページ: ${weakPages}件</span>
    <span class="pill">最終更新: ${esc(updatedDate())}</span>
  </div>
  <div class="search-box"><input id="siteSearch" type="search" placeholder="例: 地震、台風、停電、断水、保育園、トイレ"><a class="button" href="#categories">探す</a></div>
</section>
<section class="section" id="disasters">
  <div class="section-title"><div><p class="eyebrow">災害別チップ</p><h2>まずは起きる場面から選ぶ</h2></div></div>
  <div class="chip-row">
    <a id="地震" class="chip active" href="${siteUrl}/pages/office-bichiku.html">地震</a>
    <a id="台風" class="chip active" href="${siteUrl}/pages/portable-power-kaigo.html">台風</a>
    <a id="停電" class="chip active" href="${siteUrl}/pages/portable-power-kaigo.html">停電</a>
    <a id="断水" class="chip active" href="${siteUrl}/pages/restaurant-dansui.html">断水</a>
    <a id="帰宅困難者" class="chip active" href="${siteUrl}/pages/kitaku-konnansha.html">帰宅困難者</a>
  </div>
</section>
<section class="section three">
  <article class="card"><h2>施設別チップ</h2><div class="chip-row"><a class="chip" href="${siteUrl}/pages/office-bichiku.html">会社</a><a class="chip" href="${siteUrl}/pages/hoikuen-bousai.html">保育園</a><a class="chip" href="${siteUrl}/pages/portable-power-kaigo.html">介護施設</a><a class="chip" href="${siteUrl}/pages/restaurant-dansui.html">飲食店</a></div></article>
  <article class="card"><h2>まず見るべき比較</h2><ol class="steps"><li>簡易トイレ</li><li>保存水・非常食</li><li>停電時の電源</li></ol></article>
  <article class="card"><h2>おすすめ分類</h2><p>レビュー重視、価格重視、法人・施設向け、大容量、長期保存の観点で比較できるように整理しています。</p></article>
</section>
${quantityEstimateSection()}
<section class="section" id="popular"><div class="section-title"><div><p class="eyebrow">人気比較ページ</p><h2>最初に確認されやすいページ</h2></div></div><div class="grid">${popularCards}</div></section>
<section class="section" id="categories"><div class="section-title"><div><p class="eyebrow">主要カテゴリ</p><h2>用途・災害・施設別に探す</h2></div><p class="notice">検索窓で絞り込みできます</p></div><div class="grid">${categoryCards}</div></section>
<section class="section card"><h2>比較サイトとしての見方</h2><p>商品名だけではなく、人数、待機日数、用途、容量、回数、保存年数、レビュー件数を合わせて確認してください。0件または1件のページは、次の工程で商品取得キーワードを増やして補強します。</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。価格・在庫・レビューは変動するため、購入前にリンク先で最新情報を確認してください。</p></section>`;

fs.writeFileSync(path.join(dist, 'index.html'), layout(
  '地震・台風・停電・断水に備える 事業所防災用品比較',
  indexBody,
  '会社、店舗、保育園、介護施設、飲食店向けに、防災備蓄品を人数・用途・災害別に比較できます。',
  `${siteUrl}/`
));
fs.writeFileSync(path.join(dist, 'CNAME'), 'jigyousho-bousai.com\n');
fs.mkdirSync(path.join(dist, 'pages'), { recursive: true });
for (const page of data.pages) {
  fs.writeFileSync(path.join(dist, 'pages', page.slug + '.html'), pageHtml(page));
}
const urls = [`${siteUrl}/`, ...data.pages.map((page) => `${siteUrl}/pages/${page.slug}.html`)];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
console.log('built', dist);
