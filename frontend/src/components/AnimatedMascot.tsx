import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow, spacing } from "@/src/theme";

export type MascotVariant =
  | "default"
  | "coin"
  | "celebrate"
  | "zen"
  | "mentor"
  | "shopping"
  | "detective"
  | "rich";

interface Props {
  variant?: MascotVariant;
  size?: number;
  interactive?: boolean;
  style?: any;
}

const MASCOT_SOURCES: Record<MascotVariant, any> = {
  default: require("@/assets/mascot.jpg"),
  coin: require("@/assets/mascot_coin.jpg"),
  celebrate: require("@/assets/mascot_celebrate.jpg"),
  zen: require("@/assets/mascot_zen.jpg"),
  mentor: require("@/assets/mascot_mentor.jpg"),
  shopping: require("@/assets/mascot_shopping.jpg"),
  detective: require("@/assets/mascot_detective.jpg"),
  rich: require("@/assets/mascot_rich.jpg"),
};

const MASCOT_TIPS = [
  "Setiap RM15 adalah ~35 minit kerja awak! ⏱️",
  "Boba is happiness, but your freedom is priceless! 🧋✨",
  "Track every sen, grow your Dough! 🥟💰",
  "You're crushing your monthly budget! Keep going! 🚀",
  "Pay yourself first before lifestyle spending! 💡",
  "Compound interest in FD is free money working for you! 📈",
  "Checking receipts keeps your Dough safe! 🔍",
  "Your net worth is growing every day! 👑✨",
];

export function AnimatedMascot({
  variant = "default",
  size = 50,
  interactive = true,
  style,
}: Props) {
  const [bubbleModalOpen, setBubbleModalOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const toastFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Gentle breathing / floating loop
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    floating.start();

    return () => floating.stop();
  }, [floatAnim]);

  const handlePress = () => {
    if (!interactive) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Happy bounce animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 25,
        bounciness: 12,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 6,
      }),
    ]).start();

    // Show top floating toast modal that cannot be blocked by any container
    const nextIdx = (tipIndex + 1) % MASCOT_TIPS.length;
    setTipIndex(nextIdx);
    setBubbleModalOpen(true);

    toastFade.setValue(0);
    Animated.sequence([
      Animated.spring(toastFade, { toValue: 1, useNativeDriver: true, bounciness: 8 }),
      Animated.delay(4200),
      Animated.timing(toastFade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setBubbleModalOpen(false);
    });
  };

  const imageSource = MASCOT_SOURCES[variant] || MASCOT_SOURCES.default;

  return (
    <View style={[styles.container, style]}>
      {/* Interactive Unblockable Speech Toast */}
      {bubbleModalOpen && (
        <Modal transparent animationType="none" visible={bubbleModalOpen}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setBubbleModalOpen(false)}
          >
            <Animated.View
              style={[
                styles.floatingToast,
                {
                  opacity: toastFade,
                  transform: [
                    {
                      translateY: toastFade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 0],
                      }),
                    },
                    {
                      scale: toastFade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.toastMascotThumb}>
                <Image
                  source={imageSource}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                  contentFit="cover"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toastHeader}>DoughTime Mascot Says: 🥟✨</Text>
                <Text style={styles.toastBody}>{MASCOT_TIPS[tipIndex]}</Text>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      )}

      {/* Floating Animated Mascot Button */}
      <Pressable onPress={handlePress} disabled={!interactive} hitSlop={6}>
        <Animated.View
          style={[
            styles.avatarWrapper,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [
                { translateY: floatAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%", borderRadius: size / 2 }}
            contentFit="cover"
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrapper: {
    backgroundColor: colors.pink,
    padding: 2,
    overflow: "hidden",
    ...shadow.soft,
  },
  modalOverlay: {
    flex: 1,
    paddingTop: 55,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  floatingToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
    width: "100%",
    maxWidth: 380,
    ...shadow.card,
  },
  toastMascotThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pink,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  toastHeader: {
    fontWeight: "800",
    fontSize: 12,
    color: colors.brandPrimary,
    letterSpacing: -0.1,
  },
  toastBody: {
    fontWeight: "700",
    fontSize: 13,
    color: colors.onSurface,
    marginTop: 2,
    lineHeight: 18,
  },
});
