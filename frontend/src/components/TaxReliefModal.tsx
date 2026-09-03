import React, { useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { Transaction } from "@/src/types";
import { rm } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { calculateTaxReliefSummary } from "@/src/utils/taxRelief";

interface Props {
  visible: boolean;
  transactions: Transaction[];
  onClose: () => void;
}

export function TaxReliefModal({ visible, transactions, onClose }: Props) {
  const currentYear = new Date().getFullYear();

  const summary = useMemo(() => {
    return calculateTaxReliefSummary(transactions, currentYear);
  }, [transactions, currentYear]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="mentor" size={38} interactive={false} />
              <View>
                <Text style={styles.headerTitle}>🇲🇾 LHDN Tax Relief Tracker</Text>
                <Text style={styles.headerSub}>Year of Assessment {currentYear} quotas</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>ESTIMATED TAX REFUND SAVINGS</Text>
              <Text style={styles.heroSavings}>{rm(summary.totalEstimatedTaxSaved)}</Text>
              <Text style={styles.heroSub}>
                Based on <Text style={{ fontWeight: "800" }}>{rm(summary.totalClaimable)}</Text> in verified qualifying reliefs
              </Text>

              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>
                  💡 Automatically tagged from your receipts & transactions
                </Text>
              </View>
            </View>

            {/* Quota Progress Cards */}
            <View style={{ marginTop: spacing.md, gap: 12 }}>
              <Text style={styles.sectionTitle}>📋 Malaysian Tax Relief Quotas</Text>

              {summary.items.map((item) => {
                const isFull = item.percentageUsed >= 100;
                return (
                  <View key={item.category.code} style={styles.quotaCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 22 }}>{item.category.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.quotaTitle}>{item.category.title}</Text>
                          <Text style={styles.quotaDesc} numberOfLines={2}>
                            {item.category.description}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressWrap}>
                      <View style={styles.progressBg}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${item.percentageUsed}%`,
                              backgroundColor: isFull ? "#10B981" : colors.brandPrimary,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.progressLabels}>
                        <Text style={styles.progressText}>
                          Spent: <Text style={{ fontWeight: "700" }}>{rm(item.spent)}</Text> / {rm(item.category.maxLimit)}
                        </Text>
                        <Text style={[styles.progressPct, isFull && { color: "#059669" }]}>
                          {item.percentageUsed}% {isFull ? "(Maxed! 🎯)" : ""}
                        </Text>
                      </View>
                    </View>

                    {/* Tax benefit */}
                    <View style={styles.quotaFooter}>
                      <Text style={styles.taxSavedText}>
                        Est. Tax Saved: <Text style={{ fontWeight: "800", color: "#059669" }}>+{rm(item.estimatedTaxSaved)}</Text>
                      </Text>
                      <Text style={styles.txnCountText}>
                        {item.qualifyingTransactions.length} txns tagged
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Tax Optimization Tip */}
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>💡 Year-End LHDN Tax Hack</Text>
              <Text style={styles.tipDesc}>
                If your Lifestyle quota (RM 2,500) has room before December 31, consider purchasing any planned electronics, books, sports equipment, or home internet upgrades to claim the maximum tax refund!
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close Tracker</Text>
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
  heroCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.soft,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 0.5,
  },
  heroSavings: {
    fontSize: 30,
    fontWeight: "900",
    color: "#15803D",
    marginTop: 2,
  },
  heroSub: {
    fontSize: 12,
    color: "#166534",
    marginTop: 2,
  },
  heroPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  heroPillText: {
    fontSize: 11,
    color: "#15803D",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  quotaCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  quotaTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  quotaDesc: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  progressWrap: {
    marginTop: 10,
  },
  progressBg: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  progressText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brandPrimary,
  },
  quotaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  taxSavedText: {
    fontSize: 11,
    color: colors.onSurface,
  },
  txnCountText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  tipCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  tipDesc: {
    fontSize: 11,
    color: "#78350F",
    marginTop: 2,
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
