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
import { getTransactions, getWageSettings } from "@/src/store";
import { Transaction, WageSettings } from "@/src/types";
import { CATEGORIES, categoryMeta, getBackendUrl } from "@/src/constants";
import {
  amountToWorkHours,
  formatTimeCost,
  getBobaReaction,
  monthKey,
  rm,
  todayISO,
} from "@/src/format";

const PIE_PALETTE = [
  "#F472B6", "#D8B4FE", "#6EE7B7", "#FBBF24", "#FB7185",
  "#93C5FD", "#FCA5A5", "#A7F3D0", "#FDE68A", "#DDD6FE",
  "#F9A8D4", "#86EFAC",
];

export default function Insights() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<{ summary: string; tips: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, w] = await Promise.all([getTransactions(), getWageSettings()]);
    setTxns(t);
    setWage(w);
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
        summary: "No expenses logged this month yet. Log a few transactions and Boba Hourglass will calculate your life energy score! 🧋",
        tips: ["Set a monthly work-hours spending ceiling.", "Track daily kopi & snacks to avoid time-leaks."],
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Spending Vibes & Time</Text>
        <Text style={styles.subtitle}>
          This month · {rm(total)} ({totalWorkHours.toFixed(1)} hrs of work)
        </Text>

        {byCat.length === 0 ? (
          <View style={styles.emptyBox}>
            <Image
              source={require("@/assets/mascot.jpg")}
              style={styles.emptyImg}
              contentFit="cover"
            />
            <Text style={styles.emptyText}>
              Log expenses to see your DoughTime spending personality! 🧋⌛
            </Text>
          </View>
        ) : (
          <>
            {/* Chart Card */}
            <View style={styles.chartCard}>
              <PieChart
                data={pieData}
                donut
                radius={90}
                innerRadius={55}
                innerCircleColor={colors.surfaceSecondary}
                centerLabelComponent={() => (
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.centerLabel}>{rm(total)}</Text>
                    <Text style={styles.centerSub}>{totalWorkHours.toFixed(1)} hrs</Text>
                  </View>
                )}
              />

              <View style={{ gap: 8, marginTop: spacing.lg, width: "100%" }}>
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

            {/* AI Coach with Boba Mascot Avatar */}
            <View style={styles.card}>
              <View style={styles.coachHeader}>
                <View style={styles.coachTitleWrap}>
                  <Image
                    source={require("@/assets/mascot.jpg")}
                    style={styles.coachAvatar}
                    contentFit="cover"
                  />
                  <View>
                    <Text style={styles.cardTitle}>Boba Coach AI 🧋</Text>
                    <Text style={styles.coachRole}>Financial & Time Mentor</Text>
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
                <ActivityIndicator style={{ marginTop: 20 }} color={colors.brandPrimary} />
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
  container: { flex: 1, backgroundColor: colors.surface },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: colors.onSurface },
  subtitle: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, marginTop: 2, marginBottom: spacing.lg },
  chartCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  centerLabel: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: colors.onSurface },
  centerSub: { fontFamily: "Nunito_700Bold", color: colors.brandPrimary, fontSize: 11, marginTop: 1 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontFamily: "Nunito_600SemiBold", color: colors.onSurface, fontSize: 14 },
  legendAmt: { fontFamily: "Nunito_700Bold", color: colors.onSurface, fontSize: 14 },
  legendHours: { fontFamily: "Nunito_600SemiBold", color: colors.brandPrimary, fontSize: 11 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  coachHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coachTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  coachAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.brandPrimary },
  cardTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: colors.onSurface },
  coachRole: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: colors.onSurfaceSecondary },
  refreshBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  link: { color: colors.brandPrimary, fontFamily: "Nunito_700Bold", fontSize: 12 },
  insightSummary: {
    fontFamily: "Nunito_600SemiBold",
    color: colors.onSurface,
    marginTop: spacing.md,
    lineHeight: 20,
    fontSize: 14,
  },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 7 },
  tipText: { flex: 1, fontFamily: "Nunito_400Regular", color: colors.onSurface, lineHeight: 20, fontSize: 13 },
  cta: { backgroundColor: colors.brandPrimary, padding: 12, borderRadius: radius.pill, alignItems: "center", marginTop: 12 },
  ctaText: { color: colors.onBrandPrimary, fontFamily: "Nunito_700Bold" },
  errorBox: { marginTop: 14, alignItems: "center" },
  errorText: { color: colors.error, fontFamily: "Nunito_600SemiBold", textAlign: "center", fontSize: 13 },
  retryBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: 10,
  },
  retryBtnText: { color: colors.brandPrimary, fontFamily: "Nunito_700Bold", fontSize: 12 },
  emptyBox: { alignItems: "center", padding: spacing.xxl },
  emptyImg: { width: 140, height: 140, borderRadius: 70, marginBottom: 16 },
  emptyText: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, textAlign: "center", lineHeight: 20 },
});
