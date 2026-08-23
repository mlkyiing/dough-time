import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { SyncSession, SyncStatus } from "@/src/types";
import {
  exportBackupJson,
  getSyncSession,
  importBackupJson,
  initOrGetSyncSession,
  pullCloudRestore,
  pushCloudBackup,
  subscribeSyncStatus,
} from "@/src/store";
import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  visible: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export function CloudSyncModal({ visible, onClose, onDataRestored }: Props) {
  const [session, setSession] = useState<SyncSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [inputSyncCode, setInputSyncCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJsonExport, setShowJsonExport] = useState(false);
  const [jsonString, setJsonString] = useState("");
  const [importJsonText, setImportJsonText] = useState("");
  const [showJsonImport, setShowJsonImport] = useState(false);

  useEffect(() => {
    if (!visible) return;

    initOrGetSyncSession().then((sess) => {
      setSession(sess);
    });

    const unsubscribe = subscribeSyncStatus((status, sess) => {
      setSyncStatus(status);
      if (sess) setSession(sess);
    });

    return () => unsubscribe();
  }, [visible]);

  const handleCopyCode = async () => {
    if (!session?.syncCode) return;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(session.syncCode);
      }
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert("Your Sync Code", session.syncCode);
    }
  };

  const handleManualSync = async () => {
    setIsProcessing(true);
    Haptics.selectionAsync().catch(() => {});
    const res = await pushCloudBackup();
    setIsProcessing(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Cloud Vault Synced! ☁️", "All your accounts, records, and settings are backed up safely.");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert("Sync Notice", res.message || "Could not sync to cloud. Offline changes are stored locally.");
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!inputSyncCode.trim()) {
      if (Platform.OS === "web") {
        window.alert("Please enter the 6-digit Sync Code from your other phone.");
      } else {
        Alert.alert("Enter Code", "Please enter the 6-digit Sync Code from your other phone.");
      }
      return;
    }

    const doRestore = async () => {
      setIsProcessing(true);
      const res = await pullCloudRestore(inputSyncCode.trim());
      setIsProcessing(false);

      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (Platform.OS === "web") {
          window.alert(res.message || "Your data has been restored.");
          setInputSyncCode("");
          if (onDataRestored) onDataRestored();
          onClose();
        } else {
          Alert.alert("Restored Successfully! 🎉", res.message || "Your data has been restored.", [
            {
              text: "Great!",
              onPress: () => {
                setInputSyncCode("");
                if (onDataRestored) onDataRestored();
                onClose();
              },
            },
          ]);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        if (Platform.OS === "web") {
          window.alert(res.message || "Could not find vault with this code.");
        } else {
          Alert.alert("Restore Failed", res.message || "Could not find vault with this code.");
        }
      }
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined"
        ? window.confirm(`Restore data from Sync Code "${inputSyncCode.trim().toUpperCase()}"?`)
        : true;
      if (ok) {
        await doRestore();
      }
      return;
    }

    Alert.alert(
      "Restore Data from Cloud?",
      `This will load the vault from Sync Code "${inputSyncCode.trim().toUpperCase()}". Local data will be synced with this vault.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore Vault",
          style: "default",
          onPress: doRestore,
        },
      ]
    );
  };

  const handleGenerateExport = async () => {
    setIsProcessing(true);
    const json = await exportBackupJson();
    setJsonString(json);
    setShowJsonExport(true);
    setIsProcessing(false);
    Haptics.selectionAsync().catch(() => {});
  };

  const [jsonCopied, setJsonCopied] = useState(false);

  const handleCopyJson = async () => {
    let success = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
        success = true;
      }
    } catch (e) {
      console.warn("Clipboard API failed, trying fallback:", e);
    }

    if (!success && Platform.OS === "web" && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = jsonString;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
    }

    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2500);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (Platform.OS === "web") {
      window.alert("Backup JSON copied to clipboard! 📋");
    } else {
      Alert.alert("Copied! 📋", "Backup JSON copied to clipboard. Save it somewhere safe!");
    }
  };

  const handleDownloadJson = () => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
      try {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `doughtime_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        window.alert("Backup file downloaded! 💾");
        return;
      } catch (e) {
        console.error("Download failed:", e);
      }
    }
    handleCopyJson();
  };

  const handlePerformJsonImport = async () => {
    if (!importJsonText.trim()) {
      if (Platform.OS === "web") {
        window.alert("Please paste your exported backup JSON text.");
      } else {
        Alert.alert("Paste JSON", "Please paste your exported backup JSON text.");
      }
      return;
    }

    setIsProcessing(true);
    const res = await importBackupJson(importJsonText);
    setIsProcessing(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (Platform.OS === "web") {
        window.alert(res.message || "Data imported successfully! 🎉");
        setShowJsonImport(false);
        setImportJsonText("");
        if (onDataRestored) onDataRestored();
        onClose();
      } else {
        Alert.alert("Import Successful! 💾", res.message || "Data imported.", [
          {
            text: "Awesome",
            onPress: () => {
              setShowJsonImport(false);
              setImportJsonText("");
              if (onDataRestored) onDataRestored();
              onClose();
            },
          },
        ]);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (Platform.OS === "web") {
        window.alert(res.message || "Failed to parse backup JSON.");
      } else {
        Alert.alert("Import Error", res.message || "Failed to parse backup JSON.");
      }
    }
  };

  const formatLastSync = (iso?: string) => {
    if (!iso) return "Not synced yet";
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSecs < 30) return "Synced just now";
      if (diffSecs < 60) return "Synced 1 minute ago";
      if (diffSecs < 3600) return `Synced ${Math.floor(diffSecs / 60)} mins ago`;
      if (diffSecs < 86400) return `Synced today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      return `Synced on ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    } catch {
      return "Recently";
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.cloudIconBadge}>
                <Ionicons name="cloud-done" size={22} color={colors.brandPrimary} />
              </View>
              <View>
                <Text style={styles.title}>Cloud Backup & Sync</Text>
                <Text style={styles.subtitle}>Never lose your data when changing phones</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusPill}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          syncStatus === "syncing"
                            ? "#F59E0B"
                            : syncStatus === "offline"
                            ? "#94A3B8"
                            : syncStatus === "error"
                            ? "#EF4444"
                            : "#10B981",
                      },
                    ]}
                  />
                  <Text style={styles.statusPillText}>
                    {syncStatus === "syncing"
                      ? "Syncing to Cloud..."
                      : syncStatus === "offline"
                      ? "Offline Storage"
                      : syncStatus === "error"
                      ? "Sync Issue"
                      : "Cloud Vault Active"}
                  </Text>
                </View>

                {isProcessing && <ActivityIndicator size="small" color={colors.brandPrimary} />}
              </View>

              <Text style={styles.lastSyncText}>{formatLastSync(session?.lastSyncedAt)}</Text>
              <Text style={styles.statusDesc}>
                Auto-syncs your accounts, expenses, and salary settings securely.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.syncNowBtn, pressed && { opacity: 0.88 }]}
                onPress={handleManualSync}
                disabled={isProcessing}
              >
                <Ionicons name="sync" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.syncNowBtnText}>
                  {isProcessing ? "Syncing..." : "Backup & Sync Now"}
                </Text>
              </Pressable>
            </View>

            {/* Personal Phone Sync Code Card */}
            <View style={styles.codeCard}>
              <View style={styles.codeCardHeader}>
                <Text style={styles.sectionTitle}>📱 Your Phone Sync Code</Text>
                <AnimatedMascot variant="celebrate" size={32} />
              </View>
              <Text style={styles.codeInstruction}>
                Keep this code! If you change phones or rebuild the app, just type this code on the new phone to restore all data:
              </Text>

              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{session?.syncCode || "GENERATING..."}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.copyBtn,
                    copied && styles.copyBtnDone,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={handleCopyCode}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={16}
                    color={copied ? "#10B981" : colors.brandPrimary}
                  />
                  <Text style={[styles.copyBtnText, copied && { color: "#10B981" }]}>
                    {copied ? "Copied!" : "Copy"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Restore from Another Phone / Clean Rebuild */}
            <View style={styles.restoreCard}>
              <Text style={styles.sectionTitle}>🔄 Switching to a New Phone?</Text>
              <Text style={styles.restoreDesc}>
                Enter the 6-digit Sync Code from your old phone to load your data here:
              </Text>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="e.g. DT-839-214"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  value={inputSyncCode}
                  onChangeText={setInputSyncCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.restoreBtn,
                    (!inputSyncCode.trim() || isProcessing) && styles.restoreBtnDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleRestoreFromCloud}
                  disabled={!inputSyncCode.trim() || isProcessing}
                >
                  <Text style={styles.restoreBtnText}>Restore</Text>
                </Pressable>
              </View>
            </View>

            {/* Offline JSON Backup Options */}
            <View style={styles.backupOptions}>
              <Text style={styles.optionsTitle}>💾 Offline File Backup</Text>
              <View style={styles.optionRow}>
                <Pressable
                  style={({ pressed }) => [styles.optionPill, pressed && { opacity: 0.8 }]}
                  onPress={handleGenerateExport}
                >
                  <Ionicons name="download-outline" size={16} color={colors.onSurface} />
                  <Text style={styles.optionPillText}>Export JSON</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.optionPill, pressed && { opacity: 0.8 }]}
                  onPress={() => setShowJsonImport(!showJsonImport)}
                >
                  <Ionicons name="push-outline" size={16} color={colors.onSurface} />
                  <Text style={styles.optionPillText}>Import JSON</Text>
                </Pressable>
              </View>

              {/* JSON Export Viewer */}
              {showJsonExport && (
                <View style={styles.jsonBox}>
                  <View style={styles.jsonHeader}>
                    <Text style={styles.jsonTitle}>Exported Data Bundle</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pressable onPress={handleDownloadJson} style={styles.miniBtn}>
                        <Ionicons name="download" size={14} color={colors.brandPrimary} />
                        <Text style={styles.miniBtnText}>Download .json</Text>
                      </Pressable>
                      <Pressable onPress={handleCopyJson} style={styles.miniBtn}>
                        <Ionicons
                          name={jsonCopied ? "checkmark" : "copy-outline"}
                          size={14}
                          color={jsonCopied ? "#10B981" : colors.brandPrimary}
                        />
                        <Text style={[styles.miniBtnText, jsonCopied && { color: "#10B981" }]}>
                          {jsonCopied ? "Copied!" : "Copy Text"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  <ScrollView style={styles.jsonScroll} nestedScrollEnabled={true}>
                    <Text style={styles.jsonCode}>{jsonString}</Text>
                  </ScrollView>
                </View>
              )}

              {/* JSON Import Box */}
              {showJsonImport && (
                <View style={styles.jsonBox}>
                  <Text style={styles.jsonTitle}>Paste JSON Backup Content:</Text>
                  <TextInput
                    style={styles.jsonInput}
                    multiline={true}
                    numberOfLines={4}
                    placeholder="Paste { ... } here"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    value={importJsonText}
                    onChangeText={setImportJsonText}
                  />
                  <Pressable
                    style={({ pressed }) => [styles.importSubmitBtn, pressed && { opacity: 0.85 }]}
                    onPress={handlePerformJsonImport}
                  >
                    <Text style={styles.importSubmitText}>Import and Replace Vault</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: "90%",
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 34 : spacing.xl,
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cloudIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 6,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  lastSyncText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurface,
    marginTop: 4,
  },
  statusDesc: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    lineHeight: 16,
  },
  syncNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: 6,
  },
  syncNowBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onBrandPrimary,
  },
  codeCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    gap: 8,
  },
  codeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  codeInstruction: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    lineHeight: 16,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  codeText: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#166534",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  copyBtnDone: {
    backgroundColor: "#DCFCE7",
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  restoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 8,
  },
  restoreDesc: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  restoreBtn: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreBtnDisabled: {
    opacity: 0.45,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onBrandPrimary,
  },
  backupOptions: {
    gap: 8,
    marginTop: 4,
  },
  optionsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
  },
  optionPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  jsonBox: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: 8,
    gap: 8,
  },
  jsonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  jsonTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  miniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  jsonScroll: {
    maxHeight: 120,
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: radius.sm,
  },
  jsonCode: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.onSurface,
  },
  jsonInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 8,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.onSurface,
    minHeight: 70,
    textAlignVertical: "top",
  },
  importSubmitBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  importSubmitText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
