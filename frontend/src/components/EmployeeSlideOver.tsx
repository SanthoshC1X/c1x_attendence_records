import { useState, useEffect } from "react";
import type { EmployeeDashboard, EmployeeWeekStats } from "../types";
import { formatDateShort, getStatusLabel, statusStyles } from "../utils";

interface Props {
  employee: EmployeeDashboard | null;
  weekStats: EmployeeWeekStats | null;
  onClose: () => void;
}

export default function EmployeeSlideOver({ employee, weekStats, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      requestAnimationFrame(() => setVisible(true));
      setExpandedWeek(null);
    } else {
      setVisible(false);
    }
  }, [employee]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!employee) return null;

  const s = employee.summary;

  // Compute per-subtype leave counts from daily records
  const leaveCounts = employee.daily.reduce<Record<string, number>>((acc, d) => {
    if (d.status_type === "leave" || d.status_type === "half_leave" || d.status_type === "comp_off") {
      const key = d.leave_subtype || d.status_type;
      acc[key] = (acc[key] || 0) + (d.status_type === "half_leave" ? 0.5 : 1);
    }
    return acc;
  }, {});

  const leaveTypes = [
    { key: "cl",       label: "Casual Leave",    chip: "bg-blue-50 border-blue-200 text-blue-700" },
    { key: "sl",       label: "Sick Leave",       chip: "bg-purple-50 border-purple-200 text-purple-700" },
    { key: "pl",       label: "Privilege Leave",  chip: "bg-indigo-50 border-indigo-200 text-indigo-700" },
    { key: "comp_off", label: "Comp Off",         chip: "bg-amber-50 border-amber-200 text-amber-700" },
    { key: "half_cl",  label: "Half CL",          chip: "bg-sky-50 border-sky-200 text-sky-700" },
    { key: "half_sl",  label: "Half SL",          chip: "bg-violet-50 border-violet-200 text-violet-700" },
  ].filter((lt) => (leaveCounts[lt.key] ?? 0) > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-2xl z-50 bg-white shadow-xl flex flex-col transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">Employee Detail</p>
            <h2 className="text-[18px] font-semibold text-gray-900 tracking-tight">{employee.name}</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              {employee.department || "Unknown"} · {employee.emp_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Stats grid — row 1: days, row 2: hours */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { label: "Working", value: String(s.working_days), accent: "text-gray-900" },
                { label: "WFH",     value: String(s.wfh_days),     accent: "text-teal-600" },
                { label: "Leave",   value: String(s.leave_days),   accent: "text-blue-600" },
                { label: "Absent",  value: String(s.absent_days),  accent: s.absent_days > 0 ? "text-red-600" : "text-gray-400" },
              ].map((box) => (
                <div key={box.label} className="rounded-xl border border-gray-100 p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{box.label}</p>
                  <p className={`text-2xl font-semibold tracking-tight mt-2 ${box.accent}`}>{box.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: "Total Hours",   value: s.total_hours || "0:00",   cls: "bg-gray-900 text-white border-gray-900" },
                { label: "Weekday Hours", value: s.weekday_hours || "0:00", cls: "bg-white text-gray-900 border-gray-100" },
                { label: "Weekend Hours", value: s.weekend_hours || "0:00", cls: "bg-white text-gray-900 border-gray-100" },
              ].map((box) => (
                <div key={box.label} className={`rounded-xl border p-3.5 ${box.cls}`}>
                  <p className={`text-[11px] font-medium uppercase tracking-wider ${box.cls.includes("bg-gray-900") ? "text-white/60" : "text-gray-400"}`}>{box.label}</p>
                  <p className="text-2xl font-semibold tracking-tight mt-2 tabular-nums">{box.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Leave type breakdown */}
          {leaveTypes.length > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[13px] font-semibold text-gray-900">Leave Breakdown</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                {leaveTypes.map((lt) => (
                  <div key={lt.key} className="px-4 py-3">
                    <p className="text-[11px] text-gray-400">{lt.label}</p>
                    <p className="text-[16px] font-semibold text-gray-900 mt-1 tabular-nums">
                      {leaveCounts[lt.key]} <span className="text-[11px] text-gray-400 font-normal">day{leaveCounts[lt.key] !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly breakdown */}
          {weekStats && weekStats.weeks.length > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <p className="text-[13px] font-semibold text-gray-900">Weekly Hours</p>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                  weekStats.monthly_avg_weekly_minutes >= 2400
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-amber-700 bg-amber-50"
                }`}>
                  Avg {weekStats.monthly_avg_weekly_hhmm} / week
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {weekStats.weeks.map((week) => {
                  const barPct = Math.min((week.total_minutes / 2400) * 100, 100);
                  const onTrack = week.total_minutes >= 2400;
                  const isExpanded = expandedWeek === week.week_label;

                  return (
                    <div key={week.week_label}>
                      <button
                        onClick={() => setExpandedWeek(isExpanded ? null : week.week_label)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-16 shrink-0">
                          <p className="text-[12px] font-medium text-gray-700">{week.week_label}</p>
                          <p className="text-[10px] text-gray-400">
                            {formatDateShort(week.start_date)}–{formatDateShort(week.end_date)}
                          </p>
                        </div>
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${onTrack ? "bg-emerald-500" : "bg-amber-400"}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 w-20 justify-end">
                          <span className="text-[13px] font-medium text-gray-900 tabular-nums">{week.total_hhmm}</span>
                          <span className={`text-gray-400 text-[10px] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                            ▾
                          </span>
                        </div>
                      </button>

                      {/* Expanded day sub-table */}
                      {isExpanded && (
                        <div className="bg-gray-50/50 border-t border-gray-100 px-4 pb-3 pt-2">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="text-gray-400 text-left">
                                <th className="py-1 pr-3 font-medium">Date</th>
                                <th className="py-1 pr-3 font-medium">Day</th>
                                <th className="py-1 pr-3 font-medium">Status</th>
                                <th className="py-1 pr-3 font-medium">In</th>
                                <th className="py-1 pr-3 font-medium">Out</th>
                                <th className="py-1 text-right font-medium">Hours</th>
                              </tr>
                            </thead>
                            <tbody>
                              {week.days.map((day) => (
                                <tr key={day.date} className="border-t border-gray-100">
                                  <td className="py-1.5 pr-3 text-gray-700">{formatDateShort(day.date)}</td>
                                  <td className="py-1.5 pr-3 text-gray-500">{day.weekday}</td>
                                  <td className="py-1.5 pr-3">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyles[day.status_type] || statusStyles.default}`}>
                                      {getStatusLabel(day)}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-3 text-gray-600 tabular-nums">{day.in_time || "—"}</td>
                                  <td className="py-1.5 pr-3 text-gray-600 tabular-nums">{day.out_time || "—"}</td>
                                  <td className="py-1.5 text-right font-medium text-gray-900 tabular-nums">{day.total_hhmm || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily attendance table */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[13px] font-semibold text-gray-900">Daily Attendance</p>
              <p className="text-[11px] text-gray-400">{employee.daily.length} entries</p>
            </div>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">In</th>
                    <th className="px-4 py-2 text-left font-medium">Out</th>
                    <th className="px-4 py-2 text-left font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employee.daily.map((entry) => (
                    <tr key={entry.date}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-gray-900">{formatDateShort(entry.date)}</p>
                        <p className="text-[11px] text-gray-400">{entry.weekday}</p>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${statusStyles[entry.status_type] || statusStyles.default}`}>
                          {getStatusLabel(entry)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 tabular-nums">{entry.in_time || "—"}</td>
                      <td className="px-4 py-2 text-gray-600 tabular-nums">{entry.out_time || "—"}</td>
                      <td className="px-4 py-2 text-gray-900 font-medium tabular-nums">{entry.total_hhmm || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
