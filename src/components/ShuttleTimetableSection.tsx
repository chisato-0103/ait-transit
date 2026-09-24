// トップページのシャトルバス時刻表区画。サーバーで HTML 化し、検索エンジンが時刻を読めるようにする。
// <details> は閉じていても中身が DOM に残るので、折りたたんだままでも隠しテキストにはならない
import timetable from "@/data/shuttle_bus_timetable.json";
import {
  groupShuttleByHour,
  type ShuttleDiaType,
  type ShuttleDirection,
  type ShuttleRow,
} from "@/lib/shuttleTimetable";

// 公式表記どおり A/B/C のみ。意味の説明は公式に無く、曜日とも一致しないため付けない
const DIAS: ShuttleDiaType[] = ["A", "B", "C"];

const DIRECTIONS: { key: ShuttleDirection; label: string }[] = [
  { key: "to_university", label: "八草駅 → 大学" },
  { key: "to_yagusa", label: "大学 → 八草駅" },
];

// 運行予定表 PDF の掲載元。PDF の URL は改定ごとに変わるためページを指す
const SCHEDULE_PAGE_URL = "https://www.ait.ac.jp/about/yakusa-campus/";

export default function ShuttleTimetableSection() {
  const rows = timetable as ShuttleRow[];
  return (
    <section className="shuttle-timetable">
      <details className="notices collapsible shuttle-timetable-outer">
        <summary className="collapsible-header">
          <h2 className="shuttle-timetable-title">🚌 愛工大 シャトルバス 時刻表</h2>
          <span className="collapsible-icon" aria-hidden="true">▼</span>
        </summary>
        <div className="shuttle-timetable-body">
          <p>八草駅と八草キャンパスを結ぶ無料シャトルバスの全便です。</p>
          <p className="shuttle-timetable-note">
            どの日がどのダイヤで運行するかは日によって異なります。運行日は
            <a href={SCHEDULE_PAGE_URL} target="_blank" rel="noopener noreferrer">大学の八草キャンパスページ</a>
            の運行予定表でご確認ください。日曜・祝日及び大学が指定する休日は原則運休です。
          </p>
          {DIAS.map((dia) => (
            <details key={dia} className="shuttle-dia">
              <summary>{`${dia}ダイヤ`}</summary>
              <div className="shuttle-dia-body">
                {DIRECTIONS.map((d) => (
                  <div key={d.key} className="shuttle-dia-direction">
                    <h3>{d.label}</h3>
                    <table className="shuttle-hour-table">
                      <tbody>
                        {groupShuttleByHour(rows, dia, d.key).map(({ hour, minutes }) => (
                          <tr key={hour}>
                            <th scope="row">{hour}</th>
                            <td>{minutes.join(" ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                {dia !== "C" && (
                  <p className="shuttle-timetable-note">
                    ※ Aダイヤ・Bダイヤは上記のほかに臨時バスが往復運行しています（7:55〜10:45）
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </details>
    </section>
  );
}
