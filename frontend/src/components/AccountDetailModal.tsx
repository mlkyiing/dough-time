import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { Account, isAssetAccount, isLiabilityAccount, Transaction } from "@/src/types";
import { amountToWorkHours, rm, shortDate } from "@/src/format";
import { deleteTransaction, getTransactions } from "@/src/store";
import { categoryMeta } from "@/src/constants";

interface Props {
  visible: boolean;
  account: Account | null;
  accounts: Account[];
  hourlyRate: number;
  onClose: () => void;
  onEditAccount: (account: Account) => void;
  onTransferPress: (fromAccId?: string, toAccId?: string, prefillAmt?: number) => void;
  onAddTxnPress: (accId: string) => void;
  onTxnPress: (txn: Transaction) => void;
  onAccountUpdated?: () => void;
}

type TxnFilter = "all" | "inflow" | "outflow";

export function AccountDetailModal({
  visible,
  account,
  accounts,
  hourlyRate,
  onClose,
  onEditAccount,
  onTransferPress,
  onAddTxnPress,
  onTxnPress,
  onAccountUpdated,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeFilter, setActiveFilter] = useState<TxnFilter>("all");
  const [loading, setLoading] = useState(false);

  const loadTxns = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const all = await getTransactions();
      // Filter transactions that touch this account (either source or destination)
      const filtered = all.filter(
        (t) => t.accountId === account.id || t.toAccountId === account.id
      );
      setTransactions(filtered);
    } catch (e) {
      console.warn("Failed to load account transactions", e);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (visible && account) {
      loadTxns();
      setActiveFilter("all");
    }
  }, [visible, account, loadTxns]);

  const isDebt = account ? isLiabilityAccount(account.type) : false;
  const isLoan = account?.type === "loan";
  const isCard = account?.type === "credit_card";
  const accHours = account ? amountToWorkHours(account.balance, hourlyRate) : 0;

  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const currentMonthName = useMemo(() => new Date().toLocaleString("default", { month: "long" }), []);

  // Classify transactions into Inflow vs Outflow relative to this account
  const categorizedTxns = useMemo(() => {
    if (!account) return [];
    return transactions.map((t) => {
      let isInflow = false;
      let isOutflow = false;
      let flowLabel = "";
      let counterpartName = "";

      if (t.type === "transfer") {
        if (t.toAccountId === account.id) {
          isInflow = true;
          const fromAcc = accounts.find((a) => a.id === t.accountId);
          counterpartName = fromAcc ? fromAcc.name : "External Source";
          flowLabel = isDebt ? "Repayment Inflow" : "Transfer In";
        } else {
          isOutflow = true;
          const toAcc = accounts.find((a) => a.id === t.toAccountId);
          counterpartName = toAcc ? toAcc.name : "Destination";
          flowLabel = "Transfer Out";
        }
      } else if (t.type === "income") {
        isInflow = true;
        flowLabel = "Income Deposit";
        counterpartName = t.merchant || t.category;
      } else {
        // Expense
        isOutflow = true;
        flowLabel = isDebt ? "Card Spending" : "Expense";
        counterpartName = t.merchant || t.category;
      }

      return {
        ...t,
        isInflow,
        isOutflow,
        flowLabel,
        counterpartName,
      };
    });
  }, [transactions, account?.id, accounts, isDebt]);

  // Compute monthly Inflow and Outflow totals for current month
  const monthlyStats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const t of categorizedTxns) {
      if (t.date.slice(0, 7) !== currentMonth) continue;
      if (t.isInflow) totalInflow += t.amount;
      if (t.isOutflow) totalOutflow += t.amount;
    }

    return {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
    };
  }, [categorizedTxns, currentMonth]);

  // Check if loan is paid for current month
  const isLoanPaidThisMonth = useMemo(() => {
    if (!isLoan || !account) return false;
    if (account.lastRepaymentMonth === currentMonth) return true;
    return categorizedTxns.some(
      (t) =>
        t.isInflow &&
        t.date.slice(0, 7) === currentMonth &&
        (t.type === "transfer" || t.category === "Loan / Debt")
    );
  }, [isLoan, account?.lastRepaymentMonth, currentMonth, categorizedTxns]);

  // Filtered list based on active tab
  const displayTxns = useMemo(() => {
    if (activeFilter === "inflow") return categorizedTxns.filter((t) => t.isInflow);
    if (activeFilter === "outflow") return categorizedTxns.filter((t) => t.isOutflow);
    return categorizedTxns;
  }, [categorizedTxns, activeFilter]);

  const handleDeleteTxn = (t: Transaction) => {
    Alert.alert(
      "Delete Transaction?",
      `Remove "${t.merchant || t.category}" (${rm(t.amount)})? Your account balance will be restored.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            await deleteTransaction(t.id);
            await loadTxns();
            onAccountUpdated?.();
          },
        },
      ]
    );
  };

  const getAccountTypeLabel = () => {
    if (!account) return "";
    switch (account.type) {
      case "credit_card":
        return "CREDIT CARD";
      case "loan":
        return account.loanType ? `${account.loanType.toUpperCase()} LOAN` : "LOAN";
      case "fd":
        return "FIXED DEPOSIT";
      case "investment":
        return "INVESTMENT";
      case "ewallet":
        return "E-WALLET";
      default:
        return "BANK ACCOUNT";
    }
  };

  if (!visible || !account) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.accountEmojiBox, { backgroundColor: account.color ? `${account.color}20` : "#EEF2FF" }]}>
                <Text style={{ fontSize: 26 }}>{account.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {account.name}
                </Text>
                <Text style={styles.accountType}>{getAccountTypeLabel()}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                style={styles.headerActionBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onEditAccount(account);
                }}
                hitSlop={6}
              >
                <Ionicons name="settings-outline" size={18} color={colors.onSurface} />
              </Pressable>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={6}>
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ padding: spacing.md }} showsVerticalScrollIndicator={false}>
            {/* Balance Hero Card */}
            <View style={[styles.heroCard, isDebt && styles.heroCardDebt]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={styles.heroLabel}>
                    {isDebt ? "TOTAL OUTSTANDING DEBT" : "CURRENT BALANCE"}
                  </Text>
                  <Text style={[styles.heroBalance, isDebt && { color: "#EF4444" }]}>
                    {isDebt ? `-${rm(account.balance)}` : rm(account.balance)}
                  </Text>
                </View>

                <View style={[styles.hoursPill, isDebt && styles.hoursPillDebt]}>
                  <Ionicons name="time-outline" size={14} color={isDebt ? "#DC2626" : colors.brandPrimary} />
                  <Text style={[styles.hoursPillText, isDebt && { color: "#DC2626" }]}>
                    {accHours.toFixed(1)}h {isDebt ? "debt work" : "life energy"}
                  </Text>
                </View>
              </View>

              {/* Loan Specific Status */}
              {isLoan && (
                <View style={styles.loanStatusBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={styles.loanDetailSub}>
                      Installment: <Text style={{ fontWeight: "800", color: colors.onSurface }}>{account.monthlyInstallment ? rm(account.monthlyInstallment) : "—"}</Text> · Due {account.dueDay ? `${account.dueDay}th` : "Monthly"}
                    </Text>
                    {isLoanPaidThisMonth ? (
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#059669" />
                        <Text style={styles.paidBadgeText}>Paid for {currentMonthName} ✅</Text>
                      </View>
                    ) : (
                      <View style={styles.dueBadge}>
                        <Ionicons name="alert-circle" size={13} color="#D97706" />
                        <Text style={styles.dueBadgeText}>Installment Due</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Credit Card Specific Status */}
              {isCard && (
                <View style={styles.loanStatusBox}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.loanDetailSub}>
                      Statement: <Text style={{ fontWeight: "800", color: colors.onSurface }}>{rm(account.statementBalance !== undefined ? account.statementBalance : account.balance)}</Text>
                    </Text>
                    {account.statementCleared ? (
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#059669" />
                        <Text style={styles.paidBadgeText}>Statement Paid ✅</Text>
                      </View>
                    ) : (
                      <View style={styles.dueBadge}>
                        <Ionicons name="time-outline" size={13} color="#D97706" />
                        <Text style={styles.dueBadgeText}>Due {account.dueDay ? `${account.dueDay}th` : "Soon"}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Monthly Inflow / Outflow Summary Strip */}
              <View style={styles.summaryStrip}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>THIS MONTH IN (+)</Text>
                  <Text style={[styles.statVal, { color: "#059669" }]}>
                    +{rm(monthlyStats.totalInflow)}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>THIS MONTH OUT (-)</Text>
                  <Text style={[styles.statVal, { color: "#EF4444" }]}>
                    -{rm(monthlyStats.totalOutflow)}
                  </Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>NET FLOW</Text>
                  <Text style={[styles.statVal, { color: monthlyStats.netFlow >= 0 ? "#059669" : "#DC2626" }]}>
                    {monthlyStats.netFlow >= 0 ? `+${rm(monthlyStats.netFlow)}` : `-${rm(Math.abs(monthlyStats.netFlow))}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions Row */}
            <View style={styles.quickActionsRow}>
              {isLoan ? (
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: isLoanPaidThisMonth ? "#059669" : "#EA580C" }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onTransferPress(undefined, account.id, account.monthlyInstallment || account.balance);
                  }}
                >
                  <Ionicons name={isLoanPaidThisMonth ? "checkmark-circle" : "swap-horizontal"} size={16} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>
                    {isLoanPaidThisMonth ? "Deduct Extra / Advance" : "Deduct Repayment Now"}
                  </Text>
                </Pressable>
              ) : isCard ? (
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: "#6366F1" }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onTransferPress(undefined, account.id, account.statementBalance !== undefined ? account.statementBalance : account.balance);
                  }}
                >
                  <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>Pay Card Statement</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: colors.brandPrimary }]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onTransferPress(account.id);
                  }}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>Transfer</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.secondaryActionBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onAddTxnPress(account.id);
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.onSurface} />
                <Text style={styles.secondaryActionBtnText}>Add Record</Text>
              </Pressable>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterSection}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.sectionHeaderTitle}>ACCOUNT ACTIVITY & TRANSACTIONS</Text>
                <Text style={styles.txnCountText}>{displayTxns.length} records</Text>
              </View>

              <View style={styles.tabsRow}>
                <Pressable
                  style={[styles.tabBtn, activeFilter === "all" && styles.tabBtnActive]}
                  onPress={() => setActiveFilter("all")}
                >
                  <Text style={[styles.tabBtnText, activeFilter === "all" && styles.tabBtnTextActive]}>
                    All ({categorizedTxns.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.tabBtn, activeFilter === "inflow" && styles.tabBtnActiveInflow]}
                  onPress={() => setActiveFilter("inflow")}
                >
                  <Text style={[styles.tabBtnText, activeFilter === "inflow" && { color: "#065F46", fontWeight: "800" }]}>
                    + Inflows ({categorizedTxns.filter((t) => t.isInflow).length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.tabBtn, activeFilter === "outflow" && styles.tabBtnActiveOutflow]}
                  onPress={() => setActiveFilter("outflow")}
                >
                  <Text style={[styles.tabBtnText, activeFilter === "outflow" && { color: "#991B1B", fontWeight: "800" }]}>
                    - Outflows ({categorizedTxns.filter((t) => t.isOutflow).length})
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Transaction List */}
            {displayTxns.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={36} color={colors.onSurfaceSecondary} />
                <Text style={styles.emptyTitle}>No transactions found</Text>
                <Text style={styles.emptySub}>
                  {activeFilter === "inflow"
                    ? "No incoming deposits or transfers recorded for this account."
                    : activeFilter === "outflow"
                    ? "No expenses or outgoing transfers recorded for this account."
                    : "No transactions yet. Transfers or spending logged to this account will appear here."}
                </Text>
                <Pressable
                  style={styles.emptyAddBtn}
                  onPress={() => onAddTxnPress(account.id)}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyAddBtnText}>Add First Transaction</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8, paddingBottom: 30 }}>
                {displayTxns.map((t) => {
                  const meta = categoryMeta(t.category);
                  const isTransfer = t.type === "transfer";
                  const timeCost = amountToWorkHours(t.amount, hourlyRate);

                  return (
                    <Pressable
                      key={t.id}
                      style={({ pressed }) => [styles.txnRow, pressed && { opacity: 0.9 }]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        onTxnPress(t);
                      }}
                      onLongPress={() => handleDeleteTxn(t)}
                    >
                      {/* Flow Indicator & Emoji */}
                      <View
                        style={[
                          styles.txnIconWrap,
                          t.isInflow && { backgroundColor: "#ECFDF5" },
                          t.isOutflow && { backgroundColor: "#FEF2F2" },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>
                          {isTransfer ? (t.isInflow ? "📥" : "📤") : meta.emoji}
                        </Text>
                      </View>

                      {/* Details */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={styles.txnTitle} numberOfLines={1}>
                            {t.merchant || t.counterpartName || t.category}
                          </Text>
                          {t.recurringId && (
                            <View style={styles.recurringTag}>
                              <Text style={styles.recurringTagText}>🔁 REC</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.txnSub} numberOfLines={1}>
                          {shortDate(t.date)} · {t.flowLabel}
                          {t.counterpartName ? ` (${t.counterpartName})` : ""}
                          {t.note ? ` · ${t.note}` : ""}
                        </Text>
                      </View>

                      {/* Money Flow (+ / -) & Hours */}
                      <View style={{ alignItems: "flex-end", gap: 1 }}>
                        <Text
                          style={[
                            styles.txnAmount,
                            t.isInflow && styles.txnAmountInflow,
                            t.isOutflow && styles.txnAmountOutflow,
                          ]}
                        >
                          {t.isInflow ? `+${rm(t.amount)}` : `-${rm(t.amount)}`}
                        </Text>
                        <Text style={styles.txnHours}>
                          {timeCost.toFixed(1)}h work
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
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
    alignItems: "center",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
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
  accountEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.onSurface,
  },
  accountType: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.5,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  heroCardDebt: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.5,
  },
  heroBalance: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.onSurface,
    marginTop: 2,
  },
  hoursPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  hoursPillDebt: {
    backgroundColor: "#FEE2E2",
  },
  hoursPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  loanStatusBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  loanDetailSub: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#D97706",
  },
  summaryStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
  },
  statVal: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    ...shadow.soft,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  filterSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    letterSpacing: 0.5,
  },
  txnCountText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  tabBtnActiveInflow: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
  },
  tabBtnActiveOutflow: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: 14,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    gap: 10,
  },
  txnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  txnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  txnSub: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  recurringTag: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  recurringTagText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#7E22CE",
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  txnAmountInflow: {
    color: "#059669",
  },
  txnAmountOutflow: {
    color: "#EF4444",
  },
  txnHours: {
    fontSize: 10,
    color: colors.onSurfaceSecondary,
  },
});
