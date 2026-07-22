const fs = require('fs');
const path = require('path');
const { hasAmbiguousToiletQuantity, titleShort } = require('./fetch-products');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://jigyousho-bousai.com').replace(/\/$/, '');
const gaMeasurementId = 'G-LN824MSD7X';
const dataPath = path.join(root, 'data', 'products.json');
const keywordsPath = path.join(root, 'data', 'keywords.csv');

const data = fs.existsSync(dataPath)
  ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  : { generatedAt: new Date().toISOString(), pages: [] };

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] || '']));
  });
}

const keywordRows = fs.existsSync(keywordsPath) ? parseCsv(fs.readFileSync(keywordsPath, 'utf8')) : [];
const dataPagesBySlug = new Map((data.pages || []).map((page) => [page.slug, page]));
data.pages = keywordRows.map((row) => ({ ...row, ...(dataPagesBySlug.get(row.slug) || {}), products: dataPagesBySlug.get(row.slug)?.products || [] }));

const requiredNotice = '価格、在庫、レビュー、商品仕様は変わります。購入前に販売ページで最新情報を確認してください。医療機器、介護機器、食品アレルギー、施設運用に関わる備蓄は、メーカー、専門業者、施設管理者に確認してください。';

const publicSources = {
  workplaceGuideline: {
    title: '事業所における帰宅困難者等対策ガイドライン',
    publisher: '内閣府 防災情報のページ',
    url: 'https://www.bousai.go.jp/jishin/syuto/kitaku/pdf/kitaku_guideline-jigyosyo.pdf',
    note: '3日分の備蓄、水1人1日3L、主食1人1日3食、毛布1人1枚などの考え方を確認できます。'
  },
  toiletGuideline: {
    title: '避難所におけるトイレの確保・管理ガイドライン',
    publisher: '内閣府 防災情報のページ',
    url: 'https://www.bousai.go.jp/taisaku/hinanjo/pdf/1605hinanjo_toilet_guideline.pdf',
    note: '携帯・簡易トイレの備蓄日数や、使用・管理時に確認する項目を確認できます。'
  },
  stockpilePortal: {
    title: '東京都防災 備蓄ナビ',
    publisher: '東京都',
    url: 'https://www.bichiku.metro.tokyo.lg.jp/',
    note: '人数や条件から備蓄品と数量を考えるための公的な案内です。'
  }
};

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
  },
  'earthquake-office': {
    audience: '会社・店舗・小規模事業所',
    disasters: ['地震', '帰宅困難者', '断水'],
    conclusion: '事業所の地震対策は、水・簡易トイレ・非常食・ライト・防寒用品を人数と待機日数で分けて確認します。',
    mustHave: ['保存水', '非常食', '簡易トイレ', 'ライト', '防寒用品'],
    problem: '地震で会社や店舗に従業員・来客が残る場面に備え、防災備蓄を比較するページです。帰宅困難者対策も合わせて確認します。',
    checks: ['水とトイレを先に数量計算する', '従業員と来客を分けて考える', '停電時のライトと充電も見る', '保管場所と期限管理を確認する'],
    avoid: '地震対策は防災セット名だけで選ばず、断水・停電・帰宅困難者を分けて備えます。',
    related: ['office-bichiku', 'toilet-office', 'kitaku-konnansha', 'water-food-stock'],
    faq: [
      ['会社の防災備蓄は何日分必要ですか？', 'まずは1日分から不足がないか確認し、地域リスクや帰宅困難者の発生可能性に応じて複数日分を検討します。'],
      ['地震対策で最初に揃えるものは？', '保存水、簡易トイレ、非常食、ライト、防寒用品を人数と日数で確認します。'],
      ['台風対策と地震対策で備えるものは違いますか？', '共通する備蓄もありますが、地震では断水・トイレ・帰宅困難者、台風では停電・浸水前の待機を特に見ます。']
    ]
  },
  'typhoon-office': {
    audience: '会社・店舗・施設管理者',
    disasters: ['台風', '大雨', '停電'],
    conclusion: '台風・大雨対策は、停電時の連絡手段、照明、水、簡易トイレ、浸水前の備えを分けて確認します。',
    mustHave: ['ポータブル電源', 'LEDライト', '保存水', '簡易トイレ', '給水用品'],
    problem: '台風や大雨で出勤・帰宅が難しくなる会社、店舗、施設向けに、防災用品を比較するページです。',
    checks: ['停電時の照明と通信を確認', '水とトイレを待機人数で計算', '台風前に配送が間に合うか見る', '屋外対策用品と室内備蓄を分ける'],
    avoid: '営業継続を断定せず、従業員と来客が安全に待機できる備えを優先します。',
    related: ['blackout-power', 'office-bichiku', 'restaurant-dansui', 'kitaku-konnansha'],
    faq: [
      ['台風対策と地震対策で備えるものは違いますか？', '台風では停電や交通停止、地震では断水やトイレ不足が目立ちやすいです。水・トイレ・食料は共通して確認します。'],
      ['台風で停電した場合、まず必要なものは？', 'スマホ充電、照明、連絡手段を確保するため、電源とライトを先に確認します。'],
      ['店舗では何を準備すべきですか？', '従業員と来客の待機用に、水、簡易トイレ、ライト、衛生用品を用意する目安を確認します。']
    ]
  },
  'blackout-power': {
    audience: '事業所・介護施設・店舗',
    disasters: ['停電', '台風', '地震'],
    conclusion: '停電対策では、ポータブル電源のWh容量、出力W数、充電方法、保管管理のしやすさを先に比較します。',
    mustHave: ['ポータブル電源', 'LEDライト', '充電ケーブル', '延長コード', '乾電池'],
    problem: '停電時に会社、店舗、介護施設でスマホ、照明、通信機器を使うための電源用品を比較するページです。',
    checks: ['使う機器の消費電力を確認', 'Wh容量と出力W数を見る', 'リン酸鉄など電池方式を確認', '保管時の充電管理を決める'],
    avoid: '医療機器や介護機器に使えると断定せず、必ずメーカーや専門業者に確認します。',
    related: ['portable-power-kaigo', 'typhoon-office', 'earthquake-office', 'office-bichiku'],
    faq: [
      ['停電対策でまず必要なものは何ですか？', '照明、スマホ充電、連絡手段を確保する電源用品を先に確認します。'],
      ['介護施設でポータブル電源を選ぶときの注意点は？', '見守り機器や通信機器の消費電力、出力W数、保管時の充電管理を確認します。医療機器への利用可否は専門確認が必要です。'],
      ['WhとWは何が違いますか？', 'Whは使える電力量の目安、Wは同時に動かせる出力の目安です。両方を確認します。']
    ]
  },
  'water-food-stock': {
    audience: '会社・事業所・店舗',
    disasters: ['地震', '台風', '帰宅困難者'],
    conclusion: '保存水・非常食は、人数と待機日数から水は1人1日3L、食料は1人1日3食を目安に確認します。',
    mustHave: ['保存水', '非常食', 'アルファ米', '個包装食', '配布しやすいセット'],
    problem: '会社や事業所で従業員・来客が待機する場面に備え、保存水と非常食を比較するページです。',
    checks: ['人数と日数で必要量を見る', '保存年数と期限管理を見る', 'アレルギー表示を確認', '配布しやすい個包装か見る'],
    avoid: '食料だけを先に揃えず、水、簡易トイレ、防寒も合わせて確認します。',
    related: ['office-bichiku', 'earthquake-office', 'kitaku-konnansha', 'hoikuen-bousai'],
    faq: [
      ['会社の防災備蓄は何日分必要ですか？', 'まずは従業員と来客が待機する時間を想定し、1日分から不足がないか確認します。地域や建物条件で増やします。'],
      ['保存水はどれくらい必要ですか？', '目安として1人1日3Lで計算します。来客や利用者がいる場合は上乗せします。'],
      ['非常食で注意することは？', '保存年数、アレルギー表示、配布しやすさ、食べるために水や加熱が必要かを確認します。']
    ]
  },
  'bcp-stockpile-checklist': {
    audience: '事業所・店舗・施設管理者',
    disasters: ['地震', '台風', '停電', '断水', '帰宅困難者'],
    conclusion: '事業所防災備蓄は、水・食料・簡易トイレ・ライト・電源・衛生・防寒をチェックリスト化して不足を確認します。',
    mustHave: ['保存水', '非常食', '簡易トイレ', 'ライト', '電源', '衛生用品', '防寒用品'],
    problem: '会社や店舗の防災備蓄を、地震、台風、停電、断水、帰宅困難者の観点で漏れなく確認するためのページです。',
    checks: ['人数と日数を入力して目安を見る', '水・トイレ・食料を先に確認', '停電用品と衛生用品を追加', '保管場所と期限管理を決める'],
    avoid: 'チェックリストは目安です。施設運用や業界ルールに関わる備蓄は専門確認を行います。',
    related: ['earthquake-office', 'typhoon-office', 'water-food-stock', 'toilet-office', 'blackout-power'],
    faq: [
      ['事業所の簡易トイレは何回分必要ですか？', '目安として1人1日5回で計算します。利用者や来客がいる場合は上乗せします。'],
      ['会社の防災備蓄は何から確認しますか？', '水、簡易トイレ、非常食、ライト、電源、衛生用品、防寒用品の順で漏れを確認します。'],
      ['チェックリストだけで足りますか？', '目安として使い、建物条件、地域リスク、施設運用、アレルギー対応などは別途確認します。']
    ]
  }
};

const categoryDefinitions = [
  ['小規模オフィス向け防災備蓄', 'office-bichiku', '地震・台風で従業員が待機する前提の基本備蓄。', ['地震', '台風']],
  ['事業所向け簡易トイレ', 'toilet-office', '断水や排水不可に備える回数ベースの比較。', ['断水', '地震']],
  ['台風・大雨対策', 'typhoon-office', '停電・浸水前に確認したい電源と待機用品。', ['台風', '停電']],
  ['地震対策', 'earthquake-office', '水・トイレ・食料・防寒を優先する備蓄導線。', ['地震']],
  ['停電対策', 'blackout-power', 'スマホ、照明、通信機器の電源確保。', ['停電', '台風']],
  ['飲食店向け断水対策', 'restaurant-dansui', '衛生、トイレ、片付け用水を分けて確認。', ['断水']],
  ['保育園向け防災備蓄', 'hoikuen-bousai', '園児と職員を分けて考える備蓄。', ['地震', '台風']],
  ['介護施設向けポータブル電源', 'portable-power-kaigo', '見守り、通信、照明の停電対策。', ['停電']],
  ['帰宅困難者対策', 'kitaku-konnansha', '施設内待機に必要な水・トイレ・防寒。', ['帰宅困難者', '地震']],
  ['保存水・非常食', 'water-food-stock', '人数と日数で不足を防ぐ基本備蓄。', ['地震', '台風']],
  ['衛生用品・感染対策', 'restaurant-dansui', '断水時の手指衛生と片付け用品。', ['断水']],
  ['防寒・睡眠用品', 'kitaku-konnansha', '待機時の体温維持と休息用品。', ['帰宅困難者']],
  ['事業所防災備蓄チェックリスト', 'bcp-stockpile-checklist', '水・食料・トイレ・電源をまとめて点検。', ['BCP', '備蓄']]
];

