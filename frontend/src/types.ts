export type Account = {
  id: string;
  name: string;
  type: "ewallet" | "bank" | "cash";
  emoji: string;
  color: string;
  balance: number;
};

export type Transaction = {
  id: string;
  amount: number; // positive = expense, negative = income
  category: string;
  accountId: string;
  note?: string;
  merchant?: string;
  date: string; // ISO
  createdAt: string;
};

export type WageSettings = {
  mode: "salary" | "hourly";
  monthlySalary: number; // default: 4500
  hoursPerWeek: number; // default: 40
  hourlyRate: number; // e.g. ~26.00
  currency: string;
};
