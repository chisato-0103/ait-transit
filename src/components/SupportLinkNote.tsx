"use client";

import { useEffect, useState } from "react";
import { isSupportLinkActive, type SupportLink } from "@/lib/supportLink";
import { loadSiteConfig } from "@/lib/siteConfigClient";

// 開発者への任意の応援（見返りなし）。未設定・期限切れの間は非表示
export default function SupportLinkNote() {
  const [supportLink, setSupportLink] = useState<SupportLink | null>(null);
  // 期限判定用の実時刻（test_date のシミュレーションとは無関係）。
  // レンダー中に Date.now() を呼ばないよう effect で更新する
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    loadSiteConfig().then((c) => setSupportLink(c?.support_link ?? null));
  }, []);

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    update();
    // 期限は分単位なので 1 分ごとで足りる
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  // 時刻が未取得（0）の間は期限切れでも「期限内」と判定されてしまうので表示しない
  if (!supportLink || nowMs === 0 || !isSupportLinkActive(supportLink, nowMs)) return null;

  return (
    <>
      <p style={{ fontSize: "0.8em", marginTop: "12px" }}>
        <a href={supportLink.url} target="_blank" rel="noopener noreferrer">
          ☕ 開発者を応援する
        </a>
      </p>
      <p style={{ fontSize: "0.75em", marginTop: "4px", opacity: 0.8 }}>
        このアプリが役に立ったら、よかったら応援してもらえると嬉しいです（任意・見返りはありません）。
      </p>
    </>
  );
}
