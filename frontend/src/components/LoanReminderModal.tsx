import React, { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { Account, WageSettings } from "@/src/types";
import { amountToWorkHours, rm } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { scheduleLoanRepaymentReminder, triggerNotification, checkAndRequestNotificationPermission } from "../utils/notifications";
import { calculateLoanRepayment, LoanCalculationType } from "../utils/loanCalculator";

interface Props {
  visible: boolean;
  account: Account | null;
  wage: WageSettings;
  onClose: () => void;
  onSave: (updated: Account) => void;
  onOpenTransfer?: (account: Account) => void;
}

export function LoanReminderModal({
  visible,
  account,
  wage,
  onClose,
  onSave,
  onOpenTransfer,
}: Props) {
  if (!account) return null;

  const [installment, setInstallment] = useState("");
  const [dueDay, setDueDay] = useState("25");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [daysBefore, setDaysBefore] = useState("2");

  // Loan Repayment Deduction Calculator States
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcPrincipal, setCalcPrincipal] = useState("");
  const [calcRate, setCalcRate] = useState("3.2");
  const [calcYears, setCalcYears] = useState("5");
  const [calcType, setCalcType] = useState<LoanCalculationType>("flat");
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    if (account) {
      setInstallment(account.monthlyInstallment ? String(account.monthlyInstallment) : String(account.balance || ""));
      setDueDay(account.dueDay ? String(account.dueDay) : "25");
      setReminderEnabled(account.reminderEnabled ?? true);
      setDaysBefore(account.reminderDaysBefore ? String(account.reminderDaysBefore) : "2");

      setCalcPrincipal(account.loanPrincipal ? String(account.loanPrincipal) : String(account.balance || "18500"));
      setCalcRate(account.interestRate ? String(account.interestRate) : "3.2");
      const defaultMonths = account.loanTenureMonths || 60;
      setCalcYears(String(Math.round(defaultMonths / 12) || 5));
      setCalcType(account.type === "loan" && account.name.toLowerCase().includes("house") ? "reducing" : "flat");
    }
  }, [account]);

  const installmentNum = parseFloat(installment) || 0;
  const workHours = amountToWorkHours(installmentNum, wage.hourlyRate);

  // Real-time calculation results
  const principalNum = parseFloat(calcPrincipal.replace(/,/g, "")) || 0;
  const rateNum = parseFloat(calcRate.replace(/,/g, "")) || 0;
  const yearsNum = parseFloat(calcYears) || 5;
  const tenureMonths = Math.max(1, Math.round(yearsNum * 12));

  const calcResult = useMemo(() => {
    return calculateLoanRepayment({
      principal: principalNum,
      interestRate: rateNum,
      tenureMonths,
      type: calcType,
      hourlyRate: wage.hourlyRate,
      currentBalance: account?.balance,
    });
  }, [principalNum, rateNum, tenureMonths, calcType, wage.hourlyRate, account?.balance]);

  const handleApplyCalculated = () => {
    Haptics.selectionAsync().catch(() => {});
    setInstallment(String(calcResult.monthlyInstallment));
    setShowCalculator(false);
  };

  const handleSave = async () => {
    const dayNum = parseInt(dueDay, 10);
    if (!dayNum || dayNum < 1 || dayNum > 31) {
      Alert.alert("Invalid Due Day", "Please enter a day between 1 and 31.");
      return;
    }

    const updated: Account = {
      ...account,
      monthlyInstallment: installmentNum > 0 ? installmentNum : undefined,
      dueDay: dayNum,
      reminderEnabled,
      reminderDaysBefore: parseInt(daysBefore, 10) || 2,
      interestRate: rateNum > 0 ? rateNum : account.interestRate,
      loanPrincipal: principalNum > 0 ? principalNum : account.loanPrincipal,
      loanTenureMonths: tenureMonths > 0 ? tenureMonths : account.loanTenureMonths,
    };

    onSave(updated);
    if (reminderEnabled) {
      await scheduleLoanRepaymentReminder(updated, wage.hourlyRate);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const handleTestNotification = async () => {
    Haptics.selectionAsync().catch(() => {});
    setTestingNotification(true);

    try {
      const res = await triggerNotification(
        `🚗 ${account.name} Reminder`,
        `Your installment of ${rm(installmentNum || 650)} (${workHours.toFixed(1)}h of work) is due on the ${dueDay || 25}th. Keep your Dough safe! 🥟✨`
      );

      if (res.success) {
        Alert.alert(
          "Notification Test Sent! 🔔",
          `${res.message}\n\nA test reminder was pushed to your device. Look out for the Dough banner!`
        );
      } else {
        Alert.alert(
          "Notification Notice",
          `${res.message}\n\nDon't worry! DoughTime will also show in-app reminders right on your dashboard whenever this payment is due.`
        );
      }
    } catch (e: any) {
      Alert.alert("Test Error", e.message || "Failed to trigger test notification.");
    } finally {
      setTestingNotification(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="zen" size={44} interactive={true} />
              <View>
                <Text style={styles.title}>Loan & Repayment Reminder 🔔</Text>
                <Text style={styles.sub}>{account.name}</Text>
              </View>
            </View>
            <Pressable hitSlop={8} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
            {/* Enable Reminder Switch */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.switchLabel}>Monthly Payment Reminder</Text>
                <Text style={styles.switchSub}>Receive notifications & in-app alerts before due date</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(val) => {
                  Haptics.selectionAsync().catch(() => {});
                  setReminderEnabled(val);
                }}
                trackColor={{ false: "#CBD5E1", true: colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* LOAN REPAYMENT DEDUCTION CALCULATOR ACCORDION */}
            <Pressable
              style={styles.calcToggleCard}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setShowCalculator(!showCalculator);
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Text style={{ fontSize: 20 }}>🧮</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calcToggleTitle}>Loan Repayment Deduction Calculator</Text>
                  <Text style={styles.calcToggleSub}>
                    Calculate monthly installment, interest deduction & work time
                  </Text>
                </View>
              </View>
              <Ionicons
                name={showCalculator ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.brandPrimary}
              />
            </Pressable>

            {showCalculator && (
              <View style={styles.calculatorBox}>
                <Text style={styles.calcSectionHeading}>Loan Deduction Parameters</Text>

                {/* Loan Calculation Type */}
                <View style={styles.calcTypeRow}>
                  <Pressable
                    style={[styles.calcTypeBtn, calcType === "flat" && styles.calcTypeBtnActive]}
                    onPress={() => setCalcType("flat")}
                  >
                    <Text style={[styles.calcTypeBtnText, calcType === "flat" && styles.calcTypeBtnTextActive]}>
                      🚗 Flat Rate (Car / Fixed)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.calcTypeBtn, calcType === "reducing" && styles.calcTypeBtnActive]}
                    onPress={() => setCalcType("reducing")}
                  >
                    <Text style={[styles.calcTypeBtnText, calcType === "reducing" && styles.calcTypeBtnTextActive]}>
                      🏡 Reducing (Mortgage / Bank)
                    </Text>
                  </Pressable>
                </View>

                {/* Principal Loan Amount */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Loan Principal / Financing Amount (RM)</Text>
                  <TextInput
                    value={calcPrincipal}
                    onChangeText={setCalcPrincipal}
                    keyboardType="numeric"
                    placeholder="e.g. 50000"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                </View>

                {/* Interest Rate & Tenure Row */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Interest Rate % p.a.</Text>
                    <TextInput
                      value={calcRate}
                      onChangeText={setCalcRate}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 3.2"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Tenure (Years)</Text>
                    <TextInput
                      value={calcYears}
                      onChangeText={setCalcYears}
                      keyboardType="numeric"
                      placeholder="e.g. 5"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      style={styles.input}
                    />
                  </View>
                </View>

                {/* Quick Tenure Pills */}
                <View style={styles.tenurePillsRow}>
                  {["3", "5", "7", "9"].map((yr) => (
                    <Pressable
                      key={yr}
                      style={[styles.tenurePill, calcYears === yr && styles.tenurePillActive]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setCalcYears(yr);
                      }}
                    >
                      <Text style={[styles.tenurePillText, calcYears === yr && styles.tenurePillTextActive]}>
                        {yr} yrs ({parseInt(yr, 10) * 12}m)
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Calculation Breakdown Results Card */}
                <View style={styles.calcResultsCard}>
                  <View style={styles.calcResultHeader}>
                    <Text style={styles.calcResultTitle}>Monthly Repayment Deduction</Text>
                    <Text style={styles.calcMonthlyAmount}>{rm(calcResult.monthlyInstallment)}/mo</Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownCol}>
                      <Text style={styles.breakdownLabel}>Principal Deduction</Text>
                      <Text style={styles.breakdownVal}>{rm(calcResult.monthlyPrincipal)}</Text>
                    </View>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownCol}>
                      <Text style={styles.breakdownLabel}>Interest Deduction</Text>
                      <Text style={[styles.breakdownVal, { color: "#EF4444" }]}>
                        {rm(calcResult.monthlyInterest)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailStatsRow}>
                    <Text style={styles.detailStatText}>
                      Total Interest: <Text style={{ fontWeight: "700" }}>{rm(calcResult.totalInterest)}</Text>
                    </Text>
                    <Text style={styles.detailStatText}>
                      Total Payable: <Text style={{ fontWeight: "700" }}>{rm(calcResult.totalPayable)}</Text>
                    </Text>
                  </View>

                  <View style={styles.lifeCostPill}>
                    <Text style={{ fontSize: 13 }}>⏱️</Text>
                    <Text style={styles.lifeCostText}>
                      Deducts <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{calcResult.workHoursPerMonth} hours</Text> of your work each month
                    </Text>
                  </View>

                  {calcResult.estimatedMonthsRemaining && (
                    <Text style={styles.monthsRemainingText}>
                      🏁 At this rate, debt of {rm(account.balance)} will be cleared in ~{calcResult.estimatedMonthsRemaining} months!
                    </Text>
                  )}

                  <Pressable style={styles.applyCalcBtn} onPress={handleApplyCalculated}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.applyCalcBtnText}>
                      Apply {rm(calcResult.monthlyInstallment)} as Monthly Installment
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {reminderEnabled && (
              <>
                {/* Monthly Installment (RM) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monthly Installment (RM)</Text>
                  <TextInput
                    value={installment}
                    onChangeText={setInstallment}
                    keyboardType="numeric"
                    placeholder="e.g. 650.00"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                  {installmentNum > 0 && (
                    <View style={styles.lifeCostPill}>
                      <Text style={{ fontSize: 13 }}>⏱️</Text>
                      <Text style={styles.lifeCostText}>
                        Trades <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{workHours.toFixed(1)} hours</Text> of your work each month
                      </Text>
                    </View>
                  )}
                </View>

                {/* Due Date (Day of Month) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Due Day of Every Month (1 - 31)</Text>
                  <TextInput
                    value={dueDay}
                    onChangeText={setDueDay}
                    keyboardType="numeric"
                    placeholder="e.g. 25"
                    maxLength={2}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                </View>

                {/* Remind In Advance */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Remind Me in Advance</Text>
                  <View style={styles.daysRow}>
                    {["1", "2", "3", "5"].map((d) => (
                      <Pressable
                        key={d}
                        style={[styles.dayPill, daysBefore === d && styles.dayPillActive]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setDaysBefore(d);
                        }}
                      >
                        <Text style={[styles.dayPillText, daysBefore === d && styles.dayPillTextActive]}>
                          {d} days before
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Test Notification Action */}
                <Pressable
                  style={[styles.testBtn, testingNotification && { opacity: 0.6 }]}
                  disabled={testingNotification}
                  onPress={handleTestNotification}
                >
                  <Ionicons name="notifications" size={16} color={colors.brandPrimary} />
                  <Text style={styles.testBtnText}>
                    {testingNotification ? "Sending Test Alert…" : "Test Live Notification 🔔"}
                  </Text>
                </Pressable>
              </>
            )}

            {/* Quick Action: Deduct Repayment from Bank Now */}
            {onOpenTransfer && (
              <Pressable
                style={styles.deductNowBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onClose();
                  onOpenTransfer(account);
                }}
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.brandPrimary} />
                <Text style={styles.deductNowBtnText}>
                  Deduct Repayment Now from Bank Account 💸
                </Text>
              </Pressable>
            )}
          </ScrollView>

          {/* Save Button */}
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Repayment Settings</Text>
          </Pressable>
        </View>
      </View>
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
    fontSize: 17,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  switchLabel: {
    fontWeight: "700",
    fontSize: 14,
    color: colors.onSurface,
  },
  switchSub: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  calcToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  calcToggleTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  calcToggleSub: {
    fontSize: 10.5,
    color: colors.onSurfaceSecondary,
    fontWeight: "500",
    marginTop: 1,
  },
  calculatorBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginVertical: spacing.sm,
  },
  calcSectionHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  calcTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.sm,
  },
  calcTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcTypeBtnActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  calcTypeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  calcTypeBtnTextActive: {
    color: "#FFFFFF",
  },
  tenurePillsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  tenurePill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tenurePillActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  tenurePillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  tenurePillTextActive: {
    color: "#FFFFFF",
  },
  calcResultsCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  calcResultTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  calcMonthlyAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brandPrimary,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 8,
    marginVertical: 6,
  },
  breakdownCol: {
    flex: 1,
    alignItems: "center",
  },
  breakdownDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  breakdownLabel: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },
  detailStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  detailStatText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  monthsRemainingText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brandPrimary,
    marginTop: 6,
  },
  applyCalcBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: 10,
  },
  applyCalcBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
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
  daysRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dayPillActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  dayPillText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  dayPillTextActive: {
    color: colors.onBrandPrimary,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
  testBtnText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.brandPrimary,
  },
  deductNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  deductNowBtnText: {
    fontWeight: "800",
    fontSize: 12,
    color: colors.brandPrimary,
  },
  saveBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadow.glow,
  },
  saveBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
});
