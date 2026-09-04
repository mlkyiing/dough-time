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
import { Account, PaydayAllocationItem, PaydayPlan, WageSettings, isAssetAccount, isLiabilityAccount } from "@/src/types";
import { amountToWorkHours, rm, todayISO } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { executePaydayPlan, getPaydayPlan, setPaydayPlan } from "@/src/store";
import { AccountSelectDropdown } from "./AccountSelectDropdown";

interface Props {
  visible: boolean;
  accounts: Account[];
  wage: WageSettings;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaydaySplitModal({ visible, accounts, wage, onClose, onSuccess }: Props) {
  const [plan, setPlan] = useState<PaydayPlan | null>(null);
  const [sourceAccId, setSourceAccId] = useState<string>("");
  const [salaryStr, setSalaryStr] = useState<string>("");
  const [items, setItems] = useState<PaydayAllocationItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Quick item adding state
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"loan" | "savings" | "allowance">("allowance");
  const [newTargetId, setNewTargetId] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPlan();
    }
  }, [visible, accounts, wage]);

  const loadPlan = async () => {
    const existing = await getPaydayPlan();
    const defaultSource =
      existing?.sourceAccountId ||
      accounts.find((a) => a.type === "bank")?.id ||
      accounts[0]?.id ||
      "";

    setSourceAccId(defaultSource);
    const sal = existing?.salaryAmount || wage.monthlySalary || 4268.2;
    setSalaryStr(String(sal));

    if (existing && existing.items.length > 0) {
      setPlan(existing);
      setItems(existing.items);
    } else {
      // Auto-generate sensible default Malaysian payday template from user's loans
      const autoItems: PaydayAllocationItem[] = [];
      const loans = accounts.filter(isLiabilityAccount);
      for (const l of loans) {
        if (l.monthlyInstallment && l.monthlyInstallment > 0) {
          autoItems.push({
            id: `auto_${l.id}`,
            title: l.name,
            type: "loan",
            targetAccountId: l.id,
            amount: l.monthlyInstallment,
            enabled: true,
            note: `Monthly repayment for ${l.name}`,
          });
        }
      }

      // Add family allowance default
      autoItems.push({
        id: "auto_parents",
        title: "Parents Allowance 👨‍👩‍👧",
        type: "allowance",
        amount: 600,
        category: "Other",
        enabled: true,
        note: "Monthly allowance for parents",
      });

      // Add emergency stash
      const fd = accounts.find((a) => a.type === "fd" || a.name.toLowerCase().includes("asnb") || a.name.toLowerCase().includes("tabung"));
      if (fd) {
        autoItems.push({
          id: `auto_${fd.id}`,
          title: `Stash into ${fd.name} 📈`,
          type: "savings",
          targetAccountId: fd.id,
          amount: 300,
          enabled: true,
          note: `Monthly savings stash into ${fd.name}`,
        });
      }

      const defaultPlan: PaydayPlan = {
        sourceAccountId: defaultSource,
        paydayDayOfMonth: 28,
        salaryAmount: sal,
        items: autoItems,
        enabled: true,
      };
      setPlan(defaultPlan);
      setItems(autoItems);
    }
  };

  const salaryNum = parseFloat(salaryStr.replace(/,/g, "")) || 0;
  const totalAllocated = items
    .filter((i) => i.enabled)
    .reduce((s, i) => s + (i.amount || 0), 0);
  const leftoverDough = salaryNum - totalAllocated;
  const leftoverHours = amountToWorkHours(leftoverDough, wage.hourlyRate);

  const toggleItem = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    );
  };

  const removeItem = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddItem = () => {
    if (!newTitle.trim()) return;
    const amt = parseFloat(newAmount.replace(/,/g, "")) || 0;
    if (amt <= 0) return;

    const newItem: PaydayAllocationItem = {
      id: `item_${Date.now()}`,
      title: newTitle.trim(),
      type: newType,
      amount: amt,
      targetAccountId: newTargetId || undefined,
      category: newType === "loan" ? "Loan / Debt" : newType === "savings" ? "Investment" : "Other",
      enabled: true,
    };

    setItems((prev) => [...prev, newItem]);
    setNewTitle("");
    setNewAmount("");
    setNewTargetId("");
    setShowAddForm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSavePlanOnly = async () => {
    const updatedPlan: PaydayPlan = {
      sourceAccountId: sourceAccId,
      paydayDayOfMonth: plan?.paydayDayOfMonth || 28,
      salaryAmount: salaryNum,
      items,
      enabled: true,
    };
    await setPaydayPlan(updatedPlan);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert("Plan Saved 💾", "Your Payday Auto-Splitter configuration has been saved.");
    onClose();
  };

  const handleExecute = () => {
    if (!sourceAccId) {
      Alert.alert("Source Account Missing", "Please pick your salary deposit bank account.");
      return;
    }

    const doExec = async () => {
      setIsExecuting(true);
      try {
        const planToExec: PaydayPlan = {
          sourceAccountId: sourceAccId,
          paydayDayOfMonth: plan?.paydayDayOfMonth || 28,
          salaryAmount: salaryNum,
          items,
          enabled: true,
        };
        const res = await executePaydayPlan(planToExec, todayISO());
        if (res.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Alert.alert("Payday Allocated! 🎉", `Successfully distributed ${rm(totalAllocated)}! Safe living dough: ${rm(leftoverDough)}.`);
          onSuccess();
          onClose();
        } else {
          Alert.alert("Error", res.message);
        }
      } catch (e: any) {
        Alert.alert("Execution Error", e.message);
      } finally {
        setIsExecuting(false);
      }
    };

    const confirmMsg = `This will record your Salary deposit of ${rm(salaryNum)}, pay your loans, allowances, and transfer savings for this month (${rm(totalAllocated)} total).\n\nProceed?`;

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(confirmMsg) : true;
      if (ok) doExec();
      return;
    }

    Alert.alert("Execute Payday Split? ⚡", confirmMsg, [
      { text: "Cancel", style: "cancel" },
      { text: "Execute Now! 🚀", onPress: doExec },
    ]);
  };

  const sourceAccount = accounts.find((a) => a.id === sourceAccId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="rich" size={40} interactive={false} />
              <View>
                <Text style={styles.headerTitle}>⚡ Payday Auto-Splitter</Text>
                <Text style={styles.headerSub}>One-tap salary & loan distribution</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* 1. Salary Inflow Hero Card */}
            <View style={styles.salaryCard}>
              <Text style={styles.sectionLabel}>1. SALARY INFLOW</Text>
              <View style={styles.salaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.salaryTitle}>Monthly Net Salary</Text>
                  <Text style={styles.salarySub}>Deposited into your primary bank</Text>
                </View>
                <View style={styles.salaryInputWrap}>
                  <Text style={styles.currencyPrefix}>RM</Text>
                  <TextInput
                    value={salaryStr}
                    onChangeText={setSalaryStr}
                    keyboardType="decimal-pad"
                    style={styles.salaryInput}
                    placeholder="4268.20"
                  />
                </View>
              </View>

              {/* Source Account Selector */}
              <View style={{ marginTop: spacing.sm }}>
                <AccountSelectDropdown
                  label="Salary Deposit Account"
                  value={sourceAccId}
                  onChange={setSourceAccId}
                  accounts={accounts.filter(isAssetAccount)}
                  modalTitle="Select Salary Deposit Account"
                />
              </View>
            </View>

            {/* Arrow Divider */}
            <View style={styles.arrowWrap}>
              <Ionicons name="arrow-down" size={18} color={colors.brandPrimary} />
            </View>

            {/* 2. Automated Allocations */}
            <View style={styles.allocSection}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
                <Text style={styles.sectionLabel}>2. PAYDAY AUTO-ALLOCATIONS</Text>
                <Pressable onPress={() => setShowAddForm(!showAddForm)}>
                  <Text style={styles.addLinkText}>{showAddForm ? "Cancel" : "+ Add Item"}</Text>
                </Pressable>
              </View>

              {/* Inline Add Item Form */}
              {showAddForm && (
                <View style={styles.addFormBox}>
                  <TextInput
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="Title (e.g. Parents, ASNB, Netflix)"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.formInput}
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <TextInput
                      value={newAmount}
                      onChangeText={setNewAmount}
                      placeholder="Amount (RM)"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      keyboardType="decimal-pad"
                      style={[styles.formInput, { flex: 1 }]}
                    />
                    <Pressable
                      style={[styles.typeBtn, newType === "loan" && styles.typeBtnActive]}
                      onPress={() => setNewType("loan")}
                    >
                      <Text style={styles.typeBtnText}>Loan</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.typeBtn, newType === "savings" && styles.typeBtnActive]}
                      onPress={() => setNewType("savings")}
                    >
                      <Text style={styles.typeBtnText}>Savings</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.typeBtn, newType === "allowance" && styles.typeBtnActive]}
                      onPress={() => setNewType("allowance")}
                    >
                      <Text style={styles.typeBtnText}>Other</Text>
                    </Pressable>
                  </View>

                  {(newType === "loan" || newType === "savings") && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
                      {accounts
                        .filter((a) => (newType === "loan" ? isLiabilityAccount(a) : isAssetAccount(a)))
                        .map((a) => (
                          <Pressable
                            key={a.id}
                            onPress={() => setNewTargetId(a.id)}
                            style={[styles.targetChip, newTargetId === a.id && styles.targetChipActive]}
                          >
                            <Text style={{ fontSize: 13 }}>{a.emoji}</Text>
                            <Text style={styles.targetChipText}>{a.name}</Text>
                          </Pressable>
                        ))}
                    </ScrollView>
                  )}

                  <Pressable style={styles.confirmAddBtn} onPress={handleAddItem}>
                    <Text style={styles.confirmAddBtnText}>Add to Payday Split</Text>
                  </Pressable>
                </View>
              )}

              {/* Items List */}
              <View style={{ gap: 8 }}>
                {items.map((item) => {
                  const targetAcc = accounts.find((a) => a.id === item.targetAccountId);
                  const icon = item.type === "loan" ? "🚘" : item.type === "savings" ? "📈" : "🎁";
                  return (
                    <View key={item.id} style={[styles.itemCard, !item.enabled && { opacity: 0.5 }]}>
                      <Pressable onPress={() => toggleItem(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <Ionicons
                          name={item.enabled ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={item.enabled ? colors.brandPrimary : colors.onSurfaceSecondary}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 16 }}>{icon}</Text>
                            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                          </View>
                          <Text style={styles.itemSub} numberOfLines={1}>
                            {targetAcc ? `Transfer to ${targetAcc.name}` : item.note || "Payday allocation"}
                          </Text>
                        </View>
                      </Pressable>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.itemAmount}>{rm(item.amount)}</Text>
                        <Pressable hitSlop={6} onPress={() => removeItem(item.id)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Arrow Divider */}
            <View style={styles.arrowWrap}>
              <Ionicons name="arrow-down" size={18} color={colors.brandPrimary} />
            </View>

            {/* 3. Leftover Living Dough Box */}
            <View style={[styles.leftoverBox, leftoverDough < 0 && { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leftoverTitle}>🥟 Leftover Safe-to-Spend Dough</Text>
                  <Text style={styles.leftoverSub}>
                    {leftoverDough >= 0
                      ? `Guilt-free living allowance for the month (${leftoverHours.toFixed(1)}h of life energy)`
                      : "Allocations exceed salary! Consider reducing amounts."}
                  </Text>
                </View>
                <Text style={[styles.leftoverVal, leftoverDough < 0 && { color: "#DC2626" }]}>
                  {rm(leftoverDough)}
                </Text>
              </View>
            </View>

            {/* Summary details */}
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryText}>
                Salary: <Text style={{ fontWeight: "700" }}>{rm(salaryNum)}</Text> · Allocated: <Text style={{ fontWeight: "700", color: "#EF4444" }}>-{rm(totalAllocated)}</Text> · Living Dough: <Text style={{ fontWeight: "700", color: "#059669" }}>{rm(leftoverDough)}</Text>
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable style={styles.saveOnlyBtn} onPress={handleSavePlanOnly}>
              <Text style={styles.saveOnlyBtnText}>Save Template</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.executeBtn, (pressed || isExecuting) && { opacity: 0.85 }]}
              onPress={handleExecute}
              disabled={isExecuting}
            >
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={styles.executeBtnText}>
                {isExecuting ? "Executing..." : "Execute Payday Split 🚀"}
              </Text>
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brandPrimary,
    letterSpacing: 0.5,
  },
  salaryCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  salaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  salaryTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  salarySub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  salaryInputWrap: {
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
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    marginRight: 4,
  },
  salaryInput: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.onSurface,
    minWidth: 90,
    textAlign: "right",
  },
  inputSubLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  accountChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: colors.brandPrimary,
  },
  accountChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurface,
  },
  accountChipTextActive: {
    color: colors.brandPrimary,
    fontWeight: "800",
  },
  arrowWrap: {
    alignItems: "center",
    paddingVertical: 6,
  },
  allocSection: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  addLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  addFormBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.onSurface,
  },
  typeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  typeBtnActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurface,
  },
  targetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  targetChipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: "#EEF2FF",
  },
  targetChipText: {
    fontSize: 11,
    color: colors.onSurface,
  },
  confirmAddBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 8,
  },
  confirmAddBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  itemSub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EF4444",
  },
  leftoverBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  leftoverTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#065F46",
  },
  leftoverSub: {
    fontSize: 11,
    color: "#047857",
    marginTop: 2,
  },
  leftoverVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#059669",
    marginLeft: 8,
  },
  summaryStrip: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  summaryText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveOnlyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveOnlyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  executeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...shadow.glow,
  },
  executeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
