import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBackendUrl } from "./constants";
import {
  Account,
  BudgetSettings,
  isLiabilityAccount,
  SyncSession,
  SyncStatus,
  Transaction,
  VaultSnapshot,
  WageSettings,
} from "./types";

const K_ACCOUNTS = "dm.accounts.v3";
const K_TXNS = "dm.transactions.v3";
const K_SEED = "dm.seeded.v3";
const K_WAGE = "dt.wage.v3";
const K_BUDGET = "dt.budget.v3";
const K_SYNC_SESSION = "dt.sync.session.v1";
const K_LAST_MODIFIED = "dt.last.modified.v1";
const K_DELETED_TXNS = "dt.deleted.txns.v1";
const K_DELETED_ACCS = "dt.deleted.accs.v1";

export const DEFAULT_WAGE: WageSettings = {
  mode: "salary",
  monthlySalary: 4500,
  hoursPerWeek: 40,
  hourlyRate: 25.96, // 4500 / 173.33
  currency: "RM",
};

export const DEFAULT_BUDGET: BudgetSettings = {
  monthlyOverallLimit: 2000,
  needsLimit: 1300, // Must-Haves (Groceries, Petrol, Makan, Bills, Tolls, Telco)
  comfortLimit: 500, // Guilt-Free Comfort / "Nonsense" Money
  savingsTarget: 200, // Savings & Buffer
  allocationPreset: "balanced_50_30_20",
  enabled: true,
  categoryBudgets: [
    { category: "Makan", monthlyLimit: 500 },
    { category: "Groceries", monthlyLimit: 350 },
    { category: "Petrol", monthlyLimit: 200 },
    { category: "Shopping", monthlyLimit: 300 },
    { category: "Bills", monthlyLimit: 250 },
  ],
};

// Listeners for live sync state
type SyncListener = (status: SyncStatus, session: SyncSession | null) => void;
const syncListeners: Set<SyncListener> = new Set();
let currentSyncStatus: SyncStatus = "idle";
let autoSyncTimeout: any = null;

function notifySync(status: SyncStatus, session: SyncSession | null) {
  currentSyncStatus = status;
  syncListeners.forEach((fn) => {
    try {
      fn(status, session);
    } catch {}
  });
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  getSyncSession().then((session) => listener(currentSyncStatus, session));
  return () => {
    syncListeners.delete(listener);
  };
}

export function calculateHourlyRate(salary: number, hoursPerWeek: number): number {
  if (hoursPerWeek <= 0) return 25.0;
  const monthlyWorkHours = hoursPerWeek * (52 / 12);
  const rate = salary / monthlyWorkHours;
  return +rate.toFixed(2);
}

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function touchModified(): Promise<string> {
  const now = new Date().toISOString();
  await AsyncStorage.setItem(K_LAST_MODIFIED, now);
  scheduleAutoSync();
  return now;
}

// ---------- Cloud Sync Core Methods ----------

