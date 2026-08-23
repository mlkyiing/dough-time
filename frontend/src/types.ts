export type AccountType =
  | "ewallet"
  | "bank"
  | "cash"
  | "credit_card"
  | "fd"
  | "loan"
  | "investment";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  emoji: string;
  color: string;
  balance: number; // For assets: balance. For liabilities (credit card / loan): amount owed.
  creditLimit?: number; // Optional limit for credit cards
  interestRate?: number; // Optional APY for FD or APR for Loans
  // Repayment & Loan Reminder Settings 🔔
  dueDay?: number; // 1 to 31 (day of month)
  monthlyInstallment?: number; // e.g. RM 650
  reminderEnabled?: boolean;
  reminderDaysBefore?: number; // 1, 2, 3, or 5 days before due date
};

export type Transaction = {
  id: string;
  amount: number; // positive = expense, negative = income / repayment
  category: string;
  accountId: string;
  note?: string;
  merchant?: string;
  date: string; // ISO
  createdAt: string;
};

export type WageSettings = {
  mode: "salary" | "hourly";
  monthlySalary: number; // default: 4500
  hoursPerWeek: number; // default: 40
  hourlyRate: number; // e.g. ~26.00
  currency: string;
};

export type CategoryBudget = {
  category: string;
  monthlyLimit: number;
};

export type BudgetSettings = {
  monthlyOverallLimit: number; // e.g. RM 2000
  categoryBudgets: CategoryBudget[];
  enabled: boolean;
};

export function isLiabilityAccount(accountOrType: Account | AccountType): boolean {
  const type = typeof accountOrType === "string" ? accountOrType : accountOrType.type;
  return type === "credit_card" || type === "loan";
}

export function isAssetAccount(accountOrType: Account | AccountType): boolean {
  return !isLiabilityAccount(accountOrType);
}

export type SyncStatus = "idle" | "synced" | "syncing" | "offline" | "error";

export type SyncSession = {
  syncId: string;
  syncCode: string;
  lastSyncedAt?: string;
  lastModifiedAt?: string;
  autoSyncEnabled: boolean;
};

export type VaultSnapshot = {
  syncId?: string;
  syncCode?: string;
  accounts: Account[];
  transactions: Transaction[];
  wageSettings: WageSettings;
  budgetSettings: BudgetSettings;
  lastModified: string;
  appVersion?: string;
};
