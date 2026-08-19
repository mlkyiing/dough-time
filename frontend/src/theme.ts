import { Platform } from "react-native";

export const colors = {
  surface: "#F8FAFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#64748B",
  surfaceTertiary: "#FDF2F8",
  onSurfaceTertiary: "#0F172A",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#FFFFFF",
  brand: "#F472B6",
  brandPrimary: "#EC4899",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#D8B4FE",
  onBrandSecondary: "#1E293B",
  brandTertiary: "#34D399",
  onBrandTertiary: "#064E3B",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#F1F5F9",
  borderStrong: "#E2E8F0",
  divider: "#F1F5F9",
  // pastel category tints
  mint: "#DCFCE7",
  pink: "#FCE7F3",
  lavender: "#EDE9FE",
  peach: "#FFE4E6",
  lemon: "#FEF3C7",
  sky: "#E0F2FE",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 28,
  pill: 999,
};

export const font = {
  regular: Platform.select({
    web: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Rounded', 'Nunito', sans-serif",
    ios: "System",
    default: "Nunito_400Regular",
  }),
  medium: Platform.select({
    web: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Rounded', 'Nunito', sans-serif",
    ios: "System",
    default: "Nunito_600SemiBold",
  }),
  bold: Platform.select({
    web: "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Text', 'Nunito', sans-serif",
    ios: "System",
    default: "Nunito_700Bold",
  }),
  black: Platform.select({
    web: "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', 'Nunito', sans-serif",
    ios: "System",
    default: "Nunito_800ExtraBold",
  }),
};

export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  glow: {
    shadowColor: "#EC4899",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
};
