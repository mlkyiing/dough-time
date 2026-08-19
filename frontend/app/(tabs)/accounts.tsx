import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import {
  calculateHourlyRate,
  deleteAccount,
  getAccounts,
  getWageSettings,
  newAccountId,
  setWageSettings,
  upsertAccount,
} from "@/src/store";
import { Account, WageSettings } from "@/src/types";
import { ACCOUNT_TEMPLATES } from "@/src/constants";
import { amountToWorkHours, formatTimeCost, rm } from "@/src/format";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wageModalOpen, setWageModalOpen] = useState(false);
  const [tempSalary, setTempSalary] = useState("4500");
  const [tempHours, setTempHours] = useState("40");
  const [customName, setCustomName] = useState("");
  const [customBalance, setCustomBalance] = useState("");

  const load = useCallback(async () => {
    const [a, w] = await Promise.all([getAccounts(), getWageSettings()]);
    setAccounts(a);
    setWage(w);
    setTempSalary(String(w.monthlySalary));
    setTempHours(String(w.hoursPerWeek));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSaveWage = async () => {
    const salary = parseFloat(tempSalary) || 0;
    const hrs = parseFloat(tempHours) || 40;
    const rate = calculateHourlyRate(salary, hrs);
    const updated: WageSettings = {
      ...wage,
      monthlySalary: salary,
      hoursPerWeek: hrs,
      hourlyRate: rate,
    };
    await setWageSettings(updated);
    setWage(updated);
    setWageModalOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const addTemplate = async (tpl: typeof ACCOUNT_TEMPLATES[number]) => {
    await upsertAccount({
      id: newAccountId(),
      name: tpl.name,
      type: tpl.type,
      emoji: tpl.emoji,
      color: tpl.color,
      balance: 0,
    });
    setPickerOpen(false);
    load();
  };

  const addCustom = async () => {
    if (!customName.trim()) return;
    await upsertAccount({
      id: newAccountId(),
      name: customName.trim(),
      type: "cash",
      emoji: "💳",
      color: colors.brandPrimary,
      balance: parseFloat(customBalance) || 0,
    });
    setCustomName("");
    setCustomBalance("");
    setPickerOpen(false);
    load();
  };

  const remove = (a: Account) => {
    Alert.alert(`Delete ${a.name}?`, "Transactions on this account will stay.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteAccount(a.id); load(); } },
    ]);
  };

  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const totalHours = amountToWorkHours(total, wage.hourlyRate);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Accounts & Wallets</Text>
          <Text style={styles.subtitle}>
            Total {rm(total)} ({totalHours.toFixed(1)} hrs saved)
          </Text>
        </View>
        <Pressable
          testID="add-account-btn"
          style={styles.iconBtn}
          onPress={() => setPickerOpen(true)}
        >
          <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Wage Profile Card */}
        <Pressable style={styles.wageCard} onPress={() => setWageModalOpen(true)}>
          <View style={styles.wageCardLeft}>
            <View style={styles.wageIconWrap}>
              <Text style={{ fontSize: 24 }}>⏱️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.wageCardTitle}>Hourly Work Wage Profile</Text>
              <Text style={styles.wageCardSub}>
                RM {wage.hourlyRate.toFixed(2)}/hr · {wage.hoursPerWeek}h work week
              </Text>
            </View>
          </View>
          <View style={styles.wageCardBadge}>
            <Text style={styles.wageCardBadgeText}>Configure</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Connected Wallets & Banks</Text>

        {accounts.map((a) => {
          const accHours = amountToWorkHours(a.balance, wage.hourlyRate);
          return (
            <Pressable
              key={a.id}
              testID={`account-${a.id}`}
              onLongPress={() => remove(a)}
              style={[styles.accountCard, { borderLeftColor: a.color }]}
            >
              <View style={styles.accountEmojiBox}>
                <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{a.name}</Text>
                <Text style={styles.accountType}>{a.type.toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.accountBalance}>{rm(a.balance)}</Text>
                <Text style={styles.accountHours}>⏱️ {accHours.toFixed(1)}h worth</Text>
              </View>
            </Pressable>
          );
        })}

        {accounts.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 42 }}>💸</Text>
            <Text style={styles.emptyText}>Add your first account to start tracking</Text>
          </View>
        )}
      </ScrollView>

      {/* Account Picker Modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Account</Text>
              <Pressable onPress={() => setPickerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionLabel}>Popular Malaysian Accounts</Text>
              <View style={styles.templateGrid}>
                {ACCOUNT_TEMPLATES.map((t) => (
                  <Pressable
                    key={t.name}
                    onPress={() => addTemplate(t)}
                    style={[styles.templateItem, { borderLeftColor: t.color }]}
                  >
                    <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                    <Text style={styles.templateName} numberOfLines={1}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.modalSectionLabel, { marginTop: spacing.lg }]}>Or Add Custom</Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder="Account Name (e.g. Secret Stash)"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.modalInput}
              />
              <TextInput
                value={customBalance}
                onChangeText={setCustomBalance}
                placeholder="Initial Balance (RM 0.00)"
                placeholderTextColor={colors.onSurfaceSecondary}
                keyboardType="numeric"
                style={styles.modalInput}
              />
              <Pressable style={styles.customAddBtn} onPress={addCustom}>
                <Text style={styles.customAddBtnText}>Add Custom Account</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Wage Settings Modal */}
      <Modal
        visible={wageModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 24 }}>⏱️</Text>
                <Text style={styles.modalTitle}>Set Work Wage</Text>
              </View>
              <Pressable onPress={() => setWageModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Your hourly rate powers DoughTime's Money-to-Time calculations across all transactions.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monthly Take-Home Salary (RM)</Text>
              <TextInput
                value={tempSalary}
                onChangeText={setTempSalary}
                keyboardType="numeric"
                style={styles.modalInput}
                placeholder="e.g. 4500"
                placeholderTextColor={colors.onSurfaceSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Working Hours Per Week</Text>
              <TextInput
                value={tempHours}
                onChangeText={setTempHours}
                keyboardType="numeric"
                style={styles.modalInput}
                placeholder="e.g. 40"
                placeholderTextColor={colors.onSurfaceSecondary}
              />
            </View>

            <View style={styles.calcPreviewBox}>
              <Text style={styles.calcPreviewLabel}>Calculated Hourly Value:</Text>
              <Text style={styles.calcPreviewVal}>
                RM {calculateHourlyRate(parseFloat(tempSalary) || 0, parseFloat(tempHours) || 40).toFixed(2)} / hour
              </Text>
            </View>

            <Pressable style={styles.customAddBtn} onPress={handleSaveWage}>
              <Text style={styles.customAddBtnText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, color: colors.onSurface },
  subtitle: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  iconBtn: {
    backgroundColor: colors.brandPrimary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  wageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  wageCardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  wageIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  wageCardTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 14, color: colors.onSurface },
  wageCardSub: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: colors.brandPrimary, marginTop: 2 },
  wageCardBadge: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  wageCardBadgeText: { fontFamily: "Nunito_700Bold", fontSize: 11, color: colors.brandPrimary },
  sectionTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: colors.onSurface, marginBottom: spacing.md },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  accountEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { fontFamily: "Nunito_700Bold", fontSize: 15, color: colors.onSurface },
  accountType: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: colors.onSurfaceSecondary, marginTop: 2 },
  accountBalance: { fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: colors.onSurface },
  accountHours: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: colors.brandPrimary, marginTop: 2 },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyText: { fontFamily: "Nunito_600SemiBold", color: colors.onSurfaceSecondary, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: colors.onSurface },
  modalSubtitle: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  modalSectionLabel: { fontFamily: "Nunito_700Bold", fontSize: 13, color: colors.onSurfaceSecondary, marginBottom: 8 },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateName: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: colors.onSurface, flex: 1 },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: 8,
  },
  customAddBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  customAddBtnText: { color: colors.onBrandPrimary, fontFamily: "Nunito_700Bold", fontSize: 14 },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { fontFamily: "Nunito_700Bold", fontSize: 12, color: colors.onSurface, marginBottom: 4 },
  calcPreviewBox: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginVertical: spacing.sm,
  },
  calcPreviewLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: colors.onSurfaceSecondary },
  calcPreviewVal: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: colors.brandPrimary, marginTop: 4 },
});
