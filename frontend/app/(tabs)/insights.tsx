import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PieChart } from "react-native-gifted-charts";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { getBudgetSettings, getTransactions, getWageSettings } from "@/src/store";
import { BudgetSettings, Transaction, WageSettings } from "@/src/types";
import { categoryMeta, getBackendUrl } from "@/src/constants";
import {
  amountToWorkHours,
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

export default function Insights() {
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

  const thisMonth = monthKey(todayISO());
  const monthTxns = useMemo(
    () => txns.filter((t) => monthKey(t.date) === thisMonth && t.amount > 0),
    [txns, thisMonth]
  );

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxns) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [monthTxns]);

  const total = byCat.reduce((s, x) => s + x.value, 0);
  const totalWorkHours = amountToWorkHours(total, wage.hourlyRate);
  const bobaReaction = getBobaReaction(totalWorkHours);

  const pieData = byCat.map((c, i) => ({
    value: c.value,
    color: PIE_PALETTE[i % PIE_PALETTE.length],
    text: `${Math.round((c.value / (total || 1)) * 100)}%`,
  }));

  const fetchInsights = useCallback(async () => {
    if (monthTxns.length === 0) {
      setInsight({
        summary: "No expenses logged this month yet. Log a few transactions and DoughTime will calculate your life energy score! 🥟⏳",
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
          transactions: monthTxns.slice(0, 100),
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
  }, [monthTxns]);

  useEffect(() => {
    if (txns.length && !insight && !loading) fetchInsights();
  }, [txns.length]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.title}>Spending Vibes & Budget</Text>
          <Text style={styles.subtitle}>
            This month · {rm(total)} ({totalWorkHours.toFixed(1)} hrs of work)
          </Text>
        </View>

        {byCat.length === 0 ? (
          <View style={styles.emptyBox}>
            <Image
              source={require("@/assets/mascot_coin.jpg")}
              style={styles.emptyImg}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>Your Mascot is Waiting!</Text>
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
                  <AnimatedMascot variant="mentor" size={54} interactive={true} />
                  <View>
                    <Text style={styles.cardTitle}>DoughTime AI Coach 🥟✨</Text>
                    <Text style={styles.coachRole}>Financial & Life-Time Mentor (Tap for advice)</Text>
                  </View>
                </View>

                <Pressable
                  testID="refresh-insights-btn"
                  onPress={fetchInsights}
                  disabled={loading}
                  style={styles.refreshBtn}
                >
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
  container: { flex: 1, backgroundColor: "transparent" },
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
  },
  coachTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  },
  coachRole: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  refreshBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
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
