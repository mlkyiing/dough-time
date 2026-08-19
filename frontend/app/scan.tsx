import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { addManyTransactions, addTransaction, getAccounts, getWageSettings } from "@/src/store";
import { Account, WageSettings } from "@/src/types";
import { CATEGORIES, getBackendUrl } from "@/src/constants";
import { formatTimeCost, todayISO } from "@/src/format";

export default function ScanModal() {
  const router = useRouter();
  const [scanType, setScanType] = useState<"receipt" | "statement">("receipt");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Parsed single transaction fields
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Makan");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  // Parsed statement transactions list
  const [statementTxns, setStatementTxns] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const accs = await getAccounts();
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
    })();
  }, []);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.8,
    });
    if (!res.canceled && res.assets && res.assets[0]) {
      const asset = res.assets[0];
      setImageUri(asset.uri);
      setImageB64(asset.base64 || null);
      if (asset.base64) {
        processOCR(asset.base64);
      }
    }
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets && res.assets[0]) {
      const asset = res.assets[0];
      setImageUri(asset.uri);
      // document picker assets may not have base64 directly, so use pickImage or fetch blob
      // for images:
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = (reader.result as string).split(",")[1];
          setImageB64(b64);
          processOCR(b64);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        Alert.alert("File Error", "Could not process document file.");
      }
    }
  };

  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });

  useEffect(() => {
    (async () => {
      const [accs, w] = await Promise.all([getAccounts(), getWageSettings()]);
      setAccounts(accs);
      setWage(w);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
    })();
  }, []);

  const processOCR = async (b64: string) => {
    setLoading(true);
    const backendUrl = getBackendUrl();
    try {
      if (scanType === "receipt") {
        const res = await fetch(`${backendUrl}/api/ocr/receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: b64 }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.amount !== null) setAmount(String(data.amount));
        if (data.merchant) setMerchant(data.merchant);
        if (data.category && CATEGORIES.some((c) => c.key === data.category)) setCategory(data.category);
        if (data.date) setDate(data.date);
        if (data.note) setNote(data.note);
      } else {
        const res = await fetch(`${backendUrl}/api/ocr/statement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: b64 }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStatementTxns(data.transactions || []);
      }
    } catch (e: any) {
      Alert.alert("OCR Failed", e.message || "Failed to process image with Gemini AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReceipt = async () => {
    const amtNum = parseFloat(amount);
    if (!amtNum || amtNum <= 0 || !selectedAccountId) {
      Alert.alert("Invalid Data", "Please enter a valid amount and select an account.");
      return;
    }
    await addTransaction({
      amount: amtNum,
      category,
      accountId: selectedAccountId,
      merchant: merchant.trim() || "Receipt Scan",
      note: note.trim() || undefined,
      date: date || todayISO(),
    });
    router.back();
  };

  const handleSaveStatement = async () => {
    if (!statementTxns.length || !selectedAccountId) return;
    const formatted = statementTxns.map((t) => ({
      amount: t.amount || 0,
      category: t.category || "Other",
      accountId: selectedAccountId,
      merchant: t.merchant || "Statement Import",
      note: t.note || undefined,
      date: t.date || todayISO(),
    }));
    await addManyTransactions(formatted);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Receipt & Statement Scan 📸</Text>
        <Pressable onPress={() => router.back()} testID="close-scan">
          <Ionicons name="close-circle-outline" size={28} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      {/* Mode Selector */}
      <View style={styles.modeRow}>
        <Pressable
          testID="mode-receipt"
          onPress={() => { setScanType("receipt"); setStatementTxns([]); }}
          style={[styles.modeTab, scanType === "receipt" && styles.modeTabActive]}
        >
          <Text style={[styles.modeText, scanType === "receipt" && styles.modeTextActive]}>Receipt / eWallet</Text>
        </Pressable>
        <Pressable
          testID="mode-statement"
          onPress={() => { setScanType("statement"); setAmount(""); }}
          style={[styles.modeTab, scanType === "statement" && styles.modeTabActive]}
        >
          <Text style={[styles.modeText, scanType === "statement" && styles.modeTextActive]}>Bank Statement</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Upload Action Area */}
        <View style={styles.uploadArea}>
          {imageUri ? (
            <RNImage source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="cloud-upload-outline" size={44} color={colors.brandPrimary} />
              <Text style={styles.placeholderTitle}>Upload Receipt or Bank Statement</Text>
              <Text style={styles.placeholderSub}>Touch 'n Go, MAE, GrabPay, Maybank, CIMB receipts</Text>
            </View>
          )}

          <View style={styles.btnRow}>
            <Pressable testID="pick-photo-btn" onPress={pickImage} style={styles.actionBtn}>
              <Ionicons name="images-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.actionBtnText}>Pick Image</Text>
            </Pressable>
            <Pressable testID="pick-doc-btn" onPress={pickDocument} style={styles.actionBtnSecondary}>
              <Ionicons name="document-text-outline" size={18} color={colors.brandPrimary} />
              <Text style={styles.actionBtnSecondaryText}>Pick Document</Text>
            </Pressable>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.loadingText}>Gemini AI is reading receipt details…</Text>
          </View>
        )}

        {/* Parsed Single Receipt Results Form */}
        {scanType === "receipt" && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Extracted Transaction</Text>

            <Text style={styles.fieldLabel}>Amount (RM)</Text>
            <TextInput
              testID="scanned-amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.input}
            />
            {parseFloat(amount) > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 8 }}>
                <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 12, color: colors.brandPrimary }}>
                  ⏱️ Work Time: {formatTimeCost(parseFloat(amount), wage.hourlyRate)}
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Merchant / Description</Text>
            <TextInput
              testID="scanned-merchant"
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Merchant name"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[styles.miniPill, category === c.key && styles.miniPillSelected]}
                  >
                    <Text style={{ fontSize: 12 }}>{c.emoji}</Text>
                    <Text style={[styles.miniPillText, category === c.key && styles.miniPillTextSelected]}>{c.key}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Target Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {accounts.map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedAccountId(acc.id)}
                    style={[styles.miniPill, selectedAccountId === acc.id && styles.miniPillSelected]}
                  >
                    <Text style={{ fontSize: 12 }}>{acc.emoji}</Text>
                    <Text style={[styles.miniPillText, selectedAccountId === acc.id && styles.miniPillTextSelected]}>{acc.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable testID="save-scanned-receipt" onPress={handleSaveReceipt} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Confirm & Add Transaction</Text>
            </Pressable>
          </View>
        )}

        {/* Parsed Statement Transactions List */}
        {scanType === "statement" && statementTxns.length > 0 && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Extracted Statement ({statementTxns.length} txns)</Text>

            <Text style={styles.fieldLabel}>Target Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {accounts.map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedAccountId(acc.id)}
                    style={[styles.miniPill, selectedAccountId === acc.id && styles.miniPillSelected]}
                  >
                    <Text style={{ fontSize: 12 }}>{acc.emoji}</Text>
                    <Text style={[styles.miniPillText, selectedAccountId === acc.id && styles.miniPillTextSelected]}>{acc.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {statementTxns.map((t, idx) => (
              <View key={idx} style={styles.statementRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stMerchant}>{t.merchant || "Expense"}</Text>
                  <Text style={styles.stSub}>{t.date} · {t.category}</Text>
                </View>
                <Text style={styles.stAmt}>RM {t.amount?.toFixed(2)}</Text>
              </View>
            ))}

            <Pressable testID="save-scanned-statement" onPress={handleSaveStatement} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Import All {statementTxns.length} Transactions</Text>
            </Pressable>
          </View>
        )}
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
  title: { fontWeight: "800", fontSize: 20, color: colors.onSurface, letterSpacing: -0.3 },
  modeRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modeTabActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
    ...shadow.soft,
  },
  modeText: { fontWeight: "700", fontSize: 13, color: colors.onSurfaceSecondary },
  modeTextActive: { color: colors.onBrandPrimary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  uploadArea: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  placeholderBox: { alignItems: "center", gap: 6, marginVertical: spacing.md },
  placeholderTitle: { fontWeight: "800", fontSize: 16, color: colors.onSurface },
  placeholderSub: { fontWeight: "400", fontSize: 12, color: colors.onSurfaceSecondary, textAlign: "center" },
  previewImage: { width: "100%", height: 200, borderRadius: radius.md, marginBottom: spacing.md },
  btnRow: { flexDirection: "row", gap: spacing.md, width: "100%", marginTop: spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glow,
  },
  actionBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnSecondaryText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  loadingBox: { alignItems: "center", marginVertical: spacing.lg, gap: 10 },
  loadingText: { fontWeight: "600", color: colors.brandPrimary },
  formCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  formTitle: { fontWeight: "800", fontSize: 18, color: colors.onSurface, marginBottom: spacing.md },
  fieldLabel: { fontWeight: "700", fontSize: 12, color: colors.onSurfaceSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontWeight: "600",
    fontSize: 14,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  miniPillSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  miniPillText: { fontWeight: "600", fontSize: 12, color: colors.onSurface },
  miniPillTextSelected: { color: colors.onBrandPrimary, fontWeight: "700" },
  submitBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadow.glow,
  },
  submitBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  statementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  stMerchant: { fontWeight: "700", fontSize: 14, color: colors.onSurface },
  stSub: { fontWeight: "400", fontSize: 11, color: colors.onSurfaceSecondary },
  stAmt: { fontWeight: "800", fontSize: 14, color: colors.onSurface },
});
