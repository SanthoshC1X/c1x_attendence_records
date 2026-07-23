import { useEffect, useMemo, useState } from "react";
import type { EmployeeDashboard } from "../types";
import { avatarColor, initials } from "../utils";

interface Props {
  open: boolean;
  title: string;
  accentDot?: string; // tailwind bg class for the title dot
  employees: EmployeeDashboard[];
  onClose: () => void;
  onSelectEmployee: (employee: EmployeeDashboard) => void;
}

export default function EmployeeListModal({ open, title, accentDot, employees, onClose, onSelectEmployee }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setSearch("");
      requestAnimationFrame(() => setVisible(true));
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) =>
      e.name.toLowerCase().includes(q) || e.emp_id.toLowerCase().includes(q),
    );
  }, [employees, search]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl transition-all duration-200 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        style={{ maxHeight: "min(640px, 88vh)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {accentDot && <span className={`h-2 w-2 rounded-full ${accentDot}`} />}
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-950">{title}</h2>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              {employees.length} {employees.length === 1 ? "employee" : "employees"} · tap to open calendar
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or employee ID"
              className="w-full rounded-md border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-[13px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:bg-white"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {filtered.length === 0 ? (
            <div className="px-2 py-10 text-center text-[13px] text-slate-400">
              {employees.length === 0 ? "No employees in this category." : "No matches."}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((emp) => {
                const color = avatarColor(emp.emp_id);
                const ini = initials(emp.name);
                return (
                  <li key={emp.emp_id}>
                    <button
                      onClick={() => onSelectEmployee(emp)}
                      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${color}`}>
                        <span className="text-[11px] font-semibold text-white">{ini}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-900">{emp.name}</p>
                        <p className="text-[11px] text-slate-400">#{emp.emp_id}</p>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
