import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
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
import { addTransaction, getAccounts, getWageSettings } from "@/src/store";
import { Account, WageSettings } from "@/src/types";
import { CATEGORIES } from "@/src/constants";
import {
  amountToWorkHours,
  formatTimeCost,
  getBobaReaction,
  todayISO,
} from "@/src/format";

export default function QuickAddModal() {
  const router = useRouter();
  const [amountStr, setAmountStr] = useState("0");
  const [category, setCategory] = useState<string>("Makan");
  const [accountId, setAccountId] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [note, setNote] = useState<string>("");
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
      if (accs.length > 0) setAccountId(accs[0].id);
    })();
  }, []);

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

  const handleSave = async () => {
    const amt = parseFloat(amountStr);
    if (!amt || amt <= 0 || !accountId) return;
    setSaving(true);
    try {
      await addTransaction({
        amount: amt,
        category,
        accountId,
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        date: todayISO(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      console.error("Failed to add transaction", e);
    } finally {
      setSaving(false);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "DEL"];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image
            source={require("@/assets/mascot.jpg")}
            style={{ width: 32, height: 32, borderRadius: 16 }}
          />
          <Text style={styles.title}>Quick Add Expense</Text>
        </View>
        <Pressable onPress={() => router.back()} testID="close-quick-add" hitSlop={8}>
          <Ionicons name="close-circle-outline" size={28} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Amount Display */}
        <View style={styles.amountBox}>
          <Text style={styles.currencySymbol}>RM</Text>
          <Text style={styles.amountText}>{amountStr}</Text>
        </View>

        {/* Live Money -> Work Time Conversion Pill */}
        <View style={[styles.timeConverterPill, { borderColor: reaction.color }]}>
          <View style={styles.mascotSmallWrap}>
            <Image
              source={require("@/assets/mascot_coin.jpg")}
              style={{ width: 36, height: 36 }}
              contentFit="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.timeConverterTitle}>
              Costs <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>{timeFormatted}</Text> of your life
            </Text>
            <Text style={styles.timeConverterDesc}>
              {reaction.desc} (at RM {wage.hourlyRate.toFixed(2)}/hr)
            </Text>
          </View>
        </View>

        {/* Categories Pills */}
        <Text style={styles.sectionLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={styles.pillRow}>
            {CATEGORIES.map((cat) => {
              const isSel = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  testID={`cat-pill-${cat.key}`}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCategory(cat.key);
                  }}
                  style={[styles.pill, isSel && styles.pillSelected]}
                >
                  <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                  <Text style={[styles.pillText, isSel && styles.pillTextSelected]}>{cat.key}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Account Pills */}
        <Text style={styles.sectionLabel}>Account</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={styles.pillRow}>
            {accounts.map((acc) => {
              const isSel = accountId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  testID={`acc-pill-${acc.id}`}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAccountId(acc.id);
                  }}
                  style={[styles.pill, isSel && styles.pillSelected, { borderLeftColor: acc.color, borderLeftWidth: 3 }]}
                >
                  <Text style={{ fontSize: 16 }}>{acc.emoji}</Text>
                  <Text style={[styles.pillText, isSel && styles.pillTextSelected]}>{acc.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Merchant & Note Inputs */}
        <View style={styles.inputsRow}>
          <TextInput
            testID="merchant-input"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Merchant (e.g. Tealive, Gigi Coffee)"
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.input}
          />
          <TextInput
            testID="note-input"
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.input}
          />
        </View>

        {/* Numeric Keypad */}
        <View style={styles.keypad}>
          {keys.map((k) => (
            <Pressable
              key={k}
              testID={`keypad-${k}`}
              onPress={() => handleKeyPress(k)}
              style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.borderStrong }]}
            >
              {k === "DEL" ? (
                <Ionicons name="backspace-outline" size={24} color={colors.onSurface} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Save Button */}
        <Pressable
          testID="save-txn-btn"
          onPress={handleSave}
          disabled={saving || currentAmt <= 0}
          style={[styles.saveBtn, (saving || currentAmt <= 0) && { opacity: 0.5 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Expense"}</Text>
        </Pressable>
      </ScrollView>
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
  title: {
    fontWeight: "800",
    fontSize: 20,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  amountBox: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginVertical: spacing.md,
    gap: 6,
  },
  currencySymbol: {
    fontWeight: "700",
    fontSize: 22,
    color: colors.onSurfaceSecondary,
  },
  amountText: {
    fontWeight: "800",
    fontSize: 44,
    color: colors.onSurface,
    letterSpacing: -0.8,
  },
  timeConverterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  mascotSmallWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  timeConverterTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: colors.onSurface,
  },
  timeConverterDesc: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillSelected: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  pillText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
  },
  pillTextSelected: {
    color: colors.onBrandPrimary,
  },
  inputsRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontWeight: "600",
    fontSize: 14,
    color: colors.onSurface,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginVertical: spacing.md,
  },
  key: {
    width: "31%",
    aspectRatio: 2,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.soft,
  },
  keyText: {
    fontWeight: "700",
    fontSize: 22,
    color: colors.onSurface,
  },
  saveBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.glow,
  },
  saveBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
    fontSize: 16,
  },
});
