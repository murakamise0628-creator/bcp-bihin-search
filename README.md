# 事業所防災ナビ Autopilot

楽天市場の商品データを取得し、会社・店舗・施設向け防災用品の比較ページを自動生成します。

## GitHub Secrets に入れるもの

商品更新:

- `RAKUTEN_APP_ID`: 楽天 Developers の Application ID
- `RAKUTEN_ACCESS_KEY`: 楽天 Developers の Access Key
- `RAKUTEN_AFFILIATE_ID`: 楽天 Developers または楽天アフィリエイトで確認できる Affiliate ID

週次KPIと需要判定:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: GA4、Search Console、Google Sheetsに必要なサービスアカウントJSON
- `GA4_PROPERTY_ID`: 数字だけのGA4プロパティID。測定ID（`G-...`）ではありません
- `GOOGLE_KPI_SHEET_ID`: 非公開の記録先Google Sheet ID

サービスアカウントには、対象GA4とSearch Consoleの閲覧権限、記録先Sheetの編集権限が必要です。

## 商品更新

1. `data/keywords.csv` のキーワードを読む
2. 楽天 Ichiba Item Search API から商品を取得
3. レビュー数・レビュー平均・価格帯で商品を採点
4. `dist/` にトップページ、商品比較ページ、`sitemap.xml`、`CNAME` を生成
5. GitHub Actions が `dist/` の中身を公開ルートへ反映

手動確認:

```bash
npm run update
```

## 週次の需要判定

`Weekly growth KPI`は、実行時に気象庁の公式フィードを取得できることを確認したうえで、GSC、GA4、自然検索経由の`rakuten_click`をページ単位で結合します。公式フィードを取得・検証できない場合はfail-closedで下書きを保存しません。その後、次の条件で毎回1ページだけを選びます。

- 実測された検索表示、自然検索セッション、楽天クリックのいずれかが基準を満たす
- または、`data/demand-signals.json`に新鮮な検証済み公式シグナルがある
- 根拠がなければ`NO_ACTION`
- `visibility_gap`単独では生成しない
- 発災中の緊急警報は商品訴求へ利用しない
- 同じ判断はクールダウン中に再生成しない

結果は非公開Sheetの`Demand Actions`タブに、ページ改善指示1件とThreads下書き3案として保存されます。Threadsへの自動投稿機能はありません。

外部シグナルは、公式HTTPS URL、確認日時、対象トピック、`verified`状態が揃ったものだけが有効です。推測やニュース転載は入れません。

検証:

```bash
npm run test:kpi
npm run test:demand
npm run test:safety
npm run verify
```

## キーワード追加

`data/keywords.csv` に行を追加すると、次回更新で比較ページが増えます。

```csv
slug,title,keyword,intent
clinic-power,小規模クリニック向け停電対策用品比較,小規模クリニック 停電 対策,購入前比較
```

## 公開URL

https://jigyousho-bousai.com/
