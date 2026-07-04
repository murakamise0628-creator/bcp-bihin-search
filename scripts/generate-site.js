const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const siteUrl = (process.env.SITE_URL || 'https://jigyousho-bousai.com').replace(/\/$/, '');
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

const requiredNotice = '当サイトは、事業所向け防災用品を比較しやすくするための情報サイトです。価格、在庫、レビュー、商品仕様は変動する場合があります。購入前に必ず販売ページで最新情報を確認してください。医療機器、介護機器、食品アレルギー、施設運用に関わる備蓄については、メーカー、専門業者、施設管理者に確認してください。';

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
    .hero{background:linear-gradient(135deg,#fff 0%,#fff7ed 100%);border:1px solid #eadfce;border-radius:8px;padding:34px;box-shadow:0 14px 34px rgba(31,35,30,.09)}.visual-hero{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(320px,.72fr);gap:28px;align-items:center;overflow:hidden}.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.hero-visual{display:grid;gap:12px}.shelf-photo{position:relative;min-height:280px;border-radius:8px;overflow:hidden;background:linear-gradient(160deg,#123f46,#0d6258 48%,#f4a261 49%,#fff7ed);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28)}.shelf-photo:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,34,38,.1),rgba(8,34,38,.64))}.shelf-label{position:absolute;left:18px;right:18px;bottom:18px;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.35)}.shelf-label strong{display:block;font-size:22px;line-height:1.35}.hero-products{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.hero-product{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px;min-width:0}.hero-product img{width:100%;height:96px;object-fit:contain}.hero-product span{font-size:12px;font-weight:900;line-height:1.45;color:var(--ink)}.trust-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.trust-row div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}.trust-row strong{display:block;color:var(--main);font-size:18px}.trust-row span{font-size:13px;color:var(--muted)}
    .eyebrow{font-size:13px;font-weight:900;color:var(--main2);margin:0 0 8px}h1{font-size:clamp(30px,5vw,48px);line-height:1.25;margin:0 0 14px;letter-spacing:0}h2{font-size:24px;line-height:1.35;margin:0 0 12px}h3{font-size:18px;line-height:1.45;margin:0 0 8px}.lead{font-size:18px;max-width:890px}.muted{color:var(--muted)}.section{margin-top:28px}.section-title{display:flex;justify-content:space-between;gap:14px;align-items:end;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:22px;box-shadow:0 10px 24px rgba(29,38,34,.06)}.card h2 a,.card h3 a{text-decoration:none;color:var(--ink)}.card h2 a:hover,.card h3 a:hover{text-decoration:underline}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;background:var(--main2);color:white;border-radius:8px;text-decoration:none;font-weight:900;box-shadow:0 8px 16px rgba(13,98,88,.18)}.button.orange{background:var(--accent);box-shadow:0 8px 16px rgba(228,123,36,.18)}.button.secondary{background:#fff;color:var(--main2);border:1px solid var(--main2);box-shadow:none}.button.block{width:100%}
    .chip-row{display:flex;gap:9px;flex-wrap:wrap}.chip,.pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 11px;font-size:13px;font-weight:900;text-decoration:none}.chip{background:#fff;color:var(--main);border:1px solid var(--line)}.chip.active,.pill.orange{background:var(--accent-soft);border:1px solid #f4c497;color:#9b4d08}.pill{background:#e9f3f1;color:var(--main2);border:1px solid #cfe2de}.pill.navy{background:#e9eef2;color:var(--main);border-color:#cbd8de}
    .search-box{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:18px}.search-box input{min-height:48px;border:1px solid var(--line);border-radius:8px;padding:0 14px;font-size:16px;background:#fff}.mini-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.mini-stats div,.estimate-grid div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.mini-stats strong,.estimate-grid strong{display:block;font-size:24px;color:var(--main)}
    .checklist{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0 0;padding:0;list-style:none}.checklist li{background:#f6faf8;border:1px solid #d9e7e3;border-radius:8px;padding:12px 14px}.steps{counter-reset:step;display:grid;gap:10px;margin:0;padding:0;list-style:none}.steps li{counter-increment:step;padding:12px 14px;border-left:4px solid var(--accent);background:#fffaf4;border-radius:0 8px 8px 0}.steps li:before{content:counter(step) ". ";font-weight:900;color:var(--accent)}
    .two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.category-card{display:flex;flex-direction:column;gap:10px}.category-card .count{margin-top:auto;color:var(--muted);font-size:13px}.popular-card{border-top:5px solid var(--accent)}.scenario-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.scenario-card{display:grid;grid-template-columns:86px 1fr;gap:14px;align-items:center}.scenario-card img{width:86px;height:86px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px}.buyer-path{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.path-card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px}.path-card strong{display:block;font-size:18px;color:var(--main);margin-bottom:6px}.source-panel{background:#eef7f4;border:1px solid #cfe2de}.source-panel a{font-weight:900}.hero-kicker{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 12px;font-size:13px;font-weight:900;color:var(--main);margin-bottom:12px}.concern-list{display:grid;gap:8px;margin:18px 0 0;padding:0;list-style:none}.concern-list li{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-weight:800}.concern-list span{color:var(--accent);font-weight:900}.hero-showcase{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px;box-shadow:0 18px 42px rgba(20,37,36,.12)}.showcase-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.showcase-head strong{font-size:18px;color:var(--main)}.showcase-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.showcase-card{min-height:178px;border:1px solid var(--line);border-radius:8px;background:#fbfcfb;padding:10px;display:grid;grid-template-rows:104px auto;gap:8px}.showcase-card:first-child{grid-row:span 2;grid-template-rows:220px auto}.showcase-card img{width:100%;height:100%;object-fit:contain;background:#fff;border-radius:7px}.showcase-card span{font-size:13px;font-weight:900;line-height:1.45}.field-note{margin-top:10px;background:#fff7ed;border:1px solid #f4c497;border-radius:8px;padding:12px}.field-note strong{display:block;color:#9b4d08}.starter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.starter-card{display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center}.starter-card img{width:96px;height:96px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:7px}.starter-card h3{margin-bottom:4px}.starter-card .small-button{margin-top:8px}.editor-note{border-left:5px solid var(--accent);background:#fff}.human-copy{font-size:17px}.check-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.check-strip div{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.check-strip strong{display:block;color:var(--main);font-size:18px}.check-strip span{display:block;color:var(--muted);font-size:13px}
    .compare-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:#fff}.compare-table{width:100%;min-width:980px;border-collapse:collapse}.compare-table th,.compare-table td{padding:12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.compare-table th{background:#f2f6f5;color:var(--main);font-size:13px}.compare-table tr:last-child td{border-bottom:0}.table-product{font-weight:900;max-width:260px;overflow-wrap:anywhere}.small-button{display:inline-flex;min-height:36px;align-items:center;padding:7px 10px;border-radius:7px;background:var(--main2);color:white;text-decoration:none;font-weight:900;white-space:nowrap}
    .product-list{display:grid;gap:14px}.product{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:start}.product-img{width:150px;height:150px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px}.product-img.placeholder{display:flex;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:13px;background:#f6f6f2}.product h2{font-size:20px;overflow-wrap:anywhere}.summary{margin:8px 0;color:#33423b}.price{font-size:24px;font-weight:900;color:var(--main);margin:8px 0}.facts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.fact{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:13px;background:#fbfcfb;color:#33423b}.spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0}.spec-grid div{background:#f8faf8;border:1px solid var(--line);border-radius:8px;padding:8px}.spec-grid span{display:block;font-size:12px;color:var(--muted)}.spec-grid strong{display:block;color:var(--ink)}.notice{font-size:13px;color:var(--muted)}.empty{border:1px dashed #d6b681;background:#fffaf4}.ad-note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}.calc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.calc-grid label{display:grid;gap:6px;font-weight:900}.calc-input{min-height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-size:16px}.estimate-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:14px}.estimate-grid span,.estimate-grid small{display:block;color:var(--muted)}.faq details{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.faq details+details{margin-top:10px}.faq summary{font-weight:900;cursor:pointer}.link-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.link-list a{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px;text-decoration:none;font-weight:900;color:var(--main)}
    @media(max-width:760px){main{padding:16px 12px 44px}.site-head{align-items:flex-start;flex-direction:column}.hero{padding:24px}.visual-hero{grid-template-columns:1fr}.shelf-photo{min-height:210px}.hero-products{grid-template-columns:repeat(3,minmax(88px,1fr));overflow-x:auto}.trust-row{grid-template-columns:1fr}.lead{font-size:16px}.section-title{display:block}.two,.three{grid-template-columns:1fr}.search-box{grid-template-columns:1fr}.scenario-card{grid-template-columns:72px 1fr}.scenario-card img{width:72px;height:72px}.showcase-grid{grid-template-columns:1fr}.showcase-card:first-child{grid-row:auto;grid-template-rows:150px auto}.showcase-card{grid-template-rows:130px auto}.starter-card{grid-template-columns:82px 1fr}.starter-card img{width:82px;height:82px}.product{grid-template-columns:104px 1fr;gap:12px}.product-img{width:104px;height:104px}.product h2{font-size:17px}.nav{gap:8px}.hero-actions .button{width:100%}.card{padding:18px}}
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
    inLanguage: 'ja'
  });
}

function structuredData(...items) {
  return items.filter(Boolean).join('');
}

function comparisonRows(products, note) {
  if (!products.length) {
    return `<tr><td colspan="10"><strong>商品候補の取得改善が必要です。</strong><br>このページは選び方・必要数量・確認ポイントを先に掲載し、次の段階で複数キーワード取得により比較候補を増やします。</td></tr>`;
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
    <td>${esc(product.relatedCandidate ? `関連候補: ${product.relatedFrom || '関連ページ'}から補完` : cautionForProduct(product))}<br><span class="notice">根拠: ${esc(recommendationBasis(product))}</span><br><a class="small-button" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener">詳細</a></td>
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
    return `<article class="card empty"><p class="pill orange">次に商品取得を改善</p><h2>比較候補を増やす必要があります</h2><p>このページは現時点で商品候補が不足しています。UI上では選び方・必要数量・FAQを表示し、次工程で検索キーワードを増やして商品候補を補強します。</p></article>`;
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
      <a class="button orange" href="${esc(product.url)}" target="_blank" rel="nofollow sponsored noopener">楽天で価格・在庫を確認する</a>
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
  return layout(page.title, body, description, canonical, { crumbs: [page.title] });
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

const heroProductCards = heroProducts.map((product) => `<article class="hero-product">
  <img src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">
  <span>${esc(displayTitle(product, 34))}</span>
</article>`).join('');

const showcaseProducts = [
  firstProduct('office-bichiku', /防災|備蓄|保存水|非常食/),
  firstProduct('toilet-office', /トイレ|凝固|防臭/),
  firstProduct('blackout-power', /電源|Wh|ライト|ランタン/)
].filter(Boolean);

const showcaseCards = showcaseProducts.map((product) => `<article class="showcase-card">
  <img src="${esc(product.image)}" alt="${esc(displayTitle(product))}" loading="lazy">
  <span>${esc(displayTitle(product, 38))}</span>
</article>`).join('');

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

const starterCards = [
  starterCard('まず不足しやすい', '簡易トイレ', 'toilet-office', firstProduct('toilet-office', /トイレ|凝固/), '断水後に買い足しが難しいため、人数と回数で先に確認。'),
  starterCard('停電が不安なら', 'ポータブル電源・ライト', 'blackout-power', firstProduct('blackout-power', /電源|Wh/), '通信、照明、受付端末など最低限使いたい機器から逆算。'),
  starterCard('帰れない日に備える', '保存水・非常食', 'water-food-stock', firstProduct('water-food-stock', /保存水|非常食/), '従業員と来客が残る前提で、日数と保管場所を確認。')
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

const indexBody = `<section class="hero visual-hero">
  <div>
    <span class="hero-kicker">防災担当者・店長・施設管理者向け</span>
    <h1>地震・台風・停電・断水に備える 事業所防災用品比較</h1>
    <p class="lead">「何を何個買えばいいか」が曖昧なまま、防災セットだけを買って終わらせないための比較サイトです。社員が帰れない日、トイレが使えない日、停電で連絡が取れない日から逆算して、必要な備蓄と商品候補を確認できます。</p>
    <ul class="concern-list">
      <li><span>地震:</span> 交通停止で従業員や来客が社内に残る</li>
      <li><span>断水:</span> トイレ、手洗い、飲食店の営業判断に直結する</li>
      <li><span>停電:</span> 照明、スマホ充電、通信機器が止まりやすい</li>
    </ul>
    <div class="hero-actions">
      <a class="button orange" href="${siteUrl}/pages/earthquake-office.html">地震対策を見る</a>
      <a class="button" href="${siteUrl}/pages/blackout-power.html">停電対策を見る</a>
      <a class="button secondary" href="${siteUrl}/pages/toilet-office.html">簡易トイレを比較する</a>
      <a class="button secondary" href="#quantity">人数別の備蓄目安を見る</a>
    </div>
    <div class="hero-meta">
      <span class="pill navy">比較ページ: ${data.pages.length}件</span>
      <span class="pill orange">商品候補: ${totalProducts}件</span>
      <span class="pill">全ページ12件表示</span>
      <span class="pill">最終更新: ${esc(updatedDate())}</span>
    </div>
    <div class="search-box"><input id="siteSearch" type="search" placeholder="例: 地震、台風、停電、断水、保育園、トイレ"><a class="button" href="#categories">探す</a></div>
  </div>
  <aside class="hero-showcase" aria-label="比較できる防災用品の例">
    <div class="showcase-head"><strong>実際に比較する備蓄候補</strong><span class="pill">楽天商品データから表示</span></div>
    <div class="showcase-grid">${showcaseCards}</div>
    <div class="field-note"><strong>先に決めるのは商品名ではなく、人数・日数・使う場面。</strong><span>そのあとで価格、レビュー件数、容量、保存年数を横並びで見ます。</span></div>
  </aside>
</section>
<section class="section">
  <div class="section-title"><div><p class="eyebrow">初めての人へ</p><h2>まず、自分の事業所で起きそうな困りごとから選ぶ</h2></div></div>
  <div class="scenario-grid">${scenarioCards}</div>
</section>
<section class="section">
  <div class="section-title"><div><p class="eyebrow">最初に買い漏れやすいもの</p><h2>防災棚に入れる前に、用途別に比較する</h2></div></div>
  <div class="starter-grid">${starterCards}</div>
</section>
<section class="section check-strip">
  <div><strong>人数で確認</strong><span>水・食料・簡易トイレは、従業員と来客数を入れて目安を出せます。</span></div>
  <div><strong>用途で比較</strong><span>地震、台風、停電、断水、帰宅困難者の場面ごとに入口を分けています。</span></div>
  <div><strong>購入前に確認</strong><span>価格、在庫、レビュー、仕様は販売ページで最新情報を確認する前提です。</span></div>
  <div><strong>不足を見つける</strong><span>「セットを買ったから大丈夫」ではなく、トイレ回数や電源容量まで確認します。</span></div>
</section>
<section class="section card editor-note">
  <h2>このサイトで先に見てほしいこと</h2>
  <p class="human-copy">防災用品は「安いセット」だけで選ぶと、人数に対してトイレが足りない、保存水が重すぎて置き場所がない、停電時に使いたい機器の容量が足りない、というズレが起きます。ここでは商品リンクの前に、人数、日数、用途、レビュー件数、容量を並べて確認できるようにしています。</p>
</section>
<section class="section card source-panel">
  <h2>備蓄の考え方は、公的資料の視点も参考にしています</h2>
  <p>食品備蓄は、長期保存品を置くだけではなく、日頃の活用、保管、要配慮者への対応まで含めて考える必要があります。事業所ではそこに、停電時の電源、断水時のトイレ、帰宅困難者の待機用品を加えて確認します。</p>
  <p class="notice">参考: <a href="https://www.maff.go.jp/j/zyukyu/foodstock/guidebook.html" target="_blank" rel="noopener">農林水産省「災害時に備えた食品ストックガイド」</a> / <a href="https://www.bousai.go.jp/kyoiku/hokenkyousai/jishin.html" target="_blank" rel="noopener">内閣府 防災情報</a></p>
</section>
<section class="section" id="disasters">
  <div class="section-title"><div><p class="eyebrow">災害別チップ</p><h2>まずは起きる場面から選ぶ</h2></div></div>
  <div class="chip-row">
    <a id="地震" class="chip active" href="${siteUrl}/topics/earthquake.html">地震</a>
    <a id="台風" class="chip active" href="${siteUrl}/topics/typhoon.html">台風</a>
    <a id="停電" class="chip active" href="${siteUrl}/topics/power-outage.html">停電</a>
    <a id="断水" class="chip active" href="${siteUrl}/topics/water-outage.html">断水</a>
    <a id="帰宅困難者" class="chip active" href="${siteUrl}/topics/commuter-stranding.html">帰宅困難者</a>
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
<section class="section card"><h2>比較サイトとしての見方</h2><p>商品名だけではなく、人数、待機日数、用途、容量、回数、保存年数、レビュー件数を合わせて確認してください。0件または1件のページは関連候補を明確に分け、次回の商品取得で補強します。</p><p>${esc(requiredNotice)}</p><p class="ad-note">このサイトは楽天アフィリエイトを利用しています。価格・在庫・レビューは変動するため、購入前にリンク先で最新情報を確認してください。</p></section>
${structuredData(
  websiteJsonLd(),
  webPageJsonLd(
    '地震・台風・停電・断水に備える 事業所防災用品比較',
    '会社、店舗、保育園、介護施設、飲食店向けに、防災備蓄品を人数・用途・災害別に比較できます。',
    `${siteUrl}/`
  )
)}`;

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
