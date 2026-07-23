import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:text-slate-300",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300",
};

export default function Button({ variant = "secondary", className = "", ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-[12.5px] font-semibold tracking-tight transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}
