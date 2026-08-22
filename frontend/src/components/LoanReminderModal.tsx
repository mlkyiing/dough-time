import React, { useState, useEffect } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { Account, WageSettings } from "@/src/types";
import { amountToWorkHours, rm } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { scheduleLoanRepaymentReminder, triggerNotification } from "../utils/notifications";

interface Props {
  visible: boolean;
  account: Account | null;
  wage: WageSettings;
  onClose: () => void;
  onSave: (updated: Account) => void;
}

export function LoanReminderModal({
  visible,
  account,
  wage,
  onClose,
  onSave,
}: Props) {
  if (!account) return null;

  const [installment, setInstallment] = useState("");
  const [dueDay, setDueDay] = useState("25");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [daysBefore, setDaysBefore] = useState("2");

  useEffect(() => {
    if (account) {
      setInstallment(account.monthlyInstallment ? String(account.monthlyInstallment) : String(account.balance || ""));
      setDueDay(account.dueDay ? String(account.dueDay) : "25");
      setReminderEnabled(account.reminderEnabled ?? true);
      setDaysBefore(account.reminderDaysBefore ? String(account.reminderDaysBefore) : "2");
    }
  }, [account]);

  const installmentNum = parseFloat(installment) || 0;
  const workHours = amountToWorkHours(installmentNum, wage.hourlyRate);

  const handleSave = async () => {
    const dayNum = parseInt(dueDay, 10);
    if (!dayNum || dayNum < 1 || dayNum > 31) {
      Alert.alert("Invalid Due Day", "Please enter a day between 1 and 31.");
      return;
    }

    const updated: Account = {
      ...account,
      monthlyInstallment: installmentNum > 0 ? installmentNum : undefined,
      dueDay: dayNum,
      reminderEnabled,
      reminderDaysBefore: parseInt(daysBefore, 10) || 2,
    };

    onSave(updated);
    if (reminderEnabled) {
      await scheduleLoanRepaymentReminder(updated, wage.hourlyRate);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const handleTestNotification = async () => {
    Haptics.selectionAsync().catch(() => {});
    await triggerNotification(
      `🚗 ${account.name} Reminder`,
      `Your installment of ${rm(installmentNum || 650)} (${workHours.toFixed(1)}h of work) is due on the ${dueDay || 25}th. Keep your Dough safe! 🥟✨`
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant="zen" size={44} interactive={true} />
              <View>
                <Text style={styles.title}>Repayment Reminder 🔔</Text>
                <Text style={styles.sub}>{account.name}</Text>
              </View>
            </View>
            <Pressable hitSlop={8} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
            {/* Enable Reminder Switch */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.switchLabel}>Monthly Payment Reminder</Text>
                <Text style={styles.switchSub}>Receive phone/web notifications before due date</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(val) => {
                  Haptics.selectionAsync().catch(() => {});
                  setReminderEnabled(val);
                }}
                trackColor={{ false: "#CBD5E1", true: colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {reminderEnabled && (
              <>
                {/* Monthly Installment (RM) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monthly Installment (RM)</Text>
                  <TextInput
                    value={installment}
                    onChangeText={setInstallment}
                    keyboardType="numeric"
                    placeholder="e.g. 650.00"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                  {installmentNum > 0 && (
                    <View style={styles.lifeCostPill}>
                      <Text style={{ fontSize: 13 }}>⏱️</Text>
                      <Text style={styles.lifeCostText}>
                        Trades <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{workHours.toFixed(1)} hours</Text> of your work each month
                      </Text>
                    </View>
                  )}
                </View>

                {/* Due Date (Day of Month) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Due Day of Every Month (1 - 31)</Text>
                  <TextInput
                    value={dueDay}
                    onChangeText={setDueDay}
                    keyboardType="numeric"
                    placeholder="e.g. 25"
                    maxLength={2}
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.input}
                  />
                </View>

                {/* Remind In Advance */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Remind Me in Advance</Text>
                  <View style={styles.daysRow}>
                    {["1", "2", "3", "5"].map((d) => (
                      <Pressable
                        key={d}
                        style={[styles.dayPill, daysBefore === d && styles.dayPillActive]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setDaysBefore(d);
                        }}
                      >
                        <Text style={[styles.dayPillText, daysBefore === d && styles.dayPillTextActive]}>
                          {d} days before
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Test Notification Action */}
                <Pressable style={styles.testBtn} onPress={handleTestNotification}>
                  <Ionicons name="notifications-outline" size={16} color={colors.brandPrimary} />
                  <Text style={styles.testBtnText}>Test Live Notification</Text>
                </Pressable>
              </>
            )}
          </ScrollView>

          {/* Save Button */}
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Repayment Reminder</Text>
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
  card: {
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
  title: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  sub: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: spacing.sm,
  },
  switchLabel: {
    fontWeight: "700",
    fontSize: 14,
    color: colors.onSurface,
  },
  switchSub: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginTop: spacing.md,
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
  lifeCostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  lifeCostText: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurface,
  },
  daysRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dayPillActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  dayPillText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  dayPillTextActive: {
    color: colors.onBrandPrimary,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
  testBtnText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.brandPrimary,
  },
  saveBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadow.glow,
  },
  saveBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
    fontSize: 15,
  },
});
