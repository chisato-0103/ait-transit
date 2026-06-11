# ait-transit 引き継ぎドキュメント

**最終更新**: 2026-06-12
**作業状況**: 全フェーズ完了・運用中（PHPからのNext.js移行完了、Vercel自動デプロイ）

---

## 完了した作業

| 作業 | 状態 |
|------|------|
| Next.js 16 + App Router + TypeScript セットアップ | ✅ |
| SQLデータ → JSON変換（shuttle_bus / linimo / stations / shuttle_schedule） | ✅ |
| PHPロジック → TypeScript移植（src/lib/timetable.ts） | ✅ |
| API Routes（/api/next-connection、/api/stations、/api/notices） | ✅ |
| メインページ UI（src/components/MainClient.tsx）・スマホUI改善 | ✅ |
| お問い合わせページ（Formspree対応） | ✅ |
| GitHubリポジトリ（chisato-0103/ait-transit）・Vercel自動デプロイ | ✅ |
| 愛知環状線（aichi_kanjo）ルート計算（2942件） | ✅ |
| お知らせ機能（/api/notices） | ✅ |
| FY2026シャトルスケジュール（2026-04-01〜2027-03-31、365日分） | ✅ |
| リニモ時刻表の方向別データ補完（下記参照） | ✅ |

### リニモ時刻表の補完（2026-06-11〜12）

従来は八草・藤が丘（終端駅）の発車時刻がなく、到着時刻の流用や逆算で近似していた。
リニモ公式サイト（linimo.jp 駅別時刻表）から実データを取得して解消済み：

- `yakusa / to_fujigaoka`（平日130・休日129件）を追加、流用ロジック除去
- `fujigaoka / to_yagusa`（平日131・休日129件）を追加、逆算ロジック除去
- 全9駅×両方向のデータが揃った状態

---

## 残タスク・運用メモ

| 項目 | 内容 |
|------|------|
| FY2027シャトルスケジュール | 2027年3月までに shuttle_schedule.json を更新 |
| リニモ・愛環のダイヤ改正 | 改正時は公式ソースから再取得（CLAUDE.mdのデータ品質ルール参照） |
| Formspree | `NEXT_PUBLIC_FORMSPREE_ID` をVercelの環境変数で管理 |
| テスト用URL | `/?test_date=2025-10-15&test_time=09:00:00` で特定日時をシミュレート可能 |

## データ更新フロー

1. 時刻表データは**必ず公式ソースから取得**（記憶から生成しない）
2. `src/data/*.json` を更新
3. 検証: 独立再パースでの全件照合・ランダム5件の公式照合・機能テスト・`tsc --noEmit`
4. `git commit && git push` → Vercelが自動デプロイ

詳細は CLAUDE.md「データ品質ルール」を参照。

---

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイル**: グローバルCSS（Tailwindなし）
- **データ**: JSONファイル（DBなし）
- **デプロイ**: Vercel（push時に自動）
- **お問い合わせ**: Formspree（無料プランで月50件）

## ビルド・起動コマンド

```bash
npm run dev    # 開発サーバー
npm run build  # 本番ビルド確認
npm run start
```
