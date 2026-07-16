const fs = require('fs');
const path = require('path');

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
  const raw = product.titleShort || product.name || product.titleRaw || '';
  return shortName(raw, maxLength);
}

function rawTitle(product) {
  return product.titleRaw || product.name || product.titleShort || '';
}

function extractSpec(product) {
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
  const own = (page.products || []).map((product) => ({ ...product, relatedCandidate: false }));
  if (own.length >= minCount) return own;

  const seen = new Set(own.map((product) => product.itemCode || product.url || rawTitle(product)));
  const related = [];
  for (const slug of note.related || []) {
    const relatedPage = pageBySlug(slug);
    for (const product of relatedPage?.products || []) {
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
${socialImage}
  <meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}">
  ${analyticsHead()}
  <style>
    /* Hallmark · genre: procurement guide · tone: calm and practical · anchor: deep teal · structure: editorial catalogue · critique: P4 H4 E4 S5 R4 V4 */
    :root{color-scheme:light;--ink:#17212b;--muted:#5c6874;--line:#dbe4e4;--soft:#f7f2e8;--paper:#fff;--main:#103f4a;--main2:#0d6258;--accent:#e47b24;--accent-soft:#fff1e3;--ok:#187060;--warn:#a45d08;--font-body:system-ui,-apple-system,"Yu Gothic","Meiryo",sans-serif;--font-display:"Yu Gothic UI","Yu Gothic","Meiryo",sans-serif}
    *{box-sizing:border-box}html{scroll-behavior:smooth;overflow-x:clip}body{margin:0;background:var(--soft);color:var(--ink);font-family:var(--font-body);font-size:16px;line-height:1.75;letter-spacing:0;overflow-x:clip}
    a{color:var(--main2)}main{max-width:1180px;margin:0 auto;padding:22px 18px 56px}.site-head{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:14px}.brand{font-weight:900;font-size:22px;text-decoration:none;color:var(--main)}.nav{display:flex;gap:10px;flex-wrap:wrap}.nav a{font-size:14px;text-decoration:none;color:var(--muted);padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.65)}
    .breadcrumb{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0 14px;color:var(--muted);font-size:13px}.breadcrumb a{text-decoration:none;color:var(--muted)}
    .hero{background:#fff;border:1px solid #d8e1df;border-radius:8px;padding:34px;box-shadow:0 10px 28px rgba(31,35,30,.07);min-width:0}.visual-hero{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(320px,.74fr);gap:28px;align-items:start;overflow:hidden}.visual-hero>*{min-width:0}.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.hero-visual{display:grid;gap:12px}.shelf-photo{position:relative;min-height:280px;border-radius:8px;overflow:hidden;background:linear-gradient(160deg,#123f46,#0d6258 48%,#f4a261 49%,#fff7ed);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)}.shelf-photo:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,34,38,.1),rgba(8,34,38,.64))}.shelf-label{position:absolute;left:18px;right:18px;bottom:18px;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.35)}.shelf-label strong{display:block;font-size:22px;line-height:1.35}.hero-products{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.hero-product{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px;min-width:0}.hero-product img{width:100%;height:96px;object-fit:contain}.hero-product span{font-size:12px;font-weight:900;line-height:1.45;color:var(--ink)}.trust-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.trust-row div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}.trust-row strong{display:block;color:var(--main);font-size:18px}.trust-row span{font-size:13px;color:var(--muted)}
    .eyebrow{font-size:13px;font-weight:900;color:var(--main2);margin:0 0 8px}h1{font-size:clamp(34px,5.4vw,56px);line-height:1.16;margin:0 0 16px;letter-spacing:0;overflow-wrap:anywhere;min-width:0}h2{font-size:24px;line-height:1.35;margin:0 0 12px;overflow-wrap:anywhere;min-width:0}h3{font-size:18px;line-height:1.45;margin:0 0 8px;overflow-wrap:anywhere;min-width:0}.lead{font-size:18px;max-width:890px;overflow-wrap:anywhere}.muted{color:var(--muted)}.section{margin-top:28px}.section-title{display:flex;justify-content:space-between;gap:14px;align-items:end;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:22px;box-shadow:0 10px 24px rgba(29,38,34,.06)}.card h2 a,.card h3 a{text-decoration:none;color:var(--ink)}.card h2 a:hover,.card h3 a:hover{text-decoration:underline}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;background:var(--main2);color:white;border-radius:8px;text-decoration:none;font-weight:900;box-shadow:0 8px 16px rgba(13,98,88,.18)}.button.orange{background:var(--accent);box-shadow:0 8px 16px rgba(228,123,36,.18)}.button.secondary{background:#fff;color:var(--main2);border:1px solid var(--main2);box-shadow:none}.button.block{width:100%}
    .chip-row{display:flex;gap:9px;flex-wrap:wrap}.chip,.pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:900;text-decoration:none}.chip{background:#fff;color:var(--main);border:1px solid var(--line)}.chip.active,.pill.orange{background:var(--accent-soft);border:1px solid #f4c497;color:#9b4d08}.pill{background:#e9f3f1;color:var(--main2);border:1px solid #cfe2de}.pill.navy{background:#e9eef2;color:var(--main);border-color:#cbd8de}
    .search-box{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}.search-box input{min-height:48px;border:1px solid var(--line);border-radius:8px;padding:0 14px;font-size:16px;background:#fff}.mini-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.mini-stats div,.estimate-grid div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.mini-stats strong,.estimate-grid strong{display:block;font-size:24px;color:var(--main)}
    .checklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0 0;padding:0;list-style:none}.checklist li{background:#f6faf8;border:1px solid #d9e7e3;border-radius:8px;padding:12px 14px}.steps{counter-reset:step;display:grid;gap:10px;margin:0;padding:0;list-style:none}.steps li{counter-increment:step;padding:12px 14px;border-left:4px solid var(--accent);background:#fffaf4;border-radius:0 8px 8px 0}.steps li:before{content:counter(step) ". ";font-weight:900;color:var(--accent)}
    .two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.category-card{display:flex;flex-direction:column;gap:10px}.category-card .count{margin-top:auto;color:var(--muted);font-size:13px}.popular-card{border-top:5px solid var(--accent)}.scenario-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.scenario-card{display:grid;grid-template-columns:74px 1fr;gap:12px;align-items:center;box-shadow:none}.scenario-card img{width:74px;height:74px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px}.buyer-path{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.path-card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px}.path-card strong{display:block;font-size:18px;color:var(--main);margin-bottom:6px}.source-panel{background:#eef7f4;border:1px solid #cfe2de}.source-panel a{font-weight:900}.hero-kicker{display:inline-flex;background:#eef7f4;border:1px solid #cfe2de;border-radius:999px;padding:6px 10px;font-size:13px;font-weight:900;color:var(--main);margin-bottom:12px}.hero-sub{font-size:22px;line-height:1.45;margin:0 0 14px;color:#26343d;font-weight:900;overflow-wrap:anywhere}.concern-list{display:grid;gap:8px;margin:18px 0 0;padding:0;list-style:none}.concern-list li{background:#f8faf9;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-weight:800}.concern-list span{color:var(--accent);font-weight:900}.hero-showcase{background:#fbfcfb;border:1px solid var(--line);border-radius:8px;padding:14px}.showcase-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.showcase-head strong{font-size:18px;color:var(--main)}.showcase-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.showcase-card{min-height:178px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px;display:grid;grid-template-rows:104px auto;gap:8px;text-decoration:none;color:var(--ink)}.showcase-card:first-child{grid-row:span 2;grid-template-rows:220px auto}.showcase-card img{width:100%;height:100%;object-fit:contain;background:#fff;border-radius:7px}.showcase-card span{font-size:13px;font-weight:900;line-height:1.45}.showcase-card em{font-style:normal;color:var(--accent);font-weight:900;font-size:12px}.decision-panel{margin-top:12px;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}.decision-row{display:grid;grid-template-columns:86px 1fr;gap:0;border-top:1px solid var(--line)}.decision-row:first-child{border-top:0}.decision-row strong{background:#eef7f4;color:var(--main);padding:10px 12px}.decision-row span{padding:10px 12px;color:#33423b}.field-note{margin-top:10px;background:#fff7ed;border:1px solid #f4c497;border-radius:8px;padding:12px}.field-note strong{display:block;color:#9b4d08}.starter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.starter-card{display:grid;grid-template-columns:88px 1fr;gap:12px;align-items:center;box-shadow:none}.starter-card img{width:88px;height:88px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:7px}.starter-card h3{margin-bottom:4px}.starter-card .small-button{margin-top:8px}.decision-note{border-left:5px solid var(--accent);background:#fff}.human-copy{font-size:17px}.check-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.check-strip div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.check-strip strong{display:block;color:var(--main);font-size:18px}.check-strip span{display:block;color:var(--muted);font-size:13px}.procurement-board{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:16px;align-items:start}.desk-note{background:#103f4a;color:#f8fbf9;border-radius:8px;padding:22px;box-shadow:0 14px 26px rgba(16,63,74,.16)}.desk-note h2{color:#fff}.desk-note .eyebrow{color:#ffd3a3}.desk-note p{margin:0 0 14px}.desk-note small{display:block;color:#d7e5e2}.proof-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}.proof-list li{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}.proof-list strong{display:block;color:var(--main);margin-bottom:2px}.comparison-lane{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.lane-card{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:center}.lane-card img{width:92px;height:92px;object-fit:contain;border:1px solid var(--line);border-radius:8px;background:#fff;padding:7px}.site-footer{border-top:1px solid var(--line);margin-top:44px;padding:16px 0 0;color:var(--muted);font-size:12px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.site-footer a{color:var(--muted);text-decoration:none}
    body{background:#eef2ee;background-image:linear-gradient(180deg,#f7f8f4 0,#eef2ee 320px,#f8f9f6 100%)}main{max-width:1240px}.site-head{background:rgba(248,249,246,.92);border:1px solid rgba(16,63,74,.12);border-radius:12px;padding:10px 12px;backdrop-filter:blur(12px)}.brand{display:flex;align-items:center;gap:8px}.brand:before{content:"";width:10px;height:26px;border-radius:2px;background:var(--accent)}.nav a{background:transparent;border:1px solid rgba(16,63,74,.12);color:#2f464b}.home-hero{display:grid;grid-template-columns:minmax(0,1.03fr) minmax(360px,.72fr);gap:20px;align-items:stretch;margin-top:8px}.hero-main{background:#fff;border:1px solid #d9e1dd;border-radius:18px;padding:42px;box-shadow:0 18px 44px rgba(26,42,38,.08)}.hero-main h1{font-size:clamp(36px,5vw,58px);line-height:1.16;max-width:840px;word-break:keep-all}.hero-main .hero-sub{font-size:clamp(19px,2vw,24px);line-height:1.55;color:#26343d;max-width:760px;font-weight:800}.hero-main .hero-kicker{display:inline-flex;margin-bottom:14px;background:#eaf3ef;color:var(--main);border:1px solid #cfe0da;border-radius:999px;padding:6px 11px;font-size:13px;font-weight:900}.hero-actions{gap:10px}.search-compact{margin-top:18px;background:#f5f7f3;border:1px solid #dce5df;border-radius:12px;padding:8px;grid-template-columns:1fr auto}.search-compact input{border:0;background:transparent}.hero-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.hero-stats span{border-top:1px solid #dde5df;padding-top:10px;color:var(--muted);font-size:13px}.hero-stats strong{display:block;color:var(--main);font-size:20px;line-height:1.2}.hero-shopping{background:#102d37;border-radius:18px;padding:18px;color:#f7fbf8;box-shadow:0 18px 44px rgba(16,45,55,.18)}.shopping-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:12px}.shopping-head strong{font-size:20px}.shopping-head span{color:#cfe0da;font-size:12px}.hero-shopping .showcase-grid{grid-template-columns:1fr;gap:10px}.hero-shopping .showcase-card{min-height:0;grid-template-columns:112px 1fr;grid-template-rows:auto;align-items:center;border-radius:12px;padding:12px;background:#fff;color:var(--ink);border:0}.hero-shopping .showcase-card:first-child{grid-row:auto;grid-template-rows:auto}.hero-shopping .showcase-card img{height:100px;object-fit:contain}.hero-shopping .showcase-card span{font-size:14px}.hero-shopping .showcase-card em{display:inline-block;white-space:nowrap;width:max-content;max-width:100%}.decision-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;background:#fff;border:1px solid #d9e1dd;border-radius:14px;overflow:hidden}.decision-strip div{padding:16px 18px;border-left:1px solid #d9e1dd}.decision-strip div:first-child{border-left:0}.decision-strip strong{display:block;color:var(--main);font-size:17px}.decision-strip span{display:block;color:var(--muted);font-size:13px;margin-top:4px}.route-board{display:grid;grid-template-columns:.84fr 1.16fr;gap:18px;align-items:stretch}.route-board .desk-note{border-radius:16px;min-height:100%;box-shadow:none;background:#173d43;color:#f8fbf7}.route-board .desk-note h2{color:#fff}.route-board .desk-note small{color:#d6e4df}.route-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.route-tile{display:grid;grid-template-columns:88px 1fr;gap:13px;align-items:center;background:#fff;border:1px solid #d9e1dd;border-radius:14px;padding:14px;text-decoration:none;color:var(--ink);box-shadow:0 6px 16px rgba(29,38,34,.035)}.route-tile:hover,.showcase-card:hover,.starter-card:hover{transform:translateY(-1px);border-color:#b9ccc5}.route-tile img{width:88px;height:88px;object-fit:contain}.route-tile strong{display:block;color:var(--main);font-size:18px}.route-tile span{display:block;color:var(--muted);font-size:13px}.split-proof{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:20px;align-items:start;background:#fff;border:1px solid #d9e1dd;border-radius:16px;padding:26px}.split-proof h2{font-size:28px}.split-proof p{font-size:17px;color:#33423b}.proof-list{display:grid;gap:10px}.proof-list div{display:grid;grid-template-columns:150px 1fr;gap:14px;border-bottom:1px solid #e1e8e3;padding:10px 0}.proof-list div:last-child{border-bottom:0}.proof-list strong{color:var(--main)}.proof-list span{color:var(--muted)}.starter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.starter-card{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center;box-shadow:none;border-radius:14px}.starter-card img{width:96px;height:96px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:10px;padding:7px}.starter-card h3{margin-bottom:4px}.starter-card .small-button{margin-top:8px}.check-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.check-strip div{background:#fff;border:1px solid #d9e1dd;border-radius:14px;padding:14px}.check-strip strong{display:block;color:var(--main);font-size:18px}.check-strip span{display:block;color:var(--muted);font-size:13px}.scenario-card,.lane-card,.category-card,.popular-card{border-radius:14px;box-shadow:none}.button{border-radius:10px}.button:hover,.small-button:hover{filter:brightness(.96);transform:translateY(-1px)}.card{border-radius:14px;box-shadow:0 8px 20px rgba(29,38,34,.045)}.final-note{background:#fff}
    .site-head{padding:15px 0 13px;border:0;border-bottom:1px solid #cfd9d5;border-radius:0;background:transparent;backdrop-filter:none}.brand{font-size:21px;letter-spacing:.02em}.brand:before{height:22px;width:5px}.nav a{border:0;border-radius:0;padding:5px 2px;background:transparent}.nav a:hover{text-decoration:underline;text-underline-offset:4px}.home-hero{grid-template-columns:minmax(0,1.02fr) minmax(360px,.78fr);gap:0;margin-top:0;border-bottom:1px solid #cfd9d5;background:#f5f1e8}.hero-main{border:0;border-radius:0;padding:54px 46px 46px 22px;background:transparent;box-shadow:none}.hero-main h1{font-size:clamp(38px,5.2vw,62px);line-height:1.14;max-width:780px;font-family:var(--font-display,"Yu Gothic UI","Yu Gothic",sans-serif);font-weight:800}.hero-main h1 span{color:var(--main)}.hero-main .hero-kicker{margin-bottom:17px;border:0;border-radius:0;padding:0 0 5px;background:transparent;border-bottom:3px solid var(--accent);font-size:14px}.hero-main .hero-sub{max-width:720px;font-size:clamp(18px,1.7vw,22px);font-weight:700}.hero-actions{margin-top:24px}.hero-actions .button{border-radius:3px;box-shadow:none}.hero-actions .button.secondary{border:0;padding-inline:8px;background:transparent;text-decoration:underline;text-underline-offset:5px}.search-compact{max-width:720px;margin-top:24px;border:1px solid #ccd7d2;border-radius:3px;padding:4px;background:#fff}.search-compact .button{border-radius:2px}.hero-stats{display:flex;gap:24px;margin-top:17px}.hero-stats span{border:0;padding:0;font-size:12px}.hero-stats strong{display:inline;margin-right:5px;font-size:15px}.hero-shopping{padding:30px 22px 26px;border:0;border-left:1px solid #cfd9d5;border-radius:0;background:#e8ede7;color:var(--ink);box-shadow:none}.shopping-head{align-items:baseline;border-bottom:1px solid #bdcac4;padding-bottom:9px}.shopping-head strong{color:var(--main)}.shopping-head span{color:var(--muted)}.hero-shopping .showcase-grid{grid-template-columns:minmax(0,1.18fr) minmax(0,.82fr);grid-template-rows:1fr 1fr;gap:14px 16px}.hero-shopping .showcase-card{display:grid;grid-template-columns:94px 1fr;grid-template-rows:auto;gap:10px;min-height:0;padding:0 0 12px;border:0;border-bottom:1px solid #bdcac4;border-radius:0;background:transparent;color:var(--ink)}.hero-shopping .showcase-card:first-child{grid-row:span 2;grid-template-columns:1fr;grid-template-rows:250px auto auto;padding:0 16px 0 0;border-right:1px solid #bdcac4;border-bottom:0}.hero-shopping .showcase-card img{height:94px;border-radius:0;background:#fff}.hero-shopping .showcase-card:first-child img{height:250px}.hero-shopping .showcase-card em{color:#a64f08;text-decoration:underline;text-underline-offset:3px}.decision-strip{border:0;border-bottom:1px solid #cfd9d5;border-radius:0;background:transparent}.decision-strip div{padding:17px 18px;border-left:1px solid #cfd9d5}.decision-strip strong{font-size:16px}.route-board{grid-template-columns:minmax(250px,.72fr) minmax(0,1.28fr);gap:36px;border-top:1px solid #cfd9d5;padding-top:28px}.route-board .desk-note{padding:0;border-radius:0;background:transparent;color:var(--ink)}.route-board .desk-note h2{color:var(--main);font-size:30px}.route-board .desk-note small{color:var(--muted)}.route-tiles{gap:0 22px}.route-tile{padding:13px 0;border:0;border-bottom:1px solid #d8e0dc;border-radius:0;background:transparent;box-shadow:none}.route-tile img{width:78px;height:78px;border-radius:0;background:#fff}.route-tile:hover{transform:none;border-color:var(--accent)}.split-proof{padding:30px 0;border:0;border-top:1px solid #cfd9d5;border-bottom:1px solid #cfd9d5;border-radius:0;background:transparent}.starter-grid{grid-template-columns:1fr;gap:0;border-top:1px solid #cfd9d5}.starter-card{grid-template-columns:118px minmax(0,1fr);padding:15px 0;border:0;border-bottom:1px solid #cfd9d5;border-radius:0;background:transparent;box-shadow:none}.starter-card img{width:118px;height:104px;border-radius:0}.starter-card .pill{border:0;border-radius:0;padding:0;background:transparent;color:#a64f08}.starter-card .small-button{border-radius:2px}.check-strip{grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid #cfd9d5;border-bottom:1px solid #cfd9d5}.check-strip div{padding:16px 17px;border:0;border-left:1px solid #cfd9d5;border-radius:0;background:transparent}.check-strip div:first-child{border-left:0}#popular .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;border-top:1px solid #cfd9d5}#popular .popular-card{padding:15px 0;border:0;border-bottom:1px solid #cfd9d5;border-radius:0;background:transparent;box-shadow:none}#popular .pill{border:0;border-radius:0;padding:0;background:transparent}#categories .grid{gap:0 24px}#categories .category-card{padding:15px 0;border:0;border-bottom:1px solid #cfd9d5;border-radius:0;background:transparent;box-shadow:none}.final-note{border-radius:3px;box-shadow:none}.home-faq{border-top:1px solid #cfd9d5;padding-top:28px}.home-faq details{border:0;border-bottom:1px solid #cfd9d5;border-radius:0;padding:14px 0;background:transparent}
    .hero-main h1{font-family:var(--font-display)}.shopping-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin-top:28px;border-top:1px solid #bdcac4;border-bottom:1px solid #bdcac4}.shopping-checks div{padding:12px 10px;border-left:1px solid #bdcac4}.shopping-checks div:first-child{border-left:0}.shopping-checks strong,.shopping-checks span{display:block}.shopping-checks strong{color:var(--main)}.shopping-checks span{font-size:12px;color:var(--muted)}
    .compare-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:#fff}.compare-table{width:100%;min-width:980px;border-collapse:collapse}.compare-table th,.compare-table td{padding:12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.compare-table th{background:#f2f6f5;color:var(--main);font-size:13px}.compare-table tr:last-child td{border-bottom:0}.table-product{font-weight:900;max-width:260px;overflow-wrap:anywhere}.small-button{display:inline-flex;min-height:36px;align-items:center;padding:7px 10px;border-radius:7px;background:var(--main2);color:white;text-decoration:none;font-weight:900;white-space:nowrap}
    .product-list{display:grid;gap:14px}.product{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:start}.product-img{width:150px;height:150px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px}.product-img.placeholder{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px;background:#f6f6f2}.product h2{font-size:20px;overflow-wrap:anywhere}.summary{margin:8px 0;color:#33423b}.price{font-size:24px;font-weight:900;color:var(--main);margin:8px 0}.facts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.fact{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:13px;background:#fbfcfb;color:#33423b}.spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}.spec-grid div{background:#f8faf8;border:1px solid var(--line);border-radius:8px;padding:8px}.spec-grid span{display:block;font-size:12px;color:var(--muted)}.spec-grid strong{display:block;color:var(--ink)}.notice{font-size:13px;color:var(--muted)}.empty{border:1px dashed #d6b681;background:#fffaf4}.ad-note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}.calc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.calc-grid label{display:grid;gap:6px;font-weight:900}.calc-input{min-height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-size:16px}.estimate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:14px}.estimate-grid span,.estimate-grid small{display:block;color:var(--muted)}.faq details{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.faq details+details{margin-top:10px}.faq summary{font-weight:900;cursor:pointer}.link-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.link-list a{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px;text-decoration:none;font-weight:900;color:var(--main)}
    @media(max-width:760px){main{padding:12px 12px 44px;max-width:100%}.site-head{align-items:flex-start;flex-direction:column;padding-inline:2px}.home-hero{grid-template-columns:1fr;gap:0}.hero-main{padding:34px 8px 30px}.hero-main h1{font-size:clamp(31px,9vw,39px);line-height:1.2;word-break:keep-all;overflow-wrap:anywhere}.hero-main .hero-sub{font-size:17px;line-height:1.65}.hero-shopping{padding:22px 8px;border-left:0;border-top:1px solid #cfd9d5}.hero-shopping .showcase-grid{grid-template-columns:1fr 1fr;grid-template-rows:auto}.hero-shopping .showcase-card{grid-template-columns:1fr;grid-template-rows:118px auto auto;padding:0;border-bottom:0}.hero-shopping .showcase-card:first-child{grid-column:1/-1;grid-row:auto;grid-template-columns:118px 1fr;grid-template-rows:auto;padding:0 0 14px;border-right:0;border-bottom:1px solid #bdcac4}.hero-shopping .showcase-card img{height:118px}.hero-shopping .showcase-card:first-child img{height:118px}.shopping-head{display:grid;align-items:start}.decision-strip{grid-template-columns:1fr}.decision-strip div{border-left:0;border-top:1px solid #d9e1dd}.decision-strip div:first-child{border-top:0}.split-proof,.route-board,.evidence-bar{grid-template-columns:1fr}.proof-list div{grid-template-columns:1fr;gap:4px}.route-tiles{grid-template-columns:1fr}.route-tile{grid-template-columns:74px 1fr}.route-tile img{width:74px;height:74px}.hero-stats{display:grid;grid-template-columns:1fr 1fr;gap:5px}.search-compact{grid-template-columns:1fr}.check-strip{grid-template-columns:1fr 1fr}.check-strip div:nth-child(odd){border-left:0}.check-strip div{border-top:1px solid #cfd9d5}.starter-card{grid-template-columns:92px minmax(0,1fr)}.starter-card img{width:92px;height:92px}#popular .grid{grid-template-columns:1fr}.visual-hero{grid-template-columns:1fr;padding:0;border-radius:18px;max-width:100%;overflow:hidden}.hero-copy{padding:28px 20px;min-width:0;max-width:100%}.hero-copy h1{font-size:clamp(30px,9vw,36px);line-height:1.12;word-break:break-all;overflow-wrap:anywhere}.hero-sub{font-size:18px;line-height:1.58}.hero-copy .lead,.visual-hero .hero-sub{max-width:100%;word-break:break-all;overflow-wrap:anywhere}.visual-hero .concern-list{grid-template-columns:1fr}.hero-side{padding:16px;min-width:0}.research-badge{grid-template-columns:76px 1fr}.supply-shelf .showcase-card{grid-template-columns:86px 1fr}.supply-shelf .showcase-card img{height:78px}.diagnosis-row{grid-template-columns:74px 1fr}.hero-meta{display:grid;grid-template-columns:1fr;align-items:start}.hero-meta .pill{justify-content:flex-start;width:max-content;max-width:100%}.shelf-photo{min-height:210px}.hero-products{grid-template-columns:repeat(3,minmax(88px,1fr));overflow-x:auto}.trust-row{grid-template-columns:1fr}.lead{font-size:16px}.section-title{display:block}.two,.three,.procurement-board,.comparison-lane{grid-template-columns:1fr}.search-box{grid-template-columns:1fr}.scenario-card{grid-template-columns:72px 1fr}.scenario-card img{width:72px;height:72px}.showcase-head{display:grid;align-items:start}.showcase-grid{grid-template-columns:1fr}.showcase-card:first-child{grid-row:auto;grid-template-rows:150px auto}.showcase-card{grid-template-rows:130px auto}.decision-row{grid-template-columns:74px 1fr}.lane-card{grid-template-columns:82px 1fr}.lane-card img{width:82px;height:82px}.product{grid-template-columns:104px 1fr;gap:12px}.product-img{width:104px;height:104px}.product h2{font-size:17px}.nav{gap:8px}.nav a,.button,.small-button{white-space:nowrap}.hero-actions .button{width:100%}.hero-actions .button.secondary{width:auto}.card{padding:18px}}
    @media(min-width:761px) and (max-width:900px){.home-hero{grid-template-columns:1fr}.hero-shopping{border-left:0;border-top:1px solid #cfd9d5}.route-board,.split-proof{grid-template-columns:1fr}.hero-main h1{max-width:680px}.hero-shopping .showcase-card:first-child{grid-template-rows:220px auto auto}.hero-shopping .showcase-card:first-child img{height:220px}}
  </style>
</head>
<body><main><header class="site-head"><a class="brand" href="${siteUrl}/">事業所防災ナビ</a><nav class="nav"><a href="${siteUrl}/#disasters">災害別</a><a href="${siteUrl}/#categories">カテゴリ</a><a href="${siteUrl}/#quantity">人数別目安</a><a href="${siteUrl}/#popular">よく使う比較</a></nav></header>${breadcrumb}${body}${siteFooter()}${clientScript()}</main></body>
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
  return `<footer class="site-footer"><span>© 2026 事業所防災ナビ</span><span>運営: 事業所防災ナビ編集部 / 楽天アフィリエイト等のリンクを含む場合があります</span></footer>`;
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
      function productParams(anchor){
        return {
          product_name: cleanText(anchor.dataset.productName || anchor.closest('.product,.showcase-card,.hero-product')?.textContent || anchorText(anchor)),
          product_price: anchor.dataset.productPrice || '',
          product_category: anchor.dataset.productCategory || '',
          link_text: anchorText(anchor),
          destination: anchor.href
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
      document.addEventListener('click', function(event){
        var anchor=event.target.closest && event.target.closest('a');
        if(!anchor || !anchor.href) return;
        var url=anchor.href;
        if(url.indexOf('hb.afl.rakuten.co.jp') !== -1){
          var params = productParams(anchor);
          trackEvent('product_card_click', params);
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

function productTrackingAttrs(product, category = '') {
  return `data-product-name="${esc(displayTitle(product))}" data-product-price="${esc(product.price || '')}" data-product-category="${esc(category)}"`;
}

function productJsonLd(products) {
  const graph = products.filter((product) => product.name && product.url).slice(0, 12).map((product) => ({
    '@type': 'Product',
    name: displayTitle(product),
    description: product.summary || undefined,
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
  return products.map((product) => `<tr>
    <td class="table-product">${esc(displayTitle(product, 46))}</td>
    <td>${esc(product.relatedCandidate ? '関連候補' : recommendedType(product, note))}</td>
    <td>${esc(yen(product.price))}</td>
    <td>${esc(product.reviewAverage || '-')}</td>
    <td>${esc(product.reviewCount || 0)}</td>
    <td>${esc(storageYears(product))}</td>
    <td>${esc(extractSpec(product))}</td>
    <td>${esc(targetPeople(product))}</td>
    <td>${esc(suitedFacility(product, note))}</td>
    <td>${esc(product.relatedCandidate ? `関連候補: ${product.relatedFrom || '関連ページ'}から補完` : cautionForProduct(product))}<br><span class="notice">根拠: ${esc(recommendationBasis(product))}</span><br><a class="small-button" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, note.title)}>詳細</a></td>
  </tr>`).join('');
}

function webPageJsonLd(title, description, canonical) {
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
      <p class="price">${yen(product.price)}</p>
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
      <a class="button orange" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, note.title)}>楽天で価格・在庫を確認する</a>
    </div>
  </article>`).join('');
}

function faqSection(note) {
  const items = faqItems(note).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  return `<section class="section faq"><h2>FAQ</h2>${items}</section>`;
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
  <section class="section card"><h2>注意点</h2><p>${esc(requiredNotice)}</p><p>このページの数量計算は目安です。実際には建物の規模、滞在人数、地域リスク、保管場所、自治体や業界ルールに合わせて調整してください。</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。リンク先で購入された場合、サイト運営者に成果報酬が発生することがあります。</p></section>
  ${faqSection(note)}
  ${relatedLinks(note.related)}
  ${structuredData(
    webPageJsonLd(page.title, description, canonical),
    breadcrumbJsonLd([{ name: page.title, url: canonical }]),
    faqJsonLd(faqItems(note)),
    itemListJsonLd(products, canonical),
    productJsonLd(products)
  )}`;
  return layout(page.title, body, description, canonical, { crumbs: [page.title], ogImage: products.find((product) => product.image)?.image || '' });
}

function topicHtml(topic) {
  const canonical = `${siteUrl}/topics/${topic.slug}.html`;
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
  <section class="section" id="related"><div class="section-title"><div><p class="eyebrow">関連する比較ページ</p><h2>用途別に詳しく比較する</h2></div></div><div class="grid">${linkCards}</div></section>
  ${faqSection(topic)}
  <section class="section card"><h2>注意点</h2><p>${esc(requiredNotice)}</p><p>このページは災害別の入口です。実際の商品比較は、関連する比較ページで価格、レビュー、容量、回数、保存年数を確認してください。</p></section>
  ${structuredData(
    webPageJsonLd(topic.title, topic.lead, canonical),
    breadcrumbJsonLd([{ name: topic.title, url: canonical }]),
    faqJsonLd(faqItems(topic))
  )}`;
  return layout(topic.title, body, topic.lead, canonical, { crumbs: [topic.title] });
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

const heroProductCards = heroProducts.map((product) => `<a class="hero-product" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, 'トップ')}>
  <img src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">
  <span>${esc(displayTitle(product, 34))}</span>
</a>`).join('');

const showcaseProducts = [
  firstProduct('office-bichiku', /防災|備蓄|保存水|非常食/),
  firstProduct('toilet-office', /トイレ|凝固|防臭/),
  firstProduct('blackout-power', /電源|Wh|ライト|ランタン/)
].filter(Boolean);

const showcaseCards = showcaseProducts.map((product) => `<a class="showcase-card" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener" ${productTrackingAttrs(product, 'トップ')}>
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
    `${siteUrl}/`
  ),
  itemListJsonLd(showcaseProducts, `${siteUrl}/`),
  productJsonLd(showcaseProducts),
  faqJsonLd(homeFaq.map((item) => [item.question, item.answer]))
)}`;

fs.writeFileSync(path.join(dist, 'index.html'), layout(
  '事業所の防災備蓄は何を何日分？会社・店舗向け用品比較',
  indexBody,
  '会社、店舗、保育園、介護施設、飲食店の防災備蓄を、人数と待機日数から確認。地震、台風、停電、断水に備える簡易トイレ、保存水、非常食、ポータブル電源を比較できます。',
  `${siteUrl}/`,
  { ogImage: showcaseProducts.find((product) => product.image)?.image || '' }
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
  ...data.pages.map((page) => `${siteUrl}/pages/${page.slug}.html`),
  ...topicPages.map((topic) => `${siteUrl}/topics/${topic.slug}.html`)
];
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log('built', dist);
