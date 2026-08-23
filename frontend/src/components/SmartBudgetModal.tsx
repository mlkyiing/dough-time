import React, { useState, useEffect, useMemo } from "react";
import {
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
import { Account, AllocationPreset, BudgetSettings, BudgetSourceMode, isAssetAccount, WageSettings } from "@/src/types";
import { amountToWorkHours, rm } from "@/src/format";
import {
  analyzeAccountBudget,
  BUDGET_PRESETS,
} from "../utils/budgetAnalyzer";
import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  visible: boolean;
  budget: BudgetSettings;
  accounts: Account[];
  wage: WageSettings;
  onClose: () => void;
  onSave: (updated: BudgetSettings) => void;
}

export function SmartBudgetModal({
  visible,
  budget,
  accounts,
  wage,
  onClose,
  onSave,
}: Props) {
  const liquidAssetAccounts = useMemo(
    () => accounts.filter((a) => isAssetAccount(a)),
    [accounts]
  );

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<BudgetSourceMode>("liquid_balance");
  const [preset, setPreset] = useState<AllocationPreset>("balanced_50_30_20");
  const [needsLimit, setNeedsLimit] = useState("1300");
  const [comfortLimit, setComfortLimit] = useState("500");
  const [savingsTarget, setSavingsTarget] = useState("200");
  const [isManualEdit, setIsManualEdit] = useState(false);

  useEffect(() => {
    if (visible) {
      const defaultIds =
        budget.selectedAccountIds && budget.selectedAccountIds.length > 0
          ? budget.selectedAccountIds
          : liquidAssetAccounts.map((a) => a.id);
      setSelectedAccountIds(defaultIds);

      const mode = budget.budgetSourceMode || "liquid_balance";
      setSourceMode(mode);

      const p = budget.allocationPreset || "balanced_50_30_20";
      setPreset(p);

      if (budget.needsLimit && budget.comfortLimit && budget.allocationPreset === "custom") {
        setNeedsLimit(String(budget.needsLimit));
        setComfortLimit(String(budget.comfortLimit));
        setSavingsTarget(String(budget.savingsTarget || 0));
        setIsManualEdit(true);
      } else {
        const initialAnalysis = analyzeAccountBudget(accounts, wage, defaultIds, p, mode);
        setNeedsLimit(String(initialAnalysis.recommendedNeeds));
        setComfortLimit(String(initialAnalysis.recommendedComfort));
        setSavingsTarget(String(initialAnalysis.recommendedSavings));
        setIsManualEdit(false);
      }
    }
  }, [visible, budget, liquidAssetAccounts, accounts, wage]);

  const analysis = useMemo(() => {
    return analyzeAccountBudget(accounts, wage, selectedAccountIds, preset, sourceMode);
  }, [accounts, wage, selectedAccountIds, preset, sourceMode]);

  const switchSourceMode = (newMode: BudgetSourceMode) => {
    setSourceMode(newMode);
    setIsManualEdit(false);
    const newAnalysis = analyzeAccountBudget(accounts, wage, selectedAccountIds, preset, newMode);
    setNeedsLimit(String(newAnalysis.recommendedNeeds));
    setComfortLimit(String(newAnalysis.recommendedComfort));
    setSavingsTarget(String(newAnalysis.recommendedSavings));
    Haptics.selectionAsync().catch(() => {});
  };

  // When preset or accounts change, auto-fill recommended limits unless in manual edit mode
  const applyPresetAllocation = (newPreset: AllocationPreset) => {
    setPreset(newPreset);
    setIsManualEdit(false);
    const newAnalysis = analyzeAccountBudget(accounts, wage, selectedAccountIds, newPreset, sourceMode);
    setNeedsLimit(String(newAnalysis.recommendedNeeds));
    setComfortLimit(String(newAnalysis.recommendedComfort));
    setSavingsTarget(String(newAnalysis.recommendedSavings));
    Haptics.selectionAsync().catch(() => {});
  };

  const toggleAccount = (accId: string) => {
    let next: string[];
    if (selectedAccountIds.includes(accId)) {
      next = selectedAccountIds.filter((id) => id !== accId);
    } else {
      next = [...selectedAccountIds, accId];
    }
    setSelectedAccountIds(next);
    if (!isManualEdit) {
      const newAnalysis = analyzeAccountBudget(accounts, wage, next, preset, sourceMode);
      setNeedsLimit(String(newAnalysis.recommendedNeeds));
      setComfortLimit(String(newAnalysis.recommendedComfort));
      setSavingsTarget(String(newAnalysis.recommendedSavings));
    }
    Haptics.selectionAsync().catch(() => {});
  };

  const numNeeds = parseFloat(needsLimit) || 0;
  const numComfort = parseFloat(comfortLimit) || 0;
  const numSavings = parseFloat(savingsTarget) || 0;
  const totalOverallBudget = numNeeds + numComfort;

  const needsHours = amountToWorkHours(numNeeds, wage.hourlyRate);
  const comfortHours = amountToWorkHours(numComfort, wage.hourlyRate);
  const savingsHours = amountToWorkHours(numSavings, wage.hourlyRate);
  const totalHours = amountToWorkHours(totalOverallBudget, wage.hourlyRate);

  const handleSave = () => {
    const updated: BudgetSettings = {
      ...budget,
      monthlyOverallLimit: totalOverallBudget,
      budgetSourceMode: sourceMode,
      needsLimit: numNeeds,
      comfortLimit: numComfort,
      savingsTarget: numSavings,
      selectedAccountIds,
      allocationPreset: isManualEdit ? "custom" : preset,
      enabled: true,
    };
    onSave(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AnimatedMascot variant="rich" size={44} interactive={true} />
              <View>
                <Text style={styles.title}>Smart Life Budgeting</Text>
                <Text style={styles.subtitle}>
                  Must-Haves & Guilt-Free "Nonsense" Money 🎁
                </Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Budget Source Mode Toggle */}
            <View style={styles.modeToggleContainer}>
              <Text style={styles.modeToggleHeading}>Budget Base Source:</Text>
              <View style={styles.modeToggleWrap}>
                <Pressable
                  style={[styles.modeToggleBtn, sourceMode === "liquid_balance" && styles.modeToggleBtnActive]}
                  onPress={() => switchSourceMode("liquid_balance")}
                >
                  <Text style={[styles.modeToggleText, sourceMode === "liquid_balance" && styles.modeToggleTextActive]}>
                    🏦 Liquid Accounts Cash
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeToggleBtn, sourceMode === "salary" && styles.modeToggleBtnActive]}
                  onPress={() => switchSourceMode("salary")}
                >
                  <Text style={[styles.modeToggleText, sourceMode === "salary" && styles.modeToggleTextActive]}>
                    💼 Monthly Salary (Net)
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Account Liquidity & Commitments Card */}
            <View style={styles.liquidityCard}>
              <View style={styles.liquidityHeader}>
                <Text style={styles.sectionHeaderTitle}>
                  {sourceMode === "liquid_balance" ? "🏦 Active Spending Pool" : "💼 Monthly Income & Fixed Outflows"}
                </Text>
                <Text style={styles.liquiditySub}>
                  {sourceMode === "liquid_balance" ? "Tap accounts to fund pool" : "Based on salary & loan dues"}
                </Text>
              </View>

              {/* Account chips (shown when liquid_balance mode) */}
              {sourceMode === "liquid_balance" && (
                <View style={styles.accountChipsRow}>
                  {liquidAssetAccounts.map((acc) => {
                    const active = selectedAccountIds.includes(acc.id);
                    return (
                      <Pressable
                        key={acc.id}
                        style={[styles.accountChip, active && styles.accountChipActive]}
                        onPress={() => toggleAccount(acc.id)}
                      >
                        <Text style={{ fontSize: 16 }}>{acc.emoji}</Text>
                        <Text
                          style={[styles.accountChipText, active && styles.accountChipTextActive]}
                          numberOfLines={1}
                        >
                          {acc.name}
                        </Text>
                        <Text
                          style={[styles.accountChipBal, active && styles.accountChipBalActive]}
                        >
                          {rm(acc.balance)}
                        </Text>
                        <Ionicons
                          name={active ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={active ? colors.brandPrimary : colors.onSurfaceSecondary}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Cash Analysis summary */}
              <View style={styles.cashAnalysisRow}>
                {sourceMode === "liquid_balance" ? (
                  <>
                    <View style={styles.cashStat}>
                      <Text style={styles.cashStatLabel}>Liquid Cash Pool</Text>
                      <Text style={styles.cashStatVal}>+{rm(analysis.totalLiquidBalance)}</Text>
                    </View>
                    <View style={styles.cashStatDivider} />
                    <View style={styles.cashStat}>
                      <Text style={styles.cashStatLabel}>Safe Spendable Pool</Text>
                      <Text style={styles.cashStatNet}>
                        {rm(analysis.effectiveSpendableBudget)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.cashStat}>
                      <Text style={styles.cashStatLabel}>Monthly Salary</Text>
                      <Text style={styles.cashStatVal}>+{rm(analysis.monthlyIncome)}</Text>
                    </View>
                    {analysis.committedLiabilities > 0 && (
                      <>
                        <View style={styles.cashStatDivider} />
                        <View style={styles.cashStat}>
                          <Text style={styles.cashStatLabel}>Loan Dues</Text>
                          <Text style={styles.cashStatDebt}>-{rm(analysis.committedLiabilities)}</Text>
                        </View>
                      </>
                    )}
                    <View style={styles.cashStatDivider} />
                    <View style={styles.cashStat}>
                      <Text style={styles.cashStatLabel}>Net Spendable Pool</Text>
                      <Text style={styles.cashStatNet}>
                        {rm(analysis.effectiveSpendableBudget)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Strategy Allocation Presets */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 Budget Strategy Presets</Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                {BUDGET_PRESETS.map((p) => {
                  const active = preset === p.id && !isManualEdit;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.presetCard, active && styles.presetCardActive]}
                      onPress={() => applyPresetAllocation(p.id)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.presetTitle, active && styles.presetTitleActive]}>
                            {p.title}
                          </Text>
                          <Text style={styles.presetDesc}>{p.desc}</Text>
                        </View>
                        <Ionicons
                          name={active ? "radio-button-on" : "radio-button-off"}
                          size={18}
                          color={active ? colors.brandPrimary : colors.onSurfaceSecondary}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Segregated Budget Breakdown & Fine-Tuning */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>💰 Segregated Budget Breakdown</Text>
                {isManualEdit && (
                  <Pressable onPress={() => applyPresetAllocation(preset)}>
                    <Text style={styles.resetPresetText}>Reset to Preset</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.budgetBucketsContainer}>
                {/* 1. Must-Haves & Needs */}
                <View style={[styles.bucketCard, { borderLeftColor: "#3B82F6" }]}>
                  <View style={styles.bucketHeader}>
                    <View style={styles.bucketTitleWrap}>
                      <Text style={{ fontSize: 22 }}>🍞</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.bucketTitle} numberOfLines={1}>Must-Haves & Needs</Text>
                        <Text style={styles.bucketSub} numberOfLines={1}>Groceries, Petrol, Makan, Bills, Tolls</Text>
                      </View>
                    </View>
                    <View style={styles.bucketHoursPill}>
                      <Text style={styles.bucketHoursText}>{needsHours.toFixed(1)}h work</Text>
                    </View>
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.currencyPrefix}>RM</Text>
                    <TextInput
                      style={styles.bucketInput}
                      value={needsLimit}
                      onChangeText={(val) => {
                        setNeedsLimit(val);
                        setIsManualEdit(true);
                      }}
                      keyboardType="numeric"
                      placeholder="1300"
                      placeholderTextColor={colors.onSurfaceSecondary}
                    />
                  </View>
                </View>

                {/* 2. Guilt-Free Comfort & "Nonsense" Money */}
                <View style={[styles.bucketCard, styles.comfortCard, { borderLeftColor: "#EC4899" }]}>
                  <View style={styles.bucketHeader}>
                    <View style={styles.bucketTitleWrap}>
                      <Text style={{ fontSize: 22 }}>🎁</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.bucketTitle, { color: "#9D174D" }]} numberOfLines={1}>
                          Guilt-Free Comfort & "Nonsense" ✨
                        </Text>
                        <Text style={styles.bucketSub} numberOfLines={1}>
                          Special Treats
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.bucketHoursPill, { backgroundColor: "#FCE7F3" }]}>
                      <Text style={[styles.bucketHoursText, { color: "#BE185D" }]}>
                        {comfortHours.toFixed(1)}h work
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.comfortEncouragement}>
                    🌟 Designed to let you treat yourself without guilt or overspending!
                  </Text>
                  <View style={styles.inputWrap}>
                    <Text style={[styles.currencyPrefix, { color: "#BE185D" }]}>RM</Text>
                    <TextInput
                      style={[styles.bucketInput, { color: "#9D174D" }]}
                      value={comfortLimit}
                      onChangeText={(val) => {
                        setComfortLimit(val);
                        setIsManualEdit(true);
                      }}
                      keyboardType="numeric"
                      placeholder="500"
                      placeholderTextColor={colors.onSurfaceSecondary}
                    />
                  </View>
                </View>

                {/* 3. Rainy Day & Savings Stash */}
                <View style={[styles.bucketCard, { borderLeftColor: "#10B981" }]}>
                  <View style={styles.bucketHeader}>
                    <View style={styles.bucketTitleWrap}>
                      <Text style={{ fontSize: 22 }}>📈</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.bucketTitle} numberOfLines={1}>Protected Savings / Stash</Text>
                        <Text style={styles.bucketSub} numberOfLines={1}>Emergency stash, FD, Investments</Text>
                      </View>
                    </View>
                    <View style={[styles.bucketHoursPill, { backgroundColor: "#DCFCE7" }]}>
                      <Text style={[styles.bucketHoursText, { color: "#047857" }]}>
                        {savingsHours.toFixed(1)}h work
                      </Text>
                    </View>
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.currencyPrefix}>RM</Text>
                    <TextInput
                      style={styles.bucketInput}
                      value={savingsTarget}
                      onChangeText={(val) => {
                        setSavingsTarget(val);
                        setIsManualEdit(true);
                      }}
                      keyboardType="numeric"
                      placeholder="200"
                      placeholderTextColor={colors.onSurfaceSecondary}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Total Spending Ceiling Summary Box */}
            <View style={styles.totalSummaryCard}>
              <View style={styles.totalSummaryRow}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                  <Text style={styles.totalSummaryLabel}>Total Monthly Spending Ceiling</Text>
                  <Text style={styles.totalSummaryHours}>
                    Equals {totalHours.toFixed(1)}h ({(totalHours / 8).toFixed(1)} workdays) of life energy
                  </Text>
                </View>
                <View style={{ flexShrink: 0, alignItems: "flex-end" }}>
                  <Text style={styles.totalSummaryVal}>{rm(totalOverallBudget)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.88 }]}
              onPress={handleSave}
            >
              <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.saveBtnText}>Save & Apply Smart Budget</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingTop: spacing.lg,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  modeToggleContainer: {
    gap: 6,
  },
  modeToggleHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  modeToggleWrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    padding: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 4,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  modeToggleBtnActive: {
    backgroundColor: colors.brandPrimary,
    ...shadow.soft,
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  modeToggleTextActive: {
    color: "#FFFFFF",
  },
  liquidityCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 10,
  },
  liquidityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  liquiditySub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  accountChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  accountChipActive: {
    backgroundColor: "#FDF2F8",
    borderColor: colors.brandPrimary,
  },
  accountChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  accountChipTextActive: {
    color: colors.brandPrimary,
  },
  accountChipBal: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  accountChipBalActive: {
    color: colors.brandPrimary,
  },
  cashAnalysisRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radius.md,
  },
  cashStat: {
    flex: 1,
    gap: 2,
    alignItems: "center",
  },
  cashStatLabel: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  cashStatVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  cashStatDebt: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
  },
  cashStatNet: {
    fontSize: 13,
    fontWeight: "800",
    color: "#10B981",
  },
  cashStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderStrong,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resetPresetText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  presetCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  presetCardActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: "#FDF2F8",
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  presetTitleActive: {
    color: colors.brandPrimary,
  },
  presetDesc: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  budgetBucketsContainer: {
    gap: 10,
    marginTop: 4,
  },
  bucketCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderLeftWidth: 5,
    gap: 8,
  },
  comfortCard: {
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
  },
  bucketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bucketTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  bucketTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  bucketSub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  bucketHoursPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  bucketHoursText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  comfortEncouragement: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BE185D",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    marginRight: 6,
  },
  bucketInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  totalSummaryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  totalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalSummaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  totalSummaryHours: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  totalSummaryVal: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.onSurface,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? 34 : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    ...shadow.glow,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onBrandPrimary,
  },
});
