// Shared form primitives for holding type forms
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

const CURRENCIES = ["USD", "VND", "EUR"] as const;

export function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-[#042C53]">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, uppercase, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; uppercase?: boolean; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
      onBlur={uppercase ? e => onChange(e.target.value.toUpperCase()) : undefined}
      placeholder={placeholder}
      className={cn("w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]", className)}
    />
  );
}

export function TextareaInput({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] resize-none"
    />
  );
}

export function NumberInput({ value, onChange, placeholder, step = "any", min = 0, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; step?: string; min?: number; className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? "0"}
      step={step}
      min={min}
      style={{ MozAppearance: "textfield" } as React.CSSProperties}
      className={cn("w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", className)}
    />
  );
}

export function AmountWithCurrency({ amount, onAmountChange, currency, onCurrencyChange }: {
  amount: string; onAmountChange: (v: string) => void;
  currency: string; onCurrencyChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <NumberInput value={amount} onChange={onAmountChange} className="flex-1" />
      <select
        value={currency}
        onChange={e => onCurrencyChange(e.target.value)}
        className="px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] bg-white focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
      >
        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

export function DateInput({ value, onChange, label, required }: {
  value: string; onChange: (v: string) => void; label?: string; required?: boolean;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      max={new Date().toISOString().split("T")[0]}
      className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
    />
  );
}

interface SymbolResult { symbol: string; name: string; type: string; }

export type SymbolSearchType = "stock_etf" | "etf" | "mutual_fund" | "commodity" | "bond" | "crypto";

const POPULAR_STOCKS: SymbolResult[] = [
  { symbol: "AAPL", name: "Apple Inc.", type: "Equity" },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "Equity" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Equity" },
  { symbol: "NVDA", name: "NVIDIA Corp.", type: "Equity" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Equity" },
  { symbol: "META", name: "Meta Platforms", type: "Equity" },
  { symbol: "BRK.B", name: "Berkshire Hathaway B", type: "Equity" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "Equity" },
  { symbol: "V", name: "Visa Inc.", type: "Equity" },
];

const POPULAR_ETFS: SymbolResult[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "ETF" },
  { symbol: "QQQ", name: "Invesco Nasdaq-100 ETF", type: "ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF" },
  { symbol: "VTI", name: "Vanguard Total Market ETF", type: "ETF" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF", type: "ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF", type: "ETF" },
  { symbol: "VEA", name: "Vanguard FTSE Dev Markets ETF", type: "ETF" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets", type: "ETF" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "ETF" },
  { symbol: "GLD", name: "SPDR Gold Shares ETF", type: "ETF" },
];

const POPULAR_MUTUAL_FUNDS: SymbolResult[] = [
  { symbol: "VFIAX", name: "Vanguard 500 Index Fund Admiral", type: "Fund" },
  { symbol: "FXAIX", name: "Fidelity 500 Index Fund", type: "Fund" },
  { symbol: "SWPPX", name: "Schwab S&P 500 Index Fund", type: "Fund" },
  { symbol: "VTSAX", name: "Vanguard Total Stock Market Index", type: "Fund" },
  { symbol: "VBTLX", name: "Vanguard Total Bond Market Index", type: "Fund" },
  { symbol: "PRGFX", name: "T. Rowe Price Growth Stock Fund", type: "Fund" },
  { symbol: "FCNTX", name: "Fidelity Contrafund", type: "Fund" },
  { symbol: "AGTHX", name: "American Funds Growth Fund", type: "Fund" },
];

const POPULAR_COMMODITIES: SymbolResult[] = [
  { symbol: "GC=F", name: "Gold Futures ($/troy oz)", type: "Commodity" },
  { symbol: "SI=F", name: "Silver Futures ($/troy oz)", type: "Commodity" },
  { symbol: "CL=F", name: "WTI Crude Oil Futures ($/barrel)", type: "Commodity" },
  { symbol: "NG=F", name: "Natural Gas Futures", type: "Commodity" },
  { symbol: "PL=F", name: "Platinum Futures", type: "Commodity" },
  { symbol: "HG=F", name: "Copper Futures", type: "Commodity" },
  { symbol: "GLD", name: "SPDR Gold Shares ETF", type: "ETF" },
  { symbol: "SLV", name: "iShares Silver Trust ETF", type: "ETF" },
  { symbol: "USO", name: "United States Oil Fund ETF", type: "ETF" },
  { symbol: "PDBC", name: "Invesco Optimum Yield Diversified Commodity", type: "ETF" },
];

const POPULAR_BONDS: SymbolResult[] = [
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "Bond ETF" },
  { symbol: "AGG", name: "iShares Core US Aggregate Bond ETF", type: "Bond ETF" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", type: "Bond ETF" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", type: "Bond ETF" },
  { symbol: "HYG", name: "iShares iBoxx High Yield Corp Bond ETF", type: "Bond ETF" },
  { symbol: "LQD", name: "iShares Investment Grade Corporate Bond", type: "Bond ETF" },
  { symbol: "BNDX", name: "Vanguard Total Intl Bond Market ETF", type: "Bond ETF" },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", type: "Bond ETF" },
];

const POPULAR_CRYPTO: SymbolResult[] = [
  { symbol: "BTC", name: "Bitcoin", type: "Crypto" },
  { symbol: "ETH", name: "Ethereum", type: "Crypto" },
  { symbol: "BNB", name: "Binance Coin", type: "Crypto" },
  { symbol: "SOL", name: "Solana", type: "Crypto" },
  { symbol: "XRP", name: "XRP (Ripple)", type: "Crypto" },
  { symbol: "ADA", name: "Cardano", type: "Crypto" },
  { symbol: "DOGE", name: "Dogecoin", type: "Crypto" },
  { symbol: "AVAX", name: "Avalanche", type: "Crypto" },
  { symbol: "MATIC", name: "Polygon", type: "Crypto" },
  { symbol: "DOT", name: "Polkadot", type: "Crypto" },
];

function getPopularList(symbolType: SymbolSearchType): SymbolResult[] {
  switch (symbolType) {
    case "etf": return POPULAR_ETFS;
    case "mutual_fund": return POPULAR_MUTUAL_FUNDS;
    case "commodity": return POPULAR_COMMODITIES;
    case "bond": return POPULAR_BONDS;
    case "crypto": return POPULAR_CRYPTO;
    default: return POPULAR_STOCKS;
  }
}

function getSearchApiType(symbolType: SymbolSearchType): string {
  return symbolType === "crypto" ? "crypto" : symbolType;
}

export function SymbolSearchInput({ value, onChange, onSelect, symbolType, placeholder }: {
  value: string;
  onChange: (symbol: string) => void;
  onSelect?: (symbol: string) => void;
  symbolType: SymbolSearchType;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [selected, setSelected] = useState(false);
  const [showingPopular, setShowingPopular] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const popularList = getPopularList(symbolType);

  // Keep display in sync if parent resets value
  useEffect(() => {
    setQuery(value);
    if (!value) setSelected(false);
  }, [value]);

  const search = useCallback((q: string) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return; }
    setFetching(true);
    const apiType = getSearchApiType(symbolType);
    apiFetch<SymbolResult[]>(`/symbols/search?q=${encodeURIComponent(q)}&type=${apiType}`)
      .then(r => { setResults(r); setOpen(r.length > 0); setShowingPopular(false); })
      .catch(() => setResults([]))
      .finally(() => setFetching(false));
  }, [symbolType]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase();
    setQuery(v);
    setSelected(false);
    onChange(v);
    setShowingPopular(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v) {
      setResults([]);
      setOpen(false);
    } else {
      debounceRef.current = setTimeout(() => search(v), 300);
    }
  }

  function handleFocus() {
    if (!query && !selected) {
      setShowingPopular(true);
      setOpen(true);
    } else if (results.length > 0 && !selected) {
      setOpen(true);
    }
  }

  function handleSelect(item: SymbolResult) {
    setQuery(item.symbol);
    onChange(item.symbol);
    onSelect?.(item.symbol);
    setSelected(true);
    setOpen(false);
    setResults([]);
    setShowingPopular(false);
  }

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowingPopular(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const displayList = showingPopular ? popularList : results;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          placeholder={placeholder ?? "Search or pick from popular…"}
          className="w-full px-4 py-2.5 pr-9 rounded-xl border border-[#E2E8F0] text-sm text-[#042C53] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
        />
        {fetching ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs animate-pulse">…</span>
        ) : selected && value ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1D9E75] text-xs">✓</span>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▾</span>
        )}
      </div>
      {open && displayList.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {showingPopular && (
            <li className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
              Popular {symbolType === "crypto" ? "Cryptocurrencies" : symbolType === "etf" ? "ETFs" : symbolType === "mutual_fund" ? "Mutual Funds" : symbolType === "commodity" ? "Commodities" : symbolType === "bond" ? "Bonds" : "Stocks"}
            </li>
          )}
          {displayList.map(item => (
            <li
              key={item.symbol}
              onMouseDown={() => handleSelect(item)}
              className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-[#F0FBF7] text-sm"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[#042C53] truncate">{item.symbol}</span>
                <span className="text-xs text-slate-500 truncate">{item.name}</span>
              </div>
              <span className="ml-2 text-[10px] text-slate-400 uppercase flex-shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">{item.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SubmitButton({ label, disabled, loading, onClick }: {
  label: string; disabled?: boolean; loading?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3 rounded-xl bg-[#1D9E75] text-white font-semibold text-sm hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? "Saving…" : label}
    </button>
  );
}
