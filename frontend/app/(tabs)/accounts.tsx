import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import {
  calculateHourlyRate,
  deleteAccount,
  getAccounts,
  getWageSettings,
  initOrGetSyncSession,
  newAccountId,
  setWageSettings,
  subscribeSyncStatus,
  upsertAccount,
} from "@/src/store";
import { Account, AccountType, isAssetAccount, isLiabilityAccount, SyncSession, SyncStatus, WageSettings } from "@/src/types";
import { ACCOUNT_TEMPLATES, AccountTemplate } from "@/src/constants";
import { amountToWorkHours, rm } from "@/src/format";

type TabFilter = "all" | "bank_ewallet" | "credit_card" | "fd" | "loan";

import { LoanReminderModal } from "@/src/components/LoanReminderModal";
import { EditAccountModal } from "@/src/components/EditAccountModal";
import { AnimatedMascot } from "@/src/components/AnimatedMascot";
import { CloudSyncModal } from "@/src/components/CloudSyncModal";
import { CuteAppBackground } from "@/src/components/CuteAppBackground";
import { TransferModal } from "@/src/components/TransferModal";
import { LoanDueBanner } from "@/src/components/LoanDueBanner";
import { getDueLoanReminders, DueLoanInfo } from "@/src/utils/notifications";

export default function Accounts() {
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [reminderAccount, setReminderAccount] = useState<Account | null>(null);
  const [wage, setWage] = useState<WageSettings>({
    mode: "salary",
    monthlySalary: 4500,
    hoursPerWeek: 40,
    hourlyRate: 25.96,
    currency: "RM",
  });
  const [activeFilter, setActiveFilter] = useState<TabFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<"bank_ewallet" | "credit_card" | "fd" | "loan">("bank_ewallet");
  const [wageModalOpen, setWageModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncSession, setSyncSession] = useState<SyncSession | null>(null);
  const [tempSalary, setTempSalary] = useState("4500");
  const [tempHours, setTempHours] = useState("40");

  // Transfer & Repayment Modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | undefined>();
  const [transferToId, setTransferToId] = useState<string | undefined>();
  const [transferPrefillAmount, setTransferPrefillAmount] = useState<number | undefined>();
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);

  // Custom account form fields
  const [customName, setCustomName] = useState("");
  const [customBalance, setCustomBalance] = useState("");
  const [customType, setCustomType] = useState<AccountType>("bank");
  const [customLimit, setCustomLimit] = useState("");
  const [customRate, setCustomRate] = useState("");

  const load = useCallback(async () => {
    const [a, w, sess] = await Promise.all([getAccounts(), getWageSettings(), initOrGetSyncSession()]);
    setAccounts(a);
    setWage(w);
    setSyncSession(sess);
    setTempSalary(String(w.monthlySalary));
    setTempHours(String(w.hoursPerWeek));
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const unsub = subscribeSyncStatus((st, sess) => {
      setSyncStatus(st);
      if (sess) setSyncSession(sess);
    });
    return () => unsub();
  }, [load]));

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

  const addTemplate = async (tpl: AccountTemplate) => {
    await upsertAccount({
      id: newAccountId(),
      name: tpl.name,
      type: tpl.type,
      emoji: tpl.emoji,
      color: tpl.color,
      balance: 0,
      creditLimit: tpl.defaultLimit,
      interestRate: tpl.defaultRate,
    });
    setPickerOpen(false);
    load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const addCustom = async () => {
    if (!customName.trim()) return;
    const bal = parseFloat(customBalance) || 0;
    const limit = parseFloat(customLimit) || undefined;
    const rate = parseFloat(customRate) || undefined;

    let emoji = "💳";
    if (customType === "bank") emoji = "🏦";
    if (customType === "ewallet") emoji = "🚗";
    if (customType === "fd") emoji = "📈";
    if (customType === "loan") emoji = "🚘";
    if (customType === "cash") emoji = "💵";

    await upsertAccount({
      id: newAccountId(),
      name: customName.trim(),
      type: customType,
      emoji,
      color: customType === "loan" || customType === "credit_card" ? "#EF4444" : colors.brandPrimary,
      balance: bal,
      creditLimit: limit,
      interestRate: rate,
    });
    setCustomName("");
    setCustomBalance("");
    setCustomLimit("");
    setCustomRate("");
    setPickerOpen(false);
    load();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const remove = (a: Account) => {
    const doDelete = async () => {
      await deleteAccount(a.id);
      load();
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(`Delete ${a.name}? Transactions linked to this account will stay.`) : true;
      if (ok) {
        doDelete();
      }
      return;
    }

    Alert.alert(`Delete ${a.name}?`, "Transactions linked to this account will stay.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  };

  // Financial calculations
  const totalAssets = useMemo(
    () => accounts.filter(isAssetAccount).reduce((s, a) => s + a.balance, 0),
    [accounts]
  );

  const totalLiabilities = useMemo(
    () => accounts.filter(isLiabilityAccount).reduce((s, a) => s + a.balance, 0),
    [accounts]
  );

  const netWorth = totalAssets - totalLiabilities;
  const netWorthHours =
    netWorth >= 0
      ? amountToWorkHours(netWorth, wage.hourlyRate)
      : -amountToWorkHours(Math.abs(netWorth), wage.hourlyRate);

  const filteredAccounts = useMemo(() => {
    if (activeFilter === "all") return accounts;
    if (activeFilter === "bank_ewallet") return accounts.filter((a) => a.type === "bank" || a.type === "ewallet" || a.type === "cash");
    if (activeFilter === "credit_card") return accounts.filter((a) => a.type === "credit_card");
    if (activeFilter === "fd") return accounts.filter((a) => a.type === "fd" || a.type === "investment");
    if (activeFilter === "loan") return accounts.filter((a) => a.type === "loan");
    return accounts;
  }, [accounts, activeFilter]);

  const templateList = useMemo(
    () => ACCOUNT_TEMPLATES.filter((t) => t.category === pickerCategory),
    [pickerCategory]
  );

  const dueReminders = useMemo(() => {
    return getDueLoanReminders(accounts, wage.hourlyRate).filter(
      (r) => !dismissedReminders.includes(r.account.id)
    );
  }, [accounts, wage.hourlyRate, dismissedReminders]);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { paddingTop: Platform.OS === "web" ? Math.max(insets.top, 14) : 0 },
      ]}
      edges={["top"]}
    >
      <CuteAppBackground />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>Accounts</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Net Worth: <Text style={{ fontWeight: "800", color: netWorth >= 0 ? "#059669" : "#DC2626" }}>{rm(netWorth)}</Text>
            {` · ${netWorthHours >= 0 ? `+${netWorthHours.toFixed(0)}h saved` : `${Math.abs(netWorthHours).toFixed(0)}h debt`}`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            testID="transfer-btn"
            style={({ pressed }) => [styles.transferBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setTransferFromId(undefined);
              setTransferToId(undefined);
              setTransferPrefillAmount(undefined);
              setTransferModalOpen(true);
            }}
          >
            <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
            <Text style={styles.transferBtnText}>Transfer</Text>
          </Pressable>
          <Pressable
            testID="add-account-btn"
            style={({ pressed }) => [styles.iconBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setPickerOpen(true);
            }}
          >
            <Ionicons name="add" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* In-App Due Loan Reminder Banner */}
        <LoanDueBanner
          reminders={dueReminders}
          onPayPress={(info) => {
            setTransferToId(info.account.id);
            setTransferPrefillAmount(info.installment);
            setTransferModalOpen(true);
          }}
          onDismiss={(id) => {
            setDismissedReminders((prev) => [...prev, id]);
          }}
        />

        {/* Net Worth Summary Card (Assets vs Liabilities) */}
        <View style={styles.netWorthCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md }}>
            <AnimatedMascot variant="rich" size={42} interactive={true} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", fontSize: 14, color: colors.onSurface }}>DoughTime Vault & Stash 🪙</Text>
              <Text style={{ fontWeight: "600", fontSize: 11, color: colors.onSurfaceSecondary }}>
                True Net Worth: <Text style={{ color: netWorth >= 0 ? "#059669" : "#DC2626", fontWeight: "800" }}>{rm(netWorth)}</Text>
                {` (${netWorthHours >= 0 ? `+${netWorthHours.toFixed(1)}h freedom` : `${netWorthHours.toFixed(1)}h debt`})`}
              </Text>
            </View>
          </View>
          <View style={styles.nwRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.nwLabel}>Total Assets</Text>
              <Text style={styles.nwAssetVal}>+{rm(totalAssets)}</Text>
              <Text style={styles.nwSub}>Bank, eWallets, FD</Text>
            </View>
            <View style={styles.nwDivider} />
            <View style={{ flex: 1, gap: 2, alignItems: "flex-end" }}>
              <Text style={styles.nwLabel}>Liabilities / Debt</Text>
              <Text style={styles.nwDebtVal}>-{rm(totalLiabilities)}</Text>
              <Text style={styles.nwSub}>Cards & Loans</Text>
            </View>
          </View>
        </View>

        {/* Compact Quick Utilities Row: Cloud Sync & Wage Setting */}
        <View style={styles.utilityStrip}>
          {/* Cloud Vault Pill */}
          <Pressable
            style={({ pressed }) => [styles.utilityPill, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSyncModalOpen(true);
            }}
          >
            <View style={styles.utilityIconWrap}>
              <Ionicons
                name={
                  syncStatus === "syncing"
                    ? "sync"
                    : syncStatus === "offline"
                    ? "cloud-offline"
                    : "cloud-done"
                }
                size={16}
                color={colors.brandPrimary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={styles.utilityTitle} numberOfLines={1}>Cloud Vault</Text>
                <View
                  style={[
                    styles.syncDotSmall,
                    {
                      backgroundColor:
                        syncStatus === "syncing"
                          ? "#F59E0B"
                          : syncStatus === "offline"
                          ? "#94A3B8"
                          : "#10B981",
                    },
                  ]}
                />
              </View>
              <Text style={styles.utilitySub} numberOfLines={1}>
                {syncSession?.syncCode ? syncSession.syncCode : "Synced"}
              </Text>
            </View>
          </Pressable>

          {/* Wage Rate Pill */}
          <Pressable
            style={({ pressed }) => [styles.utilityPill, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setWageModalOpen(true);
            }}
          >
            <View style={[styles.utilityIconWrap, { backgroundColor: "#FEF9C3" }]}>
              <Text style={{ fontSize: 13 }}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.utilityTitle} numberOfLines={1}>Hourly Wage</Text>
              <Text style={styles.utilitySub} numberOfLines={1}>
                RM {wage.hourlyRate.toFixed(2)}/hr
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Category Segment Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: spacing.md }}
        >
          {[
            { key: "all", label: "All Accounts" },
            { key: "bank_ewallet", label: "💰 Bank & Cash" },
            { key: "credit_card", label: "💳 Credit Cards" },
            { key: "fd", label: "📈 Fixed Deposit" },
            { key: "loan", label: "🚘 Loans" },
          ].map((tab) => {
            const isSel = activeFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveFilter(tab.key as TabFilter);
                }}
                style={[
                  styles.filterTab,
                  isSel && styles.filterTabActive,
                ]}
              >
                <Text style={[styles.filterTabText, isSel && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Account List */}
        {filteredAccounts.map((a) => {
          const isDebt = isLiabilityAccount(a.type);
          const accHours = amountToWorkHours(a.balance, wage.hourlyRate);

          return (
            <Pressable
              key={a.id}
              testID={`account-${a.id}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setEditingAccount(a);
              }}
              onLongPress={() => remove(a)}
              style={({ pressed }) => [
                styles.accountCard,
                { borderLeftColor: a.color },
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.accountEmojiBox}>
                <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.accountName}>{a.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={styles.accountType}>
                    {a.type === "credit_card"
                      ? "CREDIT CARD"
                      : a.type === "fd"
                      ? `FD · ${a.interestRate || 3.8}% p.a.`
                      : a.type === "loan"
                      ? `LOAN · ${a.interestRate || 3.5}% interest`
                      : a.type.toUpperCase()}
                  </Text>
                  {a.creditLimit && (
                    <Text style={styles.limitTag}>Limit {rm(a.creditLimit)}</Text>
                  )}
                  {isDebt && a.dueDay && (
                    <Pressable
                      style={styles.dueBadge}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Haptics.selectionAsync().catch(() => {});
                        setReminderAccount(a);
                      }}
                    >
                      <Text style={styles.dueBadgeText}>
                        🔔 {a.dueDay}th {a.monthlyInstallment ? `(${rm(a.monthlyInstallment)}/mo)` : ""}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Quick Repayment & Calculation Actions for Loans & Debt */}
                {isDebt && (
                  <View style={styles.debtActionsRow}>
                    <Pressable
                      style={styles.repayPillBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Haptics.selectionAsync().catch(() => {});
                        setTransferToId(a.id);
                        setTransferPrefillAmount(a.monthlyInstallment || a.balance);
                        setTransferModalOpen(true);
                      }}
                    >
                      <Ionicons name="swap-horizontal" size={12} color="#FFFFFF" />
                      <Text style={styles.repayPillBtnText}>Deduct Repayment</Text>
                    </Pressable>
                    <Pressable
                      style={styles.calcPillBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Haptics.selectionAsync().catch(() => {});
                        setReminderAccount(a);
                      }}
                    >
                      <Ionicons name="calculator-outline" size={12} color={colors.brandPrimary} />
                      <Text style={styles.calcPillBtnText}>Calculator / Remind</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={{ alignItems: "flex-end", gap: 1 }}>
                <Text style={[styles.accountBalance, isDebt && { color: "#EF4444" }]}>
                  {isDebt ? `-${rm(a.balance)}` : rm(a.balance)}
                </Text>
                <Text style={styles.accountHours}>
                  ⏱️ {accHours.toFixed(1)}h {isDebt ? "to pay off" : "worth"}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {filteredAccounts.length === 0 && (
          <View style={styles.emptyBox}>
            <Image
              source={require("@/assets/mascot.jpg")}
              style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }}
            />
            <Text style={styles.emptyTitle}>No accounts found in this category</Text>
            <Text style={styles.emptyText}>Tap + to add a credit card, bank, FD, or loan.</Text>
          </View>
        )}
      </ScrollView>

      {/* Edit & Delete Account Modal */}
      <EditAccountModal
        visible={!!editingAccount}
        account={editingAccount}
        wage={wage}
        onClose={() => setEditingAccount(null)}
        onSave={async (updated, note) => {
          await upsertAccount(updated, note);
          load();
        }}
        onDelete={async (id) => {
          await deleteAccount(id);
          load();
        }}
      />

      {/* Loan & Repayment Reminder Modal */}
      <LoanReminderModal
        visible={!!reminderAccount}
        account={reminderAccount}
        wage={wage}
        onClose={() => setReminderAccount(null)}
        onSave={async (updated) => {
          await upsertAccount(updated);
          load();
        }}
        onOpenTransfer={(acc) => {
          setTransferToId(acc.id);
          setTransferPrefillAmount(acc.monthlyInstallment || acc.balance);
          setTransferModalOpen(true);
        }}
      />

      {/* Transfer & Repayment Modal */}
      <TransferModal
        visible={transferModalOpen}
        accounts={accounts}
        wage={wage}
        preselectedFromId={transferFromId}
        preselectedToId={transferToId}
        prefillAmount={transferPrefillAmount}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={() => load()}
      />

      {/* Account Picker Modal with Tabs */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandleBar} />

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Account / Card / Loan</Text>
                <Text style={styles.modalSubTitle}>Choose a template or enter custom details</Text>
              </View>
              <Pressable
                hitSlop={12}
                onPress={() => setPickerOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            {/* Modal Category Selector - Horizontal Pill Bar */}
            <View style={{ marginBottom: spacing.md }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {[
                  { key: "bank_ewallet", label: "Bank & eWallet", emoji: "📱" },
                  { key: "credit_card", label: "Credit Card", emoji: "💳" },
                  { key: "fd", label: "FD / Stash", emoji: "📈" },
                  { key: "loan", label: "Loans", emoji: "🏦" },
                ].map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPickerCategory(c.key as any);
                    }}
                    style={[
                      styles.modalCatPill,
                      pickerCategory === c.key && styles.modalCatPillActive,
                    ]}
                  >
                    <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
                    <Text
                      style={[
                        styles.modalCatText,
                        pickerCategory === c.key && styles.modalCatTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <Text style={styles.modalSectionLabel}>Quick Add Malaysian Options</Text>
              <View style={styles.templateGrid}>
                {templateList.map((t) => (
                  <Pressable
                    key={t.name}
                    style={({ pressed }) => [
                      styles.templateBtn,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => addTemplate(t)}
                  >
                    <View style={styles.templateEmojiBox}>
                      <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={styles.templateName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      {t.defaultRate ? (
                        <Text style={styles.templateRateText}>
                          {t.type === "loan" ? `Interest: ${t.defaultRate}%` : `${t.defaultRate}% p.a.`}
                        </Text>
                      ) : t.defaultLimit ? (
                        <Text style={styles.templateLimitText}>
                          Limit {rm(t.defaultLimit)}
                        </Text>
                      ) : (
                        <Text style={styles.templateSubText}>Tap to add</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.modalSectionLabel, { marginTop: spacing.lg }]}>Or Add Custom Details</Text>
              <TextInput
                placeholder="Account / Card / Loan Name"
                placeholderTextColor={colors.onSurfaceSecondary}
                value={customName}
                onChangeText={setCustomName}
                style={styles.modalInput}
              />
              <TextInput
                placeholder="Current Balance / Owed (RM 0.00)"
                placeholderTextColor={colors.onSurfaceSecondary}
                value={customBalance}
                onChangeText={setCustomBalance}
                keyboardType="decimal-pad"
                style={[styles.modalInput, { marginTop: spacing.sm }]}
              />

              {pickerCategory === "credit_card" && (
                <TextInput
                  placeholder="Credit Limit (e.g. RM 8000)"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  value={customLimit}
                  onChangeText={setCustomLimit}
                  keyboardType="numeric"
                  style={[styles.modalInput, { marginTop: spacing.sm }]}
                />
              )}

              {(pickerCategory === "fd" || pickerCategory === "loan") && (
                <TextInput
                  placeholder="Interest / Return Rate % (e.g. 3.85)"
                  placeholderTextColor={colors.onSurfaceSecondary}
                  value={customRate}
                  onChangeText={setCustomRate}
                  keyboardType="numeric"
                  style={[styles.modalInput, { marginTop: spacing.sm }]}
                />
              )}

              <Pressable
                style={styles.customAddBtn}
                onPress={() => {
                  setCustomType(
                    pickerCategory === "credit_card"
                      ? "credit_card"
                      : pickerCategory === "fd"
                      ? "fd"
                      : pickerCategory === "loan"
                      ? "loan"
                      : "bank"
                  );
                  addCustom();
                }}
              >
                <Text style={styles.customAddBtnText}>Save Account</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Wage Settings Modal */}
      <Modal visible={wageModalOpen} animationType="fade" transparent onRequestClose={() => setWageModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Image
                  source={require("@/assets/mascot.jpg")}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
                <Text style={styles.modalTitle}>Set Your Work Wage</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setWageModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.inputLabel}>Monthly Take-Home Salary (RM)</Text>
              <TextInput
                value={tempSalary}
                onChangeText={setTempSalary}
                keyboardType="numeric"
                style={styles.modalInput}
                placeholder="4500"
                placeholderTextColor={colors.onSurfaceSecondary}
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Working Hours Per Week</Text>
              <TextInput
                value={tempHours}
                onChangeText={setTempHours}
                keyboardType="numeric"
                style={styles.modalInput}
                placeholder="40"
                placeholderTextColor={colors.onSurfaceSecondary}
              />

              <View style={styles.calcPreviewBox}>
                <Text style={styles.calcPreviewLabel}>Calculated Hourly Value:</Text>
                <Text style={styles.calcPreviewVal}>
                  RM {calculateHourlyRate(parseFloat(tempSalary) || 0, parseFloat(tempHours) || 40).toFixed(2)} / hr
                </Text>
              </View>

              <Pressable style={styles.saveWageBtn} onPress={handleSaveWage}>
                <Text style={styles.saveWageBtnText}>Save Hourly Rate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cloud Sync Modal */}
      <CloudSyncModal
        visible={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onDataRestored={load}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, overflow: "hidden" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  title: {
    fontWeight: "800",
    fontSize: 22,
    color: colors.onSurface,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  transferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    ...shadow.glow,
  },
  transferBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  iconBtn: {
    backgroundColor: colors.brandPrimary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glow,
  },
  debtActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  repayPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  repayPillBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  calcPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  calcPillBtnText: {
    color: colors.brandPrimary,
    fontSize: 10,
    fontWeight: "700",
  },
  netWorthCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.soft,
  },
  utilityStrip: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  utilityPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.soft,
  },
  utilityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  utilityTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurface,
  },
  utilitySub: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginTop: 1,
  },
  cloudVaultBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: "#BBF7D0",
    ...shadow.soft,
  },
  cloudVaultLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  cloudVaultIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  cloudVaultTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  cloudVaultSub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  syncDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nwRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nwLabel: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  nwAssetVal: {
    fontWeight: "800",
    fontSize: 20,
    color: "#10B981",
    letterSpacing: -0.3,
  },
  nwDebtVal: {
    fontWeight: "800",
    fontSize: 20,
    color: "#EF4444",
    letterSpacing: -0.3,
  },
  nwSub: {
    fontWeight: "500",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  nwDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },
  wageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.soft,
  },
  wageCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  wageIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  wageCardTitle: {
    fontWeight: "700",
    fontSize: 13,
    color: colors.onSurface,
  },
  wageCardSub: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.brandPrimary,
  },
  wageCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  wageCardBadgeText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: 11,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  filterTabActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
    ...shadow.soft,
  },
  filterTabText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
  },
  filterTabTextActive: {
    color: colors.onBrandPrimary,
  },
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
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    fontWeight: "700",
    fontSize: 14,
    color: colors.onSurface,
  },
  accountType: {
    fontWeight: "600",
    fontSize: 10,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  limitTag: {
    fontWeight: "600",
    fontSize: 10,
    color: colors.brandPrimary,
    marginTop: 2,
  },
  accountBalance: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onSurface,
  },
  accountHours: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.brandPrimary,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onSurface,
  },
  emptyText: {
    fontWeight: "500",
    color: colors.onSurfaceSecondary,
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
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
    paddingBottom: 40,
    ...shadow.card,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  modalSubTitle: {
    fontWeight: "500",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalCatPillActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
    ...shadow.soft,
  },
  modalCatText: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  modalCatTextActive: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
  },
  modalSectionLabel: {
    fontWeight: "800",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  templateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "48.5%",
    ...shadow.soft,
  },
  templateEmojiBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  templateName: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
  },
  templateRateText: {
    fontSize: 10,
    color: colors.brandPrimary,
    fontWeight: "700",
  },
  templateLimitText: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
  },
  templateSubText: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
    fontWeight: "500",
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontWeight: "600",
    fontSize: 14,
    color: colors.onSurface,
  },
  customAddBtn: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadow.glow,
  },
  customAddBtnText: {
    color: colors.onBrandPrimary,
    fontWeight: "800",
    fontSize: 14,
  },
  inputLabel: {
    fontWeight: "700",
    fontSize: 12,
    color: colors.onSurface,
    marginBottom: 6,
  },
  calcPreviewBox: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginVertical: spacing.md,
  },
  calcPreviewLabel: {
    fontWeight: "600",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  calcPreviewVal: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.brandPrimary,
    marginTop: 4,
  },
  saveWageBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.glow,
  },
  saveWageBtnText: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onBrandPrimary,
  },
  dueBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  dueBadgeText: {
    color: "#B45309",
    fontWeight: "700",
    fontSize: 10,
  },
});
