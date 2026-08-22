import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import * as Haptics from "expo-haptics";
import Tesseract from "tesseract.js";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { addManyTransactions, addTransaction, getAccounts, getWageSettings } from "@/src/store";
import { Account, WageSettings } from "@/src/types";
import { CATEGORIES, getBackendUrl } from "@/src/constants";
import { formatTimeCost, rm, todayISO } from "@/src/format";
import { parseReceiptTextLocally } from "@/src/utils/receiptParser";
import { parseStatementTextLocally } from "@/src/utils/statementParser";
import { preprocessReceiptImage } from "@/src/utils/imagePreprocess";
import { AnimatedMascot } from "@/src/components/AnimatedMascot";

export default function ScanModal() {
  const router = useRouter();
  const [scanType, setScanType] = useState<"receipt" | "statement">("receipt");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);
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

  // Edit statement modal state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("Makan");
  const [editDate, setEditDate] = useState(todayISO());

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

  const handleSwitchTab = (type: "receipt" | "statement") => {
    if (type === scanType) return;
    Haptics.selectionAsync().catch(() => {});
    setScanType(type);
    setImageUri(null);
    setImageB64(null);
    setAmount("");
    setMerchant("");
    setNote("");
    setExtractStatus(null);
    setStatementTxns([]);
  };

  const getBase64FromUri = async (uri: string, existingB64?: string | null): Promise<string> => {
    if (existingB64 && existingB64.length > 50) return existingB64;
    if (uri.startsWith("data:")) {
      return uri.split(",")[1];
    }
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = (reader.result as string) || "";
          const b64 = res.includes(",") ? res.split(",")[1] : res;
          resolve(b64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not convert uri to base64 via blob:", e);
      return "";
    }
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.9,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setImageUri(asset.uri);
        const b64 = await getBase64FromUri(asset.uri, asset.base64);
        setImageB64(b64);
        processOCR(asset.uri, b64);
      }
    } catch (e: any) {
      Alert.alert("Picker Error", e?.message || "Failed to open photo library.");
    }
  };

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        setImageUri(asset.uri);
        const b64 = await getBase64FromUri(asset.uri);
        setImageB64(b64);
        processOCR(asset.uri, b64);
      }
    } catch (e: any) {
      Alert.alert("File Error", "Could not process document file.");
    }
  };

  const processOCR = async (rawUri: string, b64: string) => {
    setLoading(true);
    setExtractStatus(scanType === "receipt" ? "🔍 Reading receipt & extracting totals…" : "📄 Reading bank e-statement transactions…");
    const backendUrl = getBackendUrl();
    let extractedViaAI = false;

    // 1. Try Backend AI (Gemini Vision / OpenAI) with 22s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 22000);

      const endpoint = scanType === "receipt" ? `${backendUrl}/api/ocr/receipt` : `${backendUrl}/api/ocr/statement`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: b64 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (scanType === "receipt") {
          if (data.amount !== null && data.amount !== undefined && Number(data.amount) > 0) {
            setAmount(String(data.amount));
            if (data.merchant && data.merchant !== "Scanned Receipt") setMerchant(data.merchant);
            if (data.category && CATEGORIES.some((c) => c.key === data.category)) setCategory(data.category);
            if (data.date) setDate(data.date);
            if (data.note) setNote(data.note);
            extractedViaAI = true;
          }
        } else {
          if (data.transactions && data.transactions.length > 0) {
            setStatementTxns(data.transactions);
            extractedViaAI = true;
          }
        }
      }
    } catch (e) {
      console.log("Backend AI timeout or busy, proceeding to local OCR engine...");
    }

    // 2. High-Precision Client-Side Local OCR Fallback (Tesseract.js)
    if (!extractedViaAI) {
      try {
        setExtractStatus("⚙️ Enhancing image & running text analyzer…");
        const rawSource = rawUri.startsWith("blob:") || rawUri.startsWith("http")
          ? rawUri
          : `data:image/jpeg;base64,${b64}`;

        const preprocessedSource = await preprocessReceiptImage(rawSource);

        const result = await Tesseract.recognize(preprocessedSource, "eng", {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setExtractStatus(`🔍 Scanning: ${Math.round((m.progress || 0) * 100)}%`);
            }
          },
        });

        const recognizedText = result.data?.text || "";

        if (scanType === "receipt") {
          const parsed = parseReceiptTextLocally(recognizedText);
          if (parsed.amount && parsed.amount > 0) {
            setAmount(String(parsed.amount.toFixed(2)));
            extractedViaAI = true;
          }
          if (parsed.merchant) {
            setMerchant(parsed.merchant);
            extractedViaAI = true;
          }
          if (parsed.category && CATEGORIES.some((c) => c.key === parsed.category)) {
            setCategory(parsed.category);
          }
          if (parsed.date) {
            setDate(parsed.date);
          }
          if (parsed.note) {
            setNote(parsed.note);
          }
        } else {
          const txns = parseStatementTextLocally(recognizedText);
          if (txns && txns.length > 0) {
            setStatementTxns(txns);
            extractedViaAI = true;

            const lowerText = recognizedText.toLowerCase();
            const matchedAcc = accounts.find((a) => lowerText.includes(a.name.toLowerCase()));
            if (matchedAcc) setSelectedAccountId(matchedAcc.id);
          }
        }
      } catch (localErr) {
        console.warn("Client OCR error:", localErr);
      }
    }

    if (extractedViaAI) {
      if (scanType === "receipt") {
        setExtractStatus("✨ Receipt scanned & details extracted!");
      } else {
        setExtractStatus(`✨ Extracted ${statementTxns.length || "multiple"} statement transactions!`);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setExtractStatus("⚠️ Please check and confirm the details below.");
    }
    setLoading(false);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const openEditTxn = (idx: number) => {
    const item = statementTxns[idx];
    if (!item) return;
    Haptics.selectionAsync().catch(() => {});
    setEditingIndex(idx);
    setEditMerchant(item.merchant || "");
    setEditAmount(String(item.amount || ""));
    setEditCategory(item.category || "Makan");
    setEditDate(item.date || todayISO());
  };

  const saveEditTxn = () => {
    if (editingIndex === null) return;
    const num = parseFloat(editAmount) || 0;
    const updated = [...statementTxns];
    updated[editingIndex] = {
      ...updated[editingIndex],
      merchant: editMerchant.trim() || "Bank Transaction",
      amount: num,
      category: editCategory,
      date: editDate,
    };
    setStatementTxns(updated);
    setEditingIndex(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const deleteStatementTxn = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStatementTxns((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AnimatedMascot variant="detective" size={44} interactive={true} />
          <Text style={styles.title}>AI Scanner</Text>
        </View>
        <Pressable onPress={() => router.back()} testID="close-scan" hitSlop={8}>
          <Ionicons name="close-circle-outline" size={28} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      {/* Mode Selector with Tab Clearing */}
      <View style={styles.modeRow}>
        <Pressable
          testID="mode-receipt"
          onPress={() => handleSwitchTab("receipt")}
          style={[styles.modeTab, scanType === "receipt" && styles.modeTabActive]}
        >
          <Text style={[styles.modeText, scanType === "receipt" && styles.modeTextActive]}>Receipt / eWallet</Text>
        </Pressable>
        <Pressable
          testID="mode-statement"
          onPress={() => handleSwitchTab("statement")}
          style={[styles.modeTab, scanType === "statement" && styles.modeTabActive]}
        >
          <Text style={[styles.modeText, scanType === "statement" && styles.modeTextActive]}>Bank Statement</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Upload Action Area */}
        <View style={styles.uploadArea}>
          {imageUri ? (
            <View style={{ width: "100%", alignItems: "center" }}>
              <RNImage source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              {imageB64 && !loading && (
                <Pressable
                  style={styles.reExtractBtn}
                  onPress={() => processOCR(imageUri, imageB64)}
                >
                  <Ionicons name="sparkles" size={14} color={colors.brandPrimary} />
                  <Text style={styles.reExtractBtnText}>Re-Scan with AI</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="cloud-upload-outline" size={44} color={colors.brandPrimary} />
              <Text style={styles.placeholderTitle}>
                {scanType === "receipt" ? "Upload Receipt or eWallet Screenshot" : "Upload Bank e-Statement"}
              </Text>
              <Text style={styles.placeholderSub}>
                {scanType === "receipt"
                  ? "Touch 'n Go, MAE, DuitNow, McDonald's, FamilyMart, Petronas"
                  : "Maybank, CIMB, Public Bank, RHB, Hong Leong e-statements"}
              </Text>
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
            <Text style={styles.loadingText}>
              {extractStatus || "Reading receipt details and amount…"}
            </Text>
          </View>
        )}

        {extractStatus && !loading && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{extractStatus}</Text>
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
                <Text style={{ fontWeight: "700", fontSize: 12, color: colors.brandPrimary }}>
                  ⏱️ Work Time: {formatTimeCost(parseFloat(amount), wage.hourlyRate)}
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Merchant / Description</Text>
            <TextInput
              testID="scanned-merchant"
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Merchant name (e.g. McDonald's)"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setCategory(c.key);
                    }}
                    style={[styles.miniPill, category === c.key && styles.miniPillSelected]}
                  >
                    <Text style={{ fontSize: 12 }}>{c.emoji}</Text>
                    <Text style={[styles.miniPillText, category === c.key && styles.miniPillTextSelected]}>{c.key}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Target Account / Card</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {accounts.map((acc) => (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedAccountId(acc.id);
                    }}
                    style={[styles.miniPill, selectedAccountId === acc.id && styles.miniPillSelected]}
                  >
                    <Text style={{ fontSize: 12 }}>{acc.emoji}</Text>
                    <Text style={[styles.miniPillText, selectedAccountId === acc.id && styles.miniPillTextSelected]}>{acc.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Note / Memo (Optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. McFlurry & Fries"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.input}
            />

            <Pressable testID="save-scanned-receipt" onPress={handleSaveReceipt} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Confirm & Add Transaction</Text>
            </Pressable>
          </View>
        )}

        {/* Parsed Statement Transactions List with Edit & Delete */}
        {scanType === "statement" && statementTxns.length > 0 && (
          <View style={styles.formCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
              <Text style={styles.formTitle}>Extracted Statement ({statementTxns.length} txns)</Text>
              <Text style={{ fontWeight: "700", fontSize: 12, color: colors.brandPrimary }}>
                Total: {rm(statementTxns.reduce((s, t) => s + (t.amount || 0), 0))}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Import Into Account</Text>
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
                <Pressable style={{ flex: 1, gap: 2 }} onPress={() => openEditTxn(idx)}>
                  <Text style={styles.stMerchant} numberOfLines={1}>{t.merchant || "Bank Transaction"}</Text>
                  <Text style={styles.stSub}>{t.date} · {t.category}</Text>
                </Pressable>

                <View style={{ alignItems: "flex-end", marginRight: 10 }}>
                  <Text style={styles.stAmt}>{rm(t.amount || 0)}</Text>
                  <Text style={{ fontSize: 10, color: colors.brandPrimary, fontWeight: "600" }}>
                    ⏱️ {formatTimeCost(t.amount || 0, wage.hourlyRate)}
                  </Text>
                </View>

                {/* Edit & Delete Action Buttons */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Pressable hitSlop={6} style={styles.rowActionBtn} onPress={() => openEditTxn(idx)}>
                    <Ionicons name="pencil-outline" size={16} color={colors.brandPrimary} />
                  </Pressable>
                  <Pressable hitSlop={6} style={styles.rowActionBtnDelete} onPress={() => deleteStatementTxn(idx)}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable testID="save-scanned-statement" onPress={handleSaveStatement} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Import All {statementTxns.length} Transactions</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Edit Statement Transaction Popup Modal */}
      {editingIndex !== null && (
        <Modal visible={editingIndex !== null} transparent animationType="slide" onRequestClose={() => setEditingIndex(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Extracted Transaction ✏️</Text>
                <Pressable hitSlop={8} onPress={() => setEditingIndex(null)}>
                  <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Merchant / Description</Text>
              <TextInput
                value={editMerchant}
                onChangeText={setEditMerchant}
                placeholder="Merchant name"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.modalInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Amount (RM)</Text>
              <TextInput
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.modalInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Date (YYYY-MM-DD)</Text>
              <TextInput
                value={editDate}
                onChangeText={setEditDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.onSurfaceSecondary}
                style={styles.modalInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c.key}
                      onPress={() => setEditCategory(c.key)}
                      style={[styles.miniPill, editCategory === c.key && styles.miniPillSelected]}
                    >
                      <Text style={{ fontSize: 12 }}>{c.emoji}</Text>
                      <Text style={[styles.miniPillText, editCategory === c.key && styles.miniPillTextSelected]}>{c.key}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Pressable style={styles.submitBtn} onPress={saveEditTxn}>
                <Text style={styles.submitBtnText}>Save Transaction Changes</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
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
    marginBottom: spacing.md,
    ...shadow.card,
  },
  placeholderBox: { alignItems: "center", gap: 6, marginVertical: spacing.md },
  placeholderTitle: { fontWeight: "800", fontSize: 16, color: colors.onSurface },
  placeholderSub: { fontWeight: "400", fontSize: 12, color: colors.onSurfaceSecondary, textAlign: "center" },
  previewImage: { width: "100%", height: 200, borderRadius: radius.md, marginBottom: spacing.sm },
  reExtractBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  reExtractBtnText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 12,
  },
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
  loadingBox: { alignItems: "center", marginVertical: spacing.md, gap: 8 },
  loadingText: { fontWeight: "600", color: colors.brandPrimary, fontSize: 13 },
  statusBox: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statusText: {
    fontWeight: "600",
    fontSize: 13,
    color: colors.onSurface,
    textAlign: "center",
  },
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  stMerchant: { fontWeight: "700", fontSize: 14, color: colors.onSurface },
  stSub: { fontWeight: "400", fontSize: 11, color: colors.onSurfaceSecondary, marginTop: 1 },
  stAmt: { fontWeight: "800", fontSize: 14, color: colors.onSurface },
  rowActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowActionBtnDelete: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: 36,
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontWeight: "800",
    fontSize: 17,
    color: colors.onSurface,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontWeight: "700",
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
});
