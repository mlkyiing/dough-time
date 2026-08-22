import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { categoryMeta } from "@/src/constants";
import { amountToWorkHours, formatTimeCost, getBobaReaction, rm, shortDate } from "@/src/format";
import { Account, Transaction } from "@/src/types";

import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  visible: boolean;
  transaction: Transaction | null;
  account?: Account;
  hourlyRate: number;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function TransactionDetailModal({
  visible,
  transaction: t,
  account: acc,
  hourlyRate,
  onClose,
  onDelete,
}: Props) {
  if (!t) return null;

  const meta = categoryMeta(t.category);
  const timeCost = formatTimeCost(t.amount, hourlyRate);
  const workHours = amountToWorkHours(t.amount, hourlyRate);
  const reaction = getBobaReaction(workHours);

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onDelete(t.id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
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
                <Text style={styles.categoryName}>{t.category}</Text>
                <Text style={styles.merchantTitle}>
                  {t.merchant || t.category}
                </Text>
              </View>
            </View>

            <Pressable hitSlop={8} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

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

          {/* Delete Action Button */}
          <Pressable
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.deleteBtnText}>Delete Transaction</Text>
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
  modalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: 36,
    maxHeight: "85%",
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
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  merchantTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  amountHeroBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  amountLabel: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  amountValue: {
    fontWeight: "800",
    fontSize: 34,
    color: colors.onSurface,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  timeTagText: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurface,
  },
  reactionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mascotThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reactionTitle: {
    fontWeight: "800",
    fontSize: 13,
    color: colors.onSurface,
  },
  reactionDesc: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    lineHeight: 16,
  },
  detailsList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
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
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  deleteBtnText: {
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 14,
  },
});
