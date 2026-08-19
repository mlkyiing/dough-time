import Constants from "expo-constants";
import { colors } from "./theme";

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
  { key: "Other", emoji: "✨", icon: "sparkles-outline", tint: colors.lemon },
];

export type AccountType = "ewallet" | "bank" | "cash";

export const ACCOUNT_TEMPLATES: {
  name: string;
  type: AccountType;
  emoji: string;
  color: string;
}[] = [
  { name: "Touch n Go eWallet", type: "ewallet", emoji: "🚗", color: "#0066B3" },
  { name: "GrabPay", type: "ewallet", emoji: "🟢", color: "#00B14F" },
  { name: "Boost", type: "ewallet", emoji: "🚀", color: "#EE2E24" },
  { name: "MAE", type: "bank", emoji: "🐯", color: "#F5B02A" },
  { name: "Maybank", type: "bank", emoji: "🐯", color: "#F5B02A" },
  { name: "CIMB", type: "bank", emoji: "🏦", color: "#C8102E" },
  { name: "Public Bank", type: "bank", emoji: "🏦", color: "#D50000" },
  { name: "RHB", type: "bank", emoji: "🏦", color: "#005EB8" },
  { name: "HSBC", type: "bank", emoji: "🏦", color: "#DB0011" },
  { name: "GXBank", type: "bank", emoji: "💚", color: "#00A651" },
  { name: "AEON Bank", type: "bank", emoji: "🌸", color: "#C4007A" },
  { name: "Boost Bank", type: "bank", emoji: "🚀", color: "#EE2E24" },
  { name: "DuitNow QR", type: "ewallet", emoji: "🇲🇾", color: "#0033A0" },
  { name: "Cash", type: "cash", emoji: "💵", color: "#34D399" },
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
