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
import { CATEGORIES, INCOME_CATEGORIES, categoryMeta } from "@/src/constants";
import { amountToWorkHours, formatTimeCost, getBobaReaction, rm, shortDate, todayISO } from "@/src/format";
import { Account, BudgetBucket, Transaction } from "@/src/types";
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

const BUCKET_OPTIONS: { key: BudgetBucket; label: string; emoji: string }[] = [
  { key: "needs", label: "Must-Haves", emoji: "🍞" },
  { key: "comfort", label: "Comfort Fund", emoji: "🎁" },
  { key: "savings", label: "Savings / Stash", emoji: "📈" },
];

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
  const [editType, setEditType] = useState<"expense" | "income" | "transfer">("expense");
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Makan");
  const [editBucket, setEditBucket] = useState<BudgetBucket | undefined>(undefined);
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editAccountId, setEditAccountId] = useState("");

  useEffect(() => {
    if (t) {
      setIsEditing(false);
      setEditType(t.type || "expense");
      setEditMerchant(t.merchant || "");
      setEditAmount(String(t.amount || ""));
      setEditCategory(t.category || "Makan");
      setEditBucket(t.bucket);
      setEditDate(t.date || todayISO());
      setEditNote(t.note || "");
      setEditAccountId(t.accountId || (accounts[0]?.id ?? ""));
    }
  }, [t, accounts]);

  const isIncome = (t.type === "income");
  const isTransfer = (t.type === "transfer");
  const meta = categoryMeta(t.category);
  const timeCost = formatTimeCost(t.amount, hourlyRate);
  const workHours = amountToWorkHours(t.amount, hourlyRate);
  const reaction = getBobaReaction(workHours);
  const currentAccount = accounts.find((a) => a.id === (isEditing ? editAccountId : t.accountId)) || acc;
  const toAccount = accounts.find((a) => a.id === t.toAccountId);
  const isLoanRepay = isTransfer && (toAccount?.type === "loan" || t.category === "Loan / Debt");

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
      type: editType,
      merchant: editMerchant.trim() || editCategory,
      amount: num,
      category: editCategory,
      bucket: editBucket,
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: meta.tint }]}>
                <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryName}>
                  {isEditing ? "Edit Record" : isIncome ? "💰 Income" : "💸 Expense"} · {t.category}
                </Text>
                <Text style={styles.merchantTitle} numberOfLines={1}>
                  {isEditing ? (editMerchant || editCategory) : (t.merchant || t.category)}
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
                  style={[styles.editToggleBtn, isEditing && { backgroundColor: colors.brandPrimary }]}
                >
                  <Ionicons
                    name={isEditing ? "checkmark" : "create-outline"}
                    size={18}
                    color={isEditing ? colors.onBrandPrimary : colors.brandPrimary}
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
              {/* Type Switcher (Expense vs Income) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Record Type</Text>
                <View style={styles.typeToggleRow}>
                  <Pressable
                    style={[
                      styles.typeToggleBtn,
                      editType === "expense" && styles.typeToggleBtnActiveExpense,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setEditType("expense");
                      if (INCOME_CATEGORIES.some((c) => c.key === editCategory)) {
                        setEditCategory("Makan");
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        editType === "expense" && styles.typeToggleTextActive,
                      ]}
                    >
                      💸 Expense
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.typeToggleBtn,
                      editType === "income" && styles.typeToggleBtnActiveIncome,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setEditType("income");
                      if (CATEGORIES.some((c) => c.key === editCategory)) {
                        setEditCategory("Salary");
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.typeToggleText,
                        editType === "income" && styles.typeToggleTextActive,
                      ]}
                    >
                      💰 Income
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Account Selection Chips */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {editType === "income" ? "Deposit / Receiving Account" : "Payment Account / Card"}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {accounts.map((a) => {
                    const isSel = editAccountId === a.id;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setEditAccountId(a.id);
                        }}
                        style={[
                          styles.accountChip,
                          isSel && styles.accountChipActive,
                        ]}
                      >
                        <Text style={{ fontSize: 15 }}>{a.emoji}</Text>
                        <View>
                          <Text style={[styles.accountChipName, isSel && styles.accountChipNameActive]}>
                            {a.name}
                          </Text>
                          <Text style={[styles.accountChipBal, isSel && styles.accountChipBalActive]}>
                            {rm(a.balance)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Merchant / Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Merchant / Title / Description</Text>
                <TextInput
                  value={editMerchant}
                  onChangeText={setEditMerchant}
                  placeholder={editType === "income" ? "e.g. Monthly Salary, Freelance Gig" : "e.g. McDonald's, Grab, Shell"}
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.input}
                />
              </View>

              {/* Amount */}
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

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  {(editType === "income" ? INCOME_CATEGORIES : CATEGORIES).map((c) => {
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

              {/* Spending Pool / Bucket (Only for Expenses) */}
              {editType === "expense" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Budget Pool / Bucket (Optional)</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {BUCKET_OPTIONS.map((b) => {
                      const isSel = editBucket === b.key;
                      return (
                        <Pressable
                          key={b.key}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setEditBucket(isSel ? undefined : b.key);
                          }}
                          style={[
                            styles.bucketChip,
                            isSel && styles.bucketChipActive,
                          ]}
                        >
                          <Text style={{ fontSize: 14 }}>{b.emoji}</Text>
                          <Text style={[styles.bucketChipText, isSel && styles.bucketChipTextActive]}>
                            {b.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Date */}
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

              {/* Note */}
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
                <Text style={styles.saveEditBtnText}>Save Changes</Text>
              </Pressable>
            </ScrollView>
          ) : (
            /* View Details Mode */
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
              {/* Amount Hero Box */}
              <View style={[styles.amountHeroBox, isIncome && styles.amountHeroBoxIncome]}>
                <Text style={styles.amountLabel}>
                  {isIncome ? "Total Income Received" : "Total Amount Spent"}
                </Text>
                <Text style={[styles.amountValue, isIncome && { color: "#059669" }]}>
                  {isIncome ? `+${rm(t.amount)}` : rm(t.amount)}
                </Text>

                {/* Life Time Cost / Freedom Tag */}
                <View style={[styles.timeTag, isIncome && { backgroundColor: "#DCFCE7" }]}>
                  <Text style={{ fontSize: 16 }}>{isIncome ? "🌿" : "⏱️"}</Text>
                  <Text style={styles.timeTagText}>
                    {isIncome ? (
                      <>
                        Freed <Text style={{ fontWeight: "800", color: "#059669" }}>+{timeCost}</Text> of life energy
                      </>
                    ) : (
                      <>
                        Traded <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{timeCost}</Text> of your life
                      </>
                    )}
                  </Text>
                </View>
              </View>

              {/* Mascot Reaction */}
              <View style={styles.reactionCard}>
                <View style={styles.reactionRow}>
                  <AnimatedMascot variant={isIncome ? "rich" : "coin"} size={48} interactive={true} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.reactionTitle}>
                      {isIncome ? "Income Stashed! 💰" : `${reaction.title} ${reaction.emoji}`}
                    </Text>
                    <Text style={styles.reactionDesc}>
                      {isIncome
                        ? `At RM ${hourlyRate.toFixed(2)}/hr, this adds +${workHours.toFixed(1)} hours of financial freedom.`
                        : `At RM ${hourlyRate.toFixed(2)}/hr, this required ${workHours.toFixed(1)} hours of hard work.`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Details List */}
              <View style={styles.detailsList}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>
                    {isIncome ? "Deposited To" : isTransfer ? "From Account" : "Payment Account"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{currentAccount?.emoji || "💳"}</Text>
                    <Text style={styles.detailValue}>{currentAccount?.name || "Cash Wallet"}</Text>
                  </View>
                </View>

                {isTransfer && toAccount && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>
                        {isLoanRepay ? "Loan Debt Account" : "To Account"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 16 }}>{toAccount.emoji}</Text>
                        <Text style={styles.detailValue}>{toAccount.name}</Text>
                      </View>
                    </View>
                  </>
                )}

                {t.bucket && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Budget Pool</Text>
                      <View style={styles.bucketTag}>
                        <Text style={{ fontSize: 12 }}>
                          {t.bucket === "needs" ? "🍞 Must-Haves" : t.bucket === "comfort" ? "🎁 Comfort Fund" : "📈 Savings"}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

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

              {/* Action Buttons */}
              <View style={{ marginTop: spacing.lg, gap: 8 }}>
                {onUpdate && (
                  <Pressable
                    style={styles.editActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsEditing(true);
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.onBrandPrimary} />
                    <Text style={styles.editActionBtnText}>Edit Details & Account</Text>
                  </Pressable>
                )}

                <Pressable
                  style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.deleteBtnText}>Delete Transaction</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
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
    maxWidth: 200,
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
  typeToggleRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  typeToggleBtnActiveExpense: {
    backgroundColor: colors.brandPrimary,
  },
  typeToggleBtnActiveIncome: {
    backgroundColor: "#10B981",
  },
  typeToggleText: {
    fontWeight: "700",
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  typeToggleTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  accountChipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: "#FDF2F8",
  },
  accountChipName: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
  },
  accountChipNameActive: {
    color: colors.brandPrimary,
    fontWeight: "800",
  },
  accountChipBal: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  accountChipBalActive: {
    color: colors.brandPrimary,
  },
  bucketChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  bucketChipActive: {
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.brandPrimary,
  },
  bucketChipText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  bucketChipTextActive: {
    color: colors.brandPrimary,
    fontWeight: "800",
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
  amountHeroBoxIncome: {
    borderColor: "#A7F3D0",
    backgroundColor: "#F0FDF4",
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
  bucketTag: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
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
  editActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    ...shadow.glow,
  },
  editActionBtnText: {
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
  },
  deleteBtnText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#EF4444",
  },
});

