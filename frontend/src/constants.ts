import Constants from "expo-constants";
import { colors } from "./theme";
import { AccountType } from "./types";

export type CategoryKey =
  | "Makan"
  | "Groceries"
  | "Transport"
  | "Petrol"
  | "Tolls"
  | "Telco"
  | "Bills"
  | "Subscriptions"
  | "Shopping"
  | "Health"
  | "Entertainment"
  | "Loan / Debt"
  | "Investment"
  | "Other";

export const CATEGORIES: {
  key: CategoryKey;
  emoji: string;
  icon: string;
  tint: string;
}[] = [
  { key: "Makan", emoji: "🍜", icon: "fast-food-outline", tint: colors.pink },
  { key: "Groceries", emoji: "🛒", icon: "basket-outline", tint: colors.mint },
  { key: "Transport", emoji: "🚗", icon: "car-outline", tint: colors.lavender },
  { key: "Petrol", emoji: "⛽", icon: "flame-outline", tint: colors.peach },
  { key: "Tolls", emoji: "🛣️", icon: "trail-sign-outline", tint: colors.sky },
  { key: "Telco", emoji: "📱", icon: "phone-portrait-outline", tint: colors.lemon },
  { key: "Bills", emoji: "🧾", icon: "receipt-outline", tint: colors.pink },
  { key: "Subscriptions", emoji: "🎬", icon: "repeat-outline", tint: colors.lavender },
  { key: "Shopping", emoji: "🛍️", icon: "bag-handle-outline", tint: colors.peach },
  { key: "Health", emoji: "💊", icon: "medkit-outline", tint: colors.mint },
  { key: "Entertainment", emoji: "🎮", icon: "game-controller-outline", tint: colors.sky },
  { key: "Loan / Debt", emoji: "🏦", icon: "cash-outline", tint: "#FEE2E2" },
  { key: "Investment", emoji: "📈", icon: "trending-up-outline", tint: "#DCFCE7" },
  { key: "Other", emoji: "✨", icon: "sparkles-outline", tint: colors.lemon },
];

export interface AccountTemplate {
  name: string;
  type: AccountType;
  emoji: string;
  color: string;
  category: "bank_ewallet" | "credit_card" | "fd" | "loan";
  defaultRate?: number; // e.g. FD APY or Loan Interest
  defaultLimit?: number; // e.g. Credit card limit
}

export const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  // 1. eWallets & Banks
  { name: "Touch n Go eWallet", type: "ewallet", emoji: "🚗", color: "#0066B3", category: "bank_ewallet" },
  { name: "MAE / Maybank", type: "bank", emoji: "🐯", color: "#F5B02A", category: "bank_ewallet" },
  { name: "CIMB Bank", type: "bank", emoji: "🏦", color: "#C8102E", category: "bank_ewallet" },
  { name: "Public Bank", type: "bank", emoji: "🏦", color: "#D50000", category: "bank_ewallet" },
  { name: "GXBank", type: "bank", emoji: "💚", color: "#00A651", category: "bank_ewallet" },
  { name: "RHB Bank", type: "bank", emoji: "🏦", color: "#005EB8", category: "bank_ewallet" },
  { name: "GrabPay", type: "ewallet", emoji: "🟢", color: "#00B14F", category: "bank_ewallet" },
  { name: "Boost eWallet", type: "ewallet", emoji: "🚀", color: "#EE2E24", category: "bank_ewallet" },
  { name: "Cash Wallet", type: "cash", emoji: "💵", color: "#10B981", category: "bank_ewallet" },

  // 2. Credit Cards 💳
  { name: "Maybank 2 Gold/Platinum Cards", type: "credit_card", emoji: "💳", color: "#F5B02A", category: "credit_card", defaultLimit: 8000 },
  { name: "CIMB Cash Rebate Platinum", type: "credit_card", emoji: "💳", color: "#C8102E", category: "credit_card", defaultLimit: 6000 },
  { name: "Public Bank Quantum Visa/Master", type: "credit_card", emoji: "💳", color: "#D50000", category: "credit_card", defaultLimit: 5000 },
  { name: "HSBC Platinum Credit Card", type: "credit_card", emoji: "💳", color: "#DB0011", category: "credit_card", defaultLimit: 10000 },
  { name: "Standard Chartered Simply Cash", type: "credit_card", emoji: "💳", color: "#00857C", category: "credit_card", defaultLimit: 8000 },
  { name: "UOB ONE Card", type: "credit_card", emoji: "💳", color: "#0B2341", category: "credit_card", defaultLimit: 7000 },
  { name: "GrabPay Mastercard", type: "credit_card", emoji: "💳", color: "#00B14F", category: "credit_card", defaultLimit: 3000 },

  // 3. Fixed Deposit (FD) & Stash 📈
  { name: "Maybank Fixed Deposit", type: "fd", emoji: "📈", color: "#F5B02A", category: "fd", defaultRate: 3.85 },
  { name: "Public Bank FD", type: "fd", emoji: "📈", color: "#D50000", category: "fd", defaultRate: 3.9 },
  { name: "GXBank Savings Pocket", type: "fd", emoji: "💚", color: "#00A651", category: "fd", defaultRate: 3.0 },
  { name: "Versa Cash / Save", type: "fd", emoji: "💰", color: "#6366F1", category: "fd", defaultRate: 3.75 },
  { name: "KDI Save", type: "fd", emoji: "🪙", color: "#3B82F6", category: "fd", defaultRate: 3.8 },
  { name: "ASB / Amanah Saham", type: "investment", emoji: "🏛️", color: "#1E3A8A", category: "fd", defaultRate: 5.25 },

  // 4. Loans & Liabilities 🏦
  { name: "Car Loan (Hire Purchase)", type: "loan", emoji: "🚘", color: "#EF4444", category: "loan", defaultRate: 3.2 },
  { name: "Housing Mortgage Loan", type: "loan", emoji: "🏡", color: "#DC2626", category: "loan", defaultRate: 4.4 },
  { name: "PTPTN Education Loan", type: "loan", emoji: "🎓", color: "#B91C1C", category: "loan", defaultRate: 1.0 },
  { name: "Personal Bank Loan", type: "loan", emoji: "🧾", color: "#991B1B", category: "loan", defaultRate: 7.5 },
];

export function categoryMeta(key?: string | null) {
  return CATEGORIES.find((c) => c.key === (key as CategoryKey)) ?? CATEGORIES[CATEGORIES.length - 1];
}

/**
 * Returns backend URL automatically resolving local network IP for physical mobile devices
 */
export function getBackendUrl(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, "");
  }

  // Dynamic host extraction from Expo Dev Server (Local testing on Expo Go)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:8000`;
    }
  }

  // Live production backend URL on Render
  return "https://dough-time.onrender.com";
}
