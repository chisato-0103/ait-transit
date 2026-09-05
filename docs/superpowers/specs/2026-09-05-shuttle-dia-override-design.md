# シャトルバス 臨時ダイヤ上書き機能 設計書

作成日: 2026-09-05

## 背景と目的

シャトルバスの運行ダイヤ種別（A / B / C / holiday）は
`src/data/shuttle_schedule.json` に日付ごとに事前登録されている。
しかし大学都合の急な変更や登録ミスにより、
「その日に適用されるダイヤ種別」が実態と食い違うことがある。

本アプリは「嘘の時刻を1件でも出したら信頼を失う」ことを最優先方針としているため、
誤りに気づいてから数十秒で管理者が手動修正できる経路を用意する。

対象は **日付に対するダイヤ種別の割当のみ**。
個別便の時刻修正・便の追加削除・運休フラグは本仕様の対象外とする。

## スコープ

### やること
- 日付単位でダイヤ種別を上書きするデータファイルを新設
- 管理画面（`/admin`）から上書きの追加・削除・保存
- サーバー側の乗継計算に上書きを反映（再デプロイ不要、数十秒以内）

### やらないこと
- 個別便の時刻編集、便の追加・削除、運休フラグ
- 一般利用者画面での「臨時ダイヤ」表示（UI変更なし）
- リニモ・愛知環状鉄道のダイヤ上書き

## データ設計

新規ファイル: `src/data/shuttle_dia_overrides.json`

```json
[
  {
    "operation_date": "2026-09-04",
    "dia_type": "B",
    "memo": "大雪のため臨時B",
    "updated_at": "2026-09-04T08:12:00+09:00"
  }
]
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `operation_date` | string | ○ | `YYYY-MM-DD`。実在する日付のみ |
| `dia_type` | string | ○ | `A` \| `B` \| `C` \| `holiday` |
| `memo` | string | - | 管理者向けの記録。100字まで。利用者には表示しない |
| `updated_at` | string | ○ | ISO8601。保存時にサーバーが付与 |

`shuttle_schedule.json` を直接書き換えず別ファイルにする理由:

- 公式データを再取得して全面置換しても手動上書きが巻き添えで消えない
- 人手で変えた箇所が1ファイルに集約され、差分明示のルールに合う
- 取り消しが該当行の削除だけで済み、ロールバックが安全

## 適用ロジック

`src/lib/timetable.ts` の `getDiaType` にオプション引数を追加する。

```ts
export interface DiaOverride {
  operation_date: string;
  dia_type: DiaType;
  memo?: string;
  updated_at: string;
}