export async function getSyncSession(): Promise<SyncSession | null> {
  const raw = await AsyncStorage.getItem(K_SYNC_SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setSyncSession(session: SyncSession) {
  await AsyncStorage.setItem(K_SYNC_SESSION, JSON.stringify(session));
  notifySync(currentSyncStatus, session);
}

/**
 * Initializes or fetches a persistent sync session for this device
 */
export async function initOrGetSyncSession(): Promise<SyncSession> {
  let session = await getSyncSession();
  if (session && session.syncId && session.syncCode) {
    return session;
  }

  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/api/sync/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      session = {
        syncId: data.sync_id,
        syncCode: data.sync_code,
        autoSyncEnabled: true,
        lastModifiedAt: new Date().toISOString(),
      };
      await setSyncSession(session);
      return session;
    }
  } catch (e) {
    console.warn("Could not register sync online, creating local fallback key", e);
  }

  // Local fallback if offline during first open
  const fallbackCode = `DT-${Math.random().toString(36).substring(2, 5).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  session = {
    syncId: id(),
    syncCode: fallbackCode,
    autoSyncEnabled: true,
    lastModifiedAt: new Date().toISOString(),
  };
  await setSyncSession(session);
  return session;
}

/**
 * Pushes all current local data to the Cloud Vault
 */
export async function pushCloudBackup(): Promise<{ success: boolean; message?: string; session?: SyncSession }> {
  const session = await initOrGetSyncSession();
  const [accounts, transactions, wage, budget] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getWageSettings(),
    getBudgetSettings(),
  ]);

  const nowIso = new Date().toISOString();
  notifySync("syncing", session);

  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sync_id: session.syncId,
        sync_code: session.syncCode,
        accounts,
        transactions,
        wage_settings: wage,
        budget_settings: budget,
        last_modified: nowIso,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notifySync("error", session);
      return { success: false, message: err.detail || "Cloud backup failed" };
    }

    const data = await res.json();
    const updatedSession: SyncSession = {
      ...session,
      syncCode: data.sync_code || session.syncCode,
      lastSyncedAt: data.last_modified || nowIso,
    };
    await setSyncSession(updatedSession);
    notifySync("synced", updatedSession);
    return { success: true, session: updatedSession, message: "Cloud backup completed successfully" };
  } catch (e: any) {
    notifySync("offline", session);
    return { success: false, message: e.message || "Network offline, will sync when reconnected" };
  }
}

/**
 * Pulls and restores cloud data onto this phone using Sync Code or ID
 */
export async function pullCloudRestore(
  syncCodeOrKey: string
): Promise<{ success: boolean; message?: string; session?: SyncSession }> {
  if (!syncCodeOrKey.trim()) {
    return { success: false, message: "Please enter a valid Sync Code" };
  }

  notifySync("syncing", null);
  const backendUrl = getBackendUrl();

  try {
    const res = await fetch(`${backendUrl}/api/sync/pull?sync_key=${encodeURIComponent(syncCodeOrKey.trim())}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notifySync("error", null);
      return { success: false, message: err.detail || "Vault not found. Check your Sync Code." };
    }

    const data = await res.json();
    if (data.accounts) await setAccounts(data.accounts, false);
    if (data.transactions) await setTransactions(data.transactions, false);
    if (data.wage_settings) await setWageSettings(data.wage_settings, false);
    if (data.budget_settings) await setBudgetSettings(data.budget_settings, false);
    await AsyncStorage.setItem(K_SEED, "1");

    const newSession: SyncSession = {
      syncId: data.sync_id,
      syncCode: data.sync_code,
      lastSyncedAt: data.last_modified || new Date().toISOString(),
      autoSyncEnabled: true,
    };
    await setSyncSession(newSession);
    notifySync("synced", newSession);

    return {
      success: true,
      session: newSession,
      message: `Restored ${data.accounts?.length || 0} accounts & ${data.transactions?.length || 0} transactions!`,
    };
  } catch (e: any) {
    notifySync("error", null);
    return { success: false, message: e.message || "Could not connect to server to restore data" };
  }
}

async function getDeletedTxnIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(K_DELETED_TXNS);
  return raw ? JSON.parse(raw) : [];
}

async function addDeletedTxnId(id: string) {
  const current = await getDeletedTxnIds();
  if (!current.includes(id)) {
    current.push(id);
    await AsyncStorage.setItem(K_DELETED_TXNS, JSON.stringify(current));
  }
}

async function clearDeletedTxnIds(ids: string[]) {
  const current = await getDeletedTxnIds();
  const next = current.filter((x) => !ids.includes(x));
  await AsyncStorage.setItem(K_DELETED_TXNS, JSON.stringify(next));
}

async function getDeletedAccountIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(K_DELETED_ACCS);
  return raw ? JSON.parse(raw) : [];
}

async function addDeletedAccountId(id: string) {
  const current = await getDeletedAccountIds();
  if (!current.includes(id)) {
    current.push(id);
    await AsyncStorage.setItem(K_DELETED_ACCS, JSON.stringify(current));
  }
}

async function clearDeletedAccountIds(ids: string[]) {
  const current = await getDeletedAccountIds();
  const next = current.filter((x) => !ids.includes(x));
  await AsyncStorage.setItem(K_DELETED_ACCS, JSON.stringify(next));
}

/**
 * Merges cloud data with local data (two-way merge with tombstone deletion support)
 */
