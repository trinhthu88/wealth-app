export interface HoldingTypeConfig {
  type: string;
  label: string;
  icon: string;
  color: string;
  textColor: string;
  description: string;
  priceSource: "api" | "manual";
  requiredFields: string[];
  optionalFields: string[];
}

export const HOLDING_TYPE_CONFIG: HoldingTypeConfig[] = [
  {
    type: "stock_etf",
    label: "Stocks",
    icon: "TrendingUp",
    color: "bg-emerald-100",
    textColor: "text-emerald-700",
    description: "Individual company shares with live price",
    priceSource: "api",
    requiredFields: ["label", "ticker", "broker_platform", "units_held", "average_cost_price", "currency"],
    optionalFields: ["purchase_date", "notes"],
  },
  {
    type: "etf",
    label: "ETFs",
    icon: "BarChart3",
    color: "bg-teal-100",
    textColor: "text-teal-700",
    description: "Index, sector & thematic ETFs with live price",
    priceSource: "api",
    requiredFields: ["label", "ticker", "units_held", "average_cost_price", "currency"],
    optionalFields: ["broker_platform", "purchase_date", "notes"],
  },
  {
    type: "mutual_fund",
    label: "Mutual Funds",
    icon: "PieChart",
    color: "bg-cyan-100",
    textColor: "text-cyan-700",
    description: "Actively or passively managed funds with live NAV",
    priceSource: "api",
    requiredFields: ["label", "ticker", "units_held", "average_cost_price", "currency"],
    optionalFields: ["broker_platform", "purchase_date", "notes"],
  },
  {
    type: "crypto",
    label: "Crypto",
    icon: "Cpu",
    color: "bg-orange-100",
    textColor: "text-orange-700",
    description: "Cryptocurrency held on an exchange or wallet",
    priceSource: "api",
    requiredFields: ["label", "coin_symbol", "units_held", "average_cost_price", "currency"],
    optionalFields: ["exchange_name", "purchase_date", "notes"],
  },
  {
    type: "commodity",
    label: "Commodities",
    icon: "Layers",
    color: "bg-yellow-100",
    textColor: "text-yellow-700",
    description: "Gold, silver, oil & other physical assets with live price",
    priceSource: "api",
    requiredFields: ["label", "ticker", "units_held", "average_cost_price", "currency"],
    optionalFields: ["broker_platform", "purchase_date", "notes"],
  },
  {
    type: "bond",
    label: "Bonds",
    icon: "FileText",
    color: "bg-indigo-100",
    textColor: "text-indigo-700",
    description: "Corporate, government & bond ETFs with live price",
    priceSource: "api",
    requiredFields: ["label", "ticker", "units_held", "average_cost_price", "currency"],
    optionalFields: ["broker_platform", "purchase_date", "notes"],
  },
  {
    type: "property",
    label: "Property",
    icon: "Home",
    color: "bg-blue-100",
    textColor: "text-blue-700",
    description: "Real estate — residential, commercial or investment",
    priceSource: "manual",
    requiredFields: ["label", "purchase_price", "current_estimated_value", "currency"],
    optionalFields: ["property_address", "outstanding_mortgage", "monthly_rental_income", "purchase_date", "notes"],
  },
  {
    type: "cash",
    label: "Cash & Savings",
    icon: "Landmark",
    color: "bg-sky-100",
    textColor: "text-sky-700",
    description: "Bank accounts, fixed deposits, savings accounts",
    priceSource: "manual",
    requiredFields: ["label", "bank_name", "current_balance", "currency"],
    optionalFields: ["account_type", "interest_rate_pct", "notes"],
  },
  {
    type: "pension",
    label: "Pension",
    icon: "Shield",
    color: "bg-violet-100",
    textColor: "text-violet-700",
    description: "Pension or retirement fund (any country)",
    priceSource: "manual",
    requiredFields: ["label", "scheme_name", "current_balance_pension", "currency"],
    optionalFields: ["pension_country", "monthly_contribution", "employer_contribution", "notes"],
  },
  {
    type: "other",
    label: "Other",
    icon: "Package",
    color: "bg-gray-100",
    textColor: "text-gray-700",
    description: "Any other investment not covered above",
    priceSource: "manual",
    requiredFields: ["label", "current_value_other", "currency"],
    optionalFields: ["total_invested_other", "purchase_date", "notes"],
  },
];

export function getHoldingTypeConfig(type: string): HoldingTypeConfig {
  return HOLDING_TYPE_CONFIG.find((c) => c.type === type) || HOLDING_TYPE_CONFIG[5];
}
