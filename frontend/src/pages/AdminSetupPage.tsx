import { useState } from "react";
import axios from "axios";
import Button from "../components/ui/Button";

interface Props {
  onConfigured: () => void;
  onCancel?: () => void;
}

function extractSheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId.trim();
}

export default function AdminSetupPage({ onConfigured, onCancel }: Props) {
  const [attUrl,   setAttUrl]   = useState("");
  const [leaveUrl, setLeaveUrl] = useState("");
  const [apiKey,   setApiKey]   = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showKey,  setShowKey]  = useState(false);

  const handleSave = async () => {
    if (!attUrl.trim() || !apiKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await axios.post("/api/admin/config", {
        attendance_sheet_url: attUrl.trim(),
        leave_sheet_url:      leaveUrl.trim() || undefined,
        google_api_key:       apiKey.trim(),
      });
      onConfigured();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response)
        setError(err.response.data?.detail || "Failed to connect to Google Sheets");
      else
        setError("Network error — is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg relative">
        {/* Header */}
        <div className="text-center mb-8">
          {onCancel && (
            <button onClick={onCancel} className="mb-4 text-[12.5px] font-medium text-slate-400 hover:text-slate-700">
              ← Back to dashboard
            </button>
          )}
          <div className="inline-flex items-center justify-center w-11 h-11 bg-slate-900 mb-4">
            {/* Google Sheets icon */}
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Connect Google Sheets</h2>
          <p className="text-gray-500 text-[13px] mt-1.5">
            Link your sheets once — the dashboard auto-refreshes every 10 minutes.
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-8 space-y-5">

          {/* How-to banner */}
          <div className="bg-slate-50 border border-slate-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-600">How to get a Google API key (5 min)</p>
            <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Go to <span className="font-mono bg-slate-200 px-1">console.cloud.google.com</span> → New Project</li>
              <li>Search <span className="font-semibold">"Google Sheets API"</span> → Enable</li>
              <li>APIs &amp; Services → Credentials → <span className="font-semibold">+ Create API Key</span></li>
              <li>Copy the key and paste it below</li>
              <li>Make sure both sheets are shared as <span className="font-semibold">"Anyone with the link can view"</span></li>
            </ol>
          </div>

          {/* Attendance sheet URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Attendance Sheet URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={attUrl}
              onChange={(e) => { setAttUrl(e.target.value); setError(null); }}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-slate-900 transition-colors"
            />
            {attUrl.trim() && (
              <p className="mt-1 text-xs text-gray-400">
                Sheet ID: <span className="font-mono text-gray-600">{extractSheetId(attUrl)}</span>
              </p>
            )}
          </div>

          {/* Leave sheet URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Leave / WFH Sheet URL{" "}
              <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={leaveUrl}
              onChange={(e) => setLeaveUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit"
              className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Google API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(null); }}
                placeholder="AIzaSy…"
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 font-mono focus:outline-none focus:border-slate-900 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Stored securely in <span className="font-mono">backend/config.json</span> on your server.
            </p>
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 text-red-600 text-[13px]">
              {error}
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!attUrl.trim() || !apiKey.trim() || saving}
            className="w-full py-3 text-[13px]"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting to Google Sheets…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Connect &amp; Load Dashboard
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
