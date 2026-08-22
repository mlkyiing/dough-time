import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Account } from "../types";
import { amountToWorkHours } from "../format";

// Configure local notification display behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions (supporting native iOS/Android & Web Notification API)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === "granted";
}

/**
 * Trigger an immediate test notification to verify reminders
 */
export async function triggerNotification(title: string, body: string): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
      return;
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      badge: 1,
    },
    trigger: null, // trigger immediately
  });
}

/**
 * Schedule recurring monthly repayment reminder for a loan or credit card
 */
export async function scheduleLoanRepaymentReminder(
  account: Account,
  hourlyRate: number = 25.96
): Promise<void> {
  if (!account.reminderEnabled || !account.dueDay) {
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const installment = account.monthlyInstallment || account.balance || 0;
  const workHours = amountToWorkHours(installment, hourlyRate);
  const timeCostText = `${workHours.toFixed(1)}h of work`;

  const title = `🚗 ${account.name} Payment Due Soon!`;
  const body = `Your monthly installment of RM ${installment.toFixed(2)} (${timeCostText}) is due on the ${account.dueDay}th. Keep your Dough on track! 🥟`;

  if (Platform.OS === "web") {
    // Show immediate confirmation in browser mode
    triggerNotification(`🔔 Reminder Scheduled for ${account.name}`, body);
    return;
  }

  // Schedule monthly trigger for native iOS / Android
  const triggerDay = Math.max(1, (account.dueDay || 25) - (account.reminderDaysBefore || 2));

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { accountId: account.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: triggerDay,
      hour: 9,
      minute: 0,
    },
  });
}