const topicPages = [
  {
    slug: 'earthquake',
    title: '地震対策の事業所防災用品比較',
    lead: '地震後に会社や店舗で待機する前提で、水、簡易トイレ、食料、防寒、ライトを優先して確認します。',
    chips: ['地震', '水', '簡易トイレ', '帰宅困難者'],
    links: ['earthquake-office', 'office-bichiku', 'toilet-office', 'kitaku-konnansha', 'hoikuen-bousai'],
    mustHave: ['保存水', '簡易トイレ', '非常食', 'ライト', '防寒用品'],
    faq: [
      ['地震対策で最初に見るものは？', '水、簡易トイレ、ライト、非常食、防寒用品を人数と待機日数で確認するのが現実的です。'],
      ['会社の地震対策は家庭用セットで足りますか？', '人数が増えるため、家庭用セットだけでは不足しやすいです。回数や食数を見て比較してください。']
    ]
  },
  {
    slug: 'typhoon',
    title: '台風・大雨対策の事業所防災用品比較',
    lead: '台風や大雨では、停電、交通停止、浸水前の待機に備え、電源、ライト、水、衛生用品を確認します。',
    chips: ['台風', '大雨', '停電', '待機'],
    links: ['typhoon-office', 'blackout-power', 'portable-power-kaigo', 'office-bichiku', 'kitaku-konnansha', 'restaurant-dansui'],
    mustHave: ['ポータブル電源', 'LEDライト', '保存水', '簡易トイレ', '防水用品'],
    faq: [
      ['台風対策では何を優先しますか？', '停電時の連絡手段、照明、最低限の水とトイレを先に確認します。'],
      ['大雨前に買うものは？', '配送遅延が起きやすいため、直前ではなく平時に保管できる水、ライト、電源を見ておくと安心です。']
    ]
  },
  {
    slug: 'power-outage',
    title: '停電対策の事業所防災用品比較',
    lead: '停電時にスマホ、照明、通信機器、見守り機器を動かすため、容量と出力が分かる電源用品を比較します。',
    chips: ['停電', 'ポータブル電源', '照明', '通信'],
    links: ['blackout-power', 'portable-power-kaigo', 'office-bichiku', 'hoikuen-bousai'],
    mustHave: ['ポータブル電源', '充電ケーブル', 'LEDライト', '乾電池', '延長コード'],
    faq: [
      ['ポータブル電源は容量だけ見ればいいですか？', '容量Whに加えて、使う機器に必要な出力W数、充電方法、保管時の管理も確認します。'],
      ['停電対策で忘れやすいものは？', '充電ケーブル、延長コード、ライト、乾電池、通信手段の確認が抜けやすいです。']
    ]
  },
  {
    slug: 'water-outage',
    title: '断水対策の事業所防災用品比較',
    lead: '断水時は飲料水だけでなく、トイレ、手指衛生、清掃用水、給水容器を分けて確認します。',
    chips: ['断水', 'トイレ', '衛生', '給水'],
    links: ['restaurant-dansui', 'toilet-office', 'water-food-stock', 'office-bichiku'],
    mustHave: ['保存水', '給水タンク', '簡易トイレ', '手指消毒', '使い捨て手袋'],
    faq: [
      ['断水対策で飲料水以外に必要なものは？', '簡易トイレ、手指消毒、給水タンク、清掃用品を分けて確認します。'],
      ['飲食店は何を見ればいいですか？', '営業継続より先に、衛生確保、トイレ対応、片付け用水を切り分けて考えます。']
    ]
  },
  {
    slug: 'commuter-stranding',
    title: '帰宅困難者対策の事業所防災用品比較',
    lead: '交通停止で従業員や来客が施設内に残る前提で、水、トイレ、防寒、スマホ充電を確認します。',
    chips: ['帰宅困難者', '待機', '防寒', '水'],
    links: ['kitaku-konnansha', 'office-bichiku', 'toilet-office', 'blackout-power', 'bcp-stockpile-checklist'],
    mustHave: ['保存水', '非常食', '簡易トイレ', 'アルミブランケット', '充電用品'],
    faq: [
      ['帰宅困難者対策は何人分必要ですか？', '従業員数に加えて、来客や利用者の最大滞在人数を少し見込むと不足しにくくなります。'],
      ['帰宅支援グッズだけで足りますか？', '施設内で安全に待つ時間が発生するため、水、トイレ、防寒、充電も確認します。']
    ]
  }
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
  const compact = String(name || '')
    .replace(/[【】\[\]■◆★☆◎〇○●◇<>＜＞＼／]/g, ' ')
    .replace(/送料無料|ポイント\d+倍|ランキング.{0,10}|セール|最安|激安|お買い物マラソン|スーパーSALE|クーポン|あす楽/g, ' ')
    .replace(/防災グッズ|災害対策|非常時|備蓄用品/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return compact.length > maxLength ? compact.slice(0, maxLength - 1) + '…' : compact;
}

function displayTitle(product, maxLength = 58) {
  const raw = product.titleRaw ? titleShort(product.titleRaw, maxLength) : (product.titleShort || product.name || '');
  return shortName(raw, maxLength);
}

function rawTitle(product) {
  return product.titleRaw || product.name || product.titleShort || '';
}

function extractSpec(product) {
  if (hasAmbiguousToiletQuantity(product)) return '販売ページで回数を選択';
  const name = String(rawTitle(product));
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
  const match = String(rawTitle(product)).match(/(\d{1,2})年保存/);
  return match ? `${match[1]}年` : '要確認';
}

function recommendedType(product, note) {
  const name = String(rawTitle(product));
  if (/トイレ|凝固|汚物|排泄|便/.test(name)) return '断水対策向け';
  if (/電源|Wh|バッテリー|蓄電|ランタン|ライト/.test(name)) return '停電対策向け';
  if (/水|ウォーター|給水/.test(name)) return '長期保存向け';
  if (/食|パン|ご飯|保存食|非常食|アルファ米/.test(name)) return '長期保存向け';
  if (/ブランケット|寝袋|防寒|毛布/.test(name)) return '省スペース向け';
  if (/保育園|子供|こども|幼稚園/.test(name)) return '保育園向け';
  if (/介護|福祉/.test(name)) return '介護施設向け';
  if (/大容量|500回|100回|1000Wh|1500W|業務用|法人|企業/.test(name)) return '大人数向け';
  if (Number(product.price || 0) && Number(product.price || 0) < 5000) return 'コスパ重視';
  return 'まず確認したい候補';
}

function suitedFacility(product, note) {
  const name = String(rawTitle(product));
  if (/法人|企業|事業所|業務用/.test(name)) return '事業所・施設';
  if (/保育園|子供|園児|幼稚園/.test(name)) return '保育園・学校';
  if (/介護|高齢者/.test(name)) return '介護施設';
  if (/トイレ|断水/.test(name)) return '店舗・オフィス';
  return note.audience;
}

function cautionForProduct(product) {
  if (hasAmbiguousToiletQuantity(product)) return '回数と価格は選択肢により変動';
  const name = String(rawTitle(product));
  if (!Number(product.reviewCount || 0)) return 'レビューが少ないため仕様確認';
  if (/送料別途|外直送|見積り/.test(name)) return '送料・納期を確認';
  if (/トイレ|凝固/.test(name)) return '袋・凝固剤の数を確認';
  if (/電源|Wh|バッテリー/.test(name)) return '出力W数と充電管理を確認';
  if (/食|パン|ご飯|保存食/.test(name)) return 'アレルギーと期限を確認';
  return '購入前に最新条件を確認';
}

function recommendationBasis(product) {
  const basis = [];
  if (Number(product.price || 0)) basis.push('価格');
  if (Number(product.reviewAverage || 0)) basis.push('レビュー点数');
  if (Number(product.reviewCount || 0) >= 5) basis.push('レビュー件数');
  if (storageYears(product) !== '要確認') basis.push('保存年数');
  if (extractSpec(product) !== '商品ページで確認') basis.push('容量または回数');
  if (Number(product.relevance || 0) > 60) basis.push('事業所用途との一致度');
  if (product.summary && product.summary.length >= 30) basis.push('商品説明の明確さ');
  return basis.length ? basis.slice(0, 4).join('・') : '要確認';
}

function targetPeople(product) {
  if (hasAmbiguousToiletQuantity(product)) return '販売ページで回数を選択';
  const name = String(rawTitle(product));
  const toilet = name.match(/(\d{2,5})回分/);
  if (toilet) return `約${Math.max(1, Math.floor(Number(toilet[1]) / 5))}人1日分の目安`;
  const people = name.match(/(\d{1,3})人用/);
  if (people) return `${people[1]}人用表記`;
  const meals = name.match(/(\d{1,4})食/);
  if (meals) return `約${Math.max(1, Math.floor(Number(meals[1]) / 3))}人1日分の目安`;
  return '人数入力で確認';
}

function effectiveProducts(page, note, minCount = 8) {
  const own = (page.products || [])
    .map((product) => ({ ...product, relatedCandidate: false }));
  if (own.length >= minCount) return own;

  const seen = new Set(own.map((product) => product.itemCode || product.url || rawTitle(product)));
  const related = [];
  for (const slug of note.related || []) {
    const relatedPage = pageBySlug(slug);
    for (const product of (relatedPage?.products || [])) {
      const key = product.itemCode || product.url || rawTitle(product);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      related.push({ ...product, relatedCandidate: true, relatedFrom: relatedPage.title });
      if (own.length + related.length >= minCount) break;
    }
    if (own.length + related.length >= minCount) break;
  }
  return [...own, ...related];
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
  const socialImage = options.ogImage ? `<meta property="og:image" content="${esc(options.ogImage)}"><meta name="twitter:image" content="${esc(options.ogImage)}">` : '';
  const breadcrumb = crumbs.length ? `<nav class="breadcrumb" aria-label="パンくず"><a href="${siteUrl}/">ホーム</a>${crumbs.map((item) => `<span>/</span><span>${esc(item)}</span>`).join('')}</nav>` : '';
  const affiliateDisclosure = options.hideAffiliateDisclosure ? '' : '<p class="affiliate-disclosure">このサイトにはアフィリエイト広告を含みます。</p>';
  const sharing = options.hideShare ? '' : shareSection(title, canonical);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | 事業所防災ナビ</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="事業所防災ナビ">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:title" content="${esc(title)} | 事業所防災ナビ">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
${socialImage}
  <meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${esc(title)} | 事業所防災ナビ">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="theme-color" content="#0e3d49">
  ${analyticsHead()}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap">
  <style>
    /* Hallmark · genre: procurement field guide · tone: calm, exacting, trustworthy · anchor: deep teal ink on kinari paper with persimmon accent · type: Shippori Mincho B1 display over Zen Kaku Gothic New text · structure: editorial catalogue ruled by warm hairlines */
    :root{color-scheme:light;
      --paper:#f4efe3;--paper-2:#ece4d0;--card:#fdfbf4;
      --ink:#222d30;--ink-2:#39494d;--muted:#5b6763;
      --main:#0e3d49;--main-2:#0f5a50;
      --accent:#d4711c;--accent-deep:#9d4d06;--accent-soft:#f8e7cf;
      --rule:#d9d0ba;--rule-2:#c3b795;--teal-soft:#e3ebe2;
      --shadow:0 12px 30px rgba(34,45,48,.07);
      --font-body:"Zen Kaku Gothic New","Yu Gothic","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;
      --font-display:"Shippori Mincho B1","Yu Mincho","Hiragino Mincho ProN",serif}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth;overflow-x:clip}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--font-body);font-size:16px;line-height:1.8;overflow-x:clip}
    body::before{content:"";position:fixed;top:0;left:0;right:0;height:5px;z-index:60;background:linear-gradient(90deg,var(--main) 0 62%,var(--main-2) 62% 82%,var(--accent) 82% 100%)}
    body::after{content:"";position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.5;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.045'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
    main{position:relative;z-index:2;max-width:1240px;margin:0 auto;padding:26px 20px 64px}
    ::selection{background:var(--main);color:#fdfbf4}
    a{color:var(--main-2)}
    :focus-visible{outline:3px solid var(--accent);outline-offset:2px}
    img{max-width:100%}
    h1,h2,h3{overflow-wrap:anywhere;min-width:0}
    h1{font-family:var(--font-display);font-weight:800;font-feature-settings:"palt";letter-spacing:.01em;font-size:clamp(34px,5vw,58px);line-height:1.22;margin:0 0 16px}
    h2{font-family:var(--font-display);font-weight:700;font-feature-settings:"palt";letter-spacing:.01em;font-size:clamp(22px,2.4vw,27px);line-height:1.42;margin:0 0 12px;color:var(--ink)}
    h3{font-size:17.5px;font-weight:900;line-height:1.5;margin:0 0 8px}
    .section>h2::before,.section-title h2::before{content:"";display:inline-block;width:11px;height:11px;background:var(--accent);margin-right:12px;transform:translateY(-2px) rotate(45deg)}
    .lead{font-size:17.5px;max-width:860px;color:var(--ink-2)}
    .muted,.notice{color:var(--muted)}
    .notice{font-size:13px}
    .eyebrow{font-size:12.5px;font-weight:900;letter-spacing:.14em;color:var(--accent-deep);margin:0 0 8px}
    .section{margin-top:34px}
    .section-title{display:flex;justify-content:space-between;gap:14px;align-items:end;margin-bottom:14px}
    #quantity,#disasters,#popular,#categories,#comparison,#related,#conclusion,#products,#faq{scroll-margin-top:24px}

    /* header / footer */
    .site-head{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:14px 0 13px;border-bottom:1px solid var(--rule);margin-bottom:0}
    .brand{display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:800;font-size:21px;letter-spacing:.06em;text-decoration:none;color:var(--main)}
    .brand::before{content:"備";display:grid;place-items:center;width:32px;height:32px;flex:none;background:var(--main);color:#f6f1e2;font-size:17px;font-weight:700;border-radius:4px;box-shadow:2px 2px 0 var(--accent)}
    .nav{display:flex;gap:16px;flex-wrap:wrap}
    .nav a{font-size:14px;font-weight:700;text-decoration:none;color:var(--ink-2);padding:5px 0}
    .nav a:hover{color:var(--main);text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:6px}
    .breadcrumb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0 2px;color:var(--muted);font-size:12.5px}
    .breadcrumb a{text-decoration:none;color:var(--muted)}
    .breadcrumb a:hover{color:var(--main)}
    .site-footer{border-top:1px solid var(--rule);margin-top:52px;padding:18px 0 0;color:var(--muted);font-size:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .site-footer a{color:var(--muted);text-decoration:none}
    .site-footer nav{display:flex;gap:14px;flex-wrap:wrap}
    .affiliate-disclosure{margin:10px 0 0;color:var(--muted);font-size:12px}

    /* primitives */
    .button{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:48px;padding:12px 20px;background:var(--main);color:#fdfbf4;border-radius:4px;text-decoration:none;font-weight:700;letter-spacing:.03em;box-shadow:inset 0 -2px 0 rgba(0,0,0,.22);transition:transform .18s ease,filter .18s ease}
    .button::after{content:"→";font-weight:400;transition:transform .18s ease}
    .button:hover{transform:translateY(-1px);filter:brightness(1.06)}
    .button:hover::after{transform:translateX(3px)}
    .button.orange{background:var(--accent)}
    .button.secondary{background:transparent;color:var(--main-2);box-shadow:none;padding-inline:6px;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:5px}
    .button.secondary:hover{color:var(--accent-deep)}
    a.button[target="_blank"]::after{content:"↗"}
    .small-button{display:inline-flex;align-items:center;gap:.4em;min-height:36px;padding:7px 12px;border-radius:3px;background:var(--main-2);color:#fdfbf4;text-decoration:none;font-weight:700;font-size:13.5px;white-space:nowrap;box-shadow:inset 0 -2px 0 rgba(0,0,0,.2);transition:transform .18s ease,filter .18s ease}
    .small-button:hover{transform:translateY(-1px);filter:brightness(1.08)}
    .chip-row{display:flex;gap:9px;flex-wrap:wrap}
    .chip,.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:13px;font-weight:700;text-decoration:none}
    .chip{background:var(--card);color:var(--main);border:1px solid var(--rule-2);border-radius:999px;transition:border-color .18s ease,background .18s ease}
    .chip:hover{border-color:var(--accent);background:#fff}
    .chip.active{background:var(--accent-soft);border:1px solid #e2b071;color:var(--accent-deep)}
    .pill{font-size:12.5px;border-radius:3px;padding:4px 10px;background:var(--teal-soft);color:var(--main);border:1px solid #c8d6c9}
    .pill.orange{background:var(--accent-soft);border-color:#e8bc80;color:var(--accent-deep)}
    .pill.navy{background:var(--teal-soft);color:var(--main)}
    .card{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:24px;box-shadow:var(--shadow)}
    .card h2 a,.card h3 a{text-decoration:none;color:var(--ink)}
    .card h2 a:hover,.card h3 a:hover{text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:4px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}
    .two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}
    .search-box{display:grid;grid-template-columns:1fr auto;gap:8px}
    .search-box input{min-height:48px;border:1px solid var(--rule-2);border-radius:4px;padding:0 14px 0 42px;font-size:16px;font-family:var(--font-body);background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%230e3d49' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.8-3.8'/%3E%3C/svg%3E") 14px 50% no-repeat}
    .search-box input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(212,113,28,.18)}

    /* home hero */
    .home-hero{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(360px,.78fr);align-items:stretch;border-bottom:1px solid var(--rule)}
    .hero-main{padding:56px 46px 46px 2px}
    .hero-main .hero-kicker{display:inline-flex;align-items:center;gap:10px;margin:0 0 18px;padding:0 0 6px;border-bottom:3px solid var(--accent);font-size:13.5px;font-weight:900;letter-spacing:.16em;color:var(--main)}
    .hero-main h1{font-size:clamp(38px,5.2vw,62px);line-height:1.18;max-width:800px;margin-bottom:18px;word-break:keep-all}
    .hero-main h1 span{color:var(--main);background:linear-gradient(transparent 70%,rgba(212,113,28,.26) 70%)}
    .hero-main .hero-sub{font-size:clamp(17px,1.7vw,21px);line-height:1.85;font-weight:500;color:var(--ink-2);max-width:700px;margin:0 0 14px}
    .hero-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:22px}
    .search-compact{max-width:700px;margin-top:24px}
    .hero-stats{display:flex;gap:26px;flex-wrap:wrap;margin-top:20px;padding-top:14px;border-top:1px solid var(--rule)}
    .hero-stats span{color:var(--muted);font-size:12px}
    .hero-stats strong{font-family:var(--font-display);font-weight:700;color:var(--main);font-size:17px;margin-right:6px}

    /* home hero shelf */
    .hero-shopping{padding:32px 24px 26px;border-left:1px solid var(--rule);background:var(--paper-2)}
    .shopping-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-bottom:1px solid var(--rule-2);padding-bottom:10px;margin-bottom:14px}
    .shopping-head strong{font-family:var(--font-display);font-weight:700;font-size:20px;color:var(--main)}
    .shopping-head span{color:var(--muted);font-size:12px}
    .showcase-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(0,.82fr);grid-template-rows:1fr 1fr;gap:14px 18px}
    .showcase-card{display:grid;grid-template-columns:94px 1fr;gap:12px;align-items:center;padding:0 0 13px;border-bottom:1px solid var(--rule-2);text-decoration:none;color:var(--ink)}
    .showcase-card:first-child{grid-row:span 2;grid-template-columns:1fr;grid-template-rows:250px auto auto;align-items:start;padding:0 18px 0 0;border-bottom:0;border-right:1px solid var(--rule-2)}
    .showcase-card img{width:100%;height:94px;object-fit:contain;background:#fff;border:1px solid var(--rule);transition:transform .25s ease}
    .showcase-card:first-child img{height:250px}
    .showcase-card:hover img{transform:scale(1.03)}
    .showcase-card span{font-size:13.5px;font-weight:700;line-height:1.55}
    .showcase-card:hover span{text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:4px}
    .showcase-card em{font-style:normal;font-size:12.5px;font-weight:700;color:var(--accent-deep);text-decoration:underline;text-underline-offset:3px;width:max-content;max-width:100%;white-space:nowrap}
    .showcase-card em::after{content:" →"}
    .shopping-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:26px;border-top:1px solid var(--rule-2);border-bottom:1px solid var(--rule-2)}
    .shopping-checks div{padding:12px 12px;border-left:1px solid var(--rule-2)}
    .shopping-checks div:first-child{border-left:0}
    .shopping-checks strong{display:block;color:var(--main);font-size:15px}
    .shopping-checks span{display:block;font-size:12px;color:var(--muted)}

    /* home: numbered decision strip */
    .decision-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid var(--rule);counter-reset:step}
    .decision-strip div{position:relative;padding:20px 18px 20px 66px;border-left:1px solid var(--rule);counter-increment:step}
    .decision-strip div:first-child{border-left:0;padding-left:52px}
    .decision-strip div::before{content:"0" counter(step);position:absolute;left:18px;top:16px;font-family:var(--font-display);font-weight:700;font-size:26px;color:var(--accent);line-height:1}
    .decision-strip div:first-child::before{left:4px}
    .decision-strip strong{display:block;color:var(--main);font-size:16px}
    .decision-strip span{display:block;color:var(--muted);font-size:13px;margin-top:3px}

    /* home: route board */
    .route-board{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(0,1.28fr);gap:40px;padding-top:6px}
    .route-board .desk-note{padding:0}
    .desk-note h2{font-size:clamp(24px,2.6vw,30px);color:var(--main)}
    .desk-note p{margin:0 0 14px;color:var(--ink-2)}
    .desk-note small{display:block;color:var(--muted);font-size:12.5px}
    .route-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 26px}
    .route-tile{position:relative;display:grid;grid-template-columns:82px 1fr;gap:14px;align-items:center;padding:14px 30px 14px 0;border-bottom:1px solid var(--rule);text-decoration:none;color:var(--ink)}
    .route-tile img{width:82px;height:82px;object-fit:contain;background:#fff;border:1px solid var(--rule);transition:transform .25s ease}
    .route-tile strong{display:block;color:var(--main);font-size:17.5px}
    .route-tile>span span{display:block;color:var(--muted);font-size:13px}
    .route-tile::after{content:"→";position:absolute;right:4px;top:50%;transform:translateY(-50%);color:var(--rule-2);font-size:18px;transition:transform .2s ease,color .2s ease}
    .route-tile:hover::after{transform:translate(4px,-50%);color:var(--accent)}
    .route-tile:hover img{transform:scale(1.04)}
    .route-tile:hover strong{text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:2px;text-underline-offset:4px}

    /* home: proof + starter + strip */
    .split-proof{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:32px;align-items:start;padding:32px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
    .split-proof h2{font-size:clamp(23px,2.5vw,28px)}
    .split-proof p{font-size:16.5px;color:var(--ink-2);margin:0}
    .proof-list{display:grid;gap:0;margin:0;padding:0;list-style:none}
    .proof-list div{display:grid;grid-template-columns:150px 1fr;gap:16px;border-bottom:1px solid var(--rule);padding:12px 0}
    .proof-list div:last-child{border-bottom:0}
    .proof-list strong{color:var(--main)}
    .proof-list span{color:var(--muted)}
    .starter-grid{display:grid;grid-template-columns:1fr;border-top:1px solid var(--rule)}
    .starter-card{display:grid;grid-template-columns:118px minmax(0,1fr);gap:16px;align-items:center;padding:16px 0;border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent;box-shadow:none}
    .starter-card img{width:118px;height:104px;object-fit:contain;background:#fff;border:1px solid var(--rule);padding:7px}
    .starter-card h3{margin-bottom:4px;font-family:var(--font-display);font-weight:700;font-size:19px}
    .starter-card .pill{border:0;border-radius:0;padding:0;background:transparent;color:var(--accent-deep);letter-spacing:.06em;font-size:12px}
    .starter-card .pill::before{content:"";display:inline-block;width:8px;height:8px;background:var(--accent);transform:rotate(45deg)}
    .starter-card .small-button{margin-top:8px}
    .check-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
    .check-strip div{padding:16px 17px;border-left:1px solid var(--rule)}
    .check-strip div:first-child{border-left:0}
    .check-strip strong{display:block;color:var(--main);font-family:var(--font-display);font-weight:700;font-size:18px}
    .check-strip span{display:block;color:var(--muted);font-size:13px}

    /* home: popular + categories editorial rows */
    #popular .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 30px;border-top:1px solid var(--rule)}
    #popular .popular-card{padding:16px 0;border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent;box-shadow:none}
    #popular .pill{border:0;border-radius:0;padding:0;background:transparent;color:var(--accent-deep);font-size:12px;letter-spacing:.06em}
    #categories .grid{gap:0 26px;border-top:1px solid var(--rule)}
    #categories .category-card{padding:16px 0;border:0;border-bottom:1px solid var(--rule);border-radius:0;background:transparent;box-shadow:none}
    .category-card{display:flex;flex-direction:column;gap:9px}
    .category-card p{margin:0;color:var(--ink-2);font-size:14.5px}
    .category-card .count{margin-top:auto;color:var(--muted);font-size:12.5px}
    .popular-card h3,.category-card h3{font-family:var(--font-display);font-weight:700;font-size:19px}

    /* worksheet calculator */
    .calc-card{border:1px solid var(--rule-2);background:var(--card);background-image:repeating-linear-gradient(0deg,rgba(14,61,73,.045) 0 1px,transparent 1px 26px),repeating-linear-gradient(90deg,rgba(14,61,73,.045) 0 1px,transparent 1px 26px)}
    .calc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .calc-grid label{display:grid;gap:6px;font-weight:700;font-size:14px}
    .calc-input{min-height:46px;border:1px solid var(--rule-2);border-radius:4px;padding:0 12px;font-size:17px;font-family:var(--font-body);font-weight:700;color:var(--main);background:#fff}
    .calc-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(212,113,28,.18)}
    .estimate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
    .estimate-grid div{background:#fff;border:1px solid var(--rule);border-radius:4px;padding:14px}
    .estimate-grid span,.estimate-grid small{display:block;color:var(--muted)}
    .estimate-grid span{font-size:12.5px;font-weight:700;letter-spacing:.08em}
    .estimate-grid strong{display:block;font-family:var(--font-display);font-weight:700;font-size:30px;line-height:1.3;color:var(--main)}
    .estimate-grid small{font-size:11.5px}

    /* faq */
    .faq details{border-bottom:1px solid var(--rule);padding:15px 2px}
    .home-faq{border-top:1px solid var(--rule);padding-top:30px}
    .faq summary{position:relative;font-weight:700;font-size:16.5px;cursor:pointer;list-style:none;padding-right:36px;color:var(--ink)}
    .faq summary::-webkit-details-marker{display:none}
    .faq summary::after{content:"+";position:absolute;right:6px;top:50%;transform:translateY(-50%);font-family:var(--font-display);font-size:24px;font-weight:600;color:var(--accent);transition:transform .25s ease}
    .faq details[open] summary::after{transform:translateY(-50%) rotate(45deg)}
    .faq details p{margin:10px 0 2px;color:var(--ink-2);max-width:860px}

    /* final note */
    .final-note{border-radius:4px}
    .final-note p{color:var(--ink-2)}
    .ad-note{font-size:12px;color:var(--muted);border-top:1px solid var(--rule);padding-top:14px}

    /* subpage: hero */
    .hero{padding:38px 2px 26px;border-bottom:1px solid var(--rule)}
    .hero h1{font-size:clamp(29px,4.4vw,46px);max-width:900px}
    .hero-meta{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}
    .hero-product{display:grid;gap:8px}
    .hero-product img{width:100%;height:96px;object-fit:contain;background:#fff;border:1px solid var(--rule)}
    .hero-product span{font-size:12px;font-weight:700;line-height:1.5}

    /* subpage: lists and steps */
    .checklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:14px 0 0;padding:0;list-style:none}
    .checklist li{background:#fff;border:1px solid var(--rule);border-radius:4px;padding:11px 14px 11px 38px;position:relative;font-size:14.5px}
    .checklist li::before{content:"✓";position:absolute;left:14px;top:10px;color:var(--accent-deep);font-weight:900}
    .steps{counter-reset:step;display:grid;gap:10px;margin:0;padding:0;list-style:none}
    .steps li{counter-increment:step;padding:12px 14px 12px 16px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 4px 4px 0;font-size:14.5px}
    .steps li::before{content:counter(step) ".";font-family:var(--font-display);font-weight:700;color:var(--accent-deep);margin-right:8px}

    /* subpage: compare table */
    .compare-scroll{overflow-x:auto;border:1px solid var(--rule-2);border-radius:4px;background:#fff}
    .compare-table{width:100%;min-width:980px;border-collapse:collapse}
    .compare-table th,.compare-table td{padding:11px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
    .compare-table th{background:var(--main);color:#f2ede0;font-size:12.5px;font-weight:700;letter-spacing:.04em;white-space:nowrap}
    .compare-table td{font-size:14px}
    .compare-table tbody tr:nth-child(even){background:rgba(14,61,73,.035)}
    .compare-table tr:last-child td{border-bottom:0}
    .table-product{font-weight:700;max-width:260px;overflow-wrap:anywhere}

    /* subpage: product cards */
    .product-list{display:grid;gap:14px}
    .product{display:grid;grid-template-columns:150px 1fr;gap:20px;align-items:start}
    .product-img{width:150px;height:150px;object-fit:contain;background:#fff;border:1px solid var(--rule);border-radius:4px;padding:8px}
    .product-img.placeholder{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px;background:var(--paper)}
    .product h2{font-size:19px;font-family:var(--font-body);font-weight:900;overflow-wrap:anywhere;margin-bottom:6px}
    .summary{margin:8px 0;color:var(--ink-2);font-size:14.5px}
    .price{font-family:var(--font-display);font-size:26px;font-weight:700;color:var(--main);margin:8px 0}
    .facts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    .fact{border:1px solid var(--rule);border-radius:999px;padding:3px 11px;font-size:12.5px;background:var(--card);color:var(--ink-2)}
    .spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:12px 0 14px}
    .spec-grid div{background:var(--paper);border:1px solid var(--rule);border-radius:4px;padding:9px 10px}
    .spec-grid span{display:block;font-size:11.5px;color:var(--muted);letter-spacing:.04em}
    .spec-grid strong{display:block;color:var(--ink);font-size:13.5px;line-height:1.5}
    .empty{border:1px dashed var(--rule-2);background:var(--accent-soft)}

    /* subpage: related links + cards */
    .link-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
    .link-list a{position:relative;background:var(--card);border:1px solid var(--rule);border-radius:4px;padding:13px 34px 13px 14px;text-decoration:none;font-weight:700;font-size:14.5px;color:var(--main);transition:border-color .18s ease,transform .18s ease}
    .link-list a::after{content:"→";position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--rule-2);transition:color .18s ease}
    .link-list a:hover{border-color:var(--accent);transform:translateY(-1px)}
    .link-list a:hover::after{color:var(--accent)}
    .scenario-card{display:grid;grid-template-columns:74px 1fr;gap:12px;align-items:center}
    .scenario-card img{width:74px;height:74px;object-fit:contain;background:#fff;border:1px solid var(--rule);border-radius:4px;padding:6px}
    .lane-card{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:center}
    .lane-card img{width:92px;height:92px;object-fit:contain;background:#fff;border:1px solid var(--rule);border-radius:4px;padding:7px}

    /* page jump nav + buying flow + stock check + share */
    .jump-nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--rule)}
    .jump-nav span{font-size:12px;font-weight:900;letter-spacing:.1em;color:var(--muted);margin-right:2px}
    .decision-strip.flow{grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule)}
    .share-bar{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-top:44px;padding:16px 2px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
    .share-bar strong{font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--main);margin-right:10px}
    .share-buttons{display:flex;gap:8px;flex-wrap:wrap}
    .share-buttons a,.share-buttons button{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 15px;border:1px solid var(--rule-2);border-radius:999px;background:var(--card);color:var(--main);font-family:var(--font-body);font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;transition:border-color .18s ease,transform .18s ease,background .18s ease}
    .share-buttons a::before,.share-buttons button::before{content:"";width:7px;height:7px;flex:none;background:var(--accent);transform:rotate(45deg)}
    .share-buttons a:hover,.share-buttons button:hover{border-color:var(--accent);transform:translateY(-1px)}
    .share-buttons button.copied{background:var(--accent-soft);border-color:#e2b071;color:var(--accent-deep)}
    .fill-list strong{display:block;color:var(--main);font-size:15px}
    .fill-list .sub{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-top:2px}

    /* primary sources */
    .source-references{padding:28px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
    .source-references .source-intro{max-width:760px;color:var(--ink-2);margin:0}
    .source-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0 24px;margin:18px 0 0;padding:0;list-style:none;border-top:1px solid var(--rule)}
    .source-list li{padding:15px 0;border-bottom:1px solid var(--rule)}
    .source-list a{display:inline;font-weight:700;color:var(--main);text-decoration-thickness:1px;text-underline-offset:4px}
    .source-list span,.source-list small{display:block}
    .source-list span{margin-top:4px;color:var(--muted);font-size:12px}
    .source-list small{margin-top:7px;color:var(--ink-2);font-size:13px;line-height:1.65}

    /* entrance */
    @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .hero-main>*,.hero>*{animation:rise .55s ease both}
    .hero-main>:nth-child(2),.hero>:nth-child(2){animation-delay:.06s}
    .hero-main>:nth-child(3),.hero>:nth-child(3){animation-delay:.12s}
    .hero-main>:nth-child(4),.hero>:nth-child(4){animation-delay:.18s}
    .hero-main>:nth-child(5),.hero>:nth-child(5){animation-delay:.24s}
    .hero-main>:nth-child(6){animation-delay:.3s}
    .hero-shopping{animation:rise .55s ease .2s both}
    @media (prefers-reduced-motion:reduce){*,::before,::after{animation:none!important;transition:none!important}html{scroll-behavior:auto}}

    @media(min-width:761px) and (max-width:900px){
      .home-hero{grid-template-columns:1fr}
      .hero-main{padding:44px 8px 34px}
      .hero-shopping{border-left:0;border-top:1px solid var(--rule)}
      .route-board,.split-proof{grid-template-columns:1fr;gap:20px}
      .hero-main h1{max-width:680px}
    }
    @media(max-width:760px){
      main{padding:14px 14px 48px;max-width:100%}
      body::before{height:4px}
      .site-head{align-items:flex-start;flex-direction:column;gap:8px}
      .nav{gap:12px}
      .nav a,.button,.small-button{white-space:nowrap}
      .home-hero{grid-template-columns:1fr}
      .hero-main{padding:30px 2px 28px}
      .hero-main h1{font-size:clamp(30px,8.6vw,38px);line-height:1.24;word-break:keep-all;overflow-wrap:anywhere}
      .hero-main .hero-sub{font-size:16.5px;line-height:1.75}
      .hero-actions{margin-top:18px}
      .hero-actions .button{width:100%}
      .hero-actions .button.secondary{width:auto}
      .hero-stats{gap:14px}
      .search-box{grid-template-columns:1fr}
      .hero-shopping{padding:22px 4px;border-left:0;border-top:1px solid var(--rule)}
      .shopping-head{display:grid;gap:2px}
      .showcase-grid{grid-template-columns:1fr 1fr;grid-template-rows:auto}
      .showcase-card{grid-template-columns:1fr;grid-template-rows:112px auto auto;align-items:start;padding:0;border-bottom:0}
      .showcase-card:first-child{grid-column:1/-1;grid-row:auto;grid-template-columns:112px 1fr;grid-template-rows:auto auto;padding:0 0 14px;border-right:0;border-bottom:1px solid var(--rule-2)}
      .showcase-card:first-child img{grid-row:span 2}
      .showcase-card img,.showcase-card:first-child img{height:112px}
      .showcase-card em{white-space:normal}
      .decision-strip{grid-template-columns:1fr}
      .decision-strip div{border-left:0;border-top:1px solid var(--rule);padding-left:56px}
      .decision-strip div:first-child{border-top:0;padding-left:56px}
      .decision-strip div::before,.decision-strip div:first-child::before{left:8px}
      .route-board,.split-proof{grid-template-columns:1fr;gap:18px}
      .route-tiles{grid-template-columns:1fr}
      .route-tile{grid-template-columns:70px 1fr}
      .route-tile img{width:70px;height:70px}
      .proof-list div{grid-template-columns:1fr;gap:2px}
      .check-strip{grid-template-columns:1fr 1fr}
      .check-strip div{border-top:1px solid var(--rule)}
      .check-strip div:nth-child(-n+2){border-top:0}
      .check-strip div:nth-child(odd){border-left:0}
      .starter-card{grid-template-columns:92px minmax(0,1fr);gap:12px}
      .starter-card img{width:92px;height:88px}
      #popular .grid{grid-template-columns:1fr}
      .section-title{display:block}
      .decision-strip.flow{grid-template-columns:1fr}
      .share-bar{flex-direction:column;align-items:flex-start;gap:10px}
      .jump-nav{gap:6px}
      .source-list{grid-template-columns:1fr}
      .two{grid-template-columns:1fr}
      .estimate-grid{grid-template-columns:1fr 1fr}
      .hero{padding:26px 2px 20px}
      .hero h1{font-size:clamp(26px,7.6vw,34px)}
      .lead{font-size:16px}
      .scenario-card{grid-template-columns:72px 1fr}
      .scenario-card img{width:72px;height:72px}
      .lane-card{grid-template-columns:82px 1fr}
      .lane-card img{width:82px;height:82px}
      .product{grid-template-columns:104px 1fr;gap:12px}
      .product-img{width:104px;height:104px}
      .product h2{font-size:17px}
      .card{padding:18px}
    }
  </style>
</head>
<body><main><header class="site-head"><a class="brand" href="${siteUrl}/">事業所防災ナビ</a><nav class="nav"><a href="${siteUrl}/#disasters">災害別</a><a href="${siteUrl}/#categories">カテゴリ</a><a href="${siteUrl}/#quantity">人数別目安</a><a href="${siteUrl}/#popular">よく使う比較</a></nav></header>${affiliateDisclosure}${breadcrumb}${body}${sharing}${siteFooter()}${clientScript()}</main></body>
</html>`;
}

function analyticsHead() {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${gaMeasurementId}');
  </script>`;
}

function siteFooter() {
  return `<footer class="site-footer"><span>© 2026 事業所防災ナビ / 運営者: 村上 誠治</span><nav aria-label="運営情報"><a href="${siteUrl}/site-policy.html">運営情報・広告掲載・プライバシー</a></nav></footer>`;
}

function shareSection(title, canonical) {
  const shareUrl = encodeURIComponent(canonical);
  const shareText = encodeURIComponent(`${title} | 事業所防災ナビ`);
  return `<section class="share-bar" aria-label="このページを共有">
    <div><strong>このページを共有</strong><span class="notice">備蓄の相談や社内での検討にそのまま使えます</span></div>
    <div class="share-buttons">
      <a href="https://twitter.com/intent/tweet?text=${shareText}&amp;url=${shareUrl}" target="_blank" rel="noopener" data-share="x">Xで共有</a>
      <a href="https://social-plugins.line.me/lineit/share?url=${shareUrl}" target="_blank" rel="noopener" data-share="line">LINEで送る</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" data-share="facebook">Facebookで共有</a>
      <button type="button" data-copy-url="${esc(canonical)}">リンクをコピー</button>
    </div>
  </section>`;
}

const stockCoreLinks = [
  { slug: 'toilet-office', label: '簡易トイレ', point: '1人1日5回 × 人数 × 日数で確認' },
  { slug: 'water-food-stock', label: '保存水・非常食', point: '水3L・3食 × 人数 × 日数で確認' },
  { slug: 'blackout-power', label: '停電対策・電源', point: '使う機器の出力と時間から逆算' },
  { slug: 'kitaku-konnansha', label: '防寒・待機用品', point: '毛布・保温シートは1人1枚が目安' },
  { slug: 'restaurant-dansui', label: '衛生・断水対策', point: '手指衛生と片付け用の水を分ける' }
];

function stockCheckSection(currentSlug) {
  const links = stockCoreLinks
    .filter((item) => item.slug !== currentSlug && pageBySlug(item.slug))
    .map((item) => `<a href="${siteUrl}/pages/${item.slug}.html"><strong>${esc(item.label)}</strong><span class="sub">${esc(item.point)}</span></a>`)
    .join('');
  if (!links) return '';
  return `<section class="section"><div class="section-title"><div><p class="eyebrow">揃え漏れチェック</p><h2>あわせて確認したい備蓄</h2></div><p class="notice">水・食料・トイレ・電源・防寒に漏れがないかを確認</p></div><div class="link-list fill-list">${links}</div></section>`;
}

function sourceKeysFor(slug = '') {
  if (/toilet|dansui|water-outage/.test(slug)) return ['toiletGuideline', 'workplaceGuideline', 'stockpilePortal'];
  if (/portable-power|blackout|power-outage|typhoon/.test(slug)) return ['workplaceGuideline', 'stockpilePortal'];
  return ['workplaceGuideline', 'toiletGuideline', 'stockpilePortal'];
}

function sourceUrlsFor(slug = '') {
  return sourceKeysFor(slug).map((key) => publicSources[key].url);
}

function sourceSection(slug = '') {
  const items = sourceKeysFor(slug).map((key) => {
    const source = publicSources[key];
    return `<li><a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a><span>${esc(source.publisher)}</span><small>${esc(source.note)}</small></li>`;
  }).join('');
  return `<section class="section source-references" aria-labelledby="public-sources-title">
    <div class="section-title"><div><p class="eyebrow">公的資料</p><h2 id="public-sources-title">数量・備蓄期間を決めるときの根拠</h2></div></div>
    <p class="source-intro">3日分、水量、食数、トイレや毛布の考え方を確認できる公的資料です。地域、建物、施設運用によって必要量は変わるため、自治体や施設の計画とあわせて確認してください。</p>
    <ul class="source-list">${items}</ul>
  </section>`;
}

function clientScript() {
  return `<script>
    (function(){
      function trackEvent(name, params){
        if(typeof window.gtag !== 'function') return;
        window.gtag('event', name, Object.assign({
          page_path: window.location.pathname,
          page_title: document.title
        }, params || {}));
      }
      function cleanText(value){ return String(value || '').replace(/\\s+/g,' ').trim().slice(0,120); }
      function anchorText(anchor){ return cleanText(anchor.getAttribute('aria-label') || anchor.textContent || anchor.href); }
      function ctaLocation(anchor){
        if(anchor.closest('.compare-scroll')) return 'comparison_table';
        if(anchor.closest('.quick-picks')) return 'quick_pick';
        if(anchor.closest('.product')) return 'product_card';
        if(anchor.classList.contains('hero-product')) return 'hero_product';
        if(anchor.classList.contains('showcase-card')) return 'showcase_card';
        return 'affiliate_link';
      }
      function productParams(anchor){
        return {
          product_id: cleanText(anchor.dataset.productId || anchor.dataset.productName),
          product_name: cleanText(anchor.dataset.productName || anchor.closest('.product,.showcase-card,.hero-product')?.textContent || anchorText(anchor)),
          product_price: Number(anchor.dataset.productPrice || 0),
          product_category: anchor.dataset.productCategory || '',
          product_position: Number(anchor.dataset.productPosition || 0),
          cta_location: ctaLocation(anchor),
          link_text: anchorText(anchor),
          destination: anchor.href
        };
      }
      function ecommerceItem(params){
        return {
          item_id: params.product_id || params.product_name,
          item_name: params.product_name,
          item_category: params.product_category,
          item_list_name: params.cta_location,
          index: params.product_position ? params.product_position - 1 : undefined,
          price: params.product_price || undefined
        };
      }
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
      var quantityTracked=false;
      ['staffCount','daysCount','visitorCount'].forEach(function(id){
        var el=document.getElementById(id);
        if(el) el.addEventListener('change', function(){
          if(quantityTracked) return;
          quantityTracked=true;
          trackEvent('quantity_calculator_use', {
            staff_count: document.getElementById('staffCount')?.value || '',
            days_count: document.getElementById('daysCount')?.value || '',
            visitor_count: document.getElementById('visitorCount')?.value || ''
          });
        });
      });
      var search=document.getElementById('siteSearch');
      var searchTimer=null;
      function filterCards(value){
        var term=String(value || '').trim().toLowerCase();
        document.querySelectorAll('[data-search-card]').forEach(function(card){
          card.style.display = !term || card.textContent.toLowerCase().indexOf(term) !== -1 ? '' : 'none';
        });
      }
      if(search){
        search.addEventListener('input', function(){
          filterCards(search.value);
          clearTimeout(searchTimer);
          var term=search.value.trim();
          if(term.length >= 2){
            searchTimer=setTimeout(function(){ trackEvent('site_search', { search_term: term }); }, 700);
          }
        });
        var initialTerm='';
        try { initialTerm = new URLSearchParams(window.location.search).get('q') || ''; } catch(e) {}
        if(initialTerm){ search.value=initialTerm; filterCards(initialTerm); }
      }
      var listedProducts=[];
      var listedProductIds={};
      document.querySelectorAll('a[href*="hb.afl.rakuten.co.jp"][data-product-name]').forEach(function(anchor){
        var params=productParams(anchor);
        var key=params.product_id || params.product_name;
        if(!key || listedProductIds[key]) return;
        listedProductIds[key]=true;
        listedProducts.push(ecommerceItem(params));
      });
      if(listedProducts.length){
        trackEvent('view_item_list', {
          currency: 'JPY',
          item_list_name: document.title,
          items: listedProducts.slice(0, 20)
        });
      }
      document.querySelectorAll('[data-copy-url]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var url=btn.getAttribute('data-copy-url');
          var original=btn.textContent;
          function done(){
            btn.classList.add('copied');
            btn.textContent='コピーしました';
            trackEvent('share_click', { share_method: 'copy', destination: url });
            setTimeout(function(){ btn.classList.remove('copied'); btn.textContent=original; }, 1800);
          }
          function fallback(){
            var field=document.createElement('textarea');
            field.value=url;
            field.setAttribute('readonly','');
            field.style.position='fixed';
            field.style.opacity='0';
            document.body.appendChild(field);
            field.select();
            var copied=false;
            try { copied=document.execCommand('copy'); } catch(e) {}
            document.body.removeChild(field);
            if(copied){ done(); return; }
            window.prompt('このページのURLをコピーできます', url);
          }
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(url).then(done).catch(fallback);
          } else {
            fallback();
          }
        });
      });
      document.addEventListener('click', function(event){
        var anchor=event.target.closest && event.target.closest('a');
        if(!anchor || !anchor.href) return;
        var url=anchor.href;
        if(anchor.dataset && anchor.dataset.share){
          trackEvent('share_click', { share_method: anchor.dataset.share, destination: url });
          return;
        }
        if(url.indexOf('hb.afl.rakuten.co.jp') !== -1){
          var params = productParams(anchor);
          trackEvent('select_item', {
            currency: 'JPY',
            item_list_name: params.cta_location,
            items: [ecommerceItem(params)]
          });
          trackEvent('rakuten_click', params);
          return;
        }
        if(url.indexOf('/topics/') !== -1){
          trackEvent('disaster_chip_click', { link_text: anchorText(anchor), destination: url });
          return;
        }
        if(url.indexOf('/pages/') !== -1){
          trackEvent('compare_page_click', { link_text: anchorText(anchor), destination: url });
          return;
        }
        if(url.indexOf('#categories') !== -1){
          trackEvent('category_click', { link_text: anchorText(anchor), destination: url });
        }
      });
    })();
  </script>`;
}

function productTrackingAttrs(product, category = '', position = '') {
  return `data-product-id="${esc(product.itemCode || displayTitle(product))}" data-product-name="${esc(displayTitle(product))}" data-product-price="${esc(product.price || '')}" data-product-category="${esc(category)}" data-product-position="${esc(position)}" data-variable-price="${hasAmbiguousToiletQuantity(product) ? 'true' : 'false'}"`;
}

function displayPrice(product) {
  const price = yen(product.price);
  return hasAmbiguousToiletQuantity(product)
    ? `${price}〜（選択肢で変動）`
    : price;
}

function productJsonLd(products) {
  const graph = products
    .filter((product) => product.name && product.url && !hasAmbiguousToiletQuantity(product))
    .slice(0, 12)
    .map((product) => ({
    '@type': 'Product',
    name: displayTitle(product),
    description: product.summary || undefined,
    image: product.image || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'JPY',
      price: product.price || undefined,
      url: product.url,
      availability: product.availability === 0 ? undefined : 'https://schema.org/InStock'
    },
    aggregateRating: product.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: product.reviewAverage,
      reviewCount: product.reviewCount
    } : undefined
  }));
  return graph.length ? jsonLd({ '@context': 'https://schema.org', '@graph': graph }) : '';
}

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function breadcrumbJsonLd(items) {
  const list = [{ name: 'ホーム', url: `${siteUrl}/` }, ...items].map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url
  }));
  return jsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list });
}

function faqJsonLd(faq) {
  if (!faq || !faq.length) return '';
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a }
    }))
  });
}

