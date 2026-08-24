import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";
import { categoryMeta } from "@/src/constants";
import { formatTimeCost, rm, shortDate } from "@/src/format";
import { Account, Transaction } from "@/src/types";

interface Props {
  transaction: Transaction;
  account?: Account;
  hourlyRate: number;
  viewMode: "money" | "time";
  onPress?: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

export function SwipeableTxnRow({
  transaction: t,
  account: acc,
  hourlyRate,
  viewMode,
  onPress,
  onDelete,
}: Props) {
  const meta = categoryMeta(t.category);
  const timeCost = formatTimeCost(t.amount, hourlyRate);
  const pan = useRef(new Animated.Value(0)).current;
  const isSwiped = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          // Swiping left to reveal delete (max -90)
          pan.setValue(Math.max(gestureState.dx, -90));
        } else if (isSwiped.current && gestureState.dx > 0) {
          // Swiping right to close
          pan.setValue(Math.min(0, -75 + gestureState.dx));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          // Open delete action
          Animated.spring(pan, {
            toValue: -75,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          if (!isSwiped.current) {
            Haptics.selectionAsync().catch(() => {});
          }
          isSwiped.current = true;
        } else {
          // Snap back
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          isSwiped.current = false;
        }
      },
    })
  ).current;

  const closeSwipe = () => {
    Animated.spring(pan, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    isSwiped.current = false;
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    closeSwipe();
    onDelete(t.id);
  };

  const isIncome = t.type === "income";

  return (
    <View style={styles.container}>
      {/* Background Delete Action */}
      <View style={styles.deleteActionContainer}>
        <Pressable
          style={styles.deleteBtn}
          onPress={handleDelete}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </Pressable>
      </View>

      {/* Foreground Swipeable Card */}
      <Animated.View
        style={[
          styles.card,
          isIncome && styles.cardIncome,
          {
            transform: [{ translateX: pan }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={styles.cardContent}
          onPress={() => {
            if (isSwiped.current) {
              closeSwipe();
            } else if (onPress) {
              Haptics.selectionAsync().catch(() => {});
              onPress(t);
            }
          }}
          onLongPress={() => onDelete(t.id)}
        >
          <View style={[styles.iconBox, { backgroundColor: meta.tint }]}>
            <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
          </View>

          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {t.merchant || t.category}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {shortDate(t.date)} · {acc?.name || "Cash"}
              {t.note ? ` · ${t.note}` : ""}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
            <Text style={[styles.cardAmt, isIncome && styles.cardAmtIncome]}>
              {viewMode === "money"
                ? `${isIncome ? "+" : ""}${rm(t.amount)}`
                : `${isIncome ? "+" : ""}${timeCost}`}
            </Text>
            <View style={[styles.timePill, isIncome && styles.timePillIncome]}>
              <Text style={[styles.timePillText, isIncome && styles.timePillTextIncome]}>
                {viewMode === "money"
                  ? `${isIncome ? "🌿 +" : "⏱️ "}${timeCost}`
                  : `${isIncome ? "+" : ""}${rm(t.amount)}`}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginBottom: spacing.sm,
    overflow: "hidden",
    borderRadius: radius.md,
  },
  deleteActionContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EF4444",
    borderRadius: radius.md,
  },
  deleteBtn: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  deleteBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  cardSub: {
    fontWeight: "400",
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: 2,
  },
  cardAmt: {
    fontWeight: "800",
    fontSize: 15,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  timePill: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 3,
  },
  timePillText: {
    fontWeight: "600",
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  cardIncome: {
    borderColor: "#A7F3D0",
  },
  cardAmtIncome: {
    color: "#059669",
    fontWeight: "900",
  },
  timePillIncome: {
    backgroundColor: "#DCFCE7",
  },
  timePillTextIncome: {
    color: "#047857",
    fontWeight: "700",
  },
});
