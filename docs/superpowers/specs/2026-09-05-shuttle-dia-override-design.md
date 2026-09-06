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
個別便の時刻修正・便の追加削除は本仕様の対象外とする。

## スコープ

### やること
- 日付単位でダイヤ種別を上書きするデータファイルを新設
- 管理画面（`/admin`）から上書きの追加・削除・保存
- サーバー側の乗継計算に上書きを反映（再デプロイを待たず数十秒以内）

### やらないこと（と、その理由）

| 項目 | 理由 |
|---|---|
| 個別便の時刻編集・便の追加削除 | 今回の対象外。必要になったら別仕様で扱う |
| 一般利用者画面での「臨時ダイヤ」表示 | 表示しない方針で決定済み。UI変更なし |
| リニモ・愛知環状鉄道のダイヤ上書き | 対象外 |
| 同時編集の排他制御（楽観ロック・409） | 管理者は実質1人。既存の告知機能と同じ全件置換方式に揃える |
| レート制限・監査ログ・トークン有効期限 | 既存の管理APIと同水準に留める。ここだけ強化しても全体の守りは上がらない |

## ダイヤ種別の意味（重要）

`shuttle_bus_timetable.json` に実際の便が存在するのは A / B / C のみで、
`holiday` の便は1件も存在しない。つまり:

- `A`: 授業期間平日
- `B`: 土曜日
- `C`: 学校休業期間の平日
- `holiday`: **運休日**（便が0件になる）

したがって「本日は臨時で全便運休」という緊急対応は、
その日を `holiday` に上書きすることで実現できる。

## データ設計

新規ファイル: `src/data/shuttle_dia_overrides.json`（初期値 `[]`）

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
| `operation_date` | string | ○ | `YYYY-MM-DD`。**JSTの運行日**。実在する日付のみ |
| `dia_type` | string | ○ | `A` \| `B` \| `C` \| `holiday` |
| `memo` | string | - | 管理者向けの記録。100字まで。利用者には表示しない |
| `updated_at` | string | ○ | `+09:00` オフセット付きISO8601。保存のたびにサーバーが全行へ付与する最終保存日時。入力値は採用しない |

`shuttle_schedule.json` を直接書き換えず別ファイルにする理由:

- 公式データを再取得して全面置換しても手動上書きが巻き添えで消えない
- 人手で変えた箇所が1ファイルに集約され、差分明示のルールに合う
- 取り消しが該当行の削除だけで済み、ロールバックが安全

日付の範囲は制限しない（過去日・将来日とも保存できる）。
過去日は履歴として残す用途があるため削除を強制せず、管理画面でグレー表示する。

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

日付またぎの扱いは現行のままとする。深夜0時台の便は
`shuttle_bus_timetable.json` 上その日のダイヤに属しており、
上書きは「JSTの運行日」単位でそのダイヤ種別ごと差し替えるだけである。

## 反映経路

### 保存

既存の `src/lib/adminStore.ts` の `saveDataFile()` をそのまま使う
（ローカルFSに書き込み、読み取り専用環境ではGitHub Contents APIでcommit）。

ただし `SaveResult.detail` の文言（「自動デプロイ後（数分）に反映されます」）は
本機能の実際の反映速度と食い違うため、そのまま画面に出さない。
臨時ダイヤAPIは自前のメッセージ（「保存しました。30秒以内に反映されます」）を返す。
GitHub commit は履歴とビルド同梱データの更新のために行うのであって、
反映のために自動デプロイを待つわけではない。

### 読み出し

`src/lib/diaOverrides.ts` を新設する。

```ts
export interface DiaOverrideSource {
  overrides: DiaOverride[];
  source: "local" | "github" | "stale" | "fallback";
  fetched_at: string | null;
}

export async function getDiaOverrides(): Promise<DiaOverrideSource>
export function expireDiaOverridesCache(): void
```

環境で経路を分ける。`readDataFile()` は使わない
（Vercelのビルド成果物にもファイルが存在しうるため、
何もしないとビルド時点の古い内容を読み続ける危険がある）。

- `process.env.VERCEL` が未設定（ローカル開発）: `fs` で読む。キャッシュしない
- `process.env.VERCEL` が設定済み: GitHub Contents API から取得する

GitHub Contents API の呼び出し仕様:

- `GET https://api.github.com/repos/{GITHUB_REPO}/contents/src/data/shuttle_dia_overrides.json?ref=main`
- ヘッダ: `Authorization: Bearer {GITHUB_TOKEN}`, `Accept: application/vnd.github+json`
- `fetch` は `cache: "no-store"`。タイムアウト5秒（`AbortSignal.timeout(5000)`）
- レスポンスの `type === "file"` を確認し、`content` をBase64デコードしてJSONパース
- 直前に取得した `ETag` を `If-None-Match` で送る。`304` ならキャッシュ値を継続利用し、
  GitHub APIのレート制限も消費しない

