import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Account, isLiabilityAccount } from "@/src/types";
import { colors, radius, spacing, shadow } from "@/src/theme";

interface AccountSelectDropdownProps {
  label?: string;
  value?: string;
  onChange: (accountId: string) => void;
  accounts: Account[];
  excludeId?: string;
  placeholder?: string;
  modalTitle?: string;
  hint?: string;
  isDebtTarget?: boolean;
}

export function AccountSelectDropdown({
  label,
  value,
  onChange,
  accounts,
  excludeId,
  placeholder = "Select an account",
  modalTitle = "Select Account",
  hint,
  isDebtTarget = false,
}: AccountSelectDropdownProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "liquid" | "liability">("all");

  const availableAccounts = useMemo(() => {
    return accounts.filter((a) => !excludeId || a.id !== excludeId);
  }, [accounts, excludeId]);

  const selectedAccount = useMemo(() => {
    return availableAccounts.find((a) => a.id === value);
  }, [availableAccounts, value]);

  const filteredAccounts = useMemo(() => {
    return availableAccounts.filter((acc) => {
      // Tab filter
      const isDebt = isLiabilityAccount(acc.type);
      if (activeTab === "liquid" && isDebt) return false;
      if (activeTab === "liability" && !isDebt) return false;

      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        acc.name.toLowerCase().includes(q) ||
        acc.type.toLowerCase().includes(q)
      );
    });
  }, [availableAccounts, activeTab, searchQuery]);

  const hasLiabilities = useMemo(() => {
    return availableAccounts.some((a) => isLiabilityAccount(a.type));
  }, [availableAccounts]);

  const handleOpen = () => {
    Haptics.selectionAsync().catch(() => {});
    setSearchQuery("");
    if (isDebtTarget && hasLiabilities) {
      setActiveTab("liability");
    } else {
      setActiveTab("all");
    }
    setModalOpen(true);
  };

  const handleSelect = (accId: string) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(accId);
    setModalOpen(false);
  };

  const formatBalance = (acc: Account) => {
    const isDebt = isLiabilityAccount(acc.type);
    const prefix = isDebt ? "Debt RM " : "RM ";
    return `${prefix}${Math.abs(acc.balance).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "bank":
        return "Bank";
      case "ewallet":
        return "eWallet";
      case "cash":
        return "Cash";
      case "credit_card":
        return "Credit Card";
      case "loan":
        return "Loan";
      case "fd":
        return "Fixed Deposit";
      default:
        return type;
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Trigger Button */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.triggerBtn,
          pressed && { opacity: 0.8 },
          modalOpen && styles.triggerBtnFocused,
        ]}
      >
        {selectedAccount ? (
          <View style={styles.triggerSelectedContent}>
            <View
              style={[
                styles.emojiCircle,
                {
                  borderColor: selectedAccount.color || colors.brandPrimary,
                  backgroundColor: `${selectedAccount.color || colors.brandPrimary}15`,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{selectedAccount.emoji || "💳"}</Text>
            </View>
            <View style={styles.triggerInfo}>
              <View style={styles.triggerNameRow}>
                <Text style={styles.triggerName} numberOfLines={1}>
                  {selectedAccount.name}
                </Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {getTypeLabel(selectedAccount.type)}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.triggerBal,
                  isLiabilityAccount(selectedAccount.type)
                    ? styles.balDebt
                    : styles.balAsset,
                ]}
              >
                {formatBalance(selectedAccount)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.triggerPlaceholderContent}>
            <Ionicons name="wallet-outline" size={18} color={colors.onSurfaceSecondary} />
            <Text style={styles.placeholderText}>{placeholder}</Text>
          </View>
        )}

        <Ionicons name="chevron-down" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>

      {hint && <Text style={styles.hintText}>{hint}</Text>}

      {/* Modal Bottom Sheet Picker */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdropTap}
            onPress={() => setModalOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Pressable
                onPress={() => setModalOpen(false)}
                hitSlop={12}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>

            {/* Category Filter Tabs (if liabilities exist) */}
            {hasLiabilities && (
              <View style={styles.tabsRow}>
                <Pressable
                  style={[styles.tabBtn, activeTab === "all" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("all")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "all" && styles.tabBtnTextActive,
                    ]}
                  >
                    All ({availableAccounts.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tabBtn, activeTab === "liquid" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("liquid")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "liquid" && styles.tabBtnTextActive,
                    ]}
                  >
                    🏦 Banks & eWallets
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tabBtn,
                    activeTab === "liability" && styles.tabBtnActiveDebt,
                  ]}
                  onPress={() => setActiveTab("liability")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      activeTab === "liability" && styles.tabBtnTextActiveDebt,
                    ]}
                  >
                    💳 Loans & Cards
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Quick Search */}
            {availableAccounts.length > 5 && (
              <View style={styles.searchBar}>
                <Ionicons name="search" size={16} color={colors.onSurfaceSecondary} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search account name or bank..."
                  placeholderTextColor={colors.onSurfaceSecondary}
                  style={styles.searchInput}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && Platform.OS !== "ios" && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color={colors.onSurfaceSecondary} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Accounts List */}
            <ScrollView
              style={styles.accountsList}
              contentContainerStyle={styles.accountsListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredAccounts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>🔍</Text>
                  <Text style={styles.emptyText}>No matching accounts found</Text>
                </View>
              ) : (
                filteredAccounts.map((acc) => {
                  const isSelected = acc.id === value;
                  const isDebt = isLiabilityAccount(acc.type);
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => handleSelect(acc.id)}
                      style={({ pressed }) => [
                        styles.accountRowCard,
                        isSelected && styles.accountRowCardSelected,
                        { borderLeftColor: acc.color || colors.brandPrimary, borderLeftWidth: 4 },
                        pressed && { backgroundColor: colors.borderStrong },
                      ]}
                    >
                      <View
                        style={[
                          styles.rowEmojiCircle,
                          {
                            borderColor: acc.color || colors.brandPrimary,
                            backgroundColor: `${acc.color || colors.brandPrimary}15`,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>{acc.emoji || "💳"}</Text>
                      </View>

                      <View style={styles.rowMainInfo}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {acc.name}
                          </Text>
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{getTypeLabel(acc.type)}</Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.rowBal,
                            isDebt ? styles.balDebt : styles.balAsset,
                          ]}
                        >
                          {formatBalance(acc)}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={isDebt ? "#EF4444" : colors.brandPrimary}
                        />
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={colors.onSurfaceSecondary}
                        />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  triggerBtnFocused: {
    borderColor: colors.brandPrimary,
    backgroundColor: "#FFF5F8",
  },
  triggerSelectedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  triggerPlaceholderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
  emojiCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerInfo: {
    flex: 1,
  },
  triggerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  triggerName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    flexShrink: 1,
  },
  typeBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
  },
  triggerBal: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  balAsset: {
    color: "#059669",
  },
  balDebt: {
    color: "#DC2626",
  },
  hintText: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 4,
    marginLeft: 2,
  },

  /* Modal Bottom Sheet */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalBackdropTap: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    ...shadow.card,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  modalCloseBtn: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
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
    backgroundColor: "#FDF2F8",
    borderColor: colors.brandPrimary,
  },
  tabBtnActiveDebt: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  tabBtnTextActive: {
    color: colors.brandPrimary,
  },
  tabBtnTextActiveDebt: {
    color: "#DC2626",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: spacing.lg,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16, // >= 16 prevents mobile Safari zoom
    color: colors.onSurface,
    padding: 0,
  },
  accountsList: {
    marginTop: 10,
    paddingHorizontal: spacing.lg,
  },
  accountsListContent: {
    gap: 8,
    paddingBottom: 16,
  },
  accountRowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
  },
  accountRowCardSelected: {
    backgroundColor: "#FFF5F8",
    borderColor: colors.brandPrimary,
  },
  rowEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMainInfo: {
    flex: 1,
    gap: 3,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    flexShrink: 1,
  },
  rowBal: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
  },
});