export async function mergeWithCloud(): Promise<{ success: boolean; message?: string }> {
  const session = await initOrGetSyncSession();
  const [accounts, transactions, wage, budget, deletedTxnIds, deletedAccIds] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getWageSettings(),
    getBudgetSettings(),
    getDeletedTxnIds(),
    getDeletedAccountIds(),
  ]);

  notifySync("syncing", session);
  const backendUrl = getBackendUrl();

  try {
    const res = await fetch(`${backendUrl}/api/sync/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sync_id: session.syncId,
        sync_code: session.syncCode,
        accounts,
        transactions,
        deleted_txn_ids: deletedTxnIds,
        deleted_account_ids: deletedAccIds,
        wage_settings: wage,
        budget_settings: budget,
        last_modified: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      notifySync("offline", session);
      return { success: false, message: "Sync merge failed" };
    }

    const data = await res.json();
    if (data.accounts) await setAccounts(data.accounts, false);
    if (data.transactions) await setTransactions(data.transactions, false);
    if (data.wage_settings) await setWageSettings(data.wage_settings, false);
    if (data.budget_settings) await setBudgetSettings(data.budget_settings, false);

    // Clear processed tombstones
    if (deletedTxnIds.length > 0) await clearDeletedTxnIds(deletedTxnIds);
    if (deletedAccIds.length > 0) await clearDeletedAccountIds(deletedAccIds);

    const updatedSession: SyncSession = {
      ...session,
      syncCode: data.sync_code || session.syncCode,
      lastSyncedAt: data.last_modified,
    };
    await setSyncSession(updatedSession);
    notifySync("synced", updatedSession);
    return { success: true, message: "Synced with Cloud Vault" };
  } catch (e: any) {
    notifySync("offline", session);
    return { success: false, message: e.message || "Offline" };
  }
}

function scheduleAutoSync() {
  if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
  autoSyncTimeout = setTimeout(() => {
    mergeWithCloud().catch(() => {});
  }, 1500); // Debounced 1.5s
}

// ---------- Data Accessors & Mutations ----------

export async function getWageSettings(): Promise<WageSettings> {
  const raw = await AsyncStorage.getItem(K_WAGE);
  if (!raw) return DEFAULT_WAGE;
  try {
    return { ...DEFAULT_WAGE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WAGE;
  }
}

export async function setWageSettings(w: WageSettings, triggerSync = true) {
  await AsyncStorage.setItem(K_WAGE, JSON.stringify(w));
  if (triggerSync) await touchModified();
}

export async function getBudgetSettings(): Promise<BudgetSettings> {
  const raw = await AsyncStorage.getItem(K_BUDGET);
  if (!raw) return DEFAULT_BUDGET;
  try {
    const parsed = JSON.parse(raw);
    const overall = parsed.monthlyOverallLimit || DEFAULT_BUDGET.monthlyOverallLimit;
    const needs = parsed.needsLimit ?? Math.round(overall * 0.65);
    const comfort = parsed.comfortLimit ?? Math.round(overall * 0.25);
    const savings = parsed.savingsTarget ?? Math.round(overall * 0.10);
    return {
      ...DEFAULT_BUDGET,
      ...parsed,
      monthlyOverallLimit: overall,
      needsLimit: needs,
      comfortLimit: comfort,
      savingsTarget: savings,
      allocationPreset: parsed.allocationPreset || "balanced_50_30_20",
    };
  } catch {
    return DEFAULT_BUDGET;
  }
}

export async function setBudgetSettings(b: BudgetSettings, triggerSync = true) {
  await AsyncStorage.setItem(K_BUDGET, JSON.stringify(b));
  if (triggerSync) await touchModified();
}

export async function getAccounts(): Promise<Account[]> {
  const raw = await AsyncStorage.getItem(K_ACCOUNTS);
  const list: Account[] = raw ? JSON.parse(raw) : [];
  let modified = false;
  for (const acc of list) {
    if (acc.name.includes("Touch n Go") && acc.emoji === "🚗") {
      acc.emoji = "📱";
      modified = true;
    }
  }
  if (modified) {
    await setAccounts(list, false);
  }
  return list;
}

export async function setAccounts(accs: Account[], triggerSync = true) {
  await AsyncStorage.setItem(K_ACCOUNTS, JSON.stringify(accs));
  if (triggerSync) await touchModified();
}

export async function upsertAccount(a: Account) {
  const list = await getAccounts();
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = a;
  else list.push(a);
  await setAccounts(list);
}

export async function deleteAccount(idToRemove: string) {
  await addDeletedAccountId(idToRemove);
  const list = (await getAccounts()).filter((a) => a.id !== idToRemove);
  await setAccounts(list, false);
  await touchModified();
  mergeWithCloud().catch(() => {});
}

export async function getTransactions(): Promise<Transaction[]> {
  const raw = await AsyncStorage.getItem(K_TXNS);
  const list: Transaction[] = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function setTransactions(list: Transaction[], triggerSync = true) {
  await AsyncStorage.setItem(K_TXNS, JSON.stringify(list));
  if (triggerSync) await touchModified();
}

export async function addTransaction(t: Omit<Transaction, "id" | "createdAt">) {
  const list = await getTransactions();
  const tx: Transaction = {
    ...t,
    id: id(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(tx);
  await setTransactions(list, false);

  // update account balance
  const accs = await getAccounts();
  const idx = accs.findIndex((a) => a.id === t.accountId);
  if (idx >= 0) {
    const acc = accs[idx];
    if (isLiabilityAccount(acc.type)) {
      acc.balance = +(acc.balance + t.amount).toFixed(2);
    } else {
      acc.balance = +(acc.balance - t.amount).toFixed(2);
    }
    await setAccounts(accs, false);
  }

  await touchModified();
  return tx;
}

export async function addManyTransactions(txns: Omit<Transaction, "id" | "createdAt">[]) {
  const list = await getTransactions();
  const accs = await getAccounts();

  for (const t of txns) {
    const tx: Transaction = {
      ...t,
      id: id(),
      createdAt: new Date().toISOString(),
    };
    list.unshift(tx);

    const idx = accs.findIndex((a) => a.id === t.accountId);
    if (idx >= 0) {
      const acc = accs[idx];
      if (isLiabilityAccount(acc.type)) {
        acc.balance = +(acc.balance + t.amount).toFixed(2);
      } else {
        acc.balance = +(acc.balance - t.amount).toFixed(2);
      }
    }
  }

  await setTransactions(list, false);
  await setAccounts(accs, false);
  await touchModified();
}

export async function updateTransaction(updated: Transaction) {
  const list = await getTransactions();
  const idx = list.findIndex((t) => t.id === updated.id);
  if (idx >= 0) {
    const old = list[idx];
    const diff = updated.amount - old.amount;
    list[idx] = updated;
    await setTransactions(list, false);

    if (diff !== 0) {
      const accs = await getAccounts();
      const accIdx = accs.findIndex((a) => a.id === updated.accountId);
      if (accIdx >= 0) {
        const acc = accs[accIdx];
        if (isLiabilityAccount(acc.type)) {
          acc.balance = +(acc.balance + diff).toFixed(2);
        } else {
          acc.balance = +(acc.balance - diff).toFixed(2);
        }
        await setAccounts(accs, false);
      }
    }
    await touchModified();
  }
}

export async function deleteTransaction(idToRemove: string) {
  const list = await getTransactions();
  const target = list.find((t) => t.id === idToRemove);
  if (!target) return;

  await addDeletedTxnId(idToRemove);
  await setTransactions(list.filter((t) => t.id !== idToRemove), false);
  const accs = await getAccounts();
  const idx = accs.findIndex((a) => a.id === target.accountId);
  if (idx >= 0) {
    const acc = accs[idx];
    if (isLiabilityAccount(acc.type)) {
      acc.balance = +(acc.balance - target.amount).toFixed(2);
    } else {
      acc.balance = +(acc.balance + target.amount).toFixed(2);
    }
    await setAccounts(accs, false);
  }
  await touchModified();
  mergeWithCloud().catch(() => {});
}

// ---------- File Export & Import ----------

export async function exportBackupJson(): Promise<string> {
  const session = await getSyncSession();
  const [accounts, transactions, wage, budget] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getWageSettings(),
    getBudgetSettings(),
  ]);

  const snapshot: VaultSnapshot = {
    syncId: session?.syncId,
    syncCode: session?.syncCode,
    accounts,
    transactions,
    wageSettings: wage,
    budgetSettings: budget,
    lastModified: new Date().toISOString(),
    appVersion: "1.0.0",
  };

  return JSON.stringify(snapshot, null, 2);
}

export async function importBackupJson(rawJson: string): Promise<{ success: boolean; message?: string }> {
  try {
    const data = JSON.parse(rawJson);
    if (!data.accounts || !Array.isArray(data.accounts)) {
      return { success: false, message: "Invalid backup format: missing accounts" };
    }

    if (data.accounts) await setAccounts(data.accounts, false);
    if (data.transactions) await setTransactions(data.transactions, false);
    if (data.wageSettings) await setWageSettings(data.wageSettings, false);
    if (data.budgetSettings) await setBudgetSettings(data.budgetSettings, false);
    await AsyncStorage.setItem(K_SEED, "1");

    if (data.syncCode) {
      await setSyncSession({
        syncId: data.syncId || id(),
        syncCode: data.syncCode,
        lastSyncedAt: data.lastModified,
        autoSyncEnabled: true,
      });
    }

    await touchModified();
    return {
      success: true,
      message: `Imported ${data.accounts.length} accounts & ${data.transactions?.length || 0} transactions!`,
    };
  } catch (e: any) {
    return { success: false, message: `Failed to parse backup: ${e.message}` };
  }
}

// ---------- Seeding & Reset ----------

export async function seedIfNeeded() {
  const done = await AsyncStorage.getItem(K_SEED);
  if (done) {
    // Ensure session is initialized
    initOrGetSyncSession().catch(() => {});
    return;
  }

  const accs: Account[] = [
    { id: id(), name: "Touch n Go eWallet", type: "ewallet", emoji: "📱", color: "#0066B3", balance: 128.5 },
    { id: id(), name: "MAE / Maybank", type: "bank", emoji: "🐯", color: "#F5B02A", balance: 2450.0 },
    { id: id(), name: "Maybank 2 Cards", type: "credit_card", emoji: "💳", color: "#EC4899", balance: 350.0, creditLimit: 8000, dueDay: 18, monthlyInstallment: 350.0, reminderEnabled: true },
    { id: id(), name: "Maybank Fixed Deposit", type: "fd", emoji: "📈", color: "#10B981", balance: 5000.0, interestRate: 3.85 },
    { id: id(), name: "Car Loan (Perodua)", type: "loan", emoji: "🚘", color: "#EF4444", balance: 18500.0, interestRate: 3.2, dueDay: 25, monthlyInstallment: 650.0, reminderEnabled: true },
    { id: id(), name: "Cash Wallet", type: "cash", emoji: "💵", color: "#34D399", balance: 80.0 },
  ];
  await setAccounts(accs, false);

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const day = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return iso(d);
  };

  const sample: Transaction[] = [
    { id: id(), amount: 15, category: "Makan", accountId: accs[0].id, merchant: "Tealive", note: "Boba 🧋", date: day(0), createdAt: new Date().toISOString() },
    { id: id(), amount: 8.5, category: "Makan", accountId: accs[0].id, merchant: "Hawker", note: "Nasi lemak", date: day(1), createdAt: new Date().toISOString() },
    { id: id(), amount: 60, category: "Petrol", accountId: accs[1].id, merchant: "Petronas", date: day(2), createdAt: new Date().toISOString() },
    { id: id(), amount: 4.2, category: "Tolls", accountId: accs[0].id, merchant: "PLUS", date: day(2), createdAt: new Date().toISOString() },
    { id: id(), amount: 120, category: "Shopping", accountId: accs[2].id, merchant: "Uniqlo", note: "AIRism tee", date: day(4), createdAt: new Date().toISOString() },
    { id: id(), amount: 39, category: "Telco", accountId: accs[1].id, merchant: "Celcom", date: day(5), createdAt: new Date().toISOString() },
    { id: id(), amount: 25.9, category: "Groceries", accountId: accs[1].id, merchant: "Jaya Grocer", date: day(6), createdAt: new Date().toISOString() },
    { id: id(), amount: 45, category: "Shopping", accountId: accs[2].id, merchant: "Shopee", date: day(8), createdAt: new Date().toISOString() },
  ];
  await setTransactions(sample, false);
  await setBudgetSettings(DEFAULT_BUDGET, false);
  await AsyncStorage.setItem(K_SEED, "1");

  // Initial cloud registration and backup
  initOrGetSyncSession().then(() => mergeWithCloud()).catch(() => {});
}

export async function resetAll() {
  await AsyncStorage.multiRemove([K_ACCOUNTS, K_TXNS, K_SEED, K_WAGE, K_BUDGET, K_SYNC_SESSION, K_LAST_MODIFIED]);
}

export function newAccountId() {
  return id();
}

