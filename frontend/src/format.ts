export function rm(n: number, opts?: { showSign?: boolean }) {
  const isNegative = n < 0;
  const sign = isNegative ? "-" : (opts?.showSign && n > 0 ? "+" : "");
  const parts = Math.abs(n).toFixed(2).split(".");
  const intWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}RM ${intWithCommas}.${parts[1]}`;
}

export function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

export function formatMonthDisplay(mKey: string) {
  if (mKey === "all") return "All Time";
  const [year, month] = mKey.split("-");
  if (!year || !month) return mKey;
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculates work duration equivalent for a given monetary amount
 */
export function amountToWorkHours(amount: number, hourlyRate: number): number {
  if (!hourlyRate || hourlyRate <= 0) return 0;
  return amount / hourlyRate;
}

export function formatTimeCost(amount: number, hourlyRate: number, opts?: { compact?: boolean }): string {
  const hours = amountToWorkHours(Math.abs(amount), hourlyRate);
  if (hours <= 0) return "0m";

  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (opts?.compact) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  if (hours >= 16) {
    const days = (hours / 8).toFixed(1);
    return `${h}h (${days} workdays)`;
  }

  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getBobaReaction(hours: number) {
  if (hours <= 0.5) {
    return {
      title: "Snack size! 🧋",
      desc: "Small sip of your time, easy to earn back!",
      emoji: "🧋",
      color: "#10B981", // green
    };
  } else if (hours <= 2) {
    return {
      title: "Moderate energy ⏳",
      desc: "A solid couple hours of hustle.",
      emoji: "⏳",
      color: "#F59E0B", // amber
    };
  } else if (hours <= 8) {
    return {
      title: "Full day trade 💼",
      desc: "Almost an entire workday worth of energy!",
      emoji: "💼",
      color: "#F97316", // orange
    };
  } else {
    return {
      title: "Big investment! 👑",
      desc: "Multiple days of life energy traded.",
      emoji: "🔥",
      color: "#EC4899", // pink
    };
  }
}
