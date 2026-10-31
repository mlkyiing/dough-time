export function rm(n: number, opts?: { showSign?: boolean }) {
  const isNegative = n < 0;
  const sign = isNegative ? "-" : (opts?.showSign && n > 0 ? "+" : "");
  const parts = Math.abs(n).toFixed(2).split(".");
  const intWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}RM ${intWithCommas}.${parts[1]}`;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Calendar date in the device timezone. YYYY-MM-DD strings are not UTC instants. */
export function localISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function shortDate(iso: string) {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return iso;
  return new Date(y, m - 1, day).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

export function shortMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short" });
}

export function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

/** Last Mon–Fri of the month that contains this date. */
export function lastWeekdayISO(iso: string) {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(y, m, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return localISO(d);
}

function nextMonthKey(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/**
 * Month a transaction belongs to when asking "how did I use my salary".
 * Salary paid on the last working day (or the weekend right after it) funds the next month.
 * shortcut: ignores Malaysian public holidays. Add a holiday list if payday moves earlier than that Friday.
 */
export function reportMonth(t: { date: string; type?: string; category?: string }) {
  const date = (t.date || "").slice(0, 10);
  const cal = date.slice(0, 7);
  if (cal.length < 7) return cal;
  if (t.type === "income" && t.category === "Salary" && date >= lastWeekdayISO(date)) {
    return nextMonthKey(cal);
  }
  return cal;
}

export function formatMonthDisplay(mKey: string) {
  if (mKey === "all") return "All Time";
  const [year, month] = mKey.split("-");
  if (!year || !month) return mKey;
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export function todayISO() {
  return localISO();
}

export function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISO(d);
}

export function shiftDaysISO(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localISO(d);
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