キャッシュはNext.jsのfetchキャッシュではなく、**モジュールスコープのメモリキャッシュ（TTL 30秒）** を使う。

- Next.js 16 の `revalidateTag` は第2引数に cacheLife プロファイルが必須になり、
  stale-while-revalidate 挙動のため「無効化直後の1リクエストが古い値を返す」可能性がある。
  誤ったダイヤを1回でも返したくないので採用しない
- メモリキャッシュならTTL経過後は必ず新しい値を取りに行く。最大遅延は30秒で要件を満たす
- Vercel の Fluid Compute はインスタンスを再利用するためキャッシュが実際に効く
- 保存API（PUT）の成功時に `expireDiaOverridesCache()` を呼ぶ。
  同一インスタンスでは即時、別インスタンスでも最大30秒で反映される

取得に失敗したときの優先順位は次のとおり。

1. 直前に取得できた内容がキャッシュに残っていれば**それを使い続ける**（`source: "stale"`、10秒後に再試行）
2. 一度も取得できていなければビルド同梱の静的import値（`source: "fallback"`）

キャッシュを空にせず期限切れにするだけなのはこのためである。
通信が一時的に切れただけで反映済みの緊急変更が取り消され、
誤ったダイヤに戻ってしまうことを防ぐ。
静的importは**フォールバック専用**であり、通常経路では使わない。

### 呼び出し箇所

- `src/app/api/next-connection/route.ts`: `getDiaType(dateStr, overrides)` として渡す
- `src/app/api/admin/overview/route.ts`: 管理画面に実効値を表示するため同様に渡す

## 管理画面

`/admin` に「シャトル臨時ダイヤ」セクションを追加する。既存の告知セクションと同じ操作感にする。

- セクション上部に実効値と取得状態を表示
  - 「本日のダイヤ: A → B（臨時）」
  - 「取得元: GitHub / 最終取得: 08:12:33」。`fallback` と `stale` のときは警告色で表示する
    （上書きが本番に届いていない状態を管理者が検知できるようにするため）
- 一覧の取得に失敗したときは「追加」「保存」を無効化する。
  空の一覧のまま全件置換すると、登録済みの緊急上書きをすべて消してしまうため
- 一覧テーブル: 日付 / ダイヤ / メモ / 削除ボタン。日付昇順、過去日はグレー表示
- 追加フォーム: 日付（`<input type="date">`、初期値は**JSTの今日**）、
  ダイヤ（`A` / `B` / `C` / `holiday` のセレクト。`holiday` は「運休日」と表示）、メモ（任意）
- 「保存」で配列を丸ごと `PUT`（告知と同じ全件置換方式）

`toISOString()` はUTC日付になりJSTの深夜帯で前日になるため、
日付の初期値は既存の `getTodayStr()` と同じJST基準の計算で求める。

## API

`src/app/api/admin/dia-overrides/route.ts`

| メソッド | 動作 |
|---|---|
| `GET` | 現在の上書き一覧と `source` / `fetched_at` を返す |
| `PUT` | 全件置換。検証 → `saveDataFile()` → `expireDiaOverridesCache()` |

認証は既存の `checkAdminAuth()` をそのまま使う。
`ADMIN_PASSWORD` 未設定時は既存同様 503 を返す。

## バリデーション

保存時（PUT）はサーバー側で全件を検証し、
1件でも不正があれば 400 を返して**何も保存しない**（部分適用しない）。

- リクエストボディがJSON配列でなければ拒否
- 配列長は 100 件まで
- `operation_date`: `YYYY-MM-DD` の正規表現に加え、
  UTCで分解して同じ年月日に戻ることを確認する往復検証を行う（`2026-02-30` を拒否）
- `dia_type`: `A` / `B` / `C` / `holiday` 以外は拒否
- 同一 `operation_date` の重複は拒否（どちらが優先か曖昧にしないため）
- `memo`: 100字（`Array.from()` によるコードポイント数）まで、省略可
- 既知フィールド以外は保存時に落とす（`updated_at` はサーバーが再付与する）

読み出し側（`getDiaOverrides`）でも `operation_date` と `dia_type` の形式検証を通し、
不正な行は捨てて残りを使う。`updated_at` の欠落・不正は無視して適用する
（判定に必要なのは日付とダイヤ種別だけであるため）。
日付が重複していた場合は配列の先頭にある行を採用し、`console.warn` を出す。
保存時に検証済みのため通常は発生しないが、手作業でJSONを編集した場合の保険とする。

## エラー処理

