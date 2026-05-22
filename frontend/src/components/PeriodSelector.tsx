import type { PeriodState, PeriodActions, PeriodMode } from "../types";
import { describePeriod, todayIso } from "../utils";

const MODES: { key: PeriodMode; label: string }[] = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "date",      label: "Date" },
  { key: "month",     label: "Month" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  period: PeriodState;
  actions: PeriodActions;
  availableYears?: number[];
}

export default function PeriodSelector({ period, actions, availableYears }: Props) {
  const yearOptions = (availableYears && availableYears.length > 0)
    ? availableYears
    : [period.selYear];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Segmented control */}
      <div className="inline-flex rounded-full bg-slate-100/80 p-1 ring-1 ring-slate-200/80">
        {MODES.map((m) => {
          const isActive = period.periodMode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => actions.setPeriodMode(m.key)}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-tight transition ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Mode-specific controls */}
      {period.periodMode === "date" && (
        <input
          type="date"
          value={period.selDate || todayIso()}
          onChange={(e) => actions.setSelDate(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none transition focus:border-slate-900"
        />
      )}

      {period.periodMode === "month" && (
        <>
          <Picker
            value={period.selMonth}
            onChange={(v) => actions.setSelMonth(Number(v))}
            items={MONTH_NAMES.map((m, i) => ({ value: i, label: m }))}
          />
          <Picker
            value={period.selYear}
            onChange={(v) => actions.setSelYear(Number(v))}
            items={yearOptions.map((y) => ({ value: y, label: String(y) }))}
          />
        </>
      )}

      {/* Resolved period label */}
      <span className="ml-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {describePeriod(period)}
      </span>
    </div>
  );
}

interface PickerProps<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; hint?: string }[];
}

function Picker<T extends string | number>({ value, onChange, items }: PickerProps<T>) {
  return (
    <div className="relative">
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const num = Number(raw);
          onChange((Number.isNaN(num) ? raw : num) as T);
        }}
        className="appearance-none rounded-full border border-slate-200 bg-white px-3.5 py-1.5 pr-8 text-[12px] font-medium text-slate-700 outline-none transition focus:border-slate-900"
      >
        {items.map((it) => (
          <option key={String(it.value)} value={String(it.value)}>
            {it.label}{it.hint ? ` · ${it.hint}` : ""}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
