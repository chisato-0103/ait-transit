# DC-Exercise Next.js 移行 引き継ぎドキュメント

**最終更新**: 2026-05-31  
**作業状況**: Phase 1 完了（コア機能移植済み・ビルド成功）

---

## 完了した作業

| 作業 | 状態 |
|------|------|
| リポジトリ clone（~/src/github.com/chisato-0103/DC-Exercise） | ✅ |
| Next.js 16 + App Router + TypeScript セットアップ | ✅ |
| SQLデータ → JSON変換（shuttle_bus_timetable / linimo_timetable / stations / shuttle_schedule） | ✅ |
| PHPロジック → TypeScript移植（src/lib/timetable.ts） | ✅ |
| API Routes（/api/next-connection、/api/stations） | ✅ |
| メインページ UI（src/components/MainClient.tsx） | ✅ |
| お問い合わせページ（Formspree対応） | ✅ |
| Vercel設定ファイル（vercel.json） | ✅ |
| `npx next build` 成功確認 | ✅ |

---

## 移行先プロジェクトの場所

```
~/src/github.com/chisato-0103/dc-exercise-next/
├── src/
│   ├── app/
│   │   ├── page.tsx               # トップページ（Suspenseラッパー）
│   │   ├── layout.tsx             # ルートレイアウト
│   │   ├── globals.css            # 全スタイル
│   │   ├── contact/page.tsx       # お問い合わせ（Formspree）
│   │   └── api/
│   │       ├── next-connection/route.ts  # 次の便API
│   │       └── stations/route.ts         # 駅一覧API
│   ├── components/
│   │   └── MainClient.tsx         # メインUI（Client Component）
│   ├── lib/
│   │   └── timetable.ts           # 全ロジック（PHPからの移植）
│   └── data/                      # SQLから変換したJSONファイル
│       ├── shuttle_bus_timetable.json  (176件)
│       ├── linimo_timetable.json       (4156件)
│       ├── stations.json               (30駅)
│       └── shuttle_schedule.json       (365日分, FY2025)
├── vercel.json
├── .env.example
└── HANDOFF.md
```

---

## 次回やること（優先順）

### 1. GitHubに新リポジトリを作ってpush

```bash
cd ~/src/github.com/chisato-0103/dc-exercise-next
git init
git add .
git commit -m "initial: Next.js migration from PHP"
# GitHubで dc-exercise-next リポジトリを作成後:
git remote add origin https://github.com/chisato-0103/dc-exercise-next.git
git push -u origin main
```

### 2. Vercelにデプロイ

1. https://vercel.com → Import Repository → dc-exercise-next を選択
2. Environment Variables に `NEXT_PUBLIC_FORMSPREE_ID` を設定
   - Formspree（https://formspree.io）でフォームを作成し、IDを取得
3. Deploy

### 3. 未実装・要改善の機能

| 機能 | 対応方針 |
|------|---------|
| 愛知環状線（aichi_kanjo）のルート計算 | sql/rebuild_aichi_kanjo_rail_timetable.sql をJSONに変換してtimetable.tsに実装 |
| お知らせ機能（notices） | 静的JSONで管理するか、Supabase等の無料DBを利用 |
| FY2026以降のシャトルスケジュール | shuttle_schedule.jsonを更新（現在FY2025のみ） |
| お問い合わせ | Formspree IDを設定するだけで動作 |
| テスト用URL | `/?test_date=2025-10-15&test_time=09:00:00` で特定日時をシミュレート可能 |

### 4. 愛知環状線JSONの生成（必要な場合）

```bash
cd ~/src/github.com/chisato-0103/DC-Exercise
# rebuild_aichi_kanjo_rail_timetable.sql をパースして
# dc-exercise-next/src/data/aichi_kanjo_timetable.json を生成
python3 /tmp/sql_to_json.py  # 上記で使ったスクリプトを流用・改修
```

---

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイル**: グローバルCSS（Tailwindなし、元のCSSを移植）
- **データ**: JSONファイル（DBなし）
- **デプロイ**: Vercel
- **お問い合わせ**: Formspree（無料プランで月50件）

---

## データの更新方法

時刻表データを変更したい場合：
1. `src/data/*.json` を直接編集
2. `git commit && git push` するだけでVercelが自動デプロイ

SQLファイルから再生成したい場合は、プロジェクトルートに `scripts/sql_to_json.py` を作成して管理するのを推奨。

---

## ビルド・起動コマンド

```bash
cd ~/src/github.com/chisato-0103/dc-exercise-next

# 開発サーバー
npm run dev

# 本番ビルド確認
npm run build
npm run start
```
