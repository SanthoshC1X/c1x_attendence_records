import { useMemo, useState, useEffect } from "react";
import type { DashboardData, PeriodState } from "../types";
import { dateInPeriod, describePeriod, leaveFilterConfig } from "../utils";

interface Props {
  dashboard: DashboardData;
  periodState: PeriodState;
  initialLeaveType?: string | null;
}

interface LeaveEmployeeRow {
  emp_id: string;
  name: string;
  department: string;
  leave_count: number;
  total_minutes: number;
}

export default function LeaveAnalysisPage({ dashboard, periodState, initialLeaveType }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(initialLeaveType ?? null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (initialLeaveType) setSelectedType(initialLeaveType);
  }, [initialLeaveType]);

  // Local recompute of leave_breakdown for the current period
  const leave = useMemo<Record<string, { count: number; employees: LeaveEmployeeRow[] }>>(() => {
    const out: Record<string, Record<string, LeaveEmployeeRow>> = {};
    const ensure = (key: string, emp: { emp_id: string; name: string; department: string }) => {
      if (!out[key]) out[key] = {};
      if (!out[key][emp.emp_id]) {
        out[key][emp.emp_id] = { emp_id: emp.emp_id, name: emp.name, department: emp.department, leave_count: 0, total_minutes: 0 };
      }
      return out[key][emp.emp_id];
    };

    for (const emp of dashboard.employees) {
      for (const d of emp.daily) {
        if (!dateInPeriod(d.date, periodState)) continue;
        const st = d.status_type;
        const sub = d.leave_subtype;
        const mins = d.total_minutes ?? 0;

        if (st === "wfh") {
          const r = ensure("wfh", emp);
          r.leave_count += 1;
          r.total_minutes += mins;
        } else if (st === "leave") {
          if (sub === "cl" || sub === "sl" || sub === "pl") {
            const r = ensure(sub, emp);
            r.leave_count += 1;
          }
        } else if (st === "comp_off") {
          const r = ensure("comp_off", emp);
          r.leave_count += 1;
        } else if (st === "half_leave") {
          const r = ensure("half_leave", emp);
          r.leave_count += 0.5;
        } else if (st === "absent") {
          const r = ensure("absent", emp);
          r.leave_count += 1;
        }
      }
    }

    const result: Record<string, { count: number; employees: LeaveEmployeeRow[] }> = {};
    for (const key of Object.keys(out)) {
      const employees = Object.values(out[key]);
      const count = employees.reduce((s, r) => s + r.leave_count, 0);
      result[key] = { count, employees };
    }
    return result;
  }, [dashboard, periodState]);

  const selectedData = selectedType ? leave[selectedType] : null;
  const selectedCfg = leaveFilterConfig.find((c) => c.key === selectedType);

  const filteredEmployees = selectedData?.employees.filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.emp_id.toLowerCase().includes(q);
  }) ?? [];

  const fmtCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const fmtMins  = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-slate-500">Showing leave distribution for <span className="font-medium text-slate-700">{describePeriod(periodState)}</span>.</p>

      {/* Leave type cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {leaveFilterConfig.map((lf) => {
          const data = leave[lf.key];
          const count = data?.count ?? 0;
          const empCount = data?.employees?.length ?? 0;
          const isSelected = selectedType === lf.key;

          return (
            <button
              key={lf.key}
              onClick={() => {
                setSelectedType(isSelected ? null : lf.key);
                setSearch("");
              }}
              className={`rounded-[20px] border p-4 text-left transition-all ${
                isSelected
                  ? "border-slate-900 bg-slate-950 text-white shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${lf.dot}`} />
                <span className={`text-[11px] font-medium uppercase tracking-[0.18em] ${isSelected ? "text-white/60" : "text-slate-400"}`}>
                  {lf.fullLabel}
                </span>
              </div>
              <p className={`text-3xl font-semibold tracking-tight tabular-nums ${isSelected ? "text-white" : "text-slate-950"}`}>{fmtCount(count)}</p>
              <p className={`mt-1 text-[11px] ${isSelected ? "text-white/60" : "text-slate-400"}`}>
                days · {empCount} employee{empCount !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded employee list */}
      {selectedType && selectedData && (
        <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">
                {selectedCfg?.fullLabel}
                <span className="ml-1.5 font-normal text-slate-400">· {fmtCount(selectedData.count)} day{selectedData.count !== 1 ? "s" : ""}</span>
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">{selectedData.employees.length} employees affected</p>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter employees"
                className="w-56 rounded-full border border-slate-200 py-1.5 pl-9 pr-3 text-[12px] outline-none transition focus:border-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Employee</th>
                  <th className="px-5 py-3 text-left font-medium">Department</th>
                  <th className="px-5 py-3 text-left font-medium">Leave Days</th>
                  {selectedType === "wfh" && <th className="px-5 py-3 text-left font-medium">Total Hours</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={selectedType === "wfh" ? 4 : 3} className="px-5 py-8 text-center text-[13px] text-slate-400">No employees found.</td>
                  </tr>
                ) : (
                  [...filteredEmployees]
                    .sort((a, b) => b.leave_count - a.leave_count)
                    .map((emp) => (
                      <tr key={emp.emp_id} className="transition-colors hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{emp.name}</p>
                          <p className="text-[11px] text-slate-400">#{emp.emp_id}</p>
                        </td>
                        <td className="px-5 py-3 text-[12px] text-slate-500">{emp.department || "—"}</td>
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-900 tabular-nums">{fmtCount(emp.leave_count)}</span>
                          <span className="ml-1 text-[12px] text-slate-400">day{emp.leave_count !== 1 ? "s" : ""}</span>
                        </td>
                        {selectedType === "wfh" && (
                          <td className="px-5 py-3 tabular-nums text-slate-700">{fmtMins(emp.total_minutes)}</td>
                        )}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedType && (
        <div className="py-8 text-center text-[13px] text-slate-400">
          Pick any leave type above to view the employee breakdown.
        </div>
      )}
    </div>
  );
}
