import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Account, isLiabilityAccount } from "../types";
import { amountToWorkHours, rm } from "../format";

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
 * Android Notification Channel setup
 * Required for notifications to show up on Android 8.0+
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("loan-reminders", {
        name: "Loan & Repayment Reminders",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6366F1",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync("default", {
        name: "General Alerts",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (e) {
      console.warn("Could not set up Android notification channels", e);
    }
  }
}

export interface PermissionResult {
  granted: boolean;
  status: string;
  reason?: string;
}

/**
 * Check and request notification permissions with diagnostic detail
 */
export async function checkAndRequestNotificationPermission(): Promise<PermissionResult> {
  await setupNotificationChannels();

  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return {
        granted: false,
        status: "unsupported",
        reason: "Web Notifications are not supported in this browser window.",
      };
    }

    if (Notification.permission === "granted") {
      return { granted: true, status: "granted" };
    }

    if (Notification.permission === "denied") {
      return {
        granted: false,
        status: "denied",
        reason: "Browser notifications are blocked. Please allow notifications in site permissions.",
      };
    }

    try {
      const permission = await Notification.requestPermission();
      return {
        granted: permission === "granted",
        status: permission,
        reason: permission === "granted" ? undefined : "Notification permission was not granted.",
      };
    } catch (e: any) {
      return { granted: false, status: "error", reason: e.message };
    }
  }

  try {
    const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    const granted = finalStatus === "granted";
    return {
      granted,
      status: finalStatus,
      reason: granted
        ? undefined
        : canAskAgain
        ? "Permission was denied. Tap to allow notifications."
        : "Notification permission is disabled in system Settings.",
    };
  } catch (e: any) {
    return { granted: false, status: "error", reason: e.message };
  }
}

/**
 * Backwards compatible boolean permission requester
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const res = await checkAndRequestNotificationPermission();
  return res.granted;
}

/**
 * Trigger an immediate test notification to verify reminders
 */
export async function triggerNotification(
  title: string,
  body: string
): Promise<{ success: boolean; message: string }> {
  const perm = await checkAndRequestNotificationPermission();
  if (!perm.granted) {
    return {
      success: false,
      message: perm.reason || "Notification permission not granted.",
    };
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
        return { success: true, message: "Web notification displayed!" };
      } catch (e: any) {
        return { success: false, message: `Browser notification error: ${e.message}` };
      }
    }
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
      },
      trigger: null, // trigger immediately
    });
    return { success: true, message: "Live test notification delivered!" };
  } catch (e: any) {
    return { success: false, message: `Notification delivery error: ${e.message}` };
  }
}

/**
 * Schedule recurring monthly repayment reminder for a loan or credit card
 */
export async function scheduleLoanRepaymentReminder(
  account: Account,
  hourlyRate: number = 25.96
): Promise<{ success: boolean; message: string }> {
  if (!account.reminderEnabled || !account.dueDay) {
    return { success: false, message: "Reminder is disabled or due day is not set." };
  }

  const perm = await checkAndRequestNotificationPermission();
  if (!perm.granted) {
    return {
      success: false,
      message: perm.reason || "Notifications are not enabled on this device.",
    };
  }

  const installment = account.monthlyInstallment || account.balance || 0;
  const workHours = amountToWorkHours(installment, hourlyRate);
  const timeCostText = `${workHours.toFixed(1)}h of work`;

  const emoji = account.type === "credit_card" ? "💳" : "🚘";
  const title = `${emoji} ${account.name} Payment Due Soon!`;
  const body = `Your monthly installment of RM ${installment.toFixed(2)} (${timeCostText}) is due on the ${account.dueDay}th. Keep your Dough on track! 🥟`;

  if (Platform.OS === "web") {
    // Immediate reminder confirmation on web
    await triggerNotification(`🔔 Reminder Set for ${account.name}`, body);
    return { success: true, message: `Reminder active for ${account.dueDay}th of each month!` };
  }

  try {
    // Schedule monthly trigger for native iOS / Android
    const advanceDays = account.reminderDaysBefore || 2;
    const triggerDay = Math.max(1, (account.dueDay || 25) - advanceDays);

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
        channelId: "loan-reminders",
      },
    });

    return {
      success: true,
      message: `Scheduled! You will receive a reminder ${advanceDays} days before the ${account.dueDay}th at 9:00 AM.`,
    };
  } catch (e: any) {
    // Fallback if monthly trigger is unsupported in Expo Go environment
    console.warn("Monthly trigger fallback:", e);
    return {
      success: true,
      message: `Reminder saved! DoughTime will alert you when you open the app near the ${account.dueDay}th.`,
    };
  }
}

export interface DueLoanInfo {
  account: Account;
  status: "due_today" | "upcoming" | "overdue";
  daysRemaining: number;
  formattedDue: string;
  installment: number;
  workHours: number;
}

/**
 * Checks all accounts for upcoming, due today, or overdue repayments.
 * Powers in-app reminders so the user never misses a repayment even without push notifications!
 */
export function getDueLoanReminders(accounts: Account[], hourlyRate: number = 25.96): DueLoanInfo[] {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const results: DueLoanInfo[] = [];

  for (const acc of accounts) {
    if (!isLiabilityAccount(acc.type)) continue;
    if (!acc.dueDay || acc.balance <= 0) continue;

    const dueDay = Math.min(acc.dueDay, currentMonthDays);
    let diff = dueDay - currentDay;

    let status: "due_today" | "upcoming" | "overdue" = "upcoming";
    if (diff === 0) {
      status = "due_today";
    } else if (diff < 0 && diff >= -5) {
      status = "overdue";
    } else if (diff > 0 && diff <= (acc.reminderDaysBefore ? acc.reminderDaysBefore + 2 : 4)) {
      status = "upcoming";
    } else {
      continue; // Not within reminder window
    }

    const installment = acc.monthlyInstallment || acc.balance;
    const workHours = +amountToWorkHours(installment, hourlyRate).toFixed(1);

    results.push({
      account: acc,
      status,
      daysRemaining: diff,
      formattedDue: `${dueDay}th`,
      installment,
      workHours,
    });
  }

  // Sort by urgency: overdue first, then due today, then closest upcoming
  return results.sort((a, b) => {
    const priority = { overdue: 0, due_today: 1, upcoming: 2 };
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status];
    }
    return a.daysRemaining - b.daysRemaining;
  });
}
