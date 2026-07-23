import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function EmptyState({ icon, title, description, children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-[13.5px] font-semibold text-slate-800">{title}</p>
        {description && <p className="mt-1 text-[12.5px] text-slate-500">{description}</p>}
      </div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
