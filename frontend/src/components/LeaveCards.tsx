import type { EmployeeDashboard, DailyEntry } from "../types";
import { formatDateShort } from "../utils";

export interface LeaveDayRow {
  emp: EmployeeDashboard;
  day: DailyEntry;
}

export interface LeaveCardRow {
  key: string;
  label: string;
  accent: string;
  bar: string;
  list: LeaveDayRow[];
}

export interface LeaveCardGroup {
  key: string;
  title: string;
  rows: LeaveCardRow[];
}

interface Props {
  groups: LeaveCardGroup[];
  onOpenRow: (key: string) => void;
}

export default function LeaveCards({ groups, onOpenRow }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {groups.map((group) => (
        <div key={group.key} className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">{group.title}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {group.rows.map((row) => (
              <div key={row.key} className="px-5 py-4">
                <div className="mb-2.5 flex items-center gap-2">
                  <button
                    onClick={() => onOpenRow(row.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition hover:brightness-95 ${row.accent}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${row.bar}`} />
                    {row.label}
                  </button>
                  <span className="text-[12px] text-slate-500">
                    {row.list.length} {row.list.length === 1 ? "record" : "records"}
                  </span>
                </div>
                {row.list.length === 0 ? (
                  <p className="text-[12px] text-slate-400">None in this period.</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5">
                    {row.list.map(({ emp, day }, idx) => (
                      <li key={`${emp.emp_id}-${day.date}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50/80 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-medium text-slate-900">{emp.name}</p>
                          <p className="truncate text-[11px] text-slate-500">{emp.department || "—"} · {formatDateShort(day.date)}</p>
                        </div>
                        {day.status_type === "half_leave" && day.leave_subtype && (
                          <span className="ml-2 shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
                            {day.leave_subtype.replace("half_", "1/2 ").toUpperCase()}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
