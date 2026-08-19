import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, shadow } from "@/src/theme";

function CenterFab({ onPress }: { onPress: () => void }) {
  return (
    <View pointerEvents="box-none" style={styles.fabWrap}>
      <Pressable
        testID="quick-add-fab"
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.95 }] }]}
      >
        <Ionicons name="add" size={30} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandPrimary,
          tabBarInactiveTintColor: colors.onSurfaceSecondary,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
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
            tabBarButton: () => <View style={{ width: 60 }} />,
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
    left: 16,
    right: 16,
    bottom: 16,
    height: 66,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 8,
    paddingTop: 6,
    ...shadow.card,
  },
  tabLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 11,
    marginTop: 2,
  },
  fabWrap: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
});
