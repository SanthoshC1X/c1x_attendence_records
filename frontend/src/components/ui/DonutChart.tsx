interface Segment {
  label: string;
  value: number; // 0-100
  color: string; // hex
}

interface Props {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  centerValue?: string;
  centerLabel?: string;
}

export default function DonutChart({ segments, size = 168, strokeWidth = 20, centerValue, centerLabel }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef2f6" strokeWidth={strokeWidth} />
        {segments.map((seg) => {
          const segLength = Math.max(0, (seg.value / 100) * circumference);
          const dashoffset = -offsetAccum;
          offsetAccum += segLength;
          return (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segLength} ${circumference - segLength}`}
              strokeDashoffset={dashoffset}
              style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue && <p className="text-[24px] font-semibold tabular-nums text-slate-900">{centerValue}</p>}
        {centerLabel && <p className="text-[11px] font-medium text-slate-400">{centerLabel}</p>}
      </div>
    </div>
  );
}
