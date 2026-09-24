import SupportLinkNote from "@/components/SupportLinkNote";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <p>&copy; 2025 愛知工業大学 交通情報システム</p>
      <p style={{ fontSize: "0.85em", marginTop: "8px" }}>
        <strong>免責事項：</strong>本システムは愛知工業大学の学生向け通学支援を目的とした非営利の情報提供サービスです。<br />
        時刻表データは公開情報を参考にしていますが、実際の運行状況と異なる場合があります。<br />
        正確な時刻は<a href="https://www.linimo.jp/" target="_blank" rel="noopener noreferrer">リニモ公式サイト</a>でご確認ください。
      </p>
      <p style={{ fontSize: "0.8em", marginTop: "12px" }}>
        <a href="/contact">お問い合わせ</a>
      </p>
      <SupportLinkNote />
    </footer>
  );
}