function faqItems(note) {
  const common = [
    ['会社の防災備蓄は何日分必要ですか？', 'まずは人数と待機日数を決め、水は1人1日3L、食料は1人1日3食、簡易トイレは1人1日5回を目安に不足を確認します。'],
    ['事業所の簡易トイレは何回分必要ですか？', '目安として1人1日5回で計算します。従業員、来客、利用者がいる場合は上乗せして考えます。'],
    ['台風対策と地震対策で備えるものは違いますか？', '共通する備蓄もありますが、台風では停電や交通停止、地震では断水や帰宅困難者対策を特に確認します。']
  ];
  const merged = [...(note.faq || []), ...common];
  const seen = new Set();
  return merged.filter(([q]) => {
    if (seen.has(q)) return false;
    seen.add(q);
    return true;
  }).slice(0, 5);
}

function itemListJsonLd(products, canonical) {
  const items = products.filter((product) => product.name && product.url).slice(0, 12).map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: product.url,
    name: displayTitle(product)
  }));
  if (!items.length) return '';
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '比較候補',
    url: canonical,
    itemListElement: items
  });
}

function websiteJsonLd() {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '事業所防災ナビ',
    url: `${siteUrl}/`,
    inLanguage: 'ja',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/?q={search_term_string}#categories`,
      'query-input': 'required name=search_term_string'
    }
  });
}

