// サイト設定ローダーのテスト。実行: npm test（npx tsx scripts/siteConfigClient.test.ts）
import assert from "node:assert";
import { loadSiteConfig, resetSiteConfigCacheForTest } from "../src/lib/siteConfigClient";

let count = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  count++;
  console.log(`ok ${count} - ${name}`);
}

const config = { maintenance: false, maintenance_message: "", support_link: null };

(async () => {
  await test("複数回呼んでも fetch は 1 回だけで、同じ結果を返す", async () => {
    resetSiteConfigCacheForTest();
    let calls = 0;
    const fetcher = (async () => {
      calls++;
      return new Response(JSON.stringify({ success: true, data: config }));
    }) as typeof fetch;
    const [a, b] = await Promise.all([loadSiteConfig(fetcher), loadSiteConfig(fetcher)]);
    const c = await loadSiteConfig(fetcher);
    assert.strictEqual(calls, 1);
    assert.deepStrictEqual(a, config);
    assert.strictEqual(a, b);
    assert.strictEqual(a, c);
  });

  await test("取得に失敗したら null を返す", async () => {
    resetSiteConfigCacheForTest();
    const fetcher = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    assert.strictEqual(await loadSiteConfig(fetcher), null);
  });

  await test("data が無い応答は null を返す", async () => {
    resetSiteConfigCacheForTest();
    const fetcher = (async () => new Response(JSON.stringify({ success: false }))) as typeof fetch;
    assert.strictEqual(await loadSiteConfig(fetcher), null);
  });

  console.log(`\n${count} tests passed`);
})().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
