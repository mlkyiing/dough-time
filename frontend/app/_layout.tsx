import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useAppFonts } from "@/src/hooks/use-app-fonts";
import { colors } from "@/src/theme";
import { CuteAppBackground } from "@/src/components/CuteAppBackground";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useAppFonts();
  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const styleId = "doughtime-global-ios-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          html, body, #root {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Rounded", "SF Pro Text", "Nunito", -system-ui, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            -webkit-tap-highlight-color: transparent;
            background-color: ${colors.surface};
            overscroll-behavior-y: none;
          }
          input, textarea {
            user-select: auto;
          }
        `;
        document.head.appendChild(style);
      }

      // Ensure PWA & Apple Touch Icons use Mascot
      const mascotIconUrl = "/assets/assets/mascot.jpg";
      
      const touchIconId = "doughtime-apple-touch-icon";
      if (!document.getElementById(touchIconId)) {
        const appleIcon = document.createElement("link");
        appleIcon.id = touchIconId;
        appleIcon.rel = "apple-touch-icon";
        appleIcon.href = mascotIconUrl;
        document.head.appendChild(appleIcon);

        const appleIconPre = document.createElement("link");
        appleIconPre.rel = "apple-touch-icon-precomposed";
        appleIconPre.href = mascotIconUrl;
        document.head.appendChild(appleIconPre);

        const metaTitle = document.createElement("meta");
        metaTitle.name = "apple-mobile-web-app-title";
        metaTitle.content = "DoughTime";
        document.head.appendChild(metaTitle);

        const metaCapable = document.createElement("meta");
        metaCapable.name = "apple-mobile-web-app-capable";
        metaCapable.content = "yes";
        document.head.appendChild(metaCapable);

        const metaTheme = document.createElement("meta");
        metaTheme.name = "theme-color";
        metaTheme.content = "#EC4899";
        document.head.appendChild(metaTheme);
      }
    }
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <CuteAppBackground />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="quick-add"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="scan"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