export function getDiaType(dateStr: string, overrides?: DiaOverride[]): DiaType
```

優先順位:

1. `overrides` に一致する日付があればその `dia_type`
2. `shuttle_schedule.json` に一致する日付があればその `dia_type`
3. 曜日・月による既定ルール（現行の実装のまま）

引数を省略した場合は現行と完全に同じ動作になるため、
既存の呼び出し箇所と既存テストは無改修で通る。

`getDayType` も同じ引数を受け取り `getDiaType` に委譲する。

## 反映経路

保存は既存の `src/lib/adminStore.ts` をそのまま使う
（ローカルFSに書き込み、読み取り専用環境ではGitHub Contents APIでcommit）。

読み出しのため `src/lib/diaOverrides.ts` を新設する。

```ts
export async function getDiaOverrides(): Promise<DiaOverride[]>
```

- ローカル環境: `fs` で `src/data/shuttle_dia_overrides.json` を読む
- Vercel上: GitHub Contents API（`GET /repos/{repo}/contents/{path}?ref=main`）で取得
  - `next: { tags: ["dia-overrides"], revalidate: 60 }` を付与
  - `GITHUB_TOKEN` / `GITHUB_REPO` は既存の環境変数を流用
- 管理APIのPUT成功時に `revalidateTag("dia-overrides")` を呼び、次リクエストから反映
- `revalidate: 60` は別インスタンス・別リージョン向けの保険

`raw.githubusercontent.com` は CDN が最大5分古い内容を返すため使わない。

呼び出し箇所は以下の2つ。

- `src/app/api/next-connection/route.ts`: `getDiaType(dateStr, overrides)` として渡す
- `src/app/api/admin/overview/route.ts`: 管理画面に実効値を表示するため同様に渡す

## 管理画面

`/admin` に「シャトル臨時ダイヤ」セクションを追加する。既存の告知セクションと同じ操作感にする。

- 一覧テーブル: 日付 / ダイヤ / メモ / 削除ボタン。日付昇順、過去日はグレー表示
- 追加フォーム: 日付（`<input type="date">`）、ダイヤ（セレクト）、メモ（任意）
- 「保存」で配列を丸ごと `PUT`（告知と同じ全件置換方式）
- セクション上部に「本日のダイヤ: A → B（臨時）」と実効値を表示し、
  修正が効いているかをその場で確認できるようにする

## API

`src/app/api/admin/dia-overrides/route.ts`

| メソッド | 動作 |
|---|---|
| `GET` | 現在の上書き一覧を返す |
| `PUT` | 全件置換。検証 → `saveDataFile()` → `revalidateTag("dia-overrides")` |

認証は既存の `checkAdminAuth()` をそのまま使う。
`ADMIN_PASSWORD` 未設定時は既存同様 503 を返す。

## バリデーション

保存時（PUT）はサーバー側で全件を検証し、
1件でも不正があれば 400 を返して**何も保存しない**（部分適用しない）。

- `operation_date`: `YYYY-MM-DD` 形式かつ実在する日付（`2026-02-30` は拒否）
- `dia_type`: `A` / `B` / `C` / `holiday` 以外は拒否
- 同一 `operation_date` の重複は拒否（どちらが優先か曖昧にしないため）
- 配列長は 100 件まで
- `memo`: 100字まで、省略可

読み出し側（`getDiaOverrides`）でも同じ形式検証を通し、
不正な行は捨てて残りを使う。日付が重複していた場合は配列の先頭にある行を採用する。
保存時に検証済みのため通常は発生しないが、手作業でJSONを編集した場合の保険とする。

## エラー処理

| 状況 | 挙動 |
|---|---|
| GitHub取得失敗 | ビルド同梱のJSONにフォールバックし `console.warn` |
| JSONパース失敗 | 空配列として扱い（公式データのまま）`console.warn` |
| `ADMIN_PASSWORD` 未設定 | 503（既存挙動のまま） |
| 保存失敗 | `SaveResult.detail` を管理画面にそのまま表示 |

上書きが取得できない場合は「公式登録データのまま」になる。
アプリを停止させるより、既知のデータで動かし続ける方を選ぶ。

## テスト

`scripts/timetable.test.ts` に追記する（既存の tsx + assert 形式に合わせる）。

1. 上書きあり → 上書きの `dia_type` を返す
2. 上書きなし → `shuttle_schedule.json` の値を返す（既存動作の回帰）
3. 日付が一致しない上書き → 影響しない
4. 不正な `dia_type` を含む行 → 無視して既定値を返す
5. 上書きを適用した状態で乗継計算が該当ダイヤの便を返す

加えて以下を実施する。

- `npx tsc --noEmit`
- `npm run build`
- `npm test`

## 影響範囲

| ファイル | 変更 |
|---|---|
| `src/data/shuttle_dia_overrides.json` | 新規（初期値 `[]`） |
| `src/lib/diaOverrides.ts` | 新規 |
| `src/lib/timetable.ts` | `getDiaType` / `getDayType` に引数追加、`DiaOverride` 型を追加 |
| `src/app/api/admin/dia-overrides/route.ts` | 新規 |
| `src/app/api/next-connection/route.ts` | 上書きを取得して渡す |
| `src/app/api/admin/overview/route.ts` | 同上 |
| `src/app/admin/page.tsx` | セクション追加 |
| `scripts/timetable.test.ts` | テスト追記 |

一般利用者向けの `src/components/MainClient.tsx` は変更しない。
