import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { DueLoanInfo } from "../utils/notifications";
import { rm } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  reminders: DueLoanInfo[];
  onPayPress: (info: DueLoanInfo) => void;
  onDismiss?: (accountId: string) => void;
}

export function LoanDueBanner({ reminders, onPayPress, onDismiss }: Props) {
  if (!reminders || reminders.length === 0) return null;

  const top = reminders[0];
  const isOverdue = top.status === "overdue";
  const isToday = top.status === "due_today";

  const bannerBg = isOverdue ? "#FEF2F2" : isToday ? "#FFFBEB" : "#F0FDF4";
  const bannerBorder = isOverdue ? "#FCA5A5" : isToday ? "#FCD34D" : "#86EFAC";
  const badgeColor = isOverdue ? "#EF4444" : isToday ? "#D97706" : "#059669";
  const badgeText = isOverdue
    ? `⚠️ Overdue (${Math.abs(top.daysRemaining)}d)`
    : isToday
    ? "🔔 Due Today!"
    : `⏰ Due in ${top.daysRemaining} days (${top.formattedDue})`;

  return (
    <View style={[styles.container, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
      <View style={styles.topRow}>
        <View style={styles.leftInfo}>
          <AnimatedMascot variant={isOverdue ? "coin" : "zen"} size={36} interactive={false} />
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.title}>{top.account.name}</Text>
              <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                <Text style={styles.badgeLabel}>{badgeText}</Text>
              </View>
            </View>
            <Text style={styles.sub}>
              Installment: <Text style={{ fontWeight: "800", color: colors.onSurface }}>{rm(top.installment)}</Text>
              {" · "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>⏱️ {top.workHours}h work</Text>
            </Text>
          </View>
        </View>

        {onDismiss && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onDismiss(top.account.id);
            }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={16} color={colors.onSurfaceSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.tipText}>
          {isOverdue
            ? "Protect your credit score and avoid late charges! Deduct now from your bank."
            : "Keep your Dough plan on track! Deduct this repayment from your bank account."}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.payBtn,
            { backgroundColor: isOverdue ? "#DC2626" : colors.brandPrimary },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            onPayPress(top);
          }}
        >
          <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
          <Text style={styles.payBtnText}>Deduct Repayment 💸</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  sub: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    fontWeight: "500",
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    lineHeight: 15,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    ...shadow.glow,
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
