import type { SemanticTone } from "../../utils";
import { SEMANTIC_TONE } from "../../utils";

interface Props {
  label: string;
  value: string | number;
  tone?: SemanticTone;
  hint?: string;
  onClick?: () => void;
}

export default function StatCard({ label, value, tone = "neutral", hint, onClick }: Props) {
  const Tag = onClick ? "button" : "div";
  const toneCls = SEMANTIC_TONE[tone].text;
  return (
    <Tag
      onClick={onClick}
      className={`flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition ${
        onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/10" : ""
      }`}
    >
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-[24px] font-semibold leading-none tabular-nums ${toneCls}`}>{value}</p>
      {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
    </Tag>
  );
}
