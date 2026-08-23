import { Account, AllocationPreset, BudgetBucket, BudgetSettings, isAssetAccount, isLiabilityAccount, Transaction, WageSettings } from "../types";

export const NEEDS_CATEGORIES: string[] = [
  "Bills",
  "Groceries",
  "Petrol",
  "Tolls",
  "Telco",
  "Health",
  "Loan / Debt",
  "Makan",
];

export const COMFORT_CATEGORIES: string[] = [
  "Shopping", // Pinduoduo, Shopee, Taobao, Uniqlo
  "Entertainment", // Movies, games, outings
  "Subscriptions", // Netflix, Spotify, gym
  "Other", // Boba, café visits, spontaneous treats
];

export const SAVINGS_CATEGORIES: string[] = [
  "Investment",
];

/**
 * Returns which bucket a transaction category belongs to:
 * - "needs": Essentials, food, transport, bills, fixed commitments
 * - "comfort": Guilt-free comfort, "nonsense" money, shopping (Pinduoduo/Shopee), boba, treats
 * - "savings": Future wealth, investments, emergency stash
 */
export function getCategoryBucket(category?: string | null): BudgetBucket {
  if (!category) return "needs";
  if (COMFORT_CATEGORIES.includes(category)) return "comfort";
  if (SAVINGS_CATEGORIES.includes(category)) return "savings";
  return "needs";
}

export interface BudgetPresetRatio {
  id: AllocationPreset;
  title: string;
  emoji: string;
  desc: string;
  needsPct: number;
  comfortPct: number;
  savingsPct: number;
}

export const BUDGET_PRESETS: BudgetPresetRatio[] = [
  {
    id: "balanced_50_30_20",
    title: "50/30/20 Balanced Life",
    emoji: "⚖️",
    desc: "50% Needs · 30% Guilt-Free Comfort & Treats · 20% Savings",
    needsPct: 50,
    comfortPct: 30,
    savingsPct: 20,
  },
  {
    id: "comfort_45_40_15",
    title: "Treat Yourself (Comfort Priority)",
    emoji: "🛍️",
    desc: "45% Needs · 40% Pinduoduo, Boba & Fun · 15% Savings",
    needsPct: 45,
    comfortPct: 40,
    savingsPct: 15,
  },
  {
    id: "frugal_60_15_25",
    title: "Frugal Wealth Builder",
    emoji: "🏦",
    desc: "60% Essentials · 15% Comfort · 25% High Savings",
    needsPct: 60,
    comfortPct: 15,
    savingsPct: 25,
  },
];

export interface AnalyzedBudgetPool {
  selectedAccounts: Account[];
  totalLiquidBalance: number;
  committedLiabilities: number;
  monthlyIncome: number;
  effectiveSpendableBudget: number;
  recommendedNeeds: number;
  recommendedComfort: number;
  recommendedSavings: number;
}

/**
 * Analyzes selected accounts and monthly commitments to generate safe, human-centric budgets
 */
export function analyzeAccountBudget(
  accounts: Account[],
  wage: WageSettings,
  selectedAccountIds?: string[],
  presetId: AllocationPreset = "balanced_50_30_20"
): AnalyzedBudgetPool {
  const liquidAssets = accounts.filter(
    (a) => isAssetAccount(a) && (a.type === "bank" || a.type === "ewallet" || a.type === "cash")
  );

  const selectedAccounts =
    selectedAccountIds && selectedAccountIds.length > 0
      ? accounts.filter((a) => selectedAccountIds.includes(a.id))
      : liquidAssets.length > 0
      ? liquidAssets
      : accounts.filter(isAssetAccount);

  const totalLiquidBalance = selectedAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  // Sum mandatory monthly commitments (loans, scheduled installments)
  const liabilities = accounts.filter(isLiabilityAccount);
  const committedLiabilities = liabilities.reduce((sum, a) => {
    return sum + (a.monthlyInstallment || 0);
  }, 0);

  const monthlyIncome = wage.monthlySalary > 0 ? wage.monthlySalary : 3500;

  // Base spending pool = monthly salary (or current liquid cash pool) minus fixed commitments
  const rawPool = Math.max(800, monthlyIncome - committedLiabilities);

  const preset =
    BUDGET_PRESETS.find((p) => p.id === presetId) || BUDGET_PRESETS[0];

  const recommendedNeeds = Math.round((rawPool * preset.needsPct) / 100);
  const recommendedComfort = Math.round((rawPool * preset.comfortPct) / 100);
  const recommendedSavings = Math.round((rawPool * preset.savingsPct) / 100);
  const effectiveSpendableBudget = recommendedNeeds + recommendedComfort;

  return {
    selectedAccounts,
    totalLiquidBalance,
    committedLiabilities,
    monthlyIncome,
    effectiveSpendableBudget,
    recommendedNeeds,
    recommendedComfort,
    recommendedSavings,
  };
}

export interface BucketSpendingSummary {
  needsSpent: number;
  comfortSpent: number;
  savingsSpent: number;
  totalSpent: number;
  needsCount: number;
  comfortCount: number;
}

/**
 * Calculates current month's spending segregated into Needs vs Comfort / "Nonsense" money
 */
export function calculateBucketSpending(
  transactions: Transaction[],
  monthISO: string
): BucketSpendingSummary {
  let needsSpent = 0;
  let comfortSpent = 0;
  let savingsSpent = 0;
  let totalSpent = 0;
  let needsCount = 0;
  let comfortCount = 0;

  for (const t of transactions) {
    if (t.date && t.date.startsWith(monthISO) && t.amount > 0) {
      totalSpent += t.amount;
      const bucket = getCategoryBucket(t.category);
      if (bucket === "comfort") {
        comfortSpent += t.amount;
        comfortCount += 1;
      } else if (bucket === "savings") {
        savingsSpent += t.amount;
      } else {
        needsSpent += t.amount;
        needsCount += 1;
      }
    }
  }

  return {
    needsSpent,
    comfortSpent,
    savingsSpent,
    totalSpent,
    needsCount,
    comfortCount,
  };
}
