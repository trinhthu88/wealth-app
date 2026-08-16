import { useState } from "react";

// Common countries shown first in the picker
const COMMON_COUNTRIES = [
  { code: "VN", name: "Vietnam" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "HK", name: "Hong Kong" },
  { code: "TH", name: "Thailand" },
  { code: "DE", name: "Germany" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
];

const ALL_COUNTRIES = [
  ...COMMON_COUNTRIES,
  { code: "AF", name: "Afghanistan" }, { code: "AR", name: "Argentina" },
  { code: "AT", name: "Austria" }, { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" }, { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" }, { code: "KH", name: "Cambodia" },
  { code: "CL", name: "Chile" }, { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" }, { code: "HR", name: "Croatia" },
  { code: "CZ", name: "Czech Republic" }, { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" }, { code: "FI", name: "Finland" },
  { code: "GH", name: "Ghana" }, { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" }, { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" }, { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" }, { code: "JO", name: "Jordan" },
  { code: "KE", name: "Kenya" }, { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" }, { code: "LB", name: "Lebanon" },
  { code: "MY", name: "Malaysia" }, { code: "MX", name: "Mexico" },
  { code: "MA", name: "Morocco" }, { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" }, { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" }, { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" }, { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" }, { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" }, { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" }, { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" }, { code: "LK", name: "Sri Lanka" },
  { code: "SE", name: "Sweden" }, { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" }, { code: "TR", name: "Turkey" },
  { code: "UG", name: "Uganda" }, { code: "UA", name: "Ukraine" },
];

// Deduplicate (common countries appear once)
const COUNTRIES = Array.from(
  new Map(ALL_COUNTRIES.map(c => [c.code, c])).values()
).sort((a, b) => {
  const ai = COMMON_COUNTRIES.findIndex(c => c.code === a.code);
  const bi = COMMON_COUNTRIES.findIndex(c => c.code === b.code);
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.name.localeCompare(b.name);
});

const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD" },
  { code: "VND", symbol: "₫", label: "VND" },
  { code: "EUR", symbol: "€", label: "EUR" },
] as const;

export interface Screen1Data {
  fullName: string;
  dateOfBirth: string;
  countryCode: string;
  isExpat: boolean;
  preferredCurrency: "USD" | "VND" | "EUR";
}

interface Props {
  data: Screen1Data;
  onChange: (updates: Partial<Screen1Data>) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-[#042C53]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-[#1D9E75]" : "bg-slate-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function Phase1Screen1Basics({ data, onChange }: Props) {
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 18);
  const minDob = new Date();
  minDob.setFullYear(minDob.getFullYear() - 100);

  const filtered = countrySearch
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  const selectedCountryName = COUNTRIES.find(c => c.code === data.countryCode)?.name ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#042C53] mb-1">Welcome — let's get you set up</h1>
        <p className="text-sm text-slate-500">This takes about 10 minutes. You can pause and resume any time.</p>
      </div>

      {/* Full name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">Your full name</label>
        <input
          type="text"
          value={data.fullName}
          onChange={e => onChange({ fullName: e.target.value })}
          placeholder="e.g. Marc Bourreli"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] transition-colors"
        />
      </div>

      {/* Date of birth */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">Date of birth</label>
        <input
          type="date"
          value={data.dateOfBirth}
          max={maxDob.toISOString().split("T")[0]}
          min={minDob.toISOString().split("T")[0]}
          onChange={e => onChange({ dateOfBirth: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] transition-colors"
        />
      </div>

      {/* Country */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[#042C53]">Where do you live?</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCountryOpen(v => !v)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] transition-colors"
          >
            <span className={selectedCountryName ? "text-[#042C53]" : "text-slate-400"}>
              {selectedCountryName || "Select country…"}
            </span>
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {countryOpen && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input
                  autoFocus
                  type="text"
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  placeholder="Search country…"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.slice(0, 60).map(c => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => { onChange({ countryCode: c.code }); setCountryOpen(false); setCountrySearch(""); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${data.countryCode === c.code ? "text-[#1D9E75] font-medium" : "text-[#042C53]"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expat toggle */}
      <Toggle
        checked={data.isExpat}
        onChange={v => onChange({ isExpat: v })}
        label="Are you living outside your home country?"
      />

      {/* Currency selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#042C53]">Which currency do you prefer to see?</label>
        <div className="grid grid-cols-3 gap-3">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => onChange({ preferredCurrency: c.code })}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                data.preferredCurrency === c.code
                  ? "border-[#1D9E75] bg-[#1D9E75]/5 text-[#1D9E75]"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <span className="text-xl font-bold">{c.symbol}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">You can change this any time in settings.</p>
      </div>
    </div>
  );
}
