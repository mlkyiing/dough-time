import React, { useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
import { Account, WageSettings, isLiabilityAccount } from "@/src/types";
import { amountToWorkHours, rm } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { scheduleLoanRepaymentReminder } from "../utils/notifications";

interface Props {
  visible: boolean;
  account: Account | null;
  wage: WageSettings;
  onClose: () => void;
  onSave: (updated: Account, adjustmentNote?: string) => void;
  onDelete: (id: string) => void;
}

export function EditAccountModal({
  visible,
  account,
  wage,
  onClose,
  onSave,
  onDelete,
}: Props) {
  if (!account) return null;

  const isDebt = isLiabilityAccount(account);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [limit, setLimit] = useState("");
  const [rate, setRate] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [installment, setInstallment] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");

  useEffect(() => {
    if (account) {
      setName(account.name);
      setBalance(String(account.balance || 0));
      setLimit(account.creditLimit ? String(account.creditLimit) : "");
      setRate(account.interestRate ? String(account.interestRate) : "");
      setDueDay(account.dueDay ? String(account.dueDay) : "");
      setInstallment(account.monthlyInstallment ? String(account.monthlyInstallment) : "");
      setAdjustmentNote("");
    }
  }, [account]);

  const balanceNum = parseFloat(balance.replace(/,/g, "")) || 0;
  const workHours = amountToWorkHours(balanceNum, wage.hourlyRate);
  const oldBalance = account.balance || 0;
  const diff = +(balanceNum - oldBalance).toFixed(2);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Account Name Required", "Please enter a valid account name.");
      return;
    }

    const updated: Account = {
      ...account,
      name: name.trim(),
      balance: balanceNum,
      creditLimit: limit ? parseFloat(limit.replace(/,/g, "")) || undefined : undefined,
      interestRate: rate ? parseFloat(rate.replace(/,/g, "")) || undefined : undefined,
      dueDay: dueDay ? parseInt(dueDay, 10) || undefined : undefined,
      monthlyInstallment: installment ? parseFloat(installment.replace(/,/g, "")) || undefined : undefined,
    };

    onSave(updated, adjustmentNote.trim() || undefined);
    if (updated.reminderEnabled && updated.dueDay) {
      await scheduleLoanRepaymentReminder(updated, wage.hourlyRate);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const doDelete = () => {
      onDelete(account.id);
      onClose();
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(`Are you sure you want to delete "${account.name}"?`) : true;
      if (ok) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      "Delete Account",
      `Are you sure you want to delete "${account.name}"? This will remove the account from your dashboard.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: doDelete,
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.emojiBadge}>
                <Text style={{ fontSize: 24 }}>{account.emoji}</Text>
              </View>
              <View>
                <Text style={styles.title}>Edit Account Details</Text>
                <Text style={styles.sub}>{account.type.toUpperCase()}</Text>
              </View>
            </View>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ marginVertical: spacing.md }}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Account Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account / Card / Loan Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Maybank Savings"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.input}
              />
            </View>

            {/* Balance / Owed */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isDebt ? "Current Owed Balance (RM)" : "Current Available Balance (RM)"}
              </Text>
              <TextInput
                value={balance}
                onChangeText={setBalance}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0.00"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.input}
              />
              <View style={styles.lifeCostPill}>
                <Text style={{ fontSize: 13 }}>⏱️</Text>
                <Text style={styles.lifeCostText}>
                  Equivalent to <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{workHours.toFixed(1)} hours</Text> of your work
                </Text>
              </View>

              {/* Live Adjustment Alert Notice */}
              {diff !== 0 && (
                <View style={styles.adjustmentAlertCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>⚖️</Text>
                    <Text style={styles.adjustmentAlertTitle}>
                      {isDebt
                        ? diff > 0
                          ? `Debt Addition of +${rm(Math.abs(diff))}`
                          : `Debt Deduction of -${rm(Math.abs(diff))}`
                        : diff > 0
                        ? `Balance Addition of +${rm(Math.abs(diff))}`
                        : `Balance Deduction of -${rm(Math.abs(diff))}`}
                    </Text>
                  </View>
                  <Text style={styles.adjustmentAlertSub}>
                    Will be automatically recorded in transactions ({rm(oldBalance)} ➔ {rm(balanceNum)})
                  </Text>
                  <TextInput
                    value={adjustmentNote}
                    onChangeText={setAdjustmentNote}
                    placeholder="Reason / Memo (e.g. Statement Sync, Cash Out)"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.adjustmentNoteInput}
                  />
                </View>
              )}
            </View>

            {/* Credit Limit for Cards */}
            {account.type === "credit_card" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Credit Limit (RM)</Text>
                <TextInput
                  value={limit}
                  onChangeText={setLimit}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="e.g. 8000.00"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>
            )}

            {/* Interest Rate for FD / Loans */}
            {(account.type === "fd" || account.type === "loan") && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {account.type === "loan" ? "Interest Rate %" : "Return Rate (APY) %"}
                </Text>
                <TextInput
                  value={rate}
                  onChangeText={setRate}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="e.g. 3.85"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>
            )}

            {/* Due Day & Installment for Liabilities */}
            {isDebt && (
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Due Day (1 - 31)</Text>
                  <TextInput
                    value={dueDay}
                    onChangeText={setDueDay}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder="e.g. 25"
                    maxLength={2}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.inputLabel}>Monthly Pay (RM)</Text>
                  <TextInput
                    value={installment}
                    onChangeText={setInstallment}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="e.g. 650.00"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                </View>
              </View>
            )}

            {/* Delete Account Button */}
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Delete This Account</Text>
            </Pressable>
          </ScrollView>

          {/* Save Button */}
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Account Changes</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: 36,
    maxHeight: "88%",
    ...shadow.card,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  sub: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.brandPrimary,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    marginTop: spacing.md,
  },
  inputLabel: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
    marginBottom: 6,
  },
  input: {
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
  lifeCostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  lifeCostText: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurface,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
  },
  deleteBtnText: {
    fontWeight: "700",
    fontSize: 13,
    color: "#EF4444",
  },
  saveBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.glow,
  },
  saveBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
  adjustmentAlertCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  adjustmentAlertTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  adjustmentAlertSub: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "500",
  },
  adjustmentNoteInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
    color: colors.onSurface,
    marginTop: 4,
  },
});
