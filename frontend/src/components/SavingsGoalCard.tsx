import React, { useState } from "react";
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
import { Account, SavingsGoal, WageSettings } from "@/src/types";
import { amountToWorkHours, rm } from "@/src/format";
import { AccountSelectDropdown } from "./AccountSelectDropdown";

interface Props {
  goals: SavingsGoal[];
  accounts: Account[];
  wage: WageSettings;
  onAddGoal: (goal: Omit<SavingsGoal, "id">) => Promise<void>;
  onUpdateGoal: (goal: SavingsGoal) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
  onQuickStash: (goal: SavingsGoal, amount: number) => void;
}

const PRESET_ICONS = ["✈️", "🏝️", "🚗", "🏠", "💻", "🛡️", "💍", "🎓", "🎉", "💰"];

export function SavingsGoalCard({
  goals,
  accounts,
  wage,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onQuickStash,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [targetAmountStr, setTargetAmountStr] = useState("");
  const [accountId, setAccountId] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [notes, setNotes] = useState("");

  const openAdd = () => {
    Haptics.selectionAsync().catch(() => {});
    setEditingGoal(null);
    setTitle("");
    setTargetAmountStr("");
    // Find travel or savings account as default
    const travelAcc = accounts.find((a) =>
      a.name.toLowerCase().match(/travel|savings|stash|fund|tabung/)
    );
    setAccountId(travelAcc?.id || accounts[0]?.id || "");
    setEmoji("✈️");
    setNotes("");
    setModalVisible(true);
  };

  const openEdit = (g: SavingsGoal) => {
    Haptics.selectionAsync().catch(() => {});
    setEditingGoal(g);
    setTitle(g.title);
    setTargetAmountStr(String(g.targetAmount));
    setAccountId(g.accountId || "");
    setEmoji(g.emoji || "✈️");
    setNotes(g.notes || "");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Name", "Please enter a name for your savings goal.");
      return;
    }
    const target = parseFloat(targetAmountStr.replace(/,/g, "")) || 0;
    if (target <= 0) {
      Alert.alert("Invalid Target", "Please enter a target amount greater than 0.");
      return;
    }

    if (editingGoal) {
      await onUpdateGoal({
        ...editingGoal,
        title: title.trim(),
        targetAmount: target,
        accountId: accountId || undefined,
        emoji,
        notes: notes.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      await onAddGoal({
        title: title.trim(),
        targetAmount: target,
        accountId: accountId || undefined,
        emoji,
        notes: notes.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    setModalVisible(false);
  };

  const handleDelete = (g: SavingsGoal) => {
    Alert.alert(
      `Delete "${g.title}"?`,
      "Are you sure you want to remove this savings goal? Your account balances won't be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            await onDeleteGoal(g.id);
            setModalVisible(false);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.sectionTitle}>🎯 Sinking Funds & Savings Goals</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd} hitSlop={8}>
          <Ionicons name="add" size={15} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New Goal</Text>
        </Pressable>
      </View>

      {goals.length === 0 ? (
        <Pressable style={styles.emptyCard} onPress={openAdd}>
          <Text style={{ fontSize: 26, marginBottom: 4 }}>✈️</Text>
          <Text style={styles.emptyTitle}>Start a Travel or Savings Goal</Text>
          <Text style={styles.emptySub}>
            Track funds like "Travel 2026", "Emergency Fund", or "Holiday Stash" with live account balances.
          </Text>
          <View style={styles.emptyActionPill}>
            <Ionicons name="sparkles" size={13} color={colors.brandPrimary} />
            <Text style={styles.emptyActionText}>Create Travel Fund Goal</Text>
          </View>
        </Pressable>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {goals.map((g) => {
            // Live account balance if linked, else goal.currentAmount
            const linkedAcc = accounts.find((a) => a.id === g.accountId);
            const current = linkedAcc ? Math.max(0, linkedAcc.balance) : (g.currentAmount || 0);
            const pct = g.targetAmount > 0 ? Math.min(100, Math.round((current / g.targetAmount) * 100)) : 0;
            const remaining = Math.max(0, g.targetAmount - current);
            const remainingHours = amountToWorkHours(remaining, wage.hourlyRate);
            const isCompleted = current >= g.targetAmount;

            return (
              <View key={g.id} style={styles.goalCard}>
                {/* Top Row: Emoji, Title, Actions */}
                <View style={styles.goalTopRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                    <View style={styles.emojiBadge}>
                      <Text style={{ fontSize: 20 }}>{g.emoji || "✈️"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goalTitle} numberOfLines={1}>
                        {g.title}
                      </Text>
                      <Text style={styles.goalAccountMeta} numberOfLines={1}>
                        {linkedAcc ? `Linked: ${linkedAcc.name} (${rm(linkedAcc.balance)})` : "Standalone Pot"}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.editIconBtn}
                    onPress={() => openEdit(g)}
                    hitSlop={8}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.onSurfaceSecondary} />
                  </Pressable>
                </View>

                {/* Amounts & Percentage */}
                <View style={styles.amountRow}>
                  <View>
                    <Text style={styles.savedText}>
                      {rm(current)}
                      <Text style={styles.targetText}> / {rm(g.targetAmount)}</Text>
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pctPill,
                      isCompleted && { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pctPillText,
                        isCompleted && { color: "#166534" },
                      ]}
                    >
                      {isCompleted ? "Goal Reached! 🎉" : `${pct}%`}
                    </Text>
                  </View>
                </View>

                {/* Animated Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${pct}%` },
                      isCompleted && { backgroundColor: "#10B981" },
                    ]}
                  />
                </View>

                {/* Subtitle remaining & time cost */}
                {!isCompleted ? (
                  <View style={styles.remainingRow}>
                    <Text style={styles.remainingText}>
                      <Text style={{ fontWeight: "700", color: colors.onSurface }}>{rm(remaining)}</Text> to go
                    </Text>
                    <Text style={styles.timeCostText}>
                      ⏳ ~{remainingHours.toFixed(0)}h work
                    </Text>
                  </View>
                ) : (
                  <View style={styles.remainingRow}>
                    <Text style={[styles.remainingText, { color: "#166534", fontWeight: "700" }]}>
                      ✨ Successfully funded! Ready for adventure.
                    </Text>
                  </View>
                )}

                {/* Quick Stash / Top-Up Action Chips */}
                {!isCompleted && linkedAcc && (
                  <View style={styles.quickStashRow}>
                    <Text style={styles.quickStashLabel}>Quick Stash:</Text>
                    {[50, 100, 200, 500].map((amt) => (
                      <Pressable
                        key={amt}
                        style={({ pressed }) => [
                          styles.stashChip,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => onQuickStash(g, amt)}
                      >
                        <Text style={styles.stashChipText}>+{rm(amt)}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Goal Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGoal ? "Edit Savings Goal" : "New Savings Goal 🎯"}
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
              {/* Emoji Presets */}
              <Text style={styles.inputLabel}>Choose Icon</Text>
              <View style={styles.emojiRow}>
                {PRESET_ICONS.map((e) => (
                  <Pressable
                    key={e}
                    style={[styles.emojiSelectBtn, emoji === e && styles.emojiSelectBtnActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setEmoji(e);
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Goal Title */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Goal Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Travel Fund 2026, Japan Trip, Emergency Stash"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.input}
              />

              {/* Target Amount */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Target Amount (RM)</Text>
              <TextInput
                value={targetAmountStr}
                onChangeText={setTargetAmountStr}
                placeholder="e.g. 5000"
                placeholderTextColor={colors.onSurfaceSecondary}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              {/* Linked Account */}
              <View style={{ marginTop: 12 }}>
                <AccountSelectDropdown
                  label="Linked Account (Funds sync automatically)"
                  value={accountId}
                  onChange={setAccountId}
                  accounts={accounts}
                  placeholder="Select account (e.g. Travel Fund, ASNB)"
                />
              </View>

              {/* Notes */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Notes / Target Details</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes or itinerary details"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.input}
              />

              {/* Action Buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                {editingGoal && (
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(editingGoal)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                )}
                <Pressable
                  style={styles.saveBtn}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>
                    {editingGoal ? "Save Changes" : "Create Goal"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.4,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  emptySub: {
    fontSize: 11.5,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
  },
  emptyActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 6,
  },
  emptyActionText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.brandPrimary,
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  goalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emojiBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    alignItems: "center",
    justifyContent: "center",
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  goalAccountMeta: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  editIconBtn: {
    padding: 4,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 12,
    marginBottom: 6,
  },
  savedText: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.onSurface,
  },
  targetText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  pctPill: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pctPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onSurface,
  },
  progressBarTrack: {
    height: 9,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.brandPrimary,
    borderRadius: 5,
  },
  remainingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  remainingText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  timeCostText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
  },
  quickStashRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: "wrap",
  },
  quickStashLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  stashChip: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  stashChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingBottom: Platform.OS === "ios" ? 34 : spacing.lg,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.onSurface,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiSelectBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  emojiSelectBtnActive: {
    backgroundColor: "#DCFCE7",
    borderColor: "#10B981",
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
