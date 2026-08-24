import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { getBudgetSettings, getTransactions, getWageSettings } from "@/src/store";
import { BudgetSettings, Transaction, WageSettings } from "@/src/types";
import { categoryMeta, getBackendUrl } from "@/src/constants";
import {
  amountToWorkHours,
  formatMonthDisplay,
  formatTimeCost,
  getBobaReaction,
  monthKey,
  rm,
  todayISO,
} from "@/src/format";

const PIE_PALETTE = [
  "#EC4899", "#D8B4FE", "#34D399", "#F59E0B", "#F87171",
  "#60A5FA", "#FB7185", "#A7F3D0", "#FDE68A", "#DDD6FE",
  "#F472B6", "#86EFAC",
];

import { AnimatedMascot } from "@/src/components/AnimatedMascot";
import { CuteAppBackground } from "@/src/components/CuteAppBackground";

export default function Insights() {
  const insets = useSafeAreaInsets();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [budget, setBudget] = useState<BudgetSettings>({
    monthlyOverallLimit: 2000,
    enabled: true,
    categoryBudgets: [
      { category: "Makan", monthlyLimit: 600 },
      { category: "Groceries", monthlyLimit: 400 },
      { category: "Petrol", monthlyLimit: 250 },
      { category: "Shopping", monthlyLimit: 300 },
    ],
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKey(todayISO()));
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<{ summary: string; tips: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, w, b] = await Promise.all([getTransactions(), getWageSettings(), getBudgetSettings()]);
    setTxns(t);
    setWage(w);
    setBudget(b);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Available unique months sorted descending
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(monthKey(todayISO()));
    txns.forEach((t) => {
      if (t.date) set.add(monthKey(t.date));
    });
    return Array.from(set).sort().reverse();
  }, [txns]);

  const currentMonthIdx = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedMonth === "all") {
      setSelectedMonth(availableMonths[0] || monthKey(todayISO()));
    } else if (currentMonthIdx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentMonthIdx + 1]);
    }
  };

  const handleNextMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    if (selectedMonth === "all") return;
    if (currentMonthIdx > 0) {
      setSelectedMonth(availableMonths[currentMonthIdx - 1]);
    }
  };

  const monthTxns = useMemo(
    () => txns.filter((t) => (selectedMonth === "all" || monthKey(t.date) === selectedMonth) && t.amount > 0),
    [txns, selectedMonth]
  );

  const expenseTxns = useMemo(
    () => monthTxns.filter((t) => t.type !== "income"),
    [monthTxns]
  );

  const incomeTxns = useMemo(
    () => monthTxns.filter((t) => t.type === "income"),
    [monthTxns]
  );

  const totalIncome = useMemo(
    () => incomeTxns.reduce((s, t) => s + t.amount, 0),
    [incomeTxns]
  );

  const totalIncomeHours = amountToWorkHours(totalIncome, wage.hourlyRate);

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of expenseTxns) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTxns]);

  const total = byCat.reduce((s, x) => s + x.value, 0);
  const totalWorkHours = amountToWorkHours(total, wage.hourlyRate);
  const bobaReaction = getBobaReaction(totalWorkHours);

  const pieData = byCat.map((c, i) => ({
    value: c.value,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
    text: `${Math.round((c.value / (total || 1)) * 100)}%`,
  }));

  const fetchInsights = useCallback(async () => {
    if (expenseTxns.length === 0) {
      setInsight({
        summary: `No expenses logged for ${formatMonthDisplay(selectedMonth)}. Log a few transactions and DoughTime will calculate your life energy score! 🥟⏳`,
        tips: ["Set a monthly work-hours spending ceiling.", "Track daily kopi & snacks to avoid life-time leaks."],
      });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const backendUrl = getBackendUrl();
      const url = `${backendUrl}/api/insights`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: expenseTxns.slice(0, 100),
          currency: "RM",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInsight({ summary: data.summary, tips: data.tips || [] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      setError(e?.message || "Failed to reach backend server");
    } finally {
      setLoading(false);
    }
  }, [expenseTxns, selectedMonth]);

  useEffect(() => {
    fetchInsights();
  }, [selectedMonth, txns.length]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: Platform.OS === "web" ? Math.max(insets.top, 14) : 0 },
      ]}
      edges={["top"]}
    >
      <CuteAppBackground />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: spacing.sm }}>
          <Text style={styles.title}>Spending Vibes & Budget</Text>
          <Text style={styles.subtitle}>
            {formatMonthDisplay(selectedMonth)} · Spent {rm(total)} ({totalWorkHours.toFixed(1)}h)
          </Text>
        </View>

        {/* Month Navigator Bar */}
        <View style={styles.monthNavRow}>
          <Pressable
            style={({ pressed }) => [styles.monthNavArrow, pressed && { opacity: 0.7 }]}
            onPress={handlePrevMonth}
            disabled={selectedMonth !== "all" && currentMonthIdx >= availableMonths.length - 1}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={selectedMonth !== "all" && currentMonthIdx >= availableMonths.length - 1 ? colors.borderStrong : colors.onSurface}
            />
          </Pressable>

          <Pressable
            style={styles.monthDisplayPill}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSelectedMonth(selectedMonth === "all" ? monthKey(todayISO()) : "all");
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={colors.brandPrimary} />
            <Text style={styles.monthDisplayText}>{formatMonthDisplay(selectedMonth)}</Text>
            <Ionicons name="swap-horizontal" size={12} color={colors.onSurfaceSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.monthNavArrow, pressed && { opacity: 0.7 }]}
            onPress={handleNextMonth}
            disabled={selectedMonth === "all" || currentMonthIdx <= 0}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={selectedMonth === "all" || currentMonthIdx <= 0 ? colors.borderStrong : colors.onSurface}
            />
          </Pressable>
        </View>

        {/* Income vs Expenses Summary Banner */}
        <View style={styles.incomeExpenseBanner}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.ieLabel}>💸 Total Spent</Text>
            <Text style={styles.ieExpenseVal}>{rm(total)}</Text>
            <Text style={styles.ieSub}>{totalWorkHours.toFixed(1)} hrs of work</Text>
          </View>
          <View style={styles.ieDivider} />
          <View style={{ flex: 1, gap: 2, alignItems: "flex-end" }}>
            <Text style={styles.ieLabel}>💰 Total Income</Text>
            <Text style={styles.ieIncomeVal}>+{rm(totalIncome)}</Text>
            <Text style={styles.ieSub}>+{totalIncomeHours.toFixed(1)} hrs freed 🌿</Text>
          </View>
        </View>

        {byCat.length === 0 ? (
          <View style={styles.emptyBox}>
            <Image
              source={require("@/assets/mascot_coin.jpg")}
              style={styles.emptyImg}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>No Expenses in {formatMonthDisplay(selectedMonth)}</Text>
            <Text style={styles.emptyText}>
              Log expenses to see your DoughTime spending personality and life energy score.
            </Text>
          </View>
        ) : (
          <>
            {/* Chart Card */}
            <View style={styles.chartCard}>
              <PieChart
                data={pieData}
                donut
                radius={85}
                innerRadius={55}
                innerCircleColor={colors.surfaceSecondary}
                centerLabelComponent={() => (
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.centerLabel}>{rm(total)}</Text>
                    <Text style={styles.centerSub}>{totalWorkHours.toFixed(1)} hrs</Text>
                  </View>
                )}
              />

              <View style={{ gap: 10, marginTop: spacing.lg, width: "100%" }}>
                {byCat.slice(0, 5).map((c, i) => {
                  const meta = categoryMeta(c.key);
                  const catHours = formatTimeCost(c.value, wage.hourlyRate);
                  return (
                    <View key={c.key} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }]} />
                      <Text style={styles.legendText}>{meta.emoji} {c.key}</Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.legendAmt}>{rm(c.value)}</Text>
                        <Text style={styles.legendHours}>⏱️ {catHours}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Category Budget Tracker Section */}
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>📊</Text>
                  <Text style={styles.cardTitle}>Category Budget Breakdown</Text>
                </View>
                <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary, fontSize: 11 }}>
                  Monthly Cap
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                {byCat.slice(0, 5).map((cat) => {
                  const catBudget = budget.categoryBudgets.find((b) => b.category === cat.key)?.monthlyLimit || 500;
                  const pct = Math.min(100, Math.round((cat.value / catBudget) * 100));
                  const meta = categoryMeta(cat.key);

                  return (
                    <View key={cat.key} style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "700", fontSize: 13, color: colors.onSurface }}>
                          {meta.emoji} {cat.key}
                        </Text>
                        <Text style={{ fontWeight: "600", fontSize: 12, color: colors.onSurfaceSecondary }}>
                          {rm(cat.value)} / {rm(catBudget)} ({pct}%)
                        </Text>
                      </View>
                      <View style={styles.catProgressBg}>
                        <View
                          style={[
                            styles.catProgressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: pct > 90 ? "#EF4444" : pct > 70 ? "#F59E0B" : colors.brandPrimary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* AI Coach with Adorable Dough Mascot */}
            <View style={[styles.card, { marginTop: spacing.md }]}>
              <View style={styles.coachHeader}>
                <View style={styles.coachTitleWrap}>
                  <AnimatedMascot variant="mentor" size={50} interactive={true} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>DoughTime AI Coach 🥟✨</Text>
                    <Text style={styles.coachRole} numberOfLines={1}>Financial & Life-Time Mentor</Text>
                  </View>
                </View>

                <Pressable
                  testID="refresh-insights-btn"
                  onPress={fetchInsights}
                  disabled={loading}
                  style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="refresh" size={13} color={colors.brandPrimary} />
                  <Text style={styles.link}>{loading ? "…" : "Refresh"}</Text>
                </Pressable>
              </View>

              {loading ? (
                <ActivityIndicator style={{ marginTop: 24, marginBottom: 12 }} color={colors.brandPrimary} />
              ) : error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>Couldn&apos;t reach the coach: {error}</Text>
                  <Pressable onPress={fetchInsights} style={styles.retryBtn}>
                    <Text style={styles.retryBtnText}>Retry Connection</Text>
                  </Pressable>
                </View>
              ) : insight ? (
                <>
                  <Text style={styles.insightSummary}>{insight.summary}</Text>
                  {insight.tips.map((t, i) => (
                    <View key={i} style={styles.tipRow}>
                      <View style={styles.tipDot} />
                      <Text style={styles.tipText}>{t}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Pressable testID="get-insights-btn" onPress={fetchInsights} style={styles.cta}>
                  <Text style={styles.ctaText}>Get insights</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  title: {
    fontWeight: "800",
    fontSize: 24,
    color: colors.onSurface,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginTop: 2,
    fontSize: 13,
  },
  chartCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  centerLabel: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  centerSub: {
    fontWeight: "700",
    color: colors.brandPrimary,
    fontSize: 11,
    marginTop: 1,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    flex: 1,
    fontWeight: "600",
    color: colors.onSurface,
    fontSize: 13,
  },
  legendAmt: {
    fontWeight: "700",
    color: colors.onSurface,
    fontSize: 13,
  },
  legendHours: {
    fontWeight: "600",
    color: colors.brandPrimary,
    fontSize: 11,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  catProgressBg: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  catProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  coachHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  coachTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  coachAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.pink,
  },
  cardTitle: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  coachRole: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  link: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  insightSummary: {
    fontWeight: "500",
    color: colors.onSurface,
    marginTop: spacing.md,
    lineHeight: 20,
    fontSize: 13,
  },
  tipRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPrimary,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontWeight: "400",
    color: colors.onSurface,
    lineHeight: 19,
    fontSize: 13,
  },
  cta: {
    backgroundColor: colors.brandPrimary,
    padding: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: 12,
  },
  ctaText: {
    color: colors.onBrandPrimary,
    fontWeight: "700",
  },
  errorBox: {
    marginTop: 14,
    alignItems: "center",
  },
  errorText: {
    color: colors.error,
    fontWeight: "600",
    textAlign: "center",
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: 10,
  },
  retryBtnText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthNavArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  monthDisplayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  monthDisplayText: {
    fontWeight: "800",
    fontSize: 13,
    color: colors.onSurface,
  },
  incomeExpenseBanner: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.card,
  },
  ieLabel: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
  },
  ieExpenseVal: {
    fontWeight: "900",
    fontSize: 18,
    color: colors.onSurface,
  },
  ieIncomeVal: {
    fontWeight: "900",
    fontSize: 18,
    color: "#059669",
  },
  ieSub: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  ieDivider: {
    width: 1,
    backgroundColor: colors.borderStrong,
    marginHorizontal: spacing.md,
  },
  emptyBox: {
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyImg: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 4,
  },
  emptyText: {
    fontWeight: "500",
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 13,
  },
});
