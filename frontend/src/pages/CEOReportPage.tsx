import { useMemo, useState } from "react";
import type { DashboardData, EmployeeDashboard, DailyEntry } from "../types";
import { formatDate } from "../utils";

interface Props {
  dashboard: DashboardData;
}

type HoursThreshold = "all" | 5 | 6 | 7 | 8 | 9;

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function parseFirstPunchMinutes(t: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

const LATE_CUTOFF_MIN = 12 * 60;

const LEAVE_CARDS = [
  { key: "wfh",        label: "WFH",       accent: "bg-teal-50 text-teal-800 ring-teal-200",     bar: "bg-teal-500" },
  { key: "cl",         label: "CL",        accent: "bg-blue-50 text-blue-800 ring-blue-200",     bar: "bg-blue-500" },
  { key: "sl",         label: "SL",        accent: "bg-rose-50 text-rose-800 ring-rose-200",     bar: "bg-rose-500" },
  { key: "pl",         label: "PL",        accent: "bg-violet-50 text-violet-800 ring-violet-200", bar: "bg-violet-500" },
  { key: "comp_off",   label: "Comp Off",  accent: "bg-orange-50 text-orange-800 ring-orange-200", bar: "bg-orange-500" },
  { key: "half_leave", label: "Half Day",  accent: "bg-yellow-50 text-yellow-800 ring-yellow-200", bar: "bg-yellow-500" },
] as const;

interface DayRow {
  emp: EmployeeDashboard;
  day: DailyEntry;
}

export default function CEOReportPage({ dashboard }: Props) {
  const [reportDate, setReportDate] = useState<string>(yesterdayIso());
  const [hoursThreshold, setHoursThreshold] = useState<HoursThreshold>("all");

  const rows: DayRow[] = useMemo(() => {
    const out: DayRow[] = [];
    for (const emp of dashboard.employees) {
      const day = emp.daily.find((d) => d.date === reportDate);
      if (day) out.push({ emp, day });
    }
    return out;
  }, [dashboard, reportDate]);

  const counts = useMemo(() => {
    const c = { present: 0, wfh: 0, cl: 0, sl: 0, pl: 0, comp_off: 0, half_leave: 0, absent: 0, total: rows.length };
    for (const { day } of rows) {
      const st = day.status_type;
      const sub = day.leave_subtype;
      if (st === "present" || st === "weekend_worked") c.present += 1;
      else if (st === "wfh") c.wfh += 1;
      else if (st === "absent") c.absent += 1;
      else if (st === "comp_off") c.comp_off += 1;
      else if (st === "half_leave") {
        c.half_leave += 1;
        if (sub === "half_wfh") c.wfh += 0.5;
        else if (sub === "half_cl") c.cl += 0.5;
        else if (sub === "half_sl") c.sl += 0.5;
        else if (sub === "half_pl") c.pl += 0.5;
        else if (sub === "half_comp") c.comp_off += 0.5;
      } else if (st === "leave") {
        if (sub === "cl") c.cl += 1;
        else if (sub === "sl") c.sl += 1;
        else if (sub === "pl") c.pl += 1;
      }
    }
    return c;
  }, [rows]);

  const leaveLists = useMemo(() => {
    const groups: Record<string, DayRow[]> = { wfh: [], cl: [], sl: [], pl: [], comp_off: [], half_leave: [] };
    for (const row of rows) {
      const st = row.day.status_type;
      const sub = row.day.leave_subtype;
      if (st === "wfh") groups.wfh.push(row);
      else if (st === "comp_off") groups.comp_off.push(row);
      else if (st === "half_leave") groups.half_leave.push(row);
      else if (st === "leave") {
        if (sub === "cl") groups.cl.push(row);
        else if (sub === "sl") groups.sl.push(row);
        else if (sub === "pl") groups.pl.push(row);
      }
    }
    return groups;
  }, [rows]);

  const lateArrivals = useMemo(() => {
    return rows
      .filter(({ day }) => {
        if (day.status_type !== "present" && day.status_type !== "weekend_worked" && day.status_type !== "wfh") return false;
        const m = parseFirstPunchMinutes(day.in_time);
        return m !== null && m > LATE_CUTOFF_MIN;
      })
      .sort((a, b) => (parseFirstPunchMinutes(a.day.in_time) ?? 0) - (parseFirstPunchMinutes(b.day.in_time) ?? 0));
  }, [rows]);

  const shortWorkdays = useMemo(() => {
    const cap = hoursThreshold === "all" ? 8 : hoursThreshold;
    const capMins = cap * 60;
    return rows
      .filter(({ day }) => {
        if (day.status_type !== "present" && day.status_type !== "weekend_worked") return false;
        const mins = day.total_minutes ?? 0;
        return mins > 0 && mins < capMins;
      })
      .sort((a, b) => (a.day.total_minutes ?? 0) - (b.day.total_minutes ?? 0));
  }, [rows, hoursThreshold]);

  const hasData = rows.length > 0;
  const dateLabel = formatDate(reportDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isYesterday = reportDate === yesterdayIso();

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-900">CEO View</span>
            <span className="text-[12px] text-gray-500">{isYesterday ? "Yesterday's snapshot" : "Snapshot"}</span>
          </div>
          <h2 className="mt-1.5 text-lg font-semibold text-slate-950">{dateLabel}</h2>
          <p className="text-[12px] text-gray-500">{hasData ? `${counts.total} employees recorded` : "No records for this date"}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-gray-500">Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            max={today.toISOString().slice(0, 10)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-[13px] text-gray-700 outline-none transition focus:border-gray-900"
          />
          <button
            onClick={() => setReportDate(yesterdayIso())}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
              isYesterday ? "bg-slate-950 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Yesterday
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-[13px] text-gray-500">
          No attendance records for {dateLabel}. Try another date.
        </div>
      ) : (
        <>
          {/* ── Headline summary cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <SummaryCard label="Present" value={counts.present} accent="bg-emerald-50 text-emerald-800 ring-emerald-200" bar="bg-emerald-500" />
            <SummaryCard label="Absent"  value={counts.absent}  accent="bg-red-50 text-red-800 ring-red-200" bar="bg-red-500" />
            {LEAVE_CARDS.map((c) => (
              <SummaryCard key={c.key} label={c.label} value={counts[c.key as keyof typeof counts] as number} accent={c.accent} bar={c.bar} />
            ))}
          </div>

          {/* ── Leave breakdown lists ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">Who's away</h3>
                <p className="text-[12px] text-gray-500">Leave, WFH and comp-off taken on {dateLabel}</p>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {LEAVE_CARDS.map((cfg) => {
                const list = leaveLists[cfg.key];
                if (!list || list.length === 0) return null;
                return (
                  <div key={cfg.key} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${cfg.accent}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.bar}`} />
                        {cfg.label}
                      </span>
                      <span className="text-[12px] text-gray-500">{list.length} {list.length === 1 ? "person" : "people"}</span>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {list.map(({ emp, day }) => (
                        <li key={`${emp.emp_id}-${cfg.key}`} className="flex items-center justify-between rounded-md bg-gray-50 px-2.5 py-1.5">
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-gray-900 truncate">{emp.name}</p>
                            <p className="text-[11px] text-gray-500 truncate">{emp.department || "—"}</p>
                          </div>
                          {day.status_type === "half_leave" && day.leave_subtype && (
                            <span className="ml-2 shrink-0 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800">
                              {day.leave_subtype.replace("half_", "½ ").toUpperCase()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {LEAVE_CARDS.every((c) => (leaveLists[c.key]?.length ?? 0) === 0) && (
                <div className="px-4 py-6 text-center text-[12.5px] text-gray-500">No leave / WFH on this day.</div>
              )}
            </div>
          </div>

          {/* ── Late arrivals ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">Late arrivals</h3>
                <p className="text-[12px] text-gray-500">First punch after 12:00 PM</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">{lateArrivals.length}</span>
            </div>
            {lateArrivals.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12.5px] text-gray-500">Nobody clocked in after noon.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {lateArrivals.map(({ emp, day }) => (
                  <li key={emp.emp_id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{emp.name}</p>
                      <p className="text-[11.5px] text-gray-500 truncate">{emp.department || "—"} · ID {emp.emp_id}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-[13px] font-semibold text-amber-700">{day.in_time}</p>
                      <p className="text-[11px] text-gray-500">first punch</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Short workdays ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-slate-900">Short workdays</h3>
                  <p className="text-[12px] text-gray-500">Present employees who worked under the chosen threshold</p>
                </div>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-200">{shortWorkdays.length}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["all", 5, 6, 7, 8, 9] as const).map((t) => {
                  const isActive = hoursThreshold === t;
                  const label = t === "all" ? "All under-performers (<8h)" : `< ${t}h`;
                  return (
                    <button
                      key={String(t)}
                      onClick={() => setHoursThreshold(t)}
                      className={`text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                        isActive ? "bg-slate-950 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {shortWorkdays.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12.5px] text-gray-500">Everyone clocked at or above the threshold.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {shortWorkdays.map(({ emp, day }) => {
                  const mins = day.total_minutes ?? 0;
                  const hh = Math.floor(mins / 60);
                  const mm = mins % 60;
                  return (
                    <li key={emp.emp_id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-[11.5px] text-gray-500 truncate">{emp.department || "—"} · ID {emp.emp_id}</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-[13px] font-semibold text-rose-700">{hh}h {String(mm).padStart(2, "0")}m</p>
                        <p className="text-[11px] text-gray-500">{day.in_time || "—"} → {day.out_time || "—"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent, bar }: { label: string; value: number; accent: string; bar: string }) {
  return (
    <div className={`rounded-xl ring-1 ${accent} px-3 py-3 relative overflow-hidden`}>
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none">{value % 1 === 0 ? value : value.toFixed(1)}</p>
    </div>
  );
}
