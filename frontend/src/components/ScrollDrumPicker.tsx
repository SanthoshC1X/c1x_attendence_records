import { useRef, useEffect, useState } from "react";

export interface DrumItem { value: number; label: string; sublabel?: string; }

export function ScrollDrumPicker({ items, value, onChange }: {
  items: DrumItem[];
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selItem = items.find(i => i.value === value);

  // Scroll selected item into centre when dropdown opens
  useEffect(() => {
    if (!open || !listRef.current) return;
    const idx = items.findIndex(i => i.value === value);
    const btn = listRef.current.children[idx] as HTMLElement | undefined;
    if (btn) btn.scrollIntoView({ block: "nearest" });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-sm ${
          open
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:text-gray-900"
        }`}
      >
        <span>{selItem?.label ?? ""}</span>
        {selItem?.sublabel && (
          <span className={`font-normal text-[10px] ${open ? "text-gray-300" : "text-gray-400"}`}>
            {selItem.sublabel}
          </span>
        )}
        <svg
          className={`w-3 h-3 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown list */}
          <div
            className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden py-1"
            style={{ minWidth: 148, maxHeight: 252, overflowY: "auto", scrollbarWidth: "none" }}
          >
            <div ref={listRef}>
              {items.map((item) => {
                const isSel = item.value === value;
                return (
                  <button
                    key={item.value}
                    onClick={() => { onChange(item.value); setOpen(false); }}
                    className={`w-full flex flex-col items-center justify-center px-4 py-2.5 transition-colors cursor-pointer ${
                      isSel
                        ? "bg-indigo-600 text-white"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <span className={`text-sm font-bold leading-tight ${isSel ? "text-white" : "text-gray-900"}`}>
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span className={`text-[10px] font-semibold mt-0.5 ${isSel ? "text-indigo-200" : "text-gray-400"}`}>
                        {item.sublabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
