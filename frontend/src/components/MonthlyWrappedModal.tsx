import React, { useState, useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { Transaction, WageSettings } from "@/src/types";
import { amountToWorkHours, formatMonthDisplay, monthKey, rm, todayISO } from "@/src/format";
import { AnimatedMascot } from "./AnimatedMascot";

interface Props {
  visible: boolean;
  transactions: Transaction[];
  wage: WageSettings;
  selectedMonth?: string;
  onClose: () => void;
}

export function MonthlyWrappedModal({ visible, transactions, wage, selectedMonth, onClose }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);

  const targetMonth = selectedMonth && selectedMonth !== "all" ? selectedMonth : monthKey(todayISO());

  const monthTxns = useMemo(() => {
    return transactions.filter(
      (t) => t.date && t.date.startsWith(targetMonth) && t.type !== "income" && t.type !== "transfer"
    );
  }, [transactions, targetMonth]);

  const totalSpent = useMemo(() => monthTxns.reduce((s, t) => s + t.amount, 0), [monthTxns]);
  const totalWorkHours = amountToWorkHours(totalSpent, wage.hourlyRate);

  // Top category
  const topCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxns) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return arr[0] || ["Makan", 0];
  }, [monthTxns]);

  // Top merchant
  const topMerchant = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxns) {
      const m = t.merchant || t.category;
      map.set(m, (map.get(m) ?? 0) + t.amount);
    }
    const arr = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return arr[0] || ["Everyday Living", 0];
  }, [monthTxns]);

  // Freedom hours stashed
  const freedomTxns = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.date &&
        t.date.startsWith(targetMonth) &&
        (t.category === "Investment" || t.category === "Loan / Debt")
    );
  }, [transactions, targetMonth]);

  const freedomAmount = freedomTxns.reduce((s, t) => s + t.amount, 0);
  const freedomHours = amountToWorkHours(freedomAmount, wage.hourlyRate);

  const totalSlides = 4;

  const handleNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (slideIndex < totalSlides - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    Haptics.selectionAsync().catch(() => {});
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
    }
  };

  const handleShare = async () => {
    const msg = `🥟 My DoughTime Wrapped for ${formatMonthDisplay(targetMonth)}:\n• Life Energy Spent: ${totalWorkHours.toFixed(1)}h (${rm(totalSpent)})\n• Top Category: ${topCategory[0]} (${rm(topCategory[1])})\n• Freedom Hours Stashed: ${freedomHours.toFixed(1)}h\nTrack your money in life-work hours with DoughTime! ⏳✨`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Progress Indicators */}
          <View style={styles.indicatorsRow}>
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.indicatorBar,
                  idx <= slideIndex && styles.indicatorBarActive,
                ]}
              />
            ))}
          </View>

          {/* Close button */}
          <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>

          {/* Slide 1: Total Life Energy Exchanged */}
          {slideIndex === 0 && (
            <View style={styles.slideContent}>
              <AnimatedMascot variant="celebrate" size={72} interactive={false} />
              <Text style={styles.eyebrow}>{formatMonthDisplay(targetMonth).toUpperCase()} WRAPPED</Text>
              <Text style={styles.mainStat}>{totalWorkHours.toFixed(1)} Hours</Text>
              <Text style={styles.mainStatLabel}>of life energy spent</Text>
              <Text style={styles.storyText}>
                In {formatMonthDisplay(targetMonth)}, you exchanged {totalWorkHours.toFixed(1)} hours of your hard-earned time ({rm(totalSpent)}) on everyday life.
              </Text>
            </View>
          )}

          {/* Slide 2: Top Time Drain */}
          {slideIndex === 1 && (
            <View style={styles.slideContent}>
              <AnimatedMascot variant="detective" size={72} interactive={false} />
              <Text style={styles.eyebrow}>BIGGEST TIME SPONSOR</Text>
              <Text style={styles.mainStat}>{topCategory[0]}</Text>
              <Text style={styles.mainStatLabel}>{rm(topCategory[1])} ({amountToWorkHours(topCategory[1], wage.hourlyRate).toFixed(1)}h work)</Text>
              <Text style={styles.storyText}>
                Your number one destination was <Text style={{ fontWeight: "800", color: "#FDE047" }}>{topMerchant[0]}</Text>. You traded {amountToWorkHours(topMerchant[1], wage.hourlyRate).toFixed(1)} hours of work energy there!
              </Text>
            </View>
          )}

          {/* Slide 3: Freedom Stash */}
          {slideIndex === 2 && (
            <View style={styles.slideContent}>
              <AnimatedMascot variant="rich" size={72} interactive={false} />
              <Text style={styles.eyebrow}>FREEDOM ENERGY RECLAIMED</Text>
              <Text style={styles.mainStat}>{freedomHours.toFixed(1)} Hours</Text>
              <Text style={styles.mainStatLabel}>{rm(freedomAmount)} stashed / debt paid</Text>
              <Text style={styles.storyText}>
                Every ringgit directed towards savings or loan reduction buys back your future time. You secured {freedomHours.toFixed(1)} hours of pure freedom this month!
              </Text>
            </View>
          )}

          {/* Slide 4: Mascot Award & Share */}
          {slideIndex === 3 && (
            <View style={styles.slideContent}>
              <AnimatedMascot variant="mentor" size={72} interactive={false} />
              <Text style={styles.eyebrow}>YOUR DOUGHTIME PERSONA</Text>
              <Text style={styles.mainStat}>Balanced Dough Master 🥟</Text>
              <Text style={styles.mainStatLabel}>Mindful Life Energy Spender</Text>
              <Text style={styles.storyText}>
                You tracked expenses, honored your loan commitments, and kept conscious view of your finite life energy. Keep building your financial fortress!
              </Text>

              <Pressable style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color="#0F172A" />
                <Text style={styles.shareBtnText}>Share My Wrapped 🌟</Text>
              </Pressable>
            </View>
          )}

          {/* Navigation Controls */}
          <View style={styles.navRow}>
            {slideIndex > 0 ? (
              <Pressable style={styles.navBtn} onPress={handlePrev}>
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              </Pressable>
            ) : <View style={{ width: 44 }} />}

            <Pressable style={styles.nextActionBtn} onPress={handleNext}>
              <Text style={styles.nextActionText}>
                {slideIndex === totalSlides - 1 ? "Done ✨" : "Next ➔"}
              </Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#1E1B4B", // Deep rich indigo wrapped theme
    borderRadius: 28,
    padding: spacing.xl,
    alignItems: "center",
    ...shadow.glow,
    borderWidth: 1,
    borderColor: "#4338CA",
  },
  indicatorsRow: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
    marginBottom: spacing.md,
  },
  indicatorBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  indicatorBarActive: {
    backgroundColor: "#F43F5E",
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  slideContent: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    width: "100%",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F43F5E",
    letterSpacing: 1,
    marginTop: 16,
  },
  mainStat: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
    textAlign: "center",
  },
  mainStatLabel: {
    fontSize: 13,
    color: "#A5B4FC",
    marginTop: 2,
    fontWeight: "600",
  },
  storyText: {
    fontSize: 13,
    color: "#E0E7FF",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDE047",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: 18,
  },
  shareBtnText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextActionBtn: {
    backgroundColor: "#F43F5E",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  nextActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
