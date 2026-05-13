import { useState } from "react";
import type { AnalyticsData } from "../types";
import { leaveFilterConfig } from "../utils";

interface Props {
  analyticsData: AnalyticsData | null;
  initialLeaveType?: string | null;
}

export default function LeaveAnalysisPage({ analyticsData, initialLeaveType }: Props) {
  const [selectedType, setSelectedType] = useState<string | null>(initialLeaveType ?? null);
  const [search, setSearch] = useState("");

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-[13px]">
        Analytics data not available. Change the period or re-generate the dashboard.
      </div>
    );
  }

  const leave = analyticsData.leave_breakdown;
  const selectedData = selectedType ? leave[selectedType] : null;
  const selectedCfg = leaveFilterConfig.find((c) => c.key === selectedType);

  const filteredEmployees = selectedData?.employees.filter((emp) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return emp.name.toLowerCase().includes(q) || emp.emp_id.includes(q);
  }) ?? [];

  return (
    <div className="space-y-5">
      {/* Leave type cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              className={`text-left rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-100 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full ${lf.dot} ${isSelected ? "opacity-100" : ""}`} />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isSelected ? "text-white/60" : "text-gray-400"}`}>
                  {lf.fullLabel}
                </span>
              </div>
              <p className={`text-3xl font-semibold tracking-tight ${isSelected ? "text-white" : "text-gray-900"}`}>{count}</p>
              <p className={`text-[11px] mt-1 ${isSelected ? "text-white/60" : "text-gray-400"}`}>
                days · {empCount} employee{empCount !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded employee list */}
      {selectedType && selectedData && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-900">
                {selectedCfg?.fullLabel} <span className="text-gray-400 font-normal">· {selectedData.count} day{selectedData.count !== 1 ? "s" : ""}</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{selectedData.employees.length} employees affected</p>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter employees"
                className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-gray-900 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] text-gray-400 border-b border-gray-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Employee</th>
                  <th className="px-5 py-3 text-left font-medium">Department</th>
                  <th className="px-5 py-3 text-left font-medium">Leave Days</th>
                  <th className="px-5 py-3 text-left font-medium">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-[13px]">No employees found.</td>
                  </tr>
                ) : (
                  filteredEmployees
                    .sort((a, b) => b.leave_count - a.leave_count)
                    .map((emp) => (
                      <tr key={emp.emp_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-gray-900">{emp.name}</p>
                          <p className="text-[11px] text-gray-400">{emp.emp_id}</p>
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-gray-500">{emp.department}</td>
                        <td className="px-5 py-2.5">
                          <span className="text-gray-900 font-medium">{emp.leave_count}</span>
                          <span className="text-gray-400 ml-1 text-[12px]">day{emp.leave_count !== 1 ? "s" : ""}</span>
                        </td>
                        <td className="px-5 py-2.5 text-gray-700 tabular-nums">{emp.total_hours}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No type selected hint */}
      {!selectedType && (
        <div className="text-center py-8 text-[13px] text-gray-400">
          Click any leave type above to see the employee breakdown.
        </div>
      )}
    </div>
  );
}