| 状況 | 挙動 |
|---|---|
| GitHub取得失敗・404・タイムアウト | 直前の取得値があれば維持して `source: "stale"`、なければ同梱JSONで `source: "fallback"`。いずれも `console.warn` |
| JSONパース失敗 | 同上 |
| 管理画面で一覧を取得できない | 「追加」「保存」を無効化し、再読み込みを促す |
| `ADMIN_PASSWORD` 未設定 | 503（既存挙動のまま） |
| `GITHUB_TOKEN` / `GITHUB_REPO` 未設定 | 保存も取得も不可。管理画面に設定不足として表示 |
| 保存失敗 | 失敗理由を管理画面に表示（表示先は認証済みの管理画面のみ） |

上書きが取得できない場合は「公式登録データのまま」になる。
アプリを停止させるより既知のデータで動かし続ける方を選ぶ。
ただし管理画面には `fallback` 状態を明示し、管理者が気づけるようにする。

## テスト

`scripts/timetable.test.ts` に追記する（既存の tsx + assert 形式に合わせる）。

`getDiaType` / `getDayType`:

1. 上書きあり → 上書きの `dia_type` を返す
2. 上書きなし → `shuttle_schedule.json` の値を返す（既存動作の回帰）
3. 日付が一致しない上書き → 影響しない
4. 不正な `dia_type` を含む行 → 無視して既定値を返す
5. 日付が重複する上書き → 先頭の行を採用する
6. `holiday` に上書きした日は該当便が0件になる
7. 上書きを適用した状態で乗継計算が該当ダイヤの便を返す

検証関数（`validateDiaOverrides` / `sanitizeDiaOverrides`）:

8. `2026-02-30` を拒否する
9. 100件は通り、101件は拒否する
10. `memo` 100字は通り、101字は拒否する
11. 同一日付の重複を拒否する
12. 配列でない入力を拒否する
13. `updated_at` は入力値ではなくサーバー時刻になる
14. 読み出しは日付昇順に整列し、件数超過とメモ長超過を丸める

取得経路（`getDiaOverrides`。`fetch` を差し替えて確認する）:

15. キャッシュがない状態で取得に失敗したら同梱データにフォールバックする
16. GitHubから取得できたら上書きを返す
17. TTL内は再取得しない
18. 取得に失敗しても直前に取れた上書きを捨てない（`source: "stale"`）
19. 304ならETagを送って内容を維持し、通常状態に戻る
20. GitHub上のデータが壊れていても正しい行だけ使う

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

## レビュー記録

2026-09-05、codex に本設計書と既存コードを渡してレビューを実施。主な指摘と対応:

| 指摘 | 対応 |
|---|---|
| Vercel上で `readDataFile()` を使うとビルド同梱の古い値を読み続ける | 採用。`process.env.VERCEL` で経路を分け、Vercelでは必ずGitHub APIを使う |
| Next.js 16 の `revalidateTag` は第2引数必須かつ stale-while-revalidate | 採用（公式ドキュメントで確認）。fetchキャッシュをやめメモリTTLキャッシュに変更 |
| 「再デプロイ不要」と `saveDataFile` の文言が矛盾 | 採用。臨時ダイヤAPIは自前のメッセージを返す |
| `holiday` 指定時の意味が曖昧 | 採用。便データが存在しない＝運休日であることを明記 |
| 日付検証は往復検証が必要 | 採用 |
| タイムゾーン仕様が不足 | 採用。JSTの運行日であることと管理画面の初期値算出を明記 |
| 取得失敗時のフェイルセーフが弱い | 部分採用。管理画面に `source` を表示。利用者への警告は表示しない方針のため見送り |
| 全件PUTは同時編集で更新を失う | 見送り。管理者は実質1人で、既存の告知機能と方式を揃える |
| レート制限・監査ログ・トークン有効期限 | 見送り。既存の管理APIと同水準に留める |
| 日付またぎ・深夜便の扱い | 本機能のスコープ外。現行挙動を変えないことを明記するに留める |

### 実装後のコードレビュー（2026-09-06、codex）

| 指摘 | 対応 |
|---|---|
| TTL切れ後の取得失敗で直前の上書きを捨て、誤ったダイヤに戻りうる | 採用。キャッシュを空にせず期限切れにし、失敗時は `stale` として直前値を使い続ける |
| 管理画面の一覧取得に失敗すると空のまま保存でき、全件消える | 採用。読み込み成功まで「追加」「保存」を無効化 |
| `updated_at` に入力値を採用していて設計と不一致 | 採用。保存時に必ずサーバー時刻を付与 |
| `sanitizeDiaOverrides` が日付順に整列しない | 採用。整列と件数・メモ長の丸めを追加 |
| GitHub取得・ETag・TTL・304・フォールバックのテストがない | 採用。`fetch` を差し替えた6件のテストを追加 |
| 乗継計算のテストが結果の存在しか見ていない | 採用。Bダイヤの時刻表にある便が選ばれ、Aダイヤの結果と異なることを検証 |
