import React, { useState, useEffect, useMemo } from "react";
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
import { amountToWorkHours, rm, todayISO } from "@/src/format";
import { transferFunds } from "@/src/store";
import { AnimatedMascot } from "./AnimatedMascot";
import { AccountSelectDropdown } from "./AccountSelectDropdown";

interface Props {
  visible: boolean;
  accounts: Account[];
  wage: WageSettings;
  preselectedFromId?: string;
  preselectedToId?: string;
  prefillAmount?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferModal({
  visible,
  accounts,
  wage,
  preselectedFromId,
  preselectedToId,
  prefillAmount,
  onClose,
  onSuccess,
}: Props) {
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amountStr, setAmountStr] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Asset accounts for transfer source (e.g. Bank, eWallet, Cash)
  const sourceCandidates = useMemo(() => {
    return accounts.filter((a) => !isLiabilityAccount(a.type) || a.balance > 0);
  }, [accounts]);

  // Destination accounts (all accounts except current source)
  const destinationCandidates = useMemo(() => {
    return accounts.filter((a) => a.id !== fromId);
  }, [accounts, fromId]);

  useEffect(() => {
    if (visible) {
      const defaultFrom =
        preselectedFromId ||
        accounts.find((a) => a.type === "bank")?.id ||
        accounts.find((a) => a.type === "ewallet")?.id ||
        accounts[0]?.id ||
        "";
      setFromId(defaultFrom);

      const defaultTo =
        preselectedToId ||
        accounts.find((a) => a.id !== defaultFrom && isLiabilityAccount(a.type))?.id ||
        accounts.find((a) => a.id !== defaultFrom)?.id ||
        "";
      setToId(defaultTo);

      if (prefillAmount && prefillAmount > 0) {
        setAmountStr(String(prefillAmount));
      } else {
        // If destination is a loan/card with monthly installment, prefill it!
        const targetAcc = accounts.find((a) => a.id === defaultTo);
        if (targetAcc && isLiabilityAccount(targetAcc.type) && targetAcc.monthlyInstallment) {
          setAmountStr(String(targetAcc.monthlyInstallment));
        } else {
          setAmountStr("");
        }
      }
      setNote("");
    }
  }, [visible, preselectedFromId, preselectedToId, prefillAmount, accounts]);

  const fromAcc = accounts.find((a) => a.id === fromId);
  const toAcc = accounts.find((a) => a.id === toId);

  const amount = parseFloat(amountStr.replace(/,/g, "")) || 0;
  const isLoanOrDebt = toAcc ? isLiabilityAccount(toAcc.type) : false;
  const workHours = amountToWorkHours(amount, wage.hourlyRate);

  // Previews
  const fromBalanceBefore = fromAcc?.balance || 0;
  const fromBalanceAfter = +(fromBalanceBefore - amount).toFixed(2);

  const toBalanceBefore = toAcc?.balance || 0;
  // If toAcc is liability, payment reduces debt
  const toBalanceAfter = isLoanOrDebt
    ? Math.max(0, +(toBalanceBefore - amount).toFixed(2))
    : +(toBalanceBefore + amount).toFixed(2);

  const handleSelectToAccount = (newToId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setToId(newToId);
    const target = accounts.find((a) => a.id === newToId);
    if (target && isLiabilityAccount(target.type) && target.monthlyInstallment && !amountStr) {
      setAmountStr(String(target.monthlyInstallment));
    }
  };

