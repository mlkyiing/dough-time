import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "../theme";

export function CuteAppBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Soft Ambient Pastel Glows */}
      <View style={styles.topRightGlow} />
      <View style={styles.bottomLeftGlow} />
      <View style={styles.centerGlow} />

      {/* Subtle Kawaii Mascot Watermarks */}
      <View style={styles.topMascotWatermark}>
        <Image
          source={require("@/assets/mascot_celebrate.jpg")}
          style={styles.watermarkImg}
          contentFit="cover"
        />
      </View>

      <View style={styles.bottomMascotWatermark}>
        <Image
          source={require("@/assets/mascot_coin.jpg")}
          style={styles.watermarkImgLarge}
          contentFit="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRightGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(252, 231, 243, 0.65)", // soft pink glow
  },
  bottomLeftGlow: {
    position: "absolute",
    bottom: -80,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(237, 233, 254, 0.55)", // soft lavender glow
  },
  centerGlow: {
    position: "absolute",
    top: "35%",
    left: "10%",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(220, 252, 231, 0.35)", // subtle mint glow
  },
  topMascotWatermark: {
    position: "absolute",
    top: 40,
    right: 12,
    opacity: 0.05,
    borderRadius: 60,
    overflow: "hidden",
  },
  bottomMascotWatermark: {
    position: "absolute",
    bottom: 80,
    left: -20,
    opacity: 0.04,
    borderRadius: 90,
    overflow: "hidden",
  },
  watermarkImg: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  watermarkImgLarge: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
});
