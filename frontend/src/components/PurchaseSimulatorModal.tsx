import React, { useState, useEffect } from "react";
import {
  Alert,
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
import { Account, WageSettings, WishlistItem } from "@/src/types";
import { amountToWorkHours, rm, todayISO } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";
import { addTransaction, addWishlistItem, deleteWishlistItem, getWishlistItems, updateWishlistItem } from "@/src/store";

interface Props {
  visible: boolean;
  wage: WageSettings;
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PurchaseSimulatorModal({ visible, wage, accounts, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<"simulate" | "tank">("simulate");
  const [itemName, setItemName] = useState("");
  const [priceStr, setPriceStr] = useState("299");
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  useEffect(() => {
    if (visible) {
      loadWishlist();
    }
  }, [visible]);

  const loadWishlist = async () => {
    const list = await getWishlistItems();
    setWishlist(list);
  };

  const price = parseFloat(priceStr.replace(/,/g, "")) || 0;
  const workHours = amountToWorkHours(price, wage.hourlyRate);
  const workDays = workHours / 8;

  const getReaction = () => {
    if (workHours <= 1) {
      return {
        variant: "celebrate" as const,
        title: "Pocket Change / Quick Snack! 🧋",
        desc: "Costs under 1 hour of work. Enjoy it without guilt if it brings you joy!",
        color: "#059669",
        bg: "#ECFDF5",
      };
    }
    if (workHours <= 8) {
      return {
        variant: "detective" as const,
        title: "Half-Day to Full-Day Investment! 🤔",
        desc: `You have to work ${workHours.toFixed(1)} hours (${workDays.toFixed(1)} workdays) to earn this back. Ask yourself: will you still use this in 3 months?`,
        color: "#D97706",
        bg: "#FFFBEB",
      };
    }
    if (workHours <= 40) {
      return {
        variant: "mentor" as const,
        title: "Multiple Days of Life Energy! ⏳",
        desc: `Trading ${(workHours / 8).toFixed(1)} full days at your desk for this item. Highly recommend putting it into the 48-Hour Chill-Out Tank!`,
        color: "#BE185D",
        bg: "#FDF2F8",
      };
    }
    return {
      variant: "shopping" as const,
      title: "MAJOR LIFE COMMITMENT! 🚨",
      desc: `Costs ${workHours.toFixed(0)} hours (${(workHours / 40).toFixed(1)} entire work weeks) of your life. Sleep on it and check if it's truly a must-have!`,
      color: "#DC2626",
      bg: "#FEF2F2",
    };
  };

  const reaction = getReaction();

  const handleAddToChillTank = async () => {
    if (price <= 0) return;
    const name = itemName.trim() || `Item worth ${rm(price)}`;

    await addWishlistItem({
      name,
      price,
      workHours,
      coolingPeriodHours: 48,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      "Added to Chill-Out Tank ❄️",
      `"${name}" is cooling off for 48 hours. If you still want it after the timer, you can buy it guilt-free!`
    );
    setItemName("");
    await loadWishlist();
    setActiveTab("tank");
  };

  const handleResisted = async (item: WishlistItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await updateWishlistItem({ ...item, status: "saved" });
    Alert.alert(
      "VICTORY! 🎉",
      `You resisted buying "${item.name}"! You just reclaimed ${rm(item.price)} and saved ${item.workHours.toFixed(1)} hours of your life energy!`
    );
    await loadWishlist();
  };

  const handleBuyNow = async (item: WishlistItem) => {
    const primaryAcc = accounts.find((a) => a.type === "bank" || a.type === "ewallet") || accounts[0];
    if (!primaryAcc) {
      Alert.alert("Account Missing", "No active account found to deduct from.");
      return;
    }

    await addTransaction({
      amount: item.price,
      type: "expense",
      category: "Shopping",
      accountId: primaryAcc.id,
      merchant: item.name,
      note: "Bought after 48-Hour Chill-Out period! Guilt-free comfort treat 🌟",
      date: todayISO(),
      bucket: "comfort",
    });

    await updateWishlistItem({ ...item, status: "purchased" });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      "Purchased Guilt-Free! 🛍️",
      `Deducted ${rm(item.price)} from your Guilt-Free Comfort budget. You thought about it and decided it was worth your life energy!`
    );
    onSuccess();
    await loadWishlist();
  };

  const handleDeleteItem = async (id: string) => {
    await deleteWishlistItem(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await loadWishlist();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AnimatedMascot variant={reaction.variant} size={38} interactive={false} />
              <View>
                <Text style={styles.headerTitle}>⏳ Is It Worth It?</Text>
                <Text style={styles.headerSub}>Life-energy purchase reality check</Text>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          {/* Segmented Control */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tabBtn, activeTab === "simulate" && styles.tabBtnActive]}
              onPress={() => setActiveTab("simulate")}
            >
              <Text style={[styles.tabBtnText, activeTab === "simulate" && styles.tabBtnTextActive]}>
                ⚡ Price Simulator
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === "tank" && styles.tabBtnActive]}
              onPress={() => setActiveTab("tank")}
            >
              <Text style={[styles.tabBtnText, activeTab === "tank" && styles.tabBtnTextActive]}>
                ❄️ Chill-Out Tank ({wishlist.filter((w) => w.status === "cooling").length})
              </Text>
            </Pressable>
          </View>

          <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
            {activeTab === "simulate" ? (
              <>
                {/* Input Card */}
                <View style={styles.inputCard}>
                  <Text style={styles.inputLabel}>Item or Experience Name (Optional)</Text>
                  <TextInput
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="e.g. Sony Headphones, Uniqlo Jacket, Omakase"
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.textInput}
                  />

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Price Tag</Text>
                  <View style={styles.priceInputWrap}>
                    <Text style={styles.currencyPrefix}>RM</Text>
                    <TextInput
                      value={priceStr}
                      onChangeText={setPriceStr}
                      keyboardType="decimal-pad"
                      placeholder="299"
                      style={styles.priceInput}
                    />
                  </View>
                </View>

                {/* Work Time Result Hero */}
                <View style={styles.resultCard}>
                  <Text style={styles.resultLabel}>EXACT COST IN LIFE ENERGY</Text>
                  <Text style={styles.resultHours}>{workHours.toFixed(1)} Hours</Text>
                  <Text style={styles.resultDays}>
                    Equals <Text style={{ fontWeight: "800" }}>{workDays.toFixed(1)} full workdays</Text> at your current rate ({rm(wage.hourlyRate)}/hr)
                  </Text>
                </View>

                {/* Mascot Coach Reality Check */}
                <View style={[styles.reactionCard, { backgroundColor: reaction.bg, borderColor: reaction.color }]}>
                  <Text style={[styles.reactionTitle, { color: reaction.color }]}>{reaction.title}</Text>
                  <Text style={[styles.reactionDesc, { color: reaction.color }]}>{reaction.desc}</Text>
                </View>

                {/* 48-Hour Chill-Out Action */}
                <View style={styles.chillPromoCard}>
                  <Text style={styles.chillPromoTitle}>💡 Pro-Tip: The 48-Hour Rule</Text>
                  <Text style={styles.chillPromoDesc}>
                    80% of impulse buying remorse disappears after 48 hours. Put this in your Chill-Out Tank and we will remind you!
                  </Text>
                  <Pressable style={styles.chillActionBtn} onPress={handleAddToChillTank}>
                    <Ionicons name="snow-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.chillActionBtnText}>Put in 48-Hour Chill-Out Tank ❄️</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              /* Chill-Out Tank Tab */
              <View style={{ gap: 10 }}>
                {wishlist.length === 0 ? (
                  <View style={styles.emptyTank}>
                    <Text style={{ fontSize: 32 }}>🧊</Text>
                    <Text style={styles.emptyTankTitle}>Chill-Out Tank is Empty</Text>
                    <Text style={styles.emptyTankSub}>
                      Whenever you are tempted to buy something, test it in the simulator and park it here for 48 hours!
                    </Text>
                  </View>
                ) : (
                  wishlist.map((item) => {
                    const created = new Date(item.createdAt).getTime();
                    const now = Date.now();
                    const hoursPassed = (now - created) / (1000 * 60 * 60);
                    const hoursLeft = Math.max(0, item.coolingPeriodHours - hoursPassed);
                    const isCool = hoursLeft === 0;

                    return (
                      <View key={item.id} style={styles.wishCard}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.wishName}>{item.name}</Text>
                            <Text style={styles.wishHours}>
                              {rm(item.price)} · <Text style={{ fontWeight: "700" }}>{item.workHours.toFixed(1)}h work</Text>
                            </Text>
                          </View>
                          <Pressable hitSlop={6} onPress={() => handleDeleteItem(item.id)}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </Pressable>
                        </View>

                        {/* Status bar */}
                        {item.status === "saved" ? (
                          <View style={styles.savedBanner}>
                            <Text style={styles.savedText}>🏆 You resisted and saved {rm(item.price)}!</Text>
                          </View>
                        ) : item.status === "purchased" ? (
                          <View style={styles.purchasedBanner}>
                            <Text style={styles.purchasedText}>🛍️ Purchased guilt-free from Comfort Fund</Text>
                          </View>
                        ) : (
                          <>
                            <View style={styles.timerRow}>
                              <Ionicons name={isCool ? "checkmark-circle" : "time-outline"} size={14} color={isCool ? "#059669" : "#D97706"} />
                              <Text style={[styles.timerText, isCool && { color: "#059669" }]}>
                                {isCool ? "Timer Complete! Ready to decide." : `${hoursLeft.toFixed(0)}h cooling off remaining`}
                              </Text>
                            </View>

                            <View style={styles.wishActionsRow}>
                              <Pressable style={styles.resistedBtn} onPress={() => handleResisted(item)}>
                                <Text style={styles.resistedBtnText}>I Don't Need It (Save RM) 🏆</Text>
                              </Pressable>
                              <Pressable style={styles.buyBtn} onPress={() => handleBuyNow(item)}>
                                <Text style={styles.buyBtnText}>Still Want It 🛍️</Text>
                              </Pressable>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close</Text>
            </Pressable>
          </View>
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
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  headerSub: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    fontWeight: "500",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
  inputCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.onSurface,
  },
  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.brandPrimary,
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    color: colors.onSurface,
  },
  resultCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1D4ED8",
    letterSpacing: 0.5,
  },
  resultHours: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1E40AF",
    marginTop: 2,
  },
  resultDays: {
    fontSize: 12,
    color: "#1E3A8A",
    marginTop: 2,
  },
  reactionCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  reactionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  reactionDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  chillPromoCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  chillPromoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  chillPromoDesc: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  chillActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0284C7",
    borderRadius: radius.pill,
    paddingVertical: 10,
    marginTop: 10,
  },
  chillActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyTank: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyTankTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 8,
  },
  emptyTankSub: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 4,
    lineHeight: 18,
  },
  wishCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  wishName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  wishHours: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  timerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
  wishActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  resistedBtn: {
    flex: 1,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: "center",
  },
  resistedBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  buyBtn: {
    flex: 1,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: "center",
  },
  buyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  savedBanner: {
    backgroundColor: "#ECFDF5",
    borderRadius: radius.sm,
    padding: 6,
    marginTop: 8,
  },
  savedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    textAlign: "center",
  },
  purchasedBanner: {
    backgroundColor: "#FDF2F8",
    borderRadius: radius.sm,
    padding: 6,
    marginTop: 8,
  },
  purchasedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#BE185D",
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  doneBtnText: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "700",
  },
});
