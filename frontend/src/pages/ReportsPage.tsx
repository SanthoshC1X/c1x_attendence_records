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
    if (pct >= 20) return "text-red-600 font-medium";
    if (pct >= 10) return "text-orange-600 font-medium";
    return "text-amber-700 font-medium";
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-[14px] font-semibold text-gray-900">Underperformer Analysis</h3>
        <p className="text-[12px] text-gray-400 mt-0.5 mb-4">Identify employees working below the minimum hour threshold.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-gray-700 font-medium">Threshold</label>
            <input
              type="number"
              min={1}
              max={100}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()}
              className="w-20 border border-gray-200 rounded-md px-2.5 py-1.5 text-[13px] text-center font-medium focus:outline-none focus:border-gray-900"
            />
            <span className="text-[13px] text-gray-500">hours / week</span>
          </div>
          <button
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-1.5 rounded-md bg-gray-900 text-white text-[13px] font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Calculating" : "Calculate"}
          </button>
          <p className="text-[12px] text-gray-400 ml-2">Period · <span className="font-medium text-gray-700">{periodLabel}</span></p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3.5 text-red-700 text-[13px]">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900">
                {data.underperformer_count} employee{data.underperformer_count !== 1 ? "s" : ""} below {threshold}h threshold
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Expected: {data.expected_hours}h · {periodLabel}
              </p>
            </div>
            {data.underperformer_count === 0 && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded text-emerald-700 bg-emerald-50">
                All on track
              </span>
            )}
          </div>

          {data.underperformer_count === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-gray-400">
              No employees are below the {threshold}h threshold for {periodLabel}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] text-gray-400 border-b border-gray-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Employee</th>
                    <th className="px-5 py-3 text-left font-medium">Department</th>
                    <th className="px-5 py-3 text-left font-medium">Actual</th>
                    <th className="px-5 py-3 text-left font-medium">Expected</th>
                    <th className="px-5 py-3 text-left font-medium">Deficit</th>
                    <th className="px-5 py-3 text-left font-medium">Days</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
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
                          <td className="px-5 py-2.5">
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-[11px] text-gray-400">{emp.emp_id}</p>
                          </td>
                          <td className="px-5 py-2.5 text-[12px] text-gray-500">{emp.department}</td>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gray-900 rounded-full" style={{ width: `${barPct}%` }} />
                              </div>
                              <span className="font-medium text-gray-900 tabular-nums">{emp.actual_hours.toFixed(1)}h</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-gray-500 tabular-nums">{emp.expected_hours.toFixed(1)}h</td>
                          <td className={`px-5 py-2.5 tabular-nums ${deficitColor(deficitPct)}`}>
                            -{Math.abs(emp.deficit_hours).toFixed(1)}h
                          </td>
                          <td className="px-5 py-2.5 text-gray-600">{emp.working_days}</td>
                          <td className="px-5 py-2.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                              deficitPct >= 20
                                ? "bg-red-50 text-red-700"
                                : deficitPct >= 10
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}>
                              -{deficitPct}%
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
