import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import {
  calculateHourlyRate,
  deleteTransaction,
  getAccounts,
  getBudgetSettings,
  getTransactions,
  getWageSettings,
  initOrGetSyncSession,
  mergeWithCloud,
  seedIfNeeded,
  setBudgetSettings,
  setWageSettings,
  subscribeSyncStatus,
  updateTransaction,
} from "@/src/store";
import { Account, BudgetSettings, isAssetAccount, isLiabilityAccount, SyncSession, SyncStatus, Transaction, WageSettings } from "@/src/types";
import {
  amountToWorkHours,
  formatTimeCost,
  getBobaReaction,
  monthKey,
  rm,
  todayISO,
} from "@/src/format";
import { SwipeableTxnRow } from "@/src/components/SwipeableTxnRow";
import { TransactionDetailModal } from "@/src/components/TransactionDetailModal";
import { AnimatedMascot } from "@/src/components/AnimatedMascot";
import { CloudSyncModal } from "@/src/components/CloudSyncModal";
import { SmartBudgetModal } from "@/src/components/SmartBudgetModal";
import { CuteAppBackground } from "@/src/components/CuteAppBackground";
import { calculateBucketSpending } from "@/src/utils/budgetAnalyzer";

export default function HomeDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
    categoryBudgets: [],
  });
  const [viewMode, setViewMode] = useState<"money" | "time">("money");
  const [refreshing, setRefreshing] = useState(false);
  const [wageModalOpen, setWageModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncSession, setSyncSession] = useState<SyncSession | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [tempSalary, setTempSalary] = useState("4500");
  const [tempHours, setTempHours] = useState("40");
  const [tempBudgetLimit, setTempBudgetLimit] = useState("2000");

  const loadData = useCallback(async () => {
    await seedIfNeeded();
    const [accs, txns, w, b, sess] = await Promise.all([
      getAccounts(),
      getTransactions(),
      getWageSettings(),
      getBudgetSettings(),
      initOrGetSyncSession(),
    ]);
    setAccounts(accs);
    setTransactions(txns);
    setWage(w);
    setBudget(b);
    setSyncSession(sess);
    setTempSalary(String(w.monthlySalary));
    setTempHours(String(w.hoursPerWeek));
    setTempBudgetLimit(String(b.monthlyOverallLimit));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      mergeWithCloud().then(() => loadData()).catch(() => {});
      const unsub = subscribeSyncStatus((st, sess) => {
        setSyncStatus(st);
        if (sess) setSyncSession(sess);
      });
      return () => unsub();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await mergeWithCloud().catch(() => {});
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

  const handleSaveBudget = async (updated: BudgetSettings) => {
    await setBudgetSettings(updated);
    setBudget(updated);
    setBudgetModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleDeleteTxn = (id: string) => {
    const doDelete = async () => {
      await deleteTransaction(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (selectedTxn?.id === id) setSelectedTxn(null);
      await loadData();
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm("Delete this transaction from your history?") : true;
      if (ok) {
        doDelete();
      }
      return;
    }

    Alert.alert("Delete transaction?", "This will remove this record from your history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: doDelete,
      },
    ]);
  };

  const handleUpdateTxn = async (updated: Transaction) => {
    await updateTransaction(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelectedTxn(null);
    await loadData();
  };

  // True Net Worth = Total Assets - Total Liabilities
  const totalAssets = accounts.filter(isAssetAccount).reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(isLiabilityAccount).reduce((sum, a) => sum + a.balance, 0);
  const netWorth = totalAssets - totalLiabilities;

  const assetHours = amountToWorkHours(totalAssets, wage.hourlyRate);
  const liabilityHours = amountToWorkHours(totalLiabilities, wage.hourlyRate);
  const netWorthHours =
    netWorth >= 0
      ? amountToWorkHours(netWorth, wage.hourlyRate)
      : -amountToWorkHours(Math.abs(netWorth), wage.hourlyRate);

  const thisMonth = monthKey(todayISO());
  const monthSpending = transactions
    .filter((t) => monthKey(t.date) === thisMonth && t.type !== "income" && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const monthIncome = transactions
    .filter((t) => monthKey(t.date) === thisMonth && t.type === "income" && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthWorkHours = amountToWorkHours(monthSpending, wage.hourlyRate);
  const bobaReaction = getBobaReaction(monthWorkHours);

  // Budget calculations & Segregated Bucket Analysis
  const budgetLimit = budget.monthlyOverallLimit || 2000;
  const budgetWorkHours = amountToWorkHours(budgetLimit, wage.hourlyRate);
  const budgetUsedPct = Math.min(100, Math.round((monthSpending / (budgetLimit || 1)) * 100));
  const budgetRemaining = Math.max(0, budgetLimit - monthSpending);
  const budgetRemainingHours = amountToWorkHours(budgetRemaining, wage.hourlyRate);
  const isOverBudget = monthSpending > budgetLimit;

  // Segregated Must-Haves vs Guilt-Free Comfort / Nonsense Funds
  const bucketSpending = calculateBucketSpending(transactions, thisMonth);
  const needsLimit = budget.needsLimit || Math.round(budgetLimit * 0.65);
  const comfortLimit = budget.comfortLimit || Math.round(budgetLimit * 0.25);
  const needsUsedPct = Math.min(100, Math.round((bucketSpending.needsSpent / (needsLimit || 1)) * 100));
  const comfortUsedPct = Math.min(100, Math.round((bucketSpending.comfortSpent / (comfortLimit || 1)) * 100));
  const comfortRemaining = Math.max(0, comfortLimit - bucketSpending.comfortSpent);
  const comfortRemainingHours = amountToWorkHours(comfortRemaining, wage.hourlyRate);
  const isComfortOver = bucketSpending.comfortSpent > comfortLimit;

  const currentDay = new Date().getDate();
  const upcomingRepayments = accounts.filter((a) => {
    if (!a.reminderEnabled || !a.dueDay || !isLiabilityAccount(a)) return false;
    const diff = a.dueDay - currentDay;
    return diff >= 0 && diff <= (a.reminderDaysBefore || 3);
  });

  const recentTxns = transactions.slice(0, 6);

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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brandPrimary} />
        }
      >
        {/* Header with Kawaii Animated Mascot */}
        <View style={styles.headerRow}>
          <View style={styles.brandTitleWrap}>
            <AnimatedMascot variant="default" size={52} interactive={true} />
            <View>
              <Text style={styles.appTitle}>DoughTime</Text>
            </View>
          </View>
          <View style={styles.headerRightActions}>
            <Pressable
              testID="cloud-sync-btn"
              style={({ pressed }) => [styles.cloudSyncBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSyncModalOpen(true);
              }}
            >
              <Ionicons
                name={
                  syncStatus === "syncing"
                    ? "sync-outline"
                    : syncStatus === "offline"
                    ? "cloud-offline-outline"
                    : "cloud-done-outline"
                }
                size={18}
                color={syncStatus === "offline" ? colors.onSurfaceSecondary : colors.brandPrimary}
              />
              <View
                style={[
                  styles.syncBadgeDot,
                  {
                    backgroundColor:
                      syncStatus === "syncing"
                        ? "#F59E0B"
                        : syncStatus === "offline"
                        ? "#94A3B8"
                        : "#10B981",
                  },
                ]}
              />
            </Pressable>

            <Pressable
              testID="scan-ocr-btn"
              style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push("/scan");
              }}
            >
              <Ionicons name="scan-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.scanBtnText}>Scan</Text>
            </Pressable>
          </View>
        </View>

        {/* Wage Profile Banner */}
        <Pressable
          style={({ pressed }) => [styles.wagePill, pressed && { opacity: 0.92 }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setWageModalOpen(true);
          }}
        >
          <View style={styles.wagePillLeft}>
            <View style={styles.wageIconBadge}>
              <Text style={styles.wagePillEmoji}>⚡</Text>
            </View>
            <View style={{ gap: 1 }}>
              <Text style={styles.wagePillLabel}>Your Hourly Work Worth</Text>
              <Text style={styles.wagePillValue}>
                RM {wage.hourlyRate.toFixed(2)}/hr · {wage.hoursPerWeek}h/wk
              </Text>
            </View>
          </View>
          <View style={styles.wagePillEdit}>
            <Text style={styles.wagePillEditText}>Edit</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.brandPrimary} />
          </View>
        </Pressable>

        {/* Upcoming Loan / Car Repayment Notification Alert Banner */}
        {upcomingRepayments.map((rep) => (
          <Pressable
            key={rep.id}
            style={styles.repaymentAlert}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push("/(tabs)/accounts");
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 22 }}>{rep.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.repaymentAlertTitle}>
                  {rep.name} Due {rep.dueDay! - currentDay === 0 ? "Today" : `in ${rep.dueDay! - currentDay} days`}! 🔔
                </Text>
                <Text style={styles.repaymentAlertSub}>
                  Installment {rm(rep.monthlyInstallment || rep.balance)} · {amountToWorkHours(rep.monthlyInstallment || rep.balance, wage.hourlyRate).toFixed(1)}h work
                </Text>
              </View>
            </View>
            <View style={styles.repaymentAlertAction}>
              <Text style={styles.repaymentAlertActionText}>Review</Text>
            </View>
          </Pressable>
        ))}

        {/* Hero Card: Net Worth (Assets - Liabilities) */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroLabel}>
              {viewMode === "money" ? "Total Net Worth" : "Total Life Worth (Work Time)"}
            </Text>
            {/* iOS Segmented Toggle */}
            <View style={styles.toggleWrap}>
              <Pressable
                style={[styles.toggleBtn, viewMode === "money" && styles.toggleBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setViewMode("money");
                }}
              >
                <Text style={[styles.toggleText, viewMode === "money" && styles.toggleTextActive]}>
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
                <Text style={[styles.toggleText, viewMode === "time" && styles.toggleTextActive]}>
                  ⏱️ Time
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heroBalanceContainer}>
            <Text style={styles.heroBalance}>
              {viewMode === "money"
                ? rm(netWorth)
                : `${netWorthHours.toFixed(1)} hrs`}
            </Text>
          </View>

          {/* Breakdown Mini Badges: Assets vs Debt */}
          <View style={styles.assetsDebtRow}>
            <View style={styles.assetBadge}>
              <Text style={styles.assetBadgeText}>
                {viewMode === "money" ? `Assets: +${rm(totalAssets)}` : `Assets: +${assetHours.toFixed(1)}h`}
              </Text>
            </View>
            {totalLiabilities > 0 && (
              <View style={styles.debtBadge}>
                <Text style={styles.debtBadgeText}>
                  {viewMode === "money" ? `Debt: -${rm(totalLiabilities)}` : `Debt: -${liabilityHours.toFixed(1)}h`}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroFooterRow}>
            <View style={{ gap: 2 }}>
              <Text style={styles.heroSubLabel}>Spent This Month</Text>
              <Text style={styles.heroSubValue}>
                {viewMode === "money"
                  ? rm(monthSpending)
                  : `${formatTimeCost(monthSpending, wage.hourlyRate)} of work`}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.addQuickBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push("/quick-add");
              }}
            >
              <Ionicons name="add" size={16} color={colors.brandPrimary} />
              <Text style={styles.addQuickBtnText}>Quick Add</Text>
            </Pressable>
          </View>
        </View>

        {/* 🎯 Smart Monthly Life Budget Tracker Card */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 22 }}>🎯</Text>
              <View>
                <Text style={styles.budgetTitle}>Monthly Life Budget</Text>
                <Text style={styles.budgetSub}>
                  Cap: {rm(budgetLimit)} ({budgetWorkHours.toFixed(1)} hrs of work)
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.budgetEditBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setBudgetModalOpen(true);
              }}
            >
              <Text style={styles.budgetEditText}>Configure</Text>
            </Pressable>
          </View>

          {/* Overall Progress Bar */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, budgetUsedPct)}%`,
                  backgroundColor: isOverBudget
                    ? "#EF4444"
                    : budgetUsedPct > 80
                    ? "#F59E0B"
                    : colors.brandPrimary,
                },
              ]}
            />
          </View>

          <View style={styles.budgetFooter}>
            <Text style={styles.budgetPctText}>
              {isOverBudget
                ? `⚠️ Over total budget by ${rm(monthSpending - budgetLimit)}`
                : `${budgetUsedPct}% used (${budgetRemainingHours.toFixed(1)}h work remaining)`}
            </Text>
            <Text style={styles.budgetSpentText}>
              {rm(monthSpending)} / {rm(budgetLimit)}
            </Text>
          </View>

          {/* Segregated Sub-Budget Meters: Needs vs Guilt-Free Comfort / Nonsense */}
          <View style={styles.subBudgetsDivider} />
          
          <View style={styles.subBudgetsWrap}>
            {/* 1. Must-Haves / Needs */}
            <View style={styles.subBudgetCol}>
              <View style={styles.subBudgetHead}>
                <Text style={styles.subBudgetTitle}>🍞 Must-Haves</Text>
                <Text style={styles.subBudgetVal}>
                  {rm(bucketSpending.needsSpent)} / {rm(needsLimit)}
                </Text>
              </View>
              <View style={styles.subProgressBg}>
                <View
                  style={[
                    styles.subProgressFill,
                    {
                      width: `${needsUsedPct}%`,
                      backgroundColor: needsUsedPct > 100 ? "#EF4444" : "#3B82F6",
                    },
                  ]}
                />
              </View>
              <Text style={styles.subBudgetMeta}>
                Bills, Petrol, Makan · {Math.max(0, needsLimit - bucketSpending.needsSpent) === 0 ? "Exceeded" : `${rm(Math.max(0, needsLimit - bucketSpending.needsSpent))} left`}
              </Text>
            </View>

            {/* 2. Guilt-Free Comfort & "Nonsense" Fund */}
            <View style={[styles.subBudgetCol, styles.comfortSubBudgetCol]}>
              <View style={styles.subBudgetHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.subBudgetTitle, { color: "#BE185D" }]}>🎁 Comfort Fund</Text>
                </View>
                <Text style={[styles.subBudgetVal, { color: "#BE185D" }]}>
                  {rm(bucketSpending.comfortSpent)} / {rm(comfortLimit)}
                </Text>
              </View>
              <View style={styles.subProgressBg}>
                <View
                  style={[
                    styles.subProgressFill,
                    {
                      width: `${comfortUsedPct}%`,
                      backgroundColor: isComfortOver ? "#EF4444" : "#EC4899",
                    },
                  ]}
                />
              </View>
              <Text style={[styles.subBudgetMeta, { color: isComfortOver ? "#EF4444" : "#9D174D" }]}>
                {isComfortOver
                  ? `Over comfort cap by ${rm(bucketSpending.comfortSpent - comfortLimit)}`
                  : `✨ ${rm(comfortRemaining)} left for treats (${comfortRemainingHours.toFixed(1)}h work)!`}
              </Text>
            </View>
          </View>
        </View>

        {/* Mascot Life Energy Reaction Card */}
        <View style={styles.reactionCard}>
          <View style={styles.reactionRow}>
            <AnimatedMascot variant="coin" size={54} interactive={true} />
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.reactionTitle}>{bobaReaction.title}</Text>
                <Text style={{ fontSize: 16 }}>{bobaReaction.emoji}</Text>
              </View>
              <Text style={styles.reactionDesc}>
                This month you traded <Text style={styles.boldHighlight}>{monthWorkHours.toFixed(1)} hours</Text> of your work ({rm(monthSpending)}) for lifestyle expenses.
              </Text>
            </View>
          </View>
        </View>

        {/* Accounts horizontal scroll */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Accounts & Cards</Text>
          <Pressable onPress={() => router.push("/(tabs)/accounts")}>
            <Text style={styles.seeAllText}>Manage</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.md }}
          style={{ marginBottom: spacing.lg }}
        >
          {accounts.map((acc) => {
            const isDebt = isLiabilityAccount(acc.type);
            return (
              <View key={acc.id} style={[styles.accountPill, { borderLeftColor: acc.color }]}>
                <Text style={{ fontSize: 24 }}>{acc.emoji}</Text>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={styles.accountPillName}>{acc.name}</Text>
                  <Text style={[styles.accountPillBalance, isDebt && { color: "#EF4444" }]}>
                    {viewMode === "money"
                      ? isDebt
                        ? `-${rm(acc.balance)}`
                        : rm(acc.balance)
                      : `${(acc.balance / (wage.hourlyRate || 25)).toFixed(1)}h`}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Recent Activity with Slide to Delete & Tap for Details */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <Text style={styles.swipeHint}>(tap for detail · slide to delete)</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={styles.seeAllText}>View All</Text>
          </Pressable>
        </View>

        {recentTxns.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AnimatedMascot variant="zen" size={76} interactive={true} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No activity yet!</Text>
            <Text style={styles.emptyText}>Tap + to log your first transaction or scan a receipt.</Text>
          </View>
        ) : (
          recentTxns.map((t) => {
            const acc = accounts.find((a) => a.id === t.accountId);
            return (
              <SwipeableTxnRow
                key={t.id}
                transaction={t}
                account={acc}
                hourlyRate={wage.hourlyRate}
                viewMode={viewMode}
                onPress={(txn) => setSelectedTxn(txn)}
                onDelete={handleDeleteTxn}
              />
            );
          })
        )}
      </ScrollView>

      {/* Transaction Detail Sheet */}
      <TransactionDetailModal
        visible={!!selectedTxn}
        transaction={selectedTxn}
        account={accounts.find((a) => a.id === selectedTxn?.accountId)}
        accounts={accounts}
        hourlyRate={wage.hourlyRate}
        onClose={() => setSelectedTxn(null)}
        onDelete={handleDeleteTxn}
        onUpdate={handleUpdateTxn}
      />

      {/* Wage Settings Modal */}
      <Modal
        visible={wageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Image
                  source={require("@/assets/mascot.jpg")}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
                <Text style={styles.modalTitle}>Set Your Work Wage</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setWageModalOpen(false)}>
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
                keyboardType="decimal-pad"
                inputMode="decimal"
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
                keyboardType="decimal-pad"
                inputMode="decimal"
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

      {/* Smart Segregated Budget Modal */}
      <SmartBudgetModal
        visible={budgetModalOpen}
        budget={budget}
        accounts={accounts}
        wage={wage}
        onClose={() => setBudgetModalOpen(false)}
        onSave={handleSaveBudget}
      />

      {/* Cloud Sync & Phone Backup Modal */}
      <CloudSyncModal
        visible={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onDataRestored={loadData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  brandTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mascotThumbWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pink,
    padding: 2,
    ...shadow.soft,
  },
  mascotThumb: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  greetingText: {
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    letterSpacing: -0.1,
  },
  appTitle: {
    fontWeight: "800",
    fontSize: 24,
    color: colors.onSurface,
    letterSpacing: -0.5,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cloudSyncBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  syncBadgeDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    ...shadow.glow,
  },
  scanBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  wagePill: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
    ...shadow.soft,
  },
  repaymentAlert: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
    ...shadow.soft,
  },
  repaymentAlertTitle: {
    fontWeight: "800",
    fontSize: 13,
    color: "#92400E",
  },
  repaymentAlertSub: {
    fontWeight: "600",
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  repaymentAlertAction: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  repaymentAlertActionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11,
  },
  wagePillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  wageIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  wagePillEmoji: { fontSize: 16 },
  wagePillLabel: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  wagePillValue: {
    fontWeight: "700",
    fontSize: 13,
    color: colors.brandPrimary,
  },
  wagePillEdit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  wagePillEditText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.brandPrimary,
  },
  heroCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.brandPrimary,
    ...shadow.soft,
  },
  toggleText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  toggleTextActive: {
    color: colors.onBrandPrimary,
  },
  heroBalanceContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  heroBalance: {
    fontWeight: "800",
    fontSize: 32,
    color: colors.onSurface,
    letterSpacing: -0.6,
  },
  assetsDebtRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  assetBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  assetBadgeText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 11,
  },
  debtBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  debtBadgeText: {
    color: "#991B1B",
    fontWeight: "700",
    fontSize: 11,
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  heroFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroSubLabel: {
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontSize: 11,
  },
  heroSubValue: {
    fontWeight: "700",
    color: colors.brandPrimary,
    fontSize: 15,
  },
  addQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addQuickBtnText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
  budgetCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  budgetTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: colors.onSurface,
  },
  budgetSub: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  budgetEditBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  budgetEditText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 11,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 4,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  budgetPctText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  budgetSpentText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurface,
  },
  subBudgetsDivider: {
    height: 1,
    backgroundColor: colors.borderStrong,
    marginVertical: 12,
  },
  subBudgetsWrap: {
    gap: 10,
  },
  subBudgetCol: {
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 6,
  },
  comfortSubBudgetCol: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },
  subBudgetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subBudgetTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.onSurface,
  },
  comfortBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#BE185D",
    backgroundColor: "#FCE7F3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    textTransform: "uppercase",
  },
  subBudgetVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  subProgressBg: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  subProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  subBudgetMeta: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  reactionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reactionMascotWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FDF2F8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reactionMascotImg: {
    width: 48,
    height: 48,
  },
  reactionTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: colors.onSurface,
  },
  reactionDesc: {
    fontWeight: "500",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    lineHeight: 17,
  },
  boldHighlight: {
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 17,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  swipeHint: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  seeAllText: {
    fontWeight: "700",
    color: colors.brandPrimary,
    fontSize: 13,
  },
  accountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minWidth: 155,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  accountPillName: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  accountPillBalance: {
    fontWeight: "800",
    fontSize: 14,
    color: colors.onSurface,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onSurface,
  },
  emptyText: {
    fontWeight: "500",
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
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
  modalTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
  },
  modalSubtitle: {
    fontWeight: "400",
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginTop: 8,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontWeight: "700",
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
  calcPreviewLabel: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  calcPreviewVal: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.brandPrimary,
    marginTop: 4,
  },
  saveWageBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.glow,
  },
  saveWageBtnText: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onBrandPrimary,
  },
});
