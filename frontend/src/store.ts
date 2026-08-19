import AsyncStorage from "@react-native-async-storage/async-storage";
import { Account, Transaction, WageSettings } from "./types";
import { ACCOUNT_TEMPLATES } from "./constants";

const K_ACCOUNTS = "dm.accounts.v1";
const K_TXNS = "dm.transactions.v1";
const K_SEED = "dm.seeded.v1";
const K_WAGE = "dt.wage.v1";

export const DEFAULT_WAGE: WageSettings = {
  mode: "salary",
  monthlySalary: 4500,
  hoursPerWeek: 40,
  hourlyRate: 25.96, // 4500 / 173.33
  currency: "RM",
};

export function calculateHourlyRate(salary: number, hoursPerWeek: number): number {
  if (hoursPerWeek <= 0) return 25.0;
  // 52 weeks / 12 months = 4.333 weeks per month
  const monthlyWorkHours = hoursPerWeek * (52 / 12);
  const rate = salary / monthlyWorkHours;
  return +rate.toFixed(2);
}

export async function getWageSettings(): Promise<WageSettings> {
  const raw = await AsyncStorage.getItem(K_WAGE);
  if (!raw) return DEFAULT_WAGE;
  try {
    return { ...DEFAULT_WAGE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WAGE;
  }
}

export async function setWageSettings(w: WageSettings) {
  await AsyncStorage.setItem(K_WAGE, JSON.stringify(w));
}

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getAccounts(): Promise<Account[]> {
  const raw = await AsyncStorage.getItem(K_ACCOUNTS);
  return raw ? JSON.parse(raw) : [];
}

export async function setAccounts(accs: Account[]) {
  await AsyncStorage.setItem(K_ACCOUNTS, JSON.stringify(accs));
}

export async function upsertAccount(a: Account) {
  const list = await getAccounts();
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = a;
  else list.push(a);
  await setAccounts(list);
}

export async function deleteAccount(idToRemove: string) {
  const list = (await getAccounts()).filter((a) => a.id !== idToRemove);
  await setAccounts(list);
}

export async function getTransactions(): Promise<Transaction[]> {
  const raw = await AsyncStorage.getItem(K_TXNS);
  const list: Transaction[] = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function setTransactions(list: Transaction[]) {
  await AsyncStorage.setItem(K_TXNS, JSON.stringify(list));
}

export async function addTransaction(t: Omit<Transaction, "id" | "createdAt">) {
  const list = await getTransactions();
  const tx: Transaction = {
    ...t,
    id: id(),
    createdAt: new Date().toISOString(),
  };
  list.unshift(tx);
  await setTransactions(list);

  // update account balance
  const accs = await getAccounts();
  const idx = accs.findIndex((a) => a.id === t.accountId);
  if (idx >= 0) {
    accs[idx].balance = +(accs[idx].balance - t.amount).toFixed(2);
    await setAccounts(accs);
  }
  return tx;
}

export async function addManyTransactions(txns: Omit<Transaction, "id" | "createdAt">[]) {
  for (const t of txns) {
    await addTransaction(t);
  }
}

export async function deleteTransaction(idToRemove: string) {
  const list = await getTransactions();
  const target = list.find((t) => t.id === idToRemove);
  if (!target) return;

  await setTransactions(list.filter((t) => t.id !== idToRemove));
  const accs = await getAccounts();
  const idx = accs.findIndex((a) => a.id === target.accountId);
  if (idx >= 0) {
    accs[idx].balance = +(accs[idx].balance + target.amount).toFixed(2);
    await setAccounts(accs);
  }
}

export async function seedIfNeeded() {
  const done = await AsyncStorage.getItem(K_SEED);
  if (done) return;

  const accs: Account[] = [
    { id: id(), name: "Touch n Go eWallet", type: "ewallet", emoji: "🚗", color: "#0066B3", balance: 128.5 },
    { id: id(), name: "MAE", type: "bank", emoji: "🐯", color: "#F5B02A", balance: 2450.0 },
    { id: id(), name: "Cash", type: "cash", emoji: "💵", color: "#34D399", balance: 80.0 },
  ];
  await setAccounts(accs);

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
    { id: id(), amount: 39, category: "Telco", accountId: accs[1].id, merchant: "Celcom", date: day(5), createdAt: new Date().toISOString() },
    { id: id(), amount: 25.9, category: "Groceries", accountId: accs[1].id, merchant: "Jaya Grocer", date: day(6), createdAt: new Date().toISOString() },
    { id: id(), amount: 45, category: "Shopping", accountId: accs[1].id, merchant: "Shopee", date: day(8), createdAt: new Date().toISOString() },
  ];
  await setTransactions(sample);
  await AsyncStorage.setItem(K_SEED, "1");
}

export async function resetAll() {
  await AsyncStorage.multiRemove([K_ACCOUNTS, K_TXNS, K_SEED, K_WAGE]);
}

export function newAccountId() {
  return id();
}
