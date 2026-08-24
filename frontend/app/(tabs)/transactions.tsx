import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { deleteTransaction, getAccounts, getTransactions, getWageSettings, mergeWithCloud, updateTransaction } from "@/src/store";
import { Account, Transaction, WageSettings } from "@/src/types";
import { CATEGORIES, INCOME_CATEGORIES } from "@/src/constants";
import { amountToWorkHours, formatMonthDisplay, monthKey, rm, todayISO } from "@/src/format";
import { SwipeableTxnRow } from "@/src/components/SwipeableTxnRow";
import { TransactionDetailModal } from "@/src/components/TransactionDetailModal";
import { AnimatedMascot } from "@/src/components/AnimatedMascot";
import { CuteAppBackground } from "@/src/components/CuteAppBackground";

export default function Transactions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [viewMode, setViewMode] = useState<"money" | "time">("money");
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKey(todayISO()));
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    const [t, a, w] = await Promise.all([
      getTransactions(),
      getAccounts(),
      getWageSettings(),
    ]);
    setTxns(t);
    setAccounts(a);
    setWage(w);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      mergeWithCloud().then(() => load()).catch(() => {});
    }, [load])
  );

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

  // Filtered dataset
  const filtered = useMemo(() => {
    return txns.filter((t) => {
      // 1. Month filter
      if (selectedMonth !== "all" && monthKey(t.date) !== selectedMonth) {
        return false;
      }
      // 2. Type filter
      if (typeFilter === "expense" && t.type === "income") return false;
      if (typeFilter === "income" && t.type !== "income") return false;
      // 3. Category filter
      if (categoryFilter !== "All" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [txns, selectedMonth, typeFilter, categoryFilter]);

  // Month stats for banner
  const monthStats = useMemo(() => {
    const monthTxns = selectedMonth === "all" ? txns : txns.filter((t) => monthKey(t.date) === selectedMonth);
    const expenses = monthTxns.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0);
    const income = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const net = income - expenses;
    return { expenses, income, net };
  }, [txns, selectedMonth]);

  const totalExpenseHours = amountToWorkHours(monthStats.expenses, wage.hourlyRate);
  const totalIncomeHours = amountToWorkHours(monthStats.income, wage.hourlyRate);

  // Category chips based on type filter
  const categoryChips = useMemo(() => {
    if (typeFilter === "income") {
      return ["All", ...INCOME_CATEGORIES.map((c) => c.key)];
    }
    if (typeFilter === "expense") {
      return ["All", ...CATEGORIES.map((c) => c.key)];
    }
    return ["All", ...CATEGORIES.map((c) => c.key), ...INCOME_CATEGORIES.map((c) => c.key)];
  }, [typeFilter]);

  const handleDelete = (id: string) => {
    const doDelete = async () => {
      await deleteTransaction(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (selectedTxn?.id === id) setSelectedTxn(null);
      await load();
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm("Delete this transaction? This can't be undone.") : true;
      if (ok) {
        doDelete();
      }
      return;
    }

    Alert.alert("Delete transaction?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: doDelete,
      },
    ]);
  };

  const handleUpdate = async (updated: Transaction) => {
    await updateTransaction(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelectedTxn(null);
    await load();
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: Platform.OS === "web" ? Math.max(insets.top, 14) : 0 },
      ]}
      edges={["top"]}
    >
      <CuteAppBackground />
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AnimatedMascot variant="shopping" size={46} interactive={true} />
          <View style={{ gap: 2 }}>
            <Text style={styles.title}>Activity</Text>
            <Text style={styles.subtitle}>
              {viewMode === "money"
                ? `Spent ${rm(monthStats.expenses)} · +${rm(monthStats.income)} in`
                : `${totalExpenseHours.toFixed(1)}h spent · +${totalIncomeHours.toFixed(1)}h freed`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {/* RM vs Time Toggle */}
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
                ⏱️
              </Text>
            </Pressable>
          </View>

          <Pressable
            testID="add-txn-btn"
            style={({ pressed }) => [styles.iconBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push("/quick-add");
            }}
          >
            <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
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

      {/* Type Filter Segmented Control (All vs Expenses vs Income) */}
      <View style={styles.typeSegmentWrap}>
        <Pressable
          style={[styles.typeSegmentBtn, typeFilter === "all" && styles.typeSegmentBtnActive]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setTypeFilter("all");
            setCategoryFilter("All");
          }}
        >
          <Text style={[styles.typeSegmentText, typeFilter === "all" && styles.typeSegmentTextActive]}>
            All ({filtered.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.typeSegmentBtn, typeFilter === "expense" && styles.typeSegmentBtnActiveExpense]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setTypeFilter("expense");
            setCategoryFilter("All");
          }}
        >
          <Text style={[styles.typeSegmentText, typeFilter === "expense" && styles.typeSegmentTextActive]}>
            💸 Expenses
          </Text>
        </Pressable>
        <Pressable
          style={[styles.typeSegmentBtn, typeFilter === "income" && styles.typeSegmentBtnActiveIncome]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setTypeFilter("income");
            setCategoryFilter("All");
          }}
        >
          <Text style={[styles.typeSegmentText, typeFilter === "income" && styles.typeSegmentTextActive]}>
            💰 Income
          </Text>
        </Pressable>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
        >
          {categoryChips.map((c) => {
            const isActive = categoryFilter === c;
            return (
              <Pressable
                key={c}
                testID={`filter-chip-${c}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setCategoryFilter(c);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.brandPrimary : colors.surfaceSecondary,
                    borderColor: isActive ? colors.brandPrimary : colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? colors.onBrandPrimary : colors.onSurface },
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Transactions List with Swipe to Delete & Tap for Details */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Image
              source={require("@/assets/mascot_coin.jpg")}
              style={{ width: 90, height: 90, marginBottom: 12 }}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedMonth !== "all"
                ? `No activity recorded for ${formatMonthDisplay(selectedMonth)}.`
                : "Tap + to log an expense or deposit income!"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const acc = accounts.find((a) => a.id === item.accountId);
          return (
            <SwipeableTxnRow
              key={item.id}
              transaction={item}
              account={acc}
              hourlyRate={wage.hourlyRate}
              viewMode={viewMode}
              onPress={(t) => setSelectedTxn(t)}
              onDelete={handleDelete}
            />
          );
        }}
      />

      {/* Transaction Detail Sheet */}
      <TransactionDetailModal
        visible={!!selectedTxn}
        transaction={selectedTxn}
        account={accounts.find((a) => a.id === selectedTxn?.accountId)}
        accounts={accounts}
        hourlyRate={wage.hourlyRate}
        onClose={() => setSelectedTxn(null)}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontWeight: "800",
    fontSize: 22,
    color: colors.onSurface,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
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
  iconBtn: {
    backgroundColor: colors.brandPrimary,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glow,
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
  typeSegmentWrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    padding: 3,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  typeSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  typeSegmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  typeSegmentBtnActiveExpense: {
    backgroundColor: colors.brandPrimary,
    ...shadow.soft,
  },
  typeSegmentBtnActiveIncome: {
    backgroundColor: "#10B981",
    ...shadow.soft,
  },
  typeSegmentText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  typeSegmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  chipsWrap: { paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: "700",
    fontSize: 12,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xxxl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: colors.onSurface,
  },
  emptySubtitle: {
    fontWeight: "400",
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginTop: 4,
  },
});
