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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { deleteTransaction, getAccounts, getTransactions, getWageSettings, updateTransaction } from "@/src/store";
import { Account, Transaction, WageSettings } from "@/src/types";
import { CATEGORIES } from "@/src/constants";
import { amountToWorkHours, rm } from "@/src/format";
import { SwipeableTxnRow } from "@/src/components/SwipeableTxnRow";
import { TransactionDetailModal } from "@/src/components/TransactionDetailModal";
import { AnimatedMascot } from "@/src/components/AnimatedMascot";

export default function Transactions() {
  const router = useRouter();
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
  const [filter, setFilter] = useState<string>("All");
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
    }, [load])
  );

  const filtered = useMemo(
    () => (filter === "All" ? txns : txns.filter((t) => t.category === filter)),
    [txns, filter]
  );

  const totalExpense = useMemo(
    () => filtered.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
    [filtered]
  );

  const totalHours = amountToWorkHours(totalExpense, wage.hourlyRate);

  const chips = ["All", ...CATEGORIES.map((c) => c.key)];

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AnimatedMascot variant="shopping" size={46} interactive={true} />
          <View style={{ gap: 2 }}>
            <Text style={styles.title}>Activity</Text>
            <Text style={styles.subtitle}>
              {viewMode === "money"
                ? `Total ${rm(totalExpense)}`
                : `Total ${totalHours.toFixed(1)} hrs (${(totalHours / 8).toFixed(1)} workdays)`}
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

      {/* Category Filter Chips */}
      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
        >
          {chips.map((c) => {
            const isActive = filter === c;
            return (
              <Pressable
                key={c}
                testID={`filter-chip-${c}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFilter(c);
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
            <Text style={styles.emptySubtitle}>Tap + to log an expense or scan a receipt!</Text>
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
  container: { flex: 1, backgroundColor: "transparent" },
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
