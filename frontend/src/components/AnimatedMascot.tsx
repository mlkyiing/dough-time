import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow } from "@/src/theme";

export type MascotVariant = "default" | "coin" | "celebrate" | "zen" | "mentor";

interface Props {
  variant?: MascotVariant;
  size?: number;
  interactive?: boolean;
  showBubble?: boolean;
  style?: any;
}

const MASCOT_SOURCES: Record<MascotVariant, any> = {
  default: require("@/assets/mascot.jpg"),
  coin: require("@/assets/mascot_coin.jpg"),
  celebrate: require("@/assets/mascot_celebrate.jpg"),
  zen: require("@/assets/mascot_zen.jpg"),
  mentor: require("@/assets/mascot_mentor.jpg"),
};

const MASCOT_TIPS = [
  "Setiap RM15 adalah ~35 minit kerja awak! ⏱️",
  "Boba is happiness, but your freedom is priceless! 🧋✨",
  "Track every sen, grow your Dough! 🥟💰",
  "You're crushing your monthly budget! Keep going! 🚀",
  "Pay yourself first before lifestyle spending! 💡",
  "Compound interest in FD is free money working for you! 📈",
];

export function AnimatedMascot({
  variant = "coin",
  size = 50,
  interactive = true,
  showBubble = false,
  style,
}: Props) {
  const [bubbleText, setBubbleText] = useState<string | null>(
    showBubble ? MASCOT_TIPS[0] : null
  );
  const [tipIndex, setTipIndex] = useState(0);

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bubbleFade = useRef(new Animated.Value(showBubble ? 1 : 0)).current;

  useEffect(() => {
    // Gentle breathing / floating loop
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    floating.start();

    return () => floating.stop();
  }, [floatAnim]);

  const handlePress = () => {
    if (!interactive) return;

    Haptics.selectionAsync().catch(() => {});

    // Happy bounce
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.18,
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

    // Toggle next tip bubble
    const nextIdx = (tipIndex + 1) % MASCOT_TIPS.length;
    setTipIndex(nextIdx);
    setBubbleText(MASCOT_TIPS[nextIdx]);

    Animated.sequence([
      Animated.timing(bubbleFade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(bubbleFade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[styles.container, style]}>
      {/* Interactive Speech Bubble */}
      {bubbleText && (
        <Animated.View
          style={[
            styles.bubble,
            {
              opacity: bubbleFade,
              transform: [
                {
                  translateY: bubbleFade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.bubbleText}>{bubbleText}</Text>
          <View style={styles.bubbleArrow} />
        </Animated.View>
      )}

      {/* Floating Animated Mascot */}
      <Pressable onPress={handlePress} disabled={!interactive}>
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
            source={MASCOT_SOURCES[variant]}
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
    position: "relative",
  },
  avatarWrapper: {
    backgroundColor: colors.pink,
    padding: 2,
    overflow: "hidden",
    ...shadow.soft,
  },
  bubble: {
    position: "absolute",
    bottom: "105%",
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    maxWidth: 200,
    zIndex: 999,
    ...shadow.card,
    marginBottom: 6,
  },
  bubbleText: {
    fontWeight: "700",
    fontSize: 11,
    color: colors.onSurface,
    textAlign: "center",
  },
  bubbleArrow: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    width: 10,
    height: 10,
    backgroundColor: colors.surfaceSecondary,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    transform: [{ rotate: "45deg" }],
  },
});