function structuredData(...items) {
  return items.filter(Boolean).join('');
}

function comparisonRows(products, note) {
  if (!products.length) {
    return `<tr><td colspan="10"><strong>条件に合う候補を確認中です。</strong><br>人数、用途、保管場所、必要回数を先に確認し、関連する備蓄品もあわせて見てください。</td></tr>`;
  }
  return products.map((product, index) => `<tr>
    <td class="table-product">${esc(displayTitle(product, 46))}</td>
    <td>${esc(product.relatedCandidate ? '関連候補' : recommendedType(product, note))}</td>
    <td>${esc(displayPrice(product))}</td>
    <td>${esc(product.reviewAverage || '-')}</td>
    <td>${esc(product.reviewCount || 0)}</td>
    <td>${esc(storageYears(product))}</td>
    <td>${esc(extractSpec(product))}</td>
    <td>${esc(targetPeople(product))}</td>
    <td>${esc(suitedFacility(product, note))}</td>
    <td>${esc(product.relatedCandidate ? `関連候補: ${product.relatedFrom || '関連ページ'}から補完` : cautionForProduct(product))}<br><span class="notice">根拠: ${esc(recommendationBasis(product))}</span><br><a class="small-button" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, note.title, index + 1)}>楽天で価格・在庫を確認</a></td>
  </tr>`).join('');
}

