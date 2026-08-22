import React, { useState, useEffect } from "react";
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
import { CATEGORIES, categoryMeta } from "@/src/constants";
import { amountToWorkHours, formatTimeCost, getBobaReaction, rm, shortDate, todayISO } from "@/src/format";
import { Account, Transaction } from "@/src/types";
import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  visible: boolean;
  transaction: Transaction | null;
  account?: Account;
  accounts?: Account[];
  hourlyRate: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate?: (updated: Transaction) => void;
}

export function TransactionDetailModal({
  visible,
  transaction: t,
  account: acc,
  accounts = [],
  hourlyRate,
  onClose,
  onDelete,
  onUpdate,
}: Props) {
  if (!t) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Makan");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editAccountId, setEditAccountId] = useState("");

  useEffect(() => {
    if (t) {
      setIsEditing(false);
      setEditMerchant(t.merchant || "");
      setEditAmount(String(t.amount || ""));
      setEditCategory(t.category || "Makan");
      setEditDate(t.date || todayISO());
      setEditNote(t.note || "");
      setEditAccountId(t.accountId || "");
    }
  }, [t]);

  const meta = categoryMeta(t.category);
  const timeCost = formatTimeCost(t.amount, hourlyRate);
  const workHours = amountToWorkHours(t.amount, hourlyRate);
  const reaction = getBobaReaction(workHours);

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onDelete(t.id);
    onClose();
  };

  const handleSaveEdit = () => {
    const num = parseFloat(editAmount.replace(/,/g, "")) || 0;
    if (!num || num <= 0) return;

    const updated: Transaction = {
      ...t,
      merchant: editMerchant.trim() || t.category,
      amount: num,
      category: editCategory as any,
      date: editDate || todayISO(),
      note: editNote.trim() || undefined,
      accountId: editAccountId || t.accountId,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (onUpdate) {
      onUpdate(updated);
    }
    setIsEditing(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.iconBox, { backgroundColor: meta.tint }]}>
                <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
              </View>
              <View>
                <Text style={styles.categoryName}>{isEditing ? "Edit Expense" : t.category}</Text>
                <Text style={styles.merchantTitle} numberOfLines={1}>
                  {isEditing ? "Modify Transaction Details" : (t.merchant || t.category)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {onUpdate && (
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setIsEditing(!isEditing);
                  }}
                  style={styles.editToggleBtn}
                >
                  <Ionicons
                    name={isEditing ? "eye-outline" : "create-outline"}
                    size={20}
                    color={colors.brandPrimary}
                  />
                </Pressable>
              )}
              <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
          </View>

          {isEditing ? (
            /* Edit Form Mode */
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginVertical: spacing.md }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Merchant / Description</Text>
                <TextInput
                  value={editMerchant}
                  onChangeText={setEditMerchant}
                  placeholder="e.g. McDonald's, Grab, Shell"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (RM)</Text>
                <TextInput
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0.00"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  {CATEGORIES.map((c) => {
                    const isSel = editCategory === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setEditCategory(c.key);
                        }}
                        style={[
                          styles.catChip,
                          isSel && styles.catChipActive,
                        ]}
                      >
                        <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
                        <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>
                          {c.key}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Note / Memo (Optional)</Text>
                <TextInput
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="e.g. Lunch with team"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>

              <Pressable style={styles.saveEditBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveEditBtnText}>Save Transaction Changes</Text>
              </Pressable>
            </ScrollView>
          ) : (
            /* View Details Mode */
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
              {/* Amount Hero Box */}
              <View style={styles.amountHeroBox}>
                <Text style={styles.amountLabel}>Total Spent</Text>
                <Text style={styles.amountValue}>{rm(t.amount)}</Text>

                {/* Life Time Cost Tag */}
                <View style={styles.timeTag}>
                  <Text style={{ fontSize: 16 }}>⏱️</Text>
                  <Text style={styles.timeTagText}>
                    Traded <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{timeCost}</Text> of your life
                  </Text>
                </View>
              </View>

              {/* Mascot Impact Reaction */}
              <View style={styles.reactionCard}>
                <View style={styles.reactionRow}>
                  <AnimatedMascot variant="coin" size={48} interactive={true} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.reactionTitle}>
                      {reaction.title} {reaction.emoji}
                    </Text>
                    <Text style={styles.reactionDesc}>
                      At RM {hourlyRate.toFixed(2)}/hr, this purchase required {workHours.toFixed(1)} hours of work.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Details List */}
              <View style={styles.detailsList}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Payment Account / Card</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{acc?.emoji || "💳"}</Text>
                    <Text style={styles.detailValue}>{acc?.name || "Cash"}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{shortDate(t.date)}</Text>
                </View>

                {t.note && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Note / Memo</Text>
                      <Text style={[styles.detailValue, { fontStyle: "italic" }]}>
                        &ldquo;{t.note}&rdquo;
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          )}

          {/* Delete Action Button */}
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Delete Transaction</Text>
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
  modalCard: {
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  merchantTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    maxWidth: 180,
  },
  editToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  amountHeroBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  amountLabel: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amountValue: {
    fontWeight: "900",
    fontSize: 34,
    color: colors.onSurface,
    marginVertical: 4,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  timeTagText: {
    fontWeight: "600",
    fontSize: 13,
    color: colors.onSurface,
  },
  reactionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reactionTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: colors.onSurface,
  },
  reactionDesc: {
    fontWeight: "500",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    lineHeight: 16,
  },
  detailsList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  detailLabel: {
    fontWeight: "600",
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  detailValue: {
    fontWeight: "700",
    fontSize: 13,
    color: colors.onSurface,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  inputGroup: {
    marginBottom: spacing.md,
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
    fontSize: 15,
    color: colors.onSurface,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  catChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  catChipText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  catChipTextActive: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
  },
  saveEditBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadow.glow,
  },
  saveEditBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  deleteBtnText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#EF4444",
  },
});
