import { useCallback, useRef, useState } from "react";

interface Props {
  label: string;
  description: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  variant?: "dark" | "light";
}

export default function FileDropZone({ label, description, file, onFile, onClear, variant = "dark" }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.name.endsWith(".xlsx")) onFile(f);
  }, [onFile]);

  const isDark = variant === "dark";

  return (
    <div
      className={`border-2 border-dashed rounded-none p-8 text-center transition-all cursor-pointer ${
        dragActive
          ? isDark ? "border-indigo-400 bg-indigo-950/50" : "border-indigo-400 bg-indigo-50"
          : file
            ? isDark ? "border-emerald-500 bg-emerald-950/30" : "border-emerald-400 bg-emerald-50"
            : isDark ? "border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800" : "border-gray-200 bg-gray-50 hover:border-gray-300"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />

      {file ? (
        <div>
          {/* File icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${isDark ? "bg-emerald-900/50" : "bg-emerald-100"}`}>
            <svg className={`w-6 h-6 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{file.name}</p>
          <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{(file.size / 1024).toFixed(1)} KB</p>
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="mt-3 text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
          >
            Remove file
          </button>
        </div>
      ) : (
        <div>
          {/* Upload icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
            <svg className={`w-6 h-6 ${isDark ? "text-gray-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{label}</p>
          <p className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>{description}</p>
          <p className={`text-xs mt-2 ${isDark ? "text-gray-600" : "text-gray-400"}`}>Drag & drop .xlsx or click to browse</p>
        </div>
      )}
    </div>
  );
}