  const handleTransfer = async () => {
    if (!fromId || !toId) {
      Alert.alert("Account Required", "Please select both source and destination accounts.");
      return;
    }
    if (fromId === toId) {
      Alert.alert("Invalid Transfer", "Source and destination accounts must be different.");
      return;
    }
    if (amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a transfer amount greater than 0.");
      return;
    }
    if (fromAcc && !isLiabilityAccount(fromAcc.type) && fromAcc.balance < amount) {
      const proceed = await new Promise<boolean>((resolve) => {
        if (Platform.OS === "web") {
          resolve(window.confirm(`Your balance in ${fromAcc.name} is RM ${fromAcc.balance.toFixed(2)}, which is less than RM ${amount.toFixed(2)}. Proceed anyway?`));
        } else {
          Alert.alert(
            "Low Balance Warning",
            `Your balance in ${fromAcc.name} is RM ${fromAcc.balance.toFixed(2)}, which is less than RM ${amount.toFixed(2)}. Proceed anyway?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Proceed", onPress: () => resolve(true) },
            ]
          );
        }
      });
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      await transferFunds({
        fromAccountId: fromId,
        toAccountId: toId,
        amount,
        note: note.trim() || undefined,
        category: isLoanOrDebt ? "Loan / Debt" : "Transfer",
        date: todayISO(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert("Transfer Error", e.message || "Failed to process transfer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

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
              <AnimatedMascot variant={isLoanOrDebt ? "zen" : "rich"} size={42} interactive={true} />
              <View>
                <Text style={styles.title}>
                  {isLoanOrDebt ? "Deduct Loan Repayment 💸" : "Account Transfer 🔁"}
                </Text>
                <Text style={styles.sub}>
                  {isLoanOrDebt
                    ? "Deduct payment from bank & reduce debt"
                    : "Move dough between your accounts"}
                </Text>
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
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* FROM ACCOUNT SELECTOR */}
            <AccountSelectDropdown
              label="FROM (Source Account)"
              value={fromId}
              onChange={(id) => {
                setFromId(id);
                if (toId === id) {
                  const nextTo = accounts.find((a) => a.id !== id)?.id || "";
                  setToId(nextTo);
                }
              }}
              accounts={sourceCandidates}
              modalTitle="Select Source Account"
            />

            {/* Transfer Direction Indicator */}
            <View style={styles.directionDivider}>
              <View style={styles.dividerLine} />
              <View style={styles.directionBadge}>
                <Ionicons name="arrow-down" size={16} color={colors.brandPrimary} />
              </View>
              <View style={styles.dividerLine} />
            </View>

            {/* TO ACCOUNT SELECTOR */}
            <AccountSelectDropdown
              label={isLoanOrDebt ? "TO (Repaying Loan / Debt)" : "TO (Destination Account)"}
              value={toId}
              onChange={handleSelectToAccount}
              accounts={destinationCandidates}
              excludeId={fromId}
              modalTitle={isLoanOrDebt ? "Select Loan / Debt to Repay" : "Select Destination Account"}
              isDebtTarget={isLoanOrDebt}
            />

            {/* AMOUNT INPUT */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Transfer / Repayment Amount (RM)</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencyPrefix}>RM</Text>
                <TextInput
                  value={amountStr}
                  onChangeText={setAmountStr}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0.00"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.amountInput}
                />
              </View>

              {/* Quick Amount Chips */}
              <View style={styles.quickChipsRow}>
                {[50, 100, 200, 500].map((quickAmt) => (
                  <Pressable
                    key={quickAmt}
                    style={styles.quickChip}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setAmountStr(String(quickAmt));
                    }}
                  >
                    <Text style={styles.quickChipText}>+{rm(quickAmt)}</Text>
                  </Pressable>
                ))}
                {toAcc?.monthlyInstallment && (
                  <Pressable
                    style={[styles.quickChip, styles.quickChipInstallment]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setAmountStr(String(toAcc.monthlyInstallment));
                    }}
                  >
                    <Text style={[styles.quickChipText, { color: colors.brandPrimary, fontWeight: "800" }]}>
                      Installment ({rm(toAcc.monthlyInstallment)})
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Life Work Cost Pill */}
              {amount > 0 && (
                <View style={styles.lifeCostPill}>
                  <Text style={{ fontSize: 13 }}>⏱️</Text>
                  <Text style={styles.lifeCostText}>
                    {isLoanOrDebt ? "Clears " : "Moves "}
                    <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>
                      {workHours.toFixed(1)} hours
                    </Text>
                    {" of your hard work (RM " + wage.hourlyRate.toFixed(2) + "/hr)"}
                  </Text>
                </View>
              )}
            </View>

            {/* BALANCE PREVIEW CARD */}
            {amount > 0 && fromAcc && toAcc && (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Balance Impact Preview</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewAccName}>{fromAcc.name}:</Text>
                  <Text style={styles.previewVal}>
                    {rm(fromBalanceBefore)} ➔ <Text style={{ color: "#EF4444", fontWeight: "800" }}>{rm(fromBalanceAfter)}</Text>
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewAccName}>{toAcc.name}:</Text>
                  <Text style={styles.previewVal}>
                    {isLoanOrDebt ? `Owed ${rm(toBalanceBefore)}` : rm(toBalanceBefore)} ➔{" "}
                    <Text style={{ color: "#10B981", fontWeight: "800" }}>
                      {isLoanOrDebt ? `Owed ${rm(toBalanceAfter)} (-${rm(amount)})` : rm(toBalanceAfter)}
                    </Text>
                  </Text>
                </View>
              </View>
            )}

            {/* NOTE / MEMO */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Note / Memo (Optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={isLoanOrDebt ? "e.g. Monthly Car Loan Repayment" : "e.g. Wallet reload, savings"}
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.input}
              />
            </View>
          </ScrollView>

          {/* CONFIRM BUTTON */}
          <Pressable
            style={[
              styles.confirmBtn,
              isLoanOrDebt && { backgroundColor: "#059669" },
              (amount <= 0 || submitting) && { opacity: 0.5 },
            ]}
            disabled={amount <= 0 || submitting}
            onPress={handleTransfer}
          >
            <Ionicons name={isLoanOrDebt ? "shield-checkmark" : "swap-horizontal"} size={18} color="#FFFFFF" />
            <Text style={styles.confirmBtnText}>
              {submitting
                ? "Processing…"
                : isLoanOrDebt
                ? `Confirm Repayment · ${rm(amount)}`
                : `Confirm Transfer · ${rm(amount)}`}
            </Text>
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
    maxHeight: "92%",
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
  title: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  sub: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontWeight: "800",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  accPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accPillActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  accPillActiveDebt: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  accPillName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  accPillNameActive: {
    color: "#FFFFFF",
  },
  accPillBal: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  accPillBalActive: {
    color: "rgba(255,255,255,0.85)",
  },
  directionDivider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  directionBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
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
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    paddingVertical: 10,
  },
  quickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  quickChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipInstallment: {
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.brandPrimary,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurface,
  },
  lifeCostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  lifeCostText: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurface,
  },
  previewCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    gap: 4,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewAccName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurface,
  },
  previewVal: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontWeight: "600",
    fontSize: 16,
    color: colors.onSurface,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    ...shadow.glow,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