function quickPicks(products, note) {
  if (!products.length) return '';
  const clearProducts = products.filter((product) => !hasAmbiguousToiletQuantity(product));
  if (!clearProducts.length) return '';
  const quickPool = clearProducts;
  const selected = [];
  const seenTypes = new Set();
  for (const product of quickPool) {
    const type = product.productType || recommendedType(product, note);
    if (seenTypes.has(type)) continue;
    selected.push(product);
    seenTypes.add(type);
    if (selected.length === 3) break;
  }
  for (const product of quickPool) {
    if (selected.length === 3) break;
    if (!selected.includes(product)) selected.push(product);
  }
  const cards = selected.map((product, index) => `<article class="card product">
    ${product.image ? `<img class="product-img" src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">` : ''}
    <div><p class="pill navy">${esc(recommendedType(product, note))}</p><h2>${esc(displayTitle(product))}</h2>
    <p class="price">${esc(displayPrice(product))}</p><p class="notice">${esc(extractSpec(product))} / レビュー ${esc(product.reviewAverage || '-')}（${esc(product.reviewCount || 0)}件）</p>
    <a class="button orange" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, note.title, index + 1)}>楽天で価格・在庫を確認する</a></div>
  </article>`).join('');
  return `<section class="section quick-picks" aria-labelledby="quick-picks-title"><div class="section-title"><div><p class="eyebrow">先に見る${selected.length}候補</p><h2 id="quick-picks-title">比較条件が読み取りやすい商品</h2></div><p class="notice">価格・仕様は販売ページで最終確認</p></div><div class="product-list">${cards}</div></section>`;
}

function webPageJsonLd(title, description, canonical, citationUrls = []) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: '事業所防災ナビ',
      url: `${siteUrl}/`
    },
    publisher: {
      '@type': 'Person',
      name: '村上 誠治',
      url: `${siteUrl}/`
    },
    citation: citationUrls,
    inLanguage: 'ja',
    dateModified: data.generatedAt || new Date().toISOString()
  });
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
    return `<article class="card empty"><p class="pill orange">候補を確認中</p><h2>条件を広げて確認してください</h2><p>人数、用途、保管場所、必要回数を先に確認し、関連する備蓄品もあわせて見てください。</p></article>`;
  }
  return products.map((product, index) => `<article class="card product">
    ${product.image ? `<img class="product-img" src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">` : '<div class="product-img placeholder" aria-hidden="true">商品画像<br>取得待ち</div>'}
    <div>
      <p class="pill navy">${esc(product.relatedCandidate ? '関連候補' : recommendedType(product, note))}</p>
      <h2>${esc(displayTitle(product))}</h2>
      ${product.relatedCandidate ? `<p class="notice">この商品は「${esc(product.relatedFrom || '関連ページ')}」から補完した関連候補です。用途の一致度は販売ページで確認してください。</p>` : ''}
      ${product.summary ? `<p class="summary">${esc(product.summary)}</p>` : ''}
      <p class="price">${esc(displayPrice(product))}</p>
      <div class="facts">
        <span class="fact">レビュー ${esc(product.reviewAverage || '-')}</span>
        <span class="fact">件数 ${esc(product.reviewCount || 0)}</span>
        <span class="fact">${esc(product.shopName || '楽天市場')}</span>
      </div>
      <div class="spec-grid">
        <div><span>主要スペック</span><strong>${esc(extractSpec(product))}</strong></div>
        <div><span>おすすめ度の根拠</span><strong>${esc(recommendationBasis(product))}</strong></div>
        <div><span>注意点</span><strong>${esc(cautionForProduct(product))}</strong></div>
        <div><span>向いている施設</span><strong>${esc(suitedFacility(product, note))}</strong></div>
      </div>
      <a class="button orange" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, note.title, index + 1)}>楽天で価格・在庫を確認する</a>
    </div>
  </article>`).join('');
}

function faqSection(note) {
  const items = faqItems(note).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  return `<section class="section faq" id="faq"><h2>FAQ</h2>${items}</section>`;
}

function relatedLinks(slugs) {
  const links = (slugs || []).map((slug) => {
    const page = pageBySlug(slug);
    return page ? `<a href="${siteUrl}/pages/${esc(slug)}.html">${esc(page.title)}</a>` : '';
  }).filter(Boolean).join('');
  return `<section class="section"><div class="section-title"><h2>関連ページ</h2><p class="notice">災害別・施設別に続けて確認</p></div><div class="link-list">${links}</div></section>`;
}

function pageDescription(page, note) {
  const disasters = (note.disasters || []).join('、');
  return `${page.title}。${note.conclusion} ${note.problem} 地震、台風、停電、断水、帰宅困難者などの事業所・会社・店舗の防災備蓄を、比較表、選び方、必要数量、FAQで確認できます。`;
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
  const ownProducts = page.products || [];
  const products = effectiveProducts(page, note, 8);
  const canonical = `${siteUrl}/pages/${page.slug}.html`;
  const description = pageDescription(page, note);
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
      ${ownProducts.length < 8 ? '<span class="pill">関連候補を含む</span>' : ''}
      <span class="pill">最終更新: ${esc(updatedDate())}</span>
    </div>
    <nav class="jump-nav" aria-label="ページ内目次">
      <span>このページの流れ</span>
      <a class="chip" href="#conclusion">結論</a>
      <a class="chip" href="#quantity">必要数量</a>
      <a class="chip" href="#comparison">比較表</a>
      <a class="chip" href="#products">商品カード</a>
      <a class="chip" href="#faq">FAQ</a>
    </nav>
  </section>
  <section class="section two" id="conclusion">
    <article class="card"><p class="eyebrow">このページの結論</p><h2>${esc(note.conclusion)}</h2><p>${esc(note.avoid)}</p></article>
    <article class="card"><p class="eyebrow">まず揃えるべきもの</p><div class="chip-row">${mustHave}</div></article>
  </section>
  <section class="section decision-strip flow" aria-label="購入までの流れ">
    <div><strong>人数と日数を決める</strong><span>下の目安計算で必要量を出す</span></div>
    <div><strong>比較表で候補を絞る</strong><span>価格、回数、保存年数で見る</span></div>
    <div><strong>商品カードで確認</strong><span>向き不向きと注意点を見る</span></div>
    <div><strong>販売ページで揃える</strong><span>最新の価格と在庫を確認して購入</span></div>
  </section>
  <section class="section two">
    <article class="card"><h2>選び方</h2><ul class="checklist">${checks}</ul></article>
    <article class="card"><h2>おすすめ分類</h2><ol class="steps"><li>レビュー件数があるもの</li><li>必要量が読み取りやすいもの</li><li>保管期限・容量・回数が明記されているもの</li></ol></article>
  </section>
  ${quantityEstimateSection()}
  ${sourceSection(page.slug)}
  ${['toilet-office', 'blackout-power', 'water-food-stock'].includes(page.slug) ? quickPicks(products, note) : ''}
  ${comparisonTable(products, note)}
  <section class="section" id="products"><div class="section-title"><div><p class="eyebrow">商品カード</p><h2>候補ごとの向き・注意点を見る</h2></div><p class="notice">価格・在庫・レビューは変動します</p></div><div class="product-list">${productCards(products, note)}</div></section>
  ${stockCheckSection(page.slug)}
  <section class="section card"><h2>注意点</h2><p>${esc(requiredNotice)}</p><p>このページの数量計算は目安です。実際には建物の規模、滞在人数、地域リスク、保管場所、自治体や業界ルールに合わせて調整してください。</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。リンク先で購入された場合、サイト運営者に成果報酬が発生することがあります。</p></section>
  ${faqSection(note)}
  ${relatedLinks(note.related)}
  ${structuredData(
    webPageJsonLd(page.title, description, canonical, sourceUrlsFor(page.slug)),
    breadcrumbJsonLd([{ name: page.title, url: canonical }]),
    faqJsonLd(faqItems(note)),
    itemListJsonLd(products, canonical),
    productJsonLd(products)
  )}`;
  return layout(page.title, body, description, canonical, { crumbs: [page.title], ogImage: products.find((product) => product.image)?.image || '' });
}

