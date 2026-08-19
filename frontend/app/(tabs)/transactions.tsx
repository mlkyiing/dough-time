import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { deleteTransaction, getAccounts, getTransactions, getWageSettings } from "@/src/store";
import { Account, Transaction, WageSettings } from "@/src/types";
import { CATEGORIES, categoryMeta } from "@/src/constants";
import {
  amountToWorkHours,
  formatTimeCost,
  rm,
  shortDate,
} from "@/src/format";

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
    Alert.alert("Delete transaction?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          await load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>History & Life Energy</Text>
          <Text style={styles.subtitle}>
            {viewMode === "money"
              ? `Total ${rm(totalExpense)}`
              : `Total ${totalHours.toFixed(1)} hrs (${(totalHours / 8).toFixed(1)} workdays)`}
          </Text>
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
            style={styles.iconBtn}
            onPress={() => router.push("/quick-add")}
          >
            <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Chips row */}
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

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🧋</Text>
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>Tap + to log an expense or scan a receipt!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = categoryMeta(item.category);
          const acc = accounts.find((a) => a.id === item.accountId);
          const timeCost = formatTimeCost(item.amount, wage.hourlyRate);

          return (
            <Pressable
              testID={`txn-${item.id}`}
              onLongPress={() => handleDelete(item.id)}
              style={styles.card}
            >
              <View style={[styles.iconBox, { backgroundColor: meta.tint }]}>
                <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.merchant || item.category}</Text>
                <Text style={styles.cardSub}>
                  {shortDate(item.date)} · {acc?.name || "—"}
                  {item.note ? ` · ${item.note}` : ""}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.cardAmt}>
                  {viewMode === "money" ? rm(item.amount) : timeCost}
                </Text>
                <View style={styles.timePill}>
                  <Text style={styles.timePillText}>
                    {viewMode === "money" ? `⏱️ ${timeCost}` : rm(item.amount)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, color: colors.onSurface },
  subtitle: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
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
  },
  toggleText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  toggleTextActive: {
    color: colors.onBrandPrimary,
  },
  iconBtn: {
    backgroundColor: colors.brandPrimary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  chipsWrap: { paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Nunito_700Bold", fontSize: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontFamily: "Nunito_700Bold", fontSize: 15, color: colors.onSurface },
  cardSub: { fontFamily: "Nunito_400Regular", fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 2 },
  cardAmt: { fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: colors.onSurface },
  timePill: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 3,
  },
  timePillText: { fontFamily: "Nunito_700Bold", fontSize: 10, color: colors.brandPrimary },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: colors.onSurface },
  emptySubtitle: { fontFamily: "Nunito_400Regular", fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 4 },
});
