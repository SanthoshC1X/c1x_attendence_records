interface Props {
  label?: string;
}

export default function SplashScreen({ label = "Loading your dashboard" }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-[30px] font-black leading-none text-slate-900">%</span>
        <span className="text-[24px] font-semibold tracking-tight text-slate-900">C1X</span>
      </div>

      <div className="h-1 w-44 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 rounded-full bg-slate-400 animate-[c1x-shimmer_1.3s_ease-in-out_infinite]" />
      </div>

      <p className="flex items-center gap-2 text-[12.5px] font-medium text-slate-400">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        {label}
      </p>
    </div>
  );
}
