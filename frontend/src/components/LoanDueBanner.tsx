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
      <View style={styles.contentRow}>
        <AnimatedMascot variant={isOverdue ? "coin" : "zen"} size={32} interactive={false} />
        <View style={{ flex: 1, gap: 2, marginRight: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={styles.title} numberOfLines={1}>{top.account.name}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeLabel}>{badgeText}</Text>
            </View>
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            Due: <Text style={{ fontWeight: "800", color: colors.onSurface }}>{rm(top.installment)}</Text>
            {" · "}
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>⏱️ {top.workHours}h work</Text>
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable
            style={({ pressed }) => [
              styles.payBtn,
              { backgroundColor: isOverdue ? "#DC2626" : colors.brandPrimary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onPayPress(top);
            }}
          >
            <Text style={styles.payBtnText}>Deduct 💸</Text>
          </Pressable>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  sub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    fontWeight: "500",
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
});
