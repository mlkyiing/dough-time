import { useEffect, useState, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { addTransaction, getAccounts, getWageSettings, transferFunds } from "@/src/store";
import { Account, BudgetBucket, WageSettings, isLiabilityAccount } from "@/src/types";
import { CATEGORIES, INCOME_CATEGORIES } from "@/src/constants";
import { AccountSelectDropdown } from "@/src/components/AccountSelectDropdown";
import {
  amountToWorkHours,
  formatTimeCost,
  getBobaReaction,
  rm,
  todayISO,
} from "@/src/format";

const BUCKET_OPTIONS: { key: BudgetBucket; label: string; emoji: string }[] = [
  { key: "needs", label: "Must-Haves", emoji: "🍞" },
  { key: "comfort", label: "Comfort", emoji: "🎁" },
  { key: "savings", label: "Savings", emoji: "📈" },
];

export default function QuickAddModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    category?: string;
    merchant?: string;
    note?: string;
    type?: string;
    from?: string;
    to?: string;
  }>();

  const [recordType, setRecordType] = useState<"expense" | "income" | "transfer">(
    (params.type as any) || "expense"
  );
  const [amountStr, setAmountStr] = useState(params.amount ? String(params.amount) : "0");
  const [category, setCategory] = useState<string>(
    params.category || (params.type === "income" ? "Salary" : "Makan")
  );
  const [bucket, setBucket] = useState<BudgetBucket | undefined>(undefined);
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [merchant, setMerchant] = useState<string>(params.merchant || "");
  const [note, setNote] = useState<string>(params.note || "");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [accs, w] = await Promise.all([getAccounts(), getWageSettings()]);
      setAccounts(accs);
      setWage(w);
      if (accs.length > 0) {
        const defaultFrom = params.from || accs[0].id;
        setAccountId(defaultFrom);
        const defaultTo =
          params.to ||
          accs.find((a) => a.id !== defaultFrom && isLiabilityAccount(a.type))?.id ||
          accs.find((a) => a.id !== defaultFrom)?.id ||
          accs[0].id;
        setToAccountId(defaultTo);
      }
    })();
  }, [params.from, params.to]);

  const handleKeyPress = (val: string) => {
    Haptics.selectionAsync().catch(() => {});

    if (val === "DEL") {
      if (amountStr.length <= 1) {
        setAmountStr("0");
      } else {
        setAmountStr(amountStr.slice(0, -1));
      }
      return;
    }

    if (val === ".") {
      if (amountStr.includes(".")) return;
      setAmountStr(amountStr + ".");
      return;
    }

    if (amountStr === "0") {
      setAmountStr(val);
    } else {
      const parts = amountStr.split(".");
      if (parts.length > 1 && parts[1].length >= 2) return;
      setAmountStr(amountStr + val);
    }
  };

  const currentAmt = parseFloat(amountStr) || 0;
  const workHours = amountToWorkHours(currentAmt, wage.hourlyRate);
  const reaction = getBobaReaction(workHours);
  const timeFormatted = formatTimeCost(currentAmt, wage.hourlyRate);
  const isIncome = recordType === "income";
  const isTransfer = recordType === "transfer";

  const fromAcc = accounts.find((a) => a.id === accountId);
  const toAcc = accounts.find((a) => a.id === toAccountId);
  const isToLoanOrDebt = toAcc ? isLiabilityAccount(toAcc.type) : false;

  const handleSave = async () => {
    const amt = parseFloat(amountStr);
    if (!amt || amt <= 0 || !accountId) return;
    setSaving(true);
    try {
      if (isTransfer) {
        if (!toAccountId || accountId === toAccountId) {
          setSaving(false);
          return;
        }
        await transferFunds({
          fromAccountId: accountId,
          toAccountId,
          amount: amt,
          note: note.trim() || undefined,
          category: isToLoanOrDebt ? "Loan / Debt" : "Transfer",
          date: todayISO(),
        });
      } else {
        await addTransaction({
          type: recordType,
          amount: amt,
          category: isIncome ? category : category,
          bucket: isIncome ? undefined : bucket,
          accountId,
          merchant: merchant.trim() || undefined,
          note: note.trim() || undefined,
          date: todayISO(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      console.error("Failed to add transaction", e);
    } finally {
      setSaving(false);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "DEL"];

  const handleClose = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* 1. PINNED HEADER */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image
            source={
              isIncome
                ? require("@/assets/mascot_rich.jpg")
                : isTransfer
                ? require("@/assets/mascot_zen.jpg")
                : require("@/assets/mascot.jpg")
            }
            style={{ width: 34, height: 34, borderRadius: 17 }}
          />
          <Text style={styles.title}>
            {isIncome
              ? "Deposit Income 💰"
              : isTransfer
              ? isToLoanOrDebt
                ? "Deduct Loan Repayment 💸"
                : "Account Transfer 🔁"
              : "Quick Add Expense 💸"}
          </Text>
        </View>
        <Pressable onPress={handleClose} testID="close-quick-add" hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Ionicons name="close-circle" size={30} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      {/* 2. PINNED AMOUNT & CONVERTER SECTION (ALWAYS VISIBLE ABOVE KEYPAD) */}
      <View style={styles.pinnedAmountCard}>
        {/* Segmented Control Toggle: Expense | Income | Transfer */}
        <View style={styles.typeToggleWrapper}>
          <Pressable
            style={[styles.typeToggleBtn, recordType === "expense" && styles.typeToggleBtnActiveExpense]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setRecordType("expense");
              if (INCOME_CATEGORIES.some((c) => c.key === category)) {
                setCategory("Makan");
              }
            }}
          >
            <Text style={[styles.typeToggleText, recordType === "expense" && styles.typeToggleTextActive]}>
              💸 Expense
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeToggleBtn, recordType === "income" && styles.typeToggleBtnActiveIncome]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setRecordType("income");
              if (CATEGORIES.some((c) => c.key === category)) {
                setCategory("Salary");
              }
            }}
          >
            <Text style={[styles.typeToggleText, recordType === "income" && styles.typeToggleTextActive]}>
              💰 Income
            </Text>
          </Pressable>
          <Pressable
            style={[styles.typeToggleBtn, recordType === "transfer" && styles.typeToggleBtnActiveTransfer]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setRecordType("transfer");
            }}
          >
            <Text style={[styles.typeToggleText, recordType === "transfer" && styles.typeToggleTextActive]}>
              🔁 Transfer
            </Text>
          </Pressable>
        </View>

        {/* Large Amount Display with Clear Indicator */}
        <View style={styles.amountDisplayRow}>
          <Text
            style={[
              styles.currencySymbol,
              isIncome && { color: "#059669" },
              isTransfer && { color: colors.brandPrimary },
            ]}
          >
            {isIncome ? "+RM" : "RM"}
          </Text>
          <Text
            style={[
              styles.amountText,
              isIncome && { color: "#059669" },
              isTransfer && { color: colors.brandPrimary },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {amountStr}
          </Text>
        </View>

        {/* Compact Life Work-Time Badge */}
        <View style={styles.timeBadgeRow}>
          <View
            style={[
              styles.timeBadge,
              isIncome
                ? { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }
                : isTransfer
                ? { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }
                : { backgroundColor: colors.surfaceTertiary, borderColor: reaction.color },
            ]}
          >
            <Text style={styles.timeBadgeIcon}>{isIncome ? "🌿" : isTransfer ? "🔁" : "⏱️"}</Text>
            <Text style={styles.timeBadgeText}>
              {isIncome ? (
                <>
                  Earns <Text style={{ fontWeight: "800", color: "#059669" }}>+{timeFormatted}</Text> of freedom (+{workHours.toFixed(1)}h)
                </>
              ) : isTransfer ? (
                isToLoanOrDebt ? (
                  <>
                    Clears <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{timeFormatted}</Text> of debt ({workHours.toFixed(1)}h work)
                  </>
                ) : (
                  <>
                    Moving <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{rm(currentAmt)}</Text> ({workHours.toFixed(1)}h work value)
                  </>
                )
              ) : (
                <>
                  Costs <Text style={{ fontWeight: "800", color: colors.brandPrimary }}>{timeFormatted}</Text> of work ({workHours.toFixed(1)}h)
                </>
              )}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. MIDDLE CONFIGURATION AREA (COMPACT SCROLL) */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.middleScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isTransfer ? (
          /* TRANSFER SELECTION */
          <View style={styles.transferConfigBox}>
            <View style={styles.transferDropdownWrap}>
              <AccountSelectDropdown
                label="From Account"
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  if (toAccountId === id) {
                    const nextTo = accounts.find((a) => a.id !== id)?.id || "";
                    setToAccountId(nextTo);
                  }
                }}
                accounts={accounts.filter((a) => !isLiabilityAccount(a.type) || a.balance > 0)}
                modalTitle="Select Source Account"
              />

              <View style={styles.transferDividerRow}>
                <View style={styles.transferDividerLine} />
                <View style={styles.transferDividerBadge}>
                  <Ionicons name="arrow-down" size={14} color={colors.brandPrimary} />
                </View>
                <View style={styles.transferDividerLine} />
              </View>

              <AccountSelectDropdown
                label={isToLoanOrDebt ? "To (Repaying Loan / Debt)" : "To Account"}
                value={toAccountId}
                onChange={setToAccountId}
                accounts={accounts}
                excludeId={accountId}
                modalTitle={isToLoanOrDebt ? "Select Loan / Debt to Repay" : "Select Destination Account"}
                isDebtTarget={isToLoanOrDebt}
              />
            </View>

            {/* Note input for transfer */}
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={isToLoanOrDebt ? "Memo (e.g. Monthly Car Loan Repayment)" : "Note / Transfer Memo (optional)"}
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.compactInput}
            />
          </View>
        ) : (
          /* EXPENSE OR INCOME CONFIGURATION */
          <>
            {/* Category selection */}
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.fieldLabel}>{isIncome ? "INCOME CATEGORY" : "CATEGORY"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(isIncome ? INCOME_CATEGORIES : CATEGORIES).map((cat) => {
                  const isSel = category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setCategory(cat.key);
                      }}
                      style={[
                        styles.catPill,
                        isSel && (isIncome ? styles.catPillIncomeActive : styles.catPillActive),
                      ]}
                    >
                      <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
                      <Text style={[styles.catPillText, isSel && styles.catPillTextActive]}>{cat.key}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Account selection */}
            <AccountSelectDropdown
              label={isIncome ? "Receiving Account" : "Paid Via Account"}
              value={accountId}
              onChange={setAccountId}
              accounts={accounts}
              modalTitle={isIncome ? "Select Receiving Account" : "Select Payment Account"}
            />

            {/* Compact Merchant & Note Row */}
            <View style={styles.inputsRow}>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder={isIncome ? "Payer (e.g. Employer)" : "Merchant (e.g. Tealive)"}
                placeholderTextColor={colors.onSurfaceSecondary}
                style={[styles.compactInput, { flex: 1 }]}
              />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Memo (optional)"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={[styles.compactInput, { flex: 1 }]}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* 4. PINNED KEYPAD & SAVE BUTTON AT THE BOTTOM */}
      <View style={styles.bottomKeypadContainer}>
        <View style={styles.keypadGrid}>
          {keys.map((k) => (
            <Pressable
              key={k}
              onPress={() => handleKeyPress(k)}
              style={({ pressed }) => [styles.keyBtn, pressed && { backgroundColor: colors.borderStrong }]}
            >
              {k === "DEL" ? (
                <Ionicons name="backspace-outline" size={22} color={colors.onSurface} />
              ) : (
                <Text style={styles.keyBtnText}>{k}</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Save Transaction Button */}
        <Pressable
          testID="save-txn-btn"
          onPress={handleSave}
          disabled={saving || currentAmt <= 0}
          style={[
            styles.saveBtn,
            isIncome && { backgroundColor: "#10B981" },
            isTransfer && { backgroundColor: isToLoanOrDebt ? "#059669" : colors.brandPrimary },
            (saving || currentAmt <= 0) && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.saveBtnText}>
            {saving
              ? "Saving…"
              : isIncome
              ? `Deposit Income · ${rm(currentAmt)}`
              : isTransfer
              ? isToLoanOrDebt
                ? `Deduct Repayment · ${rm(currentAmt)} 💸`
                : `Transfer Funds · ${rm(currentAmt)} 🔁`
              : `Save Expense · ${rm(currentAmt)} 🍞`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontWeight: "800",
    fontSize: 16,
    color: colors.onSurface,
  },
  pinnedAmountCard: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "center",
  },
  typeToggleWrapper: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: 3,
    borderRadius: radius.pill,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "center",
  },
  typeToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  typeToggleBtnActiveExpense: {
    backgroundColor: "#EF4444",
  },
  typeToggleBtnActiveIncome: {
    backgroundColor: "#10B981",
  },
  typeToggleBtnActiveTransfer: {
    backgroundColor: colors.brandPrimary,
  },
  typeToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  typeToggleTextActive: {
    color: "#FFFFFF",
  },
  amountDisplayRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginVertical: 2,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: "800",
    color: "#EF4444",
    marginRight: 4,
  },
  amountText: {
    fontSize: 38,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: -1,
  },
  timeBadgeRow: {
    marginTop: 4,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  timeBadgeIcon: {
    fontSize: 12,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurface,
  },
  middleScrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catPillActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  catPillIncomeActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  catPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurface,
  },
  catPillTextActive: {
    color: "#FFFFFF",
  },
  accChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  accChipIncomeActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  accChipName: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurface,
  },
  accChipNameActive: {
    color: "#FFFFFF",
  },
  accChipBal: {
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  accChipBalActive: {
    color: "rgba(255,255,255,0.85)",
  },
  inputsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  compactInput: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    color: colors.onSurface,
  },
  transferConfigBox: {
    gap: 8,
    marginVertical: 4,
  },
  transferDropdownWrap: {
    gap: 4,
  },
  transferDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -2,
    gap: 8,
  },
  transferDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  transferDividerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FDF2F8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },
  compactAccPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactAccPillActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  compactAccPillDebt: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  compactAccText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.onSurface,
  },
  compactAccTextActive: {
    color: "#FFFFFF",
  },
  bottomKeypadContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
  },
  keypadGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  keyBtn: {
    width: "31%",
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: 6,
  },
  keyBtnText: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.onSurface,
  },
  saveBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: 4,
    ...shadow.glow,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
