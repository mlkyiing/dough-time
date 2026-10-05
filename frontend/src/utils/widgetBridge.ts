import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

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
const APP_GROUP_SUITE = "group.com.michelleloh.doughtime";

/**
 * Saves current financial status to local storage and syncs shared payload
 * to iOS WidgetKit App Groups (`group.com.michelleloh.doughtime`) and reloads widget timelines.
 */
export async function syncWidgetData(payload: WidgetPayload): Promise<void> {
  try {
    const jsonString = JSON.stringify(payload);
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, jsonString);

    if (Platform.OS === "ios") {
      try {
        const { WidgetBridgeModule } = NativeModules;
        if (WidgetBridgeModule && typeof WidgetBridgeModule.setWidgetData === "function") {
          await WidgetBridgeModule.setWidgetData(jsonString, APP_GROUP_SUITE);
        }
      } catch (nativeErr) {
        console.warn("WidgetBridgeModule sync error:", nativeErr);
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
