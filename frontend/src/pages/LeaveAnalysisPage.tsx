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
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
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
    <div className="space-y-6">
      {/* Leave type cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              className={`text-left rounded-2xl border p-5 transition-all ${
                isSelected
                  ? "border-gray-900 bg-gray-900 text-white shadow-lg"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs font-semibold uppercase tracking-widest ${isSelected ? "text-gray-400" : "text-gray-400"}`}>
                  {lf.fullLabel}
                </span>
                {isSelected && (
                  <span className="text-gray-400 text-xs">×</span>
                )}
              </div>
              <p className={`text-4xl font-bold ${isSelected ? "text-white" : "text-gray-900"}`}>{count}</p>
              <p className={`text-xs mt-1 ${isSelected ? "text-gray-400" : "text-gray-400"}`}>
                days · {empCount} employee{empCount !== 1 ? "s" : ""}
              </p>
              {/* Mini bar */}
              {count > 0 && !isSelected && (
                <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${lf.dot}`} style={{ width: `${Math.min(count * 4, 100)}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded employee list */}
      {selectedType && selectedData && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedCfg?.fullLabel} — {selectedData.count} day{selectedData.count !== 1 ? "s" : ""}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{selectedData.employees.length} employees affected</p>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter employees…"
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Employee</th>
                  <th className="px-6 py-3 text-left font-semibold">Department</th>
                  <th className="px-6 py-3 text-left font-semibold">Leave Days</th>
                  <th className="px-6 py-3 text-left font-semibold">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-gray-400 text-sm">No employees found.</td>
                  </tr>
                ) : (
                  filteredEmployees
                    .sort((a, b) => b.leave_count - a.leave_count)
                    .map((emp) => (
                      <tr key={emp.emp_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400">ID {emp.emp_id}</p>
                        </td>
                        <td className="px-6 py-3 text-gray-600">{emp.department}</td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${selectedCfg?.chip}`}>
                            {emp.leave_count} day{emp.leave_count !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-semibold text-gray-700">{emp.total_hours}</td>
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
        <div className="text-center py-8 text-sm text-gray-400">
          Click any leave type card above to see the employee breakdown.
        </div>
      )}
    </div>
  );
}
