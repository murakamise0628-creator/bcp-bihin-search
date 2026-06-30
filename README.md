# 事業所防災ナビ Autopilot

楽天市場の商品データを取得し、会社・店舗・施設向け防災用品の比較ページを自動生成します。

## GitHub Secrets に入れるもの

- `RAKUTEN_APP_ID`: 楽天 Developers の Application ID
- `RAKUTEN_AFFILIATE_ID`: 楽天 Developers または楽天アフィリエイトで確認できる Affiliate ID

## 動き

1. `data/keywords.csv` のキーワードを読む
2. 楽天 Ichiba Item Search API から商品を取得
3. レビュー数・レビュー平均・価格帯で商品を採点
4. `dist/` にトップページ、商品比較ページ、`sitemap.xml`、`CNAME` を生成
5. GitHub Actions が `dist/` の中身を公開ルートへ反映

## 手動実行

```bash
npm run update
```

## キーワード追加

`data/keywords.csv` に行を追加すると、次回更新で比較ページが増えます。

```csv
slug,title,keyword,intent
clinic-power,小規模クリニック向け停電対策用品比較,小規模クリニック 停電 対策,購入前比較
```

## 公開URL

https://jigyousho-bousai.com/
