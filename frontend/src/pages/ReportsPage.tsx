import { useState, useEffect } from "react";
import axios from "axios";
import type { UnderperformerData } from "../types";
import { periodOptions } from "../utils";

interface Props {
  activePeriod: string;
}

export default function ReportsPage({ activePeriod }: Props) {
  const [threshold, setThreshold] = useState(40);
  const [inputVal, setInputVal] = useState("40");
  const [data, setData] = useState<UnderperformerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnderperformers = async (period: string, hrs: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/admin/underperformers?period=${period}&threshold_hours=${hrs}`);
      setData(res.data as UnderperformerData);
    } catch {
      setError("Failed to fetch report. Make sure the dashboard is loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnderperformers(activePeriod, threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod]);

  const handleApply = () => {
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n > 0) {
      setThreshold(n);
      fetchUnderperformers(activePeriod, n);
    }
  };

  const periodLabel = periodOptions.find((p) => p.key === activePeriod)?.label ?? activePeriod;

  const deficitColor = (pct: number) => {
    if (pct >= 20) return "text-red-600 font-bold";
    if (pct >= 10) return "text-orange-500 font-semibold";
    return "text-amber-600 font-medium";
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Underperformer Analysis</h3>
        <p className="text-xs text-gray-400 mb-4">Identify employees working below the minimum hour threshold.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Threshold</label>
            <input
              type="number"
              min={1}
              max={100}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-500">hours / week</span>
          </div>
          <button
            onClick={handleApply}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Calculating…" : "Calculate"}
          </button>
          <p className="text-xs text-gray-400 ml-2">Period: <span className="font-semibold text-gray-600">{periodLabel}</span></p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {data.underperformer_count} employee{data.underperformer_count !== 1 ? "s" : ""} below {threshold}h threshold
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Expected: {data.expected_hours}h · Period: {periodLabel}
              </p>
            </div>
            {data.underperformer_count === 0 && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                All employees on track
              </span>
            )}
          </div>

          {data.underperformer_count === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No employees are below the {threshold}h threshold for {periodLabel}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Employee</th>
                    <th className="px-6 py-3 text-left font-semibold">Department</th>
                    <th className="px-6 py-3 text-left font-semibold">Actual Hrs</th>
                    <th className="px-6 py-3 text-left font-semibold">Expected</th>
                    <th className="px-6 py-3 text-left font-semibold">Deficit</th>
                    <th className="px-6 py-3 text-left font-semibold">Working Days</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...data.employees]
                    .sort((a, b) => a.deficit_hours - b.deficit_hours)
                    .map((emp) => {
                      const deficitPct = data.expected_hours > 0
                        ? Math.round(Math.abs(emp.deficit_hours) / data.expected_hours * 100)
                        : 0;
                      const barPct = Math.min((emp.actual_hours / data.expected_hours) * 100, 100);

                      return (
                        <tr key={emp.emp_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3">
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-400">ID {emp.emp_id}</p>
                          </td>
                          <td className="px-6 py-3 text-gray-600">{emp.department}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${barPct}%` }} />
                              </div>
                              <span className="font-semibold text-gray-800">{emp.actual_hours.toFixed(1)}h</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-gray-600">{emp.expected_hours.toFixed(1)}h</td>
                          <td className={`px-6 py-3 ${deficitColor(deficitPct)}`}>
                            -{Math.abs(emp.deficit_hours).toFixed(1)}h
                          </td>
                          <td className="px-6 py-3 text-gray-600">{emp.working_days}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              deficitPct >= 20
                                ? "bg-red-50 border-red-200 text-red-700"
                                : deficitPct >= 10
                                  ? "bg-orange-50 border-orange-200 text-orange-700"
                                  : "bg-amber-50 border-amber-200 text-amber-700"
                            }`}>
                              ⚠ -{deficitPct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
