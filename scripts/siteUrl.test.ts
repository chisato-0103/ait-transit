// siteUrl.ts のテスト。実行: npm test（npx tsx scripts/siteUrl.test.ts）
import assert from "node:assert";
import { getSiteUrl } from "../src/lib/siteUrl";

let count = 0;
function test(name: string, fn: () => void) {
  fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

// 各テストの前に関連する環境変数を消す
function clearEnv() {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
}

test("NEXT_PUBLIC_SITE_URL が最優先される", () => {
  clearEnv();
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "ignored.vercel.app";
  assert.equal(getSiteUrl(), "https://example.com");
});

test("末尾のスラッシュは除去される", () => {
  clearEnv();
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
  assert.equal(getSiteUrl(), "https://example.com");
});

test("VERCEL_PROJECT_PRODUCTION_URL には https:// を前置する", () => {
  clearEnv();
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "ait-transit.vercel.app";
  assert.equal(getSiteUrl(), "https://ait-transit.vercel.app");
});

test("どちらも未設定ならローカル開発用の URL を返す", () => {
  clearEnv();
  assert.equal(getSiteUrl(), "http://localhost:3000");
});

console.log(`\n${count}件すべて成功`);