function topicHtml(topic) {
  const canonical = `${siteUrl}/topics/${topic.slug}.html`;
  const description = `${topic.title}。${topic.lead} 事業所の人数と待機日数から、水、食料、簡易トイレ、停電対策用品の必要量と関連する比較ページを確認できます。`;
  const linkCards = topic.links.map((slug) => {
    const page = pageBySlug(slug);
    if (!page) return '';
    const note = pageNotes[slug] || {};
    const products = effectiveProducts(page, note, 8);
    return `<article class="card category-card">
      <p class="pill orange">${esc(note.disasters ? note.disasters.join('・') : '比較')}</p>
      <h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(page.title)}</a></h3>
      <p>${esc(note.problem || page.keyword)}</p>
      <p class="count">比較候補: ${products.length}件</p>
    </article>`;
  }).join('');
  const mustHave = topic.mustHave.map((item) => `<span class="pill orange">${esc(item)}</span>`).join('');
  const chips = topic.chips.map((item) => `<span class="chip active">${esc(item)}</span>`).join('');
  const body = `<section class="hero">
    <p class="eyebrow">災害別ガイド</p>
    <h1>${esc(topic.title)}</h1>
    <p class="lead">${esc(topic.lead)}</p>
    <div class="hero-meta">${chips}</div>
    <div class="hero-actions">
      <a class="button orange" href="#related">比較ページを見る</a>
      <a class="button secondary" href="#quantity">人数別の目安を見る</a>
    </div>
  </section>
  <section class="section two">
    <article class="card"><p class="eyebrow">この災害でまず揃えるもの</p><div class="chip-row">${mustHave}</div></article>
    <article class="card"><h2>見方</h2><ol class="steps"><li>人数と待機日数を決める</li><li>水・トイレ・食料・電源を分けて見る</li><li>関連する比較ページで商品候補を確認する</li></ol></article>
  </section>
  ${quantityEstimateSection()}
  ${sourceSection(topic.slug)}
  <section class="section" id="related"><div class="section-title"><div><p class="eyebrow">関連する比較ページ</p><h2>用途別に詳しく比較する</h2></div></div><div class="grid">${linkCards}</div></section>
  ${stockCheckSection('')}
  ${faqSection(topic)}
  <section class="section card"><h2>注意点</h2><p>${esc(requiredNotice)}</p><p>このページは災害別の入口です。実際の商品比較は、関連する比較ページで価格、レビュー、容量、回数、保存年数を確認してください。</p></section>
  ${structuredData(
    webPageJsonLd(topic.title, description, canonical, sourceUrlsFor(topic.slug)),
    breadcrumbJsonLd([{ name: topic.title, url: canonical }]),
    faqJsonLd(faqItems(topic))
  )}`;
  return layout(topic.title, body, description, canonical, { crumbs: [topic.title] });
}

