import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

export function CuteAppBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Vibrant Soft Ambient Pastel Halos */}
      <View style={styles.topRightGlow} />
      <View style={styles.bottomLeftGlow} />
      <View style={styles.centerGlow} />
      <View style={styles.midRightGlow} />

      {/* 1. Top Right Mascot (Celebrating) */}
      <View style={styles.topMascotWatermark}>
        <Image
          source={require("@/assets/mascot_celebrate.jpg")}
          style={styles.watermarkImg}
          contentFit="cover"
        />
      </View>

      {/* 2. Middle Right Mascot (Shopping & Treats) */}
      <View style={styles.midMascotWatermark}>
        <Image
          source={require("@/assets/mascot_shopping.jpg")}
          style={styles.watermarkImgMedium}
          contentFit="cover"
        />
      </View>

      {/* 3. Bottom Left Mascot (Wealth & Coin) */}
      <View style={styles.bottomMascotWatermark}>
        <Image
          source={require("@/assets/mascot_rich.jpg")}
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
    top: -50,
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(252, 231, 243, 0.8)", // rich pink glow
  },
  bottomLeftGlow: {
    position: "absolute",
    bottom: -60,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(237, 233, 254, 0.75)", // rich lavender glow
  },
  centerGlow: {
    position: "absolute",
    top: "30%",
    left: "5%",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(220, 252, 231, 0.55)", // mint glow
  },
  midRightGlow: {
    position: "absolute",
    top: "60%",
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(254, 243, 199, 0.6)", // warm lemon glow
  },
  topMascotWatermark: {
    position: "absolute",
    top: 30,
    right: 8,
    opacity: 0.22,
    borderRadius: 65,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(236, 72, 153, 0.3)",
    transform: [{ rotate: "12deg" }],
  },
  midMascotWatermark: {
    position: "absolute",
    top: "45%",
    right: -25,
    opacity: 0.18,
    borderRadius: 75,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(244, 114, 182, 0.25)",
    transform: [{ rotate: "-8deg" }],
  },
  bottomMascotWatermark: {
    position: "absolute",
    bottom: 60,
    left: -15,
    opacity: 0.22,
    borderRadius: 85,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(216, 180, 254, 0.3)",
    transform: [{ rotate: "-10deg" }],
  },
  watermarkImg: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  watermarkImgMedium: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  watermarkImgLarge: {
    width: 170,
    height: 170,
    borderRadius: 85,
  },
});
