import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export interface WidgetPayload {
  availableToSpend: number;
  comfortRemaining: number;
  totalSpent: number;
  budgetLimit: number;
  budgetUsedPct: number;
  currency: string;
  hourlyRate: number;
  availableHours: number;
  updatedAt: string;
}

const WIDGET_STORAGE_KEY = "@doughtime_lockscreen_widget_data";

/**
 * Saves current financial status to local storage and prepares shared payload
 * for iOS WidgetKit App Groups (`group.com.doughtime.app`).
 */
export async function syncWidgetData(payload: WidgetPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload));

    // When running in standalone iOS app with App Groups native bridge:
    if (Platform.OS === "ios") {
      try {
        // If react-native-shared-group-preferences is installed or native module is linked:
        const SharedGroupPreferences = (global as any).SharedGroupPreferences;
        if (SharedGroupPreferences) {
          await SharedGroupPreferences.setItem(
            "widgetData",
            JSON.stringify(payload),
            "group.com.michelleloh.doughtime"
          );
        }
      } catch {
        // Native module not linked in Expo Go / web; gracefully fallback
      }
    }
  } catch (e) {
    console.warn("Failed to sync widget payload:", e);
  }
}

export async function getWidgetData(): Promise<WidgetPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
