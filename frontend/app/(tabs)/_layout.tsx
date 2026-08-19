import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow } from "@/src/theme";

function CenterFab({ onPress, bottomInset }: { onPress: () => void; bottomInset: number }) {
  return (
    <View pointerEvents="box-none" style={[styles.fabWrap, { bottom: 28 + Math.max(bottomInset, 10) }]}>
      <Pressable
        testID="quick-add-fab"
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandPrimary,
          tabBarInactiveTintColor: colors.onSurfaceSecondary,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: bottomOffset,
            },
          ],
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Txns",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "list" : "list-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="_center"
          options={{
            title: "",
            tabBarButton: () => <View style={{ width: 56 }} />,
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: "Insights",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: "Accounts",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "wallet" : "wallet-outline"} size={22} color={color} />
            ),
          }}
        />
      </Tabs>
      <CenterFab
        bottomInset={bottomOffset}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.push("/quick-add");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingBottom: Platform.OS === "ios" ? 4 : 8,
    paddingTop: 8,
    ...shadow.card,
  },
  tabItem: {
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: {
    fontWeight: "700",
    fontSize: 10,
    marginTop: 2,
  },
  fabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 99,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glow,
  },
});
