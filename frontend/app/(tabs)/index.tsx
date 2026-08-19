import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import {
  calculateHourlyRate,
  getAccounts,
  getTransactions,
  getWageSettings,
  seedIfNeeded,
  setWageSettings,
} from "@/src/store";
import { Account, Transaction, WageSettings } from "@/src/types";
import { categoryMeta } from "@/src/constants";
import {
  amountToWorkHours,
  formatTimeCost,
  getBobaReaction,
  monthKey,
  rm,
  shortDate,
  todayISO,
} from "@/src/format";

export default function HomeDashboard() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [viewMode, setViewMode] = useState<"money" | "time">("money");
  const [refreshing, setRefreshing] = useState(false);
  const [wageModalOpen, setWageModalOpen] = useState(false);
  const [tempSalary, setTempSalary] = useState("4500");
  const [tempHours, setTempHours] = useState("40");

  const loadData = useCallback(async () => {
    await seedIfNeeded();
    const [accs, txns, w] = await Promise.all([
      getAccounts(),
      getTransactions(),
      getWageSettings(),
    ]);
    setAccounts(accs);
    setTransactions(txns);
    setWage(w);
    setTempSalary(String(w.monthlySalary));
    setTempHours(String(w.hoursPerWeek));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSaveWage = async () => {
    const salary = parseFloat(tempSalary) || 0;
    const hrs = parseFloat(tempHours) || 40;
    const rate = calculateHourlyRate(salary, hrs);
    const updated: WageSettings = {
      ...wage,
      monthlySalary: salary,
      hoursPerWeek: hrs,
      hourlyRate: rate,
    };
    await setWageSettings(updated);
    setWage(updated);
    setWageModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const thisMonth = monthKey(todayISO());
  const monthSpending = transactions
    .filter((t) => monthKey(t.date) === thisMonth && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthWorkHours = amountToWorkHours(monthSpending, wage.hourlyRate);
  const totalBalanceHours = amountToWorkHours(totalBalance, wage.hourlyRate);
  const bobaReaction = getBobaReaction(monthWorkHours);

  const recentTxns = transactions.slice(0, 5);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brandPrimary} />
        }
      >
        {/* Header with Boba Hourglass Mascot */}
        <View style={styles.headerRow}>
          <View style={styles.brandTitleWrap}>
            <Image
              source={require("@/assets/mascot.jpg")}
              style={styles.mascotThumb}
              contentFit="cover"
            />
            <View>
              <Text style={styles.greetingText}>Selamat Datang 🇲🇾</Text>
              <Text style={styles.appTitle}>DoughTime ⏳</Text>
            </View>
          </View>
          <Pressable
            testID="scan-ocr-btn"
            style={styles.scanBtn}
            onPress={() => router.push("/scan")}
          >
            <Ionicons name="scan-outline" size={20} color={colors.onBrandPrimary} />
            <Text style={styles.scanBtnText}>Scan</Text>
          </Pressable>
        </View>

        {/* Wage Rate Pill / Setting Button */}
        <Pressable
          style={styles.wagePill}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setWageModalOpen(true);
          }}
        >
          <View style={styles.wagePillLeft}>
            <Text style={styles.wagePillEmoji}>⚡</Text>
            <View>
              <Text style={styles.wagePillLabel}>Your Hourly Work Worth</Text>
              <Text style={styles.wagePillValue}>
                RM {wage.hourlyRate.toFixed(2)}/hr ({wage.hoursPerWeek}h/wk)
              </Text>
            </View>
          </View>
          <View style={styles.wagePillEdit}>
            <Text style={styles.wagePillEditText}>Edit</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.brandPrimary} />
          </View>
        </Pressable>

        {/* Hero Card with Currency <-> Work Time Toggle */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroLabel}>
              {viewMode === "money" ? "Total Net Worth" : "Total Life Worth (Work Time)"}
            </Text>
            {/* Toggle Pill */}
            <View style={styles.toggleWrap}>
              <Pressable
                style={[styles.toggleBtn, viewMode === "money" && styles.toggleBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode("money");
                }}
              >
                <Text
                  style={[styles.toggleText, viewMode === "money" && styles.toggleTextActive]}
                >
                  RM
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, viewMode === "time" && styles.toggleBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode("time");
                }}
              >
                <Text
                  style={[styles.toggleText, viewMode === "time" && styles.toggleTextActive]}
                >
                  ⏱️ Time
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.heroBalance}>
            {viewMode === "money"
              ? rm(totalBalance)
              : `${totalBalanceHours.toFixed(1)} hrs`}
          </Text>
          {viewMode === "time" && (
            <Text style={styles.heroSubWorkday}>
              ≈ {(totalBalanceHours / 8).toFixed(1)} workdays earned
            </Text>
          )}

          <View style={styles.heroDivider} />

          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroSubLabel}>Spent This Month</Text>
              <Text style={styles.heroSubValue}>
                {viewMode === "money"
                  ? rm(monthSpending)
                  : `${formatTimeCost(monthSpending, wage.hourlyRate)} of work`}
              </Text>
            </View>
            <Pressable
              style={styles.addQuickBtn}
              onPress={() => router.push("/quick-add")}
            >
              <Ionicons name="add" size={18} color={colors.brandPrimary} />
              <Text style={styles.addQuickBtnText}>Quick Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Boba Mascot Life Energy Reaction Card */}
        <View style={styles.reactionCard}>
          <View style={styles.reactionRow}>
            <View style={[styles.reactionBadge, { backgroundColor: bobaReaction.color + "20" }]}>
              <Text style={{ fontSize: 28 }}>{bobaReaction.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reactionTitle}>{bobaReaction.title}</Text>
              <Text style={styles.reactionDesc}>
                This month you traded <Text style={styles.boldText}>{monthWorkHours.toFixed(1)} hours</Text> of your work ({rm(monthSpending)}) for lifestyle expenses.
              </Text>
            </View>
          </View>
        </View>

        {/* Accounts horizontal scroll */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Accounts</Text>
          <Pressable onPress={() => router.push("/(tabs)/accounts")}>
            <Text style={styles.seeAllText}>Manage</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.md }}
          style={{ marginBottom: spacing.xl }}
        >
          {accounts.map((acc) => (
            <View key={acc.id} style={[styles.accountPill, { borderLeftColor: acc.color }]}>
              <Text style={{ fontSize: 24 }}>{acc.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountPillName}>{acc.name}</Text>
                <Text style={styles.accountPillBalance}>
                  {viewMode === "money"
                    ? rm(acc.balance)
                    : `${(acc.balance / (wage.hourlyRate || 25)).toFixed(1)}h`}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Recent Transactions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={styles.seeAllText}>View All</Text>
          </Pressable>
        </View>

        {recentTxns.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent transactions. Tap + to add!</Text>
          </View>
        ) : (
          recentTxns.map((t) => {
            const meta = categoryMeta(t.category);
            const acc = accounts.find((a) => a.id === t.accountId);
            const timeCost = formatTimeCost(t.amount, wage.hourlyRate);

            return (
              <View key={t.id} style={styles.txnRow}>
                <View style={[styles.txnIcon, { backgroundColor: meta.tint }]}>
                  <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>{t.merchant || t.category}</Text>
                  <Text style={styles.txnSub}>
                    {shortDate(t.date)} · {acc?.name || "—"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.txnAmount}>{rm(t.amount)}</Text>
                  <View style={styles.timeCostTag}>
                    <Text style={styles.timeCostText}>⏱️ {timeCost}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Wage Settings Modal */}
      <Modal
        visible={wageModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 24 }}>⏱️</Text>
                <Text style={styles.modalTitle}>Set Your Work Wage</Text>
              </View>
              <Pressable onPress={() => setWageModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              DoughTime turns prices into hours of your life energy so you can make mindful spending choices.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monthly Take-Home Salary (RM)</Text>
              <TextInput
                value={tempSalary}
                onChangeText={setTempSalary}
                keyboardType="numeric"
                style={styles.modalInput}
                placeholder="e.g. 4500"
                placeholderTextColor={colors.onSurfaceSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Working Hours Per Week</Text>
              <TextInput
                value={tempHours}
                onChangeText={setTempHours}
                keyboardType="numeric"
                style={styles.modalInput}
                placeholder="e.g. 40"
                placeholderTextColor={colors.onSurfaceSecondary}
              />
            </View>

            {/* Calculated Rate Preview */}
            <View style={styles.calcPreviewBox}>
              <Text style={styles.calcPreviewLabel}>Calculated Hourly Value:</Text>
              <Text style={styles.calcPreviewVal}>
                RM {calculateHourlyRate(parseFloat(tempSalary) || 0, parseFloat(tempHours) || 40).toFixed(2)} / hour
              </Text>
            </View>

            <Pressable style={styles.saveWageBtn} onPress={handleSaveWage}>
              <Text style={styles.saveWageBtnText}>Save Hourly Rate</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  brandTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mascotThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
  },
  greetingText: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, fontSize: 13 },
  appTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: colors.onSurface },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  scanBtnText: { color: colors.onBrandPrimary, fontFamily: "Nunito_700Bold", fontSize: 14 },
  wagePill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  wagePillLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  wagePillEmoji: { fontSize: 20 },
  wagePillLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: colors.onSurfaceSecondary },
  wagePillValue: { fontFamily: "Nunito_700Bold", fontSize: 14, color: colors.brandPrimary, marginTop: 1 },
  wagePillEdit: { flexDirection: "row", alignItems: "center", gap: 2 },
  wagePillEditText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: colors.brandPrimary },
  heroCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, fontSize: 13 },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  toggleBtnActive: {
    backgroundColor: colors.brandPrimary,
  },
  toggleText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  toggleTextActive: {
    color: colors.onBrandPrimary,
  },
  heroBalance: { fontFamily: "Nunito_800ExtraBold", fontSize: 32, color: colors.onSurface, marginTop: 6 },
  heroSubWorkday: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: colors.brandPrimary, marginTop: 2 },
  heroDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroSubLabel: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, fontSize: 11 },
  heroSubValue: { fontFamily: "Nunito_700Bold", color: colors.brandPrimary, fontSize: 16, marginTop: 2 },
  addQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  addQuickBtnText: { color: colors.brandPrimary, fontFamily: "Nunito_700Bold", fontSize: 13 },
  reactionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  reactionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  reactionBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 14, color: colors.onSurface },
  reactionDesc: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 2, lineHeight: 17 },
  boldText: { fontFamily: "Nunito_700Bold", color: colors.brandPrimary },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: colors.onSurface },
  seeAllText: { fontFamily: "Nunito_700Bold", color: colors.brandPrimary, fontSize: 13 },
  accountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minWidth: 160,
    borderLeftWidth: 4,
    ...shadow.soft,
  },
  accountPillName: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: colors.onSurfaceSecondary },
  accountPillBalance: { fontFamily: "Nunito_800ExtraBold", fontSize: 14, color: colors.onSurface, marginTop: 2 },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  txnIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  txnTitle: { fontFamily: "Nunito_700Bold", color: colors.onSurface, fontSize: 15 },
  txnSub: { fontFamily: "Nunito_400Regular", color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  txnAmount: { fontFamily: "Nunito_800ExtraBold", color: colors.onSurface, fontSize: 15 },
  timeCostTag: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 3,
  },
  timeCostText: { fontFamily: "Nunito_700Bold", fontSize: 10, color: colors.brandPrimary },
  emptyContainer: { padding: spacing.xl, alignItems: "center" },
  emptyText: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: colors.onSurface },
  modalSubtitle: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginTop: 8,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { fontFamily: "Nunito_700Bold", fontSize: 12, color: colors.onSurface, marginBottom: 6 },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: colors.onSurface,
  },
  calcPreviewBox: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginVertical: spacing.md,
  },
  calcPreviewLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: colors.onSurfaceSecondary },
  calcPreviewVal: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: colors.brandPrimary, marginTop: 4 },
  saveWageBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.soft,
  },
  saveWageBtnText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 15,
    color: colors.onBrandPrimary,
  },
});
