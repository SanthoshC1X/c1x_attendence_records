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
        className={`fixed right-0 top-0 h-full w-full max-w-2xl z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Employee Detail</p>
            <h2 className="text-xl font-bold text-gray-900">{employee.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {employee.department || "Unknown"} · ID {employee.emp_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats grid — row 1: days, row 2: hours */}
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Working Days", value: String(s.working_days), cls: "bg-emerald-50 border border-emerald-200 text-emerald-900" },
                { label: "WFH Days",     value: String(s.wfh_days),     cls: "bg-teal-50 border border-teal-200 text-teal-900" },
                { label: "Leave Days",   value: String(s.leave_days),   cls: "bg-rose-50 border border-rose-200 text-rose-900" },
                { label: "Absent Days",  value: String(s.absent_days),  cls: s.absent_days > 0 ? "bg-red-100 border border-red-300 text-red-900" : "bg-gray-50 border border-gray-200 text-gray-500" },
              ].map((box) => (
                <div key={box.label} className={`rounded-xl p-4 ${box.cls}`}>
                  <p className="text-xs opacity-60 font-medium">{box.label}</p>
                  <p className="text-xl font-bold mt-1">{box.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Hours",   value: s.total_hours || "0:00",   cls: "bg-gray-900 text-white" },
                { label: "Weekday Hours", value: s.weekday_hours || "0:00", cls: "bg-gray-50 border border-gray-200 text-gray-900" },
                { label: "Weekend Hours", value: s.weekend_hours || "0:00", cls: "bg-gray-50 border border-gray-200 text-gray-900" },
              ].map((box) => (
                <div key={box.label} className={`rounded-xl p-4 ${box.cls}`}>
                  <p className="text-xs opacity-60 font-medium">{box.label}</p>
                  <p className="text-xl font-bold mt-1">{box.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Leave type breakdown */}
          {leaveTypes.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Leave Breakdown</p>
              </div>
              <div className="grid grid-cols-3 gap-px bg-gray-100">
                {leaveTypes.map((lt) => (
                  <div key={lt.key} className="bg-white px-4 py-3">
                    <p className="text-xs text-gray-500 mb-1">{lt.label}</p>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${lt.chip}`}>
                      {leaveCounts[lt.key]} day{leaveCounts[lt.key] !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly breakdown */}
          {weekStats && weekStats.weeks.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Weekly Hours</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    weekStats.monthly_avg_weekly_minutes >= 2400
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    Avg {weekStats.monthly_avg_weekly_hhmm} / week
                    {weekStats.monthly_avg_weekly_minutes < 2400 && " ⚠"}
                  </span>
                </div>
              </div>

              {/* Week rows */}
              <div className="divide-y divide-gray-100">
                {weekStats.weeks.map((week) => {
                  const barPct = Math.min((week.total_minutes / 2400) * 100, 100);
                  const onTrack = week.total_minutes >= 2400;
                  const isExpanded = expandedWeek === week.week_label;

                  return (
                    <div key={week.week_label}>
                      <button
                        onClick={() => setExpandedWeek(isExpanded ? null : week.week_label)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-16 shrink-0">
                          <p className="text-xs font-semibold text-gray-700">{week.week_label}</p>
                          <p className="text-[10px] text-gray-400">
                            {formatDateShort(week.start_date)}–{formatDateShort(week.end_date)}
                          </p>
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${onTrack ? "bg-emerald-500" : "bg-amber-400"}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 w-20 justify-end">
                          <span className="text-sm font-semibold text-gray-800">{week.total_hhmm}</span>
                          <span className={`text-xs font-bold ${onTrack ? "text-emerald-500" : "text-amber-500"}`}>
                            {onTrack ? "✓" : "⚠"}
                          </span>
                          <span className={`text-gray-400 text-xs transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                            ▾
                          </span>
                        </div>
                      </button>

                      {/* Expanded day sub-table */}
                      {isExpanded && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 pb-3 pt-2">
                          <table className="w-full text-xs">
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
                                <tr key={day.date} className="border-t border-gray-200">
                                  <td className="py-1.5 pr-3 text-gray-700">{formatDateShort(day.date)}</td>
                                  <td className="py-1.5 pr-3 text-gray-500">{day.weekday}</td>
                                  <td className="py-1.5 pr-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusStyles[day.status_type] || statusStyles.default}`}>
                                      {getStatusLabel(day)}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-3 text-gray-600">{day.in_time || "—"}</td>
                                  <td className="py-1.5 pr-3 text-gray-600">{day.out_time || "—"}</td>
                                  <td className="py-1.5 text-right font-semibold text-gray-700">{day.total_hhmm || "—"}</td>
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

              {/* Footer */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between">
                <p className="text-xs text-gray-500">{weekStats.weeks.length} week{weekStats.weeks.length !== 1 ? "s" : ""}</p>
                <p className="text-xs font-semibold text-gray-700">
                  Avg {weekStats.monthly_avg_weekly_hhmm} hrs/week
                </p>
              </div>
            </div>
          )}

          {/* Daily attendance table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Daily Attendance</p>
              <p className="text-xs text-gray-400">{employee.daily.length} entries</p>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-left font-semibold">In</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Out</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employee.daily.map((entry) => (
                    <tr key={entry.date} className={entry.is_weekend ? "bg-amber-50/50" : "bg-white"}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{formatDateShort(entry.date)}</p>
                        <p className="text-xs text-gray-400">{entry.weekday}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold ${statusStyles[entry.status_type] || statusStyles.default}`}>
                          {getStatusLabel(entry)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-sm">{entry.in_time || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-sm">{entry.out_time || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-700 text-sm font-medium">{entry.total_hhmm || "—"}</td>
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
