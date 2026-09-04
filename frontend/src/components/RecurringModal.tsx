import React, { useState, useEffect } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { Account, RecurringFrequency, RecurringTxn, WageSettings } from "@/src/types";
import { amountToWorkHours, rm, todayISO } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { addRecurringTxn, addTransaction, deleteRecurringTxn, getRecurringTxns, setRecurringTxns } from "@/src/store";

interface Props {
  visible: boolean;
  accounts: Account[];
  wage: WageSettings;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecurringModal({ visible, accounts, wage, onClose, onSuccess }: Props) {
  const [subscriptions, setSubscriptions] = useState<RecurringTxn[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState("Subscriptions");
  const [accountId, setAccountId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");

  useEffect(() => {
    if (visible) {
      loadSubscriptions();
    }
  }, [visible]);

  const loadSubscriptions = async () => {
    const list = await getRecurringTxns();
    if (list.length === 0) {
      // Seed common Malaysian subscriptions if empty
      const defaultAcc = accounts[0]?.id || "";
      const defaults: Omit<RecurringTxn, "id">[] = [
        { name: "Netflix", amount: 54.9, category: "Subscriptions", accountId: defaultAcc, frequency: "monthly", dayOfMonth: 5, enabled: true },
        { name: "Spotify Premium", amount: 16.9, category: "Subscriptions", accountId: defaultAcc, frequency: "monthly", dayOfMonth: 12, enabled: true },
        { name: "Unifi / Home WiFi", amount: 139, category: "Telco", accountId: defaultAcc, frequency: "monthly", dayOfMonth: 20, enabled: true },
        { name: "Gym Membership", amount: 150, category: "Health", accountId: defaultAcc, frequency: "monthly", dayOfMonth: 1, enabled: true },
      ];
      const createdList: RecurringTxn[] = [];
      for (const d of defaults) {
        const item = await addRecurringTxn(d);
        createdList.push(item);
      }
      setSubscriptions(createdList);
    } else {
      setSubscriptions(list);
    }
  };

  const totalMonthlyCommitment = subscriptions
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + s.amount, 0);

  const totalHours = amountToWorkHours(totalMonthlyCommitment, wage.hourlyRate);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const amt = parseFloat(amountStr.replace(/,/g, "")) || 0;
    if (amt <= 0) return;

    const targetAcc = accountId || accounts[0]?.id || "";
    const day = parseInt(dayOfMonth, 10) || 1;

    await addRecurringTxn({
      name: name.trim(),
      amount: amt,
      category,
      accountId: targetAcc,
      frequency,
      dayOfMonth: Math.min(31, Math.max(1, day)),
      enabled: true,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setName("");
    setAmountStr("");
    setShowAdd(false);
    await loadSubscriptions();
  };

  const handleDelete = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await deleteRecurringTxn(id);
    await loadSubscriptions();
  };

  const handleToggle = async (item: RecurringTxn) => {
    Haptics.selectionAsync().catch(() => {});
    const updated = subscriptions.map((s) => (s.id === item.id ? { ...s, enabled: !s.enabled } : s));
    setSubscriptions(updated);
    await setRecurringTxns(updated);
  };

  const handleLogDueNow = async () => {
    const currentMonth = todayISO().slice(0, 7);
    const unlogged = subscriptions.filter((s) => s.enabled && s.lastLoggedMonth !== currentMonth);

    if (unlogged.length === 0) {
      Alert.alert("All Caught Up! ✅", "All active subscriptions for this month have already been logged.");
      return;
    }

    for (const sub of unlogged) {
      await addTransaction({
        amount: sub.amount,
        type: "expense",
        category: sub.category,
        accountId: sub.accountId,
        merchant: sub.name,
        note: `Recurring ${sub.frequency} payment 🔁`,
        date: todayISO(),
      });
    }

    const updated = subscriptions.map((s) =>
      s.enabled ? { ...s, lastLoggedMonth: currentMonth } : s
    );
    await setRecurringTxns(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      "Subscriptions Logged! ⚡",
      `Logged ${unlogged.length} subscriptions (${rm(unlogged.reduce((s, i) => s + i.amount, 0))}) for this month.`
    );
    onSuccess();
    await loadSubscriptions();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="mentor" size={38} interactive={false} />
              <View>
                <Text style={styles.headerTitle}>🔁 Recurring & Subscriptions</Text>
                <Text style={styles.headerSub}>Auto-track monthly bills & services</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Total Commitment Hero */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>MONTHLY SUBSCRIPTION COMMITMENT</Text>
              <Text style={styles.heroAmount}>{rm(totalMonthlyCommitment)}/mo</Text>
              <Text style={styles.heroSub}>
                Costs you <Text style={{ fontWeight: "800" }}>{totalHours.toFixed(1)} hours of life energy</Text> every single month
              </Text>

              <Pressable style={styles.logDueBtn} onPress={handleLogDueNow}>
                <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.logDueBtnText}>1-Tap Log Due Bills for This Month ⚡</Text>
              </Pressable>
            </View>

            {/* Subscriptions List Section */}
            <View style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>📋 Active Subscriptions</Text>
                <Pressable onPress={() => setShowAdd(!showAdd)}>
                  <Text style={styles.addLinkText}>{showAdd ? "Cancel" : "+ Add Subscription"}</Text>
                </Pressable>
              </View>

              {/* Add form */}
              {showAdd && (
                <View style={styles.addBox}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Subscription Name (e.g. Disney+, Gym, iCloud)"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TextInput
                      value={amountStr}
                      onChangeText={setAmountStr}
                      placeholder="Amount (RM)"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      keyboardType="decimal-pad"
                      style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                      value={dayOfMonth}
                      onChangeText={setDayOfMonth}
                      placeholder="Day (1-31)"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      keyboardType="numeric"
                      style={[styles.input, { width: 80 }]}
                    />
                  </View>
                  <Pressable style={styles.saveAddBtn} onPress={handleAdd}>
                    <Text style={styles.saveAddBtnText}>Save Subscription</Text>
                  </Pressable>
                </View>
              )}

              {/* Items */}
              <View style={{ gap: 8 }}>
                {subscriptions.map((sub) => {
                  const acc = accounts.find((a) => a.id === sub.accountId);
                  return (
                    <View key={sub.id} style={[styles.subCard, !sub.enabled && { opacity: 0.5 }]}>
                      <Pressable onPress={() => handleToggle(sub)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <Ionicons
                          name={sub.enabled ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={sub.enabled ? colors.brandPrimary : colors.onSurfaceSecondary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subName}>{sub.name}</Text>
                          <Text style={styles.subMeta}>
                            Billing Day {sub.dayOfMonth}th · {acc?.name || "Primary Account"}
                          </Text>
                        </View>
                      </Pressable>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.subAmount}>{rm(sub.amount)}</Text>
                        <Pressable hitSlop={6} onPress={() => handleDelete(sub.id)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    paddingBottom: Platform.OS === "ios" ? 34 : spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  headerSub: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    fontWeight: "500",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: "#FDF4FF",
    borderWidth: 1.5,
    borderColor: "#F0ABFC",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.soft,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#86198F",
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#701A75",
    marginTop: 2,
  },
  heroSub: {
    fontSize: 12,
    color: "#86198F",
    marginTop: 2,
  },
  logDueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C026D3",
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  logDueBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  addLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  addBox: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.onSurface,
  },
  saveAddBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 8,
  },
  saveAddBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  subName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  subMeta: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  subAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
