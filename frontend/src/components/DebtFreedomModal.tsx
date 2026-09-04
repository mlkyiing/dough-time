import React, { useState, useMemo } from "react";
import {
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
import { Account, WageSettings } from "@/src/types";
import { amountToWorkHours, rm } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { calculateDebtFreedom, formatFreedomDate } from "@/src/utils/debtFreedom";

interface Props {
  visible: boolean;
  accounts: Account[];
  wage: WageSettings;
  onClose: () => void;
}

export function DebtFreedomModal({ visible, accounts, wage, onClose }: Props) {
  const [extraPaymentStr, setExtraPaymentStr] = useState("150");

  const extraPayment = parseFloat(extraPaymentStr.replace(/,/g, "")) || 0;

  const analysis = useMemo(() => {
    return calculateDebtFreedom(accounts, wage.hourlyRate, extraPayment);
  }, [accounts, wage, extraPayment]);

  const quickExtraOptions = [50, 100, 150, 250, 500];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="mentor" size={38} interactive={false} />
              <View>
                <Text style={styles.headerTitle}>🏔️ Debt-Free Countdown</Text>
                <Text style={styles.headerSub}>Loan payoff & freedom accelerator</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Freedom Hero Card */}
            <View style={styles.freedomHero}>
              <Text style={styles.heroEyebrow}>PROJECTED 100% FREEDOM DATE</Text>
              <Text style={styles.heroDate}>
                {extraPayment > 0 && analysis.monthsSaved > 0
                  ? formatFreedomDate(analysis.acceleratedFreedomDate)
                  : formatFreedomDate(analysis.baseFreedomDate)}
              </Text>
              <Text style={styles.heroSub}>
                {analysis.baseMaxMonths > 0
                  ? `${analysis.baseMaxMonths} months (${(analysis.baseMaxMonths / 12).toFixed(1)} years) of debt freedom countdown`
                  : "Zero active debt! You are 100% financially free! 🎉"}
              </Text>

              {/* Work energy cost */}
              <View style={styles.workHoursBadge}>
                <Ionicons name="hourglass-outline" size={15} color="#DC2626" />
                <Text style={styles.workHoursText}>
                  Total Debt: <Text style={{ fontWeight: "800" }}>{rm(analysis.totalDebt)}</Text> ({analysis.totalDebtWorkHours.toFixed(0)}h work load)
                </Text>
              </View>
            </View>

            {/* Interactive Extra Payment Simulator Card */}
            <View style={styles.simulatorCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={styles.simTitle}>⚡ Accelerated Payoff Simulator</Text>
                  <Text style={styles.simSub}>What if you add a little extra each month?</Text>
                </View>
                <View style={styles.extraInputWrap}>
                  <Text style={styles.currencyPrefix}>+RM</Text>
                  <TextInput
                    value={extraPaymentStr}
                    onChangeText={setExtraPaymentStr}
                    keyboardType="numeric"
                    style={styles.extraInput}
                    placeholder="150"
                  />
                </View>
              </View>

              {/* Quick preset chips */}
              <View style={styles.quickRow}>
                {quickExtraOptions.map((opt) => {
                  const active = extraPayment === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        setExtraPaymentStr(String(opt));
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      style={[styles.quickChip, active && styles.quickChipActive]}
                    >
                      <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                        +{rm(opt)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Simulation Impact Results */}
              {extraPayment > 0 && analysis.monthsSaved > 0 ? (
                <View style={styles.impactBox}>
                  <View style={styles.impactRow}>
                    <View style={styles.impactCol}>
                      <Text style={styles.impactLabel}>Time Reclaimed</Text>
                      <Text style={styles.impactValHighlight}>
                        -{analysis.monthsSaved} Months
                      </Text>
                      <Text style={styles.impactSub}>Earlier freedom!</Text>
                    </View>
                    <View style={styles.impactDivider} />
                    <View style={styles.impactCol}>
                      <Text style={styles.impactLabel}>Interest Saved</Text>
                      <Text style={styles.impactValHighlight}>
                        {rm(analysis.interestSavedRm)}
                      </Text>
                      <Text style={styles.impactSub}>
                        {analysis.workHoursSaved.toFixed(1)}h of life saved!
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.impactCoachTip}>
                    💡 Putting an extra {rm(extraPayment)}/mo saves you from working {analysis.workHoursSaved.toFixed(0)} hours just to pay bank interest!
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Individual Loan Payoff Breakdown */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.sectionTitle}>📋 Active Liabilities (Snowball Payoff)</Text>
              <View style={{ gap: 10, marginTop: 8 }}>
                {analysis.loans.map((loan, idx) => (
                  <View key={loan.account.id} style={styles.loanCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 18 }}>{loan.account.emoji || "🚘"}</Text>
                        <View>
                          <Text style={styles.loanName}>{loan.account.name}</Text>
                          <Text style={styles.loanRate}>
                            {loan.rate.toFixed(2)}% p.a. · {loan.monthsRemaining} months left
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.loanBalance}>{rm(loan.balance)}</Text>
                        <Text style={styles.loanHours}>{loan.workHoursRemaining.toFixed(0)}h work</Text>
                      </View>
                    </View>

                    <View style={styles.loanFooter}>
                      <Text style={styles.loanInstallment}>
                        Monthly Installment: <Text style={{ fontWeight: "700" }}>{rm(loan.monthlyInstallment)}</Text>
                      </Text>
                      <Text style={styles.loanInterestTag}>
                        Est. Interest: {rm(loan.totalInterestRemaining)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Freedom Milestones */}
            <View style={styles.milestoneCard}>
              <Text style={styles.milestoneTitle}>🏆 Freedom Milestones</Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                <View style={styles.milestoneRow}>
                  <Text style={{ fontSize: 16 }}>🎯</Text>
                  <Text style={styles.milestoneText}>
                    First loan knocked down ➔ Redirect its installment to eliminate the next one!
                  </Text>
                </View>
                <View style={styles.milestoneRow}>
                  <Text style={{ fontSize: 16 }}>🎉</Text>
                  <Text style={styles.milestoneText}>
                    100% Debt-Free ➔ Keep all 173 hours of your monthly work energy for yourself!
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close & Stay Focused</Text>
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
  freedomHero: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.soft,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 0.5,
  },
  heroDate: {
    fontSize: 26,
    fontWeight: "900",
    color: "#15803D",
    marginTop: 4,
  },
  heroSub: {
    fontSize: 12,
    color: "#166534",
    marginTop: 2,
  },
  workHoursBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  workHoursText: {
    fontSize: 12,
    color: "#DC2626",
  },
  simulatorCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.soft,
  },
  simTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  simSub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  extraInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  currencyPrefix: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brandPrimary,
    marginRight: 4,
  },
  extraInput: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
    minWidth: 60,
    textAlign: "right",
  },
  quickRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  quickChipTextActive: {
    color: "#FFFFFF",
  },
  impactBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 12,
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  impactCol: {
    flex: 1,
    alignItems: "center",
  },
  impactDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  impactLabel: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  impactValHighlight: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.brandPrimary,
    marginTop: 2,
  },
  impactSub: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  impactCoachTip: {
    fontSize: 11,
    color: colors.onSurface,
    marginTop: 8,
    fontStyle: "italic",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  loanCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  loanName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  loanRate: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  loanBalance: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
  },
  loanHours: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  loanFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loanInstallment: {
    fontSize: 11,
    color: colors.onSurface,
  },
  loanInterestTag: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  milestoneCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  milestoneText: {
    fontSize: 11,
    color: "#78350F",
    flex: 1,
    lineHeight: 16,
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
    ...shadow.glow,
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