const totalProducts = data.pages.reduce((sum, page) => sum + effectiveProducts(page, pageNotes[page.slug] || {}, 8).length, 0);
const weakPages = data.pages.filter((page) => effectiveProducts(page, pageNotes[page.slug] || {}, 8).length < 8).length;

const categoryCards = categoryDefinitions.map(([title, slug, desc, chips]) => {
  const page = pageBySlug(slug);
  const note = pageNotes[slug] || {};
  const count = page ? effectiveProducts(page, note, 8).length : 0;
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
  ['停電に備える', '停電対策用品比較', 'blackout-power']
].map(([label, title, slug]) => {
  const page = pageBySlug(slug);
  const count = page ? effectiveProducts(page, pageNotes[slug] || {}, 8).length : 0;
  return `<article class="card popular-card"><p class="pill orange">${esc(label)}</p><h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(title)}</a></h3><p class="notice">比較候補: ${esc(count)}件</p></article>`;
}).join('');

function firstProduct(slug, pattern) {
  const page = pageBySlug(slug);
  const products = effectiveProducts(page || { products: [] }, pageNotes[slug] || {}, 8);
  return products.find((product) => product.image && (!pattern || pattern.test(displayTitle(product))))
    || products.find((product) => product.image && (!pattern || pattern.test(rawTitle(product))))
    || products.find((product) => product.image)
    || null;
}

const heroProducts = [
  firstProduct('toilet-office', /トイレ|凝固|防臭/),
  firstProduct('blackout-power', /電源|Wh|ライト|ランタン/),
  firstProduct('water-food-stock', /保存水|非常食|アルファ米/)
].filter(Boolean);

const heroProductCards = heroProducts.map((product, index) => `<a class="hero-product" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, 'トップ', index + 1)}>
  <img src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">
  <span>${esc(displayTitle(product, 34))}</span>
</a>`).join('');

const showcaseProducts = [
  firstProduct('office-bichiku', /防災|備蓄|保存水|非常食/),
  firstProduct('toilet-office', /トイレ|凝固|防臭/),
  firstProduct('blackout-power', /電源|Wh|ライト|ランタン/)
].filter(Boolean);

const showcaseCards = showcaseProducts.map((product, index) => `<a class="showcase-card" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, 'トップ', index + 1)}>
  <img src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">
  <span>${esc(displayTitle(product, 38))}</span>
  <em>楽天で価格を見る</em>
</a>`).join('');

function starterCard(label, title, slug, product, body) {
  return `<article class="card starter-card" data-search-card>
    ${product?.image ? `<img src="${esc(product.image)}" alt="${esc(title)}" loading="lazy">` : '<div class="product-img placeholder" aria-hidden="true">比較</div>'}
    <div>
      <p class="pill orange">${esc(label)}</p>
      <h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(title)}</a></h3>
      <p class="notice">${esc(body)}</p>
      <a class="small-button" href="${siteUrl}/pages/${esc(slug)}.html">候補を見る</a>
    </div>
  </article>`;
}

function laneCard(label, title, slug, product, body) {
  return `<article class="card lane-card" data-search-card>
    ${product?.image ? `<img src="${esc(product.image)}" alt="${esc(title)}" loading="lazy">` : '<div class="product-img placeholder" aria-hidden="true">候補</div>'}
    <div>
      <p class="eyebrow">${esc(label)}</p>
      <h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(title)}</a></h3>
      <p class="notice">${esc(body)}</p>
    </div>
  </article>`;
}

const starterCards = [
  starterCard('まず不足しやすい', '簡易トイレ', 'toilet-office', firstProduct('toilet-office', /トイレ|凝固/), '断水後に買い足しが難しいため、人数と回数で先に確認。'),
  starterCard('停電が不安なら', 'ポータブル電源・ライト', 'blackout-power', firstProduct('blackout-power', /電源|Wh/), '通信、照明、受付端末など最低限使いたい機器から逆算。'),
  starterCard('帰れない日に備える', '保存水・非常食', 'water-food-stock', firstProduct('water-food-stock', /保存水|非常食/), '従業員と来客が残る前提で、日数と保管場所を確認。')
].join('');

const laneCards = [
  laneCard('発注前に見る', '簡易トイレの回数', 'toilet-office', firstProduct('toilet-office', /トイレ|凝固|防臭/), '人数分ではなく、1人1日あたりの回数で不足を見ます。'),
  laneCard('置き場所から見る', '保存水・非常食', 'water-food-stock', firstProduct('water-food-stock', /保存水|非常食|アルファ米/), '重さ、箱数、期限管理まで含めて確認します。'),
  laneCard('停電で止まるもの', 'ポータブル電源', 'blackout-power', firstProduct('blackout-power', /電源|Wh|リン酸鉄/), '照明、通信、受付端末など使う機器から容量を見ます。'),
  laneCard('施設別の注意', '保育園・介護施設', 'hoikuen-bousai', firstProduct('hoikuen-bousai', /子供|非常食|防災/), '子ども、利用者、職員を分けて備蓄を見ます。')
].join('');

function scenarioCard(title, slug, imageProduct, body) {
  return `<article class="card scenario-card" data-search-card>
    ${imageProduct?.image ? `<img src="${esc(imageProduct.image)}" alt="${esc(title)}" loading="lazy">` : '<div class="product-img placeholder" aria-hidden="true">備蓄</div>'}
    <div><p class="eyebrow">${esc(title)}</p><h3><a href="${siteUrl}/pages/${esc(slug)}.html">${esc(body)}</a></h3><p class="notice">必要なものを先に絞り込む</p></div>
  </article>`;
}

const scenarioCards = [
  scenarioCard('地震で社員が帰れない', 'earthquake-office', firstProduct('office-bichiku', /防災|備蓄|保存水/), '水・トイレ・食料をまとめて確認'),
  scenarioCard('台風で停電が心配', 'blackout-power', firstProduct('blackout-power', /電源|Wh|ランタン/), '電源・ライト・通信を比較'),
  scenarioCard('断水でトイレが使えない', 'toilet-office', firstProduct('toilet-office', /トイレ|凝固/), '簡易トイレの回数を確認'),
  scenarioCard('保育園・介護施設の備蓄', 'hoikuen-bousai', firstProduct('hoikuen-bousai', /子供|非常食|防災/), '利用者に合わせた備蓄を見る')
].join('');

const homeFaq = [
  {
    question: '会社の防災備蓄は何日分から考えればよいですか？',
    answer: 'まずは従業員、来客、施設利用者を含む最大人数を出し、待機を想定する日数を決めます。水は1人1日3L、食料は1人1日3食を一つの目安にし、保管場所や期限管理も含めて調整してください。'
  },
  {
    question: '事業所の簡易トイレは何回分を見ればよいですか？',
    answer: '1人1日5回を目安に、人数と待機日数を掛けて確認します。職員だけでなく、来客や利用者が残る可能性も含め、防臭袋、凝固剤、保管場所も確認してください。'
  },
  {
    question: '停電対策でポータブル電源を選ぶときの注意点は？',
    answer: '容量だけでなく、同時に使う機器の消費電力、必要な出力、充電方法を確認します。医療機器や介護機器への利用は、機器メーカーや施設管理者へ適合を確認してください。'
  }
];

const homeFaqHtml = `<section class="section faq home-faq"><h2>事業所の防災備蓄でよくある質問</h2>${homeFaq.map((item) => `<details><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('')}</section>`;

const indexBody = `<section class="home-hero">
  <div class="hero-main">
    <p class="hero-kicker">会社・店舗・施設の防災担当者へ</p>
    <h1>事業所の防災備蓄、<br><span>何を何日分そろえる？</span></h1>
    <p class="hero-sub">地震・台風・停電・断水に備える用品を、人数、待機日数、施設の使い方から比較できます。</p>
    <div class="hero-actions">
      <a class="button orange" href="${siteUrl}/pages/earthquake-office.html">地震対策を見る</a>
      <a class="button" href="${siteUrl}/pages/blackout-power.html">台風・停電対策を見る</a>
      <a class="button secondary" href="${siteUrl}/pages/toilet-office.html">簡易トイレを比較する</a>
      <a class="button secondary" href="#quantity">人数別の備蓄目安を見る</a>
    </div>
    <div class="search-box search-compact"><input id="siteSearch" type="search" placeholder="地震、断水、停電、保育園、トイレなどで検索"><a class="button" href="#categories">探す</a></div>
    <div class="hero-stats" aria-label="掲載情報">
      <span><strong>${data.pages.length}</strong>比較ページ</span>
      <span><strong>${totalProducts}</strong>商品候補</span>
      <span><strong>${esc(updatedDate())}</strong>情報更新</span>
    </div>
  </div>
  <aside class="hero-shopping" aria-label="よく比較される備蓄候補">
    <div class="shopping-head"><strong>まず確認したい備蓄</strong><span>価格・在庫はリンク先で確認</span></div>
    <div class="showcase-grid">${showcaseCards}</div>
    <div class="shopping-checks" aria-label="商品ごとの確認項目">
      <div><strong>トイレ</strong><span>人数 × 回数</span></div>
      <div><strong>電源</strong><span>Wh × 出力</span></div>
      <div><strong>食品・水</strong><span>人数 × 日数</span></div>
    </div>
  </aside>
