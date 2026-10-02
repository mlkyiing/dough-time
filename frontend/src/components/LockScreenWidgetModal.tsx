import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, font, spacing } from "@/src/theme";
import { rm, formatTimeCost } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  visible: boolean;
  onClose: () => void;
  availableToSpend: number;
  comfortRemaining: number;
  budgetLimit: number;
  budgetUsedPct: number;
  hourlyRate: number;
}

export function LockScreenWidgetModal({
  visible,
  onClose,
  availableToSpend,
  comfortRemaining,
  budgetLimit,
  budgetUsedPct,
  hourlyRate,
}: Props) {
  const [selectedWidget, setSelectedWidget] = useState<"rectangular" | "circular" | "inline">("rectangular");
  const [justRefreshed, setJustRefreshed] = useState(false);

  const remainingPct = Math.max(0, 100 - budgetUsedPct);
  const remainingHours = availableToSpend / (hourlyRate || 1);

  const handleRefreshSim = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setJustRefreshed(true);
    setTimeout(() => setJustRefreshed(false), 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="zen" size={38} interactive={false} />
              <View>
                <Text style={styles.title}>iPhone Lock Screen Widget</Text>
                <Text style={styles.subTitle}>Track available budget without unlocking your phone</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Widget Type Selector Tabs */}
            <View style={styles.tabsRow}>
              <Pressable
                style={[styles.tabBtn, selectedWidget === "rectangular" && styles.tabBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedWidget("rectangular");
                }}
              >
                <Ionicons
                  name="tablet-portrait-outline"
                  size={14}
                  color={selectedWidget === "rectangular" ? colors.brandPrimary : colors.onSurfaceSecondary}
                />
                <Text style={[styles.tabBtnText, selectedWidget === "rectangular" && styles.tabBtnTextActive]}>
                  Rectangular
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabBtn, selectedWidget === "circular" && styles.tabBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedWidget("circular");
                }}
              >
                <Ionicons
                  name="radio-button-on-outline"
                  size={14}
                  color={selectedWidget === "circular" ? colors.brandPrimary : colors.onSurfaceSecondary}
                />
                <Text style={[styles.tabBtnText, selectedWidget === "circular" && styles.tabBtnTextActive]}>
                  Circular
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabBtn, selectedWidget === "inline" && styles.tabBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedWidget("inline");
                }}
              >
                <Ionicons
                  name="remove-outline"
                  size={14}
                  color={selectedWidget === "inline" ? colors.brandPrimary : colors.onSurfaceSecondary}
                />
                <Text style={[styles.tabBtnText, selectedWidget === "inline" && styles.tabBtnTextActive]}>
                  Inline Ticker
                </Text>
              </Pressable>
            </View>

            {/* Simulated iPhone Lock Screen Phone Frame */}
            <View style={styles.phoneFrame}>
              {/* Dynamic Island */}
              <View style={styles.dynamicIsland} />

              {/* Lock Screen Date & Clock */}
              <View style={styles.lockScreenClockArea}>
                {selectedWidget === "inline" ? (
                  <View style={styles.inlineWidgetBadge}>
                    <Text style={styles.inlineWidgetText}>
                      🍞 Available: {rm(availableToSpend)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.lockDateText}>Friday, 2 October</Text>
                )}
                <Text style={styles.lockTimeText}>09:41</Text>
              </View>

              {/* Lock Screen Widget Placement Area (Below Clock) */}
              <View style={styles.widgetPlacementArea}>
                {selectedWidget === "rectangular" && (
                  <View style={styles.simRectangularWidget}>
                    <View style={styles.widgetHeaderRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={{ fontSize: 13 }}>🍞</Text>
                        <Text style={styles.widgetAppName}>DOUGHTIME</Text>
                      </View>
                      <Text style={styles.widgetPctText}>{remainingPct}% left</Text>
                    </View>
                    <Text style={styles.widgetAmountText}>{rm(availableToSpend)}</Text>
                    <Text style={styles.widgetSubText}>
                      Available to spend · {formatTimeCost(availableToSpend, hourlyRate, { compact: true })} life energy
                    </Text>
                  </View>
                )}

                {selectedWidget === "circular" && (
                  <View style={styles.circularWidgetRow}>
                    <View style={styles.simCircularWidget}>
                      <View style={styles.circularGaugeBorder}>
                        <Text style={styles.circularPct}>{remainingPct}%</Text>
                        <Text style={styles.circularLabel}>LEFT</Text>
                      </View>
                    </View>
                    <View style={styles.circularMeta}>
                      <Text style={styles.circularMetaTitle}>Safe Allowance</Text>
                      <Text style={styles.circularMetaAmt}>{rm(availableToSpend)}</Text>
                      <Text style={styles.circularMetaSub}>Comfort pot: {rm(comfortRemaining)}</Text>
                    </View>
                  </View>
                )}

                {selectedWidget === "inline" && (
                  <View style={styles.inlineInfoBox}>
                    <Text style={styles.inlineInfoTitle}>Active Above Clock</Text>
                    <Text style={styles.inlineInfoSub}>
                      Shows <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>"🍞 Available: {rm(availableToSpend)}"</Text> seamlessly above the time display!
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom Quick Actions (Flashlight & Camera) */}
              <View style={styles.lockScreenBottomRow}>
                <View style={styles.bottomIconCircle}>
                  <Ionicons name="flashlight" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.homeIndicator} />
                <View style={styles.bottomIconCircle}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </View>
              </View>
            </View>

            {/* Live Sync Status & Refresh Button */}
            <View style={styles.syncCard}>
              <View style={styles.syncInfoRow}>
                <View style={[styles.statusDot, justRefreshed && styles.statusDotActive]} />
                <Text style={styles.syncStatusText}>
                  {justRefreshed ? "Data synced to WidgetKit! ✨" : "Auto-syncs whenever you log a transaction"}
                </Text>
              </View>
              <Pressable style={styles.testSyncBtn} onPress={handleRefreshSim}>
                <Ionicons name="sync-outline" size={14} color={colors.brandPrimary} />
                <Text style={styles.testSyncBtnText}>Test Widget Sync</Text>
              </Pressable>
            </View>

            {/* How to enable on iOS Guide */}
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>How to add to your iPhone Lock Screen</Text>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>1</Text>
                <Text style={styles.stepText}>
                  Long press on your iPhone lock screen until the <Text style={{ fontWeight: "700" }}>Customize</Text> button appears.
                </Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>2</Text>
                <Text style={styles.stepText}>
                  Tap <Text style={{ fontWeight: "700" }}>Lock Screen</Text>, then tap the widget box below the clock.
                </Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>3</Text>
                <Text style={styles.stepText}>
                  Scroll down and tap <Text style={{ fontWeight: "700" }}>DoughTime</Text>, pick Rectangular or Circular, and tap Done!
                </Text>
              </View>
            </View>
          </ScrollView>
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
    padding: spacing.lg,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 17,
    fontFamily: font.bold,
    color: colors.onSurface,
  },
  subTitle: {
    fontSize: 12,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  tabBtnActive: {
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.brandPrimary,
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
  },
  tabBtnTextActive: {
    color: colors.brandPrimary,
    fontFamily: font.bold,
  },
  phoneFrame: {
    backgroundColor: "#1E293B",
    borderRadius: 36,
    padding: 16,
    paddingTop: 12,
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#334155",
    ...shadow.card,
    marginBottom: 16,
  },
  dynamicIsland: {
    width: 90,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000000",
    marginBottom: 14,
  },
  lockScreenClockArea: {
    alignItems: "center",
    marginBottom: 12,
  },
  lockDateText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
    letterSpacing: 0.2,
  },
  lockTimeText: {
    fontSize: 64,
    fontWeight: "300",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    marginTop: -8,
  },
  inlineWidgetBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
  },
  inlineWidgetText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FCE7F3",
  },
  widgetPlacementArea: {
    width: "100%",
    minHeight: 88,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  simRectangularWidget: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  widgetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  widgetAppName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E2E8F0",
    letterSpacing: 0.5,
  },
  widgetPctText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F472B6",
  },
  widgetAmountText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  widgetSubText: {
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 2,
  },
  circularWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    width: "100%",
    paddingHorizontal: 10,
  },
  simCircularWidget: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  circularGaugeBorder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: "#F472B6",
    alignItems: "center",
    justifyContent: "center",
  },
  circularPct: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  circularLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#E2E8F0",
  },
  circularMeta: {
    flex: 1,
  },
  circularMetaTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  circularMetaAmt: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  circularMetaSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  inlineInfoBox: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    padding: 12,
    borderRadius: 14,
    width: "100%",
  },
  inlineInfoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F472B6",
    marginBottom: 2,
  },
  inlineInfoSub: {
    fontSize: 12,
    color: "#E2E8F0",
    lineHeight: 16,
  },
  lockScreenBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 12,
  },
  bottomIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  homeIndicator: {
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    opacity: 0.6,
  },
  syncCard: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  syncInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  statusDotActive: {
    backgroundColor: colors.brandPrimary,
    transform: [{ scale: 1.3 }],
  },
  syncStatusText: {
    fontSize: 12,
    fontFamily: font.medium,
    color: colors.onSurface,
    flex: 1,
  },
  testSyncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  testSyncBtnText: {
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.brandPrimary,
  },
  guideCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  guideTitle: {
    fontSize: 13,
    fontFamily: font.bold,
    color: colors.onSurface,
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceTertiary,
    textAlign: "center",
    lineHeight: 18,
    fontSize: 11,
    fontFamily: font.bold,
    color: colors.brandPrimary,
  },
  stepText: {
    fontSize: 12,
    fontFamily: font.medium,
    color: colors.onSurfaceSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
