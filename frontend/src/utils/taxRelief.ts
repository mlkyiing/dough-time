import { TaxReliefCategory, Transaction } from "../types";

export const LHDN_TAX_RELIEF_CATEGORIES: TaxReliefCategory[] = [
  {
    code: "lifestyle",
    title: "Lifestyle Expenses",
    maxLimit: 2500,
    description: "Books, newspapers, tech gadgets, smartphones, computers, sports equipment, gym membership, home internet bills.",
    qualifyingCategories: ["Shopping", "Telco", "Bills", "Subscriptions", "Entertainment"],
    icon: "💻",
  },
  {
    code: "medical",
    title: "Medical & Health",
    maxLimit: 10000,
    description: "Medical expenses for serious diseases, complete medical examination (up to RM 1,000), dental treatment (up to RM 1,000), parents' medical.",
    qualifyingCategories: ["Health"],
    icon: "💊",
  },
  {
    code: "insurance_epf",
    title: "Life Insurance & EPF",
    maxLimit: 7000,
    description: "Life insurance premiums, voluntary EPF contributions, and approved retirement schemes.",
    qualifyingCategories: ["Investment", "Bills"],
    icon: "🛡️",
  },
  {
    code: "education_sspn",
    title: "Education & SSPN",
    maxLimit: 8000,
    description: "Net deposit in Skim Simpanan Pendidikan Nasional (SSPN), self higher education fees in recognized institutions.",
    qualifyingCategories: ["Investment", "Other"],
    icon: "🎓",
  },
];

export interface TaxReliefUsage {
  category: TaxReliefCategory;
  spent: number;
  remaining: number;
  percentageUsed: number;
  estimatedTaxSaved: number; // Assumes average 13% - 21% Malaysian middle tax bracket (~15%)
  qualifyingTransactions: Transaction[];
}

/**
 * Checks if a transaction likely qualifies for an LHDN tax relief
 */
export function detectTaxReliefTag(t: {
  category?: string;
  merchant?: string;
  note?: string;
}): string | undefined {
  const text = `${t.category || ""} ${t.merchant || ""} ${t.note || ""}`.toLowerCase();

  // 1. Lifestyle
  if (
    text.includes("unifi") ||
    text.includes("maxis") ||
    text.includes("celcom") ||
    text.includes("digi") ||
    text.includes("time internet") ||
    text.includes("popular") ||
    text.includes("kinokuniya") ||
    text.includes("mph") ||
    text.includes("book") ||
    text.includes("apple") ||
    text.includes("samsung") ||
    text.includes("laptop") ||
    text.includes("phone") ||
    text.includes("gym") ||
    text.includes("fitness") ||
    text.includes("decathlon") ||
    text.includes("badminton")
  ) {
    return "lifestyle";
  }

  // 2. Medical
  if (
    text.includes("clinic") ||
    text.includes("klinik") ||
    text.includes("hospital") ||
    text.includes("pharmacy") ||
    text.includes("guardian") ||
    text.includes("watsons") ||
    text.includes("caring") ||
    text.includes("dental") ||
    text.includes("doctor") ||
    text.includes("optometry") ||
    text.includes("health")
  ) {
    return "medical";
  }

  // 3. Insurance & EPF
  if (
    text.includes("insurance") ||
    text.includes("takaful") ||
    text.includes("prudential") ||
    text.includes("great eastern") ||
    text.includes("aia") ||
    text.includes("allianz") ||
    text.includes("epf") ||
    text.includes("kwsp")
  ) {
    return "insurance_epf";
  }

  // 4. SSPN / Education
  if (text.includes("sspn") || text.includes("ptptn") || text.includes("tuition") || text.includes("university")) {
    return "education_sspn";
  }

  return undefined;
}

/**
 * Calculates current year's LHDN tax relief usage
 */
export function calculateTaxReliefSummary(
  transactions: Transaction[],
  year: number = new Date().getFullYear(),
  assumedTaxBracketPct: number = 15
): {
  items: TaxReliefUsage[];
  totalClaimable: number;
  totalEstimatedTaxSaved: number;
} {
  const yearStr = String(year);
  const yearTxns = transactions.filter(
    (t) => t.date && t.date.startsWith(yearStr) && t.type !== "income" && t.type !== "transfer"
  );

  let totalClaimable = 0;
  let totalEstimatedTaxSaved = 0;

  const items: TaxReliefUsage[] = LHDN_TAX_RELIEF_CATEGORIES.map((cat) => {
    // Find qualifying txns
    const qualifying = yearTxns.filter((t) => {
      if (t.taxReliefCode === cat.code) return true;
      const detected = detectTaxReliefTag(t);
      return detected === cat.code;
    });

    const sumSpent = qualifying.reduce((s, t) => s + t.amount, 0);
    const claimable = Math.min(cat.maxLimit, sumSpent);
    const remaining = Math.max(0, cat.maxLimit - claimable);
    const pct = Math.min(100, Math.round((claimable / cat.maxLimit) * 100));
    const taxSaved = +(claimable * (assumedTaxBracketPct / 100)).toFixed(2);

    totalClaimable += claimable;
    totalEstimatedTaxSaved += taxSaved;

    return {
      category: cat,
      spent: sumSpent,
      remaining,
      percentageUsed: pct,
      estimatedTaxSaved: taxSaved,
      qualifyingTransactions: qualifying,
    };
  });

  return {
    items,
    totalClaimable,
    totalEstimatedTaxSaved,
  };
}