</section>
<section class="section decision-strip" aria-label="購入前の確認順">
  <div><strong>まず人数を出す</strong><span>従業員、来客、利用者を分けて最大人数を見る</span></div>
  <div><strong>止まる設備を決める</strong><span>水、電気、トイレ、交通のどれが止まるかを見る</span></div>
  <div><strong>商品の条件を比べる</strong><span>容量、回数、保存年数、レビュー件数を確認する</span></div>
</section>
<section class="section route-board">
  <article class="desk-note">
    <h2>災害別に、最初の候補を絞る</h2>
    <p>地震、台風、停電、断水では、先に見る商品が変わります。まず場面を選ぶと、簡易トイレ、保存水、非常食、電源を探しやすくなります。</p>
    <small>価格、在庫、レビュー、仕様は変わります。購入前に販売ページで最新情報を確認してください。</small>
  </article>
  <div class="route-tiles">
    <a class="route-tile" href="${siteUrl}/pages/earthquake-office.html">${firstProduct('office-bichiku', /防災|備蓄|保存水/)?.image ? `<img src="${esc(firstProduct('office-bichiku', /防災|備蓄|保存水/).image)}" alt="地震対策用品" loading="lazy">` : ''}<span><strong>地震で帰れない</strong><span>水、食料、トイレ、待機用品を見る</span></span></a>
    <a class="route-tile" href="${siteUrl}/pages/blackout-power.html">${firstProduct('blackout-power', /電源|Wh|ランタン/)?.image ? `<img src="${esc(firstProduct('blackout-power', /電源|Wh|ランタン/).image)}" alt="停電対策用品" loading="lazy">` : ''}<span><strong>停電で止まる</strong><span>照明、通信、充電、電源容量を見る</span></span></a>
    <a class="route-tile" href="${siteUrl}/pages/toilet-office.html">${firstProduct('toilet-office', /トイレ|凝固/)?.image ? `<img src="${esc(firstProduct('toilet-office', /トイレ|凝固/).image)}" alt="簡易トイレ" loading="lazy">` : ''}<span><strong>断水で困る</strong><span>トイレ回数、手洗い、衛生用品を見る</span></span></a>
    <a class="route-tile" href="${siteUrl}/pages/restaurant-dansui.html">${firstProduct('restaurant-dansui', /給水|タンク|消毒|トイレ/)?.image ? `<img src="${esc(firstProduct('restaurant-dansui', /給水|タンク|消毒|トイレ/).image)}" alt="飲食店の断水対策" loading="lazy">` : ''}<span><strong>店舗で水が止まる</strong><span>厨房、トイレ、手指衛生を分ける</span></span></a>
  </div>
</section>
<section class="section split-proof">
  <article>
    <h2>セットだけで選ぶと、足りないものが見えにくい</h2>
    <p>防災セットは入口として便利です。ただし事業所では、人数に対してトイレ回数が足りない、保存水が重すぎて置けない、停電時に使う機器の出力が合わない、というズレが起きます。</p>
  </article>
  <div class="proof-list">
    <div><strong>簡易トイレ</strong><span>人数ではなく、1人1日あたりの回数で見る</span></div>
    <div><strong>保存水・非常食</strong><span>日数、箱数、期限管理、アレルギーを確認</span></div>
    <div><strong>ポータブル電源</strong><span>Whと出力、使う機器、充電方法を見る</span></div>
  </div>
</section>
<section class="section">
  <h2>まず見る比較</h2>
  <div class="starter-grid">${starterCards}</div>
</section>
<section class="section check-strip">
  <div><strong>会社</strong><span>従業員と来客を分けて、水、食料、トイレを確認。</span></div>
  <div><strong>店舗</strong><span>断水時の厨房、手洗い、トイレ、衛生用品を確認。</span></div>
  <div><strong>保育園</strong><span>子ども向け非常食、アレルギー、寝具、防寒を確認。</span></div>
  <div><strong>介護施設</strong><span>停電時の照明、通信、電源、利用者対応を確認。</span></div>
</section>
${quantityEstimateSection()}
${sourceSection('home')}
<section class="section" id="disasters">
  <h2>災害別に見る</h2>
  <div class="chip-row">
    <a id="地震" class="chip active" href="${siteUrl}/topics/earthquake.html">地震</a>
    <a id="台風" class="chip active" href="${siteUrl}/topics/typhoon.html">台風</a>
    <a id="停電" class="chip active" href="${siteUrl}/topics/power-outage.html">停電</a>
    <a id="断水" class="chip active" href="${siteUrl}/topics/water-outage.html">断水</a>
    <a id="帰宅困難者" class="chip active" href="${siteUrl}/topics/commuter-stranding.html">帰宅困難者</a>
  </div>
</section>
<section class="section" id="popular"><h2>迷ったらここから見る</h2><div class="grid">${popularCards}</div></section>
<section class="section" id="categories"><div class="section-title"><div><h2>用途・災害・施設別に探す</h2></div><p class="notice">検索窓で絞り込みできます</p></div><div class="grid">${categoryCards}</div></section>
${homeFaqHtml}
<section class="section card final-note"><h2>購入前の確認</h2><p>商品名だけではなく、人数、待機日数、用途、容量、回数、保存年数、レビュー件数を合わせて確認してください。条件に合うものが見つからない場合は、用途が近い備蓄品もあわせて確認してください。</p><p>${esc(requiredNotice)}</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。価格・在庫・レビューは変動するため、購入前にリンク先で最新情報を確認してください。</p></section>
${structuredData(
  websiteJsonLd(),
  webPageJsonLd(
    '事業所の防災備蓄は何を何日分？会社・店舗向け用品比較',
    '会社、店舗、保育園、介護施設、飲食店の防災備蓄を、人数と待機日数から確認。地震、台風、停電、断水に備える簡易トイレ、保存水、非常食、ポータブル電源を比較できます。',
    `${siteUrl}/`,
    sourceUrlsFor('home')
  ),
  itemListJsonLd(showcaseProducts, `${siteUrl}/`),
  productJsonLd(showcaseProducts),
  faqJsonLd(homeFaq.map((item) => [item.question, item.answer]))
)}`;

const policyCanonical = `${siteUrl}/site-policy.html`;
const policyBody = `<nav class="breadcrumbs" aria-label="パンくず"><a href="${siteUrl}/">ホーム</a><span>›</span><span>運営情報・広告掲載・プライバシー</span></nav>
<section class="hero"><p class="eyebrow">サイトについて</p><h1>運営情報・広告掲載・プライバシー</h1><p class="lead">事業所防災ナビの運営者、広告リンク、アクセス解析で取り扱う情報を記載します。</p></section>
<section class="section two">
  <article class="card"><h2>運営情報</h2><dl class="spec-grid"><div><span>サイト名</span><strong>事業所防災ナビ</strong></div><div><span>運営者</span><strong>村上 誠治</strong></div><div><span>サイトURL</span><strong>${siteUrl}/</strong></div><div><span>更新日</span><strong>2026年7月23日</strong></div></dl></article>
  <article class="card"><h2>掲載情報について</h2><p>当サイトは、事業所向け防災用品を比較しやすくするための情報サイトです。価格、在庫、レビュー、商品仕様は変動する場合があります。購入前に必ず販売ページで最新情報を確認してください。</p><p>医療機器、介護機器、食品アレルギー、施設運用に関わる備蓄については、メーカー、専門業者、施設管理者に確認してください。</p></article>
</section>
<section class="section card"><h2>広告リンクについて</h2><p>当サイトは楽天アフィリエイトを利用しています。リンクを経由して商品が購入された場合、当サイトが紹介料を受け取ることがあります。リンク先の商品価格に紹介料が加算されるものではありません。掲載順や分類は、価格、レビュー件数、商品情報の明確さ、事業所用途との一致度などをもとに整理しています。</p></section>
<section class="section card"><h2>アクセス解析とCookie</h2><p>当サイトはGoogle Analytics 4を利用しています。Google AnalyticsはCookieを使い、閲覧ページ、利用端末やブラウザの種類、概略の地域、サイト内の操作、外部の商品ページへのクリックなどを計測します。Cookieにはブラウザを区別するためのクライアントIDが保存されます。計測データは、閲覧傾向と情報の見つけやすさを確認するために利用します。当サイトには、氏名やメールアドレスを入力するフォームはありません。Googleによるデータの取り扱いは、Googleの規約とプライバシーポリシーに基づきます。</p><p><a href="https://policies.google.com/technologies/partner-sites?hl=ja" target="_blank" rel="noopener">Googleが収集した情報の利用</a> / <a href="https://policies.google.com/privacy?hl=ja" target="_blank" rel="noopener">Google プライバシーポリシー</a> / <a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noopener">Google Analytics オプトアウト</a></p></section>
${structuredData(webPageJsonLd('運営情報・広告掲載・プライバシー', '事業所防災ナビの運営者情報、楽天アフィリエイトを含む広告リンク、Google Analytics 4によるアクセス解析、Cookieの取り扱い、掲載情報の確認事項を記載しています。', policyCanonical))}`;

fs.writeFileSync(path.join(dist, 'index.html'), layout(
  '事業所の防災備蓄は何を何日分？会社・店舗向け用品比較',
  indexBody,
  '会社、店舗、保育園、介護施設、飲食店の防災備蓄を、人数と待機日数から確認。地震、台風、停電、断水に備える簡易トイレ、保存水、非常食、ポータブル電源を比較できます。',
  `${siteUrl}/`,
  { ogImage: showcaseProducts.find((product) => product.image)?.image || '' }
));
fs.writeFileSync(path.join(dist, 'site-policy.html'), layout(
  '運営情報・広告掲載・プライバシー',
  policyBody,
  '事業所防災ナビの運営者情報、楽天アフィリエイトを含む広告リンク、Google Analytics 4によるアクセス解析、Cookieの取り扱い、掲載情報の確認事項を記載しています。',
  policyCanonical,
  { hideAffiliateDisclosure: true, hideShare: true }
));
fs.writeFileSync(path.join(dist, 'CNAME'), 'jigyousho-bousai.com\n');
fs.writeFileSync(path.join(dist, 'google2ec9ab5d0fbf2c67.html'), 'google-site-verification: google2ec9ab5d0fbf2c67.html\n');
fs.mkdirSync(path.join(dist, 'pages'), { recursive: true });
for (const page of data.pages) {
  fs.writeFileSync(path.join(dist, 'pages', page.slug + '.html'), pageHtml(page));
}
fs.mkdirSync(path.join(dist, 'topics'), { recursive: true });
for (const topic of topicPages) {
  fs.writeFileSync(path.join(dist, 'topics', topic.slug + '.html'), topicHtml(topic));
}
const urls = [
  `${siteUrl}/`,
  policyCanonical,
  ...data.pages.map((page) => `${siteUrl}/pages/${page.slug}.html`),
  ...topicPages.map((topic) => `${siteUrl}/topics/${topic.slug}.html`)
];
const sitemapLastmod = (data.generatedAt || new Date().toISOString()).slice(0, 10);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc><lastmod>${sitemapLastmod}</lastmod></url>`).join('')}</urlset>\n`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log('built', dist);
