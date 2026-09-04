import React, { useState, useEffect, useMemo } from "react";
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
import { Account, BudgetBucket, RecurringFrequency, RecurringType, RecurringTxn, WageSettings } from "@/src/types";
import { amountToWorkHours, rm, todayISO } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { AccountSelectDropdown } from "./AccountSelectDropdown";
import {
  addRecurringTxn,
  addTransaction,
  deleteRecurringTxn,
  getRecurringTxns,
  revertRecurringLog,
  setRecurringTxns,
  transferFunds,
  updateRecurringTxn,
} from "@/src/store";

interface Props {
  visible: boolean;
  accounts: Account[];
  wage: WageSettings;
  onClose: () => void;
  onSuccess: () => void;
}

type FilterTab = "all" | "savings" | "needs" | "comfort" | "transfer";

export function RecurringModal({ visible, accounts, wage, onClose, onSuccess }: Props) {
  const [subscriptions, setSubscriptions] = useState<RecurringTxn[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTxn | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // Form state
  const [name, setName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [recurringType, setRecurringType] = useState<RecurringType>("savings");
  const [bucket, setBucket] = useState<BudgetBucket>("savings");
  const [category, setCategory] = useState("Savings");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [note, setNote] = useState("");

  const currentMonth = todayISO().slice(0, 7);

  useEffect(() => {
    if (visible) {
      loadSubscriptions();
    }
  }, [visible]);

  const loadSubscriptions = async () => {
    const list = await getRecurringTxns();
    if (list.length === 0) {
      const defaultAcc = accounts[0]?.id || "";
      const defaults: Omit<RecurringTxn, "id">[] = [
        {
          name: "Travel Fund & Stash",
          amount: 200,
          type: "savings",
          bucket: "savings",
          category: "Savings",
          accountId: defaultAcc,
          frequency: "monthly",
          dayOfMonth: 1,
          enabled: true,
          note: "Monthly travel & goals stash",
        },
        {
          name: "Unifi / Home WiFi",
          amount: 139,
          type: "expense",
          bucket: "needs",
          category: "Telco",
          accountId: defaultAcc,
          frequency: "monthly",
          dayOfMonth: 20,
          enabled: true,
        },
        {
          name: "Netflix",
          amount: 54.9,
          type: "expense",
          bucket: "comfort",
          category: "Subscriptions",
          accountId: defaultAcc,
          frequency: "monthly",
          dayOfMonth: 5,
          enabled: true,
        },
        {
          name: "Spotify Premium",
          amount: 16.9,
          type: "expense",
          bucket: "comfort",
          category: "Subscriptions",
          accountId: defaultAcc,
          frequency: "monthly",
          dayOfMonth: 12,
          enabled: true,
        },
      ];
      const createdList: RecurringTxn[] = [];
      for (const d of defaults) {
        const item = await addRecurringTxn(d);
        createdList.push(item);
      }
      setSubscriptions(createdList);
    } else {
      // Auto-migrate legacy rules (e.g. Travel Fund as subscriptions) to proper savings
      let migrated = false;
      const updatedList = list.map((item) => {
        if (
          (item.name.toLowerCase().includes("travel") || item.name.toLowerCase().includes("saving")) &&
          (!item.type || item.type === "expense") &&
          item.category === "Subscriptions"
        ) {
          migrated = true;
          return {
            ...item,
            type: "savings" as RecurringType,
            bucket: "savings" as BudgetBucket,
            category: "Savings",
          };
        }
        return item;
      });

      if (migrated) {
        await setRecurringTxns(updatedList);
        setSubscriptions(updatedList);
      } else {
        setSubscriptions(list);
      }
    }
  };

  const resetForm = () => {
    setName("");
    setAmountStr("");
    setRecurringType("savings");
    setBucket("savings");
    setCategory("Savings");
    setAccountId(accounts[0]?.id || "");
    setToAccountId("");
    setDayOfMonth("1");
    setFrequency("monthly");
    setNote("");
    setEditingItem(null);
    setShowAdd(false);
  };

  const openAddForm = () => {
    resetForm();
    setShowAdd(true);
  };

  const openEditForm = (item: RecurringTxn) => {
    setEditingItem(item);
    setName(item.name);
    setAmountStr(String(item.amount));
    setRecurringType(item.type || (item.bucket === "savings" ? "savings" : "expense"));
    setBucket(item.bucket || (item.category === "Subscriptions" ? "comfort" : "needs"));
    setCategory(item.category || "Subscriptions");
    setAccountId(item.accountId || accounts[0]?.id || "");
    setToAccountId(item.toAccountId || "");
    setDayOfMonth(String(item.dayOfMonth || 1));
    setFrequency(item.frequency || "monthly");
    setNote(item.note || "");
    setShowAdd(true);
  };

  const handleTypeSelect = (type: RecurringType, targetBucket?: BudgetBucket) => {
    Haptics.selectionAsync().catch(() => {});
    setRecurringType(type);
    if (type === "savings") {
      setBucket("savings");
      setCategory("Savings");
    } else if (type === "transfer") {
      setBucket("needs");
      setCategory("Transfer");
    } else {
      const b = targetBucket || "needs";
      setBucket(b);
      setCategory(b === "comfort" ? "Subscriptions" : "Bills");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Please enter a name for this recurring commitment.");
      return;
    }
    const amt = parseFloat(amountStr.replace(/,/g, "")) || 0;
    if (amt <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }

    const targetAcc = accountId || accounts[0]?.id || "";
    const day = parseInt(dayOfMonth, 10) || 1;
    const clampedDay = Math.min(31, Math.max(1, day));

    if (editingItem) {
      const updated: RecurringTxn = {
        ...editingItem,
        name: name.trim(),
        amount: amt,
        type: recurringType,
        bucket,
        category,
        accountId: targetAcc,
        toAccountId: (recurringType === "savings" || recurringType === "transfer") && toAccountId ? toAccountId : undefined,
        frequency,
        dayOfMonth: clampedDay,
        note: note.trim() || undefined,
      };
      await updateRecurringTxn(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      await addRecurringTxn({
        name: name.trim(),
        amount: amt,
        type: recurringType,
        bucket,
        category,
        accountId: targetAcc,
        toAccountId: (recurringType === "savings" || recurringType === "transfer") && toAccountId ? toAccountId : undefined,
        frequency,
        dayOfMonth: clampedDay,
        enabled: true,
        note: note.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    resetForm();
    await loadSubscriptions();
    onSuccess();
  };

  const handleDelete = (item: RecurringTxn) => {
    const isLoggedThisMonth = item.lastLoggedMonth === currentMonth;

    if (isLoggedThisMonth) {
      Alert.alert(
        `Delete "${item.name}"?`,
        `This recurring rule was logged for ${currentMonth} (${rm(item.amount)}).\n\nDo you want to revert this month's transaction and balance too?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete Rule Only",
            style: "destructive",
            onPress: async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              await deleteRecurringTxn(item.id, false);
              await loadSubscriptions();
              onSuccess();
            },
          },
          {
            text: "Delete & Revert Log",
            style: "destructive",
            onPress: async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              await deleteRecurringTxn(item.id, true);
              await loadSubscriptions();
              onSuccess();
              Alert.alert("Rule Deleted & Reverted", `Removed "${item.name}" and reversed this month's transaction.`);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        `Delete "${item.name}"?`,
        "Are you sure you want to remove this recurring rule?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              await deleteRecurringTxn(item.id, false);
              await loadSubscriptions();
              onSuccess();
            },
          },
        ]
      );
    }
  };

  const handleToggle = async (item: RecurringTxn) => {
    Haptics.selectionAsync().catch(() => {});
    const updated = subscriptions.map((s) => (s.id === item.id ? { ...s, enabled: !s.enabled } : s));
    setSubscriptions(updated);
    await setRecurringTxns(updated);
  };

  const handleUndoSingleLog = (item: RecurringTxn) => {
    Alert.alert(
      `Undo ${currentMonth} Log?`,
      `This will delete the transaction created for "${item.name}" (${rm(item.amount)}) this month and restore your account balance.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo & Restore Balance",
          style: "destructive",
          onPress: async () => {
            const res = await revertRecurringLog(item.id, currentMonth);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await loadSubscriptions();
            onSuccess();
            Alert.alert("Undone! ↩️", res.message);
          },
        },
      ]
    );
  };

  const executeLogItem = async (sub: RecurringTxn) => {
    const isTransfer = sub.type === "transfer" || (sub.type === "savings" && Boolean(sub.toAccountId));

    if (isTransfer && sub.toAccountId && sub.accountId) {
      await transferFunds({
        fromAccountId: sub.accountId,
        toAccountId: sub.toAccountId,
        amount: sub.amount,
        recurringId: sub.id,
        bucket: sub.type === "savings" ? "savings" : undefined,
        note: `[Recurring: ${sub.name}] ${sub.note || "Monthly scheduled transfer"} 🔁`,
        category: sub.type === "savings" ? "Savings" : "Transfer",
        date: todayISO(),
      });
    } else if (sub.type === "savings") {
      await addTransaction({
        amount: sub.amount,
        type: "expense",
        bucket: "savings",
        category: sub.category || "Savings",
        accountId: sub.accountId,
        merchant: sub.name,
        note: `[Recurring: ${sub.name}] Monthly savings & stash 📈`,
        date: todayISO(),
        recurringId: sub.id,
      });
    } else {
      const b: BudgetBucket = sub.bucket || (sub.category === "Subscriptions" ? "comfort" : "needs");
      await addTransaction({
        amount: sub.amount,
        type: "expense",
        bucket: b,
        category: sub.category || "Bills",
        accountId: sub.accountId,
        merchant: sub.name,
        note: `[Recurring: ${sub.name}] ${sub.note || `Monthly ${sub.frequency} bill`} 🔁`,
        date: todayISO(),
        recurringId: sub.id,
      });
    }

    const updated = subscriptions.map((s) =>
      s.id === sub.id ? { ...s, lastLoggedMonth: currentMonth } : s
    );
    await setRecurringTxns(updated);
    await updateRecurringTxn({ ...sub, lastLoggedMonth: currentMonth });
  };

  const handleLogSingleNow = async (item: RecurringTxn) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await executeLogItem(item);
    await loadSubscriptions();
    onSuccess();
    Alert.alert("Logged! ⚡", `Logged "${item.name}" (${rm(item.amount)}) for ${currentMonth}.`);
  };

  const handleLogDueNow = async () => {
    const unlogged = subscriptions.filter((s) => s.enabled && s.lastLoggedMonth !== currentMonth);

    if (unlogged.length === 0) {
      Alert.alert("All Caught Up! ✅", "All active commitments for this month have already been logged.");
      return;
    }

    for (const sub of unlogged) {
      await executeLogItem(sub);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const totalAmt = unlogged.reduce((s, i) => s + i.amount, 0);
    Alert.alert(
      "Commitments Logged! ⚡",
      `Logged ${unlogged.length} items (${rm(totalAmt)}) for ${currentMonth}.`
    );
    onSuccess();
    await loadSubscriptions();
  };

  // Metrics
  const activeSubs = subscriptions.filter((s) => s.enabled);
  const totalMonthlyCommitment = activeSubs.reduce((sum, s) => sum + s.amount, 0);
  const savingsMonthly = activeSubs
    .filter((s) => s.type === "savings" || s.bucket === "savings")
    .reduce((sum, s) => sum + s.amount, 0);
  const needsMonthly = activeSubs
    .filter((s) => s.type !== "savings" && (s.bucket === "needs" || (!s.bucket && s.category !== "Subscriptions")))
    .reduce((sum, s) => sum + s.amount, 0);
  const comfortMonthly = activeSubs
    .filter((s) => s.bucket === "comfort" || (!s.bucket && s.category === "Subscriptions"))
    .reduce((sum, s) => sum + s.amount, 0);

  const totalHours = amountToWorkHours(totalMonthlyCommitment, wage.hourlyRate);
  const unloggedCount = activeSubs.filter((s) => s.lastLoggedMonth !== currentMonth).length;

  const filteredSubscriptions = useMemo(() => {
    if (activeFilter === "all") return subscriptions;
    if (activeFilter === "savings") {
      return subscriptions.filter((s) => s.type === "savings" || s.bucket === "savings");
    }
    if (activeFilter === "needs") {
      return subscriptions.filter((s) => s.type !== "savings" && s.type !== "transfer" && (s.bucket === "needs" || s.category === "Bills" || s.category === "Telco"));
    }
    if (activeFilter === "comfort") {
      return subscriptions.filter((s) => s.bucket === "comfort" || s.category === "Subscriptions");
    }
    if (activeFilter === "transfer") {
      return subscriptions.filter((s) => s.type === "transfer");
    }
    return subscriptions;
  }, [subscriptions, activeFilter]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="mentor" size={38} interactive={false} />
              <View>
                <Text style={styles.headerTitle}>🔁 Recurring & Commitments</Text>
                <Text style={styles.headerSub}>Monthly savings, bills, & auto-transfers</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>TOTAL MONTHLY RECURRING COMMITMENT</Text>
              <Text style={styles.heroAmount}>{rm(totalMonthlyCommitment)}/mo</Text>
              <Text style={styles.heroSub}>
                Costs you <Text style={{ fontWeight: "800" }}>{totalHours.toFixed(1)} hrs</Text> of life energy every month
              </Text>

              {/* Breakdown Pills */}
              <View style={styles.pillsRow}>
                <View style={[styles.pill, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                  <Text style={[styles.pillText, { color: "#065F46" }]}>📈 Stash: {rm(savingsMonthly)}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                  <Text style={[styles.pillText, { color: "#1E40AF" }]}>🍞 Needs: {rm(needsMonthly)}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: "#FDF2F8", borderColor: "#FBCFE8" }]}>
                  <Text style={[styles.pillText, { color: "#9D174D" }]}>🎁 Comfort: {rm(comfortMonthly)}</Text>
                </View>
              </View>

              {/* 1-Tap Log All */}
              <Pressable
                style={[styles.logDueBtn, unloggedCount === 0 && { backgroundColor: "#10B981" }]}
                onPress={handleLogDueNow}
              >
                <Ionicons
                  name={unloggedCount === 0 ? "checkmark-circle" : "flash"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.logDueBtnText}>
                  {unloggedCount === 0
                    ? "All Caught Up for This Month! ✅"
                    : `1-Tap Log ${unloggedCount} Due Commitments ⚡`}
                </Text>
              </Pressable>
            </View>

            {/* Filter Tabs & Add Button */}
            <View style={styles.sectionHeaderRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                <Pressable
                  style={[styles.filterChip, activeFilter === "all" && styles.filterChipActive]}
                  onPress={() => setActiveFilter("all")}
                >
                  <Text style={[styles.filterChipText, activeFilter === "all" && styles.filterChipTextActive]}>
                    All ({subscriptions.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.filterChip, activeFilter === "savings" && styles.filterChipActive]}
                  onPress={() => setActiveFilter("savings")}
                >
                  <Text style={[styles.filterChipText, activeFilter === "savings" && styles.filterChipTextActive]}>
                    📈 Savings
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.filterChip, activeFilter === "needs" && styles.filterChipActive]}
                  onPress={() => setActiveFilter("needs")}
                >
                  <Text style={[styles.filterChipText, activeFilter === "needs" && styles.filterChipTextActive]}>
                    🍞 Bills/Needs
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.filterChip, activeFilter === "comfort" && styles.filterChipActive]}
                  onPress={() => setActiveFilter("comfort")}
                >
                  <Text style={[styles.filterChipText, activeFilter === "comfort" && styles.filterChipTextActive]}>
                    🎁 Comfort
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.filterChip, activeFilter === "transfer" && styles.filterChipActive]}
                  onPress={() => setActiveFilter("transfer")}
                >
                  <Text style={[styles.filterChipText, activeFilter === "transfer" && styles.filterChipTextActive]}>
                    🔄 Transfers
                  </Text>
                </Pressable>
              </ScrollView>

              <Pressable style={styles.addBtnSmall} onPress={showAdd ? resetForm : openAddForm}>
                <Ionicons name={showAdd ? "close" : "add"} size={16} color="#FFFFFF" />
                <Text style={styles.addBtnSmallText}>{showAdd ? "Cancel" : "New"}</Text>
              </Pressable>
            </View>

            {/* Add / Edit Form */}
            {showAdd && (
              <View style={styles.formBox}>
                <Text style={styles.formTitle}>
                  {editingItem ? "✏️ Edit Recurring Rule" : "✨ New Recurring Commitment"}
                </Text>

                {/* Type Selection */}
                <Text style={styles.inputLabel}>Commitment Type & Budget Bucket</Text>
                <View style={styles.typeSelectorRow}>
                  <Pressable
                    style={[
                      styles.typeBtn,
                      recurringType === "savings" && styles.typeBtnActiveSavings,
                    ]}
                    onPress={() => handleTypeSelect("savings")}
                  >
                    <Text style={styles.typeEmoji}>📈</Text>
                    <Text style={[styles.typeBtnText, recurringType === "savings" && styles.typeBtnTextActive]}>
                      Savings / Stash
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.typeBtn,
                      recurringType === "expense" && bucket === "needs" && styles.typeBtnActiveNeeds,
                    ]}
                    onPress={() => handleTypeSelect("expense", "needs")}
                  >
                    <Text style={styles.typeEmoji}>🍞</Text>
                    <Text style={[styles.typeBtnText, recurringType === "expense" && bucket === "needs" && styles.typeBtnTextActive]}>
                      Bills & Needs
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.typeBtn,
                      recurringType === "expense" && bucket === "comfort" && styles.typeBtnActiveComfort,
                    ]}
                    onPress={() => handleTypeSelect("expense", "comfort")}
                  >
                    <Text style={styles.typeEmoji}>🎁</Text>
                    <Text style={[styles.typeBtnText, recurringType === "expense" && bucket === "comfort" && styles.typeBtnTextActive]}>
                      Subscriptions
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.typeBtn,
                      recurringType === "transfer" && styles.typeBtnActiveTransfer,
                    ]}
                    onPress={() => handleTypeSelect("transfer")}
                  >
                    <Text style={styles.typeEmoji}>🔄</Text>
                    <Text style={[styles.typeBtnText, recurringType === "transfer" && styles.typeBtnTextActive]}>
                      Auto-Transfer
                    </Text>
                  </Pressable>
                </View>

                {/* Name & Amount */}
                <Text style={styles.inputLabel}>Name & Monthly Amount</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={
                    recurringType === "savings"
                      ? "e.g. Travel Fund, Emergency Stash, ASNB"
                      : recurringType === "transfer"
                      ? "e.g. Monthly Pocket Money, Account Transfer"
                      : "e.g. Netflix, Unifi WiFi, Gym Membership"
                  }
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      value={amountStr}
                      onChangeText={setAmountStr}
                      placeholder="Amount (RM)"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ width: 110 }}>
                    <TextInput
                      value={dayOfMonth}
                      onChangeText={setDayOfMonth}
                      placeholder="Due Day (1-31)"
                      placeholderTextColor={colors.onSurfaceSecondary}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                </View>

                {/* Account Selection */}
                <View style={{ marginTop: 12 }}>
                  <AccountSelectDropdown
                    label={recurringType === "savings" ? "Deduct / Fund From Account" : "Pay From Account"}
                    value={accountId || accounts[0]?.id}
                    onChange={setAccountId}
                    accounts={accounts}
                    placeholder="Select payment account"
                  />
                </View>

                {(recurringType === "savings" || recurringType === "transfer") && (
                  <View style={{ marginTop: 10 }}>
                    <AccountSelectDropdown
                      label={
                        recurringType === "savings"
                          ? "Transfer Into Account (Optional, e.g. ASNB, Tabung, Stash)"
                          : "Transfer Into Destination Account *"
                      }
                      value={toAccountId}
                      onChange={setToAccountId}
                      accounts={accounts}
                      excludeId={accountId || accounts[0]?.id}
                      placeholder={recurringType === "savings" ? "None (Keep in virtual savings bucket)" : "Select target account"}
                    />
                  </View>
                )}

                {/* Note */}
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>Optional Note</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Notes or reminder details"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />

                {/* Action Buttons */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                  <Pressable style={styles.cancelFormBtn} onPress={resetForm}>
                    <Text style={styles.cancelFormBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.saveFormBtn} onPress={handleSave}>
                    <Text style={styles.saveFormBtnText}>
                      {editingItem ? "Update Commitment" : "Save Commitment"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* List of Recurring Items */}
            <View style={{ marginTop: spacing.sm, gap: 10, paddingBottom: 20 }}>
              {filteredSubscriptions.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No recurring commitments found</Text>
                  <Text style={styles.emptySub}>
                    Tap "+ New" above to schedule monthly savings, fixed bills, or subscriptions.
                  </Text>
                </View>
              ) : (
                filteredSubscriptions.map((sub) => {
                  const fromAcc = accounts.find((a) => a.id === sub.accountId);
                  const destAcc = sub.toAccountId ? accounts.find((a) => a.id === sub.toAccountId) : null;
                  const isLoggedThisMonth = sub.lastLoggedMonth === currentMonth;

                  // Determine display badge
                  const isSavings = sub.type === "savings" || sub.bucket === "savings";
                  const isComfort = sub.bucket === "comfort" || (!sub.bucket && sub.category === "Subscriptions");
                  const isTransfer = sub.type === "transfer";

                  return (
                    <View key={sub.id} style={[styles.subCard, !sub.enabled && { opacity: 0.55 }]}>
                      {/* Top Row: Enable Toggle, Name, Amount */}
                      <View style={styles.subTopRow}>
                        <Pressable onPress={() => handleToggle(sub)} style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                          <Ionicons
                            name={sub.enabled ? "checkmark-circle" : "ellipse-outline"}
                            size={22}
                            color={sub.enabled ? (isSavings ? "#10B981" : colors.brandPrimary) : colors.onSurfaceSecondary}
                          />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Text style={styles.subName}>{sub.name}</Text>
                              <View
                                style={[
                                  styles.typeBadge,
                                  isSavings && { backgroundColor: "#ECFDF5" },
                                  isComfort && { backgroundColor: "#FDF2F8" },
                                  isTransfer && { backgroundColor: "#EFF6FF" },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.typeBadgeText,
                                    isSavings && { color: "#065F46" },
                                    isComfort && { color: "#9D174D" },
                                    isTransfer && { color: "#1E40AF" },
                                  ]}
                                >
                                  {isSavings ? "📈 Savings" : isComfort ? "🎁 Comfort" : isTransfer ? "🔄 Transfer" : "🍞 Needs"}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.subMeta}>
                              Due Day {sub.dayOfMonth}th · {fromAcc?.name || "Primary Account"}
                              {destAcc ? ` ➔ ${destAcc.name}` : ""}
                            </Text>
                          </View>
                        </Pressable>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.subAmount, isSavings && { color: "#059669" }]}>
                            {rm(sub.amount)}
                          </Text>
                          <Text style={styles.subFreq}>/{sub.frequency}</Text>
                        </View>
                      </View>

                      {/* Status Row & Trace Actions */}
                      <View style={styles.subBottomRow}>
                        {isLoggedThisMonth ? (
                          <View style={styles.loggedStatusBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text style={styles.loggedStatusText}>Logged for {currentMonth}</Text>
                          </View>
                        ) : (
                          <View style={styles.pendingStatusBadge}>
                            <Ionicons name="time-outline" size={14} color="#D97706" />
                            <Text style={styles.pendingStatusText}>Due Day {sub.dayOfMonth}th</Text>
                          </View>
                        )}

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          {isLoggedThisMonth ? (
                            <Pressable
                              style={styles.undoBtn}
                              onPress={() => handleUndoSingleLog(sub)}
                              hitSlop={4}
                            >
                              <Ionicons name="arrow-undo-outline" size={13} color="#DC2626" />
                              <Text style={styles.undoBtnText}>Undo Log</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              style={styles.logSingleBtn}
                              onPress={() => handleLogSingleNow(sub)}
                              hitSlop={4}
                            >
                              <Ionicons name="flash-outline" size={13} color="#FFFFFF" />
                              <Text style={styles.logSingleBtnText}>Log Now</Text>
                            </Pressable>
                          )}

                          <Pressable
                            style={styles.iconActionBtn}
                            onPress={() => openEditForm(sub)}
                            hitSlop={6}
                          >
                            <Ionicons name="create-outline" size={16} color={colors.onSurfaceSecondary} />
                          </Pressable>

                          <Pressable
                            style={styles.iconActionBtn}
                            onPress={() => handleDelete(sub)}
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
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
    fontSize: 17,
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
    fontSize: 26,
    fontWeight: "900",
    color: "#701A75",
    marginTop: 2,
  },
  heroSub: {
    fontSize: 12,
    color: "#86198F",
    marginTop: 2,
    textAlign: "center",
  },
  pillsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 10,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: 6,
    gap: 8,
  },
  filterScroll: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  addBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addBtnSmallText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  formBox: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: 8,
    marginBottom: 10,
    ...shadow.soft,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    marginBottom: 4,
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  typeBtnActiveSavings: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  typeBtnActiveNeeds: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  typeBtnActiveComfort: {
    backgroundColor: "#FDF2F8",
    borderColor: "#EC4899",
  },
  typeBtnActiveTransfer: {
    backgroundColor: "#F5F3FF",
    borderColor: "#8B5CF6",
  },
  typeEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  typeBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    textAlign: "center",
  },
  typeBtnTextActive: {
    color: colors.onSurface,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.onSurface,
  },
  cancelFormBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelFormBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  saveFormBtn: {
    flex: 2,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveFormBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  subCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    ...shadow.soft,
  },
  subTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: colors.onSurface,
  },
  typeBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surfaceSecondary,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  subMeta: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  subAmount: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.onSurface,
  },
  subFreq: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
  },
  subBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loggedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  loggedStatusText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#065F46",
  },
  pendingStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingStatusText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#B45309",
  },
  undoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
  },
  logSingleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logSingleBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  emptySub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginTop: 4,
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
